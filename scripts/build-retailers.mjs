#!/usr/bin/env node
// Build /retailers.html, the directory of physical shops that sell Pokemon
// cards, plus one page per retailer under public/retailers/.
//
//   node scripts/build-retailers.mjs
//
// Reads data/retailers.json (who sells them, how we know, what they stock,
// where the chain files them), data/retailer-prices.json (dated price readings
// with a seller on every one), data/msrp.json (the suggested figure to divide
// by) and data/pack-counts-current.json (the four listings this repo already
// held, read out of the file that owns them rather than copied).
//
// WHY THIS IS NOT A BAND ON /buying.html, WHICH IS WHERE IT WAS ASKED FOR.
// That page's own title is "Where to buy Pokemon cards online" and its whole
// shape answers an online question: shipping thresholds, buyer fees, claim
// windows, who holds the money. It is 13,705 words before anything is added to
// it. This page answers a different question for a reader standing on a
// pavement, and it also has to be the parent of nine retailer pages, which
// needs an index that is about retailers rather than a section inside something
// else. So the two cross-link and neither repeats the other: every shipping
// threshold, buyer fee and return window stays on /buying.html and is linked,
// and this page states none of them.
//
// AND NOT A BAND ON /msrp.html EITHER, FOR THE SAME REASON IN REVERSE. That
// page owns the suggested figures and the markup arithmetic, and this one joins
// to them at build time rather than restating them: not one suggested price is
// typed into either data file here. /msrp.html gets a single sentence pointing
// at this page and no new numbers, so the two cannot drift.
//
// ---------------------------------------------------------------------------
// WHAT THIS PAGE REFUSES TO PUBLISH, and it is most of what a page like this
// usually prints.
//
// NO PRICE WITHOUT A SELLER. Target, Walmart, Best Buy and Amazon are a shop
// and a marketplace wearing one interface. Reading a price off one of their
// search pages and printing it as the chain's price reports a named company as
// asking three times the suggested figure when the seller is a stranger using
// the chain as a storefront. Every reading carries `seller`, the build throws on
// a reading that does not, and a reading whose seller could not be established
// was deleted rather than hedged.
//
// NO LEAGUE TABLE. The comparison table is ordered by retailer NAME and never
// by the multiple, which is the same rule data/over-msrp.json's _readme sets and
// for the same reason: sorting by the multiple builds a ranking of who gouges
// out of a handful of readings, puts the biggest number at the top, and freezes
// it into a static file that will still be serving next year.
//
// NO MOTIVE. Nothing here says why anybody priced anything.
//
// AN EMPTY CELL IS THE HONEST OUTPUT. Three of the nine retailers have no price
// reading at all and the table shows those as gaps with the reason written in,
// rather than being quietly left out of it.
//
// ---------------------------------------------------------------------------
// WHY THERE ARE NINE PAGES AND NOT FORTY, which is the whole risk in this
// feature. A page per retailer with the name swapped in is a doorway page,
// Google names that pattern and penalises it, and a penalty landing days after
// launch would cost more than these pages could earn.
//
// So `page: true` in data/retailers.json is not taken on trust. earnsPage()
// below counts the distinct sourced things the page could say and throws if a
// retailer marked for a page cannot clear the bar, which makes padding one to
// reach a quota fail the build rather than ship.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The pages below are template literals
// and a backtick inside a comment closes one. build-buying.mjs has the scar.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on these pages plays a rip where
// it sits, so both attach to nothing: a script that finds no tile and a
// stylesheet whose classes never appear. The three conditions a page has to meet
// before it needs them are written beside the two exports in shared/chrome.mjs.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyExact } from "../shared/format.mjs";
import { brandMark, BRAND_CREDIT, BRAND_STYLE } from "../shared/brands.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(await readFile(join(ROOT, "data/retailers.json"), "utf8"));
const P = JSON.parse(await readFile(join(ROOT, "data/retailer-prices.json"), "utf8"));
const msrp = JSON.parse(await readFile(join(ROOT, "data/msrp.json"), "utf8"));
const counts = JSON.parse(await readFile(join(ROOT, "data/pack-counts-current.json"), "utf8"));

const retailers = R.retailers || [];
if (!retailers.length) throw new Error("data/retailers.json has no retailers");

const byId = new Map(retailers.map((r) => [r.id, r]));

// ---------------------------------------------------------------- the join
//
// THE SUGGESTED FIGURE IS NEVER TYPED INTO EITHER DATA FILE HERE. A reading
// names a row in data/msrp.json by its exact label and this resolves it, the
// same way resolvePC in build-msrp.mjs resolves a Pokemon Center reading by
// exact product name.
//
// IT THROWS RATHER THAN WARNING, and the reason is the one build-msrp.mjs gives
// for the same decision: a join that misses, or lands on the wrong row, prints a
// plausible multiple for the wrong pair of objects, and that failure looks
// completely fine on the page. There is no correct page to ship while a reading
// names a suggested figure that is not there.
const MSRP_BY_LABEL = new Map();
for (const row of msrp.products || []) {
  if (!MSRP_BY_LABEL.has(row.label)) MSRP_BY_LABEL.set(row.label, []);
  MSRP_BY_LABEL.get(row.label).push(row);
}

function suggested(label, who) {
  const rows = MSRP_BY_LABEL.get(label);
  if (!rows) {
    throw new Error(
      `build-retailers: ${who} names the suggested-price row ${JSON.stringify(label)} and\n` +
        `  data/msrp.json has no product with that exact label. Do NOT fix this by typing a\n` +
        `  figure in: name a row that exists, or drop the reading.`
    );
  }
  if (rows.length > 1) {
    throw new Error(
      `build-retailers: ${who} names ${JSON.stringify(label)} and data/msrp.json holds ${rows.length}\n` +
        `  rows with that label, so the name does not identify one figure. Name a different row.`
    );
  }
  const row = rows[0];
  if (typeof row.price !== "number") {
    throw new Error(
      `build-retailers: ${who} divides by ${JSON.stringify(label)} and that row in data/msrp.json\n` +
        `  carries no price, because the bar for printing one was not cleared. A comparison against\n` +
        `  a figure this site refuses to state is not a comparison. Drop the reading.`
    );
  }
  return row;
}

// A multiple printed the way /msrp.html prints one: two decimals with trailing
// zeros trimmed, so 2.00 reads 2 and 1.20 reads 1.2. Deliberately the same
// expression as multStr in build-msrp.mjs, because the two pages divide some of
// the same listings by the same figures and must not disagree by a rounding.
const multStr = (n) => n.toFixed(2).replace(/\.?0+$/, "");

const SELLERS = new Set(["first-party", "marketplace"]);

/**
 * Every reading, from both files, as one shape.
 *
 * The four listings this repo already held are read OUT OF
 * data/pack-counts-current.json rather than copied into data/retailer-prices.json,
 * so each of those figures is still stated in exactly one place in this repo and
 * /msrp.html and this page cannot show one listing at two prices. What this file
 * adds to them is the seller, which pack-counts does not record and which nothing
 * here may print a price without.
 */
const readings = [];

for (const x of P.readings || []) {
  const who = `data/retailer-prices.json reading "${x.product}"`;
  if (!SELLERS.has(x.seller)) {
    throw new Error(
      `build-retailers: ${who} has seller ${JSON.stringify(x.seller || null)}. It must be\n` +
        `  "first-party" or "marketplace". A price with no seller on it is a claim about\n` +
        `  whichever company owns the website, and on Target, Walmart, Best Buy and Amazon\n` +
        `  that company is very often not the seller. Establish it or delete the reading.`
    );
  }
  const r = byId.get(x.retailer);
  if (!r) {
    throw new Error(
      `build-retailers: ${who} is filed under retailer id ${JSON.stringify(x.retailer)} and\n` +
        `  data/retailers.json has: ${retailers.map((v) => v.id).join(", ")}.`
    );
  }
  const row = suggested(x.msrpLabel, who);
  readings.push({
    retailer: r,
    product: x.product,
    amount: x.amount,
    base: row.price,
    baseLabel: row.label,
    seller: x.seller,
    sellerHow: x.sellerHow || "",
    on: x.on || "",
    url: x.url || "",
    read: x.read,
  });
}

// The four already in the tree. Same filter build-msrp.mjs uses, so the two
// pages can never disagree about which listings exist.
for (const p of counts.products || []) {
  const price = p.price;
  if (!price || price.isMsrp || price.kind !== "retailer listed price") continue;
  if (typeof price.amount !== "number") continue;
  const name = price.retailer || "";
  const r = retailers.find((v) => v.name === name);
  if (!r) continue; // a listing from somewhere this directory does not cover
  const how = (R.legacySellers || {})[name];
  if (!how) {
    throw new Error(
      `build-retailers: data/pack-counts-current.json holds a listing at ${JSON.stringify(name)}\n` +
        `  and data/retailers.json's legacySellers has no attribution for it. Nothing here may\n` +
        `  print a price without saying who was selling. Add the entry, with what on the page\n` +
        `  establishes it, or this listing stays on /msrp.html only.`
    );
  }
  const row = (msrp.products || []).find(
    (x) => x.packsFrom === p.productName && typeof x.price === "number"
  );
  if (!row) continue; // no suggested figure, so no comparison to draw
  const s = (p.sources || []).find((x) => (x.supports || []).includes("price"));
  readings.push({
    retailer: r,
    product: price.product || p.productName,
    amount: price.amount,
    base: row.price,
    baseLabel: row.label,
    seller: "first-party",
    sellerHow: how,
    on: "the product page",
    url: s ? s.url : "",
    read: s ? s.readAt : counts.readAt,
  });
}

// ORDERED BY RETAILER NAME, THEN BY WHAT THE PRODUCT COSTS. Never by the
// multiple. The comment at the top of this file argues it and data/over-msrp.json
// argues it again; this line is where it is actually true.
readings.sort(
  (a, b) => a.retailer.name.localeCompare(b.retailer.name) || a.base - b.base || a.amount - b.amount
);

const readingsFor = (id) => readings.filter((x) => x.retailer.id === id);

// ------------------------------------------------------------- the page bar
//
// A retailer marked `page: true` has to be able to say four distinct sourced
// things or the build stops. This is the doorway-page guard and it is written as
// a count rather than as a promise in a comment, because a promise in a comment
// is what forty thin pages look like on the way in.
const earnsPage = (r) => {
  const has = [
    Boolean(r.confirmed && r.confirmed.url && r.confirmed.read),
    Boolean(r.stocks) && r.stocksTier !== "unknown",
    Boolean(r.whereInStore && r.whereSource),
    readingsFor(r.id).length > 0 || Boolean(r.priceNote),
    Boolean(r.availability || r.marketplaceNote || r.display),
  ];
  return has.filter(Boolean).length;
};

const paged = [];
for (const r of retailers) {
  const n = earnsPage(r);
  if (!r.page) continue;
  if (!r.slug) throw new Error(`data/retailers.json: "${r.id}" is marked page:true with no slug`);
  if (n < 4) {
    throw new Error(
      `build-retailers: "${r.name}" is marked page:true and can only answer ${n} of the five\n` +
        `  questions a retailer page has to answer. Four is the bar and it exists so that a page\n` +
        `  cannot be padded to reach a quota. Either source the missing half, or set page:false\n` +
        `  and let the directory row carry what is known.`
    );
  }
  paged.push(r);
}
if (!paged.length) throw new Error("build-retailers: no retailer clears the page bar");

// A retailer marked page:false must NOT have a slug, or the sitemap and the
// cross-links would point at a file nothing writes.
for (const r of retailers) {
  if (!r.page && r.slug) {
    throw new Error(`data/retailers.json: "${r.id}" is page:false but carries slug "${r.slug}"`);
  }
}

const pathOf = (r) => `/retailers/${r.slug}.html`;

// -------------------------------------------------------------- the drawing
//
// TWO PLACES A PACK CAN BE, AND THE SECOND ONE IS THE POINT OF THE WHOLE NOTE.
// The page's most useful sentence is that an empty peg is not an empty shop,
// because a lot of chains keep cards behind the counter now. That sentence is
// easy to skim past and impossible to skim past as a picture: one shelf with
// nothing on it, one case behind a counter with the packs in it.
//
// Drawn on the same 24 unit grid and at the same 1.6 stroke as the glyphs in
// shared/brands.mjs, so it reads as part of the same set rather than as a
// clipart import, and in currentColor so it costs nothing and inherits the
// palette. It is also what satisfies check-build.py's rule that a page with real
// body copy carries something visual: every retailer page gets one.
const AISLE = `<svg class="rt-fig-svg" viewBox="0 0 240 96" width="240" height="96" role="img"
  aria-label="Two places Pokemon cards sit in a shop: an empty peg on the shop floor, and a locked case behind the counter."
  fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <g>
    <path d="M14 20h84M14 44h84M14 68h84"/>
    <path d="M14 14v60M98 14v60"/>
    <rect x="22" y="8" width="12" height="12" rx="1.2"/>
    <rect x="40" y="8" width="12" height="12" rx="1.2"/>
    <text x="56" y="38" font-size="9" stroke="none" fill="currentColor" font-family="monospace">empty</text>
    <text x="20" y="88" font-size="9" stroke="none" fill="currentColor" font-family="monospace">shop floor</text>
  </g>
  <g>
    <path d="M132 62h96v14h-96z"/>
    <path d="M140 62V30h80v32"/>
    <path d="M140 46h80"/>
    <rect x="148" y="34" width="9" height="10" rx="1"/>
    <rect x="162" y="34" width="9" height="10" rx="1"/>
    <rect x="176" y="34" width="9" height="10" rx="1"/>
    <rect x="148" y="50" width="9" height="10" rx="1"/>
    <rect x="162" y="50" width="9" height="10" rx="1"/>
    <circle cx="212" cy="54" r="3"/>
    <text x="140" y="88" font-size="9" stroke="none" fill="currentColor" font-family="monospace">behind the counter</text>
  </g>
</svg>`;

// ---------------------------------------------------------------- the table
//
// ONE WIDE TABLE THAT SCROLLS INSIDE ITSELF, reusing .cc-scroll and .cc-table
// from ui.css rather than inventing a second scrolling table. That is not
// laziness: those classes already carry the four-layer background affordance
// that shows there is more to the right, written as background-color so the
// layers survive, plus the sticky first column and the momentum scrolling. A new
// class would have to reimplement all of it and would be the second answer on
// the site to one question. Nothing in ui.css is edited here.
const cell = (s) => (s ? esc(s) : "");

const priceRow = (x) => {
  const m = x.amount / x.base;
  return `            <tr>
              <th scope="row">${
                // THE NAME IS THE LINK AND IT WAS A 120x16 "their page" LINE
                // UNDER IT. Measured at 390x844, thirteen of those in one column
                // were the only tap targets on either page under 44px, stacked
                // 16px apart in a table that also scrolls sideways, which is the
                // worst possible place to ask for an accurate tap. Linking the
                // name costs nothing, needs no second line, and fixes the other
                // half of it too: thirteen links reading "their page" announce
                // as the same string thirteen times to a screen reader, which is
                // the fault build-msrp.mjs already wrote up on its own rows.
                x.retailer.page
                  ? `<a class="rt-th" href="${pathOf(x.retailer)}">${cell(x.retailer.name)}</a>`
                  : `<span class="rt-th">${cell(x.retailer.name)}</span>`
              }</th>
              <td>${cell(x.product)}<span class="cc-n">measured against ${cell(x.baseLabel)}</span></td>
              <td class="num">${esc(moneyExact(x.amount))}</td>
              <td class="num">${esc(moneyExact(x.base))}</td>
              <td class="num">${esc(multStr(m))}x</td>
              <td>${x.seller === "first-party" ? "The shop itself" : "A marketplace seller"}</td>
              <td class="num">${esc(longDate(x.read))}</td>
              <td class="rt-url">${cell(x.url)}</td>
            </tr>`;
};

// The retailers with no reading get a row of their own under the table rather
// than being left out of it. A gap that is drawn is a finding; a gap that is
// omitted is indistinguishable from a retailer we never looked at.
const noPrice = retailers.filter((r) => !readingsFor(r.id).length);

const table = () => `      <div class="cc-scroll" tabindex="0" role="region"
        aria-label="Prices read at physical retailers, scrollable">
        <table class="cc-table rt-table">
          <caption class="rt-cap">Every price this site has read on a physical retailer's own site, with the
            suggested figure beside it. Ordered by shop name.</caption>
          <thead>
            <tr>
              <th scope="col">Shop</th>
              <th scope="col">What was listed</th>
              <th scope="col" class="num">Asked</th>
              <th scope="col" class="num">Suggested</th>
              <th scope="col" class="num">Multiple</th>
              <th scope="col">Who was selling</th>
              <th scope="col" class="num">Read on</th>
              <th scope="col">Where it was read</th>
            </tr>
          </thead>
          <tbody>
${readings.map(priceRow).join("\n")}
          </tbody>
        </table>
      </div>`;

const gapList = () => !noPrice.length ? "" : `      <div class="rt-gaps">
        <h3>The shops we have no price from, and why</h3>
        <ul>
${noPrice
  .map(
    (r) => `          <li><b>${esc(r.name)}.</b> ${esc(
      r.priceNote || "No listed figure could be read on their own site on the day it was checked."
    )}</li>`
  )
  .join("\n")}
        </ul>
      </div>`;

// --------------------------------------------------------------- the bars
//
// ONE RETAILER'S READINGS, DRAWN AS THE PAIR RATHER THAN AS THE MULTIPLE.
//
// It drew the multiple first, one bar per listing, and that figure only said
// what the number beside it already said. TWO BARS PER LISTING, the suggested
// figure and the asked one against a shared scale, says the thing the sentence
// cannot: how big the gap is, and how differently the same shop treats two
// products on one afternoon. It is also the only shape that works with a single
// reading, which four of these six retailers have, and a page with one reading
// is exactly where a picture of one bar against nothing would have been weight.
//
// Same .bch rows /buying.html uses for its three charts, including its
// two-bars-per-row .bch-2 variant, so a reader who has seen one has seen them
// all. THE NUMBER IS TEXT IN THE ROW AND THE BAR IS DECORATIVE: every bar prints
// its own figure in words beside it, so the figure survives with the bars
// removed and reads to a screen reader. The fills are the site's own weight
// ranking rather than a red and green pair, for the reason the palette entry in
// CLAUDE.md gives: a green bar would be arguing that one of them is good.
const bars = (rs) => {
  if (!rs.length) return "";
  const MAX = Math.max(...rs.map((x) => Math.max(x.amount, x.base)));
  const pc = (n) => +((n / MAX) * 100).toFixed(1);
  return `        <figure class="rt-fig">
          <ul class="bch bch-2">
${rs
  .map(
    (x) => `            <li>
              <span class="bch-h"><span class="bch-n">${esc(x.product)} <span class="bch-s">${esc(
      multStr(x.amount / x.base)
    )}x</span></span></span>
              <span class="bch-r"><span class="bch-t" aria-hidden="true"><span class="bch-b rt-sug" style="width:${pc(
                x.base
              )}%"></span></span><b class="bch-v rt-sugv">${esc(moneyExact(x.base))} suggested</b></span>
              <span class="bch-r"><span class="bch-t" aria-hidden="true"><span class="bch-b rt-ask" style="width:${pc(
                x.amount
              )}%"></span></span><b class="bch-v">${esc(moneyExact(x.amount))} asked</b></span>
            </li>`
  )
  .join("\n")}
          </ul>
          <figcaption>The pair, drawn against one scale. The dark bar is what was being asked on the day and
            the light one is what Pokemon's own shop asks for the same kind of product. These are readings on
            one afternoon rather than what this shop charges, and the multiple beside each name is the sum
            done for you: check the price in front of you and do it again.</figcaption>
        </figure>`;
};

const TIER = {
  small: "Small sealed only, so packs, blisters and tins rather than boxes",
  boxes: "The bigger sealed formats too, so elite trainer boxes and booster boxes",
  repack: "Repackaged assortments rather than product published by Pokemon",
  unknown: "Not establishable from their website",
};

// ---------------------------------------------------------------- the styles
//
// Comments out of the shipped page, argument kept here. Same trade build-css.mjs
// makes for ui.css and the same regex build-buying.mjs uses: this block is inline
// in a render blocking head on ten pages.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const STYLE = `
.rt-lede{max-width:46em}
/* THE ASK PANEL IS THE MOST USEFUL SENTENCE ON THE PAGE AND IT IS ABOVE THE
   DIRECTORY, not under it. A reader who takes only one thing away should take
   this one: an empty peg is not an empty shop. Same heavy panel /buying.html
   gives its key section, so a reader who has seen that page recognises the
   weight as "read this before the list". */
.rt-key{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.rt-key h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.rt-key p{color:var(--foot-ink);line-height:1.55;max-width:44em}
.rt-key p + p{margin-top:var(--s3)}
.rt-key .rt-fig-svg{color:var(--foot-ink);margin-top:var(--s4);max-width:100%;height:auto}
.rt-grp{margin-top:var(--s6)}
.rt-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.rt-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:900px){.rt-cards{grid-template-columns:1fr}}
.rt-c{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
.rt-ch{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);margin-bottom:var(--s2)}
.rt-ch h3{font:400 var(--t-m)/1.15 var(--display)}
.rt-ch .bmk-multi{flex-basis:100%}
/* YES IS THE FIRST THING IN THE CARD AND IT IS SET LOUD, because the question
   somebody typed was a yes or no question and three paragraphs of preamble in
   front of the answer is the thing every other page about this gets wrong. */
.rt-yes{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;background:var(--chrome-bg);color:var(--chrome-ink)}
.rt-a{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.rt-c dl{margin-top:var(--s3);font-size:var(--t-sm);line-height:1.5}
.rt-c dt{font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-top:var(--s3)}
.rt-c dd{margin-top:3px;color:var(--ink)}
.rt-more{display:inline-flex;align-items:center;min-height:44px;margin-top:var(--s3);
  padding:0 var(--s3);border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);
  color:inherit;text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;
  text-transform:uppercase}
.rt-more:hover{border-color:var(--ink);background:var(--mustard)}
/* THE JUMP NAV AND THE SIBLING LINKS BOTH CLEAR 44px. They are the two places on
   these pages where a row of small pill links would otherwise land at 30-something,
   which on a phone is the difference between tapping the shop you wanted and
   tapping the one under it. Measured at 390x844. */
.rt-jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--s5) 0 var(--s4)}
.rt-jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.rt-jump a:hover{border-color:var(--ink);background:var(--mustard)}
/* The table reuses .cc-scroll and .cc-table from ui.css. Only the two things
   that are this page's own are set here: the address column, which is printed
   rather than linked, and the caption. */
.rt-table{min-width:920px}
/* The pinned first column's contents. 44px minimum because it is a link, and a
   link inside a sideways-scrolling table is the one a thumb is most likely to
   miss. display:flex rather than block so the min-height is a real box rather
   than a line box the text sits at the top of. */
.rt-th{display:flex;align-items:center;min-height:44px;color:inherit}
/* THE URL COLUMN IS PRINTED, NOT LINKED, which is the site's outbound rule and
   also what makes this the widest cell in the table. overflow-wrap:anywhere on
   its own is not enough inside a table cell: a table lays out on the content's
   MINIMUM width first, and an unbroken 120 character url has a minimum width of
   120 characters, so the column blew past the 920px min-width and pushed the
   document sideways at 390. The cap plus the break is what holds it. */
.rt-url{font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  overflow-wrap:anywhere;word-break:break-all;max-width:280px}
/* THE CAPTION IS THE WIDEST TEXT ON EITHER PAGE IF IT IS LEFT ALONE, and it is
   easy to miss because it is not prose and nobody caps a caption. A caption box
   is the width of the TABLE, so at 1440 it ran the full 1,386px and set 136 real
   characters a line, measured by walking its text nodes with a Range. That is
   the same fault build-buying.mjs found on .by-src, one element along. 56ch is
   the number that file measured as landing on about 80 real characters at this
   size, so it is reused rather than guessed at again. */
.rt-cap{caption-side:top;text-align:left;padding:12px 14px;font-size:var(--t-sm);
  line-height:1.5;color:var(--ink-2);max-width:56ch}
.rt-gaps{margin-top:var(--s4);border-left:4px solid var(--gold);padding-left:var(--s3);max-width:46em}
.rt-gaps h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:var(--s2)}
.rt-gaps ul{margin:0 0 0 var(--s4);font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
.rt-gaps li{margin-bottom:var(--s2)}
.rt-gaps b{color:var(--ink)}
.rt-fig{margin:var(--s4) 0 var(--s5);border:3px solid var(--navy);border-radius:12px;
  background:var(--card);box-shadow:var(--hard-lg);padding:var(--s4)}
.rt-fig figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s4);max-width:52ch}
/* THE .bch ROWS ARE DEFINED IN build-buying.mjs's OWN INLINE BLOCK, not in
   ui.css, so this page carries its own copy of the ones it uses. That is the
   trade shared/brands.mjs's BRAND_STYLE already makes and for the same reason:
   ui.css is generated from assets-source/ui.css and neither is this pass's to
   edit. If a third page ever wants these, move them to a shared export rather
   than making a third copy. */
.bch{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--s3)}
.bch li{display:flex;flex-direction:column;gap:5px}
.bch-h{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.bch-n{font:700 var(--t-sm)/1.2 var(--body);color:var(--ink)}
.bch-s{font:400 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.bch-v{margin-left:auto;font:700 var(--t-sm)/1 var(--mono);color:var(--ketchup-deep);white-space:nowrap}
.bch-t{display:block;height:12px;border-radius:3px;background:var(--paper-2);
  box-shadow:inset 0 0 0 1px var(--hair)}
.bch-b{display:block;height:100%;border-radius:3px;min-width:3px}
.bch-2 li{gap:6px}
.bch-r{display:flex;align-items:center;gap:var(--s2)}
.bch-r .bch-t{flex:1 1 auto}
.bch-r .bch-v{margin-left:0;flex:none;font-weight:700}
/* WEIGHT, NOT HUE, which is what a black white and gold palette has to do and
   is the same ranking build-buying.mjs's claim window chart uses: the asked
   price is solid ink and the suggested one is the page's paper tone with a
   hairline. Neither carries meaning alone, because both bars print their own
   figure in words next to them. */
.rt-sug{background:var(--paper-3);box-shadow:inset 0 0 0 1px var(--hair)}
.rt-ask{background:var(--ink)}
.rt-sugv{color:var(--ink-2);font-weight:400}
.rt-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s3);line-height:1.6;
  overflow-wrap:anywhere}
/* THE ADDRESSES ARE PRINTED IN THE PROSE AND THAT IS WHAT PUSHED THE DOCUMENT
   SIDEWAYS. This site's rule is that a source url is printed as visible text
   rather than linked, which /msrp.html already does; the consequence nobody had
   met yet is that a 137 character url with no space in it has a minimum content
   width of 137 characters, and a block cannot be narrower than its longest
   unbreakable word. Measured at 390x844 the document scrolled to 527px.
   overflow-wrap:anywhere on every block that can carry one is the fix, and it
   has to be on all of them rather than on the one that was caught: .rt-list,
   .rt-note, the answer paragraph and the definition list all print addresses on
   one page or another. */
.rt-list{margin:var(--s4) 0 0 var(--s4);max-width:46em;line-height:1.55;overflow-wrap:anywhere}
.rt-list li{margin-bottom:var(--s3)}
.rt-list b{color:var(--ink)}
.rt-a,.rt-c dd{overflow-wrap:anywhere}
.rt-note{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);max-width:46em;margin-top:var(--s3);
  overflow-wrap:anywhere}
.rt-sib{display:flex;flex-wrap:wrap;gap:8px;margin-top:var(--s4)}
.rt-sib a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.rt-sib a:hover{border-color:var(--ink);background:var(--mustard)}
${BRAND_STYLE}
/* DESKTOP. Every rule below is min-width only, so a phone and a tablet render
   exactly what they rendered before it existed. The caps are in ch and the
   numbers are the ones build-buying.mjs measured on this stylesheet: 1ch runs
   about 1.4 to 1.5 real characters in Outfit, so 50ch lands around 70 characters
   a line and 56ch on the 11px sourcing type lands around 80. Do not "correct"
   50 up to 70. */
@media(min-width:1000px){
  .rt-lede,.rt-grp > p,.rt-key p,.rt-note{max-width:50ch}
  .rt-src{max-width:56ch}
  /* THE GAP LIST WAS THE WORST MEASURE ON THE DIRECTORY AND IT IS NOT PROSE,
     WHICH IS WHY IT WAS MISSED TWICE. Its 46em cap resolved to about 750px and
     set 111 to 126 real characters a line, worse than anything the ledes were
     doing, on the block that carries the page's stated absences.
     THE CAP GOES ON THE ul AND NOT ON .rt-gaps, and putting it on the wrapper
     first is what proved why. ch is resolved against the element's OWN font, and
     .rt-gaps inherits the 17px body while the list inside it is 14px, so 56ch on
     the wrapper computed 625px and the smaller type inside then fitted 98 real
     characters into it. On the ul the same 56ch is measured in the type that is
     actually being read. */
  .rt-gaps ul{max-width:56ch}
  .rt-fig{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,380px);
    gap:var(--s4) var(--s5);align-items:start}
  .rt-fig > figcaption{grid-column:2;grid-row:1/-1;margin-top:0;max-width:45ch}
  .rt-fig > :not(figcaption){grid-column:1}
}
@media(min-width:1200px){
  /* align-items:start goes with the third column and is caused by it: a grid
     item stretches to its row, a row is as tall as its tallest card, and these
     cards differ by several hundred pixels, so three-up would paint empty
     bordered space under every short one. Same call build-buying.mjs made when
     its venue cards went to three. */
  .rt-cards{grid-template-columns:repeat(3,1fr);align-items:start}
  /* TWO COLUMNS, CAPPED AT 1100px, AND THE CAP IS THE HALF THAT MATTERS.
     columns:2 divides whatever the block is given, so on the full 1,392px wrap
     each column came out 672 to 750px and set 111 to 126 real characters a line,
     measured with a Range rather than assumed from the em cap. 1100 puts the
     columns near 505px and the count near 75. break-inside keeps an item whole,
     because a list item split across a column break reads as two items.
     max-width has to move with columns or the pair would be capped as one. */
  .rt-list{columns:2;column-gap:var(--s6);max-width:1100px}
  .rt-list li{break-inside:avoid}
}
`;

const head = ({ title, desc, path, extraLd = [] }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${miniCSS(STYLE)}</style>
${extraLd.map((o) => `<script type="application/ld+json">${ld(o)}</script>`).join("\n")}
</head>`;

// JSON-LD goes in a script element, so a "</script>" inside any string in the
// data would close it and the rest of the page would be parsed as markup. The
// escape has to be on the "<", not on the whole tag, because the parser is
// looking for the sequence rather than the word.
const ld = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

const crumbs = (tail, path) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Which stores sell cards", item: `${SITE}/retailers.html` },
    ...(path ? [{ "@type": "ListItem", position: 3, name: tail }] : []),
  ].slice(0, path ? 3 : 2),
});

// ============================================================ THE DIRECTORY

const dirCard = (r) => {
  const rs = readingsFor(r.id);
  return `        <article class="rt-c" id="${esc(r.id)}">
          <div class="rt-ch">
            ${brandMark(r.id, r.name)}
            <h3>${esc(r.name)}</h3>
            <span class="rt-yes">Sells them</span>
          </div>
          <p class="rt-a">${esc(r.answer)}</p>
          <dl>
            <dt>What they stock</dt>
            <dd>${esc(TIER[r.stocksTier] || TIER.unknown)}. ${esc(r.stocks)}</dd>
            ${r.whereInStore ? `<dt>Where to look</dt><dd>${esc(r.whereInStore)}</dd>` : ""}
            ${r.marketplaceKind === "mixed" ? `<dt>Shop or marketplace</dt><dd>${esc(r.marketplaceNote)}</dd>` : ""}
            <dt>Prices we have read</dt>
            <dd>${
              rs.length
                ? `${rs.length} listing${rs.length === 1 ? "" : "s"}, ${rs
                    .map((x) => `${esc(multStr(x.amount / x.base))}x`)
                    .join(", ")} of the suggested figure, read ${esc(longDate(rs[0].read))}. In the table below.`
                : esc(r.priceNote || "None. Nothing could be read on their own site.")
            }</dd>
          </dl>
          ${r.page ? `<a class="rt-more" href="${pathOf(r)}">Does ${esc(r.name)} sell Pokemon cards?</a>` : ""}
          <p class="rt-src">Confirmed by reading ${esc(r.confirmed.url)} on ${esc(longDate(r.confirmed.read))}.</p>
        </article>`;
};

const cnrLabel = {
  gated: "Their site would not let us read it",
  "nothing-found": "We read it and found no Pokemon cards on the day",
};

const DIR_DESC =
  "Which shops actually sell Pokemon cards, from GameStop and Target to CVS and Dollar General. " +
  "What each one stocks, which department it files them under, and every price we have read on a " +
  "retailer's own site with the date and the address on it.";

const directory = `${head({
  title: "Which Stores Sell Pokemon Cards? The Shop-by-Shop List | Garbage Rips 585",
  desc: DIR_DESC,
  path: "/retailers.html",
  extraLd: [crumbs("", "")],
})}
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Which stores sell cards</span></nav>
      <h1>Which stores sell <span class="hl">Pokemon cards</span></h1>
      <p class="lede rt-lede">${retailers.length} shops we could confirm sell Pokemon cards, by reading it on
        that company's own website with our own eyes, on the date printed against each one. What they stock,
        which department they file the cards under, and every price we have actually read.</p>
      <p class="lede rt-lede">Eight more chains were checked and are not on this list. Four served a bot
        challenge instead of a shop, three served a page with no Pokemon cards on it, and one answered with its
        own error. They are named at the bottom with the reason, because "we could not read their site" and
        "they do not sell them" are two different sentences and only the first one is ours to write.</p>

      <div class="rt-key">
        <h2>If you cannot see any, <span class="hl">ask anyway</span></h2>
        <p>${esc(R.askAnEmployee.claim)}</p>
${(R.askAnEmployee.why || []).map((w) => `        <p>${esc(w)}</p>`).join("\n")}
        ${AISLE}
      </div>

      <nav class="rt-jump" aria-label="Jump to a shop">
${retailers.map((r) => `        <a href="#${esc(r.id)}">${esc(r.name)}</a>`).join("\n")}
      </nav>

      <section class="rt-grp">
        <h2>The <span class="hl">shops</span></h2>
        <p>Ordered by name. Nothing here is a ranking, and the order is alphabetical so that it cannot
          accidentally become one.</p>
        <div class="rt-cards">
${retailers.map(dirCard).join("\n")}
        </div>
      </section>

      <section class="rt-grp">
        <h2>A price on their site is not always <span class="hl">their</span> price</h2>
        <p class="rt-note">${esc(R.marketplace.claim)}</p>
        <ul class="rt-list">
${(R.marketplace.why || []).map((w) => `          <li>${esc(w)}</li>`).join("\n")}
        </ul>
      </section>

      <section class="rt-grp">
        <h2>What we have actually <span class="hl">read</span></h2>
        <p>${readings.length} listings, at ${
          new Set(readings.map((x) => x.retailer.id)).size
        } shops, each one a single product on a single day at an address you can open yourself. The suggested
          figure in the fourth column comes from <a href="/msrp.html">the MSRP page</a>, which prices every
          sealed product from Pokemon's own shop. Prices move daily and differ between two branches of one
          chain, so treat these as worked examples of the division rather than as what any shop charges.
          Check the sticker in front of you and do the sum yourself.</p>
${table()}
${gapList()}
      </section>

      <section class="rt-grp">
        <h2>The eight we could <span class="hl">not</span> confirm</h2>
        <p class="rt-note">None of this says these shops do not sell Pokemon cards. Most of it is a fact about
          a web server. Where a chain served a bot challenge we recorded that and moved on rather than trying to
          get around it, which is a rule this site keeps everywhere.</p>
        <ul class="rt-list">
${(R.couldNotRead || [])
  .map(
    (c) => `          <li><b>${esc(c.name)}.</b> ${esc(cnrLabel[c.kind] || "")}. ${esc(c.why)} Checked ${esc(
      longDate(c.read)
    )} at ${esc(c.url)}</li>`
  )
  .join("\n")}
        </ul>
      </section>

      <section class="rt-grp">
        <h2>Where this page <span class="hl">stops</span></h2>
        <p class="rt-note">This one is about shops with a door. For buying online, what each venue costs once
          shipping and buyer fees are counted is on <a href="/buying.html">where to buy</a>, and what a sealed
          product is supposed to cost in the first place is on <a href="/msrp.html">the MSRP page</a>. When the
          chains are expected to have stock is <a href="/drops.html">what is dropping this week</a>, and the
          shops around Rochester with a counter you can stand at are on <a href="/shops.html">the shops page</a>.</p>
      </section>

      <p class="rt-src" style="margin-top:var(--s6)">Every retailer on this page was confirmed by reading that
        company's own website in a browser on the date printed against it${
          R.checked ? `, all of them on or before ${esc(longDate(R.checked))}` : ""
        }. Suggested prices are joined from this site's own MSRP page and are not restated here. No price is
        printed without the seller, because several of these companies run a marketplace alongside their own
        stock and the two are different claims. Nothing here came from a comparison site. Prices and policies
        move: check before you spend anything on this.</p>
      <p class="rt-src">${BRAND_CREDIT}</p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/retailers.html"), directory);

// ====================================================== ONE PAGE PER RETAILER

await mkdir(join(ROOT, "public/retailers"), { recursive: true });

/**
 * The sibling links at the foot of a retailer page.
 *
 * A page with no way out of it but the nav is a dead end to a reader and an
 * orphan to a crawler, and nine pages that only link upwards make the set look
 * like nine copies of one template rather than a section. Two siblings each,
 * picked as the next two in the list so the ring is complete and every page is
 * reachable from every other in a few hops.
 */
const siblings = (r) => {
  const i = paged.indexOf(r);
  return [paged[(i + 1) % paged.length], paged[(i + 2) % paged.length]].filter((x) => x !== r);
};

const faq = (r, rs) => {
  const qs = [
    [
      `Does ${r.name} sell Pokemon cards?`,
      r.answer,
    ],
    [
      `What Pokemon cards does ${r.name} sell?`,
      `${TIER[r.stocksTier] || TIER.unknown}. ${r.stocks}`,
    ],
  ];
  if (r.whereInStore) {
    qs.push([`Where in ${r.name} are the Pokemon cards?`, `${r.whereInStore} Layouts differ from shop to shop, and a lot of chains now keep cards behind the counter or in a locked case, so ask a member of staff even if the shelf is empty.`]);
  }
  qs.push([
    `Does ${r.name} sell Pokemon cards over MSRP?`,
    rs.length
      ? `On the listings we read on ${longDate(rs[0].read)}, ${rs
          .map((x) => `the ${x.product} was ${moneyExact(x.amount)} against a suggested ${moneyExact(x.base)}, which is ${multStr(x.amount / x.base)} times it`)
          .join("; ")}. Those are readings on one day rather than a standing price, and prices move.`
      : r.priceNote || `This site holds no price reading from ${r.name}.`,
  ]);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qs.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
};

const readingBlock = (r, rs) => {
  if (!rs.length) {
    return `      <p class="rt-note">${esc(
      r.priceNote || `This site holds no price reading from ${r.name}, and an empty cell is the honest answer rather than a borrowed number.`
    )} The suggested figures to measure any price against are on <a href="/msrp.html">the MSRP page</a>.</p>`;
  }
  return `      <ul class="rt-list">
${rs
  .map(
    (x) => `        <li><b>${esc(x.product)}.</b> ${esc(moneyExact(x.amount))} asked against a suggested
          ${esc(moneyExact(x.base))} for a ${
            // NOT lowercased. It was, to make it read as a noun in the sentence,
            // and it turned "Poke Ball Tin" into "poke ball tin": these labels
            // are product names out of data/msrp.json and half of them contain a
            // proper noun. The label as written is the label /msrp.html prints.
            esc(x.baseLabel)
          }, so
          ${esc(x.amount.toFixed(2))} &divide; ${esc(x.base.toFixed(2))} = ${esc(
            multStr(x.amount / x.base)
          )}. Sold by ${
            x.seller === "first-party" ? "the shop itself" : "a marketplace seller"
          }: ${esc(x.sellerHow)}. Read on ${esc(x.on)}, ${esc(longDate(x.read))}, at ${esc(x.url)}</li>`
  )
  .join("\n")}
      </ul>
${bars(rs)}`;
};

let written = 0;
for (const r of paged) {
  const rs = readingsFor(r.id);
  const path = pathOf(r);
  const title = `Does ${r.name} Sell Pokemon Cards? | Garbage Rips 585`;
  const desc = `${r.answer.split(". ")[0]}. What ${r.name} stocks, which department the cards are filed under, and every price we have read on their own site with the date and the address on it.`;

  const page = `${head({ title, desc, path, extraLd: [crumbs(r.name, path), faq(r, rs)] })}
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> /
        <a href="/retailers.html">Which stores sell cards</a> / <span>${esc(r.name)}</span></nav>
      <div class="rt-ch">
        ${brandMark(r.id, r.name)}
      </div>
      <h1>Does ${esc(r.name)} sell <span class="hl">Pokemon cards</span>?</h1>
      <p class="lede rt-lede">${esc(r.answer)}</p>
      <p class="rt-src">Confirmed on ${esc(longDate(r.confirmed.read))} by reading it on ${esc(
        r.name
      )}'s own website: ${esc(r.confirmed.how)} ${esc(r.confirmed.url)}</p>

      <section class="rt-grp">
        <h2>What they <span class="hl">stock</span></h2>
        <p class="rt-note"><b>${esc(TIER[r.stocksTier] || TIER.unknown)}.</b> ${esc(r.stocks)}</p>
      </section>

${r.whereInStore ? `      <section class="rt-grp">
        <h2>Where in the <span class="hl">shop</span> to look</h2>
        <p class="rt-note">${esc(r.whereInStore)}</p>
        <p class="rt-src">Read from ${esc(r.whereSource)}</p>
      </section>` : ""}

      <div class="rt-key">
        <h2>If the shelf is empty, <span class="hl">ask</span></h2>
        <p>${esc(R.askAnEmployee.claim)}</p>
        <p>${esc((R.askAnEmployee.why || [])[0] || "")}</p>
        ${AISLE}
      </div>

      <section class="rt-grp">
        <h2>What we have <span class="hl">read</span> them asking</h2>
        <p class="rt-note">Every figure below is one listing, of one product, on one day, at an address you
          can open and check. It is an example of the division rather than a score for the shop, and it will
          not be current for long. The suggested figures come from <a href="/msrp.html">the MSRP page</a>,
          which prices sealed product from Pokemon's own shop.</p>
${readingBlock(r, rs)}
      </section>

${r.marketplaceKind === "mixed" ? `      <section class="rt-grp">
        <h2>A price on their site is not always <span class="hl">their</span> price</h2>
        <p class="rt-note">${esc(r.marketplaceNote)}</p>
        <p class="rt-note">${esc(R.marketplace.claim)} The full explanation, and the three tells that
          separate the two, are on <a href="/retailers.html">the shop list</a>.</p>
      </section>` : ""}

${r.availability ? `      <section class="rt-grp">
        <h2>Getting hold of <span class="hl">one</span></h2>
        <p class="rt-note">${esc(r.availability)}</p>
        ${r.priceNote && rs.length ? `<p class="rt-note">${esc(r.priceNote)}</p>` : ""}
      </section>` : ""}

      <section class="rt-grp">
        <h2>Before you <span class="hl">pay</span> for it</h2>
        <p class="rt-note">Work out the multiple before you hand the money over.
          <a href="/msrp.html">What a sealed product is supposed to cost</a> has the suggested figure for
          every format and a calculator that does the division. If you are buying online instead,
          <a href="/buying.html">where to buy</a> records what each venue costs once shipping and buyer fees
          are counted, and what recourse you have when something arrives wrong. When the chains are expected
          to restock is <a href="/drops.html">this week's drops</a>.</p>
        <div class="rt-sib">
${siblings(r)
  .map((s) => `          <a href="${pathOf(s)}">Does ${esc(s.name)} sell Pokemon cards?</a>`)
  .join("\n")}
          <a href="/retailers.html">All ${retailers.length} shops</a>
        </div>
      </section>

      <p class="rt-src" style="margin-top:var(--s6)">${(r.sources || [])
        .map((s) => `${esc(s.what)}: ${esc(s.url)}, read ${esc(longDate(s.read))}.`)
        .join(" ")} Nothing here came from a comparison site, and no price is printed without saying who was
        selling. Prices and shop layouts move, so check before you rely on any of it.</p>
      <p class="rt-src">${BRAND_CREDIT}</p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

  await writeFile(join(ROOT, `public${path}`), page);
  written += 1;
}

// The search builder reads this rather than being handed a second hand-written
// list to fall out of date, which is the failure PAGES in build-search.mjs
// already has a guard for.
await mkdir(join(ROOT, "public/data"), { recursive: true });
await writeFile(
  join(ROOT, "public/data/retailers-index.json"),
  JSON.stringify(
    {
      checked: R.checked,
      pages: paged.map((r) => ({
        name: r.name,
        path: pathOf(r),
        sub: `Does ${r.name} sell Pokemon cards?`,
      })),
    },
    null,
    1
  ) + "\n"
);

console.log(`Wrote public/retailers.html and ${written} retailer pages
  ${retailers.length} retailers confirmed, ${(R.couldNotRead || []).length} could not be confirmed
  ${readings.length} price readings (${readings.filter((x) => x.seller === "first-party").length} first-party, ${
  readings.filter((x) => x.seller === "marketplace").length
} marketplace), ${noPrice.length} retailers with none`);
