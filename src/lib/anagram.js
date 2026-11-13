// Pure anagram logic. No DOM, no network: everything here is unit-testable in Node.

/** Longest input (in letters) the solver accepts. */
export const MAX_LETTERS = 30;

/** Default cap on the number of two-word anagrams returned. */
export const DEFAULT_PHRASE_LIMIT = 500;

const CODE_A = 97;
const ALPHABET_SIZE = 26;

/**
 * Reduce arbitrary text to the lowercase letters a–z it contains.
 * Accented letters are folded to their base letter ("é" -> "e").
 */
export function normalizeLetters(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * Validate raw user input.
 * @returns {{ok: true, letters: string, ignoredCount: number} | {ok: false, error: string}}
 */
export function parseAnagramInput(rawInput) {
  const raw = String(rawInput ?? '');
  if (raw.trim() === '') {
    return { ok: false, error: 'Enter a word or some letters to solve.' };
  }
  const letters = normalizeLetters(raw);
  if (letters.length === 0) {
    return { ok: false, error: 'No letters found. Use the letters A–Z.' };
  }
  if (letters.length < 2) {
    return { ok: false, error: 'Enter at least 2 letters.' };
  }
  if (letters.length > MAX_LETTERS) {
    return {
      ok: false,
      error: `That is ${letters.length} letters. The limit is ${MAX_LETTERS}.`,
    };
  }
  const ignoredCount = raw.replace(/\s/g, '').length - letters.length;
  return { ok: true, letters, ignoredCount: Math.max(0, ignoredCount) };
}

/** Letter frequency table for a normalized (a–z) word. */
export function letterCounts(word) {
  const counts = new Uint8Array(ALPHABET_SIZE);
  for (let i = 0; i < word.length; i++) {
    counts[word.charCodeAt(i) - CODE_A]++;
  }
  return counts;
}

/** The letters of a word in alphabetical order: the anagram "signature". */
export function signature(word) {
  return word.split('').sort().join('');
}

/** True when both texts use exactly the same letters the same number of times. */
export function isAnagram(first, second) {
  return signature(normalizeLetters(first)) === signature(normalizeLetters(second));
}

/** Split a newline-separated word list into clean lowercase words. */
export function parseWordList(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((word) => /^[a-z]+$/.test(word));
}

/**
 * Build the search structure: words bucketed by length, so a search only
 * visits words that could possibly fit.
 * @param {Iterable<string>} words
 */
export function createDictionary(words) {
  const unique = new Set();
  for (const word of words) {
    const clean = String(word).toLowerCase();
    if (/^[a-z]+$/.test(clean)) unique.add(clean);
  }
  const byLength = new Map();
  for (const word of unique) {
    const bucket = byLength.get(word.length);
    if (bucket) bucket.push(word);
    else byLength.set(word.length, [word]);
  }
  for (const bucket of byLength.values()) bucket.sort();
  return { size: unique.size, byLength, wordSet: unique };
}

export function hasWord(dictionary, word) {
  return dictionary.wordSet.has(word);
}

/** Can `word` be spelled using the available letters, each at most as often as supplied? */
function fits(word, available, scratch) {
  scratch.set(available);
  for (let i = 0; i < word.length; i++) {
    const index = word.charCodeAt(i) - CODE_A;
    if (scratch[index] === 0) return false;
    scratch[index]--;
  }
  return true;
}

/**
 * Find every dictionary word that can be spelled from `letters`.
 * Words of the full length are true anagrams; shorter ones use a subset.
 * Result is ordered longest first, then alphabetically.
 *
 * @param {ReturnType<typeof createDictionary>} dictionary
 * @param {string} letters normalized letters (a–z)
 * @param {{minLength?: number, maxLength?: number}} [options]
 * @returns {string[]}
 */
export function findWords(dictionary, letters, options = {}) {
  const total = letters.length;
  const minLength = Math.max(1, options.minLength ?? 1);
  const maxLength = Math.min(total, options.maxLength ?? total);
  const available = letterCounts(letters);
  const scratch = new Uint8Array(ALPHABET_SIZE);
  const found = [];
  for (let length = maxLength; length >= minLength; length--) {
    const bucket = dictionary.byLength.get(length);
    if (!bucket) continue;
    for (const word of bucket) {
      if (fits(word, available, scratch)) found.push(word);
    }
  }
  return found;
}

function signatureFromCounts(counts) {
  let result = '';
  for (let i = 0; i < ALPHABET_SIZE; i++) {
    if (counts[i]) result += String.fromCharCode(CODE_A + i).repeat(counts[i]);
  }
  return result;
}

/**
 * Find pairs of dictionary words that together use every letter exactly once.
 * Each pair is returned once, as [shorter-or-earlier word, other word].
 *
 * @returns {{phrases: [string, string][], total: number, truncated: boolean}}
 */
export function findTwoWordAnagrams(dictionary, letters, options = {}) {
  const limit = options.limit ?? DEFAULT_PHRASE_LIMIT;
  const minWordLength = Math.max(1, options.minWordLength ?? 2);
  const total = letters.length;
  const empty = { phrases: [], total: 0, truncated: false };
  if (total < minWordLength * 2) return empty;

  // Both halves must themselves be spellable from the input, so only those
  // candidate words need indexing, not the whole dictionary.
  const candidates = findWords(dictionary, letters, {
    minLength: minWordLength,
    maxLength: total - minWordLength,
  });
  const bySignature = new Map();
  for (const word of candidates) {
    const key = signature(word);
    const group = bySignature.get(key);
    if (group) group.push(word);
    else bySignature.set(key, [word]);
  }

  const available = letterCounts(letters);
  const remaining = new Uint8Array(ALPHABET_SIZE);
  const phrases = [];
  let count = 0;
  for (const first of candidates) {
    if (first.length * 2 > total) continue;
    remaining.set(available);
    for (let i = 0; i < first.length; i++) remaining[first.charCodeAt(i) - CODE_A]--;
    const partners = bySignature.get(signatureFromCounts(remaining));
    if (!partners) continue;
    for (const second of partners) {
      // When both words have the same length each pair would be seen twice.
      if (first.length === second.length && first > second) continue;
      count++;
      if (phrases.length < limit) phrases.push([first, second]);
    }
  }
  phrases.sort((a, b) => a.join(' ').localeCompare(b.join(' ')));
  return { phrases, total: count, truncated: count > phrases.length };
}

export const SORT_MODES = /** @type {const} */ (['length', 'az', 'za']);

/** Return a sorted copy of `words`. Unknown modes fall back to 'length'. */
export function sortWords(words, mode = 'length') {
  const sorted = [...words];
  if (mode === 'az') return sorted.sort();
  if (mode === 'za') return sorted.sort().reverse();
  return sorted.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Full solve used by the UI.
 * @returns {{
 *   letters: string, words: string[], inputIsWord: boolean,
 *   phrases: [string, string][], phraseTotal: number, phrasesTruncated: boolean
 * }}
 */
export function solveAnagram(dictionary, letters, options = {}) {
  const words = findWords(dictionary, letters, options).filter((word) => word !== letters);
  const pairs = options.includePhrases
    ? findTwoWordAnagrams(dictionary, letters, { limit: options.phraseLimit })
    : { phrases: [], total: 0, truncated: false };
  return {
    letters,
    words,
    inputIsWord: hasWord(dictionary, letters),
    phrases: pairs.phrases,
    phraseTotal: pairs.total,
    phrasesTruncated: pairs.truncated,
  };
}
