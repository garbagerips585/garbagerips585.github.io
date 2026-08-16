#!/usr/bin/env node
// Write the rip label onto every video, once, so nothing has to derive it twice.
//
//   node scripts/stamp-labels.mjs
//
// Runs BEFORE the page builders, because they read the field it writes.
//
// WHY A STAMP RATHER THAN A HELPER CALL. ripLabel() needs three things: the
// video, a set id to name map, and the description. The generators have all
// three. app.js, which renders /videos.html and the collection views in the
// browser, has none of them: it fetches videos.json alone and would need
// sets.json and descriptions.json shipped to the client just to print a title.
// Computing it here puts one `label` on the record, and every consumer, server
// or browser, reads the same string. A second implementation in the browser is
// a second thing to drift.
//
// The field is OMITTED, not set to null, where a label cannot be built
// honestly, so `v.label || v.siteTitle || v.title` falls through cleanly and
// the 41 videos with no set tag keep their YouTube title.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ripLabel } from "../shared/riplabel.mjs";
import { CARD_SETS } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS = join(ROOT, "public/data/videos.json");

const doc = JSON.parse(await readFile(VIDEOS, "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
// `.catch(() => "{}")` HERE WAS A SILENT 41-LABEL LOSS.
//
// This is the ONE place `v.label` is written, and ripLabel takes the pack number
// from the title OR the description. Measured over the 313 videos: 197 carry the
// number in the title, 240 in the description, and 44 in the description ONLY.
// So an unreadable data/descriptions.json drops the "#7" off 41 stamped labels
// across every tile, breadcrumb and set-page link on the site at once, and the
// script still prints "Stamped 286 of 313 videos with a label" as if nothing
// happened. The empty object was standing in for two different events: the file
// not existing yet, and the file being broken.
//
// The file exists and holds 313 entries, so there is no "not yet" case left to
// serve. It is read plainly, and a parse error stops the run.
let descriptions;
try {
  descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8"));
} catch (e) {
  throw new Error(
    `data/descriptions.json could not be read (${e.message}). It supplies the pack number for ` +
      `41 labels that have it nowhere else, and an empty fallback would strip those numbers ` +
      `off every tile on the site without a word. Fix the file rather than removing this check.`
  );
}
// A file that parses but arrives empty is the same loss with a different cause.
if (!descriptions || typeof descriptions !== "object" || !Object.keys(descriptions).length) {
  throw new Error(
    "data/descriptions.json parsed to nothing. 41 rip labels take their pack number from it " +
      "and nowhere else."
  );
}
// TWO SOURCES OF SET NAMES, AND THE SECOND IS NOT OPTIONAL. sets.json only
// covers the English sets pulled from the Pokemon TCG API, so every non-English
// set missed and ripLabel() fell through to its `|| setId` fallback. That put
// the raw id on the tile: 21 videos went out labelled "ja-abyss-eye Japanese
// Pack #9" and "ko-clay-burst Korean Pack". The taxonomy has a real name for
// every one of them, including the language marker, so it is layered
// underneath. sets.json still wins where it has an entry.
const setName = new Map(CARD_SETS.map((s) => [s.id, s.label]));
for (const s of sets) setName.set(s.id, s.name);

let stamped = 0;
let plain = 0;
let withNumber = 0;
for (const v of doc.videos) {
  const label = ripLabel(v, setName, descriptions[v.id]);
  if (label && label !== v.siteTitle) {
    v.label = label;
    stamped += 1;
    if (/#\d/.test(label)) withNumber += 1;
  } else {
    delete v.label;
    plain += 1;
  }
}

await writeFile(VIDEOS, JSON.stringify(doc, null, 2) + "\n");
console.log(`Stamped ${stamped} of ${doc.videos.length} videos with a label`);
console.log(`  ${withNumber} carry a pack number`);
console.log(`  ${plain} fall back to their YouTube title, all missing a set or product tag`);
