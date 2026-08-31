# Implementation Plan: Puntuación de Complejidad de Generación

**Branch**: `014-generation-complexity` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-generation-complexity/spec.md`

## Summary

El generador (`tools/generator/`) separa dos conceptos hoy confundidos por el nombre: el parámetro de *entrada* que pide más o menos complejidad de construcción, y la futura *dificultad real percibida* de un nivel ya construido (fuera de alcance). Primero, el campo `difficultyProfile` introducido en 013-generator-fragility-difficulty se renombra a `fragilityProfile` (rename mecánico, cero cambio de comportamiento) para liberar la palabra "dificultad". Después, se añade `complexityScore`: un único entero de entrada, opcional, que el generador reparte aleatoriamente (con el mismo `rng` inyectado de siempre) entre siete factores de generación ya existentes con influencia demostrada en la forma del nivel -- cada uno con su propio número de niveles (no fijo a 3) y sus propias horquillas de valores concretos, ambos definidos en un archivo de configuración JSON externo a la lógica TypeScript. Los parámetros individuales explícitos (como hoy) siguen funcionando igual y ganan sobre `complexityScore` para el factor que cubran.

## Technical Context

**Language/Version**: TypeScript (mismo stack que el resto del proyecto, sin dependencias nuevas)

**Primary Dependencies**: Ninguna nueva. El JSON de configuración se lee con `node:fs` (`readFileSync`), mismo patrón que `batch.ts` ya usa para `levels/index.json`.

**Storage**: N/A para el motor/generador -- `complexity-config.json` es un artefacto de datos versionado junto al código (no una base de datos), igual que el resto de "niveles como datos declarativos" (Principio IV).

**Testing**: Vitest, igual que el resto del generador (Principio II).

**Target Platform**: Sin cambios -- herramienta de desarrollo headless, fuera del árbol empaquetado para cliente (FR-014, mismo criterio que 011/012/013).

**Project Type**: Single project (monorepo existente: `src/engine/`, `src/renderer/`, `tools/generator/`).

**Performance Goals**: N/A -- el coste añadido es, como mucho, `complexityScore - min` llamadas a `rng()` para el reparto más una por factor resuelto para su valor concreto; no cambia la complejidad de `resolveObligations` ni añade ninguna pasada sobre el tablero.

**Constraints**: Ninguna llamada nueva a `rng()` cuando `complexityScore` no se indica (research.md, Decisión 5/6) -- preserva byte a byte el comportamiento y las secuencias scripted-rng de los tests ya existentes (130 de antes de 013, más los 18 de 013).

**Scale/Scope**: Sin cambio de escala -- mismo tablero 8×8, mismo volumen de niveles, mismo rango de parámetros individuales cuando se usan directamente.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA. Esta feature no toca `src/engine/` en absoluto (FR-014) -- vive íntegramente en `tools/generator/`.
- **Principio II (test-first)**: PASA. El trabajo empieza actualizando mecánicamente los fixtures que referencian `difficultyProfile` (Historia 1) antes de añadir la suite nueva de `complexity.test.ts` (Historia 2/3); toda la lógica nueva es headless y testeable con Vitest.
- **Principio III (determinismo)**: PASA, con la misma atención que ya estableció 013 -- `resolveComplexity` es una función pura del `rng` inyectado, y no consume ninguna llamada nueva cuando `complexityScore` está ausente (FR-011/FR-012).
- **Principio IV (niveles como datos declarativos)**: PASA, y esta feature lo extiende explícitamente -- ya no son solo los niveles los que son datos declarativos, sino también la propia configuración de cuánta complejidad representa cada nivel de cada factor (FR-010).
- **Principio V (primitivas composables, no casos especiales)**: PASA -- un único mecanismo de reparto (`resolveComplexity`) y una única función de muestreo por horquilla (`sampleLevel`, ramificada por `kind` en vez de triplicada por factor) cubren los siete factores, en vez de siete implementaciones ad-hoc.
- **Workflow -- cambios de semántica de resolución de cadenas**: no aplica. Ver research.md, "Cambio de semántica de resolución de cadenas".

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido:

- `resolveComplexity`/`sampleLevel`/`complexityRange` son funciones puras sin estado oculto (Principio III intacto) -- todo su estado (`levelIndex`) es local a la propia llamada.
- El cambio de `GenerationParams` (cuatro campos pasan de obligatorios a opcionales, más `complexityScore` nuevo) es aditivo/de forma para cualquier llamador que no use `complexityScore` -- la validación de "faltan datos" se mueve a runtime, no rompe ningún tipo ya compilado que ya proporcionaba los cuatro campos (Principio II sin coste de migración oculto salvo el rename mecánico ya cubierto).
- Sigue sin haber ningún cambio en `src/engine/` (Principio I intacto) ni ninguna fuente de aleatoriedad fuera del `rng` ya inyectado (Principio III intacto).
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/014-generation-complexity/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: igual que 011/012/013, esta feature no expone ninguna interfaz externa nueva (ni API, ni CLI con contrato formal) -- solo extiende tipos y funciones ya internas a `tools/generator/`, documentadas en `data-model.md`. El nuevo flag de CLI (`--complexity-score`) y el renombrado (`--fragility-profile`) siguen el mismo patrón informal ya usado por el resto de flags existentes, sin validación de esquema propia.

### Source Code (repository root)

```text
tools/generator/
├── complexity.ts (nuevo)         # ComplexityFactorName/ComplexityConfig, resolveComplexity,
│                                    complexityRange, sampleLevel (privada), loadComplexityConfig
├── complexity-config.json (nuevo) # horquillas por nivel de cada uno de los 7 factores -- datos, no lógica
├── generate.ts                    # rename difficultyProfile->fragilityProfile; launchCount/
│                                    availableColors/chainOriginProbability/decoyCount pasan a
│                                    opcionales; nuevo complexityScore?: number; generateLevelWithRng
│                                    resuelve complejidad una vez, antes del bucle de intentos
├── obligations.ts                 # ResolutionContext.difficultyProfile -> fragilityProfile (rename)
├── fragility.ts                   # sin cambios (013, ya probado)
├── inverses.ts, rng.ts            # sin cambios
├── cli.ts, batch.ts               # --difficulty-profile -> --fragility-profile (rename);
│                                    nuevo --complexity-score <N>
└── index.ts                       # re-exporta tipos/funciones nuevas de complexity.ts si hiciera falta

tests/unit/tools/generator/
├── complexity.test.ts (nuevo)              # reparto, rango, determinismo, exclusión de factores
│                                              con override explícito, niveles >3
├── fragility.test.ts                       # rename mecánico difficultyProfile->fragilityProfile
├── generate.test.ts, obligations.test.ts   # idem, mecánico donde aparezca el campo renombrado

(src/engine/, src/renderer/ quedan fuera de alcance -- ver spec.md FR-014 / research.md)
```

**Structure Decision**: Proyecto único ya existente. Esta feature añade dos ficheros nuevos (`tools/generator/complexity.ts`, `tools/generator/complexity-config.json`) y extiende archivos ya existentes del generador. `src/engine/` y `src/renderer/` no se tocan.

## Complexity Tracking

*(vacío -- el Constitution Check no encontró ninguna violación que justificar)*
