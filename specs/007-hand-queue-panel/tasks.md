---

description: "Task list template for feature implementation"
---

# Tasks: Panel de Fichas en Mano

**Input**: Design documents from `/specs/007-hand-queue-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No hace falta ninguna tarea de test Vitest — `hand-panel.ts` es dibujo puro sobre
datos ya validados por el motor, mismo criterio ya aplicado a `board-view.ts` (plan.md,
research.md). Se valida manualmente en el navegador.

**Organization**: 2 historias de usuario (US1 P1, US2 P2), igual que spec.md. La
implementación de ambas comparte un único punto de cambio (`redraw()` en `BoardScene.ts`) por
diseño — ver research.md, "redibujar el panel en el mismo punto donde ya se redibuja el
tablero" — así que US2 se verifica sobre la misma implementación que cierra US1, no añade código
propio.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Un fichero nuevo (`src/renderer/hand-panel.ts`) y una extensión de
`src/renderer/scenes/BoardScene.ts` — ver plan.md → Project Structure.

---

## Phase 1: User Story 1 - Ver qué fichas quedan por lanzar (Priority: P1) 🎯 MVP

**Goal**: Un panel debajo del tablero muestra, al entrar a un nivel, todas las fichas de la mano
en orden.

**Independent Test**: Cargar el nivel 3 o el 10 (mano de 2 fichas) y comprobar que el panel
muestra ambas, en el mismo orden que la mano declarada del nivel.

### Implementation for User Story 1

- [ ] T001 [P] [US1] En `src/renderer/board-view.ts`, exportar la constante `PIECE_COLOR` (ya
      existente, hoy privada del módulo) para que `hand-panel.ts` pueda reutilizar la misma
      paleta (data-model.md).
- [ ] T002 [US1] Crear `src/renderer/hand-panel.ts` con `drawHand(graphics, hand)`: dibuja un
      círculo de color por cada `Piece` de `hand.pieces`, en orden, centrados horizontalmente
      (data-model.md). Depende de T001.
- [ ] T003 [US1] Extender `src/renderer/scenes/BoardScene.ts`: en `create()`, añadir
      `this.handGraphics` posicionado debajo de las casillas de lanzamiento del borde sur
      (research.md); en `redraw()`, añadir la llamada a `drawHand(this.handGraphics,
      this.session.current.hand)` junto a la ya existente a `drawBoard`. Depende de T002. Este
      único cambio, al compartir el punto de disparo `redraw()` con el tablero, es también toda
      la implementación que necesita US2 (FR-004, FR-005, FR-006 de spec.md) — no hace falta
      ningún código adicional en la Fase 2.
- [ ] T004 [US1] Validación manual: `npm run dev`, cargar el nivel 3 o el 10, confirmar que el
      panel muestra las 2 fichas de la mano en el orden correcto (quickstart.md, paso 1).

**Checkpoint**: El panel se ve correctamente al entrar a cualquier nivel con más de una ficha en
mano.

---

## Phase 2: User Story 2 - El panel se mantiene al día con cada lanzamiento (Priority: P2)

**Goal**: Confirmar que el panel ya construido en la Fase 1 se actualiza correctamente en los
cuatro momentos que le afectan: lanzamiento que consume ficha, missclick, mano vacía, reinicio.

**Independent Test**: Lanzar una ficha y comprobar que el panel pasa a mostrar una menos, sin
alterar el orden de las que quedan.

### Implementation for User Story 2

- [ ] T005 [US2] Validación manual: sobre el mismo nivel de T004, lanzar la primera ficha de la
      cola y confirmar que el panel muestra una menos, manteniendo el orden; provocar un
      missclick y confirmar que el panel no cambia; lanzar hasta vaciar la mano y confirmar que
      el panel queda vacío exactamente en ese momento; reiniciar el nivel y confirmar que el
      panel vuelve a mostrar la mano inicial completa (quickstart.md, pasos 2-5). Depende de
      T003 — no requiere ningún cambio de código adicional (research.md).

**Checkpoint**: El panel se mantiene sincronizado con la mano del motor en todos los casos de
spec.md.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [ ] T006 Ejecutar `npm test && npm run typecheck && npm run build`: confirmar que las 10
      suites del motor siguen en verde sin cambios (esta feature no toca `src/engine/`) y que el
      build de producción sigue limpio. Depende de T003.

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: sin dependencias previas. T001→T002→T003 son secuenciales (cada
  uno depende del fichero que crea/modifica el anterior); T004 depende de T003.
- **User Story 2 (Phase 2)**: depende de que T003 (US1) exista — es la misma implementación,
  verificada desde un ángulo distinto. T005 no tiene tareas de implementación propias.
- **Polish (Final Phase)**: depende de T003.

### Parallel Opportunities

- Ninguna real dentro de esta feature — T001, T002, T003 forman una cadena estrictamente
  secuencial (cada uno necesita el resultado del anterior para compilar). Es una feature
  demasiado pequeña para tener trabajo genuinamente paralelizable.

---

## Implementation Strategy

### MVP (User Story 1 sola)

1. T001 → T002 → T003 → T004. El panel ya es útil y correcto en este punto — US2 no añade
   código, solo confirma que la misma implementación cubre también esos casos.

### Entrega incremental

1. User Story 1 → el panel se ve al entrar a un nivel (MVP).
2. + User Story 2 → confirmación de que se mantiene correcto durante toda la partida.
3. Polish → regresión completa antes de abrir la PR.

---

## Notes

- Esta feature no tiene fase de Setup ni Foundational — no hay infraestructura compartida que
  preparar antes de T001.
- Commitear tras cada tarea o grupo lógico.
