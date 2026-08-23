import type { Board, Coordinate, PieceColor } from './board.js';
import { createBoard, setPieceAt } from './board.js';
import type { Hand } from './launch.js';
import type { Objective } from './objective.js';

export type Level = { board: Board; hand: Hand; objective: Objective };

/** A single "piece of this color goes at this cell" declaration. */
export type PiecePlacement = { at: Coordinate; color: PieceColor };

/**
 * Declarative level builder: pieces already on the board, the hand's colors, and
 * the objective — all expressed with the same `{ at, color }` shape — so a fixture
 * reads as one visual block instead of a chain of `setPieceAt` calls plus a
 * separately-written objective. `objective` is a single placement today because
 * `Level`/`Objective` only support one target cell; multiple objectives are a
 * possible future extension, not handled here.
 */
export function createTestLevel(config: {
  pieces: PiecePlacement[];
  hand: PieceColor[];
  objective: PiecePlacement;
}): Level {
  const board = config.pieces.reduce(
    (boardSoFar, { at, color }) => setPieceAt(boardSoFar, at, { color }),
    createBoard(),
  );

  return {
    board,
    hand: { pieces: config.hand.map((color) => ({ color })) },
    objective: { targetColor: config.objective.color, targetCell: config.objective.at },
  };
}

export const testLevelGreen01: Level = createTestLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'orange' }],
  hand: ['green'],
  objective: { at: { row: 4, col: 5 }, color: 'orange' },
});

export const testLevelOrange01: Level = createTestLevel({
  pieces: [
    { at: { row: 3, col: 4 }, color: 'green' },
    { at: { row: 3, col: 5 }, color: 'green' },
  ],
  hand: ['orange'],
  objective: { at: { row: 3, col: 6 }, color: 'green' },
});

export const testLevelSameColor01: Level = createTestLevel({
  pieces: [{ at: { row: 6, col: 4 }, color: 'green' }],
  hand: ['green'],
  objective: { at: { row: 6, col: 5 }, color: 'green' },
});

export const testLevelSameColorCascade01: Level = createTestLevel({
  pieces: [
    { at: { row: 7, col: 4 }, color: 'orange' },
    { at: { row: 7, col: 5 }, color: 'orange' },
  ],
  hand: ['green'],
  objective: { at: { row: 7, col: 4 }, color: 'green' },
});
