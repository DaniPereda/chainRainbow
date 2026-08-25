# Phase 1 Data Model: Fragilidad de fichas

## Entidades

### `Fragility` (nuevo)

```ts
export type Fragility = 'new' | 'cracked' | 'broken';
```

Los tres estados de FR-001, en inglés por consistencia con el resto de identificadores del motor (colores, tipos). Progresión estrictamente lineal: `new → cracked → broken`, nunca hacia atrás, nunca salta un escalón (FR-002).

### `Piece` (extendido)

```ts
// antes
export type Piece = { color: PieceColor };

// después
export type Piece = { color: PieceColor; fragility: Fragility };
```

`fragility` deja de ser opcional a nivel de tipo: toda ficha, en cualquier punto del motor, tiene un estado de fragilidad conocido — no existe una "ficha sin fragilidad definida". El valor por defecto (`'new'`) se resuelve en el punto de construcción (`createLevel`, ver más abajo), no dejando el campo opcional en el tipo mismo.

### `PiecePlacement` (extendido) — fichas de TABLERO

```ts
// antes
export type PiecePlacement = { at: Coordinate; color: PieceColor };

// después
export type PiecePlacement = { at: Coordinate; color: PieceColor; fragility?: Fragility };
```

`fragility` es opcional aquí (a diferencia de en `Piece`) porque este tipo describe una *entrada declarativa* de nivel, donde omitirlo significa "por defecto" (FR-012), no "desconocido". Cuando `PiecePlacement` se usa para describir el `goal` de un nivel (reutilización ya existente del tipo), el campo `fragility` no tiene ningún efecto — un objetivo no es una ficha con desgaste, es un color+casilla objetivo; se ignora si se proporciona.

### `HandPieceInput` (nuevo) — fichas de MANO inicial

```ts
export type HandPieceInput = PieceColor | { color: PieceColor; fragility?: Fragility };
```

Unión que preserva compatibilidad total hacia atrás: una entrada de mano puede seguir siendo un `PieceColor` suelto (como hoy, todas las fichas de mano existentes en tests/niveles), o un objeto explícito con fragilidad inicial (FR-011) cuando el diseño del nivel lo requiera.

## Cambios de forma en funciones existentes

### `createLevel` (`src/engine/level.ts`)

```ts
// antes
function createLevel(config: {
  pieces: PiecePlacement[];
  hand: PieceColor[];
  goal: PiecePlacement;
}): Level

// después
function createLevel(config: {
  pieces: PiecePlacement[];   // fragility ahora opcional por entrada
  hand: HandPieceInput[];     // acepta PieceColor suelto O {color, fragility}
  goal: PiecePlacement;
}): Level
```

Comportamiento nuevo, ambos dentro de la construcción ya existente (sin pasos adicionales):

- **Board**: una entrada de `pieces` con `fragility: 'broken'` NO se coloca en el tablero resultante — se comporta como si esa casilla nunca se hubiera mencionado (FR-016). Cualquier otra entrada se coloca con `fragility ?? 'new'` (FR-012).
- **Hand**: cada entrada se normaliza a `Piece` completo: si es un `PieceColor` suelto, `{color, fragility: 'new'}`; si es un objeto, `{color, fragility: fragility ?? 'new'}`. A diferencia del tablero, **no hay normalización especial para `'broken'` en mano** — una ficha de mano `'broken'` es válida y significativa (FR-008): se conserva tal cual, lista para desaparecer en cuanto se lance.

**Compatibilidad**: todas las llamadas existentes a `createLevel` (los `testLevel*` de `level.ts`, los niveles usados en cada test file, `tools/generator/generate.ts`) siguen funcionando sin ningún cambio de código — `pieces` sin `fragility` y `hand` con `PieceColor[]` puro son casos ya cubiertos por los valores por defecto.

### `resolveStrike` / `resolveSplit` / `resolveBranch` / `applyImpact` (`src/engine/pieces/push.ts`)

```ts
// antes
function resolveStrike(board: Board, strikerColor: PieceColor, position: Coordinate, direction: Direction): {...}
function resolveSplit(board: Board, defenderColor: PieceColor, position: Coordinate, direction: Direction): {...}
function resolveBranch(board: Board, color: PieceColor, from: Coordinate, direction: Direction): {...}
function applyImpact(board: Board, site: ImpactSite): {...}

// después
function resolveStrike(board: Board, striker: Piece, position: Coordinate, direction: Direction): {...}
function resolveSplit(board: Board, defender: Piece, position: Coordinate, direction: Direction): {...}
function resolveBranch(board: Board, piece: Piece, from: Coordinate, direction: Direction): {...}
function applyImpact(board: Board, site: ImpactSite): {...}   // firma pública sin cambios -- site.piece ya era un Piece completo
```

`applyImpact` no cambia de firma (`ImpactSite.piece` ya era `Piece`) pero sí de comportamiento interno: gana el paso de asentamiento de la ficha lanzada que antes no existía (ver `research.md`).

## Reglas de transición y asentamiento (resumen ejecutable)

```
al golpear a una ficha de distinto color:
  defensora.fragility = avanzar(defensora.fragility)   # new→cracked, cracked→broken

al intentar asentar CUALQUIER ficha (golpeadora consigo misma, o defensora en su destino):
  si ficha.fragility === 'broken':  no se coloca (desaparece)
  si no:                            se coloca normalmente

mismo color (FR-010): aniquilación mutua instantánea, sin tocar fragility de ninguna de las dos
rojo (FR-015): la defensora avanza fragility UNA vez (como cualquier golpe) antes de dividirse;
                AMBAS ramas resultantes heredan ese mismo estado ya avanzado
```

## Trazas verificadas a mano (fixtures ilustrativas para los tests)

### Fixture 1 — cadena de 3 eslabones, ninguna se rompe

Estado inicial: `A` (mano, NEW) lanzada hacia `B` (tablero, NEW, celda1) → `B` cae sobre `C` (tablero, NEW, celda2) → celda3 vacía.

| Ficha | Rol | Avanza a | Se coloca en | Estado final |
|---|---|---|---|---|
| A (lanzada) | golpeadora de B | — (nunca es golpeada en este lanzamiento) | celda1 (vacía por B) | NEW |
| B | golpeada por A, luego golpeadora de C | CRACKED | celda2 (vacía por C) | CRACKED |
| C | golpeada por B | CRACKED | celda3 (vacía, encontrada) | CRACKED |

Tablero final: `A@celda1(NEW)`, `B@celda2(CRACKED)`, `C@celda3(CRACKED)`. Contraste directo con el motor sin esta feature: antes, `A` nunca se colocaba (desaparecía) y ni `B` ni `C` llevaban estado — el resto de la geometría (qué celda ocupa cada una) es idéntica.

### Fixture 2 — una ficha ya CRACKED se rompe y desaparece

Mismo layout que la Fixture 1, pero `B` empieza en CRACKED (declarada así en el nivel, o resultado de un lanzamiento anterior).

| Ficha | Rol | Avanza a | Se coloca en | Estado final |
|---|---|---|---|---|
| A (lanzada) | golpeadora de B | — | celda1 | NEW |
| B | golpeada por A | BROKEN | **no se coloca** | (eliminada) |
| C | nunca llega a ser golpeada — B nunca llega a golpearla | — | permanece en celda2 sin tocar | NEW (sin cambios) |

Nota importante: como B se elimina en cuanto le toca asentarse en celda2 (encontraría a C ahí, pero la comprobación de `'broken'` ocurre ANTES de intentar desplazar a C — B nunca llega a golpear a C). Tablero final: `A@celda1(NEW)`, `C@celda2(NEW, intacta)`, celda3 vacía.

### Fixture 3 — rojo sobre una ficha CRACKED elimina ambas ramas

Ficha `D` en CRACKED, golpeada por rojo lanzado en dirección S (ramas resultantes en E/O).

| Paso | Resultado |
|---|---|
| D es golpeada por rojo | fragility avanza CRACKED → BROKEN |
| Rama E hereda BROKEN | al intentar asentarse, no se coloca |
| Rama O hereda BROKEN | al intentar asentarse, no se coloca |

Tablero final: la celda original de D queda vacía, y ninguna de las dos ramas aparece en ningún sitio — consecuencia emergente de FR-015 ya documentada en `research.md`.
