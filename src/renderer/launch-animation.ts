import type Phaser from 'phaser';
import type { Board, ChainEvent, Coordinate, Direction, EventLog, Goal, Launch } from '../engine/index.js';
import { CELL_SIZE, PIECE_COLOR, drawBoard } from './board-view.js';
import { playGoalSound, playImpactSound, playJumpSound } from './sound-effects.js';

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

export function pixelCenter(coord: Coordinate): { x: number; y: number } {
  return { x: coord.col * CELL_SIZE + CELL_SIZE / 2, y: coord.row * CELL_SIZE + CELL_SIZE / 2 };
}

/**
 * Reproduces `events` visually, one at a time and strictly in order (research.md,
 * Decisión 3 -- `EventLog` has no notion of two events happening "at once" today).
 * Each event gets a temporary `Phaser.GameObjects.Arc` (never a persistent
 * per-piece GameObject -- research.md, Decisión 1): a `MOVE_STEP` tweens it from
 * `from` to `to`; an `ANNIHILATION` fades it out in place. Between events, the
 * static layer (`boardGraphics`) is redrawn via `drawBoard` against a board copy
 * advanced with `replayEvent` -- since that reducer only ever writes `to`/`at`
 * (never clears `from`, see its own comment), the static layer is already
 * accurate at every step with no extra bookkeeping here. The one accepted visual
 * simplification (research.md, Decisión 1): the temporary circle for a step
 * spawns on top of whatever the static layer already shows at `from` (typically
 * the piece that just struck this one, already settled there a step earlier) --
 * a brief overlap at the moment of impact, not a bug. Calls `onDone` once the
 * last event has finished (or immediately, with no animation, if `events` is
 * empty -- FR-004, the missclick case).
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
  let board = boardBeforeLaunch;
  let index = 0;

  function playNext(): void {
    if (index >= events.length) {
      onDone();
      return;
    }
    const isFirstEvent = index === 0;
    const event = events[index++];
    const piece = event.type === 'MOVE_STEP' ? event.piece : { color: event.color, fragility: 'new' as const };
    const from = event.type === 'MOVE_STEP' ? event.from : event.at;

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
      playNext();
    };

    const runEvent = (): void => {
      if (event.type === 'ANNIHILATION') {
        playImpactSound();
        scene.tweens.add({ targets: temp, alpha: 0, scale: 0, duration: STEP_DURATION_MS, onComplete: finish });
        return;
      }

      const end = pixelCenter(event.to);
      const midpoint = jumpMidpoint(event.from, event.to, board.size);

      if (midpoint === null) {
        if (event.hasCollision) playImpactSound();
        scene.tweens.add({
          targets: temp,
          x: boardGraphics.x + end.x,
          y: boardGraphics.y + end.y,
          duration: STEP_DURATION_MS,
          onComplete: finish,
        });
        return;
      }

      // Orange's own 2-cell push -- a visible hop over the skipped cell, called
      // out with its own highlight marker there, and its own distinct sound
      // (018-piece-movement-animation refinement, user playtest request). The
      // bulge is always PERPENDICULAR to the direction of travel: a horizontal
      // jump (moving along a row) bulges up (a `y` offset); a vertical jump
      // (moving along a column) bulges right (an `x` offset) -- offsetting `y`
      // for a vertical jump would just look like moving faster along the same
      // line, not an arc (second round of playtest refinement).
      playJumpSound();
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
        duration: STEP_DURATION_MS,
        onComplete: () => marker.destroy(),
      });
      scene.tweens.add({
        targets: temp,
        x: midX,
        y: midY,
        duration: STEP_DURATION_MS / 2,
        ease: 'Sine.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: temp,
            x: boardGraphics.x + end.x,
            y: boardGraphics.y + end.y,
            duration: STEP_DURATION_MS / 2,
            ease: 'Sine.easeIn',
            onComplete: finish,
          });
        },
      });
    };

    if (isFirstEvent && event.type === 'MOVE_STEP') {
      const fromPixel = pixelCenter(event.from);
      scene.tweens.add({
        targets: temp,
        x: boardGraphics.x + fromPixel.x,
        y: boardGraphics.y + fromPixel.y,
        duration: STEP_DURATION_MS,
        onComplete: runEvent,
      });
      return;
    }

    runEvent();
  }

  playNext();
}
