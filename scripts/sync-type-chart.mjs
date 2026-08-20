#!/usr/bin/env node
// The 18 video game types and what they do to each other, from PokeAPI.
//
//   node scripts/sync-type-chart.mjs
//
// Feeds the "what beats it" band on every species page under /pokemon/. Nothing
// else on the site reads it, and in particular /types.html DOES NOT: that page
// is about the ELEVEN CARD TYPES and it goes out of its way to say the card game
// has no type chart at all. These are two different things with the same word
// for them, and the species pages say so in as many words every time they print
// a multiplier.
//
// WHY FETCH A TABLE EVERYBODY KNOWS BY HEART. Because the rule on this site is
// that a published number has a source, and "Water does double damage to Fire"
// typed from memory has none. Eighteen requests, cached, and the file carries
// the endpoint and the read date so a species page can cite them. It is also
// genuinely easy to get wrong from memory: Steel lost its resistance to Dark and
// Ghost in generation VI, and Fairy did not exist before it.
//
// GENERATION IX RELATIONS, WHICH IS WHAT THE PLAIN ENDPOINT SERVES.
// /type/<name> returns the CURRENT relations; past_damage_relations carries the
// superseded ones and is deliberately not stored, because a species page has
// room for one answer and the current games are the one worth having. The stored
// `generation` field is the generation each TYPE was introduced in, not the
// generation of the table.
//
// POLITENESS AND CACHE, same as sync-pokedex.mjs: every response is written
// under .cache/pokeapi/ (gitignored) so a re-run hits nothing, and the
// User-Agent says who is asking. This is eighteen requests, so it is serial.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "pokeapi");
const UA = "GarbageRips585/1.0 (fan site; youtube.com/@GarbageRips585)";
const API = "https://pokeapi.co/api/v2";

// The 18 that are real. PokeAPI also serves "unknown" and "stellar", which are
// not types anything in the Pokedex has: `unknown` is the ??? placeholder from
// generation II and `stellar` is a Terastal state, not a species type. Listing
// them explicitly rather than reading /type is the point, because otherwise a
// future addition to that endpoint would silently appear in a table of
// weaknesses that nothing can actually be weak to.
const TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
  "steel", "fairy",
];

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

const names = (arr) => (arr || []).map((x) => x.name).sort();

const chart = {};
for (const t of TYPES) {
  const j = await get(`type/${t}`);
  const d = j.damage_relations;
  chart[t] = {
    generation: Number(
      { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }[
        String(j.generation.name).replace(/^generation-/, "")
      ] || 0,
    ),
    // Named from the DEFENDER's point of view, which is the way a species page
    // asks the question: a reader wants to know what hurts this Pokemon.
    weakTo: names(d.double_damage_from),
    resists: names(d.half_damage_from),
    immuneTo: names(d.no_damage_from),
    // Kept for the other half of the sentence: what this Pokemon hits hard.
    strongAgainst: names(d.double_damage_to),
  };
  process.stdout.write(`\r  types: ${Object.keys(chart).length}/${TYPES.length}`);
}
process.stdout.write("\n");

await writeFile(
  join(ROOT, "data/type-chart.json"),
  JSON.stringify(
    {
      _readme: [
        "The 18 video game types and their damage relations, from pokeapi.co.",
        "Written by scripts/sync-type-chart.mjs. Do not hand-edit.",
        "",
        "THESE ARE NOT THE CARD TYPES. The Pokemon TCG has eleven types and no",
        "type chart at all; /types.html is the page about those and it says so.",
        "Every species page that prints a multiplier from this file labels it as",
        "the video game chart in the same sentence.",
        "",
        "Relations are named from the DEFENDER's side: weakTo means an attack of",
        "that type does double damage TO this type. A dual type multiplies the",
        "two, which is why the pages compute rather than store the answer.",
        "",
        "Current (generation IX) relations only. past_damage_relations is not",
        "stored: Steel resisted Dark and Ghost until generation VI and a page",
        "with room for one answer should carry the one the current games use.",
      ],
      source: "pokeapi.co",
      endpoint: "https://pokeapi.co/api/v2/type/<name>",
      license:
        "PokeAPI data is free to use; Pokemon and Pokemon names are trademarks of The Pokemon Company.",
      checked: localDay(),
      count: Object.keys(chart).length,
      types: chart,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Wrote data/type-chart.json: ${Object.keys(chart).length} types`);
for (const t of TYPES) {
  console.log(
    `  ${t.padEnd(9)} weak to ${chart[t].weakTo.length}, resists ${chart[t].resists.length}` +
      (chart[t].immuneTo.length ? `, immune to ${chart[t].immuneTo.join(" and ")}` : ""),
  );
}
