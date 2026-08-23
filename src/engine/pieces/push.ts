import type { Board, Coordinate, PieceColor } from '../board.js';
import { getPieceAt, isInBounds, setPieceAt } from '../board.js';
import { step, type Direction } from '../move-step.js';
import type { ImpactSite, MoveStepEvent } from '../events.js';

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

function pushOccupant(
  board: Board,
  at: Coordinate,
  direction: Direction,
  strikerDistance: number,
): { board: Board; events: MoveStepEvent[] } {
  const piece = getPieceAt(board, at);
  if (piece === null) {
    return { board, events: [] };
  }

  const to = stepBy(at, direction, strikerDistance);

  if (!isInBounds(to)) {
    // The piece falls off the board. Not reachable from current fixtures; keeps
    // resolution total either way.
    const boardAfter = setPieceAt(board, at, null);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece, from: at, to, collisionResolved: false }],
    };
  }

  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = setPieceAt(setPieceAt(board, at, null), to, piece);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece, from: at, to, collisionResolved: false }],
    };
  }

  // `to` is occupied: `piece` is now the striker for that next collision, so its
  // own color's distance applies there — vacate `to` first, then complete this move.
  const vacated = pushOccupant(board, to, direction, PUSH_DISTANCE[piece.color]);
  const boardAfter = setPieceAt(setPieceAt(vacated.board, at, null), to, piece);
  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece, from: at, to, collisionResolved: true },
      ...vacated.events,
    ],
  };
}

export function applyImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: MoveStepEvent[]; nextSites: ImpactSite[] } {
  const pushed = pushOccupant(board, site.to, site.direction, PUSH_DISTANCE[site.piece.color]);
  const boardFinal = setPieceAt(pushed.board, site.to, site.piece);
  const arrivalEvent: MoveStepEvent = {
    type: 'MOVE_STEP',
    piece: site.piece,
    from: site.from,
    to: site.to,
    collisionResolved: true,
  };
  return { board: boardFinal, events: [arrivalEvent, ...pushed.events], nextSites: [] };
}
