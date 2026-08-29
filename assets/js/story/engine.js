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
import { ACTS, AUTO_TASKS, OBJECTIVES, COMMANDS, LAST_ACT } from './acts.js';
import { showBeat } from './interlude.js';
import { replyTo, PROMPTS } from './dialogue.js';
import { blackout, flash, wipe, relayClick, escalate } from './atmosphere.js';
import { go } from '../core/router.js';

let autoIndex = 0;
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

/* ---- the backlog ---- */
function releaseAuto() {
  if (chapter() < 1 || autoIndex >= AUTO_TASKS.length) return;
  const spec = AUTO_TASKS[autoIndex++];
  update(s => { s.autoIndex = autoIndex; return s; });

  const t = tasks.add(spec.text, { source: 'auto', note: spec.note, top: true });
  if (!t) return;

  relayClick();
  if (spec.shock === 'flash') setTimeout(flash, 250);
  toast('[auto] added a task', spec.text, { kind: 'auto', ms: 5200 });
}

function startAutoDrip() {
  clearTimeout(autoTimer);
  if (chapter() < 2 || autoIndex >= AUTO_TASKS.length) return;
  autoTimer = setTimeout(() => { releaseAuto(); startAutoDrip(); }, 52000);
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
  const wait = hasFlag('talked') ? 2200 + Math.random() * 1600 : 3200;
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

  speak(reply.text);
  busy = false;

  if (first) { setFlag('talked'); advance(2); }
}

/* ---- values reported by a tool ---- */
function toolValue({ tool, value }) {
  if (busy) return;
  const current = act();
  if (!current) return;

  if (current.listen && current.listen.tool === tool && current.listen.test(value)) {
    solved(ACCEPTED[current.n] || null);
    return;
  }

  /* The last act is finished by sending a word back through the indicator. */
  if (chapter() === LAST_ACT && tool === 'led') {
    const word = String(value || '').toLowerCase().trim();
    const command = COMMANDS[word];
    const ending = command ? command.ending : 'addTask';
    update(s => { s.ending = ending; return s; });
    emit('story:ending', { ending });
    setTimeout(() => go('/ending'), 2200);
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
  if (s.chapter === 0 && s.counters.completed >= 3) return advance(1);
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
  showBeat(n);

  if (n === 1) setTimeout(releaseAuto, 2400);
  if (n >= 2) { startAutoDrip(); setTimeout(releaseAuto, 2600); }
  if (n === 4) maybeAskConfirm();

  emit('story:act', { from, to: n });
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
  autoIndex = get().autoIndex || 0;

  on('task:complete', () => checkAct());

  on('task:add', task => {
    if (!task || task.source !== 'user' || chapter() < 1) return;
    answer(task.text);
  });

  on('tool:value', toolValue);

  on('story:returned', () => { if (chapter() >= 2) releaseAuto(); });

  ensureObjective(chapter());
  escalate(chapter());
  if (chapter() >= 2) startAutoDrip();
  setTimeout(checkAct, 300);
}
