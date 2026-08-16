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

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, ".cache", "tcgdex", "thumbs");
const OUT = join(ROOT, "public", "assets", "cards");
const MANIFEST = join(ROOT, "data", "card-thumbs.json");
const FORCE = process.argv.includes("--force");

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
    im = Image.open(job["src"]).convert("RGB")
    w, h = im.size
    scale = min(BOX / w, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    im.save(job["dst"], "WEBP", quality=${QUALITY}, method=6)

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

async function download(url, dest) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
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

const probed = encode.length || probe.length ? pillow({ encode, probe }) : [];

const thumbs = {};
let bytes = 0;
for (const r of probed) {
  const meta = wanted.get(r.key);
  const name = fileFor(meta.slug, meta.n, meta.name);
  thumbs[r.key] = { file: name, w: r.w, h: r.h };
  bytes += statSync(join(OUT, name)).size;
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
      ],
      syncedAt: new Date().toISOString().slice(0, 10),
      box: BOX,
      quality: QUALITY,
      source: "assets.tcgdex.net low.webp",
      thumbs,
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
