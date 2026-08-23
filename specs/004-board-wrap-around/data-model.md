# Phase 1 Data Model: Wrap-around de Fichas en el Tablero

Extiende los modelos de las features 001-003, que siguen vigentes salvo lo indicado aquí. Ningún
tipo existente cambia de forma — solo se añade una función y tres fixtures.

## Nuevo: `wrapCoordinate` (board.ts)

```ts
function wrapCoordinate(coord: Coordinate): Coordinate {
  const wrap = (n: number) => ((n % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return { row: wrap(coord.row), col: wrap(coord.col) };
}
```

Módulo estándar (no un simple `if` de un solo paso) para que siga siendo correcto sin cambios si
en el futuro una ficha empuja a una distancia mayor que el tablero — aunque con `PUSH_DISTANCE`
actual nunca hace falta más de un ajuste. Se aplica a la coordenada YA calculada
(`position + delta * distance`), nunca a una posición intermedia — coherente con que el motor no
lee ni escribe casillas intermedias de un salto (feature 002).

## Cambio de comportamiento en `resolveStrike` (pieces/push.ts)

`to` pasa de `stepBy(position, direction, distance)` a `wrapCoordinate(stepBy(position, direction,
distance))`. La rama `!isInBounds(to)` (ficha eliminada) desaparece — con `to` ya envuelta, el
flujo siempre continúa directo a `getPieceAt(board, to)` y a la regla universal de interacción ya
existente (mismo color → `AnnihilationEvent`; distinto color → empuje/`MOVE_STEP`, recursando si
hace falta). Ningún otro campo de `MoveStepEvent`/`AnnihilationEvent` cambia.

## Nuevos fixtures (level.ts)

Los tres usan `createTestLevel` (feature 003) y viven en filas distintas para no interferir entre
sí, aunque cada test construye su propio tablero de todos modos.

**`testLevelWrapToEmpty01`** (Acceptance Scenario 2 — destino de wrap vacío):
- pieza `naranja` en `(2, 7)` (borde derecho); mano: `verde`.
- Lanzamiento `{ direction: 'E', lane: 2 }`: verde golpea la naranja en `(2,7)`; distinto color →
  empuje normal con la distancia de verde (1) → destino crudo `(2,8)` → envuelto a `(2,0)`
  (vacío) → la naranja se asienta ahí.
- Objetivo: `{ at: { row: 2, col: 0 }, color: 'orange' }` → `'won'` si el wrap funciona.

**`testLevelWrapToDifferentColor01`** (Acceptance Scenario 3 — wrap aterriza en color distinto):
- piezas: `naranja` en `(3, 7)`, `verde` en `(3, 0)`; mano: `verde`.
- Lanzamiento `{ direction: 'E', lane: 3 }`: verde golpea la naranja en `(3,7)` (distinto color) →
  empuje distancia 1 → envuelve a `(3,0)`, donde hay una ficha verde (distinto color que la
  naranja que empuja) → nuevo empuje, ahora con la distancia de naranja (2) → `(3,0)+2 = (3,2)`
  (vacío) → la verde se asienta ahí.
- Objetivo: `{ at: { row: 3, col: 2 }, color: 'green' }` → `'won'` si la cascada tras el wrap se
  resuelve igual que en cualquier otro punto de una cadena.

**`testLevelWrapToSameColor01`** (Acceptance Scenario 4 — wrap aterriza en el mismo color):
- piezas: `naranja` en `(4, 7)`, `naranja` en `(4, 0)`; mano: `verde`.
- Lanzamiento `{ direction: 'E', lane: 4 }`: verde golpea la naranja en `(4,7)` (distinto color,
  empuje normal) → envuelve a `(4,0)`, ocupada por OTRA naranja (mismo color que la que empuja) →
  `AnnihilationEvent`, ambas desaparecen. El lanzador verde sí se asienta en `(4,7)` — su propia
  colisión inicial fue de colores distintos, ajeno a lo que pase después en la cadena (mismo
  principio ya probado en la feature 003).
- Objetivo: `{ at: { row: 4, col: 7 }, color: 'green' }` → `'won'`.

El Acceptance Scenario 5 (missclick no afectado) y el 6 (no regresión) no necesitan fixtures
nuevos — se verifican con las suites ya existentes, sin modificar (ver quickstart.md).
