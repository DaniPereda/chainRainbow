import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';

describe('determinism: identical input produces identical output (FR-011)', () => {
  it('produces a structurally identical LaunchOutcome across repeated invocations', () => {
    const launch = { direction: 'E' as const, lane: 4 };

    const first = resolveLaunch(testLevelGreen01, launch);
    const second = resolveLaunch(testLevelGreen01, launch);
    const third = resolveLaunch(testLevelGreen01, launch);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('does not mutate the input level across repeated invocations', () => {
    const before = JSON.parse(JSON.stringify(testLevelGreen01));

    resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });
    resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });

    expect(testLevelGreen01).toEqual(before);
  });
});
