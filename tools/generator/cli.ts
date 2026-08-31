import type { PieceColor } from '../../src/engine/board.js';
import type { FragilityProfile } from './fragility.js';
import { generateLevel, type GenerationParams } from './generate.js';

function parseArgs(argv: string[]): GenerationParams {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key === undefined || value === undefined) {
      throw new Error(`Argumento inválido cerca de "${argv[i]}" -- se esperaba --flag valor`);
    }
    flags.set(key, value);
  }

  // 014-generation-complexity: si se pide --complexity-score, un flag ausente se
  // deja `undefined` (para que complexityScore lo resuelva) en vez de aplicar el
  // valor por defecto de siempre -- un flag SÍ dado sigue ganando (FR-013). Sin
  // --complexity-score, el comportamiento es exactamente el de antes de esta feature.
  const complexityScoreRaw = flags.get('complexity-score');
  const complexityScore = complexityScoreRaw === undefined ? undefined : Number(complexityScoreRaw);

  const launchesRaw = flags.get('launches');
  const launchCount =
    launchesRaw !== undefined ? Number(launchesRaw) : complexityScore !== undefined ? undefined : 1;
  const colorsRaw = flags.get('colors');
  const availableColors =
    colorsRaw !== undefined
      ? (colorsRaw.split(',').map((c) => c.trim()) as PieceColor[])
      : complexityScore !== undefined
        ? undefined
        : (['green', 'orange', 'brown'] as PieceColor[]);
  const seed = Number(flags.get('seed') ?? String(Date.now()));
  const chainOriginProbabilityRaw = flags.get('chain-origin-probability');
  const chainOriginProbability =
    chainOriginProbabilityRaw !== undefined
      ? Number(chainOriginProbabilityRaw)
      : complexityScore !== undefined
        ? undefined
        : 0.5;
  const decoysRaw = flags.get('decoys');
  const decoyCount = decoysRaw !== undefined ? Number(decoysRaw) : complexityScore !== undefined ? undefined : 0;
  const boardDecoyProbabilityRaw = flags.get('board-decoy-probability');
  const boardDecoyProbability =
    boardDecoyProbabilityRaw !== undefined
      ? Number(boardDecoyProbabilityRaw)
      : complexityScore !== undefined
        ? undefined
        : 0;
  const maxGenerationAttemptsRaw = flags.get('max-attempts');
  const maxGenerationAttempts =
    maxGenerationAttemptsRaw === undefined ? undefined : Number(maxGenerationAttemptsRaw);
  const fragilityProfile = flags.get('fragility-profile') as FragilityProfile | undefined;

  return {
    launchCount,
    availableColors,
    seed,
    chainOriginProbability,
    decoyCount,
    boardDecoyProbability,
    maxGenerationAttempts,
    fragilityProfile,
    complexityScore,
  };
}

const result = generateLevel(parseArgs(process.argv.slice(2)));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.exitCode = 1;
}
