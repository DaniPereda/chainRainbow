import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Fragility } from '../../../src/engine/board.js';
import { resolveLaunch, type Level } from '../../../src/engine/index.js';

function levelWith(config: {
  boardPieces: { row: number; col: number; color: 'green' | 'orange' | 'brown'; fragility: Fragility }[];
  handColor: 'green' | 'orange' | 'brown';
  handFragility?: Fragility;
  goalColor: 'green' | 'orange' | 'brown';
  goalCell: { row: number; col: number };
}): Level {
  const board = config.boardPieces.reduce(
    (boardSoFar, { row, col, color, fragility }) =>
      setPieceAt(boardSoFar, { row, col }, { color, fragility }),
    createBoard(),
  );
  return {
    board,
    hand: { pieces: [{ color: config.handColor, fragility: config.handFragility ?? 'new' }] },
    goal: { targetColor: config.goalColor, targetCell: config.goalCell },
  };
}

// Historia 1, escenario 1 (spec.md): NUEVA -> CRACKED al recibir un golpe, sin afectar a su
// propio comportamiento de desplazamiento.
describe('fragility: a piece struck by a different color advances one step (FR-002)', () => {
  it('NEW becomes CRACKED and continues the chain with its normal displacement', () => {
    const level = levelWith({
      boardPieces: [{ row: 4, col: 1, color: 'orange', fragility: 'new' }],
      handColor: 'green',
      goalColor: 'orange',
      goalCell: { row: 4, col: 2 },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    // the launcher (green, NEW) survives its own throw and settles here (FR-007/US2).
    expect(outcome.board.cells[4][1]).toEqual({ color: 'green', fragility: 'new' });
    expect(outcome.board.cells[4][2]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(outcome.result).toBe('won');
  });
});

// Historia 1, escenario 2: CRACKED -> BROKEN, y se elimina en el instante en que le toca
// asentarse, en vez de colocarse (FR-004).
describe('fragility: a piece that reaches BROKEN is removed instead of settling (FR-004)', () => {
  it('CRACKED becomes BROKEN and disappears at its own destination cell', () => {
    const level = levelWith({
      boardPieces: [{ row: 4, col: 1, color: 'orange', fragility: 'cracked' }],
      handColor: 'green',
      goalColor: 'orange',
      goalCell: { row: 4, col: 2 },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    // the launcher (green, NEW) survives its own throw and settles here (FR-007/US2) --
    // unaffected by the DEFENDER's own fate.
    expect(outcome.board.cells[4][1]).toEqual({ color: 'green', fragility: 'new' });
    expect(outcome.board.cells[4][2]).toBeNull(); // never placed -- it broke
  });

  // Historia 1, escenario 4: una ficha que queda BROKEN justo en la casilla del objetivo no
  // cuenta como si lo hubiera cumplido -- FR-006 se cumple por construcción (nunca se coloca).
  it('never counts toward the goal, even when its destination is the target cell', () => {
    const level = levelWith({
      boardPieces: [{ row: 4, col: 1, color: 'orange', fragility: 'cracked' }],
      handColor: 'green',
      goalColor: 'orange',
      goalCell: { row: 4, col: 2 },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.board.cells[4][2]).toBeNull();
    expect(outcome.result).toBe('lost'); // hand now empty, nothing satisfies the goal
  });
});

// Historia 1, escenario 3: varias fichas distintas alcanzan BROKEN en la MISMA cadena, cada una
// eliminada de forma independiente en su propio instante de asentamiento -- no una pasada final.
describe('fragility: multiple pieces reaching BROKEN in one chain are each removed independently (FR-005)', () => {
  it('removes every link that reaches BROKEN, at its own settle point, within a single launch', () => {
    const level = levelWith({
      boardPieces: [
        { row: 4, col: 1, color: 'orange', fragility: 'cracked' },
        { row: 4, col: 2, color: 'brown', fragility: 'cracked' },
      ],
      handColor: 'green',
      goalColor: 'brown',
      goalCell: { row: 4, col: 4 },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    // the launcher (green, NEW) survives its own throw and settles here (FR-007/US2).
    expect(outcome.board.cells[4][1]).toEqual({ color: 'green', fragility: 'new' });
    // orange (struck by green, distance 1) -- CRACKED -> BROKEN, never settles at col2.
    expect(outcome.board.cells[4][2]).toBeNull();
    // brown (struck by orange, distance 2) -- CRACKED -> BROKEN, never settles at col4 either.
    expect(outcome.board.cells[4][4]).toBeNull();
    expect(outcome.result).toBe('lost');
  });
});

// Historia 2, escenario 1: la ficha lanzada sobrevive a su propio impacto -- deja de
// desvanecerse (spec.md 006, feature 008) y se asienta en la casilla de su primer impacto,
// conservando el estado que ya traía (ella es quien golpea, no quien es golpeada, en ESTE
// lanzamiento -- su propio estado no cambia).
describe('fragility: a launched piece that survives its own impact settles instead of vanishing (FR-007)', () => {
  it('settles at the site of its first impact, keeping the state it already had', () => {
    const level = levelWith({
      boardPieces: [{ row: 4, col: 1, color: 'orange', fragility: 'new' }],
      handColor: 'green',
      goalColor: 'orange',
      goalCell: { row: 4, col: 2 },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.board.cells[4][1]).toEqual({ color: 'green', fragility: 'new' }); // the launcher itself
    expect(outcome.board.cells[4][2]).toEqual({ color: 'orange', fragility: 'cracked' }); // the defender it struck
    expect(outcome.result).toBe('won');
  });

  // Historia 2, escenario 2: si la ficha lanzada YA estaba BROKEN antes del lanzamiento, se
  // elimina tras su impacto en vez de asentarse -- igual que cualquier otra ficha rota (FR-008).
  it('is eliminated after its own impact instead of settling, when it was already BROKEN', () => {
    const level = levelWith({
      boardPieces: [{ row: 4, col: 1, color: 'orange', fragility: 'new' }],
      handColor: 'green',
      handFragility: 'broken',
      goalColor: 'orange',
      goalCell: { row: 4, col: 2 },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.board.cells[4][1]).toBeNull(); // the launcher never settles -- it was BROKEN
    expect(outcome.board.cells[4][2]).toEqual({ color: 'orange', fragility: 'cracked' }); // its impact still happened
    expect(outcome.result).toBe('won');
  });

  // Historia 2, escenario 3: un missclick no cambia el estado de la ficha lanzada -- vuelve
  // intacta a la mano, exactamente igual que hoy (FR-009).
  it('a missclick leaves the launched piece\'s fragility unchanged in hand', () => {
    const level: Level = {
      board: createBoard(),
      hand: { pieces: [{ color: 'green', fragility: 'cracked' }] },
      goal: { targetColor: 'green', targetCell: { row: 0, col: 0 } },
    };

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.hand.pieces).toEqual([{ color: 'green', fragility: 'cracked' }]);
    expect(outcome.board).toEqual(level.board);
  });
});
