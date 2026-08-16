#!/usr/bin/env node
// Mirror every Pokemon video game cover locally, at the size it is drawn.
//
//   node scripts/sync-game-covers.mjs            fetch anything not held yet
//   node scripts/sync-game-covers.mjs --force    refetch and re-encode all
//
// SHAPED AFTER scripts/sync-symbols.mjs, which already solved this problem for
// set symbols. Same five properties, and they are properties rather than
// preferences: idempotent, cached, a manifest with real dimensions, a fallback
// to the remote url decided at sync time, and never failing the build on a
// network error.
//
// NOT IN build-all.mjs, deliberately, and that is a decision rather than an
// oversight. sync-symbols.mjs IS in the nightly because expansions.json grows
// on its own from an API pull, so a new set would otherwise keep a 500x500 png
// forever with nobody watching. Nothing grows here on its own: the 79 titles in
// data/video-games.json are a hand-curated list, so the only run that would
// ever fetch anything is one that follows a hand edit to that file, and the
// person making the edit is the person who should run this. Putting it in the
// nightly would add 104 conditional requests to Bulbagarden every night to
// discover, every night, that nothing changed. check-build.py's orphan guard
// only covers build-* and stamp-*, so a sync- script staying out of build-all
// is the supported shape, the same as sync-pokedex.mjs and sync-sets.mjs.
//
// WHERE THE FILES COME FROM. Bulbapedia's {{Infobox game}} names the cover
// file, Bulbagarden Archives hosts it, and data/video-games.json already holds
// both the filename and MediaWiki's own 320px thumbnail url per cover, read
// 2026-08-16. This script never touches either API: it fetches the thumbnail
// urls the research already resolved and re-encodes them. That is why it needs
// no key and cannot drift from the record it is illustrating.
//
// SIZING. Every cover is fitted inside a 320px BOX, which is 2x the 160px
// desktop tile, the same "cover the box at DPR2 and do not chase DPR3" call
// sync-symbols.mjs made at 48 for 24. Box, not shape: see below.
//
// THE BOX IS A BOUND AND NOT A SHAPE, and this is the finding that matters
// most. Measured across all 104 files the aspect ratios run 0.617 to 2.081,
// median 1.095, and they fall into families that are eras of hardware: square
// Game Boy carts near 1.00, wide N64 boxes near 1.43, portrait GameCube cases
// near 0.71, wide DS cases near 1.10, tall Switch keycases at 0.617, and the
// mobile logos out at 1.5 to 2.08 because a phone game has no box. So a
// 999x1280 source comes out 250x320 and a 1920x1080 one comes out 320x180.
// Emitting 320x320 on all of them would lie about the aspect ratio on 80 of
// 104 files, which is the same class of bug as the blanket rewrite that once
// made 173 card images wrong. The manifest carries the real numbers and the
// builder emits them.
//
// NO TRIM, NO PAD, NO UPSCALE, exactly as with the symbols. The page draws
// these with object-fit:contain inside a fixed square, so "fit the whole image
// into a box" is already what the browser does. Reproduce it and nothing moves.
//
// AVIF 55 AND WEBP 82, and those two numbers are not taste. They are the
// settings the research measured its published totals at: Red JP boxart lands
// on 23,574 bytes and 30,646 bytes at them, byte for byte the figures in
// data/video-games.json. Changing either makes the plan's 1,331.0 KB estimate
// stop describing what this writes, so if you change one, re-measure and say so.
//
// ALPHA SURVIVES. Several of the 21 logo files are transparent PNGs, and a
// transparent png flattened onto this site's dark chrome renders as a solid
// black tile that looks entirely deliberate. Checked on decode rather than
// assumed, the same way sync-symbols.mjs checks it.
//
// Needs Pillow, which the nightly already installs for build-og-pages.py.
// Node has no image resampler and this repo has no npm dependencies at all.

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, ".cache", "bulbagarden", "covers");
const OUT = join(ROOT, "public", "assets", "game-covers");
const MANIFEST = join(ROOT, "data", "cover-dims.json");

const FORCE = process.argv.includes("--force");

/** 2x the 160px desktop tile. The phone tile is 120px, so this is 2.7x there. */
const BOX = 320;
const Q_AVIF = 55;
const Q_WEBP = 82;

/**
 * Descriptive filename, same reasoning as build-logos.py and sync-symbols.mjs:
 * image search reads these. Derived from the Archives filename, which is
 * already descriptive and, checked over all 104, slugifies without a single
 * collision.
 */
const slugOf = (wikiFile) =>
  wikiFile
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const fileFor = (slug, ext) => `${slug}-pokemon-game-cover.${ext}`;

/**
 * Resize and encode a batch with Pillow. Reads {encode, probe} on stdin.
 *
 * convert("RGBA") first because the sources are not one mode: Archives serves
 * paletted PNGs, greyscale PNGs and JPEGs in the same set. Then the alpha
 * channel decides the output mode, because AVIF and WebP both pay for an alpha
 * plane whether or not anything in it is transparent.
 */
const PY = `
import json, sys
from PIL import Image

BOX = ${BOX}

def boxed(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    scale = min(BOX / w, BOX / h, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return im

jobs = json.load(sys.stdin)
for job in jobs.get("encode", []):
    im = boxed(job["src"])
    # A fully opaque alpha plane is bytes for nothing, and dropping it here is
    # what makes these match the sizes the research published.
    if im.getchannel("A").getextrema()[0] == 255:
        im = im.convert("RGB")
    im.save(job["avif"], "AVIF", quality=${Q_AVIF})
    im.save(job["webp"], "WEBP", quality=${Q_WEBP}, method=6)

# Read back EVERY mirrored file, not only the ones this run wrote. That is what
# fills the manifest on a run that fetched nothing, and it re-checks the alpha
# each time for free.
out = []
for job in jobs.get("probe", []):
    im = Image.open(job["avif"]).convert("RGBA")
    row = {"key": job["key"], "w": im.size[0], "h": im.size[1],
           "alphaMin": im.getchannel("A").getextrema()[0]}
    # Compared against the SOURCE, not against 255, so a cover that arrives
    # opaque does not cry wolf. The question worth asking is whether the encode
    # DROPPED transparency that was there. The raw cache is gitignored, so on a
    # fresh checkout there is nothing to compare with and this simply does not
    # run.
    if job.get("src"):
        row["srcAlphaMin"] = boxed(job["src"]).getchannel("A").getextrema()[0]
    out.append(row)
json.dump(out, sys.stdout)
`;

function pillow(payload) {
  const stdout = execFileSync("python3", ["-c", PY], {
    input: JSON.stringify(payload),
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout.toString());
}

/** One cover, with the patience every fetcher in this repo uses. */
async function download(url, dest) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          // MediaWiki asks for a real agent and answers 403 to the default one.
          "User-Agent": "GarbageRips585/1.0 (static fan site; mirrors cover art locally)",
        },
      });
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
    await new Promise((r) => setTimeout(r, attempt * 1200));
  }
  return 0;
}

await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });

const games = JSON.parse(await readFile(join(ROOT, "data/video-games.json"), "utf8"));

// One flat list of covers, each carrying the game it belongs to so a failure
// can be reported as "Pokemon Snap's second cover" rather than as a hash.
const wanted = [];
for (const g of games.games) {
  for (const c of g.covers) {
    if (!c.remote_320) continue;
    wanted.push({ key: c.file, slug: slugOf(c.file), title: g.title, url: c.remote_320, kind: c.kind });
  }
}

const rawExt = (url) => (/\.jpe?g(?:$|\?)/i.test(url) ? "jpg" : "png");

const todo = [];
let held = 0;
for (const c of wanted) {
  const avif = join(OUT, fileFor(c.slug, "avif"));
  const webp = join(OUT, fileFor(c.slug, "webp"));
  if (!FORCE && existsSync(avif) && existsSync(webp)) {
    held += 1;
    continue;
  }
  todo.push(c);
}

const failed = [];
let fetched = 0;
let reused = 0;

if (todo.length) {
  process.stdout.write(`Fetching ${todo.length} cover(s)`);
  // Six at a time, matching sync-symbols.mjs: quick enough to finish, gentle
  // enough not to look abusive to a volunteer-run wiki.
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(
      todo.slice(i, i + 6).map(async (c) => {
        const raw = join(RAW, `${c.slug}.${rawExt(c.url)}`);
        if (!FORCE && existsSync(raw)) {
          reused += 1;
        } else if (await download(c.url, raw)) {
          fetched += 1;
        } else {
          failed.push(c);
        }
      })
    );
    process.stdout.write(".");
  }
  process.stdout.write("\n");
}

const encode = [];
for (const c of todo) {
  const raw = join(RAW, `${c.slug}.${rawExt(c.url)}`);
  if (!existsSync(raw)) continue;
  encode.push({
    key: c.key,
    src: raw,
    avif: join(OUT, fileFor(c.slug, "avif")),
    webp: join(OUT, fileFor(c.slug, "webp")),
  });
}

// Probe list is everything already mirrored plus everything about to be, so the
// manifest is rebuilt from what is ON DISK rather than from what this run did.
const probe = [];
for (const c of wanted) {
  const avif = join(OUT, fileFor(c.slug, "avif"));
  const raw = join(RAW, `${c.slug}.${rawExt(c.url)}`);
  if (existsSync(avif) || encode.some((j) => j.key === c.key)) {
    probe.push({ key: c.key, avif, src: existsSync(raw) ? raw : null });
  }
}

let probed = [];
if (encode.length || probe.length) {
  try {
    probed = pillow({ encode, probe });
  } catch (e) {
    console.error("Pillow could not process the covers. Install it with:");
    console.error("  python3 -m pip install --user Pillow");
    console.error(String(e.stderr || e.message).trim().split("\n").slice(-3).join("\n"));
    process.exit(1);
  }
}

const bySlug = new Map(wanted.map((c) => [c.key, c]));
const covers = {};
const flatOpaque = [];
let avifBytes = 0;
let webpBytes = 0;

for (const r of probed) {
  const c = bySlug.get(r.key);
  if (!c) continue;
  if (r.srcAlphaMin !== undefined && r.srcAlphaMin < 255 && r.alphaMin === 255) {
    flatOpaque.push(r.key);
  }
  const a = statSync(join(OUT, fileFor(c.slug, "avif"))).size;
  const w = existsSync(join(OUT, fileFor(c.slug, "webp")))
    ? statSync(join(OUT, fileFor(c.slug, "webp"))).size
    : 0;
  avifBytes += a;
  webpBytes += w;
  covers[r.key] = { slug: c.slug, w: r.w, h: r.h, avif: a, webp: w };
}

const manifest = {
  _readme: [
    "Pokemon video game cover art mirrored locally by scripts/sync-game-covers.mjs.",
    "",
    "Keys are the Bulbagarden Archives filenames exactly as data/video-games.json",
    "records them, so a builder looks a cover up by the string it already holds and",
    "does not have to reimplement the slug rule. A cover MISSING from this map keeps",
    "its remote archives.bulbagarden.net url, decided at build time rather than with",
    "onerror, because onerror never fires for a lazy image below the fold.",
    "",
    "w and h are the REAL dimensions of the mirrored file and are almost never",
    "320x320. The box is a bound, not a shape: aspect ratios across these files run",
    "0.617 (a Switch keycase) to 2.081 (a wide mobile logo). Builders emit these as",
    "the width and height attributes so the browser reserves the right space.",
    "",
    "Files live at public/assets/game-covers/<slug>-pokemon-game-cover.avif, with a",
    "WebP of the same name beside it as the <picture> fallback.",
    "",
    "The artwork belongs to Nintendo, Game Freak, Creatures and The Pokemon Company.",
    "Bulbagarden Archives is the host it was read from, not the owner.",
  ],
  syncedAt: new Date().toISOString().slice(0, 10),
  box: BOX,
  quality: { avif: Q_AVIF, webp: Q_WEBP },
  covers,
};
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `Wrote data/cover-dims.json
  ${Object.keys(covers).length} of ${wanted.length} covers mirrored to public/assets/game-covers/
  ${held} already held, ${fetched} downloaded, ${reused} re-encoded from the raw cache
  ${kb(avifBytes)} AVIF, ${kb(webpBytes)} WebP on disk`
);
if (flatOpaque.length) {
  console.log(
    `  WARNING: ${flatOpaque.length} cover(s) had transparency in the source and\n` +
    `  came out opaque, so the encode dropped it: ${flatOpaque.slice(0, 8).join(", ")}`
  );
}
if (failed.length) {
  console.log(`  ${failed.length} would not download and keep their remote url:`);
  for (const c of failed) console.log(`    ${c.title}  ${c.key}`);
}
