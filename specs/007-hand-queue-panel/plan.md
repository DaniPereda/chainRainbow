# Implementation Plan: Panel de Fichas en Mano

**Branch**: `007-hand-queue-panel` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-hand-queue-panel/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Un panel debajo del tablero, en `BoardScene`, que dibuja un círculo de color por cada ficha que
queda en `session.current.hand.pieces`, en orden — igual que `board-view.ts` ya traduce
`Board`/`Objective` a formas Phaser, un nuevo módulo `hand-panel.ts` traduce `Hand` a formas
Phaser. Se redibuja en el mismo momento en que ya se redibuja el tablero (tras cada lanzamiento
y tras reiniciar), así que no hace falta ningún estado ni lógica nueva — el motor ya expone
`session.current.hand` con exactamente el contenido y el orden que pide la spec.

## Technical Context

**Language/Version**: TypeScript, sin cambios.

**Primary Dependencies**: Ninguna nueva — sigue usando Phaser 3 ya instalado.

**Storage**: N/A.

**Testing**: Vitest. Igual que `board-view.ts`, `hand-panel.ts` es puramente formas Phaser sobre
datos ya validados por el motor (`Hand`) — no introduce lógica nueva que testear con Vitest; se
valida manualmente en el navegador, como el resto del renderer (constitución, misma excepción ya
usada en 005).

**Target Platform**: Navegador — sin cambios respecto al resto del prototipo de Fase 2.

**Project Type**: Proyecto único ya existente.

**Performance Goals**: N/A — dibujar como máximo un puñado de círculos no tiene riesgo de
rendimiento.

**Constraints**: El panel es puramente informativo (FR-007, spec.md) — no debe influir en qué
ficha se lanza ni en ninguna decisión del motor.

**Scale/Scope**: Un módulo nuevo pequeño (`hand-panel.ts`, análogo a `board-view.ts`) más una
extensión de `BoardScene.ts` para invocarlo cada vez que ya se redibuja el tablero.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS — el panel solo LEE `session.current.hand`, ya calculado por el motor; no decide nada. |
| II. Test-First Engine Logic | N/A — no se toca ninguna regla de interacción ni lógica del motor. |
| III. Determinism & Reproducibility | PASS, sin cambios — el motor no se toca. |
| IV. Levels as Declarative Data | N/A — no se tocan niveles. |
| V. Composable Primitives Over Special-Casing | PASS — reutiliza el mismo patrón ya establecido por `board-view.ts` (traducir un dato del motor a formas Phaser) en vez de inventar un mecanismo nuevo. |
| Tech Stack: Phaser 3 solo como capa de presentación | PASS por diseño — `hand-panel.ts` no contiene ninguna regla de juego. |

Sin violaciones — Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/007-hand-queue-panel/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output -- sin entidades nuevas, documenta el módulo nuevo
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No hay `contracts/`: no se introduce ninguna interfaz nueva entre el renderer y el motor — el
panel consume `Hand`/`PieceColor`, ya parte del contrato existente
(`specs/005-frontend-prototype/contracts/engine-renderer-boundary.md`).

### Source Code (repository root)

```text
src/
└── renderer/
    ├── hand-panel.ts               # NUEVO — dibuja un círculo de color por ficha de Hand,
    │                                 en orden, análogo a board-view.ts
    └── scenes/
        └── BoardScene.ts             # MODIFICA — crea un Graphics para el panel y lo redibuja
                                        junto al tablero en cada punto donde ya se llama a
                                        this.redraw()
```

**Structure Decision**: Sin cambios estructurales — un módulo nuevo junto a `board-view.ts`
(mismo patrón, mismo nivel), y una extensión de `BoardScene.ts` ya existente.

## Complexity Tracking

*Sin violaciones — el Constitution Check no encontró ninguna, así que esta sección queda vacía.*
