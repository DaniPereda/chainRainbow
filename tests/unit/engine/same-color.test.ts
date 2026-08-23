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
  // Acceptance Scenario 2 (spec.md 003), reworked per spec.md 006: a piece set in
  // motion by a DIFFERENT-color strike (normal push, unaffected -- Scenario 3) can
  // itself become the striker at the next link of the chain; if THAT collision is
  // same-color, it annihilates too, and the chain stops there. The launcher (green)
  // is never placed on the board either way (spec.md 006) -- nothing survives.
  it('lets the first (different-color) collision push normally, then annihilates the second (same-color) one', () => {
    const outcome = resolveLaunch(testLevelSameColorCascade01, { direction: 'E', lane: 7 });

    // The launcher never persists on the board, whatever its impact resolves to.
    expect(outcome.board.cells[7][4]).toBeNull();

    // The two orange pieces annihilated each other; neither survives anywhere.
    expect(outcome.board.cells[7][5]).toBeNull();

    expect(outcome.events.some((event) => event.type === 'MOVE_STEP')).toBe(true);
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(true);
  });

  it('marks the level as lost, since nothing survives to meet any objective', () => {
    const outcome = resolveLaunch(testLevelSameColorCascade01, { direction: 'E', lane: 7 });

    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });
});
