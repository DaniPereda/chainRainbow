import { describe, expect, it } from 'vitest';
import { createBoard, getPieceAt } from '../../../../src/engine/board.js';
import { buildBlackDecoyCandidates } from '../../../../tools/generator/black-decoys.js';
import type { LandingCell, RawLaunch } from '../../../../tools/generator/obligations.js';

function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('scriptedRng exhausted -- test expected fewer calls');
    return values[i++];
  };
}

describe('buildBlackDecoyCandidates: Estrategia A -- protege el carril de aproximación, negro en perpendicular (US1)', () => {
  it('coloca el bloqueante en el propio carril, pero negro se acerca por el eje perpendicular', () => {
    const rawLaunches: RawLaunch[] = [
      { direction: 'E', lane: 4, color: 'orange', target: { row: 4, col: 3 } },
    ];

    const candidates = buildBlackDecoyCandidates(
      createBoard(),
      rawLaunches,
      [],
      ['green', 'orange'],
      undefined,
      scriptedRng([0.5, 0.4, 0.1, 0.05, 0.1]),
      // chosen idx0; blockerCell = cells[floor(0.4*3)=1] = (4,1);
      // negroDirection: 0.1<0.5 -> 'N'; extraCount: floor(0.05*7)=0; color 'green'
    );

    expect(candidates).toHaveLength(1);
    expect(getPieceAt(candidates[0].board, { row: 4, col: 1 })).toEqual({ color: 'green', fragility: 'new' });
    expect(candidates[0].rawLaunches).toEqual([
      { direction: 'E', lane: 4, color: 'orange', target: { row: 4, col: 3 } },
      { direction: 'N', lane: 1, color: 'black', target: { row: 4, col: 1 } },
    ]);
  });

  it('nunca coloca el bloqueante sobre la celda objetivo real, y negro nunca comparte el carril del lanzamiento protegido', () => {
    const rawLaunches: RawLaunch[] = [
      { direction: 'E', lane: 4, color: 'orange', target: { row: 4, col: 3 } },
    ];

    const candidates = buildBlackDecoyCandidates(
      createBoard(),
      rawLaunches,
      [],
      ['green', 'orange'],
      undefined,
      scriptedRng([0.5, 0.9, 0.1, 0.05, 0.1]), // blockerCell = cells[floor(0.9*3)=2] = (4,2)
    );

    const negro = candidates[0].rawLaunches[1];
    expect(getPieceAt(candidates[0].board, { row: 4, col: 3 })).toBeNull(); // objetivo real, intacto
    // Perpendicular a 'E' es N/S -- negro nunca viaja por la fila 4 (el carril
    // del propio lanzamiento protegido), así que jamás podría barrerla entera.
    expect(['N', 'S']).toContain(negro.direction);
  });
});

describe('buildBlackDecoyCandidates: Estrategia B -- protege una celda de aterrizaje, negro en perpendicular al empuje (US2)', () => {
  it('coloca el bloqueante directamente sobre la celda de aterrizaje; negro se acerca perpendicular a la dirección del empuje', () => {
    // Estrategia A no encuentra nada aquí (target === entrada, 0 celdas intermedias).
    const rawLaunches: RawLaunch[] = [
      { direction: 'S', lane: 5, color: 'green', target: { row: 0, col: 5 } },
    ];
    const landingCells: LandingCell[] = [{ cell: { row: 2, col: 5 }, launchIndex: 0 }];

    const candidates = buildBlackDecoyCandidates(
      createBoard(),
      rawLaunches,
      landingCells,
      ['green', 'orange'],
      undefined,
      scriptedRng([0.5, 0.1, 0.05, 0.1]),
      // (Estrategia A: 0 llamadas, candidates.length===0)
      // chosen landingCell idx0; negroDirection: perpendicular de 'S' es ['E','O'], 0.1<0.5 -> 'E';
      // extraCount floor(0.05*7)=0; color 'green'
    );

    expect(candidates).toHaveLength(1);
    expect(getPieceAt(candidates[0].board, { row: 2, col: 5 })).toEqual({ color: 'green', fragility: 'new' });
    expect(candidates[0].rawLaunches).toEqual([
      { direction: 'S', lane: 5, color: 'green', target: { row: 0, col: 5 } },
      { direction: 'E', lane: 2, color: 'black', target: { row: 2, col: 5 } },
    ]);
  });
});

describe('buildBlackDecoyCandidates: sin ninguna oportunidad, devuelve un array vacío (US3)', () => {
  it('ni carril con hueco ni celdas de aterrizaje candidatas', () => {
    const rawLaunches: RawLaunch[] = [
      { direction: 'E', lane: 0, color: 'green', target: { row: 0, col: 0 } }, // 0 celdas intermedias
    ];

    const candidates = buildBlackDecoyCandidates(
      createBoard(),
      rawLaunches,
      [],
      ['green', 'orange'],
      undefined,
      scriptedRng([]),
    );

    expect(candidates).toEqual([]);
  });
});
