import { h, mount, fmt } from '../core/dom.js';

export default {
  id: 'pendulum',
  name: 'Pendulum',
  dept: 'Mechanical',
  icon: '⊙',
  chapter: 2,
  blurb: 'Simple harmonic motion',
  wide: true,

  mount(root) {
    let L = 1.2, g = 9.81, damp = 0.02, theta = Math.PI / 4, omega = 0;
    let raf = null, last = 0, running = true;
    const canvas = h('canvas.stage', { height: '340' });
    const ctx = canvas.getContext('2d');
    const out = h('dl.kv');

    function step(dt) {
      const alpha = -(g / L) * Math.sin(theta) - damp * omega;
      omega += alpha * dt;
      theta += omega * dt;
    }

    function draw(ts) {
      const dt = last ? Math.min(0.033, (ts - last) / 1000) : 0.016;
      last = ts;
      if (running) { step(dt); step(dt); }

      const w = canvas.clientWidth || 600, hgt = 340;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; canvas.style.height = hgt + 'px'; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      const ox = w / 2, oy = 40;
      const scale = Math.min(240 / Math.max(L, 0.1), 150);
      const bx = ox + Math.sin(theta) * L * scale;
      const by = oy + Math.cos(theta) * L * scale;

      ctx.strokeStyle = cs.getPropertyValue('--rule-2').trim();
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + L * scale); ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = cs.getPropertyValue('--ink-2').trim();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(bx, by); ctx.stroke();

      ctx.fillStyle = cs.getPropertyValue('--accent').trim();
      ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
      ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();

      const T = 2 * Math.PI * Math.sqrt(L / g);
      mount(out,
        h('dt', 'Period (small angle)'), h('dd', fmt(T, 3) + ' s'),
        h('dt', 'Frequency'), h('dd', fmt(1 / T, 3) + ' Hz'),
        h('dt', 'Angle'), h('dd', fmt(theta * 180 / Math.PI, 1) + '°'),
        h('dt', 'Angular speed'), h('dd', fmt(omega, 3) + ' rad/s')
      );
      raf = requestAnimationFrame(draw);
    }

    canvas.addEventListener('pointerdown', e => {
      const r = canvas.getBoundingClientRect();
      const ox = r.width / 2, oy = 40;
      theta = Math.atan2(e.clientX - r.left - ox, e.clientY - r.top - oy);
      omega = 0;
    });

    function slider(label, min, max, stepv, value, unit, set) {
      const val = h('span.small.mono', value + ' ' + unit);
      return h('div.field',
        h('div.row', h('label', label), h('span.spacer'), val),
        h('input', { type: 'range', min: String(min), max: String(max), step: String(stepv), value: String(value), 'aria-label': label,
          oninput: e => { set(+e.target.value); val.textContent = e.target.value + ' ' + unit; } }));
    }

    mount(root, canvas,
      h('div.grid-2',
        h('div.card',
          slider('Length', 0.2, 3, 0.05, L, 'm', v => L = v),
          slider('Gravity', 1.6, 25, 0.01, g, 'm/s²', v => g = v),
          slider('Damping', 0, 0.4, 0.005, damp, '', v => damp = v)
        ),
        h('div.card', out,
          h('div.row', { style: { marginTop: '.75rem' } },
            h('button.btn.btn-sm', { type: 'button', onclick: () => { running = !running; } }, 'Run / pause'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { theta = Math.PI / 4; omega = 0; } }, 'Reset')))
      ),
      h('p.small.dim', 'Drag anywhere on the canvas to move the bob. The stated period is the small-angle approximation, so it drifts from the simulation once you pull it far over.')
    );
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }
};
