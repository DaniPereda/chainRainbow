/**
 * Deterministic PRNG with a seed (mulberry32) -- Math.random() cannot be seeded,
 * and FR-009 requires the same seed to always reproduce the same level. No new
 * runtime dependency, same spirit as the engine having none (research.md).
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
