# Feature Specification: Ficha Marrón (Movimiento Largo Repetido)

**Feature Branch**: `008-brown-piece`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Añadir la ficha marrón al motor: cuando golpea a otra ficha (lanzada o parte de una cascada), la ficha golpeada se desplaza repetidamente una casilla cada vez, comprobando colisión en cada paso, hasta encontrar una casilla ocupada (desencadena la regla universal ahí) o alcanzar un límite máximo de pasos que evita más de una vuelta completa al tablero. Se compone sobre las reglas ya existentes sin modificarlas."

## Clarifications

### Session 2026-08-23

- Q: ¿Cómo se determina exactamente el número máximo de pasos del desplazamiento largo cuando
  no encuentra ninguna ficha en su camino? → A: se detiene en el segundo cruce del borde del
  tablero (segundo wrap-around) que realice esa ficha durante ese desplazamiento — si no se ha
  detenido antes por encontrar una casilla ocupada. El primer cruce del borde no la detiene (eso
  es simplemente wrap-around normal, spec.md 004); el segundo, sí. Esto equivale exactamente a
  "distancia hasta el primer borde + una vuelta completa (8 casillas)", que es la fórmula del
  documento de diseño del juego, pero expresado de una forma directamente implementable: contar
  cruces de borde durante el propio desplazamiento, en vez de precalcular una distancia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un impacto marrón desplaza la ficha golpeada mucho más lejos (Priority: P1)

Una ficha marrón golpea a otra ficha (ya sea porque el jugador lanzó la marrón, o porque una
marrón ya en el tablero fue empujada hasta chocar con otra en algún punto de una cadena). La
ficha golpeada empieza a desplazarse, una casilla cada vez, comprobando en cada una si está
libre. Si todas las casillas que recorre están vacías, sigue avanzando mucho más lejos de lo que
permitirían verde o naranja.

**Why this priority**: Es la razón de ser de esta ficha — un movimiento largo, no una distancia
fija como las dos ya existentes. Sin esto no hay ficha marrón.

**Independent Test**: Colocar una ficha marrón junto a otra, con varias casillas vacías por
delante en la dirección del impacto, y comprobar que la ficha golpeada termina mucho más lejos
de su posición original que lo que produciría un impacto verde o naranja en el mismo escenario.

**Acceptance Scenarios**:

1. **Given** una ficha marrón golpea a otra con varias casillas vacías por delante, **When** se
   resuelve el impacto, **Then** la ficha golpeada avanza casilla a casilla hasta la primera que
   encuentra ocupada, o hasta el límite máximo si ninguna lo está.
2. **Given** la casilla inmediatamente después de la ficha golpeada ya está ocupada, **When** el
   impacto marrón se resuelve, **Then** la ficha se comporta como si el desplazamiento se
   detuviera en el primer paso — no se salta ninguna casilla intermedia sin comprobarla (a
   diferencia de la ficha naranja).

---

### User Story 2 - Al toparse con algo, se aplica la misma regla de siempre (Priority: P2)

Cuando el desplazamiento largo provocado por una ficha marrón llega a una casilla ocupada, lo
que pasa ahí es exactamente la misma regla universal de interacción que ya rige el resto del
juego — sin ningún caso especial para marrón.

**Why this priority**: Confirma que marrón se compone sobre las reglas ya existentes en vez de
introducir un camino de resolución paralelo — es la garantía de que el resto del motor sigue
siendo la única fuente de verdad para "qué pasa cuando dos fichas se encuentran".

**Independent Test**: Reproducir un impacto marrón que llega a una casilla ocupada por una ficha
del mismo color que la que se está desplazando, y comprobar que ambas desaparecen; reproducirlo
con una de distinto color y comprobar que se desencadena un empuje normal a partir de ahí.

**Acceptance Scenarios**:

1. **Given** el desplazamiento largo de una ficha llega a una casilla ocupada por una ficha del
   mismo color, **When** eso ocurre, **Then** ambas desaparecen, igual que en cualquier otro
   punto de una cadena.
2. **Given** el desplazamiento largo llega a una casilla ocupada por una ficha de distinto
   color, **When** eso ocurre, **Then** esa ficha se empuja con la distancia que le corresponde
   a quien la golpea, pudiendo continuar la cadena con normalidad.

---

### User Story 3 - El movimiento largo nunca da más de una vuelta completa (Priority: P1)

Si el camino de la ficha golpeada está completamente despejado en toda la fila o columna (nunca
encuentra nada), el desplazamiento se detiene tras un número máximo de pasos, pensado para que
la ficha nunca dé más de una vuelta completa al tablero dentro de ese mismo lanzamiento.

**Why this priority**: Sin este límite, una ficha marrón en un tablero despejado provocaría un
bucle infinito — el juego se quedaría colgado. Es tan esencial como el propio movimiento largo,
y viene ya anticipado en el propio wrap-around (spec.md 004).

**Independent Test**: Colocar una única ficha en un tablero por lo demás completamente vacío en
esa fila/columna, provocar un impacto marrón sobre ella, y comprobar que el desplazamiento se
detiene por sí solo tras avanzar como mucho una vuelta completa al tablero, sin quedarse
calculando indefinidamente.

**Acceptance Scenarios**:

1. **Given** la fila o columna por la que se desplaza la ficha golpeada está completamente
   vacía, **When** el impacto marrón se resuelve, **Then** el desplazamiento se detiene en el
   segundo cruce del borde del tablero, y la ficha se asienta en la casilla alcanzada en ese
   momento.

---

### Edge Cases

- ¿Qué ocurre si una ficha marrón es la que se lanza desde la mano? Se lanza exactamente igual
  que verde o naranja, y está sujeta a la misma corrección ya existente de que la ficha lanzada
  nunca permanece en el tablero tras su propio impacto (spec.md 006).
- ¿Qué ocurre si el desplazamiento largo cruza el borde del tablero? Se aplica el wrap-around ya
  existente en cada paso individual, exactamente igual que a cualquier otra ficha (spec.md 004)
  — sin ninguna lógica adicional específica para marrón.
- ¿Qué ocurre si dos fichas marrón se encuentran directamente (mismo color)? Ambas desaparecen
  en el primer paso, igual que cualquier otro encuentro del mismo color — el desplazamiento
  largo nunca llega a empezar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE soportar 'marrón' como un color de ficha adicional, junto a los ya
  existentes ('verde', 'naranja').
- **FR-002**: Cuando una ficha marrón golpea a otra — ya sea la ficha lanzada desde la mano, o
  cualquier ficha que actúe como la que golpea en un eslabón de una cadena — la ficha golpeada
  DEBE desplazarse repetidamente, una casilla cada vez, comprobando si cada una está ocupada
  antes de continuar.
- **FR-003**: El desplazamiento DEBE detenerse en cuanto encuentra una casilla ocupada; a partir
  de ahí se aplica la regla universal de interacción ya existente (mismo color desaparece,
  distinto color se empuja con la distancia de quien golpea), sin ningún comportamiento especial
  adicional para marrón.
- **FR-004**: Si el desplazamiento no encuentra ninguna casilla ocupada, DEBE detenerse en
  cuanto cruce el borde del tablero por segunda vez (segundo wrap-around) durante ese mismo
  desplazamiento — el primer cruce no lo detiene, es wrap-around normal.
- **FR-005**: Cada paso individual del desplazamiento DEBE aplicar la regla de wrap-around ya
  existente exactamente igual que a cualquier otro movimiento de ficha.
- **FR-006**: Una ficha marrón DEBE poder lanzarse desde la mano con el mismo mecanismo ya usado
  para verde y naranja, incluyendo el comportamiento de missclick y la regla de que la ficha
  lanzada nunca permanece en el tablero tras su propio impacto.
- **FR-007**: Ninguna regla ya existente de verde, naranja, mismo color, o wrap-around DEBE
  cambiar de comportamiento como consecuencia de esta feature.

### Key Entities

- **Color de ficha 'marrón'**: un tercer valor posible para el color de una ficha, junto a los
  ya existentes. No introduce ningún atributo ni relación nueva más allá del color en sí.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cuando el camino de una ficha golpeada por un impacto marrón está despejado, esa
  ficha termina más lejos de su posición original que lo que permitiría un impacto verde o
  naranja en el mismo escenario, en el 100% de los casos.
- **SC-002**: El desplazamiento provocado por un impacto marrón siempre termina — nunca se queda
  calculando indefinidamente — en el 100% de los casos, incluso con la fila o columna
  completamente despejada.
- **SC-003**: En el 100% de los casos en los que el desplazamiento largo encuentra una casilla
  ocupada, el resultado coincide exactamente con el que produciría la regla universal de
  interacción ya existente en ese mismo punto, sin ninguna divergencia.
- **SC-004**: Una ficha marrón puede lanzarse desde la mano y produce los mismos comportamientos
  de missclick y no-permanencia ya validados para verde y naranja, en el 100% de los casos.

## Assumptions

- Esta feature es únicamente de motor (headless), igual que las features 001-004 — no incluye
  ningún nivel nuevo en el prototipo frontend de Fase 2 ni ningún cambio de renderer. Añadir
  marrón al prototipo visual, si se decide más adelante, sería trabajo aparte.
- Se añadirán niveles de prueba manuales que ejerciten marrón (movimiento largo hasta chocar,
  movimiento largo hasta el límite, marrón lanzado desde la mano), siguiendo el mismo patrón
  declarativo ya usado por las fixtures de motor existentes — su diseño concreto se decide en la
  fase de planificación.
