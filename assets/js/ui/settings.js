import { h, mount, $ } from '../core/dom.js';
import { get, setting, factoryReset, applyDocumentAttributes, store, chapter } from '../core/state.js';
import { toast, confirmDialog, modal } from '../core/notify.js';
import { setTitle } from './shell.js';
import { registry } from '../modules/index.js';

function toggleRow(name, desc, key, onChange) {
  const input = h('input', {
    type: 'checkbox',
    checked: Boolean(setting(key)),
    onchange: e => { setting(key, e.target.checked); onChange && onChange(e.target.checked); }
  });
  return h('div.setting',
    h('div.s-main', h('div.s-name', name), h('div.s-desc', desc)),
    h('label.switch', { 'aria-label': name }, input, h('span.track'))
  );
}

export function mountSettings() {
  const view = $('#view');
  view.dataset.page = 'settings';
  setTitle('Settings');
  const s = get();
  const install = store.keep();

  const themeSel = h('select.select', {
    'aria-label': 'Theme',
    onchange: e => { setting('theme', e.target.value); applyDocumentAttributes(); },
    style: { maxWidth: '9rem' }
  },
    ...[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) =>
      h('option', { value: v, selected: s.settings.theme === v }, l))
  );

  const unlocked = registry.filter(m => chapter() >= m.chapter).length;

  mount(view, h('div.page',
    h('div.page-head', h('div.grow', h('h1', 'Settings'))),

    h('div.stack',
      h('div.card.flush',
        h('div.card-head', 'Appearance'),
        h('div.card-body', { style: { paddingTop: 0, paddingBottom: 0 } },
          h('div.setting',
            h('div.s-main', h('div.s-name', 'Theme'), h('div.s-desc', 'Light, dark, or whatever your system is set to.')),
            themeSel
          ),
          toggleRow('Calm mode', 'Turns off every visual effect and sudden sound. Nothing else changes.', 'calm', () => {
            applyDocumentAttributes();
            toast('Calm mode', setting('calm') ? 'Effects are off.' : 'Effects are back on.');
          }),
          toggleRow('Sound', 'Lets the tools that make noise make noise. Off by default.', 'sound')
        )
      ),

      h('div.card.flush',
        h('div.card-head', 'Tasks'),
        h('div.card-body', { style: { paddingTop: 0, paddingBottom: 0 } },
          toggleRow('Show completed tasks', 'Keep finished tasks in the list instead of hiding them.', 'showCompleted')
        )
      ),

      h('div.card.flush',
        h('div.card-head', 'Storage'),
        h('div.card-body',
          h('p.small.muted', 'Hello World keeps everything in this browser. Nothing is uploaded, and there is no account to sign into. Clearing your browser data clears the app.'),
          h('dl.kv',
            h('dt', 'Tasks stored'), h('dd', String(s.tasks.length)),
            ...(unlocked ? [h('dt', 'Tools available'), h('dd', String(unlocked))] : []),
            h('dt', 'First opened'), h('dd', new Date(s.installedAt).toLocaleDateString('en-GB')),
            h('dt', 'Storage'), h('dd', store.storageWorks?.() === false ? 'unavailable' : 'browser')
          ),
          h('div.row', { style: { marginTop: '1rem' } },
            h('button.btn', { type: 'button', onclick: exportData }, 'Export data'),
            h('button.btn.btn-danger', { type: 'button', onclick: async () => {
              const ok = await confirmDialog('Reset Hello World?',
                'This deletes your tasks, your notes, and your settings from this browser. It cannot be undone.',
                'Reset everything');
              if (ok) { factoryReset(); location.hash = '#/tasks'; location.reload(); }
            } }, 'Reset app')
          )
        )
      ),

      h('div.card.flush',
        h('div.card-head', 'About'),
        h('div.card-body',
          h('p.small.muted', 'Hello World, version 1.0.4. A to-do list app, and a small toolbox of things we built while learning.'),
          h('p.small.muted', install.resets ? `This browser has reset the app ${install.resets} ${install.resets === 1 ? 'time' : 'times'}.` : ''),
          h('div.row', h('a.btn.btn-sm', { href: '#/about' }, 'Credits'))
        )
      )
    )
  ));
}

function exportData() {
  const blob = new Blob([JSON.stringify(get(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'hello-world-data.json' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Exported', 'Your data was saved as a JSON file.');
}

export function mountAbout() {
  const view = $('#view');
  view.dataset.page = 'about';
  setTitle('About');
  const ch = chapter();
  mount(view, h('div.page',
    h('div.page-head', h('div.grow', h('h1', 'About Hello World'))),
    h('div.stack',
      h('div.card',
        h('p', 'Hello World started as a minor project. The brief was to build a to-do list, so we built a to-do list.'),
        h('p', 'Then we kept adding the other things we had made along the way, because deleting them felt worse than shipping them. That is the Toolbox.'),
        h('p.small.muted', ch >= 4
          ? 'Maintained by user_04 since 12 May 2024. Last human commit: 03 June 2024.'
          : 'Built at Meridian Institute of Technology. Version 1.0.4.')
      ),
      h('div.card.flush',
        h('div.card-head', 'Credits'),
        h('div.card-body',
          h('dl.kv',
            h('dt', 'Ira Sethi'), h('dd', { style: { fontFamily: 'inherit', textAlign: 'left' } }, 'interface, tasks'),
            h('dt', 'Nikhil Vaz'), h('dd', { style: { fontFamily: 'inherit', textAlign: 'left' } }, 'hardware tools, automation'),
            h('dt', 'Devika Rao'), h('dd', { style: { fontFamily: 'inherit', textAlign: 'left' } }, 'simulations, testing')
          )
        )
      ),
      h('div.card',
        h('p.small.muted', 'No trackers, no analytics, no network requests. Everything runs in your browser and stays there.')
      )
    )
  ));
}
