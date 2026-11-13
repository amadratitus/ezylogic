import { MAX_LETTERS, parseAnagramInput, solveAnagram, sortWords } from '../../lib/anagram.js';
import { loadDictionary } from '../../services/dictionary.js';
import { createRecentList } from '../../services/storage.js';
import { formatNumber, h, plural, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { copyWithToast } from '../toast.js';

const EXAMPLES = ['listen', 'triangle', 'dirty room', 'stressed', 'astronomer'];
const DEFAULT_MIN_LENGTH = 3;
/** Words rendered per group before a "Show all" button appears. */
const GROUP_PREVIEW_SIZE = 240;
const SORT_LABELS = { length: 'Longest first', az: 'A to Z', za: 'Z to A' };

const recentInputs = createRecentList('anagram-magic:recent-words');

/** Read the min/max length controls. Blank max means "all letters". */
function parseLengthOptions(minRaw, maxRaw, letterCount) {
  const minText = String(minRaw).trim();
  const maxText = String(maxRaw).trim();
  const min = minText === '' ? DEFAULT_MIN_LENGTH : Number(minText);
  const max = maxText === '' ? letterCount : Number(maxText);
  if (!Number.isInteger(min) || min < 1) return { ok: false, error: 'Minimum length must be a whole number of 1 or more.' };
  if (!Number.isInteger(max) || max < 1) return { ok: false, error: 'Maximum length must be a whole number of 1 or more.' };
  if (maxText !== '' && max < min) return { ok: false, error: 'Maximum length cannot be smaller than minimum length.' };
  // Never ask for words longer than the input, and keep full anagrams reachable.
  const maxLength = Math.min(max, letterCount);
  return { ok: true, minLength: Math.min(min, maxLength), maxLength };
}

function groupByLength(words) {
  const groups = new Map();
  for (const word of words) {
    const group = groups.get(word.length);
    if (group) group.push(word);
    else groups.set(word.length, [word]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

export function renderAnagramView(root) {
  /** View state. `result` is null until the first successful solve. */
  const state = {
    result: null,
    ignoredCount: 0,
    sort: 'length',
    lengthFilter: null,
    expandedGroups: new Set(),
  };
  let solveToken = 0;
  let disposed = false;

  // ---- Form -------------------------------------------------------------
  const input = h('input', {
    id: 'anagram-input',
    class: 'input input--large',
    type: 'text',
    name: 'word',
    placeholder: 'e.g. listen',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    maxlength: '80',
    'aria-describedby': 'anagram-hint anagram-error',
  });
  const errorMessage = h('p', { id: 'anagram-error', class: 'field__error', role: 'alert' });
  const minInput = h('input', {
    id: 'anagram-min', class: 'input input--small', type: 'number', inputmode: 'numeric',
    min: '1', max: String(MAX_LETTERS), value: String(DEFAULT_MIN_LENGTH),
  });
  const maxInput = h('input', {
    id: 'anagram-max', class: 'input input--small', type: 'number', inputmode: 'numeric',
    min: '1', max: String(MAX_LETTERS), placeholder: 'Any',
  });
  const phraseToggle = h('input', { id: 'anagram-phrases', type: 'checkbox', class: 'checkbox' });
  const solveButton = h('button', { class: 'button button--primary button--large', type: 'submit' }, icon('search'), 'Solve');
  const clearButton = h('button', { class: 'button button--large', type: 'button', onClick: resetAll }, icon('reset'), 'Clear');
  const recentRow = h('div', { class: 'chip-row' });
  const results = h('section', { class: 'results', 'aria-label': 'Results', 'aria-live': 'polite' });

  const form = h(
    'form',
    { class: 'panel', novalidate: true, onSubmit: (event) => { event.preventDefault(); solve(); } },
    h(
      'div',
      { class: 'field' },
      h('label', { class: 'field__label', for: 'anagram-input' }, 'Word or letters'),
      h('div', { class: 'input-row' }, input, solveButton, clearButton),
      h('p', { id: 'anagram-hint', class: 'field__hint' }, `2 to ${MAX_LETTERS} letters. Capitals, spaces and punctuation are ignored.`),
      errorMessage,
    ),
    h(
      'div',
      { class: 'options' },
      h('div', { class: 'option' }, h('label', { for: 'anagram-min' }, 'Min length'), minInput),
      h('div', { class: 'option' }, h('label', { for: 'anagram-max' }, 'Max length'), maxInput),
      h('label', { class: 'option option--check', for: 'anagram-phrases' }, phraseToggle, 'Two-word anagrams'),
    ),
    h(
      'div',
      { class: 'chip-row' },
      h('span', { class: 'chip-row__label' }, 'Try'),
      EXAMPLES.map((example) =>
        h('button', { class: 'chip', type: 'button', onClick: () => runWith(example) }, example),
      ),
    ),
    recentRow,
  );

  for (const control of [minInput, maxInput, phraseToggle]) {
    control.addEventListener('change', () => { if (state.result) solve({ remember: false }); });
  }
  input.addEventListener('input', () => setError(''));

  root.append(
    h(
      'header',
      { class: 'page-header' },
      h('h1', { tabindex: '-1' }, 'Anagram Solver'),
      h('p', { class: 'page-header__lead' }, 'Enter a word or phrase to find the real English words hidden in its letters.'),
    ),
    form,
    results,
  );
  renderRecent();
  renderIdle();
  // Warm the dictionary so the first solve is instant; errors surface on solve.
  loadDictionary().catch(() => {});

  // ---- Actions ----------------------------------------------------------
  function setError(message) {
    errorMessage.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function runWith(text) {
    input.value = text;
    solve();
  }

  function resetAll() {
    solveToken++;
    input.value = '';
    minInput.value = String(DEFAULT_MIN_LENGTH);
    maxInput.value = '';
    phraseToggle.checked = false;
    Object.assign(state, { result: null, ignoredCount: 0, sort: 'length', lengthFilter: null });
    state.expandedGroups.clear();
    setError('');
    renderIdle();
    input.focus();
  }

  async function solve({ remember = true } = {}) {
    const parsed = parseAnagramInput(input.value);
    if (!parsed.ok) {
      setError(parsed.error);
      input.focus();
      return;
    }
    const lengths = parseLengthOptions(minInput.value, maxInput.value, parsed.letters.length);
    if (!lengths.ok) {
      setError(lengths.error);
      return;
    }
    setError('');

    const token = ++solveToken;
    renderLoading();
    solveButton.disabled = true;
    let dictionary;
    try {
      dictionary = await loadDictionary();
    } catch {
      if (token === solveToken && !disposed) renderLoadError();
      return;
    } finally {
      solveButton.disabled = false;
    }
    if (token !== solveToken || disposed) return; // superseded by a newer action

    state.result = solveAnagram(dictionary, parsed.letters, {
      minLength: lengths.minLength,
      maxLength: lengths.maxLength,
      includePhrases: phraseToggle.checked,
    });
    state.ignoredCount = parsed.ignoredCount;
    state.lengthFilter = null;
    state.expandedGroups.clear();
    if (remember) {
      recentInputs.add(input.value.trim().toLowerCase());
      renderRecent();
    }
    renderResults();
  }

  // ---- Rendering --------------------------------------------------------
  function renderRecent() {
    const items = recentInputs.read();
    recentRow.hidden = items.length === 0;
    setChildren(
      recentRow,
      h('span', { class: 'chip-row__label' }, 'Recent'),
      items.map((item) => h('button', { class: 'chip', type: 'button', onClick: () => runWith(item) }, item)),
      h('button', {
        class: 'link-button', type: 'button',
        onClick: () => { recentInputs.clear(); renderRecent(); },
      }, 'Clear recent'),
    );
  }

  function stateBlock(iconName, title, text, action) {
    return h(
      'div',
      { class: 'state' },
      h('span', { class: 'state__icon' }, icon(iconName, 20)),
      h('p', { class: 'state__title' }, title),
      text && h('p', { class: 'state__text' }, text),
      action,
    );
  }

  function renderIdle() {
    setChildren(results, stateBlock('letters', 'Results will appear here', 'Type a word above and press Enter, or pick an example.'));
  }

  function renderLoading() {
    setChildren(
      results,
      h('div', { class: 'state', role: 'status' }, h('span', { class: 'spinner' }), h('p', { class: 'state__title' }, 'Loading dictionary…')),
    );
  }

  function renderLoadError() {
    setChildren(
      results,
      stateBlock(
        'alert',
        'The dictionary could not be loaded',
        'Check your connection, then try again.',
        h('button', { class: 'button', type: 'button', onClick: () => solve({ remember: false }) }, 'Try again'),
      ),
    );
  }

  function wordChip(text) {
    return h(
      'li',
      {},
      h('button', {
        class: 'word', type: 'button', title: 'Copy', 'aria-label': `Copy ${text}`,
        onClick: () => copyWithToast(text, `Copied “${text}”`),
      }, h('span', {}, text), icon('copy', 13)),
    );
  }

  function wordGroup(key, title, badge, words) {
    const expanded = state.expandedGroups.has(key);
    const visible = expanded ? words : words.slice(0, GROUP_PREVIEW_SIZE);
    return h(
      'section',
      { class: 'group' },
      h(
        'header',
        { class: 'group__header' },
        h('h3', { class: 'group__title' }, title),
        badge && h('span', { class: 'badge badge--accent' }, badge),
        h('span', { class: 'group__count' }, formatNumber(words.length)),
      ),
      h('ul', { class: 'word-list' }, visible.map(wordChip)),
      visible.length < words.length &&
        h('button', {
          class: 'button button--small', type: 'button',
          onClick: () => { state.expandedGroups.add(key); renderResults(); },
        }, `Show all ${formatNumber(words.length)}`),
    );
  }

  function renderResults() {
    const { result } = state;
    const { letters, words, phrases } = result;
    const display = letters.toUpperCase();
    const groups = groupByLength(words);
    const filtered = state.lengthFilter === null ? words : words.filter((word) => word.length === state.lengthFilter);
    const fullCount = words.filter((word) => word.length === letters.length).length;

    const notes = [];
    if (result.inputIsWord) notes.push(`“${letters}” is itself a dictionary word.`);
    if (state.ignoredCount > 0) notes.push(`${plural(state.ignoredCount, 'character')} that ${state.ignoredCount === 1 ? 'is not a letter was' : 'are not letters were'} ignored.`);

    const summary = h(
      'header',
      { class: 'results__summary' },
      h(
        'div',
        {},
        h('h2', { class: 'results__title' }, `${plural(words.length, 'word')} from `, h('span', { class: 'mono' }, display)),
        h(
          'p',
          { class: 'results__meta' },
          fullCount > 0 ? `${plural(fullCount, 'full anagram')} using all ${letters.length} letters.` : `No other word uses all ${letters.length} letters.`,
          notes.map((note) => ` ${note}`),
        ),
      ),
    );

    if (words.length === 0 && phrases.length === 0) {
      setChildren(
        results,
        summary,
        stateBlock(
          'search',
          'No words found',
          phraseToggle.checked
            ? 'No dictionary word or two-word pair can be made from these letters. Try lowering the minimum length.'
            : 'No dictionary word can be made from these letters with the current length range. Try lowering the minimum length or turning on two-word anagrams.',
        ),
      );
      return;
    }

    const sortSelect = h(
      'select',
      { id: 'anagram-sort', class: 'select', onChange: (event) => { state.sort = event.target.value; renderResults(); } },
      Object.entries(SORT_LABELS).map(([value, label]) => h('option', { value, selected: state.sort === value }, label)),
    );
    const filterButton = (label, value, count) =>
      h('button', {
        class: 'chip chip--toggle', type: 'button',
        'aria-pressed': String(state.lengthFilter === value),
        onClick: () => { state.lengthFilter = value; renderResults(); },
      }, label, h('span', { class: 'chip__count' }, formatNumber(count)));

    const toolbar = words.length > 0 && h(
      'div',
      { class: 'toolbar' },
      h(
        'div',
        { class: 'chip-row', role: 'group', 'aria-label': 'Filter by word length' },
        filterButton('All', null, words.length),
        groups.map(([length, group]) => filterButton(`${length} letters`, length, group.length)),
      ),
      h(
        'div',
        { class: 'toolbar__actions' },
        h('label', { class: 'toolbar__label', for: 'anagram-sort' }, 'Sort'),
        sortSelect,
        h('button', {
          class: 'button button--small', type: 'button',
          onClick: () => copyWithToast(sortWords(filtered, state.sort).join('\n'), `Copied ${plural(filtered.length, 'word')}`),
        }, icon('copy', 14), 'Copy all'),
      ),
    );

    let wordSections;
    if (state.sort === 'length') {
      wordSections = groupByLength(filtered).map(([length, group]) =>
        wordGroup(`len-${length}`, `${length} letters`, length === letters.length ? 'Full anagrams' : null, group),
      );
    } else {
      wordSections = filtered.length > 0 && wordGroup(`flat-${state.sort}`, SORT_LABELS[state.sort], null, sortWords(filtered, state.sort));
    }

    const phraseSection = phraseToggle.checked && h(
      'section',
      { class: 'group' },
      h(
        'header',
        { class: 'group__header' },
        h('h3', { class: 'group__title' }, 'Two-word anagrams'),
        h('span', { class: 'group__count' }, formatNumber(result.phraseTotal)),
        phrases.length > 0 && h('button', {
          class: 'button button--small group__action', type: 'button',
          onClick: () => copyWithToast(phrases.map((pair) => pair.join(' ')).join('\n'), `Copied ${plural(phrases.length, 'pair')}`),
        }, icon('copy', 14), 'Copy pairs'),
      ),
      phrases.length > 0
        ? h('ul', { class: 'word-list' }, phrases.map((pair) => wordChip(pair.join(' '))))
        : h('p', { class: 'group__empty' }, 'No two dictionary words use all of these letters together.'),
      result.phrasesTruncated &&
        h('p', { class: 'group__empty' }, `Showing the first ${formatNumber(phrases.length)} of ${formatNumber(result.phraseTotal)} pairs.`),
    );

    setChildren(results, summary, toolbar, wordSections, phraseSection);
  }

  return () => {
    disposed = true;
    solveToken++;
  };
}
