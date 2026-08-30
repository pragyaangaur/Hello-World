import { h, mount } from '../core/dom.js';
import { blip } from '../core/audio.js';
import { emit } from '../core/bus.js';
import { chapter } from '../core/state.js';

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

/* Pips, laid out the way they are on a real die. */
const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};

function face(n) {
  const on = PIPS[n] || [];
  return h('span.die', { 'aria-label': String(n) },
    ...Array.from({ length: 9 }, (_, i) => h('span.pip' + (on.includes(i) ? '.on' : ''))));
}

export default {
  id: 'dice',
  name: 'Dice roller',
  dept: 'Everyday',
  icon: '⚄',
  chapter: 1,
  blurb: 'Roll anything, see the spread',

  mount(root) {
    /* The rota is picked with one six sided die, so when the bench is waiting
       on a roll the tool opens on a d6 rather than on the 2d6 it normally
       defaults to. Rolling a pair and getting a total of five is not the same
       event, and a player should never have to work that out. */
    const wantsD6 = chapter() === 4;
    let notation = wantsD6 ? 'd6' : '2d6';
    let opening = true;
    const tally = new Map();

    const input = h('input.input.mono', { value: notation, 'aria-label': 'Dice notation', style: { maxWidth: '9rem' } });
    const faces = h('div.dice-faces');
    const result = h('div.readout.big', { style: { textAlign: 'center' } }, '—');
    const detail = h('div.small.dim', { style: { textAlign: 'center', minHeight: '1.3em' } });
    const chart = h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '2px', height: '7rem', marginTop: '.5rem' } });
    const summary = h('p.small.dim');
    const quest = h('div.quest', { hidden: !wantsD6 });

    function paintQuest(rolls) {
      if (!wantsD6) return;
      const hit = rolls && rolls.includes(5);
      mount(quest,
        h('span.quest-dot' + (hit ? '.hit' : '')),
        h('span', hit ? 'Five. That is the rota.' : 'The rota needs a five. Keep rolling.'));
      quest.dataset.hit = hit ? '1' : '0';
    }

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
      if (!spec) { result.textContent = '?'; detail.textContent = 'Try something like 2d6+3.'; mount(faces); return; }
      const r = roll(spec);
      blip();
      result.textContent = String(r.total);
      detail.textContent = spec.count > 1 || r.mod
        ? `${r.rolls.join(' + ')}${r.mod ? (r.mod > 0 ? ' + ' + r.mod : ' − ' + Math.abs(r.mod)) : ''}`
        : '';

      /* Six sided dice get drawn. Everything else is a number, because a
         twenty sided die rendered as pips is nobody's idea of a good time. */
      mount(faces, ...(spec.sides === 6 && spec.count <= 12 ? r.rolls.map(face) : []));
      faces.classList.remove('rolled');
      void faces.offsetWidth;
      faces.classList.add('rolled');

      tally.set(r.total, (tally.get(r.total) || 0) + 1);
      drawChart();
      paintQuest(opening ? null : r.rolls);

      /* Anything watching this tool hears the total of a single die and every
         individual face that came up. Rolling 2d6 and getting a five on one of
         them counts, which is what a person at a table would say too. */
      if (opening) return;
      if (spec.count === 1 && !spec.mod) emit('tool:value', { tool: 'dice', value: r.total });
      for (const value of r.rolls) emit('tool:value', { tool: 'dice', value });
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') doRoll(); });

    const presets = h('div.row.tight',
      ...['d4', 'd6', 'd8', 'd10', 'd12', 'd20', '2d6', '3d6'].map(p =>
        h('button.btn.btn-sm', { type: 'button', onclick: () => { input.value = p; tally.clear(); doRoll(); } }, p))
    );

    mount(root,
      quest,
      h('div.card',
        faces, result, detail,
        h('div.row', { style: { marginTop: '.75rem', justifyContent: 'center' } },
          input,
          h('button.btn.btn-primary', { type: 'button', onclick: doRoll }, 'Roll'),
          h('button.btn.btn-ghost', { type: 'button', onclick: () => { tally.clear(); drawChart(); } }, 'Reset')
        )
      ),
      presets,
      h('div.card', h('div.card-head', { style: { border: 0, padding: 0, marginBottom: '.5rem' } }, 'Distribution'), chart, summary)
    );
    paintQuest(null);
    /* The roll the tool does on the way in is scenery. Only a roll the player
       asked for is allowed to count for anything. */
    doRoll();
    opening = false;
  }
};
