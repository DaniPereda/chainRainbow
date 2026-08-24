import type Phaser from 'phaser';
import type { Board, Goal, PieceColor } from '../engine/index.js';

export const CELL_SIZE = 48;
export const BOARD_PIXELS = CELL_SIZE * 8;

export const PIECE_COLOR: Record<PieceColor, number> = {
  green: 0x2ecc71,
  orange: 0xe67e22,
  brown: 0x8d6e63,
  red: 0xe74c3c,
};

const GRID_LINE_COLOR = 0x444444;

/**
 * Draws a Board + Goal (engine state) onto a Phaser Graphics object as plain
 * shapes -- no image assets. Deterministic given the same inputs; the only side
 * effect is drawing onto `graphics`, so it doesn't need its own Vitest coverage
 * (constitution: renderer scenes/drawing are validated manually, see quickstart.md).
 */
export function drawBoard(
  graphics: Phaser.GameObjects.Graphics,
  board: Board,
  goal: Goal,
): void {
  graphics.clear();

  graphics.lineStyle(1, GRID_LINE_COLOR, 1);
  for (let i = 0; i <= 8; i++) {
    graphics.lineBetween(i * CELL_SIZE, 0, i * CELL_SIZE, BOARD_PIXELS);
    graphics.lineBetween(0, i * CELL_SIZE, BOARD_PIXELS, i * CELL_SIZE);
  }

  graphics.lineStyle(3, PIECE_COLOR[goal.targetColor], 1);
  graphics.strokeRect(
    goal.targetCell.col * CELL_SIZE + 3,
    goal.targetCell.row * CELL_SIZE + 3,
    CELL_SIZE - 6,
    CELL_SIZE - 6,
  );

  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      const piece = board.cells[row][col];
      if (piece === null) continue;
      graphics.fillStyle(PIECE_COLOR[piece.color], 1);
      graphics.fillCircle(
        col * CELL_SIZE + CELL_SIZE / 2,
        row * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 6,
      );
    }
  }
}
