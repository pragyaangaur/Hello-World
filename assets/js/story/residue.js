/* Signs that somebody was here first.

   Every tool in the Toolbox was used by four people for two years and then
   left running. This file is what they left in it: a high score nobody beat,
   a drawing half finished, an alarm still set for a time that stopped
   meaning anything. None of it is explained anywhere. It is just there, the
   way a stranger's mug is just there in an office nobody cleared out.

   Two things happen here. Traces are static and always visible. Haunts are
   rare, brief, and only start once the player knows something is wrong. */

import { h } from '../core/dom.js';
import { chapter, get, update } from '../core/state.js';
import { PEOPLE, ANCHORS, daysSince } from './cast.js';

const NV = PEOPLE.user_02.id;
const IS = PEOPLE.user_01.id;
const DR = PEOPLE.user_03.id;

function ago() { return daysSince(ANCHORS.lastHuman) + ' days ago'; }

/* What each tool remembers about the last person to touch it. Keep every one
   of these to a single concrete thing. A specific number somebody else set is
   unsettling. A sentence about how eerie it all is, is not. */
const TRACES = {
  snake:      { who: NV, line: 'high score 47 · never beaten' },
  tictactoe:  { who: DR, line: 'game abandoned mid-turn · X to play' },
  paint:      { who: IS, line: 'unsaved sketch restored from local cache' },
  notepad:    { who: NV, line: 'draft restored · not saved since' },
  piano:      { who: DR, line: 'one recording in the buffer · 9 notes' },
  calculator: { who: NV, line: 'tape restored from the last session' },
  timers:     { who: NV, line: 'one alarm still armed · 04:10 · repeats daily' },
  alarm:      { who: NV, line: 'alarm 04:10 · repeats daily · never cancelled' },
  morse:      { who: NV, line: 'last translation still in the box' },
  passwordgen:{ who: DR, line: 'test account key generated here · never used' },
  dice:       { who: NV, line: 'rota roll · 4 players · one result kept' },
  weather:    { who: IS, line: 'last sync ' + ago() },
  scope:      { who: NV, line: 'one capture saved · channel A · bench supply' },
  orbit:      { who: DR, line: 'system saved · she called it "the good one"' },
  pendulum:   { who: DR, line: 'preset restored · lab demo 3' },
  sorting:    { who: DR, line: 'preset restored · lab demo 1' },
  led:        { who: NV, line: 'driven by maint.py · not by this app' },
  sevenseg:   { who: NV, line: 'mirrors the panel on the bench' },
  ecg:        { who: DR, line: 'demo trace · nobody was connected to it' },
  gears:      { who: NV, line: 'ratio saved · bench 4B fan assembly' },
  beam:       { who: NV, line: 'preset restored · shelf bracket, lab 4B' },
  projectile: { who: DR, line: 'preset restored · lab demo 2' },
  converter:  { who: IS, line: 'last conversion still in the box' },
  ohms:       { who: NV, line: 'reads the 4B bench supply' },
  resistor:   { who: NV, line: 'panel resistor, bench 4B' },
  gates:      { who: NV, line: 'circuit restored' },
  ph:         { who: DR, line: 'preset restored · lab demo 4' },
  bmi:        { who: IS, line: 'entries cleared, settings kept' }
};

export function traceFor(id) { return TRACES[id] || null; }

/* The line that appears under every tool. It is the same shape everywhere,
   which is what makes it read as a system rather than as a spooky message. */
export function trace(id) {
  if (chapter() < 1) return null;
  const t = TRACES[id];
  if (!t) return null;
  const person = PEOPLE[t.who];
  return h('div.trace',
    h('span.trace-dot'),
    h('span.trace-body',
      h('span.trace-line', t.line),
      h('span.trace-who', `${person.id} · ${ago()}`))
  );
}

/* ---- things somebody left behind that the tool has to load --------------
   Stored in state so the player can beat the score, wipe the drawing, or
   finish the game, and it stays beaten. */

export function ghost(key, initial) {
  const g = get().ghosts || {};
  if (g[key] === undefined) return initial;
  return g[key];
}

export function setGhost(key, value) {
  update(s => { s.ghosts = { ...(s.ghosts || {}), [key]: value }; return s; });
  return value;
}

/* The drawing on the sketchpad when you open it for the first time. Drawn in
   normalised coordinates so it scales to whatever canvas it lands on. It is a
   bench, four cells, and a circle round the third one. */
export const LEFT_SKETCH = [
  { w: 2.5, p: [[.14, .62], [.86, .62]] },
  { w: 2.5, p: [[.14, .62], [.14, .74]] },
  { w: 2.5, p: [[.86, .62], [.86, .74]] },
  { w: 2, p: [[.20, .62], [.20, .40], [.32, .40], [.32, .62]] },
  { w: 2, p: [[.36, .62], [.36, .40], [.48, .40], [.48, .62]] },
  { w: 2, p: [[.52, .62], [.52, .40], [.64, .40], [.64, .62]] },
  { w: 2, p: [[.68, .62], [.68, .40], [.80, .40], [.80, .62]] },
  { w: 3.5, hot: true, p: [[.50, .36], [.58, .30], [.66, .36], [.68, .48], [.62, .58], [.54, .58], [.49, .48], [.50, .36]] },
  { w: 2, hot: true, p: [[.66, .34], [.78, .24]] },
  { w: 2, hot: true, p: [[.78, .24], [.86, .24]] }
];

export const LEFT_NOTE =
  `maint.py runs 04:10 daily. it checks the bays and writes a task if\n` +
  `anything is out of range. it cannot page anyone, so somebody has to\n` +
  `actually read the list.\n\n` +
  `ceiling is set to 45. i am fairly sure that is wrong but the datasheet\n` +
  `is in fahrenheit and i have not sat down with it.\n\n` +
  `TODO before we hand the room back: pull the cells.\n` +
  `— ${PEOPLE.user_02.name}`;

/* Nine notes somebody recorded on the piano and never played back. */
export const LEFT_MELODY = ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4', 'F4', 'F4'];

/* A tic-tac-toe board somebody walked away from. X is one move from winning
   and it has been X's turn for two years. */
export const LEFT_BOARD = ['X', 'O', '', '', 'X', '', 'O', '', ''];

export const LEFT_TAPE = [
  { expr: '35.5 + 26.4', value: '61.9' },
  { expr: '(140 - 32) / 1.8', value: '60' },
  { expr: '60 - 45', value: '15' }
];

/* ---- the haunt ----------------------------------------------------------
   From the middle of the game, a tool occasionally does something it should
   not. One event, under a second, and then it is fine again, so the player is
   never sure it happened. Nothing here is required to finish the game, and
   all of it is off when the system asks for reduced motion. */

const WORDS = ['help', 'help', 'still here', '04:10', 'bay 3', 'is anyone reading this'];

/* The four letters, in seven segment bars, so the panel clock can spell the
   word rather than printing it. Same bar names the sevenseg tool uses. */
const SEG_HELP = ['bcefg', 'adefg', 'def', 'abefg'];

function calm() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

/* Anything swapped out is put back exactly as it was, markup and all. A
   readout is often a tree of spans rather than a string, and restoring one of
   those from its text would quietly destroy the tool. */
function borrow(el, ms, fill) {
  if (el.dataset.haunted) return;
  const real = el.innerHTML;
  el.dataset.haunted = '1';
  fill(el);
  setTimeout(() => { el.innerHTML = real; delete el.dataset.haunted; }, ms);
}

function pickTarget(root) {
  const pool = [
    ...root.querySelectorAll('.readout'),
    ...root.querySelectorAll('h1, h2, .card-head')
  ].filter(el => el.textContent.trim().length > 1 && !el.dataset.haunted);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/* One readout says the wrong thing for a moment. */
function whisper(root) {
  /* A seven segment panel gets the word in bars, because that is what a panel
     on a bench would actually do with it. */
  const panel = root.querySelector('.seg-display');
  if (panel && Math.random() < 0.7) {
    borrow(panel, 900, el => {
      el.innerHTML = SEG_HELP.map(on =>
        '<span class="seg">' + 'abcdefg'.split('')
          .map(b => `<span class="${b}${on.includes(b) ? ' on' : ''}"></span>`).join('') + '</span>'
      ).join('');
    });
    return;
  }
  const el = pickTarget(root);
  if (!el) return;
  borrow(el, 260 + Math.random() * 200, node => {
    node.textContent = WORDS[Math.floor(Math.random() * WORDS.length)];
  });
}

/* A number climbs to something it has no business being. */
function bleed(root) {
  const el = root.querySelector('.readout');
  if (!el || el.dataset.haunted) return;
  const real = el.innerHTML;
  el.dataset.haunted = '1';
  let n = 0;
  const id = setInterval(() => {
    el.textContent = (54 + n * 1.4).toFixed(1);
    if (++n > 5) { clearInterval(id); el.innerHTML = real; delete el.dataset.haunted; }
  }, 70);
}

/* The tool loses its colour for a beat, the way a screen does when something
   upstream of it resets. */
function drain(root) {
  root.dataset.drain = '1';
  setTimeout(() => { delete root.dataset.drain; }, 420);
}

export function haunt(root) {
  if (!root || calm()) return () => {};
  let timer = null;

  function schedule() {
    const ch = chapter();
    if (ch < 3) return;
    const gap = 46000 - ch * 4200;
    timer = setTimeout(() => {
      if (!document.hidden && root.isConnected) {
        const bag = ch >= 5 ? [whisper, bleed, drain, whisper] : [whisper, drain];
        bag[Math.floor(Math.random() * bag.length)](root);
      }
      schedule();
    }, gap + Math.random() * gap);
  }

  schedule();
  return () => clearTimeout(timer);
}
