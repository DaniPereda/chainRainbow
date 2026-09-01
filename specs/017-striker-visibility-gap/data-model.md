# Phase 1 Data Model: La Ficha Lanzadora Recién Asentada Debe Ser Visible Para el Desplazamiento de la Ficha Que Golpeó

## Tipos públicos -- sin cambios

`Board`, `Piece`, `Coordinate` (`src/engine/board.ts`), `ChainEvent`/`EventLog`/`ImpactSite`/`ImpactHandler` (`src/engine/events.ts`), `LaunchOutcome` (`src/engine/resolve-launch.ts`), `resolveChain` (`src/engine/events.ts`) -- ninguno cambia. `applyImpact` conserva exactamente su firma actual (`ImpactHandler`).

## Cambio en `applyImpact` (`src/engine/pieces/push.ts`)

Una única línea, dentro de la rama de "distinto color" (después de que `hitDefender` ya se calculó y `boardWithStriker` ya está disponible):

```ts
// Antes (016-immediate-chain-placement, con el hueco de visibilidad):
const to = PUSH_STRATEGY[site.piece.color](vacated, hitDefender, site.to, site.direction);

// Después (017-striker-visibility-gap):
const to = PUSH_STRATEGY[site.piece.color](boardWithStriker, hitDefender, site.to, site.direction);
```

Ningún otro uso de `vacated` cambia:

- `settleOrVanish(vacated, site.piece, site.from, site.to, true)` -- sigue recibiendo `vacated`, tal cual: necesita la casilla de impacto vacía para escribir en ella a la ficha lanzadora, exactamente lo que `vacated` representa por definición.
- El caso base `defender === null` no usa `vacated` en absoluto (nunca llega a esta rama).
- `resolveRedSplit` recibe `boardWithStriker`, sin cambios -- ya era el tablero correcto (rojo no pasa por `PUSH_STRATEGY`, ver `PUSH_STRATEGY`'s `Record<Exclude<PieceColor, 'red'>, ...>`).

## Por qué esto no afecta a verde/naranja

```ts
export const PUSH_STRATEGY: Record<Exclude<PieceColor, 'red'>, DisplacementStrategy> = {
  green: (_board, _piece, position, direction) => stepBy(position, direction, 1),
  orange: (_board, _piece, position, direction) => stepBy(position, direction, 2),
  brown: (board, piece, position, direction) =>
    stepUntilBlocked(board, piece, position, direction, MAX_EDGE_CROSSINGS),
};
```

`green`/`orange` ignoran por completo su primer parámetro (`_board`) -- `stepBy` nunca consulta ocupación. Solo `brown` (`stepUntilBlocked`) lee `board` para decidir dónde detenerse. El cambio de `vacated` a `boardWithStriker` es, por tanto, un no-op observable para verde/naranja y la corrección real para marrón -- exactamente lo que exige FR-002 de la spec (aplicar el fix de forma uniforme, sin caso especial por color).

## Nivel afectado conocido: 49

`levels/49.json`, 4º lanzamiento de la solución (marrón, dirección S, lane 7): marrón golpea a naranja en `(4,7)`, avanza su fragilidad `'new' → 'cracked'`, se asienta en `(4,7)`. Con el bug, el desplazamiento de naranja (`stepUntilBlocked` sobre `vacated`) da una vuelta completa al tablero (limitada por `MAX_EDGE_CROSSINGS=2`) y aterriza en `(7,7)` -- la casilla objetivo -- sin volver a colisionar con marrón; el nivel resuelve a `'won'`. Con el fix, ese mismo paseo ve a marrón asentado en `(4,7)` al completar la vuelta y colisiona ahí -- naranja (ahora convertido en el nuevo golpeador de esa colisión, per el mecanismo ya existente de "ficha en tránsito") golpea a marrón, que avanza su propia fragilidad; el resultado ya no es necesariamente `'won'` con la secuencia de referencia original. Se regenera contra el motor corregido (Historia 2 de spec.md).

## Otros niveles: se determinan empíricamente, no se listan de antemano

`research.md` (Decisión 2) ya documenta por qué no se asume ni se descarta que otros niveles del batch estén afectados -- se reproduce la secuencia de referencia de los 140 contra el motor corregido durante la implementación (tarea de verificación) y se regenera solo el subconjunto que deje de resolver a `'won'`.

## Tests nuevos/actualizados

- `tests/unit/engine/push.test.ts` (suite ya existente, creada por 016) -- nuevo test: cascada sintética con marrón golpeando una ficha en una fila/columna despejada, verificando que el desplazamiento resultante colisiona con la propia ficha lanzadora en vez de completar una vuelta al tablero y aterrizar más allá (mirroring el caso del nivel 49).
- `tests/unit/engine/brown.test.ts` -- el test foundational "stops right before the second edge crossing on an otherwise empty row" (008-brown-piece) SÍ dependía del hueco (research.md, Decisión 4: el asentamiento limpio ya no es alcanzable con un golpeador real): reescrito para usar un golpeador marrón `'broken'` (preserva exactamente el mismo resultado que demostraba antes -- el tope de cruces de borde sobre un carril genuinamente despejado). Se añade un test nuevo, hermano del anterior, que documenta el comportamiento correcto con un golpeador REAL: la ficha golpeada da la vuelta completa y choca con su propio golpeador (verificado empíricamente, resultado `'lost'`).
- `src/levels/prototype-levels.ts`, nivel 12 -- su mano pasa de `['brown']` a `[{ color: 'brown', fragility: 'broken' }]` para preservar exactamente su demostración original del tope de cruces de borde (misma razón que el test anterior).
- `tests/unit/tools/generator/generate.test.ts`, fixture 2 ("brown settling directly on the far edge of its lane") -- su valor esperado de `hand` pasa de `['brown']` a `[{ color: 'brown', fragility: 'broken' }]`, reflejando el nuevo mecanismo `mustBeBroken` de `obligations.ts`.
- `tests/unit/tools/generator/fragility.test.ts`, Historia 2 -- las dos comprobaciones de uniformidad de fichas lanzadas (`'easy'` siempre uniforme, SC-003 de 013) se actualizan para excluir cualquier ficha lanzada `'broken'` del cálculo de uniformidad antes de compararla (research.md, Decisión 4: esa ficha es siempre la excepción estructural de esta feature, nunca una elección del perfil).
- Ningún otro test existente de 001-016 requiere un valor esperado distinto -- confirmado ejecutando la suite completa antes y después del fix (SC-001).

## Cambios en el generador (`tools/generator/`) -- Historia 3

- **`obligations.ts`**: `Obligation` gana un campo opcional `mustBeBroken?: boolean`; `RawLaunch` gana `forcedFragility?: 'broken'`. Al resolver una obligación `'defender'` eligiendo marrón como golpeador en contexto `'settle'`, la obligación `'striker-origin'` empujada a la cola se marca `mustBeBroken: resolved.striker === 'brown'`. Al resolver una obligación `'striker-origin'`, `mustBeBroken` fuerza `chooseHand` (nunca cadena) y marca el `RawLaunch` resultante con `forcedFragility: 'broken'`.
- **`generate.ts`**: antes de llamar a `assignGroupFragility` para las fichas lanzadas, se separan los índices con `forcedFragility` de los que no -- solo los NO forzados participan en el grupo de uniformidad de `fragilityProfile` (mismo tamaño de grupo que antes cuando no hay ningún forzado, cero cambio de conteo de `rng()` para ese caso). El resultado final combina el valor forzado (`'broken'`) con los valores del grupo no forzado, por posición original.
- **`inverses.ts`**: SIN CAMBIOS -- `isFarEdgeOfLane`/`laneCandidatesWithClearPath` siguen calculando exactamente los mismos candidatos que antes; lo que cambia es qué fragilidad recibe el golpeador elegido, no qué candidatos se consideran válidos (research.md, Decisión 4, matemática verificada: el candidato en sí sigue siendo correcto, la ficha lanzadora simplemente no debe asentarse).
