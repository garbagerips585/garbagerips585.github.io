#!/usr/bin/env node
// Build /msrp.html: what a sealed Pokemon product is SUPPOSED to cost.
//
//   node scripts/build-msrp.mjs
//
// Reads data/msrp.json (a human writes it, see its _readme),
// data/pack-counts-current.json (pack counts and retailer listings, already
// sourced line by line), public/data/products.json and data/extra-products.json
// (the photographs), and data/no-scan.json (the urls that 403).
//
// THE READER IS STANDING IN A SHOP HOLDING A PHONE. That is the whole design
// brief and it decides three things this page does differently from every other
// price page here:
//
//   1. The answer is ABOVE the explanation. Lede, then the list. Nothing that
//      reads like an article sits between the reader and the number, because
//      they are being asked for money right now.
//   2. The prices are the largest type on the page and the rows are one line of
//      scanning each. A shop is a bad place to read.
//   3. The rows with a price come FIRST, in their own band, and the rows we
//      could not source are BELOW them in a second band. A list where every
//      third row is blank cannot be scanned.
//
// ============================================================================
// WHERE THE NUMBERS COME FROM, AND WHAT THIS PAGE MAY CLAIM.
//
// MSRP IS THE MANUFACTURER'S SUGGESTED RETAIL PRICE, AND POKEMON CENTER IS THE
// MANUFACTURER'S OWN SHOP. So the price Pokemon Center sells at IS the price the
// manufacturer suggests. That is the whole of what an MSRP is and there is no
// separate document to go and find.
//
// THIS FILE ARGUED THE OPPOSITE UNTIL 17 AUGUST 2026 AND IT WAS WRONG. It said
// "THE POKEMON COMPANY DOES NOT PUBLISH AN MSRP LIST" and the page repeated it
// three times: in the strip under the lede, in "Who set these numbers", and in a
// paragraph headed "What you should not trust here" claiming nobody is the
// authority on an MSRP that was never published. What the research actually
// found was narrower and still true: NO DOCUMENT TITLED MSRP EXISTS.
// pokemon.com's product showcases itemise every box's contents and state no
// price, and press.pokemon.com carries none either. A missing price LIST is not
// a missing price, and writing it up as one made the page hedge about whether
// the number it was printing existed at all, which is the one thing a reader
// standing in a shop cannot use.
//
// SO A POKEMON CENTER READING IS THE STRONGEST EVIDENCE HERE, not one source
// among several. Where it disagrees with a hobbyist reference table, it wins
// outright and the row says so in plain words rather than quietly dropping the
// loser. A row sourced only from reference tables is careful people reading shop
// listings and agreeing with each other, which is good evidence and is not the
// manufacturer speaking, so kindLabel() prints the two differently.
//
// AND A SUGGESTION IS ALL IT IS, WHICH IS THE POINT OF THE PAGE. No law makes a
// shop honour it. Retailers set their own prices and may charge whatever they
// like, which is why the same Elite Trainer Box is one price from Pokemon and
// several times that on a table at a show. The page exists to hand a reader the
// suggested number so they can do the division on the asked one.
//
// POKEMONCENTER.COM IS BOT GATED AND MUST BE LEFT ALONE BY EVERY SCRIPT HERE.
// Every url on it answers an automated request with a ~1KB challenge page
// carrying NOINDEX, NOFOLLOW and a randomised script path: no prices, no product
// data. Do not try to get around it, do not hotlink its images, and treat a
// route that looks like it works as suspicious rather than lucky. The readings
// this page prints were taken BY A PERSON IN A REAL BROWSER off its own TCG
// cards category page on 17 August 2026, in TWO passes: 31 products first, then
// all ten pages of the category for 400 more, with no product repeated between
// them. All 431 live in data/pokemon-center-prices.json with the product path
// and the date on each one. Re-reading means a person doing that again, by hand,
// and walking the pagination to the end, which the first pass did not.
//
// EVERY FIGURE STILL CARRIES THE DAY IT WAS READ, and that is not hedging. A
// shop price moves, including the manufacturer's own: booster bundles went
// $23.94 to $26.94, and the Pokemon Center ETB $54.99 to $59.99, which this page
// can now state as fact because two boxes were read at the new figure. Confident
// about what the number IS, precise about WHEN.
//
// THE BAR FOR PRINTING A NUMBER is set in data/msrp.json and enforced there
// rather than here: a Pokemon Center price, or the same figure to the cent from
// two independent references. Seven of the thirty three rows do not clear it and
// print no price at all. That is not a gap to fill in later by relaxing the bar.
// This page is ABOUT prices being wrong, so a wrong number on it is worse than a
// missing one, and a page that quietly guessed would be worse than no page.
//
// A BLANK ROW IS NOT ALWAYS A MISSING ANSWER, AND THIS PAGE USED TO PRINT BOTH
// KINDS THE SAME WAY. Six of the seven say "Varies by product" now, because
// Pokemon's own shop sells the type at several prices on one day with no old and
// new about it. That is a finding. Only ONE row is thin, the single-pack blister
// resting on a seven year old listing, and only that one says "Not sourced". The
// distinction is a hand-set `varies` flag in msrp.json and not something derived
// from the shape of the data, for the reason written over noPriceLabel().
//
// AND A BLUNT RULE COST THE DISPLAY BOX ROW A PRICE IT HAD. It read "two prices
// on one day means no number" and applied it to twelve current boxes at $161.64
// standing beside ONE at $161.14. Twelve listings agreeing is an answer and the
// fifty cent outlier belongs in the row's note, which is where it now is. The
// rewritten rule, with both edges of it worked through, is in msrp.json's
// _readme. Weigh the listings. Do not count the distinct prices.
//
// GOING FROM 31 READINGS TO 431 TOOK PRICES OFF FOUR ROWS AS WELL AS PUTTING
// THEM ON SIX, and that is the bar working rather than failing. Tech Sticker
// Collections, collector tins, Premium Collections and Poster Collections each
// printed a figure that rested on a thin sample; the full category shows
// Pokemon's own shop selling each of them at two or more prices on one day, so
// they now print the spread instead. Do not read a falling priced-row count as
// a regression to fix.
//
// NO STORE IS SCORED. "Target charges 2x" is not a claim anything here can
// source: what CAN be sourced is one listing, of one product, on one date, and
// every one this repo holds is printed as an example with the url and the date
// on it. THIRTEEN, NOT FOUR: this file used to read only
// data/pack-counts-current.json, printed the 4 in it, and called them every
// listing the site holds while /retailers.html printed 13. They
// illustrate the arithmetic. They are not a league table of shops, and the page
// says so where they appear. The reader is taught to do the division instead,
// which is the honest version of the same idea.
//
// THAT RULE GOT HARDER TO KEEP ON 17 AUGUST 2026, when the page grew a whole
// band about buying above MSRP, and it is still kept. The band prints the SAME
// listings the other two pages do, out of shared/listings.mjs, ordered by what the product costs
// and never by the multiple, each one saying its product, its shop, its price,
// its date and its address. What it adds is the DURABLE half: what a multiple
// means, and how each KIND of seller arrives at a price, which is the only part
// of any of this that will still be true in a year. The reasoning for the shape,
// and the list of things it refuses to publish, is in data/over-msrp.json's
// _readme. Read it before adding anything to that band.
//
// NO PULL RATES AND NO EXPECTED VALUE, EVER. Site-wide rule. Nothing here says
// or implies what is in a pack, only what the pack should cost.
// ============================================================================

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and two requests for a
// script that finds no tile and a stylesheet whose classes never appear. Same
// call build-openings.mjs and build-pack-prices.mjs both make, and the three
// conditions a page has to meet before it needs them are written beside the two
// exports in shared/chrome.mjs. Read that before adding a video tile here.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, productSrcsetAttr, clipMeta} from "../shared/format.mjs";
// The photograph pins, shared with build-what-to-buy.mjs so a pin exists once.
// See the photography note below.
import { makePhotoFor } from "../shared/product-photos.mjs";
// EVERY DATED SHOP LISTING THIS REPO HOLDS, from both price files, joined and
// checked in one place. See the long note above the listings band below for what
// this page used to do instead and what it cost.
import { loadListings, multStr, readDatePhrase } from "../shared/listings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const msrp = JSON.parse(await readFile(join(ROOT, "data/msrp.json"), "utf8"));
const pc = JSON.parse(await readFile(join(ROOT, "data/pokemon-center-prices.json"), "utf8"));
const counts = JSON.parse(await readFile(join(ROOT, "data/pack-counts-current.json"), "utf8"));
const over = JSON.parse(await readFile(join(ROOT, "data/over-msrp.json"), "utf8"));
const prod = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
const EXTRA = JSON.parse(await readFile(join(ROOT, "data/extra-products.json"), "utf8")).products;

// The 4 TCGplayer urls that answer 403, from the fetch of every image url the
// site emits. Skipped up front rather than hidden behind an onerror, which
// leaves the page paying for a round trip to discover the same thing.
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);

// ---------------------------------------------------------------- pack counts
//
// ONE SOURCE OF PACK COUNTS ON THIS SITE AND IT IS NOT THIS FILE.
// data/pack-counts-current.json holds every count with the pokemon.com or
// retailer page it was read off and the date. This page joins to it on the exact
// `productName` string, which msrp.json carries as `packsFrom`, and prints
// nothing at all when the join misses. Same rule photoFor() below keeps and the
// same one build-openings.mjs and build-how-many-packs.mjs already keep: a join
// that silently lands on the wrong row prints a plausible number for the wrong
// object, which is the failure mode that looks fine.
const byName = new Map((counts.products || []).map((p) => [p.productName, p]));

// ------------------------------------------------------- the Pokemon Center join
//
// THE STORE PRICES ARE NOT TYPED INTO msrp.json AND MUST NOT BE. They live in
// data/pokemon-center-prices.json, one row per product, each with the product
// path it was read off and the date. A row here names the product or products it
// rests on in `pcFrom` and this resolves them.
//
// IT FAILS THE BUILD RATHER THAN WARNING, which is the same call
// checkSetMap makes in shared/decks.mjs and for the same reason: a join that
// misses, or a figure that has drifted from the reading it claims to be, prints
// a plausible number for the wrong object, and that failure looks fine on the
// page. There is no correct page to ship while the two files disagree.
//
// It also derives the row's sourceUrl from the FIRST product's path, so the link
// under a price goes to the exact product the price was read off rather than to
// a category page a reader then has to search.
// A NAME CAN BELONG TO MORE THAN ONE SKU AND THIS RESOLVES TO ALL OF THEM.
//
// It was a Map keyed by name until the second reading pass, which took the
// product count from 31 to 431 and brought two collisions with it: Pokemon
// Center sells TWO "V Heroes Tin (Espeon V)", 699-17151 at $19.99 and
// 699-17163 at $24.99, and two "Collector Chest (Fall 2023)" at the same
// figure. A Map keeps whichever it saw last, so `pcFrom: ["V Heroes Tin
// (Espeon V)"]` would have resolved to $24.99 or to $19.99 depending on the
// order of a JSON array, and the row would have built cleanly either way.
// That is the exact class of failure the price check below exists to catch,
// one field along, so it is caught the same way: loudly, at build time.
const PC_BY_NAME = new Map();
for (const p of pc.products || []) {
  if (!PC_BY_NAME.has(p.name)) PC_BY_NAME.set(p.name, []);
  PC_BY_NAME.get(p.name).push(p);
}

function resolvePC(row) {
  const names = row.pcFrom || [];
  if (!names.length) return null;
  const hits = names.map((n) => {
    const all = PC_BY_NAME.get(n);
    if (!all) {
      throw new Error(
        `build-msrp: data/msrp.json row "${row.label}" claims the Pokemon Center product\n` +
          `  ${JSON.stringify(n)}\n` +
          `  and data/pokemon-center-prices.json has no product with that exact name. Either the\n` +
          `  reading was re-read under a new name, or this is a typo. Do NOT fix it by typing the\n` +
          `  price into msrp.json: fix the name, or drop pcFrom and leave the row unpriced.`
      );
    }
    const prices = new Set(all.map((h) => h.price));
    if (prices.size > 1) {
      throw new Error(
        `build-msrp: row "${row.label}" names the Pokemon Center product\n` +
          `  ${JSON.stringify(n)}\n` +
          `  and data/pokemon-center-prices.json holds ${all.length} products with that exact name at\n` +
          `  DIFFERENT prices:\n` +
          all.map((h) => `    ${h.price} at ${h.path}`).join("\n") +
          `\n  Two SKUs share one shop title, so this name does not identify a price. Name a\n` +
          `  different product, or leave the row unpriced. Do not delete a reading to make it fit.`
      );
    }
    return all[0];
  });
  const differs = hits.filter((h) => h.price !== row.price);
  if (differs.length) {
    throw new Error(
      `build-msrp: row "${row.label}" carries price ${row.price}, but the Pokemon Center reading\n` +
        differs.map((d) => `  ${JSON.stringify(d.name)} is ${d.price}`).join("\n") +
        `\n  The reading is the source. Change the row to match it, or drop the row's price.`
    );
  }
  return {
    n: hits.length,
    names: hits.map((h) => h.name),
    url: `${pc.base || ""}${hits[0].path}`,
    readOn: pc.readOn,
  };
}

/**
 * A retailer's own listed price for this product, or null.
 *
 * ONLY `kind: "retailer listed price"` QUALIFIES. pack-counts-current.json also
 * holds Pokemon Center store prices, and those are BENCHMARKS on this page, not
 * examples of a shop charging over one. Printing a Pokemon Center reading in the
 * "seen listed at" column would have the page comparing a number against itself.
 */
function seenAt(row) {
  const src = row.packsFrom ? byName.get(row.packsFrom) : null;
  const p = src && src.price;
  if (!p || p.isMsrp || p.kind !== "retailer listed price") return null;
  if (typeof p.amount !== "number") return null;
  // The url and the date come off the SOURCE that supports the price, not off
  // the record's own readAt: three of the four rows carry several sources and
  // only one of them is the one that saw a price.
  const s = (src.sources || []).find((x) => (x.supports || []).includes("price"));
  return {
    amount: p.amount,
    retailer: p.retailer || "",
    product: p.product || src.productName,
    url: s ? s.url : "",
    readAt: s ? s.readAt : counts.readAt,
  };
}

const packsFor = (row) => {
  const src = row.packsFrom ? byName.get(row.packsFrom) : null;
  return src && typeof src.packs === "number" && src.packs > 0 ? src.packs : null;
};

// ---------------------------------------------------------------- photography
//
// THE PINS MOVED TO shared/product-photos.mjs ON 17 AUGUST 2026 AND THIS IS THE
// ONLY THING IN THIS FILE THAT CHANGED. build-what-to-buy.mjs was carrying a
// second copy of the subset it pictures and said so in its own comment; two
// copies of a product-to-photograph mapping drift, and a drift here is one box's
// photograph under another box's price. The map, the arguments for every pin and
// for every deliberate NO PIN, and the name check are all in that file now. Read
// it before touching a photograph on this page.
//
// THE NAME CHECK SURVIVED AND IS LOUDER: a pin that no longer resolves to the
// product it names now FAILS THE BUILD instead of silently dropping the picture.
// A row with NO pin still returns null and still gets the hatch, which is what
// the unpinned rows on this page rely on and is why the throw is scoped to pins.
// The line this builder prints at the end counts them, so no count is written
// here to go stale.
const photoFor = makePhotoFor({ products: prod, extra: EXTRA, dead: DEAD });

// 150w, not 200w, and it was checked rather than assumed: the CDN serves a fixed
// set of widths and answers 403 for the rest (50w, 100w and 120w are all 403), so
// a srcset candidate that does not exist is a broken image and not a fallback,
// because the browser has already committed to it. build-openings.mjs fetched all
// 121 of its thumbs at both widths on 2026-08-16 and got 200 at 150w on every
// one, for 1,550.9KB against 2,462.8KB. The box here is 64px, so 150w covers DPR2
// with room.
//
// "AND THE 1000w STAYS IN THE SRCSET FOR ANYTHING DENSER" IS WHAT THAT SENTENCE
// USED TO END WITH, AND IT WAS THIS PAGE'S ENTIRE WEIGHT PROBLEM. "Anything
// denser" is a DPR 3 phone, which is the device this site is actually read on.
// 64 x 3 = 192, 192 clears 150, so all 32 pins took _in_1000x1000.jpg: a
// 547x1000 JPEG of 102 to 135KB in a 64px box, 32 times. Measured at 390x844
// DPR 3, Slow 4G, 4x CPU, over HTTP/2, cache off, medians of 3, this was the
// heaviest page on the site fully scrolled at 3,837.4KB.
//
// THE 64px BOX WAS THE ONE BEING READ AS SAFE and it is the trap. It is smaller
// than the 72, 84 and 88px boxes elsewhere, so it looks like the 48px tables
// that genuinely are safe. It is not the box that decides, it is the RUNG: 48px
// is safe against a 150w rung and 64px is not. productSrcset() in
// shared/format.mjs owns that arithmetic for all seven builders now, and the
// long version of it is in the comment above that function.
//
// NO WIDTH OR HEIGHT ATTRIBUTES. imgDims() returns nothing for tcgplayer-cdn on
// purpose: those files run 200x268 to 200x417 and a declaration would be wrong by
// up to 34%. The box is a fixed 64x64 in CSS, so nothing reflows.
const small = (u) => u.replace(/_200w\.jpg$/, "_150w.jpg");

// THE BOX IS ONE NUMBER NOW AND THAT IS NOT TIDYING. It was written six times:
// twice here, in the srcset's box and in `sizes`, and four times in the stylesheet
// below, in .ms-head's first grid track and in .ms-pic and .ms-nopic. Six copies
// of a number that three of the six only work when they AGREE.
//
// It got a name on 21 August 2026 because the srcset stopped being slack. Until
// then the ladder was 150w then 400w, so a box anywhere from 51 to 133px took
// _400w at DPR 3 and a stale `sizes` could not be seen: every wrong declaration
// in that range resolved to the same file. The middle rung is offered now, so
// 64px takes _200w, which is 200 real pixels against the 192 the box asks for.
// That is correct and it is 4% of headroom. Widen .ms-pic to 67 and leave this
// at 64 and the page goes quietly soft, which is the /hall.html "FIVE PIXELS"
// trap in CLAUDE.md arriving on a new page. One constant is the guard.
const PIC_BOX = 64;

// `eager` IS FOR THE FIRST ROW'S PHOTOGRAPH ONLY, and it is the same call
// build-what-to-buy.mjs's `shot()` already makes for the first card on that
// page. Measured on the built page at 390x844 DPR2: the first priced row's
// picture sits at y=620, inside the fold, so `loading="lazy"` was deferring an
// image the reader can already see. An image in the viewport at first paint
// gains nothing from lazy and can lose a little. Everything below it stays lazy.
const shot = (row, { eager = false } = {}) => {
  const p = photoFor(row.rowId);
  if (!p) return `<span class="ms-pic ms-nopic" aria-hidden="true"></span>`;
  return `<img class="ms-pic" src="${esc(small(p.src))}"${
    productSrcsetAttr(small(p.src), PIC_BOX)
  } sizes="${PIC_BOX}px" alt="${esc(p.name)}, sealed"${eager ? "" : ' loading="lazy"'} decoding="async"
        referrerpolicy="no-referrer" onerror="this.remove()">`;
};

const shotName = (row) => {
  const p = photoFor(row.rowId);
  return p ? p.name : "";
};

// ---------------------------------------------------------------------- rows
//
// `rowId` EXISTS BECAUSE `id` IS NOT UNIQUE HERE AND MUST NOT BE MADE SO.
// `id` is the taxonomy tag, which is what links a row to /openings/<id>.html,
// and the taxonomy deliberately buckets an ETB and a Pokemon Center ETB under
// one tag, and a mini tin and a collector tin under another. Those pairs have
// DIFFERENT prices, which is the entire point of this page, so they are separate
// rows sharing one tag. rowId defaults to id where a row does not need its own.
const rows = (msrp.products || []).map((r) => {
  // The reading file owns the url and the date on any row that rests on it, so a
  // row cannot carry a stale date beside a price that has since been re-read.
  const pcHit = resolvePC(r);
  return {
    ...r,
    rowId: r.rowId || r.id || "",
    packs: packsFor(r),
    seen: seenAt(r),
    pc: pcHit,
    sourceUrl: pcHit ? pcHit.url : r.sourceUrl,
    readOn: pcHit ? pcHit.readOn : r.readOn,
  };
});

const priced = rows.filter((r) => typeof r.price === "number");
const blank = rows.filter((r) => typeof r.price !== "number");
// Counted rather than written down, because the split is quoted in the lede and
// in two paragraphs of body copy and it moves every time a row is closed.
const store = priced.filter((r) => r.priceKind === "store");
// The two kinds of unpriced row, counted for the same reason: the split between
// "the research finished and the type has no one price" and "the research is
// thin" is quoted in the band's lede and moves whenever a row is closed or a
// `varies` flag is set. See noPriceLabel() and msrp.json's _readme.
const varies = blank.filter((r) => r.varies);
const thin = blank.filter((r) => !r.varies);

if (!priced.length) {
  throw new Error(
    "build-msrp: not one row in data/msrp.json carries a price, so the page would " +
      "be a list of blanks under a heading promising prices. Fill at least one in, " +
      "or take this builder out of build-all.mjs."
  );
}

// The "we could not source it" rows are the honest half of the page and they
// are LOUD about it, but a page is not improved by being all of them. If it ever
// gets there the page should be reconsidered rather than shipped, so this says so
// on the console rather than failing a build over a judgement call.
if (blank.length > priced.length) {
  console.log(
    `  note: ${blank.length} of ${rows.length} rows have no sourced price, which is more\n` +
      `  than half. The page still renders, but a majority-blank list is worth a look.`
  );
}

const SOURCES = msrp.sources || {};
const nSources = Object.keys(SOURCES).length;

/** How many independent readings back a row, the primary plus its corroboration. */
const backing = (r) => 1 + (r.agrees || []).length;

/**
 * The small line under a price. It has to carry three things in one line on a
 * 390px screen: what KIND of number it is, who said so, and when it was read.
 *
 * The primary source is NAMED and the rest are COUNTED, rather than all of them
 * being listed. Four source names on a row is 60 characters of small type
 * between the reader and the next price, and the full description of every
 * source, with its url and what it actually is, is in one place at the foot of
 * the page where it can be read properly.
 */
const provenance = (r) => {
  const extra = (r.agrees || []).length;
  const who =
    r.priceKind === "store"
      ? `${esc(r.source)}, the manufacturer's own shop`
      : esc(r.source);
  // "on 2 listings" earns its four words: two separate boxes at the same figure
  // on the same day is a different quality of evidence from one, and the reader
  // can check both, because the reading file holds a path for each.
  // A COMMA LIST, NOT A SENTENCE. With two clauses present the "and" version
  // read "the manufacturer's own shop on 2 listings and 2 more agree", which
  // parses as the shop agreeing with itself. Commas in 12px mono scan anyway.
  return (
    `${who}${
      extra ? `, ${extra} more agree${extra === 1 ? "s" : ""}` : ""
    }, read ${esc(longDate(r.readOn))}`
  );
};

/**
 * The word over the number, and the two are NOT the same claim.
 *
 * A Pokemon Center price is the manufacturer's own shop, so it is an MSRP in the
 * literal sense of the phrase and the label says so flatly. A refs price is two
 * or more people reading listings and landing on the same figure, which is good
 * evidence about what the suggestion is rather than the suggestion itself, and
 * the label keeps that distance. Do not collapse them into one word.
 */
const kindLabel = (r) =>
  r.priceKind === "store"
    ? "MSRP, Pokemon's own shop"
    : "MSRP, per price references";

// A multiple, printed the way the calculator prints one: two decimals with the
// trailing zeros trimmed, so 2.00 reads "2" and 1.20 reads "1.2". ONE FUNCTION
// FOR ALL THREE PLACES that do this sum (the row, the markup band, the
// calculator's own copy in the browser), because two of them drifting apart
// would show the same listing at two different multiples on one page. It is
// imported from shared/listings.mjs now rather than declared here, so the SAME
// rounding reaches /retailers.html and /what-to-buy.html, which divide several
// of these same listings by these same figures.

// The example of a shop over the number, where one is sourced. ONE LISTING, ONE
// PRODUCT, ONE DATE, and it says all three, because "Target charges 1.2x" is a
// claim about a company and this is a claim about a web page on an afternoon.
const seenLine = (r) => {
  if (!r.seen) return "";
  const mult = typeof r.price === "number" ? r.seen.amount / r.price : null;
  return `        <p class="ms-seen"><b>Seen listed at ${esc(moneyExact(r.seen.amount))}</b>${
    mult ? `, which is ${esc(multStr(mult))}x` : ""
  }. That is one listing, the ${esc(r.seen.product)} at ${esc(r.seen.retailer)}, read ${esc(
    longDate(r.seen.readAt)
  )}. It is an example of the sum, not a score for the shop.${
    r.seen.url
      ? ` <a href="${esc(r.seen.url)}" rel="nofollow noopener" target="_blank" aria-label="See the listing, the ${esc(
          r.seen.product
        )} at ${esc(r.seen.retailer)}, opens on their site">See the listing</a>`
      : ""
  }</p>`;
};

// Which /openings/ pages exist, read rather than assumed: build-openings.mjs
// only writes a page for a product this channel has actually filmed, so several
// of these ids have no page and an emitted link would be a 404 that check-build
// catches late. build-msrp.mjs runs AFTER build-openings.mjs in build-all.mjs
// for exactly this reason.
const OPENINGS = new Set(
  (await readdir(join(ROOT, "public/openings")).catch(() => []))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => f.slice(0, -5))
);

/**
 * The product name, linked to its /openings/ page where one exists.
 *
 * THIS WAS A PILL BUTTON UNDER EVERY ROW AND IT WAS WRONG TWICE.
 *
 * It read "What is in one, and ours opened" on all nineteen rows. That is
 * nineteen links with identical text, which is the exact fault build-openings.mjs
 * writes several paragraphs about avoiding on its own rip lists: a screen reader
 * announces link text with no surrounding context, so a tab through this page
 * was the same sentence nineteen times. Linking the NAME fixes it for free,
 * because the name is already unique and already describes the destination.
 *
 * It also cost about 1,100px of page on a phone, in a column whose reader is
 * standing in a shop scanning for one number. Nothing that pushes the next price
 * further down earns 60px per row unless it is the price.
 *
 * MIN-HEIGHT 44px ON THE LINK, not on the heading, so the tap target is the
 * thing being tapped. Costs ~23px a row against the pill's ~60px, and the row
 * still reads as a heading rather than as a button.
 */
const nameCell = (r) =>
  r.id && OPENINGS.has(r.id)
    ? `<h3><a class="ms-name" href="/openings/${esc(r.id)}.html">${esc(r.label)}</a></h3>`
    : `<h3>${esc(r.label)}</h3>`;

/**
 * The exact product a store price was read from, named in visible text.
 *
 * THIS IS THE SAME OBLIGATION `pictured:` ALREADY MEETS, one clause along. A
 * photograph of one set's box standing in for a product TYPE has to name the box
 * it is actually a photograph of, and a price read off one set's box standing in
 * for the same type has to name the box it is actually the price of. Without it
 * "Pokemon Center, read 17 August 2026" is a claim about 431 products at once.
 *
 * IT IS A NAME AND NOT A LINK, deliberately. This site keeps a very short list
 * of outbound links and argues each one in CLAUDE.md; putting a link on all 13
 * store rows would add more outbound links than the rest of the site holds
 * outside the playlist cards, and it would do it quietly. The name is exact, so
 * it is searchable, and data/pokemon-center-prices.json holds the address for
 * every reading beside it.
 *
 * The second and later products are COUNTED rather than listed. Both Tech
 * Sticker Collections named in full is 118 characters of mono in the line under
 * a price, and what the reader needs from the second one is that it existed and
 * agreed.
 */
const readFrom = (r) => {
  if (!r.pc || !r.pc.names || !r.pc.names.length) return "";
  const [first, ...rest] = r.pc.names;
  return ` &bull; read from: ${esc(first)}${
    rest.length ? `, and ${rest.length} more at the same price` : ""
  }`;
};

// WHAT DISAGREES WITH A PRICE THAT GOT PRINTED ANYWAY.
//
// A Pokemon Center reading outranks a reference table, so it sets the number.
// That is not a licence to delete the reference. The row keeps it, names it,
// dates it, and says which of the two is the manufacturer, because the reader
// may be standing in front of a shelf priced off the other figure and a page
// that hid the conflict has told them less than one that shows it.
//
// Reuses .ms-spread, which is the same grey callout the blank rows use for the
// same job. The wording is what differs: there the sources disagree and nothing
// wins, here one of them does.
const conflictLine = (r) => {
  const ds = (r.disagreesWith || []).filter((d) => typeof d.amount === "number");
  if (!ds.length) return "";
  const who = ds
    .map(
      (d) =>
        `${esc(moneyExact(d.amount))} (${esc(d.source)}${d.as ? `, ${esc(d.as)}` : ""}, read ${esc(
          longDate(d.readOn)
        )})`
    )
    .join(", ");
  const why =
    r.priceKind === "store"
      ? `The figure above is Pokemon's own shop price, so it is the one to hold, and this is here because a shelf near you may be priced off the other one.`
      : `Neither is the manufacturer, so treat the gap as the width of the answer.`;
  return `        <p class="ms-spread"><b>Not everybody agrees.</b> ${who}. ${why}</p>`;
};

const pricedRow = (r, i) => `      <li class="ms-row">
        <div class="ms-head">
          ${shot(r, { eager: i === 0 })}
          <div class="ms-id">
            ${nameCell(r)}
            <p class="ms-what">${esc(r.what)}</p>
          </div>
          <p class="ms-price"><b>${esc(moneyExact(r.price))}</b><span>${esc(kindLabel(r))}</span></p>
        </div>
        <p class="ms-prov">${provenance(r)}${
          r.packs ? ` &bull; ${r.packs} pack${r.packs === 1 ? "" : "s"} inside` : ""
        }${shotName(r) ? ` &bull; pictured: ${esc(shotName(r))}` : ""}${readFrom(r)}</p>
${conflictLine(r)}${seenLine(r)}${
  r.note ? `        <p class="ms-note">${esc(r.note)}</p>\n` : ""
}      </li>`;

// A row with no price shows the SPREAD its sources disagree across, when they
// disagree. That is deliberate and it is not the rule being bent: a spread is
// visibly not a number to hold a shop to, it is labelled as one in the row, and
// a reader looking at a $16 pack is genuinely better off knowing the honest
// answer is somewhere around four or five dollars than being told nothing.
const spread = (r) => {
  const ds = (r.disagree || []).filter((d) => typeof d.amount === "number");
  if (!ds.length) return "";
  const lo = Math.min(...ds.map((d) => d.amount));
  const hi = Math.max(...ds.map((d) => d.amount));
  const who = ds
    .map((d) => `${esc(moneyExact(d.amount))} (${esc(d.source)}${d.as ? `, ${esc(d.as)}` : ""})`)
    .join(", ");
  // "THE SOURCES RUN" IS WRONG WHEN THERE IS ONE SOURCE, and there now is one:
  // the stacking tins are five products in Pokemon's own shop, on one day, at
  // two prices. Saying sources disagree there would invent a second party and
  // would hide the more interesting fact, which is that the manufacturer itself
  // does not price the type at one figure.
  const names = [...new Set(ds.map((d) => d.source))];
  const lead =
    names.length === 1
      ? `${esc(names[0])} itself runs`
      : `The sources run`;
  // "NO AGREED FIGURE" IS THE WRONG HEADING ON A ROW THAT VARIES BY PRODUCT. It
  // says the parties failed to agree, when what actually happened is that the
  // research finished and found several live prices. Same spread, same numbers,
  // honest heading. See noPriceLabel() and msrp.json's _readme.
  return `        <p class="ms-spread"><b>${
    r.varies ? "No single price." : "No agreed figure."
  }</b> ${lead} ${esc(moneyExact(lo))} to ${esc(
    moneyExact(hi)
  )}: ${who}. Treat that as the rough shape of the answer rather than
          a price to hold a shop to.</p>`;
};

// THE TWO KINDS OF BLANK ARE NOT THE SAME CLAIM AND USED TO PRINT THE SAME WAY.
// A row can carry no price because nobody found one, or because the research
// finished and the answer is that the TYPE does not have one price: five Tech
// Sticker Collections at $14.99 and five at $15.99, all current, all Pokemon's
// own figure. The second is a finding and the first is a hole, and "No one
// figure / prices differ" over both made the finding look like the hole.
// `varies` in data/msrp.json is set by hand, one row at a time, under the rule
// written in that file's _readme. It is deliberately NOT derived from
// `disagree.length`: the single-pack blister has an empty disagree array and the
// display box row had a full one on the day it should have been printing a price.
const noPriceLabel = (r) =>
  r.varies
    ? ["Varies by product", "no single price"]
    : (r.disagree || []).length
      ? ["No one figure", "sources differ"]
      : ["Not sourced", "no figure found"];

const blankRow = (r) => `      <li class="ms-row ms-blankrow">
        <div class="ms-head">
          ${shot(r)}
          <div class="ms-id">
            ${nameCell(r)}
            <p class="ms-what">${esc(r.what)}</p>
          </div>
          <p class="ms-price ms-noprice"><b>${esc(noPriceLabel(r)[0])}</b><span>${esc(
            noPriceLabel(r)[1]
          )}</span></p>
        </div>
        <p class="ms-why">Why: ${esc(r.blank || "not sourced")}.</p>
${spread(r)}${seenLine(r)}${r.note ? `        <p class="ms-note">${esc(r.note)}</p>\n` : ""}      </li>`;

// ======================================================= buying above the MSRP
//
// THE BAND THAT TEACHES THE SUM, and it is a BAND ON THIS PAGE rather than a
// page of its own. That was argued rather than assumed. The reader this whole
// file is designed around is standing in a shop holding a box, and the suggested
// figure and the evidence about markups answer ONE question between them: is
// this price mad. Two urls means two loads, two taps and two things to keep in
// your head in an aisle, and it lets the halves drift: a second page would carry
// its own copy of "a suggestion binds nobody" and its own multiples, and nothing
// would fail when they stopped agreeing with these. The counter-argument is real
// and it is length, so the band goes BELOW the calculator, where a reader who
// only wanted the number has already been served twice over.
//
// -------------------------------------------------------------- THE LISTINGS
//
// THIS BAND PRINTED FOUR OF THEM AND SAID, IN THOSE WORDS, THAT THEY WERE
// "every dated, sourced shop listing this site holds". THIRTEEN EXIST. The four
// were the ones in data/pack-counts-current.json, which is the only price file
// this builder used to open, and the sentence around them was a COMPLETENESS
// claim about a set it could not see. /retailers.html has printed all thirteen
// since data/retailer-prices.json landed, so the two pages contradicted each
// other and each one was internally consistent, which is why nothing caught it.
//
// THE COMMENT THAT USED TO SIT HERE MADE IT WORSE, not better: it said "Four is
// the whole of it: a sweep of every other data file in this repo on 17 August
// 2026 found no other dated, url-sourced price a named shop was asking for a
// named sealed product." That was written the same day the nine readings in
// data/retailer-prices.json were gathered, and it got quoted as a reason not to
// look. A completeness claim in a comment ages exactly as badly as one on a page.
//
// SO THE SET IS NOT ASSEMBLED HERE ANY MORE. shared/listings.mjs merges both
// files, joins every row to a priced data/msrp.json row, refuses any row without
// a seller, and throws on anything it cannot resolve. /retailers.html and
// /what-to-buy.html read the same array. The count below is `listings.length`
// and there is no number typed into the copy, so the sentence cannot come apart
// from the list under it again.
//
// ORDERED BY WHAT THE PRODUCT COSTS, CHEAPEST FIRST, AND NEVER BY THE MULTIPLE.
// Sorting by the multiple would build a league table out of thirteen data points
// and would put the biggest number at the top of the band, which is the
// scoreboard this page refuses to be. Cheapest-product-first also happens to
// teach the real lesson better: the worst multiple here is on a single pack and
// the box, the scariest number in dollars, is not the worst deal on the page.
const { listings: allListings, readDates: listingDates } = await loadListings();
const listings = [...allListings].sort((a, b) => a.base - b.base || a.amount - b.amount);
const listingShops = new Set(listings.map((l) => l.retailerId)).size;

/**
 * One listing, printed as a worked sum.
 *
 * THE URL IS PRINTED AND NOT LINKED, and that is the site's outbound link rule
 * rather than an oversight. Four of these are already linked once each, in the
 * callout on their own row above, and CLAUDE.md's standing complaint is about
 * outbound links that arrive quietly at the foot of a page. Printing the address
 * in full is what the page already does for the exact product name behind every
 * store price: name it so it can be checked, do not hand the reader a door out
 * of the site twice for the same destination.
 *
 * THE SUM IS SHOWN AS ARITHMETIC, not as a verdict. A reader who can see
 * 9.99 divided by 4.49 can do it again tomorrow on a different sticker, which is
 * the only part of this band with a shelf life longer than a fortnight.
 *
 * WHO WAS SELLING IS PRINTED ON EVERY ROW. data/retailer-prices.json will not
 * hold a price without it, and the reason is in that file's _readme: on Target,
 * Walmart, Best Buy and Amazon a price on the site may be the chain's or an
 * independent reseller's, and printing the second as the first reports a named
 * company as asking a multiple it never asked. Every row here is currently
 * first-party; the marketplace wording exists so that the day one is not, this
 * band says so rather than quietly naming the wrong party.
 */
const listingCard = (l) => {
  const m = l.amount / l.base;
  return `        <li class="ov-l">
          <p class="ov-mult"><b>${esc(multStr(m))}x</b><span>the suggested price</span></p>
          <p class="ov-sum">${esc(moneyExact(l.amount))} asked, ${esc(
            moneyExact(l.base)
          )} suggested. ${esc(l.amount.toFixed(2))} &divide; ${esc(l.base.toFixed(2))} = ${esc(
            multStr(m)
          )}.</p>
          <p class="ov-what"><b>${esc(l.product)}</b> at ${esc(l.retailerName)}, read ${esc(
            longDate(l.read)
          )}.</p>
          <p class="ov-src">One listing, one product, one day, sold by ${
            l.seller === "first-party" ? "the shop itself" : "an independent seller on their site"
          }. It is an example of the sum, not a
            score for the shop.${l.url ? ` Read at ${esc(l.url)}` : ""}</p>
        </li>`;
};

// ---------------------------------------------------- the thirteen, on one axis
//
// WHAT THE PICTURE SAYS THAT THE THIRTEEN CARDS BELOW IT DO NOT. Each card is a
// worked sum and every one of them is right, and no reader can hold thirteen of
// them in their head. The band's claim is about the SPREAD: that most shops sell
// over the suggested price, that how far over runs from nothing to more than
// double, and that where a listing lands is a fact about that listing rather
// than about the shop. Thirteen cards, each 200px tall on a phone, cannot show a
// spread. One axis can, and it is the same axis the reader has just been taught
// to compute in the calculator two sections up.
//
// THE ROWS ARE THE CARDS' OWN ORDER, cheapest product first, and never the
// multiple. That is the rule this band already keeps and it matters more in a
// drawing than in a list: bars sorted by length ARE a league table, whatever the
// caption underneath says. It also happens to make the picture argue better,
// because the longest bar on it belongs to the cheapest thing on it.
//
// THE SHOP IS NOT NAMED ON A BAR. It is on the card below, with the date, the
// seller and the address. A chart row is four words wide and "GameStop 2.22x" in
// isolation is exactly the scoreboard this page refuses to be, so a row carries
// the PRODUCT TYPE, which is the thing the multiple is actually about.
//
// ONE FILL AND A DATUM, NOT A TWO TONE BAR. The first draft drew the part over
// 1x in solid ink and the part under it in the paper tone, which is a stronger
// picture and is wrong on any listing UNDER the suggested price: the under-1x
// block is a fixed length, so a 0.9x listing would have drawn a full 1x block
// and overstated it. There is no such listing today. Drawing it so that there
// cannot be one is cheaper than a check that has to be remembered.
const OV_MULT = listings.map((l) => l.amount / l.base);
const OV_MAX = Math.max(...OV_MULT);
const OV_MIN = Math.min(...OV_MULT);

// THE SAME PRODUCT TYPE AT TWO MULTIPLES IS THE POINT OF THE WHOLE BAND, so it
// is computed rather than asserted in prose: which suggested-price rows this set
// of listings hits more than once, and what the widest gap between two readings
// of one type is. If a re-read ever leaves every type appearing once, the
// sentence about it disappears with the fact instead of outliving it.
const OV_BY_TYPE = new Map();
for (const l of listings) {
  if (!OV_BY_TYPE.has(l.baseLabel)) OV_BY_TYPE.set(l.baseLabel, []);
  OV_BY_TYPE.get(l.baseLabel).push(l.amount / l.base);
}
const OV_REPEATS = [...OV_BY_TYPE.entries()]
  .filter(([, ms]) => ms.length > 1 && Math.max(...ms) - Math.min(...ms) > 0.005)
  .map(([label, ms]) => ({ label, lo: Math.min(...ms), hi: Math.max(...ms) }))
  .sort((a, b) => b.hi - b.lo - (a.hi - a.lo));

const OV_OVER = listings.filter((l) => l.amount / l.base > 1.005).length;
const OV_AT = listings.filter((l) => Math.abs(l.amount / l.base - 1) <= 0.005).length;
const OV_UNDER = listings.filter((l) => l.amount / l.base < 0.995).length;

if (OV_UNDER) {
  console.log(
    `  note: ${OV_UNDER} of the ${listings.length} listings is under the suggested price. The band's\n` +
      `  heading says most shops sell over it and the figure draws the axis from zero, so both still\n` +
      `  hold, but the copy around them is worth re-reading before this ships.`
  );
}

const ovRow = (l) => {
  const m = l.amount / l.base;
  return `          <li>
            <span class="ov-fn">${esc(l.baseLabel)}</span><b class="ov-fv">${esc(multStr(m))}x</b>
            <span class="ov-ft" aria-hidden="true"><span class="ov-fb" style="width:${(
              (m / OV_MAX) *
              100
            ).toFixed(1)}%"></span><span class="ov-fd" style="left:${((1 / OV_MAX) * 100).toFixed(
    1
  )}%"></span></span>
          </li>`;
};

const spreadFig = () => `      <figure class="ms-fig">
        <ul class="ov-fig">
${listings.map(ovRow).join("\n")}
        </ul>
        ${/* aria-hidden on the tracks only. Every multiple a bar draws is printed
              as a number on its own row here and worked out in full on the card
              below, so announcing the bar would read the same thirteen figures a
              third time. The finding is in the figcaption, in words. */ ""}
        <figcaption>The same ${listings.length} listings as the cards below, in the same order, cheapest
          product first. The upright mark is the suggested price: a bar reaching it is a shop asking
          exactly what the manufacturer does, and everything right of it is the part over.
          ${
            OV_AT
              ? `${OV_AT === 1 ? "One" : OV_AT} of the ${listings.length} lands on the mark. `
              : ""
          }${OV_OVER} sit past it, the furthest at ${esc(multStr(OV_MAX))}x.${
            OV_REPEATS.length
              ? ` <b>Read across the types, not down the list.</b> ${
                  OV_REPEATS.length === 1 ? "One product type appears" : `${OV_REPEATS.length} product types appear`
                } here twice at two different multiples, the ${esc(OV_REPEATS[0].label)} at ${esc(
                  multStr(OV_REPEATS[0].lo)
                )}x and ${esc(
                  multStr(OV_REPEATS[0].hi)
                )}x, which is why a multiple is a fact about one listing on one afternoon and never a score for a shop.`
              : ""
          }</figcaption>
      </figure>`;

const bandRow = (b, i, all) => {
  const from = i === 0 ? "1x" : `${all[i - 1].upto}x`;
  const to = b.upto ? `${b.upto}x` : "and up";
  return `        <li class="ov-b">
          <p class="ov-brange"><b>${esc(b.upto ? `${from} to ${to}` : `${from} ${to}`)}</b><span>${esc(
            b.label
          )}</span></p>
          <p class="ov-bwhat">${esc(b.what)}</p>
        </li>`;
};

const kindRow = (k) => `        <li class="ov-k">
          <h4>${esc(k.name)}</h4>
          <p>${esc(k.whatDecides)}</p>
          <p class="ov-watch"><b>Worth knowing.</b> ${esc(k.watch)}</p>${
            k.source ? `\n          <p class="ov-ksrc">Read from: ${esc(k.source)}.</p>` : ""
          }
        </li>`;

const para = (ps) => ps.map((p) => `        <p>${esc(p)}</p>`).join("\n");

// ------------------------------------------------------------- the calculator
//
// IT IS BELOW THE LIST AND THAT IS THE MEASURED DECISION, not a filing choice.
// At 390x844 the bar, the crumbs, the h1 and the lede already spend most of the
// first screen; a calculator above the list pushes the first PRICE, which is the
// thing the reader came for, entirely below the fold. The list answers the
// question at a glance and the calculator does the division for anybody who
// wants the multiple stated.
//
// It is also the whole of the JavaScript on this page and the page is complete
// without it: with JS off the fields do nothing and every number is still there.
// The `<option>` values are written from the same `priced` array the list is, so
// the picker cannot offer a product the list does not price.
const calcOptions = priced
  .map((r) => `<option value="${r.price}">${esc(r.label)} &bull; ${esc(moneyExact(r.price))}</option>`)
  .join("\n            ");

const STYLE = `
.ms-lede{max-width:46em}

/* THE STRIP UNDER THE LEDE IS NOT DECORATION. It is the sentence that stops
   somebody quoting this page at a shop as though The Pokemon Company published
   it, and it has to be read before the prices are, so it sits above them and
   carries the page's only heavy border.
   IT IS ONE SENTENCE AND IT WAS THREE. Measured at 390x844 the long version put
   the first PRICE at 1,121px, so the entire first screen of a page whose reader
   is standing in a shop being asked for money was prose. It is the thing this
   page exists to avoid and it went in anyway. The full argument did not get
   shorter, it moved: it is the "What MSRP actually means here" section, which
   this links straight down to.
   RE-MEASURED 17 AUGUST 2026, headless Chrome at 390x844 DPR2, after the strip
   was rewritten to say what a suggested price IS rather than to hedge about
   whether one exists. The strip runs 347px to 445px, three lines, and the first
   price's 32px glyph runs 749px to 781px against a 844px viewport, so it clears
   the fold whole with 63px under it. A FOURTH LINE IN HERE COSTS ~23px AND THE
   FOLD IS THE BUDGET: the first draft of that rewrite ran to four lines and put
   the price at 772px. Anything added here comes out of those 63px. */
.ms-warn{max-width:46em;margin:0 0 var(--s3);padding:var(--s3) var(--s4);
  border:3px solid var(--keyline);border-radius:var(--r);background:var(--paper-3);
  font-size:.95rem;line-height:1.5}
.ms-warn b{font-weight:800}

/* Tight, because it is here for heading order (the rows are h3) and to say the
   count, not to introduce anything. A full-size h2 with the site's usual margins
   costs about 90px directly above the number the reader came for. */
.ms-h2{margin:0 0 var(--s4);font-size:1.15rem}

.ms-list{list-style:none;margin:0;padding:0;display:grid;gap:var(--s4)}
.ms-row{border:3px solid var(--keyline);border-radius:var(--r);background:var(--card);
  padding:var(--s4);box-shadow:var(--hard-lg)}

/* PHONE FIRST AND IT IS A COLUMN, NOT A TABLE. A four column table at 390px
   either scrolls sideways, which hides the price, or squeezes the price into
   about 60px, which is the one thing on the page that has to be big. So the
   picture and the name sit on one row and the PRICE DROPS UNDERNEATH THEM at
   full width, where it gets to be 2rem. Above 560px there is room for all three
   across and the price goes back to the right, hard against the edge, which is
   where an eye scanning a column of prices wants it. */
.ms-head{display:grid;grid-template-columns:${PIC_BOX}px 1fr;gap:var(--s3);align-items:start}
/* PIC_BOX, not a literal: see the comment beside it. The sizes attribute up
   there is the same number, and the srcset only covers the box while they
   agree. No backticks in here: this comment is inside a template literal. */
.ms-pic{grid-row:span 2;width:${PIC_BOX}px;height:${PIC_BOX}px;object-fit:contain;border-radius:6px;
  background:var(--paper-3)}
.ms-nopic{grid-row:span 2;width:${PIC_BOX}px;height:${PIC_BOX}px;border-radius:6px;
  background:repeating-linear-gradient(45deg,var(--paper-3),var(--paper-3) 5px,
    var(--paper) 5px,var(--paper) 10px)}
.ms-id h3{margin:0;font-size:1.05rem;line-height:1.25}
.ms-what{margin:var(--s1) 0 0;font-size:.85rem;color:var(--ink-soft);line-height:1.4}
.ms-price{grid-column:2;margin:var(--s3) 0 0;display:flex;flex-direction:column;gap:2px}
.ms-price b{font-size:2rem;line-height:1;font-weight:800;letter-spacing:-.01em}
.ms-price span{font:700 .68rem/1.2 var(--mono);letter-spacing:.04em;
  text-transform:uppercase;color:var(--ink-soft)}
.ms-noprice b{font-size:1.1rem;color:var(--ink-soft)}
/* THE REASON A ROW HAS NO PRICE IS A SENTENCE AND IT DOES NOT GO IN THE PRICE
   CELL. It did, and one of them ("the price genuinely varies by product, so
   there is no one figure") is 63 characters of uppercase mono, which at 1440
   took the auto-sized price column out to 450px and squeezed "Ultra Premium
   Collection" into a five-line stack about 60px wide. The cell now carries a
   fixed short label and the reason gets its own line, where it can wrap. */
.ms-why{margin:var(--s3) 0 0;font:.75rem/1.45 var(--mono);color:var(--ink-soft)}

.ms-prov{margin:var(--s3) 0 0;font:.75rem/1.45 var(--mono);color:var(--ink-soft)}
.ms-note,.ms-seen,.ms-spread{margin:var(--s3) 0 0;font-size:.85rem;line-height:1.45}
.ms-seen{padding:var(--s3);border-radius:6px;background:var(--paper-3)}
/* 44x44 ON THE FOUR OUTBOUND LISTING LINKS, and not on the inline prose links
   elsewhere on the page. The difference is real: these four are the page's only
   ACTIONS, each opens somebody else's site, and each sits in its own callout box
   where a pill does not disturb a line of running text. Turning every "pack
   prices" and "packs per box" cross-reference in a paragraph into a 44px box
   would break the measure on every page of this site, so those stay inline and
   stay at the site's normal size. Measured at 390: 61x18 before, 44 tall after,
   for about 26px a row on four rows.
   Each one also carries an aria-label naming the product, the shop and the fact
   that it leaves the site, because the visible text is "The listing" on all four
   and four identically named links is what an aria-label is for. */
/* display:flex, NOT inline-flex, so the pill drops onto its OWN line inside the
   paragraph. Inline it sat mid-sentence with the closing full stop stranded
   after it and the line above it forced open to 44px, which at 1440 read as a
   layout bug rather than as a button. */
.ms-seen a{display:flex;width:fit-content;align-items:center;min-height:44px;padding:0 var(--s3);
  margin-top:var(--s3);border:2px solid var(--keyline);border-radius:var(--r-pill);
  background:var(--paper);text-decoration:none;font-weight:700;font-size:.8rem}
.ms-seen a:hover{background:var(--mustard);color:var(--on-accent)}
.ms-spread{padding:var(--s3);border-radius:6px;background:var(--paper-3)}
/* 44px MINIMUM ON EVERY TAPPABLE THING, and on a heading link that has to come
   from the LINK rather than from the heading, or the box a finger has to hit is
   still one line of text tall. */
.ms-name{display:inline-flex;align-items:center;min-height:44px;
  color:inherit;text-decoration:underline;text-underline-offset:3px;
  text-decoration-thickness:2px;text-decoration-color:var(--gold)}
.ms-name:hover{text-decoration-color:var(--keyline)}

@media(min-width:560px){
  .ms-head{grid-template-columns:64px 1fr auto;align-items:center}
  .ms-pic,.ms-nopic{grid-row:auto}
  /* max-width, because the third column is "auto" and an auto track is sized by
     its content: the sub-label under the price is the widest thing in it, and a
     long one takes the width straight out of the product name beside it. 12em
     holds "MSRP, per price references" on two lines and cannot grow past that. */
  .ms-price{grid-column:auto;margin:0;text-align:right;align-items:flex-end;max-width:12em}
}

/* THE CALCULATOR. Two fields and one sentence. */
.ms-calc{max-width:46em;border:3px solid var(--keyline);border-radius:var(--r);
  background:var(--card);padding:var(--s4);box-shadow:var(--hard-lg)}
.ms-fields{display:grid;gap:var(--s3);margin:var(--s4) 0 0}
.ms-fields label{display:block;font:700 .75rem/1.4 var(--mono);letter-spacing:.03em;
  text-transform:uppercase;color:var(--ink-soft);margin-bottom:var(--s1)}
/* 44px, and 16px on the input so iOS does not zoom the page when it is focused,
   which on a phone in a shop reads as the site breaking. */
.ms-fields select,.ms-fields input{width:100%;min-height:44px;font-size:16px;
  padding:0 var(--s3);border:2px solid var(--keyline);border-radius:6px;
  background:var(--paper-2);color:var(--ink);font-family:var(--body)}
.ms-out{margin:var(--s4) 0 0;font-size:1.05rem;line-height:1.45;min-height:1.45em}
.ms-out b{font-size:1.5rem;font-weight:800}
@media(min-width:560px){ .ms-fields{grid-template-columns:1fr 1fr;align-items:end} }

/* ------------------------------------------------- the above-MSRP band.
   Three lists in one band and they are deliberately the SAME card as .ms-row:
   3px keyline, hard shadow, one idea per card. A reader who has just scrolled
   thirty price cards should not have to learn a second visual language to read
   a listing, and the alternative that was considered, a table, fails at
   390px for exactly the reason the price rows are not a table either. */
.ov-h3{margin:var(--s5) 0 var(--s2)}
.ov-bands,.ov-list,.ov-kinds{list-style:none;margin:var(--s4) 0 0;padding:0;
  display:grid;gap:var(--s4)}
/* .ov-bands IS THE ONE GRID ON THIS PAGE THAT AUTO-FIT ACTUALLY SUITS, and it
   is here rather than in the 1000 block because the bug was everything BELOW
   that block: an iPad in portrait is 768 CSS px, so until 20 August 2026 these
   four bands were 720px-wide boxes holding 190 to 235 characters each, a phone
   layout at double width. Four short, equal, label-and-a-sentence cards is the
   one shape where the grid can be trusted to count its own columns: they never
   leave a ragged row because four divides by two, and they never grow taller
   when narrowed because there is not enough text in them to reflow. Measured at
   768, one column to two: 593px to 397, a 33% shorter band.
   THE FLOOR IS A REAL MEASUREMENT. 320px is the widest card that still lets two
   sit in the 660px wrap of a 700px viewport with the 16px gap, and the narrowest
   that still refuses a third in the 976px wrap at 1024, which is what keeps this
   agreeing with the repeat(2,...) in the 1000 block instead of fighting it.
   min() IS LOAD BEARING AND NOT DECORATION: a bare minmax(320px,1fr) cannot go
   below its floor, so at 320 the 280px wrap would get a 320px track and paint
   40px into the gutter. min(320px,100%) lets the single column shrink. */
@media(min-width:700px){
  .ov-bands{grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
}
.ov-b,.ov-l,.ov-k{border:3px solid var(--keyline);border-radius:var(--r);
  background:var(--card);padding:var(--s4);box-shadow:var(--hard-lg)}
/* The multiple is the biggest thing on a listing card for the same reason the
   price is the biggest thing on a price row: it is the answer, and everything
   under it is the working. 1.75rem rather than the row's 2rem because a
   multiple is four characters and a price is six, so it reads as loud at less. */
.ov-mult,.ov-brange{margin:0;display:flex;flex-direction:column;gap:2px}
.ov-mult b,.ov-brange b{font-size:1.75rem;line-height:1;font-weight:800;
  letter-spacing:-.01em}
.ov-mult span,.ov-brange span{font:700 .68rem/1.2 var(--mono);letter-spacing:.04em;
  text-transform:uppercase;color:var(--ink-soft)}
.ov-sum{margin:var(--s3) 0 0;font-size:.95rem;line-height:1.45}
.ov-what{margin:var(--s2) 0 0;font-size:.9rem;line-height:1.45}
.ov-bwhat{margin:var(--s3) 0 0;font-size:.9rem;line-height:1.5;color:var(--ink-soft)}
/* THE URL WRAPS OR IT BREAKS THE PAGE. A retailer product url is 90+ unbroken
   characters and at 390px an unbroken token forces the card wider than the
   viewport, which scrolls the whole document sideways. Same break-all the
   sources list at the foot of the page already needs, for the same reason. */
.ov-src{margin:var(--s3) 0 0;padding:var(--s3);border-radius:6px;
  background:var(--paper-3);font:.72rem/1.5 var(--mono);color:var(--ink-soft);
  overflow-wrap:anywhere;word-break:break-word}
.ov-k h4{margin:0 0 var(--s2);font-size:1rem}
.ov-k p{margin:0 0 var(--s3);font-size:.9rem;line-height:1.5}
.ov-k p:last-child{margin-bottom:0}
.ov-watch{color:var(--ink-soft)}
.ov-ksrc{font:.72rem/1.45 var(--mono);color:var(--ink-soft);overflow-wrap:anywhere}

/* ------------------------------------------------ the thirteen on one axis.
   The same card as .ov-l and .ms-row, for the reason written over the band
   above: a reader thirty price cards deep should not have to learn a second
   visual language for a picture.
   NOTHING IS CARRIED BY COLOUR. The bar is solid ink on the page's own paper
   tone and the datum is a rule standing proud of the track at both ends, so the
   figure reads with every hue in the palette collapsed to one value, which is
   what --ketchup and --navy have already done: both are #111111 today. */
.ms-fig{margin:var(--s4) 0 var(--s5);border:3px solid var(--keyline);border-radius:var(--r);
  background:var(--card);padding:var(--s4);box-shadow:var(--hard-lg);max-width:33em}
.ov-fig{list-style:none;margin:0;padding:0;display:grid;gap:var(--s3)}
/* The name and the multiple share a line and the track takes the one under it.
   A three column row puts the track in about 120px at 390px, which is 55px of
   difference between the shortest bar and the longest and is not a chart. */
.ov-fig li{display:grid;grid-template-columns:1fr auto;gap:var(--s2);align-items:baseline;
  padding-top:var(--s3);border-top:1px solid var(--hair)}
.ov-fig li:first-child{padding-top:0;border-top:0}
.ov-fn{font-size:.85rem;line-height:1.35;color:var(--ink)}
/* 700 AND NOT 800, AND THAT IS THE FONT WEIGHT TRAP IN CLAUDE.md ONE STEP ALONG.
   Space Mono ships here at 400 and 700 and nothing else, so an 800 fetches no
   new file, which is the half of the trap that costs kilobytes, but it does get
   synthetically emboldened by the browser: the same glyphs smeared, beside real
   700 mono elsewhere on the page. Both weights are already on this page, so
   this declaration costs nothing at 700 and looks right. */
.ov-fv{font:700 .95rem/1 var(--mono);letter-spacing:-.01em;white-space:nowrap}
.ov-ft{grid-column:1/-1;position:relative;display:block;height:14px;margin-top:6px;
  border-radius:3px;background:var(--paper-2);box-shadow:inset 0 0 0 1px var(--hair)}
.ov-fb{display:block;height:100%;min-width:3px;border-radius:3px;background:var(--ink)}
/* 26px against the track's 14, so 6px of the datum stands clear of the fill at
   each end. Every bar here except one is longer than the datum, so on twelve of
   the thirteen rows the mark falls INSIDE a solid ink bar and the overhang is
   the whole of what a reader sees of it. */
.ov-fd{position:absolute;top:-6px;width:2px;height:26px;background:var(--gold-deep)}
.ms-fig figcaption{margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid var(--hair);
  font-size:.85rem;line-height:1.55;color:var(--ink-soft)}
.ms-fig figcaption b{color:var(--ink);font-weight:800}

.ms-src{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s4);
  max-width:46em}
.ms-src li{padding-left:var(--s4);border-left:3px solid var(--keyline)}
.ms-src h3{margin:0 0 var(--s1);font-size:.95rem}
.ms-src p{margin:0;font-size:.85rem;line-height:1.5;color:var(--ink-soft)}
.ms-src a{font:.75rem/1.4 var(--mono);word-break:break-all}

.ms-body{max-width:46em}
/* ui.css zeroes the margin on p, so without this the four paragraphs under each
   subhead run together as one wall. */
.ms-body p{font-size:.95rem;line-height:1.6;margin:0 0 var(--s4)}
.ms-body p:last-child{margin-bottom:0}
.ms-body h3{margin:var(--s5) 0 var(--s2)}

@media(min-width:1000px){
  .ms-lede,.ms-warn{max-width:50ch}
  /* 33em, NOT 50ch, AND THAT IS A MEASUREMENT RATHER THAN A PREFERENCE.
     The target is the 76 real characters a line /openings/ ships at 1440, which
     is what the site's own 50ch works out to on ITS paragraphs. "ch" is the
     width of a zero in the element's own font at its own size, and it is not a
     constant fraction of an em across this site's faces: 50ch measured 459px at
     14px on .op-note and 547px at 15.2px here, which is 76 characters there and
     83 here from the same declaration. 33em is stable, because a real character
     on this site is a measured 2.31 per em for body copy: 33 x 2.31 = 76 at any
     font size. Checked at both 15.2px and 13.6px and both land on 76.
     Do not "tidy" this back to ch to match the neighbours. */
  .ms-body p,.ms-body h3,.ms-src p{max-width:33em}
  /* The list is not prose and does not take a measure cap: at 1280 a 50ch cap
     would leave a column of price cards ending 600px short of the wrap the
     bands above and below it fill, which is the same "the top of the page reads
     as a different site from the bottom" the home page's desktop pass was
     about. Two columns instead. */
  /* AND IT STAYS AT 1000 WHILE .ov-bands MOVED TO 700. That was checked on
     20 August 2026 rather than assumed, when every other grid on the site was
     pulled below the iPad's 768. These 26 product cards carry a photo laid out
     BESIDE a 610 to 1,186 character body, so narrowing the card takes width off
     the text twice: once for the grid and again for the photo it sits next to.
     Measured at 768, forcing two columns: 10,513px to 12,138, a 15% TALLER page
     for the same words. At 1000 the wrap is 976 and a column is 480px, which is
     the width the card was drawn at. Do not pull this one down to match. */
  .ms-list{grid-template-columns:repeat(2,minmax(0,1fr))}
  /* Same call as .ms-list one line up and for the same reason: these are cards
     and not prose, so they fill the wrap rather than stopping at a measure. The
     listings stay ONE column at every width. Four of them side by side reads as
     a comparison of four shops, which is the one thing this band is not. */
  /* .ov-bands ALREADY HAS TWO COLUMNS BY THE TIME THIS RULE IS REACHED, from
     the auto-fit rule written beside its base declaration, and it is left in
     this selector because this is where the ARGUMENT for two columns lives and
     the two rules agree on the answer. .ov-kinds is the one this line still
     decides, and it stays at 1000: five cards of 428 to 610 characters pair
     into three rows with a hole in the last one, and the band is 1,239px in one
     column against 1,159 in two at 768, a 6% saving that does not pay for a
     ragged row and a 352px measure. It gets its two columns at 480px instead. */
  .ov-bands,.ov-kinds{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ov-list{max-width:33em}
}

/* ==========================================================================
   AND EVERY ONE OF THOSE CAPS PUT ITS COLUMN ON THE LEFT RAIL, fixed
   21 August 2026. The block above is careful about how wide a LINE is and says
   nothing about where the line SITS, so this page ran three bands that fill
   1,392px and, between them, a reading column that stopped between 456 and 806
   and left up to 960px of empty green beside it, down a 20,870px page.
   Measured at 1440x900, box right edge in a wrap ending at 1,416:

       p.lede.ms-lede    601      p.ms-warn      523      p.sec-label   456
       p/div.ms-body     806      div.ms-calc    806      ul.ms-src     806
       figure.ms-fig     585      ul.ov-list     585

   against ul.ms-list inking to 1,397, ol.ov-bands to 1,263 and ul.ov-kinds to
   1,259. The bands were right and the column was homeless.

   THIS IS THE /base-set.html AND /how-to-play.html TREATMENT, not the
   /tcg-pocket.html one, and the three bands above are the whole reason: capping
   this wrap to a measure would shrink the only parts of the page that were
   already filling it. So the wrap takes a band, the bands keep it, and only the
   reading column moves. CLAUDE.md's home page precedent is the model, and its
   sentence about the top of a page reading as a different site from the bottom
   is the one the .ms-list comment above is already quoting.

   ONE SHARED LEFT EDGE, WHICH IS WHY THIS IS A margin AND NOT
   margin-inline:auto ON EACH BLOCK. The column holds a display h1, 17px body,
   15.2px notes, an 11px mono section label and a bordered figure, so a
   per-element auto centre gives each of them a different left edge and the
   column reads as ragged. One indent computed from the band puts them all on
   305px. 782px is 46em resolved at 17px, which is .ms-body's own cap and the
   widest ink on the page outside the bands.

   NOTHING ABOVE THIS BLOCK IS TOUCHED, AND TWO THINGS IN IT ARE LOAD BEARING.
   .ov-list STAYS ONE COLUMN: the comment above says four listings side by side
   would read as a comparison of four shops, which is the one thing that band is
   not, and it is still one column here, just no longer against the left rail.
   The 33em cap stays for the same reason its own comment gives.
   ========================================================================== */
@media(min-width:1000px){
  .ms-page .wrap{max-width:calc(1152px + var(--gut) * 2)}
  .ms-page .wrap > :is(.crumbs,.sec-label,h1,h2,h3,.ms-lede,.ms-warn,.ms-body,
    .ms-calc,.ms-fig,.ms-src,.ov-list){margin-left:calc((100% - 782px) / 2)}
}
`;

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css and miniCSS makes in build-openings.mjs and
// build-set-pages.mjs, and the same expression: comments, plus the indentation
// between rules, and nothing else. This block is inline in a render blocking
// <head> and roughly half of it is prose.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

// NO " | Garbage Rips 585" IN <title>, for the reason CLAUDE.md records under
// "Page titles carry no suffix". Measured in headless Chrome, canvas
// measureText at 20px Arial, which is what Google's desktop result draws:
// with the suffix 623.3px against the ~580px cut, without it 444.7px.
// The suffix is 178.6px and it was never being drawn, so it cost the tail of
// the title it sat behind and returned nothing. og:site_name carries the brand
// beside the result, and og:title below has always been the bare title, so
// dropping it also stops <title> and og:title disagreeing.
const TITLE = "Pokemon MSRP: what sealed product should cost";
const DESC =
  `What every kind of sealed Pokemon product should cost, so you can check in the shop how far ` +
  `over retail you are being charged. ${priced.length} products with a sourced price, ${store.length} of ` +
  `them straight from Pokemon's own shop, every figure dated.`;
const PATH = "/msrp.html";

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(clipMeta(DESC))}">
<link rel="canonical" href="${SITE}${PATH}">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${PATH}">
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
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Sealed product prices" },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" class="ms-page">

  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Sealed product prices</span></nav>
      ${/* "list" WAS THE ONE WORD THIS PAGE MUST NOT PROMISE. The nav says "MSRP
          check" precisely because some rows carry no price: a display box
          cannot be priced by multiplying a pack, and Pokemon Center lists some
          product types at two prices on the same day. An h1 offering a list
          and a nav offering a check are two different promises about the same
          page, and the weaker one is the true one. MSRP stays first and stays
          highlighted; only the promise changes. */ ""}
      <h1>Pokemon sealed <span class="hl">MSRP</span>: what it should cost</h1>
      <p class="lede ms-lede">What each kind of sealed product should cost, so you can work out in the shop
        how far over you are being asked to go.</p>

      <p class="ms-warn"><b>Suggested is the whole point.</b> No shop has to honor a suggested price,
        which is why one can ask triple. <a href="#where">Where these came from</a>.</p>
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <h2 class="ms-h2">${priced.length} with a <span class="hl">sourced</span> price</h2>
      <ul class="ms-list">
${priced.map((r, i) => pricedRow(r, i)).join("\n")}
      </ul>
      <p class="ms-body" style="margin-top:var(--s5)">${priced.length} products with a price this site will
        stand behind, ${store.length} of them straight from Pokemon's own shop. ${blank.length} more are
        below, ${varies.length} because the type genuinely sells at several prices at once and ${
          thin.length === 1 ? "one" : thin.length
        } because the evidence is too thin to print a figure.</p>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <h2>Work out <span class="hl">your</span> multiple</h2>
      <p class="ms-body">Divide what the shop is asking by the number above. Two times is double retail.
        ${/* "one and a bit" is British for "a little over one". It stays a
             HEDGE and does not become a number: nobody publishes what a normal
             retail markup on sealed Pokemon product is, so putting a figure
             here would be this page inventing one two lines above a calculator
             whose whole point is that every other number on it is sourced. */ ""}Anything a little over one is
        roughly normal for a shop that has to pay staff and rent.
        The sum is the useful part, because it travels: it works on a product not on this list, and it
        works next year when these figures have moved.</p>
      <div class="ms-calc">
        <div class="ms-fields">
          <div>
            <label for="msProd">The product</label>
            <select id="msProd">
            ${calcOptions}
            </select>
          </div>
          <div>
            <label for="msAsk">What the shop is asking</label>
            <input id="msAsk" type="number" inputmode="decimal" min="0" step="0.01" placeholder="e.g. 89.99">
          </div>
        </div>
        ${/* THE LIVE REGION MOVED OFF THIS PARAGRAPH, 22 August 2026, and the
             reason is the same one build-search.mjs writes up beside its say().
             #msOut was the visible answer AND the announcement, and it is
             rewritten on every keystroke, so typing "89.99" into the box made a
             screen reader read four complete sentences: "0.16x the $49.99
             figure for the Elite Trainer Box. That is $41.99 under", then
             1.78x, then 17.98x, then 180.02x. Measured in headless Chrome with
             a MutationObserver on the region: four keystrokes, four full
             sentences, three of them about a number the reader never meant to
             type. The paragraph keeps repainting as fast as it does now; only
             the SPOKEN copy waits, in the sr-only region below, behind the same
             220ms debounce and the same "did the string actually change" guard.
             Do not put aria-live back on this paragraph. */ ""}
        <p class="ms-out" id="msOut">Type a price and this works out the multiple.</p>
        <p class="sr-only" id="msSay" role="status" aria-live="polite"></p>
      </div>
      <p class="ms-body" style="margin-top:var(--s4)">This does the arithmetic and nothing else. It knows
        nothing about the shop you are standing in, and a number over one is not by itself a reason to walk
        out: a small shop that actually has stock on a shelf is worth something.
        <a href="#over">${listings.length} real listings with the sums already done</a> are below.</p>
    </div>
  </section>

  <section class="band tight" id="over">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Above MSRP</p>
      <h2>Most shops sell <span class="hl">over</span> MSRP</h2>
      <p class="lede ms-lede">${esc(over.intro[0])}</p>

      <p class="ms-warn"><b>Pokemon's own shop price IS the MSRP.</b> Pokemon Center is The Pokemon Company
        selling its own product, so what it asks is the price the manufacturer suggests. Anybody asking more
        than that is selling above MSRP, and that is far more shops than most people expect.</p>

      <div class="ms-body">
${para(over.intro.slice(1))}
      </div>

      <h3 class="ov-h3">What a multiple means</h3>
      <div class="ms-body">
        <p>Divide the asking price by the suggested one. These bands are this site's rule of thumb and not a
          measurement: the edges are a judgment about what is worth paying, and two people can reasonably
          draw them somewhere else. Only the bottom of the first one is a fact, because 1x is what the
          manufacturer itself asks.</p>
      </div>
      <ol class="ov-bands">
${over.bands.map(bandRow).join("\n")}
      </ol>

      <h3 class="ov-h3">${listings.length} listings, with the <span class="hl">sums</span> done</h3>
      <p class="ms-warn"><b>Every one of these is a reading on a date, not a standing fact about a shop.</b>
        Prices move daily, differ between two branches of one chain and differ between two boxes on one peg.
        Check the price in front of you against the figure above and do your own division.</p>
      <div class="ms-body">
        <p>These are every dated, sourced shop listing this site holds, in full, cheapest product first:
          ${listings.length} of them, at ${listingShops} shops, read ${esc(readDatePhrase(listingDates))}.
          They are here as worked examples of the arithmetic. Nothing here ranks one shop against another,
          adds them up, or says anything about why a price was set: one product page on one afternoon
          cannot support any of that.</p>
        <p>The same ${listings.length} are on <a href="/retailers.html">which stores sell Pokemon cards</a>,
          shop by shop and with the seller named on each, out of the same two research files and divided by
          the same suggested figures printed above. Neither page holds a listing the other does not.</p>
      </div>
${spreadFig()}
      <ul class="ov-list">
${listings.map(listingCard).join("\n")}
      </ul>

      <h3 class="ov-h3">Who is <span class="hl">setting</span> the price</h3>
      <div class="ms-body">
        <p>The prices above go stale. This part does not, because it is about how each kind of seller
          arrives at a number rather than what any of them charged one afternoon.</p>
      </div>
      <ul class="ov-kinds">
${over.sellerKinds.map(kindRow).join("\n")}
      </ul>

      <div class="ms-body" style="margin-top:var(--s5)">
${para(over.closing)}
        <!-- ONE SENTENCE AND NO NUMBERS, WHICH IS THE WHOLE POINT OF IT.
             /retailers.html holds the shop-by-shop half of this question: which
             chains sell Pokemon cards at all, what each one stocks, and every
             dated price reading this site has taken off a retailer's own product
             page. It divides those by the SAME figures this page prints, joined
             out of data/msrp.json at build time, so the two pages cannot show one
             listing at two multiples. Restating any of its numbers here is what
             would break that, so this link deliberately carries none. -->
        <p>Which shops sell them at all, what each one keeps on the shelf and where in the building to look
          is its own page: <a href="/retailers.html">which stores sell Pokemon cards</a>. It divides its
          readings by the same suggested figures printed above.</p>
      </div>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The honest half</p>
      <h2>${blank.length} products with no <span class="hl">single</span> price</h2>
      <p class="lede ms-lede">These are here because leaving them out would make the list look more
        complete than it is. ${varies.length} of them are not a gap in the research: Pokemon's own shop
        sells them at more than one price on the same day, with no old and new about it, so the type has
        no one figure and the row says which prices it runs between. The other ${
          thin.length === 1 ? "one is" : `${thin.length} are`
        } genuinely thin on evidence and say${thin.length === 1 ? "s" : ""} so instead.</p>
      <ul class="ms-list">
${blank.map(blankRow).join("\n")}
      </ul>
    </div>
  </section>

  <section class="band tight" id="where">
    <div class="wrap">
      <h2>What <span class="hl">MSRP</span> actually means here</h2>
      <div class="ms-body">
        <p>MSRP is the manufacturer's suggested retail price: what the company that made a thing thinks a
          shop should charge for it. Suggested is the operative word. No law makes a shop honor it, and a
          shop can technically sell a box for whatever it likes. That is why the same Elite Trainer Box can
          sit on a shelf at one price and on a table at a show at double it on the same afternoon, and it
          is the entire reason this page is worth having.</p>
        <p>The useful thing about the suggested number is that it does not move when a set gets hot. It is
          set by product type, not by demand, so it stays a fixed post to measure a price against.</p>

        <h3>Who set these numbers, and when we read them</h3>
        <p>Pokemon Center is The Pokemon Company's own shop, selling its own product. The price it asks is
          therefore the price the manufacturer suggests, which is what MSRP means. There is no separate
          document to go and look for: ${store.length} of the ${priced.length} figures above are Pokemon's
          own shop price, read off its own store pages on ${esc(longDate(pc.readOn))}. Each row names the
          exact product the figure was read from, and the shop itself is linked at the foot of this page.</p>
        <p>That store does not answer an automated request. Every address on it returns a short bot check
          page with no product on it, so the ${(pc.products || []).length} prices behind this page were read
          by a person in a browser, in one pass, and written down with the product address and the date on
          each. We did not try to get around the check and we do not use their pictures.</p>
        <p>The rest are figures that two or more independent price references print identically, to the
          cent. Those are careful people reading shop listings and agreeing with each other, which is good
          evidence about what the suggestion is rather than the manufacturer saying it, so the label over
          those prices is different. Where the references disagree, or where only one of them has a
          product, the row says so and prints no price at all.</p>
        <p>Where Pokemon's own shop and a reference disagree, the shop wins and the row says so out loud
          instead of quietly dropping the other figure. The Pokemon Center Elite Trainer Box is the clearest
          case: one guide still has it at $54.99 from March 2026, and two of those boxes were $59.99 in
          Pokemon's own shop on ${esc(longDate(pc.readOn))}.</p>

        <h3>What you should still be careful about</h3>
        <p>A price is a price on a date, including the manufacturer's. Booster bundles went from $23.94 to
          $26.94 in late 2025, and the Pokemon Center Elite Trainer Box from $54.99 to $59.99 during 2026.
          A figure with an old date on it is a figure to re-check, which is why every row carries one.</p>
        <p>One reading is also one product, and the count is what decides a row. Twelve display boxes at
          $161.64 with one fifty cents under them is one price and an outlier, so that row prints the
          figure and names the odd box. Two Ultra Premium Collections at $119.99, against a third the same
          line sells at $179.99, is not: nothing there is an outlier, so it sits in the list below with the
          spread instead of a number. Five and five is the same answer, which is why Tech Sticker
          Collections carry none either.</p>
        <p>Nothing here says what is inside a pack or how likely anything is to be in it. This site never
          states pull rates, because The Pokemon Company does not publish them.</p>

        <h3>The rest of the money questions</h3>
        <p>What one pack works out at across every set is on <a href="/pack-prices.html">pack prices</a>,
          which is market price rather than retail. How many packs are actually in each product, sourced
          per product, is on <a href="/how-many-packs.html">packs per box</a>. What each kind of product
          is, and dozens of each opened on camera, is on <a href="/openings/">sealed products</a>. Where to
          buy without paying a premium is on <a href="/buying.html">where to buy</a>.</p>
        <p>For one product worked all the way through, the 2026
          <a href="/first-partner-illustration-collection.html">First Partner Illustration
          Collection</a> is the clearest example on the site of the gap this page is about: $14.99
          at Pokemon's own shop against $17.99 on a Best Buy or Target shelf, which is 1.2x, and
          that page shows what all 27 cards in it are worth as well.</p>
      </div>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Sources</p>
      <h2>Every source on <span class="hl">this</span> page</h2>
      <p class="lede ms-lede">${nSources} of them. Each row above names the one it came from and the date it
        was read.</p>
      <ul class="ms-src">
${Object.values(SOURCES)
  .map(
    (s) => `        <li>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.what)}</p>
          ${/* THE LABEL LEADS WITH THE URL BECAUSE THE URL IS WHAT IS VISIBLE.
                WCAG 2.5.3 Label in Name: this link SHOWS its own href as its
                text, and the label said the source's NAME instead, so the two
                shared no word and speech input could not reach it. The name is
                not lost -- the h3 two lines above already says it, which is
                also why repeating it here was redundant rather than helpful.
                "opens on their site" stays, because every outbound link on
                this site has to say it leaves. */ ""}
          <p><a href="${esc(s.url)}" rel="nofollow noopener" target="_blank" aria-label="${esc(
            s.url
          )}, opens on their site">${esc(s.url)}</a> &bull; read ${esc(longDate(s.readOn))}</p>
        </li>`
  )
  .join("\n")}
      </ul>
      <p class="ms-body" style="margin-top:var(--s5)">Pack counts and the shop listings quoted above come
        from this site's own product research file, which carries the page each one was read off and the
        date, and which feeds <a href="/how-many-packs.html">packs per box</a> as well.</p>
    </div>
  </section>

</main>
${footer(
  "Product photos are TCGplayer's, used to identify the products written about here. Every price is a " +
    "dated reading from the source named on its row, and a suggested price is not one any shop has to keep."
)}
${APP_JS}
<script>
(function(){
  var sel=document.getElementById('msProd'), ask=document.getElementById('msAsk'),
      out=document.getElementById('msOut'), say=document.getElementById('msSay');
  if(!sel||!ask||!out) return;
  var REST='Type a price and this works out the multiple.';
  // The spoken half. Two guards, and neither is enough on its own: the equality
  // check kills a repeat of a string already said (changing the picker without
  // changing the answer, or retyping the same digit), and the 220ms debounce is
  // what turns a typed price into ONE sentence instead of one per keystroke.
  // The visible paragraph above is deliberately NOT waited on.
  var sayT=null, said='';
  function announce(msg){
    if(!say) return;
    if(sayT) clearTimeout(sayT);
    sayT=setTimeout(function(){
      if(msg===said) return;
      said=msg;
      say.textContent=msg;
    }, 220);
  }
  function money(n){ return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function run(){
    var base=parseFloat(sel.value), paid=parseFloat(ask.value);
    // An empty or half-typed box says nothing at all. The old code rewrote the
    // resting sentence here on every keystroke, which is a live region firing
    // with no news in it.
    if(!(base>0)||!(paid>0)){ out.textContent=REST; announce(''); return; }
    var mult=paid/base, over=paid-base;
    // toFixed(2) then trim the trailing zeros, so 2.00 reads "2" and 1.20 reads
    // "1.2". "2.00x MSRP" is the kind of false precision that makes a rough
    // answer look like a measurement.
    var m=mult.toFixed(2).replace(/\\.?0+$/,'');
    var name=sel.options[sel.selectedIndex].textContent.split(' \\u2022 ')[0];
    // "for THE Elite Trainer Box", never "for a". build-openings.mjs keeps a
    // hand-written list of which product labels take "an" (UPC takes "a",
    // because it is read out as letters), and none of that is worth carrying
    // into a browser: "the" is correct in front of every label in the picker.
    // The first version said "for a Elite Trainer Box".
    var tail = Math.abs(over) < 0.005
      ? '. That is exactly it.'
      : '. That is '+money(Math.abs(over))+(over>0?' over.':' under.');
    var body=m+'x the '+money(base)+' figure for the '+name.replace(/[<>&]/g,'')+tail;
    out.innerHTML='<b>'+m+'x</b> the '+money(base)+' figure for the '+
      name.replace(/[<>&]/g,'')+tail;
    announce(body);
  }
  sel.addEventListener('change',run);
  ask.addEventListener('input',run);
})();
</script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/msrp.html"), page);

console.log(`Wrote public/msrp.html
  ${priced.length} products with a sourced price, ${blank.length} without
  of those ${blank.length}: ${varies.length} vary by product, ${thin.length} thin on evidence
  ${nSources} sources, ${listings.length} shop listings at ${listingShops} shops, all with a multiple
  ${rows.filter((r) => photoFor(r.rowId)).length} of ${rows.length} rows have a photograph`);
