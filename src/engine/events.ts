import type { Board, Coordinate, Piece, PieceColor } from './board.js';
import type { Direction } from './move-step.js';

export type MoveStepEvent = {
  type: 'MOVE_STEP';
  piece: Piece;
  from: Coordinate;
  to: Coordinate;
  hasCollision: boolean;
};

export type AnnihilationEvent = {
  type: 'ANNIHILATION';
  at: Coordinate;
  color: PieceColor;
};

export type ChainEvent = MoveStepEvent | AnnihilationEvent;

export type EventLog = ChainEvent[];

export type ImpactSite = {
  piece: Piece;
  direction: Direction;
  from: Coordinate;
  to: Coordinate;
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
 * The first two queue entries (by index) that share the same `to`, or `null`
 * if none do -- deterministic (always the same pair, in the same order, for
 * the same queue). 3+ coinciding entries resolve as sequential pairwise
 * collisions: this always returns the FIRST pair found, and if the result of
 * resolving it still coincides with a remaining entry, the next call finds
 * that pair next (research.md, Decisión 4).
 */
function findCoincidingPair(queue: ImpactSite[]): [number, number] | null {
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      if (queue[i].to.row === queue[j].to.row && queue[i].to.col === queue[j].to.col) {
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
 * two currently-queued trajectories already coincide on the same destination;
 * if so, resolves that pair via `handleMutualImpact` (a genuine mid-flight
 * collision between two moving pieces) instead of the normal single-site
 * `handleImpact` (a moving piece meeting whatever, if anything, is already
 * settled on the real board -- unchanged, FR-004 of spec.md). For
 * `initialSites.length <= 1` the queue can never exceed one pending entry, so
 * `findCoincidingPair` always returns `null` immediately and this behaves
 * exactly as before this feature (FR-006).
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
    const collision = findCoincidingPair(queue);
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
