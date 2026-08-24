# Phase 1 Data Model: Selección Libre de Ficha en Mano

## Cambio de tipo: `LevelSession` (`src/engine/session.ts`)

```ts
export type LevelSession = {
  initial: Level;
  current: Level;
  status: LevelResult;
  selectedHandIndex: number | null; // null solo cuando current.hand.pieces está vacía
};
```

## Nueva función: `selectHandPiece` (`src/engine/session.ts`)

```ts
export function selectHandPiece(session: LevelSession, index: number): LevelSession {
  if (index < 0 || index >= session.current.hand.pieces.length) {
    return session; // toque sobre una posición que ya no existe -- no-op, defensivo
  }
  return { ...session, selectedHandIndex: index };
}
```

## Cambio: `startSession` / `applySessionLaunch` / `restartSession` (`src/engine/session.ts`)

- `startSession(level)`: `selectedHandIndex` inicial = `level.hand.pieces.length > 0 ? 0 : null`.
- `applySessionLaunch(session, launch)`: pasa `session.selectedHandIndex ?? 0` como `pieceIndex`
  a `resolveLaunch`. Tras el resultado:
  - `outcome.missclick === true` → `selectedHandIndex` no cambia.
  - si no → `selectedHandIndex` = `outcome.hand.pieces.length > 0 ? 0 : null`.
- `restartSession(session)`: reconstruye `selectedHandIndex` igual que `startSession(session.initial)`.

## Cambio de firma: `resolveLaunch` (`src/engine/resolve-launch.ts`)

```ts
export function resolveLaunch(
  level: Level,
  launch: Launch,
  pieceIndex: number = 0,
): LaunchOutcome
```

Usa `level.hand.pieces[pieceIndex]` como la ficha del `ImpactSite`, y `takePieceAt(level.hand,
pieceIndex)` en vez de `takeFirstPiece(level.hand)`. `Launch` (`{direction, lane}`) no cambia de
forma. Retrocompatible: cualquier llamada existente sin tercer argumento sigue usando índice 0.

## Cambio: `takeFirstPiece` → `takePieceAt` (`src/engine/launch.ts`)

```ts
export function takePieceAt(hand: Hand, index: number): { piece: Piece; hand: Hand } {
  const piece = hand.pieces[index];
  const rest = hand.pieces.filter((_, i) => i !== index);
  return { piece, hand: { pieces: rest } };
}
```

## Cambio de firma: `drawHand` (`src/renderer/hand-panel.ts`)

```ts
export function drawHand(
  graphics: Phaser.GameObjects.Graphics,
  hand: Hand,
  selectedIndex: number | null,
): { x: number; y: number }[]
```

Dibuja los círculos de siempre, más un anillo (`lineStyle(3, HAND_SELECTION_RING_COLOR, 1)` +
`strokeCircle`, radio `PIECE_RADIUS + 4`) alrededor de la ficha en `selectedIndex` (si no es
`null`). Devuelve el centro local `{x, y}` de cada ficha dibujada, mismo orden que
`hand.pieces`, para que `BoardScene.ts` construya las zonas táctiles sin duplicar el cálculo de
layout (research.md).

## Cambio: `BoardScene.ts`

Nuevo campo `private handHitZones: Phaser.GameObjects.Zone[] = []`. En `redraw()`, tras llamar a
`drawHand` (ahora devuelve las posiciones), destruye las zonas anteriores y crea una zona
interactiva por ficha en la posición mundial correspondiente (origen del panel + posición local
devuelta), con un `pointerdown` que llama a `selectHandPiece(this.session, index)` + `redraw()`.
Ningún cambio en los marcadores de borde del tablero ni en `launch()`.

## Fixtures de test

Todas verificadas a mano paso a paso (mismo rigor que las fixtures de motor de features
anteriores):

**1. `selectHandPiece` cambia la selección a una posición válida** (US1, motor puro, sin
lanzamiento):
- `session` con `hand:['green','orange']`, `selectedHandIndex: 0`.
- `selectHandPiece(session, 1)` → `selectedHandIndex: 1`, resto del `session` sin cambios.

**2. `selectHandPiece` con una posición fuera de rango es un no-op** (defensivo):
- `session` con `hand:['green']`, `selectedHandIndex: 0`.
- `selectHandPiece(session, 5)` → `session` devuelto es exactamente el mismo (`selectedHandIndex`
  sigue en `0`).

**3. `resolveLaunch` con `pieceIndex` no-cero usa esa ficha, no la primera** (US1, prueba que el
parámetro realmente se respeta):
- `pieces: [{at:{row:3,col:3},color:'brown'}]`, `hand:['green','orange']`.
- `resolveLaunch(level, {direction:'E', lane:3}, 1)`: la ficha usada es `hand.pieces[1]`
  (orange, distancia 2), NO `hand.pieces[0]` (green, distancia 1) — si se usara green por error,
  brown terminaría en col4, no en col5.
- Resultado esperado: `cells[3][3]` null, `cells[3][5]`=brown (empuje de distancia 2, confirma
  que fue orange quien golpeó), `hand.pieces`=`[{color:'green'}]` (orange consumida, green
  conserva su posición relativa).

**4. Determinismo con `pieceIndex` no-cero** (Principio III, mismo patrón que
`determinism.test.ts`):
- Reutiliza la fixture 3. Llamar a `resolveLaunch` dos veces con el mismo `level`, `launch`, y
  `pieceIndex:1`; confirmar resultado estructuralmente idéntico ambas veces.

**5. `applySessionLaunch` usa automáticamente la ficha seleccionada, sin pasar `pieceIndex` a
mano** (US1, extremo a extremo):
- `session` con `hand:['green','orange']`, tras `selectHandPiece(session, 1)`.
- Mismo escenario de la fixture 3 (`pieces:[{at:{row:3,col:3},color:'brown'}]`).
- `applySessionLaunch(session, {direction:'E', lane:3})` produce el mismo resultado que la
  fixture 3 — la selección de sesión se propaga sola, sin que el llamador especifique nada más.

**6. Tras consumir la ficha seleccionada, la selección avanza a la primera restante** (US3
AC1) — reutiliza el nivel de la fixture 3 (`pieces:[{at:{row:3,col:3},color:'brown'}]`,
`hand:['green','orange']`):
- `session` construida sobre ese nivel, tras `selectHandPiece(session, 1)` (orange
  seleccionada).
- `applySessionLaunch(session, {direction:'E', lane:3})` (mismo lanzamiento no-missclick de la
  fixture 3/5): `hand` resultante es `['green']`, y `selectedHandIndex` pasa a `0` (apunta a
  green, la única que queda) — nunca se queda apuntando a orange, ya consumida.

**7. Un missclick no cambia la selección** (US3 AC2) — mismo nivel que la fixture 3:
- `session` sobre ese nivel, tras `selectHandPiece(session, 1)` (`selectedHandIndex:1`).
- `applySessionLaunch(session, {direction:'E', lane:0})` (carril vacío, ningún impacto):
  `outcome.missclick===true`, `hand` sin cambios, `selectedHandIndex` sigue en `1`.

**8. La mano vacía deja la selección en `null`** (US3 AC3):
- `session` con `hand:['green']` sobre un nivel de una sola ficha (p. ej. `testLevelGreen01`),
  `selectedHandIndex:0`.
- Tras un lanzamiento que consume esa única ficha (no missclick): `hand.pieces` queda vacía,
  `selectedHandIndex` pasa a `null`.

**9. `restartSession` resetea la selección al estado inicial** (Edge case: reinicio):
- `session` con `hand` inicial `['green','orange']` (nivel de la fixture 3), tras seleccionar y
  lanzar orange (estado de la fixture 6: `selectedHandIndex` en `0`, `hand` en `['green']`).
- `restartSession(session)` → `hand` vuelve a `['green','orange']` y `selectedHandIndex` vuelve a
  `0` — el mismo estado que produciría `startSession(session.initial)`.
