# Phase 0 Research: Colisión entre Fichas del Mismo Color

Sin `NEEDS CLARIFICATION` pendientes en el Technical Context. La decisión de diseño real
(`testLevelGreen01`) ya se resolvió con el usuario durante `/speckit-specify`. Esta fase se centra
en cómo encajar la comprobación de mismo color en la arquitectura de `push.ts` ya existente sin
duplicar lógica entre el impacto inicial y los eslabones de una cascada.

## Decisión 1: Un único punto de entrada comprueba "mismo color" antes de calcular cualquier empuje

**Decision**: Tanto la resolución del impacto inicial (`applyImpact`, feature 001/002) como cada
eslabón recursivo de cascada dentro de `pushOccupant` deben pasar por la MISMA comprobación:
antes de calcular una distancia de empuje o mover nada, se compara el color de la ficha que golpea
(striker) con el color de la ficha que ocupa la casilla de destino (defender). Si coinciden, se
resuelve como aniquilación (ver Decisión 2) y la recursión/cadena termina ahí. Si no coinciden, se
procede exactamente como ya está construido (empuje según `PUSH_DISTANCE[strikerColor]`).

**Rationale**: El documento de diseño no distingue el impacto inicial de un eslabón posterior de
cascada — "siempre que una ficha se mueve o aparece en una casilla donde ya existe otra... del
mismo color, ambas desaparecen" se aplica de forma idéntica en cualquier punto. La implementación
actual de `push.ts` ya tiene dos puntos de entrada estructuralmente distintos para este mismo
concepto (la llamada inicial en `applyImpact` y la llamada recursiva dentro de `pushOccupant`);
insertar el chequeo en ambos por separado duplicaría la condición y arriesgaría que diverjan en el
futuro (el mismo tipo de duplicación que ya se evitó al generalizar verde/naranja en la feature
002, Principio V de la constitución).

**Alternatives considered**:
- *Comprobar mismo color solo en el impacto inicial, dejando que las cascadas empujen siempre*:
  descartada — contradice la regla universal de interacción, que no distingue "primer impacto" de
  "impacto posterior"; además el propio spec (Acceptance Scenario 2) exige explícitamente que se
  compruebe en cualquier eslabón.

## Decisión 2: La aniquilación necesita su propio tipo de evento, no reutiliza MOVE_STEP

**Decision**: Se añade `AnnihilationEvent = { type: 'ANNIHILATION'; at: Coordinate; strikerColor:
PieceColor; defender: Piece }` como nueva variante del log de eventos:
`type ChainEvent = MoveStepEvent | AnnihilationEvent; type EventLog = ChainEvent[];`. Cada
colisión (ya sea impacto inicial o eslabón de cascada) sigue generando exactamente un evento —
`MOVE_STEP` si hubo empuje, `ANNIHILATION` si ambas fichas desaparecieron — nunca cero eventos,
manteniendo el log como una traza completa de lo ocurrido.

**Rationale**: Un `MoveStepEvent` representa un movimiento real (`from` -> `to`) de una ficha
concreta; en una aniquilación no se mueve nada — dos fichas dejan de existir. Forzar esto en la
forma de `MoveStepEvent` (por ejemplo, con `from === to` o un campo `moved: false`) sería más
confuso que declarar explícitamente un tipo nuevo, y mantiene cada evento auto-descriptivo. La
extensión es aditiva (une un nuevo tipo al union), así que no rompe ningún consumidor existente de
`MoveStepEvent` (ninguna suite de test actual filtra o depende de que TODOS los eventos sean
`MOVE_STEP`, excepto `chain.test.ts`, que solo lo comprueba para el lanzamiento de
`testLevelGreen01` — y ese lanzamiento, tras el cambio de color del FR-006, sigue siendo una
colisión de colores distintos, por lo que solo produce `MOVE_STEP` como antes).

**Alternatives considered**:
- *No generar ningún evento en una aniquilación*: descartada — dejaría el log incompleto para una
  futura historia de animación/reproducción (ya anticipada en el documento de diseño del juego,
  sección 13), que necesitará saber que "aquí desaparecieron dos fichas" para poder representarlo.
- *Reutilizar `MoveStepEvent` con un campo booleano adicional (`annihilated: true`)*: descartada —
  mezclaría dos conceptos (movimiento vs. desaparición) en un solo tipo, con campos (`from`/`to`)
  que no tienen sentido claro para una aniquilación de dos fichas en la misma casilla.

## Decisión 3: `testLevelGreen01` solo necesita cambiar dos valores, no la casilla objetivo

**Decision**: `testLevelGreen01` cambia la ficha ya colocada de verde a naranja y el
`targetColor` del objetivo de verde a naranja. La `targetCell` (fila/columna) NO cambia.

**Rationale**: La distancia de empuje la determina el color de quien golpea (la ficha lanzada,
verde), no el de quien la recibe — corregido en la feature 002 el 2026-08-23. Cambiar el color de
la ficha ya colocada no altera cuántas casillas se desplaza; solo cambia qué color termina en la
casilla objetivo. Esto también significa que ninguna de las cuatro suites de test existentes
(`launch`, `chain`, `objective`, `determinism`) necesita modificarse: todas usan
`GREEN_WINNING_LAUNCH`/`GREEN_MISSCLICK_LAUNCH` (carriles fijos) y leen el resultado o el color
del objetivo directamente del fixture, sin asumir un color concreto en el código del test.
