#!/usr/bin/env node
// Build /what-to-buy.html: what a beginner or a parent should actually buy.
//
//   node scripts/build-what-to-buy.mjs
//
// THIS IS TIM IN A SHOP AISLE AND THAT IS THE WHOLE BRIEF. Somebody is standing
// in front of a wall of Pokemon boxes priced between nine dollars and four
// hundred, with a kid attached to one arm, and they do not know what an ETB is,
// why one box is $10 and another is $180, or that the $300 booster box on a
// famous retailer's website is a stranger's listing rather than the shop's
// price. He explains this out loud to strangers often enough that it is worth a
// page.
//
// ============================================================================
// WHAT THIS PAGE OWNS, AND WHAT IT DELIBERATELY DOES NOT
//
// It sits between three pages that already exist and it must not become any of
// them. The line is not a filing preference, it is what stops four pages
// printing four different numbers for one box:
//
//   /start.html          the question-shaped front door for somebody holding a
//                        CARD. Is it real, what is it, what is it worth. It
//                        owns almost no facts and points at the pages that do.
//                        This page is the same shape for somebody holding a
//                        WALLET, and it is a sibling rather than a child.
//   /msrp.html           the price list. THIRTY THREE product types with a
//                        sourced figure, the sourcing rules, the calculator,
//                        the band about buying above MSRP. It owns every price.
//   /how-many-packs.html the pack counts, sourced per product, biggest to
//                        smallest, plus how the counts moved by era. It owns
//                        every pack count.
//   /openings/           what each kind of sealed product is, with dozens of
//                        each opened on camera. It owns the product tour.
//
// So this page prints NO number of its own. Every price is joined out of
// data/msrp.json by the exact `label` string, and every pack count out of
// data/pack-counts-current.json through that row's `packsFrom`, which is the
// same join /msrp.html makes and the same one-source-of-pack-counts rule
// build-how-many-packs.mjs keeps. A label data/what-to-buy.json names that
// msrp.json does not carry FAILS THE BUILD. A `pick` pointing at a row with no
// sourced price FAILS THE BUILD. There is no correct page to ship while a
// recommendation and the price list disagree about what a box costs.
//
// THE PRODUCT DESCRIPTIONS ARE JOINED TOO, and that is the less obvious half.
// The sentence saying what a thing IS comes from msrp.json's `what`. Only the
// second-person reason to buy it lives in data/what-to-buy.json, because that
// is the one thing a price list has no business carrying.
//
// ARITHMETIC IS DONE HERE AND NEVER WRITTEN DOWN. Price per pack, and the
// multiple on a shop listing, are computed from the joined figures at build
// time, so the copy cannot go stale against the data underneath it. The one
// place that mattered immediately: at the suggested prices a pack costs the
// same in a bundle as in a thirty six pack display box, so "buy the big box to
// save money" is false, and it is false BY ARITHMETIC rather than by opinion.
// If those two ever stop matching, printPerPack's verdict changes with them.
//
// ============================================================================
// THE COLLECTOR BAND, ADDED 17 AUGUST 2026, AND IT IS THE ONE BLOCK HERE THAT
// IS NOT FOR A BEGINNER
//
// A GIFT GUIDE WAS BRIEFED AS ITS OWN PAGE AND TIM CUT IT DOWN TO THIS, which is
// worth recording because the argument for the page was not silly and somebody
// will make it again. The case was that a gift buyer is a genuinely different
// reader: they do not know what the recipient owns, they cannot ask without
// spoiling it, and they work down from a budget they picked first. The case
// against, which won, is that six of the seven situations on this page ALREADY
// answer a gift question, two of them explicitly ("The big present", "Under
// fifteen dollars"), and a second page arranging the same products under the
// same prices would be a near duplicate. Two near-duplicate pages compete for
// one query and the search engine picks one of them, which may not be the one
// you meant.
//
// WHAT WAS ACTUALLY MISSING WAS NARROWER AND BETTER. Every situation above
// assumes the RECIPIENT is new to this. The one reader with nowhere to go was
// somebody buying for an ESTABLISHED COLLECTOR, and that inverts the problem
// rather than restating it:
//
//   - the risk stops being "is this any good" and becomes "do they already have
//     it" and "will they think this is junk"
//   - the buyer cannot ask and has never seen the collection
//   - a single card, which is what an outsider reaches for because it looks
//     personal, is the WORST blind gift there is
//   - a collector holds strong opinions a newcomer cannot guess: sealed against
//     opened, which era, graded against raw
//
// So the band answers one question the rest of the page does not: what is safe
// when you know nothing? THE THREE TESTS ARE THE DURABLE HALF and are the reason
// this is not just four more product cards. Can it be a duplicate, do they still
// get to choose, is it from what is on the shelf now. Those keep working on a
// product this page has never heard of and in a year when every figure here has
// moved.
//
// IT SITS DIRECTLY AFTER `oneCard` AND MUST STAY THERE. That block tells a
// reader who knows the card to buy the card rather than packs. This band tells a
// reader who does NOT know the card that a single card is the worst thing they
// could pick. Read apart they contradict each other; read together the
// difference is obvious and it is the whole lesson. Each names the other, and
// the anchors are #one-card and #no-blind-single.
//
// THE WALK-AWAY FIGURE IS THE PART TIM CARED MOST ABOUT and it is computed
// twice over from files this builder does not own. The multiple comes off
// data/over-msrp.json's own bands, so it cannot disagree with /msrp.html. The
// evidence under it is a RANGE across every dated first-party shop listing in
// this repo, which means BOTH data/pack-counts-current.json (the four
// /msrp.html prints) and data/retailer-prices.json (the nine /retailers.html
// prints), because neither file is the whole set and the claim is about the
// whole set. Only the two ENDS of the range are named. Nothing is ranked, no
// shop is scored, and the count of listings over the line is counted rather
// than written. See the block above LISTINGS.
//
// ONE THING IT DELIBERATELY DOES NOT DO: it does not restate the mystery-box
// argument or the marketplace argument, both of which are already on this page
// at length. It links to them. A band that re-argues what the page below it
// already argues is how a long page becomes an unfinishable one.
// ============================================================================
//
// ----------------------------------------------------------------- THE RULES
//
// NEVER STATE OR IMPLY PULL RATES, and it bites hardest on this page of all of
// them, because "and it might be worth something one day" is exactly the
// sentence that wants to creep into advice aimed at a parent. Nothing here says
// what is in a pack, how likely anything is to be in it, or that any of this is
// an investment. It is a page about buying a present.
//
// NO GATEKEEPING, WHICH IS AN INSTRUCTION ABOUT SENTENCES AND NOT A VIBE. Every
// piece of jargon gets its plain meaning in the same breath, the first time it
// appears, every time. ETB is spelled out where it is first used, and the
// glossary says out loud that nobody outside the hobby has ever called a piece
// of plastic on a peg a "blister". If a sentence would make somebody put their
// phone away rather than ask a shop assistant, it is the wrong sentence.
//
// THE RESELLER SECTION IS SOURCED AND IS NOT AN OPINION ABOUT ANY SHOP. The
// claim is narrow and checkable: the big retailers' sites carry third-party
// marketplace listings alongside their own stock. data/buying.json already
// records each chain's own shipping and return pages, with the url and the day
// they were read, and several of those readings turn on exactly this split (30
// days on Target Plus marketplace items against 90 on Target's own; 30 on
// Walmart marketplace-seller items against 90; Best Buy free shipping never
// applying to Marketplace Products). Those readings are pulled out of that file
// rather than restated here, and the build fails if they stop being there. No
// shop is scored, no company is accused of anything, and no price is attributed
// to a marketplace listing, because this repo holds no dated reading of one.
//
// THE URLS ARE PRINTED AND NOT LINKED. Same call build-msrp.mjs makes for its
// listing addresses and for the same reason: this site keeps a very short list
// of outbound links, argued one at a time in CLAUDE.md, and eight new ones at
// the foot of a page is exactly the quiet drift that file complains about. An
// address in plain text is checkable and stays on the site.
// ============================================================================

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits: no `<a href*="/rip/">` around an image or a `.pack`, no `[data-vcar]`
// carousel, and none of packs.css's classes in any class attribute. Those are
// the three conditions written beside the two exports in shared/chrome.mjs, and
// all three hold here. ~11.9KB gzipped and two requests for a script that finds
// nothing to attach to. READ THAT NOTE BEFORE ADDING A VIDEO TILE HERE: a tile
// added without putting packplayer.js back navigates away instead of playing in
// place, which reads as a design decision rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyExact } from "../shared/format.mjs";
// The photograph pins, shared with build-msrp.mjs so a pin exists once. This
// file used to hold a second copy of them. See the photography note below.
import { makePhotoFor } from "../shared/product-photos.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const guide = JSON.parse(await readFile(join(ROOT, "data/what-to-buy.json"), "utf8"));
const msrp = JSON.parse(await readFile(join(ROOT, "data/msrp.json"), "utf8"));
const counts = JSON.parse(await readFile(join(ROOT, "data/pack-counts-current.json"), "utf8"));
const buying = JSON.parse(await readFile(join(ROOT, "data/buying.json"), "utf8"));
// The collector band's three extra reads, all READ AND NEVER WRITTEN.
//
//   over-msrp.json      the multiple this site puts the phone down over, and the
//                       words it uses for that band. Taken from the SAME file
//                       /msrp.html builds its bands out of, so the two pages
//                       cannot recommend two different walk-away lines.
//   retailer-prices.json the nine dated first-party shop listings that
//                       /retailers.html prints. pack-counts-current.json holds
//                       the other four that /msrp.html prints. THE COLLECTOR
//                       BAND USES BOTH, because its claim is a RANGE across
//                       every listing this repo can source and neither file is
//                       the whole of them.
//   retailers.json      display names for those nine, which are stored by id.
const over = JSON.parse(await readFile(join(ROOT, "data/over-msrp.json"), "utf8"));
const retailPrices = JSON.parse(await readFile(join(ROOT, "data/retailer-prices.json"), "utf8"));
const retailers = JSON.parse(await readFile(join(ROOT, "data/retailers.json"), "utf8"));
const prod = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
const EXTRA = JSON.parse(await readFile(join(ROOT, "data/extra-products.json"), "utf8")).products;

// The image urls that answer 403, from the fetch of every url the site emits.
// Skipped up front rather than hidden behind an onerror, which leaves the page
// paying for a round trip to discover the same thing.
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);

// ============================================================== the msrp join
//
// FAILS THE BUILD RATHER THAN WARNING. Same call resolvePC() makes inside
// build-msrp.mjs and the same reason: a join that misses prints a plausible
// number beside the wrong object, and that failure looks completely fine on the
// page. There is no correct version of this page to ship while the two files
// disagree about what a box is called.
const BY_LABEL = new Map();
for (const r of msrp.products || []) {
  if (BY_LABEL.has(r.label)) {
    throw new Error(
      `build-what-to-buy: data/msrp.json carries TWO rows labelled ${JSON.stringify(r.label)}.\n` +
        `  This page joins to that file by label, so a duplicate makes the join ambiguous and the\n` +
        `  price printed here would depend on array order. Give one of them a distinct label.`
    );
  }
  BY_LABEL.set(r.label, r);
}

const PACKS_BY_NAME = new Map((counts.products || []).map((p) => [p.productName, p]));

/**
 * One product, by the exact `label` in data/msrp.json.
 *
 * `needPrice` is on for anything the page RECOMMENDS. A recommendation with no
 * figure beside it is the one thing a reader standing in a shop cannot use, and
 * seven of the thirty three rows in msrp.json genuinely carry no price (see the
 * rule in that file's _readme). Those rows are fine in the glossary, where the
 * page is explaining what a thing is rather than telling somebody to buy it.
 */
function product(label, { needPrice = false } = {}) {
  const row = BY_LABEL.get(label);
  if (!row) {
    throw new Error(
      `build-what-to-buy: data/what-to-buy.json names the product ${JSON.stringify(label)}\n` +
        `  and data/msrp.json has no row with that exact label. Either the row was renamed or\n` +
        `  this is a typo. Do NOT fix it by typing a price or a description into\n` +
        `  data/what-to-buy.json: that file holds neither, on purpose. Fix the label.`
    );
  }
  if (needPrice && typeof row.price !== "number") {
    throw new Error(
      `build-what-to-buy: this page recommends ${JSON.stringify(label)}, and its row in\n` +
        `  data/msrp.json carries no sourced price (${row.blank || "no reason given"}).\n` +
        `  A recommendation with no figure beside it is useless to somebody in a shop, and\n` +
        `  inventing one is forbidden. Recommend a different product, or leave it to the\n` +
        `  glossary, which does not require a price.`
    );
  }
  const src = row.packsFrom ? PACKS_BY_NAME.get(row.packsFrom) : null;
  return {
    ...row,
    // Nothing rather than a guess when the join misses, which is the same rule
    // build-msrp.mjs and build-how-many-packs.mjs both keep.
    packs: src && typeof src.packs === "number" && src.packs > 0 ? src.packs : null,
    seen: seenAt(src),
  };
}

/**
 * A shop's own listed price for this product, or null.
 *
 * ONLY `kind: "retailer listed price"` QUALIFIES. pack-counts-current.json also
 * holds Pokemon Center readings, and those are the BENCHMARK on this page, not
 * an example of a shop charging over one: printing one here would have the page
 * comparing a number against itself.
 */
function seenAt(src) {
  const p = src && src.price;
  if (!p || p.isMsrp || p.kind !== "retailer listed price") return null;
  if (typeof p.amount !== "number") return null;
  // The url and the date come off the SOURCE that supports the price, not off
  // the record's own readAt: these records carry several sources and only one of
  // them is the page that saw a price.
  const s = (src.sources || []).find((x) => (x.supports || []).includes("price"));
  return {
    amount: p.amount,
    retailer: p.retailer || "",
    product: p.product || src.productName,
    url: s ? s.url : "",
    readAt: s ? s.readAt : counts.readAt,
  };
}

// A multiple, printed the way /msrp.html prints one: two decimals with the
// trailing zeros trimmed, so 2.00 reads "2" and 1.20 reads "1.2". "2.00x" is
// the kind of false precision that makes a rough answer look measured.
const multStr = (n) => n.toFixed(2).replace(/\.?0+$/, "");

/** Price per pack, or null where either half of the sum is missing. */
const perPack = (p) =>
  typeof p.price === "number" && p.packs ? p.price / p.packs : null;

// ============================================== the walk-away line, and it is
// ============================================== READ OUT OF data/over-msrp.json
//
// THE COLLECTOR BAND PRINTS A CEILING BESIDE EVERY PRODUCT IT RECOMMENDS and
// that ceiling is a multiple of a sourced price, never a number typed anywhere.
// The multiple comes from the SAME `bands` array /msrp.html builds its rule of
// thumb out of: the top of the last band that has one, which is where that
// file's final, open-ended band begins. Read it rather than typing 2, so the two
// pages cannot end up recommending two different walk-away lines, and so that
// re-drawing the bands moves this band with them.
//
// IT IS A RULE OF THUMB AND THE PAGE SAYS SO IN THOSE WORDS, because that is
// what data/over-msrp.json's own _readme says it is: "The edges are judgement,
// not measurement". What is NOT judgement is the evidence gathered below it.
const DOUBLE = (() => {
  const withTop = (over.bands || []).filter((b) => typeof b.upto === "number");
  const last = withTop[withTop.length - 1];
  if (!last) {
    throw new Error(
      `build-what-to-buy: the collector band prints a walk-away figure beside every product it\n` +
        `  recommends, and it takes the multiple off the last closed band in data/over-msrp.json.\n` +
        `  That file now has no band with a numeric 'upto'. Do NOT fix this by typing a multiple\n` +
        `  into this builder: /msrp.html draws its bands out of the same array and the two pages\n` +
        `  would then be free to disagree about when to put a box down. Restore the bands.`
    );
  }
  return last.upto;
})();
// The words /msrp.html uses over that band, so both pages call it the same thing.
const DOUBLE_LABEL = (over.bands || []).find((b) => b.upto == null)?.label || "";

/** What this site would put the phone down over, for one product. */
const ceilingOf = (p) => (typeof p.price === "number" ? p.price * DOUBLE : null);

// ================================================= every listing this repo holds
//
// THIRTEEN OF THEM ACROSS TWO FILES AND THE BAND NEEDS BOTH, which is the one
// thing that makes its evidence different from either page that already prints
// them. /msrp.html prints the four in data/pack-counts-current.json.
// /retailers.html prints the nine in data/retailer-prices.json. Neither is the
// whole set, and the claim this band makes is a RANGE across the whole set: that
// every dated shop listing this site can source falls between two multiples, and
// that only a couple of them are over the walk-away line.
//
// NOTHING IS RANKED AND NO SHOP IS SCORED. Same discipline as /msrp.html's band
// and for the reason data/over-msrp.json's _readme spells out: a listing is one
// product, at one shop, on one day, at one address, and sorting thirteen of them
// by the multiple builds a league table out of a handful of readings. What this
// band prints is the two ENDS of the range, named and dated so they can be
// checked, plus a count. The two ends happen to be the same chain, which is the
// whole point rather than an awkwardness, and the copy says so.
//
// EVERY ONE JOINS TO A PRICED msrp.json ROW OR THE BUILD STOPS. A listing with
// nothing to divide by is not evidence about a multiple.
const listingsFromCounts = (counts.products || [])
  .map((p) => {
    const price = p.price;
    if (!price || price.isMsrp || price.kind !== "retailer listed price") return null;
    if (typeof price.amount !== "number") return null;
    const row = (msrp.products || []).find(
      (r) => r.packsFrom === p.productName && typeof r.price === "number"
    );
    if (!row) return null;
    const s = (p.sources || []).find((x) => (x.supports || []).includes("price"));
    return {
      amount: price.amount,
      retailer: price.retailer || "",
      product: price.product || p.productName,
      url: s ? s.url : "",
      readAt: s ? s.readAt : counts.readAt,
      label: row.label,
      base: row.price,
      from: "data/pack-counts-current.json",
    };
  })
  .filter(Boolean);

const RETAILER_NAME = new Map((retailers.retailers || []).map((r) => [r.id, r.name]));

const listingsFromRetail = (retailPrices.readings || []).map((r) => {
  const row = BY_LABEL.get(r.msrpLabel);
  if (!row || typeof row.price !== "number") {
    throw new Error(
      `build-what-to-buy: data/retailer-prices.json has a reading of ${JSON.stringify(r.product)}\n` +
        `  pointing at the data/msrp.json label ${JSON.stringify(r.msrpLabel)}, and that row is\n` +
        `  ${row ? "carrying no sourced price" : "not in that file at all"}. The collector band divides\n` +
        `  every listing by its suggested figure, so a reading with nothing to divide by would\n` +
        `  either print a bare asking price with no context or quietly vanish from a count this\n` +
        `  page states out loud. Re-point the msrpLabel, or take the reading out.`
    );
  }
  const name = RETAILER_NAME.get(r.retailer);
  if (!name) {
    throw new Error(
      `build-what-to-buy: data/retailer-prices.json records a reading at the retailer id\n` +
        `  ${JSON.stringify(r.retailer)} and data/retailers.json holds no shop with that id, so this\n` +
        `  band has no name to print beside the figure. A price under the wrong company's name is\n` +
        `  the one mistake this file is most careful about. Fix the id.`
    );
  }
  return {
    amount: r.amount,
    retailer: name,
    product: r.product,
    url: r.url,
    readAt: r.read,
    label: row.label,
    base: row.price,
    from: "data/retailer-prices.json",
  };
});

const LISTINGS = [...listingsFromCounts, ...listingsFromRetail].map((l) => ({
  ...l,
  mult: l.amount / l.base,
}));

if (LISTINGS.length < 4) {
  throw new Error(
    `build-what-to-buy: the collector band's advice rests on the dated shop listings this repo\n` +
      `  holds, and it found ${LISTINGS.length}. A band telling somebody what a fair multiple looks like,\n` +
      `  with almost nothing underneath it, is an opinion wearing the clothes of evidence. Either\n` +
      `  the readings were dropped or a join stopped resolving. Do not paste figures in here.`
  );
}

// The two ENDS, and nothing between them, which is what keeps this a range
// rather than a table. Ties break on the cheaper product, so the pair is stable
// build to build rather than depending on array order.
const byMult = [...LISTINGS].sort((a, b) => a.mult - b.mult || a.base - b.base);
const CHEAPEST = byMult[0];
const DEAREST = byMult[byMult.length - 1];
const OVER_LINE = LISTINGS.filter((l) => l.mult > DOUBLE).length;
const UNDER_LINE = LISTINGS.length - OVER_LINE;
const SHOP_COUNT = new Set(LISTINGS.map((l) => l.retailer)).size;
const READ_DATES = [...new Set(LISTINGS.map((l) => l.readAt))].sort();
// The two ends being the same chain is the single most useful thing in the whole
// band, so it is CHECKED rather than asserted: the sentence about it only prints
// when it is true, and the copy reads correctly either way.
const SAME_CHAIN = CHEAPEST.retailer === DEAREST.retailer;

// ------------------------------------------------------------- the sourcing line
//
// Every price on this page carries WHAT KIND of number it is, WHO said so and
// WHEN it was read, in one line, exactly as /msrp.html does. The two pages are
// deliberately worded the same, because they are printing the same figure out of
// the same row and a reader who checks one against the other should find no
// daylight between them.
//
// The two kinds are NOT the same claim and must not be collapsed into one word.
// A Pokemon Center reading is The Pokemon Company's own shop selling its own
// product, so it IS the manufacturer's suggestion in the literal sense of the
// phrase. A "refs" figure is two or more careful people reading shop listings
// and landing on the same number, which is good evidence ABOUT the suggestion
// rather than the manufacturer saying it.
const kindLabel = (p) =>
  p.priceKind === "store" ? "Pokemon's own shop price" : "agreed by price references";

const sourceLine = (p) =>
  `${esc(kindLabel(p))} &bull; ${esc(p.source)}, read ${esc(longDate(p.readOn))}${
    p.packs ? ` &bull; ${p.packs} pack${p.packs === 1 ? "" : "s"} inside` : ""
  }`;

// ================================================================ photography
//
// THE SAME PHOTOGRAPHS /msrp.html USES, out of the same map, which is the whole
// point of shared/product-photos.mjs. This file used to hold a SECOND COPY of
// the subset it pictures and said so here: "the honest fix is a shared module".
// That is what this now is. A pin, and the argument for it, exists once.
//
// THE NAME CHECK CAME WITH THE PINS AND IS LOUDER THERE than it was here. It
// verifies that the product sitting at a set and kind today is still the one the
// caption is about; it used to drop the photograph, and it now fails the build,
// because a drifted pin is a hand-written claim that has stopped being true
// rather than a picture that happens to be missing. A product with NO pin still
// returns null and still gets the hatch.
//
// KEYED BY msrp.json's rowId, not by label. This page joins to msrp.json by
// label already, so `product()` above has the row and the rowId comes off it;
// build-msrp.mjs keys the same map the same way. Two pages, one key, one pin.
//
// TCGplayer's shots are the only product photography this repo can reach and
// they are per SET rather than per TYPE, so the picture on a card is one
// specific set's product standing in for a whole type. Every card therefore
// NAMES the product in the picture in visible text as well as in the alt.
// Anything looser is a photograph quietly claiming to be a category.
//
// pokemoncenter.com's images are off limits, as is the site itself: see the
// header of build-msrp.mjs.
const photoByRow = makePhotoFor({ products: prod, extra: EXTRA, dead: DEAD });

/**
 * The photo for a product, by the exact `label` in data/msrp.json, or null.
 *
 * A label this page names that msrp.json does not hold has already failed the
 * build in `product()` above, so an unresolved label here can only be a product
 * that is never rendered, and null is the right answer for it.
 */
function photoFor(label) {
  const row = BY_LABEL.get(label);
  if (!row) return null;
  return photoByRow(row.rowId || row.id || "");
}

// 150w and not 200w, checked rather than assumed: the CDN serves a fixed set of
// widths and answers 403 for the rest, so a srcset candidate that does not exist
// is a broken image and not a fallback, because the browser has already
// committed to it. build-openings.mjs fetched all 121 of its thumbs at both
// widths and got 200 at 150w on every one.
//
// NO WIDTH OR HEIGHT ATTRIBUTES. imgDims() returns nothing for tcgplayer-cdn on
// purpose: those files run 200x268 to 200x417 and a declaration would be wrong
// by up to 34%. The box is a fixed size in CSS, so nothing reflows.
const small = (u) => u.replace(/_200w\.jpg$/, "_150w.jpg");

/**
 * `eager` is for the FIRST photograph on the page only.
 *
 * Everything else is lazy. An image the browser can see at first paint gains
 * nothing from `loading="lazy"` and can lose a little, and this one sits inside
 * the first detailed card. Note the standing warning in CLAUDE.md: `lazy` is a
 * VERTICAL heuristic, so it would not help here even if it were wanted.
 */
const shot = (label, { eager = false } = {}) => {
  const p = photoFor(label);
  if (!p) return `<span class="wtb-pic wtb-nopic" aria-hidden="true"></span>`;
  return `<img class="wtb-pic" src="${esc(small(p.src))}"${
    p.large ? ` srcset="${esc(small(p.src))} 150w, ${esc(p.large)} 1000w"` : ""
  } sizes="72px" alt="${esc(p.name)}, sealed"${
    eager ? "" : ' loading="lazy"'
  } decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`;
};

const shotName = (label) => {
  const p = photoFor(label);
  return p ? p.name : "";
};

// ======================================================== which pages exist
//
// Read rather than assumed: build-openings.mjs only writes a page for a product
// this channel has actually filmed, so several taxonomy ids have no page and an
// emitted link would be a 404 that check-build.py catches late. This builder
// runs AFTER build-openings.mjs in build-all.mjs for exactly that reason, the
// same way build-msrp.mjs does.
const OPENINGS = new Set(
  (await readdir(join(ROOT, "public/openings")).catch(() => []))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => f.slice(0, -5))
);

const openingHref = (p) => (p.id && OPENINGS.has(p.id) ? `/openings/${p.id}.html` : null);

// ===================================================== the marketplace evidence
//
// PULLED OUT OF data/buying.json, NEVER WRITTEN HERE. That file is this repo's
// record of what each venue's own pages say, with the address and the day each
// one was read, and the marketplace split shows up in it as a difference in
// return windows and shipping eligibility. Those readings are the evidence for
// the claim this section makes, so the section quotes them rather than asserting
// something about a company on its own authority.
//
// IT THROWS IF THEY GO. A section arguing that the big retailers' sites carry
// third-party listings, with the sourcing quietly missing underneath it, is the
// exact shape of an unsourced claim about a named company, which is the one
// thing this site refuses to publish. Better a failed build than that.
const RETAIL = (buying.venues || []).find((v) => /^Target/.test(v.name || ""));
const MARKET_SOURCES = ((RETAIL && RETAIL.sources) || []).filter((s) =>
  /marketplace|target plus/i.test(s.what || "")
);
if (MARKET_SOURCES.length < 3) {
  throw new Error(
    `build-what-to-buy: the reseller section rests on data/buying.json's own readings of the\n` +
      `  big retailers' shipping and return pages, the ones that turn on the split between the\n` +
      `  shop's own stock and third-party marketplace listings. Found ${MARKET_SOURCES.length} of them and\n` +
      `  expected at least 3. Either that venue was renamed or restructured, or the readings were\n` +
      `  dropped. Do NOT paste a claim about a retailer into data/what-to-buy.json to get past\n` +
      `  this: re-point the join, or take the section out.`
  );
}
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

// ================================================================== the copy

const quick = guide.quick.map((q) => ({ ...q, p: product(q.product, { needPrice: true }) }));
const situations = guide.situations.map((s) => ({
  ...s,
  picks: s.picks.map((k) => ({ ...k, p: product(k.product, { needPrice: true }) })),
}));
// The glossary does NOT require a price: it is explaining what a thing is, and
// seven rows in msrp.json legitimately carry no figure at all.
const glossary = guide.glossary.map((g) => ({ ...g, p: product(g.product) }));
const avoid = guide.avoid.map((a) => ({
  ...a,
  p: a.product ? product(a.product, { needPrice: true }) : null,
}));
const playing = guide.playing.products.map((label) => product(label, { needPrice: true }));

// ------------------------------------------------------- the collector band
//
// EVERY SAFE PICK NEEDS A PRICE, and harder than anywhere else on this page:
// each one also carries a walk-away figure computed off that price, and a
// ceiling with nothing under it is the single most useless thing this band could
// print at somebody standing in a shop.
const collector = {
  ...guide.collector,
  safe: guide.collector.safe.map((k) => ({ ...k, p: product(k.product, { needPrice: true }) })),
};

// ------------------------------------------------------------- the arithmetic
//
// COMPUTED, NEVER TYPED, and the copy is written so it stays true whichever way
// the sum comes out. At the figures read on 17 August 2026 a pack costs the same
// inside a bundle as inside a thirty six pack display box, which is the whole
// argument against a booster box as a first purchase: the big box is not a bulk
// discount, it is the same packs bought all at once. If a re-read ever separates
// them, the verdict below changes with the numbers rather than contradicting
// them.
const BOX = product("Booster box", { needPrice: true });
const BUNDLE = product("Booster Bundle", { needPrice: true });
const ETB = product("Elite Trainer Box", { needPrice: true });
const boxPer = perPack(BOX);
const bundlePer = perPack(BUNDLE);
const boxVerdict = (() => {
  if (boxPer == null || bundlePer == null) return "";
  const gap = bundlePer - boxPer;
  if (Math.abs(gap) < 0.005) {
    return (
      `Those are the same number. The big box is not a bulk discount, it is the same packs ` +
      `bought all at once.`
    );
  }
  if (gap > 0) {
    return (
      `The box works out ${esc(moneyExact(gap))} a pack cheaper, which over ${BOX.packs} packs is ` +
      `${esc(moneyExact(gap * BOX.packs))} saved for ${esc(moneyExact(BOX.price - BUNDLE.price))} more ` +
      `spent on the day.`
    );
  }
  return (
    `The box is actually ${esc(moneyExact(-gap))} a pack DEARER, so there is no saving in it at all.`
  );
})();

const perPackRow = (p) => {
  const v = perPack(p);
  if (v == null) return "";
  return `        <li><b>${esc(moneyExact(v))}</b> a pack <span>${esc(p.label)}, ${
    esc(moneyExact(p.price))
  } for ${p.packs} pack${p.packs === 1 ? "" : "s"}</span></li>`;
};

// The products whose per-pack sum this page shows. Cheapest product first, never
// sorted by the per-pack figure: ranking them would build a league table out of
// six rows and would put the answer before the reasoning.
//
// THE SLEEVED PACK AND NOT THE LOOSE ONE, and it matters. They are the same
// $4.49 in msrp.json, but only the sleeved row carries a `packsFrom`, so only it
// joins to a sourced pack count and only it can appear in a sum whose divisor is
// a number this site sourced. perPack() returns null for the loose row and the
// filter below drops it, silently, which is exactly the kind of quiet hole worth
// naming rather than leaving somebody to rediscover.
const PER_PACK = [
  product("Sleeved booster pack", { needPrice: true }),
  product("Mini tin", { needPrice: true }),
  product("Three-pack blister", { needPrice: true }),
  BUNDLE,
  ETB,
  BOX,
].filter((p) => perPack(p) != null);

/**
 * One sourced shop listing, with the division shown.
 *
 * ONE LISTING, ONE PRODUCT, ONE DATE, and it says all three, because "GameStop
 * charges double" is a claim about a company and this is a claim about a web
 * page on an afternoon. Same discipline and very nearly the same words as
 * /msrp.html, which prints all four of the listings this repo holds. This page
 * prints the two that back a specific piece of advice and points at that page
 * for the rest, rather than reproducing the band.
 */
const listingBox = (p) => {
  if (!p.seen) return "";
  const m = typeof p.price === "number" ? p.seen.amount / p.price : null;
  return `      <p class="wtb-seen"><b>${esc(moneyExact(p.seen.amount))} asked, ${esc(
    moneyExact(p.price)
  )} suggested${m ? `, which is ${esc(multStr(m))}x` : ""}.</b> That is one listing, the ${esc(
    p.seen.product
  )} at ${esc(p.seen.retailer)}, read ${esc(
    longDate(p.seen.readAt)
  )}. It is an example of the sum, not a score for the shop.${
    p.seen.url ? ` Read at ${esc(p.seen.url)}` : ""
  }</p>`;
};

const links = (ls) =>
  (ls || []).length
    ? `      <p class="wtb-links">${ls
        .map(([h, l]) => `<a href="${esc(h)}">${esc(l)}</a>`)
        .join("\n        ")}</p>`
    : "";

const para = (ps, cls = "") =>
  (ps || []).map((p) => `      <p${cls ? ` class="${cls}"` : ""}>${esc(p)}</p>`).join("\n");

// ---------------------------------------------------------------- the cards

const pickCard = (k, i, sIndex) => {
  const p = k.p;
  const href = openingHref(p);
  const name = href
    ? `<a href="${esc(href)}">${esc(p.label)}</a>`
    : esc(p.label);
  return `        <li class="wtb-pick${i > 0 ? " wtb-alt" : ""}">
          <div class="wtb-top">
            ${shot(p.label, { eager: sIndex === 0 && i === 0 })}
            <div>
              <h4>${i === 0 ? "Get this" : "Or"}: ${name}</h4>
              <p class="wtb-price"><b>${esc(moneyExact(p.price))}</b><span>${sourceLine(p)}</span></p>
            </div>
          </div>
          <p class="wtb-why">${esc(k.why)}</p>${
            // NO `what` HERE, AND IT WAS THERE FIRST. Several products are the
            // recommendation in one situation and the alternative in another,
            // and every one of them also has a glossary entry, so printing the
            // joined description on every card put the same sentence on the page
            // three times for a mini tin. The `why` is already a description in
            // the second person, which is what a recommendation needs; the
            // formal one lives in the glossary, once, where it is the point.
            // The photo credit stays, because a photograph of one set's box
            // standing in for a whole type has to name the box it is of.
            shotName(p.label)
              ? `\n          <p class="wtb-what">Pictured: ${esc(shotName(p.label))}.</p>`
              : ""
          }
        </li>`;
};

// ============================================== the jump strip, and why it exists
//
// MEASURED BEFORE IT WAS WRITTEN. At 390x844 this page is 33 phone screens and
// the collector band added 9 of them. A reader who arrived because they are
// buying for somebody who already collects would have had to scroll past six
// beginner situations, a glossary and an entire "what to buy first" argument to
// reach the one part written for them, and nobody does that. The band being good
// is worth nothing if it is unreachable.
//
// FIVE LINKS, ONE ROW OF PILLS, BELOW THE QUICK STRIP. Below, because the fold
// budget above it is already spent and argued for in the STYLE block: the first
// concrete recommendation with a price on it has to be on screen without
// scrolling, and this must not push it. Re-measured after adding it and the
// first price is unmoved.
//
// The hrefs are anchors into sections of THIS page, so nothing here can 404 in
// the way an outbound link can, but a mistyped one fails silently. They are
// checked against the rendered markup below rather than trusted.
const JUMP = [
  ["#situations", "Who it is for"],
  ["#collector", "Gifts for a collector"],
  ["#the-words", "What the boxes are"],
  ["#do-not", "Not to buy first"],
  ["#reseller", "Why a price looks wrong"],
];

const situationCard = (s, i) => `    <li class="wtb-sit" id="${esc(s.id)}">
      <h3>${esc(s.who)}</h3>
      <p class="wtb-sub">${esc(s.sub)}</p>
      <ul class="wtb-picks">
${s.picks.map((k, j) => pickCard(k, j, i)).join("\n")}
      </ul>
${links(s.links)}
    </li>`;

const glossRow = (g) => `      <li class="wtb-gl">
        <div class="wtb-top">
          ${shot(g.p.label)}
          <div>
            <h3>${esc(g.p.label)}</h3>
            <p class="wtb-glprice">${
              typeof g.p.price === "number"
                ? `<b>${esc(moneyExact(g.p.price))}</b> suggested${
                    g.p.packs ? `, ${g.p.packs} pack${g.p.packs === 1 ? "" : "s"} inside` : ""
                  }`
                : `<b>No single price.</b> ${esc(g.p.blank || "not sourced")}`
            }</p>
          </div>
        </div>
        <p class="wtb-plain">${esc(g.plain)}</p>
        <p class="wtb-what">${esc(g.p.what)}${
          shotName(g.p.label) ? ` Pictured: ${esc(shotName(g.p.label))}.` : ""
        }</p>
      </li>`;

// THE `id` IS EMITTED NOW AND WAS NOT BEFORE. data/what-to-buy.json has carried
// one on every row here since the file was written and nothing rendered it, so
// the anchors existed in the data and not in the page. The collector band links
// to #not-a-mystery-box rather than restating that argument a second time, which
// only works if the anchor is really there.
const avoidRow = (a) => `      <li class="wtb-no"${a.id ? ` id="${esc(a.id)}"` : ""}>
        <h3>${esc(a.title)}</h3>
${para(a.body)}
${a.p ? listingBox(a.p) : ""}
${links(a.links)}
      </li>`;

const playRow = (p) => `        <li><b>${esc(p.label)}</b> <span>${esc(
  moneyExact(p.price)
)}</span><br>${esc(p.what)}</li>`;

// ==================================================== the collector band's parts
//
// THE THREE TESTS ARE THE DURABLE HALF OF THIS BAND and they are deliberately
// not a product list. Every price here is a dated reading and will be wrong
// eventually; "can this be a duplicate, do they still get to choose, is it from
// what is on the shelf now" keeps working on a product this page has never heard
// of, in a shop this site has never read. Ordered as a reader would apply them.
const testRow = (t, i) => `        <li class="gft-t">
          <p class="gft-tq"><b>${i + 1}</b>${esc(t.q)}</p>
          <p class="gft-ta">${esc(t.a)}</p>
        </li>`;

/**
 * One safe pick, with the walk-away figure beside the suggested one.
 *
 * THE CEILING IS THE POINT OF THIS CARD AND IT IS COMPUTED, so it moves with the
 * price above it and with data/over-msrp.json's bands, and it cannot be typed
 * wrong. The rule behind it is stated ONCE above the list rather than repeated
 * four times: four copies of the same sentence is roughly a phone screen of
 * height spent saying nothing new, on a band that already sits a long way down a
 * long page.
 *
 * NO `what` HERE, for the same reason the situation cards give: every one of
 * these products also has a glossary entry further down, and the `why` is
 * already a description in the second person.
 */
const safeCard = (k) => {
  const p = k.p;
  const href = openingHref(p);
  const name = href ? `<a href="${esc(href)}">${esc(p.label)}</a>` : esc(p.label);
  return `        <li class="gft-pick">
          <div class="wtb-top">
            ${shot(p.label)}
            <div>
              <h4>${name}</h4>
              <p class="wtb-price"><b>${esc(moneyExact(p.price))}</b><span>${sourceLine(p)}</span></p>
            </div>
          </div>
          <p class="gft-cap">Walk away over <b>${esc(moneyExact(ceilingOf(p)))}</b></p>
          <p class="wtb-why">${esc(k.why)}</p>${
            shotName(p.label)
              ? `\n          <p class="wtb-what">Pictured: ${esc(shotName(p.label))}.</p>`
              : ""
          }
        </li>`;
};

const unsafeRow = (u) => `      <li class="wtb-no"${u.id ? ` id="${esc(u.id)}"` : ""}>
        <h3>${esc(u.title)}</h3>
${para(u.body)}
${links(u.links)}
      </li>`;

// One listing, named so it can be checked, in the same words /msrp.html uses for
// the same four readings. THE URL IS NOT IN HERE and is printed at the END of
// the paragraph instead: written inline it produced "at GameStop, read August 17
// 2026, at https://..., at exactly the suggested figure", which is three
// different senses of the word "at" in one clause. Both addresses are still
// printed in full, PRINTED AND NOT LINKED, which is this site's outbound rule
// and what the rest of this file already does.
const listingWords = (l) => `the ${l.product} at ${l.retailer}, read ${longDate(l.readAt)}`;

// THE EVIDENCE UNDER THE RULE OF THUMB, AND EVERY FIGURE IN IT IS COUNTED RATHER
// THAN WRITTEN. The bands themselves are judgement and the page says so; this
// paragraph is the part that is not. It states a range across every dated shop
// listing this repo can source, names only the two ENDS of it, and never orders
// the ones in between, which is the same refusal to build a scoreboard that
// data/over-msrp.json's _readme argues for at length.
const EVIDENCE = `${LISTINGS.length} shop listings sit in this site's own files, across ${SHOP_COUNT} ` +
  `different shops, ${
    READ_DATES.length > 1
      ? `read between ${longDate(READ_DATES[0])} and ${longDate(READ_DATES[READ_DATES.length - 1])}`
      : `all read ${longDate(READ_DATES[0])}`
  }. Every one of them falls between ${multStr(CHEAPEST.mult)}x and ${multStr(DEAREST.mult)}x the ` +
  `suggested price. ${UNDER_LINE} are under the ${multStr(DOUBLE)}x line and ${OVER_LINE} ` +
  `${OVER_LINE === 1 ? "is" : "are"} over it, so the figure beside each product above is not a ` +
  `number you will meet every day. It is the one worth having ready.`;

const EVIDENCE_ENDS = `The cheapest of them sits at ${
  Math.abs(CHEAPEST.mult - 1) < 0.005
    ? "exactly the suggested figure"
    : `${multStr(CHEAPEST.mult)}x the suggested figure`
}: ${listingWords(CHEAPEST)}. The dearest sits at ${multStr(DEAREST.mult)}x: ${listingWords(
  DEAREST
)}.${
  SAME_CHAIN
    ? ` Both ends of that range are the same chain, on two different products, which is the whole ` +
      `reason this is not a list of shops to trust and shops to avoid. There is no shop that is ` +
      `always at the suggested price and none that is always over it. There is only the sum.`
    : ` Neither of those is a verdict on the shop. Each one is a single product, at a single shop, ` +
      `on a single day, at an address you can open and check for yourself.`
}`;

// The two addresses, printed and not linked, so both ends of the range can be
// checked by somebody who does not believe them.
const EVIDENCE_URLS = [CHEAPEST, DEAREST]
  .map((l) => l.url)
  .filter(Boolean)
  .filter((u, i, a) => a.indexOf(u) === i);

// =================================================================== the page

const TITLE =
  "What Pokemon cards should I buy? A guide for parents and beginners";
const DESC =
  `What to actually buy your kid, what it should cost, and what not to buy. Plain English, ` +
  `no jargon, every price sourced from Pokemon's own shop or from agreeing price references.`;
const PATH = "/what-to-buy.html";

// FAQPage, and every answer here is a shortened version of copy that is visibly
// on the page. Nothing is claimed in the structured data that a reader cannot
// read for themselves, which is both Google's rule and the honest version of it.
const FAQ = [
  [
    "What Pokemon cards should I buy for my kid?",
    `For a young child who has never played, ${
      product("My First Battle", { needPrice: true }).label
    } at ${moneyExact(product("My First Battle", { needPrice: true }).price)} is built for exactly ` +
      `that. For a child ` +
      `who just wants to open packs, a Booster Bundle at ${moneyExact(BUNDLE.price)} is packs and ` +
      `nothing else. For one big present, an Elite Trainer Box at ${moneyExact(ETB.price)} has ` +
      `packs plus a box, sleeves, dice and counters.`,
  ],
  [
    "What is an Elite Trainer Box?",
    `An ETB is a cardboard box with a lid holding ${
      ETB.packs ? `${ETB.packs} booster packs` : "booster packs"
    } plus the bits for looking after cards: sleeves, dice, damage counters and a promo card. ` +
      `Suggested price ${moneyExact(ETB.price)}.`,
  ],
  [
    "Should I buy a booster box first?",
    // THE COMPARISON IS COMPUTED, not written down, for the same reason
    // boxVerdict above is: a structured-data answer that contradicts the visible
    // arithmetic on the same page is worse than no structured data at all.
    `Usually not. A booster box is ${BOX.packs} packs at ${moneyExact(BOX.price)} suggested. ` +
      `At the suggested prices a pack works out at ${moneyExact(boxPer)} inside the box against ` +
      `${moneyExact(bundlePer)} inside a booster bundle, so ${
        Math.abs(boxPer - bundlePer) < 0.005
          ? "the big box is not a bulk discount at all. It is the same packs bought all at once."
          : "the difference is small against the amount you commit on the day."
      }`,
  ],
  [
    // NO FIGURE IN THIS QUESTION, and it had one. "$300" is what somebody types,
    // and it is also a number this repo cannot source for a MARKETPLACE listing:
    // the one $299.99 reading it holds is GameStop's own first-party price, and
    // putting it in a question about resellers would conflate the two in exactly
    // the way the visible section is careful not to. The search intent survives
    // the change; an unsourceable figure in structured data would not.
    "Why is a Pokemon booster box so expensive on a big retailer's website?",
    `Because those sites are a shop and a marketplace at the same time. When the shop's own stock ` +
      `sells out, other companies list the same product on the same page at whatever price they ` +
      `choose. Check who the item is sold by and who ships it, and wait for a restock rather than ` +
      `paying it.`,
  ],
  [
    // THE GIFT QUESTION, AND THE ANSWER IS THE VISIBLE BAND SHORTENED rather
    // than a new claim. The products and both figures are joined and computed
    // exactly as the cards above are, so this answer cannot drift from the page
    // it summarises. NO PRODUCT NAMED HERE THAT THE BAND DOES NOT RECOMMEND.
    "What should I get someone who already collects Pokemon cards?",
    `Something they cannot already have, from what is on the shelf now, that still leaves the ` +
      `choosing to them. A Booster Bundle at ${moneyExact(BUNDLE.price)} is packs and nothing ` +
      `else, and nobody owns an unopened pack twice. An Elite Trainer Box at ${moneyExact(
        ETB.price
      )} adds sleeves, dice and a box, which get used whatever they collect. Do not pick one ` +
      `specific card, a graded card or a mystery box for somebody whose taste you do not know. ` +
      `And check the price: at more than ${multStr(DOUBLE)} times the suggested figure, put it ` +
      `down and come back.`,
  ],
  [
    "What should I buy to actually learn to play Pokemon?",
    `A product with finished decks in it. Booster packs are loose cards and are not a deck. ` +
      `${product("Battle Academy", { needPrice: true }).label} at ${moneyExact(
        product("Battle Academy", { needPrice: true }).price
      )} has three ready made decks, a board, counters and a rulebook, and no booster packs at all.`,
  ],
];

const LD = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "What to buy" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
];

const STYLE = `
/* ==========================================================================
   THE FOLD IS THE BUDGET AND EVERYTHING ABOVE .wtb-quick IS SPENDING IT.

   Measured at 390x844 DPR2 in headless Chrome. The reader is in a shop and the
   page's promise is a concrete recommendation, so the FIRST RECOMMENDATION WITH
   A PRICE ON IT HAS TO BE ON SCREEN WITHOUT SCROLLING. Everything here is in
   service of that:

     - the quick strip carries NO photographs. Three 72px thumbnails would cost
       roughly 240px and push the third row under the fold for a picture nobody
       needs to recognise a name they are about to read anyway. The photographs
       start in the detailed cards below, where there is room.
     - each quick row is ONE line of reason. A second line costs ~22px a row and
       there are three rows.
     - the lede is one sentence and the page has no warning strip above the
       answer, unlike /msrp.html, which has a rule to state before its prices
       mean anything. This page's rules can wait until after the answer.
   ========================================================================== */
.wtb-lede{max-width:34em}

.wtb-quick{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.wtb-quick li{display:grid;grid-template-columns:1fr auto;gap:var(--s2) var(--s3);
  align-items:baseline;padding:var(--s3) var(--s4);border:3px solid var(--keyline);
  border-radius:var(--r);background:var(--card);box-shadow:var(--hard-lg)}
.wtb-quick b{font-size:1.05rem;line-height:1.2}
.wtb-quick .q-p{font-size:1.5rem;font-weight:800;line-height:1;letter-spacing:-.01em;
  justify-self:end}
.wtb-quick .q-for{grid-column:1/-1;margin:0;font-size:.85rem;color:var(--ink-soft);
  line-height:1.35}

/* THE JUMP STRIP. It reuses .wtb-links for the pills, so the 44px tap target
   rule and the hover already apply and this adds three declarations rather than
   a second set of buttons. The label is a quiet mono line rather than a heading:
   a real heading here would sit between the h1 and the first h2 and read as a
   section of the page instead of a signpost to one. */
.wtb-jump{margin:var(--s5) 0 0}
.wtb-jlabel{margin:0 0 var(--s2);font:700 .7rem/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-soft)}
.wtb-jump .wtb-links{margin:0}

/* ------------------------------------------------------------- the situations */
.wtb-sits{list-style:none;margin:0;padding:0;display:grid;gap:var(--s6)}
.wtb-sit h3{margin:0;font-size:1.25rem;line-height:1.2}
.wtb-sub{margin:var(--s2) 0 0;color:var(--ink-soft);font-size:.95rem}

.wtb-picks{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.wtb-pick{border:3px solid var(--keyline);border-radius:var(--r);background:var(--card);
  padding:var(--s4);box-shadow:var(--hard-lg)}
/* The alternative is visibly the alternative. Same information, quieter frame,
   so the eye lands on the recommendation first and does not have to read both
   to work out which one is the answer. */
.wtb-alt{box-shadow:none;border-width:2px;background:var(--paper-2)}

.wtb-top{display:grid;grid-template-columns:72px 1fr;gap:var(--s3);align-items:start}
.wtb-pic{width:72px;height:72px;object-fit:contain;border-radius:6px;background:var(--paper-3)}
.wtb-nopic{width:72px;height:72px;border-radius:6px;
  background:repeating-linear-gradient(45deg,var(--paper-3),var(--paper-3) 5px,
    var(--paper) 5px,var(--paper) 10px)}
.wtb-top h4{margin:0;font-size:1rem;line-height:1.25}
/* 44px MINIMUM ON EVERY PRODUCT LINK, and these are real links: each one goes to
   that product's own page under /openings/, where it is opened on camera. The
   heading itself is not the target, the anchor inside it is, so the row still
   reads as a heading rather than as a button. */
.wtb-top h4 a{display:inline-flex;align-items:center;min-height:44px}
.wtb-price{margin:var(--s2) 0 0;display:flex;flex-direction:column;gap:2px}
.wtb-price b{font-size:1.75rem;line-height:1;font-weight:800;letter-spacing:-.01em}
.wtb-price span{font:700 .66rem/1.35 var(--mono);letter-spacing:.03em;
  text-transform:uppercase;color:var(--ink-soft)}
.wtb-why{margin:var(--s3) 0 0;font-size:.95rem}
.wtb-what{margin:var(--s2) 0 0;font-size:.85rem;color:var(--ink-soft);line-height:1.45}

.wtb-links{margin:var(--s3) 0 0;display:flex;flex-wrap:wrap;gap:var(--s2)}
/* 44px TAP TARGETS, because these are the page's navigation and they sit in
   clusters where a mis-tap lands on the neighbour. Inline prose links elsewhere
   on the page stay inline at the site's normal size: turning every cross
   reference in a paragraph into a 44px box breaks the measure, which is the
   trade /msrp.html already worked through for its listing links. */
.wtb-links a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s4);
  border:2px solid var(--keyline);border-radius:var(--r-pill);background:var(--paper-2);
  text-decoration:none;font-weight:700;font-size:.85rem}
.wtb-links a:hover{background:var(--mustard)}

/* -------------------------------------------------------------- the glossary */
.wtb-gloss{list-style:none;margin:0;padding:0;display:grid;gap:var(--s4)}
.wtb-gl{border:3px solid var(--keyline);border-radius:var(--r);background:var(--card);
  padding:var(--s4);box-shadow:var(--hard-lg)}
.wtb-gl h3{margin:0;font-size:1.05rem;line-height:1.25}
.wtb-glprice{margin:var(--s2) 0 0;font:.78rem/1.4 var(--mono);color:var(--ink-soft)}
.wtb-glprice b{font-size:1rem;color:var(--ink)}
.wtb-plain{margin:var(--s3) 0 0;font-size:.95rem}

/* ------------------------------------------------------------ the do-not band */
.wtb-nos{list-style:none;margin:0;padding:0;display:grid;gap:var(--s5)}
.wtb-no{border-left:5px solid var(--keyline);padding-left:var(--s4)}
.wtb-no h3{margin:0 0 var(--s3);font-size:1.15rem;line-height:1.25}
.wtb-seen{margin:var(--s3) 0 0;padding:var(--s3);border-radius:6px;background:var(--paper-3);
  font-size:.85rem;line-height:1.5;overflow-wrap:anywhere}

/* The per-pack sums. A DEFINITION LIST WOULD BE NEATER AND IS WRONG at 390px:
   the label runs to about 45 characters and the figure has to stay hard left
   where a column of them can be compared down the page, so the figure leads and
   the label wraps under it. */
.wtb-pp{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s2)}
.wtb-pp li{display:grid;grid-template-columns:5.5em 1fr;gap:var(--s3);align-items:baseline;
  padding:var(--s2) 0;border-top:1px solid var(--hair)}
.wtb-pp b{font-size:1.15rem;font-weight:800}
.wtb-pp span{font-size:.85rem;color:var(--ink-soft);line-height:1.4}

/* -------------------------------------------------------------- the reseller */
.wtb-flag{max-width:40em;margin:0 0 var(--s4);padding:var(--s3) var(--s4);
  border:3px solid var(--keyline);border-radius:var(--r);background:var(--paper-3);
  font-size:.95rem;line-height:1.5}
.wtb-flag b{font-weight:800}
.wtb-src{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.wtb-src li{font:.75rem/1.5 var(--mono);color:var(--ink-soft);overflow-wrap:anywhere}
.wtb-src b{color:var(--ink)}

/* ---------------------------------------------------------------- the decks */
.wtb-deck{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.wtb-deck li{padding:var(--s3) var(--s4);border:2px solid var(--keyline);border-radius:var(--r);
  background:var(--paper-2);font-size:.9rem;line-height:1.45}
.wtb-deck b{font-size:1rem}
.wtb-deck span{font-weight:800}

/* ==========================================================================
   THE COLLECTOR BAND.

   It reuses .wtb-top, .wtb-price, .wtb-why, .wtb-what and the whole .wtb-no
   block DELIBERATELY rather than inventing a parallel set. A gift for a
   collector is the same shape of thing as a gift for a beginner and should look
   like it; a second visual language on one page reads as two pages stapled
   together, and it would double the CSS in a <head> that is already inline on a
   render blocking path.

   Only three things here are genuinely new, and each is new because it carries
   information nothing else on the page carries.
   ========================================================================== */

/* THE THREE TESTS. Numbered, because they are applied in order and the order is
   the argument: rule out a duplicate first, then check who is doing the
   choosing, then check the era. The number is a big quiet mark rather than a
   list marker, so it survives the list-style:none the rest of the page uses. */
.gft-tests{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s4)}
.gft-t{padding-left:var(--s4);border-left:5px solid var(--keyline)}
.gft-tq{margin:0;font-size:1.05rem;font-weight:800;line-height:1.3;
  display:grid;grid-template-columns:1.6em 1fr;gap:var(--s2);align-items:baseline}
.gft-tq b{font:800 1.5rem/1 var(--mono);color:var(--ink-soft)}
.gft-ta{margin:var(--s2) 0 0;font-size:.95rem;grid-column:1/-1}

/* THE ONE-LINE RULE ABOVE THE PICKS. It exists so the reader meets the ceiling
   figure on the first card already knowing what it is. Without it the cards
   print a dollar amount labelled "walk away over" with no stated basis, which is
   exactly the kind of unexplained number this page is built to argue against. */
.gft-rule{margin:var(--s4) 0 0;padding:var(--s3) var(--s4);border:3px solid var(--keyline);
  border-radius:var(--r);background:var(--paper-3);font-size:.95rem;line-height:1.5;max-width:40em}

.gft-picks{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.gft-pick{border:3px solid var(--keyline);border-radius:var(--r);background:var(--card);
  padding:var(--s4);box-shadow:var(--hard-lg)}
.gft-pick h4{margin:0;font-size:1rem;line-height:1.25}
/* 44px, and the same argument .wtb-top h4 a makes: the anchor is the target, not
   the heading, so the row still reads as a heading. */
.gft-pick h4 a{display:inline-flex;align-items:center;min-height:44px}

/* THE CEILING. It is a SEPARATE LINE and not part of the price block on purpose:
   the two figures answer different questions ("what is this worth" against "when
   do I stop") and stacking them as one column of numbers at 390px had the reader
   comparing them as if they were alternatives. Screenshotted both ways. The rule
   above it is what makes this line legible on its own. */
.gft-cap{margin:var(--s3) 0 0;padding:var(--s2) var(--s3);border-radius:6px;
  background:var(--paper-3);font:700 .85rem/1.4 var(--mono);letter-spacing:.02em;
  text-transform:uppercase;display:flex;flex-wrap:wrap;gap:.4em;align-items:baseline}
.gft-cap b{font-size:1.15rem;letter-spacing:-.01em}

/* The gaps. Prose rather than a table, because every entry is a sentence about
   something this site does NOT know, and a table of absences reads as data. */
.gft-gaps{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3)}
.gft-gaps li{padding-left:var(--s4);border-left:3px solid var(--hair);font-size:.9rem;
  line-height:1.5;max-width:34em;color:var(--ink-soft)}

/* ==========================================================================
   THE READING MEASURE, AND ui.css's OWN CAP IS TOO WIDE FOR THIS PAGE.

   ui.css sets --measure:36em on every paragraph in main. At the site's 17px
   body and Outfit's ~2.31 characters per em, 36em is about 83 characters a
   line, which is fine on a reference page somebody scans and long for a page of
   running advice that a nervous reader is trying to follow sentence by
   sentence. 31em lands at about 72, inside the usual 45 to 75 band.

   Only the prose is capped. The rows above are layout, not prose, and capping
   those would leave a price stranded in the middle of a wide card at 1440.
   ========================================================================== */
.wtb-body p,.wtb-why,.wtb-plain,.wtb-sub,.wtb-no p,.gft-ta,.gft-why{max-width:31em}

/* ui.css OPENS WITH A UNIVERSAL margin:0 RESET, so a paragraph has no spacing
   until a page gives it some. NO BACKTICKS ANYWHERE IN THIS BLOCK: it is inside
   a template literal, and quoting the rule as code here broke the build the
   first time it was written. Same trap ui.css's own header records for its
   close-comment marker. A paragraph has no spacing until a page
   gives it some, and every builder here sets its own. Screenshotted at 1440
   without this and the three-paragraph blocks in the do-not band rendered as one
   unbroken wall of text: the copy was fine and the page looked like a legal
   notice. Nothing errors, which is why it is worth a comment rather than a fix
   nobody records. */
.wtb-body p+p,.wtb-no p+p{margin-top:var(--s3)}
.wtb-body h3{margin:var(--s5) 0 var(--s3);font-size:1.15rem;line-height:1.25}
.wtb-body h3:first-child{margin-top:0}

/* ==========================================================================
   DESKTOP, AND IT IS THE FAILURE CLAUDE.md ALREADY HAS A SECTION ABOUT.

   Everything above is one column, which is right on a phone and wrong the
   moment the wrap exceeds a card's useful width. Screenshotted at 1440x900
   before these rules existed: .wrap is 1,452px, so every quick row, every
   recommendation card and every glossary card ran the full 1,452 with its text
   capped at 471 and roughly 900px of nothing to the right of it, and the price
   in a quick row sat about a thousand pixels from the name it belonged to. That
   is the same "37% of the width" failure the home page had, at a smaller scale.

   THE FIX IS MORE CARDS PER ROW AND NOT A WIDER CARD, which is the conclusion
   that section reaches and the reason it is worth repeating here. A wider card
   would only stretch the paragraph past its measure.

   ALL min-width, so nothing a phone or a tablet renders changes. 1000px is
   ui.css's own desktop breakpoint, used here so this page steps at the same
   place the rest of the site does.

   THESE LIVE IN THE PAGE AND NOT IN ui.css on purpose: they name eight classes
   that appear on this page and nowhere else, and ui.css is render blocking on
   every page of the site. Same call build-proto.mjs's inline block makes for
   .vcar and .hofx. If this page's components ever get reused, move them.
   ========================================================================== */
@media(min-width:1000px){
/* The quick strip is a NAME AND A PRICE and the two have to stay in the same
   glance. 760 keeps the price about 600px from the name at most, which is
   already generous, and stops the row growing with the window. */
.wtb-quick li{max-width:760px}
/* TWO FIXED COLUMNS, NOT auto-fit. A situation carries one pick or two, and
   auto-fit stretches a lone card back to the full width, which is the exact
   thing being fixed. A fixed pair inside a capped container gives the single
   Battle Academy card the same width as every other card on the page, so it
   reads as deliberate rather than as a card that failed to fill its row. */
.wtb-picks{grid-template-columns:1fr 1fr;max-width:1000px}
.wtb-gloss{grid-template-columns:1fr 1fr}
.wtb-deck{grid-template-columns:1fr 1fr;max-width:1000px}
.wtb-pp{max-width:600px}
.wtb-no{max-width:46em}
/* TWO COLUMNS, capped, exactly as .wtb-picks is and for the identical reason
   recorded there: the fix for a 1,452px wrap is more cards per row, never a
   wider card. Four safe picks split 2x2 rather than stretching one card across
   the window with its paragraph capped at 31em and 900px of nothing beside it. */
.gft-picks{grid-template-columns:1fr 1fr;max-width:1000px}
/* The tests stay ONE column at every width. Three numbered steps read as a
   sequence down the page and as three unrelated boxes across it, which is the
   same call the listings on /msrp.html make. */
.gft-tests{max-width:46em}
/* The first heading in the list sits directly under the section lede, and
   .wtb-sit h3 has margin:0 so the gap between list items does not double up. */
.wtb-sits{margin-top:var(--s5)}
}
@media(min-width:1400px){
.wtb-gloss{grid-template-columns:1fr 1fr 1fr}
}
`;

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css and miniCSS makes in build-msrp.mjs,
// build-openings.mjs and build-set-pages.mjs, and the same expression: comments,
// plus the indentation between rules, and nothing else. This block is inline in
// a render blocking <head> and roughly half of it is prose.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${SITE}${PATH}">
<meta property="og:title" content="${esc(TITLE.split(" | ")[0])}">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${PATH}">
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
${LD.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>What to buy</span></nav>
      <h1>What Pokemon cards should I <span class="hl">buy</span>?</h1>
      <p class="lede wtb-lede">Nobody explains any of this in the shop, so here it is. Straight answers,
        real prices, and no words you are supposed to already know.</p>

      <ul class="wtb-quick">
${quick
  .map(
    (q) => `        <li>
          <b>${esc(q.p.label)}</b>
          <span class="q-p">${esc(moneyExact(q.p.price))}</span>
          <p class="q-for">${esc(q.for)}</p>
        </li>`
  )
  .join("\n")}
      </ul>

      <nav class="wtb-jump" aria-label="Sections of this guide">
        <p class="wtb-jlabel">Jump to</p>
        <div class="wtb-links">
${JUMP.map(([h, l]) => `          <a href="${esc(h)}">${esc(l)}</a>`).join("\n")}
        </div>
      </nav>
    </div>
  </section>

  <section class="band tight" id="situations">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pick your situation</p>
      <h2>Who is it <span class="hl">for</span>?</h2>
      <p class="lede wtb-lede">Find the one that sounds like you. Every price below is what the
        manufacturer suggests, not what a shop has to charge.</p>
      <ol class="wtb-sits">
${situations.map(situationCard).join("\n")}
      </ol>

      <div class="wtb-body" style="margin-top:var(--s6)" id="one-card">
        <h3>${esc(guide.oneCard.title)}</h3>
${para(guide.oneCard.body)}
      </div>
${links(guide.oneCard.links)}
    </div>
  </section>

  <section class="tight" id="${esc(collector.id)}">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Gifts for a collector</p>
      <h2>Buying for somebody who already <span class="hl">collects</span></h2>
      <p class="lede wtb-lede">${esc(collector.lede)}</p>
      <div class="wtb-body" style="margin-top:var(--s4)">
${para(collector.intro)}
      </div>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>Three questions that decide it</h3>
        <p>You cannot judge their taste and you should stop trying. You can judge the product,
          and these three questions do it without knowing anything about the person.</p>
      </div>
      <ol class="gft-tests">
${collector.tests.map(testRow).join("\n")}
      </ol>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>Four things that pass all three</h3>
      </div>
      <p class="gft-rule">Cheapest first. Each one shows what the manufacturer suggests and, beside
        it, the figure to put the box down over: <b>${esc(
          multStr(DOUBLE)
        )} times the suggestion</b>. That line is this site's rule of thumb rather than a
        measurement, and the evidence for it is directly below.</p>
      <ul class="gft-picks">
${collector.safe.map(safeCard).join("\n")}
      </ul>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>${esc(collector.ceiling.title)}</h3>
${para(collector.ceiling.body)}
        <p>${esc(EVIDENCE)}</p>
        <p>${esc(EVIDENCE_ENDS)}</p>
      </div>${
        EVIDENCE_URLS.length
          ? `\n      <p class="wtb-seen">Read at ${EVIDENCE_URLS.map((u) => esc(u)).join(
              " and at "
            )}. The rest are printed in full, each with its own address and date, on
        <a href="/msrp.html">the MSRP check</a> and on
        <a href="/retailers.html">stores that sell cards</a>.</p>`
          : ""
      }

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>${esc(collector.supplies.title)}</h3>
${para(collector.supplies.body)}
      </div>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>Four things not to give blind</h3>
        <p>Each one makes a decision on the collector's behalf that they would rather make
          themselves. None of them is a bad product. They are bad guesses.</p>
      </div>
      <ul class="wtb-nos" style="margin-top:var(--s5)">
${collector.unsafe.map(unsafeRow).join("\n")}
      </ul>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>What this page cannot tell you</h3>
      </div>
      <ul class="gft-gaps">
${collector.gaps.map((g) => `        <li>${esc(g)}</li>`).join("\n")}
      </ul>
${links(collector.links)}
    </div>
  </section>

  <section class="band tight" id="the-words">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The words</p>
      <h2>What those boxes actually <span class="hl">are</span></h2>
      <p class="lede wtb-lede">Smallest to biggest. Nobody is born knowing any of this and the shop is
        not going to tell you.</p>
      <ul class="wtb-gloss">
${glossary.map(glossRow).join("\n")}
      </ul>
      <div class="wtb-body" style="margin-top:var(--s5)">
        <p>That is the shelf. The full list, all ${
          (msrp.products || []).length
        } kinds of sealed product with the ${
          (msrp.products || []).filter((r) => typeof r.price === "number").length
        } sourced prices between them, is on <a href="/msrp.html">the MSRP check</a>, how many packs
          are inside each one is on <a href="/how-many-packs.html">packs per box</a>, and every one of them
          opened on camera is on <a href="/openings/">sealed products</a>.</p>
      </div>
    </div>
  </section>

  <section class="tight" id="do-not">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Save your money</p>
      <h2>Three things not to buy <span class="hl">first</span></h2>
      <p class="lede wtb-lede">This is the part a shop has no reason to tell you and it is where a
        beginner loses the most money.</p>
      <ul class="wtb-nos">
${avoid.map(avoidRow).join("\n")}
      </ul>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>The pack sum, done for you</h3>
        <p>Price divided by packs, at the suggested figures. This is the arithmetic behind everything
          above, and it is the useful part, because it still works next year when these numbers have
          moved and it works on a box that is not on this page.</p>
      </div>
      <ul class="wtb-pp">
${PER_PACK.map(perPackRow).join("\n")}
      </ul>
      <div class="wtb-body" style="margin-top:var(--s4)">
        <p>${boxVerdict} The Elite Trainer Box comes out dearer a pack than either, and that is fine:
          you are paying for the box, the sleeves, the dice and the counters, which is exactly why it
          makes a better present than a bigger pile of packs.</p>
        <p><a href="/msrp.html">The MSRP check</a> has the same sum as a calculator you can type your
          own shop's price into, and every shop listing this site has written down.</p>
      </div>
    </div>
  </section>

  <section class="band tight" id="reseller">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Read this one</p>
      <h2>${esc(guide.reseller.title)}</h2>
      <p class="wtb-flag"><b>${esc(guide.reseller.lede)}</b></p>
      <div class="wtb-body">
${para(guide.reseller.body)}
      </div>
${links(guide.reseller.links)}
      <div class="wtb-body" style="margin-top:var(--s5)">
        <h3>How we know that</h3>
        <p>Not from a rumour. Each of these chains publishes its own rules for marketplace listings and
          they are different from the rules for the shop's own stock, which is the split being described
          above. These are the pages this site read, and the day it read them.</p>
      </div>
      <ul class="wtb-src">
${MARKET_SOURCES.map(
  (s) => `        <li><b>${esc(hostOf(s.url))}</b> &bull; ${esc(s.what)} &bull; read ${esc(
    longDate(s.read)
  )} &bull; ${esc(s.url)}</li>`
).join("\n")}
      </ul>
      <div class="wtb-body" style="margin-top:var(--s4)">
        <p>No shop is being accused of anything here. A marketplace is a normal way to run a website and
          plenty of the sellers on one are perfectly good. The point is only that the price on the page
          is not always the shop's price, and almost nobody new to this knows to check.</p>
      </div>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>In the shop</p>
      <h2>${esc(guide.counter.title)}</h2>
      <div class="wtb-body">
${para(guide.counter.body)}
      </div>
${links(guide.counter.links)}
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Playing, not opening</p>
      <h2>${esc(guide.playing.title)}</h2>
      <div class="wtb-body">
${para(guide.playing.body)}
      </div>
      <ul class="wtb-deck">
${playing.map(playRow).join("\n")}
      </ul>
${links(guide.playing.links)}
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <h2>Where the numbers <span class="hl">came</span> from</h2>
      <div class="wtb-body">
        <p>Every price on this page is joined straight out of the same file
          <a href="/msrp.html">the MSRP check</a> prints from, so the two pages cannot disagree and the
          build stops if they ever do. Nothing here is typed in by hand.</p>
        <p>MSRP means the manufacturer's suggested retail price. Pokemon Center is The Pokemon Company's
          own shop selling its own product, so what it asks IS the suggestion, and most of the figures
          above are its own store prices read on ${esc(longDate(msrp.readOn))}. The rest are figures two
          or more independent price references print identically, which is careful people reading
          listings and agreeing rather than the manufacturer speaking, and the line under each price
          says which kind it is.</p>
        <p>Suggested is the whole point. No shop has to honour it, which is exactly why it is worth
          knowing before you walk in. Pack counts come from this site's own product research, one
          sourced count per product, which is what <a href="/how-many-packs.html">packs per box</a> is
          built out of.</p>
        <p>The walk-away figure beside every gift for a collector is that product's suggested price
          multiplied by ${esc(multStr(DOUBLE))}, and ${esc(multStr(DOUBLE))} is read out of the same
          price bands <a href="/msrp.html">the MSRP check</a> prints, not typed in here, so the two
          pages cannot end up recommending two different lines. The ${
            LISTINGS.length
          } shop listings counted beside it are every dated, first-party reading this site holds, each
          one taken off that shop's own page with the address and the day written down. They are on
          <a href="/msrp.html">the MSRP check</a> and on
          <a href="/retailers.html">stores that sell cards</a>, and this page counts them rather than
          reprinting them.</p>
        <p>Nothing on this page says what is inside a pack or how likely anything is to be in it. This
          site never states pull rates, because The Pokemon Company does not publish them, and a page
          giving a parent advice is the last place that belongs.</p>
        <p>Still working out where to start? <a href="/start.html">Start here</a> is the same idea for
          somebody holding a card rather than a wallet. <a href="/buying.html">Where to buy</a> is every
          venue and what each one costs a buyer once shipping and fees are counted.</p>
      </div>
    </div>
  </section>

</main>
${footer(
  "Product photos are TCGplayer's, used to identify the products written about here. Every price is a " +
    "dated reading from the source named beside it, and a suggested price is not one any shop has to keep."
)}
${APP_JS}
</body>
</html>
`;

// EVERY JUMP TARGET REALLY EXISTS, CHECKED AGAINST THE MARKUP THAT IS ABOUT TO
// BE WRITTEN. A dead in-page anchor is the quietest broken link there is: the
// browser does nothing at all, no console error, no 404, and check-build.py
// follows hrefs to pages rather than to fragments. The same shape of guard the
// nav in shared/chrome.mjs keeps over BAR_LINKS, and it is here because the
// collector band's two cross references, #one-card and #not-a-mystery-box, are
// exactly the kind of thing a later edit renames in one place.
{
  const anchors = [
    ...JUMP.map(([h]) => h.slice(1)),
    "one-card",
    ...(guide.avoid || []).filter((a) => a.id).map((a) => a.id),
    ...(guide.collector.unsafe || []).filter((u) => u.id).map((u) => u.id),
  ];
  const missing = anchors.filter((id) => !page.includes(` id="${id}"`));
  if (missing.length) {
    throw new Error(
      `build-what-to-buy: these anchors are linked from the page and no element carries them:\n` +
        `  ${missing.join("\n  ")}\n` +
        `  An in-page link to a fragment that is not there does nothing at all, silently, and\n` +
        `  nothing downstream checks fragments. Either the id was renamed or the block that\n` +
        `  carries it stopped being rendered.`
    );
  }
}

await writeFile(join(ROOT, "public/what-to-buy.html"), page);

const shots = new Set(
  [...quick, ...situations.flatMap((s) => s.picks)]
    .map((x) => x.p.label)
    .concat(glossary.map((g) => g.p.label))
    .filter((l) => photoFor(l))
);
console.log(`Wrote public/what-to-buy.html
  ${situations.length} situations, ${situations.reduce((n, s) => n + s.picks.length, 0)} product picks
  ${glossary.length} glossary entries, ${avoid.length} things not to buy, ${playing.length} playable decks
  ${shots.size} product photos, ${
    [...quick, ...situations.flatMap((s) => s.picks), ...glossary, ...avoid]
      .filter((x) => x.p && !photoFor(x.p.label)).length
  } rows on the hatch
  every price joined to data/msrp.json, read ${msrp.readOn}
  ${MARKET_SOURCES.length} marketplace readings joined from data/buying.json
  collector band: ${collector.safe.length} safe picks, ${collector.tests.length} tests, ${
    collector.unsafe.length
  } things not to give blind, ${collector.gaps.length} gaps named
  walk-away line ${multStr(DOUBLE)}x, read off data/over-msrp.json's bands
  ${LISTINGS.length} shop listings joined (${listingsFromCounts.length} from pack-counts-current.json, ${
    listingsFromRetail.length
  } from retailer-prices.json) across ${SHOP_COUNT} shops, ${multStr(CHEAPEST.mult)}x to ${multStr(
    DEAREST.mult
  )}x, ${OVER_LINE} over the line`);
