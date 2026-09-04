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
  // AND THE SCRIPTS, FOR THE SAME REASON AND IN THE SAME SLOT. shared/chrome.mjs
  // hashes public/assets/app.js at import time for its cache-busting ?v=, exactly
  // as it hashes ui.css, so this has to run before the first builder that imports
  // chrome.mjs or every page ships stamped with the hash of a file it is not
  // carrying. Strips the comments out of assets-source/js/ into public/assets/:
  // 37.6 KB gzipped, and the reasoning stays in the repo where it is useful.
  "node scripts/build-js.mjs",
  "node scripts/stamp-labels.mjs",
  "node scripts/sync-chrome.mjs",
  "python3 scripts/build-og-pages.py",
  "node scripts/build-set-pages.mjs",
  "node scripts/build-intl-pages.mjs",
  "node scripts/build-cards.mjs",
  "node scripts/build-pokemon.mjs",
  "node scripts/build-pages.mjs",
  // BUILD-PROTO MOVED HERE, AFTER BUILD-PAGES, ON 23 AUGUST 2026. The home
  // page orders its Greatest Hits shelf by the raw value of each rip's best
  // card, and build-pages.mjs is the file that resolves those prices and
  // writes data/hit-values.json. Run earlier, build-proto read LAST run's
  // figures. It still has to run BEFORE the five builders that slice their
  // <head> out of public/index.html -- build-wanted, build-hall, build-shops,
  // build-garbage-plate and build-about -- and the earliest of those is
  // build-wanted, so this slot satisfies both constraints.
  "node scripts/build-proto.mjs",
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
  // ORDER: the usual two that every page slicing index.html has. AFTER
  // build-proto.mjs, because it takes its head, bar, menu and footer out of
  // public/index.html; before build-search.mjs, which walks public/*.html and
  // fails the build on an indexable page missing from its PAGES list. The
  // sitemap entry is a constant in build-pages.mjs, so that step running
  // earlier is fine, the same arrangement build-base-set.mjs records.
  "node scripts/build-privacy.mjs",
  // Next to build-shops.mjs because it is the same reader: somebody who came
  // for the Rochester angle. It reads data/garbage-plate.json, which a human
  // writes and which carries the source for every claim on the page, so it has
  // no data dependency on any earlier step. Its ordering constraints are the
  // usual two, plus one it shares with build-shops.mjs: before build-search.mjs,
  // which walks public/*.html and fails the build on an indexable page missing
  // from its PAGES list; before build-pages.mjs puts it in the sitemap; and
  // AFTER build-proto.mjs, because it takes its <head>, bar, menu and footer by
  // slicing public/index.html, exactly as the four other pages that do that.
  "node scripts/build-garbage-plate.mjs",
  // The front door to the five local pages, and it sits with them for the same
  // reason the line above gives: same reader, the one who came for the Rochester
  // angle. It reads data/shows.json, data/shops.json, data/vendors.json,
  // data/creators.json and data/garbage-plate.json and writes one page, so it
  // has no data dependency on any earlier step and nothing depends on its
  // output. EVERY NUMBER ON THE PAGE IS COUNTED OUT OF THOSE FIVE FILES, which
  // is what makes the ordering boring: it cannot go stale relative to the pages
  // it summarises, because it is reading the same files they read rather than
  // scraping the pages they produced.
  //
  // ORDER: the usual two, and it is the first of the pair that matters here.
  // BEFORE build-search.mjs, which walks public/*.html and fails the build on an
  // indexable page missing from its PAGES list, and this page is indexable from
  // its first build. Before build-pages.mjs puts it in the sitemap; that one
  // sits above this line, which is fine for the reason build-base-set.mjs
  // records beside the same arrangement: the sitemap entry is a constant in that
  // file and all that has to be true is that the page is on disk by the time
  // check-build.py runs, and check-build.py is the last step.
  "node scripts/build-rochester.mjs",
  "node scripts/build-about.mjs",
  "node scripts/build-luck.mjs",
  "node scripts/build-upcoming.mjs",
  // One product guide, the 2026 First Partner Illustration Collection. Next to
  // build-upcoming.mjs because it is the same reader at the next moment: that
  // page says what is coming, this one is what to know about a thing already on
  // the shelf. It reads data/first-partner.json, written by
  // scripts/sync-first-partner.mjs, which is NOT in this list and must not be:
  // it is a few hundred requests to PriceCharting and pokemon.com and what it
  // records is a dated measurement. Same arrangement and same reason as
  // sync-decks.mjs, sweep-scans.mjs and the two Topps syncs. It also reads
  // data/hits.json and public/data/videos.json to join the owner's own pulls, so it
  // must run after build-pages.mjs has stamped `path` onto the videos.
  //
  // ORDER: the usual two. Before build-search.mjs, which walks public/*.html and
  // fails the build on an indexable page missing from its PAGES list, and before
  // build-pages.mjs puts it in the sitemap. build-pages.mjs sits ABOVE this
  // line, which is fine for the same reason build-base-set.mjs records: the
  // sitemap entry is a constant in that file, and all that has to be true is
  // that the page exists on disk by the time check-build.py runs.
  "node scripts/build-first-partner.mjs",
  "node scripts/build-rarity.mjs",
  "node scripts/build-shows.mjs",
  "node scripts/build-card-show-101.mjs",
  "node scripts/build-fakes.mjs",
  // The 1999 Base Set print runs. Next to the rarity guide and the fake checks
  // because it is the same reader doing the same thing: holding one card and
  // asking what it is. It reads data/base-set.json, which a human writes, plus
  // data/top-graded.json for every price it prints and public/data/expansions.json
  // for the dates, so nothing has to run before it. It must run BEFORE
  // build-search.mjs, which walks public/*.html and fails the build on an
  // indexable page missing from its PAGES list. build-pages.mjs, which owns the
  // sitemap, sits ABOVE this line and that is fine: the only thing that has to
  // be true is that public/base-set.html exists by the time check-build.py runs,
  // and check-build.py is the last step.
  //
  // IT HARD FAILS on a top-graded.json with no verification stamped for its own
  // crawl, exactly as build-top-graded.mjs does, because every price on it comes
  // out of that file and a figure nobody read twice is not publishable here
  // either.
  "node scripts/build-base-set.mjs",
  "node scripts/build-grading.mjs",
  // The highest PSA 10 values. NO SYNC STEP RUNS BEFORE IT and that is
  // deliberate, the same way the sealed and deck data works: the crawl behind
  // it (scripts/sync-graded-top.mjs, then scripts/verify-graded-top.mjs) walks
  // 793 sets of somebody else's site and is run BY HAND, not on every build.
  // This step only reads data/top-graded.json. It hard fails if that file has
  // no verification stamped for its own crawl date, so a stale or unverified
  // snapshot stops the build rather than quietly reprinting itself.
  "node scripts/build-top-graded.mjs",
  // The two Topps pages, next to build-top-graded.mjs because they are the same
  // shape of job: a page of PriceCharting figures out of a crawl that is run BY
  // HAND. NEITHER SYNC RUNS HERE. scripts/sync-topps-top.mjs makes no network
  // request at all and could, but scripts/verify-topps-top.mjs is 176 requests
  // against somebody else's server, and a step in a scheduled build must not
  // depend on one that is not. This reads data/topps-top.json and
  // data/topps-sets.json only.
  //
  // IT HARD FAILS on three things rather than warning: a topps-top.json with no
  // verification stamped for its own crawl, a disagreeing row with no recorded
  // reason (both through shared/graded-gate.mjs), and a claim in
  // data/topps-sets.json about which Topps release a PriceCharting bucket holds
  // that no longer matches the card numbers in the crawl. The last one is this
  // page's own risk and is argued in the builder's header: PriceCharting's
  // buckets are card TYPE buckets rather than Topps releases, and a page that
  // gets that mapping wrong describes the wrong set confidently.
  //
  // Ordering constraints are the usual two: before build-search.mjs, which walks
  // public/*.html and fails the build on an indexable page missing from its
  // PAGES list, and before build-pages.mjs, which puts both urls in the sitemap.
  "node scripts/build-topps.mjs",
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
  // The two ranked price lists, from data/top100.json. The SYNC that writes
  // that file, scripts/sync-top100.mjs, is deliberately NOT in this list: it
  // is a couple of minutes of network against a third party, which is the same
  // reason sync-sets.mjs and sync-chase.mjs are not here either. This builder
  // works from whatever the last sync left on disk and stamps the pages with
  // the date those prices were actually read, so a build with no network
  // produces an honestly dated page rather than no page.
  //
  // Ordering constraints are the usual two: before build-search.mjs, which
  // fails the build on an indexable page missing from its PAGES list, and
  // before build-pages.mjs, which puts them in the sitemap.
  "node scripts/build-top100.mjs",
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
  // The two deck pages, next to the app pages because that is where their
  // reader is standing: /decks.html hands out decklists in the format TCG
  // Live's importer takes, and the Live guide is the page that explains the
  // client they go into. Both read data/decks.json, written by
  // scripts/sync-decks.mjs, which is NOT in this list and must not be: it is a
  // few hundred requests to Limitless and the metagame it records is a dated
  // measurement, so refreshing it is a deliberate act by a person who then
  // re-reads what the pages claim. Same reasoning as sync-pokedex.mjs further
  // down. build-decks.mjs also clears and rewrites public/decks/, the .txt
  // decklists, so nothing else may write into that directory.
  //
  // ORDER: both must run BEFORE build-search.mjs, which walks public/*.html and
  // fails the build on any indexable page missing from its own PAGES list.
  "node scripts/build-decks.mjs",
  "node scripts/build-playable.mjs",
  // Before build-search, which indexes these pages, and before build-pages,
  // which puts them in the sitemap. It also stamps `path` onto
  // public/data/playlists.json, which the browser reads.
  // Weekly retail restock forecasts. Reads data/drops.json, which a human
  // updates, plus videos.json for the clock that decides whether the week has
  // passed.
  // BEFORE the three pages that paint a company mark: build-drops.mjs,
  // build-selling.mjs and build-buying.mjs. Same shape as sync-symbols.mjs
  // above, including the network exception: it does nothing at all once it
  // holds the files, and the files are committed, so the only run that fetches
  // anything is the one after a new venue or retailer is added. A venue whose
  // mark is missing gets the hatched name tile rather than a hole, so running
  // this late does not break a page.
  "node scripts/sync-brands.mjs",
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
  // AFTER build-openings.mjs, which is a real ordering constraint and not a
  // filing preference: /msrp.html links a product row to /openings/<id>.html and
  // reads public/openings/ to find out which of those pages exist, because
  // build-openings.mjs only writes one for a product this channel has filmed. Run
  // it first and every one of those links silently disappears for a build.
  // Otherwise the usual two: before build-search.mjs, which fails the build on an
  // indexable page missing from its PAGES list, and before build-pages.mjs, which
  // puts it in the sitemap.
  //
  // It reads data/msrp.json, which a human writes and which carries the rule for
  // what may go in it, plus data/pack-counts-current.json for the pack counts and
  // the shop listings, so this site states a pack count in exactly one place.
  "node scripts/build-msrp.mjs",
  // What a beginner or a parent should actually buy, and what it should cost.
  // AFTER build-msrp.mjs is not required by anything the two write, but it is
  // the honest reading order: that page owns every price and this one joins to
  // the same data/msrp.json by product label, so a figure cannot appear here
  // that the price list does not carry. The join throws rather than warns.
  //
  // AFTER build-openings.mjs IS a real ordering constraint, the same one the
  // line above records: this page links a recommended product to
  // /openings/<id>.html and reads public/openings/ to find out which of those
  // pages exist. Run it first and every one of those links silently disappears
  // for a build.
  //
  // It also reads data/pack-counts-current.json for the pack counts and the two
  // shop listings it prints, and data/buying.json for the retailers' own
  // marketplace readings that the reseller section rests on. All three are
  // read, never written. Otherwise the usual two: before build-search.mjs,
  // which fails the build on an indexable page missing from its PAGES list, and
  // before build-pages.mjs, which puts it in the sitemap.
  "node scripts/build-what-to-buy.mjs",
  // The physical shop directory and its nine per-retailer pages. AFTER
  // sync-brands.mjs for the same reason build-buying.mjs is, and it reads
  // data/msrp.json for the suggested figure behind every comparison plus
  // data/pack-counts-current.json for the four shop listings this repo already
  // held, so no price is stated twice anywhere in the tree. Otherwise the usual
  // two: before build-search.mjs, which fails the build on an indexable page
  // missing from its PAGES list and which also reads the retailer index this
  // step writes, and before build-pages.mjs, which puts all ten urls in the
  // sitemap.
  "node scripts/build-retailers.mjs",
  "node scripts/build-playlists.mjs",
  // The timeline of every official Pokemon video game. It reads
  // data/video-games.json, which a human curates, and data/cover-dims.json,
  // which scripts/sync-game-covers.mjs writes. That sync is NOT in this list
  // and that is deliberate: sync-symbols.mjs is here because expansions.json
  // grows on its own from an API pull, so a new set would otherwise keep a
  // 500x500 png forever, whereas nothing here grows without somebody editing
  // the JSON by hand, and the person making that edit is the person who should
  // run the sync. Its only ordering constraints are the usual two: before
  // build-search.mjs, which fails the build on an indexable page missing from
  // its PAGES list, and before check-build.py, which follows the nav link to it
  // from every page.
  "node scripts/build-video-games.mjs",
  // The evolution chart, next to the video game timeline because they are the
  // same kind of page: general Pokemon reference rather than anything to do
  // with cards. It reads data/evolutions.json, written by
  // scripts/sync-evolution.mjs, which is NOT in this list and must not be added
  // to it: it is 541 chains plus the lookup tables against pokeapi, and what it
  // records is a dated read, so refreshing it is a deliberate act by a person
  // who then re-checks what the page claims. Same rule as sync-pokedex.mjs and
  // sync-decks.mjs.
  //
  // AFTER build-pokemon.mjs, which is a real constraint rather than filing: the
  // chart links a species box to /pokemon/<slug>.html only for the Pokemon that
  // have a page, and it reads public/data/pokemon-index.json to find out which.
  // Run it first and 1,025 boxes go link-free for a build. Otherwise the usual
  // two: before build-search.mjs, which fails the build on an indexable page
  // missing from its PAGES list, and before build-pages.mjs, which puts it in
  // the sitemap.
  "node scripts/build-evolution.mjs",
  "node scripts/build-eevee.mjs",
  "node scripts/build-search.mjs",
  // Both read data/pokedex.json, which is written by sync-pokedex.mjs and is
  // NOT part of this run: it is a slow network job against pokeapi and the data
  // does not change unless a generation ships. Run it by hand when it does.
  "node scripts/build-games.mjs",
"node scripts/build-garbage-run.mjs",
  // The memory game, built from data/top-raw.json rather than from the pokedex,
  // so it has no ordering constraint on sync-pokedex.mjs the way the two above
  // do. It sits here because it is a /games/ page and it throws rather than
  // warns if that file has lost an image or a verified price, which is the same
  // arrangement build-games.mjs has with the species artwork.
  "node scripts/build-chase-match.mjs",
  // BEFORE build-lore.mjs, which is the only page that paints these. Same two
  // properties as every other sync step in this list: idempotent, and it never
  // fails the build. A dex id it does not hold is drawn as the site's no-art
  // hatch and named in build-lore.mjs's own console output.
  "node scripts/sync-dex-art.mjs",
  "node scripts/build-lore.mjs",
  "node scripts/sync-chrome.mjs",
  "node scripts/build-locals.mjs",
  // 404.html is generated too, and was missing from this list, so it only ever
  // rebuilt by hand. It carries no absolute site url today, which is the only
  // reason that was harmless.
  "node scripts/build-llms.mjs",
  "node scripts/build-404.mjs",
  // Not a page: it writes UNTAGGED.md, the worklist of videos still held out
  // of the index for want of a tag. Generated because the hand-written one
  // went stale and started describing a catalogue that no longer existed.
  "node scripts/build-untagged.mjs",
  "node scripts/stamp-assets.mjs",
  "python3 scripts/check-build.py",
];

// EXIT 2 FROM check-build.py IS NOT A BUILD FAILURE, AND SAYING IT IS WAS ITS
// OWN BUG. That script grew two severities on 21 August 2026: 1 for a broken
// build, 2 for a wrong answer in the hand-filled workbook -- pages complete and
// publishable, the log simply wrong about a card. See the note at the foot of
// check-build.py for why, and .github/workflows/refresh.yml for the nightly's
// half of it.
//
// This loop knew nothing about that, so one mistyped rarity in one spreadsheet
// cell printed "64 of 65 builders ok" and "Something did not build. Fix it
// before publishing: a half-built site ships stale canonicals on the pages that
// failed." Every word of that was false -- all 65 steps ran, nothing was
// half-built, no canonical was stale -- and it is the worst kind of false,
// because it is the message a person would stop and act on. A warning that
// cries wolf on a known-good tree is how a real one gets ignored later.
//
// So exit 2 is counted separately, named for what it is, and does not change
// the exit code of this script.
let failed = 0;
let workbook = 0;
/* THREE STEPS COMPOSE IMAGES, AND IMAGE BYTES DO NOT REPRODUCE ACROSS MACHINES.
   build-og-pages.py draws the 97 share cards and sync-symbols.mjs mirrors the
   174 set symbols, and BOTH rewrite their files on every run rather than
   skipping what is already on disk. A different Pillow, a different libjpeg or
   a font that Google has re-released since is a different encoder, so the same
   source produces different bytes -- and because stamp-assets.mjs puts a
   content hash in every og:image URL, changed image bytes restamp the pages
   that reference them too. On a Linux runner that read as 1,092 drifted files
   for a commit that touched two lines of a description.

   SO CI VERIFIES THE HTML AND LEAVES THE IMAGES ALONE. Skipping these means the
   committed images stay exactly where they are, stamp-assets hashes those, and
   the pages come out byte-identical -- which is the actual question the drift
   check exists to answer, and the one all five August incidents were about.
   fetch-fonts.sh goes with them because build-og-pages.py is the only step that
   reads the font cache, so skipping it drops a network call CI cannot use.

   NOTHING ELSE DEPENDS ON THEM RUNNING: data/symbol-dims.json, the manifest
   page builders read for real width and height, is committed, as are all 174
   symbols and all 97 cards.

   NEVER SILENT. A build that quietly does less than it says is how a stale tree
   ships looking green, so the skipped steps are named on every run. */
const SKIP_IMAGES = process.env.GR_SKIP_IMAGE_BUILDERS === "1";
const IMAGE_STEPS = new Set([
  "bash scripts/fetch-fonts.sh",
  "python3 scripts/build-og-pages.py",
  "node scripts/sync-symbols.mjs",
  // THE THIRD ONE, AND THE ONE THAT BIT. sync-dex-art.mjs looks like a pure
  // fetcher and is not: the 36 images are committed, so it downloads nothing,
  // but it then REBUILDS data/dex-art.json by reading each file's real width
  // and height -- through Pillow. On a runner without Pillow every read
  // returns null, every entry is skipped, and it writes an EMPTY manifest over
  // a complete one while still exiting 0. lore.html then renders "No artwork
  // held for Trubbish" where the art should be. That is the whole of the last
  // drifted file, and it took --diff to see it.
  "node scripts/sync-dex-art.mjs",
]);
const PLAN = SKIP_IMAGES ? STEPS.filter((s) => !IMAGE_STEPS.has(s)) : STEPS;
if (SKIP_IMAGES) {
  console.log("GR_SKIP_IMAGE_BUILDERS=1, so the image steps do not run:");
  for (const s of STEPS.filter((x) => IMAGE_STEPS.has(x))) console.log(`  skip  ${s}`);
  console.log("  The committed images are used as they are. HTML is still built in full.\n");
}

for (const step of PLAN) {
  const [bin, ...args] = step.split(" ");
  try {
    execFileSync(bin, args, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    console.log(`  ok    ${step}`);
  } catch (e) {
    const isWorkbook = step.endsWith("check-build.py") && e.status === 2;
    if (isWorkbook) workbook += 1;
    else failed += 1;
    console.log(`  ${isWorkbook ? "SHEET" : "FAIL "} ${step}`);
      /* THE MESSAGE IS AT THE TOP OF A NODE ERROR AND slice(-4) THREW IT AWAY.
         This printed the LAST four lines of stderr, which for an uncaught throw
         is the bottom of the stack plus the "Node.js v22.23.2" banner. So the
         nightly reported three builders failing for days and said nothing at all
         about WHY: build-retailers.mjs alone throws two different six-line errors
         from this exact call path, each naming the file, the row and the fix, and
         both were discarded in favour of "at Array.map (<anonymous>)".

         The fix is not "print more lines", it is print the MESSAGE, which Node
         puts FIRST. Four stack frames are kept because frames are the part that
         genuinely repeats and truncates safely; a message never is. */
      const errOut = String(e.stderr || e.message).trimEnd().split("\n");
      const firstFrame = errOut.findIndex((l) => /^\s+at\s/.test(l));
      const msgLines = firstFrame === -1 ? errOut : errOut.slice(0, firstFrame);
      const frameLines = firstFrame === -1 ? [] : errOut.slice(firstFrame, firstFrame + 4);
      console.log([...msgLines, ...frameLines].map((l) => `        ${l}`).join("\n"));
  }
}
console.log(`\n${PLAN.length - failed} of ${PLAN.length} builders ok`);
if (failed) {
  console.log("Something did not build. Fix it before publishing: a half-built\n" +
              "site ships stale canonicals on the pages that failed.");
  process.exit(1);
}
if (workbook) {
  console.log("The build is complete and publishable. check-build.py found a wrong\n" +
              "answer in Garbage-Rips-585-Video-Log.xlsx -- see its report above. Fix\n" +
              "the cell and re-run scripts/import-sheet.mjs; nothing here needs redoing.");
}
console.log("Now run: python3 scripts/check-build.py");
