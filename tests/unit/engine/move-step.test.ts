import { describe, expect, it } from 'vitest';
import { stepBy } from '../../../src/engine/move-step.js';

// Wrap-around (FR-001, spec.md 004) is a property of movement itself, not of any
// particular collision outcome -- resolveStrike just asks "where does a piece end
// up after moving N cells in this direction" and gets a board-aware answer. That
// makes `stepBy` worth testing directly as its own concept, in isolation from
// collisions: what happens once a piece lands on an occupied wrapped cell is
// already proven by the existing push/annihilation suites (orange.test.ts,
// same-color.test.ts) for ANY destination coordinate, wrapped or not.
describe('stepBy: multi-cell movement wraps around the board edges (FR-001)', () => {
  it('stays in bounds and behaves like plain stepping when the move does not cross an edge', () => {
    expect(stepBy({ row: 2, col: 3 }, 'E', 2)).toEqual({ row: 2, col: 5 });
  });

  it('wraps to the opposite edge of the same row when the move overshoots east', () => {
    expect(stepBy({ row: 2, col: 7 }, 'E', 1)).toEqual({ row: 2, col: 0 });
    expect(stepBy({ row: 2, col: 6 }, 'E', 2)).toEqual({ row: 2, col: 0 });
  });

  it('wraps to the opposite edge of the same column when the move overshoots south', () => {
    expect(stepBy({ row: 7, col: 3 }, 'S', 2)).toEqual({ row: 1, col: 3 });
  });

  it('wraps to the opposite edge when the move overshoots the west/north edge', () => {
    expect(stepBy({ row: 0, col: 0 }, 'O', 1)).toEqual({ row: 0, col: 7 });
    expect(stepBy({ row: 0, col: 0 }, 'N', 1)).toEqual({ row: 7, col: 0 });
  });
});
