import type { Board, Coordinate, PieceColor } from '../board.js';
import { getPieceAt, setPieceAt } from '../board.js';
import { stepBy, stepUntilBlocked, type Direction } from '../move-step.js';
import type { AnnihilationEvent, ChainEvent, ImpactSite } from '../events.js';

/**
 * Computes where a defender ends up after being struck by `strikerColor`, given
 * where it currently is. Green and orange are fixed-distance jumps (never look at
 * `board`); brown walks one cell at a time, checking occupancy at every step, until
 * blocked or capped (spec.md 008) -- three interchangeable strategies, none of them
 * a special case `resolveStrike` needs to know about (Principle V).
 */
type DisplacementStrategy = (board: Board, position: Coordinate, direction: Direction) => Coordinate;

const MAX_EDGE_CROSSINGS = 2;

export const PUSH_STRATEGY: Record<PieceColor, DisplacementStrategy> = {
  green: (_board, position, direction) => stepBy(position, direction, 1),
  orange: (_board, position, direction) => stepBy(position, direction, 2),
  brown: (board, position, direction) => stepUntilBlocked(board, position, direction, MAX_EDGE_CROSSINGS),
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

  const to = PUSH_STRATEGY[strikerColor](board, position, direction);

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
