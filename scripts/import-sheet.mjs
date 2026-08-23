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
import { RARITY_KEY } from "../shared/rarity.mjs";

import { localDay } from "../shared/today.mjs";
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

  // THE WAY TIM ACTUALLY WRITES THEM, now these columns are free text. Every
  // one came out of his own first pass on 19 August 2026 and was reported by
  // this script as unrecognised, which is the dropped dropdown working as
  // intended: it did not guess, it said so. The keys above are the old dropdown
  // LABELS, which nobody types by hand; these are the words a person writes.
  "blister pack": "blister",
  "upc": "upc",
  "ultra premium collection": "upc",
  "collector chest": "collection-box",
  "elite trainer box": "etb",
  "etb": "etb",
  "spc": "spc",
  "super premium collection": "spc",
  "mini tin": "tin",
  "single pack": "single-pack",
  // A pack inside a printed outer sleeve, the version that hangs on a peg. It
  // is still one booster pack and the site counts it as one, which is why it
  // maps to single-pack rather than earning a tag of its own.
  "sleeved booster pack": "single-pack",
  "sleeved pack": "single-pack",
  "booster pack": "single-pack",
  "bundle": "bundle",
  "japanese pack": "japanese-pack",
  "korean pack": "korean-pack",
  "chinese pack": "chinese-pack",

  // FROM TIM'S THIRD PASS, 20 August 2026, and the same failure as the two
  // blocks above wearing a different set of words. His first Japanese rows say
  // "Japanese Single Booster Pack": the map held "japanese pack" and the
  // English "single booster pack" separately and neither matched the two of
  // them written together, so the row was reported as unrecognised and his
  // product answer was not stored.
  //
  // NOTHING LOOKED WRONG ON THE SITE, which is why this is worth a comment
  // rather than a one-line fix. The title matcher had already guessed
  // japanese-pack from the word "Japanese" in the title and guessed RIGHT, so
  // the page was tagged correctly and the only casualty was the difference
  // between "Tim confirmed this" and "a rule guessed it". That is the exact
  // failure the ex-premium block above describes, and it is now the third time
  // it has happened on this column.
  //
  // The Korean and Chinese forms are added at the same time. Neither appears in
  // the sheet today; both are one Collector Fest away from appearing, and the
  // cost of a key that is never read is nothing.
  "japanese single booster pack": "japanese-pack",
  "korean single booster pack": "korean-pack",
  "chinese single booster pack": "chinese-pack",
  "japanese sleeved booster pack": "japanese-pack",
  // NO "japanese booster box" KEY, DELIBERATELY. shared/taxonomy.mjs has
  // japanese-pack, korean-pack and chinese-pack and no boxed equivalent, so the
  // only id available is the language-blind booster-box. Mapping onto it would
  // silently file a Japanese box as an English one, and inventing a
  // japanese-box id here would name a tag with no label, no filter entry and no
  // /openings/ page. When a Japanese box is actually opened, add the id to
  // taxonomy.mjs first and this key second.

  // FROM TIM'S SECOND PASS, 19 August 2026, and the first of these was the
  // SECOND most common product value in the whole sheet at 16 rows. It went
  // unrecognised because the map had "ex premium collection" and "ex box" but
  // not the way he actually writes it, which is both of them at once. Nothing
  // looked broken: the importer declined to store his answer and the title
  // matcher's guess stayed, so the pages were tagged and the confirmation was
  // silently thrown away. That is the exact failure the long comment above the
  // sets block describes -- the system could not tell "Tim confirmed this" from
  // "Tim never looked at it" -- reappearing on the product column.
  "ex premium collection box": "ex-premium",

  // FROM TIM'S FOURTH PASS, 21 August 2026, and the same failure a fourth time.
  // Rows 67 and 72 answer this column with the PRODUCT'S FULL RETAIL NAME
  // rather than a kind of box: "First Partner Illustration Collection
  // (Series 1)". Both are already tagged collection-box in overrides.json
  // because the title matcher guessed it, so once again nothing looked wrong
  // and the only casualty was the difference between a guess and a confirmation.
  //
  // IT MAPS TO collection-box AND DOES NOT EARN AN ID OF ITS OWN. There is no
  // first-partner product id in shared/taxonomy.mjs and no /openings/ page for
  // one; adding a key here that named a missing id would caption the filter
  // rail with a raw string and link to a page that is not built, which is
  // precisely what the "ex box" comment above records going wrong.
  //
  // The Series 2 form is added at the same time, on the same reasoning as the
  // Korean and Chinese single-pack keys: it does not appear in the sheet today,
  // and a key that is never read costs nothing.
  // FROM TIM'S FIFTH PASS, 21 August 2026, and the same shape as the First
  // Partner block below it: he answers this column with the PRODUCT'S RETAIL
  // NAME rather than a kind of box. All three were reported unrecognised, which
  // is the dropped dropdown working -- it did not guess, it said so.
  //
  // "2 pack blister" is the plain kind and there is already a blister id.
  //
  // The two Collections are collection-box for the reason the First Partner
  // note gives: there is no illustration-collection or poster-collection id in
  // shared/taxonomy.mjs and no /openings/ page for one, and a key naming a
  // missing id captions the filter rail with a raw string and links to a page
  // that is not built. Both are a themed box holding packs and promos, which is
  // what collection-box already means on this site.
  // FROM TIM'S SIXTH PASS, 21 August 2026. Same shape as every block above: the
  // product's retail name where the column wants a kind of box.
  //
  // The two Collections are collection-box on the argument the First Partner
  // note gives -- no id for them in shared/taxonomy.mjs, no /openings/ page, and
  // a key naming a missing id captions the filter rail with a raw string and
  // links to a page that is not built. A pin collection and a sticker
  // collection are both a themed box holding packs and a promo, which is what
  // collection-box already means here.
  "3 pack blister": "blister",
  "tech sticker collection": "collection-box",
  "sticker collection": "collection-box",
  "first partners deluxe pin collection": "collection-box",
  "deluxe pin collection": "collection-box",
  "pin collection": "collection-box",
  "2 pack blister": "blister",
  "poster collection": "collection-box",
  "victini illustration collection": "collection-box",
  "illustration collection": "collection-box",
  "first partner illustration collection (series 1)": "collection-box",
  "first partner illustration collection (series 2)": "collection-box",
  "first partner illustration collection": "collection-box",
  "ex collection box": "ex-premium",

  // A First Partner box is a collection box, which is what the title matcher
  // already calls it, so this maps onto the existing id rather than earning a
  // new one. The series number is stripped before the lookup (see below), so
  // Series 2 and 3 need no lines of their own.
  "first partner illustration collection": "collection-box",
  "first partner collection": "collection-box",
  "first partner box": "collection-box",
};

/** Tim writes the series on the product, as in "First Partner Illustration
 * Collection (Series 1)". WHICH SERIES IT IS BELONGS TO THE SET COLUMN AND NOT
 * TO THE PRODUCT: the product is the same box either way, and keeping the
 * number here would need a new key for every series that is ever printed. The
 * trailing "(Series N)" and a trailing bare "#N" are dropped before the lookup,
 * so the map stays the list of things a box IS. */
const productKey = (s) =>
  s.toLowerCase().trim()
    .replace(/\s*\((?:series|serie)\s*\d+\)\s*$/i, "")
    .replace(/\s*#\s*\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

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

// THE SET NAME A PAGE PRINTS, IN THE CASE THE SET ACTUALLY USES.
//
// setIdByName is keyed on a LOWERCASED name because that is what matching a
// typed cell needs, and the Hit Info parser handed that lowercased key straight
// through to data/hits.json as the hit's setName. Eleven cards on the Costco
// UPC rip published captions reading "mega evolution", "journey together",
// "destined rivals" and "phantasmal flames". The same eleven cards logged on
// the My Hits tab, which resolves its display name from sets.json, published
// "Phantasmal Flames" three cards further up the same list.
//
// So the id is the join and this map is the only place a display name is read
// from. sets.json first because a guided set owns its own name, then the wider
// expansion list, then the non-English guides under the label the sheet uses.
const setDisplayName = new Map();
try {
  const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
  for (const s of sets) if (!setDisplayName.has(s.id)) setDisplayName.set(s.id, s.name);
} catch { /* warned about above */ }
try {
  const { sets: expansions } = JSON.parse(
    await readFile(join(ROOT, "public/data/expansions.json"), "utf8")
  );
  for (const e of expansions || []) {
    if (!e?.name) continue;
    const id = e.slug || e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (id && !setDisplayName.has(id)) setDisplayName.set(id, e.name);
  }
} catch { /* optional */ }
try {
  const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
  for (const [id, g] of Object.entries(ig)) {
    setDisplayName.set(id, `${g.english} (${LANG_TAG[g.lang] || "??"})`);
  }
} catch { /* run: node scripts/sync-intl-guides.mjs */ }

// THE SET'S OWN CHECKLIST, LOADED ONLY WHEN A HIT NEEDS PROVING.
//
// Used by the Hit Info parser to check a card name against the real cards in
// the set Tim named, which is the difference between correcting a name and
// guessing at one. Missing file means no checklist, which means no correction:
// silence here always leaves the name exactly as he typed it.
const checklistCache = new Map();
async function checklistFor(setId) {
  if (!setId) return null;
  if (!checklistCache.has(setId)) {
    let names = null;
    try {
      const doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${setId}.json`), "utf8"));
      names = new Set((doc.cards || []).map((c) => String(c.name || "").toLowerCase()));
    } catch { /* an imported or unguided set keeps its checklist elsewhere */ }
    if (!names) {
      try {
        const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
        const g = ig[setId];
        if (g) {
          names = new Set();
          for (const c of g.cards || []) for (const nm of [c.en, c.native]) if (nm) names.add(String(nm).toLowerCase());
        }
      } catch { /* run: node scripts/sync-intl-guides.mjs */ }
    }
    checklistCache.set(setId, names && names.size ? names : null);
  }
  return checklistCache.get(setId);
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
        checked: localDay(),
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
  // ONE WRITTEN PHRASE: "Pitch Black ETB #3". Set, product type and which one
  // of that product, in the order a person says them. It replaces three
  // columns, because asking him to take his own sentence apart before typing it
  // was the slow part; taking it apart afterwards is this script's job.
  product: firstCol("Product", "Product Type", "Opening Type"),
  opening: firstCol("Product", "Product Type", "Opening Type"),
  packs: col("Packs Opened"), hasHit: firstCol("Hit", "Has Hit"),
  // ONE CELL CARRYING EVERY SET AND ITS PACK COUNT: "Phantasmal Flames 6, Mega
  // Evolution 4, Destined Rivals 4". It replaces Set, Packs and the four
  // Set 2-5 pairs, which is ten columns collapsed into one, and it is read the
  // same way Hit Info is: split on commas, match each fragment against the real
  // set list, take the number off the end.
  setsPacks: firstCol("Sets & Packs", "Sets and Packs"),
  // HOW MANY PACKS OF EACH SET THE VIDEO OPENED. Sits immediately right of
  // Sets & Packs and holds one number per set named there, in the same order,
  // commas between them. Blank means one of each.
  //
  // Tim, 20 August 2026, asking for it: a column "for how many packs of that
  // set are in the video. Blank means one." He hit it on his first Japanese
  // row, tuX1t8p29Ik, which opened Abyss Eye packs #9 and #10 in one video:
  // two packs of one set, with no Pack # that can hold both.
  //
  // IT DOES NOT REPLACE THE NUMBER INSIDE THE Sets & Packs CELL. That form
  // ("Phantasmal Flames 6, Mega Evolution 4") already worked and is still read,
  // and where the two disagree the in-cell number wins, because it is written
  // against the set name it counts and cannot come adrift of it. See applyCount
  // below for why that matters and what is reported instead of guessed.
  packsPerSet: firstCol("Packs of Each Set", "Packs Per Set", "How Many Packs"),
  // WHICH ONE OF THESE, AND WHICH PACK OUT OF IT. Both new, both optional, and
  // both go through firstCol for the reason the two comments below give: col()
  // is an exact match, and every column in this file that was ever renamed
  // returned -1 and took its whole feature down with no error. An export made
  // before these columns existed has neither header, gets -1 from both, and
  // imports exactly as it always did.
  boxNo: firstCol("Product #", "Box #", "Box Number"),
  packNo: firstCol("Pack #", "Pack Number", "Pack In Box"),
  // THE PER-SET PACK CELLS ARE THE SOURCE, NOT THE TOTAL COLUMN. See below.
  packCells: ["Packs", "Packs 2", "Packs 3", "Packs 4", "Packs 5"].map(col).filter((i) => i >= 0),
  // The header has been "Hit Card", "Hit Cards" and "Hit Card or Hit Cards"
  // across revisions, and col() is an exact match, so a stale name here reads as
  // an empty column and the whole feature goes quiet with no error.
  hitCard: firstCol("Hit Info", "Hit Card", "Hit Cards", "Hit Card or Hit Cards"),
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

// WHAT THE SHEET STOPS ASKING FOR, THE SHEET MUST NOT ERASE.
//
// `manual` is built fresh every run, so a field that no longer has a column
// simply vanishes -- and on 20 August 2026 the Product # column was retired at
// Tim's request, on the reasoning that a box number can be worked out later
// from the data. It mostly cannot: of the 73 rows that carried one, TWENTY
// restate it somewhere else and 53 do not.
//
// THAT NUMBER WAS FIRST REPORTED AS NINE and the mistake is instructive. The
// check looked for a literal "Box #N" -- on a sheet whose commonest opening type
// is an ETB. Widening it to the product words this project actually uses (etb,
// bundle, tin, upc, chest, collection) finds 16 in titles, and the YouTube
// description carries 4 more. The design conclusion survives at 53; the figure
// did not, and a figure quoted as the reason for a mechanism has to be right.
//
// So the previous file is read first and named fields are carried forward for
// any row the sheet no longer answers. This is a floor, not a merge: anything
// the sheet DOES say still wins outright, and a value only survives while its
// video does.
let priorManual = {};
try {
  priorManual = JSON.parse(await readFile(join(ROOT, "data/manual.json"), "utf8"));
} catch {
  priorManual = {};
}
const CARRY_FORWARD = ["boxNumber"];

const manual = { _WARNING: MANUAL_WARNING };
const unknownOpening = new Set();
let counted = { set: 0, multiSet: 0, opening: 0, hit: 0, card: 0, greatest: 0, affiliate: 0, copy: 0, hidden: 0 };
const unknownSet = new Set();
// HITS PARSED OUT OF THE VIDEO LOG'S Hit Info COLUMN.
//
// data/hits.json is what /hall.html, the rarity pages and the set guides read,
// and until now it was filled ONLY from the My Hits tab. Tim fills Hit Info on
// the Video Log instead, one line per video, so 23 of his 26 hit rows were
// landing in manual.json and reaching no page at all: the hall showed 19
// pictures against 42 plaques and he asked why.
//
// Same shape as the My Hits rows so both feed one writer and neither can drift.
const logHits = [];
// id -> display name, module scope, because the row loop needs it and the only
// other copy lives inside the My Hits function.
// A SET NAME WITH A TYPO IS STILL A SET NAME, and this is safe in a way that
// guessing never is: it picks from a CLOSED LIST of 174 real set names rather
// than inventing one. "Phantasmal Falmes" is not a judgement call about what
// Tim meant, it is one transposition away from exactly one entry on that list
// and nothing else is close.
//
// Deliberately tight. Only tried when an exact match fails, only on fragments
// of 6 characters or more, and only when the best candidate is within a
// distance of 2 AND no other candidate is within 3, so an ambiguous near-miss
// resolves to nothing rather than to the first thing sorted. Set names overlap
// hard on this site ("Pitch Black" against "Mega Evolution Pitch Black"), and a
// wrong set silently misfiles a whole video's packs.
function nearestSet(text, names) {
  const s = text.toLowerCase().trim();
  if (s.length < 6) return null;
  const dist = (a, b) => {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3) return 99;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  };
  let best = null, bestD = 99, secondD = 99;
  for (const n of names) {
    const d = dist(s, n);
    if (d < bestD) { secondD = bestD; bestD = d; best = n; }
    else if (d < secondD) secondD = d;
  }
  return bestD <= 2 && secondD > 3 ? best : null;
}

const SET_NAME_BY_ID = new Map();
for (const [label, sid] of setIdByName) if (!SET_NAME_BY_ID.has(sid)) SET_NAME_BY_ID.set(sid, label);
// What the site currently believes, used only to spot the stale-prefill trap
// described where the overrides are written.
let live = {};
try {
  const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
  live = Object.fromEntries(videos.map((v) => [v.id, v]));
} catch { /* no catalogue yet */ }
const newOverride = [];
// WHICH VIDEOS THE SHEET ACTUALLY ANSWERED THIS RUN, per field.
//
// An override that no filled cell backs is invisible to every rule this file
// has. The two branches below write an override only where a cell was filled
// and retire one only where a cell was filled, so a field left blank is
// untouched forever -- correct as a rule ("blank means not answered"), and it
// leaves whatever an OLDER run of this importer wrote pinned permanently.
// These two sets are what the sweep after the row loop needs to tell "the
// sheet said this" from "nobody has said anything since some earlier build".
const answered = { sets: new Set(), products: new Set() };
// Things that used to happen in silence. Each one is a row whose meaning
// changed or vanished between the cell and the JSON, and every one of them was
// found by round-tripping a filled-in sheet rather than by reading the code.
const quiet = [];
// A set the row's own Hit Info names that the row's own set answer leaves out.
// Filled by the Hit Info parser below; reported at the end.
const hitSetGap = [];
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
  // SETS & PACKS IS NOW THE SOURCE, and it carries the per-set pack counts the
  // old columns never could hold together. "Phantasmal Flames 6, Mega Evolution
  // 4" is two sets and two counts in one cell.
  //
  // The set name is matched against the real list, longest first, so "Mega
  // Evolution Pitch Black" beats "Pitch Black". Whatever trails it is the
  // count. A fragment with a set and no number counts as 1, because writing
  // "Pitch Black" alone plainly means one pack of it; a fragment with a number
  // and no recognisable set is reported rather than guessed at.
  const setPacks = [];
  // DID A PERSON STATE HOW MANY PACKS THIS VIDEO OPENED, or is the number below
  // just the length of a list of set names? Those look identical once they are
  // both integers, and telling them apart is the whole reason this flag exists.
  //
  // The distinction is the one this project has got wrong more than any other.
  // A Sets & Packs cell reading "Ascended Heroes" names ONE set and means one
  // pack, which is Tim's own rule for a blank count. A cell reading "First
  // Partner Illustration Collection (Series 1), Phantasmal Flames, Mega
  // Evolution" names the three packs a First Partner BOX HOLDS, and the video
  // it sits on, M7NqqhR8V4M, opens Box #6 and states Pack # 3. Summing the
  // fragments there yields 3 packs for a video that opened one, which is the
  // PRODUCT_TO_PACKS prefill disaster arriving by a new road.
  //
  // So a multi-set cell with no counts is NOT an answer, it is reported and
  // nothing is published for it. See the packsOpened write further down.
  let packsStated = false;
  const spRaw = get(r, idx.setsPacks);
  if (spRaw) {
    const NAMES = [...setIdByName.keys()].sort((a, b) => b.length - a.length);
    // SEMICOLONS SEPARATE SETS HERE TOO, BECAUSE HE WRITES THEM.
    //
    // This split was commas only. On 21 August 2026 three rows -- 239, 246 and
    // 247 -- separated their sets with a semicolon instead, which is the
    // separator he already uses in Hit Info, and each of those rows lost 2 of
    // its 3 set tags and its pack count as a result.
    //
    // IT WAS NOT A QUIET LOSS, IT MOVED A CARD TO THE WRONG SET. With only one
    // set surviving, the single-set fallback stamped that set onto the row's
    // promo card, so row 246 went looking for a Mabosstiff ex in Paradox Rift
    // and row 247 for a Mega Charizard Y in Phantasmal Flames. Neither set
    // prints either card; both are tin promos, SVP 086 and MEP 030. The
    // symptom that surfaced was "that name is not on the checklist", which
    // points at the card name and not at the separator two columns away.
    //
    // A semicolon cannot appear inside a set name -- the longest-first NAMES
    // match below is what handles real punctuation, and the only set names on
    // this site carrying any are parenthesised, like "First Partner
    // Illustration Collection (Series 1)". So accepting it costs nothing and
    // removes three cells from his correction list.
    for (const piece of String(spRaw).split(/[;,]/)) {
      const frag = piece.replace(/\s+/g, " ").trim();
      if (!frag) continue;
      // TIM'S FORMAT, 20 AUGUST 2026: "<Set Name> - <N> Pack", commas between sets.
      // "First Partner Illustration Collection (Series 1) - 1 Pack , Phantasmal
      // Flames - 1 Pack , Mega Evolution - 1 Pack". The count travels with the
      // name it counts, which is why the separate Packs of Each Set column is
      // gone: a positional list of numbers comes adrift the moment a set is
      // inserted mid-list, and this cannot.
      //
      // THE SUFFIX IS TRIED BEFORE THE NAME MATCH and the bare trailing number
      // is kept underneath it, because 103 rows were typed under the older
      // "Abyss Eye 2" form and re-typing them is not a migration anybody asked
      // for. A dash-N-Pack suffix wins where both could read.
      let body = frag;
      let packs = 1;
      let typed = false;
      const suffix = /\s*[-\u2013\u2014]\s*(\d{1,3})\s*packs?\s*$/i.exec(body);
      if (suffix) {
        packs = Number(suffix[1]);
        typed = true;
        body = body.slice(0, suffix.index).trim();
      } else {
        const bare = /(\d{1,3})\s*$/.exec(body);
        if (bare) {
          packs = Number(bare[1]);
          typed = true;
          body = body.replace(/\s*\d+\s*$/, "").trim();
        }
      }
      // TWO SPELLINGS THAT COST A PACK EACH, NORMALISED BEFORE THE MATCH.
      //
      // "Gem Pack Vol 2 (Eeveelutions)" is a set this site knows -- it is
      // zh-gem-pack-2 and the title matcher tags the video correctly -- but the
      // catalog spells it "Gem Pack Vol. 2" with a period, and the row adds what
      // was in the pack in brackets. startsWith missed, includes missed, and
      // nearestSet bailed on the length the parenthetical added. The set tag
      // survived on the title alone, so the page looked right and only the pack
      // arithmetic was wrong, which is the hardest kind of miss to notice.
      //
      // A trailing parenthetical is a note about the fragment, never part of a
      // set name -- no set on this site has one -- and "Vol 2" and "Vol. 2" are
      // the same words. Both are normalised for MATCHING only; the row keeps
      // whatever it typed.
      const forMatch = body
        .replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/\bvol\s+(\d)/i, "Vol. $1")
        .trim();
      const low = forMatch.toLowerCase();
      let hit = NAMES.find((n) => low.startsWith(n)) || NAMES.find((n) => low.includes(n));
      if (!hit) hit = nearestSet(forMatch, NAMES);
      if (!hit) {
        // A PACK THAT IS NOT A NUMBERED SET IS STILL A PACK. The First Partner
        // Illustration Collection holds a promo pack alongside two set packs,
        // and the promo cards belong to no expansion, so the set list cannot
        // contain it. Dropping the fragment made a three-pack box count as two.
        //
        // Counted toward packsOpened and named, but given NO set id, because it
        // genuinely has none: a promo is not a card in an expansion. Anything
        // else unrecognised is still reported rather than silently counted.
        if (/promo|first partner|illustration collection/i.test(body)) {
          setPacks.push({ set: null, name: body, packs, typed });
        } else if (suffix) {
          // A NUMBER TIM TYPED IS A NUMBER TIM TYPED, EVEN WHEN THE SET IS NEW.
          //
          // "Trick Or Trade - 3 Packs" is not in sets.json, expansions.json,
          // intl-guides.json or the printings corpus -- it is a Halloween
          // bundle this site has no page for. Refusing the fragment threw the
          // 3 away with it, and /luck.html published 458 packs where the log
          // says 462.
          //
          // The gate is the EXPLICIT "- N Packs" suffix, not the looser bare
          // trailing number above: that suffix is the one shape that cannot be
          // anything but a pack count, so it is the one that can be trusted
          // without a set behind it. Same treatment the promo pack already
          // gets, for the same reason -- the pack was opened whether or not
          // this site can name what it came from.
          //
          // STILL REPORTED. The fragment goes into unknownSet as well, so the
          // run still ends by naming a set nobody has taught this file about;
          // it just no longer loses the count on the way.
          setPacks.push({ set: null, name: body, packs, typed });
          unknownSet.add(frag);
        } else {
          unknownSet.add(frag);
        }
        continue;
      }
      setPacks.push({ set: setIdByName.get(hit), name: hit, packs, typed });
    }
    // Held in locals: `m` is declared further down, and these blocks run
    // during the set/override work that happens before it exists.
    // THE Packs of Each Set COLUMN IS GONE, 20 August 2026, on Tim's ask: the
    // count now travels inside Sets & Packs beside the name it counts. That
    // column existed for eight hours and was never filled in on a single row,
    // so nothing typed was lost retiring it -- and the positional form it used
    // ("6, 4, 4" against three sets, same order) was always the fragile half of
    // the design, because inserting a set mid-list silently reassigns every
    // number after it. A suffix cannot come adrift from its own name.
    //
    // What was refused then is still refused now and it is the same rule: a
    // count that does not line up one-per-set. It just cannot arise in this
    // shape, because there is no longer a second list to line up against.
    //
    // WHAT COUNTS AS TIM HAVING SAID HOW MANY PACKS: naming the set says it.
    // A named set is a pack, a blank count means one, and a "- N Pack" suffix
    // says otherwise. This gate used to refuse any multi-set cell, on the theory
    // that three names might be listing what a PRODUCT CONTAINS rather than what
    // the video OPENED -- and it was refusing true numbers on exactly the First
    // Partner rows it was written to protect. Tim, 20 August 2026: "First
    // partners boxes do come with 3 overall packs ... total of 3 packs per first
    // partners box", and "I listed out all 3 packs in each of the first partner
    // videos". The cell is a list of what he opened.
    packsStated = setPacks.length > 0;
  }

  // `.filter(Boolean)` IS LOAD-BEARING AND THE NULL IT DROPS IS DELIBERATE.
  //
  // setPacks deliberately carries `{ set: null }` for a pack that is real but
  // belongs to no expansion: the promo pack inside a First Partner box, and
  // anything else the promo/first-partner/illustration-collection test catches.
  // That null is CORRECT there, because the pack still counts toward how many
  // packs were opened and there is genuinely no set to name.
  //
  // setIds is a different thing wearing the same shape: it is the TAG array
  // that ends up in data/overrides.json and then in public/data/videos.json.
  // A null in there is not "no set", it is a set whose id is null, and it
  // reached the tag list once: video M7NqqhR8V4M, a six-box First Partner rip,
  // was going to be written as `[null, "phantasmal-flames", "mega-evolution"]`.
  // Downstream that is a link to a page that cannot exist.
  const setIds = setPacks.map((s) => s.set).filter(Boolean);
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
    answered.sets.add(id);
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
    answered.sets.add(id);
    counted.set++;
    if (setIds.length > 1) counted.multiSet++;
  }

  const opening = get(r, idx.opening);
  if (opening) {
    const key = productKey(opening);
    if (!(key in PRODUCT_IDS)) unknownOpening.add(opening);
    else if (PRODUCT_IDS[key]) {
      // Same rule as the sets above: his answer is stored either way, and only
      // a disagreement is worth a line in the list he reads afterwards.
      if (!sameTags([PRODUCT_IDS[key]], auto.products)) note("products", [PRODUCT_IDS[key]], auto.products);
      overrides[id] = { ...(overrides[id] || {}), products: [PRODUCT_IDS[key]] };
      answered.products.add(id);
      counted.opening++;
    }
  }

  const m = {};
  if (setPacks.length) {
    m.setPacks = setPacks;
    m.packsOpened = setPacks.reduce((n, s) => n + s.packs, 0);
    // THE FLAG IS WHAT MAKES packsOpened SAFE TO PUBLISH, and without it that
    // number must not leave this file. packsOpened has existed here for a while
    // and nothing downstream ever read it, so its being wrong on a multi-set row
    // has never cost anything. sync-youtube.mjs reads it now, and the only thing
    // standing between "3 sets are named" and "3 packs were opened" on
    // /luck.html is this boolean.
    if (packsStated) {
      m.packsStated = true;
      counted.packsStated = (counted.packsStated || 0) + 1;
    }
  }
  // KEEP THE RAW CELL, ALWAYS, EVEN WHEN THE PARSE SUCCEEDED. Tim: "keep all my
  // info in there forever as its real data from me watching the videos its
  // accurate". A parsed structure is a DERIVATIVE of what he wrote; the string
  // is the record. Storing only the parse means a later change to the parser
  // silently rewrites history, and a fragment it could not place is gone for
  // good. This is also what build-sheet.py hands back, so the column round
  // trips instead of emptying itself on the next rebuild.
  if (spRaw) m.setsPacks = String(spRaw).trim();
  // AND THE RAW COUNT CELL WITH IT, for exactly the reason above and for one
  // more: build-sheet.py restores this column from here, so a cell that is
  // imported and not stored is a cell that comes back EMPTY on the next
  // rebuild. That has already happened once on Sets & Packs, where 39 rows of
  // his typing were one rebuild away from vanishing, and the fix was this line
  // in its other half. Stored even when the parse was refused and reported,
  // because a value this file could not use is still a value he typed.
  {
    const ppsRaw = get(r, idx.packsPerSet);
    if (ppsRaw) m.packsPerSet = String(ppsRaw).trim();
  }
  // TAKE THE PRODUCT PHRASE APART. "Pitch Black ETB #3" yields the set, the
  // product type and the product number; a bare "ETB" still yields just the
  // type, so an older sheet keeps working.
  //
  // Matched against the real lists, longest name first, so "Mega Evolution
  // Pitch Black" beats "Pitch Black" and "Elite Trainer Box" beats "Box". The
  // trailing number is the WHICH-ONE, taken only when it follows the product
  // words, so a set with a digit in its name cannot be read as a count.
  const productPhrase = get(r, idx.product);
  if (productPhrase) {
    const low = productPhrase.toLowerCase();
    const NAMES = [...setIdByName.keys()].sort((a, b) => b.length - a.length);
    const setHit = NAMES.find((n) => low.includes(n));
    if (setHit && !setIds.length) {
      setIds.push(setIdByName.get(setHit));
      overrides[id] = { ...(overrides[id] || {}), sets: setIds };
      counted.set++;
    }
    const PROSE = {
      "elite trainer box": "etb (elite trainer box)", etb: "etb (elite trainer box)",
      "booster bundle": "booster bundle", bundle: "booster bundle",
      "booster box": "booster box", "blister pack": "blister pack",
      "collector chest": "collector chest", "mini tin": "mini tin",
      upc: "upc", spc: "spc", "single pack": "single pack",
    };
    const keys = [...Object.keys(PRODUCT_IDS), ...Object.keys(PROSE)].sort((a, b) => b.length - a.length);
    const kind = keys.find((k) => low.includes(k));
    if (kind && !m.openingType) m.openingType = PROSE[kind] || kind;
    const num = /(?:etb|box|bundle|tin|upc|spc|blister|chest|collection|pack)\s*#?\s*(\d{1,2})\b/i.exec(productPhrase);
    if (num && m.boxNumber == null) m.boxNumber = Number(num[1]);
  }

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
    if (!raw) {
      // A RETIRED COLUMN RESTORES ITS VALUE HERE, where the column itself would
      // have filled it, so the key lands in its usual position in `m`.
      //
      // Two earlier placements were wrong in different ways. Inside the
      // Object.keys(m).length guard further down, a row survived only if the
      // sheet still said something ELSE about it -- probed with a sheet whose
      // box-number rows had every other cell blank, every one lost its value
      // silently. Moved after that guard, it worked and churned the file:
      // assigning the key separately appended it, rewriting 146 lines of
      // manual.json on every import purely by moving boxNumber to the end of
      // each object.
      if (CARRY_FORWARD.includes(key) && priorManual[id] && priorManual[id][key] != null) {
        m[key] = priorManual[id][key];
        counted.carried = (counted.carried || 0) + 1;
      }
      continue;
    }
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

  // ONE CELL, WRITTEN THE WAY TIM SAYS IT, AND A COMMA BETWEEN HITS.
  // 19 August 2026: "I will just keep typing them out how I have, the set name,
  // the card name, and rariety type all in one cell, and will just use coma if
  // there is more than one hit per video."
  //
  // So: commas separate HITS, not the fields inside one hit. "Chaos Rising Mega
  // Greninja ex Hyper Rare" is one hit; adding ", Pitch Black Umbreon ex
  // Special Illustration Rare" makes it two.
  //
  // THE RAW STRING IS ALWAYS KEPT, whatever the parse does. m.hitCard above
  // holds it untouched, so nothing he types can be lost by a rule that failed
  // to understand it. Everything below only ADDS structure.
  //
  // MATCHED AGAINST KNOWN VOCABULARIES, NOT GUESSED AT. Set names come from
  // sets.json and rarities from the same list build-sheet.py offers, so a
  // fragment either IS a real set and a real rarity or it is not recognised.
  // That is the difference between reading his answer back and inventing one:
  // there is no scoring, no nearest match, no confidence threshold. Longest
  // name first so "Mega Evolution Pitch Black" beats "Pitch Black" and "Special
  // Illustration Rare" beats "Rare".
  //
  // WHAT IS LEFT OVER IS THE CARD NAME, which is the one part no list can hold.
  // If a fragment yields no rarity, it is still recorded with its card name and
  // no rarity rather than dropped, because "which card" is worth more than
  // "how rare" and the rarity can be added later.
  //
  // A FRAGMENT THAT RESOLVES TO NOTHING PUBLISHES NOTHING. It stays in the raw
  // string, it is reported at the end of the run so he can see it, and no
  // structured claim is made from it. Silence beats a wrong card on the hall of
  // fame page.
  if (card) {
    // HIS FORMAT, READ OFF HIS OWN FIRST PASS rather than assumed:
    //
    //   Set Name - Card Name - Star Symbol - Rarity
    //
    // and a comma between hits. I had guessed he would write running prose and
    // built a substring matcher; he writes it DELIMITED, which is better data
    // than I expected. This reads the delimiters and keeps the substring pass
    // as the fallback for a fragment that has none.
    //
    // THE STAR SYMBOL IS A FREE CROSS-CHECK AND THAT IS WHY IT IS PARSED. One
    // gold star is Illustration Rare, two silver is Ultra Rare, two black is
    // Double Rare, one pink is ACE SPEC Rare. So every hit carries its rarity
    // TWICE: once as a symbol he read off the card, once as a name he wrote.
    // When the two disagree one of them is a slip, and this reports it rather
    // than silently picking a side.
    //
    // REAL SLOPPINESS THAT MUST NOT COST A HIT, all from his own rows: "Double
    // Black Star- Double Rare" with no space, "Single Gold star" lowercase,
    // trailing commas, doubled spaces, and a hit whose rarity IS the star
    // ("Black Star Promo" with no rarity word after it).
    //
    // THE KEY WAS HALF WRITTEN OUT AND THE MISSING HALF COST A CARD NAME.
    // build-sheet.py puts the whole key on the Rarity header of the workbook
    // Tim fills in, and only four of its eight lines were listed here, so
    // "Trainer - Dawn - Double Gold Star - Special Illustration Rare" left
    // "Double Gold Star" in the card name and published "Trainer Dawn Double
    // Gold Star". These eight are copied from RARITY_HINT in build-sheet.py,
    // which is the key he is reading off the sheet, not a mapping invented here.
    const STAR_RARITY = {
      "one big yellow star": "Mega Hyper Rare",
      "single yellow star": "Mega Hyper Rare",
      // THE THIRD NAME FOR THE SAME ONE STAR, and it is Tim's, 21 August 2026.
      // The two above were written from the set booklet's own wording; he types
      // the RARITY into the symbol slot instead -- "Mega Greninja ex - Mega
      // Yellow Star - Mega Hyper Rare". Nothing is ambiguous about it: there is
      // exactly one yellow star on the ladder and it is this one. This is a
      // synonym for a real symbol, NOT typo tolerance -- "Doule Black Star" and
      // "Double Siliver Star" are still reported rather than guessed at, because
      // a misspelling is a cell to fix and a synonym is a vocabulary to widen.
      "mega yellow star": "Mega Hyper Rare",
      "triple gold star": "Hyper Rare",
      "double gold star": "Special Illustration Rare",
      "single gold star": "Illustration Rare",
      "double silver star": "Ultra Rare",
      "double black star": "Double Rare",
      "single black star": "Rare",
      "single pink star": "ACE SPEC Rare",
      // THE MEGA-ERA ULTRA RARE PRINTS A TWO-TONE STAR, NOT A SILVER ONE.
      // Mega Froslass ex, Ascended Heroes 265/217, carries a star split pink
      // and green, and Tim typed what he saw. Settled from the card itself and
      // from the catalog rather than from the words: the number on the scan is
      // 265, and public/data/printings/ has exactly one Ascended Heroes 265 and
      // it is this card at Ultra Rare. Same standing as the yellow star above --
      // one symbol, one rung, no ambiguity to resolve.
      "pink and green star": "Ultra Rare",
    };
    // A JAPANESE CARD PRINTS A LETTER CODE WHERE AN ENGLISH ONE PRINTS STARS,
    // AND THE CODE WAS ENDING UP IN THE CARD NAME.
    //
    // Tim's row for the Cyber Judge rip reads "Cyber Judge - Incineroar ex - SR
    // - Super Rare". That is his documented format exactly, Set - Card - the
    // mark on the card - Rarity, with the third field filled the way a Japanese
    // card fills it: SR is printed on the card itself, where a Scarlet & Violet
    // card would carry two silver stars. STAR_RARITY reads the star
    // descriptions and knew nothing about the letters, so "SR" was left over as
    // part of the name and published as the card "Incineroar ex SR".
    //
    // On /sets/ja-cyber-judge.html that rendered as "Incineroar ex SR" followed
    // by the SR badge and the words Super Rare, so the page said SR three
    // times, once of them inside the card's name.
    //
    // READ OFF THE SITE'S OWN KEY, NOT A LIST INVENTED HERE. shared/rarity.mjs
    // holds the seven Japanese and Korean tiers, transcribed from photographs of
    // a Japanese and a Korean wrapper, and it is the same file that draws the
    // badge on the page. Importing it means this parser and that badge cannot
    // disagree about what SR means.
    //
    // MULTI-LETTER CODES ONLY, which is the same restriction shared/rarity.mjs
    // puts on its own patterns and for the same reason it writes down there: R,
    // U and C are single capitals that turn up inside ordinary card names. The
    // match is against a WHOLE delimited field and is case sensitive, so it can
    // only ever fire where Tim wrote the code in its own slot.
    //
    // IT CROSS-CHECKS EXACTLY LIKE THE STAR DOES. The code fills a rarity that
    // was not written out, and where both are present and disagree it is
    // reported rather than silently preferred. Both readings are his.
    const CODE_RARITY = Object.fromEntries(
      RARITY_KEY.filter((r) => r.jp && r.code && r.code.length > 1).map((r) => [r.code, r.label]),
    );
    // FINISH WORDS ARE NOT PART OF THE CARD NAME. Tim writes "Mega Greninja ex
    // - Hyper Rare - Gold Card": the gold is how the card looks, not what it is
    // called, and leaving it in produced the card name "Mega Greninja ex Gold
    // Card". Stripped after the rarity is read, never before, so a finish can
    // never be mistaken for one.
    const FINISH = /\b(gold|rainbow|silver|textured|full art|alt art)\s+card\b/i;
    // AND A FINISH IS STILL A FINISH WHEN HE DOES NOT WRITE "CARD" AFTER IT.
    //
    // The pattern above only fires on a finish word FOLLOWED BY the literal
    // word "card", because that is the shape it was written for ("- Gold
    // Card"). Tim also writes the finish on its own, in its own delimited
    // field, and two rows shipped a card name with the finish glued into it:
    //
    //   "Trainer - Rare Candy - SR - Full Art"  -> "Trainer Rare Candy Full Art"
    //   "Trainer - Poke Pad - SR - Full Art"    -> "Trainer Poke Pad Full Art"
    //
    // Both are live on /hall.html today, plaques #100 and #103, and neither
    // card is in a checklist this site holds, so nothing downstream can correct
    // the name. A finish is how the card LOOKS; it is never part of what the
    // card is called.
    //
    // A WHOLE FIELD ONLY, which is the same restriction CODE_RARITY puts on the
    // letter codes and for the same reason: the field is a slot Tim typed a
    // delimiter around, so matching it can never eat a word out of the middle
    // of a name. "Alt Art Charizard" as one field is untouched. The optional
    // trailing "card" is here so "- Gold Card" is caught by this test as well
    // as by the one above, and the vocabulary is the SAME six words, not a
    // second list to keep in step.
    // "REVERSE HOLO" IS A FINISH AND WAS BECOMING PART OF THE NAME. Pokemon
    // GO 059 is Bidoof, the card whose foil peels to reveal a Ditto, and the
    // log named the finish because that is the whole point of the card. With
    // no slot for it the leftover rule made the name "Bidoof Reverse Holo",
    // which is on no checklist. The finish slot already exists and this is
    // what it is for.
    const FINISH_FIELD = /^(gold|rainbow|silver|textured|full art|alt art|reverse holo)(\s+card)?$/i;
    // The card TYPES, which are what Tim means when he writes a word like
    // Trainer between the set and the card. Used well below, where the set is
    // finally known and the set's own checklist can settle whether the word is
    // part of the name.
    const TYPE_WORD = /^(trainer|supporter|item|stadium|pok[eé]mon tool|tool|pok[eé]mon|pokemon|energy)$/i;
    // DERIVED FROM RARITY_KEY, NOT TYPED OUT BESIDE IT.
    //
    // This was a hand-written list and it had drifted: RARITY_KEY carries the
    // Japanese rarities and this did not, so "Goldeen - AR - Art Rare" found no
    // rarity at all, the letter code matched, and the leftover published a card
    // called "Goldeen Art Rare". Two rows shipped that way. A second copy of a
    // vocabulary is a second thing to forget to update, and shared/rarity.mjs is
    // the one the site renders from.
    //
    // The three extras below are not in RARITY_KEY because they are not chip
    // rarities -- Tim writes them and they must still be recognised here.
    const RARITY_WORDS = [
      ...new Set([
        ...RARITY_KEY.map((r) => r.label).filter(Boolean),
        "Shiny Rare", "Secret Rare", "Black Star Promo", "Mega Attack Rare",
      ]),
    ].sort((a, b) => b.length - a.length);
    const SET_NAMES = [...setIdByName.keys()].sort((a, b) => b.length - a.length);
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const hits = [];
    const unparsed = [];
    const mismatched = [];

    // "A : B, C, D" MEANS THREE CARDS THAT SHARE A CONTEXT, not one long name.
    //
    // Tim's First Partner Illustration Collection line reads "First Partner
    // Illustration Collection (Series 1) Alola Region Promo : Rowlet, Litten,
    // Popplio": one promo pack, three cards, and the words before the colon
    // describe all three. Split on commas alone and the first card swallows the
    // whole prefix while the other two arrive naked.
    //
    // So a colon splits CONTEXT from LIST, and the context is prepended to each
    // item. That is his own sentence structure being read, not a guess: a colon
    // in English introduces a list of the thing just named. The nine regions in
    // this product line will all arrive this way.
    // A SEMICOLON SEPARATES PACKS, because one video can hit in more than one.
    //
    // Until 20 August 2026 no cell in this sheet had ever recorded hits from
    // two different packs -- all 54 named a single printing -- so the parse
    // below had no reason to look for a second one. First Partner boxes changed
    // that: they hold three packs, Tim opens all three on camera, and Box #5 hit
    // in two of them. He wrote both into one cell and the colon-and-comma rule
    // read it as three cards from one pack, producing a card called
    // 'Popplio Trainer Punk Helmet' that does not exist and shipped to two
    // pages. That is not a typo in his data; it is a shape his format could not
    // express.
    //
    // Tim picked the semicolon (20 August 2026) from the separators that were
    // free: neither ';' nor '|' appeared in any of the 54 hit cells, so nothing
    // already written changes meaning. Each block is parsed exactly as a whole
    // cell was before -- its own colon context, its own comma list -- so a cell
    // with no semicolon takes precisely the path it always took.
    for (const block of card.split(";")) {
      let cardText = block.trim();
      if (!cardText) continue;
      let listContext = null;
      const colon = /^([^:]{4,}?)\s*:\s*(.+)$/s.exec(cardText);
      if (colon && colon[2].includes(",")) {
        // THE CONTEXT IS KEPT BESIDE THE CARD, NOT GLUED ONTO ITS NAME. Prepending
        // it produced "First Partner Illustration Collection (Series 1) Alola
        // Region Promo Rowlet", which is not what the card is called and matches
        // no catalogue entry. The card is Rowlet; the rest says which printing.
        listContext = colon[1].trim();
        cardText = colon[2];
      }

      for (const raw of cardText.split(",")) {
        const frag = raw.replace(/\s+/g, " ").trim();
        if (!frag) continue;

        // A dash used as a DELIMITER has a space on at least one side. A hyphen
        // inside a card name (Ho-Oh, Porygon-Z, Jangmo-o) has none, so it lives.
        const parts = frag.split(/\s-\s*|\s*-\s/).map((x) => x.trim()).filter(Boolean);

        let setName = null, rarity = null, star = null, code = null, name = null, cardType = null;

        if (parts.length >= 2) {
          const lows = parts.map((x) => x.toLowerCase());
          let si = lows.findIndex((x) => setIdByName.has(x));
          if (si !== -1) setName = lows[si];
          else {
            // Exact match failed on every part. Try the nearest real set name,
            // which rescues "Phantasmal Falmes" without inventing anything.
            for (let k = 0; k < lows.length; k++) {
              const near = nearestSet(lows[k], [...setIdByName.keys()]);
              if (near) { setName = near; si = k; break; }
            }
          }
          // "BLACK STAR PROMO CARD" IS A RARITY WITH A NOUN ON THE END OF IT.
          //
          // This test was an exact equality against the rarity list, so Tim's
          // "Phantasmal Falmes - Charizard X ex - Black Star Promo Card" matched
          // nothing, the whole trailing part fell into the card name, and two
          // rips published cards called "Charizard X ex Black Star Promo Card"
          // and "Oricorio ex Black Star Promo Card". He writes the word Card
          // after a rarity the way anybody says it out loud. Only a TRAILING
          // "card" is tolerated, and the match is still an equality against the
          // closed list, so nothing new can be recognised as a rarity.
          const deCard = (x) => x.replace(/\s+card$/, "");
          const ri = lows.findIndex((x) => RARITY_WORDS.some((w) => deCard(x) === w.toLowerCase()));
          if (ri !== -1) rarity = RARITY_WORDS.find((w) => deCard(lows[ri]) === w.toLowerCase());
          // TWO CATALOGS, TWO WORDS, ONE RUNG. TCGplayer calls Ascended Heroes
          // 265/217 a "Mega Attack Rare" and prints a star split pink and green;
          // TCGdex, which is what public/data/printings/ is built from, calls the
          // same printing "Ultra Rare". Downstream matching is an equality against
          // the catalog word, so the sheet word has to become the catalog word here
          // or the card resolves to nothing.
          //
          // MEASURED BEFORE IT WAS WRITTEN, because a rarity alias picks a printing.
          // Ascended Heroes has 7 Mega Attack Rares and 14 Ultra Rares on TCGplayer.
          // Our catalog calls all 7 of those numbers "Ultra Rare", with no exception,
          // and NO card name in the set carries both rarities -- so the alias cannot
          // send a row to the wrong printing. If a set ever prints both for one name,
          // this stops being safe and has to become set-aware.
          const RARITY_SYNONYM = { "mega attack rare": "Ultra Rare" };
          if (rarity && RARITY_SYNONYM[rarity.toLowerCase()]) rarity = RARITY_SYNONYM[rarity.toLowerCase()];
          const ki = lows.findIndex((x) => STAR_RARITY[x]);
          if (ki !== -1) star = lows[ki];
          // The letter code, matched against the RAW part rather than the
          // lowercased one: "SR" is a rarity mark and "Sr" is a name suffix.
          const ci = parts.findIndex((x) => Object.hasOwn(CODE_RARITY, x));
          if (ci !== -1) code = parts[ci];
          // The finish field, if he gave one a slot of its own. Read AFTER the
          // set, the rarity, the star and the code so a field that is one of
          // those keeps that job: this only ever takes a field nothing else
          // wanted. See FINISH_FIELD above for why a whole field and not a
          // word inside one.
          const fi = lows.findIndex((x, i) => i !== si && i !== ri && i !== ki && i !== ci && FINISH_FIELD.test(x));
          // THE SYMBOL SLOT IS POSITIONAL WHEN THE SHAPE LEAVES NO DOUBT, and
          // without this an unrecognised symbol becomes part of the card's name.
          //
          // Tim writes "Card - Symbol - Rarity". Every symbol he uses is matched
          // by name against STAR_RARITY or by letter against CODE_RARITY, so a
          // symbol that is neither -- a typo, or an abbreviation the tables do
          // not carry -- is simply left over, and the leftovers are the name.
          // Three rows shipped that way in the 20 August import:
          //
          //   "Mega Skarmory ex - Dobule Black Star - Double Rare"  -> a card
          //     called "Mega Skarmory ex Dobule Black Star", on 2 pages
          //   "Goldeen - AR - Art Rare"      -> "Goldeen Art Rare"
          //   "Manectric - AR - Art Rare"    -> "Manectric Art Rare"
          //
          // "Dobule" is his typo for Double and "AR" is the standard Japanese
          // abbreviation for Art Rare; neither is in a table and neither should
          // have to be. When the LAST part is a rarity we recognise, nothing
          // matched the symbol tables, and there are three or more parts, the
          // part immediately before the rarity is the symbol by position. It is
          // dropped from the name and REPORTED, so an unreadable symbol costs a
          // line in the run rather than a card that does not exist.
          //
          // AND IT MUST LEAVE A CARD BEHIND. The first version of this rule
          // dropped the part before the rarity unconditionally, which is right
          // for "Card - Symbol - Rarity" and catastrophic for "Set - Card -
          // Rarity": on "Phantasmal Falmes - Charizard X ex - Black Star Promo
          // Card" it deleted the card and published the set name as one. So it
          // only fires when something is still left to be the card.
          //
          // AND "SOMETHING IS LEFT BEHIND" WAS NOT A STRONG ENOUGH TEST. The
          // leftover it protects can be the SET SLOT rather than the card, and
          // when it is, this rule deletes the card and publishes the prefix.
          // Two of Tim's Costco UPC segments are exactly that shape:
          //
          //   "Mega Charizard X UPC Promo - Mega Charizard X ex - Black Star Promo Card"
          //   "Mega Charizard X UPC Promo - Oricorio ex        - Black Star Promo Card"
          //
          // The prefix is a PRODUCT name, so it matches no set, `si` stays -1,
          // the middle field is dropped as a symbol and the leftover prefix
          // becomes the card. Both segments produced one card called "Mega
          // Charizard X UPC Promo" with no set, no number, no price and no
          // scan: the only 2 of 117 hit-card slots on the whole site with no
          // art, both on one page, which then showed 16 slots for a 14-card
          // cell because the two REAL promos resolve correctly off the My Hits
          // tab. It warned on both and shipped both anyway, which is the whole
          // argument for deciding rather than reporting.
          //
          // SO ASK WHETHER THE CANDIDATE IS SHAPED LIKE A SYMBOL, and read the
          // shape off the two tables that already exist rather than inventing a
          // third list. Every key in STAR_RARITY ends in the word "star"; every
          // key in CODE_RARITY is two or more capital letters and nothing else.
          // That is what a typo can still satisfy -- "Dobule Black Star",
          // "Singe Gold Star", "Doule Black Star" all end in "star", and an
          // abbreviation the table does not carry is still all capitals -- and
          // it is what a card name never satisfies.
          //
          // WHEN IT IS NOT A SYMBOL, THE SHAPE IS "Set - Card - Rarity" WITH A
          // SET WE DO NOT RECOGNISE. That is the only other thing three fields
          // ending in a rarity can be, so the FIRST field goes rather than the
          // second, the card survives, and the unrecognised set is reported.
          // Restricted to exactly three fields: with four or more there is no
          // shape left that settles it, so nothing is dropped and the run says
          // so.
          const looksLikeSymbol = (s) => /\bstars?$/i.test(s) || /^[A-Z]{2,4}$/.test(s);
          let symIdx = -1, orphanSetIdx = -1;
          if (ki === -1 && ci === -1 && ri === parts.length - 1 && parts.length >= 3) {
            const cand = ri - 1;
            const leftover = parts.filter((_, i) => i !== si && i !== ri && i !== cand && i !== fi);
            const readAs = (drop) => parts.filter((_, i) => i !== si && i !== ri && i !== fi && i !== drop).join(" ");
            if (cand === si || !leftover.length) {
              /* "Phantasmal Falmes - Charizard X ex - Black Star Promo Card": the
                 set took the first field and the card is all that is left, so
                 there is no symbol here to drop. */
            } else if (looksLikeSymbol(parts[cand])) {
              symIdx = cand;
              quiet.push(
                `${id}: "${parts[symIdx]}" sits where the star symbol goes and matches no symbol I know, ` +
                  `so it was kept out of the card name. Card read as "${readAs(symIdx)}".`
              );
            } else if (si === -1 && parts.length === 3) {
              orphanSetIdx = 0;
              quiet.push(
                `${id}: "${parts[0]}" sits where the set goes and matches no set I know, and ` +
                  `"${parts[1]}" is not shaped like a star symbol or a letter code, so it was read as ` +
                  `the CARD rather than dropped. Card read as "${readAs(orphanSetIdx)}", with no set. ` +
                  `Put the set name in the first field to give it one.`
              );
            } else {
              quiet.push(
                `${id}: "${parts[cand]}" sits where the star symbol goes, matches no symbol I know and ` +
                  `is not shaped like one, so nothing was dropped and it is part of the card name. ` +
                  `Card read as "${parts.filter((_, i) => i !== si && i !== ri && i !== fi).join(" ")}".`
              );
            }
          }
          // What is left, in order, is the card.
          name = parts.filter((_, i) => i !== si && i !== ri && i !== ki && i !== ci && i !== fi && i !== symIdx && i !== orphanSetIdx).join(" ").replace(FINISH, " ").replace(/\s+/g, " ").trim();
          // "Trainer - Dawn" is a card TYPE and a card. Whether the type word
          // belongs in the name is decided later, against the set's checklist,
          // because on most of these rows the set is not in the fragment at all
          // and only arrives from the video's own tags further down. The shorter
          // reading is carried alongside the glued one until then.
          if (parts.length >= 3) {
            const ti = parts.findIndex((p, i) => i !== si && i !== ri && i !== ki && i !== ci && i !== fi && i !== symIdx && i !== orphanSetIdx && TYPE_WORD.test(p));
            if (ti !== -1) {
              const shorter = parts.filter((_, i) => i !== si && i !== ri && i !== ki && i !== ci && i !== fi && i !== symIdx && i !== orphanSetIdx && i !== ti)
                .join(" ").replace(FINISH, " ").replace(/\s+/g, " ").trim();
              if (shorter) cardType = shorter;
            }
          }
        }

        if (!name) {
          // THE NO-DASH FALLBACK, AND IT MUST MATCH ON WORD BOUNDARIES.
          //
          // This used to ask `low.includes(s2)` for every set name. "Dragon" is
          // a real set, so a cell reading "Dragonite V" matched it, the removal
          // below took the first six characters out of the CARD, and
          // /hall.html published a plaque reading "ite V - Dragon". It was live
          // for a day and read as a truncated workbook cell, which is exactly
          // what it was not: row 267 says "Dragonite V" and is correct.
          //
          // A substring test on a vocabulary this file already holds is a
          // standing trap, not a one-off -- "Dragon" inside Dragonite is the
          // instance that surfaced, and every short set name is another. So the
          // three lookups below are boundary-anchored, and LONGEST FIRST, so a
          // fragment naming "Mega Evolution" cannot be claimed by "Evolution".
          //
          // \b is wrong at the ends here: several set names carry punctuation
          // ("Scarlet & Violet", "First Partner Illustration Collection
          // (Series 1)"), and \b after ")" never fires. The lookarounds below
          // ask for a non-word character or a string edge instead, which is the
          // same intent and survives the punctuation.
          const low = frag.toLowerCase();
          const bounded = (needle) => {
            const re = new RegExp(`(?:^|[^a-z0-9])${esc(needle.toLowerCase())}(?=$|[^a-z0-9])`, "i");
            return re.test(low);
          };
          const longestFirst = (list) => [...list].sort((a, b) => b.length - a.length);
          setName = longestFirst(SET_NAMES).find(bounded) || null;
          rarity = longestFirst(RARITY_WORDS).find((w) => bounded(w)) || null;
          star = longestFirst(Object.keys(STAR_RARITY)).find(bounded) || null;
          let rest = frag;
          for (const piece of [setName, rarity, star]) {
            if (piece) {
              rest = rest.replace(
                new RegExp(`(^|[^a-z0-9])${esc(piece)}(?=$|[^a-z0-9])`, "i"),
                "$1 ",
              );
            }
          }
          name = rest.replace(/\s+/g, " ").trim();
        }

        // A FRAGMENT THAT IS ONLY PUNCTUATION IS NOT A CARD. Tim's Collector
        // Chest line ends "... Double Rare , Journey Together - Wailord ...", and
        // a stray separator produced a hit whose card name was "-". It reached
        // data/hits.json and would have shown as a plaque with a dash on it.
        if (!name || !/[a-z0-9]/i.test(name)) { unparsed.push(frag); continue; }

        // The star wins nothing alone, but it FILLS a missing rarity and FLAGS a
        // disagreement. Neither is a guess: both readings are his.
        // The letter code is the Japanese and Korean half of the same mark and is
        // treated identically, so a fragment can carry a mark in either notation.
        const fromStar = star ? STAR_RARITY[star] : code ? CODE_RARITY[code] : null;
        if (fromStar && rarity && fromStar !== rarity) mismatched.push({ frag, star: fromStar, written: rarity });
        const finalRarity = rarity || fromStar || null;

        const setId = setName ? setIdByName.get(setName) : null;
        hits.push({
          card: name,
          // The same fragment read with the card-type word taken out, settled
          // against the set's checklist below and deleted either way.
          ...(cardType && cardType !== name ? { _noType: cardType } : {}),
          ...(listContext ? { printing: listContext } : {}),
          ...(finalRarity ? { rarity: finalRarity } : {}),
          // setDisplayName, not the matched key: the key is lowercased so a typed
          // cell can be looked up, and printing it published eleven captions
          // reading "mega evolution" on one rip page. See the map's own comment.
          ...(setId ? { set: setId, setName: setDisplayName.get(setId) || setName } : {}),
        });
      }
    }

    // A HIT WITH NO SET TAKES THE VIDEO'S, BUT ONLY WHEN THERE IS EXACTLY ONE.
    //
    // Tim writes the set on some rows and not others: "Chaos Rising - Mega
    // Greninja ex - Hyper Rare" on the older ones, "Mega Greninja ex - Hyper
    // Rare" on the newer. Without a set the card cannot be matched to a scan,
    // so 17 hits had no picture on the hall.
    //
    // THIS IS NOT A GUESS ABOUT THE CARD. If the video opened one set's packs,
    // a card that came out of those packs is from that set: the inference is
    // about the PACK, which the video already states, not about the footage.
    //
    // A video tagged with two or more sets is left alone, because there the
    // question really is which pack it fell out of and nothing here can answer
    // it. Those keep no set and simply show no picture, which is the site's
    // standing behaviour for absent data.
    if (setIds.length === 1) {
      for (const h of hits) if (!h.set) {
        h.set = setIds[0];
        if (!h.setName) h.setName = setDisplayName.get(setIds[0]) || SET_NAME_BY_ID.get(setIds[0]) || null;
      }
    }
    // "TRAINER - DAWN" IS A CARD TYPE AND A CARD, AND THE SET'S OWN CHECKLIST
    // IS THE ONLY THING ALLOWED TO SAY SO.
    //
    // This used to stay glued, on the reasoning that Trainer was part of how
    // Tim names the card and dropping it would lose which Dawn. It is the other
    // way round: Phantasmal Flames has exactly one Dawn, it is a Trainer, and
    // it is called "Dawn". "Trainer Dawn" is in no set's checklist, so it
    // resolved to no scan, no number and no price, and on the Costco UPC rip it
    // published four times over beside the same four cards logged correctly off
    // the My Hits tab. Seven rips carried a name like this.
    //
    // NOT A GUESS AND NOT A SPELLING CORRECTION. The word comes out only when
    // the set is known, that set's checklist does NOT contain the glued name,
    // and it DOES contain the shorter one. No checklist, or a checklist that
    // answers either way, leaves his text exactly as he typed it. It runs here
    // rather than in the fragment loop because most of these rows name no set
    // at all and take the video's, which is decided three lines above.
    for (const h of hits) {
      const shorter = h._noType;
      delete h._noType;
      if (!shorter || !h.set) continue;
      const list = await checklistFor(h.set);
      if (!list) continue;
      if (!list.has(String(h.card).toLowerCase()) && list.has(shorter.toLowerCase())) {
        (counted.hitTyped ||= []).push({ id, was: h.card, now: shorter, set: h.set });
        h.card = shorter;
      }
    }
    // A SET THE ROW'S OWN HIT INFO NAMES THAT THE ROW'S OWN SET ANSWER LEAVES
    // OUT, which is one cell of this sheet contradicting another.
    //
    // It is not a hypothetical. The Costco UPC row names five sets across its
    // Hit Info -- Noibat, Brock's Scouting and Blaziken ex are all Journey
    // Together -- and its Sets & Packs cell is EMPTY, so nothing here writes a
    // set answer and the video keeps a FOUR-set override an older run wrote.
    // Journey Together is missing from the rip page's set links while three of
    // its cards sit in the hit band above them, and the override wins forever
    // because the cell that would retire it was never filled.
    //
    // COMPARED AGAINST WHAT THE VIDEO WILL ACTUALLY PUBLISH, not against the
    // cell: where the cell is blank the override is the answer, and the whole
    // point is to see the contradiction the override is causing. A set that
    // came from the video's own single-set fallback cannot disagree with
    // itself, so this can only fire on a row that names a set explicitly.
    const answerSets = new Set(setIds.length || notASet ? setIds : (overrides[id]?.sets || []));
    if (answerSets.size) {
      const missing = [...new Set(hits.map((h) => h.set).filter((s) => s && !answerSets.has(s)))];
      if (missing.length) {
        hitSetGap.push(
          `${id} (row ${rowNo}): Hit Info names ${missing.join(", ")}, which the set answer ` +
            `[${[...answerSets].join(", ")}] does not include` +
            (setIds.length ? "" : ", and Sets & Packs is EMPTY so that answer is an old override rather than a cell")
        );
      }
    }
    if (hits.length) m.hits = hits;
    // Into the file the public pages actually read. `video` is what the writer
    // keys on; everything else matches a My Hits row field for field.
    for (const h of hits) {
      if (!h.card) continue;
      logHits.push({
        video: id,
        card: h.card,
        // NEVER WRITE undefined INTO A FIELD A PAGE PRINTS. A spread of
        // `{ setName: undefined }` still creates the key, and JSON.stringify
        // drops it while an in-memory read does not, so a builder that reads
        // this object before it round trips renders the string "undefined".
        // That is exactly what shipped to three rip pages. Resolve first, then
        // include the key only if there is something in it.
        ...(h.set ? { set: h.set } : {}),
        ...(h.set && (setDisplayName.get(h.set) || h.setName || SET_NAME_BY_ID.get(h.set))
          ? { setName: setDisplayName.get(h.set) || h.setName || SET_NAME_BY_ID.get(h.set) }
          : {}),
        ...(h.rarity ? { rarity: h.rarity } : {}),
        // THE CONTEXT BEFORE THE COLON WAS PARSED AND THEN THROWN AWAY HERE.
        //
        // The colon reader below already refuses to glue "First Partner
        // Illustration Collection (Series 1) Alola Region Promo" onto the front
        // of Rowlet, and keeps it as `printing` instead. That field reached
        // data/manual.json and stopped at this line, so data/hits.json got three
        // bare Pokemon names and the words Tim typed to say WHICH Rowlet were
        // dropped on the floor. Kept verbatim; nothing derives anything from it.
        ...(h.printing ? { printing: h.printing } : {}),
      });
    }
    if (unparsed.length) (counted.hitUnparsed ||= []).push({ id, unparsed });
    if (mismatched.length) (counted.hitMismatch ||= []).push({ id, mismatched });
  }
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

// FOLD THE VIDEO LOG'S OWN HITS INTO data/hits.json, which is what /hall.html,
// the rarity pages and the set guides read.
//
// This runs HERE, at the end, rather than in the My Hits block above, because
// that block executes before the Video Log rows are parsed and logHits would
// still be empty. The symptom was 23 of Tim's 26 hit rows reaching no page:
// the hall showed 19 pictures against 42 plaques.
//
// MERGED, NOT REPLACED, and keyed on video plus card name exactly as the My
// Hits merge is, so filling the same card on both tabs converges instead of
// duplicating, and a card already carrying a scan or a price keeps them.
//
// AND IT COULD NEVER RETIRE A ROW IT HAD WRITTEN, WHICH IS THE BUG UNDER ALL
// THE OTHERS ON THIS PAGE. Add-or-update means every parser mistake this script
// has ever made is permanent, and every FIX to the parser makes the page worse
// rather than better: the corrected name is added and the wrong one stays. The
// Costco UPC rip reached 21 cards for 14 hits and the six-box First Partner rip
// 7 for 3, all of them three generations of this parser's own output stacked up.
//
// So a video whose Hit Info cell was read is now rebuilt from that cell, and a
// row it no longer produces goes, with three protections that decide it:
//
//   1. A row carrying ANY field this parser does not write is another source's
//      row and is never touched. That is the whole My Hits tab, every hand-kept
//      promo with its price and its scan, and everything in the readme.
//   2. A name this parse produces that no existing row has, but which exactly
//      one existing row's name ENDS WITH on a word boundary, is folded into
//      that row rather than added beside it. Tim wrote "Charizard X ex" in the
//      Video Log and "Mega Charizard X ex" on the My Hits tab for the same
//      card in the same video; an exact match always wins first, so this only
//      fires where he wrote a shorter form of a name he had already logged.
//   3. Anything dropped is printed. A retirement is never silent.
const PARSER_FIELDS = new Set(["card", "set", "setName", "rarity", "printing"]);
if (logHits.length) {
  let hf = { videos: {} };
  try { hf = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")); } catch { /* first run */ }
  const byVid = { ...(hf.videos || {}) };
  let added = 0, updated = 0;
  const folded = [], retired = [], deferred = [];
  const parsedFor = new Map();
  for (const h of logHits) {
    if (!parsedFor.has(h.video)) parsedFor.set(h.video, []);
    parsedFor.get(h.video).push(h);
  }
  for (const [video, cards] of parsedFor) {
    const existing = byVid[video] || [];
    const kept = [];
    for (const { video: _v, ...card } of cards) {
      let prev = existing.find((c) => c.card === card.card);
      if (!prev) {
        // ONLY ONTO A ROW ANOTHER SOURCE WROTE. Restricting this to hand-kept
        // rows is load bearing and it was wrong for one run without it: the
        // parser's own stale "Trainer Ruffian" swallowed its own corrected
        // "Ruffian" and the bad name survived the fix that removed it. A row
        // this parser wrote is its to retire, never something to fold onto.
        const tail = ` ${card.card.toLowerCase()}`;
        const near = existing.filter(
          (c) => String(c.card).toLowerCase().endsWith(tail) &&
                 Object.keys(c).some((k) => !PARSER_FIELDS.has(k))
        );
        if (near.length === 1) {
          prev = near[0];
          folded.push(`${video}: "${card.card}" folded into "${prev.card}"`);
        }
      }
      if (prev) updated++; else added++;
      // A HAND-KEPT ROW IS READ, NOT WRITTEN, and the Costco promos are why.
      // Those two carry `promo`, `number`, `img`, `forSet` and a pricecharting
      // price, and they deliberately carry NO set id, because a promo is in no
      // expansion and resolving it against one puts the wrong Oricorio ex on
      // the page. Tim's Video Log shorthand for the same two cards names
      // Phantasmal Flames, which is the product they shipped alongside rather
      // than the set they are in. A first cut of this filled in fields that
      // were merely ABSENT, and it promptly wrote that set id onto both promos
      // and undid the fix the readme in data/hits.json exists to record.
      //
      // So on these rows an absent field is somebody's answer, not a gap. The
      // parse confirms the card is still in the sheet and changes nothing; what
      // it wanted to write is printed instead, so a real disagreement between
      // the two tabs is visible rather than resolved by whoever ran last.
      const hand = prev && Object.keys(prev).some((k) => !PARSER_FIELDS.has(k));
      let merged;
      if (hand) {
        merged = { ...prev };
        for (const [k, v] of Object.entries(card)) {
          if (k === "card" || merged[k] === v) continue;
          deferred.push(`${video} "${prev.card}": sheet says ${k}=${JSON.stringify(v)}, kept ${JSON.stringify(merged[k] ?? null)}`);
        }
      } else {
        merged = { ...(prev || {}), ...card, ...(prev ? { card: prev.card } : {}) };
      }
      kept.push(merged);
    }
    const landed = new Set(kept.map((c) => c.card));
    for (const c of existing) {
      if (landed.has(c.card)) continue;
      const hand = Object.keys(c).some((k) => !PARSER_FIELDS.has(k));
      if (hand) { kept.push(c); continue; }
      retired.push(`${video}: dropped "${c.card}", which this parse no longer produces`);
    }
    byVid[video] = kept;
  }
  if (deferred.length) {
    console.log(`\n${deferred.length} field(s) the sheet would have changed on a hand-kept row, left alone:`);
    for (const d of deferred) console.log("  " + d);
  }
  if (folded.length) {
    console.log(`\n${folded.length} card(s) folded onto a name already logged for the same video:`);
    for (const f of folded) console.log("  " + f);
  }
  if (retired.length) {
    console.log(`\n${retired.length} stale row(s) retired from data/hits.json. READ THIS LIST.`);
    console.log("Each one was written by an older run of this parser and is not in the sheet");
    console.log("today. A row carrying anything this parser does not write is never touched.");
    for (const r of retired) console.log("  " + r);
  }
  hf.videos = byVid;
  await writeFile(join(ROOT, "data/hits.json"), JSON.stringify(hf, null, 2) + "\n");
  console.log(`\nWrote data/hits.json  ${added} card(s) added, ${updated} updated, from the Video Log's Hit Info`);
}

// AN OVERRIDE NO FILLED CELL BACKS IS A PIN NOTHING CAN EVER REACH, AND UNTIL
// NOW NOTHING LOOKED FOR ONE.
//
// The two branches up in the row loop are careful in both directions: a filled
// cell writes an override where it disagrees with the matcher and RETIRES one
// where it agrees, so the sheet is authoritative both ways. Neither branch runs
// on a BLANK cell, deliberately -- blank is the sheet's word for "nobody has
// said yet" and it must not delete an answer. The gap that leaves is the whole
// of this block: an override written by some earlier run, on a row whose cell
// was never filled, is untouched by every import from then on. It wins over
// shared/taxonomy.mjs permanently, and no fix to a tag rule can reach that
// video again. Measured on the sheet as it stands: 210 override fields that no
// filled cell backs, across rows 205 to 319.
//
// THE 204 THAT AGREE WITH THE MATCHER ARE RETIRED, and that is a no-op on what
// the site publishes today: `deriveTags` returns the same answer the override
// was holding, so videos.json does not move. PROVEN RATHER THAN REASONED --
// `node scripts/retag-videos.mjs` reports "0 video(s) would change of 319"
// against the retired file, which is the pipeline's OWN precedence (title and
// description, then playlist titles filling gaps, then this file) rather than
// this block's arithmetic. Re-run it if you change this test. What changes
// is the future -- those videos are back under the tag rules, so the next fix
// to shared/taxonomy.mjs reaches them instead of stopping at a frozen copy of
// what the matcher believed months ago. That is the exact failure the comment
// beside `note()` spends nine lines describing, arriving by a second route.
//
// AN EMPTY ARRAY IS EXEMPT FROM ALL OF THIS AND THAT EXEMPTION IS LOAD BEARING.
// It is not a guess that happens to match, it is a person asserting an absence,
// and it is the one answer a matcher can never reproduce as an answer. Two
// separate things break if it is retired. build-sheet.py reads
// `overrides[id].sets == []` and nothing else to decide whether to hand the
// cell back reading "Not a set (sealed/other)" or blank, and blank is the
// sheet's word for "nobody has said yet", so an answered question comes back
// unanswered -- the exact bug the notASet branch above was written to fix.
// And retag-videos.mjs fills an EMPTY derived list from the video's PLAYLIST
// titles before this file is consulted, so an empty override is the only thing
// standing between "there is no set here" and a set inherited from a playlist
// name. Everything retired below holds a non-empty list the matcher reproduces
// on its own, where that gap filler never runs.
//
// THE ONES THAT DISAGREE ARE REPORTED AND NOT TOUCHED, because this cannot tell
// a hand correction somebody meant from a prefill frozen before a tag rule was
// fixed, and guessing either way is worse than saying so. Six today, and one of
// them is the Costco UPC row, whose four-set answer is what hides Journey
// Together from a video whose own Hit Info names three cards out of it. Fill
// the cell and the row loop settles it in either direction.
const unbackedRetired = [];
const unbackedKept = [];
for (const [vid, o] of Object.entries(overrides)) {
  for (const field of ["sets", "products"]) {
    if (!o || !(field in o) || answered[field].has(vid)) continue;
    const held = o[field];
    if (!Array.isArray(held) || !held.length) continue;   // an assertion of absence, see above
    const auto = deriveTags({ title: live[vid]?.title || "", description: descriptions[vid] || "" });
    if (sameTags(held, auto[field])) {
      delete o[field];
      if (!Object.keys(o).length) delete overrides[vid];
      unbackedRetired.push(`${vid}  ${field}: ${JSON.stringify(held)}, which the tag rules work out on their own`);
    } else {
      unbackedKept.push(`${vid}  ${field}: ${JSON.stringify(held)}, the tag rules say ${JSON.stringify(auto[field])}`);
    }
  }
}
if (unbackedRetired.length) {
  console.log(`\n${unbackedRetired.length} override(s) retired because no filled cell backs them and the tag`);
  console.log("rules already produce the same answer. Nothing the site publishes changes; those");
  console.log("videos are simply back under shared/taxonomy.mjs instead of pinned to a copy of it.");
  for (const s of unbackedRetired.slice(0, 20)) console.log("  " + s);
  if (unbackedRetired.length > 20) console.log(`  ...and ${unbackedRetired.length - 20} more`);
}
if (unbackedKept.length) {
  console.log(`\n${unbackedKept.length} override(s) DISAGREE with the tag rules and no filled cell backs them.`);
  console.log("READ THIS LIST. Each is either a correction somebody meant or a guess frozen before");
  console.log("a tag rule was fixed, and nothing here can tell those apart. Answer the cell in the");
  console.log("workbook and re-import: a filled cell settles it in either direction.");
  for (const s of unbackedKept) console.log("  " + s);
}
if (hitSetGap.length) {
  console.log(`\n${hitSetGap.length} row(s) name a set in Hit Info that the same row's set answer leaves out.`);
  console.log("The cards join to that set's guide and the rip page does not link it, so the two");
  console.log("halves of one row disagree about which packs came open.");
  for (const s of hitSetGap) console.log("  " + s);
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
  packs opened       ${counted.packsStated || 0} stated${counted.packsPerSet ? `, ${counted.packsPerSet} from the Packs of Each Set column` : ""}
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

// THESE THREE WERE COLLECTED AND NEVER PRINTED, WHICH IS THE FAILURE MODE THE
// SECTION ABOVE EXISTS TO ARGUE AGAINST. A Hit Info fragment this parser cannot
// read is a card Tim watched himself pull and wrote down, and it was being
// dropped in total silence: TN7_ZsuRQSI reads "Destined Rivals - Marnie's
// Grimmsnarl ex , Double Black Star - Double Rare", a comma typed where a dash
// belonged, so the rarity split off into a fragment with no card in it. The
// right answer is still to drop it, because there is no honest card name in
// those four words and inventing one is the thing this file never does. Saying
// so out loud is the difference between a decision and a leak.
if (counted.hitUnparsed?.length) {
  const n = counted.hitUnparsed.reduce((a, x) => a + x.unparsed.length, 0);
  console.log(`${n} Hit Info fragment(s) had no card name in them. Nothing was written for these:`);
  for (const { id, unparsed } of counted.hitUnparsed) {
    for (const u of unparsed) console.log(`  ${id}: "${u}"`);
  }
  console.log("Usually a comma typed where a dash belonged, which splits one hit into two.\n");
}
if (counted.hitMismatch?.length) {
  const n = counted.hitMismatch.reduce((a, x) => a + x.mismatched.length, 0);
  console.log(`${n} hit(s) where the star symbol and the written rarity disagree:`);
  for (const { id, mismatched } of counted.hitMismatch) {
    for (const x of mismatched) console.log(`  ${id}: "${x.frag}" reads ${x.star} from the stars, ${x.written} from the words`);
  }
  console.log("The written word was kept. One of the two is a slip.\n");
}
if (counted.hitTyped?.length) {
  console.log(`${counted.hitTyped.length} card name(s) had a card TYPE taken off the front:`);
  for (const x of counted.hitTyped) console.log(`  ${x.id}: "${x.was}" -> "${x.now}"  (${x.set} lists the second and not the first)`);
  console.log("");
}

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
