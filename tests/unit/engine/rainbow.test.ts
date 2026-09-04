import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Piece } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';
import { applyImpact } from '../../../src/engine/pieces/push.js';
import { expectResolved } from './test-helpers.js';

describe('arcoíris (024-rainbow-color-change): lanzada cambia el color de la defensora (US1)', () => {
  it('impacto: pausa la resolución señalando a la defensora, con las 5 opciones no-arcoíris', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    const rainbow: Piece = { color: 'rainbow', fragility: 'new' };

    const result = applyImpact(board, {
      piece: rainbow,
      direction: 'E',
      from: { row: 4, col: 0 },
      to: { row: 4, col: 1 },
    });

    expect(result.status).toBe('pending-color-choice');
    if (result.status !== 'pending-color-choice') throw new Error('expected a pending color choice');
    expect(result.at).toEqual({ row: 4, col: 1 });
    expect(result.options).toEqual(['green', 'orange', 'brown', 'red', 'black']);
    // The attacker's own travel-and-vanish is ALREADY part of the pending
    // result (real bug found live by the user: with this deferred into
    // `resume`, the color dialog popped up with no travel animation at all)
    // -- and the defender's cell is already cleared on `board`, matching what
    // the renderer shows while the dialog is open.
    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 4, col: 1 }, color: 'rainbow', from: { row: 4, col: 0 }, direction: 'E', visualOrigin: undefined },
    ]);
    expect(result.board.cells[4][1]).toBeNull();

    const resolved = expectResolved(result.resume('red'));
    expect(resolved.board.cells[4][1]).toEqual({ color: 'red', fragility: 'new' });
    expect(resolved.events).toEqual([{ type: 'COLOR_CHOICE', at: { row: 4, col: 1 }, fromColor: 'green', toColor: 'red' }]);
    expect(resolved.nextSites).toEqual([]);
  });

  it('la fragilidad de la defensora NO cambia (ni avanza ni se resetea) -- solo cambia el color (decisión del usuario, confirmada tras preguntar)', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 1 }, { color: 'green', fragility: 'cracked' });
    const rainbow: Piece = { color: 'rainbow', fragility: 'new' };

    const result = applyImpact(board, { piece: rainbow, direction: 'E', from: { row: 4, col: 0 }, to: { row: 4, col: 1 } });
    if (result.status !== 'pending-color-choice') throw new Error('expected a pending color choice');

    const resolved = expectResolved(result.resume('red'));
    // El color cambia a 'red', pero la fragilidad que ya tenía la defensora
    // ('cracked') se conserva tal cual -- ni avanza (como un golpe normal
    // haría) ni se resetea a 'new'.
    expect(resolved.board.cells[4][1]).toEqual({ color: 'red', fragility: 'cracked' });
  });

  it('end-to-end vía resolveLaunch (quickstart.md Escenarios 1-2): el lanzamiento real pausa y luego resuelve', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 4 }, color: 'green' }],
      hand: ['rainbow'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.pendingColorChoice).toBeDefined();
    expect(outcome.pendingColorChoice!.at).toEqual({ row: 4, col: 4 });
    // The attacker already travelled and vanished by this point -- the
    // defender's cell is cleared, not still showing the old green piece.
    expect(outcome.board.cells[4][4]).toBeNull();
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0].type).toBe('ANNIHILATION');

    const final = outcome.pendingColorChoice!.resume('red');

    expect(final.pendingColorChoice).toBeUndefined();
    expect(final.board.cells[4][4]).toEqual({ color: 'red', fragility: 'new' });
    expect(final.hand.pieces).toEqual([]);
    // Cumulative across both segments: the attacker's own vanish, then the
    // recolor -- exactly what BoardScene plays as two segments around the
    // pause (data-model.md, "events siempre es ACUMULATIVO").
    expect(final.events).toHaveLength(2);
    expect(final.events[0].type).toBe('ANNIHILATION');
    expect(final.events[1].type).toBe('COLOR_CHOICE');
  });

  it('missclick: un carril completamente vacío hace que la arcoíris vuelva a la mano, sin ningún pendingColorChoice (FR-011)', () => {
    const level = createLevel({
      pieces: [{ at: { row: 0, col: 0 }, color: 'green' }], // fuera del carril lanzado
      hand: ['rainbow'],
      goal: { at: { row: 7, col: 7 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.pendingColorChoice).toBeUndefined();
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
  });

  it('precedencia frente a negro: solo gana la limpieza de negro cuando negro ES la atacante -- una negra asentada ya no tiene prioridad de defensora (FR-009 corregido, research.md 023 Decisión 7 / 024 Decisión 3)', () => {
    // Arcoíris lanzada golpea una negra asentada -- negro ya NO tiene
    // prioridad como defensora (023, Decisión 7), así que gana el cambio de
    // color de arcoíris, exactamente como contra cualquier otro color.
    const boardA = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'black', fragility: 'new' });
    const rainbow: Piece = { color: 'rainbow', fragility: 'new' };
    const resultA = applyImpact(boardA, { piece: rainbow, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });
    expect(resultA.status).toBe('pending-color-choice');
    if (resultA.status !== 'pending-color-choice') throw new Error('unreachable');
    expect(resultA.at).toEqual({ row: 4, col: 4 });
    const resolvedA = expectResolved(resultA.resume('green'));
    expect(resolvedA.board.cells[4][4]).toEqual({ color: 'green', fragility: 'new' });

    // Negro lanzada golpea una arcoíris asentada -- negro-como-ATACANTE sigue
    // ganando siempre (sin cambios): su propia limpieza de línea se dispara
    // igual que contra cualquier otro color.
    const boardB = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'rainbow', fragility: 'new' });
    const black: Piece = { color: 'black', fragility: 'new' };
    const resultB = applyImpact(boardB, { piece: black, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });
    expect(resultB.status).toBe('resolved');
    if (resultB.status !== 'resolved') throw new Error('unreachable');
    expect(resultB.events.every((event) => event.type === 'ANNIHILATION')).toBe(true);
    for (let row = 0; row < 8; row++) {
      expect(resultB.board.cells[row][4]).toBeNull();
    }
  });

  it('precedencia frente a rojo: gana siempre el cambio de color de arcoíris (FR-010, quickstart.md Escenario 5)', () => {
    // Arcoíris lanzada golpea una roja asentada.
    const boardA = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'red', fragility: 'new' });
    const rainbow: Piece = { color: 'rainbow', fragility: 'new' };
    const resultA = applyImpact(boardA, { piece: rainbow, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });
    expect(resultA.status).toBe('pending-color-choice');
    if (resultA.status !== 'pending-color-choice') throw new Error('unreachable');
    const resolvedA = expectResolved(resultA.resume('green'));
    expect(resolvedA.events.some((event) => event.type === 'MOVE_STEP')).toBe(false);
    expect(resolvedA.board.cells[4][4]).toEqual({ color: 'green', fragility: 'new' });

    // Roja lanzada golpea una arcoíris asentada.
    const boardB = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'rainbow', fragility: 'new' });
    const red: Piece = { color: 'red', fragility: 'new' };
    const resultB = applyImpact(boardB, { piece: red, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });
    expect(resultB.status).toBe('pending-color-choice');
    if (resultB.status !== 'pending-color-choice') throw new Error('unreachable');
    const resolvedB = expectResolved(resultB.resume('orange'));
    expect(resolvedB.events.some((event) => event.type === 'MOVE_STEP')).toBe(false);
    expect(resolvedB.board.cells[4][4]).toEqual({ color: 'orange', fragility: 'new' });
  });
});

describe('arcoíris (024-rainbow-color-change): asentada en el tablero cambia su propio color al ser golpeada (US2)', () => {
  it('una arcoíris asentada es la defensora -- pendingColorChoice apunta a su propia casilla, no a la atacante', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'rainbow', fragility: 'new' });
    const striker: Piece = { color: 'green', fragility: 'new' };

    const result = applyImpact(board, { piece: striker, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });

    expect(result.status).toBe('pending-color-choice');
    if (result.status !== 'pending-color-choice') throw new Error('unreachable');
    expect(result.at).toEqual({ row: 4, col: 4 });
    // La atacante (verde) ya viajó y desapareció -- forma parte del resultado
    // pendiente, no de la resolución final (se anima ANTES del diálogo).
    expect(result.events.some((event) => event.type === 'ANNIHILATION' && event.color === 'green')).toBe(true);
    expect(result.board.cells[4][4]).toBeNull();

    const resolved = expectResolved(result.resume('brown'));
    expect(resolved.board.cells[4][4]).toEqual({ color: 'brown', fragility: 'new' });
    expect(resolved.events).toEqual([{ type: 'COLOR_CHOICE', at: { row: 4, col: 4 }, fromColor: 'rainbow', toColor: 'brown' }]);
  });

  it('la fragilidad de la arcoíris asentada se conserva tras recolorearse (misma decisión que en US1)', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'rainbow', fragility: 'cracked' });
    const striker: Piece = { color: 'green', fragility: 'new' };

    const result = applyImpact(board, { piece: striker, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });
    if (result.status !== 'pending-color-choice') throw new Error('unreachable');

    const resolved = expectResolved(result.resume('brown'));
    expect(resolved.board.cells[4][4]).toEqual({ color: 'brown', fragility: 'cracked' });
  });
});

describe('arcoíris (024-rainbow-color-change): arcoíris contra arcoíris sigue siendo mismo color (US3)', () => {
  it('arcoíris golpea a otra arcoíris: aniquilación por mismo color, nunca un pendingColorChoice', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'rainbow', fragility: 'new' });
    const attacker: Piece = { color: 'rainbow', fragility: 'new' };

    const result = expectResolved(applyImpact(board, { piece: attacker, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } }));

    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 4, col: 4 }, color: 'rainbow', from: { row: 3, col: 4 }, direction: 'S', visualOrigin: undefined },
    ]);
    expect(result.board.cells[4][4]).toBeNull();
    expect(result.nextSites).toEqual([]);
  });
});
