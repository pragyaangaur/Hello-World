import { h, mount, kv } from '../core/dom.js';
import { blip } from '../core/audio.js';
import { emit } from '../core/bus.js';

/* A real expression parser rather than eval, because eval on user input is
   how you end up with an app that can run anything anyone pastes into it. */

const OPS = {
  '+': { p: 1, f: (a, b) => a + b },
  '-': { p: 1, f: (a, b) => a - b },
  '*': { p: 2, f: (a, b) => a * b },
  '/': { p: 2, f: (a, b) => a / b },
  '%': { p: 2, f: (a, b) => a % b },
  '^': { p: 4, f: (a, b) => Math.pow(a, b), right: true }
};
const FNS = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  ln: Math.log, log: Math.log10, abs: Math.abs, round: Math.round, floor: Math.floor
};
const CONSTS = { pi: Math.PI, e: Math.E };

export function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j; continue;
    }
    if (/[a-z]/i.test(c)) {
      let j = i;
      while (j < src.length && /[a-z]/i.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      if (word in CONSTS) out.push({ t: 'num', v: CONSTS[word] });
      else if (word in FNS) out.push({ t: 'fn', v: word });
      else throw new Error('Unknown name: ' + word);
      i = j; continue;
    }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    if (c in OPS) {
      const prev = out[out.length - 1];
      const unary = c === '-' && (!prev || prev.t === 'op' || prev.t === '(');
      out.push(unary ? { t: 'neg' } : { t: 'op', v: c });
      i++; continue;
    }
    throw new Error('Unexpected character: ' + c);
  }
  return out;
}

export function evaluate(src) {
  const tokens = tokenize(src);
  const vals = [], ops = [];
  const apply = () => {
    const op = ops.pop();
    if (op.t === 'neg') { vals.push(-vals.pop()); return; }
    if (op.t === 'fn') { vals.push(FNS[op.v](vals.pop())); return; }
    const b = vals.pop(), a = vals.pop();
    if (a === undefined || b === undefined) throw new Error('Incomplete expression');
    vals.push(OPS[op.v].f(a, b));
  };
  for (const tk of tokens) {
    if (tk.t === 'num') vals.push(tk.v);
    else if (tk.t === 'fn' || tk.t === 'neg') ops.push(tk);
    else if (tk.t === '(') ops.push(tk);
    else if (tk.t === ')') {
      while (ops.length && ops[ops.length - 1].t !== '(') apply();
      if (!ops.length) throw new Error('Unbalanced brackets');
      ops.pop();
      if (ops.length && ops[ops.length - 1].t === 'fn') apply();
    } else {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === '(') break;
        if (top.t === 'fn' || top.t === 'neg') { apply(); continue; }
        const a = OPS[top.v], b = OPS[tk.v];
        if (a.p > b.p || (a.p === b.p && !b.right)) apply();
        else break;
      }
      ops.push(tk);
    }
  }
  while (ops.length) {
    if (ops[ops.length - 1].t === '(') throw new Error('Unbalanced brackets');
    apply();
  }
  if (vals.length !== 1) throw new Error('Incomplete expression');
  return vals[0];
}

const KEYS = [
  ['(', ')', '%', '⌫'],
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+']
];

export default {
  id: 'calculator',
  name: 'Calculator',
  dept: 'Everyday',
  icon: '=',
  chapter: 1,
  blurb: 'Arithmetic with brackets',

  mount(root) {
    let expr = '';
    let history = [];
    const display = h('div.readout.big', { style: { textAlign: 'right' } }, '0');
    const sub = h('div.small.dim.mono', { style: { textAlign: 'right', minHeight: '1.2em' } }, '');
    const histBox = h('div.stack');

    const setExpr = v => {
      expr = v;
      display.textContent = expr || '0';
      try { sub.textContent = expr ? '= ' + trim(evaluate(expr)) : ''; }
      catch { sub.textContent = ''; }
    };

    const trim = n => {
      if (!Number.isFinite(n)) return 'undefined';
      const r = Math.round(n * 1e10) / 1e10;
      return String(r);
    };

    const press = k => {
      blip();
      if (k === '⌫') return setExpr(expr.slice(0, -1));
      if (k === 'C') return setExpr('');
      if (k === '=') {
        if (!expr) return;
        try {
          const value = evaluate(expr);
          history = [{ expr, value: trim(value) }, ...history].slice(0, 8);
          emit('calc:eval', { expr, value });
          setExpr(trim(value));
          renderHistory();
        } catch (err) {
          display.textContent = err.message;
          sub.textContent = '';
        }
        return;
      }
      setExpr(expr + k);
    };

    const renderHistory = () => {
      mount(histBox, history.length
        ? h('div.card.flush',
            h('div.card-head', 'Recent'),
            h('div.card-body', { style: { paddingTop: '.5rem', paddingBottom: '.5rem' } },
              ...history.map(item => h('div.setting', { style: { padding: '.35rem 0' } },
                h('div.s-main', h('div.s-desc.mono', item.expr)),
                h('button.btn.btn-sm.btn-ghost.mono', { type: 'button', onclick: () => setExpr(item.value) }, item.value)
              ))
            )
          )
        : null);
    };

    const pad = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.5rem' } });
    for (const row of KEYS) for (const k of row) {
      pad.appendChild(h('button.btn' + (k === '=' ? '.btn-primary' : ''), {
        type: 'button', style: { padding: '.7rem', fontSize: 'var(--step-1)' },
        onclick: () => press(k)
      }, k));
    }

    const fnRow = h('div.row.tight');
    for (const f of ['sqrt(', 'sin(', 'cos(', 'ln(', 'pi', '^']) {
      fnRow.appendChild(h('button.btn.btn-sm', { type: 'button', onclick: () => press(f) }, f.replace('(', '')));
    }
    fnRow.appendChild(h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => press('C') }, 'Clear'));

    const onKey = e => {
      if (e.target.matches('input, textarea')) return;
      if (/^[0-9.+\-*/()^%]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); press('='); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
      else if (e.key === 'Escape') { press('C'); }
    };
    addEventListener('keydown', onKey);

    mount(root,
      h('div.card', display, sub),
      fnRow,
      pad,
      histBox,
      h('p.small.dim', 'Type on your keyboard too. Enter evaluates, Escape clears.')
    );
    renderHistory();

    return () => removeEventListener('keydown', onKey);
  }
};
