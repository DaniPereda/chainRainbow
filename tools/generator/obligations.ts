import type { Board, Coordinate, Fragility, PieceColor } from '../../src/engine/board.js';
import { getPieceAt, setPieceAt } from '../../src/engine/board.js';
import { step, type Direction } from '../../src/engine/move-step.js';
import { inverseCandidates, type InverseContext } from './inverses.js';
import { assignGroupFragility, type FragilityProfile } from './fragility.js';

export type ObligationKind = 'defender' | 'striker-origin';

export type Obligation = {
  cell: Coordinate;
  color: PieceColor;
  kind: ObligationKind;
  direction: Direction | null; // heredada si kind==='striker-origin'; null si 'defender'
  chainDepth: number; // solo relevante para 'striker-origin' (research.md, tope de profundidad)
  isRoot?: boolean; // la obligación del objetivo -- SIEMPRE se resuelve con un empuje
};

export type RawLaunch = { direction: Direction; lane: number; color: PieceColor };

export type ResolutionContext = {
  board: Board;
  rng: () => number;
  availableColors: PieceColor[];
  launchCount: number;
  defenderContinuationProbability: number;
  chainOriginProbability: number; // FR-005: prob. de que el origen de un golpeador sea cadena
  maxChainDepth: number;
  // Probabilidad de colocar una ficha señuelo extra en el tablero, sorteada de
  // nuevo en CADA paso de construcción (a diferencia de las señuelo en mano,
  // cuya cantidad es fija -- ver research.md). Opcional y con valor por defecto
  // 0 para no alterar ninguna secuencia de `rng` ya existente cuando no se pide.
  boardDecoyProbability?: number;
  // 013-generator-fragility-difficulty: gobierna la fragilidad de los señuelos
  // de tablero (nunca la de fichas de tablero golpeadas por la solución, que
  // siempre parten de 'new' -- FR-001/FR-002).
  fragilityProfile?: FragilityProfile;
};

export type ResolutionOutcome = {
  board: Board;
  rawLaunches: RawLaunch[]; // en orden de DESCUBRIMIENTO -- el llamador las invierte (data-model.md)
  ok: boolean;
};

const DIRECTIONS: Direction[] = ['N', 'S', 'E', 'O'];

function pickDirection(rng: () => number): Direction {
  return DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)];
}

function pickRandomEmptyCell(board: Board, rng: () => number): Coordinate | null {
  const empty: Coordinate[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (getPieceAt(board, { row, col }) === null) empty.push({ row, col });
    }
  }
  return empty.length === 0 ? null : empty[Math.floor(rng() * empty.length)];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks a striker color (never the same as `obligationColor`, research.md) and one
 * of its valid inverse candidates for landing on `to`. Tries every available color
 * in random order and returns the first that has at least one valid candidate --
 * `null` if none work (contributes to the whole generation attempt failing,
 * spec.md FR-007).
 */
export function chooseStrikerAndOrigin(
  obligationColor: PieceColor,
  direction: Direction,
  to: Coordinate,
  board: Board,
  availableColors: PieceColor[],
  context: InverseContext,
  rng: () => number,
): { striker: PieceColor; origin: Coordinate } | null {
  const candidates = availableColors.filter((color) => color !== obligationColor);
  const order = shuffle(candidates, rng);

  for (const striker of order) {
    // This feature only models green/orange/brown (spec.md FR-013); a caller
    // passing another color here is a programming error, not a runtime case.
    const origins = inverseCandidates(striker as 'green' | 'orange' | 'brown', direction, to, board, context);
    if (origins.length > 0) {
      const origin = origins[Math.floor(rng() * origins.length)];
      return { striker, origin };
    }
  }
  return null;
}

function laneOf(cell: Coordinate, direction: Direction): number {
  return direction === 'E' || direction === 'O' ? cell.row : cell.col;
}

/** Mirrors launch.ts's private entryCoordinate -- same tiny, stable mapping. */
function entryCoordinate(direction: Direction, lane: number): Coordinate {
  switch (direction) {
    case 'N':
      return { row: 7, col: lane };
    case 'S':
      return { row: 0, col: lane };
    case 'E':
      return { row: lane, col: 0 };
    case 'O':
      return { row: lane, col: 7 };
  }
}

/**
 * Whether a hand launch, entering the board and travelling in `direction`, would
 * reach `to` without hitting anything else first -- travelLaunch's own semantics
 * (research.md, "camino despejado desde el borde"), independent of any color.
 */
function clearPathFromEdge(board: Board, to: Coordinate, direction: Direction): boolean {
  const lane = laneOf(to, direction);
  let current = entryCoordinate(direction, lane);
  while (!(current.row === to.row && current.col === to.col)) {
    if (getPieceAt(board, current) !== null) return false;
    current = step(current, direction);
  }
  return true;
}

export function resolveObligations(initial: Obligation, ctx: ResolutionContext): ResolutionOutcome {
  let board = ctx.board;
  let launchesUsed = 0;
  const rawLaunches: RawLaunch[] = [];
  const queue: Obligation[] = [initial];

  // 013-generator-fragility-difficulty: el estado compartido de 'easy' se
  // sortea una sola vez, la primera vez que se coloca un señuelo de tablero
  // dentro de ESTE intento, y se reutiliza para el resto (research.md,
  // Decisión 3) -- nunca escapa de esta llamada a resolveObligations.
  let cachedEasyBoardDecoyFragility: Fragility | undefined;
  const BOARD_DECOY_ALLOWED_STATES: readonly Fragility[] = ['new', 'cracked']; // FR-008: nunca BROKEN

  function pickBoardDecoyFragility(): Fragility {
    if (ctx.fragilityProfile === undefined) return 'new'; // cero rng() nuevas cuando no se pide
    if (ctx.fragilityProfile === 'easy') {
      if (cachedEasyBoardDecoyFragility === undefined) {
        cachedEasyBoardDecoyFragility = assignGroupFragility('easy', 1, BOARD_DECOY_ALLOWED_STATES, ctx.rng)[0];
      }
      return cachedEasyBoardDecoyFragility;
    }
    return assignGroupFragility(ctx.fragilityProfile, 1, BOARD_DECOY_ALLOWED_STATES, ctx.rng)[0];
  }

  while (queue.length > 0) {
    const obligation = queue.shift()!;

    // Ficha señuelo de tablero: se sortea de nuevo en cada paso (a diferencia de
    // las señuelo en mano, que son una cantidad fija) -- el `>0` evita consumir
    // ningún `rng()` cuando no se pide, para no alterar ninguna secuencia ya
    // existente (research.md, misma disciplina que el resto del generador). Una
    // colisión con una casilla que otra obligación aún pendiente necesita se
    // resuelve como cualquier otra inconsistencia: la reproducción hacia
    // delante la descarta y el intento entero se reintenta (FR-007).
    const boardDecoyProbability = ctx.boardDecoyProbability ?? 0;
    if (boardDecoyProbability > 0 && ctx.rng() < boardDecoyProbability) {
      const cell = pickRandomEmptyCell(board, ctx.rng);
      if (cell !== null) {
        const color = ctx.availableColors[Math.floor(ctx.rng() * ctx.availableColors.length)];
        board = setPieceAt(board, cell, { color, fragility: pickBoardDecoyFragility() });
      }
    }

    if (obligation.kind === 'defender') {
      if (!obligation.isRoot) {
        const mustFurniture = launchesUsed >= ctx.launchCount;
        const chooseFurniture = mustFurniture || ctx.rng() >= ctx.defenderContinuationProbability;
        if (chooseFurniture) {
          board = setPieceAt(board, obligation.cell, { color: obligation.color, fragility: 'new' });
          continue;
        }
      }

      const direction = pickDirection(ctx.rng);
      const resolved = chooseStrikerAndOrigin(
        obligation.color,
        direction,
        obligation.cell,
        board,
        ctx.availableColors,
        'settle',
        ctx.rng,
      );
      if (resolved === null) return { board, rawLaunches, ok: false };

      queue.push({
        cell: resolved.origin,
        color: obligation.color,
        kind: 'defender',
        direction: null,
        chainDepth: 0,
      });
      queue.push({
        cell: resolved.origin,
        color: resolved.striker,
        kind: 'striker-origin',
        direction,
        chainDepth: 0,
      });
      continue;
    }

    // kind === 'striker-origin': never furniture.
    const forceHand = obligation.chainDepth >= ctx.maxChainDepth;
    const chooseHand = forceHand || ctx.rng() >= ctx.chainOriginProbability;

    if (chooseHand) {
      if (launchesUsed >= ctx.launchCount) return { board, rawLaunches, ok: false };
      if (!clearPathFromEdge(board, obligation.cell, obligation.direction!)) {
        return { board, rawLaunches, ok: false };
      }
      rawLaunches.push({
        direction: obligation.direction!,
        lane: laneOf(obligation.cell, obligation.direction!),
        color: obligation.color,
      });
      launchesUsed++;
      continue;
    }

    const resolved = chooseStrikerAndOrigin(
      obligation.color,
      obligation.direction!,
      obligation.cell,
      board,
      ctx.availableColors,
      'occupied',
      ctx.rng,
    );
    if (resolved === null) return { board, rawLaunches, ok: false };

    queue.push({
      cell: resolved.origin,
      color: obligation.color,
      kind: 'defender',
      direction: null,
      chainDepth: 0,
    });
    queue.push({
      cell: resolved.origin,
      color: resolved.striker,
      kind: 'striker-origin',
      direction: obligation.direction,
      chainDepth: obligation.chainDepth + 1,
    });
  }

  return { board, rawLaunches, ok: launchesUsed >= ctx.launchCount };
}
