import { h, mount, field, debounce } from '../core/dom.js';

/* Units are stored as a factor to a base unit, except temperature which
   needs real functions, so it gets its own branch. */
const SETS = {
  Length:      { base: 'm',  units: { Millimetre: 0.001, Centimetre: 0.01, Metre: 1, Kilometre: 1000, Inch: 0.0254, Foot: 0.3048, Yard: 0.9144, Mile: 1609.344, 'Nautical mile': 1852 } },
  Mass:        { base: 'kg', units: { Milligram: 1e-6, Gram: 0.001, Kilogram: 1, Tonne: 1000, Ounce: 0.028349523125, Pound: 0.45359237, Stone: 6.35029318 } },
  Volume:      { base: 'L',  units: { Millilitre: 0.001, Litre: 1, 'Cubic metre': 1000, 'Pint (UK)': 0.56826125, 'Gallon (UK)': 4.54609, 'Gallon (US)': 3.785411784, Cup: 0.24 } },
  Area:        { base: 'm²', units: { 'Square metre': 1, 'Square kilometre': 1e6, Hectare: 10000, 'Square foot': 0.09290304, Acre: 4046.8564224 } },
  Speed:       { base: 'm/s',units: { 'Metre/second': 1, 'Kilometre/hour': 0.2777778, 'Mile/hour': 0.44704, Knot: 0.5144444, 'Foot/second': 0.3048 } },
  Time:        { base: 's',  units: { Millisecond: 0.001, Second: 1, Minute: 60, Hour: 3600, Day: 86400, Week: 604800 } },
  Energy:      { base: 'J',  units: { Joule: 1, Kilojoule: 1000, Calorie: 4.184, Kilocalorie: 4184, 'Watt hour': 3600, 'Kilowatt hour': 3.6e6, 'Electronvolt': 1.602176634e-19 } },
  Pressure:    { base: 'Pa', units: { Pascal: 1, Kilopascal: 1000, Bar: 100000, Atmosphere: 101325, PSI: 6894.757293, Torr: 133.322368 } },
  Data:        { base: 'B',  units: { Byte: 1, Kilobyte: 1024, Megabyte: 1048576, Gigabyte: 1073741824, Terabyte: 1099511627776, Bit: 0.125 } },
  Angle:       { base: 'rad',units: { Radian: 1, Degree: Math.PI / 180, Gradian: Math.PI / 200, Turn: Math.PI * 2 } }
};

const TEMP = {
  Celsius:    { to: c => c, from: c => c },
  Fahrenheit: { to: f => (f - 32) * 5 / 9, from: c => c * 9 / 5 + 32 },
  Kelvin:     { to: k => k - 273.15, from: c => c + 273.15 },
  Rankine:    { to: r => (r - 491.67) * 5 / 9, from: c => (c + 273.15) * 9 / 5 }
};

export default {
  id: 'converter',
  name: 'Unit converter',
  dept: 'Everyday',
  icon: '⇄',
  chapter: 1,
  blurb: 'Eleven kinds of unit',

  mount(root) {
    let cat = 'Length';
    let from = 'Metre', to = 'Foot';

    const inA = h('input.input.mono', { type: 'number', step: 'any', value: '1', 'aria-label': 'Value to convert' });
    const outA = h('input.input.mono', { type: 'text', readonly: true, 'aria-label': 'Converted value' });
    const selFrom = h('select.select', { 'aria-label': 'Convert from' });
    const selTo = h('select.select', { 'aria-label': 'Convert to' });
    const note = h('p.small.dim');

    function unitNames() { return cat === 'Temperature' ? Object.keys(TEMP) : Object.keys(SETS[cat].units); }

    function fillSelects() {
      const names = unitNames();
      if (!names.includes(from)) from = names[0];
      if (!names.includes(to)) to = names[1] || names[0];
      for (const [sel, cur] of [[selFrom, from], [selTo, to]]) {
        mount(sel, ...names.map(n => h('option', { value: n, selected: n === cur }, n)));
      }
    }

    function convert() {
      const v = parseFloat(inA.value);
      if (!Number.isFinite(v)) { outA.value = ''; note.textContent = ''; return; }
      let result;
      if (cat === 'Temperature') result = TEMP[to].from(TEMP[from].to(v));
      else result = v * SETS[cat].units[from] / SETS[cat].units[to];
      const abs = Math.abs(result);
      outA.value = abs !== 0 && (abs < 1e-4 || abs >= 1e12)
        ? result.toExponential(6)
        : String(Math.round(result * 1e9) / 1e9);
      if (cat === 'Temperature') note.textContent = `Converting ${from} to ${to}.`;
      else note.textContent = `1 ${from} = ${trimNum(SETS[cat].units[from] / SETS[cat].units[to])} ${to}`;
    }
    const trimNum = n => String(Math.round(n * 1e9) / 1e9);

    selFrom.onchange = e => { from = e.target.value; convert(); };
    selTo.onchange = e => { to = e.target.value; convert(); };
    inA.oninput = debounce(convert, 60);

    const tabs = h('div.tabs', { role: 'tablist' });
    const cats = [...Object.keys(SETS), 'Temperature'];
    const paint = () => {
      mount(tabs, ...cats.map(c => h('button.tab', {
        type: 'button', role: 'tab', 'aria-selected': String(c === cat),
        onclick: () => { cat = c; fillSelects(); paint(); convert(); }
      }, c)));
    };
    paint();

    mount(root,
      tabs,
      h('div.card',
        h('div.grid-2',
          field('From', h('div.stack', { style: { gap: '.4rem' } }, inA, selFrom)),
          field('To', h('div.stack', { style: { gap: '.4rem' } }, outA, selTo))
        ),
        h('div.row', { style: { marginTop: '1rem' } },
          h('button.btn.btn-sm', { type: 'button', onclick: () => {
            const t = from; from = to; to = t;
            fillSelects(); inA.value = outA.value || inA.value; convert();
          } }, '⇅ Swap'),
          note
        )
      )
    );
    fillSelects();
    convert();
  }
};
