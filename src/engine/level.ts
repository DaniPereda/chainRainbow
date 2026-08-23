import type { Board } from './board.js';
import { createBoard, setPieceAt } from './board.js';
import type { Hand } from './launch.js';
import type { Objective } from './objective.js';

export type Level = { board: Board; hand: Hand; objective: Objective };

const board = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'green' });

export const testLevelGreen01: Level = {
board,
  hand: { pieces: [{ color: 'green' }] },
  objective: { targetColor: 'green', targetCell: { row: 4, col: 5 } },
};
