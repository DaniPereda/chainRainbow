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

// FR-014 (fragilidad, Historia 3): una ficha CRACKED se dibuja con menos opacidad de
// relleno y un borde oscuro alrededor -- distinguible sin ninguna acción del jugador
// (SC-001), sin introducir ninguna regla nueva aquí (Principio I: el renderer solo lee
// `piece.fragility`, ya calculado por el motor). BROKEN nunca debería llegar a
// dibujarse -- una ficha rota se elimina en el motor antes de asentarse (FR-004) -- pero
// se trata igual que CRACKED, con más énfasis, para no dejar el caso sin definir.
const CRACKED_FILL_ALPHA = 0.55;
const CRACKED_BORDER_COLOR = 0x1a1a1a;
const BROKEN_FILL_ALPHA = 0.3;
const BROKEN_BORDER_COLOR = 0x000000;

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

      const centerX = col * CELL_SIZE + CELL_SIZE / 2;
      const centerY = row * CELL_SIZE + CELL_SIZE / 2;
      const radius = CELL_SIZE / 2 - 6;

      const fillAlpha =
        piece.fragility === 'broken' ? BROKEN_FILL_ALPHA : piece.fragility === 'cracked' ? CRACKED_FILL_ALPHA : 1;
      graphics.fillStyle(PIECE_COLOR[piece.color], fillAlpha);
      graphics.fillCircle(centerX, centerY, radius);

      if (piece.fragility !== 'new') {
        const borderColor = piece.fragility === 'broken' ? BROKEN_BORDER_COLOR : CRACKED_BORDER_COLOR;
        graphics.lineStyle(2, borderColor, 1);
        graphics.strokeCircle(centerX, centerY, radius);
      }
    }
  }
}
