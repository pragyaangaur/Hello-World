/* The module registry. Every tool is a plain object with a mount function,
   so adding one is a single import and a single line. */

import calculator from './calculator.js';
import converter from './converter.js';
import notepad from './notepad.js';
import passwordgen from './passwordgen.js';
import dice from './dice.js';
import timers from './timers.js';
import paint from './paint.js';

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
  calculator, converter, notepad, passwordgen, dice, timers, paint
].sort((a, b) => a.chapter - b.chapter || a.name.localeCompare(b.name));

const index = new Map(registry.map(m => [m.id, m]));
export function byId(id) { return index.get(id); }
