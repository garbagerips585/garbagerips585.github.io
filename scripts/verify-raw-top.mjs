#!/usr/bin/env node
// Re-read every figure /most-valuable-cards.html is about to publish from a
// DIFFERENT page, through a DIFFERENT parser, and check the card scan exists.
//
//   node scripts/verify-raw-top.mjs            every row in data/top-raw.json
//   node scripts/verify-raw-top.mjs --refresh  ignore the cache and refetch
//
// Reads and rewrites data/top-raw.json, adding a `verify` block.
// scripts/build-top100.mjs REFUSES to build the cards page without one whose
// `for` stamp matches the crawl, so a re-sync invalidates the verification
// instead of silently inheriting it. The gate is shared/graded-gate.mjs, the
// same one /top-graded.html and /base-set.html are held to.
//
// WHY A SECOND READ IS WORTH 160 REQUESTS. This is the twin of
// scripts/verify-graded-top.mjs and the argument is identical, so it is stated
// once here rather than twice: sync-raw-top.mjs reads a CONSOLE LISTING, a wide
// table with three price columns and one row per card. This reads the PRODUCT
// page: a different template, six price columns, one card. Different HTML,
// different parser, same numbers expected.
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
// THIS ONE CHECKS THREE COLUMNS, NOT ONE, AND EACH ONE STANDS ALONE
// ---------------------------------------------------------------------------
//
// The rows print an Ungraded figure, a Grade 9 figure and a PSA 10 figure, so
// all three are re-read and each gets its own verdict:
//
//   agree      both pages have it and they are within tolerance. Publishable.
//   none       neither page has it. An EMPTY CELL IS AN ANSWER, not a gap:
//              PriceCharting prices from completed sales, and a card with no
//              recent sale in a grade has no value to report. Printed as
//              "no value recorded".
//   onesided   one page has it and the other does not. NOT publishable, and it
//              is not the same thing as "none": we hold one reading and no
//              confirmation of it.
//   disagree   both have it and they are more than the tolerance apart.
//
// THE UNGRADED COLUMN IS SPECIAL because it is the column the list is RANKED
// by. A row whose ungraded figure is anything but "agree" cannot be published
// at all, and the row's overall `status` is that column's verdict, which is
// what shared/graded-gate.mjs reads. The other two only decide whether their
// own figure is printed beside a row that is already publishable.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { productColumns, columnChange } from "../shared/pricecharting.mjs";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The same cache directory verify-graded-top.mjs uses, keyed by a sha1 of the
// url, so the 70 cards that are in both the raw and the graded top lists cost
// no second fetch.
const CACHE = join(ROOT, ".cache/pricecharting-product");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const REFRESH = process.argv.includes("--refresh");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A guide value moves between two reads on different days. This is a check that
// we read the RIGHT COLUMN, not that the market held still, so the tolerance is
// generous and a 21x id mix-up cannot hide inside it. Same figure
// verify-graded-top.mjs uses, deliberately.
const TOLERANCE = 0.15;

const COLUMNS = [
  { key: "ungraded", header: "Ungraded" },
  { key: "g9", header: "Grade 9" },
  { key: "psa10", header: "PSA 10" },
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

const file = join(ROOT, "data/top-raw.json");
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
  const imgUrl = c.pcImg ? c.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg") : null;
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
      // argue that its one failing row was a moved price because all 400 rows
      // fell into exactly two classes, identical or moved-and-reconciled, with
      // none left over. A `change` recorded only on failures cannot support
      // that claim, and the figure is free: the page is already in hand.
      if (listing != null && product != null && product !== listing) {
        const change = columnChange(html, col.header);
        out.cols[col.key].change = change;
        if (change != null) out.cols[col.key].reconciles = Number((product - change).toFixed(2)) === listing;
      }
    }
    // The ranking column IS the row's verdict. See the header.
    const u = out.cols.ungraded;
    out.product = u.product;
    out.status = u.status === "agree" ? "agree" : u.status === "unreadable" ? "unreadable" : "disagree";
    out.headers = got.headers;
    if (out.status === "agree") agree += 1;
    else if (out.status === "unreadable") unreadable += 1;
    else disagree += 1;
  }

  results.push(out);
  if (out.status !== "agree" || !imgOk)
    console.log(
      `  ${out.status.toUpperCase().padEnd(10)} #${c.rank} ${c.name} (${c.set})  ` +
        `listing ${c.ungraded}  product ${out.product ?? out.error ?? out.cols.ungraded?.status}  ` +
        `img=${imgOk ? imgBytes + "B" : "MISSING"}`,
    );
  if ((n + 1) % 40 === 0) console.log(`  ...${n + 1}/${rows.length}`);
}

// Every column that will not be printed, counted, so the build and the report
// can say how much of the graded detail survived rather than only the ranking.
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
  ran: localDay(),
  method:
    "re-read the Ungraded, Grade 9 and PSA 10 columns from each product page, mapping columns by <th> label",
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
      "  data/top-raw.json with rank, name, set, listing, product, decided,\n" +
      "  public and why. The row stays off the page either way. Do not edit a\n" +
      "  row's status. See shared/graded-gate.mjs.",
  );
}
