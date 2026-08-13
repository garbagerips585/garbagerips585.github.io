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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS = join(ROOT, "public/data/videos.json");

const doc = JSON.parse(await readFile(VIDEOS, "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));
const setName = new Map(sets.map((s) => [s.id, s.name]));

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
