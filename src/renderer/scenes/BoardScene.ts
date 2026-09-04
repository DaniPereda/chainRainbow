import Phaser from 'phaser';
import { PROTOTYPE_LEVELS } from '../../levels/prototype-levels.js';
import { drawBoard, BOARD_PIXELS, CELL_SIZE } from '../board-view.js';
import { drawHand, PIECE_RADIUS } from '../hand-panel.js';
import { playEventLog } from '../launch-animation.js';
import { showColorChoiceDialog } from '../color-choice-dialog.js';
import { playGoalSound } from '../sound-effects.js';
import {
  commitLaunchOutcome,
  resolveLaunch,
  restartSession,
  selectHandPiece,
  startSession,
  type Board,
  type Direction,
  type LaunchOutcome,
  type Level,
  type LevelSession,
} from '../../engine/index.js';

/**
 * Además de un nivel del prototipo (por id), BoardScene puede cargar un `Level`
 * ya construido directamente -- la vía que usa el visor de niveles generados
 * (dev-levels.html), que nunca pasa por PROTOTYPE_LEVELS. `backSceneKey` decide
 * a qué escena vuelve el botón "< Niveles"/"Volver al selector", ya que cada
 * origen tiene su propio selector.
 *
 * `previousId`/`nextId`/`onNavigate` son opcionales: cualquier fuente cuyos
 * niveles tengan id numérico consecutivo (como `levels/index.json`) puede
 * ofrecer la misma navegación "‹ Anterior/Siguiente ›" que ya tiene el
 * prototipo, sin que BoardScene necesite saber nada de esa fuente -- calcular
 * los vecinos y cargar el nivel correspondiente es responsabilidad de quien
 * llama (la propia escena selectora), no de BoardScene.
 *
 * `currentId` es igualmente opcional y puramente informativo -- solo alimenta
 * el indicador "Nivel N" junto al botón de volver; si se omite (una fuente sin
 * id numérico propio), el indicador simplemente no se muestra.
 */
type BoardSceneData =
  | { levelId: number }
  | {
      level: Level;
      backSceneKey: string;
      currentId?: number;
      previousId?: number;
      nextId?: number;
      onNavigate?: (id: number) => void;
    };

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
  private levelId: number | null = null;
  private customLevel: Level | null = null;
  private backSceneKey = 'LevelSelectScene';
  private customCurrentId: number | null = null;
  private customPreviousId: number | null = null;
  private customNextId: number | null = null;
  private onNavigate: ((id: number) => void) | null = null;
  private session!: LevelSession;
  // 018-piece-movement-animation: true while a launch's EventLog is still being
  // played back visually -- blocks a new launch (US2) and hand-selection taps
  // (US2) until it finishes; deliberately does NOT block the "< Niveles" button
  // (research.md, Decisión 4 -- leaving the scene tears down any in-flight tween).
  private animating = false;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private handGraphics!: Phaser.GameObjects.Graphics;
  private handHitZones: Phaser.GameObjects.Zone[] = [];
  private boardOriginX = 0;
  private boardOriginY = 100;
  private resultOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'BoardScene' });
  }

  init(data: BoardSceneData): void {
    if ('level' in data) {
      this.levelId = null;
      this.customLevel = data.level;
      this.backSceneKey = data.backSceneKey;
      this.customCurrentId = data.currentId ?? null;
      this.customPreviousId = data.previousId ?? null;
      this.customNextId = data.nextId ?? null;
      this.onNavigate = data.onNavigate ?? null;
    } else {
      this.levelId = data.levelId;
      this.customLevel = null;
      this.backSceneKey = 'LevelSelectScene';
      this.customCurrentId = null;
      this.customPreviousId = null;
      this.customNextId = null;
      this.onNavigate = null;
    }
  }

  create(): void {
    let initialLevel: Level;

    if (this.customLevel !== null) {
      initialLevel = this.customLevel;
    } else {
      const entry = PROTOTYPE_LEVELS.find((candidate) => candidate.id === this.levelId);
      if (entry === undefined) {
        throw new Error(`No existe el nivel ${this.levelId}`);
      }
      initialLevel = entry.level;
    }

    // FR-012: cada entrada a un nivel (primera vez o tras volver) parte de su
    // definición inicial -- no se reutiliza ningún estado de una partida anterior.
    this.session = startSession(initialLevel);

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
    // desde la ventana de resultado (esa se añade en US3, T018-T020). Separado del
    // tablero (y de sus marcadores de lanzamiento del borde norte) por el propio
    // hueco entre y=16 y boardOriginY, en vez de pegado a la primera fila de
    // marcadores como antes.
    const backButton = this.add
      .text(16, 16, '< Niveles', {
        fontSize: '18px',
        color: '#ffee58',
        backgroundColor: '#333333',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerdown', () => {
      this.scene.start(this.backSceneKey);
    });

    // Nivel actual, junto al botón de volver -- por id de PROTOTYPE_LEVELS, o por
    // el id que la escena selectora haya pasado como `currentId` (research.md:
    // BoardScene no sabe nada de la fuente, solo muestra el número que le dieron).
    const displayLevelId = this.customLevel !== null ? this.customCurrentId : this.levelId;
    if (displayLevelId !== null) {
      this.add
        .text(backButton.x + backButton.width + 12, backButton.y + backButton.height / 2, `Nivel ${displayLevelId}`, {
          fontSize: '18px',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5);
    }
  }

  private launch(direction: Direction, lane: number): void {
    // US2 Acceptance Scenario 3: sin fichas en mano, no se puede iniciar un nuevo
    // lanzamiento. También se detiene una vez el nivel ya se resolvió (US3), y
    // mientras una animación anterior sigue en curso (018, Historia 2).
    if (
      this.session.current.hand.pieces.length === 0 ||
      this.session.status !== 'undetermined' ||
      this.animating
    ) {
      return;
    }

    const boardBeforeLaunch = this.session.current.board;
    const outcome = resolveLaunch(this.session.current, { direction, lane }, this.session.selectedHandIndex ?? 0);

    // 018-piece-movement-animation: se reproduce la traza de eventos antes de
    // mostrar el estado final -- redraw() y la ventana de resultado (Historia 3)
    // se disparan solo cuando la animación completa termina, nunca antes.
    this.animating = true;
    this.playLaunchSegment(direction, lane, boardBeforeLaunch, outcome, 0, true);
  }

  /**
   * Plays one segment of a launch's animation -- `outcome.events.slice(playedCount)`
   * -- and, once it finishes, either opens the color-choice dialog and recurses
   * into the NEXT segment (024-rainbow-color-change: `outcome.pendingColorChoice`
   * means the engine's own chain is still paused, waiting on the player) or
   * commits the session and finishes the launch exactly as before this feature.
   * `resolveLaunch`/`commitLaunchOutcome` are used directly instead of
   * `applySessionLaunch` so this same function can commit whichever outcome
   * finally turns out to be the real one, whether that's the very first call
   * (no pause at all, the common case) or after any number of color choices.
   */
  private playLaunchSegment(
    direction: Direction,
    lane: number,
    boardBeforeSegment: Board,
    outcome: LaunchOutcome,
    playedCount: number,
    isFirstSegment: boolean,
  ): void {
    playEventLog(
      this,
      this.boardGraphics,
      this.session.current.goal,
      boardBeforeSegment,
      { direction, lane },
      outcome.events.slice(playedCount),
      () => {
        const pending = outcome.pendingColorChoice;
        if (pending) {
          showColorChoiceDialog(this, this.boardGraphics, pending.at, pending.options, (color) => {
            this.playLaunchSegment(direction, lane, outcome.board, pending.resume(color), outcome.events.length, false);
          });
          return;
        }

        this.session = commitLaunchOutcome(this.session, outcome);
        this.animating = false;
        this.redraw();

        // FR-007/FR-008/FR-009: solo se muestra una ventana cuando el motor
        // decidió un resultado; 'undetermined' (incluye missclick) no muestra nada.
        if (this.session.status === 'won' || this.session.status === 'lost') {
          if (this.session.status === 'won') playGoalSound();
          this.showResultOverlay(this.session.status);
        }
      },
      isFirstSegment,
    );
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
        // 018-piece-movement-animation, US2: la selección de mano tampoco cambia
        // mientras una animación de lanzamiento sigue en curso.
        if (this.animating) return;
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
    // resultado, sin pasar por el selector -- por id numérico, sea cual sea la
    // fuente (PROTOTYPE_LEVELS o cualquier otra con ids consecutivos, como
    // levels/index.json). Ausente en los extremos en vez de deshabilitado, para
    // no sugerir una acción que no puede completarse. BoardScene no decide QUÉ
    // vecino existe ni CÓMO cargarlo -- eso lo calcula quien la invocó.
    const navY = height / 2 + 56;
    let onPrevious: (() => void) | null = null;
    let onNext: (() => void) | null = null;

    if (this.customLevel === null) {
      const levelIndex = PROTOTYPE_LEVELS.findIndex((candidate) => candidate.id === this.levelId);
      const previousLevel = PROTOTYPE_LEVELS[levelIndex - 1];
      const nextLevel = PROTOTYPE_LEVELS[levelIndex + 1];
      if (previousLevel !== undefined) {
        onPrevious = () => this.scene.start('BoardScene', { levelId: previousLevel.id });
      }
      if (nextLevel !== undefined) {
        onNext = () => this.scene.start('BoardScene', { levelId: nextLevel.id });
      }
    } else if (this.onNavigate !== null) {
      const navigate = this.onNavigate;
      if (this.customPreviousId !== null) {
        const id = this.customPreviousId;
        onPrevious = () => navigate(id);
      }
      if (this.customNextId !== null) {
        const id = this.customNextId;
        onNext = () => navigate(id);
      }
    }

    if (onPrevious !== null) {
      const previousButton = this.add
        .text(width / 2 - 90, navY, '‹ Anterior', {
          fontSize: '18px',
          color: '#ffee58',
          backgroundColor: '#333333',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      previousButton.on('pointerdown', onPrevious);
      overlayObjects.push(previousButton);
    }

    if (onNext !== null) {
      const nextButton = this.add
        .text(width / 2 + 90, navY, 'Siguiente ›', {
          fontSize: '18px',
          color: '#ffee58',
          backgroundColor: '#333333',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      nextButton.on('pointerdown', onNext);
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
      this.scene.start(this.backSceneKey);
    });
  }
}
