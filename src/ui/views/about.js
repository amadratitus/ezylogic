import { MAX_LETTERS } from '../../lib/anagram.js';
import { MAX_ORDER } from '../../lib/magic-square.js';
import { h } from '../dom.js';

function section(title, ...children) {
  return h('section', { class: 'prose-section' }, h('h2', {}, title), children);
}

export function renderAboutView(root) {
  root.append(
    h(
      'header',
      { class: 'page-header' },
      h('h1', { tabindex: '-1' }, 'About'),
      h('p', { class: 'page-header__lead' }, 'What Anagram Magic does, how it works, and where its limits are.'),
    ),
    h(
      'div',
      { class: 'prose' },
      section(
        'What it is',
        h(
          'p',
          {},
          'Anagram Magic is two small tools in one place: an anagram solver and a magic square generator. ',
          'It runs entirely in your browser, so nothing you type leaves your device.',
        ),
      ),
      section(
        'How the anagram solver works',
        h(
          'p',
          {},
          'Your input is reduced to its letters A–Z. Case, spaces, digits and punctuation are ignored. ',
          'The solver then checks dictionary words of each allowed length and keeps those that can be spelled ',
          'from your letters, never using a letter more often than you supplied it. ',
          'Words that use every letter are full anagrams; shorter ones use only some of the letters.',
        ),
        h(
          'p',
          {},
          'Two-word anagrams pair up words that together use every letter exactly once. ',
          'Only real dictionary words are ever shown.',
        ),
      ),
      section(
        'The dictionary',
        h(
          'p',
          {},
          'The word list is ENABLE (Enhanced North American Benchmark Lexicon), 172,823 words, ',
          'compiled by Alan Beale and M. Cooper and released into the public domain.',
        ),
        h(
          'ul',
          {},
          h('li', {}, 'English only, with North American spellings.'),
          h('li', {}, 'No proper nouns, abbreviations or hyphenated words.'),
          h('li', {}, 'No one-letter words, so "a" and "I" never appear in results.'),
          h('li', {}, 'It includes inflected forms and some rare words used in word games.'),
        ),
      ),
      section(
        'How the magic squares are built',
        h(
          'p',
          {},
          'A normal magic square of size n uses each number from 1 to n² once. Every row, every column and both ',
          'main diagonals add up to the magic constant n(n² + 1) / 2. The method depends on the size:',
        ),
        h(
          'ul',
          {},
          h('li', {}, h('strong', {}, 'Odd sizes (3, 5, 7…): '), 'the Siamese method. Start in the middle of the top row and keep moving up and to the right, wrapping around the edges. When a cell is taken, step down one instead.'),
          h('li', {}, h('strong', {}, 'Multiples of 4 (4, 8, 12…): '), 'write 1 to n² in order, then replace every number on the diagonals of each 4×4 block with n² + 1 minus that number.'),
          h('li', {}, h('strong', {}, 'Other even sizes (6, 10, 14…): '), 'Strachey’s method. Four odd squares fill the quarters, then a few columns are swapped between the top and bottom halves.'),
        ),
        h('p', {}, 'Each square is checked after it is built: the numbers, every row, every column and both diagonals.'),
      ),
      section(
        'Limits',
        h(
          'ul',
          {},
          h('li', {}, `Anagram input: 2 to ${MAX_LETTERS} letters.`),
          h('li', {}, 'Two-word anagrams: the first 500 are shown.'),
          h('li', {}, `Magic squares: sizes 1 to ${MAX_ORDER}. Size 2 is impossible, not unsupported: no 2×2 magic square exists.`),
          h('li', {}, 'One square is generated per size. Other valid squares of the same size exist.'),
        ),
      ),
    ),
  );
}
