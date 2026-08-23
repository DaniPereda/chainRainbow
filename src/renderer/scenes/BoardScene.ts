import Phaser from 'phaser';
import { PROTOTYPE_LEVELS } from '../../levels/prototype-levels.js';
import { drawBoard, BOARD_PIXELS, CELL_SIZE } from '../board-view.js';
import {
  applySessionLaunch,
  startSession,
  type Direction,
  type LevelSession,
} from '../../engine/index.js';

type BoardSceneData = { levelId: number };

const EDGE_SIZE = 20;
const EDGE_GAP = 6;
const EDGE_COLOR = 0x555555;

/**
 * Each edge marker encodes a {direction, lane} launch by WHERE the piece would
 * enter the board (per launch.ts's entryCoordinate), not by which visual side of
 * the screen it sits on: tapping to the left of the board enters at that row
 * travelling east; tapping above the board enters at that column travelling
 * south; etc. That's the opposite screen side from the direction's own name for
 * N/S, which matches how travelLaunch actually scans (research.md, Decisión 2).
 */
function edgeMarkers(
  boardOriginX: number,
  boardOriginY: number,
): { x: number; y: number; direction: Direction; lane: number }[] {
  const markers: { x: number; y: number; direction: Direction; lane: number }[] = [];

  for (let lane = 0; lane < 8; lane++) {
    const rowCenterY = boardOriginY + lane * CELL_SIZE + CELL_SIZE / 2;
    const colCenterX = boardOriginX + lane * CELL_SIZE + CELL_SIZE / 2;

    markers.push({
      x: boardOriginX - EDGE_GAP - EDGE_SIZE / 2,
      y: rowCenterY,
      direction: 'E',
      lane,
    });
    markers.push({
      x: boardOriginX + BOARD_PIXELS + EDGE_GAP + EDGE_SIZE / 2,
      y: rowCenterY,
      direction: 'O',
      lane,
    });
    markers.push({
      x: colCenterX,
      y: boardOriginY - EDGE_GAP - EDGE_SIZE / 2,
      direction: 'S',
      lane,
    });
    markers.push({
      x: colCenterX,
      y: boardOriginY + BOARD_PIXELS + EDGE_GAP + EDGE_SIZE / 2,
      direction: 'N',
      lane,
    });
  }

  return markers;
}

export class BoardScene extends Phaser.Scene {
  private levelId = 1;
  private session!: LevelSession;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private boardOriginX = 0;
  private boardOriginY = 60;

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

    // FR-012: cada entrada a un nivel (primera vez o tras volver) parte de su
    // definición inicial -- no se reutiliza ningún estado de una partida anterior.
    this.session = startSession(entry.level);

    this.boardOriginX = (this.scale.width - BOARD_PIXELS) / 2;
    this.boardGraphics = this.add.graphics({ x: this.boardOriginX, y: this.boardOriginY });
    this.redraw();

    edgeMarkers(this.boardOriginX, this.boardOriginY).forEach(({ x, y, direction, lane }) => {
      const marker = this.add
        .rectangle(x, y, EDGE_SIZE, EDGE_SIZE, EDGE_COLOR)
        .setInteractive({ useHandCursor: true });

      marker.on('pointerdown', () => this.launch(direction, lane));
    });

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

  private launch(direction: Direction, lane: number): void {
    // US2 Acceptance Scenario 3: sin fichas en mano, no se puede iniciar un nuevo
    // lanzamiento. También se detiene una vez el nivel ya se resolvió (US3).
    if (this.session.current.hand.pieces.length === 0 || this.session.status !== 'undetermined') {
      return;
    }

    const { session: nextSession } = applySessionLaunch(this.session, { direction, lane });
    this.session = nextSession;
    this.redraw();
  }

  private redraw(): void {
    drawBoard(this.boardGraphics, this.session.current.board, this.session.current.objective);
  }
}
