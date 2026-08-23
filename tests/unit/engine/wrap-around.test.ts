import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelWrapToEmpty01 } from '../../../src/engine/index.js';

describe('wrap-around: a piece pushed past the edge reappears on the opposite side (FR-001)', () => {
  // Acceptance Scenarios 1-2 (spec.md 004): destination past the edge wraps to the
  // opposite edge of the same row; if that cell is empty, the piece settles there.
  it('reappears on the opposite edge and settles when that cell is empty', () => {
    const outcome = resolveLaunch(testLevelWrapToEmpty01, { direction: 'E', lane: 2 });

    expect(outcome.board.cells[2][7]).toBeNull(); // launcher consumed, never settles (spec.md 006)
    expect(outcome.board.cells[2][0]).toEqual({ color: 'orange' }); // reappeared here
    expect(outcome.result).toBe('won');
  });
});

// Acceptance Scenarios 3-4 (spec.md 004): whatever is on the wrapped destination is
// resolved with the existing universal rule (same color -> annihilate, otherwise ->
// push). There is no dedicated resolveLaunch fixture for this: wrap-around is a
// movement concern (see move-step.test.ts, which proves `stepBy` computes the
// wrapped destination correctly for every direction), and collision resolution
// never learns -- or needs to know -- whether the coordinate it receives came from
// a wrap. That resolution behavior is already proven for any destination coordinate
// by orange.test.ts (push) and same-color.test.ts (annihilation). Together, those
// two facts are Scenarios 3-4 by construction.
