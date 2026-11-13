import { MAX_LETTERS, parseAnagramInput, solveAnagram, sortWords, wordQuality } from '../../lib/anagram.js';
import { loadDictionary } from '../../services/dictionary.js';
import { createRecentList } from '../../services/storage.js';
import { letterTiles } from '../components/tiles.js';
import { formatNumber, h, plural, setChildren } from '../dom.js';
import { icon } from '../icons.js';
import { replaceRouteQuery, routeQuery } from '../route.js';
import { announce, copyWithToast } from '../toast.js';

const EXAMPLES = ['listen', 'triangle', 'dormitory', 'stressed', 'astronomer'];
const DEFAULT_MIN_LENGTH = 3;
/** How many items a list shows before "Show more", and how many each press adds. */
const PAGE = { full: 24, pairs: 8, pairsMore: 24, words: 48 };

const recentInputs = createRecentList('anagram-magic:recent-words');

/** Read the min/max length controls. Blank max means "all letters". */
function parseLengthOptions(minRaw, maxRaw, letterCount) {
  const minText = String(minRaw).trim();
  const maxText = String(maxRaw).trim();
  const min = minText === '' ? DEFAULT_MIN_LENGTH : Number(minText);
  const max = maxText === '' ? letterCount : Number(maxText);
  if (!Number.isInteger(min) || min < 1) return { ok: false, error: 'Shortest word must be a whole number of 1 or more.' };
  if (!Number.isInteger(max) || max < 1) return { ok: false, error: 'Longest word must be a whole number of 1 or more.' };
  if (maxText !== '' && max < min) return { ok: false, error: 'Longest word cannot be smaller than shortest word.' };
  // Never ask for words longer than the input, and keep full anagrams reachable.
  const maxLength = Math.min(max, letterCount);
  return { ok: true, minLength: Math.min(min, maxLength), maxLength };
}

export function renderAnagramView(root) {
  /** View state. `result` is null until the first successful solve. */
  const state = {
    result: null,
    dictionary: null,
    ignoredCount: 0,
    /** Per-list display state, keyed by list id: how many shown, open/closed, rare visible. */
    shown: new Map(),
    open: new Set(),
    rareVisible: new Set(),
  };
  let solveToken = 0;
  let disposed = false;
  /** Where keyboard focus should land after the results are redrawn. */
  let pendingFocus = null;

  // ---- Form -------------------------------------------------------------
  const input = h('input', {
    id: 'anagram-input', class: 'input input--hero', type: 'text', name: 'word',
    placeholder: 'Type a word or phrase', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    maxlength: '80', enterkeyhint: 'search', 'aria-describedby': 'anagram-hint anagram-error',
  });
  const clearButton = h('button', { class: 'input-clear', type: 'button', 'aria-label': 'Clear', title: 'Clear', hidden: true, onClick: resetAll }, icon('close', 16));
  const solveButton = h('button', { class: 'button button--primary button--hero', type: 'submit' }, 'Solve');
  const errorMessage = h('p', { id: 'anagram-error', class: 'field__error', role: 'alert' });

  const minInput = h('input', { id: 'anagram-min', class: 'input input--number', type: 'number', inputmode: 'numeric', min: '1', max: String(MAX_LETTERS), value: String(DEFAULT_MIN_LENGTH) });
  const maxInput = h('input', { id: 'anagram-max', class: 'input input--number', type: 'number', inputmode: 'numeric', min: '1', max: String(MAX_LETTERS), placeholder: 'Any' });
  const pairToggle = h('input', { id: 'anagram-pairs', type: 'checkbox', class: 'checkbox', checked: true });
  const allPairsToggle = h('input', { id: 'anagram-all-pairs', type: 'checkbox', class: 'checkbox' });
  const orderSelect = h(
    'select',
    { id: 'anagram-order', class: 'select' },
    h('option', { value: 'best' }, 'Most common first'),
    h('option', { value: 'az' }, 'A to Z'),
  );
  const filterPanel = h(
    'div',
    { id: 'anagram-filters', class: 'filters', hidden: true },
    h('div', { class: 'filter' }, h('label', { for: 'anagram-min' }, 'Shortest word'), minInput),
    h('div', { class: 'filter' }, h('label', { for: 'anagram-max' }, 'Longest word'), maxInput),
    h('div', { class: 'filter' }, h('label', { for: 'anagram-order' }, 'Order'), orderSelect),
    h('label', { class: 'filter filter--check', for: 'anagram-pairs' }, pairToggle, 'Two-word anagrams'),
    h('label', { class: 'filter filter--check', for: 'anagram-all-pairs' }, allPairsToggle, 'Include rare and two-letter words in pairs'),
  );
  const filterCountNumber = h('span', { 'aria-hidden': 'true' });
  const filterCountText = h('span', { class: 'sr-only' });
  const filterCount = h('span', { class: 'filter-count', hidden: true }, filterCountNumber, filterCountText);
  const filterButton = h(
    'button',
    {
      class: 'button button--quiet', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'anagram-filters',
      onClick: () => {
        filterPanel.hidden = !filterPanel.hidden;
        filterButton.setAttribute('aria-expanded', String(!filterPanel.hidden));
      },
    },
    icon('sliders', 16), 'Filters', filterCount,
  );
  const results = h('section', { class: 'results', 'aria-label': 'Results', tabindex: '-1' });

  const form = h(
    'form',
    { class: 'composer', novalidate: true, onSubmit: (event) => { event.preventDefault(); solve(); } },
    h('label', { class: 'field__label', for: 'anagram-input' }, 'Your letters'),
    h('div', { class: 'composer__row' }, h('div', { class: 'input-wrap' }, input, clearButton), solveButton),
    errorMessage,
    h(
      'div',
      { class: 'composer__meta' },
      h('p', { id: 'anagram-hint', class: 'field__hint' }, `2 to ${MAX_LETTERS} letters. Capitals, spaces and punctuation are ignored.`),
      filterButton,
    ),
    filterPanel,
  );

  for (const control of [minInput, maxInput, pairToggle]) {
    control.addEventListener('change', () => { updateFilterCount(); if (state.result) solve({ remember: false }); });
  }
  for (const control of [orderSelect, allPairsToggle]) {
    control.addEventListener('change', () => { updateFilterCount(); if (state.result) renderResults(); });
  }
  input.addEventListener('input', () => { setError(''); clearButton.hidden = input.value === ''; });

  root.append(
    h(
      'header',
      { class: 'page-header' },
      h('h1', { tabindex: '-1' }, 'Anagram Solver'),
      h('p', { class: 'page-header__lead' }, 'Find the real English words hiding in any set of letters.'),
    ),
    form,
    results,
  );

  // Warm the dictionary so the first solve is instant; errors surface on solve.
  loadDictionary().catch(() => {});
  const initial = routeQuery().get('q');
  if (initial) {
    input.value = initial.slice(0, 80);
    clearButton.hidden = false;
    solve();
  } else {
    renderIdle();
  }

  // ---- Actions ----------------------------------------------------------
  function setError(message) {
    errorMessage.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function updateFilterCount() {
    const active =
      Number(minInput.value.trim() !== String(DEFAULT_MIN_LENGTH)) +
      Number(maxInput.value.trim() !== '') +
      Number(orderSelect.value !== 'best') +
      Number(!pairToggle.checked) +
      Number(allPairsToggle.checked);
    filterCount.hidden = active === 0;
    filterCountNumber.textContent = String(active);
    filterCountText.textContent = ` (${active} changed)`;
  }

  function runWith(text) {
    input.value = text;
    clearButton.hidden = false;
    solve();
  }

  function resetDisplayState() {
    state.shown.clear();
    state.open.clear();
    state.rareVisible.clear();
  }

  function resetAll() {
    solveToken++;
    input.value = '';
    clearButton.hidden = true;
    minInput.value = String(DEFAULT_MIN_LENGTH);
    maxInput.value = '';
    orderSelect.value = 'best';
    pairToggle.checked = true;
    allPairsToggle.checked = false;
    updateFilterCount();
    state.result = null;
    resetDisplayState();
    setError('');
    replaceRouteQuery({});
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
      filterPanel.hidden = false;
      filterButton.setAttribute('aria-expanded', 'true');
      return;
    }
    setError('');

    const token = ++solveToken;
    if (!state.dictionary) renderLoading();
    solveButton.disabled = true;
    try {
      state.dictionary = await loadDictionary();
    } catch {
      if (token === solveToken && !disposed) renderLoadError();
      return;
    } finally {
      solveButton.disabled = false;
    }
    if (token !== solveToken || disposed) return; // superseded by a newer action

    state.result = solveAnagram(state.dictionary, parsed.letters, {
      minLength: lengths.minLength,
      maxLength: lengths.maxLength,
      includePhrases: pairToggle.checked,
      phraseLimit: 500,
    });
    state.ignoredCount = parsed.ignoredCount;
    resetDisplayState();
    if (remember) recentInputs.add(input.value.trim().toLowerCase());
    replaceRouteQuery({ q: input.value.trim() });
    renderResults();
    announceResults();
  }

  // ---- Rendering: states -------------------------------------------------
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
    root.classList.remove('has-results');
    const recent = recentInputs.read();
    setChildren(
      results,
      h(
        'div',
        { class: 'starter' },
        h(
          'div',
          { class: 'starter__group' },
          h('p', { class: 'starter__label' }, 'Try one of these'),
          h('div', { class: 'chip-row' }, EXAMPLES.map((example) => h('button', { class: 'chip chip--word', type: 'button', onClick: () => runWith(example) }, example))),
        ),
        recent.length > 0 && h(
          'div',
          { class: 'starter__group' },
          h('p', { class: 'starter__label' }, 'Recent'),
          h(
            'div',
            { class: 'chip-row' },
            recent.map((item) => h('button', { class: 'chip chip--word', type: 'button', onClick: () => runWith(item) }, item)),
            h('button', { class: 'link-button', type: 'button', onClick: () => { recentInputs.clear(); renderIdle(); } }, 'Clear recent'),
          ),
        ),
      ),
    );
  }

  function renderLoading() {
    setChildren(results, h('div', { class: 'state', role: 'status' }, h('span', { class: 'spinner' }), h('p', { class: 'state__title' }, 'Loading dictionary…')));
  }

  function renderLoadError() {
    setChildren(
      results,
      stateBlock('alert', 'The dictionary could not be loaded', 'Check your connection, then try again.',
        h('button', { class: 'button', type: 'button', onClick: () => solve({ remember: false }) }, 'Try again')),
    );
  }

  // ---- Rendering: results ------------------------------------------------
  /** A word the user can select to copy. Feedback appears on the word itself. */
  function copyable(text, className, content = text) {
    // The visible text stays part of the accessible name; "Copy" is added for screen readers.
    const button = h('button', { class: className, type: 'button' }, h('span', { class: 'sr-only' }, 'Copy '), content);
    button.addEventListener('click', async () => {
      if (await copyWithToast(text, `Copied “${text}”`)) {
        button.classList.add('is-copied');
        setTimeout(() => button.classList.remove('is-copied'), 1200);
      }
    });
    return button;
  }

  function showMoreButton(key, total, shown, step) {
    if (shown >= total) return null;
    const next = Math.min(step, total - shown);
    return h('button', {
      class: 'button button--quiet show-more', type: 'button',
      onClick: () => { state.shown.set(key, shown + step); pendingFocus = { list: key, index: shown }; renderResults(); },
    }, `Show ${formatNumber(next)} more`, h('span', { class: 'show-more__rest' }, `of ${formatNumber(total - shown)}`));
  }

  function orderWords(words) {
    return orderSelect.value === 'az' ? sortWords(words, 'az') : words; // already ranked best first
  }

  function fullSection(letters, fullWords) {
    if (fullWords.length === 0) {
      return h(
        'section',
        { class: 'block block--feature block--none' },
        h('h2', { class: 'block__title' }, 'No single-word anagram'),
        h('p', { class: 'block__text' }, `No other dictionary word uses all ${letters.length} letters.`),
      );
    }
    const shown = state.shown.get('full') ?? PAGE.full;
    return h(
      'section',
      { class: 'block block--feature' },
      h(
        'header',
        { class: 'block__header' },
        h('h2', { class: 'block__title' }, plural(fullWords.length, 'anagram')),
        h('p', { class: 'block__text' }, `Using all ${letters.length} letters`),
      ),
      h(
        'ul',
        { class: 'feature-words', dataset: { list: 'full' } },
        orderWords(fullWords).slice(0, shown).map((word) => {
          const rare = wordQuality(state.dictionary, word) === 'rare';
          return h('li', {}, copyable(word, rare ? 'feature-word feature-word--rare' : 'feature-word',
            [h('span', { class: 'feature-word__text' }, word), rare && h('span', { class: 'feature-word__tag' }, 'rare')]));
        }),
      ),
      showMoreButton('full', fullWords.length, shown, PAGE.full),
    );
  }

  /** Pairs on screen: readable ones by default, every valid pair on request. */
  function visiblePairs(result) {
    const readableCount = Math.min(result.readablePhraseTotal, result.phrases.length);
    return allPairsToggle.checked ? result.phrases : result.phrases.slice(0, readableCount);
  }

  function pairSection(result) {
    if (!pairToggle.checked) return null;
    const shown = state.shown.get('pairs') ?? PAGE.pairs;
    const pairs = visiblePairs(result);
    const showingAll = allPairsToggle.checked;
    const otherCount = result.phraseTotal - result.readablePhraseTotal;
    let summary;
    if (result.phraseTotal === 0) summary = 'No two dictionary words use all the letters together.';
    else if (showingAll) summary = `${plural(result.phraseTotal, 'pair')} using all the letters, most readable first`;
    else if (pairs.length === 0) summary = 'No readable pair uses all the letters.';
    else summary = `${plural(result.readablePhraseTotal, 'readable pair')} using all the letters`;
    return h(
      'section',
      { class: 'block' },
      h('header', { class: 'block__header' }, h('h2', { class: 'block__title' }, 'Two words'), h('p', { class: 'block__text' }, summary)),
      pairs.length > 0 && h(
        'ul',
        { class: 'pair-list', dataset: { list: 'pairs' } },
        pairs.slice(0, shown).map((pair) =>
          h('li', {}, copyable(pair.join(' '), 'pair', [pair[0], h('span', { class: 'pair__plus', 'aria-hidden': 'true' }, '+'), pair[1]]))),
      ),
      showMoreButton('pairs', pairs.length, shown, PAGE.pairsMore),
      !showingAll && otherCount > 0 && shown >= pairs.length && h('button', {
        class: 'link-button', type: 'button', dataset: { focus: 'all-pairs' },
        onClick: () => {
          allPairsToggle.checked = true;
          updateFilterCount();
          pendingFocus = { list: 'pairs', index: pairs.length };
          renderResults();
        },
      }, `Show ${plural(otherCount, 'more pair')} that use rare or two-letter words`),
      showingAll && result.phrasesTruncated && shown >= pairs.length &&
        h('p', { class: 'block__note' }, `Showing the best ${formatNumber(pairs.length)} of ${formatNumber(result.phraseTotal)} pairs.`),
    );
  }

  function lengthGroup(length, words, openByDefault) {
    const key = `len-${length}`;
    const isOpen = state.open.has(key) || (openByDefault && !state.open.has(`${key}-closed`));
    const usual = words.filter((word) => wordQuality(state.dictionary, word) !== 'rare');
    const rare = words.filter((word) => wordQuality(state.dictionary, word) === 'rare');
    const preview = (usual.length > 0 ? usual : rare).slice(0, 4).join(', ');
    const header = h(
      'button',
      {
        class: 'group__toggle', type: 'button', 'aria-expanded': String(isOpen), 'aria-controls': isOpen ? `group-${length}` : null,
        dataset: { focus: `toggle-${key}` },
        onClick: () => {
          pendingFocus = { key: `toggle-${key}` };
          if (isOpen) { state.open.delete(key); state.open.add(`${key}-closed`); }
          else { state.open.add(key); state.open.delete(`${key}-closed`); }
          renderResults();
        },
      },
      h('span', { class: 'group__title' }, `${length} letters`),
      h('span', { class: 'group__count' }, formatNumber(words.length)),
      !isOpen && h('span', { class: 'group__preview' }, preview, words.length > 4 ? ', …' : ''),
      icon('chevronDown', 16),
    );
    if (!isOpen) return h('section', { class: 'group' }, h('h3', { class: 'group__heading' }, header));

    const shown = state.shown.get(key) ?? PAGE.words;
    const rareShown = state.rareVisible.has(key) || usual.length === 0;
    const visible = orderWords(rareShown ? words : usual);
    return h(
      'section',
      { class: 'group is-open' },
      h('h3', { class: 'group__heading' }, header),
      h(
        'div',
        { id: `group-${length}`, class: 'group__body' },
        h(
          'ul',
          { class: 'word-flow', dataset: { list: key } },
          visible.slice(0, shown).map((word) =>
            h('li', {}, copyable(word, wordQuality(state.dictionary, word) === 'rare' ? 'word word--rare' : 'word'))),
        ),
        h(
          'div',
          { class: 'group__more' },
          showMoreButton(key, visible.length, shown, PAGE.words),
          rare.length > 0 && usual.length > 0 && h('button', {
            class: 'link-button', type: 'button', dataset: { focus: `rare-${key}` },
            onClick: () => {
              if (rareShown) state.rareVisible.delete(key); else state.rareVisible.add(key);
              pendingFocus = { key: `rare-${key}` };
              renderResults();
            },
          }, rareShown ? 'Hide rare words' : `Show ${plural(rare.length, 'rare word')}`),
        ),
      ),
    );
  }

  function shorterSection(letters, shorterWords, hasFeature) {
    if (shorterWords.length === 0) return null;
    const groups = new Map();
    for (const word of shorterWords) {
      if (groups.has(word.length)) groups.get(word.length).push(word);
      else groups.set(word.length, [word]);
    }
    const entries = [...groups.entries()].sort((a, b) => b[0] - a[0]);
    return h(
      'section',
      { class: 'block' },
      h(
        'header',
        { class: 'block__header' },
        h('h2', { class: 'block__title' }, 'Shorter words'),
        h('p', { class: 'block__text' }, `${plural(shorterWords.length, 'word')} using some of the letters`),
      ),
      h('div', { class: 'groups' }, entries.map(([length, words], index) => lengthGroup(length, words, index === 0 && !hasFeature))),
    );
  }

  function renderResults() {
    const { result } = state;
    const { letters, words } = result;
    const fullWords = words.filter((word) => word.length === letters.length);
    const shorterWords = words.filter((word) => word.length < letters.length);

    const notes = [];
    if (result.inputIsWord) notes.push(`“${letters}” is a dictionary word itself.`);
    if (state.ignoredCount > 0) notes.push(`${plural(state.ignoredCount, 'character')} that ${state.ignoredCount === 1 ? 'is not a letter was' : 'are not letters were'} ignored.`);

    const header = h(
      'header',
      { class: 'results__header' },
      h('div', { class: 'results__letters' }, letterTiles(letters.toUpperCase(), { size: 'sm', label: `Letters: ${letters.toUpperCase().split('').join(' ')}` })),
      h('p', { class: 'results__hint' }, notes.join(' '), notes.length > 0 && ' ', 'Select any word to copy it.'),
    );
    const footer = words.length > 0 && h(
      'div',
      { class: 'results__footer' },
      h('button', {
        class: 'button', type: 'button',
        onClick: () => copyWithToast(orderWords(words).join('\n'), `Copied ${plural(words.length, 'word')}`),
      }, icon('copy', 15), `Copy all ${formatNumber(words.length)} words`),
    );
    root.classList.add('has-results');

    if (words.length === 0 && result.phraseTotal === 0) {
      setChildren(
        results,
        header,
        stateBlock('search', 'No words found', 'No dictionary word can be made from these letters with the current filters. Try a shorter minimum length.'),
      );
      return;
    }
    const hasFeature = fullWords.length > 0 || (pairToggle.checked && visiblePairs(result).length > 0);
    setChildren(results, header, fullSection(letters, fullWords), pairSection(result), shorterSection(letters, shorterWords, hasFeature), footer);
    restoreFocus();
  }

  /** Redrawing replaces the control that was activated, so put focus back where the user was. */
  function restoreFocus() {
    if (!pendingFocus) return;
    const { key, list, index } = pendingFocus;
    pendingFocus = null;
    const target = list
      ? results.querySelector(`[data-list="${list}"]`)?.children[index]?.querySelector('button')
      : results.querySelector(`[data-focus="${key}"]`);
    (target ?? results).focus();
  }

  function announceResults() {
    const { result } = state;
    const full = result.words.filter((word) => word.length === result.letters.length).length;
    const parts = [full === 0 ? 'No single-word anagram' : plural(full, 'anagram')];
    if (pairToggle.checked) parts.push(plural(visiblePairs(result).length, 'two-word pair'));
    parts.push(plural(result.words.length - full, 'shorter word'));
    announce(`Results for ${result.letters}: ${parts.join(', ')}.`);
  }

  return () => {
    disposed = true;
    solveToken++;
  };
}
