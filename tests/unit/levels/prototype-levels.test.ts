import { describe, expect, it } from 'vitest';
import type { PieceColor } from '../../../src/engine/index.js';
import { PROTOTYPE_LEVELS } from '../../../src/levels/prototype-levels.js';

const FASE_1_COLORS: readonly PieceColor[] = ['green', 'orange'];

describe('PROTOTYPE_LEVELS: the 10 hardcoded levels are structurally valid data (FR-003)', () => {
  it('has exactly 10 levels, numbered 1 to 10 with no duplicates', () => {
    expect(PROTOTYPE_LEVELS).toHaveLength(10);
    const ids = PROTOTYPE_LEVELS.map((entry) => entry.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each(PROTOTYPE_LEVELS)('level $id has a valid board, hand, and goal', ({ level }) => {
    expect(level.board.size).toBe(8);
    expect(level.board.cells).toHaveLength(8);
    level.board.cells.forEach((row) => expect(row).toHaveLength(8));

    expect(level.hand.pieces.length).toBeGreaterThan(0);

    const { targetCell } = level.goal;
    expect(targetCell.row).toBeGreaterThanOrEqual(0);
    expect(targetCell.row).toBeLessThan(8);
    expect(targetCell.col).toBeGreaterThanOrEqual(0);
    expect(targetCell.col).toBeLessThan(8);
  });

  it.each(PROTOTYPE_LEVELS)(
    'level $id only uses Fase 1 colors (green/orange) on the board, in hand, and as goal',
    ({ level }) => {
      const boardColors = level.board.cells.flat().filter((cell) => cell !== null).map((piece) => piece.color);
      const handColors = level.hand.pieces.map((piece) => piece.color);

      [...boardColors, ...handColors, level.goal.targetColor].forEach((color) => {
        expect(FASE_1_COLORS).toContain(color);
      });
    },
  );
});
