---

description: "Task list template for feature implementation"
---

# Tasks: Colisión entre Fichas del Mismo Color (Aniquilación Mutua)

**Input**: Design documents from `/specs/003-same-color-collision/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-api.md,
quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II de la constitución, NON-NEGOTIABLE). `same-color.test.ts`
se escribe antes de la implementación y debe fallar (rojo) hasta que los fixtures y el chequeo de
mismo color existan. Las cinco suites existentes (`launch`, `chain`, `objective`, `determinism`,
`orange`) actúan como guardarraíl de no-regresión para colisiones de colores distintos: NO se
modifican en ninguna tarea de este documento.

**Organization**: Una única historia de usuario (US1, P1). Extender `EventLog` con
`AnnihilationEvent` es un prerrequisito bloqueante (Foundational) porque tanto los fixtures como
la implementación del chequeo lo necesitan.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Mismo proyecto único ya existente. No se añade tooling nuevo.

---

## Phase 1: Setup

- [X] T001 Ejecutar `npm test` y `npm run typecheck` en la raíz del repo y confirmar que las
      cinco suites existentes pasan (línea base: 5 suites, 15 tests, antes de tocar nada).

**Checkpoint**: Estado base verde confirmado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extender el modelo de eventos con `AnnihilationEvent` antes de poder implementar el
chequeo de mismo color o construir los fixtures que lo ejercitan.

**⚠️ CRITICAL**: No implementar el chequeo de mismo color (Fase 3) hasta cerrar esta fase. Los
tests de la Fase 3 sí pueden escribirse antes (fallarán hasta entonces).

- [X] T002 En `src/engine/events.ts`, añadir `AnnihilationEvent = { type: 'ANNIHILATION'; at:
      Coordinate; strikerColor: PieceColor; defender: Piece }` y el tipo unión `ChainEvent =
      MoveStepEvent | AnnihilationEvent`. Cambiar `EventLog` de `MoveStepEvent[]` a
      `ChainEvent[]`. `ImpactHandler`/`resolveChain` no cambian de forma, solo el tipo de
      `events` que manejan (data-model.md → Cambios sobre EventLog). Import `PieceColor` desde
      `./board.js`.

**Checkpoint**: `events.ts` compila con el nuevo tipo — la Fase 3 puede empezar.

---

## Phase 3: User Story 1 - Dos fichas del mismo color se aniquilan al coincidir (Priority: P1) 🎯 MVP

**Goal**: En cualquier punto de una cadena (impacto inicial o eslabón de cascada), si la ficha que
golpea y la que recibe el golpe comparten color, ambas desaparecen y ninguna ejecuta su efecto —
priorizado sobre el empuje/salto ya construido, sin afectar a colisiones de colores distintos.

**Independent Test**: Ejecutar `resolveLaunch` sobre `testLevelSameColor01` (impacto inicial) y
`testLevelSameColorCascade01` (eslabón de cascada) y verificar, vía `same-color.test.ts`, que
ambas fichas desaparecen y no hay efecto de empuje/salto, según `contracts/engine-api.md` — sin
que las cinco suites existentes cambien de resultado.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T003 [P] [US1] Tests de aniquilación en impacto inicial y en un eslabón de cascada (FR-001 a
      FR-005; Acceptance Scenarios 1, 2, 4) contra `resolveLaunch`, `testLevelSameColor01` y
      `testLevelSameColorCascade01` en `tests/unit/engine/same-color.test.ts`, según la tabla de
      verificación de `contracts/engine-api.md`. Fallará por falta de los fixtures hasta T004.

### Implementation for User Story 1

- [X] T004 [US1] En `src/engine/level.ts`: (a) modificar `testLevelGreen01` — la ficha ya
      colocada pasa de verde a naranja y `objective.targetColor` pasa de `'green'` a `'orange'`
      (la `targetCell` NO cambia, research.md → Decisión 3); (b) añadir los fixtures
      `testLevelSameColor01` (una ficha verde en `(6,4)`, mano con una ficha verde, objetivo
      diseñado para no cumplirse nunca) y `testLevelSameColorCascade01` (lanzador verde en mano;
      fichas naranjas en `(7,4)` y `(7,5)`; objetivo `{ targetColor: 'green', targetCell: { row:
      7, col: 4 } }`) — ver data-model.md. Una única tarea porque las tres ediciones caen en el
      mismo fichero. Depende de T001 (no de T002 — no toca eventos).
- [X] T005 [P] [US1] En `src/engine/pieces/push.ts`, insertar la comprobación de mismo color en
      un único punto reutilizado tanto por la resolución del impacto inicial como por cada
      eslabón recursivo de `pushOccupant` (research.md, Decisión 1): si el color de la ficha que
      golpea coincide con el de la que ocupa la casilla de destino, generar un
      `AnnihilationEvent`, eliminar ambas fichas del tablero, y terminar ahí (sin más eventos ni
      empuje). Si los colores difieren, seguir con el empuje ya existente sin cambios. Depende de
      T002. Fichero distinto de T004/T006 — puede ir en paralelo a ambas.
- [X] T006 [P] [US1] En `src/engine/index.ts`, re-exportar `AnnihilationEvent`, `ChainEvent`,
      `testLevelSameColor01` y `testLevelSameColorCascade01`. Depende de T002 (tipos) y T004
      (fixtures). Fichero distinto de T004/T005 — puede ir en paralelo a T005 (ambas leen de lo
      que T002/T004 ya dejaron listo, sin escribirse mutuamente).
- [X] T007 [US1] Ejecutar `npm test` y `npm run typecheck`; ajustar hasta que `same-color.test.ts`
      pase en verde y las cinco suites existentes sigan pasando sin modificaciones. Depende de
      T003, T004, T005, T006.

**Checkpoint**: La aniquilación de mismo color funciona de punta a punta, con prioridad correcta
sobre el empuje, y sin regresión en colores distintos — feature completa.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [X] T008 Recorrer el checklist de `quickstart.md`: confirmar que las cinco suites existentes no
      tienen cambios, que `testLevelGreen01` sigue produciendo `'won'` con `GREEN_WINNING_LAUNCH`,
      y que `src/engine/` sigue sin importar nada externo y `package.json` sigue sin dependencias
      de runtime. Depende de T007.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup — bloquea T005 y T006 de la Fase 3 (necesitan
  `AnnihilationEvent`/`ChainEvent`). T003 (tests) y T004 (fixtures) NO dependen de T002 y pueden
  escribirse en paralelo a ella.
- **User Story 1 (Phase 3)**: T005/T006 dependen de Foundational completo (T002).
- **Polish (Final Phase)**: depende de T007.

### Parallel Opportunities

- T003 (tests) y T004 (fixtures, `level.ts`) pueden escribirse en paralelo entre sí y en paralelo
  a T002 — ficheros distintos, ninguno depende del otro.
- T005 (`push.ts`) y T006 (`index.ts`) dependen de T002 (y T006 también de T004), pero no entre
  sí ni con T003 — ficheros todos distintos, así que pueden ejecutarse en paralelo una vez
  cerradas sus dependencias respectivas.
- T004 es una única tarea (no dos) precisamente porque sus tres ediciones comparten fichero
  (`level.ts`) — evita el conflicto de que dos tareas paralelas escriban el mismo archivo a la
  vez.

---

## Parallel Example: User Story 1

```bash
# En paralelo, sin esperar a la Fase 2:
Task: "same-color.test.ts: aniquilación en impacto inicial y en cascada"
Task: "level.ts: testLevelGreen01 -> naranja + nuevos fixtures de mismo color"

# Una vez cerrada la Fase 2 (y T004 para T006), en paralelo:
Task: "push.ts: comprobación de mismo color unificada"
Task: "index.ts: re-exportar AnnihilationEvent/ChainEvent y los fixtures nuevos"
```

---

## Implementation Strategy

### MVP (única historia de esta feature)

1. Fase 1: confirmar línea base verde (5 suites, 15 tests).
2. Fase 2: extender `EventLog` con `AnnihilationEvent`.
3. Fase 3: fixtures + chequeo de mismo color unificado + tests en verde.
4. **STOP y VALIDAR**: `quickstart.md` completo (T008).
5. Siguiente incremento del roadmap: wrap-around de fichas en tablero, o la ficha marrón
   (repetición de MOVE_STEP) — ambas se benefician de que el chequeo de mismo color ya vive en el
   único punto de entrada compartido de `push.ts`.

---

## Notes

- Esta feature no tiene US2/US3 — una única rebanada vertical, igual que las anteriores.
- Ninguna tarea de este documento modifica
  `tests/unit/engine/{launch,chain,objective,determinism,orange}.test.ts` — si alguna
  implementación pareciera requerirlo, revisar antes de continuar (sería indicio de que el cambio
  de `testLevelGreen01` no es realmente compatible hacia atrás).
- Commitear tras cada tarea o grupo lógico.
