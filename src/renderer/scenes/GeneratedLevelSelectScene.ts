import Phaser from 'phaser';
import { createLevel, type PiecePlacement } from '../../engine/index.js';

const COLUMNS = 5;
const CELL = 90;

type GeneratedLevelFile = {
  pieces: PiecePlacement[];
  hand: PiecePlacement['color'][];
  goal: { color: PiecePlacement['color']; cell: { row: number; col: number } };
};

/**
 * Selector de niveles generados por `tools/generator/` -- lee `levels/index.json`
 * y los ficheros individuales por fetch en tiempo de ejecución, nunca importados
 * en build-time (ese límite ya existe: `src/renderer/` nunca importa de `tools/`,
 * research.md 011). Solo alcanzable desde `dev-levels.html`, un punto de entrada
 * de Vite aparte de `index.html` -- nunca llega al build del jugador.
 */
export class GeneratedLevelSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GeneratedLevelSelectScene' });
  }

  async create(): Promise<void> {
    const { width } = this.scale;

    this.add
      .text(width / 2, 32, 'Niveles generados', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5);

    let ids: number[] = [];
    try {
      const response = await fetch('/levels/index.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      ids = await response.json();
    } catch (error) {
      this.add
        .text(width / 2, 100, `No se pudo leer levels/index.json\n(${String(error)})`, {
          fontSize: '14px',
          color: '#ff8a68',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    if (ids.length === 0) {
      this.add
        .text(width / 2, 100, 'levels/index.json está vacío -- genera alguno con tools/generator/batch.ts', {
          fontSize: '14px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5);
      return;
    }

    const gridWidth = COLUMNS * CELL;
    const originX = (width - gridWidth) / 2 + CELL / 2;
    const originY = 80;

    ids.forEach((id, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = originX + col * CELL;
      const y = originY + row * CELL;

      const button = this.add
        .text(x, y, String(id), {
          fontSize: '28px',
          color: '#ffee58',
          backgroundColor: '#333333',
          padding: { x: 20, y: 14 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => this.loadAndPlay(id));
    });
  }

  private async loadAndPlay(id: number): Promise<void> {
    const response = await fetch(`/levels/${id}.json`);
    if (!response.ok) {
      throw new Error(`No se pudo leer levels/${id}.json (HTTP ${response.status})`);
    }
    const file = (await response.json()) as GeneratedLevelFile;

    const level = createLevel({
      pieces: file.pieces,
      hand: file.hand,
      goal: { at: file.goal.cell, color: file.goal.color },
    });

    this.scene.start('BoardScene', { level, backSceneKey: 'GeneratedLevelSelectScene' });
  }
}
