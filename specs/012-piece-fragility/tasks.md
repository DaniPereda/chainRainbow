---

description: "Task list template for feature implementation"
---

# Tasks: Fragilidad de fichas (NEW/CRACKED/BROKEN)

**Input**: Design documents from `/specs/012-piece-fragility/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II) — cada regla de fragilidad se prueba headless, en
aislamiento del renderer, antes o junto con su implementación.

**Organization**: 4 historias de usuario (US1 P1, US2 P2, US3 P3, US4 P4). US1 construye el
mecanismo base (avance de estado + eliminación al asentarse) dentro de `resolveStrike` y
`resolveSplit`/`resolveBranch`. US2 reutiliza exactamente ese mismo patrón un nivel más arriba,
en `applyImpact`, para la ficha lanzada — motivo por el que US2 depende de US1 estar cerrada
(comparten fichero, `push.ts`), no son paralelizables entre sí a pesar de ser historias
distintas. US3 (visual) depende de que US1+US2 ya produzcan estados reales que mostrar. US4
(autoría de niveles) solo depende de Foundational — toca `level.ts`, un fichero distinto, y
puede avanzar en paralelo con US1/US2/US3.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Motor en `src/engine/` (principalmente `board.ts`, `level.ts`,
`pieces/push.ts`), renderer en `src/renderer/` (`board-view.ts`), tests en
`tests/unit/engine/`. `tools/generator/` no se toca (fuera de alcance, spec.md).

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: extender `Piece` con `fragility` y devolver el código existente a un estado
compilable y verde, con todas las fichas por defecto en `'new'` — sin ningún cambio de
comportamiento todavía. Ninguna historia empieza hasta cerrar esta fase.

**⚠️ CRITICAL**: el campo `fragility` de `Piece` es obligatorio a nivel de tipo (no opcional) —
esto rompe la compilación de cualquier sitio que construya un `Piece` a mano hasta que se
actualice, y las aserciones `toEqual({color:...})` sobre fichas del tablero en los tests ya
existentes dejan de ser una igualdad exacta hasta añadirles `fragility`.

- [X] T001 En `src/engine/board.ts`, añadir `export type Fragility = 'new' | 'cracked' | 'broken'`
      y extender `Piece` a `{ color: PieceColor; fragility: Fragility }` (data-model.md).
- [X] T002 [P] En `src/engine/level.ts`, `createLevel` — actualizar la construcción interna de
      fichas (tablero y mano) para satisfacer el nuevo campo obligatorio, usando siempre
      `fragility: 'new'`. Firma pública sin cambios todavía (`pieces: PiecePlacement[]`,
      `hand: PieceColor[]`, `goal: PiecePlacement`) — ningún comportamiento ni capacidad nueva
      expuesta aún, eso es trabajo de US4. Depende de T001.
- [X] T003 [P] En `src/engine/pieces/push.ts`, `resolveBranch` — su construcción de ficha
      (`const piece: Piece = { color }`) pasa a `{ color, fragility: 'new' }`. Mismo criterio que
      T002: arreglo mecánico para compilar, sin lógica de avance/rotura todavía (eso es US1).
      Depende de T001.
- [X] T004 [P] Actualizar las 22 aserciones `toEqual({ color: ... })` sobre fichas de tablero ya
      existentes en `tests/unit/engine/brown.test.ts`, `orange.test.ts`, `red.test.ts`,
      `wrap-around.test.ts`, `launch.test.ts` y `session.test.ts` a
      `toEqual({ color: ..., fragility: 'new' })` — correcto en este punto exacto del código,
      porque todavía no existe ninguna lógica que avance la fragilidad de nadie. Depende de
      T001 (no depende de T002/T003 para poder escribirse, aunque si depende de ellas para que
      la suite compile). También hizo falta un arreglo mecánico equivalente en
      `move-step.test.ts` (construcción directa de `Piece`, no detectado en el recuento inicial
      de 22 -- ver Notes).
- [X] T005 Ejecutar `npm run typecheck && npm test`: la suite completa vuelve a estar en verde,
      sin ningún cambio de comportamiento respecto a antes de esta feature. Depende de T002, T003,
      T004. **87/87 tests, typecheck limpio.**

**Checkpoint**: el tipo existe, todo compila y la suite pasa exactamente igual que antes —
listo para que las historias añadan comportamiento real.

---

## Phase 2: User Story 1 - Las fichas se desgastan y se rompen al recibir golpes (Priority: P1) 🎯 MVP

**Goal**: Implementar el mecanismo base: una ficha golpeada avanza su fragilidad; cualquier
ficha que le toque asentarse (golpeadora o desplazada, en cualquier eslabón, incluida una rama
de rojo) se omite en vez de colocarse si su fragilidad es `'broken'`.

**Independent Test**: Fixtures 1 y 2 de `data-model.md` (cadena de 3 eslabones donde ninguna
ficha llega a romperse; una ficha ya CRACKED se rompe y desaparece antes de golpear a la
siguiente) con niveles construidos directamente (sin pasar por `createLevel`, que todavía no
expone fragilidad inicial hasta US4) — verificando el tablero final exacto que devuelve el
motor, headless.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [ ] T006 [P] [US1] `tests/unit/engine/fragility.test.ts` (nuevo fichero): Fixtures 1 y 2 de
      `data-model.md`, más los 4 escenarios Given/When/Then de la Historia 1 del spec (avance
      NEW→CRACKED; avance CRACKED→BROKEN con eliminación al asentarse; varias fichas
      alcanzando BROKEN en la misma cadena, cada una eliminada de forma independiente en su
      propio instante de asentamiento; una ficha eliminada por BROKEN nunca cuenta para el
      goal). Fallará hasta T008.
- [ ] T007 [P] [US1] Extender `tests/unit/engine/red.test.ts` con la Fixture 3 de
      `data-model.md` (rojo golpea a una ficha CRACKED, avanza su estado a BROKEN una sola vez,
      ambas ramas resultantes lo heredan y ninguna llega a asentarse) y un caso positivo
      equivalente (rojo golpea a una ficha NEW, ambas ramas resultantes quedan CRACKED y sí se
      asientan). Fallará hasta T009.

### Implementation for User Story 1

- [X] T008 [US1] `src/engine/pieces/push.ts`, `resolveStrike` — añadir
      `advance(f: 'new' | 'cracked'): 'cracked' | 'broken'` (tipado para excluir `'broken'` de
      la entrada, research.md); avanzar la fragilidad de la defensora justo donde ya se
      determina que va a ser desplazada (antes de calcular `to`); comprobar `fragility ===
      'broken'` justo antes de cada `setPieceAt` que asienta una ficha — tanto la golpeadora de
      este nivel de recursión (en su propia casilla, la que la defensora deja libre) como la
      defensora en su destino (condicionado también, como hoy, a que no se haya aniquilado por
      mismo color). Depende de T005. Hace pasar T006.
- [X] T009 [US1] `src/engine/pieces/push.ts`, `resolveSplit`/`resolveBranch` — la defensora
      golpeada por rojo avanza su fragilidad una vez (mismo `advance()` de T008) antes de
      dividirse; ambas ramas heredan ese estado ya avanzado; cada rama comprueba `'broken'`
      antes de asentarse, igual que en T008. Depende de T008. Hace pasar T007.
- [X] T010 [US1] Revisar las 22 aserciones actualizadas en T004 (`brown.test.ts`,
      `orange.test.ts`, `red.test.ts`, `wrap-around.test.ts`, `launch.test.ts`,
      `session.test.ts`): cualquier ficha que la propia cascada de ESE test golpee de verdad
      pasa a `fragility: 'cracked'`; las que no participan en ninguna colisión de ese lanzamiento
      se quedan en `'new'`. Depende de T008, T009. (También cubrió 5 aserciones equivalentes en
      brown.test.ts traídas por el rebase de T007, no contadas en el recuento original de 22.)
- [X] T011 [US1] Ejecutar `npm test && npm run typecheck`: T006, T007 y T010 en verde, y el
      resto de la suite (niveles del prototipo, generador si aplica) sigue pasando sin cambios
      de comportamiento fuera de lo tocado por esta historia. Depende de T010. **95/95 tests,
      typecheck limpio.**

**Checkpoint**: el mecanismo de desgaste y ruptura está completo y probado — MVP de esta
feature.

---

## Phase 3: User Story 2 - La ficha lanzada permanece en el tablero (Priority: P2)

**Goal**: Extender exactamente el mismo patrón de asentamiento de US1 un nivel más arriba, para
que la ficha lanzada desde la mano deje de ser un caso especial que nunca persiste.

**Independent Test**: Lanzar una ficha NEW o CRACKED contra un tablero con una única ficha de
distinto color y comprobar que la lanzada aparece en el tablero final, en la casilla de su
primer impacto, en vez de desaparecer; lanzar una ficha ya BROKEN (nivel construido a mano,
`Hand`/`Level` directamente) y comprobar que se elimina tras su impacto sin llegar a asentarse.

### Tests for User Story 2 ⚠️ escribir primero, deben fallar antes de implementar

- [ ] T012 [P] [US2] `tests/unit/engine/fragility.test.ts`: los 3 escenarios de la Historia 2
      del spec — ficha NEW lanzada se asienta conservando su estado; ficha ya BROKEN en mano
      (construida directamente como `Hand`/`Level`, sin pasar por `createLevel` — no depende de
      US4) se elimina tras su impacto sin asentarse; un missclick no cambia el estado de la
      ficha lanzada y esta vuelve intacta a la mano. Fallará hasta T013.

### Implementation for User Story 2

- [ ] T013 [US2] `src/engine/pieces/push.ts`, `applyImpact` — tras resolver el impacto inicial
      con `resolveStrike` (sin cambiar su firma ni su comportamiento interno), asentar
      `site.piece` en `site.to` salvo que el resultado haya sido una aniquilación por mismo
      color o que `site.piece.fragility === 'broken'` — mismo patrón exacto que T008 aplica
      dentro de `resolveStrike`, aplicado aquí una vez más (research.md). Depende de T011. Hace
      pasar T012.
- [ ] T014 [US2] Revisar los tests existentes que comprobaban implícitamente que la celda de
      origen de un lanzamiento queda vacía tras el impacto (buscar aserciones sobre esa celda
      concreta en `launch.test.ts`, `chain.test.ts` y cualquier otro fichero que lance una
      ficha NEW/CRACKED contra un objetivo distinto) y actualizarlas para reflejar que ahora esa
      celda puede quedar ocupada por la ficha lanzada, cuando sobrevive. Depende de T013.
- [ ] T015 [US2] Ejecutar `npm test && npm run typecheck`. Depende de T013, T014.

**Checkpoint**: el mecanismo de motor está completo de extremo a extremo (Historias 1 y 2) —
todo lo que falta a partir de aquí es visibilidad para el jugador y autoría de niveles.

---

## Phase 4: User Story 3 - El jugador puede ver el desgaste de cada ficha (Priority: P3)

**Goal**: Diferenciar visualmente el estado de fragilidad de cada ficha en el tablero, sin tocar
ninguna regla de juego.

**Independent Test**: Con el mecanismo de US1/US2 ya funcionando, cargar o construir un nivel
con dos fichas del mismo color y distinto estado y confirmar a simple vista, sin ninguna acción,
cuál está más desgastada (SC-001).

### Implementation for User Story 3

- [ ] T016 [US3] `src/renderer/board-view.ts`, `drawBoard` — añadir una variación visual por
      `piece.fragility` (opacidad, borde o anillo superpuesto sobre el relleno de color ya
      existente — decisión de tratamiento concreto en esta misma tarea) sin introducir ninguna
      lógica de reglas (Principio I). Depende de T015.
- [ ] T017 [US3] Validación manual (`quickstart.md`, "Validación visual"): `npm run dev`,
      confirmar que dos fichas del mismo color en distinto estado se distinguen sin acción
      adicional, y que una ficha desaparece del tablero justo en el instante en que le toca
      asentarse rota, no antes ni en una limpieza aparte. Depende de T016. Sin cobertura Vitest
      propia (mismo criterio ya establecido para `drawBoard`, comentario en el propio fichero).

**Checkpoint**: la fragilidad es visible para el jugador — Historias 1, 2 y 3 completas.

---

## Phase 5: User Story 4 - Los niveles definen el estado inicial de cada ficha (Priority: P4)

**Goal**: Permitir que la definición de un nivel declare el estado de fragilidad inicial de
cualquier ficha, de tablero o de mano, con NEW por defecto y con las fichas de tablero BROKEN
normalizadas a "casilla vacía" antes de que el nivel sea jugable.

**Independent Test**: Construir un nivel con `createLevel` declarando una ficha de tablero
CRACKED y una ficha de mano BROKEN, y comprobar que el nivel resultante las respeta tal cual; un
nivel que no declara nada usa NEW en todas sus fichas; una ficha de tablero declarada BROKEN no
aparece en el tablero resultante.

### Tests for User Story 4 ⚠️ escribir primero, deben fallar antes de implementar

- [ ] T018 [P] [US4] `tests/unit/engine/level.test.ts` (nuevo fichero): los 2 escenarios de la
      Historia 4 del spec (ficha de tablero declarada CRACKED se respeta; nivel sin declarar
      nada usa NEW en todas sus fichas, de tablero y de mano) más FR-016 (ficha de tablero
      declarada BROKEN nunca aparece en el tablero resultante) y un caso de mano BROKEN
      (sí se conserva tal cual, a diferencia del tablero). Fallará hasta T019.

### Implementation for User Story 4

- [ ] T019 [US4] `src/engine/level.ts`, `createLevel` — `PiecePlacement` gana
      `fragility?: Fragility`; nuevo tipo `HandPieceInput = PieceColor | { color: PieceColor;
      fragility?: Fragility }` y `hand: HandPieceInput[]` (data-model.md). La construcción del
      tablero omite cualquier entrada de `pieces` con `fragility: 'broken'` (FR-016); cualquier
      otra entrada, de tablero o de mano, usa `fragility ?? 'new'`. Depende de T005 (Foundational
      ya deja `createLevel` compilando con el shape mínimo; esta tarea añade la capacidad real
      sin depender de US1/US2/US3). Hace pasar T018.
- [ ] T020 [US4] Ejecutar `npm test && npm run typecheck`. Depende de T019.

**Checkpoint**: las 4 historias completas — el mecanismo de motor, su persistencia visual, y la
capacidad de autoría de niveles, todos probados de forma independiente.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [ ] T021 [P] Ejecutar `npm run build`: confirmar que el build del cliente sigue limpio, sin
      ningún rastro de `tools/generator/` (no tocado por esta feature, mismo criterio que
      features anteriores de esta sesión). Depende de T020 (o de que todas las historias que se
      vayan a incluir estén cerradas).
- [ ] T022 Ejecutar la validación completa de `quickstart.md` de principio a fin (motor headless
      + visual manual + build) y confirmar el recuento final de tests de toda la suite. Depende
      de T011, T015, T017, T020, T021.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias — bloquea las 4 historias.
- **User Story 1 (Phase 2)**: depende de Foundational (T005). T006/T007 (tests) se escriben en
  paralelo entre sí; T008 depende de T005 y hace pasar T006; T009 depende de T008 y hace pasar
  T007; T010 depende de T008 y T009; T011 depende de T010.
- **User Story 2 (Phase 3)**: depende de que US1 esté cerrada (T011) — comparten fichero
  (`push.ts`), no son paralelizables entre sí pese a ser historias distintas. T013 depende de
  T011 y hace pasar T012; T014 depende de T013; T015 depende de T013 y T014.
- **User Story 3 (Phase 4)**: depende de que US1+US2 estén cerradas (T015) — necesita estados
  reales que mostrar. T016 depende de T015; T017 depende de T016.
- **User Story 4 (Phase 5)**: depende solo de Foundational (T005) — toca `level.ts`, un fichero
  distinto al de US1/US2/US3, así que puede avanzar en paralelo con ellas. T019 depende de T005
  y hace pasar T018; T020 depende de T019.
- **Polish (Final Phase)**: depende de que todas las historias que se vayan a incluir en esta
  entrega estén cerradas.

### Parallel Opportunities

- T002, T003 y T004 (Foundational) pueden ejecutarse en paralelo — ficheros distintos.
- T006 y T007 (tests de US1) pueden escribirse en paralelo.
- **US4 completa (T018-T020) puede avanzar en paralelo con US1/US2/US3** desde el momento en que
  Foundational cierra — es la única historia realmente independiente del resto en esta feature.
- T021 y T022 no pueden ir en paralelo entre sí (T022 depende de T021).

---

## Parallel Example: al cerrar Foundational

```bash
# En paralelo, tras cerrar T001:
Task: "level.ts: construcción interna compila con fragility:'new' (T002, Foundational)"
Task: "push.ts: resolveBranch compila con fragility:'new' (T003, Foundational)"
Task: "22 aserciones existentes ganan fragility:'new' (T004, Foundational)"
```

## Parallel Example: tras cerrar Foundational

```bash
# En paralelo, una vez cierra T005:
Task: "fragility.test.ts: Fixtures 1 y 2 de data-model.md (T006, US1)"
Task: "red.test.ts: Fixture 3 -- rojo sobre una ficha CRACKED (T007, US1)"
Task: "level.test.ts: estado inicial declarado, FR-016 (T018, US4)"
```

---

## Implementation Strategy

### MVP (Foundational + User Story 1)

1. Fase 1: el tipo existe, todo compila y la suite pasa exactamente igual que antes.
2. Fase 2: una ficha se desgasta y desaparece al romperse, en cualquier punto de una cadena
   (incluida una división de rojo). **STOP y VALIDAR** (T011) — el mecanismo central de esta
   feature ya está hecho y probado, aunque la ficha lanzada todavía desaparezca como hoy.

### Entrega incremental

1. Foundational + User Story 1 → el mecanismo de desgaste funciona de extremo a extremo (MVP).
2. + User Story 2 → la ficha lanzada deja de ser un caso especial.
3. + User Story 3 → el jugador ve el desgaste.
4. + User Story 4 → los niveles pueden declarar estado inicial (puede entregarse en cualquier
   punto tras Foundational, en paralelo con las otras tres).
5. Polish → build limpio, quickstart completo.

---

## Notes

- No hay Setup separado de Foundational — no hace falta ninguna dependencia ni herramienta
  nueva, solo extender un tipo ya existente y devolver la suite a verde.
- US2 depende de US1 por compartir fichero (`push.ts`), no por necesidad conceptual — el patrón
  de asentamiento que reutiliza ya está resuelto en T008.
- US4 es la única historia verdaderamente paralelizable con el resto — tenlo en cuenta si se
  reparte el trabajo.
- Commitear tras cada tarea o grupo lógico, siguiendo el mismo patrón ya usado en las features
  anteriores de esta sesión (011-level-generator-basic, 012-fix-brown-cascade-loop).
