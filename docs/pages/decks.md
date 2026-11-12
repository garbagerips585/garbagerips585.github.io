# Deck pages: /decks.html and /top-100-playable.html

Covers the Limitless corpus, the verbatim .txt decklists, what the ranking measures, and the set-code check.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## Deck pages

Two pages about PLAYING the game rather than collecting it, both built from one
corpus. Three scripts, and the first is run BY HAND:

    node scripts/sync-decks.mjs      Limitless -> data/decks.json  (network)
    node scripts/build-decks.mjs     /decks.html + public/decks/*.txt
    node scripts/build-playable.mjs  /top-100-playable.html

`shared/decks.mjs` is the shared half: it loads the corpus, resolves every card
against `public/data/card-index.json` for its picture, and ranks the cards. Both
builders go through it, so the two pages cannot print different numbers for the
same data or disagree about what format they are describing.

`sync-decks.mjs` is NOT in build-all.mjs and must not be added to it. It makes a
few hundred requests to Limitless and what it records is a dated measurement of
a metagame, so refreshing it is a deliberate act by a person who then re-reads
what the pages claim. Responses cache under `.cache/decks/`, so a re-run is
free.

**THE .txt FILES ARE THE POINT AND THEY ARE VERBATIM.** Pokemon TCG Live imports
a decklist by paste, so `public/decks/<deck>.txt` is a real working artifact
rather than a description of one: it is the export string Limitless's own Copy
to Clipboard button writes, byte for byte, with a trailing newline and nothing
else. NEVER PREPEND ANYTHING TO ONE, not a header, not a url, not a credit line.
The importer reads everything on the clipboard and a decklist that fails to
import is worse than no decklist. The attribution lives on the page instead. The
page also shows every list as readable text and offers a copy button, because a
phone reader wants to read a deck before building it and downloading a text file
on a phone is the worst part of the job.

Format: `Pokémon:`, `Trainer:` and `Energy:` headers each followed by the TOTAL
cards in that section rather than the number of lines, then `<qty> <name> <SET>
<number>` per line, one blank line between sections, no "Total Cards" line.
`sync-decks.mjs` refuses any list that does not sum to 60. **Set codes can carry
a hyphen** (`PR-SV 149` for promos) and an expression that stopped at `[A-Z0-9]`
silently threw away eleven legal decks on the first run.

**WHAT THE RANKING MEASURES, and it is narrower than the obvious phrase.** These
are the MOST PLAYED decks, ordered by share of the recorded field, in ONLINE
tournaments played in TCG Live on Limitless's own play platform: things called
"Sunny's Weekly" and "SEASAC League Challenge", run by community organisers for
booster-code prizes. THEY ARE NOT PAPER EVENTS. Not Regionals, not
Internationals, not Worlds, and both pages say so in those words. "Best deck" is
not a claim this site can source and is never made. Win rate is printed and
never sets the order. The top-100 ranks by how many of the collected lists play
a card, never by price: a separate page ranks cards by value and the two must
not be merged.

Legality is BY CONSTRUCTION. Every list is drawn through Limitless's own
Standard / 2026 rotation filter, so neither builder adjudicates a card. The
rotation itself is official (marks H, I and J legal, G rotated out; 26 March
2026 in Live, 10 April 2026 on paper) and is printed on both pages with the date
it was read, because "current format" is a claim with an expiry.
`/how-to-play.html` independently says H, I or J from the tournament handbook,
which is the cross-check.

`SET_CODES` in shared/decks.mjs maps Limitless's codes to our slugs and is
VERIFIED ON EVERY BUILD rather than trusted: `checkSetMap` looks up each
printing and compares the name we hold against the name Limitless wrote. A
mismatch fails the build, because the failure mode is a card drawn with another
card's picture, which looks fine. An unresolved code only warns: basic Energy
from the MEE sheet and one PR-SV promo come from sets this site has no guide
for, so those rows carry a drawn tile rather than a borrowed scan.
