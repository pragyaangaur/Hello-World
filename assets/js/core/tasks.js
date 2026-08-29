/* Task model. The rest of the app talks to the list only through here. */

import { get, update, bump } from './state.js';
import { emit } from './bus.js';

function uid() {
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function all() { return get().tasks; }

export function visible(filter = 'all') {
  const list = get().tasks;
  if (filter === 'active') return list.filter(t => !t.done);
  if (filter === 'done') return list.filter(t => t.done);
  return list;
}

export function counts() {
  const list = get().tasks;
  return {
    total: list.length,
    active: list.filter(t => !t.done).length,
    done: list.filter(t => t.done).length
  };
}

export function add(text, opts = {}) {
  const clean = String(text || '').trim().slice(0, 240);
  if (!clean) return null;
  const task = {
    id: uid(),
    text: clean,
    done: false,
    createdAt: opts.createdAt || new Date().toISOString(),
    completedAt: null,
    source: opts.source || 'user',
    note: opts.note || null,
    by: opts.by || null,
    locked: Boolean(opts.locked),
    pinned: Boolean(opts.pinned)
  };
  update(s => { s.tasks = opts.top ? [task, ...s.tasks] : [...s.tasks, task]; return s; });
  if (task.source === 'user') bump('added');
  emit('task:add', task);
  return task;
}

export function toggle(id) {
  let changed = null;
  update(s => {
    s.tasks = s.tasks.map(t => {
      if (t.id !== id) return t;
      changed = { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null };
      return changed;
    });
    return s;
  });
  if (changed) {
    if (changed.done) bump('completed');
    emit(changed.done ? 'task:complete' : 'task:reopen', changed);
  }
  return changed;
}

export function edit(id, text) {
  const clean = String(text || '').trim().slice(0, 240);
  if (!clean) return remove(id);
  update(s => { s.tasks = s.tasks.map(t => (t.id === id ? { ...t, text: clean } : t)); return s; });
  emit('task:edit', { id, text: clean });
}

export function remove(id) {
  const task = get().tasks.find(t => t.id === id);
  if (task && task.locked) return false;
  update(s => { s.tasks = s.tasks.filter(t => t.id !== id); return s; });
  emit('task:remove', task);
  return true;
}

export function clearDone() {
  const removed = get().tasks.filter(t => t.done && !t.locked).length;
  update(s => { s.tasks = s.tasks.filter(t => !t.done || t.locked); return s; });
  emit('task:clearDone', { removed });
  return removed;
}

export function hasText(text) {
  const needle = text.toLowerCase();
  return get().tasks.some(t => t.text.toLowerCase().includes(needle));
}

/* Seeds the list the app opens with. The caller supplies the entries,
   because what those entries say is a story decision and this file is not
   allowed to know about the story. */
export function seed(entries) {
  if (get().tasks.length) return false;
  for (const entry of entries) {
    add(entry.text, {
      source: entry.source || 'leftover',
      note: entry.note || null,
      by: entry.by || null,
      createdAt: entry.createdAt || null
    });
  }
  return true;
}
