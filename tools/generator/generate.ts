import type { Board, Coordinate, Fragility, PieceColor } from '../../src/engine/board.js';
import { createBoard } from '../../src/engine/board.js';
import type { Direction } from '../../src/engine/move-step.js';
import { evaluateGoal } from '../../src/engine/goal.js';
import { createLevel, resolveLaunch, type HandPieceInput, type Level } from '../../src/engine/index.js';
import { resolveObligations, type Obligation, type RawLaunch } from './obligations.js';
import { buildBlackDecoyCandidates } from './black-decoys.js';
import { assignGroupFragility, type FragilityProfile } from './fragility.js';
import { loadComplexityConfig, resolveComplexity, type ComplexityFactorName } from './complexity.js';
import { createRng } from './rng.js';

export type SolutionStep = { direction: Direction; lane: number; pieceIndex: number };

export type GenerationParams = {
  // 014-generation-complexity, FR-006: opcionales -- pueden venir directos, o
  // derivarse de complexityScore (ver generateLevelWithRng). Si ninguno de los
  // dos los cubre, generateLevelWithRng lanza un error explícito.
  launchCount?: number; // FR-008 (011)
  availableColors?: PieceColor[]; // subconjunto de green/orange/brown
  chainOriginProbability?: number; // FR-005 (011)
  decoyCount?: number; // FR-008 (011) -- cantidad FIJA de señuelo en mano
  seed: number; // FR-008/FR-009 (011) -- nunca gobernado por complexityScore
  defenderContinuationProbability?: number; // por defecto 0.4 (research.md), o de complexityScore
  maxChainDepth?: number; // por defecto 4 (research.md) -- NUNCA un factor de complejidad (FR-015)
  maxGenerationAttempts?: number; // por defecto 200 (research.md)
  // Probabilidad de señuelo en el TABLERO, sorteada de nuevo en cada paso de
  // construcción -- la cantidad resultante es aleatoria (0 a N), a diferencia
  // de decoyCount. Por defecto 0 (ninguna), o de complexityScore.
  boardDecoyProbability?: number;
  // 013-generator-fragility-difficulty, FR-004: perfil opcional de heterogeneidad
  // de fragilidad para señuelos y fichas lanzadas. Ausente = comportamiento actual
  // (todo 'new', cero llamadas nuevas a rng()).
  fragilityProfile?: FragilityProfile;
  // 014-generation-complexity, FR-003: presupuesto único que se reparte entre los
  // 7 factores de complejidad conocidos (research.md Decisión 4). Cualquier factor
  // ya dado explícitamente arriba queda excluido del reparto y del rango válido.
  complexityScore?: number;
  // 026-generator-black-decoys, research.md Decisión 7: activa el retrofit de
  // negro. Sorteado UNA VEZ por intento (no por paso, a diferencia de
  // boardDecoyProbability), justo tras resolver la solución real. Ausente o 0
  // -- comportamiento actual, cero llamadas nuevas a rng(). No participa en el
  // reparto de complexityScore en esta versión.
  blackLineClearProbability?: number;
};

const COMPLEXITY_FACTOR_NAMES: readonly ComplexityFactorName[] = [
  'launchCount',
  'chainOriginProbability',
  'defenderContinuationProbability',
  'decoyCount',
  'boardDecoyProbability',
  'availableColors',
  'fragilityProfile',
];

// El resultado de resolveGenerationParams -- attemptOnce/resolveObligations
// exigen estos cuatro campos concretos, ya vengan directos o de complexityScore.
type ResolvedGenerationParams = GenerationParams & {
  launchCount: number;
  availableColors: PieceColor[];
  chainOriginProbability: number;
  decoyCount: number;
};

export type GeneratedLevel = {
  pieces: { at: Coordinate; color: PieceColor; fragility: Fragility }[];
  hand: HandPieceInput[];
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

// 013-generator-fragility-difficulty: 'new' es el valor por defecto de
// HandPieceInput, así que se representa con la variante corta (solo color)
// para no cambiar el valor exacto de las 130 fixtures existentes que asumían
// hand: PieceColor[] -- solo una ficha con fragilidad real (CRACKED/BROKEN)
// necesita la forma extendida.
function toHandPieceInput(color: PieceColor, fragility: Fragility): HandPieceInput {
  return fragility === 'new' ? color : { color, fragility };
}

function boardPieces(board: Board): { at: Coordinate; color: PieceColor; fragility: Fragility }[] {
  const pieces: { at: Coordinate; color: PieceColor; fragility: Fragility }[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board.cells[row][col];
      if (piece !== null) pieces.push({ at: { row, col }, color: piece.color, fragility: piece.fragility });
    }
  }
  return pieces;
}

/**
 * Reproduce la traza completa con el motor real (FR-006). Devuelve `true` solo si:
 * (a) el objetivo NO está ya satisfecho antes del primer lanzamiento -- si lo
 *     estuviera, el juego real evaluaría 'won' tras CUALQUIER lanzamiento que no
 *     toque esa casilla, sin relación alguna con la solución construida (bug
 *     encontrado jugando un nivel generado -- ver research.md);
 * (b) cada lanzamiento golpea sin missclick;
 * (c) el objetivo NO se satisface (ni se pierde) antes del ÚLTIMO paso -- el juego
 *     real deja de aceptar lanzamientos en cuanto `status` deja de ser
 *     'undetermined' (BoardScene.launch), así que una victoria/derrota prematura
 *     significaría que la partida real nunca llegaría a jugar el resto de la
 *     solución construida;
 * (d) el resultado del último paso es exactamente 'won'.
 * Cualquier discrepancia significa que la construcción no es fiel a lo que el
 * motor haría de verdad, y el intento entero se descarta (FR-007).
 */
export function validatesForward(level: Level, solution: SolutionStep[]): boolean {
  if (evaluateGoal(level.board, level.hand, level.goal) !== 'undetermined') {
    return false; // el objetivo ya estaría satisfecho (o perdido) sin jugar nada
  }

  let current = level;
  try {
    for (let i = 0; i < solution.length; i++) {
      const step = solution[i];
      const outcome = resolveLaunch(current, { direction: step.direction, lane: step.lane }, step.pieceIndex);
      if (outcome.missclick) return false;
      current = { board: outcome.board, hand: outcome.hand, goal: current.goal };

      const isLastStep = i === solution.length - 1;
      if (isLastStep) {
        return outcome.result === 'won';
      }
      if (outcome.result !== 'undetermined') {
        return false; // victoria/derrota antes de agotar la secuencia de referencia
      }
    }
  } catch {
    // Red de seguridad defensiva: un fallo real del motor (encontrado y ya
    // corregido esta misma sesión en applyImpact -- entonces resolveStrike,
    // renombrada en 016-immediate-chain-placement -- src/engine/pieces/push.ts
    // -- una cascada con marrón podía dar la vuelta completa a un carril vacío
    // y repetir la misma colisión para siempre) se trata como cualquier otra
    // discrepancia de reproducción (FR-007): el intento entero se descarta.
    // Se mantiene aunque el bug conocido ya esté arreglado, para no volver a
    // tumbar todo el lote si el motor lanzara una excepción por cualquier otra
    // razón en el futuro.
    return false;
  }
  return false; // solution vacía -- no debería ocurrir con launchCount >= 1
}

/**
 * Construye la mano/solución/nivel de una secuencia concreta de `rawLaunches`
 * y la valida con el motor real -- `null` si `validatesForward` la rechaza.
 * Extraída de `attemptOnce` (026-generator-black-decoys, research.md Decisión
 * 4 revisada) para poder llamarla dos veces: una para la solución real "de
 * toda la vida", y otra -- solo si la primera ya tuvo éxito -- para la
 * versión con el lanzamiento de negro insertado, sin duplicar ninguna lógica.
 */
function buildLevelFrom(
  board: Board,
  rawLaunches: RawLaunch[],
  goalCell: Coordinate,
  goalColor: PieceColor,
  params: ResolvedGenerationParams,
  rng: () => number,
): { pieces: { at: Coordinate; color: PieceColor; fragility: Fragility }[]; hand: HandPieceInput[]; solution: SolutionStep[] } | null {
  // Los lanzamientos se descubren en orden inverso al de juego real (data-model.md).
  const playOrder = rawLaunches.slice().reverse();
  // FR-005/FR-010: la construcción nunca vuelve a golpear una ficha lanzada, así
  // que NEW/CRACKED son siempre seguras para ella -- nunca BROKEN (señal exclusiva
  // de señuelo de mano, FR-009/FR-010) -- EXCEPTO un lanzamiento con
  // `forcedFragility` (017-striker-visibility-gap: un golpeador marrón usado para un
  // asentamiento limpio en contexto 'settle' DEBE desaparecer al golpear, o el carril
  // deja de estar realmente despejado -- ver obligations.ts, mustBeBroken). Un
  // lanzamiento forzado queda EXCLUIDO del grupo de uniformidad de fragilityProfile
  // (FR-006 de 013: 'easy' garantiza que TODAS las fichas lanzadas comparten un
  // único estado -- una ficha forzosamente BROKEN es una excepción estructural
  // ajena al perfil de dificultad, no un miembro de ese grupo). Para cualquier
  // intento sin ningún lanzamiento forzado, esto es idéntico a antes -- mismo
  // tamaño de grupo, mismo conteo de rng().
  const nonForcedIndices = playOrder.reduce<number[]>((acc, launch, i) => {
    if (launch.forcedFragility === undefined) acc.push(i);
    return acc;
  }, []);
  const nonForcedFragility = assignGroupFragility(
    params.fragilityProfile,
    nonForcedIndices.length,
    ['new', 'cracked'],
    rng,
  );
  const launchedFragility = new Map<number, Fragility>();
  nonForcedIndices.forEach((originalIndex, groupIndex) => {
    launchedFragility.set(originalIndex, nonForcedFragility[groupIndex]);
  });
  const hand: HandPieceInput[] = playOrder.map((launch, i) =>
    toHandPieceInput(launch.color, launch.forcedFragility ?? launchedFragility.get(i)!),
  );
  // pieceIndex es siempre 0: cada lanzamiento consume la PRIMERA ficha de la mano
  // restante en ese momento (takePieceAt la retira, desplazando el resto), y las
  // fichas de la solución siempre ocupan el frente de la mano -- las señuelo se
  // añaden al final, después de validar (más abajo), nunca intercaladas.
  const solution: SolutionStep[] = playOrder.map((launch) => ({
    direction: launch.direction,
    lane: launch.lane,
    pieceIndex: 0,
  }));

  const pieces = boardPieces(board);
  const level = createLevel({
    pieces,
    hand,
    goal: { at: goalCell, color: goalColor },
  });

  if (!validatesForward(level, solution)) return null;

  return { pieces, hand, solution };
}

function attemptOnce(params: ResolvedGenerationParams, rng: () => number): GeneratedLevel | null {
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
    boardDecoyProbability: params.boardDecoyProbability,
  });
  if (!outcome.ok) return null;

  let built = buildLevelFrom(outcome.board, outcome.rawLaunches, goalCell, goalColor, params, rng);
  if (built === null) return null;

  // 026-generator-black-decoys, research.md Decisión 1/4 revisada: retrofit
  // oportunista, intentado SOLO después de que la solución real ya sea
  // válida por sí sola. Cada candidato (Estrategia A, luego B) se construye
  // y valida de punta a punta con el MISMO `buildLevelFrom` -- si ninguno
  // valida, `built` sigue siendo la solución original, ya sabida correcta
  // (spec.md FR-003/User Story 3: la ausencia de negro nunca hace fallar un
  // intento que de otro modo habría tenido éxito).
  if (
    params.blackLineClearProbability !== undefined &&
    params.blackLineClearProbability > 0 &&
    rng() < params.blackLineClearProbability
  ) {
    const candidates = buildBlackDecoyCandidates(
      outcome.board,
      outcome.rawLaunches,
      outcome.landingCells,
      params.availableColors,
      params.fragilityProfile,
      rng,
    );
    for (const candidate of candidates) {
      const attempt = buildLevelFrom(candidate.board, candidate.rawLaunches, goalCell, goalColor, params, rng);
      if (attempt !== null) {
        built = attempt;
        break;
      }
    }
  }

  // Fichas señuelo, añadidas al final -- no recalculan ningún pieceIndex ya
  // asignado a la solución (research.md).
  const decoyColors: PieceColor[] = [];
  for (let i = 0; i < params.decoyCount; i++) {
    decoyColors.push(params.availableColors[Math.floor(rng() * params.availableColors.length)]);
  }
  // FR-009: los señuelos de mano SÍ pueden llegar a BROKEN -- rango completo.
  const decoyFragility = assignGroupFragility(params.fragilityProfile, params.decoyCount, ['new', 'cracked', 'broken'], rng);
  const decoyHand: HandPieceInput[] = built.hand.concat(
    decoyColors.map((color, i) => toHandPieceInput(color, decoyFragility[i])),
  );

  return {
    pieces: built.pieces,
    hand: decoyHand,
    goal: { color: goalColor, cell: goalCell },
    solution: built.solution,
    params,
  };
}

const REQUIRED_FIELDS_ERROR =
  'GenerationParams debe especificar launchCount, availableColors, chainOriginProbability y decoyCount directamente, o proporcionar complexityScore (014-generation-complexity)';

/**
 * Resuelve `complexityScore` (si está presente) en un `GenerationParams` totalmente
 * concreto, ANTES de empezar ningún intento de construcción (research.md, Decisión 5):
 * un factor con valor explícito nunca participa en el reparto ni cuenta en el rango
 * válido de `complexityScore` para esta llamada (Decisión 4) -- el valor explícito
 * siempre gana (FR-013). Sin `complexityScore`, esta función no llama a `rng()` ni una
 * sola vez (FR-012, misma disciplina que el resto del generador).
 */
function resolveGenerationParams(params: GenerationParams, rng: () => number): ResolvedGenerationParams {
  const merged: GenerationParams = { ...params };

  if (params.complexityScore !== undefined) {
    const config = loadComplexityConfig();
    const excluded = new Set<ComplexityFactorName>(
      COMPLEXITY_FACTOR_NAMES.filter((name) => params[name] !== undefined),
    );
    const derived = resolveComplexity(params.complexityScore, config, excluded, rng);

    if (derived.launchCount !== undefined) merged.launchCount = derived.launchCount as number;
    if (derived.chainOriginProbability !== undefined) {
      merged.chainOriginProbability = derived.chainOriginProbability as number;
    }
    if (derived.defenderContinuationProbability !== undefined) {
      merged.defenderContinuationProbability = derived.defenderContinuationProbability as number;
    }
    if (derived.decoyCount !== undefined) merged.decoyCount = derived.decoyCount as number;
    if (derived.boardDecoyProbability !== undefined) {
      merged.boardDecoyProbability = derived.boardDecoyProbability as number;
    }
    if (derived.availableColors !== undefined) merged.availableColors = derived.availableColors as PieceColor[];
    if (derived.fragilityProfile !== undefined) merged.fragilityProfile = derived.fragilityProfile as FragilityProfile;
  }

  if (
    merged.launchCount === undefined ||
    merged.availableColors === undefined ||
    merged.chainOriginProbability === undefined ||
    merged.decoyCount === undefined
  ) {
    throw new Error(REQUIRED_FIELDS_ERROR);
  }

  return merged as ResolvedGenerationParams;
}

/**
 * Núcleo probable de forma determinista: recibe el `rng` inyectado en vez de crear
 * el suyo propio (research.md, "la fuente de aleatoriedad se inyecta"). `generateLevel`
 * es el envoltorio que conecta el PRNG real con semilla.
 */
export function generateLevelWithRng(params: GenerationParams, rng: () => number): GenerationResult {
  const resolved = resolveGenerationParams(params, rng);

  if (resolved.launchCount < 1) {
    throw new Error('launchCount debe ser al menos 1 -- 0 lanzamientos no es un nivel válido (spec.md, edge case)');
  }

  const maxAttempts = resolved.maxGenerationAttempts ?? DEFAULT_MAX_GENERATION_ATTEMPTS;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const level = attemptOnce(resolved, rng);
    if (level !== null) return { ok: true, level };
  }
  return { ok: false, attemptsUsed: maxAttempts };
}

export function generateLevel(params: GenerationParams): GenerationResult {
  return generateLevelWithRng(params, createRng(params.seed));
}
