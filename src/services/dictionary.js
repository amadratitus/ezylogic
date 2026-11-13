// Loads the word list once, on first use, and shares it between callers.
import { createDictionary, parseWordList } from '../lib/anagram.js';

const WORD_LIST_URL = new URL('../../data/words.txt', import.meta.url);

let pending = null;

/** @returns {Promise<ReturnType<typeof createDictionary>>} */
export function loadDictionary() {
  if (!pending) {
    pending = fetch(WORD_LIST_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Word list request failed (${response.status}).`);
        return response.text();
      })
      .then((text) => {
        const dictionary = createDictionary(parseWordList(text));
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
