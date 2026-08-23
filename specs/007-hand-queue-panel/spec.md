# Feature Specification: Panel de Fichas en Mano

**Feature Branch**: `007-hand-queue-panel`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Añadir un panel debajo del tablero, en la pantalla de juego del prototipo de Fase 2, que muestre toda la cola de fichas que le quedan al jugador en la mano -- todas las que tiene pendientes de lanzar, no solo la siguiente. El orden de la cola se entiende implícitamente por la posición en el panel, sin indicador especial adicional para la próxima ficha. El panel se actualiza cada vez que se lanza una ficha (la cola se acorta en uno). Cuando la mano se vacía, el panel queda vacío, coincidiendo con el momento en que ya no se puede lanzar nada más en ese nivel."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver qué fichas quedan por lanzar (Priority: P1)

Mientras juega un nivel, el jugador ve, debajo del tablero, todas las fichas que le quedan
pendientes de lanzar en su mano — no solo la próxima, todas las de la cola, en el mismo orden en
que se usarán.

**Why this priority**: Ahora mismo el jugador dispara sin saber qué le queda — no puede
planificar. Es la razón de ser de esta feature.

**Independent Test**: Cargar cualquiera de los niveles con más de una ficha en mano (p. ej. el
nivel 3 o el 10, que usan dos) y comprobar que el panel muestra ambas fichas, en el mismo orden
en que están definidas en la mano del nivel.

**Acceptance Scenarios**:

1. **Given** el jugador está jugando un nivel con varias fichas en mano, **When** observa el
   panel debajo del tablero, **Then** ve representada cada ficha que le queda por lanzar, con su
   color correspondiente.
2. **Given** el panel muestra la cola de fichas, **When** el jugador se fija en su orden,
   **Then** la primera ficha del panel es la que se usará en el próximo lanzamiento — sin ningún
   marcador adicional que lo señale explícitamente, el propio orden ya lo comunica.

---

### User Story 2 - El panel se mantiene al día con cada lanzamiento (Priority: P2)

Cada vez que el jugador lanza una ficha, el panel se actualiza al instante para reflejar la
mano restante — la ficha usada desaparece del panel y el resto conserva su orden.

**Why this priority**: Sin esto, el panel de la US1 sería una foto fija del estado inicial, útil
solo al entrar al nivel. Necesita seguir siendo cierto durante toda la partida.

**Independent Test**: Cargar un nivel con dos o más fichas en mano, lanzar una, y comprobar que
el panel ahora muestra una ficha menos, sin alterar el orden relativo de las que quedan.

**Acceptance Scenarios**:

1. **Given** el panel muestra varias fichas, **When** el jugador lanza la primera de la cola,
   **Then** el panel pasa a mostrar una ficha menos, y las restantes mantienen su orden.
2. **Given** el jugador lanza la última ficha que le quedaba en mano, **When** ese lanzamiento
   se resuelve, **Then** el panel queda vacío — exactamente el mismo momento en que ya no se
   puede iniciar ningún lanzamiento más en ese nivel.
3. **Given** un lanzamiento resulta en missclick, **When** eso ocurre, **Then** el panel no
   cambia — la ficha vuelve a la mano y sigue apareciendo en la misma posición de la cola.

---

### Edge Cases

- ¿Qué ocurre en un nivel cuya mano tiene una sola ficha? El panel muestra esa única ficha, y
  queda vacío en cuanto se lanza (sea cual sea el resultado del impacto).
- ¿Qué ocurre si el jugador reinicia el nivel o vuelve a entrar a él? El panel se reconstruye
  desde la mano inicial declarada del nivel, igual que el resto del estado (FR-012, spec.md
  005).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar, debajo del tablero mientras se juega un nivel, un panel
  con todas las fichas que le quedan al jugador en la mano.
- **FR-002**: El panel DEBE presentar las fichas en el mismo orden en que se usarán — la primera
  posición del panel es siempre la próxima ficha a lanzar — sin ningún indicador adicional
  aparte de esa posición.
- **FR-003**: Cada ficha del panel DEBE distinguirse por color, con la misma representación de
  color ya usada para las fichas en el tablero.
- **FR-004**: El panel DEBE actualizarse inmediatamente después de cada lanzamiento que consuma
  una ficha, quitando exactamente la usada y conservando el orden relativo del resto.
- **FR-005**: El panel NO DEBE cambiar tras un lanzamiento que resulte en missclick, ya que la
  ficha vuelve a la mano sin alterar su posición en la cola.
- **FR-006**: Cuando la mano quede vacía, el panel DEBE quedar sin ninguna ficha.
- **FR-007**: El panel NO DEBE influir en qué ficha se lanza a continuación ni en ninguna otra
  decisión de juego — se limita a reflejar el estado de la mano que ya determina el motor
  (Principio I).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En cualquier momento de una partida, el jugador puede ver cuántas y qué fichas le
  quedan por lanzar sin necesitar ninguna acción adicional (sin abrir un menú, sin recordar el
  estado inicial de memoria).
- **SC-002**: Tras el 100% de los lanzamientos que consumen una ficha, el número de fichas
  mostradas en el panel coincide exactamente con el tamaño de la mano que devuelve el motor.
- **SC-003**: El panel queda vacío exactamente en el mismo momento en que la mano del motor
  queda vacía — nunca antes, nunca después.

## Assumptions

- No se diseña ningún mecanismo de desplazamiento o ajuste para manos con muchas fichas — los
  10 niveles actuales del prototipo usan como máximo 2 fichas en mano. Si una futura mano
  necesitara más, el diseño visual del panel tendría que revisitarse; queda fuera de alcance
  aquí.
- El panel es puramente informativo — no es interactivo (no se puede tocar una ficha del panel
  para elegirla o reordenarla); la mano siempre se consume en orden, como ya establece FR-005 de
  spec.md 005.
- El estilo visual de cada ficha en el panel reutiliza la misma representación por color que ya
  usa el tablero (círculos de color), sin introducir ningún asset de arte nuevo.
