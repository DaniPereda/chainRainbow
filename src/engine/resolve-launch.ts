import type { Board, Coordinate, PieceColor } from './board.js';
import { opposite, step } from './move-step.js';
import { entryCoordinate, takePieceAt, travelLaunch, type Hand, type Launch } from './launch.js';
import { resolveChain, type EventLog, type ImpactResolution, type ImpactSite } from './events.js';
import { applyImpact, applyMutualImpact, withEventPrefix } from './pieces/push.js';
import { resolvePurpleLaunch } from './pieces/purple.js';
import { evaluateGoal, type LevelResult } from './goal.js';
import type { Level } from './level.js';

/**
 * A launch's resolution paused mid-chain, waiting for the player to pick a
 * color (024-rainbow-color-change, research.md Decisión 1) -- `resume`
 * continues the SAME chain from exactly where it paused, possibly pausing
 * again (another arcoíris interaction further down the same chain) before
 * finally producing a `LaunchOutcome` with no `pendingColorChoice` at all.
 */
export type PendingColorChoice = {
  at: Coordinate;
  options: PieceColor[];
  resume: (color: PieceColor) => LaunchOutcome;
};

export type LaunchOutcome = {
  board: Board;
  hand: Hand;
  events: EventLog;
  missclick: boolean;
  result: LevelResult;
  // Present only while this launch's chain is paused on an arcoíris impact --
  // absent for every launch that never touches arcoíris (data-model.md).
  // `board`/`events` above still reflect progress SO FAR, not the final
  // outcome; `missclick`/`result` are not meaningful yet and must not be
  // acted on while this is set (FR-005).
  pendingColorChoice?: PendingColorChoice;
};

/**
 * Wraps a `resolveChain`/`ImpactResolution` result as this launch's own
 * `LaunchOutcome`, finishing it (taking the piece out of hand, evaluating the
 * goal) once it's genuinely `'resolved'`, or exposing the pause as
 * `pendingColorChoice` with a `resume` that re-enters this same function
 * (024-rainbow-color-change, research.md Decisión 1/6).
 */
function toLaunchOutcome(level: Level, pieceIndex: number, resolution: ImpactResolution): LaunchOutcome {
  if (resolution.status === 'pending-color-choice') {
    return {
      board: resolution.board,
      hand: level.hand,
      events: resolution.events,
      missclick: false,
      result: evaluateGoal(resolution.board, level.hand, level.goal),
      pendingColorChoice: {
        at: resolution.at,
        options: resolution.options,
        resume: (color) => toLaunchOutcome(level, pieceIndex, resolution.resume(color)),
      },
    };
  }

  const { hand: finalHand } = takePieceAt(level.hand, pieceIndex);
  return {
    board: resolution.board,
    hand: finalHand,
    events: resolution.events,
    missclick: false,
    result: evaluateGoal(resolution.board, finalHand, level.goal),
  };
}

/**
 * A missclick `LaunchOutcome` -- the level's own board/hand, completely
 * untouched (spec.md 006: this launch never got to settle anywhere, before or
 * after this feature). Shared by `travelLaunch`'s own classic case (nothing
 * anywhere in the lane) and púrpura's own (025-purple-attraction-piece,
 * research.md Decisión 1: blocked by a real piece, or never finding a
 * qualifying cell) -- same shape either way, only the reason differs.
 */
function missclickOutcome(level: Level): LaunchOutcome {
  return {
    board: level.board,
    hand: level.hand,
    events: [],
    missclick: true,
    result: evaluateGoal(level.board, level.hand, level.goal),
  };
}

/**
 * Púrpura's own launch never enters `travelLaunch`/`applyImpact` (research.md
 * Decisión 1) -- it has no mechanic of its own against a real defender
 * (spec.md FR-007), so a "first impact" in the usual sense never applies to
 * it. `resolvePurpleLaunch` does its own bounded, non-wrapping scan and, on
 * success, returns the board with both attracted pieces already vacated plus
 * the two `attracting` sites for `resolveChain` to converge -- the ANNIHILATION
 * marking púrpura's own travel-and-disappearance (research.md Decisión 3) is
 * prepended via `withEventPrefix`, the same helper red's split already reuses
 * for exactly this "events before the chain even starts" shape.
 */
function resolvePurpleOutcome(level: Level, launch: Launch, pieceIndex: number): LaunchOutcome {
  const entry = entryCoordinate(launch.direction, launch.lane);
  const purpleResult = resolvePurpleLaunch(level.board, entry, launch.direction);

  if (purpleResult.status === 'missclick') {
    return missclickOutcome(level);
  }

  const resolution = resolveChain(purpleResult.board, purpleResult.sites, applyImpact, applyMutualImpact);
  return toLaunchOutcome(level, pieceIndex, withEventPrefix([purpleResult.annihilation], resolution));
}

export function resolveLaunch(
  level: Level,
  launch: Launch,
  pieceIndex: number = 0,
): LaunchOutcome {
  const piece = level.hand.pieces[pieceIndex];

  if (piece.color === 'purple') {
    return resolvePurpleOutcome(level, launch, pieceIndex);
  }

  const travel = travelLaunch(level.board, launch);

  if (travel.hitAt === null) {
    return missclickOutcome(level);
  }

  const initialSite: ImpactSite = {
    piece,
    direction: launch.direction,
    from: step(travel.hitAt, opposite(launch.direction)),
    to: travel.hitAt,
  };

  const resolution = resolveChain(level.board, [initialSite], applyImpact, applyMutualImpact);
  return toLaunchOutcome(level, pieceIndex, resolution);
}
