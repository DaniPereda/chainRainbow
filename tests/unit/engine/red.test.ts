import { describe, expect, it } from 'vitest';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';

describe('red: splits whatever it hits into two branches instead of pushing it (FR-001..FR-005)', () => {
  // data-model.md fixture 1: vertical impact (S) -> branches on the E/O axis, both clear.
  it('splits a piece hit from N/S into east and west branches, both landing on empty cells', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'green' }],
      hand: ['red'],
      goal: { at: { row: 4, col: 4 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });

    expect(outcome.board.cells[4][2]).toEqual({ color: 'green' }); // west branch
    expect(outcome.board.cells[4][3]).toBeNull(); // the split cell itself
    expect(outcome.board.cells[4][4]).toEqual({ color: 'green' }); // east branch
    expect(outcome.result).toBe('won');
  });

  // data-model.md fixture 2: horizontal impact (E) -> branches on the N/S axis, both clear.
  it('splits a piece hit from E/O into north and south branches, both landing on empty cells', () => {
    const level = createLevel({
      pieces: [{ at: { row: 2, col: 4 }, color: 'orange' }],
      hand: ['red'],
      goal: { at: { row: 3, col: 4 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 2 });

    expect(outcome.board.cells[1][4]).toEqual({ color: 'orange' }); // north branch
    expect(outcome.board.cells[2][4]).toBeNull(); // the split cell itself
    expect(outcome.board.cells[3][4]).toEqual({ color: 'orange' }); // south branch
    expect(outcome.result).toBe('won');
  });
});

describe('red hitting red: same-color annihilation has priority, the split never happens (edge case)', () => {
  // data-model.md fixture 5: red against red -- the same-color check in resolveStrike
  // runs before any split logic, so no MOVE_STEP/branch event is ever produced.
  it('annihilates immediately when a launched red hits another red, with no split', () => {
    const level = createLevel({
      pieces: [{ at: { row: 0, col: 1 }, color: 'red' }],
      hand: ['red'],
      goal: { at: { row: 0, col: 5 }, color: 'red' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.board.cells[0][1]).toBeNull();
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0].type).toBe('ANNIHILATION');
    expect(outcome.result).toBe('lost');
  });
});
