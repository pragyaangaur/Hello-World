/* The to-do page. This is the app as far as most people are concerned,
   so it gets the most care: keyboard editing, undo, and honest empty states. */

import { h, mount, clear, $ } from '../core/dom.js';
import * as tasks from '../core/tasks.js';
import { setting } from '../core/state.js';
import { on } from '../core/bus.js';
import { toast } from '../core/notify.js';

let filter = 'all';
let editing = null;
let lastRemoved = null;

function timeAgo(iso) {
  if (!iso) return '';
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  const d = Math.floor(secs / 86400);
  if (d === 1) return 'yesterday';
  if (d < 365) return d + 'd ago';
  const y = Math.floor(d / 365);
  return y === 1 ? 'a year ago' : y + ' years ago';
}

function taskRow(t) {
  if (editing === t.id) {
    const input = h('input.input', { value: t.text, 'aria-label': 'Edit task' });
    const commit = () => { tasks.edit(t.id, input.value); editing = null; render(); };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') { editing = null; render(); }
    });
    input.addEventListener('blur', commit);
    const li = h('li.task', input);
    queueMicrotask(() => { input.focus(); input.select(); });
    return li;
  }

  const check = h('input.task-check', {
    type: 'checkbox',
    checked: t.done,
    'aria-label': (t.done ? 'Mark as not done: ' : 'Mark as done: ') + t.text,
    onchange: () => { tasks.toggle(t.id); render(t.id); }
  });

  const meta = h('div.task-meta');
  if (t.source === 'auto') meta.appendChild(h('span.badge.auto', '[auto]'));
  if (t.source === 'objective') meta.appendChild(h('span.badge.accent', 'next step'));
  /* A task somebody else left behind says so, and says how long ago. That
     one line is what tells a new player whose machine this is. */
  if (t.source === 'leftover' && t.by) {
    meta.appendChild(h('span.task-note.left-over', `added by ${t.by}, ${timeAgo(t.createdAt)}`));
  }
  if (t.note && t.source !== 'objective' && t.source !== 'leftover') meta.appendChild(h('span.task-note', t.note));
  if (t.done && t.completedAt) meta.appendChild(h('span.task-note', 'done ' + timeAgo(t.completedAt)));

  const text = t.link
    ? h('a.task-text', { href: t.link, style: { color: 'var(--accent)', fontWeight: '600' } }, t.text, ' \u2192')
    : h('div.task-text', { tabindex: '0', role: 'button', 'aria-label': 'Edit task: ' + t.text,
        onclick: () => { if (!t.locked) { editing = t.id; render(); } },
        onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && !t.locked) { e.preventDefault(); editing = t.id; render(); } }
      }, t.text);

  const del = h('button.icon-btn', {
    type: 'button', title: 'Delete task', 'aria-label': 'Delete task: ' + t.text,
    onclick: () => {
      lastRemoved = { ...t };
      if (tasks.remove(t.id)) {
        render();
        toast('Task deleted', h('button.btn.btn-sm', { type: 'button', style: { marginTop: '.4rem' }, onclick: () => {
          if (lastRemoved) {
            tasks.add(lastRemoved.text, {
              source: lastRemoved.source,
              note: lastRemoved.note,
              by: lastRemoved.by,
              createdAt: lastRemoved.createdAt
            });
            lastRemoved = null;
            render();
          }
        } }, 'Undo'));
      }
    }
  }, '×');

  return h('li.task' + (t.done ? '.done' : ''), {
    dataset: { source: t.source, locked: t.locked ? '1' : '0', taskId: t.id }
  }, check, h('div.task-main', text, meta.children.length ? meta : null), t.locked ? null : del);
}

function render(focusTaskId) {
  const view = $('#view');
  if (!view || view.dataset.page !== 'tasks') return;
  const c = tasks.counts();
  const list = tasks.visible(filter).filter(t => (setting('showCompleted') ? true : !t.done));

  const form = h('form.task-form', {
    onsubmit: e => {
      e.preventDefault();
      const input = form.querySelector('input');
      if (tasks.add(input.value)) { input.value = ''; render(); input.focus(); }
    }
  },
    h('input.input', { type: 'text', name: 'task', placeholder: 'What needs doing?', 'aria-label': 'New task', autocomplete: 'off', maxlength: '240' }),
    h('button.btn.btn-primary', { type: 'submit' }, 'Add')
  );

  const filters = h('div.filters',
    ...[['all', 'All', c.total], ['active', 'To do', c.active], ['done', 'Done', c.done]].map(([k, label, n]) =>
      h('button.filter', {
        type: 'button', 'aria-pressed': String(filter === k),
        onclick: () => { filter = k; render(); }
      }, `${label} (${n})`)
    ),
    h('span.spacer'),
    c.done ? h('button.filter', { type: 'button', onclick: () => {
      const n = tasks.clearDone();
      render();
      if (n) toast('Cleared', n + (n === 1 ? ' completed task removed' : ' completed tasks removed'));
    } }, 'Clear completed') : null
  );

  const body = list.length
    ? h('ul.task-list', { 'aria-label': 'Tasks' }, ...list.map(taskRow))
    : h('div.empty',
        h('div.big', '✓'),
        h('p', c.total === 0
          ? 'Nothing here yet. Add your first task above.'
          : filter === 'done' ? 'Nothing completed yet.' : 'All done for now.')
      );

  const hadFormFocus = document.activeElement === view.querySelector('.task-form input');
  const caret = hadFormFocus ? view.querySelector('.task-form input').value : null;

  mount(view,
    h('div.page',
      h('div.page-head', h('div.grow', h('h1', 'Tasks'), h('p', c.active === 0 && c.total > 0 ? 'Everything is ticked off.' : `${c.active} to do`))),
      form, filters, body
    )
  );

  /* Re-rendering the whole list is simple and fast enough, but it throws
     focus away, so put it back where the person left it. */
  if (focusTaskId) {
    const box = view.querySelector(`.task[data-task-id="${focusTaskId}"] .task-check`);
    if (box) box.focus();
  } else if (caret !== null) {
    const input = view.querySelector('.task-form input');
    if (input) { input.value = caret; input.focus(); }
  }
}

export function mountTasks() {
  const view = $('#view');
  view.dataset.page = 'tasks';
  clear(view);
  render();
}

/* Re-render when anything outside this page changes the list. */
on('task:add', () => render());
on('task:remove', () => render());
on('chapter', () => render());

export { render as renderTasks };
