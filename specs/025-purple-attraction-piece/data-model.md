# Phase 1 Data Model: Ficha Púrpura (Atracción)

## Entidades

### `PieceColor` (extendida)

```ts
// src/engine/board.ts
export type PieceColor = 'green' | 'orange' | 'brown' | 'red' | 'black' | 'rainbow' | 'purple';
```

Séptimo valor, junto a los seis ya existentes. Ningún otro campo de `Piece` cambia -- `Fragility`
no gana ningún valor nuevo; púrpura usa el mismo tipo `'new' | 'cracked' | 'broken'` de siempre,
solo que el nivel/mano que la reparte DEBE fijarla en `'broken'` (spec.md FR-002, research.md
Decisión 6 -- una restricción de datos, no un valor nuevo de tipo).

### `ImpactSite.attracting` (nuevo campo opcional, hermano de `walking`)

```ts
// src/engine/events.ts
export type ImpactSite = {
  piece: Piece;
  direction: Direction;
  from: Coordinate;
  to: Coordinate;
  pushedByColor?: PieceColor;
  walking?: { edgeCrossings: number };
  // Presente SOLO en una de las dos fichas atraídas por una púrpura, mientras
  // viaja hacia la celda de atracción -- `to` es, igual que en `walking`, un
  // paso tentativo de una celda, no el destino final, pero a diferencia de
  // `walking` el destino SÍ se conoce de antemano (la celda de atracción) y el
  // recorrido tiene una fase de espera inicial para que ambas fichas atraídas
  // -- aunque partan a distinta distancia -- completen su avance real en el
  // mismo número de ciclos de cola (research.md Decisión 2). `padSteps` se
  // decrementa sin mover `to` mientras sea > 0; agotado, cada ciclo avanza una
  // celda en `direction` con `step`/`isInBounds` LLANO (move-step.ts) -- SIN
  // wrap-around ni tope de vueltas, a diferencia de `stepWalking` (marrón): el
  // camino de vuelta siempre cae dentro del tablero por construcción
  // (confirmado con el usuario, spec.md Clarifications).
  attracting?: { padSteps: number };
  visualOrigin?: { from: Coordinate; direction: Direction };
};
```

No se toca `walking` ni ninguna otra parte de `ImpactSite` -- son variantes hermanas,
mutuamente excluyentes en la práctica (un sitio nunca lleva `walking` Y `attracting` a la vez).

### `applyImpact` (nueva rama dentro de `defender === null`, sin nueva firma)

`src/engine/pieces/push.ts`, dentro del `if (defender === null)` ya existente
(`applyImpact`, junto al `if (site.walking !== undefined)` de marrón): un `if (site.attracting
!== undefined)` hermano que, mientras `padSteps > 0`, decrementa y reencola sin mover `to` ni
emitir evento; agotado el padding, avanza `to` una celda en `site.direction` (como
`stepWalking`) y reencola sin evento hasta llegar a la celda de atracción, momento en el que dos
sitios `attracting` que comparten esa `to` (vacía, porque la púrpura ya desapareció) son
capturados por `findCoincidingPair` -- YA EXISTENTE, sin cambios -- antes de que ninguno de los
dos se resuelva en solitario. Ningún cambio de firma en `applyImpact`, `resolveChain`,
`ImpactHandler` ni `MutualImpactHandler`.

### `AnnihilationEvent` (sin cambios de forma, nuevo valor de `color`)

La travesía + desaparición de la propia púrpura (research.md Decisión 3) se emite como un
`AnnihilationEvent` normal (`src/engine/events.ts`, forma ya existente) con `color: 'purple'`.
Ningún campo nuevo. `ChainEvent` no gana ningún variante nuevo -- sigue siendo
`MoveStepEvent | AnnihilationEvent | ColorChoiceEvent`.

### Camino de lanzamiento (nuevo, junto al ya existente)

```ts
// src/engine/pieces/purple.ts (nuevo)
type PurpleSettleResult =
  | { status: 'settled'; at: Coordinate; leftPiece: Coordinate; rightPiece: Coordinate }
  | { status: 'missclick' };

function scanPurpleSettle(board: Board, entry: Coordinate, direction: Direction): PurpleSettleResult;
```

Consumida por una variante de `resolveLaunch` (`src/engine/resolve-launch.ts`) que, para
`piece.color === 'purple'`, llama a esta función en vez de `travelLaunch`: en `'missclick'`
devuelve el mismo `LaunchOutcome` de missclick ya existente (board/hand intactos); en `'settled'`
construye los dos `ImpactSite` `attracting` iniciales (uno por cada ficha encontrada, `padSteps`
calculado a partir de la diferencia de distancias, research.md Decisión 2) y entra en
`resolveChain` con ellos, más el `AnnihilationEvent` de la propia púrpura ya incluido en el
`board`/`events` de partida (igual que arcoíris incluye su propio `ANNIHILATION` antes de pausar,
024, research.md Decisión 10). No se reutiliza `travelLaunch` ni `applyImpact` para el
lanzamiento de púrpura en sí -- sí se reutilizan íntegramente para el choque final entre las dos
fichas atraídas, vía `resolveChain`/`applyMutualImpact`.

### `Hand`/`Level` (sin cambios de forma)

Ningún campo nuevo -- `'purple'` es simplemente un `PieceColor` más, elegible en `hand.pieces`
como cualquier otro. La restricción "solo en mano, nunca en el tablero de un nivel" (FR-002) no
se impone con un tipo nuevo -- ningún nivel de autor la coloca ahí, igual que negro/arcoíris no
tienen ninguna restricción de tipo que les impida aparecer en el tablero, solo la convención de
autoría (research.md de 023/024).

## Renderer (referencia, detalle en plan.md)

- `PIECE_COLOR`/`drawPieceCircle` (`board-view.ts`) ganan `'purple'` -- un color propio,
  distinguible de `'rainbow'` y de `'black'`.
- `sound-effects.ts` gana `playPurpleSound()`.
- `launch-animation.ts`'s despacho de `ANNIHILATION` gana una rama por `event.color === 'purple'`
  (research.md Decisión 4) -- reutiliza el "entry glide" ya existente, sin animación nueva.
