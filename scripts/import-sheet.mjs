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
import { deriveTags } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let csvPath = process.argv[2];

// TAKE THE .xlsx DIRECTLY. Asking for a CSV meant exporting from Google Sheets
// with the right tab active, which is a step to forget and a thing to get
// wrong. It also threw away the fix for the two ways Sheets mangles a
// round trip: whole numbers coming back as "9.0", and the computed Packs
// Opened column exporting as a formula string rather than its value.
// sheet-to-csv.py handles both, so hand this script either format.
if (csvPath && /\.xlsx$/i.test(csvPath)) {
  const { execFileSync } = await import("node:child_process");
  const tmp = join(ROOT, ".sheet-import.csv");
  const csv = execFileSync("python3", [join(ROOT, "scripts/sheet-to-csv.py"), csvPath, "Video Log"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  await writeFile(tmp, csv);
  console.log(`Read the Video Log tab out of ${csvPath.split("/").pop()}`);
  csvPath = tmp;
}
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
  // "ex Box" IS A SYNONYM NOW, NOT ITS OWN TAG. shared/taxonomy.mjs folded the
  // ex-box id into ex-premium, and this line kept mapping the dropdown option
  // onto the id that no longer exists: labelFor() renders an unknown id as the
  // raw string, so picking "ex Box" would have captioned the filter rail and
  // /luck.html "ex-box" and pointed at an /openings/ page that is not built.
  // The option stays in the dropdown because it is what the titles say.
  "ex box": "ex-premium",
  "japanese booster pack": "japanese-pack",
  "korean booster pack": "korean-pack",
  "chinese booster pack": "chinese-pack",
  "blister": "blister",
  "collection box": "collection-box",
  "knock out collection": "knock-out",
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
// EVERY ENGLISH SET, not only the ones with a guide page. The dropdown now
// offers all 174, because a tin can hold a pack from a set we never wrote a
// guide for and Tim needs somewhere to record it. Only 28 of them carry a
// `slug`, since a slug is assigned when a guide is built, so the rest are keyed
// on a slugified name. Verified collision-free against the guide ids and the
// international ids at import time rather than assumed.
try {
  const { sets: expansions } = JSON.parse(
    await readFile(join(ROOT, "public/data/expansions.json"), "utf8")
  );
  for (const e of expansions || []) {
    if (!e?.name) continue;
    const key = e.name.toLowerCase();
    if (setIdByName.has(key)) continue;            // a guide already owns this name
    const id = e.slug || e.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (id) setIdByName.set(key, id);
  }
} catch {
  /* expansions.json is optional; without it the dropdown is the guided sets */
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
  // Every set id we can name, so an id typed (or handed back by the workbook)
  // into the Set column resolves as well as a display name does.
  const knownSetId = new Set([...setIdByName.values(), ...setIdOf.values()].map((s) => String(s).toLowerCase()));
  // id -> display name, the reverse of the two lookups above. First writer wins,
  // so the proper set name beats an alias.
  const nameOfSet = new Map();
  for (const [label, id] of setIdByName) if (!nameOfSet.has(id)) nameOfSet.set(id, label.replace(/\b\w/g, (c) => c.toUpperCase()));
  try {
    const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
    for (const s of sets) nameOfSet.set(s.id, s.name);
  } catch { /* warned about above */ }
  try {
    const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
    for (const [id, g] of Object.entries(ig)) nameOfSet.set(id, `${g.english} (${LANG_TAG[g.lang] || "??"})`);
  } catch { /* run: node scripts/sync-intl-guides.mjs */ }

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
    // ACCEPT A SET ID AS WELL AS A SET NAME, because the workbook hands one back.
    // build-sheet.py prefills this column from data/hits.json, where `set` is an
    // id ("phantasmal-flames"), and only NAMES were understood here. So the
    // second trip through the sheet turned every hit's set to null: 22 of 22 in
    // a two-cycle test, which drops the set caption off every hit card, loses
    // the hits section on every set page, and sends every card down the promo
    // resolver where it matches by name alone.
    const setId =
      setIdByName.get(setLabel.toLowerCase()) ||
      setIdOf.get(setLabel.toLowerCase()) ||
      (knownSetId.has(setLabel.toLowerCase()) ? setLabel.toLowerCase() : null);
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
      // setName IS WRITTEN, and it used not to be. build-pages.mjs prints
      // `h.setName` under every hit card and build-hall.mjs ranks on it, and a
      // single import wiped it off all 17 logged hits because nothing here ever
      // put it back. It also has to be here for the sheet to round trip: the
      // workbook prefills its Set column from this field.
      setName: setId ? nameOfSet.get(setId) || null : null,
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

  // WRITE THE SHAPE THE FIVE READERS EXPECT, which is keyed by video id under
  // `videos`. This used to write a flat `hits` array, and nothing in scripts/
  // has ever produced that shape, so running this import would have emptied the
  // Hall of Fame, the hit band on all 313 rip pages and the hits section on
  // every set page in one go. Silently, because an empty object is not an error.
  //
  // The existing file is merged into rather than replaced, so importing a
  // partly filled My Hits tab cannot delete cards that are already logged.
  let existing = {};
  try {
    existing = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8"));
  } catch { /* first run */ }
  // MERGE ONTO THE CARD, DO NOT REPLACE IT. The tab has nine columns and a hit
  // record has more fields than that, so a wholesale replace deleted everything
  // the sheet has no column for. Measured over two round trips: `setName` went
  // from 17 records to 0 on the FIRST import, and the two Black Star Promos lost
  // `promo`, `price`, `priceSource`, `priceAsOf`, `priceUrl`, `img` and
  // `forSet` in the same pass. Those seven fields are the entire reason those
  // two cards resolve at all; without `promo` and `forSet` they either match a
  // set card of the same name or appear on no page. The readme in hits.json
  // spells out why each one is hand-kept, which is exactly why an importer must
  // not be the thing that throws them away.
  //
  // A BLANK CELL MEANS "NOT ANSWERED", NOT "DELETE". Same rule the Video Log
  // half of this script has always applied. Only Hall of Fame is taken as
  // stated either way, because it is a Yes/No column: leaving it blank IS "no".
  const KEEP_IF_BLANK = ["number", "rarity", "rawNm", "psa10", "notes", "set", "setName"];
  const byVideo = { ...(existing.videos || {}) };
  for (const h of hits) {
    if (!h.video) continue;
    const { video, ...card } = h;
    const prev = (byVideo[video] || []).find((c) => c.card === card.card) || {};
    const merged = { ...prev };
    for (const [k, v] of Object.entries(card)) {
      if (v == null && KEEP_IF_BLANK.includes(k)) continue;
      merged[k] = v;
    }
    byVideo[video] = (byVideo[video] || []).filter((c) => c.card !== card.card).concat(merged);
  }
  await writeFile(
    join(ROOT, "data/hits.json"),
    JSON.stringify(
      {
        ...existing,
        source: "My Hits tab",
        checked: new Date().toISOString().slice(0, 10),
        videos: byVideo,
      },
      null,
      2
    ) + "\n"
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
// The matcher needs the same two inputs it gets at sync time to reproduce its
// guess, so the sheet can be compared against it rather than trusted blindly.
const descriptions = JSON.parse(
  await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"),
);
/** Order-insensitive tag comparison: the sheet's four Set columns need not
 *  arrive in the matcher's order to mean the same thing. */
const sameTags = (a, b) =>
  JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
const iTitle = col("Title");
const iId = col("Video ID");
if (iId === -1) {
  console.error(`No "Video ID" column found. Header was:\n  ${rows[0].join(" | ")}`);
  console.error("Make sure you exported the Video Log tab, not Read Me or Lists.");
  process.exit(1);
}
const idx = {
  // SET 5 WAS NEVER READ. build-sheet.py writes five Set/Packs pairs, gives all
  // five the same dropdown, and the Read Me tells you to "put the rest in Set 2
  // to Set 5" -- and this list stopped at Set 4, so the fifth set was dropped
  // with no message while its Packs 5 count still went into the total. A test
  // row with five sets and 6+4+4+2+2 packs imported as four sets and 18 packs.
  // `More Sets` is the free-text column those five pairs replaced; it is kept so
  // an older export still imports.
  set: col("Set"), set2: col("Set 2"), set3: col("Set 3"), set4: col("Set 4"),
  set5: col("Set 5"),
  moreSets: col("More Sets"), box: col("Box / Series"),
  opening: col("Opening Type"), packs: col("Packs Opened"), hasHit: col("Has Hit"),
  // WHICH ONE OF THESE, AND WHICH PACK OUT OF IT. Both new, both optional, and
  // both go through firstCol for the reason the two comments below give: col()
  // is an exact match, and every column in this file that was ever renamed
  // returned -1 and took its whole feature down with no error. An export made
  // before these columns existed has neither header, gets -1 from both, and
  // imports exactly as it always did.
  boxNo: firstCol("Box #", "Box Number", "Product #"),
  packNo: firstCol("Pack #", "Pack Number", "Pack In Box"),
  // THE PER-SET PACK CELLS ARE THE SOURCE, NOT THE TOTAL COLUMN. See below.
  packCells: ["Packs", "Packs 2", "Packs 3", "Packs 4", "Packs 5"].map(col).filter((i) => i >= 0),
  // The header has been "Hit Card", "Hit Cards" and "Hit Card or Hit Cards"
  // across revisions, and col() is an exact match, so a stale name here reads as
  // an empty column and the whole feature goes quiet with no error.
  hitCard: firstCol("Hit Card", "Hit Cards", "Hit Card or Hit Cards"),
  rarity: col("Hit Rarity"),
  // The column has been called three things across three revisions of the
  // sheet. indexOf is exact, so a stale name here silently returns -1, every
  // row reads as "no", and the whole feature is inert with no error.
  greatest: firstCol("Greatest Hits", "Hall of Fame", "Greatest Hit"),
  hofRank: firstCol("Greatest Hits Rank", "HoF Rank"),
  addTo: col("Playlist To Add"), affiliate: col("Affiliate Link"),
  siteTitle: col("Site Title"), blurb: col("Short Description"),
  feature: col("Feature"), hide: col("Hide"), notes: col("Notes"),
};

// NON-BREAKING SPACES ARE NORMALISED HERE. Google Sheets emits U+00A0 all over
// the place -- pasted text, autocomplete, anything that came through a browser
// -- and it is invisible in every editor. "Pitch Black" and "ETB (Elite Trainer
// Box)" both fell through the set and product lookups in testing, and the only
// symptom was a line in the "did not recognise" list naming a value that looks
// exactly right. Trim alone does not help: the space is in the middle.
const get = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).replace(/ /g, " ").trim() : "");
const isYes = (s) => /^y(es)?$/i.test(s);

let overrides = {};
try { overrides = JSON.parse(await readFile(join(ROOT, "data/overrides.json"), "utf8")); } catch {}
// THE FILE CARRIES ITS OWN WARNING, because JSON cannot carry a comment and the
// 244 `packs` values in it are the most dangerous data in this repo: they are
// PREFILL, not answers, and the only thing keeping them off the site is nine
// lines near the end of sync-youtube.mjs. Somebody opening data/manual.json cold
// sees 244 plausible integers and no sign of any of that. `_WARNING` is a key no
// video id can collide with and every reader here looks up by id, so it is inert
// to the pipeline and loud to a person. Written FIRST so it is the top of the
// file, and written by the importer as well as sitting in the file, so a
// re-import does not quietly delete it.
//
// DELETE IT IN THE SAME EDIT THAT DELETES THE SUPPRESSION BLOCK, once Tim's
// filled sheet has landed and every Packs cell is his own answer.
const MANUAL_WARNING = [
  "READ THIS BEFORE TRUSTING ANY `packs` VALUE IN THIS FILE.",
  "",
  "The `packs` numbers here are NOT answers. build-sheet.py prefilled the sheet's",
  "Packs column from PRODUCT_TO_PACKS, which is how many packs a product CONTAINS,",
  "and the column asks how many packs the VIDEO opened. Those are different",
  "questions and the format is one pack per Short. The prefill was blue text, and",
  "colour does not survive export to CSV, so every suggestion came back through",
  "import-sheet.mjs indistinguishable from something Tim typed.",
  "",
  "It has already been published once: 21 Chaos Rising ETB rips each carrying 9,",
  "summing to 189 where 21 packs were opened, and /luck.html printed",
  "'232 packs counted' off that total.",
  "",
  "Tim, 18 August 2026: 'make sure you aren't tagging any videos with what type of",
  "product it is and what packs are in the video until you get my execl sheet thats",
  "filled out with all that exact data'.",
  "",
  "So NOTHING here reaches the site unless the sheet states a Pack # for that video.",
  "The suppression is at the end of scripts/sync-youtube.mjs, under the banner",
  "'NO PACK COUNT IS PUBLISHED UNTIL TIM'S SHEET SAYS ONE', and check-build.py",
  "fails the build if a published `packs` equals its product's capacity on a video",
  "that also states a pack number, which is the exact signature of this prefill.",
  "",
  "DO NOT DELETE THE VALUES. Tim's filled sheet overwrites them. Do not 'restore'",
  "them to the site either: reverting one line in sync-youtube.mjs republishes all",
  "244 and nothing about the file would look wrong.",
];

const manual = { _WARNING: MANUAL_WARNING };
const unknownOpening = new Set();
let counted = { set: 0, multiSet: 0, opening: 0, hit: 0, card: 0, greatest: 0, affiliate: 0, copy: 0, hidden: 0 };
const unknownSet = new Set();
// What the site currently believes, used only to spot the stale-prefill trap
// described where the overrides are written.
let live = {};
try {
  const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
  live = Object.fromEntries(videos.map((v) => [v.id, v]));
} catch { /* no catalogue yet */ }
const newOverride = [];
// Things that used to happen in silence. Each one is a row whose meaning
// changed or vanished between the cell and the JSON, and every one of them was
// found by round-tripping a filled-in sheet rather than by reading the code.
const quiet = [];
const seenRow = new Map();

for (const [n, r] of rows.slice(1).entries()) {
  const rowNo = n + 2;                 // the row number as the spreadsheet shows it
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
  const cells = [idx.set, idx.set2, idx.set3, idx.set4, idx.set5, idx.moreSets]
    .flatMap((i) => get(r, i).split(",").map((x) => x.trim()));
  // "NOT A SET (SEALED/OTHER)" IS AN ANSWER AND IT WAS BEING FILED AS A TYPO.
  //
  // Both sentinels in the Set dropdown are anchored phrases -- "Multiple sets"
  // and "Not a set (sealed/other)" -- and this test was anchored at both ends,
  // so neither matched, both landed in the unrecognised list next to real
  // spelling mistakes, and the video kept whatever set the title matcher had
  // guessed. There was no way to tell the site "there is no set here", which is
  // the one thing a person can say and a title matcher cannot.
  const notASet = cells.some((c) => /^not a set\b/i.test(c));
  const sentinel = (c) => /^(multiple|not a set|none)\b/i.test(c);
  for (const cell of cells) {
    if (!cell || sentinel(cell)) continue;
    const setId = setIdByName.get(cell.toLowerCase());
    if (!setId) unknownSet.add(cell);
    else if (!setIds.includes(setId)) setIds.push(setId);
  }
  // ONLY RECORD AN OVERRIDE WHERE THE HUMAN DISAGREED WITH THE MATCHER.
  //
  // The Set column arrives PREFILLED with the matcher's own guess, so importing
  // every filled cell writes back hundreds of overrides that nobody typed. That
  // is not merely redundant, it is corrosive: an override always beats the
  // matcher, so it freezes whatever the matcher believed on the day the sheet
  // was generated and no later fix to shared/taxonomy.mjs can ever reach those
  // videos again.
  //
  // It happened. Today's taxonomy fix corrected six videos (four First Partner
  // boxes wrongly tagged 151, and two carrying a phantom Scarlet & Violet), and
  // a sheet generated before that fix still carried the old guesses. Importing
  // it wholesale re-tagged all six as if Tim had confirmed them by hand. Of 272
  // set cells in that import, 270 were byte-identical to the machine's own
  // prefill and exactly 2 were real edits.
  //
  // So the guess is recomputed here and an override is written only where the
  // sheet differs. The sheet corrects the matcher; it no longer overrules it by
  // simply agreeing with an older version of it.
  // AND AN OVERRIDE HAS TO BE RETIRABLE, which is the half that was missing.
  //
  // Writing only on disagreement stops an override being CREATED by accident.
  // Nothing removed one, so the reverse move was impossible: correct a video to
  // the wrong set, import, notice, put the right answer back, import again --
  // and because the right answer now agrees with the matcher, no override is
  // written and the OLD one is still there, still winning. Proven end to end: a
  // video whose sheet cell reads "Pitch Black" published as White Flare, with
  // nothing anywhere reporting a disagreement.
  //
  // So agreement now DELETES the field. The sheet is authoritative in both
  // directions, and "the matcher is right about this one" becomes a thing a
  // person can say. Only a field the sheet actually answered is touched: a blank
  // cell still means "not answered" and leaves any override alone.
  // EVERY NEW OVERRIDE IS LISTED, because there is no reliable way to tell a
  // correction from a stale prefill and the difference matters enormously.
  //
  // A cell that disagrees with today's matcher is EITHER a person correcting it
  // or a workbook generated before a tag rule was fixed, still carrying the old
  // guess. The second one pins the old answer permanently. It is happening
  // right now: the workbook on disk was built before today's negation fix and
  // still reads "ETB (Elite Trainer Box)" on seven single-pack rips whose own
  // descriptions say "No ETB", so importing it re-pins all seven.
  //
  // Comparing against what the site currently shows was tried and is not enough:
  // once videos.json has been retagged, the sheet disagrees with BOTH and the
  // test goes quiet exactly when it is needed. So nothing is inferred. Every new
  // override is printed with the matcher's answer beside it, which on a normal
  // import is a handful of lines and is the one list worth reading.
  const note = (field, sheet, matcher) => {
    if (overrides[id] && sameTags(overrides[id][field], sheet)) return;   // already recorded
    newOverride.push(`${id}  ${field}: sheet says ${JSON.stringify(sheet)}, the tag rules say ${JSON.stringify(matcher)}`);
  };
  const retire = (field) => {
    if (!overrides[id] || !(field in overrides[id])) return false;
    delete overrides[id][field];
    if (!Object.keys(overrides[id]).length) delete overrides[id];
    counted.retired = (counted.retired || 0) + 1;
    return true;
  };
  const auto = deriveTags({ title: get(r, iTitle), description: descriptions[id] || "" });
  // "Not a set" is a stated answer of NO sets, so it needs a real override:
  // leaving it blank would just hand the video back to the matcher's guess,
  // which is the thing being contradicted.
  // AND IT IS STILL AN ANSWER WHEN THE MATCHER HAPPENS TO AGREE, which is the
  // half this got wrong. The `else retire("sets")` that used to sit here fired
  // whenever the matcher ALSO found no set, which is precisely the case for the
  // videos most likely to be answered this way: a Trick or Trade bundle, a
  // Victini Illustration Collection, a Mega Heroes mini tin. Nothing in those
  // titles names an expansion, so the matcher says [] and the human says
  // "Not a set", the two agree, the override was retired, and the answer was
  // gone. Proven on those exact three videos before this line changed: all
  // three answered, zero overrides written, and the summary line that counts
  // them did not even print because the counter stayed at 0.
  //
  // Retiring is right for a normal set tag, where the override only exists to
  // record a DISAGREEMENT and the matcher can be trusted to reproduce the
  // answer next time. It is wrong here, because the override is the only place
  // the answer lives: build-sheet.py reads `overrides[id].sets == []` and
  // nothing else to decide whether to hand the cell back reading "Not a set
  // (sealed/other)" or blank, and blank is the sheet's word for "nobody has
  // said yet". So an answered question came back unanswered every single time.
  //
  // Writing it unconditionally does not re-create the stale-prefill problem the
  // comment above is about. That problem is an override freezing a GUESS, so a
  // later fix to the tag rules can never reach the video. `[]` is not a guess.
  // It is a person saying there is no expansion here, which is the one thing a
  // title matcher can never work out for itself, and it stays retirable: pick a
  // real set or clear the cell and re-import, and the branches below take over.
  if (notASet && !setIds.length) {
    // Only worth the new-override list when the matcher actually found a set to
    // contradict. "Both agree there is no set" is not a correction and would
    // just pad a list whose whole value is being short enough to read.
    if (auto.sets.length) note("sets", [], auto.sets);
    overrides[id] = { ...(overrides[id] || {}), sets: [] };
    counted.notASet = (counted.notASet || 0) + 1;
  } else if (setIds.length) {
    // TIM'S ANSWER IS RECORDED WHETHER OR NOT THE MATCHER AGREES WITH IT.
    //
    // This used to retire the override whenever the sheet and the matcher said
    // the same thing, on the reasoning that agreement means there is nothing to
    // correct. That was right while the matcher was the source of truth and the
    // sheet was a way to fix it. It is backwards now that the sheet IS the
    // source: it threw away the answer and kept the guess, so the system could
    // not tell "Tim confirmed this" from "Tim never looked at it".
    //
    // Measured before this changed: 286 videos carried a set tag and 272 of them
    // came from the matcher, because agreement was discarded on every one. Tim
    // asked for only his own entries to drive the tags, and that was impossible
    // while his agreement was the one answer the importer refused to store.
    //
    // The new-override list still only names DISAGREEMENTS, because a list of
    // every row he filled would be 286 lines and worth nobody's time. The value
    // of that list is being short enough to read.
    if (!sameTags(setIds, auto.sets)) note("sets", setIds, auto.sets);
    overrides[id] = { ...(overrides[id] || {}), sets: setIds };
    counted.set++;
    if (setIds.length > 1) counted.multiSet++;
  }

  const opening = get(r, idx.opening);
  if (opening) {
    const key = opening.toLowerCase();
    if (!(key in PRODUCT_IDS)) unknownOpening.add(opening);
    else if (PRODUCT_IDS[key]) {
      // Same rule as the sets above: his answer is stored either way, and only
      // a disagreement is worth a line in the list he reads afterwards.
      if (!sameTags([PRODUCT_IDS[key]], auto.products)) note("products", [PRODUCT_IDS[key]], auto.products);
      overrides[id] = { ...(overrides[id] || {}), products: [PRODUCT_IDS[key]] };
      counted.opening++;
    }
  }

  const m = {};
  if (opening) m.openingType = opening;
  // The denominator for the luck page. Only a positive whole number is worth
  // keeping: a blank, a zero or a stray word would silently divide the rate by
  // the wrong thing, which is worse than having no rate at all.
  // KEEP THE DECIMAL POINT WHILE STRIPPING EVERYTHING ELSE. This stripped
  // [^0-9], which turns a spreadsheet's "18.0" into the string "180". A Costco
  // UPC came back as 180 packs instead of 18 and a collector chest as 60
  // instead of 6, and because both are positive whole numbers nothing
  // complained: the luck page would simply have divided by ten times too many
  // packs. Any exporter that writes a float, which openpyxl and Google Sheets
  // both can, hit this.
  // ADD THE PER-SET CELLS UP RATHER THAN READING THE TOTAL, and this is not a
  // preference. "Packs Opened" is =SUM(H,J,L,N,P) in the workbook, and openpyxl
  // writes formulas with NO cached value, so reading that column out of a file
  // this project generated returns blank on every row. An import in that state
  // dropped `packs` from all 241 videos that had one and took the site's pack
  // total from 1,062 to 0, silently, because a blank is not an error.
  //
  // The parts are always there and never computed, so they are the source. The
  // total column is only consulted when every part is empty, which covers a
  // sheet edited in Excel where the cache does exist.
  // STRIP, DO NOT SQUASH. Deleting every non-digit turns "3 + 3" into 33,
  // "12-18" into 1218 and "6 packs (2 sets)" into 62. That is the same shape as
  // the documented "18.0" becoming 180, which was fixed by allowing the decimal
  // point through and nothing else. A cell is only a number if it reads as one:
  // take the FIRST number in it and ignore the rest, so a stray note cannot
  // multiply a pack count by a hundred on the page that divides by it.
  const num = (x) => {
    const m = String(x == null ? "" : x).match(/\d+(?:\.\d+)?/);
    if (!m) return 0;
    const n = Math.round(Number(m[0]));
    return Number.isFinite(n) ? n : 0;
  };
  let packs = idx.packCells.reduce((t, i) => t + num(get(r, i)), 0);
  if (!packs) packs = num(get(r, idx.packs));
  if (packs > 0) { m.packs = packs; counted.packs = (counted.packs || 0) + 1; }

  // WHICH ONE OF THESE, AND WHICH PACK OUT OF IT.
  //
  // Same num() as the pack count above, so "#3", "3 of 9" and a spreadsheet's
  // "3.0" all read as 3 and a stray note cannot multiply the number by a
  // hundred. A blank cell is skipped like every other blank on this sheet, and
  // a cell that holds words rather than a number is REPORTED rather than
  // dropped: this column exists to be counted, so a value that counts as
  // nothing is worth a line.
  //
  // 0 IS NOT AN ANSWER HERE. There is no zeroth ETB and no pack zero, so a 0
  // reads as a mis-key and is reported with everything else that did not mean
  // what it looked like.
  for (const [key, i, what] of [
    ["boxNumber", idx.boxNo, "Box #"],
    ["packNumber", idx.packNo, "Pack #"],
  ]) {
    const raw = get(r, i);
    if (!raw) continue;
    const n = num(raw);
    if (n > 0) { m[key] = n; counted[key] = (counted[key] || 0) + 1; }
    else quiet.push(`${id}: ${what} "${raw}" is not a number I can count, so it was skipped.`);
  }
  // A PACK NUMBER PAST THE END OF THE BOX IS A TYPO OR A WRONG OPENING TYPE.
  // Pack 12 of a nine pack ETB is one or the other, and both are worth seeing
  // while the row is still in front of you. It is only a warning: the row still
  // imports, because the sheet is the authority on what was opened and a note
  // is cheaper than a refusal.
  if (m.packNumber && packs > 0 && m.packNumber > packs) {
    quiet.push(`${id}: Pack # ${m.packNumber} but the row only counts ${packs} pack(s). Typo, or the wrong Opening Type?`);
  }

  const hasHit = get(r, idx.hasHit);
  if (hasHit) { m.hasHit = isYes(hasHit); counted.hit++; }
  const card = get(r, idx.hitCard);
  if (card) { m.hitCard = card; counted.card++; }
  const rarity = get(r, idx.rarity);
  // The dropdown reads "Special Illustration Rare (2 gold stars)"; the
  // parenthetical is a hint for whoever is filling the sheet in, not something
  // to print on a public page.
  // ONLY KEEP A RARITY THAT ARRIVED WITH A CARD NAME. build-sheet.py used to
  // prefill this column from tags derived from the title, coloured to mean
  // "confirm this", and the export to CSV throws the colour away, so a guess
  // and an answer are indistinguishable by the time they reach here. 62 of the
  // 64 values that came back had no card name beside them and none was typed.
  // A rarity next to a card is an answer. A rarity on its own is the title
  // matcher talking to itself, and it was being published as a hit.
  if (rarity && !/^no hit$/i.test(rarity) && m.hitCard) {
    m.hitRarity = rarity.replace(/\s*\([^)]*\)\s*$/, "").trim();
  } else if (rarity && !/^no hit$/i.test(rarity)) {
    // SAY SO WHEN IT IS THROWN AWAY. The guard above is right, but it is also
    // the one place where a person picking a value off a dropdown gets nothing
    // and no message. Fill in two hundred rarities without naming the cards and
    // the import reports two hundred successes.
    quiet.push(`${id}: Hit Rarity "${rarity}" ignored, because Hit Card is empty. Name the card and it counts.`);
  }
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

  // READ Box / Series BACK INTO THE STRUCTURED COLUMNS, because Tim writes the
  // whole thing in one cell: "Pitch Black Booster Bundle #3 Pack#5". He asked
  // for the dropdown to go, correctly, since it could only ever offer products
  // already in the log and never the one being recorded for the first time.
  //
  // THIS IS TRANSCRIPTION, NOT INFERENCE, and that distinction is the only
  // reason it is allowed. Everything this project refused to publish today was
  // a number a REGEX worked out from prose somebody else wrote. This is Tim's
  // own sentence, written into a column that exists to be read, and reading
  // "#3" back out of it is no more a guess than reading a cell called Box #.
  //
  // A TYPED COLUMN ALWAYS WINS. Every assignment below is guarded on the field
  // being absent, so if he fills Box # himself and writes something different
  // here, his column stands and this does nothing. Same order of precedence the
  // rest of this file uses.
  //
  // DELIBERATELY NOT PARSED: the SET. A set name is many words, several of them
  // shared between sets ("Pitch Black" and "Mega Evolution Pitch Black"), and
  // getting it wrong silently misfiles a whole video's packs under another set,
  // which is exactly the class of error the pack-count work spent today
  // undoing. The Set column is a dropdown of real set names and stays the
  // source of truth for that one field.
  if (box) {
    // "#3", "3", "no. 3" after the product words, but ONLY when the word Box or
    // a product name precedes it, so a set with a number in its name cannot be
    // read as a box number.
    const bx = /(?:box|etb|bundle|tin|upc|blister|collection|display|case)\s*#?\s*(\d{1,2})\b/i.exec(box);
    // "Pack#5", "pack 5", "- pack 5". Requires the literal word pack.
    const pk = /\bpack\s*#?\s*(\d{1,2})\b/i.exec(box);
    if (bx && m.boxNumber == null) m.boxNumber = Number(bx[1]);
    if (pk && m.packNumber == null) m.packNumber = Number(pk[1]);

    // The product kind, matched against the SAME table the Opening Type
    // dropdown is built from, so the two can never disagree about what an "ex
    // Box" is. Longest label first: "Elite Trainer Box" must beat "Box".
    if (!m.openingType) {
      const hay = box.toLowerCase();
      // Match on the KEYS of PRODUCT_IDS, which are the dropdown's own labels,
      // so openingType comes out in exactly the form a typed cell would carry.
      // "etb (elite trainer box)" will not appear in prose, so the bare words
      // are tried too and mapped back to the label that owns them.
      const PROSE = { "elite trainer box": "etb (elite trainer box)", etb: "etb (elite trainer box)" };
      const keys = [...Object.keys(PRODUCT_IDS), ...Object.keys(PROSE)].sort((a, b) => b.length - a.length);
      const hit = keys.find((k) => hay.includes(k));
      if (hit) m.openingType = PROSE[hit] || hit;
    }
  }
  const notes = get(r, idx.notes);
  if (notes) m.notes = notes;

  // TWO ROWS FOR ONE VIDEO USED TO MEAN THE SECOND ONE WON OUTRIGHT.
  //
  // `manual[id] = m` replaced the record, so duplicating a row -- a copy-paste,
  // a re-added row during a big backfill -- deleted every answer on the first
  // one. Measured: a video with a set, an opening type, Has Hit, a box name, a
  // rank, custom copy, an affiliate link, Feature and Hide came out of a two-row
  // sheet holding three fields, with no message. Merging keeps both halves, the
  // later row still wins field by field, and the duplicate is reported because
  // it is nearly always a mistake worth seeing.
  if (Object.keys(m).length) {
    if (seenRow.has(id)) quiet.push(`${id}: two rows for the same video (rows ${seenRow.get(id)} and ${rowNo}). Merged, later row wins per column.`);
    manual[id] = { ...(manual[id] || {}), ...m };
  }
  if (!seenRow.has(id)) seenRow.set(id, rowNo);
  // A video id the catalogue has never heard of is a typo or a row for a video
  // that has not synced yet. Either way everything on that row is written to
  // manual.json and then dropped on the floor by sync-youtube, which is the
  // definition of quiet.
  if (Object.keys(live).length && !live[id]) quiet.push(`${id}: no such video in the catalogue (row ${rowNo}). The whole row will be ignored by the site.`);
}

await mkdir(join(ROOT, "data"), { recursive: true });
await writeFile(join(ROOT, "data/overrides.json"), JSON.stringify(overrides, null, 2) + "\n");
await writeFile(join(ROOT, "data/manual.json"), JSON.stringify(manual, null, 2) + "\n");

console.log(`
Read ${rows.length - 1} rows from ${csvPath}

  set tags           ${counted.set}${counted.multiSet ? `  (${counted.multiSet} with more than one set)` : ""}${counted.notASet ? `  (${counted.notASet} answered "not a set")` : ""}
  opening types      ${counted.opening}${counted.retired ? `\n  overrides retired  ${counted.retired}  (the sheet now agrees with the matcher)` : ""}
  box numbers        ${counted.boxNumber || 0}
  pack numbers       ${counted.packNumber || 0}
  has-hit answered   ${counted.hit}
  hit cards named    ${counted.card}
  hall of fame       ${counted.greatest}
  affiliate links    ${counted.affiliate}
  custom copy        ${counted.copy}
  hidden             ${counted.hidden}

Wrote data/overrides.json  (${Object.keys(overrides).length} videos)
${/* EXACT KEY, NOT A PREFIX TEST. Three real YouTube ids in this file start with
      an underscore, so filtering on `startsWith("_")` silently reports three
      fewer videos than it wrote. A YouTube id is always 11 characters and
      "_WARNING" is 8, so the key cannot collide with one. */ ""}Wrote data/manual.json     (${
  Object.keys(manual).filter((k) => k !== "_WARNING").length
} videos, plus the _WARNING header)
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

// EVERYTHING BELOW HERE WAS ONCE SILENT, and silence is the only failure mode
// that matters on a sheet nobody reads back. None of it is fatal, so the import
// still writes and still exits 0: the point is that a bulk upload of three
// hundred rows ends with a list of the rows that did not mean what they looked
// like, rather than a row of green counts.
if (quiet.length) {
  console.log(`${quiet.length} row(s) did something quiet. Worth a look:`);
  for (const q of quiet.slice(0, 25)) console.log("  " + q);
  if (quiet.length > 25) console.log(`  ...and ${quiet.length - 25} more`);
  console.log("");
}

if (newOverride.length) {
  console.log(`${newOverride.length} new override(s). READ THIS LIST.`);
  console.log("An override beats the tag rules forever, so each of these is either you");
  console.log("correcting the site, or a cell still carrying a guess from before those rules");
  console.log("were fixed. The second kind pins the old answer and no later fix can reach it.");
  console.log("Where the tag rules are right now, clear the cell or set it to their answer and");
  console.log("re-import: agreement retires the override.");
  for (const s of newOverride.slice(0, 30)) console.log("  " + s);
  if (newOverride.length > 30) console.log(`  ...and ${newOverride.length - 30} more`);
  console.log("");
}

console.log(`Now run:
  node --env-file=.env scripts/sync-youtube.mjs   (or scripts/retag-videos.mjs --write, offline)
  node scripts/build-all.mjs

REBUILDING THE WORKBOOK BEFORE THAT RETAG STEP HANDS YOUR SET ANSWERS BACK AS
THE MATCHER'S GUESSES. build-sheet.py fills the Set columns from
public/data/videos.json, not from data/overrides.json, so the retag is what puts
your corrections where the next rebuild can find them.
`);
