import type { Board, Coordinate, PieceColor } from './board.js';
import { getPieceAt } from './board.js';
import type { Hand } from './launch.js';

export type Objective = { targetColor: PieceColor; targetCell: Coordinate };

export type LevelResult = 'won' | 'lost' | 'undetermined';

export function evaluateObjective(board: Board, hand: Hand, objective: Objective): LevelResult {
  const piece = getPieceAt(board, objective.targetCell);
  if (piece !== null && piece.color === objective.targetColor) {
    return 'won';
  }
  return hand.pieces.length === 0 ? 'lost' : 'undetermined';
}
