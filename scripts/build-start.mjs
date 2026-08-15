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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Live counts, so the page never claims a number the site has outgrown.
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const cardIndex = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
let shows = 0;
try {
  const s = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8"));
  const today = new Date().toISOString().slice(0, 10);
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
    also: [["/sets/", "Set guides"], ["/expansions.html", "Every set ever made"]],
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
    also: [["/card-shows.html", "Card show calendar"]],
  },
];

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
<title>Start Here: A Beginner's Guide to Pokemon Cards | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/start.html">
<meta property="og:title" content="New to Pokemon cards? Start here">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/start.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-start.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-start.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="stylesheet" href="/assets/fonts.css">
${STYLES}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; No gatekeeping</span>
    <h1>Start <span class="hl">here</span></h1>
    <p class="lede" style="max-width:36em">Found a box in the loft, got back into it, or just pulled something and
      have no idea what it is. Six questions in the order they actually come up. Nobody is going to make you feel
      stupid for asking any of them.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Start here</p>
    <ol class="st-list">
      ${STEPS.map(
        (s) => `<li class="st">
        <span class="st-n" aria-hidden="true">${s.n}</span>
        <div class="st-body">
          <h2>${esc(s.q)}</h2>
          <p>${esc(s.a)}</p>
          <p class="st-links">
            <a class="btn btn-sky btn-sm" href="${esc(s.href)}">${esc(s.cta)}</a>
            ${(s.also || []).map(([h, l]) => `<a class="st-also" href="${esc(h)}">${esc(l)}</a>`).join("\n            ")}
          </p>
        </div>
      </li>`
      ).join("\n      ")}
    </ol>
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
