# Phase 1 Data Model: Lanzamiento y Cadena de Ficha Verde

Modelo derivado de la sección "Key Entities" del spec y de las decisiones de research.md. Todos
los tipos viven en `src/engine/` y son puros (sin métodos con efectos secundarios).

## Tipos base

```ts
type Coordinate = { row: number; col: number }; // 0..7 en un tablero 8x8

type Direction = 'N' | 'S' | 'E' | 'O';

type PieceColor = 'green'; // única variante en esta historia; el tipo se amplía en historias futuras

type Piece = { color: PieceColor };
```

**Invariantes**:
- `row` y `col` MUST estar en el rango `[0, 7]` para cualquier `Coordinate` que referencie una
  casilla del tablero (FR-002).
- `Direction` MUST ser uno de los cuatro valores cardinales (FR-001); no hay diagonales.

## Board

```ts
type Board = {
  size: 8;
  cells: (Piece | null)[][]; // cells[row][col]; null = casilla vacía
};
```

**Invariantes**:
- Cada casilla contiene como mucho una ficha (lo garantiza la propia estructura `Piece | null`,
  sin necesidad de validación adicional) — corresponde a la entidad "Tablero" del spec.
- El tablero se trata como snapshot inmutable en la API pública: `resolveLaunch` (ver
  contracts/engine-api.md) recibe un `Board` y devuelve uno nuevo, nunca muta el que recibió
  (esto es lo que permite reiniciar el nivel sin lógica adicional — FR-010).

## Hand

```ts
type Hand = { pieces: Piece[] };
```

Corresponde a la entidad "Mano" del spec. En esta historia contiene exactamente una `Piece` verde
al inicio del nivel (alcance de un único lanzamiento, ver Assumptions del spec).

## Launch (entrada de la acción)

```ts
type Launch = { direction: Direction; lane: number };
```

**Nota de diseño (detectada durante la implementación)**: `direction` por sí sola no basta para
determinar el recorrido — hace falta saber por qué fila o columna entra la ficha. `lane` es esa
fila/columna (0-7): si `direction` es `'E'` u `'O'` (horizontal), `lane` es la fila; si es `'N'` o
`'S'` (vertical), `lane` es la columna. La casilla de entrada dentro del tablero es la primera en
esa dirección desde el borde correspondiente (p. ej. `direction: 'E'` entra en `{row: lane, col:
0}`). Esto es un detalle de representación de datos, no cambia ningún FR/AC de spec.md.

La ficha lanzada no se referencia explícitamente aparte de "la primera ficha de la mano": con
mano de tamaño 1 en esta historia, el lanzamiento consume esa única ficha.

## Event (registro de la cadena)

```ts
type MoveStepEvent = {
  type: 'MOVE_STEP';
  piece: Piece;
  from: Coordinate;
  to: Coordinate;
  hasCollision: boolean; // true si `to` estaba ocupada y se desencadenó una nueva interacción
  // (renombrado desde `collisionResolved` el 2026-08-23, tras comentario de PR en feature 003 —
  // "resolved" sugería que la colisión ya estaba resuelta/cerrada, justo lo contrario de lo que
  // el campo indica cuando vale true)
};

type EventLog = MoveStepEvent[]; // orden de aplicación (ver research.md, Decisión 2)
```

Corresponde a la entidad "Cadena de eventos / Estado estable" del spec: `EventLog` es la
evidencia observable de que la cadena se resolvió, y su ausencia de eventos pendientes (bucle de
resolución terminado) es lo que define el estado estable (FR-005, FR-006).

## Objective

```ts
type Objective = { targetColor: PieceColor; targetCell: Coordinate };
```

Corresponde a la entidad "Objetivo" del spec: en esta historia, "una ficha verde debe ocupar
`targetCell`".

## Level (dato declarativo)

```ts
type Level = {
  board: Board;   // estado inicial
  hand: Hand;      // estado inicial
  objective: Objective;
};
```

Corresponde a "Nivel de prueba" del spec y satisface el Principio IV de la constitución (niveles
como datos declarativos). El fixture concreto de esta historia (`src/engine/level.ts`) es un
`Level` cuyo `board`/`hand` NO cumplen ya el `objective` en el estado inicial (ver Edge Cases del
spec: el resultado debe depender siempre del lanzamiento del jugador).

## LevelResult (estado derivado, no persistido)

```ts
type LevelResult = 'won' | 'lost' | 'undetermined';
```

**Transiciones de estado** (correspondientes a FR-007/FR-008/FR-012 y a los Acceptance Scenarios
3, 4 y 6):

- No existe un estado `'in_progress'` persistido: mientras la cola de eventos tiene eventos
  pendientes, el resultado simplemente no se calcula (FR-006) — no es un valor del tipo, es la
  ausencia de `LevelResult` hasta que el motor alcanza el estado estable.
- Al alcanzar el estado estable (tras cualquier lanzamiento, missclick incluido), evaluado en este
  orden:
  1. Si una `Piece` de `color === objective.targetColor` ocupa `objective.targetCell` → `'won'`.
  2. Si no, y la mano (`Hand`) ya no tiene ninguna `Piece` disponible → `'lost'`.
  3. Si no, → `'undetermined'` (el objetivo no se cumple todavía, pero la mano conserva al menos
     una ficha — típicamente justo después de un missclick, FR-012).
- `'undetermined'` no es un estado persistido ni requiere lógica de turnos: es simplemente lo que
  devuelve `resolveLaunch` cuando su único lanzamiento fue un missclick. Un futuro lanzamiento se
  modela invocando `resolveLaunch` otra vez con la mano actualizada, no como una transición
  interna del motor.
- No hay transición de `'won'`/`'lost'` de vuelta a otro valor: son terminales para esa partida
  del nivel; "reiniciar" (FR-010) no es una transición del `LevelResult`, es simplemente invocar
  `resolveLaunch` de nuevo sobre el `Level` original inmutable.

## LaunchOutcome (resultado observable de un lanzamiento)

```ts
type LaunchOutcome = {
  board: Board;          // estado final del tablero (o el original, si fue missclick)
  hand: Hand;              // estado final de la mano (recupera la ficha si fue missclick)
  events: EventLog;        // vacío si fue missclick
  missclick: boolean;
  result: LevelResult;
};
```

Es el tipo de retorno de `resolveLaunch` (ver contracts/engine-api.md) y agrupa todo lo que las
suites de test de esta historia necesitan verificar: FR-003 (missclick), FR-004/FR-005 (eventos),
FR-007/FR-008 (result), FR-011 (determinismo, comparando `LaunchOutcome` entre llamadas idénticas).
