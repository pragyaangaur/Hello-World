import { h, mount } from '../core/dom.js';
import { liveNote, lastUsed } from '../story/live.js';
import { chapter } from '../core/state.js';
import { SIGNAL_WORD, LAST_ACT } from '../story/acts.js';
import { decode } from './morse.js';
import { emit } from '../core/bus.js';
import { tone } from '../core/audio.js';

const MORSE = {
  a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',
  k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',
  u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..'
};

/* Letters separated by a space, which is what the Morse translator expects,
   so the pattern can be pasted between the two tools in either direction. */
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
    const sending = ch >= LAST_ACT;
    const listening = ch >= 2 && !sending;

    let pattern = sending ? '' : toMorse(listening ? SIGNAL_WORD : 'sos');
    let seq = [], step = 0, timer = null, running = false;
    let unit = 220;

    const bulb = h('span.led-bulb');
    const patternOut = h('div.readout.mono', { style: { fontSize: 'var(--step-1)', userSelect: 'all' } },
      pattern || '(nothing)');
    const status = h('div.small.dim');

    function build() {
      seq = [];
      for (const token of pattern.split('')) {
        if (token === '.') seq.push([true, 1], [false, 1]);
        else if (token === '-') seq.push([true, 3], [false, 1]);
        else if (token === ' ') seq.push([false, 3]);
        else if (token === '/') seq.push([false, 5]);
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
        h('button.btn.btn-primary', { type: 'button', disabled: sending && !pattern,
          onclick: () => (running ? stop() : start()) }, running ? 'Stop' : 'Blink it'),
        h('label.row.tight', { style: { gap: '.4rem' } },
          h('span.small.lbl', 'Speed'),
          h('input', { type: 'range', min: '80', max: '450', value: String(unit),
            style: { width: '7rem' }, 'aria-label': 'Blink speed',
            oninput: e => { unit = +e.target.value; } }),
          h('span.small.mono', unit + ' ms'))
      );
      const symbols = pattern.replace(/[^.-]/g, '').length;
      status.textContent = symbols
        ? `${symbols} symbols · ${running ? 'repeating' : 'stopped'}`
        : 'nothing to send';
    }

    /* ---- the last act: the light works the other way ---- */
    const sendField = h('input.input.mono', {
      placeholder: '... - --- .--.',
      'aria-label': 'Pattern to send',
      style: { flex: '1', minWidth: '12rem' }
    });
    const sendWord = h('div.small.dim');
    const sendBtn = h('button.btn.btn-primary', { type: 'button', disabled: true }, 'Send to bench');

    function readSend() {
      pattern = sendField.value.replace(/[^.\-\s/]/g, '').replace(/\s+/g, ' ').trim();
      patternOut.textContent = pattern || '(nothing)';
      const word = decode(pattern).trim().toLowerCase();
      sendWord.textContent = word ? `reads as: ${word}` : 'not a readable pattern yet';
      sendBtn.disabled = !word;
      sendBtn.dataset.word = word;
      if (running) { stop(); start(); }
      paint();
    }

    sendField.addEventListener('input', readSend);
    sendBtn.onclick = () => {
      const word = sendBtn.dataset.word;
      if (!word) return;
      stop();
      start();
      emit('tool:value', { tool: 'led', value: word });
    };

    mount(root,
      h('div.led-board', h('div.led', bulb, h('span.led-label', 'gpio 17'))),
      h('div.card',
        sending
          ? h('div',
              h('div.row', h('span.lbl', 'Outgoing'), sendField),
              h('div', { style: { marginTop: '.4rem' } }, sendWord))
          : h('div.row',
              h('span.lbl', 'Incoming'),
              h('span.small.mono.dim', 'source: bench, not this app'),
              h('span.spacer'), status),
        h('div', { style: { marginTop: '.75rem' } }, patternOut),
        h('div', { style: { marginTop: '.75rem' } }, controls),
        sending ? h('div.row', { style: { marginTop: '.75rem' } }, sendBtn) : null,
        liveNote('gpio 17 → indicator')
      ),

      sending
        ? h('div.card', { style: { borderColor: 'var(--danger)' } },
            h('p', { style: { marginBottom: '.5rem' } },
              'This is the only channel it listens on. Encode a word, paste the dots and dashes above, send it.'),
            h('p.small', { style: { marginBottom: '.75rem' } },
              'It knows two words. One ends the test. The other is the word it has been sending you.'),
            h('a.btn', { href: '#/tools/morse' }, 'Open the Morse translator'))
        : listening
          ? h('div.card', { style: { borderColor: 'var(--warn)' } },
              h('p', { style: { marginBottom: '.5rem' } },
                'Nobody set this pattern. The controller has repeated it for nineteen days.'),
              h('p.small', { style: { marginBottom: '.75rem' } },
                'Copy the dots and dashes above into the Morse translator, then write what it says on your list.'),
              h('a.btn.btn-primary', { href: '#/tools/morse' }, 'Open the Morse translator'))
          : null,
      lastUsed()
    );

    paint();
    if (!sending) start();
    return () => { running = false; clearTimeout(timer); };
  }
};
