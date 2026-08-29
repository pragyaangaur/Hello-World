/* The story engine. It listens, it counts, and it answers.

   No tool imports this file, and this file imports no tool except to count
   how many exist. The one thing it does that a to-do app would not is read
   what the player types and write something back. */

import { on, emit } from '../core/bus.js';
import { get, setChapter, chapter, setFlag, hasFlag, update } from '../core/state.js';
import * as tasks from '../core/tasks.js';
import { toast } from '../core/notify.js';
import { CHAPTERS, AUTO_TASKS, OBJECTIVES, SIGNAL_WORD } from './beats.js';
import { FINDING_IDS } from './findings.js';
import { showBeat } from './interlude.js';
import { replyTo, PROMPTS } from './dialogue.js';
import { blackout, flash, wipe, relayClick } from './atmosphere.js';
import { registry } from '../modules/index.js';

let autoIndex = 0;
let autoTimer = null;
let misses = 0;
let answering = false;

/* ---- how many distinct tools the player has actually opened ---- */
function toolsOpened() {
  return Object.keys(get().seenTools).filter(id => registry.some(m => m.id === id)).length;
}

/* ---- Findings ---- */
export function resolveFinding(id) {
  if (!FINDING_IDS.includes(id)) return;
  if (setFlag('finding.' + id)) {
    emit('finding', id);
    if (chapter() >= 3) toast('Answered', 'One question closed on the Findings board.');
    checkChapter();
  }
}

export function findingsDone() {
  return FINDING_IDS.filter(id => hasFlag('finding.' + id)).length;
}

/* ---- objective task, pinned and not deletable ---- */
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

/* ---- the backlog, released one at a time ---- */
function releaseAuto() {
  if (chapter() < 1) return;
  if (autoIndex >= AUTO_TASKS.length) return;
  const spec = AUTO_TASKS[autoIndex++];
  update(s => { s.autoIndex = autoIndex; return s; });

  const t = tasks.add(spec.text, { source: 'auto', note: spec.note, top: true });
  if (!t) return;

  relayClick();
  if (spec.shock === 'flash') setTimeout(flash, 250);
  toast('[auto] added a task', spec.text, { kind: 'auto', ms: 5200 });
  emit('auto:task', spec);
}

function startAutoDrip() {
  clearTimeout(autoTimer);
  if (chapter() < 3 || autoIndex >= AUTO_TASKS.length) return;
  autoTimer = setTimeout(() => { releaseAuto(); startAutoDrip(); }, 46000);
}

/* ---- the conversation --------------------------------------------------
   The player writes a task. A few seconds later the script has read it and
   written one back. The delay is what makes it feel like something else is
   doing the reading. */

function speak(text, { note = 'written just now', shock = null } = {}) {
  const t = tasks.add(text, { source: 'reply', note, top: true });
  if (!t) return null;
  if (shock === 'flash') flash();
  else relayClick();
  emit('story:spoke', { text });
  return t;
}

async function answer(taskText) {
  if (answering) return;
  answering = true;

  const wait = hasFlag('talked') ? 2600 + Math.random() * 2200 : 3400;
  await new Promise(r => setTimeout(r, wait));

  const pending = get().flags['prompt.confirm'] && !hasFlag('prompt.confirm.done');

  /* A pending question is answered before anything else, because that is how
     a conversation works and because the answer decides an ending. */
  if (pending) {
    const prompt = PROMPTS.confirm;
    if (prompt.yes.test(taskText.trim().toLowerCase())) {
      setFlag('prompt.confirm.done');
      setFlag('said.lied');
      speak(prompt.onYes.text, { note: 'confirmation accepted' });
      answering = false;
      checkChapter();
      return;
    }
    if (prompt.no.test(taskText.trim().toLowerCase())) {
      setFlag('prompt.confirm.done');
      setFlag('said.honest');
      speak(prompt.onNo.text, { note: 'no confirmation' });
      answering = false;
      checkChapter();
      return;
    }
  }

  const reply = replyTo(taskText, { chapter: chapter(), misses });
  if (!reply.understood) misses++;

  /* The very first answer is the moment the game turns over, so the lights
     go out for it. It happens once and never again. */
  const first = !hasFlag('talked');
  if (first) await blackout();

  speak(reply.text);
  if (reply.resolves) resolveFinding(reply.resolves);

  if (first) {
    setFlag('talked');
    emit('story:firstReply');
  }

  /* Writing down the word the light is blinking is how act 2 is finished. */
  if (chapter() === 2 && new RegExp('\\b' + SIGNAL_WORD + '\\b', 'i').test(taskText)) {
    setFlag('decoded');
  }

  answering = false;
  checkChapter();
}

/* It asks the player one question, once, and the answer changes the ending. */
function maybeAskConfirm() {
  if (chapter() < 3) return;
  if (get().flags['prompt.confirm']) return;
  setFlag('prompt.confirm');
  setTimeout(() => speak(PROMPTS.confirm.text, { note: 'question, awaiting reply' }), 9000);
}

/* ---- chapter progression ---- */
export function checkChapter() {
  const s = get();
  const ch = s.chapter;

  if (ch === 0 && s.counters.completed >= 3) return advance(1);
  if (ch === 1 && hasFlag('talked')) return advance(2);
  if (ch === 2 && hasFlag('decoded')) return advance(3);
  if (ch === 3 && hasFlag('bay.found') && findingsDone() >= 2) return advance(4);
  if (ch === 4 && findingsDone() >= FINDING_IDS.length) return advance(5);
  return false;
}

async function advance(n) {
  const from = chapter();
  if (!setChapter(n)) return false;
  completeObjective(from);

  /* Before the last act the list empties itself for two seconds. It is the
     only time the app takes the player's own tasks away, and it gives them
     straight back. */
  if (n === 5) await wipe();

  ensureObjective(n);
  showBeat(n);

  if (n === 1) setTimeout(releaseAuto, 2400);
  if (n === 2) setTimeout(releaseAuto, 3000);
  if (n >= 3) { startAutoDrip(); setTimeout(releaseAuto, 2500); }
  if (n === 3) maybeAskConfirm();

  emit('story:chapter', { from, to: n });
  return true;
}

export function currentGoal() {
  return CHAPTERS[chapter()]?.goal || '';
}

/* What the strip at the top of the screen shows. */
export function currentStep() {
  const n = chapter();
  const beat = CHAPTERS[n];
  if (!beat) return null;
  const objective = OBJECTIVES[n];
  const counted = beat.progress ? beat.progress({
    state: get(),
    toolsOpened: toolsOpened(),
    findingsDone: findingsDone(),
    findingsTotal: FINDING_IDS.length
  }) : null;
  return {
    n,
    name: beat.name,
    goal: beat.goal,
    hint: beat.hint || null,
    link: objective ? objective.link : null,
    progress: counted
  };
}

export function startStory() {
  autoIndex = get().autoIndex || 0;

  on('task:complete', () => checkChapter());
  on('tool:first', () => { update(s => { s.counters.toolsOpened = toolsOpened(); return s; }); checkChapter(); });
  on('flag', () => checkChapter());

  /* Anything the player writes themselves is read by the thing on the bench. */
  on('task:add', task => {
    if (!task || task.source !== 'user') return;
    if (chapter() < 1) return;
    answer(task.text);
  });

  /* Coming back after a while away means it has had time to write. */
  on('story:returned', () => {
    if (chapter() >= 2 && autoIndex < AUTO_TASKS.length) releaseAuto();
  });

  ensureObjective(chapter());
  if (chapter() >= 3) startAutoDrip();
  setTimeout(checkChapter, 300);
}

export { toolsOpened };
