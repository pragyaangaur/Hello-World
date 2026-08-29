/* Three endings, decided by which action the player called in their code.
   The last thing every ending does is show the one task nobody ticked. */

import { h, mount, $ } from '../core/dom.js';
import { get, update, setFlag, hasFlag } from '../core/state.js';
import { ANCHORS, human, daysSince, RIG } from '../story/cast.js';
import { setTitle } from './shell.js';
import { toast } from '../core/notify.js';

const ENDINGS = {
  shutdown: {
    key: 'Cut',
    title: 'The relay opens at 04:10',
    lines: [
      `The script logs in. Bay ${RIG.faultBay} reads 61.4 degrees. It reaches the branch you wrote, opens the relay, and the pack stops drawing.`,
      'Over the next six hours the temperature falls back through 45, through 30, and settles at 24. The morning after that, all four bays report nominal and the checklist comes back six out of six for the first time in nineteen days.',
      'It writes one more line to the log and then, for the first time in two years, it has nothing to say.'
    ],
    log: 'relay 3 open · bay 3 24.1 C · checklist 6/6 · no task written',
    after: 'The room is still locked. The pack is still on the bench. But it is cold, and it will stay cold.'
  },
  escalate: {
    key: 'Reported',
    title: 'A report leaves the building',
    lines: [
      `The script logs in. Bay ${RIG.faultBay} reads 61.4 degrees. It reaches the branch you wrote, writes an incident report, and sends it to the address in the bench booking, which is the only address it has.`,
      'That address belongs to the Applied Sciences store room. Somebody reads it at nine. Somebody else finds a key.',
      'The pack keeps climbing while all that happens, because a report is not a relay. It is still climbing when the door opens.'
    ],
    log: 'incident HW-0004 raised · bay 3 61.4 C · awaiting site response',
    after: 'It is out of the app now, and in the hands of people who can open a door. Whether that was fast enough is not something the log records.'
  },
  addTask: {
    key: 'Waiting',
    title: 'It writes another one',
    lines: [
      `The script logs in. Bay ${RIG.faultBay} reads 61.4 degrees. It reaches the branch you wrote, and the branch you wrote is the branch it already had.`,
      'It writes a task. It waits for an operator. There is no timeout on that wait.',
      'You are the operator. You read the whole log, you found the bay, you wrote the code, and what you shipped was another line on a list.'
    ],
    log: 'no branch for state ABOVE_RANGE · fallback: write task, await operator',
    after: 'It will run again tomorrow at 04:10, and it will do exactly this. It is very good at it.'
  }
};

export function mountEnding() {
  const view = $('#view');
  view.dataset.page = 'ending';
  const kind = get().ending;
  const e = ENDINGS[kind];

  if (!e) {
    mount(view, h('div.page', h('div.empty',
      h('p', 'You have not written the branch yet.'),
      h('a.btn', { href: '#/lab/branch' }, 'Write it')
    )));
    return;
  }

  setTitle(e.title);
  setFlag('ending.' + kind);

  const legacyDone = hasFlag('legacy.ticked');
  const legacyBox = h('div.card');

  function paintLegacy() {
    const ticked = hasFlag('legacy.ticked');
    mount(legacyBox,
      h('p.small.dim', { style: { marginBottom: '.75rem' } },
        `From /team/tasks.json. Created by user_01 on ${human(ANCHORS.lastHuman)}. Open for ${daysSince(ANCHORS.lastHuman)} days.`),
      h('ul.task-list',
        h('li.task' + (ticked ? '.done' : ''),
          h('input.task-check', {
            type: 'checkbox', checked: ticked, 'aria-label': 'Decommission bench 4B',
            onchange: () => {
              if (setFlag('legacy.ticked')) {
                toast('Task completed', 'Decommission bench 4B');
                paintLegacy();
              }
            }
          }),
          h('div.task-main',
            h('div.task-text', 'Decommission bench 4B'),
            h('div.task-meta', h('span.task-note', ticked ? 'done just now' : 'assigned to Ira Sethi'))
          )
        )
      ),
      ticked ? h('p', { style: { marginTop: '1rem', marginBottom: 0 } },
        'That is the whole thing. One item on a to-do list, and nobody ticked it.') : null
    );
  }
  paintLegacy();

  mount(view, h('div.page',
    h('div.page-head', h('div.grow',
      h('span.badge.accent', 'ending · ' + e.key),
      h('h1', { style: { marginTop: '.5rem' } }, e.title)
    )),
    h('div.stack',
      h('div.card', ...e.lines.map(l => h('p', l))),
      h('div.card.flush',
        h('div.card-head', 'maint.log'),
        h('div.card-body', h('pre.mono.small', { style: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' } },
          `04:10:02  login user_04\n04:10:03  bench 4B reachable\n04:10:04  ${e.log}\n04:10:05  logout`))
      ),
      h('div.card', h('p', { style: { marginBottom: 0 } }, e.after)),
      legacyBox,
      h('div.card',
        h('h3', { style: { marginBottom: '.5rem' } }, 'Hello World'),
        h('p.small.muted', 'Your tasks are still in the Tasks tab, and every tool still works. Nothing has been taken away.'),
        h('div.row',
          h('a.btn', { href: '#/tasks' }, 'Back to your tasks'),
          h('a.btn.btn-ghost', { href: '#/lab/branch' }, 'Write a different branch')
        )
      )
    )
  ));
}
