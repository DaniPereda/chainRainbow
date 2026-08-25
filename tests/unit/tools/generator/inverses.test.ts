import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt } from '../../../../src/engine/board.js';
import { inverseCandidates } from '../../../../tools/generator/inverses.js';

describe('inverseCandidates: green/orange are univocal (research.md)', () => {
  it('green: steps back exactly 1 cell, with wrap-around', () => {
    expect(inverseCandidates('green', 'E', { row: 2, col: 5 }, createBoard(), 'settle')).toEqual([
      { row: 2, col: 4 },
    ]);
    // wrap-around: destination col 0 heading East means the origin was col 7.
    expect(inverseCandidates('green', 'E', { row: 2, col: 0 }, createBoard(), 'settle')).toEqual([
      { row: 2, col: 7 },
    ]);
  });

  it('orange: steps back exactly 2 cells, with wrap-around', () => {
    expect(inverseCandidates('orange', 'E', { row: 2, col: 5 }, createBoard(), 'settle')).toEqual([
      { row: 2, col: 3 },
    ]);
  });
});

describe('inverseCandidates: brown "settle" mode only lands on the far edge of the lane (research.md)', () => {
  it('is empty (invalid) when the destination is not the far edge of its lane', () => {
    // Direction E -> far edge is col 7. col 4 is not the far edge.
    expect(inverseCandidates('brown', 'E', { row: 3, col: 4 }, createBoard(), 'settle')).toEqual([]);
  });

  it('offers every clear-path cell along the lane when the destination IS the far edge', () => {
    const candidates = inverseCandidates('brown', 'E', { row: 3, col: 7 }, createBoard(), 'settle');

    // Every column before the far edge, on an otherwise empty board, is a valid
    // origin -- returned nearest-to-target first (the natural order of walking
    // backward from `to`).
    expect(candidates).toEqual(
      [6, 5, 4, 3, 2, 1, 0].map((col) => ({ row: 3, col })),
    );
  });

  it('excludes candidates whose path to the far edge is blocked by an existing piece', () => {
    const board = setPieceAt(createBoard(), { row: 3, col: 5 }, { color: 'orange' });

    const candidates = inverseCandidates('brown', 'E', { row: 3, col: 7 }, board, 'settle');

    // Only origins strictly after the blocker (col 6) have a clear path to col 7.
    expect(candidates).toEqual([{ row: 3, col: 6 }]);
  });
});

describe('inverseCandidates: brown "occupied" mode accepts any clear-path candidate (research.md)', () => {
  it('offers every clear-path cell along the lane toward the already-occupied destination', () => {
    const board = setPieceAt(createBoard(), { row: 1, col: 6 }, { color: 'green' });

    const candidates = inverseCandidates('brown', 'E', { row: 1, col: 6 }, board, 'occupied');

    expect(candidates).toEqual(
      [5, 4, 3, 2, 1, 0].map((col) => ({ row: 1, col })),
    );
  });

  it('excludes candidates whose path is blocked by a piece before the destination', () => {
    const board = setPieceAt(
      setPieceAt(createBoard(), { row: 1, col: 6 }, { color: 'green' }),
      { row: 1, col: 3 },
      { color: 'orange' },
    );

    const candidates = inverseCandidates('brown', 'E', { row: 1, col: 6 }, board, 'occupied');

    expect(candidates).toEqual([{ row: 1, col: 5 }, { row: 1, col: 4 }]);
  });
});
