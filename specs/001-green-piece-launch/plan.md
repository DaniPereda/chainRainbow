# Implementation Plan: Lanzamiento y Cadena de Ficha Verde (Walking Skeleton)

**Branch**: `001-green-piece-launch` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-green-piece-launch/spec.md`

## Summary

Construir, de forma headless (sin interfaz), el bucle completo del motor de simulación para un
único lanzamiento de una ficha verde: viaje casilla a casilla hasta colisión o missclick,
resolución de la reacción en cadena mediante una cola de eventos hasta alcanzar un estado
estable, y comprobación del objetivo del nivel solo en ese momento. Es la primera rebanada
vertical del roadmap y establece el módulo `engine` puro y aislado (sin Phaser/DOM) sobre el que
se construirán el resto de fichas y, más adelante, el renderer.

## Technical Context

**Language/Version**: TypeScript 5.x, ejecutado sobre Node.js 20+ LTS para tooling y tests.

**Primary Dependencies**: Ninguna dependencia en tiempo de ejecución para el motor (mandato de la
constitución: "no runtime dependencies beyond the standard library"). Dependencias de desarrollo:
`typescript`, `vitest`.

**Storage**: N/A — todo el estado es en memoria; el nivel de prueba de esta historia es un fixture
TS declarativo, no hay persistencia.

**Testing**: Vitest. Un archivo de test por grupo de reglas (viaje/missclick, colisión y cola de
eventos, objetivo/resultado, determinismo), cada uno trazable a los FR del spec.

**Target Platform**: Node.js (headless). Esta historia no toca navegador ni móvil — el trabajo de
Phaser/Capacitor se aborda en una historia posterior (ver Clarifications del spec).

**Project Type**: Proyecto único (librería). Esta historia crea el límite de módulo `src/engine/`
exigido por el Principio I de la constitución (núcleo de simulación puro e independiente de la UI).

**Performance Goals**: Sin objetivo numérico explícito; la resolución de una cadena sobre un
tablero 8×8 con un puñado de eventos debe completarse de forma síncrona e instantánea (no hay
volumen que la justifique como preocupación en esta escala).

**Constraints**: El código del motor MUST tener cero dependencias de runtime (constitución,
sección Technology Stack Requirements) y MUST ser puro/determinista — sin `Date.now`,
`Math.random`, temporizadores ni E/S dentro de la resolución de la cadena (Principio III).

**Scale/Scope**: Un único color de ficha (verde), un único nivel de prueba, un único lanzamiento
por nivel (alcance fijado en Clarifications). Deliberadamente mínimo por ser el walking skeleton.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|---|---|---|
| I. Pure, UI-Independent Simulation Core | PASS | Esta historia es exactamente ese núcleo: `src/engine/` sin ninguna dependencia de renderizado; verificado headless por diseño (ver Clarifications del spec). |
| II. Test-First Engine Logic | PASS | Cada regla (missclick, colisión/cadena, objetivo, determinismo) tiene su propio archivo Vitest antes de darse por completada (ver Project Structure). |
| III. Determinism & Reproducibility | PASS | FR-011 lo exige explícitamente; sin randomness ni reloj en el motor; se testea repitiendo el mismo lanzamiento. |
| IV. Levels as Declarative Data | PASS | El nivel de prueba se modela como un objeto `Level` declarativo (ver data-model.md), no como lógica imperativa. |
| V. Composable Primitives Over Special-Casing | PASS | El comportamiento de la ficha verde se implementa como composición de MOVE_STEP + política de colisión, tal como documenta la sección Assumptions del spec. |

No hay violaciones que justificar; la tabla de Complexity Tracking queda vacía.

*Re-check post Fase 1 (tras research.md, data-model.md, contracts/, quickstart.md)*: sin cambios
de estado — `resolveLaunch` es una función pura sin dependencias de renderizado, el nivel de
prueba es un dato declarativo (`Level`), cada tipo del modelo de datos tiene su verificación
prevista en tests, y ninguna decisión de diseño introduce un primitivo nuevo fuera de MOVE_STEP +
política de colisión. Las cinco filas de la tabla siguen en PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-green-piece-launch/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── engine-api.md     # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
package.json
tsconfig.json
vitest.config.ts

src/
└── engine/
    ├── board.ts          # Estado del tablero: grid 8x8, colocación y ocupación de fichas
    ├── move-step.ts      # Primitiva MOVE_STEP con política de colisión true/false
    ├── events.ts          # Cola de eventos + bucle de resolución de cadena hasta estado estable
    ├── launch.ts          # Acción de lanzamiento: viaje hasta colisión o borde, missclick
    ├── pieces/
    │   └── green.ts       # Comportamiento de la ficha verde, compuesto a partir de move-step.ts
    ├── objective.ts        # Evaluación del objetivo (ganado/perdido) una vez estable
    ├── level.ts             # Tipo `Level` declarativo + fixture del nivel de prueba de esta historia
    └── index.ts             # Superficie pública del motor (ver contracts/engine-api.md)

tests/
└── unit/
    └── engine/
        ├── launch.test.ts        # FR-001..003: viaje casilla a casilla, missclick
        ├── chain.test.ts          # FR-004..006: interacción, cola de eventos, estado estable
        ├── objective.test.ts      # FR-007..010: victoria, derrota, reinicio
        └── determinism.test.ts    # FR-011: mismo input -> mismo output, repetible
```

**Structure Decision**: Proyecto único en la raíz del repo (no monorepo/workspaces todavía).
`src/engine/` es el límite de módulo aislado que exige el Principio I; nada fuera de esta
historia toca renderizado, así que no se crea aún ninguna carpeta `app/`/renderer — eso llega con
la historia que introduzca Phaser (P4 en el roadmap). Dividir en workspaces se difiere hasta que
ese paquete de renderer exista realmente, para no introducir estructura antes de que haga falta.

## Complexity Tracking

*Sin violaciones que justificar — tabla vacía.*
