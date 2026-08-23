#!/usr/bin/env node
// Build public/luck.html: what 300+ rips actually produced.
//
//   node scripts/build-luck.mjs
//
// This is the one page on the site nobody else can write. Every other Pokemon
// site quotes the same official rarity distributions; this one reports what
// came out of packs that were actually opened on camera, which is a different
// and more interesting thing.
//
// HONESTY IS THE WHOLE VALUE HERE, so the rules are strict:
//
// 1. Only rips Tim has explicitly marked count toward a rate. THE REASON GIVEN
//    HERE WAS OUT OF DATE AND THE CONCLUSION IS NOT. It read "the `pulls` tags
//    are derived from video titles, and titles are biased", which stopped being
//    true when sync-youtube.mjs moved that field onto the rip log:
//    `pulls: manual.pulls ?? pullsFromHitCard(log.hitCard) ?? []`, at
//    scripts/sync-youtube.mjs:272, and the comment beside it says so in as many
//    words. The tags come from the Hit Card cell now, which is a person naming
//    the cards that came out.
//
//    The bias moved rather than went away, which is why the DERIVED `pulls`
//    tags still carry no denominator. A rip whose Hit Card cell is EMPTY
//    produces no tag and would read as a rip that produced nothing, so a rate
//    computed over the tags would measure how much of the log is filled in.
//
//    "ONLY `hasHit`" WAS THE RULE UNTIL 21 AUGUST 2026 AND IT WAS TOO NARROW BY
//    EXACTLY ONE ROW, WHICH IS THE WORST WIDTH TO BE WRONG BY. A rip with an
//    empty Has Hit cell AND two priced cards written into the My Hits tab is
//    not an unanswered rip, and this page called it one while /hall.html and
//    that rip's own page published both of its cards. See the outcome block
//    below for the rule that replaced it and for the tilt it carries.
//
// 2. Every rate carries its sample size, and rates below MIN_SAMPLE are shown
//    as "not enough yet" rather than as a number. Three rips of a set is an
//    anecdote and printing "33% hit rate" next to it would be a lie told with
//    real data.
//
// 3. These are OBSERVED rates from one person's openings, never presented as
//    official pull rates. The Pokemon Company does not publish those and we do
//    not have them. The page says so in its own words, not in fine print.
//
// The page therefore starts mostly empty and fills in as the log is tagged.
// That is correct behaviour, not a bug: it shows what is known and says how
// much is still unknown.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
// `count` and `plural` ARE SHARED AND WERE ALREADY THERE. This file wrote the
// `rip${n === 1 ? "" : "s"}` ternary inline eight times and still shipped two
// rows reading "1 rips", which is the argument shared/format.mjs's own header
// makes: assume every count you print can be 1 tomorrow. Both of the sentences
// they fixed also needed the VERB to agree, which no helper can do for you.
import { esc, shortDate, moneyCompact, count, plural, clipMeta} from "../shared/format.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
// THE PRICE CHAIN AND THE PRICE SENTENCE BOTH COME OUT OF SHARED MODULES AND
// NEITHER IS RESTATED HERE. shared/graded-price.mjs exists because five
// builders each held a private copy of the PSA 10 lookup and the site
// published two different figures for one card on 54 pages; shared/card-prices
// .mjs exists because ten builders each held a private copy of the sourcing
// sentence and the source moved under all ten. This page prints both, so it
// calls both.
import { loadGradedPrices } from "../shared/graded-price.mjs";
import { loadFirstPartner } from "../shared/first-partner.mjs";
import { priceNote, priceFooter } from "../shared/card-prices.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Below this many tagged rips, a rate is noise and is not shown as a number. */
const MIN_SAMPLE = 12;

// LUCK_DATA points the build at a different videos.json. Used to preview how
// this page will look once the rip log is tagged, without writing test values
// over the real catalogue.
const DATA = process.env.LUCK_DATA || join(ROOT, "public/data/videos.json");
const OUT = process.env.LUCK_OUT || join(ROOT, "public/luck.html");
const { videos } = JSON.parse(await readFile(DATA, "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const setName = Object.fromEntries(sets.map((s) => [s.id, s.name]));

// A SET THIS SITE HOLDS NO NAME FOR STILL GETS A NAME, NOT ITS SLUG.
//
// Two English sets, silver-tempest and lost-origin, are tagged on rips in
// videos.json and are in NEITHER public/data/sets.json NOR shared/taxonomy.mjs's
// CARD_SETS. The set table's label chain was setName[k] || labelFor("sets", k)
// || k, and labelFor RETURNS ITS OWN ARGUMENT when the table has no entry, so
// the third fallback is dead code and the second one hands back the slug. Rows
// 14 and 15 of 39 printed "silver-tempest" and "lost-origin" among 37 properly
// named rows, which reads as a broken page rather than as missing data.
//
// THE FIX IS NOT TO ADD THE SETS. data/tcgdex-en.json's _readme costs that out:
// a set needs entries in five maps and spawns a guide page, and neither of these
// has a checklist, a logo or a guide behind it.
//
// AND IT IS NOT A NEW INVENTION EITHER. public/assets/app.js's labelOf() already
// ends in exactly this de-slug, and /videos.html is where these two rows LINK
// TO, so today the link text and the heading a reader lands on disagree about
// the same set. Title-casing the slug makes them agree and asserts nothing the
// site does not already print one click away: no logo is requested (build-proto
// .mjs stamps the logo manifest onto #setHeader for that exact reason), no guide
// is linked, and the rip and hit counts beside it were always real.
//
// SCOPED TO SETS ON PURPOSE. The product and rarity tables label through the
// same helper and every one of their ids IS in the taxonomy; a sweep of the
// built tree found these two rows and nothing else.
const setLabel = (k) => {
  const known = setName[k] || null;
  if (known) return known;
  const tag = labelFor("sets", k);
  if (tag && tag !== k) return tag;
  return String(k)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// ===========================================================================
// A RIP THAT DEMONSTRABLY HIT WAS INVISIBLE TO THE PAGE THAT COUNTS HITS.
// Fixed 21 August 2026, and the rule changed rather than the arithmetic.
//
// WHAT HAPPENED. `hasHit` is a yes/no column and this page counted only the
// rips where it says yes or no. `ac3pK3zh0DE`, "Opening a Reshiram ex Box",
// has it EMPTY -- and it also has two cards written into the My Hits tab, both
// of which the site prices, both of which are plaques on /hall.html, and both
// of which its own rip page publishes. So the tree carried 274 hit bands and
// 136 rips with a named card while this page said 273 and 135.
//
// THAT IS THE WORST CLASS OF FAULT ON THIS SITE, not an off-by-one: one page
// contradicting another about a number both of them derive from the same file,
// silently, with every gate green, because 273 is a perfectly plausible answer.
//
// THE RULE. A rip's outcome is known when the owner has said so, and there are
// TWO ways he says so: he ticks Has Hit, or he writes the cards that came out
// into the My Hits tab. Naming a card IS answering the question. So the
// denominator is "rips whose outcome we can determine", and the page says that
// in those words rather than saying "logged", which was ambiguous between the
// two all along.
//
// WHAT IT CANNOT DO, STATED BECAUSE IT IS A REAL TILT AND NOT A QUIBBLE. A
// named card can only ever resolve to a HIT. Nobody writes down the cards that
// did not come out, so this rule adds hits and never misses, and while any rip
// is on the page through it the rate carries that tilt. `impliedHits` counts
// them and the page prints the count beside the rate, so the size of the tilt
// is on the page rather than in this comment. It is 1 today against 274.
//
// THE OPPOSITE CASE IS A DATA ERROR AND IS SHOUTED ABOUT RATHER THAN ABSORBED:
// a rip whose Has Hit says NO while the My Hits tab names a card out of it is
// two answers that cannot both be true, and `contradictions` makes the run say
// so. There are none today.
//
// ONE READ OF data/hits.json FOR THE WHOLE FILE. It used to be opened twice,
// once here and once for the card ledger, which is how the two halves of a
// page come to disagree about how many rows there are.
let hitDoc = {};
try {
  hitDoc = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
} catch { /* no rip log: the page falls back to the Has Hit column alone */ }
const namedHitIds = new Set(
  Object.entries(hitDoc).filter(([, list]) => Array.isArray(list) && list.length).map(([vid]) => vid),
);
// The resolved outcome, stamped once so that every count on this page reads
// the same field. `true`, `false`, or `null` for still unknown.
const contradictions = [];
for (const v of videos) {
  const named = namedHitIds.has(v.id);
  if (v.hasHit === false && named) contradictions.push(v.id);
  v._out = typeof v.hasHit === "boolean" ? v.hasHit : named ? true : null;
  v._implied = typeof v.hasHit !== "boolean" && named;
}
const judged = videos.filter((v) => v._out !== null);
const hits = judged.filter((v) => v._out);
const impliedHits = judged.filter((v) => v._implied).length;
const coverage = videos.length ? judged.length / videos.length : 0;

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const packsIn = (v) => (Number.isFinite(v.packs) && v.packs > 0 ? v.packs : null);

/**
 * Group EVERY rip by a key, and rate each group over the ones with an answer.
 *
 * IT USED TO WALK `judged` ONLY, AND THAT MADE THE "Rips" COLUMN A FILTERED
 * COUNT WEARING A TOTAL'S LABEL. A set with 20 rips and 14 answers printed
 * "14" under a heading reading Rips, which is the same fault a QA pass found on
 * /videos.html's set header on 21 August 2026: a filtered number stated as if
 * it were the whole. Both halves are counted now and the cell prints both,
 * because the rate's denominator is the answered ones and the volume question
 * is about all of them.
 *
 * PACKS ARE PER KEY, NOT PER VIDEO. 17 rips open two or three sets at once, and
 * charging the whole rip's pack count to each of them would inflate every one.
 * `packsFor` lets the caller say which slice belongs to this key; the sets
 * table passes the sheet's own Sets & Packs breakdown.
 */
function rateBy(keyFn, labelFn, packsFor = (v) => packsIn(v)) {
  const g = new Map();
  for (const v of videos) {
    for (const k of keyFn(v)) {
      if (!g.has(k)) g.set(k, { all: 0, rips: 0, hits: 0, packs: 0, packRips: 0, hitPacks: 0 });
      const e = g.get(k);
      e.all++;
      const answered = v._out !== null;
      if (answered) {
        e.rips++;
        if (v._out) e.hits++;
      }
      const p = packsFor(v, k);
      if (p) {
        e.packs += p;
        // HOW MANY RIPS THE PACK TOTAL IS OVER, because it is not over all of
        // them. 257 of 319 rips state a pack count, so a bare "48 packs" in a
        // row of 57 rips reads as though nine rips opened nothing. The Packs
        // column on the set table prints both halves.
        e.packRips++;
        if (v._out) e.hitPacks += p;
      }
    }
  }
  return [...g.entries()]
    .map(([k, e]) => ({ key: k, label: labelFn(k), ...e, rate: pct(e.hits, e.rips) }))
    .filter((r) => r.all > 0)
    .sort((a, b) => (b.rips >= MIN_SAMPLE) - (a.rips >= MIN_SAMPLE) || b.rate - a.rate || b.rips - a.rips);
}

const bySet = rateBy(
  (v) => v.sets || [],
  setLabel,
  // THE SHEET'S OWN PER SET BREAKDOWN FIRST. `setPacks` is what import-sheet
  // .mjs reads out of the Sets & Packs cell, so on a rip that opened one pack
  // of Black Bolt and one of White Flare each set is charged one. A rip with
  // no breakdown is charged its whole count ONLY where it opened one set,
  // because otherwise the same packs would be counted against every set named.
  (v, k) => {
    const row = (v.setPacks || []).find((x) => x.set === k);
    if (row && Number.isFinite(row.packs) && row.packs > 0) return row.packs;
    return (v.sets || []).length === 1 ? packsIn(v) : null;
  },
);
// THE PRODUCT TABLE THAT USED TO SIT HERE IS A GRID OF CARDS NOW, AND THIS IS
// WHY THERE IS NOT ALSO A TABLE. `rateBy` over v.products answered "which
// product has the best hit rate" and nothing else: no volume, no packs, no
// boxes, no best card, and it sorted by rate, so the question Tim actually
// asked ("what product type has given us the most hits") was not on the page at
// all. Two renderings of one axis, ordered differently, would have been two
// answers to one question sitting in the same scroll. See prodRows.

// What actually came out, from the rarity Tim recorded. Falls back to the
// derived pull tags only for the count of each kind, never for a rate.
//
// "MORE THAN ONE" IS NOT A RARITY, and it was rendered in a row of rarities.
// It is what the rip log's rarity column says when a single rip produced
// several hits, and on the page it came out as a tile reading "2 / MORE THAN
// ONE" between "8 / ILLUSTRATION RARE" and "6 / CHARIZARD", which reads as a
// label with its noun missing. Saying "hit" restores the sentence the other
// tiles are all making: N rips produced <this>.
const RARITY_ALIAS = { "More than one": "More than one hit" };
const rarityCount = new Map();
for (const v of videos) {
  if (!v.hitRarity) continue;
  const k = RARITY_ALIAS[v.hitRarity] || v.hitRarity;
  rarityCount.set(k, (rarityCount.get(k) || 0) + 1);
}
const rarities = [...rarityCount.entries()].sort((a, b) => b[1] - a[1]);

const pullCount = new Map();
for (const v of videos) for (const p of v.pulls || []) pullCount.set(p, (pullCount.get(p) || 0) + 1);
const pulls = [...pullCount.entries()].sort((a, b) => b[1] - a[1]);

/**
 * WHICH TALLY THE "WHAT HAS ACTUALLY COME OUT" BAND SHOWS, AND WHY IT IS NOT
 * SIMPLY `rarities.length`.
 *
 * The band used to read `rarities.length ? rarities : pulls`, which is the
 * ordinary "prefer the better source" shape and reads as obviously right. On
 * this data it publishes almost nothing. The rip log's rarity column is filled
 * in for exactly TWO rips and both of them say the same thing, "More than one",
 * so `rarities` is one entry covering 2 rips. Being non-empty, it wins, and the
 * pull tags, which cover 14 rips across six categories (Double Rare 5,
 * Illustration Rare 4, Ultra 2, Super 1, ACE SPEC 1, Charizard 1), are dropped
 * without a word. A whole band headed "What has actually come out" renders as a
 * single tile reading "2 / More than one hit".
 *
 * Non-empty is not the same as better. The comparison that matters is how many
 * RIPS each tally describes, because that is what both of them are counting, so
 * that is what is compared. The rarity column still wins on a tie, which keeps
 * the original intent: it is the more precise source the moment somebody fills
 * it in for as many rips as the tags cover.
 *
 * Printed either way, so a run where the choice flips is visible rather than
 * being a band that quietly changed what it is about.
 */
/* ---------------------------------------------- what the pull tally is NOT
 *
 * IT COUNTS RIPS, NOT CARDS, AND THE PAGE HAD NEVER SAID SO. `pullsFromHitCard`
 * in sync-youtube.mjs ends `[...new Set(ids)]`, so one video contributes AT
 * MOST ONE tag per rarity however many cards of that rarity came out of it. The
 * Costco UPC rip is the extreme case and it is not a rare one: fourteen cards
 * in data/hits.json, five tags here.
 *
 * THE DEDUPLICATION IS RIGHT AND THE SILENCE ABOUT IT WAS NOT. This band asks
 * how often a rip produces each kind of card, which is the question the rest of
 * the page is about, and counting one opening five times would let a single
 * lucky box outweigh a month of ordinary ones. A card-by-card count is a
 * different measure and it already has a page: /hall.html lists every card.
 * So the tally stays as it is and the note now states the unit, with the two
 * totals beside it so a reader can see the size of the gap rather than take
 * the word for it.
 *
 * COMPUTED, NEVER TYPED. Both numbers move every time the log is tagged, and a
 * sentence carrying a hand-written 76 goes quietly wrong on the next import.
 * data/hits.json is read for the card count for the same reason: it is the
 * file /hall.html and every rip page count cards out of, so this page cannot
 * disagree with them about how many there are.
 *
 * DEDUPLICATION IS NOT THE ONLY REASON THE TWO TOTALS DIFFER, AND THE OTHER
 * REASON IS A GAP RATHER THAN A DECISION. `RARITY_ID_TO_PULL` in
 * sync-youtube.mjs maps nine tiers and has no entry for a BLACK STAR PROMO, so
 * a promo named in a Hit Card cell produces no tag at all and can never badge:
 * two of the Costco rip's fourteen cards are promos and neither is in its five.
 * The three lowest Japanese tiers (`jp-r`, `jp-u`, `jp-c`) are absent too, and
 * THOSE are deliberate by the same rule that maps `rare` to null, because a
 * plain Rare is not a pull. The promo is not.
 *
 * IT IS NOT FIXED HERE AND THAT IS DELIBERATE. `pulls` is written into
 * public/data/videos.json by sync-youtube.mjs, and it drives the badge on every
 * video tile on the site as well as this band, so adding a tier means a new
 * pull tag, a label in shared/taxonomy.mjs, a badge treatment, and a retag run
 * that moves 318 pages. That is a feature, not a correction to a sentence, and
 * doing it inside a prose fix is how the note above came to be describing a
 * build step that had already moved.
 */
const tagCount = videos.reduce((n, v) => n + (v.pulls || []).length, 0);
const tagRips = videos.filter((v) => (v.pulls || []).length).length;
let hitRows = 0;
let widestGap = null;
{
  // hitDoc, NOT A SECOND READ OF THE SAME FILE. See the outcome block at the
  // top: this file used to open data/hits.json three times, which is three
  // chances for two halves of one page to disagree about how many rows it has.
  const tagsById = new Map(videos.map((v) => [v.id, (v.pulls || []).length]));
  for (const [vid, list] of Object.entries(hitDoc)) {
    if (!Array.isArray(list)) continue;
    hitRows += list.length;
    const tags = tagsById.get(vid) || 0;
    if (!tags) continue;
    if (!widestGap || list.length - tags > widestGap.cards - widestGap.tags) {
      widestGap = { vid, cards: list.length, tags };
    }
  }
}

const rarityRips = [...rarityCount.values()].reduce((n, x) => n + x, 0);
const pullRips = videos.filter((v) => (v.pulls || []).length).length;
const useRarities = rarities.length > 0 && rarityRips >= pullRips;
const tally = useRarities ? rarities : pulls.map(([k, n]) => [labelFor("pulls", k) || k, n]);
console.log(
  `  "what has come out" band: rarity column covers ${rarityRips} rip(s) in ${rarities.length} ` +
    `categor${rarities.length === 1 ? "y" : "ies"}, pull tags cover ${pullRips} rip(s) in ` +
    `${pulls.length} categories, showing the ${useRarities ? "rarity column" : "pull tags"}`
);

/**
 * The longest run of consecutive judged rips with no hit, in upload order.
 *
 * The most human number on the page: everyone who opens packs knows the
 * feeling of a cold streak, and this one is real rather than remembered.
 */
const chrono = [...judged].sort((a, b) => String(a.published).localeCompare(String(b.published)));
let worst = { len: 0, from: null, to: null };
let run = 0, runFrom = null;
for (const v of chrono) {
  if (!v._out) {
    if (!run) runFrom = v;
    run++;
    if (run > worst.len) worst = { len: run, from: runFrom, to: v };
  } else run = 0;
}
let bestRun = { len: 0, from: null, to: null };
run = 0; runFrom = null;
for (const v of chrono) {
  if (v._out) {
    if (!run) runFrom = v;
    run++;
    if (run > bestRun.len) bestRun = { len: run, from: runFrom, to: v };
  } else run = 0;
}

/**
 * THE RIP THAT ENDED THE DROUGHT, which is a fact this page already had and
 * would not name.
 *
 * `worst.to` is the LAST rip of the cold streak, so it is still a miss. The
 * one that broke it is whatever judged rip comes next in upload order, and it
 * only exists if the streak ended rather than running to the newest video.
 * Where it does not exist the page says the drought is still open, which is
 * the truth and a better sentence than an omission.
 *
 * WHY THIS PAGE GETS LINKS AT ALL, since the test is relevance and not volume.
 * Every number on /luck.html is counted out of the channel's own videos, and
 * the two streaks are the only figures on it that are ABOUT four specific
 * rips rather than about a rate. A reader who has just been told the longest
 * drought ran N rips has exactly one next question, and it is "which ones".
 * Nothing else on the page has an answer that is a single video, which is why
 * nothing else on it gets a link.
 */
const droughtBreaker = (() => {
  if (!worst.len || !worst.to) return null;
  const i = chrono.indexOf(worst.to);
  return i >= 0 ? chrono[i + 1] || null : null;
})();

const totalPacks = judged.reduce((n, v) => n + (packsIn(v) || 0), 0);
const packsKnown = judged.filter(packsIn).length;

// ===========================================================================
// EVERYTHING BELOW THIS LINE IS THE 21 AUGUST 2026 PASS, and the three rules
// it added to the three at the top of this file:
//
// 4. A COUNT AND A RATE NEVER TRAVEL ALONE. Tim asked "what product type has
//    given us the most hits", and the answer to that question as asked is
//    "whichever one we opened most of", which is not a fact about the product.
//    So every count on this page is printed beside its rate AND its
//    denominator, in the same box, at the same size. "30 hits" and "30 of 70
//    logged rips" are the same sentence here and the second half is never
//    dropped to save a line.
//
// 5. A VIDEO IS NOT A BOX AND THE PAGE SAYS SO WHERE IT MATTERS. An ETB holds
//    nine packs and this channel films one pack at a time, so the 57 videos
//    tagged etb are nowhere near 57 boxes: PACK_CAPACITY below is read out of
//    scripts/build-sheet.py rather than retyped, and the note that uses it is
//    the one thing standing between this page and a number that is wrong by a
//    factor of nine. See boxNote.
//
// 6. NO MONEY TOTAL IS PRINTED HERE, and that is a decision rather than a gap.
//    /hall.html already publishes the total ungraded guide value and the total
//    PSA 10 over the cards it inducts, computed by the builder that owns the
//    printing-match contract with build-pages.mjs. A second total on this page
//    would be a second renderer of one fact, which is the exact failure
//    shared/graded-price.mjs exists to end. This page prints the BEST card out
//    of each product type, which is a fact /hall.html cannot carry because it
//    does not know what was opened, and links to that page for the rest.
// ===========================================================================

// ------------------------------------------------- what a card is worth here
//
// THIS IS THE PART OF THE PAGE MOST LIKELY TO GO WRONG, so read this before
// changing a line of it.
//
// The price of a pulled card is not stored anywhere. It is resolved from the
// checklist, and the hard half is deciding WHICH PRINTING was pulled when a
// set prints the same card several times. build-pages.mjs and build-hall.mjs
// hold that decision together under a written contract, and a THIRD copy of
// their rule is exactly how one card comes to show two prices on two pages.
//
// SO THIS FILE DOES NOT COPY THEIR RULE. IT USES A STRICTER ONE THAT CANNOT
// DISAGREE WITH IT. Their chain is: the printing whose tier matches the log
// exactly, then the first whose tier merely starts with the same eight
// characters, then the first printing of that name at all. Ours stops at the
// first branch and takes a bare name match only where the name is UNIQUE in
// the set. Every card this file prices is therefore a card those two price the
// same way, and every card where the two rules could part company is dropped
// and counted rather than guessed at.
//
// PROVEN AGAINST THE PAGE THAT OWNS THE MONEY, 21 August 2026, by deduplicating
// this ledger the way build-hall.mjs deduplicates its plaques: 21 cards with a
// PSA 10 summing 2,726.55, against the "PSA 10 on 21 of 140" and the $2,727 that
// /hall.html prints. Exact. The raw side is 120 cards at 732.79 against its 122
// at $741, which is the two rows the looser rule takes and this one declines,
// $8.21 between them. A subset that agrees is the whole design.
//
// THE PSA 10 FIGURE COMES OUT OF shared/graded-price.mjs AND IS NOT LOOKED UP
// HERE AT ALL. One call, one chain, the same one every other page takes.
const { resolve: psaResolve } = await loadGradedPrices();
const firstPartner = await loadFirstPartner();

const cardsBySet = new Map();
try {
  for (const f of await readdir(join(ROOT, "public/data/cards"))) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
    cardsBySet.set(f.replace(/\.json$/, ""), doc);
  }
} catch { /* no checklists: every value figure below drops out rather than guesses */ }

// The sourcing sentence for every ungraded figure on this page, from the
// module that owns the wording. NOT "market price": a guide value and a market
// price are different quantities and shared/card-prices.mjs says so at length.
const priceDoc = (() => {
  const one = cardsBySet.get("pitch-black") || [...cardsBySet.values()][0] || null;
  if (!one) return null;
  let pricecharting = 0, tcgdex = 0;
  for (const d of cardsBySet.values()) {
    pricecharting += d.pricedBy?.pricecharting || 0;
    tcgdex += d.pricedBy?.tcgdex || 0;
  }
  return { priceSource: one.priceSource, pricesChecked: one.pricesChecked, checked: one.checked, pricedBy: { pricecharting, tcgdex } };
})();

const nrm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
const videoById = new Map(videos.map((v) => [v.id, v]));

/**
 * One row per card named in the rip log, with the video it came out of and
 * whatever the site knows about what it is worth.
 *
 * `drops` is a census rather than a debugging aid: a value figure over a
 * ledger that quietly lost rows is a value figure about a smaller channel than
 * the one the page is describing, and the run prints every bucket.
 */
const cardLedger = [];
const cardDrops = { noChecklist: 0, notOnChecklist: 0, ambiguousPrinting: 0, noVideo: 0 };
let cardRows = 0;
{
  for (const [vid, list] of Object.entries(hitDoc)) {
    if (!Array.isArray(list)) continue;
    const v = videoById.get(vid);
    for (const h of list) {
      cardRows++;
      if (!v) { cardDrops.noVideo++; continue; }
      const base = { vid, v, name: h.card, rarity: h.rarity || null, setName: h.setName || null };
      // A PROMO CARRIES ITS OWN PRICE AND ALWAYS HAS. See data/hits.json's
      // readme: TCGdex publishes no pricing for promo sets, so the rip log is
      // the only copy, and shared/first-partner.mjs is the join for the three
      // that also appear in an illustration collection.
      if (!h.set) {
        const fp = firstPartner.priceForHit(h);
        // ...AND WHERE IT DOES NOT, the sheet's Raw NM column does. Five promos
        // had no `price` of their own until Tim sent TCGplayer links on 23
        // August 2026, so they counted as pulls with no value anywhere on this
        // page. Behind both live sources, never in front; same order as
        // build-pages.mjs and build-hall.mjs.
        const raw = typeof h.price === "number" ? h.price
          : fp?.price ?? (typeof h.rawNm === "number" ? h.rawNm : null);
        const psa = typeof h.psa10 === "number" ? h.psa10 : fp?.psa10 ?? null;
        cardLedger.push({ ...base, set: null, number: h.number || fp?.number || null, raw, psa, promo: true });
        continue;
      }
      // THE THREE "no value" EXITS BELOW NOW CARRY THE SHEET'S OWN FIGURE.
      // Silver Tempest, Lost Origin and the Black Star Promo sets have no
      // checklist here, so every card out of them left this loop worth nothing
      // and this page counted them as pulls with no money attached. `rawNm` is
      // the one number those rows will ever have; the printing stays unpinned,
      // which is honest, but the value is no longer thrown away.
      const sheetRaw = typeof h.rawNm === "number" ? h.rawNm : null;
      const doc = cardsBySet.get(h.set);
      if (!doc?.cards?.length) { cardDrops.noChecklist++; cardLedger.push({ ...base, set: h.set, number: h.number || null, raw: sheetRaw, psa: null }); continue; }
      const same = doc.cards.filter((c) => nrm(c.name) === nrm(h.card));
      if (!same.length) { cardDrops.notOnChecklist++; cardLedger.push({ ...base, set: h.set, number: h.number || null, raw: sheetRaw, psa: null }); continue; }
      // REVERTED with build-pages.mjs and build-hall.mjs on 23 August 2026, and
      // the reason it stays reverted has since been fixed at the source: the
      // number was DERIVED whenever the My Hits Number column was blank, and
      // import-sheet.mjs derived it by taking the DEAREST printing of the name
      // rather than the one the typed rarity names. That rule alone moved 86
      // rows and claimed 51 Special Illustration Rares out of 462 packs.
      // pickPrinting() in that file now reads the rarity, so the number and the
      // rarity agree by construction and this order costs nothing. See the full
      // note and its three confirmations in build-pages.mjs.
      const want = h.rarity ? nrm(h.rarity) : null;
      const exact = want ? same.filter((c) => nrm(c.rarity) === want) : [];
      const m = exact.length === 1 ? exact[0] : (!exact.length && same.length === 1 ? same[0] : null);
      if (!m) { cardDrops.ambiguousPrinting++; cardLedger.push({ ...base, set: h.set, number: null, raw: sheetRaw, psa: null }); continue; }
      const g = psaResolve(h.set, m.n, { name: m.name, setName: setName[h.set] || h.setName || h.set });
      cardLedger.push({
        ...base,
        name: m.name,
        set: h.set,
        setName: setName[h.set] || h.setName || null,
        number: m.n,
        rarity: m.rarity || h.rarity || null,
        raw: typeof m.price === "number" && m.price > 0 ? m.price : null,
        psa: g && typeof g.price === "number" ? g.price : null,
      });
    }
  }
}

const rawCards = cardLedger.filter((c) => typeof c.raw === "number");
const psaCards = cardLedger.filter((c) => typeof c.psa === "number");

// ============================================================================
// "HOW MANY ETBs HAVE WE OPENED" IS THREE DIFFERENT QUESTIONS AND THIS LOG CAN
// ANSWER TWO OF THEM. Read this before adding a box count back.
//
// Tim asked for "how many ETBs we have opened overall, how many single packs,
// how many Booster bundles" and then, when the double count was put to him,
// for the model where a box counts once and contributes its full pack count:
// "only count each ETB once, but you count the 9 packs inside as 9 packs".
// That model is exactly right and this data cannot carry it. The evidence, all
// of it computed below rather than asserted, and all of it printed at the end
// of a run so it cannot go stale:
//
//   1. THE Box # COLUMN IS A PRODUCT LABEL, NOT A SERIAL. `boxCollisions`
//      counts the (opening type, set, Box #, Pack #) coordinates occupied by
//      more than one video. Today it is 36 coordinates carrying 40 extra
//      videos, and they are not re-uploads: "Ascended Heroes ex Premium
//      Collection 1 - Pack 1" is 21 June AND 22 June, and the same product's
//      "Collection 2 - Pack 1" is 17 June, 6 July and 8 July. Those are second
//      and third boxes wearing the first one's number, because the "1" and the
//      "2" name the product on the shelf. Nothing in the log separates a
//      second box from a second video of one pack.
//   2. SO A BOX CANNOT BE COUNTED, and if it cannot be counted its capacity
//      cannot be added either. Adding 9 for a box while its nine pack videos
//      each add 1 counts every one of those packs twice, which is the hazard
//      in the request and the reason this is written out at this length.
//   3. CAPACITY IS ONLY PUBLISHED FOR SIX OF THE THIRTEEN PRODUCT KINDS IN
//      USE. PRODUCT_TO_PACKS is read out of scripts/build-sheet.py rather than
//      retyped, for the reason check-build.py gives about its own copy: a
//      second copy of the table that caused a bug is how a verifier comes to
//      agree with the bug. ex-premium, tin, poke-ball-tin, collection-box and
//      knock-out are not in it, and that is 81 rips.
//   4. AND "PACKS IN THE BOX" IS NOT "PACKS RIPPED" EVEN WHERE BOTH ARE KNOWN.
//      `boxShort` asks the question on the only boxes where it can be asked --
//      a stated Box # whose pack numbers do not repeat, of a product whose
//      capacity is published -- and finds four of them holding 33 packs with
//      26 on camera. A Chaos Rising ETB is three packs in. Calling its other
//      six "ripped" would be a claim the videos do not support.
//
// SO THE PAGE COUNTS PACKS RIPPED ON CAMERA, from the sheet's own Packs
// column, and says in its own words that it is counting openings rather than
// boxes bought. The number that unlocks the rest is a UNIQUE box serial in the
// Box # column, and the page says that too, because a reader who wants the box
// count should be able to see what is standing in the way of it.
let PACK_CAPACITY = {};
try {
  const py = await readFile(join(ROOT, "scripts/build-sheet.py"), "utf8");
  const blk = /^PRODUCT_TO_PACKS = \{(.*?)^\}/ms.exec(py);
  if (blk) for (const m of blk[1].matchAll(/["']([a-z0-9-]+)["']\s*:\s*(\d+)/g)) PACK_CAPACITY[m[1]] = Number(m[2]);
} catch { /* the census below reports zero known capacities rather than guessing one */ }

/* ---------------------------------------------------------- boxes, as a FLOOR
 *
 * Pack # IS AN ORDINAL AND THAT IS WHAT MAKES THIS POSSIBLE. Tim: "the pack #
 * listed in the excel document is the pack # of the pack from that box that is
 * being opened in that video, not how many packs are in the video."
 * import-sheet.mjs agrees in code rather than in prose: the warning at its
 * `m.packNumber > packs` line reads "Pack 12 of a nine pack ETB", so it is
 * already treating that column as an index into a box. Summing it would produce
 * a large, confident, meaningless number and nothing here sums it.
 *
 * THE ONE THING AN ORDINAL LETS YOU COUNT IS BOXES, AND ONLY AS A FLOOR.
 * Within one opening type and one set, if Pack 1 appears in three videos then
 * three different boxes were opened, because one box has one first pack. So
 * the box count for a group is the LARGEST NUMBER OF TIMES ANY SINGLE PACK
 * NUMBER IS USED IN IT, and it is a floor rather than an answer: two boxes
 * filmed at different pack numbers and never overlapping look like one.
 *
 * IT IS A FLOOR AND THE PAGE SAYS "AT LEAST" IN THE COPY. A floor can only
 * ever be pushed up by more data, which is the property every figure on this
 * page has to have while rows 258 to 319 are still being filled.
 *
 * WHY THIS AND NOT THE Box # COLUMN. Because that column is a product label
 * rather than a serial, which the data says out loud: "Ascended Heroes ex
 * Premium Collection 1 - Pack 1" is two videos a day apart, and "Collection 2 -
 * Pack 1" is three videos across June and July. `boxCensus.collisions` counts
 * every coordinate like that, and the run prints the total.
 *
 * A LOOSE PACK IS ITS OWN UNIT AND IS NOT COUNTED HERE. The test is
 * PRODUCT_TO_PACKS saying the product holds exactly one pack, which is the
 * four single-pack tags. Counting "boxes" of single packs would just be the
 * video count wearing a different word.
 *
 * AND THE PACKS THOSE BOXES HOLD IS A SEPARATE QUANTITY FROM THE PACKS THAT
 * WERE RIPPED. See boxCensus.capPacks against boxCensus.capFilmed: an ETB that
 * is three videos in holds nine packs and has ripped three. The page prints
 * both, labelled, and never adds them.
 */
const looseTag = (tag) => PACK_CAPACITY[tag] === 1;
const boxFloor = new Map();
let boxNoType = 0;
{
  const groups = new Map();
  for (const v of videos) {
    for (const tag of v.products || []) {
      if (looseTag(tag)) continue;
      if (!v.openingType) { boxNoType++; continue; }
      const k = `${tag}||${v.openingType}||${(v.sets || [])[0] || "?"}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    }
  }
  for (const [k, list] of groups) {
    const tag = k.split("||")[0];
    const seen = new Map();
    for (const v of list) if (Number.isFinite(v.packNumber)) seen.set(v.packNumber, (seen.get(v.packNumber) || 0) + 1);
    boxFloor.set(tag, (boxFloor.get(tag) || 0) + Math.max(1, ...seen.values()));
  }
}

const boxCensus = (() => {
  const coord = new Map();
  for (const v of videos) {
    if (!Number.isFinite(v.packNumber)) continue;
    const k = [v.openingType || "?", (v.sets || [])[0] || "?", v.boxNumber ?? "-", v.packNumber].join("|");
    coord.set(k, (coord.get(k) || 0) + 1);
  }
  const collisions = [...coord.values()].filter((n) => n > 1);
  const stated = new Map();
  for (const v of videos) {
    if (!Number.isFinite(v.boxNumber)) continue;
    const k = [v.openingType || "?", (v.sets || [])[0] || "?", v.boxNumber].join("|");
    if (!stated.has(k)) stated.set(k, []);
    stated.get(k).push(v);
  }
  let checkable = 0, cap = 0, filmed = 0, short = 0;
  for (const list of stated.values()) {
    const pns = list.map((v) => v.packNumber).filter(Number.isFinite);
    if (pns.length !== new Set(pns).size) continue;
    const c = PACK_CAPACITY[(list[0].products || [])[0]];
    if (!c) continue;
    checkable++;
    cap += c;
    const cam = list.reduce((n, v) => n + (packsIn(v) || 0), 0);
    filmed += cam;
    if (cam < c) short++;
  }
  // THE GAP BETWEEN "PACKS THE BOXES HOLD" AND "PACKS RIPPED ON CAMERA", over
  // every product whose capacity PRODUCT_TO_PACKS publishes. Two quantities,
  // never added, and the page prints the smaller one as its headline.
  //
  // THE GAP HAS TWO CAUSES AND THE COPY MUST NOT BLEND THEM. Some of those
  // packs have genuinely not been opened on camera yet, and some were opened
  // in a rip that states no pack count. capRips and capPackRips are here so
  // the sentence can say how much of the second there is instead of letting a
  // reader take the whole gap for the first.
  let capBoxes = 0, capPacks = 0, capFilmed = 0, capRips = 0, capPackRips = 0;
  const filmedByTag = new Map(), ripsByTag = new Map(), packRipsByTag = new Map();
  for (const v of videos) for (const t of v.products || []) {
    filmedByTag.set(t, (filmedByTag.get(t) || 0) + (packsIn(v) || 0));
    ripsByTag.set(t, (ripsByTag.get(t) || 0) + 1);
    if (packsIn(v)) packRipsByTag.set(t, (packRipsByTag.get(t) || 0) + 1);
  }
  for (const [tag, f] of boxFloor) {
    if (!PACK_CAPACITY[tag]) continue;
    capBoxes += f;
    capPacks += f * PACK_CAPACITY[tag];
    capFilmed += filmedByTag.get(tag) || 0;
    capRips += ripsByTag.get(tag) || 0;
    capPackRips += packRipsByTag.get(tag) || 0;
  }
  return {
    ripsWithBoxNo: videos.filter((v) => Number.isFinite(v.boxNumber)).length,
    statedGroups: stated.size,
    collisions: collisions.length,
    collisionRips: collisions.reduce((n, x) => n + x - 1, 0),
    checkable, cap, filmed, short,
    boxes: [...boxFloor.values()].reduce((n, x) => n + x, 0),
    boxNoType,
    capBoxes, capPacks, capFilmed, capRips, capPackRips,
    noCapacityTags: [...new Set(videos.flatMap((v) => v.products || []))].filter((t) => !PACK_CAPACITY[t]),
  };
})();
const allPacks = videos.reduce((n, v) => n + (packsIn(v) || 0), 0);
/* ------------------------------------------------- the figures the widget shows
 *
 * Tim: "at the top of the page we just need a super simple easy to read widget
 * that gives all the high level stats, of how many total packs opened, how many
 * total rip video, how many hits, how many SIRs, how many Hyper rares, etc."
 *
 * TIER COUNTS ARE COUNTS OF CARDS, and the header over them says so once so the
 * six chips do not each have to. That distinction matters here more than
 * anywhere on the site: the existing pull band a few screens down counts RIPS
 * (a rip producing three Double Rares counts once), so the same tier has two
 * honest numbers on one page and they must never be given the same label.
 *
 * RAREST FIRST, NOT BIGGEST FIRST. Sorted by count, Special Illustration Rare
 * lands seventh and the thing Tim named would be buried under Double Rare. The
 * ladder in shared/rarity.mjs already orders the tiers; this reverses it.
 */
const tierCount = new Map();
for (const list of Object.values(hitDoc || {})) {
  for (const c of list) {
    const r = (c.rarity || "").trim();
    if (r) tierCount.set(r, (tierCount.get(r) || 0) + 1);
  }
}
const WIDGET_TIERS = [
  "Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare",
  "Illustration Rare", "Ultra Rare", "Double Rare",
];
const tierChips = WIDGET_TIERS.map((t) => ({ tier: t, n: tierCount.get(t) || 0 }));

const allPackRips = videos.filter(packsIn).length;

const byProductVol = new Map();
for (const v of videos) {
  for (const k of v.products || []) {
    if (!byProductVol.has(k)) byProductVol.set(k, { key: k, vids: 0, judged: 0, hits: 0, packs: 0, packVids: 0, cards: 0, raw: [], psa: [], guide: 0, guideCards: 0 });
    const e = byProductVol.get(k);
    e.vids++;
    if (v._out !== null) { e.judged++; if (v._out) e.hits++; }
    const p = packsIn(v);
    if (p) { e.packs += p; e.packVids++; }
  }
}
// The cards, joined onto the same buckets through the video they came out of.
// A card from a rip with no hit-or-not answer is left OUT of every value
// figure, because the rate beside it is over judged rips and the two halves of
// one box have to describe the same population.
let cardsOutsideJudged = 0;
for (const c of cardLedger) {
  if (c.v._out === null) { cardsOutsideJudged++; continue; }
  for (const k of c.v.products || []) {
    const e = byProductVol.get(k);
    if (!e) continue;
    e.cards++;
    if (typeof c.raw === "number") { e.raw.push(c); e.guide += c.raw; e.guideCards++; }
    if (typeof c.psa === "number") e.psa.push(c);
  }
}
const best = (list, f) => list.reduce((a, b) => (a === null || f(b) > f(a) ? b : a), null);
const prodRows = [...byProductVol.values()].map((e) => ({
  ...e,
  label: labelFor("products", e.key) || e.key,
  boxes: looseTag(e.key) ? 0 : boxFloor.get(e.key) || 0,
  capacity: PACK_CAPACITY[e.key] ?? null,
  rate: e.judged ? pct(e.hits, e.judged) : null,
  bestRaw: best(e.raw, (c) => c.raw),
  bestPsa: best(e.psa, (c) => c.psa),
  // A FLOOR, NOT AN AVERAGE, and the page uses the word "at least" for it.
  // Cards with no guide value count as zero and unlogged rips are not in the
  // denominator, so the true figure can only be higher. That makes it a
  // statement that stays true as rows 258 to 319 land instead of one that has
  // to be walked back.
  guidePerRip: e.judged ? e.guide / e.judged : null,
})).sort((a, b) => b.hits - a.hits || b.judged - a.judged || a.label.localeCompare(b.label));

const mostHits = prodRows.find((r) => r.hits > 0) || null;
const bestRateRow = prodRows
  .filter((r) => r.judged >= MIN_SAMPLE)
  .sort((a, b) => b.rate - a.rate || b.judged - a.judged)[0] || null;
const richestRow = prodRows
  .filter((r) => r.judged >= MIN_SAMPLE && r.guidePerRip > 0)
  .sort((a, b) => b.guidePerRip - a.guidePerRip)[0] || null;
const bestRawCard = best(rawCards, (c) => c.raw);
const bestPsaCard = best(psaCards, (c) => c.psa);

/**
 * How many packs had been ripped on camera by the time the best card turned up.
 *
 * A FLOOR, AND THE COPY SAYS "AT LEAST". It sums the Packs column over every
 * rip published up to and including that one, and 62 of the 319 rips do not
 * state a pack count, so the real number is higher. A floor is the only shape
 * this can take while the log is still being filled: more answers can only
 * ever push it up, never down, so the sentence never has to be walked back.
 */
const packsToBest = (() => {
  if (!bestRawCard) return 0;
  const upTo = String(bestRawCard.v.published || "");
  return videos.filter((v) => String(v.published || "") <= upTo).reduce((n, v) => n + (packsIn(v) || 0), 0);
})();

// ------------------------------------------------------ the pack number question
//
// DOES IT MATTER WHICH PACK OUT OF THE BOX. It is the oldest superstition in
// the hobby and this log can actually test it, because Tim records a Pack #.
//
// THE CAVEAT IS NOT OPTIONAL AND IT IS DRAWN, NOT WRITTEN IN SMALL PRINT: pack
// 9 only exists inside products that hold nine packs, so the tall end of this
// axis is a different mix of products from the short end and NOT a later
// moment in one box. The columns thin out to nothing on the right for the same
// reason, which is why the sample size is printed under every one of them and
// why anything under MIN_SAMPLE draws as an empty frame with no reading in it.
const byPackNo = new Map();
for (const v of judged) {
  const n = v.packNumber;
  if (!Number.isInteger(n) || n < 1) continue;
  if (!byPackNo.has(n)) byPackNo.set(n, { rips: 0, hits: 0 });
  const e = byPackNo.get(n);
  e.rips++;
  if (v._out) e.hits++;
}
const packNoMax = byPackNo.size ? Math.max(...byPackNo.keys()) : 0;
const packNoRows = Array.from({ length: packNoMax }, (_, i) => {
  const e = byPackNo.get(i + 1) || { rips: 0, hits: 0 };
  return { n: i + 1, ...e, rate: e.rips ? pct(e.hits, e.rips) : null, enough: e.rips >= MIN_SAMPLE };
});
const packNoJudged = packNoRows.reduce((n, r) => n + r.rips, 0);
const packNoBest = packNoRows.filter((r) => r.enough).sort((a, b) => b.rate - a.rate)[0] || null;

// ------------------------------------------------------------- runs and months
//
// THE RUN HISTOGRAM IS THE CHANNEL'S OWN NAME TURNED INTO A NUMBER. `worst` and
// `bestRun` above already find the LONGEST of each; this finds every one of
// them, so the page can show the shape rather than the extreme. Self-checked
// against those two below, because two functions walking the same list and
// disagreeing is the kind of thing that ships.
function runsOf(want) {
  const out = [];
  let n = 0;
  for (const v of chrono) {
    if (v._out === want) n++;
    else { if (n) out.push(n); n = 0; }
  }
  if (n) out.push(n);
  return out;
}
const dryRuns = runsOf(false);
const hotRuns = runsOf(true);
const tallyRuns = (rs) => { const m = new Map(); for (const n of rs) m.set(n, (m.get(n) || 0) + 1); return m; };
const dryTally = tallyRuns(dryRuns);
const hotTally = tallyRuns(hotRuns);
const runMax = Math.max(0, ...dryRuns, ...hotRuns);
const dudRips = judged.filter((v) => !v._out).length;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthMap = new Map();
let undated = 0;
for (const v of videos) {
  const k = String(v.published || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(k)) { undated++; continue; }
  if (!monthMap.has(k)) monthMap.set(k, { key: k, filmed: 0, logged: 0, hits: 0, packs: 0 });
  const e = monthMap.get(k);
  e.filmed++;
  if (v._out !== null) { e.logged++; if (v._out) e.hits++; }
  e.packs += packsIn(v) || 0;
}
const monthRows = [...monthMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map((e) => ({
  ...e,
  label: MONTH_SHORT[Number(e.key.slice(5, 7)) - 1] || e.key.slice(5, 7),
  year: e.key.slice(0, 4),
  rate: e.logged ? pct(e.hits, e.logged) : null,
}));

// ---------------------------------------------------------------------------

// ------------------------------------------------------- product photography
//
// THE PRODUCT TABLE NAMES ELEVEN THINGS AND SHOWED NONE OF THEM. "ex Premium
// Collection", "Knock Out Collection" and "UPC" are trade names for boxes of
// wildly different size and price, and the whole point of that table is the gap
// between similar products. A reader who cannot picture two of them cannot see
// the gap.
//
// EVERY PHOTO NAMES THE SET IT IS OF, IN VISIBLE TEXT, not just in the alt.
// products.json is per SET, never per product type, so each of these is one
// specific set's box standing in for a kind, and a row that showed it without
// saying so would be quietly claiming the picture is "an ETB" rather than "Pitch
// Black's ETB". The set line under each label is the whole licence for using
// them here. Same rule build-how-many-packs.mjs states at length.
//
// THE SETS ARE PINNED AND THE NAME IS CHECKED. sync-products.mjs picks the
// cheapest variant per kind, so the product behind "pitch-black / Tin" can
// change under us; if the name that comes back does not still start with the set
// we expect, the photo is dropped rather than captioned wrong.
//
// FOUR ROWS GET NO PHOTO AND THAT IS THE ANSWER, not a gap to close later.
// Japanese, Korean and Chinese booster packs are not in the TCGplayer pull at
// all, and the Poke Ball Tin and Knock Out Collection listings that do exist
// belong to sets we did not open. An English Prismatic Evolutions tin captioned
// as a Japanese pack is worse than a hatched box.
const PRODUCT_SHOT = {
  etb: ["pitch-black", "Elite Trainer Box", "Pitch Black", "Pitch Black Elite Trainer Box"],
  "single-pack": ["pitch-black", "Single Pack", "Pitch Black", "Pitch Black Booster Pack"],
  bundle: ["pitch-black", "Booster Bundle", "Pitch Black", "Pitch Black Booster Bundle"],
  blister: ["pitch-black", "Blister Pack", "Pitch Black", "Pitch Black Single Pack Blister"],
  tin: ["prismatic-evolutions", "Tin", "Prismatic Evolutions", "Prismatic Evolutions Mini Tin"],
  "collection-box": ["prismatic-evolutions", "Collection Box", "Prismatic Evolutions", "Prismatic Evolutions Poster Collection"],
  upc: ["151", "Ultra-Premium Collection", "151", "151 Ultra-Premium Collection"],
};

let PRODUCTS = {};
try {
  PRODUCTS = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8")).sets || {};
} catch { /* run: node scripts/sync-products.mjs. The table renders without photos. */ }
const DEAD_URLS = new Set(
  await readFile(join(ROOT, "data/no-scan.json"), "utf8")
    .then((t) => JSON.parse(t).deadUrls || [])
    .catch(() => [])
);

/* SEVEN KINDS HAD NO PHOTO AND SAID SO IN WORDS: "no photo we can publish".
 * Tim: "make sure all the product types have an image for the product type,
 * right now there are some blank ones ... nothing should be blank on this page."
 *
 * PRODUCT_SHOT above only reads public/data/products.json, which carries the
 * English EXPANSION products: ETBs, bundles, blisters, tins. It holds nothing
 * for an ex Premium Collection, a Poke Ball Tin, a Knock Out Collection or any
 * Japanese pack, so those rows fell through to the words.
 *
 * TWO FILES ALREADY HELD THE MISSING PICTURES. data/extra-products.json pins the
 * standalone products by TCGplayer id, and public/data/products-intl.json holds
 * a pack photo for eight Japanese sets. Nothing was fetched for this; both are
 * already synced and committed.
 *
 * TIM PICKED TWO OF THEM BY NAME: the ex Premium Collection shows Mega Zygarde
 * ex, and the ex Box shows Ascended Heroes Mega Emboar ex. Those are his calls
 * and they are pinned by product id so a catalogue reshuffle cannot swap them.
 *
 * THE JAPANESE PACK IS FROM A SET HE HAS ACTUALLY RIPPED, which is what he asked
 * for: Abyss Eye, five rips, the most-opened Japanese set on the channel.
 *
 * KOREAN AND CHINESE ARE THE HONEST GAP AND THEY GET OUR OWN PACK ART. There is
 * no Korean or Chinese sealed product anywhere in the sources this site uses:
 * TCGplayer files those sets under its JAPANESE line, so "a Korean pack" there
 * is a Japanese pack with a Japanese wrapper. Publishing one under a Korean
 * label would be a false picture of a real product. The site's own drawn pack
 * goes there instead: it is our artwork and it claims nothing about the box.
 */
const PINNED_SHOT = {
  "ex-premium": [682939, "Mega Zygarde ex Premium Collection", "Mega Zygarde ex"],
  "ex-box": [672734, "Ascended Heroes Mega Emboar ex Box", "Ascended Heroes"],
  "poke-ball-tin": [688964, "Poke Ball Tin", "Poke Ball Tin"],
  "knock-out": [628494, "Knock Out Collection", "Knock Out Collection"],
  "collection-box": [593466, "Prismatic Evolutions Surprise Box", "Prismatic Evolutions"],
  "japanese-pack": [695111, "Abyss Eye Booster Pack", "Abyss Eye (JP)"],
};

/* KOREAN AND CHINESE GET OUR OWN WRAPPER, because no photograph of theirs
 * exists in any source this site uses and a wrong one is worse than a drawn one.
 * The label under it says "Garbage Rips art" rather than naming a set, so the
 * picture is not pretending to be the product. Same file the pack facades use.
 */
const OWN_PACK = {
  "korean-pack": "Korean packs, Garbage Rips art",
  "chinese-pack": "Chinese packs, Garbage Rips art",
};

const shotFor = (key) => {
  const spec = PRODUCT_SHOT[key];
  if (spec) {
    const [sid, kind, setLabel, expect] = spec;
    const hit = (PRODUCTS[sid]?.products || []).find((p) => p.kind === kind);
    if (hit && hit.thumb && !DEAD_URLS.has(hit.thumb) &&
        String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) {
      return { src: hit.thumb, name: hit.name, set: setLabel };
    }
  }
  const pin = PINNED_SHOT[key];
  if (pin) {
    const [id, name, setLabel] = pin;
    const src = `https://tcgplayer-cdn.tcgplayer.com/product/${id}_200w.jpg`;
    if (!DEAD_URLS.has(src)) return { src, name, set: setLabel };
  }
  if (OWN_PACK[key]) {
    return {
      src: "/assets/packs/default-garbage-rips-585-booster-pack-tile.webp",
      name: "Garbage Rips 585 booster pack artwork",
      set: OWN_PACK[key],
    };
  }
  return null;
};

// THE PACKS COLUMN IS NEW AND IT IS THE "BY SET" HALF OF WHAT TIM ASKED FOR:
// "we should show stats by set, and overall stats". It is packs RIPPED ON
// CAMERA, from the sheet's own Packs column, and the cell prints the rips it
// is over because 257 of 319 rips state one. A bare pack total next to a rip
// total invites the subtraction and the subtraction is wrong.
const row = (r, hrefBase) => {
  const enough = r.rips >= MIN_SAMPLE;
  const name = hrefBase ? `<a href="${hrefBase}${esc(r.key)}">${esc(r.label)}</a>` : esc(r.label);
  return `        <tr${enough ? "" : ' class="thin"'}>
          <th scope="row">${name}</th>
          <td class="num">${r.all}${r.rips !== r.all ? `<em>${r.rips} answered</em>` : ""}</td>
          <td class="num">${r.packs ? `${r.packs}<em>over ${r.packRips} rip${r.packRips === 1 ? "" : "s"}</em>` : '<span class="thin-note">none say</span>'}</td>
          <td class="num">${r.hits}</td>
          <td class="rate">${
            enough
              ? `<span class="lbar" style="--w:${Math.max(2, r.rate)}%"><b>${r.rate}%</b></span>`
              : `<span class="thin-note">need ${MIN_SAMPLE - r.rips} more</span>`
          }</td>
        </tr>`;
};

// tabindex="0" AND role/aria-label, the same affordance .xp-scroll, .cc-scroll,
// .gc-tw and .op-tw already carry, and for the reason written out in full in
// scripts/build-expansions.mjs: an overflowing box a keyboard cannot reach is
// content a keyboard cannot read.
//
// MEASURED HERE RATHER THAN ASSUMED, because this table is NOT the easy case
// build-expansions describes. Its rows do contain links (18 in the first table,
// 11 in the second), so Chrome, Firefox and Safari all let you tab INTO it and
// the box scrolls as focus moves. That is not the same thing as being able to
// read it. At 390x844 the table is 96px wider than its box, and the column that
// falls off the right is "Hit rate" -- the one number the whole page exists to
// report. Reading it by tabbing means moving focus through set links you did not
// want to follow, and a reader who only wants to LOOK has no way to scroll at
// all. The other four scrollers on this site take the affordance whether or not
// they have focusable children (.cc-scroll has 28 and still carries it), so the
// convention is already "every table scroller", and this was the one that missed.
// 166px hidden at 320.
const table = (rows, what, hrefBase) =>
  rows.length
    ? `    <div class="luck-scroll" tabindex="0" role="region" aria-label="Rips, packs, hits and hit rate by ${what}, scrollable table">
      <table class="luck-table">
        <caption class="sr-only">Rips, packs ripped, hits and hit rate by ${what}</caption>
        <thead><tr><th scope="col">${what}</th><th scope="col">Rips</th><th scope="col">Packs</th><th scope="col">Hits</th><th scope="col">Hit rate</th></tr></thead>
        <tbody>
${rows.map((r) => row(r, hrefBase)).join("\n")}
        </tbody>
      </table>
    </div>`
    : `    <p class="luck-empty">Nothing tagged yet. This fills in as the rip log gets marked up.</p>`;

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css and miniCSS makes in build-set-pages.mjs, and
// the same regex: comments, plus the indentation between rules. Nothing else.
//
// It is here because this block is inline in a render blocking <head> and the
// desktop rules added on 16 August 2026 came with the measurements that justify
// them written alongside. Measured on this page set, those comments were 17.1KB
// raw and 7.1KB gzipped across eight pages, up to 13% of one of them. Stripped,
// every one of these pages is smaller than it was before the rules were added.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
.luck{padding:var(--s7) 0 var(--s5)}
.luck-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
/* FIXED TRACKS THAT DIVIDE SIX, not auto-fit. auto-fit with six tiles strands
   one alone on a row at several widths, which is why the old five-tile version
   needed a :last-child{grid-column:1/-1} patch to hide the orphan. The home
   page's .rstat settled this and its comment argues it: pick counts that divide
   the tile count. 2 / 3 / 6 all do. */
.luck-head{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s3);margin-bottom:var(--s4)}
@media(min-width:600px){.luck-head{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1200px){.luck-head{grid-template-columns:repeat(6,1fr)}}
/* The chase deck: same tracks, one step quieter. Smaller number, flatter
   corner, no shadow. That flattening is the ONLY thing separating the two
   decks -- no new colour and no rule. */
.luck-chase{margin-bottom:var(--s5)}
.luck-chase-h{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink);margin-bottom:var(--s2)}
.luck-chase-h i{display:block;font:400 var(--t-sm)/1.4 var(--body);letter-spacing:normal;
  text-transform:none;color:var(--ink-2)}
.luck-chips{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s2)}
@media(min-width:600px){.luck-chips{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1200px){.luck-chips{grid-template-columns:repeat(6,1fr)}}
.luck-chip{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);
  padding:var(--s3);min-width:0}
.luck-chip b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep);
  overflow-wrap:anywhere}
.luck-chip span{display:block;margin-top:4px;font:700 var(--t-micro)/1.4 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);overflow-wrap:anywhere}
/* FIVE TILES IN A TWO COLUMN GRID LEAVES THE LAST ONE ALONE IN ITS ROW, and
   the last one is the hit rate, which is the headline of the whole page. It
   spans instead, so the orphan row becomes the emphasis it should have had. */
@media(max-width:700px){
}
.luck-stat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.luck-stat b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink);margin-bottom:4px}
.luck-stat span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}

/* How much of the log is actually tagged. Shown at the top rather than buried,
   because every number under it is only as good as this bar. */
.luck-cov{background:var(--lilac-pale);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);margin-bottom:var(--s6)}
.luck-cov p{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:8px}
/* rgba(78,47,72,...) is a plum left over from the old palette, on a site whose
   stated palette is black, white and gold. The track is the palette's own
   --paper-3 and the fill is the accent, which is what every other bar on the
   site uses. Nothing about the reading changes; it just stops being purple. */
.luck-covbar{height:10px;border-radius:99px;background:var(--paper-3);overflow:hidden;
  border:1px solid var(--hair)}
.luck-covbar i{display:block;height:100%;background:var(--gold);border-radius:99px}
/* Only rendered when every logged rip is a hit. A 100% headline with nothing
   next to it reads as a broken number, so the page says why before you ask. */
.luck-caveat{font:400 var(--t-sm)/1.6 var(--body)!important;color:var(--plum)!important;
  letter-spacing:0!important;text-transform:none!important;margin:10px 0 0!important;max-width:52em}

.luck-sec{padding:var(--s6) 0}
.luck-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s2)}
.luck-note{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.luck-scroll{overflow-x:auto;border:1px solid var(--hair);border-radius:var(--r);background-color:var(--card)}
/* background-COLOR, not the shorthand: ui.css paints a four layer scroll
   affordance on this class, and the background shorthand resets
   background-image, which would silently wipe all four layers. */
/* THE PRODUCT TABLE IS WIDER THAN THE SET TABLE NOW. min-width goes to 460px
   because the first column carries a 56px photograph plus two lines of label,
   and at 400px the hit-rate bar was squeezed to nothing. Both tables sit in
   .luck-scroll, so this widens the scroll rather than the page. */
.luck-table{border-collapse:collapse;width:100%;min-width:460px;font-size:var(--t-sm)}
/* Photo, then the product name with the set it is a photo OF underneath. The
   second line is not decoration: products.json is per set, so without it the
   picture is claiming to be "an ETB" rather than "Pitch Black's ETB". */
.luck-prod{display:flex;align-items:center;gap:var(--s3)}
.luck-prod img,.luck-noshot{flex:none;width:56px;height:56px;object-fit:contain;display:block;
  background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r-sm)}
/* No photograph exists that we can publish. The site's 45 degree no-art hatch,
   at the identical footprint so the column keeps its width. */
.luck-noshot{background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.luck-prodn{display:block;min-width:0}
.luck-prodn em{display:block;font:400 var(--t-micro)/1.3 var(--body);color:var(--ink-2);
  font-style:normal;margin-top:2px}
.luck-table th,.luck-table td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair)}
.luck-table tbody tr:last-child th,.luck-table tbody tr:last-child td{border-bottom:0}
.luck-table thead th{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);background:var(--page)}
.luck-table tbody th{font-weight:600}
.luck-table tbody th a:hover{text-decoration:underline}
.luck-table .num{font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink-2);width:1%}
/* The second line of a count cell: how many of them the number beside it is
   over. Same shape as .pc-nums dd em on the product cards, and no opacity on
   it for the reason recorded there. */
.luck-table .num em{display:block;font:400 var(--t-micro)/1.3 var(--body);font-style:normal;white-space:nowrap}
.luck-table .rate{width:40%;min-width:120px}
.luck-table tr.thin{opacity:.62}
.thin-note{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.04em;text-transform:uppercase}
/* Number first, bar second. With the bar leading, the percentage was pushed
   past the right edge of a 375px viewport and the one value the row exists to
   communicate was the one you had to scroll sideways to see. */
.lbar{display:flex;align-items:center;gap:8px}
.lbar b{flex:none;min-width:3.4em;font:700 var(--t-sm)/1 var(--body);font-variant-numeric:tabular-nums}
.lbar::after{content:"";height:10px;width:var(--w);min-width:3px;max-width:100%;flex:0 1 auto;
  background:var(--mustard);border:1px solid var(--gold-deep);border-radius:99px}

.pull-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--s3)}
.pull{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  text-align:center;box-shadow:var(--lift)}
.pull b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep)}
.pull span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.05em;text-transform:uppercase}

.streaks{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)}
@media(max-width:640px){.streaks{grid-template-columns:1fr}}
.streak{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.streak b{display:block;font:400 var(--t-xl)/1 var(--display);margin-bottom:4px}
.streak .k{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
.streak p{color:var(--ink-2);font-size:var(--t-sm);margin-top:8px}
.streak.cold b{color:var(--plum)}
.streak.hot b{color:var(--ketchup-deep)}
/* The streak's own rips. TEAL, because teal is how you get around, and
   --sky-deep #81BEDE rather than --sky, because this type is small: it measures
   4.50:1 on --card #2F4F39, exactly the AA line and the same deliberate pairing
   CLAUDE.md records as one of the two tightest on the site. --sky is 4.05:1 on
   the same ground and would fail. Read both values from ui.css, do not re-pick
   one. The kicker above each title is --ink-2 at 5.73:1, a caption and not a
   route, so the two accents never sit on each other.
   BLOCK anchors with a 44px minimum, so the tap target is the whole two-line
   row rather than the title's text run: same shape rule as every other link on
   the site. The list sits at the FOOT of the card, after the sentence that
   explains what the streak was, so nothing sends a reader away mid figure. */
.streak-rips{list-style:none;margin-top:var(--s4);padding:0;
  border-top:1px dashed var(--hair);display:grid;gap:2px}
.streak-rips li{padding-top:var(--s3)}
.streak-rips a{display:block;min-height:44px;font:600 var(--t-sm)/1.35 var(--body);color:var(--sky-deep)}
.streak-rips a:hover,.streak-rips a:focus-visible{text-decoration:underline}
.streak-rips a span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.streak-open{padding-top:var(--s3);color:var(--ink-2);font-size:var(--t-sm)}

.luck-method{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
.luck-empty{color:var(--ink-2);background:var(--card);border:1px dashed var(--hair);
  border-radius:var(--r);padding:var(--s5);text-align:center}

/* TWO COLUMNS OF INTRO PROSE FROM 1000px, and it is the same argument ui.css
   makes about the home page: the reading measure is capped at 50ch, so on a
   1,392px band one column of it used a third of the width and the grid of
   cards under it used all of it, which is the "top of the page reads as a
   different site from the bottom" failure. Two columns of 50ch fill the band
   without touching the measure, and take about 240px of height off at 1440. */
@media(min-width:1000px){
  .luck-intro{display:grid;grid-template-columns:repeat(2,minmax(0,50ch));gap:0 var(--s6);align-items:start}
}

/* ---------------------------------------------------- the product spine ----
   ONE CARD PER PRODUCT KIND, ordered by hits because that is the question Tim
   asked, with the rate and its denominator in the same box so the order cannot
   mislead on its own. Photo and the "Pitch Black shown" line are the product
   table's, moved across whole: products.json is per SET, so without that line
   the picture claims to be "an ETB" rather than "Pitch Black's ETB". */
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:var(--s4)}
.pcard{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift);display:flex;flex-direction:column;gap:var(--s3)}
/* A kind with too few logged rips to carry a rate is dimmed rather than hidden,
   the same treatment tr.thin gets in the table above, because "we opened one of
   these" is worth knowing and "1 of 1, 100%" is not. */
.pcard--thin{opacity:.72}
.pcard h3{display:flex;align-items:center;gap:var(--s3);font:400 var(--t-m)/1.2 var(--body);margin:0}
.pcard h3 img,.pcard h3 .luck-noshot{flex:none;width:52px;height:52px;object-fit:contain;display:block;
  background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r-sm)}
.pc-name{min-width:0;flex:1}
.pc-name a{font-weight:600}
.pc-name a:hover,.pc-name a:focus-visible{text-decoration:underline}
.pc-name em{display:block;font:400 var(--t-micro)/1.3 var(--body);color:var(--ink-2);font-style:normal;margin-top:2px}
/* MOST HITS is a FLAG on a count, not a prize, so it is the small pink that
   every other "the site is saying this" mark on the page uses. --ketchup-deep
   and not --ketchup: this is 11px type and #E87EA1 measures 3.45:1 on the card. */
.pc-flag{flex:none;font:700 var(--t-micro)/1 var(--mono);color:var(--ketchup-deep);
  letter-spacing:.06em;border:1px solid var(--hair);border-radius:var(--r-pill);padding:5px 8px}
.pc-nums{display:flex;flex-wrap:wrap;gap:var(--s3) var(--s5);margin:0}
.pc-nums div{min-width:0}
.pc-nums dt{font:700 var(--t-micro)/1.2 var(--mono);color:var(--ink-2);letter-spacing:.06em;text-transform:uppercase}
/* NO opacity HERE. The second word of a label ("RIPPED", "AT LEAST") was
   --ink-2 at .8, which measures 4.40:1 on --card against the 4.5 AA line at
   11px. It is the word that says WHICH quantity the number under it is, so it
   is the last thing on the card that should be faded. Full --ink-2, 5.73:1. */
.pc-nums dt em{font-style:normal;display:block;font-weight:700}
.pc-nums dd{margin:2px 0 0;font:400 var(--t-l)/1 var(--display);color:var(--ink)}
.pc-nums dd em{display:block;font:400 var(--t-micro)/1.3 var(--body);color:var(--ink-2);font-style:normal;margin-top:3px}
.pc-none{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);text-transform:uppercase}
.pc-rate{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2) var(--s3);margin:0}
.pc-rate .lbar{flex:1 1 120px}
/* THE DENOMINATOR TRAVELS WITH THE RATE AND IS NOT SMALLER THAN IT. "12 of 57"
   and "1 of 1" must not be able to look alike, which is the whole reason this
   line exists rather than a footnote. */
.pc-den{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.04em;text-transform:uppercase}
.pc-best{display:block;border-top:1px dashed var(--hair);padding-top:var(--s3)}
.pc-best em{display:block;font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  font-style:normal;letter-spacing:.06em;text-transform:uppercase}
.pc-best a{display:inline-block;min-height:24px;font:600 var(--t-sm)/1.4 var(--body);color:var(--sky-deep)}
.pc-best a:hover,.pc-best a:focus-visible{text-decoration:underline}
.pc-best b{display:inline;font:700 var(--t-sm)/1.4 var(--body);color:var(--ketchup-deep);margin-left:6px}
.pc-best i{display:block;font:400 var(--t-micro)/1.3 var(--body);color:var(--ink-2);font-style:normal;margin-top:2px}
.pc-best--none i{margin-top:4px}

/* --------------------------------------------------------- the best band ---
   THREE READINGS OF "BEST", SIDE BY SIDE, BECAUSE THEY DISAGREE. That
   disagreement is the content: the card with the highest guide value is not
   the card with the highest PSA 10, and neither is the product kind that has
   returned the most value a rip. */
.bests{display:grid;grid-template-columns:repeat(auto-fit,minmax(248px,1fr));gap:var(--s4)}
.bestc{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.bestc>span{display:block;font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.08em;text-transform:uppercase}
/* DIRECT CHILD ONLY. A bare .bestc b painted the words "At least" inside the third
   card's PROSE at --t-xl in the display face, a 40px pink shout in the middle
   of a sentence, because that paragraph uses <b> for emphasis exactly like the
   rest of the page does. The headline figure is the figure, not every bold
   word under it. */
.bestc > b{display:block;font:400 var(--t-xl)/1.05 var(--display);color:var(--ketchup-deep);margin:6px 0 4px}
.bestc p b{font-weight:600;color:var(--ink)}
.bestc a{display:block;min-height:24px;font:600 var(--t-sm)/1.4 var(--body);color:var(--sky-deep)}
.bestc a:hover,.bestc a:focus-visible{text-decoration:underline}
.bestc p{color:var(--ink-2);font-size:var(--t-sm);margin-top:8px}

/* -------------------------------------------------------------- the figures -
   .lf is every drawing on this page. width:100% with a max-width is the same
   shape .sg-svg uses on /will-it-grade.html, and the max-width is what stops a
   1,392px band from scaling 10px type to 43px. */
 /* THE CAP IS ON THE FIGURE, NOT ON THE SVG, and that is not a tidy-up. With
    max-width on the drawing alone, a 1,030px rail column centred a 520px chart
    and then ran its caption the full width underneath, so the two started at
    different left edges and read as two separate things. Capping the FIGURE
    makes the drawing and the sentence about it one column. */
.luck-fig{margin:0;max-width:520px}
.lf{display:block;width:100%;height:auto}
.luck-fig figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s3)}
.luck-fig figcaption b{color:var(--ink);font-weight:600}
/* EVERY COLOUR IS A CLASS. A custom property inside a fill= or stroke=
   presentation attribute is not reliable across browsers, which is the rule
   build-grade-check.mjs states and the reason there is not one paint attribute
   in the three drawings this file emits. */
.rf-lab{fill:var(--ink);font:700 10px/1 var(--mono);text-anchor:middle}
.rf-n{fill:var(--ink);font:700 10px/1 var(--mono)}
.rf-end{text-anchor:end}
.rf-mid{text-anchor:middle}
.rf-key{fill:var(--ink-2);font:700 9px/1 var(--mono);letter-spacing:.06em}
/* A dry run is drawn as a SURFACE and a hot one as the accent, which is the
   same pairing .lbar already makes on this page: the bar that means something
   good is --mustard over --gold-deep, and nothing is the lightest painted step
   on a keyline. Neither carries meaning by colour alone -- the two sides are
   labelled, separated and counted. */
.rf-dry{fill:var(--paper-3);stroke:var(--keyline);stroke-width:1}
.rf-hot{fill:var(--mustard);stroke:var(--gold-deep);stroke-width:1}
.pf-bar{fill:var(--mustard);stroke:var(--gold-deep);stroke-width:1}
/* NOT ENOUGH RIPS BEHIND IT TO READ. An empty frame at full height, so it
   occupies the column without asserting a value in it. */
.pf-thin{fill:none;stroke:var(--keyline);stroke-width:1;stroke-dasharray:3 3;opacity:.75}
.pf-base{stroke:var(--keyline);stroke-width:1}
.pf-grid{stroke:var(--ink);stroke-width:1;opacity:.14}
.pf-avg{stroke:var(--ketchup-deep);stroke-width:1.5;stroke-dasharray:5 4}
.pf-ax{fill:var(--ink-2);font:700 9px/1 var(--mono);text-anchor:middle}
.pf-n{fill:var(--ink-2);font:700 8px/1 var(--mono);text-anchor:middle}
.pf-key{fill:var(--ink-2);font:700 9px/1 var(--mono);letter-spacing:.05em}
.pf-end{text-anchor:end}
.pf-mid{text-anchor:middle}
.mf-hit{fill:var(--mustard);stroke:var(--gold-deep);stroke-width:.5}
.mf-log{fill:var(--paper-3);stroke:var(--keyline);stroke-width:.5}
.mf-un{fill:url(#lk-un);stroke:var(--keyline);stroke-width:.5}
.mf-unbg{fill:var(--paper)}
.mf-unln{stroke:var(--keyline);stroke-width:1.6}
.mf-base{stroke:var(--keyline);stroke-width:1}
.mf-ax{fill:var(--ink-2);font:700 9px/1 var(--mono);text-anchor:middle}
.mf-yr{fill:var(--ink-2);font:700 8px/1 var(--mono);text-anchor:middle}
.mf-key{fill:var(--ink-2);font:700 9px/1 var(--mono);letter-spacing:.05em}
.mf-mid{text-anchor:middle}

/* ------------------------------------- the drawn type at the narrowest phone
   THE PX IN EVERY RULE ABOVE IS A VIEWBOX UNIT AND NOT A RENDERED PIXEL, which
   is the whole reason this block exists and the reason the sizes above look
   safe and are not. All three drawings are a 320 unit box, and .lf is
   width:100% inside a .wrap, so the SCALE is the wrap width over 320:

        320px phone   wrap 280   x0.875    9 units ->  7.88px   8 ->  7.00px
        390px phone   wrap 350   x1.094    9 units ->  9.84px   8 ->  8.75px
        1440 desktop  cap  520   x1.625    9 units -> 14.63px   8 -> 13.00px

   MEASURED, NOT DERIVED FROM THE STYLESHEET: getScreenCTM().a on each text node
   times its user-unit font-size, cross-checked against getBoundingClientRect.
   getComputedStyle on SVG text reports USER UNITS and reads 9 at every width,
   so it can never see this and a comment quoting it is quoting nothing.

   The floor is the one build-grade-check.mjs argues beside .gd-fig and it is
   --t-label, 12px: nothing drawn ON a picture may be smaller than the prose
   explaining it, and these captions are --t-sm. A 320px phone was 4 to 5px
   under it on all three.

   ONLY THE RUN FIGURE TAKES THE FIX, AND THE REASON THE OTHER TWO CANNOT IS
   NOT THE ONE IT LOOKS LIKE. The obvious cap is horizontal room, measured per
   label off getBBox in user space against the viewBox edge and the label's own
   text-anchor: pf's tightest is the y-axis "100", end-anchored at x=22, which
   leaves the box past 11.99 units; rf's is "DRY RUNS" at 23.45; mf's is "NOT
   LOGGED YET" at 20.19. By that alone rf and mf both clear the 13.71 units
   that 12px needs at x0.875.

   THE REAL CAP IS strideFor, AND IT IS A BUILD-TIME DECISION ABOUT A
   RENDER-TIME SIZE. strideFor(pitch, chars) is
   ceil((chars * 5.4 + 4) / pitch), and the 5.4 in it is 9 units x the 0.6em
   Space Mono advance: it decides WHICH tick labels are drawn at all by asking
   how many fit AT NINE UNITS. Every .pf-ax, .pf-n, .mf-ax and .mf-yr on
   the page is gated by it. Grow that type in a media query and the thinning
   does not re-run -- the SVG was written once, at build time -- so the labels
   that were exactly one stride apart now overlap, and SVG text neither wraps
   nor clips, so nothing errors and the axis just goes to mush. THE COLLISION IS
   WITH A SIBLING, NOT WITH THE EDGE, which is why the headroom number above
   does not see it.

   mf HAS THE SAME FAULT IN ITS LEGEND, independently of strideFor: "HIT" starts
   at x=19 and the next swatch is a rect at x=46, so 3 chars of .mf-key may
   not pass 13.6 units, and "NOTHING" at x=59 against the swatch at x=120 caps
   it at 13.2. Both are under the 13.71 the floor needs, and neither is visible
   to a check that only measures the viewBox.

   SO pf AND mf NEED A REDRAW AND ARE LEFT FOR ONE, which is the same call
   /what-set.html's secret-rares chart already has. The redraw is not "bigger
   type": it is a NARROWER viewBox, because 320 units drawn into 280px is what
   makes 9 units 7.88px, and the desktop is already correct at 14.63px. Bumping
   the units in the builder instead would take the desktop to 22.75px, which is
   an axis tick the size of a heading. Do not do that.

   rf HAS NO STRIDE AND NO SIBLING GEOMETRY IN THE WAY. Every row is drawn,
   ROW is a fixed 22 units, and the three labels live in fixed gutters: the
   count labels sit outside bars that stop at L=126 and R=194, and .rf-lab
   sits in the 68-unit channel between them. At 14 units the widest row label
   ("8 rips", 6 chars) is 50.4 units in a 68 unit channel, the header row's
   "DRY RUNS" ends exactly on L, and the deepest count label lands at x=12.2
   against a left edge of 0. Checked at every row rather than at the worst one.

   IT IS INSIDE max-width:544, this site's own phone breakpoint (build-shops
   .mjs's map key and build-proto.mjs's home-page cut both use it), so the
   desktop is untouched by construction rather than by intention.

   THE HEADER ROW IS 13 AND THE DATA ROWS ARE 14, AND THAT SPLIT WAS FORCED BY
   LOOKING AT IT. .rf-key is the three column headings, and they are pinned to
   the bar boundaries rather than laid out against each other: "DRY RUNS" ends
   ON L=126, "LENGTH" is centred on 160 and "HOT RUNS" starts ON R=194. At 14
   units that leaves 6.3 units between them, about half a character, and
   screenshotted at 320 the three read as one run of words rather than as three
   labels. Nothing collides and no check catches it. 13 units puts the gap back
   to 8.3 and costs the heading row 0.87px. Opening it properly means moving L
   and R, which moves the bars at every width, so it is a redraw.

   SO THE ROW LABELS AND COUNTS CLEAR THE FLOOR AT 12.25px AND THE THREE COLUMN
   HEADINGS SIT AT 11.38px. That is deliberate and it is the right way round:
   the headings are read once and the rows are the figure. */
@media(max-width:544px){
.rf-key{font-size:13px}
.rf-lab{font-size:14px}
.rf-n{font-size:14px}
}

/* ------------------------------------------------------------ the ledger ---
   WHERE EVERY NUMBER ON THIS PAGE CAME FROM, one row each. It is a table
   rather than a paragraph because a reader checking one figure wants one row,
   and because a row cannot be dropped by accident the way a clause can. */
.ledger{width:100%;border-collapse:collapse;font-size:var(--t-sm);min-width:420px}
.ledger th,.ledger td{text-align:left;padding:9px var(--s3);border-bottom:1px solid var(--hair);vertical-align:top}
.ledger thead th{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);background:var(--page)}
.ledger tbody th{font-weight:600;color:var(--ink)}
.ledger td{color:var(--ink-2)}
.ledger td em{font-style:normal;color:var(--ink);font-variant-numeric:tabular-nums}
.ledger tbody tr:last-child th,.ledger tbody tr:last-child td{border-bottom:0}

/* The mascot line. Trubbish means "there is nothing in this one", which is the
   grammar build-search.mjs argues for the two of them, and a band about the
   rips that produced nothing is the one place on this page it is earned. One
   line, one place. */
.trub{display:flex;align-items:center;gap:var(--s3);margin-top:var(--s4);
  font:400 var(--t-sm)/1.5 var(--body);color:var(--ink-2)}
.trub b{flex:none;font:700 var(--t-micro)/1 var(--mono);color:var(--ketchup-deep);
  letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--hair);
  border-radius:var(--r-pill);padding:6px 10px}

/* DESKTOP. min-width only, so a phone and a tablet render what they rendered
   before. Measured identical at 390 before and after.

   WHAT WAS WRONG, MEASURED AT 1440. Both hit-rate tables ran the full 1,392px
   with four columns in them: a set name, two counts and a bar. The name column
   took the remainder, 730px, to hold "Pitch Black", and the bar took 480px of
   the rest, so the two numbers a reader is comparing sat half a screen apart.
   Prose measured 87 characters a line against a 65 to 75 target.

   The heading and its note move beside the table rather than above it, which
   narrows the table to about 1,030px and pulls the columns back together, and
   takes roughly 130px off the page per section.

   The three children are placed by hand rather than left to auto-placement,
   which fills row major and would put the note next to the heading instead of
   under it. .luck-empty is placed with .luck-scroll because table() renders one
   or the other: with nothing logged there is no table, and an unplaced child
   would auto-flow into the hole the explicit rules leave. */
@media(min-width:1200px){
  /* THE THIRD ROW IS A SPACER AND IT IS LOAD BEARING. The table is far taller
     than the heading and the note put together, and a grid distributes a
     spanning item's leftover height across the rows it spans. With two rows,
     row 2 grew to soak up the difference and the note was pushed 380px down the
     page, marooned in the middle of the rail with a hole above it. A third row
     at 1fr takes all the slack instead, so rows 1 and 2 stay at their content
     height and the heading and note sit together at the top where they read. */
  .luck-rail > .wrap{display:grid;grid-template-columns:320px minmax(0,1fr);
    grid-template-rows:auto auto 1fr;gap:0 var(--s6);align-items:start}
  .luck-rail > .wrap > h2{grid-column:1;grid-row:1;margin-bottom:var(--s2)}
  .luck-rail > .wrap > .luck-note{grid-column:1;grid-row:2;margin-bottom:0}
  /* .luck-fig JOINS THE SAME PLACEMENT LIST AND HAS TO. Everything in this
     grid is placed by hand, so a child with no rule of its own auto-flows into
     whichever hole the explicit rules left, which for a figure is column 1
     under the note. Same reason .luck-empty is named beside .luck-scroll. The
     drawings sit in the right hand column with the tables, and the heading and
     its note read down the rail beside them.
     .trub IS PLACED WITH THE NOTE rather than in the rail, because it is the
     band's last sentence and not a caption on the drawing. */
  .luck-rail > .wrap > .luck-scroll,
  .luck-rail > .wrap > .luck-fig,
  .luck-rail > .wrap > .luck-empty{grid-column:2;grid-row:1 / span 3}
  .luck-rail > .wrap > .bests{grid-column:2;grid-row:1 / span 3}
  .luck-rail > .wrap > .trub{grid-column:1;grid-row:3;align-self:start;margin-top:var(--s4)}
  .luck-rail > .wrap > .luck-method{grid-column:1;grid-row:3;align-self:start;margin:var(--s5) 0 0}
}
/* Reading measure. The em based caps above were set against the body face and
   .luck-lede is set in the larger --t-lede, so 42em came out at 748px and 87
   characters a line. ch is the width of a "0" in the element's OWN font, which
   is the unit that tracks the count rather than the type size.

   50ch AND NOT 70ch. ch is one DIGIT wide, and a digit is one of the widest
   glyphs in Outfit: measured across these pages the average character is about
   0.7 of a ch, so 50ch sets around 70 characters and 70ch would set 100. The
   full measurement is written out in build-buying.mjs.

   Capped only from 1000px up, because below that the caps never bind. */
@media(min-width:1000px){
  .luck-lede{max-width:52ch}
  .luck-note,.luck-caveat{max-width:50ch}
  /* The method note was the widest measure left on the page after the rest was
     capped: 616px of 11px mono setting 87 characters a line, on the paragraph
     that explains how every number above it was counted. Capped wider than the
     prose because mono at 11px is reference type, but not left running. */
  .luck-method{max-width:72ch}
}
`;

// ===========================================================================
// THE THREE DRAWINGS.
//
// THE IDIOM IS /fake-cards.html's AND /will-it-grade.html's AND IT WAS COPIED
// RATHER THAN INVENTED: an inline <svg role="img"> with a viewBox and a one
// SENTENCE aria-label, no binary asset, no request, and EVERY colour set from a
// CLASS rather than from a fill= or stroke= presentation attribute, because a
// custom property inside a presentation attribute is not reliable across
// browsers. build-grade-check.mjs states both halves of that rule.
//
// THEY DO NOT SCROLL AND THEY DO NOT SHRINK THEIR TYPE, WHICH IS THE ONE
// DESIGN DECISION IN HERE WORTH ARGUING. A chart with a column per month, or
// per pack number, gets WIDER as the log fills, and there are only three ways
// to take that: let the viewBox grow and cap the rendered width, which shrinks
// the type until it is unreadable on a phone; let it grow and scroll, which
// hides the newest months off the right on the width most readers are on; or
// hold the viewBox at 320 units and let the COLUMNS get thinner. This takes the
// third, so 10px type stays 10px at every future size of this data set, and the
// only thing that degrades is column width. The labels then have to thin out
// instead, which `stride` does from a MEASURED character advance: Space Mono
// advances 0.6em, so a 3 character label at 9px is 16.2 units and a column
// pitch under that cannot carry one. Nothing here needs hand editing when rows
// 258 to 319 land, or when there are twenty months instead of seven.
const svgFig = (id, label, viewW, viewH, body, caption) => `      <figure class="luck-fig">
        <svg viewBox="0 0 ${viewW} ${viewH}" class="lf ${id}" role="img" aria-label="${esc(label)}">
${body}
        </svg>
        <figcaption>${caption}</figcaption>
      </figure>`;

/** How many labels a row of this pitch can carry without them touching. */
const strideFor = (pitch, chars) => Math.max(1, Math.ceil((chars * 5.4 + 4) / pitch));

const runFigure = () => {
  if (!runMax) return "";
  const W = 320, ROW = 22, TOP = 26, MAXBAR = 92, L = 126, R = 194;
  const H = TOP + runMax * ROW + 6;
  const maxCount = Math.max(1, ...dryTally.values(), ...hotTally.values());
  const rows = [];
  for (let n = 1; n <= runMax; n++) {
    const y = TOP + (n - 1) * ROW;
    const mid = y + 15;
    const d = dryTally.get(n) || 0;
    const h = hotTally.get(n) || 0;
    const dw = d ? Math.max(3, (d / maxCount) * MAXBAR) : 0;
    const hw = h ? Math.max(3, (h / maxCount) * MAXBAR) : 0;
    rows.push(
      `          <text x="160" y="${mid}" class="rf-lab">${n} rip${n === 1 ? "" : "s"}</text>` +
        (d
          ? `<rect x="${(L - dw).toFixed(1)}" y="${y + 4}" width="${dw.toFixed(1)}" height="14" rx="2" class="rf-dry"/><text x="${(L - dw - 5).toFixed(1)}" y="${mid}" class="rf-n rf-end">${d}</text>`
          : "") +
        (h
          ? `<rect x="${R}" y="${y + 4}" width="${hw.toFixed(1)}" height="14" rx="2" class="rf-hot"/><text x="${(R + hw + 5).toFixed(1)}" y="${mid}" class="rf-n">${h}</text>`
          : "")
    );
  }
  const body = `          <text x="${L}" y="14" class="rf-key rf-end">DRY RUNS</text>
          <text x="160" y="14" class="rf-key rf-mid">LENGTH</text>
          <text x="${R}" y="14" class="rf-key">HOT RUNS</text>
${rows.join("\n")}`;
  const label =
    `A chart of how long the runs go. Reading down, one row for each length from one rip to ${runMax}. ` +
    `On the left, ${dryRuns.length} separate runs of rips with nothing in them; on the right, ${hotRuns.length} runs where every rip hit. ` +
    `The commonest length on both sides is one rip, and the longest dry run is ${Math.max(0, ...dryRuns)}.`;
  const cap = `Every run of the same result in a row, counted over the ${judged.length} answered rips in upload order.
        There are ${dryRuns.length} dry runs and ${hotRuns.length} hot ones, which is what a channel sitting near a coin flip looks
        like: both sides are stacked at the short end and both have one long tail. The bars are counts of RUNS, not of rips.`;
  return svgFig("rf", label, W, H, body, cap);
};

const packFigure = () => {
  if (!packNoRows.length) return "";
  const W = 320, LEFT = 26, RIGHT = 6, TOP = 14, PLOT = 112;
  const base = TOP + PLOT;
  // THE AXIS TITLE COLLIDED WITH THE SAMPLE ROW AND IT WAS NOT SUBTLE. Three
  // rows live under the baseline: the pack number at +13, the number of rips
  // behind it at +25, and the title. At +33 the title painted straight through
  // the 8px sample row, because SVG text neither wraps nor clips and nothing
  // errors when it overlaps. Measured off the render, not guessed: 9px type at
  // +13, 8px at +25, so the title clears at +42 and the box has to be +48.
  const H = base + 48;
  const n = packNoRows.length;
  const pitch = Math.min(30, (W - LEFT - RIGHT) / n);
  const barW = Math.max(4, Math.min(18, pitch * 0.62));
  const y = (p) => base - (p / 100) * PLOT;
  const overall = pct(hits.length, judged.length);
  const stride = strideFor(pitch, String(n).length);
  const cols = packNoRows
    .map((r, i) => {
      const x = LEFT + i * pitch + (pitch - barW) / 2;
      const shown = i === 0 || i === n - 1 || (i + 1) % stride === 0;
      const bar = r.enough
        ? `<rect x="${x.toFixed(1)}" y="${y(r.rate).toFixed(1)}" width="${barW.toFixed(1)}" height="${(base - y(r.rate)).toFixed(1)}" class="pf-bar"/>`
        : r.rips
          ? `<rect x="${x.toFixed(1)}" y="${TOP.toFixed(1)}" width="${barW.toFixed(1)}" height="${PLOT}" class="pf-thin"/>`
          : "";
      const cx = (x + barW / 2).toFixed(1);
      return `          ${bar}${shown ? `<text x="${cx}" y="${base + 13}" class="pf-ax">${r.n}</text>` : ""}${
        r.rips && shown ? `<text x="${cx}" y="${base + 25}" class="pf-n">${r.rips}</text>` : ""
      }`;
    })
    .join("\n");
  const body = `          <line x1="8" y1="7" x2="22" y2="7" class="pf-avg"/>
          <text x="26" y="10" class="pf-key">EVERY ANSWERED RIP, ${overall}%</text>
          <line x1="${LEFT}" y1="${base}" x2="${W - RIGHT}" y2="${base}" class="pf-base"/>
          <line x1="${LEFT}" y1="${y(50).toFixed(1)}" x2="${W - RIGHT}" y2="${y(50).toFixed(1)}" class="pf-grid"/>
          <text x="${LEFT - 4}" y="${(y(50) + 3).toFixed(1)}" class="pf-ax pf-end">50</text>
          <text x="${LEFT - 4}" y="${(base + 3).toFixed(1)}" class="pf-ax pf-end">0</text>
          <text x="${LEFT - 4}" y="${(TOP + 4).toFixed(1)}" class="pf-ax pf-end">100</text>
${cols}
          <line x1="${LEFT}" y1="${y(overall).toFixed(1)}" x2="${W - RIGHT}" y2="${y(overall).toFixed(1)}" class="pf-avg"/>
          <text x="${(LEFT + (W - LEFT - RIGHT) / 2).toFixed(1)}" y="${base + 42}" class="pf-key pf-mid">PACK NUMBER, AND HOW MANY RIPS OF IT</text>`;
  const label =
    `A column chart of hit rate against pack number, one column for each pack from 1 to ${n}, with the number of answered rips printed under each. ` +
    `The dashed line across it is the rate over every answered rip, ${overall} percent. ` +
    `${packNoRows.filter((r) => !r.enough && r.rips).length} of the ${n} columns have fewer than ${MIN_SAMPLE} answered rips behind them and are drawn as empty frames with no reading in them.`;
  const cap = `Hit rate by which pack out of the box it was, over the ${packNoJudged} answered rips that state a Pack number.
        An empty frame is a pack number with fewer than ${MIN_SAMPLE} answered rips behind it: the sample is there, the reading is not.
        <b>The right hand end is not a later moment in one box.</b> Pack 9 only exists inside products that hold nine packs, so
        the columns are a different mix of products as you go right, and the thinning sample is the same fact said twice.`;
  return svgFig("pf", label, W, H, body, cap);
};

const monthFigure = () => {
  if (monthRows.length < 2) return "";
  const W = 320, LEFT = 6, RIGHT = 6, TOP = 16, PLOT = 108;
  const base = TOP + PLOT;
  // Same clearance sum as the pack chart above: month at +13, year at +24, so
  // the title needs +40 and the box +46.
  const H = base + 46;
  const n = monthRows.length;
  const pitch = Math.min(44, (W - LEFT - RIGHT) / n);
  const barW = Math.max(4, Math.min(26, pitch * 0.66));
  const maxFilmed = Math.max(1, ...monthRows.map((m) => m.filmed));
  const hOf = (k) => (k / maxFilmed) * PLOT;
  const stride = strideFor(pitch, 3);
  let lastYear = null;
  const cols = monthRows
    .map((m, i) => {
      const x = LEFT + i * pitch + (pitch - barW) / 2;
      const shown = i === 0 || i === n - 1 || (i + 1) % stride === 0;
      const hh = hOf(m.hits);
      const hl = hOf(m.logged - m.hits);
      const hu = hOf(m.filmed - m.logged);
      const yHit = base - hh;
      const yLog = yHit - hl;
      const yUn = yLog - hu;
      const cx = (x + barW / 2).toFixed(1);
      const yearMark = m.year !== lastYear;
      lastYear = m.year;
      return `          ${hh > 0 ? `<rect x="${x.toFixed(1)}" y="${yHit.toFixed(1)}" width="${barW.toFixed(1)}" height="${hh.toFixed(1)}" class="mf-hit"/>` : ""}${
        hl > 0 ? `<rect x="${x.toFixed(1)}" y="${yLog.toFixed(1)}" width="${barW.toFixed(1)}" height="${hl.toFixed(1)}" class="mf-log"/>` : ""
      }${hu > 0 ? `<rect x="${x.toFixed(1)}" y="${yUn.toFixed(1)}" width="${barW.toFixed(1)}" height="${hu.toFixed(1)}" class="mf-un"/>` : ""}${
        shown ? `<text x="${cx}" y="${base + 13}" class="mf-ax">${m.label}</text>` : ""
      }${shown && yearMark ? `<text x="${cx}" y="${base + 24}" class="mf-yr">${m.year}</text>` : ""}`;
    })
    .join("\n");
  const body = `          <defs><pattern id="lk-un" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="mf-unbg"/><line x1="0" y1="0" x2="0" y2="5" class="mf-unln"/></pattern></defs>
          <rect x="6" y="2" width="9" height="9" class="mf-hit"/><text x="19" y="10" class="mf-key">HIT</text>
          <rect x="46" y="2" width="9" height="9" class="mf-log"/><text x="59" y="10" class="mf-key">NOTHING</text>
          <rect x="120" y="2" width="9" height="9" class="mf-un"/><text x="133" y="10" class="mf-key">NOT LOGGED YET</text>
${cols}
          <line x1="${LEFT}" y1="${base}" x2="${W - RIGHT}" y2="${base}" class="mf-base"/>
          <text x="${(LEFT + (W - LEFT - RIGHT) / 2).toFixed(1)}" y="${base + 40}" class="mf-key mf-mid">RIPS FILMED EACH MONTH</text>`;
  const first = monthRows[0], last = monthRows[n - 1];
  const gaps = monthRows.filter((m) => m.filmed > m.logged);
  const label =
    `A stacked column chart of rips filmed each month from ${first.label} ${first.year} to ${last.label} ${last.year}. ` +
    `Each column is split into the rips that hit, the rips that produced nothing, and the rips not yet logged either way. ` +
    `The tallest month is ${maxFilmed} rips. ${gaps.length === 0 ? "Every month has an answer for every rip." : `${gaps.length} of the ${n} months still carry rips with no answer yet.`}`;
  const cap = `Every one of the ${videos.length} rips, by the month it went up. The hatched part of a column is the part of that
        month nobody has answered yet, which is why this drawing is also the coverage picture: ${
          gaps.length === 0
            ? "there is none of it left."
            : `${gaps.length} of the ${n} months still have some, and the shortfall is ${videos.length - judged.length} rips in total.`
        } As the log fills, the hatching goes and nothing else about this chart moves.`;
  return svgFig("mf", label, W, H, body, cap);
};

// ------------------------------------------------------- the product spine
//
// TIM ASKED TWO QUESTIONS AND THE FIRST ONE HAS A TRAP IN IT: "what product
// type has given us the most hits, what product type has given us the best
// hits". Most hits is a COUNT, the product types are opened wildly unevenly,
// and the answer to the question as asked is "the one we opened most of".
//
// SO EVERY CARD PRINTS THE COUNT AND THE RATE AND THE DENOMINATOR TOGETHER,
// at the same size, in the same box. The grid is ordered by hits, because that
// is what he asked for, and the row under the heading says out loud that the
// order is a count and names what the rate order would be instead. A reader
// who only looks at the first card still cannot come away with the wrong idea.
const prodCard = (r, rank) => {
  const shot = shotFor(r.key);
  const enough = r.judged >= MIN_SAMPLE;
  const bestLine = (c, kind) =>
    c
      ? `<span class="pc-best"><em>${kind}</em><a href="/${esc(c.v.path)}">${esc(c.name)}</a><b>${esc(moneyCompact(kind === "Best PSA 10" ? c.psa : c.raw))}</b>${
          c.setName ? `<i>${esc(c.setName)}</i>` : ""
        }</span>`
      : "";
  return `        <article class="pcard${enough ? "" : " pcard--thin"}">
          <h3>${shot
            ? `<img src="${esc(shot.src)}" sizes="52px" alt="${esc(shot.name)}, sealed" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
            : `<span class="luck-noshot" aria-hidden="true"></span>`}<span class="pc-name"><a href="/videos.html?product=${esc(r.key)}">${esc(r.label)}</a>${
    shot ? `<em>${esc(shot.set)} shown</em>` : `<em>no photo we can publish</em>`
  }</span>${rank === 0 && r.hits > 0 ? '<span class="pc-flag">MOST HITS</span>' : ""}</h3>
          ${/* THREE NUMBERS THAT ARE THREE DIFFERENT THINGS, so each one wears
                its own word. Rips is videos. Packs is packs RIPPED ON CAMERA,
                out of the rips that state one. Boxes is a FLOOR out of the
                Pack # ordinals, and a loose pack has none because a loose pack
                is its own unit. See the boxFloor note above. */ ""}
          <dl class="pc-nums">
            <div><dt>Rips</dt><dd>${r.vids}</dd></div>
            <div><dt>Packs<em>ripped</em></dt><dd>${r.packVids ? `${r.packs}<em>over ${r.packVids} rip${r.packVids === 1 ? "" : "s"}</em>` : '<span class="pc-none">none say</span>'}</dd></div>
            ${r.boxes ? `<div><dt>Boxes<em>at least</em></dt><dd>${r.boxes}${r.capacity ? `<em>${r.boxes * r.capacity} packs in them</em>` : ""}</dd></div>` : ""}
            <div><dt>Hits</dt><dd>${r.hits}</dd></div>
          </dl>
          <p class="pc-rate">${
            enough
              ? `<span class="lbar" style="--w:${Math.max(2, r.rate)}%"><b>${r.rate}%</b></span><span class="pc-den">${r.hits} of ${r.judged} answered rips</span>`
              : `<span class="thin-note">${r.hits} of ${r.judged} answered rip${r.judged === 1 ? "" : "s"} &bull; too few for a rate</span>`
          }</p>
          ${bestLine(r.bestRaw, "Best card") || '<span class="pc-best pc-best--none"><em>Best card</em><i>nothing from this one carries a guide value yet</i></span>'}
          ${bestLine(r.bestPsa, "Best PSA 10")}
        </article>`;
};

const headline = judged.length
  ? `${pct(hits.length, judged.length)}%`
  : "-";

const body = `
<main id="main">
  <section class="luck">
    <div class="wrap">
      <div class="brk"><h1>Luck, <span class="hl">measured</span></h1><span class="ln"></span></div>
      ${/* THE LEDE KEEPS ITS FIRST TWO CLAUSES AND LOSES THE THIRD. "Nobody
            publishes real pull rates" is why this page exists and "one person's
            luck, not the odds" is the honesty claim that stops it being read as
            odds; both stay. "Counted rather than remembered" was the rip log
            talking about itself. */ ""}
      <p class="luck-lede">Nobody publishes real pull rates, so this page does the next best thing:
        it counts what actually came out of packs opened on camera, one rip at a time. It is one
        person's luck, not the odds.</p>

      ${/* THE LAST TILE USED TO READ "hit rate so far" WITH NO DENOMINATOR ON
            IT. A stat tile is the part of a page that gets screenshotted, and
            "49.5% hit rate" on its own is the same shape as the mistake this
            project has already made once, where 56% coverage was reported as a
            56% hit rate. The denominator is in the label now, computed. */ ""}
      ${/* SIX TILES ON A GRID THAT DIVIDES SIX, and the old five were on
            auto-fit with a :last-child{grid-column:1/-1} patch to hide the
            orphan an odd count leaves. Fixed tracks make the patch unnecessary.

            "RIPS WITH AN ANSWER" IS GONE and it is the only tile that was
            spreadsheet narration. It printed the identical number to "rips
            filmed" under a second label, because coverage is 100%, so it said
            nothing and read as a bug.

            THE ORDER SOLVES THE UNIT BLUR WITHOUT PROSE: 1 and 2 are things
            opened, 3 is CARDS, 4 and 5 are RIPS. Tile 4 carries its own
            denominator so 156 can never be read as a card count while 214 sits
            two tiles away. */ ""}
      <div class="luck-head">
        <div class="luck-stat"><b>${allPacks.toLocaleString("en-US")}</b><span>packs opened on camera</span></div>
        <div class="luck-stat"><b>${videos.length}</b><span>rip videos</span></div>
        <div class="luck-stat"><b>${cardLedger.length}</b><span>hit cards pulled</span></div>
        <div class="luck-stat"><b>${hits.length}</b><span>rips that hit, of ${judged.length}</span></div>
        <div class="luck-stat"><b>${headline}</b><span>hit rate per rip</span></div>
        <div class="luck-stat"><b>${Math.round((hits.length / allPacks) * 1000) / 10}%</b><span>hit rate per pack</span></div>
      </div>

      ${/* THE CHASE DECK. Counts of CARDS, rarest tier first, and the header
            says "cards" once so six chips do not each have to. Quieter than the
            deck above it by exactly one step -- smaller number, flatter box, no
            shadow -- and no new colour, no rule, no second heading weight.

            Numbers are --ketchup-deep, which is what .pull b already uses on
            this page, so pink already means "a count of a kind of card" here.
            The light pink measures 3.45:1 at this size and is not used. */ ""}
      <div class="luck-chase">
        <p class="luck-chase-h">Chase cards pulled <i>Counts of cards, rarest tier first</i></p>
        <div class="luck-chips">
${tierChips.map((t) => `          <div class="luck-chip"><b>${t.n}</b><span>${t.tier}</span></div>`).join("\n")}
        </div>
      </div>

      ${/* THE COVERAGE BAND IS GONE. It read "321 of 321 rips have an answer,
            100% of the catalog" over a bar filled to 100%, so it measured
            nothing and the bar read as a rendering bug. It also carried "462
            packs across 321 rips that say", which is the rip log talking about
            its own columns. Tim: "remove any text that is referencing the execl
            document, like has answers, no one needs to know or see any of that".

            .luck-caveat went with it. That branch only ever rendered at a 100%
            hit rate, which has not been true since February. */ ""}
    </div>
  </section>

  <section class="band luck-sec">
    <div class="wrap">
      <h2>What we have <span class="hl">opened</span></h2>
      <div class="luck-intro">
      <p class="luck-note">Ordered by hits, which is the question asked. <b>That order is a count, not a
        verdict:</b> the kind with the most hits is usually the kind we opened most of, so every card
        carries the rate and the rips it is over, at the same size, right underneath.${
          bestRateRow && mostHits && bestRateRow.key !== mostHits.key
            ? ` Most hits is ${esc(mostHits.label.toLowerCase())}. The best RATE over ${MIN_SAMPLE} or more answered rips is
        ${esc(bestRateRow.label.toLowerCase())} at ${bestRateRow.rate}%.`
            : ""
        }</p>
      <p class="luck-note">${/* THREE COUNTS THAT ARE THREE DIFFERENT THINGS, said in prose as well as
            in the labels, because "how many ETBs have we opened" is the question
            a reader arrives with and the answer is not the number of ETB videos.
            See the boxFloor note in this builder for the whole argument. */ ""}<b>Rips are videos, packs are packs, and
        boxes are neither.</b> An elite trainer box holds ${PACK_CAPACITY.etb || 9} packs and this channel films them one at
        a time, so ${(prodRows.find((r) => r.key === "etb") || { vids: 0 }).vids} elite trainer box rips are nothing like
        ${(prodRows.find((r) => r.key === "etb") || { vids: 0 }).vids} boxes. Packs is packs ripped on camera. Boxes is a
        floor: if pack 1 turns up in three videos of the same product and set then three boxes were opened.${
          boxCensus.capBoxes
            ? ` Across the kinds whose pack count is published, those boxes hold ${boxCensus.capPacks} packs between them and
        the rips of them count ${boxCensus.capFilmed}. <b>Those are two different quantities and neither is the other:</b>
        ${
          /* AND ZERO IS THE THIRD CASE, WHICH IS THE ONE THAT SHIPPED. The note
             that used to sit here worked out that 1 needs its own clause and
             stopped counting there, so at zero the page read "packs opened in
             one of the 0 rips that state no count": ungrammatical, and naming a
             cause with no instances behind it. Every one of the 321 rips states
             a pack count today, so the whole second half of the sentence is
             false and does not render. */ ""
        }${
          boxCensus.capRips - boxCensus.capPackRips === 0
            ? `that difference is packs not opened on camera yet.`
            : `some of the difference is packs not opened on camera yet, and some is packs opened in ${
                boxCensus.capRips - boxCensus.capPackRips === 1
                  ? `the one rip that states no count`
                  : `one of the ${boxCensus.capRips - boxCensus.capPackRips} rips that state no count`
              }.`
        }`
            : ""
        }</p>
      </div>
      <div class="pgrid">
${prodRows.map((r, i) => prodCard(r, i)).join("\n")}
      </div>
    </div>
  </section>

  ${
    bestRawCard || bestPsaCard || richestRow
      ? `<section class="luck-sec luck-rail">
    <div class="wrap">
      <h2>The best cards, <span class="hl">three ways</span></h2>
      <p class="luck-note">${/* THE LEDE IS COMPUTED, because whether the three readings agree is a
            FACT ABOUT TODAY'S DATA and not a thing to assert. Two of them landed
            on the same card the first day this band existed, and a hardcoded
            "they do not agree" would have been the page arguing with itself in
            the same screenful. */ ""}"Best" is not one thing. ${
        bestRawCard && bestPsaCard && bestRawCard.name === bestPsaCard.name && bestRawCard.number === bestPsaCard.number
          ? `The first two land on the same card at the moment, which is not the usual case and will not stay true: they are
        two different measurements and the ungraded top and the graded top come apart as soon as a cheaper card with a
        strong graded price turns up.`
          : `These readings do not agree with each other, which is the interesting part rather than a problem to tidy away.`
      }${priceDoc ? ` ${priceNote(priceDoc, { lead: "Ungraded figures" })}` : ""}</p>
      <div class="bests">
${
  bestRawCard
    ? `        <div class="bestc">
          <span>Best card, ungraded</span>
          <b>${esc(moneyCompact(bestRawCard.raw))}</b>
          <a href="/${esc(bestRawCard.v.path)}">${esc(bestRawCard.name)}${bestRawCard.setName ? `, ${esc(bestRawCard.setName)}` : ""}</a>
          <p>The highest guide value among the ${rawCards.length} of ${cardRows} cards in the rip log that carry one.${
            bestRawCard.v.products?.length
              ? ` It came out of ${esc(String(labelFor("products", bestRawCard.v.products[0]) || "a sealed product").toLowerCase())}`
              : ""
          }${packsToBest ? `, at least ${packsToBest} packs into the channel` : ""}.</p>
        </div>`
    : ""
}
${
  bestPsaCard
    ? `        <div class="bestc">
          <span>Best card, PSA 10</span>
          <b>${esc(moneyCompact(bestPsaCard.psa))}</b>
          <a href="/${esc(bestPsaCard.v.path)}">${esc(bestPsaCard.name)}${bestPsaCard.setName ? `, ${esc(bestPsaCard.setName)}` : ""}</a>
          <p>${/* THE SUBSET IS NAMED IN THE SENTENCE AND NOT IN A FOOTNOTE. A graded
                figure exists for a small minority of these cards, so a ranking over
                it is a ranking of that minority and reads as a ranking of the lot
                unless it says otherwise. */ ""}A different question from the one beside it, and it rests on a much
          smaller set: ${psaCards.length} of the ${cardRows} cards in the rip log have a graded figure at all. Nothing here
          has been graded. This is what the guide says a 10 sells for.</p>
        </div>`
    : ""
}
${
  richestRow
    ? `        <div class="bestc">
          <span>Best return a rip</span>
          <b>at least ${esc(moneyCompact(richestRow.guidePerRip))}</b>
          <a href="/videos.html?product=${esc(richestRow.key)}">${esc(richestRow.label)}</a>
          <p>Guide value of every priced card out of it, over its ${richestRow.judged} answered rips. <b>At least</b> is
          load bearing: a card with no guide value counts as nothing in that sum, so the figure is a floor and can only
          climb. Only kinds with ${MIN_SAMPLE} or more answered rips are eligible.</p>
        </div>`
    : ""
}
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    packNoRows.length
      ? `<section class="band luck-sec luck-rail">
    <div class="wrap">
      <h2>Does it matter which <span class="hl">pack</span></h2>
      <p class="luck-note">The oldest superstition in the hobby, and this log can test it, because the rip
        sheet records which pack out of the box each video opened.${
          packNoBest
            ? ` The best position with a real sample behind it is pack ${packNoBest.n} at ${packNoBest.rate}% over
        ${packNoBest.rips} answered rips, against ${headline} across every answered rip.`
            : ""
        }</p>
${packFigure()}
    </div>
  </section>`
      : ""
  }

  <section class="luck-sec luck-rail">
    <div class="wrap">
      <h2>Which sets have been <span class="hl">kind</span></h2>
      <p class="luck-note">Hit rate is the share of answered rips from that set that produced something
        worth keeping. Sets with fewer than ${MIN_SAMPLE} answered rips do not get a number: at that
        size it would be noise dressed up as a fact. <b>Rips is every rip of that set</b>, and where some of
        them have no answer yet the cell says how many do, because the rate is only over those. Packs is
        packs ripped on camera, from the rip log's own set by set breakdown, so a rip that opened two sets
        charges each of them its own packs rather than both of them all of them.</p>
${table(bySet, "Set", "/videos.html?set=")}
    </div>
  </section>

  ${
    dudRips
      ? `<section class="band luck-sec luck-rail">
    <div class="wrap">
      <h2>Most rips produce <span class="hl">nothing</span></h2>
      <p class="luck-note">${dudRips} of the ${judged.length} answered rips produced nothing worth keeping, which is
        ${pct(dudRips, judged.length)}% of them. That is the channel, not a bad patch: it is why it is called Garbage
        Rips. The drawing is every run of the same result in a row, so you can see how long the bad ones actually go.</p>
${runFigure()}
      ${/* THE ONE PLACE ON THIS PAGE TRUBBISH IS EARNED. The grammar is argued
            in build-search.mjs: Trubbish means "there is nothing in this one"
            and Garbodor means "we went through the whole heap". A band about
            the rips that produced nothing is Trubbish's sentence exactly, and
            he appears once, here, and nowhere else on the page. */ ""}
      <p class="trub"><b>Trubbish</b>${dryRuns.length} separate dry spells, ${dryRuns.length ? `the longest ${Math.max(...dryRuns)} rips` : ""}, and the
        commonest one is a single rip. Nothing in it, on to the next one.</p>
    </div>
  </section>`
      : ""
  }

  ${
    rarities.length || pulls.length
      ? `<section class="luck-sec">
    <div class="wrap">
      <h2>What has actually <span class="hl">come out</span></h2>
      <p class="luck-note">${
        useRarities
          ? `Counted from the rarity column of the rip log, which is filled in for a different set of rips
      than the hit or no hit column, so this is a separate tally from the hit rates above and the two will
      not line up.`
          : `Counted from the Hit Card cell of the rip log, which is where the cards that came out are
      written down by hand, so this is a separate tally from the hit rates above and the two will not
      line up.${
        // THE UNIT IS THE RIP AND THE PAGE SAYS SO NOW. See the note beside
        // tagCount above for why the deduplication is deliberate and why the
        // two totals are printed rather than asserted.
        hitRows
          ? ` A rip counts once per rarity however many cards of that rarity came out of it, so these are
      counts of rips rather than of cards: ${tagCount} tag${tagCount === 1 ? "" : "s"} across ${tagRips} rip${tagRips === 1 ? "" : "s"} against
      the ${hitRows} cards the log records${
              /* THIS CLAUSE SAID "the biggest single rip is N cards" AND IT WAS
                 NAMING A DIFFERENT RIP. `widestGap` is the widest GAP between
                 cards and tags, picked by `list.length - tags`, which is not the
                 same rip as the one with the most cards in it and only looks
                 like it while the two happen to coincide. The day a 16 card rip
                 carries 16 tags, gap 0, this sentence would still print the 14
                 card rip's number while /hall.html and that rip's own page
                 showed 16 -- which is the exact contradiction this page has
                 already published once. It now says what it measures. */
              widestGap ? `, and the widest gap on one rip is ${widestGap.cards} cards under ${widestGap.tags} tag${widestGap.tags === 1 ? "" : "s"}` : ""
            }. That is on purpose: this band is about how often a rip produces each kind of card, and counting
      one opening five times would let a single lucky box outweigh a month of them. The cards themselves are listed one
      by one on the <a href="/hall.html">best pulls page</a>.`
          : ""
      }`
      } They are totals, not rates: a set
      that gets opened more will show more of everything. A fuller log makes these counts more complete, not more predictive: they say what
      came out of the packs we opened, never what will come out of yours.</p>
      <div class="pull-grid">
${tally
  .map(([k, n]) => `        <div class="pull"><b>${n}</b><span>${esc(k)}</span></div>`)
  .join("\n")}
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    worst.len || bestRun.len
      ? `<section class="band luck-sec">
    <div class="wrap">
      <h2>Cold streaks and <span class="hl">hot ones</span></h2>
      <p class="luck-note">The longest of each, and the rips they are made of.</p>
      <div class="streaks">
        <div class="streak cold">
          <span class="k">Longest drought</span>
          <b>${worst.len} rip${worst.len === 1 ? "" : "s"}</b>
          <p>${
            worst.len === 0
              ? "None yet. Every rip marked up in the log so far has produced something worth keeping, which says as much about how much of the log is filled in as it does about the luck."
              : worst.from
                ? `${shortDate(worst.from.published)} to ${shortDate(worst.to.published)}, nothing worth keeping.`
                : ""
          }</p>
          ${/* THE STREAK'S OWN VIDEOS. See `droughtBreaker` above for why these
                four links and no others. Both ends of the run, then the rip
                that broke it, in the order somebody would watch them.
                `worst.from === worst.to` on a one-rip drought, so the second
                row is dropped rather than printing the same video twice under
                two different labels. */ ""}
          ${worst.from ? `<ul class="streak-rips">
            <li><a href="/${esc(worst.from.path)}"><span>Where it started</span>${esc(worst.from.siteTitle || worst.from.title)}</a></li>
            ${worst.to && worst.to !== worst.from ? `<li><a href="/${esc(worst.to.path)}"><span>Where it ended</span>${esc(worst.to.siteTitle || worst.to.title)}</a></li>` : ""}
            ${droughtBreaker
              ? `<li><a href="/${esc(droughtBreaker.path)}"><span>The rip that broke it</span>${esc(droughtBreaker.siteTitle || droughtBreaker.title)}</a></li>`
              : `<li class="streak-open">Still open: nothing logged after it yet.</li>`}
          </ul>` : ""}
        </div>
        <div class="streak hot">
          <span class="k">Best run</span>
          <b>${bestRun.len} rip${bestRun.len === 1 ? "" : "s"}</b>
          <p>${bestRun.from ? `${shortDate(bestRun.from.published)} to ${shortDate(bestRun.to.published)}, a hit every time.` : ""}</p>
          ${bestRun.from ? `<ul class="streak-rips">
            <li><a href="/${esc(bestRun.from.path)}"><span>Where it started</span>${esc(bestRun.from.siteTitle || bestRun.from.title)}</a></li>
            ${bestRun.to && bestRun.to !== bestRun.from ? `<li><a href="/${esc(bestRun.to.path)}"><span>Where it ended</span>${esc(bestRun.to.siteTitle || bestRun.to.title)}</a></li>` : ""}
          </ul>` : ""}
        </div>
      </div>
    </div>
  </section>`
      : ""
  }

  ${
    monthRows.length > 1
      ? `<section class="luck-sec luck-rail">
    <div class="wrap">
      <h2>Month by <span class="hl">month</span></h2>
      <p class="luck-note">Every rip by the month it went up, split into what came out of it. The hatched part
        of a column is the part of that month nobody has answered yet, so this is the coverage picture as well
        as the run rate: it fills in from the bottom as the log is worked through.</p>
${monthFigure()}
    </div>
  </section>`
      : ""
  }

  ${/* THE "Where every number on this page comes from" SECTION IS GONE, all
      423 words and 1,575px of it at 390. Nine rows naming the SPREADSHEET
      COLUMN each figure was counted out of: "Has Hit, My Hits tab", "Sets &
      Packs", "Pack #, Opening Type", "Published". Tim: "remove any text thats
      place holder or explains how we got the data, the data, as the data is
      pulled directly from the actual real rips in every video."

      IT EXISTED TO BE AUDITED RATHER THAN READ, and what it was actually
      protecting survives without it: every table on this page still carries its
      own denominator in its own sub-line, and the widget's tiles now carry
      theirs in their labels. No figure loses what it is counted over. The
      NARRATION about what it is counted over is what goes.

      The price provenance note at the foot is NOT part of this and stays: that
      is sourcing for money figures, not an explanation of the rip log. */ ""}
</main>`;

// NO Dataset MARKUP UNTIL THERE IS A DATASET. With nothing logged this
// declared a dataset of "0 logged pack openings" to search engines, which is
// structured data asserting something the page does not have. The page itself
// was already honest, showing a dash and "0 of 311 rips logged"; the markup was
// not. Same reason the page is dropped from the sitemap below.
const ld =
  judged.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: "Observed Pokemon card hit rates from Garbage Rips 585",
        description: `Hit rates observed across ${allPacks} packs opened on camera in ${judged.length} filmed rips, by set and by product type.`,
        url: `${SITE}/luck.html`,
        creator: { "@type": "Organization", name: "Garbage Rips 585", url: `${SITE}/` },
        isAccessibleForFree: true,
      }
    : null;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pokemon Pack Luck, Measured: What Actually Came Out of ${judged.length} Rips</title>
<meta name="description" content="${clipMeta(
  judged.length
    ? `Observed hit rates from ${allPacks} Pokemon packs opened on camera across ${judged.length} rips, broken down by set and product. Not official pull rates: what actually came out on camera.`
    : `What actually came out of ${videos.length} pack openings on camera, counted from our own rip log rather than estimated.`
)}">
${judged.length ? "" : '<meta name="robots" content="noindex,follow">\n'}<link rel="canonical" href="${SITE}/luck.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon Pack Luck, Measured">
<meta property="og:description" content="Hit rates observed across ${allPacks} real packs opened on camera, by set and by product.">
<meta property="og:url" content="${SITE}/luck.html">
<meta property="og:image" content="${SITE}/assets/og-luck.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-luck.jpg">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
${ld ? `<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>` : "<!-- No Dataset markup: there are no judged rips yet, so there is nothing to describe. -->"}
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${/* THE SEVEN PRODUCT PHOTOGRAPHS ON THIS PAGE WERE CREDITED NOWHERE. They are
      hotlinked from tcgplayer-cdn and the page named TCGplayer in no sentence,
      no caption and no alt text, so on a sweep of all 1,484 built pages this was
      one of only two in the guides showing licensed product imagery with no
      source on the page at all. Every sibling that uses the same photographs
      says so: /upcoming.html ("photos from TCGplayer"), /how-many-packs.html and
      /most-expensive-sealed.html all carry it.

      It goes in the FOOTER rather than beside the pictures because the row
      caption is already doing a different and more important job: "Pitch Black
      shown" says the photograph is ONE set's version of a product kind that
      spans several, which is the thing a reader could otherwise misread as the
      product that was actually opened. Do not merge the two lines. */ ""}
${footer("Sealed product photographs are TCGplayer's. Each one is the set named beneath it, standing for that kind of product.")}

${APP_JS}
</body>
</html>
`;

await writeFile(OUT, html);

console.log(`Wrote public/luck.html
  ${judged.length} of ${videos.length} rips have a known outcome (${Math.round(coverage * 100)}%), ${impliedHits} of them from a named hit card rather than the Has Hit column
  ${hits.length} hits, ${headline} overall, ${dudRips} produced nothing
  ${bySet.filter((r) => r.rips >= MIN_SAMPLE).length} of ${bySet.length} sets have a big enough sample to show a rate
  ${packsKnown} logged rips have a pack count, ${totalPacks} packs; ${allPackRips} of ${videos.length} overall, ${allPacks} packs`);
// A rip whose Has Hit says NO while the My Hits tab names a card out of it is
// two answers that cannot both be true. It is a sheet fix, not a builder fix,
// so the run names the rows rather than picking a winner.
if (contradictions.length) {
  console.log(`  CONTRADICTION: ${contradictions.length} rip(s) say Has Hit = no and still name a hit card: ${contradictions.join(", ")}`);
  console.log("    Fix it in the workbook. This page counts them as no hit, which is what the column says.");
}
// EVERY CENSUS THIS BUILDER TAKES IS PRINTED, because the numbers in the
// comments above WILL go stale and the run is the copy that cannot. If one of
// these lines starts saying something different, the page already is.
console.log(`  boxes: at least ${boxCensus.boxes} from repeated pack positions across ${prodRows.filter((r) => r.boxes).length} product kinds`);
console.log(`    Box # is not a serial: ${boxCensus.collisions} (type, set, box, pack) coordinates carry ${boxCensus.collisionRips} extra rip(s)`);
console.log(`    capacity published for ${Object.keys(PACK_CAPACITY).length} product kinds; ${boxCensus.noCapacityTags.length} tag(s) in use have none: ${boxCensus.noCapacityTags.join(", ") || "none"}`);
console.log(`    those boxes hold ${boxCensus.capPacks} packs, the rips of them count ${boxCensus.capFilmed}, a gap of ${boxCensus.capPacks - boxCensus.capFilmed}`);
console.log(`      of which ${boxCensus.capRips - boxCensus.capPackRips} rip(s) of those kinds state no pack count at all, out of ${boxCensus.capRips}`);
console.log(`  cards: ${cardRows} rows read, ${rawCards.length} with a guide value, ${psaCards.length} with a PSA 10`);
for (const [k, n] of Object.entries(cardDrops)) if (n) console.log(`    ${n} row(s) unpriced: ${k}`);
if (cardsOutsideJudged) console.log(`    ${cardsOutsideJudged} card row(s) sit on rips with no Has Hit answer and are outside every value figure`);
if (mostHits) console.log(`  most hits: ${mostHits.label} ${mostHits.hits} of ${mostHits.judged} logged (${mostHits.rate}%)`);
if (bestRateRow) console.log(`  best rate at ${MIN_SAMPLE}+: ${bestRateRow.label} ${bestRateRow.rate}% over ${bestRateRow.judged}`);
if (richestRow) console.log(`  best guide value a rip: ${richestRow.label} at least ${moneyCompact(richestRow.guidePerRip)} over ${richestRow.judged}`);
// A SELF CHECK, NOT A LOG LINE. `worst`/`bestRun` and `runsOf` walk the same
// list for the same thing, and two functions that disagree about it is exactly
// the kind of fault that ships silently on a page nobody recomputes by hand.
if (dryRuns.length && Math.max(...dryRuns) !== worst.len) {
  console.log(`  MISMATCH: longest dry run is ${Math.max(...dryRuns)} by runsOf and ${worst.len} by the streak walk`);
}
if (hotRuns.length && Math.max(...hotRuns) !== bestRun.len) {
  console.log(`  MISMATCH: longest hot run is ${Math.max(...hotRuns)} by runsOf and ${bestRun.len} by the streak walk`);
}
if (dryRuns.reduce((n, x) => n + x, 0) !== dudRips) {
  console.log(`  MISMATCH: dry runs sum to ${dryRuns.reduce((n, x) => n + x, 0)} against ${dudRips} rips with no hit`);
}
if (!judged.length) {
  console.log(`
  Nothing is marked "Has Hit" in the rip log yet, so every rate is empty.
  Fill that column in the spreadsheet, run import-sheet.mjs, and this fills in.`);
}
