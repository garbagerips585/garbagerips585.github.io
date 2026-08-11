#!/usr/bin/env node
// Resolve the hunt list in data/wanted.json against the Pokemon TCG API and
// write public/data/wanted.json for the site.
//
//   node scripts/sync-wanted.mjs           use the cache where possible
//   node scripts/sync-wanted.mjs --force   refetch every card
//
// What it fills in: the card image, the TCGplayer link, and the raw market
// price. What it cannot fill in: the PSA 10 price. No free API carries graded
// prices, so that number stays exactly as a human typed it in data/wanted.json,
// alongside the date it was checked. Nothing here ever invents a price.
//
// Shares the cache and the backoff behaviour of sync-sets.mjs, because the API
// answers 500/502 rather than 429 when it is unhappy.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "ptcg");
const API = "https://api.pokemontcg.io/v2";
const FORCE = process.argv.includes("--force");

// Our set ids -> the API's, same map sync-sets.mjs uses.
const SET_MAP = {
  "pitch-black": "me5", "chaos-rising": "me4", "perfect-order": "me3",
  "ascended-heroes": "me2pt5", "phantasmal-flames": "me2", "mega-evolution": "me1",
  "black-bolt": "zsv10pt5", "white-flare": "rsv10pt5", "destined-rivals": "sv10",
  "journey-together": "sv9", "prismatic-evolutions": "sv8pt5", "surging-sparks": "sv8",
  "stellar-crown": "sv7", "shrouded-fable": "sv6pt5", "twilight-masquerade": "sv6",
  "temporal-forces": "sv5", "paldean-fates": "sv4pt5", "paradox-rift": "sv4",
  "obsidian-flames": "sv3", "151": "sv3pt5", "paldea-evolved": "sv2",
  "scarlet-violet": "sv1", "pokemon-go": "pgo",
};

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
    } catch (e) {
      last = String(e.message || e).slice(0, 60);
    }
    await sleep(2000 + i * 2500);
  }
  throw new Error(`${path} failed after ${tries} tries (${last})`);
}

/** Highest market price across all printings, or 0 when there is no data. */
function marketPrice(card) {
  const prices = card?.tcgplayer?.prices || {};
  const vals = Object.values(prices)
    .map((p) => (p && typeof p === "object" ? p.market || p.mid : null))
    .filter((n) => typeof n === "number" && n > 0);
  return vals.length ? Math.max(...vals) : 0;
}

/** All cards in a set, from the same cache sync-sets.mjs fills. */
async function setCards(apiId) {
  const file = join(CACHE, `${apiId}-p1.json`);
  if (!FORCE) {
    try {
      return JSON.parse(await readFile(file, "utf8")).data || [];
    } catch {
      /* not cached */
    }
  }
  const res = await apiGet(`cards?q=set.id:${apiId}&pageSize=250&page=1`);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(res));
  return res.data || [];
}

const source = JSON.parse(await readFile(join(ROOT, "data/wanted.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const setName = new Map(sets.map((s) => [s.id, s.name]));

const out = [];
const problems = [];

for (const want of source.cards || []) {
  const apiId = SET_MAP[want.set];
  if (!apiId) {
    problems.push(`${want.name}: "${want.set}" is not a set id I know`);
    continue;
  }
  process.stdout.write(`  ${want.name} #${want.number} (${want.set})... `);

  let cards = [];
  try {
    cards = await setCards(apiId);
  } catch (e) {
    console.log(`API unavailable: ${e.message}`);
    problems.push(`${want.name}: could not reach the API`);
  }

  // Match on number first: a name alone is ambiguous when the same Pokemon has
  // an Ultra Rare, a Special Illustration Rare and a Mega Hyper Rare in one set.
  const card =
    cards.find((c) => String(c.number) === String(want.number)) ||
    cards.find((c) => c.name === want.name && /Special Illustration/i.test(c.rarity || ""));

  if (!card) {
    console.log("no such card");
    problems.push(`${want.name} #${want.number}: not found in ${want.set}`);
    continue;
  }
  if (card.name !== want.name) {
    problems.push(`#${want.number} in ${want.set} is "${card.name}", not "${want.name}"`);
  }

  const raw = marketPrice(card);
  out.push({
    set: want.set,
    setName: setName.get(want.set) || want.set,
    name: card.name,
    number: card.number,
    rarity: card.rarity || want.rarity || null,
    note: want.note || null,
    got: !!want.got,
    image: card.images?.small || null,
    imageLarge: card.images?.large || null,
    url: card.tcgplayer?.url || null,
    // Raw comes from the API when it has data, and from the file otherwise, so
    // a hand-checked price still shows for a set the market has not reached.
    raw: raw || (typeof want.raw === "number" ? want.raw : null),
    rawFrom: raw ? "tcgplayer" : typeof want.raw === "number" ? "manual" : null,
    rawAsOf: raw ? card.tcgplayer?.updatedAt || null : null,
    // Never fetched, only ever typed in. See the note in data/wanted.json.
    psa10: typeof want.psa10 === "number" ? want.psa10 : null,
    psa10AsOf: want.psa10AsOf || null,
    psa10Source: want.psa10Source || null,
  });
  console.log(`${card.rarity || "?"}${raw ? `, $${raw}` : ", no market price yet"}`);
  await sleep(400);
}

await mkdir(join(ROOT, "public/data"), { recursive: true });
await writeFile(
  join(ROOT, "public/data/wanted.json"),
  JSON.stringify({ updated: source.updated || null, cards: out }, null, 0) + "\n"
);

const noRaw = out.filter((c) => !c.raw);
const noPsa = out.filter((c) => !c.psa10);
console.log(`
Wrote public/data/wanted.json  (${out.length} cards)
`);
if (noRaw.length) {
  console.log(`No raw market price yet (normal for a set this new):
  ${noRaw.map((c) => c.name).join(", ")}
`);
}
if (noPsa.length) {
  console.log(`No PSA 10 price, and nothing can fetch one. Put a number you have
actually seen into data/wanted.json, with the date and the source:
  ${noPsa.map((c) => `${c.name} #${c.number}`).join("\n  ")}
`);
}
if (problems.length) {
  console.log(`Problems:\n  ${problems.join("\n  ")}\n`);
}
console.log("Next: node scripts/build-wanted.mjs\n");
