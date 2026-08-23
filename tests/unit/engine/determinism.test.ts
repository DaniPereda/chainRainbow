import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';
import { GREEN_WINNING_LAUNCH } from './support/launches.js';

describe('determinism: identical input produces identical output (FR-011)', () => {
  // FR-011 / SC-004: the same level + launch always produces a structurally
  // identical LaunchOutcome.
  it('produces a structurally identical LaunchOutcome across repeated invocations', () => {
    const first = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);
    const second = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);
    const third = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  // Purity requirement behind FR-011: resolveLaunch must never mutate its input.
  it('does not mutate the input level across repeated invocations', () => {
    const before = JSON.parse(JSON.stringify(testLevelGreen01));

    resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);
    resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);

    expect(testLevelGreen01).toEqual(before);
  });
});
