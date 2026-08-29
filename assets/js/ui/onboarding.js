/* The notice shown once, before anything else.

   It has two jobs. It tells the player who they are, because a story that
   never says that leaves people wandering around a portfolio. It also warns
   them honestly about the three moments where the app is deliberately sudden,
   because promising a quiet game and then flashing the screen is a bad thing
   to do to somebody. */

import { h } from '../core/dom.js';
import { modal } from '../core/notify.js';
import { get, update, setting, applyDocumentAttributes } from '../core/state.js';
import { seed } from '../core/tasks.js';
import { LEFTOVER, leftoverNote } from '../story/beats.js';
import { ANCHORS, daysSince } from '../story/cast.js';

function seedLeftovers() {
  seed(LEFTOVER.map(item => ({
    text: item.text,
    source: 'leftover',
    note: leftoverNote(),
    by: item.who.name,
    createdAt: ANCHORS.lastHuman.toISOString()
  })));
}

export function maybeShowNotice(done) {
  if (get().noticeAccepted) { seedLeftovers(); done(); return; }

  const soundBox = h('input', { type: 'checkbox', checked: true });
  const calmBox = h('input', { type: 'checkbox' });
  const days = daysSince(ANCHORS.lastHuman);
  const years = Math.floor(days / 365);

  const option = (box, label) => h('label', {
    style: { display: 'flex', alignItems: 'flex-start', gap: '.6rem', cursor: 'pointer', marginTop: '.75rem' }
  }, h('span', { style: { flex: 'none', paddingTop: '.15rem' } }, box), h('span.small', label));

  const body = h('div',
    h('p', { style: { fontWeight: '600' } },
      'Hello World is a to-do list. This copy has been running on a machine in a university lab for '
      + (years >= 1 ? `${years} years` : `${days} days`)
      + ', and you are the first person to open it in all that time.'),
    h('p', 'Three students built it and used it, and then they finished their degrees and stopped logging in. Their tasks are still on the list. So is the toolbox of small programs they wrote, and everything those programs were wired to.'),
    h('p', 'Something on the other end of this list is still running, and it can write to your tasks. It can also read them. Type into the task box and it will answer you. That is how most of this game is played, and it needs nothing from you except sentences.'),
    h('div.card', { style: { borderColor: 'var(--warn)', marginTop: '1.25rem' } },
      h('div.small.lbl', { style: { marginBottom: '.35rem' } }, 'Before you agree'),
      h('p.small', { style: { marginBottom: '.5rem' } },
        'There is no gore and nothing that pretends your computer is broken. There is a slow build of sound and colour, and there are three moments where the app is deliberately sudden: the screen cuts out once, it flashes once, and your list empties itself once and gives everything back two seconds later.'),
      h('p.small', { style: { marginBottom: 0 } },
        'The story involves an accident at a university and a system that has been left running far too long. Calm mode removes all three sudden moments and keeps the whole story.')
    ),
    h('p.small.muted', { style: { marginTop: '1rem' } },
      'Everything is stored in your browser. Nothing is uploaded, and there is no account.'),
    option(soundBox, 'Sound on. The bench has a fan and a relay, and both of them are part of how this reads.'),
    option(calmBox, 'Calm mode. Keeps the whole story and every puzzle, and turns off all sound, flashing, and screen effects.')
  );

  modal({
    title: 'Before you start',
    body,
    wide: true,
    dismissable: false,
    actions: [{
      label: 'Open the list',
      primary: true,
      onClick: () => {
        if (calmBox.checked) setting('calm', true);
        setting('sound', soundBox.checked && !calmBox.checked);
        update(s => { s.noticeAccepted = true; return s; });
        applyDocumentAttributes();
        seedLeftovers();
        done();
      }
    }]
  });
}
