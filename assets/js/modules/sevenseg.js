import { h, mount, pad2 } from '../core/dom.js';
import { liveNote } from '../story/live.js';
import { chapter } from '../core/state.js';

const SEGS = {
  '0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg','5':'acdfg',
  '6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg','-':'g',' ':''
};

function digit(char) {
  const on = SEGS[char] || '';
  return h('span.seg', ...'abcdefg'.split('').map(s => h('span', { class: s + (on.includes(s) ? ' on' : '') })));
}

export default {
  id: 'sevenseg',
  name: 'Seven segment clock',
  dept: 'Electronics',
  icon: '⧗',
  chapter: 1,
  blurb: 'Digits made of bars',

  mount(root) {
    let mode = 'clock';
    let manual = '1234';
    const display = h('div.seg-display');
    let timer = null;

    function show(text) {
      const chars = text.split('');
      const kids = [];
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ':') kids.push(h('span.seg-colon', h('i'), h('i')));
        else kids.push(digit(chars[i]));
      }
      mount(display, ...kids);
    }

    function tick() {
      if (mode !== 'clock') return;
      const d = new Date();
      show(`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`);
    }

    const input = h('input.input.mono', { value: manual, maxlength: '8', 'aria-label': 'Digits to display', style: { maxWidth: '8rem' } });
    input.oninput = () => { manual = input.value.replace(/[^0-9\-: ]/g, ''); if (mode === 'manual') show(manual); };

    const tabs = h('div.tabs', { role: 'tablist' },
      ...[['clock', 'Clock'], ['manual', 'Manual']].map(([k, l]) =>
        h('button.tab', { type: 'button', role: 'tab', 'aria-selected': String(mode === k),
          onclick: e => {
            mode = k;
            root.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t === e.target)));
            mode === 'clock' ? tick() : show(manual);
          } }, l))
    );

    mount(root,
      tabs,
      h('div.card', display,
        h('div.row', { style: { marginTop: '1rem', justifyContent: 'center' } },
          h('span.small.lbl', 'Digits'), input),
        liveNote('gpio 22-28 → panel display')
      ),
      chapter() >= 3
        ? h('p.small.dim', 'The panel on bench 4B shows the same digits. Nobody is in the room to read them.')
        : null
    );
    tick();
    timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }
};
