import { describe, expect, it } from 'vitest';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';

describe('brown: walks much farther than green or orange, checking every cell (FR-002, FR-003)', () => {
  // data-model.md fixture 1: a long walk into a blocker, which then cascades using
  // its OWN striker distance (green's 1) -- not brown's. Proves brown doesn't
  // "contaminate" the distance of the next link in the chain.
  it('walks past several empty cells, then the blocked piece pushes onward with its own distance', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 0, col: 1 }, color: 'green' },
        { at: { row: 0, col: 5 }, color: 'orange' },
      ],
      hand: ['brown'],
      objective: { at: { row: 0, col: 5 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.board.cells[0][1]).toBeNull(); // vacated by the pushed green
    expect(outcome.board.cells[0][5]).toEqual({ color: 'green' }); // walked here, far past orange's reach
    expect(outcome.board.cells[0][6]).toEqual({ color: 'orange' }); // pushed onward by green's own distance (1)
    expect(outcome.board.cells[0][0]).toBeNull(); // the launched brown never settles (spec.md 006)
    expect(outcome.result).toBe('won');
  });

  // data-model.md fixture 2: contrast with orange, which blindly skips the first
  // intermediate cell -- brown checks it and stops there instead.
  it('stops at the very first cell if it is already occupied -- no blind skip like orange', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 1, col: 1 }, color: 'green' },
        { at: { row: 1, col: 2 }, color: 'orange' },
      ],
      hand: ['brown'],
      objective: { at: { row: 1, col: 3 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 1 });

    expect(outcome.board.cells[1][1]).toBeNull();
    expect(outcome.board.cells[1][2]).toEqual({ color: 'green' });
    expect(outcome.board.cells[1][3]).toEqual({ color: 'orange' });
    expect(outcome.result).toBe('won');
  });
});
