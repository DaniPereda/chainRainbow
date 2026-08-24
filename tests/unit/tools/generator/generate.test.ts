import { describe, expect, it } from 'vitest';
import { generateLevel, generateLevelWithRng, type GenerationParams } from '../../../../tools/generator/generate.js';

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('scriptedRng exhausted -- test expected fewer calls');
    return values[i++];
  };
}

const BASE_PARAMS: GenerationParams = {
  launchCount: 1,
  availableColors: ['green', 'orange'],
  chainOriginProbability: 0.5,
  decoyCount: 0,
  seed: 0, // irrelevant when using generateLevelWithRng with a scripted rng
  defenderContinuationProbability: 0,
};

describe('generateLevelWithRng: data-model.md fixtures 1-3, hand-verified against real prototype levels', () => {
  // Fixture 1: single launch, green pushes orange -- same shape as prototype level 1.
  it('fixture 1: a single green push, no cascade', () => {
    const rng = scriptedRng([0.5, 0.5, 0.5, 0.5, 0, 0.9, 0.9]);

    const result = generateLevelWithRng(BASE_PARAMS, rng);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.level.pieces).toEqual([{ at: { row: 4, col: 3 }, color: 'orange' }]);
    expect(result.level.hand).toEqual(['green']);
    expect(result.level.goal).toEqual({ color: 'orange', cell: { row: 4, col: 4 } });
    expect(result.level.solution).toEqual([{ direction: 'E', lane: 4, pieceIndex: 0 }]);
  });

  // Fixture 2: brown's "settle" mode, only reachable on the far edge of the lane
  // -- same shape as prototype level 12.
  it('fixture 2: brown settling directly on the far edge of its lane', () => {
    const params: GenerationParams = { ...BASE_PARAMS, availableColors: ['brown', 'orange'] };
    const rng = scriptedRng([0.5, 0.25, 0.9, 0.5, 0.45, 0.9, 0.9]);

    const result = generateLevelWithRng(params, rng);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.level.pieces).toEqual([{ at: { row: 2, col: 3 }, color: 'orange' }]);
    expect(result.level.hand).toEqual(['brown']);
    expect(result.level.goal).toEqual({ color: 'orange', cell: { row: 2, col: 7 } });
    expect(result.level.solution).toEqual([{ direction: 'E', lane: 2, pieceIndex: 0 }]);
  });

  // Fixture 3: a two-link cascade within one launch -- same shape as prototype level 8.
  it('fixture 3: a two-link cascade discovered via a striker-origin continuation', () => {
    const rng = scriptedRng([0, 0.8, 0.5, 0.5, 0, 0.9, 0.3, 0, 0.9, 0.9]);

    const result = generateLevelWithRng(BASE_PARAMS, rng);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.level.pieces).toEqual([
      { at: { row: 6, col: 1 }, color: 'orange' },
      { at: { row: 6, col: 2 }, color: 'green' },
    ]);
    expect(result.level.hand).toEqual(['green']);
    expect(result.level.goal).toEqual({ color: 'green', cell: { row: 6, col: 4 } });
    expect(result.level.solution).toEqual([{ direction: 'E', lane: 6, pieceIndex: 0 }]);
  });
});

describe('generateLevel: edge cases (spec.md)', () => {
  it('rejects launchCount:0 as invalid input, not a trivial level', () => {
    expect(() => generateLevel({ ...BASE_PARAMS, launchCount: 0 })).toThrow();
  });

  it('reports failure without throwing once maxGenerationAttempts is exhausted', () => {
    // A single-color palette can never resolve any push (the striker would have
    // to share the obligation's own color, always excluded) -- guaranteed to
    // exhaust every attempt.
    const result = generateLevel({
      ...BASE_PARAMS,
      availableColors: ['green'],
      maxGenerationAttempts: 5,
      seed: 42,
    });

    expect(result).toEqual({ ok: false, attemptsUsed: 5 });
  });
});
