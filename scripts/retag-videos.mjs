#!/usr/bin/env node
// Re-derive set and product tags for the whole catalogue, offline.
//
//   node scripts/retag-videos.mjs           show what would change
//   node scripts/retag-videos.mjs --write   apply it to public/data/videos.json
//
// WHY THIS EXISTS. Tags are written by sync-youtube.mjs, which needs YT_API_KEY
// and a network round trip for 300+ videos. But a tag is derived from text we
// ALREADY have on disk: the title on each video record and the description in
// data/descriptions.json. So a change to shared/taxonomy.mjs had no way to
// reach videos.json short of a full re-sync, which meant a bad pattern stayed
// shipped until somebody happened to run one.
//
// It matters because a wrong tag is not a cosmetic problem. `v.sets[0]` is what
// ripLabel() names on every tile, what the set pages count as "videos opening
// this set", and what decides whether a rip page is indexable at all.
//
// PRECEDENCE IS COPIED FROM sync-youtube.mjs AND MUST STAY IN STEP:
//   1. tags derived from the video's own title + description
//   2. playlist titles fill GAPS only, never overwrite
//   3. data/overrides.json wins outright
// Getting this order wrong here would silently disagree with the next real
// sync, which would then quietly undo whatever this wrote.
//
// Only `sets` and `products` are touched. `pulls` comes from the rip log via
// data/manual.json and a derived tag must not be allowed to overwrite a deliberate
// answer, which is the same rule sync-youtube.mjs applies.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveTags } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const read = async (p, fallback) => JSON.parse(await readFile(join(ROOT, p), "utf8").catch(() => fallback));

const doc = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const descriptions = await read("data/descriptions.json", "{}");
const overrides = await read("data/overrides.json", "{}");
const { playlists = [] } = await read("public/data/playlists.json", "{}");

// Same gap filler as the sync: a video sitting in "Perfect Order Booster Bundle
// Series" is definitively Perfect Order even when its own title says nothing.
const fromPlaylist = new Map();
for (const p of playlists) {
  const tags = deriveTags({ title: p.title });
  if (!tags.sets.length && !tags.products.length) continue;
  for (const id of p.videoIds || []) {
    const prev = fromPlaylist.get(id) || { sets: [], products: [] };
    for (const s of tags.sets) if (!prev.sets.includes(s)) prev.sets.push(s);
    for (const pr of tags.products) if (!prev.products.includes(pr)) prev.products.push(pr);
    fromPlaylist.set(id, prev);
  }
}

const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
const changes = [];
let lostSets = 0;

for (const v of doc.videos) {
  const auto = deriveTags({ title: v.title || "", description: descriptions[v.id] || "" });
  const inherited = fromPlaylist.get(v.id) || { sets: [], products: [] };
  if (!auto.sets.length) auto.sets = inherited.sets;
  if (!auto.products.length) auto.products = inherited.products.slice(0, 1);
  const manual = overrides[v.id] || {};
  const sets = manual.sets ?? auto.sets;
  const products = manual.products ?? auto.products;

  if (same(sets, v.sets) && same(products, v.products)) continue;
  changes.push({ id: v.id, title: v.title, from: { sets: v.sets, products: v.products }, to: { sets, products } });
  // A video that ends up with no set tag loses its place in the sitemap and is
  // published noindex, so it is called out rather than buried in the diff.
  if ((v.sets || []).length && !sets.length) lostSets += 1;
  if (WRITE) {
    v.sets = sets;
    v.products = products;
  }
}

for (const c of changes) {
  console.log(`${c.id}  ${String(c.title).slice(0, 58)}`);
  console.log(`   sets     ${JSON.stringify(c.from.sets)} -> ${JSON.stringify(c.to.sets)}`);
  if (!same(c.from.products, c.to.products))
    console.log(`   products ${JSON.stringify(c.from.products)} -> ${JSON.stringify(c.to.products)}`);
}

if (WRITE && changes.length) {
  await writeFile(join(ROOT, "public/data/videos.json"), JSON.stringify(doc, null, 2) + "\n");
}
console.log(`\n${changes.length} video(s) ${WRITE ? "retagged" : "would change"} of ${doc.videos.length}`);
if (lostSets) console.log(`  ${lostSets} lost their last set tag and will publish noindex, out of the sitemap`);
if (!WRITE && changes.length) console.log("  Re-run with --write to apply, then run scripts/build-all.mjs");
