import { h, mount } from '../core/dom.js';
import { blip } from '../core/audio.js';
import { emit } from '../core/bus.js';

/* Standard dice notation: 2d6+3, 4d10, d20-1. */
export function parseNotation(src) {
  const m = String(src).trim().toLowerCase().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides, mod };
}

export function roll({ count, sides, mod }) {
  const rolls = [];
  const buf = new Uint32Array(count);
  crypto.getRandomValues(buf);
  for (let i = 0; i < count; i++) rolls.push((buf[i] % sides) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + mod, mod };
}

export default {
  id: 'dice',
  name: 'Dice roller',
  dept: 'Everyday',
  icon: '⚄',
  chapter: 1,
  blurb: 'Dice notation and a histogram',

  mount(root) {
    let notation = '2d6';
    const tally = new Map();

    const input = h('input.input.mono', { value: notation, 'aria-label': 'Dice notation', style: { maxWidth: '9rem' } });
    const result = h('div.readout.big', { style: { textAlign: 'center' } }, '—');
    const detail = h('div.small.dim', { style: { textAlign: 'center', minHeight: '1.3em' } });
    const chart = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '2px', height: '7rem', marginTop: '.5rem' } });
    const summary = h('p.small.dim');

    function drawChart() {
      const keys = [...tally.keys()].sort((a, b) => a - b);
      if (!keys.length) { mount(chart); summary.textContent = ''; return; }
      const max = Math.max(...tally.values());
      const total = [...tally.values()].reduce((a, b) => a + b, 0);
      mount(chart, ...keys.map(k => h('div', {
        title: `${k}: ${tally.get(k)} of ${total}`,
        style: {
          flex: '1', minWidth: '3px',
          height: Math.max(2, (tally.get(k) / max) * 100) + '%',
          background: 'var(--accent)', borderRadius: '2px 2px 0 0', opacity: '.85'
        }
      })));
      const mean = keys.reduce((a, k) => a + k * tally.get(k), 0) / total;
      summary.textContent = `${total} rolls · lowest ${keys[0]} · highest ${keys[keys.length - 1]} · mean ${mean.toFixed(2)}`;
    }

    function doRoll() {
      const spec = parseNotation(input.value);
      if (!spec) { result.textContent = '?'; detail.textContent = 'Try something like 2d6+3.'; return; }
      const r = roll(spec);
      blip();
      result.textContent = String(r.total);
      detail.textContent = spec.count > 1 || r.mod
        ? `${r.rolls.join(' + ')}${r.mod ? (r.mod > 0 ? ' + ' + r.mod : ' − ' + Math.abs(r.mod)) : ''}`
        : '';
      tally.set(r.total, (tally.get(r.total) || 0) + 1);
      drawChart();
      /* A single die is the only roll anything outside this tool cares about. */
      if (spec.count === 1 && !spec.mod) emit('tool:value', { tool: 'dice', value: r.total });
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') doRoll(); });

    const presets = h('div.row.tight',
      ...['d4', 'd6', 'd8', 'd10', 'd12', 'd20', '2d6', '3d6'].map(p =>
        h('button.btn.btn-sm', { type: 'button', onclick: () => { input.value = p; tally.clear(); doRoll(); } }, p))
    );

    mount(root,
      h('div.card',
        result, detail,
        h('div.row', { style: { marginTop: '.75rem', justifyContent: 'center' } },
          input,
          h('button.btn.btn-primary', { type: 'button', onclick: doRoll }, 'Roll'),
          h('button.btn.btn-ghost', { type: 'button', onclick: () => { tally.clear(); drawChart(); } }, 'Reset')
        )
      ),
      presets,
      h('div.card', h('div.card-head', { style: { border: 0, padding: 0, marginBottom: '.5rem' } }, 'Distribution'), chart, summary)
    );
    doRoll();
  }
};
