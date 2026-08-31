import { describe, expect, it } from 'vitest';
import { createBoard, type Fragility } from '../../../../src/engine/board.js';
import { createLevel, resolveLaunch, type HandPieceInput } from '../../../../src/engine/index.js';
import { assignGroupFragility, type FragilityProfile } from '../../../../tools/generator/fragility.js';
import { generateLevel, type GenerationParams, type SolutionStep } from '../../../../tools/generator/generate.js';
import { resolveObligations, type Obligation, type ResolutionContext } from '../../../../tools/generator/obligations.js';

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

const NEVER_CALLED: () => number = () => {
  throw new Error('rng() must not be called for this case');
};

describe('assignGroupFragility: contract (data-model.md)', () => {
  it('profile undefined: returns count copies of "new" without calling rng()', () => {
    const result = assignGroupFragility(undefined, 3, ['new', 'cracked', 'broken'], NEVER_CALLED);
    expect(result).toEqual(['new', 'new', 'new']);
  });

  it('"easy": makes exactly 1 rng() call and returns count copies of one sampled state', () => {
    const counting = countingRng(scriptedRng([0.5])); // floor(0.5*3) = 1 -> 'cracked'
    const result = assignGroupFragility('easy', 4, ['new', 'cracked', 'broken'], counting.rng);

    expect(result).toEqual(['cracked', 'cracked', 'cracked', 'cracked']);
    expect(counting.calls()).toBe(1);
  });

  it('"hard": makes exactly `count` independent rng() calls, one per position', () => {
    const counting = countingRng(scriptedRng([0.1, 0.9, 0.4])); // indices 0, 1, 0 over ['new','cracked']
    const result = assignGroupFragility('hard', 3, ['new', 'cracked'], counting.rng);

    expect(result).toEqual(['new', 'cracked', 'new']);
    expect(counting.calls()).toBe(3);
  });

  it('"medium": samples a base state, then rolls a deviation per position', () => {
    // base: floor(0.1*2)=0 -> 'new'
    // position 1 deviation roll: 0.5 >= 0.3 -> no deviation -> stays 'new'
    // position 2 deviation roll: 0.1 < 0.3 -> deviates -> alt pick among ['cracked']: floor(0.9*1)=0 -> 'cracked'
    const counting = countingRng(scriptedRng([0.1, 0.5, 0.1, 0.9]));
    const result = assignGroupFragility('medium', 2, ['new', 'cracked'], counting.rng);

    expect(result).toEqual(['new', 'cracked']);
    expect(counting.calls()).toBe(4);
  });

  it('"medium": call count stays within [1 + count, 1 + count * 2]', () => {
    const rng = () => Math.random();
    for (let i = 0; i < 20; i++) {
      const counting = countingRng(rng);
      const count = 5;
      assignGroupFragility('medium', count, ['new', 'cracked', 'broken'], counting.rng);
      expect(counting.calls()).toBeGreaterThanOrEqual(1 + count);
      expect(counting.calls()).toBeLessThanOrEqual(1 + count * 2);
    }
  });

  it('count === 0: always returns [] without calling rng(), for any profile', () => {
    const profiles: (FragilityProfile | undefined)[] = [undefined, 'easy', 'medium', 'hard'];
    for (const profile of profiles) {
      expect(assignGroupFragility(profile, 0, ['new', 'cracked', 'broken'], NEVER_CALLED)).toEqual([]);
    }
  });

  it('never returns a state outside allowedStates, for any profile', () => {
    const allowedStates: Fragility[] = ['new', 'cracked'];
    const rng = () => Math.random();
    for (const profile of ['easy', 'medium', 'hard'] as const) {
      const result = assignGroupFragility(profile, 20, allowedStates, rng);
      for (const state of result) {
        expect(allowedStates).toContain(state);
      }
    }
  });
});

function replayToResult(level: ReturnType<typeof createLevel>, solution: SolutionStep[]) {
  let current = level;
  let lastResult = 'undetermined';
  for (const step of solution) {
    const outcome = resolveLaunch(current, { direction: step.direction, lane: step.lane }, step.pieceIndex);
    current = { board: outcome.board, hand: outcome.hand, goal: current.goal };
    lastResult = outcome.result;
  }
  return lastResult;
}

describe('Historia 1 (spec.md): la fragilidad asignada nunca rompe la propia solución construida', () => {
  it('SC-001: 100% of levels DELIVERED as valid from a large multi-launch batch replay to won', () => {
    let delivered = 0;
    for (let seed = 0; seed < 60; seed++) {
      const params: GenerationParams = {
        launchCount: 2,
        availableColors: ['green', 'orange', 'brown'],
        chainOriginProbability: 0.5,
        decoyCount: 2,
        boardDecoyProbability: 0.3,
        fragilityProfile: 'hard',
        maxGenerationAttempts: 500,
        seed,
      };
      const result = generateLevel(params);
      if (!result.ok) continue; // spec.md: only levels DELIVERED as valid are covered by SC-001
      delivered++;

      const level = createLevel({
        pieces: result.level.pieces,
        hand: result.level.hand,
        goal: { at: result.level.goal.cell, color: result.level.goal.color },
      });
      expect(replayToResult(level, result.level.solution)).toBe('won');
    }
    expect(delivered).toBeGreaterThan(0); // otherwise this test would pass vacuously
  });

  it('a board piece the solution builds without any board decoys is always solution-critical, and always ends up "new"', () => {
    let delivered = 0;
    for (let seed = 0; seed < 30; seed++) {
      const params: GenerationParams = {
        launchCount: 2,
        availableColors: ['green', 'orange', 'brown'],
        chainOriginProbability: 0.5,
        decoyCount: 0,
        // No boardDecoyProbability: every board piece present is solution-critical
        // (either a defender's furniture, or a struck-once origin) -- FR-002.
        fragilityProfile: 'hard',
        maxGenerationAttempts: 500,
        seed,
      };
      const result = generateLevel(params);
      if (!result.ok) continue;
      delivered++;

      for (const piece of result.level.pieces) {
        expect(piece.fragility).toBe('new');
      }
    }
    expect(delivered).toBeGreaterThan(0);
  });
});

function handFragility(entry: HandPieceInput): Fragility {
  return typeof entry === 'string' ? 'new' : (entry.fragility ?? 'new');
}

function uniqueStates(entries: HandPieceInput[]): Set<Fragility> {
  return new Set(entries.map(handFragility));
}

describe('Historia 2 (spec.md): board-decoy group, "easy" vs "hard" (via resolveObligations, hand-traced)', () => {
  // Same deterministic construction as obligations.test.ts's "places one decoy
  // per construction step when boardDecoyProbability is 1" -- (2,0) is the one
  // solution-critical piece, (0,0)/(0,1)/(0,2) are the three board decoys, in
  // that placement order. Only the fragility-roll values are new here.
  function baseRootAndCtx(rng: () => number, fragilityProfile: FragilityProfile): { root: Obligation; ctx: ResolutionContext } {
    const root: Obligation = {
      cell: { row: 2, col: 2 },
      color: 'green',
      kind: 'defender',
      direction: null,
      chainDepth: 0,
      isRoot: true,
    };
    const ctx: ResolutionContext = {
      board: createBoard(),
      rng,
      availableColors: ['green', 'orange'],
      launchCount: 1,
      defenderContinuationProbability: 0,
      chainOriginProbability: 0,
      maxChainDepth: 4,
      boardDecoyProbability: 1,
      fragilityProfile,
    };
    return { root, ctx };
  }

  function scripted(values: number[]): () => number {
    let i = 0;
    return () => {
      if (i >= values.length) throw new Error('scripted rng exhausted');
      return values[i++];
    };
  }

  it('"easy": all three board decoys share the one state rolled on the first decoy (FR-006)', () => {
    // Same base sequence as obligations.test.ts, with one extra value (0.9 ->
    // 'cracked' over ['new','cracked']) inserted right after the FIRST decoy's
    // color roll -- 'easy' caches it and never rolls again for decoys 2 and 3.
    const rng = scripted([
      0.5, 0, 0, 0.9, 0.5, 0, // paso 1: decoy-check, cell, color, FRAGILITY(easy, cached), dirección, candidato
      0.5, 0, 0, 0.9, // paso 2: decoy-check, cell, color, mobiliario (fragilidad reutilizada, sin nueva llamada)
      0.5, 0, 0, 0.9, // paso 3: decoy-check, cell, color, lanzamiento de mano
    ]);
    const { root, ctx } = baseRootAndCtx(rng, 'easy');

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.board.cells[2][0]).toEqual({ color: 'green', fragility: 'new' }); // la solución real -- FR-001/FR-002
    expect(outcome.board.cells[0][0]).toEqual({ color: 'green', fragility: 'cracked' }); // señuelo 1
    expect(outcome.board.cells[0][1]).toEqual({ color: 'green', fragility: 'cracked' }); // señuelo 2 -- mismo estado
    expect(outcome.board.cells[0][2]).toEqual({ color: 'green', fragility: 'cracked' }); // señuelo 3 -- mismo estado
  });

  it('"hard": each board decoy rolls its own state independently (FR-007), never BROKEN (FR-008)', () => {
    const rng = scripted([
      0.5, 0, 0, 0.9, 0.5, 0, // paso 1: ... FRAGILITY(hard) -> 'cracked'
      0.5, 0, 0, 0.1, 0.9, // paso 2: ... FRAGILITY(hard) -> 'new'
      0.5, 0, 0, 0.9, 0.9, // paso 3: ... FRAGILITY(hard) -> 'cracked'
    ]);
    const { root, ctx } = baseRootAndCtx(rng, 'hard');

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.board.cells[2][0]).toEqual({ color: 'green', fragility: 'new' }); // la solución real
    expect(outcome.board.cells[0][0]).toEqual({ color: 'green', fragility: 'cracked' }); // señuelo 1
    expect(outcome.board.cells[0][1]).toEqual({ color: 'green', fragility: 'new' }); // señuelo 2 -- distinto de señuelo 1
    expect(outcome.board.cells[0][2]).toEqual({ color: 'green', fragility: 'cracked' }); // señuelo 3
  });
});

describe('Historia 2 (spec.md): hand-decoy and launched-piece groups (via generateLevel)', () => {
  it('"easy": launched pieces share one state and hand decoys share one (possibly different) state', () => {
    let delivered = 0;
    for (let seed = 0; seed < 40; seed++) {
      const params: GenerationParams = {
        launchCount: 3,
        availableColors: ['green', 'orange', 'brown'],
        chainOriginProbability: 0.6,
        defenderContinuationProbability: 0.5,
        decoyCount: 3,
        fragilityProfile: 'easy',
        maxGenerationAttempts: 500,
        seed,
      };
      const result = generateLevel(params);
      if (!result.ok) continue;
      delivered++;

      const launched = result.level.hand.slice(0, result.level.solution.length);
      const decoys = result.level.hand.slice(result.level.solution.length);
      expect(uniqueStates(launched).size).toBeLessThanOrEqual(1);
      expect(uniqueStates(decoys).size).toBeLessThanOrEqual(1);
    }
    expect(delivered).toBeGreaterThan(0);
  });

  it('"hard": over a large batch, launched pieces and hand decoys show more within-group variety than "easy" (SC-003)', () => {
    function heterogeneityRate(profile: FragilityProfile): { launchedRate: number; decoyRate: number } {
      let delivered = 0;
      let launchedHeterogeneous = 0;
      let decoyHeterogeneous = 0;
      for (let seed = 0; seed < 80; seed++) {
        const params: GenerationParams = {
          launchCount: 3,
          availableColors: ['green', 'orange', 'brown'],
          chainOriginProbability: 0.6,
          defenderContinuationProbability: 0.5,
          decoyCount: 3,
          fragilityProfile: profile,
          maxGenerationAttempts: 500,
          seed,
        };
        const result = generateLevel(params);
        if (!result.ok) continue;
        delivered++;

        const launched = result.level.hand.slice(0, result.level.solution.length);
        const decoys = result.level.hand.slice(result.level.solution.length);
        if (uniqueStates(launched).size > 1) launchedHeterogeneous++;
        if (uniqueStates(decoys).size > 1) decoyHeterogeneous++;
      }
      expect(delivered).toBeGreaterThan(0);
      return { launchedRate: launchedHeterogeneous / delivered, decoyRate: decoyHeterogeneous / delivered };
    }

    const easy = heterogeneityRate('easy');
    const hard = heterogeneityRate('hard');

    expect(easy.launchedRate).toBe(0); // FR-006: 'easy' is always uniform
    expect(easy.decoyRate).toBe(0);
    expect(hard.launchedRate).toBeGreaterThan(easy.launchedRate);
    expect(hard.decoyRate).toBeGreaterThan(easy.decoyRate);
  });

  it('any profile: board-struck pieces stay "new" and the reference solution still resolves "won"', () => {
    for (const profile of ['easy', 'medium', 'hard'] as const) {
      let delivered = 0;
      for (let seed = 0; seed < 20; seed++) {
        const params: GenerationParams = {
          launchCount: 2,
          availableColors: ['green', 'orange', 'brown'],
          chainOriginProbability: 0.5,
          decoyCount: 2,
          boardDecoyProbability: 0.3,
          fragilityProfile: profile,
          maxGenerationAttempts: 500,
          seed,
        };
        const result = generateLevel(params);
        if (!result.ok) continue;
        delivered++;

        const level = createLevel({
          pieces: result.level.pieces,
          hand: result.level.hand,
          goal: { at: result.level.goal.cell, color: result.level.goal.color },
        });
        expect(replayToResult(level, result.level.solution)).toBe('won');
      }
      expect(delivered).toBeGreaterThan(0);
    }
  });

  it('SC-004: same seed + params + profile always produces an identical level, including fragility', () => {
    const params: GenerationParams = {
      launchCount: 2,
      availableColors: ['green', 'orange', 'brown'],
      chainOriginProbability: 0.5,
      decoyCount: 2,
      boardDecoyProbability: 0.3,
      fragilityProfile: 'hard',
      maxGenerationAttempts: 500,
      seed: 7,
    };

    const first = generateLevel(params);
    const second = generateLevel(params);

    expect(first).toEqual(second);
  });

  it('omitting fragilityProfile leaves the existing scripted-rng-verified fixtures untouched (research.md, disciplina de determinismo)', () => {
    // generate.test.ts's fixtures 1-3 and the launchCount:2/decoy fixtures already
    // exercise this without any fragilityProfile -- this is a direct, minimal
    // confirmation that assignGroupFragility itself never touches rng() when the
    // profile is omitted, regardless of how many pieces are involved.
    const rng = () => {
      throw new Error('rng() must not be called when fragilityProfile is omitted');
    };
    expect(assignGroupFragility(undefined, 5, ['new', 'cracked', 'broken'], rng)).toEqual([
      'new',
      'new',
      'new',
      'new',
      'new',
    ]);
  });
});

function countBoardPieces(level: ReturnType<typeof createLevel>): number {
  let count = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (level.board.cells[row][col] !== null) count++;
    }
  }
  return count;
}

describe('Historia 3 (spec.md): ningún señuelo de tablero desaparece por quedar BROKEN', () => {
  it('SC-002: no board piece is ever "broken", and none vanishes when re-created via createLevel', () => {
    let delivered = 0;
    for (let seed = 0; seed < 60; seed++) {
      const params: GenerationParams = {
        launchCount: 2,
        availableColors: ['green', 'orange', 'brown'],
        chainOriginProbability: 0.5,
        decoyCount: 2,
        boardDecoyProbability: 0.5, // alto, para maximizar señuelos de tablero
        fragilityProfile: 'hard', // el que más heterogeneidad introduce
        maxGenerationAttempts: 500,
        seed,
      };
      const result = generateLevel(params);
      if (!result.ok) continue;
      delivered++;

      for (const piece of result.level.pieces) {
        expect(piece.fragility).not.toBe('broken');
      }

      const recreated = createLevel({
        pieces: result.level.pieces,
        hand: result.level.hand,
        goal: { at: result.level.goal.cell, color: result.level.goal.color },
      });
      // FR-016 (012-piece-fragility): createLevel omite en silencio cualquier
      // ficha de tablero declarada 'broken' -- si esto alguna vez fallara, el
      // recuento de piezas del board recreado sería MENOR que el declarado.
      expect(countBoardPieces(recreated)).toBe(result.level.pieces.length);
    }
    expect(delivered).toBeGreaterThan(0);
  });

  it('contrast: hand decoys, under the same profile, DO reach "broken" (FR-009) -- the asymmetry is intentional', () => {
    let brokenHandDecoysSeen = 0;
    for (let seed = 0; seed < 80; seed++) {
      const params: GenerationParams = {
        launchCount: 1,
        availableColors: ['green', 'orange', 'brown'],
        chainOriginProbability: 0.5,
        decoyCount: 4,
        fragilityProfile: 'hard',
        maxGenerationAttempts: 500,
        seed,
      };
      const result = generateLevel(params);
      if (!result.ok) continue;

      const decoys = result.level.hand.slice(result.level.solution.length);
      for (const decoy of decoys) {
        if (handFragility(decoy) === 'broken') brokenHandDecoysSeen++;
      }
    }
    expect(brokenHandDecoysSeen).toBeGreaterThan(0);
  });
});
