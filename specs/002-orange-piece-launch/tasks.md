---

description: "Task list template for feature implementation"
---

# Tasks: Lanzamiento de Ficha Naranja (Salto sobre Obstáculo)

**Input**: Design documents from `/specs/002-orange-piece-launch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-api.md,
quickstart.md (todos presentes)

**Tests**: Igual que en la feature 001, los tests **no son opcionales** (Principio II de la
constitución, NON-NEGOTIABLE). `orange.test.ts` se escribe antes de la implementación y debe
fallar (rojo) hasta que el fixture y el refactor de empuje generalizado existan. Las cuatro suites
de la feature 001 (`launch`, `chain`, `objective`, `determinism`) actúan como guardarraíl de
no-regresión: NO se modifican en ninguna tarea de este documento.

**Organization**: Esta feature tiene una única historia de usuario (US1, P1). El refactor
compartido (generalizar el empuje de verde) es un prerrequisito bloqueante para poder implementar
naranja sin duplicar código, así que vive en Foundational, no en US1.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Mismo proyecto único ya existente (ver `specs/001-green-piece-launch/plan.md` y
`specs/002-orange-piece-launch/plan.md` → Structure Decision). No se añade tooling nuevo.

---

## Phase 1: Setup

**Purpose**: Confirmar que se parte de un estado conocido antes de refactorizar código ya
existente y probado.

- [X] T001 Ejecutar `npm test` y `npm run typecheck` en la raíz del repo y confirmar que las
      cuatro suites de la feature 001 pasan (línea base antes de tocar nada).

**Checkpoint**: Estado base verde confirmado — cualquier fallo posterior en esas cuatro suites es
atribuible a esta feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generalizar el empuje de verde en un mecanismo compartido por color (research.md,
Decisiones 1-3) antes de poder añadir naranja sin duplicar lógica. Bloquea toda la Fase 3.

**⚠️ CRITICAL**: No añadir el fixture/implementación específicos de naranja hasta cerrar esta
fase. El test de naranja (Fase 3) sí puede escribirse antes (fallará hasta entonces).

- [X] T002 Ampliar `PieceColor` a `'green' | 'orange'` en `src/engine/board.ts` (data-model.md →
      Cambios sobre tipos existentes). Ningún otro tipo de `board.ts` cambia de forma.
- [X] T003 Crear `src/engine/pieces/push.ts`: tabla `PUSH_DISTANCE: Record<PieceColor, number>`
      (`green: 1, orange: 2`) y la función genérica `applyImpact(board, site): { board, events,
      nextSites }`, generalizando el algoritmo recursivo de empuje en cascada ya construido en
      `pieces/green.ts` (feature 001) para que la distancia de cada empuje se calcule a partir del
      color de la ficha que está siendo desplazada en cada nivel de recursión (research.md,
      Decisión 2), calculando el destino final directamente (sin leer ni escribir casillas
      intermedias — research.md, Decisión 3). Depende de T002.
- [X] T004 Eliminar `src/engine/pieces/green.ts` y actualizar `src/engine/index.ts` para que
      `resolveLaunch` use el `applyImpact` genérico de `push.ts` en vez de un handler específico
      de color al construir el `ImpactSite` inicial. Depende de T003.
- [X] T005 Ejecutar `npm test` y `npm run typecheck`; confirmar que las cuatro suites de la
      feature 001 siguen pasando **sin haber sido modificadas** (comparar con T001) y que no hay
      errores de tipos tras el refactor. Depende de T004.

**Checkpoint**: El motor soporta empuje por N casillas parametrizado por color, sin regresión en
verde — la Fase 3 puede empezar.

---

## Phase 3: User Story 1 - Lanzar una ficha naranja y resolver un nivel de un solo lanzamiento (Priority: P1) 🎯 MVP

**Goal**: Un jugador lanza su única ficha naranja; la ficha impactada salta la casilla intermedia
intacta y aterriza exactamente dos casillas más allá — reutilizando el mecanismo de lanzamiento,
cola de eventos y objetivo ya construidos, sin tocar el comportamiento de verde.

**Independent Test**: Ejecutar `resolveLaunch(testLevelOrange01, { direction, lane })` y verificar,
vía `orange.test.ts`, que el salto de 2 casillas, la casilla intermedia intacta, y
victoria/derrota/sin-determinar se comportan según `contracts/engine-api.md` — sin que las cuatro
suites de verde cambien de resultado.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T006 [P] [US1] Tests de salto de 2 casillas, casilla intermedia intacta, y
      victoria/derrota/sin-determinar (FR-002, FR-003, FR-005, FR-007; Acceptance Scenarios 1-4)
      contra `resolveLaunch` y `testLevelOrange01` en `tests/unit/engine/orange.test.ts`, según la
      tabla de verificación de `contracts/engine-api.md`. No incluye un test de cascada (FR-004
      queda sin verificación dedicada en esta historia — ver spec.md → Assumptions). Fallará por
      falta de `testLevelOrange01` hasta T007.

### Implementation for User Story 1

- [X] T007 [US1] Añadir el fixture `testLevelOrange01` en `src/engine/level.ts` (junto a
      `testLevelGreen01`, sin modificarlo): dos fichas **verdes** en línea — impacto e intermedia
      — dejando vacía a propósito la casilla de aterrizaje (dos más allá del punto de impacto, sin
      cascada), con el objetivo sin cumplir en el estado inicial (data-model.md → Level: nuevo
      fixture). Ninguna ficha del tablero es naranja. Depende de T002.
- [X] T008 [US1] Ejecutar `npm test` y `npm run typecheck`; ajustar `testLevelOrange01` o
      `push.ts` (T003) hasta que `orange.test.ts` pase en verde y las cuatro suites de verde
      sigan pasando sin modificaciones. Depende de T005, T006, T007.

**Checkpoint**: Naranja funciona de punta a punta y verde no tiene regresión — feature completa.

---

## Phase Final: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar los criterios de "hecho" de `quickstart.md` no cubiertos por un test puntual.

- [X] T009 Recorrer el checklist de `quickstart.md`: confirmar con `git diff` que
      `tests/unit/engine/{launch,chain,objective,determinism}.test.ts` no tienen cambios,
      confirmar que `pieces/green.ts` ya no existe, y confirmar que `src/engine/` sigue sin
      importar nada externo y `package.json` sigue sin dependencias de runtime. Depende de T008.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — confirma la línea base.
- **Foundational (Phase 2)**: depende de Setup — bloquea la implementación de la Fase 3 (T007,
  T008). T006 (el test) puede escribirse en paralelo a la Fase 2, ya que fallará de todos modos
  hasta que exista `testLevelOrange01`.
- **User Story 1 (Phase 3)**: depende de Foundational completo (T002-T005).
- **Polish (Final Phase)**: depende de T008.

### Parallel Opportunities

- T002 → T003 → T004 → T005 son estrictamente secuenciales (cada uno modifica lo que el anterior
  acaba de tocar) — sin paralelismo real dentro de Foundational.
- T006 puede escribirse en paralelo a toda la Fase 2 (Foundational).
- T007 depende solo de T002, no de T003/T004/T005 — podría implementarse en paralelo al resto de
  Foundational si se prefiere, aunque T008 (verificación final) sí espera a que todo esté listo.

---

## Parallel Example: User Story 1

```bash
# Mientras se refactoriza push.ts (Fase 2), el test de naranja ya puede escribirse:
Task: "orange.test.ts: salto de 2 casillas, casilla intermedia intacta, victoria/derrota/sin-determinar"
```

---

## Implementation Strategy

### MVP (única historia de esta feature)

1. Fase 1: confirmar línea base verde.
2. Fase 2: refactor generalizado (push.ts) + regresión verificada.
3. Fase 3: fixture de naranja + test en verde.
4. **STOP y VALIDAR**: `quickstart.md` completo (T009).
5. Siguiente incremento del roadmap: ficha marrón (repetición de MOVE_STEP) o wrap-around —
   ambas se benefician directamente de que `push.ts` ya separa "algoritmo" de "distancia por
   color".

---

## Notes

- Esta feature no tiene US2/US3 — una única rebanada vertical, igual que la 001.
- Ninguna tarea de este documento modifica
  `tests/unit/engine/{launch,chain,objective,determinism}.test.ts` — si alguna implementación
  pareciera requerirlo, es una señal de que el refactor de Foundational no es realmente
  compatible hacia atrás y debe revisarse antes de continuar.
- Commitear tras cada tarea o grupo lógico.
