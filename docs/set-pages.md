# Set pages, prices, pull rates, and which printing a hit is

Covers the set guides and their price sources, the pull-rate sourcing rule, how a logged hit resolves to a printing, card-shots pins, rawNm, and the pending path for a set TCGdex has not published.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## Set pages
`/sets/<id>.html` is a "Set 101" guide per card set, plus a `/sets/` index.
Two scripts, run in order:

    node scripts/sync-sets.mjs        pulls card data -> public/data/sets.json
    node scripts/build-set-pages.mjs  writes public/sets/

Data is the free Pokemon TCG API (api.pokemontcg.io). It rate-limits hard and
answers 500/502 rather than 429, which reads as missing data until you retry;
sync-sets.mjs backs off and caches raw responses under .cache/ (gitignored).
A cold run takes several minutes, re-runs are instant.

Two constraints that shape these pages:
- **THIS ENTRY USED TO SAY the four newest sets (Pitch Black, Chaos Rising,
  Perfect Order, Ascended Heroes) have card lists but NO market prices, and it
  was quoted back as a reason a page showed none.** That is true of
  api.pokemontcg.io only. `sync-cards.mjs` prices those sets in full from
  TCGdex, so all 295 Ascended Heroes cards have a figure. Anything on a set
  page that claims a price is missing is now reading the wrong file.
  Every price a set guide prints comes from `public/data/cards/<id>.json`:
  the chase grid, the rarity ladder, the value band and the checklist. ONE
  SOURCE PER PAGE, so the top of the page cannot disagree with the bottom of
  it. `sets.json` still supplies the counts, the dates and the rarity ladder's
  shape, and `data/chase-tcg.json` now supplies nothing but TCGplayer links,
  and since 14 October 2026 only for the few rows TCGdex prices: a card's
  "Check current price" goes to the PriceCharting page its printed price came
  from (`pcUrl`), because the link follows the price.
  Do not reintroduce a second price feed to a page that already has one: 22 of
  28 guides once priced their own chase card twice, and on Ascended Heroes the
  second feed named the wrong card entirely.

  **THE MONEY IN THAT FILE IS PRICECHARTING'S NOW, NOT TCGDEX'S, SINCE 18
  August 2026.** The owner: "lets use pricecharting as the main numbers for the
  entire site". `scripts/sync-pricecharting-cards.mjs` reads the crawl
  `sync-graded-top.mjs` already cached under `.cache/pricecharting-console/`
  and writes `data/pricecharting-cards.json`; `sync-cards.mjs` overlays it onto
  the card files in ONE place, which is why ten builders changed source without
  ten chances to miss one. It makes NO network request and must not be given
  one. For fresher numbers run `sync-graded-top.mjs --refresh` and re-run it.

  MEASURED BEFORE IT WAS SWAPPED, because the risk was coverage: TCGdex priced
  5,168 of the 5,181 cards, PriceCharting prices 5,179, and the two that neither
  covers alone are covered by the other, so check-build went 99.7% to 100.0%.
  Nothing lost a price. On the cards a guide features ($20+) the two sources sit
  98.2% within 25% of each other; the wide gaps are all in the sub-dollar tail,
  where a guide value does not fall to a marketplace's floor. Set totals moved
  1.00x overall. Celebrations is the outlier at 4.13x and that is real, not a
  bug: 25 cards, nothing expensive to anchor it, so the bulk floor is the total.

  **THE GRADED COLUMN ONLY FINISHED MOVING ON 21 AUGUST 2026, THREE DAYS AFTER
  THE RAW ONE, AND THE GAP WAS VISIBLE ON 54 PAGES.** The instruction quoted
  above said "the entire site". `build-hall.mjs` was put on `data/graded.json`
  that day and NOTHING ELSE WAS, because five builders each held a private copy
  of a `gradedPrice(setId, number)` helper reading `data/psa10.json` and nothing
  else. So **Mega Greninja ex, Chaos Rising #122, the channel's headline pull,
  printed $906 on /hall.html and /grading.html and $838 on 53 rip pages and
  /sets/chaos-rising.html at the same time.** Measured across the built tree
  before the fix: of 139 cards printing a PSA 10, two printed two different
  figures for one printing. It is 0 of 172 now.

  **THE CHAIN IS `shared/graded-price.mjs` AND THERE IS ONE OF IT.** A
  human-checked `psa10.prices` entry first, because it is a deliberate override;
  then PriceCharting; then `psa10.auto`, which is pokemonpricetracker.com and
  keeps its ten-sale floor. THE FALLBACK IS NOT DELETED and must not be: the
  graded crawl is deliberately scoped to the cards we pulled plus each set's top
  chase cards, 83 in all, so `auto` is what stands behind everything it does not
  reach. **Layering is not the same as MOVING**, which is what build-set-pages
  .mjs's own note had rejected on the grounds that it would strand most rows: no
  row that had a figure lost one, 30 changed feed and 17 gained a figure they
  never had. The date, the source name and the sale count come back from the
  SAME call as the number, so a page cannot credit one feed for another's
  figure, and where a page prints both it now names BOTH rather than falling
  back to "a separate graded sales feed".

  **THE PRINTING CHECK INSIDE THAT JOIN IS LOAD BEARING AND IS NOT AN
  OPTIMISATION.** `sync-pricecharting.mjs` only rejects a wrong number when it
  was given one, and it was run over `data/hits.json`, which mostly carries
  none, so four records came back for a DIFFERENT printing of the right card.
  The join re-reads the number out of `matched` and drops a disagreement rather
  than printing a secret rare's price against a bulk rare. `data/graded.json`'s
  own readme says never to backfill an empty `number` from `matched`, for the
  same reason.

  TWO DATES LIVE IN THAT FILE AND THEY ARE NOT INTERCHANGEABLE. `checked` is
  when TCGdex was read for the CHECKLIST and moves nightly; `pricesChecked` is
  when PriceCharting was read for the MONEY. Stamping the first under a column
  of dollars claims a freshness the figures do not have, which is what every
  price note did until `shared/card-prices.mjs` took the wording over. Use
  `priceNote(doc)` rather than writing the sentence again.

  **THE RANKED RAW LIST MOVED THE SAME WAY, ALSO 18 August 2026.**
  /most-valuable-cards.html is built from `data/top-raw.json`, written by
  `scripts/sync-raw-top.mjs` off the SAME cached crawl with no network and
  stamped by `scripts/verify-raw-top.mjs`, which re-reads all three price
  columns from each card's own product page. It is gated by
  `shared/graded-gate.mjs`, the same gate /top-graded.html and /base-set.html
  are held to, so a figure read once cannot be published. The two listing and
  product parsers now live in `shared/pricecharting.mjs` rather than in five
  copies; they are still two different readers of two different templates,
  which is the whole point of the second read.

  THAT PAGE IS NO LONGER ENGLISH ONLY AND THAT WAS AN EDITORIAL DECISION, NOT
  A SIDE EFFECT. TCGplayer files Japanese as a separate catalogue and
  PriceCharting does not, so the swap changes what the list IS: 50 of the
  hundred are Japanese, 2 Chinese, 13 are Topps rather than TCG cards, and the
  number one is the Illustrator Pikachu. The full argument, both ways, is in
  the header of `scripts/build-top100.mjs` and the page says all of it out
  loud. /most-expensive-sealed.html stays on TCGplayer because the crawl
  excludes sealed product; The owner authorised that split in as many words.

  THREE THINGS STAY WHERE THEY WERE AND NONE IS AN OVERSIGHT. `low` is a lowest
  live listing, which PriceCharting does not publish at all. Pokemon Center
  stays the source for ALL MSRP, because every multiple on the site divides an
  asked price by the SUGGESTED price. And the standard-printing allowlist in
  `sync-pricecharting-cards.mjs` is load bearing: PriceCharting files
  `[Stamped]`, `[Poke Ball]`, `[Cosmos Holo]` and a dozen more against the same
  collector number, and taking the dearest of all of them priced a bulk
  Bulbasaur at $40.30 off a prerelease promo.
- "Still in print" and pack prices are not in the API and are not guessed.
  They live in `data/set-notes.json` for a human, along with any fun facts,
  and are omitted when blank. Everything else is API fact or checklist
  arithmetic.

## Pull rates: a SOURCING rule since 11 September 2026, not a ban

**THIS SAID "Never state pull rates: we do not have them" AND THE OWNER LIFTED IT**
on 11 September 2026, in these words: "you can post any pull rates or anything
thats confirmed." Read the old rule's own reason before reading the new rule:
it was *we do not have them*, and every other statement of it in this file gave
the same ground, that The Pokemon Company does not publish them. **It was an
AVAILABILITY rule wearing the clothes of a principle**, which is why lifting it
changes less than it looks like it changes.

**SO THE TEST IS NOW "IS IT CONFIRMED", AND THAT WORD IS DOING ALL THE WORK.**
Confirmed means the publisher stated it: TPCi, Pokemon Center, pokemon.com, a
press release, or the printed odds on a pack or box. A news site REPORTING such
a statement carries it the way this file already treats PokeBeach everywhere
else, named in the sentence.

**WHAT IS NOT CONFIRMED, AND THESE ARE THE ONES THAT WILL BE ARGUED FOR:**
- **A box somebody opened.** One 20 pack box is a SAMPLE OF TWENTY, not a rate,
  and printing it as one is the same error as [[rip-log-rarity-beats-number]] at
  a different scale. Label it as one opening or leave it out.
- **A leak, a streamer's early box, or a set tracker's extrapolation.** The 30th
  Celebration leaked months early and is the live example.
- **Another region's figure.** Japan's 30th Celebration pack holds six cards and
  the English one holds five, so a Japanese rate is not an English rate even
  when it is genuine.
- **A rate for a DIFFERENT product than the one on the page.** A booster box
  rate is not an Elite Trainer Box rate.

**A GUARANTEE IS BETTER THAN A RATE AND IS USUALLY ALREADY CONFIRMED.** "One of
30 Pikachu in every pack" and "five foil cards, one foil Energy, one code card"
are TPCi's own words about 30th Celebration, they are certainties rather than
probabilities, and they are what a collector actually plans around. Prefer them,
and say which they are.

**/luck.html DOES NOT CHANGE.** Its numbers are the channel's OWN openings and
are labeled observed results, which is a different claim from an odds statement
and is still the honest framing for it. Do not relabel them as pull rates.

**THE FORBIDDEN LINK ON /how-to-play.html, /tcg-live.html AND /tcg-pocket.html
IS STILL FORBIDDEN AND NEEDS THE OWNER'S SEPARATE CALL.** See that rule above.
Its stated reason was "the site never states pull rates, and linking a page of
them through a guide of ours is the same claim made at one remove", and the first
half of that sentence is no longer true, so the rule is now resting on nothing.
It is left standing anyway, because it is about the DIGITAL games' offering
rates on three specific pages and the owner's instruction was about this set's
cards. This file's own rule is that an exception is argued here before it is
made, so it is written down here as open rather than taken as settled.

## Which PRINTING a logged hit is, and why the rarity decides it

**THE RARITY COLUMN IS THE OWNER'S DATA. THE NUMBER COLUMN IS USUALLY DERIVED.** He
reads the symbol off the card and writes both: the Video Log's Hit Info cells say
"Mega Dragonite ex - Double Black Star - Double Rare". A double black star IS
Double Rare. The My Hits Number column is blank on most rows.

`import-sheet.mjs` used to fill that blank by taking the **dearest** printing of
the name in the set, and never read the rarity beside it. Where a set prints one
name twice that silently upgraded the card. Ascended Heroes prints Mega Charizard
Y ex at 022 (Double rare, $5.46) and 294 (Mega Hyper Rare, $363.43); the row says
"Double Rare" and the site published 294.

**It moved 86 rows and it is why /hall.html read as though the wanted list had
been pasted into it.** The owner, 23 August 2026: "you added in all sorts of cards that
are not logged as hits in my video ... that is wrong." Nothing had been added.
Every plaque was a real logged card at the wrong PRINTING, which looks identical.

`pickPrinting()` in `scripts/import-sheet.mjs` now resolves in this order, and
the three renderers (`build-pages.mjs`, `build-hall.mjs`, `build-luck.mjs`) all
key off the rarity to match:

  1. an explicitly typed collector NUMBER
  2. the typed RARITY, **only where it names exactly one printing** -- two
     printings sharing a tier falls through rather than flipping a coin
  3. the dearest printing, the old rule, now the last resort

**THREE CONFIRMATIONS, NONE OF THEM INFERRED FROM THE CODE.** Do not re-litigate
this without at least this much evidence:

- The Video Log's own Hit Info cells name the symbol as well as the tier. All
  **157** rows where that cell names a tier agree with the rarity-first pick.
  **0 disagree.**
- The owner sent the TCGplayer link for Mega Charizard Y ex **022/217** himself,
  against the 294 the old rule chose.
- `data/graded.json`'s readme, written 14 August, records "Dawn #129 where ours
  is #118" and "Mega Gardevoir ex #178 where ours is #159". Our numbers then are
  the numbers the rarity gives back now.

**THE FASTEST SANITY CHECK IS THE RARITY MIX.** 462 packs should give roughly 70
Double rares, 35 Ultra Rares, 40 Illustration rares and about 5 SIRs. The old
data claimed **51 SIRs**, near 1 in 9 against a real rate near 1 in 100. If a
change to any resolver moves that distribution, it is wrong. It also now
separates one card pulled at different tiers in different rips -- Dawn #118 twice
and #129 once -- which was impossible while the dearest always won.

### Scans TCGdex does not have: `data/card-shots.json`

Nine real printings are in **no** TCGdex url at any extension: the Galarian and
Trainer Gallery subsets, promos listed with nothing attached, and the six intl
guides with `hasImages: false`. They are pinned to a TCGplayer product id, keyed
`"<corpus set name>|<collector number>"`, and read by `pinnedShot()` in
`shared/card-scan.mjs`.

- **An entry is only added after the TCGdex url was checked and 404'd**, and the
  entry records that reason. A pin must never shadow a scan we already have.
- **The two renditions are NOT siblings by string surgery.** `_200w.jpg` and
  `_in_1000x1000.jpg` off one id. So `hitcardImg`'s srcset guard must keep its
  `assets.tcgdex.net` test, and the lightbox's `low.webp -> high.webp` swap is a
  silent **no-op** on that host -- the large url is passed through `imgLarge`
  instead, or the card enlarges to a 200px thumbnail with nothing to say so.
- No width or height: that host pads to a fixed canvas, and `imgDims()` returns
  nothing for it on purpose.

### `rawNm` is the price of last resort and it is load bearing

The My Hits **Raw NM USD** column was read by nothing. For most rows that is
harmless, because the checklist has the price. For the sets with **no checklist**
-- Silver Tempest, Lost Origin, every Black Star Promo set, all thirteen intl
guides -- it is the only figure that will ever exist, and 23 cards had a scan, a
number and no money. All three renderers now fall back to it, **last**, behind
every live source, because it is frozen and they are not.

**A subset name is routing, not part of a card's name.** "Crown Zenith - Paras -
Galarian Gallery - Rare" parsed as a card called "Paras Galarian Gallery", and
because the Video Log parser can only ADD a row, that fossil sat on /hall.html
beside the real Paras -- unnumbered, unpriced, and winning the dedupe by sorting
first.

**PriceCharting files every English promo in one console, "Pokemon Promo",** and
we file them by the set printed on the card. Neither string contains the other,
so no promo could join `data/graded.json` and five of them printed "No PSA 10
price" over figures already on file. `setsAgree()` in `shared/graded-price.mjs`
allows that one pairing; the collector-number check already there is what keeps
it safe.

## Added 11 November 2026 (written in the restructure, from the code at HEAD)

### "Mega Attack Rare" is folded to Ultra Rare where it enters

TCGdex began answering "Mega Attack Rare" for Ascended Heroes cards it had called "Ultra Rare" since the set
shipped. The site has no rung for that name on purpose (see "MEGA ATTACK RARE, ON ROW 205" in docs/video.md),
so build-set-pages.mjs threw on the orphan tier and the nightly of 11 November rebuilt nothing. The fix is
`RARITY_ALIAS = { "Mega Attack Rare": "Ultra Rare" }` in scripts/sync-cards.mjs, the one place the word enters,
matching `RARITY_SYNONYM` in scripts/import-sheet.mjs. One upstream word must not freeze the site. Giving the
name a rung of its own is a feature and the owner's call.

### A set TCGdex has not published yet (the pending path, Delta Reign)

Added 7 November 2026 for Delta Reign, the day after it released: TCGdex had no ME06 at all while TCGplayer
listed all 141 cards with number, rarity and market price. Three pieces, to be retired together:

- `tcgplayerPending` in data/tcgdex-en.json maps our slug to TCGplayer's exact setName
  (`"delta-reign": "ME06: Delta Reign"`). scripts/sync-cards.mjs reads the checklist and prices for those sets
  from TCGplayer in the nightly. It writes NO card picture: `img` stays null, because every builder appends
  `/low.webp` to it and that is a TCGdex url shape.
- `PENDING_META` in scripts/sync-sets.mjs holds the set record (name, series, release date, totals) for a set
  the Pokemon TCG API does not list. The rarity ladder is counted from the checklist, never from that block.
  Delete the entry the day the API lists the set.
- shared/card-scan.mjs derives a whole set of scan pins for a pending set from each card's own `tcgplayerId`,
  under both the set's name and its slug. Hand pins in data/card-shots.json win.

RETIRE IT WHEN TCGDEX CATCHES UP (the instruction in sync-cards.mjs): move the slug into `sets` with its TCGdex
id, delete it from `tcgplayerPending`, and drop its pins from card-shots.json, in one edit. The checklist must
then match on count, which the guard in that script checks. The derived pins disappear with the pending entry.

### Species links from set guides and rip pages

See docs/search-and-species.md: card names on set guides and rip pages link to /pokemon/ pages through
`shared/species-link.mjs`.
