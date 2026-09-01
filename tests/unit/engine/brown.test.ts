import { describe, expect, it } from 'vitest';
import { createLevel, resolveLaunch } from '../../../src/engine/index.js';

describe('brown: walks much farther than green or orange, checking every cell (FR-002, FR-003)', () => {
  // data-model.md fixture 1: a long walk into a blocker, which then cascades using
  // its OWN striker distance (green's 1) -- not brown's. Proves brown doesn't
  // "contaminate" the distance of the next link in the chain.
  it('walks past several empty cells, then the blocked piece pushes onward with its own distance', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 0, col: 1 }, color: 'green' },
        { at: { row: 0, col: 5 }, color: 'orange' },
      ],
      hand: ['brown'],
      goal: { at: { row: 0, col: 5 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.board.cells[0][1]).toEqual({ color: 'brown', fragility: 'new' }); // the launcher survives and settles here (FR-007)
    expect(outcome.board.cells[0][5]).toEqual({ color: 'green', fragility: 'cracked' }); // walked here, far past orange's reach
    expect(outcome.board.cells[0][6]).toEqual({ color: 'orange', fragility: 'cracked' }); // pushed onward by green's own distance (1)
    expect(outcome.board.cells[0][0]).toBeNull(); // the entry cell itself was never occupied
    expect(outcome.result).toBe('won');
  });

  // data-model.md fixture 2: contrast with orange, which blindly skips the first
  // intermediate cell -- brown checks it and stops there instead.
  it('stops at the very first cell if it is already occupied -- no blind skip like orange', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 1, col: 1 }, color: 'green' },
        { at: { row: 1, col: 2 }, color: 'orange' },
      ],
      hand: ['brown'],
      goal: { at: { row: 1, col: 3 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 1 });

    expect(outcome.board.cells[1][1]).toEqual({ color: 'brown', fragility: 'new' }); // the launcher survives and settles here (FR-007)
    expect(outcome.board.cells[1][2]).toEqual({ color: 'green', fragility: 'cracked' });
    expect(outcome.board.cells[1][3]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(outcome.result).toBe('won');
  });
});

describe('brown: whatever it reaches is resolved by the existing universal rule (FR-003, spec.md 008)', () => {
  // data-model.md fixture 3: the long walk ends on a same-color piece -- annihilation,
  // exactly as at any other point in a chain. No special case for brown.
  it('annihilates when the long walk reaches a piece of the same color as the mover', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 2, col: 1 }, color: 'green' },
        { at: { row: 2, col: 4 }, color: 'green' },
      ],
      hand: ['brown'],
      // Nothing survives this launch, so no goal is reachable here -- placed
      // away from both pieces on purpose, so it doesn't read as "already sitting on
      // the goal" before the launch even happens (that piece is destined to vanish).
      goal: { at: { row: 2, col: 7 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 2 });

    // the launcher (brown) only struck the FIRST green -- its own settling here is
    // unaffected by what happens two links further down the chain (FR-007).
    expect(outcome.board.cells[2][1]).toEqual({ color: 'brown', fragility: 'new' });
    expect(outcome.board.cells[2][4]).toBeNull(); // both greens annihilated each other, two links down
    expect(outcome.events.some((event) => event.type === 'ANNIHILATION')).toBe(true);
    expect(outcome.result).toBe('lost');
  });

  // data-model.md fixture 5: two brown pieces meeting directly -- the long walk never
  // even starts, since the very first check is the same-color annihilation.
  it('annihilates immediately when two brown pieces meet directly, before any long walk starts', () => {
    const level = createLevel({
      pieces: [{ at: { row: 5, col: 1 }, color: 'brown' }],
      hand: ['brown'],
      goal: { at: { row: 5, col: 1 }, color: 'brown' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 5 });

    expect(outcome.board.cells[5][1]).toBeNull();
    expect(outcome.events).toHaveLength(1);
    expect(outcome.events[0].type).toBe('ANNIHILATION');
  });
});

describe('brown: never travels more than one full lap of the board (FR-004, spec.md 008)', () => {
  // data-model.md fixture 4: a completely clear lane -- nothing ever blocks the walk,
  // so it must stop by itself right before the second edge crossing (12 steps from
  // col 3, landing on the last in-bounds cell of that additional lap -- spec.md 008
  // erratum), never hang, and never falsely block against its own starting cell at
  // step 8 along the way (research.md 008).
  it('stops right before the second edge crossing on an otherwise empty row', () => {
    const level = createLevel({
      pieces: [{ at: { row: 4, col: 3 }, color: 'orange' }],
      hand: ['brown'],
      goal: { at: { row: 4, col: 7 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.board.cells[4][3]).toEqual({ color: 'brown', fragility: 'new' }); // the launcher survives and settles here (FR-007)
    expect(outcome.board.cells[4][7]).toEqual({ color: 'orange', fragility: 'cracked' });
    expect(outcome.result).toBe('won');
  });
});

describe('brown: a chain link handed off to brown never loops back onto an earlier link (regression)', () => {
  // Found by manual play-testing of generated 6-launch levels (tools/generator/):
  // resolveStrike used to pass the SAME unmutated board down through every level
  // of a cascade, only clearing vacated cells once the recursion unwound. Once
  // brown became the "carrier" of a collision (the piece just displaced, now
  // acting as striker for the next one), its own walk -- which excludes only the
  // exact piece it is carrying, by identity -- could wrap a full lap of an
  // otherwise-clear lane and land back on a piece from an EARLIER link of the
  // very same cascade, which was still shown as occupied. That replayed the
  // exact same collision again, forever, overflowing the call stack. Fixed
  // (008-brown-piece) by vacating a piece's origin cell eagerly, before
  // computing where it lands and before recursing.
  //
  // 016-immediate-chain-placement went one step further: eager vacating stopped
  // the infinite loop, but an earlier link's own DESTINATION (where it settles)
  // was still written only once the whole recursion it triggered had unwound --
  // so a brown walk that wrapped back around to that link's destination found it
  // genuinely empty and passed straight through, "invisible" to the rest of its
  // own cascade. Both fixtures below were written to lock in that pass-through
  // as correct; they now do the opposite on purpose -- the launched piece is a
  // real, settled board occupant by the time brown's wrap-around walk reaches
  // it, so it collides for real (same color here -> annihilation) instead of
  // being walked through.
  it('a brown-driven wrap-around now collides with the launched piece instead of passing through it (2-piece cascade)', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 5, col: 3 }, color: 'brown' },
        { at: { row: 6, col: 3 }, color: 'green' },
      ],
      hand: ['green'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'S', lane: 3 });

    expect(outcome.missclick).toBe(false);
    // The launcher settles at (5,3) first (FR-007) -- but it's still there, for
    // real, when brown's own wrap-around walk (triggered by pushing the green at
    // (6,3)) comes back around and finds it: same color -> mutual annihilation.
    expect(outcome.board.cells[5][3]).toBeNull();
    expect(outcome.board.cells[6][3]).toEqual({ color: 'brown', fragility: 'cracked' });
    expect(outcome.board.cells[7][3]).toBeNull(); // never reached -- the walk stopped at (5,3)
    expect(outcome.events).toContainEqual({ type: 'ANNIHILATION', at: { row: 5, col: 3 }, color: 'green' });
    expect(outcome.result).toBe('lost');
  });

  // Same shape, but with two links between the launch and where brown takes
  // over -- proves the self-collision isn't limited to brown sitting
  // immediately next to the piece that struck it.
  it('a brown-driven wrap-around now collides with the launched piece instead of passing through it (longer cascade)', () => {
    const level = createLevel({
      pieces: [
        { at: { row: 4, col: 0 }, color: 'green' },
        { at: { row: 4, col: 2 }, color: 'brown' },
        { at: { row: 4, col: 3 }, color: 'orange' },
      ],
      hand: ['orange'],
      goal: { at: { row: 0, col: 0 }, color: 'green' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 4 });

    expect(outcome.missclick).toBe(false);
    // The launcher settles at (4,0) first (FR-007) -- but it's still there, for
    // real, when brown's own wrap-around walk (triggered by pushing the orange
    // at (4,3)) comes back around and finds it: same color -> annihilation.
    expect(outcome.board.cells[4][0]).toBeNull();
    expect(outcome.board.cells[4][2]).toEqual({ color: 'green', fragility: 'cracked' });
    expect(outcome.board.cells[4][3]).toEqual({ color: 'brown', fragility: 'cracked' });
    expect(outcome.board.cells[4][7]).toBeNull(); // never reached -- the walk stopped at (4,0)
    expect(outcome.events).toContainEqual({ type: 'ANNIHILATION', at: { row: 4, col: 0 }, color: 'orange' });
    expect(outcome.result).toBe('lost');
  });
});

describe('brown: launches from hand exactly like green and orange (FR-006, spec.md 008)', () => {
  // data-model.md fixture 6: a missclick works identically for a brown-handed launch
  // -- the launch mechanism itself is already color-agnostic, no adjustment needed.
  it('returns the piece to hand and leaves the board unchanged on a missclick', () => {
    const level = createLevel({
      pieces: [{ at: { row: 6, col: 4 }, color: 'orange' }],
      hand: ['brown'],
      goal: { at: { row: 6, col: 5 }, color: 'orange' },
    });

    const outcome = resolveLaunch(level, { direction: 'E', lane: 0 });

    expect(outcome.missclick).toBe(true);
    expect(outcome.board).toEqual(level.board);
    expect(outcome.hand).toEqual(level.hand);
    expect(outcome.result).toBe('undetermined');
  });
});
