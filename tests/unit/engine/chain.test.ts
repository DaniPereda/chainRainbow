import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';

describe('chain: interaction resolves fully before the objective is checked (FR-004, FR-005)', () => {
  it('resolves the full chain of MOVE_STEP events and reflects it in the final board', () => {
    const outcome = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThanOrEqual(1);
    outcome.events.forEach((event) => expect(event.type).toBe('MOVE_STEP'));

    const { targetCell, targetColor } = testLevelGreen01.objective;
    expect(outcome.board.cells[targetCell.row][targetCell.col]?.color).toBe(targetColor);
  });
});
