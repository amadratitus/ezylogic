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

/** Tier used when no commonness data is available. */
const UNKNOWN_TIER = 5;
/** Tier of words missing from the commonness data: valid, but rare. */
export const RARE_TIER = 9;

/**
 * Build the search structure: words bucketed by length, so a search only
 * visits words that could possibly fit.
 *
 * `tiers` is optional commonness data: a string with one digit per entry of
 * `words`, in the same order. 1 is most common, 9 is rare. The digits are
 * SCOWL size levels: an editorial estimate of how widely a word is known,
 * based mostly on how many dictionaries list it. They are not measured
 * usage frequencies. Tiers only affect the order results are shown in and
 * which pairs count as readable, never which words are found.
 *
 * @param {string[]} words
 * @param {string | null} [tiers]
 */
export function createDictionary(words, tiers = null) {
  const list = Array.from(words);
  const hasTiers = typeof tiers === 'string' && tiers.length === list.length && /^[1-9]*$/.test(tiers);
  const tierOf = new Map();
  list.forEach((word, index) => {
    const clean = String(word).toLowerCase();
    if (!/^[a-z]+$/.test(clean) || tierOf.has(clean)) return;
    tierOf.set(clean, hasTiers ? Number(tiers[index]) : UNKNOWN_TIER);
  });
  const byLength = new Map();
  for (const word of tierOf.keys()) {
    const bucket = byLength.get(word.length);
    if (bucket) bucket.push(word);
    else byLength.set(word.length, [word]);
  }
  for (const bucket of byLength.values()) bucket.sort();
  return { size: tierOf.size, byLength, tierOf, hasTiers };
}

export function hasWord(dictionary, word) {
  return dictionary.tierOf.has(word);
}

/** Commonness tier of a dictionary word: 1 (most common) to 9 (rare). */
export function wordTier(dictionary, word) {
  return dictionary.tierOf.get(word) ?? RARE_TIER;
}

/**
 * Coarse commonness class used by the UI.
 * @returns {'common' | 'familiar' | 'rare'}
 */
export function wordQuality(dictionary, word) {
  const tier = wordTier(dictionary, word);
  if (tier <= 3) return 'common';
  return tier < RARE_TIER ? 'familiar' : 'rare';
}

const QUALITY_ORDER = { common: 0, familiar: 1, rare: 2 };
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Order words best first: longest, then most common, then alphabetical.
 * Returns a new array.
 */
export function rankWords(dictionary, words) {
  return [...words].sort(
    (a, b) => b.length - a.length || wordTier(dictionary, a) - wordTier(dictionary, b) || compareText(a, b),
  );
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

/** Words this short must be common to count as readable in a pair. */
const SHORT_WORD_LENGTH = 3;
const COMMON_TIER_LIMIT = 3;

/**
 * Is this pair likely to read as a meaningful phrase?
 * - no two-letter words ("ti", "es")
 * - three-letter words must be common ("set" yes, "els" no)
 * - no rare words at all
 * Without commonness data only the two-letter rule can be applied.
 */
export function isReadablePair(dictionary, pair) {
  return pair.every((word) => {
    if (word.length < SHORT_WORD_LENGTH) return false;
    if (!dictionary.hasTiers) return true;
    const tier = wordTier(dictionary, word);
    return word.length <= SHORT_WORD_LENGTH ? tier <= COMMON_TIER_LIMIT : tier < RARE_TIER;
  });
}

/** Safety bound on pairs held in memory before ranking. */
const MAX_COLLECTED_PAIRS = 100000;

/**
 * Find pairs of dictionary words that together use every letter exactly once.
 * Each pair is returned once, as [longer word, other word].
 *
 * Every pair found is a correct anagram. Ranking only decides the order:
 * readable pairs first (see isReadablePair), then pairs of common words,
 * then pairs with smaller total tier, then evenly sized pairs. The ranking
 * is applied before `limit` truncates, so the first `readableTotal` entries
 * of `phrases` are the readable ones (as far as the limit allows).
 *
 * @returns {{phrases: [string, string][], total: number, readableTotal: number, truncated: boolean}}
 */
export function findTwoWordAnagrams(dictionary, letters, options = {}) {
  const limit = options.limit ?? DEFAULT_PHRASE_LIMIT;
  const minWordLength = Math.max(1, options.minWordLength ?? 2);
  const total = letters.length;
  const empty = { phrases: [], total: 0, readableTotal: 0, truncated: false };
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
  const pairs = [];
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
      if (pairs.length < MAX_COLLECTED_PAIRS) {
        pairs.push(first.length === second.length ? [first, second] : [second, first]);
      }
    }
  }

  const scored = pairs.map((pair) => {
    const tiers = [wordTier(dictionary, pair[0]), wordTier(dictionary, pair[1])];
    const worst = QUALITY_ORDER[wordQuality(dictionary, tiers[0] >= tiers[1] ? pair[0] : pair[1])];
    return {
      pair,
      readable: isReadablePair(dictionary, pair) ? 0 : 1,
      worst,
      sum: tiers[0] + tiers[1],
      spread: pair[0].length - pair[1].length,
      text: pair.join(' '),
    };
  });
  scored.sort(
    (a, b) =>
      a.readable - b.readable || a.worst - b.worst || a.sum - b.sum || a.spread - b.spread || compareText(a.text, b.text),
  );
  const phrases = scored.slice(0, limit).map((entry) => entry.pair);
  const readableTotal = scored.filter((entry) => entry.readable === 0).length;
  return { phrases, total: count, readableTotal, truncated: count > phrases.length };
}

/** Return a sorted copy of `words`. Unknown modes fall back to 'length'. */
export function sortWords(words, mode = 'length') {
  const sorted = [...words];
  if (mode === 'az') return sorted.sort();
  if (mode === 'za') return sorted.sort().reverse();
  return sorted.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Full solve used by the UI. `words` is ranked best first and never
 * contains the input itself.
 * @returns {{
 *   letters: string, words: string[], inputIsWord: boolean,
 *   phrases: [string, string][], phraseTotal: number, readablePhraseTotal: number,
 *   phrasesTruncated: boolean
 * }}
 */
export function solveAnagram(dictionary, letters, options = {}) {
  const words = rankWords(
    dictionary,
    findWords(dictionary, letters, options).filter((word) => word !== letters),
  );
  const pairs = options.includePhrases
    ? findTwoWordAnagrams(dictionary, letters, { limit: options.phraseLimit })
    : { phrases: [], total: 0, readableTotal: 0, truncated: false };
  return {
    letters,
    words,
    inputIsWord: hasWord(dictionary, letters),
    phrases: pairs.phrases,
    phraseTotal: pairs.total,
    readablePhraseTotal: pairs.readableTotal,
    phrasesTruncated: pairs.truncated,
  };
}
