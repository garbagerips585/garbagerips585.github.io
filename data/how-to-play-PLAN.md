# Pokemon TCG 101: plan for /how-to-play.html

Research is in `data/how-to-play.json`. Every rule there carries a source url
and a read date. This file is the argument for what to build from it, and just
as importantly what to leave in the file and off the page.

Nothing has been built. No builder, nav, sitemap, search or OG entry exists yet.
The registration checklist is at the bottom and the build fails without it.

## The brief, and the one thing that makes it hard

the owner's words: explain it "in a super simple way that someone new can easily
understand and not make it too overwhelming, just giving them the super basics
of how the game is set up, how to play, and how to win" so they can decide
whether to learn it and play at local events or with friends.

The reader opens packs. They have never seen a game played. They are not
looking for rules, they are deciding whether this is a thing they want to do.

So the failure mode is not being wrong, it is being complete. The research file
holds a 44 page rulebook. A faithful summary of it is a page nobody finishes.
The whole job here is subtraction, and the leave-out list below is the more
important half of this plan.

**Budget: under 1,500 words of body copy, and no section may exceed its stated
length.** If a section wants to grow, cut something instead. A rule that does
not change what a first game looks like does not go on this page.

## The page

URL `/how-to-play.html`. H1 as a question, matching the rest of the site:
**"How do you actually play?"** with a deck under it reading something like
"You have the cards. Here is the game they are for."

### Order, and why this order

1. What even is this? (~100 words)
2. The three kinds of card (~150 words)
3. Setting up (~180 words)
4. Your turn (~220 words)
5. Attacking, and the numbers on the card (~220 words)
6. Knock Outs and Prize cards (~140 words)
7. The three ways to win (~100 words)
8. So can I actually play? (~250 words)

Sections 3, 4 and 7 are the owner's own three beats, in his order: set up, play, win.
The three additions earn their place:

- **Section 1 goes first because the audience has no model of the game at all.**
  It must land the shape in one paragraph: two players, 60 cards each, Pokemon
  on the table, take all six of your Prize cards and you win. Every rule after
  that is a detail hanging off a picture the reader already has. Without it the
  page reads as instructions for a machine nobody has described.
- **Section 2 goes second because the turn rules are unreadable without the
  vocabulary.** "One Supporter per turn" means nothing to somebody who has never
  heard the word. Three card types, thirty seconds, then everything after it
  parses.
- **Sections 5 and 6 sit between the turn and the win** because they are the
  mechanism that connects them. A reader who has been told "attack" and "take a
  Prize card" as two separate facts has not been told how the game works.

Winning is stated in one line in section 1 and formally in section 7. That
repetition is deliberate: it is the only thing on the page worth saying twice.

### What goes in each section

**1. What even is this? (~100 words)**
One paragraph. Two players, a 60 card deck each, Pokemon in front of you,
attack each other, first to take all six of their own Prize cards wins. One
line of reassurance that the reader already owns the hard part: the cards.
No rules yet, no numbers except 60 and 6.

**2. The three kinds of card (~150 words)**
Three short blocks, in the rulebook's own framing of "3 different types".
Pokemon (Basic, then Stage 1 and Stage 2 that go on top), Energy (the fuel,
one per turn), Trainer (everything else; Item as many as you like, Supporter
one a turn, Stadium stays on the table, Tool sticks to a Pokemon). One closing
line: the ex, V and VMAX cards you have been pulling are Pokemon too, they just
hit harder and cost you more when they fall, and section 6 says how much.

Link `/rarity.html` here with one line: the stars in the corner are rarity, not
power. Two of the site's pages already read the same corner of the card and
this is the third, so it should say so.

**3. Setting up (~180 words)**
A numbered list, seven steps, lifted almost straight from rulebook page 8 which
is already written for a beginner. Coin flip (winner CHOOSES, and going second
is a real choice), shuffle, draw 7, Basic to the Active spot, up to 5 more on
the Bench, top 6 aside as Prizes, flip everything face up.

Then two callouts, because these are the two things a first game gets wrong:
- **No Basic Pokemon in your seven?** Show your hand, shuffle back, draw seven
  more. Your opponent gets an extra card for the trouble. That is a mulligan.
- **The player who goes first cannot attack on their first turn, and cannot
  play a Supporter either.** That is why the coin flip matters.

Needs a board diagram. See Pictures below.

**4. Your turn (~220 words)**
Three beats: draw one card, do things in any order, attack and stop. Attacking
ending the turn is the single most useful sentence on this page and should be
set apart, not buried in a list.

The once versus unlimited split is a **two column table, not prose**. Prose
about limits is how a beginner loses track of them.

| Once per turn | As often as you like |
| --- | --- |
| Attach an Energy card | Put Basic Pokemon on your Bench |
| Play a Supporter | Evolve different Pokemon |
| Play a Stadium | Play Item and Tool cards |
| Retreat your Active Pokemon | Use Abilities |

One line under it: you do not have to attack, and you do not have to do any of
this. One line that Abilities are the powers printed on some Pokemon that are
not attacks, and using one does not stop you attacking. That is all Abilities
get.

**5. Attacking, and the numbers on the card (~220 words)**
Only your Active Pokemon attacks. Check it has the Energy the attack costs.
A colourless symbol means any Energy pays it. Damage is counters, one counter
is 10.

Then the three printed numbers, and **this is the section most likely to be got
wrong by whoever writes it**:

> Weakness, Resistance and Retreat Cost are printed on each individual card.
> There is no type chart in this game. Whatever that one card says is the
> answer for that one card, and the same Pokemon printed in a different set can
> say something else.

Weakness: bottom left, attacker's type matches, more damage, the card says how
much, and on current cards that is x2. Resistance: same corner, less damage,
current cards print -30, and most cards have none at all. Neither applies to
Benched Pokemon. Retreat Cost: bottom right, the Energy you discard to swap
that Pokemon out for one on your Bench, once a turn, and any Energy pays it.

Needs a labelled card. See Pictures below.

**6. Knock Outs and Prize cards (~140 words)**
Damage reaches HP, the Pokemon and everything attached to it go to the discard
pile, the attacker takes a Prize card, and the defender promotes something from
their Bench. Two things to say out loud because beginners assume the opposite:
**the Prize card you take is one of your own six**, and you do not know what it
is until you take it.

Then the extra prizes, as a small table:

| Knocked out | Prize cards taken |
| --- | --- |
| An ordinary Pokemon | 1 |
| A Pokemon ex, V, VSTAR or GX | 2 |
| A Mega Evolution Pokemon ex, or a VMAX | 3 |

One line of why, because it is the most interesting sentence in the game: the
big card hits harder and lives longer, and losing it hands your opponent half
the game in one turn.

**7. The three ways to win (~100 words)**
Three tiles, in the rulebook's order. Take all six of your Prize cards. Leave
your opponent with no Pokemon in play. Your opponent cannot draw a card at the
start of their turn. One clause each, nothing else.

**8. So can I actually play? (~250 words)**
The section that decides whether the page did its job.

- **A preconstructed deck is a real deck.** The official product guide files
  ex Battle Decks under "START HERE" and says they are ready to play out of the
  box. That is the answer to "do I need to build something first": no.
  Two people need two decks, or one Battle Academy box.
- **The free way in is Pokemon TCG Live.** Official, free, Windows, Mac, iOS
  and Android, with tutorials, and its own site says it is the best way to
  learn at your own pace. It enforces the rules for you, which is worth more to
  a beginner than any written guide, this one included.
- **Then go and play with people.** Link `/shops.html`. That page already lists
  which Rochester shops run leagues, prereleases and a learn-to-play session,
  and it carries the hedges about schedules going stale. This page should not
  restate a word of it.
- **Is my card even legal?** Two sentences, at the very end, in a smaller
  block. Standard is the normal format and uses cards carrying regulation mark
  H, I or J, a single letter printed at the bottom of the card. Expanded goes
  back much further and never rotates. Almost nobody starts there.

**No prices anywhere on this page.** See the price warning in the JSON: no
official price could be read, and a number scraped off a reseller would be
stale within a fortnight. Either a human fills prices into `how-to-play.json`
the way `set-notes.json` takes `packPrice`, or the page says ask the counter and
links `/shops.html`.

## What to leave out, and why

This is the load-bearing half of the plan. Everything below is real, current,
in the research file, and does not go on the page.

**Special Conditions.** Asleep, Burned, Confused, Paralyzed, Poisoned. Five
states, each with its own coin flip, marker or card rotation, plus a resolution
order and a rule about which ones cancel which. It is the single largest block
of rules in the game and none of it is needed to understand a game or decide to
try one. **One sentence total**, somewhere in section 5: cards can put a Pokemon
to sleep or poison it, and the card tells you what happens.

**Pokemon Checkup**, the step between turns where those conditions resolve. It
only exists to hold the thing we just cut.

**The full mulligan timing** on rulebook page 18, which distinguishes both
players mulliganing from one, and counts extra mulligans rather than all of
them. The short version in section 3 is right for a first game.

**Every appendix mechanic.** VSTAR Powers, V-UNION, TAG TEAM, GX attacks,
BREAK, Prism Star, Radiant, ACE SPEC, the Lost Zone, Ancient and Future,
Battle Styles, Trainer's Pokemon, Fossils, regional variants. Twenty-eight
appendices. The page carries **one line**: older and special cards have their
own extra rules, and they are printed on the card. The prize table in section 6
already covers the only part of this that changes a game.

**The 11 Energy types and their personalities.** A whole rulebook page of
flavour. It teaches nothing about how to play and it invites a type-chart
diagram, which is exactly the wrong idea to plant.

**The six step damage calculation order** and the six step attack resolution
sequence. Both exist for edge cases. A beginner does base damage, then Weakness
or Resistance, and that is section 5.

**Deck building numbers.** 12 to 15 Energy, 20 to 25 Trainers. This is a page
about playing, not building. The three legality rules (exactly 60, four copies,
at least one Basic) can appear as a single line in section 8 next to formats, or
be cut entirely, because a preconstructed deck already obeys them.

**Tiebreakers, both players winning at once, "up to" versus "any amount", what
counts as a Pokemon's name, drawing more cards than you have, the difference
between decking out and being told to draw by a card.** All real, all in the
JSON, none of them things a first game meets.

**Stadium detail** beyond "one per turn and it stays on the table". The
same-name rule and the replacement rule are section 2's problem only if section
2 is too long.

**The Unlimited format.** Naming a third format costs the reader more than it
gives them.

**Anything resembling odds.** The site's hard rule. Note that the TCG Live page
links "Card Drop Rate Information" and it is deliberately not recorded in the
research file: do not link it, quote it or summarise it.

**How long a game takes.** No source we read gives a figure. The rulebook says
"fast and furious" and that is the publisher describing its own product. Do not
put a number of minutes on the page.

## Two source traps for whoever builds this

Both are recorded in full in the `disagreements` block of the JSON.

**The rulebook tells beginners to buy a League Battle Deck. The product guide
files League Battle Decks under "FOR EXPERIENCED TRAINERS".** Both are official
and both are current. The rulebook line looks like a product name that was
search-and-replaced in July 2026 without the tiering being rechecked; the March
2026 printing said "Mega Battle Deck" in the same sentence. **Follow the product
guide.** Point beginners at ex Battle Decks or Battle Academy.

**The official Quick Start Rules PDF is a simplification, not the rules.** It
opens with "The first player to Knock Out 6 Pokemon wins the game!", which stops
being true the moment a Pokemon ex is on the table, and its main setup has no
Bench and no face-down step. It is excellent for phrasing and useless for
adjudicating. The ME05 rulebook wins every disagreement.

## Pictures

Two are worth building and the rest are not.

**A board diagram.** Active spot, Bench, deck, discard pile, Prize cards, for
both players. Inline SVG, both themes, no images. This is the single highest
value thing on the page: the reader has never seen a table laid out and every
section after 3 refers to positions on it. Label the Prize cards clearly, since
section 6 depends on the reader knowing they are their own.

**A labelled card.** HP, attack cost, damage, Weakness, Resistance, Retreat
Cost. Use a **real scan**, not a drawing, and pick a plain Basic Pokemon with a
Resistance printed on it so the label has something to point at. Rules the site
already learned the hard way and that apply here:
- Call `imgDims()` in `shared/format.mjs` rather than declaring width and height
  by hand, and check `data/no-scan.json` first: 101 TCGdex bases 404.
- Use `avifPicture()` so the avif is served with webp underneath.
- `<img loading="lazy">`, never a CSS background. rarity.html went from 2,536KB
  to 388KB making exactly this change, and a background cannot be lazy.
- Re-screenshot at 390px after adding it. Doing this on rarity.html brought the
  scans into reach of a later rule at equal specificity and turned magnified
  corners into whole shrunken cards, which looks almost right.

**Not worth building:** a turn flowchart (the two column table does the job in
less space), an evolution chain diagram, and above all any kind of type chart,
which would teach the exact thing section 5 exists to deny.

## Links

Inbound and internal:
- `/start.html` links here, and this page links back. Start here is the
  question-shaped front door and "what even is this game" is a question it does
  not currently answer. **This means editing `scripts/build-start.mjs` as well**,
  which is a second builder and easy to forget.
- `/shops.html` from section 8. This is the conversion link on the page and the
  reason it exists: the brief ends at "play at local events or with friends".
- `/rarity.html` from section 2, one line, rarity is not power.
- `/card-shows.html` from section 8 but softer. Shows are for buying, not for
  playing, so it is a smaller "while you are here" rather than a next step.
- Not `/what-set.html`, not `/cards.html`, not `/buying.html`. Every extra link
  in a beginner page is a chance to leave it.

Outbound, and **this needs a decision before it ships**. CLAUDE.md says every
click stays on the site, and names exactly three deliberate exceptions:
Subscribe, the social icons, and the playlist cards, the last of which it calls
a known trade rather than an oversight. This page wants four more: TCG Live,
the official Learn to Play hub, the Quick Start PDF and the full rulebook PDF.

The case for allowing them: we cannot host the rules, the free digital client is
the single best beginner recommendation available, and a 101 page that refuses
to name the official free way to learn is worse for the reader than one that
does. The case against: four outbound links on one page is more than the rest of
the site combined outside the playlists.

Proposed shape: **one "Where to learn more" block at the very end**, after the
last internal link, three or four links, each labelled as leaving the site with
an aria-label saying so, exactly as the playlist cards do. Warn on the rulebook
PDF: it is 44 pages and roughly 50MB, which is a genuinely hostile thing to open
on a phone. And **update the outbound-links paragraph in CLAUDE.md in the same
commit**, because that file already records what happens when the rule and the
pages disagree and the pages win quietly.

## Registration: five places, and the build fails without them

A new page is not done when the HTML exists.

1. **`scripts/build-all.mjs`**: add `node scripts/build-how-to-play.mjs` to
   `STEPS`. Position it **before `node scripts/build-search.mjs`**, which is the
   hard constraint: build-search walks `public/*.html` and exits 1 on any
   indexable page missing from its list. Next to `build-start.mjs` is the
   natural home, since the two pages are a pair. The final step,
   `python3 scripts/check-build.py`, is the guard that catches the rest.
2. **`shared/chrome.mjs`**: add `["/how-to-play.html", "How to play"]` to the
   `NAV` group `"Guides"`, immediately after `["/start.html", "Start here"]`.
   That file is the only place nav is defined and the menu, the desktop bar and
   the footer all derive from it. **Do not add it to `BAR_LINKS`**: the bar is
   five links and the comment above it argues that number from published
   research. Nav labels on this site are short because 35% of users see about
   two words; "How to play" is three and already load-bearing at the front.
3. **`scripts/build-pages.mjs`**: add to the `urls` array that writes
   `public/sitemap.xml`. Suggested
   `{ loc: `${SITE}/how-to-play.html`, freq: "monthly", pri: "0.9" }`, sitting
   next to `/start.html` and `/rarity.html`. Monthly because the rules do not
   move; 0.9 because it is evergreen and the best long-tail target added to this
   site since the rarity guide. "How to play Pokemon cards" is asked constantly
   and the answer does not expire. check-build.py fails if a sitemap url has no
   file, and fails again if the page is noindex.
4. **`scripts/build-search.mjs`**: add a line to `PAGES`. Suggested:
   `["/how-to-play.html", "How to play", "The card game itself: setup, a turn, and the three ways to win"]`.
   This is enforced: the guard at the bottom of that file exits 1 on any
   indexable page not listed, which is why four pages were unsearchable before
   it existed.
5. **`scripts/build-og-pages.py`**: add a `PAGES` entry keyed `"how-to-play"`,
   which writes `public/assets/og-how-to-play.jpg`. Suggested
   `("NEVER PLAYED A GAME?", "How do you actually play?", "Setup, a turn, and the three ways to win")`.
   The headline should be the page's own H1, because that is the text somebody
   is deciding whether to click. Wire it as `og:image` and `twitter:image` in
   the builder.

Also worth doing, though not enforced: give the page `FAQPage` schema if its
headings end up genuinely question shaped, which seven builders on this site
already do including `build-start.mjs`. Do not reach for `HowTo` schema.

## Where the research is weakest

Read `couldNotVerify` and `singleSourced` in the JSON before writing copy. The
short version:

- **No official prices could be read.** pokemoncenter.com blocks automated
  requests. Do not put a price on the page.
- **Nobody could confirm officially that league play is free or beginner
  friendly.** support.pokemon.com is behind Cloudflare and
  championships.pokemon.com rendered empty. The page may say what the rulebook
  says, which is that shops run leagues and you should ask yours, and link
  `/shops.html`. It may not assert that events are free.
- **Special Energy is single sourced to Bulbapedia.** The official rulebook
  defines Basic Energy and never defines Special Energy. The claim is safe but
  it is the weakest thing in the file.
- **"The first player still draws a card"** is established by the absence of an
  exception rather than by a positive statement. Older eras of this game did
  skip that draw, so do not write from memory here.
- **Everything else is firm**, from the current official rulebook, and mostly
  stated twice: the setup, the whole turn structure, the once-per-turn limits,
  all three ways to win, the card categories, Weakness, Resistance, Retreat
  Cost, Knock Outs and every prize count.

## Rules change, so date the page

The rulebook read for this is stamped "LAST UPDATED: JULY 2026" and the March
2026 printing was diffed against it line by line: nothing in setup, the turn,
winning, prizes or the printed card numbers moved. The two things that did are
in `changedRecently`, and neither changes play.

Standard rotates annually and the legal regulation marks in this file (H, I, J)
have a shelf life measured in months. The page should carry the `checked` date
from the JSON wherever it states them, the way `/grading.html` does with its fee
table, so a reader can see how old the answer is.
