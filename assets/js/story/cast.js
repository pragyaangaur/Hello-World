/* The people, the places, and the clock.
   Dates are anchored to the day the visitor opens the app so the gap always
   reads as a real, current gap rather than a hard-coded year. */

import { chapter } from '../core/state.js';

const DAY = 86400000;

export const NOW = new Date();

export function daysAgo(n) { return new Date(NOW.getTime() - n * DAY); }

export function isoDate(d) { return d.toISOString().slice(0, 10); }

export function human(d, withTime = false) {
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; opts.hour12 = false; }
  return d.toLocaleString('en-GB', opts).replace(',', '');
}

/* ---- anchors ---- */
export const ANCHORS = {
  projectStart: daysAgo(1840),   /* first year, the repo is created          */
  rigBuilt:     daysAgo(1290),   /* the bank goes into Lab 4B                */
  scriptWritten:daysAgo(1180),   /* Nikhil writes maint.py as a shortcut     */
  lastHuman:    daysAgo(806),    /* graduation, everyone stops logging in    */
  lastCommit:   daysAgo(784),    /* the final human commit                   */
  anomaly:      daysAgo(19),     /* bay 3 leaves its range                   */
  firstPlea:    daysAgo(19),
  lastPlea:     daysAgo(0)
};

export const PEOPLE = {
  user_01: {
    id: 'user_01', name: 'Ira Sethi', role: 'interface, tasks',
    initials: 'IS',
    last: ANCHORS.lastHuman,
    note: 'Wrote the to-do list. Wrote most of what you have been using.'
  },
  user_02: {
    id: 'user_02', name: 'Nikhil Vaz', role: 'hardware tools, automation',
    initials: 'NV',
    last: ANCHORS.lastCommit,
    note: 'Wired the toolbox to the bench in Lab 4B. Wrote maint.py.'
  },
  user_03: {
    id: 'user_03', name: 'Devika Rao', role: 'simulations, testing',
    initials: 'DR',
    last: ANCHORS.lastHuman,
    note: 'Built the simulators. Set up the test account.'
  },
  user_04: {
    id: 'user_04', name: 'user_04', role: 'test account',
    initials: '04',
    last: NOW,
    note: 'Created for the automated test suite. Never assigned to a person.'
  }
};

export const RIG = {
  room: 'Lab 4B',
  building: 'Applied Sciences Block, Meridian Institute of Technology',
  name: 'Cell Bank B / thermal and load monitor',
  bays: 4,
  faultBay: 3,
  nominalC: 24,
  ceilingC: 45
};

/* The bay 3 temperature curve. Nineteen days of slow climb, which is the
   shape that matters: nothing broke, something is failing slowly. It starts
   just over the limit in the script, which is the morning the machine began
   writing tasks nobody read, and it ends where the last logged reading is. */
export function bayTemp(dayIndex) {
  const t = Math.max(0, Math.min(1, dayIndex / 19));
  return 45.5 + 8.5 * Math.pow(t, 1.7) + Math.sin(dayIndex * 1.9) * 0.3;
}

/* And this is now. The log stops at 54; the pack does not. It keeps climbing
   for as long as the player is in the app, which is what turns the story from
   a thing that happened into a thing that is happening. The vent limit of 60
   is crossed at the exact act where the player works out what 60 means. */
export function liveTemp() { return 54.0 + chapter() * 1.15; }

/* Nineteen days of readings across the four bays. One shape of data used by
   the chart, the log file, and anything else that needs to agree with them. */
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

export function daysSince(date) {
  return Math.max(0, Math.round((NOW - date) / DAY));
}
