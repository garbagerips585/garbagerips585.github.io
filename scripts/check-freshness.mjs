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
  ["data/price-rotation.json",      ["lastRun"],       3, "the nightly PriceCharting refresh"],
  ["data/pricecharting-cards.json", ["checked"],       3, "the 28 set-guide consoles, refreshed nightly"],
  ["public/data/card-index.json",   ["pricesChecked"], 3, "every card price on the site"],
  ["data/graded.json",              ["checked"],      10, "PSA 10 prices, 50 a night by rotation"],
];

/* WHAT IS DELIBERATELY NOT WATCHED, so nobody adds it back as a false alarm.
   public/data/sets.json is sync-sets.mjs against api.pokemontcg.io, which is
   HAND RUN and whose syncedAt only moves when the set LIST changes. It was on
   this list for one commit at an 8 day leash, went red immediately at 12 days,
   and the number was invented rather than checked. This file watches what the
   nightly OWNS; a hand-run sync going quiet is a different question and wants a
   different answer than failing every push. */

const today = localDay();
const days = (iso) => Math.round((new Date(today) - new Date(iso)) / 86400000);

const bad = [];
for (const [rel, keys, leash, what] of WATCH) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { bad.push(`${rel} is missing entirely (${what})`); continue; }
  let doc;
  try { doc = JSON.parse(await readFile(p, "utf8")); } catch { bad.push(`${rel} does not parse`); continue; }
  const stamp = keys.map((k) => doc[k]).find((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));
  if (!stamp) { bad.push(`${rel} carries none of ${keys.join(", ")}, so its freshness cannot be checked`); continue; }
  const age = days(stamp.slice(0, 10));
  const line = `${rel.padEnd(32)} ${stamp.slice(0, 10)}  ${String(age).padStart(3)}d  (leash ${leash}d)  ${what}`;
  if (age > leash) bad.push(line);
  else console.log(`  ok    ${line}`);
}

if (bad.length) {
  console.error("\nSTALE DATA. The nightly refresh has stopped keeping these current:\n");
  for (const b of bad) console.error(`  STALE ${b}`);
  console.error(`\nCheck the "Nightly refresh" workflow. A run that reports success can still`);
  console.error(`have SKIPPED its refresh job: check the job, not the run.`);
  console.error(`To refresh by hand: gh workflow run "Nightly refresh"\n`);
  process.exit(1);
}
console.log("\nall watched data is inside its leash");
