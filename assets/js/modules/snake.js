import { h, mount } from '../core/dom.js';
import { blip, tone } from '../core/audio.js';
import { ghost, setGhost } from '../story/residue.js';

export default {
  id: 'snake',
  name: 'Snake',
  dept: 'Computer Science',
  icon: '⌇',
  chapter: 3,
  blurb: 'Arrow keys, or swipe',

  mount(root) {
    const N = 17;
    /* The score at the top of this board is not yours and was not set on this
       machine. It sits there until somebody beats it, which nobody has. */
    let best = ghost('snake.best', 47);
    const holder = ghost('snake.holder', 'user_02');
    let snake, dir, next, food, score, timer = null, dead = false;

    const canvas = h('canvas.stage', { width: '510', height: '510', style: { maxWidth: '32rem', margin: '0 auto', aspectRatio: '1' } });
    const ctx = canvas.getContext('2d');
    const scoreEl = h('span.mono');
    const holderEl = h('span.small.dim');

    function reset() {
      snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
      dir = { x: 1, y: 0 }; next = dir;
      score = 0; dead = false;
      placeFood();
      draw();
      start();
    }

    function placeFood() {
      do { food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; }
      while (snake.some(s => s.x === food.x && s.y === food.y));
    }

    function step() {
      dir = next;
      const head = { x: (snake[0].x + dir.x + N) % N, y: (snake[0].y + dir.y + N) % N };
      if (snake.some(s => s.x === head.x && s.y === head.y)) {
        dead = true; clearInterval(timer); timer = null;
        if (score > best) { best = score; setGhost('snake.best', score); setGhost('snake.holder', 'you'); }
        tone(180, 0.3, 'sawtooth', 0.5);
        draw(); return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) { score++; blip(); placeFood(); }
      else snake.pop();
      draw();
    }

    function draw() {
      const cs = getComputedStyle(document.documentElement);
      const cell = 510 / N;
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, 510, 510);
      ctx.fillStyle = cs.getPropertyValue('--danger').trim();
      ctx.fillRect(food.x * cell + 5, food.y * cell + 5, cell - 10, cell - 10);
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? cs.getPropertyValue('--accent').trim() : cs.getPropertyValue('--accent-line').trim();
        ctx.fillRect(s.x * cell + 2, s.y * cell + 2, cell - 4, cell - 4);
      });
      if (dead) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, 510, 510);
        ctx.fillStyle = '#fff';
        ctx.font = '600 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Score ' + score, 255, 245);
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(score > 0 && score >= best ? 'Best score. It is yours now.' : 'Press space to play again', 255, 275);
        ctx.textAlign = 'left';
      }
      const top = Math.max(best, score);
      scoreEl.textContent = `score ${score} · best ${top}`;
      holderEl.textContent = (score >= top && score > 0) || holder === 'you' ? 'held by you' : 'held by ' + holder;
    }

    function start() { clearInterval(timer); timer = setInterval(step, 110); }

    const onKey = e => {
      if (e.target.matches('input, textarea')) return;
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
                    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const m = map[e.key];
      if (m) {
        e.preventDefault();
        if (m[0] !== -dir.x || m[1] !== -dir.y) next = { x: m[0], y: m[1] };
      }
      if (e.key === ' ' && dead) { e.preventDefault(); reset(); }
    };
    addEventListener('keydown', onKey);

    let touchStart = null;
    canvas.addEventListener('touchstart', e => { touchStart = e.touches[0]; }, { passive: true });
    canvas.addEventListener('touchend', e => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.clientX, dy = t.clientY - touchStart.clientY;
      if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 20) next = { x: Math.sign(dx), y: 0 }; }
      else if (Math.abs(dy) > 20) next = { x: 0, y: Math.sign(dy) };
      touchStart = null;
    }, { passive: true });
    canvas.addEventListener('click', () => { if (dead) reset(); });

    mount(root,
      h('div.row', { style: { justifyContent: 'center' } }, scoreEl, holderEl),
      canvas,
      h('div.row', { style: { justifyContent: 'center' } },
        h('button.btn.btn-primary', { type: 'button', onclick: reset }, 'New game')),
      h('p.small.dim', { style: { textAlign: 'center' } }, 'Arrow keys or WASD. On a phone, swipe. The walls wrap around.')
    );
    reset();
    return () => { clearInterval(timer); removeEventListener('keydown', onKey); };
  }
};
