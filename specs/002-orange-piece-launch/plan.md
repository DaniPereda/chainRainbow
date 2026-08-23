# Implementation Plan: Lanzamiento de Ficha Naranja (Salto sobre Obstáculo)

**Branch**: `002-orange-piece-launch` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-orange-piece-launch/spec.md`

## Summary

Añadir la ficha naranja reutilizando por completo el motor headless ya construido para verde
(lanzamiento, cola de eventos, objetivo). El hallazgo clave de esta fase de diseño: el
comportamiento de impacto de naranja (saltar la casilla intermedia sin tocarla y aterrizar dos
casillas más allá) NO es un algoritmo nuevo — es el mismo algoritmo de empuje en cascada ya
implementado para verde, parametrizado por una distancia de salto distinta (2 en vez de 1). Esto
implica refactorizar `pieces/green.ts` para generalizarlo en vez de duplicar su lógica en un
`pieces/orange.ts` aparte, validando directamente el Principio V de la constitución.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20+ LTS (sin cambios respecto a la feature
001).

**Primary Dependencies**: Ninguna dependencia de runtime nueva; se mantienen `typescript` y
`vitest` como devDependencies ya instaladas.

**Storage**: N/A — igual que en la feature 001.

**Testing**: Vitest. Nuevo `tests/unit/engine/orange.test.ts` para el comportamiento específico de
naranja; los cuatro archivos de test de la feature 001 (`launch`, `chain`, `objective`,
`determinism`) NO se modifican y actúan como guardarraíl de no-regresión (FR-006/SC-003 del spec).

**Target Platform**: Node.js (headless) — sin cambios.

**Project Type**: Proyecto único (librería) ya existente — esta historia extiende `src/engine/`,
no crea un proyecto nuevo.

**Performance Goals**: Sin objetivo numérico explícito, igual que en la feature 001.

**Constraints**: Mismas de la constitución (cero dependencias de runtime en el motor, pureza,
determinismo). Constraint adicional propia de esta historia: el comportamiento observable de la
ficha verde ya construida MUST permanecer bit-a-bit idéntico (FR-006) — se verifica re-ejecutando
la suite de tests de la feature 001 sin tocarla.

**Scale/Scope**: Dos colores de ficha (verde, naranja), dos niveles de prueba independientes, un
único lanzamiento por nivel — mismo alcance mínimo que la feature 001, ahora con una segunda
ficha.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|---|---|---|
| I. Pure, UI-Independent Simulation Core | PASS | Toda la funcionalidad nueva vive en `src/engine/`, sin dependencias de renderizado; sigue siendo headless. |
| II. Test-First Engine Logic | PASS | `orange.test.ts` se escribe antes de la implementación (ver tasks.md); la suite de verde existente sirve de test de regresión. |
| III. Determinism & Reproducibility | PASS | El algoritmo de empuje generalizado sigue siendo puro/determinista; sin randomness ni reloj. |
| IV. Levels as Declarative Data | PASS | `testLevelOrange01` es un objeto `Level` declarativo, igual que `testLevelGreen01`. |
| V. Composable Primitives Over Special-Casing | PASS (reforzado) | El hallazgo central de este plan: naranja NO necesita un algoritmo propio — es MOVE_STEP + una distancia de salto distinta sobre el mismo mecanismo de empuje en cascada ya construido para verde. Se refactoriza para compartir código en vez de duplicarlo. |

No hay violaciones que justificar.

*Re-check post Fase 1*: sin cambios de estado. El refactor de `pieces/green.ts` hacia un módulo
compartido no cambia ningún comportamiento observable de verde (verificado por su suite de tests
sin modificar) y elimina duplicación en vez de añadirla — refuerza, no debilita, el Principio V.

## Project Structure

### Documentation (this feature)

```text
specs/002-orange-piece-launch/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── engine-api.md     # Phase 1 output (actualiza el contrato ya existente de la feature 001)
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
└── engine/
    ├── board.ts           # Sin cambios de comportamiento; PieceColor se amplía a 'green' | 'orange'
    ├── move-step.ts        # Sin cambios (su rama collision=false sigue sin usarse; ver research.md)
    ├── events.ts            # Sin cambios (resolveChain ya era agnóstico al color)
    ├── launch.ts             # Sin cambios (el viaje/missclick no depende del color)
    ├── objective.ts           # Sin cambios
    ├── pieces/
    │   ├── green.ts            # SE ELIMINA — su lógica se generaliza en push.ts (ver research.md)
    │   └── push.ts              # NUEVO: PUSH_DISTANCE (green:1, orange:2) + applyImpact genérico,
    │                              compartido por cualquier color cuyo comportamiento sea "empuje
    │                              en cascada de N casillas" (hoy: verde y naranja)
    ├── level.ts                 # Añade testLevelOrange01 junto a testLevelGreen01 existente
    └── index.ts                  # resolveLaunch deja de importar un handler específico de color;
                                    usa el applyImpact genérico de push.ts para cualquier color

tests/
└── unit/
    └── engine/
        ├── launch.test.ts        # Sin modificar (regresión de verde)
        ├── chain.test.ts          # Sin modificar (regresión de verde)
        ├── objective.test.ts      # Sin modificar (regresión de verde)
        ├── determinism.test.ts    # Sin modificar (regresión de verde)
        └── orange.test.ts         # NUEVO: salto de 2 casillas, casilla intermedia intacta,
                                     objetivo/derrota/missclick (sin cascada, ver Assumptions)
```

**Structure Decision**: Se mantiene el proyecto único ya existente; no se crean carpetas nuevas de
alto nivel. El único cambio estructural relevante es que `pieces/green.ts` desaparece a favor de
`pieces/push.ts`, compartido — una simplificación, no una ampliación de superficie.

## Complexity Tracking

*Sin violaciones que justificar — tabla vacía.*
