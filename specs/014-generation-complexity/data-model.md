# Phase 1 Data Model: Puntuación de Complejidad de Generación

## Renombrado (Historia 1)

| Antes | Después | Fichero(s) |
|---|---|---|
| `GenerationParams.difficultyProfile` | `GenerationParams.fragilityProfile` | `tools/generator/generate.ts` |
| `ResolutionContext.difficultyProfile` | `ResolutionContext.fragilityProfile` | `tools/generator/obligations.ts` |
| `ctx.difficultyProfile` (usos internos) | `ctx.fragilityProfile` | `tools/generator/obligations.ts` |
| `--difficulty-profile` (flag CLI) | `--fragility-profile` | `tools/generator/cli.ts`, `tools/generator/batch.ts` |

El tipo `FragilityProfile` (`tools/generator/fragility.ts`) y la función `assignGroupFragility` **no cambian** -- solo el nombre del campo que los activa. Todos los tests de 013 (`fragility.test.ts`, `generate.test.ts`, `obligations.test.ts`) se actualizan mecánicamente al nuevo nombre, sin cambiar ningún valor esperado (FR-002).

## Entidades nuevas

### `ComplexityFactorName` (nuevo, `tools/generator/complexity.ts`)

```ts
export type ComplexityFactorName =
  | 'launchCount'
  | 'chainOriginProbability'
  | 'defenderContinuationProbability'
  | 'decoyCount'
  | 'boardDecoyProbability'
  | 'availableColors'
  | 'fragilityProfile';
```

FR-004: exactamente los siete factores con influencia demostrada. `maxChainDepth` NUNCA aparece aquí (FR-015).

### `ComplexityLevel` (nuevo, `tools/generator/complexity.ts`)

```ts
export type NumericComplexityLevel = { min: number; max: number };
export type DiscreteComplexityLevel = { value: unknown };

export type ComplexityFactorConfig =
  | { kind: 'integerRange'; levels: NumericComplexityLevel[] }
  | { kind: 'floatRange'; levels: NumericComplexityLevel[] }
  | { kind: 'discreteSet'; levels: DiscreteComplexityLevel[] };

export type ComplexityConfig = Record<ComplexityFactorName, ComplexityFactorConfig>;
```

- `levels.length` de cada factor es su propio número de niveles (FR-004) -- no unificado a 3.
- Los niveles se numeran 1..N externamente (FR-006); internamente se indexan 0..N-1 (`levels[0]` es el nivel 1).
- `discreteSet.levels[i].value` para `availableColors` es un `PieceColor[]`; para `fragilityProfile` es un `FragilityProfile`. El tipo se estrecha (`as`) en el punto de uso dentro de `complexity.ts`, no se modela con genéricos -- son los dos únicos casos discretos y ambos ya están tipados en otro lugar (`board.ts`, `fragility.ts`).

### `complexity-config.json` (nuevo, `tools/generator/complexity-config.json`)

Ver research.md Decisión 3 para el contenido completo de ejemplo. Es el artefacto de datos que FR-010 exige mantener fuera de la lógica TypeScript.

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
  difficultyProfile?: FragilityProfile; // 013
};

// después
export type GenerationParams = {
  launchCount?: number; // FR-006 -- opcional, puede venir de complexityScore
  availableColors?: PieceColor[]; // FR-006
  chainOriginProbability?: number; // FR-006
  decoyCount?: number; // FR-006
  seed: number; // sin cambios -- nunca gobernado por complexityScore
  defenderContinuationProbability?: number; // ya opcional, ahora también gobernable por complexityScore
  maxChainDepth?: number; // sin cambios -- FR-015, nunca es un factor de complejidad
  maxGenerationAttempts?: number; // sin cambios
  boardDecoyProbability?: number; // ya opcional, ahora también gobernable por complexityScore
  fragilityProfile?: FragilityProfile; // renombrado (Historia 1)
  complexityScore?: number; // FR-003, nuevo
};
```

`launchCount`/`availableColors`/`chainOriginProbability`/`decoyCount` pasan de obligatorios a opcionales -- ver research.md Decisión 6 para por qué la validación de "faltan datos" se mueve a runtime en vez de al sistema de tipos.

## Función nueva: resolución de complejidad

### `resolveComplexity` (nuevo, `tools/generator/complexity.ts`)

```ts
export function resolveComplexity(
  complexityScore: number,
  config: ComplexityConfig,
  excludedFactors: ReadonlySet<ComplexityFactorName>,
  rng: () => number,
): Partial<Record<ComplexityFactorName, unknown>>
```

Contrato completo en research.md Decisión 4. Resumen:
- Solo reparte presupuesto entre factores que NO están en `excludedFactors` (los que ya tienen un valor explícito en la llamada, FR-013).
- Lanza si `complexityScore` está fuera de `[min, max]` de los factores incluidos (ver `complexityRange` abajo) -- mismo estilo que el `throw` ya existente para `launchCount < 1`.
- Determinista: mismo `complexityScore` + misma `config` + mismos `excludedFactors` + mismo `rng` (mismas llamadas previas) → mismo resultado exacto (FR-011).

### `complexityRange` (nuevo, `tools/generator/complexity.ts`)

```ts
export function complexityRange(
  config: ComplexityConfig,
  excludedFactors: ReadonlySet<ComplexityFactorName>,
): { min: number; max: number }
```

`min` = número de factores incluidos (todos en nivel 1); `max` = suma de `levels.length` de cada factor incluido (FR-007). Se recalcula por llamada porque `excludedFactors` puede variar (Decisión 4).

### `sampleLevel` (nuevo, privado, `tools/generator/complexity.ts`)

```ts
function sampleLevel(factorConfig: ComplexityFactorConfig, levelIndex: number, rng: () => number): unknown
```

- `integerRange`: `Math.floor(rng() * (max - min + 1)) + min` (1 llamada a `rng()`).
- `floatRange`: `min + rng() * (max - min)` (1 llamada a `rng()`).
- `discreteSet`: `levels[levelIndex].value` (0 llamadas a `rng()`).

### `loadComplexityConfig` (nuevo, `tools/generator/complexity.ts`)

```ts
export function loadComplexityConfig(): ComplexityConfig
```

Lee y parsea `complexity-config.json` (research.md Decisión 2) vía `readFileSync` + `JSON.parse`. Sin caché ni validación de esquema más allá de lo que ya haría un `JSON.parse` fallido -- mismo nivel de rigor que el resto de flags del generador (research.md de 013: "ninguno valida su rango hoy").

## Cambios de comportamiento en funciones existentes

### `generateLevelWithRng` (comportamiento extendido, `tools/generator/generate.ts`)

Al principio de la función, antes de la validación existente de `launchCount < 1`:

```ts
if (params.complexityScore !== undefined) {
  const config = loadComplexityConfig();
  const excluded = new Set<ComplexityFactorName>(
    (['launchCount', 'chainOriginProbability', 'defenderContinuationProbability',
      'decoyCount', 'boardDecoyProbability', 'availableColors', 'fragilityProfile'] as const)
      .filter((name) => params[name] !== undefined),
  );
  const resolved = resolveComplexity(params.complexityScore, config, excluded, rng);
  params = { ...params, ...resolved, ...pickDefined(params, excluded) }; // el explícito nunca se pisa
}
```

(El orden exacto del merge se resuelve en tasks.md/implementación -- el contrato es "explícito siempre gana", no una receta de código concreta.)

Tras esto (con o sin `complexityScore`), la validación existente se extiende: si `launchCount`, `availableColors`, `chainOriginProbability`, o `decoyCount` siguen `undefined` en este punto, lanza un error indicando qué falta -- mismo estilo que el `throw` ya existente.

El resto de `generateLevelWithRng`/`attemptOnce`/`resolveObligations` **no cambia** -- reciben un `GenerationParams` totalmente concreto, exactamente con la misma forma que consumían antes de esta feature.

### CLI (`tools/generator/cli.ts`, `tools/generator/batch.ts`)

- `--difficulty-profile` → `--fragility-profile` (rename, Historia 1).
- Nuevo flag opcional `--complexity-score <N>`, mapeado a `GenerationParams.complexityScore`. Los flags individuales (`--launches`, `--chain-origin-probability`, etc.) siguen aceptándose igual -- si se dan junto a `--complexity-score`, ganan (FR-013), mismo patrón que el resto de flags ya existentes (sin validación de esquema propia).

## Compatibilidad

Cualquier llamada existente a `generateLevel`/`generateLevelWithRng` que siga dando todos los parámetros individuales de siempre, sin `complexityScore`, produce exactamente el mismo nivel que antes de esta feature (FR-012) -- la rama nueva de resolución de complejidad ni se ejecuta (`params.complexityScore === undefined`) ni consume ningún `rng()` adicional. Los 130+18 tests ya existentes de `tools/generator/` no deberían necesitar ningún cambio de VALOR esperado -- solo el rename mecánico de `difficultyProfile` a `fragilityProfile` donde aparezca.
