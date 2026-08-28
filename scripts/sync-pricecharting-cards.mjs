#!/usr/bin/env node
// PriceCharting's ungraded and graded figures for every card in every set guide.
//
//   node scripts/sync-pricecharting-cards.mjs           read the cache, write the file
//   node scripts/sync-pricecharting-cards.mjs --report  measure only, write nothing
//
// Writes data/pricecharting-cards.json. Then: node scripts/sync-cards.mjs, which
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
  newestCache = Math.max(newestCache, (await stat(join(CACHE, f))).mtimeMs);

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
  const entry = { console: consolePath, cards: {} };
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

if (!REPORT) {
  await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote data/pricecharting-cards.json`);
}
console.log(`  pages read       ${pages}  (from .cache, no network)`);
console.log(`  checklist cards  ${cards}`);
console.log(`  priced           ${priced}  ${((100 * priced) / cards).toFixed(2)}%`);
console.log(`  no row at that number  ${noRow}`);
console.log(`  name refused           ${refused}`);
for (const m of mismatches) console.log(`    ${m}`);
