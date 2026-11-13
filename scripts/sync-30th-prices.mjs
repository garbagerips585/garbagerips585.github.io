#!/usr/bin/env node
// TCGplayer market prices for the 30th Celebration, its promos and its jumbos.
//
//   node scripts/sync-30th-prices.mjs
//
// Writes data/30th-prices.json. Then: node scripts/sync-30th-card-data.mjs and
// the build.
//
// WHY THIS SET HAS ITS OWN PRICE SCRIPT. Every other English set guide gets its
// prices from TCGdex's card detail (scripts/sync-cards.mjs), and TCGdex carries
// no prices for the 30th Celebration. TCGplayer lists every card, and
// data/30th-checklist.json already holds each card's TCGplayer product id, so
// this reads each product's price points, the same endpoint TCGplayer's own
// product page reads, and keeps the highest market price across its printings.
//
// UNTIL 13 NOVEMBER 2026 THIS READ PRICECHARTING. PriceCharting requires a paid
// plan to show their prices and the owner declined (shared/no-pricecharting.mjs),
// so the figures are TCGplayer's now, with no graded columns. The `pc` path on
// each row is kept only so a page can link to the card's PriceCharting page for
// graded prices; it carries no number.
//
// About 200 requests at a third of a second each. A product that does not answer
// keeps its last figure; a run where most fail writes nothing.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { localDay } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/30th-prices.json");
const checklist = JSON.parse(await readFile(join(ROOT, "data/30th-checklist.json"), "utf8"));
const binder = JSON.parse(await readFile(join(ROOT, "data/30th-binder.json"), "utf8"));
const prev = JSON.parse(await readFile(OUT, "utf8").catch(() => '{"cards":{},"promos":{}}'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function market(pid) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://mpapi.tcgplayer.com/v2/product/${pid}/pricepoints`, {
        headers: { accept: "application/json", "user-agent": "garbagerips585-build" },
      });
      if (r.ok) {
        const rows = await r.json();
        const got = (Array.isArray(rows) ? rows : [])
          .map((x) => x?.marketPrice)
          .filter((v) => typeof v === "number" && v > 0);
        return got.length ? Math.max(...got) : null;
      }
    } catch { /* retried */ }
    await sleep(1000 * (t + 1));
  }
  return undefined; // did not answer, which is not the same as "no price"
}

const cards = {};
const promos = {};
let asked = 0, failed = 0, priced = 0;
async function row(key, base, pid, prevRow) {
  asked++;
  const m = await market(pid);
  await sleep(330);
  if (m === undefined) failed++;
  const raw = m === undefined ? prevRow?.raw ?? null : m;
  if (typeof raw === "number") priced++;
  return { ...base, pid, raw, ...(prevRow?.pc ? { pc: prevRow.pc } : {}) };
}

for (const c of checklist.cards || []) {
  if (!c.pid) continue;
  const key = `${c.section}|${c.n}`;
  cards[key] = await row(key, { n: c.n, name: c.name, section: c.section }, c.pid, prev.cards?.[key]);
}
for (const [kind, list] of [["promo", binder.promos || []], ["jumbo", binder.jumbos || []]]) {
  for (const p of list) {
    if (!p.pid) continue;
    const n = String(p.n).padStart(3, "0");
    const key = `${kind}|${n}`;
    promos[key] = await row(key, { n, name: p.name, kind }, p.pid, prev.promos?.[key]);
  }
}

if (failed > asked / 2) {
  console.error(`TCGplayer did not answer for ${failed} of ${asked} products. Nothing written.`);
  process.exit(1);
}

await writeFile(OUT, JSON.stringify({
  _readme: [
    "TCGPLAYER MARKET PRICES FOR 30th Celebration, its promos and its jumbos.",
    "Written by scripts/sync-30th-prices.mjs; do not edit by hand, re-run that.",
    "Keyed section|number for cards (sections as in data/30th-checklist.json)",
    "and kind|number for promos and jumbos. `raw` is the highest TCGplayer market",
    "price across the product's printings, ungraded. `pid` is the TCGplayer product.",
    "`pc` is the card's PriceCharting page path, kept only for the outbound",
    "graded-prices link; no PriceCharting number is held or shown (13 November 2026).",
  ],
  source: "TCGplayer market price",
  checked: localDay(),
  counts: { asked, priced, failed },
  cards,
  promos,
}, null, 2) + "\n");
console.log(`Wrote data/30th-prices.json  ${asked} products, ${priced} priced, ${failed} did not answer`);
