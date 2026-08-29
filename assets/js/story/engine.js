/* The story engine. It listens, it counts, and it moves the chapter on.
   No tool imports this file, and this file imports no tool. */

import { on, emit } from '../core/bus.js';
import { get, setChapter, chapter, setFlag, hasFlag, update } from '../core/state.js';
import * as tasks from '../core/tasks.js';
import { toast } from '../core/notify.js';
import { CHAPTERS, AUTO_TASKS, OBJECTIVES } from './beats.js';
import { showBeat } from './interlude.js';
import { FINDING_IDS } from './findings.js';
import { registry } from '../modules/index.js';

let autoIndex = 0;
let autoTimer = null;

/* ---- how many distinct tools the player has actually opened ---- */
function toolsOpened() {
  return Object.keys(get().seenTools).filter(id => registry.some(m => m.id === id)).length;
}

/* ---- resolve a Findings question ---- */
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

/* ---- the auto tasks, released one at a time ---- */
function releaseAuto() {
  if (chapter() < 1) return;
  if (autoIndex >= AUTO_TASKS.length) return;
  const spec = AUTO_TASKS[autoIndex++];
  const t = tasks.add(spec.text, { source: 'auto', note: spec.note, top: true });
  update(s => { s.autoIndex = autoIndex; return s; });
  if (t) {
    toast('[auto] added a task', spec.text, { kind: 'auto', ms: 5200 });
    emit('auto:task', spec);
  }
}

function startAutoDrip() {
  clearTimeout(autoTimer);
  if (chapter() < 3 || autoIndex >= AUTO_TASKS.length) return;
  /* The first two arrive quickly so the change is unmistakable, then it
     settles into a slower rhythm that follows what the player does. */
  const delay = autoIndex < 2 ? 6000 : 42000;
  autoTimer = setTimeout(() => { releaseAuto(); startAutoDrip(); }, delay);
}

/* ---- chapter progression ---- */
export function checkChapter() {
  const s = get();
  const ch = s.chapter;

  if (ch === 0 && s.counters.completed >= 3) return advance(1);
  if (ch === 1 && toolsOpened() >= 4) return advance(2);
  if (ch === 2 && s.challenges.blink) return advance(3);
  if (ch === 3 && s.challenges.parse && findingsDone() >= 3) return advance(4);
  if (ch === 4 && findingsDone() >= FINDING_IDS.length) return advance(5);
  return false;
}

function advance(n) {
  const from = chapter();
  if (!setChapter(n)) return false;
  completeObjective(from);
  ensureObjective(n);
  showBeat(n);

  /* The first line the script ever wrote lands moments after the player
     clears the last of the old team's tasks. That one task is the hook, and
     it used to arrive three chapters later than it should have. */
  if (n === 1) setTimeout(releaseAuto, 2600);
  if (n >= 3) { startAutoDrip(); setTimeout(releaseAuto, 2500); }

  emit('story:chapter', { from, to: n });
  return true;
}

export function currentGoal() {
  return CHAPTERS[chapter()]?.goal || '';
}

/* What the strip at the top of the screen shows. A chapter that can count its
   own progress says so, which is what stops the player wondering whether the
   app noticed what they just did. */
export function currentStep() {
  const n = chapter();
  const beat = CHAPTERS[n];
  if (!beat) return null;
  const objective = OBJECTIVES[n];
  /* The counts are worked out here rather than read from the stored counters,
     because the strip is redrawn from the same signal that updates them and
     the order of two listeners should not decide what the player sees. */
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
    link: objective ? objective.link : null,
    progress: counted
  };
}

export function startStory() {
  autoIndex = get().autoIndex || 0;

  on('task:complete', () => checkChapter());
  on('tool:first', () => { update(s => { s.counters.toolsOpened = toolsOpened(); return s; }); checkChapter(); });
  on('flag', () => checkChapter());
  on('challenge:solved', () => checkChapter());

  ensureObjective(chapter());
  if (chapter() >= 3) startAutoDrip();

  /* If the player reloads mid-chapter, catch any threshold they already met. */
  setTimeout(checkChapter, 300);
}

export { toolsOpened };
