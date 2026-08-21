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
// ---------------------------------------------------------------------------
// THE ONE PICTURE THESE PAGES WERE MISSING, added 17 August 2026.
//
// A retailer page carried exactly two visuals, the chain's mark and the shared
// ask-an-employee drawing, on up to 1,106 words, which made this the thinnest
// page family on the site. Its reader is standing in a shop, which is the most
// visual situation any reader of this site is ever in.
//
// WHAT WAS ADDED IS NOT A PHOTOGRAPH OF THE PRICE ROW, AND THE DIFFERENCE IS THE
// WHOLE ARGUMENT. Every reading names an exact product, and shared/product-
// photos.mjs will resolve any of them to a photograph. Twelve of the thirteen
// resolve to a DIFFERENT SET'S box of the same format, because the pins are per
// format and the shops listed whatever was on the shelf that week. On /msrp.html
// that is honest, because the row there IS the format. Here the row is "CVS asked
// $12.99 for the Ascended Heroes Mini Tin on 17 August", and a Prismatic
// Evolutions tin printed beside it hands a reader looking at a shelf a picture of
// a box that is not the one in the sentence. That is the failure the name check
// in shared/product-photos.mjs exists to stop, one level up: the pin resolves
// correctly and the page's claim around it does not.
//
// SO THE PICTURES ANSWER THE OTHER QUESTION, the one the words genuinely fail.
// The stock line on these pages is jargon: "packs, blisters and tins rather than
// boxes", "elite trainer boxes, ex boxes, ultra premium collections, Poke Ball
// tins". Nobody who has not already bought sealed product can act on that
// sentence. One photograph per FORMAT, named, turns it into a shopping list, and
// it says in the caption that the artwork changes with every set and the shape
// does not, which is the reason the picture is useful and the reason it cannot
// be mistaken for the box on the shelf.
//
// THE FORMATS COME FROM THE SHOP'S OWN READINGS FIRST, so the set is per shop and
// needs no judgement: a reading already names an exact row in data/msrp.json.
// Only a shop we hold NO reading from falls back to `alsoFormats` in
// data/retailers.json, which has to name a format its own `stocks` sentence
// names, and that sentence is printed directly above the pictures.
//
// THE STRIP IS 150w AND CARRIES NO srcset, WHICH IS A DEPARTURE FROM
// build-msrp.mjs AND IS DELIBERATE. That page offers the 1000x1000 rendition as a
// second candidate for dense screens. Measured on the two heaviest pins here, the
// large is 104.7KB and 137.2KB against 5.7KB and 20.6KB for the 150w, so a DPR 3
// phone would fetch up to 137KB for a 75px tile. This page's reader is on a shop's
// wifi. The tile is 75px and the CDN's 150w file covers it exactly at DPR 2; at
// DPR 3 it is soft, and a soft 75px picture still answers "is that a tin or a box",
// which is the only question the tile is asked. (Note that _1000w.jpg does not
// exist at all on that CDN and answers 403; the large is _in_1000x1000.jpg.)
//
// AND THEREFORE NO `sizes` EITHER. It was written first and it was inert: the
// attribute only does anything alongside a srcset, so it would have been a line
// of markup that looks like it is choosing a rendition and is not.
//
// NO WIDTH OR HEIGHT ATTRIBUTES, for the reason build-msrp.mjs writes up:
// imgDims() in shared/format.mjs returns nothing for tcgplayer-cdn on purpose,
// because those files run 200x268 to 200x417 and a declaration would be wrong by
// up to a third. The tile is a fixed box in CSS, so nothing reflows.
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
import { loadListings, multStr, readDatePhrase } from "../shared/listings.mjs";
// The pins, once, shared with /msrp.html and /what-to-buy.html. Read its header
// before touching a photograph: a pin that no longer resolves to the product it
// names FAILS THE BUILD rather than dropping the picture, and that property is
// the only thing standing between this page and one box's photograph under
// another box's name.
import { makePhotoFor } from "../shared/product-photos.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(await readFile(join(ROOT, "data/retailers.json"), "utf8"));

const retailers = R.retailers || [];
if (!retailers.length) throw new Error("data/retailers.json has no retailers");

// ---------------------------------------------------------------- the join
//
// IT MOVED TO shared/listings.mjs ON 17 AUGUST 2026 AND THE MOVE IS THE FIX.
// This file used to hold the whole merge, and it was right: 9 readings from
// data/retailer-prices.json plus the 4 in data/pack-counts-current.json, joined
// to data/msrp.json by exact label, throwing rather than warning on a miss.
// /msrp.html held its own half of the same join, read only the pack-counts file,
// printed 4, and said in those words that they were "every dated, sourced shop
// listing this site holds". Both counts were derived honestly and one of them
// was a completeness claim about a set it could not see.
//
// So the merge, the seller rule, the label lookup and the legacySellers
// attribution all live in shared/listings.mjs now and three builders import it.
// Two behaviours got STRICTER on the way: a pack-counts listing whose shop is
// not in this directory used to be skipped silently here, and one with no
// suggested figure used to be skipped silently in build-what-to-buy.mjs. Both
// throw now, because a silent skip is exactly how two pages come to count the
// same set differently.
const { listings: readings, readDates: ALL_READ_DATES } = await loadListings();

const readingsFor = (id) => readings.filter((x) => x.retailer.id === id);

// ------------------------------------------------ the sealed formats, pictured
//
// See the header. These four files are the same four /msrp.html opens, read the
// same way, so the two pages cannot pin different photographs to one format.
const MSRP = JSON.parse(await readFile(join(ROOT, "data/msrp.json"), "utf8"));
const PRODUCTS = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
const EXTRA = JSON.parse(await readFile(join(ROOT, "data/extra-products.json"), "utf8"));
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);
const photoFor = makePhotoFor({ products: PRODUCTS, extra: EXTRA.products, dead: DEAD });

// A LABEL IS THE JOIN AND rowId IS THE PIN, and the two are different keys on
// purpose. shared/listings.mjs hands every reading the msrp.json LABEL it was
// divided by; shared/product-photos.mjs is keyed by that row's rowId, which
// exists because the taxonomy id is deliberately not unique here (build-msrp.mjs
// argues that beside its own rows). This is the one lookup between them, and it
// defaults rowId to id exactly as build-msrp.mjs does, so a row cannot resolve to
// a photograph on one page and to nothing on the other.
const ROW_OF_LABEL = new Map();
for (const row of MSRP.products || []) {
  if (!ROW_OF_LABEL.has(row.label)) ROW_OF_LABEL.set(row.label, row.rowId || row.id || "");
}

// 150w, not 200w, and not the large. See the header for the measurement.
const small = (u) => u.replace(/_200w\.jpg$/, "_150w.jpg");

/**
 * The sealed formats a retailer page may picture, in order of what the format is
 * suggested to cost, cheapest first.
 *
 * THE ORDER IS THE LADDER A SHOPPER CLIMBS and it is not a ranking of anything.
 * Nothing on these pages is sorted by the multiple, ever, for the reason
 * data/over-msrp.json's _readme gives; that rule is about shops and about
 * markups, and neither is being ordered here. Sorting these by suggested price
 * puts a booster pack next to a mini tin and a booster box at the end, which is
 * how the shelf is arranged and how somebody works out what they can afford.
 */
const formatsFor = (r) => {
  const seen = new Map();
  for (const x of readingsFor(r.id)) {
    if (!seen.has(x.baseLabel)) seen.set(x.baseLabel, { label: x.baseLabel, base: x.base });
  }

  // `alsoFormats` is only read where the readings cover nothing, which is what
  // keeps a hand-written list from quietly outranking a dated reading.
  for (const label of r.alsoFormats || []) {
    const rowId = ROW_OF_LABEL.get(label);
    if (!rowId) {
      throw new Error(
        `build-retailers: data/retailers.json gives "${r.name}" the format ${JSON.stringify(label)}\n` +
          `  and data/msrp.json has no row with that exact label. This is the same discipline\n` +
          `  data/retailer-prices.json keeps with msrpLabel: name a row that exists, or drop it.\n` +
          `  Do NOT add a label here to make a page carry more pictures.`
      );
    }
    if (seen.has(label)) {
      throw new Error(
        `build-retailers: data/retailers.json lists ${JSON.stringify(label)} under "${r.name}"'s\n` +
          `  alsoFormats and this site already holds a dated price reading for that format at that\n` +
          `  shop. The reading is the better evidence and the strip would draw the format twice.\n` +
          `  Take the label out.`
      );
    }
    if (!photoFor(rowId)) {
      throw new Error(
        `build-retailers: data/retailers.json lists ${JSON.stringify(label)} under "${r.name}"'s\n` +
          `  alsoFormats and shared/product-photos.mjs has no photograph pinned for row\n` +
          `  ${JSON.stringify(rowId)}, so the tile would be an empty box under a format name. A\n` +
          `  format with no photograph is left OUT of the strip, never given a nearby product's\n` +
          `  picture. Drop the label, or pin the row properly in sync-extra-products.mjs.`
      );
    }
    const row = (MSRP.products || []).find((x) => x.label === label);
    seen.set(label, { label, base: typeof row.price === "number" ? row.price : null });
  }

  const out = [];
  for (const f of seen.values()) {
    const rowId = ROW_OF_LABEL.get(f.label);
    const p = rowId ? photoFor(rowId) : null;
    // A format this site has no photograph of is dropped rather than drawn as a
    // hole. The strip is an extra on this page and an incomplete strip is a
    // smaller claim than a wrong one; /msrp.html is the page that owes every
    // format a row, and it draws its own hatch there.
    if (p) out.push({ ...f, photo: p });
  }
  // Nulls last so a format with no suggested figure cannot sort to the front and
  // read as the cheapest thing on the shelf.
  return out.sort(
    (a, b) => (a.base === null) - (b.base === null) || (a.base || 0) - (b.base || 0) ||
      a.label.localeCompare(b.label)
  );
};

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
  aria-label="Two places Pokemon cards sit in a shop: an empty peg on the sales floor, and a locked case behind the counter."
  fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <g>
    <path d="M14 20h84M14 44h84M14 68h84"/>
    <path d="M14 14v60M98 14v60"/>
    <rect x="22" y="8" width="12" height="12" rx="1.2"/>
    <rect x="40" y="8" width="12" height="12" rx="1.2"/>
    <text x="56" y="38" font-size="9" stroke="none" fill="currentColor" font-family="monospace">empty</text>
    <text x="20" y="88" font-size="9" stroke="none" fill="currentColor" font-family="monospace">sales floor</text>
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

/* THE 56ch CAP BELOW FIXED THE DESKTOP HALF OF THIS AND LEFT THE PHONE HALF
   BROKEN, which is worth knowing before somebody reaches for a smaller number.
   56ch measures 514px at --t-sm, and the .cc-scroll box is 352px at 390x844, so
   162px of the line sat off the right edge: "...with the suggested figur" and
   then a cut. A cap cannot fix it at any value, because a <caption> is laid out
   at its TABLE's width and .rt-table is min-width:920px; the cap only ever
   chooses how much of an off-screen box gets used.
   So the visible line moves OUT of the scroller, where it wraps to the
   viewport, and the <caption> stays as .sr-only so the table keeps its
   accessible name. Same fix, same day, in build-openings.mjs and
   build-grade-check.mjs, and the shape is
   /first-partner-illustration-collection.html's, which is the only data table
   on the site that never had this. */
const table = () => `      <p class="rt-tcap">Every price this site has read on a physical retailer's own site, with the
        suggested figure beside it. Ordered by shop name.</p>
      <div class="cc-scroll" tabindex="0" role="region"
        aria-label="Prices read at physical retailers, scrollable">
        <table class="cc-table rt-table">
          <caption class="sr-only">Every price this site has read on a physical retailer's own site, with the
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

// ------------------------------------------------------------- the strip
//
// ONE PHOTOGRAPH PER FORMAT, AND THE NAME OF THE PRODUCT IN IT UNDER IT.
//
// That last part is the contract shared/product-photos.mjs sets and it is not
// decoration: a photograph of one set's box standing in for a TYPE has to name
// the box it is actually a photograph of, or it is a picture quietly claiming to
// be a category. /msrp.html meets it with a "pictured:" clause in its provenance
// line and this meets it in the tile, where the picture is.
//
// THE CAPTION CARRIES THE ONE SENTENCE THAT MAKES THE STRIP SAFE: the artwork
// changes with every set and the shape does not. Without it a reader standing in
// CVS is being shown a Prismatic Evolutions tin under CVS's name and may go
// looking for that exact box. With it, the picture is doing the only job it can
// honestly do, which is explaining what the words mean.
//
// NOT A LINK PER TILE. Every large tap target on these pages is internal or is
// nothing, and thirteen links reading "MSRP page" would be the fault
// build-msrp.mjs already wrote up on its own rows. One link, in the caption.
//
// THE onerror TAKES THE WHOLE TILE, NOT JUST THE IMAGE, WHICH IS THE ONE PLACE
// THIS PAGE DIFFERS FROM EVERY OTHER onerror ON THE SITE. Elsewhere a dead scan
// removing itself leaves a row that still reads correctly. Here the tile's other
// two lines are "Elite Trainer Box" and "pictured: Pitch Black Elite Trainer
// Box", and a "pictured:" with nothing pictured is a caption for an absence.
// data/no-scan.json means this should never fire: photoFor already returns null
// for a url known to answer 403, so this only catches one that dies later.
const formatStrip = (r, fmts) => {
  if (!fmts.length) return "";
  const read = readingsFor(r.id).length > 0;
  return `      <figure class="rt-fig rt-fmt">
        <ul class="rt-fmts">
${fmts
  .map(
    (f) => `          <li>
            <img class="rt-shot" src="${esc(small(f.photo.src))}"
              alt="${esc(f.photo.name)}, sealed" loading="lazy" decoding="async"
              referrerpolicy="no-referrer" onerror="this.closest('li').remove()">
            <span class="rt-fmt-n">${esc(f.label)}</span>
            <span class="rt-fmt-p">pictured: ${esc(f.photo.name)}</span>
          </li>`
  )
  .join("\n")}
        </ul>
        <figcaption>${
          read
            ? `The sealed formats ${esc(r.name)} listed a price for on their own site, one photograph of each.`
            : // NOT "in the line above", WHICH IS WHAT IT SAID AND WAS TRUE OF
              // ONE OF THE TWO SHOPS THIS BRANCH SERVES. Best Buy's stock line
              // does name "booster bundles, booster boxes" in those words.
              // Walmart's names "booster boxes and trainer boxes" as CATEGORY
              // names, so the tile reading "Elite Trainer Box" is not literally
              // the line above; it is what their own search was read for and
              // what the source note at the foot of the page records. Pointing at
              // the sourcing rather than at a specific line is exact for both.
              `The sealed formats named on ${esc(r.name)}'s own site when it was read, one photograph of each.`
        }${/* "The box in a picture" was wrong on the shops whose only picture
              is a loose booster pack or a peg blister: five-below.html captions
              a single pack with it, and dollar-general.html a mini tin. Say
              "product", which is true of all eight and is the word the sentence
              already uses in its next clause. */ ""} The product in a picture
          is one example of that format and not the one on the shelf in front of you: the
          artwork changes with every set and the shape does not. What each format is supposed to cost is on
          <a href="/msrp.html">the MSRP page</a>.</figcaption>
      </figure>`;
};

const TIER = {
  small: "Small sealed only, so packs, blisters and tins rather than boxes",
  boxes: "The bigger sealed formats too, so elite trainer boxes and booster boxes",
  repack: "Repackaged assortments rather than product published by Pokemon",
  unknown: "Not establishable from their website",
};

/* FOUR ENTRIES SAID THEIR OWN TIER TWICE IN A ROW, and it reads as a stutter
   because it IS one: the chip is generated from `stocksTier` and the sentence
   after it was written by hand by somebody who could not see the chip.

       CVS       "Small sealed only, so packs, blisters and tins rather than
                  boxes. SMALL SEALED ONLY, on the day it was read: a mini tin..."
       B&N       "Not establishable from their website. NOT ESTABLISHABLE FROM
                  THE WEBSITE, because the online collectible card list is..."
       Staples   "Repackaged assortments rather than product published by
                  Pokemon. REPACKAGED ASSORTMENTS ONLY. A 40 card pack at..."
       Dollar G  "Small sealed only, so packs... SMALL SEALED and repackaged
                  formats: single packs..."

   Fixed in data/retailers.json, not here, because the duplication is in the
   researched sentence and a builder that strips words off researched prose is a
   builder that will one day strip the wrong ones. Not one fact moved: each edit
   deletes a restatement of the chip above it and nothing else.

   THE GUARD IS THE POINT, because this will be written again the next time
   somebody adds a shop: they will be looking at the JSON, where the chip is a
   two-letter tier key, and the sentence that reads correctly in the file is the
   one that repeats on the page. It throws rather than warns, for the reason
   checkMapping() in build-topps.mjs throws: a warning in a 65-builder run is a
   line nobody reads.

   THE THRESHOLD IS TWO CONTENT WORDS and it is a floor rather than a judgement.
   Articles and "so" are dropped before comparing, since "from THEIR website"
   and "from THE website" are the same words being said twice. Two is low enough
   to have caught all four and high enough that a genuine shared opening
   ("The full sealed range" on Target and Walmart, against a chip that also
   starts "The bigger") never trips it: those measure 0 because the chip's own
   first content word is "bigger". */
const TIER_STOP = new Set(["the", "their", "its", "a", "an", "so", "of"]);
const contentWords = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !TIER_STOP.has(w));

for (const r of retailers) {
  if (!r.stocks) continue;
  const label = contentWords(TIER[r.stocksTier] || TIER.unknown);
  const prose = contentWords(r.stocks);
  let shared = 0;
  while (shared < label.length && shared < prose.length && label[shared] === prose[shared]) shared++;
  if (shared >= 2) {
    throw new Error(
      `build-retailers: "${r.name}" prints its stock tier twice in a row.\n` +
        `  The chip says: ${TIER[r.stocksTier] || TIER.unknown}.\n` +
        `  "stocks" then opens: ${String(r.stocks).slice(0, 80)}...\n` +
        `  The first ${shared} words are the same, so the page reads as a stutter. The chip is\n` +
        `  generated and the sentence is yours: start the sentence AFTER the restatement, in\n` +
        `  data/retailers.json. Do not widen this check to make a sentence pass.`
    );
  }
}

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
.rt-key{border:3px solid var(--keyline);border-radius:12px;background:var(--band-bg);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.rt-key h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.rt-key p{color:var(--foot-ink);line-height:1.55;max-width:44em}
.rt-key p + p{margin-top:var(--s3)}
.rt-key .rt-fig-svg{color:var(--foot-ink);margin-top:var(--s4);max-width:100%;height:auto}
.rt-grp{margin-top:var(--s6)}
.rt-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.rt-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
/* 700 AND NOT 900, BECAUSE 900 PUT AN iPAD ON THE PHONE LAYOUT. An iPad in
   portrait is 768 CSS px, which is BELOW the old 900 collapse, so a tablet got
   the single column meant for a phone and every retailer card was stretched to
   the full 720px wrap. 700 is the widest boundary that still leaves 768 on the
   two column layout, and it is a real phone/tablet line rather than a round
   number: the wrap measures 660px inside a 700px viewport, so two 322px cards
   and a 16px gap fit exactly, and at 390 the wrap is 350px and one column is
   still the only thing that fits.
   NOT auto-fit, and that is deliberate rather than lazy. This grid's own
   desktop rule is the base repeat(2,1fr) for 1000..1199 and a repeat(3,1fr)
   at 1200, both chosen for these cards; an auto-fit floor low enough to give
   two columns at 720 also computes THREE at the 1152px wrap of a 1200 window,
   which would silently re-derive a column count somebody picked on purpose.
   Moving the boundary changes 700..999 and provably nothing at 1000 or above. */
@media(max-width:700px){.rt-cards{grid-template-columns:1fr}}
.rt-c{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
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
.rt-more:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
/* THE JUMP NAV AND THE SIBLING LINKS BOTH CLEAR 44px. They are the two places on
   these pages where a row of small pill links would otherwise land at 30-something,
   which on a phone is the difference between tapping the shop you wanted and
   tapping the one under it. Measured at 390x844. */
.rt-jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--s5) 0 var(--s4)}
.rt-jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.rt-jump a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
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
.rt-tcap{margin:0 0 var(--s2);font-size:var(--t-sm);
  line-height:1.5;color:var(--ink-2);max-width:56ch}
.rt-gaps{margin-top:var(--s4);border-left:4px solid var(--gold);padding-left:var(--s3);max-width:46em}
.rt-gaps h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:var(--s2)}
.rt-gaps ul{margin:0 0 0 var(--s4);font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
.rt-gaps li{margin-bottom:var(--s2)}
.rt-gaps b{color:var(--ink)}
.rt-fig{margin:var(--s4) 0 var(--s5);border:3px solid var(--keyline);border-radius:12px;
  background:var(--card);box-shadow:var(--hard-lg);padding:var(--s4)}
.rt-fig figcaption{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);margin-top:var(--s4);max-width:52ch}
/* THE FORMAT STRIP. Same bordered box as the bar chart, on purpose: a reader who
   has met one figure on this page recognises the second as the same kind of
   thing, and the desktop rule below already lays a .rt-fig out as drawing plus
   caption, so the strip inherits that for free.
   ONE COLUMN ON A PHONE, AND IT WAS TWO UNTIL IT WAS SCREENSHOTTED. minmax(136px)
   gave two columns at 390, which is what the arithmetic says fits: the figure's
   content box is 320px. What it actually looked like is a 63px text column, so
   "Sleeved booster pack" set on three lines and "pictured: Stellar Crown Sleeved
   Booster Pack" on five, and the strip ran 1,260px tall to show five pictures. At
   220 the phone gets one column, the text gets 230px, and the same five formats
   fit in half the height. The number is a floor rather than a layout, so a
   desktop still fills the drawing column with four across. */
.rt-fmts{list-style:none;margin:0;padding:0;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--s3)}
.rt-fmts li{display:grid;grid-template-columns:75px minmax(0,1fr);gap:12px;align-items:center}
/* 75px, NOT 76. The tile has no srcset, so the browser takes the 150w file
   whatever it is told, and 75 is the width at which a DPR 2 phone renders that
   file at exactly 1:1. Fixed in CSS because tcgplayer-cdn's renditions are
   variable height (200x268 to 200x417) and carry no width/height attributes, so
   the box is the only thing holding the layout still. */
.rt-shot{grid-row:span 2;width:75px;height:75px;object-fit:contain;border-radius:var(--r-sm);
  background:var(--paper-2);box-shadow:inset 0 0 0 1px var(--hair)}
.rt-fmt-n{font:700 var(--t-sm)/1.25 var(--body);color:var(--ink);align-self:end}
.rt-fmt-p{font:400 var(--t-micro)/1.35 var(--mono);color:var(--ink-2);align-self:start;
  overflow-wrap:anywhere}
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
/* THE OVERFLOW NOTE ABOVE IS STILL LOAD BEARING and it is no longer the whole
   story: the addresses are LINKS now (see srcLink) and a link's visible text is
   "Open the listing on gamestop.com", which breaks at its spaces like any other
   phrase. overflow-wrap:anywhere stays anyway, because the research files can
   still carry a long unbroken string in a note and the cost of keeping it is
   nothing.
   44px OF HEIGHT, WHICH IS THE SHAPE HALF OF THE OUTBOUND RULE. This is the
   only outbound control on the page and it sits at the end of a row whose whole
   text is internal reading; the footer's Collectr link failed exactly this test
   as an 18px line beside four 44px buttons, and that is written down in
   CLAUDE.md. inline-flex rather than block so it stays in the flow of the
   sentence it ends.
   --gold-deep AND NOT --gold, because this is small type. Read CLAUDE.md's
   accent rule rather than the token name: every token spelling "gold" is a
   TEAL, teal is every route, and #81BEDE is the one that clears 4.5:1 at body
   sizes where #609CBB does not. */
.rt-chk{display:inline-flex;align-items:center;min-height:44px;gap:6px;
  color:var(--gold-deep);text-decoration:underline;text-underline-offset:3px;font-weight:700}
.rt-chk::after{content:"\\2197";text-decoration:none;font-weight:400}
/* The sentence every reading on the page shared, said once above them. */
.rt-once{margin-top:var(--s4)}
.rt-a,.rt-c dd{overflow-wrap:anywhere}
.rt-note{font-size:var(--t-sm);line-height:1.55;color:var(--ink-2);max-width:46em;margin-top:var(--s3);
  overflow-wrap:anywhere}
.rt-sib{display:flex;flex-wrap:wrap;gap:8px;margin-top:var(--s4)}
.rt-sib a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.rt-sib a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
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
              // THE DATE IS THE GROUP'S RANGE, NEVER rs[0]'s.
              // This printed longDate(rs[0].read) until 17 August 2026, and rs is
              // sorted by PRICE rather than by date, so the summary took whichever
              // listing happened to be cheapest and dated the whole group from it.
              // GameStop is the only shop here holding listings from both source
              // files, so it is the only one whose rows carry two dates, and it
              // read "5 listings ... read August 15, 2026" directly above a table
              // dating three of them August 17. A read date is what makes a price
              // checkable, so a group either states its range or says nothing.
              rs.length
                ? `${rs.length} listing${rs.length === 1 ? "" : "s"}, ${rs
                    .map((x) => `${esc(multStr(x.amount / x.base))}x`)
                    .join(", ")} of the suggested figure, read ${esc(
                    readDatePhrase(rs.map((x) => x.read))
                  )}. In the table below, each with its own date.`
                : esc(r.priceNote || "None. Nothing could be read on their own site.")
            }</dd>
          </dl>
          ${r.page ? `<a class="rt-more" href="${pathOf(r)}">Does ${esc(r.name)} sell Pokemon cards?</a>` : ""}
          ${/* THE SAME ADDRESS THIS CARD'S OWN PAGE NOW LINKS. It was printed bare
                 here and linked there, which is precisely the inconsistency
                 CLAUDE.md complains about between /top-graded.html and
                 /most-valuable-cards.html: one source, two treatments, decided in
                 two places. Both are the same labelled control now. The "Where it
                 was read" COLUMN in the table above is deliberately still plain
                 text and has its own argument beside .rt-url. */ ""}<p class="rt-src">Confirmed by reading their own site on ${esc(longDate(r.confirmed.read))}. ${
            hostOf(r.confirmed.url)
              ? `<a class="rt-chk" href="${esc(r.confirmed.url)}" rel="noopener" target="_blank" aria-label="The ${esc(
                  r.name
                )} page this was read on, opens on ${esc(hostOf(r.confirmed.url))}">Open the page on ${esc(
                  hostOf(r.confirmed.url)
                )}</a>`
              : ""
          }</p>
        </article>`;
};

const cnrLabel = {
  gated: "Their site would not let us read it",
  "nothing-found": "We read it and found no Pokemon cards on the day",
};

// -------------------------------------------- WHY THE EIGHT COULD NOT BE READ
//
// COUNTED, NOT ASSERTED, AND THAT IS THE WHOLE OF THE FIX. The lede read "Four
// served a bot challenge, three served a page with no Pokemon cards on it, and
// one answered with its own error" while the eight descriptions underneath it
// described THREE bot challenges, one search page that loaded and never filled
// in, three with nothing found and one error page. `kind` cannot settle it: it
// only separates "would not let us read it" from "we read it and found nothing".
// So data/retailers.json carries `barrier` on every gated row and this counts
// them. A barrier with no clause here fails the build rather than being dropped
// out of a sentence that still states a total.
const BARRIER_CLAUSE = {
  "bot-challenge": (n, w) => `${w} served a bot challenge instead of a shop`,
  "never-loaded": (n, w) => `${w} served a search page that loaded and never filled in`,
  "own-error": (n, w) => `${w} answered with its own error`,
  "nothing-found": (n, w) => `${w} served a page with no Pokemon cards on it`,
};
const CNR_ORDER = ["bot-challenge", "never-loaded", "nothing-found", "own-error"];
const NUM_WORDS = ["no", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const lowerWords = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numWord = (n, cap) =>
  (cap ? NUM_WORDS[n] : lowerWords[n]) || String(n);

const cnr = R.couldNotRead || [];
const cnrTally = new Map();
for (const c of cnr) {
  // A gated row is filed by its barrier; a nothing-found row is its own answer.
  const key = c.kind === "nothing-found" ? "nothing-found" : c.barrier;
  if (!key || !BARRIER_CLAUSE[key]) {
    throw new Error(
      `build-retailers: data/retailers.json couldNotRead "${c.name}" is kind ${JSON.stringify(c.kind)}\n` +
        `  with barrier ${JSON.stringify(c.barrier || null)}, and this builder has no clause for that.\n` +
        `  The lede counts these rather than asserting a number, so an uncounted row would leave the\n` +
        `  sentence stating a total it cannot account for. Add a clause to BARRIER_CLAUSE, or set a\n` +
        `  barrier of bot-challenge, never-loaded or own-error.`
    );
  }
  cnrTally.set(key, (cnrTally.get(key) || 0) + 1);
}
const cnrClauses = CNR_ORDER.filter((k) => cnrTally.get(k)).map((k, i) => {
  const n = cnrTally.get(k);
  return BARRIER_CLAUSE[k](n, numWord(n, i === 0));
});
const cnrSentence =
  cnrClauses.length > 1
    ? `${cnrClauses.slice(0, -1).join(", ")}, and ${cnrClauses[cnrClauses.length - 1]}.`
    : `${cnrClauses[0] || ""}.`;
const cnrTotalWord = numWord(cnr.length, false);

const DIR_DESC =
  "Which shops actually sell Pokemon cards, from GameStop and Target to CVS and Dollar General. " +
  "What each one stocks, which department it files them under, and every price we have read on a " +
  "retailer's own site with the date and the address on it.";

const directory = `${head({
  title: "Which Stores Sell Pokemon Cards? The Shop-by-Shop List",
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
      <p class="lede rt-lede">${esc(
        cnrTotalWord.charAt(0).toUpperCase() + cnrTotalWord.slice(1)
      )} more chains were checked and are not on this list. ${esc(cnrSentence)}
        They are named at the bottom with the reason, because "we could not read their site" and
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
          Check the sticker in front of you and do the math yourself.</p>
${table()}
${gapList()}
      </section>

      <section class="rt-grp">
        <h2>The ${esc(cnrTotalWord)} we could <span class="hl">not</span> confirm</h2>
        <p class="rt-note">None of this says these shops do not sell Pokemon cards. Most of it is a fact about
          a web server. Where a chain served a bot challenge we recorded that and moved on rather than trying to
          get around it, which is a rule this site keeps everywhere.</p>
        <ul class="rt-list">
${(R.couldNotRead || [])
  .map(
    (c) => `          <li><b>${esc(c.name)}.</b> ${esc(cnrLabel[c.kind] || "")}. ${esc(c.why)} Checked ${esc(
      longDate(c.read)
    )}. ${
      hostOf(c.url)
        ? `<a class="rt-chk" href="${esc(c.url)}" rel="noopener" target="_blank" aria-label="The ${esc(
            c.name
          )} search this was checked on, opens on ${esc(hostOf(c.url))}">Open the page on ${esc(hostOf(c.url))}</a>`
        : ""
    }</li>`
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
  // THE ANSWER CARRIES EVERY ROW'S OWN DATE AND THIS IS THE JSON-LD COPY, which
  // is why it matters more here than anywhere else on the page: Google can quote
  // one of these answers on its own, with no table underneath it to correct it.
  // It said "On the listings we read on <rs[0].read>" until 17 August 2026, and
  // rs is ordered by price, so a shop with listings read on two days was dated
  // from whichever product was cheapest. Every reading now states its own date
  // inside the clause that states its price, and the opening clause gives the
  // range, so no single date is ever put over a group that does not have one.
  qs.push([
    `Does ${r.name} sell Pokemon cards over MSRP?`,
    rs.length
      ? `On the ${rs.length === 1 ? "listing" : `${rs.length} listings`} we read ${readDatePhrase(
          rs.map((x) => x.read)
        )}, ${rs
          // "WHICH IS 1 TIMES IT" IS WHAT A SHOP SELLING AT MSRP USED TO GET,
          // and this is the one sentence on the site where that matters most:
          // it is the FAQ answer Google can lift on its own, with no table
          // beside it. GameStop's Pitch Black Battle Deck was $29.99 against a
          // suggested $29.99. A multiplier is the right unit for every other
          // row and the wrong one for that one, so the equal case says so in
          // words. The near-equal case is kept as a multiplier rather than
          // called "the same", because it is not: two decimals, so it can never
          // print a bare "1" again.
          .map((x) => {
            const m = x.amount / x.base;
            const cmp =
              x.amount === x.base
                ? "which is the same price"
                : `which is ${multStr(m) === "1" ? m.toFixed(2) : multStr(m)} times it`;
            return `the ${x.product} was ${moneyExact(x.amount)} on ${longDate(x.read)} against a suggested ${moneyExact(x.base)}, ${cmp}`;
          })
          .join("; ")}. Each of those is a reading on the day named rather than a standing price, and prices move.`
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

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// research should cost a label, not the build. Same helper, same wording, as
// build-shows.mjs and build-locals.mjs.
// A FUNCTION DECLARATION, NOT A const ARROW, and that is load bearing rather
// than style: this file's page builders run at module top level and dirCard()
// above calls it, so a const here is in the temporal dead zone at the moment it
// is needed and the build dies with "Cannot access 'hostOf' before
// initialization". A declaration hoists.
function hostOf(u) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* THIRTY-FIVE BARE URLS WERE PRINTED IN BODY COPY ACROSS THESE NINE PAGES AND
   NONE OF THEM WAS A LINK. Seven on gamestop, five on target, four each on cvs,
   meijer, five-below and dollar-general, three on walmart, two each on best-buy
   and barnes-and-noble. The worst of them is 130 characters and wrapped across
   three lines of a sentence at 390px, so the thing a reader most wants to do
   with a price citation, open it, was the one thing the page would not let them
   do, while the citation itself was the widest object in the paragraph.

   THE OUTBOUND TEST IN CLAUDE.md, APPLIED HONESTLY: "does the READER need the
   destination, or does the SOURCE deserve a credit?" This is the sixth
   exception's own argument and not a new one. Every one of these rows is a
   PRICE READ ON A DATE, and that file says in as many words that a figure like
   that is only worth publishing if a reader can check whether it still holds.
   The address was already printed in full, so nothing is being disclosed that
   was not; what changes is that it is now tappable instead of being 130
   characters of unwrapped text.

   THE SHAPE IS THE MITIGATION, exactly as for the row links on
   /most-valuable-cards.html. It is a small labelled control at the END of the
   row, after the whole reading, never mid sentence; every large tap target on
   these pages is internal (the breadcrumb, the MSRP page, the format cards,
   the other retailers); and each carries an aria-label saying it leaves the
   site, in the site's own ", opens on <host>" wording.

   THE ARGUMENT IS ALSO WRITTEN IN CLAUDE.md, in the same edit, because that
   file spends four paragraphs on what happens when an arguable link is added
   quietly in one builder instead.

   NOT LINKED, AND DELIBERATELY: the "Where it was read" column on
   /retailers.html prints the same addresses as plain text, and the note beside
   .rt-url below argues its own case about column width. That is a table cell
   rather than body copy and it was left alone. */
const srcLink = (x) => {
  const host = hostOf(x.url);
  if (!host) return "";
  return `<a class="rt-chk" href="${esc(x.url)}" rel="noopener" target="_blank" aria-label="${esc(
    x.product
  )} listing, opens on ${esc(host)}">Open the listing on ${esc(host)}</a>`;
};

const readingBlock = (r, rs) => {
  if (!rs.length) {
    return `      <p class="rt-note">${esc(
      r.priceNote || `This site holds no price reading from ${r.name}, and an empty cell is the honest answer rather than a borrowed number.`
    )} The suggested figures to measure any price against are on <a href="/msrp.html">the MSRP page</a>.</p>`;
  }
  /* THE SAME 43 WORDS, FIVE TIMES IN A ROW ON /retailers/gamestop.html. Every
     row printed its own "Sold by the shop itself: the GameStop product page
     names no third-party seller, and GameStop runs no marketplace for new
     sealed product. Read on the product page", and all five readings carry the
     SAME seller, the same sellerHow and the same `on`. Checked across the whole
     merged corpus rather than assumed: all seven retailers with readings have
     exactly ONE seller/sellerHow/on triple each (cvs 2 rows, gamestop 5,
     meijer 2, target 2, three more with 1), so hoisting it loses nothing on any
     page the site has today.
     It is hoisted only when it IS identical. A retailer whose rows ever
     disagree keeps the sentence per row, because the alternative is a page that
     says "sold by the shop itself" over a marketplace listing. */
  const same = (f) => rs.every((x) => f(x) === f(rs[0]));
  const oneSeller = same((x) => `${x.seller}|${x.sellerHow}`);
  const oneOn = same((x) => x.on);
  const sellerLine = (x) =>
    `Sold by ${x.seller === "first-party" ? "the shop itself" : "a marketplace seller"}: ${esc(x.sellerHow)}.`;

  return `${oneSeller || oneOn ? `      <p class="rt-note rt-once">${
    oneSeller ? sellerLine(rs[0]) : ""
  }${oneSeller && oneOn ? " " : ""}${
    oneOn
      ? `Every figure below was read on ${esc(rs[0].on)}${
          rs.length > 1 ? `, one listing at a time` : ""
        }.`
      : ""
  }</p>
` : ""}      <ul class="rt-list">
${rs
  .map(
    (x) => `        <li><b>${esc(x.product)}.</b> ${esc(moneyExact(x.amount))} asked against a suggested
          ${esc(moneyExact(x.base))} for the ${
            // NOT lowercased. It was, to make it read as a noun in the sentence,
            // and it turned "Poke Ball Tin" into "poke ball tin": these labels
            // are product names out of data/msrp.json and half of them contain a
            // proper noun. The label as written is the label /msrp.html prints.
            //
            // "THE", NOT "A", AND THAT IS THE SAME FIX build-msrp.mjs ALREADY
            // MADE for the calculator that prints these same labels. "a" needs
            // to know which labels take "an" and this one did not: /msrp.html
            // and three retailer pages shipped "for a Elite Trainer Box" and
            // meijer.html shipped "for a ex Box". A first-letter test does not
            // settle it either, because UPC begins with a vowel and takes "a".
            // "the" is correct in front of every label in the file, so the
            // question does not arise. Both pages print the same listings out
            // of the same two research files and now word them the same way.
            esc(x.baseLabel)
          }, so
          ${esc(x.amount.toFixed(2))} &divide; ${esc(x.base.toFixed(2))} = ${esc(
            multStr(x.amount / x.base)
          )}.${oneSeller ? "" : ` ${sellerLine(x)}`} Read${
            oneOn ? "" : ` on ${esc(x.on)}`
          } ${esc(longDate(x.read))}. ${srcLink(x)}</li>`
  )
  .join("\n")}
      </ul>
${bars(rs)}`;
};

let written = 0;
let pictured = 0;
for (const r of paged) {
  const rs = readingsFor(r.id);
  const fmts = formatsFor(r);
  pictured += fmts.length;
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
      ${/* The tenth bare url on these pages, and the only one outside the price
             list. Same treatment and same argument as srcLink above: it is a
             source line, the address is the whole point of it, and a labelled
             control at the end of the line beats 90 characters of unwrapped
             text in the middle of one. */ ""}<p class="rt-src">Confirmed on ${esc(longDate(r.confirmed.read))} by reading it on ${esc(
        r.name
      )}'s own website: ${esc(r.confirmed.how)} <a class="rt-chk" href="${esc(
        r.confirmed.url
      )}" rel="noopener" target="_blank" aria-label="The ${esc(
        r.name
      )} page this was read on, opens on ${esc(hostOf(r.confirmed.url))}">Open the page on ${esc(
        hostOf(r.confirmed.url)
      )}</a></p>

      <section class="rt-grp">
        <h2>What they <span class="hl">stock</span></h2>
        <p class="rt-note"><b>${esc(TIER[r.stocksTier] || TIER.unknown)}.</b> ${esc(r.stocks)}</p>
${formatStrip(r, fmts)}
      </section>

${r.whereInStore ? `      <section class="rt-grp">
        <h2>Where in the <span class="hl">shop</span> to look</h2>
        <p class="rt-note">${esc(r.whereInStore)}</p>
        ${/* A CAPITAL LETTER IN THE MIDDLE OF A SENTENCE, ON EIGHT OF THE NINE
              RETAILER PAGES. This read "Read from" followed by whereSource
              interpolated straight in, and every
              whereSource in data/retailers.json is written as a SENTENCE
              because that is what it is: "The category paths CVS's own site
              puts its Pokemon products under: ...", "The breadcrumb on their
              own product pages: Target, Toys & Games, Trading Cards." Spliced
              after "Read from" they printed "Read from The category paths ..."
              on cvs, target, meijer, five-below, dollar-general, gamestop,
              best-buy and barnes-and-noble. Only walmart read right, and only
              because its value happens to start with a proper noun.

              LOWERCASING THE FIRST LETTER IS THE WRONG FIX AND THIS FILE
              ALREADY SAYS SO one function down, where baseLabel is deliberately
              NOT lowercased because half of those labels contain a proper noun.
              The same is true here: walmart's starts with "Walmart's" and
              dollar-general's with "The breadcrumb on their own category page:
              Dollar General, ..." A first-letter test cannot tell those apart.

              So the value stops being spliced into somebody else's sentence and
              becomes its own, behind a bolded label, which is the shape
              build-selling.mjs uses for exactly this: a bolded "If it goes
              wrong." followed by the venue's own protection sentence. The label
              ends in a full stop, the data starts a new sentence, and whatever
              it starts with is correct. */ ""}<p class="rt-src"><b>Where that was read.</b> ${esc(r.whereSource)}</p>
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

      ${/* THE PAGE-FOOT SOURCE LINE, which held the LAST bare url on these nine
             pages: 14 of them across the family, one to three per page, sitting
             between a colon and a comma in the middle of a sentence. Same
             treatment as srcLink and the confirmed line above, and the same
             argument. The read date moves in front of the link so the sentence
             still ends on the control rather than on a date. */ ""}<p class="rt-src" style="margin-top:var(--s6)">${(r.sources || [])
        .map(
          (s, i) =>
            `${esc(s.what)}, read ${esc(longDate(s.read))}. ${
              hostOf(s.url)
                ? `<a class="rt-chk" href="${esc(s.url)}" rel="noopener" target="_blank" aria-label="${esc(
                    /* SHORT, NOT THE WHOLE CLAUSE. `what` runs to 180 characters
                       on Target's second source, and an accessible name that long
                       is read out in full before the reader learns where the link
                       goes. Same shape build-selling.mjs settled on for its own
                       numbered source links. */
                    `${r.name} source ${i + 1}`
                  )}, opens on ${esc(hostOf(s.url))}">Open the page on ${esc(hostOf(s.url))}</a>`
                : ""
            }`
        )
        .join(" ")} Nothing here came from a comparison site, and no price is printed without saying who was
        selling. Prices and shop layouts move, so check before you rely on any of it.</p>
      <p class="rt-src">${BRAND_CREDIT}</p>
    </div>
  </section>
</main>
${footer(
  // The same credit /msrp.html and /what-to-buy.html carry, on the pages that
  // carry the same photographs and only on those. Barnes & Noble has no strip,
  // because no Pokemon product appeared in their own collection on the day, so
  // its footer must not claim to be showing anybody's product photography.
  fmts.length
    ? "Product photos are TCGplayer's, used to identify the sealed formats written about here. " +
        "Each one is a photograph of the format rather than of the box on a shelf near you."
    : ""
)}
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
  ${pictured} sealed formats pictured across ${
    paged.filter((r) => formatsFor(r).length).length
  } of ${paged.length} pages
  ${retailers.length} retailers confirmed, ${(R.couldNotRead || []).length} could not be confirmed
  ${readings.length} price readings (${readings.filter((x) => x.seller === "first-party").length} first-party, ${
  readings.filter((x) => x.seller === "marketplace").length
} marketplace), ${noPrice.length} retailers with none`);
