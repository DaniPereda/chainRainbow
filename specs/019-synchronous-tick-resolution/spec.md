# Feature Specification: Resolución Síncrona de Trayectorias Simultáneas (Tick a Tick)

**Feature Branch**: `019-synchronous-tick-resolution`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Sustituir la resolución estrictamente secuencial de trayectorias simultáneas en el motor (src/engine/) por un cálculo síncrono, avance a avance ('tick a tick'), lo bastante genérico como para soportar N trayectorias activas a la vez -- no solo el caso concreto de hoy (las dos ramas de una división de rojo). Contexto: 009-red-piece documentó explícitamente (FR-005, Assumptions) que las dos ramas de una división de rojo se resuelven de forma estrictamente secuencial como una simplificación deliberada, dejando para el futuro 'una resolución genuinamente simultánea/entrelazada... solo si se demuestra necesaria en la práctica'. Esta feature retoma ese ítem. 016-immediate-chain-placement y 017-striker-visibility-gap corrigieron la visibilidad DENTRO de una sola trayectoria secuencial; esta introduce la posibilidad de que dos o más trayectorias avancen a la vez y puedan verse y colisionar entre sí. Alcance: motor de concurrencia genérico (no acotado a rojo), pensando en una futura ficha que pueda generar más de dos ramas concurrentes (fuera de alcance aquí). Regla de colisión nueva, ya decidida: cuando dos trayectorias EN MOVIMIENTO coinciden o se cruzan en la misma casilla en el mismo tick, cada una se trata simultáneamente como golpeadora Y como defensora de la otra -- simétrica, distinta de la regla asimétrica ya existente (trayectoria en movimiento vs. ficha ya asentada, que NO cambia). La resolución exacta de qué significa esa regla simétrica en términos de fragilidad/desplazamiento se deriva en planificación, verificada contra el motor real. Requisito de no-regresión crítico: el 100% de los casos que nunca producen dos trayectorias genuinamente simultáneas (toda cascada de un solo lanzamiento sin rojo, y las dos ramas de rojo cuando sus caminos reales nunca coinciden) deben seguir produciendo exactamente el mismo resultado que hoy. Fuera de alcance: fichas nuevas, el generador de niveles, la regla asimétrica ya existente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dos trayectorias que de verdad se cruzan colisionan entre sí, en vez de que el cruce pase desapercibido (Priority: P1)

Quien juega (o construye/revisa un nivel) ya no puede encontrarse con dos ramas de una división de rojo -- o, en el futuro, dos trayectorias concurrentes de cualquier otro origen -- cuyos caminos reales se cruzan o coinciden en la misma casilla sin que eso tenga ningún efecto. Cuando eso ocurre, ambas trayectorias colisionan entre sí en ese instante, cada una actuando a la vez como golpeadora y como defensora de la otra.

**Why this priority**: Es la razón de ser de esta feature -- sin esto, el motor sigue sin poder representar en absoluto un cruce real entre dos trayectorias activas, exactamente la limitación que 009-red-piece dejó documentada y aplazada.

**Independent Test**: Construir una división de rojo cuyas dos ramas, de moverse genuinamente a la vez, se cruzarían en una casilla concreta (por ejemplo, mediante wrap-around: una rama avanza con normalidad mientras la otra queda temporalmente retrasada por un obstáculo, permitiendo que la primera complete una vuelta al tablero y alcance a la segunda) y comprobar que, con el motor ya cambiado, ambas colisionan entre sí en esa casilla -- en vez de que una atraviese a la otra como si no existiera (el comportamiento de hoy, ya probado y documentado como limitación deliberada en 009-red-piece).

**Acceptance Scenarios**:

1. **Given** dos trayectorias actualmente en movimiento (ninguna de las dos ya asentada) cuyos caminos reales, avanzados tick a tick, llegan a coincidir en la misma casilla en el mismo tick, **When** el motor resuelve esa coincidencia, **Then** ambas trayectorias colisionan entre sí -- cada una tratada simultáneamente como golpeadora y como defensora de la otra -- en vez de que una continúe como si la otra no estuviera ahí.
2. **Given** una ficha en movimiento cuyo camino la lleva a una casilla ocupada por una ficha REAL ya asentada en el tablero (no otra trayectoria en movimiento), **When** el motor resuelve ese impacto, **Then** se aplica exactamente la regla asimétrica ya existente (golpeadora/defensora, FR-002 de 013 y toda la lógica de `applyImpact` ya vigente) -- sin ningún cambio de comportamiento respecto a hoy.
3. **Given** dos trayectorias del mismo color que colisionan entre sí en movimiento, **When** se resuelve esa colisión, **Then** ambas se aniquilan mutuamente -- mismo resultado que ya produce hoy la regla de mismo color, ahora también alcanzable entre dos trayectorias en movimiento, no solo entre una en movimiento y una ya asentada.

---

### User Story 2 - El mecanismo soporta N trayectorias concurrentes, no solo dos (Priority: P2)

Quien mantiene el motor puede confiar en que el mecanismo de resolución síncrona no asume que solo puede haber exactamente dos trayectorias activas a la vez (el caso de hoy, las dos ramas de rojo) -- está diseñado para avanzar cualquier número de trayectorias activas, tick a tick, cada una capaz de colisionar con cualquier otra que esté activa en ese mismo tick.

**Why this priority**: El propio roadmap del proyecto anticipa una futura ficha (fuera de alcance de esta feature) que podría generar más de dos ramas o trayectorias concurrentes -- construir el mecanismo genérico ahora evita rehacerlo cuando esa ficha llegue.

**Independent Test**: Con una prueba sintética a nivel de motor (no necesita una ficha real de 3+ ramas, que no existe todavía), confirmar que el mecanismo de avance síncrono acepta y resuelve correctamente un conjunto de 3 o más trayectorias activas simultáneas, cada una capaz de colisionar con cualquiera de las otras según la misma regla de la Historia 1.

**Acceptance Scenarios**:

1. **Given** un conjunto de N trayectorias activas simultáneas (N ≥ 2), **When** se avanza un tick, **Then** cada trayectoria activa se desplaza su propio siguiente paso, y cualquier coincidencia de casilla entre dos cualesquiera de ellas en ese tick se resuelve con la misma regla simétrica de la Historia 1 -- sin asumir en ningún punto que N es exactamente 2.
2. **Given** la división de rojo (el único caso real hoy, con N=2), **When** se resuelve con el mecanismo genérico, **Then** el resultado es idéntico al que ya se exige en la Historia 3 (no-regresión) -- el mecanismo genérico, aplicado a N=2, no es observable como distinto del caso especial de hoy salvo en el cruce de caminos que antes no se detectaba.

---

### User Story 3 - Ningún caso existente cambia de resultado (Priority: P1)

Quien mantiene el motor confirma que el 100% de los tests y niveles ya existentes -- cualquier cascada de un solo lanzamiento que no involucre rojo, y las dos ramas de rojo en cualquier caso donde sus caminos reales nunca coincidan en la misma casilla en el mismo tick (la inmensa mayoría de los casos ya cubiertos) -- siguen produciendo exactamente el mismo resultado que antes de esta feature.

**Why this priority**: Sin esta garantía, esta feature repetiría el mismo riesgo que motivó el rigor de 016/017 -- un cambio de mecanismo de resolución que además cambia resultados que no debía tocar. Es tan crítica como la Historia 1: ambas juntas son lo que hace que este cambio sea seguro.

**Independent Test**: Ejecutar la suite completa de tests de motor ya existente (001-018) y reproducir los 140 niveles generados con su secuencia de referencia, confirmando 0 cambios de resultado salvo en los casos explícitamente nuevos de la Historia 1.

**Acceptance Scenarios**:

1. **Given** cualquier test de motor ya existente que no involucre una división de rojo, **When** se ejecuta contra el motor ya cambiado, **Then** produce exactamente el mismo resultado que antes.
2. **Given** los niveles 14 y 15 del prototipo (los únicos que usan rojo) y cualquier nivel generado cuyo `solution` involucre rojo, **When** se reproducen contra el motor ya cambiado, **Then** producen exactamente el mismo resultado que antes -- sus dos ramas nunca llegan a coincidir en la misma casilla en el mismo tick (verificado, no asumido).

---

### Edge Cases

- ¿Qué pasa si tres o más trayectorias (en el caso genérico de la Historia 2) coinciden todas en la misma casilla en el mismo tick? Se resuelve como una serie de colisiones simétricas por pares, en un orden determinista y documentado en la fase de planificación -- no queda sin definir.
- ¿Qué ocurre si dos trayectorias en movimiento, tras colisionar entre sí (Historia 1), generan a su vez nuevas trayectorias o impactos (por ejemplo, cada una queda ahora en camino hacia otra ficha)? Esos impactos posteriores se resuelven con las mismas reglas ya existentes (mismo color/distinto color, fragilidad) -- ningún caso especial adicional.
- ¿Qué ocurre con el tope de cruces de borde de marrón (`MAX_EDGE_CROSSINGS`) cuando la ficha que camina es una trayectoria en movimiento por primera vez visible a otra trayectoria concurrente? No cambia -- sigue siendo la misma red de seguridad de siempre (008-brown-piece), ortogonal a esta feature.
- ¿Qué ocurre con un lanzamiento que no involucra rojo en absoluto? Nunca produce más de una trayectoria activa a la vez -- el mecanismo síncrono, aplicado a N=1, se comporta exactamente igual que la resolución secuencial de hoy (Historia 3).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El motor DEBE resolver cualquier conjunto de trayectorias activas simultáneas avanzándolas de forma síncrona, tick a tick, en vez de resolver una trayectoria por completo antes de empezar la siguiente.
- **FR-002**: El mecanismo DEBE soportar un número arbitrario (N ≥ 1) de trayectorias activas simultáneas -- ningún punto del diseño DEBE asumir que N es exactamente 2.
- **FR-003**: Cuando dos trayectorias actualmente en movimiento coinciden o se cruzan en la misma casilla en el mismo tick, cada una DEBE tratarse simultáneamente como golpeadora y como defensora de la otra (regla simétrica nueva) -- distinta de, y sin sustituir a, la regla asimétrica ya existente para una trayectoria en movimiento que golpea una ficha real ya asentada.
- **FR-004**: La regla asimétrica ya existente (trayectoria en movimiento vs. ficha ya asentada en el tablero) NO DEBE cambiar de comportamiento como consecuencia de esta feature.
- **FR-005**: Las dos ramas de una división de rojo DEBEN resolverse con este mecanismo síncrono genérico, no con un caso especial propio -- sustituye la resolución estrictamente secuencial de FR-005 de 009-red-piece.
- **FR-006**: El 100% de los tests y niveles ya existentes que no involucren una coincidencia real entre trayectorias en movimiento DEBEN seguir produciendo exactamente el mismo resultado que antes de esta feature.
- **FR-007**: Ninguna ficha nueva DEBE introducirse en esta feature -- el mecanismo se construye de forma genérica, pero solo rojo lo ejercita hoy.
- **FR-008**: El generador de niveles (`tools/generator/`) NO DEBE cambiar como consecuencia de esta feature -- sigue sin construir niveles con rojo.

### Key Entities

- **Trayectoria activa**: una ficha que ya fue golpeada (o lanzada) y está en movimiento, todavía no asentada ni resuelta -- puede haber varias existiendo a la vez desde esta feature, cada una avanzando un tick por vez.
- **Tick**: una unidad de avance síncrono en la que TODAS las trayectorias activas se desplazan su siguiente paso antes de comprobar coincidencias entre ellas.
- **Colisión simétrica**: el resultado de que dos trayectorias en movimiento coincidan en la misma casilla en el mismo tick -- cada una golpeadora y defensora de la otra a la vez; distinta de la colisión asimétrica ya existente (trayectoria en movimiento vs. ficha asentada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de una batería de casos sintéticos diseñados para forzar un cruce real entre dos trayectorias en movimiento resuelven ese cruce como una colisión simétrica, nunca como una atravesando a la otra.
- **SC-002**: El 100% de los tests de motor ya existentes (features 001-018) siguen pasando sin cambiar ningún valor esperado.
- **SC-003**: El 100% de los 140 niveles generados siguen resolviendo (`'won'`) al reproducir su secuencia de referencia con el motor ya cambiado.
- **SC-004**: El mecanismo de avance síncrono resuelve correctamente un conjunto sintético de 3 o más trayectorias activas simultáneas, sin ningún punto del código que asuma N=2.

## Assumptions

- El único caso real hoy que produce más de una trayectoria activa simultánea es la división de rojo (dos ramas) -- el soporte genérico para N ≥ 3 (Historia 2) se valida con pruebas sintéticas a nivel de motor, no con ninguna ficha real nueva (fuera de alcance).
- La resolución exacta de la regla "golpeadora y defensora a la vez" (fragilidad resultante, desplazamiento posterior de cada trayectoria) se deriva con cuidado en la fase de planificación (`research.md`), verificada empíricamente contra el motor real antes de implementarse -- no se fija de antemano en esta especificación más allá de "simétrica" (ya decidido por el usuario).
- El orden determinista para resolver 3+ coincidencias simultáneas en el mismo tick (edge case) se decide en planificación, documentado con su razonamiento -- no se dictamina aquí.
- Esta feature no toca el generador de niveles ni introduce ninguna ficha nueva -- ambos siguen siendo ítems separados del roadmap (respectivamente ya excluido, y el siguiente ítem tras esta feature).
