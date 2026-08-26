#!/usr/bin/env node
// Generate /start.html, the front door for anyone new.
//
//   node scripts/build-start.mjs
//
// Every guide on this site already existed and none of them had an entrance.
// Somebody who has just been handed a shoebox of cards does not know they want
// "the rarity guide"; they want to know what they are holding. This page is the
// question-shaped way in, and it is the natural thing to link from a video
// description.
//
// It deliberately contains almost no facts of its own. Facts live on the page
// that owns them, so there is one place to fix each of them. What this page
// owns is the ORDER: is it real, what is it, what is it worth, should I grade
// it, where do I buy more. That order is the actual answer to "where do I
// start", and it is the one thing no other page can say.

import { readFile, writeFile } from "node:fs/promises";
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
import { esc, clipMeta} from "../shared/format.mjs";
import { RARITY_CSS, rarityChip } from "../shared/rarity.mjs";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Live counts, so the page never claims a number the site has outgrown.
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

/* ------------------------------------------------- what the cheap ones look like
 *
 * THIS PAGE ENDED WITH "or just watch someone else do it" AND TWO BUTTONS TO
 * INDEX PAGES. A beginner who has just read six answers about a card they are
 * holding was offered a library and a hall of fame, and no video.
 *
 * THE THREE ARE THE THREE CHEAPEST WAYS IN, in the order somebody meets them:
 * a single pack, a booster bundle, an Elite Trainer Box. That is the choice
 * this page's readers are actually making, and one rip of each is a straight
 * answer to "what do you get for that money" that no amount of prose is. The
 * axis is PRICE, not spectacle: three slots off the biggest-pull ranking would
 * be a start-here page arguing that packs are full of money, which is the exact
 * thing the five facts further down exist to correct. One of the three happens
 * to be a big pull today, because it is the newest of its kind; that is the
 * rule doing its job rather than an exception to it, and every row is labelled
 * by the BOX it came out of, which is what a reader is being asked to compare.
 *
 * NEWEST OF EACH KIND, so the rows track the channel without anybody choosing.
 * A kind with no rip renders nothing rather than being replaced by another
 * kind's video, because the label is a promise about what is in the video.
 */
const START_KINDS = [
  ["single-pack", "A single pack"],
  ["bundle", "A booster bundle"],
  ["etb", "An Elite Trainer Box"],
];
const startRips = START_KINDS.map(([kind, label]) => {
  const v = videos
    .filter((x) => x.path && (x.products || []).includes(kind))
    .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))[0];
  return v ? { label, v } : null;
}).filter(Boolean);
const cardIndex = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
let shows = 0;
try {
  const s = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8"));
  const today = localDay();
  shows = (s.shows || []).filter((x) => x.date >= today).length;
} catch {
  /* optional */
}
const nCards = (cardIndex.cards || []).length.toLocaleString("en-US");
// PRICED, not held. This page said "4,481 of them carry a current market
// price, which is every card in the 23 sets we cover", in visible prose and in
// its FAQPage schema. 4,481 is how many cards we hold; 4,468 carry a price and
// 13 do not, which cards.html states correctly. Two pages contradicting each
// other, in a commit whose whole point was making them quote the same corpus.
const nPriced = (cardIndex.cards || []).filter((c) => typeof c[4] === "number").length;
// THE SAME NUMBER cards.html publishes, from the same manifest, because the
// two pages describe the same search box. This page said "Search 4,481 cards",
// which is the priced subset from the 23 sets we cover, while the page it links
// to says it searches every printing we could source. Counting the shards here
// instead would have produced a third figure again: the raw shard count is
// 39,715 against the manifest's 39,707.
// Counted, not typed. This said "plus 13 imported ones" as a literal, which is
// right today and silently wrong the first time a foreign set gets a guide.
let nIntl = 0;
try {
  nIntl = Object.keys(
    JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {},
  ).length;
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}
let nPrintings = null;
try {
  const man = JSON.parse(await readFile(join(ROOT, "public/data/printings/manifest.json"), "utf8"));
  nPrintings = { total: man.total.toLocaleString("en-US"), sets: man.sets.toLocaleString("en-US") };
} catch {
  /* run: node scripts/sync-all-printings.mjs. Falls back to the priced count. */
}

// ---------------------------------------------------------------------------
// THE ONE PICTURE ON THIS PAGE, and it belongs to step 2.
//
// This page had 623 words and nothing visual but a decorative flower, on a site
// whose own build prints an image-density table. It is also the page least
// suited to a photograph: it owns no facts, it is six questions pointing at the
// pages that do own them, and a card scan here would be illustrating somebody
// else's argument.
//
// Step 2 is the exception because step 2 asks a question with a literal answer
// in pictures: "what the little marks in the corner mean". The marks are the
// answer. So the ladder is DRAWN, out of shared/rarity.mjs, which is the same
// source /rarity.html and all 42 set guides draw from, so this cannot disagree
// with them. Inline SVG, so it costs no request and no bytes worth measuring.
//
// SIX RUNGS, NOT NINE. The key holds Charizard (a category on this channel, not
// a rarity), ACE SPEC (a pink mark that only some sets print) and Mega Hyper
// Rare (one era). A first look at rarity does not need the exceptions, it needs
// the spine, and /rarity.html is one tap away and holds all nine.
//
// THE ORDER IS UP, deliberately. RARITY_KEY is ordered rarest first because
// that is what a hit list wants; somebody who has just been handed a shoebox
// reads a ladder from the bottom.
const LADDER = ["rare", "double-rare", "ultra", "ir", "sir", "gold"];

const STEPS = [
  {
    n: 1,
    q: "Is it even real?",
    a: "Do this before anything else, because every other question depends on the answer. Eight physical checks, how much each one actually proves, and the two that are worth doing first.",
    href: "/fake-cards.html",
    cta: "Real or fake?",
  },
  {
    n: 2,
    q: "What am I actually looking at?",
    a: `Rarity symbols, what the little marks in the corner mean, and why two cards of the same Pokemon can be worth a dollar and a thousand dollars. Then the set itself: ${sets.length} English guides with full checklists${nIntl ? `, plus ${nIntl} imported ones` : ""}.`,
    href: "/rarity.html",
    cta: "Rarity guide",
    // THE THIRD ONE IS FOR THE CARD THAT IS NOT A TCG CARD AT ALL. This rung is
    // where somebody holding something they cannot identify is standing, and the
    // two links beside it both assume the answer is a Pokemon TCG set. A Topps
    // card from 1999 to 2004 is not in any of them, and its owner will read the
    // rarity guide, fail to find a symbol in the corner, check the set guides,
    // fail again, and conclude the card is fake. It is not: it is a real card of
    // a different kind, and that page says so in its first paragraph.
    also: [
      ["/sets/", "Set guides"],
      ["/expansions.html", "Every set ever made"],
      ["/topps.html", "Topps cards"],
    ],
    // Rendered between the answer and the buttons, and NOT included in the
    // FAQPage schema below, which quotes `a` only: a rung of drawn stars is not
    // a sentence and pasting markup into structured data is how a search result
    // ends up reading "<svg viewBox=".
    figure: `<figure class="st-fig">
            <div class="st-ladder">${LADDER.map((id) => rarityChip(id)).join("")}</div>
            <figcaption>The marks in the bottom corner, drawn, commonest first. Same six
              you will find on a Scarlet and Violet era card, and the same drawings the
              <a href="/rarity.html">rarity guide</a> uses. It holds four more.</figcaption>${/* WAS "three more", counted against shared/rarity.mjs RARITY_KEY rather than
     against /rarity.html, which is what the sentence points at. The key holds
     a "charizard" entry that is a category on this channel and not a rarity,
     and the count overlooked Radiant. /rarity.html's ladder is 10 rungs; six
     are drawn here; four are not. */ ""}
          </figure>`,
  },
  {
    n: 3,
    q: "What is it worth?",
    a: `Search ${nPrintings ? `${nPrintings.total} printings across ${nPrintings.sets} sets` : `${nCards} cards`} by name. ${nPrintings ? `${nPriced.toLocaleString("en-US")} of them carry a current market price, which is nearly every card in the ${sets.length} sets we cover. ` : ""}Or browse by Pokemon if you are chasing one in particular.`,
    href: "/cards.html",
    cta: "Card search",
    also: [["/pokemon/", "Browse by Pokemon"]],
  },
  {
    n: 4,
    q: "Should I get it graded?",
    a: "Usually no, and the math says why. What the five companies charge, what the wait is, and the subtraction on real cards: raw price, graded price, fee, what is left.",
    href: "/grading.html",
    cta: "Worth grading?",
  },
  {
    n: 5,
    q: "What should I open?",
    a: "Nobody publishes real pull rates, so the honest answer is what actually came out of the packs we have opened, counted from our own rip log. Plus what is coming next and what it is going for on preorder.",
    href: "/luck.html",
    // NOT "Luck and pull rates". The sentence right above it says nobody
    // publishes pull rates, and /luck.html says the same thing twice more.
    // A button promising pull rates is the one thing this site will not do.
    cta: "Luck, measured",
    also: [["/upcoming.html", "Coming next"]],
  },
  {
    n: 6,
    q: "Where do I buy, and who do I buy from?",
    a: `Local shops around Rochester with what each is good for and where you can sit down and play${shows ? `, plus ${shows} card shows coming up around Rochester, Buffalo and Syracuse` : ""}. Online, the answer is a different one: what each venue costs once shipping and buyer fees are counted, and what recourse you have when a card arrives wrong.`,
    href: "/shops.html",
    cta: "Shops and where to play",
    // THIS QUESTION ANSWERED ONLY LOCALLY UNTIL NOW, on a site whose selling,
    // grading and drops pages all assume an online answer exists. Somebody
    // reading in order got six questions deep and was told to drive somewhere.
    also: [["/buying.html", "Where to buy online"], ["/card-shows.html", "Card show calendar"]],
  },
];

// A SEVENTH QUESTION THAT IS NOT ONE OF THE OWNER'S SIX, and it sits outside the
// numbered list for exactly the reason the paragraph below the list already
// gives: renumbering it to seven would change what this page claims about
// itself. Every step above is about a card somebody is ALREADY HOLDING. This
// one is about the wallet in the other hand, and it is the question the owner
// actually gets asked out loud, by parents, in shops.
//
// It goes ABOVE the how-do-I-play paragraph rather than below it because a
// reader who arrived at this page from a search for what to buy their kid is
// being sent one tap further away every sentence they have to read first.
const BUY = `<p class="lede" style="max-width:44em;margin-top:var(--s5)">One question that is not on that
      list, because it comes before you own a card at all:
      <a href="/what-to-buy.html">what should you actually buy?</a> What to get for a kid who has never
      opened a pack, what each box on the shelf actually is, what it should cost, and the three things
      not to buy first.</p>`;

const desc =
  `New to Pokemon cards? Is it real, what is it, what is it worth, should you grade it, where to buy. ` +
  `Six questions in the order they actually come up.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Start here" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: STEPS.map((s) => ({
      "@type": "Question",
      name: s.q,
      acceptedAnswer: { "@type": "Answer", text: s.a },
    })),
  },
];

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Start Here: A Beginner's Guide to Pokemon Cards</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/start.html">
<meta property="og:title" content="New to Pokemon cards? Start here">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/start.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-start.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-start.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
${/* Inline rather than in ui.css: this is the only page outside the rarity
      guide and the set guides that draws these, and ui.css is render blocking
      on all 426 pages. RARITY_CSS travels with the key it draws. */ ""}
<style>${RARITY_CSS}
.st-fig{margin:var(--s4) 0 0}
.st-ladder{display:flex;flex-wrap:wrap;gap:var(--s2)}
.st-fig figcaption{margin-top:var(--s3);font:400 var(--t-micro)/1.55 var(--body);
  color:var(--ink-2);max-width:40em}

/* DESKTOP READING MEASURE. 40em was written as if 1em were one character. It
   is not: Outfit at 11px runs about 2.31 characters per em, so that 440px box
   measured 91 real characters a line at 1440. ui.css already caps every
   figcaption in main at var(--measure) and this rule only outranked it by
   landing after the stylesheet. min-width:1000 is ui.css's own desktop
   breakpoint, so the phone and the tablet range keep exactly the rule they
   had. Only the caption is capped: .st-ladder above it is a flex row of
   rarity chips and its width is layout, not prose. */
@media(min-width:1000px){
.st-fig figcaption{max-width:var(--measure)}
}

/* THE LADDER SET THE WIDTH OF EVERY CARD ON THIS PAGE AT 320, and only at 320.
   ui.css gives .st grid-template-columns:auto 1fr, and a 1fr track carries an
   implicit min-width:auto, so it can never be narrower than its own
   min-content. Here that is the widest rarity chip, "Special Illustration
   Rare", one nowrap chip 205.1px wide against the 190px the column gets at 320.
   Measured on the real page: all four step cards rendered 311.1px wide inside a
   296px list, 3.1px past the right edge of the viewport, so every card showed
   its left border and rounded corner and had its right one cut off. It is
   invisible from the markup and from 360px up, which is why it survived.

   THE CHIP IS STILL 205.1px AND THAT IS THE DELIBERATE HALF. A companion rule
   letting it wrap was written, measured and removed: .chip is flex:none with a
   fixed height:44px, so white-space:normal on it is inert, and the rules that
   would make it work (flex:0 1 auto, height:auto, its own vertical padding)
   restyle a shared control on one page to save 15px. What minmax(0,1fr) buys
   is that the overflow now lands in the card's own 24px of right padding
   instead of past the edge of the screen: the chip ends at 298.1 with the
   card's border at 308, so nothing is clipped and nothing scrolls sideways.
   Screenshotted at 320 unzoomed, the ladder reads correctly.

   Bounded at 359 so nothing a normally sized phone renders can move. Card
   widths re-measured after at 320, 360, 390, 414, 768 and 1440: 296 / 336 /
   366 / 390 / 720 / 1392, and only the 320 figure moved (from 311.1). */
@media(max-width:359px){
.st{grid-template-columns:auto minmax(0,1fr)}
}

/* THE THREE ENTRY-PRICE RIPS. See startRips above for which three and why.
   TEAL for the title because teal is how you get around, and --sky-deep rather
   than --sky because the type is small: 4.50:1 on --card #2F4F39 where --sky
   is 4.05:1 and fails. The kind above it is --ink-2 at 5.73:1, a caption and
   not a route, so the two accents never land on each other.
   NOT .riplist, which ui.css gives white-space:nowrap on its caption: that is
   right for "18 Aug 2026 &bull; 3 packs" on a set guide and wrong for a whole
   video title, which measured 505px wide and hung 204px off a 390px viewport
   the one time it was tried on /openings/index.html. */
.st-rips{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s2);
  max-width:44em}
.st-rips li{background:var(--card);border:1px solid var(--hair);
  border-radius:var(--r-sm);padding:10px 12px}
.st-rips a{display:block;min-height:44px;font:600 var(--t-sm)/1.35 var(--body);
  color:var(--sky-deep)}
.st-rips a:hover,.st-rips a:focus-visible{text-decoration:underline}
.st-rips a span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; No gatekeeping</span>
    <h1>Start <span class="hl">here</span></h1>
    <p class="lede" style="max-width:36em">Found a box in the attic, got back into it, or just pulled something and
      have no idea what it is. Six questions in the order they actually come up. Nobody is going to make you feel
      stupid for asking any of them.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Start here</nav>
    <ol class="st-list">
      ${STEPS.map(
        (s) => `<li class="st">
        <span class="st-n" aria-hidden="true">${s.n}</span>
        <div class="st-body">
          <h2>${esc(s.q)}</h2>
          <p>${esc(s.a)}</p>
          ${s.figure || ""}
          <p class="st-links">
            <a class="btn btn-sky btn-sm" href="${esc(s.href)}">${esc(s.cta)}</a>
            ${(s.also || []).map(([h, l]) => `<a class="st-also" href="${esc(h)}">${esc(l)}</a>`).join("\n            ")}
          </p>
        </div>
      </li>`
      ).join("\n      ")}
    </ol>
    ${/* A SEVENTH QUESTION THIS PAGE DID NOT ANSWER. Every step above is about a
          card you are holding: is it real, what is it, what is it worth. None of
          them is about the game the cards are for, and "how do you actually play
          this" is the question somebody who has only ever opened packs asks
          first. It sits outside the numbered list on purpose, because the list
          is the owner's six in his order and renumbering it to seven would change what
          the page claims about itself. */ ""}
    ${/* THE TWO APPS GET ONE SENTENCE BETWEEN THEM, not one each. This paragraph
          is already the overflow for everything the six numbered questions do not
          cover, and giving Live and Pocket a sentence apiece would turn it into a
          second list competing with the real one. Named as a pair, in the order
          somebody meets them, with a link to each page and no argument about
          which to install: that argument is on both of those pages and it is a
          table. */ ""}
    ${BUY}
    <p class="lede" style="max-width:44em;margin-top:var(--s5)">And one that is not about a card at all:
      <a href="/how-to-play.html">how do you actually play?</a> Two players, 60 cards
      each, and three ways to win. The short version, for somebody who has never seen a game. There are also two
      free official apps, and they are not the same thing:
      <a href="/tcg-live.html">Pokemon TCG Live</a>, which is where the code card in every pack goes, and
      <a href="/tcg-pocket.html">Pokemon TCG Pocket</a>, the quick one on your phone.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The short version</p>
    <h2>Five things worth knowing <span class="hl">up front</span></h2>
    <ul class="facts-list">
      <li><strong>Most cards are worth very little, and that is fine.</strong> A set has a couple of hundred cards and
        a handful of them carry the value. The rest are the game.</li>
      <li><strong>Condition decides almost everything.</strong> The same card can be worth ten dollars or a thousand
        depending on centering, corners and surface. Sleeve anything you care about, today.</li>
      <li><strong>Nobody can tell you what is in a sealed pack.</strong> Anyone claiming a method for picking winning
        packs is selling something. We open a lot of packs and the luck page is what that actually looks like.</li>
      <li><strong>Buy the single, not the box,</strong> if there is one specific card you want. It is almost always
        cheaper, and it is always certain.</li>
      <li><strong>Open the packs.</strong> This is a hobby, not a portfolio. The best part is the two seconds before
        you see the last card.</li>
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <h2>Or just watch someone <span class="hl">else</span> do it</h2>
    <p class="lede" style="max-width:44em">${videos.length} pack openings from Rochester, New York, mostly ending in
      garbage. That is the name.</p>
    ${startRips.length ? `<ul class="st-rips">
${startRips
  .map(({ label, v }) => `      <li><a href="/${esc(v.path)}"><span>${esc(label)}</span>${esc(v.siteTitle || v.title)}</a></li>`)
  .join("\n")}
    </ul>
    <p class="lede" style="max-width:44em;font-size:var(--t-sm);margin-top:var(--s3)">One of each of the three
      cheapest ways in, so you can see what the money actually buys before you spend any.
      <a href="/openings/">Every other kind of sealed product</a> has its own page.</p>` : ""}
    <div class="btn-row">
      <a class="btn btn-yt" href="/videos.html">Watch the rips</a>
      <a class="btn btn-ghost" href="/hall.html">The good pulls</a>
    </div>
  </div>
</section>

</main>
${/* Keep this short. footer() already appends "Fan content. Not affiliated with
      The Pokemon Company or Nintendo.", so anything ending in the same clause
      prints the disclaimer twice in one paragraph. */ ""}
${footer("Fan made guides, written by somebody who buys the same packs you do.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/start.html"), page);
console.log(`Wrote public/start.html
  ${STEPS.length} steps, linking ${STEPS.reduce((n, s) => n + 1 + (s.also || []).length, 0)} pages
  live counts: ${sets.length} sets, ${nCards} cards, ${videos.length} rips, ${shows} shows`);
