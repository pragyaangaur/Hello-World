/* The module registry. Every tool is a plain object with a mount function,
   so adding one is a single import and a single line. */

import calculator from './calculator.js';
import converter from './converter.js';
import notepad from './notepad.js';
import passwordgen from './passwordgen.js';
import dice from './dice.js';
import timers from './timers.js';
import paint from './paint.js';

import led from './led.js';
import morse from './morse.js';
import resistor from './resistor.js';
import gates from './gates.js';
import sevenseg from './sevenseg.js';
import scope from './scope.js';
import ohms from './ohms.js';
import piano from './piano.js';
import projectile from './projectile.js';
import pendulum from './pendulum.js';
import gears from './gears.js';
import beam from './beam.js';
import ph from './ph.js';
import orbit from './orbit.js';
import bmi from './bmi.js';

import sorting from './sorting.js';
import tictactoe from './tictactoe.js';
import snake from './snake.js';
import ecg from './ecg.js';
import weather from './weather.js';
import alarm from './alarm.js';

export const DEPT_ORDER = [
  'Everyday',
  'Computer Science',
  'Electronics',
  'Electrical',
  'Mechanical',
  'Civil',
  'Chemical',
  'Aerospace',
  'Biomedical'
];

export const registry = [
  calculator, converter, notepad, passwordgen, dice, timers, paint,
  led, morse, resistor, gates, sevenseg, scope, ohms, piano,
  projectile, pendulum, gears, beam, ph, orbit, bmi,
  sorting, tictactoe, snake, ecg, weather, alarm
].sort((a, b) => a.chapter - b.chapter || a.name.localeCompare(b.name));

const index = new Map(registry.map(m => [m.id, m]));
export function byId(id) { return index.get(id); }
