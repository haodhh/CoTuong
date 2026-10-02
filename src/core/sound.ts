// Small synthesized sound effects, so the app ships no audio files.

let ctx: AudioContext | undefined;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  ctx ??= new AudioContext();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

export type SoundName = 'move' | 'capture' | 'success' | 'error' | 'tick';

export function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    switch (name) {
      case 'move':
        tone(520, 0, 0.06, 'triangle', 0.2);
        break;
      case 'capture':
        tone(260, 0, 0.09, 'square', 0.12);
        break;
      case 'success':
        tone(660, 0, 0.12);
        tone(990, 0.1, 0.2);
        break;
      case 'error':
        tone(180, 0, 0.25, 'sawtooth', 0.08);
        break;
      case 'tick':
        tone(880, 0, 0.03, 'sine', 0.05);
        break;
    }
  } catch {
    // Audio can be unavailable (autoplay policies, old browsers); sound is optional.
  }
}
