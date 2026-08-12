#!/usr/bin/env node
// Turn the Chase Cards and Shops tabs back into site data.
//
//   node scripts/import-cards.mjs ~/Downloads/Chase\ Cards.csv
//   node scripts/import-cards.mjs ~/Downloads/Shops.csv
//
// Works out which tab it is from the header row, so the order does not matter
// and neither does the filename. Export one tab at a time from Google Sheets:
// File > Download > Comma-separated values exports the ACTIVE tab only.
//
// Chase Cards writes data/psa10.json (PSA 10 prices, the only place graded
// prices exist on this site) and data/wanted.json (the hunt list).
// Shops writes data/shops.json.
//
// Blank cells are skipped, so a half-filled sheet is fine and importing twice
// never loses anything you did not touch.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = process.argv[2];
if (!csvPath) {
  console.error(`
Usage: node scripts/import-cards.mjs <path-to-csv>

Export ONE tab at a time from Google Sheets, with that tab open:
  File > Download > Comma-separated values (.csv)
`);
  process.exit(1);
}

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

const rows = parseCsv(await readFile(csvPath, "utf8"));
if (!rows.length) { console.error("Empty CSV."); process.exit(1); }

const header = rows[0].map((h) => String(h).trim().toLowerCase());
const col = (name) => header.indexOf(name.toLowerCase());
const get = (r, i) => (i >= 0 && r[i] != null ? String(r[i]).trim() : "");
const isYes = (s) => /^y(es)?$/i.test(s);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
// "<set-id>-<number>", and set ids contain hyphens, so split from the right.
// A key with no hyphen at all is malformed and must not yield set "15" from
// "151"; return null and let the caller skip the row.
const splitKey = (k) => {
  const at = k.lastIndexOf("-");
  return at > 0 ? { set: k.slice(0, at), number: k.slice(at + 1) } : null;
};
// Strip $ and thousands separators: a price pasted from a price guide arrives
// as "$1,250.00" and Number() gives NaN for that.
const num = (s) => {
  const n = Number(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* ------------------------------------------------------------ Chase Cards - */

if (col("Key") >= 0 && col("PSA 10 USD") >= 0) {
  const iKey = col("Key");
  const idx = {
    set: col("Set"), card: col("Card"), number: col("Number"), rarity: col("Rarity"),
    psa: col("PSA 10 USD"), asOf: col("PSA 10 Checked"), source: col("PSA 10 Source"),
    // The sheet has had a "Raw USD" column all along and nothing read it, so a
    // price typed there was discarded on import and the Most Wanted card fell
    // back to a synced number or showed nothing. A figure someone checked by
    // hand should beat one a script guessed.
    raw: col("Raw USD"),
    wanted: col("Most Wanted"), hall: col("Card Hall of Fame"),
    pulledOn: col("Pulled On"), pulledIn: col("Pulled In Video"),
    why: col("Why I Want It"),
  };

  let psaDoc = { prices: {} };
  try {
    psaDoc = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
  } catch { /* first run */ }
  const prices = {};

  const hall = [];
  let hallDoc = { cards: [] };
  try {
    hallDoc = JSON.parse(await readFile(join(ROOT, "data/hall.json"), "utf8"));
  } catch { /* first run */ }

  let wantedDoc = { cards: [] };
  try {
    wantedDoc = JSON.parse(await readFile(join(ROOT, "data/wanted.json"), "utf8"));
  } catch { /* first run */ }
  const wanted = [];

  const badDates = [];
  const badKeys = [];
  let psaCount = 0;

  for (const r of rows.slice(1)) {
    const key = get(r, iKey);
    if (!key) continue;

    const psa = num(get(r, idx.psa));
    if (psa) {
      const asOf = get(r, idx.asOf);
      if (asOf && !isDate(asOf)) badDates.push(`${key}: "${asOf}"`);
      prices[key] = {
        price: psa,
        asOf: isDate(asOf) ? asOf : null,
        source: get(r, idx.source) || null,
      };
      psaCount++;
    }

    const parts = splitKey(key);
    if (!parts) { badKeys.push(key); continue; }

    // A card can be both: pulled once, still chasing a second copy.
    if (isYes(get(r, idx.hall))) {
      hall.push({
        set: parts.set,
        name: get(r, idx.card),
        number: parts.number,
        rarity: get(r, idx.rarity) || null,
        pulledOn: isDate(get(r, idx.pulledOn)) ? get(r, idx.pulledOn) : null,
        pulledIn: get(r, idx.pulledIn) || null,
      });
    }

    if (isYes(get(r, idx.wanted))) {
      wanted.push({
        set: parts.set,
        name: get(r, idx.card),
        number: parts.number,
        rarity: get(r, idx.rarity) || null,
        note: get(r, idx.why) || null,
        got: isYes(get(r, idx.hall)),
        raw: num(get(r, idx.raw)),
        psa10: psa,
        psa10AsOf: isDate(get(r, idx.asOf)) ? get(r, idx.asOf) : null,
        psa10Source: get(r, idx.source) || null,
      });
    }
  }

  psaDoc.prices = prices;
  await writeFile(join(ROOT, "data/psa10.json"), JSON.stringify(psaDoc, null, 2) + "\n");

  if (wanted.length) {
    wantedDoc.cards = wanted;
    await writeFile(join(ROOT, "data/wanted.json"), JSON.stringify(wantedDoc, null, 2) + "\n");
  }
  // Guarded like the hunt list is: a renamed or deleted "Card Hall of Fame"
  // column makes col() return -1, every row read as "no", and an unguarded
  // write would silently empty a page that had real entries in it.
  if (hall.length || idx.hall >= 0) {
    hallDoc.cards = hall;
    await writeFile(join(ROOT, "data/hall.json"), JSON.stringify(hallDoc, null, 2) + "\n");
  }

  console.log(`
Chase Cards, ${rows.length - 1} rows

  PSA 10 prices      ${psaCount}
  in the Card Hall of Fame  ${hall.length}
  on the hunt list          ${wanted.length}${wanted.length ? "" : "  (nothing marked Most Wanted, so wanted.json was left alone)"}

Wrote data/psa10.json${hall.length || idx.hall >= 0 ? "\nWrote data/hall.json" : "\nSkipped data/hall.json: no Card Hall of Fame column in this export"}${wanted.length ? "\nWrote data/wanted.json" : ""}
`);
  if (badKeys.length) {
    console.log(`Rows with a malformed Key, skipped:\n  ${badKeys.join("\n  ")}\n`);
  }
  if (badDates.length) {
    console.log(`PSA 10 Checked should be YYYY-MM-DD. These were ignored:\n  ${badDates.join("\n  ")}\n`);
  }
  console.log(`Now run:
  node scripts/sync-wanted.mjs && node scripts/build-wanted.mjs
  node scripts/build-hall.mjs
  node scripts/build-set-pages.mjs
`);

/* -------------------------------------------------------------- Set Notes - */

// The Set Notes tab has existed since the first version of the spreadsheet and
// NOTHING has ever read it. The set pages consume data/set-notes.json and no
// importer wrote to it, so anyone filling that tab in was typing into a void:
// up to five columns across 23 sets. This is that missing half.
//
// Only two things live here now. "Still in print" is a genuine fact about a set
// that no API carries, and the fun facts are human. The pack and booster box
// price columns were removed from the sheet rather than wired up, because the
// "Ways to open" band on each set page already shows live TCGplayer prices for
// every sealed product, and a hand-typed price would sit inches from a live one
// it could contradict.
} else if (col("Set ID") >= 0 && (col("Still In Print") >= 0 || col("Fun Fact 1") >= 0)) {
  const idx = {
    id: col("Set ID"),
    inPrint: col("Still In Print"),
    fact1: col("Fun Fact 1"),
    fact2: col("Fun Fact 2"),
  };

  let doc = {};
  try {
    doc = JSON.parse(await readFile(join(ROOT, "data/set-notes.json"), "utf8"));
  } catch { /* first run */ }

  let touched = 0;
  for (const r of rows.slice(1)) {
    const id = get(r, idx.id);
    if (!id) continue;
    const inPrint = get(r, idx.inPrint);
    const facts = [get(r, idx.fact1), get(r, idx.fact2)].filter(Boolean);
    if (!inPrint && !facts.length) continue;   // blank row, leave whatever is there
    const entry = doc[id] || {};
    if (inPrint) entry.inPrint = inPrint;
    if (facts.length) entry.funFacts = facts;
    doc[id] = entry;
    touched++;
  }

  await writeFile(join(ROOT, "data/set-notes.json"), JSON.stringify(doc, null, 2) + "\n");
  console.log(`
Wrote data/set-notes.json
  sets with notes  ${touched}

Next: node scripts/build-set-pages.mjs
`);

/* ------------------------------------------------------------------ Shops - */

} else if (col("Name") >= 0 && col("Website") >= 0) {
  const idx = {
    name: col("Name"), url: col("Website"), area: col("Area"),
    goodFor: col("What They Are Good For"), blurb: col("Blurb"), visited: col("Filmed There"),
  };

  let doc = { shops: [] };
  try {
    doc = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8"));
  } catch { /* first run */ }

  const shops = [];
  for (const r of rows.slice(1)) {
    const name = get(r, idx.name);
    const url = get(r, idx.url);
    if (!name || !url) continue;
    shops.push({
      name,
      url,
      area: get(r, idx.area) || null,
      blurb: get(r, idx.blurb) || null,
      goodFor: get(r, idx.goodFor).split(",").map((x) => x.trim()).filter(Boolean),
      visited: isYes(get(r, idx.visited)),
    });
  }

  doc.shops = shops;
  await writeFile(join(ROOT, "data/shops.json"), JSON.stringify(doc, null, 2) + "\n");
  console.log(`
Shops, ${shops.length} shop${shops.length === 1 ? "" : "s"}

Wrote data/shops.json

Now run:
  node scripts/build-shops.mjs
`);

} else {
  console.error(`
I could not tell which tab this is.

  Chase Cards needs a "Key" column and a "PSA 10 USD" column.
  Shops needs a "Name" column and a "Website" column.
  Set Notes needs a "Set ID" column.

The header row I found was:
  ${rows[0].join(" | ")}

Google Sheets exports the ACTIVE tab, so open the tab you want first.
`);
  process.exit(1);
}
