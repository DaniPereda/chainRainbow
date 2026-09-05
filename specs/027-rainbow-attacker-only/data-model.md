# Phase 1 Data Model: Arcoíris Solo Actúa Como Atacante

## Tipos modificados

### `MutualImpactHandler` (`src/engine/events.ts`)

```ts
// ANTES
export type MutualImpactHandler = (
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
) => { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] };

// DESPUÉS -- unificado con ImpactResolution (research.md Decisión 2)
export type MutualImpactHandler = (
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
) => ImpactResolution;
```

Ningún otro tipo de `events.ts` cambia -- `ImpactResolution`, `ChainEvent`, `ImpactSite` ya tienen
exactamente la forma que hace falta. **No se añade ningún variante nuevo de `ChainEvent`**: el
paso 1 de la nueva secuencia produce un `COLOR_CHOICE` (ya existente) más un `ANNIHILATION` para la
arcoíris consumida (ya existente); el paso 2 produce lo que ya producían las ramas de
verde/naranja/marrón (`MOVE_STEP`), rojo (dos `MOVE_STEP`, uno por rama) o negro (`ANNIHILATION` de
disparo más una por cada celda barrida) -- todos ya existentes.

### `drive` (`src/engine/events.ts`, sin cambio de firma, cambio de cuerpo)

La rama de colisión mutua pasa a comprobar `result.status`, igual que ya hace la rama de impacto
simple, reutilizando el `pendingFrom` ya existente sin ningún cambio en su propia firma ni lógica:

```ts
const result = handleMutualImpact(currentBoard, siteA, siteB);
if (result.status === 'pending-color-choice') {
  return pendingFrom(events, queue, result, handleImpact, handleMutualImpact);
}
currentBoard = result.board;
events.push(...result.events);
queue.push(...result.nextSites);
```

## Funciones nuevas (`src/engine/pieces/push.ts`)

### `buildColorChoicePause` (extraída de la rama de arcoíris de `applyImpact`)

```ts
function buildColorChoicePause(
  defender: Piece,
  at: Coordinate,
  vanishedAttacker: ChainEvent,
  boardBeforePause: Board,
): Extract<ImpactResolution, { status: 'pending-color-choice' }> {
  const options: PieceColor[] = ['green', 'orange', 'brown', 'red', 'black'];
  const from = defender.color;
  const boardDuringPause = setPieceAt(boardBeforePause, at, null);
  const resume = (color: PieceColor): ImpactResolution => {
    const recolored: Piece = { color, fragility: defender.fragility };
    const boardAfter = setPieceAt(boardDuringPause, at, recolored);
    const colorChoiceEvent: ChainEvent = { type: 'COLOR_CHOICE', at, fromColor: from, toColor: color };
    return { status: 'resolved', board: boardAfter, events: [colorChoiceEvent], nextSites: [] };
  };
  return { status: 'pending-color-choice', board: boardDuringPause, events: [vanishedAttacker], at, options, resume };
}
```

`applyImpact`'s propia rama de arcoíris (línea 556 en adelante, hoy) pasa a llamar a esta función
en vez de construir la pausa inline -- comportamiento IDÉNTICO, solo extraído para poder reutilizarlo.
La `resume` que esta función devuelve es exactamente la de hoy (fragilidad de `defender` sin
cambios, `nextSites: []`) -- research.md Decisión 3/6.

### `clearLineFrom` (extraída de la rama de negro de `applyImpact`)

```ts
function clearLineFrom(
  board: Board,
  at: Coordinate,
  direction: Direction,
  triggerEvent: ChainEvent,
): { board: Board; events: ChainEvent[] } {
  const { axis, index } = lineFromImpact(at, direction);
  const { board: clearedBoard, clearedCells } = clearLine(board, axis, index);
  const sweepEvents: ChainEvent[] = clearedCells.map((cell) => {
    const swept = getPieceAt(board, cell);
    if (swept === null) throw new Error('invariant violated: clearedCells cell was not occupied');
    return { type: 'ANNIHILATION', at: cell, color: swept.color, from: cell, direction };
  });
  return { board: clearedBoard, events: [triggerEvent, ...sweepEvents] };
}
```

`applyImpact`'s propia rama de negro (línea 483 en adelante, hoy) pasa a llamar a esta función para
construir `clearedBoard`/`events`, conservando exactamente la misma construcción de `triggerEvent`
que ya tiene (el disparo lleva `from`/`direction`/`pushedByColor`/`visualOrigin` de `site`, sin
cambios) -- comportamiento IDÉNTICO, solo extraído.

### `applyMutualImpact` -- nueva rama (research.md Decisión 3/4)

```ts
export function applyMutualImpact(board: Board, siteA: ImpactSite, siteB: ImpactSite): ImpactResolution {
  if (siteA.piece.color === siteB.piece.color) {
    return { status: 'resolved', board, events: [/* dos ANNIHILATION, sin cambios */], nextSites: [] };
  }

  if (siteA.piece.color === 'rainbow' || siteB.piece.color === 'rainbow') {
    const [rainbowSite, otherSite] = siteA.piece.color === 'rainbow' ? [siteA, siteB] : [siteB, siteA];
    const vanishedRainbow: ChainEvent = { type: 'ANNIHILATION', at: rainbowSite.to, color: 'rainbow', from: rainbowSite.from, direction: rainbowSite.direction, pushedByColor: rainbowSite.pushedByColor, visualOrigin: rainbowSite.visualOrigin };
    const pause = buildColorChoicePause(otherSite.piece, otherSite.to, vanishedRainbow, board);
    return {
      ...pause,
      resume: (color) => {
        const step1 = pause.resume(color);
        // step1.status es siempre 'resolved' (buildColorChoicePause nunca anida, research.md Decisión 3/6)
        return applyChosenColorToRainbow(step1.board, rainbowSite, { color, fragility: otherSite.piece.fragility }, step1.events);
      },
    };
  }

  // ...resto sin cambios (empuje mutuo genérico, vía strikeMutualSide dos veces)
}

function applyChosenColorToRainbow(
  board: Board,
  rainbowSite: ImpactSite,
  chosen: Piece,
  eventsSoFar: ChainEvent[],
): ImpactResolution {
  if (chosen.color === 'black') {
    const triggerEvent: ChainEvent = { type: 'ANNIHILATION', at: rainbowSite.to, color: 'rainbow', from: rainbowSite.from, direction: rainbowSite.direction, pushedByColor: rainbowSite.pushedByColor, visualOrigin: rainbowSite.visualOrigin };
    const { board: clearedBoard, events } = clearLineFrom(board, rainbowSite.to, rainbowSite.direction, triggerEvent);
    return { status: 'resolved', board: clearedBoard, events: [...eventsSoFar, ...events], nextSites: [] };
  }
  const result = strikeMutualSide(board, rainbowSite, { ...rainbowSite, piece: chosen, direction: rainbowSite.direction });
  return { status: 'resolved', board: result.board, events: [...eventsSoFar, ...result.events], nextSites: result.nextSite === null ? [] : [result.nextSite] };
}
```

`strikeMutualSide(board, hitSite=rainbowSite, strikerSite={piece: chosen, direction: rainbowSite.direction, ...})`
reutiliza el despacho ya existente para verde/naranja/marrón (empuje) y rojo (`resolveRedSplit`,
research.md Decisión 4) -- el `direction` sintetizado es el de `rainbowSite` (la dirección en la
que arcoíris viajaba), no la de `otherSite` (que ya se resolvió y asentó en el paso 1).

### `strikeMutualSide` -- nueva rama para `strikerSite.piece.color === 'black'`

```ts
if (strikerSite.piece.color === 'black') {
  // Alcanzable SOLO desde el paso 2 de applyMutualImpact's nueva rama de arcoíris
  // (research.md Decisión 4) -- negro real nunca puede ser uno de los dos lados
  // YA en vuelo de una colisión mutua (su propio impacto siempre termina, nunca
  // produce un nextSite); esa invariante original sigue vigente, esto es un
  // camino sintético distinto.
  const triggerEvent: ChainEvent = { type: 'ANNIHILATION', at: hitSite.to, color: hitSite.piece.color, from: hitSite.from, direction: hitSite.direction, pushedByColor: hitSite.pushedByColor, visualOrigin };
  const { board: clearedBoard, events } = clearLineFrom(board, hitSite.to, strikerSite.direction, triggerEvent);
  return { board: clearedBoard, events, nextSite: null };
}
```

Reemplaza el `throw new Error('invariant violated: black cannot be one side of a mutual collision')`
actual -- el comentario existente se actualiza para aclarar que la invariante sigue siendo cierta
para el caso ORIGINAL (negro como uno de los dos lados ya en vuelo desde el principio), y que esta
rama solo se alcanza por el camino sintético nuevo.

## Sin cambios

- `strikeMutualSide`'s ramas de verde/naranja/marrón/rojo/marrón(`walking`)/púrpura: sin cambios.
- El `throw` de `strikeMutualSide` para `strikerSite.piece.color === 'rainbow'` ("rainbow cannot be
  one side of a mutual collision"): **se elimina** -- ya no es cierto, una arcoíris desplazada
  (Decisión 1) puede legítimamente llegar a esta función como uno de los dos lados ya en vuelo. Con
  la nueva rama de `applyMutualImpact` (que intercepta el caso "un lado es arcoíris" ANTES de llamar
  a `strikeMutualSide` dos veces), `strikeMutualSide` nunca vuelve a recibir arcoíris como
  `strikerSite` NI como `hitSite` por el camino genérico -- así que, en la práctica, esta rama queda
  inalcanzable de nuevo, pero por una razón distinta (interceptada antes, no porque sea imposible) y
  ya no hace falta que lance una excepción -- se elimina en vez de mantenerla como advertencia falsa.
- El `throw` de `strikeMutualSide` para `strikerSite.piece.color === 'red'` cuyo `resolveRedSplit`
  interno alcanza una pausa de arcoíris anidada: sin cambios (research.md Decisión 5, fuera de
  alcance deliberadamente).
- `applyImpact`'s ramas de rojo, negro (ahora vía `clearLineFrom`), empuje genérico: sin cambios de
  comportamiento, solo la extracción de `clearLineFrom`/`buildColorChoicePause`.
