import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Piece } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';
import { scanPurpleSettle } from '../../../src/engine/pieces/purple.js';

describe('púrpura (025-purple-attraction-piece): scanPurpleSettle (US1/US2)', () => {
  it('se asienta en la primera celda con ficha a cada lado del eje perpendicular a su dirección de viaje', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'orange', fragility: 'new' });

    const result = scanPurpleSettle(board, { row: 0, col: 4 }, 'S');

    expect(result).toEqual({
      status: 'settled',
      at: { row: 4, col: 4 },
      leftPiece: { row: 4, col: 6 }, // lado E (PERPENDICULAR_SIDES['S'] = ['E','O'])
      rightPiece: { row: 4, col: 1 }, // lado O
    });
  });

  it('ignora una celda con ficha en un solo lado del eje perpendicular y sigue avanzando', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 2, col: 1 }, { color: 'green', fragility: 'new' }); // solo lado O en fila 2
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'orange', fragility: 'new' });

    const result = scanPurpleSettle(board, { row: 0, col: 4 }, 'S');

    expect(result).toEqual({
      status: 'settled',
      at: { row: 4, col: 4 },
      leftPiece: { row: 4, col: 6 },
      rightPiece: { row: 4, col: 1 },
    });
  });

  it('cuando hay varias fichas en el mismo lado, solo cuenta la más cercana', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' }); // lado O, dist 3
    board = setPieceAt(board, { row: 4, col: 5 }, { color: 'orange', fragility: 'new' }); // lado E, dist 1 (la más cercana)
    board = setPieceAt(board, { row: 4, col: 7 }, { color: 'brown', fragility: 'new' }); // lado E, dist 3 (no debe contar)

    const result = scanPurpleSettle(board, { row: 0, col: 4 }, 'S');

    expect(result).toEqual({
      status: 'settled',
      at: { row: 4, col: 4 },
      leftPiece: { row: 4, col: 5 },
      rightPiece: { row: 4, col: 1 },
    });
  });

  it('missclick: una ficha real bloquea el avance antes de encontrar ninguna celda cualificada (FR-005)', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 6 }, { color: 'orange', fragility: 'new' });
    board = setPieceAt(board, { row: 2, col: 4 }, { color: 'brown', fragility: 'new' }); // bloquea antes de llegar a la fila 4

    const result = scanPurpleSettle(board, { row: 0, col: 4 }, 'S');

    expect(result).toEqual({ status: 'missclick' });
  });

  it('missclick: agota el carril sin encontrar ninguna celda cualificada (FR-006)', () => {
    let board = createBoard();
    board = setPieceAt(board, { row: 4, col: 1 }, { color: 'green', fragility: 'new' }); // solo un lado, en toda la columna

    const result = scanPurpleSettle(board, { row: 0, col: 4 }, 'S');

    expect(result).toEqual({ status: 'missclick' });
  });
});

describe('púrpura (025-purple-attraction-piece): resolveLaunch -- la atracción (US1)', () => {
  it('distancias desiguales, mismo color: la más cercana espera a la más lejana y colisionan juntas en el mismo evento (FR-009/FR-010, SC-001/SC-003)', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 1 }, color: 'green' }, // lado O, distancia 3
        { at: { row: 4, col: 6 }, color: 'green' }, // lado E, distancia 2
      ],
      hand: [{ color: 'purple', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.missclick).toBe(false);
    // La propia púrpura viaja y desaparece -- un ANNIHILATION propio, seguido
    // de la aniquilación por mismo color de las DOS fichas atraídas, cada una
    // con su PROPIO evento (no un único evento que solo represente un lado --
    // bug real reportado por el usuario probando en vivo: "se anima la ficha
    // de arriba pero no la de abajo").
    expect(outcome.events).toEqual([
      {
        type: 'ANNIHILATION',
        at: { row: 4, col: 4 },
        color: 'purple',
        from: { row: 3, col: 4 },
        direction: 'S',
        pushedByColor: undefined,
        visualOrigin: undefined,
      },
      {
        type: 'ANNIHILATION',
        at: { row: 4, col: 4 },
        color: 'green',
        from: { row: 4, col: 6 },
        direction: 'O',
        pushedByColor: undefined,
        visualOrigin: undefined,
      },
      {
        type: 'ANNIHILATION',
        at: { row: 4, col: 4 },
        color: 'green',
        from: { row: 4, col: 1 },
        direction: 'E',
        pushedByColor: undefined,
        visualOrigin: undefined,
      },
    ]);
    expect(outcome.board.cells[4][1]).toBeNull();
    expect(outcome.board.cells[4][6]).toBeNull();
    expect(outcome.board.cells[4][4]).toBeNull();
    // La púrpura se consume igual que cualquier lanzamiento resuelto.
    expect(outcome.hand.pieces).toEqual([]);
  });

  it('distancias iguales, mismo color: también colisionan juntas (sin fase de espera)', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 2 }, color: 'orange' },
        { at: { row: 4, col: 6 }, color: 'orange' },
      ],
      hand: [{ color: 'purple', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.missclick).toBe(false);
    // Púrpura + una ANNIHILATION por cada una de las dos fichas atraídas.
    expect(outcome.events.filter((event) => event.type === 'ANNIHILATION')).toHaveLength(3);
    expect(outcome.events[1]).toMatchObject({ type: 'ANNIHILATION', at: { row: 4, col: 4 }, color: 'orange' });
    expect(outcome.events[2]).toMatchObject({ type: 'ANNIHILATION', at: { row: 4, col: 4 }, color: 'orange' });
    expect(outcome.board.cells[4][2]).toBeNull();
    expect(outcome.board.cells[4][6]).toBeNull();
  });

  it('distancias desiguales, distinto color: se resuelve como un choque mutuo genuino, no como dos asentamientos independientes', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 1 }, color: 'green' },
        { at: { row: 4, col: 6 }, color: 'orange' },
      ],
      hand: [{ color: 'purple', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.missclick).toBe(false);
    // Ninguna de las dos fichas originales sigue en su casilla de partida
    // (ambas se pusieron en marcha), y ninguna se asentó en solitario en la
    // celda de atracción sin que la otra hubiera llegado también -- el propio
    // choque mutuo (ya validado en otros tests, 019/021) se encarga del
    // resultado exacto a partir de ahí.
    expect(outcome.board.cells[4][1]).toBeNull();
    expect(outcome.board.cells[4][6]).toBeNull();
    expect(outcome.events[0]).toMatchObject({ type: 'ANNIHILATION', color: 'purple' });
    expect(outcome.events.length).toBeGreaterThan(1);
  });
});

describe('púrpura (025-purple-attraction-piece): missclick end-to-end (US2)', () => {
  it('bloqueada por una ficha real: el tablero y la mano quedan exactamente igual, la ficha no se consume', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 1 }, color: 'green' },
        { at: { row: 4, col: 6 }, color: 'orange' },
        { at: { row: 2, col: 4 }, color: 'brown' },
      ],
      hand: [{ color: 'purple', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
    expect(outcome.events).toEqual([]);
  });

  it('agota el carril sin encontrar ninguna celda cualificada: el tablero y la mano quedan exactamente igual', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 6 }, color: 'orange' }], // solo un lado, nunca cualifica
      hand: [{ color: 'purple', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
  });
});

describe('púrpura (025-purple-attraction-piece): solo repartible en mano, siempre broken (US3)', () => {
  it('createLevel acepta un HandPieceInput {color:"purple", fragility:"broken"} como cualquier otro color', () => {
    const level = createLevel({
      pieces: [],
      hand: [{ color: 'purple', fragility: 'broken' }],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    expect(level.hand.pieces).toEqual([{ color: 'purple', fragility: 'broken' }]);
  });
});
