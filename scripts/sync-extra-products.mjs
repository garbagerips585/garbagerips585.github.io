#!/usr/bin/env node
// Pin the sealed products that sync-products.mjs cannot reach, for their photos.
//
//   node scripts/sync-extra-products.mjs            verify the pins, cached
//   node scripts/sync-extra-products.mjs --force    re-ask TCGplayer for all
//
// Writes data/extra-products.json, read by build-how-many-packs.mjs and
// build-openings.mjs.
//
// WHY THIS EXISTS. sync-products.mjs asks TCGplayer for one SET at a time, by
// set name, and takes the cheapest product of each kind. That is right for the
// set guides and it is why eleven rows on /how-many-packs.html and six of the
// thirteen /openings/ pages had no photograph:
//
//   FOUR PRODUCTS BELONG TO NO EXPANSION AT ALL. Stacking Tin, Knock Out
//   Collection, Holiday Calendar and Trick or Trade are general release, so
//   TCGplayer files them under "Miscellaneous Cards & Products" and a
//   set-by-set pull can never see them.
//
//   SEVEN MORE ARE LISTED UNDER SETS WE TRACK BUT AS THE WRONG PRODUCT. The
//   count on those rows was read off a specific box on pokemon.com, and the
//   cheapest-of-kind that the set pull happens to return is a different box
//   whose own count nobody sourced. build-how-many-packs.mjs's header spells
//   out all seven and says the honest answer is no photo. It still is, if you
//   fill them that way.
//
// SO THIS PINS THE EXACT PRODUCT THE COUNT WAS READ OFF. Every entry below
// names the pokemon.com product that data/pack-counts-current.json sources, and
// carries the TCGplayer id of that same product. The photo then IS the box the
// row is about, and the caption naming it is true of the file. That is the only
// way to fill these rows without loosening the rule.
//
// THE ID IS PINNED AND THE NAME IS ASSERTED, both, and neither is enough alone.
// TCGplayer's fuzzy search lies (see sync-products.mjs: "Scarlet & Violet"
// returns more Paldean Fates products than Scarlet & Violet ones), so the id is
// hand-picked from a probe run. And an id could be re-pointed, so the name that
// comes back is checked against the name expected here. A mismatch drops the
// entry rather than shipping a caption that names a box nobody photographed.
//
// IMAGES ARE HOTLINKED, not copied, exactly as sync-products.mjs does it and
// for the same reason: this is product photography we did not shoot, pointing
// at the source is the honest way to use it, and the 200w file is 10KB into an
// 88px box.
//
// WHAT IS STILL MISSING, AND IT IS THREE THINGS:
//
//   STACKING TIN. pokemon.com sources the 7 March 2025 run at 3 packs.
//   TCGplayer lists eleven Stacking Tins across four years and does not publish
//   a release date, so which listing is that run is a guess. A guess here is a
//   photo of an unknown number, which is the exact failure the rule exists to
//   stop. It keeps its hatched box.
//
//   KOREAN AND CHINESE BOOSTER PACKS. TCGplayer has no Korean or Chinese
//   Pokemon product at all, under any product line: searches for both return
//   one Magic gift box. TCGdex has no card images for Korean sets either (its
//   Korean set records borrow the Japanese scans, which is recorded in
//   public/data/intl-guides.json as `borrowed`) and none at all for Simplified
//   Chinese. So there is no photograph of either object that this repo can
//   reach, and those two /openings/ pages stay prose.

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcg-extra");
const OUT = join(ROOT, "data", "extra-products.json");
const FORCE = process.argv.includes("--force");

/**
 * The pins.
 *
 * `id`      TCGplayer product id, hand-picked from a probe run.
 * `expect`  the product name TCGplayer must return for that id.
 * `sourced` the pokemon.com product data/pack-counts-current.json reads the
 *           count off. Where the two names are the same product, the photo is
 *           the box the number is about. Where they differ this field says so.
 * `rows`    which /how-many-packs.html row (by productName) this fills.
 * `kind`    which /openings/ page (by taxonomy id) this fills.
 */
const PINS = [
  {
    key: "ex-premium",
    id: 690660,
    expect: "Mega Greninja ex Premium Collection",
    sourced: "Mega Greninja ex Premium Collection",
    row: "ex Premium Collection",
    kind: "ex-premium",
  },
  {
    key: "ex-box",
    id: 654188,
    expect: "Mega Latias ex Box",
    sourced: "Mega Latias ex Box",
    row: "ex Box (shares the ex-premium tag, but is half the size)",
  },
  {
    key: "ex-special",
    id: 616305,
    expect: "Charizard ex Special Collection",
    sourced: "Charizard ex Special Collection",
    row: "ex Special Collection",
  },
  {
    key: "collector-tin",
    id: 671250,
    expect: "Mega Charizard Tin (Mega Charizard X)",
    // pokemon.com lists the tin without the variant in the name; TCGplayer
    // splits the X and Y artwork into two listings of the same product. Same
    // box, same four packs, and the caption prints TCGplayer's full name so it
    // is true of the file.
    sourced: "Mega Charizard Tin",
    row: "Standard collector tin",
  },
  {
    key: "poke-ball-tin",
    id: 688964,
    expect: "Pokemon - Poke Ball Tin - Poke Ball (Q4 2025)",
    // pokemon.com's Poke Ball Tin launched 5 December 2025, which is TCGplayer's
    // Q4 2025 run. The Q4 2024 listing is a different year and is NOT this one.
    sourced: "Pokemon TCG: Poke Ball Tin, December 2025",
    row: "Poke Ball Tin",
    kind: "poke-ball-tin",
  },
  {
    key: "knock-out",
    id: 628494,
    expect: "Knock Out Collection [Chien-Pao]",
    // pokemon.com's January 2025 Knock Out Collection is one foil card featuring
    // Chien-Pao OR Alakazam, so the Chien-Pao listing is one of the two halves
    // of the product the count was read off.
    sourced: "Pokemon TCG: Knock Out Collection, January 2025",
    row: "Knock Out Collection",
    kind: "knock-out",
  },
  {
    key: "holiday-calendar",
    id: 639828,
    expect: "Holiday Calendar 2025",
    sourced: "Pokemon TCG: Holiday Calendar 2025",
    row: "Holiday Calendar",
  },
  {
    key: "trick-or-trade",
    id: 558713,
    expect: "Trick or Trade BOOster Bundle 2024 (35 mini packs)",
    sourced: "Trick or Trade BOOster Bundle (2024)",
    row: "Trick or Trade BOOster Bundle",
  },
  {
    key: "battle-deck",
    id: 704187,
    expect: "30th Celebration Battle Deck [Espeon ex]",
    sourced: "30th Celebration Battle Deck, Espeon ex and Umbreon ex",
    row: "Battle Deck",
  },
  {
    key: "collection-box",
    id: 593466,
    expect: "Prismatic Evolutions Surprise Box",
    sourced: "Scarlet & Violet-Prismatic Evolutions Surprise Box",
    row: "Collection boxes (a family, not one product)",
  },
  {
    key: "japanese-pack",
    id: 709111,
    expect: "Storm Emeralda Booster Pack",
    // No count is claimed for this one anywhere. It exists so the page asking
    // "what is in a Japanese booster pack" can show one. TCGplayer files
    // Japanese product under its own product line, which is why the set-by-set
    // English pull never saw it.
    sourced: null,
    kind: "japanese-pack",
    line: "pokemon-japan",
  },
];

const HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask for one product by name and pull the row whose productId matches the pin.
 *
 * The search endpoint has no by-id lookup, so this queries the expected name and
 * then finds the pinned id in the results. Both halves have to agree: the name
 * has to return the id, and the id has to carry the name.
 */
async function lookup(pin) {
  const url =
    "https://mp-search-api.tcgplayer.com/v1/search/request?q=" +
    encodeURIComponent(pin.expect) +
    "&isList=false&mpfev=1";
  const term = { productTypeName: ["Sealed Products"] };
  if (pin.line) term.productLineName = [pin.line];
  const body = {
    algorithm: "sales_dismax",
    from: 0,
    size: 24,
    filters: { term, range: {}, match: {} },
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
      const res = await fetch(url, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
      if (res.ok) {
        const rows = (await res.json()).results?.[0]?.results || [];
        return rows.find((r) => r.productId === pin.id) || null;
      }
    } catch {
      /* retry */
    }
    await sleep(attempt * 2000);
  }
  return null;
}

const shot = (id, big) =>
  `https://tcgplayer-cdn.tcgplayer.com/product/${id}${big ? "_in_1000x1000" : "_200w"}.jpg`;

/** Slug a product name into TCGplayer's own URL shape, same as sync-products.mjs. */
const urlName = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

await mkdir(CACHE, { recursive: true });

const held = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : null;
const fresh =
  !FORCE &&
  held &&
  held.checked &&
  Date.now() - Date.parse(held.checked) < 1000 * 60 * 60 * 24 * 7 &&
  PINS.every((p) => held.products?.[p.key]);

if (fresh) {
  console.log(
    `data/extra-products.json is ${Object.keys(held.products).length} products checked ` +
      `${held.checked}, inside the week. Pass --force to re-ask.`
  );
  process.exit(0);
}

const products = {};
const missing = [];
const deadShots = [];

for (const pin of PINS) {
  const row = await lookup(pin);
  if (!row) {
    missing.push(`${pin.key}: TCGplayer returned no product ${pin.id} for "${pin.expect}"`);
    continue;
  }
  if (row.productName !== pin.expect) {
    missing.push(
      `${pin.key}: product ${pin.id} is now "${row.productName}", not "${pin.expect}". ` +
        "Re-probe and re-pin rather than relaxing the check."
    );
    continue;
  }
  // The photo has to exist, checked rather than assumed: data/no-scan.json
  // records four TCGplayer urls that answer 403, found by fetching every image
  // url the site emits, and an onerror never fires for a lazy image below the
  // fold.
  const thumb = shot(row.productId, false);
  const head = await fetch(thumb, { method: "HEAD" }).catch(() => null);
  if (!head || !head.ok) {
    deadShots.push(`${pin.key}: ${thumb} answered ${head ? head.status : "nothing"}`);
    continue;
  }
  products[pin.key] = {
    kind: pin.kind || null,
    row: pin.row || null,
    productId: row.productId,
    name: row.productName,
    setName: row.setName,
    productLine: row.productLineName,
    sourcedAs: pin.sourced,
    market: typeof row.marketPrice === "number" ? Math.round(row.marketPrice * 100) / 100 : null,
    thumb,
    image: shot(row.productId, true),
    url: `https://www.tcgplayer.com/product/${row.productId}/${urlName(row.productName)}`,
  };
  await sleep(350);
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      _readme: [
        "Sealed products pinned by hand for their PHOTOGRAPHS, written by",
        "scripts/sync-extra-products.mjs. The argument for every pin is in that file.",
        "",
        "These are the products sync-products.mjs cannot reach: four that belong to no",
        "expansion, six whose per-set listing is a different box from the one the pack",
        "count was sourced off, and one Japanese pack, which TCGplayer files under its",
        "own product line.",
        "",
        "`name` is TCGplayer's own name for the product in the photo and it is what the",
        "caption prints. `sourcedAs` is the pokemon.com product that",
        "data/pack-counts-current.json reads the count off; where the two differ, the",
        "note in the sync script says why they are the same box.",
        "",
        "Images are hotlinked from TCGplayer's CDN, not copied here, the same as",
        "public/data/products.json.",
      ],
      checked: new Date().toISOString().slice(0, 10),
      source: "TCGplayer",
      products,
    },
    null,
    2
  ) + "\n"
);

console.log(
  `Wrote data/extra-products.json
  ${Object.keys(products).length} of ${PINS.length} pinned products verified`
);
for (const m of missing) console.log(`  MISSING  ${m}`);
for (const m of deadShots) console.log(`  NO PHOTO ${m}`);
