# Tasks: Generador -- Negro como Eliminador de Bloqueantes

**Input**: Design documents from `/specs/026-generator-black-decoys/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla
de interacción de motor/herramientas, mismo patrón que el resto del generador
(`tests/unit/tools/generator/`).

**Organization**: Por user story (US1 = P1, US2 = P1 también, US3 = P1 -- ver spec.md). Precedida
de una fase Foundational con las extensiones de tipo compartidas de las que dependen ambas
estrategias.

**Nota de esta revisión**: el diseño original de esta feature (bloqueantes en el MISMO eje que lo
protegido, seguridad vía un registro estático de señuelos) resultó estructuralmente inviable --
negro limpia la línea ENTERA que recorre, y esa línea es siempre colineal con el objetivo/origen
real, así que limpiarla se llevaba también lo que se quería proteger. El diseño final (perpendicular
+ `validatesForward` como único árbitro, research.md Decisiones 1 y 4) sustituye por completo la
implementación descrita en una versión anterior de este documento. Las tareas de abajo describen lo
que REALMENTE se construyó, ya completado y verificado (276/276 tests, `npm run typecheck` limpio).

## Phase 1: Foundational (bloqueante para las tres historias) -- ✅ COMPLETADA

**Purpose**: Los campos nuevos en `RawLaunch`/`ResolutionOutcome`/`Obligation`, y el parámetro
nuevo en `GenerationParams`, son la base de la que dependen las dos estrategias. Ninguna tarea de
esta fase introduce todavía el retrofit de negro en sí.

- [X] T001 En `tools/generator/obligations.ts`: añadir `target: Coordinate` a `RawLaunch`
  (data-model.md) -- poblado en la rama `chooseHand` de la obligación `'striker-origin'`
  (`rawLaunches.push({..., target: obligation.cell})`). Cambio mecánico, sin alterar ningún
  comportamiento existente.
- [X] T002 En `tools/generator/obligations.ts`: añadir el campo interno `explainsLandingAt?:
  Coordinate` a `Obligation` (data-model.md) -- se fija al construir la obligación
  `'striker-origin'` en la rama NO roja de la resolución de una obligación `'defender'`, con el
  valor de `obligation.cell` del padre.
- [X] T003 En `tools/generator/obligations.ts`: añadir el tipo nuevo `LandingCell = { cell:
  Coordinate; launchIndex: number }` y el campo `landingCells: LandingCell[]` a
  `ResolutionOutcome` (data-model.md; SIN `decoyCells` -- esa idea se descartó por completo,
  research.md Decisión 4). `resolveObligations` empuja `{cell: explainsLandingAt, launchIndex:
  rawLaunches.length - 1}` en la rama `chooseHand`, solo cuando `obligation.explainsLandingAt` está
  definido (research.md Decisión 6: solo cuando resuelve por lanzamiento directo, nunca por
  cadena). Depende de T001, T002.
- [X] T004 [P] En `tools/generator/generate.ts`: añadir `blackLineClearProbability?: number` a
  `GenerationParams` (data-model.md) -- sin wiring todavía, solo el tipo. NO se añade a
  `COMPLEXITY_FACTOR_NAMES` (research.md Decisión 7).
- [X] T005 En `tests/unit/tools/generator/obligations.test.ts`: migrar las 4 aserciones existentes
  sobre `RawLaunch` que usan igualdad estricta (`toEqual`) para incluir el campo `target` nuevo --
  migración mecánica, cero cambio de comportamiento esperado. `npm run typecheck` y `npm test`
  confirmaron que la fase Foundational compila y no rompe nada antes de introducir el retrofit en
  sí. Depende de T001, T002, T003, T004.

**Checkpoint**: Los tipos y el registro de datos existen y compilan, pero nada los usa todavía
para insertar negro.

---

## Phase 2: User Story 1 - Negro protege el carril de aproximación de otro lanzamiento, en perpendicular (Priority: P1) 🎯 MVP -- ✅ COMPLETADA

**Goal**: El generador identifica un lanzamiento de mano ya discutido con un carril despejado, le
coloca un bloqueante obligatorio entre su entrada y su objetivo real (más decorativos opcionales),
e inserta un lanzamiento de negro -- viajando por el eje PERPENDICULAR al del carril protegido,
nunca el mismo eje (research.md Decisión 1) -- inmediatamente antes en el orden de juego.

**Independent Test**: quickstart.md, Escenarios 1 y 2.

### Tests for User Story 1 ⚠️ -- ✅ COMPLETADAS

- [X] T006 [P] [US1] `tests/unit/tools/generator/black-decoys.test.ts` (fichero nuevo): dos tests
  de `buildBlackDecoyCandidates` cubriendo la Estrategia A -- (1) con `scriptedRng([0.5, 0.4, 0.1,
  0.05, 0.1])`, confirma el bloqueante obligatorio colocado en el carril, negro viajando por el eje
  perpendicular (N/S para un carril E/O), y la forma exacta del `RawLaunch` de negro insertado; (2)
  confirma que la celda `target` del lanzamiento protegido queda intacta y que la dirección de
  negro es siempre N o S cuando el carril protegido es E.
- [X] T007 [US1] `tests/unit/tools/generator/generate.test.ts`: bloque
  `describe('generateLevel: 026-generator-black-decoys ...')` con (1) un fuzz de 300 seeds
  (`blackLineClearProbability: 1`) confirmando que todo nivel generado -- con o sin negro -- pasa
  `validatesForward`, y que negro se usa al menos una vez en las 300 tiradas (`sawBlack`); (2) un
  caso concreto (`seed: 2`) confirmando `hand[0] === 'black'`, la forma exacta del primer paso de
  `solution`, y que la ficha objetivo real sobrevive intacta en `pieces`.

### Implementation for User Story 1 -- ✅ COMPLETADA

- [X] T008 [US1] `tools/generator/black-decoys.ts` (nuevo): `buildStrategyACandidate` recorre
  `rawLaunches`, calcula `laneCellsBeforeTarget(direction, lane, target)` (celdas libres entre la
  entrada y el objetivo real) para cada uno, filtra los que tienen al menos una celda libre, elige
  uno al azar y una celda de ese carril como bloqueante obligatorio. Delega en
  `buildPerpendicularCandidate` (compartida con la Estrategia B, T013): calcula el eje
  PERPENDICULAR a la dirección del lanzamiento protegido (tabla `PERPENDICULAR`, research.md
  Decisión 1), elige un lado al azar, añade entre 0 y 6 bloqueantes decorativos en celdas vacías de
  esa misma línea perpendicular (`pickRandomSubset`, Fisher-Yates parcial -- exactamente `count`
  llamadas a `rng()`, nunca un `shuffle` completo), asigna fragilidad vía `assignGroupFragility`
  (misma convención que los señuelos de tablero), y construye+inserta el `RawLaunch` de negro
  inmediatamente después del lanzamiento protegido. Depende de T001.
- [X] T009 [US1] `tools/generator/generate.ts`: extraída `buildLevelFrom(board, rawLaunches,
  goalCell, goalColor, params, rng)` de la lógica que ya tenía `attemptOnce` (fragilidad no
  forzada, `hand`, `solution`, `pieces`, `Level`, `validatesForward`) -- devuelve `null` si no
  valida. `attemptOnce` la llama primero con la solución real; si `blackLineClearProbability` está
  definido y `rng() < blackLineClearProbability` (una sola tirada, justo después de que la solución
  real ya validó, research.md Decisiones 5 y 7), llama a `buildBlackDecoyCandidates` y prueba cada
  candidato con `buildLevelFrom`, quedándose con el primero que valide; si ninguno lo hace, sigue
  con la solución real ya construida. Depende de T008.
- [X] T010 [US1] `npm run typecheck` y `npm test` en verde (T006/T007 incluidos); Escenarios 1-2 de
  quickstart.md confirmados con scripts `npx tsx` ad-hoc contra el generador real (seed 2
  inspeccionado en detalle: negro E/lane1 limpia un bloqueante verde en (1,3) que bloqueaba de
  verdad el segundo lanzamiento S/lane3, sin afectar a la ficha naranja real en (2,3)).

**Checkpoint**: User Story 1 completamente funcional y testeable de forma independiente -- la
Estrategia A protege un carril real de principio a fin, en perpendicular.

---

## Phase 3: User Story 2 - Negro protege una celda de aterrizaje intermedia, en perpendicular a la dirección del empuje (Priority: P1) -- ✅ COMPLETADA

**Goal**: El generador identifica una celda de aterrizaje intermedia cuyo striker resuelve por
lanzamiento directo, le coloca un bloqueante obligatorio directamente encima (más decorativos
opcionales en la línea perpendicular), e inserta negro inmediatamente antes del empuje que la
llena -- viajando en perpendicular a la dirección de ESE empuje (research.md Decisión 1/2).

**Independent Test**: quickstart.md, Escenario 3.

### Tests for User Story 2 ⚠️ -- ✅ COMPLETADAS

- [X] T011 [P] [US2] `tests/unit/tools/generator/black-decoys.test.ts`: test de
  `buildBlackDecoyCandidates` para la Estrategia B -- con `scriptedRng([0.5, 0.1, 0.05, 0.1])`
  (la Estrategia A no encuentra nada, 0 llamadas, porque `target === entry` en ese fixture), el
  bloqueante obligatorio va DIRECTAMENTE sobre la celda de aterrizaje, y negro viaja en
  perpendicular a `rawLaunches[landingCell.launchIndex].direction`.

### Implementation for User Story 2 -- ✅ COMPLETADA

- [X] T013 [US2] `tools/generator/black-decoys.ts`: `buildStrategyBCandidate` -- para cada
  `LandingCell`, el bloqueante obligatorio es directamente `landingCell.cell`; el eje protegido es
  `rawLaunches[landingCell.launchIndex].direction` (research.md Decisión 2: el striker empuja
  siempre en su propia dirección de viaje, ya registrada en `rawLaunches`, sin campo adicional).
  Reutiliza la MISMA `buildPerpendicularCandidate` que la Estrategia A -- la única diferencia entre
  A y B es cómo se elige `blockerCell`/`protectedIndex`/`riskyDirection`. `buildBlackDecoyCandidates`
  construye SIEMPRE ambos candidatos (si cada estrategia encuentra oportunidad) y los devuelve en
  orden `[A, B]` (research.md Decisión 8) -- `generate.ts` los prueba en ese orden con
  `buildLevelFrom` (T009), sin cambios adicionales en `attemptOnce`. Depende de T003, T008.
- [X] T014 [US2] `npm run typecheck` y `npm test` en verde (T011 incluido); Escenario 3 de
  quickstart.md confirmado.

**Checkpoint**: User Stories 1 y 2 funcionan juntas -- ambas estrategias activas están cubiertas y
se prueban en el orden correcto.

---

## Phase 4: User Story 3 - La seguridad de cada candidato se decide reproduciendo la solución completa con el motor real (Priority: P1) -- ✅ COMPLETADA

**Goal**: Confirmar explícitamente que ningún candidato con negro se acepta basándose en una
comprobación estática del tablero inicial -- solo reproducirlo de punta a punta con el motor real
(`validatesForward`) decide si es seguro; si ninguno lo es, el nivel se genera igual, sin negro,
sin que eso haga fallar el intento.

**Independent Test**: quickstart.md, Escenario 4.

### Tests for User Story 3 ⚠️ -- ✅ COMPLETADAS

- [X] T015 [P] [US3] `tests/unit/tools/generator/black-decoys.test.ts`: con `scriptedRng([])`
  (ninguna llamada a `rng()` permitida), `buildBlackDecoyCandidates` sobre un `rawLaunches`/
  `landingCells` sin ninguna oportunidad devuelve `[]` -- ni error ni excepción.
- [X] T016 [US3] `tests/unit/tools/generator/generate.test.ts`: cubierto por el mismo fuzz de 300
  seeds de T007 -- todo nivel generado (con o sin negro) pasa `validatesForward`; cuando
  `buildLevelFrom` rechaza todos los candidatos con negro, el nivel resultante usa la solución
  real ya construida, sin ninguna ficha `'black'` en `hand`. `blackLineClearProbability` ausente/0
  produce cero llamadas nuevas a `rng()` (verificado por el resto de la suite del generador, que no
  cambió de resultado en ningún fixture existente).
- [X] T017 [US3] Verificado ad-hoc (scripts `npx tsx` en el scratchpad, no en la suite permanente):
  56/500 seeds con `blackLineClearProbability: 1` generan con éxito, 44 de ellas incluyen negro, y
  las 44 reproducen correctamente con `validatesForward` -- activar el parámetro nunca redujo la
  tasa de éxito de generación frente a generar sin él en esa muestra, y nunca se observó más de un
  lanzamiento de negro por nivel (FR-012, garantizado estructuralmente porque
  `buildBlackDecoyCandidates` se llama como mucho una vez por intento).

### Implementation for User Story 3 -- ✅ COMPLETADA (sin código adicional)

- [X] T018 [US3] Ninguna implementación nueva -- la garantía la da directamente `buildLevelFrom`
  (T009) devolviendo `null` ante cualquier candidato que no valide, y el bucle de `attemptOnce`
  que sigue con la solución real cuando eso ocurre. Esta historia es de verificación explícita del
  comportamiento ya construido por T008/T009/T013.

**Checkpoint**: Las tres historias de usuario están completas -- `validatesForward` es el único
árbitro de seguridad, sin ningún registro estático, y el carácter oportunista de la feature queda
probado, no solo implícito.

---

## Phase 5: Polish & Cross-Cutting Concerns -- ✅ COMPLETADA

**Purpose**: Cierre de la feature, consistencia con el resto del código, sin comportamiento nuevo.

- [X] T019 [P] Comentarios de `black-decoys.ts`, `obligations.ts` y `generate.ts` en los puntos
  tocados documentan el porqué (el bug del eje colineal, la razón de `validatesForward` como único
  árbitro, la razón de `pickRandomSubset` sobre un `shuffle` completo) -- mismo nivel de detalle
  que el resto del generador.
- [X] T020 `npm run typecheck` y `npm test` completos -- 276/276 tests, 0 regresiones en toda la
  suite existente (spec.md FR-014).
- [X] T021 Escenarios de quickstart.md confirmados manualmente contra el generador real (`npx
  tsx`, scripts temporales en el scratchpad, eliminados tras el uso) -- Success Criteria SC-001 a
  SC-006 de spec.md verificadas concretamente (no solo por inspección de código), incluyendo el
  caso concreto de seed 2 documentado en T010.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias. BLOQUEA las tres historias.
- **User Story 1 (Phase 2)**: depende de Foundational. Es el MVP -- sin ella no hay ninguna
  estrategia real que probar.
- **User Story 2 (Phase 3)**: depende de Foundational Y de T008 (Phase 2) -- reutiliza
  `buildPerpendicularCandidate`, la misma función que construye el candidato de la Estrategia A.
- **User Story 3 (Phase 4)**: depende de T008/T009/T013 (Phases 2-3) -- es puramente
  confirmatoria/de verificación, no añade código nuevo por sí misma.
- **Polish (Phase 5)**: depende de que las tres historias estén completas.

### Parallel Opportunities

- T004 (parámetro nuevo en `generate.ts`) se escribió en paralelo con T001-T003 (`obligations.ts`)
  -- archivos distintos.
- T006 (tests de la Estrategia A) se escribió junto con T008 (implementación), siguiendo
  test-first.
- T011/T015 (tests de la Estrategia B / ausencia de oportunidad) se escribieron en paralelo entre
  sí una vez existía el esqueleto de `buildPerpendicularCandidate` (T008).
- T019 (Polish, documentación) es independiente de T020/T021.

---

## Implementation Strategy (tal y como se ejecutó)

1. Foundational (Phase 1) -- tipos y registro de datos, sin retrofit todavía.
2. User Story 1 (Phase 2, MVP) -- Estrategia A completa, primer test end-to-end verde. **Primera
   versión resultó estructuralmente inviable** (bloqueantes en el mismo eje que lo protegido) --
   corregida a perpendicular antes de continuar (research.md Decisión 1).
3. User Story 2 (Phase 3) -- Estrategia B, reutilizando la misma corrección perpendicular.
4. User Story 3 (Phase 4) -- sustituido el registro estático de señuelos por `validatesForward`
   como único árbitro de seguridad (research.md Decisión 4), tras confirmar con el usuario que la
   comprobación debía basarse en el estado REAL de la partida en el momento de disparo, no en el
   tablero inicial.
5. Polish (Phase 5) -- documentación, verificación final de la suite completa y de los escenarios
   de quickstart.md contra el generador real.
