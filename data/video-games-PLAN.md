# /video-games.html — plan for the builder

Research only. Nothing has been built, no builder is registered, no image has
been fetched into the tree and no stylesheet has been touched. Every fact,
source and read-date is in `data/video-games.json`; this file says how to turn
them into a page.

Working title: **"Every Pokemon video game"**. H1: "Every Pokemon video game,
in order". The page is a vertical timeline of 79 titles from February 1996 to
April 2026, each with its cover, its release date, its platform, its Metascore
where one exists, and its generation and Pokedex numbers where they apply.

**THE URL IS `/video-games.html` AND IT CANNOT BE `/games/`.** `/games/` is
already the minigame hub (Who's That Pokemon, Guess the Set, the trivia and
Garbage Run) and it is in the nav, the sitemap and `PAGES`. Two different
things called "games" on one site is a navigation problem, so the nav label
here has to be "Video games" and the minigame hub keeps "Games".

---

## 1. Imagery: settled, with the engineering that makes it survive

the owner's call, given twice: use the official cover artwork. This is a fan site,
nothing is sold on it, the use is informational, and the footer already carries
"Fan content. Not affiliated with The Pokemon Company". So the question stopped
being whether and became **which host, at what size, and what happens when one
is missing.** Those three have measured answers.

### 1.1 The source is Bulbagarden Archives, and Bulbapedia names the file

Bulbapedia's `{{Infobox game}}` carries a `boxart=` field holding the exact
filename on Bulbagarden Archives, so the game record and its image come from
the same fetch and cannot drift. `boxart2=` holds the paired version's cover.

    https://bulbapedia.bulbagarden.net/w/api.php    the infobox
    https://archives.bulbagarden.net/w/api.php      the file, prop=imageinfo

Both are keyless MediaWiki APIs. No account, no token, no OAuth, nothing to put
in `.env`. That matters more than it sounds: **IGDB was the obvious candidate
and was rejected for it.** IGDB has beautiful uniform portrait covers at
`images.igdb.com`, but reaching them needs a Twitch client id and secret, which
is a credential this repo would have to hold and a service that can revoke it.
Bulbapedia needs neither.

`prop=imageinfo&iiurlwidth=320` returns a server-side thumbnail URL alongside
the intrinsic dimensions, so the sync never has to download a 4000x3000 PNG to
produce a 320px one.

**Checked: 104 files, 0 missing.** Every title in scope resolves to a real file
on the first attempt.

### 1.2 Mirror, do not hotlink, and follow sync-symbols.mjs exactly

Write `scripts/sync-game-covers.mjs` in the shape of `scripts/sync-symbols.mjs`,
which already solved this problem for set symbols. Same five properties:

- **Idempotent.** A cover whose local file exists is not refetched and not
  re-encoded. `--force` refetches everything.
- **Cached.** Raw downloads under `.cache/bulbagarden/covers/` (gitignored), so
  deleting the output and rebuilding costs no network.
- **A manifest with real dimensions**, `data/cover-dims.json`, the way
  `data/symbol-dims.json` and `data/logo-dims.json` already do. See 1.4 for why
  this one is not optional.
- **Fallback is the remote url.** A title with no local file keeps the
  `archives.bulbagarden.net` url, decided at build time from the manifest, not
  with `onerror`. `onerror` never fires for a lazy image below the fold, which
  is the whole reason `sync-symbols.mjs` and `sync-expansions.mjs` both decide
  this at sync time.
- **Never fails the build on a network error.** Affected titles fall back.

Resize and encode in Python with Pillow, the way `build-packs.py`,
`build-logos.py`, `build-og.py` and `sync-symbols.mjs` already do. Node has no
resampler and this repo has no npm dependencies. **Pillow 11.3 on this machine
has both WebP and AVIF encoders built in**, checked, so AVIF costs no new
dependency.

Two hosts have broken things here before, which is why this paragraph exists:
a set-symbol host served 500x500 PNGs into 20px boxes, and a chase sync depended
on a redirect from a host that started answering 502. Mirroring is the fix both
times.

### 1.3 Sizing, and the measured weight

**Decide the rendered size first.** The cover sits in a fixed **120px box on a
phone, 160px on desktop**, and is mirrored inside a **320px bounding box**.
That is 2x the desktop box, which is the house standard: `sync-symbols.mjs`
chose 48 for a 24px box and explicitly did not chase DPR 3.

Measured, all 104 files, encoded from MediaWiki's own 320px thumbnails:

| what | files | AVIF | WebP |
|---|---|---|---|
| MediaWiki's 320px thumbs as served (mostly PNG) | 104 | n/a | 15,918.8 KB |
| 320px box, primary cover per title only | 79 | **1,331.0 KB** | 1,729.2 KB |
| 320px box, both covers of every pair | 104 | 1,733.7 KB | 2,255.6 KB |
| 208px box, primary cover only | 79 | 786.6 KB | 966.5 KB |
| 208px box, both covers | 104 | 1,027.7 KB | 1,264.6 KB |

So the honest number, and it should be quoted rather than softened: **a full
scroll of this page transfers about 1,331 KB of cover art**, plus roughly 45 KB
of gzipped HTML and the 17.4 KB gzipped `ui.css` every page already pays. Call
it **1.4 MB for the whole page, fully scrolled, at 390x844 with the cache
disabled.** That is heavier than any current page on this site.

The number that decides whether it feels heavy is different. **At first paint
about three rows are on screen, so the on-load cost is roughly 50 to 82 KB of
artwork.** Measured: the first four covers total 82.2 KB at AVIF 320. The rest
arrives as the reader scrolls, which is what a timeline is for.

Three levers if 1.4 MB is judged too much, in the order they should be pulled:

1. **Only the primary cover ships in the row.** The paired version's cover
   (Blue beside Red, Violet beside Scarlet) loads when the row is expanded.
   Already assumed above; it is the difference between 1,331 KB and 1,734 KB.
2. **Drop to a 208px box**, 786.6 KB, at the cost of sharpness on a DPR 3
   phone. Do not do this quietly, and re-screenshot at 390px before accepting.
3. **Split the page**, core series at `/video-games.html` (24 titles, 414.0 KB
   of art) and spin-offs behind a second page. This is the one to avoid: the
   whole request was to scroll and see it all.

`loading="lazy"` is correct here and does work, because this is a VERTICAL
list. The homepage carousel note in CLAUDE.md about `loading="lazy"` being a
vertical heuristic is exactly why: it fails for horizontal tracks. It is not a
reason to distrust it in a vertical timeline. Do not build this as a horizontal
scroll track; see section 5.

`avifPicture()` in `shared/format.mjs` will NOT help here. It only rewrites
`assets.tcgdex.net` urls and returns the img untouched for anything else. The
builder writes its own `<picture>` with the local `.avif` source and the local
`.webp` underneath.

### 1.4 The covers are not one shape, and that is the most important finding

Measured across all 104 files: **aspect ratios run from 0.617 to 2.081, median
1.095.** They fall into real families, and the families are eras:

| shape | ratio | what |
|---|---|---|
| Game Boy / GBA | ~1.00 square | Red, Blue, Gold, Silver, Emerald, FireRed |
| N64 US | ~1.43 landscape | Snap, Stadium, Stadium 2, Hey You Pikachu |
| GameCube / Wii | ~0.70 to 0.72 portrait | Colosseum, XD, PokePark |
| DS / 3DS | ~1.09 to 1.13 landscape | Diamond, Black, X and Y, Sun and Moon |
| Switch keycase | ~0.617 portrait | Sword, Scarlet, Legends Arceus, Z-A |
| mobile logo | 1.5 to 2.08 wide | GO, UNITE, Sleep, TCG Pocket |

**Any layout with a fixed aspect ratio will crop or stretch somebody's artwork.**
The tile is therefore a fixed SQUARE box with `object-fit: contain`, no trim, no
pad, no upscale, which is the identical decision `sync-symbols.mjs` argued for
symbols. A Switch cover renders 74x120 inside it, a DS cover 120x107, an N64
cover 120x84.

That is not a compromise, it is a feature worth naming in the page copy in one
line: **the shape of the box changes as the hardware does**, and scrolling the
timeline shows it happening. Square Game Boy carts, wide N64 boxes, wide DS
cases, tall Switch keycases. Nothing else on the page teaches that.

Because the shapes vary, the manifest has to carry real per-file dimensions and
the builder has to emit real `width`/`height`. Declaring 320x320 on all of them
would lie about the aspect ratio on 80 of 104 files, which is the same class of
bug as the blanket rewrite that made 173 card images wrong.

### 1.5 Twenty-one of the images are a logo, not a box

A phone game has no box. Bulbapedia's infobox says so by naming a logo file
instead, and `data/video-games.json` labels every image `"kind": "box art"` or
`"kind": "logo"`. 83 are box art, 21 are logos: GO, UNITE, Sleep, Masters EX,
TCG Live, TCG Online, TCG Pocket, Duel, Shuffle, Cafe ReMix, Magikarp Jump,
Quest, Rumble, Battle Trozei, Picross, Friends and a few more.

Render the logo, and label it. A small `LOGO` chip on those rows is one word
and it stops the page implying a retail box that never existed.

### 1.6 The no-art box

**Every one of the 79 titles has at least one image today.** So the hatched
`set-noart` box is a fallback for a fetch that failed or a file that was
deleted upstream, not for a title with nothing. Reuse the existing pattern:

```css
.set-noart{background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
```

Sized to the 120px box, with the title's name under it. It reads as deliberate
rather than as a broken load, which is the whole point. Never leave a hole and
never substitute a different game's art.

### 1.7 The credit line, one line

Set guides already carry "Product photos are TCGplayer's" in the footer `extra`
slot. Same habit, same slot:

> Cover artwork belongs to Nintendo, Game Freak, Creatures and The Pokemon
> Company. Images mirrored from Bulbagarden Archives, read 16 August 2026.
> Metascores are Metacritic's. Generation and Pokedex counts are from PokeAPI.

That is the whole attribution and it costs four lines of footer.

---

## 2. Scope: 79 titles, and here is what got cut

"Every official Pokemon video game" is between 30 and 260 depending on where
you draw the line. Bulbapedia's `Category:Games` holds 259 mainspace pages and
most of them are not what anybody means by the question.

The line drawn here is **79 titles: 24 core series, 55 major spin-offs and side
series.** Bulbapedia's own `gen_series` field classifies each article as "core
series", "side series", "spin off" or "miscellaneous", so the tier is read from
the source rather than invented.

### In

- **All 24 core-series releases**, 1996 to 2025, including the two Japan-only
  Generation I releases (Red and Green, and the Japanese Blue). They are where
  the whole thing starts and leaving them out to keep the list tidy would make
  the first row of the timeline wrong.
- **Console and handheld spin-offs with a retail box**: Snap, Stadium 1 and 2,
  Colosseum, XD, the Mystery Dungeon line, the Ranger line, Pinball, Puzzle
  League, Puzzle Challenge, Trozei, Conquest, Rumble, PokePark, Pokken, Art
  Academy, Picross, Detective Pikachu and Returns, New Pokemon Snap, Friends,
  Champions, Pokopia.
- **The five Pokemon TCG video games**: Trading Card Game (GBC), Trading Card
  Game 2, TCG Online, TCG Live, TCG Pocket. These matter more on this site than
  anywhere else, and two of them already have their own pages here.
- **Live-service mobile titles with a real audience**: GO, UNITE, Masters EX,
  Sleep, Cafe ReMix, Duel, Shuffle, Quest, Magikarp Jump.

### Out, and why

- **Arcade and card-dispenser machines** (Tretta, Ga-Ole, Mezastar, Battrio,
  Frienda). Japan-only cabinets. No western cover, no Metascore, and Bulbapedia's
  own release-date list excludes arcade medal games too, so this follows a line
  the source already drew.
- **Pokemon mini titles** (Party mini, Race mini, Breeder mini, Pichu Bros.
  mini, Zany Cards, Pinball mini). Nine short games for one Japan-only handheld.
- **Japanese educational software** (the Advanced Generation drill series, Learn
  with Pokemon: Typing Adventure, the hiragana titles). Fifteen or so rows that
  would each read "no cover, no score, no dex".
- **Utility apps, not games**: Pokemon Bank, HOME, TV, Photo Booth, Jukebox,
  Pass, Pokedex 3D, TCG Card Dex, Play! Pokemon Access.
- **Browser and Flash games** (Pokemon.com online games, Kids' WB!, Cartoon
  Network, Daisuki Club). Mostly gone and mostly unarchivable.
- **Demos, betas and unreleased builds** (the Spaceworld '97 demo, the X and Y
  demo, the Ruby and Sapphire demo, everything under `Beta Pokemon games`).
- **DLC as its own row**: Isle of Armor, Crown Tundra, Teal Mask, Indigo Disk,
  Hidden Treasure of Area Zero, Mega Dimension. Their dex counts belong on the
  parent game's row, which is where `data/video-games.json` puts them.
- **Super Smash Bros.** Pokemon appear in it. It is not a Pokemon game, and
  Bulbapedia files it under the franchise only because Pikachu is playable.
- **Bootlegs, ROM hacks and fan games.**

Each exclusion removes rows that would be blank in three of the five columns
this page exists to show. If the owner wants any of them back, the fetchers in the
scratchpad take a title and produce a full record, so adding one is a one-line
change to the scope list rather than a research job.

**Say the boundary on the page.** One line under the H1: "Core series and the
spin-offs that got a retail release or a real audience. Arcade cabinets,
Japan-only educational titles and browser games are not here." A reader who
notices Pokemon Tretta is missing should find out why in the place they
noticed.

---

## 3. The fields, what was sourced, and what was not

`data/video-games.json` carries `sources` with a `read` date on each, and every
per-game field traces back to one of four:

### Sourced

| field | source | coverage |
|---|---|---|
| Title, platform, developer, publisher, category | Bulbapedia `{{Infobox game}}` | 79 of 79 |
| Release date, per region (JP, NA, EU, AU, KR) | Bulbapedia `release_date_*` | 79 of 79, at least one region each |
| Cover filename and image | Bulbapedia `boxart`/`boxart2` → Bulbagarden Archives | 104 files, 0 missing |
| Generation and series tier | Bulbapedia `gen_series` | 79 of 79 |
| Generation, region, species introduced | PokeAPI `/generation/<n>` | all 9 |
| Regional Pokedex entry counts | PokeAPI `/version-group` + `/pokedex` | 26 of 79 (the ones with a version group) |
| Metascore and critic review count | Metacritic JSON-LD | 63 of 79 |

**Which release date to print.** The JSON keeps all five regions verbatim,
including re-release dates the infobox records in the same field. **Print the
Japanese date as the primary and label it "JP".** Three reasons: it is the date
the game actually existed, it is present for more titles than any other region,
and using NA would put Pokemon Red at 1998 and open a timeline of a Japanese
series with a two and a half year hole at the front. Show NA and EU in the
expanded row. Say "JP" on the face of every date so nobody has to guess.

### Metacritic, in detail, because this is the field that goes wrong

Read from the `aggregateRating` block in the JSON-LD every `/game/<slug>/` page
already carries. `robots.txt` for `User-agent: *` disallows only `/search`,
`/signup`, `/login`, `/user`, `/jl/`, `/8264/` and `/7336/`; game pages are not
disallowed. Read 16 August 2026.

**Scores are per version, not per game, and they must never be averaged or
copied across a pair.** Pokemon X is 87 and Pokemon Y is 88. Pokemon Scarlet is
72 and Pokemon Violet is 71. Pokemon Ruby is 82 and **Pokemon Sapphire has no
score at all** despite shipping the same day.

**16 of 79 have no Metascore, for two different reasons the page must not
merge:**

- **No Metacritic entry at all** (HTTP 404): Red and Blue, Yellow, Gold and
  Silver, Crystal, Pinball, the GBC Trading Card Game, Puzzle Challenge, ~~TCG
  Pocket~~. Every Game Boy core game predates Metacritic's games coverage.
- **A page exists but no aggregate score is published**, meaning too few
  critics: Sapphire, Stadium, TCG Live, Sleep.

Render the first as **"Not on Metacritic"** and the second as **"No Metascore
yet"**. A dash, a blank cell or a 0 all read as a bad score, and for the six
best-loved games in the series that would be the single worst thing this page
could say. Do not sort by score with the missing ones at the bottom either.

**CORRECTED 2026-08-16, AND THE CORRECTION GOES BOTH WAYS.** This section and
`data/video-games.json` disagreed about eight titles and each was right about
some of them, which is why both are annotated rather than one being deferred
to. All 22 records the JSON marked "no Metascore on page" were re-requested at
`https://www.metacritic.com/game/<slug>/`, status code and presence of an
`aggregateRating` block recorded.

- **This file was right about nine version records and the JSON was wrong.**
  Red, Blue, Yellow, Gold, Silver, Crystal, Pinball, the Game Boy Trading Card
  Game and Puzzle Challenge all 404 at every address tried, so they are "Not on
  Metacritic". The JSON had them as "No Metascore yet", which is the sentence
  that implies critics reviewed the game and too few of them did. Fixed in the
  JSON, with the probed addresses stored.
- **Neither file was right about TCG Pocket. It has a Metascore of 75**, from 9
  critic reviews, at `metacritic.com/game/pokemon-tcg-pocket/`. The slug is the
  ABBREVIATION; `pokemon-trading-card-game-pocket`, which is what the title
  derives, 404s, and that 404 is what this file recorded as proof of absence.
  Strike it from the list above.
- The four in the second list are confirmed: 200 with no `aggregateRating`.

A 404 at a derived slug is evidence, not proof, and TCG Pocket is what that
distinction costs. The games sitemap does not close the gap either: all 290
files of `metacritic.com/games.xml` were fetched the same day and it omits
`pokemon-y`, `pokemon-stadium` and `pokemon-tcg-pocket`, all of which return
200. Only a direct request settles a title either way.

The counts in this section are the ORIGINAL 79-title scope and are left as
written, because the file shipped at 160 titles on the same day; the live
counts are computed from the JSON by build-video-games.mjs and are 68 scored,
81 with no entry and 11 with a page and no score.

### Pokemon counts, and the three numbers that are not the same

`data/video-games.json` stores the **regional Pokedex entry count** from
PokeAPI, labelled as such, and stores nothing else. Print it as "Paldea
Pokedex: 400 entries", never as "400 Pokemon".

- **Regional dex** is the count of slots in that game's own dex. Kanto 151,
  Johto 251, Hoenn 202, Sinnoh 151, Galar 400, Paldea 400.
- **National dex** is 1,025 species, from PokeAPI `/pokedex/national`, and it
  is the same for everyone.
- **Obtainable in the game** is a third number, larger than the regional dex and
  smaller than the national one, and **PokeAPI does not publish it, so this page
  does not state it.**

Two shapes break a single number and both are in the data:

- **X and Y has three regional dexes at once**: Central 150, Coastal 153,
  Mountain 151. There is no single "Kalos dex" figure to print. Show all three.
- **Sword and Shield has Galar 400 plus Isle of Armor 211 and Crown Tundra
  210**, and Scarlet and Violet has Paldea 400 plus Kitakami 200 and Blueberry
  243. The DLC dexes belong on the parent row, marked as DLC.

**Species introduced per generation** comes straight from PokeAPI and is the
better "what's new" number: 151, 100, 135, 107, 156, 72, 88, 96, 120. They sum
to exactly 1,025, which is the National Pokedex size PokeAPI reports, so the
two facts on the page check each other. Print this on the generation header,
not on the game row, because a generation introduces species once and the four
games in it share them.

### Not sourced, deliberately

- **Sales figures.** Bulbapedia has a list, its citations are inconsistent, and
  nobody asked.
- **User scores.** Metacritic publishes them and they are review-bombed on
  several Pokemon titles. A number that measures a fandom argument does not
  belong beside a critic aggregate without a paragraph explaining it.
- **Wikidata was tried and rejected.** SPARQL over the series item Q24558579
  returned 95 rows for 24 games: Pokemon GO appeared 17 times, once per patch
  date, and its only platform was "iPadOS"; Black and White listed "PlayStation
  Portable" as a platform; no row carried a Metacritic ID; and publication dates
  had no place-of-publication qualifier, so there was no way to tell a JP date
  from an NA one. It is good for exactly one thing, the series ordinal, which
  confirms 23 numbered core entries. Do not build on it.
- **English Wikipedia was tried and rejected for imagery.** `pageimages` with
  `pilicense=any` does return covers, but paired games get a merged two-up
  banner (Red and Blue arrive as one 546x182 strip), several articles return
  nothing at all, and non-free files are held at low resolution by policy
  (316x316 for Legends Arceus). Bulbapedia has one file per version at 790x1280.

---

## 4. Page structure and length

Order top to bottom:

1. **Nav, H1, one-line lede.** "Every Pokemon video game, in order" plus the
   scope sentence from section 2.
2. **The counted summary**, four figures, all computed at build time and never
   typed: 79 games, 30 years, 9 generations, 1,025 species. Same discipline as
   the search index count, which was typed once and immediately became a lie.
3. **A sticky generation rail.** Nine chips, Gen I to Gen IX, each an anchor
   jump. This is the fix for the page being 13,000px tall, and it has to be
   there before anybody scrolls.
4. **The timeline itself**, grouped under nine generation headers.
5. **One honest sentence connecting this to the cards** (section 6).
6. **Footer with the credit line** (section 1.7).

**Generation headers** carry the generation number, the region, the species it
introduced, the year, and nothing else. Nine of them across 79 rows breaks the
scroll into readable runs and gives the anchors somewhere to land.

**Length.** A row is about 148px on a phone, so 79 rows plus nine headers is
roughly 13,000px. For comparison the home page is 6,855px. That is a long page
and it is the correct shape for the thing that was asked for, but it is exactly
why the generation rail is not optional.

---

## 5. 390px first, and the horizontal timeline is wrong

**Build it vertical.** A horizontal timeline at 390px shows one item at a time,
hides the scrollbar, and gives no sense of the whole, which is the one thing a
timeline is for. This site already knows what horizontal costs: the homepage
carousels defeat `loading="lazy"` entirely, because Chrome measures distance
DOWN the page and a slide parked 407px to the right counts as on-screen. That
cost 289.9 KB of pack art at first paint and needed a bespoke hydration script
to fix. Repeating that with 79 covers would be worse.

A vertical list gets lazy loading for free and costs nothing to make work.

### The row at 390px

```
+--------------------------------------------------+
| |  [cover]   Pokemon Scarlet and Violet          |
| |  120x120   18 NOV 2022 · JP                    |
| |  contain   Nintendo Switch                     |
| |            [72] Metascore   [Paldea 400]       |
+--------------------------------------------------+
```

- 16px page gutter each side, 12px card padding: 390 - 32 - 24 = 334px of card.
- Cover box 120px, 12px gap, **202px for the text column.**
- 202px is tight and it is the number that decides the layout. "Pokemon Mystery
  Dungeon: Explorers of Time and Explorers of Darkness" is the worst case and
  wraps to four lines at `--t-sm`. Check that title at 390px before anything
  else; if it is ugly, the cover box drops to 104px rather than the title being
  truncated.
- The date is `--mono` at `--t-micro`, the site's label face, with the region
  code after it.
- Metascore is a chip. Colour it from the palette, not from a green/yellow/red
  scale: the palette is black, white and gold, and a traffic-light scale would
  be the only place on the site using colour to encode a value.
- The gold rail runs down the left at the 16px gutter with a dot per row. That
  is what makes it read as a timeline rather than a list.
- **Tap expands the row** rather than navigating: the paired cover, the other
  regional dates, developer and publisher, the DLC dexes, and a link out to
  Bulbapedia. No second page per game. 79 generated pages for a reference list
  is the kind of thin-page problem `build-pages.mjs` already guards against.

### Desktop

Two columns from 900px, three from 1400px, cover box 160px, rail down the
centre or dropped entirely. This follows the homepage desktop fix: **the answer
to a wide screen is more cards, not a wider card.** Do not centre a single
520px column, which is the exact mistake that made the top of the home page
read as a different site from the bottom.

Everything above is `min-width`, so nothing a phone renders changes.

---

## 6. How it connects to the rest of the site

One sentence, in the lede, and no more:

> The card game and the video games have run alongside each other since 1996,
> and the sets on this site are usually named after whatever game shipped that
> year.

That is true, it is useful, and it is where the internal links go. Then link
naturally from the timeline rows that earn it and nowhere else:

- The five TCG video game rows link to `/tcg-live.html` and
  `/tcg-pocket.html`, which already exist and are already the site's guides to
  two of them.
- The generation headers link to `/lore.html`, which is built from the same
  PokeAPI file and makes the same kind of claim.
- Nothing else. Do not put a "shop the set" or "watch a rip" card on every row.
  This is a reference page and the funnel is the nav.

**No outbound links except the Bulbapedia and Metacritic citations**, which
belong in the expanded row and in the footer credit, both labelled and
aria-labelled as leaving the site, exactly like the playlist cards and the
how-to-play block. This is not a sixth exception to the outbound rule: a
citation for a number the page states is not a "learn more" link.

---

## 7. Registration checklist, all five, none optional

**1. `scripts/build-all.mjs`.** Add this literal line to `STEPS`, and it must
sit BEFORE `build-search.mjs` and before `build-pages.mjs`:

```js
"node scripts/build-video-games.mjs",
```

Put it next to `"node scripts/build-lore.mjs"` with a comment saying it reads
`data/video-games.json` and `data/cover-dims.json`, both written by hand or by
`sync-game-covers.mjs`, so its only ordering constraints are the usual two.
`sync-game-covers.mjs` does NOT go in `build-all.mjs`; it is a sync, like
`sync-pokedex.mjs`, run by hand when a game ships.

**2. Nav, `shared/chrome.mjs`.** Add to the `Play` group in `NAV`, which
currently holds two links:

```js
["/video-games.html", "Video games"],
```

`Play` is right: it is the group for the parts of the site that are not about
buying, opening or valuing a card. The label must be "Video games" and not
"Games", which is taken. `MENU` and `FOOT_NAV` are both generated from `NAV`,
so one line does both and WCAG 2.2 SC 3.2.3 order is preserved automatically.

**3. Sitemap, `scripts/build-pages.mjs`.** Add to the `urls` array near the
`/lore.html` entry:

```js
{ loc: `${SITE}/video-games.html`, freq: "monthly", pri: "0.8" },
```

Monthly, not weekly: nothing on it is recomputed from a price feed. It moves
when a game ships. 0.8 matches `/lore.html` and the games hub.

**4. `PAGES` in `scripts/build-search.mjs`. THIS ONE EXITS 1.** The builder
walks `public/*.html` and fails the build on any indexable page missing from
its own list. Four pages shipped without an entry before this check existed.

```js
["/video-games.html", "Every Pokemon video game", "Covers, release dates, platforms and Metascores, 1996 to now"],
```

Put it near the `/games/` and `/lore.html` entries, not in the first eight:
the first eight are also `/search.html`'s empty state, and adding to them
pushes two cards off the bottom of that grid.

**5. OG card, `scripts/build-og-pages.py`.** Add to the `PAGES` dict:

```python
"video-games": ("30 YEARS OF THEM", "Every Pokemon game", "Covers, dates and scores, Red and Green to now"),
```

Then wire `assets/og-video-games.jpg` as `og:image` and `twitter:image` on the
page. Without it the link previews as the same booster pack picture eight other
pages used to share.

**Then run `python3 scripts/check-build.py`**, which follows the nav link to
the new page from every page and will catch a nav entry pointing at a file that
does not exist.

---

## 8. Traps found during this research, so they are not rediscovered

- **`{{Infobox_game}}` with an underscore.** Pokemon Battle Revolution uses it
  and every other article uses a space. Matching only `{{Infobox game}}`
  silently produced an empty record with no error: no cover, no platform, no
  dates. Match `/\{\{Infobox[ _]game/i`.
- **Infobox values are wikitext, not text.** They contain `<ref>` blocks,
  `<br>`, `<small>`, `[[links]]` and `{{templates}}`. `release_date_na` for
  Pokemon Snap holds four dates across three platforms in one field. The parser
  must strip markup and keep the separators.
- **`release_date_ja=N/A` is real and is not missing data.** The Pokemon Red
  and Blue article is about the ENGLISH release; the Japanese Red and Green is
  a separate article with its own row. Rendering "N/A" as a blank would make
  the JP-primary date rule silently fall through.
- **Pokemon GO's earliest date is a field test**, 29 March 2016, not the public
  release on 22 July 2016. Both are in the field. The timeline should sort and
  print the public release and mention the field test in the expanded row.
- **Bulbagarden's `Category:Game covers` contains Super Smash Bros. covers.**
  Do not enumerate the category to build the game list. The list is curated in
  `data/video-games.json` and the category is only useful for checking a
  filename.
- **`node --check` on an ES module parses it as CommonJS and passes broken
  files.** Already in the site notes. Copy to `.mjs` before checking.

---

## 9. Open questions for the owner

1. **1.4 MB fully scrolled.** Acceptable for a page that is 79 pieces of
   artwork, or pull lever 2 and drop to a 208px box for 786 KB? On-load is
   about 82 KB either way.
2. **Japanese dates as the primary.** It is the honest choice for a Japanese
   series and it puts Red and Green at February 1996 rather than 1998. The owner's
   audience is American. Worth one look at a mock before it is settled.
3. **The five TCG video games.** They are in scope because this is a card
   channel. Two of them already have full pages here. Should those five rows be
   pulled out into their own short band at the top, or left in date order in the
   flow? Date order is the default in this plan.
4. **Pokemon Champions and Pokemon Pokopia** are 2026 releases with Metascores
   already (67 and 89). Recheck those two before publishing; a score that fresh
   can still move.
