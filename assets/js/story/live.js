/* The line at the bottom of a tool that says where its numbers come from.
   In chapter 2 it is a dim technical footnote nobody would question. From
   chapter 3 it is the same line with a status dot next to it. */

import { h } from '../core/dom.js';
import { chapter } from '../core/state.js';
import { RIG, bayTemp } from './cast.js';
import { resolveFinding } from './engine.js';

export function liveNote(binding, { reveal = null, value = null } = {}) {
  const ch = chapter();
  if (ch < 1) return null;

  /* From the moment the toolbox opens, every tool quietly says where its
     numbers come from. It reads as a technical footnote until the player has
     seen it on four different tools, which is the point. */
  if (ch < 3) {
    return h('div.live-note', `source: bench 4B · ${binding} · last read 04:10`);
  }

  if (reveal) queueMicrotask(() => resolveFinding(reveal));

  const temp = bayTemp(19);
  const level = temp > 55 ? 'hot' : temp > 40 ? 'warn' : '';
  return h('div.live-note',
    h('span.live-dot' + (level ? '.' + level : '')),
    `live · bench 4B · ${binding}${value ? ' · ' + value : ''} · controller 10.14.4.62:8140`
  );
}

/* A saved state note: this tool was last used by the script, not by you. */
export function lastUsed() {
  if (chapter() < 1) return null;
  return h('p.small.dim', { style: { marginTop: '.25rem' } },
    'Settings restored from the last session · user_04 · 04:10 today');
}

export function bayStatus() {
  const t = bayTemp(19);
  return { temp: t, level: t > 55 ? 'hot' : t > 40 ? 'warm' : '', bay: RIG.faultBay };
}
