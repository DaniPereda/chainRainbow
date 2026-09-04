import { expect } from 'vitest';
import type { ImpactResolution } from '../../../src/engine/events.js';

/**
 * Narrows an `ImpactResolution` to its `'resolved'` branch for tests that
 * predate 024-rainbow-color-change and never intend to exercise a paused
 * chain -- fails loudly (rather than a confusing property-access error) if a
 * change to `applyImpact`/`resolveChain` ever makes one of them pause
 * unexpectedly.
 */
export function expectResolved(
  result: ImpactResolution,
): Extract<ImpactResolution, { status: 'resolved' }> {
  expect(result.status).toBe('resolved');
  if (result.status !== 'resolved') {
    throw new Error('expected an already-resolved ImpactResolution, got a pending color choice');
  }
  return result;
}
