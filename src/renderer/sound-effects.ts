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

/**
 * Red striking a defender and splitting it into two branches
 * (009-red-piece/020-generator-red-support) -- distinct from a generic impact:
 * two tones fired at once, a fifth apart, evoking "one becomes two" rather than
 * goal's sequential two-note rise. Plays once per split, at the moment red's own
 * MOVE_STEP settles with a real collision (launch-animation.ts) -- not for a
 * red piece simply settling into empty space, which never splits anything.
 */
export function playSplitSound(): void {
  playTone(196, 0.16, 'sawtooth');
  playTone(294, 0.16, 'sawtooth');
}

/**
 * Arcoíris changing a piece's color (024-rainbow-color-change) -- a quick
 * four-note ascending sine arpeggio, distinct from every sound above: not a
 * single blip (impact/jump), not two simultaneous tones (split), not a slow
 * two-note rise (goal) -- a short "sparkle" evoking a repaint rather than a
 * collision. Plays once per color choice applied, never per candidate offered.
 */
export function playRainbowSound(): void {
  playTone(440, 0.08, 'sine');
  setTimeout(() => playTone(554.37, 0.08, 'sine'), 50);
  setTimeout(() => playTone(659.25, 0.08, 'sine'), 100);
  setTimeout(() => playTone(880, 0.12, 'sine'), 150);
}
