#!/usr/bin/env node
// Generate /grading.html: what grading costs, and whether it pays.
//
//   node scripts/build-grading.mjs
//
// Reads data/grading.json for fees and data/psa10.json for the math.
//
// THE POINT OF THIS PAGE IS THE SECOND HALF. Fee tables exist on twenty other
// sites. What almost nobody shows is the subtraction: this card is worth X raw
// and Y in a PSA 10, the cheapest slab costs Z, so grading it makes or loses
// this much. We happen to have both numbers for 76 cards out of the sets this
// channel rips, so the page can do that arithmetic on real cards instead of
// explaining it in the abstract.
//
// IT IS ALSO WHY THE PAGE CAN SAY NO. PSA paused its two cheap tiers in June
// 2026 and the entry price went from $24.99 to $79.99 overnight, which quietly
// killed the case for grading most modern cards. A page that only listed fees
// would not show that. A page that subtracts them does.
//
// The verdict deliberately uses the PSA 10 price as the UPSIDE and says out
// loud that most cards come back a 9. Presenting the best case as the expected
// case is how this kind of page misleads people into spending $80 on a $12 card.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { priceNote, priceFooter, priceRead } from "../shared/card-prices.mjs";
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
import { esc, longDate, moneyExact, moneyRound, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const g = JSON.parse(await readFile(join(ROOT, "data/grading.json"), "utf8"));
const psa = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
// WHAT EACH COMPANY'S SLAB IS ACTUALLY WORTH, from real sold prices rather
// than from the fee table. This is the half of the grading question nobody
// publishes: the fee tells you what it costs, and only the resale tells you
// whether it was worth it.
//
// Sample is data/graded.json: every card we pulled plus the top three chase
// cards from each set, read from PriceCharting. Small and openly stated, and
// the page prints the n against every row.
let graded = { cards: {} };
try {
  graded = JSON.parse(await readFile(join(ROOT, "data/graded.json"), "utf8"));
} catch {
  /* no graded sample yet; the section simply does not render */
}
const gRows = Object.values(graded.cards || {}).filter((c) => c.psa10 && c.ungraded);
const median = (a) => {
  const x = a.slice().sort((p, q) => p - q);
  return x.length ? x[x.length >> 1] : null;
};
const COMPANIES = [
  ["psa10", "PSA 10"],
  ["bgs10", "Beckett 10"],
  ["tag10", "TAG 10"],
  ["ace10", "ACE Grading 10"],
  ["sgc10", "SGC 10"],
  ["cgc10", "CGC 10"],
];
const slabValue = COMPANIES.map(([key, label]) => {
  const rows = gRows.filter((c) => c[key]);
  return {
    label,
    n: rows.length,
    med: median(rows.map((c) => c[key])),
    vsRaw: median(rows.map((c) => c[key] / c.ungraded)),
    vsPsa: median(rows.filter((c) => c.psa10).map((c) => c[key] / c.psa10)),
  };
}).filter((r) => r.n >= 20).sort((a, b) => b.vsRaw - a.vsRaw);

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const setName = new Map(sets.map((s) => [s.id, s.name]));
const by = Object.fromEntries(g.companies.map((c) => [c.id, c]));

// Card names AND raw prices. psa10.json carries its own rawNm from
// pokemonpricetracker, but the rest of the site quotes TCGdex, and a grading
// page that says a card is worth $1,480.32 raw while the card search one click
// away says $1,470.58 is the exact inconsistency this build set out to remove.
// The graded price still comes from psa10.json, because nothing else on the
// site supplies one, and the page says so.
const names = new Map();
const rawPrice = new Map();
const pcPsa10 = new Map();
// The TCGdex base for each card, kept for rowShot() below. This used to be read
// and thrown away, which is why the verdict list had no pictures.
const imgBase = new Map();
let cardsChecked = null;
// The sourcing stamps for the raw prices, summed across every set, so the note
// at the foot of the page describes all 28 checklists rather than the first
// file the loop happened to open.
let priceDoc = null;
try {
  const dir = join(ROOT, "public/data/cards");
  const { readdir } = await import("node:fs/promises");
  const norm = (n) => String(n ?? "").replace(/^0+(?=\d)/, "");
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    cardsChecked = cardsChecked || doc.checked;
    if (!priceDoc)
      priceDoc = {
        priceSource: doc.priceSource,
        pricesChecked: doc.pricesChecked,
        checked: doc.checked,
        pricedBy: { pricecharting: 0, tcgdex: 0 },
      };
    priceDoc.pricedBy.pricecharting += doc.pricedBy?.pricecharting || 0;
    priceDoc.pricedBy.tcgdex += doc.pricedBy?.tcgdex || 0;
    for (const c of doc.cards) {
      names.set(`${doc.set}-${norm(c.n)}`, c.name);
      if (c.img) imgBase.set(`${doc.set}-${norm(c.n)}`, c.img);
      if (typeof c.price === "number") rawPrice.set(`${doc.set}-${norm(c.n)}`, c.price);
      // PriceCharting's PSA 10 for the SAME printing whose raw price we just
      // took, off the same row of the same crawl. This is what lets the two
      // numbers this page subtracts come from one source instead of two.
      if (typeof c.psa10 === "number") pcPsa10.set(`${doc.set}-${norm(c.n)}`, c.psa10);
    }
  }
} catch {
  /* run: node scripts/sync-cards.mjs */
}
const keyOf = (slug, num) => `${slug}-${String(num ?? "").replace(/^0+(?=\d)/, "")}`;

/**
 * The card scans, at the size a row draws them.
 *
 * THE VERDICT LIST NAMED 32 REAL CARDS AND SHOWED NONE OF THEM. It is the only
 * part of this page that is about specific objects rather than about fees, and
 * "Mega Gardevoir ex / Mega Evolution / 178" as three columns of text is the
 * one thing here a picture fixes outright. The join was already being done: the
 * loop above walks public/data/cards/*.json for the name and the raw price and
 * threw the `img` away.
 *
 * MIRRORED, NOT HOTLINKED, and that is measured rather than tidy. TCGdex's
 * smallest rendition is 245px wide and there is no middle width at any host, so
 * 32 hotlinked scans is about 550KB to fill boxes 32px wide, on the page most
 * likely to be read on a phone. scripts/sync-card-thumbs.mjs fits each one to a
 * 72px box, which covers 32px at DPR2 with room, and the row costs about 96KB
 * instead. A card missing from the manifest keeps its remote low.webp, decided
 * here rather than with onerror, because onerror never fires for a lazy image.
 */
const THUMBS = JSON.parse(await readFile(join(ROOT, "data/card-thumbs.json"), "utf8")).thumbs;

const cheapest = g.companies.slice().sort((a, b) => a.cheapest - b.cheapest)[0];
// THE RESALE ROW FOR WHOEVER IS CURRENTLY CHEAPEST. The "Cheap to grade is not
// cheap" paragraph derives the company name from `cheapest` and used to pair it
// with a HARDCODED "a CGC 10 sells for about 0.46x". That worked while CGC was
// the cheapest slab. It is SGC now, at $15 against CGC's $17, so the paragraph
// named SGC and then evidenced the claim with a different company's multiple:
// SGC's own figure is 0.60x. The argument survives either way, because the
// point is that the cheap slab resells below a Beckett one, but it has to be
// made with the number belonging to the company in the sentence.
const cheapSlab =
  slabValue.find((r) => r.label === `${cheapest.name} 10`) ||
  slabValue.find((r) => r.label === "CGC 10") ||
  null;
const NUM_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const nCo = g.companies.length;
const coWord = NUM_WORD[nCo] || String(nCo);
const psaCo = g.companies.find((c) => c.id === "psa");
const SHIP = g.assumedShippingPerCard ?? 15;

// Sign BEFORE the currency, matching the calculator's own formatter further down
// this file. They disagreed, so the same loss rendered "$-68.57" in the table and
// "-$68.57" in the calculator directly above it.

// Every card where we hold BOTH a raw and a PSA 10 price. `auto` is synced,
// `prices` is hand-entered and wins, same rule as everywhere else on the site.
const rows = [];
let fromPcPsa = 0;
let fromTrackerPsa = 0;
for (const [key, a] of Object.entries(psa.auto || {})) {
  const manual = psa.prices?.[key];
  const mk = /^(.*)-([^-]+)$/.exec(key);
  const ck = keyOf(mk?.[1] || "", mk?.[2] || "");
  // A PERSON, THEN PRICECHARTING, THEN THE TRACKER. Same order build-hall.mjs
  // uses, and it has to be the same or two pages subtract different numbers
  // from the same raw price. The tracker still decides WHICH cards appear here,
  // because it is the only feed carrying a sale count and the ten-sale floor
  // below is what stops this page doing arithmetic on an anecdote.
  const pcHit = pcPsa10.get(ck);
  const psa10 =
    (typeof manual === "number" ? manual : manual?.price) ?? pcHit ?? a.psa10;
  // TCGdex first, the graded feed's own raw as the fallback.
  const raw = rawPrice.get(ck) ?? a.rawNm;
  if (typeof psa10 !== "number" || typeof raw !== "number" || raw <= 0) continue;
  // Enough recorded sales to mean something. Six sales is an anecdote.
  if (a.psa10Sales != null && a.psa10Sales < 10) continue;
  if (manual == null) {
    if (pcHit != null) fromPcPsa += 1;
    else fromTrackerPsa += 1;
  }

  const m = /^(.*)-([^-]+)$/.exec(key);
  const slug = m?.[1] || "";
  const num = m?.[2] || "";
  const feePsa = psaCo.cheapest + SHIP;
  const feeCheap = cheapest.cheapest + SHIP;
  rows.push({
    key,
    name: names.get(keyOf(slug, num)) || key,
    img: imgBase.get(keyOf(slug, num)) || null,
    set: setName.get(slug) || slug,
    slug,
    num,
    raw,
    psa10,
    multiple: psa10 / raw,
    netPsa: psa10 - raw - feePsa,
    netCheap: psa10 - raw - feeCheap,
    sales: a.psa10Sales ?? null,
  });
}
rows.sort((a, b) => b.netPsa - a.netPsa);

const worth = rows.filter((r) => r.netPsa > 0);
const notWorth = rows.filter((r) => r.netPsa <= 0);
const feePsa = psaCo.cheapest + SHIP;
const feeCheap = cheapest.cheapest + SHIP;

/**
 * The thumbnail for one row, or nothing.
 *
 * alt="" on purpose, the same call rarity.html's magnified corners make: the
 * card's name is the very next thing in the row, so alt text here reads the same
 * name twice. width and height come from the manifest, which carries the file's
 * REAL decoded size rather than a flat 72 by something: a blanket assumption
 * about card scan dimensions once made 173 images on this site wrong.
 */
const rowShot = (r) => {
  if (!r.img) return "";
  const t = THUMBS[r.img];
  const src = t ? `/assets/cards/${t.file}` : `${r.img}/low.webp`;
  const wh = t ? ` width="${t.w}" height="${t.h}"` : "";
  return `<img class="gr-shot" src="${esc(src)}" alt="" loading="lazy" decoding="async"${wh}>`;
};

const verdictRow = (r) => `        <li class="gr">
          <span class="gr-name">${rowShot(r)}<span>${esc(r.name)}</span></span>
          <span class="gr-set">${esc(r.set)} &bull; ${esc(r.num)}</span>
          <span class="gr-raw">${moneyExact(r.raw)}<em>raw</em></span>
          <span class="gr-psa">${moneyExact(r.psa10)}<em>PSA 10</em></span>
          <span class="gr-net ${r.netPsa > 0 ? "up" : "down"}">${r.netPsa > 0 ? "+" : ""}${moneyExact(r.netPsa)}<em>after fees</em></span>
        </li>`;

const desc =
  `What Pokemon card grading actually costs in ${new Date(g.checked).getFullYear()}, PSA against CGC, BGS and TAG, ` +
  `and the break even math on ${rows.length} real cards. PSA's cheapest tier is now ${moneyRound(psaCo.cheapest)}.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Grading" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does it cost to grade a Pokemon card?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `PSA's cheapest active tier is ${moneyRound(psaCo.cheapest)} per card as of ${longDate(g.checked)}, after it paused its Value and Value Bulk tiers in June 2026. The cheapest of the ${coWord} is ${cheapest.name} at about ${moneyRound(cheapest.cheapest)}. Add roughly ${moneyRound(SHIP)} a card for shipping and insurance.`,
        },
      },
      {
        "@type": "Question",
        name: "Is it worth grading my Pokemon card?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Only if the gap between the raw price and the PSA 10 price is bigger than the fee, and only if the card is genuinely mint. Of ${rows.length} cards we hold both prices for, ${worth.length} would clear PSA's current fee and ${notWorth.length} would not. Those figures are all for a 10, and a 9 is worth far less, so treat them as the best case.`,
        },
      },
    ],
  },
];

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Is It Worth Grading? Pokemon Card Grading Costs and Break Even</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/grading.html">
<meta property="og:title" content="Is it worth grading? The actual math">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/grading.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-grading.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-grading.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>
/* The card in each verdict row. In this page's own block rather than ui.css:
   this page is the only user and ui.css is render blocking on all 426 pages.
   It rides INSIDE .gr-name rather than as a new grid column, because .gr's
   template and its 560px rearrangement are tuned in ui.css and a fifth column
   would have to be re-tuned in two places to gain nothing. */
.gr-name{display:flex;align-items:center;gap:8px;min-width:0}
.gr-shot{flex:none;width:32px;height:auto;display:block;border-radius:3px;
  background:var(--paper-3);border:1px solid var(--hair)}

/* PROFIT AND LOSS SEPARATE BY WEIGHT AND LUMINANCE, NOT BY HUE. ui.css paints
   .gr-net.up a #3B6130 green and .gr-net.down var(--ketchup-deep), which is
   #6E5000 since the site repainted to one accent hue. Two problems with that
   after the repaint: the two are 1.05:1 apart in luminance, so the pair was
   carried almost entirely by hue with only the plus and minus signs behind it,
   and the LOSS was wearing the brand's own gold, which reads as approval on the
   one page whose whole job is telling you when not to spend the money.
   So the gain is --ink at 800 and the loss is --ink-2 at 400: 17.4:1 against
   6.8:1 on white, a 2.78:1 step between them, plus a weight difference you can
   see across the room, plus the sign that was already there. No hue at all, and
   the accent is no longer attached to the answer that means no.
   Overridden in this page's own block: ui.css is render blocking on all 426
   pages and this page is the only user. */
.gr-net.up{color:var(--ink);font-weight:800}
.gr-net.down{color:var(--ink-2);font-weight:400}
</style>
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
    <span class="kicker">Pokemon TCG &bull; Do the math first</span>
    <h1>Is it worth <span class="hl">grading</span>?</h1>
    <p class="lede" style="max-width:36em">What it costs, how the ${coWord} companies compare, and the subtraction almost
      nobody shows you: what a card is worth raw, what it is worth in a 10, and whether the difference covers the fee.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Grading</p>

    <div class="fk-golden">
      <p class="fk-golden-h">Read this first</p>
      <h2>PSA got a lot <span class="hl">pricier</span> this summer</h2>
      <p>${esc(psaCo.note)}</p>
    </div>

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${moneyCompact(psaCo.cheapest)}</div><div class="l">Cheapest PSA tier</div></div>
      <!-- "Cheapest anywhere" was a claim about the whole industry made from a
           table of four companies, which is not the same thing. SGC was the
           missing fifth and it turned out to be the cheapest of the lot, so the
           old label was wrong twice over. It is in the data now, and the count
           is interpolated rather than typed so this cannot go stale again. -->
      <div class="fact"><div class="n">${moneyCompact(cheapest.cheapest)}</div><div class="l">Cheapest of these ${coWord} (${esc(cheapest.name)})</div></div>
      <div class="fact"><div class="n">${worth.length}/${rows.length}</div><div class="l">Cards that clear the PSA fee</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(longDate(g.checked) || g.checked)}</div><div class="l">Fees last checked</div></div>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ${coWord}</p>
    <h2>What each one <span class="hl">costs</span></h2>
    <div class="gc-grid">
      ${g.companies
        .slice()
        .sort((a, b) => a.cheapest - b.cheapest)
        .map(
          (c) => `<article class="gc">
        <h3>${esc(c.name)}</h3>
        <p class="gc-price">${moneyCompact(c.cheapest)}<span> per card, ${esc(c.cheapestTier)}</span></p>
        <p class="gc-turn">${esc(c.turnaround)}</p>
        ${
              // The PSA note is already the whole "Read this first" panel at the
              // top of the page. Printing it again on PSA's own card repeated a
              // four line paragraph verbatim within one screen.
              c.id === "psa" ? "" : `<p class="gc-note">${esc(c.note)}</p>`
            }
        <p class="gc-resale"><strong>Resale.</strong> ${esc(c.resale)}</p>
        <a class="intl-link" href="${esc(c.url)}" rel="noopener" target="_blank">${esc(c.name)} prices &rarr;</a>
      </article>`
        )
        .join("\n      ")}
    </div>
    <h3 class="gc-sub">And the bits nobody quotes you</h3>
    <ul class="facts-list">
      ${g.extras.map((e) => `<li><strong>${esc(e.what)}, ${esc(e.cost)}.</strong> ${esc(e.note)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Work it out</p>
    <h2>Your <span class="hl">card</span></h2>
    <p class="lede">Put in what your card sells for raw and what it sells for in a PSA 10. Both numbers are on the
      <a href="/cards.html">card search</a> and on any set guide.</p>
    <form class="gcalc" onsubmit="return false">
      <label>Raw price
        <input id="gRaw" type="number" min="0" step="0.01" inputmode="decimal" placeholder="25.00">
      </label>
      <label>PSA 10 price
        <input id="gTen" type="number" min="0" step="0.01" inputmode="decimal" placeholder="180.00">
      </label>
      <label>Grading fee
        <select id="gFee">
          ${g.companies
            .slice()
            .sort((a, b) => a.cheapest - b.cheapest)
            .map((c) => `<option value="${c.cheapest}">${esc(c.name)} ${esc(c.cheapestTier)}, ${moneyCompact(c.cheapest)}</option>`)
            .join("\n          ")}
        </select>
      </label>
    </form>
    <div class="gcalc-out" id="gOut" aria-live="polite">
      <p class="gcalc-hint">Fill both boxes and the answer appears here.</p>
    </div>
  </div>
</section>

<section class="band-sky tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Real cards</p>
    <h2>${worth.length} of ${rows.length} cards <span class="hl">clear the fee</span></h2>
    <p class="lede">Every card from our sets where we hold both a raw price and a PSA 10 price, with
      ${moneyRound(psaCo.cheapest)} plus about ${moneyRound(SHIP)} shipping subtracted. This is the upside, not the
      expectation: it assumes the card comes back a 10, and most do not.</p>

    <h3 class="gc-sub">Worth it, best first</h3>
    <ol class="gr-list">
${worth.slice(0, 20).map(verdictRow).join("\n")}
    </ol>
    ${worth.length > 20 ? `<p class="price-note">Showing the top 20 of ${worth.length}.</p>` : ""}

    ${notWorth.length ? `<h3 class="gc-sub">Not worth it at PSA's current price</h3>
    <ol class="gr-list">
${notWorth.slice(-12).reverse().map(verdictRow).join("\n")}
    </ol>
    <p class="price-note">These are cards where the PSA 10 sells for less than the raw card plus the fee. At the old
      ${moneyRound(24.99)} Value tier several of them worked. That is what a fee change does.</p>` : ""}
  </div>
</section>

<section class="tight">
  <div class="wrap">
    ${
      slabValue.length
        ? `<h2 style="margin-bottom:var(--s3)">What the slab is actually <span class="hl">worth</span></h2>
    <p class="lede" style="max-width:42em">The fee tells you what grading costs. This tells you what you get back.
      Same cards, every company's 10, from real sold prices. It reorders the question
      completely: BGS costs about half what TAG does and its 10 resells for more
      than either PSA or TAG.
      Median of ${Object.keys(graded.cards || {}).length} cards read from ${esc(graded.source || "PriceCharting")} on
      ${esc(longDate(graded.checked) || graded.checked)}. A snapshot, not a live feed, and a different source from the
      PSA 10 prices in the fee table above.</p>
    <p class="price-note">The last column is the median of each card's OWN ratio to its PSA 10, not the two medians
      in this table divided by each other, which is why a company can show a higher median price and a lower
      multiple. They answer different questions: the price column is what a typical slab of that make sells for
      across the sample, and the multiple is what that make typically does to the same card.</p>
    <div class="cc-scroll" style="margin-bottom:var(--s5)" tabindex="0" role="region"
         aria-label="Median value of each grading company's 10, scrollable">
      <table class="cc-table">
        <caption class="sr-only">Median value of each grading company's 10, against the raw card and against a PSA 10</caption>
        <thead><tr>
          <th scope="col">A 10 from</th>
          <th scope="col" class="num">Median value</th>
          <th scope="col" class="num">vs the raw card</th>
          <th scope="col" class="num">vs a PSA 10</th>
        </tr></thead>
        <tbody>
          ${slabValue
            .map(
              (r) => `<tr>
            <th scope="row">${esc(r.label)}<span class="cc-yr">${r.n} cards</span></th>
            <td class="num"><strong>${moneyRound(r.med)}</strong></td>
            <td class="num">${r.vsRaw.toFixed(1)}x<span class="cc-n">the ungraded price</span></td>
            <td class="num">${r.vsPsa.toFixed(2)}x<span class="cc-n">${r.label === "PSA 10" ? "the benchmark" : "of PSA, same card"}</span></td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>
    </div>
    <div class="fk-golden" style="margin-bottom:var(--s5)">
      <p class="fk-golden-h">The part that changes the math</p>
      <h2>Cheap to grade is not <span class="hl">cheap</span></h2>
      <p>${cheapest.name} is the cheapest slab you can buy at ${moneyRound(cheapest.cheapest)}, and ${
        /* "an SGC 10", "a CGC 10". These labels are read out letter by letter,
           so the article follows the SOUND of the first letter and not whether
           it is a vowel: A, E, F, H, I, L, M, N, O, R, S and X all open on one. */
        /^[AEFHILMNORSX]/.test(cheapSlab?.label || "") ? "an" : "a"
      } ${esc(cheapSlab?.label || "")} sells for
        about ${cheapSlab?.vsPsa?.toFixed(2)}x what the same card makes in a
        PSA 10. A Beckett 10 sells for ${(slabValue.find((r) => r.label === "Beckett 10") || {}).vsPsa?.toFixed(2)}x. So the
        fee is the smaller half of the decision: paying less to grade can cost you more than it saves, and the gap is
        far bigger than the difference in fees.</p>
      <p style="margin-top:10px">And every figure above is the price of a 10. You do not find out which grade you are
        getting until the card is already back, so treat the whole table as the best case rather than the expected
        one. We will not guess at the odds of any particular card coming back a 10, because nobody
      publishes that. What the companies do publish about grade outcomes, and it is less reassuring
      than it sounds, is on <a href="/will-it-grade.html">will it grade</a>.</p>
    </div>
    `
        : ""
    }
    <h2>Five things worth <span class="hl">knowing</span></h2>
    <ul class="facts-list">
      ${g.rules.map((r) => `<li>${esc(r)}</li>`).join("\n      ")}
    </ul>
    <!-- THE OTHER HALF OF THE QUESTION. Everything on this page assumes the card
         comes back a 10, because that is the only outcome where the fee clears.
         Whether it will is a completely different subject with its own page, and
         a reader who works out that grading pays and then submits a 9 has been
         let down by this page specifically. Prose link, not just nav: the
         what-set and rarity pair do the same. -->
    <p class="price-note" style="margin-top:var(--s4)"><b>All of this assumes a 10.</b> That is the assumption
      doing the most work here, and it is the one most likely to be wrong. Front centering has to be about
      55/45 before PSA or CGC will call a card a 10, one print line is the whole difference between a 9 and a
      10 on a holo, and your worst attribute caps the grade no matter how good the rest is.
      <a href="/will-it-grade.html">Will it grade?</a> goes through what each company actually publishes,
      and it is worth ten minutes before you spend the fee.</p>
    <!-- AND THE OTHER THING THAT DECIDES WHETHER THE FEE CLEARS ON AN OLD CARD,
         which is not condition at all. On a 1999 Base Set card the break-even
         moves by a factor of ten depending on which of the three print runs it
         is, and that is a two mark check anybody can do at the kitchen table
         before paying anybody anything. Prose link rather than nav only, same as
         the will-it-grade pair above. -->
    <p class="price-note"><b>If it is from 1999, check the printing first.</b> A Base Set card can be a 1st
      Edition, a Shadowless or an Unlimited, the three are worth wildly different amounts, and the difference is
      a small stamp and a shadow that is either there or is not.
      <a href="/base-set.html">1st Edition, Shadowless or Unlimited?</a> shows both marks magnified on a real
      card.</p>
    <p class="price-note">Fees and turnarounds read on ${esc(longDate(g.checked) || g.checked)} and they change often,
      sometimes with two weeks' notice, so click through before you send anything.
      ${esc(priceNote(priceDoc, { lead: "Raw prices" }))}
      They are the same figures the rest of this site quotes.
      ${esc(
        fromTrackerPsa > 0
          ? `PSA 10 prices come from the same PriceCharting guide for ${fromPcPsa} of the ${fromPcPsa + fromTrackerPsa} cards below, read the same day as the raw figure beside them, so both halves of the subtraction describe one printing out of one source. The other ${fromTrackerPsa} come from pokemonpricetracker.com.`
          : `PSA 10 prices come from the same PriceCharting guide, read the same day as the raw figure beside them, so both halves of the subtraction describe one printing of one card out of one source.`
      )}
      Which cards appear here is still decided by pokemonpricetracker.com's recorded sale counts, because it is the
      only feed that publishes one, and only cards with at least ten recorded sales are used. Card scans
      are TCGdex's, mirrored here at the size the rows draw them, and each one is the card named beside it. No affiliate
      links and no recommendation: we are not paid by any grading company and which one is right depends on your card
      and your patience. Not financial advice, just subtraction.</p>
  </div>
</section>

</main>
${footer("Grading fees change constantly. Always check the company's own page before submitting.")}
<script>
(function(){
  var raw=document.getElementById('gRaw'), ten=document.getElementById('gTen');
  var fee=document.getElementById('gFee'), out=document.getElementById('gOut');
  var SHIP=${SHIP};
  // The browser cannot import shared/format.mjs, so this is the one copy of
  // moneyExact that has to be duplicated. Keep the two in step.
  function money(n){
    return (n<0?'-$':'$')+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function run(){
    var r=parseFloat(raw.value), t=parseFloat(ten.value), f=parseFloat(fee.value);
    if(!isFinite(r)||!isFinite(t)||r<0||t<0){
      out.innerHTML='<p class="gcalc-hint">Fill both boxes and the answer appears here.</p>';
      return;
    }
    var cost=f+SHIP, net=t-r-cost;
    var good=net>0;
    var lines=''
      + '<p class="gcalc-verdict '+(good?'up':'down')+'">'+(good?'Worth a look':'Do not bother')+'</p>'
      + '<p class="gcalc-sum">'+money(t)+' in a 10, minus '+money(r)+' raw, minus '+money(cost)
      + ' to grade and ship, leaves <strong>'+money(net)+'</strong>.</p>';
    if(good){
      lines+='<p class="gcalc-note">That is the best case. It assumes a 10. A 9 on this card is usually worth a '
        + 'fraction of the 10, so you would be down the '+money(cost)+' and then some. Only send it if the card is '
        + 'genuinely mint: centered, sharp corners, clean surface.</p>';
    } else {
      lines+='<p class="gcalc-note">The gap between raw and graded does not cover the fee, so even a perfect 10 '
        + 'loses money. Keep it raw, sleeve it, and put the '+money(cost)+' toward more packs.</p>';
    }
    out.innerHTML=lines;
  }
  [raw,ten,fee].forEach(function(el){ el.addEventListener('input',run); el.addEventListener('change',run); });
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/grading.html"), page);
console.log(`Wrote public/grading.html
  ${g.companies.length} companies, cheapest ${cheapest.name} at ${moneyRound(cheapest.cheapest)}, PSA at ${moneyRound(psaCo.cheapest)}
  ${rows.length} cards with both prices: ${worth.length} clear the PSA fee, ${notWorth.length} do not
  best: ${worth[0]?.name} ${moneyRound(worth[0]?.netPsa)} net`);
