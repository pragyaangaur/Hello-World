/* The room the game is played in.

   Everything here is mood. It reads one number, how hot bay 3 is, and turns
   it into colour, grain, noise, and the occasional thing that makes a person
   look up. Nothing in this file changes what the player can do, so calm mode
   can switch all of it off and the game still finishes.

   Three moments are scripted rather than continuous. Those are the only times
   the app is allowed to be sudden, and the opening notice says so. */

import { get, chapter } from '../core/state.js';
import { on, emit } from '../core/bus.js';
import { ready, tone, out, context } from '../core/audio.js';
import { $ } from '../core/dom.js';

let hum = null;
let beatTimer = null;
let flickerTimer = null;
let running = false;

/* ---- how bad things are, from 0 to 1 ---- */

export function heat() {
  const ch = chapter();
  const base = [0, 0.08, 0.24, 0.46, 0.72, 0.92][ch] ?? 0;
  /* Confirming bay 3 by hand tells the script a person looked at it. The room
     does not get any cooler, it just stops being told about it. */
  return get().flags['said.lied'] ? Math.min(1, base + 0.08) : base;
}

function effectsOn() { return !get().settings.calm; }
function soundOn() { return !get().settings.calm && get().settings.sound; }

/* ---- the continuous layer ---- */

function paintRoom() {
  const root = document.documentElement;
  const h = heat();

  if (!effectsOn()) {
    root.style.removeProperty('--scan');
    root.style.removeProperty('--grain');
    root.style.removeProperty('--sat');
    return;
  }

  /* These sit on top of whatever the chapter palette already set, so the
     drift is smooth between chapters instead of stepping at each one. */
  root.style.setProperty('--scan', (h * 0.06).toFixed(3));
  root.style.setProperty('--grain', (0.01 + h * 0.05).toFixed(3));
  root.style.setProperty('--sat', (1 - h * 0.22).toFixed(3));
}

/* The tab icon warms up with the bench, so a player who has this open in a
   background tab still sees it change. */
function paintFavicon() {
  const h = heat();
  const from = [46, 158, 107];
  const to = [216, 88, 48];
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * h));
  const fill = `rgb(${mix.join(',')})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${fill}"/><path d="M9 16.5l4.5 4.5L23 11.5" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ---- sound ---- */

/* A fan that should have been switched off two years ago. It rises with the
   temperature and it is the only continuous sound in the game. */
function paintHum() {
  if (!soundOn() || heat() < 0.2) { stopHum(); return; }
  const ctx = ready();
  if (!ctx) return;
  if (!hum) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    gain.gain.value = 0.0001;
    osc.connect(filter).connect(gain).connect(out());
    osc.start();
    hum = { osc, gain, filter };
  }
  const level = 0.02 + heat() * 0.06;
  hum.gain.gain.setTargetAtTime(level, ready().currentTime, 1.5);
  hum.osc.frequency.setTargetAtTime(48 + heat() * 26, ready().currentTime, 2);
}

function stopHum() {
  if (!hum) return;
  const ctx = context();
  try {
    if (ctx) hum.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
    setTimeout(() => { try { hum.osc.stop(); } catch {} hum = null; }, 900);
  } catch { hum = null; }
}

/* The relay on the bench. It clicks when the script writes something. */
export function relayClick() {
  if (!soundOn()) return;
  tone(190, 0.05, 'square', 0.5);
  setTimeout(() => tone(120, 0.09, 'square', 0.35), 55);
}

/* A single beep whose gaps close as the pack heats. It is the clock of the
   whole game and it is meant to be slightly too slow to ignore. */
function scheduleBeat() {
  clearTimeout(beatTimer);
  const h = heat();
  if (!running || h < 0.35) return;
  const gap = 26000 - h * 17000;
  beatTimer = setTimeout(() => {
    if (soundOn() && !document.hidden) tone(1180, 0.045, 'sine', 0.22);
    scheduleBeat();
  }, gap + Math.random() * 4000);
}

/* ---- the flicker ---- */

function scheduleFlicker() {
  clearTimeout(flickerTimer);
  const h = heat();
  if (!running || !effectsOn() || h < 0.4) return;
  flickerTimer = setTimeout(() => {
    flick();
    scheduleFlicker();
  }, 30000 + Math.random() * 40000);
}

function flick() {
  const fx = $('#fx');
  if (!fx || !effectsOn()) return;
  fx.style.transition = 'none';
  fx.style.background = 'rgba(0,0,0,.35)';
  setTimeout(() => { fx.style.background = ''; }, 70);
}

/* ---- the three scripted moments ---- */

/* Used once, when the machine answers for the first time. The screen goes
   out, the relay throws, and the reply is there when the light comes back. */
export function blackout(ms = 620) {
  return new Promise(resolve => {
    if (!effectsOn()) { resolve(); return; }
    const fx = $('#fx');
    if (!fx) { resolve(); return; }
    if (soundOn()) {
      tone(70, 0.22, 'square', 0.9);
      setTimeout(() => tone(150, 0.06, 'square', 0.5), 180);
    }
    fx.style.transition = 'none';
    fx.style.background = 'var(--paper)';
    fx.style.opacity = '1';
    setTimeout(() => {
      fx.style.transition = 'opacity 260ms linear';
      fx.style.opacity = '0';
      setTimeout(() => {
        fx.style.background = '';
        fx.style.transition = '';
        fx.style.opacity = '';
        resolve();
      }, 280);
    }, ms);
  });
}

/* Used when the word "hello world" arrives. One frame of the accent colour
   across everything, and a tone that does not belong to any tool. */
export function flash() {
  if (!effectsOn()) return;
  const fx = $('#fx');
  if (!fx) return;
  if (soundOn()) tone(320, 0.5, 'triangle', 0.8);
  fx.style.transition = 'none';
  fx.style.background = 'var(--accent)';
  fx.style.opacity = '.9';
  requestAnimationFrame(() => {
    fx.style.transition = 'opacity 700ms ease-out';
    fx.style.opacity = '0';
    setTimeout(() => { fx.style.background = ''; fx.style.transition = ''; fx.style.opacity = ''; }, 750);
  });
}

/* Used once, before the last act. Every task disappears, the room goes quiet
   for two seconds, and then the list comes back. */
export async function wipe() {
  emit('fx:wipe', { state: 'out' });
  if (soundOn()) tone(90, 0.4, 'sine', 0.6);
  await new Promise(r => setTimeout(r, effectsOn() ? 2100 : 400));
  emit('fx:wipe', { state: 'in' });
  relayClick();
}

/* ---- the tab you walked away from ---- */

function watchVisibility() {
  let awayAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      awayAt = Date.now();
      if (chapter() >= 2) document.title = 'still here · Hello World';
      return;
    }
    const away = Date.now() - awayAt;
    document.title = document.title.replace('still here · ', '');
    if (away > 45000 && chapter() >= 2) emit('story:returned', { away });
  });
}

/* ---- lifecycle ---- */

export function startAtmosphere() {
  if (running) return;
  running = true;

  paintRoom();
  paintFavicon();
  watchVisibility();
  scheduleBeat();
  scheduleFlicker();

  on('chapter', () => { paintRoom(); paintFavicon(); paintHum(); scheduleBeat(); scheduleFlicker(); });
  on('flag', () => { paintRoom(); paintFavicon(); });
  on('settings:change', () => {
    paintRoom();
    paintFavicon();
    if (soundOn()) paintHum(); else stopHum();
    scheduleBeat();
    scheduleFlicker();
  });

  /* The hum needs a gesture before the browser will make any sound, so it
     starts on the first thing the player clicks. */
  const wake = () => { paintHum(); removeEventListener('pointerdown', wake); };
  addEventListener('pointerdown', wake, { once: true });
}

export function stopAtmosphere() {
  running = false;
  clearTimeout(beatTimer);
  clearTimeout(flickerTimer);
  stopHum();
}
