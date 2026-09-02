import type { Board, Coordinate, Fragility, Piece, PieceColor } from '../board.js';
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
 * One side of a mutual collision (019-synchronous-tick-resolution): given a
 * trajectory's fragility BEFORE this specific collision, decides whether it
 * advances and gets one more onward trajectory (per `pushOnward`), or --
 * already `'broken'` coming in -- simply vanishes here instead (`null`),
 * producing no further site. This is the exact same rule `settleOrVanish`
 * already applies to a single striker ("brokenness decides whether it settles,
 * never whether it strikes first") generalized to two trajectories striking
 * each other at once: a piece can only ever advance through `new -> cracked ->
 * broken` once each, a strictly finite, cycle-free progression -- so no pair of
 * trajectories can keep re-colliding with each other forever (research.md,
 * Decisión 3: the bug this fixes was letting an already-broken piece stay
 * "broken" and keep bouncing indefinitely instead of finally vanishing).
 */
function resolveMutualSide(
  fragilityBefore: Fragility,
  color: PieceColor,
  from: Coordinate,
  pushOnward: (hit: Piece) => { direction: Direction; to: Coordinate; pushedByColor: PieceColor },
): ImpactSite | null {
  if (fragilityBefore === 'broken') {
    return null; // already used up its one further hop earlier -- vanishes now
  }
  const hit: Piece = { color, fragility: advance(fragilityBefore) };
  const { direction, to, pushedByColor } = pushOnward(hit);
  return { piece: hit, direction, from, to, pushedByColor };
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
  direction: Direction,
  hasCollision: boolean,
  pushedByColor: PieceColor | undefined,
): { board: Board; events: ChainEvent[] } {
  const boardAfter = piece.fragility === 'broken' ? board : setPieceAt(board, to, piece);
  return {
    board: boardAfter,
    events: [{ type: 'MOVE_STEP', piece, from, to, direction, hasCollision, pushedByColor }],
  };
}

/**
 * Resolves a collision between two trajectories that are BOTH still in flight --
 * neither is a real, already-settled board piece (019-synchronous-tick-resolution).
 * Distinct from, and never a replacement for, `applyImpact`'s existing asymmetric
 * rule (a moving piece meeting whatever, if anything, is already settled on the
 * real board -- unchanged, FR-004 of spec.md). Reuses the SAME rules `applyImpact`
 * already has, applied symmetrically: same color still annihilates both; distinct
 * color still advances fragility and still hands the struck piece off to the
 * striker's own color/direction -- just done for BOTH sites at once, each acting
 * as the other's striker. Confirmed with the user before implementing (research.md,
 * Decisión 3): this makes each trajectory continue in the OTHER's direction, using
 * the OTHER's push mechanism -- a direction swap, not a bounce back the way it came.
 */
export function applyMutualImpact(
  board: Board,
  siteA: ImpactSite,
  siteB: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSites: ImpactSite[] } {
  if (siteA.piece.color === siteB.piece.color) {
    return {
      board,
      events: [
        { type: 'ANNIHILATION', at: siteA.to, color: siteA.piece.color, from: siteA.from, direction: siteA.direction },
      ],
      nextSites: [],
    };
  }

  // A split's own two branches are never red (the red that triggered them
  // settles immediately at the split point -- FR-007 of 009-red-piece -- and
  // never travels onward as a branch itself). But a branch's own ONWARD hit
  // can perfectly normally displace a REAL, already-settled red piece (an
  // ordinary different-color defender displacement, nothing red-specific about
  // that step) -- and that newly-displaced red piece is now a genuine in-flight
  // trajectory that CAN reach a mutual collision. Found as a real crash
  // (PUSH_STRATEGY has no 'red' entry) once a generated level actually
  // exercised it -- confirmed with the user before fixing (research.md): red
  // never "continues" after landing the way every other color does here, so
  // it's exempt from the generic advance-and-continue rule below; it settles
  // and immediately splits the OTHER trajectory instead, mirroring exactly
  // what applyImpact already does when red is a normal striker -- the same
  // settleOrVanish + resolveRedSplit primitives, no new mechanism.
  if (siteA.piece.color === 'red' || siteB.piece.color === 'red') {
    const [redSite, otherSite] = siteA.piece.color === 'red' ? [siteA, siteB] : [siteB, siteA];
    const { board: boardWithRed, events: redEvents } = settleOrVanish(
      board,
      redSite.piece,
      redSite.from,
      redSite.to,
      redSite.direction,
      true,
      redSite.pushedByColor,
    );
    if (otherSite.piece.fragility === 'broken') {
      // Already used up its one further hop earlier -- vanishes here instead
      // of being split again (same rule resolveMutualSide already applies).
      return { board: boardWithRed, events: redEvents, nextSites: [] };
    }
    const hitOther: Piece = { color: otherSite.piece.color, fragility: advance(otherSite.piece.fragility) };
    const { board: finalBoard, events: splitEvents } = resolveRedSplit(
      boardWithRed,
      hitOther,
      redSite.to,
      redSite.direction,
    );
    return { board: finalBoard, events: [...redEvents, ...splitEvents], nextSites: [] };
  }

  const nextA = resolveMutualSide(siteA.piece.fragility, siteA.piece.color, siteA.to, (hit) => ({
    direction: siteB.direction,
    to: PUSH_STRATEGY[siteB.piece.color as Exclude<PieceColor, 'red'>](board, hit, siteA.to, siteB.direction),
    pushedByColor: siteB.piece.color,
  }));
  const nextB = resolveMutualSide(siteB.piece.fragility, siteB.piece.color, siteB.to, (hit) => ({
    direction: siteA.direction,
    to: PUSH_STRATEGY[siteA.piece.color as Exclude<PieceColor, 'red'>](board, hit, siteB.to, siteA.direction),
    pushedByColor: siteA.piece.color,
  }));

  return {
    board,
    events: [],
    nextSites: [nextA, nextB].filter((site): site is ImpactSite => site !== null),
  };
}

/**
 * Red's own primitive (Principle V, plan.md): the struck defender (already
 * carrying its own advanced fragility -- FR-015, both branches share the SAME
 * state) is replaced by two independent branches, one per perpendicular
 * direction. Both branches are seeded into the SAME `resolveChain` call
 * (019-synchronous-tick-resolution, research.md Decisión 1/2) -- the queue
 * interleaves them hop by hop rather than draining branch 1's entire cascade
 * before branch 2 gets a turn (superseding FR-005 of 009-red-piece's own
 * "no interleaving" simplification), and `applyMutualImpact` resolves any point
 * where their real paths coincide, instead of one silently passing through the
 * other. `applyImpact` is still reused as-is for each branch's own ordinary
 * impacts -- no special case for red beyond seeding two sites instead of one.
 */
function resolveRedSplit(
  board: Board,
  hitDefender: Piece,
  position: Coordinate,
  direction: Direction,
): { board: Board; events: ChainEvent[] } {
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction];

  return resolveChain(
    board,
    [
      { piece: hitDefender, direction: first, from: position, to: stepBy(position, first, 1) },
      { piece: hitDefender, direction: second, from: position, to: stepBy(position, second, 1) },
    ],
    applyImpact,
    applyMutualImpact,
  );
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
    const { board: boardAfter, events } = settleOrVanish(
      board,
      site.piece,
      site.from,
      site.to,
      site.direction,
      false,
      site.pushedByColor,
    );
    return { board: boardAfter, events, nextSites: [] };
  }

  if (defender.color === site.piece.color) {
    const boardAfter = setPieceAt(board, site.to, null);
    return {
      board: boardAfter,
      events: [
        { type: 'ANNIHILATION', at: site.to, color: site.piece.color, from: site.from, direction: site.direction },
      ],
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
    site.direction,
    true,
    site.pushedByColor,
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
  const to = PUSH_STRATEGY[site.piece.color](boardWithStriker, hitDefender, site.to, site.direction);
  const nextSite: ImpactSite = {
    piece: hitDefender,
    direction: site.direction,
    from: site.to,
    to,
    pushedByColor: site.piece.color,
  };
  return { board: boardWithStriker, events: strikerEvents, nextSites: [nextSite] };
}
