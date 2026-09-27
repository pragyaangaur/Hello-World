/* The line at the bottom of a tool that says where its numbers come from.
   In chapter 2 it is a dim technical footnote nobody would question. From
   chapter 3 it is the same line with a status dot next to it. */

import { h } from '../core/dom.js';
import { chapter } from '../core/state.js';
import { liveTemp } from './cast.js';

export function liveNote(binding, { reveal = null, value = null } = {}) {
  const ch = chapter();
  if (ch < 1) return null;

  /* From the moment the toolbox opens, every tool quietly says where its
     numbers come from. It reads as a technical footnote until the player has
     seen it on four different tools, which is the point. */
  if (ch < 3) {
    return h('div.live-note', `source: bench 4B · ${binding} · last read 04:10`);
  }

  const temp = liveTemp();
  const level = temp > 55 ? 'hot' : temp > 40 ? 'warn' : '';
  return h('div.live-note',
    h('span.live-dot' + (level ? '.' + level : '')),
    `live · bench 4B · ${binding}${value ? ' · ' + value : ''} · controller 10.14.4.62:8140`
  );
}

/* Every tool used to carry its own version of "somebody was here before you".
   They all say it in one place now, under the tool, in the same shape. This
   stays as a no-op so a tool that still asks for it gets nothing extra. */
export function lastUsed() { return null; }
