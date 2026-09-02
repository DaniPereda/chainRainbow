# Feature Specification: Resolución de Colisiones Casilla a Casilla

**Feature Branch**: `021-cellwise-collision-resolution`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Cambiar la resolución de colisiones del motor (src/engine/events.ts, resolveChain) de 'cada trayectoria en vuelo calcula su destino final en un solo paso (via PUSH_STRATEGY) y solo se comprueba si dos destinos finales coinciden' a una simulación genuina tick a tick, casilla a casilla: en cada tick, TODAS las trayectorias actualmente en vuelo avanzan exactamente UNA casilla en su propia dirección; tras cada tick se comprueba si dos trayectorias en vuelo ahora ocupan la MISMA casilla (colisión mutua genuina) ANTES de seguir avanzando ninguna más allá de ese punto.

Contexto y motivación (encontrado por el usuario, 020-generator-red-support ya mergeada): el modelo actual (`ImpactSite.to` como destino final precalculado de una sola vez) no puede representar correctamente el caso en que dos fichas del mismo color, empujadas en direcciones opuestas por una división de rojo (o por cualquier otra causa), deberían encontrarse y aniquilarse EN LA CASILLA INTERMEDIA exacta donde sus caminos se cruzan -- en vez de eso, el modelo actual solo compara destinos finales ya calculados, así que dos fichas verdes empujadas una hacia el este y otra hacia el oeste desde el mismo punto de partida NUNCA se detectan como colisionando entre sí durante el trayecto, aunque conceptualmente deberían 'encontrarse en el centro' y desaparecer ahí. Un parche anterior (findCoincidingPair, ya mergeado) corrigió el caso de 'una trayectoria en vuelo vs. una ficha real y quieta ya calculada como destino', pero NO puede corregir este caso más profundo: hace falta que el AVANCE en sí sea tick a tick, casilla a casilla, no una función que salta directamente al destino final.

Ejemplo concreto para verificar el fix (nivel 2 modificado a mano por el usuario, en levels/2.json): dos fichas verdes que, tras una división de rojo, deberían ser empujadas una en cada dirección opuesta y encontrarse/aniquilarse en la columna 1 (el punto medio geométrico entre sus posiciones de partida) -- actualmente esto no ocurre correctamente.

Alcance explícito:
- SÍ: rediseñar el avance de trayectorias en vuelo (tanto la cola de resolveChain como las funciones PUSH_STRATEGY que hoy calculan un destino final de una sola vez) para que avancen genuinamente casilla a casilla, con detección de colisión mutua en CADA tick intermedio, no solo al final.
- SÍ: mantener el comportamiento ya corregido (una trayectoria en vuelo vs. una ficha real y quieta en el tablero sigue resolviéndose como un golpe normal y asimétrico, nunca como colisión mutua) -- esto debe seguir funcionando exactamente igual, ahora expresado en términos de 'avance casilla a casilla' en vez de 'destino final precalculado'.
- SÍ: el usuario ha indicado explícitamente que esto puede requerir un algoritmo de movimiento más fino/cuidadoso -- tomarse el tiempo de diseñarlo bien en la fase de plan/research, incluyendo cómo brown (marrón, con distancia variable via stepUntilBlocked) y orange (naranja, con salto fijo de 2 casillas que hoy es 'ciego' al tablero) encajan en un modelo tick a tick sin romper sus propias mecánicas ya establecidas y probadas.
- NO: no es necesario todavía regenerar los niveles ya generados -- el usuario ha dicho explícitamente que no hay que preocuparse por eso ahora ('no debemos preocuparnos por eso, cuando solucionemos este problema podemos rehacer los niveles que haga falta'); una vez implementado el fix, se puede evaluar cuáles niveles necesitan regenerarse, pero no es parte del alcance inicial de esta feature.
- NO: cambios a la interfaz de usuario/renderer más allá de lo necesario para seguir consumiendo el mismo tipo de EventLog ya existente (aunque el propio EventLog podría necesitar cambios si la granularidad de eventos cambia -- a decidir en la fase de plan)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dos trayectorias que avanzan una hacia la otra se encuentran y colisionan en la casilla real donde se cruzan (Priority: P1)

Quien juega una partida real lanza una ficha que provoca que dos trayectorias en vuelo (por ejemplo, las dos ramas de una división de rojo, empujadas en direcciones opuestas) avancen una hacia la otra por el tablero. En vez de que el motor calcule el destino final de cada una por separado y compare solo esos dos destinos, el motor las avanza casilla a casilla, en paralelo, y detecta la colisión exactamente en la casilla intermedia donde sus caminos se cruzan de verdad -- no antes, no en un destino final que nunca llegaron a compartir.

**Why this priority**: Es el defecto concreto que motiva esta feature -- sin esto, dos fichas del mismo color empujadas una hacia la otra nunca se encuentran ni se aniquilan como conceptualmente deberían, produciendo un resultado de partida incorrecto (no solo una animación rara).

**Independent Test**: Reproducir el nivel de ejemplo (dos fichas verdes empujadas en direcciones opuestas tras una división de rojo) y confirmar que ambas desaparecen exactamente en la casilla intermedia geométrica entre sus puntos de partida, con un evento de aniquilación ahí -- no en ningún destino final precalculado que antes se comparaba incorrectamente.

**Acceptance Scenarios**:

1. **Given** dos trayectorias en vuelo que avanzan una hacia la otra en la misma fila o columna, **When** el motor resuelve el lanzamiento, **Then** ambas avanzan casilla a casilla y la colisión (mutua, mismo color -> aniquilación; distinto color -> intercambio de dirección/mecanismo, regla ya existente) ocurre en la casilla exacta donde sus caminos se cruzan.
2. **Given** el ejemplo concreto del nivel 2 modificado a mano (dos fichas verdes, división de rojo, encuentro esperado en la columna 1), **When** se reproduce con el motor corregido, **Then** ambas fichas verdes desaparecen exactamente en la columna 1.
3. **Given** dos trayectorias que NO comparten fila ni columna en ningún punto de su recorrido, **When** el motor las resuelve, **Then** nunca se detecta una colisión mutua entre ellas (cada una resuelve su propio destino final normalmente).

---

### User Story 2 - El comportamiento ya corregido frente a una ficha real y quieta se mantiene exactamente igual (Priority: P1)

Quien juega una partida real lanza una ficha que provoca que una trayectoria en vuelo avance hacia una ficha real, ya asentada y quieta en el tablero. Igual que ya ocurre hoy (tras la corrección anterior a esta feature), esto se resuelve como un golpe normal y asimétrico -- nunca como una colisión mutua entre "dos trayectorias en vuelo" -- independientemente de que el nuevo modelo avance casilla a casilla en vez de saltar directamente al destino final.

**Why this priority**: Esta es la corrección MÁS RECIENTE ya mergeada (findCoincidingPair exige que la casilla compartida esté vacía) -- el nuevo modelo casilla a casilla no debe reintroducir el bug que esa corrección ya resolvió. Sin esta historia, la feature arriesga deshacer trabajo ya validado.

**Independent Test**: Reproducir los niveles/casos ya usados para verificar la corrección anterior (incluida la prueba de red.test.ts del "column 6" y la del nivel 2 original) y confirmar que producen exactamente el mismo resultado con el nuevo modelo casilla a casilla.

**Acceptance Scenarios**:

1. **Given** una trayectoria en vuelo que avanza hacia una ficha real y quieta en el tablero, **When** el motor la resuelve, **Then** se trata como un golpe normal y asimétrico (la trayectoria es la golpeadora, la ficha quieta es la defensora), nunca como una colisión mutua.
2. **Given** los casos ya cubiertos por la corrección anterior de `findCoincidingPair`, **When** se reproducen con el nuevo modelo casilla a casilla, **Then** producen exactamente el mismo resultado (mismo tablero final, mismo resultado de la partida).

---

### Edge Cases

- ¿Qué ocurre cuando marrón (distancia variable, stepUntilBlocked) participa en una colisión casilla a casilla? Su propio avance debe seguir comprobando ocupación en cada casilla intermedia, exactamente igual que hoy -- el modelo casilla a casilla debe ser una generalización de su mecánica ya existente, no un caso especial adicional.
- ¿Qué ocurre cuando naranja (salto fijo de 2 casillas, hoy "ciego" al tablero) participa? Su propio salto de 2 casillas debe seguir comportándose igual para efectos del tablero final, pero ahora pasa por una casilla intermedia (el punto medio de su salto) en la simulación casilla a casilla -- a definir en la fase de plan si esa casilla intermedia participa en la detección de colisiones mutuas o si naranja conserva su "ceguera" tradicional durante ese salto.
- ¿Qué ocurre si tres o más trayectorias están en vuelo simultáneamente y dos de ellas se cruzan en una casilla mientras una tercera sigue avanzando? Debe resolverse de forma determinista, igual que el modelo ya existente resuelve colisiones múltiples de forma secuencial por pares.
- ¿Qué ocurre con el nivel 2 modificado a mano tras este fix? Se reverifica, no se regenera -- el usuario ha indicado explícitamente que la regeneración de niveles queda para después, fuera del alcance de esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El motor DEBE avanzar toda trayectoria en vuelo casilla a casilla (un tick = un desplazamiento de exactamente una casilla en la dirección propia de esa trayectoria), en vez de calcular su destino final completo en un solo paso.
- **FR-002**: El motor DEBE comprobar, tras cada tick, si dos o más trayectorias en vuelo ocupan ahora la misma casilla, y resolver esa colisión (mutua: mismo color -> aniquilación; distinto color -> la regla ya existente de intercambio de dirección/mecanismo) en esa casilla exacta, antes de seguir avanzando ninguna trayectoria más allá de ese punto.
- **FR-003**: El motor NO DEBE tratar como colisión mutua el caso de una trayectoria en vuelo que alcanza una casilla ocupada por una ficha real, ya asentada y quieta en el tablero -- ese caso sigue resolviéndose como un golpe normal y asimétrico (comportamiento ya corregido, debe conservarse exactamente).
- **FR-004**: El nuevo modelo casilla a casilla DEBE producir, para cualquier construcción que NO involucre dos trayectorias cruzándose en una casilla vacía compartida, exactamente el mismo resultado (tablero final, resultado de partida) que el modelo actual -- cero regresión para el caso ya cubierto.
- **FR-005**: El comportamiento de marrón (distancia variable, para en el primer obstáculo o tras el límite de cruces de borde) y naranja (distancia fija de 2 casillas) DEBE preservarse en su resultado final -- el modelo casilla a casilla es una forma distinta de CALCULAR ese resultado, no un cambio de las reglas de distancia/parada de cada color.
- **FR-006**: El motor (o quien consuma su salida, como el renderer) DEBE seguir pudiendo reproducir exactamente el mismo `EventLog` ya usado hoy, o una versión de él con la granularidad adicional necesaria -- decisión concreta de forma/tipo a fijar en la fase de plan (research.md/data-model.md), sin romper a los consumidores ya existentes (renderer, generador) más de lo estrictamente necesario.

### Key Entities

- **Trayectoria en vuelo (tick-a-tick)**: una pieza actualmente en movimiento, representada ahora por su posición ACTUAL (no solo su destino final) y su dirección -- avanza una casilla por tick hasta asentarse, desaparecer, o colisionar con otra trayectoria o con una ficha real quieta.
- **Colisión mutua casilla a casilla**: el evento de que dos trayectorias en vuelo ocupan la misma casilla tras un tick -- distinto de un golpe normal (trayectoria vs. ficha real quieta), que sigue las reglas ya existentes sin cambios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el ejemplo concreto del nivel 2 modificado a mano, las dos fichas verdes se encuentran y desaparecen exactamente en la columna 1, verificado reproduciendo la construcción con el motor real.
- **SC-002**: El 100% de los tests ya existentes que cubren la corrección anterior (trayectoria vs. ficha real quieta) siguen pasando sin cambios de expectativa tras esta feature.
- **SC-003**: El 100% de los 150 niveles ya generados (más los niveles de prototipo 14/15) siguen resolviendo `'won'` al reproducir su secuencia de referencia -- cero regresión, verificado con el motor real, sin necesidad de regenerar ninguno.
- **SC-004**: Una colisión genuina entre dos trayectorias en vuelo que avanzan una hacia la otra se detecta y resuelve en la casilla intermedia real donde se cruzan, para cualquier combinación de direcciones (horizontal, vertical) y colores, verificado con al menos un caso de cada combinación relevante (mismo color -> aniquilación; distinto color -> intercambio ya existente).

## Assumptions

- El comportamiento de la corrección anterior (`findCoincidingPair` exige casilla compartida vacía) es la referencia de correctness a preservar -- esta feature lo generaliza a un modelo casilla a casilla, no lo reemplaza por otra cosa.
- El renderer (`src/renderer/launch-animation.ts`) seguirá consumiendo el `EventLog` que el motor produzca; cualquier cambio de forma necesario se diseña para minimizar el impacto en el renderer, documentado en la fase de plan.
- No se regenera ningún nivel como parte de esta feature -- se reverifica el lote de 150 + prototipos 14/15 contra el motor corregido, y se anota (no se ejecuta) qué regeneración haría falta si la reverificación encuentra algo.
- El nivel 2 modificado a mano por el usuario (`levels/2.json`) permanece como está (una construcción sin solución conocida, según el propio usuario) -- se usa solo como caso de verificación manual/ejemplo, no se convierte en un nivel jugable ni se añade al lote oficial.
