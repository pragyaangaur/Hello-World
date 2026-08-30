/* The ending.

   The old one stopped on a red screen and left people unsure whether the game
   had finished or crashed. This one finishes properly. The room lets go first
   (settle drains the tint, the grain and the fan), then the outcome, then a
   card that says the game is over in as many words, and then the door back to
   the Toolbox, which by that point is a plain green app again. */

import { h, mount, $ } from '../core/dom.js';
import { get, setFlag, hasFlag } from '../core/state.js';
import { ANCHORS, human, daysSince, RIG, PEOPLE } from '../story/cast.js';
import { setTitle } from './shell.js';
import { toast } from '../core/notify.js';
import { settle } from '../story/atmosphere.js';

const ENDINGS = {
  shutdown: {
    key: 'Cut',
    mark: '✓',
    tone: 'good',
    title: 'The relay opens at 04:10',
    lines: [
      `Four letters go down the wire. The controller matches them and throws the relay on bay ${RIG.faultBay}. The pack stops drawing.`,
      'By morning it reads 24.1 and all four bays are nominal for the first time in nineteen days.',
      'It writes one more line to the log, and then it has nothing left to say.'
    ],
    log: 'relay 3 open · bay 3 24.1 C · checklist 6/6 · no task written',
    after: 'The room is still locked and the pack is still on the bench. But it is cold, and it will stay cold.',
    final: [24.1, 'bay 3 · cold']
  },
  escalate: {
    key: 'Reported',
    mark: '!',
    tone: 'warn',
    title: 'A report leaves the building',
    lines: [
      'You sent it its own word back. It reads that as a confirmed alarm and files the incident report it has not been able to justify for nineteen days.',
      'It goes to the only address on the bench booking, which belongs to a store room. Somebody reads it at nine. Somebody else finds a key.',
      'The pack keeps climbing the whole time, because a report is not a relay.'
    ],
    log: 'incident HW-0004 raised · bay 3 61.4 C · awaiting site response',
    after: 'It is out of the app now and in the hands of people who can open a door. Whether that was fast enough is not something the log records.',
    final: [61.4, 'bay 3 · still climbing']
  },
  addTask: {
    key: 'Waiting',
    mark: '…',
    tone: 'bad',
    title: 'It writes another one',
    lines: [
      'The controller reads the pattern, finds nothing it recognises, and falls back to the only thing it knows how to do.',
      'It writes a task. It waits for an operator. There is no timeout on that wait.',
      'You were the operator. You opened the cabinet and you found the number nobody converted, and then you sent it a word it could not read.'
    ],
    log: 'no branch for state ABOVE_RANGE · fallback: write task, await operator',
    after: 'It will run again tomorrow at 04:10 and do exactly this. It is very good at it.',
    final: [63.2, 'bay 3 · above range']
  }
};

export function mountEnding() {
  const view = $('#view');
  view.dataset.page = 'ending';
  const kind = get().ending;
  const e = ENDINGS[kind];

  if (!e) {
    mount(view, h('div.page', h('div.empty',
      h('p', 'You have not sent anything to the bench yet.'),
      h('a.btn', { href: '#/tools/led' }, 'Open the indicator')
    )));
    return;
  }

  setTitle(e.title);
  setFlag('ending.' + kind);
  setFlag('story.settled');
  settle();

  const legacyBox = h('div.card');

  /* The one task nobody ticked. It is the last thing the game shows, and it
     is still a checkbox, because that is what the whole thing has been. */
  function paintLegacy() {
    const ticked = hasFlag('legacy.ticked');
    mount(legacyBox,
      h('p.small.dim', { style: { marginBottom: '.75rem' } },
        `From /team/tasks.json · opened by ${PEOPLE.user_01.id} on ${human(ANCHORS.lastHuman)} · open for ${daysSince(ANCHORS.lastHuman)} days`),
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
            h('div.task-meta', h('span.task-note', ticked ? 'done just now' : 'assigned to ' + PEOPLE.user_01.name))
          )
        )
      ),
      ticked ? h('p', { style: { marginTop: '1rem', marginBottom: 0 } },
        'That is the whole thing. One item on a to-do list, and nobody ticked it.') : null
    );
  }
  paintLegacy();

  mount(view, h('div.page',
    h('div.end-hero.end-' + e.tone,
      h('div.end-mark', e.mark),
      h('span.badge', 'ending · ' + e.key),
      h('h1', e.title),
      h('div.end-final',
        h('span.end-temp', e.final[0].toFixed(1) + ' °C'),
        h('span.end-temp-sub', e.final[1]))
    ),
    h('div.stack',
      h('div.card', ...e.lines.map(l => h('p', l))),
      h('div.card.flush',
        h('div.card-head', 'maint.log'),
        h('div.card-body', h('pre.mono.small', { style: { margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ink-2)' } },
          `04:10:02  login user_04\n04:10:03  bench 4B reachable\n04:10:04  ${e.log}\n04:10:05  logout`))
      ),
      h('div.card', h('p', { style: { marginBottom: 0 } }, e.after)),
      legacyBox,

      /* The full stop. Nothing after this point is story. */
      h('div.end-card',
        h('div.end-rule'),
        h('div.end-word', 'The End'),
        h('p.end-sub', 'Hello World · a to-do list, and one other thing'),
        h('div.end-rule')
      ),

      h('div.card.end-back',
        h('h3', 'It is just a toolbox again'),
        h('p.small.muted', 'The lights are back on. Every tool still works, your tasks are still in the Tasks tab, and nothing has been taken away.'),
        h('div.row',
          h('a.btn.btn-primary', { href: '#/tools' }, 'Back to the Toolbox'),
          h('a.btn', { href: '#/tasks' }, 'My tasks'),
          h('a.btn.btn-ghost', { href: '#/tools/led' }, 'Send a different word')
        )
      )
    )
  ));
}
