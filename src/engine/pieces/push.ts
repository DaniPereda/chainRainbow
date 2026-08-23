import type { Board, Coordinate, PieceColor } from '../board.js';
import { getPieceAt, isInBounds, setPieceAt } from '../board.js';
import { step, type Direction } from '../move-step.js';
import type { AnnihilationEvent, ChainEvent, ImpactSite, MoveStepEvent } from '../events.js';

export const PUSH_DISTANCE: Record<PieceColor, number> = {
  green: 1,
  orange: 2,
};

function stepBy(coord: Coordinate, direction: Direction, distance: number): Coordinate {
  let current = coord;
  for (let i = 0; i < distance; i++) {
    current = step(current, direction);
  }
  return current;
}

/**
 * Resolves a single strike: a piece of `strikerColor` hitting whatever occupies
 * `defenderAt`. Same color -> both vanish (`annihilated: true`, defenderAt cleared,
 * nothing for the caller to place there). Different color -> the defender is pushed
 * by the striker's own distance, recursing if that lands on a third piece
 * (defenderAt is always left empty either way, so a non-annihilated collision always
 * leaves room for the caller's own piece to settle there).
 */
function resolveStrike(
  board: Board,
  strikerColor: PieceColor,
  defenderAt: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[]; annihilated: boolean } {
  const defender = getPieceAt(board, defenderAt);
  if (defender === null) {
    return { board, events: [], annihilated: false };
  }

  if (defender.color === strikerColor) {
    const boardAfter = setPieceAt(board, defenderAt, null);
    const event: AnnihilationEvent = {
      type: 'ANNIHILATION',
      at: defenderAt,
      color: strikerColor, // === defender.color by definition of this branch
    };
    return { board: boardAfter, events: [event], annihilated: true };
  }

  const to = stepBy(defenderAt, direction, PUSH_DISTANCE[strikerColor]);

  if (!isInBounds(to)) {
    // The defender falls off the board. Not reachable from current fixtures; keeps
    // resolution total either way.
    const boardAfter = setPieceAt(board, defenderAt, null);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece: defender, from: defenderAt, to, collisionResolved: false }],
      annihilated: false,
    };
  }

  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = setPieceAt(setPieceAt(board, defenderAt, null), to, defender);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece: defender, from: defenderAt, to, collisionResolved: false }],
      annihilated: false,
    };
  }

  // `to` is occupied: `defender` is now the striker for that next collision. Whatever
  // happens there (push or annihilation), `defenderAt` is vacated either way -- but
  // `defender` only ends up settled at `to` if IT wasn't itself annihilated there.
  const next = resolveStrike(board, defender.color, to, direction);
  const clearedDefenderAt = setPieceAt(next.board, defenderAt, null);
  const boardAfter = next.annihilated
    ? clearedDefenderAt
    : setPieceAt(clearedDefenderAt, to, defender);

  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece: defender, from: defenderAt, to, collisionResolved: true },
      ...next.events,
    ],
    annihilated: false,
  };
}

export function applyImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  const result = resolveStrike(board, site.piece.color, site.to, site.direction);

  if (result.annihilated) {
    // The launched piece shares the resident's color: both vanish, and the launched
    // piece never settles anywhere (FR-002, spec.md 003).
    return { board: result.board, events: result.events, nextSites: [] };
  }

  const boardFinal = setPieceAt(result.board, site.to, site.piece);
  const arrivalEvent: MoveStepEvent = {
    type: 'MOVE_STEP',
    piece: site.piece,
    from: site.from,
    to: site.to,
    collisionResolved: true,
  };
  return { board: boardFinal, events: [arrivalEvent, ...result.events], nextSites: [] };
}
