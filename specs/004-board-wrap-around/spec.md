# Feature Specification: Wrap-around de Fichas en el Tablero

**Feature Branch**: `004-board-wrap-around`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Como jugador, cuando una ficha que ya está colocada en el tablero se
desplaza (por un empuje o salto de otra ficha) y su casilla de destino calculada cae fuera de los
límites del tablero, esa ficha NO desaparece — reaparece por el extremo contrario de la misma fila
o columna (wrap-around), continuando en la misma dirección del movimiento. Esto reemplaza el
comportamiento actual (la ficha se elimina al salirse del tablero), que era un placeholder
documentado como 'no alcanzable con los fixtures actuales' — con esta historia sí se ejercita y
debe dejar de ser un placeholder. Importante: el wrap-around se aplica ÚNICAMENTE a fichas que ya
están en el tablero y se están desplazando (el empuje/salto ya construido para verde y naranja, en
el impacto inicial o en cualquier eslabón de cascada) — NO se aplica al viaje inicial de una ficha
lanzada desde fuera del tablero, que sigue funcionando exactamente igual que antes (si no encuentra
ninguna ficha, sigue siendo un missclick, la ficha vuelve a la mano). Tras reaparecer en el extremo
opuesto, se aplica la misma regla universal de interacción ya existente (prioridad de mismo color,
luego empuje) sobre lo que haya en esa casilla, igual que en cualquier otro punto de la cadena. Con
las distancias de empuje actuales (verde=1, naranja=2) en un tablero 8x8, una ficha nunca puede
necesitar más de una vuelta en un único empuje, así que esta historia NO necesita implementar
ninguna lógica de límite para evitar bucles infinitos — eso se deja para la historia de la ficha
marrón (movimiento largo repetido), que es la que realmente puede necesitarlo, según el documento
de diseño del juego. Reutiliza el motor ya construido sin modificar su comportamiento para
colisiones que no cruzan el borde del tablero. La verificación de esta historia es headless, igual
que las anteriores."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una ficha empujada más allá del borde reaparece por el lado opuesto (Priority: P1)

Un jugador abre un nivel de prueba con una ficha ya colocada muy cerca de un borde del tablero, de
forma que el empuje o salto que le llega la desplazaría más allá de ese borde. En vez de
desaparecer, la ficha reaparece en la casilla equivalente del extremo opuesto de la misma fila o
columna, siguiendo la misma dirección del movimiento. A partir de ahí, el juego trata esa casilla
exactamente igual que cualquier otra: si está libre, la ficha se asienta y la cadena termina ahí; si
hay otra ficha del mismo color, ambas se aniquilan; si hay una ficha de color distinto, se
desencadena el empuje correspondiente. El lanzamiento inicial de una ficha desde fuera del tablero
no se ve afectado por esta historia en ningún caso.

**Why this priority**: Es el siguiente incremento del roadmap y un prerrequisito real para la
ficha marrón (movimiento largo repetido), cuyo tope de distancia se define en el documento de
diseño del juego en términos de wrap-around. Además, sustituye un comportamiento marcado
explícitamente como placeholder ("la ficha desaparece al salir del tablero") por el comportamiento
real ya documentado desde el principio del proyecto.

**Independent Test**: Se puede probar por completo mediante pruebas automatizadas que cargan un
nivel de prueba con una ficha colocada junto a un borde, lanzan una ficha que la empuja/salta más
allá de ese borde, y verifican que reaparece en el extremo opuesto de la misma fila o columna en
vez de desaparecer — tanto cuando esa casilla de reaparición está libre, como cuando contiene una
ficha de color distinto (empuje normal) o del mismo color (aniquilación) — sin necesidad de
interfaz visual y sin alterar el comportamiento ya validado para colisiones que no cruzan ningún
borde (verde, naranja, mismo color).

**Acceptance Scenarios**:

1. **Given** una ficha colocada junto a un borde del tablero tal que el empuje/salto que recibe la
   desplazaría fuera de los límites, **When** se resuelve ese empuje/salto, **Then** la ficha
   reaparece en la casilla equivalente del extremo opuesto de la misma fila o columna, siguiendo la
   misma dirección, en vez de desaparecer.
2. **Given** la casilla de reaparición (tras el wrap-around) está libre, **When** la ficha reaparece
   ahí, **Then** se asienta en esa casilla y la cadena de eventos alcanza el estado estable.
3. **Given** la casilla de reaparición contiene una ficha de un color distinto, **When** la ficha
   reaparece ahí, **Then** se desencadena el empuje ya existente para esa combinación de colores,
   exactamente igual que en cualquier otro punto de la cadena.
4. **Given** la casilla de reaparición contiene una ficha del mismo color, **When** la ficha
   reaparece ahí, **Then** ambas fichas se aniquilan inmediatamente, siguiendo la regla ya
   existente de mismo color.
5. **Given** una ficha se lanza desde fuera del tablero y su recorrido inicial no encuentra ninguna
   ficha antes de llegar al extremo opuesto, **When** se resuelve ese lanzamiento, **Then** sigue
   considerándose un missclick (la ficha vuelve a la mano) — el wrap-around no se aplica en ningún
   caso al viaje inicial de una ficha lanzada.
6. **Given** los niveles de prueba ya existentes de verde, naranja, y mismo color, **When** se
   implementa esta historia, **Then** todos siguen produciendo exactamente el mismo resultado que
   antes, sin ningún cambio de comportamiento observable (ninguno de ellos cruza un borde del
   tablero en su configuración actual).

### Edge Cases

- ¿Puede un único empuje necesitar más de una vuelta alrededor del tablero? No con las distancias
  de empuje actuales (verde=1, naranja=2) en un tablero 8×8 — como máximo se cruza un borde una
  vez por empuje. Esta historia NO implementa ninguna lógica de límite/prevención de bucles; se
  deja para la historia de la ficha marrón (movimiento largo repetido), que sí puede necesitarla.
- ¿Se ve afectada la casilla donde se asienta la ficha lanzada (la que queda vacía tras el
  desplazamiento)? No — esa casilla siempre es una posición válida ya dentro del tablero; el
  wrap-around solo afecta al cálculo del destino de la ficha que se desplaza.
- ¿Puede el wrap-around necesitar ajustar dos coordenadas a la vez (fila y columna)? No — todo
  movimiento en este motor es en línea recta sobre un único eje (fila o columna, nunca ambos a la
  vez), así que como mucho una de las dos coordenadas necesita ajustarse.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST, al calcular el destino de una ficha ya colocada que se desplaza
  (por el impacto inicial o por cualquier eslabón de una cascada) y ese destino cae fuera de los
  límites del tablero, hacer que la ficha reaparezca en la casilla equivalente del extremo opuesto
  de la misma fila o columna, en vez de eliminarla.
- **FR-002**: El sistema MUST evaluar lo que haya en la casilla de reaparición con la misma regla
  universal de interacción ya existente (prioridad de mismo color, después empuje) — sin ningún
  comportamiento especial por el hecho de haber cruzado el borde.
- **FR-003**: El sistema MUST NOT aplicar wrap-around al viaje inicial de una ficha lanzada desde
  fuera del tablero; ese viaje MUST seguir considerándose un missclick cuando no encuentra ninguna
  ficha antes de llegar al extremo opuesto, exactamente igual que antes de esta historia.
- **FR-004**: El comportamiento ya existente para verde, naranja, y la regla de mismo color MUST
  permanecer sin cambios en todos los niveles de prueba ya existentes (ninguno cruza un borde del
  tablero en su configuración actual).
- **FR-005**: Esta historia MUST NOT implementar ninguna lógica de límite máximo de desplazamiento
  ni de prevención de bucles infinitos — queda fuera de alcance, diferida a la historia de la
  ficha marrón.

### Key Entities

- No se introducen entidades nuevas — esta historia cambia cómo se calcula el destino de una ficha
  que se desplaza cuando cruza un borde; no cambia el modelo de datos del tablero ni de las fichas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los empujes/saltos cuyo destino calculado cae fuera del tablero hacen que
  la ficha reaparezca en el extremo opuesto de la misma fila o columna, en vez de desaparecer.
- **SC-002**: El 100% de las interacciones en una casilla de reaparición (libre, mismo color, o
  color distinto) siguen exactamente las mismas reglas ya establecidas para esos tres casos en
  cualquier otro punto del tablero.
- **SC-003**: El 100% de los niveles de prueba ya existentes (verde, naranja, mismo color) siguen
  produciendo el mismo resultado que antes de esta historia.

## Assumptions

- Con las distancias de empuje actuales (verde=1, naranja=2) en un tablero 8×8, un único empuje
  nunca puede cruzar el borde más de una vez — el wrap-around se resuelve siempre con un único
  ajuste de coordenada, sin necesitar ninguna lógica adicional de límite en esta historia.
- El wrap-around es puramente un cambio en cómo se calcula una coordenada de destino; reutiliza
  sin modificar la regla universal de interacción ya construida (mismo color, luego empuje) para
  decidir qué pasa en la casilla de reaparición.
- Ningún nivel de prueba ya existente ejercita esta ruta (el comportamiento anterior — la ficha
  desaparece al salir del tablero — está documentado como "no alcanzable con los fixtures
  actuales"), así que esta historia necesita un nivel de prueba nuevo y dedicado, independiente de
  los ya existentes.
- El viaje inicial de una ficha lanzada desde fuera del tablero (missclick si no encuentra
  ninguna ficha) queda completamente fuera de alcance de esta historia, tal como especifica el
  documento de diseño del juego.
