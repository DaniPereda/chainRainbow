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

describe('resolveObligations: board decoys are re-rolled at every construction step', () => {
  it('never places a decoy when boardDecoyProbability is 0 (default), consuming zero extra rng calls', () => {
    // Reuses the exact same scripted sequence as the first fixture above --
    // if a decoy roll consumed a call even at probability 0, this would throw
    // ("scriptedRng exhausted") or desync the whole trace.
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
      boardDecoyProbability: 0,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.board.cells[4][2]).toEqual({ color: 'green' });
  });

  it('places one decoy per construction step when boardDecoyProbability is 1', () => {
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
      // 3 pasos de construcción (raíz, defensor, origen del golpeador) -- cada
      // uno tira el dado (siempre true con prob:1), elige la primera casilla
      // vacía en orden y siempre el color 'green' (índice 0).
      rng: scriptedRng([
        0.5, 0, 0, 0.5, 0, // paso 1: decoy + dirección + candidato
        0.5, 0, 0, 0.9, // paso 2: decoy + mobiliario
        0.5, 0, 0, 0.9, // paso 3: decoy + lanzamiento de mano
      ]),
      availableColors: ['green', 'orange'],
      launchCount: 1,
      defenderContinuationProbability: 0,
      chainOriginProbability: 0,
      maxChainDepth: 4,
      boardDecoyProbability: 1,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.board.cells[2][0]).toEqual({ color: 'green' }); // la solución real
    expect(outcome.board.cells[0][0]).toEqual({ color: 'green' }); // señuelo 1
    expect(outcome.board.cells[0][1]).toEqual({ color: 'green' }); // señuelo 2
    expect(outcome.board.cells[0][2]).toEqual({ color: 'green' }); // señuelo 3
  });
});
