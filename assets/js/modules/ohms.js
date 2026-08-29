import { h, mount, field, fmt } from '../core/dom.js';
import { liveNote } from '../story/live.js';

export default {
  id: 'ohms',
  name: "Ohm's law",
  dept: 'Electrical',
  icon: 'Ω',
  chapter: 1,
  blurb: 'Volts, amps, ohms, watts',

  mount(root) {
    const vals = { V: 12, I: null, R: 470, P: null };
    const inputs = {};
    const note = h('p.small.dim');
    const out = h('dl.kv');

    function solve() {
      let { V, I, R, P } = vals;
      const known = ['V', 'I', 'R', 'P'].filter(k => vals[k] !== null && vals[k] !== '' && Number.isFinite(+vals[k]));
      if (known.length < 2) { note.textContent = 'Enter any two values and the other two are worked out.'; mount(out); return; }
      V = vals.V !== null ? +vals.V : null;
      I = vals.I !== null ? +vals.I : null;
      R = vals.R !== null ? +vals.R : null;
      P = vals.P !== null ? +vals.P : null;

      if (V !== null && I !== null) { R = V / I; P = V * I; }
      else if (V !== null && R !== null) { I = V / R; P = V * I; }
      else if (V !== null && P !== null) { I = P / V; R = V / I; }
      else if (I !== null && R !== null) { V = I * R; P = V * I; }
      else if (I !== null && P !== null) { V = P / I; R = V / I; }
      else if (R !== null && P !== null) { I = Math.sqrt(P / R); V = I * R; }

      mount(out,
        h('dt', 'Voltage'), h('dd', fmt(V, 4) + ' V'),
        h('dt', 'Current'), h('dd', (Math.abs(I) < 0.1 ? fmt(I * 1000, 3) + ' mA' : fmt(I, 4) + ' A')),
        h('dt', 'Resistance'), h('dd', fmt(R, 3) + ' Ω'),
        h('dt', 'Power'), h('dd', (Math.abs(P) < 1 ? fmt(P * 1000, 3) + ' mW' : fmt(P, 4) + ' W'))
      );
      note.textContent = P > 0.25
        ? `At ${fmt(P, 3)} W a quarter-watt resistor would cook. Use at least ${P < 0.5 ? 'half' : P < 1 ? 'one' : Math.ceil(P)} watt.`
        : 'Within the rating of an ordinary quarter-watt resistor.';
      note.style.color = P > 0.25 ? 'var(--warn)' : 'var(--ink-3)';
    }

    const grid = h('div.grid-2');
    for (const [key, label, unit] of [['V', 'Voltage', 'volts'], ['I', 'Current', 'amps'], ['R', 'Resistance', 'ohms'], ['P', 'Power', 'watts']]) {
      const input = h('input.input.mono', {
        type: 'number', step: 'any', placeholder: '—',
        value: vals[key] === null ? '' : String(vals[key]),
        'aria-label': label,
        oninput: e => { vals[key] = e.target.value === '' ? null : e.target.value; solve(); }
      });
      inputs[key] = input;
      grid.appendChild(field(label + ' (' + unit + ')', input));
    }

    mount(root,
      h('div.card', grid,
        h('div.row', { style: { marginTop: '1rem' } },
          h('button.btn.btn-sm', { type: 'button', onclick: () => {
            for (const k of Object.keys(vals)) { vals[k] = null; inputs[k].value = ''; }
            solve();
          } }, 'Clear'),
          h('button.btn.btn-sm', { type: 'button', onclick: () => {
            vals.V = 230; vals.R = 47; vals.I = null; vals.P = null;
            inputs.V.value = '230'; inputs.R.value = '47'; inputs.I.value = ''; inputs.P.value = '';
            solve();
          } }, 'Bench supply')
        )
      ),
      h('div.card', out, note),
      liveNote('psu 1 → 4B bench supply')
    );
    solve();
  }
};
