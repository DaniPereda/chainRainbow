import { readFileSync } from 'node:fs';

export type ComplexityFactorName =
  | 'launchCount'
  | 'chainOriginProbability'
  | 'defenderContinuationProbability'
  | 'decoyCount'
  | 'boardDecoyProbability'
  | 'availableColors'
  | 'fragilityProfile';

// Fixed order, independent of any particular object's key insertion order --
// keeps `complexityRange`/`resolveComplexityLevels` deterministic regardless
// of how a caller-constructed `ComplexityConfig` was written out.
const COMPLEXITY_FACTOR_NAMES: readonly ComplexityFactorName[] = [
  'launchCount',
  'chainOriginProbability',
  'defenderContinuationProbability',
  'decoyCount',
  'boardDecoyProbability',
  'availableColors',
  'fragilityProfile',
];

export type NumericComplexityLevel = { min: number; max: number };
export type DiscreteComplexityLevel = { value: unknown };

export type ComplexityFactorConfig =
  | { kind: 'integerRange'; levels: NumericComplexityLevel[] }
  | { kind: 'floatRange'; levels: NumericComplexityLevel[] }
  | { kind: 'discreteSet'; levels: DiscreteComplexityLevel[] };

export type ComplexityConfig = Record<ComplexityFactorName, ComplexityFactorConfig>;

/**
 * `[min, max]` valid range for `complexityScore`, counting only factors NOT in
 * `excludedFactors` (014-generation-complexity, research.md Decisión 4: a
 * factor pinned by an explicit param neither spends nor is counted in the
 * budget).
 */
export function complexityRange(
  config: ComplexityConfig,
  excludedFactors: ReadonlySet<ComplexityFactorName>,
): { min: number; max: number } {
  const included = COMPLEXITY_FACTOR_NAMES.filter((name) => !excludedFactors.has(name));
  return {
    min: included.length,
    max: included.reduce((sum, name) => sum + config[name].levels.length, 0),
  };
}

/**
 * Decides which level (1-based, FR-006) each included factor gets, given a
 * `complexityScore` budget: every included factor starts at level 1, and a
 * uniformly-random eligible factor (one that hasn't hit its own level cap) is
 * bumped by one, repeated until the assigned levels sum to `complexityScore`
 * exactly (research.md Decisión 4).
 */
export function resolveComplexityLevels(
  complexityScore: number,
  config: ComplexityConfig,
  excludedFactors: ReadonlySet<ComplexityFactorName>,
  rng: () => number,
): Partial<Record<ComplexityFactorName, number>> {
  const included = COMPLEXITY_FACTOR_NAMES.filter((name) => !excludedFactors.has(name));
  const { min, max } = complexityRange(config, excludedFactors);
  if (complexityScore < min || complexityScore > max) {
    throw new Error(
      `complexityScore ${complexityScore} fuera de rango [${min}, ${max}] para los factores no fijados explícitamente`,
    );
  }

  const levelIndex = new Map<ComplexityFactorName, number>(included.map((name) => [name, 0]));
  let sum = included.length;
  while (sum < complexityScore) {
    const eligible = included.filter((name) => levelIndex.get(name)! + 1 < config[name].levels.length);
    const pick = eligible[Math.floor(rng() * eligible.length)];
    levelIndex.set(pick, levelIndex.get(pick)! + 1);
    sum++;
  }

  const result: Partial<Record<ComplexityFactorName, number>> = {};
  for (const name of included) result[name] = levelIndex.get(name)! + 1;
  return result;
}

function sampleLevel(factorConfig: ComplexityFactorConfig, levelIndex: number, rng: () => number): unknown {
  switch (factorConfig.kind) {
    case 'integerRange': {
      const { min, max } = factorConfig.levels[levelIndex];
      return Math.floor(rng() * (max - min + 1)) + min;
    }
    case 'floatRange': {
      const { min, max } = factorConfig.levels[levelIndex];
      return min + rng() * (max - min);
    }
    case 'discreteSet':
      return factorConfig.levels[levelIndex].value;
  }
}

/**
 * Resolves `complexityScore` into a concrete value per included factor:
 * decides each factor's level (`resolveComplexityLevels`), then samples one
 * concrete value uniformly within that level's bracket (`sampleLevel`) --
 * `discreteSet` levels resolve directly to their configured value, consuming
 * no `rng()` call (data-model.md, "Función nueva: resolución de complejidad").
 */
export function resolveComplexity(
  complexityScore: number,
  config: ComplexityConfig,
  excludedFactors: ReadonlySet<ComplexityFactorName>,
  rng: () => number,
): Partial<Record<ComplexityFactorName, unknown>> {
  const levels = resolveComplexityLevels(complexityScore, config, excludedFactors, rng);
  const resolved: Partial<Record<ComplexityFactorName, unknown>> = {};
  for (const name of COMPLEXITY_FACTOR_NAMES) {
    const level = levels[name];
    if (level === undefined) continue;
    resolved[name] = sampleLevel(config[name], level - 1, rng);
  }
  return resolved;
}

/**
 * Reads and parses `complexity-config.json` (research.md Decisión 2) -- plain
 * `readFileSync` + `JSON.parse`, same pattern `batch.ts` already uses for
 * `levels/index.json`, no new runtime dependency.
 */
export function loadComplexityConfig(): ComplexityConfig {
  const raw = readFileSync(new URL('./complexity-config.json', import.meta.url), 'utf-8');
  return JSON.parse(raw) as ComplexityConfig;
}
