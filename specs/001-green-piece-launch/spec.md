# Feature Specification: Lanzamiento y Cadena de Ficha Verde (Walking Skeleton)

**Feature Branch**: `001-green-piece-launch`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Como jugador, lanzo una ficha verde desde fuera del tablero 8x8 en una
dirección N/S/E/O. La ficha avanza casilla a casilla (MOVE_STEP) hasta encontrar una ficha con la
que colisionar o hasta salir del tablero. Si sale del tablero sin interactuar con ninguna ficha, se
considera un missclick y la ficha vuelve a mi mano. Si colisiona, se dispara la interacción
correspondiente, que puede generar más eventos (movimientos, nuevas colisiones) hasta que el
tablero alcanza un estado estable (no quedan eventos pendientes). Solo entonces se comprueba si se
cumple el objetivo del nivel (por ejemplo, colocar una ficha verde en una casilla concreta). Esta
es la primera historia de usuario del roadmap: un 'walking skeleton' que prueba de punta a punta el
bucle completo (lanzamiento -> motor -> cola de eventos -> estado estable -> comprobación de
objetivo) usando únicamente la ficha verde y un único nivel de prueba jugable y ganable."

## Clarifications

### Session 2026-08-22

- Q: ¿Esta primera historia necesita alguna interfaz visual/jugable, o basta con demostrar el flujo completo de forma headless (por ejemplo, con un arnés de pruebas automatizado que verifica el estado final del tablero)? → A: Headless / sin interfaz. El resultado se demuestra y verifica mediante pruebas automatizadas sobre el motor; no se construye ninguna pantalla en esta historia. El trabajo de interfaz visual (Phaser) queda para una historia posterior dedicada.

### Session 2026-08-23

- Q: ¿Qué debe pasar cuando el lanzamiento es un missclick (la ficha vuelve a la mano, per FR-003)? → A: El nivel queda sin determinar — ni ganado ni perdido. Tras un missclick la mano conserva la ficha, así que declarar derrota sería incorrecto (contradecía FR-003/Scenario 1, que dicen que el objetivo no se evalúa, y a la propia lógica de "mano vacía" ya presente en Assumptions). La derrota solo se declara cuando la mano se queda sin fichas disponibles y el objetivo no se ha cumplido — lo cual, en esta historia, solo ocurre tras una colisión que consume la ficha sin alcanzar el objetivo. Esto corrige una contradicción interna del spec detectada durante la revisión del código: FR-008/Scenario 6 originales declaraban derrota tras cualquier missclick citando "no quedan lanzamientos dentro del alcance de esta historia", lo cual chocaba con FR-003/Scenario 1 y con Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lanzar una ficha verde y resolver un nivel de un solo lanzamiento (Priority: P1)

Un jugador abre un nivel de prueba en un tablero 8×8 que contiene una ficha verde ya colocada y una
mano con una única ficha verde disponible. El jugador elige una dirección (N/S/E/O) y lanza su ficha
desde fuera del tablero. La ficha avanza casilla a casilla hasta encontrar la ficha ya colocada, lo
que desencadena una reacción en cadena determinista. Cuando el tablero deja de tener eventos
pendientes (estado estable), el juego comprueba si una ficha verde ha quedado exactamente en la
casilla objetivo del nivel y comunica al jugador si ha ganado o perdido.

**Why this priority**: Es el "walking skeleton" del proyecto: la primera vez que el bucle completo
(lanzamiento → movimiento → colisión → cadena de eventos → estado estable → comprobación de
objetivo) funciona de punta a punta con una sola pieza. Sin esta historia no hay nada que demostrar
ni sobre lo que construir el resto de fichas.

**Independent Test**: Se puede probar por completo mediante una prueba automatizada que carga el
nivel de prueba, ejecuta el lanzamiento de la única ficha disponible en la mano en la dirección
indicada por el nivel, y verifica que el resultado expuesto por el motor (victoria si la ficha
objetivo queda en la casilla correcta; derrota si no) es correcto — sin necesidad de ninguna otra
ficha, regla, ni interfaz visual del juego. Esta historia no incluye pantalla ni interacción
manual; la verificación es headless (ver Clarifications).

**Acceptance Scenarios**:

1. **Given** un nivel con una ficha verde en el tablero y una mano con una ficha verde, **When** el
   jugador lanza la ficha en una dirección tal que su recorrido no encuentra ninguna ficha antes de
   salir del tablero, **Then** el lanzamiento se considera un missclick: la ficha vuelve a la mano
   del jugador, el tablero queda exactamente como estaba, y el nivel queda sin determinar (ni
   ganado ni perdido) — el jugador conserva la ficha para un futuro intento.
2. **Given** un nivel con una ficha verde colocada de forma que el lanzamiento del jugador colisiona
   con ella, **When** el jugador lanza su ficha, **Then** se desencadena la reacción en cadena
   correspondiente y el juego resuelve todos los eventos generados sin intervención del jugador
   hasta que no queda ningún evento pendiente.
3. **Given** una cadena de eventos que ha terminado de resolverse (estado estable), **When** una
   ficha verde ha quedado exactamente en la casilla objetivo del nivel, **Then** el nivel se marca
   como completado/ganado y se comunica al jugador.
4. **Given** una cadena de eventos que ha terminado de resolverse tras una colisión (no un
   missclick), **When** ninguna ficha verde ocupa la casilla objetivo del nivel y la mano del
   jugador ya no tiene fichas disponibles (la ficha lanzada fue consumida por la colisión), **Then**
   el nivel se marca como fallido (derrota explícita) y se ofrece al jugador la opción de
   reiniciarlo.
5. **Given** una cadena de eventos todavía en curso (quedan eventos pendientes en la cola), **When**
   se observa el tablero en un estado intermedio, **Then** el objetivo NO se evalúa todavía y el
   nivel no se marca ni como ganado ni como perdido hasta alcanzar el estado estable.
6. **Given** el jugador lanza su ficha y el resultado es un missclick, **When** se alcanza el
   estado estable (inmediato, al no haber colisión), **Then** el nivel queda sin determinar: ni
   ganado ni perdido, puesto que la ficha sigue disponible en la mano.

### Edge Cases

- ¿Qué ocurre si la ficha lanzada colisiona en la primera casilla del tablero (la ficha objetivo
  está justo en el borde)? El lanzamiento debe desencadenar la interacción igualmente; no se
  considera missclick por el simple hecho de colisionar temprano.
- ¿Qué ocurre si la reacción en cadena termina con la ficha originalmente lanzada fuera del tablero
  (por ejemplo, si la interacción la hace desaparecer)? El estado estable se evalúa igualmente sobre
  la casilla objetivo, independientemente de qué haya sido de la ficha lanzada.
- ¿Qué ocurre si el nivel ya cumple el objetivo antes de cualquier lanzamiento? Fuera de alcance
  para esta historia: el nivel de prueba de esta historia se diseña para que el objetivo NO se
  cumpla en el estado inicial, de modo que el resultado dependa siempre del lanzamiento del jugador.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir al jugador lanzar una ficha desde fuera del tablero en una
  de las cuatro direcciones (N, S, E, O).
- **FR-002**: El sistema MUST hacer avanzar la ficha lanzada casilla a casilla desde el borde
  correspondiente hasta que encuentre una casilla ocupada por otra ficha o hasta que salga del
  tablero por el extremo opuesto.
- **FR-003**: El sistema MUST devolver la ficha a la mano del jugador, sin ningún otro efecto sobre
  el tablero, cuando el lanzamiento sale del tablero sin haber colisionado con ninguna ficha
  (missclick).
- **FR-004**: El sistema MUST desencadenar una interacción cuando la ficha lanzada alcanza una
  casilla ocupada, y esa interacción MUST poder generar nuevos eventos (movimientos y/o nuevas
  colisiones) en lugar de resolverse necesariamente en un único paso.
- **FR-005**: El sistema MUST resolver todos los eventos generados por una interacción, en el
  orden en que se producen, antes de considerar el tablero en estado estable.
- **FR-006**: El sistema MUST NOT evaluar el objetivo del nivel mientras existan eventos
  pendientes; la comprobación del objetivo solo ocurre una vez alcanzado el estado estable.
- **FR-007**: El sistema MUST marcar el nivel como completado cuando, en estado estable, una ficha
  verde ocupa exactamente la casilla objetivo definida por el nivel.
- **FR-008**: El sistema MUST marcar el nivel como fallido cuando, en estado estable, el objetivo
  no se cumple y la mano del jugador no tiene ninguna ficha disponible (es decir, la ficha
  lanzada fue consumida por una colisión sin alcanzar el objetivo). Un missclick NO cuenta como
  agotar la mano, porque la ficha vuelve a ella (FR-003).
- **FR-009**: El sistema MUST exponer de forma explícita e inequívoca, como parte del estado
  observable devuelto por el motor, el resultado del nivel — victoria, derrota, o sin determinar
  (ver FR-012) — en cuanto se alcanza el estado estable. Esta historia no requiere que ese
  resultado se muestre en ninguna interfaz visual (ver Clarifications); esa presentación se cubre
  en una historia posterior.
- **FR-010**: El sistema MUST soportar reiniciar el nivel tras una derrota, restaurando el tablero
  y la mano a su estado inicial de forma verificable. En esta historia esta capacidad se expone y
  se verifica de forma headless (sin botón ni interfaz); una historia posterior la expondrá al
  jugador visualmente.
- **FR-011**: Dado el mismo estado inicial del tablero/mano y la misma dirección de lanzamiento, el
  sistema MUST producir siempre la misma secuencia de eventos y el mismo estado final
  (determinismo).
- **FR-012**: El sistema MUST dejar el nivel sin determinar (ni ganado ni perdido) cuando, en
  estado estable, el objetivo no se cumple pero la mano del jugador todavía tiene al menos una
  ficha disponible — por ejemplo, inmediatamente después de un missclick (FR-003), cuya ficha
  vuelve a la mano.

### Key Entities

- **Tablero (Board)**: cuadrícula de 8×8 casillas que contiene, en cada casilla, como mucho una
  ficha. Es el estado sobre el que se ejecuta y se evalúa toda la partida.
- **Ficha (Piece)**: elemento de color (en esta historia, únicamente verde) que ocupa una casilla
  del tablero o se encuentra disponible en la mano del jugador.
- **Mano (Hand)**: conjunto de fichas disponibles para el jugador, desde el que se lanza una ficha
  hacia el tablero.
- **Lanzamiento (Launch)**: acción del jugador que introduce una ficha de la mano en el tablero
  desde fuera de sus límites, con una dirección asociada (N/S/E/O).
- **Cadena de eventos / Estado estable**: secuencia de interacciones desencadenadas por un
  lanzamiento hasta que no queda ningún evento pendiente por resolver.
- **Objetivo (Objective)**: condición definida por el nivel (en esta historia: una ficha verde debe
  ocupar una casilla concreta) que determina si el nivel se gana o se pierde una vez alcanzado el
  estado estable.
- **Nivel de prueba (Test Level)**: configuración concreta de tablero, mano y objetivo usada para
  demostrar y validar este flujo completo de punta a punta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El sistema comprueba correctamente, en el 100% de las ejecuciones del nivel de
  prueba, si una ficha verde ocupa exactamente la casilla objetivo una vez alcanzado el estado
  estable — sin necesitar ninguna interfaz visual ni intervención humana para determinarlo (ver
  Clarifications: esta historia es headless).
- **SC-002**: El 100% de los lanzamientos que colisionan con una ficha resuelven la cadena de
  eventos completa hasta un estado estable, sin quedar nunca en un estado intermedio visible como
  resultado final.
- **SC-003**: El 100% de los lanzamientos que no colisionan con ninguna ficha (missclick) dejan el
  tablero en un estado idéntico al inicial, verificable de forma exacta casilla por casilla.
- **SC-004**: Repetir el mismo nivel de prueba con la misma dirección de lanzamiento produce el
  mismo resultado (victoria/derrota) el 100% de las veces (determinismo verificable).

## Assumptions

- El "comportamiento de impacto" de la ficha verde (qué ocurre exactamente sobre la ficha ya
  colocada cuando la lanzada la alcanza) se resuelve como un único MOVE_STEP adicional con
  resolución de colisión, aplicado en la dirección del impacto, tal como describe el documento de
  diseño del juego (secciones 8 y 9: "Verde = MOVE_STEP una vez con colisión"). Si esa reacción
  desplaza la ficha impactada a una casilla también ocupada, se desencadena una nueva interacción en
  cascada, siguiendo la misma regla universal de interacción.
  - En el nivel de prueba de esta historia, la reacción en cadena se diseña para terminar tras un
    número reducido de pasos (uno o dos), suficiente para demostrar que el motor gestiona eventos
    encadenados sin necesitar todavía otras fichas o reglas (mismo color, wrap-around, etc.), que
    quedan fuera de alcance y se cubren en historias posteriores del roadmap.
- Esta historia no implementa un bucle de turnos interactivo (el jugador eligiendo repetidamente
  entre varias fichas de la mano dentro de una misma sesión de juego): el nivel de prueba y sus
  tests ejercitan como mucho una llamada al motor por lanzamiento. Si esa llamada resulta en un
  missclick, el resultado queda "sin determinar" (FR-012) — un futuro incremento podría añadir el
  bucle que deja al jugador volver a lanzar, pero el motor ya expone el estado correcto para
  soportarlo sin cambios de contrato: basta con invocar de nuevo con la mano actualizada.
- Si la mano del jugador se queda sin fichas disponibles y el objetivo no se ha cumplido, el nivel
  se marca como fallido de forma explícita (no como bloqueo silencioso ni como reinicio
  automático). Un missclick no vacía la mano (FR-003), así que por sí solo nunca produce esta
  derrota — ver FR-008/FR-012.
- El nivel de prueba se diseña de forma que el objetivo no se cumple en el estado inicial del
  tablero, de modo que el resultado dependa siempre de la acción del jugador.
- Reiniciar un nivel tras una derrota es una operación siempre disponible y no requiere ninguna
  confirmación adicional del jugador.
- La identificación de casillas (posición de fichas, casilla objetivo) es un detalle de
  representación de datos sin impacto funcional en esta historia; cualquier esquema de
  coordenadas consistente (por ejemplo, fila/columna 0-7) es válido siempre que permita expresar
  sin ambigüedad la casilla objetivo del nivel de prueba.
