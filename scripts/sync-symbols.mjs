#!/usr/bin/env node
// Mirror every set symbol locally, at the size it is actually drawn.
//
//   node scripts/sync-symbols.mjs            fetch anything not held yet
//   node scripts/sync-symbols.mjs --force    refetch and re-encode all of them
//
// WHY THIS EXISTS, MEASURED. /expansions.html paints 174 set symbols and
// /what-set.html paints 141 of the same files. They are 20px and 24px boxes.
// The API's own files are not:
//
//   base1   884x452   57,977 B      xy0 dc1 ru1 bw2 pl4 xy7 mcd* all 500x500
//   fut20    31x31        717 B      sv1 40x40, 2,077 B
//
// So it is the LEGACY sets carrying the weight; the newer ones were already
// sane, which is why this reads as "some pages are heavy" rather than as one
// obvious bad file. Measured over CDP at 390x844 DPR2, cache disabled, full
// scroll with lazy images forced: expansions.html transferred 2,604.9 KB of
// images and what-set.html 1,769.9 KB, and the symbols were 84% and 83% of it.
//
// A 500x500 png in a 20px box is a 25x linear oversample. This fetches each one
// once, fits it inside a 48px box (which covers the 24px box at DPR2) and
// writes a lossless WebP into public/assets/symbols/.
//
// FOUR DECISIONS, all of them the boring option on purpose:
//
// NO TRIM, NO PAD, NO UPSCALE. Both pages draw these with object-fit:contain
// inside a fixed square, so "fit the whole image into a box" is already exactly
// what the browser does. Reproduce that and nothing moves. Trimming the
// transparent margin would make some symbols render LARGER than they do today,
// and padding to a square would make the small ones render smaller. Sources
// already under 48px (fut20 at 31x31, the four Scrydex ones) keep their own
// pixels and are only re-encoded.
//
// LOSSLESS WEBP. These are hard-edged line art at a size where a halo is the
// only thing lossy would buy you. Measured over the 12 files above: lossless
// 18.2 KB, q90 15.0 KB, q80 12.7 KB, optimised png 31.2 KB, original 273.7 KB.
// Lossy is 18% smaller than lossless and both are ~93% off the original, so the
// 3 KB is not worth an artefact on a symbol whose whole job is to be told apart
// from another symbol. Alpha survives either way and that was checked on decode,
// not assumed: a transparent png flattened onto the site's dark chrome would
// look like a solid black tile and it would look deliberate.
//
// THE MANIFEST CARRIES REAL DIMENSIONS, the way data/logo-dims.json does. The
// files are not all one shape (base1 comes out 48x25) so a builder cannot
// hardcode 48x48 without lying about the aspect ratio in the markup.
//
// FALLBACK IS THE REMOTE URL. A set with no local file keeps the
// images.pokemontcg.io / images.scrydex.com url it has today, so a fetch that
// fails degrades to the current behaviour rather than to a broken image. That
// is decided at build time from this manifest, not with onerror: onerror never
// fires for a lazy image below the fold, which is the same reason
// sync-expansions.mjs checks the symbol urls at sync time.
//
// IDEMPOTENT. A symbol whose WebP already exists is not refetched and not
// re-encoded. Raw downloads are cached under .cache/ptcg/symbols/ (gitignored)
// so deleting the output and rebuilding costs no network either.
//
// Needs Pillow, which the nightly already installs for build-og-pages.py.
// Node has no image resampler and this repo has no npm dependencies at all, so
// the resize is handed to Python the same way every other image pipeline here
// does it (build-logos.py, build-packs.py, build-og.py).

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, ".cache", "ptcg", "symbols");
const OUT = join(ROOT, "public", "assets", "symbols");
const MANIFEST = join(ROOT, "data", "symbol-dims.json");

const FORCE = process.argv.includes("--force");

/** Covers the 24px box on /what-set.html at DPR2, and 20px on /expansions.html at 2.4x. */
const BOX = 48;

/**
 * Descriptive filename, same reasoning as build-logos.py: image search reads
 * these and "base1.webp" says nothing. The shape is fixed so a builder can
 * derive the url from a set id.
 */
const fileFor = (apiId) => `${apiId}-pokemon-tcg-set-symbol.webp`;

/**
 * Resize a batch with Pillow. Reads [{src,dst}] on stdin, prints [{w,h,bytes}].
 *
 * convert("RGBA") first because the sources are not one mode: the Scrydex four
 * are paletted (P) with a transparent index and fut20 is greyscale+alpha (LA).
 * getchannel("A") throws on both without the convert, and a bare save would
 * drop the transparency on the paletted ones.
 */
const PY = `
import json, sys
from PIL import Image

BOX = ${BOX}
jobs = json.load(sys.stdin)
for job in jobs.get("encode", []):
    im = Image.open(job["src"]).convert("RGBA")
    w, h = im.size
    scale = min(BOX / w, BOX / h, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    im.save(job["dst"], "WEBP", lossless=True, method=6)

# Read back EVERY mirrored file, not only the ones this run wrote. That is what
# fills the manifest on a run that fetched nothing, and it re-checks the alpha
# channel each time for free. A symbol that arrives opaque paints as a solid
# tile on both pages and looks entirely intentional, so it is checked rather
# than trusted.
out = []
for job in jobs.get("probe", []):
    im = Image.open(job["dst"]).convert("RGBA")
    lo, hi = im.getchannel("A").getextrema()
    row = {"id": job["id"], "w": im.size[0], "h": im.size[1], "alphaMin": lo}
    # Compared against the SOURCE, not against 255. Two of these (bw1, mcd12)
    # ship from the API fully opaque already, so a flat "this one has no
    # transparency" warning cries wolf on files nothing has done anything to.
    # The question worth asking is whether the encode DROPPED an alpha channel
    # that was there. The raw cache is gitignored, so on a fresh checkout there
    # is nothing to compare with and the check simply does not run.
    if job.get("src"):
        src = Image.open(job["src"]).convert("RGBA")
        row["srcAlphaMin"] = src.getchannel("A").getextrema()[0]
    out.append(row)
json.dump(out, sys.stdout)
`;

function pillow(payload) {
  const stdout = execFileSync("python3", ["-c", PY], {
    input: JSON.stringify(payload),
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout.toString());
}

/**
 * One symbol, with the same patience sync-expansions.mjs uses on this API: it
 * rate-limits hard and answers 500 rather than 429 when it is unhappy.
 */
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
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  return 0;
}

await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/expansions.json"), "utf8"));
const wanted = sets.filter((s) => s.symbol);

const dims = {};
const failed = [];
const flat = [];
let fetched = 0;
let held = 0;
let reused = 0;

// Six at a time, matching sync-expansions.mjs: quick enough to finish, gentle
// enough not to look abusive.
const todo = [];
for (const s of wanted) {
  const out = join(OUT, fileFor(s.apiId));
  if (!FORCE && existsSync(out)) {
    held += 1;
    continue;
  }
  todo.push(s);
}

if (todo.length) {
  process.stdout.write(`Fetching ${todo.length} set symbol(s)`);
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(
      todo.slice(i, i + 6).map(async (s) => {
        const raw = join(RAW, `${s.apiId}.png`);
        if (!FORCE && existsSync(raw)) {
          reused += 1;
        } else if (await download(s.symbol, raw)) {
          fetched += 1;
        } else {
          failed.push(s);
          return;
        }
      })
    );
    process.stdout.write(".");
  }
  process.stdout.write("\n");
}

const encode = [];
for (const s of wanted) {
  const out = join(OUT, fileFor(s.apiId));
  const raw = join(RAW, `${s.apiId}.png`);
  if (existsSync(out) && !FORCE) continue;
  if (!existsSync(raw)) continue;
  encode.push({ id: s.apiId, src: raw, dst: out });
}

// Probe list is everything already mirrored plus everything about to be, so the
// manifest is rebuilt from what is ON DISK rather than from what this run did.
const probe = [];
for (const s of wanted) {
  const out = join(OUT, fileFor(s.apiId));
  const raw = join(RAW, `${s.apiId}.png`);
  if (existsSync(out) || encode.some((j) => j.id === s.apiId)) {
    probe.push({ id: s.apiId, dst: out, src: existsSync(raw) ? raw : null });
  }
}

let probed = [];
if (encode.length || probe.length) {
  try {
    probed = pillow({ encode, probe });
  } catch (e) {
    console.error("Pillow could not process the symbols. Install it with:");
    console.error("  python3 -m pip install --user Pillow");
    console.error(String(e.stderr || e.message).trim().split("\n").slice(-3).join("\n"));
    process.exit(1);
  }
}

const flatOpaque = [];
for (const r of probed) {
  if (r.srcAlphaMin !== undefined && r.srcAlphaMin < 255 && r.alphaMin === 255) {
    flatOpaque.push(r.id);
  }
  dims[r.id] = [r.w, r.h];
  flat.push(statSync(join(OUT, fileFor(r.id))).size);
}

const manifest = {
  _readme: [
    "Set symbols mirrored locally by scripts/sync-symbols.mjs.",
    "",
    "Written because the API's own symbol files are up to 884x452 and 58 KB for",
    "a mark that renders in a 20px box. These are fitted inside a 48px box,",
    "lossless WebP, alpha intact.",
    "",
    "Keys are Pokemon TCG API set ids. The value is the real [width, height] of",
    "the mirrored file, which is NOT always 48x48: the box is a bound, not a",
    "shape, and base1 is 884x452 so it comes out 48x25. Builders emit these as",
    "the width and height attributes, and fall back to the remote url for any",
    "set that is not listed here.",
    "",
    "The file lives at public/assets/symbols/<id>-pokemon-tcg-set-symbol.webp.",
  ],
  syncedAt: localDay(),
  box: BOX,
  symbols: dims,
};
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

const total = flat.reduce((a, b) => a + b, 0);
console.log(
  `Wrote data/symbol-dims.json
  ${Object.keys(dims).length} of ${wanted.length} set symbols mirrored to public/assets/symbols/
  ${held} already held, ${fetched} downloaded, ${reused} re-encoded from the raw cache
  ${(total / 1024).toFixed(1)} KB on disk, ${(total / Math.max(1, flat.length)).toFixed(0)} B average`
);
if (flatOpaque.length) {
  console.log(
    `  WARNING: ${flatOpaque.length} symbol(s) had transparency in the source and\n` +
    `  came out opaque, so the encode dropped it: ${flatOpaque.slice(0, 10).join(", ")}`
  );
}
if (failed.length) {
  console.log(`  ${failed.length} would not download and keep their remote url:`);
  for (const s of failed) console.log(`    ${s.apiId}  ${s.name}  ${s.symbol}`);
}
