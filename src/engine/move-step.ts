import {
  type Board,
  type Coordinate,
  getPieceAt,
  isInBounds,
  setPieceAt,
} from './board.js';

export type Direction = 'N' | 'S' | 'E' | 'O';

const DIRECTION_DELTA: Record<Direction, { row: number; col: number }> = {
  N: { row: -1, col: 0 },
  S: { row: 1, col: 0 },
  E: { row: 0, col: 1 },
  O: { row: 0, col: -1 },
};

export function step(coord: Coordinate, direction: Direction): Coordinate {
  const delta = DIRECTION_DELTA[direction];
  return { row: coord.row + delta.row, col: coord.col + delta.col };
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'O',
  O: 'E',
};

export function opposite(direction: Direction): Direction {
  return OPPOSITE_DIRECTION[direction];
}

export type MoveStepResult = {
  moved: boolean;
  to: Coordinate;
  collided: boolean;
  board: Board;
};

export function moveStep(
  board: Board,
  from: Coordinate,
  direction: Direction,
  collision: boolean,
): MoveStepResult {
  const to = step(from, direction);
  const piece = getPieceAt(board, from);

  if (!isInBounds(to) || piece === null) {
    return { moved: false, to, collided: false, board };
  }

  const occupant = getPieceAt(board, to);
  const collided = occupant !== null;

  if (collision && collided) {
    return { moved: false, to, collided: true, board };
  }

  // collision=false and collided=true: the destination's occupant is displaced
  // (not merged or pushed) — no piece behavior in this story exercises this path.
  const nextBoard = setPieceAt(setPieceAt(board, from, null), to, piece);
  return { moved: true, to, collided, board: nextBoard };
}
