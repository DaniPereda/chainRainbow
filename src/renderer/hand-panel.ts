import type Phaser from 'phaser';
import type { Hand } from '../engine/index.js';
import { PIECE_COLOR } from './board-view.js';

const PIECE_RADIUS = 14;
const SLOT_WIDTH = 40;

/**
 * Draws the full queue of pieces left in a Hand as a row of colored circles, in
 * order -- the first piece drawn is the next one that will be launched. Purely
 * informational (spec.md 007, FR-007): never decides which piece fires next, only
 * reflects what the engine already computed. Deterministic given the same Hand, so
 * it doesn't need its own Vitest coverage any more than board-view.ts does.
 */
export function drawHand(graphics: Phaser.GameObjects.Graphics, hand: Hand): void {
  graphics.clear();

  const totalWidth = hand.pieces.length * SLOT_WIDTH;
  const startX = -totalWidth / 2 + SLOT_WIDTH / 2;

  hand.pieces.forEach((piece, index) => {
    graphics.fillStyle(PIECE_COLOR[piece.color], 1);
    graphics.fillCircle(startX + index * SLOT_WIDTH, 0, PIECE_RADIUS);
  });
}
