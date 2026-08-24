# Implementation Plan: Ficha Roja (Ramificación)

**Branch**: `009-red-piece` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-red-piece/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Rojo introduce el primer primitivo genuinamente nuevo desde que existe el motor: hasta ahora,
`PUSH_STRATEGY[strikerColor]` siempre calcula UN destino para la ficha golpeada (verde/naranja:
salto fijo; marrón: paseo hasta bloquearse). Rojo no encaja en esa forma — en vez de un destino,
produce DOS movimientos independientes, cada uno con su propia cadena posible. Se añade
`resolveSplit`/`resolveBranch` en `pieces/push.ts`, invocado desde `resolveStrike` cuando
`strikerColor === 'red'` (después de comprobar mismo color, que sigue teniendo prioridad sin
cambios). Cada rama reutiliza `resolveStrike` tal cual para su propia cadena — la única pieza de
lógica genuinamente nueva es "calcular las dos direcciones perpendiculares y resolverlas en
orden, una después de la otra sobre el tablero que deja la anterior".

## Technical Context

**Language/Version**: TypeScript, sin cambios.

**Primary Dependencies**: Ninguna nueva.

**Storage**: N/A.

**Testing**: Vitest. Nueva lógica de motor (Principio II, NON-NEGOTIABLE): `resolveSplit`/
`resolveBranch` no se exportan como primitivos aislados (a diferencia de `stepUntilBlocked`) —
se prueban a través de `resolveLaunch`, igual que `resolveStrike` en sí ya se prueba siempre
indirectamente, nunca como unidad aislada.

**Target Platform**: N/A — cambio de motor headless, sin cambios de renderer más allá de la
misma entrada de color mínima que ya se hizo para marrón (Constraints).

**Project Type**: Proyecto único ya existente.

**Performance Goals**: N/A.

**Constraints**: `PieceColor` gana `'red'`; `board-view.ts` necesita una entrada de color más
en `PIECE_COLOR` para seguir compilando — sin añadir rojo a ningún nivel del prototipo de Fase 2
(mismo criterio ya aplicado a marrón, spec.md 008).

**Scale/Scope**: Dos funciones nuevas en `pieces/push.ts` (`resolveSplit`, `resolveBranch`), una
modificación de una rama de `resolveStrike`, un mapa de direcciones perpendiculares, y sus
fixtures de test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Requisito | Evaluación |
|---|---|
| I. Pure, UI-Independent Simulation Core | PASS — todo el cambio vive en `src/engine/pieces/push.ts`; el renderer no cambia salvo la entrada de color. |
| II. Test-First Engine Logic | PASS — `brown.test.ts`/`red.test.ts` (nuevo) se escriben describiendo el comportamiento correcto antes de tocar `push.ts`, mismo ciclo que toda feature anterior. |
| III. Determinism & Reproducibility | PASS — el orden fijo de las dos ramas (FR-005) es precisamente lo que garantiza que el resultado no dependa de nada más que el nivel y el lanzamiento. |
| IV. Levels as Declarative Data | PASS — fixtures nuevas con `createLevel`, sin cambios de patrón. |
| V. Composable Primitives Over Special-Casing | **Requiere justificación explícita** — ver más abajo. |
| Development Workflow (constitución): cambios de semántica de resolución de cadena deben documentarse en plan.md | Esto es precisamente lo que hace este documento. |

### Justificación Principio V: por qué rojo SÍ necesita un primitivo nuevo

Verde, naranja y marrón son, cada uno, una forma distinta de calcular UN destino a partir de
`(board, piece, position, direction)` — por eso `DisplacementStrategy` (una función que
devuelve una `Coordinate`) los captura a los tres sin ningún caso especial. Rojo no calcula un
destino: sustituye una ficha por DOS movimientos independientes, cada uno potencialmente
desencadenando su propia cadena. Ninguna generalización razonable de "devuelve una Coordinate"
puede expresar "devuelve dos cadenas resueltas secuencialmente" sin dejar de ser esa misma
abstracción. El propio documento de diseño del juego llama a esto explícitamente "la primera
operación de ramificación" (sección 10), distinguiéndolo a propósito de las composiciones de
MOVE_STEP de la sección 9 — la novedad no es una elección de implementación, es del propio
diseño del juego.

Lo que SÍ se reutiliza sin cambios: `resolveStrike` en sí (cada rama, al toparse con algo,
vuelve a llamarlo tal cual — no hay una segunda copia de la lógica de empuje/aniquilación),
`stepBy` (cada rama avanza 1 casilla con el mismo wrap-around de siempre), y el propio patrón de
"quien golpea se asienta en la casilla que deja vacía la aniquilación no ocurrida" (ver
data-model.md — se obtiene gratis de la estructura recursiva ya existente, sin ningún código
adicional).

Sin más violaciones — Complexity Tracking queda vacío salvo esta entrada, ya justificada.

## Project Structure

### Documentation (this feature)

```text
specs/009-red-piece/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No hay `contracts/`: no cambia ninguna firma pública (`resolveLaunch`/`LaunchOutcome` iguales).

### Source Code (repository root)

```text
src/
├── engine/
│   ├── board.ts                 # MODIFICA: PieceColor gana 'red'
│   └── pieces/
│       └── push.ts                 # MODIFICA: nuevo PERPENDICULAR_DIRECTIONS,
│                                     resolveSplit, resolveBranch; resolveStrike gana una
│                                     rama para strikerColor === 'red'
└── renderer/
    └── board-view.ts                # MODIFICA (mínimo): añade red: <color> a PIECE_COLOR

tests/
└── unit/
    └── engine/
        └── red.test.ts                # NUEVO — tests de la ficha roja (US1-US3, edge cases)
```

**Structure Decision**: Sin cambios estructurales. Todo el comportamiento nuevo vive dentro de
`pieces/push.ts`, junto a `resolveStrike`/`PUSH_STRATEGY` ya existentes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| `resolveSplit`/`resolveBranch`: primitivo nuevo, no expresable como `DisplacementStrategy` | Rojo produce dos cadenas independientes, no un destino único (ver justificación Principio V arriba) | Forzarlo dentro de `DisplacementStrategy` (p. ej. devolviendo una lista de coordenadas y dejando que `resolveStrike` las procese) trasladaría la complejidad de "resolver dos cadenas secuenciales" a `resolveStrike`, contaminando la lógica ya estable de verde/naranja/marrón con una rama especial para listas — peor en ambos sitios a la vez |
