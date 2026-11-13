import { h } from '../dom.js';
import { icon } from '../icons.js';

export function renderNotFoundView(root) {
  root.append(
    h(
      'div',
      { class: 'state state--page' },
      h('span', { class: 'state__icon' }, icon('search', 20)),
      h('h1', { class: 'state__title', tabindex: '-1' }, 'Page not found'),
      h('p', { class: 'state__text' }, 'That address does not match any page in Anagram Magic.'),
      h('a', { class: 'button button--primary', href: '#/' }, 'Go to Home'),
    ),
  );
}
