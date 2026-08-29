import { h, mount, fmt } from '../core/dom.js';
import { readings } from '../story/challenges.js';
import { RIG, bayTemp, isoDate, NOW } from '../story/cast.js';
import { get } from '../core/state.js';
import { liveNote } from '../story/live.js';
import { resolveFinding } from '../story/engine.js';

export default {
  id: 'sensorlog',
  name: 'Sensor log',
  dept: 'Electronics',
  icon: '⌗',
  chapter: 3,
  blurb: 'Four channels, nineteen days',
  wide: true,

  mount(root) {
    const data = readings();
    const solved = Boolean(get().challenges.parse);
    const lastDay = 19;
    let showBay = 0;   /* 0 means all */

    const canvas = h('canvas.stage', { height: '260' });
    const ctx = canvas.getContext('2d');
    const bays = h('div.stack');
    const table = h('div', { style: { overflowX: 'auto', maxHeight: '18rem', overflowY: 'auto' } });

    function series(bay) {
      return data.filter(r => r.bay === bay).sort((a, b) => a.day - b.day).map(r => r.tempC);
    }

    function draw() {
      const w = canvas.clientWidth || 640, hgt = 260;
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = w * dpr; canvas.height = hgt * dpr; canvas.style.height = hgt + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(document.documentElement);
      ctx.fillStyle = cs.getPropertyValue('--sunken').trim();
      ctx.fillRect(0, 0, w, hgt);

      const pad = { l: 38, r: 12, t: 14, b: 24 };
      const iw = w - pad.l - pad.r, ih = hgt - pad.t - pad.b;
      const min = 18, max = 70;
      const px = d => pad.l + (d / lastDay) * iw;
      const py = v => pad.t + ih - ((v - min) / (max - min)) * ih;

      ctx.strokeStyle = cs.getPropertyValue('--rule').trim();
      ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
      ctx.font = '10px ui-monospace, monospace';
      ctx.lineWidth = 1;
      for (const v of [20, 30, 40, 50, 60, 70]) {
        ctx.beginPath(); ctx.moveTo(pad.l, py(v)); ctx.lineTo(w - pad.r, py(v)); ctx.stroke();
        ctx.fillText(String(v), 8, py(v) + 3);
      }
      ctx.strokeStyle = cs.getPropertyValue('--danger').trim();
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(pad.l, py(60)); ctx.lineTo(w - pad.r, py(60)); ctx.stroke();
      ctx.setLineDash([]);

      const colours = [cs.getPropertyValue('--info').trim(), cs.getPropertyValue('--ok').trim(),
                       cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--ink-3').trim()];
      for (let bay = 1; bay <= RIG.bays; bay++) {
        if (showBay && showBay !== bay) continue;
        const vals = series(bay);
        ctx.strokeStyle = colours[bay - 1];
        ctx.lineWidth = bay === RIG.faultBay ? 2.4 : 1.4;
        ctx.globalAlpha = showBay || bay === RIG.faultBay ? 1 : .55;
        ctx.beginPath();
        vals.forEach((v, d) => (d ? ctx.lineTo(px(d), py(v)) : ctx.moveTo(px(d), py(v))));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = cs.getPropertyValue('--ink-3').trim();
      ctx.fillText('19 days ago', pad.l, hgt - 8);
      ctx.fillText('today', w - pad.r - 30, hgt - 8);
    }

    function paintBays() {
      const kids = [];
      for (let bay = 1; bay <= RIG.bays; bay++) {
        const vals = series(bay);
        const now = vals[vals.length - 1];
        const rise = now - vals[0];
        const level = now > 55 ? 'hot' : now > 40 ? 'warm' : '';
        kids.push(h('div.temp-bay', {
          role: 'button', tabindex: '0',
          onclick: () => { showBay = showBay === bay ? 0 : bay; draw(); paintBays(); },
          onkeydown: e => { if (e.key === 'Enter') { showBay = showBay === bay ? 0 : bay; draw(); paintBays(); } },
          style: showBay === bay ? { borderColor: 'var(--accent)' } : {}
        },
          h('span.small.mono', { style: { width: '3.5rem' } }, 'bay ' + bay),
          h('span.temp-bar', h('span.temp-fill' + (level ? '.' + level : ''), { style: { width: Math.min(100, (now / 70) * 100) + '%' } })),
          h('span.mono', { style: { width: '4.5rem', textAlign: 'right' } }, fmt(now, 1) + ' °C'),
          h('span.small', { style: { width: '5rem', textAlign: 'right', color: rise > 10 ? 'var(--danger)' : 'var(--ink-3)' } },
            (rise >= 0 ? '+' : '') + fmt(rise, 1))
        ));
      }
      mount(bays, ...kids);
    }

    function paintTable() {
      const rows = data.filter(r => r.day >= lastDay - 4).sort((a, b) => b.day - a.day || a.bay - b.bay);
      mount(table, h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--step--1)', fontFamily: 'var(--font-mono)' } },
        h('thead', h('tr', ...['date', 'bay', 'temp_c', 'state'].map(t =>
          h('th', { style: { textAlign: 'left', padding: '.3rem .6rem', borderBottom: '1px solid var(--rule)', position: 'sticky', top: '0', background: 'var(--surface-2)' } }, t)))),
        h('tbody', ...rows.map(r => h('tr',
          h('td', { style: { padding: '.25rem .6rem', color: 'var(--ink-3)' } }, isoDate(new Date(NOW.getTime() - (lastDay - r.day) * 86400000))),
          h('td', { style: { padding: '.25rem .6rem' } }, String(r.bay)),
          h('td', { style: { padding: '.25rem .6rem', color: r.tempC > 45 ? 'var(--danger)' : 'inherit' } }, r.tempC.toFixed(1)),
          h('td', { style: { padding: '.25rem .6rem', color: r.tempC > 30 ? 'var(--warn)' : 'var(--ink-3)' } }, r.tempC > 30 ? 'ABOVE_RANGE' : 'NOMINAL')
        )))
      ));
    }

    if (solved) queueMicrotask(() => resolveFinding('bay'));

    mount(root,
      canvas,
      h('div.grid-2',
        h('div.card',
          h('div.card-head', { style: { border: 0, padding: 0, marginBottom: '.75rem' } }, 'Channels'),
          bays,
          liveNote('ds18b20 1-4 → thermal.bay')
        ),
        solved
          ? h('div.card', { style: { borderColor: 'var(--accent)' } },
              h('h3', 'Bay ' + RIG.faultBay),
              h('p.small', `Your parser found it. Bay ${RIG.faultBay} has risen ${fmt(bayTemp(19) - bayTemp(0), 1)} degrees in nineteen days and is now at ${fmt(bayTemp(19), 1)} °C.`),
              h('p.small.dim', { style: { marginBottom: 0 } }, 'Storage range for the pack is 18 to 30. The separator starts breaking down at 60.'))
          : h('div.card', { style: { borderColor: 'var(--warn)' } },
              h('h3', 'Four channels, no summary'),
              h('p.small', 'The log records every reading and works out nothing. There is a findFailingBay function in this file that returns null and always has.'),
              h('a.btn.btn-primary', { href: '#/lab/parse' }, 'Open the editor'))
      ),
      h('div.card.flush',
        h('div.card-head', 'Last five days', h('span.spacer'), h('span.small.dim.mono', 'sensors.csv')),
        table
      )
    );
    paintBays(); paintTable();
    requestAnimationFrame(draw);
    addEventListener('resize', draw);
    return () => removeEventListener('resize', draw);
  }
};
