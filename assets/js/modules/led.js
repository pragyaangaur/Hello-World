import { h, mount } from '../core/dom.js';
import { liveNote, lastUsed } from '../story/live.js';
import { chapter, get } from '../core/state.js';
import { tone } from '../core/audio.js';

const MORSE = {
  a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',
  k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',
  u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..'
};

function toMorse(word) {
  return word.toLowerCase().split('').filter(c => MORSE[c]).map(c => MORSE[c]).join(' / ');
}

export default {
  id: 'led',
  name: 'LED indicator',
  dept: 'Electronics',
  icon: '◉',
  chapter: 2,
  blurb: 'Blink an LED, on a pattern',

  mount(root) {
    const solved = Boolean(get().challenges.blink);
    const ch = chapter();
    const word = ch >= 3 ? 'help' : 'sos';
    let pattern = solved || ch >= 3 ? toMorse(word) : '';
    let seq = [], step = 0, timer = null, running = false;
    let unit = 220;

    const bulb = h('span.led-bulb');
    const patternOut = h('div.readout.mono', { style: { fontSize: 'var(--step-1)' } }, pattern || '(nothing)');
    const status = h('div.small.dim');

    function build() {
      seq = [];
      for (const token of pattern.split('')) {
        if (token === '.') { seq.push([true, 1], [false, 1]); }
        else if (token === '-') { seq.push([true, 3], [false, 1]); }
        else if (token === ' ') { seq.push([false, 1]); }
        else if (token === '/') { seq.push([false, 3]); }
      }
      if (!seq.length) seq = [[false, 4]];
      seq.push([false, 7]);
    }

    function tick() {
      if (!running) return;
      const [on, len] = seq[step % seq.length];
      bulb.classList.toggle('on', on);
      if (on) tone(620, (unit * len) / 1000 * 0.9, 'square', 0.35);
      step++;
      timer = setTimeout(tick, unit * len);
    }

    function start() {
      if (running) return;
      build(); running = true; step = 0; tick();
      paint();
    }
    function stop() {
      running = false; clearTimeout(timer); bulb.classList.remove('on');
      paint();
    }

    const controls = h('div.row');
    function paint() {
      mount(controls,
        h('button.btn.btn-primary', { type: 'button', onclick: () => (running ? stop() : start()) }, running ? 'Stop' : 'Blink'),
        h('label.row.tight', { style: { gap: '.4rem' } },
          h('span.small.lbl', 'Unit'),
          h('input', { type: 'range', min: '80', max: '450', value: String(unit), style: { width: '7rem' },
            oninput: e => { unit = +e.target.value; } }),
          h('span.small.mono', unit + ' ms')
        )
      );
      status.textContent = usable
        ? `${pattern.replace(/[^.-]/g, '').length} symbols · ${running ? 'blinking' : 'stopped'}`
        : 'blinkPattern returns an empty string, so whatever you type comes out as nothing.';
    }

    const usable = solved || ch >= 3;
    const input = h('input.input', {
      value: word, 'aria-label': 'Word to blink', disabled: !usable,
      style: { maxWidth: '10rem' }
    });
    input.oninput = () => {
      if (!usable) return;
      pattern = toMorse(input.value);
      patternOut.textContent = pattern || '(nothing)';
      if (running) { stop(); start(); }
      paint();
    };

    mount(root,
      h('div.led-board', h('div.led', bulb, h('span.led-label', 'gpio 17'))),
      h('div.card',
        h('div.row', h('span.lbl', 'Word'), input, h('span.spacer'), status),
        h('div', { style: { marginTop: '.75rem' } }, patternOut),
        h('div', { style: { marginTop: '.75rem' } }, controls),
        liveNote('gpio 17 → indicator', { reveal: 'live' })
      ),
      !solved && ch >= 2
        ? h('div.card', { style: { borderColor: 'var(--warn)' } },
            h('p', { style: { marginBottom: '.5rem' } },
              'The pattern for this indicator comes from blinkPattern in led.js, and blinkPattern was never finished. It has been returning an empty string since the day it was written.'),
            h('a.btn.btn-primary', { href: '#/lab/blink' }, 'Open the editor'))
        : null,
      lastUsed()
    );
    paint();
    return () => { running = false; clearTimeout(timer); };
  }
};
