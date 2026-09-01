# Feature Specification: Animación de Movimientos de Ficha Durante un Lanzamiento

**Feature Branch**: `018-piece-movement-animation`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Animar los movimientos de fichas en el renderer (src/renderer/) durante la resolución de un lanzamiento, en vez de saltar directamente al estado final del tablero. Motivación: ayudar a interpretar visualmente las interacciones del motor (cadenas, autocolisiones, wrap-around) sin tener que leer las trazas de eventos a mano -- esto habría facilitado directamente la investigación de 017-striker-visibility-gap durante esta misma sesión. El motor ya expone toda la información necesaria: resolveLaunch/applySessionLaunch devuelven un EventLog completo y ordenado (MOVE_STEP con piece/from/to/hasCollision, ANNIHILATION con at/color) -- actualmente BoardScene.ts destruye este outcome.events por completo (solo desestructura session) y usa el session final para un redraw instantáneo. drawBoard (board-view.ts) limpia y vuelve a dibujar todo el tablero desde cero en cada llamada, vía Phaser.GameObjects.Graphics.fillCircle -- no hay ningún GameObject persistente por ficha que se pueda animar con tweens tal y como está hoy. Alcance: reproducir la secuencia de eventos de un lanzamiento en orden, animando cada MOVE_STEP como un desplazamiento simple (tween lineal, de la casilla `from` a la casilla `to`, duración corta y configurable) y cada ANNIHILATION con un efecto visual simple (por ejemplo, fundido/escala a cero) antes de que la ficha desaparezca. Mientras la animación de un lanzamiento está en curso, no debe poder iniciarse un nuevo lanzamiento ni seleccionarse otra ficha de mano. El resultado final (ventana de victoria/derrota) debe mostrarse solo después de que termine la animación completa, no antes ni durante. Fuera de alcance explícito: cualquier cambio al motor -- el EventLog ya contiene toda la información necesaria, esta feature es puramente de renderer. No se pide control de velocidad/pausa/scrubbing en esta primera versión. No se pide animar la selección de ficha en mano ni el resto de la interfaz, solo el movimiento de fichas durante la resolución de un lanzamiento en el tablero."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver la cascada de un lanzamiento paso a paso, no de golpe (Priority: P1)

Quien juega (o revisa un nivel) confirma un lanzamiento y ve cada ficha implicada desplazarse visualmente por el tablero, en el mismo orden en que el motor la resolvió -- un empuje, luego el siguiente eslabón de la cadena si lo hay, y así sucesivamente -- en vez de que el tablero salte directamente a su estado final sin transición.

**Why this priority**: Es la razón de ser de esta feature -- sin esto, no hay nada que interpretar visualmente; el resto de historias solo protegen la coherencia de esta animación.

**Independent Test**: Cargar un nivel cuyo lanzamiento produzca una cadena de al menos dos eslabones (p. ej. un nivel con marrón empujando una ficha que a su vez golpea otra), confirmar el lanzamiento, y observar que cada ficha implicada se desplaza visualmente de su casilla de origen a la de destino, en el orden de la traza de eventos, antes de que el tablero muestre el resultado final.

**Acceptance Scenarios**:

1. **Given** un lanzamiento cuya resolución produce una lista de eventos `MOVE_STEP`, **When** se confirma el lanzamiento, **Then** cada evento se anima como un desplazamiento de la ficha correspondiente desde su casilla `from` hasta su casilla `to`, en el mismo orden que la lista de eventos.
2. **Given** un lanzamiento cuya resolución incluye un evento `ANNIHILATION`, **When** le llega el turno a ese evento en la animación, **Then** la ficha afectada desaparece con un efecto visual simple (p. ej. fundido) en vez de desaparecer instantáneamente.
3. **Given** un lanzamiento que termina en missclick (ningún evento producido), **When** se confirma, **Then** no se anima nada -- el tablero se comporta exactamente igual que hoy (sin cambios).
4. **Given** la animación completa de un lanzamiento ha terminado, **When** se compara el tablero mostrado con el estado final real devuelto por el motor, **Then** coinciden exactamente -- la animación es una representación fiel de la traza real, nunca una aproximación que pueda desviarse del resultado.

---

### User Story 2 - No se puede interrumpir una animación en curso (Priority: P2)

Mientras una animación de lanzamiento está en marcha, quien juega no puede confirmar un nuevo lanzamiento ni cambiar qué ficha de la mano está seleccionada -- ambas acciones quedan bloqueadas hasta que la animación en curso termine por completo.

**Why this priority**: Sin este bloqueo, un segundo lanzamiento podría empezar a animarse sobre un tablero que todavía está a mitad de camino visualmente, mostrando un estado que no corresponde a ningún momento real de la partida -- y el motor ya habría avanzado más allá de lo que se está mostrando, rompiendo la correspondencia entre lo que se ve y lo que realmente pasó.

**Independent Test**: Confirmar un lanzamiento con una cascada de varios pasos y, mientras la animación todavía está en marcha, intentar confirmar otro lanzamiento por el borde del tablero y tocar una ficha distinta en el panel de mano -- comprobar que ninguna de las dos acciones tiene efecto hasta que la animación en curso termine.

**Acceptance Scenarios**:

1. **Given** una animación de lanzamiento está en curso, **When** se intenta confirmar un nuevo lanzamiento (borde del tablero), **Then** no ocurre nada -- ni se inicia una nueva resolución ni se interrumpe la animación en curso.
2. **Given** una animación de lanzamiento está en curso, **When** se toca una ficha del panel de mano para cambiar la selección, **Then** la selección no cambia hasta que la animación termine.
3. **Given** una animación de lanzamiento acaba de terminar, **When** se confirma un nuevo lanzamiento, **Then** se acepta con normalidad -- el bloqueo es exclusivo de mientras dura la animación, no un estado permanente.

---

### User Story 3 - El resultado final se muestra solo cuando la animación ha terminado (Priority: P2)

Cuando un lanzamiento resuelve el nivel (victoria o derrota), la ventana de resultado aparece únicamente después de que la animación completa de ese lanzamiento haya terminado de reproducirse -- nunca antes ni superpuesta a un tablero que todavía se está moviendo.

**Why this priority**: Mostrar el resultado antes de tiempo desmontaría exactamente lo que esta feature quiere lograr -- ver la cascada completa -- y además revelaría el resultado antes de que la animación termine de contar la historia de cómo se llegó a él.

**Independent Test**: Confirmar el lanzamiento que resuelve un nivel (victoria o derrota) y comprobar que la ventana de resultado no aparece hasta que la última ficha de la animación ha terminado de moverse/desaparecer.

**Acceptance Scenarios**:

1. **Given** un lanzamiento cuya resolución determina `'won'` o `'lost'`, **When** se confirma, **Then** la ventana de resultado no aparece hasta que la animación completa de ese lanzamiento ha terminado.
2. **Given** un lanzamiento que no resuelve el nivel (`'undetermined'`), **When** su animación termina, **Then** no aparece ninguna ventana de resultado -- comportamiento sin cambios respecto a hoy.

---

### Edge Cases

- ¿Qué ocurre si se intenta reiniciar el nivel mientras una animación está en curso? Se trata igual que un nuevo lanzamiento (Historia 2) -- queda bloqueado hasta que la animación termine.
- ¿Qué ocurre con un lanzamiento cuya traza de eventos está vacía pero NO es un missclick? No debería ocurrir con el motor actual (todo lanzamiento sin missclick produce al menos un evento) -- si ocurriera, se trata igual que un missclick: sin animación, redibujado instantáneo.
- ¿Qué ocurre con una cadena muy larga (muchos eventos en un solo lanzamiento)? La animación reproduce todos los eventos en orden, uno tras otro -- no se resume ni se salta ninguno; la duración total crece con el número de eventos, pero la duración de cada paso individual es corta y configurable (fase de planificación).
- ¿Qué ocurre con el visor de niveles generados (`GeneratedLevelSelectScene`) y otros puntos donde se usa `resolveLaunch`/`BoardScene`? Esta feature se aplica en cualquier sitio donde se anime la resolución de un lanzamiento sobre `BoardScene` -- no se limita a un modo de juego concreto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE reproducir la lista de eventos (`EventLog`) que devuelve la resolución de un lanzamiento, en el mismo orden en que el motor los produjo, en vez de aplicar directamente el estado final del tablero.
- **FR-002**: Cada evento `MOVE_STEP` DEBE animarse como un desplazamiento visual continuo de la ficha correspondiente desde su casilla `from` hasta su casilla `to`.
- **FR-003**: Cada evento `ANNIHILATION` DEBE animarse con un efecto visual simple que anteceda la desaparición de la ficha afectada, en vez de que desaparezca instantáneamente.
- **FR-004**: Un lanzamiento sin eventos (missclick) NO DEBE animar nada -- el comportamiento visual es idéntico al actual (redibujado instantáneo, sin cambios).
- **FR-005**: Mientras una animación de lanzamiento está en curso, el sistema NO DEBE aceptar la confirmación de un nuevo lanzamiento.
- **FR-006**: Mientras una animación de lanzamiento está en curso, el sistema NO DEBE aceptar un cambio de selección de ficha en el panel de mano.
- **FR-007**: La ventana de resultado (victoria/derrota) NO DEBE mostrarse hasta que la animación completa del lanzamiento que determinó ese resultado haya terminado.
- **FR-008**: Al terminar la animación completa de un lanzamiento, el tablero mostrado DEBE coincidir exactamente con el estado final real devuelto por el motor para ese lanzamiento -- la animación es una reproducción fiel de la traza real, nunca una aproximación.
- **FR-009**: Ninguna regla del motor (`src/engine/`) DEBE cambiar como consecuencia de esta feature -- el `EventLog` ya contiene toda la información necesaria; esta feature es exclusivamente de renderer (`src/renderer/`).
- **FR-010**: Esta feature NO DEBE introducir ningún control de velocidad, pausa, o desplazamiento manual (scrubbing) de la animación para quien juega -- una reproducción simple y automática es suficiente para esta primera versión.
- **FR-011** *(refinamiento tras playtest del usuario)*: Un desplazamiento de exactamente 2 casillas en línea recta (la distancia propia del empuje de naranja) DEBE animarse de forma distinguible de un desplazamiento normal -- incluyendo alguna indicación visual propia sobre la casilla intermedia que ese desplazamiento se salta.
- **FR-012** *(refinamiento tras playtest del usuario)*: El sistema DEBE reproducir un sonido simple al ocurrir un choque (cualquier `MOVE_STEP` con colisión, o una `ANNIHILATION`), un sonido simple DISTINTO al producirse específicamente el desplazamiento de 2 casillas de FR-011, y un sonido simple distinto de ambos al alcanzarse el objetivo del nivel.

### Key Entities

- **Animación de lanzamiento**: la reproducción visual, en curso o terminada, de la lista de eventos de un lanzamiento ya resuelto por el motor -- existe desde que se confirma un lanzamiento hasta que su último evento termina de representarse; mientras existe, bloquea nuevos lanzamientos y cambios de selección de mano (Historia 2).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los lanzamientos con al menos un evento muestran una animación visual antes de que el tablero refleje el estado final -- ningún lanzamiento salta directamente al resultado como ocurre hoy.
- **SC-002**: El 100% de los lanzamientos sin eventos (missclick) se comportan exactamente igual que antes de esta feature -- cero regresión en ese caso.
- **SC-003**: El 100% de las animaciones terminan mostrando un tablero idéntico al estado final real del motor -- cero discrepancias entre lo animado y lo resuelto.
- **SC-004**: El 100% de los intentos de iniciar un nuevo lanzamiento o cambiar la selección de mano mientras una animación está en curso no tienen ningún efecto observable.
- **SC-005**: El 100% de los lanzamientos que resuelven el nivel muestran la ventana de resultado únicamente después de que su animación completa ha terminado.
- **SC-006** *(refinamiento)*: El 100% de los desplazamientos de exactamente 2 casillas en línea recta muestran la indicación visual distinta de FR-011 y su propio sonido de FR-012, diferenciándose de un choque normal.

## Assumptions

- El diseño visual concreto de cada animación (duración exacta por paso, tipo de easing, efecto concreto de aniquilación) es un detalle de la fase de planificación/implementación, no de esta especificación -- aquí solo se exige que exista una animación fiel a la secuencia de eventos, con una duración por paso corta.
- FR-011/FR-012 se añadieron tras un playtest real del usuario sobre la primera versión implementada -- la duración concreta ("un poco más lenta") y el criterio exacto para identificar un "desplazamiento de naranja" (geométrico: exactamente 2 casillas en línea recta, sin necesitar saber qué color lo empujó) son decisiones de implementación, documentadas en `research.md`/`data-model.md`, no de esta especificación.
- Esta feature no cambia ninguna regla de interacción del motor ni el formato de `EventLog` -- consume exactamente los eventos que `resolveLaunch`/`applySessionLaunch` ya producen hoy.
- El bloqueo de nuevas acciones durante una animación (Historia 2) se limita a lanzar y a cambiar la selección de mano -- no se especifican otras interacciones de la interfaz (p. ej. navegar a otra pantalla) porque no están definidas hoy como acciones posibles durante una partida en curso.
- Dado que `board-view.ts` hoy redibuja todo el tablero desde cero con `Graphics` (sin `GameObject`s persistentes por ficha), la forma concreta de implementar el desplazamiento animado (introducir GameObjects persistentes por ficha, u otra técnica) se decide en `/speckit-plan` -- no es un requisito de esta especificación.
