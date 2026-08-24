import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Piece } from '../../../src/engine/board.js';
import { stepBy, stepUntilBlocked } from '../../../src/engine/move-step.js';

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

  it('wraps to the opposite edge when the move overshoots east', () => {
    expect(stepBy({ row: 2, col: 7 }, 'E', 1)).toEqual({ row: 2, col: 0 });
  });

  it('wraps to the opposite edge when the move overshoots west', () => {
    expect(stepBy({ row: 0, col: 0 }, 'O', 1)).toEqual({ row: 0, col: 7 });
  });

  it('wraps to the opposite edge when the move overshoots south', () => {
    expect(stepBy({ row: 7, col: 3 }, 'S', 2)).toEqual({ row: 1, col: 3 });
  });

  it('wraps to the opposite edge when the move overshoots north', () => {
    expect(stepBy({ row: 0, col: 0 }, 'N', 1)).toEqual({ row: 7, col: 0 });
  });
});

// stepUntilBlocked (spec.md 008, marrón): steps one cell at a time, checking occupancy at
// EVERY step -- unlike stepBy, which never looks at the board -- stopping at the first
// occupied cell, or once it has crossed the board edge `maxEdgeCrossings` times, whichever
// comes first. What resolveStrike does once it lands on an occupied cell is already proven
// for any destination by the existing push/annihilation suites; this only needs to prove the
// destination itself is computed correctly.
describe('stepUntilBlocked: walks until blocked or capped by edge crossings (spec.md 008)', () => {
  // `mover` is deliberately a distinct object from whatever is placed on the board as an
  // obstacle in these two tests -- it must NOT be excluded from the blocking check.
  const mover: Piece = { color: 'brown' };

  it('stops at the very first step if it is already occupied -- no blind skip like orange', () => {
    const board = setPieceAt(createBoard(), { row: 2, col: 4 }, { color: 'orange' });

    expect(stepUntilBlocked(board, mover, { row: 2, col: 3 }, 'E', 2)).toEqual({ row: 2, col: 4 });
  });

  it('walks past several empty cells before stopping at the first occupied one', () => {
    const board = setPieceAt(createBoard(), { row: 2, col: 6 }, { color: 'orange' });

    expect(stepUntilBlocked(board, mover, { row: 2, col: 3 }, 'E', 2)).toEqual({ row: 2, col: 6 });
  });

  it('does not block against its own starting cell, and stops right before the second edge crossing', () => {
    // The board still shows `mover` itself sitting at `position` -- the same stale
    // snapshot resolveStrike always passes down (it hasn't been erased from the board
    // yet). Without excluding it BY IDENTITY, this would incorrectly stop at step 8 (see
    // research.md 008: every unblocked walk revisits its own start at step 8, since the
    // board is an 8-wide cycle -- this is the normal case, not a rare one).
    //
    // col 7, not col 0: the cap is checked BEFORE wrapping into the crossing, so the
    // piece settles on the last in-bounds cell of its final lap (12 steps from col 3),
    // not on the first cell of a lap it never actually enters (spec.md 008 erratum).
    const position = { row: 4, col: 3 };
    const board = setPieceAt(createBoard(), position, mover);

    expect(stepUntilBlocked(board, mover, position, 'E', 2)).toEqual({ row: 4, col: 7 });
  });
});
