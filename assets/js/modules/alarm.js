import { h, mount, pad2 } from '../core/dom.js';
import { tone } from '../core/audio.js';
import { toast } from '../core/notify.js';
import { get, update, chapter } from '../core/state.js';
import { ANCHORS, daysSince } from '../story/cast.js';

function nextRing(hh, mm) {
  const now = new Date();
  const d = new Date(now);
  d.setHours(hh, mm, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}
function untilText(target) {
  const ms = target - Date.now();
  const h_ = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  return `in ${h_}h ${m}m`;
}

export default {
  id: 'alarm',
  name: 'Alarm clock',
  dept: 'Everyday',
  icon: '⏰',
  chapter: 3,
  blurb: 'Set one, and see the old one',

  mount(root) {
    const ch = chapter();
    let alarms = get().alarms || [];
    if (!alarms.length) {
      alarms = [{ id: 'a_sys', hh: 4, mm: 10, label: 'maint.py', on: true, system: true }];
      update(s => { s.alarms = alarms; return s; });
    }

    const clock = h('div.readout.big', { style: { textAlign: 'center' } }, '');
    const list = h('div.stack');
    let ticker = null;

    function save() { update(s => { s.alarms = alarms; return s; }); }

    function tick() {
      const d = new Date();
      clock.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      for (const a of alarms) {
        if (!a.on || a.system) continue;
        if (d.getHours() === a.hh && d.getMinutes() === a.mm && d.getSeconds() === 0) {
          for (let i = 0; i < 6; i++) setTimeout(() => tone(880, 0.2, 'square', 0.7), i * 320);
          toast('Alarm', a.label || `${pad2(a.hh)}:${pad2(a.mm)}`);
        }
      }
      paint();
    }

    function paint() {
      mount(list, ...alarms.map(a => h('div.setting',
        h('div.s-main',
          h('div.s-name.mono', `${pad2(a.hh)}:${pad2(a.mm)}`),
          h('div.s-desc', a.system
            ? (ch >= 4
                ? `${a.label} · has run every day for ${daysSince(ANCHORS.lastHuman)} days`
                : `${a.label} · daily`)
            : (a.label || 'Alarm') + ' · ' + (a.on ? untilText(nextRing(a.hh, a.mm)) : 'off'))
        ),
        a.system ? h('span.badge.auto', 'system') : null,
        h('label.switch', { 'aria-label': 'Enable alarm' },
          h('input', { type: 'checkbox', checked: a.on, disabled: a.system,
            onchange: e => { a.on = e.target.checked; save(); paint(); } }),
          h('span.track')),
        a.system ? null : h('button.icon-btn', { type: 'button', 'aria-label': 'Delete alarm',
          onclick: () => { alarms = alarms.filter(x => x !== a); save(); paint(); } }, '×')
      )));
    }

    const timeIn = h('input.input', { type: 'time', value: '07:30', 'aria-label': 'Alarm time', style: { maxWidth: '8rem' } });
    const labelIn = h('input.input', { placeholder: 'Label', 'aria-label': 'Alarm label' });

    mount(root,
      h('div.card', clock),
      h('div.card.flush',
        h('div.card-head', 'Alarms'),
        h('div.card-body', { style: { paddingTop: 0, paddingBottom: 0 } }, list)),
      h('div.card',
        h('div.row', timeIn, labelIn,
          h('button.btn.btn-primary', { type: 'button', onclick: () => {
            const [hh, mm] = timeIn.value.split(':').map(Number);
            if (!Number.isFinite(hh)) return;
            alarms = [...alarms, { id: 'a_' + Date.now().toString(36), hh, mm, label: labelIn.value.trim(), on: true }];
            labelIn.value = '';
            save(); paint();
          } }, 'Add'))),
      ch >= 4
        ? h('p.small.dim', 'The 04:10 entry is not really an alarm. It is the cron entry that logs in as user_04, and it is listed here because whoever wrote this screen listed everything the app schedules.')
        : h('p.small.dim', 'Alarms only ring while this tab is open, because the app has no server and no notification permission.')
    );
    tick();
    ticker = setInterval(tick, 1000);
    return () => clearInterval(ticker);
  }
};
