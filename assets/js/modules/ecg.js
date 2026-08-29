import { h, mount, fmt } from '../core/dom.js';
import { liveNote } from '../story/live.js';

/* A synthetic ECG built from five Gaussian bumps, which is the standard
   toy model and looks right without pretending to be clinical. */
const WAVES = [
  { name: 'P',  a: 0.14, mu: 0.16, s: 0.028 },
  { name: 'Q',  a: -0.10, mu: 0.36, s: 0.011 },
  { name: 'R',  a: 1.00, mu: 0.40, s: 0.011 },
  { name: 'S',  a: -0.24, mu: 0.44, s: 0.014 },
  { name: 'T',  a: 0.30, mu: 0.66, s: 0.045 }
];

export default {
  id: 'ecg',
  name: 'ECG monitor',
  dept: 'Biomedical',
  icon: '♥',
  chapter: 3,
  blurb: 'A synthetic heart trace',
  wide: true,

  mount(root) {
    let bpm = 72, noise = 0.012, arrhythmia = false;
    let t = 0, raf = null, beatPhase = 0;
    const buffer = new Array(720).fill(0);

    const canvas = h('canvas.stage', { height: '260' });
    const ctx = canvas.getContext('2d');
    const out = h('dl.kv');

    function sampleAt(phase) {
      let v = 0;
      for (const w of WAVES) {
        const d = phase - w.mu;
        v += w.a * Math.exp(-(d * d) / (2 * w.s * w.s));
      }
      return v + (Math.random() - 0.5) * noise * 2;
    }

    function draw() {
      const period = 60 / bpm;
      const dt = 1 / 240;
      const jitter = arrhythmia && Math.random() < 0.012 ? 0.4 : 0;
      beatPhase += (dt / period) * (1 + jitter);
      if (beatPhase >= 1) beatPhase -= 1;
      buffer.push(sampleAt(beatPhase));
      buffer.shift();

      const w = canvas.clientWidth || 640, hgt = 260;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; canvas.style.height = hgt + 'px'; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      ctx.strokeStyle = cs.getPropertyValue('--rule').trim();
      ctx.lineWidth = 1; ctx.globalAlpha = .6;
      for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hgt); ctx.stroke(); }
      for (let y = 0; y < hgt; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = cs.getPropertyValue('--danger').trim();
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < buffer.length; i++) {
        const x = (i / buffer.length) * w;
        const y = hgt / 2 - buffer[i] * (hgt / 3);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    }

    function recompute() {
      const rr = 60 / bpm;
      mount(out,
        h('dt', 'Heart rate'), h('dd', bpm + ' bpm'),
        h('dt', 'RR interval'), h('dd', fmt(rr * 1000, 0) + ' ms'),
        h('dt', 'QT (Bazett)'), h('dd', fmt(0.4 * Math.sqrt(rr) * 1000, 0) + ' ms'),
        h('dt', 'Rhythm'), h('dd', arrhythmia ? 'irregular' : 'sinus')
      );
    }

    mount(root, canvas,
      h('div.grid-2',
        h('div.card',
          h('div.row', h('span.lbl', 'Heart rate'), h('span.spacer'), h('span.small.mono', bpm + ' bpm')),
          h('input', { type: 'range', min: '30', max: '190', value: String(bpm), 'aria-label': 'Heart rate',
            oninput: e => { bpm = +e.target.value; e.target.previousSibling.querySelector('.mono').textContent = bpm + ' bpm'; recompute(); } }),
          h('div.row', { style: { marginTop: '.5rem' } }, h('span.lbl', 'Noise')),
          h('input', { type: 'range', min: '0', max: '80', value: '12', 'aria-label': 'Noise',
            oninput: e => { noise = +e.target.value / 1000; } }),
          h('label.row.tight', { style: { marginTop: '.75rem', gap: '.5rem', cursor: 'pointer' } },
            h('input', { type: 'checkbox', onchange: e => { arrhythmia = e.target.checked; recompute(); } }),
            h('span.small', 'Irregular rhythm'))
        ),
        h('div.card', out,
          h('p.small.dim', { style: { marginTop: '.75rem', marginBottom: 0 } },
            'Five Gaussian bumps standing in for P, Q, R, S, and T. It is a drawing of an ECG, not a measurement of one.'))
      ),
      liveNote('adc 1 \u2192 channel B')
    );
    recompute();
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }
};
