import Phaser from 'phaser';
import { PROTOTYPE_LEVELS } from '../../levels/prototype-levels.js';
import { drawBoard, BOARD_PIXELS } from '../board-view.js';

type BoardSceneData = { levelId: number };

export class BoardScene extends Phaser.Scene {
  private levelId = 1;

  constructor() {
    super({ key: 'BoardScene' });
  }

  init(data: BoardSceneData): void {
    this.levelId = data.levelId;
  }

  create(): void {
    const entry = PROTOTYPE_LEVELS.find((candidate) => candidate.id === this.levelId);
    if (entry === undefined) {
      throw new Error(`No existe el nivel ${this.levelId}`);
    }

    const boardOriginX = (this.scale.width - BOARD_PIXELS) / 2;
    const boardOriginY = 60;

    const graphics = this.add.graphics({ x: boardOriginX, y: boardOriginY });
    drawBoard(graphics, entry.level.board, entry.level.objective);

    // FR-014: volver al selector desde el tablero, en cualquier momento -- no solo
    // desde la ventana de resultado (esa se añade en US3, T018-T020).
    const backButton = this.add
      .text(16, 16, '< Niveles', {
        fontSize: '18px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerdown', () => {
      this.scene.start('LevelSelectScene');
    });
  }
}
