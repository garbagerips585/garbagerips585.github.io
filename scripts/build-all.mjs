#!/usr/bin/env node
// Rebuild every generated page, in the order the nightly workflow uses.
//
//   node scripts/build-all.mjs
//
// WHY THIS EXISTS. shared/site.mjs documents the domain switch as "2. node
// scripts/build-all.mjs" and that file did not exist. Whoever performed the
// switch would have run a command that errors, and might reasonably have
// assumed the rebuild happened: every canonical, og:url and sitemap entry would
// still point at the old domain.
//
// ORDER MATTERS AND IS NOT ALPHABETICAL. build-set-pages.mjs CLEARS
// public/sets/ before writing, so build-intl-pages.mjs has to run after it or
// the 13 non-English guides vanish. The list is lifted from the workflow so
// there is one running order, not two that drift.
//
// This only BUILDS. It does not sync: no network, no API keys. Run the sync
// scripts first if you want fresh data.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  "node scripts/stamp-labels.mjs",
  "node scripts/sync-chrome.mjs",
  "python3 scripts/build-og-pages.py",
  "node scripts/build-proto.mjs",
  "node scripts/build-set-pages.mjs",
  "node scripts/build-intl-pages.mjs",
  "node scripts/build-cards.mjs",
  "node scripts/build-pokemon.mjs",
  "node scripts/build-pages.mjs",
  "node scripts/build-expansions.mjs",
  "node scripts/build-wanted.mjs",
  "node scripts/build-hall.mjs",
  "node scripts/build-shops.mjs",
  "node scripts/build-about.mjs",
  "node scripts/build-luck.mjs",
  "node scripts/build-upcoming.mjs",
  "node scripts/build-rarity.mjs",
  "node scripts/build-shows.mjs",
  "node scripts/build-fakes.mjs",
  "node scripts/build-grading.mjs",
  "node scripts/build-complete.mjs",
  "node scripts/build-start.mjs",
  "node scripts/build-search.mjs",
  "node scripts/sync-chrome.mjs",
  "node scripts/build-locals.mjs",
  "node scripts/stamp-assets.mjs",
  "python3 scripts/check-build.py",
];

let failed = 0;
for (const step of STEPS) {
  const [bin, ...args] = step.split(" ");
  try {
    execFileSync(bin, args, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    console.log(`  ok    ${step}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL  ${step}`);
    console.log(String(e.stderr || e.message).trim().split("\n").slice(-4).map((l) => `        ${l}`).join("\n"));
  }
}
console.log(`\n${STEPS.length - failed} of ${STEPS.length} builders ok`);
if (failed) {
  console.log("Something did not build. Fix it before publishing: a half-built\n" +
              "site ships stale canonicals on the pages that failed.");
  process.exit(1);
}
console.log("Now run: python3 scripts/check-build.py");
