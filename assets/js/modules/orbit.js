import { h, mount, fmt } from '../core/dom.js';

const G = 6.6743e-11;
const M_EARTH = 5.972e24;
const R_EARTH = 6371e3;

export default {
  id: 'orbit',
  name: 'Orbit simulator',
  dept: 'Aerospace',
  icon: '◯',
  chapter: 2,
  blurb: 'Two-body, drag to launch',
  wide: true,

  mount(root) {
    const SCALE = 42e6 / 260;    /* metres per pixel */
    let body = { x: R_EARTH + 400e3, y: 0, vx: 0, vy: 7660 };
    let trail = [];
    let raf = null, running = true, dtScale = 8;
    let dragFrom = null, dragTo = null;

    const canvas = h('canvas.stage', { height: '420' });
    const ctx = canvas.getContext('2d');
    const out = h('dl.kv');

    function elements() {
      const r = Math.hypot(body.x, body.y);
      const v = Math.hypot(body.vx, body.vy);
      const mu = G * M_EARTH;
      const energy = v * v / 2 - mu / r;
      const a = -mu / (2 * energy);
      const hVec = body.x * body.vy - body.y * body.vx;
      const e = Math.sqrt(Math.max(0, 1 + (2 * energy * hVec * hVec) / (mu * mu)));
      const apo = a * (1 + e), per = a * (1 - e);
      const T = a > 0 ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : Infinity;
      return { r, v, a, e, apo, per, T, escaped: energy >= 0 };
    }

    function stepPhysics(dt) {
      const substeps = 12;
      const h2 = dt / substeps;
      for (let i = 0; i < substeps; i++) {
        const r = Math.hypot(body.x, body.y);
        if (r < R_EARTH) { running = false; return; }
        const acc = -G * M_EARTH / (r * r * r);
        body.vx += acc * body.x * h2;
        body.vy += acc * body.y * h2;
        body.x += body.vx * h2;
        body.y += body.vy * h2;
      }
    }

    function draw() {
      const w = canvas.clientWidth || 640, hgt = 420;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; canvas.style.height = hgt + 'px'; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      const cx = w / 2, cy = hgt / 2;
      const px = m => cx + m / SCALE;
      const py = m => cy - m / SCALE;

      if (running) { stepPhysics(dtScale * 6); trail.push([body.x, body.y]); if (trail.length > 2400) trail.shift(); }

      ctx.strokeStyle = cs.getPropertyValue('--accent-line').trim();
      ctx.lineWidth = 1;
      ctx.beginPath();
      trail.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
      ctx.stroke();

      ctx.fillStyle = cs.getPropertyValue('--info').trim();
      ctx.beginPath(); ctx.arc(cx, cy, R_EARTH / SCALE, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = cs.getPropertyValue('--rule-2').trim();
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, (R_EARTH + 400e3) / SCALE, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = cs.getPropertyValue('--accent').trim();
      ctx.beginPath(); ctx.arc(px(body.x), py(body.y), 4, 0, Math.PI * 2); ctx.fill();

      if (dragFrom && dragTo) {
        ctx.strokeStyle = cs.getPropertyValue('--warn').trim();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(dragFrom.x, dragFrom.y); ctx.lineTo(dragTo.x, dragTo.y); ctx.stroke();
      }

      const el = elements();
      mount(out,
        h('dt', 'Altitude'), h('dd', fmt((el.r - R_EARTH) / 1000, 1) + ' km'),
        h('dt', 'Speed'), h('dd', fmt(el.v / 1000, 3) + ' km/s'),
        h('dt', 'Eccentricity'), h('dd', fmt(el.e, 4)),
        h('dt', 'Apoapsis'), h('dd', el.escaped ? 'escape' : fmt((el.apo - R_EARTH) / 1000, 0) + ' km'),
        h('dt', 'Periapsis'), h('dd', el.escaped ? '—' : fmt((el.per - R_EARTH) / 1000, 0) + ' km'),
        h('dt', 'Period'), h('dd', el.escaped ? '—' : fmt(el.T / 60, 1) + ' min'),
        h('dt', 'Status'), h('dd', !running ? 'impact' : el.escaped ? 'escaping' : el.per < R_EARTH ? 'will re-enter' : 'stable')
      );
      raf = requestAnimationFrame(draw);
    }

    canvas.addEventListener('pointerdown', e => {
      const r = canvas.getBoundingClientRect();
      dragFrom = { x: e.clientX - r.left, y: e.clientY - r.top };
      dragTo = { ...dragFrom };
    });
    canvas.addEventListener('pointermove', e => {
      if (!dragFrom) return;
      const r = canvas.getBoundingClientRect();
      dragTo = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    /* The release has to be caught on the window rather than the canvas,
       because a throw usually ends with the pointer outside the canvas. That
       means it has to be taken off again when the tool closes, or every visit
       leaves another one behind. */
    const onRelease = () => {
      if (!dragFrom || !dragTo) { dragFrom = dragTo = null; return; }
      const r = canvas.getBoundingClientRect();
      const cx = r.width / 2, cy = 210;
      body.x = (dragFrom.x - cx) * SCALE;
      body.y = -(dragFrom.y - cy) * SCALE;
      body.vx = (dragTo.x - dragFrom.x) * 26;
      body.vy = -(dragTo.y - dragFrom.y) * 26;
      trail = [];
      running = true;
      dragFrom = dragTo = null;
    };
    addEventListener('pointerup', onRelease);

    mount(root, canvas,
      h('div.grid-2',
        h('div.card', out),
        h('div.card',
          h('p.small.dim', 'Drag on the canvas to place a satellite and throw it. The length of the drag sets the speed.'),
          h('div.row',
            h('button.btn.btn-sm', { type: 'button', onclick: () => { body = { x: R_EARTH + 400e3, y: 0, vx: 0, vy: 7660 }; trail = []; running = true; } }, 'Circular 400 km'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { body = { x: R_EARTH + 400e3, y: 0, vx: 0, vy: 10200 }; trail = []; running = true; } }, 'Transfer'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { body = { x: R_EARTH + 400e3, y: 0, vx: 0, vy: 11200 }; trail = []; running = true; } }, 'Escape'),
            h('button.btn.btn-sm', { type: 'button', onclick: () => { running = !running; } }, 'Run / pause')),
          h('div.row', { style: { marginTop: '.5rem' } },
            h('span.small.lbl', 'Speed'),
            h('input', { type: 'range', min: '1', max: '40', value: '8', style: { width: '9rem' }, 'aria-label': 'Simulation speed',
              oninput: e => { dtScale = +e.target.value; } }))
        )
      ),
      h('p.small.dim', 'Two-body Newtonian gravity around Earth, integrated in twelve substeps per frame. Circular orbit at 400 km needs 7.66 km/s. Escape from there needs 10.85.')
    );
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener('pointerup', onRelease); };
  }
};
