import { h, mount } from '../core/dom.js';
import { chapter } from '../core/state.js';

const COLOURS = [
  ['Black', '#111111', 0, null, null],
  ['Brown', '#6b3f1d', 1, 1,   100],
  ['Red',   '#c2312a', 2, 2,   50],
  ['Orange','#d97316', 3, 3,   15],
  ['Yellow','#e0b820', 4, 4,   25],
  ['Green', '#2e9e6b', 5, 0.5, 20],
  ['Blue',  '#2f6f8c', 6, 0.25,10],
  ['Violet','#6b4fa8', 7, 0.1, 5],
  ['Grey',  '#8a8a8a', 8, 0.05,null],
  ['White', '#eeeeee', 9, null,null],
  ['Gold',  '#c8a44a', -1, 5,  null],
  ['Silver','#b8b8bd', -2, 10, null]
];

function fmtOhms(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' GΩ';
  if (v >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' MΩ';
  if (v >= 1e3) return (v / 1e3).toFixed(2).replace(/\.?0+$/, '') + ' kΩ';
  return (Math.round(v * 100) / 100) + ' Ω';
}

export default {
  id: 'resistor',
  name: 'Resistor calculator',
  dept: 'Electronics',
  icon: '▮',
  chapter: 2,
  blurb: 'Colour bands, four or five',

  mount(root) {
    let bands = 4;
    let pick = [1, 0, 2, 10];   /* brown black red gold = 1 kΩ ±5% */

    /* When the cabinet is the thing standing in the player's way, the tool
       shows the resistor they are looking for, in colour, above the controls.
       Nobody should have to hold four colour names in their head between one
       screen and the next. */
    const wanted = chapter() === 3;
    const TARGET = [['Red', '#c2312a'], ['Yellow', '#e0b820'], ['Brown', '#6b3f1d'], ['Gold', '#c8a44a']];
    const quest = h('div.quest', { hidden: !wanted });

    function paintQuest(value) {
      if (!wanted) return;
      const hit = Math.abs(value - 240) < 1;
      quest.dataset.hit = hit ? '1' : '0';
      mount(quest,
        h('span.quest-dot' + (hit ? '.hit' : '')),
        h('span', hit ? 'That is the cabinet resistor. Write the number on your list.' : 'Cabinet 4B. Match these:'),
        h('span.quest-bands', ...TARGET.map(([name, col]) =>
          h('span.quest-band', { style: { background: col }, title: name })))
      );
    }

    const body = h('div.resistor-body');
    const readout = h('div.readout.big', { style: { textAlign: 'center' } }, '');
    const selects = h('div.grid-3');

    function digitsFor(i) {
      if (bands === 4) return i < 2 ? 'digit' : i === 2 ? 'multiplier' : 'tolerance';
      return i < 3 ? 'digit' : i === 3 ? 'multiplier' : 'tolerance';
    }

    function compute() {
      const dCount = bands === 4 ? 2 : 3;
      let digits = 0;
      for (let i = 0; i < dCount; i++) digits = digits * 10 + Math.max(0, COLOURS[pick[i]][2]);
      const mult = Math.pow(10, COLOURS[pick[dCount]][2]);
      const tol = COLOURS[pick[dCount + 1]]?.[3];
      const value = digits * mult;
      readout.textContent = fmtOhms(value) + (tol ? '  ±' + tol + '%' : '');
      paintQuest(value);
      mount(body,
        h('span.wire'),
        ...pick.slice(0, bands).map((c, i) =>
          h('span.resistor-band', { style: { background: COLOURS[c][1] }, title: COLOURS[c][0] + ' · ' + digitsFor(i) })),
        h('span.wire')
      );
      return value;
    }

    function paintSelects() {
      const kids = [];
      for (let i = 0; i < bands; i++) {
        const role = digitsFor(i);
        const options = COLOURS.filter((c, idx) => {
          if (role === 'digit') return c[2] >= 0;
          if (role === 'multiplier') return true;
          return c[3] !== null;
        });
        const sel = h('select.select', {
          'aria-label': `Band ${i + 1}, ${role}`,
          onchange: e => { pick[i] = COLOURS.findIndex(c => c[0] === e.target.value); compute(); }
        }, ...options.map(c => h('option', { value: c[0], selected: COLOURS[pick[i]][0] === c[0] }, c[0])));
        kids.push(h('div.field', h('label', `Band ${i + 1}`), sel, h('span.hint', role)));
      }
      mount(selects, ...kids);
    }

    mount(root,
      quest,
      h('div.tabs', { role: 'tablist' },
        ...[4, 5].map(n => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': String(bands === n),
          onclick: e => {
            bands = n;
            pick = n === 4 ? [1, 0, 2, 10] : [1, 0, 0, 1, 1];
            root.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === e.target)));
            paintSelects(); compute();
          } }, n + ' bands'))
      ),
      h('div.card', body, h('div', { style: { marginTop: '1rem' } }, readout)),
      h('div.card', selects),
      h('p.small.dim', 'Hover a band to see what it means. Gold and silver are only valid as a multiplier or a tolerance.')
    );
    paintSelects();
    compute();
  }
};
