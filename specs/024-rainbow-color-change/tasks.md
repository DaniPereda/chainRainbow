# Tasks: Ficha Arcoíris (Cambio de Color)

**Input**: Design documents from `/specs/024-rainbow-color-change/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla
de interacción de motor, mismo patrón que toda feature de motor anterior.

**Organization**: Por user story (US1 = P1, US2 = P1 también, US3 = P2, US4 = P3 -- ver spec.md).
Precedido de una fase Foundational más grande de lo habitual: esta es la primera feature que
introduce un mecanismo de control nuevo (resolución resumible, research.md Decisión 1), del que
dependen las cuatro historias.

## Phase 1: Foundational (bloqueante para las cuatro historias)

**Purpose**: El color nuevo, el evento nuevo, y el mecanismo de pausa/reanudación de
`resolveChain`/`applyImpact`/`resolveLaunch` son la base de todo lo demás -- ninguna historia
puede implementarse sin esto. Ninguna tarea de esta fase introduce todavía comportamiento de
arcoíris observable (nada produce aún un `'pending-color-choice'` real).

- [X] T001 En `src/engine/board.ts`: añadir `'rainbow'` a `PieceColor` (data-model.md, "PieceColor
  (extendida)").
- [X] T002 En `src/engine/events.ts`: añadir `ColorChoiceEvent` (`{type:'COLOR_CHOICE', at, from,
  to}`) a la unión `ChainEvent` (data-model.md). Depende de T001 (`PieceColor` en sus campos).
- [X] T003 En `src/engine/events.ts`: definir `ImpactResolution` (unión discriminada
  `'resolved' | 'pending-color-choice'`, data-model.md), cambiar `ImpactHandler` para que
  devuelva `ImpactResolution`, y reescribir el `while` de `resolveChain` para que: (a) si
  `handleImpact` devuelve `'pending-color-choice'`, detenga el bucle ahí mismo y devuelva
  `'pending-color-choice'` con el `board`/`events` acumulados hasta ese punto más `at`/`options` y
  un `resume(color)` que reintroduce el resultado de continuar en la MISMA cola capturada por
  clausura (research.md Decisión 1); (b) en cualquier otro caso, se comporte exactamente como hoy,
  envuelto en `{status:'resolved', board, events}`. Depende de T002.
- [X] T004 En `src/engine/pieces/push.ts`: envolver TODOS los `return {board, events, nextSites}`
  ya existentes de `applyImpact` en `{status:'resolved', ...}` (cambio mecánico, sin alterar
  ninguna decisión) para que el tipo compile contra T003; hacer que `resolveRedSplit` reenvíe el
  `status` de su propia llamada interna a `resolveChain` SIN envolverlo (research.md Decisión 1);
  y hacer que la rama de `applyImpact` que llama a `resolveRedSplit` compruebe ese `status` --
  si es `'pending-color-choice'`, lo reenvía como su propio `'pending-color-choice'` (con un
  `resume` que llama al de `resolveRedSplit` y empaqueta el resultado final como
  `{status:'resolved', board, events, nextSites: []}` si ya no está pendiente, o lo vuelve a
  reenviar si lo sigue estando). Depende de T003.
- [X] T005 [P] En `tests/unit/engine/black.test.ts`: migrar las 7 llamadas directas a
  `applyImpact` para comprobar `result.status === 'resolved'` (con un pequeño helper compartido,
  p. ej. `expectResolved(result)`, que además estrecha el tipo) antes de leer
  `board`/`events`/`nextSites` -- migración mecánica, cero cambio de comportamiento esperado.
  Depende de T004.
- [X] T006 [P] En `tests/unit/engine/push.test.ts` y `tests/unit/engine/events.test.ts`: mismo
  tipo de migración mecánica para las llamadas directas a `applyImpact`/`resolveChain` (9 + varias
  respectivamente). Depende de T003, T004.
- [X] T007 En `src/engine/resolve-launch.ts`: añadir `PendingColorChoice`/el campo opcional
  `pendingColorChoice` a `LaunchOutcome` (data-model.md); `resolveLaunch` envuelve el `resume` de
  `resolveChain` para que, cuando ya no esté pendiente, empaquete el `LaunchOutcome` final
  exactamente igual que el `return` ya existente (`board`, `hand: finalHand`, `events`,
  `missclick: false`, `result: evaluateGoal(...)`), y cuando siga pendiente, empaquete otro
  `LaunchOutcome` con su propio `pendingColorChoice`. Depende de T003.
- [X] T008 [P] En `src/engine/session.ts`: extraer `commitLaunchOutcome(session, outcome)` de la
  cola de `applySessionLaunch` ya existente; `applySessionLaunch` devuelve `{session (sin tocar),
  outcome}` si `outcome.pendingColorChoice` está definido, o `{session:
  commitLaunchOutcome(session, outcome), outcome}` en caso contrario (data-model.md). Depende de
  T007.
- [X] T009 [P] En `src/renderer/board-view.ts`: añadir `rainbow` a `PIECE_COLOR` (un violeta/
  magenta sólido, distinguible de los 5 colores ya usados -- ajustar el valor exacto contra la app
  real antes de cerrar esta tarea). Depende de T001.
- [X] T010 Ejecutar `npm run typecheck` y `npm test` -- confirmar que toda la fase Foundational
  compila y que ningún test existente cambia de resultado (solo de forma, por T005/T006) antes de
  introducir ninguna rama de comportamiento real de arcoíris.

**Checkpoint**: El mecanismo de pausa/reanudación existe, compila, y no rompe nada -- pero nada lo
dispara todavía (ningún `applyImpact` real devuelve `'pending-color-choice'` aún).

## Phase 2: User Story 1 - Lanzar una ficha arcoíris cambia el color de la ficha con la que impacta (Priority: P1) 🎯 MVP

**Goal**: Una ficha arcoíris lanzada desde la mano que impacta contra una ficha de distinto color
detiene la resolución, ofrece las 5 opciones de color señalando a la defensora, y al elegir una
cambia su color mientras la propia arcoíris desaparece -- incluyendo la precedencia correcta
frente a negro (gana negro) y frente a rojo (gana arcoíris), FR-009/FR-010.

**Independent Test**: quickstart.md, Escenarios 1, 2, 5 y 7.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] En `tests/unit/engine/rainbow.test.ts` (fichero nuevo): `applyImpact` con
  una arcoíris atacante contra un defensor de distinto color -- confirmar `status ===
  'pending-color-choice'`, `at` igual a la casilla del defensor, `options` igual a las 5
  no-arcoíris en orden fijo; llamar a `.resume('red')` y confirmar `status === 'resolved'` con
  `events` = `[ColorChoiceEvent(from:<color original>, to:'red'), ANNIHILATION(arcoíris,
  from===at falso -- viajó realmente)]` y el defensor recoloreado en el tablero resultante.
- [X] T012 [US1] En `tests/unit/engine/rainbow.test.ts`: end-to-end vía `resolveLaunch`
  (quickstart.md Escenarios 1-2) -- `outcome.pendingColorChoice` definido antes de resolver,
  `outcome.pendingColorChoice.resume(color)` produce el `LaunchOutcome` final con
  `pendingColorChoice` ausente, tablero y `result` correctos.
- [X] T013 [P] [US1] En `tests/unit/engine/rainbow.test.ts`: missclick -- un lanzamiento cuyo
  carril está completamente vacío no produce ningún `pendingColorChoice` (FR-011, mismo patrón ya
  cubierto genéricamente por `launch.test.ts`).
- [X] T014 [P] [US1] En `tests/unit/engine/rainbow.test.ts` (o `black.test.ts`, junto a sus tests
  ya existentes): precedencia frente a negro -- arcoíris lanzada golpea una negra asentada, Y
  negro lanzado golpea una arcoíris asentada -- confirmar en AMBOS casos que gana la limpieza de
  línea de negro (`outcome.pendingColorChoice` es `undefined`, ningún `COLOR_CHOICE` en
  `events`), FR-009 (quickstart.md Escenario 4).
- [X] T015 [P] [US1] En `tests/unit/engine/rainbow.test.ts` (o `red.test.ts`): precedencia frente
  a rojo -- arcoíris lanzada golpea una roja asentada, Y rojo lanzado golpea una arcoíris asentada
  -- confirmar en AMBOS casos que gana el cambio de color de arcoíris (`pendingColorChoice`
  definido, ningún `MOVE_STEP` perpendicular en los `events` finales), FR-010 (quickstart.md
  Escenario 5).

### Implementation for User Story 1

- [X] T016 [US1] En `src/engine/pieces/push.ts`, `applyImpact`: añadir la rama nueva
  `defender.color === 'rainbow' || site.piece.color === 'rainbow'`, comprobada DESPUÉS de la
  regla de mismo color y de la rama de negro ya existentes, y ANTES de la comprobación de rojo
  (research.md Decisión 3, data-model.md). Construye `options` (las 5 no-arcoíris, orden fijo) y
  `at` (la casilla de la ficha defensora -- SIEMPRE la que ya estaba ahí, sea o no arcoíris,
  research.md Decisión 2), y devuelve `{status:'pending-color-choice', board, events (hasta
  ahora), at, options, resume}`, donde `resume(color)` aplica el cambio de color a la defensora,
  construye el `ColorChoiceEvent` y el `ANNIHILATION` de la ficha que no sobrevive (con su
  `from`/`direction` reales, FR-004), y devuelve `{status:'resolved', board (actualizado), events,
  nextSites: []}` (FR-007: nunca genera `nextSites` propios). Depende de T001-T004.
- [X] T017 [US1] Ejecutar T011-T013 contra T016 hasta que pasen. Ejecutar T014-T015 contra T016 --
  dado que la rama de negro ya se comprueba ANTES en `applyImpact` (023, sin cambios) y la nueva
  rama de T016 se comprueba ANTES que la de rojo, ambas precedencias deberían quedar satisfechas
  sin código adicional; si algún caso falla, corregir el ORDEN de las comprobaciones en
  `applyImpact` hasta que pase (mismo patrón de verificación que 023, Phase 3).

**Checkpoint**: US1 completa y testeable de forma independiente. `npm test` en verde para
`rainbow.test.ts` (motor puro, sin ningún componente de renderer todavía).

## Phase 3: User Story 2 - Una ficha arcoíris asentada en el tablero cambia su propio color al ser golpeada (Priority: P1)

**Goal**: Una ficha arcoíris ya en el tablero, golpeada por cualquier otra ficha, es la que cambia
de color (siendo la defensora) mientras la atacante desaparece.

**Independent Test**: quickstart.md, Escenario 3.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] En `tests/unit/engine/rainbow.test.ts`: una arcoíris asentada golpeada por
  una ficha de distinto color -- confirmar que `pendingColorChoice.at` es la casilla de la propia
  arcoíris (no la del atacante), y que tras `.resume(color)` esa casilla tiene el color elegido y
  la atacante ha desaparecido (`ANNIHILATION` con `from` real, no `from === at`).

### Implementation for User Story 2

- [X] T019 [US2] Ejecutar T018 contra T016. La condición `defender.color === 'rainbow' ||
  site.piece.color === 'rainbow'` ya cubre este caso (defensora = arcoíris) sin código adicional
  -- si falla, corregir T016 hasta que pase (verificación-only, mismo patrón que 023 US2).

**Checkpoint**: US1 y US2 completas. `npm test` en verde.

## Phase 4: User Story 3 - Arcoíris contra arcoíris sigue siendo una aniquilación por mismo color (Priority: P2)

**Goal**: Un impacto de arcoíris contra otra arcoíris sigue produciendo la aniquilación por mismo
color ya existente, sin abrir ningún selector de color (FR-008).

**Independent Test**: quickstart.md, Escenario 6.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] En `tests/unit/engine/rainbow.test.ts`: arcoíris golpea a otra arcoíris --
  confirmar exactamente un `ANNIHILATION` doble (regla de mismo color ya existente) y que
  `pendingColorChoice` nunca llega a definirse.

### Implementation for User Story 3

- [X] T021 [US3] Ejecutar T020 contra T016. La comprobación de mismo color ya existente se sigue
  evaluando ANTES que la rama nueva de T016 -- no debería hacer falta ningún cambio de código. Si
  T020 falla, corregir el orden de las comprobaciones en `applyImpact` hasta que la regla de mismo
  color vuelva a tener prioridad.

**Checkpoint**: Las tres historias de motor completas y verificadas de forma independiente.

## Phase 5: User Story 4 - El impacto de arcoíris tiene un sonido propio, e integración de renderer (Priority: P3)

**Goal**: El renderer reproduce visualmente el cambio de color (sin desplazamiento), reproduce un
sonido propio de arcoíris, y presenta el diálogo flotante de selección de color que pausa
realmente el juego hasta que el jugador elige -- la única parte de esta feature con superficie de
UI real.

**Independent Test**: quickstart.md, Escenario 9 (verificación visual manual).

### Implementation for User Story 4

- [X] T022 [P] [US4] En `src/renderer/sound-effects.ts`: nuevo `playRainbowSound()` (mismo patrón
  que `playSplitSound`/`playImpactSound`), con un timbre propio y distinto de los ya existentes.
- [X] T023 [US4] En `src/renderer/launch-animation.ts`, `runEvent()`: nueva rama para
  `event.type === 'COLOR_CHOICE'` -- sin `walkPath`/`cellPath` (no hay desplazamiento que animar,
  igual que el guard `from === at` ya existente para `ANNIHILATION`): un tween breve de color
  sobre el círculo ya dibujado en `event.at` (de `PIECE_COLOR[event.from]` a
  `PIECE_COLOR[event.to]`) y `playRainbowSound()` (T022). Depende de T009, T022.
- [X] T024 [US4] Nuevo componente de UI: el diálogo flotante de selección de color (una escena/
  overlay de Phaser propio) -- recibe `at`/`options` de un `pendingColorChoice`, se posiciona
  anclado a esa casilla, dibuja un círculo por color de `options` (reutilizando `PIECE_COLOR`), y
  al pulsar uno invoca un callback con el color elegido. Sin lógica de reglas del juego (Principio
  I) -- solo traduce un clic en un valor de `PieceColor`.
- [X] T025 [US4] En `src/renderer/scenes/BoardScene.ts`, `launch()`: reemplazar la única llamada a
  `playEventLog` por un bucle (data-model.md, "BoardScene.launch()"): reproduce
  `outcome.events.slice(playedCount)`, actualiza `playedCount`; si `outcome.pendingColorChoice`,
  abre el diálogo de T024 anclado en `pendingColorChoice.at` y, al elegir, llama a
  `pendingColorChoice.resume(color)` para obtener el siguiente `outcome` y repite; si no, llama a
  `commitLaunchOutcome` (T008) y continúa con el flujo ya existente (redraw, victoria/derrota).
  Depende de T023, T024.
- [X] T026 Verificación visual manual (quickstart.md Escenario 9): nivel de prueba puntual (no
  comprometido) con arcoíris en mano y una ficha de color conocido en el tablero, lanzada por
  `dev-levels.html` -- confirmó que la resolución se detiene, aparece el diálogo señalando la
  ficha correcta, el resto del tablero no cambia mientras está abierto, y al elegir un color se ve
  el cambio, desaparece la arcoíris, y suena el efecto propio. Encontró un bug real (research.md
  Decisión 8: la animación quedaba congelada para siempre tras elegir un color) y lo arregló;
  reverificado en vivo dos veces (`'red'` y `'black'`) tras el arreglo, incluida la evaluación
  correcta del objetivo contra el resultado final en ambos casos.
  **Segunda ronda (reportada por el usuario tras probar la PR)**: faltaba la animación del
  trayecto de la atacante antes de que apareciera el diálogo -- arreglado (research.md Decisión
  10), junto a un bug relacionado en `pendingFrom` (`events.ts`) que perdía los eventos previos a
  la pausa al reanudar. `rainbow.test.ts` actualizado para la nueva distribución de eventos;
  `npm test` en verde (254/254).

**Checkpoint**: Las cuatro historias completas, incluida la integración de renderer real.

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] En `tools/generator/obligations.ts`: mismo guard defensivo que ya existe para
  `'black'` (`if (striker === 'black') continue;`), extendido a `'rainbow'` -- sin efecto
  práctico hoy, evita un error de compilación si algún día `availableColors` incluyera arcoíris
  sin querer (research.md Decisión 9).
- [X] T028 [P] Ejecutar `npm run typecheck` -- confirmar que T001 no deja ningún
  `Record<PieceColor, ...>` sin actualizar en el resto del árbol (auditar `PIECE_COLOR`,
  `PUSH_STRATEGY` -- arcoíris no empuja, igual que negro y rojo, así que
  `Record<Exclude<PieceColor,'red'|'black'>,...>` de `PUSH_STRATEGY` gana también `'rainbow'` al
  `Exclude`).
- [X] T029 [P] Ejecutar `npm test` -- confirmar 0 regresiones fuera de los ficheros tocados
  deliberadamente por esta feature.
- [X] T030 Comentarios revisados en `events.ts`/`push.ts`/`resolve-launch.ts`/`session.ts` --
  explican el PORQUÉ del mecanismo de pausa/reanudación (research.md Decisión 1) y referencian
  024-rainbow-color-change/research.md, sin repetir el qué.

## Dependencies & Execution Order

- **Foundational (T001-T010)**: cadena T001→T002→T003→T004→{T005,T006 en paralelo}; T007 depende
  de T003; T008 depende de T007; T009 es independiente (paralelo con cualquiera); T010 cierra la
  fase. Bloquea las cuatro historias.
- **US1 (T011-T017)**: depende de Foundational. Tests (T011-T015) antes que implementación (T016)
  -- deben fallar primero. T017 depende de T016.
- **US2 (T018-T019)**: depende de US1 completa (reutiliza la misma rama de T016). No bloquea nada
  más.
- **US3 (T020-T021)**: depende de US1 completa (misma razón). Independiente de US2.
- **US4 (T022-T026)**: depende de US1 (necesita `ColorChoiceEvent`/`pendingColorChoice` reales
  para tener algo que animar/mostrar). T023 depende de T009, T022. T025 depende de T023, T024.
- **Polish (T027-T030)**: depende de US1, US2, US3 y US4 completas.

### Parallel Opportunities

- T005, T006, T009 son paralelizables entre sí (ficheros distintos) dentro de Foundational.
- T011, T013, T014, T015 son bloques de test independientes entre sí -- paralelizables.
- T018, T020 son paralelizables entre sí (historias distintas, mismo fichero pero casos
  independientes).
- T022 es paralelizable con el resto de US1-US3 (fichero de sonido, sin dependencias de motor).
- T027, T028, T029 son paralelizables entre sí.

## Implementation Strategy

**MVP = US1 (Phases 1-2)**: con eso el comportamiento que define a la pieza (lanzarla pausa la
cadena y cambia un color) queda resuelto y demostrable de forma puramente headless, sin ningún
componente de renderer. US2 (Phase 3) y US3 (Phase 4) son, en la práctica, verificación de que la
MISMA rama de T016 ya generaliza correctamente a "arcoíris como defensora" y "arcoíris contra
arcoíris sigue siendo mismo color" sin código adicional -- igual que ya ocurrió con negro (023).
US4 (Phase 5) es la única fase con superficie de UI real (diálogo, sonido, animación) y depende de
que US1 ya exista para tener algo que mostrar.

**Fuera de alcance de esta feature** (ver plan.md, Technical Context): soporte en
`tools/generator/` para que el generador construya/invierta niveles usando arcoíris -- mismo
patrón que negro (023): motor + renderer primero, generador como feature separada más adelante si
se decide.
