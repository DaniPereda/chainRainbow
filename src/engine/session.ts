import type { Launch } from './launch.js';
import type { Level } from './level.js';
import type { LevelResult } from './goal.js';
import { resolveLaunch, type LaunchOutcome } from './resolve-launch.js';

/**
 * Tracks a play-through of a `Level` across successive launches: the initial
 * definition (never mutated), the current state, whether the level has resolved
 * yet, and which hand piece is currently marked to be used on the next launch.
 * Pure and headless -- no dependency on rendering (Principle I) -- so it's
 * testable exactly like the rest of the engine. `selectedHandIndex` is `null`
 * only when the hand is empty; otherwise it always points at a real piece.
 */
export type LevelSession = {
  initial: Level;
  current: Level;
  status: LevelResult;
  selectedHandIndex: number | null;
};

function firstHandIndex(hand: Level['hand']): number | null {
  return hand.pieces.length > 0 ? 0 : null;
}

export function startSession(level: Level): LevelSession {
  return {
    initial: level,
    current: level,
    status: 'undetermined',
    selectedHandIndex: firstHandIndex(level.hand),
  };
}

/**
 * Marks `index` as the piece to use on the next launch (010-hand-piece-selection,
 * FR-001). A no-op if `index` isn't a real position in the current hand -- the
 * renderer never taps a stale slot, but this stays defensive rather than throwing.
 */
export function selectHandPiece(session: LevelSession, index: number): LevelSession {
  if (index < 0 || index >= session.current.hand.pieces.length) {
    return session;
  }
  return { ...session, selectedHandIndex: index };
}

export function applySessionLaunch(
  session: LevelSession,
  launch: Launch,
): { session: LevelSession; outcome: LaunchOutcome } {
  const outcome = resolveLaunch(session.current, launch, session.selectedHandIndex ?? 0);
  const current: Level = {
    board: outcome.board,
    hand: outcome.hand,
    goal: session.current.goal,
  };
  // A missclick never changes the hand, so the current selection still points at
  // the same real piece -- nothing to do (FR-007). Otherwise the just-launched
  // piece is gone; the selection advances to the first of whatever remains, or to
  // no selection at all if the hand is now empty (FR-006/FR-008).
  const selectedHandIndex = outcome.missclick
    ? session.selectedHandIndex
    : firstHandIndex(current.hand);
  return {
    session: { ...session, current, status: outcome.result, selectedHandIndex },
    outcome,
  };
}

export function restartSession(session: LevelSession): LevelSession {
  return startSession(session.initial);
}
