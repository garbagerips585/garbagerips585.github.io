#!/usr/bin/env node
// The highest PSA 10 values in Pokemon, from PriceCharting's own price guide.
//
//   node scripts/sync-graded-top.mjs            crawl (uses .cache/, resumable)
//   node scripts/sync-graded-top.mjs --refresh  ignore the cache and refetch
//
// Writes data/top-graded.json. Read data/top-graded-PLAN.md before changing any
// of this: it records what was probed, what answered, and the three traps that
// make a wrong query here look exactly like a right one.
//
// WHAT THIS MEASURES, AND WHY THE PAGE SAYS SO IN ITS TITLE.
// PriceCharting's "PSA 10" column, which their own methodology page defines as
// a card "Graded by PSA as a 10", priced from completed eBay sales plus their
// own marketplace, combined by their algorithm (most recent sale, median,
// average, age weighted average, outliers considered). It is a PRICE GUIDE
// VALUE. It is NOT a record of one auction, and the page must never call it
// one: the Illustrator Pikachu's famous $5.275m Goldin sale is a different kind
// of fact from the $16.5m guide value sitting in this column, and conflating
// the two is how a fan site starts publishing numbers nobody can check.
//
// ---------------------------------------------------------------------------
// THREE TRAPS. All three were hit while writing this, all three answered 200.
//
// 1. `sort=highest-price` SORTS ON THE UNGRADED COLUMN, NOT THE GRADED ONE.
//    It is the only price sort PriceCharting offers, on both the search
//    endpoint and the console pages, and its name does not say which price.
//    Measured on a Charizard query: price1 (ungraded) came back monotonically
//    descending, price2 (PSA 10) did not, and Charizard [Gold Star] at a
//    $195,200 PSA 10 sat FOURTH behind three cards worth a fifth of it, because
//    its raw price is $3,835. Sorting by it and taking the top would have
//    produced a confident, wrong, entirely plausible list. There is NO
//    server-side sort by graded price anywhere on the site; the PSA 10 column
//    header sorts client-side, over the 150 rows already loaded. So the only
//    honest way to rank by PSA 10 is to pull every row and sort locally, which
//    is what this does.
//
// 2. AN UNKNOWN PARAMETER VALUE IS IGNORED, SILENTLY, WITH A 200.
//    `sort=TOTAL_GARBAGE_XYZ` returns the popularity ordering and no error;
//    `exclude-hardware=ZZGARBAGE` returns the sealed products it was meant to
//    drop. The defence is that the JSON endpoint ECHOES the parameters it
//    actually applied, so `sort` reading back as `popularity` is the tell, and
//    for the HTML pages the defence is comparing the response body against the
//    unfiltered one rather than trusting the request. Every filter this script
//    relies on was verified by content diff, not by status code.
//
// 3. TWO LISTS THAT LOOK COMPLETE ARE NOT.
//    - The console page caps at 150 rows and hides the rest behind a form
//      posting `cursor`. A set with 450 cards renders 150 and looks finished.
//    - /category/pokemon-cards lists 302 sets and its heading says, in words,
//      "Most Popular Pokemon Card Sets". It omitted every World Championships
//      year except 2025, and those sets hold the trophy cards. Searching for
//      "No. 1 Trainer" returned a console the category page never mentioned.
//      /sitemap.xml carries 793 Pokemon consoles and is a strict SUPERSET of
//      the category list (checked: 0 in the category page are missing from it),
//      so the sitemap is the enumeration and the category page is not.
//
// A FOURTH THING THAT IS NOT A TRAP BUT READS LIKE ONE. Plenty of the rarest
// cards in Pokemon carry an EMPTY PSA 10 cell: Trophy Pikachu [Gold], No. 1
// Trainer: Champion Road, Master's Key. That is not missing data to be filled
// in, it is the honest answer. PriceCharting prices from completed sales, and a
// card with no recent PSA 10 sale has no PSA 10 value to report. Those cards
// are absent from the list BY CONSTRUCTION and the page says so, because a
// reader who knows Pokemon will notice they are missing and deserves the reason.
//
// POLITENESS. Same shape as sync-pricecharting.mjs: one request a second, an
// honest User-Agent naming the site, gzip requested. robots.txt disallows only
// /stripe-connect, /publish-offer and /buy, none of which are touched. Every
// page is cached under .cache/ (gitignored), so a re-run costs nothing and this
// crawl happens once, not once per build.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-console");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const REFRESH = process.argv.includes("--refresh");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The column layout every Pokemon card console page is expected to have. If a
// page disagrees it is RECORDED AND SKIPPED rather than read positionally
// anyway: the td classes are video-game legacy names (used_price, cib_price,
// new_price) and mean nothing about which grade they hold, so the <th> row is
// the only thing that says what column three actually is.
const WANT_HEADERS = ["", "Card", "Ungraded", "Grade 9", "PSA 10", ""];

const money = (s) => {
  const n = Number(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const unent = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
// ENTITIES ARE DECODED BEFORE THE TRIM, NOT AFTER, and the order is the whole
// point. The blank column headers are "&nbsp;", so trimming first leaves a
// literal "&nbsp;" which only becomes a space once decoded, and the space
// never gets trimmed. That made every header compare as " " against "" and
// this script skipped all 793 consoles as "unexpected columns" while fetching
// every one of them: 50 pages, 0 products, and a log that looked like progress.
const text = (s) => unent(String(s)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// A console path is a PATH, and 46 of the 793 carry a "&" or a "'".
// encodeURI leaves "&" alone, so "/console/pokemon-black-&-white?cursor=0"
// parses as the path "/console/pokemon-black-" with a stray query parameter.
// Encode the segment, then put back the slashes encodeURIComponent ate.
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

async function get(url) {
  await mkdir(CACHE, { recursive: true });
  const key = join(CACHE, createHash("sha1").update(url).digest("hex") + ".html");
  if (!REFRESH && existsSync(key)) return readFile(key, "utf8");
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
  if (!r.ok) {
    // A 404 here is evidence about THIS url and nothing more. video-games-PLAN
    // once recorded a 404 at a guessed slug as proof a game had no page, and
    // the page existed at a different slug. Never crawl a guessed address.
    console.log(`  HTTP ${r.status}  ${url}`);
    return null;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const html = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  await writeFile(key, html);
  await sleep(1100);
  return html;
}

/** Every Pokemon console path, from the sitemap. Not from the category page. */
async function consoles() {
  const xml = await get("https://www.pricecharting.com/sitemap.xml");
  const paths = new Set();
  for (const m of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const u = unent(m[1]);
    if (!u.includes("/console/pokemon")) continue;
    paths.add(decodeURIComponent(new URL(u).pathname));
  }
  return [...paths].sort();
}

/** One page of a console listing. Returns {rows, next, headers} or null. */
function parsePage(html) {
  const headers = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((m) => text(m[1]));
  const rows = [];
  for (const m of html.matchAll(/<tr[^>]*id="product-(\d+)"[^>]*>(.*?)<\/tr>/gs)) {
    const tr = m[2];
    const a = /<td class="title"[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)<\/a>/s.exec(tr);
    if (!a) continue;
    const prices = [...tr.matchAll(/<td class="price[^"]*"[^>]*>(.*?)<\/td>/gs)].map((p) => {
      const v = /<span class="js-price"[^>]*>(.*?)<\/span>/s.exec(p[1]);
      return v ? money(text(v[1])) : null;
    });
    const img = /<img class="photo"[^>]*src="([^"]+)"/.exec(tr);
    rows.push({
      id: m[1],
      path: unent(a[1]),
      name: text(a[2]),
      img: img ? unent(img[1]) : null,
      ungraded: prices[0] ?? null,
      g9: prices[1] ?? null,
      psa10: prices[2] ?? null,
    });
  }
  const next = /name="cursor" value="(\d+)"/.exec(html);
  return { rows, next: next ? Number(next[1]) : null, headers };
}

const list = await consoles();
console.log(`${list.length} Pokemon consoles from sitemap.xml. Crawling, one page a second...`);

const all = [];
const seenIds = new Set();
const skipped = [];
let pages = 0;
let done = 0;

for (const path of list) {
  done += 1;
  let cursor = 0;
  let guard = 0;
  const before = all.length;
  for (;;) {
    // exclude-hardware=true drops sealed product. VERIFIED BY DIFF, not by
    // status: on Prismatic Evolutions it took the row count of sealed-looking
    // titles from 16 to 3, where the garbage value left all 16 in place.
    const url =
      `https://www.pricecharting.com${encPath(path)}?exclude-hardware=true` +
      (cursor ? `&cursor=${cursor}` : "");
    const html = await get(url);
    if (!html) break;
    pages += 1;
    const { rows, next, headers } = parsePage(html);
    if (headers.length && headers.join("|") !== WANT_HEADERS.join("|")) {
      skipped.push({ path, why: "unexpected columns", headers });
      break;
    }
    // A cursor that is ignored would re-serve page one forever and the crawl
    // would look busy and productive while collecting one page of duplicates.
    const fresh = rows.filter((r) => !seenIds.has(r.id));
    if (cursor && fresh.length === 0) break;
    const setFromTitle = /<title>Pokemon (.*?) (?:Card )?Prices/.exec(html);
    for (const r of fresh) {
      seenIds.add(r.id);
      all.push({ ...r, set: setFromTitle ? text(setFromTitle[1]) : path.replace("/console/pokemon-", "") });
    }
    if (next == null || next <= cursor || ++guard > 200) break;
    cursor = next;
  }
  if (done % 50 === 0 || done === list.length)
    console.log(`  [${done}/${list.length}] ${all.length} products, ${pages} pages  (last: ${path.replace("/console/", "")} +${all.length - before})`);
}

const withPsa = all.filter((r) => r.psa10 != null);
withPsa.sort((a, b) => b.psa10 - a.psa10);

// Keep more than the page shows, so the builder can drop rows (a duplicate
// printing, a non-card) without the list silently ending at 94.
const KEEP = 400;

await writeFile(
  join(ROOT, "data/top-graded.json"),
  JSON.stringify(
    {
      _readme: [
        "The highest PSA 10 values in Pokemon, from pricecharting.com.",
        "Written by scripts/sync-graded-top.mjs. See data/top-graded-PLAN.md.",
        "",
        "WHAT THE NUMBER IS. PriceCharting's PSA 10 column: a price guide value",
        "for a card graded PSA 10, calculated by their algorithm from completed",
        "eBay sales and their own marketplace. It is NOT an auction result and",
        "no page may describe it as one.",
        "",
        "A SNAPSHOT. `checked` is the day the crawl ran. Every row carries the",
        "url it came from and the page prints both, because these do not refresh",
        "the way the nightly TCGdex raw prices do.",
        "",
        "RANKED LOCALLY, ON PURPOSE. PriceCharting's own `sort=highest-price`",
        "sorts by the UNGRADED price, so it cannot produce this ordering. Every",
        "row of every set was pulled and sorted here instead. `scanned` below is",
        "the size of the corpus that ranking was taken from.",
        "",
        "AN EMPTY PSA 10 IS AN ANSWER, NOT A GAP. Cards with no recent PSA 10",
        "sale have no value in this column and are absent from this file by",
        "construction. Do not backfill them from anywhere.",
      ],
      source: "pricecharting.com",
      sourceMethodology: "https://www.pricecharting.com/page/methodology",
      measurement: "PriceCharting PSA 10 price guide value",
      checked: new Date().toISOString().slice(0, 10),
      scanned: {
        consoles: list.length,
        consolesSkipped: skipped,
        pages,
        products: all.length,
        productsWithPsa10: withPsa.length,
      },
      cards: withPsa.slice(0, KEEP).map((r, i) => ({
        rank: i + 1,
        name: r.name,
        set: r.set,
        psa10: r.psa10,
        g9: r.g9,
        ungraded: r.ungraded,
        url: `https://www.pricecharting.com${r.path}`,
        pcImg: r.img,
        id: r.id,
      })),
    },
    null,
    2,
  ) + "\n",
);

console.log(`\nWrote data/top-graded.json`);
console.log(`  ${list.length} consoles, ${pages} pages, ${all.length} products`);
console.log(`  ${withPsa.length} had a PSA 10 value; kept the top ${Math.min(KEEP, withPsa.length)}`);
if (skipped.length) console.log(`  SKIPPED ${skipped.length}:`, skipped.slice(0, 5));
