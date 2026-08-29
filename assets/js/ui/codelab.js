/* The editor. Three times in the app the player has to write a real function,
   and this is where they do it.

   Two of the three are Python, and those run in the interpreter in
   core/python.js. The third is JavaScript and runs in a Web Worker. Both
   paths return the same shape, so everything below the runner is shared. */

import { h, mount, $ } from '../core/dom.js';
import { runCode } from '../core/sandbox.js';
import { runPython, toPython, pyRepr, PyFunction, PyError } from '../core/python.js';
import { CHALLENGES } from '../story/challenges.js';
import { get, update } from '../core/state.js';
import { emit } from '../core/bus.js';
import { toast } from '../core/notify.js';
import { setTitle } from './shell.js';
import { go } from '../core/router.js';

/* The three things the morning script is allowed to do. The player picks one
   and that choice is the ending, so the names live in one place. */
const ACTIONS = ['shutdown', 'escalate', 'add_task'];

const SCENARIOS = [
  { name: 'A cold bay still reports fine',   reading: { bay: 3, tempC: 24.1, day: 0 },  want: 'ok' },
  { name: 'A warm bay still writes a task',  reading: { bay: 3, tempC: 38.4, day: 6 },  want: 'add_task' },
  { name: 'A hot bay does exactly one thing', reading: { bay: 3, tempC: 61.2, day: 19 }, want: 'shutdown, escalate, or add_task' }
];

/* ------------------------------------------------------------------ Python */

/* The prelude is pasted above the player's code before it runs, so every line
   number the interpreter reports is too high by the length of the prelude.
   Nobody should have to do that subtraction in their head. */
function shiftLines(message, offset) {
  if (!offset || !message) return message;
  return String(message).replace(/\(line (\d+)\)/g, (whole, n) => {
    const real = Number(n) - offset;
    return real > 0 ? `(line ${real})` : whole;
  });
}

function runPythonChallenge(ch, code) {
  const prelude = ch.prelude ? ch.prelude + '\n\n' : '';
  const offset = prelude ? prelude.split('\n').length - 1 : 0;
  const source = prelude + code;
  const loaded = runPython(source);

  if (!loaded.ok) {
    return { ok: false, error: shiftLines(loaded.error, offset), output: loaded.output };
  }

  const interpreter = loaded.interpreter;
  const fn = interpreter.get(ch.fnName);

  if (!(fn instanceof PyFunction)) {
    return {
      ok: false,
      output: interpreter.output,
      error: `There is no function called ${ch.fnName}. Keep the name exactly as it is.`
    };
  }

  /* Each test gets the whole step budget to itself, so one slow case cannot
     starve the next one. */
  const callOnce = args => {
    interpreter.steps = 0;
    return interpreter.call(fn, args);
  };

  if (ch.special === 'ending') {
    const results = [];
    let ending = null;

    for (const scenario of SCENARIOS) {
      const calls = [];
      const ctx = {
        ok: () => { calls.push('ok'); },
        add_task: () => { calls.push('add_task'); },
        escalate: () => { calls.push('escalate'); },
        shutdown: () => { calls.push('shutdown'); }
      };

      let threw = null;
      try {
        callOnce([toPython(scenario.reading), ctx]);
      } catch (err) {
        threw = shiftLines(err instanceof PyError ? err.message : String((err && err.message) || err), offset);
      }

      const only = calls.length === 1 ? calls[0] : null;
      const passed = threw
        ? false
        : scenario.want === 'ok' || scenario.want === 'add_task'
          ? only === scenario.want
          : ACTIONS.includes(only);

      if (passed && ACTIONS.includes(only) && scenario.want.includes(',')) ending = only;

      results.push({
        name: scenario.name,
        pass: passed,
        got: threw || (calls.length ? calls.join(', ') : 'nothing was called'),
        want: scenario.want
      });
    }

    return {
      ok: results.every(r => r.pass),
      results,
      ending,
      output: interpreter.output
    };
  }

  const results = ch.tests.map(test => {
    try {
      const got = callOnce((test.call || []).map(toPython));
      return {
        name: test.name,
        pass: samePython(got, test.expect),
        got: pyRepr(got),
        want: pyRepr(test.expect)
      };
    } catch (err) {
      const message = shiftLines(err instanceof PyError ? err.message : String((err && err.message) || err), offset);
      return { name: test.name, pass: false, got: message, want: pyRepr(test.expect) };
    }
  });

  return { ok: results.every(r => r.pass), results, output: interpreter.output };
}

function samePython(got, want) {
  if (Array.isArray(got) && Array.isArray(want)) {
    return got.length === want.length && got.every((item, i) => samePython(item, want[i]));
  }
  return got === want;
}

/* -------------------------------------------------------------- JavaScript */

function buildHarness(ch) {
  const tests = JSON.stringify(ch.tests.map(t => ({ name: t.name, call: t.call, expect: t.expect })));
  return `
    if (typeof ${ch.fnName} !== 'function') {
      self.postMessage({ ok:false, error:'There is no function called ${ch.fnName}. Keep the name exactly as it is.' });
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

async function runChallenge(ch, code) {
  if (ch.lang === 'python') {
    /* The interpreter is synchronous, and a single frame of held paint reads
       as the editor doing something rather than as a stall. */
    await new Promise(resolve => setTimeout(resolve, 60));
    return runPythonChallenge(ch, code);
  }
  return runCode({
    prelude: (ch.prelude || '') + '\n' + extraPrelude(ch),
    code,
    harness: buildHarness(ch)
  });
}

/* -------------------------------------------------------------- the screen */

export function mountLab(id) {
  const ch = CHALLENGES[id];
  const view = $('#view');
  view.dataset.page = 'lab';

  if (!ch) {
    mount(view, h('div.page', h('div.empty', h('p', 'No such exercise.'), h('a.btn', { href: '#/tasks' }, 'Back'))));
    return;
  }
  setTitle(ch.title);

  const python = ch.lang === 'python';
  const indent = python ? '    ' : '  ';
  const solved = Boolean(get().challenges[ch.reward]);
  let attempts = 0;

  const saved = get().code?.[ch.id];
  const editor = h('textarea.textarea.mono', {
    spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
    'aria-label': `Code editor, ${python ? 'Python' : 'JavaScript'}`,
    style: { minHeight: '20rem', tabSize: python ? '4' : '2', fontSize: '13.5px', lineHeight: '1.65', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }
  });
  editor.value = saved || ch.starter;

  editor.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.slice(0, start) + indent + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + indent.length;
      editor.dispatchEvent(new Event('input'));
    }
    /* Python is whitespace sensitive, so carrying the current indent onto the
       next line is the difference between usable and infuriating. */
    if (e.key === 'Enter' && python && !e.metaKey && !e.ctrlKey) {
      const start = editor.selectionStart;
      if (start !== editor.selectionEnd) return;
      const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
      const line = editor.value.slice(lineStart, start);
      const lead = (line.match(/^[ \t]*/) || [''])[0];
      const deeper = /:\s*(#.*)?$/.test(line) ? indent : '';
      if (!lead && !deeper) return;
      e.preventDefault();
      const insert = '\n' + lead + deeper;
      editor.value = editor.value.slice(0, start) + insert + editor.value.slice(editor.selectionEnd);
      editor.selectionStart = editor.selectionEnd = start + insert.length;
      editor.dispatchEvent(new Event('input'));
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
  });

  editor.addEventListener('input', () => {
    update(s => { s.code = { ...(s.code || {}), [ch.id]: editor.value }; return s; });
  });

  const output = h('div.stack');
  const runLabel = ch.special === 'ending' ? 'Dry run' : 'Run';
  const runBtn = h('button.btn.btn-primary', { type: 'button', onclick: () => run() }, runLabel);
  const helpRow = h('div.row');

  function paintHelp() {
    const kids = [
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button',
        onclick: () => { editor.value = ch.starter; editor.dispatchEvent(new Event('input')); }
      }, 'Reset code')
    ];
    if (attempts >= 3) {
      kids.push(h('button.btn.btn-sm.btn-ghost', {
        type: 'button',
        onclick: () => {
          editor.value = ch.solution || ch.starter;
          editor.dispatchEvent(new Event('input'));
          toast('Filled in', 'One way to write it. Read it, then run it.');
        }
      }, 'Show me one way'));
    }
    mount(helpRow, ...kids);
  }

  async function run() {
    runBtn.disabled = true;
    runBtn.textContent = 'Running…';
    mount(output, h('p.small.dim', python
      ? 'Running your Python…'
      : 'Running your code in a sandbox…'));

    const res = await runChallenge(ch, editor.value);

    runBtn.disabled = false;
    runBtn.textContent = runLabel;
    attempts++;
    paintHelp();

    const printed = (res.output && res.output.length)
      ? h('div.card.flush',
          h('div.card-head', 'Output'),
          h('div.card-body', h('pre.mono.small', {
            style: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }
          }, res.output.join('\n'))))
      : null;

    if (res.error) {
      mount(output,
        h('div.card', { style: { borderColor: 'var(--danger)' } },
          h('div.row', h('span.badge.danger', 'error'), h('span.small.mono', res.error))),
        printed);
      return;
    }

    const rows = (res.results || []).map(r => h('div.setting', { style: { padding: '.5rem 0' } },
      h('div.s-main',
        h('div.s-name', { style: { color: r.pass ? 'var(--ok)' : 'var(--danger)' } }, (r.pass ? '✓ ' : '✕ ') + r.name),
        r.pass ? null : h('div.s-desc.mono', `got ${r.got}, wanted ${r.want}`)
      )
    ));

    mount(output,
      printed,
      h('div.card.flush',
        h('div.card-head', res.ok ? 'It runs' : 'What happened'),
        h('div.card-body', { style: { paddingTop: 0, paddingBottom: 0 } }, ...rows)
      ),
      res.ok ? h('div.card', { style: { borderColor: 'var(--accent)' } },
        h('p', ch.outro),
        h('div.row', h('button.btn.btn-primary', { type: 'button', onclick: () => finish(res) },
          python ? 'Deploy to bench 4B' : 'Deploy'))
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
      h('span.badge' + (python ? '.accent' : ''), python ? 'Python' : 'JavaScript'),
      solved ? h('span.badge.accent', 'deployed') : null
    ),
    h('div.stack',
      h('div.card',
        ...ch.intro.map(p => h('p', p)),
        h('p.small.mono.dim', { style: { marginBottom: 0 } }, ch.signature)),
      ch.runsOn ? h('p.small.dim', { style: { margin: 0 } }, ch.runsOn) : null,
      h('div.card.flush',
        h('div.card-head',
          'Editor',
          h('span.spacer'),
          h('span.small.dim', 'Ctrl+Enter runs')),
        editor
      ),
      h('div.row', runBtn, helpRow),
      output,
      h('p.small.dim', python
        ? 'Your Python runs in an interpreter written for this app. It is offline, it has no imports, and it cannot touch the page.'
        : 'Your code runs in a Web Worker in this tab. It has no network access and it cannot touch the page.')
    )
  ));

  editor.style.border = 'none';
  editor.style.borderRadius = '0';
  editor.style.background = 'var(--sunken)';
  editor.style.padding = 'var(--sp-4)';
  paintHelp();
}
