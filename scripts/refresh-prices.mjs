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
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONSOLE_HEADERS, PC_CONSOLES, parsePage, unent } from "../shared/pricecharting.mjs";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-console");
const STATE = join(ROOT, "data/price-rotation.json");
const SITEMAP_TTL_DAYS = 7;
/* THE SAME IDENTITY THE OTHER CRAWL USES, AND THE COMMENT THAT SAID SO WAS
   WRONG. This read "Mozilla/5.0 (compatible; ...)" while claiming to match
   sync-graded-top.mjs, which it did not. Two strings from one operator means a
   throttle or a block applied to the known identity does not cover the
   unattended nightly, and leading with Mozilla/5.0 is browser mimicry rather
   than the honest identification this site owes a server it crawls. */
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";

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
  /* PACING BELONGS ON EVERY PATH, NOT JUST THE HAPPY ONE. The first version
     slept only after a successful write, so the moment PriceCharting started
     refusing us the crawler dropped all spacing and fired the whole batch at
     network speed. Being told to back off must not make us faster. A refusal
     waits LONGER, and a 429 or 403 longer again. */
  if (!r) { failed += 1; await sleep(3000); return null; }
  if (!r.ok) {
    console.log(`  HTTP ${r.status}  ${url}`);
    failed += 1;
    await sleep(r.status === 429 || r.status === 403 ? 15000 : 3000);
    return null;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const html = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  await sleep(1100);
  /* VALIDATE BEFORE OVERWRITING, because the cache entry we are about to
     destroy is the only copy. A Cloudflare interstitial, a login wall, a
     maintenance page and an empty body are all HTTP 200, and the first version
     wrote every one of them over a good page and counted it as a success. A
     console listing has a canonical link and these exact columns; anything else
     is not one, whatever the status code said. */
  if (!isConsolePage(html)) {
    console.log(`  200 but not a console listing, keeping the cached copy  ${url}`);
    failed += 1;
    return null;
  }
  await writeFile(keyFor(url), html);
  fetched += 1;
  return html;
}

/** Does this look like the console listing we asked for, rather than a wall? */
function isConsolePage(html) {
  if (!html || html.length < 2000) return false;
  if (!/rel="canonical" href="/.test(html)) return false;
  const { headers } = parsePage(html);
  return headers.length > 0 && headers.join("|") === CONSOLE_HEADERS.join("|");
}

/** Every page of one console, following the cursor exactly as the crawl does. */
async function refreshConsole(path) {
  let cursor = 0, guard = 0, pages = 0, complete = false;
  for (;;) {
    const url = `https://www.pricecharting.com${encPath(path)}?exclude-hardware=true` +
      (cursor ? `&cursor=${cursor}` : "");
    if (DRY) { console.log(`  would fetch  ${url}`); return { pages: 1, complete: true }; }
    const html = await refetch(url);
    // STOPPED BECAUSE WE WERE REFUSED, NOT BECAUSE WE REACHED THE END.
    // 27 of the 28 hot consoles are multi-page (83 pages for 28 consoles), so a
    // single 429 on page 3 of 5 used to leave that set 40% refreshed while the
    // run reported the console done and dated every card in it as read today.
    if (!html) break;
    pages += 1;
    const { next } = parsePage(html);
    if (next == null || next <= cursor || ++guard > 200) { complete = true; break; }
    cursor = next;
  }
  return { pages, complete };
}

/** Every Pokemon console path, from PriceCharting's own sitemap. Never guessed. */
async function allConsoles() {
  const url = "https://www.pricecharting.com/sitemap.xml";
  const k = keyFor(url);
  /* THE LIST HAS A SHELF LIFE. The first version read the cached sitemap if it
     existed at all, so the copy fetched on 22 August would have been the
     rotation's idea of the world forever: consoles added after it never entered
     the rotation, and consoles removed were re-requested every cycle as 404s. */
  let xml = null;
  const age = existsSync(k) ? (Date.now() - (await stat(k)).mtimeMs) / 86400000 : Infinity;
  if (age <= SITEMAP_TTL_DAYS) xml = await readFile(k, "utf8");
  else if (DRY) return Object.values(PC_CONSOLES);
  else {
    console.log(`  the console list is ${age === Infinity ? "missing" : `${Math.round(age)}d old`}, re-reading the sitemap`);
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } }).catch(() => null);
    await sleep(1100);
    if (r && r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      xml = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
      if (xml.includes("<loc>")) await writeFile(k, xml);
      else xml = null;
    }
    // Falling back to a stale list beats refreshing nothing at all.
    if (!xml && existsSync(k)) { console.log("  sitemap refused, using the cached list"); xml = await readFile(k, "utf8"); }
  }
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
const state = existsSync(STATE) ? JSON.parse(await readFile(STATE, "utf8")) : {};
/* A BOOKMARK PER CONSOLE, NOT AN INDEX INTO A LIST THAT MOVES. The first
   version stored a cursor position, and `tail` is sorted, so a single console
   added or removed upstream shifted every later index and silently cost one
   console per event: one re-fetched, one skipped, with no record of which. It
   also advanced on nights when every fetch failed, so a blocked run still burnt
   30 days of rotation. Recording the DAY EACH PATH WAS LAST REFRESHED is immune
   to all of that: the next batch is simply the ones least recently done, and a
   path that failed is not marked, so it comes back tomorrow. */
state.refreshed = state.refreshed || {};

const hotPaths = [...new Set(Object.values(PC_CONSOLES))];
const plan = [];
if (HOT) plan.push(...hotPaths.map((p) => ["hot", p]));

let tailLen = null;
if (COLD) {
  const all = await allConsoles();
  if (!all) console.log("  the console list could not be read, so the cold rotation is skipped this run");
  else {
    const hot = new Set(hotPaths);
    const tail = all.filter((p) => !hot.has(p));
    tailLen = tail.length;
    // Never refreshed sorts first, then oldest first, then by path so it is stable.
    const due = [...tail].sort((a, b) =>
      (state.refreshed[a] || "").localeCompare(state.refreshed[b] || "") || a.localeCompare(b));
    plan.push(...due.slice(0, Math.min(COLD, tail.length)).map((p) => ["cold", p]));
  }
}

console.log(`${plan.length} console(s) to refresh` +
  (tailLen ? `: ${plan.filter((x) => x[0] === "hot").length} hot, ${plan.filter((x) => x[0] === "cold").length} cold ` +
    `of a ${tailLen} tail, one full pass every ${Math.ceil(tailLen / COLD)} days` : ""));

let pages = 0, hotOk = 0, coldOk = 0;
const failing = state.failing || {};
for (const [tier, path] of plan) {
  const { pages: n, complete } = await refreshConsole(path);
  pages += n;
  /* ONLY A CONSOLE THAT RAN TO THE END OF ITS OWN PAGINATION IS DONE. A
     partial one is left unmarked so it is retried tomorrow, and its set keeps
     the read date it can actually support. */
  if (complete && n > 0) {
    if (!DRY) { state.refreshed[path] = localDay(); delete failing[path]; }
    if (tier === "hot") hotOk += 1; else coldOk += 1;
  } else {
    if (!DRY) failing[path] = (failing[path] || 0) + 1;
    if (tier === "hot") console.log(`  incomplete, will retry tomorrow: ${path}`);
  }
}
/* A PATH THAT CAN NEVER SUCCEED MUST NOT HOLD A SLOT FOREVER. Never-refreshed
   sorts first, so one permanently unfetchable console sits at the head of the
   queue every night. PriceCharting's sitemap contains at least one today:
   /console/pokemon-mini is the HANDHELD, whose columns are Loose/CIB/New, so it
   can never pass the console-listing check. Twenty-six such paths would stop
   the rotation dead while still logging "one full pass every 30 days". After
   five straight failures a path is parked with a date far in the past, which
   sorts it last instead of first and lets the tail move again. */
if (!DRY) {
  for (const [path, n] of Object.entries(failing)) {
    if (n >= 5 && !state.refreshed[path]) state.refreshed[path] = "1970-01-01";
  }
  state.failing = failing;
  const parked = Object.entries(failing).filter(([p, n]) => n >= 5).map(([p]) => p);
  if (parked.length) console.log(`  ${parked.length} console(s) parked after 5 failures: ${parked.slice(0, 3).join(", ")}`);
}

if (!DRY) {
  /* lastRun IS EARNED TOO, and it was the one field that was not.
     check-freshness.mjs watches it on a 3 day leash, and it was stamped
     unconditionally and written BEFORE the failure exit below, so a night where
     PriceCharting refused everything still moved it and the watchdog stayed
     green on one of its three price signals. It moves only when something
     actually came back. */
  if (hotOk > 0 || coldOk > 0) state.lastRun = localDay();
  state.tail = tailLen ?? state.tail ?? null;
  state.cycleDays = tailLen && COLD ? Math.ceil(tailLen / COLD) : state.cycleDays ?? null;
  /* `lastHot` IS WHAT DATES EVERY PRICE ON THE SITE, so it moves only when the
     hot tier actually produced pages. The first version assigned it
     unconditionally, which meant a night when all 28 consoles were refused still
     stamped today onto week-old numbers, through sync-pricecharting-cards.mjs and
     into pricesChecked on every set file. That is exactly the lie this pipeline
     was built to prevent, and it also blinded check-freshness.mjs, whose three
     price leashes all hang off this field. If the hot tier got nothing, the old
     date stands and the watchdog goes red on schedule. */
  if (HOT && hotOk > 0) state.lastHot = localDay();
  state.lastHotConsoles = HOT ? hotOk : state.lastHotConsoles ?? null;
  await writeFile(STATE, JSON.stringify(state, null, 2) + "\n");
}

console.log(`\n${pages} page(s) written, ${fetched} fetched, ${failed} refused.` +
  (HOT ? `  Hot: ${hotOk}/${hotPaths.length} consoles.` : ""));
console.log("Next: node scripts/sync-pricecharting-cards.mjs, then node scripts/sync-cards.mjs --prices");

/* FAIL LOUDLY WHEN THE WORK DID NOT HAPPEN, and judge each tier on its own
   count rather than on a shared failed-vs-fetched ratio, which mixed pages with
   requests and flipped green on the pagination depth of the tail. */
if (!DRY && HOT && hotOk < hotPaths.length / 2) {
  console.error(`\nOnly ${hotOk} of ${hotPaths.length} set-guide consoles refreshed. Treating that as a real`);
  console.error(`failure: prices keep their previous read date and check-freshness.mjs will say so.`);
  process.exit(1);
}
