# Phase 1 Data Model: Wrap-around de Fichas en el Tablero

Extiende los modelos de las features 001-003, que siguen vigentes salvo lo indicado aquí. Ningún
tipo existente cambia de forma — solo se añade una función y un fixture.

## Nuevo: `wrapCoordinate` (board.ts)

```ts
function wrapCoordinate(coord: Coordinate): Coordinate {
  const wrap = (n: number) => ((n % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return { row: wrap(coord.row), col: wrap(coord.col) };
}
```

Módulo estándar (no un simple `if` de un solo paso) para que siga siendo correcto sin cambios si
en el futuro una ficha empuja a una distancia mayor que el tablero — aunque con `PUSH_DISTANCE`
actual nunca hace falta más de un ajuste.

## Nuevo: `stepBy` vive en `move-step.ts`, no en `pieces/push.ts`

Diseño revisado durante la implementación: el wrap-around es una propiedad del *movimiento en
sí* — "moverse N casillas en una dirección sobre este tablero" — no una regla de colisión. Por
eso `stepBy` (mover una coordenada `distance` casillas, aplicando `wrapCoordinate` al resultado)
se movió de `pieces/push.ts` a `move-step.ts`, junto a `step`/`opposite`:

```ts
// move-step.ts
export function stepBy(coord: Coordinate, direction: Direction, distance: number): Coordinate {
  let current = coord;
  for (let i = 0; i < distance; i++) {
    current = step(current, direction);
  }
  return wrapCoordinate(current);
}
```

`resolveStrike` (pieces/push.ts) simplemente llama a `stepBy(position, direction,
PUSH_DISTANCE[strikerColor])` y no sabe ni necesita saber que el resultado puede venir de un
wrap — la rama `!isInBounds(to)` (ficha eliminada) desaparece porque `to` ya viene envuelta, y el
flujo siempre continúa directo a `getPieceAt(board, to)` y a la regla universal de interacción ya
existente (mismo color → `AnnihilationEvent`; distinto color → empuje/`MOVE_STEP`, recursando si
hace falta). Ningún otro campo de `MoveStepEvent`/`AnnihilationEvent` cambia.

## Nuevo fixture (level.ts)

**`testLevelWrapToEmpty01`** (Acceptance Scenarios 1-2 — destino de wrap vacío):
- pieza `naranja` en `(2, 7)` (borde derecho); mano: `verde`.
- Lanzamiento `{ direction: 'E', lane: 2 }`: verde golpea la naranja en `(2,7)`; distinto color →
  empuje normal con la distancia de verde (1) → destino crudo `(2,8)` → envuelto a `(2,0)`
  (vacío) → la naranja se asienta ahí.
- Objetivo: `{ at: { row: 2, col: 0 }, color: 'orange' }` → `'won'` si el wrap funciona.

## Acceptance Scenarios 3-4 (wrap aterriza en casilla ocupada): sin fixture dedicado

El plan original proponía `testLevelWrapToDifferentColor01`/`testLevelWrapToSameColor01`, cada
uno con una segunda ficha en `col:0` de su fila para representar "lo que ya había en el destino
del wrap". Ese diseño resultó inválido: para `direction:'E'`, `col:0` es exactamente donde
empieza el escaneo de `travelLaunch` — la ficha en `col:0` se detecta como el primer impacto en
lugar de la residente en `col:7`, invalidando el fixture antes de que el wrap entre en juego.

Se evaluó también una cascada más larga (varias fichas alternando color a lo largo de la fila
para que el wrap ocurriera en un eslabón posterior, no en el primer impacto). Se descartó: con
`PUSH_DISTANCE` ∈ {1, 2} y tablero de 8 columnas, cualquier cascada lo bastante larga para
completar un wrap dentro de una misma resolución termina revisitando una columna que un eslabón
anterior de la misma cadena ya vació — y `resolveStrike` comprueba ocupación contra el tablero
*original* sin mutar en cada nivel de la recursión, no contra un tablero progresivamente
actualizado. Eso produce una colisión fantasma con una ficha que, en la práctica, ya se había
movido. Es exactamente el tipo de bucle "una cascada da una vuelta completa dentro de una misma
resolución" que esta historia excluye explícitamente de su alcance (ver spec.md, delegado a la
futura ficha marrón) — así que no es un fixture legítimo para esta feature, y forzarlo sería
probar algo fuera de alcance.

Cobertura real de los escenarios 3-4, por composición en vez de por fixture:
- `tests/unit/engine/move-step.test.ts` prueba `stepBy` directamente (sin tablero) y demuestra
  que calcula la coordenada envuelta correctamente para cada dirección.
- `tests/unit/engine/orange.test.ts` y `same-color.test.ts` ya prueban que `resolveStrike`
  resuelve empuje/aniquilación correctamente para *cualquier* coordenada de destino ocupada —
  sin distinguir si esa coordenada vino de un wrap o no, porque el código no la distingue.

Juntas, ambas pruebas cubren exactamente lo que dicen los Acceptance Scenarios 3-4 sin necesitar
una integración end-to-end frágil.

El Acceptance Scenario 5 (missclick no afectado) y el 6 (no regresión) tampoco necesitan
fixtures nuevos — se verifican con las suites ya existentes, sin modificar (ver quickstart.md).
