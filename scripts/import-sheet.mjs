#!/usr/bin/env node
// Turn the filled-in video log into site data.
//
//   node scripts/import-sheet.mjs ~/Downloads/Video\ Log.csv
//
// Export from Google Sheets with File > Download > Comma-separated values,
// making sure the "Video Log" tab is the active one. Safe to run repeatedly and
// safe to run half-finished: blank cells are simply skipped, so you can fill in
// twenty rows, import, see them on the site, and carry on.
//
// Writes two files:
//   data/overrides.json  product tags, which the tag matcher always defers to
//   data/manual.json     hit card, rarity, greatest-hit flag, affiliate link
//
// Then re-run sync-youtube.mjs and build-pages.mjs to see it on the site.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = process.argv[2];
if (!csvPath) {
  console.error(`
Usage: node scripts/import-sheet.mjs <path-to-csv>

Export the Video Log tab from Google Sheets as CSV first:
  File > Download > Comma-separated values (.csv)
`);
  process.exit(1);
}

// --- CSV parsing: quoted fields, embedded commas, doubled quotes, CRLF ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// The sheet's Opening Type values map back onto the site's product tag ids.
const PRODUCT_IDS = {
  "single booster pack": "single-pack",
  "booster bundle": "bundle",
  "booster box": "booster-box",
  "etb (elite trainer box)": "etb",
  "spc (super premium collection)": "spc",
  "upc (ultra premium collection)": "upc",
  "poke ball tin": "poke-ball-tin",
  "tin": "tin",
  "ex premium collection": "ex-premium",
  "ex special collection": "ex-special",
  "japanese booster pack": "japanese-pack",
  "korean booster pack": "korean-pack",
  "chinese booster pack": "chinese-pack",
  "blister": "blister",
  "collection box": "collection-box",
  "other": null,
};

const rows = parseCsv(await readFile(csvPath, "utf8"));
if (!rows.length) { console.error("Empty CSV."); process.exit(1); }

const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name.toLowerCase());
const iId = col("Video ID");
if (iId === -1) {
  console.error(`No "Video ID" column found. Header was:\n  ${rows[0].join(" | ")}`);
  console.error("Make sure you exported the Video Log tab, not Read Me or Lists.");
  process.exit(1);
}
const idx = {
  set: col("Set"), opening: col("Opening Type"), hasHit: col("Has Hit"),
  hitCard: col("Hit Card"), rarity: col("Hit Rarity"), greatest: col("Greatest Hit"),
  addTo: col("Playlist To Add"), affiliate: col("Affiliate Link"), notes: col("Notes"),
};

const get = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
const isYes = (s) => /^y(es)?$/i.test(s);

let overrides = {};
try { overrides = JSON.parse(await readFile(join(ROOT, "data/overrides.json"), "utf8")); } catch {}
const manual = {};
const unknownOpening = new Set();
let counted = { opening: 0, hit: 0, card: 0, greatest: 0, affiliate: 0 };

for (const r of rows.slice(1)) {
  const id = get(r, iId);
  if (!id) continue;

  const opening = get(r, idx.opening);
  if (opening) {
    const key = opening.toLowerCase();
    if (!(key in PRODUCT_IDS)) unknownOpening.add(opening);
    else if (PRODUCT_IDS[key]) {
      overrides[id] = { ...(overrides[id] || {}), products: [PRODUCT_IDS[key]] };
      counted.opening++;
    }
  }

  const m = {};
  if (opening) m.openingType = opening;
  const hasHit = get(r, idx.hasHit);
  if (hasHit) { m.hasHit = isYes(hasHit); counted.hit++; }
  const card = get(r, idx.hitCard);
  if (card) { m.hitCard = card; counted.card++; }
  const rarity = get(r, idx.rarity);
  if (rarity && !/^no hit$/i.test(rarity)) m.hitRarity = rarity;
  if (isYes(get(r, idx.greatest))) { m.greatest = true; counted.greatest++; }
  const aff = get(r, idx.affiliate);
  if (aff) { m.affiliate = aff; counted.affiliate++; }
  const addTo = get(r, idx.addTo);
  if (addTo && !/^none/i.test(addTo)) m.playlistToAdd = addTo;
  const notes = get(r, idx.notes);
  if (notes) m.notes = notes;

  if (Object.keys(m).length) manual[id] = m;
}

await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data/overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
await writeFile(join(ROOT, "data/manual.json"), JSON.stringify(manual, null, 2) + "\n");

console.log(`
Read ${rows.length - 1} rows from ${csvPath}

  opening types      ${counted.opening}
  has-hit answered   ${counted.hit}
  hit cards named    ${counted.card}
  greatest hits      ${counted.greatest}
  affiliate links    ${counted.affiliate}

Wrote data/overrides.json  (${Object.keys(overrides).length} videos)
Wrote data/manual.json     (${Object.keys(manual).length} videos)
`);

if (unknownOpening.size) {
  console.log("Opening Type values I did not recognise (left untagged):");
  for (const u of unknownOpening) console.log("  " + u);
  console.log("Add them to PRODUCT_IDS in this script, or pick from the Lists tab.\n");
}

console.log(`Now run:
  node --env-file=.env scripts/sync-youtube.mjs
  node scripts/build-pages.mjs
`);
