import type { Board, Coordinate, PieceColor } from './board.js';
import { getPieceAt } from './board.js';
import type { Hand } from './launch.js';

export type Goal = { targetColor: PieceColor; targetCell: Coordinate };

export type LevelResult = 'won' | 'lost' | 'undetermined';

export function evaluateGoal(board: Board, hand: Hand, goal: Goal): LevelResult {
  const piece = getPieceAt(board, goal.targetCell);
  if (piece !== null && piece.color === goal.targetColor) {
    return 'won';
  }
  return hand.pieces.length === 0 ? 'lost' : 'undetermined';
}
