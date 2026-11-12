# The Garbage Plate pages: /garbage-plate.html and /where-to-get-a-garbage-plate.html

Covers the guide and the directory, hours as a spec, sourcing, the photographs and their licenses, and every photo search already run.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## The Garbage Plate page

**IT IS TWO PAGES SINCE 23 SEPTEMBER 2026, BOTH FROM ONE BUILDER AND ONE DATA
FILE.** The owner: "I want it to the Ultimate Garbage Plate 101 guide, and also
the go to destination for garbage plate directory, everywhere in the greater
rochester area that you can get some type of garbage plate ... something that
comes up anytime some one searches what is a garbage plate and also where can i
get a garbage plate". Two questions, two pages:

- **/garbage-plate.html, the 101.** Definition first (the query is "what is a
  garbage plate", so the answer is the first sentence under the h1), a 30 second
  box, a jump bar, the diagram, how to order, a "where to get one" preview that
  hands off to the directory, then the sauce, the history, the variations, a
  price history of the original read off its own archived menus, making one at
  home, and an FAQ (FAQPage schema). `guide`, `thirty` and `faq` in the data;
  every item carries source ids and the builder throws on an unknown one.
- **/where-to-get-a-garbage-plate.html, the directory.** 52 places in six areas
  (`groups`), alphabetical inside each area with Nick Tahou Hots first. Areas
  are ANCHORS, not filters, so the page works with no script. Four filters are
  radio chips plus `:has()` (late night, meatless, bar or brewery, breakfast
  plate); "Open now" is the one that needs a clock and is the one that needs
  JS, and it reads the time in America/New_York whatever the reader's zone.

**HOURS ARE A SPEC NOW, NOT A SENTENCE.** `hoursSpec` ("mon-sat 11:00-22:00;
sun 12:00-22:00", a close before its open runs past midnight, an unnamed day is
UNKNOWN rather than closed) generates BOTH the printed sentence and the data-h
attribute the open-now script reads, so the two cannot disagree. "Late night" is
COMPUTED from it (past 11pm on any night), never typed. A free-text `hours` fails
the build, and the old rule stands: no hoursSrc, no hours. Hours from an
ORDERING page (Toast, DoorDash) are not published, because those are when the
kitchen takes online orders, not when the door is open.

**THE LIST RULE WIDENED BY ONE CLAUSE:** a place qualifies if its own site, its
own menu, OR AN ORDERING PAGE IT RUNS says it serves a plate. Tom Wahl's and
Mark's Texas Hots came OFF the left-off list that way (a readable ordering menu,
and the business's own Facebook page). Facebook-only places with no menu stay in
`leads`, printed on the page. The research behind the 41 additions, including
the dead ends, is summarized in `checkedAndLeftOut` and `leads`.

**THE FOUNDER QUESTION IS SETTLED AND THE PAGE SAYS SO.** Eater 2017 and the
Democrat and Chronicle 2020 became readable (the D&C through archive.org), and
with the 1995 Rochester Business Journal interview of Nick himself, every
first-hand family source names Nick's father, Alexander, as the founder. WHO
INVENTED THE PLATE is still split and stays printed as open. The hot sauce's
origin moved out of `notSourced`: it is the family's own account, first hand
from Alex Tahou twice, and is printed as theirs.

`/garbage-plate.html`, added 20 August 2026 on the owner's ask, built by
`scripts/build-garbage-plate.mjs` from `data/garbage-plate.json`. One builder,
one data file, no sync step and no network: everything on the page was read by a
human and written into the JSON with the source and the read date beside it.

**WHY IT EXISTS, in the owner's words:** "I think there is really some good SEO juice
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

**THE FOUNDER WAS GENUINELY DISPUTED AND THE PAGE SAID SO (SUPERSEDED 23 SEPTEMBER 2026: see the top of this section)** rather than picking a
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
  20 AUGUST 2026** on the owner's call, because every shop card already printed its own
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

The owner photographs things for a living and lives there, so his own pictures are
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
