#!/usr/bin/env node
// Pull the sealed products for every set from TCGplayer, with market prices.
//
//   node scripts/sync-products.mjs            all sets, cached
//   node scripts/sync-products.mjs --force    ignore the cache, refetch prices
//   node scripts/sync-products.mjs pitch-black chaos-rising
//
// Writes public/data/products.json, which build-set-pages.mjs renders as the
// "What you can buy" band on each set guide.
//
// WHY THIS EXISTS
// The set guides could say what is in a set but not what you actually buy to
// open it. "Elite Trainer Box, market price $149.76" is the single most useful
// fact for someone who just watched a rip and wants to do it themselves.
//
// THE SET NAME IS PINNED BY HAND, ON PURPOSE
// This queries by TCGplayer's own setName rather than by fuzzy text, because
// their search is fuzzy in a way that quietly lies. Searching "Scarlet &
// Violet" returns 26 Paldean Fates products and only 15 from the actual base
// set, so anything that picked the most common set would have filled the
// Scarlet & Violet page with the wrong boxes at the wrong prices, and it would
// have looked completely fine. Every id below was confirmed against a probe
// run. A new set needs a line adding here; it is one line and it is worth it.
//
// PRICES GO STALE
// marketPrice is a moving number. Every record carries the date it was read
// and the set pages print it, because a confidently wrong price is worse than
// no price. Re-run this whenever you want them fresh; it is free and unauthed.
//
// Images are hotlinked from TCGplayer's own CDN rather than copied into this
// repo: they are product photography we did not shoot, and pointing at the
// source is both lighter and the honest way to use them. Every product links
// back to its TCGplayer listing.

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TCG_SET } from "../shared/tcgplayer.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcg-products");


/**
 * What counts as a main product, in the order it should appear.
 *
 * `kind` groups the variants so only one of each reaches the page: there are
 * four different Elite Trainer Boxes for some sets and a wall of near
 * identical boxes is worse than one.
 *
 * `not` excludes names a `re` catches by accident. It exists because the kinds
 * overlap in the product NAME rather than in the product: "Pitch Black Pokemon
 * Center Elite Trainer Box" matches the plain Elite Trainer Box pattern, and
 * "151 Ultra-Premium Collection" matches the Collection Box one. Two kinds
 * matching one product is not a cosmetic duplicate, because the blurbs
 * disagree: the standard box is nine packs and the Pokemon Center one is
 * eleven, so whichever kind won would have been printing the other one's count.
 */
const KINDS = [
  { kind: "Booster Box", blurb: "36 packs", re: /\bbooster box\b/i },
  // THE THREE PRODUCTS ABOVE AN ELITE TRAINER BOX, added because
  // /how-many-packs.html had no photograph for any of them and this is the only
  // real product photography the site has. All three are genuinely listed by
  // TCGplayer under sets we already track, so they are a widening of the same
  // pull rather than a new source: the Ultra-Premium Collection on 151 and
  // Celebrations, the Super-Premium Collection on Prismatic Evolutions, and the
  // Pokemon Center Elite Trainer Box on almost every set here.
  //
  // The two Premium Collections carry NO number, because they genuinely have
  // none: sourced counts run 16, 18 and 30 for Ultra-Premium Collections and 10
  // and 15 for Super-Premium ones (data/pack-counts-current.json). A per-kind
  // constant is exactly the wrong shape for that, so they get the same "not in
  // our data" wording the blisters and tins already use and no per-pack figure
  // is derived anywhere.
  //
  // ELEVEN IS SOURCED AND IT IS SOURCED FOR ONE WINDOW, same as the nine below
  // it. pokemon.com states 11 on the Pitch Black and Prismatic Evolutions
  // Pokemon Center Elite Trainer Boxes, and Pokemon Center lists the current-era
  // ones together. It is not a fact about the product line, so it rests on the
  // same GENERIC_FROM gate in build-set-pages.mjs that protects the nine: the
  // Crown Zenith and Pokemon GO "Plus" boxes held more and predate the window
  // anyway, and `not` keeps them out on top of that.
  { kind: "Ultra-Premium Collection", blurb: "Packs plus promos and accessories, count varies by product", re: /\bultra[- ]premium collection\b/i },
  { kind: "Super-Premium Collection", blurb: "Packs plus promos and accessories, count varies by product", re: /\bsuper[- ]premium collection\b/i },
  {
    kind: "Pokemon Center Elite Trainer Box",
    blurb: "11 packs plus 2 promo cards",
    re: /\bpokemon center elite trainer box\b/i,
    not: /\bplus\b/i,
  },
  { kind: "Elite Trainer Box", blurb: "9 packs plus sleeves and dice", re: /\belite trainer box\b/i, not: /\bpokemon center\b/i },
  { kind: "Booster Bundle", blurb: "6 packs", re: /\bbooster bundle\b/i },
  { kind: "Build & Battle Box", blurb: "4 packs plus a 40 card deck", re: /\bbuild (&|and) battle box\b/i },
  // THESE THREE SAY THE COUNT IS UNKNOWN, because it is, and the old wording
  // did not: the blurb prints two lines above the price, so "PACKS PLUS A PROMO
  // CARD" on a card whose neighbours read "6 PACKS" and "9 PACKS PLUS SLEEVES
  // AND DICE" reads as a number that fell out of the sentence rather than as an
  // admission. A blister's pack count varies by set and is not in our data,
  // which is exactly what the guides already say out loud for a half booster
  // box ("Pack count not in our data"), so these borrow that phrasing. The
  // footnote under the band names blisters, tins and collection boxes as the
  // products with no price per pack; now the cards agree with it.
  { kind: "Blister Pack", blurb: "Packs plus a promo card, count not in our data", re: /\bblister\b/i },
  { kind: "Single Pack", blurb: "One pack", re: /\bbooster pack\b/i },
  { kind: "Tin", blurb: "Packs plus a promo, count not in our data", re: /\btin\b/i },
  { kind: "Collection Box", blurb: "Packs plus promos, count not in our data", re: /\b(collection|premium collection)\b/i, not: /\b(ultra|super)[- ]premium collection\b/i },
];

/**
 * Things that are technically for sale but are not what a person buys.
 *
 * Cases are pallets of boxes at four figures, and a "Display" is the shipping
 * carton of blisters. Including them makes the cheapest way to try a set look
 * like it costs $2,400.
 */
const SKIP = /\b(case|display|set of \d+|carton|bundle case|pack art bundle)\b/i;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

/**
 * Ask for one set's sealed products.
 *
 * TCGplayer SILENTLY DROPS an unknown setName filter and answers with every
 * set instead of none. Asking for "ME06: Delta Reign", which is announced but
 * not yet listed, returned 2,895 products led by Pitch Black and Ascended
 * Heroes. Nothing errors and the shape of the response is identical, so a
 * count check does not catch it: the only tell is that the rows belong to
 * other sets. Every result is therefore checked against the set that was
 * actually asked for.
 */
async function fetchSet(setName) {
  const url =
    "https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false&mpfev=1";
  const body = {
    algorithm: "sales_dismax",
    from: 0,
    size: 50,
    filters: {
      term: {
        productLineName: ["pokemon"],
        productTypeName: ["Sealed Products"],
        setName: [setName],
      },
      range: {},
      match: {},
    },
    listingSearch: {
      context: { cart: {} },
      filters: {
        term: {},
        range: { quantity: { gte: 1 } },
        exclude: { channelExclusion: 0 },
      },
    },
    context: { cart: {}, shippingCountry: "US" },
    settings: { useFuzzySearch: false, didYouMean: {} },
    sort: {},
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
      if (res.ok) {
        const rows = (await res.json()).results?.[0]?.results || [];
        // See the note above fetchSet: an unknown setName is ignored rather
        // than rejected, so the rows have to be checked, not just counted.
        return rows.filter((r) => r.setName === setName);
      }
      if (res.status === 404) return [];
      // 429 and 5xx: back off rather than hammer a service being generous.
      await sleep(attempt * 2500);
    } catch {
      await sleep(attempt * 2500);
    }
  }
  throw new Error(`TCGplayer would not answer for "${setName}"`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Slug a product name into TCGplayer's own URL shape. */
const urlName = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/**
 * Pick one product per kind.
 *
 * Where a kind has several variants the cheapest market price wins, because
 * that is the one a viewer is most likely to actually buy. A Pokemon Center
 * exclusive ETB at twice the price is not the ETB people mean.
 */
function pickMain(raw) {
  const out = [];
  for (const { kind, blurb, re, not } of KINDS) {
    const hits = raw
      .filter(
        (p) =>
          p.productName &&
          !SKIP.test(p.productName) &&
          re.test(p.productName) &&
          !(not && not.test(p.productName))
      )
      .filter((p) => Number(p.marketPrice) > 0)
      .sort((a, b) => Number(a.marketPrice) - Number(b.marketPrice));
    if (!hits.length) continue;
    const p = hits[0];
    const id = Math.round(Number(p.productId));
    out.push({
      kind,
      blurb,
      name: p.productName,
      productId: id,
      market: Math.round(Number(p.marketPrice) * 100) / 100,
      low: Number(p.lowestPrice) > 0 ? Math.round(Number(p.lowestPrice) * 100) / 100 : null,
      listings: Number(p.totalListings) || null,
      image: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`,
      thumb: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_200w.jpg`,
      url: `https://www.tcgplayer.com/product/${id}/${urlName(p.productName)}`,
    });
  }
  // ONE PRODUCT, ONE KIND. See the `not` note above KINDS: the patterns overlap
  // in the name, and a product reaching two kinds would be rendered twice with
  // two different pack claims underneath it. Cheap to check and impossible to
  // spot by eye on 28 set pages.
  const seen = new Set();
  for (const p of out) {
    if (seen.has(p.productId)) {
      throw new Error(
        `"${p.name}" was picked for more than one kind. Add a \`not\` to the narrower one in KINDS.`
      );
    }
    seen.add(p.productId);
  }
  return out;
}

// ---------------------------------------------------------------------------

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const outPath = join(ROOT, "public/data/products.json");

let doc = { checked: null, sets: {} };
if (existsSync(outPath)) {
  try {
    doc = JSON.parse(await readFile(outPath, "utf8"));
  } catch {}
}
doc.sets ||= {};

await mkdir(CACHE, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const targets = sets.filter((s) => (only.length ? only.includes(s.id) : true));

let fetched = 0;
const missing = [];
const report = [];

for (const s of targets) {
  const setName = TCG_SET[s.id];
  if (!setName) {
    missing.push(s.id);
    continue;
  }

  const cacheFile = join(CACHE, `${s.id}.json`);
  let raw, readOn;
  if (!FORCE && existsSync(cacheFile)) {
    const c = JSON.parse(await readFile(cacheFile, "utf8"));
    // Older cache files are a bare array with no date. Fall back to the file's
    // own mtime rather than pretending it was read today.
    if (Array.isArray(c)) {
      raw = c;
      readOn = (await stat(cacheFile)).mtime.toISOString().slice(0, 10);
    } else {
      raw = c.results;
      readOn = c.fetched;
    }
  } else {
    raw = await fetchSet(setName);
    readOn = today;
    await writeFile(cacheFile, JSON.stringify({ fetched: today, results: raw }));
    fetched++;
    await sleep(800);
  }

  const products = pickMain(raw);
  if (!products.length) {
    report.push(`  ${s.id.padEnd(22)} nothing sealed on sale`);
    delete doc.sets[s.id];
    continue;
  }

  // The date the PRICES were read, not the date this script ran. Stamping
  // `today` unconditionally meant a cached run re-dated day-old prices as
  // fresh, so the set pages said "read on August 12" about numbers fetched on
  // the 11th. A price presented as more current than it is undermines the one
  // reason the date is printed at all.
  doc.sets[s.id] = { tcgSet: setName, checked: readOn, products };
  const cheapest = products.reduce((a, b) => (a.market < b.market ? a : b));
  report.push(
    `  ${s.id.padEnd(22)} ${String(products.length).padStart(2)} products` +
      `  from $${cheapest.market.toFixed(2)} (${cheapest.kind})`
  );
}

// The newest per-set read, so the top-level date cannot claim to be fresher
// than any of the data underneath it.
doc.checked = Object.values(doc.sets).map((x) => x.checked).sort().pop() || today;
doc.source = "TCGplayer";
await writeFile(outPath, JSON.stringify(doc, null, 2) + "\n");

console.log(`Wrote public/data/products.json`);
console.log(report.join("\n"));
console.log(
  `\n${Object.keys(doc.sets).length} sets have products, ${fetched} fetched fresh` +
    (FORCE ? "" : ", rest from .cache/tcg-products (use --force for live prices)")
);
if (missing.length) {
  console.log(
    `\nNo TCGplayer set name pinned for: ${missing.join(", ")}\n` +
      `  Add each to TCG_SET at the top of this file. Do not guess the name:\n` +
      `  run the set through their search first and read the setName back.`
  );
}
