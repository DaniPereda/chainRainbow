---

description: "Task list template for feature implementation"
---

# Tasks: Lanzamiento y Cadena de Ficha Verde (Walking Skeleton)

**Input**: Design documents from `/specs/001-green-piece-launch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-api.md, quickstart.md (todos presentes)

**Tests**: Esta feature tiene exactamente una historia de usuario (US1, P1). Los tests **no son
opcionales**: el Principio II de la constitución ("Test-First Engine Logic", NON-NEGOTIABLE)
exige que cada regla del motor tenga tests antes de darse por implementada. Las cuatro suites se
escriben primero contra la API pública descrita en `contracts/engine-api.md` y deben fallar
(estado rojo) hasta que la implementación de la historia esté completa.

**Organization**: Al haber una única historia de usuario, Setup y Foundational cubren los
primitivos compartidos (tipos base, MOVE_STEP) y la Fase 3 (US1) contiene el resto — tests
primero, implementación después — hasta cerrar el walking skeleton completo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (ficheros distintos, sin dependencias entre sí)
- **[Story]**: US1 para toda tarea de la Fase 3
- Cada tarea incluye la ruta exacta del fichero afectado

## Path Conventions

Proyecto único en la raíz del repo (ver plan.md → Structure Decision):

```text
package.json / tsconfig.json / vitest.config.ts
src/engine/
tests/unit/engine/
```

---

## Phase 1: Setup

**Purpose**: Inicializar el proyecto TypeScript/Vitest sobre el que vive todo lo demás.

- [X] T001 Crear la estructura de carpetas `src/engine/`, `src/engine/pieces/` y
      `tests/unit/engine/` en la raíz del repo, según `plan.md` → Project Structure.
- [X] T002 Inicializar `package.json` en la raíz (nombre `chained-rainbow`, `"private": true`,
      `"type": "module"`) e instalar `typescript` y `vitest` como devDependencies. Sin
      dependencias de runtime (Constitution → Technology Stack Requirements).
- [X] T003 [P] Configurar `tsconfig.json` en la raíz: `strict: true`, `target: "ES2022"`,
      `module: "NodeNext"`, `rootDir: "."`, incluyendo `src` y `tests`.
- [X] T004 [P] Configurar `vitest.config.ts` en la raíz apuntando a `tests/unit/**/*.test.ts`.
- [X] T005 [P] Añadir scripts `"test": "vitest run"` y `"typecheck": "tsc --noEmit"` a
      `package.json`.

**Checkpoint**: `npm test` corre (sin tests todavía) y `npm run typecheck` no falla.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Los primitivos que el resto del motor compone (Principio V de la constitución):
representación del tablero y la primitiva MOVE_STEP. Nada de la Fase 3 puede implementarse sin
esto.

**⚠️ CRITICAL**: No iniciar la Fase 3 (implementación) hasta cerrar esta fase. Los tests de la
Fase 3 sí pueden escribirse antes (solo importan tipos/funciones que aún no existen).

- [X] T006 [P] Definir `Coordinate`, `PieceColor` (`'green'`), `Piece` y `Board`, junto con
      helpers puros `createBoard()`, `isInBounds(coord)`, `getPieceAt(board, coord)`,
      `setPieceAt(board, coord, piece)` (devuelve un `Board` nuevo, sin mutar el recibido) en
      `src/engine/board.ts`. (data-model.md → Board)
- [X] T007 Implementar la primitiva `moveStep(board, from, direction, collision)` con política de
      colisión `true`/`false` en `src/engine/move-step.ts`. Con `collision=false` ignora
      ocupación; con `collision=true` devuelve si el destino estaba ocupado para que el llamador
      dispare la interacción correspondiente. No muta el `Board` recibido. Depende de T006.

**Checkpoint**: `board.ts` y `move-step.ts` compilan y tienen tipos completos — la Fase 3 puede
empezar.

---

## Phase 3: User Story 1 - Lanzar una ficha verde y resolver un nivel de un solo lanzamiento (Priority: P1) 🎯 MVP

**Goal**: Un jugador lanza su única ficha verde en una dirección; el motor resuelve la cadena de
eventos hasta estado estable y expone si el nivel se ha ganado o perdido — todo headless, sin
interfaz (ver Clarifications de spec.md).

**Independent Test**: Ejecutar `resolveLaunch(testLevelGreen01, { direction })` con las
direcciones del fixture y comprobar, vía las cuatro suites de test, que missclick, cadena,
objetivo y determinismo se comportan según `contracts/engine-api.md` — sin ninguna otra ficha,
regla ni interfaz visual.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T008 [P] [US1] Tests de viaje y missclick (FR-001, FR-002, FR-003; Acceptance Scenario 1)
      contra `resolveLaunch` y `testLevelGreen01` en `tests/unit/engine/launch.test.ts`, según la
      tabla de verificación de `contracts/engine-api.md`.
- [X] T009 [P] [US1] Tests de interacción y cola de eventos (FR-004, FR-005; Acceptance Scenario 2)
      en `tests/unit/engine/chain.test.ts` — verifica que `outcome.events` contiene la secuencia
      completa de `MOVE_STEP` aplicados y que la cadena queda vacía (estado estable) antes de que
      `resolveLaunch` retorne. No se incluye una aserción específica para FR-006/Acceptance
      Scenario 5 ("el objetivo nunca se evalúa a mitad de cadena"): con la ficha verde, la cadena
      tiene como máximo un evento, así que no hay un estado intermedio observable distinto del
      final contra el que afirmar nada. Esa comprobación se añade cuando exista una ficha con
      cadenas de varios eventos (p. ej. marrón, con repetición de MOVE_STEP) en una historia
      posterior.
- [X] T010 [P] [US1] Tests de objetivo, derrota y reinicio (FR-007, FR-008, FR-009, FR-010;
      Acceptance Scenarios 3, 4 y 6) en `tests/unit/engine/objective.test.ts` — incluye el caso de
      missclick con mano agotada → `result === 'lost'`, y que invocar `resolveLaunch` de nuevo
      sobre el `Level` original reinicia correctamente (sin mutación previa).
- [X] T011 [P] [US1] Tests de determinismo (FR-011; SC-004) en
      `tests/unit/engine/determinism.test.ts` — invoca `resolveLaunch` dos veces con el mismo
      `level`/`launch` y compara el `LaunchOutcome` resultante en profundidad.

### Implementation for User Story 1

- [X] T012 [P] [US1] Definir `Hand` y helpers (`hasAvailablePiece`, `takeFirstPiece`, `returnPiece`,
      todos sin mutar), más el tipo `Launch` y la función de viaje
      `travelLaunch(board, hand, launch): { hitAt: Coordinate | null, missclick: boolean }` que
      avanza casilla a casilla desde fuera del tablero hasta colisión o borde opuesto, en
      `src/engine/launch.ts`. Depende de T006, T007.
- [X] T013 [P] [US1] Definir `MoveStepEvent`, `EventLog` y el resolutor de cadena
      `resolveChain(board, initialEvent, applyImpact): { board, events }`, con cola FIFO
      procesada iterativamente (research.md → Decisión 1) hasta que no queden eventos pendientes,
      en `src/engine/events.ts`. Depende de T007.
- [X] T014 [US1] Implementar el comportamiento de impacto de la ficha verde
      `applyGreenImpact(board, event): MoveStepEvent[]` — un `MOVE_STEP` adicional con
      `collision=true` en la dirección del impacto (spec.md → Assumptions; constitución →
      Principio V) — en `src/engine/pieces/green.ts`. Depende de T007, T013.
- [X] T015 [P] [US1] Definir `Objective`, `LevelResult` y `evaluateObjective(board, objective):
      LevelResult` en `src/engine/objective.ts`. Depende de T006.
- [X] T016 [US1] Definir el tipo `Level` y el fixture `testLevelGreen01` — tablero con la ficha
      verde colocada de forma que un lanzamiento conocido colisiona y, tras el impacto, dicha
      ficha queda en la casilla objetivo; el objetivo NO se cumple en el estado inicial (spec.md →
      Edge Cases) — en `src/engine/level.ts`. Depende de T006, T012, T015.
- [X] T017 [US1] Implementar `resolveLaunch(level, launch): LaunchOutcome` en
      `src/engine/index.ts`: orquesta `travelLaunch` → si missclick, devuelve tablero/mano
      intactos y `result` vía `evaluateObjective`; si colisiona, arranca `resolveChain` con
      `applyGreenImpact`, y solo entonces llama a `evaluateObjective` sobre el tablero final
      (FR-006). Re-exporta también los tipos públicos listados en `contracts/engine-api.md`.
      Depende de T012, T013, T014, T015, T016.
- [X] T018 [US1] Ejecutar `npm test` y `npm run typecheck`; ajustar la implementación (T012-T017)
      hasta que las cuatro suites (T008-T011) pasen en verde y no queden errores de tipos.
      Depende de T008-T017.

**Checkpoint**: El walking skeleton está completo y verificado — `npm test` en verde, sin
interfaz, motor 100% headless.

---

## Phase Final: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar los criterios de "hecho" de `quickstart.md` que no quedan cubiertos por un
test automatizado puntual.

- [X] T019 Recorrer el checklist de `quickstart.md` → "Criterio de hecho": confirmar que
      `resolveLaunch` no muta `level.board`/`level.hand` de entrada, que dos invocaciones
      idénticas producen el mismo `LaunchOutcome`, y que ningún fichero de `src/engine/` importa
      nada fuera de sí mismo (sin Phaser, sin DOM) — revisión manual de imports. Depende de T018.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup — bloquea toda la implementación de la Fase 3
  (T012-T018). Los tests de la Fase 3 (T008-T011) pueden escribirse en paralelo a la Fase 2, ya
  que solo referencian tipos/funciones que aún no existen (estado rojo esperado).
- **User Story 1 (Phase 3)**: depende de Foundational. Es la única historia de esta feature.
- **Polish (Final Phase)**: depende de que la Fase 3 esté completa (T018).

### Within User Story 1

- Tests (T008-T011) se escriben antes que la implementación y deben fallar hasta T017.
- `board.ts`/`move-step.ts` (Foundational) → `launch.ts`, `events.ts`, `objective.ts` (T012, T013,
  T015, en paralelo entre sí) → `pieces/green.ts` (T014, depende de `events.ts`) → `level.ts`
  (T016, depende de `launch.ts` y `objective.ts`) → `index.ts` (T017, integra todo) → verificación
  final (T018).

### Parallel Opportunities

- Setup: T003, T004, T005 en paralelo entre sí (tras T001-T002).
- Foundational: T006 no tiene paralelo real dentro de la fase (T007 depende de él).
- Fase 3 tests: T008, T009, T010, T011 en paralelo entre sí (ficheros distintos, sin depender unos
  de otros).
- Fase 3 implementación: T012, T013, T015 en paralelo entre sí (dependen solo de Foundational); T014
  depende de T013; T016 depende de T012 y T015; T017 depende de todo lo anterior.

---

## Parallel Example: User Story 1

```bash
# Lanzar los cuatro tests de la historia en paralelo (todos deben fallar al principio):
Task: "Tests de viaje y missclick en tests/unit/engine/launch.test.ts"
Task: "Tests de interacción y cola de eventos en tests/unit/engine/chain.test.ts"
Task: "Tests de objetivo, derrota y reinicio en tests/unit/engine/objective.test.ts"
Task: "Tests de determinismo en tests/unit/engine/determinism.test.ts"

# Una vez cerrada la Fase 2, lanzar en paralelo los módulos independientes entre sí:
Task: "launch.ts: Hand + travelLaunch"
Task: "events.ts: EventLog + resolveChain (cola FIFO)"
Task: "objective.ts: Objective + evaluateObjective"
```

---

## Implementation Strategy

### MVP (única historia de esta feature)

1. Fase 1: Setup.
2. Fase 2: Foundational — `board.ts` + `move-step.ts` (bloqueante).
3. Fase 3: escribir T008-T011 (rojo) → implementar T012-T017 → T018 hasta verde.
4. **STOP y VALIDAR**: correr `quickstart.md` completo (T019).
5. Este es el walking skeleton completo del roadmap — el siguiente incremento (ficha naranja,
   marrón, wrap-around, regla de mismo color) se especifica como una nueva feature con su propio
   `/speckit-specify`, reutilizando `board.ts`/`move-step.ts`/`events.ts` sin tocarlos si el
   diseño se mantiene fiel a la composición de primitivas (Principio V).

---

## Notes

- Esta feature no tiene US2/US3 — es deliberadamente una única rebanada vertical (el walking
  skeleton). Las fases 4/5 del template no aplican y se han omitido.
- `[P]` = ficheros distintos, sin dependencias entre las tareas marcadas.
- Commitear tras cada tarea o grupo lógico (T003-T005, T008-T011, etc.).
- Ningún fichero de `src/engine/` debe importar Phaser, el DOM, ni ninguna dependencia de runtime
  — es la condición de aceptación del Principio I de la constitución, verificada en T019.
