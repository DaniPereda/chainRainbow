import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelOrange01 } from '../../../src/engine/index.js';

describe('orange: jumps 2 cells, intermediate cell untouched (FR-002, FR-003, FR-005)', () => {
  it('leaves the intermediate cell exactly as it was and lands the impacted piece 2 cells away', () => {
    const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 3 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThanOrEqual(1);

    // Intermediate cell: unchanged (still the original green piece).
    expect(outcome.board.cells[3][5]).toEqual({ color: 'green' });

    // Impacted piece landed exactly 2 cells beyond the impact point.
    expect(outcome.board.cells[3][6]).toEqual({ color: 'green' });

    // The launched orange piece settled where the impacted piece used to be.
    expect(outcome.board.cells[3][4]).toEqual({ color: 'orange' });
  });
});

describe('orange: win, loss, and undetermined (FR-007)', () => {
  it('marks the level as won when the jump lands the piece on the objective cell', () => {
    const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 3 });

    expect(outcome.result).toBe('won');
  });

  it('marks the level as lost when a collision consumes the hand without meeting the objective', () => {
    const levelWithUnreachableObjective = {
      ...testLevelOrange01,
      objective: { targetColor: 'green' as const, targetCell: { row: 3, col: 7 } },
    };

    const outcome = resolveLaunch(levelWithUnreachableObjective, { direction: 'E', lane: 3 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });

  it('leaves the level undetermined on a missclick, since the piece returns to hand', () => {
    const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.hand.pieces.length).toBeGreaterThan(0);
    expect(outcome.result).toBe('undetermined');
  });
});
