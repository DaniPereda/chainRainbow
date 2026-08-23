---

description: "Task list template for feature implementation"
---

# Tasks: Wrap-around de Fichas en el Tablero

**Input**: Design documents from `/specs/004-board-wrap-around/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-api.md,
quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II de la constitución, NON-NEGOTIABLE). `wrap-around.test.ts`
se escribe antes de la implementación y debe fallar (rojo) hasta que los fixtures y
`wrapCoordinate` existan. Las seis suites existentes (`launch`, `chain`, `objective`,
`determinism`, `orange`, `same-color`) actúan como guardarraíl de no-regresión: NO se modifican en
ninguna tarea de este documento.

**Organization**: Una única historia de usuario (US1, P1). Añadir `wrapCoordinate` a `board.ts` es
un prerrequisito bloqueante (Foundational) porque tanto los fixtures como la modificación de
`push.ts` lo necesitan.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Mismo proyecto único ya existente. No se añade tooling nuevo.

---

## Phase 1: Setup

- [ ] T001 Ejecutar `npm test` y `npm run typecheck` en la raíz del repo y confirmar que las seis
      suites existentes pasan (línea base: 6 suites, 19 tests, antes de tocar nada).

**Checkpoint**: Estado base verde confirmado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Añadir `wrapCoordinate` a `board.ts` antes de poder modificar `push.ts` o construir
los fixtures que lo ejercitan.

**⚠️ CRITICAL**: No modificar `push.ts` (Fase 3) hasta cerrar esta fase. El test de la Fase 3 sí
puede escribirse antes (fallará hasta entonces).

- [ ] T002 En `src/engine/board.ts`, añadir `wrapCoordinate(coord: Coordinate): Coordinate` —
      módulo estándar sobre `BOARD_SIZE` en fila y columna (`((n % BOARD_SIZE) + BOARD_SIZE) %
      BOARD_SIZE`), no un simple ajuste de un solo paso (data-model.md → wrapCoordinate).
      Exportar la función.

**Checkpoint**: `board.ts` compila con la función nueva — la Fase 3 puede empezar.

---

## Phase 3: User Story 1 - Una ficha empujada más allá del borde reaparece por el lado opuesto (Priority: P1) 🎯 MVP

**Goal**: Al calcular el destino de una ficha ya colocada que se desplaza (impacto inicial o
cualquier eslabón de cascada) y ese destino cae fuera del tablero, la ficha reaparece en el
extremo opuesto de la misma fila/columna en vez de desaparecer — y a partir de ahí se aplica la
regla universal de interacción ya existente sin ningún caso especial.

**Independent Test**: Ejecutar `resolveLaunch` sobre los tres fixtures nuevos
(`testLevelWrapToEmpty01`, `testLevelWrapToDifferentColor01`, `testLevelWrapToSameColor01`) y
verificar, vía `wrap-around.test.ts`, que la ficha reaparece en el lado opuesto y que lo que
ocurre allí (asentarse, empujar, o aniquilar) coincide con `contracts/engine-api.md` — sin que las
seis suites existentes cambien de resultado.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [ ] T003 [P] [US1] Tests de wrap-around a destino vacío, a color distinto, y al mismo color
      (FR-001, FR-002; Acceptance Scenarios 1-4) contra `resolveLaunch` y los tres fixtures nuevos
      en `tests/unit/engine/wrap-around.test.ts`, según la tabla de verificación de
      `contracts/engine-api.md`. Fallará por falta de los fixtures hasta T004.

### Implementation for User Story 1

- [ ] T004 [US1] En `src/engine/level.ts`, añadir los fixtures `testLevelWrapToEmpty01`,
      `testLevelWrapToDifferentColor01`, y `testLevelWrapToSameColor01` con `createTestLevel`,
      según las coordenadas exactas de data-model.md. Una única tarea porque las tres ediciones
      caen en el mismo fichero. Depende de T001 (no de T002 — son datos, no tocan `board.ts`).
- [ ] T005 [P] [US1] En `src/engine/pieces/push.ts`, cambiar `resolveStrike` para que `to` se
      calcule como `wrapCoordinate(stepBy(position, direction, distance))` y eliminar por
      completo la rama `!isInBounds(to)` (la ficha ya no desaparece; con `to` envuelta, el flujo
      continúa directo a comprobar ocupación). Depende de T002. Fichero distinto de T004/T006 —
      puede ir en paralelo a ambas.
- [ ] T006 [P] [US1] En `src/engine/index.ts`, re-exportar `testLevelWrapToEmpty01`,
      `testLevelWrapToDifferentColor01`, y `testLevelWrapToSameColor01`. Depende de T004
      (fixtures). Fichero distinto de T004/T005 — puede ir en paralelo a T005.
- [ ] T007 [US1] Ejecutar `npm test` y `npm run typecheck`; ajustar hasta que
      `wrap-around.test.ts` pase en verde y las seis suites existentes sigan pasando sin
      modificaciones. Depende de T003, T004, T005, T006.

**Checkpoint**: El wrap-around funciona de punta a punta, sin caso especial en el código y sin
regresión en las colisiones que no cruzan ningún borde — feature completa.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [ ] T008 Recorrer el checklist de `quickstart.md`: confirmar que las seis suites existentes no
      tienen cambios, que un missclick sigue comportándose igual (sin wrap), y que `src/engine/`
      sigue sin importar nada externo y `package.json` sigue sin dependencias de runtime. Depende
      de T007.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup — bloquea T005 de la Fase 3 (necesita
  `wrapCoordinate`). T003 (tests) y T004 (fixtures) NO dependen de T002 y pueden escribirse en
  paralelo a ella.
- **User Story 1 (Phase 3)**: T005 depende de Foundational completo (T002); T006 depende de T004.
- **Polish (Final Phase)**: depende de T007.

### Parallel Opportunities

- T003 (tests) y T004 (fixtures, `level.ts`) pueden escribirse en paralelo entre sí y en paralelo
  a T002 — ficheros distintos, ninguno depende del otro.
- T005 (`push.ts`) y T006 (`index.ts`) no dependen entre sí — ficheros distintos — así que pueden
  ejecutarse en paralelo una vez cerradas sus dependencias respectivas (T002 y T004).
- T004 es una única tarea (no tres) porque sus tres fixtures comparten fichero (`level.ts`) —
  mismo criterio ya aplicado en la feature 003 para evitar el conflicto de que dos tareas
  paralelas escriban el mismo archivo a la vez.

---

## Parallel Example: User Story 1

```bash
# En paralelo, sin esperar a la Fase 2:
Task: "wrap-around.test.ts: destino vacío, color distinto, mismo color"
Task: "level.ts: los tres fixtures de wrap-around"

# Una vez cerrada la Fase 2 (y T004 para T006), en paralelo:
Task: "push.ts: wrapCoordinate en resolveStrike, elimina la rama !isInBounds"
Task: "index.ts: re-exportar los tres fixtures nuevos"
```

---

## Implementation Strategy

### MVP (única historia de esta feature)

1. Fase 1: confirmar línea base verde (6 suites, 19 tests).
2. Fase 2: `wrapCoordinate` en `board.ts`.
3. Fase 3: fixtures + `push.ts` sin la rama de "ficha eliminada" + tests en verde.
4. **STOP y VALIDAR**: `quickstart.md` completo (T008).
5. Siguiente incremento del roadmap: la ficha marrón (movimiento largo repetido), que ahora sí
   puede apoyarse en wrap-around real para calcular su tope de distancia.

---

## Notes

- Esta feature no tiene US2/US3 — una única rebanada vertical, igual que las anteriores.
- Ninguna tarea de este documento modifica
  `tests/unit/engine/{launch,chain,objective,determinism,orange,same-color}.test.ts` — si alguna
  implementación pareciera requerirlo, revisar antes de continuar.
- Commitear tras cada tarea o grupo lógico.
