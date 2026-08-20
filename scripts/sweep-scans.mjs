// Find the card scans that do not exist, by reading the BUILT TREE rather than
// a hand-written list of pages, and write them into data/no-scan.json so the
// builders skip them.
//
// WHY THIS SCRIPT EXISTS AT ALL, AND WHY IT READS public/ INSTEAD OF data/.
// data/no-scan.json was first filled on 2026-08-14 by sweeping "the 3,539
// tcgdex image urls the site emits". That number was a snapshot of one
// afternoon's tree and it was never a rule, so the guard could only ever cover
// the pages that existed the day somebody looked. Re-measured on 2026-08-18 the
// same tree emits 24,237 distinct TCGdex bases into HTML, seven times as many,
// and 371 of them answer 404. The 101 in the file were 27% of the real problem
// and nobody could tell, because the failure is silent: every one of these
// images carries onerror="this.remove()", so the picture vanishes and the
// reader gets a card with a name, a rarity and a hole where the scan was.
//
// THE FIX IS THE INPUT, NOT THE OUTPUT. A sweep whose input is a list of pages
// goes stale the first time somebody adds a page; a sweep whose input is
// "every url in public/" cannot, because public/ IS what a reader gets. So the
// extraction below globs the whole built tree and takes every assets.tcgdex.net
// url out of it with a regex, and the count it prints is the count of the
// surface. If that number ever drops sharply, the tree did not shrink: the
// extraction broke.
//
// IT READS THE JSON UNDER public/data TOO, and that is deliberate rather than
// sloppy. Those files are fetched by the search page and by the games, which
// build <img> urls out of them in the browser, so a dead base in card-index.json
// is exactly as dead to a reader as one in a page. They are counted and reported
// separately so the two surfaces stay distinguishable.
//
// THE LIST ONLY EVER GROWS UNLESS YOU ASK. Builders skip everything already in
// the file, so those urls are no longer IN the tree and a fresh sweep cannot
// see them: taking the sweep's answer as the whole truth would empty the file
// on the second run and reintroduce every 404 it ever found. So the default is
// UNION, and `--recheck` is the flag that re-tests the entries already on file
// for the case where TCGdex backfills a scan. Stale in that direction costs one
// missing picture; stale the other way costs a dead round trip on every load,
// which is the whole point of the file.
//
//   node scripts/sweep-scans.mjs              sweep the tree, union the result
//   node scripts/sweep-scans.mjs --recheck    also re-test what is on file
//   node scripts/sweep-scans.mjs --dry        report, write nothing
//
// This makes network requests to somebody else's CDN, a few tens of thousands
// of them, so it is NOT in build-all.mjs and must not be added to it. Same
// arrangement as sync-decks.mjs and verify-topps-top.mjs, and for the same
// reason: a scheduled build must not depend on a step that is not scheduled.
//
// IT ONLY TOUCHES THE TCGDEX HALF OF THE FILE. `deadUrls` records images on the
// other three hosts (TCGplayer 403s, mostly) and is maintained by whoever is
// working on those pages; this script reads it, leaves it exactly as it found
// it and writes it back unchanged.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const OUT = join(ROOT, "data/no-scan.json");
const RECHECK = process.argv.includes("--recheck");
const DRY = process.argv.includes("--dry");
const CONC = 24;

// The card-scan url shape. A base is everything before the rendition, so one
// entry covers low/high and webp/avif at once, which is why the file stores
// bases rather than urls.
const TCGDEX = /https:\/\/assets\.tcgdex\.net\/[A-Za-z0-9._/-]+/g;
const RENDITION = /\/(low|high)\.(webp|avif|png|jpg)$/;

// A CARD base is lang/serie/set/number. Three segments is a SET base, which is
// where the set logo and symbol live, and those take different suffixes
// (/logo.webp, /symbol.webp) so they are not card scans and are not swept here.
const isCardBase = (u) =>
  u.replace("https://assets.tcgdex.net/", "").split("/").length === 4;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const fromHtml = new Set();
const fromJson = new Set();
let htmlFiles = 0;
let jsonFiles = 0;
for await (const p of walk(PUBLIC)) {
  const isHtml = p.endsWith(".html");
  const isJson = p.endsWith(".json");
  if (!isHtml && !isJson) continue;
  isHtml ? htmlFiles++ : jsonFiles++;
  const text = await readFile(p, "utf8");
  for (const m of text.matchAll(TCGDEX)) {
    const base = m[0].replace(RENDITION, "");
    if (!isCardBase(base)) continue;
    (isHtml ? fromHtml : fromJson).add(base);
  }
}

const emitted = new Set([...fromHtml, ...fromJson]);
console.log(`Swept ${htmlFiles} html and ${jsonFiles} json files under public/`);
console.log(`  ${fromHtml.size} card bases in HTML, ${fromJson.size} in JSON, ${emitted.size} distinct`);

const doc = JSON.parse(await readFile(OUT, "utf8"));
const known = new Set(doc.bases || []);
console.log(`  ${known.size} already on file`);

const todo = [...emitted].filter((b) => !known.has(b));
if (RECHECK) todo.push(...known);
console.log(`  ${todo.length} to check${RECHECK ? " (including a recheck of the file)" : ""}`);

// A 404 on the low rendition is the answer for the base: TCGdex either has the
// scan at both widths or at neither. That was checked rather than assumed on
// the 2026-08-14 sweep and it held on all 101.
const dead = [];
const errors = [];
const revived = [];
let done = 0;
async function worker(queue) {
  for (;;) {
    const base = queue.pop();
    if (!base) return;
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${base}/low.webp`, { method: "HEAD" });
        status = r.status;
        break;
      } catch (e) {
        if (attempt === 2) errors.push([base, String(e)]);
        else await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (status === 404) dead.push(base);
    else if (status && status >= 400 && status !== 404) errors.push([base, status]);
    else if (status === 200 && known.has(base)) revived.push(base);
    if (++done % 1000 === 0) console.log(`  ...${done}/${todo.length}`);
  }
}
const queue = todo.slice();
await Promise.all(Array.from({ length: CONC }, () => worker(queue)));

console.log(`\n${dead.length} answered 404`);
if (revived.length) console.log(`${revived.length} on file now answer 200 (TCGdex backfilled them)`);
if (errors.length) {
  console.log(`${errors.length} could not be read and are NOT recorded either way:`);
  for (const [u, e] of errors.slice(0, 10)) console.log(`   ${u} ${e}`);
}

// Where the dead ones live, because the answer has always been "promos nobody
// scanned" and a shift in that shape is worth noticing.
const bySet = new Map();
for (const b of dead) {
  const k = b.replace("https://assets.tcgdex.net/", "").split("/").slice(0, 3).join("/");
  bySet.set(k, (bySet.get(k) || 0) + 1);
}
console.log("\nWorst sets:");
for (const [k, n] of [...bySet].sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`   ${String(n).padStart(4)}  ${k}`);

if (DRY) {
  console.log("\n--dry: nothing written");
} else {
  // UNION unless --recheck, and even then only drop an entry we actually saw
  // answer 200. An entry that errored out stays, because "we could not tell" is
  // not evidence that it works.
  const next = new Set([...known, ...dead]);
  if (RECHECK) for (const b of revived) next.delete(b);
  doc.bases = [...next].sort();
  doc.basesChecked = localDay();
  await writeFile(OUT, JSON.stringify(doc, null, 1) + "\n");
  console.log(`\ndata/no-scan.json: ${known.size} -> ${doc.bases.length} bases`);
}
