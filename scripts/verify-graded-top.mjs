#!/usr/bin/env node
// Re-read every published PSA 10 figure from a DIFFERENT page, and check the
// card scan actually exists.
//
//   node scripts/verify-graded-top.mjs           top 120 rows (cache-first)
//   node scripts/verify-graded-top.mjs --all     every row in the file
//   node scripts/verify-graded-top.mjs --refresh ignore the cache
//
// Reads and rewrites data/top-graded.json, adding a `verify` block.
// build-top-graded.mjs REFUSES TO BUILD without one whose `for` stamp matches
// the crawl, so a re-crawl invalidates the verification instead of silently
// inheriting it.
//
// WHY A SECOND READ IS WORTH 120 REQUESTS.
// sync-graded-top.mjs reads a CONSOLE LISTING: a wide table, three price
// columns, one row per card. This reads the PRODUCT page: a different template,
// six price columns, one card. Different HTML, different parser, same number
// expected. That is the only check that can catch the trap below, and one
// version of that trap is already live on this site's source data.
//
// THE TRAP THIS EXISTS FOR. The td ids are video-game legacy names and they
// mean DIFFERENT GRADES on the two page types:
//
//     console listing   used_price=Ungraded  cib_price=Grade 9  new_price=PSA 10
//     product page      used_price=Ungraded  new_price=Grade 8  manual_only_price=PSA 10
//
// So `new_price` is PSA 10 on one page and Grade 8 on the other. On Base Set
// Charizard #4 that is $28,144.52 against $1,330.50: a 21x error that reads as
// an entirely reasonable price for the card, on a page where every other number
// is fine. Nothing about it looks wrong.
//
// The defence is that NEITHER script trusts an id. Both map columns from the
// <th> labels sitting above them, and this one throws away any product page
// whose header row does not actually contain a "PSA 10" column rather than
// falling back to a position. A page it cannot read is reported as unreadable,
// never as agreeing.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-product");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const REFRESH = process.argv.includes("--refresh");
const ALL = process.argv.includes("--all");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const unent = (s) =>
  String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
// Decode BEFORE trimming. See sync-graded-top.mjs: the other order silently
// turned "&nbsp;" into an untrimmed space and skipped all 793 consoles.
const text = (s) => unent(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const money = (s) => {
  const n = Number(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
    out = `__HTTP_${r.status}__`;
  } else {
    const buf = Buffer.from(await r.arrayBuffer());
    out = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  }
  await writeFile(key, out);
  await sleep(1100);
  return out;
}

/**
 * The PSA 10 price from a product page, mapped by HEADER not by id.
 * Returns {psa10, headers} or {error}.
 */
function psa10From(html) {
  if (/^__HTTP_(\d+)__$/.test(html)) return { error: `http ${/\d+/.exec(html)[0]}` };
  let seen = null;
  for (const m of html.matchAll(/<thead>(.*?)<\/thead>\s*<tbody>(.*?)<\/tbody>/gs)) {
    const heads = [...m[1].matchAll(/<th[^>]*>(.*?)<\/th>/gs)].map((x) => text(x[1])).filter(Boolean);
    const cells = [...m[2].matchAll(/<td id="([a-z_]+price)"[^>]*>(.*?)<\/td>/gs)];
    if (!heads.length || heads.length !== cells.length) continue;
    seen = heads;
    const i = heads.indexOf("PSA 10");
    if (i < 0) continue;
    const v = /<span class="price js-price"[^>]*>(.*?)<\/span>/s.exec(cells[i][2]);
    return { psa10: money(text(v ? v[1] : cells[i][2])), headers: heads, id: cells[i][1] };
  }
  return { error: seen ? `no PSA 10 column (saw ${seen.join("|")})` : "no price table" };
}

const file = join(ROOT, "data/top-graded.json");
const d = JSON.parse(await readFile(file, "utf8"));
const rows = ALL ? d.cards : d.cards.slice(0, 120);
console.log(`Verifying ${rows.length} rows against their product pages, one a second...`);

const results = [];
let agree = 0;
let disagree = 0;
let unreadable = 0;
let noImg = 0;

for (const [n, c] of rows.entries()) {
  const got = psa10From(await get(c.url));
  // The scan is checked too. A row whose picture 404s must SAY it has no scan,
  // not paint a placeholder that reads as a real card face.
  const imgUrl = c.pcImg ? c.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg") : null;
  const head = imgUrl ? await get(imgUrl, true) : "0";
  const imgOk = /^200 /.test(head);
  const imgBytes = Number((/^200 (\d+)/.exec(head) || [])[1] || 0);
  if (!imgOk) noImg += 1;

  let status;
  if (got.error) {
    status = "unreadable";
    unreadable += 1;
  } else {
    // A guide value moves between two reads on different days. This is a check
    // that we read the RIGHT COLUMN, not that the market held still, so the
    // tolerance is generous and a 21x id mix-up cannot hide inside it.
    const within = got.psa10 && Math.abs(got.psa10 - c.psa10) / c.psa10 <= 0.15;
    status = within ? "agree" : "disagree";
    within ? (agree += 1) : (disagree += 1);
  }
  results.push({
    rank: c.rank, name: c.name, set: c.set,
    listing: c.psa10, product: got.psa10 ?? null,
    status, ...(got.error ? { error: got.error } : {}),
    imgOk, imgBytes,
  });
  if (status !== "agree" || !imgOk)
    console.log(`  ${status.toUpperCase().padEnd(10)} #${c.rank} ${c.name} (${c.set})  listing ${c.psa10}  product ${got.psa10 ?? got.error}  img=${imgOk ? imgBytes + "B" : "MISSING"}`);
  if ((n + 1) % 40 === 0) console.log(`  ...${n + 1}/${rows.length}`);
}

d.verify = {
  // Stamped against the crawl this verified. build-top-graded.mjs compares
  // these, so a re-crawl cannot silently inherit an old verification.
  for: d.checked,
  ran: new Date().toISOString().slice(0, 10),
  method: "re-read the PSA 10 column from each product page, mapping columns by <th> label",
  tolerance: 0.15,
  checked: results.length,
  agree, disagree, unreadable,
  imagesMissing: noImg,
  rows: results,
};
await writeFile(file, JSON.stringify(d, null, 2) + "\n");

console.log(`\n${agree} agree, ${disagree} disagree, ${unreadable} unreadable, ${noImg} missing a scan`);
if (disagree) console.log("DISAGREEMENTS ARE NOT PUBLISHABLE. Fix the parse or drop the rows.");
