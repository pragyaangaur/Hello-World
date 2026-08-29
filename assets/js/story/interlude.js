/* The scene the app shows when an act turns over. This is the only place the
   story speaks to the player in full sentences, and there are five of them in
   the whole game, so each one has to say what just happened and what to do
   next. The goal is repeated at the bottom because a player who reads nothing
   else will read that. */

import { h } from '../core/dom.js';
import { modal } from '../core/notify.js';
import { get } from '../core/state.js';
import { CHAPTERS } from './beats.js';

export function showBeat(n, onClose) {
  const act = CHAPTERS[n];
  const beat = act && act.beat;
  if (!beat) { if (onClose) onClose(); return; }

  const body = h('div',
    h('p.small.mono.dim', { style: { marginBottom: '1rem' } }, `step ${n + 1} of 6 · ${act.name}`),
    ...beat.lines.map(line => h('p', line)),
    h('div.card', { style: { marginTop: '1.25rem', borderColor: 'var(--accent)' } },
      h('div.small.lbl', { style: { marginBottom: '.35rem' } }, 'What to do next'),
      h('p', { style: { margin: 0 } }, act.goal),
      act.hint ? h('p.small.dim', { style: { margin: '.5rem 0 0' } }, act.hint) : null
    )
  );

  /* Calm mode turns off motion everywhere else, so the scene should not slide
     in either. The words are the same in both modes. */
  const delay = get().settings.calm ? 0 : 420;

  setTimeout(() => {
    /* A scene should never open below the fold on a long task list. */
    window.scrollTo({ top: 0, behavior: get().settings.calm ? 'auto' : 'smooth' });
    modal({
      title: beat.title,
      body,
      wide: true,
      dismissable: true,
      actions: [{ label: 'Continue', primary: true, onClick: () => { if (onClose) onClose(); } }]
    });
  }, delay);
}
