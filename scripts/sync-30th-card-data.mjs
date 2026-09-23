/* public/data/cards/30th-celebration.json, WHICH IS THE FILE EVERY OTHER SET
 * GETS FOR FREE.
 *
 *     node scripts/sync-30th-card-data.mjs
 *
 * WHY THIS EXISTS. resolveHits() in build-pages.mjs reads
 * public/data/cards/<set>.json to turn a row in data/hits.json into a card a
 * reader can SEE -- a picture and a price. Without that file a logged hit
 * counts in every tally on the site and renders nowhere: no card on its own rip
 * page, nothing on /hall.html, nothing on /luck.html. That was true of both 30th
 * Celebration hits until this script existed.
 *
 * THE NORMAL PIPELINE CANNOT PRODUCE IT AND THAT IS NOT A GAP I CHOSE.
 * sync-cards.mjs writes those files from TCGdex, keyed by data/tcgdex-en.json --
 * but it SKIPS any slug missing from public/data/sets.json ("not in sets.json,
 * skipped"), and sets.json is written by sync-sets.mjs from api.pokemontcg.io,
 * which still has no 2026 anniversary set. So the set is in TCGdex and cannot
 * reach the pipeline that reads TCGdex. This writes the same shape directly.
 *
 * THREE SOURCES, EACH FOR THE THING IT IS BEST AT:
 *   TCGdex `30th`      the card list, the names and the IMAGE BASE. 158 cards,
 *                      every one with an image, series `me`, localId 3-digit
 *                      zero padded. Took the set 18 September 2026.
 *   data/30th-checklist.json   the RARITY. The set detail carries only id,
 *                      image, localId and name, and the per-card endpoint would
 *                      be 158 requests for a field the checklist already holds
 *                      for all 188. It also means the rarity vocabulary here is
 *                      the same one data/hits.json rows are written in, which is
 *                      what resolveHits matches on.
 *   data/30th-prices.json      the MONEY. PriceCharting guide values, the same
 *                      source every other set guide prints.
 *
 * THE CLASSIC COLLECTION IS NOT IN THIS FILE. TCGdex holds those 30 as a
 * separate set, `30th-c`, with NO images -- every url 404s -- and renumbered
 * 001-030 rather than the original numbering the cards print. A row here would
 * resolve a hit to a picture that does not exist. They are pinned in
 * data/card-shots.json instead, which is the mechanism this site already has
 * for "a real card TCGdex has no scan of".
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/data/cards/30th-celebration.json");
const SLUG = "30th-celebration";

const doc = JSON.parse(await readFile(join(ROOT, "data/30th.json"), "utf8"));
const TD = doc.tcgdex || {};
if (!TD.series || !TD.set) {
  console.error("data/30th.json has no tcgdex series/set. Nothing to build.");
  process.exit(1);
}

const checklist = JSON.parse(await readFile(join(ROOT, "data/30th-checklist.json"), "utf8"));
const prices = JSON.parse(await readFile(join(ROOT, "data/30th-prices.json"), "utf8").catch(() => '{"cards":{}}'));

/* Rarity and price, keyed on the numerator, and the Classic Collection is left
   out of BOTH key spaces on purpose: its numbers are its original sets', so it
   holds two 11s and three 106s and cannot be keyed that way at all. */
const num = (n) => String(n).split("/")[0].replace(/^0+/, "") || "0";
const rarityBy = new Map();
for (const c of checklist.cards || []) {
  if (c.section === "classic") continue;
  rarityBy.set(num(c.n), c.rarity);
}
const priceBy = new Map();
for (const c of Object.values(prices.cards || {})) {
  if (c.section === "classic") continue;
  priceBy.set(num(c.n), c);
}

const res = await fetch(`https://api.tcgdex.net/v2/en/sets/${TD.set}`, {
  headers: { accept: "application/json" },
});
if (!res.ok) {
  console.error(`TCGdex answered ${res.status} for set ${TD.set}. Nothing written.`);
  process.exit(1);
}
const set = await res.json();
const src = set.cards || [];
if (!src.length) {
  console.error(`TCGdex returned no cards for ${TD.set}. Nothing written.`);
  process.exit(1);
}

const cards = [];
let noRarity = 0, noPrice = 0;
for (const c of src) {
  const k = num(c.localId);
  const pr = priceBy.get(k);
  const rarity = rarityBy.get(k) || null;
  if (!rarity) noRarity++;
  if (!pr) noPrice++;
  cards.push({
    n: c.localId,
    name: c.name,
    ...(rarity ? { rarity } : {}),
    /* THE IMAGE IS A BASE WITH NO SUFFIX, which is the shape every other cards
       file uses and the shape build-pages.mjs expects: it appends /low.webp or
       /high.webp itself. Writing a full url here would produce
       ".../low.webp/low.webp" and a broken picture. */
    img: c.image || null,
    ...(pr && typeof pr.raw === "number" ? { price: pr.raw } : {}),
    ...(pr && typeof pr.psa10 === "number" ? { psa10: pr.psa10 } : {}),
    ...(pr && typeof pr.g9 === "number" ? { g9: pr.g9 } : {}),
    ...(pr && pr.pc ? { pcUrl: `https://www.pricecharting.com${pr.pc}` } : {}),
  });
}

/* NEVER WRITE A SHORTER LIST OVER A LONGER ONE. Same rule as the other two 30th
   syncs, and sync-cards.mjs has its own version of it for the same recorded
   reason: a source answering thin must not silently replace a good file. */
const prev = JSON.parse(await readFile(OUT, "utf8").catch(() => "null"));
if (prev && Array.isArray(prev.cards) && cards.length < prev.cards.length) {
  console.error(
    `REFUSING to write ${cards.length} cards over the committed ${prev.cards.length}.`
  );
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({
  _readme: [
    "Written by scripts/sync-30th-card-data.mjs. Do not edit by hand.",
    "Same shape as every other public/data/cards/<set>.json, because",
    "resolveHits() in build-pages.mjs reads them all the same way: `img` is a",
    "TCGdex base with NO suffix and the build appends /low.webp itself.",
    "Card list and images from TCGdex `30th`, rarity from",
    "data/30th-checklist.json, money from data/30th-prices.json.",
    "The 30 Classic Collection cards are NOT here: TCGdex holds them as `30th-c`",
    "with no images at all and renumbered 001-030. They are pinned in",
    "data/card-shots.json instead.",
  ],
  set: SLUG,
  name: doc.set.name.replace(/^Pokemon TCG:\s*/, ""),
  source: "tcgdex 30th for cards and art, pricecharting for money",
  /* localDay(), not the UTC date: a run after 8pm Eastern stamped tomorrow. */
  checked: localDay(),
  /* WHEN THE MONEY WAS READ, which is not when this file was written. Every
     other cards file carries it and shared/graded-price.mjs dates a PSA 10 by
     it; without it the Hall fell back to data/graded.json's own date and
     labelled 30th PSA 10 figures read on 23 September "Aug 23, 2026". */
  pricesChecked: prices.checked || null,
  cards,
}, null, 2) + "\n");

console.log(`Wrote public/data/cards/${SLUG}.json  ${cards.length} cards`);
console.log(`  without a rarity: ${noRarity}`);
console.log(`  without a price:  ${noPrice}`);
console.log(`  with a PSA 10:    ${cards.filter((c) => typeof c.psa10 === "number").length}`);
