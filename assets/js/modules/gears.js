import { h, mount, field, fmt } from '../core/dom.js';

export default {
  id: 'gears',
  name: 'Gear ratio',
  dept: 'Mechanical',
  icon: '⚙',
  chapter: 2,
  blurb: 'Teeth, torque, and speed',

  mount(root) {
    let driver = 12, driven = 36, rpm = 1500, torque = 2.4;
    const out = h('dl.kv');
    const canvas = h('canvas.stage', { height: '220' });
    const ctx = canvas.getContext('2d');
    let angle = 0, raf = null;

    function gear(cx, cy, r, teeth, rot, colour) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2 + rot;
        const rr = i % 2 === 0 ? r : r * 0.86;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--sunken').trim();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2); ctx.fill();
    }

    function draw() {
      const w = canvas.clientWidth || 600, hgt = 220;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; canvas.style.height = hgt + 'px'; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      const scale = 1.6;
      const r1 = driver * scale, r2 = driven * scale;
      const total = r1 + r2;
      const fit = Math.min(1, (Math.min(w, hgt * 2) - 40) / (total * 2));
      const R1 = r1 * fit, R2 = r2 * fit;
      const cx1 = w / 2 - R2, cy = hgt / 2;
      const cx2 = cx1 + R1 + R2;

      gear(cx1, cy, R1, driver, angle, cs.getPropertyValue('--accent').trim());
      gear(cx2, cy, R2, driven, -angle * (driver / driven) + Math.PI / driven, cs.getPropertyValue('--ink-3').trim());
      angle += 0.02;
      raf = requestAnimationFrame(draw);
    }

    function recompute() {
      const ratio = driven / driver;
      mount(out,
        h('dt', 'Ratio'), h('dd', fmt(ratio, 3) + ' : 1'),
        h('dt', 'Output speed'), h('dd', fmt(rpm / ratio, 1) + ' rpm'),
        h('dt', 'Output torque'), h('dd', fmt(torque * ratio, 3) + ' N·m'),
        h('dt', 'Mechanical advantage'), h('dd', fmt(ratio, 3)),
        h('dt', 'Direction'), h('dd', 'reversed')
      );
    }

    function num(label, value, set, min = 1, max = 400) {
      return field(label, h('input.input.mono', { type: 'number', min: String(min), max: String(max), value: String(value), 'aria-label': label,
        oninput: e => { const v = +e.target.value; if (v >= min) { set(v); recompute(); } } }));
    }

    mount(root, canvas,
      h('div.card',
        h('div.grid-2',
          num('Driver teeth', driver, v => driver = v, 6, 200),
          num('Driven teeth', driven, v => driven = v, 6, 200),
          num('Input speed (rpm)', rpm, v => rpm = v, 0, 100000),
          num('Input torque (N·m)', torque, v => torque = v, 0, 100000)
        )
      ),
      h('div.card', out),
      h('p.small.dim', 'A ratio above one trades speed for torque. Below one it does the opposite. The two gears turn in opposite directions, which is why an idler exists.')
    );
    recompute();
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }
};
