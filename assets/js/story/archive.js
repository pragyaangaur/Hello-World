/* The virtual filesystem behind the Console. Every file here is readable
   from the first moment the Console opens. Nothing is gated behind a puzzle,
   because the player has already earned it by getting this far. */

import { ANCHORS, PEOPLE, RIG, human, isoDate, daysSince, bayTemp, NOW } from './cast.js';

const D = ANCHORS;

function logBlock() {
  const lines = [];
  const routine = daysSince(D.lastHuman) - 19;
  lines.push(`# maint.log  (rotated, last ${routine + 20} entries kept)`);
  lines.push('');
  for (let i = 0; i < 3; i++) {
    const d = new Date(D.lastHuman.getTime() + (i + 1) * 86400000);
    lines.push(`${isoDate(d)} 04:10:02  login user_04`);
    lines.push(`${isoDate(d)} 04:10:03  bench 4B reachable`);
    lines.push(`${isoDate(d)} 04:10:04  bays 1-4 nominal`);
    lines.push(`${isoDate(d)} 04:10:04  checklist 6/6 complete`);
    lines.push(`${isoDate(d)} 04:10:05  logout`);
    lines.push('');
  }
  lines.push(`      ... ${routine - 3} more days, all identical ...`);
  lines.push('');
  for (let day = 19; day >= 0; day--) {
    const d = new Date(NOW.getTime() - day * 86400000);
    const t = bayTemp(19 - day).toFixed(1);
    lines.push(`${isoDate(d)} 04:10:02  login user_04`);
    lines.push(`${isoDate(d)} 04:10:03  bench 4B reachable`);
    if (day === 19) lines.push(`${isoDate(d)} 04:10:04  WARN bay 3 ${t} C outside range 18.0-30.0`);
    else lines.push(`${isoDate(d)} 04:10:04  WARN bay 3 ${t} C outside range 18.0-30.0`);
    lines.push(`${isoDate(d)} 04:10:04  no branch for state ABOVE_RANGE`);
    lines.push(`${isoDate(d)} 04:10:04  fallback: write task, await operator`);
    if (day <= 2) lines.push(`${isoDate(d)} 04:10:05  operator response: none (${19 - day + 1} d)`);
    lines.push(`${isoDate(d)} 04:10:05  logout`);
    lines.push('');
  }
  lines.push('# end of log');
  return lines.join('\n');
}

function sensorCsv() {
  const rows = ['day,date,bay,temp_c,volts,state'];
  for (let day = 0; day <= 19; day++) {
    const d = new Date(NOW.getTime() - (19 - day) * 86400000);
    for (let bay = 1; bay <= RIG.bays; bay++) {
      const temp = bay === RIG.faultBay
        ? bayTemp(day).toFixed(1)
        : (23.8 + Math.sin(day * 0.7 + bay) * 1.4 + bay * 0.25).toFixed(1);
      const volts = bay === RIG.faultBay ? (4.19 - day * 0.004).toFixed(3) : (3.71 + bay * 0.01).toFixed(3);
      const state = Number(temp) > 30 ? 'ABOVE_RANGE' : 'NOMINAL';
      rows.push(`${day},${isoDate(d)},${bay},${temp},${volts},${state}`);
    }
  }
  return rows.join('\n');
}

export const FS = {
  '/README': {
    kind: 'file',
    body:
`Hello World
build 1.0.4

Serves the to-do list at /, and the toolbox at /tools.
Bound to the bench controller on port 8140. See /lab4b/bench.conf.

Do not deploy this anywhere that matters. It was a minor project.`
  },

  '/home/user_04/README': {
    kind: 'file',
    body:
`Test account. Not a person.

Created ${human(D.projectStart)} so the automated suite could log in
without using one of ours. The password is in the repository, which is
why nothing real should ever be put in this account.

If you are a human and you are reading this, you are in the wrong place.

  -- D.R.`
  },

  '/opt/rig/maint.py': {
    kind: 'file',
    body:
`# maint.py
# Runs on the bench controller at 04:10. Logs in as user_04,
# walks the checklist, posts anything it finds back to the app, logs out.
# Written ${human(D.scriptWritten)} because doing it by hand was boring.
# TODO: this should not be a cron job forever.  -- N.V.

CHECKLIST = [
    "bench reachable",
    "bay 1 in range",
    "bay 2 in range",
    "bay 3 in range",
    "bay 4 in range",
    "log written",
]


def on_reading(reading, ctx):
    if reading["tempC"] < 30:
        return ctx.ok()

    if reading["tempC"] < 45:
        return ctx.add_task("bay " + str(reading["bay"]) + " temp " + str(reading["tempC"]) + " C - above range - check")

    # TODO: decide what to do here before this ever happens


# If on_reading falls through, the runner has one fallback and only one.
# It writes a task and waits for an operator.
#
#   fallback: write task, await operator
#
# There is no timeout on that wait.`
  },

  '/opt/rig/led.py': {
    kind: 'file',
    body:
`# led.py
# Drives the indicator on the front of the bench. gpio 17.
# The pattern is supposed to come from blink_pattern().
# blink_pattern() was never finished, so for the first two years
# the indicator did nothing at all.  -- N.V.

MORSE = {
    "a": ".-",   "b": "-...", "c": "-.-.", "d": "-..",  "e": ".",    "f": "..-.",
    "g": "--.",  "h": "....", "i": "..",   "j": ".---", "k": "-.-",  "l": ".-..",
    "m": "--",   "n": "-.",   "o": "---",  "p": ".--.", "q": "--.-", "r": ".-.",
    "s": "...",  "t": "-",    "u": "..-",  "v": "...-", "w": ".--",  "x": "-..-",
    "y": "-.--", "z": "--..",
}


def blink_pattern(word):
    # FIXME finish this  -- N.V.
    return ""


# --- appended by maint.py, 19 days ago -----------------------------
# blink_pattern returns nothing, so the checklist runner writes the
# pins itself. This is not how any of this was meant to work.
#
# SEQUENCE = [MORSE["h"], MORSE["e"], MORSE["l"], MORSE["p"]]
#
# while True:
#     drive(17, SEQUENCE)`
  },

  '/opt/rig/maint.log': {
    kind: 'file',
    get body() { return logBlock(); }
  },

  '/lab4b/bench.conf': {
    kind: 'file',
    body:
`# Bench 4B controller
# ${RIG.building}

controller.host      = 10.14.4.62
controller.port      = 8140
controller.keepalive = true

# The toolbox modules are bound to real channels on this bench.
# This was meant to be a demo for the viva and then switched off.

bind indicator.led      -> gpio 17        # "LED blinker"
bind scope.channel_a    -> adc 0          # "Oscilloscope"
bind bench.supply       -> psu 1          # "Ohm's law"
bind thermal.bay[1..4]  -> ds18b20 1..4   # panel + Bench 4B
bind relay.bay[1..4]    -> relay 1..4     # not exposed in the UI

decommission = false`
  },

  '/lab4b/cell-datasheet.txt': {
    kind: 'file',
    body:
`LITHIUM CELL PACK, 4S2P, TEST GRADE
Supplier sheet held in Lab 4B. Printed from the US site.
ALL TEMPERATURES IN FAHRENHEIT.

  Nominal cell voltage        3.70 V
  Charge cut-off              4.20 V
  Operating range             32 to 113 F
  Storage range               64 to 86 F

  Above 113 F   accelerated degradation, cycle life drops sharply
  Above 140 F   separator begins to break down
  Above 176 F   thermal runaway, venting, ignition of vented gas

NOTE PENCILLED ON THE PRINTOUT:
  "bay 3 pack is the one we over-charged in second year, keep an eye on
   it" -- no signature

SECOND NOTE, DIFFERENT HAND:
  "everything on the bench reads in C. convert this before you set any
   limits. do not just copy the numbers across."`
  },

  '/lab4b/sensors.csv': {
    kind: 'file',
    get body() { return sensorCsv(); }
  },

  '/team/handover.md': {
    kind: 'file',
    body:
`# Handover, ${human(D.lastHuman)}

Lab 4B, keys back to the department on Tuesday.

- [x] Export the project repo
- [x] Return the two multimeters and the scope probe
- [x] Clear the shelf
- [x] Paperwork for the bench booking
- [x] Submit the report
- [ ] Decommission bench 4B (cut the supply, disconnect the pack)

Ira said Monday. Keys went back Tuesday.

Nobody has been in the room since.`
  },

  '/team/chat-export.txt': {
    kind: 'file',
    body:
`# exported from the group chat, ${human(D.lastHuman)}

[16:41] Nikhil: ok last thing. bench 4B needs decommissioning before
        the keys go back
[16:41] Devika: i thought you did that last week
[16:42] Nikhil: i did the paperwork. not the bench
[16:44] Ira: i can do it monday
[16:44] Nikhil: monday is fine, keys go back tuesday
[16:45] Devika: adding it to the list
[16:45] Ira: which list
[16:45] Devika: ours. obviously
[16:46] Ira: lol ok

# 22 days later

[09:12] Nikhil: hey did anyone actually do 4B

# no reply in this export`
  },

  '/team/tasks.json': {
    kind: 'file',
    body:
`[
  {
    "id": "t_${D.lastHuman.getTime().toString(36)}",
    "text": "Decommission bench 4B",
    "done": false,
    "createdAt": "${D.lastHuman.toISOString()}",
    "completedAt": null,
    "assignee": "user_01",
    "source": "user"
  }
]

// One item. ${daysSince(D.lastHuman)} days old. Still open.`
  }
};

export const DIRS = {
  '/':            ['home', 'lab4b', 'opt', 'team', 'README'],
  '/home':        ['user_04'],
  '/home/user_04':['README'],
  '/lab4b':       ['bench.conf', 'cell-datasheet.txt', 'sensors.csv'],
  '/opt':         ['rig'],
  '/opt/rig':     ['led.py', 'maint.py', 'maint.log'],
  '/team':        ['handover.md', 'chat-export.txt', 'tasks.json']
};

export function readFile(path) {
  const entry = FS[path];
  if (!entry) return null;
  return { body: entry.body };
}

export function isDir(path) { return Object.prototype.hasOwnProperty.call(DIRS, path); }
export function listDir(path) { return DIRS[path] || null; }
