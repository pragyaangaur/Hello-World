/* Toasts and modal dialogs. */

import { h, $, clear } from './dom.js';

const holder = () => $('#toasts');

export function toast(title, body, { kind = '', ms = 4200 } = {}) {
  const el = h('div.toast' + (kind ? '.' + kind : ''),
    h('div.t-title', title),
    body ? h('div.t-body', body) : null
  );
  holder().appendChild(el);
  const life = ms;
  setTimeout(() => {
    el.style.transition = 'opacity 200ms, transform 200ms';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  }, life);
  return el;
}

let openDialog = null;

export function modal({ title, body, actions = [], dismissable = true, wide = false }) {
  close();
  const card = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
  if (wide) card.style.maxWidth = '46rem';
  if (title) card.appendChild(h('h2', title));
  if (body) card.appendChild(body instanceof Node ? body : h('div', h('p', body)));
  if (actions.length) {
    const bar = h('div.modal-actions');
    for (const a of actions) {
      bar.appendChild(h('button.btn' + (a.primary ? '.btn-primary' : a.danger ? '.btn-danger' : ''), {
        type: 'button',
        onclick: () => { const keep = a.onClick && a.onClick(); if (!keep) close(); }
      }, a.label));
    }
    card.appendChild(bar);
  }
  const back = h('div.modal-backdrop', {
    onclick: e => { if (dismissable && e.target === back) close(); }
  }, card);

  const onKey = e => {
    if (e.key === 'Escape' && dismissable) close();
    if (e.key === 'Tab') trap(e, card);
  };
  addEventListener('keydown', onKey);
  openDialog = { back, onKey };
  $('#modal-root').appendChild(back);
  (card.querySelector('button, input, textarea, a[href]') || card).focus?.();
  return { close, card };
}

function trap(e, root) {
  const items = root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function close() {
  if (!openDialog) return;
  removeEventListener('keydown', openDialog.onKey);
  openDialog.back.remove();
  openDialog = null;
  clear($('#modal-root'));
}

export function confirmDialog(title, message, confirmLabel = 'Confirm') {
  return new Promise(resolve => {
    modal({
      title,
      body: h('div', h('p', message)),
      actions: [
        { label: 'Cancel', onClick: () => resolve(false) },
        { label: confirmLabel, danger: true, onClick: () => resolve(true) }
      ]
    });
  });
}
