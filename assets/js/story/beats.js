/* Chapter definitions. Each chapter names its own goal in plain language,
   because the player should always know what the app is asking for.

   Every chapter also carries a beat, which is the short scene the app shows
   when the chapter turns over. The beat is the only place the story speaks
   directly, so it has to do the work of telling the player where they now
   stand and what changed. */

import { ANCHORS, PEOPLE, daysSince } from './cast.js';

export const CHAPTERS = [
  {
    n: 0,
    name: 'Someone else\'s list',
    goal: 'Clear the three tasks that were already on this list.',
    progress: ctx => ({ done: Math.min(ctx.state.counters.completed, 3), total: 3, unit: 'cleared' }),
    beat: null
  },
  {
    n: 1,
    name: 'The toolbox',
    goal: 'Open four of the tools. Read the small grey line at the bottom of each one.',
    progress: ctx => ({ done: Math.min(ctx.toolsOpened, 4), total: 4, unit: 'opened' }),
    beat: {
      title: 'Something added to the list',
      lines: [
        'You cleared the three tasks that were on this machine when you opened it. A fourth one arrived while you were doing that, and you did not write it.',
        'This build also carries a toolbox of small programs that the team wrote. It has just made them visible, so that is where to look next.'
      ]
    }
  },
  {
    n: 2,
    name: 'Still connected',
    goal: 'Fix the blink pattern so the indicator on the bench works again.',
    beat: {
      title: 'They are all still connected',
      lines: [
        'Every tool you opened is reading from the same place. The line at the bottom names a bench in Lab 4B and a controller on the network, and the readings on your screen are coming from it right now.',
        '{unlocked} more programs were sitting in the same build file, and they are in the toolbox now. One of them drives an indicator that has been dark since the day it was written.'
      ]
    }
  },
  {
    n: 3,
    name: 'Out of range',
    goal: 'Find the failing bay, then answer three questions on the Findings board.',
    progress: ctx => ({ done: Math.min(ctx.findingsDone, 3), total: 3, unit: 'answered' }),
    beat: {
      title: 'The indicator is blinking',
      lines: [
        'Your code is running on the controller in Lab 4B. The light on the front of the bench is blinking a word, and the word is not one the team chose.',
        'The app has opened a board called Findings. It holds the questions you can answer from here, and working through them is how you find out what this machine has been doing on its own.'
      ]
    }
  },
  {
    n: 4,
    name: 'Console',
    goal: 'Answer the last three questions using the files in the Console.',
    progress: ctx => ({ done: ctx.findingsDone, total: ctx.findingsTotal, unit: 'answered' }),
    beat: {
      title: 'You have a shell',
      lines: [
        'Bay 3 has climbed thirty four degrees in nineteen days. The morning script has written a task about it every day since it started, and every one of those tasks is still open.',
        'The Console is open now. It reaches the controller and the team\'s old files, and nothing in it is locked.'
      ]
    }
  },
  {
    n: 5,
    name: 'The branch',
    goal: 'Decide what happens above 45 degrees.',
    beat: {
      title: 'One task left',
      lines: [
        'You have read all of it. The script runs at 04:10, it finds bay 3 above the ceiling it was given, and it has no instruction for that case.',
        'There is one function left to write. What you put in it is what happens tomorrow morning.'
      ]
    }
  }
];

/* The three tasks that were open on this machine when the last person to use
   it walked away. They are the first thing the player sees, and they carry
   the whole setup: a real team, a real room, and a job that was never done. */
export const LEFTOVER = [
  {
    text: 'Email Devika the calibration numbers for bay 2',
    who: PEOPLE.user_01
  },
  {
    text: 'Book bench 4B for Thursday, tell Nikhil if the slot moves',
    who: PEOPLE.user_01
  },
  {
    text: 'Pull the cells out of the rig before we hand the room back',
    who: PEOPLE.user_01
  }
];

export function leftoverNote() {
  const days = daysSince(ANCHORS.lastHuman);
  const years = Math.floor(days / 365);
  return years >= 1
    ? `open for ${years}y ${days % 365}d`
    : `open for ${days}d`;
}

/* The tasks the maintenance script has written to the list, in the order it
   wrote them. Nineteen days of one program with one way to speak. */
export const AUTO_TASKS = [
  { day: 19, text: 'bay 3 temp 41.2 C — above range — check', note: 'written 04:10' },
  { day: 16, text: 'bay 3 temp 44.8 C — above range — check', note: 'written 04:10' },
  { day: 13, text: 'bay 3 temp 48.1 C — above range — check', note: 'written 04:10' },
  { day: 10, text: 'no operator response in 9 days', note: 'written 04:10' },
  { day: 7,  text: 'bay 3 temp 54.0 C — above range — check', note: 'written 04:10' },
  { day: 4,  text: 'escalation path not configured', note: 'written 04:10' },
  { day: 2,  text: 'is anyone reading this', note: 'written 04:10' },
  { day: 1,  text: 'hello', note: 'written 04:10' },
  { day: 0,  text: 'hello world', note: 'written 04:10 today' }
];

/* The objective tasks the app pins to the top of the list. */
export const OBJECTIVES = {
  1: { text: 'Open four of the tools in the Toolbox', link: '#/tools' },
  2: { text: 'Fix the indicator blink pattern', link: '#/lab/blink' },
  3: { text: 'Find out which bay is failing',   link: '#/lab/parse' },
  4: { text: 'Read the archive in the Console', link: '#/console' },
  5: { text: 'Write the branch above 45 degrees', link: '#/lab/branch' }
};
