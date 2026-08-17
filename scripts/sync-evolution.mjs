#!/usr/bin/env node
// Pull every evolution chain from PokeAPI into data/evolutions.json.
//
//   node scripts/sync-evolution.mjs
//
// Feeds /evolution.html and /eevee-evolutions.html. Written to be reusable: the
// species pages under /pokemon/ can render the same chains from the same file
// through shared/evolution.mjs, so the standalone chart and a species page can
// never print two different answers for one Pokemon.
//
// NOT IN build-all.mjs, and it must not be added. Same rule as sync-pokedex.mjs
// and sync-decks.mjs: it is 541 chains plus the lookup tables against somebody
// else's free API, and what it records is a dated read. Refreshing it is a
// deliberate act by a person who then re-checks what the pages claim.
//
// THE FIELD THAT MAKES THIS PAGE POSSIBLE IS version_group. PokeAPI serves an
// evolution-chain as a tree, and every entry in `evolution_details` carries the
// VERSION GROUP that condition belongs to. That is the difference between a
// page that says "Leafeon: use a Leaf Stone" and one that can say a Leaf Stone
// is the Sword and Shield answer while Diamond and Pearl wanted a mossy rock in
// Eterna Forest. Both are true, in different games, and flattening them into
// one line is the exact failure this page exists to avoid. Every route stored
// here keeps its `games` list, and the builders are not allowed to print a
// condition without one.
//
// `is_default` marks the route PokeAPI treats as the canonical current one.
// It is STORED and never used to drop the others.
//
// WHAT THIS DOES NOT CAPTURE, recorded here because the pages have to say it:
//   - Regional forms. PokeAPI's chain is keyed on SPECIES, so Alolan Raichu and
//     Kantonian Raichu are one node. Where a route only exists for a regional
//     form, the chain shows the route and cannot show the form.
//   - Anything the API has no field for. `trigger: "other"` is PokeAPI's own
//     admission that a condition does not fit its schema, and those come out of
//     here with an empty condition rather than an invented one.
//
// POLITENESS AND CACHE. Every response is written under .cache/pokeapi/
// (gitignored), the same directory and the same key shape sync-pokedex.mjs
// uses, so a machine that has already run that script shares the cache. Six at
// a time with an honest User-Agent. A cold run is a couple of minutes; a re-run
// hits nothing. Do not raise CONC.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Run a list of thunks CONC at a time, in order, reporting progress. */
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
        if (++done % 50 === 0) process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }),
  );
  process.stdout.write(`\r  ${label}: ${done}/${items.length}\n`);
  return out;
}

const en = (arr, key = "name") => {
  const hit = (arr || []).find((x) => x.language && x.language.name === "en");
  return hit ? hit[key] : null;
};

// ---------------------------------------------------------------------------
// THE CHAINS. The list endpoint settles how many there are, so a new generation
// needs no edit here.
const list = await get("evolution-chain?limit=1000");
const chainIds = list.results.map((r) => Number(r.url.match(/\/(\d+)\/?$/)[1]));
console.log(`Evolution chains: ${chainIds.length}`);

const rawChains = await pool(chainIds, (id) => get(`evolution-chain/${id}`), "chains  ");

// ---------------------------------------------------------------------------
// THE LOOKUP TABLES. Every slug that ends up on a page is resolved to the name
// PokeAPI publishes for it rather than title-cased here. Title-casing gets
// "water-stone" right and "sinnoh-route-217" wrong, and a location nobody can
// find in their game is the same failure as a wrong level.
const wanted = {
  item: new Set(),
  location: new Set(),
  move: new Set(),
  type: new Set(),
  species: new Set(),
  form: new Set(),
  trigger: new Set(),
};
const versionGroups = new Set();

function scanNode(n) {
  wanted.species.add(n.species.name);
  for (const det of n.evolution_details || []) {
    if (det.item) wanted.item.add(det.item.name);
    if (det.held_item) wanted.item.add(det.held_item.name);
    if (det.location) wanted.location.add(det.location.name);
    if (det.known_move) wanted.move.add(det.known_move.name);
    // USED_MOVE IS NOT KNOWN_MOVE and missing it cost Annihilape its answer.
    // known_move is "already knows this move"; used_move is "has used this move
    // n times", which is the whole of what Rage Fist is doing there. Reading
    // only the first field produced "use a move 20 times" with no move named.
    if (det.used_move) wanted.move.add(det.used_move.name);
    if (det.known_move_type) wanted.type.add(det.known_move_type.name);
    if (det.party_type) wanted.type.add(det.party_type.name);
    if (det.party_species) wanted.species.add(det.party_species.name);
    if (det.trade_species) wanted.species.add(det.trade_species.name);
    if (det.base_form) wanted.form.add(det.base_form.name);
    if (det.evolved_form) wanted.form.add(det.evolved_form.name);
    if (det.trigger) wanted.trigger.add(det.trigger.name);
    if (det.version_group) versionGroups.add(det.version_group.name);
  }
  for (const c of n.evolves_to || []) scanNode(c);
}
for (const c of rawChains) if (c) scanNode(c.chain);

const nameTable = async (kind, slugs, label) => {
  const arr = [...slugs].sort();
  const res = await pool(arr, (s) => get(`${kind}/${s}`), label);
  const m = {};
  arr.forEach((s, i) => {
    m[s] = (res[i] && en(res[i].names)) || null;
  });
  return m;
};

const itemNames = await nameTable("item", wanted.item, "items   ");
const locationNamesRaw = await nameTable("location", wanted.location, "places  ");
// A BARE "Route 20" IS NOT AN ANSWER. PokeAPI's English name for
// kalos-route-20 is "Route 20" and for sinnoh-route-217 it is "Route 217", and
// there is a Route 20 in most regions. The slug carries the region and the
// English name throws it away, so it is put back: nothing is invented, it is
// the source's own slug supplying what the source's own name dropped. Only
// touched where the name is a bare route number, so every other place keeps the
// published name exactly.
const locationNames = {};
for (const [slug, name] of Object.entries(locationNamesRaw)) {
  const m = /^([a-z]+)-route-\d+$/.exec(slug);
  locationNames[slug] =
    name && m && /^Route \d+$/.test(name)
      ? `${m[1].charAt(0).toUpperCase() + m[1].slice(1)} ${name}`
      : name;
}
const moveNames = await nameTable("move", wanted.move, "moves   ");
const typeNames = await nameTable("type", wanted.type, "types   ");
// The FORM names are how regional forms and form-specific results are
// represented at all: PokeAPI keys a chain on the species, so Alolan Raichu and
// Kantonian Raichu are one node, and the only thing that tells them apart is
// base_form / evolved_form on the route. "Alolan Raichu", "Dusk Lycanroc" and
// "Rapid Strike Urshifu" all come from here rather than from de-slugging.
const formNames = await nameTable("pokemon-form", wanted.form, "forms   ");
// Every trigger's own English label, so an exotic one is named by PokeAPI
// rather than invented here. The builders add a plain-English gloss on top and
// say that the gloss is ours.
const triggerNames = await nameTable("evolution-trigger", wanted.trigger, "triggers");

// ---------------------------------------------------------------------------
// VERSION GROUPS TO GAME NAMES. A group is a set of versions ("sword-shield" is
// Sword and Shield), and the English name lives on the VERSION rather than on
// the group, so this is two passes. The result is the only thing that lets a
// page say which games a condition describes.
const vgList = [...versionGroups].sort();
const vgDetail = await pool(vgList, (v) => get(`version-group/${v}`), "vgroups ");
const versionSlugs = new Set();
vgDetail.forEach((g) => (g?.versions || []).forEach((v) => versionSlugs.add(v.name)));
const verSlugs = [...versionSlugs].sort();
const verDetail = await pool(verSlugs, (v) => get(`version/${v}`), "versions");
const versionName = {};
verSlugs.forEach((s, i) => {
  versionName[s] = (verDetail[i] && en(verDetail[i].names)) || null;
});

// "Sword" + "Shield" -> "Sword and Shield". Two names share a group far more
// often than not, and printing both in full is what makes the games readable
// next to a condition instead of a slug.
const games = {};
vgList.forEach((slug, i) => {
  const vs = (vgDetail[i]?.versions || []).map((v) => versionName[v.name]).filter(Boolean);
  const gen = vgDetail[i]?.generation?.name
    ? Number(
        { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }[
          String(vgDetail[i].generation.name).replace(/^generation-/, "")
        ],
      ) || null
    : null;
  let label;
  if (!vs.length) label = null;
  else if (vs.length === 1) label = vs[0];
  else if (vs.length === 2) label = `${vs[0]} and ${vs[1]}`;
  else label = `${vs.slice(0, -1).join(", ")} and ${vs[vs.length - 1]}`;
  // THE DLC GROUPS NAME THEMSELVES TWICE AND IT IS UNREADABLE NEXT TO A
  // CONDITION. PokeAPI's versions for the Isle of Armor are "Sword: The Isle of
  // Armor" and "Shield: The Isle of Armor", so the rule above produces "Sword:
  // The Isle of Armor and Shield: The Isle of Armor", 52 characters to say one
  // expansion. Where every version in a group ends in the same phrase after a
  // colon, that phrase IS the group's name and is used instead. Nothing is
  // invented: it is the source's own words with the repetition removed, and
  // `versions` still carries both in full.
  const tails = vs.map((v) => (v.includes(": ") ? v.slice(v.indexOf(": ") + 2) : null));
  if (vs.length > 1 && tails.every((t) => t && t === tails[0])) label = tails[0];
  games[slug] = { label, versions: vs, gen, order: i };
});

// Order the groups by generation, then by the order PokeAPI lists them, so a
// route's games read oldest first everywhere on the site.
const vgOrder = new Map(
  vgList
    .slice()
    .sort((a, b) => (games[a].gen || 99) - (games[b].gen || 99) || games[a].order - games[b].order)
    .map((s, i) => [s, i]),
);

// ---------------------------------------------------------------------------
// SPECIES DISPLAY NAMES. Taken from data/pokedex.json where it has them, which
// is the file the rest of the site already names Pokemon from, so the chart and
// the species pages cannot spell one differently. Anything the dex does not
// hold (a species outside the National Dex range this site stores) falls back
// to PokeAPI's own English name.
const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8"));
const bySlug = new Map((dex.pokemon || []).map((p) => [p.slug, p]));
const missingSpecies = [...wanted.species].filter((s) => !bySlug.has(s)).sort();
const extraSpecies = await pool(missingSpecies, (s) => get(`pokemon-species/${s}`), "species ");
const extraName = {};
missingSpecies.forEach((s, i) => {
  extraName[s] = (extraSpecies[i] && en(extraSpecies[i].names)) || null;
});

const speciesName = (slug) => bySlug.get(slug)?.name || extraName[slug] || slug;

// ---------------------------------------------------------------------------
// ONE ROUTE. Structured only: no sentence is written here. shared/evolution.mjs
// turns these fields into English, in one place, so this chart and a species
// page cannot phrase the same condition two different ways.
//
// EVERY FIELD PokeAPI POPULATED IS KEPT, including the ones no page prints
// today. Dropping a field here is how a later edit ends up guessing at a
// condition it could have read.
function route(det) {
  const r = {
    trigger: det.trigger?.name || null,
    games: det.version_group?.name || null,
    isDefault: det.is_default === true,
  };
  const put = (k, v) => {
    if (v !== null && v !== undefined && v !== "" && v !== false) r[k] = v;
  };
  put("level", det.min_level);
  put("item", det.item ? itemNames[det.item.name] || det.item.name : null);
  put("held", det.held_item ? itemNames[det.held_item.name] || det.held_item.name : null);
  put("happiness", det.min_happiness);
  put("affection", det.min_affection);
  put("beauty", det.min_beauty);
  put("time", det.time_of_day || null);
  put("place", det.location ? locationNames[det.location.name] || det.location.name : null);
  put("rock", det.near_special_rock);
  put("move", det.known_move ? moveNames[det.known_move.name] || det.known_move.name : null);
  put("usedMove", det.used_move ? moveNames[det.used_move.name] || det.used_move.name : null);
  // NO SLUG FALLBACK ON THESE TWO, unlike every other lookup above.
  // pokemon-form/floette is a 404, so the fallback printed the raw slug
  // "floette" as if it were a form name. A form label is decoration on a line
  // that already names the Pokemon, so a missing one costs a reader nothing and
  // a wrong one costs them trust.
  put("fromForm", (det.base_form && formNames[det.base_form.name]) || null);
  put("toForm", (det.evolved_form && formNames[det.evolved_form.name]) || null);
  put("moveType", det.known_move_type ? typeNames[det.known_move_type.name] || det.known_move_type.name : null);
  put("moveCount", det.min_move_count);
  put("partyOf", det.party_species ? speciesName(det.party_species.name) : null);
  put("partyType", det.party_type ? typeNames[det.party_type.name] || det.party_type.name : null);
  put("tradeFor", det.trade_species ? speciesName(det.trade_species.name) : null);
  put("gender", det.gender);
  put("stats", det.relative_physical_stats);
  put("rain", det.needs_overworld_rain);
  put("upsideDown", det.turn_upside_down);
  put("steps", det.min_steps);
  put("damage", det.min_damage_taken);
  put("multiplayer", det.needs_multiplayer);
  put("region", det.region?.name || det.region || null);
  return r;
}

// A node, with the routes that reach it. `stage` is the depth in the chain, so
// 0 is the thing nothing evolves into.
//
// TWO CLEANUPS HAPPEN HERE AND BOTH ARE ABOUT NOT LYING BY REPETITION.
//
// ONE: base_form and evolved_form are populated even when they name the plain
// species, so Eevee's eight routes all carried fromForm "Eevee". A form label
// that repeats the name beside it is noise, and worse, it makes the genuine
// ones (Alolan Raichu, Dusk Lycanroc) look like the same decoration. They are
// dropped unless they differ from the species name.
//
// TWO: identical routes are collapsed. Gourgeist carries FOUR routes that are
// byte-for-byte the same, one per size of Pumpkaboo, because the size lives in
// the form fields and those four resolved to the same string once the plain
// names were dropped. Printed as-is that is "Trade it. Trade it. Trade it.
// Trade it." Deduplication is on the WHOLE route including its games, so two
// routes that differ only by which games they belong to both survive: that
// difference is the entire point of this file.
function node(n, stage, parentName) {
  const slug = n.species.name;
  const p = bySlug.get(slug);
  const name = speciesName(slug);
  const routes = (n.evolution_details || []).map(route);
  for (const r of routes) {
    if (r.fromForm && parentName && r.fromForm === parentName) delete r.fromForm;
    if (r.toForm && r.toForm === name) delete r.toForm;
  }
  const seen = new Set();
  const unique = routes.filter((r) => {
    const k = JSON.stringify(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    slug,
    name,
    id: p?.id ?? null,
    gen: p?.gen ?? null,
    types: p?.types || [],
    baby: p?.baby ?? false,
    stage,
    routes: unique.sort((a, b) => (vgOrder.get(a.games) ?? 99) - (vgOrder.get(b.games) ?? 99)),
    to: (n.evolves_to || []).map((c) => node(c, stage + 1, name)),
  };
}

const chains = [];
for (let i = 0; i < rawChains.length; i++) {
  const c = rawChains[i];
  if (!c) continue;
  const root = node(c.chain, 0, null);
  chains.push({
    id: chainIds[i],
    // The item that has to be held for the BABY to be produced by breeding, if
    // any. Not an evolution and never drawn as one; kept because it is the
    // reason a baby is in the chain at all.
    babyTriggerItem: c.baby_trigger_item
      ? itemNames[c.baby_trigger_item.name] || c.baby_trigger_item.name
      : null,
    root,
  });
}

// A chain with one node and nothing to evolve into is not a line. They are kept
// in the file, because "does Lapras evolve" is a real question with the answer
// "no", and dropped by the chart page rather than here.
const counts = { single: 0, multi: 0, nodes: 0, routes: 0, branching: 0, noGames: 0 };
const visit = (n, f) => {
  f(n);
  n.to.forEach((c) => visit(c, f));
};
for (const c of chains) {
  let n = 0;
  visit(c.root, (x) => {
    n++;
    counts.nodes++;
    counts.routes += x.routes.length;
    counts.noGames += x.routes.filter((r) => !r.games).length;
    if (x.to.length > 1) counts.branching++;
  });
  if (n === 1) counts.single++;
  else counts.multi++;
}

await writeFile(
  join(ROOT, "data/evolutions.json"),
  JSON.stringify(
    {
      _readme: [
        "Every evolution chain from pokeapi.co. Written by scripts/sync-evolution.mjs.",
        "Do not hand-edit: a re-run overwrites it.",
        "",
        "EVERY ROUTE CARRIES ITS VERSION GROUP in `games`, and the pages are not",
        "allowed to print a condition without naming the games it describes.",
        "Evolution methods genuinely differ between generations (Leafeon wants a",
        "mossy rock in Diamond and Pearl and a Leaf Stone in Sword and Shield),",
        "so flattening the routes into one answer would publish a false one.",
        "`isDefault` marks the route PokeAPI treats as the current canonical one.",
        "It is stored and must never be used to drop the others.",
        "",
        "STRUCTURED FIELDS ONLY. No sentence is written in here. English comes",
        "from shared/evolution.mjs, so the standalone chart and a species page",
        "cannot phrase the same condition two different ways.",
        "",
        "REGIONAL FORMS ARE NOT REPRESENTED. PokeAPI keys a chain on the SPECIES,",
        "so Alolan and Kantonian Raichu are one node. A route that only exists",
        "for a regional form is present; the form it belongs to is not.",
        "",
        "`trigger: other` is PokeAPI's own admission that a condition does not",
        "fit its schema. Those arrive here with no fields and the pages say so",
        "rather than inventing a condition.",
      ],
      source: "pokeapi.co",
      endpoint: "/api/v2/evolution-chain",
      license:
        "PokeAPI data is free to use; Pokemon and Pokemon names are trademarks of The Pokemon Company.",
      checked: new Date().toISOString().slice(0, 10),
      counts: { chains: chains.length, ...counts },
      // slug -> { label, versions, gen, order }. The only place a version group
      // becomes a game name.
      games,
      // PokeAPI's own English label for each trigger, so an exotic one is named
      // by the source. The plain-English gloss on top of these is written in
      // the builder and the page says the gloss is ours.
      triggers: triggerNames,
      chains,
    },
    null,
    1,
  ) + "\n",
);

console.log(`\nWrote data/evolutions.json
  ${chains.length} chains, ${counts.nodes} species, ${counts.routes} routes
  ${counts.multi} chains actually evolve, ${counts.single} are a single species
  ${counts.branching} branch points
  ${Object.keys(games).length} version groups named
  ${counts.noGames} routes carry no version group and will print without a games line`);
