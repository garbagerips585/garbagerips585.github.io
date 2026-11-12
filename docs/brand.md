# Brand: voice, palette, the accent rule, fonts, share cards

Covers the Trubbish Deep palette and how every token was derived, the accent rule, gold, the share cards, and the token traps.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## The original opening of CLAUDE.md

Content hub + SEO home for Garbage Rips 585, a Pokemon card pack-ripping
channel from Rochester, NY, run by one person. Not an ecommerce site — the job is
brand entity SEO and funneling visitors to the channel and socials.

## Brand
- Voice: fun, chaotic, zero gatekeeping. Rochester references everywhere:
  Garbage Plate, 585 area code, Flower City, High Falls, Public Market,
  Wegmans, lake-effect weather, Trubbish/Garbodor as unofficial city Pokemon.
- Palette: **"Trubbish Deep"**, chosen 18 August 2026, replacing the mono
  "Black / White / Gold" that this entry described until then. The owner: "i love this
  new color pallet for the trubbish look and feel ... deploy agents to re-do
  every page in that new trubbish color pallete". The channel is called Garbage
  Rips, the pack art is a Trubbish on a plate of trash, and these are the
  mascot's own five colours, sent by the owner: bag green `#2F4F39`, feet green
  `#1F382B`, pink `#E87EA1`, light blue `#70B5D9`, and `#FFFFFF` / `#231F20` for
  the mouth and the outline. Every other value is DERIVED from one of those five
  by a stated move, and **the derivation is written beside the token it produced
  in assets-source/ui.css.** Read it there before changing a value: the comment
  above `--ink` is the model, giving the anchor (`#A8A090`, sampled from Trubbish's
  own sprite), the move (+60 on every channel, an OFFSET and deliberately not a
  white blend), why the alternative was rejected, and what it cost.

  This used to point at the `F` block of scripts/gen-palette-samples.mjs, which
  generated the palette samples and self-checked every pair. That file and its
  seven preview pages were deleted on 19 August 2026 once Trubbish Deep had
  shipped, and the values were confirmed to be in ui.css with their derivations
  before it went. **Do not re-derive a number: read it from ui.css.**

  **THE ACCENT RULE, one sentence because a reader has to be able to feel it:**
  *teal is how you get around, pink is what the site is saying, and a section
  heading is never either, so the two accents always land on a neutral and never
  on each other.*
  - **Teal** `#70B5D9` (`#81BEDE` where the type is small) is every route: every
    link, every button fill, every hover, every current-page state.
  - **Pink** `#E87EA1` (`#EEA0B9` small) is every mark that goes nowhere: the
    highlighted word, the wordmark's RIPS, the display headings on the dark
    bands, the NEW and #1 HIT flags, the rip-count chip, every price.
  - **Neither is a body section heading.** Those stay off-white, and that is
    LOAD BEARING: `.mw-head h2` reads "Most wanted" with `.hl` on the second
    word, so a pink heading would swallow its own highlight and a teal one would
    sit a point of luminance from it, which is the "coloured blur" the owner
    complained about on the charcoal sample.

  **THE BIG PINK IS NOT "LARGE TEXT" AT THE SIZES THIS SITE ACTUALLY USES.**
  `--t-l` clamps to 22.4px and `--t-m` to 18.4px at 390, both at weight 400, and
  WCAG wants 24px (or 18.66px BOLD) before the 3:1 gate applies. `#E87EA1`
  measures 3.45:1 on the card, so anything under 24px takes `--ketchup-deep`.
  That is why `.hl` is the small pink. Five rules were caught this way.

  **THE FIVE PAINTED STEPS, darkest to lightest, so a card reads as a card:**
  `--chrome-bg #192D22` < `--page #1F382B` < `--paper #264231` <
  `--card`/`--paper-2 #2F4F39` < `--paper-3 #405D49`. The bar is the page green
  scaled to 80%, which is arithmetic rather than taste: see the Subscribe note.
  **THE LADDER INVERTED AND THAT BITES.** On the light palette `--paper-3` was a
  step DARKER than the card and read as an inset well; it is now the LIGHTEST
  surface there is, and a small accent on it fails (3.60:1). `.set-rips`,
  `.tiers li` and `.fk-see` were all caught. If you find a fourth, the fix is
  `--paper` (a well) or a dark fill, not a lighter accent.

  **GOLD IS SEMANTIC, NOT PALETTE, AND THAT WAS THE OWNER'S CALL:** "yeah its cool to
  keep the hall of fame gold, but just not use that color in the general pallet
  of the site colors." It has one meaning, *this is the biggest card the channel
  has ever pulled*, and it survives in three places, all written as LITERAL
  hexes so no token edit can leak it back: the **HALL OF FAME HIT badge**
  (`.hofx-tag`), the **4px trophy frame** (`.hofx`), and the **rank medallion on
  /hall.html** (`.chof-rank`) with that page's podium bloom. Everywhere else it
  is gone. A drawing of a real product is NOT palette and keeps its own colours:
  the Base Set schematic in build-base-set.mjs stays yellow-bordered for the
  same reason ui.css exempts `.pack-mascot` and the eighteen `.pack` skins.

  **THE 52 SHARE CARDS ARE PAINTED IN PYTHON AND THE REPAINT MISSED THEM BY A
  DAY.** d2b31551 turned the site green and left `public/assets/og-*.jpg` navy,
  so for one day every link preview was the old palette with a gold RIPS and a
  gold kicker: the first thing a stranger ever saw of this site was the one
  thing on it still breaking the rule above. The owner spotted it from a screenshot of
  his own link preview. Fixed 18 August 2026 in the two builders that write
  them, and BOTH have to move together because a set card and a guide card sit
  side by side in a feed:
  - `scripts/build-og.py` writes og-image.jpg plus one per set (18). NOT in
    build-all.mjs, so a palette change here is invisible to the build and has to
    be run by hand. That is how it was missed.
  - `scripts/build-og-pages.py` writes the 34 typographic guide cards. It IS in
    build-all.mjs.

  Each file now carries the ui.css token name beside every colour it copies, so
  the next palette is a re-read of `:root` rather than a taste decision. The two
  rules that are easy to get wrong here: the bloom is a SURFACE (`--paper-3`),
  never an accent, which is the same fix `.hof` took when its gold bloom went to
  the card green; and the kicker is the SMALL pink `--ketchup-deep`, because
  25-26px is under the 24px line only in the sense that `#E87EA1` measures
  3.45:1 and needs the lighter one to clear 4.5:1. The wordmark's RIPS is
  `--brand-accent` on a card exactly as it is in `.brand b i`.

  **PACK ART, CARD SCANS AND PRODUCT PHOTOS ON THESE CARDS ARE CONTENT.** The
  wrapper is the brand and the mascot is the point; only the treatment around it
  is palette. Never tint one to match a repaint.

  **TWO TOKENS WERE SPLIT AND NEITHER PALETTE CAN SHIP WITHOUT IT.**
  - `--mustard` was the wordmark accent AND the fill of every CTA. It is the CTA
    fill and nothing else now; the wordmark's RIPS takes `--brand-accent`, a
    token the generator has always emitted and ui.css had never used.
  - `--navy` was `#111111`, the same value as `--ink`, `--keyline` AND
    `--chrome-bg`, which is exactly how one token came to be a 3px FRAME, a dark
    PANEL FILL and an INK in the same stylesheet without anybody noticing. On a
    dark ground those three want opposite values. `--navy` is an INK only;
    the panel job moved to the new `--band-bg` (`#192D22`); a frame is
    `--keyline`. That was 60+ rules across 25 builders.

  **THREE BUGS FIXED IN ui.css, ALL THE SAME SHAPE: A SURFACE TOKEN WRITTEN
  WHERE INK BELONGS.** Correct on a light palette, illegible on any dark one.
  `.hero-cta{color:var(--ink)}` measured 1.27:1 on nine home-page buttons (that
  rule and its element were deleted on 19 August 2026, see the home page entry;
  the class of bug is the point and the other two are still live);
  `.hofx-t{color:var(--paper)}` at 1.03:1 made the Hall of Fame TROPHY TITLE
  INVISIBLE; `footer .soc svg{fill:var(--paper)}` at 1.10:1 was four blank
  circles. **THE CLASS IS THE POINT, NOT THE THREE.** Sweeping for it found a
  dozen more, and the MIRROR IMAGE as well: `.chofpage{background:var(--ink)}`
  painted the whole Hall of Fame page near-white with near-white text on it.
  Before you touch a colour here, grep both directions:
  `(color|fill|stroke):var\(--(paper|page|card|chrome-bg)` and
  `background:var\(--(ink|navy|chrome-ink|keyline)`.

  **THE NAMES STILL DO NOT MEAN THEIR COLOURS AND THAT SURVIVED THE REPAINT.**
  Every token spelling "gold" or "mustard" is a TEAL; `--lilac` and `--teal` are
  the same teal; `--chip-gold-bg` is a dark teal tint; `--lilac-pale` is a dark
  warm brown; `--navy` is a near-white. 65 rules spell those names and renaming
  them is churn with no pixel behind it, so this is written down loudly instead.
  **Never take a colour from this file. Read what ui.css has the token
  resolving to today.** `--sludge` does not exist at all any more. And prefer a
  design that survives losing colour entirely.

  **VERIFIED, 18 August 2026:** 39 pages spanning every family, driven in
  headless Chrome over CDP at 390x844 DPR 2 and 1440x900, every text node
  measured against the ground actually painted under it: **0 AA failures**, one
  h1 each, scrollX 0. The worst pair on the site is the Subscribe label at
  4.53:1 and the small teal at 4.50:1, both deliberate. The measuring harness
  needed three fixes before its numbers meant anything: gradients paint over a
  transparent background-color, SVG text sits on a SIBLING rect rather than an
  ancestor, and a `fill` at `opacity:.14` is a wash and not a ground.
- Fonts: Titan One (display), Outfit (body), Space Mono (labels/ticker).
- Copy style: no em dashes in written copy. Natural, human tone.
- Art credit: card + sticker illustrations by Unableplacebo (commissioned).
  Footer must keep: "Fan content. Not affiliated with The Pokemon Company".

## Copy rules (added in the restructure, 11 November 2026)

These were standing instructions from the owner that the old file stated only in part:

- American English in everything: spelling, vocabulary and idiom. The moved text above keeps its original
  spellings; new copy and new comments do not use British ones. The "dearest" incident is in docs/pages/topps.md.
- No em dashes in written copy.
- Always "Rochester, NY" in visible copy, never a bare "Rochester", because a national search for the city name
  returns Rochester, Minnesota and Rochester, Michigan first (shared/show-pages.mjs records the same problem for
  show feeds). Fixed names that contain the word (a business name, "Greater Rochester", a quoted source) keep
  their own spelling.
- Small teal text takes `--sky-deep` and small pink takes `--ketchup-deep`; both exist to clear 4.5:1.
