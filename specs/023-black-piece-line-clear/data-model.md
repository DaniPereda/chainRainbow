# Phase 1 Data Model: Ficha Negra (Limpieza de Línea)

## Entidades

### `PieceColor` (extendida)

`src/engine/board.ts` — `'green' | 'orange' | 'brown' | 'red'` gana `'black'` como quinto valor.
Ningún otro campo de `Piece` (`fragility`) cambia — negro usa la misma fragilidad que cualquier
otro color, aunque (Decisión 4 de research.md) nunca llega a *avanzar* su propia fragilidad ni a
asentarse tras un impacto: siempre desaparece.

### Limpieza de línea (regla de interacción, no una entidad de datos nueva)

No es un tipo nuevo. Es una rama de decisión adicional dentro de `applyImpact` (`push.ts`),
comprobada en dos puntos distintos que ya existen en esa función, en el mismo nivel de
prioridad que la regla de mismo color ya existente (Decisión 3 de research.md):

1. **Negro como atacante** (`site.piece.color === 'black'`): en vez de asentar `site.piece` con
   `settleOrVanish` y despachar un `nextSite` para el defensor, se limpia la línea determinada
   por `site.direction` (N/S → columna de `site.to`; E/O → fila de `site.to`).
2. **Negro como defensora** (`defender.color === 'black'`): comprobado ANTES de la rama
   `if (site.piece.color === 'red')` ya existente. En vez de que el atacante empuje o divida a
   la negra, se limpia la línea determinada por `site.direction` (la dirección del ATACANTE,
   FR-003) — el mismo eje N/S→columna, E/O→fila.

Ambos puntos delegan en la misma función pura nueva:

```ts
// src/engine/pieces/push.ts (nueva función interna, no exportada)
function clearLine(
  board: Board,
  axis: 'row' | 'column',
  index: number,          // fila o columna a vaciar
): { board: Board; clearedCells: Coordinate[] }
```

Recorre las 8 casillas del eje indicado, y para cada una que esté ocupada: la vacía en el
`Board` devuelto y añade su coordenada a `clearedCells` (en orden creciente de índice, para que
el orden de los eventos resultantes sea determinista — Principio III). Pura, sin `rng()`, sin
dependencia del motor de renderer.

### `AnnihilationEvent` (sin cambios de forma)

Cada casilla en `clearedCells` produce un `ChainEvent` ya existente:

```ts
{
  type: 'ANNIHILATION',
  at: <esa casilla>,
  color: <color de la ficha que estaba ahí>,
  from: <esa misma casilla, salvo la ficha disparadora — ver más abajo>,
  direction: <la misma `site.direction` que determinó el eje>,
}
```

- Para la ficha disparadora (la negra lanzada, o el atacante que golpeó a una negra asentada,
  FR-004): `from`/`direction` reflejan su recorrido REAL hasta el impacto — exactamente los
  mismos valores que ya usaría `settleOrVanish` si esa ficha se hubiera asentado normalmente. No
  se fabrica ningún desplazamiento nuevo.
- Para cada otra ficha barrida por la línea: `from === at` (no viajó realmente a ningún sitio;
  Decisión 1 de research.md rechaza fabricar un `from` distinto solo por motivos visuales) y
  `direction` es la misma del eje, por consistencia de tipo (el campo es obligatorio en
  `AnnihilationEvent`) aunque sin significado de "hacia dónde viajó".

Todos los eventos de una misma limpieza son HERMANOS a efectos de animación
(`computeEventParents`, `launch-animation.ts`): comparten la misma casilla de impacto como
`from` salvo, otra vez, la ficha disparadora, cuyo propio `from` es el que ya determina el resto
de la cadena causal (igual que cualquier otro `MOVE_STEP`/`ANNIHILATION` ya existente) — ningún
cambio de forma necesario en `computeEventParents` ni en `playEventLog`.

## Reglas de validación / invariantes

- El eje (fila o columna) y el índice se derivan siempre de `site.to` (la casilla de impacto,
  YA calculada por la resolución existente) y `site.direction` — nunca de la posición original
  de lanzamiento ni de ningún otro estado.
- `clearLine` solo lee/escribe el `Board` que ya recibe — no consulta la cola de resolución ni
  ningún `ImpactSite` pendiente (Principio I, III): si otra ficha "iba a" caer en esa línea más
  tarde en la misma cadena, esa decisión se toma cuando le llegue su turno, contra el tablero YA
  actualizado (mismo patrón que cualquier otra escritura de tablero en este motor).
- Negro nunca produce un `nextSite` (Decisión 4 de research.md) — ni como atacante ni como
  defensora. Tras una limpieza de línea, la cola de `resolveChain` no gana ninguna entrada nueva
  por esta interacción.
- Negro contra negro sigue resolviéndose por la regla de mismo color ya existente, comprobada
  ANTES que la limpieza de línea (mismo orden de prioridad que ya rige para rojo) — FR-006.

## Renderer (integración mínima)

- `src/renderer/board-view.ts`: `PIECE_COLOR` gana una entrada `black: 0x1a1a1a` (o similar, gris
  muy oscuro — negro puro sobre el fondo oscuro del tablero sería indistinguible; a decidir en
  tasks.md contra el fondo real).
- `src/renderer/sound-effects.ts`: opcionalmente, un nuevo `playLineClearSound()` distintivo
  (mismo patrón que `playSplitSound`), disparado una vez por limpieza de línea — no una vez por
  cada `ANNIHILATION` individual, para no producir un "traqueteo" de sonidos repetidos cuando se
  barren varias fichas a la vez.
- Ningún cambio de forma en `launch-animation.ts` — reutiliza `computeEventParents`/`playEventLog`
  exactamente como están (Decisión 1 de research.md).
