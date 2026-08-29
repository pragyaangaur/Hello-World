import { h, mount } from '../core/dom.js';
import { tone } from '../core/audio.js';

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK_AFTER = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 };
const KEYMAP = 'awsedftgyhujkolp;'.split('');

function freqOf(semitoneFromA4) { return 440 * Math.pow(2, semitoneFromA4 / 12); }

export default {
  id: 'piano',
  name: 'Piano',
  dept: 'Electrical',
  icon: '♪',
  chapter: 2,
  blurb: 'Two octaves, Web Audio',
  wide: true,

  mount(root) {
    let octave = 4;
    let wave = 'triangle';
    const held = new Set();
    const keys = h('div.keys');
    const label = h('span.small.dim');

    function play(semi) {
      const midi = (octave + 1) * 12 + semi;
      tone(freqOf(midi - 69), 0.55, wave, 0.8);
      label.textContent = `${NOTES[semi % 12]}${octave + Math.floor(semi / 12)} · ${freqOf(midi - 69).toFixed(1)} Hz`;
    }

    function build() {
      mount(keys);
      const whites = [];
      for (let oct = 0; oct < 2; oct++) for (const w of WHITE) whites.push(oct * 12 + w);
      whites.forEach((semi, i) => {
        const k = h('div.key-w', { 'data-semi': String(semi), role: 'button', 'aria-label': 'Key ' + NOTES[semi % 12] });
        k.addEventListener('pointerdown', () => { k.classList.add('down'); play(semi); });
        k.addEventListener('pointerup', () => k.classList.remove('down'));
        k.addEventListener('pointerleave', () => k.classList.remove('down'));
        keys.appendChild(k);
      });
      const total = whites.length;
      let idx = 0;
      for (let oct = 0; oct < 2; oct++) {
        for (let wi = 0; wi < WHITE.length; wi++) {
          if (BLACK_AFTER[wi] !== undefined) {
            const semi = oct * 12 + BLACK_AFTER[wi];
            const pos = ((oct * WHITE.length + wi + 1) / total) * 100;
            const b = h('div.key-b', { style: { left: `calc(${pos}% - 2%)` }, role: 'button', 'aria-label': 'Key ' + NOTES[semi % 12] });
            b.addEventListener('pointerdown', () => { b.classList.add('down'); play(semi); });
            b.addEventListener('pointerup', () => b.classList.remove('down'));
            b.addEventListener('pointerleave', () => b.classList.remove('down'));
            keys.appendChild(b);
          }
        }
      }
    }

    const onKey = e => {
      if (e.repeat || e.target.matches('input, textarea')) return;
      const i = KEYMAP.indexOf(e.key.toLowerCase());
      if (i >= 0) { held.add(e.key); play(i); }
      if (e.key === 'z') { octave = Math.max(1, octave - 1); paint(); }
      if (e.key === 'x') { octave = Math.min(6, octave + 1); paint(); }
    };
    addEventListener('keydown', onKey);

    const bar = h('div.row');
    function paint() {
      mount(bar,
        h('span.small.lbl', 'Octave'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => { octave = Math.max(1, octave - 1); paint(); } }, '−'),
        h('span.mono', String(octave)),
        h('button.btn.btn-sm', { type: 'button', onclick: () => { octave = Math.min(6, octave + 1); paint(); } }, '+'),
        h('span.small.lbl', { style: { marginLeft: '1rem' } }, 'Tone'),
        h('select.select', { style: { maxWidth: '9rem' }, 'aria-label': 'Tone',
          onchange: e => { wave = e.target.value; } },
          ...['triangle', 'sine', 'square', 'sawtooth'].map(w => h('option', { value: w, selected: w === wave }, w))),
        h('span.spacer'), label
      );
    }

    mount(root, bar, keys,
      h('p.small.dim', 'Play with the mouse, or use the home row: a w s e d f t g y h u j. Z and X change octave. Sound has to be on in Settings.'));
    build(); paint();

    return () => removeEventListener('keydown', onKey);
  }
};
