# Site search and species links

Covers the typo-tolerant search and the card-name links into /pokemon/ pages, both added on 11 November 2026.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Written on 2026-11-11 from the module headers at HEAD; read those headers for the full argument.

## Forgiving search: shared/fuzzy-text.mjs

/search.html and /cards.html are inline scripts with no module loader, so the one copy of the code lives in
`FUZZY_SRC` in shared/fuzzy-text.mjs and each builder inlines it verbatim (the same way shared/search-text.mjs
ships `norm()`). Measured before it existed: "charzard", "delta rein" and "raikuo" all answered "Nothing
matched" on both pages.

The rules, which the owner approved and callers must not loosen:

- a word of 4 to 7 letters may be 1 edit from a word in the index; a word of 8 or more may be 2 edits away;
- a word under 4 letters, a word holding a digit ("30th", "136") and a quoted phrase are never corrected;
- an edit is an insertion, a deletion, a substitution or a swap of two neighbors;
- it only ever runs AFTER the exact match found nothing, so it cannot reorder or dilute a search that works.

## Species links: shared/species-link.mjs

A card name on a set guide or a rip page links to its /pokemon/<species>.html page. An internal link audit had
found most species pages with three or fewer inbound links, because set guides listed every card without
linking a name and rip pages had no link into /pokemon/ at all.

- **It is build-pokemon.mjs's own join, not a second matcher.** `speciesOf()` strips the owner's name, the
  mechanic suffix and "Mega"; what is left is looked up in a tally built from the printing corpus
  (public/data/printings/*.json), where every Pokemon card carries its National Dex number. build-pokemon.mjs
  still carries its own copy of `speciesOf()`; until it imports this one, the two must be kept identical.
- A Trainer or an Energy never enters the tally and gets no link. Nothing here guesses.
- **Only indexable pages are linked.** public/data/pokemon-index.json carries the `index` flag, and a species
  whose flag is false gets no link.
- The index is read from the LAST build by the two set guide builders, because build-all.mjs runs them before
  build-pokemon.mjs. A link can never 404; the worst a stale flag does is link one noindex page or skip one
  newly indexable page until the next build.
