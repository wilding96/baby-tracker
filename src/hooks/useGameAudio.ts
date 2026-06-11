"use client";

import { useEffect, useRef, useCallback } from "react";

export interface GameAudio {
  initAudio: () => void;
  shoot: () => void;
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
  const bgmNodesRef = useRef<OscillatorNode[]>([]);
  const coinCooldownRef = useRef(0);

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

  const shoot = noop;

  const explosion = useCallback(() => {
    playNoise(0.2, 0.25, "bandpass", 800, 0.5);
    playTone("sawtooth", 400, 80, 0.12, 0.2);
  }, [playNoise, playTone]);

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

  // ─── BGM: chiptune-style loop ──────────────────────────────────

  const beatLen = 0.4; // 150 BPM
  const barLen = beatLen * 4; // 1.6s per bar
  const loopLen = barLen * 4; // 6.4s total loop

  interface Note { freq: number; start: number; dur: number; }

  // Melody — square wave, higher octave
  const melodyNotes: Note[] = [
    // Bar 1
    { freq: 659, start: 0, dur: 0.6 },
    { freq: 587, start: 1.2, dur: 0.2 },
    { freq: 523, start: 1.6, dur: 0.6 },
    { freq: 587, start: 2.8, dur: 0.2 },
    { freq: 659, start: 3.2, dur: 0.9 },
    { freq: 784, start: 4.8, dur: 0.4 },
    // Bar 2
    { freq: 880, start: 6.4, dur: 0.6 },
    { freq: 784, start: 7.6, dur: 0.2 },
    { freq: 659, start: 8.0, dur: 0.6 },
    { freq: 587, start: 9.2, dur: 0.2 },
    { freq: 523, start: 9.6, dur: 0.9 },
    // Bar 3
    { freq: 659, start: 12.8, dur: 0.2 },
    { freq: 784, start: 13.2, dur: 0.2 },
    { freq: 880, start: 13.6, dur: 0.2 },
    { freq: 1047, start: 14.0, dur: 0.2 },
    { freq: 1175, start: 14.4, dur: 0.6 },
    { freq: 1047, start: 15.6, dur: 0.2 },
    { freq: 880, start: 16.0, dur: 0.6 },
    // Bar 4
    { freq: 784, start: 19.2, dur: 0.4 },
    { freq: 659, start: 20.0, dur: 0.4 },
    { freq: 587, start: 20.8, dur: 0.4 },
    { freq: 523, start: 21.6, dur: 0.6 },
  ];

  // Bass — triangle wave, lower octave
  const bassNotes: Note[] = [
    // Bar 1
    { freq: 220, start: 0, dur: 0.6 },
    { freq: 165, start: 1.6, dur: 0.6 },
    { freq: 220, start: 3.2, dur: 0.6 },
    { freq: 262, start: 4.8, dur: 0.6 },
    // Bar 2
    { freq: 175, start: 6.4, dur: 0.6 },
    { freq: 262, start: 8.0, dur: 0.6 },
    { freq: 220, start: 9.6, dur: 0.6 },
    { freq: 165, start: 11.2, dur: 0.6 },
    // Bar 3
    { freq: 220, start: 12.8, dur: 0.6 },
    { freq: 262, start: 14.4, dur: 0.9 },
    { freq: 294, start: 17.6, dur: 0.6 },
    // Bar 4
    { freq: 330, start: 19.2, dur: 0.6 },
    { freq: 262, start: 20.8, dur: 0.6 },
    { freq: 220, start: 22.4, dur: 0.6 },
    { freq: 165, start: 24.0, dur: 0.6 },
  ];

  // Percussion — noise ticks every quarter note (reduced from 8th for performance)
  const beatTicks: number[] = [];
  for (let b = 0; b < 16; b++) {
    beatTicks.push(b * beatLen); // quarter notes
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
    }
    bgmNodesRef.current = [];
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

      // Melody — square wave with vibrato via low-pass filter
      melodyNotes.forEach((n) => {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = n.freq;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = n.freq * 1.5;
        osc.connect(lp);

        const gain = ctx.createGain();
        const s = baseT + n.start;
        gain.gain.setValueAtTime(0.001, s);
        gain.gain.linearRampToValueAtTime(0.06, s + 0.005);
        gain.gain.setValueAtTime(0.06, s + n.dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, s + n.dur);
        lp.connect(gain);
        gain.connect(master);

        bgmNodesRef.current.push(osc);
        osc.start(s);
        osc.stop(s + n.dur + 0.02);
        osc.onended = () => {
          const idx = bgmNodesRef.current.indexOf(osc);
          if (idx >= 0) bgmNodesRef.current.splice(idx, 1);
          gain.disconnect(); lp.disconnect(); osc.disconnect();
        };
      });

      // Bass — triangle wave
      bassNotes.forEach((n) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = n.freq;

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 350;
        osc.connect(lp);

        const gain = ctx.createGain();
        const s = baseT + n.start;
        gain.gain.setValueAtTime(0.001, s);
        gain.gain.linearRampToValueAtTime(0.05, s + 0.008);
        gain.gain.setValueAtTime(0.05, s + n.dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, s + n.dur);
        lp.connect(gain);
        gain.connect(master);

        bgmNodesRef.current.push(osc);
        osc.start(s);
        osc.stop(s + n.dur + 0.02);
        osc.onended = () => {
          const idx = bgmNodesRef.current.indexOf(osc);
          if (idx >= 0) bgmNodesRef.current.splice(idx, 1);
          gain.disconnect(); lp.disconnect(); osc.disconnect();
        };
      });

      // Percussion — noise tick on each quarter note (reused buffer)
      beatTicks.forEach((b) => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBufRef.current!;

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 3000;
        src.connect(hp);

        const gain = ctx.createGain();
        const s = baseT + b;
        gain.gain.setValueAtTime(0.025, s);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.015);
        hp.connect(gain);
        gain.connect(master);

        src.start(s);
        src.stop(s + 0.02);
        src.onended = () => { gain.disconnect(); hp.disconnect(); src.disconnect(); };
      });
    };

    const scheduleLoop = () => {
      const now = ctx.currentTime;
      const nextStart = Math.max(now, bgmScheduledRef.current);
      // Only schedule if we're running low — schedule 1 loop at a time, further apart
      if (nextStart > now + loopLen * 0.5) return;

      // Schedule only 1 loop ahead instead of 2
      while (bgmScheduledRef.current < now + loopLen) {
        scheduleBGMBlock(bgmScheduledRef.current);
        bgmScheduledRef.current += loopLen;
      }
    };

    scheduleLoop();
    bgmIntervalRef.current = setInterval(scheduleLoop, 5000);
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
