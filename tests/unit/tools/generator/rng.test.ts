import { describe, expect, it } from 'vitest';
import { createRng } from '../../../../tools/generator/rng.js';

describe('createRng: deterministic PRNG with a seed (FR-009)', () => {
  it('produces the exact same sequence given the same seed', () => {
    const rngA = createRng(12345);
    const rngB = createRng(12345);

    const sequenceA = Array.from({ length: 10 }, () => rngA());
    const sequenceB = Array.from({ length: 10 }, () => rngB());

    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces a different sequence for a different seed', () => {
    const rngA = createRng(1);
    const rngB = createRng(2);

    const sequenceA = Array.from({ length: 10 }, () => rngA());
    const sequenceB = Array.from({ length: 10 }, () => rngB());

    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('always produces values in [0, 1)', () => {
    const rng = createRng(999);

    for (let i = 0; i < 200; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
