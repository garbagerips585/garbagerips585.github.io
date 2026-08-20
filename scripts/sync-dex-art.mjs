#!/usr/bin/env node
// Mirror the official Pokemon artwork /lore.html names, at the size it is drawn.
//
//   node scripts/sync-dex-art.mjs            fetch anything not held yet
//   node scripts/sync-dex-art.mjs --force    refetch and re-encode all of them
//
// WHY THIS EXISTS. /lore.html is 832 words about specific Pokemon and it did not
// show one. Every fact on it names somebody: Tyranitar is the only Dark and Rock
// Pokemon there has ever been, Cosmoem and Celesteela are tied as the heaviest,
// Eternatus stands 20 metres. A reader who does not already know what a Cosmoem
// looks like learns nothing from the sentence, and this is the one page on the
// site where the subject of every claim is a drawable object.
//
// SOURCE IS PokeAPI's SPRITE REPOSITORY, which is where the two mascots and the
// eight hazards in /garbage-run.html already came from, and it is the same
// project data/pokedex.json is generated off. Using a second source for the
// pictures than for the numbers is how a page ends up captioning the wrong
// Pokemon.
//
// TWO SIZES AND BOTH ARE THE DRAWN BOX DOUBLED, which is the rule the rest of
// this repo follows and the reason /rarity.html went from 2,536KB to 388KB:
//
//   md  320px   the mascot pair, drawn at 160px in .lore-scale
//   sm  128px   the fact and combination portraits, drawn at 64px
//
// The originals are 475x475. At 128px that is a 3.7x linear oversample removed,
// and it is the whole cost of this page: measured, the 25 files are 3,391KB as
// fetched and 162KB after, a 95% cut, with nothing on screen changing size.
//
// LOSSY WEBP AT q82, NOT LOSSLESS, and this is the opposite call to
// sync-symbols.mjs on purpose. A set symbol is hard-edged line art at 20px where
// a ringing artefact is the only thing lossy buys you. Official artwork is a
// soft airbrushed illustration with gradients, which is the exact case lossy
// codecs are good at: measured over these 25 files, q82 is 162KB for pixels
// that are 3,391KB as the source pngs, and at 2x on a phone nothing softens.
//
// THE ALPHA IS KEPT. These are cut-outs on transparency and the page draws them
// on cream. Flattened onto white they would carry a white halo on the cream, and
// it would look like a rendering bug rather than a decision.
//
// IDEMPOTENT, cached under .cache/dex-art/ (gitignored), never fails the build.
// A missing file means build-lore.mjs draws the site's hatched no-art box in the
// same footprint instead, which is the honest answer and not a hole.
//
// WHEN THE DEX DATA CHANGES, THIS LIST CAN GO STALE AND THE FAILURE IS SAFE.
// The ids below are the answers to the page's computed facts as of the pokedex
// read date. If a future generation makes somebody else the heaviest, the fact
// changes and the id here does not, so build-lore.mjs looks the portrait up BY
// THE ID IT IS ABOUT TO NAME and falls back to the hatched box when it is not
// held. It cannot end up captioning Celesteela with a picture of something else.
// build-lore.mjs prints the ids it wanted and could not find, so the gap is
// visible in the build log rather than only on the page.
//
// Needs Pillow, which the nightly already installs for build-og-pages.py.

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/assets/dex");
const CACHE = join(ROOT, ".cache/dex-art");
const MANIFEST = join(ROOT, "data/dex-art.json");
const FORCE = process.argv.includes("--force");

const ART = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/";

// id -> box, and the comment says which line of /lore.html each one is the
// subject of, so a later editor can tell what breaks if they drop one.
const WANT = {
  568: "md", 569: "md",                                   // the mascots, drawn to scale
  248: "sm",                                              // the only Dark and Rock
  790: "sm", 797: "sm",                                   // heaviest, tied
  92: "sm", 93: "sm", 669: "sm", 789: "sm", 798: "sm",    // the five lightest
  890: "sm",                                              // tallest
  144: "sm", 145: "sm", 146: "sm",                        // lowest capture rate
  225: "sm",                                              // Flying/Ice, with Articuno
  170: "sm", 171: "sm",                                   // Electric/Water
  302: "sm", 442: "sm",                                   // Dark/Ghost
  322: "sm", 323: "sm",                                   // Fire/Ground
  343: "sm", 344: "sm",                                   // Ground/Psychic
  345: "sm", 346: "sm",                                   // Grass/Rock
};
const BOX = { md: 320, sm: 128 };

const exists = (p) => stat(p).then(() => true).catch(() => false);

await mkdir(OUT, { recursive: true });
await mkdir(CACHE, { recursive: true });

// One Python process for the whole run rather than one per file: 25 Pillow
// startups is most of the wall clock of this script.
const PY = `
import sys, json, io
from PIL import Image
jobs = json.loads(sys.argv[1])
out = {}
for src, dest, box in jobs:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    s = min(box / w, box / h, 1.0)          # never upscale
    if s < 1.0:
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    im.save(dest, "WEBP", quality=82, method=6)
    out[dest] = im.size
print(json.dumps(out))
`;

const jobs = [];
const manifest = {
  _readme: [
    "Written by scripts/sync-dex-art.mjs. Do not hand-edit.",
    "Official Pokemon artwork mirrored from the PokeAPI sprite repository, at the size /lore.html draws it.",
    "Pokemon and Pokemon character names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc.",
    "This is a fan site. Nothing is sold here and nothing on it is affiliated with or endorsed by them.",
  ],
  checked: localDay(),
  source: "PokeAPI/sprites, official-artwork",
  art: {},
};

let fetched = 0, held = 0, rawBytes = 0;
for (const [id, size] of Object.entries(WANT)) {
  const dest = join(OUT, `${id}.webp`);
  const raw = join(CACHE, `${id}.png`);
  if (!FORCE && (await exists(dest))) { held += 1; continue; }
  try {
    if (!(await exists(raw))) {
      const r = await fetch(`${ART}${id}.png`);
      if (!r.ok) throw new Error(`http ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(raw, buf);
    }
    rawBytes += (await stat(raw)).size;
    jobs.push([raw, dest, BOX[size]]);
  } catch (e) {
    console.log(`  FAIL ${id}: ${e.message}`);
  }
}

let dims = {};
if (jobs.length) {
  try {
    dims = JSON.parse(execFileSync("python3", ["-c", PY, JSON.stringify(jobs)], { encoding: "utf8" }));
    fetched = jobs.length;
  } catch (e) {
    console.log(`  Pillow step failed: ${String(e.stderr || e.message).trim().split("\n").pop()}`);
  }
}

// Read the dimensions of everything held, not only what was just written: the
// builder puts width and height on every tag and a re-run that fetched nothing
// still has to produce a complete manifest.
const sizeOf = async (p) => {
  try {
    return JSON.parse(
      execFileSync("python3", ["-c", "import sys,json;from PIL import Image;print(json.dumps(Image.open(sys.argv[1]).size))", p], { encoding: "utf8" })
    );
  } catch { return null; }
};

let outBytes = 0;
for (const id of Object.keys(WANT)) {
  const dest = join(OUT, `${id}.webp`);
  if (!(await exists(dest))) continue;
  const wh = dims[dest] || (await sizeOf(dest));
  if (!wh) continue;
  outBytes += (await stat(dest)).size;
  manifest.art[id] = { file: `/assets/dex/${id}.webp`, w: wh[0], h: wh[1], box: WANT[id] };
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(
  `dex art: ${fetched} written, ${held} already held, ${Object.keys(manifest.art).length} in manifest` +
  (rawBytes ? `, ${(rawBytes / 1024).toFixed(0)}KB fetched -> ${(outBytes / 1024).toFixed(0)}KB stored` : `, ${(outBytes / 1024).toFixed(0)}KB stored`)
);
