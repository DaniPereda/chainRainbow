import type { Board, Coordinate, Fragility, Piece, PieceColor } from '../board.js';
import { getPieceAt, isInBounds, setPieceAt, wrapCoordinate } from '../board.js';
import { step, stepBy, stepUntilBlocked, type Direction } from '../move-step.js';
import type { ChainEvent, ImpactResolution, ImpactSite } from '../events.js';
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

export const PUSH_STRATEGY: Record<Exclude<PieceColor, 'red' | 'black' | 'rainbow' | 'purple'>, DisplacementStrategy> = {
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

/**
 * The axis a line-clear (negro) affects is derived from the impact's own
 * direction -- the exact same N/S-vs-E/O convention already established by
 * red's own branching above (spec.md 009 FR-003), applied here to WHICH line
 * gets cleared instead of to two new branch directions
 * (023-black-piece-line-clear, spec.md FR-002/FR-003).
 */
function lineFromImpact(to: Coordinate, direction: Direction): { axis: 'row' | 'column'; index: number } {
  return direction === 'N' || direction === 'S' ? { axis: 'column', index: to.col } : { axis: 'row', index: to.row };
}

/**
 * Empties every occupied cell along one full row or column -- negro's own
 * primitive (023-black-piece-line-clear, research.md Decisión 2: genuinely
 * new, not expressible as MOVE_STEP + collision policy + repetition +
 * branching -- no piece here travels from one cell to the next, several
 * disappear in place at once). Pure and deterministic: scans in increasing
 * index order so the resulting list of cleared cells -- and therefore the
 * ANNIHILATION events built from it in `applyImpact` -- is always in the
 * same order for the same board/line (Principle III).
 */
function clearLine(board: Board, axis: 'row' | 'column', index: number): { board: Board; clearedCells: Coordinate[] } {
  const clearedCells: Coordinate[] = [];
  let nextBoard = board;
  for (let i = 0; i < board.size; i++) {
    const coord: Coordinate = axis === 'row' ? { row: index, col: i } : { row: i, col: index };
    if (getPieceAt(nextBoard, coord) !== null) {
      clearedCells.push(coord);
      nextBoard = setPieceAt(nextBoard, coord, null);
    }
  }
  return { board: nextBoard, clearedCells };
}

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
  visualOrigin?: { from: Coordinate; direction: Direction },
): { board: Board; events: ChainEvent[] } {
  const boardAfter = piece.fragility === 'broken' ? board : setPieceAt(board, to, piece);
  return {
    board: boardAfter,
    events: [{ type: 'MOVE_STEP', piece, from, to, direction, hasCollision, pushedByColor, visualOrigin }],
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
 *
 * `hitSite.to` (the meeting cell) becomes the new `from` for whatever this
 * side goes on to do next -- correct for the ENGINE's own purposes (that's
 * genuinely where this next hop starts), but it discards `hitSite`'s own
 * `from`/`direction`, which for a walking site is the walk's TRUE origin,
 * possibly several invisible cells earlier (found as a real bug reported by
 * the user: the piece just popped into existence at the meeting cell, the
 * whole walk that led there never shown at all). `visualOrigin` preserves
 * that for rendering before it's lost -- `hitSite`'s own, if it already had
 * one (an earlier mutual collision already redirected it once), otherwise
 * freshly captured from `hitSite.from`/`direction` here.
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
  const visualOrigin = hitSite.visualOrigin ?? { from: hitSite.from, direction: hitSite.direction };

  if (strikerSite.piece.color === 'red') {
    const splitResult = resolveRedSplit(board, hit, hitSite.to, strikerSite.direction, visualOrigin);
    if (splitResult.status === 'pending-color-choice') {
      // Extremely rare, undiscussed nesting (024-rainbow-color-change): BOTH
      // sides of a mutual collision are, by definition, still in-flight
      // trajectories -- but a defender's own COLOR (unlike its role) is never
      // restricted by that, so a red-colored trajectory here is possible (a
      // non-red attacker can push a struck red defender into flight, same as
      // any other color). If that red trajectory's own split then reaches a
      // SETTLED arcoíris further down the board, resolving it would require
      // pausing a mutual collision for player input -- a case never surfaced
      // by the user and not supported by this feature. Fails loudly instead
      // of silently dropping the pending choice, same pattern as the
      // "black cannot be one side of a mutual collision" invariant below.
      throw new Error(
        'unsupported: a mutual collision\'s red split reached a rainbow interaction -- ' +
          'pausing for a color choice mid-mutual-collision is not supported',
      );
    }
    return { board: splitResult.board, events: splitResult.events, nextSite: null };
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
        visualOrigin,
      },
    };
  }

  if (strikerSite.piece.color === 'black') {
    // Negro real can never be one of the two ALREADY-in-flight sides of a
    // mutual collision -- its own interaction is always terminal (a line
    // clear, never a `nextSite`), an invariant that remains true and
    // UNCHANGED. This branch is reached by a completely different route:
    // `applyChosenColorToRainbow` (027-rainbow-attacker-only, research.md
    // Decisión 4) synthesizes a `strikerSite` carrying whatever color the
    // player just chose for the OTHER side of a rainbow-involved mutual
    // collision -- if that color is black, the effect on arcoíris (the
    // `hitSite` here) is exactly negro's own line-clear, reusing
    // `clearLineFrom` (extracted from `applyImpact`'s own black branch). The
    // cleared line's axis/index follows `strikerSite.direction`, same
    // convention as the generic push branch below.
    const triggerEvent: ChainEvent = {
      type: 'ANNIHILATION',
      at: hitSite.to,
      color: hitSite.piece.color,
      from: hitSite.from,
      direction: hitSite.direction,
      pushedByColor: hitSite.pushedByColor,
      visualOrigin,
    };
    const { board: clearedBoard, events } = clearLineFrom(board, hitSite.to, strikerSite.direction, triggerEvent);
    return { board: clearedBoard, events, nextSite: null };
  }

  if (strikerSite.piece.color === 'rainbow') {
    // Truly unreachable (027-rainbow-attacker-only): never one of the two
    // ORIGINAL in-flight sides here (that case is intercepted earlier in
    // `applyMutualImpact`, before either `strikeMutualSide` call below), and
    // never a color the player can choose in `buildColorChoicePause`'s own
    // `options` (never includes 'rainbow') when this is reached synthetically
    // from `applyChosenColorToRainbow`. Kept as an explicit throw purely so
    // `strikerSite.piece.color` narrows correctly for `PUSH_STRATEGY`'s own
    // type below, not because this is expected to ever fire.
    throw new Error('invariant violated: rainbow cannot be one side of a mutual collision');
  }

  if (strikerSite.piece.color === 'purple') {
    // Same reasoning as negro above (025-purple-attraction-piece): a
    // púrpura-colored `ImpactSite` never exists in `resolveChain`'s queue at
    // all -- its own launch resolves entirely through `scanPurpleSettle`
    // before `resolveChain` starts, and the two sites it seeds carry the
    // ATTRACTED pieces' own colors, never `'purple'` itself (research.md,
    // Decisión 1/2). So it can never become one of the two already-in-flight
    // sides of a mutual collision either. Unlike negro, no synthetic caller
    // ever needs púrpura's own mechanic here (it has no effect against a real
    // defender to begin with, spec.md FR-007 of 025), so this stays a genuine
    // invariant throw.
    throw new Error('invariant violated: purple cannot be one side of a mutual collision');
  }
  const to = PUSH_STRATEGY[strikerSite.piece.color](board, hit, hitSite.to, strikerSite.direction);
  return {
    board,
    events: [],
    nextSite: {
      piece: hit,
      direction: strikerSite.direction,
      from: hitSite.to,
      to,
      pushedByColor: strikerSite.piece.color,
      visualOrigin,
    },
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
export function applyMutualImpact(board: Board, siteA: ImpactSite, siteB: ImpactSite): ImpactResolution {
  if (siteA.piece.color === siteB.piece.color) {
    // Two genuinely separate trajectories converge and both annihilate --
    // TWO events, one per real side, not one (025-purple-attraction-piece:
    // reported live by the user as "se anima la ficha de arriba pero no la de
    // abajo" -- únicamente había un evento, así que el renderer literalmente
    // no tenía nada que animar para el otro lado). Previously deliberately
    // simplified to a single event "recording one side of it" (see
    // AnnihilationEvent's own comment, since corrected) when this was mostly
    // a rare edge case of red's own parallel branches; púrpura's whole
    // mechanic routinely produces exactly this shape, making the gap
    // impossible to ignore. Both events share the same `at` (that's the
    // definition of a mutual collision) -- the renderer treats them as
    // siblings via the SAME origin-orphan-chaining fallback already used for
    // an unrelated line-clear's swept cells (`computeEventParents`), no
    // changes needed there. Two arcoíris colliding fall in here too, exactly
    // like any other same-color pair (027-rainbow-attacker-only, research.md
    // Decisión 7) -- no special case needed.
    return {
      status: 'resolved',
      board,
      events: [
        {
          type: 'ANNIHILATION',
          at: siteA.to,
          color: siteA.piece.color,
          from: siteA.from,
          direction: siteA.direction,
          pushedByColor: siteA.pushedByColor,
          visualOrigin: siteA.visualOrigin,
        },
        {
          type: 'ANNIHILATION',
          at: siteB.to,
          color: siteB.piece.color,
          from: siteB.from,
          direction: siteB.direction,
          pushedByColor: siteB.pushedByColor,
          visualOrigin: siteB.visualOrigin,
        },
      ],
      nextSites: [],
    };
  }

  if (siteA.piece.color === 'rainbow' || siteB.piece.color === 'rainbow') {
    // Exactly one side is arcoíris (two-arcoíris already returned above) --
    // resolved as a two-step sequence that gives the player the advantage,
    // never the symmetric mutual push both other-colored pairs get below
    // (027-rainbow-attacker-only, research.md Decisión 3, confirmed
    // explicitly by the user). Step 1: arcoíris recolors `otherSite`, which
    // SETTLES right at the shared meeting cell (arcoíris never pushes, same
    // as everywhere else) -- `otherSite.to === rainbowSite.to` always, that's
    // the definition of a mutual collision. Step 2 (inside `resume`): the
    // just-chosen color acts as attacker on arcoíris itself, via
    // `applyChosenColorToRainbow`.
    const [rainbowSite, otherSite] = siteA.piece.color === 'rainbow' ? [siteA, siteB] : [siteB, siteA];

    if (otherSite.piece.fragility === 'broken') {
      // Same rule `strikeMutualSide` already applies to any already-`broken`
      // hitSite (research.md Decisión 3 of 019): it vanishes instead of
      // taking another hit, with no event at all -- confirmed for THIS
      // feature too (spec.md Edge Cases): the non-arcoíris side disappears
      // without ever receiving arcoíris's effect, and arcoíris itself never
      // gets a color to act on, so it disappears right along with it --
      // nothing left for either side to do.
      return { status: 'resolved', board, events: [], nextSites: [] };
    }

    const vanishedRainbow: ChainEvent = {
      type: 'ANNIHILATION',
      at: rainbowSite.to,
      color: rainbowSite.piece.color,
      from: rainbowSite.from,
      direction: rainbowSite.direction,
      pushedByColor: rainbowSite.pushedByColor,
      visualOrigin: rainbowSite.visualOrigin,
    };
    const pause = buildColorChoicePause(otherSite.piece, otherSite.to, vanishedRainbow, board);
    return {
      ...pause,
      resume: (color) => {
        const step1 = pause.resume(color);
        // `buildColorChoicePause`'s own `resume` never itself returns another
        // pause (research.md Decisión 3 of 024, unaffected by this feature) --
        // always 'resolved' here.
        if (step1.status !== 'resolved') {
          throw new Error("invariant violated: buildColorChoicePause's own resume paused again");
        }
        return applyChosenColorToRainbow(step1.board, rainbowSite, { color, fragility: otherSite.piece.fragility }, step1.events);
      },
    };
  }

  const resultA = strikeMutualSide(board, siteA, siteB);
  const resultB = strikeMutualSide(resultA.board, siteB, siteA);

  return {
    status: 'resolved',
    board: resultB.board,
    events: [...resultA.events, ...resultB.events],
    nextSites: [resultA.nextSite, resultB.nextSite].filter((site): site is ImpactSite => site !== null),
  };
}

/**
 * The second step of a rainbow-involved mutual collision (research.md
 * Decisión 3/4): `chosen` -- the color the player just picked for the OTHER
 * side, now already settled on `board` -- acts as attacker on `rainbowSite`
 * with ITS OWN mechanism. Negro gets a dedicated branch (line-clear, reusing
 * `clearLineFrom`) since `strikeMutualSide` has no other route to it; every
 * other color reuses `strikeMutualSide` as-is, synthesizing a `strikerSite`
 * from `rainbowSite` itself carrying the chosen color/fragility -- only
 * `.piece.color` and `.direction` are ever read from a `strikerSite` there,
 * so the synthetic `from`/`to` (identical to `rainbowSite`'s own, never
 * actually reached) are harmless.
 */
function applyChosenColorToRainbow(
  board: Board,
  rainbowSite: ImpactSite,
  chosen: Piece,
  eventsSoFar: ChainEvent[],
): ImpactResolution {
  if (chosen.color === 'black') {
    const triggerEvent: ChainEvent = {
      type: 'ANNIHILATION',
      at: rainbowSite.to,
      color: rainbowSite.piece.color,
      from: rainbowSite.from,
      direction: rainbowSite.direction,
      pushedByColor: rainbowSite.pushedByColor,
      visualOrigin: rainbowSite.visualOrigin,
    };
    const { board: clearedBoard, events } = clearLineFrom(board, rainbowSite.to, rainbowSite.direction, triggerEvent);
    return { status: 'resolved', board: clearedBoard, events: [...eventsSoFar, ...events], nextSites: [] };
  }
  const strikerSite: ImpactSite = { ...rainbowSite, piece: chosen };
  const result = strikeMutualSide(board, rainbowSite, strikerSite);
  return {
    status: 'resolved',
    board: result.board,
    events: [...eventsSoFar, ...result.events],
    nextSites: result.nextSite === null ? [] : [result.nextSite],
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
  visualOrigin?: { from: Coordinate; direction: Direction },
): ImpactResolution {
  const [first, second] = PERPENDICULAR_DIRECTIONS[direction];

  return resolveChain(
    board,
    [
      { piece: hitDefender, direction: first, from: position, to: stepBy(position, first, 1), visualOrigin },
      { piece: hitDefender, direction: second, from: position, to: stepBy(position, second, 1), visualOrigin },
    ],
    applyImpact,
    applyMutualImpact,
  );
}

/**
 * Prepends `prefix` to whatever events a (possibly still-pending)
 * `ImpactResolution` carries, leaving everything else untouched -- used to
 * thread a striker's own settle event onto red's split (024-rainbow-color-
 * change: the split's inner `resolveChain` may now itself pause, in which
 * case the prefix needs to survive across however many `resume` calls it
 * takes to finally resolve, not just the first one).
 */
export function withEventPrefix(prefix: ChainEvent[], result: ImpactResolution): ImpactResolution {
  if (result.status === 'resolved') {
    return { status: 'resolved', board: result.board, events: [...prefix, ...result.events], nextSites: result.nextSites };
  }
  return {
    status: 'pending-color-choice',
    board: result.board,
    events: [...prefix, ...result.events],
    at: result.at,
    options: result.options,
    resume: (color) => withEventPrefix(prefix, result.resume(color)),
  };
}

/**
 * Empties every occupied cell along the line an impact at `at`/`direction`
 * falls on, reporting `triggerEvent` first and one ANNIHILATION per swept
 * cell after -- negro's own primitive, extracted (027-rainbow-attacker-only,
 * research.md Decisión 3) so it can be reused both by `applyImpact`'s own
 * black-as-attacker branch AND by the new "negro as the chosen color" step of
 * a rainbow-involved mutual collision (`strikeMutualSide`'s new branch,
 * below) -- identical behavior, just no longer duplicated. `board` here is
 * always the board BEFORE this line is cleared -- `clearedCells` only ever
 * contains cells `clearLine` itself just found occupied there, never `null`,
 * see the throw below.
 */
function clearLineFrom(
  board: Board,
  at: Coordinate,
  direction: Direction,
  triggerEvent: ChainEvent,
): { board: Board; events: ChainEvent[] } {
  const { axis, index } = lineFromImpact(at, direction);
  const { board: clearedBoard, clearedCells } = clearLine(board, axis, index);
  const sweepEvents: ChainEvent[] = clearedCells.map((cell) => {
    const swept = getPieceAt(board, cell);
    /* c8 ignore next -- clearedCells only ever contains cells clearLine itself just found occupied */
    if (swept === null) throw new Error('invariant violated: clearedCells cell was not occupied');
    return { type: 'ANNIHILATION', at: cell, color: swept.color, from: cell, direction };
  });
  return { board: clearedBoard, events: [triggerEvent, ...sweepEvents] };
}

/**
 * Builds arcoíris's own effect -- a PAUSE asking the player which color
 * `defender` becomes, `vanishedAttacker` reported immediately (before the
 * pause opens, same reasoning as the inline version this replaces) and
 * `defender`'s own fragility carried through untouched (research.md Decisión
 * 6/11 of 024: a repaint, not a structural hit). Extracted
 * (027-rainbow-attacker-only, research.md Decisión 3) so the same pause can be
 * built either from a real, already-settled defender (`applyImpact`'s own
 * branch below) or from a piece that was only ever in-flight until this exact
 * instant (`applyMutualImpact`'s new rainbow branch, where `otherSite.piece`
 * never actually sat on `board` before settling here) -- both cases only ever
 * need `defender`'s color/fragility and the cell it settles at, never
 * anything else about how it got there.
 */
function buildColorChoicePause(
  defender: Piece,
  at: Coordinate,
  vanishedAttacker: ChainEvent,
  boardBeforePause: Board,
): Extract<ImpactResolution, { status: 'pending-color-choice' }> {
  const options: PieceColor[] = ['green', 'orange', 'brown', 'red', 'black'];
  const from = defender.color;
  const boardDuringPause = setPieceAt(boardBeforePause, at, null);

  const resume = (color: PieceColor): ImpactResolution => {
    const recolored: Piece = { color, fragility: defender.fragility };
    const boardAfter = setPieceAt(boardDuringPause, at, recolored);
    const colorChoiceEvent: ChainEvent = { type: 'COLOR_CHOICE', at, fromColor: from, toColor: color };
    return { status: 'resolved', board: boardAfter, events: [colorChoiceEvent], nextSites: [] };
  };

  return { status: 'pending-color-choice', board: boardDuringPause, events: [vanishedAttacker], at, options, resume };
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

export function applyImpact(board: Board, site: ImpactSite): ImpactResolution {
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
        return { status: 'resolved', board, events: [], nextSites: [nextSite] }; // still in flight -- no event yet
      }
    }

    // One of the two pieces a púrpura's attraction is pulling toward its own
    // settle cell (025-purple-attraction-piece, research.md Decisión 2) --
    // sibling of `walking` immediately above, but with a KNOWN destination and
    // an initial padding phase so both attracted sites, even starting at
    // different distances, finish their real advance on the exact same
    // `resolveChain` queue cycle. While padding, re-queue unchanged (no
    // movement, no event); once exhausted, advance one cell with plain
    // `step` -- deliberately NOT `stepWalking` (no wrap-around, no
    // edge-crossing cap: the path back to the attraction cell is always
    // in-bounds by construction, since both pieces were found by a bounded,
    // non-wrapping scan in the first place). Never resolves on its own --
    // `findCoincidingPair`/`applyMutualImpact` always intercepts the pair the
    // moment both `to` fields coincide on the (empty) attraction cell, before
    // either one would otherwise be dequeued again.
    if (site.attracting !== undefined) {
      if (site.attracting.padSteps > 0) {
        const nextSite: ImpactSite = { ...site, attracting: { padSteps: site.attracting.padSteps - 1 } };
        return { status: 'resolved', board, events: [], nextSites: [nextSite] };
      }
      const nextSite: ImpactSite = { ...site, to: step(site.to, site.direction) };
      return { status: 'resolved', board, events: [], nextSites: [nextSite] };
    }

    const { board: boardAfter, events } = settleOrVanish(
      board,
      site.piece,
      site.from,
      site.to,
      site.direction,
      false,
      site.pushedByColor,
      site.visualOrigin,
    );
    return { status: 'resolved', board: boardAfter, events, nextSites: [] };
  }

  if (defender.color === site.piece.color) {
    const boardAfter = setPieceAt(board, site.to, null);
    return {
      status: 'resolved',
      board: boardAfter,
      events: [
        {
          type: 'ANNIHILATION',
          at: site.to,
          color: site.piece.color,
          from: site.from,
          direction: site.direction,
          pushedByColor: site.pushedByColor,
          visualOrigin: site.visualOrigin,
        },
      ],
      nextSites: [],
    };
  }

  if (site.piece.color === 'black') {
    // Negro clears the whole line INSTEAD OF pushing/splitting/continuing --
    // but, since research.md (023) Decisión 7, only when negro ITSELF is the
    // one doing the impacting, exactly the same tier red's own split already
    // occupies (`site.piece.color === 'red'`, below): a real design
    // correction reported by the user -- negro used to ALSO dominate as the
    // DEFENDER (any color hitting a settled negro triggered the clear
    // immediately, regardless of that color's own mechanic), which made a
    // settled negro behave nothing like every other piece. Now a settled
    // negro struck by green/orange/brown/red/arcoíris just falls through to
    // the exact same generic paths below that ANY other defender color
    // already uses -- pushed same-direction, split perpendicular, recolored,
    // whichever that attacker's own mechanic dictates -- with its fragility
    // advancing normally along the way (`hitDefender`, below). Negro's own
    // effect only fires again if THAT displacement (or split) itself goes on
    // to land negro on top of a real, different-colored piece -- at which
    // point `site.piece.color === 'black'` becomes true for THAT new impact,
    // in negro's OWN direction of travel at that moment (inherited from
    // whichever attacker displaced it -- FR-002/FR-003's own convention,
    // unchanged). Landing on an empty cell instead never re-enters this
    // branch at all (`defender === null`, above) -- negro just settles like
    // any other piece, no line clear, exactly as the user described.
    //
    // The triggering piece (`site.piece`) is swept away too, FR-004 -- it
    // never actually gets written to `board` in this branch (unlike the
    // generic different-color path below, which always settles the striker
    // first), so `clearLine` only ever finds and removes REAL board pieces;
    // the trigger's own disappearance is reported as one more ANNIHILATION,
    // built separately from its own genuine from/direction.
    //
    // Each swept piece's own event uses `from === at` (FR-005: silent
    // disappearance, no fabricated travel -- data-model.md Decisión 1) --
    // none of them share a `from` with one another (each is its own cell),
    // so `computeEventParents` can't group them as siblings the way it does
    // a red split's two branches (which share one `from`). Its own orphan
    // fallback handles this correctly (launch-animation.ts, generalized for
    // this feature): consecutive events with no real causal match collapse
    // into one shared-parent sibling group instead of chaining onto each
    // other, so all four still animate together as one synchronized wipe.
    //
    // `triggerEvent` is listed FIRST, sweep events after -- not just
    // presentation order. When this interaction genuinely is the very start
    // of a hand launch (negro's own first hit, or another color's own first
    // hit landing on a settled negro), `triggerEvent` is the one whose `from`
    // can legitimately fall OFF the board (`resolve-launch.ts`'s own
    // `step(hitAt, opposite(direction))`, never wrapped, for an impact right
    // at the lane's own entry cell) -- exactly the case `playEventLog`'s
    // `isFirstEvent` entry glide already exists to handle, but ONLY for
    // whichever event ends up at index 0. Putting the sweep events first
    // used to leave `triggerEvent` off-board with no glide protection at
    // all -- a real bug found live (levels/2.json, orange sitting right at
    // the lane's own entry point): its circle spawned and stayed rendered
    // one cell outside the board. `clearLineFrom` (extracted,
    // 027-rainbow-attacker-only) preserves this ordering unchanged.
    const triggerEvent: ChainEvent = {
      type: 'ANNIHILATION',
      at: site.to,
      color: site.piece.color,
      from: site.from,
      direction: site.direction,
      pushedByColor: site.pushedByColor,
      visualOrigin: site.visualOrigin,
    };
    const { board: clearedBoard, events } = clearLineFrom(board, site.to, site.direction, triggerEvent);
    return { status: 'resolved', board: clearedBoard, events, nextSites: [] };
  }

  if (site.piece.color === 'rainbow') {
    // Arcoíris never pushes, splits, or clears a line -- its impact changes a
    // color instead, and needs the PLAYER to pick which one. Checked here,
    // right after negro's own (attacker-only, research.md 023 Decisión 7)
    // rule and before ANY color-specific striker mechanic (including red's
    // split below).
    //
    // Only the ATTACKER's identity ever triggers this -- a settled arcoíris
    // being struck (`defender.color === 'rainbow'`) is NO LONGER special
    // (027-rainbow-attacker-only, research.md Decisión 1): it falls through to
    // every generic branch below exactly like any other defender, deliberately
    // reversing FR-010 of 024-rainbow-color-change ("arcoíris asentada gana a
    // rojo") -- confirmed explicitly by the user ("las defensoras nunca
    // deberían aplicar efectos sobre las atacantes, al menos no directamente").
    // Negro-as-attacker still wins over arcoíris-as-defender unchanged (decided
    // by the branch order above, never by this condition).
    //
    // The DEFENDER -- whichever piece was already resting at `site.to` before
    // this impact -- is always the one whose color changes (research.md
    // Decisión 2 of 024, confirmed with the user: matches the original design
    // doc's own wording, "cambia el color de la ficha impactada"). The OTHER
    // piece (the attacker, `site.piece`) disappears, consumed by the effect --
    // FR-004 of 024, same pattern as negro's own disappearing trigger.
    // `buildColorChoicePause` (extracted, 027-rainbow-attacker-only) leaves the
    // defender's own fragility untouched (research.md Decisión 11 of 024): a
    // repaint, not a structural hit, unlike every other color's own impact.
    //
    // The attacker's own ANNIHILATION (its real travel to `at`, then vanish)
    // is emitted HERE, as part of the PENDING result -- not deferred into
    // `resume` -- so it plays out BEFORE the color dialog opens, exactly like
    // every other piece's impact fully resolving before its consequence is
    // shown. Real bug found live by the user: with this event deferred into
    // `resume`, the dialog popped up instantly, with no travel animation at
    // all -- `events[0]` of the pending result was empty, so `playEventLog`
    // had nothing to play before calling back. Putting it here also means
    // it's `events[0]` of the launch's OWN first segment when this genuinely
    // is the launch's first hit, so it still gets `isFirstEvent`'s entry-glide
    // protection for an off-board `from` (same reasoning as negro's own
    // `triggerEvent` reordering, push.ts's earlier fix) -- unaffected by this
    // change, since it's still `events[0]` either way.
    const vanishedEvent: ChainEvent = {
      type: 'ANNIHILATION',
      at: site.to,
      color: site.piece.color,
      from: site.from,
      direction: site.direction,
      pushedByColor: site.pushedByColor,
      visualOrigin: site.visualOrigin,
    };
    return buildColorChoicePause(defender, site.to, vanishedEvent, board);
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
    site.visualOrigin,
  );

  if (site.piece.color === 'red') {
    const splitResult = resolveRedSplit(boardWithStriker, hitDefender, site.to, site.direction);
    return withEventPrefix(strikerEvents, splitResult);
  }

  if (site.piece.color === 'purple') {
    // Confirmed unreachable in practice (025-purple-attraction-piece):
    // púrpura's own launch never enters `applyImpact` as a striker at all --
    // it has no mechanic against a real defender (spec.md FR-007), and its
    // settling condition/attraction effect are resolved entirely by
    // `scanPurpleSettle` before `resolveChain` ever starts (research.md,
    // Decisión 1). Enforced here as an explicit invariant, same pattern as
    // `strikeMutualSide`'s black/rainbow/purple checks above.
    throw new Error('invariant violated: purple cannot strike a real defender');
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
  return { status: 'resolved', board: boardWithStriker, events: strikerEvents, nextSites: [nextSite] };
}
