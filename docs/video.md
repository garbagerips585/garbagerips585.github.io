# Video data, which pages have something to watch, and video display rules

Covers videos.json and tagging, the pulls tally, the inventory of page families that link a rip, the Hall of Fame joins, the overflow test, and the measured display rules for tiles and rails.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## Video data
- `public/data/videos.json` is the whole catalogue, `playlists.json` the
  playlists. Both are written by `scripts/sync-youtube.mjs`.
- Tags (card set, product type, pull grade) are derived from title plus
  description by `shared/taxonomy.mjs`. Coverage is roughly 90% when the
  description is available, about 50% from titles alone. Hand corrections go
  in `data/overrides.json` and always win.
- No live feed layer. /api/latest was a Cloudflare Function proxying the
  YouTube RSS feed (the feed sends no CORS headers, so the browser cannot read
  it directly). GitHub Pages cannot execute a function, so that fetch was a
  guaranteed 404 on every grid page and both it and functions/ are deleted.
  Freshness comes from the nightly refresh workflow instead.
- **`pulls` IS NOT DERIVED FROM THE TITLE AND HAS NOT BEEN FOR A WHILE.**
  `sync-youtube.mjs:272` is `pulls: manual.pulls ?? pullsFromHitCard(log.hitCard)
  ?? []`, so a pull tag is a rarity named in the rip log's HIT CARD cell, by a
  person. /luck.html said "Counted from what the titles say rather than from the
  rip log" on a live page and build-luck.mjs's own header used the same claim to
  JUSTIFY a rule; both were corrected 21 August 2026. The rule they justify still
  stands, because the bias moved rather than went away: a rip whose Hit Card cell
  is empty produces no tag and would read as a rip that produced nothing, so
  `hasHit` is still the only column that can carry a denominator.
- **THAT TALLY COUNTS RIPS, NOT CARDS, AND THE PAGE SAYS SO NOW.**
  `pullsFromHitCard` ends `[...new Set(ids)]`, so one video contributes at most
  one tag per rarity: 76 tags across 71 rips against the 93 cards in
  data/hits.json, and the Costco box alone is 14 cards under 5 tags. The
  deduplication is right, because the band asks how often a rip produces each
  kind of card and counting one opening five times would let a single lucky box
  outweigh a month of them. Both totals are COMPUTED into the sentence, never
  typed. **`RARITY_ID_TO_PULL` has no entry for a BLACK STAR PROMO**, so a promo
  can never badge and two of that box's fourteen cards are invisible to it; the
  three lowest Japanese tiers are absent deliberately, by the same rule that maps
  `rare` to null. Adding a tier is a feature, not a copy fix: it means a label in
  shared/taxonomy.mjs, a badge treatment and a retag that moves 318 pages.

> **ADDED 11 NOVEMBER 2026 (note written in the restructure): `paginate()` in scripts/sync-youtube.mjs and its
> stop conditions are load bearing.** One playlist began answering an EMPTY page that still carried a
> `nextPageToken`, forever. The old loop only capped by item count, so it never tripped, and it spent one quota
> unit per call until the YouTube Data API refused with quotaExceeded. Every nightly from 4 to 8 November 2026
> died that way, ten minutes in, and took the price refresh with it. `paginate()` now stops on an empty page,
> on a token it has seen before, or after `MAX_PAGES` (200), whichever comes first. Do not remove any of the
> three. See docs/nightly-and-deploy.md for the alert that now reports a dead nightly.

## Which pages have something to watch

Counted from the built tree 18 August 2026, by whether the page links a
`/rip/` page at all. This is the inventory the "no seventh exception" argument
points at, and it is the worklist: a family with nothing to watch is a family
where a reader cannot discover the channel by being interested.

      rip           316 of  316    the video is the page
      pokemon       918 of 1026    39 before the set join went in
      openings       14 of   14    the INDEX was the 14th, and had none
      playlists      21 of   21
      sets           35 of   42    was 23; see below
      retailers       0 of    9    deliberate, see below
      games           0 of    5    deliberate, see below
      root pages     11 of   45    was 2, index.html and videos.html

THE 12 SET GUIDES THAT GAINED ONE WERE NOT A JOIN FAILURE. They are the
Japanese, Korean and Chinese guides, and every one of them had its rips tagged
and joined correctly the whole time: `ripsBand` in build-intl-pages.mjs printed
"We ripped 5 of these" and a button to /videos.html filtered by the set, and
never listed a single video. The English guides had listed theirs since they
were built. So the fix was a missing LIST, not a missing join, which is worth
saying because the obvious diagnosis was the join and it was wrong. The 7 with
none are the 6 English sets nobody has opened plus /sets/index.html.

THE ROOT GUIDES WENT 2 TO 11 AND EACH ONE USED A KEY THAT PAGE ALREADY HELD.
/about.html, /start.html and /luck.html by video id; /rarity.html by the
rarity NAME in data/hits.json; /wanted.html, /pack-prices.html and
/expansions.html by set slug; /what-to-buy.html and /openings/index.html by
product kind. No new tagging, no title matching, nothing hand-listed.

TWO RULES CAME OUT OF DOING IT AND BOTH ARE REUSABLE.
  - **"N rips" AND "1 rip" WANT DIFFERENT DESTINATIONS.** A plural asks for a
    list, so it goes to /videos.html filtered by the set. A singular pointed at
    an index page holding one tile, which is a tap spent on nothing, so it now
    goes straight to that rip. Two or more never resolves to one video: picking
    one is choosing a favourite and hiding the rest, and there is no honest
    label for that. /expansions.html and /pack-prices.html both do this.
  - **ONE PER KIND BEFORE ANY KIND REPEATS.** Same round robin as `setRipsFor`
    in build-pokemon.mjs and for the same reason. Single packs are 90 of the
    316 videos, so a newest-first slice off the pool turns a band about the
    VARIETY of sealed product into a band about single packs.

THE FAMILIES AT ZERO ARE STAYING THERE, and this is a decision rather than a
gap. A retailer page is about WHERE TO BUY and a minigame is a toy; neither has
a rip that illustrates it, and bolting a video onto one would be the "vaguely
related" failure the whole rule is against. The same call was made on six root
guides: /base-set.html (the channel has never opened 1999 Base Set),
/fake-cards.html and /will-it-grade.html (their subject is a card in your hand,
not a pack coming open), /eevee-evolutions.html (its only key is a Pokemon
slug, which videos.json does not carry), /drops.html (a retailer restock
forecast), /complete-a-set.html (a cost table whose whole argument is to buy
singles rather than open packs) and /what-set.html (identification, where a rip
would be decoration). If a later editor disagrees, argue it here first.

THE JOIN THAT MADE THE POKEDEX WORK IS REUSABLE and is the interesting half:
a species has printings, a rip is tagged with the set it opened, so a rip of a
set that prints this card is relevant WITHOUT anybody hand-tagging anything.
Any page that can name a set or a card can do the same. Title matching alone
fired on 3.8% of the Pokedex; the set join fires on 89.6%.

**THE HALL OF FAME KNEW WHICH VIDEO EVERY PLAQUE CAME OUT OF AND THREW IT AWAY
ON ONE LINE.** data/hits.json is keyed BY YOUTUBE VIDEO ID and the fallback
loop in build-hall.mjs read it with `Object.values`, so the site's most
shareable page carried one link to the whole rip library and none to the
opening any of its cards actually came out of. `Object.entries` plus a lookup
in videos.json is the entire fix; the join is total, 18 of 18 hit entries and
3 of 3 video ids resolve. A card inducted by hand in data/hall.json carries no
video id and renders no link, which is the standing pattern for absent data.

**THAT PAGE PROMISES COMPLETENESS TWICE AND WAS DROPPING ELEVEN ROWS IN
SILENCE, FIXED 21 AUGUST 2026.** Its lede says "Every card that has come out of
a pack on this channel" and "Nothing here was hand picked: this is the whole
list of what was pulled on camera". It showed 74 plaques out of 93 hit rows and
three of the four `continue`s that took the rest said nothing at all. **Every
drop in build-hall.mjs reports now**, one line each, and the run prints how many
rows it read against how many cards it inducted. It is 80.

  - **THE INTL EXCLUSION WAS THE INTERESTING ONE AND IT WAS NOT A DATA GAP.**
    `catch { continue; }` on a missing `public/data/cards/<id>.json` meant every
    Japanese, Korean and Chinese hit was STRUCTURALLY excluded, because that
    directory holds the 28 English sets and nothing else. The other checklist,
    `public/data/intl-guides.json`, has been building /sets/ja-*.html for weeks
    and import-sheet.mjs already reads both. build-hall.mjs reads both now.
  - **THE JAPANESE RARITY LADDER IS STILL NOT MAPPED ONTO THE ENGLISH ONE**, per
    shared/rarity.mjs, and that costs two plaques their collector number rather
    than being bent. The sheet writes Goldeen's tier as "Art Rare" (アートレア on
    the wrapper) and TCGdex's English field for the same card says "Illustration
    rare", and Abyss Eye lists Goldeen TWICE, #012 Common and #084 Illustration
    rare. The old `same[0]` fallback handed the plaque the COMMON. An intl row
    takes a printing only where the name is unique in the set; otherwise it goes
    in on the sheet's own words with no number, which asserts nothing.
  - **A PLAQUE WITH NO SCAN IS NOT A BUTTON.** `.chof-noart` had never fired,
    because every English checklist has scans and TCGdex publishes none for
    these sets. It would have shipped a control aria-labelled "Enlarge Goldeen"
    wired to a lightbox with no picture, which is the Celebrations Mew fault on
    /sets/celebrations.html word for word.
  - **THE TALLY LABEL HAD TO STOP SAYING "ALL".** "All of them raw" was a sum
    over the cards that HAVE a raw price and was exact while every plaque had
    one. Three do not, so it reads "Raw on 77 of 80", matching the PSA 10 tile
    beside it, which has always named its subset.
  - **THE ROWS THAT DO NOT RESOLVE, RE-TAKEN 22 AUGUST 2026, AND THE BELLIBOLT
    ONE IS NOT AMONG THEM ANY MORE.** This bullet described a single sheet typo,
    "Iono's Bellibolt" against Ascended Heroes' "Iono's Bellibolt ex". THAT
    FAULT IS GONE: rows 127 and 222 both read "Iono's Bellibolt ex" today and
    both resolve. Checked against the workbook AND the built tree rather than
    against this file, because a list of broken rows goes stale the moment the owner
    edits a cell, and this one had. **Five rows are left and every one of them
    needs him, not code.** The right-hand column is what the checklist we
    already hold says the card is, so each is one cell edit away:

      row  video         the Hit Info cell as typed                    the checklist holds
      204  QXS1W_L2qbs   Bidoof PEELABLE DITTO 059/078 Reverse Holo    Pokemon GO #059 Bidoof
      205  sdZx0lmq2mQ   Mega Froslass ex - Pink and Green Star -      Ascended Heroes #047, #265 or #275,
                         Mega Attack Rare                              three printings of the one card
      221  U91JWMsUHAU   Paras - Galarian Gallery                      NOTHING. Our Crown Zenith checklist is
                                                                       160 numbered cards, no Galarian Gallery
                                                                       subset and no Paras at all
      228  J-Gqbe3jPn4   Gold Fighting Energy - Secret Rare            Chilling Reign #233 Fighting Energy
      240  i9htInhtbCw   Trainer - Egg Incubator Gold - Secret Rare    Pokemon GO #087 Egg Incubator (#066 is
                                                                       the Uncommon one, #087 is the gold)

    **ROW 254 WAS THE SIXTH AND IT WAS OURS, SO IT WAS FIXED IN CODE AND NOT IN
    THE SHEET**, 22 August 2026. "Radiant Charizard - Radiant Rare" came out as
    a card called "Radiant Charizard Radiant Rare" and matched nothing, because
    Radiant Rare was not a rung in RARITY_KEY and import-sheet.mjs derives the
    names it will split off the front of a card from those labels. Adding the
    rung resolved it to Pokemon GO #011 with no cell touched: plaques went 145
    to 146, and the scan, the $17.28 and the number are on the rip page. **A
    Radiant card draws NO stars and that was established off the scans rather
    than guessed** -- read the block at the top of shared/rarity.mjs before
    anybody puts a star count on it.

    **MEGA ATTACK RARE, ON ROW 205, IS NOT THE SAME KIND OF GAP AND MUST NOT BE
    ADDED TO THE KEY.** It is the Pokemon TCG API's word for a tier the TCGdex
    checklist calls Ultra Rare, and this is already settled in the tree:
    sync-sets.mjs records that Ascended Heroes reads "14 Ultra Rare + 7 Mega
    Attack Rare" from one feed and "21 Ultra Rare and no Mega Attack Rare" from
    the other, and gives it to the checklist, so the name no longer reaches
    sets.json at all. data/rarity.json's own readme lists "Mega Attack Rare's
    pastel star symbol. Single-sourced, unverified." among the claims it
    refuses to publish. There is no printed tier here to add. That row also
    needs one thing the other four do not: the checklist holds three Mega
    Froslass ex, so the NUMBER has to come from the owner as well as the tier.

    > **ADDED 11 NOVEMBER 2026 (note written in the restructure).** TCGdex itself began answering "Mega Attack
    > Rare" for these cards, which froze the nightly of 11 November. The name is now folded to Ultra Rare at
    > ingestion in scripts/sync-cards.mjs (`RARITY_ALIAS`), matching import-sheet.mjs `RARITY_SYNONYM`. The
    > paragraph above still holds: there is no rung for it and adding one is the owner's call. See
    > docs/set-pages.md.

    **FIX THESE IN THE SHEET AND RE-IMPORT; do NOT edit data/hits.json**, which
    import-sheet.mjs rebuilds per video. A cell naming a card no checklist holds
    still publishes the name and nothing else, which is the standing behaviour
    and is better than a guess.

**THREE FIRST PARTNER PROMOS ARE ON IT NOW AND THE JOIN THAT PUT THEM THERE IS
`printing`.** data/hits.json records Rowlet MEP 043, Litten 044 and Popplio 045
pulled twice, with no set, no number and no price, while
/first-partner-illustration-collection.html had been publishing a raw price AND
a PSA 10 for all three since 19 August. Nobody joined the two files, so six rows
on M7NqqhR8V4M and xNGxOuMpSiw printed "No market price": 6 of only 7 such rows
in the whole tree, now 1. `shared/first-partner.mjs` owns the join, it is keyed
on `printing` and NOT on the card name (a bare "Rowlet" on some other rip is a
different card, and PriceCharting files every English promo in one console), and
it refuses any figure whose two reads disagreed, which is that file's own rule.

**DO NOT MEASURE THIS WITH `window.innerWidth`.** /pack-prices.html reports
592 and /expansions.html 488 at a 390px device, and both are correct pages: the
table sits in a `div.cc-scroll` with `overflow-x:auto` and scrolls inside it.
`documentElement.scrollWidth` says the same wrong thing. The test that means
something is an element whose right edge is past `documentElement.clientWidth`
with NO clipping ancestor between it and the root, so nothing can ever scroll
to it. That is what caught a real fault added in this pass: `.riplist span` is
`white-space:nowrap` in ui.css, which is right for "18 Aug 2026 &bull; 3 packs"
on a set guide and wrong for a video title, and one caption ran 505px wide and
hung 204px off the right edge of /openings/index.html while `scrollX` stayed 0
and the site's own overflow test passed it. Same shape as the Topps `<code>`
bug recorded above.

## Video display rules (these were measured, do not "fix" them)
- Thumbnails come from `i.ytimg.com/vi_webp/<id>/oardefault.webp`, falling
  back to `oardefault.jpg` then `maxresdefault.jpg`. "oar" is the only
  variant at the video's true vertical shape; hqdefault and maxresdefault are
  4:3 and 16:9 crops that letterbox a Short.
- Grid tiles are **2:3**, not 9:16. YouTube, Instagram and TikTok all crop
  vertical video for grids; a true 9:16 tile is 1.78x tall and turns the page
  into a wall of skinny rectangles. The player opens to 9:16 on click so
  playback has no bars.
- Columns: 6 / 4 / 3 / 2, matching YouTube's own Shorts grid.
- Never put live iframes in a grid. One player is ~540KB, so the grid is a
  click-to-load facade and only one player is ever live at a time.
- `modestbranding` is deprecated and does nothing. `rel=0` still scopes end
  screens to this channel.
- All but one video is vertical. The exception is `kj7532tb0_I`. Counts are
  deliberately not written here: they were, and they went stale. Run
  `node scripts/build-untagged.mjs` for the current ones.
- **A rip rail differentiates by what was OPENED, never by what came out.**
  The obvious idea — a hit / no-hit mark on each tile — was measured and
  rejected, and the numbers are in `build-pages.mjs` above `related` so it is
  not re-proposed. Three reasons, any one of them fatal. It fails the mark rule
  ("false on most pages"): on the box rail the mark is **true on 54.5% of
  1,190 tiles**, and half a wall of badges is still a wall. It is the
  poster-frame decision taken back — `ogCard` exists precisely because sharing
  a rip used to show the hit before anyone opened it, and stamping the outcome
  on the control whose job is to get the rip opened is the same mistake one
  notch quieter. And Trubbish's word is already spent on that page: the
  `.nohits` band a few hundred lines below says it once at 180px, so three
  20px repeats say it again about other people's rips.
- **The rails round-robin by product kind, and the round robin is the fix.**
  `related` was a flat newest-first `slice(0, 6)`, so **333 of 1,306 set-rail
  tiles (25.5%) repeated a video the box rail above had already shown**, and on
  25 pages the lower band was a complete copy of the upper one. Now 14 of 1,306
  (1.1%), 4 pages. Distinct product kinds per set rail 1.66 to 4.64. The box
  rail is deliberately left alone at 100% one image, because there the picture
  is TRUE: six packs out of one box are six identical packs.
- **AND THE ROUND ROBIN WAS STILL THE SAME SIX TITLES ON EVERY PAGE IN A SET,
  which was the site's biggest SEO risk and not the thing anybody proposed
  fixing.** The sort above is a per-page fix to a per-page complaint. It never
  touched the SIDEWAYS problem: `byKind.get(k)[round]` is a fixed window off the
  HEAD of each kind list and the kind lists belong to the SET, so 30 pages of a
  set were handed the same six tiles. 7-word shingles over `<main>`, best match
  against any sibling, all 320 rip pages, off real builds: **277 / 233 / 76 at
  0.50 / 0.60 / 0.70, mean 0.619.** Deleting the box rail makes it *worse*
  (0.623); deleting this band takes it to 242 / 114 / 17, mean 0.548, so this
  band was essentially the whole effect. **It is NOT boilerplate** (only 13.8% of
  a page's shingles appear on half the rip pages) and **more words do not fix
  it**: pages carrying a named-hit band are MORE duplicated (0.643) than pages
  without (0.598) while being 131 words longer.
  **THE FIX IS TO SPIN THE WINDOW, NOT WIDEN IT,** 22 August 2026: each kind list
  is walked from an offset taken from the page's own index in `bySet.get(setId)`,
  wrapping per kind. **185 / 52 / 10, mean 0.507 — a 78% cut at 0.60 and 87% at
  0.70, for one index and no new copy.** Every invariant above is
  bit-for-bit unchanged and that is arithmetic rather than luck: which ROUND a
  kind contributes on is untouched, so rail lengths, distinct kinds per rail
  (4.70), single-kind rails (34), the `.vid-kind` gate and the 20 tiles that
  still repeat the box rail are all identical before and after. The stop
  condition had to move from `if (!x)` to `round >= list.length`, because the
  modulo never returns undefined and would otherwise reprint a short kind.
  **WHAT IT COSTS, since the table does not show it:** the single most recent rip
  of a kind is no longer on every page of its set. It leads the newest page's
  rail and steps back one page at a time, which is the right trade for a band
  headed "More \<set\>" rather than "Latest \<set\>".
- **`/videos.html` has the same look and it is NOT the same defect.** 48 tiles,
  6 artworks, 36 of them two. But it is a chronological library and re-sorting
  it by product would falsify "Newest first". What is actually redundant there
  is the caption: `CHAOS RISING • 611 VIEWS`, where **48 of 48 tiles already
  carry that set name in the h3 above it and on the picture** -- one fact three
  times, while what was opened is only implicit. Swap the set name for the
  product kind in `makeCard`. Leave `.pack-hint` alone; it is identical on all
  48 by design, because it is the affordance and not a differentiator.
