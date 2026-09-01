import type { Board, Coordinate } from '../../src/engine/board.js';
import { getPieceAt, wrapCoordinate } from '../../src/engine/board.js';
import { opposite, step, type Direction } from '../../src/engine/move-step.js';

export type InverseColor = 'green' | 'orange' | 'brown' | 'red';
export type InverseContext = 'settle' | 'occupied';

function stepBackward(cell: Coordinate, direction: Direction, distance: number): Coordinate {
  let current = cell;
  const back = opposite(direction);
  for (let i = 0; i < distance; i++) {
    current = step(current, back);
  }
  return wrapCoordinate(current);
}

function isFarEdgeOfLane(cell: Coordinate, direction: Direction): boolean {
  switch (direction) {
    case 'E':
      return cell.col === 7;
    case 'O':
      return cell.col === 0;
    case 'S':
      return cell.row === 7;
    case 'N':
      return cell.row === 0;
  }
}

/**
 * Every cell strictly before `to` along the same lane, walking backward from `to`
 * in `opposite(direction)` -- stops as soon as the walk (still going backward)
 * finds an occupied cell, since anything further back than that would have its
 * OWN forward path blocked before ever reaching `to` (spec.md 011, "brown, camino
 * despejado"). Deliberately does not wrap around the board -- a "basic" generator
 * scope simplification (data-model.md), not a claim of full wrap-around support.
 */
function laneCandidatesWithClearPath(board: Board, to: Coordinate, direction: Direction): Coordinate[] {
  const candidates: Coordinate[] = [];
  let current = to;
  for (;;) {
    const back = opposite(direction);
    const raw = step(current, back);
    if (raw.row < 0 || raw.row > 7 || raw.col < 0 || raw.col > 7) {
      break; // reached the near edge of the board -- no wrap-around in this scope
    }
    current = raw;
    if (getPieceAt(board, current) !== null) {
      break; // this candidate, and anything further back, would be blocked first
    }
    candidates.push(current);
  }
  return candidates;
}

/**
 * All valid origins for a piece struck by `strikerColor`, arriving from `direction`,
 * that ends up at `to` -- either settling there cleanly (context 'settle': `to` must
 * remain empty until this impact fills it) or striking whatever already occupies
 * `to` (context 'occupied': used to explain how a striker itself arrived to hit
 * something). Green/orange are univocal regardless of context (their push math
 * never looks at the board). Brown has two genuinely different shapes -- see
 * research.md, "marrón tiene dos modos de inverso, no uno".
 */
export function inverseCandidates(
  strikerColor: InverseColor,
  direction: Direction,
  to: Coordinate,
  board: Board,
  context: InverseContext,
): Coordinate[] {
  // Red shares green's exact formula -- a red split's first hop is always
  // exactly 1 cell, regardless of the struck piece's own color
  // (020-generator-red-support, research.md Decisión 1) -- but ONLY for
  // context 'settle': red is never a valid candidate for explaining how an
  // already-known striker itself started moving (context 'occupied', used
  // only when resolving a 'striker-origin' obligation) -- deliberately out
  // of scope (research.md Decisión 4).
  if (strikerColor === 'green' || strikerColor === 'red') {
    if (strikerColor === 'red' && context !== 'settle') return [];
    return [stepBackward(to, direction, 1)];
  }
  if (strikerColor === 'orange') {
    return [stepBackward(to, direction, 2)];
  }

  // brown
  if (context === 'settle') {
    if (!isFarEdgeOfLane(to, direction)) {
      return []; // only the far edge of the lane is reachable by a clean settle
    }
    return laneCandidatesWithClearPath(board, to, direction);
  }
  return laneCandidatesWithClearPath(board, to, direction);
}
