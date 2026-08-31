import { describe, expect, it } from 'vitest';
import {
  complexityRange,
  resolveComplexity,
  resolveComplexityLevels,
  type ComplexityConfig,
  type ComplexityFactorName,
} from '../../../../tools/generator/complexity.js';
import {
  generateLevel,
  generateLevelWithRng,
  type GenerationParams,
} from '../../../../tools/generator/generate.js';
import { loadComplexityConfig } from '../../../../tools/generator/complexity.js';

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('scriptedRng exhausted -- test expected fewer calls');
    return values[i++];
  };
}

function countingRng(rng: () => number): { rng: () => number; calls: () => number } {
  let calls = 0;
  return {
    rng: () => {
      calls++;
      return rng();
    },
    calls: () => calls,
  };
}

const NO_EXCLUSIONS = new Set<ComplexityFactorName>();

// Mirrors the shape of the real complexity-config.json (7 factors, 3 levels
// each except availableColors' 2) -- kept local so this suite tests the
// algorithm against a config it controls, not the production file (T011).
const BASE_CONFIG: ComplexityConfig = {
  launchCount: { kind: 'integerRange', levels: [{ min: 1, max: 2 }, { min: 3, max: 4 }, { min: 5, max: 6 }] },
  chainOriginProbability: {
    kind: 'floatRange',
    levels: [{ min: 0, max: 0.3 }, { min: 0.3, max: 0.6 }, { min: 0.6, max: 0.9 }],
  },
  defenderContinuationProbability: {
    kind: 'floatRange',
    levels: [{ min: 0, max: 0.3 }, { min: 0.3, max: 0.5 }, { min: 0.5, max: 0.7 }],
  },
  decoyCount: { kind: 'integerRange', levels: [{ min: 0, max: 1 }, { min: 2, max: 3 }, { min: 4, max: 6 }] },
  boardDecoyProbability: {
    kind: 'floatRange',
    levels: [{ min: 0, max: 0.1 }, { min: 0.1, max: 0.3 }, { min: 0.3, max: 0.5 }],
  },
  availableColors: {
    kind: 'discreteSet',
    levels: [{ value: ['green', 'orange'] }, { value: ['green', 'orange', 'brown'] }],
  },
  fragilityProfile: { kind: 'discreteSet', levels: [{ value: 'easy' }, { value: 'medium' }, { value: 'hard' }] },
};

const ALL_FACTOR_NAMES = Object.keys(BASE_CONFIG) as ComplexityFactorName[];

describe('complexityRange', () => {
  it('min is the number of included factors, max is the sum of their level counts', () => {
    // 6 factors with 3 levels + availableColors with 2 = min 7, max 6*3 + 2 = 20
    expect(complexityRange(BASE_CONFIG, NO_EXCLUSIONS)).toEqual({ min: 7, max: 20 });
  });

  it('excludes factors with an explicit override from both min and max', () => {
    const excluded = new Set<ComplexityFactorName>(['launchCount', 'availableColors']);
    // 5 remaining factors, all with 3 levels: min 5, max 15
    expect(complexityRange(BASE_CONFIG, excluded)).toEqual({ min: 5, max: 15 });
  });
});

describe('resolveComplexityLevels', () => {
  it('assigns every included factor level 1 when complexityScore equals the minimum', () => {
    const levels = resolveComplexityLevels(7, BASE_CONFIG, NO_EXCLUSIONS, () => {
      throw new Error('rng() must not be called when no budget needs distributing');
    });
    for (const name of ALL_FACTOR_NAMES) expect(levels[name]).toBe(1);
  });

  it('the assigned levels always sum to exactly the requested complexityScore', () => {
    const rng = () => Math.random();
    for (const target of [7, 10, 15, 20]) {
      for (let trial = 0; trial < 30; trial++) {
        const levels = resolveComplexityLevels(target, BASE_CONFIG, NO_EXCLUSIONS, rng);
        const sum = ALL_FACTOR_NAMES.reduce((acc, name) => acc + levels[name]!, 0);
        expect(sum).toBe(target);
      }
    }
  });

  it('never assigns a factor a level beyond its own configured count', () => {
    const rng = () => Math.random();
    for (let trial = 0; trial < 30; trial++) {
      const levels = resolveComplexityLevels(20, BASE_CONFIG, NO_EXCLUSIONS, rng);
      for (const name of ALL_FACTOR_NAMES) {
        expect(levels[name]!).toBeLessThanOrEqual(BASE_CONFIG[name].levels.length);
        expect(levels[name]!).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('a factor configured with more than 3 levels can be assigned a level above 3', () => {
    const config: ComplexityConfig = {
      ...BASE_CONFIG,
      launchCount: {
        kind: 'integerRange',
        levels: [{ min: 1, max: 1 }, { min: 2, max: 2 }, { min: 3, max: 3 }, { min: 4, max: 4 }, { min: 5, max: 5 }],
      },
    };
    // min 7 (all at level 1), max 5 + 3*5 + 2 = 22 -- request the max, forcing every factor to its own cap.
    const levels = resolveComplexityLevels(22, config, NO_EXCLUSIONS, () => Math.random());
    expect(levels.launchCount).toBe(5);
  });

  it('excluded factors never appear in the result, and do not consume any of the budget', () => {
    const excluded = new Set<ComplexityFactorName>(['launchCount']);
    const levels = resolveComplexityLevels(15, BASE_CONFIG, excluded, () => Math.random());
    expect(levels.launchCount).toBeUndefined();
    const sum = ALL_FACTOR_NAMES.filter((n) => n !== 'launchCount').reduce((acc, name) => acc + levels[name]!, 0);
    expect(sum).toBe(15);
  });

  it('throws when complexityScore is outside the valid [min, max] range', () => {
    expect(() => resolveComplexityLevels(6, BASE_CONFIG, NO_EXCLUSIONS, () => 0)).toThrow();
    expect(() => resolveComplexityLevels(21, BASE_CONFIG, NO_EXCLUSIONS, () => 0)).toThrow();
  });

  it('is deterministic: same complexityScore + config + excluded + rng sequence -> identical result', () => {
    const values = Array.from({ length: 13 }, (_, i) => (i * 0.07) % 1);
    const first = resolveComplexityLevels(15, BASE_CONFIG, NO_EXCLUSIONS, scriptedRng(values));
    const second = resolveComplexityLevels(15, BASE_CONFIG, NO_EXCLUSIONS, scriptedRng(values));
    expect(first).toEqual(second);
  });
});

describe('resolveComplexity (level -> concrete value)', () => {
  it('integerRange and floatRange each consume exactly 1 rng() call per resolved factor', () => {
    const counting = countingRng(() => 0.5);
    // complexityScore === min: every factor sits at level 1, one sampleLevel() call each.
    // 5 numeric factors (integerRange/floatRange) + 1 discreteSet (fragilityProfile, 0 calls)
    // + 1 discreteSet (availableColors, 0 calls) = 5 calls total.
    resolveComplexity(7, BASE_CONFIG, NO_EXCLUSIONS, counting.rng);
    expect(counting.calls()).toBe(5);
  });

  it('discreteSet levels resolve directly to their configured value, consuming 0 rng() calls', () => {
    const resolved = resolveComplexity(7, BASE_CONFIG, NO_EXCLUSIONS, () => 0);
    expect(resolved.availableColors).toEqual(['green', 'orange']);
    expect(resolved.fragilityProfile).toBe('easy');
  });

  it('every resolved numeric value falls within the bracket of its assigned level', () => {
    // A constant rng is still a valid (if extreme) deterministic source: both calls below
    // see the exact same sequence of return values, so the level assigned by
    // resolveComplexityLevels and the value sampled by resolveComplexity agree on which
    // bracket is in play.
    const constantRng = () => 0.999999;
    const levels = resolveComplexityLevels(15, BASE_CONFIG, NO_EXCLUSIONS, constantRng);
    const resolved = resolveComplexity(15, BASE_CONFIG, NO_EXCLUSIONS, constantRng);

    for (const name of ['launchCount', 'chainOriginProbability', 'decoyCount', 'boardDecoyProbability'] as const) {
      const bracket = BASE_CONFIG[name].levels[levels[name]! - 1] as { min: number; max: number };
      const value = resolved[name] as number;
      expect(value).toBeGreaterThanOrEqual(bracket.min);
      expect(value).toBeLessThanOrEqual(bracket.max);
    }
  });

  it('excluded factors never appear in the resolved output', () => {
    const excluded = new Set<ComplexityFactorName>(['fragilityProfile']);
    const resolved = resolveComplexity(10, BASE_CONFIG, excluded, () => Math.random());
    expect(resolved.fragilityProfile).toBeUndefined();
  });
});

describe('generateLevel/generateLevelWithRng with complexityScore (Historia 2, end-to-end)', () => {
  it('the minimum valid complexityScore uses only level-1 brackets for every factor', () => {
    let delivered = 0;
    for (let seed = 0; seed < 20; seed++) {
      const result = generateLevel({ seed, complexityScore: 7, maxGenerationAttempts: 500 });
      if (!result.ok) continue;
      delivered++;

      const { params } = result.level;
      expect(params.launchCount).toBeGreaterThanOrEqual(1);
      expect(params.launchCount).toBeLessThanOrEqual(2); // level 1: [1,2]
      expect(params.chainOriginProbability).toBeGreaterThanOrEqual(0);
      expect(params.chainOriginProbability).toBeLessThanOrEqual(0.3); // level 1: [0,0.3]
      expect(params.decoyCount).toBeGreaterThanOrEqual(0);
      expect(params.decoyCount).toBeLessThanOrEqual(1); // level 1: [0,1]
      expect(params.availableColors).toEqual(['green', 'orange']); // level 1: 2 colors
      expect(params.fragilityProfile).toBe('easy'); // level 1
    }
    expect(delivered).toBeGreaterThan(0);
  });

  it('SC-001: same seed + params + complexityScore always produces an identical level', () => {
    const params: GenerationParams = { seed: 3, complexityScore: 10, maxGenerationAttempts: 5000 };
    const first = generateLevel(params);
    const second = generateLevel(params);
    expect(first).toEqual(second);
  });

  it('SC-003: omitting complexityScore leaves the pre-existing scripted-rng fixtures untouched -- zero new rng() calls', () => {
    // Same fixture as generate.test.ts's "fixture 1", predating complexityScore --
    // if resolveGenerationParams ever called rng() when complexityScore is absent,
    // this exact scripted sequence would desync and throw "scriptedRng exhausted".
    let i = 0;
    const values = [0.5, 0.5, 0.5, 0.5, 0, 0.9, 0.9];
    const rng = () => {
      if (i >= values.length) throw new Error('scriptedRng exhausted');
      return values[i++];
    };
    const params: GenerationParams = {
      launchCount: 1,
      availableColors: ['green', 'orange'],
      chainOriginProbability: 0.5,
      decoyCount: 0,
      seed: 0,
      defenderContinuationProbability: 0,
    };

    const result = generateLevelWithRng(params, rng);

    expect(result.ok).toBe(true);
  });

  it('mixing complexityScore with an explicit factor value: the explicit value always wins', () => {
    let delivered = 0;
    for (let seed = 0; seed < 20; seed++) {
      const result = generateLevel({ seed, complexityScore: 9, launchCount: 2, maxGenerationAttempts: 2000 });
      if (!result.ok) continue;
      delivered++;
      expect(result.level.params.launchCount).toBe(2);
    }
    expect(delivered).toBeGreaterThan(0);
  });
});

describe('Historia 3 (spec.md): las horquillas se ajustan sin tocar código, y los parámetros explícitos siguen mandando', () => {
  it('SC-004: resolveComplexity/complexityRange behave purely as a function of the config parameter -- a bracket edit changes the sampled range with zero code changes', () => {
    const before: ComplexityConfig = {
      ...BASE_CONFIG,
      launchCount: { kind: 'integerRange', levels: [{ min: 1, max: 2 }] },
    };
    const after: ComplexityConfig = {
      ...BASE_CONFIG,
      launchCount: { kind: 'integerRange', levels: [{ min: 100, max: 200 }] },
    };

    const beforeValue = resolveComplexity(7, before, NO_EXCLUSIONS, () => 0.5).launchCount as number;
    const afterValue = resolveComplexity(7, after, NO_EXCLUSIONS, () => 0.5).launchCount as number;

    expect(beforeValue).toBeLessThanOrEqual(2);
    expect(afterValue).toBeGreaterThanOrEqual(100);
  });

  it('loadComplexityConfig() parses the real complexity-config.json into a well-formed config with exactly the 7 expected factor keys', () => {
    const config = loadComplexityConfig();
    const keys = Object.keys(config).sort();
    expect(keys).toEqual(
      [
        'availableColors',
        'boardDecoyProbability',
        'chainOriginProbability',
        'decoyCount',
        'defenderContinuationProbability',
        'fragilityProfile',
        'launchCount',
      ].sort(),
    );
    for (const name of keys as ComplexityFactorName[]) {
      expect(['integerRange', 'floatRange', 'discreteSet']).toContain(config[name].kind);
      expect(config[name].levels.length).toBeGreaterThan(0);
    }
  });

  it('FR-012: a call with neither complexityScore nor any complexity-related override behaves exactly like the pre-014 baseline', () => {
    // Same seeds/params shape as generate.test.ts's "statistical regression across
    // real seeds" fixture, predating complexityScore entirely -- if resolveGenerationParams
    // changed anything about this path, that pre-existing test would already have failed.
    // This is a second, narrower confirmation scoped to this feature's own suite.
    for (let seed = 0; seed < 10; seed++) {
      const result = generateLevel({
        launchCount: 1,
        availableColors: ['green', 'orange', 'brown'],
        chainOriginProbability: 0.5,
        decoyCount: 0,
        seed,
      });
      expect(result.ok).toBe(true);
    }
  });

  it('FR-013: an explicit factor value is excluded from both the random budget and the valid complexityScore range for that call', () => {
    // launchCount pinned explicitly -- the valid range for the other 6 factors
    // (all 3-level except availableColors' 2) is [6, 17], not [7, 20].
    const explicitlyGiven = new Set<ComplexityFactorName>(['launchCount']);
    expect(complexityRange(BASE_CONFIG, explicitlyGiven)).toEqual({ min: 6, max: 17 });

    // 20 (the full 7-factor max) would be out of range once launchCount is excluded --
    // confirms the exclusion is actually applied, not just a range-check detail.
    expect(() => resolveComplexityLevels(20, BASE_CONFIG, explicitlyGiven, () => 0)).toThrow();
    expect(() => resolveComplexityLevels(17, BASE_CONFIG, explicitlyGiven, () => 0.999999)).not.toThrow();
  });
});
