import type { Board, Coordinate, PieceColor } from './board.js';
import { createBoard, setPieceAt } from './board.js';
import type { Hand } from './launch.js';
import type { Goal } from './goal.js';

export type Level = { board: Board; hand: Hand; goal: Goal };

/** A single "piece of this color goes at this cell" declaration. */
export type PiecePlacement = { at: Coordinate; color: PieceColor };

/**
 * Declarative level builder: pieces already on the board, the hand's colors, and
 * the goal — all expressed with the same `{ at, color }` shape — so a level
 * reads as one visual block instead of a chain of `setPieceAt` calls plus a
 * separately-written goal. `goal` is a single placement today because
 * `Level`/`Goal` only support one target cell; multiple goals are a
 * possible future extension, not handled here.
 */
export function createLevel(config: {
  pieces: PiecePlacement[];
  hand: PieceColor[];
  goal: PiecePlacement;
}): Level {
  const board = config.pieces.reduce(
    (boardSoFar, { at, color }) => setPieceAt(boardSoFar, at, { color, fragility: 'new' }),
    createBoard(),
  );

  return {
    board,
    hand: { pieces: config.hand.map((color) => ({ color, fragility: 'new' })) },
    goal: { targetColor: config.goal.color, targetCell: config.goal.at },
  };
}

export const testLevelGreen01: Level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'orange' }],
  hand: ['green'],
  goal: { at: { row: 4, col: 5 }, color: 'orange' },
});

export const testLevelOrange01: Level = createLevel({
  pieces: [
    { at: { row: 3, col: 4 }, color: 'green' },
    { at: { row: 3, col: 5 }, color: 'green' },
  ],
  hand: ['orange'],
  goal: { at: { row: 3, col: 6 }, color: 'green' },
});

export const testLevelSameColor01: Level = createLevel({
  pieces: [{ at: { row: 6, col: 4 }, color: 'green' }],
  hand: ['green'],
  goal: { at: { row: 6, col: 5 }, color: 'green' },
});

export const testLevelSameColorCascade01: Level = createLevel({
  pieces: [
    { at: { row: 7, col: 4 }, color: 'orange' },
    { at: { row: 7, col: 5 }, color: 'orange' },
  ],
  hand: ['green'],
  goal: { at: { row: 0, col: 0 }, color: 'green' }, // unreachable: nothing survives (spec.md 006)
});

export const testLevelWrapToEmpty01: Level = createLevel({
  pieces: [{ at: { row: 2, col: 7 }, color: 'orange' }],
  hand: ['green'],
  goal: { at: { row: 2, col: 0 }, color: 'orange' },
});
