# Data provenance

Two files drive the anagram solver. They play different roles and come from different sources.

| File | Role | Affects which words are found? |
| --- | --- | --- |
| `words.txt` | The dictionary: the only source of valid words | Yes |
| `word-tiers.txt` | A tier per word, used to order results and to decide which two-word pairs are shown by default | No |

## words.txt

- **What:** ENABLE (Enhanced North American Benchmark Lexicon), 172,823 lowercase words, one per line, sorted.
- **Authors:** Alan Beale and M. Cooper.
- **Licence:** public domain. The authors ask to be credited as originators, which the About page and README do.
- **Obtained from:** the `enable1.txt` copy in the public GitHub repository `dolph/dictionary`, not from the original ENABLE distribution. It was filtered to lines matching `^[a-z]+$` and sorted; no words were added or removed by that step.
- **Not independently verified** against the original ENABLE release.
- **SHA-256:** `3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89`

## word-tiers.txt

- **What:** one digit per line of `words.txt`, in the same order. 1 to 7 are SCOWL size levels 10, 20, 35, 40, 50, 55 and 60. 9 means the word is not in SCOWL up to level 60.
- **Source:** SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson, as packaged in the npm package `wordlist-english` 1.2.1. That package does not record which SCOWL release it contains; its copyright notice is dated 2000 to 2016.
- **How it was made:** `scripts/build-word-tiers.mjs` looks up each ENABLE word in the SCOWL lists (shared, American, British, Canadian and Australian) and keeps the lowest level it appears at. Only the level digit is stored; no SCOWL word text is redistributed.
- **Licence:** permissive. Use, modification and distribution are allowed provided the copyright and permission notice is kept. The complete notice is in `SCOWL-COPYRIGHT.txt`.
- **SHA-256:** `1d5907f7b3465735fa8ec5b0e9954dc12c5eafc114974f91e5c2abc8c0643752`

### This is spelling-list data, not word-frequency data

SCOWL levels say how widely a word is known, as an editorial judgement. They are not counts of how often words appear in text.

- Levels 10 and 20 draw partly on two old frequency classifications (Moby Words II and Brian Kelk's UK English word list), both stated to be public domain.
- Levels 35 to 60 are mostly decided by how many of twelve dictionaries list a word (Alan Beale's 12Dicts, public domain), with inflected forms added.

So the app's labels "common", "familiar" and "rare" are estimates. Known consequences:

- Tiers are coarse: thousands of words share each level, so order within a level falls back to alphabetical.
- A word can be well known and still sit at a high level, or the reverse.
- The levels reflect dictionaries and sources from before 2016.

Replacing this file with real corpus frequency data would improve ranking. It would need a source whose licence allows redistribution.

### Components of SCOWL and their terms

The notice in `SCOWL-COPYRIGHT.txt` covers several contributing sources. Those that can affect levels up to 60:

- SCOWL itself and VarCon: Kevin Atkinson's permissive licence (notice must be kept).
- Moby Words II, Brian Kelk's list, 12Dicts, 3esl, 2of4brif: public domain.
- WordNet 1.6 (used to generate inflections): Princeton's permissive licence (notice must be kept).
- Ispell word lists (via VarCon): BSD-style licence (notice must be kept).

The UK Advanced Cryptics Dictionary (UKACD), which requires its notice to be displayed prominently, enters SCOWL only at level 80 and for accent information. Levels above 60 are not used here. Its notice is included all the same, as part of the complete SCOWL notice.

This is an engineering reading of the licence texts, not legal advice.
