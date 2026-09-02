/* The single source of truth. Everything that survives a reload lives here. */

import * as store from './store.js';
import { emit } from './bus.js';

const DEFAULTS = {
  version: 1,
  installedAt: null,
  tasks: [],
  notes: '',
  chapter: 0,
  /* How far down the list of things the machine writes unprompted the game
     has got. It survives a reload, so the drip does not start over. */
  laterIndex: 0,
  flags: {},
  seenTools: {},
  seenPages: {},
  counters: { added: 0, completed: 0 },
  reads: {},
  ending: null,
  settings: {
    theme: 'system',
    sound: true,
    showCompleted: true
  }
};

let state = store.load(DEFAULTS);
if (!state.installedAt) state.installedAt = new Date().toISOString();

let queued = false;
function persist() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; store.save(state); });
}

export function get() { return state; }

export function set(patch) {
  state = { ...state, ...patch };
  persist();
  emit('state:change', state);
  return state;
}

export function update(fn) {
  const next = fn(structuredClone(state));
  if (next) return set(next);
  persist();
  emit('state:change', state);
  return state;
}

/* ---- settings ---- */
export function setting(name, value) {
  if (value === undefined) return state.settings[name];
  state.settings = { ...state.settings, [name]: value };
  persist();
  emit('settings:change', state.settings);
  emit('state:change', state);
  applyDocumentAttributes();
  return value;
}

/* ---- story flags ---- */
export function hasFlag(name) { return Boolean(state.flags[name]); }

export function setFlag(name, value = true) {
  if (state.flags[name] === value) return false;
  state.flags = { ...state.flags, [name]: value };
  persist();
  emit('flag', { name, value });
  emit('state:change', state);
  return true;
}

/* ---- counters ---- */
export function bump(name, by = 1) {
  state.counters = { ...state.counters, [name]: (state.counters[name] || 0) + by };
  persist();
  emit('state:change', state);
  return state.counters[name];
}

/* ---- chapter ---- */
export function chapter() { return state.chapter; }

export function setChapter(n) {
  if (n <= state.chapter) return false;
  const from = state.chapter;
  state.chapter = n;
  persist();
  applyDocumentAttributes();
  emit('chapter', { from, to: n });
  emit('state:change', state);
  return true;
}

/* ---- playing it again ----------------------------------------------------
   A full reset takes the tools and the notes and the tasks with it, which is
   not what somebody wants when they just want to watch the opening land on a
   friend's laptop. This puts the story back to the beginning and leaves the
   app alone: your own tasks stay, the drawing you made stays, and the high
   score you took off user_02 stays taken. */
export function restartStory() {
  state = {
    ...state,
    chapter: 0,
    flags: {},
    ending: null,
    laterIndex: 0,
    counters: { ...state.counters, completed: 0 },
    /* Keep what the player wrote, and put back the three the last person to
       use this machine left open, because the story starts by finding them.
       The seed only runs on an empty list, so they have to survive here. */
    tasks: state.tasks
      .filter(t => t.source === 'user' || t.source === 'leftover')
      .map(t => (t.source === 'leftover' ? { ...t, done: false, completedAt: null } : t))
  };
  delete document.documentElement.dataset.over;
  persist();
  applyDocumentAttributes();
  emit('state:change', state);
}

/* ---- reset ---- */
export function factoryReset() {
  /* This clears the main key. It deliberately leaves the install key alone,
     which is what lets the app tell a fresh visitor from a returning one. */
  store.clearMain();
  const install = store.keep();
  store.setKeep({ ...install, resets: (install.resets || 0) + 1, lastReset: new Date().toISOString() });
  state = structuredClone(DEFAULTS);
  state.installedAt = new Date().toISOString();
  persist();
  applyDocumentAttributes();
  emit('state:change', state);
}

/* ---- document level attributes ---- */
export function applyDocumentAttributes() {
  const root = document.documentElement;
  root.dataset.chapter = String(state.chapter);
  if (state.settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.settings.theme;
}

export { store };
