import type { Launch } from './launch.js';
import type { Level } from './level.js';
import type { LevelResult } from './objective.js';
import { resolveLaunch, type LaunchOutcome } from './resolve-launch.js';

/**
 * Tracks a play-through of a `Level` across successive launches: the initial
 * definition (never mutated), the current state, and whether the level has
 * resolved yet. Pure and headless -- no dependency on rendering (Principle I) --
 * so it's testable exactly like the rest of the engine.
 */
export type LevelSession = {
  initial: Level;
  current: Level;
  status: LevelResult;
};

export function startSession(level: Level): LevelSession {
  return { initial: level, current: level, status: 'undetermined' };
}

export function applySessionLaunch(
  session: LevelSession,
  launch: Launch,
): { session: LevelSession; outcome: LaunchOutcome } {
  const outcome = resolveLaunch(session.current, launch);
  const current: Level = {
    board: outcome.board,
    hand: outcome.hand,
    objective: session.current.objective,
  };
  return { session: { ...session, current, status: outcome.result }, outcome };
}

export function restartSession(session: LevelSession): LevelSession {
  return startSession(session.initial);
}
