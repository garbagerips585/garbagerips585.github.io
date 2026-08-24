# Pokemon TCG Pocket: plan for /tcg-pocket.html

Research is in `data/tcg-pocket.json`. Every claim there carries a source key and
a read date, and `sourcesReachable` records which hosts answered and which did
not. This file is the argument for what to build from it and, as with
`how-to-play-PLAN.md` and `tcg-live-PLAN.md`, what to leave in the research file
and off the page.

Nothing has been built. No builder, no nav entry, no sitemap line, no search
entry, no OG card. The registration checklist is at the bottom and
`build-search.mjs` fails the build without it.

**Read `tcg-live-PLAN.md` before this one.** The two pages are a pair and the
comparison table is shared between them. Neither page is finished until both
agree.

## The brief, and why this page belongs on this site

the owner plays Pocket. He calls it really fun and casual, it is free, and it is how he
personally learned to play the card game: there is an AI that plays matches and
he watched its moves until the game made sense. That is the hook and it is a
better one than "here is a review of a mobile game", because it is a first-person
claim from the person whose name is on the site, and because it answers a
question a beginner actually has, which is "how do I learn this without somebody
sighing at me across a table".

So the reader is specific. **They are new, or newish, and slightly intimidated by
the actual card game. They have a phone. They may already be holding cards they
cannot play with.** They want something free that will not embarrass them.

That reader shapes every decision below, and so does one hard constraint that
the Live page does not have: **this site's readers play with physical cards, and
Pocket's rules are not the physical game's rules.** Pokemon says so themselves.
A page that sells Pocket as a way to learn without saying that clearly does
active harm to its own reader.

## The one thing to establish before writing a word

`theHook` in the research file is the most important block and its confidence
fields are the important part.

**What is officially documented, firmly, by Pokemon:**

- Solo battles against the computer exist, in the app's own vocabulary: solo
  battles, step-up battles, solo event battles.
- Rental decks exist, work in solo battles, and do not work in versus. You do
  not have to own or build anything to play a real match.
- Battles unlock at player level 3, not on install.
- The app carries its own rules reference: a Tips section and a question mark
  button on most screens, and Pokemon's answer to "what are the rules" is to
  point you into it.
- There is a guided start with tutorial missions and rewards.

**What is NOT documented by Pokemon anywhere that could be reached:**

- The Auto feature. The thing the owner is actually describing, where you switch it on
  in a solo battle and the app plays your side while you watch, is corroborated
  by Wikipedia and by third-party guide sites and by nothing on any Pokemon
  property. Nine of the thirteen Pocket support articles were read in full and
  grepped for it; the Battle Rules FAQ, the official site and both store
  listings were checked. Nothing.

**So write it as a description of what the app does, in plain present tense, and
never as a citation.** "Turn Auto on in a solo battle and the app plays your side
while you watch" is true, matches every source, and is exactly what the owner
describes. Do not write "Pokemon calls it X". Do not cite a wiki on the page.

**And do not let the sourcing gap swallow the hook.** The learn-by-watching
argument does not depend on Auto at all: in any solo battle you are watching a
competent computer take its turns against you, and that half is fully official.
If Auto is one sentence and solo battles are the paragraph, the page is honest
and the hook survives intact.

**One thing to ask the owner before shipping.** He has the app open every day. What is
the button actually labelled, and where is it? That is a thirty second question
that settles the only naming problem on the page, and `couldNotVerify` says so.

## The page

URL `/tcg-pocket.html`. H1 as a question, matching the rest of the site:

**"Can you learn the card game from an app?"**

That is a better H1 than "Pokemon TCG Pocket" for the same three reasons the
Live page's H1 is better than its app's name. It is the question this reader
actually has. It is not a phrase Pokemon's own SEO owns outright. And it is
honest about what the page is: a first-person answer, with a caveat, rather than
an app review.

The `<title>` and the deck under the H1 carry the app's name so the page is still
findable as "Pokemon TCG Pocket guide". Something like: "Pokemon TCG Pocket is
free, it is on your phone, and it is how the owner learned. Here is what it teaches you
and what it does not."

**Budget: 1,300 to 1,600 words of body copy.** Slightly less than the Live page
because this page has no multi-step instruction in it: there is no redemption
process, no account creation, no desktop installer. It is a "what is this and
should I get it" page, and those go wrong by padding. Counted the way
`/how-to-play.html` counts, with tags and entities stripped, and enforced in the
builder the same way.

### Order, and why this order

1. What it is, and the owner's claim (~150 words)
2. **What it teaches you, and what it does not (~350 words)**, the anchor
3. Your pack codes do not work here (~150 words)
4. Which one should you install: Pocket or Live (~250 words, mostly a table)
5. How to get it (~150 words)
6. What is actually in it (~300 words)
7. Tips for your first week (~250 words)

**Sections 2 and 3 both go before the download section, and that is the
structural argument of this plan.** Section 2 because the caveat has to arrive
while the reader is still excited rather than after they have installed
something. Section 3 because every reader of this site is holding code cards and
will ask about them within about eight seconds, and a page that lets that
question sit unanswered for a thousand words has lost them.

Section 4 goes before "how to get it" for the obvious reason: the comparison is
the decision, and the download instructions are what you read after you have
made it.

### What goes in each section

**1. What it is, and the owner's claim (~150 words)**

Two short paragraphs. Pokemon Trading Card Game Pocket is the official free
Pokemon card game for phones, made by Creatures Inc., who made the physical card
game, and DeNA. It came out on 30 October 2024. You open two free packs a day and
you can battle.

Then the owner's claim, in his voice, as the reason the page exists. He learned by
watching the app play. Name solo battles and Auto here in one sentence each and
move on; section 2 is where the argument gets made.

**One line of history and no more.** No soft launch, no roadmap, no expansion
list.

**2. What it teaches you, and what it does not (~350 words). THE ANCHOR**

Lead with Pokemon's own sentence, because it is the single most useful quote
available for this page and it means the whole section is us reporting their
position rather than us editorialising:

> The rules of Pokemon TCG Pocket are different from the Pokemon Trading Card
> Game.

Put it in a callout, not buried in a paragraph. Attribute it to Pokemon's own
support site with the date.

Then the two lists, in this order, because the good news has to come first or
the section reads as a warning:

**What carries over.** Basic, Stage 1 and Stage 2 Pokemon and evolution. Attacks
with Energy costs. Weakness. Retreat. Abilities. Trainer and Supporter cards.
One Active Pokemon facing your opponent's with the rest on the Bench. Draw a card
at the start of your turn. Knock Outs. That is most of what makes the card game
feel like the card game, and it is why the owner's claim is true.

**What does not.** Four differences, no more, chosen because each one would
actually trip somebody up at a table:

- **The deck is 20 cards, not 60.** Two copies of a name, not four.
- **There are no Energy cards.** An Energy Zone hands you one Energy a turn.
  This is the one that matters most: somebody who learned on Pocket builds a
  physical deck with no Energy in it and cannot attack. Say that out loud.
- **There are no Prize cards.** You score three points instead. Say it as an
  absence, which is how a physical player will experience it.
- **The Bench is smaller.**

**On the Bench number.** `singleSourced` is blunt: the three comes from
Bulbapedia and no official page states it. Either write "the Bench is smaller
than the five you get with physical cards", which needs no wiki, or print three
and attribute it in the source note. **Do not print three unattributed.** The
first option is better and costs nothing.

Close the section by sending people to the real rules:

> The full rules of the game you play with actual cards are on
> [our how to play page](/how-to-play.html), and they are the ones to have in
> your head at a table.

**3. Your pack codes do not work here (~150 words)**

Short, blunt, high on the page. The code card in a physical booster pack is for
Pokemon TCG Live, and Pokemon says so in as many words in their own article about
what is in a booster pack. Pocket has no pack code redemption at all.

Then one paragraph to defuse the word "code": Pocket does have gift codes, they
come from campaigns and events rather than from packs, and they are entered on a
web page rather than in the app. **Name no codes**, per `forbidden.giftCodeLists`.

Link the Live page from here, once, as the place that explains what the code card
is worth. That is the whole handoff between the two pages and it does not need
more than a sentence.

**Added after shipping: one sentence of the channel's own arithmetic**, the count
of English booster packs opened on camera, which is the number `/tcg-live.html`
builds a section around. It belongs here in one line and no more. On that page it
is the subject; here it is only scale for "your pack codes do not work", and a
second paragraph of it would pull this section away from its own point. It comes
from `shared/packtally.mjs` at build time, so the two pages cannot disagree, and
it is English packs only for the reason that file's header sets out.

**4. Which one should you install (~250 words, mostly a table)**

**A small table is the right shape here and it is the only table on the page.**
`vsLive.rows` in the research file has eleven candidate rows with a source key on
both sides of each. **Ship seven or eight, not eleven.** The ones that earn their
place, in order:

| | Pocket | Live |
| --- | --- | --- |
| Where it runs | Phones and tablets | Phones, tablets, Windows, Mac |
| Price | Free | Free |
| Account needed | No Pokemon account | Yes, a free Pokemon account |
| Deck size | 20 cards, no Energy cards | 60 cards, the real rules |
| Same rules as your cards | No | Yes |
| Pack code cards | Not used | Yes, every pack code gives a digital pack |
| Trading | Yes, with friends | No |
| Playing the computer | Solo battles, and it can play for you | Guided lessons |

Keep the Price row even though both cells say Free. "Which one costs money" is a
real question and the answer is neither, and a row that says so is worth more
than one saved line.

Above or below the table, one paragraph that actually answers the question rather
than leaving the reader to do the sums, drawn from `vsLive.theOneLineAnswer`:
Live is the card game digitally, Pocket is a smaller faster game of its own, and
installing both costs nothing.

**Do not rank them.** Do not compare install sizes as a criticism. Do not repeat
the Live page's code card material beyond the one sentence in section 3.

**The same table, or at least the same rows in the same order, belongs on the
Live page.** Whoever builds second copies rather than reinvents, and if the Live
page ships first this table is lifted from it. A reader who lands on either page
should get the same answer.

**5. How to get it (~150 words)**

Four facts and stop.

- **Two platforms, both mobile.** App Store and Google Play. No Windows, no Mac,
  no browser. Say it plainly, because the reader has just read a table saying
  Live runs on a desktop.
- **Free**, with optional in-app purchases. Three official sources say so.
- **No Pokemon account.** You pick a region, confirm your age, accept the terms
  and play. **But link a Nintendo, Google or Apple account straight away**,
  because without one a reinstall loses everything and Pokemon says you will not
  be able to recover it yourself. That warning is the most useful sentence in the
  section and it should not be demoted to the tips list.
- **Region and requirements, one sentence each.** If your app store has it you
  can play, and there is no list of excluded regions to print. A phone from the
  last several years with 3GB of RAM running iOS 15 or Android 7 or later, **with
  "as of July 2026" attached inline**, not just in the footer.

The download size is worth one clause, because it is the honest contrast with
Live and this reader may be on a phone with no space.

**6. What is actually in it (~300 words)**

The factual tour, and the section most at risk of turning into a feature list.
Six things, one short paragraph each at most:

- **Two free packs a day**, on a twelve-hour timer. This is the pitch and it is
  quadruple-sourced. It is also the cleanest tie back to the channel: The owner opens
  packs on camera, and this is pack opening that never costs anything.
- **Pack points.** If you never get the card you want, opening packs from an
  expansion earns points that buy a specific card from that expansion, and they
  never expire. **This deserves the most space of the six** because it is the
  thing with no physical equivalent, and because it lets this site make its
  favourite point, that you do not need luck to own a card here, without
  going anywhere near an odds figure.
- **Wonder Pick.** You take a card out of a pack somebody else opened. Describe
  the mechanic, never the likelihood. "You pick one card from a set of face-down
  cards" is a description; anything with "chance" in it is not.
- **Trading, which Live does not have.** Friends only, unlocks two weeks in,
  same rarity both sides, and the app tells you what is eligible. Three sentences.
  It is the most counterintuitive fact on the page: the app called Trading Card
  Game Live does not trade and the casual one does.
- **Solo and versus.** Solo battles, step-up battles and solo events against the
  computer; versus and a ranked ladder against people. **Ranked gets three
  sentences and no numbers**, same discipline the Live plan set, even though
  Pocket's ranked system is unusually well documented officially.
- **The paid parts, stated flatly.** Poke gold buys speed, the premium pass is a
  monthly subscription, neither is required and the free packs are the game.
  **Print no price.** The only figure found is from November 2024 and Pokemon's
  own current article deliberately refuses to state one. A wrong price on a page
  about somebody else's product is worse than no price.

There is also a collecting side, binders and display boards and flair, and it is
worth one sentence, with a link to `/rarity.html` and an explicit note that
Pocket's rarity marks are its own and not the ones on your physical cards.

**7. Tips for your first week (~250 words)**

Six or seven from `tipsForNewPlayers.tips`, no more. The strongest, roughly in
order: link an account on day one; open both free packs daily and claim before
the day rolls over; do not panic when there is no Battle button, it unlocks at
level 3; use a rental deck for your first matches; play the solo battles first
and watch what the computer does; buy the card you want with pack points; add
friends early because trading and sharing unlock two weeks in.

**On the daily reset.** It is 6:00 a.m. UTC, which is 2:00 a.m. Eastern in summer
and 1:00 a.m. in winter. State the UTC time as Pokemon does, or give the local
time with the daylight saving caveat. **Do not print one local time as if it were
fixed**, which is exactly the class of mistake the home page's frozen relative
dates were.

End the page on the tie back: it is free, it is two minutes a day, and it is how
the guy who runs this channel learned to play. Then send them to
`/how-to-play.html` and to `/shops.html`, which is the same ending
`/how-to-play.html` and the Live page both use and the right one.

## What to leave out, and why

- **Any pull rate, drop rate, odds or "chance of" anything, digital or physical.
  Absolutely and without exception.** Pocket publishes offering rates for its
  digital packs prominently. They were deliberately not read, no number from them
  is in the research file, and no url that leads to them is recorded there on
  purpose. **If you are building this page and you find yourself thinking "but
  this is a digital game and it publishes its own rates openly, quoting them is
  just reporting a published fact". That is the argument the rule exists to
  refuse.** CLAUDE.md forbids linking Live's drop rate page through
  `/how-to-play.html`; the ban is stronger here because Pocket is where a future
  editor will argue hardest for the exception. This also rules out soft forms:
  no "rare", no "hard to pull", no "you will usually get".
- **The "4-diamond or higher guaranteed" pack category** added in version 1.7.1.
  It is a rarity mechanics claim and it sits close enough to the odds rule to be
  left alone. `changedRecently` records why it is absent so nobody re-adds it.
- **A list of active gift codes.** They expire in weeks, they are not from
  Pokemon, and as of the read date third-party trackers were reporting none
  active at all, which is a decent illustration of why a code list on a static
  page is worthless.
- **Turn caps, point values per Pokemon type, and the exact Bench number.** All
  Bulbapedia only. The useful version of the turn cap point, that a match is
  short, follows from the deck size and the three points and needs no wiki.
- **The premium pass price and its contents list.** Dated and version-dependent.
- **The current expansion name.** It will be wrong within weeks. The page should
  not mention Ruler of the Skies or whatever replaces it.
- **Trade tokens, the Motorola crash notice, the web store's Xsolla plumbing,
  the New Zealand soft launch.** All transitional or trivia.
- **Anything about whether the app is good.** No review voice. The owner's first-person
  "this is how I learned" is a fact about the owner and belongs on the page. "It is the
  best mobile card game" is a review and does not.
- **Any claim that there is no chat.** Live has an official statement to that
  effect and Pocket does not. Say what the social features ARE.
- **Deck lists, meta decks, tier lists.** Every third-party Pocket site does this
  and it rots in a fortnight. This page is a 101 and it stays one.

## Pictures, and the answer is the same as the Live page's

**Accept the constraint rather than working around it.** The site does not use
other people's imagery and there are no in-house screenshots.

- **Nothing from Pokemon.** No app screenshots, no store artwork, no icon, no
  card renders, no immersive card captures. Not from the App Store listing, not
  from tcgpocket.pokemon.com, not from the press kit.
- **An inline SVG diagram is the one thing worth building**, and this page has a
  better subject for one than the Live page does. Draw **the two boards side by
  side**: the physical game's Active plus five Bench with six Prize cards down
  the side and Energy cards in the deck, against Pocket's Active plus a smaller
  Bench with a points counter and an Energy Zone. That single picture carries
  section 2's entire argument, it is exactly the kind of thing
  `/how-to-play.html`'s board diagram already does, and it is ours. It also lets
  the Bench be drawn as "smaller" without committing to a number, which neatly
  dodges the one sourcing gap in that section.
- **A second SVG, optional: the code card arrow.** The Live plan proposes a
  one-way arrow diagram, physical pack to code card to Live. If it gets built
  there, this page needs at most a crossed-out branch off it pointing at Pocket,
  and honestly the sentence does that job fine. Do not build two diagrams that
  make the same point on two pages.
- **The pack art the site already owns** is fine as decoration for a header,
  since it is commissioned work used site-wide. Credit stays as it is.

**The owner plays this game daily and films himself opening packs.** A handful of his
own screenshots of the solo battle screen with Auto running would be the one
thing this page cannot otherwise have, and it would settle the button naming at
the same time. Worth asking. **Do not build the page waiting for them.** Ship it
with the SVG.

## Links

Internal:

- **`/how-to-play.html`, twice, and the first one goes at the END of section 2**,
  not at the foot of the page. That page is "here are the real rules"; this page
  just spent 350 words explaining that Pocket's are different, and the reader is
  at peak motivation to go and read the real ones at exactly that moment. The
  second mention is the closing send-off.
  **`build-how-to-play.mjs` already recommends Live in its section 8** and the
  Live plan is already editing that sentence. **Do not add a second recommendation
  there for Pocket.** Two apps recommended in one paragraph of a beginner page is
  one too many, and Live is the correct recommendation for somebody learning the
  real rules. If anything links from that page to this one, it is a short aside,
  and it should be argued in `tcg-live-PLAN.md`'s edit rather than bolted on.
- **`/tcg-live.html`, from section 3 and again from the table.** The pair
  relationship in one line each direction: that page is "what the code card in
  your pack is for", this one is "the free casual one that has nothing to do with
  it".
- **`/start.html`**, both ways. `build-start.mjs` has a paragraph after its six
  numbered questions that points at `/how-to-play.html` as the question that is
  not about a card. The Live plan is already adding Live to that paragraph.
  **Pocket should not get a third sentence in it.** Better: once both pages
  exist, that paragraph names the pair once, "and there are two free official
  apps", with a link to each. **That means editing `scripts/build-start.mjs`,
  and it means coordinating with whoever ships the Live page.** If Live ships
  first, this is an edit to their sentence rather than a new one.
- **`/rarity.html`** from section 6, one line: Pocket has its own rarity ladder
  and it is not the one on your cards.
- **`/shops.html`** from the end, softly, as the conversion link. Same ending
  `/how-to-play.html` uses.
- **Not `/cards.html`, not `/sets/`, not `/buying.html`, not `/selling.html`.**
  Our card and set data is the physical game only, and a page about an app whose
  cards are worth nothing must not link to where to buy or sell things. If
  anything, section 2 should say explicitly that Pocket's A1 and A2 expansions
  are not in our set guides, so a reader does not go hunting.
- **Not `/games/`.** That group is this site's own browser mini-games, built
  in-house. Pocket is not one of them and putting it there would misrepresent
  both. Worth writing down because "games" is the obvious wrong instinct.

Outbound, and **CLAUDE.md's fourth exception covers the shape**:

**One link, not two.** `https://tcgpocket.pokemon.com/en-us/` is the official
site and it carries both store buttons. That is the only outbound link this page
needs, and one link is one decision. Do not link the App Store and Google Play
separately.

It goes in **one block at the very end, after every internal link**, with an
aria-label saying it opens on Pokemon's site, exactly as the playlist cards and
the `/how-to-play.html` block do. There is no equivalent of the Live page's
inline redemption link here, because this page has no step-by-step process in it,
so this page does not need that exception and should not take it.

**Worth flagging to whoever writes the copy:** the official site is thin and
stale. It still calls the game "an upcoming game", carries a 2024 copyright line,
and has no battle, trading or rules content whatsoever. It is the right link for
"download it here" and a poor one for "read more", so the link's label should
promise the download and nothing else.

**One link stays forbidden on this page and it is not a style choice.** Anything
that states Pocket's offering rates. Do not link it, quote it or summarise it.
CLAUDE.md already says this about `/how-to-play.html` and the Live plan extends
it to `/tcg-live.html`; **the sentence should name this page too**, because this
is the page where the argument for an exception is strongest.

## Registration: five places, and the build fails without them

A new page is not done when the HTML exists.

1. **`scripts/build-all.mjs`**: add `node scripts/build-tcg-pocket.mjs` to
   `STEPS`. Position it **before `node scripts/build-search.mjs`**, which is the
   hard constraint: build-search walks `public/*.html` and exits 1 on any
   indexable page missing from its list. It must also run before
   `node scripts/build-pages.mjs`, which writes the sitemap. The natural home is
   immediately after `node scripts/build-tcg-live.mjs`, which itself sits after
   `node scripts/build-how-to-play.mjs`. **If the Live builder does not exist yet
   when you get here, put this one after `build-how-to-play.mjs` and leave a
   comment saying the Live page belongs between them.** Add the house-style
   comment explaining the ordering, as every neighbouring entry does. The final
   step, `python3 scripts/check-build.py`, is the guard that catches the rest.
2. **`shared/chrome.mjs`**: add to the `NAV` group `"Guides"`, immediately after
   the `/tcg-live.html` entry, which itself sits after
   `["/how-to-play.html", "How to play"]`. Those three are a cluster and the
   order is learn, then the real one, then the casual one.
   **Do not add it to `BAR_LINKS`**: the bar is five links and the comment above
   that array argues the number from published research.
   **On the label.** The file's rule is front-loaded nouns, because Nielsen's
   study found users read about two words. "TCG Pocket" front-loads an acronym a
   beginner does not know. "Pokemon TCG Pocket" is three words of brand before
   any information. The Live plan proposes "Play it free" for Live, so this one
   cannot be "Play free on your phone" without the two reading as near-duplicates
   in a menu. **Suggested: "Phone version".** It front-loads the noun that
   actually distinguishes it, it sits under "How to play" and the Live entry
   which give it all the context it needs, and no other label on the site starts
   with "Phone". The alternative worth considering is "Card game app". Pick one
   and **do not ship "TCG Pocket"**.
   **Whoever ships second owns the pair.** If these two labels end up reading as
   two links to the same page, that is exactly the failure `shared/chrome.mjs`'s
   own comment warns about with "Grading" and "Will it grade".
3. **`scripts/build-pages.mjs`**: add to the `urls` array that writes
   `public/sitemap.xml`. Suggested
   `` { loc: `${SITE}/tcg-pocket.html`, freq: "monthly", pri: "0.7" } ``,
   sitting next to the `/tcg-live.html` entry. **Monthly, and 0.7 rather than the
   Live page's 0.8**, a deliberate half-step down again: the rules page does not
   move, Live moves, and Pocket moves fastest of the three. check-build.py fails
   if a sitemap url has no file, and fails again if the page is noindex.
4. **`scripts/build-search.mjs`**: add a line to `PAGES`. Suggested:
   `["/tcg-pocket.html", "Pokemon TCG Pocket", "The free phone version, what it teaches you, and how its rules differ from real cards"]`.
   **This is enforced**: the guard at the bottom of that file exits 1 on any
   indexable page not in the list, and its comment records four pages that
   shipped unsearchable before it existed. Put it directly after the
   `/tcg-live.html` line. Note that `PAGES.slice(0, 8)` also renders the
   empty-state cards on `/search.html`, so inserting here shifts what that page
   shows; **check the rendered result**, because adding two new pages in this
   region pushes two existing cards off the bottom.
   **The title field is the one place the app's actual name should lead**, unlike
   the nav label, because search is where somebody types "pocket".
5. **`scripts/build-og-pages.py`**: add a `PAGES` entry keyed `"tcg-pocket"`,
   which writes `public/assets/og-tcg-pocket.jpg`. Suggested
   `("FREE, ON YOUR PHONE", "Can you learn from an app?", "What Pokemon TCG Pocket teaches you, and what it gets wrong")`.
   The headline is the page's own H1, per that file's own comment, because it is
   the text somebody is deciding whether to click. Wire it as `og:image` and
   `twitter:image` in the builder. check-build.py greps rendered pages for
   `assets/og-*.jpg` and will notice a reference to a file that does not exist.

Also worth doing, though not enforced: `FAQPage` schema, since the section
headings here are question-shaped and seven builders on this site already emit
it. **Do not reach for `SoftwareApplication` schema**: it is Pokemon's app, not
ours, and marking it up as if it were our product is a misrepresentation.

## Where the research is weakest

Read `singleSourced` and `couldNotVerify` in the JSON before writing a line of
copy. The short version:

- **The Auto feature, which is the page's hook, is not documented by Pokemon
  anywhere reachable.** Wikipedia plus a guide site. See the top of this plan for
  how to write around it without losing it.
- **The Bench limit of three is Bulbapedia only.** So are the turn caps and the
  per-Pokemon point values. The rest of the reduced ruleset (20 cards, two copies,
  three points, the Energy Zone, drawing one card) is official and quotable from
  Pokemon's own deck-building guide.
- **`www.pokemon.com` is unreliable rather than blocked.** Two `/us/strategy/`
  articles answered through WebFetch on 2026-08-16 and a third did not; plain
  curl is refused outright with an Incapsula id; `web.archive.org` is not
  fetchable from this tooling, so the usual workaround is gone. The one official
  page we actually wanted, "How to Unlock Battles in Pokemon TCG Pocket", could
  not be read in any variant. Nothing on the page depends on it, because its one
  needed fact is confirmed elsewhere, but **somebody with a browser should read
  it before this ships.**
- **`support.pokemon.com` blocks automated requests and every Pocket article here
  was read through the Zendesk JSON API instead.** That workaround is the reason
  this research exists, the Live research reached the same conclusion
  independently, and **it belongs in CLAUDE.md**. So does the shell note: plain
  `curl` output is truncated by this repo's rtk hook, so every fetch has to be run
  as `rtk proxy 'curl ... -o file'` or the JSON body arrives silently truncated
  and the parse error looks like a broken API.
- **Nothing was learned first-hand.** Every claim is Pokemon's own written
  documentation or a store listing. **The owner plays this daily.** Ten minutes of him
  walking through the first-run flow, the solo battle screen and the Auto button
  would firm up the exact part of the page that most needs it. Worth asking
  before this ships.
- **The good news:** the reduced ruleset, the free daily packs, the pack codes
  being for Live, the price, the platforms and the account model are all firm,
  official and quotable, and those six things are the page's spine.

## The app changes, so the page has to admit it

`/how-to-play.html` carries a dated source note because rules and rotations move.
The Live plan asks for a stronger version because software moves faster than a
rulebook. **This page needs the strongest version of the three**, because Pocket
is two years old, on its seventh major version, and ships a new expansion every
few weeks. Trading did not exist at launch. Sharing did not exist a year in. The
web store is seven months old.

**Three mechanisms, and all three should ship:**

1. **A dated source note at the foot**, in the `hp-src` style
   `/how-to-play.html` already uses. It names the sources, gives the read date
   from `checked` in the JSON, says plainly which claims rest on a wiki rather
   than on Pokemon, and ends with the clause `/how-to-play.html` uses about the
   rulebook: if the app disagrees with this page, the app is right.
2. **Inline dates on the volatile claims**, not just in the footer. The device
   requirements sentence carries "as of July 2026". The deck rules carry the date
   of the official guide they came from. A reader who sees a date beside a number
   treats it correctly; a reader who has to scroll to the footer does not.
3. **A `checked` date rendered near the top**, the way `/grading.html` does with
   its fee table. Cheap, and it is the page's honesty signal.

Set `checked` in `data/tcg-pocket.json` on every research refresh, **not on every
build**. A date that moves because a build ran is a date that means nothing, and
this site already learned that on the home page, where a build-time relative date
turned "TODAY" into a lie the moment deploys stopped.

**One extra, specific to this page:** the source note should say that the app
updates roughly monthly and that features named here have been added since
launch, so a reader who finds something missing knows the page is behind rather
than wrong. That sentence costs nothing and it is the difference between a stale
page and a dishonest one.
