# Phase 1 Data Model: La Ficha Lanzada Nunca Permanece en el Tablero

No hay entidades nuevas — `Level`, `Board`, `Piece`, `ChainEvent`, `LaunchOutcome`, `LevelSession`
siguen exactamente igual. Este documento fija el cambio de código exacto y los niveles/fixture
que hay que rediseñar como consecuencia.

## Cambio de código: `applyImpact` (`src/engine/pieces/push.ts`)

Antes:

```ts
export function applyImpact(board: Board, site: ImpactSite): {...} {
  const result = resolveStrike(board, site.piece.color, site.to, site.direction);

  if (result.annihilated) {
    return { board: result.board, events: result.events, nextSites: [] };
  }

  const boardFinal = setPieceAt(result.board, site.to, site.piece);
  const arrivalEvent: MoveStepEvent = {
    type: 'MOVE_STEP', piece: site.piece, from: site.from, to: site.to, hasCollision: true,
  };
  return { board: boardFinal, events: [arrivalEvent, ...result.events], nextSites: [] };
}
```

Después:

```ts
export function applyImpact(board: Board, site: ImpactSite): {...} {
  const result = resolveStrike(board, site.piece.color, site.to, site.direction);
  return { board: result.board, events: result.events, nextSites: [] };
}
```

`resolveStrike` no cambia ni una línea (research.md explica por qué no hace falta).

## Rediseño: `testLevelSameColorCascade01` (`src/engine/level.ts`)

Antes: `pieces: [orange@(7,4), orange@(7,5)]`, `hand: ['green']`,
`objective: green@(7,4)` (la posición de la ficha lanzada — ya no alcanzable).

Después: mismas piezas y mano, objetivo distinto. Como ninguna ficha sobrevive en la fila 7
(las dos naranjas se aniquilan entre sí, la verde lanzada no se coloca), el resultado correcto
pasa a ser `'lost'` — y eso es exactamente lo que se verifica ahora:

```ts
export const testLevelSameColorCascade01: Level = createLevel({
  pieces: [
    { at: { row: 7, col: 4 }, color: 'orange' },
    { at: { row: 7, col: 5 }, color: 'orange' },
  ],
  hand: ['green'],
  objective: { at: { row: 0, col: 0 }, color: 'green' }, // inalcanzable a propósito
});
```

`same-color.test.ts` pasa a verificar: `cells[7][4]` y `cells[7][5]` ambas `null`, los eventos
incluyen tanto `MOVE_STEP` (el empuje inicial hacia la segunda naranja) como `ANNIHILATION`, la
mano queda vacía, y el resultado es `'lost'`.

## Rediseño: niveles 3 y 7 del prototipo (`src/levels/prototype-levels.ts`)

Ambos pasan de "un solo lanzamiento donde el lanzador se queda en la celda objetivo" a "dos
lanzamientos: el primero aniquila un obstáculo del mismo color como PRIMER impacto (no en
cascada), el segundo empuja una ficha real hasta el objetivo" — mismo patrón ya usado con éxito
en el nivel 10.

**Nivel 3** (antes: orange×2 en cascada, objetivo en la posición del lanzador verde):

```ts
{
  id: 3,
  level: createLevel({
    pieces: [
      { at: { row: 2, col: 2 }, color: 'green' },  // obstáculo, mismo color que hand[0]
      { at: { row: 2, col: 5 }, color: 'green' },  // ficha real a empujar
    ],
    hand: ['green', 'orange'],
    objective: { at: { row: 2, col: 7 }, color: 'green' },
  }),
},
```

Lanzamiento 1 (`E`, carril 2): verde golpea al verde obstáculo en `(2,2)` — mismo color, primer
impacto → ambas desaparecen. Lanzamiento 2 (`E`, carril 2): naranja golpea al verde restante en
`(2,5)` — distinto color → lo empuja 2 casillas hasta `(2,7)`, vacía → `'won'`.

**Nivel 7** (antes: green×2 en cascada, objetivo en la posición del lanzador naranja):

```ts
{
  id: 7,
  level: createLevel({
    pieces: [
      { at: { row: 5, col: 3 }, color: 'orange' }, // obstáculo, mismo color que hand[0]
      { at: { row: 5, col: 6 }, color: 'orange' }, // ficha real a empujar
    ],
    hand: ['orange', 'green'],
    objective: { at: { row: 5, col: 7 }, color: 'orange' },
  }),
},
```

Lanzamiento 1 (`E`, carril 5): naranja golpea al naranja obstáculo en `(5,3)` — mismo color,
primer impacto → ambas desaparecen. Lanzamiento 2 (`E`, carril 5): verde golpea a la naranja
restante en `(5,6)` — distinto color → la empuja 1 casilla hasta `(5,7)`, vacía → `'won'`.

Los niveles 1, 2, 4, 5, 6, 8, 9 y 10 no cambian — ya usaban el objetivo sobre la ficha empujada
(defensora), nunca sobre la ficha lanzada, así que ya eran válidos bajo la regla corregida (se
reverifica programáticamente en la fase de implementación, igual que en 005).
