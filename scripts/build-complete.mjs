#!/usr/bin/env node
// Generate /complete-a-set.html: what it actually costs to finish each set.
//
//   node scripts/build-complete.mjs
//
// Reads public/data/cards/*.json and public/data/sets.json. No new data, no new
// source: this is arithmetic over the checklist and prices the site already
// carries, so it re-costs itself every time the nightly price sync runs.
//
// WHY THIS PAGE EXISTS. "How much to complete <set>" is a question people ask
// constantly and nobody answers with live numbers. The pages that rank for it
// quote a price read once, on one set, and then sit there going stale: the best
// of them is still quoting December 2023 for 151. Ours is a table over every
// set we cover, recomputed nightly, which is a thing a hand-written article
// structurally cannot be.
//
// THE CHEAPEST PRINTING IS THE HONEST PRICE. A card can exist as a normal, a
// reverse holo and a holo at three different prices. Somebody completing a set
// needs one copy of that number and will buy whichever is cheapest, so every
// total here uses min(all variants), not the card's headline price. That makes
// these totals LOWER than the site's card pages quote, on purpose, and the
// method note says so.
//
// WHY THE TOTALS ARE A FLOOR, TWICE OVER. Singles are bought one at a time from
// different sellers, so a real completion pays shipping many times and pays a
// spread over market on the cards nobody has listed. Neither is knowable from
// this data. The page says "before shipping" everywhere rather than pretending
// the market price is the checkout price.
//
// UNPRICED CARDS ARE SUBTRACTED, NOT ZEROED. A handful of cards in four sets
// have no market price yet. Counting them as $0 would silently understate those
// sets and make them look like bargains next to sets that happen to be fully
// priced. Each row carries its own coverage count and any row missing cards is
// marked, so the reader can see which totals are complete.

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
import { esc, longDate, moneyExact, moneyRound, moneyCompact, imgDims, avifPicture } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const meta = new Map(sets.map((s) => [s.id, s]));

// The 101 TCGdex image bases that answer 404, so no dead round trip is emitted.
// THE KEY IS `bases`, not `tcgdex`: the file holds `_readme`, `checked`,
// `bases` and `deadUrls`, and reading a key that is not there yields an empty
// Set that silently guards nothing.
const NO_SCAN = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8").catch(() => "{}")).bases || []
);

// The rarities that come out of packs in quantity. Everything above these is
// the part of a set that costs money, which is the split the page is built on.
const BULK = new Set(["Common", "Uncommon"]);

/** Cheapest way to own this card at MARKET. See the header note on variants. */
function floorPrice(c) {
  const vals = Object.values(c.all || {}).filter((v) => typeof v === "number" && v > 0);
  if (vals.length) return Math.min(...vals);
  return typeof c.price === "number" && c.price > 0 ? c.price : null;
}

/** Cheapest listing on the shelf right now, across variants.
 *
 * A DIFFERENT NUMBER ANSWERING A DIFFERENT QUESTION, and the page keeps them
 * apart. Market is what copies have been selling for. `low` is one listing,
 * condition unstated, from one seller, and 200 of them are 200 separate orders
 * with 200 postage charges. Summed it is a floor nobody can actually reach, so
 * it is never presented as what a set costs. Falls back to market so a card
 * without a listing does not silently drop out of the floor and make it look
 * lower than it is. */
function listedFloor(c) {
  return typeof c.low === "number" && c.low > 0 ? c.low : floorPrice(c);
}

const rows = [];
let checked = null;

for (const f of (await readdir(join(ROOT, "public/data/cards"))).sort()) {
  if (!f.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
  const set = meta.get(doc.set);
  if (!set) continue;
  checked = checked || doc.checked;

  // printedTotal is the number on the card ("131/131"), so anything numbered
  // above it is a secret rare and sits outside the base set by definition.
  const official = Number(set.printedTotal) || 0;
  const tiers = { bulk: 0, base: 0, master: 0 };
  const counts = { bulk: 0, base: 0, master: 0 };
  const floors = { base: 0, master: 0 };
  let missing = 0;
  let top = null;

  for (const c of doc.cards) {
    const p = floorPrice(c);
    if (p === null) {
      missing += 1;
      continue;
    }
    const lo = listedFloor(c);
    const n = Number(String(c.n).replace(/^0+(?=\d)/, ""));
    const inBase = official > 0 && Number.isFinite(n) && n <= official;
    tiers.master += p;
    floors.master += lo;
    counts.master += 1;
    if (inBase) {
      tiers.base += p;
      floors.base += lo;
      counts.base += 1;
      if (BULK.has(c.rarity)) {
        tiers.bulk += p;
        counts.bulk += 1;
      }
    }
    // `img` rides along so the one-card section below can show the card it is
    // talking about. Skipped up front when TCGdex has no scan for it, which is
    // why the section renders a caption-only row rather than a gap.
    if (!top || p > top.price)
      top = {
        name: c.name,
        n: c.n,
        rarity: c.rarity,
        price: p,
        img: c.img && !NO_SCAN.has(c.img) ? c.img : null,
      };
  }

  rows.push({
    id: doc.set,
    name: set.name,
    released: set.released,
    total: doc.cards.length,
    official,
    ...tiers,
    counts,
    floors,
    // How far market sits above the cheapest listings on the shelf. Big on a
    // commons-heavy tier, near 1 on a tier the chase cards dominate.
    baseSpread: floors.base > 0 ? tiers.base / floors.base : 1,
    masterSpread: floors.master > 0 ? tiers.master / floors.master : 1,
    missing,
    top,
    // The single most useful derived number on the page: how much of the whole
    // bill is one card. Above about a third, "completing the set" is really
    // "buying one card", and the reader should know that before they start.
    topShare: top && tiers.master > 0 ? top.price / tiers.master : 0,
  });
}

// THE CARD COUNT BESIDE AN AVERAGE HAS TO BE AN AVERAGE TOO. These three
// sentences argue that the cost of a base set is postage rather than cards, and
// they sat next to "$65 on average, against $101 at market", which is a mean
// across all 28 sets, while the count itself was one set's: Chaos Rising's 86,
// because it happens to be the cheapest. The mean base set is closer to 136, so
// the argument understated its own case by about forty per cent while reading
// as though both numbers described the same thing.
const meanBase = Math.round(rows.reduce((n, r) => n + (r.counts?.base || 0), 0) / rows.length);

rows.sort((a, b) => a.base - b.base);

const complete = rows.filter((r) => r.missing === 0);
const cheapest = rows[0];
const priciest = rows[rows.length - 1];
const dearestMaster = rows.slice().sort((a, b) => b.master - a.master)[0];
// Sets where one card is at least a quarter of the master-set bill.
const lopsided = rows
  .filter((r) => r.topShare >= 0.25)
  .sort((a, b) => b.topShare - a.topShare);
const totalBase = rows.reduce((n, r) => n + r.base, 0);
const totalMissing = rows.reduce((n, r) => n + r.missing, 0);
const totalBaseFloor = rows.reduce((n, r) => n + r.floors.base, 0);
const totalMasterFloor = rows.reduce((n, r) => n + r.floors.master, 0);
const totalMaster = rows.reduce((n, r) => n + r.master, 0);
// The headline of the shipping section: market runs well above the cheapest
// listings on a commons-heavy base set and barely above them on a master set,
// because the master set's bill is chase cards whose cheap copies are not cheap.
//
// MEDIAN OF THE PER-SET RATIOS, not the ratio of the totals. Summing every set
// first lets the two or three priciest sets set the answer for all 23: done that
// way the base-set figure comes out 2.4x, when the per-set spreads actually run
// from 1.3x to 7.6x and the middle set is well above 2.4. The label says
// "typical set", so the number has to be the typical set.
const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const baseSpread = median(rows.map((r) => r.baseSpread));
const masterSpread = median(rows.map((r) => r.masterSpread));
const widest = rows.slice().sort((a, b) => b.baseSpread - a.baseSpread)[0];

const pct = (x) => `${Math.round(x * 100)}%`;

// ---------------------------------------------------------------------- chart
//
// THE PAGE'S OWN ARGUMENT, DRAWN. "The base set is the cheap part. The money is
// all above that line, in the secret rares" is the first thing this page says
// and the reason it exists, and it was being made with two numbers in a
// sentence and then evidenced by a 28 row, 5 column table of more numbers. The
// shape of that table is the argument, and a table does not have a shape you
// can see.
//
// So: one bar per set, base set solid, the secret rares stacked on in pale
// gold, sorted by base set exactly as the table below is. Nothing is computed
// here that the table does not already print; this reads the same `rows` and
// draws it. If the two ever disagree, this is wrong, not the table.
//
// DRAWN, NOT PHOTOGRAPHED, and not a chart library either. It is 28 rects and a
// text label, inline, so it costs no request, no script, and nothing to
// measure. The site draws its own rarity marks and its own booster wrappers for
// the same reason.
const CH_ROW = 13; // one set
const CH_LAB = 96; // room for the set name
const CH_W = 300; // viewBox units; the svg scales to whatever box it lands in
const CH_TOP = 12;
const chMax = Math.max(...rows.map((r) => r.master));
// THE SAME ORDER AS THE TABLE, cheapest first, and not reversed to put the big
// bar at the top. The caption claims the two agree, so they have to actually
// agree; a chart that is the table upside down makes a reader who checks one
// against the other think one of them is wrong.
const chartRows = rows;
const costChart = `<figure class="cc-chart">
      <svg viewBox="0 0 ${CH_W} ${CH_TOP + chartRows.length * CH_ROW + 4}" role="img"
           aria-label="One bar per set, cheapest base set first. ${esc(cheapest.name)} is the cheapest to complete at ${moneyRound(cheapest.base)} and ${esc(priciest.name)} the priciest at ${moneyRound(priciest.base)}. The longest bar is ${esc(dearestMaster.name)}, whose master set is ${moneyRound(dearestMaster.master)} against a ${moneyRound(dearestMaster.base)} base set.">
        ${chartRows
          .map((r, i) => {
            const y = CH_TOP + i * CH_ROW;
            const x0 = CH_LAB + 4;
            const span = CH_W - CH_LAB - 8;
            const wBase = Math.max(0.6, (r.base / chMax) * span);
            const wAll = Math.max(wBase, (r.master / chMax) * span);
            return `<g class="cc-ch-r">
          <text class="cc-ch-n" x="${CH_LAB}" y="${y + 8}">${esc(r.name)}</text>
          <rect class="cc-ch-all" x="${x0}" y="${y + 2}" width="${wAll.toFixed(1)}" height="8" rx="1.5"></rect>
          <rect class="cc-ch-base" x="${x0}" y="${y + 2}" width="${wBase.toFixed(1)}" height="8" rx="1.5"></rect>
        </g>`;
          })
          .join("\n        ")}
      </svg>
      <p class="cc-ch-key">
        <span><i class="base"></i>the base set</span>
        <span><i class="all"></i>what the secret rares add on top</span>
      </p>
      <figcaption>Every set below, drawn, cheapest base set first. The solid bar is the base
        set; the pale bar running past it is the whole master set, so the gap is what the
        secret rares cost. ${esc(dearestMaster.name)} is the longest one:
        ${moneyRound(dearestMaster.base)} of cards you can find in the checklist and
        ${moneyRound(dearestMaster.master - dearestMaster.base)} of cards numbered past the
        printed total. Same figures as the table, same order, drawn to the same scale.</figcaption>
    </figure>`;

/**
 * One row of "when the set IS one card", with the card in it.
 *
 * THE WHOLE ARGUMENT OF THIS SECTION IS ABOUT A SPECIFIC OBJECT and it was
 * making it in text only: "Umbreon ex is $X of a $Y master set". A reader who
 * does not already know that card cannot picture what is eating three quarters
 * of their budget, and this is the one section on the page where the thing being
 * discussed is a single card rather than an aggregate. So it gets the scan.
 *
 * ONLY low.webp, AND NO SRCSET. The box is 72px (.cs-one-img in ui.css), which
 * TCGdex's 245x337 low.webp covers at DPR2 with room over, so high.webp would be
 * roughly four times the bytes for pixels the box cannot show. A `sizes` with no
 * srcset beside it does nothing at all, so there is none: the comment in ui.css
 * carries the measurement instead. avifPicture() wraps the tag for a further
 * ~30% where AVIF is supported.
 *
 * NO SCAN, NO FIGURE. The 101 bases TCGdex does not have are already dropped
 * upstream, and a card that hits one renders as it always did rather than as a
 * gap where a picture should be. Nothing in the sentence refers to the image.
 */
const oneCard = (r) => {
  const src = r.top.img ? `${r.top.img}/low.webp` : null;
  const art = src
    ? avifPicture(
        `<img class="cs-one-img" src="${esc(src)}" alt="${esc(r.top.name)}, ${esc(
          r.name
        )} card ${esc(r.top.n || "")}" loading="lazy" decoding="async"${imgDims(src)} onerror="this.remove()">`
      )
    : "";
  return `<li class="cs-one${src ? " has-art" : ""}">
        ${art}
        <div class="cs-one-b"><strong>${esc(r.name)}.</strong> ${esc(r.top.name)} is ${moneyRound(r.top.price)} of a
        ${moneyRound(r.master)} master set, which is ${pct(r.topShare)} of it. The other ${r.counts.master - 1} cards
        come to ${moneyRound(r.master - r.top.price)} between them.</div>
      </li>`;
};
// Google cuts the snippet around 160 characters, and set names are long enough
// that the sentence has to be measured rather than assumed.
const desc = (
  `What it costs to complete every Pokemon set we cover, priced nightly. ` +
  `${cheapest.name} is the cheapest base set at ${moneyRound(cheapest.base)}, ` +
  `${priciest.name} the priciest at ${moneyRound(priciest.base)}.`
).slice(0, 160);

// The page's own stylesheet. It had none: everything here came from ui.css plus
// a handful of inline style="max-width:38em" attributes on the ledes. This
// block exists rather than a change to assets-source/ui.css because these rules
// are wanted on ONE page and ui.css is render blocking on 426 of them.
//
// THE FOUR .wNN CLASSES ARE THE INLINE ATTRIBUTES, MOVED. An inline style beats
// every stylesheet rule that is not !important, so a media query could not
// reach them. The values here are the inline values EXACTLY, so every width
// below the breakpoint renders what it rendered before and the media query is
// the only behaviour change.
//
// WHAT WAS WRONG, MEASURED AT 1440. This page fills its band: .gc-grid is four
// columns and the five column cost table is dense, and neither is touched. The
// fault was the reading measure around them. The quick facts cards ran 973px
// and set 96 characters a line with one at 140.7, the golden-rule callout ran
// 728px at 14px type for 100.3, and the ledes sat at 82.3 against a 65 to 75
// target.
//
// 50ch AND NOT 70ch. ch is the advance width of a "0", and a digit is one of
// the widest glyphs in Outfit, so a character averages about 0.7 of a ch: 50ch
// sets around 70 and 70ch would set 100. The measurement, and the first pass
// that got it backwards, are written out in build-buying.mjs.
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
/* The drawn cost chart. See the block that builds it for why it exists.
   Capped at 46em so the bars do not stretch to a metre on a wide screen: past
   that width the comparison stops getting easier to read and the labels drift
   miles from their bars. */
.cc-chart{margin:var(--s5) 0 0;max-width:46em}
.cc-chart svg{display:block;width:100%;height:auto}
.cc-ch-n{font:400 6.6px/1 var(--body);fill:var(--ink-2);text-anchor:end}
/* Pale first, solid over the top, so the two rects read as one bar with a
   darker head rather than as two bars that happen to touch. */
.cc-ch-all{fill:var(--chip-gold-bg)}
.cc-ch-base{fill:var(--ink)}
.cc-ch-key{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s4);margin-top:var(--s3);
  font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2)}
.cc-ch-key span{display:inline-flex;align-items:center;gap:6px}
.cc-ch-key i{width:22px;height:9px;border-radius:2px;flex:none}
.cc-ch-key i.base{background:var(--ink)}
.cc-ch-key i.all{background:var(--chip-gold-bg)}
.cc-chart figcaption{margin-top:var(--s3);font:400 var(--t-micro)/1.6 var(--body);
  color:var(--ink-2)}
.w34{max-width:34em}
.w38{max-width:38em}
.w40{max-width:40em}
.w42{max-width:42em}
@media(min-width:1000px){
  .w34,.w38,.w40,.w42{max-width:50ch}
  .fk-golden p{max-width:52ch}
}
/* THE QUICK FACTS GO TWO UP RATHER THAN GETTING A NARROWER CAP, and the first
   attempt did the other thing, which is worth recording because it looked
   right and measured wrong. Capping .facts-list li to 52ch brought the measure
   from 96 characters a line down to 62, and made the page 446px TALLER while
   leaving 873px of empty band beside every card. A cap fixes the measure by
   throwing the width away.

   Two columns fixes both halves: the band is full, the section loses half its
   height, and each card is 686px instead of 973px. The measure lands around 86
   rather than 70, and that is accepted here rather than chased, because these
   are two line cards rather than sustained prose: a long measure costs a reader
   when the eye has to find the start of the next line forty times in a row, and
   these cards are read in twos. Same treatment and same reasoning as the set
   guides in build-set-pages.mjs. */
@media(min-width:1200px){
  .facts-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
    gap:11px;align-items:start}
  .facts-list li{max-width:none}
}
`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Cost to complete a set", item: `${SITE}/complete-a-set.html` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does it cost to complete a Pokemon set?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `It depends enormously on the set. Across the ${rows.length} sets on this page the base set ranges from ${moneyRound(cheapest.base)} for ${cheapest.name} to ${moneyRound(priciest.base)} for ${priciest.name}, buying every card as a single at the cheapest printing and before shipping. The master set, which adds the secret rares, is several times more: ${dearestMaster.name} is ${moneyRound(dearestMaster.master)}.`,
        },
      },
      {
        "@type": "Question",
        name: "Is it cheaper to buy singles or open packs to complete a set?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `Singles, almost always, and it is not close. A base set here averages ${moneyRound(totalBase / rows.length)} bought as singles. Opening enough packs to see every card in a set costs many times that, because packs repeat commons long before they finish the checklist. Packs are for the fun of opening them; singles are for finishing a set.`,
        },
      },
      {
        "@type": "Question",
        name: "What is the difference between a base set and a master set?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `The base set is every card numbered up to the printed total, so a card that reads 131/131 is the last one. A master set adds everything numbered above that total, which is where the secret rares and most of the expensive chase cards live. That is why the two numbers are so far apart: in ${lopsided[0]?.name || "several sets"} a single card is ${pct(lopsided[0]?.topShare || 0)} of the whole master-set bill.`,
        },
      },
    ],
  },
];

const row = (r) => `<tr${r.missing ? ' class="cc-part"' : ""}>
  <th scope="row"><a href="/sets/${esc(r.id)}.html">${esc(r.name)}</a><span class="cc-yr">${esc(String(r.released).slice(0, 4))}</span></th>
  <td class="num">${moneyRound(r.bulk)}<span class="cc-n">${r.counts.bulk} cards</span></td>
  <td class="num"><strong>${moneyRound(r.base)}</strong><span class="cc-n">${r.counts.base} cards</span></td>
  <td class="num">${moneyRound(r.master)}<span class="cc-n">${r.counts.master} cards</span></td>
  <td class="cc-top">${esc(r.top?.name || "")}<span class="cc-n">${moneyRound(r.top?.price)}, ${pct(r.topShare)} of the master set</span></td>
</tr>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>What Does It Cost to Complete a Pokemon Set? Priced Nightly</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/complete-a-set.html">
<meta property="og:title" content="What does it cost to complete a set?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/complete-a-set.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-complete.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-complete.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
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
    <!-- The kicker used to read "Priced last night" and the lede called these
         "live prices". Neither is true: the totals are computed from a price
         file with a read date on it, which is stamped at the bottom of the page
         and can be two days behind a build. Say the date instead of implying
         a feed we do not run. -->
    <span class="kicker">Pokemon TCG &bull; Priced ${esc(longDate(checked) || "recently")}</span>
    <h1>What does it cost to <span class="hl">complete</span> a set?</h1>
    <p class="lede w38">Every set we cover, costed three ways, from the commons run to the full
      master set. Every figure is added up from market prices read on
      ${esc(longDate(checked) || "the date at the bottom of this page")}, not a number somebody typed into an
      article two years ago, and they get read again each night.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Cost to complete a set</p>

    <div class="facts">
      <div class="fact"><div class="n">${moneyCompact(cheapest.base)}</div><div class="l">Cheapest base set (${esc(cheapest.name)})</div></div>
      <div class="fact"><div class="n">${moneyCompact(priciest.base)}</div><div class="l">Priciest base set (${esc(priciest.name)})</div></div>
      <div class="fact"><div class="n">${moneyCompact(dearestMaster.master)}</div><div class="l">Priciest master set (${esc(dearestMaster.name)})</div></div>
      <div class="fact"><div class="n">${rows.length}</div><div class="l">Sets costed</div></div>
    </div>

    <div class="fk-golden" style="margin-top:22px">
      <p class="fk-golden-h">Read this first</p>
      <h2>The base set is the <span class="hl">cheap</span> part</h2>
      <p>Every card numbered up to the printed total, the ones that read 131/131 and below, is usually a small bill:
        ${moneyRound(cheapest.base)} to ${moneyRound(priciest.base)} across these ${rows.length} sets. The money is
        all above that line, in the secret rares. ${esc(dearestMaster.name)} is ${moneyRound(dearestMaster.base)}
        as a base set and ${moneyRound(dearestMaster.master)} as a master set. If you have been putting off
        completing a set because you assumed it ran to thousands, it is worth checking which half you actually want.</p>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Three ways to finish</p>
    <h2>What counts as <span class="hl">complete</span>?</h2>
    <p class="lede w40">The word means three different things depending who is saying it, and the
      gap between them is most of the cost. Pick the one you actually want before you start buying.</p>
    <div class="gc-grid">
      <article class="gc">
        <h3>The commons run</h3>
        <p class="gc-price">${moneyCompact(rows.reduce((n, r) => n + r.bulk, 0) / rows.length)}<span> average per set</span></p>
        <p class="gc-note">Every Common and Uncommon in the numbered set. This is the part that falls out of packs by
          the hundred, so it is nearly free to buy and nearly worthless to sell. A good first target: it is most of the
          card count and almost none of the money, and it teaches you how a checklist works.</p>
      </article>
      <article class="gc">
        <h3>The base set</h3>
        <p class="gc-price">${moneyCompact(totalBase / rows.length)}<span> average per set</span></p>
        <p class="gc-note">Every card numbered up to the printed total. This is what most people mean by completing a
          set, and it is the tier this page sorts by. It includes the rares and the double rares but stops before the
          secret rares, which is exactly where the price cliff is.</p>
      </article>
      <article class="gc">
        <h3>The master set</h3>
        <p class="gc-price">${moneyCompact(rows.reduce((n, r) => n + r.master, 0) / rows.length)}<span> average per set</span></p>
        <p class="gc-note">Everything, secret rares included. Several times the base set in every case, and in some
          sets a single card is more than a quarter of the bill on its own. Worth knowing that most master-set
          collectors also chase every reverse holo, which is a further tier again and not costed here.</p>
      </article>
    </div>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>All ${rows.length} sets</p>
    <h2>Cheapest to <span class="hl">priciest</span></h2>
    <p class="lede w40">Sorted by base set, which is the tier most people are asking about. Every
      figure buys one copy of each card at its cheapest printing, at market, before shipping.</p>
    ${costChart}
    <div class="cc-scroll" tabindex="0" role="region" aria-label="Cost to complete each set, scrollable table">
      <table class="cc-table">
        <caption class="sr-only">Cost to complete each set at three tiers, with the most expensive single card</caption>
        <thead>
          <tr>
            <th scope="col">Set</th>
            <th scope="col" class="num">Commons run</th>
            <th scope="col" class="num">Base set</th>
            <th scope="col" class="num">Master set</th>
            <th scope="col">Priciest single card</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row).join("\n          ")}
        </tbody>
      </table>
    </div>
    ${
      totalMissing
        ? `<p class="price-note">Rows marked with a dotted rule are missing prices on ${totalMissing} card${totalMissing === 1 ? "" : "s"} between them, so those totals are a little low. ${complete.length} of the ${rows.length} sets are priced in full.</p>`
        : ""
    }
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The one card problem</p>
    <h2>When the set <span class="hl">is</span> one card</h2>
    <p class="lede w40">In ${lopsided.length} of these ${rows.length} sets, a single card is at least
      a quarter of the entire master-set bill. Completing those sets is not really a grind, it is one purchase with a
      long tail attached, and it is worth seeing that number before you decide the set is out of reach.</p>
    <ul class="cs-ones">
      ${lopsided.map(oneCard).join("\n      ")}
    </ul>
    <p class="price-note">Card scans are TCGdex's, and each one is the card named beside it. TCGdex
      publishes one scan per card number, so a card counted here at its reverse holo price is still
      shown in the artwork both printings share.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Two different prices</p>
    <h2>The cards are nearly free. The <span class="hl">postage</span> is not.</h2>
    <p class="lede w40">Every figure above is market price, meaning what copies have actually been
      selling for. There is a second number worth knowing: the cheapest copy listed right now. On the cards that make
      up a base set those two are miles apart, and on the cards that make up a master set they are almost the same.</p>
    <div class="facts">
      <div class="fact"><div class="n">${baseSpread.toFixed(1)}x</div><div class="l">Typical set: market above cheapest listings, base set</div></div>
      <div class="fact"><div class="n">${masterSpread.toFixed(1)}x</div><div class="l">Typical set: the same comparison, master set</div></div>
      <div class="fact wide"><div class="n">${moneyRound(totalBaseFloor / rows.length)}</div><div class="l">Average base set at cheapest listings, before postage</div></div>
    </div>

    <p class="w40" style="margin-top:16px">The reason is that a three cent common's cheapest copy is a penny, while
      a ${moneyRound(dearestMaster.top.price)} chase card's cheapest copy is close to what it sells for. So the money in
      a base set is not really in the cards, it is in getting ${meanBase} of them into one envelope.
      ${esc(widest.name)} is the extreme case: ${moneyRound(widest.base)} at market against
      ${moneyRound(widest.floors.base)} in cheapest listings, a ${widest.baseSpread.toFixed(1)}x gap.</p>
    <p class="price-note">We do not publish the cheapest-listing total as a set price, because it is not one. Those are
      single listings from ${meanBase} different sellers in unstated condition, so nobody can actually buy a
      set at that number. It is here to show you where the real cost sits, which is postage and patience rather than
      the cards.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <h2>How this was <span class="hl">worked out</span></h2>
    <ul class="facts-list">
      <li><strong>Cheapest printing, every time.</strong> A card that exists as a normal and a reverse holo is counted
        at whichever is cheaper, because that is what somebody finishing a set would buy. It makes these totals lower
        than the price the same card shows on our card pages, which quote a specific printing.</li>
      <li><strong>Before shipping, and on a base set that is the whole bill.</strong> Singles come from many sellers, so
        a real completion pays postage over and over. Add up the cheapest listing for every card in a base set and it
        comes to ${moneyRound(totalBaseFloor / rows.length)} on average, against ${moneyRound(totalBase / rows.length)}
        at market. The cards are close to free. What you are actually buying is ${meanBase} separate
        envelopes, which is why people do this in bulk lots from one seller and not one card at a time.</li>
      <li><strong>Market price, not the price you will pay, and it cuts both ways.</strong> Market is what copies have
        been selling for. Some cards can be had below it right now from somebody clearing stock, and some cannot be had
        at all, because the cheap commons in any set are often listed by nobody. So this is a middle estimate rather
        than a floor or a ceiling: expect to beat it on the cards everyone has and to pay over it on the last few.</li>
      <li><strong>Reverse holos are not costed.</strong> A full reverse-holo run is a separate tier again, and it is
        a big one. The master-set figures here are one copy of each card number, not one of each printing.</li>
      <li><strong>No pull rates, no pack math.</strong> We have not costed "how many packs to complete this", because
        it would need pull rates we do not have. Anyone quoting you that number is estimating.</li>
    </ul>
    <p class="price-note">Prices are TCGplayer market via TCGdex, read ${esc(longDate(checked) || checked || "recently")},
      and refresh on their own overnight. Card counts are the published checklists. Totals are computed from those two
      things and nothing else: no estimates, no rounding up to a nicer number. No affiliate links, and nothing here is
      a recommendation to buy anything.</p>
  </div>
</section>

</main>
${/* NOT "a floor". The methodology section two paragraphs up says in as many
      words that these are "a middle estimate rather than a floor or a ceiling",
      so the footer was contradicting the page it sits under. */ ""}
${footer("Prices move daily. These totals are a middle estimate, not a quote.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/complete-a-set.html"), page);
console.log(`Wrote public/complete-a-set.html
  ${rows.length} sets costed, ${complete.length} priced in full, ${totalMissing} cards unpriced
  cheapest base ${cheapest.name} ${moneyExact(cheapest.base)}, priciest ${priciest.name} ${moneyExact(priciest.base)}
  priciest master ${dearestMaster.name} ${moneyExact(dearestMaster.master)}
  ${lopsided.length} sets where one card is 25%+ of the master set`);
