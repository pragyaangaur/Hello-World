import { h, mount, field, fmt } from '../core/dom.js';
import { liveNote } from '../story/live.js';

const SAMPLES = [
  ['Battery acid', 0.5], ['Lemon juice', 2.4], ['Vinegar', 2.9], ['Black coffee', 5.0],
  ['Milk', 6.6], ['Pure water', 7.0], ['Sea water', 8.1], ['Baking soda', 8.4],
  ['Ammonia', 11.6], ['Bleach', 12.6], ['Drain cleaner', 14.0]
];

function colourAt(ph) {
  const stops = [[0,'#c2312a'],[3,'#d97316'],[5,'#e0b820'],[7,'#2e9e6b'],[9,'#2f6f8c'],[11,'#3b4fa8'],[14,'#6b2f8c']];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
    if (ph >= p0 && ph <= p1) {
      const t = (ph - p0) / (p1 - p0);
      const mix = (a, b) => Math.round(parseInt(a, 16) + (parseInt(b, 16) - parseInt(a, 16)) * t).toString(16).padStart(2, '0');
      return '#' + mix(c0.slice(1,3), c1.slice(1,3)) + mix(c0.slice(3,5), c1.slice(3,5)) + mix(c0.slice(5,7), c1.slice(5,7));
    }
  }
  return stops[stops.length - 1][1];
}

export default {
  id: 'ph',
  name: 'pH and molarity',
  dept: 'Chemical',
  icon: '⚗',
  chapter: 2,
  blurb: 'Acids, bases, dilution',

  mount(root) {
    let ph = 7;
    const beaker = h('div', { style: { height: '5rem', borderRadius: 'var(--r-md)', border: '1px solid var(--rule-2)', transition: 'background 200ms' } });
    const out = h('dl.kv');
    const phLabel = h('span.small.mono');

    function recompute() {
      const H = Math.pow(10, -ph);
      const OH = Math.pow(10, -(14 - ph));
      beaker.style.background = colourAt(ph);
      phLabel.textContent = 'pH ' + ph.toFixed(2);
      mount(out,
        h('dt', 'pH'), h('dd', ph.toFixed(2)),
        h('dt', 'pOH'), h('dd', (14 - ph).toFixed(2)),
        h('dt', '[H⁺]'), h('dd', H.toExponential(3) + ' M'),
        h('dt', '[OH⁻]'), h('dd', OH.toExponential(3) + ' M'),
        h('dt', 'Character'), h('dd', ph < 6.5 ? 'acidic' : ph > 7.5 ? 'basic' : 'near neutral')
      );
    }

    const slider = h('input', { type: 'range', min: '0', max: '14', step: '0.01', value: '7', 'aria-label': 'pH',
      oninput: e => { ph = +e.target.value; recompute(); } });

    /* ---- molarity ---- */
    const mOut = h('dl.kv');
    let mass = 5.844, mw = 58.44, vol = 0.5;
    function molarity() {
      const mol = mass / mw;
      mount(mOut,
        h('dt', 'Moles'), h('dd', fmt(mol, 5) + ' mol'),
        h('dt', 'Molarity'), h('dd', fmt(mol / vol, 5) + ' M'),
        h('dt', 'In 1 litre'), h('dd', fmt(mol / vol, 5) + ' mol/L')
      );
    }
    function numField(label, value, set, step = 0.001) {
      return field(label, h('input.input.mono', { type: 'number', step: String(step), value: String(value), 'aria-label': label,
        oninput: e => { const v = +e.target.value; if (v > 0) { set(v); molarity(); } } }));
    }

    mount(root,
      h('div.card',
        beaker,
        h('div.row', { style: { marginTop: '.75rem' } }, h('span.lbl', 'pH'), phLabel),
        slider,
        h('div.row.tight', { style: { marginTop: '.5rem' } },
          ...SAMPLES.map(([name, v]) => h('button.btn.btn-sm', { type: 'button',
            onclick: () => { ph = v; slider.value = String(v); recompute(); } }, name)))
      ),
      h('div.card', out),
      h('div.card',
        h('div.card-head', { style: { border: 0, padding: 0, marginBottom: '.75rem' } }, 'Molarity'),
        h('div.grid-2',
          numField('Mass (g)', mass, v => mass = v),
          numField('Molar mass (g/mol)', mw, v => mw = v, 0.01),
          numField('Volume (L)', vol, v => vol = v, 0.01)
        ),
        h('div', { style: { marginTop: '.75rem' } }, mOut)
      ),
      h('p.small.dim', 'The defaults are 5.844 g of sodium chloride in half a litre, which comes out at 0.2 molar.'),
      liveNote('probe 1 \u2192 ph.cell')
    );
    recompute(); molarity();
  }
};
