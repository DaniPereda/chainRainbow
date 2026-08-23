import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelOrange01, type Level } from '../../../src/engine/index.js';
import { createBoard, setPieceAt } from '../../../src/engine/board.js';

describe('orange: jumps 2 cells, intermediate cell untouched (FR-002, FR-003, FR-005)', () => {
  it('leaves the intermediate cell exactly as it was and lands the impacted piece 2 cells away', () => {
    const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 3 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThanOrEqual(1);

    // Intermediate cell: unchanged (still the original green piece).
    expect(outcome.board.cells[3][5]).toEqual({ color: 'green' });

    // Impacted piece landed exactly 2 cells beyond the impact point.
    expect(outcome.board.cells[3][6]).toEqual({ color: 'green' });

    // The launched orange piece settled where the impacted piece used to be.
    expect(outcome.board.cells[3][4]).toEqual({ color: 'orange' });
  });
});

describe('orange: cascade — each link uses the striking piece\'s own color (FR-004)', () => {
  it('pushes the second piece by the distance of whichever piece struck it, not its own color or the launcher\'s', () => {
    // Orange launcher (distance 2) hits a green piece at col 4 -> lands at col 6.
    // Col 6 is occupied, so a second collision triggers there: the piece that just
    // moved (green, distance 1) is now the striker for THAT collision, not the
    // original orange launcher and not the second piece's own color. If either of
    // those were used instead, the second piece would land on col 8, not col 7.
    const board = setPieceAt(
      setPieceAt(createBoard(), { row: 5, col: 4 }, { color: 'green' }),
      { row: 5, col: 6 },
      { color: 'orange' },
    );
    const level: Level = {
      board,
      hand: { pieces: [{ color: 'orange' }] },
      objective: { targetColor: 'green', targetCell: { row: 0, col: 0 } },
    };

    const outcome = resolveLaunch(level, { direction: 'E', lane: 5 });

    expect(outcome.board.cells[5][4]).toEqual({ color: 'orange' }); // launcher settled here
    expect(outcome.board.cells[5][6]).toEqual({ color: 'green' }); // first piece: pushed 2 (orange)
    expect(outcome.board.cells[5][7]).toEqual({ color: 'orange' }); // second piece: pushed 1 (green), not 2
  });
});

describe('orange: win, loss, and undetermined (FR-007)', () => {
  it('marks the level as won when the jump lands the piece on the objective cell', () => {
    const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 3 });

    expect(outcome.result).toBe('won');
  });

  it('marks the level as lost when a collision consumes the hand without meeting the objective', () => {
    const levelWithUnreachableObjective = {
      ...testLevelOrange01,
      objective: { targetColor: 'green' as const, targetCell: { row: 3, col: 7 } },
    };

    const outcome = resolveLaunch(levelWithUnreachableObjective, { direction: 'E', lane: 3 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.hand.pieces).toHaveLength(0);
    expect(outcome.result).toBe('lost');
  });

  it('leaves the level undetermined on a missclick, since the piece returns to hand', () => {
    const outcome = resolveLaunch(testLevelOrange01, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.hand.pieces.length).toBeGreaterThan(0);
    expect(outcome.result).toBe('undetermined');
  });
});
