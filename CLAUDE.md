# Garbage Rips 585 — brand hub site

Content hub + SEO home for Garbage Rips 585, a Pokemon card pack-ripping
channel from Rochester, NY (owner: Tim). Not an ecommerce site — the job is
brand entity SEO and funneling visitors to the channel and socials.

## Brand
- Voice: fun, chaotic, zero gatekeeping. Rochester references everywhere:
  Garbage Plate, 585 area code, Flower City, High Falls, Public Market,
  Wegmans, lake-effect weather, Trubbish/Garbodor as unofficial city Pokemon.
- Palette: **"Trubbish Deep"**, chosen 18 August 2026, replacing the mono
  "Black / White / Gold" that this entry described until then. Tim: "i love this
  new color pallet for the trubbish look and feel ... deploy agents to re-do
  every page in that new trubbish color pallete". The channel is called Garbage
  Rips, the pack art is a Trubbish on a plate of trash, and these are the
  mascot's own five colours, sent by Tim: bag green `#2F4F39`, feet green
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
    sit a point of luminance from it, which is the "coloured blur" Tim
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

  **GOLD IS SEMANTIC, NOT PALETTE, AND THAT WAS TIM'S CALL:** "yeah its cool to
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
  thing on it still breaking the rule above. Tim spotted it from a screenshot of
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

## Channels
- YouTube: https://www.youtube.com/@GarbageRips585
  (channel ID UCnpEGJ2G_0af1YRyW2euIZQ)
- Instagram: https://www.instagram.com/garbagerips585/
- TikTok: https://www.tiktok.com/@garbagerips585
- Facebook: https://www.facebook.com/GarbageRips585

## How the feeds work (no API keys)
YouTube auto-playlists derived from the channel ID:
- All uploads: UUnpEGJ2G_0af1YRyW2euIZQ
- Shorts only: UUSHnpEGJ2G_0af1YRyW2euIZQ
- Long-form only: UULFnpEGJ2G_0af1YRyW2euIZQ
Embedded via /embed/videoseries?list=... so they self-update.
RSS is also available: youtube.com/feeds/videos.xml?channel_id=UC...

## Layout
```
public/        deployed static root (index, videos, playlists, assets/, data/)
assets-source/ the stylesheet source, the pack art originals and the palette
               preview, none of it deployed. The preview moved here from the
               deploy root on 16 August 2026: it is a 135KB decision aid that
               nothing links to, and it would have published itself the moment
               LIVE flips in shared/site.mjs.
scripts/       sync-youtube.mjs, local only, needs YT_API_KEY in the environment
shared/        taxonomy.mjs, the set/product tag rules, imported by both
```

## The stylesheet: edit assets-source/ui.css

**`public/assets/ui.css` is GENERATED. Edit `assets-source/ui.css`, then run
`node scripts/build-css.mjs`.** The generated copy says so in its first line.

The build strips the comments and nothing else: same rules, same order, byte
for byte identical once whitespace and comments are removed. It exists because
the stylesheet is render blocking on every page and most of it is prose.

**THE FIGURES HERE WERE "426 pages" AND "42.4KB -> 17.4KB, a 59% cut" AND ALL
THREE WERE STALE, corrected 21 August 2026.** The tree is 1,486 pages now, and
the built stylesheet has grown past 20KB gzipped without anybody noticing,
because the number that would have shown it was written down once and never
re-taken. Measured gzipped, which is how the host serves it. **RE-TAKEN AT HEAD
ON 21 AUGUST 2026, and the four numbers that were here were already wrong**, which
is the third time this entry has been stale and the reason the command below is
written out rather than the answer:

      assets-source/ui.css    356,351 raw    121,062 gzipped
      public/assets/ui.css    107,150 raw     21,041 gzipped

so the strip is an 82.6% cut gzipped, not 59%, and **the file a reader actually
waits for is 21,041 bytes and not 17,400.** Traced through git on the built
copy, it has moved every day: 20,106 on 19 August, 20,468 later the same day,
20,741 / 20,770 / 20,744 / 20,768 across 20 August, 21,041 at HEAD on 21 August.

**TAKE IT FROM HEAD, NOT FROM THE WORKING TREE, WHEN ANYTHING ELSE IS EDITING.**
`assets-source/ui.css` is the file agents touch most, so a measurement made while
one is mid-edit is a measurement of a file that has never shipped. The two
answers were 21,041 and 21,153 within the same minute on 21 August. `git show
HEAD:public/assets/ui.css | gzip -9c | wc -c` is the version that cannot move
under you.

**RE-TAKE IT RATHER THAN QUOTING IT**, because the number above will be wrong
again within days and this file has now been wrong about it twice. One line,
and the `<` matters: `gzip -9c file` stores the filename and mtime in the header
and gives a different answer from `gzip -9c < file`, which is a real 30-byte
disagreement and is how two passes can measure "the same thing" and differ:

    for f in assets-source/ui.css public/assets/ui.css; do \
      printf '%-24s raw=%s gz=%s\n' $f "$(wc -c < $f)" "$(gzip -9c < $f | wc -c)"; done

The 20KB is still the point rather than the pity: it is one render blocking
request on 1,486 pages, so a kilobyte here is worth more than a kilobyte
anywhere else on the site. See the packs.css note under Card images for the
other render blocking stylesheet and the twelve pages that were carrying it for
nothing.

The comments are the point of the source file, so they are not a cleanup
target: most of them record a measurement or a bug that a tidy-up would
otherwise reintroduce. They cost nothing now, so write more of them.

`build-css.mjs` runs FIRST in build-all.mjs, before any page builder, because
shared/chrome.mjs hashes the built stylesheet at import time to make the
`?v=` cache buster. `stamp-assets.mjs` still runs LAST. check-build.py fails
if the two files have drifted apart, which is what catches an edit made to the
generated copy by habit.

Do NOT delete rules because coverage says they are unused. Only 6-15% of the
file is used on any one page, but coverage cannot see :hover, :focus, print,
media query or JS-toggled-class rules, and deleting those is how this site
breaks silently.
Host is GitHub Pages: .github/workflows/pages.yml uploads public/ on every
push to main. There is no server build step. See DEPLOY.md.

**THE SAME STRIP NOW HAPPENS TO EVERY INLINE `<style>` BLOCK, IN
`stamp-assets.mjs`, AND IT RUNS LAST SO IT CATCHES EVERY PAGE HOWEVER IT WAS
PRODUCED.** 21 August 2026. Twenty-two builders already carried a private regex
copy of this trade for their own page CSS and the rest carried none, so the
pages that lost most were the ones no builder edit could reach: `build-pokemon
.mjs` has no `miniCSS` at all and owns 1,026 pages, and about, shops, wanted,
hall and garbage-plate take their `<head>` by SLICING index.html, so all five
shipped build-proto.mjs's `homeCss` comments verbatim, 5,289 raw bytes of prose
about a band none of them render. Measured across all 1,487 built files and
1,488 blocks: **2,694,105 raw bytes of comments, 1,325.1KB gzipped, 8.07% of
ALL the HTML this site serves**; 1,237 B/page on /pokemon/ (11.05% of the
document), 1,706 on the root pages, 7,089 on /base-set.html alone. It uses
build-css.mjs's `strip()`, tokenizer and `lintComments()` and all, never a
regex, for the reason that function's own header gives.

**IT WAS ASKED FOR AS AN LCP FIX AND ON A COLD LOAD IT IS NOT ONE. THIS IS THE
PART WORTH KEEPING.** The case was that the LCP element on the Pokemon pages,
the set guides and the root guides is a paragraph of TEXT, so LCP equals FCP and
document bytes are the gate. The first half is true and was re-confirmed: LCP is
`P.lede` on all three families and LCP == FCP to the millisecond. The second
half is false. At 390x844 on Slow 3G with 4x CPU, medians of 9, /base-set.html's
document arrives **468ms earlier** (1,289 -> 821ms) and **LCP does not move**
(2,456 -> 2,500ms, inside a noise floor of 0-8ms taken by running the same tree
against itself).

**THE PAINT IS GATED BY ui.css ALONE AND NOW THERE IS A NUMBER ON IT.** The
waterfall: the preload scanner finds the stylesheet in the first KB of the head
and `/assets/ui.css`, 21,209 bytes gzipped, lands at **2,338ms, which is
1,226ms after the document has finished**. The inline block IS render blocking
but rides in with the document, so it is never the LAST render-blocking thing
and shrinking it cannot move first paint. **"A kilobyte here is worth more than
a kilobyte anywhere else on the site" is measured now rather than asserted, and
ui.css is where the next real paint win is.** Do not go looking for one in page
CSS again.

**AND THE WIN IS ON THE SECOND PAGE OF THE VISIT, which is the condition nobody
measured and is the common one:** a reader who arrived on the home page, and a
crawler walking 1,487 urls. The assets are content-hashed and immutable, which
is exactly what the `?v=` stamp exists for, so on page two the document is the
ONLY thing on the critical path and the bytes convert almost 1:1 into paint.
Warm cache, after /index.html, LCP before -> after:

      Slow 3G   /base-set.html            744 -> 632ms    -112ms, -15%
      Slow 3G   /pokemon/charizard.html   604 -> 560ms     -44ms,  -7%
      Slow 3G   /sets/151.html            564 -> 564ms       0ms   (0-byte control)
      Slow 4G   /base-set.html            276 -> 248ms     -28ms, -10%
      Slow 4G   /sets/151.html            236 -> 236ms       0ms   (0-byte control)

**QUOTE THE COLD ROW WITH THE WARM ONE OR QUOTE NEITHER.** A page-weight change
on this site buys nothing on a first visit and real milliseconds on every visit
after it, and reporting either half alone is how the next pass gets talked into
the wrong optimisation.

**NOTHING RENDERS DIFFERENTLY AND THAT WAS MEASURED.** 121 pages across every
family at 390 and 1440, 244,066 elements, each compared on 108 computed
properties plus its box plus `::before` and `::after`: 236 of 242 page-width
runs byte-identical, and all six that were not reproduce when a tree is compared
AGAINST ITSELF. **CSSOM rule counts, counted recursively so a media block's
children count too: 306,582 -> 306,582, zero mismatches.** That is the check
that proves a stripper took comments and not rules, and it is the one to repeat
if anybody touches this again. **Three pages are nondeterministic under a
computed-style diff and it is not a bug:** /lore.html's SVG bars are mid
animation, /games/pokemon-trivia.html and /games/guess-the-set.html pick a
random question, and `.pack-hint` carries a running transition on the playlist
pages. Establish a same-tree noise floor before believing a diff on any of them.

**getComputedStyle RESOLVES url() TO AN ABSOLUTE URL, so two trees served from
two ports differ on every `background-image` and a naive diff reports hundreds
of false changes.** Normalise the origin out before hashing. That cost the first
pass an hour of chasing `.pack-art`.

## Every click stays on the site
Video tiles everywhere link to that video's own page under `public/rip/`,
never to youtube.com. The embed lives on that page.

The deliberate outbound links are Subscribe, the social icons, and one block
of four at the foot of /how-to-play.html.
THAT SENTENCE IS AN UNDERCOUNT AND HAS BEEN FOR MONTHS: see "THE COUNTING WAS
WRONG THE WHOLE TIME" below for what is actually in the tree, and for the test
that replaces the count.
THE PLAYLIST CARDS WERE THE THIRD EXCEPTION AND THEY ARE NOT ONE ANY MORE,
19 August 2026. This file argued the case at length: a playlist is a YouTube
object, an ordered hand-curated run, and watching it in order was a thing
YouTube did that this site did not replicate. Against that it noted the site
holds a page for every video in those playlists, so an on-site playlist view
was buildable, and "the rule exists because sending people to YouTube is how a
content hub stops being one". It ended by saying that whoever built the on-site
version should DELETE the paragraph rather than edit it.

It is built. /playlists.html now has 22 internal "Open the playlist" links and
ZERO outbound ones, each playlist page plays every video in order on the site,
and it states the run's total runtime, which YouTube's own playlist view does
not. So the paragraph is gone, as instructed, and this is its headstone.

THE FOURTH EXCEPTION IS /how-to-play.html, added deliberately and argued here
rather than made quietly, which is the mistake the playlist cards made. That
page teaches the rules of the card game, and it ends with one labeled block of
four links to Pokemon's own sites: the Learn to Play hub, the Quick Start Rules
PDF, Pokemon TCG Live, and the full 44 page rulebook PDF.

The case for them is that this site cannot host the rules and should not
pretend to be a substitute for them. A beginner who wants more than our page
needs the real rulebook, and the single best thing to recommend to somebody
learning is the official free digital client, which teaches the rules and then
enforces them. A 101 page that refuses to name it is worse for its reader than
one that does. The case against is simply the count: four outbound links on one
page is more than the rest of the site holds outside the playlists.

The shape is the mitigation and it is the condition of the exception. They sit
in ONE block at the very END of the page, after every internal link, so nothing
sends a reader away mid-explanation. Each says it opens on Pokemon's site, in
an aria-label, exactly as the playlist cards do. The rulebook link warns that it
is 44 pages and around 50MB before anybody taps it on mobile data.

THE FIFTH EXCEPTION IS THE PAIR OF APP PAGES, /tcg-live.html and
/tcg-pocket.html, and it is the same shape as the fourth rather than a new
argument. Both are guides to a free official app, and a page that tells you to
download something and then refuses to say where is useless.

The shape is again the mitigation. /tcg-pocket.html carries ONE outbound link,
Pokemon's own site, in one labeled block at the very end. /tcg-live.html carries
TWO in its end block, the official TCG Live page and the redemption site, and
that page takes one further liberty which was argued rather than made quietly:
THE REDEMPTION LINK ALSO APPEARS INLINE, in the redeeming section. It is not a
"learn more" link, it is step one of a four step instruction, and burying it 900
words below where the reader is standing costs them more than the outbound rule
gains us. It is labeled and aria-labeled as leaving the site exactly like every
other one. If a later editor disagrees, the fix is to drop the inline copy and
name the domain in plain text there, not to spread more of them through the page.

THE FORBIDDEN LINK IS FORBIDDEN ON ALL THREE OF THOSE PAGES AND IT IS NOT A
STYLE CHOICE. The TCG Live page also links "Card Drop Rate Information". Do not
link it, quote it or summarise it from /how-to-play.html, from /tcg-live.html or
from /tcg-pocket.html, and the same goes for anything stating Pokemon TCG
Pocket's offering rates. The site never states pull rates, and linking a page of
them through a guide of ours is the same claim made at one remove. Both digital
games publish their own rates, which is precisely why the ban has to name these
pages: they are where somebody will argue that a published figure is different.
It is not. The research files record that those pages were deliberately never
fetched and that no url leading to them is stored, so there is nothing in the
tree to emit by accident. Keep it that way.

THERE IS NOW A SIXTH EXCEPTION, /most-valuable-cards.html AND
/most-expensive-sealed.html, AND IT WAS ADDED WITHOUT BEING ARGUED HERE, WHICH
IS THE MISTAKE THE PLAYLIST CARDS MADE AND THIS FILE SPENDS FOUR PARAGRAPHS
COMPLAINING ABOUT. It was approved in conversation on 17 August 2026 and the
paragraph below still said "there is no sixth exception" while 200 links were
live on two pages. A QA sweep found it. Writing it down now, late.

Each page carries one "check on <source>" link per row, 100 apiece, no
affiliate code. THE ARGUMENT FOR IT is the one the fourth and fifth exceptions
turn on: the reader needs the destination. Those two pages exist to say what
the most expensive Pokemon cards and sealed products are, ranked by a price
read on a date, and a price like that is only worth publishing if a reader can
check whether it still holds. Two hundred uncheckable numbers is a worse page
than two hundred checkable ones, and the site's whole claim is that its figures
are traceable.

THE LINK FOLLOWS THE PRICE, AND SINCE 18 AUGUST 2026 THE TWO PAGES POINT AT
DIFFERENT HOSTS. /most-valuable-cards.html moved onto PriceCharting's ungraded
price guide, like every other raw price on this site, so its hundred links go
to pricecharting.com; /most-expensive-sealed.html is still TCGplayer's market
price, because the PriceCharting crawl runs with `exclude-hardware=true` and
holds essentially no sealed product, so its hundred still go to tcgplayer.com.
That is not a detail, it is the condition of the exception: a row priced by one
source with a link to the other is a citation to a page that does not hold the
figure printed beside it, which is worse than no link at all. If a page's
source changes again, the link changes in the same edit.

NOTE THE PAGE THAT DOES THE OPPOSITE. /top-graded.html prints the same host's
product PATH on all 100 of its rows as PLAIN TEXT and links none of it, arguing
in build-top-graded.mjs that 100 outbound links would be the largest exception
on the site. That argument was written before these two pages existed and the
count it feared is now live and written down here. So the site currently does
both things with the same source, which is a real inconsistency rather than a
subtlety: either that page gains links or these two lose them. It is Tim's
call, and it is recorded here rather than settled quietly in one file.

THAT OPEN CALL WAS THE REASON /topps-card-values.html HAS NO ROW LINKS, added
18 August 2026 with 200 PriceCharting rows on it. It follows /top-graded.html:
the product path is printed on every row as plain text and linked nowhere. The
argument is in scripts/build-topps.mjs's header and it is short. Two hundred
more outbound links would be the largest single addition of them the site has
ever made, and making it would settle a question this file explicitly parks with
Tim, in one builder, quietly, which is the exact mistake the four paragraphs
above are about. The figures stay checkable because the path is on the row. If
Tim settles it the other way, that page and /top-graded.html change in one edit,
together, and this paragraph goes with them.

THE SHAPE IS THE MITIGATION, exactly as for the fourth and fifth. Every large
tap target on a row, the rank, the picture, the name, the whole row, is
INTERNAL: it goes to that card's set guide, then its Pokemon page, then site
search. Re-measured on /most-valuable-cards.html on 18 August 2026, after the
source change: 106 internal links inside <main> against the 100 outbound ones,
204 against 108 counting the chrome, and the
outbound one is 123.7 x 44.0 at 390x844 against a whole-row internal target. The outbound link is a small labeled control at the end of
a row, aria-labeled as leaving the site like every other exception.

NOTE THE CONTRAST WITH THE PARAGRAPH BELOW, which is still correct and still
the default. /decks.html and /top-100-playable.html ALSO lean on an outside
source and get no link, because a decklist reproduced in full on the page needs
no destination. The test is not "does this page owe a source credit", it is
"does the reader need to go there". A price you are asked to trust says yes; a
decklist you have already been handed says no.

/decks.html AND /top-100-playable.html ARE THE
CASE THAT NEARLY MADE ONE. Both are built entirely out of somebody else's
measurements: deck usage, match records and several hundred decklists, all from
Limitless TCG. That is exactly the shape of the fourth and fifth exceptions, a
page that leans on an outside source and looks like it owes that source a link,
and both pages were built with none.

The reason is that ATTRIBUTION AND A LINK ARE NOT THE SAME OBLIGATION. Limitless
is named in plain text on both pages, in the body and again in the source note
at the foot, along with the filter used, the sample size and the date it was
read. That is the whole of what crediting a source requires. The fourth and
fifth exceptions exist because a reader NEEDED the destination: you cannot
follow "download the official app" without the download page. Nobody needs
limitlesstcg.com to use a decklist we already reproduced in full on the page and
handed over as a file. The link would be a courtesy to the source rather than a
service to the reader, and that is the exact trade the rule refuses.

If a later editor wants to add them, that is a real argument and not a silly
one, but make it here first, in this file, in the same edit. Do not add one
quietly to the foot of a page: that is precisely how the playlist cards became
an exception this file did not admit to for months.

THE COUNTING WAS WRONG THE WHOLE TIME AND THE NUMBER IS NOT SIX. Re-measured at
HEAD on 21 August 2026 across every built page, socials and youtube.com
excluded: **1,482 of the site's 1,487 built HTML files** carry a non-social
outbound link -- that is the 1,486 pages counted everywhere else in this file,
plus 404.html. (It said "1,473 of 1,478" from the 18 August pass; the five pages
that carry none are the same five -- index, about, videos, hall and playlists --
and only the totals moved.) The rule and
the tree have disagreed for months, in the same way and for the same reason as
the playlist cards, and this file has been the one telling the story about how
bad that is.

WHAT IS ACTUALLY OUT THERE, by host, so the next person can check the claim
instead of trusting it:

- app.getcollectr.com, 1,479 pages. THE FOOTER. (EIGHT pages do not carry it,
  not seven: index, about, videos, hall, playlists, shops, wanted and
  garbage-plate all pass their own footer extra and take a variant.
  garbage-plate.html joined that list after this entry was written and nobody
  re-derived it, which is what a hand-typed list of exceptions does.
  That was not deliberate, it is just how the
  helper is called, and it means the home page is one of the few pages where
  the claim in the heading above is literally true.) This is the big one and it was
  never an "exception" in anybody's head because it is chrome rather than
  content, which is exactly how it went uncounted. It IS argued, but in
  shared/chrome.mjs beside the constant, not here, and an argument written
  where nobody looks for the rule is the failure mode this section exists to
  describe. The case for it is good and stands: it is Tim's own collection,
  the alternative was building a collection page out of Collectr's API that
  nobody comes here for, and one named text link at the foot of the page beats
  a fake page competing with the real ones.
- tcgplayer.com, 727 when this was counted, 627 after 18 August 2026: the
  hundred rows of /most-valuable-cards.html moved to pricecharting.com with
  the prices they cite. The rest is the sealed page (100) plus set guides,
  /openings/ and /upcoming.html, which the sixth-exception paragraph above did
  not count either.
- pricecharting.com, 100, all of them on /most-valuable-cards.html and all of
  them added on 18 August 2026 in the same edit that moved that page's prices
  there. /top-graded.html and /base-set.html print figures from the same source
  and link none of it; see the note in the sixth exception above.
- bulbapedia.bulbagarden.net 200 and metacritic.com 93, nearly all on
  /video-games.html, which carries 257 by itself and is the densest page on
  the site.
- pokemon.com 45, google.com 28 (map links on /card-shows.html),
  help.tcgplayer.com 27, cardshows.io 24, then a long tail of graders,
  marketplaces and individual show organisers.

THE RULE IS NOT A COUNT AND SHOULD NEVER HAVE BEEN WRITTEN AS ONE. A count
goes stale the first time somebody adds a page, and then the file lies without
anybody editing it. The test is the one the fourth, fifth and sixth exceptions
all actually turn on, stated plainly:

  Does the READER need the destination, or does the SOURCE deserve a credit?
  The first earns a link. The second earns a name in plain text and nothing
  more.

Every host in the list above passes that test on its own page. A page listing
card shows is useless without the show's own page and a map. A page about
where to sell needs each venue's fee schedule, because the fees are the whole
decision and they change. A grading page needs the graders. /video-games.html
is a catalogue of 174 games and Bulbapedia is where a reader goes next; the
alternative is transcribing Bulbapedia onto our own pages, which is worse for
everyone including Bulbapedia. And /decks.html still gets none, for the reason
argued above: the decklist is already on the page.

THE SHAPE REQUIREMENT SURVIVES AND IT IS THE PART THAT ACTUALLY MATTERS.
Outbound links sit at the end of a row or the end of a page, never mid
explanation; they are small labeled controls next to large internal ones; and
every one carries an aria-label saying it leaves the site. That is checkable,
it does not go stale, and it is what a reader experiences. THE FOOTER LINK
FAILED BOTH HALVES OF IT until this edit: no aria-label, and an 18px line of
text sitting beside four 44px social buttons, so the smallest target in the
footer was the only one that left the site. Fixed in shared/chrome.mjs and
assets-source/ui.css on 18 August 2026.

DO NOT REPLACE THE NUMBER WITH A BIGGER NUMBER. If you add an outbound link,
apply the test above, meet the shape, and if the answer is arguable write the
argument HERE. The rule is the test plus the shape, not a tally.

/garbage-plate.html IS THE NEXT THING TO APPLY THAT TEST TO, and it is argued
here rather than added quietly, which is what the four paragraphs above are
about. It carried 48 outbound anchors to 36 distinct urls when it was added on
20 August 2026 and it carries 67 to 48 the same day, and it is the densest
non-list page on the site for them. They are FOUR kinds and each passes the test
on its own:

  - ELEVEN RESTAURANTS' OWN SITES AND MENUS. Same shape and same argument as
    /shops.html, which this page's list is modelled on: a page whose job is to
    send you to dinner is useless without the menu and the address. Each card's
    address goes to a map, exactly as a shop card's does.
  - NINE SOURCES, once each in a source line under the claim they support, and
    again in a list at the foot. THIS IS THE SIXTH EXCEPTION'S OWN ARGUMENT
    MOVED FROM A PRICE TO A DATE. That exception says a figure is only worth
    publishing if a reader can check whether it still holds; a historical claim
    is the same shape, and this page's whole pitch is that the existing writing
    about this dish asserts things and does not source them. A history nobody
    can check is worth less than a shorter one they can.
  - TWENTY-ONE IMAGE CREDITS, TWO UNDER EACH OF THE ELEVEN PHOTOGRAPHS (was
    nineteen under ten until Bill Gray's was added on 20 August 2026), argued
    HERE rather than added quietly, which is what the four paragraphs above are
    about. ELEVEN go to commons.wikimedia.org and TEN to creativecommons.org,
    THREE distinct deeds between them since the eleventh is the page's first
    CC BY-SA 3.0. THIS ONE IS NOT
    DISCRETIONARY AND THAT IS WHY IT IS A FOURTH KIND RATHER THAN A THIRD
    HELPING OF THE SECOND. Every other link on this site is a judgement about
    what a reader needs; ten of these eleven pictures are CC BY or CC BY-SA and
    those licenses are granted ON CONDITION of naming the photographer and
    LINKING the license. A page that prints the photograph and not the link is
    not making a tidier editorial choice, it is using the picture outside the
    terms it was offered under. The eleventh is public domain and its credit
    carries the photographer link and no license link, because there is no
    license to link to.
  - NOTHING ELSE. No affiliate code, no directory, no aggregator.

THE SHAPE IS MET AND WAS MEASURED, not asserted: all 67 carry an aria-label
saying they leave the site, and the page's own large tap targets are internal.
THE IMAGE CREDITS ARE THE ONE PLACE THIS PAGE PUTS A LINK INSIDE A SENTENCE, and
the line below says never to do that, so read the exception rather than the
count. That rule is about a SOURCE being cited from inside explanatory prose,
which is how a page grows links nobody planned. A credit line is not explanatory
prose: it is the picture's own source line, sitting under the picture, and the
photographer's name and the license name ARE the two things it exists to say.
Linking anything else from inside it would be the thing the rule forbids. The
line still stands for everything else: a source belongs in a source line, never
as an inline link inside a sentence, because that is how the count gets away
from you.

/shops.html GAINED TWO LINKS OF THE SAME NON-DISCRETIONARY KIND ON 20 AUGUST
2026, AND THEY ARE WRITTEN DOWN HERE RATHER THAN ADDED QUIETLY, which is the
mistake the paragraphs above spend four screens complaining about. The map at
the top of that page used to be six dots on a plain green field, and its own
caption admitted the gap: "There are no roads on it because we do not have any
to draw." Tim asked for a real map. It now draws roads, water and the City of
Rochester line from OpenStreetMap DATA, fetched once by
`scripts/sync-shop-map.mjs` into `data/shop-map.json` and rendered into the same
inline SVG; no tiles, no runtime request to anybody. OSM data is ODbL, which
grants use ON CONDITION of crediting the contributors and making the licence
reachable, so the figure's caption carries "Map data from OpenStreetMap
contributors, licensed ODbL 1.0" with a link on each half.

THAT IS THE PHOTO-CREDIT ARGUMENT WITH THE MEDIUM CHANGED AND NOTHING ELSE. It
is not a judgement about what a reader needs, which is what every discretionary
link on this site is; it is the term the data was offered under, exactly like the
nine CC BY and CC BY-SA deeds on the Garbage Plate page. A page that draws the
roads and does not link the licence is not making a tidier editorial choice. Both
sit in the figure's own credit line at the very end of the caption, both are
aria-labelled as leaving the site, and the page's large tap targets are still
internal. If the map ever loses its OSM geometry, these two go with it in the
same edit.

AND THE THING THAT SURVIVED THE CHANGE, because it is the reusable half: NO
RASTER TILES, from OSM's servers or anybody's. Three reasons, each disqualifying
on its own. OSM's tile usage policy prohibits systematic downloading. A tile
served at page load is a request to a third party on every visit, which is the
same objection that got the ytimg preconnect removed. And a tile is painted in
somebody else's colours and cannot be repainted in ours, where vector geometry
can, which is why every stroke on that map is a Trubbish Deep token. Fetching the
DATA once, by hand, into a committed file is a different act from harvesting
tiles, and the script that does it is NOT in build-all.mjs for the same reason
sync-decks.mjs is not.

/card-shows.html GAINED THE SAME TWO LINKS ON 21 AUGUST 2026, FOR THE SAME
NON-DISCRETIONARY REASON, AND IT IS THE SAME SENTENCE THAT CAUSED IT. Tim: "on
the card shows page, make the image at the top an actual map showing the cities
and surrounding areas right now its just names of cities and dots, needs to be a
map, also please delete the calendar below the map not needed." That figure's
caption had said, word for word, what /shops.html's had said a day earlier:
"There are no roads on it because we do not have any to draw." Same error, same
shape, second page: a true statement about the candidates somebody looked at,
written as a statement about the subject. It draws the Lake Ontario shore, the
Finger Lakes, the interstates, the trunk routes and the county lines now, from
`data/card-show-map.json`, fetched once by `scripts/sync-card-show-map.mjs`,
which is NOT in build-all.mjs. The ODbL credit and its two links are in the
figure's own caption. No tiles, for the three reasons above.

WHAT IS DIFFERENT IS THE SCALE AND IT CHANGED THE FEATURE LIST RATHER THAN THE
DESIGN. /shops.html is 24 miles across at 37 units to the mile; this is Sanborn
to Syracuse, 147 miles, at 3.9. **At 390px that is TWO PIXELS TO THE MILE**, so
the same layers are a grey wash: the road list stops at TRUNK where that one runs
to secondary (primary alone is 8,052 ways in this box), the water cut is fifty
times coarser at half a square mile, the boundary is the COUNTY rather than a
city limit, and the river CENTRELINES were fetched, drawn, looked at and
REJECTED, 1,702 points for 130 blue veins that buried the Thruway. Every wide
river here is a water polygon and is still on the map. **If you widen this map's
feature list, screenshot it at 390 before you believe it helped.**

THE CALENDAR UNDER IT WENT IN THE SAME EDIT, on the same instruction, and it is
the hours-chart call on /shops.html a second time: five drawn months, a legend of
four, and a grid that said in a second shape what every listing already says in
full with the day in a slab down the side of the card. Nothing else read any of
it; data/shows.json is untouched. The one clause of its caption worth keeping,
the day count and the fact that the area buttons drive the map, moved under the
map. The headstones are in build-shows.mjs.

THE TEN RETAILER PAGES GAINED 53 OUTBOUND LINKS ON 20 AUGUST 2026 AND NOT ONE
NEW DESTINATION, which is the only reason this one is short. It is argued here
rather than added quietly in one builder, which is what the paragraphs above
spend four screens complaining about.

WHAT THE PAGES DID BEFORE: they PRINTED the address, in full, as visible text,
in the middle of a sentence. 35 of them across /retailers/*.html and 31 more on
/retailers.html. The worst was 130 characters and wrapped across three lines of
a price citation at 390px, so the widest object in the paragraph was also the
one thing a reader could not act on. Every one of the 53 links now on those
pages points at a url that was already on the same page in plain text. Nothing
was researched, nothing was added, and no host appears that did not appear
before: the retailers' own sites, plus the eight chains under "shops we could
not read" whose search pages are the evidence for that claim.

THE TEST, APPLIED: does the READER need the destination? Yes, and it is the
sixth exception's own argument rather than a new one. Every row is a PRICE READ
ON A DATE, or a claim about what a chain stocks read on a date, and this file
already says a figure like that is only worth publishing if a reader can check
whether it still holds. Printing the address and refusing to link it does not
make the page more restrained, it makes the check harder for no gain.

THE SHAPE IS MET AND WAS MEASURED. All 53 are `.rt-chk`: a 44px labelled control
reading "Open the listing on gamestop.com" at the END of a row or of a source
line, never mid explanation, each with an aria-label ending ", opens on <host>",
`rel="noopener"` and `target="_blank"`. Checked on the built tree: 53 of 53
carry all four. The large tap targets on those pages are still internal, and
the pages measure 0 elements past the right edge and scrollX 0 at 320, 390 and
1440.

THE ONE PLACE THAT STAYED PLAIN TEXT IS THE "Where it was read" COLUMN on
/retailers.html, 13 addresses, and that is deliberate: it is a table cell rather
than body copy, `.rt-url` in build-retailers.mjs argues its own case about
column width, and the same address is a link on that shop's own page one click
away. If a later editor wants that column linked too, that is a real argument;
make it here first.

AND THE SEVENTH EXCEPTION THAT WAS ASKED FOR BY NAME AND STILL NOT MADE, 17
August 2026. Tim stated the site's commercial purpose plainly: YouTube is the
primary channel and the goal is subscribers and views. That goal is in genuine
tension with this rule, and the obvious way to serve it is to put a Subscribe
link or a youtube.com link on all 1,475 pages. THAT IS THE ONE THING THAT WAS
NOT DONE, and this paragraph exists so nobody has to rediscover why.

THE MEASUREMENT THAT PROMPTED IT, driven on the real pages at 390x844 DPR 2,
first VISIBLE control of any kind pointing at the channel:

      /pokemon/gible.html      y=10,078 of 10,363    97% down, 12 screens
      /evolution.html          y=94,648 of 94,910    112 screens
      /msrp.html               y=30,937 of 31,266
      /base-set.html           y=19,629 of 19,914
      /retailers/target.html   y= 6,006 of  6,246

Every one of those was the unlabeled YouTube circle in `.foot-social`, because
below 560px the bar's own `.sub` WAS `display:none` at the time of that
measurement and has not been since 18 August 2026, when it was unhidden; at
390 today it is a 92px control reading Subscribe. The measurement below still
stands as the reason the pages changed, but do not quote the mechanism as
current: assets-source/ui.css records both states, twenty lines apart, and
three separate sweeps have now repeated the stale half. The only other Subscribe
is inside the closed hamburger. NO informational page contained a single line of
copy saying what the channel is. A stranger could read all 10,363px of the Gible
page without learning there was a channel behind it.

The fix went the other way on purpose, and it is the reading that dissolves the
tension rather than trading one goal off against the other: A CONTENT HUB EARNS
A SUBSCRIBER BY BEING WORTH SUBSCRIBING TO, so the answer is to show the
channel's own videos as CONTENT on the informational pages and let the reader
arrive at the channel wanting it. `build-pokemon.mjs` now joins a species to
rips by SET as well as by title, which took the largest page family on the site
from 39 pages carrying a video link to 918, and every one of those links goes to
a rip page on this site. Nothing outbound was added anywhere. The one genuinely
outbound change is that the Subscribe already in the footer got a NAME and a
REASON instead of being a bare 44px glyph, which is the first exception being
done properly rather than a new one being invented.

SO THE COUNT IS STILL SIX, which is the count the section above this one leaves
it at, and the commercial goal did not add a seventh. If a later editor is asked
for the same thing again, the lever is a MORE RELEVANT VIDEO IN A BETTER PLACE,
not another link: a rip of a set that prints this card beats a "latest videos"
rail, and both beat a sticky bar. Page families with nothing to watch are listed
under "Which pages have something to watch" and that is where the next win is,
not in this section.

THE POINTER ABOVE IS WRITTEN AS A SECTION NAME RATHER THAN A NUMBER ON PURPOSE.
This paragraph was drafted while the count was five and a second agent added the
sixth in the same hour, which is exactly how the numbers in this file go stale.
Name the argument, not its index.

A playlist with zero videos does not render at all. Two exist on the channel
and were showing as cards reading "0 videos" whose only action was a link to
an empty YouTube playlist. They reappear the moment a video goes in.

`scripts/build-pages.mjs` generates a page for EVERY video, so no tile
can dead-end. Videos missing a set or product tag get `noindex` and stay out
of the sitemap, because they would be thin pages; tag them and re-run to
promote them. `shared/paths.mjs` owns the URL shape and the sync stamps
`path` onto every video, so the browser, the generator and the RSS function
cannot drift apart.

## The pack wrapper
The player on every rip page sits under a sealed booster pack that has to be
ripped open. This is not just decoration: YouTube's poster frame is usually
the pulled card, so the thumbnail spoils the video before you press play.

Built from two `.pack-face` halves, each holding a full copy of the pack art
and clipped with a jagged `clip-path` so together they read as one sealed
pack. Click mounts the iframe immediately, then runs shake (0.26s) and tear
(0.62s) over the top of the already-playing video.
The sequence is driven by `animationend`, not by timers matching the CSS
durations, because background tabs clamp `setTimeout` and would desync the
reveal from the tear. Generous fallback timers cover the case where the
animation never fires. `prefers-reduced-motion` skips straight to the video.

The five `@keyframes` (packShake, packFade, tearL, tearR, packFlash) live in
ui.css. They were referenced by name for a long time without existing, which
is silent: a CSS animation naming missing keyframes never runs and never
fires `animationend`, so the pack simply sat there. If the pack stops moving,
check the keyframes are still present before anything else.

**BEFORE BELIEVING A PACK FAILURE YOU FOUND WHILE TESTING, CHECK YOUR
HARNESS.** Driving many rip pages in one browser session produces false
failures that look exactly like the missing-keyframes bug: after roughly five
pages the accumulated YouTube embeds starve the renderer, no animation starts,
and the pack never clears. A QA pass measured 5 of 15 passing that way and 15
of 15 with a fresh browser per page. If you are automating this, isolate the
browser per page, and treat "it broke after the fifth one" as evidence about
the harness rather than about the site.

**The embed starts MUTED and unmutes itself a moment later. The ORDER is the
whole trick.** A muted media element is exempt from the user-gesture check; an
unmuted one is not, and a cross-origin iframe created during a click does not
reliably inherit that click (Chrome and Firefox usually honour an ancestor's
gesture through `allow="autoplay"`, WebKit does not). That is why this was
intermittent rather than broken: it varied by browser and by visit, never by
video or by page.

The trap that caused the reported bug: unmuting BEFORE playback begins throws
away the exemption `mute=1` just bought, so the player makes its autoplay
attempt as an unmuted element, is refused, and paints YouTube's own play
button. Asking for sound too eagerly causes the exact symptom it was meant to
fix. So:

1. Mount muted. Muted autoplay is never refused, so the rip always starts.
2. Wait for the player to REPORT playing (state 1).
3. Only then unmute. Sound arrives while the pack is still tearing.
4. If unmuting stops it, re-mute, resume, and show `#soundOn` for one tap.

Three things that are easy to get wrong and were all wrong once:
- `onStateChange` delivers `info` as a NUMBER, `infoDelivery` as an object.
  Handling only the object shape silently ignores every state change.
- The `listening` handshake must be REPEATED. The player installs its message
  handler well after the iframe's `load` event and drops anything earlier, so
  sending it once on `load` loses the feed and every decision is made blind.
- Never call `playVideo` on an unmuted, not-yet-started player: a refused
  scripted play is itself what triggers YouTube's play button.

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
  shape, and `data/chase-tcg.json` now supplies nothing but TCGplayer links.
  Do not reintroduce a second price feed to a page that already has one: 22 of
  28 guides once priced their own chase card twice, and on Ascended Heroes the
  second feed named the wrong card entirely.

  **THE MONEY IN THAT FILE IS PRICECHARTING'S NOW, NOT TCGDEX'S, SINCE 18
  August 2026.** Tim: "lets use pricecharting as the main numbers for the
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
  excludes sealed product; Tim authorised that split in as many words.

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
  arithmetic. Never state pull rates: we do not have them.

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

## The Topps pages

Two pages about the cards Topps made, added 18 August 2026 on Tim's ask: "the
company Topps made their own sets of Pokemon cards back in the day ... not many
collectors know about the Topps cards, and most don't realize how valuable they
are as well". FOUR scripts now, and only the last is in build-all.mjs:

    node scripts/sync-topps-top.mjs     cached crawl -> data/topps-top.json (NO network)
    node scripts/verify-topps-top.mjs   176 product pages, one a second (network)
    node scripts/sync-topps-images.mjs  the pictures -> data/topps-images.json (network)
    node scripts/build-topps.mjs        /topps.html + /topps-card-values.html

Only the last is in build-all.mjs, the same arrangement /top-graded.html has.
The first makes no request at all and could be, but the second is 176 requests
against somebody else's server and a scheduled build must not depend on a step
that is not scheduled.

**WHAT THESE CARDS ARE, because it is the whole page and it is easy to get
wrong.** Topps printed Pokemon TRADING cards under license: anime and film
stills on card stock, no HP, no attacks, nothing to play with. They are not
Pokemon TCG cards. Bulbapedia states it in one line and /topps.html quotes it
rather than paraphrasing. PriceCharting files and prices them under Pokemon
anyway, which is why 13 of /most-valuable-cards.html's hundred and 3 of
/top-graded.html's are Topps rows, and why both those pages now explain them and
link here.

**THE COUNT IS TWELVE SETS AND IT IS ELEVEN IN THE STATES.** Johto Series 3 was
Europe only. An early draft of build-topps.mjs said eleven in four comments,
because eleven is the length of the US list the page renders first and the
twelfth sits under its own heading below it. Every count either page PRINTS
comes off `releases.length`, which is why the pages were right while the
comments were wrong. Count before writing a number here.

**THE TAXONOMY TRAP, AND IT IS THE THING MOST LIKELY TO BE WRONG ON THESE
PAGES.** Topps shipped 12 sets. PriceCharting files 33 Pokemon "consoles" with
Topps in the name, and those are card TYPE buckets rather than releases: a set's
die-cut chase run gets its own bucket, and where two sets shared a card type the
two are merged into one. `2000 Topps TV Heroes & Villians` holds HV1 to HV17,
which is series 2's five Heroes & Villains cards and series 3's twelve, and
Topps never released a set by that name. A page that prints those bucket names
as set names tells a reader Topps released a set called Heroes & Villains.

So `data/topps-sets.json` maps each bucket to the release it came out of, a
human wrote it with a Bulbapedia url on every fact, and most of those claims
carry an `expect` block: the shape our own crawl must have if the mapping is
right. `checkMapping()` in build-topps.mjs recomputes all 30 on every build and
THROWS on a mismatch, same call build-decks.mjs makes on its set-code map.
19 OR-prefixed numbers where Bulbapedia says series 3 had 19 Orange Islands
episode cards; 151 numbers from 1 to 151 where Chrome Series 1's 78 plus Series
2's 73 is 151; 62 numbers from 152 to 249 for Johto series 1's 62 Pokemon cards.
**Do not edit an `expect` block to make a failing build pass.** Six buckets
deliberately carry no check, because our count and Bulbapedia's did not line up
exactly and no check was invented to make them; those print no count at all.

**ROWS PER SET IS PRODUCT RECORDS, NOT CARDS,** and this is the easiest number
to publish wrongly here. 2000 Topps Chrome is 604 rows and 151 numbered cards,
because the plain card and its Sparkle, Tekno and Spectra parallels are four
products against one collector number. 151 x 4 = 604 exactly. Both numbers are
computed and both are labeled as what they are, and neither is a print-run
fact: nothing sourceable publishes one, so the page states none.

**TWO RANKING COLUMNS, WHICH NO OTHER FILE ON THIS SITE HAS.** /most-valuable
-cards.html ranks by Ungraded and /top-graded.html by PSA 10; this file feeds
both lists off one corpus, so both are ranking columns and Grade 9 is the only
decorative one. verify-topps-top.mjs sets a row's `status` to "disagree" when
EITHER ranking column disagrees, so both stop the build through
shared/graded-gate.mjs; a Grade 9 disagreement suppresses that one figure and
the row says so. build-topps.mjs then gates each list on ITS OWN column, so a
card whose raw price confirmed and whose PSA 10 did not appears on one list and
not the other. `rank` in that file is an IDENTIFIER, the row's position in the
union of the two candidate windows, and nothing may sort by it.

**BOTH HUNDREDS ARE ON ONE PAGE AND THAT WAS THE DECISION.** They rank the same
2,701 products and the two windows share 54 rows, so two pages would be 47%
identical, each having to explain the other. Both lists are server rendered one
after the other, NOT behind a JavaScript toggle: a list hidden behind a button
is a list a reader with no script never sees. It costs page height, 45,688px at
390x844, and 200 lazy card scans: 459.6KB on load against 2,472.6KB fully
scrolled. Quote the pair or quote neither.

**Verification, 18 August 2026:** 170 of 176 agree, 6 disagree, 0 unreadable, 1
missing a scan and it is below both cuts. All six reconcile exactly against
PriceCharting's own reported change and are recorded in `excluded` with the
working. Across all 176 rows and all three columns, 409 readings are identical
and the other 47 all reconcile, with NONE left over, so the column mapping is
demonstrably right on every row.

**Two bugs found here that apply everywhere.** PriceCharting says "no scan" by
serving a RELATIVE placeholder, `/images/no-image-available.png`, and
`fetch()` throws ERR_INVALID_URL on it: the first verify run died 154 rows into
176. sync-topps-top.mjs nulls anything that is not absolute and the verifier
guards it again. And a grid item's default minimum is its MIN-CONTENT width, so
one 45 character url in a `<code>` widened a `.tp-defs` track and then the whole
page to a scrollWidth of 434 at a clientWidth of 390. **The page still did not
scroll sideways**, so the site's own overflow test passed it; `min-width:0` plus
`word-break:break-all` is the fix and 44px of content hanging off the right edge
is a real fault whether or not the document scrolls to meet it.

**WHY THERE ARE TWO PAGES AND NOT ONE, since this is the first question anybody
merging them will ask.** The guide is prose and the rankings are 200 rows, read
by the same person at different moments. 100 PriceCharting rows is around
20,000px on a phone, so one page would bury the set list under 40,000px of table
or the table under a guide. The argument for NOT splitting it further, into a
raw hundred and a graded hundred the way /most-valuable-cards.html and
/top-graded.html are split, is the one worth keeping: those two rank two
DIFFERENT catalogues and barely overlap, while these two rank the SAME 2,701
Topps products and share 54 rows, so the third page would be 47% a copy of the
second. The full version of both arguments is in build-topps.mjs's header.

**WHERE THE SET FACTS COME FROM, and it is not the crawl.** Set names, dates,
card counts and what each subset is are Bulbapedia's, read by hand into
data/topps-sets.json with a url on every claim, one page per set. PriceCharting
supplies only prices, scans and the bucket shapes the mapping is checked
against. The two are deliberately separate: a bucket is a card type and a
release is a product, and the whole `expect` machinery above exists because
those two taxonomies do not line up.

**WHAT IS DELIBERATELY ABSENT FROM BOTH PAGES.** No pull rates and no pack odds:
Bulbapedia states insert odds for several of these sets, they were read and
deliberately NOT recorded, and data/topps-sets.json says so, so there is nothing
in the tree to emit by accident. No print run totals, because nothing sourceable
publishes one and "not many were printed" is exactly the shape of claim this
site does not make. No named licensing counterparty: who Topps signed the
Pokemon license with is not stated by any source we reached, so the page says
the cards were licensed and stops. And no outbound link on a price row, which is
the open call recorded in the sixth exception above.

**NOBODY SAYS "DEAREST", and this cost a day of the launch week.** Both pages
shipped describing "the 100 dearest Topps Pokemon cards", in the h2s, the lede,
the meta description and the og:description. Tim read his own page and said "not
sure why it says the dearest cards ... not sure what dearest means". It is
British English for "most expensive", it is an agent's vocabulary rather than
the site's, and it is worthless for search on top of that: nobody types "dearest
Pokemon cards". Both pages now say "most valuable" and "highest PSA 10 values",
matching /most-valuable-cards.html and /top-graded.html so the four value pages
read as one cluster. The meta and og descriptions were the important half,
because they are the copy Google shows. If you find the word on another page,
the fix is the same one.

**/topps.html SHIPPED WITH ZERO IMAGES AND THAT WAS THE WORST THING ABOUT IT.**
A guide whose entire pitch is "most collectors have never knowingly held one of
these" cannot work without showing one, and the pictures were already in the
tree: /topps-card-values.html had 200 card scans off the same data and the guide
was simply not asking for them. Fixed 18 August 2026. There are 32 pictures on
it now, and the DENSITY is the decision rather than the maximum:

  - ONE hero card, and it is the only picture on the page that is not lazy.
  - The two five-row summaries carry the card on every row.
  - ELEVEN release cards and EIGHT packaging photographs, NOT 33 of anything.
    PriceCharting's 33 consoles are card TYPE buckets and Topps shipped TWELVE
    releases, which is what the set list renders; a thumbnail per bucket would
    have put 33 pictures into a list of 12 cards and taught the reader the wrong
    taxonomy while it did it.
  - The side by side in "how to tell a Topps card from a real TCG card", which
    is the one section where prose genuinely cannot do the job. Topps Charizard
    #6 against Base Set Charizard, same Pokemon and same year on purpose, so the
    only thing varying between the two frames is the thing being compared.

Measured at 390x844 DPR 2, gzipped, cache off: **130.5KB on load and 130.5KB
fully scrolled before, 147.8KB on load and 559.2KB fully scrolled after.** So
the load path grew by 17.3KB, 13.4KB of which is the hero, and everything else
is deferred. QUOTE THE PAIR OR QUOTE NEITHER, as everywhere else here.

**THE PACKAGING CAME FROM DROPPING ONE QUERY PARAMETER, and this is reusable.**
This file says the PriceCharting crawl "holds essentially no sealed product",
which is true of the CACHE and not of the source: sync-graded-top.mjs requests
every console with `exclude-hardware=true`. Drop it and the same console pages
carry the booster packs and boxes with their photographs. That is where the only
picture of a 1999 Topps wrapper in this repo comes from; TCGplayer does not
carry these products at all and shared/product-photos.mjs is per modern
expansion. Those pages cache separately under `.cache/pricecharting-topps-sealed`
so the price crawl is untouched. **NOT ONE PRICE COMES OFF THEM AND NONE MAY:**
they have been read ONCE, and nothing out of PriceCharting is publishable on this
site on a single read. Only the product name and the photograph are taken.

FOUR RELEASES HAVE NO PACKAGING PICTURE and they show a card and say nothing
about packaging, rather than an empty frame captioned "no photo": Johto Series 3
(Europe only, and PriceCharting files no bucket for it at all, so it has no card
either), Johto League Champions, Advanced and Advanced Challenge. Nothing was
borrowed from a neighbouring set to fill a hole.

**EVERY PICTURE IS PINNED BY PRODUCT ID, CHECKED BY NAME AND FETCHED BEFORE IT
SHIPS.** sync-topps-images.mjs holds the pins, refuses any whose name has
drifted (the id now points at something else, and a wrong card here is worse
than no card: these are four Chrome finishes of one collector number and a
reader cannot tell they were shown the wrong one), and GETs every url. Only a
200 with a real image body sets `ok`; build-topps.mjs emits no `<img>` at all for
anything else. **404 IS NOT THE TEST.** PriceCharting's CDN answers **403** for a
card it holds no scan of, so a 404 check proves nothing, and an earlier agent on
this site shipped a stand-in that 403ed. All 22 fetched urls answered 200 on
18 August 2026, and all 32 images on the built page were confirmed with
naturalWidth > 0 in headless Chrome at 390x844 DPR 2 and 1440x900 DPR 1.

**NO WIDTH OR HEIGHT ON A PRICECHARTING SCAN, and the boxes are pinned in CSS
instead.** That host serves a fixed 240 HIGH and a VARIABLE width, exactly like
tcgplayer-cdn under "Card images" above, which is why imgDims() correctly
returns "" for it. Every frame on the page is a fixed box with the picture
centred inside by object-fit, and CLS measured 0.000 on a clean load at both
widths. The one image that CAN carry dimensions is the TCGdex half of the
comparison, which also gets avifPicture().

ONE RULE WAS FOUND BY LOSING TO IT: ui.css sets `.set-hero .wrap` to
`display:flex` at specificity 0,2,0, so a single-class rule in a page's own
`<style>` block cannot change it however late it appears. A two-column hero was
written, was correct, and silently never rendered. If a layout in a page-level
block does nothing, check what ui.css already says about that element with a
longer selector before rewriting the markup.

## The Garbage Plate page

`/garbage-plate.html`, added 20 August 2026 on Tim's ask, built by
`scripts/build-garbage-plate.mjs` from `data/garbage-plate.json`. One builder,
one data file, no sync step and no network: everything on the page was read by a
human and written into the JSON with the source and the read date beside it.

**WHY IT EXISTS, in Tim's words:** "I think there is really some good SEO juice
to be had with a dedicated Garbage Plate informational page built out, not a ton
of great places to get good garbage plate info". Same instinct that produced the
First Partner guide: he spotted thin coverage and asked for the page that fills
it. The channel is named after the dish and the site had no page about it.

**THE LEVER IS TRACEABILITY, NOT KEYWORDS,** and that is the whole design. What
exists elsewhere is listicles and a half-remembered origin story repeated from
page to page with no source on any of it. So every factual claim here carries
the source it came from and the day it was read, the page prints its `sources`
list in full at the foot, and it prints `notSourced` as well: five things that get
repeated about this dish and could not be sourced, said out loud rather than
dropped quietly. Saying what you do not know is itself a reason to trust the
rest, and it stops the next editor re-researching the same six dead ends.

**TWO OF THE SOURCES ARE PRIMARY AND THEY CARRY THE PAGE.** The USPTO's TSDR
record for serial 74189085 is the trademark file itself, which settles dates the
food writing keeps getting slightly wrong: filed 29 July 1991, registered
18 August 1992, registration 1,708,448, still live. And Nick Tahou Hots'
printable fax order form is the business listing every component of its own
plate as boxes you tick, which is where the diagram's six layers come from.
**Do not replace either with a secondary retelling.**

**THE FOUNDER IS GENUINELY DISPUTED AND THE PAGE SAYS SO** rather than picking a
winner. Nick Tahou Hots' own site quotes Wikipedia saying Nick Tahou founded it;
Wikipedia's article today says Alexander Tahou founded it and named it for his
son Nick. Eater's 2017 feature and the Democrat and Chronicle's 2020 piece are
cited by Wikipedia for this and neither could be fetched. If a later editor can
read them, that is the claim to settle, and it is the only one on the page left
open.

**THE DIAGRAM IS THE ASSET AND IT IS OURS.** `plateDiagram()` in the builder: a
labeled drawing of a plate, a bigger relative of `plateMark()` in
shared/format.mjs, sharing its china (`var(--ink)`) and its six food colours so
the site reads as one hand. It is the one thing on this subject that does not
already exist somewhere, so it is the thing most likely to earn a link. Three
rules held it together and all three were measured rather than assumed:
- **The colour carries none of the meaning.** Every layer is numbered in a
  high-contrast disc and every layer has its own TEXTURE as well as its own
  fill: elbow curls, chunk outlines, specks, square flecks, a zigzag. Verified
  by rendering the whole page under a greyscale filter; all six still read.
- **The words are HTML, not SVG text.** At 390px the figure draws at 0.56, so 16
  units is 9px. The drawing carries numbers only and the labels sit in an
  ordered list beside it at real body sizes. That is /shops.html's hours-chart
  lesson taken the first time instead of the third. **THAT CHART WAS DELETED ON
  20 AUGUST 2026** on Tim's call, because every shop card already printed its own
  hours in full and the grid said the same thing a second time in a second shape.
  The lesson it taught about type sizes in a scaled SVG outlived it, which is why
  this bullet still names it; the shop map that remains puts its six labels on
  opaque plates for the same reason.
- **The first version was a striped MOUNTAIN and had to be rebuilt.** Five bands
  inside one silhouette read as sedimentary rock. A plate is wide and low, and
  the things on it are objects lying on each other: the mound is the SIDES, the
  meat is drawn on top and allowed to overhang the outline, the sauce is a
  poured shape with its own hem and its own drips.

**THE RESTAURANT LIST FOLLOWS data/shops.json'S POLICY ALMOST EXACTLY** and the
one rule that matters most is the same: **hours are not published unless the
BUSINESS states them about ITSELF.** Eight of the eleven do; the other three
carry a line saying plainly that they are not confirmed and why, because a quiet
blank reads as "no hours" and the cost of being wrong is somebody driving across
Rochester to a locked door. Yelp, Google, TripAdvisor and the directories are
not evidence and are not used once. `checkedAndLeftOut` records six places that
appear on other people's lists and could not be confirmed from the business,
including one that does not exist and one whose own site is now a placeholder.
**It is a list and not a ranking:** Nick Tahou Hots is first because it is the
originator and holds the mark, which is a matter of record, and the rest are
alphabetical.

**THIS SECTION SAID "THERE ARE NO PHOTOGRAPHS ON IT AND THAT IS DESIGN, NOT AN
UNFINISHED STATE" AND THE SENTENCE UNDER IT WAS THE MISTAKE.** It read: "This
repo holds no licensed photograph of a building or of a plate, a picture of a
restaurant is somebody's copyright, and Street View is licensed in a way a
static site with no keys cannot meet." Every clause of that is TRUE. The
conclusion was not, and the shape of the error is the one this whole file is
about: **a true statement about the candidates somebody looked at was written as
a statement about the subject.** Restaurant sites, blogs and Street View had
been checked. Wikimedia Commons had not. It holds eleven photographs of this
dish and of the restaurant it comes from and **ten of them are CC BY, CC BY-SA
or public domain.** The gap was a search, not a license. If you find a page on
this site whose absence of something is defended in this register, check whether
the defence names what was LOOKED AT or what EXISTS.

**THERE ARE TEN PHOTOGRAPHS ON IT NOW, 20 August 2026, AND EVERY ONE WAS
VERIFIED BY LOADING THAT FILE'S OWN DESCRIPTION PAGE ON COMMONS.** A search
result claiming a license is not a license. They are: four by Paul Lowry (CC BY
4.0, 28 June 2025: the plate, two plates on a tray, the exterior, the counter),
two by BanjoZebra (CC BY 4.0, 2024: dogTown's plate and The Red Fern's Compost
Plate), two by Eugene Peretz (CC BY-SA 2.0, 20 October 2007: a plate with beans,
and the "Established 1918" wall sign), one by Doug Kerr (CC BY-SA 2.0, 6
December 2008: the terminal building from West Main Street) and one public
domain (May 2005, the mark printed round the rim of the plate).
**AN ELEVENTH WAS ADDED THE SAME DAY and it is the first restaurant on this
page that is not Nick Tahou's, dogTown or The Red Fern:** DanielPenfield's
`File:Bill Gray's flagship location.jpg`, **CC BY-SA 3.0**, 19 June 2011, the
Henrietta shop from its own car park. It is also the first CC BY-SA **3.0** file
here, which cost nothing: `photoFig` reads the license name and url off the
record and the guard compares them to Commons, so a new license value needs no
code. See the correction at the foot of this section for how it was missed.
`scripts/sync-plate-photos.py` fetches and encodes them and **re-reads the
license, the author and the license url from Commons on every run and refuses to
write anything that has moved.** It is NOT in build-all.mjs, same arrangement
and same reason as sync-decks.mjs. Masters cache under `.cache/plate-photos/`
and are not committed; the 46 renditions in `public/assets/plates/` are,
1.97MB on disk in the two formats.

**THE VISIBLE CREDIT IS A PRECEDENT THIS SET, because the site had none.** The
retailer marks in shared/brands.mjs are all public domain and are credited in
JSON only, which is fine for those and not fine for an attribution license. CC
BY and CC BY-SA require the photographer's name, the license, and a LINK to that
license, and a credit a reader cannot connect to the picture is not a credit.
**So every photograph is a `<figure>` whose `<figcaption>` carries the caption,
then "Photograph by NAME, LICENCE, via Wikimedia Commons", with NAME linking to
the file on Commons and LICENCE linking to the deed.** `photoFig` in the
builder. The builder THROWS on a photo record that names an attribution license
with no `licenseUrl`, and on a `where` key that matches no section, history
entry or restaurant, because a picture that quietly fails to render looks
exactly like a card that was never given one. **If another page gains a
non-public-domain image, copy this shape.**

**NOTHING IS CROPPED AND THAT IS A LICENCE DECISION, NOT A TASTE ONE.** Five of
the eleven are ShareAlike, which asks that an ADAPTED work carry the same
license. Resizing and re-encoding for delivery is not an adaptation (CC 4.0 says
so; 2.0 and 3.0 grant "modifications as are technically necessary to exercise
the rights in other media and formats"). Cropping is. The four restaurant-card
frames want 4:3 out of four different shapes and get it with `object-fit:cover`,
which changes what is DISPLAYED and not what is distributed.

**THE RESTAURANT ATTRIBUTIONS CAME OUT OF THE FILES THEMSELVES AND WERE
CORROBORATED, NOT GUESSED.** `Junkyard Plate.jpg` and `Compost Plate.jpg` both
name their restaurant in their own Commons description ("from Dogtown in
Rochester, New York", "at The Red Fern in Rochester, New York"), and both files
carry a camera position that reverse-geocodes to that address: 43.1439/-77.5898
is Monroe Avenue in Swillburg, 43.1498/-77.5864 is 283 Oxford Street.

**THIS PARAGRAPH USED TO END WITH A TRAP THAT WAS ITSELF THE TRAP, corrected 20
August 2026.** It read: "dogTown's own menu carries a Junkyard Dog and a section
of plates and no 'Junkyard Plate', so the page shows the photograph on their card
and does NOT print that as their name for the dish." That is false. Fetching
dogtownhots.com/meaty-menu/ returns section headings **Junkyard Plates** and
**Junkyard Dog Plates**; the full list is Specialty Dogs, More Dog Stuff,
Sandwiches, Toppings, Pup Plates, Junkyard Plates, Bowls, Sides, Junkyard Dog
Plates. The photographer's title was right and the page was contradicting a
correct attribution in print, on the strength of a menu nobody opened.

The precision that IS true and is what the page now says: the words are a SECTION
heading, not an item. dogTown's individual plates are Dog Plate, Cheeseburger
Plate, Split Plate, Sausage Plate and halves -- no single line reads "Junkyard
Plate". So dogTown's collective name for the dish is Junkyard Plates, and no dish
on their menu is called one. `placeNote` in the data records both halves.

**EVERY ONE IS `loading="lazy"`, INCLUDING THE HERO, AND THAT WAS MEASURED
RATHER THAN COPIED FROM THE NOTE UNDER "Card images".** Slow 4G, 4x CPU, over
HTTP/2 against a local TLS server (an HTTP/1.1 preview's six-connection ceiling
flatters the wrong answer), medians, against the same tree with the hero lazy
and with it eager under `fetchpriority="high"` plus an `imagesrcset` preload in
the head:

      390x844  DPR 2, 5 runs   FCP 2,484 -> 3,148ms    LCP 2,484 -> 3,148ms
      1440x900 DPR 1, 3 runs   FCP 2,504 -> 3,060ms    LCP 2,504 -> 5,716ms

So eager costs 664ms of first paint on a phone and 556ms on a desktop, and on
the desktop it costs **3.2 SECONDS of LCP**, because making the picture eager is
what makes the picture the LCP ELEMENT: it has to finish arriving before the
metric stops. **Lazy, the LCP element is `P.gp-lede`, a paragraph, in every run
at both widths.** That is the reason that file's "the LCP element wants the
scanner and a preload of its own" exception does not apply here, and it is worth
knowing before somebody re-derives it from the markup: the hero photograph is
never the largest paint on this page unless you make it one.

**Measured on the built page, 20 August 2026, before -> after the photographs.**
The before column is what this entry used to carry, re-measured with the same
harness against the same tree so the pair is comparable: gzipped, cache off,
request bytes read off the network, fully scrolled means every lazy image
reached. **QUOTE THE PAIR OR QUOTE NEITHER.**

                        on-load            fully scrolled     page height
      390  DPR 2   137.6 ->  208.0KB   137.6 ->  695.7KB   18,596 -> 23,278px
      390  DPR 3   132.9 ->  262.9KB   132.9 ->  750.7KB   18,596 -> 23,278px
      1440 DPR 1   132.9 ->  258.7KB   132.9 ->  611.2KB    9,533 -> 14,223px
      1440 DPR 2   132.9 ->  398.1KB   132.9 ->  750.7KB    9,533 -> 14,224px

The document itself is **89,918 -> 108,366 bytes raw and 24,371 -> 28,590
gzipped**, so 4.2KB of the phone's 70.4KB is markup and the rest is one
photograph. **ONE picture is on the load path at 390** (the hero, at y=638 of
844, so it is genuinely in the first screen) and three at 1440, where the
anatomy pair falls inside Chrome's lazy window. Requests 11 -> 12 on load and
11 -> 21 fully scrolled. **The old entry's "its on-load and fully-scrolled
transfer are the same number" is the sentence that has stopped being true**, and
that is the cost of this change stated honestly: nothing was made lighter, a
page that had no pictures now has ten.

Still true at both widths after: one h1, scrollX 0, **zero elements hanging off
the right edge with no clipping ancestor**, all eleven images decode with
`naturalWidth > 0`, and **0 AA contrast failures** over the captions, the credit
lines and the prose around them, measured against the ground actually painted
under each. No text is set over a photograph anywhere on this page, which is why
that last one is cheap to keep true.

**AND THE ELEVENTH PHOTOGRAPH'S OWN PAIR, measured 20 August 2026 with ONE
harness over BOTH trees so the two columns are comparable to each other and NOT
to the table above.** The before column here is this same tree with the Bill
Gray's record removed and its four renditions deleted, not the numbers printed
above, which were taken against an older tree and no longer reproduce (that
tree's page was 23,278px at 390 and this one is 24,461px before the change).
**QUOTE THIS PAIR OR THE ONE ABOVE, NEVER ONE COLUMN FROM EACH.** Gzipped,
cache off, bytes read off the network, fully scrolled means every lazy image
reached:

                        on-load            fully scrolled     page height
      390  DPR 2   209.0 ->  210.7KB   715.8 ->  758.9KB   24,461 -> 26,325px
      390  DPR 3   259.2 ->  260.9KB   766.0 ->  809.2KB   24,461 -> 26,325px
      1440 DPR 1   255.0 ->  256.7KB   626.5 ->  669.7KB   14,926 -> 15,534px
      1440 DPR 2   394.4 ->  396.1KB   766.0 ->  809.2KB   14,926 -> 15,534px

**THE LOAD PATH MOVED BY 1.7KB AT EVERY WIDTH AND THAT IS THE WHOLE POINT.** The
document goes 113,051 -> 118,520 bytes raw, so 1.7KB is the gzipped markup of
one more `<figure>`, and the picture itself costs nothing until somebody scrolls
to it: requests on load are 12/11/13/13, unchanged, and the card is far enough
down that no width pulls it early. Fully scrolled it is **+43.2KB at every
width**, which is the 800w AVIF at 41.3KB plus its markup, and it is 800w even
at DPR 1 because the card frame declares 408px and the 400w candidate is four
pixels short of it. That is the same choice the other three place photographs
make and is why `maxw` is 800 here rather than 1200.

**`maxw` IN THE DATA IS A PLACEMENT CAP AND IT IS LOAD BEARING.** The hero is
drawn into a 720px cap so a retina desktop asks for 1440 and needs the 1200w
file; nothing else on the page is drawn wider than 408 CSS px, where 800w
answers DPR 2 exactly. Without the cap the 1200w exterior, **206KB of AVIF
because brickwork does not compress**, was the candidate a DPR 3 phone picked
for a 318px card frame. The history photograph is separately held to 480px
inside its 640px card, because two of those four are 1024px originals from 2007
and 2008 that cannot be rendered any bigger: at 640 a retina screen asks for
1280 against an 800w file, at 480 it asks for 960. It also took about 1,000px
off the page at 1440.

**EXIF ORIENTATION IS APPLIED AND ONE FILE NEEDED IT.** `Garbage Plates, Nick
Tahou Hots 2025.jpg` is stored 4080x3060 with an orientation tag of 6, so
Commons reports it as 3060x4080 and Pillow opens it on its side. Resizing
without `ImageOps.exif_transpose` ships a photograph rotated a quarter turn with
correct `width` and `height` attributes on it, and nothing in the build can see
that. It was caught by comparing Pillow's size against the API's, not by looking
at the picture.

**THAT PARAGRAPH SAID "EIGHT OF THE ELEVEN RESTAURANTS STILL HAVE NO
PHOTOGRAPH AND NO FREE ONE OF THEM EXISTS", AND THE SECOND HALF WAS THE SAME
MISTAKE THIS SECTION ALREADY CONFESSES TO ONE PARAGRAPH ABOVE.** It is now
SEVEN of the eleven, corrected 20 August 2026. `File:Bill Gray's flagship
location.jpg`, **CC BY-SA 3.0, DanielPenfield, 19 June 2011**, is a clean
storefront photograph of a Bill Gray's and had been sitting on Commons the
whole time. The first sweep searched Commons for the DISH and for Nick Tahou
Hots and did not search it for the other ten BUSINESSES BY NAME. So the file
that fixed the "eight" was in the same repository that had already fixed the
"none", found by the same kind of query nobody had run yet, and the sentence
claiming none exists was again **a report on what was looked at, written as a
statement about what is out there.** That is twice on one page. Assume it is
still true of the seven.

**THE SEVEN ARE Chili Hots, Empire Hots, Fairport Hots, Henrietta Hots,
Jeremiah's Tavern, Rohrbach and Steve T. Hots, AND THE SECOND SWEEP IS WRITTEN
DOWN IN `photosRejected` SO NOBODY PAYS FOR IT TWICE.** Commons was swept four
ways (title, `insource:` over every file description, the seven local
categories, and a 1,500m GEOSEARCH around all eight addresses) and holds exactly
two files naming any of them, both Bill Gray's. Openverse, which is Flickr and
Commons together, was swept across forty queries filtered to CC BY, CC BY-SA,
CC0 and public domain: six of the seven return **nothing free at all**, and what
exists of them on Flickr is uniformly NonCommercial or NoDerivatives.

**A THIRD SWEEP ON 20 AUGUST 2026 TOOK THE TWO ROUTES NEITHER OF THE FIRST TWO
HAD, AND THEY CAME BACK EMPTY AS WELL. It is still seven.**
- **Wikidata `P18`.** Only three of the eleven have a Wikidata item at all
  (Nick Tahou Hots, Bill Gray's, Rohrbach), and a geographic query for
  businesses within 25km of Rochester returns 19 items and none of the other
  eight. Rohrbach's P18 is `File:RohrbachBeer1.JPG`, **public domain**, User:
  Brian Stiehler, 17 September 2010, a file nobody here had seen. It is
  correctly licensed and it is **the wrong building**, and that was settled off
  the PHOTOGRAPH rather than off its caption: hanging beside Rohrbach's own
  banner is a second sign reading DEEP DISCOUNT STORAGE, **127 RAILROAD ST**.
  This page's Rohrbach card is the Buffalo Road brewpub, 14.5km away, so this is
  the second Railroad Street photograph rejected here for the same reason.
- **KartaView**, the other open street-level library and the one that needs no
  token. It does hold Rochester: 101 frames within 300m of downtown. **The
  nearest frame to any of the seven is 312m** (Chili Hots), then 415m
  (Jeremiah's Tavern), and the other five have none inside 600m.

Commons and Openverse were re-run at the same time against fresh geocodes for
all seven, with `insource:` queries on each street NUMBER as well as each name
and a geosearch at 120m, 600m, 1,500m and 10km. **Not one geotagged Commons file
sits within 130m of any of the seven**; the closest is a school 132m from
Fairport Hots.

**THE FLICKR SWEEPS HAD A HOLE IN THEM AND CLOSING IT IS THE REUSABLE HALF OF
THIS.** Flickr filters by numeric license code and the first two sweeps passed
`4,5,7,8,9,10`. **That set omits 11 and 12, which are CC BY 4.0 and CC BY-SA
4.0**, so every earlier "nothing free exists" was measured through a filter that
could not see two free licenses. Re-run with `4,5,7,8,9,10,11,12` across all
seven names, all seven street names and a 1km geographic search around all seven
addresses: still empty. The negative holds and now holds for the right reason.
**If you sweep Flickr again, pass 11 and 12.**

**AND THE SHARPER NEGATIVE, which is worth more than "nothing exists".**
Photographs of these places DO exist and are not free, read off each result's own
license field: **Henrietta Hots by drpep, 2024, All Rights Reserved**, and about
nine Rohrbachs by pearwood, every one **CC BY-NC-ND**. Three prolific
free-license photographers of this region were cleared one at a time (Warren
LeMay, Random Retail, and Paul Lowry, who is already four of this page's eleven
pictures), and the complete upload lists of Commons' two most systematic Monroe
County contributors were dumped and searched: **4,529 files by DanielPenfield
and 5,000 by Andre Carrotflower, zero hits.** This is no longer an absence of
searching. **TWO THINGS ARE STILL GENUINELY UNCHECKED and both are named in
`photosRejected`:** Mapillary, for want of a token, and PICRYL, which answered
403 from behind Cloudflare all day.

**THIS FILE REJECTED MAPILLARY ON THE LICENSE AND HALF OF THAT REASONING WAS
WRONG. Corrected 20 August 2026, and the corrected version is in
`photosRejected` too, because it will be proposed again.** The sentence that had
to go is "states **no version number anywhere**". That is true of
mapillary.com/terms and it is FALSE about Mapillary. `mapillary.com/osm`, under
the heading "Rights for OpenStreetMap", says in as many words "Mapillary images
are available under an open license (CC BY-SA)" and links
`creativecommons.org/licenses/by-sa/4.0/`; and **Commons' own
`Template:Mapillary`, the template a Commons upload of a Mapillary frame is
built from, hardcodes `{{cc-by-sa-4.0}}` and credits the photographer's
USERNAME** linked to their Mapillary profile, not a logo. Both read on 20 August
2026, the template off its own wikitext rather than off its documentation. So
the default license is CC BY-SA 4.0, it carries a version, and a page states it.
**That was a report on ONE page written as a statement about the source, which
is the third time this page has produced that exact shape of error.**

**WHAT SURVIVES THE CORRECTION, checked this time rather than assumed.** Section
3 does grant CC BY-SA "unless we indicate otherwise" and does name CC BY-NC-SA,
and Mapillary's own API documentation lists every field an Image carries
(`creator`, `captured_at`, `geometry`, the `thumb_*` urls and so on) with **no
`license` field among them**, so the carve-out has nothing per-image to be
checked against. That is a gap in what the API publishes, not a gap in anybody's
search. Section 11 then says an image served from your own servers must be
attributed "by visibly displaying the **Mapillary logo** and linking back to the
Mapillary homepage or corresponding Mapillary image page", which is a condition
ON TOP OF naming the photographer rather than instead of it.

**AND THE THING THAT ACTUALLY STOPS IT IS NOT A LICENSE ARGUMENT AT ALL: THERE
IS NO API TOKEN.** Every `mapillary.com` address answers a generic Meta error
page from this repo's network, `graph.mapillary.com` answers "Invalid OAuth 2.0
Access Token" and `tiles.mapillary.com` answers 403, so there is no frame, no
photographer's username and no image page to be had. **The coverage figures this
entry used to quote (70 frames past Bill Gray's, 50 past Fairport Hots) could
NOT be re-measured on 20 August 2026 and must not be quoted as current.** A
token is free at mapillary.com/developer; put one in `.env` and this becomes a
real lead again instead of an argument.

Tim photographs things for a living and lives there, so his own pictures are
still the answer for the seven: add one to `photos` in the data with `where` set
to `place:<the name on the card>` and it renders. **Do not solve this by
hotlinking, and do not solve it from a restaurant's own site or social feed** —
that is the photographer's copyright whatever it is a picture of, and being good
publicity for the subject is not a license from the person who took it.
`photosRejected` records the four files that were verified, fetched, looked at
and left out anyway, and two of those four are the reason to read it: a Rohrbach
photograph that is correctly licensed but is an **interior door with twelve-year
-old opening hours painted on the glass**, on the page whose one hard rule is
that hours come from the business, and a second Rohrbach that is correctly
licensed and is **the wrong one of their two buildings**. A free license is the
first gate on this page and it has never been the only one.

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
  - **ONE ROW IS STILL DROPPED AND IT IS A TYPO IN THE SPREADSHEET.** The sheet
    says "Iono's Bellibolt" and Ascended Heroes lists "Iono's Bellibolt ex". We
    hold that checklist, so publishing the row anyway would print a card name no
    catalogue holds. The build says so on every run. **Fix it in the My Hits tab
    and re-import; do NOT edit data/hits.json**, which import-sheet.mjs rebuilds
    per video.

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

## Card images (measured, and two things here are counterintuitive)

**EVERY `sizes` ON THIS SITE WAS CHECKED AT DPR 2 AND SHIPPED AT DPR 3, AND
THAT IS THE ONE SENTENCE TO TAKE OUT OF THIS SECTION.** Fixed 21 August 2026.
`sizes` declares the CSS BOX, so the browser asks for box x DPR and picks the
first candidate that covers it. Every note below this line, and every builder
comment they came from, does its arithmetic at DPR 2 and stops. **The phone in
a restock line is DPR 3.** Nine separate placements were correct at DPR 1 and
DPR 2 and reached for the largest file on the ladder at DPR 3:

      page family              box    DPR2 pick     DPR3 pick before the fix
      /hall.html               120px  245w  ok      600w   79 scans
      set guides x41           88px   200w  ok      547x1000 JPEG  225 imgs
      /openings/ + 5 pages     88px   200w  ok      547x1000 JPEG
      /how-many-packs.html     88px   200w  ok      547x1000 JPEG   22 imgs
      /playlists/ x13          84px   200w  ok      547x1000 JPEG
      /what-to-buy.html        72px   150w  ok      547x1000 JPEG   23 imgs
      /msrp.html               64px   150w  ok      547x1000 JPEG   32 imgs
      /wanted.html             151px  310w  ok      600w   10 scans
      ETB price tables         48px   150w  ok      150w   the only safe one

**IT IS THE RUNG THAT DECIDES, NOT THE BOX, and reading the box is how the
64px row got filed as safe.** 64px is the SMALLEST box on the site that carries
a srcset, so it looks like the 48px tables that genuinely are safe. It is not:
48 x 3 = 144 and its rung is 150w, while 64 x 3 = 192 and its rung is also
150w. Check what the small candidate IS before deciding a box is fine.

**AND LOOK AT HOW LITTLE HEADROOM THE DPR 2 ROW HAS.** /hall.html declared
120px against a 245w candidate: 240 against 245, FIVE PIXELS. Any box wider
than 122px fires the same bug on the far more common DPR 2, and nothing in the
CSS looks wrong when it does. **Leave real headroom, and state the DPR you
checked at.**

**THE FIX ABOVE LEFT 2.47MB ON A DPR 3 PHONE, IN TWO PLACES, AND BOTH WERE THE
LADDER RATHER THAN THE DECLARATION.** Swept 21 August 2026, and the two causes
are worth keeping apart because only one of them looks like the bug above:

- **/msrp.html, 926.6KB, a MISSING RUNG.** `productSrcset()` had probed the CDN,
  written down that 150w, 200w and 400w are the three real widths, and then
  offered only TWO of them: the caller's own small rung and 400w. So a 150w
  caller got a ladder with a 2.67x step in it. A 64px box asks 192 at DPR 3,
  which is 42 past 150 and 8 SHORT of a file the CDN had all along, and all 32
  pins took _400w. **Every declaration on that page was correct**: `sizes` is
  64px, .ms-pic is 64px, and 400w genuinely is the smallest candidate ON THAT
  LADDER that covers 192. Re-probed before changing anything and 220, 240, 250,
  260, 270, 280, 300, 320, 350 and 360 are all still 403, so 150/200/400 is the
  whole ladder and it is offered whole now, from each caller's small rung up.
- **The twelve /openings/ pages, 1,604.6KB across 55 logos, a `sizes` THAT KNEW
  ABOUT ONE OF THE TWO BOXES.** `@media(max-width:560px)` drops the .op-sw plate
  from 116x42 to 88x34 so the row can go to two columns, and `setLogoTag` wrote
  its drawn width against the DESKTOP plate and then wrote it FLAT. A phone was
  told the logo is painted up to 1.32x wider than it is, on the density where
  that costs the most: 116 x 3 = 348 reaches the 955w, 892w, 806w and 483w
  masters where the real box wants 258 and the -sm.webp beside them is 318, 303,
  269 or 300. It is a media query in the stylesheet and a literal in the builder,
  which is the same shape as the eight-pixel gap above and just as invisible.

**87 PICKS MOVED AND EVERY ONE OF THEM IS AT DPR 3.** Zero at DPR 1, zero at
DPR 2, at 390 and at 1440, and /msrp.html is the only page that moves on a
desktop at all. Read off `currentSrc` at all three densities against two trees
served from two ports, 150 pages at 390 and 33 at 1440, the page list drawn from
a static scan of all 1,486 built HTML files (37,689 `<img>`, 228 distinct
class/ladder/sizes shapes) so the representatives are the whole surface and not
a guess. Bytes are the sum of the ACTUAL file sizes of the rungs taken:

                                DPR 1   DPR 2      DPR 3
      /msrp.html at 390          same    same    -926.6KB
      /msrp.html at 1440         same    same    -926.6KB
      /openings/ x12 at 390      same    same  -1,604.6KB
      /openings/ x12 at 1440     same    same       same

The markup cost is +234 bytes gzipped on /msrp.html and 124 to 195 on the
openings pages, and /what-to-buy.html pays 145 for a 200w candidate it never
takes below DPR 4. That is the price of offering the ladder whole rather than
per caller, and it is the same argument the 48px tables were already given.

**`naturalWidth` IS NOT THE RUNG AND A QA PASS BUILT A 958-IMAGE FINDING ON IT.**
With `w` descriptors the spec density-corrects it, so it hands back the `sizes`
value and every image on the site looks exactly the size it was declared to be.
Read `currentSrc`. Say which DPR.

**AND `getBoundingClientRect().width` IS NOT THE RUNG EITHER WHEN THE IMAGE IS
`object-fit:contain`.** The first pass over the openings logos flagged 39 of its
own fixes as under-serves, because it checked the chosen file against the 86px
LAYOUT box when contain draws most of those logos 51 to 79px wide inside it.
Re-checked against `min(boxW, boxH * w/h)` with the real pixel dimensions read
off disk: 222 reads at 390 and 1440 at DPR 1, 2 and 3, **zero under-serves**,
tightest headroom 1.042x (Pokemon GO, 154 device px wanted against 160 available)
against 1.023x on the desktop rows, which is pre-existing and untouched.

**IT IS A REAL PICTURE CHANGE AND SAYING SO IS THE POINT.** /msrp.html's pins
were being handed 400 pixels for a 192 pixel box, so the browser was
supersampling 2.08x and the result was CRISPER than a correctly sized image can
be. Screenshotted element-exact at 390 and 1440 at DPR 3, before against after:
PSNR 28.5 and 24.9 dB over two pins, mean absolute Laplacian 9.8 -> 5.2 and
14.1 -> 5.8. Nothing is blurred -- 200 real pixels cover a 192 pixel box -- but
a 64px thumbnail that used to be drawn from four times its own area now is not.
The precedent is /topps-card-values.html three entries down, which ACCEPTED an
11% short pick rather than put a megabyte back on a phone; this one is 4% long.

**TWO OF THE FOUR REPORTED OVER-PICKS WERE MEASURED AND ARE NOT FIXABLE, and
one of them would have made the page HEAVIER:**

- **/rarity.html's twelve 96px ladder cards are RIGHT to carry no `sizes`.** The
  report called this the worst and the simplest of the four. Every one of those
  twelve urls is ALSO the source of a 600px magnified crop in the same row, which
  is exactly what CROP_CARDS in build-rarity.mjs exists to protect, and it was
  checked from the DOM rather than from the markup: 12 of 12 shared, at DPR 1, 2
  and 3. Give them a 245w/600w ladder and DPR 1 and DPR 2 fetch the low file for
  the card AND the high file for the crop: **637.3KB and 12 requests becomes
  808.9KB and 24**, +171.6KB, and DPR 3 does not move at all because 96 x 3 = 288
  clears 245 anyway. Do not "fix" it.
- **/what-to-buy.html's 1.85x IS THE LADDER'S GRANULARITY, not a declaration
  bug.** .wtb-pic is 72px, which asks 216 at DPR 3, and 200w is 7.4% SHORT of
  that while the next real file is 400w. Nothing between them exists. The prize
  is real but it needs data this repo does not keep: those photographs are
  `object-fit:contain` in a SQUARE box, so a portrait one is drawn narrower than
  72 and 8 of the page's 13 would fit 200w on their DRAWN width, worth 337.2KB.
  **THE OBVIOUS SHORTCUT IS WRONG AND THIS IS THE NUMBER THAT KILLS IT:** the
  file's own line above says tcgplayer-cdn runs "200x268 to 200x417", so a blanket
  0.746 factor looks safe. Fetched all 315 product photographs the site uses and
  measured them: **162 of the 315 are square or LANDSCAPE**, up to 200x88, and
  contain draws every one of those at the full box width. A per-image `sizes`
  needs a per-product dims file and a sync to keep it true, the way
  logo-dims.json and cover-dims.json already are, and its failure mode is silent
  blur. That is its own change, not a rider on this one.

Measured with one harness at 390x844 DPR 3, Slow 4G with a 4x CPU slowdown,
over HTTP/2 against a local TLS server, cache off, medians of 3. "on load" is
network-quiet with no scroll; "last picture" is when the last image a reader
gets without scrolling has arrived. **QUOTE A ROW, NEVER A COLUMN.**

                              on load          fully scrolled     last picture
      /hall.html          473.6 -> 232.4KB   4,520 -> 1,564KB   4,574 -> 3,359ms
      /msrp.html          488.2 -> 254.9KB   3,837 -> 1,565KB   3,756 -> 3,017ms
      /openings/          982.5 -> 500.9KB   1,277 ->   642KB   7,087 -> 4,661ms
      /wanted.html        986.1 -> 778.4KB   1,005 ->   797KB   7,093 -> 5,956ms
      /what-to-buy.html   508.2 -> 339.7KB   1,803 ->   839KB   4,432 -> 3,016ms
      /how-many-packs     140.8 -> 140.7KB   2,701 -> 1,003KB   2,873 -> 2,881ms
      /sets/chaos-rising  355.7 -> 355.7KB   1,638 -> 1,126KB   3,961 -> 3,938ms
      /openings/etb.html  410.3 -> 333.7KB     617 ->   541KB   4,002 -> 3,996ms
      /playlists/<one>    326.8 -> 287.0KB     346 ->   306KB   3,540 -> 3,381ms
      /about.html         164.4 -> 162.5KB     183 ->   181KB   2,827 -> 2,827ms

**NOTHING MOVED AT DPR 1 OR DPR 2 AND THAT WAS MEASURED RATHER THAN REASONED.**
`currentSrc` was read off every image on nine pages at all three densities,
before and after, against the two trees served from two ports: **0 candidate
changes at DPR 1, 0 at DPR 2, 181 at DPR 3**, all of them the intended ones.
Read `currentSrc`, never the markup. Settling a srcset argument by reading the
HTML is how this shipped.

**THE FIX IS ONE FUNCTION, `productSrcset()` IN shared/format.mjs, BECAUSE
SEVEN BUILDERS EACH WROTE THIS SRCSET BY HAND AND ALL SEVEN WROTE THE SAME
BUG.** It probes out to the rungs TCGplayer's CDN really has (150w, 200w, 400w
are real files; 250w, 300w, 320w, 500w, 600w and 800w all 403) and tops the
ladder at `_400w.jpg`. It THROWS for a box over 133px, because 400w is the top
of that ladder and a wider placement needs a decision rather than a silent soft
picture. **`_in_1000x1000.jpg` is off every ladder and is not coming back:** it
fits the photo inside a 1000x1000 square, so its real width is 547, 673 or 642
depending on the product and no single `w` descriptor is right for all of them.
That descriptor said 1000w for years.

**TWO PAGES WERE MEASURED AND DELIBERATELY NOT "FIXED", and both would have
been made WORSE for a phone by the obvious change:**

- **/topps-card-values.html**, 2,175KB fully scrolled over 200 hotlinked
  PriceCharting scans (156 distinct; 44 appear on both hundreds and are cache
  hits). There is no oversizing here. `.tp-art` is 64x90 CSS px and those files
  are a fixed 240 HIGH, so they are 2.67x: exactly right at DPR 2 and 11% short
  at DPR 3. PriceCharting publishes 60, 120, 240, 320 and 1600 and nothing
  between, and **320.jpg is 62% heavier than 240.jpg** (112,534 against 69,385
  bytes over six real cards from the page). Making DPR 3 exact would put over a
  megabyte back on the phone to fix an 11% softness nobody has reported. The
  page is heavy because it holds 200 pictures, not because they are big. The one
  real win left is DPR 1 only, `120.jpg` at a 1.33x descriptor for a 65% cut on
  a desktop, and this file's own rule is that a desktop number is a footnote.
- The **footer badge, the eleven Garbage Plate photographs, the fonts, the
  shops map and Chase Match's hotlink** were all left alone on the standing
  arguments recorded elsewhere in this file. None was re-opened.

**AND ONE PAGE WAS FIXED THE OTHER WAY, BY MAKING A WIDTH THAT DID NOT EXIST.**
/wanted.html was NOT the `sizes` bug: its box is 151px, so it asks 453 device
pixels at DPR 3 and 600w genuinely was the correct pick out of 245/310/420/600.
The answer there was a rung, and `sync-card-thumbs.mjs` already mirrors that
family, so it now writes a 460w one as well. Measured over the ten cards
through that encoder: 460w is 707,522 bytes against TCGdex's 883,293 at 600w,
**-19.9% at 3.05 device pixels per CSS pixel rather than 3.97**, so it is not a
downgrade. **520w was the tidier-looking width and it is the one to reject: it
would also cover 414 and 430px phones and it saves 2.9%,** which is that
script's own "Pillow only wins by dropping pixels" finding arriving somewhere
new. 414 and 430px phones keep the 600w on purpose.

**packs.css IS RENDER BLOCKING AND TWELVE PAGES CARRIED IT WITH NO PACK ON
THEM**: /about.html, /garbage-plate.html, /hall.html, /shops.html,
/wanted.html, /sets/index.html and six set guides whose set has never been
ripped on camera. 1,888 bytes gzipped, and a whole extra blocking round trip in
the window where ui.css and the fonts are already competing. `dropUnusedPacksCSS`
in shared/chrome.mjs takes it off a FINISHED page and is a no-op on any page
that has anything for it to style. **CONFIRM FROM THE BUILT HTML, NOT FROM A
COVERAGE TOOL:** coverage reported packs.css at 0% on a page that plainly
renders pack art, because the art is a background on a class it never sampled.
Verified in the runtime DOM instead, at 390x844 DPR 3, after app.js ran and
after dispatching a real click on every `/rip/` link on the page (80 of them on
/hall.html): 0 of packs.css's 25 class names on any of the twelve, with
/videos.html, /playlists.html, a ripped set guide and the home page as positive
controls. **THE HOME PAGE IS THE CONTROL THAT MATTERS** and it only fires after
a click, so a test that cancels the click in the CAPTURE phase suppresses the
thing it is looking for: packplayer ignores an event whose default is already
prevented. Cancel in a bubble listener on `window` instead.

Card scans come from four hosts and they do NOT behave alike. `imgDims(url)` in
`shared/format.mjs` holds the intrinsic sizes, all measured by fetching the
files, and every builder calls it rather than declaring dimensions by hand. A
blanket rewrite that assumed everything was a TCGdex `low.webp` once made 173
images wrong, including 16 that had been right.

  assets.tcgdex.net      low 245x337, high 600x825
  images.pokemontcg.io   245x342, _hires 733x1024
  images.scrydex.com     small 245x342, large 733x1024
  tcgplayer-cdn          VARIABLE, 200x268 to 200x417, so NO width/height

**TCGdex serves four FORMATS at each of its two widths, and avif is 35%
smaller than webp for identical pixels.** Same path, different extension. This
is easy to miss because the two WIDTHS are genuinely all there is, and a pass
that checked for a third width correctly concluded there was none and stopped.
`avifPicture()` wraps an img in a `<picture>` with the avif source and leaves
the webp underneath as the fallback. There is no middle width at any host:
`medium.webp`, `mid.webp` and `600.webp` all 404, and Scrydex ignores `?w=`.

**`loading="lazy"` IS A VERTICAL HEURISTIC AND NOTHING ELSE.** Chrome measures
how far an image is from the viewport DOWN the page. A slide parked 407px to the
right inside a horizontal scroll track is, by that measure, right next to you,
so every slide in a carousel fetches its artwork at first paint whatever
`loading` says. On the home page that was 289.9KB of pack art for slides behind
the band's right-hand edge, on a band that was itself below the fold: measured
at 390x844 with DPR 3, gzipped, cache off, the page was 804.9KB with 681.6KB of
pack art, and one pack was on screen. This is invisible from the markup, which
looks correct.

The fix is in `heroTile` in build-proto.mjs and `hydrateSlides` in
packplayer.js: slide 0 keeps a real `src`, later slides carry theirs as
`data-packsrc`/`data-packsrcset`/`data-packsizes`, and the script promotes them
when the TRACK is about to show them, one slide of lead on a swipe or an arrow
and none on load. It measures the real track rather than repeating ui.css's
breakpoints, because the visible slide count is 1 / 2.35 / 2.75 / 3.3 by width
and the Hall of Fame band overrides all of it with exactly 2. `loading="lazy"`
stays on the promoted image, so the vertical half of the decision is still the
browser's; this only takes back the horizontal half. Phone went 804.9KB to
515.1KB, pack art 681.6KB to 391.7KB. Desktop is unchanged by design and
measured to be: 800.2KB to 800.3KB at 1280, because at 1280 and 1920 those
slides are genuinely on screen and the hydration lands before first contentful
paint (70ms against 84ms at 1280). A `<noscript>` copy, laid over the box by
ui.css, is what a reader with JS off gets.

**Do not add a 700w rendition.** That was measured with the files actually
generated: 560w and 700w together save 302KB at 1280 and 1920 at DPR 1, and
NOTHING at DPR 2 or 3, because 810w is already the smallest candidate that
satisfies a 464px box on a retina screen. 700w was picked in exactly one case, a
DPR 2 phone, and 560w ALONE buys the entire 1x desktop win.

**560w WAS ADDED 16 AUGUST 2026 and the paragraphs below are what it cost and
bought.** `MID` in build-packs.py, 19 files and 1.42MB on disk, a third `w`
candidate in `heroTile` and in the Hall of Fame frame in build-proto.mjs. The
existing 400w and 810w files are byte identical after the regeneration, so the
encoder is deterministic and a re-run is not churn.

**AND THE 1x DESKTOP WIN IS BIGGER THAN THAT ENTRY MAKES IT SOUND, measured on
the home page 16 August 2026: EVERY pack request on that page takes the 810w
file, at every width and every DPR, and not one ever lands on the 400w tile.**
Logged from the network, cache off: 3 packs at 390 (DPR 2 and 3), 5 at 1280,
1440 and 1920 (DPR 1 and 2), all of them the full file, 125 to 158KB against
the tile's 40 to 52KB. The phone is right to: 340px at DPR 2 needs 680. The
DPR 1 desktop is not, and the reason is `sizes`, not the renditions.
`heroTile` declares `(max-width:640px) 87vw, 440px` while the real box measures
328px at 1280, 373 to 378 at 1440 and 391 to 408 at 1920, so 440 is over
declared everywhere above 640 and 440 at DPR 1 always beats the 400w candidate.
The honest figure would pick the 400w tile at 1440, worth about 380KB of a
799KB load. `sizes` IS STILL 440px AND WAS DELIBERATELY LEFT THAT WAY: an
accurate one needs the 1000/1200/1400 slide-count breakpoints written a second
time in build-proto.mjs (see the "NO MEDIA QUERY IN HERE" note in `heroTile`,
which is about exactly this) and it goes silently soft the day ui.css's counts
move. 560w wins at all three desktop widths with no breakpoints at all, which is
what makes it the right fix rather than the cheap one.

**THE 560w RENDITION FIXED THE DPR 1 HALF OF THAT AND NOTHING ELSE, re-measured
the same day with one harness, gzipped, cache off, against `.claude/server.js`'s
tree served with gzip on text.** Every figure below is an on-load number with no
scroll, and the fully-scrolled pair is beside it because they answer different
questions:

                          on-load            fully scrolled     pack file
      1280 DPR 1     807.7 -> 506.2KB    2166.9 -> 1864.4KB     810 -> 560
      1440 DPR 1     807.7 -> 506.2KB    2165.9 -> 1864.4KB     810 -> 560
      1920 DPR 1     949.0 -> 647.6KB    2165.9 -> 1864.4KB     810 -> 560
      1280 DPR 2     807.7 -> 808.6KB    2165.9 -> 2166.8KB     810 -> 810
      1440 DPR 2     807.7 -> 808.6KB    2165.9 -> 2166.8KB     810 -> 810
      1920 DPR 2     949.0 -> 950.0KB    2165.9 -> 2166.8KB     810 -> 810
       390 DPR 2     517.7 -> 518.7KB      986.5 -> 987.5KB     810 -> 810
       390 DPR 3     517.7 -> 518.7KB      986.5 -> 987.5KB     810 -> 810

VERIFIED FROM THE NETWORK, NOT FROM THE MARKUP: the picked filename was read off
the request log at every row. The +0.9 to +1.0KB on the DPR 2 and phone rows is
the third srcset candidate in the gzipped HTML, which is the whole cost of the
change to a reader it cannot help. Nothing about the phone moved, by design and
by measurement.

**SO A RETINA DESKTOP IS UNCHANGED BY 560w, AND THAT IS THE HALF THAT ENTRY KEPT
UNDERSELLING.** A 402px box at DPR 2 asks for 804 device pixels and 810w is the
smallest candidate that satisfies it, so 560w left a MacBook at 1440 pulling the
same 681.6KB of pack art it always had. If somebody reports a slow desktop and is
on a retina screen, 560w is not their fix and pointing at the table above will
mislead them.

**THE FIX FOR THAT CASE IS AVIF AND IT WENT IN THE SAME DAY, 16 AUGUST 2026.**
build-packs.py writes every rendition TWICE, .webp and .avif, and the three
places that emit pack art put the AVIF in front: `heroTile` and the Hall of Fame
frame in build-proto.mjs both go through `avifPicture()`, and packs.css carries a
plain `url()` followed by an `image-set()` for the pack wrapper, which is a CSS
background and cannot be a `<picture>`. 57 new files, 3.9MB on disk, and the
browser fetches one format or the other, never both.

Unlike a width, a codec shrinks whichever candidate the browser had already
chosen, so this is the one lever that pays at EVERY DPR. Measured with one
harness, gzipped, cache off, on-load with no scroll beside fully scrolled, and
the picked filename read off the REQUEST LOG at every row:

                          on-load            fully scrolled     pack file
      1280 DPR 1     501.8 -> 430.8KB    1861.1 -> 1790.1KB     560 webp -> avif
      1440 DPR 1     501.8 -> 430.8KB    1861.1 -> 1790.1KB     560 webp -> avif
      1920 DPR 1     644.3 -> 573.3KB    1861.1 -> 1790.1KB     560 webp -> avif
      1280 DPR 2     804.3 -> 662.2KB    2163.6 -> 2021.5KB     810 webp -> avif
      1440 DPR 2     804.3 -> 662.2KB    2163.6 -> 2021.5KB     810 webp -> avif
      1920 DPR 2     946.8 -> 804.7KB    2163.6 -> 2021.5KB     810 webp -> avif
       390 DPR 2     519.1 -> 431.9KB    1277.8 -> 1135.8KB     810 webp -> avif
       390 DPR 3     514.4 -> 427.2KB    1272.5 -> 1130.5KB     810 webp -> avif

Pack art on-load: 681.6 -> 538.8KB retina, 391.7 -> 303.8KB phone, 379.1 ->
307.4KB at DPR 1. The `<picture>` markup cost is 183 bytes gzipped on the whole
home page, so it pays 390 times over on the cheapest row.

**THERE IS NO SHARPNESS TRADE HERE AND THAT WAS MEASURED RATHER THAN ASSERTED.**
AVIF q60 is both SMALLER AND CLOSER TO THE MASTER than WebP q78, PSNR against the
same LANCZOS-resized source over the opaque pixels only: paradox-rift 810w
150.6KB/33.03 dB -> 123.1KB/34.21 dB, default 129.6KB/33.41 dB -> 96.9KB/34.46
dB. Rendered at 1440 DPR 2 and diffed, before against after, the Hall of Fame
frame is 39.5 dB and the carousel slide 38.2 dB, and mean absolute Laplacian
(a crude sharpness proxy) went UP slightly on all three elements screenshotted.
Do not read that as headroom: q55 drops BELOW the WebP's fidelity, and the pack
art is commissioned brand artwork.

**THE TRAP THAT COST A CACHE HIT, and it only shows up with the cache ON.** A
background image cannot be a `<picture>`, so when the `<img>` tags moved to AVIF
the pack wrapper that `playInTile` mounts on click was still asking packs.css for
WebP. On the home page that turned a free cache hit into a 124KB download on
every click: the tile fetched pitch-black-...pack.avif, the click asked for
pitch-black-...pack.webp. Logged from the network before and after a real
dispatched click. The `image-set()` in packs.css is what closes it, written as a
SECOND declaration after the plain `url()` so that a browser too old to parse it
drops that line and keeps the WebP; inverting those two would leave the pack a
flat #161D26 rectangle, because `.pack-art::before` and `.pack-brand` are
switched off in the same block.

**AND THE `<source>` ON A DEFERRED SLIDE HAS TO BE DEFERRED TOO.** A `<picture>`
whose `<source>` matches loads that source even when the `<img>` carries no src
at all, so a live `srcset` there would fetch every carousel slide at first paint
and put the phone back to 800KB in a new format, with the markup still looking
correct. `avifPicture(img, {defer:true})` writes the source's candidates under
the same `data-packsrcset`/`data-packsizes` names the img uses, and
`hydrateSlides` promotes the SOURCE FIRST, sizes before srcset, then the img.
Promoting the img first fails quietly: the source has no srcset yet, so the
browser resolves the img's WebP and commits to it. Verified from the request log:
3 pack files on load at 390 and 5 fully scrolled, all AVIF, none fetched twice.

The other lever named here was a lower WebP quality than 78. It is now moot for
anything that supports AVIF and was not done.

**/evolution.html GAINED 340 PICTURES AND THE COMMIT THAT DID IT CALLED THAT A
SAVING. IT IS NOT ONE.** 5b4e3028c says "the 1,025 species portraits gain a 96px
rendition, 3.98MB against 12.41MB, for /evolution.html's 340 line headings. That
page drew the 256px file 340 times." The library comparison is true. The
sentence built on it is false: before that commit the page carried ZERO species
images, and the commit ADDED 340. Measured at 390x844, cache off: 11 requests on
load before and after, because every one is lazy, and 351 requests fully
scrolled where there were 11. The page is 106,483px tall.

So the change is defensible and the framing was not. The right sentence is
already written in data/species-art.json's own readme, in the conditional: the
256px file "WOULD HAVE BEEN 4.4MB of one page". Choosing the 96px rendition
saved 4.4MB against a heavier version of the same new feature; it did not make
an existing page lighter. QUOTE THE PAIR OR QUOTE NEITHER, which this file says
five times elsewhere and which that commit did not do for the page it changed.

**A CSS background cannot be lazy.** rarity.html's magnified corners were
backgrounds, so all 13 full-size scans were fetched at first paint whether or
not anyone scrolled to that row.

**THE PACK TILES WENT THE SAME WAY ON 20 August 2026 AND TAUGHT TWO THINGS THIS
FILE HAD HALF RIGHT.** A grid tile's artwork is an `<img loading="lazy">` inside
the same facade now; packs.css takes the background off exactly those tiles with
a third class, `.pack--<set>.pack--tile.pack--img`, at (0,4,0) so it cannot lose
a specificity contest, and it is opt IN, so the facade app.js builds in the
browser and the one `playInTile` mounts on a click keep their backgrounds and
neither file had to change. /videos.html went 435.2 -> 231.7KB on load at 390
and /playlists.html 606.8 -> 408.5KB, fully scrolled unchanged.

**THE MEASUREMENT WINDOW IS THE TRAP AND IT ALMOST KILLED THE CHANGE.** An
off-screen background arrives SECONDS after the load event. A 2.5 second window
showed two of /videos.html's seven tile files and read exactly like a browser
that was already deferring the rest, which would have been a "measured and left
alone" for a win that was really there. Wait for the network to go quiet.

**AND `loading="lazy"` IN THE FIRST VIEWPORT IS NOT ALWAYS THE TIMING BUG THE
NOTE BELOW SAYS IT IS.** That note is right that the browser fetches such an
image immediately anyway and that the attribute costs the preload scanner. What
it does not say is that the preload scanner is sometimes the thing you want to
lose. Marking the four above-fold tiles eager moved ZERO bytes, to a tenth of a
kilobyte, on every page and both viewports, and cost 592ms of LCP on
/videos.html and 748ms of first paint on /playlists.html, measured Slow 4G with
a 4x CPU slowdown over HTTP/2, five runs, medians. An eager tile is discovered
during the HTML parse and spends the pipe the render-blocking stylesheet is
still waiting on; a lazy one the browser can see is fetched at LAYOUT, which is
after it, and is the same moment the background used to be fetched at. So the
rule is about what the image IS: the LCP element wants the scanner and a preload
of its own, a decorative thumbnail does not. Measure it over HTTP/2, because an
HTTP/1.1 preview has a six connection ceiling that flatters the wrong answer.

**THE RIP PAGES WERE MEASURED AND LEFT WITH NOTHING TO GAIN.** LAUNCH.md
promised 38.8KB on each of 317 of them. The rail tile sits 930px below the fold
at 390 and 396px at 1440, both inside Chrome's 1250px lazy threshold on a 4G
connection, so it is fetched whatever the attribute says, and 256 of the 288
pages with rails draw every tile in the hero's own set (it said "248 of the 279"
until 21 August 2026; the ratio held, the totals moved). That family moved by the
markup and nothing else. They are `<img loading="lazy">` now and the
page went 2,536KB to 388KB at 390px. If you move a background to an img,
re-screenshot: doing it here brought the scans into reach of a later rule at
equal specificity and turned eleven magnified corners into whole shrunken
cards, which looks almost right.

**THOSE TWO NUMBERS ARE ON-LOAD AND UNGZIPPED, AND THIS ENTRY DID NOT SAY SO
UNTIL 16 August 2026, by which point the 388 had been quoted back as a reason
not to look at the page.** Nothing regressed. Both figures are a cold load with
NO scroll, served by `.claude/server.js`, which sends no Content-Encoding. The
change was real and it is exactly what the entry claims: it moved 2.1MB off the
LOAD PATH. It did not remove a byte from the page, because a lazy image is
deferred, not cancelled.

Rebuilt from the commit that recorded them and re-measured with one harness,
390x844 DPR 2, cache off, so the four numbers are comparable:

                            on-load    fully scrolled, lazy forced
    at c58bf3ce, ungzipped    386.9KB    3,167.7KB
    at c58bf3ce, gzipped      219.7KB    3,000.6KB

So 388 reproduces to within a kilobyte, as an ON-LOAD UNGZIPPED number, and the
same page was already over 3MB to a reader who scrolled it. QUOTE THE PAIR OR
QUOTE NEITHER: they answer different questions and only the first is what a
reader waits for. Serve gzipped for any transfer figure, because the dev server
inflates HTML, CSS and JS three to five times and none of that is images.

**One card on that page was 1.1MB of the 3.1MB, and it was a PNG.** The Mega
Hyper Rare ladder row hotlinked `images.scrydex.com/pokemon/me5-120/large`,
1,100,908 bytes, drawn in a 96px box and a 132px corner crop. It was the only
image over 200KB on the whole site, checked across 167 pages. TCGdex has the
same card at `en/me/me05/120` and serves it as 26,529 bytes of AVIF, a 97.6%
cut, so `data/rarity.json` names the TCGdex url now and the page went 3,151KB
to 2,105KB fully scrolled. THE LESSON IS THE HOST, NOT THE CARD: every other
scan on that page is TCGdex and gets `avifPicture` and `imgDims` for free, and
one Scrydex url quietly opted out of both. Check the host before assuming a
heavy page needs a new pipeline.

**Some images do not exist and never will.** `data/no-scan.json` records the
TCGdex bases that 404 and 4 TCGplayer urls that 403. They all carried
`onerror="this.remove()"`, so nothing looked broken: the picture silently
vanished and the site paid for a dead round trip to find out. Builders skip
them up front instead. The file is safe to go stale in the only direction it
can.

**THAT ENTRY SAID 101 BASES "FOUND BY FETCHING ALL 4,655 IMAGE URLS THE SITE
EMITS" AND THE SECOND HALF WAS THE PROBLEM.** 4,655 was a list of pages
somebody had in front of them on 14 August 2026, not a rule, so it went stale
the moment the tree grew and nobody could tell. Re-swept from `public/` itself
on 18 August: 24,237 distinct card bases in the HTML, seven times that surface,
plus 6,326 more that appear only in the JSON under `public/data`. 528 of the
30,563 answer 404, so the 101 were 19% of it. The file holds 629 now.

`scripts/sweep-scans.mjs` IS THE SWEEP AND ITS INPUT IS THE BUILT TREE, which
is what stops it going stale again: `public/` IS what a reader gets. It is not
in build-all.mjs and must not be added to it, same arrangement and same reason
as sync-decks.mjs. `--recheck` re-tests what is on file; the default only ever
adds.

**AND NONE OF THEM WERE EVER IN THE HTML, which is worth knowing before anybody
goes looking for a broken `<img>` on a page.** A QA sweep reported 371 dead
scans "across 239 /pokemon/ pages". Substring-searched across all 1,480 built
HTML files: zero hits. Every one lives in `public/data/printings/*.json` and
`public/data/games/setquiz.json`, which the card search on /cards.html fetches
and turns into `<img onerror="this.remove()">` IN THE BROWSER. Real, and worse
than a server-rendered one because no build check can see it.

The cause was one level up: `sync-all-printings.mjs` proves an image path by
probing ONE CARD PER SET, which proves the set has scans and nothing about the
other four hundred cards in it. It applies `no-scan.json` per card now, in that
file rather than in a page builder, for the reason build-cards.mjs argues at
length: a page builder rewriting a sync's output is undone by the next sync.
629 cards dropped a base; the built tree emits zero dead ones, HTML and JSON.

**THE RIP PAGES WERE THE LAST FAMILY TAKING THE FULL SIZE SET LOGO,** 530
`<img>` across 268 of the 316, while /sets/, /openings/ and /playlists/ had all
moved to the `-sm.webp` months ago. This was an inconsistency, not a missing
asset: the small file was already on disk. Measured at 390x844 DPR 2 off the
request log, one page 383.0 -> 344.3KB, logo 52,472 -> 13,678 bytes, and 8.85MB
across the family. The same image was also above the fold at y=709 of 844 and
carried `loading="lazy"`, so it was oversized AND deferred; both are fixed in
`setLogoImg` in build-pages.mjs.

**AND THE OBVIOUS FIX MADE A RETINA DESKTOP WORSE BEFORE IT MADE IT BETTER.**
The page shows the SAME logo twice at two sizes, and giving each element its own
honest `sizes` made them resolve to DIFFERENT candidates at 1440x900 DPR 2: the
hero took the master and the heading took the -sm, so the page fetched BOTH,
66.2KB against the 52.5KB it paid when the second was a cache hit. Two
individually correct declarations, one regression. The smaller element declares
the LARGER one's box now, so it can only ever be handed a file already fetched.
Read both elements' `currentSrc` off the DOM before believing a `sizes` change
on a page that shows one picture twice.

**WHO'S THAT POKEMON WAS HOTLINKING raw.githubusercontent.com** for artwork the
site already hosts, 63% of that page's weight, re-fetched every round from a
rate-limited source host that is not a CDN. `/assets/species/lg/` is the same
475x475 pixels re-coded: 126.5MB of PNG becomes 19.5MB of WebP over the 1,025
species, #132 Ditto 129,274 -> 9,718 bytes. Page 421.3 -> 188.7KB median on
load, no request leaves the origin, and build-games.mjs now THROWS if any dex id
lacks an `lg` file, because a missing sprite is a round with no picture in it and
nothing errors.

**`loading="lazy"` IN THE FIRST VIEWPORT IS A TIMING BUG, NOT A WEIGHT ONE, and
that is why it kept getting written.** 22 images across 11 page families were
lazy and inside the first screen at 390x844. Removing the attribute moved page
weight by between -17 and +5 bytes, because a lazy image the browser can already
see is fetched immediately anyway; what it costs is the PRELOAD SCANNER, the one
chance the fetch had to start during the HTML parse instead of after layout. So
nothing here moved onto the load path and /rarity.html's 2.1MB is still off it.

THREE BUILDERS' COMMENTS WERE WRONG ABOUT THEIR OWN GEOMETRY and had been quoted
as reasons: build-pokemon.mjs said "on the narrowest phone only one is above the
fold" of a TWO COLUMN grid whose second row starts at y=822, build-eevee.mjs said
the same of its own two-column grid, and build-games.mjs said its first card sits
"about 250px down" when it is 460. MEASURE THE FOLD BY READING EACH IMG'S OWN
BORDER BOX AT SCROLL 0. Counting rows by eye is what produced all three.

**AN IMAGE THIS SITE DID NOT MAKE AND DOES NOT OWN NEEDS A VISIBLE CREDIT, AND
THE SHAPE IS SET.** Everything above this line is about card scans, pack art and
species portraits, none of which carry a per-image credit: the scans are
identified by the card they show and the artwork is commissioned or is the
publisher's. Two families are not like that. The retailer marks in
shared/brands.mjs are all PUBLIC DOMAIN on Commons and are credited in
data/brand-marks.json only, which is enough for a public-domain file. The eleven
photographs on /garbage-plate.html are CC BY, CC BY-SA and one public domain,
and an attribution license is granted ON CONDITION of naming the photographer
and LINKING the license, so a credit in a JSON file nobody reads does not meet
it. `photoFig` in build-garbage-plate.mjs is the pattern: a `<figure>` whose
`<figcaption>` reads "Photograph by NAME, LICENCE, via Wikimedia Commons", NAME
linking to the file and LICENCE linking to the deed, directly under the picture.
**Copy that shape rather than inventing a second one**, and read the license on
the file's OWN description page before publishing anything: a search result
claiming a license is not a license, and neither is a restaurant being pleased
about the picture.

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

## Current state
Homepage order: nav, THIS WEEK'S DROPS, Greatest Hits (the Hall of Fame card,
then a carousel), Latest rips (carousel), Most wanted, Card Pokedex, Card guides
and tools, the 585 hometown band, footer. The ORDER is the same at every width;
the LAYOUT of the first two content bands is not, and the difference is
described under "The home page is two layouts" below.

**AND SINCE 18 August 2026 THE NUMBER OF TILES IS NOT THE SAME AT EVERY WIDTH
EITHER, BELOW 545px.** Tim: "only update to the home page on mobile is to only
show 1 video for each section, so show the Hall of fame video, but no other
greatest hits videos, then show the latest rip video but no other videos on home
page for now." So on a phone Greatest Hits is the trophy alone, its whole shelf
carousel hidden, and Latest rips is slide 0 alone. Both headings and both "see
all" links stay, because they are now the only way onward, and the counts in
them are untouched: "All 10 hits" and "All 316" count the DESTINATION pages, not
the tiles on screen. Three `display:none` rules in a `max-width:544px` block at
the end of `homeCss` in build-proto.mjs, layout only, no colour. Above 544 the
page is byte-identical: index.html's whole diff is that media query.

IT IS A CSS CUT AND THE USUAL OBJECTION TO ONE WAS TESTED RATHER THAN ASSUMED.
Hidden tiles normally still download their artwork, which would make this the
opposite of a mobile saving. None of these do: the Latest band's slides 1 to 4
were already deferred behind `data-packsrc`, and the Greatest Hits shelf's slide
0, which does carry a real `src`, is held back by its own `loading="lazy"`,
because a lazy image inside `display:none` never enters the viewport. **That is
the whole mechanism and it is one attribute deep**, so re-read the request log
if heroTile's `loading` ever changes. Measured at 390x844 DPR 2, gzipped, cache
off, filenames read off the network: 345.5 -> 389.9KB on load and 814.3 ->
717.3KB fully scrolled, 16 image requests to 15, page 7,638 -> 6,834px. The
on-load number goes UP and that is the reflow, not a regression: the page is
804px shorter, so Most wanted's six card scans (142KB) now fall inside Chrome's
lazy window at load instead of on the way down, while the 97KB pack that used to
be there has gone. Quote the pair or quote neither.

**This section described a different page until 14 August 2026 and was
believed.** It listed a ROC ticker, a Rochester skyline SVG, an "Anatomy of a
Rip" plate diagram, a socials-as-diner-menu band and a GMAX card that flipped
to a rainbow rare with a 3D tilt. None of them exist. The Gotchas below still
carried "the ticker and card tilt must stay disabled under
prefers-reduced-motion; card flip stays enabled", which is an instruction about
three elements that are not on the page. A QA agent driving the real page found
nothing to test and said so, which is the only reason it was caught.

If you change the home page, change this paragraph in the same commit. Stale
architecture notes are worse than none: they get quoted back as constraints.

WHAT THE HOME PAGE ACTUALLY DOES NOW, and what not to break:
- **THIS WEEK'S DROPS IS THE FIRST THING IN `<main>` AND IT CAN DELETE ITSELF.**
  Added 17 August 2026 on Tim's ask: "easy to just land on home page and see
  what upcoming pokemon drops to keep an eye out for this week". Three rows out
  of /drops.html's nine, generated into the `DROPS` region by build-proto.mjs
  from data/drops.json, linking through.

  **EACH ROW NOW CARRIES THE RETAILER'S OWN MARK, added later the same day on
  "can we add the store logos to these announcements instead of just the box
  that says pattern only".** THE ENTRY HERE SAID "it is text: no artwork, no
  extra request" AND THAT IS NO LONGER TRUE. It draws `brandMark` from
  shared/brands.mjs against the same mirrored Commons files /buying.html,
  /selling.html, /retailers.html and /drops.html's own retailer chip use, in a
  slightly shorter box (26px against 34px, capped at 96px wide). Nothing new was
  fetched and nothing is hotlinked.

  READ THE ASK THE WAY IT WAS MEANT: the row had the confidence chip INSTEAD of
  a logo, not as well as one, so THE CHIP STAYED. `Pattern only` is the weakest
  tier the site has, it exists because no retailer publishes a restock schedule,
  and a row wearing a retailer's mark reads as more official than the same row
  in plain text. The hedge is worth more beside a logo, not less. The band's
  source line also gained one sentence saying the logos are the retailers'
  trademarks and are there to name the shop; the existing "Not a retailer
  speaking" is untouched.

  WHAT IT COSTS, one harness, gzipped, cache off, the same tree with and without
  the marks, mark files read off the REQUEST LOG:

                          on-load           fully scrolled    band height
       390x844  DPR 2   354.0 -> 360.6KB    934.6 -> 941.1KB   550 -> 630px
       1440x900 DPR 1   439.8 -> 446.4KB   1798.0 -> 1804.6KB  265 -> 288px

  Three requests at every width, 5.3KB the set (pokemon-center.svg 2,878B,
  walmart.svg 2,174B, target.svg 401B over the wire), plus the document going
  15,632 to 16,929 bytes gzipped. So +6.6KB on load, 1.9% of a phone's, on a
  page that is still 84% pack art. The marks are `loading="lazy"` so they queue
  behind the artwork rather than in front of it.

  IT IS ABOVE GREATEST HITS AND THAT COST WAS MEASURED, NOT WAVED AT. **THE
  "802 of 844" THIS PARAGRAPH WATCHED IS GONE, because the band has been a
  COLLAPSED DISCLOSURE since then and was tightened again on 20 August 2026: it
  is 59.41px at 390 now, one summary row of 44 with 6px of padding either side
  and its 3px rule, and it puts the "Greatest Hits" heading at 127.41. The rows,
  the lede and the credit line all still exist, inside the closed body, so
  nothing this paragraph says must not be lost has been. The number that
  replaces 802 is the trophy banner's bottom edge and it is 700, not 844: see
  the trophy bullet below.** The band's own height is no longer the constraint,
  but a fourth row or a taller mark box still spends the OPEN state's height and
  the reasoning below stands. At 1440x900 the band
  is 288px, three columns, and Greatest Hits still shows three packs. The case
  for the position is that the Greatest Hits band alone is 1,656px tall on a
  phone, so anything under it is two screens down and nobody lands on the page
  and sees it. If a later editor decides the channel must own the whole first
  screen, move the two `DROPS` markers in index.html below the `.hof` section;
  do NOT instead shrink the band by cutting its lede or its credit line, which
  are the two things it must not lose.

  A RETAILER WITH NO MARK GETS THE HATCHED NAME TILE and that is the documented
  fallback, not a bug. It is also not proof there is no mark: `dollar-general`
  in data/drops.json had been drawing a name tile on /drops.html while
  `dollargeneral.svg` sat on disk, because shared/brands.mjs had no alias for
  the hyphen. One line in `ALIAS` fixed it and /drops.html gained its ninth
  mark, +2.2KB and one request on that page. CHECK data/brand-marks.json BEFORE
  BELIEVING A NAME TILE: the fallback cannot tell "no file" from "no alias".

  **THE EXPIRY IS THE WHOLE FEATURE AND IT IS SHARED, NOT COPIED.** A stale drop
  here is far worse than a stale drop on /drops.html, because "be ready for a
  possible drop today" above the fold on the front door is the loudest lie the
  site can tell. shared/drops.mjs owns the model and BOTH pages import it, so
  they cannot disagree about which rows are alive. Two layers, exactly as
  /drops.html has always had:
    - the BUILD drops rows whose `expires` has passed, on the later of the drops
      clock and the real build day (later can only ever expire more, never less)
    - a CLIENT sweep re-runs it on the reader's own clock, so a deploy that has
      stopped moving still tells the truth
  The band is STRICTER than /drops.html in one way: past `weekEnds` it removes
  itself entirely rather than showing a staleness banner. That page is the
  record and last week's list is worth reading there; a pointer to what to watch
  for THIS week has nothing to point at. If the sweep takes the last row the
  band also removes itself, so it can never sit there as an empty frame.

  Driven with the page's clock faked, on the page as built 17 August: 3 rows on
  the 17th, 2 on the 18th, 1 on the 20th and the 23rd, and NO BAND at all on the
  24th and the 31st, with `.hof` first in `<main>` again. /drops.html on the same
  dates still bands the week and turns its h1 past tense, unchanged.

  THE ROWS ARE PICKED BY RULE AND NOTHING IS EVER TRUNCATED (`homeBandRows`).
  A row goes in whole or not at all, because the hedge is usually the END of the
  sentence: "the trackers expect Tuesday around 3am Eastern based on recent
  patterns, WHICH IS A GUESS RATHER THAN A TIME". Shortening that to fit reads
  as tidying up and is how this band would start lying. So a row too long for a
  compact card is left off and stays on /drops.html with its notes, and
  build-proto.mjs SAYS SO in its output when it drops one. One row per retailer,
  at most two perishable rows so the band cannot empty itself mid-week, soonest
  first. The confidence word comes from `CONF_LABEL` in shared/drops.mjs, shared
  with /drops.html so "Pattern only" cannot quietly become "Expected" here.
- Every video band plays IN PLACE. Clicking a pack mounts the player over the
  tile, runs the rip animation and plays there. It does not navigate. This was
  an explicit request and it is easy to undo by accident, because the tile is
  still an `<a>` to the rip page and the handler is what stops it.
- Each tile's rip animation uses THAT VIDEO'S OWN pack art, not the generic
  wrapper. `packSet` in build-proto.mjs picks it.
- Bands other than Greatest Hits are a scroll-snap carousel with slide buttons,
  not grids. ON A PHONE that is one video at a time and the counter reads
  "1 / 5". On a desktop it is two or three at a time; see below.
- A slide the track is not showing has NO pack art in its `<img>` yet. See
  "loading=lazy is a vertical heuristic" under Card images. If you change the
  carousel markup, keep slide 0's real `src` and keep the data- attributes on
  the rest, or the home page quietly goes back to 800KB on a phone.
- The Hall of Fame card keeps its text when the player mounts: the handler
  swaps only the art box, because replacing the whole card lost the title, the
  set and the view count.
- **ONE CONTROL ON EVERY VIDEO ARTWORK ON THE SITE, AND IT IS THE RIP PAGE'S
  OWN BANNER -- EXCEPT ON THE RIP PAGE RAILS, WHERE A DISC SURVIVED THE CHANGE
  AND THIS FILE DID NOT KNOW IT.** This entry read "every pack, everywhere" until
  21 August 2026. **Re-counted on the built tree 22 August 2026: 300 of the 319
  rip pages carry 2,878 `.vid-play` discs**, emitted by `scripts/build-pages.mjs`
  (two call sites, lines 1627 and 1662), on the "More from &lt;box&gt;" and
  "More &lt;set&gt;" rail tiles. The count on 21 August was 288 pages / 2,588
  discs; the tree grew, so re-count before quoting it. Those tiles are real
  `pack pack--tile pack--img` wrappers with a play disc laid over them and no
  `.pack-hint` at all. The class is
  `.vid-play`, not `.play`, which is why "`<span class="play">` is GONE from the
  tree" below is literally true and still leaves the disc on the site: an audit
  that greps for the old name finds nothing and reports success.

  **THE CONTRAST FIGURE THIS ENTRY USED TO CARRY WAS THE WHITE DISC'S AND IT DOES
  NOT DESCRIBE `.vid-play`. RE-MEASURED 22 AUGUST 2026.** It said "1.00:1 at its
  worst point, up to 48% of its perimeter under 3:1 ... the same white disc". It
  is not the same disc and it is not white: since Trubbish Deep it is
  `--ketchup #E87EA1` inside a **3px `--paper-2 #2F4F39` ring**. Measured off
  RENDERED PIXELS (screenshot, sampled 2.5px outside the rim, on the rim, and in
  the fill, every 6 degrees, 54 discs whole-in-frame across the four rip pages
  below, 1440x900 DPR 1 and 390x844 DPR 2):

  | boundary | worst point | perimeter under 3:1 |
  |---|---|---|
  | outer edge: the `--paper-2` ring against the pack art | **1.00:1** | **88-97%** |
  | disc body `--ketchup` against the pack art | 1.00:1 | 55-73% |
  | **fill against its OWN ring, i.e. the disc's internal edge** | **3.45:1** | 0% |

  So the perimeter number is 88-97%, not "up to 48%" -- roughly twice as bad as
  recorded, because the pink matches the pink-heavy pack art nearly all the way
  round where the white disc only collided at one point.

  **AND THE THIRD ROW IS WHY "1.00:1" ALONE OVERSTATES IT, WHICH IS THE HALF
  BOTH EARLIER READINGS MISSED.** The disc is not a flat blob that vanishes: it
  carries its own two-tone edge at **3.45:1** the whole way round, with the glyph
  at **6.16:1** inside it. `--ketchup` and `--paper-2` are each declared exactly
  once, at `:root`; no skin overrides either, and skins only set `--pk-*` on the
  artwork. So that 3.45:1 self-contained edge is CONSTANT on every skin and does
  not depend on what is behind it. The disc reads as a disc even where its outer
  edge disappears into the art.

  **AND IT IS DECORATIVE, so nothing is lost to a screen reader.** It is
  `aria-hidden="true"` with `pointer-events:none`; the real control is the
  enclosing `<a class="vid-shell">`, which carries a full `aria-label`, and a
  visible `<h3 class="vid-title">` link plus a date sit directly beneath the
  tile. What is actually wrong is narrower than the old figure implied: an
  AFFORDANCE INCONSISTENCY. Every other pack on the site says CLICK TO RIP THE
  PACK at 3.82:1 and these 2,878 say it with a disc instead. **The fix, if it is
  taken, is `.pack-hint` at those two call sites in build-pages.mjs** -- that
  file's owner's call, and not a launch blocker, because no reader loses anything
  here they cannot get from the title link one line below. What is NOT open is
  quoting "up to 48%": that number was never about this disc.

  Everywhere else, since 19 August 2026, every pack carries
  `.pack-hint` reading CLICK TO RIP THE PACK across the foot of the artwork:
  the carousel slide, the Hall of Fame trophy, the 22 playlist pages, and
  /videos.html both server-rendered AND client-rendered, as well as the rip page
  it came from. SIX EMITTERS, NOT SEVEN, since 19 August: build-proto.mjs's
  tile() was on the list, returned the `<article class="v">` grid tile, and had
  no callers anywhere in the repo. It was edited in step with this change
  because the list said to, and its date chip was even moved to clear a banner
  it could never have collided with. Deleted. An emitter list is a maintenance
  contract, so an entry that renders nothing costs more than a missing one. Tim: "I do like the 'Click To Open Pack' banner on
  the video pages themselves, can we carry that accross to the home page, and
  remove the 'Rip it open' ctas all together not needed just that one banner
  acorss the bottom". The markup is `RIP_BANNER` in shared/format.mjs, imported
  by both builders; public/assets/app.js cannot import and restates it with a
  comment saying so. `<span class="play">`, the white disc, and `.hero-cta`,
  the "Rip it open ->" pill under every carousel slide, are both GONE from the
  tree. Do not reintroduce either: **that WHITE disc** measured 1.00:1 at its
  worst point against the nineteen wrappers with up to 48% of its perimeter
  under 3:1 -- a figure that describes `<span class="play">` and nothing else,
  so do not carry it over to the surviving pink `.vid-play`, which measures
  1.00:1 at 88-97% of its perimeter and has its own 3.45:1 internal edge; see
  the re-measurement above --
  while the banner floors at 3.82:1 on every skin because it is opaque and
  carries a near-white ring outside a near-black keyline, which are 14.6x apart
  in luminance so one of them always reads. `.hofx-cta`, "Watch the pull ->",
  is a DIFFERENT control and stays: it is about the card that came out, not
  about the pack.
- The trophy's duration chip and its banner both sit INSIDE `.hofx-art`, so
  playInTile takes them away with the artwork they describe. THE FOLD IS WHAT
  THE BANNER COSTS AND IT WAS MEASURED RATHER THAN WAVED AT, because the disc
  sat at the CENTRE of the artwork and the banner sits at its foot.

  **THE WHOLE BAR IS ABOVE THE FOLD ON A PHONE SINCE 20 August 2026, AND THE
  NUMBER TO BEAT IS 700 RATHER THAN 844.** Tim, on his own phone: "lets also
  make it so when you land on the home page you can see the entire hall of fame
  video on the screen, and see the click to rip open the pack banner and watch
  the video right when you land on home page above the fold no scrolling, we can
  make the video smaller so its fits and tighten up everything else." Safari's
  own chrome takes 100 to 140px of an iPhone's 844, so clearing 844 in a
  headless viewport is not clearing the fold on the phone he is holding. Bottom
  edge of `.pack-hint` on the trophy, read with getBoundingClientRect, before ->
  after:

        320x800    752.89 ->  608.58        414x896    903.00 ->  716.34
        360x800    807.00 ->  641.48        430x932    832.00 ->  656.48
        375x812    833.66 ->  662.28        500x900    937.00 ->  738.00
        390x844    860.33 ->  683.28        544x900   1003.00 ->  789.47
        820x1180   991.00 ->  991.00       1440x900    944.98 ->  944.98

  **81.59 OF THE 177.05px AT 390 CAME OFF THE CHROME BEFORE A PIXEL CAME OFF THE
  PACK**, which is the order that matters: 16 from main's padding-top, 31.59
  from the drops band, 16 from `.hof`'s padding-top, 18 from the run between the
  Greatest Hits heading and the artwork, and only then 95.45 from the pack
  itself, which goes 318.0x565.3 to 264.2x469.9. Every rule is inside
  `max-width:544`, so 820 and 1440 are identical to the pixel and to the byte.
  The full breakdown, the wire figures and the contrast re-read are in note 4 at
  the end of `homeCss` in build-proto.mjs and in the `max-width:544` block under
  `.hofx` in ui.css.

  **THE PACK IS NOW SMALLER THAN THE LATEST RIPS SLIDE UNDER IT** (264x470
  against 332x498, 31% less area), which is the comparison the `min-width:425`
  block in ui.css uses as its test. Rank is carried by the gold frame, the
  ribbon and first position instead, which is the same resolution the desktop
  layout reached when all three packs went to one width. **THE OTHER LEVER WAS
  THE BAND ORDER AND IT WAS DELIBERATELY NOT TAKEN.** Moving the two DROPS
  markers below `.hof` pays the band's whole 59.41px AND would leave the pack
  near 307 wide, but Tim asked for that band above the fold on 17 August in as
  many words, so it is a trade for him rather than for a stylesheet. If he wants
  the bigger pack, that swap is two markers and one paragraph.

  On the two wider screens the DURATION CHIP is still the mark that says "this
  is a video" above the fold, which is the job it was added for on 16 August
  2026.
- EVERY RELATIVE DATE ON THE PAGE IS RECOMPUTED IN THE BROWSER. `ago()` in
  build-proto.mjs runs on the build clock and its answer is then frozen into a
  static file, so a deploy that stops moving turns "TODAY" into a lie in the
  largest type above the fold. The nine `<time class="ago" datetime="...">`
  stamps carry the machine-readable date and an inline script at the bottom of
  index.html redoes the sum on read, using `data-built` on each `.vcar` as a
  floor so a reader whose clock is behind the build only ever sees what the
  server already rendered. Same idea as the date sweep in build-shows.mjs. The
  server render stays correct on its own, so the page is complete with JS off.
  The script lives outside every `NAME:START` marker, which is the only reason
  build-proto.mjs does not overwrite it.
- The newest rip wears a LABEL, not a timestamp: "Today's Rip", "Yesterday's
  Rip", or "Latest Rip" past that. Tim uploads daily so it reads "Today's Rip"
  almost every day, which is what he asked for, but it is derived from the
  video's own publish date and never hardcoded: the nightly has failed three
  nights running before now, and the video on show can be older than the page
  assumes. It used to read "Newest rip TODAY" over a tile saying 1 VIEW.

THE HOME PAGE IS TWO LAYOUTS, and the desktop one is younger than the phone
one. Until 16 August 2026 there was only the phone layout and a desktop got it
unchanged. Measured at 1440x900 that meant the first 3,307px of a 6,855px page
showed TWO videos: .hofx and every carousel card were capped at 520px and
centred inside a 1,392px .wrap while the slide itself ran the full width, so
three consecutive cards each left 872px of empty band either side and content
used 37% of the width. At 1920 it was 65%, because a fixed cap does not move.
The set grid and the tool grid below fill the same wrap completely, which is
why the top of the page read as a different site from the bottom.

The rules that fix it are the last block in `assets-source/ui.css` and they are
ALL `min-width`, so nothing a phone or a tablet renders changed. Three things:

- The carousels show 2.35 slides at 1000px, 2.75 at 1200 and 3.3 at 1400. The
  fractions are deliberate, so the next card is cut by the band's edge and the
  row reads as continuing. The count steps to hold the ARTWORK still: one fixed
  count across the range swings the pack from 359px to 478px wide.
- Greatest Hits becomes two columns at 1200: the trophy on the left, the rest
  of the hits beside it. That band was 2,105px tall to show one pack and one
  video and is now 1,109px at 1500 showing three.
- Most wanted's tiles grow to fill their row instead of stopping at 168px.

THE TROPHY COLUMN IS NO LONGER "a fixed 460 to 520px" AND THIS BULLET SAID SO
UNTIL 17 August 2026. Tim: "home page layout on desktop is still wonky for the
first 3 videos". Those two picked numbers were the cause, because a SHARE is not
a SIZE: the trophy's artwork is its column less a 4px border and var(--s5)
padding, a slide's is half of what is left less a 1px border and var(--s4), and
no pair of fixed numbers makes those two agree. Measured at 1500 before the fix:

      trophy art 464px      slide art 408px      three sizes of pack
      trophy card ends 1435 slide cards end 1367 ragged bottoms, 68px
      trophy caption 1290   slide captions 1199  nothing on a line

The column is DERIVED now, in the ui.css block that owns it, from the boxes on
the way in, so all three packs are one width at every desktop width: 353.3px at
1280, 406.7 at 1440, 426.7 at 1500 and up. Bottoms and artwork tops line up to
0.0px at 1280, 1440, 1500, 1600 and 1920. The trophy gives up 37 to 51px of
artwork and every slide GAINS 25 to 27, so the smallest pack in the band grows
at every width, which is the test the old numbers were protecting. Rank is
carried by the gold frame, the ribbon and first position instead, and the
trophy's card is still the widest of the three.

IT COSTS BAND HEIGHT AND THAT WAS MEASURED, NOT WAVED AT: 968.6 to 999.3px at
1280, 1058.6 to 1079.3 at 1440, 1058.6 to 1109.3 at 1500 and up. The band buys
bigger artwork on two of its three cards with it.

ONE DOCUMENTED INVARIANT DID NOT SURVIVE, AND IT IS WRITTEN HERE RATHER THAN
LEFT TO BE REDISCOVERED. "The trophy is the LCP element at every width" is no
longer true above 1400: with the three images the same size the trophy's own
box rounds to 426.66x639.98 against the slides' 426.67x640.00, so a carousel
slide wins the LCP by FOUR SQUARE PIXELS. Nothing about the load changed and
that was checked rather than assumed: same `sizes`, same file picked off the
request log, fetchpriority still on the trophy alone, both LCP entries fire in
the same millisecond, and median LCP over 5 runs each is 176 to 200ms at 1280,
184 to 192 at 1500 and 208 to 200 at 1920 (before to after), with on-load weight
656.6 to 657.0KB. If somebody "fixes" this by making the trophy's artwork bigger
again they will have undone the whole change to win a rounding error.

Do not "simplify" those fractional counts to whole numbers and do not reinstate
a single centred card, which is what the two long comments above them are
arguing about. Both of those comments are still correct and still about the
PHONE: one column sized to the video is right when the slide is the whole
track. The desktop fix is not a wider card, it is more of them.

THERE IS A THIRD LAYOUT AND IT IS THE GAP THE OTHER TWO LEFT, 545px to 999px.
The desktop rules are all `min-width:1000`, which is what makes them safe, and
is also why everything below 1000 kept the phone layout at tablet size. Fixed
16 August 2026, in the `<style>` block generated by `build-proto.mjs` rather
than in ui.css, because `.vcar` and `.hofx` exist on this page and no other and
ui.css was being rewritten by another pass at the time. FOLD IT INTO UI.CSS'S
HOME PAGE BLOCK when that settles; the breakpoints and the argument are already
written to match. Measured, one slide of the Latest band:

                       BEFORE                        AFTER
      width   slide   card   art   art/slide     card   art   art/slide
        768     720    720   360      50%         520   440      61%
        899     851    851   360      42%         520   440      52%
        900     852    520   440      52%         349   315      90%
        999     951    520   440      46%         391   357      91%
       1000     391    391   357      91%       unchanged

- 545 to 899 was ui.css's own documented failure, still on the page: "a 360px
  pack marooned in a 720px card with 180px of white either side". Its answer,
  the `min-width:900` rule, caps the card at 520 and the art at 440, and now
  runs from 545, which is where the wrap first exceeds that cap. The caption
  used to be left aligned to an 851px card while the pack was centred in it, so
  at 768 the title started 180px left of the thing it named. Costs 288px of
  page height at 768 and buys 22% more artwork.
- 900 to 999 gets the multi-slide layout instead, at 2.35 slides, the same
  fraction as at 1000. 2.35 IS CHOSEN SO 999 AND 1000 ARE THE SAME PICTURE:
  artwork lands on 357px at 999 and the min-width:1000 rule computes 357px at
  1000, so the old 440 -> 357 cliff at that boundary is gone. Page height at
  900x900 went 7,628 to 7,339.

Nothing outside 545..999 moves. 390, 414, 500, 544, 1000, 1200, 1280, 1440 and
1920 were re-measured after and are identical to the pixel.

The banner art is the header, not a mid-page strip. Do not overlay copy on
it: Trubbish sits dead centre in the source image, so any scrim wide enough
to make text legible washes him out, and any panel large enough hides him.
The copy goes underneath.

Also at root: favicon.ico / favicon-32.png / apple-touch-icon.png (all
cropped from Trubbish's face in logo-square.jpg), robots.txt, sitemap.xml.
assets/og-image.jpg is a 1200x630 crop of banner-trubbish.jpg, wired up as
og:image and twitter:image. Absolute URLs come from `shared/site.mjs`, which
switches on one flag: `LIVE` is still false, so every canonical, og:url and
sitemap entry points at garbagerips585.github.io. Flip `LIVE` and rebuild to
move the whole site onto the real domain in one step. Do not hand-edit URLs.

## Page titles carry no "| Garbage Rips 585" suffix, and that is deliberate

Removed 17 August 2026 from every group where it could only ever truncate.
Measured in headless Chrome with canvas measureText at 20px Arial, which is
what Google's desktop result actually renders: titles over the ~580px cut went
**1,177 of 1,262 to 71**, median 683.1px to 506.5px. The Pokemon pages went
844 over the cut to 0.

**DO NOT "RESTORE" IT.** The brand is not lost: `og:site_name` is on all 1,262
indexable pages and that is what Google reads for the site-name line beside a
result. A suffix that gets cut off adds nothing and costs the tail of every
title it sits behind.

Where it stayed, and why, because these are not oversights:

- **English set guides.** `setTitle` in build-set-pages.mjs already solves this
  a better way: it drops the DESCRIPTOR rather than the brand, and 26 of 27 fit.
  That is argued work in that file. Leave it.
- **Retailer pages and most game pages.** The suffix renders in full there, so
  removing it would lose brand for nothing.
- **51 rip pages still over the cut.** Those titles are Tim's own YouTube titles
  verbatim, and rewriting them would break the correspondence between the page
  and the video it is about.
- **/index.html and /about.html**, where the brand is at the FRONT and is the
  distinguishing word rather than a suffix.

ONE CORRECTION WORTH KEEPING: an audit reported that the suffix was displacing
distinguishing words on the Pokemon pages. It was not. Their core titles were
468-558px, already inside the cut, so only the brand was being cut and the win
there is polish. Where content genuinely was being lost was the international
set guides, where the cut ate "English Equivalent", which is the entire point
of those pages, and the long rip titles, where it ate the pack number.

META DESCRIPTIONS WERE DELIBERATELY NOT TRIMMED. Nearly all of them exceed the
~920px cut, but they front-load and the complete first sentence survives;
shortening them would delete the sourcing detail (read dates, methodology) that
is the reason to trust the numbers, and description length is not a ranking
factor. There is one real CTR idea recorded here rather than done: on the 844
Pokemon pages the most clickable fact ("The priciest is X at $Y") sits behind
the cut, and moving it forward would help. It is an 844-page rewrite.

## Local preview
`node .claude/server.js` (port 4585), or the "grips" entry in the parent
Codex .claude/launch.json. .claude/ is gitignored, so it never deploys.

## Deploy
Git repo, main branch, pushed to garbagerips585/garbagerips585.github.io.
`pages.yml` publishes public/ on every push. Going live is one flag: set LIVE
in shared/site.mjs and run build-all.mjs, which moves every canonical and the
sitemap onto the real domain and generates public/CNAME. Background and the
post-flip checks in DEPLOY.md; **the ordered thing to follow on the day is
LAUNCH-DAY.md**, which is the DNS, the flip and the GitHub settings as one
sequence with a proof after every step. `python3 scripts/rehearse-flip.py`
rehearses the whole flip from `git archive HEAD` in a scratch tree and must exit
0 before the day.

**`public/CNAME` IS NOT THE SWITCH, and all three docs now say so.** DEPLOY.md
used to claim an Actions-deployed Pages site "reads the custom domain from a
CNAME file inside the uploaded artifact" and that "without it the custom domain
setting is dropped on the next deploy". GitHub documents the opposite for
exactly this publishing source: "If you are publishing from a custom GitHub
Actions workflow, no `CNAME` file is created, and any existing `CNAME` file is
ignored and is not required." (docs.github.com, Managing a custom domain for
your GitHub Pages site, checked 21 August 2026.) This repo publishes with
`actions/deploy-pages@v4`, so the custom domain lives in Settings -> Pages and
nowhere else. Generating the file is harmless and worth keeping as a record of
intent. DEPLOY.md was corrected the same day and LAUNCH-DAY.md step 8 is where
the domain actually gets set; believing the old version costs an hour of looking
in the wrong place if the domain does not answer on launch day.

## TODO (rough priority)
1. Greatest Hits playlist. The band ranks by pull tier then views as a
   stand-in; Tim's own playlist would replace it. (The old note here pointed
   at a "HITS ONLY PLAYER" comment in index.html that no longer exists.)
2. Buy garbagerips.com, set it in Settings > Pages, then verify in
   Google Search Console and submit sitemap.xml. See DEPLOY.md.
3. ~~About page~~ done: /about.html is written, linked and in the sitemap.
4. Blog for actual search traffic: set reviews, "Pokemon card shops
   Rochester NY" local angle. Each post embeds a video, and each new page
   goes in build-pages.mjs's sitemap list, not into sitemap.xml by hand.
   THIS LINE USED TO SAY "pull rates" and it should never have. The site's
   hard rule is that pull rates are never stated, because The Pokemon Company
   does not publish them, and /luck.html goes out of its way to say its
   numbers are observed results instead. A TODO naming a content plan the
   rest of the file forbids is exactly the kind of note that gets quoted back
   as permission.
5. Consider migrating to Astro if the blog grows (keep it static).
6. Naming consistency: "GarbageRips585" (one word, on sticker) vs
   "Garbage Rips 585" (spaced, on YouTube). Tim to pick one for H1/metadata.

## Gotchas
- Shorts playlist embed plays in a normal player, not the Shorts UI.
- prefers-reduced-motion is honoured in three places and all three matter:
  a blanket rule kills every transition and animation, a specific rule stops
  the pack shake and tear so the video is simply revealed, and the tool cards
  only get their hover transform under `no-preference`. This entry used to
  name a ticker, a card tilt and a card flip, none of which exist any more.
  Check the page before writing a rule about it.
- Keep page weight low; images are pre-compressed in assets/.
- **A SINGLE `font-weight` IN NEW CSS CAN COST MORE THAN THE FEATURE IT STYLES.**
  The drops band's channel label was written `font:400 ... var(--mono)`. Every
  other Space Mono on the home page is 700, so that one declaration fetched a
  second weight file, 9.4KB and an extra request above the fold, against 1.3KB
  for the whole band's markup. Nothing looked wrong: the markup, the CSS and the
  render were all correct. It was found by diffing the REQUEST LOG against the
  same page with the band stripped out, which is the only place it appears.
  Check the weights already on a page before adding a declaration to it.
- **THE HOME PAGE HAS NO RUNTIME PROBLEM AND A REPORT OF ONE SHOULD BE MET WITH
  A MEASUREMENT FIRST.** Chased 16 August 2026 after "lags and loads slowly on
  desktop", swept at 1280x800, 1440x900 and 1920x1080 at DPR 1 and 2 in headless
  Chrome: Total Blocking Time 0ms at every width and every DPR, ZERO long tasks
  unthrottled, and scrolling the full page produced NOT ONE frame over 33.3ms in
  any run, worst frame 18.7ms. Under 4x CPU throttling there is exactly one long
  task, 60 to 70ms, and it starts at ~81ms, which is before first contentful
  paint: it is the initial parse and style pass, so it lands outside the TBT
  window and ahead of anything a reader can see. LOAD AND LAG ARE DIFFERENT
  COMPLAINTS and only the first reproduced. The weight was real: 807.7KB
  on-load, 84% of it pack art. Look at bytes before looking at JavaScript.
- The date sweep at the bottom of index.html was checked for layout work in a
  loop and does none: it reads no geometry at all, only `datetime` attributes.
  `hydrateSlides` in packplayer.js DID interleave a `getBoundingClientRect` with
  an `src` write, so each measurement after the first forced a re-layout. It
  reads every slide then writes every slide now. It cost 0ms either way at every
  width measured; it was separated because the pattern is a trap, not because it
  showed up.
