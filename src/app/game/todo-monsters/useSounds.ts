"use client";

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.12, ramp?: number) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    if (ramp) osc.frequency.exponentialRampToValueAtTime(ramp, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch { /* audio not available */ }
}

function playNoise(duration: number, volume = 0.1) {
  try {
    const ctx = getCtx();
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(gain).connect(ctx.destination);
    src.start();
  } catch { /* audio not available */ }
}

// Spawn — rising magical chirp
export function playSpawn() {
  playTone(350, 0.1, "triangle", 0.08);
  setTimeout(() => playTone(520, 0.12, "triangle", 0.08), 70);
  setTimeout(() => playTone(700, 0.16, "sine", 0.1), 140);
}

// Select monster — short click
export function playSelect() {
  playTone(440 + Math.random() * 80, 0.07, "sine", 0.07);
}

// Defeat — noise burst + descending growl
export function playDefeat() {
  playNoise(0.22, 0.1);
  playTone(400, 0.2, "sawtooth", 0.1, 100);
}

// Error / desk full — low buzz
export function playError() {
  playTone(150, 0.18, "sawtooth", 0.08, 100);
}
