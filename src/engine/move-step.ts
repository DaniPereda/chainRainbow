import {
  type Board,
  type Coordinate,
  type Piece,
  getPieceAt,
  isInBounds,
  setPieceAt,
  wrapCoordinate,
} from './board.js';

export type Direction = 'N' | 'S' | 'E' | 'O';

const DIRECTION_DELTA: Record<Direction, { row: number; col: number }> = {
  N: { row: -1, col: 0 },
  S: { row: 1, col: 0 },
  E: { row: 0, col: 1 },
  O: { row: 0, col: -1 },
};

export function step(coord: Coordinate, direction: Direction): Coordinate {
  const delta = DIRECTION_DELTA[direction];
  return { row: coord.row + delta.row, col: coord.col + delta.col };
}

/**
 * Moves `coord` `distance` cells in `direction`, wrapping around the board's
 * edges (FR-001, spec.md 004) -- a destination past the far edge reappears on
 * the opposite edge of the same row/column. Wrap-around is a property of
 * movement itself, so any caller displacing a piece already on the board
 * (push, cascade, ...) gets it for free without needing to know it happened.
 */
export function stepBy(coord: Coordinate, direction: Direction, distance: number): Coordinate {
  let current = coord;
  for (let i = 0; i < distance; i++) {
    current = step(current, direction);
  }
  return wrapCoordinate(current);
}

/**
 * Walks `position` one cell at a time in `direction`, checking occupancy at every
 * single step (unlike `stepBy`, which never looks at the board) -- stopping as soon
 * as a step lands on an occupied cell, or right before it WOULD cross the board edge
 * for the `maxEdgeCrossings`-th time, whichever comes first (marrón, spec.md 008).
 * The cap is checked before wrapping into that crossing, so the piece settles on the
 * last in-bounds cell of its final lap, not on the first cell of a lap it never
 * actually enters -- matching the design doc's own formula ("distancia hasta la
 * frontera + longitud de la línea") read as cells still ahead before falling off,
 * not as the step that crosses over (game_design_context.pdf section 4; the earlier
 * off-by-one here, and in spec.md 008's clarification that claimed the two readings
 * were equivalent, was found via a level 12 playtest -- see spec.md 008's erratum).
 *
 * `piece` -- the specific piece being displaced -- is excluded from the occupancy
 * check by identity, not by coordinate: the board passed in is always the same
 * unmutated snapshot resolveStrike works from throughout a chain, so it still
 * shows `piece` sitting wherever it started. That's a stale self-reference, not a
 * real obstacle, and it isn't a rare case: on an 8-wide board, any unblocked walk
 * revisits its own starting cell at step 8, strictly before the final crossing
 * can ever happen (research.md 008) -- excluding it is what makes the crossing cap
 * reachable at all on a clear lane. Checking by identity (this exact piece) rather
 * than by the coordinate it happened to start at keeps that intact even if a future
 * primitive ever needs to walk a piece whose recorded start position isn't where
 * this call began -- e.g. a piece mid-way through a branched chain (rojo).
 */
export function stepUntilBlocked(
  board: Board,
  piece: Piece,
  position: Coordinate,
  direction: Direction,
  maxEdgeCrossings: number,
): Coordinate {
  let current = position;
  let edgeCrossings = 0;

  for (;;) {
    const raw = step(current, direction);
    if (!isInBounds(raw)) {
      edgeCrossings++;
      if (edgeCrossings >= maxEdgeCrossings) {
        return current;
      }
    }
    current = wrapCoordinate(raw);

    const occupant = getPieceAt(board, current);
    if (occupant !== null && occupant !== piece) {
      return current;
    }
  }
}

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  N: 'S',
  S: 'N',
  E: 'O',
  O: 'E',
};

export function opposite(direction: Direction): Direction {
  return OPPOSITE_DIRECTION[direction];
}

export type MoveStepResult = {
  moved: boolean;
  to: Coordinate;
  collided: boolean;
  board: Board;
};

export function moveStep(
  board: Board,
  from: Coordinate,
  direction: Direction,
  collision: boolean,
): MoveStepResult {
  const to = step(from, direction);
  const piece = getPieceAt(board, from);

  if (!isInBounds(to) || piece === null) {
    return { moved: false, to, collided: false, board };
  }

  const occupant = getPieceAt(board, to);
  const collided = occupant !== null;

  if (collision && collided) {
    return { moved: false, to, collided: true, board };
  }

  // collision=false and collided=true: the destination's occupant is displaced
  // (not merged or pushed) — no piece behavior in this story exercises this path.
  const nextBoard = setPieceAt(setPieceAt(board, from, null), to, piece);
  return { moved: true, to, collided, board: nextBoard };
}
