import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PieceColor } from '../../src/engine/board.js';
import type { FragilityProfile } from './fragility.js';
import { generateLevel } from './generate.js';

const LEVELS_DIR = join(process.cwd(), 'levels');
const NEXT_ID_FILE = join(LEVELS_DIR, '.next-id.txt');
const INDEX_FILE = join(LEVELS_DIR, 'index.json');

function readNextId(): number {
  if (!existsSync(NEXT_ID_FILE)) return 1;
  return Number(readFileSync(NEXT_ID_FILE, 'utf-8').trim()) || 1;
}

function readIndex(): number[] {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));
}

function parseArgs(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key === undefined || value === undefined) {
      throw new Error(`Argumento inválido cerca de "${argv[i]}" -- se esperaba --flag valor`);
    }
    flags.set(key, value);
  }
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
const count = Number(flags.get('count') ?? '1');

// 014-generation-complexity: si se pide --complexity-score, un flag ausente se
// deja `undefined` (para que complexityScore lo resuelva) en vez de aplicar el
// valor por defecto de siempre -- un flag SÍ dado sigue ganando (FR-013). Sin
// --complexity-score, el comportamiento es exactamente el de antes de esta feature.
const complexityScoreRaw = flags.get('complexity-score');
const complexityScore = complexityScoreRaw === undefined ? undefined : Number(complexityScoreRaw);

const launchesRaw = flags.get('launches');
const launchCount = launchesRaw !== undefined ? Number(launchesRaw) : complexityScore !== undefined ? undefined : 1;
const colorsRaw = flags.get('colors');
const availableColors =
  colorsRaw !== undefined
    ? (colorsRaw.split(',').map((c) => c.trim()) as PieceColor[])
    : complexityScore !== undefined
      ? undefined
      : (['green', 'orange', 'brown'] as PieceColor[]);
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

if (!existsSync(LEVELS_DIR)) mkdirSync(LEVELS_DIR, { recursive: true });

let nextId = readNextId();
const index = readIndex();
const generated: number[] = [];
const failed: number[] = [];

for (let i = 0; i < count; i++) {
  const id = nextId;
  const result = generateLevel({
    launchCount,
    availableColors,
    chainOriginProbability,
    decoyCount,
    boardDecoyProbability,
    maxGenerationAttempts,
    fragilityProfile,
    complexityScore,
    seed: id,
  });

  if (result.ok) {
    writeFileSync(join(LEVELS_DIR, `${id}.json`), `${JSON.stringify(result.level, null, 2)}\n`);
    index.push(id);
    generated.push(id);
  } else {
    failed.push(id); // consumida igualmente -- el id nunca se reutiliza, evita colisiones
  }
  nextId++;
}

index.sort((a, b) => a - b);
writeFileSync(NEXT_ID_FILE, `${nextId}\n`);
writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`);

process.stdout.write(
  `Generados: [${generated.join(', ')}]${failed.length > 0 ? ` -- fallidos (agotados los intentos): [${failed.join(', ')}]` : ''}. Próximo id: ${nextId}.\n`,
);
