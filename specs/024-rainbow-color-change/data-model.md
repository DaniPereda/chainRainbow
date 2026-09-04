# Phase 1 Data Model: Ficha Arcoíris (Cambio de Color)

## Entidades

### `PieceColor` (extendida)

`src/engine/board.ts` — gana `'rainbow'` como sexto valor, junto a `'green' | 'orange' | 'brown' |
'red' | 'black'`. Ningún otro campo de `Piece` (`fragility`) cambia — arcoíris usa la misma
fragilidad que cualquier otro color, aunque (Decisión 4/2 de research.md) nunca llega a asentarse
tras un impacto en ninguno de los dos roles: la que sobrevive es siempre la OTRA ficha
(recoloreada), nunca la arcoíris en sí.

### `ColorChoiceEvent` (`ChainEvent`, nuevo tercer variante)

```ts
// src/engine/events.ts
export type ColorChoiceEvent = {
  type: 'COLOR_CHOICE';
  at: Coordinate;
  fromColor: PieceColor;   // el color que tenía la ficha antes (para animar la transición)
  toColor: PieceColor;      // el color elegido por el jugador
};

export type ChainEvent = MoveStepEvent | AnnihilationEvent | ColorChoiceEvent;
```

(`fromColor`/`toColor`, no `from`/`to` -- esos nombres ya los usa cualquier otro `ChainEvent` para
una `Coordinate`; reutilizarlos aquí para un `PieceColor` envenenaría `ChainEvent.from`/`.to` en
una unión `Coordinate | PieceColor` en cualquier consumidor que discrimine por `event.type`.)

Un único evento por elección de color, en la casilla de la ficha DEFENSORA (la que cambia). La
ficha que no sobrevive genera su propio `ANNIHILATION` normal, `from === at` (mismo patrón que la
ficha disparadora consumida en la limpieza de línea de negro, spec.md 023) — nunca un
`ColorChoiceEvent`. `ColorChoiceEvent` nunca aparece en el `EventLog` de una cadena que no tocó
arcoíris; los `switch`/`if` exhaustivos existentes sobre `ChainEvent.type`
(`launch-animation.ts`) deben añadir esta rama explícitamente (ver sección Renderer).

### `ImpactResolution` (nuevo, sustituye la forma de retorno implícita de `ImpactHandler`)

```ts
// src/engine/events.ts
export type ImpactResolution =
  | { status: 'resolved'; board: Board; events: ChainEvent[]; nextSites: ImpactSite[] }
  | {
      status: 'pending-color-choice';
      board: Board;               // estado resuelto hasta este punto (aún no incluye el cambio)
      events: ChainEvent[];       // eventos acumulados hasta este punto
      at: Coordinate;             // casilla de la ficha que va a cambiar
      options: PieceColor[];      // todos los colores excepto 'rainbow', orden fijo
      resume: (color: PieceColor) => ImpactResolution;
    };

export type ImpactHandler = (board: Board, site: ImpactSite) => ImpactResolution;
```

`options` se deriva de una lista fija y ordenada de todos los `PieceColor` existentes menos
`'rainbow'` (`['green', 'orange', 'brown', 'red', 'black']`, en ese orden) — no depende del
tablero ni de la mano; siempre las mismas 5 opciones.

### `resolveChain` (tipo de retorno extendido con el mismo `status`)

```ts
// src/engine/events.ts
export function resolveChain(
  board: Board,
  initialSites: ImpactSite[],
  handleImpact: ImpactHandler,
  handleMutualImpact: MutualImpactHandler,
): ImpactResolution // reutiliza el mismo tipo -- 'resolved' nunca lleva `at`/`options`/`resume`
```

Antes devolvía `{board, events}` a secas. Ahora, si `handleImpact` devuelve
`'pending-color-choice'` para el sitio que le tocaba, el `while` se detiene en ese punto y
devuelve `'pending-color-choice'` con el mismo `board`/`events` acumulados hasta ahí más
`at`/`options`, y un `resume(color)` que:

1. Llama al `resume` del `ImpactResolution` pendiente original con `color`, obteniendo un nuevo
   `ImpactResolution` (`'resolved'` con `nextSites`, o -- si esa ficha recolor generó código
   pendiente en cascada, lo cual no ocurre por FR-007, pero el tipo lo permite por si un futuro
   color especial lo necesitara -- otra vez `'pending-color-choice'`).
2. Si es `'resolved'`: añade sus `events`/`nextSites` a los ya acumulados por clausura (el resto
   de la cola tal y como quedó cuando se pausó) y CONTINÚA el mismo `while` desde ahí --
   exactamente como si `handleImpact` hubiera devuelto ese resultado la primera vez.
3. Si es `'pending-color-choice'` de nuevo: se propaga tal cual, con un nuevo `resume` que
   encadena el paso 1 otra vez.

`resolveRedSplit` (`push.ts`) reenvía el resultado de su propia llamada interna a `resolveChain`
sin envolverlo (mismo `status`) — es el único punto donde el resultado de una cadena ANIDADA
(las dos ramas perpendiculares de rojo) debe reenviarse manualmente hacia la cadena externa, en la
rama de `applyImpact` que llama a `resolveRedSplit` (ver research.md, Decisión 1).

### `LaunchOutcome` (extendido con un campo opcional, forma existente sin cambios)

```ts
// src/engine/resolve-launch.ts
export type PendingColorChoice = {
  at: Coordinate;
  options: PieceColor[];
  resume: (color: PieceColor) => LaunchOutcome;
};

export type LaunchOutcome = {
  board: Board;
  hand: Hand;
  events: EventLog;
  missclick: boolean;
  result: LevelResult;
  pendingColorChoice?: PendingColorChoice; // NUEVO, ausente salvo que la cadena toque arcoíris
};
```

`resolveLaunch` construye `pendingColorChoice.resume` envolviendo el `resume` de
`resolveChain`/`ImpactResolution`: cuando ese `resume` interno devuelve `'resolved'`, empaqueta
`{board, hand: finalHand, events, missclick: false, result: evaluateGoal(...)}` igual que el
`return` final ya existente; si devuelve `'pending-color-choice'` de nuevo, empaqueta OTRO
`LaunchOutcome` con su propio `pendingColorChoice`.

## Reglas de validación / invariantes

- `at`/`options` de un `PendingColorChoice` siempre reflejan la ficha DEFENSORA del impacto de
  arcoíris (Decisión 2 de research.md) — nunca la propia arcoíris que va a desaparecer.
- `options` nunca incluye `'rainbow'` ni depende del estado del tablero/mano — siempre las mismas
  5 entradas, mismo orden, para que la UI (y los tests) sean deterministas (Principio III).
- Mientras un `LaunchOutcome` tenga `pendingColorChoice` definido, ningún llamador debe leer
  `result`/`missclick` como si fueran el resultado final del lanzamiento, ni debe comprometer ese
  `board`/`hand` en el estado persistente de la sesión (`LevelSession`) — ver `commitLaunchOutcome`
  más abajo.
- Un impacto de arcoíris nunca produce `nextSites` propios (FR-007) — el `ImpactResolution`
  `'resolved'` que sigue a un `resume(color)` siempre trae `nextSites: []` para ESE sitio
  concreto (puede seguir habiendo otros sitios ya en la cola, de antes de la pausa).
- Arcoíris contra arcoíris se resuelve por la regla de mismo color ya existente, comprobada ANTES
  que la rama de cambio de color — nunca se llega a construir un `ImpactResolution`
  `'pending-color-choice'` en ese caso (FR-008).
- Arcoíris implicada junto con negro: gana negro (comprobado antes en `applyImpact`, sin cambios
  de negro) — nunca se llega a construir un `'pending-color-choice'` de arcoíris en ese caso
  (FR-009).
- Arcoíris implicada junto con rojo: gana arcoíris (comprobado antes que la rama de rojo) — rojo
  nunca llega a `resolveRedSplit` en ese caso (FR-010).

## Session / renderer (integración)

### `commitLaunchOutcome` (nuevo, extraído de `applySessionLaunch`)

```ts
// src/engine/session.ts
export function commitLaunchOutcome(session: LevelSession, outcome: LaunchOutcome): LevelSession {
  const current: Level = { board: outcome.board, hand: outcome.hand, goal: session.current.goal };
  const selectedHandIndex = outcome.missclick ? session.selectedHandIndex : firstHandIndex(current.hand);
  return { ...session, current, status: outcome.result, selectedHandIndex };
}
```

`applySessionLaunch` pasa a llamar a `resolveLaunch` y, si `outcome.pendingColorChoice` está
definido, devuelve `{session (sin tocar), outcome}` tal cual — el llamador (`BoardScene`) es quien
decide cuándo, tras resolver la elección, invocar `commitLaunchOutcome` con el `outcome` final.

### `BoardScene.launch()` (bucle nuevo alrededor de la reproducción de eventos)

Reemplaza la única llamada a `playEventLog` de hoy por un bucle que:

1. Reproduce `outcome.events.slice(playedCount)` con `playEventLog` y actualiza `playedCount`.
2. Si `outcome.pendingColorChoice`, abre el diálogo flotante de color anclado en
   `pendingColorChoice.at` (ver Renderer) y, al elegir un color, llama a
   `pendingColorChoice.resume(color)` para obtener el siguiente `outcome`, y vuelve al paso 1.
3. Si no, llama a `commitLaunchOutcome` y continúa con el resto del flujo ya existente (redraw,
   comprobación de victoria/derrota) — sin cambios respecto a hoy.

## Renderer (integración mínima)

- `src/renderer/board-view.ts`: `PIECE_COLOR` gana una entrada `rainbow: 0xb26bff` (violeta claro,
  distinguible de los 5 colores ya usados incluido `black: 0x4b4b55` — a confirmar visualmente
  contra el fondo real del tablero en tasks.md).
- `src/renderer/sound-effects.ts`: nuevo `playRainbowSound()`, disparado una vez por
  `ColorChoiceEvent` (nunca `playImpactSound` para este caso).
- `src/renderer/launch-animation.ts`: `runEvent()` gana una rama nueva para
  `event.type === 'COLOR_CHOICE'` — sin desplazamiento (`walkPath`/`cellPath` no se invocan en
  absoluto, igual que el guard `from === at` ya existente para `ANNIHILATION`): la ficha en `at`
  cambia visualmente de `event.from` a `event.to` (p. ej. un breve flash/tween de color sobre el
  círculo ya dibujado en esa casilla) y se reproduce `playRainbowSound()`.
- Nuevo componente de UI, el diálogo flotante de selección de color (una escena/overlay de Phaser
  propia, ver quickstart.md) — el único elemento de esta feature que vive puramente en
  `src/renderer/`, sin ninguna contraparte en el motor más allá de leer `options`/`at`.
- `tools/generator/obligations.ts`: mismo guard defensivo que ya existe para `'black'`, extendido
  a `'rainbow'` (Decisión 9 de research.md) — sin efecto práctico hoy.
