/* The story engine. It listens to the list, it checks answers, and it writes
   back.

   Everything the player does arrives here as one of two signals. Either they
   wrote a line on the to-do list, or a tool reported a value. Both are checked
   against the current act, and anything that is not an answer is treated as
   something said to the machine and gets a reply. */

import { on, emit } from '../core/bus.js';
import { get, setChapter, chapter, setFlag, hasFlag, update } from '../core/state.js';
import * as tasks from '../core/tasks.js';
import { toast } from '../core/notify.js';
import { ACTS, AUTO_TASKS, LATER_TASKS, OBJECTIVES, COMMANDS, LAST_ACT } from './acts.js';
import { showBeat } from './interlude.js';
import { replyTo, PROMPTS, firstReply } from './dialogue.js';
import { blackout, flash, wipe, relayClick, escalate } from './atmosphere.js';
import { go } from '../core/router.js';

let laterIndex = 0;
let autoTimer = null;
let misses = 0;
let busy = false;

export function act() { return ACTS[chapter()] || null; }

/* ---- the pinned task ---- */
function ensureObjective(n) {
  const spec = OBJECTIVES[n];
  if (!spec) return;
  if (get().tasks.some(t => t.objective === n)) return;
  const t = tasks.add(spec.text, { source: 'objective', top: true, locked: true, note: 'next step' });
  if (t) update(s => {
    s.tasks = s.tasks.map(x => (x.id === t.id ? { ...x, objective: n, link: spec.link } : x));
    return s;
  });
}

function completeObjective(n) {
  update(s => {
    s.tasks = s.tasks.map(t => (t.objective === n && !t.done
      ? { ...t, done: true, completedAt: new Date().toISOString(), locked: false }
      : t));
    return s;
  });
}

/* ---- the hook -----------------------------------------------------------
   The player ticks one box and the backlog lands, oldest first, one entry
   every quarter second. They are not told that a machine has been writing to
   this list for nineteen days. They watch it happen, from the first flat
   temperature warning up to the word it wrote this morning. */
function floodBacklog() {
  if (get().flags['backlog.done']) return Promise.resolve();
  setFlag('backlog.done');
  return new Promise(resolve => {
    let i = 0;
    const step = () => {
      const spec = AUTO_TASKS[i++];
      if (!spec) { setTimeout(resolve, 600); return; }
      tasks.add(spec.text, { source: 'auto', note: spec.note, top: true });
      relayClick();
      if (spec.shock === 'flash') setTimeout(flash, 200);
      setTimeout(step, spec.shock ? 900 : 240);
    };
    toast('9 entries restored', 'bench 4B · maint.py', { kind: 'auto', ms: 5000 });
    setTimeout(step, 500);
  });
}

/* ---- what it writes once it knows somebody is there ---- */
function releaseLater() {
  if (chapter() < 3 || laterIndex >= LATER_TASKS.length) return;
  const spec = LATER_TASKS[laterIndex++];
  update(s => { s.laterIndex = laterIndex; return s; });
  /* One of these reads the player's own clock, so it is written the moment it
     is released rather than when the file was loaded. */
  const text = typeof spec.text === 'function' ? spec.text() : spec.text;
  const t = tasks.add(text, { source: 'auto', note: spec.note, top: true });
  if (!t) return;
  relayClick();
  if (spec.shock === 'flash') setTimeout(flash, 250);
  toast('[auto] added a task', text, { kind: 'auto', ms: 5200 });
}

function startLaterDrip() {
  clearTimeout(autoTimer);
  if (chapter() < 3 || laterIndex >= LATER_TASKS.length) return;
  autoTimer = setTimeout(() => { releaseLater(); startLaterDrip(); }, 74000);
}

/* ---- speaking ---- */
function speak(text, { note = 'written just now' } = {}) {
  const t = tasks.add(text, { source: 'reply', note, top: true });
  if (t) relayClick();
  emit('story:spoke', { text });
  return t;
}

/* ---- answers -----------------------------------------------------------
   A correct answer is acknowledged fast, because waiting three seconds to be
   told you were right is the slowest possible way to feel clever. */
async function solved(line) {
  /* A tool can report the same value twice in one tick, for example when a
     slider and a button both regenerate. Without this guard the second report
     advances a second act and the player skips a puzzle. */
  if (busy) return;
  busy = true;
  await new Promise(r => setTimeout(r, 700));
  if (line) speak(line, { note: 'accepted' });
  busy = false;
  advance(chapter() + 1);
}

const ACCEPTED = {
  2: 'that is the word. it has been the word since the first day.',
  3: 'cabinet 4B open. relay 3 is in there and it is closed.',
  4: 'on call: user_02. paging.',
  5: 'key accepted. incident system reachable. archive unlocked on this machine.',
  6: 'sixty. the ceiling in my file says forty five. somebody guessed.'
};

async function answer(text) {
  if (busy) return;
  const current = act();

  /* An answer to the act in progress beats anything else the line could be. */
  if (current && current.answer && current.answer(text)) {
    await solved(ACCEPTED[current.n] || null);
    return;
  }

  busy = true;
  const wait = hasFlag('talked') ? 1600 + Math.random() * 1200 : 2400;
  await new Promise(r => setTimeout(r, wait));

  /* A question it asked is answered before anything else. */
  if (get().flags['prompt.confirm'] && !hasFlag('prompt.confirm.done')) {
    const prompt = PROMPTS.confirm;
    const clean = text.trim().toLowerCase();
    if (prompt.yes.test(clean) || prompt.no.test(clean)) {
      const yes = prompt.yes.test(clean);
      setFlag('prompt.confirm.done');
      setFlag(yes ? 'said.lied' : 'said.honest');
      speak(yes ? prompt.onYes.text : prompt.onNo.text, { note: yes ? 'confirmation accepted' : 'no confirmation' });
      busy = false;
      return;
    }
  }

  const reply = replyTo(text, { chapter: chapter(), misses });
  if (!reply.understood) misses++;

  const first = !hasFlag('talked');
  if (first) await blackout();

  /* The reveal never lands on "parse failed". If the parser recognised what
     the player said it gets to answer, and if it did not, the scripted line
     covers it. */
  speak(first && !reply.understood ? firstReply() : reply.text);
  busy = false;

  if (first) { setFlag('talked'); advance(2); }
}

/* ---- values reported by a tool ---- */
function toolValue({ tool, value }) {
  const current = act();

  /* The last act is finished by sending a word back through the indicator,
     and that is checked before the busy guard, because the player has already
     committed by the time they press the button. */
  if (chapter() === LAST_ACT && tool === 'led') {
    if (get().ending) return;
    const word = String(value || '').toLowerCase().trim();
    const command = COMMANDS[word];
    const ending = command ? command.ending : 'addTask';
    update(s => { s.ending = ending; return s; });
    emit('story:ending', { ending });
    setTimeout(() => go('/ending'), 2200);
    return;
  }

  if (busy || !current) return;
  if (current.listen && current.listen.tool === tool && current.listen.test(value)) {
    solved(ACCEPTED[current.n] || null);
  }
}

/* One question, asked once, and the answer follows the player to the end. */
function maybeAskConfirm() {
  if (chapter() < 4 || get().flags['prompt.confirm']) return;
  setFlag('prompt.confirm');
  setTimeout(() => speak(PROMPTS.confirm.text, { note: 'question, awaiting reply' }), 11000);
}

/* ---- progression ---- */
export function checkAct() {
  const s = get();
  /* One tick. The whole opening is over in about fifteen seconds, which is
     roughly how long anyone gives a to-do list before deciding what it is. */
  if (s.chapter === 0 && s.counters.completed >= 1) return advance(1);
  return false;
}

async function advance(n) {
  const from = chapter();
  if (n > LAST_ACT) return false;
  if (!setChapter(n)) return false;
  completeObjective(from);

  /* The list is taken away for two seconds before the last act, and given
     straight back. Nothing is deleted. */
  if (n === LAST_ACT) await wipe();

  ensureObjective(n);
  escalate(n);
  emit('story:act', { from, to: n });

  if (n === 1) await floodBacklog();
  if (n === 4) maybeAskConfirm();
  if (n >= 3) startLaterDrip();

  showBeat(n);
  return true;
}

export function currentStep() {
  const n = chapter();
  const current = ACTS[n];
  if (!current) return null;
  const objective = OBJECTIVES[n];
  return {
    n,
    total: ACTS.length,
    name: current.name,
    goal: current.goal,
    hint: current.hint || null,
    tools: current.tools || null,
    link: objective ? objective.link : null,
    progress: current.progress ? current.progress(get()) : null
  };
}

export function startStory() {
  laterIndex = get().laterIndex || 0;

  on('task:complete', () => checkAct());

  on('task:add', task => {
    if (!task || task.source !== 'user' || chapter() < 1) return;
    answer(task.text);
  });

  on('tool:value', toolValue);

  on('story:returned', () => { if (chapter() >= 3) releaseLater(); });

  ensureObjective(chapter());
  escalate(chapter());
  if (chapter() >= 3) startLaterDrip();
  setTimeout(checkAct, 300);
}
