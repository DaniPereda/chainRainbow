# Phase 1 Data Model: Resolución de Cadenas por Cola de Fichas en Tránsito

## Tipos públicos -- sin cambios (FR-013)

`Board`, `Piece`, `Coordinate` (`src/engine/board.ts`), `ChainEvent`/`MoveStepEvent`/`AnnihilationEvent`/`EventLog`/`ImpactSite`/`ImpactHandler` (`src/engine/events.ts`), `LaunchOutcome` (`src/engine/resolve-launch.ts`) -- ninguno cambia de forma. `resolveChain` (`src/engine/events.ts`) tampoco cambia -- ya es exactamente el bucle de cola que esta feature necesita, solo que hoy nadie lo usa como tal (`applyImpact` siempre devuelve `nextSites: []`).

## Función reescrita: `applyImpact` (`src/engine/pieces/push.ts`)

Firma sin cambios (sigue siendo un `ImpactHandler` válido):

```ts
export function applyImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] }
```

**Contrato nuevo**: resuelve exactamente UN impacto -- qué le pasa a `site.piece` al llegar a `site.to`, y qué le pasa al ocupante que encuentre ahí (si lo hay), SIN recursar para seguir la cadena. Si el ocupante desplazado necesita seguir moviéndose, se devuelve como la única entrada de `nextSites` -- la cola de `resolveChain` (ya existente, sin cambios) se encarga de procesarla a continuación.

```ts
function applyImpact(board, site) {
  const defender = getPieceAt(board, site.to);

  // Caso base: destino vacío -- site.piece se asienta, sin más trabajo.
  if (defender === null) {
    return settleOrVanish(board, site.piece, site.from, site.to, /* hasCollision */ false);
  }

  // Mismo color: aniquilación mutua, sin más trabajo.
  if (defender.color === site.piece.color) {
    const boardAfter = setPieceAt(board, site.to, null);
    return { board: boardAfter, events: [{ type: 'ANNIHILATION', at: site.to, color: site.piece.color }], nextSites: [] };
  }

  // Distinto color: el defensor avanza de fragilidad y se retira del tablero --
  // ahora es una "ficha en tránsito" (Key Entities de spec.md), no un dato nuevo,
  // solo el propio `site.piece`/`hitDefender` en su siguiente ImpactSite.
  const hitDefender = { color: defender.color, fragility: advance(defender.fragility) };
  const vacated = setPieceAt(board, site.to, null);

  // site.piece se asienta de inmediato -- esta decisión NUNCA dependió de nada más
  // profundo (research.md, Decisión 3): solo de si SU PROPIO golpe fue aniquilación,
  // ya resuelto arriba.
  const { board: boardWithStriker, events: strikerEvents } =
    settleOrVanish(vacated, site.piece, site.from, site.to, /* hasCollision */ true);

  if (site.piece.color === 'red') {
    return resolveRedSplit(boardWithStriker, hitDefender, site.to, site.direction, strikerEvents);
  }

  if (hitDefender.fragility === 'broken') {
    return { board: boardWithStriker, events: strikerEvents, nextSites: [] };
  }

  const to = PUSH_STRATEGY[site.piece.color](vacated, hitDefender, site.to, site.direction);
  const nextSite: ImpactSite = { piece: hitDefender, direction: site.direction, from: site.to, to };
  return { board: boardWithStriker, events: strikerEvents, nextSites: [nextSite] };
}
```

`settleOrVanish` es un pequeño helper (privado) que encapsula el patrón ya existente "se asienta salvo que esté `broken`, en cuyo caso desaparece sin evento" -- usado hoy tres veces de forma casi idéntica en distintos puntos de `resolveStrike`/`resolveBranch`/`applyImpact`; con este rediseño se unifica en un único sitio (Principio V).

## Función nueva (privada): `resolveRedSplit`

Sustituye a `resolveSplit`/`resolveBranch`. Reutiliza `resolveChain` -- la misma función genérica, importada desde `../events.js` -- una vez por rama, de forma estrictamente secuencial (research.md, Decisión 4):

```ts
function resolveRedSplit(
  board: Board,
  hitDefender: Piece,
  position: Coordinate,
  direction: Direction,
  strikerEvents: ChainEvent[],
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction]; // sin cambios

  const firstBranch = resolveChain(
    board,
    { piece: hitDefender, direction: first, from: position, to: stepBy(position, first, 1) },
    applyImpact, // la misma función -- red no es un caso especial de applyImpact, Principio V
  );
  const secondBranch = resolveChain(
    firstBranch.board,
    { piece: hitDefender, direction: second, from: position, to: stepBy(position, second, 1) },
    applyImpact,
  );

  return {
    board: secondBranch.board,
    events: [...strikerEvents, ...firstBranch.events, ...secondBranch.events],
    nextSites: [], // ambas ramas ya están completamente resueltas
  };
}
```

`firstBranch` se drena por completo (su propia cola interna de `resolveChain`, hasta vaciarse) antes de que `secondBranch` empiece a construirse -- FR-005 de 009-red-piece se preserva exactamente, sin ningún mecanismo nuevo: es la misma garantía que `resolveChain` ya ofrece para CUALQUIER cadena, aplicada aquí dos veces seguidas en vez de una.

## Funciones eliminadas

`resolveStrike`, `resolveBranch`, `resolveSplit` (las tres actuales en `push.ts`) se eliminan -- su lógica queda absorbida en `applyImpact` + `resolveRedSplit`, reutilizando `resolveChain` en vez de la recursión mutua que tenían entre sí.

## Funciones sin cambios

- `advance` (`push.ts`) -- sin cambios, sigue siendo `'new'|'cracked' → 'cracked'|'broken'`.
- `PUSH_STRATEGY` (`push.ts`) -- sin cambios en las tres estrategias (`green`: `stepBy` 1 casilla; `orange`: `stepBy` 2 casillas; `brown`: `stepUntilBlocked` con `MAX_EDGE_CROSSINGS`).
- `PERPENDICULAR_DIRECTIONS` (`push.ts`) -- sin cambios.
- `stepUntilBlocked`/`stepBy`/`step`/`wrapCoordinate` (`move-step.ts`, `board.ts`) -- **cero cambios de firma ni de lógica** (FR-006). Como ya no existe el concepto de "reserva sin ficha real", el tablero que consultan siempre es exacto -- vacío de verdad, o una ficha real y completa -- sin necesitar ningún parámetro nuevo.
- `resolveChain` (`events.ts`) -- sin cambios; pasa de estar sin usar de facto (`nextSites` siempre `[]`) a ser el mecanismo real de iteración, tanto para la cola externa (`resolveLaunch`) como para las dos invocaciones internas de `resolveRedSplit`.
- `resolveLaunch` (`resolve-launch.ts`) -- sin cambios; sigue llamando a `resolveChain(level.board, initialSite, applyImpact)` exactamente igual.

## Generador (`tools/generator/`)

Sin cambios de código (research.md, Decisión 6) -- `inverses.ts`/`obligations.ts` invierten las mismas reglas de `PUSH_STRATEGY`, que no cambian; `validatesForward` ya llama a `resolveLaunch` sin ninguna suposición sobre su mecanismo interno. El único efecto esperado es una posible variación en la tasa de descarte de intentos (Historia 2, Acceptance Scenario 2) -- no una necesidad de tocar código.

## Tests nuevos/actualizados

- `tests/unit/engine/pieces/push.test.ts` (o donde vivan hoy los tests de `resolveStrike`/`resolveBranch`) -- se actualizan para llamar a `applyImpact` directamente en vez de las funciones eliminadas, mismos valores esperados salvo que dependieran explícitamente del orden/tiempo de escritura ya no observable desde fuera.
- Un test nuevo dedicado a la auto-colisión (el caso del nivel 56): una cascada de tres fichas de tablero en la misma columna donde el último empuje de marrón, si diera la vuelta completa, encontraría la ficha lanzada ya asentada -- comprobar que efectivamente se resuelve como una colisión real (aniquilación si coincide color) en vez de atravesarla.
- Los niveles 14/15 del prototipo (`src/levels/prototype-levels.ts`) se reproducen con `resolveLaunch` real y se comparan sus `events`/`result` byte a byte contra una captura previa al cambio (Historia 3).
