import Phaser from 'phaser';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 40, 'chainedRainbow', { fontSize: '32px', color: '#ffffff' })
      .setOrigin(0.5);

    const startButton = this.add
      .text(width / 2, height / 2 + 20, 'Jugar', {
        fontSize: '24px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      this.scene.start('LevelSelectScene');
    });
  }
}
