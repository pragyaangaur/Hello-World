/* A small shell over the archive. It is deliberately forgiving: tab
   completes, up and down recall history, and typing a bare filename opens
   it, because the point is reading the files rather than fighting a prompt. */

import { h, mount, $ } from '../core/dom.js';
import { FS, readFile, isDir, listDir } from '../story/archive.js';
import { get, update, chapter } from '../core/state.js';
import { ANCHORS, human, daysSince, NOW } from '../story/cast.js';
import { setTitle } from './shell.js';

const HELP = `Commands

  ls [path]        list a directory
  cd <path>        change directory
  cat <file>       print a file
  grep <text>      find that text anywhere in the archive
  tree             show everything at once
  pwd              print the working directory
  whoami           who this session belongs to
  uptime           how long this session has been open
  ps               what is running
  date             the system date
  clear            clear the screen
  help             this

Tab completes a name. Up and down walk your history.
Typing a filename on its own prints it.`;

function join(cwd, arg) {
  if (!arg) return cwd;
  const raw = arg.startsWith('/') ? arg : (cwd === '/' ? '/' + arg : cwd + '/' + arg);
  const parts = [];
  for (const p of raw.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') parts.pop();
    else parts.push(p);
  }
  return '/' + parts.join('/');
}

export function mountConsole() {
  /* The archive is reachable only once the incident key has been generated,
     because that is what act five is for. */
  if (chapter() < 6) {
    const locked = $('#view');
    locked.dataset.page = 'console';
    mount(locked, h('div.page', h('div.empty',
      h('div.big', '•••'),
      h('p', 'The archive needs a key. Generate one in the password tool and put it on the list.'),
      h('a.btn', { href: '#/tools/passwordgen' }, 'Password generator')
    )));
    return;
  }

  const view = $('#view');
  view.dataset.page = 'console';
  setTitle('Console');

  let cwd = '/';
  const history = [];
  let hIndex = -1;

  const screen = h('div.term-screen', { tabindex: '0' });
  const input = h('input.term-input', {
    type: 'text', 'aria-label': 'Console input',
    spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off'
  });
  const promptEl = h('span.term-prompt', 'user_04@4b:/$');

  function write(text, cls = '') {
    const line = h('div.term-line' + (cls ? '.' + cls : ''), text);
    screen.appendChild(line);
    screen.scrollTop = screen.scrollHeight;
    return line;
  }
  function writeBlock(text, cls = '') {
    for (const l of String(text).split('\n')) write(l === '' ? '\u00a0' : l, cls);
  }

  function setPrompt() { promptEl.textContent = `user_04@4b:${cwd}$`; }

  function complete() {
    const raw = input.value;
    const bits = raw.split(' ');
    const last = bits[bits.length - 1];
    const dir = last.includes('/') ? join(cwd, last.slice(0, last.lastIndexOf('/'))) : cwd;
    const stub = last.includes('/') ? last.slice(last.lastIndexOf('/') + 1) : last;
    const names = listDir(dir) || [];
    const hits = names.filter(n => n.startsWith(stub));
    if (hits.length === 1) {
      bits[bits.length - 1] = last.slice(0, last.length - stub.length) + hits[0];
      input.value = bits.join(' ');
    } else if (hits.length > 1) {
      write(promptEl.textContent + ' ' + raw, 'echo');
      write(hits.join('   '));
    }
  }

  function tree(path = '/', depth = 0) {
    const names = listDir(path);
    if (!names) return;
    for (const n of names) {
      const full = join(path, n);
      write('  '.repeat(depth) + (isDir(full) ? n + '/' : n), isDir(full) ? 'dir' : '');
      if (isDir(full)) tree(full, depth + 1);
    }
  }

  function openFile(path) {
    const file = readFile(path);
    if (!file) return false;
    write('');
    writeBlock(file.body, 'file');
    write('');
    update(s => { s.reads = { ...s.reads, [path]: true }; return s; });
    return true;
  }

  function run(raw) {
    const line = raw.trim();
    write(promptEl.textContent + ' ' + raw, 'echo');
    if (!line) return;
    /* Running the same command twice should not put two of it in the
       history, because walking back up then takes two presses to get past
       one line. */
    if (history[0] !== line) history.unshift(line);
    if (history.length > 100) history.length = 100;
    hIndex = -1;

    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ');

    switch (cmd) {
      case 'help': case '?': writeBlock(HELP); break;
      case 'clear': mount(screen); break;
      case 'pwd': write(cwd); break;

      case 'ls': {
        const target = join(cwd, arg);
        const names = listDir(target);
        if (!names) {
          if (isDir(target)) write('(empty)');
          else write(`ls: ${arg || target}: no such directory`, 'err');
          break;
        }
        for (const n of names) write(isDir(join(target, n)) ? n + '/' : n, isDir(join(target, n)) ? 'dir' : '');
        break;
      }

      case 'cd': {
        const target = arg ? join(cwd, arg) : '/';
        if (!isDir(target)) { write(`cd: ${arg}: no such directory`, 'err'); break; }
        cwd = target; setPrompt();
        break;
      }

      case 'cat': case 'less': case 'open': {
        if (!arg) { write('cat: which file?', 'err'); break; }
        if (!openFile(join(cwd, arg))) write(`cat: ${arg}: no such file`, 'err');
        break;
      }

      /* The archive is nine files and the answer to the last two acts is
         somewhere in them. Reading all nine to find the word ceiling is a
         chore rather than a puzzle, so the shell can look for it. */
      case 'grep': case 'find': case 'search': {
        if (!arg) { write('grep: what are you looking for?', 'err'); break; }
        const needle = arg.toLowerCase();
        let hits = 0;
        for (const path of Object.keys(FS)) {
          const file = readFile(path);
          if (!file) continue;
          String(file.body).split('\n').forEach((text, i) => {
            if (!text.toLowerCase().includes(needle)) return;
            hits++;
            write(`${path}:${i + 1}`, 'dir');
            write('  ' + text.trim());
          });
        }
        write('');
        if (hits) write(`${hits} ${hits === 1 ? 'line' : 'lines'} in the archive.`);
        else write(`Nothing in the archive says "${arg}".`, 'err');
        break;
      }

      case 'tree': tree('/'); break;

      case 'whoami':
        writeBlock(`user_04\n\nCreated ${human(ANCHORS.projectStart)}.\nNot assigned to a person.\nLast interactive login before this session: never.`);
        break;

      case 'uptime': {
        const d = daysSince(ANCHORS.lastHuman);
        writeBlock(`session open ${Math.floor(d / 365)}y ${d % 365}d\nlast human login on any account: ${human(ANCHORS.lastHuman)}\nlogins by user_04 since then: ${d}`);
        break;
      }

      case 'ps':
        writeBlock(
`  PID  STARTED       COMMAND
    1   ${human(ANCHORS.lastHuman)}   helloworld  serving :80
   14   ${human(ANCHORS.lastHuman)}   benchlink   10.14.4.62:8140
  902   04:10 today   maint.py    state=AWAITING_OPERATOR`);
        break;

      case 'date': write(NOW.toString()); break;

      default: {
        const asFile = join(cwd, cmd);
        if (FS[asFile]) { openFile(asFile); break; }
        if (isDir(asFile)) { cwd = asFile; setPrompt(); break; }
        write(`${cmd}: command not found. Try help.`, 'err');
      }
    }
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hIndex < history.length - 1) input.value = history[++hIndex]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); input.value = hIndex > 0 ? history[--hIndex] : (hIndex = -1, ''); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); mount(screen); }
  });

  const quick = h('div.row.tight');
  for (const cmd of ['help', 'tree', 'grep bay 3', 'whoami', 'uptime', 'ps',
                     'cat /opt/rig/maint.py', 'cat /opt/rig/maint.log',
                     'cat /lab4b/bench.conf', 'cat /lab4b/cell-datasheet.txt',
                     'cat /team/chat-export.txt', 'cat /team/handover.md', 'cat /team/tasks.json']) {
    quick.appendChild(h('button.btn.btn-sm.mono', { type: 'button', onclick: () => { run(cmd); input.focus(); } },
      cmd.startsWith('cat ') ? cmd.split('/').pop() : cmd));
  }

  mount(view, h('div.page.wide',
    h('div.page-head', h('div.grow',
      h('h1', 'Console'),
      h('p', 'A shell on whatever this app is still connected to. Read the files. Nothing here is locked.')
    )),
    h('div.term',
      screen,
      h('div.term-row', promptEl, input)
    ),
    h('p.small.dim', { style: { marginTop: '.75rem' } }, 'Shortcuts:'),
    quick
  ));

  setPrompt();
  writeBlock(
`Hello World console, build 1.0.4
Connected to bench controller 10.14.4.62:8140.

You are signed in as user_04.
Type help to see what you can do, or use the buttons below the window.`);
  write('');
  if (Object.keys(get().reads || {}).length === 0) write('Start with: cat /opt/rig/maint.log', 'hint');
  write('');
  setTimeout(() => input.focus(), 60);
}
