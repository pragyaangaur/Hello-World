/* The single source of truth. Everything that survives a reload lives here. */

import * as store from './store.js';
import { emit } from './bus.js';

const DEFAULTS = {
  version: 1,
  installedAt: null,
  account: 'guest',
  tasks: [],
  notes: '',
  chapter: 0,
  flags: {},
  seenTools: {},
  counters: { added: 0, completed: 0, toolsOpened: 0 },
  challenges: { blink: false, parse: false, branch: false },
  reads: {},
  ending: null,
  noticeAccepted: false,
  settings: {
    theme: 'system',
    calm: false,
    sound: false,
    showCompleted: true
  }
};

let state = store.load(DEFAULTS);
if (!state.installedAt) state.installedAt = new Date().toISOString();
if (!state.settings) state.settings = { ...DEFAULTS.settings };

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
  root.dataset.calm = state.settings.calm ? '1' : '0';
  if (state.settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.settings.theme;
}

export { store };
