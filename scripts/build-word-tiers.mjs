// Rebuilds data/word-tiers.txt from SCOWL frequency lists.
//
// Usage: node scripts/build-word-tiers.mjs <dir containing english-words-10.json etc.>
// The JSON files come from the `wordlist-english` npm package (SCOWL data).
//
// Output: one digit per line of data/words.txt, in the same order:
//   1-7 = SCOWL size 10, 20, 35, 40, 50, 55, 60 (lower is more common)
//   9   = not in SCOWL up to size 60 (rare)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node scripts/build-word-tiers.mjs <wordlist-english package dir>');
  process.exit(1);
}

const SIZES = [10, 20, 35, 40, 50, 55, 60];
const DIALECTS = ['english', 'american', 'british', 'canadian', 'australian'];
const root = new URL('..', import.meta.url);

const tierOf = new Map();
SIZES.forEach((size, index) => {
  for (const dialect of DIALECTS) {
    const words = JSON.parse(readFileSync(join(sourceDir, `${dialect}-words-${size}.json`), 'utf8'));
    for (const word of words) {
      const key = word.toLowerCase();
      if (!tierOf.has(key)) tierOf.set(key, index + 1);
    }
  }
});

const words = readFileSync(new URL('data/words.txt', root), 'utf8').split('\n').filter(Boolean);
const digits = words.map((word) => tierOf.get(word) ?? 9).join('');
writeFileSync(new URL('data/word-tiers.txt', root), `${digits}\n`);

const counts = {};
for (const digit of digits) counts[digit] = (counts[digit] ?? 0) + 1;
console.log(`Wrote ${digits.length} tiers`, counts);
