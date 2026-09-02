import type { Board, Coordinate, Piece, PieceColor } from './board.js';
import { getPieceAt } from './board.js';
import type { Direction } from './move-step.js';

export type MoveStepEvent = {
  type: 'MOVE_STEP';
  piece: Piece;
  from: Coordinate;
  to: Coordinate;
  hasCollision: boolean;
  // The direction this piece travelled in. Carried explicitly rather than left
  // for a consumer to infer from `from`/`to` -- a real rendering bug found by
  // the user: a piece can travel a FULL LAP and collide with the striker that
  // launched it (016/017's own guarantee, for any real striker on an
  // unobstructed lane), which makes `from` and `to` the SAME coordinate --
  // geometry alone can never recover a direction from a zero displacement, and
  // guessing one (the renderer used to always guess 'E') silently animated
  // every such move eastward regardless of the real launch direction.
  direction: Direction;
  // The color whose push mechanic (PUSH_STRATEGY, src/engine/pieces/push.ts)
  // determined how far `piece` travelled to reach `to` -- NOT necessarily
  // `piece.color` itself: a struck defender moves using the STRIKER's own
  // mechanic/distance, not its own (found via a real rendering bug: brown's
  // variable walk can coincidentally land on exactly 2 cells, which a
  // purely-geometric "is this orange's jump" check couldn't tell apart from an
  // actual orange push -- see launch-animation.ts). `undefined` for a piece
  // that wasn't pushed by anything (a hand launch's own entry, or either
  // branch's fixed 1-cell first hop out of a red split -- FR-001 of
  // 009-red-piece, never governed by PUSH_STRATEGY at all).
  pushedByColor?: PieceColor;
};

export type AnnihilationEvent = {
  type: 'ANNIHILATION';
  at: Coordinate;
  color: PieceColor;
  // Where the annihilated piece travelled from, and the direction it travelled
  // in -- same purpose as MoveStepEvent's own fields, and for the same reason:
  // a real rendering bug found by the user, where a same-color collision was
  // animated as popping into existence directly at `at` and fading there,
  // never visibly travelling from wherever it actually came from. For a
  // MUTUAL same-color collision (applyMutualImpact, two in-flight trajectories
  // meeting head-on) there are genuinely two converging pieces but only one
  // event -- this records one side of it (arbitrarily siteA's), a deliberate
  // simplification: showing both sides at once is a separate, bigger visual
  // question this fix doesn't take on.
  from: Coordinate;
  direction: Direction;
};

export type ChainEvent = MoveStepEvent | AnnihilationEvent;

export type EventLog = ChainEvent[];

export type ImpactSite = {
  piece: Piece;
  direction: Direction;
  from: Coordinate;
  to: Coordinate;
  // Carried forward into the MOVE_STEP event this site eventually produces --
  // see MoveStepEvent's own `pushedByColor` comment for what it means and why.
  pushedByColor?: PieceColor;
  // Present ONLY when `to` is a TENTATIVE single-cell step of an in-progress
  // brown-driven walk (`pushedByColor === 'brown'`), never a final
  // destination -- `from` stays fixed at the walk's real origin while `to`
  // advances one cell every time this site comes back around the FIFO queue
  // (021-cellwise-collision-resolution, research.md Decisión 2). Found as a
  // real bug: two brown-pushed trajectories heading toward each other could
  // cross paths in an intermediate cell without ever sharing a precomputed
  // final destination, so `findCoincidingPair` (which only ever compared
  // final destinations) never caught them meeting. Absent for green/orange
  // (their distance is fixed and small enough that a shared final
  // destination is always the right thing to compare) or any already-final
  // `to`.
  walking?: { edgeCrossings: number };
};

export type ImpactHandler = (
  board: Board,
  site: ImpactSite,
) => { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] };

/**
 * Resolves a collision between two trajectories that are BOTH still in flight
 * (neither is a real, already-settled board piece) -- 019-synchronous-tick-resolution.
 * Distinct from `ImpactHandler`, which always resolves a single moving piece
 * against whatever (if anything) is already sitting on the real board.
 */
export type MutualImpactHandler = (
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
) => { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] };

/**
 * The first two queue entries (by index) that share the same `to` AND whose
 * shared destination is currently EMPTY on the real board, or `null` if none
 * qualify -- deterministic (always the same pair, in the same order, for the
 * same queue/board). 3+ coinciding entries resolve as sequential pairwise
 * collisions: this always returns the FIRST qualifying pair found, and if the
 * result of resolving it still coincides with a remaining entry, the next
 * call finds that pair next (research.md, Decisión 4).
 *
 * The empty-destination requirement is deliberate, found as a real bug by the
 * user: two sites sharing a `to` does NOT by itself mean two trajectories are
 * "meeting each other mid-air" -- it can just as easily mean both happen to be
 * independently heading for the SAME real, still-untouched, stationary
 * defender (one because that's its own split branch's fixed 1-cell hop, the
 * other because its own onward walk happened to stop there, since stopping at
 * an occupant is exactly what a walk does). That is not a mutual collision
 * between the two trajectories at all -- each should resolve normally against
 * whatever is really on the board when its own turn comes, exactly as if the
 * other trajectory didn't exist (`chosen fix, confirmed with the user`: "cada
 * una de ellas deberia operar solo sabiendo quien la golpea y desde donde").
 * A genuine mutual collision is reserved for the case this was actually built
 * for: two in-flight trajectories converging on a cell with nothing real
 * already sitting there.
 */
function findCoincidingPair(queue: ImpactSite[], board: Board): [number, number] | null {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      if (
        queue[i].to.row === queue[j].to.row &&
        queue[i].to.col === queue[j].to.col &&
        getPieceAt(board, queue[i].to) === null
      ) {
        return [i, j];
      }
    }
  }
  return null;
}

/**
 * Advances any number of simultaneously-active trajectories (`initialSites`)
 * one hop at a time, in FIFO order -- which, seeded with more than one site at
 * once, already interleaves them hop-by-hop (A, B, A, B, ...) without any
 * dedicated "round" bookkeeping (019-synchronous-tick-resolution, research.md
 * Decisión 1/2: this queue was always general enough for this, it just never
 * used to be seeded with more than one site). Before every hop, checks whether
 * two currently-queued trajectories already coincide on the same destination
 * AND that destination is currently empty on the real board; if so, resolves
 * that pair via `handleMutualImpact` (a genuine mid-flight collision between
 * two moving pieces, with nothing real in their way) instead of the normal
 * single-site `handleImpact` (a moving piece meeting whatever, if anything, is
 * already settled on the real board -- unchanged, FR-004 of spec.md). Two
 * sites sharing a destination that IS occupied is not a mutual collision --
 * see `findCoincidingPair`'s own comment for why -- so it falls through to
 * ordinary FIFO processing instead, each site resolving independently against
 * whatever is really there when its own turn comes. For `initialSites.length
 * <= 1` the queue can never exceed one pending entry, so `findCoincidingPair`
 * always returns `null` immediately and this behaves exactly as before this
 * feature (FR-006).
 */
export function resolveChain(
  board: Board,
  initialSites: ImpactSite[],
  handleImpact: ImpactHandler,
  handleMutualImpact: MutualImpactHandler,
): { board: Board; events: EventLog } {
  const events: EventLog = [];
  const queue: ImpactSite[] = [...initialSites];
  let currentBoard = board;

  while (queue.length > 0) {
    const collision = findCoincidingPair(queue, currentBoard);
    if (collision !== null) {
      const [indexA, indexB] = collision;
      const siteA = queue[indexA];
      const siteB = queue[indexB];
      queue.splice(indexB, 1);
      queue.splice(indexA, 1);
      const result = handleMutualImpact(currentBoard, siteA, siteB);
      currentBoard = result.board;
      events.push(...result.events);
      queue.push(...result.nextSites);
      continue;
    }

    const site = queue.shift()!;
    const result = handleImpact(currentBoard, site);
    currentBoard = result.board;
    events.push(...result.events);
    queue.push(...result.nextSites);
  }

  return { board: currentBoard, events };
}
