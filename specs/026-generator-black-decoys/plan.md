# Implementation Plan: Generador -- Negro como Eliminador de Bloqueantes

**Branch**: `026-generator-black-decoys` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/026-generator-black-decoys/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Añadir soporte de negro al generador de niveles (`tools/generator/`), como un retrofit OPORTUNISTA ejecutado después de que la solución real ya haya validado con `validatesForward` -- negro no encaja en el modelo de obligaciones (no reposiciona nada, borra una línea entera), así que nunca participa en la cola que construye esa solución. Dos estrategias, ambas siempre calculadas y probadas en orden A-luego-B (research.md, Decisión 8): (a) proteger el carril de un lanzamiento de mano ya descubierto, colocando un bloqueante obligatorio entre su entrada y su objetivo real; (b) proteger una celda de aterrizaje intermedia, colocando un bloqueante obligatorio directamente sobre ella. En ambas, negro se acerca al bloqueante por el eje PERPENDICULAR al eje protegido -- nunca el mismo eje, porque negro limpia la línea ENTERA que recorre y esa línea es siempre colineal con el objetivo/origen real (research.md Decisión 1, bug real encontrado y corregido durante la implementación). Bloqueantes decorativos adicionales (0 a 6) se reparten por esa MISMA línea perpendicular. La seguridad de cada candidato se decide reproduciendo el nivel completo (bloqueantes + negro insertado) con el motor real (`validatesForward`) -- nunca con un registro estático de señuelos, porque una celda vacía al inicio puede recibir una ficha real durante la partida antes de que negro dispare (research.md Decisión 4). Si ninguna estrategia encuentra oportunidad, o ningún candidato valida, el nivel se genera igual con la solución original, sin negro -- nunca fuerza un uso decorativo ni hace fallar el intento (spec.md FR-003). Requiere extender `RawLaunch` con su celda objetivo y `ResolutionOutcome` con las celdas de aterrizaje candidatas, pero el motor (`src/engine/`) no se toca en absoluto.

## Technical Context

**Language/Version**: TypeScript (Node.js), mismo stack que el resto del generador (`tools/generator/`).

**Primary Dependencies**: Ninguna nueva. Reutiliza `src/engine/board.ts` (`Board`, `Coordinate`, `PieceColor`, `getPieceAt`, `setPieceAt`), `src/engine/move-step.ts` (`Direction`, `step`), `tools/generator/obligations.ts` (`resolveObligations`, `Obligation`, `RawLaunch`, `ResolutionOutcome`, `LandingCell`), `tools/generator/fragility.ts` (`assignGroupFragility`), `tools/generator/generate.ts` (`attemptOnce`, `validatesForward`, la nueva `buildLevelFrom` extraída de `attemptOnce`).

**Storage**: N/A -- sin persistencia, el generador produce un `GeneratedLevel` en memoria.

**Testing**: Vitest, mismo patrón que el resto del generador (`tests/unit/tools/generator/`) -- nuevo archivo `tests/unit/tools/generator/black-decoys.test.ts` (`buildBlackDecoyCandidates` en aislamiento, con `scriptedRng` como ya hace `obligations.test.ts`), más un bloque nuevo en `generate.test.ts` (fuzz de 300 seeds vía `validatesForward` + un caso concreto con seed fijo) y actualizaciones mecánicas a `obligations.test.ts` por el campo `target` nuevo en `RawLaunch`.

**Target Platform**: Node.js, ejecutado vía CLI (`tools/generator/cli.ts`/`batch.ts`) -- sin cambios en esa capa.

**Project Type**: Single project (motor + renderer + herramientas en el mismo repo, ya establecido). Esta feature es enteramente `tools/generator/`, no toca `src/engine/` ni `src/renderer/`.

**Performance Goals**: N/A -- el retrofit es, en el peor caso, lineal en `rawLaunches.length` (Estrategia A) más lineal en el número de celdas de aterrizaje candidatas (Estrategia B), más como mucho dos reproducciones extra con `validatesForward` (una por candidato) -- trivial frente al resto del proceso de generación (que ya reintenta hasta `maxGenerationAttempts` veces).

**Constraints**: Debe preservar la disciplina de determinismo ya establecida en todo el generador (research.md de 011/013/014): cero llamadas nuevas a `rng()` cuando `blackLineClearProbability` está ausente o es 0 (spec.md FR-001), y el mismo nivel/seed/parámetros produce siempre el mismo resultado.

**Scale/Scope**: Un campo nuevo en `RawLaunch` (`target`), un campo nuevo en `ResolutionOutcome` (`landingCells: LandingCell[]`, tipo `LandingCell` nuevo), un campo interno nuevo en `Obligation` (`explainsLandingAt`), un parámetro nuevo en `GenerationParams` (`blackLineClearProbability`), un archivo nuevo (`tools/generator/black-decoys.ts`) con `buildBlackDecoyCandidates`, una función nueva extraída en `generate.ts` (`buildLevelFrom`) y un punto de integración acotado en `attemptOnce`. Sin cambios en `src/engine/` ni `src/renderer/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, sin dependencias de UI)** -- trivialmente satisfecho: esta feature no toca `src/engine/` en absoluto, solo `tools/generator/` (una herramienta de autoría, no el motor de simulación). **PASA**.
- **Principio II (test-first)** -- nuevo archivo `tests/unit/tools/generator/black-decoys.test.ts` cubre `buildBlackDecoyCandidates` (Estrategia A, Estrategia B, ausencia de oportunidad) antes/junto con la implementación, mismo patrón que `obligations.test.ts`; `generate.test.ts` cubre la integración completa vía `validatesForward`. **PASA**.
- **Principio III (determinismo)** -- el retrofit es una función pura de `(board, rawLaunches, landingCells, availableColors, fragilityProfile, rng)`; con la misma secuencia de valores de `rng`, produce siempre el mismo resultado. `blackLineClearProbability` ausente o 0 significa cero llamadas nuevas a `rng()` (research.md Decisión 7), preservando exactamente la secuencia de tiradas de cualquier generación ya existente. **PASA**.
- **Principio IV (niveles como datos declarativos)** -- sin cambios; el `GeneratedLevel` resultante (`pieces`/`hand`/`goal`/`solution`) sigue teniendo exactamente la misma forma, solo con más contenido en `pieces`/`hand`/`solution` cuando negro participa. **PASA**.
- **Principio V (primitivas composables sobre casos especiales)** -- ámbito de este principio es la simulación del motor (`MOVE_STEP`, colisión, repetición, ramificación); el algoritmo de construcción del generador ya tiene su propio patrón establecido (obligaciones + inversas). Esta feature reutiliza ese patrón (un retrofit posterior, no una rama nueva de la cola) y, sobre todo, reutiliza `validatesForward` -- el mismo mecanismo de verificación que ya usa cualquier solución "de verdad" -- en vez de inventar una segunda forma de comprobar seguridad (research.md Decisión 4). **PASA**.

Todas las gates pasan, sin ninguna desviación que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/026-generator-black-decoys/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md  # /speckit-specify quality gate
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
tools/generator/
├── obligations.ts       # RawLaunch gana `target`; ResolutionOutcome gana
│                          # `landingCells: LandingCell[]` (tipo nuevo);
│                          # Obligation gana `explainsLandingAt` (interno);
│                          # resolveObligations rellena los tres al vuelo, en
│                          # los mismos puntos donde ya resuelve obligaciones
│                          # 'defender' y 'striker-origin'
├── black-decoys.ts       # NUEVO -- buildBlackDecoyCandidates: construye
│                          # hasta 2 candidatos (Estrategia A, Estrategia B),
│                          # nunca valida nada por sí misma
└── generate.ts           # GenerationParams gana `blackLineClearProbability`;
                           # buildLevelFrom (nueva, extraída de attemptOnce)
                           # construye mano/solución/nivel y corre
                           # validatesForward; attemptOnce la llama primero
                           # con la solución real y, si aplica, otra vez por
                           # cada candidato con negro

tests/unit/tools/generator/
├── black-decoys.test.ts  # NUEVO -- buildBlackDecoyCandidates en aislamiento
├── obligations.test.ts   # migración mecánica: RawLaunch con `target` en las
│                          # aserciones existentes
└── generate.test.ts      # cobertura end-to-end: fuzz de 300 seeds vía
                           # validatesForward + un caso concreto con seed fija

# Sin cambios en src/engine/ ni src/renderer/
```

**Structure Decision**: Single project ya establecido. Esta feature vive enteramente en `tools/generator/` -- un archivo nuevo (`black-decoys.ts`, separado de `obligations.ts` porque su lógica es un retrofit POSTERIOR sobre una solución ya construida, no una rama más de la cola de obligaciones) y extensiones mecánicas a los tipos/funciones ya existentes en `obligations.ts`/`generate.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Ninguna -- todas las gates pasan sin desviaciones.
