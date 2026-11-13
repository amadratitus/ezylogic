import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MAX_LETTERS,
  createDictionary,
  findTwoWordAnagrams,
  findWords,
  hasWord,
  isAnagram,
  letterCounts,
  normalizeLetters,
  parseAnagramInput,
  parseWordList,
  rankWords,
  wordQuality,
  wordTier,
  signature,
  solveAnagram,
  sortWords,
} from '../src/lib/anagram.js';

const wordListText = readFileSync(new URL('../data/words.txt', import.meta.url), 'utf8');
const tierText = readFileSync(new URL('../data/word-tiers.txt', import.meta.url), 'utf8').trim();
const dictionary = createDictionary(parseWordList(wordListText), tierText);

const small = createDictionary([
  'listen', 'silent', 'enlist', 'tinsel', 'inlets', 'list', 'tin', 'net', 'ten',
  'lee', 'eel', 'else', 'dog', 'god', 'room', 'dirty', 'dormitory', 'Mixed', 'not a word', '',
]);

/** Every result must be spellable from the input: no letter used too often. */
function assertUsesOnly(word, letters) {
  const available = letterCounts(letters);
  const used = letterCounts(word);
  used.forEach((count, index) => {
    assert.ok(count <= available[index], `"${word}" over-uses a letter of "${letters}"`);
  });
}

test('normalizeLetters keeps only a–z, lowercased', () => {
  assert.equal(normalizeLetters('Listen!'), 'listen');
  assert.equal(normalizeLetters('  Dirty Room  '), 'dirtyroom');
  assert.equal(normalizeLetters("it's 4 o'clock"), 'itsoclock');
  assert.equal(normalizeLetters('Café'), 'cafe');
  assert.equal(normalizeLetters('123 !?'), '');
  assert.equal(normalizeLetters(null), '');
});

test('parseAnagramInput validates raw input', () => {
  assert.deepEqual(parseAnagramInput('Listen'), { ok: true, letters: 'listen', ignoredCount: 0 });
  assert.deepEqual(parseAnagramInput('dirty room'), { ok: true, letters: 'dirtyroom', ignoredCount: 0 });
  assert.deepEqual(parseAnagramInput('a-b c!'), { ok: true, letters: 'abc', ignoredCount: 2 });
  for (const bad of ['', '    ', '123', '!!!', 'a', 'x'.repeat(MAX_LETTERS + 1), null, undefined]) {
    const result = parseAnagramInput(bad);
    assert.equal(result.ok, false, `input ${JSON.stringify(bad)}`);
    assert.ok(result.error.length > 0);
  }
  assert.equal(parseAnagramInput('x'.repeat(MAX_LETTERS)).ok, true);
});

test('createDictionary cleans, dedupes and buckets words', () => {
  const dict = createDictionary(['Tea', 'tea', 'eat', 'no way', 'x1', 'ate']);
  assert.equal(dict.size, 3);
  assert.deepEqual(dict.byLength.get(3), ['ate', 'eat', 'tea']);
  assert.equal(hasWord(dict, 'tea'), true);
  assert.equal(hasWord(dict, 'xyz'), false);
});

test('isAnagram and signature compare letter frequencies', () => {
  assert.equal(signature('listen'), 'eilnst');
  assert.equal(isAnagram('Listen', 'Silent'), true);
  assert.equal(isAnagram('Dormitory', 'dirty room'), true);
  assert.equal(isAnagram('aab', 'abb'), false);
  assert.equal(isAnagram('abc', 'abcd'), false);
});

test('finds exact anagrams in a small dictionary', () => {
  const words = findWords(small, 'listen', { minLength: 6 });
  assert.deepEqual(words, ['enlist', 'inlets', 'listen', 'silent', 'tinsel']);
});

test('finds shorter words, longest first, honouring length bounds', () => {
  const words = findWords(small, 'listen', { minLength: 3, maxLength: 4 });
  assert.deepEqual(words, ['list', 'net', 'ten', 'tin']);
  assert.deepEqual(findWords(small, 'listen', { minLength: 7 }), []);
});

test('repeated letters are respected', () => {
  // "else" needs two e's; "lese" has them, "les" does not.
  assert.ok(findWords(small, 'lese').includes('else'));
  assert.ok(!findWords(small, 'les').includes('else'));
  assert.deepEqual(findWords(small, 'ele'), ['eel', 'lee']);
  assert.deepEqual(findWords(small, 'el'), []);
});

test('real dictionary: listen', () => {
  const result = solveAnagram(dictionary, 'listen', { minLength: 6 });
  assert.deepEqual([...result.words].sort(), ['elints', 'enlist', 'inlets', 'silent', 'tinsel']);
  assert.equal(result.words[0], 'silent', 'most common anagram first');
  assert.equal(result.words.at(-1), 'elints', 'rare word last');
  assert.equal(result.inputIsWord, true);
  assert.ok(!result.words.includes('listen'), 'the input itself is not listed');
});

test('real dictionary: every result is a genuine dictionary word built from the input', () => {
  for (const letters of ['triangle', 'aardvark', 'mississippi', 'banana', 'stressed', 'qzxjv']) {
    const words = findWords(dictionary, letters, { minLength: 2 });
    for (const word of words) {
      assert.ok(hasWord(dictionary, word));
      assertUsesOnly(word, letters);
      if (word.length === letters.length) assert.equal(signature(word), signature(letters));
    }
    assert.equal(new Set(words).size, words.length, 'no duplicates');
  }
});

test('real dictionary: known anagram sets', () => {
  assert.ok(findWords(dictionary, 'triangle', { minLength: 8 }).includes('integral'));
  assert.ok(findWords(dictionary, 'stressed', { minLength: 8 }).includes('desserts'));
  assert.ok(findWords(dictionary, normalizeLetters('Dirty Room'), { minLength: 9 }).includes('dormitory'));
  assert.ok(findWords(dictionary, normalizeLetters('LISTEN'), { minLength: 6 }).includes('silent'));
});

test('real dictionary: input with no full anagram returns none', () => {
  assert.deepEqual(findWords(dictionary, 'qzxjv', { minLength: 5 }), []);
  const result = solveAnagram(dictionary, 'zzzz', { minLength: 2 });
  assert.deepEqual(result.words, []);
  assert.equal(result.inputIsWord, false);
});

test('two-word anagrams use every letter exactly once', () => {
  const { phrases, total, truncated } = findTwoWordAnagrams(small, 'dirtyroom');
  assert.deepEqual(phrases, [['dirty', 'room']]);
  assert.equal(total, 1);
  assert.equal(truncated, false);

  const real = findTwoWordAnagrams(dictionary, 'dormitory', { limit: 10000 });
  assert.ok(real.phrases.some(([a, b]) => a === 'dirty' && b === 'room'));
  const seen = new Set();
  for (const [first, second] of real.phrases) {
    assert.ok(hasWord(dictionary, first) && hasWord(dictionary, second));
    assert.equal(signature(first + second), signature('dormitory'));
    const key = [first, second].sort().join(' ');
    assert.ok(!seen.has(key), `pair listed twice: ${key}`);
    seen.add(key);
  }
});

test('two-word anagrams respect the limit and report truncation', () => {
  const full = findTwoWordAnagrams(dictionary, 'conversation', { limit: 100000 });
  const capped = findTwoWordAnagrams(dictionary, 'conversation', { limit: 5 });
  assert.ok(full.total > 5);
  assert.equal(capped.phrases.length, 5);
  assert.equal(capped.total, full.total);
  assert.equal(capped.truncated, true);
  assert.deepEqual(findTwoWordAnagrams(dictionary, 'abc').phrases, []);
});

test('ranking never changes which pairs are found, only their order', () => {
  const ranked = findTwoWordAnagrams(dictionary, 'astronomer', { limit: 100000 });
  const unranked = findTwoWordAnagrams(createDictionary(parseWordList(wordListText)), 'astronomer', { limit: 100000 });
  const normalize = (result) => result.phrases.map((pair) => [...pair].sort().join(' ')).sort();
  assert.equal(ranked.total, unranked.total);
  assert.deepEqual(normalize(ranked), normalize(unranked));
  // Readable pairs of common words come first; pairs with rare words last.
  assert.deepEqual(findTwoWordAnagrams(dictionary, 'dormitory').phrases[0], ['dirty', 'room']);
  assert.deepEqual(findTwoWordAnagrams(dictionary, 'conversation').phrases[0], ['covers', 'nation']);
  const qualityOfPair = ([a, b]) => Math.max(...[a, b].map((word) => ['common', 'familiar', 'rare'].indexOf(wordQuality(dictionary, word))));
  const qualities = ranked.phrases.map(qualityOfPair);
  assert.deepEqual(qualities, [...qualities].sort((a, b) => a - b));
});

test('commonness tiers load and classify words', () => {
  assert.equal(dictionary.hasTiers, true);
  assert.equal(tierText.length, dictionary.size);
  assert.equal(wordQuality(dictionary, 'listen'), 'common');
  assert.equal(wordQuality(dictionary, 'starer'), 'familiar');
  assert.equal(wordQuality(dictionary, 'elints'), 'rare');
  assert.ok(wordTier(dictionary, 'the') < wordTier(dictionary, 'tinsel'));
  assert.deepEqual(rankWords(dictionary, ['elints', 'tin', 'tinsel', 'silent', 'net']), ['silent', 'tinsel', 'elints', 'net', 'tin']);
});

test('tiers are ignored when they do not line up with the word list', () => {
  const dict = createDictionary(['tea', 'eat'], '1');
  assert.equal(dict.hasTiers, false);
  assert.equal(wordQuality(dict, 'tea'), 'familiar');
  assert.deepEqual(rankWords(dict, ['tea', 'eat']), ['eat', 'tea']);
});

test('sortWords orders by length, A–Z and Z–A without mutating', () => {
  const words = ['tin', 'silent', 'list', 'enlist'];
  assert.deepEqual(sortWords(words, 'length'), ['enlist', 'silent', 'list', 'tin']);
  assert.deepEqual(sortWords(words, 'az'), ['enlist', 'list', 'silent', 'tin']);
  assert.deepEqual(sortWords(words, 'za'), ['tin', 'silent', 'list', 'enlist']);
  assert.deepEqual(words, ['tin', 'silent', 'list', 'enlist']);
});

test('performance: longest allowed input solves quickly', () => {
  const letters = normalizeLetters('the quick brown fox jumps over a lazy dog').slice(0, MAX_LETTERS);
  const started = performance.now();
  const result = solveAnagram(dictionary, letters, { minLength: 2, includePhrases: true });
  const elapsed = performance.now() - started;
  assert.ok(result.words.length > 1000);
  assert.ok(elapsed < 2000, `took ${elapsed.toFixed(0)}ms`);
});

test('dictionary file is clean', () => {
  assert.ok(dictionary.size > 170000);
  assert.ok(wordListText.split('\n').filter(Boolean).every((word) => /^[a-z]+$/.test(word)));
});
