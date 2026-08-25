# Feature Specification: Fragilidad de fichas (NUEVA/TOCADA/ROTA)

**Feature Branch**: `012-piece-fragility`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Introducir un sistema de fragilidad para las fichas del tablero y de la mano: cada ficha tiene un estado — NUEVA, TOCADA o ROTA — que avanza un escalón cada vez que la ficha ES golpeada (es decir, cuando actúa como defensora en una colisión, no cuando es ella quien empuja). Esta feature sustituye la dependencia del motor en la semántica de "nada se compromete hasta que la cadena entera se resuelve" (introducida en la corrección reciente del bucle infinito de marrón, rama 012-fix-brown-cascade-loop) por un sistema donde el daño se acumula de forma visible y las fichas acaban desapareciendo por desgaste, dando al jugador un modelo causal más intuitivo. Decisiones ya cerradas: (1) la física de movimiento no cambia con el estado; (2) cada colisión avanza el estado de la defensora; (3) la comprobación de ROTA ocurre ficha a ficha, en el momento en que cada una se asienta, no al final de toda la cadena; (4) todas las eliminaciones por ROTA de un lanzamiento se aplican antes de evaluar el goal; (5) la ficha lanzada desde la mano deja de desaparecer siempre — se asienta en el tablero como cualquier otra si sobrevive; (6) los impactos entre fichas del mismo color no cambian (aniquilación instantánea, ajena al sistema de fragilidad); (7) el estado inicial de cada ficha, de tablero o de mano, es parte del diseño del nivel. Fuera de alcance: rediseñar/rebalancear los niveles prototipo ya existentes."

## Clarifications

### Session 2026-08-25

- Q: Cuando rojo golpea a una ficha, dividiéndola en dos ramas en vez de empujarla, ¿cómo se determina el estado de fragilidad de cada rama resultante? → A: la defensora avanza su estado una vez, como cualquier golpe (la división no es un caso especial), y ambas ramas heredan ese nuevo estado.
- Q: ¿Qué ocurre cuando una ficha ya ROTA, colocada así por el diseño del nivel en el tablero, es golpeada por otra ficha? → A: no llega a ocurrir — una ficha de tablero declarada ROTA se normaliza a "casilla vacía" antes de que el nivel llegue a jugarse (cribado al guardar/finalizar el nivel), así que nunca existe como ficha golpeable. El estado ROTA solo tiene efecto real en fichas de mano (FR-008).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Las fichas se desgastan y se rompen al recibir golpes (Priority: P1)

Cuando una ficha recibe un impacto (actúa como defensora en una colisión dentro de una reacción en cadena), acumula desgaste. Tras suficientes golpes, la ficha se rompe y desaparece del tablero en el instante en que le tocaría asentarse — sin alterar en nada cómo se desplazan las fichas ni cómo se resuelve el resto de la cadena. Esto es el mecanismo base: un modelo de causa-efecto donde una ficha "gastada" deja de estar disponible, en vez de que las cadenas se resuelvan como si nada hubiera pasado hasta el final.

**Why this priority**: Es el mecanismo fundamental sobre el que se apoya todo lo demás (persistencia de la ficha lanzada, diseño de niveles con estado inicial, representación visual). Sin esto no hay feature.

**Independent Test**: Puede probarse íntegramente sin interfaz: se construye una cadena de fichas con estados iniciales conocidos, se resuelve un lanzamiento, y se verifica sobre el estado final del tablero devuelto por el motor que las fichas que acumularon tres golpes han desaparecido, y las que acumularon menos permanecen con su estado avanzado correspondiente.

**Acceptance Scenarios**:

1. **Given** una ficha NUEVA en el tablero, **When** es golpeada por una ficha de distinto color en una cadena, **Then** su estado pasa a TOCADA y continúa la cadena con su comportamiento de desplazamiento normal, sin cambios.
2. **Given** una ficha TOCADA en el tablero, **When** es golpeada de nuevo, **Then** su estado pasa a ROTA y, en el momento en que le correspondería asentarse (tras desplazarse o al ser desplazada), se elimina del tablero en vez de colocarse ahí.
3. **Given** una cadena en la que varias fichas distintas alcanzan ROTA en el mismo lanzamiento, **When** se resuelve la cadena completa, **Then** cada una se elimina en el instante concreto en que le toca asentarse, de forma independiente, sin esperar a que la cadena entera termine.
4. **Given** una ficha que queda ROTA justo en la casilla del objetivo de ese lanzamiento, **When** se evalúa el resultado de la partida, **Then** esa ficha no cuenta como si hubiera cumplido el objetivo, porque su eliminación se aplica antes de evaluarlo.

---

### User Story 2 - La ficha lanzada permanece en el tablero (Priority: P2)

Al lanzar una ficha desde la mano, si sobrevive a su propio impacto (no estaba ya ROTA antes de lanzarla), deja de desvanecerse: se asienta en la casilla de su primer impacto exactamente igual que cualquier otra ficha de la cadena, conservando el estado que ya tenía. Si ya estaba ROTA antes del lanzamiento, se elimina tras impactar, igual que cualquier otra ficha rota.

**Why this priority**: Es una extensión directa y aditiva de la Historia 1 (misma regla de "se elimina si está ROTA al asentarse", aplicada también a la ficha lanzada) — no introduce ningún mecanismo nuevo, pero cambia de forma visible la economía de fichas del jugador, así que merece su propia verificación independiente.

**Independent Test**: Puede probarse íntegramente sin interfaz: se lanza una ficha NUEVA o TOCADA contra un tablero vacío o con una única ficha de distinto color, y se comprueba que la ficha lanzada aparece en el tablero final en la posición de su primer impacto (o en el destino recorrido, si no golpeó nada más), en vez de desaparecer.

**Acceptance Scenarios**:

1. **Given** una ficha NUEVA en la mano, **When** se lanza y golpea a otra ficha de distinto color, **Then** la ficha lanzada se asienta en la casilla que la ficha golpeada deja libre, conservando su estado NUEVA.
2. **Given** una ficha ya ROTA en la mano, **When** se lanza y golpea a otra ficha, **Then** la ficha lanzada se elimina tras su impacto, sin llegar a asentarse en el tablero.
3. **Given** un lanzamiento que no golpea nada (missclick), **When** se resuelve, **Then** la ficha vuelve intacta a la mano, con el mismo estado que tenía antes de lanzarla, exactamente igual que hoy.

---

### User Story 3 - El jugador puede ver el desgaste de cada ficha (Priority: P3)

El estado de fragilidad de cada ficha del tablero es visible a simple vista, sin necesidad de ninguna acción adicional — el jugador puede distinguir una ficha intacta de una que ya ha recibido uno o más golpes, y anticipar que un golpe más la haría desaparecer.

**Why this priority**: El propósito explícito de la feature es dar al jugador un modelo causal más intuitivo; un mecanismo invisible no cumple ese propósito, aunque el motor ya funcione correctamente por sí solo (Historias 1 y 2). Se prioriza después porque depende de que el mecanismo base ya esté implementado y probado.

**Independent Test**: Con el mecanismo de las Historias 1 y 2 ya funcionando, se puede verificar visualmente (inspección manual o automatizada de la interfaz) que fichas con distinto estado se muestran de forma distinguible entre sí en el tablero.

**Acceptance Scenarios**:

1. **Given** dos fichas del mismo color pero distinto estado de fragilidad en el tablero, **When** el jugador las observa, **Then** puede distinguir cuál está más desgastada sin necesidad de tocarlas ni de consultar ninguna otra pantalla.

---

### User Story 4 - Los niveles definen el estado inicial de cada ficha (Priority: P4)

Al diseñar un nivel, además del color de cada ficha (de tablero o de mano inicial), se puede especificar su estado de fragilidad de partida — permitiendo, por ejemplo, diseñar un nivel donde una ficha empiece ya TOCADA para ajustar la dificultad, o donde el jugador reciba en mano una ficha ya dañada.

**Why this priority**: Es una capacidad de autoría de contenido, útil para el diseño de niveles futuros, pero no bloquea ni el mecanismo del motor ni su integración visual — los niveles existentes siguen funcionando sin especificar nada (por defecto, NUEVA).

**Independent Test**: Se puede probar de forma aislada construyendo un nivel cuya definición declarativa incluya fichas con distintos estados iniciales (de tablero y de mano) y verificando que el motor las carga respetando ese estado, sin necesidad de jugar ningún lanzamiento.

**Acceptance Scenarios**:

1. **Given** una definición de nivel donde una ficha del tablero se declara con estado TOCADA, **When** el nivel se carga, **Then** esa ficha aparece en el tablero con estado TOCADA, no NUEVA.
2. **Given** una definición de nivel que no especifica el estado de ninguna de sus fichas, **When** el nivel se carga, **Then** todas las fichas (de tablero y de mano) aparecen con estado NUEVA por defecto.

---

### Edge Cases

- ¿Qué ocurre cuando una ficha ya está ROTA en la mano y se lanza? Se elimina tras su primer impacto, sin llegar a asentarse (cubierto explícitamente por la Historia 2, escenario 2).
- ¿Qué ocurre en un missclick (el lanzamiento no golpea nada)? El estado de la ficha lanzada no cambia; vuelve a la mano exactamente igual que hoy (Historia 2, escenario 3).
- ¿Qué ocurre si, tras eliminarse todas las fichas ROTA de un lanzamiento, el tablero queda sin ninguna ficha del color del objetivo? Se evalúa con las reglas de victoria/derrota ya existentes, sin ninguna regla adicional específica de fragilidad.
- ¿Qué ocurre cuando una ficha roja golpea a otra, produciendo una división en dos ramas en vez de un empuje? La ficha defensora avanza su estado un escalón, como cualquier otro golpe (la división no es un caso especial), y las dos ramas resultantes heredan ese mismo estado ya avanzado — no nacen en NUEVA.
- ¿Qué ocurre si una misma ficha física es golpeada más de una vez dentro de la misma cadena (no en lanzamientos distintos)? No puede ocurrir: cada celda de origen de una cadena se vacía de forma permanente en cuanto esa ficha empieza a moverse (motor ya corregido en la rama `012-fix-brown-cascade-loop`), así que ninguna ficha puede ser golpeada dos veces dentro del mismo lanzamiento — su estado avanza como máximo un escalón por lanzamiento.
- ¿Qué ocurre cuando una ficha ya ROTA, colocada así por el diseño del nivel en el tablero, es golpeada por otra ficha? Esta situación no llega a darse: una ficha de tablero declarada ROTA se normaliza a "casilla vacía" antes de que el nivel sea jugable (cribado de autoría al guardar/finalizar el nivel), así que nunca existe como ficha presente y golpeable. El estado ROTA solo es significativo para fichas de mano.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mantener, para cada ficha, un estado de fragilidad (NUEVA, TOCADA o ROTA) independiente de su color.
- **FR-002**: El sistema DEBE avanzar el estado de fragilidad de una ficha exactamente un escalón (NUEVA→TOCADA, TOCADA→ROTA) cada vez que esa ficha es golpeada por una ficha de distinto color dentro de una reacción en cadena.
- **FR-003**: El estado de fragilidad de una ficha NO DEBE alterar en ningún caso su propio comportamiento de desplazamiento (distancia de verde, distancia de naranja, paseo y tope de cruces de borde de marrón) ni el de ninguna otra ficha.
- **FR-004**: El sistema DEBE comprobar, en el instante en que cada ficha individual de una cadena se asienta (ya sea por desplazar a otra y ocupar la casilla que esta deja libre, o por alcanzar una casilla vacía), si el estado de esa ficha en ese momento es ROTA; si lo es, la ficha DEBE eliminarse del tablero en vez de asentarse.
- **FR-005**: Esta comprobación de ROTA DEBE aplicarse de forma incremental, ficha a ficha, según se resuelve cada eslabón de la cadena — no como una única pasada al final de toda la cadena.
- **FR-006**: Todas las eliminaciones por ROTA producidas por un lanzamiento DEBEN aplicarse antes de evaluar el objetivo (goal) de ese lanzamiento.
- **FR-007**: Una ficha lanzada desde la mano que sobrevive a su propio impacto (no estaba ya ROTA antes del lanzamiento) DEBE asentarse en el tablero, en la casilla de su primer impacto, exactamente igual que cualquier otra ficha de la cadena resultante, conservando el estado de fragilidad que ya tenía.
- **FR-008**: Una ficha lanzada desde la mano que ya estaba en estado ROTA antes del lanzamiento DEBE eliminarse tras su primer impacto, en vez de asentarse en el tablero.
- **FR-009**: Un lanzamiento que no golpea ninguna ficha (missclick) NO DEBE alterar el estado de fragilidad de la ficha lanzada; esta DEBE volver a la mano exactamente igual que antes del lanzamiento.
- **FR-010**: Los impactos entre fichas del mismo color DEBEN seguir aniquilando a ambas de forma instantánea, sin que el estado de fragilidad de ninguna de las dos influya en ese resultado ni se vea alterado por él.
- **FR-011**: La definición de un nivel DEBE permitir especificar un estado de fragilidad inicial para cada ficha individual, tanto las colocadas en el tablero como las incluidas en la mano inicial.
- **FR-012**: Cuando una ficha de un nivel no especifica estado de fragilidad inicial, el sistema DEBE asumir NUEVA por defecto.
- **FR-016**: Una ficha de TABLERO declarada con estado ROTA en la definición de un nivel DEBE normalizarse a "casilla vacía" antes de que el nivel sea jugable — nunca DEBE llegar a existir como una ficha presente y golpeable en el tablero. Esta normalización ocurre en el momento de guardar/finalizar el nivel (cribado de autoría), no como una regla que el motor deba aplicar durante una partida en curso. Esta restricción NO aplica a fichas de MANO, donde el estado ROTA sí es significativo (FR-008).
- **FR-013**: El estado de fragilidad de una ficha NO DEBE influir en si esa ficha satisface el color requerido por un objetivo — únicamente su presencia o ausencia en el tablero es relevante (una ficha eliminada por ROTA no puede satisfacer ningún objetivo).
- **FR-014**: El sistema DEBE dar feedback visual distinguible del estado de fragilidad de cada ficha del tablero, visible sin necesidad de ninguna acción adicional del jugador.
- **FR-015**: Cuando una ficha roja golpea a una ficha defensora, produciendo una división en dos ramas, el sistema DEBE avanzar el estado de fragilidad de la defensora exactamente un escalón (la división cuenta como un golpe más, sin caso especial), y ambas ramas resultantes DEBEN heredar ese nuevo estado.

### Key Entities

- **Ficha (Piece)**: entidad ya existente en el motor, definida hasta ahora solo por su color. Esta feature le añade un estado de fragilidad (NUEVA/TOCADA/ROTA) que evoluciona durante la partida según los impactos que recibe, independiente de su color y de su comportamiento de movimiento.
- **Definición de nivel (pieces / hand)**: las entradas declarativas que describen las fichas iniciales de un nivel (tanto en el tablero como en la mano) pasan a incluir, además del color, un estado de fragilidad inicial opcional por ficha (NUEVA por defecto si no se especifica). El rango de estados iniciales con efecto real difiere entre ambas: una ficha de mano puede empezar en cualquiera de los 3 estados; una ficha de tablero solo tiene efecto real en NUEVA o TOCADA — ROTA se normaliza a "casilla vacía" antes de que el nivel sea jugable (FR-016).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un jugador puede distinguir, con solo mirar el tablero y sin realizar ninguna acción, si una ficha ya ha recibido al menos un golpe, para el 100% de las fichas visibles en pantalla.
- **SC-002**: El 0% de las evaluaciones de objetivo cuentan erróneamente una ficha que se ha roto (ROTA) durante ese mismo lanzamiento como si hubiera cumplido el objetivo.
- **SC-003**: El 100% de los lanzamientos en los que la ficha lanzada sobrevive a su propio impacto dejan esa ficha presente e interactuable en el tablero al finalizar el lanzamiento, verificable mediante el estado final devuelto por el motor.
- **SC-004**: Un autor de niveles puede fijar el estado inicial de cualquier ficha individual, para el 100% de las fichas de una definición de nivel — entre los 3 estados posibles si es una ficha de mano, o entre NUEVA/TOCADA si es una ficha de tablero (ROTA se normaliza a casilla vacía, FR-016).

## Assumptions

- Un missclick (lanzamiento que no golpea nada) no cambia el estado de fragilidad de la ficha lanzada — se comporta exactamente igual que hoy.
- El estado de fragilidad de una ficha no afecta a si cuenta como el color requerido por un objetivo; solo su presencia o ausencia en el tablero importa.
- Rebalancear o rediseñar los niveles prototipo ya existentes para adaptarlos a este nuevo sistema queda fuera del alcance de esta feature — se define el mecanismo, no se migra el contenido existente.
- Los impactos entre fichas del mismo color no participan del sistema de fragilidad en ningún sentido (ni la avanzan ni se ven afectados por ella): siguen siendo una aniquilación mutua instantánea, decisión explícita y ya cerrada.
- Dentro de un mismo lanzamiento, ninguna ficha física puede ser golpeada más de una vez (se apoya en la garantía ya existente de que ninguna celda de origen se revisita dentro de la misma cadena, corregida en `012-fix-brown-cascade-loop`), así que el estado de una ficha avanza como máximo un escalón por lanzamiento.
