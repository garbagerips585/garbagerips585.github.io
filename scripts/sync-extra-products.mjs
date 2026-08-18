#!/usr/bin/env node
// Pin the sealed products that sync-products.mjs cannot reach, for their photos.
//
//   node scripts/sync-extra-products.mjs            verify the pins, cached
//   node scripts/sync-extra-products.mjs --force    re-ask TCGplayer for all
//
// Writes data/extra-products.json, read by build-how-many-packs.mjs,
// build-openings.mjs and, through shared/product-photos.mjs, by build-msrp.mjs
// and build-what-to-buy.mjs.
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
// FOUR PINS ADDED 17 AUGUST 2026 ANSWER TO A PRICE RATHER THAN TO A COUNT, and
// `sourced` names a different file for them. Battle Academy, My First Battle,
// the League Battle Deck and the V Battle Deck have no pack count anywhere:
// nothing in them is a booster pack, which is the entire point of the first two.
// What they have is a sourced PRICE, read off Pokemon Center and held in
// data/pokemon-center-prices.json, and a row on /msrp.html and /what-to-buy.html
// that was standing there with a hatch where the picture goes.
//
// THEY MATTER MORE THAN THE REST AND THAT IS WHY THEY WERE CHASED. Battle
// Academy and My First Battle are the two things /what-to-buy.html recommends to
// a parent buying a first present, and they were being recommended with no
// picture of what to look for on a shelf, which is the one thing that page exists
// to give somebody standing in an aisle.
//
// THE RULE IS UNCHANGED FOR THEM: each is pinned to a product that row's OWN
// price rests on, named in that row's `pcFrom` in data/msrp.json, never to a
// nearby box of the same type. Where a row's price rests on several boxes at one
// figure, the pin is one of THOSE, and the caption prints its name, exactly as
// the mini tin pin does. pokemoncenter.com is not fetched for any of this and
// its own image urls are not hotlinked: the site serves a bot challenge, and the
// photograph comes from TCGplayer like every other one here.
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
// SEVEN MORE PRICE-ONLY PINS WENT IN ON 18 AUGUST 2026 for the same reason and
// under the same rule, and between them they take /msrp.html from eight hatched
// boxes to none. Build and Battle Stadium, Binder Collection, Pin Collection,
// Premium Tournament Collection, Collector Chest, Trainer's Toolkit and Pokemon
// TCG Classic. The eighth row, Special Collection, needed no new pin: its price
// rests on the Charizard ex Special Collection, which was already pinned here
// for /how-many-packs.html, so it gained an `msrpRow` and nothing else.
//
// EVERY ONE OF THOSE SEVEN IS A PRODUCT LINE THAT HAS RUN AT TWO OR THREE
// PRICES, which is what makes them worth reading the notes on. msrp.json's row
// for each names the boxes at the OTHER figure: the 151 binder at $24.99, the
// Shining Legends pin at $15.99, the pre-2023 chests at $24.99, the 2021 and
// 2022 toolkits at $29.99. TCGplayer lists all of those under nearly the same
// name as the ones that back the price, so picking by name alone would put one
// year's photograph under another year's figure. Each pin below says which.
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
 * `sourced` the product the NUMBER on the row was read off: the pokemon.com
 *           product data/pack-counts-current.json takes the count from, or, for
 *           the four price-only pins, the Pokemon Center product in
 *           data/pokemon-center-prices.json the price was read off. Where the
 *           two names are the same product, the photo is the box the number is
 *           about. Where they differ this field says so and the note beside the
 *           pin explains why they are the same box.
 * `rows`    which /how-many-packs.html row (by productName) this fills.
 * `kind`    which /openings/ page (by taxonomy id) this fills.
 * `msrpRow` which data/msrp.json rowId this fills, for the price-only pins.
 *           Recorded so a reader of the JSON can find the row without grepping;
 *           shared/product-photos.mjs owns the pin from the other direction.
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
    // ALSO THE PIN FOR /msrp.html's "Special Collection" ROW, 18 August 2026,
    // and it needed no new probe. That row's $29.99 rests on seven boxes and
    // "Charizard ex Special Collection" is the first name in its `pcFrom`, so
    // this product is one of the ones the price was read off. Pinning the row to
    // an entry that already existed is better than adding a second entry for the
    // same box: one photograph, one name, one thing to re-check when it moves.
    msrpRow: "special-collection",
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
  // ---- the four price-only pins, 17 August 2026. See the header.
  {
    key: "battle-academy",
    id: 551930,
    expect: "Pokemon TCG: Battle Academy 2024",
    // THERE ARE THREE BATTLE ACADEMY BOXES ON TCGPLAYER AND ONLY ONE IS THIS
    // ROW. /msrp.html prices Battle Academy at $24.99 off ONE Pokemon Center
    // product, "Battle Academy (Armarouge ex, Pikachu ex & Darkrai ex)", and that
    // row's own note already says the older Cinderace V edition is still listed
    // at $19.99 and is a different box. So picking the wrong year here would put
    // the $19.99 box under the $24.99 price, which is the failure this whole file
    // exists to avoid.
    //
    // CHECKED AGAINST TCGPLAYER'S OWN SET LISTS RATHER THAN ASSUMED, because
    // "2024" is a year and not a contents list. Their "Battle Academy 2024" set
    // holds the singles "Armarouge ex (Armarouge 60)", "Pikachu ex (Pikachu 60)"
    // and "Darkrai ex (Darkrai)", which is exactly the three the Pokemon Center
    // name lists. Their "Battle Academy 2022" set holds Cinderace V and Eevee V,
    // which is exactly the older box at the other price. Two independent
    // catalogues agreeing on which Pokemon are in which box is what makes this a
    // reading rather than a guess.
    sourced: "Battle Academy (Armarouge ex, Pikachu ex & Darkrai ex)",
    msrpRow: "battle-academy",
  },
  {
    key: "my-first-battle",
    id: 520781,
    expect: "My First Battle [Pikachu & Bulbasaur]",
    // Both versions Pokemon Center lists are $9.99 and msrp.json's row rests on
    // the pair, so either is a product the price is about. This is the same call
    // the Knock Out pin makes: pin one half, print its name.
    sourced: "My First Battle (Pikachu & Bulbasaur)",
    msrpRow: "my-first-battle",
  },
  {
    key: "league-battle-deck",
    id: 575294,
    expect: "League Battle Deck [Charizard ex]",
    // Six decks at $29.99 back that row, spanning the Sword and Shield decks and
    // the Scarlet and Violet ex decks that replaced them. The pin is the NEWEST
    // of the six rather than the cheapest, because /what-to-buy.html recommends
    // this to somebody who already plays and wants to take a finished deck to a
    // league night, and a picture of the current era is the useful one on a
    // shelf. It is still one of the six the price rests on, which is the rule.
    sourced: "Charizard ex League Battle Deck",
    msrpRow: "league-battle-deck",
  },
  {
    key: "v-battle-deck",
    id: 245732,
    expect: "V Battle Deck [Rayquaza V]",
    // Four decks at $14.99 back that row and this is one of them. NOT the
    // "V Battle Deck Bundle [Lycanroc V / Corviknight V]", which is two decks in
    // one box at $29.99 and which msrp.json's note calls out by name as a
    // different product. TCGplayer writes the Pokemon second and Pokemon Center
    // writes it first; same box, and the caption prints TCGplayer's name because
    // that is what is true of the file.
    sourced: "Rayquaza V Battle Deck",
    msrpRow: "v-battle-deck",
  },
  // ---- SEVEN MORE PRICE-ONLY PINS, 18 AUGUST 2026, and they close the last of
  // the hatched boxes on /msrp.html. Every one follows the same rule as the four
  // above and none of them relaxes it: the pin is a product named in that row's
  // OWN `pcFrom` in data/msrp.json, so the photograph is one of the boxes the
  // price was read off rather than a nearby box of the same type. Where a row
  // rests on several boxes at one figure the pin is the NEWEST of them, because
  // the reader is standing in a shop looking at what is on the shelf today.
  //
  // TCGplayer AND POKEMON CENTER WRITE THE SAME BOX DIFFERENT WAYS, constantly,
  // and each note below says which way. The caption prints TCGplayer's name,
  // because that is what is true of the file.
  //
  // THE WRONG-YEAR TRAP IS THE ONE TO WATCH ON ALL SEVEN. Collector Chest,
  // Trainer's Toolkit, Binder Collection and Pin Collection are all product
  // LINES that have run for years at two or three different prices, and
  // msrp.json's note on each row names the ones at the other figure. Picking a
  // box by name alone would put a $24.99 chest under a $29.99 price.
  {
    key: "build-battle-stadium",
    id: 514070,
    expect: "Paradox Rift Build & Battle Stadium",
    // Eight stadiums back that row at $59.99 and not one is at another figure,
    // which msrp.json's note calls the rare unanimous row. Paradox Rift is the
    // NEWEST of the eight, and TCGplayer names it identically to Pokemon Center.
    // NOT the "Paradox Rift Build & Battle Stadium Case", which is a sealed case
    // of them at a case price.
    sourced: "Paradox Rift Build & Battle Stadium",
    msrpRow: "build-battle-stadium",
  },
  {
    key: "binder",
    id: 630430,
    expect: "Black Bolt Binder Collection",
    // THREE BINDERS BACK THE $29.99 AND TWO OTHERS MUST NOT BE PICKED. The row
    // rests on the Black Bolt, White Flare and Prismatic Evolutions binders;
    // its own note says the 151 binder from 2023 is still listed at $24.99, and
    // its `disagreesWith` records Bill's Archive pricing the 30th Celebration
    // binder at $31.99. TCGplayer lists all five, so the name alone would pick
    // one of the wrong two about half the time. Black Bolt is the newest of the
    // three that actually back the figure. Pokemon Center writes the set prefix
    // in full as "Scarlet & Violet-Black Bolt"; same box.
    sourced: "Scarlet & Violet-Black Bolt Binder Collection",
    msrpRow: "binder",
  },
  {
    key: "pin-collection",
    id: 475618,
    expect: "Crown Zenith Pin Collection [Inteleon]",
    // Ten pin boxes back the $14.99, across six promotions and six years, and
    // Crown Zenith is the newest of the ten. TCGplayer brackets the Pokemon
    // where Pokemon Center parenthesises it. TWO NEARBY BOXES ARE EXCLUDED BY
    // THE ROW ITSELF and both are on TCGplayer: the 2017 Shining Legends Zoroark
    // pin at $15.99, and the Ascended Heroes First Partners DELUXE Pin
    // Collection at $24.99, which is a bigger box.
    sourced: "Crown Zenith Pin Collection (Inteleon)",
    msrpRow: "pin-collection",
  },
  {
    key: "premium-tournament",
    id: 626605,
    expect: "Lillie Premium Tournament Collection Box",
    // Four back the $39.99 and the row's note names Lillie as the current SKU,
    // so the newest of the four is also the one on a shelf now. TCGplayer
    // appends "Box" to the name Pokemon Center prints, the same way it appends
    // it to the Marnie and Cyrus listings; same box. NOT the "Display" or the
    // "Box Case", which are multipacks, and NOT the "Cyrus/Klara ... [Set of 2]".
    sourced: "Lillie Premium Tournament Collection",
    msrpRow: "premium-tournament",
  },
  {
    key: "collector-chest",
    id: 575706,
    expect: "Fall 2024 Collector Chest",
    // THE ROW SPLITS AT 2023 AND THE PIN HAS TO LAND ON THE RIGHT SIDE OF IT.
    // Three chests back the $29.99, Fall 2024, Fall 2023 and Back to School
    // 2024, and the row's note says the three older ones, back to 2016, are
    // $24.99. TCGplayer lists chests from 2014 to 2025 under nearly the same
    // name. Fall 2024 is the newest of the three the price actually rests on.
    // NOT "Fall 2025 Collector Chest", which exists on TCGplayer and is NOT in
    // this row's `pcFrom`: no price for it was read, so it is not evidence.
    // Pokemon Center writes the season in brackets after the name; same box.
    sourced: "Collector Chest (Fall 2024)",
    msrpRow: "collector-chest",
  },
  {
    key: "trainers-toolkit",
    id: 653203,
    expect: "Pokemon TCG: Trainer's Toolkit (2025)",
    // Dated by the box rather than by the shelf: the 2023, 2024 and 2025
    // toolkits are all $34.99 and the 2021 and 2022 ones are $29.99, and
    // TCGplayer lists all six years including a 2020. 2025 is the newest of the
    // three that back the figure. TCGplayer prefixes "Pokemon TCG:"; same box.
    sourced: "Trainer's Toolkit (2025)",
    msrpRow: "trainers-toolkit",
  },
  {
    key: "tcg-classic",
    id: 518886,
    expect: "Pokemon Trading Card Game Classic",
    // THE ONE ROW WHERE THE PICTURE AND THE PRICE ARE THE SAME OBJECT WITH NO
    // CHOOSING AT ALL. That row is one specific product rather than a type, its
    // `pcFrom` holds exactly one name, and TCGplayer holds exactly one listing,
    // in a product set of its own. TCGplayer spells "Trading Card Game" where
    // Pokemon Center abbreviates it to TCG. NOT the "30th Celebration Classic
    // Collection Pack", which the same search returns and which is a different
    // product entirely.
    sourced: "Pokemon TCG Classic",
    msrpRow: "tcg-classic",
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
    msrpRow: pin.msrpRow || null,
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
        "These are the products sync-products.mjs cannot reach: the ones that belong to",
        "no expansion at all, the ones whose per-set listing is a different box from the",
        "one the pack count was sourced off, and one Japanese pack, which TCGplayer files",
        "under its own product line.",
        "",
        "`name` is TCGplayer's own name for the product in the photo and it is what the",
        "caption prints. `sourcedAs` is the product the row's NUMBER was read off: the",
        "pokemon.com product in data/pack-counts-current.json for a pack count, or the",
        "Pokemon Center product in data/pokemon-center-prices.json for the four rows that",
        "have a price and no packs (Battle Academy, My First Battle, League Battle Deck,",
        "V Battle Deck). Where that name and `name` differ, the note in the sync script",
        "says why they are the same box.",
        "",
        "`row` names a /how-many-packs.html row, `kind` an /openings/ page and `msrpRow` a",
        "data/msrp.json rowId. shared/product-photos.mjs is what actually pins a photo to",
        "an /msrp.html and /what-to-buy.html row; `msrpRow` is here so a reader of this",
        "file can see which row a pin was chased for.",
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
