import type { Board, Coordinate, PieceColor } from '../../src/engine/board.js';
import { createBoard } from '../../src/engine/board.js';
import type { Direction } from '../../src/engine/move-step.js';
import { createLevel, resolveLaunch, type Level } from '../../src/engine/index.js';
import { resolveObligations, type Obligation } from './obligations.js';
import { createRng } from './rng.js';

export type SolutionStep = { direction: Direction; lane: number; pieceIndex: number };

export type GenerationParams = {
  launchCount: number; // FR-008
  availableColors: PieceColor[]; // subconjunto de green/orange/brown
  chainOriginProbability: number; // FR-005
  decoyCount: number; // FR-008
  seed: number; // FR-008/FR-009
  defenderContinuationProbability?: number; // por defecto 0.4 (research.md)
  maxChainDepth?: number; // por defecto 4 (research.md)
  maxGenerationAttempts?: number; // por defecto 200 (research.md)
};

export type GeneratedLevel = {
  pieces: { at: Coordinate; color: PieceColor }[];
  hand: PieceColor[];
  goal: { color: PieceColor; cell: Coordinate };
  solution: SolutionStep[]; // en orden de juego real (FR-010)
  params: GenerationParams;
};

export type GenerationResult =
  | { ok: true; level: GeneratedLevel }
  | { ok: false; attemptsUsed: number };

const DEFAULT_DEFENDER_CONTINUATION_PROBABILITY = 0.4;
const DEFAULT_MAX_CHAIN_DEPTH = 4;
const DEFAULT_MAX_GENERATION_ATTEMPTS = 200;

function boardPieces(board: Board): { at: Coordinate; color: PieceColor }[] {
  const pieces: { at: Coordinate; color: PieceColor }[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board.cells[row][col];
      if (piece !== null) pieces.push({ at: { row, col }, color: piece.color });
    }
  }
  return pieces;
}

/**
 * Reproduce la traza completa con el motor real (FR-006). Devuelve `true` solo si
 * cada lanzamiento golpea sin missclick y el resultado final es 'won' -- cualquier
 * discrepancia significa que la construcción no es fiel a lo que el motor haría de
 * verdad, y el intento entero se descarta (FR-007).
 */
function validatesForward(level: Level, solution: SolutionStep[]): boolean {
  let current = level;
  let lastResult: string = 'undetermined';
  for (const step of solution) {
    const outcome = resolveLaunch(current, { direction: step.direction, lane: step.lane }, step.pieceIndex);
    if (outcome.missclick) return false;
    current = { board: outcome.board, hand: outcome.hand, goal: current.goal };
    lastResult = outcome.result;
  }
  return lastResult === 'won';
}

function attemptOnce(params: GenerationParams, rng: () => number): GeneratedLevel | null {
  const defenderContinuationProbability =
    params.defenderContinuationProbability ?? DEFAULT_DEFENDER_CONTINUATION_PROBABILITY;
  const maxChainDepth = params.maxChainDepth ?? DEFAULT_MAX_CHAIN_DEPTH;

  const goalColor = params.availableColors[Math.floor(rng() * params.availableColors.length)];
  const goalCell: Coordinate = { row: Math.floor(rng() * 8), col: Math.floor(rng() * 8) };

  const root: Obligation = {
    cell: goalCell,
    color: goalColor,
    kind: 'defender',
    direction: null,
    chainDepth: 0,
    isRoot: true,
  };

  const outcome = resolveObligations(root, {
    board: createBoard(),
    rng,
    availableColors: params.availableColors,
    launchCount: params.launchCount,
    defenderContinuationProbability,
    chainOriginProbability: params.chainOriginProbability,
    maxChainDepth,
  });
  if (!outcome.ok) return null;

  // Los lanzamientos se descubren en orden inverso al de juego real (data-model.md).
  const playOrder = outcome.rawLaunches.slice().reverse();
  const hand: PieceColor[] = playOrder.map((launch) => launch.color);
  // pieceIndex es siempre 0: cada lanzamiento consume la PRIMERA ficha de la mano
  // restante en ese momento (takePieceAt la retira, desplazando el resto), y las
  // fichas de la solución siempre ocupan el frente de la mano -- las señuelo se
  // añaden al final, después de validar (más abajo), nunca intercaladas.
  const solution: SolutionStep[] = playOrder.map((launch) => ({
    direction: launch.direction,
    lane: launch.lane,
    pieceIndex: 0,
  }));

  const pieces = boardPieces(outcome.board);
  const level = createLevel({
    pieces: pieces.map(({ at, color }) => ({ at, color })),
    hand,
    goal: { at: goalCell, color: goalColor },
  });

  if (!validatesForward(level, solution)) return null;

  // Fichas señuelo, añadidas al final -- no recalculan ningún pieceIndex ya
  // asignado a la solución (research.md).
  const decoyHand = hand.slice();
  for (let i = 0; i < params.decoyCount; i++) {
    decoyHand.push(params.availableColors[Math.floor(rng() * params.availableColors.length)]);
  }

  return {
    pieces,
    hand: decoyHand,
    goal: { color: goalColor, cell: goalCell },
    solution,
    params,
  };
}

/**
 * Núcleo probable de forma determinista: recibe el `rng` inyectado en vez de crear
 * el suyo propio (research.md, "la fuente de aleatoriedad se inyecta"). `generateLevel`
 * es el envoltorio que conecta el PRNG real con semilla.
 */
export function generateLevelWithRng(params: GenerationParams, rng: () => number): GenerationResult {
  if (params.launchCount < 1) {
    throw new Error('launchCount debe ser al menos 1 -- 0 lanzamientos no es un nivel válido (spec.md, edge case)');
  }

  const maxAttempts = params.maxGenerationAttempts ?? DEFAULT_MAX_GENERATION_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const level = attemptOnce(params, rng);
    if (level !== null) return { ok: true, level };
  }
  return { ok: false, attemptsUsed: maxAttempts };
}

export function generateLevel(params: GenerationParams): GenerationResult {
  return generateLevelWithRng(params, createRng(params.seed));
}
