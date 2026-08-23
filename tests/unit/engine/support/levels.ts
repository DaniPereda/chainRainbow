import type { Coordinate, Level } from '../../../../src/engine/index.js';
import { createBoard, setPieceAt } from '../../../../src/engine/board.js';

/**
 * A single green piece sits in the very first cell a launch from `{ direction: 'E',
 * lane: 2 }` would reach — proves a collision right at the board edge still counts
 * as an interaction, not a missclick (spec.md 001 -> Edge Cases).
 */
export function levelWithPieceAtBoardEdge(): Level {
  const board = setPieceAt(createBoard(), { row: 2, col: 0 }, { color: 'green' });
  return {
    board,
    hand: { pieces: [{ color: 'green' }] },
    objective: { targetColor: 'green', targetCell: { row: 2, col: 1 } },
  };
}

/**
 * Same level, with its objective moved to a cell the launch can never reach —
 * used to exercise the "lost" path without needing a whole second fixture.
 */
export function withUnreachableObjective(level: Level, targetCell: Coordinate): Level {
  return {
    ...level,
    objective: { ...level.objective, targetCell },
  };
}

/**
 * Three pieces in line, colors chosen so a cascade must cross a color boundary: an
 * orange launcher (push distance 2) hits a green piece, which then hits an orange
 * piece and must push IT by green's distance (1) -- not orange's (2), and not its
 * own color's. See research.md 002 -> Decisión 2 (corrección 2026-08-23).
 */
export function levelWithMixedColorCascade(): Level {
  const board = setPieceAt(
    setPieceAt(createBoard(), { row: 5, col: 4 }, { color: 'green' }),
    { row: 5, col: 6 },
    { color: 'orange' },
  );
  return {
    board,
    hand: { pieces: [{ color: 'orange' }] },
    objective: { targetColor: 'green', targetCell: { row: 0, col: 0 } },
  };
}
