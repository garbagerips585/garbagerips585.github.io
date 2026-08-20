#!/usr/bin/env node
// Pull preorder prices and product images for the upcoming sets.
//
//   node scripts/sync-preorders.mjs           cached
//   node scripts/sync-preorders.mjs --force   refetch
//
// Writes public/data/preorders.json, which build-upcoming.mjs renders on the
// "Coming next" page.
//
// WHY THE MSRP COMPARISON MATTERS MORE THAN THE PRICE
// Preorder prices on an unreleased set are speculation, and the gap is not
// small: the 30th Celebration Elite Trainer Box has a $49.99 MSRP and preorders
// near $190. Showing the preorder price alone would read as "this is what it
// costs". Showing it against MSRP shows what is actually happening, which is
// that people are paying nearly four times retail months ahead of a set that
// will be on a shelf in September.
//
// So every product that has an announced MSRP in data/upcoming.json is rendered
// with both, and the multiple is computed rather than left for the reader.
// Someone deciding whether to preorder is the person this page is for.
//
// CARDS HAVE NO PRICES YET, deliberately shown anyway. An unreleased set's
// singles are listed on TCGplayer with names, numbers, rarities and artwork but
// no market price, because none have been sold. That is still worth showing:
// it is the first look at what is in the set. The page says the prices do not
// exist rather than rendering a blank column.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcg-preorders");

const FORCE = process.argv.includes("--force");

/** Upcoming set name on our page -> TCGplayer's setName. Confirmed by probe. */
const TCG_UPCOMING = {
  "30th Celebration": "ME: 30th Celebration",
  // Delta Reign returns 0 results on TCGplayer today: it is announced but not
  // yet listed. It will appear here when it is; until then the page shows the
  // announcement without prices rather than inventing any.
  "Mega Evolution: Delta Reign": "ME06: Delta Reign",
};

const HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


// TCGplayer SILENTLY DROPS an unknown setName filter and answers with every
// set instead of none. Asking for "ME06: Delta Reign", which is announced but
// not yet listed, returned 2,895 products led by Pitch Black and Ascended
// Heroes. Nothing errors and the shape of the response is identical, so a
// count check does not catch it: the only tell is that the rows belong to
// other sets. Every result is therefore checked against the set that was
// actually asked for.
async function search(setName, productType, size = 50) {
  const body = {
    algorithm: "sales_dismax",
    from: 0,
    size,
    filters: {
      term: { productLineName: ["pokemon"], setName: [setName], productTypeName: [productType] },
      range: {},
      match: {},
    },
    listingSearch: {
      context: { cart: {} },
      filters: { term: {}, range: { quantity: { gte: 1 } }, exclude: { channelExclusion: 0 } },
    },
    context: { cart: {}, shippingCountry: "US" },
    settings: { useFuzzySearch: false, didYouMean: {} },
    sort: {},
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch("https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const rows = (await res.json()).results?.[0]?.results || [];
        return rows.filter((r) => r.setName === setName);
      }
      if (res.status === 404) return [];
    } catch {
      /* retry */
    }
    await sleep(attempt * 2000);
  }
  return [];
}

const slug = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const shot = (id, big) =>
  `https://tcgplayer-cdn.tcgplayer.com/product/${id}${big ? "_in_1000x1000" : "_200w"}.jpg`;

const money = (v) => (Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : null);

/** Cards worth showing first: the new and the rare, not 128 commons. */
const CHASE_RARITIES = new Set([
  "Special Illustration Rare",
  "Illustration Rare",
  "Ultra Rare",
  "Hyper Rare",
  "Mega Hyper Rare",
  "Double Rare",
  "Futuristic Rare",
]);

const upcoming = JSON.parse(await readFile(join(ROOT, "data/upcoming.json"), "utf8"));

// MSRP from the announcement, keyed by a STEM rather than the whole name.
//
// The two sides name things differently in a specific way: the announcement
// bundles variants that TCGplayer lists separately. "Ultra Premium Collection,
// Day and Night" is one line in the press release and two products in a shop;
// so is "Figure Collection, Mew and Mewtwo". Matching whole names found 1 of 9.
// Matching on the part before the comma, as a prefix, finds them all, and still
// refuses to match a genuinely different product: "Pokemon Center Elite Trainer
// Box" does not begin with "elite-trainer-box", and it is a different box at a
// different price, so leaving it blank is right.
const msrpStems = [];
for (const s of upcoming.sets || []) {
  for (const p of s.products || []) {
    if (!p.price) continue;
    const stem = slug(String(p.name).split(",")[0]);
    if (stem) msrpStems.push({ set: s.name, stem, msrp: money(p.price.replace(/[^0-9.]/g, "")) });
  }
}
// Longest stem first, so "ex Tin" cannot claim a match that "ex Box" should own.
msrpStems.sort((a, b) => b.stem.length - a.stem.length);
const msrpFind = (setName, productSlug) =>
  msrpStems.find((m) => m.set === setName && productSlug.startsWith(m.stem))?.msrp ?? null;

await mkdir(CACHE, { recursive: true });
const today = localDay();

let doc = { checked: null, source: "TCGplayer preorder listings", sets: {} };
if (existsSync(join(ROOT, "public/data/preorders.json"))) {
  try {
    doc = JSON.parse(await readFile(join(ROOT, "public/data/preorders.json"), "utf8"));
    doc.sets ||= {};
  } catch {}
}

for (const [name, tcgName] of Object.entries(TCG_UPCOMING)) {
  const cacheFile = join(CACHE, `${slug(name)}.json`);
  let sealed, cards, readOn;

  if (!FORCE && existsSync(cacheFile)) {
    const c = JSON.parse(await readFile(cacheFile, "utf8"));
    ({ sealed, cards } = c);
    readOn = c.fetched;
  } else {
    sealed = await search(tcgName, "Sealed Products");
    await sleep(700);
    cards = await search(tcgName, "Cards");
    readOn = today;
    await writeFile(cacheFile, JSON.stringify({ fetched: today, sealed, cards }));
    await sleep(700);
  }

  if (!sealed.length && !cards.length) {
    console.log(`  ${name.padEnd(30)} not listed on TCGplayer yet`);
    delete doc.sets[name];
    continue;
  }

  const products = sealed
    .filter((p) => p.productName && !/\bcase\b/i.test(p.productName))
    .map((p) => {
      const id = Math.round(Number(p.productId));
      const short = p.productName.replace(/^30th Celebration\s*/i, "").trim();
      // A "[Set of 2]" listing is a bundle priced against a SINGLE unit's MSRP,
      // which inflated the multiple wildly: the ex Tin set of two read as 13.6x
      // retail when it is really about 6.8x. Multiply the MSRP by the pack
      // count so the comparison is like for like. Getting this wrong would put
      // a confidently false number on the page, which is worse than no number.
      const packOf = Number((/\bset of (\d+)\b/i.exec(p.productName) || [])[1] || 1);
      const unitMsrp = msrpFind(name, slug(short.replace(/\s*\[set of \d+\]\s*/i, " ").trim()));
      const msrp = unitMsrp ? Math.round(unitMsrp * packOf * 100) / 100 : null;
      const price = money(p.marketPrice) ?? money(p.lowestPrice);
      return {
        name: short || p.productName,
        productId: id,
        price,
        low: money(p.lowestPrice),
        listings: Number(p.totalListings) || null,
        msrp,
        // The number this page exists to show. Rounded to one decimal because
        // "3.8x MSRP" is the point, not 3.8351.
        overMsrp: msrp && price ? Math.round((price / msrp) * 10) / 10 : null,
        thumb: shot(id, false),
        image: shot(id, true),
        url: `https://www.tcgplayer.com/product/${id}/${slug(p.productName)}`,
      };
    })
    .filter((p) => p.price)
    .sort((a, b) => b.price - a.price);

  const chase = cards
    .filter((c) => CHASE_RARITIES.has(c.customAttributes?.rarityDbName))
    .map((c) => {
      const id = Math.round(Number(c.productId));
      return {
        name: c.productName.replace(/\s*-\s*\d+\/\d+$/, "").trim(),
        number: c.customAttributes?.number || null,
        rarity: c.customAttributes?.rarityDbName || null,
        price: money(c.marketPrice),
        thumb: shot(id, false),
        image: shot(id, true),
        url: `https://www.tcgplayer.com/product/${id}/${slug(c.productName)}`,
      };
    })
    .sort((a, b) => (b.price || 0) - (a.price || 0) || String(a.number).localeCompare(String(b.number)))
    .slice(0, 12);

  // The set total, read off the secret-rare numbering rather than taken from a
  // tracker. A card printed 138/128 states the set size on its face.
  const totals = cards
    .map((c) => Number(String(c.customAttributes?.number || "").split("/")[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  const setTotal = totals.length ? totals.sort((a, b) => a - b)[Math.floor(totals.length / 2)] : null;

  doc.sets[name] = { tcgSet: tcgName, checked: readOn, setTotal, products, chase };
  const dearest = products[0];
  console.log(
    `  ${name.padEnd(30)} ${String(products.length).padStart(2)} products, ${String(chase.length).padStart(2)} chase cards` +
      (setTotal ? `, ${setTotal} card set` : "") +
      (dearest ? `\n${" ".repeat(34)}most expensive: ${dearest.name} $${dearest.price}${dearest.overMsrp ? ` (${dearest.overMsrp}x MSRP)` : ""}` : "")
  );
}

doc.checked = Object.values(doc.sets).map((s) => s.checked).sort().pop() || today;
await writeFile(join(ROOT, "public/data/preorders.json"), JSON.stringify(doc, null, 2) + "\n");

console.log(`\nWrote public/data/preorders.json  (${Object.keys(doc.sets).length} set(s))`);
console.log("Next: node scripts/build-upcoming.mjs");
