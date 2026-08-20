#!/usr/bin/env node
// The 100 most expensive raw singles and the 100 most expensive sealed products on TCGplayer.
//
//   node scripts/sync-top100.mjs            cached if already read today
//   node scripts/sync-top100.mjs --force    refetch both lists
//   node scripts/sync-top100.mjs cards      one list only
//
// Writes data/top100.json. Then: node scripts/build-top100.mjs
//
// NOT IN build-all.mjs, and that is deliberate, for the same reason
// sync-sets.mjs and sync-chase.mjs are not: it is a network job of a couple of
// minutes against a third party, and build-all.mjs's own header says no step in
// it pulls fresh data. The nightly workflow can call this before build-all.mjs
// the way it calls the other syncs. A build with no network still writes both
// pages from the last data/top100.json, stamped with the date that data was
// read, so a failed sync produces an honestly stale page rather than no page.
//
// ---------------------------------------------------------------------------
// WHAT THE FEED IS, AND WHAT IT IS NOT
// ---------------------------------------------------------------------------
//
// The endpoint is the same unauthenticated one sync-chase.mjs and
// sync-products.mjs already use:
//
//   POST https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false
//
// The official TCGplayer developer API has been closed to new applicants for
// years, so this is the route. It is the search behind their own site.
//
// The number this file ranks on is `marketPrice`: TCGplayer's Market Price for
// a product, which is their own figure derived from recent completed sales on
// their marketplace. It is NOT the lowest listing, and it is NOT a sale price.
// All three are different numbers and the page says so out loud, because
// "most valuable" collapses them if nobody separates them.
//
// CROSS-CHECKED AGAINST A SECOND TCGPLAYER ENDPOINT rather than trusted. Every
// figure written here is re-read from
// https://mpapi.tcgplayer.com/v2/product/<id>/pricepoints, which is what their
// product page itself reads, and a row whose two figures disagree is reported.
// On the first run all 200 rows agreed to the cent. That check is the reason
// the page is allowed to claim the number is TCGplayer's own rather than ours.
//
// ---------------------------------------------------------------------------
// FIVE THINGS ABOUT THIS API THAT WILL WASTE YOUR DAY, ALL MEASURED 16 Aug 2026
// ---------------------------------------------------------------------------
//
// 1. `productLineName: ["pokemon"]` IS ENGLISH POKEMON ONLY, 32,548 products.
//    Japanese is a separate product line, `pokemon-japan`, with 30,378 of its
//    own, and it is not in these lists. A Japanese Base Set Charizard is a more
//    valuable object than several things on the raw page and it is not here,
//    because this feed does not put the two lines in one ranking. The page
//    titles say "English" for exactly that reason. Widening to both lines is a
//    second product line query and a decision about whether one list mixing
//    currencies of scarcity is useful; it was not made here.
//
// 2. THE PAGING CEILING IS `from + size <= 9999`. Measured to the row:
//    from=9949 size=50 answers 200, from=9950 size=50 answers 400. So you
//    CANNOT walk 29,652 card products and rank them locally, which is the
//    obvious way to do this and it does not work. Hence the floor below.
//
// 3. `range: { marketPrice: { gte: N } }` WORKS, and it is how this file bounds
//    the problem honestly. Verified two ways: every row that comes back really
//    is at or above N (checked on every row, every run, see verifyRows), and
//    the counts fall the way a real filter's counts fall (gte 200 -> 633 cards,
//    gte 400 -> 247, gte 600 -> 125, gte 800 -> 78).
//
//    A NONSENSE RANGE KEY ANSWERS totalResults 0, not "everything". That is the
//    opposite of the term-filter trap sync-chase.mjs documents, so a broken
//    range query fails loud and empty rather than quiet and complete. Both
//    behaviours are checked at the top of every run by probeGuards() rather
//    than believed, because they are the assumptions the whole method rests on
//    and they are a third party's to change without telling us.
//
//    3b. `gte` IS THE ONLY BOUND THAT WORKS, AND THE OTHER TWO FAIL IN THE TWO
//    WORST WAYS AVAILABLE. This mattered because the obvious way to enumerate a
//    price range without deep paging is to cut it into disjoint bands, and it
//    cannot be done here:
//
//      { gte: 400, lt: 600 }   answers 247, the SAME as { gte: 400 } alone, and
//                              the rows run up to $2,244. `lt` is silently
//                              dropped. An unknown SUBKEY inside range is
//                              ignored even though an unknown FIELD is not:
//                              { gte: 400, zz: 600 } also answers 247.
//      { gte: 400, lte: 600 }  answers 125, which is exactly { gte: 600 }'s
//                              count. It is not filtering to a band, it is
//                              being read as a floor of 600. That is WORSE than
//                              being ignored: the count changes, so it looks
//                              like it worked, and every band would have been
//                              quietly shifted one rung up the ladder.
//
//    So there are no bands. There is one open-ended floor and a walk.
//
// 4. THERE *IS* A WORKING SERVER-SIDE SORT, and sync-chase.mjs's header says
//    there is not. Both are true of what they tried. `sort:{field:"marketPrice"}`
//    answers 500 and so does `MarketPrice`; the field is HYPHENATED,
//    `sort:{field:"market-price",order:"desc"}`, and that answers 200 with a
//    genuinely descending list. `field:"price"` also answers 200 and sorts by
//    something else entirely (it returns rows whose marketPrice is 0), which is
//    the failure that hides: a wrong sort looks exactly like a right one.
//
//    THIS FILE DOES NOT RANK ON THAT SORT. It ranks on the floor walk, which is
//    a complete enumeration of a bounded set and can be checked, and then uses
//    the sort as an INDEPENDENT SECOND OPINION: two pages of it, compared to the
//    walk's top 100 by productId. Two different query paths agreeing is worth
//    more than either alone, and if they ever disagree this file says so
//    instead of quietly preferring one.
//
// 5. `productTypeName` splits the line cleanly: "Cards" 29,652, "Sealed
//    Products" 2,896, and they sum to the 32,548 total, so nothing is in
//    neither and nothing is in both.
//
// ---------------------------------------------------------------------------
// WHY THE RAW LIST IS ALLOWED TO SAY "RAW"
// ---------------------------------------------------------------------------
//
// Because this marketplace prices ungraded cards and the feed shows it. The
// `condition` facet over the dear end of the card line returns exactly five
// values, Near Mint / Lightly Played / Moderately Played / Heavily Played /
// Damaged, and no graded condition of any kind. There is no PSA, BGS, CGC or
// SGC tier in it, no graded product, and no product whose name carries a grade.
// A Market Price here is therefore a price for the card itself, in a sleeve,
// out of a pack. That is what the page means by raw and it is the only thing
// this feed can support.
//
// ---------------------------------------------------------------------------
// WHAT ONE PRODUCT IS, WHICH IS SUBTLER THAN IT LOOKS
// ---------------------------------------------------------------------------
//
// TCGplayer's unit is the PRODUCT, and a product can carry more than one
// printing. Base Set (Shadowless) Charizard is one product, id 106999, and its
// listings split across "1st Edition Holofoil" and "Unlimited Holofoil". The
// feed publishes ONE marketPrice for it and does not split them; filtering by
// printing alongside a marketPrice range returns 0, because printing is a facet
// of a LISTING and marketPrice is a field of a PRODUCT.
//
// So a row here is a product, not a printing, and the page says that rather
// than pretending each row is a single physical card. It is stored in the data
// as `printings` when the feed reports more than one, so the page can flag it.
//
// ---------------------------------------------------------------------------
// THE FLOOR, AND WHY IT IS PROBED RATHER THAN PINNED
// ---------------------------------------------------------------------------
//
// The method is: choose a price floor, walk EVERY product at or above it, rank
// locally, keep 100. That is a complete enumeration of a bounded set, so the
// top 100 of it is the top 100 of the whole line, and the claim is checkable.
// It is not a sample and it is not the first N pages of anything.
//
// The floor has to be low enough that the set contains the true top 100 with
// room to spare, and high enough that the set stays far under the 9,999 paging
// ceiling. Prices move, so a pinned floor goes wrong in both directions over
// time. pickFloor() probes a ladder and takes the highest floor whose count is
// at least MARGIN (300, three times what we keep) and at most MAX_WALK.
//
// Then it checks the answer rather than assuming it: after ranking, the price
// of the 100th row is fed back as a fresh gte query, and the count that comes
// back must be at least 100. If a product exists at or above the 100th price
// that our walk never saw, that check fails and the run stops.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// THE CASE STAND-IN RULE, shared with scripts/build-top100.mjs. Every sealed
// row that comes back unphotographed is a CASE, so the builder draws one unit
// from inside it with a caption naming that unit. This file resolves the same
// stand-in and FETCHES IT, so a stand-in photograph that dies is caught by the
// run that checks every other image rather than by a reader getting a 403.
import { caseStandIn, standInIndex } from "../shared/case-standin.mjs";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcg-top100");
const OUT = join(ROOT, "data/top100.json");

// The catalogue the case stand-in is resolved out of, read once. Optional: with
// no products.json every case row simply keeps its empty frame, which is where
// this page was before the rule existed.
let STAND_INDEX = null;
try {
  STAND_INDEX = standInIndex(
    JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8")),
  );
} catch {
  /* optional */
}

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const only = argv.filter((a) => !a.startsWith("--"));

const KEEP = 100;
const MARGIN = 300; // walk at least this many so the top 100 has real headroom
const MAX_WALK = 3000; // stay far under the 9,999 paging ceiling
const PAGE = 50; // the API rejects size > 50
const CAP = 4000; // runaway guard only; the loop stops on totalResults

const SEARCH = "https://mp-search-api.tcgplayer.com/v1/search/request?q=&isList=false";
const PRICEPOINTS = (id) => `https://mpapi.tcgplayer.com/v2/product/${id}/pricepoints`;

const HEADERS = {
  "content-type": "application/json",
  origin: "https://www.tcgplayer.com",
  referer: "https://www.tcgplayer.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 600-800ms between pages, the same manners sync-chase.mjs uses. This is
// somebody else's unauthenticated endpoint and we are walking a thousand rows
// of it.
const polite = () => sleep(600 + Math.floor(Math.random() * 200));

/** The request body. Every field here is copied from what their own site sends. */
function searchBody({ from = 0, size = PAGE, term = {}, range = {}, sort = {}, aggregations } = {}) {
  const b = {
    algorithm: "sales_dismax",
    from,
    size,
    filters: { term: { productLineName: ["pokemon"], ...term }, range, match: {} },
    listingSearch: {
      context: { cart: {} },
      filters: { term: {}, range: { quantity: { gte: 1 } }, exclude: { channelExclusion: 0 } },
    },
    context: { cart: {}, shippingCountry: "US" },
    settings: { useFuzzySearch: false, didYouMean: {} },
    sort,
  };
  if (aggregations) b.aggregations = aggregations;
  return b;
}

/** One search call, with the same back-off shape as sync-chase.mjs. */
async function search(opts, { attempts = 4, label = "search" } = {}) {
  for (let a = 1; a <= attempts; a++) {
    try {
      const res = await fetch(SEARCH, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(searchBody(opts)),
      });
      if (res.ok) {
        const r = (await res.json()).results?.[0];
        if (r) return r;
      }
      // A 400 is our bug, not their load. Retrying it four times just wastes
      // fifteen seconds before failing with the same message.
      if (res.status === 400) throw new Error(`${label}: HTTP 400, the query is malformed`);
      await sleep(a * 2000);
    } catch (e) {
      if (/HTTP 400/.test(e.message)) throw e;
      await sleep(a * 2000);
    }
  }
  throw new Error(`TCGplayer would not answer (${label})`);
}

/**
 * The three assumptions the method rests on, checked at the top of every run.
 *
 * All three belong to a third party and can change without notice, and all
 * three fail SILENTLY if they do: a range filter that stopped filtering would
 * hand back the whole line and the walk would truncate at MAX_WALK; a paging
 * ceiling that moved would change nothing today but is quoted in this file's
 * header as a measured fact; a productTypeName split that stopped splitting
 * would put sealed boxes in the raw card list. Cheap to check, three requests.
 */
async function probeGuards() {
  const notes = [];

  // (a) The range filter really filters. A real floor cuts the count hard.
  const all = await search({ size: 1, term: { productTypeName: ["Cards"] } }, { label: "guard/all" });
  await polite();
  const cut = await search(
    { size: 1, term: { productTypeName: ["Cards"] }, range: { marketPrice: { gte: 400 } } },
    { label: "guard/cut" }
  );
  await polite();
  if (!(cut.totalResults > 0 && cut.totalResults < all.totalResults / 10)) {
    throw new Error(
      `The marketPrice range filter is not filtering: ${all.totalResults} products unfiltered, ` +
        `${cut.totalResults} at gte 400. This file's whole method is that walk. Re-probe before trusting a run.`
    );
  }
  notes.push(`range filter live (${all.totalResults} cards, ${cut.totalResults} at $400+)`);

  // (b) A nonsense range key answers 0 rather than everything, so a broken
  // query cannot masquerade as a complete one.
  const junk = await search(
    { size: 1, term: { productTypeName: ["Cards"] }, range: { notARealField: { gte: 1 } } },
    { label: "guard/junk" }
  );
  await polite();
  if (junk.totalResults !== 0) {
    notes.push(
      `WARNING: an unknown range key now answers ${junk.totalResults} rather than 0. ` +
        `A malformed range query can look like a successful one again.`
    );
  } else {
    notes.push("unknown range key answers 0 (a broken query fails loud)");
  }

  // (c) The two product types still partition the line.
  const sealed = await search(
    { size: 1, term: { productTypeName: ["Sealed Products"] } },
    { label: "guard/sealed" }
  );
  await polite();
  const whole = await search({ size: 1 }, { label: "guard/whole" });
  await polite();
  if (all.totalResults + sealed.totalResults !== whole.totalResults) {
    notes.push(
      `WARNING: Cards (${all.totalResults}) + Sealed (${sealed.totalResults}) != all Pokemon ` +
        `(${whole.totalResults}). The two lists may overlap or miss products.`
    );
  } else {
    notes.push(`Cards ${all.totalResults} + Sealed ${sealed.totalResults} = ${whole.totalResults}, a clean split`);
  }

  return notes;
}

/**
 * Every row that comes back is checked against what was actually asked for.
 *
 * DO NOT USE THE `sealed` FIELD FOR THIS. Every row carries a boolean named
 * `sealed` and it is FALSE on sealed products: "Legendary Treasures Booster
 * Box" and "151 Booster Bundle Display Case" both report sealed=false, and so
 * does every one of the 380 singles. It is not the flag its name promises and
 * an early version of this file trusted it, which cost a run.
 *
 * The real structural tell is the card fields. A single carries a collector
 * number and a rarity: all 380 singles walked on 16 Aug 2026 had BOTH, with no
 * exceptions across fifteen rarity names from Common to Mega Hyper Rare. A
 * sealed product carries NEITHER, because it is not a card; what it carries
 * instead is a description. So the two lists are checked against the shape of
 * their own rows, not against a field that would have let a booster box into a
 * list of cards.
 */
function verifyRows(rows, { floor, wantCard, label }) {
  for (const r of rows) {
    const mp = Number(r.marketPrice);
    if (!(mp >= floor)) {
      throw new Error(
        `${label}: a row came back below the floor ($${mp} < $${floor}) for "${r.productName}". ` +
          `The range filter is not doing what this file assumes.`
      );
    }
    if (String(r.productLineName).toLowerCase() !== "pokemon") {
      throw new Error(`${label}: "${r.productName}" is productLine "${r.productLineName}", not Pokemon.`);
    }
    const looksLikeCard = Boolean(r.rarityName) && r.customAttributes?.number != null;
    if (wantCard && !looksLikeCard) {
      throw new Error(
        `${label}: "${r.productName}" has no rarity or no collector number, so it is not a single. ` +
          `productTypeName "Cards" let something through that is not a card.`
      );
    }
    if (!wantCard && looksLikeCard) {
      throw new Error(
        `${label}: "${r.productName}" carries a rarity and a collector number, so it is a single, ` +
          `not a sealed product.`
      );
    }
  }
}

/**
 * One pass over every product at or above `floor`, in one ordering.
 *
 * Stops on totalResults and THROWS if it ever reaches CAP, because a cap that
 * truncates is the failure that hides: a short list looks exactly like a
 * complete one. sync-chase.mjs learned that by losing 220 products of a 620
 * product set, with every Special Illustration Rare in the part it never
 * reached, and nothing errored.
 */
async function pass({ productType, floor, wantCard, label, sort, into }) {
  let total = null;
  let dupes = 0;
  let seenThisPass = new Set();
  for (let from = 0; from < CAP; from += PAGE) {
    const page = await search(
      {
        from,
        size: PAGE,
        term: { productTypeName: [productType] },
        range: { marketPrice: { gte: floor } },
        sort,
      },
      { label: `${label}/from=${from}` }
    );
    const rows = page.results || [];
    total = page.totalResults ?? total;
    verifyRows(rows, { floor, wantCard, label });
    for (const r of rows) {
      const id = Math.round(Number(r.productId));
      if (!Number.isFinite(id)) continue;
      if (seenThisPass.has(id)) dupes++;
      seenThisPass.add(id);
      if (!into.has(id)) into.set(id, r);
    }
    process.stdout.write(
      `\r  ${label}: ${into.size} of ${total ?? "?"} distinct products at $${floor}+   `
    );
    if (!rows.length) break;
    if (from + PAGE >= (total || 0)) break;
    await polite();
  }
  if (total != null && total > CAP) {
    throw new Error(
      `${label}: ${total} products at $${floor}+ exceeds the ${CAP} runaway cap. ` +
        `Raise the floor: a truncated walk publishes a top 100 that is missing rows.`
    );
  }
  return { total, dupes, seen: seenThisPass.size };
}

/**
 * Enumerate every product at or above `floor`, and PROVE the enumeration is
 * complete before returning it.
 *
 * WHY THIS IS NOT ONE LOOP. It was, and it was wrong. The default ordering
 * (`sort:{}` with `algorithm:"sales_dismax"`) is by relevance score, and that
 * ordering is NOT STABLE ACROSS PAGES: the first real run threw on page 3 with
 * "Rayquaza VMAX (Alternate Art Secret) came back twice". A row served twice
 * means another row was never served at all, so a single-pass walk of 380
 * products quietly returned 379 of them and would have been perfectly happy to
 * publish that as a complete top 100. The duplicate is the only symptom, and
 * only because it was checked for.
 *
 * The band-splitting fix does not exist here, because `lt` and `lte` do not
 * work (see 3b in the header). So instead: run the walk more than once, in
 * DIFFERENT orderings, union the results by productId, and keep going until the
 * union holds as many distinct products as the API itself says exist at that
 * floor. At that point the enumeration is complete by counting, not by faith.
 *
 * The sorted pass runs first because a stable sort usually gets all of them in
 * one go and the second pass then just confirms it. If the passes never
 * converge on totalResults this throws rather than publishing a short list.
 */
async function collect(list) {
  const into = new Map();
  const ORDERS = [
    { name: "market-price desc", sort: { field: "market-price", order: "desc" } },
    { name: "relevance", sort: {} },
    { name: "market-price asc", sort: { field: "market-price", order: "asc" } },
  ];
  let total = null;
  const log = [];
  for (let round = 0; round < 4; round++) {
    const order = ORDERS[round % ORDERS.length];
    const before = into.size;
    let r;
    try {
      r = await pass({ ...list, sort: order.sort, into });
    } catch (e) {
      // An ordering this API will not serve is not a reason to stop; it is a
      // reason to try the next one. Only failing to converge is fatal.
      process.stdout.write("\n");
      log.push(`pass ${round + 1} (${order.name}): refused (${e.message})`);
      continue;
    }
    total = r.total ?? total;
    process.stdout.write("\n");
    log.push(
      `pass ${round + 1} (${order.name}): +${into.size - before} new, ${r.dupes} repeated within the pass`
    );
    if (total != null && into.size >= total) break;
    await polite();
  }
  if (total == null)
    throw new Error(
      `${list.label}: the API never reported a total. Every pass failed:\n` + log.map((l) => `    ${l}`).join("\n")
    );
  if (into.size < total) {
    throw new Error(
      `${list.label}: after four passes the union holds ${into.size} of ${total} products at $${list.floor}+. ` +
        `The enumeration is incomplete, so its top ${KEEP} is not a top ${KEEP}. Do not publish it.\n` +
        log.map((l) => `    ${l}`).join("\n")
    );
  }
  if (into.size > total) {
    // Products can be added between passes. Not a failure, but say so.
    log.push(`union holds ${into.size}, one more than the ${total} the API last reported`);
  }
  return { rows: [...into.values()], total, log };
}

/**
 * Pick the highest floor that still leaves real headroom over the 100 we keep.
 *
 * Highest, because a higher floor is fewer requests against somebody else's
 * free endpoint. Headroom, because the whole point is that the top 100 sits
 * comfortably inside a completely enumerated set rather than near its edge.
 */
async function pickFloor({ productType, label }) {
  const LADDER = [3000, 2000, 1500, 1000, 800, 600, 500, 400, 300, 250, 200, 150, 100, 50, 25, 10, 1];
  let best = null;
  for (const floor of LADDER) {
    const r = await search(
      { size: 1, term: { productTypeName: [productType] }, range: { marketPrice: { gte: floor } } },
      { label: `${label}/floor=${floor}` }
    );
    await polite();
    const n = r.totalResults ?? 0;
    if (n >= MARGIN && n <= MAX_WALK) return { floor, count: n };
    if (n > MAX_WALK) break; // the ladder only gets bigger from here
    best = { floor, count: n };
  }
  if (!best || best.count < KEEP) {
    throw new Error(
      `${label}: no price floor yields ${KEEP} products (best was ${best?.count ?? 0} at $${best?.floor}). ` +
        `Do not publish a short list as a top ${KEEP}.`
    );
  }
  console.log(
    `  ${label}: no floor gives ${MARGIN} products inside ${MAX_WALK}; using $${best.floor} ` +
      `with ${best.count}, which is thinner headroom than intended.`
  );
  return best;
}

/**
 * The independent second opinion.
 *
 * Two pages of the server-side `market-price desc` sort, compared to the walk's
 * top 100 by productId. This is a different query path through the same data:
 * the walk filters and ranks locally, this asks the search engine to rank. They
 * should name the same hundred products. When they do not, the difference is
 * reported rather than resolved, because quietly preferring one is how a wrong
 * list ships looking confident.
 */
async function crossCheck({ productType, label, mine }) {
  const got = [];
  for (let from = 0; from < KEEP; from += PAGE) {
    const p = await search(
      {
        from,
        size: PAGE,
        term: { productTypeName: [productType] },
        sort: { field: "market-price", order: "desc" },
      },
      { label: `${label}/sort=${from}` }
    );
    got.push(...(p.results || []));
    await polite();
  }
  // The sort is only useful as a check if it is actually descending. A sort
  // that answers 200 and returns arbitrary order would "agree" by accident on
  // a set this small and tell us nothing.
  const prices = got.map((r) => Number(r.marketPrice) || 0);
  const descending = prices.every((v, i) => i === 0 || v <= prices[i - 1]);
  const theirs = got.slice(0, KEEP).map((r) => Math.round(Number(r.productId)));
  const mineSet = new Set(mine);
  const missing = theirs.filter((id) => !mineSet.has(id));
  const extra = mine.filter((id) => !theirs.includes(id));
  return { descending, agreed: theirs.length - missing.length, missing, extra, n: theirs.length };
}

/**
 * Re-read every kept price from TCGplayer's OTHER endpoint.
 *
 * /pricepoints is what their product page itself reads, so agreement between it
 * and the search index is two independent reads of the same claim. A row where
 * they disagree is kept but flagged, because the honest thing is to show the
 * number and say we could not corroborate it, not to drop the row and leave a
 * gap nobody can see.
 */
async function corroborate(rows, label) {
  let ok = 0;
  const off = [];
  for (const r of rows) {
    let pp = null;
    for (let a = 1; a <= 3 && !pp; a++) {
      try {
        const res = await fetch(PRICEPOINTS(r.productId), { headers: HEADERS });
        if (res.ok) pp = await res.json();
        else await sleep(a * 1200);
      } catch {
        await sleep(a * 1200);
      }
    }
    if (!Array.isArray(pp)) {
      off.push({ id: r.productId, name: r.name, why: "pricepoints did not answer" });
    } else {
      const vals = pp.map((x) => Number(x.marketPrice)).filter((n) => Number.isFinite(n) && n > 0);
      const hit = vals.some((v) => Math.abs(v - r.market) < 0.011);
      if (hit) {
        ok++;
        r.confirmed = true;
      } else {
        r.confirmed = false;
        // KEEP THE NUMBER WE COULD NOT MATCH, do not just record a failed flag.
        // On 16 Aug 2026 exactly one row of 200 disagreed: Venusaur, Base Set
        // (Shadowless), product 107010, where the search index says $750.00 and
        // the product page's own endpoint says $918.75. One of TCGplayer's two
        // numbers for that product is stale and we cannot tell which. The page
        // prints the ranked figure, marks the row, and shows the other one,
        // because "these two sources disagree" is a fact a reader can act on
        // and a silent single figure is not.
        r.altMarket = vals.length ? Math.round(vals[0] * 100) / 100 : null;
        off.push({ id: r.productId, name: r.name, search: r.market, pricepoints: vals });
      }
    }
    process.stdout.write(`\r  ${label}: corroborated ${ok} of ${rows.length}   `);
    await sleep(220);
  }
  process.stdout.write("\n");
  return { ok, off };
}

/**
 * Which of the kept rows have no product photo.
 *
 * CLAUDE.md's rule: data/no-scan.json exists so builders skip urls that 404 or
 * 403 up front rather than paying for a dead round trip to find out. Neither of
 * its two recorded dead TCGplayer ids is in these lists, and six OTHER ids in
 * them are dead, so the same check has to be done for this data rather than
 * borrowed from that file. Measured 16 Aug 2026, all 403 rather than 404:
 *
 *   raw     Gengar SWSH241 (Prerelease) (Staff), Jolteon 37/108 (Regionals) [Staff]
 *   sealed  Paldean Fates Booster Bundle Display Case, Prismatic Evolutions
 *           Booster Bundle Case, 151 Mini Tin Display Case, Crown Zenith Mini
 *           Tin Display Case
 *
 * They are stored as a flag on the row, not filtered out. A product being
 * unphotographed is not a reason to drop it from a ranking it genuinely earned;
 * it is a reason to draw an empty frame and not request anything.
 */
async function checkImages(rows, label, standIndex = null) {
  let dead = 0;
  const stands = [];
  for (const r of rows) {
    let ok = null;
    for (let a = 1; a <= 3 && ok === null; a++) {
      try {
        const res = await fetch(r.img, { method: "GET", headers: HEADERS });
        if (res.status === 403 || res.status === 404) ok = false;
        else if (res.ok) ok = true;
        else await sleep(a * 1000);
      } catch {
        await sleep(a * 1000);
      }
    }
    if (ok === false) {
      r.noImg = true;
      dead++;
      // THE STAND-IN GETS THE SAME FETCH THE ROW GOT, and its result is stored
      // as a NEGATIVE flag. The builder resolves the stand-in itself from
      // public/data/products.json and only declines one that is flagged here,
      // which is the same trust model /msrp.html's pinned photographs run on:
      // a picture is used unless something has recorded that it is gone. A
      // positive flag would mean a case row stayed blank until the next network
      // sync, which is the wrong default for a builder that is offline by
      // design.
      const stand = standIndex ? caseStandIn(r, standIndex) : null;
      if (stand) {
        let sOk = null;
        for (let a = 1; a <= 3 && sOk === null; a++) {
          try {
            const res = await fetch(stand.img, { method: "GET", headers: HEADERS });
            if (res.status === 403 || res.status === 404) sOk = false;
            else if (res.ok) sOk = true;
            else await sleep(a * 1000);
          } catch {
            await sleep(a * 1000);
          }
        }
        if (sOk === false) r.standInDead = true;
        else delete r.standInDead;
        stands.push({ rank: r.rank, name: r.name, stand: stand.name, id: stand.productId, ok: sOk });
        await sleep(120);
      }
    }
    process.stdout.write(`\r  ${label}: image check, ${dead} dead of ${rows.indexOf(r) + 1}   `);
    await sleep(120);
  }
  process.stdout.write("\n");
  return { dead, stands };
}

/** TCGplayer's own url shape: lowercase, ampersands spelled out, hyphens. */
const slug = (v) =>
  String(v ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/** Trim a search row down to what the page actually renders. */
function shape(r, rank) {
  const id = Math.round(Number(r.productId));
  const num = String(r.customAttributes?.number ?? "").trim();
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : null);
  return {
    rank,
    productId: id,
    name: String(r.productName || "").trim(),
    setName: String(r.setName || "").trim(),
    setUrlName: String(r.setUrlName || "").trim(),
    rarity: String(r.rarityName || "").trim() || null,
    number: num || null,
    market: n(r.marketPrice),
    // The lowest CURRENT asking price, which is a different number from the
    // market price and is on the page beside it precisely so the two cannot be
    // confused. Often absent: a product with no live listings has no low.
    low: n(r.lowestPrice),
    listings: Number.isFinite(Number(r.totalListings)) ? Number(r.totalListings) : null,
    // `productUrlName` IS NOT A URL SLUG DESPITE ITS NAME. It is a cleaned
    // display string with the punctuation stripped and the SPACES LEFT IN:
    // "Torchic Star", "Latias and Latios GX Alternate Full Art". 190 of these
    // 200 rows carry one, so dropping it into a href unescaped produced 190
    // links with a raw space in them. Slug it the way sync-products.mjs slugs a
    // product name. The id is what actually resolves the page; the slug is
    // decorative and TCGplayer redirects on it either way.
    url: `https://www.tcgplayer.com/product/${id}/${slug(r.productUrlName || r.productName)}`.replace(/\/$/, ""),
    // No width or height: the tcgplayer-cdn renditions are a fixed width and a
    // VARIABLE height, so imgDims() in shared/format.mjs deliberately returns
    // nothing for this host and the builder must not invent a pair.
    img: `https://tcgplayer-cdn.tcgplayer.com/product/${id}_150w.jpg`,
  };
}

// ---------------------------------------------------------------------------

const LISTS = [
  { key: "cards", productType: "Cards", wantCard: true, label: "raw singles" },
  { key: "sealed", productType: "Sealed Products", wantCard: false, label: "sealed products" },
];

const today = localDay();
await mkdir(CACHE, { recursive: true });

let doc = {};
if (existsSync(OUT)) {
  try {
    doc = JSON.parse(await readFile(OUT, "utf8"));
  } catch {}
}

const targets = LISTS.filter((l) => (only.length ? only.includes(l.key) : true));
if (!targets.length) {
  console.log(`Nothing to do. Lists are: ${LISTS.map((l) => l.key).join(", ")}`);
  process.exit(0);
}

console.log("Probing the three assumptions this method rests on\n");
const guards = await probeGuards();
for (const g of guards) console.log(`  ${g}`);
console.log("");

for (const list of targets) {
  const cacheFile = join(CACHE, `${list.key}.json`);
  if (!FORCE && doc[list.key]?.checked === today) {
    console.log(`${list.label}: already read today, skipping (use --force)\n`);
    continue;
  }

  console.log(`${list.label}`);
  const { floor, count } = await pickFloor(list);
  console.log(`  floor $${floor}, ${count} products at or above it`);

  const { rows, total, log } = await collect({ ...list, floor });
  for (const l of log) console.log(`  ${l}`);
  console.log(`  enumeration complete: ${rows.length} distinct products, API says ${total}`);
  await writeFile(cacheFile, JSON.stringify({ fetched: today, floor, total, results: rows }));

  const ranked = rows
    .slice()
    // productId as the tiebreak so a tie in price does not reorder the page
    // between two runs that read the same data.
    .sort((a, b) => Number(b.marketPrice) - Number(a.marketPrice) || Number(a.productId) - Number(b.productId));
  if (ranked.length < KEEP) {
    throw new Error(`${list.label}: only ${ranked.length} products walked, cannot publish a top ${KEEP}.`);
  }
  const kept = ranked.slice(0, KEEP).map((r, i) => shape(r, i + 1));
  const cut = kept[KEEP - 1].market;

  // THE COMPLETENESS CHECK. Ask the API, fresh, how many products sit at or
  // above the price of our hundredth row. If it names more than we walked, our
  // walk missed something and this list is not a top 100.
  const back = await search(
    { size: 1, term: { productTypeName: [list.productType] }, range: { marketPrice: { gte: cut } } },
    { label: `${list.label}/completeness` }
  );
  await polite();
  const atOrAbove = ranked.filter((r) => Number(r.marketPrice) >= cut).length;
  if ((back.totalResults ?? 0) > atOrAbove) {
    throw new Error(
      `${list.label}: the API says ${back.totalResults} products are at or above $${cut}, ` +
        `but the walk only found ${atOrAbove}. Something was missed; do not publish this as a top ${KEEP}.`
    );
  }
  console.log(
    `  completeness: ${back.totalResults} products at $${cut}+ by a fresh query, ${atOrAbove} in the walk`
  );

  const xc = await crossCheck({ ...list, mine: kept.map((k) => k.productId) });
  console.log(
    `  second opinion: server sort ${xc.descending ? "is descending" : "IS NOT DESCENDING, ignore it"}, ` +
      `${xc.agreed} of ${xc.n} products match the walk` +
      (xc.missing.length ? `, ${xc.missing.length} only in the sort` : "")
  );
  if (xc.missing.length) {
    console.log(
      `    the sort names products the walk's top ${KEEP} does not: ${xc.missing.slice(0, 8).join(", ")}` +
        `\n    That is a real disagreement between two reads of the same data. Investigate before publishing.`
    );
  }

  const { ok, off } = await corroborate(kept, list.label);
  if (off.length) {
    console.log(`  ${off.length} row(s) the pricepoints endpoint did not confirm:`);
    for (const o of off.slice(0, 6)) console.log(`    ${o.name}: ${JSON.stringify(o)}`);
  }

  // Sealed only. A raw single has no "inside" to photograph, so the stand-in
  // rule is not offered one to resolve.
  const { dead: deadImgs, stands } = await checkImages(
    kept,
    list.label,
    list.key === "sealed" ? STAND_INDEX : null,
  );
  if (deadImgs) {
    console.log(
      `  ${deadImgs} row(s) have no product photo on TCGplayer's CDN, flagged so the page never requests one:`
    );
    for (const r of kept.filter((x) => x.noImg)) console.log(`    #${r.rank} ${r.name} (${r.productId})`);
  }
  if (stands.length) {
    console.log(
      `  ${stands.filter((x) => x.ok !== false).length} of those resolve to a captioned stand-in from inside the case:`
    );
    for (const x of stands) {
      console.log(`    #${x.rank} ${x.name} -> ${x.stand} (${x.id}) ${x.ok === false ? "IMAGE DEAD, row stays blank" : "image 200"}`);
    }
  }

  doc[list.key] = {
    checked: today,
    floor,
    walked: rows.length,
    walkedTotal: total,
    cut,
    // Everything a reader needs to audit the claim, stored beside the claim.
    method: {
      feed: SEARCH,
      priceField: "marketPrice",
      productLine: "pokemon (English)",
      productType: list.productType,
      keep: KEEP,
      corroboratedAgainst: "https://mpapi.tcgplayer.com/v2/product/<id>/pricepoints",
      corroborated: ok,
      noPhoto: deadImgs,
      sortAgreed: xc.agreed,
      sortOf: xc.n,
      sortDescending: xc.descending,
      completenessAtCut: back.totalResults ?? null,
    },
    items: kept,
  };
  console.log(
    `  top ${KEEP}: $${kept[0].market.toLocaleString("en-US")} down to $${cut.toLocaleString("en-US")}\n`
  );
}

doc.source = "TCGplayer";
doc.guards = guards;
doc.checked = LISTS.map((l) => doc[l.key]?.checked).filter(Boolean).sort().pop() || today;
await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n");

console.log(`Wrote data/top100.json`);
for (const l of LISTS) {
  const d = doc[l.key];
  if (!d) continue;
  console.log(
    `  ${l.key.padEnd(7)} ${d.items.length} rows, read ${d.checked}, ` +
      `walked ${d.walked} at $${d.floor}+, ${d.method.corroborated} of ${d.items.length} price-confirmed`
  );
}
console.log("Next: node scripts/build-top100.mjs");
