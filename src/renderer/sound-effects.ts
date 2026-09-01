/**
 * Tiny procedurally-generated sound effects (018-piece-movement-animation
 * refinement) -- three short, distinct tones via the raw Web Audio API, no
 * audio assets or Phaser sound manager involved. Deliberately "sencillo": one
 * oscillator, one short envelope, per call.
 */

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (AudioContextCtor === undefined) return null;
  sharedContext ??= new AudioContextCtor();
  return sharedContext;
}

function playTone(frequency: number, durationSeconds: number, type: OscillatorType): void {
  const ctx = getContext();
  if (ctx === null) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds);
}

/** A generic impact -- any collision (hasCollision: true) or ANNIHILATION. */
export function playImpactSound(): void {
  playTone(220, 0.12, 'square');
}

/** Orange's own 2-cell jump, distinct from a generic impact. */
export function playJumpSound(): void {
  playTone(660, 0.1, 'triangle');
}

/** The level's goal being reached, once, after the full animation finishes. */
export function playGoalSound(): void {
  playTone(523.25, 0.18, 'sine');
  setTimeout(() => playTone(783.99, 0.22, 'sine'), 90);
}
