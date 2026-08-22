#!/usr/bin/env node
// The highest UNGRADED values in Pokemon, from PriceCharting's own price guide.
//
//   node scripts/sync-raw-top.mjs            read the cache, write the file
//   node scripts/sync-raw-top.mjs --report   measure only, write nothing
//
// Writes data/top-raw.json, which is what /most-valuable-cards.html is built
// from. Then: node scripts/verify-raw-top.mjs, which re-reads every published
// figure from the card's own product page. The build REFUSES to run without
// that second read; see shared/graded-gate.mjs for why.
//
// ---------------------------------------------------------------------------
// THIS SCRIPT MAKES NO NETWORK REQUESTS AND MUST NOT BE GIVEN ANY
// ---------------------------------------------------------------------------
//
// Every figure it ranks is parsed out of .cache/pricecharting-console/, which
// scripts/sync-graded-top.mjs already filled: 1,129 readable pages, 89,910
// products, 415MB on disk. The console listing carries Ungraded, Grade 9 and
// PSA 10 SIDE BY SIDE on one row, so the raw ranking and the graded ranking
// come off exactly the same bytes. Re-crawling for the raw column would be
// asking somebody else's server for 415MB we already hold.
//
// If you need fresher numbers, the job is `node scripts/sync-graded-top.mjs
// --refresh` and then re-run this and the verifier. Do not add a fetch here:
// scripts/sync-pricecharting-cards.mjs says the same thing for the same reason,
// and two scripts crawling one host is how a fan site gets blocked.
//
// ---------------------------------------------------------------------------
// WHY RANKING LOCALLY IS THE ONLY HONEST WAY TO DO THIS
// ---------------------------------------------------------------------------
//
// PriceCharting offers exactly one price sort, `sort=highest-price`, and
// data/top-graded-PLAN.md records that it sorts on the UNGRADED column. That is
// the column this page ranks by, so unlike the graded list the sort could in
// principle have been used here. It still is not, for two reasons:
//
//   - It is a per-console sort. There are 793 Pokemon consoles and no
//     all-of-Pokemon listing, so the top of one console says nothing about the
//     top of the catalogue.
//   - Trap 2 in that file: an unknown parameter value is ignored SILENTLY with
//     a 200, so a sort that quietly stopped applying would produce a confident,
//     wrong, entirely plausible list.
//
// Every priced row of every console is pulled from the cache and sorted here.
// `scanned` in the output is the size of the corpus the ranking came from, and
// it is the completeness claim the page makes: this is not the top 100 of a
// sample, it is the top 100 of 78,837 priced Pokemon products.
//
// ---------------------------------------------------------------------------
// WHAT IS NOT A CARD, AND WHY THAT LIST IS WRITTEN BY HAND
// ---------------------------------------------------------------------------
//
// The crawl ran with `exclude-hardware=true`, which is how PriceCharting drops
// sealed product, and it mostly works: 144 sealed-looking rows leaked through
// across 89,910. But they are not evenly spread. Twelve of them land inside the
// window this file keeps and EIGHT of them are dear enough to make the
// published hundred, including a $26,347 Japanese Special Box at what would
// otherwise be number four. A page titled "the most valuable raw cards" that
// ranks a sealed box fourth is wrong in the way that matters most.
//
// So the rows are flagged MECHANICALLY and judged BY HAND, and both halves are
// deliberate:
//
//   - The regex below flags any product whose name carries a product-form word.
//     It is deliberately over-eager, because a false flag costs a line in the
//     table below and a missed one puts a booster box on a list of cards.
//   - Every flagged row inside the ranking window must appear in VERDICTS with
//     a decision and a reason, or THIS SCRIPT THROWS. A flagged row is never
//     dropped silently and never kept silently.
//
// Two of the fourteen flagged rows in the window are genuine cards whose names
// simply carry a product word: the Base Set Trainer Deck B Blastoise and the
// Fusion Strike Prize Pack Gengar VMAX. Dropping those would be editing the
// answer to suit the question just as surely as keeping the boxes would.
// THE DROPPED ROWS ARE KEPT IN THE OUTPUT, in `notCards`, so
// the page can say how many were removed and name them rather than quietly
// showing a shorter list than it measured.

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The one listing parser. See its header: the second read that makes any of
// this publishable is only a second opinion because it is a DIFFERENT parser,
// which is exactly why the first one may not be copied around.
import { CONSOLE_HEADERS, parsePage, text, unent } from "../shared/pricecharting.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-console");
const OUT = join(ROOT, "data/top-raw.json");
const REPORT = process.argv.includes("--report");

// How many candidates to keep. The page publishes 100 and a row that fails its
// second read is not published, so the file has to carry more than the page
// shows or the list silently ends at 96. Same reason data/top-graded.json keeps
// 400 for a page of 100; this one is smaller because every kept row costs a
// product-page fetch in the verifier and 160 is already ~3 minutes of them.
const KEEP = 160;

// PRODUCT-FORM WORDS. Over-eager on purpose: see the header. `\b` matters on
// every one of them, because "tin" inside "Tinkaton" and "set" inside "Setup"
// would otherwise flag half the catalogue.
const FORM_WORDS =
  /\b(box|boxes|blister|pack|packs|deck|decks|chest|collection|tin|bundle|case|display|kit|binder|album|sleeves?|playmat|figure|pin|poster|starter|gift|bag|jumbo|oversized|set)\b/i;

/**
 * THE HAND VERDICTS, keyed by PriceCharting's own product id.
 *
 * Keyed by ID rather than by name because two different consoles both hold a
 * product called "Blister Pack" and they are two different sealed products, so
 * a name key would let one verdict cover a row nobody looked at. Every entry
 * below was read off the row it describes on 18 August 2026.
 *
 * `card: false` drops the row from the ranking and records it in `notCards`.
 * `card: true` keeps it and says why the flag was a false alarm.
 */
const VERDICTS = {
  // Sealed product that leaked past exclude-hardware=true.
  "10455469": { card: false, name: "Special Box [15th Anniversary]", why: "a sealed box, not a card" },
  "13866943": { card: false, name: "Special Box [Mimikyu Dayo]", why: "a sealed box, not a card" },
  "13770081": { card: false, name: "Platinum Series Collection", why: "a sealed collection, not a card" },
  "7306492": { card: false, name: "Special Box [Poncho Rayquaza]", why: "a sealed box, not a card" },
  "13118661": { card: false, name: "Half Deck", why: "a sealed deck, not a card" },
  "10455473": { card: false, name: "Special Box [Rokon's Crystal Season]", why: "a sealed box, not a card" },
  "13427193": { card: false, name: "Plastic Pack Demo Game", why: "a sealed demo pack, not a card" },
  "11747646": { card: false, name: "Blister Pack", why: "sealed packaging, not a card" },
  "9850661": { card: false, name: "2-Pack Blister", why: "sealed packaging, not a card" },
  "10466811": { card: false, name: "2019 Fall Collectors Chest", why: "a sealed chest, not a card" },
  "13645269": { card: false, name: "Towering Splash GX Box", why: "a sealed box, not a card" },
  "9808318": { card: false, name: "Blister Pack", why: "sealed packaging, not a card" },
  // Entered the window on the 22 August 2026 crawl at $4,305, which would have
  // put a sealed box at number 24 on a page titled "most valuable raw cards".
  // Judged from PriceCharting's own product page rather than from the name:
  // its photo is the shrink-wrapped Legendary Collection Lava deck box with the
  // Charizard art, and its Card Number attribute is "none".
  "14011719": { card: false, name: "Lava Theme Deck", why: "a sealed theme deck box, not a card" },
  // Real cards whose names happen to carry a product word. Kept, because
  // dropping them would edit the answer just as surely as keeping a box would.
  "2365260": { card: true, name: "Blastoise [Trainer Deck B] #2", why: "a single card from the Base Set Trainer Deck B" },
  "9913282": { card: true, name: "Gengar VMAX [Prize Pack] #157", why: "a single card from the Prize Pack promo series" },
};

// ---------------------------------------------------------------------------
// Read the cache.

const files = (await readdir(CACHE)).filter((f) => f.endsWith(".html"));
const seen = new Set();
const consoles = new Set();
const all = [];
let pages = 0;
let skipped = 0;
let newestCache = 0;

for (const f of files) {
  const html = await readFile(join(CACHE, f), "utf8");
  // The canonical url is what says WHICH console this file is, and it is read
  // off the page rather than off the filename: the cache key is a sha1 of the
  // request url, so the filename says nothing at all.
  const canon = /rel="canonical" href="([^"]+)"/.exec(html);
  if (!canon) continue;
  let path;
  try {
    path = decodeURIComponent(new URL(unent(canon[1])).pathname);
  } catch {
    continue;
  }
  if (!path.includes("/console/pokemon")) continue;
  const { rows, headers } = parsePage(html);
  // Same contract sync-graded-top.mjs enforces on the way in. A page whose
  // columns are not the expected ones is skipped, never read positionally.
  if (headers.length && headers.join("|") !== CONSOLE_HEADERS.join("|")) {
    skipped += 1;
    continue;
  }
  pages += 1;
  consoles.add(path);
  newestCache = Math.max(newestCache, (await stat(join(CACHE, f))).mtimeMs);
  const setFromTitle = /<title>Pokemon (.*?) (?:Card )?Prices/.exec(html);
  const set = setFromTitle ? text(setFromTitle[1]) : path.replace("/console/pokemon-", "");
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    all.push({ ...r, set, console: path });
  }
}

const priced = all.filter((r) => r.ungraded != null);
priced.sort((a, b) => b.ungraded - a.ungraded);

// ---------------------------------------------------------------------------
// Judge the flagged rows, inside the window only.

const cards = [];
const notCards = [];
const unjudged = [];

for (const r of priced) {
  if (cards.length >= KEEP) break;
  if (!FORM_WORDS.test(r.name)) {
    cards.push(r);
    continue;
  }
  const v = VERDICTS[r.id];
  if (!v) {
    unjudged.push(r);
    continue;
  }
  // The verdict has to be about THIS row. A name that has drifted means the id
  // now points at something else, and an old decision must not carry over.
  if (v.name !== r.name) {
    unjudged.push({ ...r, whyUnjudged: `verdict for id ${r.id} says "${v.name}"` });
    continue;
  }
  if (v.card) cards.push(r);
  else notCards.push({ ...r, why: v.why });
}

if (unjudged.length) {
  console.error(
    `${unjudged.length} product(s) in the top ${KEEP} carry a product-form word in their name and\n` +
      `have no verdict in VERDICTS. Look at each one and decide whether it is a single card\n` +
      `or a sealed product, then add it. Nothing is dropped or kept by guess here:\n` +
      unjudged
        .map(
          (r) =>
            `  "${r.id}": { card: ???, name: ${JSON.stringify(r.name)}, why: "" },` +
            `   $${r.ungraded}  ${r.set}  https://www.pricecharting.com${r.path}` +
            (r.whyUnjudged ? `   (${r.whyUnjudged})` : ""),
        )
        .join("\n"),
  );
  process.exit(1);
}

const stale = Object.entries(VERDICTS).filter(
  ([id]) => !cards.some((r) => r.id === id) && !notCards.some((r) => r.id === id),
);

// ---------------------------------------------------------------------------
// THE READ DATE IS BORROWED FROM THE FILE THE SAME CRAWL WROTE, not taken from
// an mtime. These cache files ARE the crawl behind data/top-graded.json, so its
// `checked` is the day these prices were read, and a `cp -r` of the tree cannot
// silently make the site claim a fresher reading than it has.
const topGraded = JSON.parse(await readFile(join(ROOT, "data/top-graded.json"), "utf8"));
const checked = topGraded.checked;
const cacheDay = new Date(newestCache).toISOString().slice(0, 10);
if (cacheDay !== checked) {
  console.log(
    `  NOTE: newest cached page is ${cacheDay}, data/top-graded.json says ${checked}.\n` +
      `        Publishing ${checked}, which is the crawl's own record of when it read.`,
  );
}

const out = {
  _readme: [
    "The highest UNGRADED values in Pokemon, from pricecharting.com.",
    "Written by scripts/sync-raw-top.mjs from the pages sync-graded-top.mjs",
    "already cached. NO NETWORK: see that script's header before adding one.",
    "",
    "WHAT THE NUMBER IS. PriceCharting's Ungraded column: a price guide value",
    "for a loose, ungraded copy, computed by their algorithm from completed",
    "eBay sales and their own marketplace. It is NOT a marketplace's market",
    "price, NOT a live listing and NOT an auction result, and no page may",
    "describe it as any of those.",
    "",
    "EVERY LANGUAGE, ON PURPOSE. PriceCharting's Pokemon catalogue is not split",
    "by language, and this ranking is not either. Half the top 100 is Japanese.",
    "The argument is in the header of scripts/build-top100.mjs.",
    "",
    "A SNAPSHOT. `checked` is the day the crawl read these pages, borrowed from",
    "data/top-graded.json because they are the same crawl. Every row carries",
    "the url it came from and the page prints both.",
    "",
    "NOTHING HERE IS PUBLISHABLE UNTIL verify-raw-top.mjs HAS RUN. The td ids",
    "on a product page mean different grades than the ones on a listing page,",
    "so a single read cannot be trusted. See data/top-graded-PLAN.md, trap 4.",
  ],
  source: "pricecharting.com",
  sourceMethodology: "https://www.pricecharting.com/page/methodology",
  measurement: "PriceCharting ungraded price guide value",
  checked,
  scanned: {
    consoles: consoles.size,
    pages,
    pagesSkipped: skipped,
    products: all.length,
    productsWithUngraded: priced.length,
  },
  // The rows removed from the ranking because they are not single cards, kept
  // rather than deleted so the page can name them.
  notCards: notCards.map((r) => ({
    name: r.name,
    set: r.set,
    ungraded: r.ungraded,
    why: r.why,
    url: `https://www.pricecharting.com${r.path}`,
    id: r.id,
  })),
  cards: cards.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    set: r.set,
    ungraded: r.ungraded,
    g9: r.g9,
    psa10: r.psa10,
    url: `https://www.pricecharting.com${r.path}`,
    pcImg: r.img,
    id: r.id,
  })),
};

if (!REPORT) await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

console.log(
  `${REPORT ? "Measured (wrote nothing)" : "Wrote data/top-raw.json"}\n` +
    `  ${consoles.size} consoles, ${pages} cached pages${skipped ? `, ${skipped} skipped for unexpected columns` : ""}\n` +
    `  ${all.length} products, ${priced.length} with an ungraded value\n` +
    `  kept the top ${cards.length} cards, $${cards[0].ungraded.toLocaleString("en-US")} down to ` +
    `$${cards[cards.length - 1].ungraded.toLocaleString("en-US")}\n` +
    `  removed ${notCards.length} sealed products from inside that window: ` +
    notCards.map((r) => `${r.name} ($${r.ungraded.toLocaleString("en-US")})`).join(", "),
);
if (stale.length) {
  console.log(
    `  NOTE: ${stale.length} verdict(s) no longer describe a row in the window and can be deleted: ` +
      stale.map(([id, v]) => `${id} ${v.name}`).join(", "),
  );
}
console.log(`\nNext: node scripts/verify-raw-top.mjs`);
