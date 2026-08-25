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

    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'new' }); // west branch
    expect(outcome.board.cells[4][3]).toBeNull(); // the split cell itself
    expect(outcome.board.cells[4][4]).toEqual({ color: 'green', fragility: 'new' }); // east branch
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

    expect(outcome.board.cells[1][4]).toEqual({ color: 'orange', fragility: 'new' }); // north branch
    expect(outcome.board.cells[2][4]).toBeNull(); // the split cell itself
    expect(outcome.board.cells[3][4]).toEqual({ color: 'orange', fragility: 'new' }); // south branch
    expect(outcome.result).toBe('won');
  });
});

describe('red: each branch composes with the existing universal rule, independently of the other (FR-003, spec.md)', () => {
  // data-model.md fixture 3: one branch lands on an occupied cell and pushes onward
  // using the DISTANCE OF THE BLOCKED PIECE'S OWN COLOR (green's 1), not red's -- the
  // branch is now just a green striker, no special case. The other branch is unaffected.
  it('lets a branch push a further piece onward with its own color distance, while the other branch settles independently', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 3 }, color: 'green' },
        { at: { row: 4, col: 4 }, color: 'orange' },
      ],
      hand: ['red'],
      goal: { at: { row: 4, col: 5 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });

    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'new' }); // west branch, unaffected
    expect(outcome.board.cells[4][3]).toBeNull(); // the split cell itself
    expect(outcome.board.cells[4][4]).toEqual({ color: 'green', fragility: 'new' }); // east branch settles where orange was
    expect(outcome.board.cells[4][5]).toEqual({ color: 'orange', fragility: 'new' }); // pushed onward by green's own distance
    expect(outcome.result).toBe('won');
  });

  // data-model.md fixture 4: one branch hits a piece of ITS OWN color and both
  // annihilate -- the other branch, moving the opposite way, is untouched by that.
  it('lets one branch annihilate by same color while the other branch settles unaffected', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 6, col: 3 }, color: 'orange' },
        { at: { row: 5, col: 3 }, color: 'orange' },
      ],
      hand: ['red'],
      goal: { at: { row: 7, col: 3 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 6 });

    expect(outcome.board.cells[5][3]).toBeNull(); // north branch: annihilated with the pre-existing orange
    expect(outcome.board.cells[6][3]).toBeNull(); // the split cell itself
    expect(outcome.board.cells[7][3]).toEqual({ color: 'orange', fragility: 'new' }); // south branch: unaffected, settles normally
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(true);
    expect(outcome.result).toBe('won');
  });
});

describe('red: the fixed branch order makes the result deterministic (FR-005, SC-003)', () => {
  // data-model.md fixture 7: same level, same launch, twice -- structurally identical
  // results and no mutation of the original level, exactly like determinism.test.ts
  // (feature 001). No isolated "order matters" fixture is needed on top of this --
  // the two branches travel opposite ways along the same axis from the same origin,
  // so their own chains can never overlap without an extreme, undesigned wrap-around
  // (research.md).
  it('produces the exact same result on two separate resolutions of the same level and launch', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'green' }],
      hand: ['red'],
      goal: { at: { row: 4, col: 4 }, color: 'green' },
    });
    const launch = { direction: 'S', lane: 3 } as const;

    const first = resolveLaunch(level, launch);
    const second = resolveLaunch(level, launch);

    expect(second).toEqual(first);
    expect(level.board.cells[4][3]).toEqual({ color: 'green', fragility: 'new' }); // original level untouched
  });
});

describe('red: launches from hand exactly like green/orange/brown (FR-007)', () => {
  // data-model.md fixture 6: a missclick works identically for a red-handed launch --
  // the launch mechanism is already color-agnostic, no adjustment needed for red.
  it('returns the piece to hand and leaves the board unchanged on a missclick', () => {
    const level = createLevel({
      pieces: [{ at: { row: 6, col: 4 }, color: 'orange' }],
      hand: ['red'],
      goal: { at: { row: 6, col: 5 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
    expect(outcome.result).toBe('undetermined');
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
