/* The frame around every page: navigation, the account chip, and the
   document title. Navigation is rebuilt whenever the chapter moves, which
   is how new sections appear without a reload. */

import { h, mount, $ } from '../core/dom.js';
import { get, chapter, hasFlag } from '../core/state.js';
import { counts } from '../core/tasks.js';
import { byId } from '../modules/index.js';
import { on } from '../core/bus.js';
import { modal } from '../core/notify.js';
import { accountCard } from '../story/accounts.js';
import { ACTS } from '../story/acts.js';
import { currentStep } from '../story/engine.js';
import { benchChip } from '../story/rig.js';

const NAV = [
  { group: null, items: [
    { path: '/tasks', label: 'Tasks', ico: '☑', min: 0, counter: () => counts().active || null }
  ]},
  { group: 'Tools', items: [
    { path: '/tools', label: 'Toolbox', ico: '⌗', min: 1 }
  ]},
  { group: 'Project', items: [
    { path: '/bench', label: 'Bench 4B', ico: '▤', min: 2 },
    { path: '/console', label: 'Console', ico: '\u203a_', min: 6 }
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
    bar.dataset.done = '1';
    mount(bar,
      h('span.obj-label', 'finished'),
      h('span.obj-goal', h('span', 'You sent the word. Everything still works.')),
      h('a.obj-go', { href: '#/ending' }, 'The ending →')
    );
    return;
  }

  bar.hidden = false;
  delete bar.dataset.done;

  const nodes = [
    h('span.obj-label', `${step.n} / ${step.total - 1}`),
    h('span.obj-goal', h('span', step.goal))
  ];

  if (step.hint) nodes.push(h('button.obj-hint-btn', {
    type: 'button',
    'aria-expanded': String(hintOpen),
    'aria-label': hintOpen ? 'Hide the hint' : 'Show a hint',
    onclick: () => { hintOpen = !hintOpen; renderObjective(); }
  }, hintOpen ? '×' : '?'));

  /* One button, and it goes to the tool the act needs. */
  const first = step.tools && step.tools[0];
  const tool = first ? byId(first) : null;
  if (tool) nodes.push(h('a.obj-go', { href: '#/tools/' + tool.id }, tool.name + ' →'));
  else if (step.link) nodes.push(h('a.obj-go', { href: step.link }, 'Go →'));

  mount(bar, ...nodes);

  if (hintOpen && step.hint) {
    bar.appendChild(h('div.obj-hint', h('span', step.hint),
      step.tools && step.tools.length > 1
        ? h('span.obj-tools', ...step.tools.map(id => {
            const t = byId(id);
            return t ? h('a.obj-tool', { href: '#/tools/' + id }, t.name) : null;
          }))
        : null));
  }
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

/* A live reading of the thing that is going wrong, pinned in the sidebar
   from the moment the player knows there is a bench at all. It is the one
   piece of the story that is on screen at all times, and it is a number and
   a bar rather than a sentence. */
export function renderBench() {
  const slot = $('#bench-slot');
  if (!slot) return;
  if (chapter() < 2 || hasFlag('story.settled')) { slot.hidden = true; mount(slot); return; }
  slot.hidden = false;
  mount(slot, benchChip());
}

export function initShell() {
  renderNav();
  renderAccount();
  renderObjective();
  renderBench();
  setInterval(renderBench, 9000);

  on('route', () => renderNav());
  on('chapter', ({ to }) => {
    renderNav();
    renderAccount();
    renderObjective();
    renderBench();
    const current = ACTS[to];
    if (current) announce(`${current.name}. ${current.goal}`);
  });
  on('flag', () => { renderNav(); renderAccount(); renderObjective(); renderBench(); });
  on('story:act', () => { renderNav(); renderAccount(); renderObjective(); renderBench(); });
  on('tool:first', () => renderObjective());

  for (const signal of ['task:add', 'task:complete', 'task:reopen', 'task:remove', 'task:clearDone']) {
    on(signal, () => { renderNav(); renderObjective(); });
  }
}
