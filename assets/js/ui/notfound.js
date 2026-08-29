import { h, mount, $ } from '../core/dom.js';
import { chapter } from '../core/state.js';

export function mountNotFound() {
  const view = $('#view');
  view.dataset.page = '404';
  const ch = chapter();
  mount(view, h('div.page',
    h('div.empty',
      h('div.big', '404'),
      h('p', 'There is nothing at that address.'),
      ch >= 4
        ? h('p.small.mono.dim', 'GET ' + location.hash + ' → 404 · logged by user_04 · this is the eleventh time today')
        : null,
      h('a.btn', { href: '#/tasks' }, 'Back to your tasks')
    )
  ));
}
