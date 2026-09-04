# Feature Specification: Ficha Arcoíris (Cambio de Color)

**Feature Branch**: `024-rainbow-color-change`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Añadir la ficha arcoíris al motor. Comportamiento distinto al de la ficha negra y al resto de fichas existentes: 1. La ficha arcoíris (lanzada o asentada en el tablero) NO genera movimiento en los impactos -- en vez de desplazar o empujar, el impacto produce un CAMBIO DE COLOR en una de las dos fichas implicadas (la propia arcoíris o la ficha con la que choca -- a definir cuál). 2. Es la primera vez que, tras un lanzamiento, se devuelve el control al usuario a mitad de la resolución: el flujo debe pausarse para esperar que el propio usuario elija el color resultante. Se debe abrir un pequeño diálogo flotante que apunte a la ficha que va a cambiar de color, mostrando todos los colores posibles a los que puede cambiar (todos excepto arcoíris). Al hacer clic en un color, se aplica el cambio y el proceso de resolución continúa (incluyendo cualquier reacción en cadena que ese nuevo color pueda producir). 3. Nuevo efecto de sonido propio para el impacto de arcoíris (distinto de los sonidos de choque existentes). 4. Igual que con la ficha negra: por ahora NO se integra en el generador de niveles (tools/generator), solo en el motor y el renderer."

## Clarifications

### Session 2026-09-03

- Q: Cuando arcoíris interactúa con otra ficha de distinto color (lanzada contra una ficha asentada, o una arcoíris asentada golpeada por otra ficha), ¿cuál de las dos fichas cambia de color (y por tanto sobrevive, ya recoloreada), y cuál desaparece consumida por el efecto? → A: Siempre la defensora -- la ficha que YA estaba en la casilla del impacto. Si arcoíris se lanza y golpea a X, X cambia de color y arcoíris desaparece. Si una arcoíris asentada es golpeada por Y, la propia arcoíris cambia de color e Y desaparece. Coincide con el documento de diseño original ("cambia el color de la ficha impactada").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lanzar una ficha arcoíris cambia el color de la ficha con la que impacta (Priority: P1)

El jugador lanza una ficha arcoíris desde la mano. En vez de empujar, dividir o limpiar una línea
como haría cualquier otro color, el impacto no genera ningún movimiento: se detiene la resolución
y se pide al jugador que elija el color resultante para la ficha con la que arcoíris ha
colisionado (la defensora). Al elegir un color, esa ficha pasa a tener el color elegido y la
propia arcoíris desaparece, consumida por el efecto.

**Why this priority**: Es el comportamiento que define a esta ficha — la primera vez que un
impacto no mueve ni elimina una línea, sino que transforma el color de una ficha ya existente, y
la primera vez que la resolución de un lanzamiento requiere una decisión explícita del jugador a
mitad de camino. Sin esto no hay ficha arcoíris.

**Independent Test**: Colocar una ficha de un color conocido en el tablero, lanzar una ficha
arcoíris para que impacte contra ella, elegir un color distinto en el diálogo que aparece, y
comprobar que esa ficha ahora tiene el color elegido y que la ficha arcoíris ya no está en el
tablero.

**Acceptance Scenarios**:

1. **Given** una ficha arcoíris se lanza y su camino encuentra una ficha de distinto color,
   **When** se produce el impacto, **Then** la resolución se detiene y se presenta al jugador un
   selector con todos los colores posibles excepto arcoíris, señalando la ficha que va a cambiar.
2. **Given** el selector de color está abierto tras un impacto de arcoíris, **When** el jugador
   elige un color, **Then** la ficha con la que arcoíris impactó pasa a tener ese color, la propia
   ficha arcoíris desaparece, y la resolución del lanzamiento continúa hasta alcanzar un estado
   estable.
3. **Given** una ficha arcoíris se lanza y no encuentra ninguna ficha en todo el carril, **When**
   eso ocurre, **Then** se aplica el missclick ya existente (spec.md 003 / 006): la ficha vuelve a
   la mano, sin abrir ningún selector de color.

---

### User Story 2 - Una ficha arcoíris asentada en el tablero cambia su propio color al ser golpeada (Priority: P1)

Una ficha arcoíris ya asentada en el tablero es golpeada por otra ficha de distinto color en
movimiento (lanzada desde la mano, o desplazada como parte de una cadena en curso). En vez de que
la atacante la empuje o interactúe según su propia mecánica, es la propia arcoíris (la defensora)
la que cambia al color que el jugador elija; la ficha atacante desaparece, consumida por el
efecto.

**Why this priority**: Sin esto, la ficha arcoíris solo tendría efecto la primera vez que se
lanza desde la mano — nunca como una ficha ya colocada en el tablero, a diferencia de cómo se
comportan ya el resto de colores (que siguen actuando como defensoras después de asentarse).

**Independent Test**: Colocar una ficha arcoíris en el tablero, golpearla con una ficha de
distinto color, elegir un color en el diálogo que aparece, y comprobar que la ficha que antes era
arcoíris ahora tiene el color elegido, y que la ficha atacante ha desaparecido del tablero.

**Acceptance Scenarios**:

1. **Given** una ficha arcoíris asentada en el tablero es golpeada por una ficha de distinto
   color, **When** se produce el impacto, **Then** la resolución se detiene y se presenta al
   jugador el mismo selector de color, señalando a la propia ficha arcoíris.
2. **Given** el jugador elige un color en ese selector, **When** se aplica el cambio, **Then** la
   ficha que antes era arcoíris pasa a tener el color elegido, la ficha atacante desaparece, y la
   resolución continúa.

---

### User Story 3 - Arcoíris contra arcoíris sigue siendo una aniquilación por mismo color (Priority: P2)

Cuando una ficha arcoíris golpea (o es golpeada por) otra ficha arcoíris, se aplica la regla de
aniquilación por mismo color ya existente (spec.md 003) — ambas desaparecen inmediatamente y no
se abre ningún selector de color.

**Why this priority**: Mantiene la prioridad ya establecida de la regla de mismo color sobre
cualquier comportamiento específico de color (el mismo patrón ya seguido por rojo y por negro) —
sin esto, el comportamiento de arcoíris contra arcoíris quedaría indefinido.

**Independent Test**: Colocar dos fichas arcoíris de forma que una golpee a la otra y comprobar
que ambas desaparecen sin que se abra ningún selector de color.

**Acceptance Scenarios**:

1. **Given** una ficha arcoíris golpea a otra ficha arcoíris, **When** se resuelve el impacto,
   **Then** ambas desaparecen inmediatamente, sin selector de color y sin cambiar ningún color.

---

### User Story 4 - El impacto de arcoíris tiene un sonido propio (Priority: P3)

Cuando se resuelve un impacto de arcoíris que produce un cambio de color, se reproduce un efecto
de sonido propio, distinto de los sonidos de choque ya existentes para el resto de colores.

**Why this priority**: Es una mejora de percepción/feedback, no un requisito de las reglas del
juego — el resto de esta feature es completamente funcional sin ella.

**Independent Test**: Provocar un impacto de arcoíris y comprobar (de oído, o inspeccionando qué
efecto de sonido se dispara) que suena el efecto propio de arcoíris, no el de un choque genérico.

**Acceptance Scenarios**:

1. **Given** se resuelve un impacto de arcoíris que cambia el color de una ficha, **When** ese
   cambio se aplica, **Then** se reproduce el efecto de sonido propio de arcoíris.

---

### Edge Cases

- ¿Qué ocurre si el lanzamiento de una ficha arcoíris no encuentra ninguna ficha en todo el
  carril? Se aplica el missclick ya existente (spec.md 003) — la ficha vuelve a la mano, no se
  abre ningún selector de color.
- ¿Qué ocurre si una ficha arcoíris golpea a otra ficha arcoíris? Se aplica la aniquilación por
  mismo color ya existente — el cambio de color nunca llega a producirse (User Story 3).
- ¿Qué ocurre si arcoíris golpea (o es golpeada por) una ficha negra? La ficha negra ya asentada
  domina siempre que está implicada en un impacto de distinto color, sea cual sea el rol que
  ocupe (atacante o defensora) — comportamiento ya establecido y sin cambios por esta feature
  (research.md de 023-black-piece-line-clear, Decisión 3). El cambio de color de arcoíris nunca
  llega a producirse en ese caso: gana la limpieza de línea de negro.
- ¿Qué ocurre si arcoíris golpea (o es golpeada por) una ficha roja? Arcoíris domina sobre la
  ramificación de rojo, sea cual sea el rol que ocupe cada una — el mismo patrón de prioridad ya
  establecido para negro frente a rojo (research.md de 023, Decisión 3), aplicado ahora también a
  arcoíris. La ficha roja implicada nunca llega a dividirse.
- ¿Qué ocurre con el resto de la cadena mientras el selector de color está abierto? Ninguna otra
  interacción pendiente de la misma cadena (por ejemplo, otra rama de una división de rojo
  anterior) avanza hasta que el jugador elige un color. Tras la elección, la resolución continúa
  con normalidad y puede volver a detenerse si encuentra otro impacto de arcoíris más adelante en
  la misma cadena.
- ¿Qué ocurre con la ficha ya recoloreada? Se comporta a partir de ese momento exactamente como
  cualquier ficha de su nuevo color — el cambio es permanente y solo afecta a impactos futuros
  contra ella, no genera ningún movimiento ni reacción adicional en el impacto de arcoíris que lo
  produjo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE soportar 'arcoíris' como un color de ficha adicional, junto a los
  ya existentes.
- **FR-002**: Cuando una ficha arcoíris (lanzada desde la mano, o ya asentada en el tablero)
  impacta contra una ficha de distinto color, en vez de generar cualquier movimiento (empuje,
  división o limpieza de línea) DEBE detenerse la resolución y solicitarse al jugador que elija
  el color resultante entre todos los colores existentes excepto arcoíris.
- **FR-003**: La ficha cuyo color cambia DEBE ser siempre la defensora del impacto: si arcoíris
  fue la ficha lanzada o en movimiento, cambia de color la ficha con la que impactó; si arcoíris
  ya estaba asentada en el tablero y fue golpeada, cambia de color la propia arcoíris.
- **FR-004**: La ficha que NO cambia de color (la propia arcoíris, si era la atacante; o la ficha
  atacante, si golpeó a una arcoíris asentada) DEBE desaparecer del tablero como parte del mismo
  impacto, sin ejecutar su propio efecto — igual que ya ocurre con la ficha disparadora en la
  limpieza de línea de negro (spec.md 023, FR-004/FR-005).
- **FR-005**: Mientras el jugador no haya elegido un color, el sistema NO DEBE avanzar ninguna
  otra parte de la resolución del lanzamiento en curso — ni movimientos, ni impactos adicionales,
  ni la comprobación final del objetivo.
- **FR-006**: Tras aplicar el cambio de color elegido, la resolución DEBE continuar exactamente
  igual que si el impacto de arcoíris hubiera sido la interacción resuelta en ese punto de la
  cadena, procesando con normalidad cualquier interacción pendiente que quedara de antes (por
  ejemplo, otra rama de una división de rojo previa) — incluyendo, si corresponde, detenerse de
  nuevo ante un impacto de arcoíris posterior en la misma cadena.
- **FR-007**: El impacto de arcoíris NO DEBE generar ningún `MOVE_STEP` ni desplazamiento — el
  cambio de color es el único efecto de este impacto, y no deja ninguna interacción nueva
  pendiente por sí mismo.
- **FR-008**: Cuando una ficha arcoíris golpea a otra ficha arcoíris, DEBE aplicarse la regla de
  aniquilación por mismo color ya existente, sin abrir ningún selector de color.
- **FR-009**: Cuando arcoíris está implicada en un impacto de distinto color junto con una ficha
  negra, DEBE ganar el comportamiento ya establecido de negro (spec.md 023, Decisión 3) — negro
  domina en cualquier rol; el cambio de color de arcoíris no llega a producirse.
- **FR-010**: Cuando arcoíris está implicada en un impacto de distinto color junto con una ficha
  roja, DEBE ganar el cambio de color de arcoíris sobre la ramificación de rojo, sea cual sea el
  rol que ocupe cada una — la ficha roja implicada nunca llega a dividirse.
- **FR-011**: Una ficha arcoíris DEBE poder lanzarse desde la mano con el mismo mecanismo ya
  usado para las demás piezas, incluyendo el missclick (si su camino no encuentra ninguna ficha
  en todo el carril, vuelve a la mano sin abrir ningún selector de color).
- **FR-012**: El sistema DEBE reproducir un efecto de sonido propio de arcoíris cuando se aplica
  un cambio de color, distinto de los sonidos de choque ya existentes.
- **FR-013**: Ninguna regla ya existente (verde, naranja, marrón, rojo, negro, mismo color,
  wrap-around) DEBE cambiar de comportamiento como consecuencia de esta feature.

### Key Entities

- **Color de ficha 'arcoíris'**: un color adicional de ficha, junto a los ya existentes.
- **Cambio de color**: el efecto producido por un impacto de distinto color en el que arcoíris
  está implicada — la ficha defensora del impacto pasa a tener el color elegido explícitamente
  por el jugador (cualquier color existente excepto arcoíris); la otra ficha implicada
  desaparece. No se genera ningún movimiento.
- **Selección de color pendiente**: el estado en el que queda la resolución de un lanzamiento
  mientras espera que el jugador elija el color resultante de un impacto de arcoíris — ninguna
  otra parte de esa resolución avanza hasta que se recibe la elección.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras un impacto de distinto color en el que arcoíris está implicada (en cualquiera
  de los dos roles), la ficha defensora del impacto termina con el color que el jugador eligió
  explícitamente entre las opciones ofrecidas, en el 100% de los casos.
- **SC-002**: Mientras el jugador no ha elegido un color, ninguna otra parte de la resolución del
  lanzamiento en curso avanza, en el 100% de los casos.
- **SC-003**: Tras elegir un color, la resolución del lanzamiento continúa hasta alcanzar un
  estado estable, procesando correctamente cualquier interacción pendiente adicional, en el 100%
  de los casos.
- **SC-004**: Un impacto de arcoíris contra arcoíris produce la misma aniquilación por mismo
  color ya validada para el resto de colores, sin abrir ningún selector, en el 100% de los casos.
- **SC-005**: Una ficha arcoíris lanzada desde la mano produce el mismo comportamiento de
  missclick ya validado para las demás piezas cuando su camino no encuentra ninguna ficha, en el
  100% de los casos.
- **SC-006**: El efecto de sonido propio de arcoíris se reproduce en el 100% de los impactos de
  arcoíris que producen un cambio de color.

## Assumptions

- La ficha que cambia de color es siempre la defensora del impacto (FR-003): confirmado con el
  usuario tras plantear la pregunta directamente, y coincide con el documento de diseño original
  ("cambia el color de la ficha impactada").
- La ficha que no cambia de color desaparece en silencio, sin ejecutar su propio efecto (FR-004):
  mismo patrón ya aplicado a la ficha disparadora de la limpieza de línea de negro (spec.md 023).
- El impacto de arcoíris no genera ningún movimiento ni deja interacciones pendientes por sí
  mismo (FR-007): confirmado explícitamente por el usuario en la descripción de la feature. El
  color elegido solo afecta a impactos futuros contra esa ficha, no reabre ninguna reacción en
  cadena inmediata dentro del mismo impacto.
- Prioridad frente a negro (FR-009): se mantiene sin cambios el comportamiento ya implementado y
  probado de negro (dominante en cualquier rol, research.md 023 Decisión 3) — un valor por
  defecto conservador que no modifica ningún comportamiento ya existente, ya que el usuario no
  especificó esta interacción cruzada entre dos fichas especiales.
- Prioridad frente a rojo (FR-010): arcoíris sigue el mismo patrón de dominancia ya establecido
  para negro frente a rojo (research.md 023 Decisión 3), extendido ahora también a arcoíris —
  igual de conservador, ya que ese patrón ya existe en el motor y no introduce ningún caso nuevo
  sin precedente.
- El lanzamiento de una ficha arcoíris sigue exactamente la misma convención de missclick ya
  existente para el resto de colores (spec.md 003/006).
- Un impacto de arcoíris contra otra arcoíris sigue la prioridad ya existente de la regla de
  mismo color (spec.md 003) sobre cualquier comportamiento específico de color.
- El mecanismo concreto de pausa y reanudación de la resolución (cómo se representa el estado
  "esperando elección del jugador" sin acoplar el motor a la interfaz gráfica) es una decisión de
  diseño técnico que se resuelve en la fase de planificación, no en esta especificación.
- El diálogo flotante de selección de color es un detalle de interfaz (posición, estilo,
  animación) que se resuelve en la fase de planificación/implementación — esta especificación
  solo exige que exista, que señale a la ficha afectada, y que ofrezca todos los colores
  existentes excepto arcoíris.
- Igual que con la ficha negra (spec.md 023): esta feature es únicamente de motor y renderer — el
  generador de niveles (tools/generator) no se modifica para poder generar arcoíris
  automáticamente; podrá añadirse manualmente a niveles concretos si se desea probar.
