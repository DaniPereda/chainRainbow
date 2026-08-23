import { describe, expect, it } from 'vitest';
import { resolveLaunch, testLevelGreen01 } from '../../../src/engine/index.js';
import { levelWithPieceAtBoardEdge } from './support/levels.js';
import { GREEN_MISSCLICK_LAUNCH, GREEN_WINNING_LAUNCH } from './support/launches.js';

describe('launch: travel and missclick (FR-001, FR-002, FR-003)', () => {
  // Scenario 1 (spec.md 001): a launch that finds no piece before leaving the
  // board is a missclick -- the piece returns to hand, board untouched.
  it('returns the piece to hand and leaves the board unchanged on missclick', () => {
    const outcome = resolveLaunch(testLevelGreen01, GREEN_MISSCLICK_LAUNCH);

    expect(outcome.missclick).toBe(true);
    expect(outcome.events).toHaveLength(0);
    expect(outcome.board).toEqual(testLevelGreen01.board);
    expect(outcome.hand).toEqual(testLevelGreen01.hand);
  });

  // Edge Case (spec.md 001): colliding in the very first cell of the travel still
  // counts as an interaction, not a missclick.
  it('triggers an interaction, not a missclick, when the collision happens in the very first cell', () => {
    const outcome = resolveLaunch(levelWithPieceAtBoardEdge(), { direction: 'E', lane: 2 });

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThan(0);
  });

  // Scenario 2 (spec.md 001): a launch that collides triggers the chain reaction.
  it('travels past empty cells before colliding with the piece on the board', () => {
    const outcome = resolveLaunch(testLevelGreen01, GREEN_WINNING_LAUNCH);

    expect(outcome.missclick).toBe(false);
    expect(outcome.events.length).toBeGreaterThan(0);
  });
});
