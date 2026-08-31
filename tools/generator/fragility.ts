import type { Fragility } from '../../src/engine/board.js';

export type FragilityProfile = 'easy' | 'medium' | 'hard';

/**
 * Chance that a "medium" position deviates from the group's base state
 * (013-generator-fragility-difficulty, research.md Decisión 2).
 */
const MEDIUM_DEVIATION_PROBABILITY = 0.3;

function sample(allowedStates: readonly Fragility[], rng: () => number): Fragility {
  return allowedStates[Math.floor(rng() * allowedStates.length)];
}

/**
 * Decides the initial fragility of a whole group of `count` pieces (board
 * decoys, hand decoys, or the solution's own launched pieces), according to
 * `profile`. `allowedStates` is the only thing that distinguishes one group
 * from another -- see data-model.md.
 *
 * `profile === undefined` never calls `rng()`, to preserve every scripted-rng
 * sequence of callers that don't opt into a difficulty profile.
 */
export function assignGroupFragility(
  profile: FragilityProfile | undefined,
  count: number,
  allowedStates: readonly Fragility[],
  rng: () => number,
): Fragility[] {
  if (count === 0) return [];
  if (profile === undefined) return new Array(count).fill('new');

  if (profile === 'easy') {
    const state = sample(allowedStates, rng);
    return new Array(count).fill(state);
  }

  if (profile === 'hard') {
    return Array.from({ length: count }, () => sample(allowedStates, rng));
  }

  // 'medium'
  const base = sample(allowedStates, rng);
  const alternatives = allowedStates.filter((state) => state !== base);
  return Array.from({ length: count }, () => {
    const deviates = rng() < MEDIUM_DEVIATION_PROBABILITY;
    if (deviates && alternatives.length > 0) {
      return sample(alternatives, rng);
    }
    return base;
  });
}
