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
  // Where this piece was REALLY travelling from/in before landing at `from` --
  // present only when `from`/`direction` alone can't reconstruct that (a
  // brown-driven walk in flight redirected by a mutual collision,
  // `strikeMutualSide`, push.ts: the walk's true origin, several invisible
  // cells earlier, is discarded there in favor of the meeting cell, since
  // that's genuinely where THIS event's own hop begins). Purely a rendering
  // hint (`launch-animation.ts` uses it to glide in from the real origin
  // before this event's own animation, the same way the very first event of
  // a launch glides in from the board's edge) -- never read by the engine
  // itself, never affects `replayEvent`'s board write. Real bug reported by
  // the user: without this, a piece struck mid-walk by a mutual collision
  // simply popped into existence at the meeting cell, the whole walk that
  // led there never visible at all.
  visualOrigin?: { from: Coordinate; direction: Direction };
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
  // meeting head-on) there are genuinely two converging pieces and TWO
  // ANNIHILATION events, one per real side (025-purple-attraction-piece --
  // previously only one was emitted, "recording one side of it", a
  // deliberate simplification that held up until púrpura's own mechanic made
  // the missing side impossible to ignore: the user saw only one of the two
  // attracted pieces ever animate).
  from: Coordinate;
  direction: Direction;
  // See MoveStepEvent's own comment -- same rendering hint, same reason. Real
  // rendering bug found by the user: a piece pushed orange's own 2-cell
  // distance that lands on a same-color piece (or, since 023's Decisión 7,
  // negro's own trigger event after being pushed into a real defender) IS a
  // genuine jump -- `from`/`at` really are 2 cells apart -- but the renderer
  // had no way to know that from an `AnnihilationEvent` alone (only
  // `MoveStepEvent` carried this), so it always animated a plain cell-by-cell
  // walk instead of the arc/bulge every other orange push already gets.
  pushedByColor?: PieceColor;
  // See MoveStepEvent's own comment -- same rendering hint, same reason.
  visualOrigin?: { from: Coordinate; direction: Direction };
};

export type ColorChoiceEvent = {
  type: 'COLOR_CHOICE';
  at: Coordinate;
  // The defender's color before/after the player's choice (024-rainbow-color-change,
  // FR-003) -- purely descriptive, for the renderer to animate the transition; the
  // engine itself never reads these back. Named `fromColor`/`toColor`, not
  // `from`/`to`, deliberately: every other `ChainEvent` variant's `from`/`to`
  // is a `Coordinate` -- reusing those names for a `PieceColor` here would
  // poison `ChainEvent.from`/`.to` into a `Coordinate | PieceColor` union
  // everywhere a consumer switches on `event.type`, real compile fallout
  // found while wiring this event into the renderer.
  fromColor: PieceColor;
  toColor: PieceColor;
};

export type ChainEvent = MoveStepEvent | AnnihilationEvent | ColorChoiceEvent;

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
  // Present ONLY on one of the two sites a púrpura's attraction seeds
  // (025-purple-attraction-piece), while it travels toward the cell where
  // púrpura settled. Like `walking`, `to` is a tentative single-cell step, not
  // a final destination -- but unlike `walking`, the destination IS known in
  // advance (the attraction cell), and the walk starts with a padding phase so
  // both attracted sites -- even starting at different distances -- finish
  // their real advance on the exact same `resolveChain` queue cycle (research.md
  // Decisión 2). `padSteps` is decremented without moving `to` while > 0; once
  // exhausted, each cycle advances `to` one cell with plain `step`/`isInBounds`
  // (never `wrapCoordinate`/`stepWalking`'s edge-crossing cap -- the path back
  // to the attraction cell is always in-bounds by construction, since the
  // piece was found by a bounded, non-wrapping scan in the first place).
  attracting?: { padSteps: number };
  // See MoveStepEvent's own comment -- carried forward unchanged through every
  // requeue of a walking site (the `{...site, to, walking}` spread in
  // applyImpact/push.ts never touches it), and copied onto whatever
  // MOVE_STEP/ANNIHILATION event this site eventually produces.
  visualOrigin?: { from: Coordinate; direction: Direction };
};

/**
 * What resolving a single `ImpactSite` produces -- either the ordinary case
 * (a board, the events it produced, and whatever new sites `resolveChain`
 * should queue next), or, for the first time (024-rainbow-color-change), a
 * PAUSE: the interaction needs a color the only the player can supply before
 * it can finish. `resume(color)` completes exactly that one interaction
 * (never anything queued before or after it) and returns another
 * `ImpactResolution` -- ordinarily `'resolved'`, but in principle it could
 * itself be `'pending-color-choice'` again (the type allows it, even though
 * no color-changing interaction today produces a `nextSite` for the newly
 * recolored piece to reach, FR-007 of 024-rainbow-color-change).
 */
export type ImpactResolution =
  | { status: 'resolved'; board: Board; events: ChainEvent[]; nextSites: ImpactSite[] }
  | {
      status: 'pending-color-choice';
      board: Board;
      events: ChainEvent[];
      at: Coordinate;
      options: PieceColor[];
      resume: (color: PieceColor) => ImpactResolution;
    };

export type ImpactHandler = (board: Board, site: ImpactSite) => ImpactResolution;

/**
 * Resolves a collision between two trajectories that are BOTH still in flight
 * (neither is a real, already-settled board piece) -- 019-synchronous-tick-resolution.
 * Distinct from `ImpactHandler`, which always resolves a single moving piece
 * against whatever (if anything) is already sitting on the real board.
 *
 * Returns `ImpactResolution` -- the exact same type `ImpactHandler` returns,
 * unified deliberately (027-rainbow-attacker-only, research.md Decisión 2): a
 * mutual collision can now also need to PAUSE for a color choice (a displaced
 * arcoíris can end up as one of the two in-flight sides), and `pendingFrom`
 * below is already agnostic about which handler produced a pause -- giving
 * this its own bespoke "plain object" return type would only have meant
 * duplicating `pendingFrom`'s resume logic for no real gain.
 */
export type MutualImpactHandler = (
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
) => ImpactResolution;

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
/**
 * Wraps an `ImpactHandler`'s own `'pending-color-choice'` as the WHOLE chain's
 * own pause (024-rainbow-color-change, research.md Decisión 1): `resolvedSoFar`
 * and `remainingQueue` are exactly what `drive` had accumulated/still had
 * queued the instant this one site paused, captured by closure so `resume`
 * can pick the chain back up from precisely that point -- never re-running or
 * skipping anything else in the queue.
 */
function pendingFrom(
  resolvedSoFar: EventLog,
  remainingQueue: ImpactSite[],
  pending: Extract<ImpactResolution, { status: 'pending-color-choice' }>,
  handleImpact: ImpactHandler,
  handleMutualImpact: MutualImpactHandler,
): ImpactResolution {
  return {
    status: 'pending-color-choice',
    board: pending.board,
    events: [...resolvedSoFar, ...pending.events],
    at: pending.at,
    options: pending.options,
    resume: (color) => {
      // `pending.events` (this pause's OWN pre-pause events -- 024-rainbow-
      // color-change's attacker-vanish event, in practice) must be folded in
      // here too, not just `resolvedSoFar` -- it's already reflected in this
      // very object's own `events` above, but `resolvedSoFar` alone doesn't
      // include it, a real bug found live: the cumulative log lost the
      // attacker's own vanish event the instant a color was chosen.
      const eventsSoFar = [...resolvedSoFar, ...pending.events];
      const result = pending.resume(color);
      if (result.status === 'pending-color-choice') {
        return pendingFrom(eventsSoFar, remainingQueue, result, handleImpact, handleMutualImpact);
      }
      return drive(
        result.board,
        [...remainingQueue, ...result.nextSites],
        [...eventsSoFar, ...result.events],
        handleImpact,
        handleMutualImpact,
      );
    },
  };
}

function drive(
  board: Board,
  initialQueue: ImpactSite[],
  initialEvents: EventLog,
  handleImpact: ImpactHandler,
  handleMutualImpact: MutualImpactHandler,
): ImpactResolution {
  const events: EventLog = [...initialEvents];
  const queue: ImpactSite[] = [...initialQueue];
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
      if (result.status === 'pending-color-choice') {
        return pendingFrom(events, queue, result, handleImpact, handleMutualImpact);
      }
      currentBoard = result.board;
      events.push(...result.events);
      queue.push(...result.nextSites);
      continue;
    }

    const site = queue.shift()!;
    const result = handleImpact(currentBoard, site);

    if (result.status === 'pending-color-choice') {
      return pendingFrom(events, queue, result, handleImpact, handleMutualImpact);
    }

    currentBoard = result.board;
    events.push(...result.events);
    queue.push(...result.nextSites);
  }

  return { status: 'resolved', board: currentBoard, events, nextSites: [] };
}

export function resolveChain(
  board: Board,
  initialSites: ImpactSite[],
  handleImpact: ImpactHandler,
  handleMutualImpact: MutualImpactHandler,
): ImpactResolution {
  return drive(board, initialSites, [], handleImpact, handleMutualImpact);
}
