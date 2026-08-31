import type { Board, Coordinate, Piece, PieceColor } from '../board.js';
import { getPieceAt, setPieceAt } from '../board.js';
import { stepBy, stepUntilBlocked, type Direction } from '../move-step.js';
import type { ChainEvent, ImpactSite } from '../events.js';
import { resolveChain } from '../events.js';

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
 * interchangeable strategies, none of them a special case `applyImpact` needs to
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

/** The settle-or-vanish pattern every impact ends with: a piece occupies its
 * destination unless it's `'broken'` (FR-004), in which case it simply disappears
 * without an event -- unified here (016-immediate-chain-placement) instead of
 * being repeated at every call site that used to defer this decision.
 */
function settleOrVanish(
  board: Board,
  piece: Piece,
  from: Coordinate,
  to: Coordinate,
  hasCollision: boolean,
): { board: Board; events: ChainEvent[] } {
  const boardAfter = piece.fragility === 'broken' ? board : setPieceAt(board, to, piece);
  return {
    board: boardAfter,
    events: [{ type: 'MOVE_STEP', piece, from, to, hasCollision }],
  };
}

/**
 * Red's own primitive (Principle V, plan.md): the struck defender (already
 * carrying its own advanced fragility -- FR-015, both branches share the SAME
 * state) is replaced by two independent branches, one per perpendicular
 * direction. Each branch's entire cascade is drained by reusing `resolveChain`
 * (`../events.js`) -- the same generic queue `resolveLaunch` itself uses as the
 * outer driver -- once per branch, strictly sequentially: the second branch's
 * `resolveChain` call only starts from the board the first one's already fully
 * resolved to (spec.md 009, FR-005: no interleaving). This is what makes the
 * "colocación inmediata" fix (016-immediate-chain-placement, research.md
 * Decisión 4) apply to red without any special case: `applyImpact` is reused
 * as-is for each branch's own impact, exactly like any linear chain.
 */
function resolveRedSplit(
  board: Board,
  hitDefender: Piece,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[] } {
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction];

  const firstBranch = resolveChain(
    board,
    { piece: hitDefender, direction: first, from: position, to: stepBy(position, first, 1) },
    applyImpact,
  );
  const secondBranch = resolveChain(
    firstBranch.board,
    { piece: hitDefender, direction: second, from: position, to: stepBy(position, second, 1) },
    applyImpact,
  );

  return {
    board: secondBranch.board,
    events: [...firstBranch.events, ...secondBranch.events],
  };
}

/**
 * Resolves exactly ONE impact -- `site.piece` arriving at `site.to` -- and returns
 * at most one `nextSites` entry for whatever it displaces, letting `resolveChain`
 * (the caller, either `resolveLaunch`'s own outer queue or `resolveRedSplit`'s
 * inner one) process the rest (016-immediate-chain-placement, research.md
 * Decisión 3). Never recurses to resolve a whole cascade itself -- that's exactly
 * what used to make an in-flight piece invisible to the rest of its own cascade
 * until the recursion unwound. Whether `site.piece` itself settles was always a
 * LOCAL decision (only whether its own immediate strike was an annihilation, never
 * anything deeper) -- so writing it immediately, before even knowing what happens
 * to the piece it displaced, changes no decision from the previous implementation,
 * only when the write happens.
 */
export function applyImpact(
  board: Board,
  site: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  const defender = getPieceAt(board, site.to);

  if (defender === null) {
    const { board: boardAfter, events } = settleOrVanish(board, site.piece, site.from, site.to, false);
    return { board: boardAfter, events, nextSites: [] };
  }

  if (defender.color === site.piece.color) {
    const boardAfter = setPieceAt(board, site.to, null);
    return {
      board: boardAfter,
      events: [{ type: 'ANNIHILATION', at: site.to, color: site.piece.color }],
      nextSites: [],
    };
  }

  // The defender is about to be displaced by a different-color strike -- that's
  // exactly "being hit" (FR-002). A defender read off a real board can never
  // already be `'broken'`: a broken piece is removed the instant it would settle
  // (FR-004) and so never gets placed to begin with -- see `advance`'s own
  // comment. The throw both documents and enforces that invariant.
  if (defender.fragility === 'broken') {
    throw new Error('invariant violated: a broken piece was found on the board');
  }
  const hitDefender: Piece = { color: defender.color, fragility: advance(defender.fragility) };
  const vacated = setPieceAt(board, site.to, null);

  // site.piece settles immediately -- never depended on the defender's own onward
  // fate (see this function's own comment above).
  const { board: boardWithStriker, events: strikerEvents } = settleOrVanish(
    vacated,
    site.piece,
    site.from,
    site.to,
    true,
  );

  if (site.piece.color === 'red') {
    const { board: finalBoard, events: splitEvents } = resolveRedSplit(
      boardWithStriker,
      hitDefender,
      site.to,
      site.direction,
    );
    return { board: finalBoard, events: [...strikerEvents, ...splitEvents], nextSites: [] };
  }

  // hitDefender still exerts its own strike on whatever it lands on, even when
  // BROKEN -- brokenness only ever decides whether IT settles once ITS OWN
  // resolution finishes (`settleOrVanish`, applied when this nextSites entry is
  // processed), never whether it strikes something in the first place.
  const to = PUSH_STRATEGY[site.piece.color](vacated, hitDefender, site.to, site.direction);
  const nextSite: ImpactSite = { piece: hitDefender, direction: site.direction, from: site.to, to };
  return { board: boardWithStriker, events: strikerEvents, nextSites: [nextSite] };
}
