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

describe('red: the two branches are resolved synchronously, tick by tick -- but only genuinely EMPTY-cell convergences are mutual collisions (019-synchronous-tick-resolution, later corrected)', () => {
  // Real case, found by direct experimentation. Both real pieces adjacent to
  // the split (green at (4,5), orange at (4,3)) are STATIONARY, untouched
  // defenders -- not moving trajectories. An earlier version of this fix
  // (019's own original `findCoincidingPair`, with no board-occupancy check)
  // treated the O branch's own first hop (heading to (4,3)) and the E branch's
  // downstream continuation (which also happened to compute (4,3) as its own
  // destination, since a walk stops wherever it finds something) as a
  // "genuine mutual collision" purely because they shared a `to` -- even
  // though (4,3) was occupied by a real, untouched orange the WHOLE time,
  // and the O branch had never even been given a chance to strike it
  // normally yet. That conflated two different things: two things racing
  // toward the SAME real, stationary piece is not the same as two things
  // meeting each other over empty ground -- confirmed with the user, who
  // pointed out that each piece should only ever know who struck it and from
  // where, never be influenced by some unrelated trajectory racing for the
  // same real defender. `findCoincidingPair` now requires the shared
  // destination to be genuinely EMPTY before treating it as a mutual
  // collision (research.md); when it's occupied, ordinary FIFO processing
  // takes over, and whichever site is older strikes the real defender first,
  // exactly like any other cascade.
  it('the O branch strikes the real orange directly, unaffected by the E branch\'s own separate cascade converging on the same cell', () => {
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

    expect(outcome.events).toEqual([
      { type: 'MOVE_STEP', piece: { color: 'red', fragility: 'new' }, from: { row: 3, col: 4 }, to: { row: 4, col: 4 }, direction: 'S', hasCollision: true },
      // E branch strikes the real green directly -- its own direction (E),
      // nothing swapped.
      { type: 'MOVE_STEP', piece: { color: 'brown', fragility: 'broken' }, from: { row: 4, col: 4 }, to: { row: 4, col: 5 }, direction: 'E', hasCollision: true },
      // O branch strikes the real orange directly too -- its own direction
      // (O), even though the E branch's own downstream continuation (below)
      // independently computes the SAME destination (4,3): that's no longer
      // treated as a coincidence to resolve between the branches themselves,
      // since (4,3) is occupied by a real piece neither branch has touched
      // yet -- ordinary FIFO just lets O strike it first (it was queued
      // first).
      { type: 'MOVE_STEP', piece: { color: 'brown', fragility: 'broken' }, from: { row: 4, col: 4 }, to: { row: 4, col: 3 }, direction: 'O', hasCollision: true },
      // Green (now cracked, struck by the E branch) continues onward using
      // brown's own walking strategy, in its OWN direction (E, inherited from
      // the E branch that struck it) -- wraps around and finds (4,3) now
      // occupied by the O branch's own just-settled piece... except the O
      // branch was BROKEN, so it never actually wrote to the board --
      // green settles there cleanly instead (hasCollision: false).
      { type: 'MOVE_STEP', piece: { color: 'green', fragility: 'cracked' }, from: { row: 4, col: 5 }, to: { row: 4, col: 3 }, direction: 'E', hasCollision: false, pushedByColor: 'brown' },
      // The real orange, struck by the O branch, continues onward using
      // brown's own walking strategy, in ITS OWN direction (O, inherited from
      // the O branch that struck it) -- and finds the real, already-settled
      // red piece at (4,4).
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 4, col: 3 }, to: { row: 4, col: 4 }, direction: 'O', hasCollision: true, pushedByColor: 'brown' },
      // Red -- unrelated to either branch -- gets hit like any other defender
      // (not a split trigger here: red is the one being struck, not the one
      // striking). Displaced using orange's OWN mechanism -- a fixed,
      // board-blind 2-cell push -- landing at (4,2) directly, skipping right
      // over green (sitting at (4,3)) without any collision check.
      { type: 'MOVE_STEP', piece: { color: 'red', fragility: 'cracked' }, from: { row: 4, col: 4 }, to: { row: 4, col: 2 }, direction: 'O', hasCollision: false, pushedByColor: 'orange' },
    ]);
    expect(outcome.board.cells[4][2]).toEqual({ color: 'red', fragility: 'cracked' });
    expect(outcome.board.cells[4][3]).toEqual({ color: 'green', fragility: 'cracked' });
    expect(outcome.board.cells[4][4]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(outcome.result).toBe('lost');
  });

  it('both branches strike their own real, stationary defender directly -- exact scenario reported by the user (red north through column 6)', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 3, col: 6 }, color: 'brown' },
        { at: { row: 3, col: 7 }, color: 'green' },
        { at: { row: 3, col: 5 }, color: 'green' },
      ],
      hand: ['red'],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'N', lane: 6 });

    // The two branches themselves (events 2/3) each strike their own real
    // defender directly, each in its own direction -- E and O respectively,
    // never swapped, exactly what the user expected: "cada una de ellas
    // deberia operar solo sabiendo quien la golpea y desde donde".
    expect(outcome.events[1]).toMatchObject({
      piece: { color: 'brown' },
      from: { row: 3, col: 6 },
      to: { row: 3, col: 7 },
      direction: 'E',
      hasCollision: true,
    });
    expect(outcome.events[2]).toMatchObject({
      piece: { color: 'brown' },
      from: { row: 3, col: 6 },
      to: { row: 3, col: 5 },
      direction: 'O',
      hasCollision: true,
    });
    expect(outcome.result).toBe('lost');
  });
});
