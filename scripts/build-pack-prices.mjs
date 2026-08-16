#!/usr/bin/env node
// Generate /pack-prices.html: what one pack actually costs, across every set.
//
//   node scripts/build-pack-prices.mjs
//
// Reads public/data/products.json and public/data/sets.json. No new data and no
// new source: this is division over the sealed-product prices the site already
// pulls nightly, so it re-prices itself every time sync-products.mjs runs.
//
// WHY THIS PAGE EXISTS. Every set guide answers "what does a pack of THIS set
// cost". Nothing on the site answered "what does a pack cost", which is the
// question somebody types after watching a rip and before deciding whether to
// buy anything, and it is a question you cannot answer from one set page
// because the whole content of the answer is the comparison. The spread across
// the sets on the table is nearly six to one for the same object. (That number
// of sets is NOT written here on purpose: it read "these 23 sets" while
// products.json had gone five sets stale behind sets.json, and a count written
// into a comment is a count nobody re-checks.)
//
// AND THE ANSWER IS NOT THE ONE EVERY ARTICLE GIVES. The received wisdom is
// "the bigger the box, the cheaper the pack". Measured over the sets we hold
// prices for, a single pack is the cheapest pack in the majority of them. That
// is a real, checkable finding, it changes what somebody buys, and it is the
// page.
//
// PACK COUNTS COME OFF THE BLURB, NOT OFF THE PRODUCT KIND, and this is the one
// place this page could have published a number that is wrong by half. This
// logic is deliberately the same as packsIn()/perPack() in build-set-pages.mjs,
// whose own comment records why: seventeen of the products in this file carry a
// size word in the NAME ("Half Booster Box", "Enhanced Booster Box", "Mini
// Tin"), and a table keyed on `kind` would divide a half box by 36 and print a
// per-pack price around half the real one. A product whose pack count is not
// stated is left out of every figure here rather than estimated.
//
// It is duplicated rather than imported because build-set-pages.mjs does not
// export it. If you change one, change the other: the two pages print per-pack
// figures for the same products and a reader will compare them.
//
// NO EXPECTED VALUE, EVER. "Is this box worth it" in the sense people usually
// mean needs pull rates, and The Pokemon Company does not publish them. This
// page costs the packs and stops. Everything on it is a price divided by a
// printed pack count.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, noValue } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const products = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const meta = new Map(sets.map((s) => [s.id, s]));

let expansions = [];
try {
  expansions = JSON.parse(await readFile(join(ROOT, "public/data/expansions.json"), "utf8")).sets || [];
} catch {
  /* run: node scripts/sync-expansions.mjs */
}
// rips-per-set, so a row can offer the thing this site has and a price tracker
// does not: the set being opened on camera. Keyed on the guide slug the
// expansion sync already stamps, never re-derived from the name.
//
// COUNTED FROM videos.json, NOT READ OFF expansions.json. The `rips` field in
// that snapshot is written when the expansion sync last ran and goes stale the
// moment another rip is tagged, which is nightly. This page was publishing "19
// rips on the channel" for Pitch Black while the home page, /sets/ and
// /expansions.html all said 21, and "50" for Chaos Rising against their 52.
// build-expansions.mjs hit this first and fixed it the same way; this was the
// last reader of the stale field.
const { videos: allVideos } = JSON.parse(
  await readFile(join(ROOT, "public/data/videos.json"), "utf8")
);
const ripsFor = new Map(expansions.filter((s) => s.slug).map((s) => [s.slug, 0]));
for (const v of allVideos) {
  for (const sid of v.sets || []) if (ripsFor.has(sid)) ripsFor.set(sid, ripsFor.get(sid) + 1);
}

/**
 * The product kinds this page will divide, in the order the table shows them.
 *
 * A kind is listed here only when every product of that kind carries a pack
 * count in its blurb. Blisters, tins and collection boxes are deliberately
 * absent: sync-products.mjs writes them "Packs plus a promo" with no number
 * because the number varies by product and is not in our data, so there is
 * nothing to divide and nothing to guess.
 */
const COLUMNS = ["Booster Box", "Elite Trainer Box", "Booster Bundle", "Build & Battle Box", "Single Pack"];

/** See the header note. Same rule as build-set-pages.mjs, on purpose. */
const SIZE_WORD = /\b(half|enhanced|mini|jumbo|premium|double)\b/i;

/**
 * THE BLURB IS ONLY SOURCED FOR THE ERA IT WAS WRITTEN ABOUT, and this page
 * divided by it outside that era for as long as it existed.
 *
 * Every blurb here is a per-KIND constant hardcoded in sync-products.mjs, not a
 * string read off any particular product. "9 packs plus sleeves and dice" is
 * carried by all 23 Elite Trainer Box entries. Nine is right for a main
 * expansion from the Scarlet & Violet era onward, confirmed on four pokemon.com
 * product pages and three official expansion pages (see
 * data/pack-counts-current.json and /how-many-packs.html). It is NOT a fact
 * about Elite Trainer Boxes: the first one held seven, it was eight for nine
 * years, and most special expansions from Generations to Crown Zenith held ten.
 *
 * SIX sets in this table predate that window and every one of them was being
 * divided by the current constants: Rebel Clash, Shining Fates, Chilling Reign,
 * Celebrations, Pokemon GO and Crown Zenith. The Celebrations row was the worst
 * of them. That Elite Trainer Box held ten Celebrations packs plus five from
 * other Sword & Shield sets, and Celebrations packs are four cards each, so the
 * page was dividing a fifteen-pack box by nine and calling the result the price
 * of a pack. We hold no source for any of those six counts, so the honest output
 * is an empty cell rather than a plausible one, which is the rule the SIZE_WORD
 * gate above already applies to half and enhanced boxes.
 *
 * The date is the Scarlet & Violet base set release, which is also when the
 * Booster Bundle was invented, so it is the boundary for these generics rather
 * than an arbitrary cutoff. "Single Pack" is exempt because one pack is one
 * pack in every era.
 */
const GENERIC_FROM = "2023-03-31";

function packsIn(p, released) {
  if (SIZE_WORD.test(p.name || "")) return null;
  if (p.kind !== "Single Pack" && String(released || "") < GENERIC_FROM) return null;
  const blurb = String(p.blurb || "");
  const m = /^(\d+)\s+packs?\b/i.exec(blurb);
  const n = m ? Number(m[1]) : /^one pack\b/i.test(blurb) ? 1 : null;
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 1 || n > 40) {
    throw new Error(`packsIn: "${p.name}" parsed ${n} packs out of "${blurb}", which cannot be right.`);
  }
  if (p.kind === "Single Pack" && n !== 1) {
    throw new Error(`packsIn: "${p.name}" is a Single Pack but its blurb says ${n} packs.`);
  }
  return n;
}

/** Market price per pack, or null where the pack count is not knowable. */
function perPack(p, released) {
  const packs = packsIn(p, released);
  const market = typeof p.market === "number" && p.market > 0 ? p.market : null;
  if (!packs || market === null) return null;
  const each = market / packs;
  // A per-pack figure above the price of the whole product means the division
  // went the wrong way round. Cheaper to throw than to print it.
  if (!Number.isFinite(each) || each <= 0 || each > market + 0.005) {
    throw new Error(`perPack: "${p.name}" gives ${each} per pack from ${market} over ${packs} packs.`);
  }
  return { packs, each, market };
}

const rows = [];
for (const [id, entry] of Object.entries(products.sets || {})) {
  const set = meta.get(id);
  if (!set || !entry?.products?.length) continue;

  // One figure per KIND. Where a set lists several products of one kind, the
  // cheapest per pack wins, because that is the one somebody would buy.
  const byKind = new Map();
  for (const p of entry.products) {
    if (!COLUMNS.includes(p.kind)) continue;
    const e = perPack(p, set.released);
    if (!e) continue;
    const prev = byKind.get(p.kind);
    if (!prev || e.each < prev.each) byKind.set(p.kind, { ...e, name: p.name, url: p.url });
  }
  if (!byKind.size) continue;

  let best = null;
  for (const [kind, e] of byKind) if (!best || e.each < best.each) best = { kind, ...e };
  // The headline of every row is "cheapest per pack, and which product it is
  // inside". If those two ever disagree the row is lying about the one thing it
  // is for, so it is checked rather than assumed.
  const lowest = Math.min(...[...byKind.values()].map((e) => e.each));
  if (Math.abs(best.each - lowest) > 1e-9 || byKind.get(best.kind)?.each !== best.each) {
    throw new Error(`${set.name}: cheapest-per-pack row disagrees with its own columns`);
  }

  rows.push({
    id,
    name: set.name,
    released: set.released,
    kinds: Object.fromEntries(byKind),
    best,
    rips: ripsFor.get(id) ?? 0,
    checked: entry.checked || products.checked,
  });
}

rows.sort((a, b) => a.best.each - b.best.each);

if (rows.length < 20) {
  throw new Error(
    `Only ${rows.length} sets produced a per-pack figure. products.json covers ` +
      `${Object.keys(products.sets || {}).length}; something has emptied out.`,
  );
}

const cheapest = rows[0];
const priciest = rows[rows.length - 1];
const spread = priciest.best.each / cheapest.best.each;

// THE FINDING. A single pack, bought one at a time, is the cheapest pack in the
// set. Counted only where the set offers something else to lose to, or it would
// be counting sets that sell nothing but packs.
const packWins = rows.filter(
  (r) => r.best.kind === "Single Pack" && Object.keys(r.kinds).length > 1,
);
const boxWins = rows.filter((r) => r.best.kind !== "Single Pack" && r.kinds["Single Pack"]);
// Sets where a booster box exists in our data AND its pack count is known.
const withBox = rows.filter((r) => r.kinds["Booster Box"]);
const noBox = rows.filter((r) => !r.kinds["Booster Box"]);

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// What an Elite Trainer Box costs per pack against the cheapest pack in the SAME
// set. Compared to the set's own floor rather than to a booster box, because
// only a handful of these sets have a booster box we can divide.
const etbRatios = rows.filter((r) => r.kinds["Elite Trainer Box"]).map((r) => ({
  set: r,
  x: r.kinds["Elite Trainer Box"].each / r.best.each,
}));
const etbMedian = median(etbRatios.map((r) => r.x));
const etbWorst = etbRatios.slice().sort((a, b) => b.x - a.x)[0];
const etbBest = etbRatios.slice().sort((a, b) => a.x - b.x)[0];
// Two different claims, and the first draft of this page made the stronger one
// without checking it. The ETB is NOT the dearest pack in every set: on some it
// loses to a loose pack or a bundle. It has never once been the cheapest, which
// is the claim that survives.
const etbSets = rows.filter((r) => r.kinds["Elite Trainer Box"]);
const etbDearest = etbSets.filter((r) => {
  const vals = Object.values(r.kinds).map((e) => e.each);
  return r.kinds["Elite Trainer Box"].each >= Math.max(...vals);
});
const etbCheapest = etbSets.filter((r) => r.best.kind === "Elite Trainer Box");
if (etbCheapest.length) {
  // Not a failure, but the copy below says "never the cheapest" and would
  // become false. Better to stop the build than to print it.
  throw new Error(
    `The Elite Trainer Box is now the cheapest pack in ${etbCheapest.length} set(s) ` +
      `(${etbCheapest.map((r) => r.name).join(", ")}). Rewrite the ETB section: it says never.`,
  );
}

// The two ends of the table, checked rather than described. Both clauses below
// are only written if the data still says them, because "the cheapest sets are
// the ones where the box wins" is the kind of sentence that is true on the day
// it is typed and silently false three price syncs later.
const headEnd = rows.slice(0, 3);
const tailEnd = rows.slice(-2);
const headAllBoxed = headEnd.every((r) => r.best.kind !== "Single Pack");
const tailAllLoose = tailEnd.every((r) => r.best.kind === "Single Pack");
// EACH CLAUSE HAS TO STAND ON ITS OWN, because either can be dropped. The tail
// clause used to read "on the 2 priciest the loose pack does", which borrowed
// its verb from the head clause: the day the head clause stopped being true
// (Chaos Rising, the second cheapest set, is cheapest bought loose) the page
// printed "It is not a rule that can be applied from the outside, on the 2
// priciest the loose pack does, so the only way to know...", where "does" has
// nothing to do. With both clauses false it printed a doubled comma instead.
const endsClause = [
  headAllBoxed
    ? `on the ${headEnd.length} cheapest sets here the cheapest pack comes inside a box or a bundle`
    : "",
  tailAllLoose ? `on the ${tailEnd.length} priciest the cheapest pack is bought loose` : "",
]
  .filter(Boolean)
  .join(", and ");

/**
 * How many packs each column divides by, hoisted out of the cells.
 *
 * The count is constant down a column BY CONSTRUCTION: a kind only reaches
 * COLUMNS when every product of that kind states a pack count, and those counts
 * come from per-kind blurbs. Printing "36 packs" in 23 cells to say one thing
 * was also what made the table 962px wide inside a 360px phone, which is nearly
 * three screens of sideways scrolling.
 *
 * Constant by construction is not constant by guarantee, so it is checked. If a
 * future product ever puts two different counts under one kind, the header
 * would be quietly wrong for some of the rows under it, and that is exactly the
 * class of error this table exists to avoid.
 */
const packsByKind = new Map();
for (const r of rows) {
  for (const [kind, e] of Object.entries(r.kinds)) {
    const seen = packsByKind.get(kind);
    if (seen === undefined) packsByKind.set(kind, e.packs);
    else if (seen !== e.packs) {
      throw new Error(
        `"${kind}" holds ${seen} packs on one set and ${e.packs} on ${r.name}. ` +
          `The column header states one number for the whole column, so it cannot vary.`,
      );
    }
  }
}

const totalRips = rows.reduce((n, r) => n + r.rips, 0);
const checked = products.checked;

const price = (n) => moneyExact(n);
const x = (n) => `${n.toFixed(2)}x`;

// Google truncates the snippet around 160 characters, and set names are long
// enough that this has to be measured rather than hoped for.
const desc =
  `What one Pokemon booster pack costs across ${rows.length} sets, priced nightly. ` +
  `Cheapest is ${cheapest.name} at ${price(cheapest.best.each)}, priciest ${priciest.name} at ${price(priciest.best.each)}.`;
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Pack prices by set", item: `${SITE}/pack-prices.html` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does a Pokemon booster pack cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `It depends far more on the set than on where you buy it. Across the ${rows.length} sets priced on this page a ` +
            `pack runs from ${price(cheapest.best.each)} for ${cheapest.name} to ${price(priciest.best.each)} for ${priciest.name}, ` +
            `a spread of ${x(spread)} for the same object. Those are TCGplayer market prices read on ` +
            `${longDate(checked) || checked}, divided by the pack count printed on the product.`,
        },
      },
      {
        "@type": "Question",
        name: "Is a booster box cheaper per pack than buying single packs?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            // THE LAST CLAUSE WAS TYPED, AND IT WAS FALSE. It read "on the three
            // cheapest sets on this page the booster box wins, and on the two
            // priciest the loose pack does" while the visible page, thirty lines
            // down, refuses to print the first half of exactly that sentence
            // because headAllBoxed is false: Chaos Rising is the second cheapest
            // set here and its cheapest pack is bought loose. A guard that stops
            // the page saying something is worth nothing if the schema block
            // says it anyway, and this one is the copy Google quotes.
            `Not reliably. A single pack bought on its own is the cheapest pack in ${packWins.length} of the ${rows.length} sets ` +
            `priced here, and a box or bundle is cheaper in ${boxWins.length}. It has to be checked set by set rather than assumed` +
            `${endsClause ? `: ${endsClause}` : ""}.`,
        },
      },
      {
        "@type": "Question",
        name: "Is an Elite Trainer Box worth it?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            `Purely as packs, no. Across the ${etbSets.length} sets priced here the Elite Trainer Box is never the cheapest pack in its ` +
            `set, it is the dearest option on the row in ${etbDearest.length} of them, and it runs a median of ${x(etbMedian)} the cheapest ` +
            `pack in the same set. It also comes with sleeves, dice, a promo card and the box itself, and we put no price on those, so ` +
            `whether that gap is worth paying is a question about the accessories rather than about the cards.`,
        },
      },
    ],
  },
];

/**
 * Page-scoped CSS.
 *
 * The table borrows .cc-table wholesale from the cost-to-complete page, which
 * already solves the hard part: a sticky first column and a scroll container
 * with edge shadows. Only two things differ. It has seven columns instead of
 * five, so it needs a wider min-width or the numbers crush together at 390px,
 * and the "cheapest" cell wants to be findable at a glance down a column of
 * near-identical dollar figures.
 */
const style = `
.pp-table{min-width:660px}
.pp-table td.num{font-variant-numeric:tabular-nums}
/* .cc-table sets white-space:nowrap on .num cells and on every header cell,
   which is right for a five column table of bare money and wrong for this one.
   Seven columns, and the two longest strings on the row are words rather than
   figures: "Build & Battle Box" and "in the build & battle box". Held on one
   line they alone pushed the table to 949px inside a 360px phone, which is
   nearly three screens of sideways scrolling for a table whose job is to be
   compared across. Wrapping the words and keeping the numbers on one line takes
   it under 700. */
.cc-table.pp-table thead th{white-space:normal}
.pp-via,.pp-packs{white-space:normal}
/* The pack count each column divides by, said once in the header rather than in
   every cell under it. .cc-table thead is white-space:nowrap, so this has to be
   a block or the two lines run on and the header row gets wider than the body. */
.pp-packs{display:block;font-weight:400;text-transform:none;letter-spacing:0;
  font-size:.62rem;color:var(--sky-lite);margin-top:2px}
/* The winning cell in each row. A tinted cell rather than a coloured number:
   .cc-table already tints whole rows on hover and on even rows, and a third
   colour on the text would be a fourth thing competing in the same cell. */
.pp-best{background:var(--mustard) !important;font-weight:700}
.pp-via{display:block;font-family:var(--mono);font-size:.64rem;color:var(--ink);font-weight:400;margin-top:2px}
.pp-none{color:var(--ink-soft)}
.pp-rips{display:block;font-family:var(--mono);font-size:.64rem;color:var(--ink-soft);font-weight:400}
.pp-key{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:center;
  font-family:var(--mono);font-size:.72rem;color:var(--ink-soft);margin-top:var(--s3)}
.pp-key i{display:inline-block;width:14px;height:14px;background:var(--mustard);
  border:1px solid var(--navy);vertical-align:-2px;margin-right:6px;font-style:normal}
`;

const cell = (r, kind) => {
  const e = r.kinds[kind];
  if (!e) {
    // Never "0" and never a bare dash. The reason a cell is empty is a real
    // piece of information here (see the method note), so it is said out loud
    // to a screen reader rather than drawn as punctuation.
    // noValue() from shared/format.mjs rather than the same markup written
    // again here. It exists so an empty cell always carries a REASON a screen
    // reader can hear, and a second copy of the pattern is how that guarantee
    // quietly stops being one.
    return `<td class="num">${noValue(`No ${kind.toLowerCase()} we can price per pack`, "pp-none")}</td>`;
  }
  const best = r.best.kind === kind;
  return `<td class="num${best ? " pp-best" : ""}">${price(e.each)}${
    e.packs > 1 ? `<span class="pp-via">${price(e.market)} total</span>` : ""
  }</td>`;
};

const row = (r) => `<tr>
  <th scope="row"><a href="/sets/${esc(r.id)}.html">${esc(r.name)}</a><span class="cc-yr">${esc(
    String(r.released).slice(0, 4),
  )}</span>${r.rips ? `<span class="pp-rips">${r.rips} rip${r.rips === 1 ? "" : "s"} on the channel</span>` : ""}</th>
  <td class="num"><strong>${price(r.best.each)}</strong><span class="pp-via">${
    r.best.kind === "Single Pack" ? "bought loose" : `in the ${esc(r.best.kind.toLowerCase())}`
  }</span></td>
  ${COLUMNS.map((k) => cell(r, k)).join("\n  ")}
</tr>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Pack Prices by Set: What One Pack Costs | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/pack-prices.html">
<meta property="og:title" content="What does a Pokemon pack actually cost?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/pack-prices.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-pack-prices.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-pack-prices.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${style}</style>
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
    <span class="kicker">Pokemon TCG &bull; Priced ${esc(longDate(checked) || "recently")}</span>
    <h1>What does a pack <span class="hl">actually</span> cost?</h1>
    <p class="lede" style="max-width:38em">Every sealed product we track, divided by how many packs are inside it,
      so a booster box and a single pack can finally be compared. Prices are TCGplayer market, read on
      ${esc(longDate(checked) || "the date at the bottom of this page")}, and read again each time the product sync runs.
      Where the counts come from, and what they were in other years, is on
      <a href="/how-many-packs.html">how many packs are in it</a>.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Pack prices by set</p>

    <div class="facts">
      <div class="fact"><div class="n">${price(cheapest.best.each)}</div><div class="l">Cheapest pack (${esc(cheapest.name)})</div></div>
      <div class="fact"><div class="n">${price(priciest.best.each)}</div><div class="l">Priciest pack (${esc(priciest.name)})</div></div>
      <div class="fact"><div class="n">${x(spread)}</div><div class="l">Between the two, for the same object</div></div>
      <div class="fact"><div class="n">${rows.length}</div><div class="l">Sets priced per pack</div></div>
    </div>

    <div class="fk-golden" style="margin-top:22px">
      <p class="fk-golden-h">Read this first</p>
      <h2>The bigger box is <span class="hl">not</span> the cheaper pack</h2>
      ${/* THE DENOMINATOR IS NOT rows.length AND A READER CAN DO THE SUM. This
            read "On these 28 sets that holds 9 times and fails 13 times", and
            9 + 13 is 22. The received wisdom can only be tested where a set
            sells a pack BOTH loose and inside something bigger, which is what
            boxWins and packWins already require; the other 6 sell nothing but
            loose packs and are neither a win nor a loss. Printing the count
            those two are actually drawn from makes the arithmetic close. */ ""}
      <p>The received wisdom is that the bigger the box the cheaper the pack. Of the
        ${boxWins.length + packWins.length} sets here that sell a pack both loose and inside something bigger, that holds
        ${boxWins.length} times and fails ${packWins.length} times: buying single packs one at a time is the cheapest pack
        in ${esc(packWins[0]?.name || "")}${packWins.length > 1 ? `, ${esc(packWins[1].name)}` : ""}${
          packWins.length > 2 ? ` and ${packWins.length - 2} more` : ""
        }. It is not a rule that can be applied from the outside${endsClause ? `: ${endsClause}` : ""}. The only way to
        know is to look at the set you are actually buying, and that is what the table below is.</p>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <!-- SAY WHICH SETS, NOT "ALL". This label read "All 23 sets" while the rest of
         the site said 41 set guides, so the one page whose whole job is a
         complete price table implied the site had 23 sets in it. Two separate
         things were wrong: products.json had gone stale and was five sets short
         of sets.json, and the word "All" claimed a scope this page has never
         had. The count is fixed by re-running sync-products.mjs; the word is
         fixed here, because the imported Japanese and Korean guides are real
         guides with no TCGplayer sealed listing to divide and never will be on
         this table. -->
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>${rows.length} English sets</p>
    <h2>Cheapest pack to <span class="hl">priciest</span></h2>
    <p class="lede" style="max-width:40em">Every English set we can price sealed, sorted by the cheapest pack available
      in each one, whatever it is inside. The imported Japanese and Korean sets have guides of their own but no sealed
      listing to divide, so they are not on this table. Every
      figure is that product's market price divided by the number of packs in it, before tax and shipping. The counts
      under the column headings are sourced for the Scarlet &amp; Violet era onward and are not permanent properties of
      those products, so a set from an earlier era gets an empty cell rather than a figure divided by the wrong number.
      <a href="/how-many-packs.html">What each one has held over the years</a> is its own page.</p>
    <div class="cc-scroll" tabindex="0" role="region" aria-label="Pack prices by set, scrollable table">
      <table class="cc-table pp-table">
        <caption class="sr-only">Market price per pack for each sealed product, by set, cheapest set first</caption>
        <thead>
          <tr>
            <th scope="col">Set</th>
            <th scope="col" class="num">Cheapest pack</th>
${COLUMNS.map(
  (k) =>
    `            <th scope="col" class="num">${esc(k)}<span class="pp-packs">${packsByKind.get(k)} pack${
      packsByKind.get(k) === 1 ? "" : "s"
    }</span></th>`,
).join("\n")}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row).join("\n          ")}
        </tbody>
      </table>
    </div>
    <p class="pp-key"><span><i aria-hidden="true"></i>Cheapest pack in that set</span>
      <span>Set name goes to its full guide</span></p>
    <p class="price-note">A dash means there is no product of that kind in our nightly pull whose pack count we hold.
      ${noBox.length} of these ${rows.length} sets have no full booster box we can divide: some never had one in English,
      and for others TCGplayer lists only a half or enhanced box, whose pack count is not in our data. Either way we leave
      the cell empty rather than guess at it. See the method note at the bottom.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The pack that wins</p>
    <h2>Where buying <span class="hl">one pack</span> is the cheap way</h2>
    <p class="lede" style="max-width:40em">${packWins.length} of these ${rows.length} sets sell a pack more cheaply on its
      own than inside anything bigger, which is the opposite of how sealed product is usually described. We do not hold a
      record of which sets are still being printed, so we are not going to tell you why. The figures are what they are on
      ${esc(longDate(checked) || checked || "the date at the bottom of this page")}, and the multiple in each line is what
      the bigger box costs you per pack against buying loose.</p>
    <ul class="facts-list">
      ${packWins
        .map((r) => {
          const others = Object.entries(r.kinds)
            .filter(([k]) => k !== "Single Pack")
            .sort((a, b) => a[1].each - b[1].each)[0];
          return `<li><strong>${esc(r.name)}.</strong> ${price(r.kinds["Single Pack"].each)} a pack on its own. The next
        cheapest way in is the ${esc(others[0].toLowerCase())} at ${price(others[1].each)} a pack, which is
        ${x(others[1].each / r.kinds["Single Pack"].each)} the loose price.</li>`;
        })
        .join("\n      ")}
    </ul>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The Elite Trainer Box</p>
    <h2>What the <span class="hl">ETB</span> premium looks like</h2>
    <p class="lede" style="max-width:40em">All ${etbSets.length} sets on this page sell an Elite Trainer Box, and in not
      one of them is it the cheapest pack. In ${etbDearest.length} of the ${etbSets.length} it is the dearest thing on the
      row. Measured against the cheapest pack in its own set it runs a median of ${x(etbMedian)}.</p>
    <div class="facts">
      <div class="fact"><div class="n">${x(etbMedian)}</div><div class="l">Median ETB pack against the cheapest pack in the same set</div></div>
      <div class="fact"><div class="n">${x(etbBest.x)}</div><div class="l">Closest it gets (${esc(etbBest.set.name)})</div></div>
      <div class="fact"><div class="n">${x(etbWorst.x)}</div><div class="l">Furthest apart (${esc(etbWorst.set.name)})</div></div>
      <div class="fact"><div class="n">${etbDearest.length} of ${etbSets.length}</div><div class="l">Sets where the ETB is the dearest pack on the row</div></div>
    </div>
    <p style="max-width:40em;margin-top:16px">That gap is not the whole story and this page will not pretend it is. An
      Elite Trainer Box also carries sleeves, dice, a promo card, dividers and the box itself, and we have no source for
      what any of that is worth, so we do not subtract a made up number from the price to make the comparison look
      better. If you want the sleeves, the premium may be the cheapest sleeves you will buy. If you want packs, there is
      a cheaper way to get them in every set on this page.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Before you buy anything</p>
    <h2>What this page will <span class="hl">not</span> tell you</h2>
    <ul class="facts-list">
      <li><strong>Whether the cards inside are worth the price.</strong> That calculation needs pull rates, and The
        Pokemon Company does not publish them, so nobody quoting you one has them either. What we do have is
        ${totalRips} openings of these sets on camera with the results written down, which is
        <a href="/luck.html">observed and not the same thing</a>.</li>
      <li><strong>What you will pay at a shop.</strong> Market price is what copies have been selling for online. A
        counter in <a href="/shops.html">Rochester</a> or a table at a <a href="/card-shows.html">card show</a> is its
        own market, sometimes under this and sometimes over, and there is no feed for either.</li>
      <li><strong>Anything about half boxes, blisters, tins or collection boxes.</strong> They are in the sync and on the
        set guides with their full prices, but their pack counts are either variable or not in our data, so they are not
        divided here. A per-pack figure over a guessed pack count is worse than no figure.</li>
      <li><strong>Which set to open.</strong> Cheapest is not best and this is not a recommendation. It is a price list.</li>
    </ul>
    <p class="price-note">Prices are TCGplayer market prices, pulled by <code>scripts/sync-products.mjs</code> and read
      ${esc(longDate(checked) || checked || "recently")}. The pack counts are our own per-kind figures for the current
      era, sourced on <a href="/how-many-packs.html">how many packs are in it</a> and applied only to sets from the
      Scarlet &amp; Violet era onward, because they are not what those products held in earlier ones. Every per-pack
      figure on this page is one of those prices divided by one of those counts, computed when the page was built. No affiliate links, and nothing here is a
      recommendation to buy anything. Set guides for all ${rows.length} of these are under <a href="/sets/">set guides</a>,
      and what it costs to buy the cards instead of the packs is on
      <a href="/complete-a-set.html">cost to complete a set</a>.</p>
  </div>
</section>

</main>
${footer("Prices move daily. These are market prices with a read date, not a quote.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/pack-prices.html"), page);
console.log(`Wrote public/pack-prices.html
  ${rows.length} sets priced per pack, ${withBox.length} with a divisible booster box
  cheapest ${cheapest.name} ${price(cheapest.best.each)} in the ${cheapest.best.kind.toLowerCase()}
  priciest ${priciest.name} ${price(priciest.best.each)} in the ${priciest.best.kind.toLowerCase()}
  single packs cheapest on ${packWins.length} sets, a box or bundle on ${boxWins.length}
  ETB median ${x(etbMedian)} the cheapest pack in its own set`);
