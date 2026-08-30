/* Bench 4B, as a page.

   This is where the story lives for anybody who does not want to read it.
   Four bays drawn to scale, nineteen days of readings as a line, and the
   handful of numbers that explain the whole situation. A player who opens
   this once understands the problem without a single paragraph: three flat
   lines, one that leaves them, and a limit it has already gone past. */

import { h, mount, $ } from '../core/dom.js';
import { chapter } from '../core/state.js';
import { setTitle } from './shell.js';
import { bench, bayTemp, level, VENT_C, CEILING_C, NOMINAL_C } from '../story/rig.js';
import { RIG, PEOPLE, ANCHORS, daysSince, readings } from '../story/cast.js';

/* Nineteen days, four bays, one of which stops behaving like the others. */
function chart() {
  const W = 640, H = 220, PAD = 28;
  const rows = readings();
  const days = 19;
  const maxT = VENT_C + 6;
  const minT = 20;
  const x = d => PAD + (d / days) * (W - PAD * 2);
  const y = t => H - PAD - ((t - minT) / (maxT - minT)) * (H - PAD * 2);

  const live = bayTemp();
  const lines = [1, 2, 3, 4].map(bay => {
    const hot = bay === RIG.faultBay;
    const pts = rows.filter(r => r.bay === bay)
      .map(r => `${x(r.day).toFixed(1)},${y(hot && r.day === days ? live : r.tempC).toFixed(1)}`);
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${hot ? 'var(--danger)' : 'var(--ink-3)'}" stroke-width="${hot ? 2.4 : 1.2}" opacity="${hot ? 1 : .5}" stroke-linejoin="round"/>`;
  }).join('');

  /* The end of the red line is not a data point. It is where it is now. */
  const nowDot = `<circle cx="${x(days).toFixed(1)}" cy="${y(live).toFixed(1)}" r="4" fill="var(--danger)"/>`;

  const rule = (t, label, colour) => `
    <line x1="${PAD}" x2="${W - PAD}" y1="${y(t)}" y2="${y(t)}" stroke="${colour}" stroke-width="1" stroke-dasharray="4 4" opacity=".7"/>
    <text x="${PAD + 4}" y="${y(t) - 5}" font-size="10" fill="${colour}" font-family="var(--font-mono)">${label}</text>`;

  return h('div.chart-wrap', {
    html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Nineteen days of bay temperatures. Bays one, two and four are flat near twenty four degrees. Bay three climbs past sixty.">
      ${rule(VENT_C, 'vent ' + VENT_C + '°C', 'var(--danger)')}
      ${rule(CEILING_C, 'script limit ' + CEILING_C + '°C', 'var(--warn)')}
      ${lines}
      ${nowDot}
      <text x="${PAD}" y="${H - 8}" font-size="10" fill="var(--ink-3)" font-family="var(--font-mono)">19 days ago</text>
      <text x="${W - PAD}" y="${H - 8}" text-anchor="end" font-size="10" fill="var(--ink-3)" font-family="var(--font-mono)">today</text>
    </svg>`
  });
}

export function mountBench() {
  const view = $('#view');
  view.dataset.page = 'bench';
  setTitle('Bench 4B');

  const t = bayTemp();
  const lvl = level(t);
  const gone = daysSince(ANCHORS.lastHuman);
  const since = daysSince(ANCHORS.anomaly);

  const rows = [
    ['room', RIG.room + ' · ' + RIG.building.split(',')[0]],
    ['rig', RIG.name],
    ['controller', '10.14.4.62:8140'],
    ['script', 'maint.py · runs 04:10 daily · written by ' + PEOPLE.user_02.id],
    ['limit in script', CEILING_C + ' °C'],
    ['cells vent at', chapter() >= 6 ? VENT_C + ' °C' : 'not converted'],
    ['last human login', gone + ' days ago'],
    ['above range for', since + ' days'],
    ['door', 'locked · key with facilities']
  ];

  mount(view, h('div.page.wide',
    h('div.page-head', h('div.grow',
      h('h1', 'Bench 4B'),
      h('p', 'What the controller is reading right now.'))),

    h('div.bench-hero', { dataset: { level: lvl } },
      bench(),
      h('div.bench-side',
        h('div.bench-big', t.toFixed(1), h('span', '°C')),
        h('div.bench-tag', lvl === 'vent' ? 'past the vent limit'
          : lvl === 'hot' ? 'above the script limit' : 'above range'),
        h('div.bench-vs',
          h('span', 'the other three'),
          h('strong', NOMINAL_C.toFixed(1) + ' °C')))
    ),

    h('div.card.flush', { style: { marginTop: 'var(--sp-4)' } },
      h('div.card-head', 'bay temperatures · last 19 days',
        h('span.spacer'), h('span.small.dim.mono', 'ds18b20 1-4 · 04:10 daily')),
      h('div.card-body', chart())
    ),

    h('div.card', { style: { marginTop: 'var(--sp-4)' } },
      h('dl.kv.kv-wide', ...rows.flatMap(([k, v]) => [h('dt', k), h('dd', v)]))
    )
  ));
}
