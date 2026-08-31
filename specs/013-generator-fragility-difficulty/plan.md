# Implementation Plan: Fragilidad como Factor de Dificultad del Generador

**Branch**: `013-generator-fragility-difficulty` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-generator-fragility-difficulty/spec.md`

## Summary

El generador (`tools/generator/`) gana un parámetro opcional, `difficultyProfile: 'easy' | 'medium' | 'hard'`, que decide cuánta heterogeneidad de estados de fragilidad introduce dentro de tres grupos independientes: señuelos de tablero, señuelos de mano, y las propias fichas que la solución lanza desde la mano. Un hallazgo central de la fase de investigación (`research.md`, Decisión 1) simplifica drásticamente lo que parecía necesario: **las fichas de tablero que la solución golpea no necesitan ningún mecanismo nuevo** -- matemáticamente, solo `NEW` sobrevive a un único golpe obligatorio, y ninguna ficha sobrevive a dos o más, así que siguen partiendo siempre de `NEW` exactamente como hoy, y el mecanismo reactivo ya existente (`validatesForward`, reproducción completa con el motor real) sigue siendo suficiente para descartar la rara construcción que golpea la misma ficha dos veces -- ya lo demostró el propio historial del proyecto (commit `4e90191`) sin necesitar código dedicado. El trabajo real de esta feature es, por tanto, mucho más pequeño de lo que sugería la especificación inicial: una función pura de asignación por grupo (`assignGroupFragility`), reutilizada tres veces con distinto rango de estados permitidos, más el cambio de forma de `GeneratedLevel` para poder transportar esa fragilidad hasta la salida y hasta la reproducción de verificación.

## Technical Context

**Language/Version**: TypeScript (mismo stack que el resto del proyecto, sin dependencias nuevas)

**Primary Dependencies**: Ninguna nueva. El generador ya no tiene dependencias de runtime (mismo criterio que el motor); esta feature no cambia eso.

**Storage**: N/A -- salida en memoria/JSON, igual que el resto del generador (Principio IV).

**Testing**: Vitest, igual que el resto del generador (Principio II).

**Target Platform**: Sin cambios -- herramienta de desarrollo headless, fuera del árbol empaquetado para cliente (FR-013, ya garantizado por 011-level-generator-basic).

**Project Type**: Single project (monorepo existente: `src/engine/`, `src/renderer/`, `tools/generator/`).

**Performance Goals**: N/A -- el coste añadido es, como mucho, unas pocas llamadas a `rng()` y comparaciones de string por nivel generado; no cambia la complejidad de `resolveObligations` ni introduce ninguna pasada adicional sobre el tablero.

**Constraints**: Ninguna llamada nueva a `rng()` cuando `difficultyProfile` no se indica (research.md, Decisión 3) -- preserva byte a byte el comportamiento y las secuencias scripted-rng de los 130 tests ya existentes.

**Scale/Scope**: Sin cambio de escala -- mismo tablero 8×8, mismo volumen de niveles, mismo rango de `launchCount`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principio I (motor puro, independiente de UI)**: PASA. Esta feature no toca `src/engine/` en absoluto (FR-013) -- vive íntegramente en `tools/generator/`, que ya consumía la API pública del motor (`createLevel`, `resolveLaunch`) sin ningún cambio de motor requerido, igual que 011-level-generator-basic.
- **Principio II (test-first)**: PASA. El trabajo empieza actualizando fixtures existentes (mecánico, `fragility: 'new'` explícito donde haga falta) antes de añadir la suite nueva de Historias 1-3, y toda la lógica es headless y testeable con Vitest sin ninguna interfaz.
- **Principio III (determinismo)**: PASA, con una atención concreta: `assignGroupFragility` es una función pura del `rng` inyectado (mismo patrón que el resto del generador) -- misma semilla + mismos parámetros + mismo perfil produce siempre el mismo resultado (FR-012). El cuidado explícito de no consumir `rng()` cuando el perfil no se indica es lo que preserva el determinismo de TODO lo demás que ya dependía de la secuencia exacta de llamadas.
- **Principio IV (niveles como datos declarativos)**: PASA -- la salida sigue siendo datos declarativos consumidos por `createLevel`; esta feature solo hace que esos datos declarativos incluyan fragilidad real en vez de asumirla implícitamente.
- **Principio V (primitivas composables, no casos especiales)**: PASA, y es el eje central del diseño -- en vez de añadir un mecanismo de conteo de golpes + elección de estado seguro (lo que parecía necesario antes de formalizar la Decisión 1 de `research.md`), se reconoce que el mecanismo reactivo YA EXISTENTE (`validatesForward`) ya resuelve la seguridad de las fichas de tablero sin ningún código nuevo. El único mecanismo nuevo (`assignGroupFragility`) se escribe UNA vez y se reutiliza para los tres grupos (señuelos de tablero, señuelos de mano, fichas lanzadas), en vez de triplicar la lógica de heterogeneidad.
- **Workflow -- cambios de semántica de resolución de cadenas**: no aplica. Ningún cambio en `resolveStrike`/`applyImpact`/`resolveSplit` ni en ninguna otra función de resolución de cadenas -- ver `research.md`, "Cambio de semántica de resolución de cadenas".

Ningún gate bloquea el avance a Phase 0. No hace falta registrar nada en Complexity Tracking.

### Re-check post-diseño (tras Phase 1)

Con `data-model.md` ya concreto, se confirma que ningún gate se ve comprometido:

- `assignGroupFragility` es una función pura sin estado (Principio III intacto); el único estado mutable nuevo es una variable local dentro de `resolveObligations` (el "estado compartido de señuelos de tablero para `'easy'`, cacheado durante un intento"), que no escapa de la función ni afecta a nada fuera de ese intento concreto.
- El cambio de forma de `GeneratedLevel` (`pieces`/`hand` ahora transportan `fragility`) es puramente aditivo/de forma -- ningún test o consumidor existente que no acceda a `fragility` deja de compilar o de comportarse igual (Principio II sin coste de migración oculto).
- Sigue sin haber ningún cambio en `src/engine/` (Principio I intacto) ni ninguna decisión que introduzca aleatoriedad fuera del `rng` ya inyectado (Principio III intacto).
- Sigue sin haber Complexity Tracking que rellenar.

## Project Structure

### Documentation (this feature)

```text
specs/013-generator-fragility-difficulty/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No se genera `contracts/`: igual que 011-level-generator-basic, esta feature no expone ninguna interfaz externa nueva (ni API, ni CLI con contrato formal, ni formato de archivo nuevo) -- solo extiende tipos y funciones ya internas a `tools/generator/`, documentadas en `data-model.md`. Los dos flags nuevos de CLI (`--difficulty-profile`) siguen el mismo patrón informal ya usado por el resto de flags existentes, sin validación de esquema propia.

### Source Code (repository root)

```text
tools/generator/
├── fragility.ts (nuevo)      # assignGroupFragility -- el único mecanismo nuevo, puro, reutilizado 3 veces
├── generate.ts                # GenerationParams gana difficultyProfile; GeneratedLevel.pieces/hand transportan fragility;
│                               # attemptOnce asigna fragilidad a fichas lanzadas y señuelos de mano
├── obligations.ts             # ResolutionContext gana difficultyProfile; el bloque de señuelo de tablero deja de
│                               # asignar 'new' incondicionalmente; el bloque de mobiliario NO cambia (research.md, Decisión 1)
├── inverses.ts                 # sin cambios
├── rng.ts                      # sin cambios
├── cli.ts, batch.ts           # ganan el flag --difficulty-profile, mismo patrón que los flags ya existentes
└── index.ts                    # re-exporta FragilityProfile si hiciera falta fuera del propio directorio

tests/unit/tools/generator/
├── fragility.test.ts (nuevo)         # suite dedicada a Historias 1-3 (assignGroupFragility + integración end-to-end)
├── generate.test.ts, obligations.test.ts, inverses.test.ts  # fixtures existentes revisadas mecánicamente (fragility: 'new'
│                                                              # donde falte, sin cambiar valores ya esperados)

(src/engine/, src/renderer/ quedan fuera de alcance -- ver spec.md FR-013 / research.md)
```

**Structure Decision**: Proyecto único ya existente. Esta feature no introduce ningún directorio nuevo de primer nivel -- añade un único fichero nuevo (`tools/generator/fragility.ts`) y extiende archivos ya existentes del generador. `src/engine/` y `src/renderer/` no se tocan.

## Complexity Tracking

*(vacío -- el Constitution Check no encontró ninguna violación que justificar)*
