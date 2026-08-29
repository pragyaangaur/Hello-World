import { h, mount } from '../core/dom.js';
import { blip } from '../core/audio.js';

const ALGOS = {
  Bubble: function* (a) {
    for (let i = 0; i < a.length; i++) {
      let swapped = false;
      for (let j = 0; j < a.length - i - 1; j++) {
        yield { compare: [j, j + 1] };
        if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; swapped = true; yield { swap: [j, j + 1] }; }
      }
      yield { done: a.length - i - 1 };
      if (!swapped) break;
    }
  },
  Selection: function* (a) {
    for (let i = 0; i < a.length; i++) {
      let min = i;
      for (let j = i + 1; j < a.length; j++) { yield { compare: [min, j] }; if (a[j] < a[min]) min = j; }
      if (min !== i) { [a[i], a[min]] = [a[min], a[i]]; yield { swap: [i, min] }; }
      yield { done: i };
    }
  },
  Insertion: function* (a) {
    for (let i = 1; i < a.length; i++) {
      let j = i;
      while (j > 0) {
        yield { compare: [j - 1, j] };
        if (a[j - 1] <= a[j]) break;
        [a[j - 1], a[j]] = [a[j], a[j - 1]];
        yield { swap: [j - 1, j] };
        j--;
      }
    }
    for (let i = 0; i < a.length; i++) yield { done: i };
  },
  Quick: function* (a) {
    function* qs(lo, hi) {
      if (lo >= hi) { if (lo === hi) yield { done: lo }; return; }
      const pivot = a[hi];
      let i = lo;
      for (let j = lo; j < hi; j++) {
        yield { compare: [j, hi] };
        if (a[j] < pivot) { [a[i], a[j]] = [a[j], a[i]]; yield { swap: [i, j] }; i++; }
      }
      [a[i], a[hi]] = [a[hi], a[i]];
      yield { swap: [i, hi] };
      yield { done: i };
      yield* qs(lo, i - 1);
      yield* qs(i + 1, hi);
    }
    yield* qs(0, a.length - 1);
  }
};

export default {
  id: 'sorting',
  name: 'Sorting visualiser',
  dept: 'Computer Science',
  icon: '▁▄█',
  chapter: 3,
  blurb: 'Four algorithms, step by step',
  wide: true,

  mount(root) {
    let size = 44, speed = 18, algo = 'Bubble';
    let values = [], sorted = new Set(), active = [], gen = null, timer = null;
    let comparisons = 0, swaps = 0;

    const bars = h('div.bars');
    const stats = h('span.small.dim');

    function shuffle() {
      stop();
      values = Array.from({ length: size }, (_, i) => i + 1);
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      sorted = new Set(); active = []; comparisons = 0; swaps = 0; gen = null;
      paint();
    }

    function paint() {
      const max = Math.max(...values, 1);
      mount(bars, ...values.map((v, i) =>
        h('div.bar' + (sorted.has(i) ? '.sorted' : active.includes(i) ? '.active' : ''), {
          style: { height: (v / max) * 100 + '%' }, title: String(v)
        })));
      stats.textContent = `${comparisons} comparisons · ${swaps} swaps`;
    }

    function stepOnce() {
      if (!gen) gen = ALGOS[algo](values);
      const { value, done } = gen.next();
      if (done) { stop(); sorted = new Set(values.map((_, i) => i)); active = []; paint(); return false; }
      if (value.compare) { active = value.compare; comparisons++; }
      if (value.swap) { swaps++; blip(); }
      if (value.done !== undefined) sorted.add(value.done);
      paint();
      return true;
    }

    function run() {
      stop();
      timer = setInterval(() => { if (!stepOnce()) stop(); }, Math.max(4, 210 - speed * 10));
      paintBar();
    }
    function stop() { clearInterval(timer); timer = null; paintBar(); }

    const bar = h('div.row');
    function paintBar() {
      mount(bar,
        h('select.select', { style: { maxWidth: '9rem' }, 'aria-label': 'Algorithm',
          onchange: e => { algo = e.target.value; shuffle(); } },
          ...Object.keys(ALGOS).map(k => h('option', { value: k, selected: k === algo }, k))),
        h('button.btn.btn-primary', { type: 'button', onclick: () => (timer ? stop() : run()) }, timer ? 'Pause' : 'Sort'),
        h('button.btn', { type: 'button', onclick: () => { stop(); stepOnce(); } }, 'Step'),
        h('button.btn.btn-ghost', { type: 'button', onclick: shuffle }, 'Shuffle'),
        h('label.row.tight', { style: { gap: '.4rem' } }, h('span.small.lbl', 'Bars'),
          h('input', { type: 'range', min: '8', max: '110', value: String(size), style: { width: '6rem' }, 'aria-label': 'Number of bars',
            oninput: e => { size = +e.target.value; shuffle(); } })),
        h('label.row.tight', { style: { gap: '.4rem' } }, h('span.small.lbl', 'Speed'),
          h('input', { type: 'range', min: '1', max: '20', value: String(speed), style: { width: '6rem' }, 'aria-label': 'Speed',
            oninput: e => { speed = +e.target.value; if (timer) run(); } })),
        h('span.spacer'), stats
      );
    }

    mount(root, bar, h('div.card', bars),
      h('p.small.dim', 'Amber bars are the pair being compared. Green bars are in their final position.'));
    shuffle();
    return () => stop();
  }
};
