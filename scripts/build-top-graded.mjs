#!/usr/bin/env node
// Generate /top-graded.html: the highest PSA 10 values in Pokemon.
//
//   node scripts/build-top-graded.mjs
//
// Reads data/top-graded.json (written by sync-graded-top.mjs, then stamped by
// verify-graded-top.mjs). The full research trail is in data/top-graded-PLAN.md
// and it is worth reading before touching any of this.
//
// THE TITLE IS THE CLAIM AND IT IS DELIBERATELY NARROW.
// This is NOT "the 100 most valuable graded Pokemon cards". That sentence has
// no single meaning: the highest public auction sale, the price guide value at
// a grade, the current asking price and the population-adjusted scarcity give
// four different lists, and only one of them could be sourced.
//
// The auction-record version is the better page and it CANNOT BE BUILT from
// here. PSA's price guide and auction-prices database both answer 403 behind
// Cloudflare, Heritage answers 403 with a CAPTCHA, and Goldin serves a
// JavaScript shell with zero price strings in the HTML. Those gates were not
// worked around and must not be. So the page states the measurement it does
// have, in its title, in its H1 and in a box above the list.
//
// WHAT IT SHOWS is PriceCharting's PSA 10 column: a price guide value computed
// from completed eBay sales and their own marketplace. The page says that, says
// when it was read, says prices move, and carries the source path on every
// single row so any one of the hundred can be checked on its own.
//
// EVERY NUMBER IS READ TWICE. verify-graded-top.mjs re-reads each published
// figure from the product page, a different template with different columns,
// mapping by <th> label. This build HARD FAILS without a verification stamped
// for the current crawl, because the one trap that would otherwise ship silently
// is a column mix-up: `new_price` is PSA 10 on a listing page and Grade 8 on a
// product page, which on Base Set Charizard is $28,144 against $1,330.
//
// IMAGES COME FROM THE SAME PRODUCT RECORD AS THE PRICE, on purpose. Matching
// these cards to TCGdex would give smaller AVIF files and free intrinsic sizes,
// and it would also reintroduce the exact failure data/graded.json warns about:
// 4 of 12 name-only lookups landed on a DIFFERENT PRINTING of the right card.
// Half this list is 1st Edition, Shadowless, Gold Star and Japanese promo
// printings, which is precisely where that goes wrong, and a picture of the
// wrong printing beside a $300,000 figure is a worse page than a plainer scan.
// Same product id for the number and the picture means they cannot disagree.
//
// Those images are ~12KB each at 240px (measured; the cap is 200KB and the
// whole site is under it). They are a FIXED HEIGHT and a VARIABLE WIDTH,
// 169-174px at h=240, exactly like tcgplayer-cdn, so imgDims() correctly
// returns "" for them and they sit in a fixed CSS box with object-fit.
// avifPicture() likewise passes them through untouched: it only rewrites
// TCGdex WebP urls, and a <source> pointing at an AVIF that does not exist is
// worse than no <source> at all.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { esc, longDate, shortDate, moneyCompact, imgDims, avifPicture, noValue } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/top-graded.json"), "utf8"));

// ---------------------------------------------------------------------------
// GATES. All three are hard failures rather than warnings, because every one of
// them is a way this page could publish a number nobody can stand behind.
if (!d.verify) {
  throw new Error(
    "data/top-graded.json has no `verify` block.\n" +
      "Run: node scripts/verify-graded-top.mjs\n" +
      "Nothing here is publishable on a single read: see the column mix-up in " +
      "data/top-graded-PLAN.md, trap 4.",
  );
}
if (d.verify.for !== d.checked) {
  throw new Error(
    `verification is stale: it was stamped for a crawl of ${d.verify.for} and ` +
      `the data is from ${d.checked}. Re-run scripts/verify-graded-top.mjs.`,
  );
}
if (d.verify.disagree > 0) {
  throw new Error(
    `${d.verify.disagree} row(s) disagree between the listing page and the ` +
      `product page. Fix the parse or drop them; do not publish either number.`,
  );
}

// Rows that verified, in rank order. A row the verifier could not read is NOT
// published: an unreadable second source is not a confirmation, and this page's
// whole argument is that the figure was read twice.
const okRank = new Map(d.verify.rows.map((r) => [r.rank, r]));
const rows = d.cards
  .filter((c) => okRank.get(c.rank)?.status === "agree")
  .slice(0, 100);

const WANT = 100;
const short = rows.length < WANT;

const read = longDate(d.checked);
const readShort = shortDate(d.checked);
const top = rows[0];
const floor = rows[rows.length - 1];

// The source path, minus the host, which is stated once above the list. Kept
// per row because "where the number came from" has to be checkable for THIS
// row, not for the page as a whole.
const pathOf = (c) => c.url.replace(/^https?:\/\/(www\.)?pricecharting\.com/, "");

const desc =
  `The ${rows.length} highest PSA 10 values in Pokemon, ranked from PriceCharting's ` +
  `price guide and read on ${readShort}. Every row shows the source and the date. Prices move.`;

function row(c, i) {
  const v = okRank.get(c.rank);
  // A row whose scan 404s says so in words. A navy placeholder box on this site
  // once read as a real card face, so there is no placeholder: there is a
  // sentence admitting the picture is missing.
  // The listing gives a 60px thumb; 240 is the same file at the size this box
  // actually paints (~12KB, measured). imgDims and avifPicture are both called
  // on the url that is really used rather than on the one in the data, and both
  // correctly decline: this host is not TCGdex, so there is no AVIF to offer,
  // and its scans are a variable width, so there is no honest size to declare.
  const src = c.pcImg ? c.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg") : null;
  const img = v.imgOk && src
    ? avifPicture(
        `<img class="tg-scan" src="${esc(src)}" alt="${esc(c.name)}, ${esc(c.set)}"` +
          `${imgDims(src)} loading="lazy" decoding="async">`,
      )
    : `<span class="tg-noscan">No scan<span class="sr-only"> available for this card</span></span>`;

  return `<li class="tg-row">
  <span class="tg-rank" aria-hidden="true">${i + 1}</span>
  <span class="sr-only">Number ${i + 1}.</span>
  <span class="tg-art">${img}</span>
  <span class="tg-body">
    <span class="tg-name">${esc(c.name)}</span>
    <span class="tg-set">${esc(c.set)}</span>
    <span class="tg-prices">
      <span class="tg-psa"><b>${moneyCompact(c.psa10)}</b> <span class="tg-t">PSA 10</span></span>
      <span class="tg-other">${
        c.g9 ? `${moneyCompact(c.g9)} <span class="tg-t">Grade 9</span>` : noValue("No Grade 9 value recorded", "tg-na")
      }</span>
      <span class="tg-other">${
        c.ungraded ? `${moneyCompact(c.ungraded)} <span class="tg-t">Ungraded</span>` : noValue("No ungraded value recorded", "tg-na")
      }</span>
    </span>
    <span class="tg-src">${esc(pathOf(c))} <span class="tg-t">read ${esc(readShort)}</span></span>
  </span>
</li>`;
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>The ${rows.length} Highest PSA 10 Values in Pokemon | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/top-graded.html">
<meta property="og:title" content="The ${rows.length} highest PSA 10 values in Pokemon">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/top-graded.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-top-graded.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-top-graded.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>
/* This page's own block rather than ui.css: ui.css is render blocking on all
   427 pages and this is the only page with a ranked graded-price list. */

/* THE ROW IS A GRID, NOT A TABLE. It is one card per row with four facts, and
   a real <table> would force the three prices into three columns that are
   empty for most rows and unreadable at 390px. The rank and the scan are fixed
   columns; everything else is one flexible column that wraps inside itself. */
.tg-list{list-style:none;margin:20px 0 0;padding:0;border-top:1px solid var(--hair)}
.tg-row{display:grid;grid-template-columns:2.4em 64px 1fr;gap:12px;align-items:start;
  padding:14px 0;border-bottom:1px solid var(--hair)}
.tg-rank{font-family:"Space Mono",ui-monospace,monospace;font-size:15px;font-weight:700;
  color:var(--ink-2);text-align:right;padding-top:2px;font-variant-numeric:tabular-nums}
.tg-art{width:64px;height:90px;display:flex;align-items:center;justify-content:center;
  background:var(--paper-3);border:1px solid var(--hair);border-radius:3px;overflow:hidden}
/* Fixed box, object-fit, and NO width/height on the img. These scans are a
   fixed 240 HIGH and a variable 169-174 WIDE, so a declared width is wrong for
   most of them by up to 3%. Same treatment tcgplayer-cdn already gets. */
.tg-scan{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
.tg-noscan{font-family:"Space Mono",ui-monospace,monospace;font-size:10px;
  color:var(--ink-2);text-align:center;line-height:1.3;padding:4px}
.tg-body{min-width:0}
.tg-name{display:block;font-weight:700;line-height:1.25}
.tg-set{display:block;color:var(--ink-2);font-size:14px;margin-top:1px}
.tg-prices{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:7px;align-items:baseline}
.tg-psa b{font-size:19px;font-variant-numeric:tabular-nums}
.tg-other{color:var(--ink-2);font-size:14px;font-variant-numeric:tabular-nums}
/* The unit label. Small, muted, and never the same weight as the figure: the
   number is the fact and the tier is the caption. */
.tg-t{font-family:"Space Mono",ui-monospace,monospace;font-size:10px;
  text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2)}
.tg-na{color:var(--ink-2)}
/* THE PROVENANCE LINE. Plain text, never a link: every click stays on the site
   and 100 outbound links would be the largest exception on it by a factor of
   twenty-five. The path is enough to find the record, and it is per row rather
   than per page because that is what makes an individual figure checkable.
   MEASURED IN REAL CHARACTERS, not in ch units: a ch is the advance width of a
   "0", about 1.43 average characters in this face, so it measures nothing
   useful here and is used nowhere in this file. Counted over the published 100:
   the median source path is 51 characters and the longest is 98, the Japanese
   Offense and Defense of the Furthest Ends Charizard Gold Star. With the read
   date appended that worst case is 116 characters, which is why this rule sets
   word-break rather than trusting it to fit. Checked at 390x844 DPR 2: it wraps
   to three lines and the page's scrollWidth is still exactly 390, so nothing
   here pushes the document sideways. */
.tg-src{display:block;margin-top:6px;font-family:"Space Mono",ui-monospace,monospace;
  font-size:11px;line-height:1.45;color:var(--ink-2);word-break:break-word}

@media (min-width:560px){
  .tg-row{grid-template-columns:3em 84px 1fr;gap:16px;padding:16px 0}
  .tg-art{width:84px;height:118px}
  .tg-rank{font-size:17px}
  .tg-name{font-size:18px}
}
/* Desktop puts the prices in their own column instead of under the name, so the
   eye can run down the PSA 10 figures without the set names in the way. Right
   aligned and tabular so the digits line up as a column of money.

   THE SPLIT IS A NESTED GRID ON .tg-body, NOT A FOURTH COLUMN ON .tg-row, and
   the first attempt was the fourth column. That was wrong twice over: the row
   emits only three children, so column four was never filled and simply held
   210px of empty page against the right edge, and grid-column:4 on .tg-prices
   did nothing at all because .tg-prices is a child of .tg-body and not a grid
   item of .tg-row. The prices looked right-aligned only because they were
   right-aligned INSIDE column three.

   Grid AREAS rather than reordered markup, so the DOM order is untouched:
   name, set, prices, source is the right reading order on a phone and the right
   order for a screen reader at every width, and only the painting changes. */
@media (min-width:900px){
  .tg-row{grid-template-columns:3em 100px 1fr;align-items:center}
  .tg-art{width:100px;height:140px}
  .tg-body{display:grid;column-gap:24px;
    grid-template-columns:1fr minmax(190px,auto);
    grid-template-areas:"name prices" "set prices" "src prices"}
  .tg-name{grid-area:name}
  .tg-set{grid-area:set}
  .tg-src{grid-area:src;align-self:end}
  .tg-prices{grid-area:prices;margin-top:0;align-self:center;
    flex-direction:column;align-items:flex-end;gap:2px;text-align:right}
  .tg-psa b{font-size:22px}
}
</style>
</head>
<body>
${SKIP}
${SPRITE}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Read ${esc(read)}</span>
    <h1>The ${rows.length} highest <span class="hl">PSA 10</span> values in Pokemon</h1>
    <p class="lede" style="max-width:40em">Every set, every era, promos and trophy cards included. Ranked by
      one measurement and one only: what PriceCharting's price guide says a copy graded PSA 10 is worth.
      Read on ${esc(read)}. These move, so treat the order as a snapshot rather than a league table.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Top PSA 10 values</p>

    <div class="fk-golden">
      <p class="fk-golden-h">What this number is, and what it is not</p>
      <h2>A price guide value, not an <span class="hl">auction record</span></h2>
      <p>Every figure here is PriceCharting's PSA 10 column. Their published method computes it from
        completed eBay sales plus their own marketplace, blending the most recent sale, the median, the
        average and an age weighted average, with outliers and sale dates taken into account. Shipping is
        excluded. It is an estimate of what a PSA 10 copy is worth right now.</p>
      <p>It is <b>not</b> a record of any single sale. Those are different numbers and they are often far
        apart: the Illustrator Pikachu at the top of this list has a widely reported 2022 auction sale of
        about $5.3 million against the ${moneyCompact(top?.psa10)} guide value shown here. If you want
        hammer prices from a specific auction, this page is not that, and the reason is below.</p>
    </div>

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${moneyCompact(top?.psa10)}</div><div class="l">Top of the list</div></div>
      <div class="fact"><div class="n">${moneyCompact(floor?.psa10)}</div><div class="l">Number ${rows.length}</div></div>
      <div class="fact"><div class="n">${d.scanned.products.toLocaleString("en-US")}</div><div class="l">Cards ranked</div></div>
      <div class="fact"><div class="n">${d.scanned.consoles}</div><div class="l">Sets searched</div></div>
    </div>

    <p class="lede" style="max-width:44em;margin-top:20px">Ranked out of
      <b>${d.scanned.products.toLocaleString("en-US")}</b> Pokemon cards across
      <b>${d.scanned.consoles}</b> sets, of which
      <b>${d.scanned.productsWithPsa10.toLocaleString("en-US")}</b> had a PSA 10 value at all. Each row was
      read twice, once from the set listing and once from the card's own page, and
      <b>${d.verify.agree}</b> of ${d.verify.checked} checked agreed. Paths below are all on pricecharting.com.</p>

    ${short ? `<div class="fk-golden" style="margin-top:20px">
      <p class="fk-golden-h">Short list, on purpose</p>
      <h2>${rows.length} rows, not ${WANT}</h2>
      <p>Only ${rows.length} rows could be confirmed against a second source on this run. The rest are held
        back rather than padded out. A well sourced ${rows.length} is worth more than a hundred that includes
        figures nobody checked.</p>
    </div>` : ""}

    <ol class="tg-list">
${rows.map(row).join("\n")}
    </ol>

    <h2 style="margin-top:34px">What this list cannot tell you</h2>

    <p><b>It is not the hundred biggest Pokemon card sales ever.</b> That list would need auction results,
      and the places that publish them would not answer. PSA's price guide and its auction prices database
      both returned 403 behind a bot check, Heritage returned 403 with a CAPTCHA, and Goldin served a page
      whose entire visible content was a request to enable JavaScript, with no prices in it anywhere. Those
      are gates, and going around a gate is not something this site does. So the honest move was to change
      the question to one that could be answered and say so in the title.</p>

    <p><b>Some of the rarest cards in Pokemon are missing, and their absence is the data working.</b>
      PriceCharting prices from completed sales, so a card that has not sold in a PSA 10 recently has no
      value in that column and cannot be ranked by it. The Trophy Pikachu golds, No. 1 Trainer: Champion
      Road and Master's Key all sit in that state. They are not oversights and they were not quietly filled
      in from somewhere else.</p>

    <p><b>A guide value is an average, and the top of this list is thin.</b> The further up you go the fewer
      sales there are behind each figure, so the numbers at the very top rest on far less evidence than the
      ones at the bottom. Two copies of the same card in the same grade can still trade a long way apart.</p>

    <p><b>Prices move and this page does not.</b> Everything here was read on ${esc(read)} and is frozen at
      that. Nothing on this page updates overnight.</p>

    <h2 style="margin-top:30px">Where all of this came from</h2>
    <p>Prices and card images: <b>pricecharting.com</b>, read ${esc(read)}, methodology published at
      their /page/methodology. Every row carries its own path on that site, so any single figure can be
      looked up on its own rather than taken on trust. Thanks to them for publishing it openly.</p>
    <p>Card images are the property of their respective owners and appear here for identification.
      Pokemon and all card artwork are trademarks of The Pokemon Company, Nintendo, Game Freak and
      Creatures Inc.</p>
  </div>
</section>

</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/top-graded.html"), page);
console.log(
  `Wrote public/top-graded.html: ${rows.length} rows, ` +
    `${rows.filter((c) => okRank.get(c.rank).imgOk).length} with a scan, ` +
    `top ${moneyCompact(top?.psa10)}, floor ${moneyCompact(floor?.psa10)}`,
);
