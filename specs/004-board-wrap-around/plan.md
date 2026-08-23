# Implementation Plan: Wrap-around de Fichas en el Tablero

**Branch**: `004-board-wrap-around` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-board-wrap-around/spec.md`

## Summary

Sustituir el placeholder actual de `pieces/push.ts` ("la ficha se elimina si su destino cae fuera
del tablero") por wrap-around real: la coordenada de destino se envuelve al extremo opuesto de la
misma fila/columna antes de comprobar qué hay ahí. Como el chequeo de ocupación ya sucede después
de calcular `to`, envolver la coordenada ANTES de ese chequeo hace que la regla universal de
interacción ya existente (mismo color → aniquila; distinto color → empuja) se aplique sola, sin
ningún caso especial — la rama `!isInBounds(to)` desaparece por completo de `resolveStrike`.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20+ LTS — sin cambios.

**Primary Dependencies**: Ninguna nueva.

**Storage**: N/A.

**Testing**: Vitest. Nuevo `tests/unit/engine/wrap-around.test.ts` con tres niveles dedicados
(destino vacío, destino de color distinto, destino del mismo color tras envolver). Las seis
suites existentes (`launch`, `chain`, `objective`, `determinism`, `orange`, `same-color`) actúan
como guardarraíl de no-regresión: NO se modifican.

**Target Platform**: Node.js (headless) — sin cambios.

**Project Type**: Proyecto único ya existente.

**Performance Goals**: Sin objetivo numérico explícito.

**Constraints**: Mismas de la constitución (cero dependencias de runtime, pureza, determinismo).

**Scale/Scope**: Un tablero 8×8 sin cambios de tamaño; con las distancias de empuje actuales
(verde=1, naranja=2) un único empuje nunca cruza el borde más de una vez (spec.md → Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|---|---|---|
| I. Pure, UI-Independent Simulation Core | PASS | Cambio íntegramente dentro de `src/engine/`. |
| II. Test-First Engine Logic | PASS | `wrap-around.test.ts` se escribe antes de la implementación. |
| III. Determinism & Reproducibility | PASS | El envolvimiento de coordenadas es aritmética pura (módulo), sin randomness. |
| IV. Levels as Declarative Data | PASS | Los tres niveles nuevos son objetos `Level` declarativos vía `createTestLevel`. |
| V. Composable Primitives Over Special-Casing | PASS (reforzado) | Envolver la coordenada ANTES del chequeo de ocupación elimina un caso especial (`!isInBounds`) en vez de añadir uno — la regla universal de interacción ya construida cubre el resto sin tocarla. |

No hay violaciones que justificar.

*Re-check post Fase 1*: sin cambios de estado. `wrapCoordinate` es una función pura añadida a
`board.ts` (mismo patrón que `isInBounds`/`getPieceAt`); no cambia ningún tipo público ni el
contrato de `resolveLaunch`.

## Project Structure

### Documentation (this feature)

```text
specs/004-board-wrap-around/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── engine-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
└── engine/
    ├── board.ts            # AÑADE wrapCoordinate(coord): Coordinate (módulo sobre BOARD_SIZE)
    ├── move-step.ts          # AÑADE stepBy(coord, direction, distance): Coordinate — wrap-around
    │                          vive aquí, como parte del movimiento, no de la colisión
    ├── pieces/
    │   └── push.ts           # MODIFICA resolveStrike: `to` viene de stepBy (ya envuelta); se
    │                          elimina la rama `!isInBounds(to)` ("la ficha desaparece") por
    │                          completo; deja de conocer wrapCoordinate directamente
    ├── launch.ts               # Sin cambios (el viaje inicial no envuelve, FR-003)
    └── level.ts                 # AÑADE testLevelWrapToEmpty01

tests/
└── unit/
    └── engine/
        ├── launch.test.ts, chain.test.ts, objective.test.ts, determinism.test.ts,
        │   orange.test.ts, same-color.test.ts   # Sin modificar (regresión)
        ├── wrap-around.test.ts                    # NUEVO: destino vacío (Acceptance Scenarios 1-2)
        └── move-step.test.ts                      # NUEVO: stepBy en aislado, cubre el wrap para
                                                     Acceptance Scenarios 3-4 por composición
```

**Structure Decision**: Proyecto único ya existente, sin cambios estructurales de alto nivel. El
único fichero de producción que cambia de comportamiento es `push.ts`; `board.ts` solo gana una
función pura nueva.

## Complexity Tracking

*Sin violaciones que justificar — tabla vacía.*
