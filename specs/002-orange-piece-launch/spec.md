# Feature Specification: Lanzamiento de Ficha Naranja (Salto sobre Obstáculo)

**Feature Branch**: `002-orange-piece-launch`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Como jugador, lanzo una ficha naranja desde fuera del tablero 8x8 en
una dirección N/S/E/O, usando el mismo mecanismo de lanzamiento ya construido para la ficha verde
(viaje casilla a casilla hasta colisión o missclick, cadena de eventos resuelta hasta estado
estable, comprobación de objetivo solo entonces). A diferencia de verde, el comportamiento de
naranja al impactar contra una ficha ya colocada es que esa ficha salta sobre la siguiente casilla
en la dirección del golpe (sin destruir ni desplazar lo que hubiera en esa casilla intermedia) y
aterriza dos casillas más allá de donde fue golpeada, pudiendo desencadenar allí una nueva
interacción en cascada, igual que ya hace verde con un solo paso. Esta es la segunda historia
incremental del roadmap tras el walking skeleton de la ficha verde: debe reutilizar el motor ya
construido sin modificar su comportamiento existente para verde, añadiendo el comportamiento de
naranja en un nuevo nivel de prueba dedicado. Igual que con verde, la verificación de esta historia
es headless (sin interfaz visual), mediante tests automatizados sobre el motor."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lanzar una ficha naranja y resolver un nivel de un solo lanzamiento (Priority: P1)

Un jugador abre un nivel de prueba en un tablero 8×8 que contiene dos fichas verdes ya colocadas en
línea (una junto a la otra en la dirección de lanzamiento) y una mano con una única ficha naranja
disponible. El jugador elige una dirección y lanza su ficha. La ficha naranja avanza casilla a
casilla hasta encontrar la primera ficha ya colocada. En vez de empujarla una casilla (como haría
verde), la ficha impactada salta sobre la siguiente casilla — dejando intacto lo que hubiera en
ella — y aterriza exactamente dos casillas más allá del punto de impacto original, en una casilla
vacía. Cuando el tablero deja de tener eventos pendientes, el juego comprueba si una ficha ha
quedado exactamente en la casilla objetivo del nivel y expone si el nivel se ha ganado, perdido, o
queda sin determinar (mismas reglas ya establecidas para verde).

**Why this priority**: Es la segunda pieza del roadmap y la primera que demuestra que el motor
soporta comportamientos de impacto distintos entre colores sin tocar lo ya construido (viaje,
missclick, cola de eventos, objetivo). Valida el Principio V de la constitución (primitivas
composables) con un segundo caso real antes de abordar fichas más complejas (marrón, rojo).

**Independent Test**: Se puede probar por completo mediante pruebas automatizadas que cargan un
nivel de prueba dedicado a naranja (dos fichas en línea + una ficha naranja en mano), lanzan la
única ficha disponible, y verifican que el resultado (posición final de las fichas, casilla
intermedia intacta, victoria/derrota/sin determinar) es correcto — sin necesitar ninguna interfaz
visual y sin alterar el comportamiento ya validado de la ficha verde, que debe seguir siendo
correcto exactamente igual que antes de esta historia.

**Acceptance Scenarios**:

1. **Given** un nivel con dos fichas verdes colocadas en línea en la dirección de lanzamiento (la
   primera en el punto de impacto, la segunda en la casilla intermedia justo después — dejando
   libre la casilla dos posiciones más allá) y una mano con una ficha naranja, **When** el jugador
   lanza y colisiona con la primera ficha, **Then** la ficha impactada salta sobre la casilla
   intermedia sin alterar en absoluto lo que hay en ella y aterriza exactamente dos casillas más
   allá del punto de impacto, en una casilla vacía, terminando ahí la cadena (estado estable).
2. **Given** una cadena de eventos que ha terminado de resolverse (estado estable) tras un impacto
   de naranja, **When** una ficha ha quedado exactamente en la casilla objetivo del nivel, **Then**
   el nivel se marca como completado/ganado.
3. **Given** una cadena de eventos que ha terminado de resolverse tras una colisión (no un
   missclick), **When** ninguna ficha ocupa la casilla objetivo y la mano del jugador ya no tiene
   fichas disponibles, **Then** el nivel se marca como fallido.
4. **Given** el lanzamiento de la ficha naranja resulta en un missclick, **When** se alcanza el
   estado estable, **Then** el nivel queda sin determinar (mismo comportamiento ya validado para
   verde — la ficha vuelve a la mano).
5. **Given** el nivel de prueba ya existente de la ficha verde, **When** se implementa esta
   historia, **Then** ese nivel sigue resolviéndose exactamente igual que antes, sin ningún cambio
   de comportamiento observable.

### Edge Cases

- ¿Qué ocurre si la segunda casilla más allá del punto de impacto (el destino final del salto) cae
  fuera del tablero? Fuera de alcance para esta historia: el nivel de prueba se diseña para que el
  aterrizaje quede siempre dentro del tablero, igual que ya se hizo para verde con su casilla de
  destino.
- ¿Qué ocurre si la ficha intermedia "saltada" es del mismo color que la que la salta? No aplica
  todavía: la regla de mismo color no está implementada en esta historia (queda para una historia
  posterior del roadmap). Por eso el nivel de prueba de naranja no coloca ninguna ficha naranja en
  el tablero — todas las fichas ya colocadas son verdes; la única ficha naranja es la que se lanza.
- ¿Qué ocurre si el aterrizaje de naranja cae sobre una casilla ocupada y desencadena una cascada?
  MUST seguir funcionando, siguiendo la regla universal de interacción: en cada eslabón de la
  cascada, la distancia de empuje la determina el color de la ficha que golpea en ese instante, no
  el de la ficha que la recibe (ver spec.md 002 → nota de corrección 2026-08-23). Verificado con un
  test dedicado (`orange.test.ts`) con colores mixtos en la misma cascada.
- ¿Qué ocurre si el impacto de naranja ocurre en la primera casilla del tablero (igual que el edge
  case ya cubierto para verde)? Se desencadena la interacción igualmente; no se considera missclick
  por colisionar temprano, y el salto de dos casillas se resuelve igual, contando desde esa primera
  casilla.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST reutilizar, sin modificarlo, el mecanismo de lanzamiento ya existente
  (viaje casilla a casilla, missclick, cola de eventos, estado estable, comprobación de objetivo)
  para la ficha naranja.
- **FR-002**: El sistema MUST hacer que, al ser impactada por una ficha naranja, la ficha ya
  colocada salte sobre la casilla inmediatamente siguiente en la dirección del impacto sin alterar
  en absoluto lo que esa casilla intermedia contenga.
- **FR-003**: El sistema MUST hacer que la ficha impactada aterrice exactamente dos casillas más
  allá de su posición original (en la dirección del impacto) cuando esa casilla de aterrizaje esté
  libre, terminando ahí la cadena de eventos para esa interacción.
- **FR-004**: El sistema MUST desencadenar una nueva interacción en cascada cuando la casilla de
  aterrizaje (dos casillas más allá del punto de impacto) esté ocupada, siguiendo la misma regla
  universal de interacción ya usada para la ficha verde: en cada eslabón, la distancia de empuje la
  determina el color de la ficha que golpea en ese momento (ver Edge Cases). Verificado con un
  escenario de cascada de colores mixtos, añadido tras detectar que la primera implementación
  usaba por error el color de la ficha golpeada.
- **FR-005**: El sistema MUST permitir que la ficha naranja lanzada se asiente en la posición que
  ocupaba la ficha impactada, una vez que esta ha sido reubicada.
- **FR-006**: El comportamiento existente de la ficha verde (viaje, missclick, empuje de una
  casilla, victoria/derrota/sin determinar) MUST permanecer sin cambios tras añadir esta historia.
- **FR-007**: El sistema MUST determinar victoria, derrota, o "sin determinar" tras un lanzamiento
  de naranja siguiendo exactamente las mismas reglas ya establecidas para verde (objetivo cumplido
  en estado estable → victoria; objetivo no cumplido y mano vacía → derrota; objetivo no cumplido y
  mano con fichas disponibles → sin determinar).

### Key Entities

- **Ficha naranja**: nueva variante de ficha, con el mismo modelo de datos que la ficha verde
  (color + posición), pero con un comportamiento de impacto distinto (salto de dos casillas en vez
  de empuje de una).
- **Nivel de prueba de naranja**: nueva configuración de tablero/mano/objetivo, independiente de
  `testLevelGreen01`, con dos fichas verdes ya colocadas (impacto + intermedia) diseñada para
  ejercitar el salto de dos casillas y la integridad de la casilla intermedia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El sistema comprueba correctamente, en el 100% de las ejecuciones del nivel de
  prueba de naranja, si una ficha ocupa exactamente la casilla objetivo una vez alcanzado el
  estado estable — sin necesitar ninguna interfaz visual.
- **SC-002**: El 100% de los impactos de naranja dejan la casilla intermedia (la saltada) idéntica
  a como estaba antes del lanzamiento, verificable casilla por casilla.
- **SC-003**: El 100% de las partidas del nivel de prueba de verde ya existente siguen produciendo
  el mismo resultado que antes de esta historia (sin regresión).
- **SC-004**: Repetir el mismo nivel de prueba de naranja con la misma dirección de lanzamiento
  produce el mismo resultado el 100% de las veces (determinismo verificable).

## Assumptions

- **Quién salta**: siguiendo el mismo criterio ya usado (y validado en la implementación) para la
  ficha verde — donde la ficha impactada es la que reacciona, no la ficha lanzada — en esta
  historia es la ficha IMPACTADA la que salta dos casillas; la ficha naranja lanzada se asienta en
  la posición original de la ficha impactada, exactamente igual que verde se asienta tras empujar.
  Se documenta como asunción razonada (no como pregunta abierta) por coherencia directa con el
  precedente ya construido y probado.
- La ficha intermedia "saltada" permanece completamente intacta: no se mueve, no se elimina, no se
  ve afectada de ninguna forma por el salto. Esto es una exigencia explícita del feature description
  y se verifica con un test dedicado (SC-002).
- Esta historia no cambia el comportamiento observable ya construido para la ficha verde (viaje,
  missclick, empuje, victoria/derrota/sin determinar) — solo añade el comportamiento nuevo de la
  ficha naranja. El nivel de prueba de verde ya existente es la referencia de no-regresión.
- El nivel de prueba de naranja es independiente del de verde (no lo reutiliza ni lo modifica), y
  se diseña, igual que el de verde, para que el objetivo no se cumpla en el estado inicial.
- Al igual que en la historia de verde, esta historia cubre un único lanzamiento por nivel de
  prueba; el resultado "sin determinar" tras un missclick se comporta exactamente igual que ya se
  estableció para verde (no requiere lógica nueva, solo un nivel de prueba que ejercite ese path
  con la ficha naranja).
- El nivel de prueba de naranja no coloca ninguna ficha naranja en el tablero: las dos fichas ya
  colocadas (impacto e intermedia) son verdes. Evita solaparse con la regla de mismo color, no
  implementada todavía (ver Edge Cases), y mantiene el alcance de esta historia acotado al salto
  de dos casillas en sí, sin depender de ninguna otra regla futura.
- El nivel de prueba principal (`testLevelOrange01`) valida el salto de dos casillas y la
  integridad de la casilla intermedia con la casilla de aterrizaje vacía a propósito, sin cascada.
  La cascada (FR-004) se verifica por separado con un nivel ad-hoc de colores mixtos, añadido el
  2026-08-23 tras corregir un defecto real: la primera implementación determinaba la distancia de
  empuje por el color de la ficha golpeada en vez de la que golpea, lo que quedaba enmascarado en
  el nivel principal porque ambas fichas del tablero son verdes.
