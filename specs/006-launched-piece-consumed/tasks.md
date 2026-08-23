---

description: "Task list template for feature implementation"
---

# Tasks: La Ficha Lanzada Nunca Permanece en el Tablero

**Input**: Design documents from `/specs/006-launched-piece-consumed/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II, NON-NEGOTIABLE) — es una corrección de una regla de
interacción. Los tests se actualizan para describir la regla CORRECTA antes de tocar `push.ts`,
de forma que fallen contra el código actual (rojo) y pasen tras el arreglo (verde) — el mismo
ciclo TDD que cualquier feature nueva, aplicado a una corrección.

**Organization**: 2 historias de usuario (US1 P1: la corrección en sí; US2 P2: verificar que
nada más se movió), igual que spec.md.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. No se añaden ficheros nuevos de producción — solo se modifica
`src/engine/pieces/push.ts`, `src/engine/level.ts`, y `src/levels/prototype-levels.ts`.

---

## Phase 1: User Story 1 - La ficha lanzada se consume al impactar (Priority: P1) 🎯 MVP

**Goal**: `applyImpact` deja de colocar la ficha lanzada en el tablero, sea cual sea el
resultado de su impacto.

**Independent Test**: Lanzar una ficha contra otra de distinto color en un tablero por lo demás
vacío; la casilla del impacto original debe quedar vacía tras resolverse.

### Tests for User Story 1 ⚠️ actualizar primero, deben fallar contra el código actual

- [X] T001 [P] [US1] En `tests/unit/engine/orange.test.ts`, actualizar las 2 aserciones sobre
      dónde se asienta el lanzador (`cells[3][4]` en el test de salto simple, `cells[5][4]` en
      el de cascada mixta) para esperar `null` en vez de la ficha lanzada; actualizar los
      comentarios que documentaban el comportamiento antiguo.
- [X] T002 [P] [US1] En `src/engine/level.ts`, rediseñar `testLevelSameColorCascade01` según
      data-model.md (mismo tablero/mano, objetivo inalcanzable a propósito). En
      `tests/unit/engine/same-color.test.ts`, actualizar el test de cascada para esperar
      `cells[7][4]` y `cells[7][5]` ambos `null`, eventos con `MOVE_STEP` y `ANNIHILATION`, y
      resultado `'lost'`.
- [X] T003 [P] [US1] En `tests/unit/engine/wrap-around.test.ts`, revertir la aserción de
      `cells[2][7]` a `toBeNull()` (por el motivo correcto esta vez: la ficha lanzada nunca se
      asienta, no por el error de la sesión anterior).

### Implementation for User Story 1

- [X] T004 [US1] En `src/engine/pieces/push.ts`, modificar `applyImpact` para que ya no coloque
      `site.piece` en `site.to` ni emita su evento de llegada — devuelve directamente
      `{ board: result.board, events: result.events, nextSites: [] }`. `resolveStrike` no
      cambia (data-model.md, research.md). Depende de T001-T003 (deben estar en rojo antes de
      este cambio).
- [X] T005 [US1] Ejecutar `npm test && npm run typecheck`: confirmar que T001-T003 pasan ahora
      (verde) y que el resto de suites del motor no se ha visto afectado. Depende de T004.
      *(10 suites, 51 tests, verde; typecheck limpio.)*

**Checkpoint**: La corrección está hecha y probada de forma aislada — cualquier lanzamiento que
no sea un missclick deja la ficha lanzada fuera del tablero.

---

## Phase 2: User Story 2 - Las fichas que ya estaban en el tablero se comportan igual (Priority: P2)

**Goal**: Confirmar que nada más cambió — ni las cascadas entre fichas ya colocadas, ni los 10
niveles del prototipo de Fase 2 (salvo los 2 que dependían del error).

**Independent Test**: Las suites no tocadas en la Fase 1 (`chain`, `launch`, `objective`,
`determinism`, `move-step`, `session`) siguen en verde sin haberse modificado; los 10 niveles
del prototipo siguen siendo superables.

### Implementation for User Story 2

- [X] T006 [P] [US2] Confirmar (sin modificarlos) que `chain.test.ts`, `launch.test.ts`,
      `objective.test.ts`, `determinism.test.ts`, `move-step.test.ts`, y
      `tests/unit/engine/session.test.ts` siguen pasando tras T004 — ninguno depende de dónde
      se asienta la ficha lanzada (research.md). *(Ya confirmado por la ejecución completa de
      T005: 10/10 suites en verde, estos 6 ficheros sin tocar.)*
- [X] T007 [US2] En `src/levels/prototype-levels.ts`, rediseñar los niveles 3 y 7 según
      data-model.md (obstáculo del mismo color como primer impacto de un primer lanzamiento,
      seguido de un segundo lanzamiento que empuja la ficha real hasta el objetivo). Depende de
      T004.
- [X] T008 [US2] Confirmar que `tests/unit/levels/prototype-levels.test.ts` sigue pasando sin
      modificarse — sus comprobaciones son estructurales (forma de los datos), no dependen del
      contenido concreto de cada nivel. Depende de T007. *(21 tests, verde, sin tocar el
      fichero.)*
- [X] T009 [US2] Reverificar programáticamente (script temporal con `resolveLaunch`/
      `applySessionLaunch`, descartado tras confirmarlo, igual que en la feature 005) que los
      10 niveles siguen siendo `'won'` alcanzables — los niveles 3 y 7 ahora necesitan 2
      lanzamientos en vez de 1. Depende de T007. *(10/10 niveles confirmados 'won'.)*

**Checkpoint**: Corrección verificada de punta a punta — el motor, sus tests, y el prototipo de
Fase 2 son consistentes entre sí bajo la regla corregida.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [X] T010 Ejecutar `npm test && npm run typecheck` una vez más sobre el estado final; confirmar
      recuento total de suites/tests. Depende de T005, T006, T008, T009. *(10 suites, 51 tests,
      verde; typecheck y `npm run build` limpios.)*
- [ ] T011 Validación manual en navegador (`npm run dev`): jugar los niveles 3 y 7 rediseñados
      de principio a fin (2 lanzamientos cada uno) y confirmar que ninguna ficha lanzada queda
      visible tras su propio impacto. Depende de T010. *(NO verificado por el agente — sin
      navegador disponible en esta sesión, mismo motivo que en la feature 005.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (Phase 1)**: sin dependencias previas — puede empezar de inmediato. T001-T003
  (tests) pueden escribirse en paralelo entre sí (ficheros distintos); T004 depende de las tres;
  T005 depende de T004.
- **User Story 2 (Phase 2)**: depende de que User Story 1 esté cerrada (T004 debe existir antes
  de rediseñar los niveles del prototipo o confirmar la no-regresión). T006 puede ir en paralelo
  al resto de la Fase 2 (no toca ningún fichero que las demás tareas tocan). T007→T008→T009 son
  secuenciales (mismo fichero de niveles, luego su test, luego la reverificación).
- **Polish (Final Phase)**: depende de que ambas historias estén cerradas.

### Parallel Opportunities

- T001, T002, T003 (tests de US1) — tres ficheros distintos, ninguno depende de otro.
- T006 (US2) puede ejecutarse en paralelo a T007-T009 — no comparte ficheros con ellas.

---

## Parallel Example: User Story 1

```bash
# En paralelo, antes de tocar push.ts:
Task: "orange.test.ts: actualizar aserciones de asentamiento del lanzador (T001)"
Task: "level.ts + same-color.test.ts: rediseñar testLevelSameColorCascade01 (T002)"
Task: "wrap-around.test.ts: revertir cells[2][7] a null (T003)"
```

---

## Implementation Strategy

### MVP (User Story 1 sola)

1. Fase 1: tests actualizados (rojo) → arreglo en `push.ts` → tests en verde (T001-T005).
2. **STOP y VALIDAR**: la corrección del motor está hecha y probada de forma aislada.

### Entrega incremental

1. User Story 1 → el motor ya no comete el error, con sus propias suites como prueba.
2. + User Story 2 → confirmación explícita de que nada más se movió, y el prototipo de Fase 2
   sigue siendo jugable de principio a fin.
3. Polish → validación manual en navegador de los 2 niveles rediseñados.

---

## Notes

- No hay fase de Setup ni Foundational separadas — es una corrección quirúrgica de una única
  función, sin infraestructura nueva que preparar antes.
- Commitear tras cada tarea o grupo lógico.
