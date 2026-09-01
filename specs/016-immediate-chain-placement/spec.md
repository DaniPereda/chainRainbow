# Feature Specification: Resolución de Cadenas por Cola de Fichas en Tránsito

**Feature Branch**: `016-immediate-chain-placement`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Cambiar la semántica de resolución de cadenas para que ninguna ficha golpeada dentro de la misma cascada quede en un estado a medio resolver mientras el resto de la cascada continúa. El motor actual (`resolveStrike`/`resolveBranch`, `src/engine/pieces/push.ts`) resuelve cada golpe con recursión anidada: vacía la casilla de origen de la ficha golpeada de inmediato, pero NO la coloca en su casilla de destino hasta que toda la recursión que ese golpe desencadenó ya ha terminado de resolverse. Esto produce un comportamiento poco intuitivo: durante el cálculo de un eslabón profundo de la cadena, las fichas de eslabones anteriores de la MISMA cascada -- ya golpeadas, ya en camino a su propio destino -- no existen todavía en el tablero, así que un paseo largo de marrón puede atravesar, como si estuvieran vacías, casillas donde la propia cascada ya sabe que va a asentar otras fichas. Se investigaron dos alternativas y se descartaron: (a) 'colocación inmediata' -- asentar cada ficha golpeada en su destino en el mismo paso en que se calcula, en vez de esperar a que la recursión se desenrolle -- resultó físicamente incoherente para el caso real (una ficha no puede asentarse en una casilla todavía ocupada por otra que aún no ha terminado de resolverse); (b) una casilla 'reservada' -- mantener un conjunto de destinos ya comprometidos por eslabones anteriores, aún sin ficha real escrita -- resultó en una dependencia circular: si un eslabón más profundo necesita chocar de verdad contra esa reserva, no hay forma de saber qué color/fragilidad tiene la ficha con la que está chocando, porque esa identidad todavía depende de una recursión que no ha terminado. La solución adoptada es una cola de fichas en tránsito: en vez de recursión anidada, cada ficha golpeada se retira del tablero y se añade a una lista de fichas en tránsito (posición de origen, color, fragilidad ya avanzada, dirección de movimiento, quién la golpeó); se procesan una a una, cada una hasta su resolución completa (asentada en el tablero, o aniquilada, o -- si vuelve a golpear algo -- generando una nueva ficha en tránsito) antes de pasar a la siguiente. Así, cualquier consulta al tablero durante la resolución de una cascada solo puede encontrar dos cosas: una casilla genuinamente vacía, o una ficha real y completamente resuelta -- nunca un estado a medio resolver. Esta feature: (1) sustituye la recursión anidada de `resolveStrike` por este modelo de cola, aplicado también a cada rama de una división de rojo (`resolveBranch`) sin caso especial (Principio V) -- cada rama de rojo drena su propia cola local por completo antes de que empiece la siguiente, preservando la resolución secuencial ya exigida (FR-005 de 009-red-piece); (2) borra los 140 niveles ya generados en levels/ y los regenera desde cero con el motor corregido, ajustando el generador (tools/generator/) si el cambio de semántica lo exige; (3) re-verifica (no regenera, no re-especifica) los dos niveles del prototipo que usan la ficha roja (14 y 15, src/levels/prototype-levels.ts) -- la ficha roja no es tocada por el generador, que sigue limitado a verde/naranja/marrón. La terminación de cualquier cascada NO es el problema que motiva esta feature -- ya está garantizada hoy, de forma independiente, porque cada ficha golpeada se retira del tablero al ser golpeada (acotando la recursión al número de fichas físicas posibles); lo que esta feature corrige es la corrección/intuición del resultado, no un riesgo de bucle infinito. Fuera de alcance explícito: la resolución secuencial (no simultánea) de las dos ramas de una división de rojo (009-red-piece, ya documentada como simplificación deliberada y limitación futura separada) no es parte de esta feature."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ninguna ficha de una cascada queda invisible para el resto de esa misma cascada (Priority: P1)

Quien mantiene el motor ya no necesita razonar sobre un tablero donde una ficha, aunque ya fue golpeada y está en camino a su propio destino dentro de la misma cascada, "todavía no existe" para el resto de esa cascada. Cada ficha golpeada se retira del tablero y pasa a una lista de fichas en tránsito, procesada una a una hasta el final -- así que cualquier cálculo posterior de la misma cascada solo puede encontrar una casilla genuinamente vacía o una ficha real y completamente resuelta.

**Why this priority**: Es el cambio central -- sin él, el resto de la feature (regenerar niveles, re-verificar rojo) no tiene nada que regenerar ni verificar.

**Independent Test**: Reproducir con el motor real el caso concreto que motivó la investigación (una cascada de tres fichas de tablero por la misma columna, donde la última recibe un empuje de marrón que antes daba una vuelta completa al tablero atravesando las otras) y comprobar que ahora se detiene al encontrar -- como ficha real, ya asentada -- la que la propia cascada colocó antes, en vez de atravesarla.

**Acceptance Scenarios**:

1. **Given** una ficha golpeada cuyo destino calculado está vacío, **When** se procesa su entrada en la cola de tránsito, **Then** queda asentada en ese destino antes de que se procese cualquier otra entrada de la cola, disponible para que el resto de la cascada la vea como ocupante real.
2. **Given** una ficha marrón en tránsito, empujada por una cascada que ya vació toda una fila/columna previamente ocupada por otras fichas de la MISMA cascada, **When** su paseo la lleva de vuelta a una casilla donde la propia cascada ya asentó otra ficha (procesada antes en la cola), **Then** se detiene ahí -- golpe normal contra esa ficha real, con su propia regla de mismo-color/distinto-color -- en vez de atravesarla como si no existiera.
3. **Given** una división de rojo cuya rama, al procesarse, desencadena su propia cascada, **When** esa cascada golpea una ficha, **Then** esa ficha se resuelve con la misma cola de tránsito que cualquier golpe de la cadena lineal -- ningún caso especial para las ramas de rojo (Principio V) -- y la rama entera se drena por completo antes de que la segunda rama empiece a procesarse (FR-005 de 009-red-piece, sin cambios).
4. **Given** cualquier cascada posible con las piezas y reglas actuales (verde, naranja, marrón, rojo, mismo color, wrap-around), **When** se resuelve por completo, **Then** termina en un número acotado de pasos -- esta garantía ya existía antes de esta feature (cada ficha golpeada se retira del tablero, acotando el trabajo al número de fichas físicas) y esta feature no la debilita ni depende de ella para su propio propósito, que es de corrección, no de terminación.

---

### User Story 2 - Los niveles generados se reconstruyen desde cero contra el motor corregido (Priority: P2)

Quien opera el generador borra los 140 niveles ya generados (`levels/`) y vuelve a generar el mismo lote (10 niveles por cada uno de los 14 valores de `complexityScore`, 7 a 20) usando el motor ya corregido -- ningún nivel existente se conserva sin volver a validarse contra la nueva semántica, porque el cambio puede alterar qué construcciones son válidas (una construcción que antes se resolvía atravesando una ficha "invisible" de su propia cascada puede dejar de resolverse igual).

**Why this priority**: Es la consecuencia directa de la Historia 1 -- sin regenerar, quedarían en el repositorio niveles cuya validez se demostró contra una semántica que ya no es la real.

**Independent Test**: Borrar `levels/` por completo, regenerar el mismo lote de 140 niveles con `tools/generator/batch.ts`, y comprobar que el 100% se resuelve (`'won'`) al reproducir su secuencia de referencia con el motor ya corregido -- misma garantía que ya exigían 011/013/014, ahora contra la semántica nueva.

**Acceptance Scenarios**:

1. **Given** el motor ya cambiado al modelo de cola de tránsito, **When** se regenera un nivel con cualquier `complexityScore` válido, **Then** su secuencia de referencia se resuelve (`'won'`) al reproducirse con el motor real -- la misma garantía de siempre, ahora demostrada contra la semántica corregida.
2. **Given** que el cambio de semántica pudiera invalidar una construcción que antes habría sido válida, **When** el generador la encuentra durante un intento, **Then** la descarta y reintenta con la política de fallos ya existente (FR-007 de 011) -- no es un caso especial de esta feature.
3. **Given** el mismo lote de 140 niveles (10 por cada uno de los 14 valores de `complexityScore`), **When** se regenera desde cero, **Then** se obtiene la misma distribución (10 por valor) y la misma disciplina de determinismo por semilla ya exigida (FR-012 de 013, SC-001 de 014).

---

### User Story 3 - La ficha roja se re-verifica, no se regenera ni se re-especifica (Priority: P3)

Quien mantiene el motor confirma que los dos niveles del prototipo que usan la ficha roja (14 y 15) se siguen resolviendo exactamente igual tras el cambio -- el modelo de cola de tránsito se aplica a las ramas de rojo con el mismo mecanismo que a cualquier cadena lineal (Historia 1, Acceptance Scenario 3), así que no hace falta ningún ajuste conceptual a cómo se comporta el rojo, solo confirmar que sigue funcionando.

**Why this priority**: Es una verificación de no-regresión sobre un color que el generador no toca -- necesaria, pero no bloquea el valor central ya entregado por las Historias 1 y 2.

**Independent Test**: Reproducir los niveles 14 y 15 del prototipo (`src/levels/prototype-levels.ts`) con el motor ya cambiado y comprobar que ambos siguen resolviéndose (`'won'`) con exactamente la misma traza de eventos que antes del cambio.

**Acceptance Scenarios**:

1. **Given** el nivel 14 del prototipo (división básica de rojo), **When** se reproduce con el motor cambiado, **Then** el resultado y la traza de eventos son idénticos a los de antes del cambio.
2. **Given** el nivel 15 del prototipo (una rama de la división cascadea en un empuje adicional sobre naranja), **When** se reproduce con el motor cambiado, **Then** el resultado y la traza de eventos son idénticos a los de antes del cambio -- ninguna de las dos ramas de este nivel llega a golpear una ficha de la otra rama ni de tránsito, así que no hay ninguna auto-colisión que el cambio de semántica pudiera alterar aquí.

---

### Edge Cases

- ¿Qué ocurre si, tras el cambio, una construcción que el generador antes consideraba válida deja de serlo (porque ahora colisiona consigo misma de forma distinta dentro de la misma cascada)? Se trata como cualquier otro fallo de construcción -- se descarta y se reintenta con la política ya existente (FR-007 de 011), no es un caso especial de esta feature.
- ¿Qué ocurre con una rama de rojo cuya cascada, tras el cambio, termina golpeando algo que la otra rama (ya resuelta antes, FR-005 de 009) dejó colocado? Es el comportamiento ya esperado y documentado -- la segunda rama siempre ve el resultado real y completo de la primera; esto no es nuevo de esta feature, ya era así antes (el propio tablero se pasa de una rama a la siguiente).
- ¿Qué ocurre si una ficha en tránsito, al resolverse, golpea a OTRA ficha que también está en tránsito en ese mismo instante (no una ya asentada, ni una que sigue en el tablero)? No puede ocurrir por construcción: la cola procesa una entrada por completo (hasta que se asienta, se aniquila, o genera su propia entrada nueva) antes de tocar la siguiente -- nunca hay dos fichas "en tránsito" simultáneamente pendientes de resolución.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El motor DEBE resolver cada golpe de una cascada mediante una cola de fichas en tránsito (retirada del tablero, resuelta hasta el final, luego asentada o aniquilada) en vez de recursión anidada que difiere la colocación hasta que toda la cascada desencadenada por ese golpe termine.
- **FR-002**: En cualquier punto de la resolución de una cascada, una consulta al tablero DEBE devolver únicamente una casilla vacía o una ficha real ya completamente resuelta -- nunca un estado intermedio o una reserva sin ficha real.
- **FR-003**: Esta regla DEBE aplicarse de forma idéntica tanto a la resolución de golpe lineal (`resolveStrike`) como a cada rama de una división de rojo (`resolveBranch`) -- ningún caso especial (Principio V).
- **FR-004**: Cada rama de una división de rojo DEBE drenar su propia cola de fichas en tránsito por completo antes de que la siguiente rama empiece a procesarse -- la resolución secuencial de las dos ramas (FR-005 de 009-red-piece) NO cambia como consecuencia de este modelo.
- **FR-005**: El sistema DEBE seguir garantizando terminación determinista de cualquier cascada posible (verde, naranja, marrón, rojo, mismo color, wrap-around) -- nunca recursión/iteración infinita. Esta garantía ya existe hoy, de forma independiente a esta feature (cada ficha golpeada se retira del tablero al ser golpeada, acotando el trabajo posible al número de fichas físicas) -- esta feature no depende de ella para su propio propósito, que es de corrección del resultado, no de terminación.
- **FR-006**: El tope de cruces de borde de marrón (`MAX_EDGE_CROSSINGS`, 008-brown-piece) NO DEBE eliminarse ni cambiar de valor -- sigue siendo la red de seguridad para el caso de un carril genuinamente despejado (sin ninguna ficha, real o en tránsito, que lo bloquee), independiente de esta feature.
- **FR-007**: Los 140 niveles ya generados en `levels/` DEBEN eliminarse y regenerarse desde cero contra el motor ya corregido -- ningún nivel existente se conserva sin volver a validarse contra la nueva semántica.
- **FR-008**: El generador (`tools/generator/`) DEBE seguir produciendo, tras la regeneración, el mismo volumen y distribución de niveles (10 por cada uno de los 14 valores de `complexityScore`, 7 a 20) con la misma disciplina de determinismo por semilla ya exigida (FR-012 de 013, SC-001 de 014).
- **FR-009**: Si el cambio de semántica exige ajustar alguna lógica del generador más allá de simplemente volver a ejecutarlo, esos ajustes DEBEN documentarse en el `plan.md` de esta feature junto con su motivo -- no se asume de antemano que el generador necesite cambios de código, ni que no los necesite.
- **FR-010**: Los dos niveles del prototipo que usan la ficha roja (14 y 15, `src/levels/prototype-levels.ts`) DEBEN seguir resolviéndose exactamente igual (mismo resultado, misma traza de eventos) tras el cambio -- se re-verifican, no se regeneran ni se re-especifican, porque la ficha roja sigue fuera de alcance del generador.
- **FR-011**: Ninguna regla de interacción por color DEBE cambiar su comportamiento observable para una cascada que no involucre una auto-colisión dentro de la misma cascada -- el cambio es invisible para cualquier interacción "normal" (sin que un desplazamiento posterior de la misma cascada aterrice en una casilla que otro desplazamiento anterior de esa misma cascada ya ocupó).
- **FR-012**: Esta feature NO DEBE cambiar la resolución secuencial (no simultánea) de las dos ramas de una división de rojo (FR-005 de 009-red-piece) -- eso sigue siendo un ítem futuro separado, condicionado a que se demuestre necesario, no una consecuencia de este cambio.
- **FR-013**: El tipo público `Board`/`Piece` (`src/engine/board.ts`) NO DEBE cambiar de forma como consecuencia de esta feature -- la lista de fichas en tránsito es un detalle interno de la resolución de cadenas, nunca expuesto fuera de `src/engine/pieces/push.ts` ni visible en el `Board` que `resolveLaunch` devuelve.

### Key Entities

- **Ficha en tránsito**: una ficha que ya fue golpeada (con su fragilidad ya avanzada, o ya aniquilada) y retirada del tablero, pero todavía no asentada en ningún destino final -- lleva su posición de origen, color, fragilidad, dirección de movimiento, y qué la golpeó. Vive únicamente en la cola de trabajo interna de la resolución de la cascada, nunca en el `Board` público.
- **Cola de fichas en tránsito**: la estructura que sustituye a la recursión anidada -- procesa una ficha en tránsito por completo (hasta asentarse, aniquilarse, o generar una nueva entrada en la cola) antes de pasar a la siguiente, garantizando que ninguna consulta al tablero encuentre nunca un estado a medio resolver.
- **Auto-colisión dentro de una cascada**: el caso en que un desplazamiento posterior, dentro de la MISMA cascada desencadenada por un único lanzamiento, aterriza en una casilla que un desplazamiento anterior de esa misma cascada ya ocupó -- antes invisible (la ficha anterior "no existía todavía"), ahora una colisión real y corriente con la regla de interacción de esa ficha (mismo color/distinto color), porque para cuando puede ocurrir, la ficha anterior ya es real y está completamente resuelta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los tests de motor ya existentes (features 001-012) siguen pasando sin cambiar ningún valor esperado, salvo los que dependieran explícitamente del comportamiento de recursión anidada como simplificación temporal ya documentada.
- **SC-002**: El 100% de una batería de cascadas sintéticas diseñadas para forzar auto-colisión dentro de la misma cascada (incluida la del caso que motivó esta feature) resuelven la auto-colisión como un golpe real contra una ficha real, nunca atravesándola.
- **SC-003**: El 100% de los 140 niveles regenerados se resuelven (`'won'`) al reproducir su secuencia de referencia con el motor real.
- **SC-004**: El 100% de los niveles 14 y 15 del prototipo (rojo) se resuelven exactamente igual (mismo resultado, misma traza) que antes del cambio.
- **SC-005**: El 100% de las consultas al tablero realizadas durante la resolución de cualquier cascada de test devuelven una casilla vacía o una ficha real -- cero casos observados de un estado intermedio filtrándose fuera del mecanismo de cola.

## Assumptions

- La ficha roja no cambia conceptualmente en esta feature -- se re-verifica, no se regenera ni se re-especifica; el generador sigue sin tocarla (limitado a verde/naranja/marrón, sin cambios respecto a 011-014).
- La resolución secuencial (no simultánea) de las dos ramas de una división de rojo (009-red-piece, FR-005) queda explícitamente fuera de alcance -- sigue siendo un ítem futuro separado, condicionado a que se demuestre necesario en la práctica.
- El tope de cruces de borde de marrón (`MAX_EDGE_CROSSINGS=2`, 008-brown-piece) no cambia -- es una red de seguridad ortogonal a esta feature (cubre el carril genuinamente despejado, sin ninguna ficha real o en tránsito), no algo que esta feature deba tocar o pueda eliminar.
- La terminación de cualquier cascada no es el riesgo que motiva esta feature -- ya está garantizada hoy, de forma independiente, porque cada ficha golpeada se retira del tablero al ser golpeada. Esta feature es de corrección del resultado (que ninguna ficha de la cascada quede invisible para el resto de esa misma cascada), no de seguridad frente a bucles infinitos.
- El generador (`tools/generator/`) puede o no necesitar cambios de código más allá de volver a ejecutarse -- se determina durante la planificación (research.md), no se asume de antemano en ninguna dirección.
- La lista de fichas en tránsito es un detalle interno de `src/engine/pieces/push.ts` -- no se expone en el tipo público `Board`/`Piece` ni en ningún resultado que `resolveLaunch` devuelva (FR-013).
