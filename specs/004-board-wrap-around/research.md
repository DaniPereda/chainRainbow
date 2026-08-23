# Phase 0 Research: Wrap-around de Fichas en el Tablero

Sin `NEEDS CLARIFICATION` pendientes. Una única decisión técnica real: dónde y cómo aplicar el
envolvimiento de coordenadas dentro de `resolveStrike` sin introducir un caso especial.

## Decisión 1: Envolver la coordenada ANTES de comprobar ocupación, no como rama aparte

**Decision**: En `resolveStrike`, `to` se calcula como `wrapCoordinate(stepBy(position, direction,
distance))` — el envolvimiento sucede como parte del cálculo del destino, antes de llamar a
`getPieceAt(board, to)`. La rama actual `if (!isInBounds(to)) { ficha eliminada }` se elimina por
completo: con `to` ya envuelta, siempre es una coordenada válida, así que el chequeo de ocupación
y la regla universal de interacción (mismo color → aniquila; distinto → empuja) se aplican solos,
sin ningún código consciente de que hubo un cruce de borde.

**Rationale**: Encaja directamente con el Principio V (primitivas composables sobre casos
especiales) — la alternativa (mantener el chequeo `isInBounds` y añadir una rama `wrap` al lado)
duplicaría la lógica de "qué hacer con lo que hay en `to`" en dos sitios. Calculando `to` ya
envuelta, esa lógica se escribe una sola vez y sirve tanto para destinos que nunca salieron del
tablero como para los que sí.

**Alternatives considered**:
- *Comprobar `isInBounds` y, si falla, recalcular con wrap como rama separada*: descartada — es
  exactamente el caso especial que el Principio V pide evitar, y duplicaría el chequeo de
  ocupación/interacción universal en dos ramas en vez de una.

## Decisión 2: `wrapCoordinate` vive en `board.ts`, no en `push.ts`

**Decision**: `wrapCoordinate(coord: Coordinate): Coordinate` se añade a `board.ts`, junto a
`isInBounds`/`getPieceAt`/`setPieceAt`, no dentro de `pieces/push.ts`.

**Rationale**: Es una función de geometría del tablero (usa `BOARD_SIZE`, ya interno a `board.ts`),
no un comportamiento específico de cómo empuja una ficha. Vivir en `board.ts` la deja disponible
sin duplicación para cualquier futura ficha que también desplace piezas por el tablero (p. ej.
marrón), sin que `pieces/push.ts` necesite conocer el tamaño del tablero directamente.

**Alternatives considered**:
- *Inline dentro de `resolveStrike`*: descartada — mezclaría geometría del tablero (cuál es el
  tamaño, cómo envolver un índice) con la lógica de quién golpea a quién, que es lo que
  `pieces/push.ts` debe seguir modelando.

## Nota: por qué basta con un módulo simple (sin lógica de "máximo una vuelta")

Con `PUSH_DISTANCE` actual (verde=1, naranja=2) y tablero de tamaño 8, el mayor desbordamiento
posible en un único empuje es `distancia - 1` casillas más allá del borde — muy por debajo del
tamaño del tablero. Una operación de módulo estándar (`((n % 8) + 8) % 8`) ya maneja esto
correctamente sin ninguna comprobación adicional de "cuántas vueltas". La lógica de tope máximo
que el documento de diseño anticipa para marrón (distancia hasta la frontera + longitud de la
línea) es una restricción de la ficha marrón sobre CUÁNTAS veces se repite MOVE_STEP, no del
propio wrap-around — por eso queda fuera de esta historia (spec.md → FR-005).
