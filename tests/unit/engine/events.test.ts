import { describe, expect, it, vi } from 'vitest';
import { createBoard } from '../../../src/engine/board.js';
import { resolveChain, type ImpactHandler, type ImpactSite, type MutualImpactHandler } from '../../../src/engine/events.js';

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
      board: b,
      events: [{ type: 'MOVE_STEP', piece: s.piece, from: s.from, to: s.to, direction: s.direction, hasCollision: false }],
      nextSites: [],
    });
    const handleMutualImpact = vi.fn();

    const result = resolveChain(board, [siteA, siteB], handleImpact, handleMutualImpact);

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
      board: b,
      events: [{ type: 'ANNIHILATION', at: a.to, color: 'green', from: a.from, direction: a.direction }],
      nextSites: [],
    });

    const result = resolveChain(board, [siteA, siteB], handleImpact, handleMutualImpact);

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

    const result = resolveChain(board, [siteA, siteB, siteC], handleImpact, handleMutualImpact);

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
      board: b,
      events: [{ type: 'MOVE_STEP', piece: s.piece, from: s.from, to: s.to, direction: s.direction, hasCollision: false }],
      nextSites: [],
    });
    const handleMutualImpact = vi.fn();

    const result = resolveChain(board, [initial], handleImpact, handleMutualImpact);

    expect(handleMutualImpact).not.toHaveBeenCalled();
    expect(result.events).toEqual([
      { type: 'MOVE_STEP', piece: initial.piece, from: initial.from, to: initial.to, direction: initial.direction, hasCollision: false },
    ]);
  });
});
