import type { Board, Coordinate } from '../board.js';
import { getPieceAt, setPieceAt } from '../board.js';
import { moveStep, type Direction } from '../move-step.js';
import type { ImpactSite, MoveStepEvent } from '../events.js';

function pushOccupant(
  board: Board,
  at: Coordinate,
  direction: Direction,
): { board: Board; events: MoveStepEvent[] } {
  const piece = getPieceAt(board, at);
  if (piece === null) {
    return { board, events: [] };
  }

  const attempt = moveStep(board, at, direction, true);

  if (attempt.moved) {
    return {
      board: attempt.board,
      events: [{ type: 'MOVE_STEP', piece, from: at, to: attempt.to, collisionResolved: false }],
    };
  }

  if (!attempt.collided) {
    // moveStep refused because `attempt.to` is off the board: the piece falls off.
    // Not reachable from this story's fixture; keeps resolution total either way.
    const boardAfter = setPieceAt(board, at, null);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece, from: at, to: attempt.to, collisionResolved: false }],
    };
  }

  const vacated = pushOccupant(board, attempt.to, direction);
  const boardAfter = setPieceAt(setPieceAt(vacated.board, at, null), attempt.to, piece);
  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece, from: at, to: attempt.to, collisionResolved: true },
      ...vacated.events,
    ],
  };
}

export function applyGreenImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: MoveStepEvent[]; nextSites: ImpactSite[] } {
  const pushed = pushOccupant(board, site.to, site.direction);
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
