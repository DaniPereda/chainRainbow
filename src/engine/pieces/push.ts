import type { Board, Coordinate, Piece, PieceColor } from '../board.js';
import { getPieceAt, setPieceAt } from '../board.js';
import { stepBy, stepUntilBlocked, type Direction } from '../move-step.js';
import type { AnnihilationEvent, ChainEvent, ImpactSite } from '../events.js';

/**
 * Advances a piece's fragility exactly one step (FR-002). Typed to exclude `'broken'`
 * from its own input: a piece already `'broken'` is removed the instant it would
 * settle (FR-004) and never placed on the board again, so a REAL board can never
 * hand this function a `'broken'` defender to begin with -- restricting the input
 * type turns that system invariant into something the compiler checks, instead of
 * a silent no-op branch that would hide a violation if it ever happened
 * (research.md, "advance() como función total").
 */
function advance(fragility: 'new' | 'cracked'): 'cracked' | 'broken' {
  return fragility === 'new' ? 'cracked' : 'broken';
}

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
 * Resolves one branch of a split: `piece` (already carrying whatever fragility the
 * split defender advanced to -- FR-015, both branches share the SAME state) travels
 * one cell in `direction` from `from`. If that cell is empty, it settles there
 * unless it's `'broken'` (FR-004), in which case it simply vanishes -- the split
 * still happened, this branch just never materializes. If the destination is
 * occupied, this branch becomes the striker for a normal `resolveStrike` -- reusing
 * the exact same push/annihilate/fragility rule any other piece composes with, no
 * special case.
 *
 * `resolveStrike` never places the striker itself at the vacated position -- that has
 * always been the caller's job (see its own comment). `resolveBranch` acts as that
 * caller for its own branch, so it replicates the same settle-or-omit step that
 * every other collision in the chain already goes through.
 */
function resolveBranch(
  board: Board,
  piece: Piece,
  from: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[] } {
  const to = stepBy(from, direction, 1);
  const occupant = getPieceAt(board, to);

  if (occupant === null) {
    const boardAfter = piece.fragility === 'broken' ? board : setPieceAt(board, to, piece);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece, from, to, hasCollision: false }],
    };
  }

  const next = resolveStrike(board, piece.color, to, direction);
  const shouldSettle = !next.annihilated && piece.fragility !== 'broken';
  const boardAfter = shouldSettle ? setPieceAt(next.board, to, piece) : next.board;
  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece, from, to, hasCollision: true },
      ...next.events,
    ],
  };
}

/**
 * Red's own primitive (Principle V, plan.md): the struck `defender` piece (already
 * carrying its own advanced fragility -- see `resolveStrike`, FR-015) is replaced by
 * two independent branches, one per perpendicular direction, resolved strictly
 * sequentially -- the first branch's full cascade completes before the second one
 * starts (spec.md: deliberate scope limitation, no interleaving). Both branches
 * inherit the SAME advanced state: the split counts as one hit on the defender, not
 * two. The split cell itself (`position`) is left empty; whoever called
 * `resolveStrike` with `'red'` places the red piece there, exactly like any other
 * defender that wasn't annihilated (see the "settles for free" finding in
 * research.md).
 */
function resolveSplit(
  board: Board,
  defender: Piece,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[]; annihilated: boolean } {
  const boardAfterSplit = setPieceAt(board, position, null);
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction];

  const firstBranch = resolveBranch(boardAfterSplit, defender, position, first);
  const secondBranch = resolveBranch(firstBranch.board, defender, position, second);

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
 *
 * `position` is vacated EAGERLY, before computing `to` and before recursing --
 * not deferred to when the recursion unwinds. Brown's own displacement (the only
 * strategy that actually reads `board`) walks forward excluding just the piece it
 * is currently carrying, by identity; if earlier links of the same cascade were
 * still shown as occupied (the pre-fix behaviour), that walk could wrap a full lap
 * of an otherwise-clear lane and land back on a piece from earlier in the SAME
 * cascade -- which then replays the exact same collision again, forever. Vacating
 * eagerly means every recursive call sees an accurate, live view of what is still
 * really on the board, so a walk that circles back to an already-vacated link
 * correctly reads it as empty and keeps going, instead of colliding with a piece
 * that is, physically, still mid-flight (found via manual play-testing of
 * generated 6-launch levels, tools/generator/ -- confirmed with a 2-piece repro
 * fully outside the generator, then generalized: any number of links apart, as
 * long as brown ends up carrying a strike whose forward lane is otherwise clear
 * back to an earlier link).
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

  // The defender is about to be displaced by a different-color strike -- that's
  // exactly "being hit" (FR-002). A defender read off a real board can never already
  // be `'broken'`: a broken piece is removed the instant it would settle (FR-004)
  // and so never gets placed to begin with -- see `advance`'s own comment. The throw
  // both documents and enforces that invariant, and narrows the type for `advance`.
  if (defender.fragility === 'broken') {
    throw new Error('invariant violated: a broken piece was found on the board');
  }
  const hitDefender: Piece = { color: defender.color, fragility: advance(defender.fragility) };

  if (strikerColor === 'red') {
    return resolveSplit(board, hitDefender, position, direction);
  }

  const vacated = setPieceAt(board, position, null);
  const to = PUSH_STRATEGY[strikerColor](vacated, hitDefender, position, direction);
  const occupant = getPieceAt(vacated, to);

  if (occupant === null) {
    const boardAfter =
      hitDefender.fragility === 'broken' ? vacated : setPieceAt(vacated, to, hitDefender);
    return {
      board: boardAfter,
      events: [{ type: 'MOVE_STEP', piece: hitDefender, from: position, to, hasCollision: false }],
      annihilated: false,
    };
  }

  // `to` is occupied: `hitDefender` is now the striker for that next collision.
  // `position` is already vacated on `vacated`, above -- `next` only needs to
  // settle `hitDefender` at `to` if it wasn't itself annihilated there AND it
  // isn't `'broken'` (FR-004) -- two independent reasons a piece can fail to settle.
  const next = resolveStrike(vacated, hitDefender.color, to, direction);
  const shouldSettle = !next.annihilated && hitDefender.fragility !== 'broken';
  const boardAfter = shouldSettle ? setPieceAt(next.board, to, hitDefender) : next.board;

  return {
    board: boardAfter,
    events: [
      { type: 'MOVE_STEP', piece: hitDefender, from: position, to, hasCollision: true },
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
