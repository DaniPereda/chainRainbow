# Implementation Plan: Generador de Niveles por Construcción Inversa (verde/naranja/marrón)

**Branch**: `011-level-generator-basic` | **Date**: 2026-08-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-level-generator-basic/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Una herramienta de línea de comandos, fuera de `src/`, que construye niveles hacia atrás desde
el objetivo mediante una cola de obligaciones (`{cell, color}`), usando únicamente los inversos
de verde/naranja/marrón, valida cada construcción reproduciéndola con el motor real, y descarta
y reintenta el nivel completo si algo no coincide. La investigación de esta fase (research.md)
precisa el algoritmo de `documentation/level-generator-design.md` en varios puntos donde la
descripción original era correcta pero no suficientemente concreta para implementar sin
ambigüedad: la distinción entre "obligación del defensor" y "obligación de origen de quien
golpea", la invariancia de la dirección dentro de una misma cadena, el requisito de camino
despejado desde el borde para un lanzamiento de mano, y — el hallazgo más importante — que
marrón, usado como golpeador DIRECTO de una obligación que debe quedar vacía hasta ese momento,
solo puede aterrizar en la casilla del borde lejano de su carril (consecuencia del propio tope de
cruces de marrón, spec.md 008), mientras que usado para explicar el origen de un golpeador que
llega a una casilla YA ocupada, sí admite el conjunto flexible de candidatos que describía el
documento original.

## Technical Context

**Language/Version**: TypeScript, sin cambios de versión.

**Primary Dependencies**: Ninguna nueva en tiempo de ejecución. `tsx` como devDependency para
ejecutar el script sin paso de build (research.md).

**Storage**: N/A — esta feature solo produce JSON de salida, no lo persiste (spec.md, fuera de
alcance).

**Testing**: Vitest, mismo runner que el motor. Los tests viven en
`tests/unit/tools/generator/` (ya cubiertos por el patrón `include` existente de
`vitest.config.ts`, sin cambios de configuración). El algoritmo central (resolución de
obligaciones, inversos por color) se prueba en aislamiento, igual que cualquier lógica del
motor — aunque esta herramienta vive fuera de `src/engine/`, sigue siendo lógica pura,
determinista dado un generador de números aleatorios con semilla fija, y por tanto sujeta al
mismo estándar de test-first (Principio II en espíritu, aunque `tools/` no es parte del
"simulation core" que el Principio I acota estrictamente).

**Target Platform**: Node.js, ejecutado como script de desarrollo/autoría — nunca en el
navegador ni empaquetado con la app cliente.

**Project Type**: Proyecto único ya existente; esta feature añade un directorio de herramientas
(`tools/generator/`) fuera del árbol `src/` que Vite empaqueta.

**Performance Goals**: N/A — es una herramienta de autoría offline, no una ruta caliente de
juego.

**Constraints**: `tsconfig.json` necesita `tools` añadido a su `include` para que
`npm run typecheck` cubra el código nuevo — es un cambio de configuración de proyecto, no de
`src/engine/` (FR-011 sigue intacto: cero cambios de comportamiento del motor).

**Scale/Scope**: Un módulo de algoritmo puro (`tools/generator/generate.ts` +
`tools/generator/inverses.ts` + `tools/generator/rng.ts`), un envoltorio CLI fino
(`tools/generator/cli.ts`), y sus tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS — el generador vive fuera de `src/engine/` y de `src/renderer/`; consume la API pública del motor (vía imports directos a sus módulos, mismo patrón que ya usan los tests) sin modificarla. |
| II. Test-First Engine Logic | PASS (extendido en espíritu) — el algoritmo de construcción y los inversos por color se prueban con Vitest antes/junto a su implementación, igual que el resto del proyecto. |
| III. Determinism & Reproducibility | PASS — dada la misma semilla y los mismos parámetros, la misma secuencia de decisiones aleatorias produce siempre el mismo nivel (FR-009); la semilla es el único origen de aleatoriedad, generada y consumida de forma determinista (research.md). |
| IV. Levels as Declarative Data | PASS — la salida es exactamente la misma forma declarativa que ya consume `createLevel()`, más metadatos planos (secuencia de referencia, parámetros, semilla). |
| V. Composable Primitives Over Special-Casing | PASS — el generador no introduce ningún primitivo de motor nuevo; solo consume `resolveLaunch` y los tipos ya existentes para validar. |
| Development Workflow: cambios de semántica de resolución de cadena deben documentarse en plan.md | No aplica — cero cambios de motor. |

Sin violaciones — Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/011-level-generator-basic/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No hay `contracts/` en el sentido de API HTTP: el "contrato" real es la forma del JSON de salida,
documentada en data-model.md.

### Source Code (repository root)

```text
tools/
└── generator/
    ├── obligations.ts       # NUEVO: tipos Obligation/ConstructionState, cola, resolución
    ├── inverses.ts           # NUEVO: inversos de verde/naranja/marrón (los dos modos de marrón)
    ├── rng.ts                 # NUEVO: PRNG con semilla (determinista, sin dependencia externa)
    ├── generate.ts            # NUEVO: bucle de generación + validación + política de reintento
    ├── cli.ts                  # NUEVO: envoltorio de línea de comandos (parámetros -> JSON)
    └── index.ts                 # NUEVO: reexporta generateLevel + tipos para los tests

tests/
└── unit/
    └── tools/
        └── generator/
            ├── inverses.test.ts       # NUEVO — inversos por color, incluidos los dos modos de marrón
            ├── obligations.test.ts     # NUEVO — resolución de la cola, conteo exacto de lanzamientos
            ├── rng.test.ts               # NUEVO — determinismo del PRNG con semilla
            └── generate.test.ts          # NUEVO — ciclo completo, validación, descarte-y-reintento

tsconfig.json             # MODIFICA: "include" gana "tools"
```

**Structure Decision**: Nuevo árbol `tools/generator/` al margen de `src/`, siguiendo la
separación ya decidida en la sesión de diseño (documentation/level-generator-design.md, sección
sobre ubicación e independencia) — nunca alcanzable desde `src/renderer/main.ts`, verificable con
el mismo `grep` de límites de import ya usado para motor↔renderer, extendido para cubrir
`tools/`.

## Complexity Tracking

*Sin violaciones que justificar.*
