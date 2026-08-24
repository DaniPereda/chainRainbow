import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt } from '../../../../src/engine/board.js';
import { createRng } from '../../../../tools/generator/rng.js';
import {
  chooseStrikerAndOrigin,
  resolveObligations,
  type Obligation,
  type ResolutionContext,
} from '../../../../tools/generator/obligations.js';

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('scriptedRng exhausted -- test expected fewer calls');
    return values[i++];
  };
}

describe('chooseStrikerAndOrigin: the striker is never the same color as the obligation it resolves', () => {
  it('never picks the obligation\'s own color, across many random attempts', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = createRng(seed);
      const result = chooseStrikerAndOrigin(
        'green',
        'E',
        { row: 3, col: 3 },
        createBoard(),
        ['green', 'orange', 'brown'],
        'settle',
        rng,
      );
      if (result !== null) {
        expect(result.striker).not.toBe('green');
      }
    }
  });
});

describe('resolveObligations: drains the queue for a single-launch construction (data-model.md style)', () => {
  it('produces one hand-launch and one furniture piece, excluding the obligation color from the striker choice', () => {
    const root: Obligation = {
      cell: { row: 4, col: 4 },
      color: 'green',
      kind: 'defender',
      direction: null,
      chainDepth: 0,
      isRoot: true,
    };
    const ctx: ResolutionContext = {
      board: createBoard(),
      rng: scriptedRng([0.5, 0, 0.9, 0.1]),
      availableColors: ['green', 'orange'],
      launchCount: 1,
      defenderContinuationProbability: 0,
      chainOriginProbability: 0,
      maxChainDepth: 4,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.board.cells[4][2]).toEqual({ color: 'green' });
    expect(outcome.rawLaunches).toEqual([{ direction: 'E', lane: 4, color: 'orange' }]);
  });

  it('fails the attempt when a hand-launch\'s path from the edge is not clear', () => {
    // A piece already sitting between the board edge and the striker-origin cell
    // makes the intended hand-launch impossible to reproduce -- generation must
    // report failure here, not silently produce a wrong level (FR-007).
    const blockedBoard = setPieceAt(createBoard(), { row: 4, col: 1 }, { color: 'brown' });
    const root: Obligation = {
      cell: { row: 4, col: 4 },
      color: 'green',
      kind: 'defender',
      direction: null,
      chainDepth: 0,
      isRoot: true,
    };
    const ctx: ResolutionContext = {
      board: blockedBoard,
      rng: scriptedRng([0.5, 0, 0.9, 0.1]),
      availableColors: ['green', 'orange'],
      launchCount: 1,
      defenderContinuationProbability: 0,
      chainOriginProbability: 0,
      maxChainDepth: 4,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(false);
  });

  // data-model.md / research.md: maxChainDepth forces a hand launch eventually,
  // even when chainOriginProbability would otherwise always choose continuation
  // (research.md, "control del número de lanzamientos... profundidad máxima").
  it('forces a hand launch once maxChainDepth is reached, even with chainOriginProbability:1', () => {
    const root: Obligation = {
      cell: { row: 5, col: 5 },
      color: 'green',
      kind: 'defender',
      direction: null,
      chainDepth: 0,
      isRoot: true,
    };
    const ctx: ResolutionContext = {
      board: createBoard(),
      rng: scriptedRng([0.5, 0, 0.9, 0.5, 0, 0.9, 0.5, 0, 0.9]),
      availableColors: ['green', 'orange'],
      launchCount: 1,
      defenderContinuationProbability: 0,
      chainOriginProbability: 1, // would always choose continuation if not for the depth cap
      maxChainDepth: 2,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.rawLaunches).toEqual([{ direction: 'E', lane: 5, color: 'orange' }]);
  });
});
