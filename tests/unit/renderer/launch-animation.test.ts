import { describe, expect, it } from 'vitest';
import { createBoard, setPieceAt } from '../../../src/engine/board.js';
import { createLevel, resolveLaunch, type ChainEvent, type MoveStepEvent } from '../../../src/engine/index.js';
import { isRedSplitTrigger, jumpMidpoint, orangeJumpMidpoint, replayEvent } from '../../../src/renderer/launch-animation.js';

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
      hasCollision: false,
    });

    expect(result.cells[2][2]).toEqual({ color: 'brown', fragility: 'broken' }); // untouched by this event
    expect(result.cells[2][5]).toBeNull();
  });

  it('an ANNIHILATION clears its cell', () => {
    const board = setPieceAt(createBoard(), { row: 3, col: 3 }, { color: 'orange', fragility: 'cracked' });

    const result = replayEvent(board, { type: 'ANNIHILATION', at: { row: 3, col: 3 }, color: 'orange' });

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
      { type: 'MOVE_STEP', piece: { color: 'green', fragility: 'new' }, from: { row: 4, col: 2 }, to: { row: 4, col: 3 }, hasCollision: true },
      { type: 'MOVE_STEP', piece: { color: 'red', fragility: 'cracked' }, from: { row: 4, col: 3 }, to: { row: 4, col: 4 }, hasCollision: false, pushedByColor: 'green' },
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
        hasCollision: true,
      }),
    ).toBe(false);
    expect(isRedSplitTrigger({ type: 'ANNIHILATION', at: { row: 0, col: 0 }, color: 'red' })).toBe(false);
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
