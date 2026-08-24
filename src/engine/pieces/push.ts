import type { Board, Coordinate, Piece, PieceColor } from '../board.js';
import { getPieceAt, setPieceAt } from '../board.js';
import { stepBy, stepUntilBlocked, type Direction } from '../move-step.js';
import type { AnnihilationEvent, ChainEvent, ImpactSite } from '../events.js';

/**
 * Computes where a defender ends up after being struck by `strikerColor`, given
 * which piece it is and where it currently is. Green and orange are fixed-distance
 * jumps (never look at `board`/`piece`); brown walks one cell at a time, checking
 * occupancy at every step, until blocked or capped (spec.md 008) -- three
 * interchangeable strategies, none of them a special case `resolveStrike` needs to
 * know about (Principle V).
 */
type DisplacementStrategy = (
  board: Board,
  piece: Piece,
  position: Coordinate,
  direction: Direction,
) => Coordinate;

const MAX_EDGE_CROSSINGS = 2;

export const PUSH_STRATEGY: Record<Exclude<PieceColor, 'red'>, DisplacementStrategy> = {
  green: (_board, _piece, position, direction) => stepBy(position, direction, 1),
  orange: (_board, _piece, position, direction) => stepBy(position, direction, 2),
  brown: (board, piece, position, direction) =>
    stepUntilBlocked(board, piece, position, direction, MAX_EDGE_CROSSINGS),
};

/**
 * The axis a split's two branches travel on is always the OTHER axis from the
 * impact's own direction of travel (spec.md FR-003/FR-005, design doc section 10):
 * a vertical impact (N or S) produces east/west branches, a horizontal one (E or O)
 * produces north/south branches. Within that axis the order is fixed regardless of
 * which of the two impact directions triggered it (E-before-O, N-before-S).
 */
const PERPENDICULAR_DIRECTIONS: Record<Direction, [Direction, Direction]> = {
  N: ['E', 'O'],
  S: ['E', 'O'],
  E: ['N', 'S'],
  O: ['N', 'S'],
};

/**
 * Resolves one branch of a split: a freshly created `color` piece travels one cell
 * in `direction` from `from`. If that cell is empty, it just settles there. If it's
 * occupied, this branch becomes the striker for a normal `resolveStrike` -- reusing
 * the exact same push/annihilate rule any other piece composes with, no special case.
 *
 * `resolveStrike` never places the striker itself at the vacated position -- that has
 * always been the caller's job (see its own comment). `resolveBranch` acts as that
 * caller for its own branch, so it replicates the same
 * `next.annihilated ? next.board : setPieceAt(next.board, to, piece)` step that every
 * other collision in the chain already goes through.
 */
function resolveBranch(
  board: Board,
  color: PieceColor,
  from: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[] } {
  const to = stepBy(from, direction, 1);
  const piece: Piece = { color };
  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = setPieceAt(board, to, piece);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece, from, to, hasCollision: false }],
    };
  }

  const next = resolveStrike(board, color, to, direction);
  const boardAfter = next.annihilated ? next.board : setPieceAt(next.board, to, piece);
  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece, from, to, hasCollision: true },
      ...next.events,
    ],
  };
}

/**
 * Red's own primitive (Principle V, plan.md): the struck `defenderColor` piece is
 * replaced by two independent branches, one per perpendicular direction, resolved
 * strictly sequentially -- the first branch's full cascade completes before the
 * second one starts (spec.md: deliberate scope limitation, no interleaving). The
 * split cell itself (`position`) is left empty; whoever called `resolveStrike` with
 * `'red'` places the red piece there, exactly like any other defender that wasn't
 * annihilated (see the "settles for free" finding in research.md).
 */
function resolveSplit(
  board: Board,
  defenderColor: PieceColor,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[]; annihilated: boolean } {
  const boardAfterSplit = setPieceAt(board, position, null);
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction];

  const firstBranch = resolveBranch(boardAfterSplit, defenderColor, position, first);
  const secondBranch = resolveBranch(firstBranch.board, defenderColor, position, second);

  return {
    board: secondBranch.board,
    events: [...firstBranch.events, ...secondBranch.events],
    annihilated: false,
  };
}

/**
 * Resolves a single strike: a piece of `strikerColor` hitting whatever occupies
 * `position`. Same color -> both vanish (`annihilated: true`). Different color ->
 * the defender is pushed by the striker's own distance, recursing if that lands on
 * a third piece. `position` (where the striker itself came from) is always left
 * empty either way -- the striker was either the originally launched piece, which
 * never persists on the board (applyImpact), or an earlier defender in the same
 * cascade, whose own resting place is `to` of ITS OWN strike, resolved one level up.
 */
function resolveStrike(
  board: Board,
  strikerColor: PieceColor,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[]; annihilated: boolean } {
  const defender = getPieceAt(board, position);
  if (defender === null) {
    return { board, events: [], annihilated: false };
  }

  if (defender.color === strikerColor) {
    const boardAfter = setPieceAt(board, position, null);
    const event: AnnihilationEvent = {
      type: 'ANNIHILATION',
      at: position,
      color: strikerColor, // === defender.color by definition of this branch
    };
    return { board: boardAfter, events: [event], annihilated: true };
  }

  if (strikerColor === 'red') {
    return resolveSplit(board, defender.color, position, direction);
  }

  const to = PUSH_STRATEGY[strikerColor](board, defender, position, direction);

  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = setPieceAt(setPieceAt(board, position, null), to, defender);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece: defender, from: position, to, hasCollision: false }],
      annihilated: false,
    };
  }

  // `to` is occupied: `defender` is now the striker for that next collision. Whatever
  // happens there (push or annihilation), `position` is vacated either way -- but
  // `defender` only ends up settled at `to` if IT wasn't itself annihilated there.
  const next = resolveStrike(board, defender.color, to, direction);
  const clearedPosition = setPieceAt(next.board, position, null);
  const boardAfter = next.annihilated
    ? clearedPosition
    : setPieceAt(clearedPosition, to, defender);

  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece: defender, from: position, to, hasCollision: true },
      ...next.events,
    ],
    annihilated: false,
  };
}

export function applyImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  // The launched piece is the agent that triggers this impact, not a piece that
  // comes to reside on the board -- it never persists, whatever resolveStrike
  // decides (annihilation, a plain push, or a push that cascades into an
  // annihilation further down the chain). resolveStrike already leaves site.to
  // cleared in every case, so there is nothing left to do here (spec.md 006).
  const result = resolveStrike(board, site.piece.color, site.to, site.direction);
  return { board: result.board, events: result.events, nextSites: [] };
}
