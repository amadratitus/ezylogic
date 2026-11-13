// Loads the word list once, on first use, and shares it between callers.
import { createDictionary, parseWordList } from '../lib/anagram.js';

const WORD_LIST_URL = new URL('../../data/words.txt', import.meta.url);
const WORD_TIERS_URL = new URL('../../data/word-tiers.txt', import.meta.url);

let pending = null;

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status}).`);
  return response.text();
}

/** @returns {Promise<ReturnType<typeof createDictionary>>} */
export function loadDictionary() {
  if (!pending) {
    pending = Promise.all([
      fetchText(WORD_LIST_URL),
      // Commonness data only affects ordering, so the solver still works without it.
      fetchText(WORD_TIERS_URL).then((text) => text.trim(), () => null),
    ])
      .then(([wordText, tiers]) => {
        const dictionary = createDictionary(parseWordList(wordText), tiers);
        if (dictionary.size === 0) throw new Error('The word list is empty.');
        return dictionary;
      })
      .catch((error) => {
        pending = null; // allow a retry
        throw error;
      });
  }
  return pending;
}
