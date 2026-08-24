---

description: "Task list template for feature implementation"
---

# Tasks: Ficha Marrón (Movimiento Largo Repetido)

**Input**: Design documents from `/specs/008-brown-piece/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II, NON-NEGOTIABLE) — es una pieza nueva con su propia regla
de interacción. `stepUntilBlocked` y las escenas de `brown.test.ts` se escriben antes de tocar
`push.ts`, siguiendo el mismo ciclo TDD que toda feature anterior de motor.

**Organization**: 3 historias de usuario (US1 P1, US2 P2, US3 P1 — dos P1 porque el propio
spec.md marca el movimiento largo Y el tope anti-bucle como igualmente esenciales, ninguno tiene
sentido sin el otro), en el mismo orden que spec.md. `PUSH_STRATEGY` (la generalización que hace
posible las tres) se implementa dentro de US1 — US2 y US3 verifican esa misma implementación
desde ángulos distintos, sin código propio, igual que ya se hizo en la feature 007.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Cambios en `src/engine/board.ts`, `src/engine/move-step.ts`,
`src/engine/pieces/push.ts`, `src/renderer/board-view.ts` (mínimo), y tests en
`tests/unit/engine/`.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: `'brown'` tiene que existir como `PieceColor`, y `stepUntilBlocked` tiene que
existir como primitivo, antes de que ninguna historia pueda escribir ni pasar sus tests.

**⚠️ CRITICAL**: Ninguna historia empieza hasta cerrar esta fase.

- [X] T001 [P] En `src/engine/board.ts`, añadir `'brown'` a `PieceColor`. En
      `src/renderer/board-view.ts`, añadir `brown: 0x8d6e63` a `PIECE_COLOR` — lo mínimo para
      que `Record<PieceColor, number>` siga siendo exhaustivo y el build no se rompa (plan.md →
      Constraints). NO añade marrón a ningún nivel del prototipo de Fase 2.
- [X] T002 [P] Tests de `stepUntilBlocked` en `tests/unit/engine/move-step.test.ts`: bloqueo
      inmediato (primer paso ya ocupado), bloqueo tras varios pasos, y el caso `isSelf` — con la
      fila/columna despejada y `maxEdgeCrossings` alcanzable, confirmar que NO se bloquea contra
      su propia casilla de partida y llega hasta el segundo cruce de borde (research.md,
      hallazgo del ciclo de periodo 8). Fallará por falta de la función hasta T003.
- [X] T003 En `src/engine/move-step.ts`, implementar `stepUntilBlocked(board, position,
      direction, maxEdgeCrossings)` según data-model.md/research.md. Depende de T002. Hace
      pasar T002. *(8/8 tests en verde, incluido el caso `isSelf`.)*

**Checkpoint**: `stepUntilBlocked` existe y está probado en aislado — las historias pueden
empezar.

---

## Phase 2: User Story 1 - Un impacto marrón desplaza la ficha golpeada mucho más lejos (Priority: P1) 🎯 MVP

**Goal**: Cuando una ficha marrón golpea a otra con casillas vacías por delante, la ficha
golpeada avanza mucho más lejos que lo que permitirían verde o naranja, comprobando cada casilla
individual (sin saltarse ninguna, a diferencia de naranja).

**Independent Test**: Fixture 1 y 2 de data-model.md — un empuje largo hasta un bloqueo (que a
su vez se resuelve con la distancia de QUIEN empuja ahí, no la de marrón), y un bloqueo
inmediato cuando la primera casilla ya está ocupada.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T004 [P] [US1] Fixtures 1 y 2 de data-model.md en `tests/unit/engine/brown.test.ts`
      (nuevo fichero): empuje largo hasta un bloqueo con cascada propia (fixture 1), y bloqueo
      en la primera casilla sin saltarla (fixture 2). Fallará por falta de la estrategia de
      empuje de marrón hasta T005.

### Implementation for User Story 1

- [X] T005 [US1] En `src/engine/pieces/push.ts`, generalizar `PUSH_DISTANCE: Record<PieceColor,
      number>` a `PUSH_STRATEGY: Record<PieceColor, DisplacementStrategy>` (research.md):
      verde/naranja siguen siendo `stepBy` con su distancia fija; marrón usa
      `stepUntilBlocked(board, position, direction, 2)`. `resolveStrike` cambia una única línea
      para llamar a `PUSH_STRATEGY[strikerColor](board, position, direction)`. Depende de T001,
      T003. Hace pasar T004.
- [X] T006 [US1] Ejecutar `npm test && npm run typecheck`: confirmar que T004 pasa, y que las
      suites existentes (`orange`, `same-color`, `wrap-around`, `chain`, `launch`, `objective`,
      `determinism`, `session`, `prototype-levels`) siguen en verde sin cambios de
      comportamiento — prueba de que generalizar `PUSH_STRATEGY` no alteró verde ni naranja.
      Depende de T005. *(11 suites, 56 tests, verde; typecheck limpio.)*

**Checkpoint**: El movimiento largo de marrón funciona y está probado — MVP de esta feature
completo.

---

## Phase 3: User Story 2 - Al toparse con algo, se aplica la misma regla de siempre (Priority: P2)

**Goal**: Confirmar que cuando el empuje largo de marrón llega a una casilla ocupada, el
resultado es exactamente el de la regla universal ya existente — sin ningún camino de
resolución especial para marrón.

**Independent Test**: Fixture 3 de data-model.md (empuje largo que termina en aniquilación por
mismo color) y fixture 5 (dos fichas marrón se encuentran directamente, sin empuje largo de por
medio).

### Implementation for User Story 2

- [X] T007 [US2] Fixtures 3 y 5 de data-model.md en `brown.test.ts`: aniquilación tras un
      empuje largo, y aniquilación directa entre dos marrón (el paseo largo ni llega a
      empezar). Depende de T005 — no requiere ningún cambio de código adicional, es
      verificación de la misma implementación de US1 desde otro ángulo (igual que la feature
      007). *(Pasó a la primera, sin tocar código de producción, tal como se esperaba.)*

**Checkpoint**: Confirmado que marrón se compone sobre la regla universal ya existente sin
ningún caso especial.

---

## Phase 4: User Story 3 - El movimiento largo nunca da más de una vuelta completa (Priority: P1)

**Goal**: Con la fila/columna completamente despejada, el desplazamiento se detiene justo antes
del segundo cruce de borde en vez de calcular indefinidamente (ver erratum en spec.md: corregido
de "13 pasos, se detiene en col0" a "12 pasos, se detiene en col7" tras el playtest del nivel 12
del prototipo).

**Independent Test**: Fixture 4 de data-model.md — fila despejada, se detiene tras 12 pasos justo
antes del segundo cruce, sin bloquearse falsamente contra su propia casilla de partida en el
paso 8.

### Implementation for User Story 3

- [X] T008 [US3] Fixture 4 de data-model.md en `brown.test.ts`: fila despejada, confirma que el
      desplazamiento se detiene exactamente en el segundo cruce de borde. Depende de T005 — de
      nuevo, verificación pura de la misma implementación, esta vez del caso límite que motivó
      el hallazgo `isSelf` de research.md. *(Pasó a la primera — confirma el hallazgo también de
      punta a punta, no solo en el primitivo aislado de T002.)*

**Checkpoint**: Las 3 historias funcionan juntas — marrón está completo y no puede colgar el
motor.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [X] T009 [P] Fixture 6 de data-model.md en `brown.test.ts`: marrón lanzada desde la mano en un
      missclick — confirma que el mecanismo de lanzamiento ya existente (FR-006) no necesita
      ningún ajuste para el color nuevo.
- [X] T010 Ejecutar `npm test && npm run typecheck && npm run build`: confirmar el recuento
      final de suites/tests y que `board-view.ts` sigue compilando. Depende de T006, T007, T008,
      T009. *(11 suites, 60 tests, verde; typecheck y build limpios.)*
- [X] T011 Verificar que `src/engine/` sigue sin importar nada de `src/renderer/` ni de
      `phaser` — mismo `grep` de siempre. Depende de T005. *(Confirmado: cero imports externos.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias — bloquea las 3 historias. T001 y T002 pueden
  escribirse en paralelo (ficheros distintos); T003 depende de T002.
- **User Story 1 (Phase 2)**: depende de Foundational completo. T004 (test) puede escribirse en
  paralelo a T001-T003 en cuanto a redacción, pero no pasará hasta T005; T005 depende de T001 y
  T003; T006 depende de T005.
- **User Story 2 (Phase 3)**: depende de T005 (US1) — reutiliza la misma implementación, no
  añade código.
- **User Story 3 (Phase 4)**: depende de T005 (US1) — mismo motivo que US2.
- **Polish (Final Phase)**: T009 depende de T005; T010 depende de que las 3 historias estén
  cerradas; T011 depende de T005.

### Parallel Opportunities

- T001 y T002 (Foundational) — ficheros distintos, sin dependencia entre sí.
- T004 (US1, test) puede escribirse en paralelo al resto de Foundational — fichero distinto,
  aunque no pasará hasta T005.
- T007 (US2) y T008 (US3) pueden ejecutarse en paralelo entre sí una vez cerrada US1 — ambas
  son solo lectura/verificación sobre la misma implementación, sin tocar el mismo código.
- T009 (Polish) puede ir en paralelo a T007/T008 por el mismo motivo.

---

## Parallel Example: Foundational

```bash
# En paralelo:
Task: "board.ts + board-view.ts: PieceColor gana 'brown' (T001)"
Task: "move-step.test.ts: tests de stepUntilBlocked (T002)"
```

## Parallel Example: tras cerrar User Story 1

```bash
# En paralelo, una vez existe T005:
Task: "brown.test.ts: aniquilación tras empuje largo y entre dos marrón (T007, US2)"
Task: "brown.test.ts: fila despejada, tope de dos cruces (T008, US3)"
```

---

## Implementation Strategy

### MVP (Foundational + User Story 1)

1. Fase 1: `stepUntilBlocked` probado en aislado.
2. Fase 2: `PUSH_STRATEGY` generalizado, marrón empuja lejos y compone con la regla universal.
   **STOP y VALIDAR** (T006) — el motor ya tiene marrón funcionando de punta a punta.

### Entrega incremental

1. Foundational + User Story 1 → marrón existe y empuja lejos (MVP).
2. + User Story 2 → confirmado que no hay ningún caso especial al toparse con algo.
3. + User Story 3 → confirmado que nunca cuelga el motor en un tablero despejado.
4. Polish → lanzamiento desde la mano, regresión completa, límite engine↔renderer.
5. Siguiente incremento del roadmap: la ficha roja (ramificación), última pieza de Fase 3 de la
   constitución.

---

## Notes

- Ninguna tarea de este documento modifica el comportamiento de verde, naranja, mismo color, o
  wrap-around — solo los consume a través de la misma `resolveStrike` de siempre, que no cambia
  su lógica, solo cómo obtiene `to`.
- Commitear tras cada tarea o grupo lógico.
