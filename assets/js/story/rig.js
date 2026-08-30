/* The picture of the thing that is going wrong.

   Every other file in the story tells you about bench 4B in words. This one
   draws it, because a bar creeping toward a red line says more in half a
   second than three paragraphs say in thirty. Everything the player needs to
   understand the stakes is in here: four bays, one of them hot, and a limit
   it is heading for. */

import { h } from '../core/dom.js';
import { RIG, liveTemp } from './cast.js';

export const VENT_C = 60;          /* where the separator fails             */
export const NOMINAL_C = 24;       /* where the other three bays sit        */
export const CEILING_C = 45;       /* the wrong limit somebody typed in     */
export const LAST = 7;

/* Bay 3 climbs as the game does, so the picture is never the same twice and
   the player can feel the clock without being told there is one. The number
   itself lives with the rest of the rig's physics, in cast.js. */
export function bayTemp() { return liveTemp(); }

export function bayTemps() {
  const hot = bayTemp();
  return [23.9, 24.6, 24.1, 24.2].map((t, i) => (i === RIG.faultBay - 1 ? hot : t));
}

export function level(t) {
  if (t >= VENT_C) return 'vent';
  if (t >= CEILING_C) return 'hot';
  if (t >= 35) return 'warm';
  return 'ok';
}

/* ---- the bench, drawn ---------------------------------------------------
   Four cells in a row. The hot one fills from the bottom and the fill is the
   only thing on the page that moves on its own. */
export function bench({ compact = false, showLimit = true } = {}) {
  const temps = bayTemps();
  const hot = temps[RIG.faultBay - 1];

  const cells = temps.map((t, i) => {
    const n = i + 1;
    const fill = Math.max(0, Math.min(1, (t - 18) / (VENT_C + 8 - 18)));
    return h('div.bay' + (n === RIG.faultBay ? '.bay-hot' : ''), { dataset: { level: level(t) } },
      h('div.bay-fill', { style: { height: (fill * 100).toFixed(1) + '%' } }),
      h('div.bay-num', String(n)),
      h('div.bay-temp', t.toFixed(1))
    );
  });

  return h('div.bench' + (compact ? '.bench-compact' : ''),
    h('div.bench-rack',
      showLimit ? h('div.bench-limit', {
        style: { bottom: (((VENT_C - 18) / (VENT_C + 8 - 18)) * 100).toFixed(1) + '%' }
      }, h('span', 'vent ' + VENT_C + '°C')) : null,
      ...cells
    ),
    compact ? null : h('div.bench-foot',
      h('span', RIG.room + ' · cell bank B'),
      h('span.bench-read', { dataset: { level: level(hot) } }, 'bay 3 · ' + hot.toFixed(1) + ' °C')
    )
  );
}

/* One enormous character or number. The whole point of a beat is that the
   player takes one thing away from it, so the beat shows one thing. */
export function glyph(text, tone = '') {
  return h('div.glyph' + (tone ? '.' + tone : ''), String(text));
}

/* A row of small facts, which is how a person actually reads a status page. */
export function facts(pairs) {
  return h('div.factrow', ...pairs.map(([k, v]) =>
    h('div.fact', h('span.fact-k', k), h('span.fact-v', v))));
}

/* The bar in the sidebar. It is always there from the moment the player
   knows something is wrong, and it never stops climbing. */
export function benchChip() {
  const t = bayTemp();
  const lvl = level(t);
  const pct = Math.max(0, Math.min(1, (t - 18) / (VENT_C + 8 - 18)));
  return h('a.bench-chip', { href: '#/bench', dataset: { level: lvl } },
    h('span.bc-top',
      h('span.bc-name', 'bench 4B'),
      h('span.bc-temp', t.toFixed(1) + '°')),
    h('span.bc-bar', h('span', { style: { width: (pct * 100).toFixed(1) + '%' } })),
    h('span.bc-sub', lvl === 'vent' ? 'past the vent limit'
      : lvl === 'hot' ? 'above range · climbing'
      : 'bay 3 · climbing')
  );
}
