import { h, mount, pad2 } from '../core/dom.js';
import { tone } from '../core/audio.js';
import { toast } from '../core/notify.js';
import { emit } from '../core/bus.js';

function clockText(ms, showMs = false) {
  const total = Math.max(0, ms);
  const hrs = Math.floor(total / 3600000);
  const min = Math.floor(total / 60000) % 60;
  const sec = Math.floor(total / 1000) % 60;
  const cs = Math.floor(total / 10) % 100;
  const head = hrs ? `${hrs}:${pad2(min)}:${pad2(sec)}` : `${pad2(min)}:${pad2(sec)}`;
  return showMs ? `${head}.${pad2(cs)}` : head;
}

export default {
  id: 'timers',
  name: 'Stopwatch & timer',
  dept: 'Everyday',
  icon: '◷',
  chapter: 1,
  blurb: 'Stopwatch, countdown, pomodoro',

  mount(root) {
    let tab = 'stopwatch';
    let raf = null, interval = null;

    /* ---- stopwatch ---- */
    let swStart = 0, swElapsed = 0, swRunning = false, laps = [];
    const swView = h('div.readout.big', { style: { textAlign: 'center' } }, '00:00.00');
    const lapList = h('ul.task-list', { style: { marginTop: '.75rem' } });

    function swTick() {
      const ms = swElapsed + (swRunning ? performance.now() - swStart : 0);
      swView.textContent = clockText(ms, true);
      if (swRunning) raf = requestAnimationFrame(swTick);
    }
    function swToggle() {
      if (swRunning) { swElapsed += performance.now() - swStart; swRunning = false; cancelAnimationFrame(raf); }
      else { swStart = performance.now(); swRunning = true; swTick(); }
      paintStopwatch();
    }
    function swLap() {
      const ms = swElapsed + (swRunning ? performance.now() - swStart : 0);
      const prev = laps.length ? laps[0].total : 0;
      laps = [{ n: laps.length + 1, total: ms, split: ms - prev }, ...laps];
      emit('stopwatch:lap', laps[0]);
      paintLaps();
    }
    function paintLaps() {
      mount(lapList, ...laps.map(l => h('li.task', { style: { padding: '.4rem .6rem' } },
        h('span.small.dim', { style: { width: '3rem' } }, 'Lap ' + l.n),
        h('span.mono', { style: { flex: 1 } }, clockText(l.split, true)),
        h('span.mono.small.dim', clockText(l.total, true))
      )));
    }
    const swButtons = h('div.row', { style: { justifyContent: 'center', marginTop: '.75rem' } });
    function paintStopwatch() {
      mount(swButtons,
        h('button.btn.btn-primary', { type: 'button', onclick: swToggle }, swRunning ? 'Stop' : (swElapsed ? 'Resume' : 'Start')),
        h('button.btn', { type: 'button', disabled: !swRunning, onclick: swLap }, 'Lap'),
        h('button.btn.btn-ghost', { type: 'button', onclick: () => {
          swRunning = false; cancelAnimationFrame(raf); swElapsed = 0; laps = [];
          swView.textContent = '00:00.00'; paintLaps(); paintStopwatch();
        } }, 'Reset')
      );
    }

    /* ---- countdown ---- */
    let cdEnd = 0, cdRemaining = 5 * 60000, cdRunning = false;
    const cdView = h('div.readout.big', { style: { textAlign: 'center' } }, clockText(cdRemaining));
    const cdButtons = h('div.row', { style: { justifyContent: 'center', marginTop: '.75rem' } });
    function cdTick() {
      cdRemaining = Math.max(0, cdEnd - Date.now());
      cdView.textContent = clockText(cdRemaining);
      if (cdRemaining === 0) {
        cdRunning = false; clearInterval(interval);
        for (let i = 0; i < 3; i++) setTimeout(() => tone(880, 0.22, 'square'), i * 300);
        toast('Timer finished', 'Time is up.');
        emit('timer:done');
        paintCountdown();
      }
    }
    function paintCountdown() {
      mount(cdButtons,
        h('button.btn.btn-primary', { type: 'button', onclick: () => {
          if (cdRunning) { cdRunning = false; clearInterval(interval); }
          else { cdEnd = Date.now() + cdRemaining; cdRunning = true; interval = setInterval(cdTick, 200); }
          paintCountdown();
        } }, cdRunning ? 'Pause' : 'Start'),
        h('button.btn.btn-ghost', { type: 'button', onclick: () => {
          cdRunning = false; clearInterval(interval); cdRemaining = 5 * 60000; cdView.textContent = clockText(cdRemaining); paintCountdown();
        } }, 'Reset')
      );
    }
    const cdPresets = h('div.row.tight', { style: { justifyContent: 'center' } },
      ...[1, 3, 5, 10, 15, 25, 45].map(m => h('button.btn.btn-sm', { type: 'button', onclick: () => {
        cdRunning = false; clearInterval(interval);
        cdRemaining = m * 60000; cdView.textContent = clockText(cdRemaining); paintCountdown();
      } }, m + 'm'))
    );

    /* ---- pomodoro ---- */
    let pomPhase = 'focus', pomLeft = 25 * 60000, pomRunning = false, pomDone = 0, pomTimer = null;
    const pomView = h('div.readout.big', { style: { textAlign: 'center' } }, clockText(pomLeft));
    const pomLabel = h('div.small.dim', { style: { textAlign: 'center' } }, 'Focus · 25 minutes');
    const pomButtons = h('div.row', { style: { justifyContent: 'center', marginTop: '.75rem' } });
    function pomTick() {
      pomLeft -= 250;
      if (pomLeft <= 0) {
        tone(660, 0.25, 'sine');
        if (pomPhase === 'focus') { pomDone++; pomPhase = pomDone % 4 === 0 ? 'long' : 'short'; }
        else pomPhase = 'focus';
        pomLeft = pomPhase === 'focus' ? 25 * 60000 : pomPhase === 'short' ? 5 * 60000 : 15 * 60000;
        pomLabel.textContent = pomPhase === 'focus' ? `Focus · ${pomDone} done` : pomPhase === 'short' ? 'Short break' : 'Long break';
        toast('Pomodoro', pomPhase === 'focus' ? 'Back to work.' : 'Take a break.');
      }
      pomView.textContent = clockText(pomLeft);
    }
    function paintPom() {
      mount(pomButtons,
        h('button.btn.btn-primary', { type: 'button', onclick: () => {
          if (pomRunning) { pomRunning = false; clearInterval(pomTimer); }
          else { pomRunning = true; pomTimer = setInterval(pomTick, 250); }
          paintPom();
        } }, pomRunning ? 'Pause' : 'Start'),
        h('button.btn.btn-ghost', { type: 'button', onclick: () => {
          pomRunning = false; clearInterval(pomTimer);
          pomPhase = 'focus'; pomLeft = 25 * 60000; pomDone = 0;
          pomView.textContent = clockText(pomLeft); pomLabel.textContent = 'Focus · 25 minutes'; paintPom();
        } }, 'Reset')
      );
    }

    const panels = {
      stopwatch: h('div.card', swView, swButtons, lapList),
      countdown: h('div.card', cdView, cdButtons, h('div', { style: { marginTop: '.75rem' } }, cdPresets)),
      pomodoro: h('div.card', pomView, pomLabel, pomButtons)
    };

    const tabs = h('div.tabs', { role: 'tablist' });
    const slot = h('div');
    function paintTabs() {
      mount(tabs, ...Object.keys(panels).map(k => h('button.tab', {
        type: 'button', role: 'tab', 'aria-selected': String(k === tab),
        onclick: () => { tab = k; paintTabs(); mount(slot, panels[tab]); }
      }, k[0].toUpperCase() + k.slice(1))));
    }
    paintTabs();
    paintStopwatch(); paintCountdown(); paintPom();
    mount(slot, panels[tab]);
    mount(root, tabs, slot);

    return () => { cancelAnimationFrame(raf); clearInterval(interval); clearInterval(pomTimer); };
  }
};
