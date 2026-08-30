import { h, mount } from '../core/dom.js';
import { blip } from '../core/audio.js';
import { LEFT_BOARD, ghost, setGhost } from '../story/residue.js';
import { chapter } from '../core/state.js';

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

export function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? 'draw' : null;
}

export function minimax(b, player, depth = 0) {
  const w = winner(b);
  if (w === 'O') return { score: 10 - depth };
  if (w === 'X') return { score: depth - 10 };
  if (w === 'draw') return { score: 0 };

  let best = null;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = player;
    const { score } = minimax(b, player === 'O' ? 'X' : 'O', depth + 1);
    b[i] = null;
    if (!best || (player === 'O' ? score > best.score : score < best.score)) best = { score, move: i };
  }
  return best;
}

export default {
  id: 'tictactoe',
  name: 'Tic tac toe',
  dept: 'Computer Science',
  icon: '⊞',
  chapter: 3,
  blurb: 'Minimax, and it does not lose',

  mount(root) {
    /* There is a game already on the board. It is X's turn and it has been
       X's turn since the last person in this room stood up. */
    const resumed = chapter() >= 1 && !ghost('ttt.cleared', false);
    let board = resumed ? LEFT_BOARD.map(v => v || null) : Array(9).fill(null);
    let over = false;
    let record = ghost('ttt.record', { w: 0, l: 11, d: 34 });
    let difficulty = 'perfect';

    const grid = h('div.board');
    const status = h('p', { style: { textAlign: 'center' } },
      resumed ? 'Game in progress. You are X, and it is your move.' : 'You are X. Your move.');
    const tally = h('p.small.dim', { style: { textAlign: 'center' } });

    function aiMove() {
      const empties = board.map((v, i) => (v ? null : i)).filter(i => i !== null);
      if (!empties.length) return;
      if (difficulty === 'easy' || (difficulty === 'fair' && Math.random() < 0.35)) {
        board[empties[Math.floor(Math.random() * empties.length)]] = 'O';
      } else {
        board[minimax(board.slice(), 'O').move] = 'O';
      }
    }

    function check() {
      const w = winner(board);
      if (!w) return false;
      over = true;
      if (w === 'X') { record.w++; status.textContent = 'You won.'; }
      else if (w === 'O') { record.l++; status.textContent = 'It won.'; }
      else { record.d++; status.textContent = 'A draw. That is the best available.'; }
      setGhost('ttt.record', record);
      return true;
    }

    function play(i) {
      if (over || board[i]) return;
      blip();
      board[i] = 'X';
      if (!check()) { aiMove(); check(); }
      paint();
    }

    function paint() {
      mount(grid, ...board.map((v, i) =>
        h('button', { type: 'button', disabled: Boolean(v) || over, 'aria-label': 'Cell ' + (i + 1) + (v ? ', ' + v : ', empty'),
          style: v === 'O' ? { color: 'var(--ink-3)' } : { color: 'var(--accent)' },
          onclick: () => play(i) }, v || '')));
      tally.textContent = `${record.w} won · ${record.l} lost · ${record.d} drawn`
        + (chapter() >= 1 ? ' · running total, not reset since ' + '2 years ago' : '');
    }

    function reset() {
      board = Array(9).fill(null); over = false;
      setGhost('ttt.cleared', true);
      status.textContent = 'You are X. Your move.';
      paint();
    }

    mount(root,
      h('div.card', grid,
        h('div', { style: { marginTop: '1rem' } }, status, tally),
        h('div.row', { style: { justifyContent: 'center', marginTop: '.75rem' } },
          h('button.btn.btn-primary', { type: 'button', onclick: reset }, 'New game'),
          h('select.select', { style: { maxWidth: '8rem' }, 'aria-label': 'Difficulty',
            onchange: e => { difficulty = e.target.value; reset(); } },
            ...[['perfect', 'Perfect'], ['fair', 'Fair'], ['easy', 'Easy']].map(([v, l]) =>
              h('option', { value: v, selected: v === difficulty }, l))))
      ),
      h('p.small.dim', 'On Perfect it searches the whole game tree, so the best you can get is a draw. That is not the computer being clever. Tic tac toe is simply a solved game.')
    );
    paint();
  }
};
