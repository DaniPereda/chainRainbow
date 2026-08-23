import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';

describe('objective: win, loss, restart, and undetermined (FR-007, FR-008, FR-009, FR-010, FR-012)', () => {
  it('marks the level as won when the green piece ends exactly on the objective cell', () => {
    const outcome = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });

    expect(outcome.result).toBe('won');
  });

  it('marks the level as lost when a collision consumes the hand without meeting the objective', () => {
    const levelWithUnreachableObjective = {
      ...testLevelGreen01,
      objective: { targetColor: 'green' as const, targetCell: { row: 4, col: 6 } },
    };

    const outcome = resolveLaunch(levelWithUnreachableObjective, { direction: 'E', lane: 4 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });

  it('leaves the level undetermined on a missclick, since the piece returns to hand (FR-012)', () => {
    const outcome = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.hand.pieces.length).toBeGreaterThan(0);
    expect(outcome.result).toBe('undetermined');
  });

  it('restarting means re-invoking resolveLaunch on the untouched original level', () => {
    const before = JSON.parse(JSON.stringify(testLevelGreen01));

    resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });
    expect(testLevelGreen01).toEqual(before);

    const restarted = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });
    expect(restarted.result).toBe('won');
  });
});
