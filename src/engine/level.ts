import type { Board } from './board.js';
import { createBoard, setPieceAt } from './board.js';
import type { Hand } from './launch.js';
import type { Objective } from './objective.js';

export type Level = { board: Board; hand: Hand; objective: Objective };

const board = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'orange' });

export const testLevelGreen01: Level = {
board,
  hand: { pieces: [{ color: 'green' }] },
  objective: { targetColor: 'orange', targetCell: { row: 4, col: 5 } },
};

const orangeBoard = setPieceAt(
  setPieceAt(createBoard(), { row: 3, col: 4 }, { color: 'green' }),
  { row: 3, col: 5 },
  { color: 'green' },
);

export const testLevelOrange01: Level = {
  board: orangeBoard,
  hand: { pieces: [{ color: 'orange' }] },
  objective: { targetColor: 'green', targetCell: { row: 3, col: 6 } },
};

const sameColorBoard = setPieceAt(createBoard(), { row: 6, col: 4 }, { color: 'green' });

export const testLevelSameColor01: Level = {
  board: sameColorBoard,
  hand: { pieces: [{ color: 'green' }] },
  objective: { targetColor: 'green', targetCell: { row: 6, col: 5 } },
};

const sameColorCascadeBoard = setPieceAt(
  setPieceAt(createBoard(), { row: 7, col: 4 }, { color: 'orange' }),
  { row: 7, col: 5 },
  { color: 'orange' },
);

export const testLevelSameColorCascade01: Level = {
  board: sameColorCascadeBoard,
  hand: { pieces: [{ color: 'green' }] },
  objective: { targetColor: 'green', targetCell: { row: 7, col: 4 } },
};
