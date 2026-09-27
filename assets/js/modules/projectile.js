import { h, mount, fmt } from '../core/dom.js';

export default {
  id: 'projectile',
  name: 'Projectile motion',
  dept: 'Mechanical',
  icon: '⌒',
  chapter: 2,
  blurb: 'Angle, speed, and a curve',
  wide: true,

  mount(root) {
    let v0 = 25, angle = 45, g = 9.81, h0 = 0, drag = 0;
    const canvas = h('canvas.stage', { height: '300' });
    const ctx = canvas.getContext('2d');
    const out = h('dl.kv');

    function trajectory() {
      const rad = angle * Math.PI / 180;
      const pts = [];
      let x = 0, y = h0, vx = v0 * Math.cos(rad), vy = v0 * Math.sin(rad);
      const dt = 0.008;
      let t = 0, apex = h0;
      while (y >= 0 && t < 60) {
        pts.push([x, y]);
        const speed = Math.hypot(vx, vy);
        const ax = -drag * speed * vx;
        const ay = -g - drag * speed * vy;
        vx += ax * dt; vy += ay * dt;
        x += vx * dt; y += vy * dt;
        if (y > apex) apex = y;
        t += dt;
      }
      return { pts, range: x, time: t, apex };
    }

    function draw() {
      const { pts, range, time, apex } = trajectory();
      const w = canvas.clientWidth || 600, hgt = 300;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = w * dpr; canvas.height = hgt * dpr;
      canvas.style.height = hgt + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      const pad = 28;
      const maxX = Math.max(range, 1), maxY = Math.max(apex, 1);
      const sx = (w - pad * 2) / maxX, sy = (hgt - pad * 2) / maxY;
      const s = Math.min(sx, sy);
      const px = x => pad + x * s;
      const py = y => hgt - pad - y * s;

      ctx.strokeStyle = cs.getPropertyValue('--rule').trim();
      ctx.beginPath(); ctx.moveTo(pad, hgt - pad); ctx.lineTo(w - pad, hgt - pad); ctx.stroke();

      ctx.strokeStyle = cs.getPropertyValue('--accent').trim();
      ctx.lineWidth = 2; ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
      ctx.stroke();

      ctx.fillStyle = cs.getPropertyValue('--accent').trim();
      ctx.beginPath(); ctx.arc(px(range), py(0), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(fmt(range, 1) + ' m', px(range) - 20, py(0) - 10);

      mount(out,
        h('dt', 'Range'), h('dd', fmt(range, 2) + ' m'),
        h('dt', 'Maximum height'), h('dd', fmt(apex, 2) + ' m'),
        h('dt', 'Time of flight'), h('dd', fmt(time, 2) + ' s'),
        h('dt', 'Impact speed'), h('dd', fmt(Math.hypot(v0 * Math.cos(angle * Math.PI / 180), Math.sqrt(Math.max(0, (v0 * Math.sin(angle * Math.PI / 180)) ** 2 + 2 * g * h0))), 2) + ' m/s')
      );
    }

    function slider(label, min, max, step, value, unit, set) {
      const val = h('span.small.mono', value + ' ' + unit);
      const s = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label,
        oninput: e => { set(+e.target.value); val.textContent = e.target.value + ' ' + unit; draw(); } });
      return h('div.field', h('div.row', h('label', label), h('span.spacer'), val), s);
    }

    mount(root, canvas,
      h('div.grid-2',
        h('div.card',
          slider('Launch speed', 1, 80, 1, v0, 'm/s', v => v0 = v),
          slider('Angle', 1, 89, 1, angle, '°', v => angle = v),
          slider('Start height', 0, 50, 1, h0, 'm', v => h0 = v)
        ),
        h('div.card',
          slider('Gravity', 1.6, 25, 0.01, g, 'm/s²', v => g = v),
          slider('Air drag', 0, 0.02, 0.0005, drag, '', v => drag = v),
          h('div', { style: { marginTop: '.75rem' } }, out)
        )
      ),
      h('p.small.dim', 'Gravity defaults to Earth. 1.62 is the Moon and 3.72 is Mars. Drag is a simple quadratic term, which is close enough for a ball and wrong for a shuttlecock.')
    );
    requestAnimationFrame(draw);
    addEventListener('resize', draw);
    return () => removeEventListener('resize', draw);
  }
};
