import Phaser from 'phaser';
import { PROTOTYPE_LEVELS } from '../../levels/prototype-levels.js';

const COLUMNS = 5;
const CELL = 90;

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  create(): void {
    const { width } = this.scale;
    const gridWidth = COLUMNS * CELL;
    const originX = (width - gridWidth) / 2 + CELL / 2;
    const originY = 80;

    this.add
      .text(width / 2, 32, 'Selecciona un nivel', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5);

    PROTOTYPE_LEVELS.forEach((entry, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = originX + col * CELL;
      const y = originY + row * CELL;

      const button = this.add
        .text(x, y, String(entry.id), {
          fontSize: '28px',
          color: '#ffee58',
          backgroundColor: '#333333',
          padding: { x: 20, y: 14 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => {
        this.scene.start('BoardScene', { levelId: entry.id });
      });
    });
  }
}
