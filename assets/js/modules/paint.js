import { h, mount } from '../core/dom.js';

export default {
  id: 'paint',
  name: 'Sketchpad',
  dept: 'Everyday',
  icon: '✐',
  chapter: 1,
  blurb: 'Draw with a mouse or a finger',
  wide: true,

  mount(root) {
    const canvas = h('canvas.stage', { height: '460' });
    const ctx = canvas.getContext('2d');
    let colour = '#2e9e6b', size = 4, drawing = false, erasing = false;
    let last = null;
    const strokes = [];
    let currentStroke = null;

    function fit() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.max(320, rect.width * dpr);
      canvas.height = 460 * dpr;
      canvas.style.height = '460px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function redraw() {
      const style = getComputedStyle(document.documentElement);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = style.getPropertyValue('--sunken').trim() || '#eee';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const s of strokes) {
        if (s.points.length < 2) continue;
        ctx.strokeStyle = s.colour; ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--sunken').trim();
      currentStroke = { colour: erasing ? bg : colour, size: erasing ? size * 4 : size, points: [pos(e)] };
      strokes.push(currentStroke);
      last = currentStroke.points[0];
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      currentStroke.points.push(p);
      ctx.strokeStyle = currentStroke.colour;
      ctx.lineWidth = currentStroke.size;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    }
    function end() { drawing = false; currentStroke = null; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('touchstart', start, { passive: false });
    addEventListener('mousemove', move);
    canvas.addEventListener('touchmove', move, { passive: false });
    addEventListener('mouseup', end);
    addEventListener('touchend', end);
    addEventListener('resize', fit);

    const swatches = h('div.row.tight');
    for (const c of ['#2e9e6b', '#2f6f8c', '#b4402f', '#a87413', '#6b4fa8', '#1c1b19', '#ffffff']) {
      swatches.appendChild(h('button', {
        type: 'button', 'aria-label': 'Colour ' + c, title: c,
        style: { width: '1.6rem', height: '1.6rem', borderRadius: '50%', background: c, border: '1px solid var(--rule-2)', cursor: 'pointer' },
        onclick: () => { colour = c; erasing = false; paintBar(); }
      }));
    }

    const bar = h('div.row');
    function paintBar() {
      mount(bar,
        swatches,
        h('label.row.tight', { style: { gap: '.4rem' } }, h('span.small.lbl', 'Size'),
          h('input', { type: 'range', min: '1', max: '40', value: String(size), style: { width: '7rem' }, oninput: e => { size = +e.target.value; } })),
        h('button.btn.btn-sm', { type: 'button', 'aria-pressed': String(erasing), onclick: () => { erasing = !erasing; paintBar(); } }, erasing ? 'Erasing' : 'Eraser'),
        h('span.spacer'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => { strokes.pop(); redraw(); } }, 'Undo'),
        h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { strokes.length = 0; redraw(); } }, 'Clear'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => {
          const a = h('a', { href: canvas.toDataURL('image/png'), download: 'sketch.png' });
          document.body.appendChild(a); a.click(); a.remove();
        } }, 'Save PNG')
      );
    }
    paintBar();

    mount(root, bar, canvas, h('p.small.dim', 'Works with a mouse, a trackpad, or a finger.'));
    requestAnimationFrame(fit);

    return () => {
      removeEventListener('mousemove', move);
      removeEventListener('mouseup', end);
      removeEventListener('touchend', end);
      removeEventListener('resize', fit);
    };
  }
};
