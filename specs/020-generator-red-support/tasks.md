# Tasks: Ficha Roja en el Generador de Niveles

**Input**: Design documents from `/specs/020-generator-red-support/`
**Prerequisites**: plan.md, research.md, data-model.md, quickstart.md

**Tests**: Incluidos -- Principio II de la constitución (test-first) exige tests para toda regla
de interacción nueva; este proyecto los ha incluido en toda feature anterior (011/013/014/017/019).

**Organization**: Por user story (US1 = P1, US2 = P2), igual que el resto del repo.

## Phase 1: Setup

- [X] T001 Añadir el 3er nivel de `availableColors` (`["green","orange","brown","red"]`) en
  `tools/generator/complexity-config.json` (FR-006).

**Checkpoint**: Configuración lista; no bloquea el resto (los tests de US1 no dependen de leer
este fichero para ejercitar `resolveObligations` directamente).

## Phase 2: Foundational (bloqueante para ambas historias)

**Purpose**: La matemática del origen de rojo y los campos nuevos del `Obligation` son
compartidos por US1 y US2 -- ninguna historia puede implementarse sin esto.

- [X] T002 En `tools/generator/inverses.ts`: extender `InverseColor` a incluir `'red'`; añadir la
  rama `strikerColor === 'red'` en `inverseCandidates` (misma fórmula que `'green'`,
  `stepBackward(to, direction, 1)`, devolviendo `[]` cuando `context !== 'settle'` --
  research.md Decisión 1 y 4).
- [X] T003 [P] En `tools/generator/obligations.ts`: añadir `forceFurniture?: boolean` y
  `furnitureFragility?: Fragility` a `Obligation`; importar `Fragility` si hace falta
  (data-model.md).
- [X] T004 En `tools/generator/obligations.ts`: en el bloque `kind === 'defender'`, cambiar
  `mustFurniture` a `obligation.forceFurniture || launchesUsed >= ctx.launchCount` y la
  colocación de mobiliario a `fragility: obligation.furnitureFragility ?? 'new'` (research.md
  Decisión 5/6). Depende de T003.
- [X] T005 En `tools/generator/obligations.ts`: eliminar el cast
  `striker as 'green' | 'orange' | 'brown'` en `chooseStrikerAndOrigin` (ya no hace falta,
  `InverseColor` cubre los 4 colores). Depende de T002.
- [X] T006 En `tools/generator/obligations.ts`: en el bloque `kind === 'striker-origin'`, filtrar
  `'red'` de `ctx.availableColors` antes de llamar a `chooseStrikerAndOrigin` con contexto
  `'occupied'` (research.md Decisión 4, cinturón y tirantes con T002).
- [X] T007 [P] En `tools/generator/obligations.ts`: añadir la tabla local
  `RED_STRIKE_DIRECTIONS_FOR_BRANCH` e importar `opposite` de `../../src/engine/move-step.js`
  (research.md Decisión 7).

**Checkpoint**: La infraestructura de tipos/funciones existe; nada la usa todavía (ninguna
obligación puede resultar en `striker: 'red'` hasta la Fase 3).

## Phase 3: User Story 1 - Construir un nivel cuya solución use un split de rojo (P1) 🎯 MVP

**Goal**: El generador puede resolver una obligación `'defender'` mediante un split de rojo,
produciendo niveles reales cuya `solution` pasa por un golpe de rojo, sin romper ningún caso sin
rojo.

**Independent Test**: Generar un lote con `availableColors` incluyendo rojo y confirmar que al
menos un nivel resultante tiene una `solution` que pasa por rojo, reproduciéndola con el motor
real; confirmar cero regresión en un lote sin rojo (quickstart.md, Escenarios 1 y 2).

### Tests for User Story 1 ⚠️

- [X] T008 [P] [US1] En `tests/unit/tools/generator/inverses.test.ts`: test para
  `inverseCandidates('red', direction, to, board, 'settle')` devolviendo exactamente
  `[stepBackward(to, direction, 1)]` (mismo valor que `'green'` para el mismo `to`/`direction`),
  y `inverseCandidates('red', ..., 'occupied')` devolviendo `[]`.
- [X] T009 [P] [US1] En `tests/unit/tools/generator/obligations.test.ts`: test con un `rng`
  guionado que fuerza a `chooseStrikerAndOrigin` a elegir `'red'`, verificando que
  `resolveObligations` empuja exactamente 3 obligaciones nuevas: `defender` en `C` con
  `forceFurniture: true`, `striker-origin` de `'red'` en `C` con una de las 2 direcciones
  perpendiculares válidas, y `defender` en `landingCell` con `furnitureFragility: 'cracked'`.
- [X] T010 [P] [US1] En `tests/unit/tools/generator/obligations.test.ts`: test confirmando que la
  obligación `'defender'` de `D` (forceFurniture) SIEMPRE se coloca con `fragility: 'new'`
  incluso con un `rng` que, sin `forceFurniture`, habría elegido continuar la cadena (FR-002,
  SC-003).
- [X] T011 [P] [US1] En `tests/unit/tools/generator/obligations.test.ts`: test confirmando que
  `chooseStrikerAndOrigin` invocado con contexto `'occupied'` NUNCA devuelve `striker: 'red'`
  aunque `'red'` esté en `availableColors` y el `rng` lo favorezca (research.md Decisión 4).
- [X] T012 [US1] En `tests/unit/tools/generator/generate.test.ts`: test de integración -- con un
  `rng` guionado (o iterando semillas reales de `createRng`) que produce un nivel con rojo en la
  solución, confirmar `validatesForward(level, solution) === true` y que al menos un paso de
  `solution` tiene `pieceIndex`/color correspondiente a una ficha `'red'` en la mano generada.
- [X] T013 [P] [US1] En `tests/unit/tools/generator/generate.test.ts`: test de NO regresión --
  con el mismo `params`/seed usados en un fixture YA EXISTENTE de este fichero (sin `'red'` en
  `availableColors`), confirmar que el resultado es byte a byte idéntico al de antes de esta
  feature (FR-007/SC-005).

### Implementation for User Story 1

- [X] T014 [US1] En `tools/generator/obligations.ts`, bloque `kind === 'defender'` tras obtener
  `resolved` de `chooseStrikerAndOrigin`: añadir la rama `if (resolved.striker === 'red') { ... }`
  que sortea `redStrikeDirection`, calcula `secondaryDirection`/`landingCell`, y empuja las 3
  obligaciones descritas en data-model.md -- con `continue` para no caer en la rama existente de
  2 obligaciones. Depende de T002-T007 y hace pasar T009-T011.
- [X] T015 [US1] REVERTIDA: se intentó excluir `'red'` de las candidatas de `goalColor` en
  `tools/generator/generate.ts`, `attemptOnce`, pero era un error -- el usuario señaló que rojo,
  como ficha GOLPEADA (no golpeadora), se desplaza igual que cualquier otro color y puede
  asentarse en el objetivo sin disparar ningún split (verificado con el motor real). Revertido a
  `goalColor` sin ninguna exclusión, idéntico al código anterior a esta feature (research.md,
  Decisión 8 corregida).

**Checkpoint**: US1 es funcional de punta a punta -- `npm test` en verde para
`tests/unit/tools/generator/` y `tests/unit/engine/` (sin tocar el motor, solo confirmando que
sigue en verde).

## Phase 4: User Story 2 - La rama secundaria puede tener su propia cadena (P2)

**Goal**: La obligación de la rama secundaria se somete al mismo sorteo
mobiliario-vs-cadena que cualquier otra, en vez de estar limitada siempre a mobiliario.

**Independent Test**: Generar un lote grande con rojo disponible y `chainOriginProbability`/
`defenderContinuationProbability` altos, y confirmar que entre los niveles con rojo en la
solución, al menos algunos tienen la rama secundaria explicada por su propia cadena en vez de
mobiliario, con la fragilidad `'cracked'` verificada en el punto exacto del golpe (quickstart.md,
Escenario 3).

> Nota: Ningún cambio de código es exclusivo de esta historia -- T014 ya empuja la obligación de
> la rama secundaria SIN `forceFurniture`, así que ya participa en el sorteo existente de
> `defenderContinuationProbability` desde que se implementó US1. Esta fase es principalmente de
> verificación explícita (para que quede probado como comportamiento intencional, no accidental).

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] En `tests/unit/tools/generator/obligations.test.ts`: test con un `rng`
  guionado que, tras elegir `'red'`, hace que la obligación de la rama secundaria NO se resuelva
  como mobiliario (supera `defenderContinuationProbability`) -- confirmar que
  `chooseStrikerAndOrigin(obligationColor, someDirection, landingCell, board, availableColors,
  'settle', rng)` se invoca para ella y que, cuando se resuelve, la pieza que termina en
  `landingCell` (tras jugar la construcción con el motor real) tiene fragilidad `'cracked'`
  (FR-004, Acceptance Scenario 3 de US2).
- [X] T017 [P] [US2] En `tests/unit/tools/generator/obligations.test.ts`: test confirmando que,
  cuando la rama secundaria SÍ se resuelve como mobiliario, su fragilidad es `'cracked'` (nunca
  `'new'`, a diferencia de mobiliario normal) -- Acceptance Scenario 2 de US2.
- [X] T018 [US2] En `tests/unit/tools/generator/generate.test.ts`: test de integración -- iterando
  semillas con `chainOriginProbability`/`defenderContinuationProbability` altos y rojo
  disponible, confirmar que al menos un nivel generado (de un lote representativo) tiene, en su
  `pieces` final, una pieza `'cracked'` en una celda que no es ni el punto de split ni la celda
  del objetivo -- evidencia de cadena real en la rama secundaria (SC-004).

### Implementation for User Story 2

- [X] T019 [US2] Si T016-T018 revelan cualquier discrepancia (por ejemplo, que
  `defenderContinuationProbability` no se está leyendo correctamente para esta obligación, o que
  la fragilidad se pierde en algún punto de la reconstrucción), corregir en
  `tools/generator/obligations.ts`. Si los tests ya pasan con el código de la Fase 3 sin cambios,
  marcar esta tarea como verificación-only (sin diff).

**Checkpoint**: Ambas historias de usuario completas e independientemente verificadas.

## Phase 4.5: User Story 3 - Regenerar `levels/` desde cero con rojo disponible (P3, añadida durante la implementación)

**Goal**: sustituir el lote de 140 niveles (ninguno con rojo) por uno nuevo de 150 (10 por cada
uno de los 15 valores válidos de `complexityScore`, 7-21), con rojo genuinamente presente en una
fracción significativa.

**Independent Test**: ver quickstart.md, Escenario 4.

- [X] T024 [US3] Confirmar el nuevo rango válido de `complexityScore` tras FR-006:
  `complexityRange(loadComplexityConfig(), new Set())` -- verificado `{min:7, max:21}` (antes
  `{min:7, max:20}`).
- [X] T025 [US3] Borrar `levels/*.json`, resetear `levels/index.json` a `[]` y
  `levels/.next-id.txt` a `1`.
- [X] T026 [US3] Descartar `tools/generator/batch.ts --count 10` tal cual para las puntuaciones
  más difíciles -- research.md Decisión 11 documenta por qué (la tasa de éxito por semilla cae
  con fuerza en las puntuaciones altas, ya ANTES de esta feature). Usar en su lugar un script
  puntual que, por cada `complexityScore` de 7 a 21, sigue probando semillas consecutivas hasta
  acumular exactamente 10 éxitos.
- [X] T027 [US3] Ejecutar la regeneración completa (15 valores × 10 éxitos = 150 niveles).
  Resultado real: 12 a 199 semillas necesarias según la dificultad (creciente).
- [X] T028 [US3] Escribir y ejecutar un script de verificación puntual que lea cada
  `levels/<id>.json`, reproduzca su `solution` con el motor real, y confirme 100% `'won'`.
  Resultado real: 150/150, 0 fallos.
- [X] T029 [US3] Contar cuántos niveles del nuevo lote usan rojo (mano, tablero, u objetivo).
  Resultado real: 69/150 (46%) -- confirma SC-006/SC-001 a escala de lote completo, no solo en
  fixtures individuales.

**Checkpoint**: `levels/` reemplazado por completo; 150 niveles, 100% `'won'`, 46% usan rojo.

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T020 [P] Ejecutar `npm test -- tests/unit/levels/` (reverificación de los prototipos 14/15
  -- este directorio nunca cubrió el lote generado en `levels/*.json`, ver T028 para esa
  verificación) -- confirmar cero regresión.
- [X] T021 [P] Ejecutar `npm run typecheck` (o el comando equivalente del repo) para confirmar que
  los tipos nuevos (`InverseColor`, `Obligation.forceFurniture/furnitureFragility`) no rompen
  ninguna inferencia existente.
- [X] T022 Revisar los comentarios de `tools/generator/obligations.ts`/`inverses.ts` añadidos en
  esta feature contra el estilo ya existente (explican el PORQUÉ, referencian
  020-generator-red-support, no repiten el qué) -- ajustar si hace falta.
- [X] T023 Ejecutar el quickstart.md completo (los 4 escenarios) manualmente o vía un script
  temporal, confirmando SC-001 a SC-005 antes de dar la feature por terminada.

## Dependencies & Execution Order

- **Setup (T001)**: sin dependencias.
- **Foundational (T002-T007)**: bloquea toda la Fase 3 y 4. T004 depende de T003. T005/T006
  dependen de T002. T007 es independiente del resto de Foundational.
- **US1 (T008-T015)**: depende de Foundational completa. Tests (T008-T013) antes que
  implementación (T014-T015) -- deben fallar primero.
- **US2 (T016-T019)**: depende de US1 completa (reutiliza el mismo camino de código, T014). No
  bloquea nada más.
- **Polish (T020-T023)**: depende de US1 y US2 completas.

### Parallel Opportunities

- T003 y T007 pueden ir en paralelo con T002 (ficheros/áreas distintas dentro de obligations.ts,
  aunque T004/T005/T006 sí dependen secuencialmente de T002/T003).
- T008, T009, T010, T011 son archivos/bloques de test independientes -- paralelizables entre sí.
- T016, T017 son paralelizables entre sí; T018 depende conceptualmente de que T014 ya exista pero
  no de T016/T017.
- T020, T021 son paralelizables entre sí y con T022.

## Implementation Strategy

**MVP = US1 (Fases 1-3)**: con eso el generador ya produce niveles reales con rojo en la
solución, cumpliendo la razón de ser de la feature. US2 (Fase 4) amplía la variedad pero no es
necesaria para que la feature sea útil de forma independiente -- exactamente como marca su
prioridad P2 en spec.md.
