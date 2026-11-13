// Letter tiles: the visual motif for anything made of letters.
import { h } from '../dom.js';

/**
 * A row of letter tiles. Decorative by default: pass `label` to expose the
 * word to assistive technology as a single image.
 */
export function letterTiles(text, { size = 'md', label = null } = {}) {
  const tiles = [...text].map((letter) => h('span', { class: 'tile' }, letter));
  return h(
    'span',
    label
      ? { class: `tiles tiles--${size}`, role: 'img', 'aria-label': label }
      : { class: `tiles tiles--${size}`, 'aria-hidden': 'true' },
    tiles,
  );
}

/**
 * Tiles that glide into a new order. `setWord` must be given an anagram of
 * the initial word: each tile keeps its letter and moves to its new slot.
 */
export function shufflingTiles(initialWord) {
  const tiles = [...initialWord].map((letter, index) => {
    const tile = h('span', { class: 'tile' }, letter);
    tile.style.setProperty('--slot', String(index));
    return { letter, element: tile };
  });
  const element = h('span', { class: 'tiles tiles--lg tiles--shuffle', 'aria-hidden': 'true' }, tiles.map((tile) => tile.element));
  element.style.setProperty('--count', String(tiles.length));

  function setWord(word) {
    const free = new Set(tiles);
    [...word].forEach((letter, slot) => {
      const tile = [...free].find((candidate) => candidate.letter === letter);
      if (!tile) return;
      free.delete(tile);
      tile.element.style.setProperty('--slot', String(slot));
    });
  }
  return { element, setWord };
}
