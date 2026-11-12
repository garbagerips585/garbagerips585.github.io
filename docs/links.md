# Every click stays on the site: internal video links and the outbound link rule

Covers why video tiles link to /rip/ pages, the test and the required shape for any outbound link, and every argued exception with its history.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

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
subtlety: either that page gains links or these two lose them. It is the owner's
call, and it is recorded here rather than settled quietly in one file.

THAT OPEN CALL WAS THE REASON /topps-card-values.html HAS NO ROW LINKS, added
18 August 2026 with 200 PriceCharting rows on it. It follows /top-graded.html:
the product path is printed on every row as plain text and linked nowhere. The
argument is in scripts/build-topps.mjs's header and it is short. Two hundred
more outbound links would be the largest single addition of them the site has
ever made, and making it would settle a question this file explicitly parks with
the owner, in one builder, quietly, which is the exact mistake the four paragraphs
above are about. The figures stay checkable because the path is on the row. If
the owner settles it the other way, that page and /top-graded.html change in one edit,
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

THE SOURCE CARD ON A RIP PAGE IS THE NEWEST ADDITION OF OUTBOUND LINKS AND IT
IS ARGUED HERE RATHER THAN ADDED QUIETLY IN A BUILDER, which is what the
paragraphs above spend four screens complaining about. Added 27 August 2026 on
the owner's ask: "I love tagging the stores and vendors who I buy the products
from so lets figure out a really cool way to highlight the stores and vendors on
the video pages for those rips."

WHAT IT IS: 15 of the 325 rip pages name the shop or vendor the packs came from,
and those 15 now carry a card in the rip's own info column with that seller's
mark, what they are, where they are, and their links. 80 outbound links, all 80
carrying an aria-label ending "opens on <host>": youtube.com 15,
lingstergames.com 10, instagram, tiktok, discord, whatnot and toakpulls.com 10
each, google.com 5 (map links on the shop address).

THE TEST, APPLIED, AND IT IS THE HARDER HALF THAT DECIDES IT. This file's rule
is "does the READER need the destination, or does the SOURCE deserve a credit?
The first earns a link. The second earns a name in plain text and nothing more."
A credit alone would therefore earn a NAME. What earns the links is that this
card answers a question the video creates: somebody who just watched a Japanese
Abyss Eye pack come open and wants to buy one needs the vendor who sells them at
the local shows, and there is no other way for them to get there. That is the
same argument /shops.html and /card-shows.html turn on, arriving on a page that
was previously a dead end for it. The credit is the OCCASION for the card; the
reader's need is what earns the links.

THE SHAPE IS MET AND WAS COUNTED, not asserted. The card sits BELOW the player
and below the rip's own title and date, never mid explanation; every outbound
link is a small labelled pill next to a large internal one (the pack itself, the
hit cards, both rails); and the last line of the card is INTERNAL, to that
seller's full listing on /shops.html or /vendors.html, which is where the site
keeps the version of these facts that has one date and one source.

WHAT IT DELIBERATELY DOES NOT DO. It does not reproduce a listing. Hours appear
only where the shop states them about itself AND carry the source link and the
read date, which is the rule build-shops.mjs already FAILS THE BUILD over; the
rest of the listing stays one tap away rather than being copied onto 15 pages to
go stale against itself. It prints no price, no stock claim and no opinion about
the seller beyond the site's own `vouched` chip, which appears only where the
owner has said outright that he buys from them.

AND THE BADGE SAYS "PACKS FROM", NOT "BOUGHT FROM", WHICH IS NARROWER THAN WHAT
WAS ASKED FOR AND IS THE HONEST WIDTH. The sentences this is built from say two
different things: "picked these up from @X" is a purchase and "huge thanks to @X
for the packs" is not necessarily one. "Packs from" is true of both. The stronger
claim is carried by `vouched` on the seller's own listing, which is the mark that
already means exactly that everywhere else on this site, and it is set from the
owner saying so rather than inferred from a thank-you.

NOTHING IS HAND TAGGED AND THAT IS THE POINT. shared/pack-source.mjs matches a
YouTube handle in the rip's own description against the `youtube` field on
vendors, shops and creators, so a rip published tomorrow that credits a listed
seller is credited on the site without anybody touching a data file. A BARE
@MENTION IS NOT A CREDIT: the match needs a buying phrase in the same sentence,
because "go follow @X" and "thanks to @X for the packs" are the same string to a
handle search and different claims entirely. Where the sentence does not say it,
nothing renders.

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
  describe. The case for it is good and stands: it is the owner's own collection,
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

**SPLIT ON 23 SEPTEMBER 2026, SAME FOUR KINDS, MORE OF THE FIRST.** The list went
from 11 restaurants to 52 and moved to its own page,
/where-to-get-a-garbage-plate.html, so the restaurant links (site, menu, map,
and the business's own hours page) live there now, one set per card, at the END
of each card and aria-labelled like every other one. The guide keeps the
sources and the photo credits, and its sources now sit under each claim as a
short label (`short` on each source) with the full name in the aria-label and in
the list at the foot. The test is unchanged and so is the shape: a directory
whose job is to send you to dinner is useless without the menu and the address.

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

**THAT MAP CAME OFF /shops.html ON 27 AUGUST 2026 AND THE TWO ODbL LINKS WENT
WITH IT, exactly as the paragraph below said they would.** The owner: "remove the
map and text below it on the local card shop page shops.html just get right into
the listings of the stores", which is word for word the instruction that took
the map off /card-shows.html six days earlier. Measured on the built page, first
shop card's top edge and total page height, before to after:

      390x844    y=1,021 -> y=477     9,070 -> 8,525px    document 96,961 -> 57,449 bytes
      1440x900   y=  915 -> y=317     4,229 -> 3,632px

So a phone reader reaches the first shop **544px sooner** and a desktop reader
**598px sooner**, and the page is 39.5KB lighter, nearly all of it inline SVG.
`data/shop-map.json`, `scripts/sync-shop-map.mjs` and every shop's `at`
coordinate are deliberately UNTOUCHED, the same way `data/card-show-map.json`
was left: the four Overpass queries are the expensive part, not the drawing.
The headstone in build-shops.mjs is what to read before rebuilding it.

**THE PARAGRAPH BELOW IS KEPT AS WRITTEN rather than edited**, because the rule
it establishes is the reusable part and is still live on /card-shows.html: OSM
geometry earns a visible ODbL credit, and that credit is not discretionary. Read
it as history for this page and as current for that one.

/shops.html GAINED TWO LINKS OF THE SAME NON-DISCRETIONARY KIND ON 20 AUGUST
2026, AND THEY ARE WRITTEN DOWN HERE RATHER THAN ADDED QUIETLY, which is the
mistake the paragraphs above spend four screens complaining about. The map at
the top of that page used to be six dots on a plain green field, and its own
caption admitted the gap: "There are no roads on it because we do not have any
to draw." The owner asked for a real map. It now draws roads, water and the City of
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
NON-DISCRETIONARY REASON, AND IT IS THE SAME SENTENCE THAT CAUSED IT. The owner: "on
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

> **SUPERSEDED IN PART ON 11 NOVEMBER 2026 (note added in the restructure; the paragraphs below are kept as written).**
> The statements below that no informational page carries a Subscribe in its body, and that the Subscribe was
> deliberately not added, no longer describe rip pages and set guides. With the owner's approval,
> `shared/channel-pitch.mjs` renders a `.pitch` block: one line of reason, then the `.btn-sub` Subscribe button
> (`SUBSCRIBE` and `SUB_LABEL` from shared/chrome.mjs). On a rip page the button that sat first in `.rip-nav`
> moved into the block, so nothing was added there. On a set guide it is the first Subscribe in the body, under
> the list of that set's rips, and only where the set has a rip to show. The end card also ends its action row
> with Subscribe (see docs/pack-wrapper.md). The line a builder passes in may only repeat the footer's "a new
> rip every day" claim or say something the builder can check from its own data: no number, no subscriber
> count, no pull rate. Other page families were not changed, and the rest of this section still stands:
> video tiles go to /rip/ pages and Subscribe is the only outbound YouTube link.

AND THE SEVENTH EXCEPTION THAT WAS ASKED FOR BY NAME AND STILL NOT MADE, 17
August 2026. The owner stated the site's commercial purpose plainly: YouTube is the
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
