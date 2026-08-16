# /types.html — plan for the builder

Research only. Nothing here has been built. All facts, sources and read-dates
are in `data/types.json`; this file says how to turn them into a page.

Working title: **"Pokemon card types, explained"**. H1 should be a question a
beginner actually types: "What are the Pokemon card types?"

## 1. The one thing this page has to get right

**The Pokemon TCG type system is not the video game type system, and the card
game has no type chart.** Those are two separate errors and the page has to
avoid both.

- The TCG has **11 Energy types**, and the official rulebook says so in as many
  words. Ten are still printed. The video games have 18. Bug is a Grass card,
  Ice is a Water card, Ground and Rock are Fighting cards, Ghost and Fairy are
  Psychic cards, Poison is a Darkness card.
- **Weakness and Resistance are printed on each individual card**, in the
  bottom-left corner, and plenty of cards print neither. The rulebook's own
  phrasing is "Some Pokemon have Weakness or Resistance", and the glossary
  entries for both end with "if any". There is no rule anywhere in the game
  that says Fire beats Grass.

If the page renders a grid of "strong against / weak against" with no numbers
next to it, it has become a type chart no matter what the caption says, and it
is wrong. See section 2 for what to do instead.

## 2. The honest framing for "strong and weak against"

The owner asked for "what each is strong and weak against". That question has
an honest answer, it is just not the answer the video games give. Four moves,
in this order:

**a) State the actual rule first, once, near the top.** Weakness and Resistance
are printed per card. Weakness on current cards reads `x2` and doubles the
damage. Resistance on Sword & Shield era cards and later reads `-30`; before
that it was `-20` for over a decade. Neither applies to Benched Pokemon. All
tier 1, from the rulebook. Put the values in a small "how to read the corner of
your card" block with the example card's own corner beside it.

**b) Per type, give a MEASURED TENDENCY with its n, never a rule.** The wording
that works:

> Of the 210 Grass Pokemon cards across the 10 sets this site tracks, 208 (99%)
> print a Fire Weakness. Two do not.

Not "Grass is weak to Fire". The numbers, the counts and the set list are all
in `data/types.json` under each type's `weakness` / `resistance` and under
`measurement`. Render `n`, `count` and `pct` and never render one without the
others. If a builder is tempted to drop the n to make the layout tidier, the
tendency has to come off the page with it.

**c) Show the example card, with ITS OWN printed values labelled as its own.**
Caption under each card: "This card prints Fire x2 Weakness." That single
sentence is what stops the tendency reading as a law, because the reader can
see where the number comes from.

**d) Explain the splits, because they are the payoff.** Four types split
cleanly and each split is a one-line lesson in why the two systems differ:

| Type | Splits | Why |
|---|---|---|
| Water | Lightning 75% / Metal 25% | the Metal quarter are the Ice Pokemon, and Ice fears Steel in the games |
| Psychic | Darkness 68% / Metal 31% | the Metal third are the former Fairy Pokemon, and Fairy fears Steel |
| Fighting | Grass 69% / Psychic 31% | Ground and Rock print Grass, actual Fighting Pokemon print Psychic |
| Darkness | Grass 47% / Fighting 42% | Dark Pokemon print Grass (Bug is a Grass card), Poison Pokemon print Fighting (Ground is a Fighting card) |
| Colorless | Fighting 70% / Lightning 30% | Normal prints Fighting, Flying prints Lightning and adds Fighting -30 |

Darkness is the one to lead the section with, because its top answer is under
half and a chart literally cannot represent it.

**e) Dragon is the closing argument.** All 36 modern Dragon cards sampled print
no Weakness and no Resistance at all. The corner is empty. One picture of a
Dragonite ends the "but the type chart says" objection better than a paragraph.

**Two cards, one type, different Weakness** is the single best exhibit on the
page: Muk (151 #089, Darkness, Fighting x2) beside Hydreigon ex (Surging
Sparks #119, Darkness, Grass x2). Both bases are verified. Put them side by
side under the Darkness entry. `exampleAlt` in the data file exists for this.

## 3. Imagery: which source, per type

**Answer: real card scans from `assets.tcgdex.net`, the host the set pages and
the rarity page already use. Nothing new is fetched, scraped or hosted.**

Twelve example bases are recorded in `data/types.json`, one per type plus the
Darkness alternate. Eleven of the twelve already have a record in
`public/data/cards/`, so the builder can read name, number, rarity and price
straight out of local data and use the `img` field that is already there. The
twelfth (Xerneas, `xy1-96`, the Fairy example) has no local record because the
site tracks no set older than Rebel Clash, which is after Fairy was retired;
its base is hardcoded in `data/types.json` and comes off the same host.

Checked so the builder does not have to:

- Each card's **printed type, Weakness and Resistance were read off the TCGdex
  card record**, not inferred from the Pokemon's video game type. That
  distinction is the whole page, so an example chosen by inference would
  undercut it. `example.verified` records the endpoint and the read date.
- All 12 bases were fetched at **all four extensions** (`low.webp`, `low.avif`,
  `high.webp`, `high.avif`): **48 of 48 answered 200** on 2026-08-15.
- **None of the 12 appears in `data/no-scan.json`.**

Mechanics, all existing:

- Emit the `<img>` with `srcset` off the base, then wrap with `avifPicture()`
  from `shared/format.mjs`. AVIF is 30-37% smaller for the same pixels and
  TCGdex publishes it at every path.
- Get `width`/`height` from `imgDims(url)`. Do not hand-write them. The
  measured sizes are 245x337 for `low`, 600x825 for `high`, and they differ per
  host, which is why the helper exists.
- `loading="lazy"` on every card below the fold. Read the note in CLAUDE.md
  about rarity.html first: these must be `<img>`, never CSS backgrounds, or all
  12 full-size scans are fetched at first paint. Re-screenshot at 390px after,
  because moving a background to an img on rarity.html brought the scans into
  reach of a later rule and turned magnified corners into whole shrunken cards.

**Type symbols: draw them, do not hotlink them.** `assets.tcgdex.net/univ/
energy/*` 404s, and Pokemon's Energy symbol art is not ours to embed. The site
already has the precedent: `rarityMark()` in `shared/rarity.mjs` draws inline
SVG marks with a `.rk` class and a per-mark fill. Do the same thing for the 11
type marks. The `symbol` field in `data/types.json` describes the shape of each
mark, and it is a description written from the scans, not an official name, so
do not present it as one. If a mark cannot be drawn well, omit it and use the
type's colour swatch plus its name. A wrong symbol is worse than none on a page
whose job is to correct a misconception.

**Do not show a Basic Energy card as the type example.** Tempting, since the
card index already holds Basic Grass through Basic Metal, but Colorless and
Dragon have no Basic Energy card and Fairy's is not in local data, so three of
eleven rows would break pattern. Worse, the reader's question is "what type is
my Pokemon card", and answering it with a picture of an Energy card answers a
different one. Mention the Basic Energy cards in prose instead.

Attribution: footer line in the house style, matching the set pages. Something
like `footer("Card scans and card data from TCGdex. Not affiliated with The
Pokemon Company.")`. The standard "Fan content. Not affiliated with The Pokemon
Company" line comes from `footer()` already.

## 4. Page order

`data/types.json` carries the order and the reason:

**Grass, Fire, Water, Lightning, Psychic, Fighting, Darkness, Metal,
Colorless, Dragon, Fairy.**

The first eight are the exact order The Pokemon Company numbers them in the
Scarlet & Violet Energy set, 001 Grass through 008 Metal, so someone holding a
stack of basic Energy sees the page in the order their own cards already sit
in. Colorless and Dragon follow because neither has a Basic Energy card, and
that is the thing they have in common. Fairy is last because it is retired.

Do not sort by how common the type is, and do not sort alphabetically. Both
lose the reason.

Section order for the page as a whole:

1. H1 + one paragraph: there are 11 types on cards, not the 18 from the games.
2. **"Your card's type is not its video game type"** — the mapping table, all
   18 game types down the left, TCG type on the right. This is the highest
   search-value block on the page and it should be near the top.
3. **"There is no type chart"** — the per-card rule, the corner of the card,
   the x2 and -30 values, the Bench exemption.
4. The 11 type entries, in the order above. Each: mark, name, which game types
   fold in, two-sentence blurb, the measured Weakness/Resistance tendency with
   its n, the example card with its own printed values.
5. **"Types that came and went"** — Fairy and Dragon, with dates.
6. A short measurement note: which 10 sets, how many cards, when, and that
   these are printed values and not pack odds.

Cross-link `/rarity.html`, `/what-set.html` and `/start.html`. All three answer
another part of "I am holding a card, what is it" and this page is the fourth.

## 5. Registration (the build guard will fail without all of this)

Minimum for a new page `/types.html`:

1. **`scripts/build-types.mjs`**, writing the literal string
   `join(ROOT, "public/types.html")` so `check-build.py`'s staleness grep can
   see the output path. Skeleton to copy: `scripts/build-lore.mjs` (single
   output, no browser JS, top-level await, no `main()`). Body order is fixed:
   `SPRITE`, `SKIP`, `BAR`, `MENU`, `<main id="main">`, `footer()`, `APP_JS`.
   `esc()` every interpolated string.
2. **`scripts/build-all.mjs`** — one line `"node scripts/build-types.mjs",` in
   `STEPS`. It must sit after `"node scripts/build-css.mjs"` (chrome.mjs hashes
   the built stylesheet at import time) and before `"node
   scripts/build-search.mjs"`. Drop it with the other standalone page builders.
   `check-build.py` fails the whole build if a `scripts/build-*` file is not
   named in `build-all.mjs`, so this is not optional.
3. **`scripts/build-search.mjs`** — one entry in `PAGES`, shape
   `["/types.html", "Title", "one line of sub"]`. **Hard-enforced**: the script
   exits 1 on any indexable page in `public/` missing from that list.
4. **`scripts/build-pages.mjs`** — one entry in the `urls` array,
   `{ loc: `${SITE}/types.html`, freq: "monthly", pri: "0.9" }`. `monthly`
   because the content is stable; the measurement date is the only thing that
   moves.
5. **`scripts/build-og-pages.py`** — one entry in `PAGES`, keyed `"types"`,
   value a 3-tuple `(kicker, headline, one-line answer)`. Only needed if the
   head points at `assets/og-types.jpg`, which it should. check-build verifies
   the jpg exists for every `og-*.jpg` referenced.
6. **`shared/chrome.mjs`** — one entry `["/types.html", "Card types"],` inside
   the **Guides** group, next to `/what-set.html` and `/rarity.html`. Those
   three are the "I am holding a card" cluster. NAV is the only nav list: the
   bar, the mobile menu and the footer are all derived from it, so there is
   nothing else to edit. Label is a front-loaded noun per the note in that
   file. "Card types" beats "Energy types" for a beginner, and beats "Types"
   which is too thin to scan.

Also, since check-build enforces them: the JSON-LD block must parse and must
not be `null`; every internal `href`/`src` must resolve to a real file under
`public/`; and the page must not carry `noindex` while being in the sitemap.

## 6. Where the data ends and the page begins

`data/types.json` is source data in the same spirit as `data/rarity.json`: a
human-maintained file of verified examples, with a `_readme` that says what not
to do to it. The builder should read it and render it, not restate it.

Things in that file the builder must carry through rather than drop:

- `measurement.sets` and `measurement.run` — the page has to say which 10 sets
  and when, or the percentages are unfalsifiable.
- `measurement.sets_note` — the sample is 2020 to 2025, so the numbers describe
  the modern game and not the whole history. Say so.
- Every `weaknessNote` / `resistanceNote`. Those are the explanations of the
  splits and they are the actual content.
- `openQuestions` — six things that are not established. In particular:
  **Fairy's Weakness and Resistance tendencies are NOT measured**, because none
  of the ten sampled sets is old enough to contain a Fairy card. Either measure
  a few XY-era sets before publishing a number there, or publish no number and
  let the one example card speak only for itself. Do not fill the gap by
  pattern-matching the other ten rows.
- `doNotSay` — five sentences the page must never contain. The first is any
  form of "Fire beats Grass"; the second is any pull rate or odds.

## 7. Facts that rest on a single source

Flagged in the data file too, repeated here so a builder sees them:

- The **two Dragon absences and their dates** rest on Bulbapedia alone. The
  current state (no Weakness, no Resistance printed) is measured over 36 cards,
  but the Evolving Skies and Paldea Evolved dates are single-sourced.
- The **Sword & Shield type-change announcement** was only reachable as a
  mirror; the original pokemon.com article answers a bot-detection page. Every
  claim it carries is separately confirmed by the rulebook or by measurement,
  so nothing needs to rest on it, but do not cite it as if it were the primary.
- The **Kalos Starter Set release date** is known only to the year, 2013. Do
  not print a month.
- **Fairy's current tournament legality** was not checked against the live Play
  Pokemon rotation. Say nothing about it either way.
