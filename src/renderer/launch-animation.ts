import type Phaser from 'phaser';
import type { Board, ChainEvent, Coordinate, Direction, EventLog, Goal, Launch, MoveStepEvent } from '../engine/index.js';
import { CELL_SIZE, PIECE_COLOR, drawBoard } from './board-view.js';
import { playGoalSound, playImpactSound, playJumpSound, playSplitSound } from './sound-effects.js';

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
 */
export function orangeJumpMidpoint(event: MoveStepEvent, size: number): Coordinate | null {
  if (event.pushedByColor !== 'orange') return null;
  return jumpMidpoint(event.from, event.to, size);
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
        events[k].from.row === events[j].from.row &&
        events[k].from.col === events[j].from.col
      ) {
        groupLeader[k] = j;
      }
    }
  }

  for (let j = 1; j < events.length; j++) {
    if (groupLeader[j] !== j) {
      // A follower: born at the same instant as its group's leader, so it
      // depends on exactly the same predecessor the leader does (computed
      // below, since the leader's own index is always < j).
      parents[j] = parents[groupLeader[j]];
      continue;
    }

    let found = false;
    for (let i = j - 1; i >= 0; i--) {
      const candidate = events[i];
      if (candidate.type !== 'MOVE_STEP') continue;
      if (candidate.to.row === events[j].from.row && candidate.to.col === events[j].from.col) {
        parents[j] = i;
        found = true;
        break;
      }
    }
    // No earlier event ever arrived here -- a mutual collision's meeting
    // point, never itself recorded as an event (see above). Falling back to
    // the immediately preceding event keeps this group causally AFTER
    // everything already resolved so far in the log, instead of treating it
    // as an unconditional second root that would otherwise start animating
    // at the very instant the whole launch does (real bug reported by the
    // user: pieces near an unrelated part of the board visibly moving while
    // the actually-launched piece was still only partway through its own,
    // entirely separate, path).
    if (!found) {
      parents[j] = j - 1;
    }
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
 */
export function playEventLog(
  scene: Phaser.Scene,
  boardGraphics: Phaser.GameObjects.Graphics,
  goal: Goal,
  boardBeforeLaunch: Board,
  launch: Launch,
  events: EventLog,
  onDone: () => void,
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

  function playNode(nodeIndex: number, onNodeDone: () => void): void {
    const isFirstEvent = nodeIndex === 0;
    const event = events[nodeIndex];
    const piece = event.type === 'MOVE_STEP' ? event.piece : { color: event.color, fragility: 'new' as const };
    const from = event.from;

    drawBoard(boardGraphics, board, goal);

    // The first event's own `from` is already one cell short of the real board
    // edge (see entryCoordinate's comment) -- spawn there instead, and glide to
    // the real `from` before running this event's normal animation, so a hand
    // launch is visibly seen entering from the edge, not popping into being
    // right next to its first impact.
    const spawnAt = isFirstEvent ? entryCoordinate(launch.direction, launch.lane) : from;
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
      // itself (a red split's two branches, in practice the only source of
      // more than one child). `onNodeDone` fires only once ALL of them (and
      // whatever they in turn fork into) have finished.
      let remaining = kids.length;
      for (const childIndex of kids) {
        playNode(childIndex, () => {
          remaining -= 1;
          if (remaining === 0) onNodeDone();
        });
      }
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

    const runEvent = (): void => {
      if (event.type === 'ANNIHILATION') {
        playImpactSound();
        // Real bug found by the user: this used to fade `temp` out right where
        // it spawned, never visibly travelling to `at` first -- a same-color
        // collision looked like the piece popped into existence already
        // annihilating, instead of arriving there like any other impact.
        const path = cellPath(event.from, event.at, event.direction, board.size);
        walkPath(path, event.from, () => {
          scene.tweens.add({ targets: temp, alpha: 0, scale: 0, duration: STEP_DURATION_MS, onComplete: finish });
        });
        return;
      }

      const isRedSplit = isRedSplitTrigger(event);

      const end = pixelCenter(event.to);
      const midpoint = orangeJumpMidpoint(event, board.size);

      if (midpoint === null) {
        if (isRedSplit) playSplitSound();
        else if (event.hasCollision) playImpactSound();

        const path = cellPath(event.from, event.to, event.direction, board.size);
        walkPath(path, event.from, finish);
        return;
      }

      // Orange's own 2-cell push -- a visible hop over the skipped cell, called
      // out with its own highlight marker there, and its own distinct sound
      // (018-piece-movement-animation refinement, user playtest request). The
      // bulge is always PERPENDICULAR to the direction of travel: a horizontal
      // jump (moving along a row) bulges up (a `y` offset); a vertical jump
      // (moving along a column) bulges right (an `x` offset) -- offsetting `y`
      // for a vertical jump would just look like moving faster along the same
      // line, not an arc (second round of playtest refinement). Each half of
      // the arc (spawn->midpoint, midpoint->end) takes a FULL STEP_DURATION_MS,
      // not half of it -- this covers 2 real cells, so at the SAME per-cell
      // speed as every other move it takes 2*STEP_DURATION_MS total, not
      // STEP_DURATION_MS (real bug reported by the user: the jump used to
      // cover its 2 cells in the same total time a 1-cell move takes,
      // effectively moving twice as fast per cell as anything else).
      if (isRedSplit) playSplitSound();
      else playJumpSound();
      const mid = pixelCenter(midpoint);
      const hopOffset = CELL_SIZE * 0.4;
      const isVerticalJump = event.from.col === event.to.col;
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
            onComplete: finish,
          });
        },
      });
    };

    if (
      isFirstEvent &&
      isOnBoard(event.from, board.size) &&
      (spawnAt.row !== event.from.row || spawnAt.col !== event.from.col)
    ) {
      // Same per-cell walk, same constant speed, as every other move -- covers
      // the edge-to-impact glide one cell at a time instead of a single
      // fixed-duration tween spanning however many cells happen to separate
      // them (real bug reported by the user: a launch with a long empty run
      // before its first impact covered far more distance in the same 450ms
      // than a launch with a short one, making otherwise-identical launches
      // look like they moved at very different speeds depending only on lane
      // length, not on direction itself).
      const entryPath = cellPath(spawnAt, event.from, launch.direction, board.size);
      walkPath(entryPath, spawnAt, runEvent);
      return;
    }

    runEvent();
  }

  let remainingRoots = roots.length;
  for (const rootIndex of roots) {
    playNode(rootIndex, () => {
      remainingRoots -= 1;
      if (remainingRoots === 0) onDone();
    });
  }
}
