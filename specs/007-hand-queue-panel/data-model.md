# Phase 1 Data Model: Panel de Fichas en Mano

No hay entidades nuevas del motor — el panel consume `Hand`/`Piece`/`PieceColor`, ya existentes.
Este documento fija el módulo nuevo y el punto exacto de integración en `BoardScene`.

## Cambio: `PIECE_COLOR` pasa a exportarse desde `board-view.ts`

Hoy es una constante privada del módulo. `hand-panel.ts` necesita la misma paleta (una ficha
verde debe verse del mismo verde en el tablero y en el panel) — se exporta en vez de duplicarla:

```ts
// board-view.ts
export const PIECE_COLOR: Record<PieceColor, number> = {
  green: 0x2ecc71,
  orange: 0xe67e22,
};
```

## Nuevo: `src/renderer/hand-panel.ts`

```ts
import type Phaser from 'phaser';
import type { Hand } from '../engine/index.js';
import { PIECE_COLOR } from './board-view.js';

const PIECE_RADIUS = 14;
const SLOT_WIDTH = 40;

export function drawHand(graphics: Phaser.GameObjects.Graphics, hand: Hand): void {
  graphics.clear();

  const totalWidth = hand.pieces.length * SLOT_WIDTH;
  const startX = -totalWidth / 2 + SLOT_WIDTH / 2;

  hand.pieces.forEach((piece, index) => {
    graphics.fillStyle(PIECE_COLOR[piece.color], 1);
    graphics.fillCircle(startX + index * SLOT_WIDTH, 0, PIECE_RADIUS);
  });
}
```

`graphics` se posiciona (vía `this.add.graphics({x, y})`, igual que `boardGraphics`) en el punto
de la pantalla donde debe quedar centrado el panel; `drawHand` dibuja en coordenadas relativas a
ese origen, igual que hace `drawBoard` con el suyo.

## Integración en `BoardScene.ts`

- `create()`: añade `this.handGraphics = this.add.graphics({ x: centerX, y: panelY })`, con
  `centerX` el centro horizontal del tablero y `panelY` justo debajo de las casillas de
  lanzamiento del borde sur (research.md).
- `redraw()`: gana una línea, `drawHand(this.handGraphics, this.session.current.hand)`, junto a
  la llamada ya existente a `drawBoard`. Como `redraw()` ya se invoca tras `create()`, tras cada
  lanzamiento (`launch()`), y tras reiniciar (`restartButton` en `showResultOverlay`), el panel
  queda sincronizado con el tablero sin ningún punto de actualización nuevo (FR-004, FR-005,
  FR-006 de spec.md se cumplen todos por este único cambio).
