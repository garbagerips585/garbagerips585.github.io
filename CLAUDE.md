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
  by a stated move, in the `F` block of scripts/gen-palette-samples.mjs, which
  holds the arithmetic and self-checks every pair before it writes. **Do not
  re-derive a number here or in ui.css; read it from there.**

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
  `.hero-cta{color:var(--ink)}` measured 1.27:1 on nine home-page buttons;
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
the stylesheet is render blocking on all 426 pages and 40% of it was prose.
Measured, gzipped, which is how the host serves it: 42.4KB -> 17.4KB, a 59%
cut to the transfer of the one asset that delays first paint everywhere.

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

## Every click stays on the site
Video tiles everywhere link to that video's own page under `public/rip/`,
never to youtube.com. The embed lives on that page.

The deliberate outbound links are Subscribe, the social icons, every card
on /playlists.html, and one block of four at the foot of /how-to-play.html.
THAT SENTENCE IS AN UNDERCOUNT AND HAS BEEN FOR MONTHS: see "THE COUNTING WAS
WRONG THE WHOLE TIME" below for what is actually in the tree, and for the test
that replaces the count.
THE THIRD ONE IS AN EXCEPTION THIS FILE DID NOT ADMIT TO
until 14 August 2026, when it read "the only deliberate outbound links are
Subscribe and the social icons" while 22 cards on that page sent people to
YouTube. The rule and the page disagreed and the page was winning quietly.

The exception is arguable rather than obviously right, so here is the case
either way. A playlist is a YouTube object: an ordered, hand-curated run, and
watching it in order is a thing YouTube does that this site does not
replicate. The cards are labelled "Watch on YouTube" and carry an aria-label
saying it opens there, so nobody is tricked. Against that: the site holds a
page for every video in those playlists, so an on-site playlist view is
buildable, and the rule exists because sending people to YouTube is how a
content hub stops being one.

If you build the on-site version, delete this paragraph rather than editing
it. Until then, do not "fix" the outbound links without deciding that
question first: they are a known trade, not an oversight.

THE FOURTH EXCEPTION IS /how-to-play.html, added deliberately and argued here
rather than made quietly, which is the mistake the playlist cards made. That
page teaches the rules of the card game, and it ends with one labelled block of
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
Pokemon's own site, in one labelled block at the very end. /tcg-live.html carries
TWO in its end block, the official TCG Live page and the redemption site, and
that page takes one further liberty which was argued rather than made quietly:
THE REDEMPTION LINK ALSO APPEARS INLINE, in the redeeming section. It is not a
"learn more" link, it is step one of a four step instruction, and burying it 900
words below where the reader is standing costs them more than the outbound rule
gains us. It is labelled and aria-labelled as leaving the site exactly like every
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
outbound one is 123.7 x 44.0 at 390x844 against a whole-row internal target. The outbound link is a small labelled control at the end of
a row, aria-labelled as leaving the site like every other exception.

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

THE COUNTING WAS WRONG THE WHOLE TIME AND THE NUMBER IS NOT SIX. Measured on
18 August 2026 across every built page, socials and youtube.com excluded:
1,473 of the site's 1,478 pages carry a non-social outbound link. The rule and
the tree have disagreed for months, in the same way and for the same reason as
the playlist cards, and this file has been the one telling the story about how
bad that is.

WHAT IS ACTUALLY OUT THERE, by host, so the next person can check the claim
instead of trusting it:

- app.getcollectr.com, 1,471 pages. THE FOOTER. (Seven pages do not carry it:
  index, about, videos, hall, playlists, shops and wanted all pass their own
  footer extra and take a variant. That was not deliberate, it is just how the
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
explanation; they are small labelled controls next to large internal ones; and
every one carries an aria-label saying it leaves the site. That is checkable,
it does not go stale, and it is what a reader experiences. THE FOOTER LINK
FAILED BOTH HALVES OF IT until this edit: no aria-label, and an 18px line of
text sitting beside four 44px social buttons, so the smallest target in the
footer was the only one that left the site. Fixed in shared/chrome.mjs and
assets-source/ui.css on 18 August 2026.

DO NOT REPLACE THE NUMBER WITH A BIGGER NUMBER. If you add an outbound link,
apply the test above, meet the shape, and if the answer is arguable write the
argument HERE. The rule is the test plus the shape, not a tally.

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

Every one of those was the unlabelled YouTube circle in `.foot-social`, because
below 560px the bar's own `.sub` is `display:none` and the only other Subscribe
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
wrong.** Topps printed Pokemon TRADING cards under licence: anime and film
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
computed and both are labelled as what they are, and neither is a print-run
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
Pokemon licence with is not stated by any source we reached, so the page says
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

**A CSS background cannot be lazy.** rarity.html's magnified corners were
backgrounds, so all 13 full-size scans were fetched at first paint whether or
not anyone scrolled to that row. They are `<img loading="lazy">` now and the
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

  IT IS ABOVE GREATEST HITS AND THAT COST WAS MEASURED, NOT WAVED AT. At 390x844
  the band is 630px and puts the "Greatest Hits" heading at 802px, so the
  heading is still above the fold and the trophy artwork mostly is not. **802 of
  844 IS THE NUMBER TO WATCH, not the kilobytes: 42px of margin is all that is
  left, and a fourth row or a taller mark box spends it.** At 1440x900 the band
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
- The Hall of Fame trophy carries a play pip and a duration chip like every
  other artwork on the page, added 16 August 2026 and the last thing here that
  did not. Both sit INSIDE `.hofx-art`, so playInTile takes them away with the
  artwork they describe. It matters most on a phone: measured at 390x844 the
  art box runs 265px to 845px, so the caption, the set, the view count and
  "Watch the pull" are ALL below the fold and the pip and the clock are the
  only two marks that fit inside the art itself. Without them the opening
  screen was a picture of a booster pack with nothing anywhere saying it plays.
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
sitemap onto the real domain and generates public/CNAME. Full walkthrough and
the post-flip checks in DEPLOY.md, which also records that the flip has been
rehearsed on a throwaway copy of the tree.

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
