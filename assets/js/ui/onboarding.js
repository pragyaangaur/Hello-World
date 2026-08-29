/* The notice shown once, before anything else. It is honest about what the
   app is, because a person should be able to opt out before they start. */

import { h } from '../core/dom.js';
import { modal } from '../core/notify.js';
import { get, update, setting, applyDocumentAttributes } from '../core/state.js';
import { seedSamples } from '../core/tasks.js';

export function maybeShowNotice(done) {
  if (get().noticeAccepted) { seedSamples(); done(); return; }

  const calmBox = h('input', { type: 'checkbox' });

  const body = h('div',
    h('p', 'Hello World is a to-do list. It also carries a toolbox of small projects, and a story that unfolds through them as you use the app.'),
    h('p', 'The story is a quiet one. There is no gore, no jump scare, and nothing that pretends your computer has a problem. It does involve an accident at a university and a system that has been left running too long.'),
    h('p.small.muted', 'Everything is stored in your browser. Nothing is uploaded, and there is no account.'),
    h('label', { style: { display: 'flex', alignItems: 'flex-start', gap: '.6rem', cursor: 'pointer', marginTop: '1.25rem' } },
      h('span', { style: { flex: 'none', paddingTop: '.15rem' } }, calmBox),
      h('span.small', 'Start in calm mode. Keeps the whole story, turns off every visual effect and sound.')
    )
  );

  modal({
    title: 'Before you start',
    body,
    dismissable: false,
    actions: [{
      label: 'Start',
      primary: true,
      onClick: () => {
        if (calmBox.checked) setting('calm', true);
        update(s => { s.noticeAccepted = true; return s; });
        applyDocumentAttributes();
        seedSamples();
        done();
      }
    }]
  });
}
