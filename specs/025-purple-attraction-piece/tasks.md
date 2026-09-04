# Tasks: Ficha Púrpura (Atracción)

**Input**: Design documents from `/specs/025-purple-attraction-piece/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla
de interacción de motor, mismo patrón que toda feature de motor anterior.

**Organization**: Por user story (US1 = P1 MVP, US2 = P1 también, US3 = P2, US4 = P3 -- ver
spec.md). Precedida de una fase Foundational deliberadamente pequeña: a diferencia de arcoíris
(024), esta feature no introduce ningún mecanismo de control nuevo en `resolveChain` en sí
(research.md, Decisión 2) -- solo tipos base de los que todo lo demás depende.

## Phase 1: Foundational (bloqueante para las cuatro historias)

**Purpose**: El color nuevo y el campo de sitio nuevo son la base de todo lo demás -- ninguna
historia puede implementarse sin esto. Ninguna tarea de esta fase introduce todavía
comportamiento observable de púrpura.

- [X] T001 En `src/engine/board.ts`: añadir `'purple'` a `PieceColor` (data-model.md, "PieceColor
  (extendida)").
- [X] T002 En `src/engine/pieces/push.ts`: añadir `'purple'` al `Exclude` del tipo de
  `PUSH_STRATEGY` (research.md, Decisión 5) -- púrpura nunca actúa como atacante genérico contra
  una defensora real. Depende de T001. También se añadieron dos invariantes explícitas (mismo
  patrón que black/rainbow) para `site.piece.color === 'purple'`/`strikerSite.piece.color ===
  'purple'` en `applyImpact`/`strikeMutualSide` -- el compilador las exigía en cuanto
  `PUSH_STRATEGY` excluyó `'purple'`.
- [X] T003 En `src/engine/events.ts`: añadir el campo opcional `attracting?: { padSteps: number }`
  a `ImpactSite`, hermano de `walking` (data-model.md, "ImpactSite.attracting"). Sin lógica
  todavía -- solo el tipo. Depende de T001.
- [X] T004 Ejecutar `npm run typecheck` y `npm test` -- confirmar que la fase Foundational
  compila y que ningún test existente cambia de resultado antes de introducir ninguna rama de
  comportamiento real de púrpura. PASÓ (258/258); T022/T023 (Polish) se adelantaron aquí porque
  el compilador los exigía en cuanto `PieceColor` ganó `'purple'` (`Record<PieceColor,...>`
  exhaustivos en `board-view.ts`/`obligations.ts`).

**Checkpoint**: `'purple'` es un color válido en todo el motor, sin ningún comportamiento propio
todavía.

---

## Phase 2: User Story 1 - Lanzar una ficha púrpura hacia una celda cualificada activa la atracción (Priority: P1) 🎯 MVP

**Goal**: Una ficha púrpura lanzada avanza célula a célula hasta la primera celda con ficha a
ambos lados del eje perpendicular, se asienta ahí (desapareciendo), y las dos fichas encontradas
viajan hacia esa celda -- esperándose mutuamente si parten a distinta distancia -- para colisionar
juntas con la misma resolución de choque mutuo ya existente.

**Independent Test**: quickstart.md, Escenario 1 (distancias 3 y 2, verifica tanto el
asentamiento como la espera mutua en el mismo caso).

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] En `tests/unit/engine/purple.test.ts` (fichero nuevo): tests directos de
  `scanPurpleSettle` (aún sin implementar, deben fallar) -- carril vacío que encuentra ficha a
  ambos lados en la primera celda cualificada (varias distancias, incluida una donde un lado tiene
  varias fichas y solo la más cercana debe contar); una celda intermedia con ficha en un solo lado
  no debe detener el escaneo; y un caso con una ficha cerca de un borde del tablero donde el OTRO
  lado del eje perpendicular queda vacío hasta ese borde -- debe fallar como si no hubiera ficha
  en ese lado, nunca envolver buscando por el borde opuesto (spec.md Clarifications, sin
  wrap-around).
- [X] T006 [US1] En `tests/unit/engine/purple.test.ts`: test end-to-end vía `resolveLaunch`
  (quickstart.md Escenario 1) -- `outcome.missclick === false`; `outcome.events` contiene un
  `ANNIHILATION` con `color: 'purple'` en la celda de atracción; las dos fichas encontradas
  (distancias desiguales, p. ej. 3 y 2) terminan colisionando entre sí EN EL MISMO evento de
  choque mutuo -- ninguna se asienta antes por separado. Repetir con distancias iguales y con las
  dos fichas atraídas del mismo color (debe aplicarse la aniquilación por mismo color ya
  existente).

### Implementation for User Story 1

- [X] T007 [P] [US1] En `src/engine/pieces/push.ts`: dentro de `applyImpact`'s `defender === null`
  branch, añadir el caso `site.attracting !== undefined` (hermano del de `site.walking`,
  research.md Decisión 2) -- mientras `padSteps > 0`, decrementar y reencolar sin mover `to` ni
  emitir evento; agotado, avanzar `to` una celda en `site.direction` usando `step`/`isInBounds`
  LLANO (`move-step.ts`) -- SIN `wrapCoordinate` ni tope de vueltas, a diferencia de
  `stepWalking` (marrón): el camino de vuelta cae siempre dentro del tablero por construcción,
  confirmado con el usuario que esta feature no usa wrap-around en ningún punto -- y reencolar
  sin evento hasta que `findCoincidingPair` capture el par en la celda de atracción. Depende de
  T003.
- [X] T008 [US1] Crear `src/engine/pieces/purple.ts`: `scanPurpleSettle(board, entry, direction)`
  (data-model.md) -- avanza célula a célula desde `entry` (usando `step`/`isInBounds` LLANO, sin
  wrap-around, igual que `travelLaunch`); si la celda está ocupada, falla (missclick); si está
  vacía, comprueba el eje perpendicular a `direction` (fila si N/S, columna si E/O) buscando la
  ficha más cercana a cada lado dentro de los límites de esa fila/columna, sin envolver por el
  borde, sin límite de distancia dentro de ese límite; si ambas existen, devuelve
  `{status:'settled', at, leftPiece, rightPiece}`; si sale del tablero sin éxito, falla
  (missclick). Depende de T001.
- [X] T009 [US1] En `src/engine/pieces/purple.ts`: función que, a partir de un resultado
  `'settled'`, construye los dos `ImpactSite` iniciales `attracting` (uno por ficha encontrada,
  `direction` hacia la celda de atracción, `padSteps = distanciaMáxima - distanciaPropia` para
  cada uno, research.md Decisión 2) y el `AnnihilationEvent` de la propia púrpura (`color:
  'purple'`, `at` = celda de atracción, `from`/`direction` desde `entry`, research.md Decisión 3).
  Depende de T007, T008.
- [X] T010 [US1] En `src/engine/resolve-launch.ts`: `resolveLaunch` bifurca al principio por
  `piece.color === 'purple'` -- llama a `scanPurpleSettle` en vez de `travelLaunch`; en éxito,
  arranca `resolveChain` con los dos `ImpactSite` de T009 y el `AnnihilationEvent` ya incluido en
  el `board`/`events` de partida (mismo patrón que arcoíris incluye su propio `ANNIHILATION` antes
  de pausar, 024 research.md Decisión 10); el resultado final se empaqueta como el mismo
  `LaunchOutcome` de siempre (sin `pendingColorChoice` -- púrpura nunca pausa). Depende de T009.
- [X] T011 [US1] Ejecutar `npm run typecheck` y `npm test` -- T005/T006 deben pasar en verde;
  confirmar quickstart.md Escenario 1 manualmente (`npx tsx` contra el motor compilado, mismo
  patrón que sesiones anteriores).

**Checkpoint**: User Story 1 completamente funcional y testeable de forma independiente -- la
atracción funciona, incluida la espera mutua entre distancias desiguales.

---

## Phase 3: User Story 2 - Un lanzamiento de púrpura que no encuentra ninguna celda cualificada se trata como missclick (Priority: P1)

**Goal**: Si el avance de la púrpura se ve bloqueado por una ficha real, o agota el carril sin
encontrar ninguna celda cualificada, todo el lanzamiento se trata como missclick -- sin ningún
cambio en el tablero, la ficha vuelve a la mano.

**Independent Test**: quickstart.md, Escenarios 2 y 3.

### Tests for User Story 2 ⚠️

- [X] T012 [P] [US2] En `tests/unit/engine/purple.test.ts`: `scanPurpleSettle` devuelve
  `{status:'missclick'}` cuando una ficha real bloquea el avance antes de cualquier celda
  cualificada (quickstart.md Escenario 2).
- [X] T013 [P] [US2] En `tests/unit/engine/purple.test.ts`: `scanPurpleSettle` devuelve
  `{status:'missclick'}` cuando el carril se agota sin ninguna celda cualificada, incluido el
  caso borde de una celda con ficha en solo UN lado del eje perpendicular (quickstart.md Escenario
  3).
- [X] T014 [US2] En `tests/unit/engine/purple.test.ts`: test end-to-end vía `resolveLaunch` para
  ambos casos -- `outcome.missclick === true`, `outcome.board`/`outcome.hand` idénticos al estado
  antes del lanzamiento (la ficha nunca se retira de la mano).

### Implementation for User Story 2

- [X] T015 [US2] En `src/engine/resolve-launch.ts`: confirmar/ajustar que la rama de púrpura
  (T010) devuelve, en `scanPurpleSettle` `'missclick'`, EXACTAMENTE el mismo `LaunchOutcome` de
  missclick ya usado por `travelLaunch` (`board`/`hand` del nivel sin tocar, `missclick: true`,
  `events: []`) -- sin ninguna rama nueva de forma, solo reutilizar la ya existente. Depende de
  T010.
- [X] T016 [US2] Ejecutar `npm run typecheck` y `npm test` -- T012-T014 en verde.

**Checkpoint**: User Stories 1 y 2 funcionan juntas -- toda la superficie de comportamiento
principal de púrpura (asentarse o missclick) está cubierta.

---

## Phase 4: User Story 3 - La ficha púrpura solo puede repartirse en la mano, nunca en el tablero de un nivel (Priority: P2)

**Goal**: Confirmar que un nivel puede repartir una ficha púrpura en la mano con fragilidad
`'broken'`, y que el motor no necesita (ni tiene) ningún caso especial para una púrpura ya
asentada en el tablero, porque esa situación nunca se produce.

**Independent Test**: quickstart.md, nivel de prerrequisitos (`hand: [{color:'purple',
fragility:'broken'}]`).

### Tests for User Story 3 ⚠️

- [X] T017 [P] [US3] En `tests/unit/engine/purple.test.ts`: `createLevel` con un `HandPieceInput`
  `{color:'purple', fragility:'broken'}` produce una `Hand` con esa ficha exactamente como
  cualquier otra fragilidad-explícita (mismo mecanismo ya usado por cualquier otro color, FR-008
  de una spec anterior) -- ningún cambio de comportamiento nuevo que probar, solo confirmar que
  `'purple'` no rompe el camino ya genérico de `createLevel`/`HandPieceInput`.

### Implementation for User Story 3

- [X] T018 [US3] Ninguna -- `createLevel`/`HandPieceInput` (`src/engine/level.ts`) ya son
  genéricos sobre `PieceColor` (T001 es la única dependencia real). Esta historia es puramente de
  confirmación/documentación; si T017 pasa sin cambios de código, no hay nada más que hacer.

**Checkpoint**: Confirmado que púrpura no necesita ninguna restricción de tipo nueva -- la
convención "solo en mano" se sostiene por autoría de niveles, igual que negro/arcoíris.

---

## Phase 5: User Story 4 - El impacto de atracción tiene un sonido propio (Priority: P3)

**Goal**: Al activarse la atracción (el asentamiento de la púrpura), suena un efecto propio,
distinto de los sonidos de choque ya existentes.

**Independent Test**: quickstart.md, Escenario 4 (inspección manual del despacho de sonido).

### Implementation for User Story 4

*(Sin tests unitarios -- ningún sonido existente (`playRainbowSound`, `playSplitSound`,
`playJumpSound`) tiene cobertura de test, mismo patrón: la renderización/sonido se valida
manualmente por la constitución.)*

- [X] T019 [P] [US4] En `src/renderer/sound-effects.ts`: nueva función `playPurpleSound()` --
  mismo patrón que `playRainbowSound()`/`playSplitSound()` (research.md Decisión 4), un timbre
  corto y distinto vía la Web Audio API, sin assets.
- [X] T020 [US4] En `src/renderer/launch-animation.ts`: en el despacho de sonido ya existente para
  `ANNIHILATION`, añadir la rama `event.color === 'purple'` → `playPurpleSound()` en vez del
  sonido de impacto genérico. Depende de T019.
- [X] T021 [US4] Verificación manual: lanzar una púrpura que active la atracción (nivel de
  quickstart.md) en el navegador o vía inspección del evento generado, confirmar que suena
  `playPurpleSound()` y no el sonido de impacto genérico.

**Checkpoint**: Las cuatro historias de usuario están completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de la feature, consistencia con el resto del código, sin comportamiento nuevo.

- [X] T022 [P] Adelantada a T004 (el compilador la exigía). En `tools/generator/obligations.ts`: añadir `'purple'` a la comprobación defensiva
  ya existente (`if (striker === 'black' || striker === 'rainbow') continue;`, línea ~148) --
  mismo patrón que negro/arcoíris (fuera de alcance del generador, `availableColors` nunca lo
  contendrá hoy, pero mantiene la guarda coherente si eso cambiara). No es un requisito de tipo
  (`InverseColor` no incluye `'purple'` y no lo necesita), es solo higiene defensiva por
  consistencia con el comentario ya existente.
- [X] T023 [P] Adelantada a T004 (el compilador la exigía). En `src/renderer/board-view.ts`: añadir `'purple'` a `PIECE_COLOR` (un valor
  distinguible de los 6 colores ya existentes, incluido `rainbow`'s violeta) -- se renderiza con
  el `drawPieceCircle` ya existente (fill plano, sin ningún tratamiento especial como el de
  `rainbow`). Depende de T001.
- [X] T024 Ejecutar `npm run typecheck` y `npm test` completos -- confirmar 0 regresiones en toda
  la suite existente (FR-013).
- [X] T025 Ejecutar manualmente los 4 escenarios de quickstart.md contra el motor real (`npx tsx`
  o el dev server), confirmando que las Success Criteria (SC-001 a SC-005) de spec.md se cumplen.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias -- puede empezar inmediatamente. BLOQUEA las
  cuatro historias.
- **User Story 1 (Phase 2)**: depende de Foundational. Es el MVP -- sin ella no hay ninguna
  atracción real que probar.
- **User Story 2 (Phase 3)**: depende de Foundational Y de T008/T010 (Phase 2) -- reutiliza
  `scanPurpleSettle` y la bifurcación de `resolveLaunch` ya construidas para US1, así que en la
  práctica no es independiente de la implementación (aunque sí de sus TESTS, que podrían
  escribirse en paralelo). Secuenciar después de Phase 2.
- **User Story 3 (Phase 4)**: depende solo de Foundational (T001) -- genuinamente independiente,
  puede hacerse en paralelo con Phase 2/3.
- **User Story 4 (Phase 5)**: depende de que exista un `AnnihilationEvent` con `color:'purple'`
  real que disparar (Phase 2, T009/T010) -- secuenciar después de Phase 2.
- **Polish (Phase 6)**: depende de que todas las historias deseadas estén completas.

### Parallel Opportunities

- T001-T003 (Foundational) son mayormente secuenciales (tipos que se apoyan unos en otros) salvo
  que T002/T003 podrían hacerse en paralelo si se coordina el conflicto de archivo (`push.ts` vs
  `events.ts`, sin conflicto real).
- T005 (tests de `scanPurpleSettle`) puede escribirse en paralelo con T007 (rama `attracting` de
  `push.ts`) -- archivos distintos.
- Phase 4 (US3) completa puede hacerse en paralelo con Phase 2/3 en cuanto Phase 1 termina.
- T019 (sonido) puede escribirse en paralelo con cualquier tarea de Phase 2-4 -- archivo propio,
  sin dependencias de comportamiento hasta T020.
- T022/T023 (Polish) son independientes entre sí.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Foundational.
2. Completar Phase 2: User Story 1 -- la atracción, incluida la espera mutua, funciona de punta a
   punta.
3. **PARAR Y VALIDAR**: quickstart.md Escenario 1, `npm test` en verde.
4. Ya hay una pieza jugable, aunque todo lanzamiento "sin suerte" hoy fallaría silenciosamente
   como missclick genérico solo por casualidad (Phase 3 lo hace explícito y lo prueba).

### Incremental Delivery

1. Foundational → Phase 2 (US1, MVP) → validar independientemente.
2. Phase 3 (US2) → el comportamiento de missclick queda probado explícitamente, no solo por
   casualidad de que `scanPurpleSettle` ya lo produce.
3. Phase 4 (US3) → puede intercalarse en cualquier momento tras Foundational.
4. Phase 5 (US4) → mejora de feedback, no bloquea nada más.
5. Phase 6 (Polish) → cierre.
