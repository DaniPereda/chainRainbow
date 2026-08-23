# Implementation Plan: Colisión entre Fichas del Mismo Color (Aniquilación Mutua)

**Branch**: `003-same-color-collision` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-same-color-collision/spec.md`

## Summary

Añadir una comprobación de prioridad ("¿mismo color?") que se evalúa antes de cualquier
comportamiento de empuje/salto, en cada punto donde una ficha entra en una casilla ocupada — tanto
en el impacto inicial de un lanzamiento como en cualquier eslabón de una cascada. Si los colores
coinciden, ambas fichas desaparecen y ninguna ejecuta su efecto; si no, el mecanismo de empuje ya
construido (feature 002) se aplica sin cambios. Requiere generalizar la recursión de `push.ts`
para que el mismo chequeo se aplique en ambos puntos de entrada (impacto inicial y cascada) sin
duplicar lógica, y extender `EventLog` con un nuevo tipo de evento para la aniquilación, ya que no
es un `MOVE_STEP` (ninguna ficha se mueve).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 20+ LTS — sin cambios.

**Primary Dependencies**: Ninguna nueva; se mantienen `typescript` y `vitest`.

**Storage**: N/A — igual que en las features anteriores.

**Testing**: Vitest. Nuevo `tests/unit/engine/same-color.test.ts` para el impacto inicial y un
eslabón de cascada con aniquilación. Las suites existentes de verde/naranja actúan como
guardarraíl de no-regresión para colisiones de colores distintos — se modifica únicamente
`src/engine/level.ts` (fixture `testLevelGreen01`), ningún archivo de test existente necesita
tocarse (ver Constitution Check).

**Target Platform**: Node.js (headless) — sin cambios.

**Project Type**: Proyecto único ya existente — esta historia extiende `src/engine/`.

**Performance Goals**: Sin objetivo numérico explícito — igual que en las features anteriores.

**Constraints**: Mismas de la constitución (cero dependencias de runtime, pureza, determinismo).
Constraint adicional: el comportamiento ya validado para colisiones de colores distintos
(verde/naranja) MUST permanecer bit-a-bit idéntico salvo el cambio explícito y documentado en
`testLevelGreen01` (FR-006).

**Scale/Scope**: Tres colores en `PieceColor` (verde, naranja — sin cambio de conjunto), un nuevo
nivel de prueba dedicado a la aniquilación, un ajuste mínimo (dos campos) en `testLevelGreen01`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|---|---|---|
| I. Pure, UI-Independent Simulation Core | PASS | Todo el cambio vive en `src/engine/`, sin dependencias de renderizado. |
| II. Test-First Engine Logic | PASS | `same-color.test.ts` se escribe antes de la implementación (ver tasks.md); las suites de verde/naranja existentes son el test de regresión de "colores distintos". |
| III. Determinism & Reproducibility | PASS | La comprobación de mismo color es una función pura de los colores implicados; sin randomness. |
| IV. Levels as Declarative Data | PASS | El nuevo nivel de prueba es un objeto `Level` declarativo, igual que los anteriores. |
| V. Composable Primitives Over Special-Casing | PASS | La comprobación se implementa como un único punto de entrada compartido entre el impacto inicial y cualquier eslabón de cascada — no se duplica lógica entre ambos casos (ver research.md). |

No hay violaciones que justificar, salvo la extensión documentada del tipo `EventLog` (ver
research.md, Decisión 2) — un nuevo tipo de evento, no una modificación de los existentes.

*Re-check post Fase 1*: sin cambios de estado. `AnnihilationEvent` es una adición al union type
`ChainEvent`, no rompe `MoveStepEvent` ni el contrato público ya existente (`resolveLaunch` sigue
teniendo la misma firma). El cambio en `testLevelGreen01` es de dos valores (color de la ficha ya
colocada, color del objetivo) sin tocar ningún archivo de test existente.

## Project Structure

### Documentation (this feature)

```text
specs/003-same-color-collision/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── engine-api.md     # Phase 1 output (actualiza el contrato de las features 001/002)
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
└── engine/
    ├── board.ts           # Sin cambios
    ├── move-step.ts        # Sin cambios
    ├── events.ts             # AMPLÍA: nuevo AnnihilationEvent, ChainEvent = MoveStepEvent |
    │                          AnnihilationEvent, EventLog = ChainEvent[]. ImpactHandler sigue
    │                          teniendo la misma forma (board, events, nextSites), solo cambia el
    │                          tipo de `events`.
    ├── launch.ts             # Sin cambios
    ├── objective.ts           # Sin cambios (ya evalúa sobre el tablero final genéricamente)
    ├── pieces/
    │   └── push.ts             # MODIFICA: comprobación de mismo color como primer paso, en un
    │                            único punto reutilizado tanto para el impacto inicial como para
    │                            cada eslabón recursivo de cascada (ver research.md, Decisión 1)
    ├── level.ts                 # MODIFICA testLevelGreen01 (ficha ya colocada -> naranja, color
    │                              del objetivo -> naranja; misma casilla). AÑADE
    │                              testLevelSameColor01 (impacto inicial) y
    │                              testLevelSameColorCascade01 (eslabón de cascada)
    └── index.ts                  # AMPLÍA re-exports: AnnihilationEvent, ChainEvent, los dos
                                    fixtures nuevos

tests/
└── unit/
    └── engine/
        ├── launch.test.ts        # Sin modificar (regresión colores distintos)
        ├── chain.test.ts          # Sin modificar (regresión colores distintos; lee targetColor
        │                          del propio fixture, así que se adapta solo)
        ├── objective.test.ts      # Sin modificar
        ├── determinism.test.ts    # Sin modificar
        ├── orange.test.ts         # Sin modificar
        └── same-color.test.ts     # NUEVO: aniquilación en impacto inicial y en un eslabón de
                                     cascada, sin efecto de empuje/salto, objetivo evaluado sobre
                                     el tablero resultante
```

**Structure Decision**: Se mantiene el proyecto único ya existente. Único cambio estructural
relevante: `events.ts` gana un tipo de evento nuevo (antes solo tenía `MoveStepEvent`) — es una
extensión aditiva del union type, no una modificación de lo ya existente.

## Complexity Tracking

*Sin violaciones que justificar — tabla vacía.*
