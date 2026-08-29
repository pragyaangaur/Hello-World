import { h, mount, field, fmt } from '../core/dom.js';

const BANDS = [
  [0,    18.5, 'Underweight', 'var(--info)'],
  [18.5, 25,   'Healthy range', 'var(--ok)'],
  [25,   30,   'Overweight', 'var(--warn)'],
  [30,   99,   'Obese', 'var(--danger)']
];

export default {
  id: 'bmi',
  name: 'BMI calculator',
  dept: 'Biomedical',
  icon: '⚕',
  chapter: 2,
  blurb: 'Height, mass, and a caveat',

  mount(root) {
    let kg = 70, cm = 172;
    const out = h('dl.kv');
    const bar = h('div', { style: { position: 'relative', height: '.8rem', borderRadius: 'var(--r-pill)', overflow: 'hidden', display: 'flex' } });
    const marker = h('div', { style: { position: 'absolute', top: '-3px', width: '3px', height: 'calc(100% + 6px)', background: 'var(--ink)', borderRadius: '2px' } });

    for (const [lo, hi, , colour] of BANDS) {
      bar.appendChild(h('div', { style: { flex: String(Math.min(hi, 40) - lo), background: colour, opacity: '.45' } }));
    }
    bar.appendChild(marker);

    function recompute() {
      const m = cm / 100;
      const bmi = kg / (m * m);
      const band = BANDS.find(b => bmi >= b[0] && bmi < b[1]) || BANDS[BANDS.length - 1];
      marker.style.left = Math.min(99, Math.max(0, ((bmi - 0) / 40) * 100)) + '%';
      const healthyLow = 18.5 * m * m, healthyHigh = 25 * m * m;
      mount(out,
        h('dt', 'BMI'), h('dd', fmt(bmi, 1)),
        h('dt', 'Category'), h('dd', { style: { color: band[3], fontFamily: 'inherit' } }, band[2]),
        h('dt', 'Healthy mass range'), h('dd', fmt(healthyLow, 1) + ' to ' + fmt(healthyHigh, 1) + ' kg'),
        h('dt', 'Body surface area'), h('dd', fmt(Math.sqrt((cm * kg) / 3600), 3) + ' m²')
      );
    }

    function slider(label, min, max, value, unit, set) {
      const val = h('span.small.mono', value + ' ' + unit);
      return h('div.field',
        h('div.row', h('label', label), h('span.spacer'), val),
        h('input', { type: 'range', min: String(min), max: String(max), value: String(value), 'aria-label': label,
          oninput: e => { set(+e.target.value); val.textContent = e.target.value + ' ' + unit; recompute(); } }));
    }

    mount(root,
      h('div.card',
        slider('Mass', 30, 200, kg, 'kg', v => kg = v),
        slider('Height', 120, 220, cm, 'cm', v => cm = v),
        h('div', { style: { marginTop: '1rem' } }, bar),
        h('div.row.small.dim', { style: { marginTop: '.35rem' } },
          h('span', '0'), h('span.spacer'), h('span', '18.5'), h('span.spacer'), h('span', '25'), h('span.spacer'), h('span', '30'), h('span.spacer'), h('span', '40'))
      ),
      h('div.card', out),
      h('p.small.dim', 'BMI is a population statistic. It knows nothing about muscle, bone density, or age, so it is a rough screen and not a diagnosis.')
    );
    recompute();
  }
};
