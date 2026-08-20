#!/usr/bin/env node
// Pull the National Pokedex from PokeAPI into data/pokedex.json.
//
//   node scripts/sync-pokedex.mjs
//
// Feeds the games and the lore page. Nothing else on the site reads it.
//
// WHY THE WHOLE DEX AND NOT A CURATED SLICE. The lore page is built out of
// SUPERLATIVES, and a superlative you cannot check against the full population
// is just an assertion. "Only two Pokemon are Bug and Steel" is a fact if you
// hold all 1,025 and counted; it is a guess if you hold 150 and assumed. Every
// line on that page is computed from this file, so this file has to be complete
// or the page has to stop making those claims.
//
// NO FLAVOUR TEXT IS STORED, DELIBERATELY. PokeAPI serves the Pokedex entries
// from the games, and those are copyrighted text belonging to The Pokemon
// Company. This keeps the STRUCTURED fields only (genus, types, measurements,
// evolution, catch rate), which are data rather than authored prose, and the
// lore page writes its own sentences from them. It would have been far easier
// to paste the Pokedex entries. It would also have been republishing somebody
// else's copy on a fan site.
//
// TWO ENDPOINTS PER POKEMON. /pokemon-species carries genus, generation,
// legendary flags, colour, habitat, capture rate and what it evolves from;
// /pokemon carries types, height and weight. Neither has the other's fields, so
// a complete record needs both, which is why this is ~2,050 requests.
//
// POLITENESS AND CACHE. PokeAPI asks for a cache and light concurrency, so
// every response is written under .cache/pokeapi/ (gitignored) and a re-run is
// instant and hits nothing. Six at a time with an honest User-Agent. A cold run
// takes a few minutes; do not raise CONC to make it faster.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "pokeapi");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const CONC = 6;
const API = "https://pokeapi.co/api/v2";

await mkdir(CACHE, { recursive: true });

const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, "_");

async function get(path) {
  const file = join(CACHE, `${safe(path)}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* not cached yet */
  }
  const r = await fetch(`${API}/${path}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  const j = await r.json();
  await writeFile(file, JSON.stringify(j));
  return j;
}

/** Run a list of thunks `CONC` at a time, in order, reporting progress. */
async function pool(items, fn, label) {
  const out = new Array(items.length);
  let i = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          out[idx] = await fn(items[idx]);
        } catch (e) {
          out[idx] = null;
          console.log(`  MISS ${label} ${items[idx]}: ${e.message}`);
        }
        if (++done % 100 === 0) process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }),
  );
  process.stdout.write(`\r  ${label}: ${done}/${items.length}\n`);
  return out;
}

// The species list is one request and settles how many there are, so the count
// is read rather than hardcoded and a new generation needs no edit here.
const list = await get("pokemon-species?limit=2000");
const ids = list.results.map((r) => Number(r.url.match(/\/(\d+)\/?$/)[1])).filter((n) => n >= 1);
console.log(`National Pokedex: ${ids.length} species`);

const species = await pool(ids, (id) => get(`pokemon-species/${id}`), "species");
const forms = await pool(ids, (id) => get(`pokemon/${id}`), "forms  ");

// Title case a PokeAPI slug: "mr-mime" -> "Mr Mime", "porygon-z" -> "Porygon Z".
// The dash forms are the display names everywhere on the site, and the games
// compare typed answers against them, so this is the one place they are made.
const NAME_FIX = {
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
  "mr-mime": "Mr. Mime",
  "mime-jr": "Mime Jr.",
  "mr-rime": "Mr. Rime",
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  "ho-oh": "Ho-Oh",
  porygon2: "Porygon2",
  "porygon-z": "Porygon-Z",
  "jangmo-o": "Jangmo-o",
  "hakamo-o": "Hakamo-o",
  "kommo-o": "Kommo-o",
  "type-null": "Type: Null",
  "tapu-koko": "Tapu Koko",
  "tapu-lele": "Tapu Lele",
  "tapu-bulu": "Tapu Bulu",
  "tapu-fini": "Tapu Fini",
  "great-tusk": "Great Tusk",
  "scream-tail": "Scream Tail",
  "brute-bonnet": "Brute Bonnet",
  "flutter-mane": "Flutter Mane",
  "slither-wing": "Slither Wing",
  "sandy-shocks": "Sandy Shocks",
  "iron-treads": "Iron Treads",
  "iron-bundle": "Iron Bundle",
  "iron-hands": "Iron Hands",
  "iron-jugulis": "Iron Jugulis",
  "iron-moth": "Iron Moth",
  "iron-thorns": "Iron Thorns",
  "roaring-moon": "Roaring Moon",
  "iron-valiant": "Iron Valiant",
  "walking-wake": "Walking Wake",
  "iron-leaves": "Iron Leaves",
  "gouging-fire": "Gouging Fire",
  "raging-bolt": "Raging Bolt",
  "iron-boulder": "Iron Boulder",
  "iron-crown": "Iron Crown",
  "chi-yu": "Chi-Yu",
  "chien-pao": "Chien-Pao",
  "ting-lu": "Ting-Lu",
  "wo-chien": "Wo-Chien",
};
const display = (slug) =>
  NAME_FIX[slug] || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const en = (arr, key) => {
  const hit = (arr || []).find((x) => x.language && x.language.name === "en");
  return hit ? hit[key] : null;
};

const dex = [];
for (let k = 0; k < ids.length; k++) {
  const s = species[k];
  const f = forms[k];
  if (!s) continue;
  dex.push({
    id: s.id,
    name: display(s.name),
    slug: s.name,
    // "Seed Pokemon", "Balloon Pokemon". The single best lore hook there is,
    // and it is a label rather than prose.
    genus: (en(s.genera, "genus") || "").replace(/\s*Pok[eé]mon$/, "") || null,
    types: f ? f.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name) : [],
    // PokeAPI ships decimetres and hectograms. Kept in its own units so the
    // page does the conversion once and nothing rounds twice.
    hDm: f ? f.height : null,
    wHg: f ? f.weight : null,
    gen: Number(String(s.generation.name).replace(/^generation-/, "").replace(/^i$/, "1")) || romanGen(s.generation.name),
    legendary: !!s.is_legendary,
    mythical: !!s.is_mythical,
    baby: !!s.is_baby,
    color: s.color ? s.color.name : null,
    habitat: s.habitat ? s.habitat.name : null,
    // 3 is a Beldum, 255 is a Caterpie. Low means hard to catch.
    catch: s.capture_rate,
    evolvesFrom: s.evolves_from_species ? display(s.evolves_from_species.name) : null,
  });
}

function romanGen(n) {
  const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  return map[String(n).replace(/^generation-/, "")] || null;
}

const missing = dex.filter((p) => !p.types.length).length;
await writeFile(
  join(ROOT, "data/pokedex.json"),
  JSON.stringify(
    {
      _readme: [
        "The National Pokedex, from pokeapi.co. Written by scripts/sync-pokedex.mjs.",
        "",
        "STRUCTURED FIELDS ONLY. The Pokedex entry text from the games is",
        "copyrighted and is deliberately NOT stored here. The lore page writes its",
        "own sentences from these fields instead of reprinting somebody else's.",
        "",
        "COMPLETE ON PURPOSE. The lore page makes superlative claims ('only two",
        "Pokemon are Bug and Steel'), and those are only checkable against the",
        "whole population. If this file is ever filtered down, those claims have to",
        "come off the page with it.",
        "",
        "hDm is decimetres and wHg is hectograms, exactly as PokeAPI serves them.",
      ],
      source: "pokeapi.co",
      license: "PokeAPI data is free to use; Pokemon and Pokemon names are trademarks of The Pokemon Company.",
      checked: localDay(),
      count: dex.length,
      pokemon: dex,
    },
    null,
    2,
  ) + "\n",
);

console.log(`\nWrote data/pokedex.json: ${dex.length} species`);
if (missing) console.log(`  ${missing} have no type data and are dropped from type based facts`);
console.log(`  generations ${Math.min(...dex.map((p) => p.gen || 99))} to ${Math.max(...dex.map((p) => p.gen || 0))}`);
console.log(`  ${dex.filter((p) => p.legendary).length} legendary, ${dex.filter((p) => p.mythical).length} mythical`);
