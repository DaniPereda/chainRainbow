import { describe, expect, it } from 'vitest';
import {
  resolveLaunch,
  testLevelSameColor01,
  testLevelSameColorCascade01,
} from '../../../src/engine/index.js';

describe('same-color: annihilates on the very first impact (FR-001, FR-002)', () => {
  // Acceptance Scenario 1 (spec.md 003): launching a piece into one of the same
  // color removes both immediately; neither executes its impact effect.
  it('removes both pieces and produces a single ANNIHILATION event, no push', () => {
    const outcome = resolveLaunch(testLevelSameColor01, { direction: 'E', lane: 6 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0].type).toBe('ANNIHILATION');
    expect(outcome.board.cells[6][4]).toBeNull();
  });

  // Acceptance Scenario 4 (spec.md 003): the objective is evaluated on the board
  // that results from the annihilation, using the existing win/lose rules.
  it('evaluates the objective on the post-annihilation board (nothing survives, so it is lost)', () => {
    const outcome = resolveLaunch(testLevelSameColor01, { direction: 'E', lane: 6 });

    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });
});

describe('same-color: annihilates mid-cascade, without disturbing an unrelated normal push (FR-001 to FR-004)', () => {
  // Acceptance Scenario 2 (spec.md 003): a piece set in motion by a DIFFERENT-color
  // strike (normal push, unaffected -- Scenario 3) can itself become the striker at
  // the next link of the chain; if THAT collision is same-color, it annihilates too,
  // and the chain stops there.
  it('lets the first (different-color) collision push normally, then annihilates the second (same-color) one', () => {
    const outcome = resolveLaunch(testLevelSameColorCascade01, { direction: 'E', lane: 7 });

    // Launcher (green) settled where the first piece (orange) used to be -- its own
    // collision was a normal push, unaffected by what happens further down the chain.
    expect(outcome.board.cells[7][4]).toEqual({ color: 'green' });

    // The two orange pieces annihilated each other; neither survives anywhere.
    expect(outcome.board.cells[7][5]).toBeNull();

    expect(outcome.events.some((event) => event.type === 'MOVE_STEP')).toBe(true);
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(true);
  });

  it('marks the level as won once the objective cell is reached despite the cascade annihilating downstream', () => {
    const outcome = resolveLaunch(testLevelSameColorCascade01, { direction: 'E', lane: 7 });

    expect(outcome.result).toBe('won');
  });
});
