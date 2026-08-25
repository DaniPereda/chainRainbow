import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelOrange01 } from '../../../src/engine/index.js';
import { levelWithMixedColorCascade, withUnreachableGoal } from './support/levels.js';
import { ORANGE_MISSCLICK_LAUNCH, ORANGE_WINNING_LAUNCH } from './support/launches.js';

describe('orange: jumps 2 cells, intermediate cell untouched (FR-002, FR-003, FR-005)', () => {
  // Scenario 1 (spec.md 002): the impacted piece jumps the intermediate cell
  // untouched and lands exactly 2 cells beyond the point of impact.
  it('leaves the intermediate cell exactly as it was and lands the impacted piece 2 cells away', () => {
    const outcome = resolveLaunch(testLevelOrange01, ORANGE_WINNING_LAUNCH);

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThanOrEqual(1);

    // Intermediate cell: unchanged (still the original green piece).
    expect(outcome.board.cells[3][5]).toEqual({ color: 'green', fragility: 'new' });

    // Impacted piece landed exactly 2 cells beyond the impact point.
    expect(outcome.board.cells[3][6]).toEqual({ color: 'green', fragility: 'cracked' });

    // The launched orange piece survives its own impact and settles here (FR-007).
    expect(outcome.board.cells[3][4]).toEqual({ color: 'orange', fragility: 'new' });
  });
});

describe('orange: cascade -- each link uses the striking piece\'s own color (FR-004)', () => {
  // FR-004, fixed 2026-08-23: each link of a cascade uses the push distance of
  // whichever piece is striking at that point, not the struck piece's own color
  // or the original launcher's -- see research.md 002, Decisión 2.
  it('pushes the second piece by the distance of whichever piece struck it, not its own color or the launcher\'s', () => {
    const outcome = resolveLaunch(levelWithMixedColorCascade(), { direction: 'E', lane: 5 });

    expect(outcome.board.cells[5][4]).toEqual({ color: 'orange', fragility: 'new' }); // the launcher survives and settles here (FR-007)
    expect(outcome.board.cells[5][6]).toEqual({ color: 'green', fragility: 'cracked' }); // first piece: pushed 2 (orange)
    expect(outcome.board.cells[5][7]).toEqual({ color: 'orange', fragility: 'cracked' }); // second piece: pushed 1 (green), not 2
  });
});

describe('orange: win, loss, and undetermined (FR-007)', () => {
  // Scenario 2 (spec.md 002): won once a piece ends exactly on the goal
  // cell at a stable state.
  it('marks the level as won when the jump lands the piece on the goal cell', () => {
    const outcome = resolveLaunch(testLevelOrange01, ORANGE_WINNING_LAUNCH);

    expect(outcome.result).toBe('won');
  });

  // Scenario 3 (spec.md 002): a collision that consumes the hand without meeting
  // the goal is an explicit loss.
  it('marks the level as lost when a collision consumes the hand without meeting the goal', () => {
    const level = withUnreachableGoal(testLevelOrange01, { row: 3, col: 7 });

    const outcome = resolveLaunch(level, ORANGE_WINNING_LAUNCH);

    expect(outcome.missclick).toBe(false);
    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });

  // Scenario 4 (spec.md 002): a missclick returns the piece to hand, so the
  // level has no verdict yet.
  it('leaves the level undetermined on a missclick, since the piece returns to hand', () => {
    const outcome = resolveLaunch(testLevelOrange01, ORANGE_MISSCLICK_LAUNCH);

    expect(outcome.missclick).toBe(true);
    expect(outcome.hand.pieces.length).toBeGreaterThan(0);
    expect(outcome.result).toBe('undetermined');
  });
});
