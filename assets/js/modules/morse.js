import { h, mount } from '../core/dom.js';
import { tone } from '../core/audio.js';

const MORSE = {
  a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',
  k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',
  u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-',
  '5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-',',':'--..--','?':'..--..','/':'-..-.','-':'-....-','@':'.--.-.'
};
const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function encode(text) {
  return text.toLowerCase().split('').map(c => {
    if (c === ' ') return '/';
    return MORSE[c] || '';
  }).filter(Boolean).join(' ');
}

export function decode(code) {
  return code.trim().split(/\s+/).map(t => (t === '/' ? ' ' : REVERSE[t] || '')).join('');
}

export default {
  id: 'morse',
  name: 'Morse translator',
  dept: 'Electronics',
  icon: '·–',
  chapter: 2,
  blurb: 'Both directions, with sound',

  mount(root) {
    const plain = h('textarea.textarea', { placeholder: 'Plain text', 'aria-label': 'Plain text', style: { minHeight: '7rem' } });
    const code = h('textarea.textarea.mono', { placeholder: '.... ..', 'aria-label': 'Morse code', style: { minHeight: '7rem' } });
    let guard = false;

    plain.addEventListener('input', () => { if (guard) return; guard = true; code.value = encode(plain.value); guard = false; });
    code.addEventListener('input', () => { if (guard) return; guard = true; plain.value = decode(code.value); guard = false; });

    let playing = false;
    async function play() {
      if (playing) return;
      playing = true;
      const unit = 90;
      for (const ch of code.value) {
        if (!playing) break;
        if (ch === '.') { tone(700, unit / 1000, 'square', .6); await wait(unit * 2); }
        else if (ch === '-') { tone(700, (unit * 3) / 1000, 'square', .6); await wait(unit * 4); }
        else if (ch === '/') await wait(unit * 5);
        else await wait(unit * 2);
      }
      playing = false;
    }
    const wait = ms => new Promise(r => setTimeout(r, ms));

    const table = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(4.5rem,1fr))', gap: '.35rem' } },
      ...Object.entries(MORSE).slice(0, 36).map(([k, v]) =>
        h('div.small', { style: { display: 'flex', gap: '.4rem' } },
          h('b', { style: { width: '1rem' } }, k.toUpperCase()), h('span.mono.dim', v)))
    );

    mount(root,
      h('div.grid-2',
        h('div.field', h('label', 'Text'), plain),
        h('div.field', h('label', 'Morse'), code)
      ),
      h('div.row',
        h('button.btn.btn-primary', { type: 'button', onclick: play }, 'Play'),
        h('button.btn', { type: 'button', onclick: () => { playing = false; } }, 'Stop'),
        h('span.small.dim', 'Turn sound on in Settings to hear it.')
      ),
      h('div.card', h('div.card-head', { style: { border: 0, padding: 0, marginBottom: '.75rem' } }, 'Reference'), table)
    );
    plain.value = 'hello world';
    plain.dispatchEvent(new Event('input'));
    return () => { playing = false; };
  }
};
