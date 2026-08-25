import type { Board, Coordinate, Fragility, PieceColor } from './board.js';
import { createBoard, setPieceAt } from './board.js';
import type { Hand } from './launch.js';
import type { Goal } from './goal.js';

export type Level = { board: Board; hand: Hand; goal: Goal };

/**
 * A single "piece of this color goes at this cell" declaration. `fragility` is
 * optional -- omitting it means NEW (FR-012), not "unknown". For a BOARD piece
 * (as opposed to a hand entry, see `HandPieceInput`), declaring `'broken'` here
 * has no real effect: `createLevel` normalizes it away entirely (FR-016) rather
 * than ever placing a piece that would immediately need removing.
 */
export type PiecePlacement = { at: Coordinate; color: PieceColor; fragility?: Fragility };

/**
 * A hand entry: either a bare color (defaults to NEW, FR-012) or an explicit
 * `{ color, fragility }` when a level wants to deal an already-worn piece
 * (FR-011) -- unlike board pieces, `'broken'` IS meaningful here (FR-008): the
 * player still gets to throw it once before it's gone.
 */
export type HandPieceInput = PieceColor | { color: PieceColor; fragility?: Fragility };

/**
 * Declarative level builder: pieces already on the board, the hand's colors, and
 * the goal — all expressed with the same `{ at, color }` shape — so a level
 * reads as one visual block instead of a chain of `setPieceAt` calls plus a
 * separately-written goal. `goal` is a single placement today because
 * `Level`/`Goal` only support one target cell; multiple goals are a
 * possible future extension, not handled here.
 */
export function createLevel(config: {
  pieces: PiecePlacement[];
  hand: HandPieceInput[];
  goal: PiecePlacement;
}): Level {
  const board = config.pieces.reduce((boardSoFar, { at, color, fragility }) => {
    // FR-016: a board piece declared BROKEN never actually exists -- normalized
    // to an empty cell before the level is playable, rather than placing
    // something that would need removing before anyone could strike it.
    if (fragility === 'broken') return boardSoFar;
    return setPieceAt(boardSoFar, at, { color, fragility: fragility ?? 'new' });
  }, createBoard());

  return {
    board,
    hand: {
      pieces: config.hand.map((entry) =>
        typeof entry === 'string'
          ? { color: entry, fragility: 'new' as const }
          : { color: entry.color, fragility: entry.fragility ?? 'new' },
      ),
    },
    goal: { targetColor: config.goal.color, targetCell: config.goal.at },
  };
}

export const testLevelGreen01: Level = createLevel({
  pieces: [{ at: { row: 4, col: 4 }, color: 'orange' }],
  hand: ['green'],
  goal: { at: { row: 4, col: 5 }, color: 'orange' },
});

export const testLevelOrange01: Level = createLevel({
  pieces: [
    { at: { row: 3, col: 4 }, color: 'green' },
    { at: { row: 3, col: 5 }, color: 'green' },
  ],
  hand: ['orange'],
  goal: { at: { row: 3, col: 6 }, color: 'green' },
});

export const testLevelSameColor01: Level = createLevel({
  pieces: [{ at: { row: 6, col: 4 }, color: 'green' }],
  hand: ['green'],
  goal: { at: { row: 6, col: 5 }, color: 'green' },
});

export const testLevelSameColorCascade01: Level = createLevel({
  pieces: [
    { at: { row: 7, col: 4 }, color: 'orange' },
    { at: { row: 7, col: 5 }, color: 'orange' },
  ],
  hand: ['green'],
  goal: { at: { row: 0, col: 0 }, color: 'green' }, // unreachable: nothing survives (spec.md 006)
});

export const testLevelWrapToEmpty01: Level = createLevel({
  pieces: [{ at: { row: 2, col: 7 }, color: 'orange' }],
  hand: ['green'],
  goal: { at: { row: 2, col: 0 }, color: 'orange' },
});
