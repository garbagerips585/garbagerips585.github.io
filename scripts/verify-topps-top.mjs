#!/usr/bin/env node
// Re-read every figure the two Topps pages are about to publish from a
// DIFFERENT page, through a DIFFERENT parser, and check the card scan exists.
//
//   node scripts/verify-topps-top.mjs            every row in data/topps-top.json
//   node scripts/verify-topps-top.mjs --refresh  ignore the cache and refetch
//
// Reads and rewrites data/topps-top.json, adding a `verify` block.
// scripts/build-topps.mjs REFUSES to build either page without one whose `for`
// stamp matches the crawl, so a re-sync invalidates the verification instead of
// silently inheriting it. The gate is shared/graded-gate.mjs, the same one
// /most-valuable-cards.html, /top-graded.html and /base-set.html are held to.
//
// This is the third of these and the argument is identical to the other two, so
// it is stated once: sync-topps-top.mjs reads a CONSOLE LISTING, a wide table
// with three price columns and one row per card. This reads the PRODUCT page: a
// different template, six price columns, one card. Different HTML, different
// parser, same numbers expected.
//
// THE TRAP IT EXISTS FOR. The td ids are video-game legacy names and they mean
// DIFFERENT GRADES on the two page types:
//
//     console listing   used_price=Ungraded  cib_price=Grade 9  new_price=PSA 10
//     product page      used_price=Ungraded  new_price=Grade 8  manual_only_price=PSA 10
//
// On Base Set Charizard #4 reading `new_price` off the wrong template is
// $28,144.52 against $1,330.50, a 21x error that looks like a perfectly
// reasonable price for the card. Neither parser trusts an id; both map columns
// from the <th> labels above them, and shared/pricecharting.mjs refuses a table
// it cannot line up rather than falling back to a position.
//
// ---------------------------------------------------------------------------
// THIS FILE HAS TWO RANKING COLUMNS, WHICH THE OTHER TWO VERIFIERS DO NOT
// ---------------------------------------------------------------------------
//
// verify-raw-top.mjs ranks by Ungraded and verify-graded-top.mjs ranks by PSA
// 10. This file feeds two lists off one corpus, so BOTH of those are ranking
// columns and Grade 9 is the only decorative one. Each column still gets its
// own independent verdict, exactly as verify-raw-top.mjs gives them:
//
//   agree      both pages have it and they are within tolerance. Publishable.
//   none       neither page has it. An EMPTY CELL IS AN ANSWER, not a gap:
//              PriceCharting prices from completed sales, and a card with no
//              recent sale in a grade has no value to report.
//   onesided   one page has it and the other does not. NOT publishable, and it
//              is not the same thing as "none": we hold one reading and no
//              confirmation of it.
//   disagree   both have it and they are more than the tolerance apart.
//
// WHAT THE ROW-LEVEL `status` MEANS HERE, because it is not what it means in
// the other two files and a reader of shared/graded-gate.mjs will assume it is.
// The gate reads `status` and stops the build on any "disagree" with no recorded
// reason. So `status` is "disagree" when EITHER RANKING COLUMN disagrees, and a
// Grade 9 disagreement alone does not stop the build.
//
// THAT ASYMMETRY IS THE SAME RULE THE OTHER TWO KEEP, NOT A RELAXATION OF IT.
// verify-raw-top.mjs already lets a Grade 9 or PSA 10 disagreement through the
// gate and suppresses that one figure on the row: those columns are printed
// beside the ranking figure and never decide the ORDER, so a bad reading of one
// costs a fact on a row, while a bad reading of the ranking column silently
// reorders the whole page. Here two columns can do that, so two columns stop the
// build. Grade 9 is the only one that cannot, and a Grade 9 that did not agree
// is still never printed: scripts/build-topps.mjs gates every figure on its own
// column's verdict, not on the row's.
//
// `listing` and `product` at row level are the pair from the column that
// FAILED, because shared/graded-gate.mjs matches an exclusion entry on those two
// figures exactly and an entry has to describe one specific pair of readings.
// `statusCol` names which column they came from, so an exclusion cannot be
// parked over the wrong one. Where nothing failed they are the Ungraded pair.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { productColumns, columnChange } from "../shared/pricecharting.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The same cache directory verify-graded-top.mjs and verify-raw-top.mjs use,
// keyed by a sha1 of the url, so a Topps card already fetched for one of the
// site-wide lists costs no second request. Measured on the first run: 23 of the
// 176 rows were already on disk.
const CACHE = join(ROOT, ".cache/pricecharting-product");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const REFRESH = process.argv.includes("--refresh");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A guide value moves between two reads on different days. This is a check that
// we read the RIGHT COLUMN, not that the market held still, so the tolerance is
// generous and a 21x id mix-up cannot hide inside it. Same figure the other two
// verifiers use, deliberately.
const TOLERANCE = 0.15;

const COLUMNS = [
  { key: "ungraded", header: "Ungraded", ranking: true },
  { key: "g9", header: "Grade 9", ranking: false },
  { key: "psa10", header: "PSA 10", ranking: true },
];

async function get(url, bin = false) {
  await mkdir(CACHE, { recursive: true });
  const key = join(CACHE, createHash("sha1").update(url).digest("hex") + (bin ? ".head" : ".html"));
  if (!REFRESH && existsSync(key)) return readFile(key, "utf8");
  const r = await fetch(url, {
    method: bin ? "HEAD" : "GET",
    headers: { "User-Agent": UA, "Accept-Encoding": "gzip" },
  });
  let out;
  if (bin) {
    out = `${r.status} ${r.headers.get("content-length") || ""} ${r.headers.get("content-type") || ""}`;
  } else if (!r.ok) {
    // A 404 here is evidence about THIS url and nothing more, and it is written
    // to the cache as such so a re-run does not re-ask.
    out = `__HTTP_${r.status}__`;
  } else {
    const buf = Buffer.from(await r.arrayBuffer());
    out = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  }
  await writeFile(key, out);
  // One request a second, an honest User-Agent naming the site. Same politeness
  // as every other script that touches this host.
  await sleep(1100);
  return out;
}

/** One column's verdict. See the header for what each one means. */
function judge(listing, product) {
  if (listing == null && product == null) return { status: "none" };
  if (listing == null || product == null) return { status: "onesided" };
  const within = Math.abs(product - listing) / listing <= TOLERANCE;
  return { status: within ? "agree" : "disagree" };
}

const file = join(ROOT, "data/topps-top.json");
const d = JSON.parse(await readFile(file, "utf8"));
const rows = d.cards;
console.log(`Verifying ${rows.length} rows against their product pages, one a second...`);

const results = [];
let agree = 0;
let disagree = 0;
let unreadable = 0;
let noImg = 0;

for (const [n, c] of rows.entries()) {
  const html = await get(c.url);
  const got = productColumns(html);

  // The scan is checked too. A row whose picture 404s must SAY it has no scan,
  // not paint a placeholder that reads as a real card face.
  //
  // THE ABSOLUTE-URL TEST IS A SECOND GUARD, NOT THE FIRST ONE. sync-topps-top
  // .mjs already nulls PriceCharting's relative `/images/no-image-available.png`
  // placeholder on the way in, and this repeats the check because the failure it
  // caused was a hard crash 154 rows into a 176 row crawl rather than a bad
  // value: `fetch()` throws ERR_INVALID_URL on a relative path. A verifier that
  // dies partway leaves the data file with no `verify` block at all, so both
  // pages refuse to build and the whole run has to go again. Cheap to guard.
  const imgUrl = /^https?:\/\//.test(String(c.pcImg || ""))
    ? c.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg")
    : null;
  const head = imgUrl ? await get(imgUrl, true) : "0";
  const imgOk = /^200 /.test(head);
  const imgBytes = Number((/^200 (\d+)/.exec(head) || [])[1] || 0);
  if (!imgOk) noImg += 1;

  const out = {
    rank: c.rank,
    name: c.name,
    set: c.set,
    listing: c.ungraded,
    product: null,
    statusCol: "ungraded",
    status: "unreadable",
    imgOk,
    imgBytes,
    cols: {},
  };

  if (got.error) {
    out.error = got.error;
    unreadable += 1;
  } else {
    for (const col of COLUMNS) {
      const listing = c[col.key] ?? null;
      // A readable table with no such column is NOT the same as a column
      // holding nothing, so it is recorded as unreadable for that column.
      const present = col.header in got.cols;
      const product = present ? got.cols[col.header] ?? null : null;
      const v = present ? judge(listing, product) : { status: "unreadable" };
      out.cols[col.key] = { listing, product, status: v.status };
      // PRICECHARTING'S OWN "dollar change from last update" IS RECORDED FOR
      // EVERY READING THAT MOVED, not only for the ones that moved far enough
      // to fail. That is what turns a single reconciled disagreement into
      // evidence about the whole corpus: shared/graded-gate.mjs could only
      // argue that its one failing row was a moved price because every row fell
      // into exactly two classes, identical or moved-and-reconciled, with none
      // left over. A `change` recorded only on failures cannot support that
      // claim, and the figure is free: the page is already in hand.
      if (listing != null && product != null && product !== listing) {
        const change = columnChange(html, col.header);
        out.cols[col.key].change = change;
        if (change != null) out.cols[col.key].reconciles = Number((product - change).toFixed(2)) === listing;
      }
    }
    // THE TWO RANKING COLUMNS DECIDE THE ROW'S VERDICT. See the header for why
    // Grade 9 does not, and for why that is the same rule the other two
    // verifiers keep rather than a weaker one.
    const failed = COLUMNS.filter((col) => col.ranking && out.cols[col.key].status === "disagree");
    const unread = COLUMNS.filter((col) => col.ranking && out.cols[col.key].status === "unreadable");
    const pick = failed[0] || unread[0] || COLUMNS[0];
    out.statusCol = pick.key;
    out.listing = out.cols[pick.key].listing;
    out.product = out.cols[pick.key].product;
    out.status = failed.length ? "disagree" : unread.length ? "unreadable" : "agree";
    out.headers = got.headers;
    if (out.status === "agree") agree += 1;
    else if (out.status === "unreadable") unreadable += 1;
    else disagree += 1;
  }

  results.push(out);
  if (out.status !== "agree" || !imgOk)
    console.log(
      `  ${out.status.toUpperCase().padEnd(10)} #${c.rank} ${c.name} (${c.set})  ` +
        `${out.statusCol} listing ${out.listing}  product ${out.product ?? out.error ?? out.cols[out.statusCol]?.status}  ` +
        `img=${imgOk ? imgBytes + "B" : "MISSING"}`,
    );
  if ((n + 1) % 40 === 0) console.log(`  ...${n + 1}/${rows.length}`);
}

// Every column that will not be printed, counted, so the build and the report
// can say how much of the detail survived rather than only the two rankings.
const colTally = {};
for (const col of COLUMNS) {
  colTally[col.key] = results.reduce((acc, r) => {
    const s = r.cols?.[col.key]?.status || "unreadable";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
}

d.verify = {
  // Stamped against the crawl this verified. shared/graded-gate.mjs compares
  // these, so a re-sync cannot silently inherit an old verification.
  for: d.checked,
  ran: new Date().toISOString().slice(0, 10),
  method:
    "re-read the Ungraded, Grade 9 and PSA 10 columns from each product page, mapping columns by <th> label",
  rankingColumns: ["ungraded", "psa10"],
  tolerance: TOLERANCE,
  checked: results.length,
  agree,
  disagree,
  unreadable,
  imagesMissing: noImg,
  columns: colTally,
  rows: results,
};
await writeFile(file, JSON.stringify(d, null, 2) + "\n");

console.log(`\n${agree} agree, ${disagree} disagree, ${unreadable} unreadable, ${noImg} missing a scan`);
for (const col of COLUMNS)
  console.log(`  ${col.header.padEnd(9)} ${JSON.stringify(colTally[col.key])}`);
if (disagree) {
  // NEITHER FIGURE IS PUBLISHABLE EITHER WAY, and the three ways forward are
  // not equally good. Fixing the parse is the right answer when the parse is
  // wrong, and a broken parse is the thing this whole script exists to catch,
  // so look there first: check whether the OTHER rows still agree before
  // concluding it is about one card. Dropping the row from the data loses the
  // evidence. Recording it in `excluded` keeps the row, keeps it unpublished
  // and keeps the reason next to the two numbers it is about. What is not on
  // the list is editing `status` to "agree", which is the only one of these
  // that is silent.
  console.log(
    "DISAGREEMENTS ARE NOT PUBLISHABLE.\n" +
      "  Fix the parse, or record the row in the top-level `excluded` array of\n" +
      "  data/topps-top.json with rank, name, set, listing, product, decided,\n" +
      "  public and why. The row stays off both lists either way. Do not edit a\n" +
      "  row's status. See shared/graded-gate.mjs.",
  );
}
