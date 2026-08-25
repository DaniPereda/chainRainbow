import { describe, expect, it } from 'vitest';
import { createLevel } from '../../../src/engine/index.js';
import {
  applySessionLaunch,
  restartSession,
  selectHandPiece,
  startSession,
} from '../../../src/engine/session.js';

const WINNABLE_LEVEL = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'orange' }],
  hand: ['green'],
  goal: { at: { row: 4, col: 5 }, color: 'orange' },
});

const LOSABLE_LEVEL = createLevel({
  pieces: [{ at: { row: 0, col: 3 }, color: 'orange' }],
  hand: ['green'],
  goal: { at: { row: 0, col: 0 }, color: 'orange' }, // unreachable by this launch
});

// data-model.md fixtures 3, 5-9 (010-hand-piece-selection): a two-piece hand where the second
// piece's push distance (orange, 2) is observably different from the first's (green, 1) -- lets
// every selection test prove WHICH piece actually fired, not just that something did.
const TWO_PIECE_LEVEL = createLevel({
  pieces: [{ at: { row: 2, col: 2 }, color: 'brown' }],
  hand: ['green', 'orange'],
  goal: { at: { row: 2, col: 6 }, color: 'brown' },
});

describe('LevelSession: tracks a play-through of a level across launches', () => {
  it('starts undetermined at the level\'s initial state', () => {
    const session = startSession(WINNABLE_LEVEL);

    expect(session.status).toBe('undetermined');
    expect(session.current).toEqual(WINNABLE_LEVEL);
    expect(session.initial).toEqual(WINNABLE_LEVEL);
  });

  it('a launch that reaches the goal moves the session to won', () => {
    const session = startSession(WINNABLE_LEVEL);

    const { session: after, outcome } = applySessionLaunch(session, { direction: 'E', lane: 4 });

    expect(outcome.result).toBe('won');
    expect(after.status).toBe('won');
    expect(after.current.board.cells[4][5]).toEqual({ color: 'orange', fragility: 'new' });
  });

  it('a missclick leaves the current state unchanged and the session undetermined', () => {
    const session = startSession(WINNABLE_LEVEL);

    const { session: after, outcome } = applySessionLaunch(session, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(after.status).toBe('undetermined');
    expect(after.current).toEqual(session.current);
  });

  it('emptying the hand without reaching the goal moves the session to lost', () => {
    const session = startSession(LOSABLE_LEVEL);

    const { session: after, outcome } = applySessionLaunch(session, { direction: 'E', lane: 0 });

    expect(outcome.result).toBe('lost');
    expect(after.status).toBe('lost');
    expect(after.current.hand.pieces).toHaveLength(0);
  });

  it('restartSession reproduces the initial level exactly, discarding all progress', () => {
    const session = startSession(WINNABLE_LEVEL);
    const { session: played } = applySessionLaunch(session, { direction: 'E', lane: 4 });

    const restarted = restartSession(played);

    expect(restarted.status).toBe('undetermined');
    expect(restarted.current).toEqual(WINNABLE_LEVEL);
    expect(restarted.initial).toEqual(WINNABLE_LEVEL);
  });
});

// data-model.md fixtures 1-2 (010-hand-piece-selection): selectHandPiece is a pure function,
// tested in isolation from any launch -- it only ever changes which index is marked, nothing
// else about the session.
describe('selectHandPiece: marks any valid hand position as the one to launch next (FR-001)', () => {
  it('changes selectedHandIndex to any valid position in the current hand', () => {
    const session = startSession(TWO_PIECE_LEVEL);
    expect(session.selectedHandIndex).toBe(0);

    const selected = selectHandPiece(session, 1);

    expect(selected.selectedHandIndex).toBe(1);
    expect(selected.current).toEqual(session.current);
    expect(selected.status).toBe(session.status);
  });

  it('is a no-op when the index does not exist in the current hand', () => {
    const session = startSession(TWO_PIECE_LEVEL);

    const selected = selectHandPiece(session, 5);

    expect(selected).toEqual(session);
  });

  // data-model.md fixture 5: applySessionLaunch propagates the session's own
  // selection automatically -- the caller never has to pass a pieceIndex by hand.
  it('applySessionLaunch resolves using the piece selected via selectHandPiece', () => {
    const session = selectHandPiece(startSession(TWO_PIECE_LEVEL), 1);

    const { session: after } = applySessionLaunch(session, { direction: 'E', lane: 2 });

    expect(after.current.board.cells[2][2]).toBeNull();
    expect(after.current.board.cells[2][4]).toEqual({ color: 'brown', fragility: 'new' });
    expect(after.current.hand.pieces).toEqual([{ color: 'green', fragility: 'new' }]);
  });
});

// data-model.md fixtures 6-9: the selection lifecycle rules (advance, preserve on missclick,
// null on empty hand, reset on restart) are already fully implemented as part of
// applySessionLaunch/restartSession above -- this is pure verification, no new production code
// (same pattern as features 007/008/009's later-priority user stories).
describe('LevelSession selection lifecycle: stays coherent across launches (FR-006/FR-007/FR-008)', () => {
  it('advances the selection to the first remaining piece after consuming the selected one (US3 AC1)', () => {
    const session = selectHandPiece(startSession(TWO_PIECE_LEVEL), 1);

    const { session: after } = applySessionLaunch(session, { direction: 'E', lane: 2 });

    expect(after.current.hand.pieces).toEqual([{ color: 'green', fragility: 'new' }]);
    expect(after.selectedHandIndex).toBe(0);
  });

  it('leaves the selection untouched by a missclick (US3 AC2)', () => {
    const session = selectHandPiece(startSession(TWO_PIECE_LEVEL), 1);

    const { session: after, outcome } = applySessionLaunch(session, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(after.current.hand).toEqual(session.current.hand);
    expect(after.selectedHandIndex).toBe(1);
  });

  it('leaves the selection at null once the hand becomes empty (US3 AC3)', () => {
    const session = startSession(WINNABLE_LEVEL); // single-piece hand
    expect(session.selectedHandIndex).toBe(0);

    const { session: after } = applySessionLaunch(session, { direction: 'E', lane: 4 });

    expect(after.current.hand.pieces).toHaveLength(0);
    expect(after.selectedHandIndex).toBeNull();
  });

  it('restartSession resets the selection exactly like startSession(initial) would (edge case)', () => {
    const played = selectHandPiece(startSession(TWO_PIECE_LEVEL), 1);
    const { session: afterLaunch } = applySessionLaunch(played, { direction: 'E', lane: 2 });
    expect(afterLaunch.selectedHandIndex).toBe(0); // sanity: fixture 6's state

    const restarted = restartSession(afterLaunch);

    expect(restarted.current.hand.pieces).toEqual([{ color: 'green', fragility: 'new' }, { color: 'orange', fragility: 'new' }]);
    expect(restarted.selectedHandIndex).toBe(0);
  });
});
