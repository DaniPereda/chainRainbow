# Tasks: Ficha Negra (Limpieza de Línea)

**Input**: Design documents from `/specs/023-black-piece-line-clear/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla
de interacción de motor, y este proyecto los ha incluido en toda feature de motor anterior
(red.test.ts, brown.test.ts, push.test.ts...).

**Organization**: Por user story (US1 = P1, US2 = P1 también, US3 = P2 -- ver spec.md).

## Phase 1: Foundational (bloqueante para las tres historias)

**Purpose**: El color nuevo y la función pura de limpieza son la base de las tres historias --
ninguna puede implementarse sin esto.

- [X] T001 En `src/engine/board.ts`: añadir `'black'` a `PieceColor` (data-model.md, "PieceColor
  (extendida)").
- [X] T002 En `src/engine/pieces/push.ts`: actualizar `PUSH_STRATEGY: Record<Exclude<PieceColor,
  'red'>, ...>` a `Record<Exclude<PieceColor, 'red' | 'black'>, ...>` -- corrección de
  compilación inmediata tras T001 (negro tampoco empuja, igual que rojo; research.md Decisión 4).
  Depende de T001.
- [X] T003 En `src/engine/pieces/push.ts`: añadir las dos funciones internas nuevas (no
  exportadas, mismo criterio que `stepWalking`/`advance`) -- `lineFromImpact(to, direction):
  {axis, index}` (N/S → columna de `to.col`; E/O → fila de `to.row`, FR-002/FR-003) y
  `clearLine(board, axis, index): {board, clearedCells}` (recorre las 8 casillas del eje en
  orden creciente, vacía las ocupadas, data-model.md). Depende de T001.
- [X] T004 [P] En `src/renderer/board-view.ts`: añadir `black` a `PIECE_COLOR` (un gris muy
  oscuro, no negro puro, para que se distinga del fondo del tablero -- ajustar el valor exacto
  contra la app real antes de cerrar esta tarea). `hand-panel.ts` lo hereda sin cambios (importa
  `PIECE_COLOR` de aquí).

**Checkpoint**: El color existe y compila; nada dispara todavía la limpieza de línea.

## Phase 2: User Story 1 - Lanzar una ficha negra limpia toda su fila o columna (Priority: P1) 🎯 MVP

**Goal**: Una ficha negra lanzada desde la mano, al encontrar cualquier ficha en su camino, limpia
toda la fila (E/O) o columna (N/S) completa por la que viajaba -- incluida ella misma (FR-004) --
en vez de empujar o dividir.

**Independent Test**: quickstart.md, Escenario 1 -- lanzar negra por una fila con tres fichas
repartidas y confirmar que las tres desaparecen junto con la propia negra, sin afectar a otras
filas.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] En `tests/unit/engine/black.test.ts` (fichero nuevo): test de `applyImpact`
  con `site.piece.color === 'black'` llegando en dirección E u O contra un tablero con varias
  fichas de distinto color en esa misma fila (alguna NO adyacente a la casilla de impacto) --
  confirmar un `ANNIHILATION` por cada una (incluida la propia negra, con su `from`/`direction`
  reales) y que el tablero resultante no tiene ninguna ficha en esa fila.
- [X] T006 [P] [US1] En `tests/unit/engine/black.test.ts`: mismo caso pero en dirección N o S --
  confirmar que se limpia la COLUMNA completa, y que una ficha de control situada en la misma
  fila del impacto pero en otra columna NO desaparece (aísla el eje correcto).
- [X] T007 [US1] En `tests/unit/engine/black.test.ts`: test end-to-end vía `resolveLaunch`
  reproduciendo quickstart.md Escenario 1 -- confirmar el `EventLog` y el tablero final
  completos, verificados contra el motor real antes de fijarlos como expectativa (no asumir la
  secuencia exacta).

### Implementation for User Story 1

- [X] T008 [US1] En `src/engine/pieces/push.ts`, `applyImpact`: añadir la rama nueva
  `defender.color === 'black' || site.piece.color === 'black'`, comprobada DESPUÉS de la regla de
  mismo color ya existente (`defender.color === site.piece.color`) y ANTES de cualquier rama
  específica de color del atacante (incluida `site.piece.color === 'red'`) -- data-model.md,
  "Limpieza de línea". Calcula `{axis, index}` con `lineFromImpact(site.to, site.direction)`,
  llama a `clearLine`, y construye los eventos: un `ANNIHILATION` por cada celda de
  `clearedCells` (`from === at`) más un `ANNIHILATION` para la propia `site.piece` (`at:
  site.to`, `from`/`direction` reales de su propio impacto, FR-004) -- devuelve `nextSites: []`
  siempre (research.md Decisión 4: negro nunca continúa). Depende de T001, T002, T003.

**Checkpoint**: US1 completa y testeable de forma independiente. `npm test` en verde para
`black.test.ts`.

## Phase 3: User Story 2 - Una ficha negra asentada en el tablero limpia su fila o columna al ser golpeada (Priority: P1)

**Goal**: Una ficha negra ya en el tablero, golpeada por cualquier otra ficha (incluida rojo),
limpia toda su fila o columna según la dirección del golpe, en vez de empujarse o dividirse --
research.md Decisión 3.

**Independent Test**: quickstart.md, Escenario 2 (columna) y Escenario 3 (precedencia sobre
rojo) -- una negra asentada, golpeada desde el norte, limpia su columna sin afectar a una ficha
de control en su misma fila; golpeada por rojo, se limpia la línea en vez de producirse la
ramificación habitual.

### Tests for User Story 2 ⚠️

- [X] T009 [P] [US2] En `tests/unit/engine/black.test.ts`: una negra asentada golpeada por una
  ficha de distinto color llegando desde N o S -- confirmar que se limpia su COLUMNA completa y
  que una ficha de control en su misma fila (otra columna) no desaparece.
- [X] T010 [P] [US2] En `tests/unit/engine/black.test.ts`: mismo caso pero el golpe llega desde E
  u O -- confirmar que se limpia su FILA completa.
- [X] T011 [US2] En `tests/unit/engine/red.test.ts` (junto a los tests ya existentes de la
  ramificación de rojo) o `tests/unit/engine/black.test.ts`: rojo golpea a una negra asentada --
  confirmar que el `EventLog` NO contiene ningún `MOVE_STEP` de dos ramas perpendiculares (la
  ramificación habitual de rojo, spec.md 009) y que en su lugar se limpia la línea
  correspondiente, con `direction` igual a la del impacto rojo (quickstart.md Escenario 3,
  research.md Decisión 3).

### Implementation for User Story 2

- [X] T012 [US2] Ejecutar T009-T011 contra la implementación de T008 (Phase 2). Dado que la rama
  añadida en T008 ya comprueba `defender.color === 'black'` ANTES de la rama roja, US2 (incluida
  la precedencia sobre rojo) debería quedar satisfecha sin ningún cambio de código adicional --
  si algún test falla, corregir el orden/condición de la rama en `applyImpact` (`push.ts`) hasta
  que pase. Si todos pasan sin diff, marcar como verificación-only (mismo patrón que T012 de
  021-cellwise-collision-resolution).

**Checkpoint**: US1 y US2 completas. `npm test` en verde.

## Phase 4: User Story 3 - Negro contra negro sigue siendo una aniquilación por mismo color (Priority: P2)

**Goal**: Un impacto de negro contra otra negra sigue produciendo la aniquilación por mismo color
ya existente, sin que se dispare ninguna limpieza de línea (FR-006).

**Independent Test**: quickstart.md, Escenario 4 -- dos negras chocan, ambas desaparecen, una
ficha de control en la misma fila/columna permanece intacta.

### Tests for User Story 3 ⚠️

- [X] T013 [P] [US3] En `tests/unit/engine/black.test.ts`: negra golpea a otra negra -- confirmar
  exactamente un `ANNIHILATION` (las dos negras) y que una ficha de control situada en la misma
  fila o columna del impacto NO desaparece (prueba negativa: si la limpieza se hubiera disparado
  por error, esa ficha de control habría desaparecido también).

### Implementation for User Story 3

- [X] T014 [US3] Ejecutar T013 contra la implementación de T008. La comprobación de mismo color
  (`defender.color === site.piece.color`) ya existente se sigue evaluando ANTES que la rama nueva
  de T008 -- no debería hacer falta ningún cambio de código. Si T013 falla, corregir el orden de
  las comprobaciones en `applyImpact` hasta que la regla de mismo color vuelva a tener prioridad.

**Checkpoint**: Las tres historias completas y verificadas de forma independiente.

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T015 [P] En `tests/unit/engine/black.test.ts` o `tests/unit/engine/launch.test.ts`: caso
  explícito de missclick con negro (carril de lanzamiento completamente vacío) -- confirma FR-007
  con el mismo patrón que ya tiene `red.test.ts` ("returns the piece to hand... FR-007"), aunque
  el mecanismo ya sea genérico por color.
- [~] T016 [P] (Opcional, APLAZADA) En `src/renderer/sound-effects.ts`: `playLineClearSound()`
  nuevo. Aplazada deliberadamente tras T019: detectar "este grupo es una limpieza de línea" sin
  una heurística frágil habría exigido justo el tipo de señal explícita que la Decisión 5 de
  research.md ya tuvo que añadir para la ANIMACIÓN (el agrupamiento de padres) -- reutilizarla
  para el sonido es viable pero es una iteración aparte, no bloqueante; por ahora cada
  `ANNIHILATION` sigue con `playImpactSound()` genérico, que ya suena razonablemente bien en la
  verificación visual (varios impactos cortos superpuestos).
- [X] T017 [P] Ejecutar `npm run typecheck` -- confirmar que T001/T002 no dejan ningún
  `Record<PieceColor, ...>` sin actualizar en el resto del árbol (ya auditado: solo
  `PIECE_COLOR` y `PUSH_STRATEGY` son exhaustivos; `tools/generator/` usa `PieceColor[]` sueltos,
  sin romperse).
- [X] T018 [P] Ejecutar `npm test` -- confirmar 0 regresiones fuera de los ficheros tocados
  deliberadamente por esta feature (`black.test.ts` nuevo; `red.test.ts` con el caso nuevo de
  T011).
- [X] T019 Verificación visual manual (quickstart.md Escenario 7): nivel de prueba puntual (no
  comprometido) con negra en mano y verde/naranja/marrón repartidos en una fila, lanzada por
  `dev-levels.html`. Encontró DOS bugs reales de renderer no cubiertos por ningún test unitario
  (ambos solo posibles porque `from === at`, algo que ningún `ANNIHILATION` anterior a esta
  feature producía nunca) -- documentados y arreglados como research.md Decisión 5: (1)
  `cellPath`/`walkPath` no sabían animar distancia cero, daban una vuelta entera al tablero antes
  de desvanecerse; (2) las fichas barridas se encadenaban una detrás de otra en vez de
  desvanecerse juntas (`computeEventParents` necesitó propagar su caída de respaldo entre eventos
  consecutivos sin causa real, con un test de regresión nuevo en
  `tests/unit/renderer/launch-animation.test.ts`). Reverificado en vivo tras el arreglo: las
  cuatro fichas desaparecen juntas, sin vuelta ni secuencia.
- [X] T020 Comentarios revisados en `push.ts`/`board.ts`/`launch-animation.ts` -- explican el
  PORQUÉ (incluidos los dos bugs de T019) y referencian 023-black-piece-line-clear/research.md,
  sin repetir el qué.

## Dependencies & Execution Order

- **Foundational (T001-T004)**: T001 bloquea T002 (Exclude ya no compila sin el ajuste) y T003
  (necesita `PieceColor` con `'black'`). T004 es independiente (renderer). Bloquea las tres
  historias.
- **US1 (T005-T008)**: depende de Foundational. Tests (T005-T007) antes que implementación
  (T008) -- deben fallar primero.
- **US2 (T009-T012)**: depende de US1 completa (reutiliza la misma rama de `applyImpact`
  añadida en T008). No bloquea nada más.
- **US3 (T013-T014)**: depende de US1 completa (misma razón). Independiente de US2.
- **Polish (T015-T020)**: depende de US1, US2 y US3 completas.

### Parallel Opportunities

- T004 es paralelizable con T002/T003 (ficheros distintos).
- T005, T006 son bloques de test independientes entre sí -- paralelizables.
- T009, T010 son paralelizables entre sí (igual razón).
- T013 es independiente de T009-T011 (ficheros/casos distintos) -- paralelizable.
- T015, T016, T017, T018 son paralelizables entre sí.

## Implementation Strategy

**MVP = US1 (Phases 1-2)**: con eso el comportamiento que define a la pieza (lanzarla limpia una
línea) queda resuelto y demostrable. US2 (Phase 3) y US3 (Phase 4) son, en la práctica,
verificación de que la MISMA rama añadida en T008 ya generaliza correctamente a "negra como
defensora" y "negro contra negro sigue siendo mismo color" sin código adicional -- research.md ya
predice esto explícitamente (Decisión 3), pero los tests dedicados de cada historia son los que
lo confirman en vez de asumirlo.

**Fuera de alcance de esta feature** (ver plan.md, Technical Context): soporte en
`tools/generator/` para que el generador construya/invierta niveles usando negro, y niveles de
prototipo dedicados en `src/levels/prototype-levels.ts` -- mismo patrón secuencial que
009-red-piece (motor) → PR #9 (niveles de prototipo) → 020-generator-red-support (generador),
cada uno como feature/PR separada.
