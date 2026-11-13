#!/usr/bin/env node
/**
 * Fail when the data the nightly is supposed to keep current has stopped moving.
 *
 * WHY THIS EXISTS, AND WHY IT RUNS IN verify.yml RATHER THAN IN THE NIGHTLY.
 * On 28 August 2026 the owner asked whether prices refresh daily. They did not:
 * the nightly had not fired at all on the 27th or 28th, every price stamp was
 * six days old, and NOTHING WAS RED. A check that lives inside the nightly
 * cannot fire when the nightly is the thing that is broken, so this runs on
 * every push instead, where a person is already looking.
 *
 * This repo has been here before. a5a28915d is titled "The nightly refresh has
 * been dead for five days, and it looked normal", and the Pages deploy once
 * froze for twelve days behind a concurrency group with no timeout. The pattern
 * is always the same: the thing that stops is silent, and the dashboard is green.
 *
 * THE STAMP IS THE MEASUREMENT, NOT THE FILE MTIME. A checkout rewrites mtimes,
 * so only the date the sync itself wrote means anything.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Days of grace per file. Anything the nightly touches every run gets a short
   leash; a rotating sync gets its own rotation length plus a day. */
const WATCH = [
  ["public/data/videos.json",       ["syncedAt"],      3, "the YouTube sync"],
  ["public/data/preorders.json",    ["checked"],       4, "preorder prices"],
  // RETIRED 13 November 2026: nothing reads PriceCharting any more (shared/no-pricecharting.mjs).
  // ["data/price-rotation.json",      ["lastRun"],       3, "the nightly PriceCharting refresh"],
  // ["data/pricecharting-cards.json", ["checked"],       3, "the 28 set-guide consoles, refreshed nightly"],
  ["public/data/card-index.json",   ["pricesChecked"], 3, "every card price on the site"],
];

/* data/graded.json WAS ON THIS LIST FOR ONE COMMIT AND THE LEASH WAS WRONG THE
   SAME WAY sets.json's WAS, IN THE SAME EDIT. Its line read "PSA 10 prices, 50 a
   night by rotation", which describes sync-prices.mjs -- and sync-prices.mjs
   writes data/psa10.json, NOT graded.json. graded.json is written by
   sync-pricecharting.mjs, which is hand run and in no workflow, and its own
   readme says "A SNAPSHOT, NOT A FEED ... these do not refresh overnight". At a
   10 day leash it would have failed EVERY PUSH from 3 September onwards.
   Watching PSA 10 properly needs a stamp psa10.json does not carry: its dates
   are per entry (`asOf`), so it wants a max() over entries and a leash measured
   against the 50-a-night rotation. That is a real change, and inventing a third
   number rather than measuring one is exactly the mistake being corrected here.

   WHAT IS DELIBERATELY NOT WATCHED, so nobody adds it back as a false alarm.
   public/data/sets.json is sync-sets.mjs against api.pokemontcg.io, which is
   HAND RUN and whose syncedAt only moves when the set LIST changes. It was on
   this list for one commit at an 8 day leash, went red immediately at 12 days,
   and the number was invented rather than checked. This file watches what the
   nightly OWNS; a hand-run sync going quiet is a different question and wants a
   different answer than failing every push. */

/* THE SECOND TIER, 11 November 2026: EVERYTHING ELSE A PAGE PRINTS A FIGURE
   FROM. SOFT. IT NEVER CHANGES THE EXIT CODE.

   The hard tier above is five files, and an audit that day found that a soft
   nightly step (sealed prices, 30th prices, PSA 10) or a hand-run sync could
   stop for months with no red anywhere. The paragraph above explains why those
   must not FAIL a push: a hand-run file going quiet "wants a different answer".
   This is that answer: a table on every run, a ::warning per overdue row when
   this runs in Actions, and exit 0 from this tier always. verify.yml depends on
   the hard tier's exit code and that is untouched.

   Each row: file, how to read its date, leash in days, who refreshes it, what
   it is. `nightly` rows get the same short leash as the hard tier. `hand` rows
   get a REVIEW leash: how long before somebody should look again. THE HAND
   LEASHES ARE PROPOSALS, NOT MEASUREMENTS, and are the owner's to change:
   90 days for fee schedules, MSRPs and shop listings, 45 for shelf prices and
   the sealed ranking, 14 for the show calendar. (The graded snapshot and the
   three card rankings were hand rows at 30 and 45 until the weekly job took
   them; see the weekly owner below.)
   The sets and expansions stamps only move when the set LIST changes, so 100
   days there means "a new set has come out and nobody ran the sync".

   The date readers: a list of top-level keys (first one holding a date wins),
   or a function of the parsed file for the two that keep their date elsewhere. */
/* THE WEEKLY OWNER, 11 November 2026. Five of the hand rows moved to
   .github/workflows/weekly-prices.yml ("Weekly price lists"), which runs on
   Sundays. Their leash is 10 days: one missed week is a warning, not two.
   Still soft. The job has its own alert issue for a week that fails; this row
   is the backstop for a week that never ran at all.

   THE THREE RANKED LISTS ARE READ BY `verify.ran`, NOT `checked`. Since the
   weekly job took them over, `checked` is the OLDEST console listing read
   behind the rows (the nightly's cache is a month deep by design, see
   scripts/weekly-check.mjs), so it sits two to four weeks back on a healthy
   week. `verify.ran` is the day every published row was last re-read from its
   product page, which is the thing the weekly job does and the thing that
   stops when it stops. */
const verifyRan = (doc) => doc.verify && doc.verify.ran;
const newestAsOf = (doc) =>
  Object.values(doc.auto || {}).map((v) => v && v.asOf).filter((v) => typeof v === "string").sort().pop();

const SOFT = [
  // refreshed by the nightly, through steps that are allowed to fail
  ["public/data/products.json",               ["checked"],   3, "nightly", "sealed product prices (sync-products.mjs)"],
  ["public/data/products-intl.json",          ["checked"],   3, "nightly", "foreign sealed product prices (sync-products.mjs)"],
  ["public/data/intl-sets.json",              ["checked"],   3, "nightly", "foreign-language set list (sync-intl.mjs)"],
  ["public/data/intl-guides.json",            ["checked"],   3, "nightly", "non-English set guides (sync-intl-guides.mjs)"],
  ["data/30th-prices.json",                   ["checked"],   3, "nightly", "30th Celebration prices (sync-30th-prices.mjs)"],
  ["public/data/cards/30th-celebration.json", ["checked"],   3, "nightly", "30th Celebration card file (sync-30th-card-data.mjs)"],
  ["data/chase-tcg.json",                     ["checked"],   3, "nightly", "TCGplayer product links (sync-chase.mjs)"],
  ["public/data/playlists.json",              ["syncedAt"],  3, "nightly", "playlists (sync-youtube.mjs)"],
  // 50 cards a night, so the NEWEST entry is at most a day old when it runs.
  ["data/psa10.json",                         newestAsOf,    3, "nightly", "PSA 10 prices, newest asOf in auto (sync-prices.mjs)"],
  // refreshed by the weekly job (weekly-prices.yml), through scripts/weekly-run.sh
  // RETIRED 13 November 2026: nothing reads PriceCharting any more (shared/no-pricecharting.mjs).
  // ["data/graded.json",                        ["checked"],  10, "weekly", "graded prices for pulled and chase cards (sync-pricecharting.mjs)"],
  // ["data/top-graded.json",                    verifyRan,    10, "weekly", "top graded cards, last re-verified (sync-graded-top.mjs + verify-graded-top.mjs)"],
  // ["data/top-raw.json",                       verifyRan,    10, "weekly", "most valuable cards, last re-verified (sync-raw-top.mjs + verify-raw-top.mjs)"],
  // ["data/topps-top.json",                     verifyRan,    10, "weekly", "Topps card values, last re-verified (sync-topps-top.mjs + verify-topps-top.mjs)"],
  // ["data/first-partner.json",                 ["checked"],  10, "weekly", "First Partner promo prices (sync-first-partner.mjs)"],
  // refreshed by hand
  ["data/drops.json",                         ["weekEnds"],  0, "hand", "this week's restock forecast; overdue once weekEnds has passed"],
  ["data/shows.json",                         ["checked"],  14, "hand", "card show calendar"],
  ["data/retailer-prices.json",               ["checked"],  45, "hand", "shelf prices read at retailers"],
  ["data/top100.json",                        ["checked"],  45, "hand", "most expensive sealed products (sync-top100.mjs)"],
  ["data/msrp.json",                          ["readOn"],   90, "hand", "MSRPs read from Pokemon Center"],
  ["data/pokemon-center-prices.json",         ["readOn"],   90, "hand", "Pokemon Center shelf prices"],
  ["data/grading.json",                       ["checked"],  90, "hand", "grading company fees and turnaround"],
  ["data/selling.json",                       ["checked"],  90, "hand", "selling venue fees"],
  ["data/buying.json",                        ["checked"],  90, "hand", "buying venue notes"],
  ["data/shops.json",                         ["updated"],  90, "hand", "local card shop listings and hours"],
  ["data/decks.json",                         ["checked"],  90, "hand", "deck usage from Limitless (sync-decks.mjs)"],
  ["public/data/sets.json",                   ["syncedAt"], 100, "hand", "English set list (sync-sets.mjs); moves when a set is added"],
  ["public/data/expansions.json",             ["syncedAt"], 100, "hand", "every expansion (sync-expansions.mjs); moves when a set is added"],
];

const JSON_OUT = process.argv.includes("--json");
const say = (line) => { if (!JSON_OUT) console.log(line); };
const today = localDay();
const days = (iso) => Math.round((new Date(today) - new Date(iso)) / 86400000);
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

/** One row of either tier: read the file, find its date, measure it. */
async function measure([rel, how, leash, owner, what], tier) {
  const row = { file: rel, tier, owner, leash, what, stamp: null, age: null, status: "ok", problem: null };
  const p = join(ROOT, rel);
  if (!existsSync(p)) return { ...row, status: "missing", problem: "is missing entirely" };
  let doc;
  try { doc = JSON.parse(await readFile(p, "utf8")); } catch { return { ...row, status: "unreadable", problem: "does not parse" }; }
  const found = typeof how === "function" ? how(doc) : how.map((k) => doc[k]).find(isDate);
  if (!isDate(found)) {
    const where = typeof how === "function" ? "the date it is read by" : `none of ${how.join(", ")}`;
    return { ...row, status: "undated", problem: `carries ${where}, so its freshness cannot be checked` };
  }
  row.stamp = found.slice(0, 10);
  row.age = days(row.stamp);
  if (row.age > leash) row.status = "stale";
  return row;
}

const hardRows = [];
for (const w of WATCH) hardRows.push(await measure([w[0], w[1], w[2], "nightly", w[3]], "hard"));
const softRows = [];
for (const w of SOFT) softRows.push(await measure(w, "soft"));

const bad = [];
for (const r of hardRows) {
  const line = `${r.file.padEnd(32)} ${r.stamp}  ${String(r.age).padStart(3)}d  (leash ${r.leash}d)  ${r.what}`;
  if (r.status === "missing") bad.push(`${r.file} is missing entirely (${r.what})`);
  else if (r.status === "unreadable") bad.push(`${r.file} does not parse`);
  else if (r.status === "undated") bad.push(`${r.file} ${r.problem}`);
  else if (r.status === "stale") bad.push(line);
  else say(`  ok    ${line}`);
}

if (JSON_OUT) {
  console.log(JSON.stringify({ today, hardStale: bad.length, rows: [...hardRows, ...softRows] }, null, 2));
} else {
  const overdue = softRows.filter((r) => r.status !== "ok");
  console.log("\nEverything else a page prints a figure from (soft: reported, never fails):\n");
  for (const r of softRows) {
    const mark = r.status === "ok" ? "ok   " : r.status === "stale" ? "LATE " : "CHECK";
    const when = r.stamp ? `${r.stamp}  ${String(r.age).padStart(3)}d` : "no date       ";
    console.log(`  ${mark} ${r.file.padEnd(40)} ${when}  (leash ${String(r.leash).padStart(3)}d, ${r.owner.padEnd(7)})  ${r.what}${r.problem ? ` -- ${r.problem}` : ""}`);
  }
  if (overdue.length) {
    console.log(`\n${overdue.length} of ${softRows.length} are past their leash or unreadable. Nightly rows: read the alert issue and the`);
    console.log(`"Nightly refresh" run. Weekly rows: read the "Weekly price lists are not healthy" issue and the "Weekly`);
    console.log(`price lists" workflow (weekly-prices.yml). Hand rows: RUNBOOK.md says which script refreshes each file.`);
    if (process.env.GITHUB_ACTIONS === "true") {
      for (const r of overdue) {
        const why = r.status === "stale" ? `last dated ${r.stamp}, ${r.age} days ago, leash ${r.leash}` : r.problem;
        const who = r.owner === "weekly"
          ? ` The "Weekly price lists" workflow (weekly-prices.yml) refreshes this file; check its last run, or start one: gh workflow run "Weekly price lists".`
          : "";
        console.log(`::warning title=Data past its leash (${r.owner})::${r.file}: ${why}. ${r.what}.${who}`);
      }
    }
  }
}

if (bad.length) {
  console.error("\nSTALE DATA. The nightly refresh has stopped keeping these current:\n");
  for (const b of bad) console.error(`  STALE ${b}`);
  console.error(`\nCheck the "Nightly refresh" workflow. A run that reports success can still`);
  console.error(`have SKIPPED its refresh job: check the job, not the run.`);
  console.error(`To refresh by hand: gh workflow run "Nightly refresh"\n`);
  process.exit(1);
}
say("\nall watched data is inside its leash");
