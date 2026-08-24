import { createLevel, type Level } from '../engine/index.js';

/** One of the 15 hardcoded prototype levels, plus its display number for the selector. */
export type PrototypeLevel = { id: number; level: Level };

/**
 * The 15 levels of the prototype: 1-10 use only Fase 1 rules (spec.md 005 -- green,
 * orange, same-color annihilation, wrap-around); 11-15 bring brown and red (features
 * 008/009) into the frontend, one mechanic at a time. Each is hand-authored and
 * hand-verified winnable during implementation, per the constitution's requirement
 * that manually authored test levels pass before any generator exists.
 */
export const PROTOTYPE_LEVELS: PrototypeLevel[] = [
  // 1: introduces a plain push (green, distance 1) into an empty cell.
  {
    id: 1,
    level: createLevel({
      pieces: [{ at: { row: 0, col: 3 }, color: 'orange' }],
      hand: ['green'],
      goal: { at: { row: 0, col: 4 }, color: 'orange' },
    }),
  },
  // 2: introduces orange's longer push (distance 2).
  {
    id: 2,
    level: createLevel({
      pieces: [{ at: { row: 1, col: 3 }, color: 'green' }],
      hand: ['orange'],
      goal: { at: { row: 1, col: 5 }, color: 'green' },
    }),
  },
  // 3: same-color annihilation as a first impact clears an obstacle, then a second
  // launch pushes the real target piece into place. A launched piece never settles
  // on the board itself (spec.md 006), so a same-color demonstration needs two
  // launches: one to annihilate, one to actually reach the goal.
  {
    id: 3,
    level: createLevel({
      pieces: [
        { at: { row: 2, col: 2 }, color: 'green' }, // obstacle, same color as hand[0]
        { at: { row: 2, col: 5 }, color: 'green' }, // real target, pushed by hand[1]
      ],
      hand: ['green', 'orange'],
      goal: { at: { row: 2, col: 7 }, color: 'green' },
    }),
  },
  // 4: wrap-around -- pushed past the east edge, reappears on the west edge (empty).
  {
    id: 4,
    level: createLevel({
      pieces: [{ at: { row: 3, col: 7 }, color: 'orange' }],
      hand: ['green'],
      goal: { at: { row: 3, col: 0 }, color: 'orange' },
    }),
  },
  // 5: wrap-around with orange's longer push distance.
  {
    id: 5,
    level: createLevel({
      pieces: [{ at: { row: 4, col: 7 }, color: 'green' }],
      hand: ['orange'],
      goal: { at: { row: 4, col: 1 }, color: 'green' },
    }),
  },
  // 6: wrap-around on the vertical axis (south edge to north edge).
  {
    id: 6,
    level: createLevel({
      pieces: [{ at: { row: 7, col: 2 }, color: 'orange' }],
      hand: ['green'],
      goal: { at: { row: 0, col: 2 }, color: 'orange' },
    }),
  },
  // 7: same idea as level 3 (same-color annihilation clears an obstacle, then a
  // second launch reaches the goal), with the colors swapped for variety.
  {
    id: 7,
    level: createLevel({
      pieces: [
        { at: { row: 5, col: 3 }, color: 'orange' }, // obstacle, same color as hand[0]
        { at: { row: 5, col: 6 }, color: 'orange' }, // real target, pushed by hand[1]
      ],
      hand: ['orange', 'green'],
      goal: { at: { row: 5, col: 7 }, color: 'orange' },
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
      goal: { at: { row: 6, col: 4 }, color: 'green' },
    }),
  },
  // 9: wrap-around to the west, going negative before wrapping.
  {
    id: 9,
    level: createLevel({
      pieces: [{ at: { row: 0, col: 0 }, color: 'green' }],
      hand: ['orange'],
      goal: { at: { row: 0, col: 6 }, color: 'green' },
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
      goal: { at: { row: 5, col: 7 }, color: 'green' },
    }),
  },
  // 11: brown's long reach composing with a normal push -- brown walks past the
  // empty cells to reach green, pushes it onward to where orange sits, and orange
  // gets bumped by its OWN color's distance (1), not brown's.
  {
    id: 11,
    level: createLevel({
      pieces: [
        { at: { row: 0, col: 1 }, color: 'green' },
        { at: { row: 0, col: 6 }, color: 'orange' },
      ],
      hand: ['brown'],
      goal: { at: { row: 0, col: 7 }, color: 'orange' },
    }),
  },
  // 12: brown's edge-crossing cap -- an otherwise clear lane, so the push wraps
  // around the board and stops itself at the second edge crossing (spec.md 008).
  {
    id: 12,
    level: createLevel({
      pieces: [{ at: { row: 1, col: 3 }, color: 'orange' }],
      hand: ['brown'],
      goal: { at: { row: 1, col: 0 }, color: 'orange' },
    }),
  },
  // 13: brown still obeys same-color annihilation first -- the first launch hits a
  // brown obstacle and annihilates it instantly, no long walk; the second launch is
  // a plain green push reaching the real target.
  {
    id: 13,
    level: createLevel({
      pieces: [
        { at: { row: 2, col: 2 }, color: 'brown' },
        { at: { row: 2, col: 5 }, color: 'orange' },
      ],
      hand: ['brown', 'green'],
      goal: { at: { row: 2, col: 6 }, color: 'orange' },
    }),
  },
  // 14: red's basic split -- the struck piece divides into two branches instead of
  // being pushed; only the east branch needs to reach the goal (spec.md 009).
  {
    id: 14,
    level: createLevel({
      pieces: [{ at: { row: 3, col: 3 }, color: 'green' }],
      hand: ['red'],
      goal: { at: { row: 3, col: 4 }, color: 'green' },
    }),
  },
  // 15: red's split cascading into a further push -- one branch lands on orange and
  // pushes it onward with green's own distance, composing with the ordinary push
  // rule instead of just the basic split (spec.md 009).
  {
    id: 15,
    level: createLevel({
      pieces: [
        { at: { row: 4, col: 3 }, color: 'green' },
        { at: { row: 4, col: 4 }, color: 'orange' },
      ],
      hand: ['red'],
      goal: { at: { row: 4, col: 5 }, color: 'orange' },
    }),
  },
];
