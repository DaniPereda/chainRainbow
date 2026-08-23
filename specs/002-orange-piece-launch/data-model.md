# Phase 1 Data Model: Lanzamiento de Ficha Naranja

Extiende el modelo de `specs/001-green-piece-launch/data-model.md`, que sigue vigente para todo lo
no mencionado aquí (Board, Hand, Launch, MoveStepEvent, EventLog, Objective, Level, LevelResult,
LaunchOutcome — sin cambios de forma).

## Cambios sobre tipos existentes

```ts
type PieceColor = 'green' | 'orange'; // antes: 'green' únicamente
```

Ningún otro tipo cambia de forma. `Piece = { color: PieceColor }` ahora admite ambos valores sin
modificación propia.

## Nuevo: tabla de distancia de empuje

```ts
const PUSH_DISTANCE: Record<PieceColor, number> = {
  green: 1,
  orange: 2,
};
```

**No es una entidad del dominio del juego** (no aparece en spec.md, que se mantiene agnóstica a
implementación) — es una tabla de configuración interna que reemplaza lo que en la feature 001 era
código dedicado (`applyGreenImpact`). Añadir un futuro color cuyo comportamiento sea "empuje de N
casillas" (si lo hubiera) se reduciría a añadir una fila aquí, sin código nuevo.

## Regla de cascada (ver research.md, Decisión 2 — corregida el 2026-08-23)

En cualquier punto de una cadena de empuje, la distancia aplicada la determina `PUSH_DISTANCE[color]`
de la ficha que **golpea** en ese instante (la que está en movimiento), no la de la ficha que lo
recibe. En el primer impacto es la ficha lanzada; en un eslabón posterior de una cascada, es la
ficha que se acaba de mover (no la lanzada originalmente, ni la que recibe el golpe por su propio
color). Válido para cualquier mezcla de colores presentes en `PUSH_DISTANCE`, incluidos niveles
con verde y naranja en la misma cadena — verificado en `orange.test.ts`.

## Level: nuevo fixture

`testLevelOrange01` (en `src/engine/level.ts`, junto a `testLevelGreen01`) — un `Level`
independiente (no reutiliza el tablero/mano de verde) con **dos fichas verdes** colocadas en línea
según el Acceptance Scenario 1 del spec: una en el punto de impacto, una en la casilla intermedia
(para verificar que queda intacta, SC-002). La casilla de aterrizaje (dos más allá del punto de
impacto) queda **vacía a propósito** — esta historia no ejercita la cascada (FR-004), ver spec.md
→ Assumptions. Ninguna ficha del tablero es naranja (evita solaparse con la regla de mismo color,
todavía no implementada). El objetivo no se cumple en el estado inicial, igual que en
`testLevelGreen01`.
