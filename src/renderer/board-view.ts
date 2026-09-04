import type Phaser from 'phaser';
import type { Board, Fragility, Goal, PieceColor } from '../engine/index.js';

export const CELL_SIZE = 48;
export const BOARD_PIXELS = CELL_SIZE * 8;

export const PIECE_COLOR: Record<PieceColor, number> = {
  green: 0x2ecc71,
  orange: 0xe67e22,
  brown: 0x8d6e63,
  red: 0xe74c3c,
  // Not literal black (0x000000) -- the board background is already a near-black
  // 0x1e1e1e (main.ts), so true black would be nearly invisible. A dark slate
  // reads as "black" against the other saturated colors while staying visible
  // (023-black-piece-line-clear).
  black: 0x4b4b55,
  // A solid violet stand-in for an actual rainbow gradient (not viable with a
  // plain Phaser.GameObjects.Circle) -- distinguishable from all 5 other
  // colors above, including black's dark slate (024-rainbow-color-change).
  rainbow: 0xb26bff,
};

const GRID_LINE_COLOR = 0x444444;

// FR-014 (fragilidad, Historia 3): una ficha CRACKED se dibuja con una grieta encima de
// su relleno de color habitual -- distinguible sin ninguna acción del jugador (SC-001),
// sin introducir ninguna regla nueva aquí (Principio I: el renderer solo lee
// `piece.fragility`, ya calculado por el motor). BROKEN nunca debería llegar a
// dibujarse -- una ficha rota se elimina en el motor antes de asentarse (FR-004) -- pero
// se trata igual que CRACKED, con una segunda grieta cruzada (aspecto "hecha añicos"),
// para no dejar el caso sin definir.
const CRACK_COLOR = 0x1a1a1a;
const CRACK_LINE_WIDTH = 2;

/** A jagged line from one edge of the piece to the opposite edge, through near the
 * center -- fixed, deterministic zigzag (no randomness: Principio III doesn't bind
 * pure rendering, but there's no reason for the same piece to look different frame
 * to frame either). `angle` rotates the whole crack so a second one can cross it. */
function drawCrack(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
): void {
  const points: [number, number][] = [
    [-0.35, -0.85],
    [0.15, -0.25],
    [-0.2, 0.15],
    [0.35, 0.85],
  ];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  graphics.lineStyle(CRACK_LINE_WIDTH, CRACK_COLOR, 1);
  graphics.beginPath();
  points.forEach(([px, py], index) => {
    const x = centerX + (px * cos - py * sin) * radius;
    const y = centerY + (px * sin + py * cos) * radius;
    if (index === 0) {
      graphics.moveTo(x, y);
    } else {
      graphics.lineTo(x, y);
    }
  });
  graphics.strokePath();
}

/**
 * Draws the fragility marking for a single piece already filled at
 * `(centerX, centerY)` with the given `radius` -- shared between the board
 * (`drawBoard`) and the hand (`hand-panel.ts`'s `drawHand`), so a BROKEN piece
 * looks the same wherever it's shown. Board pieces should never actually be
 * BROKEN (FR-004 removes one before it would settle), but a hand piece can be
 * dealt already-BROKEN (FR-008/FR-011) and stays there, visible, until it's
 * thrown -- so this needs to handle both states for real, not just for
 * completeness.
 */
export function drawPieceFragility(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  radius: number,
  fragility: Fragility,
): void {
  if (fragility === 'cracked') {
    drawCrack(graphics, centerX, centerY, radius, 0);
  } else if (fragility === 'broken') {
    drawCrack(graphics, centerX, centerY, radius, 0);
    drawCrack(graphics, centerX, centerY, radius, Math.PI / 2);
  }
}

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

      graphics.fillStyle(PIECE_COLOR[piece.color], 1);
      graphics.fillCircle(centerX, centerY, radius);
      drawPieceFragility(graphics, centerX, centerY, radius, piece.fragility);
    }
  }
}
