/* Entry point. Wires the router to the pages and starts the story engine. */

import { $ } from './core/dom.js';
import { applyDocumentAttributes, get } from './core/state.js';
import * as router from './core/router.js';
import { initShell, setTitle } from './ui/shell.js';
import { mountTasks } from './ui/todo.js';
import { mountToolbox, mountTool, disposeTool } from './ui/toolbox.js';
import { mountSettings, mountAbout } from './ui/settings.js';
import { mountFindings } from './ui/findings.js';
import { mountConsole } from './ui/console.js';
import { mountLab } from './ui/codelab.js';
import { mountEnding } from './ui/ending.js';
import { maybeShowNotice } from './ui/onboarding.js';
import { startStory } from './story/engine.js';
import { startAtmosphere } from './story/atmosphere.js';
import { mountNotFound } from './ui/notfound.js';
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

router.route('/tasks',        page(mountTasks, 'Tasks'));
router.route('/tools',        page(mountToolbox));
router.route('/tools/:id',    page(ctx => mountTool(ctx.params.id)));
router.route('/lab/:id',      page(ctx => mountLab(ctx.params.id)));
router.route('/findings',     page(mountFindings, 'Findings'));
router.route('/ending',       page(mountEnding));
router.route('/console',      page(mountConsole, 'Console'));
router.route('/settings',     page(mountSettings, 'Settings'));
router.route('/about',        page(mountAbout, 'About'));
router.fallback(page(mountNotFound, 'Not found'));

function boot() {
  applyDocumentAttributes();
  $('#app').hidden = false;
  initShell();
  installDebug();
  maybeShowNotice(() => {
    startStory();
    startAtmosphere();
    router.start('/tasks');
  });
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
