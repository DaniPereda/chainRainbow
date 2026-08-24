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
    expect(after.current.board.cells[4][5]).toEqual({ color: 'orange' });
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
  const TWO_PIECE_LEVEL = createLevel({
    pieces: [{ at: { row: 2, col: 2 }, color: 'brown' }],
    hand: ['green', 'orange'],
    goal: { at: { row: 2, col: 6 }, color: 'brown' },
  });

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
    expect(after.current.board.cells[2][4]).toEqual({ color: 'brown' });
    expect(after.current.hand.pieces).toEqual([{ color: 'green' }]);
  });
});
