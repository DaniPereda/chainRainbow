# Feature Specification: Prototipo Frontend de Niveles

**Feature Branch**: `005-frontend-prototype`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Prototipo frontend simple para visualizar el tablero y ejercitar las interacciones ya implementadas en el motor (verde, naranja, mismo color, wrap-around): pantalla de inicio, selector de niveles del 1 al 10 cada uno hardcodeado, ventana de exito o fallo, y reinicio"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seleccionar y ver un nivel (Priority: P1)

Un jugador abre la aplicación, ve una pantalla de inicio, y desde ahí accede a un selector con
los 10 niveles disponibles. Al elegir uno, ve el tablero de ese nivel con sus fichas y su
objetivo colocados exactamente como están definidos para ese nivel.

**Why this priority**: Es la base de todo lo demás — sin poder ver un nivel correctamente
renderizado, ninguna interacción posterior tiene sentido. Además valida por sí sola que el
"puente" entre los datos declarativos del nivel (motor) y su representación visual funciona,
que es el riesgo técnico principal de este prototipo.

**Independent Test**: Se puede probar por completo sin que el lanzamiento de fichas funcione
todavía — basta con seleccionar cada uno de los 10 niveles y comprobar visualmente que el
tablero mostrado coincide con la definición declarativa de ese nivel (posición y color de cada
ficha, y casilla/color objetivo).

**Acceptance Scenarios**:

1. **Given** el jugador está en la pantalla de inicio, **When** accede al selector de niveles,
   **Then** ve una lista o cuadrícula con los 10 niveles disponibles, identificados del 1 al 10.
2. **Given** el jugador está en el selector de niveles, **When** elige uno cualquiera de los 10,
   **Then** se muestra el tablero 8×8 de ese nivel con cada ficha en su posición y color
   correctos, y con el objetivo del nivel indicado visualmente.
3. **Given** el jugador está viendo el tablero de un nivel, **When** decide volver atrás,
   **Then** regresa al selector de niveles sin que la app se quede en un estado inconsistente.

---

### User Story 2 - Lanzar una ficha y ver la cadena resuelta (Priority: P2)

Desde el tablero de un nivel ya cargado, el jugador elige una ficha de su mano y la lanza —
indicando dirección y carril — y ve el tablero actualizarse para reflejar el resultado final de
la cadena de interacciones que el motor de simulación ya existente resuelve (empujes,
aniquilaciones por mismo color, wrap-around).

**Why this priority**: Es lo que convierte el prototipo en algo jugable en vez de una simple
galería de tableros — ejercita de verdad las reglas ya implementadas en el motor (Fase 1), que
es el propósito central de este prototipo según la constitución del proyecto.

**Independent Test**: Con un nivel ya cargado (US1), se puede lanzar una ficha con una
dirección y carril conocidos y comprobar que el tablero resultante coincide exactamente con lo
que el motor de simulación resuelve para ese mismo nivel y lanzamiento — incluyendo el caso de
missclick, en el que la ficha simplemente vuelve a la mano y el tablero no cambia.

**Acceptance Scenarios**:

1. **Given** un nivel cargado con al menos una ficha en la mano, **When** el jugador especifica
   una dirección y un carril válidos y confirma el lanzamiento, **Then** el tablero se actualiza
   para mostrar el estado final tras resolverse toda la cadena de interacciones (sin necesidad
   de animar cada paso intermedio).
2. **Given** un lanzamiento que no encuentra ninguna ficha en su trayecto (missclick), **When**
   se confirma ese lanzamiento, **Then** el tablero no cambia y la ficha lanzada permanece
   disponible en la mano.
3. **Given** la mano del jugador queda vacía tras un lanzamiento, **When** eso ocurre, **Then**
   ya no se puede iniciar un nuevo lanzamiento en ese nivel.

---

### User Story 3 - Resultado y reinicio (Priority: P3)

Tras un lanzamiento que deja el motor en un resultado determinado ('won' o 'lost'), el jugador
ve una ventana de éxito o de fallo según corresponda, desde la que puede reiniciar el nivel
actual desde su estado inicial o volver al selector de niveles.

**Why this priority**: Cierra el bucle de juego de un nivel individual. Depende de US2 (un
lanzamiento debe poder resolverse) pero es una pieza de valor propia y verificable por separado
una vez existe esa base.

**Independent Test**: Forzando (o alcanzando mediante juego) un resultado 'won' y otro 'lost' en
niveles distintos, se puede comprobar que aparece la ventana correspondiente en cada caso, y que
desde ella tanto "reiniciar" como "volver al selector" llevan al estado esperado.

**Acceptance Scenarios**:

1. **Given** un lanzamiento resuelve el objetivo del nivel, **When** eso ocurre, **Then** se
   muestra una ventana de éxito.
2. **Given** un lanzamiento deja la mano vacía sin haber cumplido el objetivo, **When** eso
   ocurre, **Then** se muestra una ventana de fallo.
3. **Given** el jugador ve la ventana de éxito o de fallo, **When** elige reiniciar, **Then** el
   nivel vuelve exactamente a su estado inicial declarado (tablero y mano), listo para jugarse
   de nuevo.
4. **Given** el jugador ve la ventana de éxito o de fallo, **When** elige volver al selector,
   **Then** regresa al selector de niveles.

---

### Edge Cases

- ¿Qué ocurre si el jugador navega de vuelta al selector de niveles a mitad de partida, antes de
  que el lanzamiento se resuelva en 'won' o 'lost'? El progreso de ese nivel se descarta — no
  hay persistencia entre visitas a un nivel (ver Assumptions).
- ¿Qué ocurre si el jugador pulsa reiniciar antes de haber lanzado ninguna ficha? El nivel ya
  está en su estado inicial, así que no hay ningún cambio visible.
- ¿Qué ocurre si un lanzamiento es un missclick y la mano queda vacía justo después (era la
  última ficha)? Un missclick no consume la ficha de la mano (vuelve a ella), así que este caso
  no puede darse por un missclick en sí — solo un lanzamiento que sí impacta puede vaciar la
  mano.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar una pantalla de inicio como punto de entrada a la
  aplicación.
- **FR-002**: El sistema DEBE ofrecer un selector con los 10 niveles disponibles, cada uno
  identificable individualmente (numerado del 1 al 10).
- **FR-003**: Los 10 niveles DEBEN estar definidos como datos declarativos (Principio IV de la
  constitución) — no como lógica imperativa — reutilizando el mismo modelo de nivel que ya usa
  el motor.
- **FR-004**: Al seleccionar un nivel, el sistema DEBE renderizar el tablero 8×8 de ese nivel
  reflejando fielmente su definición: posición y color de cada ficha ya colocada, y la
  casilla/color del objetivo.
- **FR-005**: El sistema DEBE permitir al jugador especificar una dirección de lanzamiento y un
  carril, y confirmar el lanzamiento de la primera ficha disponible en su mano.
- **FR-006**: Al confirmarse un lanzamiento, el sistema DEBE pedir al motor de simulación ya
  existente que lo resuelva sobre el nivel y lanzamiento indicados, y actualizar el tablero para
  reflejar el estado final devuelto — sin alterar ni reinterpretar el resultado del motor.
- **FR-007**: El sistema DEBE mostrar una ventana de éxito cuando el motor determine, tras un
  lanzamiento, que el objetivo del nivel se ha cumplido.
- **FR-008**: El sistema DEBE mostrar una ventana de fallo cuando el motor determine, tras un
  lanzamiento, que la mano ha quedado vacía sin haber cumplido el objetivo.
- **FR-009**: El sistema NO DEBE mostrar ninguna ventana de resultado cuando el motor determine
  que la partida sigue indeterminada (p. ej. tras un missclick) — el jugador simplemente puede
  seguir jugando ese nivel.
- **FR-010**: Desde la ventana de éxito o de fallo, el sistema DEBE permitir reiniciar el nivel
  actual, devolviendo el tablero y la mano exactamente a su estado inicial declarado.
- **FR-011**: Desde la ventana de éxito o de fallo, el sistema DEBE permitir volver al selector
  de niveles.
- **FR-012**: El sistema NO DEBE persistir el progreso de una partida entre visitas a un nivel —
  cada vez que se selecciona un nivel (por primera vez o tras reiniciar), parte de su estado
  inicial declarado.
- **FR-013**: El renderer NO DEBE contener lógica de reglas de juego (Principio I) — toda
  decisión sobre el resultado de un lanzamiento la determina exclusivamente el motor ya
  existente; el renderer solo traduce su salida a pantalla.

### Key Entities

- **Nivel hardcodeado**: uno de los 10 niveles jugables del prototipo. Se apoya en la
  definición de nivel ya existente en el motor (tablero inicial, mano, objetivo) más un
  identificador de presentación (su número del 1 al 10) para el selector.
- **Sesión de nivel en curso**: el estado de un nivel mientras se juega — su definición inicial
  más los sucesivos resultados de lanzamiento aplicados, hasta alcanzar un resultado
  determinado (éxito o fallo), o hasta que el jugador reinicia o abandona el nivel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde la pantalla de inicio, un jugador llega a ver el tablero de cualquiera de
  los 10 niveles en 2 interacciones o menos (abrir selector, elegir nivel).
- **SC-002**: El tablero inicial renderizado de cada uno de los 10 niveles coincide exactamente
  — ficha por ficha y objetivo incluido — con la definición declarativa de ese nivel, en el
  100% de los casos.
- **SC-003**: Los 10 niveles son superables ('won' alcanzable) usando únicamente las reglas ya
  implementadas del motor (verde, naranja, mismo color, wrap-around) — verificado jugando cada
  uno hasta el final al menos una vez.
- **SC-004**: Desde la ventana de éxito o fallo, tanto reiniciar como volver al selector se
  consiguen en una única interacción.
- **SC-005**: Un jugador puede completar un nivel entero (seleccionar → lanzar → ver resultado)
  sin necesitar instrucciones externas a la propia interfaz.

## Assumptions

- No se anima paso a paso la cadena de interacciones del motor en este prototipo — se muestra
  directamente el estado final del tablero tras resolverse por completo. Animar cada paso
  intermedio de la cadena queda fuera de alcance para esta fase (posible mejora futura, sin
  impacto en el motor).
- Los 10 niveles están disponibles desde el primer momento, sin ningún tipo de bloqueo o
  progresión secuencial entre ellos.
- No hay persistencia de partidas guardadas ni de progreso entre sesiones o entre niveles — este
  prototipo es deliberadamente efímero (Fase 2 de la constitución del proyecto).
- El mecanismo concreto para que el jugador indique dirección y carril de lanzamiento (botones,
  gestos táctiles, etc.) se decide durante el plan técnico — esta especificación solo exige que
  el jugador pueda especificar ambos valores y confirmar el lanzamiento.
- Los 10 niveles se diseñan a mano específicamente para este prototipo, reutilizando únicamente
  las piezas y reglas de Fase 1 (verde, naranja, mismo color, wrap-around) — no se introduce
  ninguna pieza o regla nueva del motor (marrón, rojo, u otras quedan para Fase 3).
