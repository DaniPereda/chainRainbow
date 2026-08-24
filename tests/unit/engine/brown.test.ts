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
      goal: { at: { row: 0, col: 5 }, color: 'green' },
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
      goal: { at: { row: 1, col: 3 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 1 });

    expect(outcome.board.cells[1][1]).toBeNull();
    expect(outcome.board.cells[1][2]).toEqual({ color: 'green' });
    expect(outcome.board.cells[1][3]).toEqual({ color: 'orange' });
    expect(outcome.result).toBe('won');
  });
});

describe('brown: whatever it reaches is resolved by the existing universal rule (FR-003, spec.md 008)', () => {
  // data-model.md fixture 3: the long walk ends on a same-color piece -- annihilation,
  // exactly as at any other point in a chain. No special case for brown.
  it('annihilates when the long walk reaches a piece of the same color as the mover', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 2, col: 1 }, color: 'green' },
        { at: { row: 2, col: 4 }, color: 'green' },
      ],
      hand: ['brown'],
      // Nothing survives this launch, so no goal is reachable here -- placed
      // away from both pieces on purpose, so it doesn't read as "already sitting on
      // the goal" before the launch even happens (that piece is destined to vanish).
      goal: { at: { row: 2, col: 7 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 2 });

    expect(outcome.board.cells[2][1]).toBeNull();
    expect(outcome.board.cells[2][4]).toBeNull();
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(true);
    expect(outcome.result).toBe('lost');
  });

  // data-model.md fixture 5: two brown pieces meeting directly -- the long walk never
  // even starts, since the very first check is the same-color annihilation.
  it('annihilates immediately when two brown pieces meet directly, before any long walk starts', () => {
    const level = createLevel({
      pieces: [{ at: { row: 5, col: 1 }, color: 'brown' }],
      hand: ['brown'],
      goal: { at: { row: 5, col: 1 }, color: 'brown' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 5 });

    expect(outcome.board.cells[5][1]).toBeNull();
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0].type).toBe('ANNIHILATION');
  });
});

describe('brown: never travels more than one full lap of the board (FR-004, spec.md 008)', () => {
  // data-model.md fixture 4: a completely clear lane -- nothing ever blocks the walk,
  // so it must stop by itself at the second edge crossing (13 steps from col 3),
  // never hang, and never falsely block against its own starting cell at step 8
  // along the way (research.md 008).
  it('stops at the second edge crossing on an otherwise empty row', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'orange' }],
      hand: ['brown'],
      goal: { at: { row: 4, col: 0 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.board.cells[4][3]).toBeNull();
    expect(outcome.board.cells[4][0]).toEqual({ color: 'orange' });
    expect(outcome.result).toBe('won');
  });
});

describe('brown: launches from hand exactly like green and orange (FR-006, spec.md 008)', () => {
  // data-model.md fixture 6: a missclick works identically for a brown-handed launch
  // -- the launch mechanism itself is already color-agnostic, no adjustment needed.
  it('returns the piece to hand and leaves the board unchanged on a missclick', () => {
    const level = createLevel({
      pieces: [{ at: { row: 6, col: 4 }, color: 'orange' }],
      hand: ['brown'],
      goal: { at: { row: 6, col: 5 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
    expect(outcome.result).toBe('undetermined');
  });
});
