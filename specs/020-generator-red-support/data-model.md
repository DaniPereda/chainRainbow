# Phase 1 Data Model: Ficha Roja en el Generador de Niveles

Ningún tipo de dato nuevo a nivel de nivel generado (JSON) -- rojo ya es un `PieceColor` válido
(`src/engine/board.ts`) y ya aparece en niveles hand-authored (14/15). Los cambios son todos
internos a `tools/generator/`.

## `Obligation` (`tools/generator/obligations.ts`) -- dos campos nuevos, opcionales

```ts
export type Obligation = {
  cell: Coordinate;
  color: PieceColor;
  kind: ObligationKind;
  direction: Direction | null;
  chainDepth: number;
  isRoot?: boolean;
  mustBeBroken?: boolean; // 017, sin cambios

  // 020-generator-red-support:
  forceFurniture?: boolean;
  // Fuerza la resolución 'defender' a mobiliario, saltándose el sorteo de
  // defenderContinuationProbability (comprobado ANTES, con cortocircuito ||,
  // igual que mustBeBroken -- cero rng() nuevas para cualquier caso sin rojo).
  // Único uso: la ficha D pre-split, que FR-002 exige siempre 'new'.

  furnitureFragility?: Fragility;
  // Sobrescribe el 'new' por defecto cuando la obligación SÍ se resuelve como
  // mobiliario (con o sin forceFurniture). Único uso: la rama secundaria de un
  // split, fijada siempre a 'cracked' (research.md, Decisión 5) -- nunca
  // calculada, nunca gobernada por fragilityProfile.
};
```

Ambos campos son `undefined` para toda obligación que no participe en un split de rojo, así que
ningún fixture existente cambia de comportamiento (FR-007).

## `chooseStrikerAndOrigin` (sin cambios de firma)

Sigue devolviendo `{ striker: PieceColor; origin: Coordinate } | null`. La única diferencia es
que, cuando `'red'` está en `availableColors` y se resuelve una obligación `'defender'`
(contexto `'settle'`), `'red'` participa en el mismo `shuffle` + bucle que cualquier otro color,
y puede ser el `striker` devuelto. El cast interno `striker as 'green' | 'orange' | 'brown'` se
elimina (ya no hace falta, `InverseColor` ahora cubre los 4 colores).

El call-site del contexto `'occupied'` (dentro de la resolución de `'striker-origin'`) pasa
`ctx.availableColors.filter((c) => c !== 'red')` en vez de `ctx.availableColors` -- ver
research.md, Decisión 4.

## `InverseColor` / `inverseCandidates` (`tools/generator/inverses.ts`)

```ts
export type InverseColor = 'green' | 'orange' | 'brown' | 'red';
```

Nueva rama, colocada junto a la de `'green'` (misma fórmula exacta):

```ts
if (strikerColor === 'green' || strikerColor === 'red') {
  if (strikerColor === 'red' && context !== 'settle') return []; // Decisión 4
  return [stepBackward(to, direction, 1)];
}
```

(Redactado como una única rama que cubre ambos colores para dejar explícito, en el propio código,
que comparten fórmula -- con el `if` interno documentando la única diferencia real entre ambos:
la exclusión de rojo fuera del contexto `'settle'`.)

## Nueva tabla local en `obligations.ts`

```ts
const RED_STRIKE_DIRECTIONS_FOR_BRANCH: Record<Direction, [Direction, Direction]> = {
  E: ['N', 'S'],
  O: ['N', 'S'],
  N: ['E', 'O'],
  S: ['E', 'O'],
};
```

Ver research.md, Decisión 7, para la verificación de por qué esta tabla (definida localmente, sin
tocar el motor) es correcta y estable.

## Resolución de `'defender'` -- rama nueva tras `chooseStrikerAndOrigin`

Pseudocódigo del cambio en `resolveObligations` (bloque `kind === 'defender'`, tras obtener
`resolved` de `chooseStrikerAndOrigin` y comprobar que no es `null`):

```ts
if (resolved.striker === 'red') {
  const [a, b] = RED_STRIKE_DIRECTIONS_FOR_BRANCH[direction];
  const redStrikeDirection = ctx.rng() < 0.5 ? a : b;
  const secondaryDirection = opposite(direction);
  const landingCell = stepBy(resolved.origin, secondaryDirection, 1);

  queue.push({
    cell: resolved.origin,
    color: obligation.color,
    kind: 'defender',
    direction: null,
    chainDepth: 0,
    forceFurniture: true,
  });
  queue.push({
    cell: resolved.origin,
    color: 'red',
    kind: 'striker-origin',
    direction: redStrikeDirection,
    chainDepth: 0,
  });
  queue.push({
    cell: landingCell,
    color: obligation.color,
    kind: 'defender',
    direction: null,
    chainDepth: 0,
    furnitureFragility: 'cracked',
  });
  continue;
}

// ... rama existente (empuja las 2 obligaciones habituales) sin cambios.
```

`stepBy`/`opposite` ya se importan de `src/engine/move-step.js`; `opposite` aún no se importa en
`obligations.ts` hoy -- se añade a la lista de imports existente.

## `complexity-config.json` -- `availableColors` gana un nivel

```json
"availableColors": {
  "kind": "discreteSet",
  "levels": [
    { "value": ["green", "orange"] },
    { "value": ["green", "orange", "brown"] },
    { "value": ["green", "orange", "brown", "red"] }
  ]
}
```

Ningún otro factor cambia (FR-006/Assumptions de spec.md).

## `generate.ts` -- `goalColor` sin ningún cambio (corrección de la Decisión 8 original)

```ts
const goalColor = params.availableColors[Math.floor(rng() * params.availableColors.length)];
```

Idéntico al código anterior a esta feature -- SIN exclusión de `'red'`. La versión original de
este documento excluía rojo aquí; era un error (ver research.md, Decisión 8 corregida, señalado
por el usuario y verificado con el motor real): rojo, cuando es la ficha GOLPEADA por otro color
en vez de quien golpea, se desplaza igual que cualquier otro color y puede asentarse limpiamente
en la celda del objetivo -- el split solo ocurre cuando rojo es quien golpea
(`site.piece.color === 'red'` en `applyImpact`), no cuando es golpeado.
