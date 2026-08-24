import { describe, expect, it } from 'vitest';
import type { PieceColor } from '../../../src/engine/index.js';
import { resolveLaunch } from '../../../src/engine/index.js';
import { PROTOTYPE_LEVELS } from '../../../src/levels/prototype-levels.js';

const ENGINE_COLORS: readonly PieceColor[] = ['green', 'orange', 'brown', 'red'];

describe('PROTOTYPE_LEVELS: the 15 hardcoded levels are structurally valid data (FR-003)', () => {
  it('has exactly 15 levels, numbered 1 to 15 with no duplicates', () => {
    expect(PROTOTYPE_LEVELS).toHaveLength(15);
    const ids = PROTOTYPE_LEVELS.map((entry) => entry.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
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
    'level $id only uses valid engine colors on the board, in hand, and as goal',
    ({ level }) => {
      const boardColors = level.board.cells.flat().filter((cell) => cell !== null).map((piece) => piece.color);
      const handColors = level.hand.pieces.map((piece) => piece.color);

      [...boardColors, ...handColors, level.goal.targetColor].forEach((color) => {
        expect(ENGINE_COLORS).toContain(color);
      });
    },
  );
});

describe('PROTOTYPE_LEVELS: 11-15 bring brown and red into the frontend (spec.md 008/009)', () => {
  it('levels 11-13 use brown and levels 14-15 use red, each winnable via resolveLaunch', () => {
    const level11 = PROTOTYPE_LEVELS.find((entry) => entry.id === 11)!.level;
    expect(resolveLaunch(level11, { direction: 'E', lane: 0 }).result).toBe('won');

    const level12 = PROTOTYPE_LEVELS.find((entry) => entry.id === 12)!.level;
    expect(resolveLaunch(level12, { direction: 'E', lane: 1 }).result).toBe('won');

    const level13 = PROTOTYPE_LEVELS.find((entry) => entry.id === 13)!.level;
    const afterFirst = resolveLaunch(level13, { direction: 'E', lane: 2 });
    expect(afterFirst.result).toBe('undetermined');
    const level13Session: typeof level13 = { ...level13, board: afterFirst.board, hand: afterFirst.hand };
    expect(resolveLaunch(level13Session, { direction: 'E', lane: 2 }).result).toBe('won');

    const level14 = PROTOTYPE_LEVELS.find((entry) => entry.id === 14)!.level;
    expect(resolveLaunch(level14, { direction: 'S', lane: 3 }).result).toBe('won');

    const level15 = PROTOTYPE_LEVELS.find((entry) => entry.id === 15)!.level;
    expect(resolveLaunch(level15, { direction: 'S', lane: 3 }).result).toBe('won');
  });
});
