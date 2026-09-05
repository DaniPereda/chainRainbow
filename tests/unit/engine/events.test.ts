import { describe, expect, it, vi } from 'vitest';
import { createBoard, setPieceAt } from '../../../src/engine/board.js';
import { resolveChain, type ImpactHandler, type ImpactSite, type MutualImpactHandler } from '../../../src/engine/events.js';
import { expectResolved } from './test-helpers.js';

function site(fromCol: number, toCol: number): ImpactSite {
  return {
    piece: { color: 'green', fragility: 'new' },
    direction: 'E',
    from: { row: 0, col: fromCol },
    to: { row: 0, col: toCol },
  };
}

describe('resolveChain: multiple initial sites (019-synchronous-tick-resolution)', () => {
  it('resolves two non-coinciding sites independently, never calling handleMutualImpact', () => {
    const board = createBoard();
    const siteA = site(0, 1);
    const siteB = site(5, 6);
    const handleImpact: ImpactHandler = (b, s) => ({
      status: 'resolved',
      board: b,
      events: [{ type: 'MOVE_STEP', piece: s.piece, from: s.from, to: s.to, direction: s.direction, hasCollision: false }],
      nextSites: [],
    });
    const handleMutualImpact = vi.fn();

    const result = expectResolved(resolveChain(board, [siteA, siteB], handleImpact, handleMutualImpact));

    expect(handleMutualImpact).not.toHaveBeenCalled();
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: siteA.piece, from: siteA.from, to: siteA.to, direction: siteA.direction, hasCollision: false },
      { type: 'MOVE_STEP', piece: siteB.piece, from: siteB.from, to: siteB.to, direction: siteB.direction, hasCollision: false },
    ]);
  });

  it('resolves two sites that already coincide via handleMutualImpact instead of handleImpact', () => {
    const board = createBoard();
    const siteA = site(0, 4);
    const siteB = site(7, 4); // same `to` as siteA
    const handleImpact: ImpactHandler = vi.fn();
    const handleMutualImpact: MutualImpactHandler = (b, a) => ({
      status: 'resolved',
      board: b,
      events: [{ type: 'ANNIHILATION', at: a.to, color: 'green', from: a.from, direction: a.direction }],
      nextSites: [],
    });

    const result = expectResolved(resolveChain(board, [siteA, siteB], handleImpact, handleMutualImpact));

    expect(handleImpact).not.toHaveBeenCalled();
    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 0, col: 4 }, color: 'green', from: siteA.from, direction: siteA.direction },
    ]);
  });

  it('resolves 3 coinciding sites as sequential pairwise collisions, in queue order (research.md, Decisión 4)', () => {
    const board = createBoard();
    const siteA = site(0, 4);
    const siteB = site(7, 4); // collides with A first
    const siteC = site(3, 6); // does not collide initially -- only after A+B's own collision bridges to it
    const handleImpact: ImpactHandler = vi.fn();
    const handleMutualImpact: MutualImpactHandler = vi
      .fn()
      .mockImplementationOnce((b: typeof board, a: ImpactSite) => ({
        board: b,
        events: [{ type: 'ANNIHILATION', at: a.to, color: 'first-pair' }],
        nextSites: [{ piece: a.piece, direction: 'E', from: a.to, to: { row: 0, col: 6 } }],
      }))
      .mockImplementationOnce((b: typeof board, a: ImpactSite) => ({
        board: b,
        events: [{ type: 'ANNIHILATION', at: a.to, color: 'second-pair' }],
        nextSites: [],
      }));

    const result = expectResolved(resolveChain(board, [siteA, siteB, siteC], handleImpact, handleMutualImpact));

    expect(handleImpact).not.toHaveBeenCalled();
    expect(handleMutualImpact).toHaveBeenCalledTimes(2);
    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 0, col: 4 }, color: 'first-pair' },
      { type: 'ANNIHILATION', at: { row: 0, col: 6 }, color: 'second-pair' },
    ]);
  });

  it('behaves exactly as before for a single initial site (FR-006: zero regression when N=1)', () => {
    const board = createBoard();
    const initial = site(0, 1);
    const handleImpact: ImpactHandler = (b, s) => ({
      status: 'resolved',
      board: b,
      events: [{ type: 'MOVE_STEP', piece: s.piece, from: s.from, to: s.to, direction: s.direction, hasCollision: false }],
      nextSites: [],
    });
    const handleMutualImpact = vi.fn();

    const result = expectResolved(resolveChain(board, [initial], handleImpact, handleMutualImpact));

    expect(handleMutualImpact).not.toHaveBeenCalled();
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: initial.piece, from: initial.from, to: initial.to, direction: initial.direction, hasCollision: false },
    ]);
  });
});

describe('resolveChain: a shared destination is only a mutual collision when it is genuinely EMPTY (found as a real bug, confirmed with the user)', () => {
  // Two sites sharing a `to` does not by itself mean two trajectories are
  // meeting each other mid-air -- it can just as easily mean both are
  // independently racing toward the SAME real, still-untouched, stationary
  // defender. That is not a mutual collision between the two trajectories at
  // all: each should resolve normally against whatever is really on the
  // board when its own turn comes, exactly as if the other didn't exist.
  it('never calls handleMutualImpact when the shared destination is occupied -- falls through to ordinary FIFO processing instead', () => {
    const board = setPieceAt(createBoard(), { row: 0, col: 4 }, { color: 'orange', fragility: 'new' });
    const siteA = site(0, 4); // both share to = (0, 4), where a real piece sits
    const siteB = site(7, 4);
    const handleImpact: ImpactHandler = (b, s) => ({
      status: 'resolved',
      board: b,
      events: [{ type: 'MOVE_STEP', piece: s.piece, from: s.from, to: s.to, direction: s.direction, hasCollision: false }],
      nextSites: [],
    });
    const handleMutualImpact = vi.fn();

    const result = expectResolved(resolveChain(board, [siteA, siteB], handleImpact, handleMutualImpact));

    expect(handleMutualImpact).not.toHaveBeenCalled();
    // FIFO order: siteA (queued first) resolves before siteB, each via the
    // ordinary single-site handler -- never as a pair.
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: siteA.piece, from: siteA.from, to: siteA.to, direction: siteA.direction, hasCollision: false },
      { type: 'MOVE_STEP', piece: siteB.piece, from: siteB.from, to: siteB.to, direction: siteB.direction, hasCollision: false },
    ]);
  });

  it('still calls handleMutualImpact when the shared destination is genuinely empty', () => {
    const board = createBoard(); // (0,4) is empty -- nothing real for either side to strike
    const siteA = site(0, 4);
    const siteB = site(7, 4);
    const handleImpact: ImpactHandler = vi.fn();
    const handleMutualImpact: MutualImpactHandler = (b, a) => ({
      status: 'resolved',
      board: b,
      events: [{ type: 'ANNIHILATION', at: a.to, color: 'green', from: a.from, direction: a.direction }],
      nextSites: [],
    });

    const result = expectResolved(resolveChain(board, [siteA, siteB], handleImpact, handleMutualImpact));

    expect(handleImpact).not.toHaveBeenCalled();
    expect(result.events).toEqual([
      { type: 'ANNIHILATION', at: { row: 0, col: 4 }, color: 'green', from: siteA.from, direction: siteA.direction },
    ]);
  });
});
