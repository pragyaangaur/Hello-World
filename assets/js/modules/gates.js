import { h, mount } from '../core/dom.js';

const GATES = {
  AND:  (a, b) => a && b,
  OR:   (a, b) => a || b,
  NAND: (a, b) => !(a && b),
  NOR:  (a, b) => !(a || b),
  XOR:  (a, b) => a !== b,
  XNOR: (a, b) => a === b,
  NOT:  a => !a
};

export default {
  id: 'gates',
  name: 'Logic gates',
  dept: 'Electronics',
  icon: '⊕',
  chapter: 2,
  blurb: 'Truth tables you can poke',

  mount(root) {
    const state = { A: false, B: false };
    const rows = h('div');

    function pin(label, value, onclick) {
      return h('button.pin' + (value ? '.hi' : '') + (onclick ? '' : '.out'), {
        type: 'button', onclick: onclick || undefined,
        disabled: !onclick,
        'aria-label': label + ' is ' + (value ? 'high' : 'low')
      }, value ? '1' : '0');
    }

    function paint() {
      mount(rows, ...Object.entries(GATES).map(([name, fn]) => {
        const out = name === 'NOT' ? fn(state.A) : fn(state.A, state.B);
        return h('div.gate-row',
          h('b', { style: { width: '3.5rem', fontFamily: 'var(--font-mono)' } }, name),
          pin('A', state.A, () => { state.A = !state.A; paint(); }),
          name === 'NOT' ? h('span.small.dim', { style: { width: '1.9rem', textAlign: 'center' } }, '—') : pin('B', state.B, () => { state.B = !state.B; paint(); }),
          h('span.small.dim', '→'),
          pin('out', out, null),
          h('span.spacer'),
          h('span.small.dim.mono', truth(name, fn))
        );
      }));
    }

    function truth(name, fn) {
      if (name === 'NOT') return [false, true].map(a => (fn(a) ? 1 : 0)).join('');
      return [[0,0],[0,1],[1,0],[1,1]].map(([a, b]) => (fn(Boolean(a), Boolean(b)) ? 1 : 0)).join('');
    }

    const saved = h('div.card', { style: { borderColor: 'var(--warn)' } },
      h('div.card-head', { style: { border: 0, padding: 0, marginBottom: '.5rem' } }, 'Saved circuit: bench interlock'),
      h('p.small', { style: { marginBottom: '.5rem' } },
        'A two-input AND between the door sensor and the supply enable. It was meant to cut the bench when the door is shut and nobody is inside.'),
      h('p.small.mono.dim', { style: { marginBottom: 0 } }, 'door=1  enable=1  →  out=1   (supply stays on)')
    );

    mount(root,
      h('div.card', h('p.small.dim', 'Click a pin to flip it. The number on the right is the gate’s full truth table.'), rows),
      saved
    );
    paint();
  }
};
