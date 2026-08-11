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
//   data/overrides.json  set and product tags, which the tag matcher defers to
//   data/manual.json     hit card, rarity, Hall of Fame, affiliate link, copy
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
  "ex premium collection": "ex-box",
  "other": null,
};

// The sheet offers set NAMES because nobody wants to pick "sv3pt5" from a
// dropdown; the site tags by id. Built from sets.json so a new set needs no
// edit here.
const setIdByName = new Map();
try {
  const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
  for (const s of sets) setIdByName.set(s.name.toLowerCase(), s.id);
} catch {
  console.warn("No public/data/sets.json, so the Set column will be skipped.");
}

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
  set: col("Set"), set2: col("Set 2"), set3: col("Set 3"), set4: col("Set 4"),
  moreSets: col("More Sets"), box: col("Box / Series"),
  opening: col("Opening Type"), hasHit: col("Has Hit"),
  hitCard: col("Hit Card"), rarity: col("Hit Rarity"),
  // "Greatest Hit" was the old header; "Hall of Fame" is the current one.
  greatest: col("Hall of Fame") >= 0 ? col("Hall of Fame") : col("Greatest Hit"),
  hofRank: col("HoF Rank"),
  addTo: col("Playlist To Add"), affiliate: col("Affiliate Link"),
  siteTitle: col("Site Title"), blurb: col("Short Description"),
  feature: col("Feature"), hide: col("Hide"), notes: col("Notes"),
};

const get = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
const isYes = (s) => /^y(es)?$/i.test(s);

let overrides = {};
try { overrides = JSON.parse(await readFile(join(ROOT, "data/overrides.json"), "utf8")); } catch {}
const manual = {};
const unknownOpening = new Set();
let counted = { set: 0, multiSet: 0, opening: 0, hit: 0, card: 0, greatest: 0, affiliate: 0, copy: 0, hidden: 0 };
const unknownSet = new Set();

for (const r of rows.slice(1)) {
  const id = get(r, iId);
  if (!id) continue;

  // The single biggest lever: a video with no set cannot show its wrapper,
  // cannot be filtered, and cannot reach the Hall of Fame.
  //
  // Three columns, not one, because an ex Box or a premium collection holds
  // packs from several sets and one video is often one of those packs. They
  // merge into an ordered list: the first is what the video is really about
  // and picks the wrapper, the rest still match the set filters. Writing a
  // single-element array here, as this did before, silently dropped the extra
  // sets off any video that already had them.
  const setIds = [];
  // Four dropdowns cover the real cases, and More Sets is a comma-separated
  // escape hatch for the rare box that spans more than four.
  const cells = [idx.set, idx.set2, idx.set3, idx.set4].map((i) => get(r, i));
  cells.push(...get(r, idx.moreSets).split(",").map((x) => x.trim()));
  for (const cell of cells) {
    if (!cell || /^(multiple|not a set|none)$/i.test(cell)) continue;
    const setId = setIdByName.get(cell.toLowerCase());
    if (!setId) unknownSet.add(cell);
    else if (!setIds.includes(setId)) setIds.push(setId);
  }
  if (setIds.length) {
    overrides[id] = { ...(overrides[id] || {}), sets: setIds };
    counted.set++;
    if (setIds.length > 1) counted.multiSet++;
  }

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
  const rank = get(r, idx.hofRank);
  if (rank && !Number.isNaN(Number(rank))) m.hofRank = Number(rank);
  const siteTitle = get(r, idx.siteTitle);
  if (siteTitle) { m.siteTitle = siteTitle; counted.copy++; }
  const blurb = get(r, idx.blurb);
  if (blurb) { m.blurb = blurb; counted.copy++; }
  if (isYes(get(r, idx.feature))) m.feature = true;
  if (isYes(get(r, idx.hide))) { m.hide = true; counted.hidden++; }
  const aff = get(r, idx.affiliate);
  if (aff) { m.affiliate = aff; counted.affiliate++; }
  const addTo = get(r, idx.addTo);
  if (addTo && !/^none/i.test(addTo)) m.playlistToAdd = addTo;
  const box = get(r, idx.box);
  if (box) m.box = box;
  const notes = get(r, idx.notes);
  if (notes) m.notes = notes;

  if (Object.keys(m).length) manual[id] = m;
}

await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data/overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
await writeFile(join(ROOT, "data/manual.json"), JSON.stringify(manual, null, 2) + "\n");

console.log(`
Read ${rows.length - 1} rows from ${csvPath}

  set tags           ${counted.set}${counted.multiSet ? `  (${counted.multiSet} with more than one set)` : ""}
  opening types      ${counted.opening}
  has-hit answered   ${counted.hit}
  hit cards named    ${counted.card}
  hall of fame       ${counted.greatest}
  affiliate links    ${counted.affiliate}
  custom copy        ${counted.copy}
  hidden             ${counted.hidden}

Wrote data/overrides.json  (${Object.keys(overrides).length} videos)
Wrote data/manual.json     (${Object.keys(manual).length} videos)
`);

if (unknownSet.size) {
  console.log("Set values I did not recognise (left untagged):");
  for (const u of unknownSet) console.log("  " + u);
  console.log("Pick from the dropdown on the Set column rather than typing.\n");
}

if (unknownOpening.size) {
  console.log("Opening Type values I did not recognise (left untagged):");
  for (const u of unknownOpening) console.log("  " + u);
  console.log("Add them to PRODUCT_IDS in this script, or pick from the Lists tab.\n");
}

console.log(`Now run:
  node --env-file=.env scripts/sync-youtube.mjs
  node scripts/build-pages.mjs
`);
