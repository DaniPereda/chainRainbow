---

description: "Task list template for feature implementation"
---

# Tasks: Ficha Roja (Ramificación)

**Input**: Design documents from `/specs/009-red-piece/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II, NON-NEGOTIABLE) — es una pieza nueva con su propio
primitivo de resolución. Las fixtures de `red.test.ts` que ejercitan US1 se escriben antes de
tocar `push.ts`, siguiendo el mismo ciclo TDD que toda feature anterior de motor.

**Organization**: 3 historias de usuario (US1 P1, US2 P2, US3 P2), en el mismo orden que
spec.md. `resolveSplit`/`resolveBranch` (la implementación real) se construyen dentro de US1 —
US2 y US3 verifican esa misma implementación desde ángulos distintos, sin código propio, mismo
patrón ya usado en las features 007 y 008.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Cambios en `src/engine/board.ts`, `src/engine/pieces/push.ts`,
`src/renderer/board-view.ts` (mínimo), y un fichero de test nuevo,
`tests/unit/engine/red.test.ts`.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: `'red'` tiene que existir como `PieceColor` antes de que ninguna fixture pueda
siquiera construirse.

**⚠️ CRITICAL**: Ninguna historia empieza hasta cerrar esta fase.

- [X] T001 En `src/engine/board.ts`, añadir `'red'` a `PieceColor`. En
      `src/renderer/board-view.ts`, añadir `red: 0xe74c3c` a `PIECE_COLOR` — lo mínimo para que
      `Record<PieceColor, number>` siga siendo exhaustivo y el build no se rompa (plan.md →
      Constraints). NO añade rojo a ningún nivel del prototipo de Fase 2.

**Checkpoint**: `'red'` existe como color válido — las historias pueden empezar.

---

## Phase 2: User Story 1 - Un impacto rojo divide la ficha golpeada en dos (Priority: P1) 🎯 MVP

**Goal**: Rojo, al golpear una ficha de distinto color, la sustituye por dos fichas del mismo
color, cada una viajando en una de las dos direcciones perpendiculares a la dirección del
impacto — en vez de empujarla en línea recta.

**Independent Test**: Fixtures 1, 2 y 5 de data-model.md — división con impacto N/S (ramas E/O)
y con impacto E/O (ramas N/S), ambas con caminos despejados; y el caso de rojo golpeando a otro
rojo, donde la aniquilación ya existente tiene prioridad y la división nunca se produce.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T002 [P] [US1] Fixtures 1, 2 y 5 de data-model.md en `tests/unit/engine/red.test.ts`
      (nuevo fichero): división con impacto vertical → ramas E/O; división con impacto
      horizontal → ramas N/S; rojo contra rojo aniquila directamente, sin ninguna división.
      Fallará por falta de la lógica de ramificación hasta T003.

### Implementation for User Story 1

- [X] T003 [US1] En `src/engine/pieces/push.ts`, añadir `PERPENDICULAR_DIRECTIONS`,
      `resolveBranch`, y `resolveSplit` según data-model.md/research.md (incluida la colocación
      explícita de la propia ficha de cada rama en el caso "ocupado, sin aniquilar" — ver el bug
      documentado en research.md). En `resolveStrike`, añadir la rama `if (strikerColor ===
      'red') { return resolveSplit(...); }` justo después de la comprobación de mismo color y
      antes del cálculo de `to` vía `PUSH_STRATEGY`. Depende de T001. Hace pasar T002.
- [X] T004 [US1] Ejecutar `npm test && npm run typecheck`: confirmar que T002 pasa (verde) y que
      el resto de suites del motor (verde, naranja, marrón, mismo color, wrap-around, sesión,
      niveles del prototipo) siguen en verde sin cambios de comportamiento. Depende de T003.

**Checkpoint**: La división básica de rojo funciona y está probada de forma aislada — MVP de
esta feature completo.

---

## Phase 3: User Story 2 - Cada rama se resuelve con la regla universal ya existente (Priority: P2)

**Goal**: Confirmar que cada una de las dos ramas se comporta exactamente como cualquier ficha
en movimiento — empuja o aniquila según la regla universal ya existente — sin ningún camino de
resolución especial, y sin que lo que le pase a una rama afecte a la otra.

**Independent Test**: Fixture 3 de data-model.md (una rama compone con un empuje normal más
allá, usando la distancia de quien golpea en ESE punto, no la de rojo) y fixture 4 (una rama
aniquila por mismo color, la otra rama no se ve afectada).

### Implementation for User Story 2

- [ ] T005 [US2] Fixtures 3 y 4 de data-model.md en `red.test.ts`: una rama golpea a una
      tercera ficha de distinto color y la empuja con la distancia propia de quien golpea en ese
      punto (no la de rojo), pudiendo la cadena continuar; una rama golpea a una ficha del mismo
      color que ella y ambas se aniquilan, sin afectar a la otra rama. Depende de T003 — no
      requiere ningún cambio de código adicional, es verificación de la misma implementación de
      US1 desde otro ángulo (igual que las features 007 y 008).

**Checkpoint**: Confirmado que rojo se compone sobre la regla universal ya existente sin ningún
caso especial dentro de cada rama.

---

## Phase 4: User Story 3 - Las dos ramas se resuelven en un orden fijo, una detrás de otra (Priority: P2)

**Goal**: El resultado de un mismo impacto rojo es siempre idéntico, repetición tras repetición
(determinismo, Principio III) — consecuencia directa de que las dos ramas se resuelvan siempre
en el mismo orden.

**Independent Test**: Fixture 7 de data-model.md — mismo nivel y lanzamiento invocados dos
veces, mismo resultado exacto ambas veces.

### Implementation for User Story 3

- [ ] T006 [US3] Fixture 7 de data-model.md en `red.test.ts`: llamar a `resolveLaunch` dos veces
      sobre el mismo nivel (reutilizando la fixture 1) y el mismo lanzamiento; confirmar
      resultados estructuralmente idénticos y que el nivel original no se mutó — mismo patrón
      que `determinism.test.ts` (feature 001). Depende de T003 — verificación pura, sin código
      nuevo (research.md explica por qué no hace falta un test de orden aislado además de este).

**Checkpoint**: Las 3 historias funcionan juntas — rojo está completo.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [ ] T007 [P] Fixture 6 de data-model.md en `red.test.ts`: rojo lanzada desde la mano en un
      missclick — confirma que el mecanismo de lanzamiento ya existente (FR-007) no necesita
      ningún ajuste para el color nuevo. Depende de T003.
- [ ] T008 Ejecutar `npm test && npm run typecheck && npm run build`: confirmar el recuento
      final de suites/tests y que `board-view.ts` sigue compilando. Depende de T004, T005, T006,
      T007.
- [ ] T009 Verificar que `src/engine/` sigue sin importar nada de `src/renderer/` ni de
      `phaser` — mismo `grep` de siempre. Depende de T003.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias — bloquea las 3 historias.
- **User Story 1 (Phase 2)**: depende de Foundational. T002 (tests) puede escribirse en paralelo
  a Foundational en cuanto a redacción, pero no pasará hasta T003; T003 depende de T001; T004
  depende de T003.
- **User Story 2 (Phase 3)**: depende de T003 (US1) — reutiliza la misma implementación, no
  añade código.
- **User Story 3 (Phase 4)**: depende de T003 (US1) — mismo motivo que US2.
- **Polish (Final Phase)**: T007 depende de T003; T008 depende de que las 3 historias estén
  cerradas; T009 depende de T003.

### Parallel Opportunities

- T005 (US2) y T006 (US3) pueden ejecutarse en paralelo entre sí una vez cerrada US1 — ambas son
  solo lectura/verificación sobre la misma implementación, sin tocar el mismo código.
- T007 (Polish) puede ir en paralelo a T005/T006 por el mismo motivo.

---

## Parallel Example: tras cerrar User Story 1

```bash
# En paralelo, una vez existe T003:
Task: "red.test.ts: una rama compone con un empuje, la otra con una aniquilación (T005, US2)"
Task: "red.test.ts: determinismo entre dos ejecuciones del mismo lanzamiento (T006, US3)"
Task: "red.test.ts: missclick lanzada desde la mano (T007, Polish)"
```

---

## Implementation Strategy

### MVP (Foundational + User Story 1)

1. Fase 1: `'red'` existe como color válido.
2. Fase 2: `resolveSplit`/`resolveBranch` implementados, la división básica funciona y está
   probada. **STOP y VALIDAR** (T004) — la razón de ser de rojo ya está hecha y probada.

### Entrega incremental

1. Foundational + User Story 1 → rojo divide correctamente (MVP).
2. + User Story 2 → confirmado que cada rama compone con la regla universal sin caso especial.
3. + User Story 3 → confirmado el determinismo del orden fijo de resolución.
4. Polish → missclick, regresión completa, límite engine↔renderer.
5. Con esto se cierra la Fase 3 de la constitución (marrón + rojo) — el roadmap del motor
   headless queda al día con el documento de diseño del juego.

---

## Notes

- No hay Setup separado de Foundational — es un cambio quirúrgico contenido en un único fichero
  de producción (`pieces/push.ts`) más el tipo de color.
- Commitear tras cada tarea o grupo lógico.
