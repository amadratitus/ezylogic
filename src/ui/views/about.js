import { MAX_LETTERS } from '../../lib/anagram.js';
import { MAX_ORDER, MAX_STEP_ORDER } from '../../lib/magic-square.js';
import { h } from '../dom.js';

function card(title, ...children) {
  return h('section', { class: 'card prose-card' }, h('h2', { class: 'prose-card__title' }, title), children);
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
      { class: 'prose-grid' },
      card(
        'How the anagram solver works',
        h('p', {}, 'Your input is reduced to its letters A–Z. Capitals, spaces, digits and punctuation are ignored.'),
        h('p', {}, 'The solver keeps every dictionary word that can be spelled from those letters without using any letter more often than you supplied it. Words that use every letter are anagrams. Two-word anagrams are pairs that use every letter exactly once between them.'),
        h('p', {}, 'Ranking only changes the order. Common words come first and rare ones are tucked away, but nothing valid is dropped.'),
      ),
      card(
        'The word lists',
        h('p', {}, h('strong', {}, 'Words: '), 'ENABLE (Enhanced North American Benchmark Lexicon), 172,823 words, by Alan Beale and M. Cooper. Public domain.'),
        h('p', {}, h('strong', {}, 'Commonness: '), 'SCOWL by Kevin Atkinson, used to decide which words are common, familiar or rare. Free to use with attribution.'),
        h(
          'ul',
          {},
          h('li', {}, 'English only, with North American spellings.'),
          h('li', {}, 'No proper nouns, abbreviations or hyphenated words.'),
          h('li', {}, 'No one-letter words, so “a” and “I” never appear.'),
        ),
      ),
      card(
        'How the magic squares are built',
        h('p', {}, 'A magic square of size n uses each number from 1 to n² once. Every row, every column and both main diagonals add up to ', h('span', { class: 'math' }, 'n(n² + 1) / 2'), '.'),
        h(
          'ul',
          {},
          h('li', {}, h('strong', {}, 'Odd sizes: '), 'the Siamese method. Move up and to the right, wrapping around the edges; step down when a cell is taken.'),
          h('li', {}, h('strong', {}, 'Multiples of 4: '), 'write the numbers in order, then swap the diagonals of every 4×4 block for their complements.'),
          h('li', {}, h('strong', {}, 'Other even sizes: '), 'Strachey’s method. Four odd squares, then a few column swaps.'),
        ),
        h('p', {}, 'Each square is checked after it is built: the numbers, every row, every column and both diagonals.'),
      ),
      card(
        'Limits',
        h(
          'ul',
          {},
          h('li', {}, `Anagram input: 2 to ${MAX_LETTERS} letters.`),
          h('li', {}, 'Two-word anagrams: the best 500 pairs are listed.'),
          h('li', {}, `Magic squares: sizes 1 to ${MAX_ORDER}. Size 2 is impossible, not unsupported.`),
          h('li', {}, `Step-by-step construction: up to ${MAX_STEP_ORDER} × ${MAX_STEP_ORDER}.`),
          h('li', {}, 'One square is generated per size, though others exist.'),
        ),
        h('p', {}, 'Fonts: Fraunces, DM Sans and JetBrains Mono, all under the SIL Open Font License.'),
      ),
    ),
  );
}
