import { h, mount, field } from '../core/dom.js';
import { holdTone } from '../core/audio.js';
import { liveNote } from '../story/live.js';
import { chapter } from '../core/state.js';

export default {
  id: 'scope',
  name: 'Oscilloscope',
  dept: 'Electronics',
  icon: '∿',
  chapter: 2,
  blurb: 'Signal generator and trace',
  wide: true,

  mount(root) {
    let freq = 50, amp = 1, shape = 'sine', running = true, phase = 0;
    let timeDiv = 5, voltDiv = 1;
    let osc = null, raf = null;

    const canvas = h('canvas.stage', { height: '320' });
    const ctx = canvas.getContext('2d');
    const readout = h('dl.kv');

    function fit() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.max(320, rect.width) * dpr;
      canvas.height = 320 * dpr;
      canvas.style.height = '320px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sample(t) {
      const x = 2 * Math.PI * freq * t + phase;
      switch (shape) {
        case 'square':   return Math.sign(Math.sin(x)) || 1;
        case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(x));
        case 'saw':      return 2 * ((freq * t + phase / (2 * Math.PI)) % 1) - 1;
        case 'noise':    return Math.sin(x) * 0.6 + (Math.random() - 0.5) * 0.5;
        case 'mains':    return Math.sin(x) + 0.08 * Math.sin(3 * x) + 0.04 * Math.sin(5 * x);
        default:         return Math.sin(x);
      }
    }

    function draw() {
      const w = canvas.clientWidth || 600, hgt = 320;
      const cs = getComputedStyle(document.documentElement);
      ctx.clearRect(0, 0, w, hgt);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      ctx.strokeStyle = cs.getPropertyValue('--rule').trim();
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        ctx.globalAlpha = i === 5 ? 1 : .5;
        ctx.beginPath(); ctx.moveTo((w / 10) * i, 0); ctx.lineTo((w / 10) * i, hgt); ctx.stroke();
      }
      for (let i = 1; i < 8; i++) {
        ctx.globalAlpha = i === 4 ? 1 : .5;
        ctx.beginPath(); ctx.moveTo(0, (hgt / 8) * i); ctx.lineTo(w, (hgt / 8) * i); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const spanS = (timeDiv / 1000) * 10;
      ctx.strokeStyle = cs.getPropertyValue('--accent').trim();
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const t = (px / w) * spanS;
        const v = sample(t) * amp;
        const y = hgt / 2 - (v / (voltDiv * 4)) * (hgt / 2);
        px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();

      ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`${timeDiv} ms/div   ${voltDiv} V/div`, 8, 16);
      if (running) phase += 0.16;
      raf = requestAnimationFrame(draw);
    }

    function retone() {
      if (osc) { osc.stop(); osc = null; }
      if (!running) return;
      const t = shape === 'noise' || shape === 'mains' ? 'sine' : shape === 'saw' ? 'sawtooth' : shape;
      osc = holdTone(Math.min(4000, Math.max(30, freq)), t);
    }

    const freqIn = h('input', { type: 'range', min: '1', max: '2000', value: String(freq), 'aria-label': 'Frequency',
      oninput: e => { freq = +e.target.value; update(); } });
    const ampIn = h('input', { type: 'range', min: '0', max: '200', value: '100', 'aria-label': 'Amplitude',
      oninput: e => { amp = +e.target.value / 100; update(); } });
    const shapeSel = h('select.select', { 'aria-label': 'Waveform',
      onchange: e => { shape = e.target.value; update(); retone(); } },
      ...['sine', 'square', 'triangle', 'saw', 'noise', 'mains'].map(s => h('option', { value: s, selected: s === shape }, s)));

    function update() {
      mount(readout,
        h('dt', 'Frequency'), h('dd', freq + ' Hz'),
        h('dt', 'Period'), h('dd', (1000 / freq).toFixed(2) + ' ms'),
        h('dt', 'Amplitude'), h('dd', amp.toFixed(2) + ' V'),
        h('dt', 'RMS'), h('dd', (amp * (shape === 'square' ? 1 : shape === 'triangle' ? 0.577 : 0.707)).toFixed(3) + ' V')
      );
    }

    mount(root,
      canvas,
      h('div.grid-2',
        h('div.card',
          field('Waveform', shapeSel),
          h('div', { style: { marginTop: '.75rem' } }, h('span.lbl', 'Frequency'), freqIn),
          h('div', h('span.lbl', 'Amplitude'), ampIn),
          h('div.row', { style: { marginTop: '.5rem' } },
            h('button.btn.btn-sm', { type: 'button', onclick: () => { timeDiv = Math.max(0.5, timeDiv / 2); } }, 'Time ÷2'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { timeDiv = Math.min(200, timeDiv * 2); } }, 'Time ×2'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { voltDiv = Math.max(0.125, voltDiv / 2); } }, 'V ÷2'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { voltDiv = Math.min(8, voltDiv * 2); } }, 'V ×2'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { running = !running; retone(); } }, 'Run / hold')
          )
        ),
        h('div.card', readout,
          chapter() >= 3
            ? h('p.small', { style: { marginTop: '.75rem', color: 'var(--warn)' } },
                'Channel A is not showing your generator. It is showing adc 0 on the bench, and adc 0 has been reading a 50 Hz mains hum with a rising DC offset for nineteen days.')
            : null,
          liveNote('adc 0 → channel A')
        )
      ),
      h('p.small.dim', 'Turn sound on in Settings and the generator is audible below 4 kHz.')
    );

    requestAnimationFrame(() => { fit(); draw(); });
    addEventListener('resize', fit);
    update();
    retone();

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', fit);
      if (osc) osc.stop();
    };
  }
};
