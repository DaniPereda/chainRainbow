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
    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'new' });
    expect(outcome.rawLaunches).toEqual([{ direction: 'E', lane: 4, color: 'orange' }]);
  });

  it('fails the attempt when a hand-launch\'s path from the edge is not clear', () => {
    // A piece already sitting between the board edge and the striker-origin cell
    // makes the intended hand-launch impossible to reproduce -- generation must
    // report failure here, not silently produce a wrong level (FR-007).
    const blockedBoard = setPieceAt(createBoard(), { row: 4, col: 1 }, { color: 'brown', fragility: 'new' });
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
    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'new' });
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
    expect(outcome.board.cells[2][0]).toEqual({ color: 'green', fragility: 'new' }); // la solución real
    expect(outcome.board.cells[0][0]).toEqual({ color: 'green', fragility: 'new' }); // señuelo 1
    expect(outcome.board.cells[0][1]).toEqual({ color: 'green', fragility: 'new' }); // señuelo 2
    expect(outcome.board.cells[0][2]).toEqual({ color: 'green', fragility: 'new' }); // señuelo 3
  });
});

describe('resolveObligations: red split resolution (020-generator-red-support)', () => {
  it('pushes 3 obligations instead of 2 when chooseStrikerAndOrigin resolves to red -- D forced to "new", red hand-launched, secondary branch furniture-forced with the shared "cracked" fragility', () => {
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
      // direction='E' (root) -> origin candidate {4,3} -> redStrikeDirection='N'
      // (perpendicular pair for 'E' is ['N','O']... see RED_STRIKE_DIRECTIONS_FOR_BRANCH)
      // -> secondary branch lands at {4,2} -> red hand-launched (chainOriginProbability=0
      // forces chooseHand=true) -> secondary branch obligation forced to furniture because
      // launchesUsed(1) >= launchCount(1) by the time it's processed.
      rng: scriptedRng([0.5, 0.5, 0.1, 0.9]),
      availableColors: ['green', 'red'],
      launchCount: 1,
      defenderContinuationProbability: 0,
      chainOriginProbability: 0,
      maxChainDepth: 4,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    // D, the pre-split defender -- always 'new' (FR-002).
    expect(outcome.board.cells[4][3]).toEqual({ color: 'green', fragility: 'new' });
    // The secondary branch -- furniture, sharing the split's advanced fragility.
    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'cracked' });
    // Red itself, hand-launched, striking D from the north.
    expect(outcome.rawLaunches).toEqual([{ direction: 'N', lane: 3, color: 'red' }]);
  });

  it('D always resolves as furniture with fragility "new", even when defenderContinuationProbability would otherwise always choose to chain', () => {
    const obligation: Obligation = {
      cell: { row: 2, col: 2 },
      color: 'green',
      kind: 'defender',
      direction: null,
      chainDepth: 0,
      forceFurniture: true,
    };
    const ctx: ResolutionContext = {
      board: createBoard(),
      // forceFurniture short-circuits chooseFurniture before any rng() draw --
      // a throwing rng proves zero calls happen (same discipline as mustBeBroken, 017).
      rng: () => {
        throw new Error('forceFurniture must never consume rng()');
      },
      availableColors: ['green', 'orange'],
      launchCount: 0,
      defenderContinuationProbability: 1,
      chainOriginProbability: 0,
      maxChainDepth: 4,
    };

    const outcome = resolveObligations(obligation, ctx);

    expect(outcome.board.cells[2][2]).toEqual({ color: 'green', fragility: 'new' });
  });

  it('chooseStrikerAndOrigin never returns red for context "occupied", even when red is available and rng favors it', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = createRng(seed);
      const result = chooseStrikerAndOrigin(
        'green',
        'E',
        { row: 3, col: 3 },
        createBoard(),
        ['green', 'orange', 'red'],
        'occupied',
        rng,
      );
      if (result !== null) {
        expect(result.striker).not.toBe('red');
      }
    }
  });

  it('the secondary branch obligation is NOT forced to furniture -- it competes in the same defenderContinuationProbability draw as any other defender obligation (FR-003), instead of always landing directly', () => {
    // Same split as the first test (direction='E' -> origin {4,3} -> redStrikeDirection='N'
    // -> secondary branch lands at {4,2}), but launchCount=2 and
    // defenderContinuationProbability=0.5 so the secondary branch's OWN draw (0.1, below
    // 0.5) chooses to chain instead of furniture -- unlike the first test's launchCount=1,
    // where launchesUsed already reaching launchCount forces furniture regardless of the
    // probability. A second launch (orange) then explains its landing cell instead: 2
    // rawLaunches prove the chain actually happened (plain furniture would need only 1).
    // What actually ends up at the landing cell ({4,2}) is produced by playing the launches
    // forward, not by resolveObligations itself -- exactly like the root obligation's own
    // cell is never set directly either -- see generate.test.ts for that end-to-end check
    // (confirming it's 'cracked', not the free 'new' a normal chained defender would get).
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
      rng: scriptedRng([
        0.5, // root: direction='E'
        0.1, // chooseStrikerAndOrigin shuffle: try 'red' first
        0.5, // chooseStrikerAndOrigin origin pick (single 'red' candidate) -> origin {4,3}
        0.1, // redStrikeDirection='N'
        0.9, // red striker-origin: chooseHand=true (chainOriginProbability=0)
        0.1, // secondary branch defender: chooseFurniture=false (0.1 < 0.5)
        0.5, // direction for the strike explaining the secondary branch's landing cell -> 'E'
        0.9, // chooseStrikerAndOrigin shuffle: try 'orange' first (not a nested red split)
        0.5, // chooseStrikerAndOrigin origin pick (single 'orange' candidate) -> origin {4,0}
        0.9, // the new defender (green, at {4,0}) resolves as furniture ('new')
        0.9, // the new striker-origin (orange, at {4,0}) hand-launches
      ]),
      availableColors: ['green', 'orange', 'red'],
      launchCount: 2,
      defenderContinuationProbability: 0.5,
      chainOriginProbability: 0,
      maxChainDepth: 4,
    };

    const outcome = resolveObligations(root, ctx);

    expect(outcome.ok).toBe(true);
    expect(outcome.board.cells[4][3]).toEqual({ color: 'green', fragility: 'new' }); // D
    expect(outcome.board.cells[4][0]).toEqual({ color: 'green', fragility: 'new' }); // the chain's own origin
    expect(outcome.board.cells[4][2]).toBeNull(); // produced only by real play, not here
    expect(outcome.rawLaunches).toEqual([
      { direction: 'N', lane: 3, color: 'red' },
      { direction: 'E', lane: 4, color: 'orange' },
    ]);
  });
});
