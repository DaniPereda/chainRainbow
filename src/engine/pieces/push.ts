import type { Board, Coordinate, PieceColor } from '../board.js';
import { getPieceAt, setPieceAt } from '../board.js';
import { stepBy, type Direction } from '../move-step.js';
import type { AnnihilationEvent, ChainEvent, ImpactSite } from '../events.js';

export const PUSH_DISTANCE: Record<PieceColor, number> = {
  green: 1,
  orange: 2,
};

/**
 * Resolves a single strike: a piece of `strikerColor` hitting whatever occupies
 * `position`. Same color -> both vanish (`annihilated: true`). Different color ->
 * the defender is pushed by the striker's own distance, recursing if that lands on
 * a third piece. `position` (where the striker itself came from) is always left
 * empty either way -- the striker was either the originally launched piece, which
 * never persists on the board (applyImpact), or an earlier defender in the same
 * cascade, whose own resting place is `to` of ITS OWN strike, resolved one level up.
 */
function resolveStrike(
  board: Board,
  strikerColor: PieceColor,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[]; annihilated: boolean } {
  const defender = getPieceAt(board, position);
  if (defender === null) {
    return { board, events: [], annihilated: false };
  }

  if (defender.color === strikerColor) {
    const boardAfter = setPieceAt(board, position, null);
    const event: AnnihilationEvent = {
      type: 'ANNIHILATION',
      at: position,
      color: strikerColor, // === defender.color by definition of this branch
    };
    return { board: boardAfter, events: [event], annihilated: true };
  }

  const to = stepBy(position, direction, PUSH_DISTANCE[strikerColor]);

  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = setPieceAt(setPieceAt(board, position, null), to, defender);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece: defender, from: position, to, hasCollision: false }],
      annihilated: false,
    };
  }

  // `to` is occupied: `defender` is now the striker for that next collision. Whatever
  // happens there (push or annihilation), `position` is vacated either way -- but
  // `defender` only ends up settled at `to` if IT wasn't itself annihilated there.
  const next = resolveStrike(board, defender.color, to, direction);
  const clearedPosition = setPieceAt(next.board, position, null);
  const boardAfter = next.annihilated
    ? clearedPosition
    : setPieceAt(clearedPosition, to, defender);

  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece: defender, from: position, to, hasCollision: true },
      ...next.events,
    ],
    annihilated: false,
  };
}

export function applyImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  // The launched piece is the agent that triggers this impact, not a piece that
  // comes to reside on the board -- it never persists, whatever resolveStrike
  // decides (annihilation, a plain push, or a push that cascades into an
  // annihilation further down the chain). resolveStrike already leaves site.to
  // cleared in every case, so there is nothing left to do here (spec.md 006).
  const result = resolveStrike(board, site.piece.color, site.to, site.direction);
  return { board: result.board, events: result.events, nextSites: [] };
}
