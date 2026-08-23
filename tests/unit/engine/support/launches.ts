import type { Launch } from '../../../../src/engine/index.js';

/** Collides with testLevelGreen01's board piece (spec.md 001 -> Scenario 2), eventually won. */
export const GREEN_WINNING_LAUNCH: Launch = { direction: 'E', lane: 4 };

/** No piece anywhere in this lane -- always a missclick (spec.md 001 -> Scenario 1). */
export const GREEN_MISSCLICK_LAUNCH: Launch = { direction: 'E', lane: 0 };

/** Collides with testLevelOrange01's board pieces (spec.md 002 -> Scenario 1), eventually won. */
export const ORANGE_WINNING_LAUNCH: Launch = { direction: 'E', lane: 3 };

/** No piece anywhere in this lane -- always a missclick (spec.md 002 -> Scenario 4). */
export const ORANGE_MISSCLICK_LAUNCH: Launch = { direction: 'E', lane: 0 };
