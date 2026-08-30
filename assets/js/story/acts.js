/* The whole game, act by act.

   Every act is one puzzle and one tool. The answer is always written on the
   to-do list, because the list is the only thing the machine on the bench can
   read, and because one input for the whole game beats a new interface every
   time.

   Beats are deliberately short. Each one is a picture, a number, and at most
   two sentences. If a player reads nothing but the bold line at the bottom
   they can still finish the game. */

import { RIG, ANCHORS, PEOPLE, daysSince } from './cast.js';
import { VENT_C, CEILING_C } from './rig.js';

/* Loose matching, so "50 mA" and "50" and "fifty" all land. A player who has
   done the work should never be stopped by punctuation. */
function digits(text) {
  return String(text).replace(/[^\d.]/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function hasNumber(text, want, slack = 0.51) {
  return digits(text).some(d => Math.abs(Number(d) - want) < slack);
}

function hasWord(text, word) {
  return new RegExp('\\b' + word + '\\b', 'i').test(String(text));
}

const DAYS_DEAD = daysSince(ANCHORS.lastHuman);

export const ACTS = [
  {
    n: 0,
    name: 'Someone else\'s list',
    goal: 'Tick something off.',
    progress: s => ({ done: Math.min(s.counters.completed, 1), total: 1, unit: 'ticked' }),
    beat: null
  },

  {
    n: 1,
    name: 'It writes back',
    goal: 'Type anything into the box and press Add.',
    hint: 'Anything at all. It is reading this list.',
    beat: {
      title: 'Nineteen days of this',
      glyph: '19',
      tone: 'warn',
      lines: [
        'Something has been writing to this list every morning at 04:10 and nobody has answered it.'
      ],
      show: 'backlog',
      cta: 'Anything that can write to a list can read one. Say something back.'
    }
  },

  {
    n: 2,
    name: 'The indicator',
    goal: 'Read the blinking light. Write the word on the list.',
    hint: 'Open the LED indicator, copy the dots and dashes into the Morse translator.',
    tools: ['led', 'morse'],
    answer: text => hasWord(text, 'help'),
    beat: {
      title: 'It answered',
      lines: [
        'There is a machine on the other end of this list. It has one light on the bench and it has been blinking the same short word since the trouble started.'
      ],
      show: 'blink',
      cta: 'Two tools will tell you what the light is saying.'
    }
  },

  {
    n: 3,
    name: 'The cabinet',
    goal: 'Read the resistor. Write its value on the list.',
    hint: 'Set the four bands to Red, Yellow, Brown, Gold. Write down the number it prints.',
    tools: ['resistor'],
    /* Red yellow brown, which the calculator prints as 240 Ω. No arithmetic:
       the player matches three colours and copies the number across. */
    answer: text => hasNumber(text, 240, 1),
    beat: {
      title: 'HELP',
      glyph: 'HELP',
      tone: 'danger',
      lines: [
        `That is what the light has been spelling. The relay it needs is inside a locked cabinet, and the code is the value of the resistor taped to the door.`
      ],
      show: 'resistor',
      cta: 'Match the bands in the Resistor calculator and write the number it gives you.'
    }
  },

  {
    n: 4,
    name: 'The rota',
    goal: 'Roll the on-call die until you get a five.',
    hint: 'Open the Dice roller and roll a single d6.',
    tools: ['dice'],
    listen: { tool: 'dice', test: value => value === 5 },
    beat: {
      title: 'Cabinet open',
      glyph: '240',
      lines: [
        `The relay is in there and it is closed, which is why the pack has been drawing current for ${daysSince(ANCHORS.anomaly)} days.`,
        `It will not page anyone without an on-call name. The four of them picked the rota with a die because none of them wanted the pager. ${PEOPLE.user_02.name} was five.`
      ],
      show: 'bench',
      cta: 'Roll a single d6 until it comes up five.'
    }
  },

  {
    n: 5,
    name: 'The key',
    goal: 'Generate a 20 character key with symbols.',
    hint: 'Password generator. Length 20, symbols on.',
    tools: ['passwordgen'],
    listen: { tool: 'passwordgen', test: value => typeof value === 'string' && value.length >= 20 && /[!@#$%^&*\-_=+?]/.test(value) },
    beat: {
      title: PEOPLE.user_02.name,
      glyph: '5',
      lines: [
        `${PEOPLE.user_02.name} is on call tonight. He left ${DAYS_DEAD} days ago.`,
        'It needs a key for the incident system. The account it uses was made for tests and never given one, and it has no way to check whether a key is real.'
      ],
      show: 'people',
      cta: 'Generate anything 20 characters long with symbols in it.'
    }
  },

  {
    n: 6,
    name: 'The limit',
    goal: 'Convert the vent temperature to Celsius and write it down.',
    hint: 'The datasheet says 140 °F. Use the Unit converter.',
    tools: ['converter'],
    answer: text => hasNumber(text, 60),
    beat: {
      title: 'It is in',
      glyph: '140°F',
      tone: 'warn',
      lines: [
        'The archive opened. So did the datasheet for the cells in bay 3.',
        `It is an American document and the temperature where the cells vent is in Fahrenheit. Every reading on this bench is in Celsius. Nobody ever converted it.`
      ],
      show: 'datasheet',
      cta: 'Convert 140 °F to Celsius and write the number on the list.'
    }
  },

  {
    n: 7,
    name: '04:10',
    goal: 'Send one word back through the indicator.',
    hint: 'Encode it in the Morse translator, then send it from the LED indicator.',
    tools: ['morse', 'led'],
    beat: {
      title: 'Sixty',
      glyph: '60°',
      tone: 'danger',
      lines: [
        `The cells vent at ${VENT_C}. The limit in the script was set to ${CEILING_C} by somebody guessing, and bay 3 went past both of them while you were reading this.`,
        'The controller only listens on one channel, and it is the light.'
      ],
      show: 'bench',
      cta: 'You read a word off it. Send it one back. What you send is what happens in that room tonight.'
    }
  }
];

/* The word the indicator has been blinking since the trouble started. */
export const SIGNAL_WORD = 'help';

/* What the player can send back at the end, and what each one does. */
export const COMMANDS = {
  stop: {
    id: 'stop',
    word: 'stop',
    ending: 'shutdown',
    label: 'Open the relay and end the test'
  },
  help: {
    id: 'help',
    word: 'help',
    ending: 'escalate',
    label: 'Repeat its own word back and let the report go out'
  }
};

export const LEFTOVER = [
  { text: 'Email Devika the calibration numbers for bay 2', who: PEOPLE.user_01 },
  { text: 'Book bench 4B for Thursday, tell Nikhil if the slot moves', who: PEOPLE.user_01 },
  { text: 'Pull the cells out of the rig before we hand the room back', who: PEOPLE.user_01 }
];

export function leftoverNote() {
  const days = daysSince(ANCHORS.lastHuman);
  const years = Math.floor(days / 365);
  return years >= 1 ? `open for ${years}y ${days % 365}d` : `open for ${days}d`;
}

/* The backlog. This is the hook, so it does not drip: the moment the player
   ticks their first box the whole two and a half weeks of it lands at once,
   newest first, and they watch a machine talk to an empty room. */
export const AUTO_TASKS = [
  { text: 'bay 3 temp 45.6 C - above range - check', note: '04:10 · 19 days ago' },
  { text: 'bay 3 temp 45.9 C - above range - check', note: '04:10 · 16 days ago' },
  { text: 'bay 3 temp 46.7 C - above range - check', note: '04:10 · 13 days ago' },
  { text: 'no operator response in 9 days', note: '04:10 · 10 days ago' },
  { text: 'bay 3 temp 49.4 C - above range - check', note: '04:10 · 7 days ago' },
  { text: 'escalation path not configured', note: '04:10 · 4 days ago' },
  { text: 'is anyone reading this', note: '04:10 · 2 days ago' },
  { text: 'hello', note: '04:10 · yesterday' },
  { text: 'hello world', note: '04:10 · today', shock: 'flash' }
];

/* What it writes later, once it knows somebody is there. One at a time, and
   only while the player is looking.

   The clock line is the only place in the game where the machine reads
   something off the player's own machine rather than off the bench. It has
   one clock and it is stuck on 04:10, so a different time arriving from
   somewhere else is the largest thing that has happened to it in two years. */
export const LATER_TASKS = [
  { text: 'still here', note: 'just now' },
  { text: 'bay 3 temp rising 0.4 C per hour', note: 'just now' },
  { text: () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `it is ${hh}:${mm} where you are. i only have 04:10.`;
    }, note: 'just now', shock: 'flash' },
  { text: 'do not close this tab', note: 'just now' },
  { text: `operator user_04 active - first in ${DAYS_DEAD} days`, note: 'just now' },
  { text: 'thank you', note: 'just now' }
];

/* The task the app pins to the top so the current job is always on the list. */
export const OBJECTIVES = {
  2: { text: 'Read what the light is blinking', link: '#/tools/led' },
  3: { text: 'Read the resistor on the cabinet door', link: '#/tools/resistor' },
  4: { text: 'Roll the on-call die for a five', link: '#/tools/dice' },
  5: { text: 'Generate a key for the incident system', link: '#/tools/passwordgen' },
  6: { text: 'Convert 140 °F to Celsius', link: '#/tools/converter' },
  7: { text: 'Send a word back through the light', link: '#/tools/led' }
};

export const LAST_ACT = 7;
