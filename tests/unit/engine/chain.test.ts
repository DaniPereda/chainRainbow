import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';
import { GREEN_WINNING_LAUNCH } from './support/launches.js';

describe('chain: interaction resolves fully before the objective is checked (FR-004, FR-005)', () => {
  // Scenario 2 (spec.md 001): the chain reaction resolves completely -- every
  // MOVE_STEP event applied -- before resolveLaunch returns.
  it('resolves the full chain of MOVE_STEP events and reflects it in the final board', () => {
    const outcome = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThanOrEqual(1);
    outcome.events.forEach((event) => expect(event.type).toBe('MOVE_STEP'));

    const { targetCell, targetColor } = testLevelGreen01.objective;
    expect(outcome.board.cells[targetCell.row][targetCell.col]?.color).toBe(targetColor);
  });
});
