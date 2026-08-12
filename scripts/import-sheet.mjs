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

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
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
// The non-English guides, under the same labels build-sheet.py puts in the
// dropdown ("Abyss Eye (JP)"). Without these the 21 imported rips came back as
// unknownSet and were silently dropped. Both the label and the bare English
// name are accepted, since one is easy to type and the other is what is listed.
const LANG_TAG = { ja: "JP", ko: "KR", "zh-cn": "CN", "zh-tw": "CN" };
try {
  const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
  for (const [id, g] of Object.entries(ig)) {
    const tag = LANG_TAG[g.lang] || "??";
    setIdByName.set(`${g.english} (${tag})`.toLowerCase(), id);
    if (!setIdByName.has(g.english.toLowerCase())) setIdByName.set(g.english.toLowerCase(), id);
  }
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

const rows = parseCsv(await readFile(csvPath, "utf8"));
if (!rows.length) { console.error("Empty CSV."); process.exit(1); }

const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name.toLowerCase());

// ------------------------------------------------------------- My Hits tab
//
// The workbook has had a My Hits tab since it was asked for, and nothing read
// it. Filling it in would have produced exactly nothing on the site, which is
// the worst possible outcome for a hundred rows of manual work.
//
// Excel exports one CSV per tab, so rather than another flag the tab is
// recognised by its own headers. Point this script at either file.
if (col("Card") !== -1 && col("Raw NM USD") !== -1) {
  const hi = {
    video: col("Video ID"), card: col("Card"), set: col("Set"),
    number: col("Number"), rarity: col("Rarity"),
    raw: col("Raw NM USD"), psa10: col("PSA 10 USD"),
    hof: col("Hall of Fame"), notes: col("Notes"),
  };
  const cell = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
  const num = (v) => {
    const n = Number(String(v).replace(/[$,]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const yes = (v) => /^(y|yes|true|1|x)$/i.test(v.trim());

  const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
  const knownVideo = new Map(videos.map((v) => [v.id, v]));

  // Every card we know, so Number, Rarity and Raw can be looked up rather than
  // typed. Keyed by set + lowercased name; a name that appears twice in a set
  // (a card and its secret-rare reprint) keeps the DEARER one, which is the one
  // somebody logging a hit means.
  const byCard = new Map();
  const setIdOf = new Map();
  try {
    const dir = join(ROOT, "public/data/cards");
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
      setIdOf.set(doc.name.toLowerCase(), doc.set);
      for (const c of doc.cards) {
        const k = `${doc.set}|${(c.name || "").toLowerCase()}`;
        const prev = byCard.get(k);
        if (!prev || (c.price || 0) > (prev.price || 0)) byCard.set(k, c);
      }
    }
  } catch (e) {
    console.warn(
      `Could not read public/data/cards: ${e.message}\n` +
        `  Number, Rarity and Raw NM will not be filled in. Run: node scripts/sync-cards.mjs`
    );
  }

  // The imported sets keep their checklists somewhere else, and 21 rips are
  // from them, so without this every hit out of a Japanese or Korean pack came
  // back blank. They carry no prices by design, so only Number and Rarity fill
  // in; Raw NM stays for a human. Both the English name and the native one are
  // accepted, because either is a reasonable thing to type off the card.
  try {
    const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
    for (const [id, g] of Object.entries(ig)) {
      setIdOf.set((g.english || "").toLowerCase(), id);
      for (const c of g.cards || []) {
        for (const nm of [c.en, c.native]) {
          if (!nm) continue;
          const k = `${id}|${nm.toLowerCase()}`;
          const prev = byCard.get(k);
          // These carry no price, so "the dearer one" has to be inferred. A set
          // numbers its secret rares past the printed total, so the higher
          // number is the better card, and the better card is the one somebody
          // is writing down as a hit. Picking the first match gave Mega Darkrai
          // ex as the 046 Double rare rather than the 114 secret.
          const better = !prev || (Number(c.localId) || 0) > (Number(prev.n) || 0);
          if (better) byCard.set(k, { n: c.localId, rarity: c.rarity, price: null });
        }
      }
    }
  } catch {
    /* run: node scripts/sync-intl-guides.mjs */
  }
  if (!byCard.size) {
    console.warn("No card data loaded, so nothing can be looked up.");
  }

  const hits = [];
  const problems = [];
  let looked = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const card = cell(r, hi.card);
    const vid = cell(r, hi.video);
    if (!card && !vid) continue;                     // blank filler row
    if (!card) { problems.push(`row ${i + 1}: a Video ID with no Card`); continue; }
    if (vid && !knownVideo.has(vid)) problems.push(`row ${i + 1}: Video ID "${vid}" is not in the catalogue`);

    const setLabel = cell(r, hi.set);
    const setId = setIdByName.get(setLabel.toLowerCase()) || setIdOf.get(setLabel.toLowerCase()) || null;
    if (setLabel && !setId) problems.push(`row ${i + 1}: set "${setLabel}" not recognised`);

    const found = setId ? byCard.get(`${setId}|${card.toLowerCase()}`) : null;
    if (found) looked++;
    // A name that matches nothing is nearly always a typo, and silently writing
    // nulls for it is how a hit ends up on the site with no number and no
    // price and nobody notices.
    else if (setId && byCard.size && !cell(r, hi.number)) {
      problems.push(`row ${i + 1}: no card called "${card}" in ${setLabel || setId}. Check the spelling.`);
    }

    hits.push({
      video: vid || null,
      card,
      set: setId,
      // Typed value wins; otherwise the card data fills it in.
      number: cell(r, hi.number) || found?.n || null,
      rarity: cell(r, hi.rarity) || found?.rarity || null,
      rawNm: num(cell(r, hi.raw)) ?? found?.price ?? null,
      psa10: num(cell(r, hi.psa10)),
      hallOfFame: yes(cell(r, hi.hof)),
      notes: cell(r, hi.notes) || null,
    });
  }

  hits.sort((a, b) => (b.psa10 ?? b.rawNm ?? 0) - (a.psa10 ?? a.rawNm ?? 0));
  await writeFile(
    join(ROOT, "data/hits.json"),
    JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: "My Hits tab", hits }, null, 2) + "\n"
  );

  console.log(`Read ${rows.length - 1} row(s) from ${csvPath}
Wrote data/hits.json
  ${hits.length} hit(s), ${hits.filter((h) => h.hallOfFame).length} flagged Hall of Fame
  ${looked} had Number, Rarity and Raw NM filled in from the card data
  ${hits.filter((h) => h.psa10).length} carry a PSA 10 price`);
  if (problems.length) {
    console.log(`\n${problems.length} thing(s) to look at:`);
    for (const p of problems.slice(0, 12)) console.log("  " + p);
  }
  process.exit(0);
}
// Accept any of several historical names for the same column.
const firstCol = (...names) => {
  for (const n of names) {
    const i = col(n);
    if (i >= 0) return i;
  }
  return -1;
};
const iId = col("Video ID");
if (iId === -1) {
  console.error(`No "Video ID" column found. Header was:\n  ${rows[0].join(" | ")}`);
  console.error("Make sure you exported the Video Log tab, not Read Me or Lists.");
  process.exit(1);
}
const idx = {
  set: col("Set"), set2: col("Set 2"), set3: col("Set 3"), set4: col("Set 4"),
  moreSets: col("More Sets"), box: col("Box / Series"),
  opening: col("Opening Type"), packs: col("Packs Opened"), hasHit: col("Has Hit"),
  hitCard: col("Hit Card"), rarity: col("Hit Rarity"),
  // The column has been called three things across three revisions of the
  // sheet. indexOf is exact, so a stale name here silently returns -1, every
  // row reads as "no", and the whole feature is inert with no error.
  greatest: firstCol("Greatest Hits", "Hall of Fame", "Greatest Hit"),
  hofRank: firstCol("Greatest Hits Rank", "HoF Rank"),
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
  // Split every set cell on commas, not just More Sets. Four columns is how a
  // spreadsheet file expresses "more than one", because .xlsx validation is
  // single-select. Google Sheets can turn a column into a native multi-select
  // chip dropdown after import, and that exports as "A, B" in one cell, so
  // both shapes have to work.
  const cells = [idx.set, idx.set2, idx.set3, idx.set4, idx.moreSets]
    .flatMap((i) => get(r, i).split(",").map((x) => x.trim()));
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
  // The denominator for the luck page. Only a positive whole number is worth
  // keeping: a blank, a zero or a stray word would silently divide the rate by
  // the wrong thing, which is worse than having no rate at all.
  const packs = Number(String(get(r, idx.packs) || "").replace(/[^0-9]/g, ""));
  if (Number.isFinite(packs) && packs > 0) { m.packs = packs; counted.packs = (counted.packs || 0) + 1; }

  const hasHit = get(r, idx.hasHit);
  if (hasHit) { m.hasHit = isYes(hasHit); counted.hit++; }
  const card = get(r, idx.hitCard);
  if (card) { m.hitCard = card; counted.card++; }
  const rarity = get(r, idx.rarity);
  // The dropdown reads "Special Illustration Rare (2 gold stars)"; the
  // parenthetical is a hint for whoever is filling the sheet in, not something
  // to print on a public page.
  if (rarity && !/^no hit$/i.test(rarity)) m.hitRarity = rarity.replace(/\s*\([^)]*\)\s*$/, "").trim();
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
