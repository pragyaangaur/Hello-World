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
  const list = get().tasks;
  const index = list.findIndex(t => t.id === id);
  if (index < 0) return false;
  const task = list[index];
  if (task.locked) return false;
  update(s => { s.tasks = s.tasks.filter(t => t.id !== id); return s; });
  emit('task:remove', { ...task, index });
  return true;
}

/* Puts a deleted task back exactly as it was, in the place it was in. Undo
   goes through here rather than through add, because add makes a new task
   with a new id at one end of the list, which is not the same thing. */
export function restore(task, index) {
  if (!task || !task.id) return null;
  if (get().tasks.some(t => t.id === task.id)) return null;
  const copy = { ...task };
  delete copy.index;
  update(s => {
    const at = Math.max(0, Math.min(Number.isInteger(index) ? index : s.tasks.length, s.tasks.length));
    s.tasks = [...s.tasks.slice(0, at), copy, ...s.tasks.slice(at)];
    return s;
  });
  /* Deliberately not task:add. The story engine treats a user task landing
     on the list as the player saying something, and putting back a line they
     already sent is not them saying it again. */
  emit('task:restore', copy);
  return copy;
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
