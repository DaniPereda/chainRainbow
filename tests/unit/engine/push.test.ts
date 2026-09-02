import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt, type Piece } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';
import { resolveChain, type ImpactSite } from '../../../src/engine/events.js';
import { applyImpact, applyMutualImpact } from '../../../src/engine/pieces/push.js';

describe('applyImpact: the four branches of a single impact (016-immediate-chain-placement)', () => {
  it('empty destination: the striker settles, hasCollision: false, no nextSites', () => {
    const board = createBoard();
    const piece: Piece = { color: 'green', fragility: 'new' };

    const result = applyImpact(board, { piece, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });

    expect(result.board.cells[0][1]).toEqual(piece);
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece, from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, direction: 'E', hasCollision: false },
    ]);
    expect(result.nextSites).toEqual([]);
  });

  it('same-color destination: mutual annihilation, no nextSites', () => {
    const board = setPieceAt(createBoard(), { row: 0, col: 1 }, { color: 'green', fragility: 'new' });
    const piece: Piece = { color: 'green', fragility: 'cracked' };

    const result = applyImpact(board, { piece, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });

    expect(result.board.cells[0][1]).toBeNull();
    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 0, col: 1 }, color: 'green', from: { row: 0, col: 0 }, direction: 'E' },
    ]);
    expect(result.nextSites).toEqual([]);
  });

  it('different color, the defender\'s own push lands on an empty cell: a single call still defers to exactly one nextSites entry -- no fast path, one uniform rule for every link (Principle V)', () => {
    const board = setPieceAt(createBoard(), { row: 0, col: 1 }, { color: 'green', fragility: 'new' });
    const striker: Piece = { color: 'orange', fragility: 'new' }; // orange pushes 2 cells

    const result = applyImpact(board, { piece: striker, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });

    // The striker already settled -- that decision never depended on whether the
    // defender's own destination turns out to be empty or occupied.
    expect(result.board.cells[0][1]).toEqual(striker);
    // The defender is NOT written to the board yet by this single call, even though
    // its destination happens to be empty -- applyImpact never peeks ahead to decide
    // whether to fast-path; it always hands the defender off as one nextSites entry,
    // and whoever processes that entry next (resolveChain, here) is what discovers
    // the destination is empty and settles it.
    expect(result.board.cells[0][3]).toBeNull();
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: striker, from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, direction: 'E', hasCollision: true },
    ]);
    expect(result.nextSites).toEqual([
      {
        piece: { color: 'green', fragility: 'cracked' },
        direction: 'E',
        from: { row: 0, col: 1 },
        to: { row: 0, col: 3 },
        pushedByColor: 'orange',
      },
    ]);

    // Letting resolveChain (the same queue resolveLaunch itself drives) finish the
    // job confirms the FULL cascade still ends up exactly where expected.
    const drained = resolveChain(
      board,
      [{ piece: striker, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } }],
      applyImpact,
      applyMutualImpact,
    );
    expect(drained.board.cells[0][1]).toEqual(striker);
    expect(drained.board.cells[0][3]).toEqual({ color: 'green', fragility: 'cracked' });
    expect(drained.events).toEqual([
      { type: 'MOVE_STEP', piece: striker, from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, direction: 'E', hasCollision: true },
      {
        type: 'MOVE_STEP',
        piece: { color: 'green', fragility: 'cracked' },
        from: { row: 0, col: 1 },
        to: { row: 0, col: 3 },
        direction: 'E',
        hasCollision: false,
        pushedByColor: 'orange',
      },
    ]);
  });

  it('different color, the defender\'s own push lands on an occupied cell: striker settles now, the displaced defender becomes exactly one nextSites entry', () => {
    let board = setPieceAt(createBoard(), { row: 0, col: 1 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 0, col: 3 }, { color: 'brown', fragility: 'new' });
    const striker: Piece = { color: 'orange', fragility: 'new' };

    const result = applyImpact(board, { piece: striker, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });

    // Striker settles immediately -- this decision never depended on the defender's
    // own onward fate (research.md, Decisión 3).
    expect(result.board.cells[0][1]).toEqual(striker);
    // The displaced defender is NOT yet on the board -- it's "in transit", represented
    // purely as the one nextSites entry, not a half-written board state.
    expect(result.board.cells[0][3]).toEqual({ color: 'brown', fragility: 'new' }); // untouched so far
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: striker, from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, direction: 'E', hasCollision: true },
    ]);
    expect(result.nextSites).toEqual([
      {
        piece: { color: 'green', fragility: 'cracked' },
        direction: 'E',
        from: { row: 0, col: 1 },
        to: { row: 0, col: 3 },
        pushedByColor: 'orange',
      },
    ]);
  });
});

describe('applyMutualImpact: two in-flight trajectories colliding with each other (019-synchronous-tick-resolution)', () => {
  it('same color: mutual annihilation, no nextSites -- same rule as applyImpact\'s own same-color case', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'green', fragility: 'cracked' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'green', fragility: 'new' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 2, col: 4 }, color: 'green', from: { row: 2, col: 3 }, direction: 'E' },
    ]);
    expect(result.nextSites).toEqual([]);
  });

  it('different color, neither already broken: both advance fragility once and swap direction/push-mechanism (research.md, Decisión 3 -- confirmed with the user)', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'green', fragility: 'new' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'orange', fragility: 'new' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    expect(result.events).toEqual([]);
    expect(result.nextSites).toEqual([
      // A: hit once (new -> cracked), continues using B's color (orange, distance 2)
      // and B's own direction (N) -- not its own original direction (E).
      {
        piece: { color: 'green', fragility: 'cracked' },
        direction: 'N',
        from: { row: 2, col: 4 },
        to: { row: 0, col: 4 },
        pushedByColor: 'orange',
      },
      // B: hit once (new -> cracked), continues using A's color (green, distance 1)
      // and A's own direction (E).
      {
        piece: { color: 'orange', fragility: 'cracked' },
        direction: 'E',
        from: { row: 2, col: 4 },
        to: { row: 2, col: 5 },
        pushedByColor: 'green',
      },
    ]);
  });

  it('a trajectory already BROKEN before this collision vanishes instead of advancing again -- this is what guarantees the collision can never loop forever (research.md, Decisión 3: bug found and fixed during implementation)', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'green', fragility: 'broken' }, // already used up its one further hop earlier
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'orange', fragility: 'cracked' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    // A vanishes -- no nextSite for it, regardless of it still "hitting" B.
    // B was still only cracked (not yet broken), so it advances once more and
    // continues, using A's color (green, distance 1) and A's direction (E).
    expect(result.nextSites).toEqual([
      {
        piece: { color: 'orange', fragility: 'broken' },
        direction: 'E',
        from: { row: 2, col: 4 },
        to: { row: 2, col: 5 },
        pushedByColor: 'green',
      },
    ]);
  });

  it('both trajectories already BROKEN before this collision: both vanish, zero nextSites', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'green', fragility: 'broken' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'orange', fragility: 'broken' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    expect(result.nextSites).toEqual([]);
  });
});

describe('applyImpact: red split interleaves both branches hop by hop (019-synchronous-tick-resolution)', () => {
  // 019-synchronous-tick-resolution: both branches are now seeded into the SAME
  // resolveChain queue (research.md, Decisión 1/2) instead of two sequential
  // resolveChain calls -- so a branch's OWN further chain (E branch pushing
  // orange onward here) no longer fully drains before the OTHER branch (O) gets
  // its own turn. The FINAL BOARD is identical either way (neither branch's path
  // coincides with the other's here, so no symmetric collision fires); only the
  // EVENT ORDER changes, reflecting genuine hop-by-hop interleaving: this test
  // used to assert strict branch-1-then-branch-2 sequencing (FR-005 of
  // 009-red-piece, now superseded) -- it was rewritten, not just re-valued,
  // because that sequencing guarantee is exactly what this feature replaces.
  it('branch 2 settles between branch 1\'s own two hops, not after both of them', () => {
    let board = setPieceAt(createBoard(), { row: 4, col: 4 }, { color: 'green', fragility: 'new' });
    board = setPieceAt(board, { row: 4, col: 5 }, { color: 'orange', fragility: 'new' }); // occupies the E branch's destination
    // (4,6) empty -- where orange gets pushed onward by the E branch's own strike
    // (4,3) empty -- the O branch's destination, settles directly

    const striker: Piece = { color: 'red', fragility: 'new' };
    const result = applyImpact(board, { piece: striker, direction: 'S', from: { row: 3, col: 4 }, to: { row: 4, col: 4 } });

    // Final board: red settled at the split point; E branch (green, cracked) settled
    // at (4,5) after pushing orange (also cracked) onward to (4,6); O branch (green,
    // cracked -- same shared advanced state, FR-015) settled directly at (4,3).
    // Unchanged from before this feature -- neither branch's path ever coincides
    // with the other's in this fixture, so the final state doesn't move at all.
    expect(result.board.cells[4][4]).toEqual(striker);
    expect(result.board.cells[4][5]).toEqual({ color: 'green', fragility: 'cracked' });
    expect(result.board.cells[4][6]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(result.board.cells[4][3]).toEqual({ color: 'green', fragility: 'cracked' });

    // Event order: striker settles, then E branch's own first hop (settling at
    // (4,5) and producing orange's onward push as a queued nextSite) -- but O
    // branch, seeded in the SAME queue, gets its turn NEXT (it was queued before
    // orange's push was), settling at (4,3) BEFORE orange's onward push is
    // finally processed. Verified directly against the real engine, not assumed.
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: striker, from: { row: 3, col: 4 }, to: { row: 4, col: 4 }, direction: 'S', hasCollision: true },
      {
        type: 'MOVE_STEP',
        piece: { color: 'green', fragility: 'cracked' },
        from: { row: 4, col: 4 },
        to: { row: 4, col: 5 },
        direction: 'E',
        hasCollision: true,
      },
      {
        type: 'MOVE_STEP',
        piece: { color: 'green', fragility: 'cracked' },
        from: { row: 4, col: 4 },
        to: { row: 4, col: 3 },
        direction: 'O',
        hasCollision: false,
      },
      {
        type: 'MOVE_STEP',
        piece: { color: 'orange', fragility: 'cracked' },
        from: { row: 4, col: 5 },
        to: { row: 4, col: 6 },
        direction: 'E',
        hasCollision: false,
        pushedByColor: 'green',
      },
    ]);
    expect(result.nextSites).toEqual([]);
  });
});

describe('applyImpact: the struck defender\'s own displacement sees the striker that just settled at the same impact (017-striker-visibility-gap)', () => {
  it('a brown striker\'s just-settled cell blocks the struck defender\'s own wrap-around walk, instead of being invisible to it', () => {
    // An otherwise-empty board: the ONLY piece the struck defender's own walk could
    // possibly collide with, on its way around the board, is the striker itself --
    // which just settled at the impact cell a few lines earlier in this same
    // applyImpact call. Before the fix, that walk was computed against `vacated`
    // (the pre-settle snapshot), so it couldn't see the striker there and wrapped
    // all the way around, landing past it. After the fix, it's computed against
    // `boardWithStriker`, so the walk stops the instant it revisits that cell.
    const board = setPieceAt(createBoard(), { row: 0, col: 0 }, { color: 'orange', fragility: 'new' });
    const striker: Piece = { color: 'brown', fragility: 'new' };

    const result = applyImpact(board, {
      piece: striker,
      direction: 'E',
      from: { row: 0, col: 7 },
      to: { row: 0, col: 0 },
    });

    expect(result.board.cells[0][0]).toEqual(striker); // the striker settled here first
    expect(result.nextSites).toEqual([
      {
        piece: { color: 'orange', fragility: 'cracked' },
        direction: 'E',
        from: { row: 0, col: 0 },
        // The struck defender's own walk revisits (0,0) after a full lap around an
        // otherwise-empty board -- with the striker visible there, it collides and
        // stops AT that cell, rather than crossing a second edge and landing at
        // (0,7) (the bug: a full extra unobstructed lap past its own striker).
        to: { row: 0, col: 0 },
        pushedByColor: 'brown',
      },
    ]);
  });
});

describe('a self-collision within the same cascade is now a real collision, not passed through (SC-002/SC-005)', () => {
  it('a brown push whose wrap-around would revisit an earlier link of the same cascade collides with it for real', () => {
    // Exact fixture from the design conversation (originally generated level 56,
    // seed 56, complexityScore 11): three board pieces stacked in column 2 --
    // orange (row2), brown (row3), green (row5) -- plus a launched orange (already
    // cracked) that enters from the south travelling north. Before this feature,
    // the final link's brown-driven push wrapped all the way around the empty board
    // and landed on the goal cell (row0) without ever "seeing" the launched orange
    // that, by then, was for real sitting at row5 -- reaching 'won'. After this
    // feature, that piece is real and settled the moment the walk reaches it.
    const level = createLevel({
      pieces: [
        { at: { row: 0, col: 4 }, color: 'orange', fragility: 'new' },
        { at: { row: 2, col: 2 }, color: 'orange', fragility: 'new' },
        { at: { row: 3, col: 2 }, color: 'brown', fragility: 'new' },
        { at: { row: 5, col: 2 }, color: 'green', fragility: 'new' },
      ],
      hand: [{ color: 'orange', fragility: 'cracked' }, 'brown', 'brown'],
      goal: { at: { row: 0, col: 2 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'N', lane: 2 }, 0);

    // The launched orange settles at row5 (having pushed green 2 cells to row3,
    // which pushed brown 1 cell to row2) -- for real, on the board -- BEFORE the
    // original orange's brown-driven wrap-around walk ever reaches that cell.
    expect(outcome.board.cells[5][2]).toBeNull(); // annihilated, not sitting there anymore
    expect(outcome.events).toContainEqual({
      type: 'ANNIHILATION',
      at: { row: 5, col: 2 },
      color: 'orange',
      from: { row: 2, col: 2 },
      direction: 'N',
    });
    // The goal is never reached this way anymore -- no orange ever lands on row0.
    expect(outcome.board.cells[0][2]).toBeNull();
    expect(outcome.result).not.toBe('won');
  });
});
