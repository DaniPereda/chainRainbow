import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';
import { withUnreachableGoal } from './support/levels.js';
import { GREEN_MISSCLICK_LAUNCH, GREEN_WINNING_LAUNCH } from './support/launches.js';

describe('goal: win, loss, restart, and undetermined (FR-007, FR-008, FR-009, FR-010, FR-012)', () => {
  // Scenario 3 (spec.md 001): won once a piece ends exactly on the goal
  // cell at a stable state.
  it('marks the level as won when the green piece ends exactly on the goal cell', () => {
    const outcome = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);

    expect(outcome.result).toBe('won');
  });

  // Scenario 4 (spec.md 001): a collision that consumes the hand without meeting
  // the goal is an explicit loss.
  it('marks the level as lost when a collision consumes the hand without meeting the goal', () => {
    const level = withUnreachableGoal(testLevelGreen01, { row: 4, col: 6 });

    const outcome = resolveLaunch(level, GREEN_WINNING_LAUNCH);

    expect(outcome.missclick).toBe(false);
    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });

  // Scenarios 1 & 6 (spec.md 001): a missclick returns the piece to hand, so the
  // level has no verdict yet -- neither won nor lost (FR-012).
  it('leaves the level undetermined on a missclick, since the piece returns to hand (FR-012)', () => {
    const outcome = resolveLaunch(testLevelGreen01, GREEN_MISSCLICK_LAUNCH);

    expect(outcome.missclick).toBe(true);
    expect(outcome.hand.pieces.length).toBeGreaterThan(0);
    expect(outcome.result).toBe('undetermined');
  });

  // FR-010: "restarting" is just invoking resolveLaunch again on the original,
  // never-mutated Level -- no dedicated reset logic needed.
  it('restarting means re-invoking resolveLaunch on the untouched original level', () => {
    const before = JSON.parse(JSON.stringify(testLevelGreen01));

    resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);
    expect(testLevelGreen01).toEqual(before);

    const restarted = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);
    expect(restarted.result).toBe('won');
  });
});
