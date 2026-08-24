# Feature Specification: Ficha Roja (Ramificación)

**Feature Branch**: `009-red-piece`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Añadir la ficha roja al motor: al golpear a otra ficha de distinto color, esa ficha se divide en dos, cada una viajando en una dirección perpendicular a la del impacto. Cada rama se resuelve con la regla universal ya existente. Las dos ramas se resuelven de forma secuencial, no simultánea -- limitación deliberada y documentada. Mismo color sigue aniquilando sin ramificación."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un impacto rojo divide la ficha golpeada en dos (Priority: P1)

Una ficha roja golpea a otra ficha de distinto color. En vez de empujarla en línea recta (como
haría verde, naranja o marrón), esa ficha se divide en dos fichas del mismo color que la
original — una viajando en cada una de las dos direcciones perpendiculares a la dirección en la
que llegó el impacto rojo.

**Why this priority**: Es la razón de ser de esta ficha — la primera vez que un impacto produce
más de una ficha en movimiento. Sin esto no hay ficha roja.

**Independent Test**: Colocar una ficha roja junto a otra de distinto color, con las dos
casillas perpendiculares despejadas, y comprobar que tras el impacto aparecen dos fichas del
color original — una a cada lado — y que la casilla del impacto queda vacía.

**Acceptance Scenarios**:

1. **Given** una ficha roja golpea a una ficha de distinto color llegando desde el norte o el
   sur, **When** se resuelve el impacto, **Then** la ficha golpeada se divide en dos: una viaja
   hacia el este y otra hacia el oeste.
2. **Given** una ficha roja golpea a una ficha de distinto color llegando desde el este o el
   oeste, **When** se resuelve el impacto, **Then** la ficha golpeada se divide en dos: una viaja
   hacia el norte y otra hacia el sur.

---

### User Story 2 - Cada rama se resuelve con la regla universal ya existente (Priority: P2)

Cada una de las dos fichas resultantes de la división se comporta exactamente como cualquier
otra ficha que se desplaza: si su camino está despejado, se asienta; si encuentra otra ficha, se
desencadena la misma regla universal de interacción ya existente (mismo color desaparece,
distinto color se empuja), pudiendo esa rama seguir encadenándose por su cuenta.

**Why this priority**: Confirma que rojo se compone sobre las reglas ya existentes en vez de
introducir un camino de resolución paralelo — ninguna rama tiene un comportamiento especial una
vez en movimiento.

**Independent Test**: Colocar una tercera ficha en el camino de una de las dos ramas y comprobar
que esa rama la empuja o se aniquila con ella según corresponda, exactamente igual que si esa
ficha en movimiento no viniera de una división — sin afectar a la otra rama.

**Acceptance Scenarios**:

1. **Given** una de las dos ramas de la división encuentra una ficha de distinto color en su
   camino, **When** eso ocurre, **Then** esa ficha se empuja con la distancia de quien la golpea
   en ese punto, pudiendo la cadena continuar desde ahí.
2. **Given** una de las dos ramas de la división encuentra una ficha del mismo color que ella,
   **When** eso ocurre, **Then** ambas desaparecen — igual que en cualquier otro punto de una
   cadena.

---

### User Story 3 - Las dos ramas se resuelven en un orden fijo, una detrás de otra (Priority: P2)

Las dos ramas de una división no se resuelven "a la vez" — se resuelve una por completo
(incluyendo cualquier cadena propia que desencadene) antes de que empiece a resolverse la otra,
siempre en el mismo orden para una misma dirección de impacto.

**Why this priority**: Es la garantía de determinismo (toda la partida debe producir siempre el
mismo resultado) y la que delimita el alcance de esta primera versión de rojo — sin ella, no
habría un orden definido y el resultado podría depender de detalles de implementación en vez de
una regla explícita.

**Independent Test**: Reproducir el mismo impacto rojo varias veces y comprobar que el orden en
que se resuelven las dos ramas (y por tanto el resultado final, si ambas ramas interactúan de
algún modo con el resto del tablero) es siempre idéntico.

**Acceptance Scenarios**:

1. **Given** un impacto rojo que llega desde el norte o el sur, **When** se resuelve, **Then** la
   rama hacia el este se resuelve por completo antes de que empiece a resolverse la rama hacia
   el oeste.
2. **Given** un impacto rojo que llega desde el este o el oeste, **When** se resuelve, **Then**
   la rama hacia el norte se resuelve por completo antes de que empiece a resolverse la rama
   hacia el sur.

---

### Edge Cases

- ¿Qué ocurre si una ficha roja golpea a una ficha del mismo color? Se aplica la aniquilación ya
  existente — la división nunca llega a producirse (la regla de mismo color tiene prioridad,
  spec.md 003).
- ¿Qué ocurre si el desplazamiento de una rama cruza el borde del tablero? Se aplica el
  wrap-around ya existente, igual que a cualquier otra ficha (spec.md 004).
- ¿Qué ocurre si una ficha roja es la que se lanza desde la mano? Se lanza igual que las demás
  piezas, sujeta a la corrección ya existente de que la ficha lanzada nunca permanece en el
  tablero tras su propio impacto (spec.md 006).
- ¿Qué ocurre si, de haberse movido las dos ramas "a la vez", sus caminos se hubieran cruzado en
  algún punto? Con la resolución secuencial de esta feature, ese cruce no se detecta — es una
  limitación deliberada y documentada (ver Assumptions), no un comportamiento accidental.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE soportar 'rojo' como un color de ficha adicional, junto a los ya
  existentes.
- **FR-002**: Cuando una ficha roja golpea a una ficha de distinto color, esa ficha golpeada
  DEBE dividirse en dos fichas del mismo color que la original, en vez de empujarse en línea
  recta.
- **FR-003**: Si el impacto rojo llega desde el norte o el sur, las dos direcciones generadas
  por la división DEBEN ser este y oeste; si llega desde el este o el oeste, las dos direcciones
  generadas DEBEN ser norte y sur.
- **FR-004**: Cada una de las dos ramas resultantes DEBE resolverse con la misma regla universal
  de interacción ya existente (mismo color desaparece, distinto color se empuja con la distancia
  de quien golpea en ese punto), pudiendo desencadenar su propia cascada.
- **FR-005**: Las dos ramas DEBEN resolverse de forma secuencial: la primera (este antes que
  oeste; norte antes que sur, según FR-003) se resuelve por completo antes de que empiece a
  resolverse la segunda.
- **FR-006**: Cuando una ficha roja golpea a una ficha del mismo color, DEBE aplicarse la regla
  de aniquilación ya existente sin que se produzca ninguna división.
- **FR-007**: Una ficha roja DEBE poder lanzarse desde la mano con el mismo mecanismo ya usado
  para las demás piezas, incluyendo missclick y la regla de que la ficha lanzada nunca permanece
  en el tablero.
- **FR-008**: Ninguna regla ya existente (verde, naranja, marrón, mismo color, wrap-around) DEBE
  cambiar de comportamiento como consecuencia de esta feature.

### Key Entities

- **Color de ficha 'rojo'**: un color adicional de ficha, junto a los ya existentes.
- **División**: el resultado de un impacto rojo contra una ficha de distinto color — dos fichas
  nuevas del color de la ficha golpeada, cada una en movimiento por su propia dirección
  perpendicular, resueltas de forma secuencial (FR-005).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras un impacto rojo contra una ficha de distinto color con los dos caminos
  perpendiculares despejados, aparecen dos fichas del color original — una en cada dirección
  perpendicular esperada — y la casilla del impacto queda vacía, en el 100% de los casos.
- **SC-002**: El resultado de cada rama coincide exactamente con el que produciría la regla
  universal de interacción ya existente para esa misma situación de forma aislada, en el 100%
  de los casos.
- **SC-003**: El orden de resolución de las dos ramas es siempre el mismo para una misma
  dirección de impacto, en el 100% de las repeticiones.
- **SC-004**: Una ficha roja lanzada desde la mano produce los mismos comportamientos de
  missclick y no-permanencia ya validados para las demás piezas, en el 100% de los casos.

## Assumptions

- Cada rama de la división se desplaza inicialmente 1 casilla (como un único MOVE_STEP, igual
  que verde) antes de comprobar si su destino está ocupado — el documento de diseño describe la
  ramificación como la generación de "dos MOVE_STEP", sin mencionar ninguna distancia mayor.
- Las dos fichas resultantes de la división conservan el mismo color que la ficha original
  golpeada.
- La ficha que provoca el impacto (roja, ya sea lanzada desde la mano o ya en el tablero) se
  asienta en la casilla que la división deja vacía, salvo que sea la ficha originalmente
  lanzada desde la mano (spec.md 006) — mismo patrón que ya rige cualquier otro impacto que no
  termina en aniquilación.
- Esta feature resuelve las dos ramas de forma estrictamente secuencial y determinista (FR-005).
  Un cruce de caminos entre las dos ramas, si se hubieran movido "a la vez", no se detecta —
  simplificación deliberada. Una resolución intercalada paso a paso que sí detectara esos cruces
  queda para una feature futura y separada, solo si se demuestra necesaria una vez esta versión
  esté en uso.
- Esta feature es únicamente de motor (headless), igual que las features 001-004 y 008 — no
  incluye ningún nivel nuevo en el prototipo frontend de Fase 2.
