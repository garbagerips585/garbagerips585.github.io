# Pokemon TCG Live: plan for /tcg-live.html

Research is in `data/tcg-live.json`. Every claim there carries a source key and
a read date, and the sources block records which hosts answered and which did
not. This file is the argument for what to build from it and, as with
`how-to-play-PLAN.md`, what to leave in the file and off the page.

Nothing has been built. No builder, no nav entry, no sitemap line, no search
entry, no OG card. The registration checklist is at the bottom and
`build-search.mjs` fails the build without it.

## The brief, and why this page belongs on this site

Tim plays TCG Live himself and scans the code cards from the packs he opens on
camera. That is the hook and it is a genuinely good one: the code card is the
only thing in a booster pack that this site has never had a word to say about.
The rest of the site prices the cards, grades them, checks them for fakes and
tells you where to sell them. The code card gets thrown in a pile.

So the reader is specific and easy to picture. **They have just opened packs.
They are holding a stack of code cards. They want to know what those are worth
doing something with.** They may or may not want to learn the game; the site
already has a page for that.

That reader shapes every decision below. The code card section is the reason
the page exists, it goes near the top, and it is the longest section. The
"how to play" section is short by design because `/how-to-play.html` exists.

## The page

URL `/tcg-live.html`. H1 as a question, matching the rest of the site:
**"What is the code card in the pack?"**

That is a better H1 than "Pokemon TCG Live" for three reasons. It is the
question this audience actually has. It is a phrase nobody else's SEO page
uses, while "Pokemon TCG Live" is a term the official site owns outright and
we will never outrank. And it is honest about what the page is: a guide to Live
written from the code card end, not a general app review.

The `<title>` and the deck under the H1 carry the app's name so the page is
still findable as "Pokemon TCG Live guide". Something like:
"You get one in every pack. Here is the free game it opens, and what the code
actually gets you."

**Budget: 1,400 to 1,800 words of body copy.** Slightly more than
`/how-to-play.html`'s 1,500 because this page has a genuine how-to component
with steps in it, but not much more. Counted the same way that page counts, with
tags and entities stripped, and enforced in the builder the same way.

### Order, and why this order

1. What is this thing? (~120 words)
2. **What the code actually gets you (~350 words)**, the anchor
3. How to redeem it (~250 words)
4. How to get the app (~200 words)
5. It is not the same game as the one on your table (~300 words)
6. Tips for your first week (~250 words)
7. Does any of it mean anything? (~200 words)

**The code section goes SECOND, before the download section, and that is the
whole structural argument of this plan.** Every other guide to this app on the
internet opens with installation because that is the chronological order.
Chronological is wrong here. The reader is holding a code card and has not
decided whether to install anything, so the page has to answer "what is this
bit of cardboard for" before it earns the right to ask them to download 3GB.
Section 1 exists only to give them the one-paragraph frame that makes section 2
parse.

Section 5 is the digital-specific section. It is deliberately framed as a
difference rather than as a tutorial, which is what keeps it from turning into a
second copy of `/how-to-play.html`.

Section 7 is the real-world value section, and it goes last because it is the
one that takes something away.

### What goes in each section

**1. What is this thing? (~120 words)**
One paragraph. Pokemon TCG Live is the official video game version of the card
game, it is free, it is the same rules, and every booster pack comes with a
code for it. One line of history and no more: it replaced Pokemon TCG Online,
which shut down in June 2023. Do not relitigate the beta. There is no official
source that supports a tone judgement about how the launch went, and this is a
how-to, not a review.

**2. What the code actually gets you (~350 words). THE ANCHOR**

Lead with the misconception, because it is the thing everyone gets wrong:

> The digital pack is not a copy of the pack you just opened. It is its own
> pack from the same set.

That is quoted almost verbatim from the official FAQ and it is the single most
useful sentence available. Put it in a callout, not buried in a paragraph.

Then, in order:
- Booster pack code → one digital pack from the same set. Firm and official.
- Preconstructed deck code → that same deck, digitally, same cards. Firm and
  official, and the contrast with boosters is the point: **a deck code gives you
  the same cards, a pack code does not.**
- Everything else (ETBs, collection boxes, tins, bundles) → it varies, and
  Pokemon changed it in July 2025. **Do not print a product-by-product table.**
  The research file explains why: the July 2025 announcement expanded the
  rewards and says contents differ by product, and the only description of ETB
  code contents anywhere is a wiki line that may now describe the old system.
  What to write instead, which is both true and more useful: the packs inside an
  ETB each carry their own code, and the box's own code varies, and **the app
  tells you what you are getting before you claim it**.
- Single use, one account, forever. Official, and it is the fact that makes the
  "should I sell these" question answer itself in section 7.
- Expiry. Say Pokemon publishes no expiry date for pack codes, so an old shoebox
  is worth trying. **Do not write "codes never expire."** The research file has
  this as established by absence, not by a statement.
- The soft limit, and the reality check. 400 booster codes per set before extra
  ones start paying currency instead. That number is safe to print: it is
  official, it is quoted, and it is not an odds figure. Frame it as "most people
  will never hit it", not "you will never hit it", because a channel that opens
  cases has viewers who might.

**3. How to redeem it (~250 words)**
Two routes, both official, presented as a choice rather than a sequence.

In the app: Shop → Redeem → type it or scan the QR code with a webcam → check
the item → Claim Now. Note that packs land in the Inbox under the Menu rather
than straight into the collection, because that is where people think a code has
failed when it has not.

On the web: `redeem.tcg.pokemon.com`, log in, enter, Submit, Claim Now.

Three warnings, all sourced, all short:
- Being logged in to pokemon.com is not the same as being logged in here. Check
  the account before typing anything.
- If the Redeem option is not in the app on your phone, use the website. **Word
  it exactly like that.** The research file has the full argument: the official
  FAQ's own heading names Android and desktop and not iOS, but Pokemon never
  says iOS is excluded and third-party videos claim otherwise. The sentence
  above is true in both worlds and is what the reader needs either way. Do not
  write "you cannot redeem in the app on iPhone."
- Do not bin the code card until the reward has landed. Support asks for the
  code number and says a claim without it may be dismissed. This is the most
  channel-relevant tip on the page: somebody filming an opening throws code
  cards in a heap.

**4. How to get the app (~200 words)**
Four platforms: iPhone and iPad, Android, Windows, Mac. **No browser version;
you download an app.** Say that plainly, because "is there a web version" is the
obvious question after a section that just sent them to a website to redeem.

Two things worth flagging that most guides do not:
- Windows and Mac are direct downloads from Pokemon's site, not store apps. A
  reader hunting the Microsoft Store or the Mac App Store will not find it.
- You need a free Pokemon account, the same one Pokemon uses for everything.
  Name it both ways once: the support site now says Pokemon Trainer Central and
  older material says Pokemon Trainer Club.

One line on child accounts, because this audience skews young and it is the one
thing a parent needs.

**System requirements: one sentence, not a table.** The four minimums (iOS 15,
macOS Monterey 12, Windows 10, Android 9) plus "Pokemon raises these; these were
current in April 2026." A four-row table of recommended specs is more page
weight and more staleness for a reader who is going to find out in thirty
seconds by trying it. If a future editor wants the table, the data is in the
JSON.

Region: one sentence. Available in most of the world; if your app store has it,
you can play. The research file explains why it cannot be stated more precisely,
and there is no list of excluded regions to print.

**5. It is not the same game as the one on your table (~300 words)**

This is the digital-specific section and its job is to be *different from*
`/how-to-play.html`, not shorter than it. Open by sending people there:

> The rules are the same rules. If you have never played at all, [read those
> first](/how-to-play.html) and come back.

Then only what changes because it is software:
- **It teaches you and then enforces the rules.** The Learning Lab is guided
  lessons against the computer, you can replay them, and conceding one costs you
  nothing. This is the pitch: no rules argument, no missed trigger.
- **You start with ready-made decks.** "A handful", not "eight". The number is
  App Store marketing copy and version-dependent.
- **You do not need luck to own a card.** Deck building works completely
  differently: spend Trade Credits in the deck editor and the card is yours.
  This deserves the most space in the section because it is the biggest
  structural difference from the physical hobby and nobody expects it.
- **Duplicates are not waste.** Past four copies, extras convert to Trade
  Credits automatically. Say it out loud that this is the opposite of how
  opening physical packs feels.
- **Two currencies, one line each.** Trainer Points buy packs and cosmetics and
  come from quests and levelling. Trade Credits buy one specific card and come
  from levelling and from duplicates. Leave the retired Coins currency out
  entirely: single-sourced, historical, and a new player will never see it.
- **Rarity is cosmetic here.** The fancy print plays identically. One line, and
  link `/rarity.html`, because it is a cleaner statement of that page's own
  "rarity is not power" line than the physical game allows.
- **A Battle Pass per set, free, earned by playing.** Do not print a tier count
  or a reward list.
- **No chat.** One line. Preset reactions only.

**6. Tips for your first week (~250 words)**
Six or seven, no more, from the `tips` array. The strongest ones, roughly in
order: redeem codes before spending anything; check which account you are in;
play the starter decks first; spend Trade Credits on cards a deck needs rather
than on the pretty version, because it is final and not refundable; duplicates
are working for you; use the Learning Lab even if you know the rules.

**Ranked play gets three sentences and no numbers.** It exists, it resets
monthly, the top of it is the Arceus League. The research file is blunt that the
entire ladder block is single-sourced to Bulbapedia and that no official ladder
documentation exists. Printing point values and tier-drop caps would be the
weakest content on the page and the fastest to rot. If any number survives
editing, the page's source note must attribute it to the wiki.

**7. Does any of it mean anything? (~200 words)**
The honest section, and the one this site is better placed to write than anybody
else, because it already refuses to overstate what cards are worth.

- The only bridge between physical and digital is the code card, and it runs one
  way. Nothing goes back.
- Live is not a collection tracker for the cards you own in real life. Pokemon
  had one, Card Dex, and shut it down in September 2023 with no data export.
- There is no trading. The Trading Card Game does not trade.
- **Nothing in it is worth money.** Quote the Terms of Use directly: virtual
  content has no monetary value and may not be redeemed for currency or anything
  of value outside the game. State it flat, no hedging. It is the honest
  counterweight to a page that has just spent a thousand words telling somebody
  their code cards are free stuff.
- Selling code cards: **do not answer this.** Say what is verifiable (a redeemed
  code is dead, so the only sellable thing is an unredeemed one; Pokemon's terms
  restrict transferring virtual content) and stop. No links to code sellers, no
  prices. It is a legal-shaped question and the page has no business answering
  it. `forbidden.codeCardResale` in the JSON says the same.

End on the pitch, which is also the tie back to the channel: the code card is
the only thing in the pack with no collector value at all, and this is what it
is for.

## What to leave out, and why

- **Any pull rate or drop rate, digital or physical. Absolutely and without
  exception.** Pokemon publishes drop rates for Live's digital packs at a url
  recorded in `forbidden.dropRatePage` in the JSON. That page was deliberately
  not fetched and no number from it exists in the research file. CLAUDE.md
  already forbids linking it from `/how-to-play.html`; the ban is stronger here,
  because a page about Live is exactly where a reader and a future editor would
  both assume it belonged. **If you are building this page and you find yourself
  thinking "but this is the digital version, the odds are published, it is
  different". That is the argument the rule exists to refuse.**
- **A list of active promo codes.** Several third-party sites publish them. They
  expire in weeks and they are not from Pokemon. A code list turns an evergreen
  page into one that lies. If the page mentions giveaways at all, it says they
  happen and points at the official forums, and names no code.
- **A product-by-product table of what each box's code gives.** See section 2.
- **The recommended-specs table.** Minimums only.
- **Ladder point values, tier drop caps, the Elo number.** Single-sourced and
  volatile.
- **The retired Coins currency, the TCG Online migration mechanics, the beta
  region rollout.** History a new player will never touch. The migration FAQ is
  in the research file if somebody ever wants a "I have an old TCGO account"
  page, which would be a different page.
- **Any claim about whether non-English pack codes work.** Nothing found in
  either direction, and the site has international set guides so it will be
  asked. Leaving it unanswered is correct.
- **Anything about how good the app is.** No review voice. No "it had a rough
  launch but". Nothing sourceable, and it dates instantly.

## Pictures, and the honest answer is almost none

**This is the hardest constraint on the page and it should be accepted rather
than worked around.** The site's rule is that it does not use other people's
imagery, and there are no in-house screenshots of the app.

What is legitimately available:

- **Nothing from Pokemon.** No app screenshots, no store artwork, no icon, no
  card renders from the client, no Battle Pass art. Not from the App Store
  listing, not from tcg.pokemon.com, not from the press kit. The site does not
  do this and this page is not the exception.
- **No photo of a code card.** Obvious and wrong: a real code card is a real
  code, and publishing a photograph of one either burns it or publishes a used
  one that misleads. Even blurred, it is a bad idea.
- **An inline SVG diagram is the one thing worth building.** The site already
  builds these (`/how-to-play.html`'s board diagram) and they cost nothing, work
  in both themes and are ours. The right subject is **the one-way arrow**:
  physical pack → code card → digital pack in the app, with the return arrow
  drawn and crossed out. That diagram carries section 7's whole argument in a
  glance and there is no other page on the site where it would make sense.
- **A second SVG, optional: the redemption path**, as two labelled routes (app:
  Shop → Redeem → Claim; web: log in → enter → Claim) converging on "it lands in
  your Inbox". Only build it if section 3 reads long in prose. A two-branch
  flow is one of the few things a diagram genuinely does better than a list.
- **The pack art the site already owns** is fine as decoration if the page wants
  a header image, since it is commissioned work the site uses everywhere. Credit
  stays as it is site-wide.

If Tim wants real screenshots later, he can take them himself, and that is worth
saying to him: he plays this game and he films himself opening packs, so a
handful of his own captures would be the one thing this page cannot otherwise
have. **Do not build the page waiting for them.** Ship it with the SVG.

## Links

Internal, and this page is unusually well connected:

- **`/how-to-play.html`, from the top of section 5 and again from section 6.**
  The relationship is a pair, in both directions: that page is "what is the game
  the cards are for", this one is "here is the free way to actually play it".
  **`build-how-to-play.mjs` already recommends TCG Live in its section 8** ("The
  free way in is Pokemon TCG Live") and currently sends that reader straight
  off-site. Once this page exists, that sentence should link *here* first, with
  the official site still in the outbound block at the foot. **That means
  editing `scripts/build-how-to-play.mjs` too, which is a second builder and
  easy to forget**, exactly the note `how-to-play-PLAN.md` made about
  `build-start.mjs`.
- **`/start.html`**, both ways. Start here is the question-shaped front door with
  six numbered questions, and "what is the code card in the pack" is a question
  it does not answer. This does not need a seventh numbered step: the page
  already has a paragraph after the six that points at `/how-to-play.html` as
  "one question that is not about a card at all", and this page belongs in that
  same paragraph. **That means editing `scripts/build-start.mjs`.**
- **`/rarity.html`** from section 5, one line: rarity in Live is cosmetic.
- **`/shops.html`** from the end, softly. Live is the free way in; the shops page
  is where you go once you want to play against a person. It is the same
  conversion link `/how-to-play.html` uses and it is the right ending.
- Not `/cards.html`, not `/buying.html`, not `/selling.html`, and **especially
  not from section 7**. A section explaining that digital cards are worth
  nothing must not be followed by a link to where to sell things.

Outbound, and **CLAUDE.md's fourth exception already covers the shape of this**:

CLAUDE.md now records that `/how-to-play.html` ends with one labelled block of
four links to Pokemon's own sites, argued in the file rather than made quietly,
with the shape as the mitigation: one block, at the very end, after every
internal link, each with an aria-label saying it opens on Pokemon's site.

**A link to the official app is the same shape of thing and should be presented
the same way, with two differences.**

1. **Fewer links. Two, not four.** This page needs the official TCG Live page
   (`https://tcg.pokemon.com/en-us/tcgl/`, which is where the four download
   links live) and the redemption page (`https://redeem.tcg.pokemon.com/en-us/`).
   Both are load-bearing: a guide that tells you to download an app and then
   refuses to say where is useless, and the same goes for one that explains
   redemption without linking the redeemer. Nothing else earns a slot. Do not
   link the App Store and Google Play separately; the official page carries all
   four platforms and one link is one decision.
2. **The redemption link is the exception to "one block at the end".** It is not
   a "learn more" link, it is a step in an instruction, and burying step three of
   a four-step process 900 words below where the reader is standing is worse for
   them than the outbound rule is good for us. **Proposed: the redeem link may
   appear inline in section 3**, labelled and aria-labelled as leaving the site
   exactly like the others, and both links repeat in the end block. If whoever
   builds this disagrees, put both in the end block only and name the domain in
   plain text in section 3 so the reader can type it. Either is defensible;
   pick one and write down which in CLAUDE.md.

**And update CLAUDE.md's outbound-links section in the same commit.** That file
already records, twice, what happens when the rule and the pages disagree and
the pages win quietly. The exception here is smaller than the `/how-to-play.html`
one and is arguably already covered by it, but "arguably already covered" is how
the playlist cards went four years undocumented. Write the paragraph.

**One link stays forbidden on this page and it is not a style choice.** The
official TCG Live page links "Card Drop Rate Information". Do not link it, quote
it or summarise it. CLAUDE.md already says this about `/how-to-play.html` and the
sentence should be extended to name this page too, because this is the page where
somebody will argue it belongs.

## Registration: five places, and the build fails without them

A new page is not done when the HTML exists.

1. **`scripts/build-all.mjs`**: add `node scripts/build-tcg-live.mjs` to `STEPS`.
   Position it **before `node scripts/build-search.mjs`**, which is the hard
   constraint: build-search walks `public/*.html` and exits 1 on any indexable
   page missing from its list. The natural home is immediately after
   `node scripts/build-how-to-play.mjs`, which already sits next to
   `build-start.mjs` for the same "these pages are a pair" reason. Add the
   comment in the house style saying so. The final step,
   `python3 scripts/check-build.py`, is the guard that catches the rest.
2. **`shared/chrome.mjs`**: add `["/tcg-live.html", "Play it free"]` to the `NAV`
   group `"Guides"`, immediately after `["/how-to-play.html", "How to play"]`.
   That file is the only place nav is defined; the bar, the mobile menu and the
   footer all derive from it. **Do not add it to `BAR_LINKS`**: the bar is five
   links and the comment above that array argues the number from published
   research.
   **On the label.** The file's own rule is front-loaded nouns, because
   Nielsen's study found users read about two words. "TCG Live" front-loads an
   acronym a beginner does not know. "Pokemon TCG Live" is three words of brand
   before any information. "Play it free" spends the budget on the offer and
   sits directly under "How to play", which gives it the context it needs. The
   alternative worth considering is "Play free online". Pick one; do not ship
   "TCG Live".
3. **`scripts/build-pages.mjs`**: add to the `urls` array that writes
   `public/sitemap.xml`. Suggested
   `{ loc: `${SITE}/tcg-live.html`, freq: "monthly", pri: "0.8" }`, sitting next
   to `/how-to-play.html`. **Monthly, and 0.8 rather than 0.9**, which is a
   deliberate half-step below the rules page: the rules do not move and this page
   describes software that does, so the page is less evergreen than its
   neighbour even though it is more current. check-build.py fails if a sitemap
   url has no file, and fails again if the page is noindex.
4. **`scripts/build-search.mjs`**: add a line to `PAGES`. Suggested:
   `["/tcg-live.html", "Play it free online", "The code card in every pack, what it unlocks, and the free official app"]`.
   **This is enforced**: the guard at the bottom of that file exits 1 on any
   indexable page not in the list. Put it directly after the `/how-to-play.html`
   line. Note that `PAGES.slice(0, 8)` also renders the empty-state cards on
   `/search.html`, so a line inserted at position 3 changes what that page shows;
   inserting after how-to-play keeps it inside the first eight, which is
   probably right for a page this useful, but check the rendered result.
5. **`scripts/build-og-pages.py`**: add a `PAGES` entry keyed `"tcg-live"`, which
   writes `public/assets/og-tcg-live.jpg`. Suggested
   `("EVERY PACK HAS ONE", "What is the code card?", "The free official app it opens, and what the code gets you")`.
   The headline is the page's own H1, per that file's own comment, because it is
   the text somebody is deciding whether to click. Wire it as `og:image` and
   `twitter:image` in the builder. check-build.py greps rendered pages for
   `assets/og-*.jpg` and will notice a reference to a file that does not exist.

Also worth doing, though not enforced: `FAQPage` schema, since the section
headings here are genuinely question-shaped and seven builders on this site
already emit it, `build-start.mjs` included. Do not reach for `SoftwareApplication`
schema: it is Pokemon's app, not ours, and marking it up as if it were our
product is a misrepresentation.

## Where the research is weakest

Read `singleSourced` and `couldNotVerify` in the JSON before writing a line of
copy. The short version:

- **The whole ranked ladder section is Bulbapedia.** No official documentation of
  the ladder exists that could be found on any Pokemon property. The official
  sources confirm only that ranked play and leagues exist and that the top one is
  the Arceus League. Three sentences, no numbers.
- **support.pokemon.com blocks automated requests** and every article in this
  file was read through the Zendesk JSON API instead
  (`/api/v2/help_center/en-us/articles/<id>.json`, plus a working search
  endpoint). That workaround is the reason this research exists and it belongs in
  CLAUDE.md next to the existing note about `www.pokemon.com`. Incidentally,
  `www.pokemon.com` *did* answer on 2026-08-16, which contradicts the standing
  note; do not rely on it either way.
- **Code expiry is established by absence.** No official statement exists in
  either direction. The page must word it as "Pokemon publishes no expiry date"
  and not as "they never expire".
- **iOS in-app redemption is unresolved.** One official heading implies it is
  Android and desktop only; nothing official excludes iOS; third-party videos
  claim it works. The page gives the website as the fallback and does not
  adjudicate.
- **Nothing was learned first-hand about the redemption screen.**
  `redeem.tcg.pokemon.com` is a login-walled JS shell. Every step in section 3 is
  Pokemon's own written instructions, not observation. **Tim has an account and
  plays this game.** Ten minutes of him walking through a redemption would firm
  up the one section of the page that most needs it, and would settle the iOS
  question outright. Worth asking before this ships.
- **Everything in the code card section is firm, official and quotable**, which
  is the good news, because it is the section the page exists for. What a booster
  code gives, what a deck code gives, single use, one account, the soft limits,
  the app showing you the reward before you claim, and the instruction to keep
  the card: all from the official Code Card Redemption FAQ, last edited
  2026-01-30, read 2026-08-16.

## The app changes, so the page has to admit it

`/how-to-play.html` carries a dated source note because rules and rotations move.
This page needs a stronger version of the same thing, because software moves
faster than a rulebook and this one has changed platform requirements twice in
eighteen months and changed what code cards give in July 2025.

**Three mechanisms, and all three should ship:**

1. **A dated source note at the foot**, in the `hp-src` style
   `/how-to-play.html` already uses. It names the sources, gives the read date
   from `checked` in the JSON, says which claims rest on Bulbapedia rather than
   on Pokemon, and says plainly that this is software: if the app disagrees with
   this page, the app is right. That last clause is the same move
   `/how-to-play.html` makes with the rulebook and it is the right one.
2. **Inline dates on the two most volatile claims**, not just in the footer. The
   system requirements sentence carries "as of April 2026". The Expanded-format
   sentence carries the date of the article it came from. A reader who sees a
   date beside a number treats it correctly; a reader who has to scroll to the
   footer does not.
3. **A `checked` date rendered near the top**, the way `/grading.html` does with
   its fee table. This is the page's honesty signal and it is cheap: one field in
   the JSON, one line in the builder.

Set `checked` in `data/tcg-live.json` on every research refresh, not on every
build. A date that moves because a build ran is a date that means nothing, and
this site already learned that lesson on the home page, where a build-time
relative date turned "TODAY" into a lie the moment deploys stopped.
