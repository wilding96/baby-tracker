"use client";

import { useEffect, useRef, useCallback } from "react";

export interface GameAudio {
  initAudio: () => void;
  shoot: () => void;
  shootLaser: () => void;
  shootWave: () => void;
  explosion: () => void;
  bossExplosion: () => void;
  playerHit: () => void;
  coinCollect: () => void;
  bomb: () => void;
  powerUp: () => void;
  bossWarning: () => void;
  gachaCard: () => void;
  buttonClick: () => void;
  startBGM: () => void;
  stopBGM: () => void;
}

function noop() {}

export function useGameAudio(): GameAudio {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const bgmNodesRef = useRef<Set<OscillatorNode | AudioBufferSourceNode>>(new Set());
  const coinCooldownRef = useRef(0);
  const shootCooldownRef = useRef(0);  // throttle rapid shoot sfx
  const maxBgmNodes = 180;  // hard cap to prevent runaway

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return null;
    if (!ctxRef.current) {
      ctxRef.current = new AC();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = 0.5;
      masterRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const initAudio = useCallback(() => {
    getCtx();
  }, [getCtx]);

  const ensureRunning = useCallback((ctx: AudioContext) => {
    if (ctx.state === "closed") return false;
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }, []);

  const playTone = useCallback(
    (
      type: OscillatorType,
      freq: number,
      endFreq: number | undefined,
      gainVal: number,
      duration: number,
      filterType?: BiquadFilterType,
      filterFreq?: number,
      filterQ?: number,
    ) => {
      const ctx = getCtx();
      if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;

      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      if (endFreq !== undefined) {
        osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
      }

      let node: AudioNode = osc;
      if (filterType && filterFreq) {
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;
        if (filterQ !== undefined) filter.Q.value = filterQ;
        osc.connect(filter);
        node = filter;
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      node.connect(gain);
      gain.connect(masterRef.current);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.05);
      osc.onended = () => {
        gain.disconnect();
        osc.disconnect();
      };
    },
    [getCtx, ensureRunning],
  );

  const playNoise = useCallback(
    (
      gainVal: number,
      duration: number,
      filterType?: BiquadFilterType,
      filterFreq?: number,
      filterQ?: number,
    ) => {
      const ctx = getCtx();
      if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;

      const sr = ctx.sampleRate;
      const len = Math.floor(sr * duration);
      const buffer = ctx.createBuffer(1, len, sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      let node: AudioNode = src;
      if (filterType && filterFreq) {
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;
        if (filterQ !== undefined) filter.Q.value = filterQ;
        src.connect(filter);
        node = filter;
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      node.connect(gain);
      gain.connect(masterRef.current);

      src.start(ctx.currentTime);
      src.stop(ctx.currentTime + duration + 0.05);
      src.onended = () => {
        gain.disconnect();
        src.disconnect();
      };
    },
    [getCtx, ensureRunning],
  );

  const shoot = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    // throttle: max 1 shoot sfx per 40ms (game requests ~every 133ms, so usually no-op)
    if (shootCooldownRef.current > 0) { shootCooldownRef.current--; return; }
    shootCooldownRef.current = 2;  // ~2 frames cooldown
    // crisp high-frequency zap — classic STG shoot
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.06);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3000;
    osc.connect(lp);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    lp.connect(gain);
    gain.connect(masterRef.current);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => { gain.disconnect(); lp.disconnect(); osc.disconnect(); };
  }, [getCtx, ensureRunning]);

  // laser shoot — higher, piercing whine
  const shootLaser = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    if (shootCooldownRef.current > 0) { shootCooldownRef.current--; return; }
    shootCooldownRef.current = 2;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4000;
    osc.connect(lp);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    lp.connect(gain);
    gain.connect(masterRef.current);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
    osc.onended = () => { gain.disconnect(); lp.disconnect(); osc.disconnect(); };
  }, [getCtx, ensureRunning]);

  // wave shoot — soft plasma pulse
  const shootWave = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    if (shootCooldownRef.current > 0) { shootCooldownRef.current--; return; }
    shootCooldownRef.current = 2;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(masterRef.current);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  }, [getCtx, ensureRunning]);

  const explosion = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    // Layer 1: low thump
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(120, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.25, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    sub.connect(subGain);
    subGain.connect(masterRef.current!);
    sub.start(ctx.currentTime);
    sub.stop(ctx.currentTime + 0.21);
    sub.onended = () => { subGain.disconnect(); sub.disconnect(); };

    // Layer 2: crackle noise (short burst)
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 0.12);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 0.5;
    src.connect(bp);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    bp.connect(ng);
    ng.connect(masterRef.current!);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + 0.13);
    src.onended = () => { ng.disconnect(); bp.disconnect(); src.disconnect(); };
  }, [getCtx, ensureRunning]);

  const bossExplosion = useCallback(() => {
    playNoise(0.3, 0.5, "bandpass", 500, 0.5);
    playTone("sawtooth", 200, 30, 0.2, 0.6);

    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    // delayed second burst
    const src2 = ctx.createBufferSource();
    const sr = ctx.sampleRate;
    const len2 = Math.floor(sr * 0.3);
    const buf2 = ctx.createBuffer(1, len2, sr);
    const d2 = buf2.getChannelData(0);
    for (let i = 0; i < len2; i++) d2[i] = Math.random() * 2 - 1;
    src2.buffer = buf2;

    const filter2 = ctx.createBiquadFilter();
    filter2.type = "lowpass";
    filter2.frequency.value = 300;
    src2.connect(filter2);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    filter2.connect(gain2);
    gain2.connect(masterRef.current!);

    src2.start(ctx.currentTime + 0.15);
    src2.stop(ctx.currentTime + 0.55);
    src2.onended = () => { gain2.disconnect(); filter2.disconnect(); src2.disconnect(); };
  }, [playNoise, playTone, getCtx, ensureRunning]);

  const playerHit = useCallback(() => {
    playNoise(0.25, 0.15, "notch", 1000, 3);
  }, [playNoise]);

  const coinCollect = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    coinCooldownRef.current = (coinCooldownRef.current + 1) % 3;
    if (coinCooldownRef.current !== 0) return;

    const freqs = [880, 1100, 1320];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2000;
      osc.connect(lp);

      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.06;
      const dur = i === 2 ? 0.12 : 0.08;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      lp.connect(gain);
      gain.connect(masterRef.current!);

      osc.start(start);
      osc.stop(start + dur + 0.02);
      osc.onended = () => { gain.disconnect(); lp.disconnect(); osc.disconnect(); };
    });
  }, [getCtx, ensureRunning]);

  const bomb = useCallback(() => {
    playTone("sine", 200, 40, 0.3, 0.5);
    playNoise(0.2, 0.5, "lowpass", 400);

    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 60;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(g);
    g.connect(masterRef.current!);
    osc.start(ctx.currentTime + 0.05);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => { g.disconnect(); osc.disconnect(); };
  }, [playTone, playNoise, getCtx, ensureRunning]);

  const powerUp = useCallback(() => {
    playTone("sine", 600, 1800, 0.15, 0.3);
    playTone("sine", 1200, 3600, 0.08, 0.3);
  }, [playTone]);

  const bossWarning = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    const tones = [250, 350];
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = tones[i % 2];

      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain);
      gain.connect(masterRef.current!);

      osc.start(start);
      osc.stop(start + 0.15);
      osc.onended = () => { gain.disconnect(); osc.disconnect(); };
    }
  }, [getCtx, ensureRunning]);

  const gachaCard = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;

      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain);
      gain.connect(masterRef.current!);

      osc.start(start);
      osc.stop(start + 0.17);
      osc.onended = () => { gain.disconnect(); osc.disconnect(); };
    });

    // high shimmer
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 2000;
    const sg = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(sg.gain);
    sg.gain.setValueAtTime(0.04, ctx.currentTime);
    sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    shimmer.connect(sg);
    sg.connect(masterRef.current!);
    shimmer.start(ctx.currentTime);
    shimmer.stop(ctx.currentTime + 0.5);
    lfo.start(ctx.currentTime);
    lfo.stop(ctx.currentTime + 0.5);
    shimmer.onended = () => { sg.disconnect(); shimmer.disconnect(); lfoGain.disconnect(); lfo.disconnect(); };
  }, [getCtx, ensureRunning]);

  const buttonClick = useCallback(() => {
    playTone("square", 800, undefined, 0.06, 0.02);
  }, [playTone]);

  // ─── BGM: chiptune-style with proper chord progression ────────────────────
  // Key: A minor — classic moody STG feel
  // Chord progression: Am - F - C - G (vi-IV-I-V in C, very melodic)

  const beatLen = 0.375; // 160 BPM (0.375s per beat)
  const barLen = beatLen * 4; // 1.5s per bar
  const loopLen = barLen * 8; // 8 bars = 12s loop — longer = less repetitive

  interface BgmNote { freq: number; start: number; dur: number; type: OscillatorType; vol: number; }

  // Chord tones for A-minor progression
  // Am: A C E  / F: F A C  / C: C E G  / G: G B D
  const f = (base: number, semi: number) => base * Math.pow(2, semi / 12);

  const A2 = 110, A3 = 220, A4 = 440, A5 = 880;
  const C4 = f(A3, 3), E4 = f(A3, 7), G4 = f(A3, 10);
  const F3 = f(A3, -4), F4 = f(A4, -4);
  const D4 = f(A3, 5), B3 = f(A3, 2), G3 = f(A3, -2);

  // Arpeggiated melody — plays chord tones in quick sequence (very STG)
  // 8-bar loop: Am - F - C - G - Am - F - C - G
  const melodyNotes: BgmNote[] = [
    // Bar 1 (Am)
    { freq: A4,   start: 0,               dur: 0.12, type: "square", vol: 0.05 },
    { freq: C4,   start: beatLen,         dur: 0.10, type: "square", vol: 0.045 },
    { freq: E4,   start: beatLen * 2,     dur: 0.10, type: "square", vol: 0.045 },
    { freq: A4,   start: beatLen * 2.75,  dur: 0.10, type: "square", vol: 0.045 },
    { freq: C4,   start: beatLen * 3.5,   dur: 0.08, type: "square", vol: 0.04 },
    // Bar 2 (F)
    { freq: F4,   start: barLen,          dur: 0.12, type: "square", vol: 0.05 },
    { freq: A3,   start: barLen + beatLen, dur: 0.10, type: "square", vol: 0.045 },
    { freq: C4,   start: barLen + beatLen * 2, dur: 0.10, type: "square", vol: 0.045 },
    { freq: F4,   start: barLen + beatLen * 2.75, dur: 0.10, type: "square", vol: 0.045 },
    { freq: A3,   start: barLen + beatLen * 3.5, dur: 0.08, type: "square", vol: 0.04 },
    // Bar 3 (C)
    { freq: C4,   start: barLen * 2,      dur: 0.12, type: "square", vol: 0.05 },
    { freq: E4,   start: barLen * 2 + beatLen, dur: 0.10, type: "square", vol: 0.045 },
    { freq: G4,   start: barLen * 2 + beatLen * 2, dur: 0.10, type: "square", vol: 0.045 },
    { freq: C4,   start: barLen * 2 + beatLen * 3, dur: 0.14, type: "square", vol: 0.05 },
    // Bar 4 (G) — resolving
    { freq: B3,   start: barLen * 3,      dur: 0.10, type: "square", vol: 0.045 },
    { freq: D4,   start: barLen * 3 + beatLen, dur: 0.10, type: "square", vol: 0.045 },
    { freq: G4,   start: barLen * 3 + beatLen * 2, dur: 0.12, type: "square", vol: 0.045 },
    { freq: A4,   start: barLen * 3 + beatLen * 3.5, dur: 0.20, type: "square", vol: 0.05 },
    // Bar 5 (Am) — variation with higher octave
    { freq: A5,   start: barLen * 4,      dur: 0.08, type: "square", vol: 0.05 },
    { freq: A4,   start: barLen * 4 + beatLen * 0.5, dur: 0.07, type: "square", vol: 0.04 },
    { freq: E4,   start: barLen * 4 + beatLen, dur: 0.10, type: "square", vol: 0.045 },
    { freq: C4,   start: barLen * 4 + beatLen * 2, dur: 0.10, type: "square", vol: 0.045 },
    { freq: A4,   start: barLen * 4 + beatLen * 3, dur: 0.12, type: "square", vol: 0.05 },
    // Bar 6 (F) — variation
    { freq: F4,   start: barLen * 5,      dur: 0.10, type: "square", vol: 0.045 },
    { freq: F3,   start: barLen * 5 + beatLen, dur: 0.10, type: "square", vol: 0.04 },
    { freq: C4,   start: barLen * 5 + beatLen * 2, dur: 0.10, type: "square", vol: 0.045 },
    { freq: F4,   start: barLen * 5 + beatLen * 3, dur: 0.14, type: "square", vol: 0.05 },
    // Bar 7 (C) — variation
    { freq: G4,   start: barLen * 6,      dur: 0.10, type: "square", vol: 0.045 },
    { freq: E4,   start: barLen * 6 + beatLen, dur: 0.10, type: "square", vol: 0.045 },
    { freq: C4,   start: barLen * 6 + beatLen * 2, dur: 0.12, type: "square", vol: 0.05 },
    { freq: E4,   start: barLen * 6 + beatLen * 3.5, dur: 0.07, type: "square", vol: 0.04 },
    // Bar 8 (G) — resolving with flourish
    { freq: D4,   start: barLen * 7,      dur: 0.10, type: "square", vol: 0.045 },
    { freq: G4,   start: barLen * 7 + beatLen, dur: 0.10, type: "square", vol: 0.045 },
    { freq: B3,   start: barLen * 7 + beatLen * 2, dur: 0.12, type: "square", vol: 0.045 },
    { freq: A4,   start: barLen * 7 + beatLen * 3.5, dur: 0.20, type: "square", vol: 0.05 },
  ];

  const bassNotes: BgmNote[] = [
    // 8-bar loop
    { freq: A2, start: 0,        dur: 0.30, type: "square", vol: 0.055 },
    { freq: A2, start: beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: F3, start: barLen,   dur: 0.30, type: "square", vol: 0.055 },
    { freq: F3, start: barLen + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: A2, start: barLen * 2, dur: 0.30, type: "square", vol: 0.055 },
    { freq: A2, start: barLen * 2 + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: F3, start: barLen * 3, dur: 0.30, type: "square", vol: 0.055 },
    { freq: F3, start: barLen * 3 + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: A2, start: barLen * 4, dur: 0.30, type: "square", vol: 0.055 },
    { freq: A2, start: barLen * 4 + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: F3, start: barLen * 5, dur: 0.30, type: "square", vol: 0.055 },
    { freq: F3, start: barLen * 5 + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: A2, start: barLen * 6, dur: 0.30, type: "square", vol: 0.055 },
    { freq: A2, start: barLen * 6 + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
    { freq: F3, start: barLen * 7, dur: 0.30, type: "square", vol: 0.055 },
    { freq: F3, start: barLen * 7 + beatLen * 2, dur: 0.30, type: "square", vol: 0.05 },
  ];

  // Percussion — 8-bar loop pattern
  const kickTicks: number[] = [];
  const snareTicks: number[] = [];
  const hatTicks: number[] = [];
  for (let bar = 0; bar < 8; bar++) {
    for (let b = 0; b < 4; b++) {
      kickTicks.push(bar * barLen + b * beatLen);
      if (b === 1 || b === 3) {
        snareTicks.push(bar * barLen + b * beatLen);
      }
      hatTicks.push(bar * barLen + b * beatLen);
      hatTicks.push(bar * barLen + b * beatLen + beatLen / 2);
    }
  }

  // Pre-generated noise buffer reused across all percussion ticks
  const noiseBufRef = useRef<AudioBuffer | null>(null);

  const bgmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgmScheduledRef = useRef<number>(0);

  const stopBGM = useCallback(() => {
    if (bgmIntervalRef.current !== null) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    bgmScheduledRef.current = 0;
    const nodes = bgmNodesRef.current;
    for (const n of nodes) {
      try { n.stop(); } catch {}
      // disconnect all outgoing connections
      n.disconnect();
    }
    bgmNodesRef.current.clear();
  }, []);

  const startBGM = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !ensureRunning(ctx) || !masterRef.current) return;

    stopBGM();

    // pre-generate noise buffer once and reuse
    if (!noiseBufRef.current) {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 0.02);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noiseBufRef.current = buf;
    }

    const scheduleBGMBlock = (offset: number) => {
      const master = masterRef.current!;
      const baseT = offset;
      // Hard cap — if we already have too many nodes, skip scheduling new ones
      if (bgmNodesRef.current.size > maxBgmNodes) return;

      const makeOscNode = (
        type: OscillatorType,
        freq: number,
        dur: number,
        vol: number,
        lpCut: number,
        startOffset: number,
        onTick?: (osc: OscillatorNode, gain: GainNode, start: number) => void,
      ) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = lpCut;
        osc.connect(lp);

        const gain = ctx.createGain();
        const s = baseT + startOffset;
        gain.gain.setValueAtTime(0.001, s);
        gain.gain.linearRampToValueAtTime(vol, s + 0.003);
        gain.gain.setValueAtTime(vol * 0.66, s + dur * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
        lp.connect(gain);
        gain.connect(master);

        bgmNodesRef.current.add(osc);
        osc.start(s);
        osc.stop(s + dur + 0.02);
        osc.onended = () => {
          bgmNodesRef.current.delete(osc);
          gain.disconnect(); lp.disconnect(); osc.disconnect();
        };
        if (onTick) onTick(osc, gain, s);
      };

      // Melody (square-arp) — uses n.start for timing
      melodyNotes.forEach((n) => {
        makeOscNode("square", n.freq, n.dur, n.vol, n.freq * 1.8, n.start);
      });

      // Bass (square with dip) — uses n.start for timing
      bassNotes.forEach((n) => {
        makeOscNode("square", n.freq * 1.2, n.dur, n.vol, 250, n.start, (osc, gain, s) => {
          osc.frequency.exponentialRampToValueAtTime(n.freq, s + 0.02);
        });
      });

      // Kick (sub sine sweep)
      kickTicks.forEach((b) => {
        const s = baseT + b;
        const kickOsc = ctx.createOscillator();
        kickOsc.type = "sine";
        kickOsc.frequency.setValueAtTime(120, s);
        kickOsc.frequency.exponentialRampToValueAtTime(40, s + 0.08);

        const kickGain = ctx.createGain();
        kickGain.gain.setValueAtTime(0.12, s);
        kickGain.gain.exponentialRampToValueAtTime(0.001, s + 0.12);
        kickOsc.connect(kickGain);
        kickGain.connect(master);

        bgmNodesRef.current.add(kickOsc);
        kickOsc.start(s);
        kickOsc.stop(s + 0.13);
        kickOsc.onended = () => {
          bgmNodesRef.current.delete(kickOsc);
          kickGain.disconnect(); kickOsc.disconnect();
        };
      });

      // Snare (noise burst + bandpass)
      snareTicks.forEach((b) => {
        const s = baseT + b;
        const len = Math.floor(ctx.sampleRate * 0.08);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 3500;
        bp.Q.value = 0.8;
        src.connect(bp);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.06, s);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.08);
        bp.connect(gain);
        gain.connect(master);
        src.start(s);
        src.stop(s + 0.09);
        // Note: AudioBufferSourceNodes auto-stop; don't add to bgmNodes set (they self-clean)
      });

      // Hi-hat (short noise tick)
      hatTicks.forEach((b) => {
        const s = baseT + b;
        const src = ctx.createBufferSource();
        src.buffer = noiseBufRef.current!;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 6000;
        src.connect(hp);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.015, s);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.01);
        hp.connect(gain);
        gain.connect(master);
        src.start(s);
        src.stop(s + 0.015);
      });
    };

    const scheduleLoop = () => {
      const now = ctx.currentTime;
      // Only schedule when we're within 0.75 loop lengths of running out
      if (bgmScheduledRef.current > now + loopLen * 0.75) return;
      scheduleBGMBlock(bgmScheduledRef.current);
      bgmScheduledRef.current += loopLen;
    };

    // kick off immediately
    scheduleLoop();
    // poll at 60% of loop duration — keeps ~1.5 loops ahead, never 3+
    const pollMs = Math.max(1500, Math.floor(loopLen * 600));
    bgmIntervalRef.current = setInterval(scheduleLoop, pollMs);
  }, [getCtx, ensureRunning, stopBGM]);

  useEffect(() => {
    return () => {
      stopBGM();
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
    };
  }, [stopBGM]);

  return {
    initAudio,
    shoot,
    shootLaser,
    shootWave,
    explosion,
    bossExplosion,
    playerHit,
    coinCollect,
    bomb,
    powerUp,
    bossWarning,
    gachaCard,
    buttonClick,
    startBGM,
    stopBGM,
  };
}
