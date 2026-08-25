---

description: "Task list template for feature implementation"
---

# Tasks: Generador de Niveles por Construcción Inversa (verde/naranja/marrón)

**Input**: Design documents from `/specs/011-level-generator-basic/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (todos presentes)

**Tests**: No opcionales (Principio II en espíritu, aplicado también a `tools/`) — el algoritmo
es determinista dado un `rng` inyectado, y se prueba en aislamiento antes de tocar el bucle
completo de generación.

**Organization**: 3 historias de usuario (US1 P1, US2 P2, US3 P3). El algoritmo completo (cola de
obligaciones, los dos modos de marrón, control del número de lanzamientos, validación hacia
delante, descartar-y-reintentar) se construye dentro de US1 — US2 verifica esa misma
implementación con casos más profundos (varios lanzamientos, cadenas más largas), sin código
propio, mismo patrón ya usado en las features 007/008/009/010. US3 sí añade código nuevo (fichas
señuelo), por ser un paso posterior sobre el generador ya funcional.

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Proyecto único ya existente. Nuevo árbol `tools/generator/` fuera de `src/` (ver plan.md), y sus
tests en `tests/unit/tools/generator/` (ya cubiertos por el `include` de `vitest.config.ts` sin
cambios). `tsconfig.json` gana `tools` en su propio `include`.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: la fuente de aleatoriedad con semilla (necesaria para cualquier ejecución real del
generador, aunque los tests del algoritmo en sí inyecten un `rng` guionizado) y la cobertura de
`typecheck` sobre el nuevo árbol.

**⚠️ CRITICAL**: Ninguna historia empieza hasta cerrar esta fase.

- [X] T001 En `tsconfig.json`, añadir `"tools"` al array `include`, para que
      `npm run typecheck` cubra el código nuevo. Sin ningún otro cambio de configuración.
- [X] T002 [P] `tests/unit/tools/generator/rng.test.ts`: la misma semilla produce siempre la
      misma secuencia de valores; semillas distintas producen secuencias distinguibles. Fallará
      hasta T003.
- [X] T003 `tools/generator/rng.ts`: PRNG determinista con semilla (mulberry32 o equivalente,
      research.md — sin dependencia externa nueva). Depende de T001. Hace pasar T002.

**Checkpoint**: existe una fuente de aleatoriedad reproducible — las historias pueden empezar.

---

## Phase 2: User Story 1 - Generar un nivel resoluble de un solo lanzamiento (Priority: P1) 🎯 MVP

**Goal**: Construir un nivel hacia atrás desde el objetivo usando verde/naranja/marrón, validarlo
reproduciéndolo con el motor real, y descartar-y-reintentar si algo no coincide.

**Independent Test**: Fixtures 1, 2 y 3 de data-model.md (verde simple; marrón en modo
asentamiento directo, borde lejano; cascada de dos eslabones) con una fuente de aleatoriedad
guionizada — cada una produce exactamente el `GeneratedLevel` esperado, y su `solution`,
reproducida con `resolveLaunch` del motor real, siempre da `result:'won'`.

### Tests for User Story 1 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T004 [P] [US1] `tests/unit/tools/generator/inverses.test.ts`: inversos de verde y naranja
      (unívocos, con wrap-around); marrón en modo "asentamiento directo" (solo válido si la
      casilla de llegada es el borde lejano de su carril — research.md); marrón en modo "destino
      ocupado" (conjunto de candidatos con camino despejado hacia una casilla ya ocupada).
      Fallará hasta T007.
- [X] T005 [P] [US1] `tests/unit/tools/generator/obligations.test.ts`: resolver una obligación
      con un empuje encola dos obligaciones independientes en la misma casilla (defensor y
      origen del golpeador, cada una con su propio color); el golpeador elegido nunca puede
      coincidir con el color de la obligación que resuelve; cerrar una obligación de origen de
      golpeador como lanzamiento de mano exige camino despejado desde el borde de entrada.
      Fallará hasta T008.
- [X] T006 [P] [US1] `tests/unit/tools/generator/generate.test.ts`: fixtures 1, 2 y 3 de
      data-model.md con `rng` guionizado — cada una produce el `GeneratedLevel` exacto esperado,
      y reproducir su `solution` con `resolveLaunch` del motor real da `result:'won'`. Fallará
      hasta T009.

### Implementation for User Story 1

- [X] T007 [US1] `tools/generator/inverses.ts`: inversos de verde/naranja/marrón según
      research.md/data-model.md (importando `step`/`stepBy`/`stepUntilBlocked`/`wrapCoordinate`
      directamente de `src/engine/move-step.js`/`src/engine/board.js`, mismo patrón que ya usan
      los tests del motor — sin tocar `src/engine/index.ts`). Depende de T003. Hace pasar T004.
- [X] T008 [US1] `tools/generator/obligations.ts`: tipos `Obligation`/`SolutionStep`, la cola, y
      la resolución de obligaciones defensor y origen-de-golpeador (exclusión de mismo color,
      dirección heredada vs. nueva, requisito de camino despejado desde el borde). Depende de
      T007. Hace pasar T005.
- [X] T009 [US1] `tools/generator/generate.ts`: el bucle completo — elegir objetivo (color +
      casilla) con el `rng`, encolar la obligación inicial (siempre resuelta con un empuje),
      drenar la cola, revertir el orden de los `SolutionStep` recogidos y asignarles su
      `pieceIndex`, reproducir la traza completa con `resolveLaunch` del motor real, y la
      política de descartar-y-reintentar (FR-007) hasta `maxGenerationAttempts`. Depende de
      T008. Hace pasar T006.
- [X] T010 [US1] `tools/generator/index.ts`: reexporta `generateLevel` y los tipos públicos
      (`GenerationParams`, `GeneratedLevel`, `SolutionStep`, `GenerationResult`). Depende de
      T009.
- [X] T011 [US1] Ejecutar `npm test && npm run typecheck`: confirmar que T002, T004, T005 y T006
      pasan (verde) y que el resto de la suite (motor, niveles del prototipo) sigue en verde sin
      cambios de comportamiento. Depende de T009, T010.

**Checkpoint**: el generador construye y valida niveles de un solo lanzamiento — MVP de esta
feature completo.

---

## Phase 3: User Story 2 - Encadenar varios lanzamientos con orígenes en cadena (Priority: P2)

**Goal**: Confirmar que el mismo mecanismo de US1 escala a más de un lanzamiento y a cadenas más
profundas, sin ningún código nuevo.

**Independent Test**: Pedir un nivel con `launchCount:2` y una probabilidad alta de "origen en
cadena"; comprobar que la construcción produce dos lanzamientos de mano independientes y que al
menos un lanzamiento de la secuencia de referencia desencadena una cascada de más de un evento al
reproducirlo con el motor real.

### Implementation for User Story 2

- [X] T012 [US2] Fixture con `launchCount:2` en `generate.test.ts`, `rng` guionizado para
      producir dos cadenas independientes (dos lanzamientos de mano distintos, cada uno con su
      propia obligación inicial y su propio empuje) — confirma que el contador `launchesUsed`
      controla correctamente más de un lanzamiento. Depende de T009 — verificación pura de la
      misma implementación de US1, sin código nuevo (mismo patrón que las features
      007/008/009/010).
- [X] T013 [US2] Fixture de profundidad de cadena en `obligations.test.ts`: una obligación de
      origen de golpeador que decide continuación varias veces seguidas antes de forzarse a
      lanzamiento de mano al alcanzar `maxChainDepth`. Depende de T008 — verificación pura.

**Checkpoint**: confirmado que el generador escala a varios lanzamientos y cadenas más profundas
sin ningún caso especial adicional.

---

## Phase 4: User Story 3 - Fichas señuelo en la mano final (Priority: P3)

**Goal**: Añadir un número configurable de fichas que no participan en la solución, sin afectar
a la resolubilidad del nivel.

**Independent Test**: Pedir un nivel con 2 fichas señuelo, y comprobar que la mano final tiene 2
fichas más que las estrictamente necesarias para la secuencia de referencia, ninguna de ellas
referenciada por ningún `pieceIndex` de la solución.

### Tests for User Story 3 ⚠️ escribir primero, deben fallar antes de implementar

- [X] T014 [P] [US3] Fixture en `generate.test.ts`: `decoyCount:2` produce una mano final con 2
      fichas más que la secuencia de referencia necesita, y ninguna de ellas es referenciada por
      ningún `pieceIndex` de `solution`. Fallará hasta T015.

### Implementation for User Story 3

- [X] T015 [US3] En `tools/generator/generate.ts`, añadir el paso de fichas señuelo tras validar
      la construcción real: `decoyCount` fichas de colores aleatorios (de `availableColors`)
      añadidas al final de la mano, sin recalcular ningún `pieceIndex` ya asignado (research.md).
      Depende de T009. Hace pasar T014.

**Checkpoint**: las 3 historias funcionan juntas — generador básico completo.

---

## Phase Final: Polish & Cross-Cutting Concerns

- [X] T016 [P] `tools/generator/cli.ts`: envoltorio de línea de comandos — parsea
      `--launches`/`--colors`/`--seed`/`--chain-origin-probability`/`--decoys`, llama a
      `generateLevel`, imprime el `GeneratedLevel` (o el fallo) por stdout como JSON. Depende de
      T010.
- [X] T017 [P] Edge cases de spec.md en `generate.test.ts`: `launchCount:0` se rechaza como
      entrada inválida (no se trata como nivel trivial); agotar `maxGenerationAttempts` sin éxito
      devuelve `{ok:false, attemptsUsed}` sin lanzar una excepción ni devolver un nivel a medio
      construir. Depende de T009.
- [X] T018 Regresión estadística de quickstart.md: generar al menos 50 niveles con semillas
      distintas (`launchCount:1`, subconjuntos variados de colores) y confirmar que el 100%
      reproduce `result:'won'` al validar su `solution` con el motor real (SC-001/SC-004).
      Depende de T009.
- [X] T019 Ejecutar `npm test && npm run typecheck && npm run build`: confirmar el recuento final
      de tests y que el build del cliente sigue limpio. Depende de T011, T012, T013, T015, T017,
      T018.
- [X] T020 Verificar que `src/renderer/` sigue sin importar nada de `tools/` — mismo `grep` de
      siempre, extendido a esta carpeta nueva (quickstart.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: sin dependencias — bloquea las 3 historias.
- **User Story 1 (Phase 2)**: depende de Foundational. T004/T005/T006 (tests) pueden escribirse
  en paralelo entre sí, pero no pasarán hasta T007/T008/T009 respectivamente; T007 depende de
  T003; T008 depende de T007; T009 depende de T008; T010 depende de T009; T011 depende de T009 y
  T010.
- **User Story 2 (Phase 3)**: T012 depende de T009 (US1); T013 depende de T008 (US1) —
  reutilizan la misma implementación, no añaden código.
- **User Story 3 (Phase 4)**: T014 depende de T009; T015 depende de T009 y hace pasar T014.
- **Polish (Final Phase)**: T016 depende de T010; T017/T018 dependen de T009; T019 depende de
  que las 3 historias y el resto de Polish estén cerrados; T020 no tiene dependencias de código,
  solo debe correr al final.

### Parallel Opportunities

- T004, T005 y T006 (tests de US1) pueden escribirse en paralelo — ficheros de test distintos.
- T012 y T013 (US2) pueden ejecutarse en paralelo entre sí una vez cerrada US1.
- T014 (US3), T016 y T017 (Polish) pueden ir en paralelo una vez cerrada US1, al no compartir
  código entre sí.

---

## Parallel Example: al empezar User Story 1

```bash
# En paralelo, tras cerrar Foundational (T001-T003):
Task: "inverses.test.ts: inversos de verde/naranja/marrón, dos modos (T004, US1)"
Task: "obligations.test.ts: exclusión de mismo color, camino despejado (T005, US1)"
Task: "generate.test.ts: las 3 fixtures de data-model.md (T006, US1)"
```

## Parallel Example: tras cerrar User Story 1

```bash
# En paralelo, una vez existe T009:
Task: "generate.test.ts: launchCount:2, dos cadenas independientes (T012, US2)"
Task: "obligations.test.ts: profundidad de cadena hasta maxChainDepth (T013, US2)"
Task: "generate.test.ts: decoyCount, fichas que no participan en la solución (T014, US3)"
Task: "cli.ts: envoltorio de línea de comandos (T016, Polish)"
```

---

## Implementation Strategy

### MVP (Foundational + User Story 1)

1. Fase 1: existe una fuente de aleatoriedad reproducible.
2. Fase 2: el generador construye y valida niveles de un solo lanzamiento, con las 3 fixtures de
   data-model.md pasando. **STOP y VALIDAR** (T011) — la razón de ser de esta feature ya está
   hecha y probada, aunque todavía sin CLI ni fichas señuelo.

### Entrega incremental

1. Foundational + User Story 1 → el generador funciona de extremo a extremo para un lanzamiento
   (MVP).
2. + User Story 2 → confirmado que escala a varios lanzamientos y cadenas más profundas sin
   ningún caso especial.
3. + User Story 3 → fichas señuelo configurables.
4. Polish → CLI operable, edge cases de spec.md, regresión estadística, límite
   herramienta↔renderer.

---

## Notes

- No hay Setup separado de Foundational — el único prerequisito compartido es el PRNG con
  semilla y la cobertura de `typecheck`.
- Commitear tras cada tarea o grupo lógico.
