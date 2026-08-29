/* The Findings board is a to-do list of questions. Each one is answered by
   using a specific tool or reading a specific file, so the player always has
   a next action and never has to guess what the app wants. */

export const FINDINGS = [
  {
    id: 'who',
    q: 'Who is user_04?',
    hint: 'Open the account panel at the bottom of the sidebar.',
    answer: 'Not a person. A test account made in first year, and the only one still active.',
    where: '#account'
  },
  {
    id: 'live',
    q: 'What is the indicator actually connected to?',
    hint: 'Open the LED indicator and read the line under the pattern.',
    answer: 'Bench 4B. The tools were wired to real hardware and the link was never cut.',
    where: '#/tools/led'
  },
  {
    id: 'bay',
    q: 'Which bay is failing?',
    hint: 'Open the sensor log and mark the bay that is climbing.',
    answer: 'Bay 3. It has climbed 35 degrees in nineteen days.',
    where: '#/tools/sensorlog'
  },
  {
    id: 'alone',
    q: 'How long has it been running without anyone?',
    hint: 'Read the maintenance log in the Console, or ask it how long it has been running.',
    answer: 'Two years and forty-one days, at 04:10 every morning.',
    where: '#/console'
  },
  {
    id: 'why',
    q: 'Why is it writing tasks?',
    hint: 'Read maint.py in the Console, or ask it why it keeps writing tasks.',
    answer: 'It has no branch for this case. Writing a task is its only fallback.',
    where: '#/console'
  },
  {
    id: 'risk',
    q: 'What happens if nobody answers?',
    hint: 'Read the cell datasheet in the Console, or ask it whether this is dangerous.',
    answer: 'The pack vents above 60 °C. Bay 3 is past 60 and there is nobody in the building.',
    where: '#/console'
  }
];

export const FINDING_IDS = FINDINGS.map(f => f.id);
