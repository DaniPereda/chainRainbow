import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt } from '../../../src/engine/board.js';
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

    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'cracked' }); // west branch
    expect(outcome.board.cells[4][3]).toEqual({ color: 'red', fragility: 'new' }); // the launcher settles at the split cell itself (FR-007)
    expect(outcome.board.cells[4][4]).toEqual({ color: 'green', fragility: 'cracked' }); // east branch
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

    expect(outcome.board.cells[1][4]).toEqual({ color: 'orange', fragility: 'cracked' }); // north branch
    expect(outcome.board.cells[2][4]).toEqual({ color: 'red', fragility: 'new' }); // the launcher settles at the split cell itself (FR-007)
    expect(outcome.board.cells[3][4]).toEqual({ color: 'orange', fragility: 'cracked' }); // south branch
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

    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'cracked' }); // west branch, unaffected
    expect(outcome.board.cells[4][3]).toEqual({ color: 'red', fragility: 'new' }); // the launcher settles at the split cell itself (FR-007)
    expect(outcome.board.cells[4][4]).toEqual({ color: 'green', fragility: 'cracked' }); // east branch settles where orange was
    expect(outcome.board.cells[4][5]).toEqual({ color: 'orange', fragility: 'cracked' }); // pushed onward by green's own distance
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
    expect(outcome.board.cells[6][3]).toEqual({ color: 'red', fragility: 'new' }); // the launcher settles at the split cell itself (FR-007), unaffected by either branch's own fate
    expect(outcome.board.cells[7][3]).toEqual({ color: 'orange', fragility: 'cracked' }); // south branch: unaffected, settles normally
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
  // data-model.md fixture 5: red against red -- the same-color check in applyImpact
  // (formerly resolveStrike) runs before any split logic, so no MOVE_STEP/branch
  // event is ever produced.
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

// data-model.md, Fixture 3: la división de rojo cuenta como un golpe más (FR-015) -- la
// defensora avanza su fragilidad UNA vez antes de dividirse, y ambas ramas heredan ese mismo
// estado ya avanzado.
describe('red: the split counts as one hit on the defender, and both branches inherit its advanced state (FR-015)', () => {
  it('produces two CRACKED branches when the defender was NEW', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 3 }, { color: 'green', fragility: 'new' });
    const level = {
      board,
      hand: { pieces: [{ color: 'red' as const, fragility: 'new' as const }] },
      goal: { targetColor: 'green' as const, targetCell: { row: 4, col: 4 } },
    };

    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });

    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'cracked' }); // west branch
    expect(outcome.board.cells[4][4]).toEqual({ color: 'green', fragility: 'cracked' }); // east branch
    expect(outcome.result).toBe('won');
  });

  it('eliminates BOTH resulting branches when the defender was already CRACKED', () => {
    const board = setPieceAt(createBoard(), { row: 4, col: 3 }, { color: 'green', fragility: 'cracked' });
    const level = {
      board,
      hand: { pieces: [{ color: 'red' as const, fragility: 'new' as const }] },
      goal: { targetColor: 'green' as const, targetCell: { row: 4, col: 4 } },
    };

    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });

    expect(outcome.board.cells[4][2]).toBeNull(); // west branch -- never settles, BROKEN
    expect(outcome.board.cells[4][3]).toEqual({ color: 'red', fragility: 'new' }); // the launcher settles at the split cell itself (FR-007), unaffected by either branch breaking
    expect(outcome.board.cells[4][4]).toBeNull(); // east branch -- never settles either
    expect(outcome.result).toBe('lost');
  });
});

describe('red: the two branches are now resolved synchronously, tick by tick, and can genuinely collide with each other (019-synchronous-tick-resolution, US1)', () => {
  // Real case, found by direct experimentation and confirmed against BOTH engines
  // (git-stashed back to pre-019 to run the OLD sequential resolveRedSplit for
  // comparison, per this feature's own quickstart.md): red hits an already-CRACKED
  // brown (both branches inherit BROKEN, FR-015) with a real piece adjacent to
  // each branch's very first step. Under the OLD model (branch 1 -- E -- fully
  // drains, including its own long cascade, before branch 2 -- O -- even takes its
  // first step), O's own destination (4,3) is genuinely empty by the time E's chain
  // reaches that area, so nothing this feature changes ever gets a chance to fire;
  // the two branches' cascades interact only through the REAL, already-settled
  // board, same as always. Under the NEW model, O is STILL an unprocessed, active
  // trajectory (never yet given its own turn) at the exact tick E's own chain
  // reaches O's destination cell (4,3) -- so `findCoincidingPair` catches it and
  // resolves a genuine symmetric collision (`applyMutualImpact`) between two
  // still-in-flight trajectories, something the old strictly-sequential model could
  // never represent. The two engines' FINAL boards and full event traces differ
  // completely as a result -- verified directly, not assumed.
  it('a branch that has not taken its own first step yet can still collide with the other branch\'s downstream chain', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 4 }, color: 'brown', fragility: 'cracked' },
        { at: { row: 4, col: 5 }, color: 'green', fragility: 'new' },
        { at: { row: 4, col: 3 }, color: 'orange', fragility: 'new' },
      ],
      hand: ['red'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    // The E branch (brown, broken) strikes green at (4,5) and vanishes there
    // (broken never settles) -- green (now cracked) continues onward using
    // brown's own walking strategy, heading east. That walk wraps around the
    // board and reaches (4,3) -- exactly where the O branch (brown, broken,
    // still unprocessed) is headed for its own first step -- a genuine
    // same-tick coincidence between two still-in-flight trajectories.
    expect(outcome.events).toEqual([
      { type: 'MOVE_STEP', piece: { color: 'red', fragility: 'new' }, from: { row: 3, col: 4 }, to: { row: 4, col: 4 }, direction: 'S', hasCollision: true },
      { type: 'MOVE_STEP', piece: { color: 'brown', fragility: 'broken' }, from: { row: 4, col: 4 }, to: { row: 4, col: 5 }, direction: 'E', hasCollision: true },
      // Symmetric collision: O (brown, already broken) vanishes; green (only
      // cracked going in) advances to broken and continues once more, using O's
      // own color (brown) and direction (west) -- wrapping around to (4,4),
      // where the real, already-settled red piece is waiting.
      { type: 'MOVE_STEP', piece: { color: 'green', fragility: 'broken' }, from: { row: 4, col: 3 }, to: { row: 4, col: 4 }, direction: 'O', hasCollision: true, pushedByColor: 'brown' },
      // Red -- a real, already-settled piece, unrelated to either branch -- gets
      // hit like any other defender and, being red, splits again (pre-existing
      // behavior, not new here: any real red piece struck by a different color
      // splits, regardless of how that striker came to exist).
      { type: 'MOVE_STEP', piece: { color: 'red', fragility: 'cracked' }, from: { row: 4, col: 4 }, to: { row: 4, col: 3 }, direction: 'O', hasCollision: true, pushedByColor: 'green' },
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 4, col: 3 }, to: { row: 3, col: 3 }, direction: 'N', hasCollision: false },
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 4, col: 3 }, to: { row: 5, col: 3 }, direction: 'S', hasCollision: false },
    ]);
    expect(outcome.board.cells[3][3]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(outcome.board.cells[4][3]).toEqual({ color: 'red', fragility: 'cracked' });
    expect(outcome.board.cells[5][3]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(outcome.result).toBe('lost');

    // Confirmed different from the OLD (pre-019) sequential model for this exact
    // same board: there, branch E's entire cascade (including this same wrapping
    // walk) fully resolves BEFORE branch O ever takes its own first step -- so by
    // the time E's walk reaches (4,3), O hasn't touched it yet and (4,3) is
    // genuinely empty; O only starts afterward, from the board E's chain left
    // behind. The old engine's full trace for this board settles a single orange
    // piece at (4,4) and nothing else -- a structurally different outcome (traced
    // by hand against the pre-019 code before this feature's own changes, not
    // re-asserted here since that code no longer exists on this branch).
  });
});
