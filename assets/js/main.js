/* Entry point. Wires the router to the pages, seeds the list the previous
   owner left behind, and starts the story. There is no splash screen and no
   notice: the app opens on a to-do list, which is the point. */

import { $ } from './core/dom.js';
import { applyDocumentAttributes } from './core/state.js';
import * as router from './core/router.js';
import { initShell, setTitle } from './ui/shell.js';
import { mountTasks } from './ui/todo.js';
import { mountToolbox, mountTool, disposeTool } from './ui/toolbox.js';
import { mountSettings, mountAbout } from './ui/settings.js';
import { mountConsole } from './ui/console.js';
import { mountEnding } from './ui/ending.js';
import { mountBench } from './ui/bench.js';
import { mountNotFound } from './ui/notfound.js';
import { seed } from './core/tasks.js';
import { LEFTOVER, leftoverNote } from './story/acts.js';
import { ANCHORS } from './story/cast.js';
import { startStory } from './story/engine.js';
import { startAtmosphere } from './story/atmosphere.js';
import { installDebug } from './core/debug.js';

function page(fn, title) {
  return ctx => {
    disposeTool();
    fn(ctx);
    if (title) setTitle(title);
    const view = $('#view');
    view.scrollIntoView?.({ block: 'start' });
    if (document.activeElement === document.body) view.focus({ preventScroll: true });
  };
}

router.route('/tasks',     page(mountTasks, 'Tasks'));
router.route('/tools',     page(mountToolbox));
router.route('/tools/:id', page(ctx => mountTool(ctx.params.id)));
router.route('/ending',    page(mountEnding));
router.route('/bench',     page(mountBench));
router.route('/console',   page(mountConsole, 'Console'));
router.route('/settings',  page(mountSettings, 'Settings'));
router.route('/about',     page(mountAbout, 'About'));
router.fallback(page(mountNotFound, 'Not found'));

/* The three tasks that were open when the last person to use this machine
   walked away, dated to the day they stopped logging in. */
function seedLeftovers() {
  seed(LEFTOVER.map(item => ({
    text: item.text,
    source: 'leftover',
    note: leftoverNote(),
    by: item.who.name,
    createdAt: ANCHORS.lastHuman.toISOString()
  })));
}

function boot() {
  applyDocumentAttributes();
  $('#app').hidden = false;
  initShell();
  installDebug();
  seedLeftovers();
  startStory();
  startAtmosphere();
  router.start('/tasks');
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
