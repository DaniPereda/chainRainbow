# Phase 1 Data Model: Animación de Movimientos de Ficha Durante un Lanzamiento

## Tipos del motor -- sin cambios

`Board`, `Piece`, `Coordinate` (`src/engine/board.ts`), `ChainEvent` (`MoveStepEvent`/`AnnihilationEvent`), `EventLog` (`src/engine/events.ts`), `LaunchOutcome` (`src/engine/resolve-launch.ts`) -- ninguno cambia de forma (FR-009).

## Nuevo módulo: `src/renderer/launch-animation.ts`

### `replayEvent` (pura, testeada con Vitest)

```ts
import type { Board, ChainEvent, Coordinate } from '../engine/index.js';

// setCell: helper local e inmutable (Board.cells es un array plano ya público) --
// no se exporta nada nuevo desde src/engine/ para esto (FR-009).
function setCell(board: Board, coord: Coordinate, piece: Board['cells'][number][number]): Board { /* ... */ }

export function replayEvent(board: Board, event: ChainEvent): Board {
  if (event.type === 'MOVE_STEP') {
    if (event.piece.fragility === 'broken') {
      return board; // nunca se asienta -- misma regla que settleOrVanish; NADA se escribe
    }
    return setCell(board, event.to, event.piece); // ¡OJO! from NUNCA se toca -- ver más abajo
  }
  // ANNIHILATION
  return setCell(board, event.at, null);
}
```

**Contrato**: dado el `Board` ANTERIOR a un lanzamiento y la reproducción completa, en orden, de todo su `EventLog` (`events.reduce(replayEvent, boardAntesDelLanzamiento)`), el resultado es idéntico al `board` final que `resolveLaunch` ya devolvió para ese mismo lanzamiento -- mismo reductor, misma semántica de escritura que `applyImpact`/`settleOrVanish` (`src/engine/pieces/push.ts`), aplicada aquí sobre una copia independiente, nunca importando esa lógica del motor directamente (Principio I: duplicación mínima y deliberada, no reutilización de código de resolución).

**`event.from` NUNCA se escribe/vacía** -- corrección real hecha durante la implementación (research.md, Decisión 2): `settleOrVanish` en el motor real solo escribe `to`, nunca toca `from`; `from` es puramente documental. Vaciar `from` parecía razonable a primera vista, pero borra a rojo por error en el primer hop de cada rama de una división (ahí `from` es el propio punto de división, que rojo ocupa para siempre, FR-007 de 009-red-piece) -- detectado por el propio test de integración de abajo, no asumido.

`event.to`/`event.at` siempre son celdas reales del tablero (nunca fuera de rango, por invariante del motor); `event.from` sí puede caer fuera del tablero (p. ej. `{row: -1, col: 4}`, la casilla justo antes de que una ficha lanzada entre por el borde) -- pero como `replayEvent` nunca lo escribe, esto no requiere ningún manejo especial en el reductor (sí importa para `pixelCenter`, que sigue funcionando igual con una coordenada fuera de rango -- es solo aritmética de píxeles).

### `pixelCenter` (pura)

```ts
export function pixelCenter(coord: Coordinate): { x: number; y: number } {
  return { x: coord.col * CELL_SIZE + CELL_SIZE / 2, y: coord.row * CELL_SIZE + CELL_SIZE / 2 };
}
```

Reutiliza `CELL_SIZE` de `board-view.ts` -- el mismo cálculo que `drawBoard` ya hace inline para cada ficha, extraído para que tanto la capa estática como la animación temporal usen exactamente las mismas coordenadas.

### Orquestación (Phaser, no testeada con Vitest -- validada por quickstart.md)

```ts
export const STEP_DURATION_MS = 150;

export function playEventLog(
  scene: Phaser.Scene,
  boardGraphics: Phaser.GameObjects.Graphics,
  goal: Goal,
  boardBeforeLaunch: Board,
  events: EventLog,
  onDone: () => void,
): void {
  let board = boardBeforeLaunch;
  let i = 0;

  function playNext(): void {
    if (i >= events.length) {
      onDone();
      return;
    }
    const event = events[i++];
    const piece = event.type === 'MOVE_STEP' ? event.piece : { color: event.color, fragility: 'new' as const };
    const from = event.type === 'MOVE_STEP' ? event.from : event.at;
    const to = event.type === 'MOVE_STEP' ? event.to : event.at;

    // La copia YA está al día (replayEvent nunca vacía `from`, así que no hace
    // falta ningún ajuste antes de dibujar) -- se redibuja tal cual.
    drawBoard(boardGraphics, board, goal);

    const { x: fromX, y: fromY } = pixelCenter(from);
    const temp = scene.add.circle(boardGraphics.x + fromX, boardGraphics.y + fromY, PIECE_RADIUS, PIECE_COLOR[piece.color]);

    if (event.type === 'ANNIHILATION') {
      scene.tweens.add({
        targets: temp,
        alpha: 0,
        scale: 0,
        duration: STEP_DURATION_MS,
        onComplete: () => {
          temp.destroy();
          board = replayEvent(board, event);
          drawBoard(boardGraphics, board, goal);
          playNext();
        },
      });
      return;
    }

    const { x: toX, y: toY } = pixelCenter(to);
    scene.tweens.add({
      targets: temp,
      x: boardGraphics.x + toX,
      y: boardGraphics.y + toY,
      duration: STEP_DURATION_MS,
      onComplete: () => {
        temp.destroy();
        board = replayEvent(board, event);
        drawBoard(boardGraphics, board, goal);
        playNext();
      },
    });
  }

  playNext();
}
```

Esbozo de la forma, no el código final exacto (detalle de `/speckit-tasks`/implementación) -- pero fija el contrato: `playEventLog` recibe el tablero ANTES del lanzamiento y el `EventLog`, reproduce evento a evento con `replayEvent` para la capa estática y un `Arc` temporal para el tramo animado, y llama a `onDone` solo cuando el último evento ha terminado de reproducirse.

## `BoardScene.ts` -- cambios

- Nuevo campo privado: `private animating = false;`.
- `launch()`: tras `applySessionLaunch`, en vez de `redraw()` inmediato:
  1. Guarda `this.session = nextSession` como hoy.
  2. `this.animating = true`.
  3. Llama a `playEventLog(this, this.boardGraphics, ..., boardAntesDelLanzamiento, outcome.events, () => { this.animating = false; this.redraw(); if (nextSession.status === 'won' || 'lost') this.showResultOverlay(...); })`.
  4. Guarda del propio `launch()` y de cada `pointerdown` de mano: `if (this.animating) return;` añadido junto a los guardas ya existentes.
- `redraw()`: sin cambios de comportamiento -- sigue siendo la fuente de verdad para el estado FINAL (llamado al terminar la animación); durante la animación, la capa estática se actualiza directamente vía `drawBoard` desde dentro de `playEventLog`, no vía `redraw()` (que también reconstruye el panel de mano y sus zonas táctiles -- no hace falta tocar eso paso a paso, solo al final).

## Tests nuevos

- `tests/unit/renderer/launch-animation.test.ts` -- `replayEvent`: un `MOVE_STEP` normal coloca la ficha en `to` sin tocar `from`; un `MOVE_STEP` con `fragility: 'broken'` no escribe nada; una `ANNIHILATION` vacía la celda; reproducir el `EventLog` completo de un caso real (una división de rojo, `red.test.ts`) sobre el tablero previo produce exactamente el mismo `Board` final que ya devuelve `resolveLaunch` para ese caso -- prueba directa del contrato de la Decisión 2 de research.md.
- El mismo fichero -- `jumpMidpoint` (refinamiento, research.md Decisión 6): un empuje horizontal de 2 casillas, uno vertical, uno que cruza el borde (camino corto, no el largo), y `null` para 1 casilla, cualquier otra distancia, o una diagonal.

## Refinamiento post-playtest: salto de naranja + sonido (`src/renderer/launch-animation.ts`, `src/renderer/sound-effects.ts`)

- `jumpMidpoint(from, to, size): Coordinate | null` (pura, testeada) -- ver research.md, Decisión 6.
- `playEventLog` ahora, para cada `MOVE_STEP`: calcula `jumpMidpoint`; si es `null`, tween recto de siempre (más el sonido de choque de `sound-effects.ts` si `hasCollision`); si no es `null`, anima un salto en dos tramos (sube y baja, `Sine.easeOut`/`Sine.easeIn`) pasando por el punto medio, añade un marcador circular temporal sobre esa casilla (aparece y se desvanece), y reproduce el sonido de salto en vez del de choque.
- `sound-effects.ts` (nuevo, sin tests Vitest -- efectos secundarios de audio, validados manualmente como el resto de Phaser): `playImpactSound()`, `playJumpSound()`, `playGoalSound()`, cada uno un tono corto generado con `AudioContext`/`OscillatorNode` (research.md, Decisión 7). `BoardScene.launch()`'s `onDone` llama a `playGoalSound()` justo antes de `showResultOverlay('won')`.
- `STEP_DURATION_MS`: 150 → 350 (petición directa del usuario tras probar la primera versión).
