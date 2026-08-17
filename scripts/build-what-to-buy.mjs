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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const guide = JSON.parse(await readFile(join(ROOT, "data/what-to-buy.json"), "utf8"));
const msrp = JSON.parse(await readFile(join(ROOT, "data/msrp.json"), "utf8"));
const counts = JSON.parse(await readFile(join(ROOT, "data/pack-counts-current.json"), "utf8"));
const buying = JSON.parse(await readFile(join(ROOT, "data/buying.json"), "utf8"));
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
// THE SAME PHOTOGRAPHS /openings/, /how-many-packs.html AND /msrp.html USE,
// pinned to the same sets on purpose, so a reader moving between the four pages
// sees the same box rather than four boxes of the same type.
//
// THIS MAP IS A SECOND COPY OF THE ONE IN build-msrp.mjs AND THAT IS A KNOWN
// COST. The canonical pins, and the argument for each one, live in that file's
// PHOTOS block; this holds only the subset this page pictures. It is duplication
// and the honest fix is a shared module, which is a change to build-msrp.mjs and
// is out of scope here. What stops the duplication turning into a wrong caption
// is photoFor()'s NAME CHECK below, which is copied along with the pins: it
// verifies that the product sitting at that set and kind today is still the one
// the caption is about, and drops the photograph rather than mislabelling it.
//
// TCGplayer's shots are the only product photography this repo can reach and
// they are per SET rather than per TYPE, so the picture on a card is one
// specific set's product standing in for a whole type. Every card therefore
// NAMES the product in the picture in visible text as well as in the alt.
// Anything looser is a photograph quietly claiming to be a category.
//
// pokemoncenter.com's images are off limits, as is the site itself: see the
// header of build-msrp.mjs.
//
// [set id, products.json kind, the name expected there]  or  ["extra", key]
const PHOTOS = {
  "Elite Trainer Box": ["pitch-black", "Elite Trainer Box", "Pitch Black Elite Trainer Box"],
  "Pokemon Center Elite Trainer Box": [
    "pitch-black", "Pokemon Center Elite Trainer Box", "Pitch Black Pokemon Center Elite Trainer Box",
  ],
  "Booster Bundle": ["pitch-black", "Booster Bundle", "Pitch Black Booster Bundle"],
  // Only two sets in products.json name a pack as sleeved and Stellar Crown is
  // one, so the sleeved row gets a picture that is actually of a sleeve. The
  // difference is load bearing here rather than pedantic: the one shop listing
  // this page prints for a single pack is a SLEEVED pack.
  "Sleeved booster pack": ["stellar-crown", "Single Pack", "Stellar Crown Sleeved Booster Pack"],
  "Loose booster pack": ["pitch-black", "Single Pack", "Pitch Black Booster Pack"],
  "Booster box": ["pitch-black", "Booster Box", "Pitch Black Booster Box"],
  // The only 3-pack blister in products.json. Every other set's Blister Pack row
  // is a 1-pack or a 2-pack, so this cannot follow the others onto Pitch Black
  // without the caption naming a product that is not in the picture.
  "Three-pack blister": ["shrouded-fable", "Blister Pack", "Shrouded Fable 3 Pack Blister"],
  "Mini tin": ["prismatic-evolutions", "Tin", "Prismatic Evolutions Mini Tin"],
  "Build and Battle Box": ["pitch-black", "Build & Battle Box", "Pitch Black Build & Battle Box"],
  "Poke Ball Tin": ["extra", "poke-ball-tin"],
  // NO PIN, AND IT IS THE RIGHT ANSWER RATHER THAN A GAP: Battle Academy,
  // My First Battle, League Battle Deck and V Battle Deck. products.json is
  // pulled per EXPANSION by sync-products.mjs and none of those four belongs to
  // an expansion at all, so it has never seen them. extra-products.json holds
  // one battle deck and it is the 30th Celebration one, which is a different box
  // from both decks priced here, so using it would put a photograph of one
  // product under the price of another. They take the site's hatch instead. The
  // proper fix is to add them to sync-extra-products.mjs with an argument for
  // each pin, which is the same route the five extras above took.
};

/**
 * The photo for a product, or null.
 *
 * Matched on set AND kind, then CHECKED AGAINST THE NAME expected there.
 * sync-products.mjs picks the cheapest variant per kind, so the product behind
 * "prismatic-evolutions / Tin" can change under us; if it does, the caption
 * would name a product that is not in the picture. Drop the photo instead.
 */
function photoFor(label) {
  const spec = PHOTOS[label];
  if (!spec) return null;
  if (spec[0] === "extra") {
    const e = EXTRA[spec[1]];
    if (!e || !e.thumb || DEAD.has(e.thumb)) return null;
    return { src: e.thumb, large: e.image, name: e.name };
  }
  const [sid, kind, expect] = spec;
  const hit = (prod.sets?.[sid]?.products || []).find((p) => p.kind === kind);
  if (!hit || !hit.thumb || DEAD.has(hit.thumb)) return null;
  if (!String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) return null;
  return { src: hit.thumb, large: hit.image, name: hit.name };
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

const avoidRow = (a) => `      <li class="wtb-no">
        <h3>${esc(a.title)}</h3>
${para(a.body)}
${a.p ? listingBox(a.p) : ""}
${links(a.links)}
      </li>`;

const playRow = (p) => `        <li><b>${esc(p.label)}</b> <span>${esc(
  moneyExact(p.price)
)}</span><br>${esc(p.what)}</li>`;

// =================================================================== the page

const TITLE =
  "What Pokemon cards should I buy? A guide for parents and beginners | Garbage Rips 585";
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
   THE READING MEASURE, AND ui.css's OWN CAP IS TOO WIDE FOR THIS PAGE.

   ui.css sets --measure:36em on every paragraph in main. At the site's 17px
   body and Outfit's ~2.31 characters per em, 36em is about 83 characters a
   line, which is fine on a reference page somebody scans and long for a page of
   running advice that a nervous reader is trying to follow sentence by
   sentence. 31em lands at about 72, inside the usual 45 to 75 band.

   Only the prose is capped. The rows above are layout, not prose, and capping
   those would leave a price stranded in the middle of a wide card at 1440.
   ========================================================================== */
.wtb-body p,.wtb-why,.wtb-plain,.wtb-sub,.wtb-no p{max-width:31em}

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
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pick your situation</p>
      <h2>Who is it <span class="hl">for</span>?</h2>
      <p class="lede wtb-lede">Find the one that sounds like you. Every price below is what the
        manufacturer suggests, not what a shop has to charge.</p>
      <ol class="wtb-sits">
${situations.map(situationCard).join("\n")}
      </ol>

      <div class="wtb-body" style="margin-top:var(--s6)">
        <h3>${esc(guide.oneCard.title)}</h3>
${para(guide.oneCard.body)}
      </div>
${links(guide.oneCard.links)}
    </div>
  </section>

  <section class="tight">
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

  <section class="band tight" id="do-not">
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

  <section class="tight" id="reseller">
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

  <section class="band tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>In the shop</p>
      <h2>${esc(guide.counter.title)}</h2>
      <div class="wtb-body">
${para(guide.counter.body)}
      </div>
${links(guide.counter.links)}
    </div>
  </section>

  <section class="tight">
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

  <section class="band tight">
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
  ${MARKET_SOURCES.length} marketplace readings joined from data/buying.json`);
