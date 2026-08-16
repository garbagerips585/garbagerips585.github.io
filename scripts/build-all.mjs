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
// This only BUILDS. No API keys, and no step here pulls fresh data: run the
// sync scripts first if you want that. TWO STEPS DO TOUCH THE NETWORK, both to
// fetch a file they do not already hold and both no-ops once they do:
// fetch-fonts.sh and sync-symbols.mjs. Neither fails the build without one.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  // FIRST, because build-og-pages.py needs the font files and .cache is
  // gitignored. Without this the whole chain fails on any machine that is not
  // the one that happened to fetch them once, which includes whatever machine
  // does the launch flip. The script is a no-op when the cache is warm.
  "bash scripts/fetch-fonts.sh",
  // BEFORE every page builder. It writes public/assets/ui.css from
  // assets-source/ui.css, and shared/chrome.mjs hashes public/assets/ui.css at
  // import time for the cache-busting ?v=. Run it later and every page is
  // stamped with the hash of the stylesheet it is not carrying.
  "node scripts/build-css.mjs",
  "node scripts/stamp-labels.mjs",
  "node scripts/sync-chrome.mjs",
  "python3 scripts/build-og-pages.py",
  "node scripts/build-proto.mjs",
  "node scripts/build-set-pages.mjs",
  "node scripts/build-intl-pages.mjs",
  "node scripts/build-cards.mjs",
  "node scripts/build-pokemon.mjs",
  "node scripts/build-pages.mjs",
  // BEFORE build-expansions.mjs and build-what-set.mjs, the only two pages that
  // paint set symbols. Both read data/symbol-dims.json to decide whether a set
  // has a local mirror; a set that is missing from it keeps its remote url, so
  // running this late does not break a page, it just leaves the heavy remote
  // pngs on it for one build.
  //
  // YES, THIS ONE TOUCHES THE NETWORK, which the header above says this list
  // does not. It is the same exception fetch-fonts.sh already is: it does
  // nothing at all when it already holds the files, and the files are committed,
  // so the only run that fetches anything is the one after a new set appears in
  // expansions.json. That is exactly when it needs to happen, because otherwise
  // a new set silently keeps a 500x500 png forever and nobody notices. It never
  // fails the build on a network error; the affected sets fall back.
  "node scripts/sync-symbols.mjs",
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
  // Both read data written earlier in this list and both must run BEFORE
  // build-search.mjs, which walks public/*.html and fails the build on any
  // indexable page it cannot find in its own PAGES list.
  "node scripts/build-pack-prices.mjs",
  // The other half of the pack-price question: how many packs are in the thing
  // before you divide by them. Reads data/pack-counts-current.json and
  // data/pack-counts-history.json, which humans write, plus
  // public/data/products.json for the product photography, so its only
  // ordering constraints are the usual two: before build-search.mjs, which
  // fails the build on an indexable page missing from its PAGES list, and
  // before check-build.py, which follows the nav link to it from every page.
  "node scripts/build-how-many-packs.mjs",
  "node scripts/build-what-set.mjs",
  // The third page that reads a card somebody is holding, next to the rarity
  // guide and the set finder. It reads data/types.json, which a human writes,
  // and public/data/sets.json for the set names in its measurement note, so its
  // only ordering constraints are the usual two: before build-search.mjs, which
  // fails the build on an indexable page missing from its PAGES list, and
  // before build-pages.mjs, which puts it in the sitemap.
  "node scripts/build-types.mjs",
  "node scripts/build-start.mjs",
  // Next to build-start.mjs because the two pages are a pair: start.html is the
  // question-shaped front door and links here, and this page links back. It
  // reads data/how-to-play.json, which a human writes, so its only ordering
  // constraints are the usual two: before build-search.mjs, which fails the
  // build on an indexable page missing from its PAGES list, and before
  // build-pages.mjs, which puts it in the sitemap.
  "node scripts/build-how-to-play.mjs",
  // The two free official apps, in the order a beginner meets them: the rules
  // page above recommends Live, Live is the one that takes the code card out of
  // every pack, and Pocket is the casual phone one that has nothing to do with
  // it. Both read their own research file plus shared/app-compare.mjs, which
  // holds the comparison table they BOTH print, so neither builder owns that
  // wording and the two pages cannot drift. Pocket also reads
  // data/how-to-play.json for every physical-game number it quotes, for the same
  // reason. Ordering constraints are the usual two: before build-search.mjs,
  // which fails the build on an indexable page missing from its PAGES list, and
  // before build-pages.mjs, which puts them in the sitemap.
  "node scripts/build-tcg-live.mjs",
  "node scripts/build-tcg-pocket.mjs",
  // Before build-search, which indexes these pages, and before build-pages,
  // which puts them in the sitemap. It also stamps `path` onto
  // public/data/playlists.json, which the browser reads.
  // Weekly retail restock forecasts. Reads data/drops.json, which a human
  // updates, plus videos.json for the clock that decides whether the week has
  // passed.
  "node scripts/build-drops.mjs",
"node scripts/build-selling.mjs",
// The other direction of the same question. It reads data/buying.json,
// data/buying-safety.json and data/shops.json, all of which a human writes,
// so its only ordering constraint is running BEFORE build-search.mjs, which
// fails the build on an indexable page missing from its PAGES list, and
// before build-pages.mjs, which puts it in the sitemap.
"node scripts/build-buying.mjs",
// The other direction of the same question, and it reads data/shops.json and
// data/drops.json for its cross-references, both of which are written by hand
// rather than by an earlier step, so it has no ordering constraint beyond
// running before build-search.mjs and build-pages.mjs.
"node scripts/build-grade-check.mjs",
"node scripts/build-openings.mjs",
  "node scripts/build-playlists.mjs",
  "node scripts/build-search.mjs",
  // Both read data/pokedex.json, which is written by sync-pokedex.mjs and is
  // NOT part of this run: it is a slow network job against pokeapi and the data
  // does not change unless a generation ships. Run it by hand when it does.
  "node scripts/build-games.mjs",
"node scripts/build-garbage-run.mjs",
  "node scripts/build-lore.mjs",
  "node scripts/sync-chrome.mjs",
  "node scripts/build-locals.mjs",
  // 404.html is generated too, and was missing from this list, so it only ever
  // rebuilt by hand. It carries no absolute site url today, which is the only
  // reason that was harmless.
  "node scripts/build-404.mjs",
  // Not a page: it writes UNTAGGED.md, the worklist of videos still held out
  // of the index for want of a tag. Generated because the hand-written one
  // went stale and started describing a catalogue that no longer existed.
  "node scripts/build-untagged.mjs",
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
