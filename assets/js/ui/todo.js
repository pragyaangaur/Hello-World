/* The to-do page. This is the app as far as most people are concerned,
   so it gets the most care: keyboard editing, undo, and honest empty states. */

import { h, mount, clear, $ } from '../core/dom.js';
import * as tasks from '../core/tasks.js';
import { setting, chapter } from '../core/state.js';
import { on } from '../core/bus.js';
import { toast } from '../core/notify.js';
import { VENT_C, CEILING_C } from '../story/rig.js';

/* A task the machine wrote about a temperature gets the temperature drawn.
   Scrolling the backlog then shows the climb instead of describing it nine
   times in a row, and the two lines that matter, the limit somebody typed in
   and the point the cells vent, are on every one of them. */
function readingBar(text) {
  const m = /(\d{2}(?:\.\d)?)\s*C\b/.exec(text);
  if (!m) return null;
  const t = Number(m[1]);
  if (!Number.isFinite(t) || t < 20 || t > 90) return null;
  const pos = v => Math.max(0, Math.min(100, ((v - 20) / (VENT_C + 8 - 20)) * 100));
  return h('div.reading', { title: t + ' °C' },
    h('span.reading-track',
      h('span.reading-fill', { dataset: { level: t >= VENT_C ? 'vent' : t >= CEILING_C ? 'hot' : 'warm' },
        style: { width: pos(t) + '%' } }),
      h('span.reading-mark.limit', { style: { left: pos(CEILING_C) + '%' } }),
      h('span.reading-mark.vent', { style: { left: pos(VENT_C) + '%' } })),
    h('span.reading-val', t.toFixed(1) + '°')
  );
}

let filter = 'all';
let query = '';
let editing = null;
let waiting = false;
let wiped = false;
let receiving = 0;

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
  if (t.source === 'reply') meta.appendChild(h('span.badge.auto', '[bench 4B]'));
  if (t.source === 'objective') meta.appendChild(h('span.badge.accent', 'next step'));
  /* A task somebody else left behind says so, and says how long ago. That
     one line is what tells a new player whose machine this is. */
  if (t.source === 'leftover' && t.by) {
    meta.appendChild(h('span.task-note.left-over', `added by ${t.by}, ${timeAgo(t.createdAt)}`));
  }
  if (t.note && t.source !== 'objective' && t.source !== 'leftover') meta.appendChild(h('span.task-note', t.note));
  if (t.done && t.completedAt) meta.appendChild(h('span.task-note', 'done ' + timeAgo(t.completedAt)));

  const bar = t.source === 'auto' ? readingBar(t.text) : null;

  const text = t.link
    ? h('a.task-text', { href: t.link, style: { color: 'var(--accent)', fontWeight: '600' } }, t.text, ' \u2192')
    : h('div.task-text', { tabindex: '0', role: 'button', 'aria-label': 'Edit task: ' + t.text,
        onclick: () => { if (!t.locked) { editing = t.id; render(); } },
        onkeydown: e => { if ((e.key === 'Enter' || e.key === ' ') && !t.locked) { e.preventDefault(); editing = t.id; render(); } }
      }, t.text);

  const del = h('button.icon-btn', {
    type: 'button', title: 'Delete task', 'aria-label': 'Delete task: ' + t.text,
    onclick: () => {
      /* The snapshot belongs to this button, not to the page. Sharing one
         between every row meant deleting a second task and then undoing the
         first toast put the wrong task back. */
      const index = tasks.all().findIndex(x => x.id === t.id);
      const snapshot = { ...t };
      if (tasks.remove(t.id)) {
        let undone = false;
        render();
        toast('Task deleted', h('button.btn.btn-sm', { type: 'button', style: { marginTop: '.4rem' }, onclick: () => {
          if (undone) return;
          undone = true;
          tasks.restore(snapshot, index);
          render();
        } }, 'Undo'));
      }
    }
  }, '×');

  return h('li.task' + (t.done ? '.done' : ''), {
    dataset: { source: t.source, locked: t.locked ? '1' : '0', taskId: t.id }
  }, check, h('div.task-main', text, bar, meta.children.length ? meta : null), t.locked ? null : del);
}

function render(focusTaskId) {
  const view = $('#view');
  if (!view || view.dataset.page !== 'tasks') return;
  const c = tasks.counts();
  const needle = query.trim().toLowerCase();
  const list = tasks.visible(filter)
    .filter(t => (setting('showCompleted') ? true : !t.done))
    .filter(t => (needle ? t.text.toLowerCase().includes(needle) : true));

  const submit = () => {
    const input = form.querySelector('input');
    if (tasks.add(input.value)) { input.value = ''; render(); input.focus(); }
  };

  const form = h('form.task-form', { onsubmit: e => { e.preventDefault(); submit(); } },
    h('input.input', {
      type: 'text', name: 'task', placeholder: 'What needs doing?', 'aria-label': 'New task',
      autocomplete: 'off', maxlength: '240',
      /* Implicit form submission covers this already on a normal keyboard,
         but this is the one control the entire second half of the game runs
         through, so it does not get to depend on that. */
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }
    }),
    h('button.btn.btn-primary', { type: 'submit' }, 'Add')
  );

  /* The list is three items when the app opens and past thirty by the last
     act, most of it written by something else. A box that narrows it is worth
     having by then and is only in the way before, so it appears once there is
     enough on the list to lose something in. */
  const search = c.total >= 8
    ? h('input.input.task-search', {
        type: 'search', value: query, placeholder: 'Search tasks', 'aria-label': 'Search tasks',
        autocomplete: 'off',
        oninput: e => { query = e.target.value; render(); },
        onkeydown: e => { if (e.key === 'Escape' && query) { e.preventDefault(); query = ''; render(); } }
      })
    : null;

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
    ? h('ul.task-list' + (wiped ? '.wiped' : ''), { 'aria-label': 'Tasks' }, ...list.map(taskRow))
    : h('div.empty',
        h('div.big', needle ? '⌕' : '✓'),
        h('p', needle
          ? `Nothing on the list matches “${query.trim()}”.`
          : c.total === 0
            ? 'Nothing here yet. Add your first task above.'
            : filter === 'done' ? 'Nothing completed yet.' : 'All done for now.')
      );

  /* Typing in either box re-renders the whole page, so remember which one the
     person was in and where their caret was. */
  const active = document.activeElement;
  const inForm = active === view.querySelector('.task-form input');
  const inSearch = active === view.querySelector('.task-search');
  const caret = inForm ? active.value : null;
  const searchCaret = inSearch ? active.selectionStart : null;

  /* From the moment the player learns they can be read, the box says so. It
     is the only instruction the conversation ever needs. */
  const listens = chapter() >= 1;
  const line = listens
    ? h('p.sync' + (waiting ? '.busy' : ''),
        waiting
          ? 'Something is reading your list…'
          : 'Anything you add here is read by the bench. Ask it something.')
    : null;

  /* While the backlog is landing the page stops being a to-do list for a few
     seconds and says what is actually happening, because that is the moment
     the game starts and it should not go past in silence. */
  const head = receiving
    ? h('div.page-head.receiving', h('div.grow',
        h('h1', 'Receiving'),
        h('p', `bench 4B · ${receiving} ${receiving === 1 ? 'entry' : 'entries'} restored`)))
    : h('div.page-head', h('div.grow',
        h('h1', 'Tasks'),
        h('p', c.active === 0 && c.total > 0 ? 'Everything is ticked off.' : `${c.active} to do`)));

  mount(view, h('div.page', head, form, line, search, filters, body));

  /* Re-rendering the whole list is simple and fast enough, but it throws
     focus away, so put it back where the person left it. */
  if (focusTaskId) {
    const box = view.querySelector(`.task[data-task-id="${focusTaskId}"] .task-check`);
    if (box) box.focus();
  } else if (caret !== null) {
    const input = view.querySelector('.task-form input');
    if (input) { input.value = caret; input.focus(); }
  } else if (inSearch) {
    const box = view.querySelector('.task-search');
    if (box) {
      box.focus();
      const at = searchCaret === null ? box.value.length : searchCaret;
      box.setSelectionRange(at, at);
    }
  }
}

export function mountTasks() {
  const view = $('#view');
  view.dataset.page = 'tasks';
  clear(view);
  render();
}

/* Re-render when anything outside this page changes the list. */
on('task:add', task => {
  if (task && task.source === 'user' && chapter() >= 1) waiting = true;
  render();
});
on('task:remove', () => render());
on('task:restore', () => render());
on('chapter', () => render());
on('story:spoke', () => { waiting = false; render(); });

/* The list is taken away for two seconds before the last act and then handed
   straight back. Nothing is actually deleted. */
on('fx:wipe', ({ state }) => { wiped = state === 'out'; render(); });

on('story:receiving', ({ n, done }) => { receiving = done ? 0 : n; render(); });

export { render as renderTasks };
