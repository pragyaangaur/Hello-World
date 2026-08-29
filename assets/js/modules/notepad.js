import { h, mount, debounce } from '../core/dom.js';
import { get, update } from '../core/state.js';
import { emit } from '../core/bus.js';

export default {
  id: 'notepad',
  name: 'Notes',
  dept: 'Everyday',
  icon: '✎',
  chapter: 1,
  blurb: 'A page that saves itself',

  mount(root) {
    const area = h('textarea.textarea', {
      placeholder: 'Start typing. It saves as you go.',
      'aria-label': 'Notes',
      style: { minHeight: '22rem', lineHeight: '1.7' }
    });
    area.value = get().notes || '';

    const status = h('span.small.dim', 'Saved');
    const stats = h('span.small.dim');

    const recalc = () => {
      const text = area.value;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const lines = text ? text.split('\n').length : 0;
      stats.textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${text.length} characters · ${lines} ${lines === 1 ? 'line' : 'lines'}`;
    };

    const persist = debounce(() => {
      update(s => { s.notes = area.value; return s; });
      status.textContent = 'Saved';
      emit('notes:save', area.value);
    }, 450);

    area.addEventListener('input', () => {
      status.textContent = 'Saving…';
      recalc();
      persist();
    });

    recalc();

    mount(root,
      h('div.card.flush',
        h('div.card-head', 'Untitled note', h('span.spacer'), status),
        h('div', { style: { padding: '0' } }, area)
      ),
      h('div.row', stats, h('span.spacer'),
        h('button.btn.btn-sm', { type: 'button', onclick: () => {
          const blob = new Blob([area.value], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = h('a', { href: url, download: 'notes.txt' });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        } }, 'Download')
      )
    );
    area.style.border = 'none';
    area.style.borderRadius = '0';
    area.style.background = 'transparent';
    area.style.padding = 'var(--sp-4)';
  }
};
