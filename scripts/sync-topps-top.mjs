#!/usr/bin/env node
// The Topps Pokemon corpus: every Topps set PriceCharting holds, and the two
// rankings /topps-card-values.html publishes.
//
//   node scripts/sync-topps-top.mjs            read the cache, write the file
//   node scripts/sync-topps-top.mjs --report   measure only, write nothing
//
// Writes data/topps-top.json, which /topps.html and /topps-card-values.html are
// both built from. Then: node scripts/verify-topps-top.mjs, which re-reads every
// candidate figure from the card's own product page. Both builds REFUSE to run
// without that second read; see shared/graded-gate.mjs for why.
//
// ---------------------------------------------------------------------------
// THIS SCRIPT MAKES NO NETWORK REQUESTS AND MUST NOT BE GIVEN ANY
// ---------------------------------------------------------------------------
//
// Same rule, same reason, as scripts/sync-raw-top.mjs and
// scripts/sync-pricecharting-cards.mjs: every figure it ranks is parsed out of
// .cache/pricecharting-console/, which scripts/sync-graded-top.mjs already
// filled. The console listing carries Ungraded, Grade 9 and PSA 10 SIDE BY SIDE
// on one row, so the raw ranking and the graded ranking come off exactly the
// same bytes and a Topps crawl would be asking somebody else's server for pages
// we already hold.
//
// For fresher numbers: `node scripts/sync-graded-top.mjs --refresh`, then this,
// then the verifier. Do not add a fetch here.
//
// ---------------------------------------------------------------------------
// WHY TOPPS IS A PAGE AT ALL, AND WHAT MAKES THE CLAIM AN HONEST ONE
// ---------------------------------------------------------------------------
//
// The owner, 18 August 2026: "the company Topps made their own sets of Pokemon cards
// back in the day ... not many collectors know about the Topps cards, and most
// don't realize how valuable they are as well".
//
// The second half of that is checkable against our own data rather than taken
// on faith, which is the only reason it may be said on a page: THIRTEEN of the
// hundred rows on /most-valuable-cards.html are already Topps cards, counted by
// scripts/build-top100.mjs off the published list. A reader who has never heard
// of Topps Pokemon cards has already walked past thirteen of them on this site.
//
// ---------------------------------------------------------------------------
// WHICH CONSOLES ARE TOPPS, AND WHY THE TEST IS THE URL AND NOT THE SET NAME
// ---------------------------------------------------------------------------
//
// PriceCharting's console PATH is matched, not its title. The title comes out
// of a <title> tag this repo already parses loosely, and a name test would have
// to survive "Topps Chrome" against "Chrome" and the Topps Gallery / Topps
// Heritage sets of other franchises sitting in the same sitemap. The path
// `/console/pokemon-*topps*` is both narrower and stable, and every console it
// selects is printed by this script so the selection can be read rather than
// trusted.
//
// THE COLUMN CONTRACT IS ENFORCED ON THE WAY IN, exactly as sync-graded-top.mjs
// and sync-raw-top.mjs enforce it: a cached page whose header row is not
// CONSOLE_HEADERS is skipped and counted, never read positionally. That guard is
// what kept `/console/pokemon-mini`, a handheld games console, out of a list of
// card values, and it is not relaxed here.
//
// ---------------------------------------------------------------------------
// TWO RANKINGS OFF ONE CORPUS, AND THE UNION IS WHAT GETS VERIFIED
// ---------------------------------------------------------------------------
//
// The owner asked for "top 100 cards raw and graded values". Those are two different
// orders over one set of rows: the most expensive raw Topps card is not the most expensive
// PSA 10 Topps card and they are not close. So this file writes ONE `cards`
// array, the UNION of both candidate windows, each row carrying a stable
// `rank` which is its position in that union and nothing else. `rawOrder` and
// `psaOrder` are arrays of those rank numbers.
//
// THE UNION IS WHAT THE VERIFIER WALKS, so a card in both lists costs one
// product-page fetch rather than two. Measured on this corpus at KEEP=115: 176
// rows in the union against 230 if the two lists were verified separately, so
// the shared union saves 54 requests to somebody else's server.
//
// `rank` IS NOT A RANKING. It is an identifier, and it exists in that shape
// because shared/graded-gate.mjs matches exclusion entries on `rank` plus name
// plus set plus both figures. Giving the union a stable index is what lets this
// file use the same gate as data/top-raw.json and data/top-graded.json rather
// than growing a fourth copy of the rule. The published lists number themselves
// 1..100 in their own order; see scripts/build-topps.mjs.
//
// ---------------------------------------------------------------------------
// KEEP=115, AND THE NUMBER IS A REQUEST BUDGET
// ---------------------------------------------------------------------------
//
// The page publishes 100 per list and a row that fails its second read is not
// published, so the file has to carry more than the page shows or a list
// silently ends at 96. Every kept row costs a product-page fetch at one a
// second. Measured against this corpus:
//
//     KEEP   union   already cached   to fetch
//     105     162          23           139
//     115     176          23           153
//     130     199          23           176
//
// 115 gives fifteen rows of headroom per list for about two and a half minutes
// of polite requests. The 23 already cached are Topps cards that
// verify-raw-top.mjs or verify-graded-top.mjs has already fetched for the
// site-wide lists; the cache is keyed on a sha1 of the url and shared, so they
// cost nothing.
//
// ---------------------------------------------------------------------------
// WHAT IS NOT A CARD. ELEVEN ROWS, ALL OF THEM TIN TOPPERS, ALL OF THEM CARDS
// ---------------------------------------------------------------------------
//
// The same mechanical flag plus hand verdict that sync-raw-top.mjs uses, and
// for the same reason: a false flag costs a line in the table below, a missed
// one puts a sealed box on a list of cards. The whole Topps corpus flags
// ELEVEN rows out of 2,701 and every one of them is a "[Tin Topper]" card,
// which is a card: an oversized promo that sat on the lid of a collector tin.
// So all eleven are kept, and they are kept BY NAME rather than by loosening
// the regex, because the regex is what would have caught a real box.
//
// The flag is over-eager on purpose and stays that way.

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The one listing parser. See its header: the second read that makes any of
// this publishable is only a second opinion because it is a DIFFERENT parser,
// which is exactly why the first one may not be copied around.
import { CONSOLE_HEADERS, parsePage, text, unent } from "../shared/pricecharting.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-console");
const OUT = join(ROOT, "data/topps-top.json");
const REPORT = process.argv.includes("--report");

const KEEP = 115;

// PRODUCT-FORM WORDS, the same expression sync-raw-top.mjs flags on, copied
// deliberately rather than shared: this one may be widened for Topps-specific
// packaging without changing what the site-wide raw list judges, and a shared
// regex would make that edit silently rerank /most-valuable-cards.html.
const FORM_WORDS =
  /\b(box|boxes|blister|pack|packs|deck|decks|chest|collection|tin|bundle|case|display|kit|binder|album|sleeves?|playmat|figure|pin|poster|starter|gift|bag|jumbo|oversized|set)\b/i;

/**
 * THE HAND VERDICTS, keyed by PriceCharting's own product id.
 *
 * Keyed by id rather than by name for the reason sync-raw-top.mjs gives: names
 * repeat across consoles, so a name key would let one verdict cover a row
 * nobody looked at. Every entry was read off the row it describes.
 *
 * A tin topper is a CARD. Topps packed its Pokemon cards in collector tins and
 * a single oversized card sat on the lid; the row prices that card, not the
 * tin. `card: false` would drop a genuine Topps card from a page about Topps
 * cards, which is editing the answer to suit the question.
 *
 * ONLY THE ROWS INSIDE A WINDOW ARE LISTED, which is why there is one entry
 * here and eleven flagged rows in the corpus. The other ten tin toppers sit
 * below both cuts and would be judged identically; adding them now would put
 * four permanent "this verdict describes no row" notes on every run, and the
 * script asks for a verdict the moment one of them rises into a window.
 */
const VERDICTS = {
  "9572313": { card: true, name: "Pikachu [Tin Topper] #1", why: "the oversized card that sat on a collector tin lid, not the tin" },
};

// ---------------------------------------------------------------------------
// Read the cache.

const files = (await readdir(CACHE)).filter((f) => f.endsWith(".html"));
const seen = new Set();
const bySet = new Map();
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
  if (!/topps/i.test(path)) continue;
  const { rows, headers } = parsePage(html);
  // Same contract sync-graded-top.mjs enforces on the way in. A page whose
  // columns are not the expected ones is skipped, never read positionally.
  if (headers.length && headers.join("|") !== CONSOLE_HEADERS.join("|")) {
    skipped += 1;
    continue;
  }
  pages += 1;
  newestCache = Math.max(newestCache, (await stat(join(CACHE, f))).mtimeMs);
  const setFromTitle = /<title>Pokemon (.*?) (?:Card )?Prices/.exec(html);
  const set = setFromTitle ? text(setFromTitle[1]) : path.replace("/console/pokemon-", "");
  if (!bySet.has(path)) bySet.set(path, { set, path, rows: [] });
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const row = { ...r, set, console: path };
    bySet.get(path).rows.push(row);
    all.push(row);
  }
}

if (!all.length) {
  console.error(
    "No Topps consoles found in .cache/pricecharting-console.\n" +
      "Run: node scripts/sync-graded-top.mjs   (a crawl, one request a second)",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// THE SET INVENTORY, WHICH IS WHAT THE GUIDE PAGE IS BUILT FROM.
//
// `rows` is how many PRODUCT RECORDS PriceCharting files under a set, and it is
// NOT the set's card count. This is the single easiest number to publish wrongly
// on a Topps page and the parallels are why: 2000 Topps Chrome is 604 rows and
// 151 numbered cards, because PriceCharting files the plain card and its
// Sparkle, Tekno and Spectra parallels as four separate products against one
// collector number. 151 x 4 = 604 exactly.
//
// So both numbers are computed and both are published, labelled as what they
// are. `numbers` counts DISTINCT collector numbers, read off the "#123" the set
// listing puts at the end of a name; `plain` counts rows carrying no bracketed
// printing at all. They agree on most sets and disagree on a few, and where they
// disagree the page prints the distinct-number count and says what it counted.
//
// NEITHER OF THEM IS "the number of cards Topps printed in this set". That is a
// fact about a 1999 print run and PriceCharting is not a source for it; it comes
// off the set's own checklist, is held in data/topps-sets.json where a human
// wrote it with a citation, and is printed only where we have one.
const numberOf = (name) => (/#([A-Za-z0-9-]+)\s*$/.exec(name) || [])[1] || "";
const bracketOf = (name) => (/\[([^\]]+)\]/.exec(name) || [])[1] || "";

/**
 * A row's card scan, or null when there is not one.
 *
 * PRICECHARTING SAYS "NO SCAN" BY SERVING ITS OWN PLACEHOLDER, and it does it
 * with a RELATIVE path: `/images/no-image-available.png` rather than the
 * absolute storage.googleapis.com url every real scan carries. One Topps row in
 * the ranking window is like that, and it is the reason this helper exists
 * rather than the raw value being passed through the way sync-raw-top.mjs
 * passes it.
 *
 * IT CRASHED THE VERIFIER RATHER THAN PRODUCING A BAD PAGE, which is the only
 * reason it was cheap: `fetch("/images/...")` throws ERR_INVALID_URL, 154 rows
 * into a 176 row crawl. Had the placeholder been absolute, the row would have
 * carried a picture of a grey "no image available" graphic in a box captioned
 * with a card name, which is exactly the failure /top-graded.html's "No scan"
 * text exists to avoid: a placeholder that reads as a real card face.
 *
 * So the placeholder is turned into null HERE, in the data, rather than being
 * special-cased in each of the two page builders. `imgOk` from the verifier
 * then comes back false and the row prints "No scan" in words.
 *
 * The test is "is it absolute", not "is it that exact filename", because a
 * second placeholder under a different name would fail the same way and this
 * catches it. A relative url from a host we are addressing absolutely is never
 * usable to us whatever it points at.
 */
const scanOf = (url) => (/^https?:\/\//.test(String(url || "")) ? url : null);

// THE NUMBER SHAPES ARE EMITTED TOO, and they are what data/topps-sets.json's
// claims are checked against on every build.
//
// A Topps set's chase cards carry a prefix: OR for the Orange Islands episode
// cards, HV for Heroes & Villains, EV and EVO for the two die-cut runs, E for
// the First Movie Evolution cards, PC for the clear cards. That prefix plus a
// count is what identifies WHICH Topps release a PriceCharting bucket holds,
// and it is the only evidence we have for the mapping, because PriceCharting's
// bucket names do not say. `numeric` does the same job for the buckets numbered
// plainly: the 62 Johto Pokemon cards run 152 to 249, which is a Johto range and
// could be nothing else.
//
// scripts/build-topps.mjs recomputes every one of these against the `expect`
// block on the matching entry in data/topps-sets.json and FAILS THE BUILD on a
// mismatch, so the mapping between two taxonomies is verified rather than
// asserted once and left. See that file's header for why the mapping is the
// thing most likely to be wrong on this page.
const sets = [...bySet.values()]
  .map((s) => {
    const nums = [...new Set(s.rows.map((r) => numberOf(r.name)).filter(Boolean))];
    const numbers = new Set(nums);
    const plainNums = nums.filter((n) => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b);
    const prefixes = {};
    for (const n of nums) {
      const m = /^([A-Za-z]+)/.exec(n);
      if (m) prefixes[m[1]] = (prefixes[m[1]] || 0) + 1;
    }
    const printings = {};
    for (const r of s.rows) {
      const b = bracketOf(r.name);
      if (b) printings[b] = (printings[b] || 0) + 1;
    }
    return {
      set: s.set,
      console: s.path,
      rows: s.rows.length,
      numbers: numbers.size,
      // Distinct collector numbers that are plain digits, and their range.
      numeric: plainNums.length
        ? { count: plainNums.length, min: plainNums[0], max: plainNums[plainNums.length - 1] }
        : null,
      // Distinct collector numbers by their alphabetic prefix. CASE IS KEPT AS
      // PRINTED: PriceCharting has both "Snap05" and "SNAP12" in the Johto
      // episode buckets, and folding the case would hide that its own data is
      // inconsistent there, which is a fact worth being able to see.
      prefixes,
      // Rows carrying no collector number at all: checklists, the Movie 2000
      // film frame card, the six First Appearance holograms.
      unnumbered: s.rows.filter((r) => !numberOf(r.name)).length,
      plain: s.rows.filter((r) => !/\[/.test(r.name)).length,
      withUngraded: s.rows.filter((r) => r.ungraded != null).length,
      withG9: s.rows.filter((r) => r.g9 != null).length,
      withPsa10: s.rows.filter((r) => r.psa10 != null).length,
      // Every bracketed printing this set actually carries, counted. The guide
      // explains what Sparkle, Tekno, Spectra and Foil are, and the counts here
      // are what stops that explanation being a list somebody remembered.
      printings: Object.fromEntries(
        Object.entries(printings).sort((a, b) => b[1] - a[1]),
      ),
      // The most expensive row in this set by each measure, so the guide's set table
      // can show what the set's ceiling looks like without a second ranking
      // pass. These are UNVERIFIED figures and the guide must not print one:
      // they are here for the builder to pick the row out of `cards` by id.
      topRawId: s.rows.filter((r) => r.ungraded != null).sort((a, b) => b.ungraded - a.ungraded)[0]?.id || null,
      topPsaId: s.rows.filter((r) => r.psa10 != null).sort((a, b) => b.psa10 - a.psa10)[0]?.id || null,
    };
  })
  .sort((a, b) => b.rows - a.rows);

// ---------------------------------------------------------------------------
// Judge the flagged rows, inside either window only.

const rawPriced = all.filter((r) => r.ungraded != null).sort((a, b) => b.ungraded - a.ungraded);
const psaPriced = all.filter((r) => r.psa10 != null).sort((a, b) => b.psa10 - a.psa10);

const unjudged = [];
const notCards = [];

/** Walk a sorted list, taking KEEP rows that survive the verdicts. */
function window_(sorted, key) {
  const out = [];
  for (const r of sorted) {
    if (out.length >= KEEP) break;
    if (!FORM_WORDS.test(r.name)) {
      out.push(r);
      continue;
    }
    const v = VERDICTS[r.id];
    if (!v) {
      unjudged.push({ ...r, col: key });
      continue;
    }
    // The verdict has to be about THIS row. A name that has drifted means the id
    // now points at something else, and an old decision must not carry over.
    if (v.name !== r.name) {
      unjudged.push({ ...r, col: key, whyUnjudged: `verdict for id ${r.id} says "${v.name}"` });
      continue;
    }
    if (v.card) out.push(r);
    else if (!notCards.some((n) => n.id === r.id)) notCards.push({ ...r, why: v.why });
  }
  return out;
}

const rawWin = window_(rawPriced, "ungraded");
const psaWin = window_(psaPriced, "psa10");

if (unjudged.length) {
  console.error(
    `${unjudged.length} product(s) inside a top ${KEEP} window carry a product-form word in their\n` +
      `name and have no verdict in VERDICTS. Look at each one and decide whether it is a single\n` +
      `card or a sealed product, then add it. Nothing is dropped or kept by guess here:\n` +
      unjudged
        .map(
          (r) =>
            `  "${r.id}": { card: ???, name: ${JSON.stringify(r.name)}, why: "" },` +
            `   ${r.col}=$${r[r.col]}  ${r.set}  https://www.pricecharting.com${r.path}` +
            (r.whyUnjudged ? `   (${r.whyUnjudged})` : ""),
        )
        .join("\n"),
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// THE UNION, AND THE TWO ORDERS OVER IT.
//
// Sorted by ungraded value so the file reads sensibly by hand, with the rows
// that carry no ungraded figure at all after them in psa10 order. The ORDER OF
// THIS ARRAY CARRIES NO MEANING and nothing may rank by it: `rawOrder` and
// `psaOrder` below are the rankings, and `rank` is only an identifier.
const unionIds = new Set([...rawWin.map((r) => r.id), ...psaWin.map((r) => r.id)]);
const byId = new Map(all.map((r) => [r.id, r]));
const union = [...unionIds]
  .map((id) => byId.get(id))
  .sort((a, b) => (b.ungraded ?? -1) - (a.ungraded ?? -1) || (b.psa10 ?? -1) - (a.psa10 ?? -1));
union.forEach((r, i) => (r.rank = i + 1));
const rankOf = new Map(union.map((r) => [r.id, r.rank]));

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
    "Topps' own Pokemon trading cards, from pricecharting.com.",
    "Written by scripts/sync-topps-top.mjs from the pages sync-graded-top.mjs",
    "already cached. NO NETWORK: see that script's header before adding one.",
    "",
    "WHAT THESE CARDS ARE. Topps printed Pokemon TRADING cards under licence",
    "around 1999-2004: anime and movie stills on card stock, with no HP, no",
    "attacks and no energy cost. They are not Pokemon TCG cards and cannot be",
    "played with. PriceCharting files and prices them under Pokemon anyway,",
    "which is why they turn up in this site's site-wide rankings.",
    "",
    "WHAT THE NUMBERS ARE. PriceCharting's Ungraded, Grade 9 and PSA 10 price",
    "guide values, computed by their algorithm from completed eBay sales and",
    "their own marketplace. NOT a marketplace price, NOT a live listing and NOT",
    "an auction result, and no page may describe them as any of those.",
    "",
    "`rank` IS AN IDENTIFIER, NOT A RANKING. It is a row's position in the",
    "union of the two candidate windows. The rankings are `rawOrder` and",
    "`psaOrder`, which are arrays of those rank numbers.",
    "",
    "`rows` PER SET IS PRODUCT RECORDS, NOT CARDS. 2000 Topps Chrome is 604",
    "rows and 151 numbered cards, because the plain card and its Sparkle, Tekno",
    "and Spectra parallels are four products against one number. `numbers` is",
    "the distinct collector numbers. Neither is a print-run fact.",
    "",
    "A SNAPSHOT. `checked` is the day the crawl read these pages, borrowed from",
    "data/top-graded.json because they are the same crawl.",
    "",
    "NOTHING HERE IS PUBLISHABLE UNTIL verify-topps-top.mjs HAS RUN. The td ids",
    "on a product page mean different grades than the ones on a listing page,",
    "so a single read cannot be trusted. See data/top-graded-PLAN.md, trap 4.",
  ],
  source: "pricecharting.com",
  sourceMethodology: "https://www.pricecharting.com/page/methodology",
  measurement: "PriceCharting ungraded, Grade 9 and PSA 10 price guide values",
  checked,
  scanned: {
    consoles: bySet.size,
    pages,
    pagesSkipped: skipped,
    products: all.length,
    productsWithUngraded: rawPriced.length,
    productsWithG9: all.filter((r) => r.g9 != null).length,
    productsWithPsa10: psaPriced.length,
    keep: KEEP,
  },
  sets,
  notCards: notCards.map((r) => ({
    name: r.name,
    set: r.set,
    ungraded: r.ungraded,
    psa10: r.psa10,
    why: r.why,
    url: `https://www.pricecharting.com${r.path}`,
    id: r.id,
  })),
  rawOrder: rawWin.map((r) => rankOf.get(r.id)),
  psaOrder: psaWin.map((r) => rankOf.get(r.id)),
  cards: union.map((r) => ({
    rank: r.rank,
    name: r.name,
    set: r.set,
    console: r.console,
    number: numberOf(r.name),
    printing: bracketOf(r.name),
    ungraded: r.ungraded,
    g9: r.g9,
    psa10: r.psa10,
    url: `https://www.pricecharting.com${r.path}`,
    // null rather than PriceCharting's own relative "no image available"
    // placeholder. See scanOf() above for why that matters more than it looks.
    pcImg: scanOf(r.img),
    id: r.id,
  })),
};

if (!REPORT) await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

const stale = Object.entries(VERDICTS).filter(([id]) => !unionIds.has(id));

console.log(
  `${REPORT ? "Measured (wrote nothing)" : "Wrote data/topps-top.json"}\n` +
    `  ${bySet.size} Topps consoles, ${pages} cached pages${skipped ? `, ${skipped} skipped for unexpected columns` : ""}\n` +
    `  ${all.length} products: ${rawPriced.length} with an ungraded value, ` +
    `${out.scanned.productsWithG9} with Grade 9, ${psaPriced.length} with PSA 10\n` +
    `  raw window ${rawWin.length}: $${rawWin[0].ungraded.toLocaleString("en-US")} down to $${rawWin[rawWin.length - 1].ungraded.toLocaleString("en-US")}\n` +
    `  PSA 10 window ${psaWin.length}: $${psaWin[0].psa10.toLocaleString("en-US")} down to $${psaWin[psaWin.length - 1].psa10.toLocaleString("en-US")}\n` +
    `  union ${union.length} rows to verify (${rawWin.length + psaWin.length - union.length} cards are in both lists)\n` +
    (notCards.length
      ? `  removed ${notCards.length} non-cards: ` + notCards.map((r) => r.name).join(", ") + "\n"
      : `  removed 0 non-cards; ${Object.keys(VERDICTS).length} flagged rows were all judged to be cards\n`),
);
if (stale.length) {
  console.log(
    `  NOTE: ${stale.length} verdict(s) describe no row in either window and can be deleted: ` +
      stale.map(([id, v]) => `${id} ${v.name}`).join(", "),
  );
}
console.log(`\nNext: node scripts/verify-topps-top.mjs`);
