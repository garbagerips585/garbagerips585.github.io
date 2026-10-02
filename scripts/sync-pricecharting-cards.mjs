#!/usr/bin/env node
// PriceCharting's ungraded and graded figures for every card in every set guide.
//
//   node scripts/sync-pricecharting-cards.mjs           read the cache, write the file
//   node scripts/sync-pricecharting-cards.mjs --report  measure only, write nothing
//   node scripts/sync-pricecharting-cards.mjs --companions
//                                                       the three subsets only
//
// Writes data/pricecharting-cards.json, and since 2 October 2026 also
// data/companion-prices.json (see the block at the foot of this file). Then: node scripts/sync-cards.mjs, which
// overlays these onto public/data/cards/<set>.json, which is the ONE file every
// set guide, Pokedex page and checklist reads its prices from.
//
// ---------------------------------------------------------------------------
// THIS SCRIPT MAKES NO NETWORK REQUESTS AND MUST NOT BE GIVEN ANY
// ---------------------------------------------------------------------------
//
// Every figure it writes is parsed out of .cache/pricecharting-console/, which
// sync-graded-top.mjs already filled: 1,131 pages, 792 Pokemon consoles, 89,910
// products, 415MB on disk. That crawl is a heavy job against somebody else's
// bandwidth and it has already been paid for. Re-running it to get raw prices
// would be fetching the same bytes a second time for columns we already hold:
// the console listing carries Ungraded, Grade 9 and PSA 10 side by side, so the
// raw price and the graded prices come off one row of one page.
//
// If you need FRESHER numbers than the `checked` date below, the job is
// `node scripts/sync-graded-top.mjs --refresh`, and then re-run this. Do not add
// a fetch here: two scripts crawling the same host is how a fan site gets
// blocked, and this one exists precisely so that the crawl happens once.
//
// ---------------------------------------------------------------------------
// WHY PRICECHARTING FOR RAW AT ALL, AND WHAT IT COST
// ---------------------------------------------------------------------------
//
// The owner, 18 August 2026: "lets use pricecharting as the main numbers for the
// entire site, I think they have the best numbers to show", and then, asked
// about scope: "i only meant to use price charting for the raw prices and the
// PSA10 or any other graded prices, keep the PokemonCenter.com prices for all
// MSRP pricing".
//
// THE SWAP WAS MEASURED BEFORE IT WAS MADE, because the risk with a source
// change is coverage, not preference: a page that loses a price is worse than a
// page showing a slightly different one. Measured over all 5,181 cards in the
// 28 set guides, variant for variant:
//
//     TCGdex has a price for      5,168   99.75%
//     PriceCharting has one for   5,180   99.98%
//
// So the swap GAINS twelve prices rather than losing any. One card is missing
// on both sides (Scarlet & Violet #258 Basic Fighting Energy, which
// PriceCharting does not list at that number), and TCGdex remains the named
// fallback for it and for anything a future set fails to resolve.
//
// WHERE THE TWO DISAGREE, and this is the part worth knowing before reading a
// page. On the cards a guide actually features, they agree closely:
//
//     cards at $20+ (391 of them)   98.2% within 25%,  100% within 50%
//                                   median ratio 0.94
//
// On bulk they do not, and it is systematic rather than noise. PriceCharting is
// higher on 76% of all cards, and the gap is almost entirely in the sub-dollar
// tail: a reverse holo Aipom is $0.12 on TCGplayer's market price and $0.25 in
// PriceCharting's guide. That is the two measurements meaning different things,
// which shared/price-basis.mjs has always said out loud. A guide value on a card
// that sells a handful of times a year is computed across venues and does not
// fall to a marketplace's floor the way a market price does.
//
// IT DOES NOT MOVE THE SET TOTALS, which was the thing to check, because a
// checklist page sums every row: $43,824 across the 28 sets on TCGdex against
// $43,658 on PriceCharting, a ratio of 1.00. Celebrations is the one exception
// at 4.13x, because it is a 25 card set with no expensive cards to anchor it and
// the bulk floor is the whole total. If a Celebrations figure looks wrong later,
// that is why, and it is a real reading of a real source rather than a bug.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PC_CONSOLES } from "../shared/pricecharting.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-console");
const OUT = join(ROOT, "data/pricecharting-cards.json");
const REPORT = process.argv.includes("--report");
/* --companions WRITES THE SUBSET FILE AND LEAVES THE 28 GUIDES ALONE, added 2
   October 2026, and the reason is a measurement rather than a nicety. The cache
   on a laptop is whatever that laptop last crawled; the nightly job's cache is
   its own. Run here that day, a plain run rewrote data/pricecharting-cards.json
   off pages dated 23 September over the nightly's figures read 2 October, and
   stamped them 2 October, because the read date below is borrowed from
   data/price-rotation.json, which describes the NIGHTLY's crawl and not this
   machine's. So a local run that only wants the subsets must not be able to
   roll every other price on the site back nine days. The nightly runs this
   script with no flag and writes both files off one fresh cache. */
const COMP_ONLY = process.argv.includes("--companions");

// The set guide -> console map moved to shared/pricecharting.mjs when
// build-top100.mjs started needing it too. Nothing about it changed.
const CONSOLES = PC_CONSOLES;

// The same header contract sync-graded-top.mjs enforces, for the same reason:
// the td classes are video-game legacy names and only the <th> row says which
// grade column three actually is.
const WANT_HEADERS = ["", "Card", "Ungraded", "Grade 9", "PSA 10", ""].join("|");

const unent = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
// Decode BEFORE the trim. sync-graded-top.mjs records what the other order
// cost: the blank headers are "&nbsp;", so trimming first leaves a literal
// entity that never compares equal to "" and every console is skipped.
const text = (s) => unent(String(s)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const money = (s) => {
  const n = Number(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const norm = (x) =>
  String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const numKey = (x) => String(x ?? "").trim().replace(/^0+(?=\d)/, "").toUpperCase();

/**
 * "Charizard [Shadowless] #4" -> { name, quals:["Shadowless"], number:"4" }.
 *
 * The bracketed part is the printing and it is kept SEPARATE from the name, so
 * that a reverse holo and its base card are two products of one card rather
 * than two cards. Matching on the whole string instead is what data/graded.json
 * records as costing 4 of 12 lookups landing on the wrong printing.
 */
function parseTitle(t) {
  const m = /^(.*?)\s*#\s*([A-Za-z0-9\-/]+)\s*$/.exec(t);
  if (!m) return null;
  const quals = [...m[1].matchAll(/\[([^\]]+)\]/g)].map((q) => q[1]);
  const name = m[1].replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  return { name, quals, number: numKey(m[2]) };
}

/**
 * Does PriceCharting's name for this product mean the same card as ours?
 *
 * A NUMBER MATCH ALONE IS NOT ENOUGH and this is the guard that says so. The
 * number join is right 5,180 times out of 5,181, but the one time a set is
 * mapped to the wrong console every number still matches and every price is
 * wrong, so the name has to agree as well.
 *
 * THE FOUR FAMILIES BELOW ARE REAL AND BENIGN. All 31 disagreements across the
 * 28 guides were read by hand on 18 August 2026 and every one is a naming
 * convention, not a different card:
 *
 *   subtitles     ours "Professor's Research", theirs "Professor's Research:
 *                 Professor Sada". Also Boss's Orders: Corbeau. Ours sometimes
 *                 carries the same subtitle in parentheses instead.
 *   basic energy  ours "Basic Fire Energy", theirs "Fire Energy".
 *   typed energy  ours "Horror Psychic Energy", theirs "Horror Energy"; ours
 *                 "Bubbly Water Energy", theirs "Bubbly W Energy".
 *   regional form ours "Galarian Slowking VMAX", theirs "Slowking VMAX".
 *
 * Anything that is NOT one of these is refused and the card keeps its TCGdex
 * price, because an unexplained name disagreement is exactly the shape a
 * mis-mapped console makes.
 */
function nameAgrees(ours, theirs) {
  const a = norm(ours);
  const b = norm(theirs);
  if (a === b) return true;
  // subtitle on either side: "Professor's Research: Professor Sada",
  // "Professor's Research (Professor Oak)"
  const strip = (s) => norm(String(s).replace(/[:(].*$/, ""));
  if (strip(ours) && strip(ours) === strip(theirs)) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // energy naming: drop "basic", drop the type word, compare what is left
  const energy = (s) =>
    norm(
      String(s)
        .replace(/\bbasic\b/gi, "")
        .replace(/\b(grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon|colorless)\b/gi, "")
        .replace(/\b[GRWLPFDMYNC]\b/g, "")
    );
  if (/energy/i.test(ours) && /energy/i.test(theirs) && energy(ours) === energy(theirs)) return true;
  // regional forms PriceCharting drops from the title
  const region = (s) => norm(String(s).replace(/\b(galarian|alolan|hisuian|paldean|kantonian)\b/gi, ""));
  if (region(ours) === region(theirs)) return true;
  return false;
}

// ---------------------------------------------------------------------------

const wanted = new Map(Object.entries(CONSOLES).map(([id, path]) => [path, id]));
const bySet = new Map(Object.keys(CONSOLES).map((id) => [id, new Map()]));

const files = (await readdir(CACHE)).filter((f) => f.endsWith(".html"));
let pages = 0;
let newestCache = 0;
const oldestPage = new Map();

for (const f of files) {
  const html = await readFile(join(CACHE, f), "utf8");
  const canon = /rel="canonical" href="([^"]+)"/.exec(html);
  if (!canon) continue;
  let path;
  try {
    path = decodeURIComponent(new URL(unent(canon[1])).pathname);
  } catch {
    continue;
  }
  const setId = wanted.get(path);
  if (!setId) continue;
  const headers = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => text(m[1]));
  if (headers.length && headers.join("|") !== WANT_HEADERS) continue;
  pages += 1;
  const mtime = (await stat(join(CACHE, f))).mtimeMs;
  newestCache = Math.max(newestCache, mtime);
  // The OLDEST page of each console, for the subsets' read date below.
  oldestPage.set(path, Math.min(oldestPage.get(path) ?? Infinity, mtime));

  const rows = bySet.get(setId);
  for (const m of html.matchAll(/<tr[^>]*id="product-(\d+)"[^>]*>(.*?)<\/tr>/gs)) {
    const tr = m[2];
    const a = /<td class="title"[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)<\/a>/s.exec(tr);
    if (!a) continue;
    const p = parseTitle(text(a[2]));
    if (!p) continue;
    const prices = [...tr.matchAll(/<td class="price[^"]*"[^>]*>(.*?)<\/td>/gs)].map((x) => {
      const v = /<span class="js-price"[^>]*>(.*?)<\/span>/s.exec(x[1]);
      return v ? money(text(v[1])) : null;
    });
    if (!rows.has(p.number)) rows.set(p.number, []);
    // Keyed by product id so a page served twice cannot double a variant.
    const list = rows.get(p.number);
    if (!list.some((x) => x.id === m[1])) {
      list.push({
        id: m[1],
        url: "https://www.pricecharting.com" + unent(a[1]),
        name: p.name,
        quals: p.quals,
        ungraded: prices[0] ?? null,
        g9: prices[1] ?? null,
        psa10: prices[2] ?? null,
      });
    }
  }
}

// THE READ DATE IS BORROWED FROM THE FILE THE SAME CRAWL WROTE, not taken from
// a mtime. These cache files ARE the crawl behind data/top-graded.json, so its
// `checked` is the day these prices were read, and a `cp -r` of the tree cannot
// silently make the site claim a fresher reading than it has.
const topGraded = JSON.parse(await readFile(join(ROOT, "data/top-graded.json"), "utf8"));
/* AND THE NIGHTLY REFRESH IS A SECOND CRAWL WITH ITS OWN RECORD, added 28 August
   2026. refresh-prices.mjs re-fetches the 28 set-guide consoles every night, and
   EVERY PRICE IN THIS FILE COMES OFF THOSE 28 PAGES, so once it has run, the day
   it ran IS the day these numbers were read. data/price-rotation.json is that
   crawl's own written record, exactly as data/top-graded.json is the older
   crawl's, so this keeps the rule the paragraph above sets out: a read date is
   borrowed from a file a crawl wrote, never from a mtime. Take the later of the
   two, because either crawl may have run more recently than the other. */
const rotPath = join(ROOT, "data/price-rotation.json");
const rot = existsSync(rotPath) ? JSON.parse(await readFile(rotPath, "utf8")) : {};
const checked = [topGraded.checked, rot.lastHot].filter(Boolean).sort().pop();
const cacheDay = new Date(newestCache).toISOString().slice(0, 10);
if (cacheDay !== checked) {
  console.log(
    `  NOTE: newest cached page is ${cacheDay}, data/top-graded.json says ${checked}.\n` +
      `        Publishing ${checked}, which is the crawl's own record of when it read.`
  );
}

// ---------------------------------------------------------------------------
// Resolve, against our own checklists, so a miss is visible per set.

const out = { sets: {} };
const mismatches = [];
let cards = 0;
let priced = 0;
let noRow = 0;
let refused = 0;

for (const [setId, consolePath] of Object.entries(CONSOLES)) {
  const doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${setId}.json`), "utf8"));
  const rows = bySet.get(setId);
  /* EACH SET CARRIES THE DAY ITS OWN CONSOLE WAS READ, not one date for all 28.
     refresh-prices.mjs bookmarks a console only when it ran to the end of its
     own pagination, so this is the strongest claim available: a set whose page
     was refused keeps the older date and says so, while the ones that came back
     say today. Before this, ONE successful console dated all 28 -- and 27 of the
     28 are multi-page, so a single 429 mid-pagination was enough to publish a
     freshness the numbers did not have. Falls back to the shared date for a set
     the rotation has never reached. */
  const entry = { console: consolePath, checked: rot.refreshed?.[consolePath] || checked, cards: {} };
  let setPriced = 0;

  for (const c of doc.cards) {
    cards += 1;
    const cands = (rows.get(numKey(c.n)) || []).filter((x) => x.ungraded != null);
    if (!cands.length) {
      noRow += 1;
      continue;
    }
    const ok = cands.filter((x) => nameAgrees(c.name, x.name));
    if (!ok.length) {
      refused += 1;
      mismatches.push(`${setId}/${c.n}  ours "${c.name}"  theirs "${cands.map((x) => x.name).join(" | ")}"`);
      continue;
    }
    // ONLY THE THREE STANDARD PRINTINGS COUNT, AND LEAVING THIS OUT PRICED A
    // BULK BULBASAUR AT $40.30.
    //
    // sync-cards.mjs takes the most expensive variant, and on TCGdex that phrase is
    // safe because TCGdex only ever carries normal, holofoil and reverse
    // holofoil at a collector number. PriceCharting files far more against the
    // same number: [Stamped] prerelease copies, [Poke Ball] and [Master Ball]
    // pattern holos, [Cosmos Holo], [Prize Pack], [Jumbo], [Professor Program],
    // [GameStop]. Those are DIFFERENT PRODUCTS that happen to share a number.
    //
    // Taking the most expensive of all of them made 151's Bulbasaur $40.30, off a
    // stamped promo, against $0.55 for the card the checklist is actually about
    // and $0.35 on TCGdex. Every common in every set would have quietly become
    // the price of its scarcest lookalike, and the checklist would have read as
    // if the set were full of expensive commons.
    //
    // So the allowlist is the point of this block, not an optimisation. A
    // qualifier that is not one of these means "a different product", and the
    // rule stays like for like: the same three printings TCGdex offers, so the
    // swap changes the SOURCE of the number and not which card it describes.
    const STANDARD = new Set(["", "holo", "reverseholo", "reverse"]);
    const std = ok.filter((x) => STANDARD.has(norm(x.quals.join(" "))));
    if (!std.length) {
      // PriceCharting lists this number only as a special printing. The
      // checklist card is not in their data at all, so TCGdex keeps it.
      refused += 1;
      mismatches.push(
        `${setId}/${c.n}  "${c.name}"  no standard printing, only [${cands.map((x) => x.quals.join(" ")).join("] [")}]`
      );
      continue;
    }
    const best = std.slice().sort((a, b) => b.ungraded - a.ungraded)[0];
    const all = {};
    for (const x of std) all[x.quals.length ? x.quals.join(" ") : "Base"] = x.ungraded;
    entry.cards[c.n] = {
      price: best.ungraded,
      variant: best.quals.length ? best.quals.join(" ") : "Base",
      all,
      // The graded columns come off the SAME row as the raw price, so a page
      // printing both is describing one printing of one card.
      psa10: best.psa10,
      g9: best.g9,
      url: best.url,
    };
    priced += 1;
    setPriced += 1;
  }

  entry.total = doc.cards.length;
  entry.priced = setPriced;
  out.sets[setId] = entry;
}

const doc = {
  _readme: [
    "PriceCharting's Ungraded, Grade 9 and PSA 10 figures for every card in the",
    "28 English set guides. Written by scripts/sync-pricecharting-cards.mjs from",
    "the pages sync-graded-top.mjs already cached. NO NETWORK: see that script's",
    "header before adding one.",
    "",
    "WHAT `price` IS. PriceCharting's Ungraded column: a price guide value for",
    "an ungraded copy, computed by their algorithm across the sales they track.",
    "It is NOT a marketplace's market price and NOT an auction result, and no",
    "page may describe it as either. Their methodology is published and the",
    "pages link it.",
    "",
    "WHICH PRINTING. `price` is the most expensive variant PriceCharting lists at that",
    "collector number, and `variant` names it, matching the rule sync-cards.mjs",
    "has always used for the checklist row. `all` holds every variant so the",
    "cheapest-way-to-own sums on /complete-a-set.html read one source too.",
    "",
    "A CARD ABSENT HERE KEEPS ITS TCGDEX PRICE and the page says so. This file",
    "is an overlay, not a replacement: sync-cards.mjs stamps each card with",
    "which source answered, so a guide can name both without guessing.",
    "",
    "`checked` is data/top-graded.json's, because these are that crawl's pages.",
  ],
  source: "pricecharting.com",
  sourceMethodology: "https://www.pricecharting.com/page/methodology",
  measurement: "PriceCharting ungraded price guide value",
  checked,
  scanned: { pages, cards, priced, noRow, refused },
  ...out,
};

if (!REPORT && !COMP_ONLY) {
  await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote data/pricecharting-cards.json`);
}
console.log(`  pages read       ${pages}  (from .cache, no network)`);
console.log(`  checklist cards  ${cards}`);
console.log(`  priced           ${priced}  ${((100 * priced) / cards).toFixed(2)}%`);
console.log(`  no row at that number  ${noRow}`);
console.log(`  name refused           ${refused}`);
for (const m of mismatches) console.log(`    ${m}`);

// ===========================================================================
// THE THREE SUBSETS, 2 October 2026
// ===========================================================================
//
// The owner, 2 October 2026: "yes price the shining fates, crown zenith and
// celebrations subsets". Shining Fates' Shiny Vault (SV001 to SV122), Crown
// Zenith's Galarian Gallery (GG01 to GG70) and Celebrations' Classic
// Collection (25 reprints). data/companion-sets.json lists them and, until
// today, said this repo held no price for any of the 217.
//
// THEY WERE ALREADY IN THE CRAWL. PriceCharting files each subset on its
// parent's console page, the same pages the loop above has always read:
// "Charizard VMAX #SV107" sits on /console/pokemon-shining-fates beside the 73
// main-set rows. So this is the same pages, the same row parser, the same
// standard-printing allowlist and the same name guard, run against a second
// checklist. No new feed, no new crawl, no request.
//
// WHERE THEY GO, AND WHY NOT public/data/cards/<set>.json. companion-sets.json
// argues it out: the card counts on the first screen are the PRINTED totals,
// and that file is read by ten builders and /complete-a-set.html, so folding
// 217 cards in would silently move all of them. They go to their own file,
// data/companion-prices.json, which only build-set-pages.mjs reads. It is not
// companion-sets.json itself either, which says in as many words that it is
// "not the place to put them": that file is identification and changes by
// hand; this one is money and changes nightly.
//
// HOW EACH SUBSET JOINS, AND IT IS NOT THE SAME FOR ALL THREE:
//
//   Shiny Vault         TCGdex "SV107"  against PriceCharting "#SV107"
//   Galarian Gallery    TCGdex "GG44"   against PriceCharting "#GG44"
//   Classic Collection  TCGdex "CC002"  against PriceCharting "#4"
//
// PriceCharting files the Classic Collection under the number the reprint
// PRINTS, which is its original's: Charizard is "#4" because the card says
// 4/102. TCGdex numbers the same 25 cards CC001 to CC025, which no card
// prints. The bridge is companion-sets.json's `printed` map, and the build
// re-checks every denominator in it against public/data/expansions.json.
//
// THE CLASSIC COLLECTION IS WHY THE NAME GUARD IS NOT OPTIONAL HERE. Number
// #15 on the Celebrations console is FIVE different cards: Lunala (the main
// set's own #15), Venusaur 15/102, Here Comes Team Rocket! 15/82, Rocket's
// Zapdos 15/132 and Claydol 15/106. #4 is Palkia (main set) and Charizard, and
// Charizard twice, once as [Ultra Premium Collection]. Only the name tells
// them apart, and only the allowlist keeps the $258 UPC Charizard off the
// pack one.

const COMP_OUT = join(ROOT, "data/companion-prices.json");
const compSets = JSON.parse(await readFile(join(ROOT, "data/companion-sets.json"), "utf8")).sets || {};

// The subsets' own checklists: name, number, rarity, straight out of the
// printings corpus (TCGdex, via sync-all-printings.mjs), the same rows
// companion-sets.json's count is checked against.
const corpus = [];
for (const f of await readdir(join(ROOT, "public/data/printings"))) {
  if (!/^[a-z0-9]\.json$/.test(f)) continue;
  for (const c of JSON.parse(await readFile(join(ROOT, "public/data/printings", f), "utf8"))) {
    if (c.l === "en") corpus.push(c);
  }
}

// ONE HAND ALIAS, AND IT IS A NAME, NOT A GUESS AT A CARD. TCGdex prints the
// Birthday Pikachu reprint's name the way the card does, "_____'s Pikachu",
// with the blank a child was meant to write their own name in. PriceCharting
// calls it "Pikachu Birthday". No rule could join those two strings and none
// should: this is keyed on the one card, checked by eye against the cached
// row ("Pikachu Birthday #24", the only Pikachu at #24 on that console).
const COMP_ALIAS = { "celebrations|CC008": "Pikachu Birthday" };

const STANDARD_PRINTINGS = new Set(["", "holo", "reverseholo", "reverse"]);
const compOut = {};
const compMiss = [];
let compCards = 0;
let compPriced = 0;

for (const [setId, meta] of Object.entries(compSets)) {
  const consolePath = CONSOLES[setId];
  const rows = bySet.get(setId);
  if (!consolePath || !rows) {
    compMiss.push(`${setId}: no console mapped, so none of its subset can be priced`);
    continue;
  }
  const subset = corpus
    .filter((c) => c.s === meta.corpusSet)
    .sort((a, b) => String(a.i).localeCompare(String(b.i), "en", { numeric: true }));
  if (subset.length !== meta.cards) {
    // The build fails on this too; say it here first, where it is cheaper.
    compMiss.push(`${setId}: the corpus holds ${subset.length} "${meta.corpusSet}" cards, companion-sets.json says ${meta.cards}`);
  }
  /* THE READ DATE IS THE OLDER OF TWO RECORDS, AND NEVER THE NEWER. The rest of
     this file borrows its date from data/price-rotation.json, which is the
     nightly's own record of when it fetched each console. That is the right
     record in the nightly. On any other machine it describes a crawl this
     machine did not make: the run that wrote this block had pages from 23
     September under a record saying 2 October. A file's mtime is the other
     record, and it is only ever too NEW (a copy resets it, nothing makes it
     older), so the earlier of the two can understate how fresh a price is and
     can never overstate it. In the nightly the two agree to the day. */
  const recorded = rot.refreshed?.[consolePath] || checked;
  const onDisk = oldestPage.has(consolePath) ? new Date(oldestPage.get(consolePath)).toISOString().slice(0, 10) : recorded;
  const entry = {
    console: consolePath,
    checked: [recorded, onDisk].sort()[0],
    total: subset.length,
    priced: 0,
    cards: {},
    missing: [],
  };
  for (const c of subset) {
    compCards += 1;
    const printed = meta.printed?.[c.i]?.no || null;
    // The number PriceCharting files it under: the subset's own for SV and GG,
    // the original's numerator for the Classic Collection.
    const pcNo = meta.printed ? (printed ? numKey(printed.split("/")[0]) : null) : numKey(c.i);
    const miss = (why) => {
      entry.missing.push({ n: c.i, name: c.n, why });
      compMiss.push(`${setId}/${c.i}  "${c.n}"  ${why}`);
    };
    if (!pcNo) {
      miss("no printed number on file in companion-sets.json");
      continue;
    }
    const cands = (rows.get(pcNo) || []).filter((x) => x.ungraded != null);
    if (!cands.length) {
      miss(`no PriceCharting row at #${pcNo}`);
      continue;
    }
    const want = COMP_ALIAS[`${setId}|${c.i}`] || c.n;
    const named = cands.filter((x) => nameAgrees(want, x.name));
    if (!named.length) {
      miss(`no row at #${pcNo} with this name (PriceCharting has ${cands.map((x) => `"${x.name}"`).join(", ")})`);
      continue;
    }
    // THE SAME ALLOWLIST AS THE 28 GUIDES, for the same $40.30 Bulbasaur
    // reason: a [Jumbo] or an [Ultra Premium Collection] copy is a different
    // product that happens to share a number.
    const std = named.filter((x) => STANDARD_PRINTINGS.has(norm(x.quals.join(" "))));
    if (!std.length) {
      miss(`only special printings at #${pcNo}: [${named.map((x) => x.quals.join(" ")).join("] [")}]`);
      continue;
    }
    // REFUSE RATHER THAN PICK. On the main checklists two standard rows at one
    // number are a card's normal and reverse holo and the dearer one is the
    // rule. These subsets print each card once, so two different PRODUCTS left
    // standing here means the guard above could not tell two cards apart, and
    // the honest answer to that is no price.
    if (new Set(std.map((x) => norm(x.name))).size > 1) {
      miss(`ambiguous at #${pcNo}: ${std.map((x) => `"${x.name}"`).join(", ")}`);
      continue;
    }
    const best = std.slice().sort((a, b) => b.ungraded - a.ungraded)[0];
    const all = {};
    for (const x of std) all[x.quals.length ? x.quals.join(" ") : "Base"] = x.ungraded;
    entry.cards[c.i] = {
      name: c.n,
      pcName: best.name,
      price: best.ungraded,
      variant: best.quals.length ? best.quals.join(" ") : "Base",
      all,
      psa10: best.psa10,
      g9: best.g9,
      url: best.url,
    };
    entry.priced += 1;
    compPriced += 1;
  }
  if (!entry.missing.length) delete entry.missing;
  compOut[setId] = entry;
}

const compDoc = {
  _readme: [
    "PriceCharting's Ungraded, Grade 9 and PSA 10 figures for the three subsets",
    "data/companion-sets.json lists: Shining Fates' Shiny Vault, Crown Zenith's",
    "Galarian Gallery and Celebrations' Classic Collection. Written by",
    "scripts/sync-pricecharting-cards.mjs (the block at its foot) off the same",
    "cached console pages, rows, allowlist and name guard as",
    "data/pricecharting-cards.json. NO NETWORK.",
    "",
    "READ ONLY BY scripts/build-set-pages.mjs, on purpose. These cards are not",
    "on any checklist in public/data/cards/, and companion-sets.json says why",
    "they must not be folded in. Keyed by the subset's TCGdex number (SV107,",
    "GG44, CC002); the number a card prints is the guide's business and comes",
    "from companion-sets.json.",
    "",
    "`checked` IS PER SUBSET and is the EARLIER of the nightly's record and the",
    "cached pages' own age, so a run off an older cache says so. A card that",
    "could not be matched exactly is listed under `missing` with the reason,",
    "and the guides print it with no price rather than a near miss.",
  ],
  source: "pricecharting.com",
  sourceMethodology: "https://www.pricecharting.com/page/methodology",
  measurement: "PriceCharting ungraded price guide value",
  scanned: { cards: compCards, priced: compPriced },
  sets: compOut,
};
if (!REPORT) {
  await writeFile(COMP_OUT, JSON.stringify(compDoc, null, 2) + "\n");
  console.log(`Wrote data/companion-prices.json`);
}
console.log(`  subset cards     ${compCards}`);
console.log(`  subset priced    ${compPriced}`);
for (const [id, e] of Object.entries(compOut)) console.log(`    ${id.padEnd(14)} ${e.priced}/${e.total}  read ${e.checked}`);
for (const m of compMiss) console.log(`    ${m}`);
