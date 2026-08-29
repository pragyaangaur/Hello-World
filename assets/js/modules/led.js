import { h, mount } from '../core/dom.js';
import { liveNote, lastUsed } from '../story/live.js';
import { chapter } from '../core/state.js';
import { SIGNAL_WORD } from '../story/beats.js';
import { tone } from '../core/audio.js';

const MORSE = {
  a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',
  k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',
  u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..'
};

/* Letters are separated by a space, which is what real Morse does and what
   the translator in the Toolbox expects. Pasting the pattern straight into it
   gives back a word rather than a row of single letters. */
function toMorse(word) {
  return word.toLowerCase().split('').filter(c => MORSE[c]).map(c => MORSE[c]).join(' ');
}

export default {
  id: 'led',
  name: 'LED indicator',
  dept: 'Electronics',
  icon: '◉',
  chapter: 2,
  blurb: 'Blink an LED, on a pattern',

  mount(root) {
    const ch = chapter();
    /* From act 2 the light is not showing what anybody programmed. It is
       repeating one word, and reading it is the whole of the puzzle. */
    const listening = ch >= 2;
    let word = listening ? SIGNAL_WORD : 'sos';
    let pattern = toMorse(word);
    let seq = [], step = 0, timer = null, running = false;
    let unit = 220;

    const bulb = h('span.led-bulb');
    const patternOut = h('div.readout.mono', { style: { fontSize: 'var(--step-1)', userSelect: 'all' } }, pattern);
    const status = h('div.small.dim');

    function build() {
      seq = [];
      for (const token of pattern.split('')) {
        if (token === '.') seq.push([true, 1], [false, 1]);
        else if (token === '-') seq.push([true, 3], [false, 1]);
        else if (token === ' ') seq.push([false, 3]);
        else if (token === '/') seq.push([false, 3]);
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

    function start() { if (running) return; build(); running = true; step = 0; tick(); paint(); }
    function stop() { running = false; clearTimeout(timer); bulb.classList.remove('on'); paint(); }

    const controls = h('div.row');
    function paint() {
      mount(controls,
        h('button.btn.btn-primary', { type: 'button', onclick: () => (running ? stop() : start()) },
          running ? 'Stop' : 'Watch it'),
        h('label.row.tight', { style: { gap: '.4rem' } },
          h('span.small.lbl', 'Speed'),
          h('input', {
            type: 'range', min: '80', max: '450', value: String(unit), style: { width: '7rem' },
            'aria-label': 'Blink speed',
            oninput: e => { unit = +e.target.value; }
          }),
          h('span.small.mono', unit + ' ms')
        )
      );
      status.textContent = `${pattern.replace(/[^.-]/g, '').length} symbols · ${running ? 'repeating' : 'stopped'}`;
    }

    const input = h('input.input', {
      value: word, 'aria-label': 'Word to blink', disabled: listening,
      style: { maxWidth: '10rem' }
    });
    input.oninput = () => {
      if (listening) return;
      word = input.value;
      pattern = toMorse(word);
      patternOut.textContent = pattern || '(nothing)';
      if (running) { stop(); start(); }
      paint();
    };

    mount(root,
      h('div.led-board', h('div.led', bulb, h('span.led-label', 'gpio 17'))),
      h('div.card',
        h('div.row',
          h('span.lbl', listening ? 'Incoming' : 'Word'),
          listening ? h('span.small.mono.dim', 'source: bench, not this app') : input,
          h('span.spacer'), status),
        h('div', { style: { marginTop: '.75rem' } }, patternOut),
        h('div', { style: { marginTop: '.75rem' } }, controls),
        liveNote('gpio 17 → indicator', { reveal: 'live' })
      ),
      listening
        ? h('div.card', { style: { borderColor: 'var(--warn)' } },
            h('p', { style: { marginBottom: '.5rem' } },
              'This is not a pattern anybody set. The controller has been driving the indicator with the same short sequence for nineteen days, and it repeats forever.'),
            h('p.small', { style: { marginBottom: '.75rem' } },
              'Copy the dots and dashes above into the Morse translator. Then write what it says on your task list.'),
            h('a.btn.btn-primary', { href: '#/tools/morse' }, 'Open the Morse translator'))
        : null,
      lastUsed()
    );
    paint();
    start();
    return () => { running = false; clearTimeout(timer); };
  }
};
