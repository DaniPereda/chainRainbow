import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Piece } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';
import { applyImpact } from '../../../src/engine/pieces/push.js';
import { expectResolved } from './test-helpers.js';

describe('negro (023-black-piece-line-clear): lanzada limpia toda su fila o columna (US1)', () => {
  it('impacto E/O: limpia toda la fila, incluidas fichas no adyacentes al impacto, y a la propia negra', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 5 }, { color: 'orange', fragility: 'cracked' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'brown', fragility: 'new' });
    const black: Piece = { color: 'black', fragility: 'new' };

    const result = expectResolved(applyImpact(board, {
      piece: black,
      direction: 'E',
      from: { row: 4, col: 0 },
      to: { row: 4, col: 1 },
    }));

    // Toda la fila 4 queda vacía -- las tres fichas que había, y la propia negra
    // (que nunca llega a escribirse en el tablero, FR-004).
    for (let col = 0; col < 8; col++) {
      expect(result.board.cells[4][col]).toBeNull();
    }
    expect(result.events).toEqual([
      {
        type: 'ANNIHILATION',
        at: { row: 4, col: 1 },
        color: 'black',
        from: { row: 4, col: 0 },
        direction: 'E',
        visualOrigin: undefined,
      },
      { type: 'ANNIHILATION', at: { row: 4, col: 1 }, color: 'green', from: { row: 4, col: 1 }, direction: 'E' },
      { type: 'ANNIHILATION', at: { row: 4, col: 5 }, color: 'orange', from: { row: 4, col: 5 }, direction: 'E' },
      { type: 'ANNIHILATION', at: { row: 4, col: 6 }, color: 'brown', from: { row: 4, col: 6 }, direction: 'E' },
    ]);
    expect(result.nextSites).toEqual([]);
  });

  it('impacto N/S: limpia toda la columna, no la fila -- una ficha de control en la misma fila sobrevive', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 3, col: 4 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 6, col: 4 }, { color: 'orange', fragility: 'new' });
    board = setPieceAt(board, { row: 3, col: 0 }, { color: 'green', fragility: 'new' }); // control: misma fila, otra columna
    const black: Piece = { color: 'black', fragility: 'new' };

    const result = expectResolved(applyImpact(board, {
      piece: black,
      direction: 'S',
      from: { row: 2, col: 4 },
      to: { row: 3, col: 4 },
    }));

    for (let row = 0; row < 8; row++) {
      expect(result.board.cells[row][4]).toBeNull();
    }
    expect(result.board.cells[3][0]).toEqual({ color: 'green', fragility: 'new' }); // no afectada -- eje correcto
  });

  it('impacto inmediato en el borde de entrada del carril: la propia negra sigue siendo el primer evento (bug visual real: su `from` cae fuera del tablero -- reproducido con levels/2.json)', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 0, col: 0 }, { color: 'orange', fragility: 'new' });
    const black: Piece = { color: 'black', fragility: 'new' };

    // Golpe inmediato: nada viajó antes del impacto, así que `from` (calculado
    // por resolve-launch.ts como el paso opuesto a la dirección desde `to`) cae
    // en col -1, fuera del tablero -- el mismo caso límite que ya provocaba el
    // "green lanzada al oeste" (isOnBoard, ronda anterior), pero esta vez
    // sobre el evento de la propia negra en vez del de un MOVE_STEP.
    const result = expectResolved(applyImpact(board, {
      piece: black,
      direction: 'E',
      from: { row: 0, col: -1 },
      to: { row: 0, col: 0 },
    }));

    // La propia negra debe ser events[0] -- así hereda el glide de entrada
    // (isFirstEvent, launch-animation.ts) en vez de intentar spawnear
    // directamente en su `from` fuera de tablero.
    expect(result.events[0]).toEqual({
      type: 'ANNIHILATION',
      at: { row: 0, col: 0 },
      color: 'black',
      from: { row: 0, col: -1 },
      direction: 'E',
      visualOrigin: undefined,
    });
    expect(result.events).toHaveLength(2);
  });

  it('missclick: un carril completamente vacío hace que la negra vuelva a la mano, sin limpiar nada (FR-007)', () => {
    const level = createLevel({
      pieces: [{ at: { row: 0, col: 0 }, color: 'green' }], // fuera del carril lanzado
      hand: ['black'],
      goal: { at: { row: 7, col: 7 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
  });

  it('end-to-end vía resolveLaunch (quickstart.md Escenario 1): lanzamiento real por la mano produce la misma limpieza', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 1 }, color: 'green' },
        { at: { row: 4, col: 5 }, color: 'orange' },
        { at: { row: 4, col: 6 }, color: 'brown' },
      ],
      hand: ['black'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    for (let col = 0; col < 8; col++) {
      expect(outcome.board.cells[4][col]).toBeNull();
    }
    expect(outcome.events).toHaveLength(4); // 3 fichas barridas + la propia negra
    expect(outcome.events.every((event) => event.type === 'ANNIHILATION')).toBe(true);
  });
});

describe('negro (023-black-piece-line-clear): asentada en el tablero se comporta como cualquier otra ficha al ser golpeada (US2 revocada -- corrección reportada por el usuario, research.md Decisión 7)', () => {
  // La versión original de esta historia (negro asentada limpia SIEMPRE al ser
  // golpeada, sea cual sea el color/dirección de quien la golpea) resultó
  // incorrecta: el usuario reportó en vivo que el efecto se disparaba antes de
  // que la ficha lanzada llegara siquiera a tocar la negra, y siempre, tuviera
  // o no sentido. La regla correcta: negro asentada NUNCA tiene prioridad
  // especial como defensora -- reacciona exactamente igual que cualquier otra
  // ficha al mecanismo propio de quien la golpea (empuje, salto, división de
  // rojo, cambio de color de arcoíris...). Su propio efecto (limpiar la línea)
  // solo se dispara cuando ELLA MISMA acaba siendo la atacante de un impacto
  // -- incluido cuando eso ocurre COMO CONSECUENCIA de haber sido desplazada.

  it('verde la empuja UNA casilla en su misma dirección -- si aterriza vacía, no limpia nada, solo avanza su fragilidad', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'black' }],
      hand: ['green'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'N', lane: 3 });

    // Verde se asienta donde estaba la negra; la negra avanza una casilla más
    // al norte -- desplazamiento normal de verde, ninguna limpieza.
    expect(outcome.board.cells[4][3]).toEqual({ color: 'green', fragility: 'new' });
    expect(outcome.board.cells[3][3]).toEqual({ color: 'black', fragility: 'cracked' });
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(false);
  });

  it('rojo la divide en dos ramas perpendiculares -- si ambas aterrizan vacías, no limpia nada', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 4 }, color: 'black' }],
      hand: ['red'],
      goal: { at: { row: 0, col: 0 }, color: 'black' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.board.cells[4][4]).toEqual({ color: 'red', fragility: 'new' });
    expect(outcome.board.cells[4][5]).toEqual({ color: 'black', fragility: 'cracked' });
    expect(outcome.board.cells[4][3]).toEqual({ color: 'black', fragility: 'cracked' });
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(false);
  });

  it('si el empuje hace que negro aterrice sobre una ficha real, SU PROPIO efecto se dispara entonces, en la dirección en la que negro viajaba -- verificado contra el motor real antes de fijarlo como expectativa', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 0, col: 0 }, color: 'orange' },
        { at: { row: 0, col: 1 }, color: 'brown' },
        { at: { row: 0, col: 2 }, color: 'red' },
        { at: { row: 0, col: 3 }, color: 'black' },
      ],
      hand: ['green'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    // Verde entra por el borde este y empuja a la negra un paso al oeste,
    // exactamente donde estaba la roja -- negro pasa a ser la atacante de ESE
    // impacto y limpia la fila entera en su propia dirección (oeste),
    // incluida la propia verde, que ya se había asentado en esa misma fila.
    const outcome = resolveLaunch(level, { direction: 'O', lane: 0 });

    for (let col = 0; col < 8; col++) {
      expect(outcome.board.cells[0][col]).toBeNull();
    }
  });
});

describe('negro (023-black-piece-line-clear): negro contra negro sigue siendo mismo color (US3)', () => {
  it('negra golpea a otra negra: aniquilación por mismo color, ninguna limpieza de línea', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 4 }, { color: 'black', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'green', fragility: 'new' }); // misma fila -- NO debe desaparecer
    board = setPieceAt(board, { row: 1, col: 4 }, { color: 'orange', fragility: 'new' }); // misma columna -- NO debe desaparecer
    const attacker: Piece = { color: 'black', fragility: 'new' };

    const result = expectResolved(applyImpact(board, {
      piece: attacker,
      direction: 'S',
      from: { row: 3, col: 4 },
      to: { row: 4, col: 4 },
    }));

    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 4, col: 4 }, color: 'black', from: { row: 3, col: 4 }, direction: 'S', visualOrigin: undefined },
    ]);
    expect(result.board.cells[4][6]).toEqual({ color: 'green', fragility: 'new' });
    expect(result.board.cells[1][4]).toEqual({ color: 'orange', fragility: 'new' });
    expect(result.nextSites).toEqual([]);
  });
});
