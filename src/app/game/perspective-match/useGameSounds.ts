"use client";

// Procedural sound effects via Web Audio API — no audio files needed
let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  ramp?: number,
) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    if (ramp) {
      osc.frequency.exponentialRampToValueAtTime(ramp, ctx.currentTime + duration);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — silently ignore
  }
}

// Block pickup — short chirp
export function playPickup() {
  const freq = 400 + Math.random() * 200;
  playTone(freq, 0.12, "sine", 0.1);
}

// Block placed into tray — soft tap
export function playPlace() {
  playTone(300, 0.08, "triangle", 0.06);
}

// 3-match — cheerful ascending chime
export function playMatch() {
  playTone(523, 0.15, "sine", 0.12); // C5
  setTimeout(() => playTone(659, 0.15, "sine", 0.12), 80); // E5
  setTimeout(() => playTone(784, 0.2, "sine", 0.12), 160); // G5
}

// Level complete — celebration jingle
export function playLevelComplete() {
  const notes = [523, 587, 659, 784, 880, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, "sine", 0.1), i * 100);
  });
}

// Game over — sad descending
export function playGameOver() {
  playTone(440, 0.3, "sawtooth", 0.08, 200);
  setTimeout(() => playTone(330, 0.3, "sawtooth", 0.08, 150), 200);
  setTimeout(() => playTone(220, 0.4, "sawtooth", 0.08, 100), 400);
}
