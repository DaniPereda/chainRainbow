# Phase 1 Data Model: Colisión entre Fichas del Mismo Color

Extiende los modelos de `specs/001-green-piece-launch/data-model.md` y
`specs/002-orange-piece-launch/data-model.md`, que siguen vigentes salvo lo indicado aquí.
`PieceColor` no cambia (`'green' | 'orange'`); esta historia no introduce colores nuevos.

## Cambios sobre EventLog

```ts
type AnnihilationEvent = {
  type: 'ANNIHILATION';
  at: Coordinate;      // casilla donde ambas fichas coincidieron y desaparecieron
  color: PieceColor;   // color compartido por ambas fichas (por definición de esta rama)
};

type ChainEvent = MoveStepEvent | AnnihilationEvent;
type EventLog = ChainEvent[]; // antes: MoveStepEvent[]
```

**Corrección (2026-08-23, comentario de revisión en el PR)**: la primera versión de este tipo
guardaba `strikerColor: PieceColor` y `defender: Piece` por separado — redundante, ya que una
aniquilación solo se dispara cuando `defender.color === strikerColor`, y `Piece` no tiene ningún
campo aparte de `color`. Un único campo `color` es toda la información no duplicada que hay.

Cada colisión resuelta (impacto inicial o cualquier eslabón de cascada) produce exactamente un
evento: `MOVE_STEP` si hubo empuje, `ANNIHILATION` si los colores coincidían. Nunca cero eventos
por colisión — ver research.md, Decisión 2.

**Invariante**: si la ficha que golpea y la que ocupa la casilla de destino comparten color en
cualquier punto de la resolución, el evento generado MUST ser `ANNIHILATION` (campo `color` con
ese color compartido) y ninguna de las dos fichas MUST aparecer en el tablero resultante, ni en
esa casilla ni en ninguna otra (ninguna ejecuta su efecto de empuje).

## Cambio sobre `testLevelGreen01` (ver research.md, Decisión 3)

```ts
// Antes (feature 001/002):
// board: pieza verde en (4,4) | objective: { targetColor: 'green', targetCell: {4,5} }

// Ahora:
board: pieza NARANJA en (4,4)
objective: { targetColor: 'naranja', targetCell: { row: 4, col: 5 } } // misma casilla
```

La ficha en mano sigue siendo verde; `GREEN_WINNING_LAUNCH`/`GREEN_MISSCLICK_LAUNCH` (carriles 4 y
0) no cambian. Ninguna suite de test existente necesita modificarse — todas leen el color del
objetivo desde el propio fixture o solo comprueban `result`/`missclick` de forma genérica.

## Nuevo: `testLevelSameColor01` (impacto inicial)

Una única ficha verde ya colocada en `(6, 4)`; mano con una ficha verde. Lanzamiento
`{ direction: 'E', lane: 6 }` colisiona directamente con ella — mismo color desde el primer
impacto, sin ningún empuje de por medio. Objetivo diseñado para no cumplirse nunca (ninguna ficha
sobrevive), de modo que el resultado sea siempre `'lost'` y quede claro que la evaluación del
objetivo ocurre sobre el tablero ya vacío en esa zona.

## Nuevo: `testLevelSameColorCascade01` (eslabón de cascada)

Tres fichas en línea en la fila `7`: lanzador verde (mano), ficha **naranja** en `(7, 4)`, ficha
**naranja** en `(7, 5)` (adyacente — coincide exactamente con la distancia de empuje de verde, 1
casilla). El impacto inicial (verde contra naranja) es de colores DISTINTOS, así que procede como
empuje normal: la primera naranja se desplaza 1 casilla (distancia de quien golpea, verde) y
aterriza sobre la segunda naranja — mismo color entre ambas — donde se desencadena la
aniquilación. El lanzador verde sigue asentándose en `(7, 4)` (su propia colisión fue un empuje
normal, no le afecta lo que ocurra más adelante en la cadena). Objetivo: `{ targetColor: 'green',
targetCell: { row: 7, col: 4 } }` → `'won'` si la cascada se resuelve correctamente. Este nivel es
el que distingue la implementación correcta de un fallo donde la aniquilación no se detectara:
sin ella, la segunda ficha naranja terminaría desplazada (no aniquilada) y ocuparía una casilla
distinta de la vacía esperada.
