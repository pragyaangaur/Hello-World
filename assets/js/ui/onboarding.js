/* The notice shown once, before anything else. It is honest about what the
   app is, because a person should be able to opt out before they start. It
   is also the only place the game tells the player who they are, so the
   first screen of the story does the job the first screen of a story does. */

import { h } from '../core/dom.js';
import { modal } from '../core/notify.js';
import { get, update, setting, applyDocumentAttributes } from '../core/state.js';
import { seed } from '../core/tasks.js';
import { LEFTOVER, leftoverNote } from '../story/beats.js';
import { ANCHORS, daysSince } from '../story/cast.js';

/* The three tasks the last person to use this machine never got to. They are
   dated to the day that person stopped logging in. */
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

  const calmBox = h('input', { type: 'checkbox' });
  const years = Math.floor(daysSince(ANCHORS.lastHuman) / 365);

  const body = h('div',
    h('p', { style: { fontWeight: '600' } },
      'Hello World is a to-do list. This copy of it has been running on a machine in a university lab for '
      + (years >= 1 ? `${years} years` : `${daysSince(ANCHORS.lastHuman)} days`)
      + ', and you are the first person to open it in all that time.'),
    h('p', 'Three students built it and used it, and then they finished their degrees and stopped logging in. Their tasks are still on the list. So is the toolbox of small programs they wrote, and everything those programs were wired to.'),
    h('p', 'Your job is to work out what this machine has been doing on its own. The app will tell you what it needs at each step, so you never have to guess. Twice along the way you will write real code, and what you write is what the machine runs.'),
    h('p.small.muted', 'The story is a quiet one. There is no gore, no jump scare, and nothing that pretends your computer has a problem. It does involve an accident at a university and a system that has been left running too long.'),
    h('p.small.muted', 'Everything is stored in your browser. Nothing is uploaded, and there is no account.'),
    h('label', { style: { display: 'flex', alignItems: 'flex-start', gap: '.6rem', cursor: 'pointer', marginTop: '1.25rem' } },
      h('span', { style: { flex: 'none', paddingTop: '.15rem' } }, calmBox),
      h('span.small', 'Start in calm mode. Keeps the whole story, turns off every visual effect and sound.')
    )
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
        update(s => { s.noticeAccepted = true; return s; });
        applyDocumentAttributes();
        seedLeftovers();
        done();
      }
    }]
  });
}
