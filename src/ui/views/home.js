import { h } from '../dom.js';
import { icon } from '../icons.js';

function featureCard({ href, iconName, title, description, points, action }) {
  return h(
    'a',
    { class: 'feature-card', href },
    h('span', { class: 'feature-card__icon' }, icon(iconName, 20)),
    h('h2', { class: 'feature-card__title' }, title),
    h('p', { class: 'feature-card__text' }, description),
    h('ul', { class: 'feature-card__points' }, points.map((point) => h('li', {}, icon('check', 14), point))),
    h('span', { class: 'feature-card__action' }, action, icon('arrowRight', 16)),
  );
}

export function renderHomeView(root) {
  root.append(
    h(
      'section',
      { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'Word and number tools'),
      h('h1', { class: 'hero__title', tabindex: '-1' }, 'Words, Patterns & Mathematical Magic.'),
      h(
        'p',
        { class: 'hero__lead' },
        'Explore anagrams and generate mathematical magic squares with simple, powerful tools.',
      ),
    ),
    h(
      'section',
      { class: 'feature-grid', 'aria-label': 'Tools' },
      featureCard({
        href: '#/anagram',
        iconName: 'letters',
        title: 'Anagram Solver',
        description: 'Rearrange any word or phrase into real English words, checked against a 172,000-word dictionary.',
        points: ['Full anagrams and shorter words', 'Two-word anagrams', 'Sort, filter and copy results'],
        action: 'Open Anagram Solver',
      }),
      featureCard({
        href: '#/magic-square',
        iconName: 'grid',
        title: 'Magic Square Generator',
        description: 'Build a square where every row, column and diagonal adds up to the same number.',
        points: ['Any size from 1 to 100 (except 2)', 'Every square is verified', 'Copy or download as CSV or text'],
        action: 'Open Magic Square Generator',
      }),
    ),
    h(
      'section',
      { class: 'fact-row', 'aria-label': 'Did you know' },
      h(
        'div',
        { class: 'fact' },
        h('p', { class: 'fact__label' }, 'Anagram'),
        h('p', { class: 'fact__text' }, '"Listen" and "silent" use exactly the same six letters.'),
      ),
      h(
        'div',
        { class: 'fact' },
        h('p', { class: 'fact__label' }, 'Magic constant'),
        h('p', { class: 'fact__text' }, 'A square of size n always sums to n(n² + 1) / 2. For 3×3 that is 15.'),
      ),
      h(
        'div',
        { class: 'fact' },
        h('p', { class: 'fact__label' }, 'Private by design'),
        h('p', { class: 'fact__text' }, 'Everything runs in your browser. Nothing you type is sent anywhere.'),
      ),
    ),
  );
}
