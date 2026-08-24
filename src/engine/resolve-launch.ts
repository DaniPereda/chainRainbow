import type { Board } from './board.js';
import { opposite, step } from './move-step.js';
import { takeFirstPiece, travelLaunch, type Hand, type Launch } from './launch.js';
import { resolveChain, type EventLog, type ImpactSite } from './events.js';
import { applyImpact } from './pieces/push.js';
import { evaluateGoal, type LevelResult } from './goal.js';
import type { Level } from './level.js';

export type LaunchOutcome = {
  board: Board;
  hand: Hand;
  events: EventLog;
  missclick: boolean;
  result: LevelResult;
};

export function resolveLaunch(level: Level, launch: Launch): LaunchOutcome {
  const travel = travelLaunch(level.board, launch);

  if (travel.hitAt === null) {
    return {
      board: level.board,
      hand: level.hand,
      events: [],
      missclick: true,
      result: evaluateGoal(level.board, level.hand, level.goal),
    };
  }

  const piece = level.hand.pieces[0];
  const initialSite: ImpactSite = {
    piece,
    direction: launch.direction,
    from: step(travel.hitAt, opposite(launch.direction)),
    to: travel.hitAt,
  };

  const { board: finalBoard, events } = resolveChain(level.board, initialSite, applyImpact);
  const { hand: finalHand } = takeFirstPiece(level.hand);

  return {
    board: finalBoard,
    hand: finalHand,
    events,
    missclick: false,
    result: evaluateGoal(finalBoard, finalHand, level.goal),
  };
}
