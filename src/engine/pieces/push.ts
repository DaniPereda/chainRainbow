import type { Board, Coordinate, Fragility, Piece, PieceColor } from '../board.js';
import { getPieceAt, isInBounds, setPieceAt, wrapCoordinate } from '../board.js';
import { step, stepBy, stepUntilBlocked, type Direction } from '../move-step.js';
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
 * A single cell of an in-progress brown-driven walk -- same edge-crossing
 * bookkeeping `stepUntilBlocked` already does internally in its own `for`
 * loop, extracted so it can be spread across successive `applyImpact` calls
 * instead of a single synchronous loop (021-cellwise-collision-resolution,
 * research.md Decisión 2/4). Never decides whether the resulting cell is
 * occupied -- that's for the caller to resolve by re-reading the real board
 * (or the queue) with the updated `to`, exactly like any other `ImpactSite`.
 */
function stepWalking(
  from: Coordinate,
  direction: Direction,
  edgeCrossingsSoFar: number,
): { to: Coordinate; edgeCrossings: number; capped: boolean } {
  const raw = step(from, direction);
  const edgeCrossings = edgeCrossingsSoFar + (isInBounds(raw) ? 0 : 1);
  return { to: wrapCoordinate(raw), edgeCrossings, capped: edgeCrossings >= MAX_EDGE_CROSSINGS };
}

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
 * Resolves what happens to `hitSite` when the OTHER side of a mutual collision
 * (`strikerSite`) acts as its striker -- exactly the role `applyImpact` gives a
 * real striker meeting a defender, just for a trajectory that's still in
 * flight instead of a real, already-settled board piece. `hitSite` is NEVER
 * special-cased by its own color, red included: whichever side gets struck,
 * it advances its own fragility and moves according to the STRIKER's
 * mechanism, exactly like any other piece would -- confirmed with the user
 * (022-parallel-branch-animation follow-up review, level 2): a previous
 * version let red simply sit still at a mutual collision, unharmed and
 * unmoved, while the OTHER side took the hit -- an asymmetry the user's own
 * words ruled out directly ("el rojo no debe tener un comportamiento especial
 * en ningun caso. Si recibe un golpe se mueve en consecuencia y se degrada en
 * nivel de fragilidad").
 *
 * What genuinely differs by color is the STRIKER's own mechanism, exactly as
 * everywhere else in this file: red has no displacement of its own
 * (`PUSH_STRATEGY` deliberately has no 'red' entry -- red doesn't push a
 * defender, it splits it, `resolveRedSplit`'s own primitive) so a red striker
 * resolves and writes to `board` immediately, splitting `hitSite` into its two
 * branches right here -- exactly like `applyImpact`'s own red-striker branch,
 * no new mechanism. Any other color defers instead, producing one more onward
 * `ImpactSite` for `resolveChain`'s queue to pick up later; brown's own
 * variable-distance walk becomes a single tentative step (`walking`), same
 * reasoning as `applyImpact`'s equivalent branch (021-cellwise-collision-
 * resolution): it's the only mechanism that can genuinely cross paths with
 * another in-flight trajectory before reaching its own final cell.
 */
function strikeMutualSide(
  board: Board,
  hitSite: ImpactSite,
  strikerSite: ImpactSite,
): { board: Board; events: ChainEvent[]; nextSite: ImpactSite | null } {
  if (hitSite.piece.fragility === 'broken') {
    // Already used up its one further hop earlier -- vanishes here instead of
    // taking another hit. A piece can only ever advance through `new ->
    // cracked -> broken` once each, a strictly finite, cycle-free progression
    // -- so no pair of trajectories can keep re-colliding with each other
    // forever (019-synchronous-tick-resolution, research.md Decisión 3).
    return { board, events: [], nextSite: null };
  }
  const hit: Piece = { color: hitSite.piece.color, fragility: advance(hitSite.piece.fragility) };

  if (strikerSite.piece.color === 'red') {
    const { board: finalBoard, events } = resolveRedSplit(board, hit, hitSite.to, strikerSite.direction);
    return { board: finalBoard, events, nextSite: null };
  }

  if (strikerSite.piece.color === 'brown') {
    const { to, edgeCrossings } = stepWalking(hitSite.to, strikerSite.direction, 0);
    return {
      board,
      events: [],
      nextSite: {
        piece: hit,
        direction: strikerSite.direction,
        from: hitSite.to,
        to,
        pushedByColor: 'brown',
        walking: { edgeCrossings },
      },
    };
  }

  const to = PUSH_STRATEGY[strikerSite.piece.color](board, hit, hitSite.to, strikerSite.direction);
  return {
    board,
    events: [],
    nextSite: { piece: hit, direction: strikerSite.direction, from: hitSite.to, to, pushedByColor: strikerSite.piece.color },
  };
}

/**
 * Resolves a collision between two trajectories that are BOTH still in flight --
 * neither is a real, already-settled board piece (019-synchronous-tick-resolution).
 * Distinct from, and never a replacement for, `applyImpact`'s existing asymmetric
 * rule (a moving piece meeting whatever, if anything, is already settled on the
 * real board -- unchanged, FR-004 of spec.md). Same color still annihilates both
 * (checked first, since neither side has a "striker" in that case). Otherwise,
 * fully symmetric regardless of which colors are involved -- `strikeMutualSide`
 * resolves each side exactly as if the OTHER side were its striker, run
 * sequentially (A's own resolution, whatever it writes to `board`, feeds B's)
 * purely because there's no other order to thread a single `Board` through two
 * writes; the two sides never touch the same cells (that's exactly what makes
 * this a mutual collision rather than one of them meeting a real defender).
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

  const resultA = strikeMutualSide(board, siteA, siteB);
  const resultB = strikeMutualSide(resultA.board, siteB, siteA);

  return {
    board: resultB.board,
    events: [...resultA.events, ...resultB.events],
    nextSites: [resultA.nextSite, resultB.nextSite].filter((site): site is ImpactSite => site !== null),
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
    // A brown-driven walk in progress: `to` is only a tentative single-cell
    // step, not a final destination (021-cellwise-collision-resolution) --
    // take one more step instead of settling, unless the edge-crossing cap is
    // reached (same limit stepUntilBlocked already enforced, spec.md 008).
    if (site.walking !== undefined) {
      const { to, edgeCrossings, capped } = stepWalking(site.to, site.direction, site.walking.edgeCrossings);
      if (!capped) {
        const nextSite: ImpactSite = { ...site, to, walking: { edgeCrossings } };
        return { board, events: [], nextSites: [nextSite] }; // still in flight -- no event yet
      }
    }
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
  //
  // When the striker is brown, the displaced defender's onward journey starts
  // as a single tentative step (`walking`) instead of the fully-precomputed
  // final destination `PUSH_STRATEGY['brown']` would give -- the only
  // mechanism whose distance is variable enough to genuinely cross paths with
  // another in-flight trajectory before reaching its own final cell
  // (021-cellwise-collision-resolution, research.md Decisión 2/6). Green and
  // orange are unaffected -- their distance is fixed and small enough that
  // comparing final destinations (the existing `findCoincidingPair`) was
  // always correct.
  const nextSite: ImpactSite =
    site.piece.color === 'brown'
      ? (() => {
          const { to, edgeCrossings } = stepWalking(site.to, site.direction, 0);
          return {
            piece: hitDefender,
            direction: site.direction,
            from: site.to,
            to,
            pushedByColor: 'brown' as const,
            walking: { edgeCrossings },
          };
        })()
      : {
          piece: hitDefender,
          direction: site.direction,
          from: site.to,
          to: PUSH_STRATEGY[site.piece.color](boardWithStriker, hitDefender, site.to, site.direction),
          pushedByColor: site.piece.color,
        };
  return { board: boardWithStriker, events: strikerEvents, nextSites: [nextSite] };
}
