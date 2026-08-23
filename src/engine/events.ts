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

export function resolveChain(
  board: Board,
  initialSite: ImpactSite,
  handleImpact: ImpactHandler,
): { board: Board; events: EventLog } {
  const events: EventLog = [];
  const queue: ImpactSite[] = [initialSite];
  let currentBoard = board;

  while (queue.length > 0) {
    const site = queue.shift()!;
    const result = handleImpact(currentBoard, site);
    currentBoard = result.board;
    events.push(...result.events);
    queue.push(...result.nextSites);
  }

  return { board: currentBoard, events };
}
