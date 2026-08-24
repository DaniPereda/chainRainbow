import Phaser from 'phaser';
import { PROTOTYPE_LEVELS } from '../../levels/prototype-levels.js';
import { drawBoard, BOARD_PIXELS, CELL_SIZE } from '../board-view.js';
import { drawHand, PIECE_RADIUS } from '../hand-panel.js';
import {
  applySessionLaunch,
  restartSession,
  selectHandPiece,
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
  private handGraphics!: Phaser.GameObjects.Graphics;
  private handHitZones: Phaser.GameObjects.Zone[] = [];
  private boardOriginX = 0;
  private boardOriginY = 60;
  private resultOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'BoardScene' });
  }

  init(data: BoardSceneData): void {
    this.levelId = data.levelId;
  }

  create(): void {
    const levelIndex = PROTOTYPE_LEVELS.findIndex((candidate) => candidate.id === this.levelId);
    const entry = PROTOTYPE_LEVELS[levelIndex];
    if (entry === undefined) {
      throw new Error(`No existe el nivel ${this.levelId}`);
    }

    // FR-012: cada entrada a un nivel (primera vez o tras volver) parte de su
    // definición inicial -- no se reutiliza ningún estado de una partida anterior.
    this.session = startSession(entry.level);

    this.boardOriginX = (this.scale.width - BOARD_PIXELS) / 2;
    this.boardGraphics = this.add.graphics({ x: this.boardOriginX, y: this.boardOriginY });

    // Panel de mano: debajo de las casillas de lanzamiento del borde sur (research.md 007).
    const handPanelY = this.boardOriginY + BOARD_PIXELS + 60;
    this.handGraphics = this.add.graphics({ x: this.scale.width / 2, y: handPanelY });

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

    // FR-007/FR-008/FR-009: solo se muestra una ventana cuando el motor decidió un
    // resultado; 'undetermined' (incluye missclick) no muestra nada.
    if (nextSession.status === 'won' || nextSession.status === 'lost') {
      this.showResultOverlay(nextSession.status);
    }
  }

  private redraw(): void {
    drawBoard(this.boardGraphics, this.session.current.board, this.session.current.goal);

    const positions = drawHand(
      this.handGraphics,
      this.session.current.hand,
      this.session.selectedHandIndex,
    );

    // El número de fichas cambia con cada lanzamiento (a diferencia de los
    // marcadores de borde del tablero, fijos) -- las zonas táctiles se recrean en
    // cada redraw en vez de crearse una única vez (research.md 010).
    this.handHitZones.forEach((zone) => zone.destroy());
    this.handHitZones = positions.map(({ x, y }, index) => {
      const zone = this.add
        .zone(
          this.handGraphics.x + x,
          this.handGraphics.y + y,
          PIECE_RADIUS * 2,
          PIECE_RADIUS * 2,
        )
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        this.session = selectHandPiece(this.session, index);
        this.redraw();
      });

      return zone;
    });
  }

  private showResultOverlay(status: 'won' | 'lost'): void {
    this.resultOverlay?.destroy();

    const { width, height } = this.scale;
    const message = status === 'won' ? '¡Objetivo conseguido!' : 'Mano vacía -- sin éxito';

    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0, 0);
    const text = this.add
      .text(width / 2, height / 2 - 60, message, { fontSize: '26px', color: '#ffffff' })
      .setOrigin(0.5);

    const restartButton = this.add
      .text(width / 2, height / 2, 'Reiniciar', {
        fontSize: '22px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const backButton = this.add
      .text(width / 2, height / 2 + 112, 'Volver al selector', {
        fontSize: '22px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const overlayObjects: Phaser.GameObjects.GameObject[] = [backdrop, text, restartButton, backButton];

    // Navegación directa entre niveles consecutivos desde la propia ventana de
    // resultado, sin pasar por el selector -- por orden en PROTOTYPE_LEVELS, no
    // por aritmética sobre el id (el id es simplemente el número que ve el
    // jugador). Ausente en los extremos (nivel 1 no tiene anterior, el último no
    // tiene siguiente) en vez de deshabilitado, para no sugerir una acción que no
    // puede completarse.
    const levelIndex = PROTOTYPE_LEVELS.findIndex((candidate) => candidate.id === this.levelId);
    const previousLevel = PROTOTYPE_LEVELS[levelIndex - 1];
    const nextLevel = PROTOTYPE_LEVELS[levelIndex + 1];
    const navY = height / 2 + 56;

    if (previousLevel !== undefined) {
      const previousButton = this.add
        .text(width / 2 - 90, navY, '‹ Anterior', {
          fontSize: '18px',
          color: '#ffee58',
          backgroundColor: '#333333',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      previousButton.on('pointerdown', () => {
        this.scene.start('BoardScene', { levelId: previousLevel.id });
      });

      overlayObjects.push(previousButton);
    }

    if (nextLevel !== undefined) {
      const nextButton = this.add
        .text(width / 2 + 90, navY, 'Siguiente ›', {
          fontSize: '18px',
          color: '#ffee58',
          backgroundColor: '#333333',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      nextButton.on('pointerdown', () => {
        this.scene.start('BoardScene', { levelId: nextLevel.id });
      });

      overlayObjects.push(nextButton);
    }

    this.resultOverlay = this.add.container(0, 0, overlayObjects);

    // FR-010: reiniciar vuelve exactamente al estado inicial declarado -- vía
    // restartSession, nunca reconstruido a mano por el renderer.
    restartButton.on('pointerdown', () => {
      this.session = restartSession(this.session);
      this.resultOverlay?.destroy();
      this.resultOverlay = undefined;
      this.redraw();
    });

    // FR-011: volver al selector desde la ventana de resultado.
    backButton.on('pointerdown', () => {
      this.scene.start('LevelSelectScene');
    });
  }
}
