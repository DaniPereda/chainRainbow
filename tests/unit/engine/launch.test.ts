import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01, type Level } from '../../../src/engine/index.js';
import { createBoard, setPieceAt } from '../../../src/engine/board.js';

describe('launch: travel and missclick (FR-001, FR-002, FR-003)', () => {
  it('returns the piece to hand and leaves the board unchanged on missclick', () => {
    const outcome = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.events).toHaveLength(0);
    expect(outcome.board).toEqual(testLevelGreen01.board);
    expect(outcome.hand).toEqual(testLevelGreen01.hand);
  });

  it('triggers an interaction, not a missclick, when the collision happens in the very first cell', () => {
    const board = setPieceAt(createBoard(), { row: 2, col: 0 }, { color: 'green' });
    const level: Level = {
      board,
      hand: { pieces: [{ color: 'green' }] },
      objective: { targetColor: 'green', targetCell: { row: 2, col: 1 } },
    };

    const outcome = resolveLaunch(level, { direction: 'E', lane: 2 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThan(0);
  });

  it('travels past empty cells before colliding with the piece on the board', () => {
    const outcome = resolveLaunch(testLevelGreen01, { direction: 'E', lane: 4 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThan(0);
  });
});
