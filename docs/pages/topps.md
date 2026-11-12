# The Topps pages: /topps.html and /topps-card-values.html

Covers what Topps cards are, the bucket-to-release mapping and its checks, the two ranking columns, and the image rules.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## The Topps pages

Two pages about the cards Topps made, added 18 August 2026 on the owner's ask: "the
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
in the tree to emit by accident. **THE BAN THAT CAUSED THAT WAS LIFTED ON 11
SEPTEMBER 2026 (see "Pull rates: a SOURCING rule" above) AND THESE PAGES WERE
NOT CHANGED.** Two reasons, and the second is the real one. The odds were never
written down, so putting them back is a research job on 12 sets rather than an
edit. And Bulbapedia is not the publisher: 1999 to 2003 Topps insert odds would
need the printed odds off a wrapper or box to clear the new "confirmed" test,
which is exactly the kind of claim the new rule is careful about. If the owner
wants them, that is a deliberate pass with a source per figure. No print run totals, because nothing sourceable
publishes one and "not many were printed" is exactly the shape of claim this
site does not make. No named licensing counterparty: who Topps signed the
Pokemon license with is not stated by any source we reached, so the page says
the cards were licensed and stops. And no outbound link on a price row, which is
the open call recorded in the sixth exception above.

**NOBODY SAYS "DEAREST", and this cost a day of the launch week.** Both pages
shipped describing "the 100 dearest Topps Pokemon cards", in the h2s, the lede,
the meta description and the og:description. The owner read his own page and said "not
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
