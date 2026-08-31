# Phase 1 Data Model: Fragilidad como Factor de Dificultad del Generador

## Entidades

### `FragilityProfile` (nuevo, `tools/generator/`)

```ts
export type FragilityProfile = 'easy' | 'medium' | 'hard';
```

FR-004: el conjunto mínimo de perfiles con nombre. Vive en el generador, no en el motor -- es un concepto exclusivo de generación, sin sentido en `src/engine/`.

### `GenerationParams` (extendido, `tools/generator/generate.ts`)

```ts
// antes
export type GenerationParams = {
  launchCount: number;
  availableColors: PieceColor[];
  chainOriginProbability: number;
  decoyCount: number;
  seed: number;
  defenderContinuationProbability?: number;
  maxChainDepth?: number;
  maxGenerationAttempts?: number;
  boardDecoyProbability?: number;
};

// después
export type GenerationParams = {
  // ...todo lo anterior, sin cambios...
  difficultyProfile?: FragilityProfile; // FR-004 -- opcional; ausente = comportamiento actual (todo NEW)
};
```

Opcional para no romper ninguna llamada existente (FR-004: "si no se indica, el comportamiento DEBE ser el mismo que sin esta feature").

### `GeneratedLevel` (extendido, `tools/generator/generate.ts`)

```ts
// antes
export type GeneratedLevel = {
  pieces: { at: Coordinate; color: PieceColor }[];
  hand: PieceColor[];
  goal: { color: PieceColor; cell: Coordinate };
  solution: SolutionStep[];
  params: GenerationParams;
};

// después
export type GeneratedLevel = {
  pieces: { at: Coordinate; color: PieceColor; fragility: Fragility }[];
  hand: HandPieceInput[]; // reutiliza el tipo ya exportado por el motor (012-piece-fragility)
  goal: { color: PieceColor; cell: Coordinate };
  solution: SolutionStep[];
  params: GenerationParams;
};
```

`fragility` en `pieces` deja de ser opcional (`boardPieces()` siempre puede leerlo, porque `Board.cells` ya contiene `Piece` completos) -- refleja fielmente lo que el `Board` interno ya sabe, en vez de descartarlo como hace la implementación actual.

## Función nueva: asignación de fragilidad por grupo

### `assignGroupFragility` (nuevo, `tools/generator/fragility.ts`)

```ts
export function assignGroupFragility(
  profile: FragilityProfile | undefined,
  count: number,
  allowedStates: readonly Fragility[],
  rng: () => number,
): Fragility[]
```

Contrato:

- `profile === undefined`: devuelve `count` copias de `'new'`, **sin llamar a `rng()` ninguna vez** (disciplina de determinismo, research.md Decisión 3).
- `profile === 'easy'`: sortea un único índice de `allowedStates` (1 llamada a `rng()`) y devuelve `count` copias de ese estado. FR-006.
- `profile === 'hard'`: para cada una de las `count` posiciones, sortea un índice de `allowedStates` independientemente (`count` llamadas a `rng()`). FR-007.
- `profile === 'medium'`: sortea un estado base como en `'easy'` (1 llamada), y para cada posición sortea si se desvía (`MEDIUM_DEVIATION_PROBABILITY = 0.3`, 1 llamada) -- si se desvía, sortea un estado distinto del base dentro de `allowedStates` (1 llamada más, solo en ese caso). Máximo `1 + count * 2` llamadas, mínimo `1 + count`.

`count === 0` siempre devuelve `[]` sin consumir ningún `rng()`, para cualquier perfil (no hay nada que asignar).

Reutilizada tres veces, una por grupo, cada una con su propio `allowedStates`:

| Grupo | `allowedStates` | Requisito |
|---|---|---|
| Señuelos de tablero | `['new', 'cracked']` | FR-008 -- nunca BROKEN |
| Señuelos de mano | `['new', 'cracked', 'broken']` | FR-009 -- rango completo |
| Fichas lanzadas de la solución | `['new', 'cracked']` | FR-010 -- nunca BROKEN |

## Cambios de forma en funciones existentes

### `ResolutionContext` (extendido, `tools/generator/obligations.ts`)

```ts
// añadido
export type ResolutionContext = {
  // ...todo lo existente, sin cambios...
  difficultyProfile?: FragilityProfile;
};
```

### `resolveObligations` (comportamiento extendido, `tools/generator/obligations.ts`)

- La colocación de mobiliario de una obligación `defender` (`chooseFurniture === true`) sigue asignando siempre `fragility: 'new'`, sin condición -- no cambia (research.md, Decisión 1).
- La colocación de un señuelo de tablero (bloque `boardDecoyProbability`) deja de asignar `fragility: 'new'` incondicionalmente: llama a un pequeño helper local, `pickBoardDecoyFragility`, que:
  - con `ctx.difficultyProfile === undefined`, devuelve `'new'` sin gastar ningún `rng()` (idéntico a hoy).
  - con `'easy'`, sortea el estado compartido la PRIMERA vez que se invoca dentro de este intento de construcción y lo cachea en una variable local a `resolveObligations` (no en `ResolutionContext`, que se pasa por valor y no se muta entre llamadas) -- las invocaciones siguientes, dentro del mismo intento, reutilizan el valor cacheado sin gastar `rng()` de nuevo.
  - con `'hard'`/`'medium'`, sortea un estado nuevo en cada invocación, vía `assignGroupFragility(profile, 1, ['new','cracked'], rng)[0]`.

### `attemptOnce` (comportamiento extendido, `tools/generator/generate.ts`)

Tras `resolveObligations` devolver éxito y antes de construir `hand`:

```ts
const launchedFragility = assignGroupFragility(
  params.difficultyProfile,
  playOrder.length,
  ['new', 'cracked'],
  rng,
);
const hand: HandPieceInput[] = playOrder.map((launch, i) => ({
  color: launch.color,
  fragility: launchedFragility[i],
}));
```

Y en el bloque de señuelos de mano, tras el `for` que decide sus colores:

```ts
const decoyFragility = assignGroupFragility(
  params.difficultyProfile,
  params.decoyCount,
  ['new', 'cracked', 'broken'],
  rng,
);
const decoyHand: HandPieceInput[] = hand.concat(
  decoyColors.map((color, i) => ({ color, fragility: decoyFragility[i] })),
);
```

`pieces` pasa a construirse copiando `fragility` desde `boardPieces(outcome.board)` en vez de descartarlo (`boardPieces` ya recorre `Board.cells`, que ya trae `Piece` completos -- solo hace falta dejar de proyectar únicamente `color`).

### `validatesForward` (sin cambios de firma ni de lógica)

Sigue construyendo el nivel de verificación vía `createLevel({ pieces, hand, goal })` -- como `pieces`/`hand` ahora sí transportan `fragility` real (en vez de dejar que `createLevel` asuma `'new'` por defecto en todo), la reproducción con el motor real queda por primera vez genuinamente probada contra los mismos valores que se entregan como nivel final. Esto es lo que convierte a SC-001 en una garantía real y no vacía.

### CLI (`tools/generator/cli.ts`, `tools/generator/batch.ts`)

Ambos ganan un flag `--difficulty-profile <easy|medium|hard>`, opcional, mapeado directamente a `GenerationParams.difficultyProfile` -- mismo patrón que los flags ya existentes (`--decoys`, `--board-decoy-probability`). Sin validación adicional más allá de lo que ya hace `parseArgs` (un valor fuera del conjunto se pasa tal cual y falla, si acaso, al tipar -- consistente con el resto de flags, ninguno valida su rango hoy).

## Compatibilidad

Cualquier llamada existente a `generateLevel`/`generateLevelWithRng` sin `difficultyProfile` sigue produciendo, en la práctica, exactamente los mismos niveles que hoy (mismos valores de `fragility: 'new'` en todo, cero llamadas nuevas a `rng()`) -- los 130 tests existentes de `tools/generator/` no deberían necesitar ningún cambio de fixture, solo de tipo si acceden a `pieces`/`hand` con aserciones de forma estricta que no incluyan `fragility` (ver `tasks.md`).
