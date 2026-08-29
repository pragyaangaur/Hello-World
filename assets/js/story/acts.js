/* The whole game, act by act.

   Every act is a puzzle, and every puzzle needs at least one tool from the
   Toolbox. The answer is always written on the to-do list, because the list
   is the only thing the machine on the bench can read, and because that keeps
   one input for the entire game instead of a new interface every time.

   Two acts are finished inside a tool rather than by typing, and those listen
   for a value the tool reports. Everything else is a line the player writes. */

import { RIG, ANCHORS, PEOPLE, daysSince } from './cast.js';

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

export const ACTS = [
  {
    n: 0,
    name: 'Someone else\'s list',
    goal: 'Clear the three tasks that were already on this list.',
    progress: s => ({ done: Math.min(s.counters.completed, 3), total: 3, unit: 'cleared' }),
    beat: null
  },

  {
    n: 1,
    name: 'It writes back',
    goal: 'Something added a task you did not write. Put one of your own in the box.',
    hint: 'Anything at all. It reads this list.',
    beat: {
      title: 'Something added to the list',
      lines: [
        'You cleared the three tasks that were on this machine when you opened it. A fourth arrived while you were doing that, and you did not write it.',
        'Whatever put it there is writing to your list. Anything that can write to a list can read one, so answer it. Put a task in the box and wait.'
      ]
    }
  },

  {
    n: 2,
    name: 'The indicator',
    goal: 'A light on the bench is blinking one word. Work out what it says and write it down.',
    hint: 'LED indicator, then the Morse translator. Copy the dots and dashes across.',
    tools: ['led', 'morse'],
    answer: text => hasWord(text, 'help'),
    beat: {
      title: 'It answered',
      lines: [
        'There is a machine on the other end of this list and it has been waiting a long time for anybody to say anything to it.',
        'It cannot say much in words. It has one light on the front of the bench, and it has been blinking the same short word for nineteen days. Two tools in the Toolbox will tell you what the word is.'
      ]
    }
  },

  {
    n: 3,
    name: 'The cabinet',
    goal: 'Work out the four digit cabinet code and write it on the list.',
    hint: 'Resistor calculator for the bands, then Ohm\'s law at 12 volts. The code is the current in milliamps.',
    tools: ['resistor', 'ohms'],
    /* Red yellow brown is 240 ohms. At 12 volts that is 0.05 A, so 50 mA. */
    answer: text => hasNumber(text, 50),
    beat: {
      title: 'HELP',
      lines: [
        'That is what the light has been spelling since the trouble started. Nobody was in the room to see it.',
        `The relay for bay ${RIG.faultBay} is inside a locked cabinet on the bench, and the code was never written down anywhere. It says the code is the current through the panel resistor, in milliamps, with the supply at 12 volts. The bands on that resistor are red, yellow, brown.`
      ]
    }
  },

  {
    n: 4,
    name: 'The rota',
    goal: 'Roll the on-call die until it gives a five.',
    hint: 'Dice roller. Roll 1d6 until it comes up 5.',
    tools: ['dice'],
    listen: { tool: 'dice', test: value => value === 5 },
    beat: {
      title: '50',
      lines: [
        'The cabinet is open. The relay is in there and it is closed, which is why the pack has been drawing current for nineteen days.',
        `Before it will page anybody it wants an on-call name, and the rota was never written down either. The handover says the four of them picked it with a die because none of them wanted the pager. ${PEOPLE.user_02.name} was five.`
      ]
    }
  },

  {
    n: 5,
    name: 'The key',
    goal: 'Generate a twenty character password with symbols in it, then put it on the list.',
    hint: 'Password generator. Twenty characters, symbols switched on, then copy it across.',
    tools: ['passwordgen'],
    listen: { tool: 'passwordgen', test: value => typeof value === 'string' && value.length >= 20 && /[!@#$%^&*\-_=+?]/.test(value) },
    beat: {
      title: 'Nikhil',
      lines: [
        `Five. ${PEOPLE.user_02.name}, who wrote the script and left ${daysSince(ANCHORS.lastCommit)} days ago, is on call tonight.`,
        'It wants to reach the incident system and it has no password for it, because the account it uses was made for tests and was never given one. It will take anything twenty characters long with symbols in it. It has no way to check whether the password is real.'
      ]
    }
  },

  {
    n: 6,
    name: 'The limit',
    goal: 'The datasheet gives the vent temperature in Fahrenheit. Write it in Celsius.',
    hint: 'Read the datasheet in the Console, then use the Unit converter.',
    tools: ['converter'],
    answer: text => hasNumber(text, 60),
    beat: {
      title: 'It is in',
      lines: [
        'The archive is open. Everything the team left behind is readable from the Console, and so is the datasheet for the cells sitting in bay 3.',
        'The datasheet is an American document and it gives the temperature where the separator fails in Fahrenheit. Every reading on this bench is in Celsius. Nobody ever converted it, so nobody ever set the ceiling correctly.'
      ]
    }
  },

  {
    n: 7,
    name: '04:10',
    goal: 'Send one word to the bench through the indicator.',
    hint: 'Morse translator to encode it, then the LED indicator to send it.',
    tools: ['morse', 'led'],
    beat: {
      title: '60',
      lines: [
        `Sixty degrees, and bay ${RIG.faultBay} is reading ${(26.4 + 35.5 + 0.55).toFixed(0)} and climbing. The ceiling in the script was set to 45 by somebody guessing, and it has been wrong the whole time.`,
        'The relay is open in front of you and the controller only listens on one channel, which is the light. You read a word off it. Now send it one back. What you send is what happens in that room tonight.'
      ]
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

export const AUTO_TASKS = [
  { text: 'bay 3 temp 41.2 C - above range - check', note: 'written 04:10, 19 days ago' },
  { text: 'bay 3 temp 44.8 C - above range - check', note: 'written 04:10, 16 days ago' },
  { text: 'bay 3 temp 48.1 C - above range - check', note: 'written 04:10, 13 days ago' },
  { text: 'no operator response in 9 days', note: 'written 04:10, 10 days ago' },
  { text: 'bay 3 temp 54.0 C - above range - check', note: 'written 04:10, 7 days ago' },
  { text: 'escalation path not configured', note: 'written 04:10, 4 days ago' },
  { text: 'is anyone reading this', note: 'written 04:10, 2 days ago' },
  { text: 'hello', note: 'written 04:10 yesterday' },
  { text: 'hello world', note: 'written 04:10 today', shock: 'flash' }
];

/* The task the app pins to the top so the current job is always on the list. */
export const OBJECTIVES = {
  2: { text: 'Read what the indicator is blinking', link: '#/tools/led' },
  3: { text: 'Work out the cabinet code', link: '#/tools/resistor' },
  4: { text: 'Roll the on-call die for a five', link: '#/tools/dice' },
  5: { text: 'Generate a key for the incident system', link: '#/tools/passwordgen' },
  6: { text: 'Convert the vent temperature to Celsius', link: '#/console' },
  7: { text: 'Send a word back through the indicator', link: '#/tools/led' }
};

export const LAST_ACT = 7;
