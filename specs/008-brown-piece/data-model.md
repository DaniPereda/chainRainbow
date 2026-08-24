# Phase 1 Data Model: Ficha Marrón (Movimiento Largo Repetido)

## Cambio de tipo: `PieceColor` (`src/engine/board.ts`)

```ts
export type PieceColor = 'green' | 'orange' | 'brown';
```

Ningún otro tipo cambia de forma (`Piece`, `Board`, `Level`, `LevelSession`... todos siguen
igual, ya son genéricos sobre `PieceColor`).

## Nuevo primitivo: `stepUntilBlocked` (`src/engine/move-step.ts`)

Ver research.md para el código exacto y el razonamiento del caso `isSelf`. Firma:

```ts
export function stepUntilBlocked(
  board: Board,
  position: Coordinate,
  direction: Direction,
  maxEdgeCrossings: number,
): Coordinate
```

## Cambio: `PUSH_DISTANCE` → `PUSH_STRATEGY` (`src/engine/pieces/push.ts`)

Ver research.md. `resolveStrike` cambia una única línea para llamar a
`PUSH_STRATEGY[strikerColor](board, position, direction)` en vez de
`stepBy(position, direction, PUSH_DISTANCE[strikerColor])`.

## Cambio mínimo de renderer: `board-view.ts`

```ts
export const PIECE_COLOR: Record<PieceColor, number> = {
  green: 0x2ecc71,
  orange: 0xe67e22,
  brown: 0x8d6e63,
};
```

Sin ningún otro cambio de renderer — ningún nivel del prototipo de Fase 2 usa `'brown'` todavía.

## Fixtures de test (`tests/unit/engine/brown.test.ts`)

Todas construidas con `createLevel`, en filas/columnas distintas, verificadas a mano paso a
paso (igual que las fixtures de features anteriores):

**1. Empuje largo hasta un bloqueo, que a su vez se resuelve con SU PROPIA distancia** (US1
AC1, US2 AC2 — demuestra que marrón no "contamina" la distancia del siguiente eslabón):
- `pieces: [{at:{row:0,col:1},color:'green'}, {at:{row:0,col:5},color:'orange'}]`,
  `hand:['brown']`.
- Lanzamiento `{direction:'E', lane:0}`: marrón golpea green@(0,1) → camina col2,3,4 (vacías) →
  col5 ocupada (orange) → bloqueado ahí. `to=(0,5)`. Recursa: green (ahora el que golpea) vs
  orange@(0,5), distinto color → empuje con la distancia de VERDE (1, no la de marrón) →
  `(0,6)` vacía → orange se asienta ahí; green se asienta en `(0,5)` (vacada por orange).
- Resultado esperado: `cells[0][1]` null, `cells[0][5]`=green, `cells[0][6]`=orange,
  `cells[0][0]` null (la marrón lanzada nunca se asienta, spec.md 006).

**2. Bloqueo inmediato — no se salta la primera casilla** (US1 AC2, contraste explícito con
naranja):
- `pieces: [{at:{row:1,col:1},color:'green'}, {at:{row:1,col:2},color:'orange'}]`,
  `hand:['brown']`.
- Lanzamiento `{direction:'E', lane:1}`: marrón golpea green@(1,1) → primer paso (col2) ya
  ocupado → bloqueado inmediatamente, `to=(1,2)`. Recursa igual que el caso 1: green empuja
  orange 1 casilla → `(1,3)`.
- Resultado esperado: `cells[1][1]` null, `cells[1][2]`=green, `cells[1][3]`=orange.

**3. Empuje largo que termina en aniquilación por mismo color** (US2 AC1):
- `pieces: [{at:{row:2,col:1},color:'green'}, {at:{row:2,col:4},color:'green'}]`,
  `hand:['brown']`.
- Lanzamiento `{direction:'E', lane:2}`: marrón golpea green@(2,1) → camina col2,3 (vacías) →
  col4 ocupada por OTRA green (mismo color que la que se desplaza) → ambas se aniquilan ahí.
- Resultado esperado: `cells[2][1]` null, `cells[2][4]` null, un evento `ANNIHILATION`.

**4. Fila despejada — se detiene en el segundo cruce de borde** (US3; ejercita también el caso
`isSelf` de research.md, inevitable en este escenario):
- `pieces: [{at:{row:4,col:3},color:'orange'}]`, `hand:['brown']`, fila 4 vacía por lo demás.
- Lanzamiento `{direction:'E', lane:4}`: marrón golpea orange@(4,3) → camina col4,5,6,7 (4
  pasos, sin cruzar aún) → col0 (1er cruce, vacía, continúa) → col1,2,3(=posición propia,
  excluida como obstáculo),4,5,6,7 → col0 de nuevo (2º cruce) → se detiene ahí, 13 pasos en
  total.
- Resultado esperado: `cells[4][3]` null, `cells[4][0]`=orange (13 pasos después de su posición
  original — mucho más lejos que verde o naranja).

**5. Dos fichas marrón se encuentran directamente** (edge case — confirma que la aniquilación ya
existente no necesita ningún ajuste para marrón):
- `pieces: [{at:{row:5,col:1},color:'brown'}]`, `hand:['brown']`.
- Lanzamiento `{direction:'E', lane:5}`: marrón golpea brown@(5,1) — mismo color que quien
  golpea → aniquilación inmediata, el paseo largo nunca llega a empezar.
- Resultado esperado: `cells[5][1]` null, un evento `ANNIHILATION`, sin eventos `MOVE_STEP`.

**6. Marrón lanzado desde la mano: missclick** (FR-006):
- Reutiliza el patrón ya establecido (`GREEN_MISSCLICK_LAUNCH`-equivalente): un lanzamiento
  `{direction, lane}` sobre un tablero sin ninguna ficha en esa fila/columna, `hand:['brown']`.
- Resultado esperado: `missclick:true`, mano sin cambios, resultado `'undetermined'` — idéntico
  al comportamiento ya validado para verde/naranja.
