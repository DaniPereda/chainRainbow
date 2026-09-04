import type Phaser from 'phaser';
import type { AnnihilationEvent, Board, ChainEvent, Coordinate, Direction, EventLog, Goal, Launch, MoveStepEvent } from '../engine/index.js';
import { CELL_SIZE, PIECE_COLOR, drawBoard } from './board-view.js';
import { playGoalSound, playImpactSound, playJumpSound, playPurpleSound, playRainbowSound, playSplitSound } from './sound-effects.js';

// 018-piece-movement-animation refinement: slowed down twice, per two rounds of
// the user's own playtest (150ms -> 350ms -> 450ms, "todo un poco mas lento").
export const STEP_DURATION_MS = 450;

/**
 * Mirrors `launch.ts`'s own private `entryCoordinate` -- same tiny, stable
 * mapping, duplicated deliberately (Principle I; same precedent as
 * `tools/generator/obligations.ts`'s own copy of it) so the renderer can know
 * where a hand launch visually enters the board without the engine exposing
 * anything new. Used only to give the FIRST event of a launch's animation a
 * true edge-to-impact glide (018 refinement, user playtest request) --
 * `EventLog`'s own `from` for that first event is already one cell short of
 * the real entry (`resolve-launch.ts` computes it as `step(hitAt,
 * opposite(direction))`, not the entry edge itself).
 */
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

/** Wraps `n` into `[0, size)` -- same modulo convention as `wrapCoordinate` (board.ts). */
function wrapIndex(n: number, size: number): number {
  return ((n % size) + size) % size;
}

/** The shortest signed step count from `from` to `to` around a `size`-wide ring
 * (e.g. col 7 -> col 1 is +2, the short way through the wrap, not -6 the long way). */
function shortDelta(from: number, to: number, size: number): number {
  const raw = wrapIndex(to - from, size);
  return raw <= size / 2 ? raw : raw - size;
}

/**
 * If `from` -> `to` is a straight, exactly-2-cell displacement (orange's own
 * push distance, PUSH_STRATEGY.orange in src/engine/pieces/push.ts -- the only
 * strategy with that exact fixed distance), returns the cell in between that the
 * jump skips over; `null` for anything else (a 1-cell push, brown's variable
 * walk, or the launcher's own first entry). Every board move in this engine runs
 * along a single row or column, never both, so checking one axis at a time is
 * exhaustive.
 */
export function jumpMidpoint(from: Coordinate, to: Coordinate, size: number): Coordinate | null {
  if (from.row === to.row) {
    const delta = shortDelta(from.col, to.col, size);
    if (Math.abs(delta) !== 2) return null;
    return { row: from.row, col: wrapIndex(from.col + Math.sign(delta), size) };
  }
  if (from.col === to.col) {
    const delta = shortDelta(from.row, to.row, size);
    if (Math.abs(delta) !== 2) return null;
    return { row: wrapIndex(from.row + Math.sign(delta), size), col: from.col };
  }
  return null;
}

const DIRECTION_DELTA: Record<Direction, { row: number; col: number }> = {
  N: { row: -1, col: 0 },
  S: { row: 1, col: 0 },
  E: { row: 0, col: 1 },
  O: { row: 0, col: -1 },
};

function stepCoord(coord: Coordinate, direction: Direction, size: number): Coordinate {
  const delta = DIRECTION_DELTA[direction];
  return { row: wrapIndex(coord.row + delta.row, size), col: wrapIndex(coord.col + delta.col, size) };
}

/**
 * Every intermediate cell (and the final `to`) a piece passes through walking
 * from `from` in `direction`, one cell at a time -- used to animate a
 * multi-cell move (brown's variable walk, in particular) as a real sequence of
 * steps instead of a single tween spanning the whole distance (020-generator-
 * red-support playtest: brown's walk could cover many more cells than green's
 * fixed 1 or orange's fixed 2, but was animated in the exact same fixed
 * duration, making it look far faster than any other piece and, at a wrap,
 * visibly slide the wrong way across the board -- a straight-line pixel
 * interpolation has no notion of wrapping). `from` itself is excluded (the
 * piece is already there); capped at 3 board-widths of steps as a defensive
 * bound against ever looping forever -- no real event should need anywhere
 * near that many (MAX_EDGE_CROSSINGS in push.ts caps brown at 2 wraps).
 */
export function cellPath(from: Coordinate, to: Coordinate, direction: Direction, size: number): Coordinate[] {
  const path: Coordinate[] = [];
  let current = from;
  for (let i = 0; i < size * 3; i++) {
    current = stepCoord(current, direction, size);
    path.push(current);
    if (current.row === to.row && current.col === to.col) return path;
  }
  return path;
}

/**
 * Whether `coord` is a genuine board cell (both axes within `[0, size)`) --
 * mirrors `isInBounds` (board.ts), duplicated deliberately rather than
 * imported (Principle I, same precedent as `entryCoordinate`'s own comment).
 * A launch's real `event.from` (`step(hitAt, opposite(direction))`,
 * resolve-launch.ts) is ONE CELL BEHIND its first impact -- ordinarily still a
 * real cell, but `step` deliberately never wraps, so when the impact happens
 * on the very first cell of the lane (an immediate hit, nothing travelled
 * first), the cell "behind" it falls off the board entirely instead of
 * reappearing on the far edge. Used to recognize that case so the entry glide
 * is skipped rather than fed an unreachable off-board target -- a real bug
 * reported by the user: `cellPath` (below), stepping toward a target it can
 * never land on, ran its full `size*3` cap before giving up, visibly circling
 * the ENTIRE board three times before the piece's first real impact ever
 * played.
 */
function isOnBoard(coord: Coordinate, size: number): boolean {
  return coord.row >= 0 && coord.row < size && coord.col >= 0 && coord.col < size;
}

/**
 * Whether the single step from `from` to `to` crosses the board's edge (wraps
 * around) rather than moving to a literal neighboring cell -- a real same-
 * direction single step always changes exactly one axis by 1; anything larger
 * means the wrap kicked in. Used to snap instantly across a wrap instead of
 * sliding a tween across the whole board (there's no pixel-continuous way to
 * represent "the piece left one edge and reappeared on the other" as a slide).
 */
export function isWrapHop(from: Coordinate, to: Coordinate): boolean {
  return Math.abs(from.row - to.row) > 1 || Math.abs(from.col - to.col) > 1;
}

/**
 * The cell an orange-style jump should visually arc over, or `null` if `event`
 * isn't one -- unlike `jumpMidpoint` alone, this also checks `pushedByColor`,
 * not just geometry: a 2-cell displacement isn't necessarily orange's own
 * mechanic at work, since a struck defender moves using the STRIKER's
 * distance, not its own (a real bug found by playtesting: brown's variable
 * walk can coincidentally land on exactly 2 cells too, which used to make a
 * brown-pushed piece wrongly flash the orange bulge and play its sound).
 *
 * Takes a `MoveStepEvent` OR an `AnnihilationEvent` -- a piece orange pushed
 * its own 2-cell distance doesn't always end up SETTLING there (`MoveStepEvent`):
 * landing on a same-color piece, or (023-black-piece-line-clear, Decisión 7)
 * on a real defender that makes negro trigger its own line clear, are both
 * genuine jumps that end in an `ANNIHILATION` instead -- real bug reported by
 * the user ("no se ve saltar"): `AnnihilationEvent` never carried
 * `pushedByColor` at all, so this check always came back `null` for it,
 * silently falling back to a plain cell-by-cell walk no matter how far apart
 * `from`/`at` genuinely were.
 */
export function orangeJumpMidpoint(event: MoveStepEvent | AnnihilationEvent, size: number): Coordinate | null {
  if (event.pushedByColor !== 'orange') return null;
  const to = event.type === 'MOVE_STEP' ? event.to : event.at;
  return jumpMidpoint(event.from, to, size);
}

/**
 * Immutable single-cell write, tolerant of an out-of-bounds `coord` (a no-op) --
 * a `MOVE_STEP`'s `from` can legitimately sit one cell outside the board (the
 * position just before a launched piece enters, e.g. `{row: -1, col: 4}`), which
 * never represents a real cell to clear or fill.
 */
function setCell(board: Board, coord: Coordinate, piece: Board['cells'][number][number]): Board {
  if (coord.row < 0 || coord.row >= board.size || coord.col < 0 || coord.col >= board.size) {
    return board;
  }
  const cells = board.cells.map((row) => row.slice());
  cells[coord.row][coord.col] = piece;
  return { size: board.size, cells };
}

/**
 * Applies one `ChainEvent` to a `Board`, with exactly the same write semantics
 * `settleOrVanish`/`applyImpact` already use in the engine (`src/engine/pieces/push.ts`)
 * -- duplicated here deliberately (Principle I: the renderer never imports the
 * engine's resolution logic, only its output types) rather than shared, so this
 * stays a pure presentation-layer reproduction, not a second code path feeding
 * back into the engine.
 *
 * Deliberately does NOT clear `event.from` -- `settleOrVanish` never does either
 * (it only ever writes `to`). `from` is documentary (where this piece arrived
 * from), not an instruction to vacate a cell: for a linear chain, that cell gets
 * overwritten by the very next event's own `to` (the piece that displaced this
 * one settling there); for the first hop of each branch of a red split, `from`
 * is the split point itself, which red legitimately continues to occupy for
 * good (FR-007 of 009-red-piece) -- clearing it would erase red by mistake.
 *
 * Reducing a full `EventLog` over the board from just before a launch
 * (`events.reduce(replayEvent, boardBeforeLaunch)`) produces exactly the same
 * final `Board` that `resolveLaunch` already returned for that launch
 * (018-piece-movement-animation, data-model.md) -- verified directly against
 * `settleOrVanish`'s actual write ("only `to` is ever written") before writing
 * this, not assumed from the event shape alone.
 */
export function replayEvent(board: Board, event: ChainEvent): Board {
  if (event.type === 'MOVE_STEP') {
    if (event.piece.fragility === 'broken') {
      return board; // never settles -- same rule as settleOrVanish (016)
    }
    return setCell(board, event.to, event.piece);
  }
  if (event.type === 'COLOR_CHOICE') {
    // Fragility is read off the board being replayed rather than carried on
    // the event itself (024-rainbow-color-change never changes it, research.md
    // Decisión 2's "repaint, not a structural hit") -- avoids widening
    // `ColorChoiceEvent` just to duplicate data this reducer can already see.
    const existing = board.cells[event.at.row][event.at.col];
    return setCell(board, event.at, { color: event.toColor, fragility: existing?.fragility ?? 'new' });
  }
  return setCell(board, event.at, null); // ANNIHILATION
}

/**
 * Whether `event` is red settling with a real collision -- the exact moment
 * `applyImpact` (src/engine/pieces/push.ts) triggers `resolveRedSplit`
 * (009-red-piece/020-generator-red-support): a MOVE_STEP for a red piece
 * (`hasCollision: true`) is always immediately followed by the split's own
 * branch events in the log. Red settling into empty space (`hasCollision:
 * false`) never splits anything, so it's excluded here too -- checked ahead of
 * `jumpMidpoint` in `playEventLog` since a split can coincidentally travel an
 * orange-style 2-cell distance (jumpMidpoint is purely geometric, not
 * color-aware), and this sound takes priority over both the generic impact and
 * the jump sound either way.
 */
export function isRedSplitTrigger(event: ChainEvent): boolean {
  return event.type === 'MOVE_STEP' && event.piece.color === 'red' && event.hasCollision;
}

export function pixelCenter(coord: Coordinate): { x: number; y: number } {
  return { x: coord.col * CELL_SIZE + CELL_SIZE / 2, y: coord.row * CELL_SIZE + CELL_SIZE / 2 };
}

/**
 * The cell an event visually originates from -- `from` for a `MOVE_STEP`/
 * `AnnihilationEvent`, or `at` for a `ColorChoiceEvent` (024-rainbow-color-
 * change: it never travels, so its own cell IS its origin, same treatment as
 * an `ANNIHILATION` with `from === at`). Centralizes the one place that needs
 * to know all three variants share "a cell this event is anchored to", so the
 * rest of this file can keep treating `ChainEvent.from` as if it were still
 * universal.
 */
function eventOrigin(event: ChainEvent): Coordinate {
  return event.type === 'COLOR_CHOICE' ? event.at : event.from;
}

/**
 * For every event, the index of its causal predecessor -- the most recent
 * EARLIER event whose arrival cell (`to` for a MOVE_STEP; an ANNIHILATION never
 * has one, since annihilating ends a trajectory rather than handing it off) is
 * exactly this event's own `from`. `null` means nothing in the log arrived
 * where this event starts -- true only for the very first event (the launch's
 * own entry).
 *
 * A `from` is a real board cell, occupied by exactly one physical piece at a
 * time, so at most one earlier event can be "who's there right now" -- taking
 * the NEAREST match (not just any) is what makes this correct even when a cell
 * is visited more than once over the course of a cascade (e.g. a brown walk's
 * own full-lap return to its striker's cell, `cellPath`'s own test fixture).
 *
 * Two (or more) events sharing the same parent are SIBLINGS -- born at the same
 * instant. In practice the only way that happens is a red split (009-red-piece):
 * both branches' fixed first hop starts from the very same split-point cell.
 * Found as a real bug reported by the user: the two branches are computed and
 * queued together (019-synchronous-tick-resolution) and can even genuinely
 * collide with each other (021-cellwise-collision-resolution), but the
 * renderer used to animate the whole flat `EventLog` with a single temporary
 * circle, one event fully finished before the next started -- so only ONE
 * branch was ever seen moving, never both at once, however truly simultaneous
 * they are underneath. `playEventLog` uses this to fan out into concurrent
 * animation lanes at exactly the points where the underlying trajectories
 * really did fork, instead of forcing everything into one sequential timeline.
 */
export function computeEventParents(events: EventLog): (number | null)[] {
  const parents: (number | null)[] = events.map(() => null);

  // The first (earliest-indexed) event to originate at each distinct `from`
  // cell -- every OTHER event sharing that exact cell was born at the same
  // instant as it, a SIBLING, regardless of whether any earlier event's `to`
  // ever matches it. A red split's two branches are one case of this (their
  // shared parent's `to` DOES match, found below) -- but a mutual in-flight
  // collision's resulting trajectories (`applyMutualImpact`/`strikeMutualSide`,
  // push.ts) are the other: two REAL trajectories can converge and meet at a
  // cell that neither of them ever "arrives at" as its own recorded event (the
  // meeting point is never settled, only continued from or split at), so nothing
  // in the log ever has a `to` equal to that meeting cell -- yet two or three
  // resulting events can still all share it as their own `from`. Grouping by
  // `from` FIRST is what lets those be recognized as siblings at all, instead
  // of each independently failing to find a parent.
  const groupLeader: number[] = events.map(() => -1);
  for (let j = 0; j < events.length; j++) {
    if (groupLeader[j] !== -1) continue;
    groupLeader[j] = j;
    for (let k = j + 1; k < events.length; k++) {
      if (
        groupLeader[k] === -1 &&
        eventOrigin(events[k]).row === eventOrigin(events[j]).row &&
        eventOrigin(events[k]).col === eventOrigin(events[j]).col
      ) {
        groupLeader[k] = j;
      }
    }
  }

  // Whether a leader's own `parents[]` entry came from a genuine `to` match
  // (false) or from the "no match, fall back" case below (true). Threaded
  // through so a RUN of consecutive orphaned leaders (e.g. a line clear's
  // many swept, unrelated cells -- 023-black-piece-line-clear, none of them
  // share a `from` with each other, so the `from`-grouping above can't catch
  // them as siblings) collapses into ONE shared-parent group instead of
  // chaining each one onto the previous, real bug found live: four unrelated
  // pieces swept by the same line clear animated one after another, each
  // waiting for the last, instead of together.
  //
  // Index 0 is deliberately left `false` (its default) rather than seeded
  // `true` -- a second real bug found live by the user, this time for negro:
  // event 0 (the triggering piece's own real travel to the impact cell) is
  // never itself "one of these orphans" in the sense that matters for j=1's
  // fallback below, even though it also has no predecessor of its own. Only
  // whether events 1..n *chain onto* event 0 (fine: `wasOrphan[0]` false ->
  // `parents[1] = 0`, waits for event 0 to actually arrive) or *skip past* it
  // to become a second, independent root (wrong: seeding it `true` made every
  // swept cell start at the very instant the launch began, alongside the
  // triggering piece's own still-in-progress travel -- so a whole row/column
  // visibly cleared before the piece that caused it had even arrived, and
  // regardless of whether that piece ended up striking or being struck).
  const wasOrphan: boolean[] = events.map(() => false);

  for (let j = 1; j < events.length; j++) {
    if (groupLeader[j] !== j) {
      // A follower: born at the same instant as its group's leader, so it
      // depends on exactly the same predecessor the leader does (computed
      // below, since the leader's own index is always < j).
      parents[j] = parents[groupLeader[j]];
      wasOrphan[j] = wasOrphan[groupLeader[j]];
      continue;
    }

    let found = false;
    for (let i = j - 1; i >= 0; i--) {
      const candidate = events[i];
      if (candidate.type !== 'MOVE_STEP') continue;
      const origin = eventOrigin(events[j]);
      if (candidate.to.row === origin.row && candidate.to.col === origin.col) {
        parents[j] = i;
        found = true;
        break;
      }
    }
    if (found) continue;

    // No earlier event ever arrived here -- either a mutual collision's
    // meeting point (never itself recorded as an event, see above), or one
    // of several unrelated cells removed together by the same single-cause
    // interaction (line clear). If the immediately preceding event was
    // ITSELF one of these orphans, adopt its own parent instead of chaining
    // onto it directly -- that's what makes a whole run of orphans siblings
    // of each other (and of whatever real event precedes the run) rather
    // than a serial chain. Falling back at all (rather than leaving this an
    // unconditional root) keeps the group causally AFTER everything already
    // resolved so far in the log, instead of starting to animate at the very
    // instant the whole launch does (real bug reported by the user: pieces
    // near an unrelated part of the board visibly moving while the
    // actually-launched piece was still only partway through its own,
    // entirely separate, path).
    parents[j] = wasOrphan[j - 1] ? parents[j - 1] : j - 1;
    wasOrphan[j] = true;
  }

  return parents;
}

/**
 * Reproduces `events` visually as a tree of concurrent animation lanes, rooted
 * at the launch's own entry -- `computeEventParents` finds where the underlying
 * trajectories really fork (a red split's two branches, born from the same
 * cell at the same instant), and each such fork gets played as two (or more)
 * simultaneously-running temporary circles instead of one global sequential
 * queue (real bug reported by the user: "solo se ve una de las ramas moverse").
 * A child lane only starts once its parent event has fully finished -- it can't
 * move before whatever put it in motion has itself arrived -- but siblings with
 * no dependency on each other run truly in parallel, each with its own
 * `Phaser.GameObjects.Arc` (never a persistent per-piece GameObject -- research.md,
 * Decisión 1). A `MOVE_STEP` walks its circle from `from` to `to`, one cell at a
 * time; an `ANNIHILATION` walks it the same way from `from` to `at`, then fades
 * it out there (and, having no `to`, never parents anything -- annihilating
 * ends a trajectory). Between events, the static layer (`boardGraphics`) is
 * redrawn via `drawBoard` against a board copy advanced with `replayEvent` --
 * since that reducer only ever writes `to`/`at` (never clears `from`, see its
 * own comment), the static layer is already accurate at every step with no
 * extra bookkeeping here, and two concurrent siblings never race on the same
 * cell (their `to`/`at` are necessarily distinct -- that's exactly what makes
 * them independent branches instead of a mutual collision). The one accepted
 * visual simplification (research.md, Decisión 1): a step's temporary circle
 * spawns on top of whatever the static layer already shows at `from` (typically
 * the piece that just struck this one, already settled there a step earlier) --
 * a brief overlap at the moment of impact, not a bug. Calls `onDone` once every
 * lane has finished (or immediately, with no animation, if `events` is empty --
 * FR-004, the missclick case).
 *
 * `launch` (the confirmed direction/lane) is used only to give the very FIRST
 * event of the log a true edge-to-impact glide before its own normal animation
 * -- see `entryCoordinate`'s own comment (018 refinement, user playtest
 * request: "que la animación empezara en la casilla 0 desde el lanzamiento de
 * la mano").
 *
 * `isFirstSegment` (default `true`) gates that same glide -- 024-rainbow-
 * color-change is the first feature to call this function more than once for
 * a SINGLE launch (once per pause/resume around a color choice, `BoardScene`),
 * passing only the NEW slice of events each time. Node 0 of a later slice is
 * never the launch's own true entry (that already played in an earlier call),
 * so the caller passes `false` for every call after the first to suppress the
 * edge glide -- without this, each resumed segment would incorrectly glide
 * its first event in from the board's outer edge all over again.
 */
export function playEventLog(
  scene: Phaser.Scene,
  boardGraphics: Phaser.GameObjects.Graphics,
  goal: Goal,
  boardBeforeLaunch: Board,
  launch: Launch,
  events: EventLog,
  onDone: () => void,
  isFirstSegment = true,
): void {
  if (events.length === 0) {
    onDone();
    return;
  }

  let board = boardBeforeLaunch;

  const parents = computeEventParents(events);
  const children: number[][] = events.map(() => []);
  for (let j = 0; j < events.length; j++) {
    const parent = parents[j];
    if (parent !== null) children[parent].push(j);
  }
  const roots = events.map((_, i) => i).filter((i) => parents[i] === null);

  // The number of cells this NON-first event travels before reaching the
  // point where it should be visually synchronized with its siblings -- used
  // only to pad SIBLING events that share a convergence point but travelled
  // different real distances to reach it (025-purple-attraction-piece:
  // research.md Decisión 2's own "wait for each other" only applies to the
  // ENGINE's event ordering; without this, the renderer had no idea two
  // siblings needed to visually arrive together too). Two distinct shapes,
  // both real bugs reported live by the user testing púrpura:
  // - `event.visualOrigin` present: the "lead-in glide" case (a mutual
  //   collision's DIFFERENT-color continuation, `strikeMutualSide` --
  //   `event.from` was rewritten to the meeting cell, the true pre-collision
  //   origin only survives in `visualOrigin`). The synchronizable segment is
  //   that lead-in (`visualOrigin.from` -> `eventOrigin(event)`) -- whatever
  //   the event does AFTER reaching it (its own post-collision leg) is no
  //   longer part of the shared moment and mustn't be synced too. First bug:
  //   the closer piece bred through the meeting cell and kept going alone
  //   while the farther one was still catching up.
  // - No `visualOrigin`: the event's OWN `from` already IS the true origin
  //   (a mutual collision's SAME-color case, `applyMutualImpact` -- two
  //   genuinely different origins, each with its own real ANNIHILATION event,
  //   converging directly on the shared `at` with no separate leg at all).
  //   The synchronizable segment is the whole thing, `from` -> `to`/`at`.
  //   Second bug, found immediately after fixing the first: the SHORTER of
  //   these two would fade out alone while the longer one was still walking,
  //   because this function used to return 0 for anything without a
  //   `visualOrigin` at all, never accounting for this shape.
  function syncTravelCellCount(nodeIndex: number): number {
    const event = events[nodeIndex];
    if (event.type === 'COLOR_CHOICE') return 0;
    const origin = eventOrigin(event);
    if (!isOnBoard(origin, board.size)) return 0;

    if (event.visualOrigin) {
      if (event.visualOrigin.from.row === origin.row && event.visualOrigin.from.col === origin.col) return 0;
      return cellPath(event.visualOrigin.from, origin, event.visualOrigin.direction, board.size).length;
    }

    const destination = event.type === 'MOVE_STEP' ? event.to : event.at;
    if (destination.row === origin.row && destination.col === origin.col) return 0;
    return cellPath(origin, destination, event.direction, board.size).length;
  }

  function playNode(nodeIndex: number, waitCells: number, onNodeDone: () => void): void {
    const isFirstEvent = isFirstSegment && nodeIndex === 0;
    const event = events[nodeIndex];
    const piece =
      event.type === 'MOVE_STEP'
        ? event.piece
        : event.type === 'COLOR_CHOICE'
          ? { color: event.fromColor, fragility: 'new' as const }
          : { color: event.color, fragility: 'new' as const };
    const from = eventOrigin(event);

    drawBoard(boardGraphics, board, goal);

    // Two distinct sources of a "lead-in glide" before this event's own normal
    // animation: the very first event of a launch glides in from the board's
    // own edge (its own `from` is already one cell short of it -- see
    // entryCoordinate's comment); any event, first or not, whose piece was
    // actually travelling through cells its own from/direction alone can't
    // reconstruct glides in from `event.visualOrigin` instead -- a
    // brown-driven walk redirected by a mutual collision (push.ts's
    // `strikeMutualSide`), whose true origin the engine would otherwise
    // discard in favor of the meeting cell. At most one ever applies to a
    // given event -- the very first event of a launch is never ALSO the
    // product of an in-flight mutual collision, nothing has moved yet.
    const leadIn = isFirstEvent
      ? { from: entryCoordinate(launch.direction, launch.lane), direction: launch.direction }
      : event.type === 'COLOR_CHOICE'
        ? undefined
        : event.visualOrigin;
    const spawnAt = leadIn ? leadIn.from : from;
    const start = pixelCenter(spawnAt);
    const radius = CELL_SIZE / 2 - 6;
    const temp = scene.add.circle(
      boardGraphics.x + start.x,
      boardGraphics.y + start.y,
      radius,
      PIECE_COLOR[piece.color],
    );

    const finish = (): void => {
      temp.destroy();
      board = replayEvent(board, event);
      drawBoard(boardGraphics, board, goal);
      const kids = children[nodeIndex];
      if (kids.length === 0) {
        onNodeDone();
        return;
      }
      // Every child starts here, at the same instant -- this is the fork
      // itself (a red split's two branches, or two mutual-collision sides
      // converging on the same cell, in practice the only sources of more
      // than one child). `onNodeDone` fires only once ALL of them (and
      // whatever they in turn fork into) have finished. Siblings can have
      // travelled different REAL distances to reach this shared origin (a
      // red split's branches never do -- same fixed 1-cell hop both sides --
      // but púrpura's two attracted pieces routinely do) -- `waitCells`
      // pads whichever ones are shorter so all of them visibly arrive at
      // the shared cell together before any of them proceeds, instead of
      // the closer one breezing through alone while the others catch up.
      const syncLengths = kids.map(syncTravelCellCount);
      const maxSyncCells = Math.max(...syncLengths);
      let remaining = kids.length;
      kids.forEach((childIndex, i) => {
        playNode(childIndex, maxSyncCells - syncLengths[i], () => {
          remaining -= 1;
          if (remaining === 0) onNodeDone();
        });
      });
    };

    // Walks `temp` through `path` one cell at a time, each taking exactly
    // STEP_DURATION_MS -- the SAME per-cell speed regardless of how many
    // cells this particular move covers (a 1-cell push already reduces to
    // exactly one such tween), and regardless of whether a given cell is a
    // normal step or a wrap hop: there's still no continuous pixel path
    // across a wrap, so it still snaps instead of sliding across the whole
    // board, but only after spending its own STEP_DURATION_MS on a deferred
    // timer instead of repositioning synchronously (real bug reported by the
    // user: a synchronous snap could finish inside the very same tick that
    // created `temp`, before Phaser ever rendered a frame of it -- so a step
    // that was ENTIRELY a wrap hop, start to finish, was never actually seen
    // at all, even though it settled correctly). `startFrom` is parameterized
    // (rather than always `event.from`) so this same walker can also animate
    // the entry glide -- from the board's own edge (`entryCoordinate`) to
    // `event.from` -- at this identical speed. Shared between a normal
    // MOVE_STEP and an ANNIHILATION -- both are "a piece travels from `from`
    // to some cell", they only differ in what happens once it arrives (settle
    // vs fade).
    const walkPath = (path: Coordinate[], startFrom: Coordinate, onArrive: () => void): void => {
      const stepThrough = (index: number, from: Coordinate): void => {
        if (index >= path.length) {
          onArrive();
          return;
        }
        const cell = path[index];
        const pixel = pixelCenter(cell);
        if (isWrapHop(from, cell)) {
          scene.time.delayedCall(STEP_DURATION_MS, () => {
            temp.x = boardGraphics.x + pixel.x;
            temp.y = boardGraphics.y + pixel.y;
            stepThrough(index + 1, cell);
          });
          return;
        }
        scene.tweens.add({
          targets: temp,
          x: boardGraphics.x + pixel.x,
          y: boardGraphics.y + pixel.y,
          duration: STEP_DURATION_MS,
          onComplete: () => stepThrough(index + 1, cell),
        });
      };
      stepThrough(0, startFrom);
    };

    // Orange's own 2-cell push -- a visible hop over the skipped cell, called
    // out with its own highlight marker there (018-piece-movement-animation
    // refinement, user playtest request). The bulge is always PERPENDICULAR
    // to the direction of travel: a horizontal jump (moving along a row)
    // bulges up (a `y` offset); a vertical jump (moving along a column)
    // bulges right (an `x` offset) -- offsetting `y` for a vertical jump
    // would just look like moving faster along the same line, not an arc
    // (second round of playtest refinement). Each half of the arc
    // (spawn->midpoint, midpoint->end) takes a FULL STEP_DURATION_MS, not
    // half of it -- this covers 2 real cells, so at the SAME per-cell speed
    // as every other move it takes 2*STEP_DURATION_MS total, not
    // STEP_DURATION_MS (real bug reported by the user: the jump used to
    // cover its 2 cells in the same total time a 1-cell move takes,
    // effectively moving twice as fast per cell as anything else). Shared
    // between a MOVE_STEP that settles at `to` and an ANNIHILATION that
    // instead fades once it arrives -- real bug reported by the user ("no se
    // ve saltar"): a piece pushed orange's own distance into a same-color
    // piece (or, since 023 Decisión 7, into a real defender that makes negro
    // trigger its own line clear) genuinely jumped 2 cells, but had no way to
    // get this treatment before `AnnihilationEvent` carried `pushedByColor`.
    const playOrangeJump = (from: Coordinate, to: Coordinate, midpoint: Coordinate, onArrive: () => void): void => {
      const end = pixelCenter(to);
      const mid = pixelCenter(midpoint);
      const hopOffset = CELL_SIZE * 0.4;
      const isVerticalJump = from.col === to.col;
      const midX = boardGraphics.x + mid.x + (isVerticalJump ? hopOffset : 0);
      const midY = boardGraphics.y + mid.y - (isVerticalJump ? 0 : hopOffset);
      const marker = scene.add
        .circle(boardGraphics.x + mid.x, boardGraphics.y + mid.y, radius * 0.5, 0xffffff, 0.9)
        .setScale(0);
      scene.tweens.add({
        targets: marker,
        scale: 1,
        alpha: 0,
        duration: STEP_DURATION_MS * 2,
        onComplete: () => marker.destroy(),
      });
      scene.tweens.add({
        targets: temp,
        x: midX,
        y: midY,
        duration: STEP_DURATION_MS,
        ease: 'Sine.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: temp,
            x: boardGraphics.x + end.x,
            y: boardGraphics.y + end.y,
            duration: STEP_DURATION_MS,
            ease: 'Sine.easeIn',
            onComplete: onArrive,
          });
        },
      });
    };

    // `waitCells` (computed by the caller from `syncTravelCellCount`)
    // synchronizes this node's own arrival at wherever its siblings need to
    // meet it, with a stationary pause -- fired at most ONCE, at whichever of
    // two points is genuinely this event's own convergence moment: right
    // after its lead-in glide (below, when `leadIn` gives it a separate
    // pre-collision segment) if it has one, or right after its own
    // walk/jump/immediate-fade arrives (inside `runEvent`'s own branches,
    // when there's no separate lead-in and the event's own from -> to/at IS
    // that journey -- e.g. a same-color mutual annihilation's two genuinely
    // different origins). Never fires twice for the same node -- a leadIn
    // glide already consumes it before `runEvent` even starts.
    let waitFired = false;
    const afterArrival = (callback: () => void): void => {
      if (waitFired || waitCells === 0) {
        callback();
        return;
      }
      waitFired = true;
      scene.time.delayedCall(waitCells * STEP_DURATION_MS, callback);
    };

    const runEvent = (): void => {
      if (event.type === 'COLOR_CHOICE') {
        // No travel to animate -- the defender never moves (024-rainbow-
        // color-change, FR-007); the attacker's own travel and disappearance
        // is a SEPARATE, already-real ANNIHILATION event (push.ts orders it
        // first). This one just flips the circle already sitting at `at` from
        // its old color to the chosen one: shrink, swap the fill, grow back
        // -- a discrete swap rather than a continuous color tween, which
        // would need to fight Phaser's plain numeric interpolation blending
        // RGB channels incorrectly for two arbitrary packed hex colors.
        playRainbowSound();
        scene.tweens.add({
          targets: temp,
          scale: 0,
          duration: STEP_DURATION_MS / 2,
          onComplete: () => {
            temp.fillColor = PIECE_COLOR[event.toColor];
            scene.tweens.add({ targets: temp, scale: 1, duration: STEP_DURATION_MS / 2, onComplete: finish });
          },
        });
        return;
      }

      if (event.type === 'ANNIHILATION') {
        const fade = (): void => {
          scene.tweens.add({ targets: temp, alpha: 0, scale: 0, duration: STEP_DURATION_MS, onComplete: finish });
        };

        if (event.from.row === event.at.row && event.from.col === event.at.col) {
          // No real travel to animate -- `from === at` by design for a piece
          // swept by a line clear (023-black-piece-line-clear) that never
          // moved at all. Real bug found live: feeding this to `cellPath`
          // asked it to step AWAY from `at` and find its way back to it,
          // which it can only ever do by looping all the way around the
          // board (`current` never equals `to` until a full lap completes) --
          // it walked a visible full lap before fading instead of just
          // fading in place. Fading immediately is also simply the correct
          // animation for zero real distance, independent of this bug.
          if (event.color === 'purple') playPurpleSound();
          else playImpactSound();
          afterArrival(fade);
          return;
        }

        const jumpMid = orangeJumpMidpoint(event, board.size);
        if (jumpMid !== null) {
          // Same jump this piece would have gotten had it settled instead of
          // annihilating (a same-color collision, or -- 023 Decisión 7 --
          // negro's own trigger after being pushed into a real defender):
          // `from`/`at` really are 2 cells apart via orange's own mechanic.
          playJumpSound();
          playOrangeJump(event.from, event.at, jumpMid, () => afterArrival(fade));
          return;
        }

        // Real bug found by the user: this used to fade `temp` out right where
        // it spawned, never visibly travelling to `at` first -- a same-color
        // collision looked like the piece popped into existence already
        // annihilating, instead of arriving there like any other impact.
        // A púrpura's own ANNIHILATION always takes this path (real travel,
        // never a 2-cell orange jump) -- its activation sound plays here
        // instead of the generic impact sound (025-purple-attraction-piece,
        // research.md Decisión 4). `afterArrival(fade)` -- not a bare `fade`
        // -- is what makes a same-color mutual annihilation's two separate
        // events (one per real side, since the fix above) wait for each
        // other here instead of the shorter one fading out alone.
        if (event.color === 'purple') playPurpleSound();
        else playImpactSound();
        const path = cellPath(event.from, event.at, event.direction, board.size);
        walkPath(path, event.from, () => afterArrival(fade));
        return;
      }

      const isRedSplit = isRedSplitTrigger(event);
      const midpoint = orangeJumpMidpoint(event, board.size);

      if (midpoint === null) {
        if (isRedSplit) playSplitSound();
        else if (event.hasCollision) playImpactSound();

        const path = cellPath(event.from, event.to, event.direction, board.size);
        walkPath(path, event.from, () => afterArrival(finish));
        return;
      }

      if (isRedSplit) playSplitSound();
      else playJumpSound();
      playOrangeJump(event.from, event.to, midpoint, () => afterArrival(finish));
    };

    if (
      leadIn &&
      isOnBoard(eventOrigin(event), board.size) &&
      (leadIn.from.row !== eventOrigin(event).row || leadIn.from.col !== eventOrigin(event).col)
    ) {
      // Same per-cell walk, same constant speed, as every other move -- covers
      // the lead-in glide one cell at a time instead of a single
      // fixed-duration tween spanning however many cells happen to separate
      // them, or popping into existence right where `event.from` begins (two
      // real bugs reported by the user: a launch with a long empty run before
      // its first impact covered far more distance in the same 450ms than a
      // short one; and a mutual collision's resulting trajectory skipped the
      // whole walk that led to the meeting point, popping in there directly).
      // `afterArrival(runEvent)` -- not a bare `runEvent` -- is what makes a
      // SHORTER lead-in among siblings wait here for a longer one instead of
      // carrying straight on to its own post-collision leg alone.
      const entryPath = cellPath(leadIn.from, eventOrigin(event), leadIn.direction, board.size);
      walkPath(entryPath, leadIn.from, () => afterArrival(runEvent));
      return;
    }

    runEvent();
  }

  let remainingRoots = roots.length;
  for (const rootIndex of roots) {
    playNode(rootIndex, 0, () => {
      remainingRoots -= 1;
      if (remainingRoots === 0) onDone();
    });
  }
}
