/* The Toolbox: a grid of every unlocked tool, and the frame each tool
   renders inside. Tools know nothing about routing or chapters. */

import { h, mount, clear, $ } from '../core/dom.js';
import { registry, byId, DEPT_ORDER } from '../modules/index.js';
import { get, chapter, update } from '../core/state.js';
import { emit } from '../core/bus.js';
import { setTitle } from './shell.js';

let activeCleanup = null;

export function disposeTool() {
  if (typeof activeCleanup === 'function') { try { activeCleanup(); } catch (e) { console.error(e); } }
  activeCleanup = null;
}

function unlocked() {
  const ch = chapter();
  return registry.filter(m => ch >= m.chapter);
}

export function mountToolbox() {
  disposeTool();
  const view = $('#view');
  view.dataset.page = 'tools';
  setTitle('Toolbox');
  const seen = get().seenTools;
  const mods = unlocked();

  const groups = new Map();
  for (const m of mods) {
    if (!groups.has(m.dept)) groups.set(m.dept, []);
    groups.get(m.dept).push(m);
  }

  const sections = DEPT_ORDER.filter(d => groups.has(d)).map(dept =>
    h('section',
      h('div.dept-head', h('h2', dept), h('span.line')),
      h('div.tool-grid', ...groups.get(dept).map(m =>
        h('a.tool-card', { href: '#/tools/' + m.id },
          seen[m.id] ? null : h('span.t-new', { 'aria-label': 'New' }),
          h('span.t-ico', { 'aria-hidden': 'true' }, m.icon),
          h('span.t-name', m.name),
          h('span.t-dept', m.blurb)
        )
      ))
    )
  );

  mount(view, h('div.page.wide',
    h('div.page-head', h('div.grow',
      h('h1', 'Toolbox'),
      h('p', `${mods.length} tools. Small things we built while learning, kept because throwing them away felt worse.`)
    )),
    ...sections
  ));
}

export function mountTool(id) {
  disposeTool();
  const mod = byId(id);
  const view = $('#view');
  view.dataset.page = 'tool';

  if (!mod || chapter() < mod.chapter) {
    const hasToolbox = chapter() >= 1;
    mount(view, h('div.page',
      h('div.empty', h('div.big', '\u2337'),
        h('p', hasToolbox ? 'That tool is not in this build.' : 'There is no toolbox in this build.'),
        h('a.btn', { href: hasToolbox ? '#/tools' : '#/tasks' },
          hasToolbox ? 'Back to the Toolbox' : 'Back to your tasks'))
    ));
    setTitle('Not found');
    return;
  }

  setTitle(mod.name);
  if (!get().seenTools[mod.id]) {
    update(s => { s.seenTools = { ...s.seenTools, [mod.id]: new Date().toISOString() }; return s; });
    emit('tool:first', mod);
  }
  emit('tool:open', mod);

  const body = h('div.stack');
  mount(view, h('div.page' + (mod.wide ? '.wide' : ''),
    h('div.tool-head',
      h('a.btn.btn-sm.btn-ghost.back', { href: '#/tools', 'aria-label': 'Back to Toolbox' }, '←'),
      h('div.grow', h('h1', mod.name), h('div.sub', mod.blurb)),
      mod.dept ? h('span.badge', mod.dept) : null
    ),
    body
  ));

  try { activeCleanup = mod.mount(body) || null; }
  catch (err) {
    console.error('[tool]', id, err);
    mount(body, h('div.card', h('p', 'This tool failed to start. Reloading the page usually fixes it.')));
  }
}
