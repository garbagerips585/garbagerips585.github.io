#!/usr/bin/env node
// Mirror the official artwork for all 1,025 species, at the size /pokemon/ draws it.
//
//   node scripts/sync-species-art.mjs            fetch anything not held yet
//   node scripts/sync-species-art.mjs --force    refetch and re-encode all of them
//   node scripts/sync-species-art.mjs --limit 50 stop after 50 new ones
//
// NOT IN build-all.mjs, deliberately, and for the same reason sync-pokedex.mjs
// is not: a cold run is a thousand requests to somebody else's repository, and
// the answer does not change unless a generation ships. Run it by hand when one
// does. build-pokemon.mjs treats a missing portrait as a missing portrait: the
// page drops the picture and keeps every word, so a half-finished run never
// leaves a hole or a broken image on a page.
//
// SAME SOURCE AS THE NUMBERS. data/pokedex.json comes from PokeAPI, so the
// pictures come from PokeAPI's sprite repository too. sync-dex-art.mjs already
// does this for the twenty-five portraits on /lore.html and this is the same
// job at Pokedex scale; the two are kept apart rather than merged because that
// one is a hand-written list of the species a specific page argues about, and
// this one is "all of them". Merging them would mean /lore.html's list quietly
// deciding what /pokemon/ can draw.
//
// ONE SIZE, 256px, AND IT IS THE LARGEST DRAWN BOX DOUBLED. The portrait beside
// the H1 is drawn at 128 CSS pixels, so 256 is exactly sharp at DPR 2. The
// evolution line draws the SAME file at 72, which is oversampled, and that is
// the deliberate trade: two renditions would be 2,050 files to save a few KB on
// a picture that is already 12.
//
// THAT SENTENCE STOPPED BEING TRUE ON 18 AUGUST 2026 AND THE SECOND RENDITION IS
// UNDER lg/. It exists for exactly one caller, Who's That Pokemon, and the
// reason is that the game does NOT draw a 128px box: measured at 390x844 DPR 2
// the silhouette stage draws the artwork at 249 CSS pixels, which asks for 498
// device pixels. Handing it the 256 file is a 1.95x upscale, and the reveal is
// the moment the whole game is for. PSNR against the master resampled to 498,
// four species: the 256 file scores 20.6 to 31.6 dB, the lg file 32.5 to 44.3.
// That is not a rounding difference, it is visible blur.
//
// SO WHY NOT JUST RAISE BOX TO 475 FOR EVERYTHING. Because /pokemon/ draws up to
// nine portraits a page in 128 and 72px boxes across 1,026 pages, and 475 costs
// 21.7KB against 12.1. That is roughly +85KB on every Pokedex page to sharpen a
// picture nobody is looking at closely, which is the trade this file already
// refused once at 192 -> 256. The game is the only place a species portrait is
// the subject rather than a thumbnail, so the game gets the second rendition and
// nothing else does. If a second caller ever wants lg/, ask first whether its box
// is really over 128, because most of them are not.
//
// lg IS THE SOURCE'S OWN 475px AND NOT A NUMBER SOMEBODY PICKED. Every original
// is 475x475 and the encoder never upscales, so lg/ is "the master, re-coded":
// identical pixels to the png the game used to hotlink, at 21.7KB against 121.
// 384 was tried and is a dead middle, 21.4KB for 8 dB less.
//
// IT WAS 192 FOR AN AFTERNOON AND THAT WAS THE WRONG ROUNDING. 192 is the double
// of a 96px hero, and a 96px hero on a 390px phone is a stamp rather than a
// picture of the thing the page is about. Sizing the file to the drawn box is
// this repo's rule (see sync-dex-art.mjs, which says the same thing twice); what
// changed is the box, so the file changed with it rather than the page shipping
// a 1.5x upscale nobody would have measured.
//
// The originals are 475x475, so this is a 1.9x linear oversample removed and it
// is the whole cost of the picture: 118MB of png becomes 12.5MB of webp, an 89%
// cut, with nothing on screen changing size.
//
// LOSSY WEBP AT q82, the same call and the same reasoning as sync-dex-art.mjs:
// this is soft airbrushed illustration with gradients, which is the case lossy
// codecs are good at, and the alpha is kept because these are cut-outs the page
// draws on white.
//
// WHY NOT AVIF. avifPicture() in shared/format.mjs is for TCGdex card scans and
// keys off that host; these are local files and would need a second encode and a
// second file each to be worth wrapping. At 12KB a portrait the saving is a few
// KB against 1,025 more files in the tree, so webp alone.
//
// NO IMAGE ON THIS SITE MAY EXCEED 200KB. The largest of these is well under 20.
// The script prints the largest file it wrote so that stays checkable.
//
// Needs Pillow, which the nightly already installs for build-og-pages.py.

import { mkdir, readFile, writeFile, stat, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/assets/species");
const BIG_OUT = join(OUT, "lg");
const SM_OUT = join(OUT, "sm");
const CACHE = join(ROOT, ".cache/species-art");
const MANIFEST = join(ROOT, "data/species-art.json");
const FORCE = process.argv.includes("--force");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit")) || "").split("=")[1] ||
  process.argv[process.argv.indexOf("--limit") + 1] || 0) || Infinity;

const ART =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/";
const BOX = 256;
// The masters are 475x475 and the encoder never upscales, so this is "as big as
// the source goes" rather than a chosen width. See the note above.
const BIG = 475;
// sm IS THE THIRD RENDITION AND THE NOTE ABOVE IS THE REASON IT EXISTS RATHER
// THAN AN EXCEPTION TO IT. That note refuses a second caller for lg/ and tells
// the next person to ask whether the drawn box is really over 128, "because most
// of them are not". /evolution.html is the case it was describing: 340 line
// headings drawing a portrait in a 48px box, where the 256px file is a 5.3x
// linear oversample on a page that is already the tallest on the site. 96 is
// that 48px box doubled, the same 2x rule BOX itself follows. Measured on the
// 340 portraits that page actually emits: 1.17MB at 96 against 3.49MB at 256,
// 3.5KB apiece. Over all 1,025 species it is 3.8MB on disk against 11.8MB.
const SM = 96;
const CONC = 6;

const exists = (p) => stat(p).then(() => true).catch(() => false);

await mkdir(OUT, { recursive: true });
await mkdir(BIG_OUT, { recursive: true });
await mkdir(SM_OUT, { recursive: true });
await mkdir(CACHE, { recursive: true });

const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8")).pokemon;
console.log(`Official artwork for ${dex.length} species, ${BOX}px and ${BIG}px, webp q82`);

// FETCH FIRST, ENCODE ONCE. Pillow's startup is most of the wall clock of a
// small run, so the whole batch goes through one python process at the end the
// way sync-dex-art.mjs does. Downloads are pooled at 6, which is what
// sync-pokedex.mjs settled on against the same project's servers.
// A SPECIES IS "TODO" IF ANY RENDITION IS MISSING, not if the 256 one is.
// Written that way so adding lg/ to a tree that already holds all 1,025 small
// files does the right thing on a plain re-run: the old condition short
// circuited on the 256 file and would have produced an empty job list and a
// manifest claiming nothing was missing. Adding sm/ hit the SAME trap from the
// other side, which is why this is a list rather than a second boolean: the
// tree already held every 256 and every lg file, so a condition naming only
// those two would have found nothing to do and written a manifest with no sm
// entry in it, and /evolution.html would have shipped 340 portraits that 404.
const todo = [];
for (const p of dex) {
  const have256 = await exists(join(OUT, `${p.id}.webp`));
  const haveBig = await exists(join(BIG_OUT, `${p.id}.webp`));
  const haveSm = await exists(join(SM_OUT, `${p.id}.webp`));
  if (!FORCE && have256 && haveBig && haveSm) continue;
  todo.push(p);
  if (todo.length >= LIMIT) break;
}

let rawBytes = 0;
let failed = 0;
const jobs = [];
let i = 0;
let done = 0;
await Promise.all(
  Array.from({ length: CONC }, async () => {
    while (i < todo.length) {
      const p = todo[i++];
      const raw = join(CACHE, `${p.id}.png`);
      const dest = join(OUT, `${p.id}.webp`);
      const bigDest = join(BIG_OUT, `${p.id}.webp`);
      const smDest = join(SM_OUT, `${p.id}.webp`);
      try {
        if (!(await exists(raw))) {
          const r = await fetch(`${ART}${p.id}.png`);
          if (!r.ok) throw new Error(`http ${r.status}`);
          await writeFile(raw, Buffer.from(await r.arrayBuffer()));
        }
        rawBytes += (await stat(raw)).size;
        // ONE DOWNLOAD, THREE ENCODES. Every rendition comes off the same cached
        // png, so filling in lg/ or sm/ for a tree that already has every 256
        // file makes no network request at all.
        if (FORCE || !(await exists(dest))) jobs.push([raw, dest, BOX]);
        if (FORCE || !(await exists(bigDest))) jobs.push([raw, bigDest, BIG]);
        if (FORCE || !(await exists(smDest))) jobs.push([raw, smDest, SM]);
      } catch (e) {
        failed += 1;
        console.log(`  FAIL ${p.id} ${p.name}: ${e.message}`);
      }
      if (++done % 50 === 0) process.stdout.write(`\r  fetched: ${done}/${todo.length}`);
    }
  }),
);
if (todo.length) process.stdout.write(`\r  fetched: ${done}/${todo.length}\n`);

const PY = `
import sys, json
from PIL import Image
jobs = json.loads(sys.stdin.read())
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

let dims = {};
if (jobs.length) {
  // In batches, because the job list is passed on stdin and a thousand paths is
  // a large argument either way. Chunking also means a Pillow failure loses one
  // batch rather than the whole run.
  for (let k = 0; k < jobs.length; k += 200) {
    const chunk = jobs.slice(k, k + 200);
    try {
      Object.assign(
        dims,
        JSON.parse(execFileSync("python3", ["-c", PY], { input: JSON.stringify(chunk), encoding: "utf8" })),
      );
    } catch (e) {
      console.log(`  Pillow step failed: ${String(e.stderr || e.message).trim().split("\n").pop()}`);
    }
    process.stdout.write(`\r  encoded: ${Math.min(k + 200, jobs.length)}/${jobs.length}`);
  }
  process.stdout.write("\n");
}

// Read the size of everything HELD, not only what was just written: the builder
// puts width and height on every tag, so a re-run that fetched nothing still has
// to produce a complete manifest.
// readdir is not recursive, so lg/ and sm/ come back as directory entries and
// are filtered out by the .webp test; each is scanned separately and joined in.
const held = (await readdir(OUT)).filter((f) => f.endsWith(".webp"));
const heldBig = (await readdir(BIG_OUT).catch(() => [])).filter((f) => f.endsWith(".webp"));
const heldSm = (await readdir(SM_OUT).catch(() => [])).filter((f) => f.endsWith(".webp"));
const need = [
  ...held.map((f) => join(OUT, f)),
  ...heldBig.map((f) => join(BIG_OUT, f)),
  ...heldSm.map((f) => join(SM_OUT, f)),
].filter((p) => !dims[p]);
if (need.length) {
  // A FILE IT CANNOT READ IS DELETED RATHER THAN SKIPPED, so an interrupted run
// heals itself. Killing this script mid-encode leaves one truncated .webp on
// disk: Pillow cannot open it, the manifest step quietly leaves it out, the page
// correctly drops that portrait, and NOTHING EVER FIXES IT, because the next run
// without --force sees a file present and moves on. That happened once, to
// #776, and it was found by hand. Removing it here means the next run refetches
// it from the cached png in seconds.
    const SIZES = `
import sys, json, os
from PIL import Image
out = {}
for p in json.loads(sys.stdin.read()):
    try:
        out[p] = Image.open(p).size
    except Exception:
        os.remove(p)
print(json.dumps(out))
`;
  for (let k = 0; k < need.length; k += 400) {
    try {
      Object.assign(
        dims,
        JSON.parse(
          execFileSync("python3", ["-c", SIZES], {
            input: JSON.stringify(need.slice(k, k + 400)),
            encoding: "utf8",
          }),
        ),
      );
    } catch {
      /* a portrait with no readable size is simply left out of the manifest */
    }
  }
}

const art = {};
let outBytes = 0;
let bigBytes = 0;
let bigCount = 0;
let smBytes = 0;
let smCount = 0;
let biggest = { id: null, bytes: 0 };
for (const p of dex) {
  const dest = join(OUT, `${p.id}.webp`);
  const wh = dims[dest];
  if (!wh) continue;
  const bytes = (await stat(dest)).size;
  outBytes += bytes;
  if (bytes > biggest.bytes) biggest = { id: p.id, name: p.name, bytes };
  art[p.id] = { file: `/assets/species/${p.id}.webp`, w: wh[0], h: wh[1] };
  // THE sm ENTRY IS SET BEFORE THE lg BLOCK AND THAT ORDER IS LOAD BEARING.
  // The lg block below ends the iteration with a continue when a species has no
  // master rendition, so anything attached after it is silently dropped for
  // exactly those species. Writing sm here means a species missing lg still
  // carries its small portrait, which is what /evolution.html asks for.
  const smDest = join(SM_OUT, `${p.id}.webp`);
  const swh = dims[smDest];
  if (swh) {
    smBytes += (await stat(smDest)).size;
    smCount += 1;
    art[p.id].sm = { file: `/assets/species/sm/${p.id}.webp`, w: swh[0], h: swh[1] };
  }
  // THE lg ENTRY IS OPTIONAL AND ITS ABSENCE IS THE SIGNAL. build-games.mjs
  // keeps a species out of the silhouette pool when there is no lg file, so an
  // interrupted run costs the game a few species rather than shipping a round
  // whose picture 404s. Never fall back to the 256 file here: that would put a
  // 1.95x upscale on screen and nothing would report it.
  const bigDest = join(BIG_OUT, `${p.id}.webp`);
  const bwh = dims[bigDest];
  if (!bwh) continue;
  const bb = (await stat(bigDest)).size;
  bigBytes += bb;
  bigCount += 1;
  if (bb > biggest.bytes) biggest = { id: p.id, name: p.name, bytes: bb };
  art[p.id].lg = { file: `/assets/species/lg/${p.id}.webp`, w: bwh[0], h: bwh[1] };
}

await writeFile(
  MANIFEST,
  JSON.stringify(
    {
      _readme: [
        "Written by scripts/sync-species-art.mjs. Do not hand-edit.",
        "Official Pokemon artwork mirrored from the PokeAPI sprite repository, at the",
        "size /pokemon/ draws it: 256px, which is the 128px drawn hero box doubled.",
        "Each entry may also carry lg, the master's own 475px, which exists for one",
        "caller: the silhouette game draws its artwork at 249 CSS px and 256 would be",
        "a 1.95x upscale there. Nothing else should reach for it. An entry without lg",
        "is a species the game leaves out of its pool.",
        "Each entry may also carry sm, 96px, which is the 48px box /evolution.html",
        "draws on each of its 340 line headings, doubled. That page shows 340",
        "portraits at once, so the 256px file would have been 4.4MB of one page.",
        "Pokemon and Pokemon character names are trademarks of Nintendo, Creatures Inc.",
        "and GAME FREAK inc. This is a fan site. Nothing is sold here and nothing on it",
        "is affiliated with or endorsed by them.",
        "",
        "Keyed by National Pokedex number, which is what data/pokedex.json and the",
        "printings corpus both join on, so a portrait can never be attached to the",
        "wrong species by a name that two things spell differently.",
      ],
      source: "PokeAPI/sprites, official-artwork",
      sourceUrl: "https://github.com/PokeAPI/sprites",
      checked: localDay(),
      box: BOX,
      lgBox: BIG,
      smBox: SM,
      count: Object.keys(art).length,
      lgCount: bigCount,
      smCount,
      art,
    },
    null,
    1,
  ) + "\n",
);

console.log(
  `\nWrote data/species-art.json: ${Object.keys(art).length} of ${dex.length} species held` +
    (failed ? `, ${failed} failed` : ""),
);
if (rawBytes) console.log(`  ${(rawBytes / 1024 / 1024).toFixed(1)}MB fetched this run`);
console.log(`  ${(outBytes / 1024 / 1024).toFixed(1)}MB stored at ${BOX}px, ${(outBytes / 1024 / Math.max(1, Object.keys(art).length)).toFixed(1)}KB average`);
console.log(`  ${(bigBytes / 1024 / 1024).toFixed(1)}MB stored at ${BIG}px for ${bigCount} species, ${(bigBytes / 1024 / Math.max(1, bigCount)).toFixed(1)}KB average`);
console.log(`  ${(smBytes / 1024 / 1024).toFixed(2)}MB stored at ${SM}px for ${smCount} species, ${(smBytes / 1024 / Math.max(1, smCount)).toFixed(1)}KB average`);
if (smCount < Object.keys(art).length)
  console.log(`  ${Object.keys(art).length - smCount} species have no sm file and get NO portrait on /evolution.html`);
if (bigCount < Object.keys(art).length)
  console.log(`  ${Object.keys(art).length - bigCount} species have no lg file and are OUT of the silhouette pool`);
if (biggest.id)
  console.log(`  largest: #${biggest.id} ${biggest.name} at ${(biggest.bytes / 1024).toFixed(1)}KB (the site's cap is 200KB)`);
