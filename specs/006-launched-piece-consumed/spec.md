# Feature Specification: La Ficha Lanzada Nunca Permanece en el Tablero

**Feature Branch**: `006-launched-piece-consumed`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Corrección de un error de concepto: una ficha lanzada desde la mano nunca debe quedarse asentada en el tablero tras provocar un impacto, sea cual sea el resultado (aniquilación o empuje). Solo cambia el destino final de la ficha originalmente lanzada; el resto de la cadena de resolución (fichas ya en el tablero empujándose entre sí) no cambia."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La ficha lanzada se consume al impactar (Priority: P1)

Un jugador lanza una ficha desde su mano. Esa ficha golpea a otra que ya está en el tablero.
Sea cual sea el resultado de ese primer impacto (ambas desaparecen porque son del mismo color,
o la ficha golpeada es empujada porque es de otro color), la ficha que el jugador lanzó **no
permanece nunca en el tablero** — actuó como el agente que provocó la interacción, no como una
pieza que pasa a residir allí.

**Why this priority**: Es la corrección del error de concepto en sí. Sin esto, el jugador ve
fichas de su mano "materializarse" permanentemente en el tablero, lo cual contradice el axioma
del propio diseño del juego: el jugador no coloca fichas directamente, introduce un agente que
provoca interacciones.

**Independent Test**: Lanzar una ficha contra otra de distinto color en un tablero por lo demás
vacío y comprobar que, tras resolverse el impacto, la casilla donde se produjo ese primer
impacto queda vacía — nunca ocupada por la ficha lanzada.

**Acceptance Scenarios**:

1. **Given** una ficha en el tablero de distinto color a la lanzada, **When** el lanzamiento la
   golpea y la empuja a una casilla vacía, **Then** la ficha empujada ocupa su nueva casilla y
   la casilla del impacto original queda vacía — la ficha lanzada no aparece en ningún lugar del
   tablero.
2. **Given** una ficha en el tablero del mismo color que la lanzada, **When** el lanzamiento la
   golpea, **Then** ambas desaparecen (sin cambios respecto al comportamiento ya existente).
3. **Given** un impacto que desencadena una cadena de varias fichas, **When** esa cadena termina
   en una casilla ocupada por una ficha del mismo color que la que llegó hasta ahí (aniquilación
   en mitad de la cadena), **Then** la ficha lanzada tampoco aparece en el tablero — el resultado
   es el mismo que si su propio primer impacto hubiera sido directamente una aniquilación.

---

### User Story 2 - Las fichas que ya estaban en el tablero se comportan exactamente igual (Priority: P2)

Cuando una ficha que ya estaba en el tablero (no la lanzada desde la mano) empuja a otra más
adelante en una misma cadena, y ese empuje no termina en aniquilación, esa ficha sigue
asentándose en la casilla que deja libre la ficha a la que empujó — exactamente igual que antes
de esta corrección.

**Why this priority**: Delimita el alcance del cambio. Sin esta garantía explícita, existe el
riesgo de sobre-corregir y romper el comportamiento de cascada ya validado en las features
001-004 (naranja saltando, cascadas mixtas, wrap-around) que no tiene nada que ver con el error
que se corrige aquí.

**Independent Test**: Reproducir una cascada de 3+ fichas ya existente en el motor (p. ej. una
ficha empuja a otra, que a su vez empuja a una tercera) y comprobar que el resultado de esa
cascada — aparte de la ficha originalmente lanzada — es idéntico al que producía el motor antes
de esta corrección.

**Acceptance Scenarios**:

1. **Given** una cadena en la que una ficha ya colocada en el tablero empuja a otra y esa
   segunda ficha no se aniquila con nada, **When** la cadena se resuelve, **Then** la primera
   ficha (la que empujó) se asienta en la casilla que la segunda dejó libre, igual que antes.
2. **Given** cualquier lanzamiento ya cubierto por las suites de test existentes del motor
   (verde, naranja, mismo color, wrap-around), **When** se ejecuta tras esta corrección,
   **Then** produce el mismo resultado que antes en todo excepto en dónde (o si) aparece la
   ficha originalmente lanzada.

---

### Edge Cases

- ¿Qué ocurre en un missclick (la ficha lanzada no encuentra nada en su trayecto)? Sin cambios —
  no hay impacto, la ficha vuelve a la mano tal cual, este caso nunca llegó a "asentarse" en el
  tablero ni antes ni ahora.
- ¿Qué ocurre si el empuje de la ficha lanzada cruza el borde del tablero (wrap-around)? La
  ficha empujada reaparece por el lado opuesto exactamente igual que antes; lo único que cambia
  es que la ficha lanzada no ocupa la casilla original del impacto.
- ¿Qué ocurre con los niveles ya existentes (motor y prototipo de Fase 2) cuyo objetivo dependía
  de que la ficha lanzada se quedara en el tablero? Dejan de ser superables tal cual estaban
  definidos y deben rediseñarse para seguir demostrando la misma mecánica (aniquilación mismo
  color, empuje, wrap-around) de una forma que sí sea válida bajo la regla corregida.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El motor NO DEBE colocar la ficha originalmente lanzada desde la mano en ninguna
  casilla del tablero tras resolverse su impacto, cuando ese impacto empuja a una ficha de
  distinto color (en vez de aniquilarla).
- **FR-002**: El motor DEBE mantener sin cambios la regla ya existente de que una ficha lanzada
  contra una del mismo color se aniquila junto a ella, sin que ninguna de las dos permanezca.
- **FR-003**: Cuando el impacto de la ficha lanzada desencadena una cascada que termina en una
  aniquilación en un eslabón posterior (no en el primer impacto), el motor NO DEBE colocar la
  ficha lanzada en el tablero — el resultado para ella es el mismo que si hubiera aniquilado
  directamente.
- **FR-004**: El motor DEBE seguir asentando normalmente a cualquier ficha que YA estuviera en
  el tablero cuando empuje a otra ficha en un eslabón de la cadena y ese empuje no termine en
  aniquilación — este comportamiento no cambia respecto al existente.
- **FR-005**: Ninguna otra regla de resolución de cadena (distancias de empuje por color,
  wrap-around, orden de resolución, regla de mismo color) DEBE cambiar como consecuencia de esta
  corrección.
- **FR-006**: Los niveles existentes (fixtures del motor y los 10 niveles del prototipo de Fase
  2) cuyo objetivo dependía del comportamiento incorrecto DEBEN rediseñarse para seguir siendo
  superables, demostrando la misma mecánica de forma válida bajo la regla corregida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100% de los lanzamientos posibles, la única ficha que puede aparecer en el
  tablero tras resolverse la cadena es una que ya estaba en el tablero antes del lanzamiento —
  nunca la ficha que vino de la mano.
- **SC-002**: El 100% de las suites de test ya existentes del motor pasan tras actualizarse para
  reflejar la regla corregida, sin que ninguna deje de verificar lo que verificaba antes (aparte
  de dónde se asienta o no la ficha lanzada).
- **SC-003**: Los 10 niveles del prototipo de Fase 2 siguen siendo superables ('won' alcanzable)
  usando únicamente las reglas de Fase 1, tras rediseñar los que dependían del comportamiento
  incorrecto.

## Assumptions

- Esta corrección no introduce ningún tipo de dato ni entidad nueva — es un cambio de
  comportamiento puro dentro de la resolución de cadena ya existente.
- El alcance se limita estrictamente a qué ocurre con la ficha originalmente lanzada desde la
  mano. Ninguna otra ficha, regla o mecánica cambia.
- Los niveles/fixtures que necesiten rediseñarse para seguir siendo válidos deben seguir
  demostrando la MISMA mecánica que demostraban antes (p. ej. un nivel pensado para ejercitar la
  regla de mismo color en cascada debe seguir ejercitando esa regla, no sustituirse por algo
  distinto).
