# Feature Specification: Ficha Púrpura (Atracción)

**Feature Branch**: `025-purple-attraction-piece`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Añadir la ficha púrpura al motor, revisando el modelo inicial del documento de diseño. 1. La ficha púrpura solo puede repartirse en la mano de un nivel, nunca colocada directamente en el tablero, y siempre con fragilidad 'broken'. 2. Al lanzarse, avanza célula a célula por su carril; en cada celda vacía comprueba si hay una ficha a cada uno de los dos lados del eje PERPENDICULAR a su dirección de viaje (fila si viaja N/S, columna si viaja E/O), a cualquier distancia. Se asienta y desencadena su efecto en la PRIMERA celda que cumpla esa condición. 3. La púrpura no tiene ningún mecanismo propio de atacante contra una ficha defensora real -- si su avance se ve bloqueado por una ficha real antes de encontrar una celda cualificada, o si agota todo el carril sin encontrar ninguna, el lanzamiento entero se trata como missclick (spec.md 006), sin ningún cambio en el tablero. 4. Cuando sí se desencadena, el efecto es de atracción: las dos fichas encontradas viajan hacia la celda donde se asentó la púrpura, a la misma velocidad constante que cualquier otro movimiento; si parten a distinta distancia, la más cercana espera sin resolverse hasta que la otra también llegue, y entonces ambas colisionan entre sí ahí, con el mismo efecto ya existente para dos ramas paralelas que impactan en movimiento. La propia púrpura desaparece como parte de desencadenar el efecto, nunca llega a ocupar el tablero. 5. Nuevo efecto de sonido propio para el momento en que se activa la atracción. 6. Igual que con negro y arcoíris: por ahora NO se integra en el generador de niveles (tools/generator), solo en el motor y el renderer."

## Clarifications

### Session 2026-09-04

- Q: ¿En qué eje detecta la púrpura fichas "a cada lado"? → A: el eje perpendicular a su propia dirección de viaje -- si viaja N/S comprueba la fila (E-O); si viaja E/O comprueba la columna (N-S). Mismo precedente que ya usa la división de rojo (perpendicular al atacante).
- Q: ¿Cuál es exactamente la celda en la que se asienta la púrpura? → A: no depende de ningún impacto -- es la primera celda, avanzando célula a célula desde el lanzamiento, en la que se cumple la condición de tener ficha a ambos lados del eje perpendicular. El asentamiento y la comprobación son la misma cosa, no dos pasos distintos.
- Q: ¿Qué pasa si la púrpura llega a chocar contra una ficha real en su propio carril antes de encontrar una celda así? → A: la púrpura no tiene ningún mecanismo de atacante contra una defensora real (a diferencia de todos los demás colores) -- ese lanzamiento entero se trata como missclick, exactamente igual que si no hubiera encontrado nada en todo el carril.
- Q: ¿Puede la ficha púrpura repartirse directamente en el tablero de un nivel? → A: no, solo en la mano, y siempre con fragilidad 'broken'.
- Q: ¿Qué pasa con la animación si las dos fichas atraídas parten a distinta distancia de la celda de atracción? → A: ambas viajan a la misma velocidad constante que cualquier otro movimiento; la que llega antes espera sin resolverse hasta que la otra también llega, y entonces colisionan juntas -- nunca una antes que la otra.
- Q: ¿La búsqueda perpendicular (y el viaje de vuelta de las fichas atraídas) da la vuelta al tablero como ya hace el resto del movimiento (wrap-around, spec.md 004), o se queda acotada a esa fila/columna? → A: acotada -- se comprueba que haya una ficha en cada lado NATURAL de la celda de paso (dentro de los límites de esa fila/columna), sin envolver nunca por el borde del tablero. Ni la búsqueda ni el viaje de vuelta usan wrap-around en ningún caso.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lanzar una ficha púrpura hacia una celda cualificada activa la atracción (Priority: P1)

El jugador lanza una ficha púrpura desde la mano por un carril. La ficha avanza célula a célula; en la primera celda vacía donde encuentra una ficha a cada lado del eje perpendicular a su dirección de viaje, se detiene: esas dos fichas empiezan a viajar hacia esa celda y, cuando ambas llegan, colisionan entre sí. La propia púrpura desaparece como parte de desencadenar este efecto.

**Why this priority**: Es el comportamiento que define a esta ficha -- sin esto no hay ficha púrpura. Es también la primera ficha cuyo punto de asentamiento no depende de ningún impacto contra otra ficha, sino de una condición sobre su entorno perpendicular.

**Independent Test**: Colocar dos fichas en una misma fila o columna, con un carril vacío entre ellas en el que se pueda lanzar la púrpura perpendicularmente hasta que su trayectoria pase por la celda situada entre ambas; lanzarla y comprobar que las dos fichas viajan hasta esa celda, colisionan entre sí, y que la ficha púrpura ya no está en juego.

**Acceptance Scenarios**:

1. **Given** una ficha púrpura se lanza por un carril vacío, **When** alcanza (avanzando célula a célula) la primera celda en la que hay una ficha a cada lado del eje perpendicular a su dirección de viaje, **Then** se detiene ahí, desencadena la atracción, y desaparece como parte de ese mismo desencadenamiento.
2. **Given** las dos fichas atraídas parten a distinta distancia de la celda de atracción, **When** ambas viajan hacia ella a la misma velocidad constante, **Then** la que llega antes espera sin resolverse hasta que la otra también llega, y solo entonces colisionan entre sí.
3. **Given** las dos fichas atraídas han llegado a la celda de atracción, **When** colisionan entre sí, **Then** se aplica exactamente la misma resolución de choque mutuo en movimiento ya existente para dos ramas paralelas (aniquilación si son del mismo color, o la mecánica correspondiente de cada color implicado si son de distinto color).

---

### User Story 2 - Un lanzamiento de púrpura que no encuentra ninguna celda cualificada se trata como missclick (Priority: P1)

El jugador lanza una ficha púrpura, pero su avance se ve bloqueado por una ficha real antes de encontrar una celda con fichas a ambos lados del eje perpendicular, o agota todo el carril sin encontrar ninguna. En cualquiera de los dos casos, el lanzamiento entero se trata como un missclick: no se produce ningún cambio en el tablero y la ficha vuelve a la mano.

**Why this priority**: Es el resultado más frecuente en la práctica -- la mayoría de lanzamientos no encontrarán una celda cualificada -- y sin esto el comportamiento por defecto de la ficha queda indefinido. También establece que la púrpura, a diferencia de cualquier otro color, no tiene mecánica propia como atacante contra una ficha real.

**Independent Test**: Lanzar una púrpura por un carril que tiene una ficha real en medio (antes de cualquier celda cualificada) y comprobar que el tablero no cambia y la ficha vuelve a la mano. Repetir con un carril completamente vacío en el que ninguna celda a lo largo del recorrido tiene fichas a ambos lados del eje perpendicular, y comprobar el mismo resultado.

**Acceptance Scenarios**:

1. **Given** una ficha púrpura se lanza por un carril donde una ficha real bloquea su avance antes de que encuentre una celda cualificada, **When** llegaría a impactar contra ella, **Then** todo el lanzamiento se trata como missclick -- sin ningún cambio en el tablero, la ficha vuelve a la mano.
2. **Given** una ficha púrpura se lanza por un carril donde ninguna celda a lo largo de todo el recorrido tiene fichas a ambos lados del eje perpendicular, **When** agota el carril, **Then** también se trata como missclick.

---

### User Story 3 - La ficha púrpura solo puede repartirse en la mano, nunca en el tablero de un nivel (Priority: P2)

Un nivel puede repartir una ficha púrpura como parte de la mano del jugador, siempre con fragilidad 'broken'. Ningún nivel coloca una ficha púrpura directamente en el tablero al empezar.

**Why this priority**: Acota el alcance de la ficha y evita tener que definir qué significaría una púrpura ya asentada en el tablero desde el inicio de un nivel -- un caso que, de estar permitido, necesitaría reglas propias no descritas en esta feature.

**Independent Test**: Repartir una ficha púrpura en la mano de un nivel de prueba y comprobar que aparece ahí con fragilidad 'broken'; comprobar también que el motor no impide ni necesita ningún caso especial para "púrpura ya en el tablero" porque esa situación nunca se produce.

**Acceptance Scenarios**:

1. **Given** un nivel reparte una ficha púrpura en la mano del jugador, **When** se carga el nivel, **Then** esa ficha tiene fragilidad 'broken' y no existe ninguna ficha púrpura ya colocada en el tablero.

---

### User Story 4 - El impacto de atracción tiene un sonido propio (Priority: P3)

Cuando se activa la atracción de una ficha púrpura (User Story 1), se reproduce un efecto de sonido propio, distinto de los sonidos de choque ya existentes para el resto de colores.

**Why this priority**: Es una mejora de percepción/feedback, no un requisito de las reglas del juego -- el resto de esta feature es completamente funcional sin ella.

**Independent Test**: Provocar la activación de una atracción y comprobar (de oído, o inspeccionando qué efecto de sonido se dispara) que suena el efecto propio de la activación, no un sonido de choque genérico.

**Acceptance Scenarios**:

1. **Given** una ficha púrpura encuentra una celda cualificada y se asienta, **When** se desencadena la atracción, **Then** se reproduce el efecto de sonido propio de esa activación.

---

### Edge Cases

- ¿Qué pasa si a un lado del eje perpendicular hay más de una ficha en la misma fila/columna? Solo cuenta la más cercana a cada lado -- las demás no participan en la atracción ni se ven afectadas.
- ¿Puede una tercera ficha bloquear el trayecto de una de las dos fichas atraídas hacia la celda de atracción? No -- por construcción, cada una de las dos es la ficha MÁS CERCANA a la celda de atracción en su lado del eje, así que el camino entre ella y esa celda está garantizado vacío.
- ¿Qué pasa si las dos fichas atraídas son del mismo color? Se aplica la regla de aniquilación por mismo color ya existente al colisionar entre sí.
- ¿Qué pasa con una celda que solo tiene ficha en UNO de los dos lados del eje perpendicular, mientras la púrpura avanza? No cumple la condición -- la púrpura sigue avanzando a la siguiente celda del carril sin ningún efecto ahí.
- ¿Qué ocurre con el resto de una cadena en curso mientras las dos fichas atraídas viajan hacia la celda de atracción? Ninguna otra interacción pendiente de esa misma cadena avanza hasta que ambas fichas atraídas han llegado y colisionado, igual que ya ocurre con cualquier otra resolución en curso.
- ¿Qué pasa si la ficha púrpura entra en una celda de entrada al tablero que ya cumple la condición (ficha a ambos lados) en el primer paso? Se asienta y desencadena inmediatamente ahí, sin necesidad de avanzar más celdas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE soportar 'púrpura' como un color de ficha adicional, junto a los ya existentes.
- **FR-002**: Una ficha púrpura DEBE poder repartirse únicamente en la mano de un nivel -- nunca colocada directamente en el tablero al inicio de un nivel -- y siempre con fragilidad 'broken'.
- **FR-003**: Al lanzar una ficha púrpura, el sistema DEBE avanzarla célula a célula por su carril, comprobando en cada celda vacía si existe una ficha en cada uno de los dos lados NATURALES del eje PERPENDICULAR a su dirección de lanzamiento (la fila si viaja en dirección N o S, la columna si viaja en dirección E u O), dentro de los límites de esa fila/columna, sin límite de distancia PERO sin envolver nunca por el borde del tablero (sin wrap-around, a diferencia de otros movimientos ya existentes, spec.md 004).
- **FR-004**: La ficha púrpura DEBE asentarse y desencadenar su efecto en la PRIMERA celda, siguiendo el orden de avance, en la que se cumpla la condición del FR-003.
- **FR-005**: Si el avance de la ficha púrpura se ve bloqueado por una ficha real (un impacto) antes de encontrar una celda que cumpla el FR-004, el sistema DEBE tratar todo el lanzamiento como missclick (spec.md 006) -- sin ningún cambio en el tablero, la ficha vuelve a la mano.
- **FR-006**: Si la ficha púrpura recorre todo su carril sin encontrar ninguna celda que cumpla el FR-004 y sin ser bloqueada por ninguna ficha real, el sistema DEBE tratarlo también como missclick, igual que el FR-005.
- **FR-007**: La ficha púrpura NO DEBE tener ningún mecanismo propio de interacción como atacante contra una ficha defensora real -- ni empuje, ni división, ni limpieza de línea, ni cambio de color. Su único efecto posible es el descrito en el FR-008.
- **FR-008**: Al desencadenarse (FR-004), el sistema DEBE hacer viajar a las dos fichas encontradas -- una a cada lado -- hacia la celda donde se asentó la púrpura, a la misma velocidad de movimiento constante que cualquier otro desplazamiento ya existente en el motor, en línea recta dentro de esa misma fila/columna, sin envolver nunca por el borde del tablero (consistente con el FR-003: ambas fichas fueron encontradas mediante una búsqueda ya acotada, así que su camino de vuelta cae siempre dentro del tablero por construcción).
- **FR-009**: Si las dos fichas atraídas parten a distinta distancia de la celda de atracción, la que llegue antes DEBE esperar sin resolverse hasta que la otra también llegue.
- **FR-010**: Cuando ambas fichas atraídas han llegado a la celda de atracción, DEBEN colisionar entre sí aplicando exactamente la misma resolución de choque mutuo en movimiento ya existente para dos trayectorias que convergen (aniquilación por mismo color, o la mecánica correspondiente de cada color implicado si son de distinto color).
- **FR-011**: La propia ficha púrpura DEBE desaparecer como parte de desencadenar su efecto (FR-004/FR-008) -- nunca llega a ocupar una celda real del tablero.
- **FR-012**: El sistema DEBE reproducir un efecto de sonido propio cuando se activa la atracción (FR-004), distinto de los sonidos de choque ya existentes.
- **FR-013**: Ninguna regla ya existente (verde, naranja, marrón, rojo, negro, arcoíris, mismo color, wrap-around, missclick) DEBE cambiar de comportamiento como consecuencia de esta feature.

### Key Entities

- **Color de ficha 'púrpura'**: un color adicional de ficha, repartible solo en mano, siempre con fragilidad 'broken'.
- **Escaneo perpendicular**: la comprobación que la púrpura repite en cada celda vacía de su carril mientras avanza -- si hay una ficha a cada lado del eje perpendicular a su dirección de viaje, a cualquier distancia.
- **Celda de atracción**: la primera celda donde el escaneo perpendicular tiene éxito -- ahí es donde la púrpura se asienta y desencadena su efecto, y hacia donde viajan las dos fichas atraídas.
- **Atracción**: el efecto desencadenado al asentarse -- las dos fichas encontradas viajan hacia la celda de atracción, se esperan mutuamente si parten a distinta distancia, y colisionan entre sí ahí. La propia púrpura desaparece como parte de este efecto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al lanzar una púrpura hacia un carril donde existe una celda cualificada, las dos fichas más cercanas a cada lado del eje perpendicular de esa celda terminan colisionando entre sí, en el 100% de los casos.
- **SC-002**: Cuando una púrpura es bloqueada por una ficha real antes de encontrar una celda cualificada, o agota su carril sin encontrar ninguna, el tablero queda exactamente igual que antes del lanzamiento y la ficha vuelve a la mano, en el 100% de los casos.
- **SC-003**: Cuando las dos fichas atraídas parten a distinta distancia de la celda de atracción, ambas llegan y colisionan en el mismo instante, nunca una antes que la otra, en el 100% de los casos.
- **SC-004**: El efecto de sonido propio de la activación de la atracción se reproduce en el 100% de los lanzamientos de púrpura que sí la desencadenan.
- **SC-005**: Ningún nivel existente ni ninguna regla ya validada para otros colores cambia de comportamiento como consecuencia de esta feature, en el 100% de los casos (suite de tests existente sin regresiones).

## Assumptions

- Fragilidad 'broken' (FR-002): se mantiene como requisito explícito indicado por el usuario, aunque el modelo de missclick + desaparición-al-desencadenar (FR-005/FR-006/FR-011) ya garantiza por sí solo que la púrpura nunca ocupa el tablero -- no es el mecanismo del que depende ese comportamiento, solo un atributo que debe cumplirse igualmente.
- El sonido de la colisión final entre las dos fichas atraídas (una vez ambas han llegado) reutiliza el sonido de choque ya existente para ese tipo de colisión -- solo el momento de ACTIVACIÓN de la atracción (el propio asentamiento de la púrpura) tiene un sonido nuevo (FR-012). No confirmado explícitamente con el usuario; revisar en la fase de planificación si hiciera falta algo distinto.
- Igual que con negro (023) y arcoíris (024): esta feature es únicamente de motor y renderer -- el generador de niveles (tools/generator) no se modifica para poder generar púrpura automáticamente; podrá añadirse manualmente a niveles concretos si se desea probar.
- El mecanismo técnico concreto para que dos trayectorias de distinta longitud "se esperen" dentro del modelo de resolución por ticks (FR-009) es una decisión de diseño técnico que se resuelve en la fase de planificación, no en esta especificación -- aquí solo se exige el resultado observable (ambas llegan y colisionan juntas, nunca una antes que la otra).
- El diseño original del documento de referencia (`documentation/game_design_context.pdf`, sección 12) describía a la púrpura como "viaja hasta encontrar dos fichas flanqueándola" de forma más abierta; esta especificación revisa ese modelo inicial según lo acordado explícitamente con el usuario (el asentamiento depende del escaneo perpendicular celda a celda, no de un impacto), y sustituye esa descripción original.
