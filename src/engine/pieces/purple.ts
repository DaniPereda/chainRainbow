import type { Board, Coordinate, Piece } from '../board.js';
import { getPieceAt, isInBounds, setPieceAt } from '../board.js';
import { opposite, step, type Direction } from '../move-step.js';
import type { AnnihilationEvent, ImpactSite } from '../events.js';

/**
 * The two directions perpendicular to a travel direction, in a fixed order --
 * same N/S-vs-E/O convention already established by red's own branching
 * (spec.md 009 FR-003) and negro's line axis (023, FR-002/FR-003), reused here
 * for púrpura's own perpendicular scan (spec.md FR-003).
 */
const PERPENDICULAR_SIDES: Record<Direction, [Direction, Direction]> = {
  N: ['E', 'O'],
  S: ['E', 'O'],
  E: ['N', 'S'],
  O: ['N', 'S'],
};

/**
 * Walks from `from` (exclusive) in `direction`, one cell at a time, until it
 * finds a real piece or leaves the board -- plain `step`/`isInBounds`, no
 * `wrapCoordinate` (confirmed with the user, spec.md Clarifications: neither
 * the perpendicular scan nor the attracted pieces' own return trip ever wraps
 * around the board, unlike push-driven movement elsewhere in the engine).
 */
function findNearest(board: Board, from: Coordinate, direction: Direction): Coordinate | null {
  let current = step(from, direction);
  while (isInBounds(current)) {
    if (getPieceAt(board, current) !== null) return current;
    current = step(current, direction);
  }
  return null;
}

/** Both `a`/`b` are always aligned on the same row or column by construction
 * (both found by scanning outward from the same cell along one axis) -- plain
 * Manhattan distance is always the real number of steps between them. */
function axisDistance(a: Coordinate, b: Coordinate): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export type PurpleSettleResult =
  | { status: 'settled'; at: Coordinate; leftPiece: Coordinate; rightPiece: Coordinate }
  | { status: 'missclick' };

/**
 * Advances cell by cell from `entry` in `direction` -- púrpura's own
 * settling condition (spec.md FR-003/FR-004), unrelated to hitting a real
 * defender: at each EMPTY cell, checks both perpendicular sides (relative to
 * `direction`, `PERPENDICULAR_SIDES`) for the nearest real piece each way, any
 * distance, never wrapping (spec.md Clarifications). Settles at the first
 * cell where both sides have one (FR-004). A real piece blocking further
 * travel before that, or running out of board without ever finding one, is a
 * missclick either way (FR-005/FR-006) -- púrpura has no mechanic of its own
 * against a real defender (FR-007), so there is no third outcome.
 */
export function scanPurpleSettle(board: Board, entry: Coordinate, direction: Direction): PurpleSettleResult {
  const [sideA, sideB] = PERPENDICULAR_SIDES[direction];
  let current = entry;

  while (isInBounds(current)) {
    if (getPieceAt(board, current) !== null) {
      return { status: 'missclick' };
    }
    const leftPiece = findNearest(board, current, sideA);
    const rightPiece = findNearest(board, current, sideB);
    if (leftPiece !== null && rightPiece !== null) {
      return { status: 'settled', at: current, leftPiece, rightPiece };
    }
    current = step(current, direction);
  }

  return { status: 'missclick' };
}

export type PurpleLaunchResult =
  | { status: 'missclick' }
  | { status: 'settled'; board: Board; annihilation: AnnihilationEvent; sites: [ImpactSite, ImpactSite] };

/**
 * Resolves a púrpura launch end to end (spec.md FR-003 through FR-011):
 * `scanPurpleSettle`'s missclick propagates as-is; a successful settle
 * produces the ANNIHILATION marking púrpura's own travel-and-disappearance
 * (research.md Decisión 3) plus the two `attracting` `ImpactSite`s the two
 * flanking pieces need to converge on the attraction cell and wait for each
 * other (research.md Decisión 2) -- `board` already reflects BOTH flanking
 * pieces vacating their own cells (they're now "in flight"), exactly like any
 * other impact resolution vacates a defender's cell the instant it starts
 * moving (`applyImpact`'s own `vacated` pattern). The caller (`resolveLaunch`)
 * is responsible for feeding `sites` into `resolveChain` from `board` onward.
 */
export function resolvePurpleLaunch(board: Board, entry: Coordinate, direction: Direction): PurpleLaunchResult {
  const settle = scanPurpleSettle(board, entry, direction);
  if (settle.status === 'missclick') {
    return { status: 'missclick' };
  }

  const { at, leftPiece, rightPiece } = settle;
  const [sideA, sideB] = PERPENDICULAR_SIDES[direction];
  const leftDistance = axisDistance(at, leftPiece);
  const rightDistance = axisDistance(at, rightPiece);
  const maxDistance = Math.max(leftDistance, rightDistance);

  const leftPieceObj = getPieceAt(board, leftPiece) as Piece;
  const rightPieceObj = getPieceAt(board, rightPiece) as Piece;

  const boardWithoutFlankers = setPieceAt(setPieceAt(board, leftPiece, null), rightPiece, null);

  const leftSite: ImpactSite = {
    piece: leftPieceObj,
    direction: opposite(sideA),
    from: leftPiece,
    to: leftPiece,
    attracting: { padSteps: maxDistance - leftDistance },
  };
  const rightSite: ImpactSite = {
    piece: rightPieceObj,
    direction: opposite(sideB),
    from: rightPiece,
    to: rightPiece,
    attracting: { padSteps: maxDistance - rightDistance },
  };

  const annihilation: AnnihilationEvent = {
    type: 'ANNIHILATION',
    at,
    color: 'purple',
    from: step(at, opposite(direction)),
    direction,
  };

  return { status: 'settled', board: boardWithoutFlankers, annihilation, sites: [leftSite, rightSite] };
}
