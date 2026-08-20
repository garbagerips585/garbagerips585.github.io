#!/usr/bin/env node
// Mirror card scans locally at THUMBNAIL size, for the pages that draw a card
// next to a row of numbers rather than as a picture.
//
//   node scripts/sync-card-thumbs.mjs            fetch anything not held yet
//   node scripts/sync-card-thumbs.mjs --force    refetch and re-encode all
//
// WHY THIS EXISTS, AND IT IS THE SAME ARITHMETIC AS sync-symbols.mjs.
//
// TCGdex serves exactly two widths, 245 and 600, and nothing in between: mid,
// medium and 600.webp all 404 and Scrydex ignores ?w=. That is fine for a page
// drawing a card at 132 or 150px, which is why /rarity.html and /types.html
// hotlink. It is not fine for a LIST. /grading.html does its arithmetic on 32
// named cards and showed none of them, and 32 hotlinked low.webp is 25KB each,
// around 550KB, to fill boxes 32px wide. That is nearly an 8x linear oversample
// repeated 32 times on the page this site is most likely to be read on a phone.
//
// So this fetches each one once, fits it to a 72px box (which covers the 32px
// box at DPR2, with room) and writes a WebP. Measured on the same card: 245px
// low.webp 25KB, this 2.5KB. The whole /grading.html row goes from about 550KB
// to about 96KB, and the file on disk is a tenth of the AVIF of the untouched
// scan.
//
// LOSSY AT 82, NOT LOSSLESS, and that is the opposite call from sync-symbols.mjs
// on purpose. A set symbol is hard-edged line art whose whole job is to be told
// apart from another symbol, so a halo there costs you the thing the file is
// for. A card thumbnail at 32px is a photograph of a painting; nobody reads a
// regulation mark off one, and the page links to the full card for anybody who
// wants to. Lossless at this size measured 9.1KB against 3.2KB.
//
// NOBODY SHOULD READ SMALL PRINT OFF THESE, which is a rule about where they may
// be used rather than about the encode. A page arguing about what is PRINTED on
// a card keeps the full scan: /rarity.html magnifies corners, /fake-cards.html
// shows a 600px scan so the set code is legible, /how-to-play.html labels a card
// at 190px. Those all still hotlink and should. This is for a card beside a
// price.
//
// THE LIST IS DERIVED, NOT PINNED, because the cards on /grading.html come out
// of data/psa10.json and change when the research is refreshed. A pinned list
// would go stale silently and leave new rows with no picture. So this walks the
// same join the builder does.
//
// THE MANIFEST IS KEYED BY THE TCGDEX BASE URL, so a builder that already holds
// the url can look it up without knowing how the file was named, and any page
// can use it later. The value carries the file's REAL decoded size: the box is a
// bound and card scans are not all the same aspect ratio.
//
// FALLBACK IS THE REMOTE URL. A card with no local file keeps the low.webp it
// has today, decided at build time from this manifest rather than with onerror,
// because onerror never fires for a lazy image below the fold.
//
// IDEMPOTENT, and the raw downloads are cached under .cache/ (gitignored) so
// deleting the output and rebuilding costs no network.
//
// Needs Pillow, which the nightly already installs for build-og-pages.py.
//
// ===========================================================================
// SECOND JOB, ADDED 16 August 2026: RENDITIONS FOR /cards.html AND /wanted.html
// ===========================================================================
//
// Same arithmetic as above, run against the two pages a phone reader waits
// longest for. Measured at 390x844 DPR2, gzipped text, cache off, with
// .claude/server.js:
//
//                        on load      fully scrolled    of which images
//   /wanted.html         983.8KB        983.8KB           874.9KB
//   /cards.html          367.1KB      1,251.0KB         1,127.6KB
//
// /wanted.html IS THE WORST PAGE ON THE SITE TO WAIT FOR and the two numbers
// being EQUAL is the whole reason. Ten cards in a two column grid all sit
// inside Chrome's lazy-load lead, so `loading="lazy"` defers nothing: the
// reader pays the fully-scrolled figure before the first paint. /cards.html is
// the opposite shape, 60 rows deferring 884KB down the page, so its on-load
// number is respectable and its fully-scrolled one is the heaviest on the site.
//
// WHAT THE BOXES ACTUALLY MEASURE, driven with CDP rather than read off the
// stylesheet:
//   .wc-art on /wanted.html   116px at 320 ... 151 at 390 ... 325 at 1600+
//   .cq-img on /cards.html    60px FLAT, at every width from 320 to 1920
// So a 390px phone at DPR2 needs 302 and 120 device pixels. TCGdex publishes
// 245 and 600 and nothing between, so both pages jump to the 600w file on
// /wanted.html and sit on a 4x area oversample on /cards.html.
//
// THE HOST WAS CHECKED FIRST, because one Scrydex PNG was 1.1MB of /rarity.html
// and no pipeline would have been needed if the same thing were true here. All
// 10 wanted cards and all 60 rendered card rows are already TCGdex, already
// AVIF through avifPicture(), and no single file exceeds 200KB. There was
// nothing free left to take.
//
// SO THE MIDDLE WIDTH HAS TO BE MADE, and these are the encodes that were
// measured before one was picked. Totals over the ten /wanted.html cards, at
// the 302px box a 390px phone paints:
//
//   TCGdex 600w high.avif   863KB   what ships today
//   TCGdex 245w low.avif    213KB   VISIBLY SOFT, see below. Rejected.
//   local 310w AVIF q40     241KB
//   local 310w AVIF q55     355KB   chosen
//   local 310w AVIF q70     481KB
//   local 310w WEBP q76     387KB
//
// THE 245w FILE IS NOT GOOD ENOUGH AND THAT IS THE ONLY REASON THIS SCRIPT HAS
// TO ENCODE ANYTHING. It is the free answer and it was tried first: 213KB, a
// 75% cut, no build step, no bytes in the repo. Decoded and painted into the
// real 302px box at 3x nearest neighbour, the attack text on Seismitoad ex
// (Black Bolt 105) is mush, while every 310w candidate down to q40 holds it as
// crisply as the 600w file does. A site whose subject is card scans does not
// take that trade. q55 was picked over q40 and q50 for margin on smooth
// gradients, where q40 blocks up slightly on Team Rocket's Mewtwo ex.
//
// ALPHA IS PRESERVED IN BOTH PATHS NOW. TCGdex scans are RGBA with genuinely
// transparent rounded corners (alpha extrema 0..255 on every card checked), so
// a `.convert("RGB")` fills those corners with black.
//
// THIS ENTRY USED TO SAY THE 72px PATH WAS DELIBERATELY LEFT FLATTENED, on the
// reasoning that at 32px it reads as a faint dark corner and nobody had
// complained. Somebody then complained, which is the answer to "nobody has
// complained": it means nobody has said so yet, not that it looks right. All
// 114 grading thumbnails carried it. Measured on the 72px Pikachu ex, the
// top-left corner pixel was (94,96,95) and the top-right (93,93,93), against a
// page background those corners are supposed to show.
//
// "Tolerable at this size" is a judgement about a rendering nobody had looked
// at closely; the corner is 4 device pixels of wrong colour on a rounded edge,
// on a site whose whole subject is what a card looks like. Both loops call
// .convert("RGBA") and the difference is a handful of kilobytes, recorded in
// the commit that made the change.
//
// WIDTHS ARE CHOSEN FROM THE MEASURED BOXES, NOT ROUND NUMBERS:
//   wanted 310w  covers 302 device px, the 151px box at 390 and DPR2
//   wanted 420w  covers 326-342, the 163-171px box at 414 and 430 and DPR2,
//                and the 325px box a 1600px desktop paints at DPR1
//   cards  120w  the 60px box at DPR2
//   cards  180w  the 60px box at DPR3
// The remote 245w and 600w files stay in every srcset as the outer rungs, so a
// 320px phone still takes TCGdex's own 245w (it needs 232 and that file is
// better than anything encoded here) and a DPR3 phone on /wanted.html still
// takes the 600w. Nothing is removed from the ladder; a middle is added to it.
//
// PILLOW'S AVIF IS NOT AS GOOD AS TCGDEX'S, and that is worth knowing before
// anyone tries to re-encode the 245w files to "save more". At 245w this encoder
// produces 271KB over the ten where TCGdex ships 213KB. It only wins by
// dropping pixels nobody can see, never by encoding the same pixels better.
// `speed` barely matters either: 310w q55 is 355KB at speed 0 and 366KB at
// speed 6, so 4 is used and the build stays quick.
//
// THE TWO LISTS ARE DERIVED, like the /grading.html one, but the /cards.html
// one is a RESTATEMENT of a rule that lives in build-cards.mjs (the priciest
// rows, rendered into the HTML) and can therefore drift from it. That is why
// TOP is deliberately larger than the 60 that page renders: a price move has to
// shuffle a card more than twenty places before it falls out of the mirror, and
// when one does the page falls back to its remote url and looks exactly like it
// does today. Drift costs bytes, never a broken picture.
//
// NOT IN build-all.mjs, same as today. It touches the network and the output is
// committed, so it runs when the wanted list or the price table moves.

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, ".cache", "tcgdex", "thumbs");
const OUT = join(ROOT, "public", "assets", "cards");
const MANIFEST = join(ROOT, "data", "card-thumbs.json");
const FORCE = process.argv.includes("--force");

/**
 * The two rendition profiles. `source` is the TCGdex rendition to downscale
 * FROM: /wanted.html needs 420px out, so it cannot start from the 245px file.
 *
 * AVIF quality 55 and WebP quality 78 are the same picture at every one of
 * these widths; see the measurement block at the top of this file. Both formats
 * are emitted because the site's <picture> pattern keeps a WebP under every
 * AVIF source: AVIF misses Safari 16.0-16.3 and a card scan that fails to paint
 * is a broken page.
 */
const RENDITIONS = {
  wanted: { widths: [310, 420], source: "high.webp", avif: 55, webp: 78 },
  cards: { widths: [120, 180], source: "low.webp", avif: 55, webp: 78 },
};
/** How many of /cards.html's priciest rows to mirror. It renders 60. */
const TOP = 80;

/**
 * Covers the 32px box on /grading.html at DPR2, with a little room for it to
 * grow. This was 96 for one build, which is what you get from writing the
 * comment before checking the stylesheet: the box is 32px, not 48px, so 96 was
 * a third wider than any screen can use and cost the page 65KB for nothing.
 */
const BOX = 72;
const QUALITY = 82;

const PY = `
import json, sys
from PIL import Image

BOX = ${BOX}
jobs = json.load(sys.stdin)
for job in jobs.get("encode", []):
    # RGBA, NOT RGB. See the alpha note at the top of this file: a TCGdex scan
    # has genuinely transparent rounded corners, and .convert("RGB") composites
    # them onto black. Measured on the 72px Pikachu ex before this changed, the
    # top-left corner pixel was (94,96,95) and the top-right (93,93,93), where
    # both should have let the page background through.
    im = Image.open(job["src"]).convert("RGBA")
    w, h = im.size
    scale = min(BOX / w, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    im.save(job["dst"], "WEBP", quality=${QUALITY}, method=6)

# The renditions. Same RGBA rule as the 72px loop above, which used to be the
# one place on this site that flattened a card's corners onto black.
for job in jobs.get("render", []):
    im = Image.open(job["src"]).convert("RGBA")
    w, h = im.size
    tw = job["w"]
    if tw < w:
        im = im.resize((tw, max(1, round(h * tw / w))), Image.LANCZOS)
    if job["fmt"] == "AVIF":
        im.save(job["dst"], "AVIF", quality=job["q"], speed=4)
    else:
        im.save(job["dst"], "WEBP", quality=job["q"], method=6)

# Read back every mirrored file, not only the ones this run wrote, so a run that
# fetched nothing still rebuilds a complete manifest. Same as sync-symbols.mjs.
out = []
for job in jobs.get("probe", []):
    im = Image.open(job["dst"])
    out.append({"key": job["key"], "w": im.size[0], "h": im.size[1]})
json.dump(out, sys.stdout)
`;

function pillow(payload) {
  try {
    return JSON.parse(
      execFileSync("python3", ["-c", PY], {
        input: JSON.stringify(payload),
        maxBuffer: 64 * 1024 * 1024,
      }).toString()
    );
  } catch (e) {
    console.error("Pillow could not process the card thumbnails. Install it with:");
    console.error("  python3 -m pip install --user Pillow");
    console.error(String(e.stderr || e.message).trim().split("\n").slice(-3).join("\n"));
    process.exit(1);
  }
}

/**
 * A STALLED CONNECTION USED TO HANG THIS SCRIPT FOREVER, and it only started
 * showing up when the renditions raised the job count from 32 files to 204.
 * `fetch` has no default timeout, so one TCGdex socket that opens and then goes
 * quiet parks a `Promise.all` batch and the whole run sits at 0% CPU with five
 * ESTABLISHED sockets and no output, looking exactly like a slow encode. Seen
 * twice in one afternoon at this size and never once at the old size.
 *
 * 25 seconds is generous for a 200KB file and short enough that the retry loop
 * below gets its four attempts inside a couple of minutes.
 */
const FETCH_TIMEOUT = 25_000;

async function download(url, dest) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length) {
          await writeFile(dest, buf);
          return buf.length;
        }
      }
      if (res.status === 404) return 0;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, attempt * 1200));
  }
  return 0;
}

await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });

// 101 TCGdex bases that 404, found by fetching every image url the site emits.
// Skipped up front rather than fetched to find out.
const noScan = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases);

/**
 * The cards /grading.html can put a number against: every psa10.json key that
 * resolves to a real card in this site's own checklists.
 *
 * The key format is <set-slug>-<card-number>, the same one build-grading.mjs
 * builds with keyOf(). Both halves are needed: the set decides the file and the
 * number the card.
 */
const psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
const wanted = new Map();
for (const file of (await readdir(join(ROOT, "public/data/cards"))).filter((f) => f.endsWith(".json"))) {
  const slug = file.slice(0, -5);
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", file), "utf8"));
  for (const c of doc.cards || []) {
    const key = `${slug}-${String(c.n).replace(/^0+/, "")}`;
    if (!psa10.auto?.[key] && !psa10.prices?.[key]) continue;
    if (!c.img || noScan.has(c.img)) continue;
    wanted.set(c.img, { slug, n: c.n, name: c.name });
  }
}

/**
 * Descriptive filename, same reasoning as build-logos.py and sync-symbols.mjs:
 * image search reads these and "sv03.5-016.webp" says nothing.
 */
const fileFor = (slug, n, name) =>
  `${slug}-${String(n).toLowerCase()}-${String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-pokemon-card.webp`;

const todo = [];
let held = 0;
let reused = 0;
let fetched = 0;
const failed = [];

for (const [base, meta] of wanted) {
  const out = join(OUT, fileFor(meta.slug, meta.n, meta.name));
  if (!FORCE && existsSync(out)) {
    held += 1;
    continue;
  }
  todo.push({ base, meta, out });
}

if (todo.length) {
  process.stdout.write(`Fetching ${todo.length} card scan(s)`);
  // Six at a time, matching every other sync here: quick enough to finish,
  // gentle enough not to look abusive.
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(
      todo.slice(i, i + 6).map(async (job) => {
        const raw = join(RAW, `${job.meta.slug}-${job.meta.n}.webp`);
        if (!FORCE && existsSync(raw)) reused += 1;
        else if (await download(`${job.base}/low.webp`, raw)) fetched += 1;
        else failed.push(job);
      })
    );
    process.stdout.write(".");
  }
  process.stdout.write("\n");
}

const encode = [];
const probe = [];
for (const [base, meta] of wanted) {
  const out = join(OUT, fileFor(meta.slug, meta.n, meta.name));
  const raw = join(RAW, `${meta.slug}-${meta.n}.webp`);
  const willExist = existsSync(out) || existsSync(raw);
  if (!willExist) continue;
  if (!existsSync(out) || FORCE) encode.push({ src: raw, dst: out });
  probe.push({ key: base, dst: out });
}

/* ======================================================================
 * The renditions for /wanted.html and /cards.html.
 * ====================================================================== */

/**
 * The ten cards /wanted.html draws, straight out of the file that page reads.
 * `image` is the low.webp url, so stripping the rendition off the end gives the
 * TCGdex base every manifest in this tree is keyed by.
 */
const wantedCards = new Map();
for (const c of JSON.parse(await readFile(join(ROOT, "public/data/wanted.json"), "utf8")).cards) {
  const base = String(c.image || "").replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "");
  if (!base || noScan.has(base) || !/assets\.tcgdex\.net/.test(base)) continue;
  wantedCards.set(base, { slug: c.set, n: c.number, name: c.name });
}

/**
 * The priciest rows of /cards.html. THIS IS A RESTATEMENT of build-cards.mjs's
 * own `priced.sort(by price desc).slice(0, 60)`, and the only copy of that rule
 * outside it, so it can drift. TOP is 80 rather than 60 to absorb the drift;
 * see the note at the top of this file for why a miss is harmless.
 */
const cardsIndex = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
const cardsRows = new Map();
for (const r of (cardsIndex.cards || [])
  .filter((r) => typeof r[4] === "number")
  .slice()
  .sort((a, b) => b[4] - a[4])
  .slice(0, TOP)) {
  const [name, slug, n] = r;
  const prefix = (cardsIndex.imgBase || {})[slug];
  if (!prefix || !n) continue;
  const base = `${prefix}/${n}`;
  if (noScan.has(base)) continue;
  cardsRows.set(base, { slug, n, name });
}

const PROFILE_CARDS = { wanted: wantedCards, cards: cardsRows };

/**
 * One cache file per (base url, source rendition), because /wanted.html starts
 * from high.webp and /cards.html from low.webp and the two must not overwrite
 * each other in .cache/.
 */
const rawFor = (base, source) =>
  join(RAW, `${base.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-")}-${source.replace(".", "-")}`);

const renderTodo = [];
const renderFetch = [];
for (const [profile, cfg] of Object.entries(RENDITIONS)) {
  for (const [base, meta] of PROFILE_CARDS[profile]) {
    const stem = fileFor(meta.slug, meta.n, meta.name).replace(/\.webp$/, "");
    const jobs = [];
    for (const w of cfg.widths) {
      for (const fmt of ["avif", "webp"]) {
        const dst = join(OUT, `${stem}-${w}.${fmt}`);
        if (!FORCE && existsSync(dst)) continue;
        jobs.push({ dst, w, fmt: fmt === "avif" ? "AVIF" : "WEBP", q: fmt === "avif" ? cfg.avif : cfg.webp });
      }
    }
    const raw = rawFor(base, cfg.source);
    if (jobs.length && !(existsSync(raw) && !FORCE)) renderFetch.push({ url: `${base}/${cfg.source}`, raw });
    renderTodo.push({ profile, base, meta, stem, raw, jobs, widths: cfg.widths });
  }
}

const renderFailed = [];
if (renderFetch.length) {
  process.stdout.write(`Fetching ${renderFetch.length} full-size scan(s) to downscale`);
  for (let i = 0; i < renderFetch.length; i += 6) {
    await Promise.all(
      renderFetch.slice(i, i + 6).map(async (job) => {
        if (!(await download(job.url, job.raw))) renderFailed.push(job.url);
      })
    );
    process.stdout.write(".");
  }
  process.stdout.write("\n");
}

const render = [];
for (const job of renderTodo) {
  if (!existsSync(job.raw)) continue;
  for (const j of job.jobs) render.push({ src: job.raw, ...j });
}

const probed = encode.length || probe.length || render.length ? pillow({ encode, probe, render }) : [];

const thumbs = {};
let bytes = 0;
for (const r of probed) {
  const meta = wanted.get(r.key);
  const name = fileFor(meta.slug, meta.n, meta.name);
  thumbs[r.key] = { file: name, w: r.w, h: r.h };
  bytes += statSync(join(OUT, name)).size;
}

/**
 * The manifest side of the renditions. A card is only listed when EVERY file it
 * promises is actually on disk, because a builder reading this emits a srcset
 * from it without checking, and a candidate pointing at a missing file is worse
 * than no candidate at all: the browser commits to it before it 404s.
 */
const renditions = {};
let renderBytes = 0;
let renderFiles = 0;
for (const [profile, cfg] of Object.entries(RENDITIONS)) {
  const cards = {};
  for (const job of renderTodo.filter((j) => j.profile === profile)) {
    const files = cfg.widths.flatMap((w) => ["avif", "webp"].map((f) => join(OUT, `${job.stem}-${w}.${f}`)));
    if (!files.every((f) => existsSync(f))) continue;
    cards[job.base] = { stem: job.stem };
    for (const f of files) {
      renderBytes += statSync(f).size;
      renderFiles += 1;
    }
  }
  renditions[profile] = {
    widths: cfg.widths,
    formats: ["avif", "webp"],
    quality: { avif: cfg.avif, webp: cfg.webp },
    source: cfg.source,
    dir: "/assets/cards/",
    cards,
  };
}

await writeFile(
  MANIFEST,
  JSON.stringify(
    {
      _readme: [
        "Card scans mirrored at thumbnail size by scripts/sync-card-thumbs.mjs.",
        "",
        "Written because TCGdex's smallest rendition is 245px wide and there is no",
        "middle width at any host, so a list drawing 32 cards in 32px boxes paid",
        "about 550KB for it. These are fitted to a 72px box, which covers 32px at",
        "DPR2 with room, lossy WebP.",
        "",
        "KEYS ARE THE TCGDEX BASE URL, with no extension, exactly as it appears in",
        "public/data/cards/<set>.json. A builder that already holds the url looks it",
        "up directly and falls back to <base>/low.webp when it is not here.",
        "",
        "`w` and `h` are the file's real decoded size, which is not always 72 wide by",
        "the same height: the box is a bound and the scans are not one aspect ratio.",
        "",
        "DO NOT USE THESE WHERE THE PAGE ARGUES ABOUT WHAT IS PRINTED ON THE CARD.",
        "They are lossy and 72px wide. /rarity.html, /fake-cards.html, /types.html",
        "and /how-to-play.html show the full scan on purpose and should keep doing it.",
        "",
        "Files live at public/assets/cards/.",
        "",
        "`renditions` IS A SEPARATE THING FROM `thumbs` AND THE TWO ARE NOT",
        "INTERCHANGEABLE. `thumbs` is the 72px flattened WebP /grading.html draws",
        "at 32px. `renditions` is the middle width /wanted.html and /cards.html",
        "were missing, in AVIF and WebP, WITH THE ALPHA KEPT, at the widths those",
        "two pages measure. Read the one your page is named in.",
        "",
        "A rendition entry carries only a `stem`. The file is",
        "  /assets/cards/<stem>-<width>.<format>",
        "for every width in `widths` and every format in `formats`, and a card is",
        "listed ONLY when all of them exist, so a builder can emit the whole srcset",
        "without checking. A card that is missing keeps its remote TCGdex url and",
        "the page looks exactly like it did before this file grew a second half.",
      ],
      syncedAt: localDay(),
      box: BOX,
      quality: QUALITY,
      source: "assets.tcgdex.net low.webp",
      thumbs,
      renditions,
    },
    null,
    2
  ) + "\n"
);

console.log(
  `Wrote data/card-thumbs.json
  ${Object.keys(thumbs).length} of ${wanted.size} card thumbnails mirrored to public/assets/cards/
  ${held} already held, ${fetched} downloaded, ${reused} re-encoded from the raw cache
  ${(bytes / 1024).toFixed(1)} KB on disk, ${(bytes / Math.max(1, Object.keys(thumbs).length)).toFixed(0)} B average`
);
if (failed.length) {
  console.log(`  ${failed.length} would not download and keep their remote url:`);
  for (const f of failed.slice(0, 10)) console.log(`    ${f.meta.slug} ${f.meta.n} ${f.base}`);
}
console.log(
  `  renditions: ${renderFiles} files, ${(renderBytes / 1024).toFixed(0)} KB on disk` +
    Object.entries(renditions)
      .map(
        ([k, v]) =>
          `\n    ${k.padEnd(7)} ${String(Object.keys(v.cards).length).padStart(3)} of ${
            PROFILE_CARDS[k].size
          } cards at ${v.widths.join("/")}w, from ${v.source}`
      )
      .join("")
);
if (renderFailed.length) {
  console.log(`  ${renderFailed.length} scan(s) would not download; those cards keep their remote url:`);
  for (const f of renderFailed.slice(0, 10)) console.log(`    ${f}`);
}
