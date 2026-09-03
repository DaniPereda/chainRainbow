import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch, type ChainEvent, type MoveStepEvent } from '../../../src/engine/index.js';
import {
  cellPath,
  computeEventParents,
  isRedSplitTrigger,
  jumpMidpoint,
  orangeJumpMidpoint,
  replayEvent,
  isWrapHop,
} from '../../../src/renderer/launch-animation.js';

/** Narrows a real EventLog entry down to MoveStepEvent for these tests -- every
 * fixture below is picked to be one, so a mismatch here is a broken fixture. */
function asMoveStep(event: ChainEvent): MoveStepEvent {
  if (event.type !== 'MOVE_STEP') throw new Error('expected a MOVE_STEP event');
  return event;
}

describe('jumpMidpoint: detects a straight, exactly-2-cell displacement (orange\'s own push distance)', () => {
  it('returns the cell in between for a horizontal 2-cell push', () => {
    expect(jumpMidpoint({ row: 2, col: 3 }, { row: 2, col: 5 }, 8)).toEqual({ row: 2, col: 4 });
  });

  it('returns the cell in between for a vertical 2-cell push', () => {
    expect(jumpMidpoint({ row: 5, col: 1 }, { row: 3, col: 1 }, 8)).toEqual({ row: 4, col: 1 });
  });

  it('follows the short way around the wrap, not the long way', () => {
    // col 7 -> col 1 is +2 through the wrap (7->0->1), not -6 the other way.
    expect(jumpMidpoint({ row: 0, col: 7 }, { row: 0, col: 1 }, 8)).toEqual({ row: 0, col: 0 });
  });

  it('returns null for a 1-cell push (green) or any other distance', () => {
    expect(jumpMidpoint({ row: 2, col: 3 }, { row: 2, col: 4 }, 8)).toBeNull();
    expect(jumpMidpoint({ row: 2, col: 3 }, { row: 2, col: 6 }, 8)).toBeNull();
  });

  it('returns null when from/to are not aligned on a single row or column', () => {
    expect(jumpMidpoint({ row: 2, col: 3 }, { row: 3, col: 5 }, 8)).toBeNull();
  });
});

describe('replayEvent: applies one ChainEvent to a Board with the same write semantics as the engine', () => {
  it('a normal MOVE_STEP places the piece at the destination, without touching `from`', () => {
    // `from` is documentary (where this piece arrived from), never an
    // instruction to vacate a cell -- settleOrVanish (src/engine/pieces/push.ts)
    // never writes it either. A cell that genuinely needs to end up empty gets
    // there via ANNIHILATION, or is simply never occupied to begin with.
    const board = setPieceAt(createBoard(), { row: 0, col: 0 }, { color: 'green', fragility: 'new' });
    const piece = { color: 'green' as const, fragility: 'cracked' as const };

    const result = replayEvent(board, {
      type: 'MOVE_STEP',
      piece,
      from: { row: 0, col: 0 },
      to: { row: 0, col: 1 },
      direction: 'E',
      hasCollision: true,
    });

    expect(result.cells[0][0]).toEqual({ color: 'green', fragility: 'new' }); // untouched by this event
    expect(result.cells[0][1]).toEqual(piece);
  });

  it('a MOVE_STEP whose piece is BROKEN never settles at the destination, and leaves everything else untouched', () => {
    const board = setPieceAt(createBoard(), { row: 2, col: 2 }, { color: 'brown', fragility: 'broken' });

    const result = replayEvent(board, {
      type: 'MOVE_STEP',
      piece: { color: 'brown', fragility: 'broken' },
      from: { row: 2, col: 2 },
      to: { row: 2, col: 5 },
      direction: 'E',
      hasCollision: false,
    });

    expect(result.cells[2][2]).toEqual({ color: 'brown', fragility: 'broken' }); // untouched by this event
    expect(result.cells[2][5]).toBeNull();
  });

  it('an ANNIHILATION clears its cell', () => {
    const board = setPieceAt(createBoard(), { row: 3, col: 3 }, { color: 'orange', fragility: 'cracked' });

    const result = replayEvent(board, {
      type: 'ANNIHILATION',
      at: { row: 3, col: 3 },
      color: 'orange',
      from: { row: 3, col: 0 },
      direction: 'E',
    });

    expect(result.cells[3][3]).toBeNull();
  });

  it('a MOVE_STEP whose `from` sits just outside the board (a launched piece entering play) still settles normally at `to`', () => {
    // `from` is never read by replayEvent (see the first test's comment) -- an
    // off-board value here (the cell just before a piece enters, per
    // resolve-launch.ts) is exactly as irrelevant as any other `from`.
    const board = createBoard();

    const result = replayEvent(board, {
      type: 'MOVE_STEP',
      piece: { color: 'green', fragility: 'new' },
      from: { row: -1, col: 4 },
      to: { row: 0, col: 4 },
      direction: 'S',
      hasCollision: false,
    });

    expect(result.cells[0][4]).toEqual({ color: 'green', fragility: 'new' });
  });

  it('reducing a full real EventLog over the pre-launch board reproduces resolveLaunch\'s own final board exactly', () => {
    // Same fixture as red.test.ts's "lets a branch push a further piece onward
    // with its own color distance..." -- a real multi-event cascade (red splits,
    // one branch pushes a further piece onward).
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 3 }, color: 'green' },
        { at: { row: 4, col: 4 }, color: 'orange' },
      ],
      hand: ['red'],
      goal: { at: { row: 4, col: 5 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });
    const replayed = outcome.events.reduce(replayEvent, level.board);

    expect(replayed).toEqual(outcome.board);
  });
});

describe('AnnihilationEvent carries from/direction so a same-color collision can be animated travelling, not popping into existence (real bug reported by the user)', () => {
  it('a hand-launched piece hitting a same-color defender records where it travelled from', () => {
    // Exact scenario reported: a green launch whose very first impact is
    // another green -- before this fix, the animation spawned the temp circle
    // directly at the impact cell (or, for a first event, at the board edge
    // with no glide) and just faded it there, never visibly travelling.
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'green' }],
      hand: ['green'],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 4, col: 3 }, color: 'green', from: { row: 4, col: 2 }, direction: 'E' },
    ]);

    // The same cellPath machinery that animates a MOVE_STEP works identically
    // here -- from and at are a real 1-cell displacement, so this reduces to
    // a single-element path exactly like any other short push.
    const annihilation = outcome.events[0];
    if (annihilation.type !== 'ANNIHILATION') throw new Error('expected an ANNIHILATION event');
    expect(cellPath(annihilation.from, annihilation.at, annihilation.direction, 8)).toEqual([{ row: 4, col: 3 }]);
  });

  it('a same-color collision reached after a longer walk records the real starting point, not the impact cell', () => {
    // Brown hits green at (4,2); green (now cracked) travels using BROWN's own
    // stepUntilBlocked mechanic (not its own fixed distance) heading east, and
    // hits a SECOND green sitting at (4,6) -- a real multi-cell walk ending in
    // annihilation. `from` must be (4,2) (where the walk actually started),
    // never `at` again.
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 2 }, color: 'green' },
        { at: { row: 4, col: 6 }, color: 'green' },
      ],
      hand: ['brown'],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.events[1]).toEqual({
      type: 'ANNIHILATION',
      at: { row: 4, col: 6 },
      color: 'green',
      from: { row: 4, col: 2 },
      direction: 'E',
    });
  });
});

describe('isRedSplitTrigger: identifies the exact MOVE_STEP that triggers a red split', () => {
  it('is true for red settling with a real collision -- the event immediately followed by the split\'s own branches', () => {
    // Real event log, verified against resolveLaunch: red hits green at
    // {4,3}, splitting it into a branch heading north and one heading south.
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'green' }],
      hand: ['red'],
      goal: { at: { row: 4, col: 4 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.events[0]).toMatchObject({ type: 'MOVE_STEP', piece: { color: 'red' }, hasCollision: true });
    expect(isRedSplitTrigger(outcome.events[0])).toBe(true);
    // The branches themselves are never red -- never a split trigger either.
    expect(isRedSplitTrigger(outcome.events[1])).toBe(false);
    expect(isRedSplitTrigger(outcome.events[2])).toBe(false);
  });

  it('is false for red settling into empty space -- nothing there to split', () => {
    // Not a hand-launched red here -- a red piece already on the board, pushed
    // by green into an empty cell (hasCollision: false). A launch that finds
    // truly nothing to strike anywhere produces no events at all, so this is
    // the real shape "red settles without splitting" takes in an EventLog.
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'red' }],
      hand: ['green'],
      goal: { at: { row: 4, col: 4 }, color: 'red' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.events).toEqual([
      { type: 'MOVE_STEP', piece: { color: 'green', fragility: 'new' }, from: { row: 4, col: 2 }, to: { row: 4, col: 3 }, direction: 'E', hasCollision: true },
      { type: 'MOVE_STEP', piece: { color: 'red', fragility: 'cracked' }, from: { row: 4, col: 3 }, to: { row: 4, col: 4 }, direction: 'E', hasCollision: false, pushedByColor: 'green' },
    ]);
    expect(isRedSplitTrigger(outcome.events[1])).toBe(false);
  });

  it('is false for a non-red MOVE_STEP with a real collision, and for an ANNIHILATION', () => {
    expect(
      isRedSplitTrigger({
        type: 'MOVE_STEP',
        piece: { color: 'green', fragility: 'new' },
        from: { row: 0, col: 0 },
        to: { row: 0, col: 1 },
        direction: 'E',
        hasCollision: true,
      }),
    ).toBe(false);
    expect(
      isRedSplitTrigger({ type: 'ANNIHILATION', at: { row: 0, col: 0 }, color: 'red', from: { row: 0, col: 3 }, direction: 'O' }),
    ).toBe(false);
  });
});

describe('orangeJumpMidpoint: the orange-jump visual only fires for orange\'s own mechanic, not any 2-cell geometry', () => {
  it('is null when a piece coincidentally travels 2 cells because BROWN pushed it -- the real bug found by playtesting', () => {
    // Real event log: brown enters and hits green at (4,3); green is then
    // displaced using BROWN's own walk mechanic (not green's, not orange's),
    // which happens to travel exactly 2 cells before being blocked by orange
    // at (4,5) -- geometrically identical to an orange push, but caused by
    // brown. Before the fix, jumpMidpoint's pure geometry check couldn't tell
    // the difference and wrongly showed the orange bulge/sound here.
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 3 }, color: 'green' },
        { at: { row: 4, col: 5 }, color: 'orange' },
      ],
      hand: ['brown'],
      goal: { at: { row: 4, col: 4 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });
    const greenEvent = asMoveStep(outcome.events[1]);

    expect(greenEvent).toMatchObject({
      piece: { color: 'green' },
      from: { row: 4, col: 3 },
      to: { row: 4, col: 5 },
      pushedByColor: 'brown',
    });
    // Confirms the geometry alone WOULD say "yes, 2 cells" -- the fix is
    // specifically that pushedByColor overrides that.
    expect(jumpMidpoint(greenEvent.from, greenEvent.to, 8)).toEqual({ row: 4, col: 4 });
    expect(orangeJumpMidpoint(greenEvent, 8)).toBeNull();
  });

  it('is the midpoint when orange\'s own mechanic really did produce the 2-cell push', () => {
    const level = createLevel({
      pieces: [{ at: { row: 0, col: 1 }, color: 'green' }],
      hand: ['orange'],
      goal: { at: { row: 0, col: 3 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });
    const greenEvent = asMoveStep(outcome.events[1]);

    expect(greenEvent).toMatchObject({ piece: { color: 'green' }, pushedByColor: 'orange' });
    expect(orangeJumpMidpoint(greenEvent, 8)).toEqual({ row: 0, col: 2 });
  });

  it('is null for a hand-launched piece\'s own entry, even one that happens to be orange -- pushedByColor is only ever set for a piece someone else displaced', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 5 }, color: 'green' }],
      hand: ['orange'],
      goal: { at: { row: 4, col: 5 }, color: 'orange' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });
    const orangeEvent = asMoveStep(outcome.events[0]);

    expect(orangeEvent).toMatchObject({ piece: { color: 'orange' }, pushedByColor: undefined });
    expect(orangeJumpMidpoint(orangeEvent, 8)).toBeNull();
  });
});

describe('computeEventParents: finds where trajectories really fork, so they can be animated as concurrent siblings (022-parallel-branch-animation)', () => {
  it('is null for the very first event -- nothing in the log arrived where the launch itself enters', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'green' }],
      hand: ['green'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(computeEventParents(outcome.events)[0]).toBeNull();
  });

  it('chains a simple linear push: each event\'s parent is whoever just arrived where it starts', () => {
    // Same fixture as isRedSplitTrigger's own "false for red settling into empty
    // space" test -- green pushes a stationary red one cell onward.
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'red' }],
      hand: ['green'],
      goal: { at: { row: 4, col: 4 }, color: 'red' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.events).toHaveLength(2);
    expect(computeEventParents(outcome.events)).toEqual([null, 0]);
  });

  it('gives both branches of a real red split the SAME parent -- they are siblings, born at the same instant', () => {
    // Same fixture as the "reducing a full real EventLog..." test above: red
    // splits a green at the launch's own impact cell into an east branch (which
    // goes on to push a further orange onward) and a west branch (which settles,
    // unaffected, on an empty cell). Verified against the real engine before
    // being fixed as an expectation here.
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 3 }, color: 'green' },
        { at: { row: 4, col: 4 }, color: 'orange' },
      ],
      hand: ['red'],
      goal: { at: { row: 4, col: 5 }, color: 'orange' },
    });
    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });

    expect(outcome.events).toHaveLength(4);
    const parents = computeEventParents(outcome.events);
    // [0] red settles at the split point (root, no parent).
    // [1] east branch (green) settles at (4,4) -- child of the split itself.
    // [2] west branch (green) settles at (4,2) -- ALSO a child of the split,
    //     the true sibling of [1]: same parent, so playEventLog runs them as
    //     two concurrent lanes instead of one after the other.
    // [3] orange, pushed onward by the east branch's own green push -- a
    //     child of [1] specifically, not of the split or of [2].
    expect(parents).toEqual([null, 0, 0, 1]);
  });

  it('groups a mutual in-flight collision\'s resulting trajectories as siblings, falling back to the immediately preceding event instead of an unconditional second root (real bug reported by the user: pieces near an unrelated part of the board animating from the very first instant of the launch)', () => {
    // A red split into a brown east branch (hits orange, which walks east) and
    // a brown west branch (hits red, which walks west) -- the two walks meet
    // and mutually collide at (4,0), a cell NEITHER of them ever "arrives at"
    // as its own recorded event (a mutual collision is never itself settled,
    // only continued from or split at -- push.ts's `strikeMutualSide`). Since
    // the mutual defender's color is literally 'red', it triggers the SAME
    // split mechanism a real red striker would, so the meeting point produces
    // THREE simultaneous results, not two: the orange side splits into N/S
    // branches, and the red side continues onward using orange's own push
    // mechanism. Verified against the real engine before being fixed as an
    // expectation here.
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 4 }, color: 'brown' },
        { at: { row: 4, col: 5 }, color: 'orange' },
        { at: { row: 4, col: 3 }, color: 'red' },
      ],
      hand: ['red'],
      goal: { at: { row: 0, col: 0 }, color: 'orange' },
    });
    const outcome = resolveLaunch(level, { direction: 'S', lane: 4 });

    expect(outcome.events).toHaveLength(6);
    const parents = computeEventParents(outcome.events);
    // [0] red settles at the split point (root, no parent).
    // [1]/[2] brown's east/west branches -- real siblings of [0], per the
    //     `to`-match rule (unaffected by this fix).
    // [3]/[4]/[5] orange-N, orange-S, red -- all share `from: (4,0)`, the
    //     mutual collision's own meeting point, which nothing before them
    //     ever recorded arriving at. All three must share the SAME parent
    //     (siblings, not one waiting on another), falling back to [2] -- the
    //     last event actually recorded before this group -- rather than any
    //     of them becoming a second, unconditional root.
    expect(parents).toEqual([null, 0, 0, 2, 2, 2]);
  });

  it('collapses a whole run of unrelated orphans (a line clear\'s many swept cells, 023-black-piece-line-clear) into ONE shared-parent sibling group instead of chaining each one onto the last (real bug found live: four unrelated pieces removed by the same clear animated one after another, each waiting for the previous one, instead of together)', () => {
    // Negro launched east hits the first piece in its row (green at col 1) and
    // clears the whole row: three swept ANNIHILATIONs (green, orange, brown --
    // none of them share a `from` with each other, since each is `from === at`,
    // its own real position -- no fabricated travel, data-model.md Decisión 1)
    // plus the triggering black's own ANNIHILATION. Unlike a red split or a
    // mutual collision, NONE of these four share a `from` with one another, so
    // the `from`-grouping above can't catch them as siblings on its own -- this
    // is exactly the case the orphan-run collapsing exists for.
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 1 }, color: 'green' },
        { at: { row: 4, col: 5 }, color: 'orange' },
        { at: { row: 4, col: 6 }, color: 'brown' },
      ],
      hand: ['black'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.events).toHaveLength(4);
    const parents = computeEventParents(outcome.events);
    // All four are roots -- none of them causally depends on any of the
    // others finishing first, so `playEventLog` starts them all at the same
    // instant (its own `roots` loop), matching how the engine actually
    // resolves a line clear: one atomic sweep, not a sequence.
    expect(parents).toEqual([null, null, null, null]);
  });
});

describe('isWrapHop: detects a single step that crosses the board edge', () => {
  it('is false for a literal neighboring cell', () => {
    expect(isWrapHop({ row: 2, col: 3 }, { row: 2, col: 4 })).toBe(false);
    expect(isWrapHop({ row: 2, col: 3 }, { row: 3, col: 3 })).toBe(false);
  });

  it('is true when the step crosses the edge', () => {
    expect(isWrapHop({ row: 2, col: 7 }, { row: 2, col: 0 })).toBe(true);
    expect(isWrapHop({ row: 7, col: 2 }, { row: 0, col: 2 })).toBe(true);
  });
});

describe('cellPath: reconstructs every intermediate cell of a real multi-cell move, one step per cell', () => {
  it('matches a real brown walk that crosses the edge and collides with its own already-settled striker after a full lap', () => {
    // Real event log (016/017's own guarantee: a real striker always gets
    // revisited by its struck defender's own unobstructed walk after exactly
    // one full 8-cell lap): brown hits green at (4,6); green, pushed by
    // brown's own mechanic, walks east, wraps around the board once, and
    // collides with brown's own settled cell back at (4,6) -- from and to are
    // the SAME coordinate despite 8 real cells having been walked.
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 6 }, color: 'green' }],
      hand: ['brown'],
      goal: { at: { row: 4, col: 2 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });
    const greenEvent = asMoveStep(outcome.events[1]);

    expect(greenEvent).toMatchObject({
      piece: { color: 'green' },
      from: { row: 4, col: 6 },
      to: { row: 4, col: 6 },
      direction: 'E',
      pushedByColor: 'brown',
    });

    // The real bug this fixes: from === to here (a zero-net-displacement full
    // lap) makes it impossible to recover a direction from geometry alone --
    // greenEvent.direction (carried by the engine itself, not inferred) is
    // what makes this correct instead of silently defaulting to some guess.
    const path = cellPath(greenEvent.from, greenEvent.to, greenEvent.direction, 8);

    expect(path).toEqual([
      { row: 4, col: 7 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
      { row: 4, col: 5 },
      { row: 4, col: 6 },
    ]);
    // Exactly one hop in the whole path crosses the edge.
    const wrapHops = path.filter((cell, i) => {
      const from = i === 0 ? greenEvent.from : path[i - 1];
      return isWrapHop(from, cell);
    });
    expect(wrapHops).toEqual([{ row: 4, col: 0 }]);
  });

  it('is a single-element path for a plain 1-cell push -- identical to the old single-tween behavior', () => {
    expect(cellPath({ row: 2, col: 3 }, { row: 2, col: 4 }, 'E', 8)).toEqual([{ row: 2, col: 4 }]);
  });

  it('walks NORTH for a full-lap self-collision from a launch fired north -- the real bug reported by the user (it always animated east, regardless of launch direction)', () => {
    // Same shape as the east-launch fixture above (a real striker always gets
    // revisited by its own struck defender's walk after one full lap -- from
    // === to either way), but launched NORTH this time. Before MoveStepEvent
    // carried its own `direction`, this from/to pair was geometrically
    // indistinguishable from the east case (zero net displacement either way),
    // and the code guessed 'E' unconditionally -- animating every such
    // collision eastward no matter which way the piece actually launched.
    const level = createLevel({
      pieces: [{ at: { row: 6, col: 4 }, color: 'green' }],
      hand: ['brown'],
      goal: { at: { row: 2, col: 4 }, color: 'green' },
    });
    const outcome = resolveLaunch(level, { direction: 'N', lane: 4 });
    const greenEvent = asMoveStep(outcome.events[1]);

    expect(greenEvent).toMatchObject({
      piece: { color: 'green' },
      from: { row: 6, col: 4 },
      to: { row: 6, col: 4 },
      direction: 'N',
      pushedByColor: 'brown',
    });

    const path = cellPath(greenEvent.from, greenEvent.to, greenEvent.direction, 8);

    expect(path).toEqual([
      { row: 5, col: 4 },
      { row: 4, col: 4 },
      { row: 3, col: 4 },
      { row: 2, col: 4 },
      { row: 1, col: 4 },
      { row: 0, col: 4 },
      { row: 7, col: 4 },
      { row: 6, col: 4 },
    ]);
  });
});
