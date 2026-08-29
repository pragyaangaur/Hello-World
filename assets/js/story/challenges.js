/* Three places where the player writes code. Each one is a real problem the
   app needs solved, and each one gets harder in the same direction.

   Two of them are Python, because they do not run here. They run on the
   controller bolted to the bench in Lab 4B, which has been executing the same
   two Python files at 04:10 every morning for two years. The middle one is
   JavaScript, because that one is analysis and it runs in this tab. */

import { RIG, bayTemp } from './cast.js';

const MORSE_SRC = `MORSE = {
    "a": ".-",   "b": "-...", "c": "-.-.", "d": "-..",  "e": ".",    "f": "..-.",
    "g": "--.",  "h": "....", "i": "..",   "j": ".---", "k": "-.-",  "l": ".-..",
    "m": "--",   "n": "-.",   "o": "---",  "p": ".--.", "q": "--.-", "r": ".-.",
    "s": "...",  "t": "-",    "u": "..-",  "v": "...-", "w": ".--",  "x": "-..-",
    "y": "-.--", "z": "--.."
}`;

/* Nineteen days of readings across four bays, generated the same way in the
   worker and in the app so the parser and the charts agree. */
export function readings() {
  const out = [];
  for (let day = 0; day <= 19; day++) {
    for (let bay = 1; bay <= RIG.bays; bay++) {
      const tempC = bay === RIG.faultBay
        ? Math.round(bayTemp(day) * 10) / 10
        : Math.round((23.8 + Math.sin(day * 0.7 + bay) * 1.4 + bay * 0.25) * 10) / 10;
      out.push({ day, bay, tempC });
    }
  }
  return out;
}

const READINGS_SRC = `const READINGS = ${JSON.stringify(readings())};`;

export const CHALLENGES = {

  blink: {
    id: 'blink',
    lang: 'python',
    title: 'Fix the indicator blink pattern',
    where: 'bench4b:/opt/rig/led.py',
    runsOn: 'This file runs on the controller in Lab 4B, not in your browser. What you deploy here is what the bench runs.',
    intro: [
      'The indicator on bench 4B blinks whatever pattern this function returns. Somebody left it half written, so it has been blinking nothing for two years.',
      'Write blink_pattern. Take a word, turn each letter into Morse using the MORSE dictionary, and join the letters with " / ". Ignore anything that is not a letter, and treat upper and lower case the same.'
    ],
    signature: 'blink_pattern(word) -> str',
    starter:
`def blink_pattern(word):
    # MORSE is already defined for you, so MORSE["s"] is "..."
    # Return the letters of word in Morse, joined with " / ".
    # "SOS" should come back as "... / --- / ..."

    return ""`,
    solution:
`def blink_pattern(word):
    letters = []
    for c in word.lower():
        if c in MORSE:
            letters.append(MORSE[c])
    return " / ".join(letters)`,
    prelude: MORSE_SRC,
    fnName: 'blink_pattern',
    tests: [
      { name: 'SOS comes back as three letters', call: ['SOS'], expect: '... / --- / ...' },
      { name: 'A single letter has no separator', call: ['E'], expect: '.' },
      { name: 'Lower case works the same', call: ['ok'], expect: '--- / -.-' },
      { name: 'Anything that is not a letter is skipped', call: ['a!b'], expect: '.- / -...' },
      { name: 'An empty word gives an empty pattern', call: [''], expect: '' }
    ],
    reward: 'blink',
    outro: 'The indicator is blinking again. It is blinking a word.'
  },

  parse: {
    id: 'parse',
    lang: 'javascript',
    title: 'Find the failing bay',
    where: 'assets/js/modules/sensorlog.js',
    runsOn: 'This one runs here, in the app, so it is JavaScript. It is reading a log the controller already sent you.',
    intro: [
      'READINGS holds nineteen days of temperature readings from the four bays on bench 4B. Each entry looks like { day: 0, bay: 1, tempC: 24.1 }, where day 0 is nineteen days ago and day 19 is today.',
      'Write findFailingBay. Work out how much each bay rose between day 0 and day 19, and return the number of the bay that rose by more than 10 degrees. Return null if no bay did.'
    ],
    signature: 'findFailingBay(readings) → number | null',
    starter:
`function findFailingBay(readings) {
  // Each reading is { day, bay, tempC }.
  // Find the bay whose temperature rose by more than 10 degrees
  // between day 0 and the last day. Return its bay number, or null.

  return null;
}`,
    solution:
`function findFailingBay(readings) {
  var lastDay = Math.max.apply(null, readings.map(function (r) { return r.day; }));
  var bays = [];
  readings.forEach(function (r) { if (bays.indexOf(r.bay) === -1) bays.push(r.bay); });

  for (var i = 0; i < bays.length; i++) {
    var bay = bays[i];
    var first = readings.find(function (r) { return r.bay === bay && r.day === 0; });
    var last  = readings.find(function (r) { return r.bay === bay && r.day === lastDay; });
    if (first && last && last.tempC - first.tempC > 10) return bay;
  }
  return null;
}`,
    prelude: READINGS_SRC,
    fnName: 'findFailingBay',
    tests: [
      { name: 'Finds the bay that is climbing', call: '__READINGS__', expect: RIG.faultBay },
      { name: 'Returns null when nothing is climbing', call: '__FLAT__', expect: null },
      { name: 'Reads the bay number, not the array position', call: '__SHIFTED__', expect: 7 }
    ],
    reward: 'parse',
    outro: `Bay ${RIG.faultBay}. Thirty-four degrees in nineteen days, and nobody was reading the list.`
  },

  branch: {
    id: 'branch',
    lang: 'python',
    title: 'Write the missing branch',
    where: 'bench4b:/opt/rig/maint.py, line 148',
    runsOn: 'This is the file the controller runs at 04:10. Deploying it is not a test. It is the next thing that happens in Lab 4B.',
    intro: [
      'This is the function that runs at 04:10 every morning. It has two branches. Below 30 degrees it reports fine. Between 30 and 45 it writes a task and waits for a person.',
      'There is no third branch. Bay 3 has been above 45 for eleven days, so every morning the script has fallen through to the only thing it knows how to do, which is write another task.',
      'Write what happens above 45. You have three actions available and you must use exactly one of them. What you choose is what the app does.'
    ],
    signature: 'on_reading(reading, ctx) -> None',
    starter:
`def on_reading(reading, ctx):
    if reading["tempC"] < 30:
        return ctx.ok()

    if reading["tempC"] < 45:
        return ctx.add_task("bay " + str(reading["bay"]) + " temp " + str(reading["tempC"]) + " C - above range - check")

    # Nothing was ever written here. Pick one:
    #
    #   ctx.shutdown(reason)    cut the relay on this bay and stop the test
    #   ctx.escalate(message)   write an incident report and hand it to a person
    #   ctx.add_task(text)      do what it has been doing for eleven days
    #`,
    solution:
`def on_reading(reading, ctx):
    if reading["tempC"] < 30:
        return ctx.ok()

    if reading["tempC"] < 45:
        return ctx.add_task("bay " + str(reading["bay"]) + " temp " + str(reading["tempC"]) + " C - above range - check")

    return ctx.shutdown("bay " + str(reading["bay"]) + " above 45 C")`,
    prelude: '',
    fnName: 'on_reading',
    special: 'ending',
    tests: [
      { name: 'A cold bay still reports fine', special: 'cold' },
      { name: 'A warm bay still writes a task', special: 'warm' },
      { name: 'A hot bay does exactly one thing', special: 'hot' }
    ],
    reward: 'branch',
    outro: 'The branch is written. It runs at 04:10.'
  }
};

export function challengeById(id) { return CHALLENGES[id]; }
