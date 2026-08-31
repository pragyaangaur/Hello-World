/* The room the game is played in.

   It reads one number, how far along the game is, and turns it into colour,
   grain, noise, and things that make a person look up. It gets worse on a
   curve rather than in steps, so nothing here ever announces itself.

   Flashes are kept to one every few minutes and never repeat quickly, which
   keeps the page well under the rate that causes trouble for photosensitive
   people. When the operating system asks for reduced motion, every sudden
   effect turns itself off and the game plays exactly the same. */

import { get, chapter } from '../core/state.js';
import { on, emit } from '../core/bus.js';
import { ready, tone, out, context } from '../core/audio.js';
import { $ } from '../core/dom.js';
import { LAST_ACT } from './acts.js';

let hum = null;
let beatTimer = null;
let creepTimer = null;
let running = false;
let level = 0;
let over = false;

const calmSystem = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* How bad things are, from 0 to 1. Once the player has sent the word, the
   room stops being a threat and this goes to nothing. */
export function heat() {
  if (over) return 0;
  const base = Math.min(1, chapter() / LAST_ACT);
  return get().flags['said.lied'] ? Math.min(1, base + 0.07) : base;
}

function effectsOn() { return !calmSystem(); }
function soundOn() { return !calmSystem() && get().settings.sound !== false; }

/* ---- the continuous layer ---- */

function paintRoom() {
  const root = document.documentElement;
  const h = heat();
  root.dataset.heat = String(Math.round(h * 10));

  if (!effectsOn()) {
    root.style.removeProperty('--scan');
    root.style.removeProperty('--grain');
    root.style.removeProperty('--sat');
    return;
  }
  root.style.setProperty('--scan', (h * 0.07).toFixed(3));
  root.style.setProperty('--grain', (0.008 + h * 0.055).toFixed(3));
  root.style.setProperty('--sat', (1 - h * 0.24).toFixed(3));
}

function paintFavicon() {
  const h = heat();
  const from = [46, 158, 107];
  const to = [216, 72, 40];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * h));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="rgb(${mix.join(',')})"/><path d="M9 16.5l4.5 4.5L23 11.5" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ---- sound ---- */

/* A fan that should have been switched off two years ago. */
function paintHum() {
  if (!soundOn() || heat() < 0.12) { stopHum(); return; }
  const ctx = ready();
  if (!ctx) return;
  if (!hum) {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    sub.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.value = 190;
    gain.gain.value = 0.0001;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(out());
    osc.start(); sub.start();
    hum = { osc, sub, gain, filter };
  }
  const t = ready().currentTime;
  hum.gain.gain.setTargetAtTime(0.02 + heat() * 0.075, t, 1.4);
  hum.osc.frequency.setTargetAtTime(47 + heat() * 30, t, 2);
  hum.sub.frequency.setTargetAtTime(23 + heat() * 12, t, 2);
  hum.filter.frequency.setTargetAtTime(190 + heat() * 420, t, 2);
}

function stopHum() {
  if (!hum) return;
  const ctx = context();
  try {
    if (ctx) hum.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => { try { hum.osc.stop(); hum.sub.stop(); } catch {} hum = null; }, 900);
  } catch { hum = null; }
}

/* A burst of noise, which is the least musical sound this app can make. */
function hiss(duration = 0.14, gain = 0.35) {
  const ctx = ready();
  if (!ctx) return;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  filter.type = 'bandpass';
  filter.frequency.value = 900 + Math.random() * 2200;
  g.gain.value = gain;
  src.buffer = buffer;
  src.connect(filter).connect(g).connect(out());
  src.start();
}

/* Something almost like a voice, which is worse than a voice. */
function formant() {
  const ctx = ready();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(96, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(148, ctx.currentTime + 0.5);
  filter.type = 'bandpass';
  filter.Q.value = 9;
  filter.frequency.setValueAtTime(620, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(1180, ctx.currentTime + 0.5);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.62);
  osc.connect(filter).connect(g).connect(out());
  osc.start();
  osc.stop(ctx.currentTime + 0.7);
}

export function relayClick() {
  if (!soundOn()) return;
  tone(190, 0.05, 'square', 0.5);
  setTimeout(() => tone(120, 0.09, 'square', 0.35), 55);
}

/* ---- the drip of small wrong things ------------------------------------
   One event at a time, spaced minutes apart early on and closing in later.
   The list of what can happen grows as the game does. */

function scheduleCreep() {
  clearTimeout(creepTimer);
  if (!running || over || level < 2) return;
  const gap = 62000 - Math.min(level, LAST_ACT) * 5200;
  creepTimer = setTimeout(() => { creep(); scheduleCreep(); }, gap + Math.random() * gap * 0.6);
}

function creep() {
  if (document.hidden) return;
  const bag = ['flick', 'hiss'];
  if (level >= 3) bag.push('glitch', 'dim');
  if (level >= 5) bag.push('formant', 'shudder');
  const pick = bag[Math.floor(Math.random() * bag.length)];

  if (pick === 'flick') flick();
  else if (pick === 'hiss') { if (soundOn()) hiss(0.1, 0.22); }
  else if (pick === 'glitch') glitch();
  else if (pick === 'dim') dim();
  else if (pick === 'formant') { if (soundOn()) formant(); }
  else if (pick === 'shudder') shudder();
}

function scheduleBeat() {
  clearTimeout(beatTimer);
  if (!running || over || heat() < 0.3) return;
  const gap = 30000 - heat() * 19000;
  beatTimer = setTimeout(() => {
    if (soundOn() && !document.hidden) tone(1180, 0.045, 'sine', 0.22);
    scheduleBeat();
  }, gap + Math.random() * 5000);
}

function withFx(fn) {
  const fx = $('#fx');
  if (!fx || !effectsOn()) return;
  fn(fx);
}

function flick() {
  withFx(fx => {
    fx.style.transition = 'none';
    fx.style.background = 'rgba(0,0,0,.32)';
    setTimeout(() => { fx.style.background = ''; }, 70);
  });
}

function dim() {
  withFx(fx => {
    fx.style.transition = 'opacity 900ms ease';
    fx.style.background = 'rgba(0,0,0,.28)';
    fx.style.opacity = '1';
    setTimeout(() => {
      fx.style.opacity = '0';
      setTimeout(() => { fx.style.background = ''; fx.style.transition = ''; fx.style.opacity = ''; }, 950);
    }, 700);
  });
}

/* The interface stops being able to hold still. */
function shudder() {
  if (!effectsOn()) return;
  const app = $('#app');
  if (!app) return;
  if (soundOn()) hiss(0.06, 0.18);
  app.style.transition = 'none';
  let n = 0;
  const step = () => {
    n++;
    app.style.transform = n > 6 ? '' : `translate(${(Math.random() - .5) * 4}px, ${(Math.random() - .5) * 3}px)`;
    if (n <= 6) setTimeout(step, 45);
    else { app.style.transform = ''; app.style.transition = ''; }
  };
  step();
}

/* Letters in the interface come loose for a moment. */
export function glitch() {
  if (!effectsOn()) return;
  const brand = document.querySelector('.brand-name');
  const targets = [brand, ...document.querySelectorAll('.task-text')].filter(Boolean).slice(0, 5);
  if (!targets.length) return;
  const target = targets[Math.floor(Math.random() * targets.length)];
  const real = target.textContent;
  const junk = '!<>-_\\/[]{}=+*^?#01';
  let frame = 0;
  if (soundOn()) hiss(0.05, 0.14);
  const id = setInterval(() => {
    frame++;
    target.textContent = real.split('').map((c, i) =>
      (c === ' ' || Math.random() > 0.4 - frame * 0.05) ? c : junk[Math.floor(Math.random() * junk.length)]
    ).join('');
    if (frame > 6) { clearInterval(id); target.textContent = real; }
  }, 42);
}

/* ---- the scripted moments ---- */

export function blackout(ms = 620) {
  return new Promise(resolve => {
    if (!effectsOn()) { resolve(); return; }
    const fx = $('#fx');
    if (!fx) { resolve(); return; }
    if (soundOn()) {
      tone(70, 0.22, 'square', 0.9);
      hiss(0.3, 0.4);
      setTimeout(() => tone(150, 0.06, 'square', 0.5), 200);
    }
    fx.style.transition = 'none';
    fx.style.background = '#000';
    fx.style.opacity = '1';
    setTimeout(() => {
      fx.style.transition = 'opacity 300ms linear';
      fx.style.opacity = '0';
      setTimeout(() => {
        fx.style.background = ''; fx.style.transition = ''; fx.style.opacity = '';
        resolve();
      }, 320);
    }, ms);
  });
}

/* One slow flash. It fades over most of a second rather than blinking, which
   is what keeps it well under the rate that hurts people. */
export function flash() {
  withFx(fx => {
    if (soundOn()) { tone(320, 0.5, 'triangle', 0.8); hiss(0.2, 0.3); }
    fx.style.transition = 'none';
    /* Not the accent colour. Early in the game the accent is a friendly green
       and a cheerful flash is the wrong thing entirely. */
    fx.style.background = 'var(--danger)';
    fx.style.opacity = '.85';
    requestAnimationFrame(() => {
      fx.style.transition = 'opacity 820ms ease-out';
      fx.style.opacity = '0';
      setTimeout(() => { fx.style.background = ''; fx.style.transition = ''; fx.style.opacity = ''; }, 860);
    });
  });
}

export async function wipe() {
  emit('fx:wipe', { state: 'out' });
  if (soundOn()) { tone(90, 0.4, 'sine', 0.6); hiss(0.5, 0.25); }
  await new Promise(r => setTimeout(r, effectsOn() ? 2100 : 400));
  emit('fx:wipe', { state: 'in' });
  relayClick();
}

/* ---- the way out ---------------------------------------------------------
   The one thing the old ending never did was stop. The screen stayed red and
   the fan stayed on, so nobody could tell whether the game had finished or
   had simply stopped responding. This drains all of it: the grain, the tint,
   the scanlines, the hum, and every timer that was going to make something
   twitch. It takes four seconds, on purpose, so the player watches the room
   let go of them. */
export function settle() {
  if (over) return;
  over = true;
  clearTimeout(beatTimer);
  clearTimeout(creepTimer);
  stopHum();
  document.documentElement.dataset.over = '1';
  const fx = $('#fx');
  if (fx) { fx.style.background = ''; fx.style.opacity = ''; fx.style.transition = ''; }
  paintRoom();
  paintFavicon();
  if (soundOn()) {
    /* Three notes going up, which is the only unambiguous sound in the app. */
    tone(392, 0.5, 'sine', 0.35);
    setTimeout(() => tone(523, 0.5, 'sine', 0.35), 260);
    setTimeout(() => tone(659, 0.9, 'sine', 0.3), 520);
  }
}

/* ---- lifecycle ---- */

/* Called on every act change. The room gets one notch worse each time. */
export function escalate(n) {
  if (over) return;
  level = n;
  paintRoom();
  paintFavicon();
  paintHum();
  scheduleBeat();
  scheduleCreep();
}

function watchVisibility() {
  let awayAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      awayAt = Date.now();
      if (chapter() >= 2 && !over) document.title = 'still here · Hello World';
      return;
    }
    document.title = document.title.replace('still here · ', '');
    if (Date.now() - awayAt > 45000 && chapter() >= 2) emit('story:returned', {});
  });
}

export function startAtmosphere() {
  if (running) return;
  running = true;
  over = Boolean(get().flags['story.settled']);
  if (over) document.documentElement.dataset.over = '1';
  escalate(chapter());
  paintRoom();
  paintFavicon();
  watchVisibility();

  on('story:act', ({ to }) => escalate(to));
  on('flag', () => { paintRoom(); paintFavicon(); });
  on('settings:change', () => { paintRoom(); if (soundOn()) paintHum(); else stopHum(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => escalate(level));

  /* A browser will not make a sound until the person has clicked something. */
  const wake = () => { paintHum(); removeEventListener('pointerdown', wake); };
  addEventListener('pointerdown', wake, { once: true });
}
