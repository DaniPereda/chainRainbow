import type { Board } from './board.js';
import { opposite, step } from './move-step.js';
import { takeFirstPiece, travelLaunch, type Hand, type Launch } from './launch.js';
import { resolveChain, type EventLog, type ImpactSite } from './events.js';
import { applyGreenImpact } from './pieces/green.js';
import { evaluateObjective, type LevelResult } from './objective.js';
import type { Level } from './level.js';

export type { Coordinate, PieceColor, Piece, Board } from './board.js';
export type { Direction } from './move-step.js';
export type { Hand, Launch } from './launch.js';
export type { MoveStepEvent, EventLog } from './events.js';
export type { Objective, LevelResult } from './objective.js';
export type { Level } from './level.js';
export { testLevelGreen01 } from './level.js';

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
      result: evaluateObjective(level.board, level.hand, level.objective),
    };
  }

  const piece = level.hand.pieces[0];
  const initialSite: ImpactSite = {
    piece,
    direction: launch.direction,
    from: step(travel.hitAt, opposite(launch.direction)),
    to: travel.hitAt,
  };

  const { board: finalBoard, events } = resolveChain(level.board, initialSite, applyGreenImpact);
  const { hand: finalHand } = takeFirstPiece(level.hand);

  return {
    board: finalBoard,
    hand: finalHand,
    events,
    missclick: false,
    result: evaluateObjective(finalBoard, finalHand, level.objective),
  };
}
