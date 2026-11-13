import { generateMagicSquare, magicConstant } from '../../lib/magic-square.js';
import { createSquareGrid } from '../components/square-grid.js';
import { shufflingTiles } from '../components/tiles.js';
import { h, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { routeHref } from '../route.js';

/** One real anagram family, shown as moving tiles. */
const DEMO_WORDS = ['LISTEN', 'SILENT', 'TINSEL', 'ENLIST', 'INLETS'];
const DEMO_ORDERS = [3, 4, 5];
const AUTO_SHUFFLE_MS = 2600;

function anagramPreview(onDispose) {
  const tiles = shufflingTiles(DEMO_WORDS[0]);
  const caption = h('p', { class: 'preview__caption' });
  let index = 0;
  let timer = null;

  function show(next) {
    index = next % DEMO_WORDS.length;
    tiles.setWord(DEMO_WORDS[index]);
    setChildren(caption, 'listen', h('span', { class: 'preview__arrow', 'aria-hidden': 'true' }, '→'), h('strong', {}, DEMO_WORDS[index].toLowerCase()));
  }
  show(1);

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    timer = setInterval(() => show(index + 1), AUTO_SHUFFLE_MS);
    onDispose(() => clearInterval(timer));
  }

  const input = h('input', {
    id: 'home-word', class: 'input', type: 'text', placeholder: 'Try your own word', maxlength: '80',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Word to solve',
  });
  const form = h(
    'form',
    {
      class: 'preview__form',
      onSubmit: (event) => {
        event.preventDefault();
        const word = input.value.trim();
        location.hash = word ? routeHref('/anagram', { q: word }) : routeHref('/anagram');
      },
    },
    input,
    h('button', { class: 'button button--primary', type: 'submit' }, 'Solve'),
  );

  return h(
    'article',
    { class: 'preview preview--words' },
    h('p', { class: 'preview__kicker' }, 'Anagram Solver'),
    h('h2', { class: 'preview__title' }, 'Same letters, new words'),
    h(
      'div',
      { class: 'preview__stage' },
      tiles.element,
      h('p', { class: 'sr-only' }, 'The letters of “listen” rearrange into silent, tinsel, enlist and inlets.'),
      caption,
      h('button', {
        class: 'button button--quiet', type: 'button',
        onClick: () => { clearInterval(timer); show(index + 1); },
      }, icon('reset', 15), 'Rearrange'),
    ),
    h('p', { class: 'preview__text' }, 'Every result is a real word from a 172,000-word dictionary, with the most common words first.'),
    form,
  );
}

function magicPreview(onDispose) {
  const stage = h('div', { class: 'preview__grid' });
  const constant = h('strong', { class: 'preview__constant' });
  let grid = null;
  const sizeButtons = DEMO_ORDERS.map((order) =>
    h('button', { class: 'chip chip--toggle', type: 'button', 'aria-pressed': 'false', onClick: () => show(order) }, `${order} × ${order}`),
  );

  function show(order) {
    grid?.destroy();
    grid = createSquareGrid({ order, label: `Magic square of size ${order}. Select a cell to trace its lines.`, maxCell: 52 });
    grid.setValues(generateMagicSquare(order));
    setChildren(stage, grid.element);
    grid.fit();
    const middle = Math.floor((order - 1) / 2);
    grid.select({ row: middle, column: middle }, { notify: false });
    constant.textContent = String(magicConstant(order));
    sizeButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(DEMO_ORDERS[index] === order)));
  }
  onDispose(() => grid?.destroy());

  const card = h(
    'article',
    { class: 'preview preview--numbers' },
    h('p', { class: 'preview__kicker' }, 'Magic Square'),
    h('h2', { class: 'preview__title' }, 'Every line, the same sum'),
    h(
      'div',
      { class: 'preview__stage' },
      stage,
      h('p', { class: 'preview__caption' }, 'Each row, column and diagonal adds up to ', constant),
      h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Preview size' }, sizeButtons),
    ),
    h('p', { class: 'preview__text' }, 'Tap a cell to trace its lines. Build any size up to 100 and watch it take shape step by step.'),
    h('a', { class: 'button button--primary preview__link', href: '#/magic-square' }, 'Build a square', icon('arrowRight', 16)),
  );
  // The grid measures its container, so fill it once the card is in the page.
  queueMicrotask(() => show(3));
  return card;
}

export function renderHomeView(root) {
  const disposers = [];
  const onDispose = (dispose) => disposers.push(dispose);

  root.append(
    h(
      'section',
      { class: 'hero' },
      h(
        'h1',
        { class: 'hero__title', tabindex: '-1' },
        'Letters ', h('em', {}, 'rearranged.'), h('br'), 'Numbers ', h('em', {}, 'balanced.'),
      ),
      h(
        'p',
        { class: 'hero__lead' },
        'Anagram Magic finds the real words hiding in any set of letters, and builds magic squares where every row, column and diagonal adds up the same.',
      ),
    ),
    h('section', { class: 'preview-grid', 'aria-label': 'Tools' }, anagramPreview(onDispose), magicPreview(onDispose)),
    h('p', { class: 'home-note' }, 'Free, and private: everything runs in your browser. Nothing you type is sent anywhere.'),
  );

  return () => disposers.forEach((dispose) => dispose());
}
