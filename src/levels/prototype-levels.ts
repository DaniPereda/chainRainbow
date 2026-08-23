import { createLevel, type Level } from '../engine/index.js';

/** One of the 10 hardcoded Fase 2 levels, plus its display number for the selector. */
export type PrototypeLevel = { id: number; level: Level };

/**
 * The 10 levels of the Fase 2 prototype (spec.md 005). Each is hand-authored and uses
 * only Fase 1 engine rules (green, orange, same-color annihilation, wrap-around) --
 * hand-verified winnable during implementation, per the constitution's requirement that
 * manually authored test levels pass before any generator exists.
 */
export const PROTOTYPE_LEVELS: PrototypeLevel[] = [
  // 1: introduces a plain push (green, distance 1) into an empty cell.
  {
    id: 1,
    level: createLevel({
      pieces: [{ at: { row: 0, col: 3 }, color: 'orange' }],
      hand: ['green'],
      objective: { at: { row: 0, col: 4 }, color: 'orange' },
    }),
  },
  // 2: introduces orange's longer push (distance 2).
  {
    id: 2,
    level: createLevel({
      pieces: [{ at: { row: 1, col: 3 }, color: 'green' }],
      hand: ['orange'],
      objective: { at: { row: 1, col: 5 }, color: 'green' },
    }),
  },
  // 3: same-color annihilation as a first impact clears an obstacle, then a second
  // launch pushes the real target piece into place. A launched piece never settles
  // on the board itself (spec.md 006), so a same-color demonstration needs two
  // launches: one to annihilate, one to actually reach the objective.
  {
    id: 3,
    level: createLevel({
      pieces: [
        { at: { row: 2, col: 2 }, color: 'green' }, // obstacle, same color as hand[0]
        { at: { row: 2, col: 5 }, color: 'green' }, // real target, pushed by hand[1]
      ],
      hand: ['green', 'orange'],
      objective: { at: { row: 2, col: 7 }, color: 'green' },
    }),
  },
  // 4: wrap-around -- pushed past the east edge, reappears on the west edge (empty).
  {
    id: 4,
    level: createLevel({
      pieces: [{ at: { row: 3, col: 7 }, color: 'orange' }],
      hand: ['green'],
      objective: { at: { row: 3, col: 0 }, color: 'orange' },
    }),
  },
  // 5: wrap-around with orange's longer push distance.
  {
    id: 5,
    level: createLevel({
      pieces: [{ at: { row: 4, col: 7 }, color: 'green' }],
      hand: ['orange'],
      objective: { at: { row: 4, col: 1 }, color: 'green' },
    }),
  },
  // 6: wrap-around on the vertical axis (south edge to north edge).
  {
    id: 6,
    level: createLevel({
      pieces: [{ at: { row: 7, col: 2 }, color: 'orange' }],
      hand: ['green'],
      objective: { at: { row: 0, col: 2 }, color: 'orange' },
    }),
  },
  // 7: same idea as level 3 (same-color annihilation clears an obstacle, then a
  // second launch reaches the objective), with the colors swapped for variety.
  {
    id: 7,
    level: createLevel({
      pieces: [
        { at: { row: 5, col: 3 }, color: 'orange' }, // obstacle, same color as hand[0]
        { at: { row: 5, col: 6 }, color: 'orange' }, // real target, pushed by hand[1]
      ],
      hand: ['orange', 'green'],
      objective: { at: { row: 5, col: 7 }, color: 'orange' },
    }),
  },
  // 8: a two-hop mixed-color cascade with no annihilation and no wrap -- the launcher
  // and the first piece it hits both end up settled, and the second piece it reaches
  // is pushed by ITS striker's (not its own) distance.
  {
    id: 8,
    level: createLevel({
      pieces: [
        { at: { row: 6, col: 1 }, color: 'orange' },
        { at: { row: 6, col: 2 }, color: 'green' },
      ],
      hand: ['green'],
      objective: { at: { row: 6, col: 4 }, color: 'green' },
    }),
  },
  // 9: wrap-around to the west, going negative before wrapping.
  {
    id: 9,
    level: createLevel({
      pieces: [{ at: { row: 0, col: 0 }, color: 'green' }],
      hand: ['orange'],
      objective: { at: { row: 0, col: 6 }, color: 'green' },
    }),
  },
  // 10: a two-launch puzzle -- the first launch clears an obstacle via same-color
  // annihilation, the second pushes the real target piece into place.
  {
    id: 10,
    level: createLevel({
      pieces: [
        { at: { row: 5, col: 2 }, color: 'orange' },
        { at: { row: 5, col: 5 }, color: 'green' },
      ],
      hand: ['orange', 'orange'],
      objective: { at: { row: 5, col: 7 }, color: 'green' },
    }),
  },
];
