/* The acts.

   Each act names one thing to do, and every one of them can be done by a
   person who has never written a line of code. Four of the five are done on
   the to-do list itself, because the list is the only interface the thing on
   the bench has, and it is the one part of this app everybody already knows
   how to use. */

import { ANCHORS, PEOPLE, RIG, daysSince } from './cast.js';

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
    name: 'It writes back',
    goal: 'Something added a task you did not write. Add one of your own and see if it reads it.',
    hint: 'Type anything into the task box. It reads this list.',
    beat: {
      title: 'Something added to the list',
      lines: [
        'You cleared the three tasks that were on this machine when you opened it. A fourth one arrived while you were doing that, and you did not write it.',
        'Whatever put it there is writing to your list. A program that can write to a list can also read one, so try answering it. Put a task in the box and wait.'
      ]
    }
  },
  {
    n: 2,
    name: 'The indicator',
    goal: 'A light on the bench is blinking a word. Work out what it says, then write that word on the list.',
    hint: 'Open the LED indicator in the Toolbox, copy the pattern, and paste it into the Morse translator.',
    beat: {
      title: 'It answered',
      lines: [
        'It read your task and it wrote back. There is a machine on the other end of this list and it has been waiting for somebody to say something to it.',
        'It cannot say much. It has a light on the front of the bench and it has been blinking the same word for nineteen days. The Toolbox has an indicator and a Morse translator, and between them they will tell you what the word is.'
      ]
    }
  },
  {
    n: 3,
    name: 'Out of range',
    goal: 'Open the sensor log and mark the bay that is failing.',
    hint: 'Four channels, nineteen days. One of them is climbing and it is not subtle.',
    beat: {
      title: 'HELP',
      lines: [
        'That is what the light has been spelling since the day the trouble started. Nobody was in the room to see it.',
        'It has four temperature sensors and it wants you to look at them. The sensor log is in the Toolbox now, and one of those four lines does not look like the others.'
      ]
    }
  },
  {
    n: 4,
    name: 'The archive',
    goal: 'Answer the rest of the questions on the Findings board.',
    progress: ctx => ({ done: ctx.findingsDone, total: ctx.findingsTotal, unit: 'answered' }),
    hint: 'The Console reads the controller and the team\'s old files. You can also just ask it.',
    beat: {
      title: 'Bay 3',
      lines: [
        `Thirty-five degrees in nineteen days, and it is still going up. The pack in bay ${RIG.faultBay} starts to break down above 60 and the room has been locked since the handover.`,
        'You have a shell on the controller now. Every file on it is readable, and the machine will answer questions you put on the list, so use whichever you prefer.'
      ]
    }
  },
  {
    n: 5,
    name: '04:10',
    goal: 'Decide what happens above 45 degrees.',
    beat: {
      title: 'It runs at 04:10',
      lines: [
        'You have read all of it. The script wakes at ten past four, finds bay 3 above the ceiling it was given, and has no instruction for that case, so it writes another task and waits.',
        'There is one empty place left in the file. Whatever goes there is what happens in that room tomorrow morning, and you are the only person who is going to put anything there.'
      ]
    }
  }
];

/* The word the indicator has been blinking. The player never types code to
   find it. They read a light, use a translator, and write a word down. */
export const SIGNAL_WORD = 'help';

/* The three tasks that were open on this machine when the last person to use
   it walked away. They are the first thing the player sees, and they carry
   the whole setup: a real team, a real room, and a job nobody finished. */
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

/* The tasks the script wrote before anybody was listening. They arrive as the
   player works, oldest first, so the backlog reads like nineteen days of one
   program with one way to speak. */
export const AUTO_TASKS = [
  { text: 'bay 3 temp 41.2 C - above range - check', note: 'written 04:10, 19 days ago' },
  { text: 'bay 3 temp 44.8 C - above range - check', note: 'written 04:10, 16 days ago' },
  { text: 'bay 3 temp 48.1 C - above range - check', note: 'written 04:10, 13 days ago' },
  { text: 'no operator response in 9 days', note: 'written 04:10, 10 days ago' },
  { text: 'bay 3 temp 54.0 C - above range - check', note: 'written 04:10, 7 days ago' },
  { text: 'escalation path not configured', note: 'written 04:10, 4 days ago' },
  { text: 'is anyone reading this', note: 'written 04:10, 2 days ago' },
  { text: 'hello', note: 'written 04:10 yesterday', shock: 'none' },
  { text: 'hello world', note: 'written 04:10 today', shock: 'flash' }
];

/* The objective tasks the app pins to the top of the list. */
export const OBJECTIVES = {
  2: { text: 'Read what the indicator is blinking', link: '#/tools/led' },
  3: { text: 'Mark the failing bay in the sensor log', link: '#/tools/sensorlog' },
  4: { text: 'Answer the questions on the Findings board', link: '#/findings' },
  5: { text: 'Write the branch above 45 degrees', link: '#/lab/branch' }
};
