---

description: "Task list template for feature implementation"
---

# Tasks: Prototipo Frontend de Niveles

**Input**: Design documents from `/specs/005-frontend-prototype/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-renderer-boundary.md,
quickstart.md (todos presentes)

**Tests**: Se incluyen tareas de test para todo lo que cuenta como "engine logic" en sentido
amplio (Principio II, NON-NEGOTIABLE) — el renombrado de `createLevel`, los 10 niveles del
prototipo, y `session.ts`. Las escenas de Phaser (`src/renderer/`) NO llevan tareas de test
automatizado — la constitución lo permite explícitamente para el prototipo inicial; se validan
manualmente vía quickstart.md, con una tarea de validación manual al final de cada historia.

**Organization**: 3 historias de usuario (US1 P1, US2 P2, US3 P3), en el mismo orden de
prioridad que spec.md.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Se añaden `src/levels/`, `src/renderer/`, `index.html` y
`vite.config.ts` en la raíz — ver plan.md → Project Structure.

---

## Phase 1: Setup

**Purpose**: Preparar el build web (inexistente hasta ahora — el proyecto solo tenía el motor
headless).

- [X] T001 Añadir `phaser` y `vite` a `package.json` (dependencies/devDependencies según
      corresponda) y los scripts npm `dev` (`vite`) y `build` (`vite build`). Ejecutar
      `npm install`.
- [X] T002 [P] Crear `vite.config.ts` en la raíz del repo (config mínima: root del proyecto,
      sin plugins adicionales todavía).
- [X] T003 [P] Crear `index.html` en la raíz del repo como entry point de Vite, cargando
      `src/renderer/main.ts` como módulo.

**Checkpoint**: `npm run dev` levanta un servidor Vite (aunque `main.ts` todavía no exista hasta
T011 — falla de import esperada y transitoria hasta cerrar la Fase 3).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lo que las 3 historias necesitan por igual: el nombre correcto del builder de
niveles y los 10 niveles del prototipo ya definidos.

**⚠️ CRITICAL**: Ninguna historia empieza hasta cerrar esta fase.

- [X] T004 En `src/engine/level.ts`, renombrar `createTestLevel` → `createLevel` (mismo cuerpo,
      mismo tipo `Level`), actualizar sus 5 usos internos (`testLevelGreen01`,
      `testLevelOrange01`, `testLevelSameColor01`, `testLevelSameColorCascade01`,
      `testLevelWrapToEmpty01`), y actualizar el export en `src/engine/index.ts`
      (`createLevel` en vez de `createTestLevel`). Ejecutar `npm test && npm run typecheck` y
      confirmar que las suites existentes del motor siguen en verde sin cambios de
      comportamiento — es un renombrado puro (data-model.md). *(Hallazgo durante la
      implementación: `tests/unit/engine/support/levels.ts` también importaba
      `createTestLevel` directamente — no listado en el análisis original; actualizado también.)*
- [X] T005 [P] Tests estructurales de los 10 niveles del prototipo (10 entradas, ids 1-10
      únicos, tablero 8×8, al menos una ficha en mano, objetivo dentro del tablero, solo colores
      `'green'`/`'orange'`) en `tests/unit/levels/prototype-levels.test.ts`. Fallará por falta de
      `prototype-levels.ts` hasta T006.
- [X] T006 Crear `src/levels/prototype-levels.ts` exportando `PrototypeLevel` (`{id, level}`) y
      `PROTOTYPE_LEVELS` con los 10 niveles, cada uno construido con `createLevel` y usando
      únicamente piezas/reglas de Fase 1 (data-model.md). Depende de T004. Hace pasar T005.
      *(Winnability de los 10 verificada con un script temporal que ejecuta `resolveLaunch` con
      el lanzamiento previsto para cada uno -- todos alcanzan `'won'`; script descartado tras
      confirmarlo, no forma parte de la suite permanente.)*

**Checkpoint**: `createLevel` + los 10 niveles existen y están probados — las historias pueden
empezar.

---

## Phase 3: User Story 1 - Seleccionar y ver un nivel (Priority: P1) 🎯 MVP

**Goal**: Pantalla de inicio → selector de 10 niveles → tablero renderizado fielmente al elegir
uno.

**Independent Test**: `npm run dev`, recorrer los 10 niveles desde el selector y comprobar
visualmente que cada tablero mostrado coincide con su definición en `prototype-levels.ts`
(posición/color de cada ficha, casilla/color objetivo) — sin que el lanzamiento de fichas
funcione todavía.

### Implementation for User Story 1

- [X] T007 [P] [US1] Crear `src/renderer/board-view.ts`: función pura que traduce un `Board` +
      `Objective` (del motor) a primitivas dibujables de Phaser — rectángulos para la
      cuadrícula 8×8, círculos de color por `PieceColor` para cada `Piece`, marca distintiva
      para la casilla objetivo (data-model.md).
- [X] T008 [P] [US1] Crear `src/renderer/scenes/StartScene.ts`: pantalla de inicio con una
      acción que transiciona a `LevelSelectScene`.
- [X] T009 [US1] Crear `src/renderer/scenes/LevelSelectScene.ts`: cuadrícula/lista con los 10
      niveles de `PROTOTYPE_LEVELS` (numerados 1-10); al elegir uno, transiciona a `BoardScene`
      pasándole ese nivel.
- [X] T010 [US1] Crear `src/renderer/scenes/BoardScene.ts` (alcance de esta historia: solo
      renderizado): al recibir un nivel, dibuja su tablero 8×8 con `board-view.ts` (T007),
      reflejando fielmente fichas y objetivo (FR-004), y añade una acción siempre visible para
      volver a `LevelSelectScene` (T009) en cualquier momento, no solo tras un resultado
      (FR-014, US1 Acceptance Scenario 3). El lanzamiento de fichas se añade en US2 (T016) sobre
      este mismo fichero.
- [X] T011 [US1] Crear `src/renderer/main.ts`: bootstrap de `Phaser.Game` registrando
      `StartScene`, `LevelSelectScene`, `BoardScene` (T008-T010), arrancando en `StartScene`.
- [ ] T012 [US1] Validación manual: `npm run dev`, recorrer los 10 niveles desde el selector,
      confirmar que cada tablero coincide con su definición, y confirmar que la acción de volver
      al selector (T010) funciona desde el tablero sin haber lanzado nada todavía (FR-014)
      (quickstart.md, paso US1). *(NO verificado por el agente — no hay navegador disponible en
      esta sesión. Sí verificado en su lugar: `npm run typecheck`, `npm run build`, y que Vite
      sirve/transforma sin error los 4 módulos nuevos (`main.ts` + las 3 escenas) — confirma que
      el grafo de módulos y el bootstrap son correctos, pero NO prueba el comportamiento visual/
      interactivo real. Pendiente de que un humano lo recorra en el navegador.)*

**Checkpoint**: User Story 1 funcional e independientemente verificable — selector + render
fiel de los 10 niveles.

---

## Phase 4: User Story 2 - Lanzar una ficha y ver la cadena resuelta (Priority: P2)

**Goal**: Desde un nivel cargado, lanzar una ficha (tocando un punto del borde) y ver el
tablero reflejar el estado final que resuelve el motor.

**Independent Test**: Con un nivel ya cargado (US1), lanzar con una dirección/carril conocidos y
comprobar que el tablero resultante coincide con lo que el motor resuelve para ese mismo
lanzamiento — incluyendo el caso de missclick (el tablero no cambia, la ficha sigue en mano).

### Tests for User Story 2 ⚠️ escribir primero, deben fallar antes de implementar

- [ ] T013 [P] [US2] Tests de `LevelSession` en `tests/unit/engine/session.test.ts`: lanzar
      actualiza `current`/`status`; un missclick no cambia `current` y deja `status` en
      `'undetermined'`; alcanzar el objetivo produce `status: 'won'`; vaciar la mano sin
      objetivo produce `status: 'lost'`; `restartSession` reproduce exactamente `initial`
      (data-model.md). Fallará por falta de `session.ts` hasta T014.

### Implementation for User Story 2

- [ ] T014 [US2] Crear `src/engine/session.ts`: `LevelSession`, `startSession`,
      `applySessionLaunch`, `restartSession`, tal como los define data-model.md (usa
      `resolveLaunch` ya existente sin modificarlo). Depende de T004. Hace pasar T013.
- [ ] T015 [US2] Actualizar `src/engine/index.ts` para exportar `LevelSession`, `startSession`,
      `applySessionLaunch`, `restartSession`. Depende de T014.
- [ ] T016 [US2] Extender `src/renderer/scenes/BoardScene.ts` (T010): dibujar las 32 casillas
      tocables/clicables justo fuera del tablero (8 por lado), cada una codificando
      `{direction, lane}` (research.md); al tocar una, llamar a `applySessionLaunch` (T015) y
      redibujar el tablero desde `session.current.board` vía `board-view.ts` (T007) — nunca
      recalcular ni reinterpretar el resultado del motor (FR-006, FR-013; contrato
      engine-renderer-boundary.md). Depende de T010, T015.
- [ ] T017 [US2] Validación manual: en un nivel con al menos una ficha en mano, lanzar hacia una
      ficha real y confirmar que el tablero refleja el estado final del motor; lanzar hacia un
      borde vacío (missclick) y confirmar que el tablero no cambia (quickstart.md, paso US2).

**Checkpoint**: User Stories 1 y 2 funcionan juntas — se puede cargar un nivel y jugarlo hasta
que el motor lo resuelva.

---

## Phase 5: User Story 3 - Resultado y reinicio (Priority: P3)

**Goal**: Ventana de éxito/fallo tras un lanzamiento decisivo, con opción de reiniciar el nivel
o volver al selector.

**Independent Test**: Jugando hasta `'won'` en un nivel y hasta `'lost'` en otro, comprobar que
aparece la ventana correspondiente en cada caso, y que "reiniciar" y "volver al selector" llevan
al estado esperado desde ella.

### Implementation for User Story 3

- [ ] T018 [US3] Añadir un overlay de resultado (dentro de `src/renderer/scenes/BoardScene.ts`
      o como escena superpuesta separada) que se muestra cuando `session.status` es `'won'` o
      `'lost'` tras un lanzamiento (T016), y permanece oculto cuando es `'undetermined'`
      (FR-007, FR-008, FR-009). Depende de T016.
- [ ] T019 [US3] Conectar la acción "reiniciar" del overlay a `restartSession` (T015),
      redibujando el tablero desde el nuevo `session.current.board` (FR-010). Depende de T018.
- [ ] T020 [US3] Conectar la acción "volver al selector" del overlay a una transición hacia
      `LevelSelectScene` (T009) (FR-011). Depende de T018.
- [ ] T021 [US3] Validación manual: jugar un nivel hasta `'won'` y otro hasta `'lost'`,
      confirmar que aparece la ventana correspondiente en cada caso, que "reiniciar" deja el
      tablero exactamente como al entrar al nivel, y que "volver al selector" regresa a la
      lista de 10 (quickstart.md, paso US3).

**Checkpoint**: Las 3 historias funcionan juntas — el prototipo completo de Fase 2 es jugable de
principio a fin.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [ ] T022 Ejecutar `npm test && npm run typecheck`: confirmar que las suites existentes del
      motor (incluidas `session.test.ts` y `prototype-levels.test.ts`) pasan en verde y que el
      renombrado `createLevel` no cambió ningún comportamiento. Depende de T005, T006, T013,
      T014.
- [ ] T023 Verificar que `src/engine/` (incluido `session.ts`) sigue sin importar nada de
      `src/renderer/` ni de `phaser` — mismo `grep` de imports externos usado en features
      anteriores (contracts/engine-renderer-boundary.md). Depende de T014.
- [ ] T024 Recorrer el checklist completo de "Criterio de hecho" de quickstart.md: los 10
      niveles jugados manualmente hasta `'won'` al menos una vez cada uno (SC-003), y las 3
      historias de usuario recorridas de principio a fin en el navegador. Depende de T012, T017,
      T021, T022, T023.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup. Bloquea las 3 historias.
- **User Story 1 (Phase 3)**: depende de Foundational. No depende de US2/US3.
- **User Story 2 (Phase 4)**: depende de Foundational; T016 depende además de T010 (US1) porque
  extiende el mismo fichero `BoardScene.ts` — por eso US2 no es 100% independiente de US1 en
  código (sí lo es en el criterio de test), igual que documenta spec.md.
- **User Story 3 (Phase 5)**: depende de Foundational; T018 depende de T016 (US2) por el mismo
  motivo — el overlay de resultado solo tiene sentido una vez existe un lanzamiento que resolver.
- **Polish (Final Phase)**: depende de que las 3 historias estén cerradas.

### Within Each User Story

- US1: `board-view.ts` y `StartScene.ts` (T007, T008) son independientes entre sí;
  `LevelSelectScene.ts` (T009) y `BoardScene.ts` (T010) se apoyan en lo anterior; `main.ts`
  (T011) cierra la historia registrando las 3 escenas.
- US2: el test (T013) se escribe primero y falla hasta que `session.ts` (T014) existe;
  `index.ts` (T015) expone esa API; `BoardScene.ts` (T016) la consume.
- US3: T018 (overlay) antes que T019/T020 (sus dos acciones), porque ambas cuelgan de él.

### Parallel Opportunities

- T002 y T003 (Setup) — ficheros distintos, sin dependencia entre sí.
- T005 (test) puede escribirse en paralelo a T004 (rename) — fichero distinto — aunque no
  pasará hasta que T006 exista.
- T007 y T008 (US1) — ficheros distintos, sin dependencia entre sí.
- T013 (test de sesión) puede escribirse en paralelo al resto de US1 — fichero distinto, aunque
  no pasará hasta T014.

---

## Parallel Example: Foundational

```bash
# En paralelo, tras cerrar el Setup:
Task: "level.ts: renombrar createTestLevel -> createLevel (T004)"
Task: "prototype-levels.test.ts: tests estructurales de los 10 niveles (T005)"
```

## Parallel Example: User Story 1

```bash
# En paralelo, tras cerrar el Foundational:
Task: "board-view.ts: traducir Board/Objective a primitivas Phaser (T007)"
Task: "StartScene.ts: pantalla de inicio (T008)"
```

---

## Implementation Strategy

### MVP (User Story 1 sola)

1. Fase 1: Setup (Vite + Phaser instalados y arrancando).
2. Fase 2: Foundational (`createLevel` + los 10 niveles, probados).
3. Fase 3: User Story 1 — selector + render fiel. **STOP y VALIDAR** (T012).
4. Con eso ya hay algo demostrable: un catálogo navegable de los 10 niveles del prototipo.

### Entrega incremental

1. Setup + Foundational → base lista.
2. + User Story 1 → demo del selector/render (MVP).
3. + User Story 2 → el prototipo ya es jugable de verdad.
4. + User Story 3 → cierra el bucle de juego (éxito/fallo/reinicio) — feature completa.
5. Siguiente incremento del roadmap: Fase 3 de la constitución (marrón, rojo), una vez validado
   este prototipo.

---

## Notes

- Ninguna tarea de este documento modifica el comportamiento de `resolveLaunch` ni de ninguna
  regla de colisión ya existente — solo las consume. Las 8 suites existentes del motor
  (`launch`, `chain`, `objective`, `determinism`, `orange`, `same-color`, `wrap-around`,
  `move-step`) no deberían necesitar ningún cambio de contenido, solo seguir pasando tras el
  renombrado T004.
- Commitear tras cada tarea o grupo lógico.
