/* The one place in the game where the player writes code, and the last thing
   the app asks for.

   It is deliberately close to a fill-in-the-blank. Two branches are already
   written and the third is missing. A player who does not write code picks
   one of three buttons and the line appears. A player who does can ignore the
   buttons and write whatever they like, as long as it calls one action.

   The file is Python because it does not run here. It runs on the controller
   bolted to the bench in Lab 4B, at ten past four every morning. */

import { RIG, bayTemp } from './cast.js';

const TEMP = bayTemp(19).toFixed(1);

export const CHALLENGES = {
  branch: {
    id: 'branch',
    lang: 'python',
    title: 'The branch that was never written',
    where: 'bench4b:/opt/rig/maint.py, line 148',
    runsOn: 'This is the file the controller runs at 04:10. Deploying it is not a test. It is the next thing that happens in Lab 4B.',
    intro: [
      'This function runs every morning. Below 30 degrees it reports fine. Between 30 and 45 it writes a task and waits for a person to come and look.',
      `There is no third branch. Bay ${RIG.faultBay} has been above 45 for eleven days, so every morning the script falls past both of these and does the only thing it has left, which is write another task.`,
      'Pick what happens above 45. You can press one of the three buttons and it will write the line for you, or you can write your own. Either way it has to call exactly one action.'
    ],
    signature: 'on_reading(reading, ctx) -> None',
    /* The three actions, in the order a person is most likely to want them.
       Each one writes a single line and each one is a different ending. */
    choices: [
      {
        id: 'shutdown',
        label: 'Cut the power to the bay',
        desc: 'Open the relay and stop the test. The pack cools down. Nobody is asked first.',
        line: `    return ctx.shutdown("bay ${RIG.faultBay} above 45 C")`
      },
      {
        id: 'escalate',
        label: 'Tell a person',
        desc: 'Write an incident report and send it to the only address the booking has. Somebody has to read it and find a key.',
        line: `    return ctx.escalate("bay ${RIG.faultBay} at ${TEMP} C, nobody in the building")`
      },
      {
        id: 'add_task',
        label: 'Write another task and wait',
        desc: 'Do what it has done every morning for eleven days.',
        line: `    return ctx.add_task("bay ${RIG.faultBay} temp " + str(reading["tempC"]) + " C - above range - check")`
      }
    ],
    starter:
`def on_reading(reading, ctx):
    if reading["tempC"] < 30:
        return ctx.ok()

    if reading["tempC"] < 45:
        return ctx.add_task("bay " + str(reading["bay"]) + " temp " + str(reading["tempC"]) + " C - above range - check")

    # Nothing was ever written here.
    # Use a button below, or write one line yourself:
    #
    #   ctx.shutdown(reason)    cut the relay on this bay and stop the test
    #   ctx.escalate(message)   write an incident report and hand it to a person
    #   ctx.add_task(text)      do what it has been doing for eleven days
    #`,
    prelude: '',
    fnName: 'on_reading',
    special: 'ending',
    reward: 'branch',
    outro: 'The branch is written. It runs at 04:10.'
  }
};

export function challengeById(id) { return CHALLENGES[id]; }
