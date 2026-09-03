import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Piece } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';
import { applyImpact } from '../../../src/engine/pieces/push.js';

describe('negro (023-black-piece-line-clear): lanzada limpia toda su fila o columna (US1)', () => {
  it('impacto E/O: limpia toda la fila, incluidas fichas no adyacentes al impacto, y a la propia negra', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 5 }, { color: 'orange', fragility: 'cracked' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'brown', fragility: 'new' });
    const black: Piece = { color: 'black', fragility: 'new' };

    const result = applyImpact(board, {
      piece: black,
      direction: 'E',
      from: { row: 4, col: 0 },
      to: { row: 4, col: 1 },
    });

    // Toda la fila 4 queda vacía -- las tres fichas que había, y la propia negra
    // (que nunca llega a escribirse en el tablero, FR-004).
    for (let col = 0; col < 8; col++) {
      expect(result.board.cells[4][col]).toBeNull();
    }
    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 4, col: 1 }, color: 'green', from: { row: 4, col: 1 }, direction: 'E' },
      { type: 'ANNIHILATION', at: { row: 4, col: 5 }, color: 'orange', from: { row: 4, col: 5 }, direction: 'E' },
      { type: 'ANNIHILATION', at: { row: 4, col: 6 }, color: 'brown', from: { row: 4, col: 6 }, direction: 'E' },
      {
        type: 'ANNIHILATION',
        at: { row: 4, col: 1 },
        color: 'black',
        from: { row: 4, col: 0 },
        direction: 'E',
        visualOrigin: undefined,
      },
    ]);
    expect(result.nextSites).toEqual([]);
  });

  it('impacto N/S: limpia toda la columna, no la fila -- una ficha de control en la misma fila sobrevive', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 3, col: 4 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 6, col: 4 }, { color: 'orange', fragility: 'new' });
    board = setPieceAt(board, { row: 3, col: 0 }, { color: 'green', fragility: 'new' }); // control: misma fila, otra columna
    const black: Piece = { color: 'black', fragility: 'new' };

    const result = applyImpact(board, {
      piece: black,
      direction: 'S',
      from: { row: 2, col: 4 },
      to: { row: 3, col: 4 },
    });

    for (let row = 0; row < 8; row++) {
      expect(result.board.cells[row][4]).toBeNull();
    }
    expect(result.board.cells[3][0]).toEqual({ color: 'green', fragility: 'new' }); // no afectada -- eje correcto
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

describe('negro (023-black-piece-line-clear): asentada en el tablero limpia al ser golpeada (US2)', () => {
  it('impacto N/S: limpia toda la columna de la negra -- una ficha de control en su misma fila sobrevive', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 4 }, { color: 'black', fragility: 'new' });
    board = setPieceAt(board, { row: 1, col: 4 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 6, col: 4 }, { color: 'orange', fragility: 'cracked' });
    board = setPieceAt(board, { row: 4, col: 0 }, { color: 'green', fragility: 'new' }); // control: misma fila, otra columna
    const striker: Piece = { color: 'green', fragility: 'new' };

    const result = applyImpact(board, {
      piece: striker,
      direction: 'S',
      from: { row: 3, col: 4 },
      to: { row: 4, col: 4 },
    });

    for (let row = 0; row < 8; row++) {
      expect(result.board.cells[row][4]).toBeNull();
    }
    expect(result.board.cells[4][0]).toEqual({ color: 'green', fragility: 'new' });
    expect(result.nextSites).toEqual([]);
    // La atacante también desaparece (FR-004) -- nunca se asienta en (4,4).
    expect(result.events.some((event) => event.type === 'ANNIHILATION' && event.color === 'green' && event.at.row === 4 && event.at.col === 4)).toBe(true);
  });

  it('impacto E/O: limpia toda la fila de la negra -- una ficha de control en su misma columna sobrevive', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 4 }, { color: 'black', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'orange', fragility: 'new' });
    board = setPieceAt(board, { row: 0, col: 4 }, { color: 'brown', fragility: 'new' }); // control: misma columna, otra fila
    const striker: Piece = { color: 'green', fragility: 'new' };

    const result = applyImpact(board, {
      piece: striker,
      direction: 'E',
      from: { row: 4, col: 3 },
      to: { row: 4, col: 4 },
    });

    for (let col = 0; col < 8; col++) {
      expect(result.board.cells[4][col]).toBeNull();
    }
    expect(result.board.cells[0][4]).toEqual({ color: 'brown', fragility: 'new' });
  });

  it('rojo golpea a una negra: gana la limpieza, la ramificación habitual de rojo nunca se produce (research.md Decisión 3)', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 4 }, { color: 'black', fragility: 'new' });
    board = setPieceAt(board, { row: 6, col: 4 }, { color: 'orange', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 0 }, { color: 'green', fragility: 'new' }); // control: misma fila
    const red: Piece = { color: 'red', fragility: 'new' };

    const result = applyImpact(board, {
      piece: red,
      direction: 'S',
      from: { row: 3, col: 4 },
      to: { row: 4, col: 4 },
    });

    // Nada de MOVE_STEP -- ninguna rama perpendicular de rojo se produjo.
    expect(result.events.every((event) => event.type === 'ANNIHILATION')).toBe(true);
    for (let row = 0; row < 8; row++) {
      expect(result.board.cells[row][4]).toBeNull();
    }
    expect(result.board.cells[4][0]).toEqual({ color: 'green', fragility: 'new' }); // eje correcto: fila no afectada
    expect(result.nextSites).toEqual([]);
  });
});

describe('negro (023-black-piece-line-clear): negro contra negro sigue siendo mismo color (US3)', () => {
  it('negra golpea a otra negra: aniquilación por mismo color, ninguna limpieza de línea', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 4 }, { color: 'black', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'green', fragility: 'new' }); // misma fila -- NO debe desaparecer
    board = setPieceAt(board, { row: 1, col: 4 }, { color: 'orange', fragility: 'new' }); // misma columna -- NO debe desaparecer
    const attacker: Piece = { color: 'black', fragility: 'new' };

    const result = applyImpact(board, {
      piece: attacker,
      direction: 'S',
      from: { row: 3, col: 4 },
      to: { row: 4, col: 4 },
    });

    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 4, col: 4 }, color: 'black', from: { row: 3, col: 4 }, direction: 'S', visualOrigin: undefined },
    ]);
    expect(result.board.cells[4][6]).toEqual({ color: 'green', fragility: 'new' });
    expect(result.board.cells[1][4]).toEqual({ color: 'orange', fragility: 'new' });
    expect(result.nextSites).toEqual([]);
  });
});
