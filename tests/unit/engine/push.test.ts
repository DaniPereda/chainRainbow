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
      // visualOrigin is A's own pre-collision from/direction -- A's real journey
      // started there, not at the meeting cell (4,2), (021-cellwise-collision-
      // resolution follow-up: preserved through the mutual collision so the
      // renderer can draw the whole thing).
      {
        piece: { color: 'green', fragility: 'cracked' },
        direction: 'N',
        from: { row: 2, col: 4 },
        to: { row: 0, col: 4 },
        pushedByColor: 'orange',
        visualOrigin: { from: { row: 2, col: 3 }, direction: 'E' },
      },
      // B: hit once (new -> cracked), continues using A's color (green, distance 1)
      // and A's own direction (E). visualOrigin is B's own pre-collision from/direction.
      {
        piece: { color: 'orange', fragility: 'cracked' },
        direction: 'E',
        from: { row: 2, col: 4 },
        to: { row: 2, col: 5 },
        pushedByColor: 'green',
        visualOrigin: { from: { row: 4, col: 4 }, direction: 'N' },
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
        visualOrigin: { from: { row: 4, col: 4 }, direction: 'N' },
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

describe('applyMutualImpact: one side is a real red piece set in motion by an earlier hit -- red takes the hit like anything else (022-parallel-branch-animation follow-up review, level 2)', () => {
  // Before this fix, red was special-cased in a mutual collision: it settled
  // immediately, unharmed, at the meeting cell, while the OTHER side alone
  // took a hit (and got split). Confirmed wrong by the user during a manual
  // review of levels/2.json ("el rojo no debe tener un comportamiento especial
  // en ningun caso. Si recibe un golpe se mueve en consecuencia y se degrada
  // en nivel de fragilidad"): red is never special as the piece BEING hit --
  // only as the piece DOING the hitting (splitting instead of pushing, its own
  // established mechanism, `resolveRedSplit`). So here red advances its own
  // fragility and continues onward using orange's own push mechanism (a fixed
  // 2-cell jump), exactly like any other different-color defender would --
  // while orange, hit by red, still splits, unaffected.
  it('red as siteA advances and continues via siteB\'s own push mechanism -- deferred, not settled here', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'red', fragility: 'cracked' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
      pushedByColor: 'brown',
    };
    const siteB: ImpactSite = {
      piece: { color: 'orange', fragility: 'new' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    // Red produces NO event here -- like any other struck piece in a mutual
    // collision, it only gets a real MOVE_STEP once its own onward nextSite is
    // later resolved by resolveChain, not at the meeting point itself.
    expect(result.board.cells[2][4]).toBeNull(); // neither side ever settles at the shared cell
    // Split direction is red's OWN direction (E) -- perpendicular branches N/S,
    // sharing orange's advance('new') = 'cracked' fragility (FR-015 of 009).
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 2, col: 4 }, to: { row: 1, col: 4 }, direction: 'N', hasCollision: false, visualOrigin: { from: { row: 4, col: 4 }, direction: 'N' } },
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 2, col: 4 }, to: { row: 3, col: 4 }, direction: 'S', hasCollision: false, visualOrigin: { from: { row: 4, col: 4 }, direction: 'N' } },
    ]);
    // Red: advance('cracked') = 'broken', pushed onward using orange's own
    // mechanism (PUSH_STRATEGY.orange, a fixed 2-cell jump) in orange's own
    // direction (N) -- (2,4) -> (0,4), board-blind exactly like any other
    // orange push. visualOrigin is red's OWN pre-collision from/direction --
    // it was walking (pushedByColor: 'brown') before reaching this meeting
    // point, so the renderer needs that to draw red's whole journey, not just
    // its post-collision jump.
    expect(result.nextSites).toEqual([
      { piece: { color: 'red', fragility: 'broken' }, direction: 'N', from: { row: 2, col: 4 }, to: { row: 0, col: 4 }, pushedByColor: 'orange', visualOrigin: { from: { row: 2, col: 3 }, direction: 'E' } },
    ]);
  });

  it('red as siteB behaves symmetrically -- same outcome regardless of which slot holds red', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'orange', fragility: 'new' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'red', fragility: 'cracked' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    expect(result.board.cells[2][4]).toBeNull();
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 2, col: 4 }, to: { row: 1, col: 4 }, direction: 'N', hasCollision: false, visualOrigin: { from: { row: 4, col: 4 }, direction: 'N' } },
      { type: 'MOVE_STEP', piece: { color: 'orange', fragility: 'cracked' }, from: { row: 2, col: 4 }, to: { row: 3, col: 4 }, direction: 'S', hasCollision: false, visualOrigin: { from: { row: 4, col: 4 }, direction: 'N' } },
    ]);
    expect(result.nextSites).toEqual([
      { piece: { color: 'red', fragility: 'broken' }, direction: 'N', from: { row: 2, col: 4 }, to: { row: 0, col: 4 }, pushedByColor: 'orange', visualOrigin: { from: { row: 2, col: 3 }, direction: 'E' } },
    ]);
  });

  it('the other side already BROKEN vanishes instead of being split again -- red still continues onward, unaffected', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'red', fragility: 'new' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'orange', fragility: 'broken' }, // already used up its one further hop
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    expect(result.board.cells[2][4]).toBeNull();
    expect(result.events).toEqual([]); // orange vanished silently -- never split, never an event
    expect(result.nextSites).toEqual([
      // Red: advance('new') = 'cracked', still pushed onward via orange's own
      // mechanism -- an already-broken opponent doesn't exempt red either.
      { piece: { color: 'red', fragility: 'cracked' }, direction: 'N', from: { row: 2, col: 4 }, to: { row: 0, col: 4 }, pushedByColor: 'orange', visualOrigin: { from: { row: 2, col: 3 }, direction: 'E' } },
    ]);
  });

  it('both red is still a same-color collision (annihilation), never reaches this branch', () => {
    const board = createBoard();
    const siteA: ImpactSite = {
      piece: { color: 'red', fragility: 'new' },
      direction: 'E',
      from: { row: 2, col: 3 },
      to: { row: 2, col: 4 },
    };
    const siteB: ImpactSite = {
      piece: { color: 'red', fragility: 'new' },
      direction: 'N',
      from: { row: 4, col: 4 },
      to: { row: 2, col: 4 },
    };

    const result = applyMutualImpact(board, siteA, siteB);

    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 2, col: 4 }, color: 'red', from: siteA.from, direction: siteA.direction },
    ]);
    expect(result.nextSites).toEqual([]);
  });

  it('end-to-end via resolveLaunch: the exact crash reproduction no longer throws', () => {
    // Real repro: red splits brown; the E-branch hits a real red already on
    // the board, setting it in motion; the O-branch hits a real orange, also
    // setting it in motion; both walk (brown's own mechanic) and collide.
    const level = createLevel({
      pieces: [
        { at: { row: 0, col: 0 }, color: 'orange' },
        { at: { row: 0, col: 1 }, color: 'brown' },
        { at: { row: 0, col: 2 }, color: 'red' },
      ],
      hand: ['red'],
      goal: { at: { row: 5, col: 5 }, color: 'green' },
    });

    expect(() => resolveLaunch(level, { direction: 'N', lane: 1 })).not.toThrow();
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
    // which just settled at the impact cell. Before 017's own fix, that walk was
    // computed against a pre-settle snapshot, so it couldn't see the striker there
    // and wrapped all the way around, landing past it. Since
    // 021-cellwise-collision-resolution, a brown-driven walk is no longer resolved
    // in a single `applyImpact` call (it advances one tentative cell at a time,
    // `site.walking`) -- driving it to completion via `resolveChain` (the same
    // queue any real launch already uses) is what verifies the full lap still
    // correctly stops the instant it revisits the striker's cell, not a single
    // `applyImpact` call's own `nextSites` (which now only ever reflects one step).
    const board = setPieceAt(createBoard(), { row: 0, col: 0 }, { color: 'orange', fragility: 'new' });
    const striker: Piece = { color: 'brown', fragility: 'new' };

    const result = resolveChain(
      board,
      [{ piece: striker, direction: 'E', from: { row: 0, col: 7 }, to: { row: 0, col: 0 } }],
      applyImpact,
      applyMutualImpact,
    );

    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: striker, from: { row: 0, col: 7 }, to: { row: 0, col: 0 }, direction: 'E', hasCollision: true },
      // The struck defender's own walk revisits (0,0) after a full lap around an
      // otherwise-empty board -- with the striker visible there, it collides and
      // stops AT that cell, rather than crossing a second edge and landing at
      // (0,7) (the bug 017 fixed: a full extra unobstructed lap past its own striker).
      {
        type: 'MOVE_STEP',
        piece: { color: 'orange', fragility: 'cracked' },
        from: { row: 0, col: 0 },
        to: { row: 0, col: 0 },
        direction: 'E',
        hasCollision: true,
        pushedByColor: 'brown',
      },
      // Orange, now the striker of this next hop, pushes brown onward using its
      // OWN fixed 2-cell mechanism (not brown's variable walk) -- unrelated to
      // 017's own invariant, just the natural next link in the same cascade.
      {
        type: 'MOVE_STEP',
        piece: { color: 'brown', fragility: 'cracked' },
        from: { row: 0, col: 0 },
        to: { row: 0, col: 2 },
        direction: 'E',
        hasCollision: false,
        pushedByColor: 'orange',
      },
    ]);
    expect(result.board.cells[0][0]).toEqual({ color: 'orange', fragility: 'cracked' });
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

describe('applyImpact: a brown-driven displacement is a tentative 1-cell step, not a precomputed final destination (021-cellwise-collision-resolution)', () => {
  it('when the striker is brown, the nextSite is exactly 1 cell away and marked `walking`', () => {
    const board = setPieceAt(createBoard(), { row: 0, col: 1 }, { color: 'green', fragility: 'new' });
    const striker: Piece = { color: 'brown', fragility: 'new' };

    const result = applyImpact(board, { piece: striker, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });

    expect(result.nextSites).toEqual([
      {
        piece: { color: 'green', fragility: 'cracked' },
        direction: 'E',
        from: { row: 0, col: 1 },
        to: { row: 0, col: 2 }, // 1 cell, not a full stepUntilBlocked walk
        pushedByColor: 'brown',
        walking: { edgeCrossings: 0 },
      },
    ]);
  });

  it('when the striker is green or orange, the nextSite is still the fully-precomputed final destination -- unaffected', () => {
    const board = setPieceAt(createBoard(), { row: 0, col: 1 }, { color: 'green', fragility: 'new' });
    const striker: Piece = { color: 'orange', fragility: 'new' };

    const result = applyImpact(board, { piece: striker, direction: 'E', from: { row: 0, col: 0 }, to: { row: 0, col: 1 } });

    expect(result.nextSites).toEqual([
      {
        piece: { color: 'green', fragility: 'cracked' },
        direction: 'E',
        from: { row: 0, col: 1 },
        to: { row: 0, col: 3 }, // orange's own fixed 2-cell distance, unchanged
        pushedByColor: 'orange',
      },
    ]);
  });

  it('a walking site landing on an empty cell takes one more step instead of settling, producing no event yet', () => {
    const board = createBoard();
    const walkingSite: ImpactSite = {
      piece: { color: 'green', fragility: 'cracked' },
      direction: 'E',
      from: { row: 0, col: 1 },
      to: { row: 0, col: 2 },
      pushedByColor: 'brown',
      walking: { edgeCrossings: 0 },
    };

    const result = applyImpact(board, walkingSite);

    expect(result.events).toEqual([]);
    expect(result.board).toEqual(board); // untouched -- still in flight
    expect(result.nextSites).toEqual([
      { ...walkingSite, to: { row: 0, col: 3 } }, // one cell further, from stays fixed
    ]);
  });

  it('a walking site settles at its current cell (not the new one) once MAX_EDGE_CROSSINGS is reached, matching stepUntilBlocked\'s own cap', () => {
    const board = createBoard();
    const walkingSite: ImpactSite = {
      piece: { color: 'green', fragility: 'cracked' },
      direction: 'E',
      from: { row: 0, col: 5 },
      to: { row: 0, col: 7 },
      pushedByColor: 'brown',
      walking: { edgeCrossings: 1 }, // already crossed once
    };

    const result = applyImpact(board, walkingSite);

    // One more step from (0,7) heading E crosses the edge a SECOND time --
    // capped, so it settles at (0,7) (where it already was), not the new
    // wrapped cell.
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: walkingSite.piece, from: { row: 0, col: 5 }, to: { row: 0, col: 7 }, direction: 'E', hasCollision: false, pushedByColor: 'brown' },
    ]);
    expect(result.board.cells[0][7]).toEqual(walkingSite.piece);
    expect(result.nextSites).toEqual([]);
  });
});
