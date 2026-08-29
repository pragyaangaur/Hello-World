/* The editor. The game asks for code exactly once, at the very end, and this
   is where that happens.

   The file is Python and it runs in the interpreter in core/python.js. The
   three buttons above the editor write the missing line, so a player who has
   never written Python still gets to make the decision the game is about. */

import { h, mount, $ } from '../core/dom.js';
import { runPython, toPython, pyRepr, PyFunction, PyError } from '../core/python.js';
import { CHALLENGES } from '../story/challenges.js';
import { get, update } from '../core/state.js';
import { emit } from '../core/bus.js';
import { toast } from '../core/notify.js';
import { setTitle } from './shell.js';
import { go } from '../core/router.js';

/* The three things the morning script is allowed to do. The Python side uses
   snake case and the endings are keyed in camel case, so the mapping lives
   here and nowhere else. */
const ACTIONS = ['shutdown', 'escalate', 'add_task'];
const ENDING_KEY = { shutdown: 'shutdown', escalate: 'escalate', add_task: 'addTask' };

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

      if (passed && ACTIONS.includes(only) && scenario.want.includes(',')) ending = ENDING_KEY[only];

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

async function runChallenge(ch, code) {
  /* The interpreter is synchronous, and one held frame reads as the editor
     doing something rather than as a stall. */
  await new Promise(resolve => setTimeout(resolve, 60));
  return runPythonChallenge(ch, code);
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

  const indent = '    ';
  const solved = Boolean(get().challenges[ch.reward]);
  let attempts = 0;

  const saved = get().code?.[ch.id];
  const editor = h('textarea.textarea.mono', {
    spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
    'aria-label': 'Code editor, Python',
    style: { minHeight: '20rem', tabSize: '4', fontSize: '13.5px', lineHeight: '1.65', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }
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
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
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

  /* The three buttons that write the missing line. They exist so that not
     knowing Python is never the reason somebody cannot finish the game.

     Only the line this button put there last time is taken out again, so
     pressing a second button swaps the choice and leaves the two branches
     that were already in the file alone. */
  let inserted = null;

  function chooseLine(choice) {
    const kept = editor.value
      .split('\n')
      .filter(line => inserted === null || line.trim() !== inserted.trim())
      .join('\n')
      .replace(/\s+$/, '');
    inserted = choice.line;
    editor.value = kept + '\n\n' + choice.line + '\n';
    editor.dispatchEvent(new Event('input'));
    editor.focus();
    editor.selectionStart = editor.selectionEnd = editor.value.length;
  }

  const choiceCard = (ch.choices && ch.choices.length)
    ? h('div.card.flush',
        h('div.card-head', 'Pick one'),
        h('div.card-body', { style: { paddingTop: 0 } },
          h('p.small.dim', 'Press a button and the line is written into the editor below. You can edit it afterwards, or ignore these and write your own.'),
          h('div.choices', ...ch.choices.map(choice =>
            h('button.choice', { type: 'button', onclick: () => chooseLine(choice) },
              h('span.choice-name', choice.label),
              h('span.choice-desc', choice.desc)
            )
          ))
        ))
    : null;
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
    mount(output, h('p.small.dim', 'Running your Python…'));

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
          'Deploy to bench 4B'))
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
      h('span.badge.accent', 'Python'),
      solved ? h('span.badge.accent', 'deployed') : null
    ),
    h('div.stack',
      h('div.card',
        ...ch.intro.map(p => h('p', p)),
        h('p.small.mono.dim', { style: { marginBottom: 0 } }, ch.signature)),
      ch.runsOn ? h('p.small.dim', { style: { margin: 0 } }, ch.runsOn) : null,
      choiceCard,
      h('div.card.flush',
        h('div.card-head',
          'Editor',
          h('span.spacer'),
          h('span.small.dim', 'Ctrl+Enter runs')),
        editor
      ),
      h('div.row', runBtn, helpRow),
      output,
      h('p.small.dim', 'Your Python runs in an interpreter written for this app. It is offline, it has no imports, and it cannot touch the page.')
    )
  ));

  editor.style.border = 'none';
  editor.style.borderRadius = '0';
  editor.style.background = 'var(--sunken)';
  editor.style.padding = 'var(--sp-4)';
  paintHelp();
}
