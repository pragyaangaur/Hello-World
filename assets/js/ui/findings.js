/* The Findings board. Six questions, the same shape as a to-do list,
   because that is the only shape this app has. */

import { h, mount, $ } from '../core/dom.js';
import { FINDINGS } from '../story/findings.js';
import { hasFlag, chapter } from '../core/state.js';
import { findingsDone } from '../story/engine.js';
import { RIG, bayTemp } from '../story/cast.js';
import { CHAPTERS } from '../story/beats.js';
import { setTitle } from './shell.js';

function sparkline(width = 560, height = 120) {
  const c = h('canvas.stage', { width: String(width * 2), height: String(height * 2), style: { height: height + 'px' } });
  requestAnimationFrame(() => {
    const ctx = c.getContext('2d');
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#d9902e';
    const rule = cs.getPropertyValue('--rule').trim() || '#333';
    const danger = cs.getPropertyValue('--danger').trim() || '#d9564a';
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    const pad = { l: 34, r: 8, t: 10, b: 18 };
    const w = width - pad.l - pad.r, hgt = height - pad.t - pad.b;
    const min = 20, max = 70;
    const x = i => pad.l + (i / 19) * w;
    const y = v => pad.t + hgt - ((v - min) / (max - min)) * hgt;

    ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.fillStyle = cs.getPropertyValue('--ink-3').trim() || '#888';
    ctx.font = '9px ui-monospace, monospace';
    for (const v of [20, 30, 45, 60]) {
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(width - pad.r, y(v)); ctx.stroke();
      ctx.fillText(v + '°', 4, y(v) + 3);
    }
    ctx.strokeStyle = danger; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pad.l, y(60)); ctx.lineTo(width - pad.r, y(60)); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = 0; d <= 19; d++) {
      const px = x(d), py = y(bayTemp(d));
      d === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(x(19), y(bayTemp(19)), 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cs.getPropertyValue('--ink-3').trim() || '#888';
    ctx.fillText('19 days ago', pad.l, height - 5);
    ctx.fillText('today', width - pad.r - 26, height - 5);
  });
  return c;
}

export function mountFindings() {
  const view = $('#view');
  view.dataset.page = 'findings';
  setTitle('Findings');

  if (chapter() < 3) {
    mount(view, h('div.page', h('div.empty', h('p', 'Nothing to look into yet.'), h('a.btn', { href: '#/tasks' }, 'Back'))));
    return;
  }

  const done = findingsDone();
  const goal = CHAPTERS[chapter()]?.goal || '';

  const rows = FINDINGS.map(f => {
    const resolved = hasFlag('finding.' + f.id);
    return h('li.task' + (resolved ? '.done' : ''), { style: { alignItems: 'flex-start' } },
      h('span', { style: {
        marginTop: '.2rem', flex: 'none', width: '1.15rem', height: '1.15rem', borderRadius: '50%',
        border: '1.5px solid ' + (resolved ? 'var(--accent)' : 'var(--rule-2)'),
        background: resolved ? 'var(--accent)' : 'transparent',
        display: 'grid', placeItems: 'center', color: 'var(--accent-ink)', fontSize: '11px'
      } }, resolved ? '✓' : ''),
      h('div.task-main',
        h('div.task-text', { style: { fontWeight: '600' } }, f.q),
        h('div.task-meta',
          resolved
            ? h('span.task-note', { style: { color: 'var(--ink-2)' } }, f.answer)
            : h('span.task-note', f.hint)
        )
      ),
      resolved ? null : (f.where === '#account'
        ? h('button.btn.btn-sm', { type: 'button', onclick: () => document.querySelector('#account-chip')?.click() }, 'Open')
        : h('a.btn.btn-sm', { href: f.where }, 'Go'))
    );
  });

  mount(view, h('div.page',
    h('div.page-head', h('div.grow',
      h('h1', 'Findings'),
      h('p', `${done} of ${FINDINGS.length} answered. ${goal}`)
    )),
    h('div.stack',
      h('div.card.flush',
        h('div.card-head', `Bay ${RIG.faultBay} temperature`, h('span.spacer'),
          h('span.badge.danger', bayTemp(19).toFixed(1) + ' °C')),
        h('div.card-body', sparkline(),
          h('p.small.dim', { style: { marginTop: '.5rem', marginBottom: 0 } },
            'Storage range for this pack is 18 to 30 degrees. The dashed line is 60, where the separator starts to break down.'))
      ),
      h('ul.task-list', ...rows),
      done >= FINDINGS.length
        ? h('div.card', { style: { borderColor: 'var(--accent)' } },
            h('p', 'Every question is answered. The last one is not a question.'),
            h('a.btn.btn-primary', { href: '#/lab/branch' }, 'Write the branch'))
        : null
    )
  ));
}
