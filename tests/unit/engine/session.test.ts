import { describe, expect, it } from 'vitest';
import { createLevel } from '../../../src/engine/index.js';
import { applySessionLaunch, restartSession, startSession } from '../../../src/engine/session.js';

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
