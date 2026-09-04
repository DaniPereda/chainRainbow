# Phase 1 Data Model: Generador -- Negro como Eliminador de Bloqueantes

## Entidades

### `RawLaunch` (extendido)

```ts
// tools/generator/obligations.ts
export type RawLaunch = {
  direction: Direction;
  lane: number;
  color: PieceColor;
  forcedFragility?: 'broken';
  // NUEVO: la celda exacta contra la que este lanzamiento impacta -- ya
  // conocida en el momento en que se descubre. Necesario para que la
  // Estrategia A sepa dónde termina el carril a proteger, y para que la
  // Estrategia B sepa en qué dirección viaja el empuje que llena una celda
  // de aterrizaje (research.md Decisión 2: el striker empuja siempre en su
  // propia dirección de viaje, así que `direction` YA es esa respuesta).
  target: Coordinate;
};
```

### `ResolutionOutcome` (extendido)

```ts
// tools/generator/obligations.ts
export type LandingCell = {
  cell: Coordinate;
  // Índice en rawLaunches del lanzamiento de mano cuyo impacto termina
  // empujando una ficha hasta `cell` -- solo se registra cuando ese striker
  // resuelve como lanzamiento directo (research.md Decisión 6, alcance v1).
  launchIndex: number;
};

export type ResolutionOutcome = {
  board: Board;
  rawLaunches: RawLaunch[];
  landingCells: LandingCell[]; // candidatas para la Estrategia B
  ok: boolean;
};
```

Sin `decoyCells` -- la seguridad de un candidato se decide reproduciéndolo con
el motor real (`validatesForward`), no descontando señuelos de un registro
estático (research.md Decisión 4).

### `Obligation` (campo interno nuevo, no público)

```ts
// tools/generator/obligations.ts
export type Obligation = {
  // ...campos ya existentes...
  // Presente solo en una obligación 'striker-origin' cuyo eventual
  // lanzamiento de mano es responsable de empujar una ficha hasta ESTA
  // celda (la del 'defender' padre que la originó) -- permite, cuando esa
  // obligación resuelve por chooseHand, registrar el LandingCell
  // correspondiente.
  explainsLandingAt?: Coordinate;
};
```

### `GenerationParams` (nuevo parámetro)

```ts
// tools/generator/generate.ts
export type GenerationParams = {
  // ...campos ya existentes...
  // Activa el retrofit de negro (research.md Decisión 7). Sorteado UNA VEZ
  // por intento, justo después de que la solución real ya haya validado.
  // Ausente o 0 -- comportamiento actual, cero llamadas nuevas a rng().
  blackLineClearProbability?: number;
};
```

No participa en `COMPLEXITY_FACTOR_NAMES` en esta versión.

### `tools/generator/black-decoys.ts` (nuevo)

```ts
export type BlackDecoyCandidate = { board: Board; rawLaunches: RawLaunch[] };

export function buildBlackDecoyCandidates(
  board: Board,
  rawLaunches: RawLaunch[],
  landingCells: LandingCell[],
  availableColors: PieceColor[],
  fragilityProfile: FragilityProfile | undefined,
  rng: () => number,
): BlackDecoyCandidate[]; // 0, 1 o 2 candidatos: [Estrategia A?, Estrategia B?]
```

**No valida nada por sí misma** (research.md Decisión 4) -- solo construye
candidatos. El llamador (`generate.ts`) decide si son seguros ejecutando
`validatesForward` sobre el nivel completo que cada uno produciría.

Internamente (research.md Decisión 1/3):

1. **Estrategia A**: para cada `RawLaunch`, calcula las celdas libres entre su
   entrada y su `target` (el mismo carril que ya recorre); si hay alguna, esa
   es candidata. Elige una celda al azar -- el bloqueante OBLIGATORIO. Calcula
   el eje PERPENDICULAR a la dirección de ese lanzamiento, elige un lado al
   azar, y esa es la línea que negro recorrerá. Añade entre 0 y 6 bloqueantes
   DECORATIVOS adicionales en celdas vacías de ESA MISMA línea perpendicular
   (nunca en el carril protegido). Inserta el `RawLaunch` de negro
   (perpendicular) inmediatamente después del lanzamiento protegido.
2. **Estrategia B**: para cada `LandingCell`, el bloqueante obligatorio va
   DIRECTAMENTE sobre esa celda. El eje perpendicular se calcula a partir de
   `rawLaunches[landingCell.launchIndex].direction` (research.md Decisión 2).
   Mismo patrón de bloqueantes decorativos e inserción, en
   `landingCell.launchIndex + 1`.

Ambas comparten `buildPerpendicularCandidate(board, rawLaunches, protectedIndex, blockerCell, riskyDirection, availableColors, fragilityProfile, rng)` -- la única diferencia entre A y B es CÓMO se elige `blockerCell`/`protectedIndex`/`riskyDirection`, nunca cómo se construye el candidato en sí.

### `attemptOnce` (`generate.ts`, cambio de integración)

```ts
const outcome = resolveObligations(root, ctx);
if (!outcome.ok) return null;

let built = buildLevelFrom(outcome.board, outcome.rawLaunches, goalCell, goalColor, params, rng);
if (built === null) return null; // idéntico al comportamiento de siempre

if (params.blackLineClearProbability && rng() < params.blackLineClearProbability) {
  const candidates = buildBlackDecoyCandidates(
    outcome.board, outcome.rawLaunches, outcome.landingCells,
    params.availableColors, params.fragilityProfile, rng,
  );
  for (const candidate of candidates) {
    const attempt = buildLevelFrom(candidate.board, candidate.rawLaunches, goalCell, goalColor, params, rng);
    if (attempt !== null) { built = attempt; break; }
  }
}
// built.pieces/hand/solution -- con o sin negro -- alimentan el resto de attemptOnce sin cambios.
```

`buildLevelFrom` (nueva, extraída de `attemptOnce`) encapsula exactamente lo
que `attemptOnce` ya hacía para construir mano/solución/`Level` y llamar a
`validatesForward` -- se reutiliza sin duplicar esa lógica, una vez para la
solución real y, si aplica, una vez más por cada candidato con negro
(research.md Decisión 5).

## Relaciones

- Un `LandingCell.launchIndex` siempre apunta a una entrada de `rawLaunches`
  con `forcedFragility === undefined` -- una celda de aterrizaje forzada
  `mustBeBroken` (marrón, 017-striker-visibility-gap) nunca se registra como
  candidata.
- El `RawLaunch` de negro nunca lleva `target` con significado real para
  ninguna otra parte del sistema -- se añade por consistencia de tipo.
- Los bloqueantes (obligatorio y decorativos) son siempre fichas de TABLERO,
  nunca de mano.
