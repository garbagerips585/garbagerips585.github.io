#!/usr/bin/env node
// Pull card set facts from the Pokemon TCG API into public/data/sets.json.
//
//   node scripts/sync-sets.mjs            refresh anything stale
//   node scripts/sync-sets.mjs --force    refetch everything
//
// No key needed, but the API rate-limits hard and answers 500/502 rather than
// 429 when it is unhappy, so every request retries with growing backoff and
// raw responses are cached under .cache/. Re-running is cheap; a cold run
// takes a few minutes.
//
// Two things this data cannot tell you, both left to data/set-notes.json:
// whether a set is still in print, and what a booster pack costs. Neither is
// in the API and neither is worth guessing.

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rarityLabel } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "ptcg");
const API = "https://api.pokemontcg.io/v2";
const FORCE = process.argv.includes("--force");

// Our set ids -> the API's. Ours come from shared/taxonomy.mjs and are what
// the videos are tagged with; theirs are internal codes like "me5".
const SET_MAP = {
  "pitch-black": "me5",
  "chaos-rising": "me4",
  "perfect-order": "me3",
  "ascended-heroes": "me2pt5",
  "phantasmal-flames": "me2",
  "mega-evolution": "me1",
  "black-bolt": "zsv10pt5",
  "white-flare": "rsv10pt5",
  "destined-rivals": "sv10",
  "journey-together": "sv9",
  "prismatic-evolutions": "sv8pt5",
  "surging-sparks": "sv8",
  "stellar-crown": "sv7",
  "shrouded-fable": "sv6pt5",
  "twilight-masquerade": "sv6",
  "temporal-forces": "sv5",
  "paldean-fates": "sv4pt5",
  "paradox-rift": "sv4",
  "obsidian-flames": "sv3",
  "151": "sv3pt5",
  "paldea-evolved": "sv2",
  "scarlet-violet": "sv1",
  "pokemon-go": "pgo",
  // Sword & Shield era. Tim rips older packs from shops and shows constantly,
  // and these five had NO way into the site at all: the Set dropdown in the
  // workbook is built from this file's output, so ten videos naming a set in
  // their own title had no cell to record it in and came back untagged every
  // time. Every one verified against the API on name AND card count before it
  // was added here (see data/tcgdex-en.json for the same check on the
  // checklist side); nothing in this map is guessed.
  "crown-zenith": "swsh12pt5",
  "celebrations": "cel25",
  "chilling-reign": "swsh6",
  "shining-fates": "swsh45",
  "rebel-clash": "swsh2",
};

// Rarity buckets, ordered from most to least chase-worthy. The API's rarity
// strings map onto the same ladder the channel talks about.
const RARITY_ORDER = [
  "Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare",
  "Illustration Rare", "Ultra Rare", "Double Rare", "ACE SPEC Rare",
  "Radiant Rare", "Amazing Rare", "Rare Holo", "Rare", "Uncommon", "Common",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(path, { tries = 6 } = {}) {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${API}/${path}`, {
        headers: { "User-Agent": "garbagerips585.com/1.0" },
      });
      if (res.ok) return res.json();
      last = `HTTP ${res.status}`;
      // 500/502 here almost always means rate limiting, not a real fault.
    } catch (e) {
      last = String(e.message || e).slice(0, 60);
    }
    await sleep(2000 + i * 2500);
  }
  throw new Error(`${path} failed after ${tries} tries (${last})`);
}

async function cached(key, fetcher) {
  const file = join(CACHE, `${key}.json`);
  if (!FORCE) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      /* not cached yet */
    }
  }
  const data = await fetcher();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}

/** Highest market price across all printings (normal, holofoil, reverse...). */
function marketPrice(card) {
  const prices = card?.tcgplayer?.prices || {};
  const vals = Object.values(prices)
    .map((p) => (p && typeof p === "object" ? p.market || p.mid : null))
    .filter((n) => typeof n === "number" && n > 0);
  return vals.length ? Math.max(...vals) : 0;
}

async function fetchAllCards(apiId) {
  const out = [];
  let page = 1;
  for (;;) {
    const res = await cached(`${apiId}-p${page}`, () =>
      apiGet(`cards?q=set.id:${apiId}&pageSize=250&page=${page}`)
    );
    out.push(...(res.data || []));
    if (!res.data?.length || out.length >= (res.totalCount || 0)) break;
    page++;
    await sleep(800);
  }
  return out;
}

console.log("Fetching set list...");
const allSets = (await cached("all-sets", () => apiGet("sets?pageSize=250"))).data;
const byApiId = new Map(allSets.map((s) => [s.id, s]));

let notes = {};
try {
  notes = JSON.parse(await readFile(join(ROOT, "data/set-notes.json"), "utf8"));
} catch {
  /* optional */
}

const sets = [];
for (const [setId, apiId] of Object.entries(SET_MAP)) {
  const meta = byApiId.get(apiId);
  if (!meta) {
    console.log(`  ${setId}: no such API set (${apiId}), skipping`);
    continue;
  }
  process.stdout.write(`  ${setId} (${apiId})... `);
  let cards = [];
  try {
    cards = await fetchAllCards(apiId);
  } catch (e) {
    console.log(`cards unavailable: ${e.message}`);
  }

  /**
   * THE CHECKLIST WINS, WHERE THERE IS ONE.
   *
   * These counts came from the Pokemon TCG API while the checklist printed
   * directly underneath them on the same page comes from TCGdex. Two APIs, two
   * vocabularies and two slightly different card lists, so /sets/<id>.html was
   * printing two different answers to "how many Ultra Rares are in this set":
   *
   *   ascended-heroes  14 Ultra Rare + 7 "Mega Attack Rare" here, against 21
   *                    Ultra Rare and no Mega Attack Rare in the checklist
   *   pokemon-go       "Rare Holo VSTAR" here, "Holo Rare VSTAR" there, so
   *                    nothing joined at all
   *   white-flare      four tiers off by one
   *   black-bolt       two tiers off by one
   *
   * The checklist is the authority because it is the list the page actually
   * renders, card by card, so a reader can count it. A number they cannot
   * check against the page beneath it is worse than no number.
   *
   * Counted through rarityLabel so the key matches what the page displays, and
   * so the two spellings of the same rarity collapse into one.
   *
   * Falls back to the API count when no checklist exists yet, which is the
   * case for a set added here before sync-cards.mjs has fetched it.
   */
  const rarities = {};
  let raritiesFrom = "pokemontcg.io";
  let checklist = null;
  try {
    checklist = JSON.parse(
      await readFile(join(ROOT, `public/data/cards/${setId}.json`), "utf8")
    ).cards;
  } catch {
    /* no checklist for this set yet */
  }
  if (checklist?.length) {
    raritiesFrom = "checklist";
    for (const c of checklist) {
      const r = rarityLabel(c.rarity) || "Unlisted";
      rarities[r] = (rarities[r] || 0) + 1;
    }
  } else {
    for (const c of cards) {
      const r = rarityLabel(c.rarity) || "Unlisted";
      rarities[r] = (rarities[r] || 0) + 1;
    }
  }

  /**
   * One vocabulary per page, for a chase card too.
   *
   * Preference order:
   *   1. the checklist's own word for that exact card, matched on number
   *   2. the checklist's spelling of the same words in a different order
   *   3. the API's string, unchanged
   *
   * Step 2 exists because the two sources transpose: "Rare Ultra" against
   * "Ultra Rare", "Rare Holo VSTAR" against "Holo Rare VSTAR". Matching on the
   * SET OF WORDS renames only where the same rarity already appears in this
   * set's checklist under another order, so it cannot invent a rarity the set
   * does not have. "Rare Rainbow" stays as it is on a set whose checklist has
   * no rainbow tier, which is the honest outcome.
   *
   * Step 3 is reached only by a card the checklist does not list at all, which
   * is 14 cards across two sets, all numbered past the checklist's range.
   */
  const chaseRarity = (c, list) => {
    const exact = (list || []).find((x) => String(x.n) === String(c.number));
    if (exact?.rarity) return exact.rarity;
    if (!c.rarity) return null;
    const key = (r) => String(r).toLowerCase().split(/\s+/).sort().join(" ");
    const want = key(c.rarity);
    const match = (list || []).find((x) => x.rarity && key(x.rarity) === want);
    return match ? match.rarity : c.rarity;
  };

  const priced = cards.filter((c) => marketPrice(c) > 0);
  const chase = priced
    .sort((a, b) => marketPrice(b) - marketPrice(a))
    .slice(0, 8)
    .map((c) => ({
      name: c.name,
      number: c.number,
      // SAME VOCABULARY AS THE LADDER ABOVE IT. The rarity counts now come
      // from the checklist, and these cards were still carrying the Pokemon
      // TCG API's word for the same thing, so /sets/ascended-heroes.html said
      // the set holds 21 Ultra Rares and no Mega Attack Rares while two chase
      // cards on the same page were labelled "Mega Attack Rare".
      //
      // Matched on card number, which is what identifies a printing. Falls
      // back to the API's own string when the card is not in the checklist,
      // which beats printing nothing.
      rarity: chaseRarity(c, checklist),
      price: Math.round(marketPrice(c) * 100) / 100,
      image: c.images?.small || null,
      imageLarge: c.images?.large || null,
      url: c.tcgplayer?.url || null,
    }));

  sets.push({
    id: setId,
    apiId,
    name: meta.name,
    series: meta.series,
    released: meta.releaseDate ? meta.releaseDate.replace(/\//g, "-") : null,
    printedTotal: meta.printedTotal ?? null,
    total: meta.total ?? null,
    secretCount:
      meta.total != null && meta.printedTotal != null
        ? Math.max(0, meta.total - meta.printedTotal)
        : null,
    symbol: meta.images?.symbol || null,
    rarities,
    // Which source the counts above came from, so a page can say.
    raritiesFrom,
    cardsSeen: cards.length,
    // Prices are missing entirely for the newest sets: the API carries their
    // card lists before TCGplayer data catches up. Pages must handle zero.
    pricedCount: priced.length,
    pricesAsOf: priced[0]?.tcgplayer?.updatedAt || null,
    chase,
    notes: notes[setId] || null,
  });
  console.log(`${cards.length} cards, ${priced.length} priced`);
  await sleep(600);
}

sets.sort((a, b) => (a.released < b.released ? 1 : -1));
await mkdir(join(ROOT, "public/data"), { recursive: true });
await writeFile(
  join(ROOT, "public/data/sets.json"),
  JSON.stringify({ syncedAt: new Date().toISOString().slice(0, 10), rarityOrder: RARITY_ORDER, sets }, null, 0) + "\n"
);

const noPrices = sets.filter((s) => !s.pricedCount).map((s) => s.id);
console.log(`
Wrote public/data/sets.json  (${sets.length} sets)

  with card data:  ${sets.filter((s) => s.cardsSeen).length}
  with prices:     ${sets.filter((s) => s.pricedCount).length}
`);
if (noPrices.length) {
  console.log(`No market prices yet (normal for freshly released sets):\n  ${noPrices.join(", ")}\n`);
}
console.log("Next: node scripts/build-set-pages.mjs\n");
