import Phaser from 'phaser';
import type { Coordinate, PieceColor } from '../engine/index.js';
import { CELL_SIZE, PIECE_COLOR } from './board-view.js';
import { pixelCenter } from './launch-animation.js';

const OPTION_RADIUS = CELL_SIZE * 0.3;
const OPTION_GAP = OPTION_RADIUS * 2.4;

/**
 * The floating color-choice dialog (024-rainbow-color-change, FR-002): a row
 * of clickable circles, one per `options`, anchored above (or below, if too
 * close to the board's own top edge) the affected piece at `at`. Pure UI --
 * it knows nothing about WHY a color is being asked for, just translates one
 * click into a `PieceColor` via `onChoose`. Destroys its own game objects the
 * instant a choice is made; the caller decides what happens next (resuming
 * the paused chain, `BoardScene.launch()`).
 */
export function showColorChoiceDialog(
  scene: Phaser.Scene,
  boardGraphics: Phaser.GameObjects.Graphics,
  at: Coordinate,
  options: PieceColor[],
  onChoose: (color: PieceColor) => void,
): void {
  const center = pixelCenter(at);
  const totalWidth = (options.length - 1) * OPTION_GAP;
  const startX = boardGraphics.x + center.x - totalWidth / 2;
  // Anchored above the affected cell by default; below it instead when that
  // would place the dialog off the top of the board (row 0 or 1).
  const y = boardGraphics.y + center.y - (at.row <= 1 ? -CELL_SIZE * 1.4 : CELL_SIZE * 1.4);

  const backdrop = scene.add
    .rectangle(
      startX + totalWidth / 2,
      y,
      totalWidth + OPTION_RADIUS * 3,
      OPTION_RADIUS * 3,
      0x000000,
      0.55,
    )
    .setDepth(100);

  const circles: Phaser.GameObjects.Arc[] = [];

  const cleanup = (): void => {
    backdrop.destroy();
    circles.forEach((circle) => circle.destroy());
  };

  options.forEach((color, index) => {
    const x = startX + index * OPTION_GAP;
    const circle = scene.add
      .circle(x, y, OPTION_RADIUS, PIECE_COLOR[color])
      .setDepth(101)
      .setInteractive({ useHandCursor: true });

    circle.on('pointerdown', () => {
      cleanup();
      // Deferred to the next tick rather than called synchronously here --
      // real bug found live: `onChoose` (BoardScene) destroys this dialog's
      // circles (`cleanup`, including the very one just clicked) and then
      // immediately spawns new tweens for the resumed chain's animation, all
      // still inside Phaser's own pointerdown dispatch for this circle. Every
      // one of those new tweens got added successfully (confirmed: `scene.
      // tweens.paused` was false, the scene was active) but never advanced a
      // single frame -- destroying an interactive object while still inside
      // its own input-event dispatch, then registering new tweens before that
      // dispatch unwinds, left them permanently stuck. Delaying by 0ms runs
      // `onChoose` on its own, later frame, well outside Phaser's input
      // dispatch call stack, which resolves it completely.
      scene.time.delayedCall(0, () => onChoose(color));
    });

    circles.push(circle);
  });
}
