import { h, mount, field, fmt } from '../core/dom.js';

/* Simply supported beam with a uniform load and one point load.
   Enough to size a shelf, which is the point. */

export default {
  id: 'beam',
  name: 'Beam load',
  dept: 'Civil',
  icon: '⌸',
  chapter: 2,
  blurb: 'Shear, moment, deflection',
  wide: true,

  mount(root) {
    let L = 2.0, w = 0, P = 60, a = 1.0, E = 200e9, I = 4.5e-7, limit = 60;
    const canvas = h('canvas.stage', { height: '260' });
    const ctx = canvas.getContext('2d');
    const out = h('dl.kv');
    const verdict = h('p.small');

    function reactions() {
      const Rb = (w * L * L / 2 + P * a) / L;
      const Ra = w * L + P - Rb;
      return { Ra, Rb };
    }
    function shearAt(x) {
      const { Ra } = reactions();
      return Ra - w * x - (x >= a ? P : 0);
    }
    function momentAt(x) {
      const { Ra } = reactions();
      return Ra * x - w * x * x / 2 - (x >= a ? P * (x - a) : 0);
    }
    function maxDeflection() {
      const dUdl = (5 * w * Math.pow(L, 4)) / (384 * E * I);
      const b = L - a;
      const dPt = (P * b * (3 * L * L - 4 * b * b)) / (48 * E * I);
      return dUdl + dPt;
    }

    function draw() {
      const cw = canvas.clientWidth || 600, hgt = 260;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = cw * dpr; canvas.height = hgt * dpr; canvas.style.height = hgt + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, cw, hgt);

      const pad = 34;
      const x0 = pad, x1 = cw - pad;
      const px = x => x0 + (x / L) * (x1 - x0);

      const N = 240;
      const shears = [], moments = [];
      for (let i = 0; i <= N; i++) { const x = (i / N) * L; shears.push(shearAt(x)); moments.push(momentAt(x)); }
      const sMax = Math.max(1e-6, ...shears.map(Math.abs));
      const mMax = Math.max(1e-6, ...moments.map(Math.abs));

      /* beam */
      const beamY = 46;
      ctx.strokeStyle = cs.getPropertyValue('--ink-2').trim();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x0, beamY); ctx.lineTo(x1, beamY); ctx.stroke();
      ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
      for (const sx of [x0, x1]) { ctx.beginPath(); ctx.moveTo(sx, beamY + 3); ctx.lineTo(sx - 8, beamY + 16); ctx.lineTo(sx + 8, beamY + 16); ctx.fill(); }
      ctx.strokeStyle = cs.getPropertyValue('--accent').trim();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(a), beamY - 26); ctx.lineTo(px(a), beamY - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(a) - 5, beamY - 11); ctx.lineTo(px(a), beamY - 3); ctx.lineTo(px(a) + 5, beamY - 11); ctx.stroke();

      /* diagrams */
      function plot(vals, max, baseY, height, colour, label) {
        ctx.strokeStyle = cs.getPropertyValue('--rule').trim(); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x1, baseY); ctx.stroke();
        ctx.strokeStyle = colour; ctx.lineWidth = 2;
        ctx.beginPath();
        vals.forEach((v, i) => {
          const X = x0 + (i / N) * (x1 - x0);
          const Y = baseY - (v / max) * height;
          i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
        });
        ctx.stroke();
        ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(label, x0, baseY - height - 4);
      }
      plot(shears, sMax, 140, 42, cs.getPropertyValue('--info').trim(), 'shear (N)');
      plot(moments, mMax, 232, 46, cs.getPropertyValue('--warn').trim(), 'moment (N·m)');
    }

    function recompute() {
      const { Ra, Rb } = reactions();
      const N = 400;
      let mMax = 0, sMax = 0;
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * L;
        mMax = Math.max(mMax, Math.abs(momentAt(x)));
        sMax = Math.max(sMax, Math.abs(shearAt(x)));
      }
      const d = maxDeflection();
      const total = P + w * L;
      mount(out,
        h('dt', 'Left reaction'), h('dd', fmt(Ra, 1) + ' N'),
        h('dt', 'Right reaction'), h('dd', fmt(Rb, 1) + ' N'),
        h('dt', 'Maximum shear'), h('dd', fmt(sMax, 1) + ' N'),
        h('dt', 'Maximum moment'), h('dd', fmt(mMax, 2) + ' N·m'),
        h('dt', 'Maximum deflection'), h('dd', fmt(d * 1000, 3) + ' mm'),
        h('dt', 'Span / deflection'), h('dd', d > 0 ? '1 : ' + fmt(L / d, 0) : '—')
      );
      const kg = total / 9.81;
      const over = kg > limit;
      verdict.textContent = over
        ? `Total load is ${fmt(kg, 1)} kg on a bracket rated for ${limit} kg. That is ${fmt((kg / limit - 1) * 100, 0)} percent over.`
        : `Total load is ${fmt(kg, 1)} kg, within the ${limit} kg rating.`;
      verdict.style.color = over ? 'var(--danger)' : 'var(--ok)';
      draw();
    }

    function slider(label, min, max, stepv, value, unit, set) {
      const val = h('span.small.mono', value + ' ' + unit);
      return h('div.field',
        h('div.row', h('label', label), h('span.spacer'), val),
        h('input', { type: 'range', min: String(min), max: String(max), step: String(stepv), value: String(value), 'aria-label': label,
          oninput: e => { set(+e.target.value); val.textContent = (+e.target.value) + ' ' + unit; recompute(); } }));
    }

    mount(root, canvas,
      h('div.grid-2',
        h('div.card',
          slider('Span', 0.5, 6, 0.1, L, 'm', v => { L = v; if (a > L) a = L / 2; }),
          slider('Point load', 0, 4000, 10, P, 'N', v => P = v),
          slider('Load position', 0, 6, 0.05, a, 'm', v => a = Math.min(v, L)),
          slider('Uniform load', 0, 2000, 10, w, 'N/m', v => w = v)
        ),
        h('div.card', out, verdict)
      ),
      h('p.small.dim', 'Simply supported, one point load and one uniform load. E and I are set for a light steel shelf bracket, 200 GPa and 4.5×10⁻⁷ m⁴.')
    );
    recompute();
    addEventListener('resize', recompute);
    return () => removeEventListener('resize', recompute);
  }
};
