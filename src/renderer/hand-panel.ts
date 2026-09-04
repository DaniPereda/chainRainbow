import type Phaser from 'phaser';
import type { Hand } from '../engine/index.js';
import { drawPieceCircle, drawPieceFragility } from './board-view.js';

export const PIECE_RADIUS = 14;
const SLOT_WIDTH = 40;
const HAND_SELECTION_RING_COLOR = 0xffee58;

/**
 * Draws the full queue of pieces left in a Hand as a row of colored circles, in
 * order -- the first piece drawn is the next one that will be launched by default
 * (010-hand-piece-selection, FR-005). Each piece also gets its fragility marking
 * (012-piece-fragility, FR-014) -- unlike the board, a hand piece CAN genuinely be
 * BROKEN (a level can deal one that way, FR-008/FR-011), so this isn't just for
 * completeness here. The piece at `selectedIndex` (if not `null`)
 * gets a highlight ring -- same stroke weight as the board's goal ring, but a fixed
 * accent color rather than the piece's own: a same-color ring on a same-color fill
 * would have no contrast (research.md). Never decides which piece fires next on its
 * own, only reflects what the engine (LevelSession.selectedHandIndex) already
 * computed (Principle I). Deterministic given the same inputs, so it doesn't need
 * its own Vitest coverage any more than board-view.ts does.
 *
 * Returns the local center `{x, y}` of each drawn piece, same order as
 * `hand.pieces`, so the caller can position tap-to-select hit zones without
 * duplicating this layout math (research.md).
 */
export function drawHand(
  graphics: Phaser.GameObjects.Graphics,
  hand: Hand,
  selectedIndex: number | null,
): { x: number; y: number }[] {
  graphics.clear();

  const totalWidth = hand.pieces.length * SLOT_WIDTH;
  const startX = -totalWidth / 2 + SLOT_WIDTH / 2;

  return hand.pieces.map((piece, index) => {
    const x = startX + index * SLOT_WIDTH;

    drawPieceCircle(graphics, x, 0, PIECE_RADIUS, piece.color);
    drawPieceFragility(graphics, x, 0, PIECE_RADIUS, piece.fragility);

    if (index === selectedIndex) {
      graphics.lineStyle(3, HAND_SELECTION_RING_COLOR, 1);
      graphics.strokeCircle(x, 0, PIECE_RADIUS + 4);
    }

    return { x, y: 0 };
  });
}
