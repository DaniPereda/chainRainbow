---

description: "Task list template for feature implementation"
---

# Tasks: Selección Libre de Ficha en Mano

**Input**: Design documents from `/specs/010-hand-piece-selection/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No opcionales para la parte de motor (Principio II, NON-NEGOTIABLE) — la lógica de
selección es determinista y se prueba en aislamiento. La parte de renderer (anillo de resaltado,
zonas táctiles) se valida manualmente, mismo criterio ya establecido para `board-view.ts`/
`hand-panel.ts` (ver quickstart.md).

**Organization**: 3 historias de usuario (US1 P1, US2 P2, US3 P2), en el mismo orden que
spec.md. Toda la lógica de sesión (`selectHandPiece`, avance/preservación/reset) se construye
dentro de US1, incluido lo necesario para que el jugador pueda TOCAR una ficha del panel — US2
añade únicamente el anillo visual sobre ese mismo mecanismo; US3 verifica los casos de ciclo de
vida de esa misma implementación, sin código propio, mismo patrón ya usado en las features
007/008/009.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Cambios en `src/engine/launch.ts`, `src/engine/resolve-launch.ts`,
`src/engine/session.ts`, `src/renderer/hand-panel.ts`, `src/renderer/scenes/BoardScene.ts`, y
los tests de motor correspondientes (`tests/unit/engine/launch.test.ts`,
`tests/unit/engine/session.test.ts`).

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Generalizar "extraer una ficha de la mano" de "siempre la primera" a "una posición
cualquiera", sin cambiar ningún comportamiento todavía — prepara el terreno para que US1 pueda
añadir la capacidad real de elegir.

**⚠️ CRITICAL**: Ninguna historia empieza hasta cerrar esta fase.

- [ ] T001 En `src/engine/launch.ts`, renombrar/generalizar `takeFirstPiece(hand)` a
      `takePieceAt(hand: Hand, index: number)` (extrae la ficha en `index`, conserva el orden
      relativo del resto). Actualizar su único call site en `src/engine/resolve-launch.ts` a
      `takePieceAt(level.hand, 0)` — CERO cambio de comportamiento todavía, confirmado porque
      toda la suite existente sigue en verde sin tocar ningún test.

**Checkpoint**: `takePieceAt` existe y todo sigue comportándose exactamente igual que antes —
las historias pueden empezar.

---

## Phase 2: User Story 1 - Elegir qué ficha lanzar, no solo la primera de la cola (Priority: P1) 🎯 MVP

**Goal**: El jugador puede marcar cualquier ficha de la mano como la que se usará en el próximo
lanzamiento, y el motor la usa de verdad — no solo la primera de la cola.

**Independent Test**: Fixtures 1, 2, 3, 4 y 5 de data-model.md — `selectHandPiece` cambia la
selección (o no-op si la posición no existe); `resolveLaunch` con un `pieceIndex` no-cero usa
esa ficha concreta, de forma determinista; `applySessionLaunch` propaga la selección de sesión
sin que el llamador tenga que pasar nada más.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [ ] T002 [P] [US1] Fixtures 1 y 2 de data-model.md en `tests/unit/engine/session.test.ts`:
      `selectHandPiece` cambia la selección a una posición válida; una posición fuera de rango es
      un no-op. Fallará hasta T005 (`selectHandPiece` no existe todavía).
- [ ] T003 [P] [US1] Fixtures 3 y 4 de data-model.md en `tests/unit/engine/launch.test.ts`:
      `resolveLaunch(level, launch, 1)` usa `hand.pieces[1]`, no `[0]`; mismo resultado en dos
      resoluciones (determinismo). Fallará hasta T004 (`resolveLaunch` no acepta `pieceIndex`
      todavía).
- [ ] T004 [US1] En `src/engine/resolve-launch.ts`, `resolveLaunch` gana el parámetro
      `pieceIndex: number = 0`; usa `level.hand.pieces[pieceIndex]` como la ficha del
      `ImpactSite`, y `takePieceAt(level.hand, pieceIndex)` en vez de índice fijo. Depende de
      T001. Hace pasar T003.
- [ ] T005 [US1] En `src/engine/session.ts`: `LevelSession` gana `selectedHandIndex: number |
      null`; nueva `selectHandPiece(session, index)` (no-op si `index` es inválido);
      `startSession` inicializa `selectedHandIndex` (`0` si la mano no está vacía, si no
      `null`); `applySessionLaunch` pasa `session.selectedHandIndex ?? 0` como `pieceIndex` a
      `resolveLaunch`, y tras el resultado actualiza `selectedHandIndex` (sin cambios si hubo
      missclick; si no, `0` o `null` según quede o no mano restante); `restartSession` resetea
      `selectedHandIndex` igual que `startSession(session.initial)`. Depende de T004. Hace pasar
      T002.
- [ ] T006 [US1] Fixture 5 de data-model.md en `tests/unit/engine/session.test.ts`:
      `applySessionLaunch`, tras `selectHandPiece(session, 1)`, resuelve el lanzamiento usando
      automáticamente esa ficha, sin que el llamador pase `pieceIndex` a mano. Depende de T005 —
      verificación de que la composición end-to-end funciona.

### Implementation for User Story 1

- [ ] T007 [US1] En `src/renderer/hand-panel.ts`, `drawHand` gana el parámetro
      `selectedIndex: number | null` y devuelve el centro local `{x, y}` de cada ficha dibujada,
      mismo orden que `hand.pieces` (sin dibujar el anillo todavía — eso es US2). Depende de
      T005 (necesita que `LevelSession`/el tipo de selección ya exista para que el parámetro
      tenga sentido).
- [ ] T008 [US1] En `src/renderer/scenes/BoardScene.ts`: nuevo campo privado `handHitZones:
      Phaser.GameObjects.Zone[]`; en `redraw()`, tras llamar a `drawHand` (ahora devuelve
      posiciones), destruir las zonas anteriores y crear una zona interactiva por ficha en la
      posición mundial correspondiente (origen del panel + posición local devuelta), con
      `pointerdown` → `this.session = selectHandPiece(this.session, index); this.redraw();`.
      Ningún cambio en los marcadores de borde ni en `launch()`. Depende de T007.
- [ ] T009 [US1] Ejecutar `npm test && npm run typecheck`: confirmar que T002, T003 y T006 pasan
      (verde) y que el resto de suites del motor (verde, naranja, marrón, rojo, mismo color,
      wrap-around, niveles del prototipo) siguen en verde sin cambios de comportamiento. Depende
      de T004, T005.

**Checkpoint**: El jugador ya puede tocar cualquier ficha del panel y lanzarla — sin indicador
visual todavía (US2) — MVP de esta feature completo.

---

## Phase 3: User Story 2 - Saber en todo momento qué ficha se lanzaría (Priority: P2)

**Goal**: El panel muestra, con una indicación visual distinta al resto, cuál ficha está
actualmente marcada — sin necesitar que el jugador lo recuerde ni lo deduzca.

**Independent Test**: Cargar un nivel con varias fichas en mano; sin tocar nada, ver la primera
marcada por defecto; tocar otra y ver que el anillo se mueve a esa.

### Implementation for User Story 2

- [ ] T010 [US2] En `src/renderer/hand-panel.ts`, `drawHand` dibuja un anillo de resaltado
      alrededor de la ficha en `selectedIndex` (si no es `null`): `lineStyle(3,
      HAND_SELECTION_RING_COLOR, 1)` + `strokeCircle`, radio `PIECE_RADIUS + 4`.
      `HAND_SELECTION_RING_COLOR = 0xffee58` — mismo grosor de trazo que el anillo de objetivo
      del tablero, pero con un color de acento fijo (no el color de la propia ficha, que ya
      ocupa el relleno y no daría contraste consigo mismo — research.md). Depende de T007 (ya
      acepta el parámetro `selectedIndex`; esta tarea añade el dibujo).
- [ ] T011 [US2] Verificación manual (quickstart.md pasos 1-3): entrar a un nivel con 2+ fichas
      sin tocar nada y ver la primera marcada por defecto (FR-005); tocar la segunda y ver que el
      anillo se mueve (FR-004). Depende de T010.

**Checkpoint**: El jugador ve en todo momento cuál ficha se lanzaría — las historias 1 y 2
funcionan juntas.

---

## Phase 4: User Story 3 - La selección se mantiene coherente tras cada lanzamiento (Priority: P2)

**Goal**: Tras cualquier lanzamiento (con o sin missclick) o un reinicio, la selección sigue
apuntando a una ficha real y disponible, nunca a una que ya se usó o que nunca existió.

**Independent Test**: Fixtures 6, 7, 8 y 9 de data-model.md — avance automático tras consumir la
ficha marcada, selección intacta tras un missclick, `null` cuando la mano se vacía, y reseteo al
reiniciar.

### Implementation for User Story 3

- [ ] T012 [US3] Fixtures 6, 7 y 8 de data-model.md en `tests/unit/engine/session.test.ts`: tras
      un lanzamiento no-missclick que consume la ficha marcada, la selección avanza a la primera
      restante; un missclick no cambia la mano ni la selección; con una sola ficha en mano, tras
      lanzarla la selección queda en `null`. Depende de T005 — verificación pura de la misma
      implementación de US1, sin código nuevo (igual que las features 007/008/009).
- [ ] T013 [US3] Fixture 9 de data-model.md en `tests/unit/engine/session.test.ts`:
      `restartSession` resetea `selectedHandIndex` exactamente al mismo estado que
      `startSession(session.initial)` produciría. Depende de T005 — verificación pura.

**Checkpoint**: Las 3 historias funcionan juntas — selección libre de ficha completa.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Verificación manual (quickstart.md pasos 4-7): avance visible del anillo tras un
      lanzamiento; selección intacta visible tras un missclick; el anillo vuelve a la primera
      ficha tras reiniciar; los 11 niveles de una sola ficha en mano se siguen jugando con un
      solo toque en el borde (SC-003), sin necesitar tocar el panel primero. Depende de T010.
- [ ] T015 Ejecutar `npm test && npm run typecheck && npm run build`: confirmar el recuento final
      de suites/tests y que `BoardScene.ts`/`hand-panel.ts` siguen compilando tras los cambios de
      firma. Depende de T009, T012, T013.
- [ ] T016 Verificar que `src/engine/` sigue sin importar nada de `src/renderer/` ni de
      `phaser` — mismo `grep` de siempre.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias — bloquea las 3 historias.
- **User Story 1 (Phase 2)**: depende de Foundational. T002/T003 (tests) pueden escribirse en
  paralelo entre sí, pero no pasarán hasta T004/T005; T004 depende de T001; T005 depende de T004;
  T006 depende de T005; T007 depende de T005; T008 depende de T007; T009 depende de T004 y T005.
- **User Story 2 (Phase 3)**: depende de T007 (US1) — añade el dibujo sobre un parámetro que ya
  existe, no toca lógica de motor.
- **User Story 3 (Phase 4)**: depende de T005 (US1) — reutiliza la misma implementación, no
  añade código.
- **Polish (Final Phase)**: T014 depende de T010; T015 depende de que las 3 historias estén
  cerradas; T016 no tiene dependencias de código, solo debe correr al final.

### Parallel Opportunities

- T002 y T003 (tests de US1) pueden escribirse en paralelo — ficheros de test distintos.
- T012 y T013 (US3) pueden ejecutarse en paralelo entre sí una vez cerrada US1 — ambas son
  verificación de solo lectura sobre la misma implementación.
- T014 (Polish, verificación manual) puede ir en paralelo a T012/T013 por el mismo motivo.

---

## Parallel Example: al empezar User Story 1

```bash
# En paralelo, tras cerrar Foundational (T001):
Task: "session.test.ts: selectHandPiece válido + fuera de rango (T002, US1)"
Task: "launch.test.ts: resolveLaunch con pieceIndex no-cero + determinismo (T003, US1)"
```

## Parallel Example: tras cerrar User Story 1

```bash
# En paralelo, una vez existe T005:
Task: "session.test.ts: avance/preservación/vacío (T012, US3)"
Task: "session.test.ts: reset en restartSession (T013, US3)"
Task: "Verificación manual quickstart.md pasos 4-7 (T014, Polish)"
```

---

## Implementation Strategy

### MVP (Foundational + User Story 1)

1. Fase 1: `takePieceAt` existe, cero cambio de comportamiento.
2. Fase 2: el jugador puede tocar cualquier ficha del panel y lanzarla — el motor la usa de
   verdad. **STOP y VALIDAR** (T009) — la razón de ser de esta feature ya está hecha y probada,
   aunque todavía sin indicador visual.

### Entrega incremental

1. Foundational + User Story 1 → selección libre funciona de extremo a extremo (MVP, aunque sin
   resaltado visual).
2. + User Story 2 → el jugador ve en todo momento cuál ficha se lanzaría.
3. + User Story 3 → confirmado que la selección se mantiene coherente en todo el ciclo de vida
   de una partida (avance, missclick, mano vacía, reinicio).
4. Polish → verificación manual completa, regresión completa, límite engine↔renderer.

---

## Notes

- No hay Setup separado de Foundational — es un cambio quirúrgico contenido en un único fichero
  (`launch.ts`) sin ningún cambio de comportamiento.
- Commitear tras cada tarea o grupo lógico.
