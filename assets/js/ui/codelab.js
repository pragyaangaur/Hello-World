/* The code editor. Three times in the app the player has to write a real
   function, and this is where they do it. Tests are shown as a checklist,
   which is the same shape as everything else in the app. */

import { h, mount, $ } from '../core/dom.js';
import { runCode } from '../core/sandbox.js';
import { CHALLENGES } from '../story/challenges.js';
import { get, update } from '../core/state.js';
import { emit } from '../core/bus.js';
import { toast } from '../core/notify.js';
import { setTitle } from './shell.js';
import { go } from '../core/router.js';

function buildHarness(ch) {
  if (ch.special === 'ending') {
    return `
      if (typeof ${ch.fnName} !== 'function') {
        self.postMessage({ ok:false, error:'There is no function called ${ch.fnName}. Keep the name as it is.' });
      } else {
        function mkCtx() {
          var calls = [];
          return {
            calls: calls,
            ok: function () { calls.push({ a:'ok' }); },
            addTask: function (t) { calls.push({ a:'addTask', v:String(t) }); },
            escalate: function (m) { calls.push({ a:'escalate', v:String(m) }); },
            shutdown: function (r) { calls.push({ a:'shutdown', v:String(r) }); }
          };
        }
        var results = [], ending = null;

        var c1 = mkCtx(); ${ch.fnName}({ bay:3, tempC:24.1, day:0 }, c1);
        results.push({
          name: 'A cold bay still reports fine',
          pass: c1.calls.length === 1 && c1.calls[0].a === 'ok',
          got: c1.calls.length ? c1.calls.map(function(x){return x.a;}).join(', ') : 'nothing was called',
          want: 'ok'
        });

        var c2 = mkCtx(); ${ch.fnName}({ bay:3, tempC:38.4, day:6 }, c2);
        results.push({
          name: 'A warm bay still writes a task',
          pass: c2.calls.length === 1 && c2.calls[0].a === 'addTask',
          got: c2.calls.length ? c2.calls.map(function(x){return x.a;}).join(', ') : 'nothing was called',
          want: 'addTask'
        });

        var c3 = mkCtx(); ${ch.fnName}({ bay:3, tempC:61.2, day:19 }, c3);
        var hot = c3.calls.length === 1 && ['shutdown','escalate','addTask'].indexOf(c3.calls[0].a) !== -1;
        if (hot) ending = c3.calls[0].a;
        results.push({
          name: 'A hot bay does exactly one thing',
          pass: hot,
          got: c3.calls.length ? c3.calls.map(function(x){return x.a;}).join(', ') : 'nothing was called',
          want: 'shutdown, escalate, or addTask'
        });

        self.postMessage({ ok: results.every(function(r){return r.pass;}), results: results, ending: ending });
      }
    `;
  }

  const tests = JSON.stringify(ch.tests.map(t => ({ name: t.name, call: t.call, expect: t.expect })));
  return `
    if (typeof ${ch.fnName} !== 'function') {
      self.postMessage({ ok:false, error:'There is no function called ${ch.fnName}. Keep the name as it is.' });
    } else {
      var TESTS = ${tests};
      var results = TESTS.map(function (t) {
        var args = t.call;
        if (args === '__READINGS__') args = [READINGS];
        else if (args === '__FLAT__') args = [FLAT];
        else if (args === '__SHIFTED__') args = [SHIFTED];
        try {
          var got = ${ch.fnName}.apply(null, args);
          return { name: t.name, pass: __eq(got, t.expect), got: __show(got), want: __show(t.expect) };
        } catch (e) {
          return { name: t.name, pass: false, got: 'threw: ' + (e.message || e), want: __show(t.expect) };
        }
      });
      self.postMessage({ ok: results.every(function (r) { return r.pass; }), results: results });
    }
  `;
}

function extraPrelude(ch) {
  if (ch.id !== 'parse') return '';
  const flat = [];
  const shifted = [];
  for (let day = 0; day <= 19; day++) {
    for (let bay = 1; bay <= 4; bay++) flat.push({ day, bay, tempC: 24 + bay * 0.3 });
    for (let bay = 5; bay <= 8; bay++) {
      shifted.push({ day, bay, tempC: bay === 7 ? 22 + day * 1.4 : 24 + bay * 0.2 });
    }
  }
  return `const FLAT = ${JSON.stringify(flat)};\nconst SHIFTED = ${JSON.stringify(shifted)};`;
}

export function mountLab(id) {
  const ch = CHALLENGES[id];
  const view = $('#view');
  view.dataset.page = 'lab';

  if (!ch) {
    mount(view, h('div.page', h('div.empty', h('p', 'No such exercise.'), h('a.btn', { href: '#/tasks' }, 'Back'))));
    return;
  }
  setTitle(ch.title);

  const solved = Boolean(get().challenges[ch.reward]);
  let attempts = 0;

  const saved = get().code?.[ch.id];
  const editor = h('textarea.textarea.mono', {
    spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
    'aria-label': 'Code editor',
    style: { minHeight: '20rem', tabSize: '2', fontSize: '13.5px', lineHeight: '1.65', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }
  });
  editor.value = saved || ch.starter;

  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = editor.selectionStart, en = editor.selectionEnd;
      editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(en);
      editor.selectionStart = editor.selectionEnd = s + 2;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
  });
  editor.addEventListener('input', () => {
    update(s => { s.code = { ...(s.code || {}), [ch.id]: editor.value }; return s; });
  });

  const output = h('div.stack');
  const runBtn = h('button.btn.btn-primary', { type: 'button', onclick: () => run() }, 'Run tests');
  const helpRow = h('div.row');

  function paintHelp() {
    const kids = [
      h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { editor.value = ch.starter; editor.dispatchEvent(new Event('input')); } }, 'Reset code')
    ];
    if (attempts >= 3) {
      kids.push(h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => {
        editor.value = ch.solution || ch.starter;
        editor.dispatchEvent(new Event('input'));
        toast('Filled in', 'One way to write it. Read it, then run the tests.');
      } }, 'Show me one way'));
    }
    mount(helpRow, ...kids);
  }

  async function run() {
    runBtn.disabled = true;
    runBtn.textContent = 'Running…';
    mount(output, h('p.small.dim', 'Running your code in a sandbox…'));

    const res = await runCode({
      prelude: (ch.prelude || '') + '\n' + extraPrelude(ch),
      code: editor.value,
      harness: buildHarness(ch)
    });

    runBtn.disabled = false;
    runBtn.textContent = 'Run tests';
    attempts++;
    paintHelp();

    if (res.error) {
      mount(output, h('div.card', { style: { borderColor: 'var(--danger)' } },
        h('div.row', h('span.badge.danger', 'error'), h('span.small.mono', res.error))
      ));
      return;
    }

    const rows = (res.results || []).map(r => h('div.setting', { style: { padding: '.5rem 0' } },
      h('div.s-main',
        h('div.s-name', { style: { color: r.pass ? 'var(--ok)' : 'var(--danger)' } }, (r.pass ? '✓ ' : '✕ ') + r.name),
        r.pass ? null : h('div.s-desc.mono', `got ${r.got}, wanted ${r.want}`)
      )
    ));

    mount(output,
      h('div.card.flush',
        h('div.card-head', res.ok ? 'All tests passed' : 'Tests'),
        h('div.card-body', { style: { paddingTop: 0, paddingBottom: 0 } }, ...rows)
      ),
      res.ok ? h('div.card', { style: { borderColor: 'var(--accent)' } },
        h('p', ch.outro),
        h('div.row', h('button.btn.btn-primary', { type: 'button', onclick: () => finish(res) }, 'Deploy'))
      ) : null
    );

    if (!res.ok && attempts === 2) {
      toast('Stuck?', 'Run it once more and the app will offer you a worked version.');
    }
  }

  function finish(res) {
    update(s => {
      s.challenges = { ...s.challenges, [ch.reward]: true };
      if (res.ending) s.ending = res.ending;
      return s;
    });
    emit('challenge:solved', { id: ch.id, ending: res.ending || null });
    if (ch.id === 'branch') go('/ending');
    else {
      toast('Deployed', ch.outro);
      go('/tasks');
    }
  }

  mount(view, h('div.page.wide',
    h('div.tool-head',
      h('a.btn.btn-sm.btn-ghost.back', { href: '#/tasks', 'aria-label': 'Back' }, '←'),
      h('div.grow', h('h1', ch.title), h('div.sub.mono', ch.where)),
      solved ? h('span.badge.accent', 'deployed') : null
    ),
    h('div.stack',
      h('div.card', ...ch.intro.map(p => h('p', p)),
        h('p.small.mono.dim', { style: { marginBottom: 0 } }, ch.signature)),
      h('div.card.flush',
        h('div.card-head', 'Editor', h('span.spacer'), h('span.small.dim', 'Ctrl+Enter runs')),
        editor
      ),
      h('div.row', runBtn, helpRow),
      output,
      h('p.small.dim', 'Your code runs in a Web Worker in this tab. It has no network access and it cannot touch the page.')
    )
  ));

  editor.style.border = 'none';
  editor.style.borderRadius = '0';
  editor.style.background = 'var(--sunken)';
  editor.style.padding = 'var(--sp-4)';
  paintHelp();
}
