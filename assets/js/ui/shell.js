/* The frame around every page: navigation, the account chip, and the
   document title. Navigation is rebuilt whenever the chapter moves, which
   is how new sections appear without a reload. */

import { h, mount, $ } from '../core/dom.js';
import { get, chapter, hasFlag } from '../core/state.js';
import { counts } from '../core/tasks.js';
import { on } from '../core/bus.js';
import { modal } from '../core/notify.js';
import { accountCard } from '../story/accounts.js';
import { CHAPTERS } from '../story/beats.js';
import { currentStep } from '../story/engine.js';

const NAV = [
  { group: null, items: [
    { path: '/tasks', label: 'Tasks', ico: '☑', min: 0, counter: () => counts().active || null }
  ]},
  { group: 'Tools', items: [
    { path: '/tools', label: 'Toolbox', ico: '⌗', min: 1 }
  ]},
  { group: 'Project', items: [
    { path: '/findings', label: 'Findings', ico: '⌕', min: 3 },
    { path: '/console', label: 'Console', ico: '\u203a_', min: 4 }
  ]},
  { group: null, items: [
    { path: '/settings', label: 'Settings', ico: '⚙', min: 0 }
  ]}
];

export function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  const ch = chapter();
  const hash = location.hash.replace(/^#/, '') || '/tasks';
  const nodes = [];

  for (const section of NAV) {
    const items = section.items.filter(i => ch >= i.min);
    if (!items.length) continue;
    if (section.group) nodes.push(h('div.nav-group-label', section.group));
    for (const item of items) {
      const active = hash === item.path || hash.startsWith(item.path + '/');
      const n = item.counter ? item.counter() : null;
      const fresh = get().seenTools[item.path] === undefined && item.min > 0 && ch >= item.min;
      nodes.push(h('a', {
        href: '#' + item.path,
        'aria-current': active ? 'page' : null
      },
        h('span.ico', { 'aria-hidden': 'true' }, item.ico),
        h('span', item.label),
        n ? h('span.count', String(n)) : (fresh && !active ? h('span.dot-new') : null)
      ));
    }
  }
  mount(nav, ...nodes);
}

/* The line across the top of the screen that says what the app is waiting
   for. It is rebuilt on every change that could move the player forward, so
   a tool they just opened or a task they just ticked shows up straight away. */
export function renderObjective() {
  const bar = $('#objective');
  if (!bar) return;

  const step = currentStep();
  if (!step) { bar.hidden = true; return; }

  const done = Boolean(get().ending);
  if (done) {
    bar.hidden = false;
    mount(bar,
      h('span.obj-label', 'done'),
      h('span.obj-goal', 'You wrote the branch. Every tool still works, and your tasks are still here.'),
      h('a.obj-go', { href: '#/ending' }, 'Read the ending again')
    );
    return;
  }

  bar.hidden = false;
  const counted = step.progress;

  mount(bar,
    h('span.obj-label', `step ${step.n + 1} of 6`),
    h('span.obj-goal',
      h('span', step.goal),
      step.hint ? h('span.obj-hint', step.hint) : null),
    counted ? h('span.obj-count', `${counted.done} of ${counted.total} ${counted.unit}`) : null,
    counted ? h('span.obj-bar', h('span', {
      style: { width: Math.round((counted.done / counted.total) * 100) + '%' }
    })) : null,
    step.link ? h('a.obj-go', { href: step.link }, 'Go →') : null
  );
}

export function renderAccount() {
  const chip = $('#account-chip');
  if (!chip) return;
  const s = get();
  const ch = chapter();
  const named = ch >= 3 || hasFlag('accounts.seen');
  const name = named ? 'user_04' : 'Guest';
  const sub = named ? (ch >= 4 ? 'session active · 2y 41d' : 'signed in locally') : 'local account';
  const initial = named ? '4' : '?';
  mount(chip,
    h('span.avatar', { 'aria-hidden': 'true' }, initial),
    h('span.account-text', h('span.account-name', name), h('span.account-sub', sub))
  );
  chip.onclick = () => modal({ title: 'Account', body: accountCard(), actions: [{ label: 'Close', primary: true }] });
}

/* Chapters change what exists in the navigation, which a sighted person sees
   and a screen reader would otherwise miss entirely. */
export function announce(message) {
  const live = document.getElementById('live-region');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = message; }, 60);
}

export function setTitle(text) {
  document.title = text ? `${text} · Hello World` : 'Hello World';
}

export function initShell() {
  renderNav();
  renderAccount();
  renderObjective();

  on('route', () => renderNav());
  on('chapter', ({ to }) => {
    renderNav();
    renderAccount();
    renderObjective();
    const beat = CHAPTERS[to];
    if (beat) announce(`${beat.name}. ${beat.goal}`);
  });
  on('flag', () => { renderNav(); renderAccount(); renderObjective(); });
  on('tool:first', () => renderObjective());
  on('finding', () => renderObjective());
  on('challenge:solved', () => renderObjective());

  for (const signal of ['task:add', 'task:complete', 'task:reopen', 'task:remove', 'task:clearDone']) {
    on(signal, () => { renderNav(); renderObjective(); });
  }
}
