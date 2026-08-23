# Implementation Plan: Ficha Marrón (Movimiento Largo Repetido)

**Branch**: `008-brown-piece` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-brown-piece/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Añade `'brown'` como tercer `PieceColor`. La única pieza de motor que cambia es
`src/engine/pieces/push.ts`: `PUSH_DISTANCE: Record<PieceColor, number>` (una distancia fija
por color) se generaliza a `PUSH_STRATEGY: Record<PieceColor, DisplacementStrategy>` (una
función que calcula el destino, por color) — verde y naranja siguen siendo saltos de distancia
fija (1 y 2), marrón es una nueva estrategia que camina casilla a casilla comprobando ocupación
en cada una, hasta bloquearse o cruzar el borde del tablero por segunda vez (spec.md,
Clarifications). El resto de `resolveStrike` no cambia ni una línea — sigue sin saber ni
necesitar saber cómo se calculó `to`, exactamente igual que ya no necesita saber si viene de un
wrap (feature 004) ni si la ficha original se queda o no en el tablero (feature 006).

## Technical Context

**Language/Version**: TypeScript, sin cambios respecto al resto del motor.

**Primary Dependencies**: Ninguna nueva.

**Storage**: N/A.

**Testing**: Vitest. Nueva lógica de motor (Principio II, NON-NEGOTIABLE): el nuevo primitivo de
movimiento (`stepUntilBlocked` en `move-step.ts`) y la nueva estrategia de empuje de marrón en
`push.ts` llevan tests antes/junto a su implementación, igual que cualquier feature anterior.

**Target Platform**: N/A — cambio de motor headless. Sin cambios de renderer más allá de un
único valor de color necesario para que `board-view.ts` siga compilando (ver Constraints).

**Project Type**: Proyecto único ya existente.

**Performance Goals**: N/A — el peor caso del bucle de marrón son ~16 pasos (dos vueltas al
tablero como mucho), trivial computacionalmente.

**Constraints**: `PieceColor` gana `'brown'`; `board-view.ts` usa
`Record<PieceColor, number>` para los colores de fichas en pantalla — TypeScript exige que ese
mapa esté completo, así que necesita una entrada `brown: <color>` para seguir compilando. Esto
NO añade marrón al prototipo jugable de Fase 2 (ningún nivel nuevo, sin cambios de
`BoardScene`/niveles) — es solo el mínimo necesario para que el build no se rompa, coherente con
el alcance "solo motor" de spec.md → Assumptions.

**Scale/Scope**: Un nuevo primitivo de movimiento, una nueva entrada en la estrategia de empuje,
el tipo `PieceColor` ampliado, y las fixtures/tests correspondientes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS — todo el cambio de comportamiento vive en `src/engine/`; el único toque fuera de `engine/` es un valor de color en `board-view.ts` para que el tipo siga siendo exhaustivo, no lógica de juego. |
| II. Test-First Engine Logic | PASS — `stepUntilBlocked` y la estrategia de marrón llevan tests Vitest antes de implementarse, como toda regla de interacción anterior. |
| III. Determinism & Reproducibility | PASS — el bucle de marrón es una función pura de `board`/`position`/`direction`; mismo input, mismo resultado siempre. |
| IV. Levels as Declarative Data | PASS — las nuevas fixtures de test usan `createLevel`, igual que las existentes. |
| V. Composable Primitives Over Special-Casing | PASS, y es la motivación central del diseño: en vez de un `if (color === 'brown')` especial dentro de `resolveStrike`, se generaliza el mapa `PUSH_DISTANCE` (número fijo) a `PUSH_STRATEGY` (función que calcula el destino) — verde y naranja pasan a ser dos estrategias más del mismo mapa, no casos especiales frente a una tercera. `resolveStrike` no necesita saber qué estrategia se usó. |
| Development Workflow (constitución): cambios de semántica de resolución de cadena deben documentarse en plan.md | Esto es precisamente lo que hace este documento. |

Sin violaciones — Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/008-brown-piece/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No hay `contracts/`: no se introduce ninguna interfaz pública nueva ni cambia la firma de
`resolveLaunch`/`LaunchOutcome` — solo un valor más de `PieceColor` y una función interna nueva
en `pieces/push.ts`, ninguno de los dos expuesto como contrato propio.

### Source Code (repository root)

```text
src/
├── engine/
│   ├── board.ts                 # MODIFICA: PieceColor gana 'brown'
│   ├── move-step.ts               # AÑADE: stepUntilBlocked(board, position, direction,
│   │                                maxEdgeCrossings) -- nuevo primitivo de movimiento
│   └── pieces/
│       └── push.ts                 # MODIFICA: PUSH_DISTANCE -> PUSH_STRATEGY (función por
│                                     color en vez de número fijo); resolveStrike no cambia
└── renderer/
    └── board-view.ts                # MODIFICA (mínimo): añade brown: <color> a PIECE_COLOR
                                       para que el tipo Record<PieceColor, number> compile --
                                       NO añade marrón al prototipo jugable de Fase 2

tests/
└── unit/
    └── engine/
        ├── move-step.test.ts         # AÑADE tests de stepUntilBlocked
        └── brown.test.ts              # NUEVO — tests de la ficha marrón (US1-US3, edge cases)
```

**Structure Decision**: Proyecto único ya existente. `stepUntilBlocked` vive en `move-step.ts`
junto a `stepBy` (mismo criterio: primitivo de movimiento genérico, sin conocimiento de colores
ni reglas de colisión). La estrategia por color sigue viviendo en `pieces/push.ts`, igual que
`PUSH_DISTANCE` ya vivía ahí.

## Complexity Tracking

*Sin violaciones — el Constitution Check no encontró ninguna, así que esta sección queda vacía.*
