/* Chapter definitions. Each chapter names its own goal in plain language,
   because the player should always know what the app is asking for. */

export const CHAPTERS = [
  {
    n: 0,
    name: 'Fresh install',
    goal: 'Complete three tasks.',
    unlockToast: null
  },
  {
    n: 1,
    name: 'Toolbox',
    goal: 'Open four tools.',
    unlockToast: ['Toolbox unlocked', 'This build ships with a few extra things. Have a look.']
  },
  {
    n: 2,
    name: 'The shelf',
    goal: 'Fix the indicator blink pattern.',
    unlockToast: ['More tools found', 'Fifteen more modules were in the build file. They are in the Toolbox now.']
  },
  {
    n: 3,
    name: 'Out of range',
    goal: 'Answer every question on the Findings board.',
    unlockToast: ['Findings opened', 'Something is writing to your task list. There is a board for it now.']
  },
  {
    n: 4,
    name: 'Console',
    goal: 'Read the archive, then write the missing branch.',
    unlockToast: ['Console unlocked', 'You have shell access to whatever this app is still talking to.']
  },
  {
    n: 5,
    name: 'The branch',
    goal: 'Decide what happens above 45 degrees.',
    unlockToast: ['One task left', 'maint.js is waiting on a branch that was never written.']
  }
];

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
  2: { text: 'Fix the indicator blink pattern', link: '#/lab/blink' },
  3: { text: 'Find out which bay is failing',   link: '#/lab/parse' },
  4: { text: 'Read the archive in the Console', link: '#/console' },
  5: { text: 'Write the branch above 45 degrees', link: '#/lab/branch' }
};
