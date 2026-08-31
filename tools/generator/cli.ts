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

  const launchCount = Number(flags.get('launches') ?? '1');
  const availableColors = (flags.get('colors') ?? 'green,orange,brown')
    .split(',')
    .map((c) => c.trim()) as PieceColor[];
  const seed = Number(flags.get('seed') ?? String(Date.now()));
  const chainOriginProbability = Number(flags.get('chain-origin-probability') ?? '0.5');
  const decoyCount = Number(flags.get('decoys') ?? '0');
  const boardDecoyProbability = Number(flags.get('board-decoy-probability') ?? '0');
  const maxGenerationAttemptsRaw = flags.get('max-attempts');
  const maxGenerationAttempts =
    maxGenerationAttemptsRaw === undefined ? undefined : Number(maxGenerationAttemptsRaw);
  const difficultyProfile = flags.get('difficulty-profile') as FragilityProfile | undefined;

  return {
    launchCount,
    availableColors,
    seed,
    chainOriginProbability,
    decoyCount,
    boardDecoyProbability,
    maxGenerationAttempts,
    difficultyProfile,
  };
}

const result = generateLevel(parseArgs(process.argv.slice(2)));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.exitCode = 1;
}
