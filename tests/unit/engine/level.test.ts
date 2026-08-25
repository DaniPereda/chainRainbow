import { describe, expect, it } from 'vitest';
import { createLevel } from '../../../src/engine/index.js';

// Historia 4, escenario 1: una ficha de tablero declarada con un estado inicial se respeta.
describe('createLevel: an initial fragility state, when declared, is respected (FR-011)', () => {
  it('places a board piece with the declared CRACKED state, not NEW', () => {
    const level = createLevel({
      pieces: [{ at: { row: 2, col: 2 }, color: 'orange', fragility: 'cracked' }],
      hand: ['green'],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });

    expect(level.board.cells[2][2]).toEqual({ color: 'orange', fragility: 'cracked' });
  });

  it('respects a hand piece declared BROKEN', () => {
    const level = createLevel({
      pieces: [],
      hand: [{ color: 'green', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    expect(level.hand.pieces).toEqual([{ color: 'green', fragility: 'broken' }]);
  });
});

// Historia 4, escenario 2: sin declarar nada, todas las fichas nacen NEW por defecto (FR-012).
describe('createLevel: pieces default to NEW when no initial fragility is declared (FR-012)', () => {
  it('defaults every board piece and every hand piece (bare color) to NEW', () => {
    const level = createLevel({
      pieces: [{ at: { row: 3, col: 3 }, color: 'brown' }],
      hand: ['green', 'orange'],
      goal: { at: { row: 0, col: 0 }, color: 'brown' },
    });

    expect(level.board.cells[3][3]).toEqual({ color: 'brown', fragility: 'new' });
    expect(level.hand.pieces).toEqual([
      { color: 'green', fragility: 'new' },
      { color: 'orange', fragility: 'new' },
    ]);
  });
});

// FR-016: una ficha de TABLERO declarada BROKEN se normaliza a "casilla vacía" -- nunca llega a
// existir como ficha presente y golpeable. No aplica a fichas de mano (ver arriba).
describe('createLevel: a board piece declared BROKEN never exists on the resulting board (FR-016)', () => {
  it('omits it entirely, leaving that cell empty', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 5, col: 5 }, color: 'orange', fragility: 'broken' },
        { at: { row: 5, col: 6 }, color: 'green' },
      ],
      hand: ['brown'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    expect(level.board.cells[5][5]).toBeNull();
    expect(level.board.cells[5][6]).toEqual({ color: 'green', fragility: 'new' }); // unrelated piece, unaffected
  });
});
