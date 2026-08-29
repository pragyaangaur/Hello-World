/* The account panel. In early chapters it is an ordinary "you are signed in
   locally" box. Later it is the first place the fourth account is visible,
   and it is the hook the whole story hangs on. */

import { h } from '../core/dom.js';
import { chapter, hasFlag, setFlag } from '../core/state.js';
import { PEOPLE, human, daysSince, ANCHORS } from './cast.js';

export function accountCard() {
  const ch = chapter();

  if (ch < 2) {
    return h('div',
      h('p', 'You are signed in locally. Hello World does not have accounts on a server, so there is nothing to log into and nothing to lose.'),
      h('p.small.muted', 'Your tasks live in this browser only.')
    );
  }

  setFlag('accounts.seen');

  const rows = Object.values(PEOPLE).map(p => {
    const stale = daysSince(p.last) > 90;
    const isFour = p.id === 'user_04';
    return h('div.setting',
      h('div.s-main',
        h('div.s-name', { style: isFour ? { fontFamily: 'var(--font-mono)' } : {} }, p.name),
        h('div.s-desc', p.role)
      ),
      h('span.badge' + (isFour ? '.accent' : ''), stale && !isFour ? 'inactive' : isFour ? 'active' : 'inactive')
    );
  });

  return h('div',
    h('p', 'This build carries the accounts it was tested with. They are stored in the app file itself and cannot sign in from here.'),
    h('div.card.flush', { style: { marginTop: '1rem' } },
      h('div.card-head', 'Accounts in this build'),
      h('div.card-body', { style: { paddingTop: 0, paddingBottom: 0 } }, ...rows)
    ),
    ch >= 3 ? h('p.small.muted', { style: { marginTop: '1rem' } },
      `Last activity on user_04: today. Last activity on every other account: ${human(ANCHORS.lastHuman)}.`
    ) : null,
    ch >= 3 ? h('p.small', { style: { marginTop: '.5rem', color: 'var(--warn)' } },
      'The team was three people.'
    ) : null
  );
}
