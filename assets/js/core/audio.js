/* Web Audio, created lazily after a user gesture and silent unless the
   sound setting is on. Several tools use it, so it lives in one place. */

import { get } from './state.js';

let ctx = null;
let master = null;

export function ready() {
  if (!get().settings.sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function context() { return ctx; }
export function out() { return master; }

/** A short shaped tone. Returns silently when sound is off. */
export function tone(freq = 440, dur = 0.18, type = 'sine', gain = 1) {
  const c = ready();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * gain), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return osc;
}

/** A held oscillator the caller controls, used by the signal generator. */
export function holdTone(freq, type = 'sine') {
  const c = ready();
  if (!c) return null;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.03);
  osc.connect(g).connect(master);
  osc.start();
  return {
    node: osc, gain: g,
    setFreq: f => { osc.frequency.setTargetAtTime(f, c.currentTime, 0.01); },
    setType: t => { osc.type = t; },
    stop: () => {
      g.gain.setTargetAtTime(0.0001, c.currentTime, 0.02);
      setTimeout(() => { try { osc.stop(); } catch {} }, 120);
    }
  };
}

export function beep() { tone(880, 0.08, 'square', 0.6); }
export function blip() { tone(1320, 0.05, 'triangle', 0.4); }
