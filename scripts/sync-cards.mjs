#!/usr/bin/env node
// Pull the full card list for every English set, with rarity, art and price.
//
//   node scripts/sync-cards.mjs                    cached, near instant
//   node scripts/sync-cards.mjs --force            refetch everything
//   node scripts/sync-cards.mjs --prices           refresh every price
//   node scripts/sync-cards.mjs --prices --rotate  refresh a quarter (nightly)
//
// Writes public/data/cards/<slug>.json per set, plus public/data/card-index.json
// for the search page. build-set-pages.mjs renders the checklist and
// build-cards.mjs renders /cards.html.
//
// WHAT THIS REPLACES. api.pokemontcg.io gave counts but never a card list, and
// it now fails about half its requests. TCGdex has all 218 English sets with
// per-card rarity, images AND TCGplayer market prices in USD refreshed daily,
// which is strictly more than we had. The old API is left in place for
// sync-sets.mjs for now; this does not depend on it.
//
// THE PRICE SHOWN IS THE BEST VARIANT'S. A modern card exists as normal,
// holofoil and reverse holofoil at three different prices, and one number has
// to be picked for a checklist row. It takes the highest market price of the
// variants that exist, because that is the one people mean when they ask what a
// card is worth, and the variant is stored alongside so the page can say which.
// Every variant is kept in `all` so nothing is thrown away.
//
// COST. Roughly 4,500 cards, one request each, because TCGdex's set endpoint
// returns names only and rarity lives on the card. Everything is cached under
// .cache/tcgdex, so a cold run takes a few minutes and every run after it,
// including the nightly, does no network work unless --prices is passed.
//
// --prices refetches card detail without re-reading the card LIST, which is the
// right nightly shape: a checklist never changes, prices change daily. Paired
// with --rotate it does a quarter of the sets per run, so every set is current
// within four days for about 1,100 requests instead of 4,500. That matters
// because TCGdex is a free community project, and because the eight chase cards
// per set that anyone actually watches already refresh daily from TCGplayer.
//
// Every set is still written out on every run either way. Only the FETCHING
// rotates, so no set's file can go stale on disk or disappear.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "tcgdex");
const OUTDIR = join(ROOT, "public/data/cards");
const API = "https://api.tcgdex.net/v2/en";

const FORCE = process.argv.includes("--force");
const PRICES = process.argv.includes("--prices");
// --rotate refreshes a quarter of the sets per run, chosen by the day number, so
// every set's prices are re-read within four days for about 1,100 requests a
// night instead of 4,500. TCGdex is a free community API and the top eight chase
// cards on each set already refresh daily from TCGplayer directly, so hammering
// it nightly for the other 4,473 buys very little.
const ROTATE = process.argv.includes("--rotate");
const DAY = Math.floor(Date.now() / 86400000);
const SLICES = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0;
let cached = 0;

async function getJson(url, key, { refresh = false } = {}) {
  const file = join(CACHE, key.replace(/[^\w.-]/g, "_") + ".json");
  if (!FORCE && !refresh && existsSync(file)) {
    cached++;
    const raw = await readFile(file, "utf8");
    return raw === "null" ? null : JSON.parse(raw);
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "garbagerips585-build" } });
      if (res.ok) {
        const j = await res.json();
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, JSON.stringify(j));
        fetched++;
        return j;
      }
      if (res.status === 404) return null;
    } catch {
      /* retry */
    }
    await sleep(attempt * 1200);
  }
  // A single card failing must not lose the other 4,499. The caller keeps
  // whatever it had and the run reports the gap.
  return undefined;
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

/** Best market price across a card's variants, and which variant it was. */
function bestPrice(pricing) {
  const tp = pricing?.tcgplayer;
  if (!tp) return { price: null, variant: null, all: null };
  const all = {};
  let price = null;
  let variant = null;
  for (const [name, v] of Object.entries(tp)) {
    if (!v || typeof v !== "object") continue; // skips `unit` and `updated`
    const m = typeof v.marketPrice === "number" ? v.marketPrice : null;
    if (m == null) continue;
    all[name] = m;
    if (price == null || m > price) {
      price = m;
      variant = name;
    }
  }
  return { price, variant, all: Object.keys(all).length ? all : null };
}

const VARIANT_LABEL = {
  normal: "Normal",
  holofoil: "Holo",
  "reverse-holofoil": "Reverse holo",
  "1st-edition": "1st edition",
  "1st-edition-holofoil": "1st ed holo",
};

const map = JSON.parse(await readFile(join(ROOT, "data/tcgdex-en.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const bySlug = new Map(sets.map((s) => [s.id, s]));

await mkdir(OUTDIR, { recursive: true });

const warnings = [];
const index = [];
const summary = [];
let totalCards = 0;
let totalPriced = 0;

const entries = Object.entries(map.sets || {});
let refreshedSets = 0;

for (const [slug, tcgdexId] of entries) {
  const i = entries.findIndex(([k]) => k === slug);
  // Which sets get fresh prices this run. Everything still gets READ from cache
  // and rewritten, so no set's file goes stale or missing; only the fetching
  // rotates.
  const refreshNow = PRICES && (!ROTATE || i % SLICES === DAY % SLICES);
  if (refreshNow) refreshedSets++;
  const ours = bySlug.get(slug);
  if (!ours) {
    warnings.push(`${slug}: not in sets.json, skipped`);
    continue;
  }

  const set = await getJson(`${API}/sets/${tcgdexId}`, `en-${tcgdexId}`);
  if (!set) {
    warnings.push(`${slug}: TCGdex has no English set "${tcgdexId}"`);
    continue;
  }

  // The guard that stops a renamed or re-scoped set upstream silently swapping
  // a checklist under a page. Counts were exact for all 23 when pinned.
  const theirs = set.cardCount?.total ?? 0;
  const mine = ours.total || ours.printedTotal || 0;
  if (mine && theirs && mine !== theirs) {
    warnings.push(`${slug}: we say ${mine} cards, TCGdex says ${theirs} for ${tcgdexId}. Check data/tcgdex-en.json.`);
  }

  const list = set.cards || [];
  const details = await pool(list, 8, (c) =>
    getJson(`${API}/cards/${c.id}`, `en-card-${c.id}`, { refresh: refreshNow })
  );

  const cards = [];
  let missing = 0;
  for (let i = 0; i < list.length; i++) {
    const brief = list[i];
    const full = details[i];
    if (full === undefined) missing++;
    const { price, variant, all } = bestPrice(full?.pricing);
    cards.push({
      n: brief.localId || null,
      name: brief.name || full?.name || "",
      rarity: full?.rarity && full.rarity !== "None" ? full.rarity : null,
      cat: full?.category || null,
      img: full?.image || null, // append /low.webp or /high.webp at render time
      price,
      variant: variant ? VARIANT_LABEL[variant] || variant : null,
      all,
      ill: full?.illustrator || null,
    });
  }
  if (missing) warnings.push(`${slug}: ${missing} card(s) would not load, kept without rarity or price`);

  const priced = cards.filter((c) => c.price != null).length;
  totalCards += cards.length;
  totalPriced += priced;

  await writeFile(
    join(OUTDIR, `${slug}.json`),
    JSON.stringify(
      {
        set: slug,
        name: ours.name,
        tcgdexId,
        checked: new Date().toISOString().slice(0, 10),
        source: "TCGdex, prices from TCGplayer",
        total: cards.length,
        priced,
        cards,
      },
      null,
      0
    ) + "\n"
  );

  // The search index is deliberately slim. It is downloaded by anyone who opens
  // /cards.html, so it carries only what a result row shows and nothing else.
  for (const c of cards) {
    index.push([c.name, slug, c.n, c.rarity || "", c.price ?? null]);
  }

  summary.push({ slug, name: ours.name, cards: cards.length, priced });
  console.log(
    `  ${slug.padEnd(21)} ${String(cards.length).padStart(4)} cards, ${String(priced).padStart(4)} priced` +
      (missing ? `, ${missing} failed` : "")
  );
}

await writeFile(
  join(ROOT, "public/data/card-index.json"),
  JSON.stringify({
    checked: new Date().toISOString().slice(0, 10),
    fields: ["name", "set", "number", "rarity", "price"],
    sets: Object.fromEntries(summary.map((s) => [s.slug, s.name])),
    cards: index,
  }) + "\n"
);

console.log(`
Wrote public/data/cards/*.json and card-index.json
  ${summary.length} sets, ${totalCards} cards, ${totalPriced} with a price
  ${fetched} fetched, ${cached} from cache${PRICES ? `\n  prices refreshed for ${refreshedSets} of ${entries.length} sets${ROTATE ? ` (rotating, all ${entries.length} within ${SLICES} days)` : ""}` : ""}`);
if (warnings.length) {
  console.log(`\n${warnings.length} thing(s) to look at:`);
  for (const w of warnings) console.log("  " + w);
}
