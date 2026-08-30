/* The scene the app shows when an act turns over.

   These used to be paragraphs. Now each one is a picture, one number, and at
   most two sentences, and it ends in a button that takes the player straight
   to the tool they need. Nobody has to work out what to do next, and nobody
   has to read anything to find out. */

import { h } from '../core/dom.js';
import { modal } from '../core/notify.js';
import { ACTS } from './acts.js';
import { bench, glyph, CEILING_C, bayTemp } from './rig.js';
import { PEOPLE, ANCHORS, daysSince } from './cast.js';
import { byId } from '../modules/index.js';
import { go } from '../core/router.js';

/* ---- the pictures ------------------------------------------------------- */

/* Nineteen mornings of a machine talking to an empty room. */
function backlogArt() {
  const rows = [
    ['19 days ago', 'bay 3 temp 45.6 C - above range'],
    ['13 days ago', 'bay 3 temp 46.7 C - above range'],
    ['10 days ago', 'no operator response in 9 days'],
    ['4 days ago', 'escalation path not configured'],
    ['2 days ago', 'is anyone reading this'],
    ['today', 'hello world']
  ];
  return h('div.art.art-log',
    ...rows.map(([when, what], i) =>
      h('div.art-row' + (i === rows.length - 1 ? '.art-row-now' : ''),
        h('span.art-when', when),
        h('span.art-what', what)))
  );
}

/* The light, blinking the word, at the speed it actually blinks. */
function blinkArt() {
  const pattern = '.... . .-.. .--.';
  const dots = h('div.art-morse', ...pattern.split('').map(c =>
    c === ' ' ? h('span.art-gap') : h('span.art-mark' + (c === '-' ? '.dash' : ''))));
  return h('div.art.art-blink',
    h('div.art-bulb'),
    dots,
    h('div.art-cap', 'gpio 17 · repeating since day one')
  );
}

/* The resistor taped to the cabinet door, exactly as the player will have to
   set it in the calculator. This is the whole of the puzzle, drawn. */
function resistorArt() {
  const bands = [['Red', '#c2312a'], ['Yellow', '#e0b820'], ['Brown', '#6b3f1d'], ['Gold', '#c8a44a']];
  return h('div.art.art-resistor',
    h('div.art-res',
      h('span.art-lead'),
      h('span.art-body',
        ...bands.map(([name, col]) => h('span.art-band', { style: { background: col }, title: name }))),
      h('span.art-lead')
    ),
    h('div.art-cap', bands.map(b => b[0]).join(' · ') + '  ·  taped to cabinet 4B')
  );
}

/* Four people. Three of them stopped. */
function peopleArt() {
  const gone = daysSince(ANCHORS.lastHuman);
  const cast = [PEOPLE.user_01, PEOPLE.user_02, PEOPLE.user_03];
  return h('div.art.art-people',
    ...cast.map(p => h('div.art-person' + (p.id === 'user_02' ? '.art-oncall' : ''),
      h('span.art-face', p.initials),
      h('span.art-name', p.name),
      h('span.art-when', p.id === 'user_02' ? 'on call · gone ' + gone + 'd' : 'gone ' + gone + 'd'))),
    h('div.art-person.art-you',
      h('span.art-face', '04'),
      h('span.art-name', 'user_04'),
      h('span.art-when', 'active now'))
  );
}

/* The line in the datasheet nobody converted, next to the bench that reads
   in the other unit. The mismatch is the whole point, so it is side by side. */
function datasheetArt() {
  return h('div.art.art-sheet',
    h('div.art-sheet-col',
      h('span.art-sheet-h', 'cell datasheet'),
      h('span.art-sheet-v', '140 °F'),
      h('span.art-sheet-s', 'separator failure')),
    h('div.art-sheet-vs', '≠'),
    h('div.art-sheet-col.art-sheet-live',
      h('span.art-sheet-h', 'bench 4B reads'),
      h('span.art-sheet-v', bayTemp().toFixed(1) + ' °C'),
      h('span.art-sheet-s', 'limit in script: ' + CEILING_C + ' °C'))
  );
}

const ART = {
  backlog: backlogArt,
  blink: blinkArt,
  resistor: resistorArt,
  people: peopleArt,
  datasheet: datasheetArt,
  bench: () => h('div.art.art-bench', bench())
};

/* ---- the scene ---------------------------------------------------------- */

export function showBeat(n, onClose) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const current = ACTS[n];
  const beat = current && current.beat;
  if (!beat) { if (onClose) onClose(); return; }

  const art = beat.show && ART[beat.show] ? ART[beat.show]() : null;

  const body = h('div.beat' + (beat.tone ? '.beat-' + beat.tone : ''),
    beat.glyph ? glyph(beat.glyph, beat.tone) : null,
    art,
    h('div.beat-words', ...beat.lines.map(line => h('p', line))),
    h('div.beat-cta',
      h('span.beat-step', `step ${n} of ${ACTS.length - 1}`),
      h('p.beat-do', beat.cta || current.goal))
  );

  /* The button is the point. It says the action and it goes straight there,
     so a player who reads none of the above still lands in the right tool. */
  const first = current.tools && current.tools[0];
  const tool = first ? byId(first) : null;
  const actions = [];
  if (tool) actions.push({
    label: 'Open ' + tool.name + '  →',
    primary: true,
    onClick: () => { if (onClose) onClose(); setTimeout(() => go('/tools/' + tool.id), 60); }
  });
  else actions.push({ label: 'Continue', primary: true, onClick: () => { if (onClose) onClose(); } });

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    modal({ title: beat.title, body, wide: true, dismissable: true, actions });
  }, 420);
}
