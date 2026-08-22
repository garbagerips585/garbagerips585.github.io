#!/usr/bin/env node
// Build /games/chase-match.html: a memory game played with the 100 most
// valuable raw cards in Pokemon.
//
//   node scripts/build-chase-match.mjs
//
// WHY THIS EXISTS. Tim asked for it in one sentence: "a bunch of pokemon cards
// face down, so you only see the back of the cards, and then when you press a
// card it flips over and reveals a pokemon and then flips back over, you have
// to match the pokemon ... lets pick the top 100 most valuable raw cards are
// the card we use for the memory game, that way its fun to see and find all
// the top chase cards in all of pokemon".
//
// The brief under that is the one every game on this site is built to and it is
// written at the top of build-games.mjs: somebody standing in a restock line,
// one hand, phone upright, venue wifi, and the line can move at any moment.
// Concentration is a very good fit for that brief and that is the actual reason
// to build it rather than a fifth quiz:
//
//   - It is pure tapping. No typing, no aiming, no reaction time.
//   - It has NO clock, so being interrupted costs nothing.
//   - A round is over in a minute or two and the next one is one tap away.
//   - The reward is a PICTURE, which is what makes this card list worth playing
//     with rather than a deck of coloured squares.
//
// ===========================================================================
// THE RESEARCH, AND WHAT IT CHANGED
// ===========================================================================
// Tim asked for research before the code and this section is it. Every number
// below that came from somewhere says where; every one that is a judgement call
// says that instead. Four decisions were REVERSED by the reading, and they are
// flagged as such, because a research note that only confirms what was already
// drafted is a note nobody needed.
//
// ---------------------------------------------------------------------------
// PAIR COUNT AND BOARD SHAPE
// ---------------------------------------------------------------------------
// The tabletop precedents do not survive contact with a phone. Ravensburger's
// memory, the commercial archetype, ships 72 cards / 36 pairs, and classic
// Concentration is a whole 52 card deck laid out in four rows of thirteen. Both
// are table games, sitting down, ten minutes plus. A 36 pair board at a size a
// thumb can hit is several screens tall, and A MEMORY BOARD YOU HAVE TO SCROLL
// IS NOT A MEMORY BOARD: the entire game is holding positions, and a position
// you cannot see is a position you cannot hold.
//
// The digital convention is much smaller and remarkably consistent. Surveying
// the reference implementations people actually copy (freeCodeCamp 4x3,
// Envato Tuts+ 4x4, Code Boxx 4x4, Memozor's adult mode 6 to 21 pairs,
// Solitaire Bliss up to 12), the ladder they converge on is
// 4x3 (6 pairs) then 4x4 (8) then 4x5 (10) then 6x4 (12). 4x4 is the near
// universal default.
//
// SO THE TIERS ARE 6, 8 AND 12 PAIRS AND THE DEFAULT IS 8. On the phone this
// site is built for they are 3x4, 4x4 and 4x6. Four columns is the practical
// ceiling in portrait: at 390px wide with the site's own 24px gutters there is
// 342px of column, which four card-shaped tiles and their gaps fill at about
// 80px each. Five columns puts a 63:88 card under the target size floor below.
//
// HOW LONG A ROUND IS, and this is the one number with real theory under it.
// Velleman and Warrington, "What to Expect in a Game of Memory", American
// Mathematical Monthly 120(9) 2013, solve the expected length of an optimally
// played game with perfect memory: (3 - 2 ln 2) n + 7/8 - 2 ln 2, which is
// about 1.61 pairs-turned per pair on the board. So 9.2 moves for 6 pairs,
// 12.4 for 8 and 18.9 for 12. A casual player runs perhaps 1.5x that and a
// mobile move is three or four seconds all in, which puts these three tiers at
// roughly 45 seconds, 75 seconds and two and a half minutes. Against a median
// mobile session of five to six minutes (GameAnalytics 2025 benchmarks, 11,600
// apps), that is two or three rounds a session, which is the right shape: the
// decision to play one more is the interesting one and it should come round
// often.
//
// THE SAME PAPER GIVES THE PAGE A REAL PAR RATHER THAN AN INVENTED ONE, and
// that matters more to this site than to most. Every other number this site
// publishes is traceable to a source, and "you took 14 moves" means nothing
// without something to compare it to. The win panel prints the theoretical
// figure beside the player's, computed here, from that formula, once. It also
// records why the game feels the way it does: the expected number of times you
// blindly flip a matching pair is ln 2, about 0.69, AT ANY BOARD SIZE. Under
// once a game. There is almost no luck in this genre, which is exactly why a
// bad round feels like your fault and a good one feels earned.
//
// THE TIERS ARE LABELLED BY LENGTH, NOT BY DIFFICULTY. 6 pairs is for a line
// that is moving; 12 is for a line that is not. Calling them Easy and Hard
// would be a lie about the mechanic: nothing gets harder per tap, the round
// gets longer and the memory load grows with it.
//
// ---------------------------------------------------------------------------
// FLIP TIMING, AND THE PART THE OBVIOUS PSYCHOLOGY GETS WRONG
// ---------------------------------------------------------------------------
// Shipped implementations put the mismatch delay between 700 and 1500ms and
// cluster on 1000 (freeCodeCamp 1500, Envato 1000, Code Boxx 1000, the dev.to
// CSS-3D build 700).
//
// THE NAIVE READ OF THE PSYCHOLOGY WOULD PUT IT AN ORDER OF MAGNITUDE LOWER AND
// IT WOULD BE WRONG. Vogel, Woodman and Luck (JEP:HPP 2006) measure
// consolidation into visual working memory at roughly 50ms per item for colours
// and 80 to 100ms per object for shapes, so two cards are "in" inside 200ms.
// But recognition accuracy keeps climbing long past that: 32% at 200ms, 46% at
// 500ms, 54% at 1000ms, 59% at 2000ms. And the Frontiers work on briefly
// presented scenes has the reason: past about 100ms, what memory depends on is
// not exposure but the uninterrupted time available to keep thinking about the
// picture. The player is not encoding pixels, they are BINDING a card to a grid
// position, and that is the slow part. Which is why the empirical sweet spot
// sits near a second and not near a fifth of one.
//
// SO: 900ms, MEASURED FROM WHEN THE FLIP LANDS, NOT FROM THE TAP. That last
// clause is a correction to the first draft, which started a 1100ms timer at
// the tap and therefore gave a 320ms flip animation 780ms of actual looking
// time. The card is up for 900ms after it finishes arriving, 1220ms from the
// tap, and both numbers are in the copy so the page cannot drift from the game.
// Nielsen's 1 second "flow of thought" limit is the ceiling this is working
// under: past about 1.5s the board stops feeling like something you are
// manipulating directly.
//
// THE FLIP ITSELF IS 320ms, WHICH IS SHORTER THAN MOST OF THE FIELD SHIPS.
// Nielsen's animation guidance is 100 to 500ms with 500 already "a real drag",
// and Material puts small mobile animations at 150 to 200 and larger ones at
// 300 to 400. The tutorials above mostly use 400 to 600, which is fine for a
// thing you do twice and wrong for a thing you do sixty times in ninety
// seconds.
//
// AND THE DELAY IS INTERRUPTIBLE, WHICH MATTERS MORE THAN ITS VALUE. A third
// tap during the hold does not queue and is not swallowed: the losing pair
// snaps back synchronously and the new card turns over in the same frame. A
// player who has seen enough never waits for this timer, so the number only
// binds on the players it exists to protect, which is what makes it affordable
// to be generous with.
//
// THE TIMER ALSO STOPS WHEN THE PAGE DOES, and that is the queue showing up in
// the code. The line moves, the phone goes in a pocket, and a pair that was
// face up when the screen went dark is still face up when it comes back.
// visibilitychange, four lines, and it is the honest answer to WCAG 2.2.1
// Timing Adjustable: the flip-back MECHANISM is essential to the game and is
// covered by that criterion's Essential exception, but a fixed duration that
// keeps running while the reader is dealing with the rest of their life is not
// covered by anything. Making the timer stop when the reader stops is a better
// fix than a settings panel nobody in a queue is going to open.
//
// ---------------------------------------------------------------------------
// SCORING: MOVES, AND NO CLOCK AT ALL
// ---------------------------------------------------------------------------
// The genre convention is to show elapsed time and move count together
// (Solitaire Bliss does both; Memozor's own framing is "fewest possible moves
// and in a shortest time"). Half of that convention is wrong for this reader
// and it is the half everybody ships.
//
// AN ELAPSED TIMER CONVERTS EVERY INTERRUPTION INTO A RUINED SCORE. This game
// is for a person in a queue. The queue moves, somebody talks to them, a
// notification lands. A personal best that can only be beaten by nobody
// bothering you for ninety seconds is a best score this site should not be
// asking for, and build-games.mjs already writes the same rule for the quizzes:
// "no forced timer in the default mode".
//
// A MOVE COUNT IS INTERRUPTION PROOF. It is the only score that survives the
// phone going into a pocket, and it has the calibrated par above to sit
// against. One move is one PAIR turned over, so a perfect 8 pair round is 8
// moves and the number is directly comparable to the pair count beside it.
//
// STARS WERE CONSIDERED AND DROPPED. A star rating needs a par, and while this
// game has one, a rating is a JUDGEMENT where the raw pair of numbers is a
// FACT. "14, and perfect play averages 12.4" tells the player everything a
// two-star badge would and does not tell them they were bad at it.
//
// ---------------------------------------------------------------------------
// THE ENDGAME PROBLEM
// ---------------------------------------------------------------------------
// Every memory game has it: by the last two or three pairs the player knows
// every remaining card, so the ending is execution rather than tension, and the
// Velleman and Warrington result quantifies why there is no rescue coming from
// luck.
//
// THE STANDARD FIX IS TO AUTO-RESOLVE THE TAIL, the way every computer Klondike
// offers to play out a solved deal, and IT IS NOT TAKEN HERE. On this board the
// last three pairs are the last three PAYOUTS: each match prints what the card
// is, where it ranks and what a raw copy is worth, and that line is the whole
// reason to use this card list. Auto-resolving the run-out would fast forward
// past the part of the round the game was built for.
//
// What is done instead is that the board only ever gets shorter. A matched card
// STAYS WHERE IT IS, because moving it destroys the positional memory the
// player just spent the round building, and it goes quiet: framed, dimmed,
// aria-disabled, out of the way of the eye. And the win panel totals the board,
// which is the payoff that actually lands: you just matched $712,431 of
// cardboard.
//
// ---------------------------------------------------------------------------
// TWO THINGS THE RESEARCH REVERSED
// ---------------------------------------------------------------------------
// role="grid" WAS DRAFTED AND IS GONE. It looks like the right answer for a
// rectangular board and it is not. The WAI practices sanction layout grids, but
// Adrian Roselli calls the ARIA layout grid "a proper anti-pattern" and has
// asked the W3C to remove it, and Sarah Higley's test is whether the data is
// genuinely two dimensional. In Concentration it is not: there is no
// relationship whatever between card 7 and the card above it, the rectangle is
// a packing decision, and telling a screen reader user they are in a grid
// promises a structure that means nothing. There is also no APG pattern for a
// game board at all, so this is composed from primitives either way.
//
// It is a LIST of BUTTONS. Native buttons bring focus, Enter and Space, the
// right role and correct touch behaviour for free; role="list" gives the "16
// items" orientation cue, and it is written explicitly because list-style:none
// removes the list role in Safari. All sixteen are tabbable, which the roving
// tabindex in the first draft would have prevented: roving is the remedy for a
// two hundred row data grid, not for sixteen buttons, and it makes the arrow
// keys mandatory and undiscoverable. THE ARROW KEYS ARE STILL HERE, layered on
// as an accelerator rather than as the only way through.
//
// prefers-reduced-motion WAS GOING TO BE A CROSSFADE AND THIS SITE WILL NOT
// LET IT BE ONE. The first draft hard-swapped the two faces; the research is
// right that in a sixteen cell grid an instant change is ambiguous about WHICH
// cell just changed, and right that a 150ms opacity dissolve would be the
// standard fix and would be WCAG-clean where a shortened rotateY would not. So
// it was written. It does not run: ui.css carries a blanket
// `*{transition:none!important;animation:none!important}` under the same query,
// which CLAUDE.md names as deliberate, and driving the page with the feature
// emulated showed the computed transition as `none` and the opacity already at
// 1 in the first sampled frame.
//
// The dead rule is not shipped and the ambiguity is answered without motion
// instead: the two cards currently face up wear a teal ring while they are up.
// Static, unmissable, a different colour from the gold a matched card wears,
// and it says which cells are IN PLAY rather than which cell just moved, which
// is more than the fade was going to say. The full argument, and the note that
// changing the site-wide rule is Tim's call rather than a game's, is beside the
// media query in the stylesheet below.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY NOT HERE
// ---------------------------------------------------------------------------
// NO SAVED ROUND. The research recommends persisting an in-progress board,
// because the queue will move and a discarded tab loses the round. It is right,
// and it is not built: it is a second serialisation format and a second set of
// states to get wrong, for a game whose whole round is ninety seconds. If Tim
// wants it, the deck plus the matched set plus the move count is the entire
// payload.
// NO SOUND AND NO HAPTICS. A restock line is a public place and a game that
// beeps in one is a game people turn off. navigator.vibrate is Android only
// anyway; iOS Safari has no web haptics.
// NO STREAK COUNTER. It is the cheapest way to add texture that is not in the
// base rules, and this board already has one: the payout line. Two reward
// channels competing for the same glance is one too many at 390px.
//
// ===========================================================================
// THE CARD BACK IS DRAWN AND IT IS NOT POKEMON'S
// ===========================================================================
// Tim asked for the back to "look like the real back of a real pokemon card".
// It does not, and this is the one place the build departs from the ask.
//
// A card FACE on this site is a scan of a specific card, published beside the
// price and the source for that specific card. That is documentation: the page
// makes a claim about a card and shows you the card it means. THE BACK WOULD BE
// NOTHING OF THE KIND. Every card in the game has the same back, it is repeated
// twelve to twenty-four times on one screen, it identifies no card and
// documents no claim, and it would be there because it looks good. That is
// decoration made out of somebody else's artwork, which is a different thing
// from a scan, and CLAUDE.md's "PACK ART, CARD SCANS AND PRODUCT PHOTOS ON
// THESE CARDS ARE CONTENT" is a rule about content and not about wallpaper.
//
// So the back is OURS. Drawn in this site's own idiom, the same way the Garbage
// Plate in shared/format.mjs is drawn rather than photographed and for the same
// stated reason, and it borrows the COMPOSITION rather than the art: a bordered
// field, a texture, one round emblem dead centre and one mark. That composition
// is what makes a rectangle read as the back of a card at a glance and it is
// common to every trading card ever printed. The emblem is the Garbage Plate,
// this channel's own, on a green field in this site's own palette.
//
// It is also better for the game than a copy would have been. This is the
// Garbage Rips deck: our back, their cards, which is what a rip is.
//
// ONE SYMBOL, USED BY EVERY CARD, not twenty-four copies of a drawing. The
// emblem is a single <symbol> in a hidden sprite referenced by <use>, and the
// field, the border and the texture are CSS gradients on a pseudo element, so a
// 24 card board is 24 short tags and one drawing.
//
// ===========================================================================
// THE CARDS, AND WHAT "RAW" MEANS HERE
// ===========================================================================
// data/top-raw.json, the file /most-valuable-cards.html is built from, cut to
// its top 100 by the same rank field. Nothing new was fetched and no new list
// was sourced: the ask is "the top 100 most valuable raw cards", this site
// already publishes exactly that with its working shown, and a second copy of
// it acquired some other way would be a second answer to a question the site
// has already answered in public.
//
// RAW MEANS PriceCharting's UNGRADED COLUMN, which is a price guide value for a
// loose ungraded copy computed by their algorithm from completed eBay sales and
// their own marketplace. It is NOT an auction result, NOT a live listing and NOT
// a marketplace market price, and the page says so in those words, because
// data/top-raw.json's own readme says no page may describe it as any of those.
// That column is what makes this raw rather than graded: the same crawl holds a
// Grade 9 and a PSA 10 column and /top-graded.html is built on the second.
//
// EVERY LANGUAGE, ON PURPOSE, inherited from the list rather than decided here:
// PriceCharting's Pokemon catalog is not split by language and roughly half of
// the top 100 is Japanese. The argument is in build-top100.mjs's header. It
// reads differently in a game than on a list page and it reads BETTER: a player
// who has never seen a Japanese promo is exactly who this pool is fun for.
//
// THE PRICES ARE A SNAPSHOT AND THE PAGE DATES THEM.
//
// THE TOP 100 ARE THE 100 CLEANEST ROWS IN THAT FILE, checked rather than hoped
// for, and since 22 August 2026 they are SELECTED that way rather than merely
// asserted to be: see the note beside the selection below for the day the two
// stopped being the same thing. verify-raw-top.mjs re-read all 160 rows from a
// second page shape on 2026-08-22 and found 1 disagreement, at rank 98, which
// this pool now steps over. (It was 5 on 2026-08-18, all ranked 118 to 155,
// which is why the cut-at-100 version had never been tested.) Every one of the
// 100 rows this game deals from agreed with itself and every one has an
// image that answered a HEAD request. Both facts are ASSERTED below at build
// time rather than trusted, because a game deals a random sixteen out of a
// hundred, so one bad row is a defect that shows up in one round in six and
// cannot be reproduced by whoever reports it. That is the failure mode
// build-games.mjs throws over for the species artwork and the same answer is
// right here: find it at build time or never find it at all.
//
// ===========================================================================
// WEIGHT: A ROUND IS THE POOL, NOT THE HUNDRED
// ===========================================================================
// 100 card scans is 1,283,732 bytes, measured by HEAD against all hundred urls.
// Shipping that to play with sixteen would be indefensible on the connection
// this game is for, so a round fetches ONLY what it deals: 8 distinct images at
// the default tier, 6 at the short one, 12 at the long one. The two cards of a
// pair share a url and therefore a request.
//
// THE PICTURE IS THE /240.jpg RENDITION, the one /most-valuable-cards.html
// draws and the one verify-raw-top.mjs HEADs on every run. Measured across all
// hundred: 12,837 bytes average, 17,565 largest, 7,995 smallest. /320.jpg also
// exists at every one of them and it is the MASTER rather than a rendition
// (220x298 on the rows checked, and /1600.jpg returns the identical bytes), at
// 20,847 average: 62% more bytes for a picture that gets a two second look
// through a 90px box, with nothing checking that it exists. Not taken.
//
// LAZY LOADING IS WRONG HERE AND THE SITE'S OWN NOTE SAYS WHY. CLAUDE.md
// records that loading="lazy" is a VERTICAL heuristic: it defers what is far
// down the page. Every card on this board is inside the first screen by
// construction, so the attribute would defer nothing and would cost the preload
// scanner for the privilege. What this page does instead is a real deferral the
// attribute cannot express: the other 92 cards are not in the document at all.
// Same shape as the carousel's data-packsrc promotion in build-proto.mjs, and
// it is why a page holding a hundred card list costs a fraction of one.
//
// THE IMAGES LOAD AT DEAL TIME, NOT AT FLIP TIME, which is a deliberate second
// or two of eagerness. A card whose picture arrives after you flip it is a card
// you cannot memorise, and on venue wifi that would be most of them. Loading
// behind the back means the round's pool is decoded before a thumb reaches the
// first card.
//
// ===========================================================================
// ACCESSIBILITY, beyond the two reversals above
// ===========================================================================
// ONE LIVE REGION, PRIMED EMPTY, WRITTEN ONCE PER RESOLVED PAIR. The visible
// payout line under the board updates on every flip, because a sighted player
// wants to see what they just turned over; it is NOT the live region, because a
// fast player produces flip, flip, mismatch, flip, flip, match in about two
// seconds and no screen reader can keep up with that. The live region is a
// separate sr-only paragraph that gets one composed sentence when a pair
// RESOLVES: "Illustrator Pikachu and Rayquaza. No match." The identity of the
// first card of a pair comes from the button's own accessible name, which is
// the case Roselli's dynamic-name testing found works correctly on exactly the
// two platforms this game is built for, VoiceOver with Safari and TalkBack with
// Chrome.
//
// aria-disabled ON A MATCHED CARD, NOT disabled. A disabled button leaves the
// tab order, so a screen reader user loses the ability to survey a board they
// are halfway through. It stays reachable and says it is matched.
//
// TARGET SIZE, AND THE ONE PLACE THE BOARD DOES NOT FIT ITS SCREEN. WCAG 2.2's
// 2.5.8 wants 24x24 CSS px at AA and 2.5.5 wants 44x44 at AAA. The card floor in
// fit() is 44px, which is the AAA figure, and it is a FLOOR rather than a
// target: the board would rather run off a very short screen than hand somebody
// a 30px tap target.
//
// IT BINDS IN EXACTLY ONE CASE AND THE NUMBERS ARE MEASURED. Re-measured in
// headless Chrome at DPR 2 on 20 August 2026, reading getBoundingClientRect off
// the built page after clicking each tier. At 320x568, which is a 2016 iPhone
// SE and the tightest thing this site tests, the grid starts at y=221.13 and
// the 12 pair board needs six rows of 61.5px plus gaps: its bottom lands at
// 614.84 against a 568 viewport, 46.84px over, and that tier scrolls there.
// 6 and 8 pairs end at 481.94, 86.06px clear. All three fit at 390x844 (110 to
// 133px clear) and at 1440x900 (109 to 111px clear).
//
// THAT WAS 43px AND THE TIER BUTTONS PAID THE OTHER FOUR. .cm-tier shipped at
// min-height:40px, four pixels under the same 44px this file spends a section
// defending, so the buttons that choose the board missed the floor the board
// keeps. Raising them to 44 is a WCAG 2.5.5 fix on a control that is on screen
// and tappable at every size, and it costs four pixels of hud height on the one
// tier at the one size that already scrolled. That is the right way round.
//
// THE FIX WOULD BE A 38px CARD AND IT IS NOT TAKEN. 38 clears the AA criterion
// three times over and fails the AAA one, and trading a WCAG success criterion
// for 47 pixels on one tier of one four-inch phone is the wrong way round.
//
// THE OTHER THREE LEVERS WERE MEASURED AND NONE OF THEM CLOSES IT ALONE.
//   - THE RESERVE, 108 to 84: the card stays 44, because at that size the floor
//     is what binds and not the space. Saves 24 of 47.
//   - THE 6x4 SHAPE, which shapeFor already returns above 1000px, dropped to
//     320: four rows of 61.46 plus gaps is 260.8, ending at 481.9, so with the
//     108 reserve it is still 21.9px over. It is also 1px too WIDE -- six 44px
//     cards and five 5px gaps are 289 in a 288px board -- so it trades a
//     vertical overflow for a horizontal one, which is the worse of the two.
//   - BOTH TOGETHER fit, and by 2px. A layout that clears its screen by two
//     pixels is not a fix, it is a coin flip on the next font metric, and it
//     costs the shape rule, the measured reserve and a 1px sideways clip to
//     buy it. Left alone deliberately.
// So the 12 pair tier scrolls at 320x568 and nowhere else. If you want it, the
// honest lever is hiding that tier below some width, which nobody has asked for.
//
// NOT COLOUR ALONE. A matched card is framed AND dimmed AND relabelled, and the
// payout line says "Matched, 3 of 8" in words. 1.4.1 is a Level A criterion and
// a gold border on its own would fail it.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear. Same
// call and the same reasoning as build-garbage-run.mjs and build-games.mjs.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyRound } from "../shared/format.mjs";
// The stylesheet's own comment stripper, reused rather than re-written: it is a
// tokenizer, so a /* inside a quoted value or a url() cannot open a comment.
import { strip as miniCSS } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const desc =
  "A memory game played with the 100 most valuable ungraded Pokemon cards. Flip two, match the card, and find out what you just paired up.";

// ---------------------------------------------------------------------------
// THE POOL
// ---------------------------------------------------------------------------
// The image prefix is stripped from every row and restored in the browser. It
// is the same 55 characters a hundred times, and the same trick build-games.mjs
// uses on the species artwork urls for the same reason.
const IMG_PREFIX = "https://storage.googleapis.com/images.pricecharting.com/";
const REND = "/240.jpg";
const POOL_SIZE = 100;

const raw = JSON.parse(await readFile(join(ROOT, "data/top-raw.json"), "utf8"));
const verified = new Map((raw.verify?.rows || []).map((r) => [r.rank, r]));
// THE HUNDRED IS THE HUNDRED /most-valuable-cards.html PUBLISHES, WHICH IS NOT
// THE SAME THING AS ranks 1 to 100. This used to cut the file at `rank <= 100`
// and then THROW if any of those hundred had failed its re-read, which worked
// only for as long as every contested row happened to land below the cut. On
// the 22 August 2026 crawl one landed at rank 98 (Latias & Latios GX #170, Team
// Up, whose ungraded guide value moved $382.78 between the listing read and the
// product read; the working is in that file's `excluded`), and the build stopped.
//
// The fix is to select the way build-top100.mjs already selects, in one line:
// take the first POOL_SIZE rows that AGREED. The file keeps 160 candidates for
// exactly this, the comment above this block has always said the pool is "the
// 100 cleanest rows in that file", and the page whose list this game claims to
// be dealing from fills its own hundred by the identical rule. Cutting the pool
// to 97 instead, which this file's own error message offered, would have made
// the game quietly stop being the hundred it says it is.
//
// The assertions below are unchanged and are now POST-conditions: if the
// selection cannot find a clean hundred, or a selected row has no picture, that
// is a real fault and still stops the build.
const top = raw.cards
  .filter((c) => verified.get(c.rank)?.status === "agree")
  .sort((a, b) => a.rank - b.rank)
  .slice(0, POOL_SIZE);

if (top.length !== POOL_SIZE) {
  throw new Error(
    `build-chase-match: data/top-raw.json holds ${top.length} rows that agreed with their own ` +
      `re-read, not ${POOL_SIZE}. Run: node scripts/verify-raw-top.mjs`,
  );
}
{
  const noImg = top.filter((c) => verified.get(c.rank)?.imgOk !== true).map((c) => c.rank);
  if (noImg.length) {
    throw new Error(
      `build-chase-match: ${noImg.length} of the top ${POOL_SIZE} have no verified image ` +
        `(rank ${noImg.slice(0, 8).join(", ")}). A card with no picture is a card nobody can match. ` +
        `Run: node scripts/verify-raw-top.mjs`
    );
  }
  const disagreed = top.filter((c) => verified.get(c.rank)?.status === "disagree").map((c) => c.rank);
  if (disagreed.length) {
    throw new Error(
      `build-chase-match: ${disagreed.length} of the top ${POOL_SIZE} did not agree with their own ` +
        `re-read (rank ${disagreed.join(", ")}). This game prints the price on the card it deals, so a ` +
        `contested figure cannot ship in it. Fix the row, or drop the pool below that rank.`
    );
  }
  const odd = top.filter((c) => !c.pcImg || !c.pcImg.startsWith(IMG_PREFIX));
  if (odd.length) {
    throw new Error(
      `build-chase-match: ${odd.length} image urls are not on ${IMG_PREFIX} (rank ` +
        `${odd.map((c) => c.rank).join(", ")}), so the prefix this page strips is no longer shared.`
    );
  }
}

// ONE ROW IS FOUR FIELDS AND IT IS AN ARRAY, not an object, for the reason
// build-games.mjs states about its own payloads: naming every field on every
// row costs more than the rows do. Name, set, rounded price, image key. The
// rank is the index, because the list is sorted by it and a rank field would be
// a hundred numbers counting from one.
const pool = top.map((c) => [
  c.name,
  c.set,
  Math.round(c.ungraded),
  c.pcImg.slice(IMG_PREFIX.length).replace(/\/\d+\.jpg$/, ""),
]);

// A JSON island is script DATA, not markup, so HTML entities are never decoded
// in it and esc() would corrupt it. The one sequence that can break out is
// "</script", and escaping the "<" closes it without touching what JSON.parse
// sees, because < is a legal JSON escape for exactly that character.
const jsonIsland = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

const topValue = moneyRound(top[0].ungraded);
const hundredth = moneyRound(top[POOL_SIZE - 1].ungraded);
const readOn = longDate(raw.checked) || raw.checked;

// ---------------------------------------------------------------------------
// THE TIERS, ONCE, so the prose, the buttons and the game cannot disagree.
// build-garbage-run.mjs learned this with its evolution threshold: the number
// lived in the script and in the copy and the two drifted.
//
// `par` is Velleman and Warrington's expected length of an optimally played
// game with perfect memory, (3 - 2 ln 2) n + 7/8 - 2 ln 2, computed rather than
// typed so a new tier cannot ship with a made up one.
// ---------------------------------------------------------------------------
const par = (n) => (3 - 2 * Math.LN2) * n + 7 / 8 - 2 * Math.LN2;
const TIERS = [
  { id: "s", pairs: 6, label: "6 pairs" },
  { id: "m", pairs: 8, label: "8 pairs" },
  { id: "l", pairs: 12, label: "12 pairs" },
];
const DEFAULT_TIER = "m";
const DEFAULT_PAIRS = TIERS.find((t) => t.id === DEFAULT_TIER).pairs;

/** The flip, in milliseconds. See the timing section of the header. */
const FLIP_MS = 320;
/** How long a losing pair stays up AFTER the flip has landed. */
const HOLD_MS = 900;

const CONF = {
  tiers: TIERS.map((t) => [t.id, t.pairs, +par(t.pairs).toFixed(1)]),
  flip: FLIP_MS,
  hold: HOLD_MS,
  prefix: IMG_PREFIX,
  rend: REND,
};

// ---------------------------------------------------------------------------
// The comment stripper for the page script. Identical to build-garbage-run's
// and identical for the same reason: it can only prove that a line beginning
// with // is a comment if the script holds no multi-line string, so it refuses
// to run on a script containing a backtick rather than silently deleting a line
// out of somebody's template literal. That trap has broken this tree repeatedly.
// ---------------------------------------------------------------------------
function miniJS(js) {
  if (js.indexOf("`") !== -1) {
    throw new Error(
      "build-chase-match: the game script now contains a backtick, so it may " +
      "hold a multi-line string and miniJS can no longer prove that a line " +
      "starting with // is a comment. Use a real tokenizer, or keep the script " +
      "free of template literals."
    );
  }
  return js
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line) => line !== "" && !/^\s*\/\//.test(line))
    .join("\n");
}

// ---------------------------------------------------------------------------
// THE EMBLEM ON THE BACK. See the long note at the top for why it is not a copy
// of Pokemon's.
//
// viewBox 0 0 64 64, and everything in it is sized so it still reads at the
// smallest it is ever drawn: the emblem paints between 25 and 54 CSS pixels
// across depending on the board, so no stroke is under 1.6 units and no detail
// is smaller than 3.
//
// currentColor THROUGHOUT, so it takes its ink from the back's own colour and a
// repaint moves it without this drawing being touched. The one literal is the
// mustard stripe, which is food and keeps its own colour, exactly as
// shared/format.mjs argues for the full plate: "THE CHINA IS THE PALETTE AND
// THE FOOD IS NOT".
// ---------------------------------------------------------------------------
const BACK_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <symbol id="cm-mark" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".9"/>
    <circle cx="32" cy="32" r="24.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".45"/>
    <path d="M13 39c-2.6-7.4 2.4-13.4 8.4-13.4 1.6-6.4 10.6-9 15.6-4.4 6.4-4.4 14.6-.6 14.6 5.2 5.4 1.2 6.4 7.4 1.6 10.6z" fill="currentColor" opacity=".92"/>
    <path d="M17 33.5c5-4.2 8.4 2 13.6-2 5.2-4 9.4 3.8 14.6-1.2" fill="none" stroke="#EFBB25" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="32" cy="42.5" rx="20" ry="5.6" fill="currentColor"/>
    <path d="M12 42.5a20 5.6 0 0 0 40 0" fill="currentColor"/>
    <path d="M18 43a14 3 0 0 0 28 0" fill="none" stroke="#1F382B" stroke-width="1.8" opacity=".55"/>
  </symbol>
</svg>`;

/** The back, on its own, for the figure in the prose. */
const BACK_TILE =
  `<span class="cm-card cm-card--still" aria-hidden="true"><span class="cm-inner">` +
  `<span class="cm-face cm-back"><svg class="cm-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
  `<use href="#cm-mark"></use></svg></span></span></span>`;

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const style = `
.cm-wrap{max-width:620px;margin:0 auto}

/* THE PAGE IS A PLAIN STACK ON A PHONE AND TWO COLUMNS ON A DESKTOP, and the
   two halves are wrapped in the markup rather than placed by name.
   build-garbage-run.mjs does the second thing, giving every child its own grid
   area, and IT DOES NOT WORK ON THIS PAGE: the copy column there is short, and
   here it is 1,400px of prose spanning three auto rows. A grid item that spans
   auto rows distributes its extra height ACROSS them, so the score row above
   the board inflated to about 330px and pushed the board to y=520 in a 900px
   window, where it then solved for a 47px card. Two wrappers and each item in
   exactly one row is the fix, and it costs the phone nothing because there the
   whole thing is block flow. */
.cm-title{margin-bottom:var(--s2)}
.cm-board{min-width:0}

/* ---- THE HUD ------------------------------------------------------------- */
.cm-hud{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:baseline;margin:var(--s4) 0 var(--s3)}
.cm-moves{font:400 var(--t-xl)/1 var(--display);color:var(--ink);font-variant-numeric:tabular-nums}
.cm-stat{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
/* THE TIER ROW TAKES ITS OWN LINE. It is a flex item of the hud and left to
   itself it sat on the baseline beside the score, which put three buttons and
   three numbers into one 390px row and wrapped both. flex-basis is the whole
   fix and it needs no media query. */
.cm-tiers{flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px;margin:0 0 var(--s2);padding:0;list-style:none}
/* 44, NOT THE 40 THAT WAS HERE. This file commits to WCAG 2.5.5's 44px in
   fit(), argues it at length in the header, and would rather run the board off
   a short screen than shrink a card below it -- and then set the three buttons
   that CHOOSE the board four pixels under the same floor. Measured at 390x844
   DPR 2 before the change: 78.98-86.27 x 40.0. The tier row is its own flex
   line (see .cm-tiers above), so the four pixels cost the hud four pixels of
   height and nothing else re-flows. */
.cm-tier{min-height:44px;padding:0 var(--s3);border:2px solid var(--keyline);border-radius:var(--r-pill);
  background:var(--card);color:var(--ink);font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;cursor:pointer}
.cm-tier[aria-pressed="true"]{background:var(--gold);border-color:var(--gold);color:var(--on-accent)}
.cm-tier:hover{border-color:var(--mustard)}
.cm-tier[aria-pressed="true"]:hover{background:var(--mustard);border-color:var(--mustard)}

/* ---- THE BOARD -----------------------------------------------------------
   A LIST OF BUTTONS LAID OUT BY CSS GRID, not an ARIA grid. See the header:
   Concentration has no meaningful row and column relationships, so promising a
   screen reader user a grid promises a structure that means nothing. role="list"
   is written out because list-style:none takes the list role away in Safari.
   The whole board is driven by two custom properties the script sets, so
   nothing in here has to know the tier. */
.cm-board{position:relative;display:flex;justify-content:center}
.cm-grid{--cm-cw:78px;--cm-gap:7px;--cm-cols:4;
  display:grid;grid-template-columns:repeat(var(--cm-cols),var(--cm-cw));
  gap:var(--cm-gap);margin:0;padding:0;list-style:none;justify-content:center}
.cm-cell{display:block;min-width:0}

/* A REAL BUTTON, RESET. The site's button rules are for pills and CTAs and none
   of them fit a 63:88 rectangle, so this resets rather than inherits.
   touch-action:manipulation IS THE FIX FOR THE 350ms TAP DELAY and it is the
   right one of the three: WebKit's own note lists user-scalable=no (which
   breaks pinch zoom and fails WCAG 1.4.4), the width=device-width viewport
   (which only helps at initial scale) and touch-action, which works at every
   zoom level. The old advice that Safari does not support it is out of date:
   partial from iOS 9.3, full from 13.
   THE THREE SUPPRESSIONS UNDER IT are what fast repeated tapping does on a
   phone otherwise: text selection, the iOS long-press callout, and Android's
   grey tap flash on every one of sixteen tiles.
   font-size IS THE CARD WIDTH, which is what lets the drawing on the back be
   written in em and scale with the board without the script touching it.
   --cm-cw is a length, so it can be a font-size directly. */
.cm-card{display:block;width:100%;aspect-ratio:63/88;padding:0;border:0;background:none;
  cursor:pointer;border-radius:8px;font-size:var(--cm-cw,78px);
  touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  perspective:640px}
.cm-card:focus-visible{outline:3px solid var(--sky-deep);outline-offset:3px}

.cm-inner{position:relative;display:block;width:100%;height:100%;
  transform-style:preserve-3d;-webkit-transform-style:preserve-3d;
  transition:transform ${FLIP_MS}ms cubic-bezier(.2,.7,.3,1)}
.cm-card.is-up .cm-inner,.cm-card.is-done .cm-inner{transform:rotateY(180deg)}

.cm-face{position:absolute;inset:0;border-radius:7px;overflow:hidden;
  backface-visibility:hidden;-webkit-backface-visibility:hidden}

/* ---- THE BACK ------------------------------------------------------------
   A bordered field, a texture, one round emblem dead centre and one mark. That
   composition is what makes a rectangle read as the back of a card; the artwork
   in it is this site's own. See the header for why this is not a copy.
   THE BORDER IS A PADDING, NOT A border-width, so it scales with the card:
   these are between 44 and 118px wide depending on the board and the screen,
   and a fixed 5px frame is a slab at the small end and a hairline at the big
   one. */
.cm-back{background:var(--paper-3);padding:7.5%;color:var(--ink-soft)}
.cm-back::before{content:"";position:absolute;inset:7.5%;border-radius:4px;
  background:
    repeating-linear-gradient(135deg,rgba(25,45,34,.30) 0 4px,rgba(25,45,34,0) 4px 9px),
    repeating-linear-gradient(45deg,rgba(25,45,34,.18) 0 4px,rgba(25,45,34,0) 4px 9px),
    radial-gradient(circle at 50% 44%,#37593F 0 34%,#2A4834 34% 68%,#24402F 68% 100%);
  box-shadow:inset 0 0 0 1.5px rgba(228,220,204,.22)}
.cm-mark{position:absolute;left:50%;top:42%;width:46%;height:auto;aspect-ratio:1;
  transform:translate(-50%,-50%);display:block}
/* THE ONE PIECE OF TYPE ON THE CARD, and it is the area code rather than the
   wordmark. "GARBAGE RIPS" was tried first and it cannot be set at this size:
   the card is between 44 and 118px wide, so twelve letters plus tracking come
   out between 3 and 8px tall, which is not small type, it is a grey smear.
   Three digits at the same width are 6 to 16px. It is the more distinctive of
   the two marks anyway. em, so it rides the card width with everything else. */
.cm-back::after{content:"585";position:absolute;left:0;right:0;bottom:10%;
  text-align:center;font:700 .14em/1 var(--mono);letter-spacing:.18em;text-indent:.18em;
  color:var(--ink-soft);opacity:.7}

/* ---- THE FACE ------------------------------------------------------------ */
.cm-front{transform:rotateY(180deg);background:var(--navy-deep);
  box-shadow:inset 0 0 0 1.5px rgba(228,220,204,.28)}
.cm-front img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 50%}

/* ---- IN PLAY, AND MATCHED ------------------------------------------------
   TWO STATES THAT LOOK ALIKE IS THE BUG THIS BLOCK WAS REWRITTEN TO FIX, and it
   was found by opening a capture rather than by reading the CSS. The first
   version gave a matched card a 3px inset ring of var(--gold) and left a card
   that was merely face up unmarked. Two things were wrong with that at once.
   FIRST, --gold IS NOT GOLD. It resolves to #609CBB, a mid teal, which CLAUDE.md
   warns about at length: every token on this site spelling "gold" or "mustard"
   is a teal, and gold proper is reserved for the Hall of Fame. A 3px #609CBB
   ring inside a Japanese Gengar with a yellow border is invisible, which is
   exactly what the screenshot showed.
   SECOND, IT MARKED THE WRONG STATE. Whether a card is matched is knowable from
   three other places already: it stayed up, the counter moved, and the payout
   line said so in words. What is NOT knowable at a glance is which two cards
   are the pair you are comparing RIGHT NOW, which is the whole of the decision
   the player is making.
   So the bright mark is on the LIVE pair and the matched card is what goes
   quiet: dimmed over the board's own green rather than over black, so it settles
   into the board instead of turning into a dark hole, and edged in a neutral
   hairline. Bright teal means in play, dim means done, and they can no longer be
   confused with each other at any motion setting.
   A matched card STAYS WHERE IT IS, whatever it looks like. Clearing it, or
   sliding it into a tray, destroys the positional memory the player has spent
   the round building, which is the one thing this game is made of.
   NOT COLOUR ALONE, because WCAG 1.4.1 is Level A: matched is a dim AND a
   different edge AND an aria-label that says "matched" AND a sentence in the
   payout line. */
.cm-card.is-up .cm-front{box-shadow:inset 0 0 0 3px var(--sky-deep)}
.cm-card.is-done{cursor:default}
.cm-card.is-done .cm-front{background:var(--paper);box-shadow:inset 0 0 0 2px var(--keyline)}
.cm-card.is-done .cm-front img{opacity:.6}

/* The back on its own, in the prose figure. It sets its own --cm-cw so the
   drawing inside it scales exactly as it does on the board. */
.cm-card--still{width:96px;--cm-cw:96px;flex:none;cursor:default;perspective:none}

/* ---- THE PAYOUT LINE -----------------------------------------------------
   One line under the board and it is the whole reward loop: what you just
   turned over, where it ranks and what a raw copy is worth. It is NOT the live
   region, for the reason in the header. min-height so the board does not jump
   the first time it fills. */
.cm-say{min-height:3.4em;margin:var(--s3) 0 0;font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.cm-say b{color:var(--ink)}
.cm-say .cm-price{color:var(--ketchup-deep);font-weight:700;font-variant-numeric:tabular-nums}
.cm-say .cm-rank{display:inline-block;margin-right:6px;padding:2px 7px;border-radius:var(--r-pill);
  background:var(--chip-gold-bg);color:var(--ink);font:700 var(--t-micro)/1.4 var(--mono)}

/* ---- THE WIN PANEL -------------------------------------------------------
   Over the board rather than a screen of its own, because the board behind it
   is what the player just cleared and replacing it throws that away.
   NOT MODAL and no focus trap: everything behind it is finished, and trapping
   focus in a panel whose only control is "deal again" costs a keyboard reader
   the rest of the page for nothing. */
.cm-over{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:var(--s3);padding:var(--s4);border-radius:var(--r);
  background:rgba(16,28,21,.95);color:var(--chrome-ink);text-align:center;overflow:auto;
  animation:cm-in .22s ease-out}
.cm-over[hidden]{display:none}
.cm-over:focus{outline:none}
.cm-over:focus-visible{outline:3px solid var(--sky-deep);outline-offset:-4px}
@keyframes cm-in{from{opacity:0}to{opacity:1}}
.cm-over h2{color:var(--chrome-ink);font:400 var(--t-l)/1.05 var(--display);margin:0}
.cm-over p{color:var(--foot-ink);font-size:var(--t-sm);line-height:1.5;margin:0;max-width:26em}
.cm-total{font:400 var(--t-xl)/1 var(--display);color:var(--ketchup-deep);font-variant-numeric:tabular-nums}
.cm-list{list-style:none;margin:0;padding:0;width:100%;max-width:28em;
  display:flex;flex-direction:column;gap:3px;overflow:auto}
.cm-list li{display:flex;gap:var(--s3);align-items:baseline;justify-content:space-between;
  font:400 var(--t-micro)/1.5 var(--mono);color:var(--chrome-dim);text-align:left}
.cm-list b{color:var(--chrome-ink);font-weight:700}
.cm-list span{flex:none;color:var(--ketchup-deep);font-weight:700}
.cm-go{min-height:48px;padding:0 var(--s5);border:3px solid var(--gold);border-radius:var(--r-pill);
  background:var(--gold);color:var(--on-accent);font:700 var(--t-m)/1 var(--body);cursor:pointer}
.cm-go:hover{background:var(--mustard);border-color:var(--mustard)}
.cm-over a{color:var(--sky-deep)}

/* ---- PROSE --------------------------------------------------------------- */
.cm-lede{margin-top:var(--s5)}
.cm-how{margin-top:var(--s5);color:var(--ink-2);font-size:var(--t-sm);line-height:1.6;max-width:44em}
.cm-how b{color:var(--ink)}
.cm-keys{font:700 var(--t-micro)/1 var(--mono);background:var(--card);border:1px solid var(--hair);
  border-radius:5px;padding:3px 6px;white-space:nowrap}
/* THE BACK, HELD STILL. The same argument build-garbage-run.mjs makes for
   drawing its two sprites rather than screenshotting itself: the game is right
   there, so a picture's only job is to show something the running game does not
   hold still long enough to look at. On a board, the back is face down for a
   second and then it is gone. */
.cm-fig{display:flex;flex-wrap:wrap;gap:var(--s4);align-items:center;margin-top:var(--s4);
  padding:var(--s3) var(--s4);background:var(--card);border:2px solid var(--ink);border-radius:var(--r)}
.cm-fig figcaption{flex:1;min-width:14em;font:400 var(--t-micro)/1.6 var(--mono);color:var(--ink-2)}
.cm-fig figcaption b{color:var(--ink);font-family:var(--body)}

/* ---- REDUCED MOTION ------------------------------------------------------
   THE FLIP STAYS AND THE ROTATION GOES, which is the same call
   build-garbage-run.mjs makes for its own game: a setting that removes the
   mechanic is not an accommodation, and MDN's definition of the feature is
   minimising NON-ESSENTIAL motion. The turn is a decoration on top of an event
   that is really a state change, so the state change happens and the turn does
   not. Every timing in the game is identical either way.

   A 150ms OPACITY CROSSFADE WAS WRITTEN HERE FIRST AND IT DOES NOT RUN ON THIS
   SITE. ui.css line 2856 sets transition and animation to none, with
   !important, on * and both pseudo elements, under this same media query, and
   CLAUDE.md names that as one of three deliberate places reduced motion is
   honoured. Driven over CDP with the feature emulated, the computed transition
   on .cm-front came back none and the opacity read 1 in the first sampled
   frame: 29 samples over 400ms, one distinct value. THE
   RULE WAS CORRECT AND IT WAS DOING NOTHING, which is the worst kind of CSS to
   leave in a file, so it is gone rather than shipped as decoration.

   The argument for wanting it is real and it is recorded rather than acted on:
   WCAG 2.3.3 explicitly excludes opacity shifts that do not change perceived
   size, shape or position from what it means by motion animation, so a
   crossfade would be compliant where a shortened rotateY would not, and in a
   sixteen cell grid an instant change is ambiguous about WHICH cell just
   changed. Getting it would mean carving an exception out of a site-wide rule
   from one page, with an !important against an !important, and that is Tim's
   call about the whole site rather than a game's to make quietly.

   SO THE AMBIGUITY IS ANSWERED WITHOUT MOTION INSTEAD, and the answer turned
   out to be worth having at every motion setting rather than only this one: the
   two cards currently face up wear a bright teal ring for as long as they are
   up. It is static, it needs no transition to survive, it is nothing like what
   a matched card wears, and it says which cells are IN PLAY rather than which
   cell just moved, which is more than the fade was going to say. That rule now
   lives up in the state block above and applies always. Nothing here needs to
   add it back. */
@media (prefers-reduced-motion: reduce) {
  .cm-card{perspective:none}
  .cm-inner{transform-style:flat;-webkit-transform-style:flat}
  .cm-card.is-up .cm-inner,.cm-card.is-done .cm-inner{transform:none}
  .cm-face{backface-visibility:visible;-webkit-backface-visibility:visible}
  .cm-front{transform:none;visibility:hidden}
  .cm-card.is-up .cm-front,.cm-card.is-done .cm-front{visibility:visible}
}

/* ---- SHORT SCREEN AND PHONE ----------------------------------------------
   EVERY PIXEL ABOVE THE BOARD IS A PIXEL OFF THE BOARD, which is as true here
   as it is in Garbage Run: the board is height bound on every phone there is,
   and the card size is whatever the leftover height buys.
   section.cm-sec, NOT .cm-sec: ui.css sets section.tight{padding:48px 0} at
   (0,1,1) and a single class cannot beat it however late it appears. That was a
   live bug in the other game's stylesheet for weeks. */
@media (max-height: 740px), (max-width: 544px) {
  section.cm-sec{padding-top:var(--s2)}
  .cm-wrap .crumbs{display:none}
  .cm-title{font-size:var(--t-l);margin-bottom:4px}
  .cm-hud{margin:var(--s2) 0 var(--s2)}
  .cm-moves{font-size:var(--t-l)}
}

/* ---- DESKTOP -------------------------------------------------------------
   The board keeps its own column and the copy goes beside it, which is what all
   that width is for. The board does NOT grow to fill it: a memory board wants
   to be taken in at one glance, and a 24 card grid spread across 900px of a
   laptop is a board you scan with your neck. The 118px card cap in fit() is
   what holds it, and this block just gives the copy somewhere to go so the page
   is not a column of green. */
@media (min-width: 1000px) {
  .cm-wrap{max-width:1180px}
  .cm-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,420px);
    grid-template-areas:"title title" "play copy" "other other";
    column-gap:var(--s7);align-items:start}
  .cm-title{grid-area:title}
  .cm-play{grid-area:play}
  .cm-copy{grid-area:copy}
  .cm-other{grid-area:other}
  .cm-copy .cm-lede{margin-top:0}
  /* THE TIER ROW ONLY NEEDS ITS OWN LINE WHERE WIDTH IS SCARCE. It takes
     flex-basis:100% above because three pills and three readouts do not share a
     390px row. In a 700px column they do, and the 48px it gives back is 48px of
     board: the board is height bound at 1440x900, so this is 74px cards to
     82px cards for one declaration. */
  .cm-tiers{flex-basis:auto;margin-bottom:0}
}
`;

// ---------------------------------------------------------------------------
// THE GAME
//
// NO TEMPLATE LITERALS IN HERE. miniJS throws on a backtick, because it strips
// comments by line and cannot prove a line starting with // is a comment if a
// multi-line string could be open.
//
// THE STATE IS AUTHORITATIVE AND SYNCHRONOUS AND THE ANIMATION IS A RENDERING
// OF IT, which is the discipline that keeps a chain of setTimeouts from
// producing a board that looks like one thing and is another. There is exactly
// one timer in this game, it is cancellable, and nothing reads the DOM to find
// out what the game thinks.
// ---------------------------------------------------------------------------
const GAME_JS = `
(function () {
  "use strict";
  var board = document.getElementById("cmBoard");
  var gridEl = document.getElementById("cmGrid");
  var conf = null, POOL = null;
  try { conf = JSON.parse(document.getElementById("cmConf").textContent); } catch (e) { conf = null; }
  try { POOL = JSON.parse(document.getElementById("cmPool").textContent); } catch (e) { POOL = null; }
  // THE PAGE SHIPS WITH NO BOARD IN IT AND A noscript SAYING SO, so this is the
  // one path where the script gives up, and it has to leave the page in the
  // state the reader was already looking at rather than half a game.
  if (!board || !gridEl || !conf || !POOL || !POOL.length) return;

  var TIERS = conf.tiers;
  var FLIP = conf.flip;
  var HOLD = conf.hold;
  var IMG = conf.prefix;
  var REND = conf.rend;

  var movesEl = document.getElementById("cmMoves");
  var pairsEl = document.getElementById("cmPairs");
  var bestEl = document.getElementById("cmBest");
  var sayEl = document.getElementById("cmSay");
  var liveEl = document.getElementById("cmLive");
  var overEl = document.getElementById("cmOver");
  var overTitle = document.getElementById("cmOverTitle");
  var overSub = document.getElementById("cmOverSub");
  var overTotal = document.getElementById("cmTotal");
  var overList = document.getElementById("cmOverList");
  var againBtn = document.getElementById("cmAgain");
  var tierBtns = [].slice.call(document.querySelectorAll(".cm-tier"));

  // ---- state --------------------------------------------------------------
  var tier = TIERS[1][0], pairs = TIERS[1][1], parMoves = TIERS[1][2];
  var cards = [];      // one entry per tile on the board
  var up = [];         // the tiles face up and unresolved
  var moves = 0, found = 0;
  var foundRows = [];  // pool indexes matched this round, in the order found
  var cols = 4, rowCount = 4;

  // ---- the one timer ------------------------------------------------------
  // IT PAUSES WHEN THE PAGE DOES. The line moves, the phone goes in a pocket,
  // and a pair that was up when the screen went dark is still up when it comes
  // back. That is the queue showing up in the code, and it is the honest answer
  // to WCAG 2.2.1: the flip-back mechanism is essential to the game, a fixed
  // duration that keeps running while the reader deals with the rest of their
  // life is not covered by anything.
  var holdT = 0, holdLeft = 0, holdFrom = 0;
  function startHold() {
    holdLeft = FLIP + HOLD;
    holdFrom = Date.now();
    holdT = setTimeout(fireHold, holdLeft);
  }
  function fireHold() {
    holdT = 0;
    turnDown(up);
    up = [];
    relabel();
  }
  function cancelHold() {
    if (!holdT) return false;
    clearTimeout(holdT);
    holdT = 0;
    return true;
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (holdT) {
        holdLeft = Math.max(0, holdLeft - (Date.now() - holdFrom));
        clearTimeout(holdT);
        holdT = -1;
      }
    } else if (holdT === -1) {
      holdFrom = Date.now();
      holdT = setTimeout(fireHold, holdLeft);
    }
  });

  // ---- the deck -----------------------------------------------------------
  // THE CURSOR IS WHY YOU SEE ALL HUNDRED. Drawing 8 of 100 independently every
  // round repeats badly: after ten rounds a given card has still only a 57%
  // chance of having turned up, so somebody who plays a whole queue keeps
  // meeting the same Charizards and never meets the rest. This walks a shuffled
  // hundred and reshuffles at the end of it, so ceil(100 / pairs) rounds is
  // every card in the pool: 17 on 6 pairs, 13 on 8, 9 on 12. The prose used to
  // say "thirteen rounds" flat, which is only true on the default tier -- it is
  // computed from TIERS now.
  var order = [], cursor = 0;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function deal(n) {
    var out = [];
    while (out.length < n) {
      if (cursor >= order.length) {
        order = shuffle(POOL.map(function (row, i) { return i; }));
        cursor = 0;
      }
      var idx = order[cursor++];
      // A reshuffle can put a card back in front of the cursor while it is
      // still being dealt into this round, which would make one "pair" a
      // quartet. Skip it rather than restarting the walk.
      if (out.indexOf(idx) === -1) out.push(idx);
    }
    return out;
  }

  // ---- storage ------------------------------------------------------------
  // localStorage throws in a private window on some engines and the game must
  // not care. Same treatment as every other score on this site.
  function readBest() {
    try { return parseInt(localStorage.getItem("gr.chase." + tier), 10) || 0; } catch (e) { return 0; }
  }
  function writeBest(v) {
    try { localStorage.setItem("gr.chase." + tier, String(v)); } catch (e) { /* nothing to do */ }
  }

  // ---- words --------------------------------------------------------------
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function say(markup) { sayEl.innerHTML = markup; }
  // ONE LIVE REGION, WRITTEN ONCE PER RESOLVED PAIR. See the header: a fast
  // player produces two flips and a result in about a second, and a region
  // written on every flip is a region that never finishes a sentence.
  function announce(words) { liveEl.textContent = words; }
  function payout(idx, tail) {
    var row = POOL[idx];
    return '<span class="cm-rank">#' + (idx + 1) + "</span> <b>" + esc(row[0]) + "</b>, " + esc(row[1]) +
      '. <span class="cm-price">' + money(row[2]) + "</span> raw." + (tail ? " " + esc(tail) : "");
  }

  // ---- the board ----------------------------------------------------------
  // COLUMNS ARE FIXED PER TIER AND PER SHAPE rather than solved for. A board
  // that re-flows its columns as the window moves re-shuffles the geometry the
  // player has memorised, which is the one thing a memory game may not do. The
  // card SIZE follows the screen; the LAYOUT does not, and the shape is read
  // once at deal time and held for the whole round.
  function shapeFor(n, wide) {
    if (n === 12) return wide ? [4, 3] : [3, 4];
    if (n === 24) return wide ? [6, 4] : [4, 6];
    return [4, Math.ceil(n / 4)];
  }

  function build() {
    var n = pairs * 2;
    var picks = deal(pairs);
    var deck = shuffle(picks.concat(picks));
    var shape = shapeFor(n, window.innerWidth >= 1000);
    cols = shape[0]; rowCount = shape[1];

    cancelHold();
    cards = []; up = []; moves = 0; found = 0; foundRows = [];
    overEl.hidden = true;
    gridEl.innerHTML = "";
    gridEl.style.setProperty("--cm-cols", String(cols));

    for (var i = 0; i < n; i++) {
      var li = document.createElement("li");
      li.className = "cm-cell";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cm-card";
      btn.setAttribute("data-i", String(i));
      // THE PICTURE IS IN THE DOCUMENT FROM THE MOMENT THE ROUND IS DEALT, and
      // that is the whole loading strategy. See the weight note in the builder:
      // this is the deferral loading="lazy" cannot express, because every card
      // here is inside the first screen and the thing being deferred is the
      // other 92 cards, which are not in the document at all.
      // alt IS EMPTY ON PURPOSE. The button carries the accessible name, and an
      // alt here would have a screen reader read the card twice.
      btn.innerHTML =
        '<span class="cm-inner">' +
          '<span class="cm-face cm-back"><svg class="cm-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#cm-mark"></use></svg></span>' +
          '<span class="cm-face cm-front"><img src="" alt="" decoding="async"></span>' +
        "</span>";
      btn.querySelector("img").src = IMG + POOL[deck[i]][3] + REND;
      li.appendChild(btn);
      gridEl.appendChild(li);
      cards.push({ el: btn, idx: deck[i], done: false, up: false });
    }
    relabel();
    gridEl.setAttribute("aria-label", "Board, " + n + " cards, " + pairs + " pairs to find");
    movesEl.textContent = "0";
    pairsEl.textContent = "0 of " + pairs + " pairs";
    paintBest();
    say("Tap any card to start. " + pairs + " pairs, dealt from the " + POOL.length +
      " most valuable ungraded cards in Pokemon.");
    announce("");
    fit(true);
  }

  function paintBest() {
    var b = readBest();
    bestEl.textContent = b ? "Best " + b : "No best yet";
  }

  // ---- fit ----------------------------------------------------------------
  // THE WHOLE BOARD HAS TO BE ON ONE SCREEN. A memory board you scroll is not
  // one: the game is holding positions, and a position you cannot see is a
  // position you cannot hold. So the card size is solved from whichever of the
  // two available dimensions runs out first, the same way the canvas in Garbage
  // Run is, off the same svh probe and for the same reason.
  //
  // 100svh READ FROM A PROBE, NOT COMPUTED, and NOT innerHeight and NOT dvh.
  // svh is the viewport with the browser's bar SHOWING, which is what the
  // reader has on arrival; dvh grows as they scroll, which would grow the board
  // under their thumb. An unregistered custom property holding 100svh comes
  // back out of getComputedStyle as the string "100svh", because nothing
  // resolves the unit until a box is laid out in it, so a hidden fixed box is
  // the only way to get the number. A browser with no svh drops the declaration
  // and the probe measures 0, which is the fallback signal.
  var probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  function smallVH() { return probe.offsetHeight || document.documentElement.clientHeight; }

  var lastFit = "";
  function fit(force) {
    if (!cards.length) return;
    if (force) lastFit = "";
    var gap = window.innerWidth < 380 ? 5 : 7;
    var r = board.getBoundingClientRect();
    // DOCUMENT SPACE, not viewport space: r.top alone makes the board grow as
    // the reader scrolls, which is a paragraph in build-garbage-run.mjs.
    var top = r.top + (window.scrollY || window.pageYOffset || 0);
    // RESERVE is the payout line plus the section's bottom padding, both of
    // which sit below the board and both of which have to stay on screen: the
    // line under the board is the reward and a reward you have to scroll to is
    // not one. Measured on the built page rather than guessed.
    var availH = Math.max(160, smallVH() - top - 108);
    var availW = Math.max(160, r.width);
    var byW = (availW - (cols - 1) * gap) / cols;
    var byH = ((availH - (rowCount - 1) * gap) / rowCount) * (63 / 88);
    // 44 IS WCAG 2.5.5's ENHANCED TARGET SIZE AND IT IS A FLOOR, NOT A TARGET.
    // The board would rather run off a very short screen than hand somebody a
    // 30px tap target.
    //
    // IT BINDS, AND THIS LINE SAID IT NEVER DID. "On the sizes this site tests
    // it never binds" stood here while the header of this same file spent a
    // paragraph on the one size where it does, which is the shape of false
    // comment this repo keeps getting caught by: a reader who trusts it stops
    // measuring. It binds at 320x568 on the 12 pair tier, where byH solves to
    // about 26px and this Math.max is the sole reason the board overflows.
    // The numbers, the levers that were tried and the reason a 38px card is
    // NOT the fix are all in the TARGET SIZE section of the header. 6 and 8
    // pairs clear 320x568 with room; all three clear 390x844 and 1440x900.
    // 118 IS A DESIGN LIMIT RATHER THAN A LAYOUT ONE. A desktop has room to draw
    // these at 200px and should not: a board you scan with your neck is worse
    // than one you take in with your eyes, and the pictures are a 220px master,
    // so past about 120 the extra size is spent enlarging JPEG.
    var cw = Math.max(44, Math.min(118, Math.floor(Math.min(byW, byH))));
    var key = cw + "/" + gap + "/" + cols;
    if (key === lastFit) return;
    lastFit = key;
    gridEl.style.setProperty("--cm-cw", cw + "px");
    gridEl.style.setProperty("--cm-gap", gap + "px");
  }
  // A RESIZE CAN CROSS THE DESKTOP BREAKPOINT, which changes the SHAPE of the
  // board and not only its size, and re-shaping mid-round would move every card
  // the player has memorised. So only the size follows a resize. The shape
  // follows the next deal.
  window.addEventListener("resize", function () { fit(true); });
  window.addEventListener("orientationchange", function () { fit(true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(true); });

  // ---- labels -------------------------------------------------------------
  function label(card, i) {
    var where = "Card " + (i + 1) + " of " + cards.length;
    if (card.done) return where + ", " + POOL[card.idx][0] + ", matched";
    if (card.up) return where + ", " + POOL[card.idx][0] + ", face up";
    return where + ", face down";
  }
  function relabel() {
    for (var i = 0; i < cards.length; i++) {
      cards[i].el.setAttribute("aria-label", label(cards[i], i));
      // aria-disabled RATHER THAN disabled. A disabled button leaves the tab
      // order, so a screen reader user loses the ability to survey a board they
      // are halfway through.
      if (cards[i].done) cards[i].el.setAttribute("aria-disabled", "true");
      else cards[i].el.removeAttribute("aria-disabled");
    }
  }

  // ---- play ---------------------------------------------------------------
  function turnDown(list) {
    for (var i = 0; i < list.length; i++) {
      list[i].up = false;
      list[i].el.classList.remove("is-up");
    }
  }

  function flip(i) {
    var card = cards[i];
    // The idempotent guard. Every one of these is a real case: a matched card,
    // the same card tapped twice (which must not self-match), and a tap during
    // the win panel.
    if (!card || card.done || card.up || found === pairs) return;
    // A THIRD TAP DOES NOT QUEUE AND IS NOT SWALLOWED. Whoever has seen enough
    // should never wait out the hold, which is what makes a generous hold
    // affordable. The losing pair snaps back synchronously, in the same frame
    // this card turns over in, so the picture on screen can never disagree with
    // what the game thinks is face up.
    if (cancelHold()) { turnDown(up); up = []; }

    card.up = true;
    card.el.classList.add("is-up");
    up.push(card);
    relabel();

    if (up.length < 2) {
      say(payout(card.idx, ""));
      return;
    }

    moves += 1;
    movesEl.textContent = String(moves);
    var first = POOL[up[0].idx][0], second = POOL[up[1].idx][0];

    if (up[0].idx === up[1].idx) {
      var idx = card.idx;
      found += 1;
      foundRows.push(idx);
      for (var k = 0; k < up.length; k++) {
        up[k].done = true;
        up[k].up = false;
        // is-up COMES OFF. It looked harmless because both classes turn the
        // card the same way, so nothing on screen was wrong; what was wrong is
        // that a matched card carried a class saying it was one of the two
        // being resolved, while the state object beside it said the opposite.
        // The header of this file claims the DOM is a rendering of the state,
        // and a stale class is the first step to that stopping being true: the
        // next rule anybody writes for .is-up would silently pick up every card
        // already matched. Found by counting .is-up over CDP and getting three.
        up[k].el.classList.remove("is-up");
        up[k].el.classList.add("is-done");
      }
      up = [];
      pairsEl.textContent = found + " of " + pairs + " pairs";
      relabel();
      say(payout(idx, "Matched, " + found + " of " + pairs + "."));
      announce(first + ". Match, " + found + " of " + pairs + " pairs found.");
      if (found === pairs) win();
      return;
    }

    say(payout(card.idx, "No match."));
    announce(first + " and " + second + ". No match.");
    startHold();
  }

  function win() {
    var best = readBest();
    var record = !best || moves < best;
    if (record) { writeBest(moves); paintBest(); }
    var total = 0, html = "";
    for (var i = 0; i < foundRows.length; i++) {
      var row = POOL[foundRows[i]];
      total += row[2];
      html += "<li><b>" + esc(row[0]) + "</b><span>" + money(row[2]) + "</span></li>";
    }
    overTitle.textContent = record ? "New best: " + moves + " moves" : "Cleared in " + moves + " moves";
    // THE PAR IS A FACT, NOT A RATING. It is the expected length of an optimally
    // played game with perfect memory, from Velleman and Warrington 2013, and it
    // is computed in the builder rather than typed. A player who beat it got
    // lucky as well as good, which is worth telling them.
    // "on a 8 pair board" was the first draft and it is wrong in English every
    // time the tier is 8. Say it as "on N pairs" and the article problem is not
    // a problem, which is a better fix than a lookup table of articles.
    overSub.textContent = "A perfect memory, played perfectly, averages " + parMoves +
      " moves on " + pairs + " pairs. The floor is " + pairs + "." +
      (record || !best ? "" : " Your best is " + best + ".");
    overTotal.textContent = money(total);
    overList.innerHTML = html;
    overEl.hidden = false;
    // Focus the panel, not the button: the panel is labelled by its own heading
    // and described by the line under it, so landing on it reads the result out
    // and a Tab reaches the button. Landing on the button reads the button.
    overEl.focus();
    announce("Board cleared in " + moves + " moves. " + money(total) + " of raw cardboard matched.");
  }

  // ---- input --------------------------------------------------------------
  gridEl.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".cm-card") : null;
    if (!btn) return;
    flip(parseInt(btn.getAttribute("data-i"), 10));
  });

  // ARROW KEYS ARE AN ACCELERATOR, NOT THE ONLY WAY THROUGH. Every card is
  // tabbable, which is the discoverable path and is what the first draft's
  // roving tabindex would have taken away; roving is the remedy for a two
  // hundred row data grid, not for sixteen buttons. These are here for the
  // reader who wants them.
  gridEl.addEventListener("keydown", function (e) {
    var btn = e.target.closest ? e.target.closest(".cm-card") : null;
    if (!btn) return;
    var i = parseInt(btn.getAttribute("data-i"), 10);
    var row = Math.floor(i / cols);
    var to = -1;
    if (e.key === "ArrowRight") to = i + 1;
    else if (e.key === "ArrowLeft") to = i - 1;
    else if (e.key === "ArrowDown") to = i + cols;
    else if (e.key === "ArrowUp") to = i - cols;
    else if (e.key === "Home") to = row * cols;
    else if (e.key === "End") to = Math.min(cards.length - 1, row * cols + cols - 1);
    else return;
    e.preventDefault();
    if (to >= 0 && to < cards.length) cards[to].el.focus();
  });

  againBtn.addEventListener("click", function () {
    build();
    if (cards.length) cards[0].el.focus();
  });

  for (var b = 0; b < tierBtns.length; b++) {
    tierBtns[b].addEventListener("click", function (e) {
      var id = e.currentTarget.getAttribute("data-tier");
      setTier(id);
      try { localStorage.setItem("gr.chase.tier", id); } catch (err) { /* nothing to do */ }
      build();
    });
  }

  function setTier(id) {
    for (var t = 0; t < TIERS.length; t++) {
      if (TIERS[t][0] === id) { tier = id; pairs = TIERS[t][1]; parMoves = TIERS[t][2]; }
    }
    for (var q = 0; q < tierBtns.length; q++) {
      tierBtns[q].setAttribute("aria-pressed", tierBtns[q].getAttribute("data-tier") === tier ? "true" : "false");
    }
  }

  // ---- go -----------------------------------------------------------------
  var saved = null;
  try { saved = localStorage.getItem("gr.chase.tier"); } catch (e) { saved = null; }
  setTier(saved || ${JSON.stringify(DEFAULT_TIER)});
  order = shuffle(POOL.map(function (row, i) { return i; }));
  build();
})();
`;

// ---------------------------------------------------------------------------
// THE PAGE
// ---------------------------------------------------------------------------
// NO " | Garbage Rips 585" IN <title>. CLAUDE.md keeps the suffix on most game
// pages because it renders in full there; this title is already at the length
// where the suffix is the part that gets cut, which is the condition that entry
// names. og:site_name carries the brand beside the result.
const title = "Pokemon Card Memory Game: the 100 Biggest Chase Cards";

const tierButtons = TIERS.map(
  (t) =>
    `<li><button class="cm-tier" type="button" data-tier="${esc(t.id)}" aria-pressed="${
      t.id === DEFAULT_TIER ? "true" : "false"
    }">${esc(t.label)}</button></li>`
).join("\n            ");

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/games/chase-match.html">
<meta property="og:title" content="Chase Match">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/games/chase-match.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
<noscript><style>.cm-hud,.cm-board,.cm-say{display:none}</style></noscript>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Games", item: `${SITE}/games/` },
    { "@type": "ListItem", position: 3, name: "Chase Match" },
  ],
})}</script>
</head>
<body>
${SPRITE}
${BACK_SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight cm-sec">
    <div class="wrap cm-wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/games/">Games</a> / <span>Chase Match</span></nav>

      <div class="cm-layout">
        <h1 class="cm-title">Chase <span class="hl">Match</span></h1>

        <div class="cm-play">
        <div class="cm-hud">
          <ul class="cm-tiers">
            ${tierButtons}
          </ul>
          <div class="cm-moves" id="cmMoves">0</div>
          ${/* THE BIG NUMBER NEEDED A NAME. It shipped as a bare "0" beside
               "0 OF 8" and "NO BEST YET", and looking at the rendered phone
               screenshot it is not possible to tell which of the two counters
               it is.
               THE SECOND HALF OF THIS NOTE WAS WRONG AND HAS BEEN REMOVED. It
               read "Garbage Run gets away with an unlabelled number because
               everybody knows what a score is", which excused the identical
               defect one page over on a distinction that does not hold: that
               numeral is not a score, it is pieces of trash eaten, and the
               evolution the whole game is played for is measured against it.
               build-garbage-run.mjs labels it "trash" now. If you find a third
               bare numeral, label it rather than arguing for it. */ ""}
          <div class="cm-stat">moves</div>
          <div class="cm-stat" id="cmPairs">0 of ${DEFAULT_PAIRS} pairs</div>
          <div class="cm-stat" id="cmBest">No best yet</div>
        </div>

        <div class="cm-board" id="cmBoard">
          <ul class="cm-grid" id="cmGrid" role="list" aria-label="Board"></ul>
          <div class="cm-over" id="cmOver" role="dialog" aria-labelledby="cmOverTitle"
            aria-describedby="cmOverSub" tabindex="-1" hidden>
            <h2 id="cmOverTitle">Cleared</h2>
            <p id="cmOverSub"></p>
            <div class="cm-total" id="cmTotal"></div>
            <p>of raw cardboard, matched.</p>
            <ul class="cm-list" id="cmOverList"></ul>
            <button class="cm-go" id="cmAgain" type="button">Deal again</button>
            <p><a href="/most-valuable-cards.html">See all ${POOL_SIZE} of them, ranked</a></p>
          </div>
        </div>

        <p class="cm-say" id="cmSay"></p>
        ${/* PRIMED EMPTY, IN THE DOCUMENT AT LOAD. A live region created and
             filled in the same tick does not announce, and a region that ships
             with content in it does not announce that content either. It is
             sr-only rather than display:none because display:none breaks the
             registration outright. */ ""}
        <p class="sr-only" id="cmLive" role="status" aria-live="polite"></p>
        </div>

        <div class="cm-copy">
        <noscript><p class="lede cm-lede">Chase Match needs JavaScript, and yours is turned off, so there is no board on
          this page right now. Everything below still says how it works, and the rest of the site reads fine without
          it.</p></noscript>

        <p class="lede cm-lede">Cards face down, tap two, keep the ones that match. The twist is the deck: every card in
          it is one of the ${POOL_SIZE} most valuable ungraded Pokemon cards there are, from a ${esc(topValue)} Illustrator
          Pikachu down to a ${esc(hundredth)} hundredth place. Most of them you will never see in a shop.</p>

        <div class="cm-how">
          <p><b>How it works.</b> Tap a card to turn it over, then tap a second one. A pair stays up and pays out in the
          line under the board: what the card is, what set it came from, where it ranks and what a raw copy of it is
          worth. A miss turns back over ${(HOLD_MS / 1000).toFixed(1)} seconds after it lands, and you never have to
          wait for that: tapping a third card snaps the pair straight back. Put the phone away mid-round and the timer
          stops with it, because the line moves.<br>
          <b>Your score is moves, not seconds.</b> One move is one pair turned over, so a perfect ${DEFAULT_PAIRS} pair
          round is ${DEFAULT_PAIRS} moves. There is deliberately no clock. This is a game for the twenty minutes you
          spend in a restock line, and a best score you can only beat by nobody talking to you is not worth chasing.<br>
          <b>There is a real par to beat.</b> A 2013 paper in the American Mathematical Monthly works out how long this
          game takes when it is played perfectly by somebody who forgets nothing:
          ${TIERS.map((t) => `${par(t.pairs).toFixed(1)} moves on ${t.pairs} pairs`).join(", ")}. The same paper is why
          a bad round stings: you blindly turn over a matching pair less than once a game, at any board size, so there
          is almost no luck in this to blame.<br>
          <b>Keyboard plays it.</b> <span class="cm-keys">Tab</span> walks the board, the
          <span class="cm-keys">arrow keys</span> jump around it, and <span class="cm-keys">Enter</span> or
          <span class="cm-keys">space</span> turns a card over.<br>
          <b>Play the deck out and you have seen all ${POOL_SIZE}.</b> That is
          ${TIERS.map((t) => `${Math.ceil(POOL_SIZE / t.pairs)} rounds on ${t.pairs} pairs`).join(", ")}. The deck is
          walked in a shuffled order rather than drawn fresh every time, so the same cards do not keep coming back
          before the rest have had a turn.<br>
          <b>Nothing is saved anywhere but your own phone.</b> Your best move count lives in this browser and goes away
          if you clear it.</p>

          <figure class="cm-fig">
            ${BACK_TILE}
            <figcaption><b>That back is ours, not Pokemon's.</b> The real one is Nintendo's artwork, and the same card
              back repeated twenty-four times as a game texture is decoration rather than the documentation this site
              publishes card scans as. So the deck is ours: the Garbage Plate on a green field, drawn the same way the
              plate on the buying and selling pages is drawn. The faces are the real cards.</figcaption>
          </figure>

          <p class="price-note">Prices are PriceCharting's ungraded price guide value, read ${esc(readOn)}. That is a
            price guide figure for a loose ungraded copy, computed from completed sales: it is not an auction result,
            not a live listing and not a marketplace's market price. Card images are PriceCharting's. The ranking spans
            every language, because their Pokemon catalog is not split by one and roughly half of the top
            ${POOL_SIZE} is Japanese. Pokemon and all Pokemon names are trademarks of The Pokemon Company. This is fan
            content.</p>
        </div>
        </div>

        <p class="cm-how cm-other"><a href="/games/">The other games</a> are a silhouette round, a set guesser, a trivia
          run and an arcade game. <a href="/most-valuable-cards.html">The list this deck comes from</a> has all
          ${POOL_SIZE} with the source on every row.</p>
      </div>
    </div>
  </section>
</main>
${footer()}
<script type="application/json" id="cmConf">${jsonIsland(CONF)}</script>
<script type="application/json" id="cmPool">${jsonIsland(pool)}</script>
<script>${miniJS(GAME_JS)}</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/games/chase-match.html"), page);
console.log(
  `Wrote public/games/chase-match.html  (${POOL_SIZE} cards, ` +
    `${jsonIsland(pool).length.toLocaleString("en-US")} bytes of pool)`
);
