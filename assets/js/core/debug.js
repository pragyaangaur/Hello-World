/* A chapter jumper for development, behind ?debug in the address bar.
   A normal visitor never sees it and never triggers it by accident. */

import { h, mount } from './dom.js';
import { get, setChapter, update, applyDocumentAttributes } from './state.js';
import { modal } from './notify.js';

export function installDebug() {
  if (!new URLSearchParams(location.search).has('debug')) return;

  const bar = h('div', {
    style: {
      position: 'fixed', bottom: '.5rem', left: '.5rem', zIndex: '95',
      display: 'flex', gap: '.25rem', padding: '.3rem',
      background: 'var(--surface)', border: '1px solid var(--rule-2)',
      borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-2)', fontSize: '12px'
    }
  });

  const paint = () => {
    mount(bar,
      h('span.small.dim', { style: { padding: '.2rem .4rem' } }, 'ch'),
      ...[0, 1, 2, 3, 4, 5].map(n => h('button.btn.btn-sm', {
        type: 'button',
        style: n === get().chapter ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {},
        onclick: () => {
          update(s => { s.chapter = n; return s; });
          applyDocumentAttributes();
          location.reload();
        }
      }, String(n))),
      h('button.btn.btn-sm', { type: 'button', onclick: () => {
        modal({ title: 'State', body: h('pre.mono.small', { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '50vh', overflow: 'auto' } }, JSON.stringify(get(), null, 2)), actions: [{ label: 'Close', primary: true }] });
      } }, 'state')
    );
  };
  paint();
  document.body.appendChild(bar);
}
