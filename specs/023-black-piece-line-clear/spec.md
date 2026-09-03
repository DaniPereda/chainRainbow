# Feature Specification: Ficha Negra (Limpieza de Línea)

**Feature Branch**: `023-black-piece-line-clear`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Añadir la ficha negra al motor, con una funcionalidad propia distinta de la considerada originalmente en el documento de diseño: en vez de que el jugador seleccione una casilla directamente, la ficha negra se lanza desde la mano como cualquier otra. Al lanzarla, limpia (elimina) todas las fichas de la fila o columna por la que viaja -- toda la fila si se lanza en dirección E/O, toda la columna si se lanza en dirección N/S. Igualmente, una ficha negra que ya esté asentada en el tablero, cuando sea golpeada por otra ficha (choque), limpia toda su fila o toda su columna -- el eje lo determina la dirección de la ficha que la golpea (impacto N/S limpia la columna, impacto E/O limpia la fila), siguiendo la misma convención que la ramificación del rojo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lanzar una ficha negra limpia toda su fila o columna (Priority: P1)

El jugador lanza una ficha negra desde la mano. En vez de empujar o dividir la primera ficha que
encuentra en su camino (como haría verde, naranja, marrón o rojo), la ficha negra limpia —
elimina— todas las fichas de la fila completa (si el lanzamiento fue en dirección E/O) o de la
columna completa (si el lanzamiento fue en dirección N/S) por la que viajaba.

**Why this priority**: Es el comportamiento que define a esta ficha — la primera vez que un
impacto afecta a una línea entera del tablero en vez de a una única casilla o a un movimiento en
línea recta. Sin esto no hay ficha negra.

**Independent Test**: Colocar varias fichas de distintos colores en una misma fila, lanzar una
ficha negra en dirección E u O por esa fila, y comprobar que todas las fichas de esa fila
desaparecen del tablero, sin afectar a ninguna otra fila.

**Acceptance Scenarios**:

1. **Given** una ficha negra se lanza en dirección E o O y su camino encuentra al menos una
   ficha, **When** se resuelve el impacto, **Then** todas las fichas que estuvieran en esa fila
   completa desaparecen del tablero.
2. **Given** una ficha negra se lanza en dirección N o S y su camino encuentra al menos una
   ficha, **When** se resuelve el impacto, **Then** todas las fichas que estuvieran en esa
   columna completa desaparecen del tablero.
3. **Given** una ficha negra se lanza y no encuentra ninguna ficha en todo el carril, **When**
   eso ocurre, **Then** se aplica el missclick ya existente (spec.md 003 / 006): la ficha vuelve
   a la mano y no se limpia nada.

---

### User Story 2 - Una ficha negra asentada en el tablero limpia su fila o columna al ser golpeada (Priority: P1)

Una ficha negra ya asentada en el tablero es golpeada por otra ficha de distinto color en
movimiento (lanzada desde la mano, o desplazada como parte de una cadena en curso). En vez de
empujarse como haría un color normal, la ficha negra limpia toda su fila o toda su columna — el
eje lo determina la dirección desde la que llegó el impacto, con la misma convención ya usada
por la ramificación de rojo (spec.md 009, FR-003): impacto desde N o S limpia la columna,
impacto desde E o O limpia la fila.

**Why this priority**: Sin esto, la ficha negra solo tendría efecto la primera vez que se lanza
desde la mano — nunca como una ficha ya colocada en el tablero, a diferencia de cómo se
comportan ya el resto de colores (que siguen actuando como defensoras después de asentarse).

**Independent Test**: Colocar una ficha negra en el tablero junto con varias fichas más
repartidas por su misma fila y columna, golpearla con una ficha de distinto color llegando desde
el norte, y comprobar que desaparecen todas las fichas de su columna (y no las de su fila).

**Acceptance Scenarios**:

1. **Given** una ficha negra asentada en el tablero es golpeada por una ficha de distinto color
   llegando desde el norte o el sur, **When** se resuelve el impacto, **Then** todas las fichas
   de esa columna completa desaparecen del tablero.
2. **Given** una ficha negra asentada en el tablero es golpeada por una ficha de distinto color
   llegando desde el este o el oeste, **When** se resuelve el impacto, **Then** todas las fichas
   de esa fila completa desaparecen del tablero.

---

### User Story 3 - Negro contra negro sigue siendo una aniquilación por mismo color (Priority: P2)

Cuando una ficha negra golpea (o es golpeada por) otra ficha negra, se aplica la regla de
aniquilación por mismo color ya existente (spec.md 003) — ambas desaparecen y ninguna ejecuta su
efecto propio. La limpieza de línea nunca llega a producirse en este caso.

**Why this priority**: Mantiene la prioridad ya establecida de la regla de mismo color sobre
cualquier comportamiento específico de color (el mismo patrón que ya sigue rojo — spec.md 009,
FR-006) — sin esto, el comportamiento de negro contra negro quedaría indefinido.

**Independent Test**: Colocar dos fichas negras de forma que una golpee a la otra y comprobar
que ambas desaparecen sin que se limpie ninguna fila ni columna.

**Acceptance Scenarios**:

1. **Given** una ficha negra golpea a otra ficha negra, **When** se resuelve el impacto, **Then**
   ambas desaparecen inmediatamente y no se limpia ninguna línea.

---

### Edge Cases

- ¿Qué ocurre si la línea a limpiar no contiene ninguna otra ficha aparte de la que provocó la
  limpieza? La propia ficha disparadora desaparece igualmente (FR-004) — el tablero queda con
  una casilla menos ocupada, sin ningún otro efecto visible.
- ¿Qué ocurre si el lanzamiento de una ficha negra no encuentra ninguna ficha en todo el carril?
  Se aplica el missclick ya existente (spec.md 003) — la ficha vuelve a la mano, no se limpia
  nada.
- ¿Qué ocurre si la línea a limpiar incluye la casilla objetivo (goal)? El objetivo es una marca
  sobre una casilla, no una ficha — no se ve afectado directamente por la limpieza; su
  cumplimiento se sigue comprobando solo al terminar toda la cadena (spec.md sección 6).
- ¿Qué ocurre si una ficha negra golpea a otra ficha negra? Se aplica la aniquilación por mismo
  color ya existente — la limpieza nunca llega a producirse (User Story 3).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE soportar 'negro' como un color de ficha adicional, junto a los ya
  existentes.
- **FR-002**: Cuando una ficha negra lanzada desde la mano encuentra una ficha de distinto color
  en su camino, en vez de empujarla o dividirla DEBE limpiarse (eliminarse del tablero) toda la
  fila completa (si el lanzamiento fue en dirección E/O) o toda la columna completa (si el
  lanzamiento fue en dirección N/S) por la que viajaba.
- **FR-003**: Cuando una ficha negra ya asentada en el tablero es golpeada por una ficha de
  distinto color, DEBE limpiarse (eliminarse del tablero) toda la fila completa (si el impacto
  llegó desde el este o el oeste) o toda la columna completa (si el impacto llegó desde el norte
  o el sur) a la que pertenece.
- **FR-004**: La ficha que provoca la limpieza (la ficha negra lanzada desde la mano, o la ficha
  que golpea a una negra ya asentada) DEBE quedar eliminada también, como parte de la fila o
  columna que limpia — la limpieza es total: ninguna ficha nueva queda asentada en el tablero
  como resultado directo de este impacto, ni la propia negra ni quien la golpeó.
- **FR-005**: Las fichas eliminadas por una limpieza de línea DEBEN desaparecer en silencio, sin
  ejecutar su propio efecto — igual que la aniquilación por mismo color ya existente (spec.md
  003). Una ficha roja eliminada por la limpieza NO llega a dividirse; una ficha negra eliminada
  por la limpieza NO llega a disparar su propia limpieza de otra fila o columna. El efecto queda
  contenido a esa única línea, sin cascadas adicionales.
- **FR-006**: Cuando una ficha negra golpea a otra ficha negra, DEBE aplicarse la regla de
  aniquilación por mismo color ya existente sin que se produzca ninguna limpieza de línea.
- **FR-007**: Una ficha negra DEBE poder lanzarse desde la mano con el mismo mecanismo ya usado
  para las demás piezas, incluyendo el missclick (si su camino no encuentra ninguna ficha en
  todo el carril, vuelve a la mano sin limpiar nada) y la regla de que la ficha lanzada nunca
  permanece literalmente en su propia casilla de entrada.
- **FR-008**: Ninguna regla ya existente (verde, naranja, marrón, rojo, mismo color,
  wrap-around) DEBE cambiar de comportamiento como consecuencia de esta feature.

### Key Entities

- **Color de ficha 'negro'**: un color adicional de ficha, junto a los ya existentes.
- **Limpieza de línea**: el efecto producido por un impacto contra negro (o de negro contra otra
  ficha) — la eliminación de todas las fichas de una fila o columna completa del tablero, en vez
  del empuje o la división ya usados por el resto de colores. El eje (fila o columna) lo
  determina la dirección de la ficha que llega al impacto, con la misma convención ya usada por
  la ramificación de rojo (spec.md 009, FR-003).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras el primer impacto de una ficha negra lanzada desde la mano, todas las fichas
  que estuvieran en la fila (lanzamiento E/O) o columna (lanzamiento N/S) completa por la que
  viajaba han desaparecido del tablero, en el 100% de los casos.
- **SC-002**: Tras un impacto de cualquier ficha de distinto color contra una negra ya asentada
  en el tablero, todas las fichas que estuvieran en la fila (impacto E/O) o columna (impacto
  N/S) completa a la que pertenecía esa negra han desaparecido del tablero, en el 100% de los
  casos.
- **SC-003**: Un impacto de negro contra negro produce la misma aniquilación por mismo color ya
  validada para el resto de colores, sin limpiar ninguna línea, en el 100% de los casos.
- **SC-004**: Una ficha negra lanzada desde la mano produce el mismo comportamiento de missclick
  ya validado para las demás piezas cuando su camino no encuentra ninguna ficha, en el 100% de
  los casos.

## Assumptions

- La limpieza de línea es total y se lleva consigo a quien la provoca (FR-004): confirmado con
  el usuario tras plantear la pregunta directamente — ni la ficha negra lanzada desde la mano ni
  la ficha que golpea a una negra ya asentada sobreviven a su propio impacto. Ninguna ficha
  nueva queda asentada en el tablero como resultado directo de este efecto.
- La eliminación de las fichas de la línea es silenciosa (FR-005): confirmado con el usuario —
  ninguna ficha eliminada por la limpieza ejecuta su propio efecto (una roja no se divide, una
  negra no dispara su propia limpieza), igual que ya ocurre en la aniquilación por mismo color.
  El efecto queda contenido a esa única línea, sin cascadas adicionales.
- El lanzamiento de una ficha negra sigue exactamente la misma convención de missclick ya
  existente para el resto de colores (spec.md 003/006): debe encontrar al menos una ficha en su
  camino para que se dispare la limpieza; si todo el carril está vacío, es un missclick y la
  ficha vuelve a la mano sin limpiar nada.
- La convención dirección→eje reutiliza exactamente la ya establecida por la ramificación de
  rojo (spec.md 009, FR-003): un impacto que llega desde el norte o el sur afecta al eje
  vertical (columna); un impacto que llega desde el este o el oeste afecta al eje horizontal
  (fila) — aquí aplicada a qué línea se limpia, en vez de a las direcciones de dos ramas nuevas.
- Un impacto de negro contra otra negra sigue la prioridad ya existente de la regla de mismo
  color (spec.md 003) sobre cualquier comportamiento específico de color — igual que ya hace rojo
  (spec.md 009, FR-006) — así que nunca llega a limpiarse ninguna línea en ese caso.
- Esta feature es únicamente de motor (headless), igual que el patrón ya usado por el resto de
  piezas (001-004, 008, 009) — no incluye ningún nivel nuevo en el prototipo frontend por
  separado.
