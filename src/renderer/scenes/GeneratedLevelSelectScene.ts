import Phaser from 'phaser';
import { createLevel, type HandPieceInput, type PiecePlacement } from '../../engine/index.js';

const COLUMNS = 5;
const CELL = 90;
const ROWS_PER_PAGE = 5;
const PAGE_SIZE = COLUMNS * ROWS_PER_PAGE;
const GRID_ORIGIN_Y = 80;
const PAGINATION_Y = 560;

type GeneratedLevelFile = {
  pieces: PiecePlacement[];
  hand: HandPieceInput[];
  goal: { color: PiecePlacement['color']; cell: { row: number; col: number } };
};

/**
 * Selector de niveles generados por `tools/generator/` -- lee `levels/index.json`
 * y los ficheros individuales por fetch en tiempo de ejecución, nunca importados
 * en build-time (ese límite ya existe: `src/renderer/` nunca importa de `tools/`,
 * research.md 011). Solo alcanzable desde `dev-levels.html`, un punto de entrada
 * de Vite aparte de `index.html` -- nunca llega al build del jugador.
 *
 * Paginado (25 por página, 5x5) en vez de una única rejilla larga -- con 140
 * niveles generados, una rejilla sin paginar se saldría muy por debajo del
 * canvas (28 filas) sin ninguna forma de llegar a ellas. `currentPage` es un
 * campo de instancia normal: como Phaser reutiliza la misma instancia de
 * escena entre `scene.start()`, volver aquí desde el tablero conserva la
 * página en la que estabas, sin ningún estado explícito que gestionar aparte.
 */
export class GeneratedLevelSelectScene extends Phaser.Scene {
  private ids: number[] = [];
  private currentPage = 0;
  private pageButtons: Phaser.GameObjects.GameObject[] = [];
  private pageIndicator?: Phaser.GameObjects.Text;
  private previousPageButton?: Phaser.GameObjects.Text;
  private nextPageButton?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GeneratedLevelSelectScene' });
  }

  async create(): Promise<void> {
    const { width } = this.scale;

    this.add
      .text(width / 2, 32, 'Niveles generados', { fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5);

    try {
      const response = await fetch('/levels/index.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.ids = await response.json();
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

    if (this.ids.length === 0) {
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

    const totalPages = Math.ceil(this.ids.length / PAGE_SIZE);
    if (this.currentPage >= totalPages) this.currentPage = 0; // defensivo si la lista encogió

    this.previousPageButton = this.add
      .text(width / 2 - 90, PAGINATION_Y, '‹ Página anterior', {
        fontSize: '16px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.previousPageButton.on('pointerdown', () => {
      this.currentPage--;
      this.renderPage();
    });

    this.nextPageButton = this.add
      .text(width / 2 + 90, PAGINATION_Y, 'Página siguiente ›', {
        fontSize: '16px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.nextPageButton.on('pointerdown', () => {
      this.currentPage++;
      this.renderPage();
    });

    this.pageIndicator = this.add
      .text(width / 2, PAGINATION_Y + 30, '', { fontSize: '14px', color: '#aaaaaa' })
      .setOrigin(0.5);

    this.renderPage();
  }

  private renderPage(): void {
    const { width } = this.scale;
    const totalPages = Math.ceil(this.ids.length / PAGE_SIZE);

    this.pageButtons.forEach((button) => button.destroy());
    this.pageButtons = [];

    const start = this.currentPage * PAGE_SIZE;
    const pageIds = this.ids.slice(start, start + PAGE_SIZE);

    const gridWidth = COLUMNS * CELL;
    const originX = (width - gridWidth) / 2 + CELL / 2;

    pageIds.forEach((id, index) => {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = originX + col * CELL;
      const y = GRID_ORIGIN_Y + row * CELL;

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
      this.pageButtons.push(button);
    });

    this.pageIndicator?.setText(`Página ${this.currentPage + 1} / ${totalPages}`);
    this.previousPageButton?.setVisible(this.currentPage > 0);
    this.nextPageButton?.setVisible(this.currentPage < totalPages - 1);
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

    // Mismos ids consecutivos que ya trae levels/index.json -- BoardScene no
    // sabe nada de esta lista, solo recibe "el vecino es este id" y, si el
    // jugador lo pide, vuelve a llamar a loadAndPlay con ese id (research.md).
    const position = this.ids.indexOf(id);
    const previousId = position > 0 ? this.ids[position - 1] : undefined;
    const nextId = position >= 0 && position < this.ids.length - 1 ? this.ids[position + 1] : undefined;

    this.scene.start('BoardScene', {
      level,
      backSceneKey: 'GeneratedLevelSelectScene',
      currentId: id,
      previousId,
      nextId,
      onNavigate: (targetId: number) => this.loadAndPlay(targetId),
    });
  }
}
