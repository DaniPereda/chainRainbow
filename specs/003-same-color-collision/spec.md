# Feature Specification: Colisión entre Fichas del Mismo Color (Aniquilación Mutua)

**Feature Branch**: `003-same-color-collision`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Como jugador, cuando una ficha que se mueve o aparece en una casilla
ya ocupada por otra ficha del MISMO color, ambas fichas desaparecen inmediatamente y ninguna
ejecuta su efecto de impacto (ni empuje, ni salto, ni ningún otro comportamiento) — la regla
universal de interacción normal (empuje según la ficha que golpea, ya construida para verde y
naranja) solo se aplica cuando los colores son distintos. Esta regla de 'mismo color' tiene
prioridad sobre el resto: se comprueba primero, en cada punto donde una ficha entra en una casilla
ocupada (tanto en el primer impacto de un lanzamiento como en cualquier eslabón posterior de una
cadena/cascada), no solo en el lanzamiento inicial. Reutiliza el motor ya construido (viaje, cola
de eventos, objetivo, empuje por color) sin modificar su comportamiento para colisiones de colores
distintos. La verificación de esta historia es headless, igual que las anteriores."

## Clarifications

### Session 2026-08-23

- Q: `testLevelGreen01` lanza una ficha verde contra una ficha verde ya colocada; con la nueva
  regla, ese lanzamiento pasaría de empujar a aniquilarse, dejando de demostrar el empuje de verde
  (propósito original de la feature 001). → A: Cambiar la ficha ya colocada en `testLevelGreen01`
  de verde a naranja. El nivel sigue demostrando el empuje de una ficha verde lanzada, ahora
  contra un color distinto — se preserva el propósito original de la feature 001. Un nivel nuevo
  y separado demuestra la
  aniquilación.
  - **Nota de corrección (detectada en `/speckit-plan`)**: la distancia de empuje la determina el
    color de quien golpea, no de quien la recibe (feature 002, corregido el 2026-08-23) — así que
    cambiar la ficha ya colocada a naranja NO cambia la distancia (la ficha verde lanzada sigue
    empujando 1 casilla, sea cual sea el color de a quién golpea). La casilla objetivo no necesita
    moverse; lo único que cambia es el **color** del objetivo (de verde a naranja), ya que ahora es
    una ficha naranja la que termina en esa casilla. Ver FR-006.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dos fichas del mismo color se aniquilan al coincidir (Priority: P1)

Un jugador abre un nivel de prueba con una ficha ya colocada en el tablero y una ficha del mismo
color disponible en la mano. El jugador lanza su ficha en una dirección que colisiona con la ficha
ya colocada. Como ambas fichas comparten color, ninguna ejecuta su efecto de impacto habitual (ni
empuje, ni salto): ambas desaparecen inmediatamente del tablero. La cadena de eventos termina ahí
— no hay ninguna reacción posterior que provenga de ninguna de las dos fichas. Cuando el tablero
alcanza el estado estable, el juego comprueba el objetivo del nivel sobre el tablero resultante
(sin ninguna de las dos fichas) y expone si el nivel se ha ganado, perdido, o queda sin determinar,
con las mismas reglas ya establecidas.

**Why this priority**: Es el siguiente incremento del roadmap y el primero que introduce una
excepción explícita a la regla de empuje ya construida — valida que el motor puede priorizar
correctamente "mismo color" sobre el comportamiento específico de cada ficha, en cualquier punto
de una cadena, no solo en el lanzamiento inicial. Sin esta historia, dos fichas del mismo color en
el tablero se comportan de forma incorrecta según el diseño del juego.

**Independent Test**: Se puede probar por completo mediante pruebas automatizadas que cargan un
nivel de prueba dedicado (una ficha ya colocada y una ficha del mismo color en mano), lanzan esa
ficha, y verifican que ambas desaparecen, que no se ejecuta ningún efecto de empuje/salto, y que
el objetivo se evalúa correctamente sobre el tablero resultante — sin necesidad de interfaz
visual, y sin alterar el comportamiento ya validado de las colisiones entre colores distintos
(verde y naranja siguen empujando/saltando exactamente igual que antes).

**Acceptance Scenarios**:

1. **Given** un nivel con una ficha de color X ya colocada y una ficha del mismo color X en la
   mano, **When** el jugador lanza su ficha y colisiona con la ya colocada, **Then** ambas fichas
   desaparecen inmediatamente, ninguna ejecuta su efecto de impacto, y la cadena alcanza el estado
   estable sin ninguna ficha en esas dos casillas.
2. **Given** una cadena en curso donde una ficha de color X (no necesariamente la lanzada
   originalmente) está siendo desplazada por el efecto de otra ficha, **When** esa ficha X aterriza
   sobre una casilla ocupada por otra ficha también de color X, **Then** ambas fichas de ese
   encuentro desaparecen y la cadena no continúa a partir de ninguna de las dos.
3. **Given** una cadena en curso donde una ficha aterriza sobre una casilla ocupada por una ficha
   de un color DISTINTO, **When** ocurre esa colisión, **Then** se aplica el comportamiento de
   empuje/salto ya existente para esa combinación de colores, sin ningún cambio respecto al
   comportamiento ya validado en las features 001 y 002.
4. **Given** una cadena de eventos que ha terminado de resolverse tras una aniquilación de mismo
   color (estado estable), **When** se comprueba el objetivo del nivel, **Then** el resultado
   (ganado, perdido, o sin determinar) se calcula sobre el tablero real resultante — que no
   contiene ninguna de las dos fichas aniquiladas — siguiendo las mismas reglas ya establecidas.
5. **Given** el nivel de prueba ya existente de la ficha verde (`testLevelGreen01`), tras
   redefinir la ficha ya colocada en él como naranja (ver Clarifications), **When** se lanza la
   ficha verde de su mano, **Then** el resultado sigue siendo el mismo que antes de esta historia
   (empuje, no aniquilación), y ese nivel más su suite de tests asociada continúan pasando sin
   ningún otro cambio de comportamiento.

### Edge Cases

- ¿Se aplica la comprobación de mismo color también en el primerísimo impacto de un lanzamiento
  (no solo en eslabones posteriores de una cascada)? Sí — la ficha lanzada "entra" en la casilla
  de la ficha ya colocada exactamente igual que cualquier ficha desplazada dentro de una cascada;
  no hay ningún caso especial para el primer impacto.
- ¿Qué ocurre con un missclick? No aplica — no hay ninguna colisión, por lo que la regla de mismo
  color no se evalúa nunca en ese camino.
- ¿Qué ocurre si, tras una aniquilación, la casilla en la que estaban ambas fichas era la casilla
  objetivo del nivel? El objetivo no se cumple ahí — ninguna ficha ocupa esa casilla tras la
  aniquilación, así que el resultado depende de si alguna OTRA ficha del tablero cumple el
  objetivo, exactamente igual que cualquier otro estado final del tablero.
- La interacción de esta regla con fichas que se ramifican (rojo, no implementada todavía) queda
  fuera de alcance — se abordará cuando se especifique esa historia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST comprobar, en cada punto donde una ficha entra en una casilla ya
  ocupada por otra (tanto en el impacto inicial de un lanzamiento como en cualquier eslabón
  posterior de una cadena), si ambas fichas comparten el mismo color, antes de aplicar cualquier
  comportamiento de impacto específico de color (empuje, salto, o cualquier otro futuro).
- **FR-002**: Cuando dos fichas del mismo color coinciden según FR-001, el sistema MUST eliminar
  ambas fichas del tablero inmediatamente y MUST NOT ejecutar el efecto de impacto de ninguna de
  las dos.
- **FR-003**: Cuando dos fichas de colores distintos coinciden, el sistema MUST seguir aplicando
  el comportamiento de empuje/salto específico de color ya existente, sin ningún cambio respecto
  al comportamiento ya validado en las features 001 y 002.
- **FR-004**: La cadena de eventos MUST alcanzar el estado estable inmediatamente después de una
  aniquilación de mismo color, sin que se genere ninguna interacción posterior originada por
  cualquiera de las dos fichas aniquiladas.
- **FR-005**: El sistema MUST evaluar el objetivo del nivel (ganado, perdido, o sin determinar)
  tras una aniquilación de mismo color usando exactamente las mismas reglas ya establecidas
  (basadas en el tablero final y la mano restante).
- **FR-006**: El nivel de prueba `testLevelGreen01` (feature 001) MUST redefinirse para que la
  ficha ya colocada en él sea naranja en vez de verde y el color del objetivo pase de verde a
  naranja (la casilla objetivo en sí no cambia: la distancia de empuje la determina la ficha
  lanzada, no la golpeada), de modo que ese nivel siga demostrando el empuje de la ficha verde en
  vez de pasar a demostrar una aniquilación no prevista en su historia original. Su suite de
  tests asociada MUST seguir pasando con el mismo resultado que antes de esta historia.

### Key Entities

- No se introducen entidades nuevas — esta historia añade una regla de prioridad sobre la
  interacción ya modelada entre `Piece`s en una casilla compartida; no cambia el modelo de datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las colisiones entre fichas del mismo color (impacto inicial o cualquier
  eslabón de una cascada) resultan en la desaparición de ambas fichas implicadas y ningún efecto
  de empuje/salto para ninguna de las dos.
- **SC-002**: El 100% de las colisiones entre fichas de colores distintos siguen produciendo
  exactamente el mismo resultado que antes de esta historia (sin regresión en verde/naranja).
- **SC-003**: Repetir el mismo escenario de aniquilación con la misma dirección de lanzamiento
  produce el mismo resultado el 100% de las veces (determinismo verificable).

## Assumptions

- La comprobación de "mismo color" tiene prioridad estricta: se evalúa siempre antes que cualquier
  comportamiento de empuje/salto específico de color, en cualquier punto de la cadena — no solo en
  el impacto inicial del lanzamiento.
- El nivel de prueba dedicado a esta historia es independiente de `testLevelGreen01` y
  `testLevelOrange01` (no los reutiliza), y se diseña para que el objetivo no se cumpla en el
  estado inicial, siguiendo el mismo criterio ya usado en las historias anteriores.
- Esta historia cubre un único lanzamiento por nivel de prueba, igual que las anteriores; el
  resultado "sin determinar" tras un missclick se comporta exactamente igual que ya se estableció
  en la feature 001 (no aplica aquí de forma especial).
