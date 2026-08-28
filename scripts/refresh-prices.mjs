#!/usr/bin/env node
/**
 * Keep the PriceCharting page cache current, hot cards daily and the tail slowly.
 *
 *   node scripts/refresh-prices.mjs --hot            the 28 set-guide consoles
 *   node scripts/refresh-prices.mjs --cold 26        the next 26 of the tail
 *   node scripts/refresh-prices.mjs --hot --cold 26  what the nightly runs
 *   node scripts/refresh-prices.mjs --hot --dry-run  print the plan, fetch nothing
 *
 * WHY THIS EXISTS. The owner, 28 August 2026: "can we do targeted price updates daily
 * for the cards that are on the pages the most or most valuable or ones that
 * are shown in the set guides etc, but then for the rest of the cards do slow
 * overnight updates daily small batches can take a full month."
 *
 * Until now nothing refreshed prices at all. sync-pricecharting-cards.mjs makes
 * NO network request by design and reads a cache that only a hand-run
 * sync-graded-top.mjs ever filled, so every price on the site was frozen at
 * whenever somebody last ran that crawl. It was six days old when this was written.
 *
 * THE UNIT IS A CONSOLE PAGE, NOT A CARD, AND THAT IS WHAT MAKES THIS CHEAP.
 * PriceCharting's console listing carries Ungraded, Grade 9 and PSA 10 side by
 * side for every card in the set, so one page refreshes a whole set's prices.
 * The 28 sets with guides are 28 paths, about 40 pages with pagination, roughly
 * 45 seconds at the pacing below. The other ~765 consoles are the tail that
 * feeds the ranked pages, and 26 a night walks all of them in about a month.
 *
 * IT WRITES NOTHING BUT CACHE. Every figure still reaches the site through
 * sync-pricecharting-cards.mjs and sync-cards.mjs exactly as before, and the
 * ranked pages keep their two-read gate: a price read once is still not
 * publishable, and this changes none of that. It only makes the bytes fresher.
 *
 * POLITENESS IS THE CONSTRAINT, NOT SPEED. Same 1.1s pacing, same User-Agent
 * and same exclude-hardware=true as sync-graded-top.mjs, because this is the
 * same crawl against the same server, just spread out. Do not raise the batch
 * size to "catch up" -- a month is the design, not a limitation.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PC_CONSOLES, parsePage, unent } from "../shared/pricecharting.mjs";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-console");
const STATE = join(ROOT, "data/price-rotation.json");
const UA = "Mozilla/5.0 (compatible; garbagerips.com price refresh; +https://garbagerips.com/)";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const HOT = args.includes("--hot");
const coldAt = args.indexOf("--cold");
const COLD = coldAt >= 0 ? Math.max(0, parseInt(args[coldAt + 1] || "0", 10) || 0) : 0;
if (!HOT && !COLD) { console.error("Nothing asked for. Pass --hot and/or --cold N."); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A console path is a PATH and 46 of the 793 carry "&" or "'". Same encoder as
// sync-graded-top.mjs, and for the same reason: encodeURI leaves "&" alone, so
// "/console/pokemon-black-&-white?cursor=0" would parse as a stray query param.
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");
const keyFor = (url) => join(CACHE, createHash("sha1").update(url).digest("hex") + ".html");

let fetched = 0, failed = 0;

/** Fetch and overwrite the cache entry. Returns html, or null on any refusal. */
async function refetch(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } }).catch((e) => {
    console.log(`  NET   ${e.code || e.message}  ${url}`); return null;
  });
  if (!r) { failed += 1; return null; }
  if (!r.ok) { console.log(`  HTTP ${r.status}  ${url}`); failed += 1; return null; }
  const buf = Buffer.from(await r.arrayBuffer());
  const html = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  await writeFile(keyFor(url), html);
  fetched += 1;
  await sleep(1100);
  return html;
}

/** Every page of one console, following the cursor exactly as the crawl does. */
async function refreshConsole(path) {
  let cursor = 0, guard = 0, pages = 0;
  for (;;) {
    const url = `https://www.pricecharting.com${encPath(path)}?exclude-hardware=true` +
      (cursor ? `&cursor=${cursor}` : "");
    if (DRY) { console.log(`  would fetch  ${url}`); return 1; }
    const html = await refetch(url);
    if (!html) break;
    pages += 1;
    const { next } = parsePage(html);
    if (next == null || next <= cursor || ++guard > 200) break;
    cursor = next;
  }
  return pages;
}

/** Every Pokemon console path, from PriceCharting's own sitemap. Never guessed. */
async function allConsoles() {
  const url = "https://www.pricecharting.com/sitemap.xml";
  const k = keyFor(url);
  let xml;
  if (existsSync(k)) xml = await readFile(k, "utf8");
  else if (DRY) return Object.values(PC_CONSOLES);
  else xml = await refetch(url);
  if (!xml) return null;
  const paths = new Set();
  for (const m of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const u = unent(m[1]);
    if (!u.includes("/console/pokemon")) continue;
    paths.add(decodeURIComponent(new URL(u).pathname));
  }
  return [...paths].sort();
}

await mkdir(CACHE, { recursive: true });
const state = existsSync(STATE) ? JSON.parse(await readFile(STATE, "utf8")) : { cursor: 0 };

const hotPaths = [...new Set(Object.values(PC_CONSOLES))];
let plan = [];
if (HOT) plan.push(...hotPaths.map((p) => ["hot", p]));

let all = null;
if (COLD) {
  all = await allConsoles();
  if (!all) console.log("  the sitemap could not be read, so the cold rotation is skipped this run");
  else {
    const hot = new Set(hotPaths);
    const tail = all.filter((p) => !hot.has(p));
    // Wrap, so the cursor walks the tail forever and never runs off the end.
    const start = tail.length ? state.cursor % tail.length : 0;
    for (let i = 0; i < Math.min(COLD, tail.length); i += 1) plan.push(["cold", tail[(start + i) % tail.length]]);
    state.cursor = tail.length ? (start + Math.min(COLD, tail.length)) % tail.length : 0;
    state.tail = tail.length;
    state.cycleDays = COLD ? Math.ceil(tail.length / COLD) : null;
  }
}

console.log(`${plan.length} console(s) to refresh` +
  (all ? `: ${plan.filter((p) => p[0] === "hot").length} hot, ${plan.filter((p) => p[0] === "cold").length} cold ` +
    `of a ${state.tail} tail, one full pass every ${state.cycleDays} days` : ""));

let pages = 0;
for (const [tier, path] of plan) {
  const n = await refreshConsole(path);
  pages += n;
  if (tier === "hot" && n === 0) console.log(`  nothing came back for ${path}`);
}

if (!DRY) {
  state.lastRun = localDay();
  state.lastHot = HOT ? localDay() : state.lastHot || null;
  await writeFile(STATE, JSON.stringify(state, null, 2) + "\n");
}

console.log(`\n${pages} page(s) refreshed, ${fetched} fetched, ${failed} refused.`);
console.log("Next: node scripts/sync-pricecharting-cards.mjs, then node scripts/sync-cards.mjs --prices");

/* FAIL LOUDLY ONLY ON A SYSTEMIC REFUSAL. One 404 is evidence about one url; a
   run where most of the batch was refused means we are blocked or they have
   moved, and that must not pass as a quiet success the way the dead nightly did. */
if (!DRY && plan.length && failed > fetched) {
  console.error("\nMost of this batch was refused. Treating that as a real failure rather than a quiet one.");
  process.exit(1);
}
