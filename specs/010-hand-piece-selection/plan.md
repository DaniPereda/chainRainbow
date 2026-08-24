# Implementation Plan: Selección Libre de Ficha en Mano

**Branch**: `010-hand-piece-selection` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-hand-piece-selection/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Generaliza "qué ficha de la mano se usa en el próximo lanzamiento" de "siempre la primera"
(`takeFirstPiece`, índice 0 implícito) a "la que el jugador haya tocado en el panel, o la
primera por defecto si no ha tocado ninguna". El motor gana un parámetro de índice en
`resolveLaunch` (con valor por defecto 0, así que todo lanzamiento existente sigue funcionando
sin cambios); `LevelSession` gana el estado de selección y su lógica de avance/preservación
(nueva, con tests, Principio II); el renderer añade zonas táctiles por ficha del panel y un
anillo de resaltado alrededor de la seleccionada, reutilizando el lenguaje visual ya establecido
por el anillo de objetivo del tablero (mismo `lineStyle(3, color, 1)` + `strokeCircle`/
`strokeRect`, según user request explícito).

## Technical Context

**Language/Version**: TypeScript, sin cambios.

**Primary Dependencies**: Ninguna nueva (Phaser 3 ya es dependencia del renderer).

**Storage**: N/A.

**Testing**: Vitest. La lógica de selección (motor: `session.ts`, `resolve-launch.ts`,
`launch.ts`) es determinista y se prueba en aislamiento (Principio II). Las zonas táctiles y el
dibujo del anillo de resaltado en el renderer se validan manualmente (mismo criterio ya
establecido para `board-view.ts`/`hand-panel.ts`: sin cobertura Vitest propia, ver
quickstart.md).

**Target Platform**: N/A motor / navegador + Capacitor para el renderer, sin cambios.

**Project Type**: Proyecto único ya existente.

**Performance Goals**: N/A.

**Constraints**: `resolveLaunch` gana un parámetro `pieceIndex` con valor por defecto 0, para que
ningún call site existente (fixtures de motor, niveles del prototipo) necesite cambiar. El panel
de mano pasa de ser una única `Graphics` no interactiva a necesitar zonas táctiles por ficha,
recreadas en cada redibujado porque el número de fichas cambia con cada lanzamiento (a
diferencia de los marcadores de borde del tablero, que son fijos y se crean una sola vez).

**Scale/Scope**: 3 ficheros de motor (`launch.ts`, `resolve-launch.ts`, `session.ts`), 2 de
renderer (`hand-panel.ts`, `BoardScene.ts`), y sus tests de motor correspondientes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS — la regla de "qué índice seleccionar tras un lanzamiento/missclick" vive en `session.ts` (motor), no en `BoardScene.ts`; el renderer solo reenvía el toque (qué índice tocó el jugador) y redibuja según el estado que el motor ya decidió, igual que ya hace con dirección/carril en los marcadores de borde. |
| II. Test-First Engine Logic | PASS — `selectHandPiece`, y la actualización de `selectedHandIndex` dentro de `applySessionLaunch`/`restartSession`, se prueban en `session.test.ts` antes/junto a su implementación; `resolveLaunch` con `pieceIndex` no-cero se prueba en `launch.test.ts`. |
| III. Determinism & Reproducibility | PASS — mismo nivel + mismo `launch` + mismo `pieceIndex` producen siempre el mismo resultado; se añade un caso de determinismo con `pieceIndex` distinto de 0, análogo al ya existente para el caso por defecto. |
| IV. Levels as Declarative Data | PASS — `Level`/`createLevel` no cambian; la selección es estado de sesión efímero, nunca parte de la definición declarativa de un nivel. |
| V. Composable Primitives Over Special-Casing | PASS — no se introduce ningún primitivo de pieza ni de resolución de cadena; es exclusivamente un cambio de qué INPUT (qué ficha) llega a la maquinaria ya existente, análogo a cómo ya se elige dirección/carril. |
| Development Workflow: cambios de semántica de resolución de cadena deben documentarse en plan.md | No aplica — esta feature no cambia la resolución de cadena, solo qué ficha la dispara. |

Sin violaciones — Complexity Tracking queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/010-hand-piece-selection/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No hay `contracts/`: no es una interfaz externa; `resolveLaunch` cambia de firma de forma
estrictamente aditiva y retrocompatible (parámetro nuevo con valor por defecto), documentado en
data-model.md en su lugar.

### Source Code (repository root)

```text
src/
├── engine/
│   ├── launch.ts              # MODIFICA: takeFirstPiece -> takePieceAt(hand, index)
│   ├── resolve-launch.ts      # MODIFICA: resolveLaunch gana pieceIndex (default 0)
│   └── session.ts             # MODIFICA: LevelSession gana selectedHandIndex; nueva
│                                 selectHandPiece(session, index); applySessionLaunch y
│                                 restartSession derivan/resetean selectedHandIndex
└── renderer/
    ├── hand-panel.ts           # MODIFICA: drawHand dibuja el anillo de selección y
    │                             devuelve las posiciones locales de cada ficha
    └── scenes/
        └── BoardScene.ts        # MODIFICA: zonas táctiles por ficha de mano (recreadas en
                                    cada redraw), tap llama a selectHandPiece + redibuja

tests/
└── unit/
    └── engine/
        ├── launch.test.ts      # MODIFICA: casos con pieceIndex distinto de 0
        ├── session.test.ts     # MODIFICA: selectHandPiece, avance tras lanzamiento,
        │                         preservación en missclick, reset en restart
        └── determinism.test.ts # MODIFICA: caso de determinismo con pieceIndex no-cero
```

**Structure Decision**: Sin cambios estructurales. El motor sigue viviendo enteramente en
`src/engine/`, sin ninguna dependencia nueva hacia `src/renderer/`.

## Complexity Tracking

*Sin violaciones que justificar.*
