# Phase 1 Data Model: Ficha Roja (Ramificación)

## Cambio de tipo: `PieceColor` (`src/engine/board.ts`)

```ts
export type PieceColor = 'green' | 'orange' | 'brown' | 'red';
```

## Nuevo código: `src/engine/pieces/push.ts`

Ver research.md para el código exacto de `PERPENDICULAR_DIRECTIONS`, `resolveBranch`, y
`resolveSplit`, y para el bug encontrado/corregido durante el diseño. `resolveStrike` gana
exactamente una rama nueva:

```ts
if (strikerColor === 'red') {
  return resolveSplit(board, defender.color, position, direction);
}
```

insertada después de la comprobación de mismo color y antes de la línea que calcula `to` vía
`PUSH_STRATEGY`. Nada más de `resolveStrike` cambia.

## Cambio mínimo de renderer: `board-view.ts`

```ts
export const PIECE_COLOR: Record<PieceColor, number> = {
  green: 0x2ecc71,
  orange: 0xe67e22,
  brown: 0x8d6e63,
  red: 0xe74c3c,
};
```

Sin ningún otro cambio de renderer — ningún nivel del prototipo de Fase 2 usa `'red'` todavía.

## Fixtures de test (`tests/unit/engine/red.test.ts`)

Todas verificadas a mano paso a paso (mismo rigor que marrón, feature 008):

**1. División simple, impacto N/S → ramas E/O, ambas despejadas** (US1 AC1):
- `pieces: [{at:{row:4,col:3},color:'green'}]`, `hand:['red']`.
- Lanzamiento `{direction:'S', lane:3}`: rojo golpea green@(4,3) llegando desde el norte
  (dirección de viaje `S`) → ramas `['E','O']`. Rama E: `(4,3)→(4,4)`, vacía → green se asienta.
  Rama O: `(4,3)→(4,2)`, vacía → green se asienta.
- Resultado esperado: `cells[4][2]`=green, `cells[4][3]`=null, `cells[4][4]`=green.

**2. División simple, impacto E/O → ramas N/S, ambas despejadas** (US1 AC2):
- `pieces: [{at:{row:2,col:4},color:'orange'}]`, `hand:['red']`.
- Lanzamiento `{direction:'E', lane:2}`: rojo golpea orange@(2,4) → ramas `['N','S']`. Rama N:
  `(2,4)→(1,4)`, vacía → orange se asienta. Rama S: `(2,4)→(3,4)`, vacía → orange se asienta.
- Resultado esperado: `cells[1][4]`=orange, `cells[2][4]`=null, `cells[3][4]`=orange.

**3. Una rama compone con un empuje normal más allá** (US2 AC1 — el ejemplo que expuso el bug
de research.md):
- `pieces: [{at:{row:4,col:3},color:'green'}, {at:{row:4,col:4},color:'orange'}]`,
  `hand:['red']`.
- Lanzamiento `{direction:'S', lane:3}`: rojo golpea green@(4,3) → ramas `['E','O']`. Rama E:
  `(4,3)→(4,4)`, OCUPADA por orange → la propia green (ahora la que golpea en ese punto) empuja
  a orange con SU distancia (verde=1) → `(4,4)+1=(4,5)`, vacía → orange se asienta ahí; green se
  asienta en `(4,4)` (vacada por orange). Rama O: `(4,3)→(4,2)`, vacía → green se asienta.
- Resultado esperado: `cells[4][2]`=green, `cells[4][3]`=null, `cells[4][4]`=green,
  `cells[4][5]`=orange.

**4. Una rama aniquila por mismo color, la otra rama no se ve afectada** (US2 AC2):
- `pieces: [{at:{row:6,col:3},color:'orange'}, {at:{row:5,col:3},color:'orange'}]`,
  `hand:['red']`.
- Lanzamiento `{direction:'E', lane:6}`: rojo golpea orange@(6,3) → ramas `['N','S']`. Rama N:
  `(6,3)→(5,3)`, OCUPADA por OTRA orange (mismo color que la rama) → ambas se aniquilan. Rama S:
  `(6,3)→(7,3)`, vacía → orange se asienta ahí, sin verse afectada por lo que le pasó a la rama
  N.
- Resultado esperado: `cells[5][3]`=null, `cells[6][3]`=null, `cells[7][3]`=orange, al menos un
  evento `ANNIHILATION`.

**5. Rojo golpea a otro rojo directamente — aniquila, la división nunca se produce** (edge case):
- `pieces: [{at:{row:0,col:1},color:'red'}]`, `hand:['red']`.
- Lanzamiento `{direction:'E', lane:0}`: rojo golpea red@(0,1) — mismo color que quien golpea →
  aniquilación inmediata, sin ningún evento `MOVE_STEP`.
- Resultado esperado: `cells[0][1]`=null, exactamente 1 evento, de tipo `ANNIHILATION`.

**6. Rojo lanzado desde la mano: missclick** (FR-007):
- Mismo patrón ya establecido para verde/naranja/marrón: lanzamiento sobre una fila/columna sin
  ninguna ficha, `hand:['red']`.
- Resultado esperado: `missclick:true`, tablero/mano sin cambios, `result:'undetermined'`.

**7. Determinismo** (SC-003, ver research.md para por qué no se testea el orden de forma
aislada):
- Reutiliza la fixture 1. Llamar a `resolveLaunch` dos veces sobre el mismo nivel y lanzamiento;
  confirmar que el segundo resultado es estructuralmente idéntico al primero, y que el nivel
  original no se mutó — mismo patrón que `determinism.test.ts` (feature 001).
