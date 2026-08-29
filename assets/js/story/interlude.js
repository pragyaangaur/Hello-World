/* The scene the app shows when a chapter turns over. This is the only place
   the story speaks to the player directly, and there are five of them in the
   whole game, so each one has to say where the player now stands and what
   just changed. */

import { h } from '../core/dom.js';
import { modal } from '../core/notify.js';
import { get } from '../core/state.js';
import { CHAPTERS } from './beats.js';
import { registry } from '../modules/index.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty'];

/* How many tools this chapter just made visible. Counting it here means the
   beat stays true if a tool is ever moved between chapters. */
function unlockedAt(n) {
  const count = registry.filter(tool => tool.chapter === n).length;
  const word = WORDS[count] || String(count);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function showBeat(n, onClose) {
  const chapterBeat = CHAPTERS[n];
  const beat = chapterBeat && chapterBeat.beat;
  if (!beat) { if (onClose) onClose(); return; }

  const body = h('div',
    h('p.small.mono.dim', { style: { marginBottom: '1rem' } }, `step ${n + 1} of 6 · ${chapterBeat.name}`),
    ...beat.lines.map(line => h('p', line.replace('{unlocked}', unlockedAt(n)))),
    h('div.card', { style: { marginTop: '1.25rem', borderColor: 'var(--accent)' } },
      h('div.small.lbl', { style: { marginBottom: '.35rem' } }, 'What to do next'),
      h('p', { style: { margin: 0 } }, chapterBeat.goal)
    )
  );

  /* Calm mode turns off motion everywhere else in the app, so the beat should
     not slide in either. The words are the same in both modes. */
  const delay = get().settings.calm ? 0 : 420;

  setTimeout(() => {
    modal({
      title: beat.title,
      body,
      wide: true,
      dismissable: true,
      actions: [{ label: 'Continue', primary: true, onClick: () => { if (onClose) onClose(); } }]
    });
  }, delay);
}
