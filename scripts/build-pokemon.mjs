#!/usr/bin/env node
// Generate /pokemon/<slug>.html, one page per SPECIES, plus a Pokedex index.
//
//   node scripts/sync-cards.mjs          (prices for the sets we rip)
//   node scripts/sync-all-printings.mjs  (every printing, every language)
//   node scripts/sync-pokedex.mjs        (the 1,025 species)
//   node scripts/sync-type-chart.mjs     (the 18 video game types)
//   node scripts/sync-species-art.mjs    (the official artwork, mirrored)
//   node scripts/build-pokemon.mjs       (this)
//
// Assembly, not new data. Every number on every page here comes out of a file
// one of those five wrote, and each band on the page cites the one it came from.
//
// ============================================================================
// THIS WENT FROM 51 PAGES TO 1,025 ON 17 AUGUST 2026, AND THE INTERESTING PART
// IS THE 187 OF THEM THAT ARE noindex.
// ============================================================================
//
// The old header on this file argued the opposite and it was right at the time:
// "generating all of them would be a thousand near-empty pages, which is the
// definition of thin content and the fastest way to teach a search engine to
// ignore the whole site. The cap is 30." That reasoning is kept here rather than
// deleted, because it is still the reasoning. What changed is the evidence.
//
// WHAT THE DATA ACTUALLY SAYS, counted rather than assumed:
//
//   every one of the 1,025 species has at least 2 printings in the corpus
//   967 of them have a card in one of the 23 English sets we hold prices for
//   the MEDIAN species has 25 printings across 20 sets, 20 of them with a scan
//
// So "a thousand near-empty pages" was a guess about the tail and the tail is
// not empty. A page for Sandshrew is a wall of 30 real card scans with real
// prices, an evolution line, a type table and a first-printing date. It is not a
// name and a sprite. THAT is why the cap came off.
//
// THE BAR, AND IT IS APPLIED TO INDEXING RATHER THAN TO EXISTENCE.
// A page is built for all 1,025 so that nothing in the Pokedex index dead-ends
// and so a reader who types a name into the site search always lands somewhere
// true. A page is INDEXED only when it clears all three of:
//
//   MIN_PRICED     >= 1 card in the sets we price carrying a market price
//   MIN_EN_SCANS   >= 8 English printings we can actually show a picture of
//   MIN_SETS       >= 6 distinct sets across the whole corpus
//
// The first is the only one that matters and the other two are its guard rails.
// This site's one genuinely unique asset on a Pokemon page is the PRICE, so a
// page that cannot put a sourced figure on a single card has nothing to offer a
// searcher that a hundred better Pokedexes do not already have, and it says
// "noindex,follow" until it can. The scan and set floors stop a page qualifying
// on one lonely priced card with nothing around it: eight scans is a card grid
// that fills a phone screen rather than a stub.
//
// This is the same judgement build-pages.mjs already makes about untagged rips,
// and it is deliberately the same shape: build it, link it, keep it out of the
// index until it earns its way in. Re-run this after any card sync and pages
// promote themselves.
//
// WHAT WAS DELIBERATELY NOT BUILT is written up in the report and the short
// version is: no Pokedex flavour text (copyright, see sync-pokedex.mjs), no
// stats or moves (nothing on this site needs them and they are 1,025 more rows
// of somebody else's table), no type filter on the index, and no per-form pages.
//
// ============================================================================
// FORMS FOLD INTO THE SPECIES, AND THE JOIN IS THE DEX NUMBER
// ============================================================================
//
// Mega Charizard ex, Charizard ex and Charizard are all Charizard; a Trainer's
// Pokemon (Team Rocket's Mewtwo, Iono's Bellibolt) files under the Pokemon; and
// Alolan Vulpix files under Vulpix, because that is what somebody searching the
// name is looking for.
//
// The printings corpus carries a dexId on every card, which is the whole reason
// it was built with one: a Japanese レックウザ and an English Rayquaza are the
// same species to PokeAPI, so a dex number gathers every language and every
// regional form without matching on names at all. Our own priced card data
// carries NO dex id, so it is joined by name through a map derived from the
// corpus itself (English name -> the dex id most of its printings carry). That
// map resolves all 4,325 priced Pokemon cards with nothing left over, checked.
//
// THE SLUG COMES FROM data/pokedex.json, NOT FROM slugify(name), and that is
// not a tidy-up. slugify("Nidoran♀") and slugify("Nidoran♂") are both "nidoran",
// so two species would have written the same file and one would have silently
// won. PokeAPI's own slugs are nidoran-f and nidoran-m. Every one of the 51
// urls this script used to write is unchanged by the switch, checked one by one.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { priceNote, priceFooter, priceRead } from "../shared/card-prices.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, moneyExact, moneyRound, moneyCompact, rarityLabel, imgDims, avifPicture } from "../shared/format.mjs";
// The rip tag vocabulary, so a species' printings can be joined to the rips that
// opened those sets. See `setRipsFor`.
import { CARD_SETS } from "../shared/taxonomy.mjs";
// THE EVOLUTION LINE COMES THROUGH HERE, not straight off data/pokedex.json. See
// the note above familyOf() for what reading the two files separately cost.
import { loadEvolutions, walkChain } from "../shared/evolution.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/pokemon");

// The indexing bar. See the block at the top of this file.
const MIN_PRICED = 1;
const MIN_EN_SCANS = 8;
const MIN_SETS = 6;

// How many get a card picture on the index page's featured band, taken as the
// union of the most valuable and the most printed, so the band itself comes out
// at roughly double this. See `featured` below.
//
// TWELVE, NOT THIRTY, AND THE REASON IS 216KB OF CARD ART. The band used to BE
// the page, so its size was the roster size; now it is a header over a 1,025
// entry index and every tile in it is a card scan the reader may never look at.
// Measured at 1440x900 DPR 1, gzipped, cache off, on-load with no scroll, the
// picked file read off the request log: a 33 tile band put 30 scans and 599.4KB
// of art on the wire for 734.6KB total, and 22 tiles puts 22 and 383.7KB on for
// 517.8KB. THE PHONE DOES NOT MOVE AT ALL, 350.7KB either way, because at 390px
// only 12 tiles are ever inside Chrome's lazy window. So this is a desktop-only
// saving and it is a large one: the index is now 192KB LIGHTER at 1440 than the
// 51 tile page it replaces, while carrying twenty times the links.
const FEATURED = 12;

const readJson = async (p, fallback) => {
  try {
    return JSON.parse(await readFile(join(ROOT, p), "utf8"));
  } catch {
    return fallback;
  }
};

const { videos } = await readJson("public/data/videos.json", { videos: [] });
const dexDoc = await readJson("data/pokedex.json", null);
if (!dexDoc) throw new Error("data/pokedex.json is missing. Run: node scripts/sync-pokedex.mjs");
const DEX = dexDoc.pokemon;

// All three of these are OPTIONAL and the page drops the band rather than
// printing a hole. That is the same contract sync-dex-art.mjs has with
// build-lore.mjs and it is what lets a fresh clone build before the slow
// by-hand syncs have been run.
const typeDoc = await readJson("data/type-chart.json", null);   // sync-type-chart.mjs
const artDoc = await readJson("data/species-art.json", null);   // sync-species-art.mjs
const tcgTypes = await readJson("data/types.json", null);       // human, feeds /types.html
const expansions = (await readJson("public/data/expansions.json", { sets: [] })).sets || [];

/* -------------------------------------------------------------- card prices */

const cards = [];
let checked = null;
// Summed across all 28 sets: a Pokedex page draws printings from many sets at
// once, so its sourcing line has to describe the whole price file.
let priceDoc = null;
for (const f of await readdir(join(ROOT, "public/data/cards"))) {
  if (!f.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
  checked = checked || doc.checked;
  if (!priceDoc)
    priceDoc = {
      priceSource: doc.priceSource,
      pricesChecked: doc.pricesChecked,
      checked: doc.checked,
      pricedBy: { pricecharting: 0, tcgdex: 0 },
    };
  priceDoc.pricedBy.pricecharting += doc.pricedBy?.pricecharting || 0;
  priceDoc.pricedBy.tcgdex += doc.pricedBy?.tcgdex || 0;
  for (const c of doc.cards) cards.push({ ...c, set: doc.set, setName: doc.name });
}

/** "Mega Charizard ex" and "Team Rocket's Mewtwo" both come back "Charizard"/"Mewtwo". */
function speciesOf(name) {
  let n = String(name || "").trim();
  // A Trainer's Pokemon files under the Pokemon. Split on the LAST possessive so
  // two-word owners work too: "Team Rocket's Mewtwo" is one owner, not two.
  if (n.includes("'s ")) n = n.split("'s ").pop();
  n = n.replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)$/, "");
  n = n.replace(/^Mega\s+/, "");
  return n.trim();
}

/* ---------------------------------------------------------------- printings */

/**
 * Cards TCGdex has no scan for.
 *
 * Every image url the site emits was fetched on 14 August 2026 and 101 of the
 * 3,539 answered 404, all of them promos nobody scanned: Sun & Moon Black Star
 * Promos, the e-Card series, TCGP P-A, a few Japanese sets. They all carried
 * onerror="this.remove()", so nothing looked broken. The picture simply
 * vanished and left a gap in the tile, and the site paid for a dead round trip
 * to find that out. Builders skip them up front instead.
 *
 * Clearing `g` here is all it takes. The page already sorts printings into those
 * with a scan and those without, and puts the scanless ones in a text-only list
 * precisely because a card with no picture does not belong in a wall of
 * pictures. This just tells the truth about which ones those are.
 */
const noScanBases = new Set((await readJson("data/no-scan.json", { bases: [] })).bases || []);

const pChecked = (await readJson("public/data/printings/manifest.json", {})).checked;

// dexId -> every printing of that species, and English name -> dexId so our own
// priced cards can be joined on. The name map is built from the corpus rather
// than typed, so a name we have never heard of resolves the same way as one we
// have, and a name two things spell differently cannot silently split a page.
const printings = new Map();
const nameToDex = new Map();
// TCG POCKET IS DIGITAL AND IS NOT A PRINTING, which matters below where the
// page names the first set a Pokemon appeared in. The set names are DERIVED
// rather than typed: every TCGdex image url carries its serie in the path, so
// anything under /tcgp/ is a Pocket card and its set name joins this list. That
// also catches the handful of Pocket cards with no image, which a url test on
// its own would miss.
const pocketSets = new Set();
const rawPrintings = [];
for (const f of await readdir(join(ROOT, "public/data/printings"))) {
  if (!f.endsWith(".json") || f === "manifest.json") continue;
  for (const c of JSON.parse(await readFile(join(ROOT, "public/data/printings", f), "utf8"))) {
    if (c.c !== "Pokemon") continue;
    if (c.g && /assets\.tcgdex\.net\/[a-z-]+\/tcgp\//i.test(c.g)) pocketSets.add(c.s);
    rawPrintings.push(c);
  }
}
for (const c of rawPrintings) {
  if (c.g && noScanBases.has(c.g)) c.g = null;
  if (!c.d) continue;
  if (!printings.has(c.d)) printings.set(c.d, []);
  printings.get(c.d).push(c);
  if (c.u) continue; // untranslated: the printed name is Japanese, not a species name
  const sp = speciesOf(c.n);
  if (!sp) continue;
  if (!nameToDex.has(sp)) nameToDex.set(sp, new Map());
  const tally = nameToDex.get(sp);
  tally.set(c.d, (tally.get(c.d) || 0) + 1);
}
const dexIdFor = (speciesName) => {
  const tally = nameToDex.get(speciesName);
  if (!tally) return null;
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const pricedBy = new Map();
let unresolved = 0;
for (const c of cards) {
  if (c.cat !== "Pokemon") continue;
  const id = dexIdFor(speciesOf(c.name));
  if (!id) {
    unresolved += 1;
    continue;
  }
  if (!pricedBy.has(id)) pricedBy.set(id, []);
  pricedBy.get(id).push(c);
}

/* ------------------------------------------------------- set release dates */

// FIRST ENGLISH PRINTING, and getting this wrong is silent.
//
// The corpus names a set as TCGdex names it and expansions.json names it as the
// Pokemon TCG API does, and the two disagree about 50 English sets. An unmatched
// set simply has no date, which does not look like an error: it looks like a
// LATER set being the earliest one. Charizard came out as "Base Set 2, 2000"
// because the corpus calls the 1999 original "Base Set" and expansions.json
// calls it "Base".
//
// The aliases below are the ones that move a date, each checked against
// expansions.json by hand. The rest of the 50 are Pocket sets (excluded on
// purpose, they are not printings), trainer kits and McDonald's collections,
// none of which is ever the earliest thing a Pokemon appeared in.
const SET_ALIAS = {
  "Base Set": "Base",
  "HeartGold SoulSilver": "HeartGold & SoulSilver",
  Unleashed: "HS—Unleashed",
  Undaunted: "HS—Undaunted",
  Triumphant: "HS—Triumphant",
  "Unseen Forces Unown Collection": "Unseen Forces",
  "Celebrations Classic Collection": "Celebrations: Classic Collection",
};
const setDate = new Map();
for (const s of expansions) if (s.name && s.released) setDate.set(s.name.toLowerCase(), s);
const datedSet = (name) => {
  const key = String(SET_ALIAS[name] || name).toLowerCase();
  return setDate.get(key) || null;
};

/* ------------------------------------------------------------ the species */

const byDexName = new Map(DEX.map((p) => [p.name, p]));
const byDexSlug = new Map(DEX.map((p) => [p.slug, p]));

/* ------------------------------------------- the line, from the shared chains
 *
 * THIS USED TO READ p.evolvesFrom DIRECTLY AND THE TWO PAGES CONTRADICTED EACH
 * OTHER FOR IT. The old comment here said the boundary was deliberate:
 * data/evolutions.json owns the CONDITIONS, data/pokedex.json owns the LINE, and
 * a species page only needs the second. That reasoning is still right about
 * which file answers which question, and it was still how /evolution.html came
 * to list Meltan and Melmetal among the species that never evolve while
 * /pokemon/meltan.html drew "Meltan, which becomes Melmetal" three clicks away.
 * Two files, two readers, no check between them.
 *
 * shared/evolution.mjs reconciles the two now: it compares every species in both
 * files, applies the documented decisions for the ones where PokeAPI contradicts
 * itself, and THROWS on any disagreement it has not been told about. So the line
 * below is the same line the chart draws, by construction rather than by
 * coincidence, and the next time the two sources diverge the build stops instead
 * of publishing both answers.
 *
 * The conditions are still not printed here and that half of the old boundary
 * stands: which stone, what level and which version group genuinely differ
 * between generations, and the note under the line sends a reader to the chart
 * for them.
 */
const EVO = await loadEvolutions();

/** slug -> parent slug, or null, out of the reconciled chains. */
const evoParent = new Map();
for (const c of EVO.chains || []) {
  walkChain(c.root, (node, parent) => evoParent.set(node.slug, parent ? parent.slug : null));
}

const childrenOf = new Map();
for (const p of DEX) {
  const parentSlug = evoParent.get(p.slug);
  if (!parentSlug) continue;
  const parent = byDexSlug.get(parentSlug);
  if (!parent) continue;
  if (!childrenOf.has(parent.name)) childrenOf.set(parent.name, []);
  childrenOf.get(parent.name).push(p);
}

// The species that stand alone, counted once here rather than recomputed inside
// the band. It is the same number /evolution.html prints over its "these do not
// evolve" list, because both now count single-species chains off one structure.
const STANDALONE = DEX.filter((p) => !evoParent.get(p.slug) && !childrenOf.has(p.name)).length;

/**
 * The line, as stages: [[Charmander],[Charmeleon],[Charizard]], and for a
 * branching family [[Eevee],[Vaporeon, Jolteon, ... Sylveon]].
 */
function familyOf(p) {
  let root = p;
  const guard = new Set();
  let up = evoParent.get(root.slug);
  while (up && !guard.has(root.slug)) {
    guard.add(root.slug);
    root = byDexSlug.get(up) || root;
    up = evoParent.get(root.slug);
  }
  const stages = [];
  let level = [root];
  while (level.length) {
    stages.push(level);
    const next = [];
    for (const m of level) next.push(...(childrenOf.get(m.name) || []));
    level = next;
  }
  return stages;
}

/** Rips that name this Pokemon in the title. */
const ripsFor = (() => {
  // Both anchors. With only a leading \b, /\bMew/ matched every Mewtwo rip, and
  // Mew and Mewtwo are both in the dex. The trailing (?![a-z]) allows
  // "Charizard's" and "Charizards" while refusing "Mewtwo".
  //
  // COMPUTED ONCE PER SPECIES, not once per call. At 51 pages calling this twice
  // each was free; at 1,025 it is 1,025 regexes against every video title, twice.
  const cache = new Map();
  return (name) => {
    if (cache.has(name)) return cache.get(name);
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i");
    const hits = videos.filter((v) => re.test(v.title));
    cache.set(name, hits);
    return hits;
  };
})();

/* ------------------------------------------------------------ set-matched rips
 *
 * THE TITLE MATCH ABOVE FIRES ON 39 OF 1,025 PAGES, which is 3.8% of the largest
 * page family on the site, and it was the ONLY route from a species to a video.
 * Measured 17 August 2026 at 390x844 DPR 2: on /pokemon/gible.html the first
 * thing on the page telling a reader a YouTube channel exists at all was an
 * unlabelled footer icon at y=10,078 of a 10,363px page. Twelve screens. The
 * page is a good card page and a stranger could read all of it without learning
 * there is a channel behind it.
 *
 * A title match is the strongest possible signal and stays the top tier, but it
 * only exists when Tim happened to type the name. The second tier is the SET: a
 * species has printings, a rip is tagged with the set it opened, and a rip of a
 * set that prints Gible cards is a genuinely relevant thing to show somebody
 * reading about Gible. That is a fact out of two files rather than a guess, and
 * it takes the family from 39 pages to 918 (89.6%).
 *
 * THE JOIN IS BY SET NAME AND IT IS LOSSY ON PURPOSE. The printings corpus names
 * a set as TCGdex names it ("Rising Rivals"); videos.json tags a rip with a slug
 * from shared/taxonomy.mjs ("ascended-heroes"). Only the sets the channel
 * actually rips are in that vocabulary, so a printing in a set nobody has opened
 * simply finds nothing, which is the correct answer. Matching is on a normalised
 * label rather than punctuation, so "Pokemon GO" and "pokemon-go" meet.
 *
 * WHAT THIS BAND MUST NEVER SAY is that a pack is likely to contain the card.
 * "We ripped sets that print Gible" is a fact; any sentence about how OFTEN one
 * turns up is a pull rate, which this site does not state. See CLAUDE.md.
 */
const slugForSetLabel = (() => {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const m = new Map(CARD_SETS.map((s) => [norm(s.label), s.id]));
  return (label) => m.get(norm(label)) || null;
})();

/** slug -> its human label, for the copy, and slug -> the rips tagged with it. */
const setLabel = new Map(CARD_SETS.map((s) => [s.id, s.label]));
const ripsBySetSlug = new Map();
for (const v of videos) {
  for (const slug of v.sets || []) {
    if (!ripsBySetSlug.has(slug)) ripsBySetSlug.set(slug, []);
    ripsBySetSlug.get(slug).push(v);
  }
}
for (const list of ripsBySetSlug.values()) {
  list.sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")));
}

/**
 * Rips of sets this species is printed in, newest first, ONE PER SET before any
 * set repeats.
 *
 * The round-robin matters. Charmeleon is in eight sets we have ripped and 86 of
 * those rips exist; a straight newest-first slice showed six Ascended Heroes
 * packs and read as a single-set band. Taking the newest of each set first means
 * six rows are six different sets, which is both more interesting and a truer
 * picture of what the channel is.
 *
 * `exclude` drops anything the title match already claimed, so the two tiers
 * never print the same video twice.
 */
function setRipsFor(printingSets, exclude) {
  const slugs = [];
  for (const name of printingSets) {
    const slug = slugForSetLabel(name);
    if (slug && ripsBySetSlug.has(slug) && !slugs.includes(slug)) slugs.push(slug);
  }
  // Busiest set first, so the lead row is from the set we have ripped most.
  slugs.sort((a, b) => ripsBySetSlug.get(b).length - ripsBySetSlug.get(a).length);
  const seen = new Set(exclude.map((v) => v.id));
  const out = [];
  for (let round = 0; out.length < 6 && round < 12; round++) {
    let added = false;
    for (const slug of slugs) {
      const v = (ripsBySetSlug.get(slug) || [])[round];
      if (!v || seen.has(v.id)) continue;
      seen.add(v.id);
      out.push({ ...v, viaSet: slug });
      added = true;
      if (out.length >= 6) break;
    }
    if (!added) break;
  }
  return { rips: out, slugs, total: slugs.reduce((n, s) => n + ripsBySetSlug.get(s).length, 0) };
}

const REGION = {
  1: "Kanto", 2: "Johto", 3: "Hoenn", 4: "Sinnoh", 5: "Unova",
  6: "Kalos", 7: "Alola", 8: "Galar", 9: "Paldea",
};

// Which of the eleven CARD types a video game type is printed as. Read from
// data/types.json, which /types.html is built from, so the two pages cannot
// disagree: that file records the mapping as checked against Bulbapedia's table
// AND against 628 real cards, matching on 18 of 18 game types. Inverted here
// rather than restated.
const gameTypeToCard = new Map();
for (const t of tcgTypes?.types || []) {
  for (const g of t.gameTypes || []) gameTypeToCard.set(String(g).toLowerCase(), t.name);
}

const species = DEX.map((p) => {
  const list = pricedBy.get(p.id) || [];
  const prints = printings.get(p.id) || [];
  const priced = list.filter((c) => typeof c.price === "number");
  const priciest = priced.slice().sort((a, b) => b.price - a.price)[0] || null;
  const cheapest = priced.slice().sort((a, b) => a.price - b.price)[0] || null;
  const enScans = prints.filter((c) => c.l === "en" && c.g).length;
  const sets = new Set(prints.map((c) => c.s));
  const pricedSets = new Set(list.map((c) => c.set));

  // The earliest English set we can put a date on, Pocket excluded.
  let first = null;
  for (const c of prints) {
    if (c.l !== "en" || pocketSets.has(c.s)) continue;
    const s = datedSet(c.s);
    if (s && (!first || s.released < first.released)) first = s;
  }

  const rips = ripsFor(p.name);

  return {
    ...p,
    list,
    priced,
    priciest,
    cheapest,
    prints,
    enScans,
    sets,
    pricedSets,
    first,
    rips,
    setRips: setRipsFor(sets, rips),
    family: familyOf(p),
    art: artDoc?.art?.[p.id] || null,
    // THE BAR. See the header.
    index: priced.length >= MIN_PRICED && enScans >= MIN_EN_SCANS && sets.size >= MIN_SETS,
  };
});
const byId = new Map(species.map((s) => [s.id, s]));

/* ------------------------------------------------- type effectiveness maths */

const TYPE_ORDER = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
  "steel", "fairy",
];
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

/** Defensive multipliers for a type combination, from data/type-chart.json. */
function matchups(types) {
  if (!typeDoc || !types?.length) return null;
  const out = new Map();
  for (const attack of TYPE_ORDER) {
    let m = 1;
    for (const d of types) {
      const row = typeDoc.types[d];
      if (!row) return null;
      if (row.immuneTo.includes(attack)) m = 0;
      else if (row.weakTo.includes(attack)) m *= 2;
      else if (row.resists.includes(attack)) m *= 0.5;
    }
    if (m !== 1) out.set(attack, m);
  }
  const band = (v) => TYPE_ORDER.filter((t) => out.get(t) === v);
  return {
    x4: band(4), x2: band(2), half: band(0.5), quarter: band(0.25), zero: band(0),
  };
}

/* ------------------------------------------------------------------- output */

const list = (arr) =>
  arr.length <= 1
    ? arr.join("")
    : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

const n = (v) => Number(v).toLocaleString("en-US");

// "None" IS NOT A RARITY, it is the corpus saying it holds none for that card,
// and 1,996 Pokemon printings carry it. Printed as a rarity line it reads as a
// claim about the card rather than about our data, which is the same mistake
// "top $0" was on the index page. Show nothing instead.
const rar = (v) => {
  const r = rarityLabel(v);
  return r && r !== "None" ? r : "";
};

// Feet and inches, and pounds, alongside the metric. PokeAPI ships decimetres
// and hectograms and data/pokedex.json keeps them in those units precisely so
// the conversion happens once, here, and nothing rounds twice.
function height(p) {
  const m = p.hDm / 10;
  const inches = Math.round(m * 39.3701);
  return `${m.toFixed(1)}m (${Math.floor(inches / 12)}ft ${inches % 12}in)`;
}
function weight(p) {
  const kg = p.wHg / 10;
  const lb = kg * 2.20462;
  return `${kg.toFixed(1)}kg (${lb < 10 ? lb.toFixed(1) : Math.round(lb)}lb)`;
}

// PAGE-SCOPED CSS, the same arrangement build-proto.mjs uses for the home page's
// three-layout fix, and for the same reason: ui.css was being rewritten by
// another pass while this was written. FOLD IT INTO UI.CSS when that settles.
// Nothing in here is a colour: every value is a token that already exists, so
// the block survives a palette change the way the rest of the site does.
//
// EVERY DRAWN BOX HERE HAS TO STAY UNDER data/species-art.json's 256px, because
// a mirrored portrait has exactly one rendition and the browser will happily
// upscale it. The hero is 128 (exactly 2x at DPR 2) and an evolution stage is 72.
// If you make either bigger, change BOX in sync-species-art.mjs and re-run it
// with --force in the same commit, the way the 192 -> 256 change was made.
//
// `.dx-evo li` NEEDS ITS OWN flex-wrap AND THE OUTER ONE IS NOT ENOUGH. A stage
// of an evolution line is a single <li> holding every Pokemon at that stage, and
// most of them hold one, so wrapping only the outer list looked correct on every
// page anybody thought to open. Eevee's second stage holds EIGHT, which is 8 x
// 112px of tile: measured at 390x844 the document was 964px wide against a
// 390px viewport, with 21 elements past the right edge, and the whole page
// scrolled sideways. It is the branching families that break this rule, so test
// one (Eevee, Wurmple, Tyrogue) rather than a straight three-stage line.
const CSS = `<style>
.dx-top{display:flex;flex-direction:column;gap:var(--s4);align-items:flex-start;margin-top:var(--s4)}
.dx-art{width:128px;height:128px;object-fit:contain;flex:none;background:var(--card);
border:1px solid var(--hair);border-radius:var(--r);padding:4px}
.dx-top .facts-list{margin-top:0;flex:1 1 auto;min-width:0}
.dx-evo{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);margin-top:var(--s4);list-style:none}
.dx-evo li{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2);max-width:100%}
.dx-stage{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;
width:112px;padding:var(--s2);background:var(--card);border:1px solid var(--hair);border-radius:var(--r)}
.dx-stage img{width:72px;height:72px;object-fit:contain}
.dx-stage b{font:700 var(--t-sm)/1.2 var(--body)}
.dx-stage span{font:400 var(--t-micro)/1.2 var(--body);color:var(--ink-2)}
.dx-stage[aria-current]{border-width:3px;border-color:var(--keyline)}
.dx-arrow{font:700 1.1rem/1 var(--body);color:var(--ink-2)}
.dx-eff{display:grid;gap:var(--s2);margin-top:var(--s4);list-style:none}
.dx-eff li{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:baseline;
background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r);padding:10px 12px}
.dx-eff b{font:700 var(--t-sm)/1.4 var(--mono);min-width:3.2em}
.dx-eff span{font:400 var(--t-sm)/1.4 var(--body)}
.dx-find{width:100%;height:48px;padding:0 var(--s4);font:400 var(--t-body)/1 var(--body);
color:var(--ink);background:var(--card);border:2px solid var(--keyline);border-radius:var(--r-pill);margin-top:var(--s4)}
.dx-chips{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s3)}
.dx-count{font:400 var(--t-sm)/1.4 var(--body);color:var(--ink-2);margin-top:var(--s3)}
.dx-gen h3{font:700 var(--t-m)/1.2 var(--body);margin:var(--s5) 0 0}
.dx-list{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s2);margin-top:var(--s3);list-style:none}
.dx-item{display:flex;flex-direction:column;gap:1px;background:var(--card);border:1px solid var(--hair);
border-radius:var(--r-sm);padding:8px 10px;color:var(--ink);text-decoration:none}
.dx-item b{font:700 var(--t-sm)/1.2 var(--body)}
.dx-item span{font:400 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.dx-item:hover{border-color:var(--keyline)}
.is-off{display:none}
@media(min-width:560px){.dx-top{flex-direction:row}}
@media(min-width:640px){.dx-list{grid-template-columns:repeat(3,1fr)}}
@media(min-width:900px){.dx-list{grid-template-columns:repeat(4,1fr)}}
@media(min-width:1100px){.dx-list{grid-template-columns:repeat(5,1fr)}}
</style>`;

const head = ({ title, desc, canonical, ld, noindex }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? `<meta name="robots" content="noindex,follow">\n` : ""}<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-pokemon.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-pokemon.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
<link rel="preconnect" href="https://assets.tcgdex.net" crossorigin>
${FONTS}
${STYLES}
${CSS}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
`;

/** The portrait, or nothing at all. A missing one is never a hole. */
const portrait = (p, px, eager) =>
  p.art
    ? `<img src="${p.art.file}" width="${p.art.w}" height="${p.art.h}" alt="${esc(p.name)}, official artwork"` +
      (eager ? ` decoding="async"` : ` loading="lazy" decoding="async"`) +
      (px ? ` class="${px}"` : "") +
      `>`
    : "";

function pokePage(p) {
  const url = `${SITE}/pokemon/${p.slug}.html`;
  const sorted = p.list
    .slice()
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1) || String(a.n).localeCompare(String(b.n)));
  const types = p.types.map(cap);
  const eff = matchups(p.types);
  const cardType = [...new Set(p.types.map((t) => gameTypeToCard.get(t)).filter(Boolean))];

  // THE DESCRIPTION HAS TO SURVIVE A SPECIES WITH NO PRICE. 58 of them have no
  // card at all in the sets we hold prices for, and the old one read
  // `p.priciest.name` unguarded, which is a build that throws rather than a page
  // that reads badly.
  const desc = p.priciest
    ? `Every ${p.name} card: ${n(p.prints.length)} printings across ${n(p.sets.size)} sets, with market prices for the ` +
      `${n(p.priced.length)} we hold. The priciest is ${p.priciest.name} in ${p.priciest.setName} at ${moneyExact(p.priciest.price)}.`
    : `Every ${p.name} card we can name: ${n(p.prints.length)} printings across ${n(p.sets.size)} sets, plus ${p.name}'s ` +
      `evolution line, types and what beats it.`;

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Pokemon", item: `${SITE}/pokemon/` },
        { "@type": "ListItem", position: 3, name: p.name },
      ],
    },
  ];
  // NO "cards by value" ItemList. All fifty of these pages used to carry one,
  // twenty entries each, and every entry had a `name` and a `position` and
  // nothing to point at. Google will not render an ItemList whose items have no
  // `url` or `item`, so that was a thousand dead ListItems across the section.
  //
  // There is no target to give them. A printing is a `<div class="chase-card">`
  // here with no id and no link, most of the sets it comes from have no set
  // page of their own, and /cards.html?q= is a client-side search, not a page
  // about the card. Add the block back the day a card has its own URL.

  /* ------------------------------------------------------------ dex facts */
  // OUR OWN SENTENCES, NOT THE POKEDEX ENTRY. The flavour text in the games is
  // copyrighted and data/pokedex.json deliberately does not store it. These are
  // written from the structured fields, the same discipline /lore.html keeps.
  const facts = [];
  if (p.genus) facts.push(`<b>The ${esc(p.genus)} Pokemon.</b> ${esc(p.name)} is #${p.id} in the National Pokedex.`);
  // ONLY A SINGLE-TYPE POKEMON GETS THE CARD-TYPE SENTENCE, and this is not
  // caution, it is what the measurement in data/types.json actually covers. That
  // file's method says in as many words: "for every card whose Pokemon has
  // exactly ONE video game type". A card carries ONE type, so for a dual type
  // the mapping cannot say which of the two wins. Charizard rendered as
  // "printed as Fire and Colorless on a card", which is not a thing any card is.
  facts.push(
    `<b>${types.length === 1 ? "Type" : "Types"}.</b> ${esc(list(types))} in the video games` +
      (types.length === 1 && cardType.length
        ? `, which is printed as ${esc(cardType[0])} on a card. <a href="/types.html">The eleven card types</a>.`
        : types.length > 1
          ? `. A card only ever carries one type, so <a href="/types.html">which one it is printed as</a> depends on the card.`
          : "."),
  );
  facts.push(
    `<b>Generation ${p.gen}${REGION[p.gen] ? `, ${REGION[p.gen]}` : ""}.</b> ` +
      (p.legendary
        ? "Flagged Legendary in the Pokedex."
        : p.mythical
          ? "Flagged Mythical in the Pokedex, the event-only category."
          : p.baby
            ? "A baby Pokemon, the category breeding brought in with Generation 2."
            : `One of the ${n(DEX.filter((d) => d.gen === p.gen).length)} species that generation introduced.`),
  );
  facts.push(`<b>Size.</b> ${height(p)} and ${weight(p)}.`);
  facts.push(
    `<b>Capture rate ${p.catch} of 255.</b> ` +
      (p.catch <= 10
        ? "One of the hardest things in the games to catch."
        : p.catch >= 190
          ? "About as easy to catch as the games get."
          : "Middling, as capture rates go."),
  );
  if (p.first)
    facts.push(
      `<b>First English card.</b> ${esc(p.first.name)}, ${esc(longDate(p.first.released) || p.first.released)}.`,
    );

  /* ----------------------------------------------------------- evolution */
  const evoBand = (() => {
    const stages = p.family;
    const size = stages.reduce((a, s) => a + s.length, 0);
    if (size < 2) {
      return `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Evolution</p>
    <h2>${esc(p.name)} does not <span class="hl">evolve</span></h2>
    <p class="lede" style="max-width:40em">It has no pre-evolution and nothing it becomes, which puts it with the
      ${n(STANDALONE - 1)} other species in the Pokedex that
      stand alone. <a href="/evolution.html">The evolution chart</a> lists every one of them.</p>
    <p class="price-note">Evolution line from the National Pokedex, pokeapi.co, read ${esc(longDate(dexDoc.checked) || dexDoc.checked)}.</p>
  </div>
</section>`;
    }
    const stageHtml = stages
      .map(
        (row) =>
          `<li>${row
            .map((m) => {
              const s = byId.get(m.id);
              const inner =
                `${portrait(s, "", false)}<b>${esc(m.name)}</b><span>#${m.id} &bull; ${n((s?.prints || []).length)} cards</span>`;
              return m.id === p.id
                ? `<span class="dx-stage" aria-current="true">${inner}</span>`
                : `<a class="dx-stage" href="/pokemon/${esc(m.slug)}.html">${inner}</a>`;
            })
            .join("")}</li>`,
      )
      .join(`<li class="dx-arrow" aria-hidden="true">&rarr;</li>`);
    const words = stages
      .map((row) => list(row.map((m) => m.name)))
      .join(", which becomes ");
    return `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Evolution</p>
    <h2>The <span class="hl">${esc(stages[0].map((m) => m.name).join(" / "))}</span> line</h2>
    <p class="lede" style="max-width:44em">${esc(words)}. Each one has its own page and its own cards.</p>
    <ul class="dx-evo">${stageHtml}</ul>
    <p class="price-note">Evolution line from the National Pokedex, pokeapi.co, read
      ${esc(longDate(dexDoc.checked) || dexDoc.checked)}. What each evolution actually takes differs between
      generations, so it is not stated here. Card counts are every printing we can name, in every language.</p>
  </div>
</section>`;
  })();

  /* ------------------------------------------------------- what beats it */
  const effBand = (() => {
    if (!eff) return "";
    // A COMMA, NOT AN EM DASH, AND IT IS 945 OF THEM. This wrote
    // "Ice &mdash; double weakness" on every one of the 625 species pages that
    // has a doubled row, which is a straight breach of CLAUDE.md's no-em-dashes
    // rule and was invisible to every sweep run for it: the sweeps grepped for
    // the CHARACTER and the page carries the ENTITY, so the tree read clean
    // while a reader saw a dash. Search for both spellings when checking this.
    const row = (label, arr, note) =>
      arr.length
        ? `<li><b>${label}</b><span>${esc(list(arr.map(cap)))}${note ? `, ${note}` : ""}</span></li>`
        : "";
    const rows =
      row("x4", eff.x4, "double weakness") +
      row("x2", eff.x2) +
      row("&frac12;x", eff.half) +
      row("&frac14;x", eff.quarter, "double resistance") +
      row("0x", eff.zero, "no effect at all");
    if (!rows) return "";
    return `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>In the video games</p>
    <h2>What beats <span class="hl">${esc(p.name)}</span></h2>
    <p class="lede" style="max-width:44em">Damage taken by a ${esc(types.join(" / "))} Pokemon, computed from the
      type chart. Everything not listed does normal damage.</p>
    <ul class="dx-eff">${rows}</ul>
    <p class="price-note"><b>This is the video game chart, not the card game.</b> The Pokemon TCG has eleven types and
      no type chart at all: Weakness and Resistance are printed on each individual card, and two cards of the same
      Pokemon can print different ones. <a href="/types.html">What the card actually says</a>.
      Type relations from pokeapi.co, read ${esc(longDate(typeDoc.checked) || typeDoc.checked)}.</p>
  </div>
</section>`;
  })();

  /* ---------------------------------------------------------- priced band */
  const pricedBand = sorted.length
    ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Priciest first</p>
    <h2>Every <span class="hl">${esc(p.name)}</span> we price</h2>
    <!-- THE aria-label CARRIES THE SET AND NUMBER, and it has to.
         It was "Enlarge <name>" alone, which on a Pokemon with several
         printings named every button on the page identically: charizard.html
         had NINE buttons all called "Enlarge Charizard ex", each opening a
         different card. Tabbing through them sounded like nothing was moving.
         Worse, aria-label REPLACES the visible text rather than adding to it,
         so the set and number the button already shows in .rr were thrown away
         for anyone listening (WCAG 2.5.3 wants the visible label inside the
         accessible name). Same strings as the <img alt> right below. -->
    <div class="chase-grid">
      ${sorted
        .map(
          (c) => `<button class="chase-card" type="button"
        data-img="${esc(c.img ? c.img + "/high.webp" : "")}"
        data-name="${esc(c.name)}" data-rarity="${esc(rar(c.rarity))}"
        data-number="${esc(c.n || "")}" data-price="${esc(moneyCompact(c.price))}"
        data-set="${esc(c.setName)}"
        aria-label="Enlarge ${esc(c.name)}, ${esc(c.setName)}${c.n ? " " + esc(c.n) : ""}">
        ${c.img ? avifPicture(`<img src="${esc(c.img)}/low.webp" onerror="this.remove()" alt="${esc(c.name)} ${esc(c.n || "")}, ${esc(c.setName)}" loading="lazy"${imgDims(c.img + "/low.webp")}>`) : ""}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(c.setName)} &bull; ${esc(c.n || "")}</div>
        ${rar(c.rarity) ? `<div class="rr">${esc(rar(c.rarity))}</div>` : ""}
        ${typeof c.price === "number" ? `<div class="pr">${moneyCompact(c.price)}</div>` : ""}
      </button>`,
        )
        .join("\n      ")}
    </div>
    <p class="price-note">${esc(priceNote(priceDoc))} Where a card
      comes as a normal, holo and reverse holo at different prices, the figure is the priciest of them. Prices move
      daily, so treat these as a ballpark. <a href="/cards.html?q=${encodeURIComponent(p.name)}">Search every card</a>.</p>
  </div>
</section>`
    : "";

  /* ------------------------------------------------------ everywhere else */
  const elsewhereBand = (() => {
    // Printings we do NOT price: every other set the card appears in, English or
    // Japanese. Deduped against what is already shown above by set and number so
    // a card we price is never listed twice.
    //
    // IT SITS AFTER THE PRICED BAND, AND HAS TO. "Every other Charizard printing"
    // is defined by subtraction, so it only parses once the reader has seen what
    // it is other THAN. This block was first on the page for a long while, which
    // opened every Pokemon page on the cards we know least about, buried the
    // priced grid the page is actually for, and made the dedupe comment above a
    // lie about its own output.
    const have = new Set(sorted.map((c) => `${c.setName}|${String(c.n).replace(/^0+/, "")}`));
    const extra = p.prints
      .filter((c) => !have.has(`${c.s}|${String(c.i).replace(/^0+/, "")}`))
      .sort((a, b) => String(a.s).localeCompare(String(b.s)) || String(a.i).localeCompare(String(b.i)));
    if (!extra.length) return "";

    // TWO GROUPS, TWO LAYOUTS. A tile in .chase-grid is as tall as the row it
    // lands in, and that row is sized by a 245x342 card scan. A printing with no
    // scan carries three short lines and nothing else, so it was being stretched
    // to the height of the picture beside it: about 300px of empty card at
    // 1024px, and 447px at 1440px, measured. Splitting them is the fix rather
    // than shrinking the pictures, because the two rows are different things:
    // one is a wall of cards, the other is an index of names.
    const withScan = extra.filter((c) => c.g);
    const noScan = extra.filter((c) => !c.g);
    // TCG POCKET IS LABELLED, because it is not a printing. Those cards only
    // exist inside a phone app: there is no piece of cardboard to buy, grade or
    // pull, and a page that quietly mixes them into "every printing" is telling
    // a collector something false. Same tile, honest label.
    const tag = (c) =>
      [pocketSets.has(c.s) ? "TCG Pocket, digital" : "", c.l === "en" ? "" : c.l === "ja" ? "Japanese" : "Chinese"]
        .filter(Boolean)
        .join(" &bull; ");

    const count = !noScan.length
      ? `${n(extra.length)} more from sets we do not price, English and Japanese, every one with a scan.`
      : !withScan.length
        ? `${n(extra.length)} more from sets we do not price, English and Japanese. No scan for any of them, so this
      is a list of names rather than a wall of cards.`
        : `${n(extra.length)} more from sets we do not price, English and Japanese. ${n(withScan.length)} have a scan and
      are pictured below. The other ${n(noScan.length)} we can name but not show.`;

    return `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Everywhere else</p>
    <h2>Every other <span class="hl">${esc(p.name)}</span> printing we could name</h2>
    <p class="lede" style="max-width:40em">${count} No price on these: we only quote what we can source.
      Printings whose name we could not translate are left out rather than shown under a name we guessed at.</p>
    ${withScan.length ? `<div class="chase-grid">
      ${withScan
        .map(
          (c) => `<div class="chase-card is-flat">
        ${avifPicture(`<img src="${esc(c.g)}/low.webp" onerror="this.remove()" alt="${esc(c.n)} ${esc(c.i)}, ${esc(c.s)}" loading="lazy" decoding="async"${imgDims(c.g + "/low.webp")}>`)}
        <div class="nm">${esc(c.n)}</div>
        <div class="rr">${esc(c.s)} &bull; ${esc(c.i)}</div>
        ${rar(c.r) ? `<div class="rr">${esc(rar(c.r))}</div>` : ""}
        ${tag(c) ? `<div class="rr">${tag(c)}</div>` : ""}
      </div>`,
        )
        .join("\n      ")}
    </div>` : ""}
    ${noScan.length ? `${withScan.length ? `<h3 class="flat-h">Named, with no scan to show</h3>` : ""}
    <ul class="flat-list">
      ${noScan
        .map(
          (c) => `<li class="flat-item">
        <b>${esc(c.n)}</b>
        <span>${esc(c.s)} &bull; ${esc(c.i)}</span>
        ${[rar(c.r), tag(c)].filter(Boolean).length ? `<span>${[rar(c.r), tag(c)].filter(Boolean).join(" &bull; ")}</span>` : ""}
      </li>`,
        )
        .join("\n      ")}
    </ul>` : ""}
    <p class="price-note">Card list from the TCGdex card database, read ${esc(longDate(pChecked) || pChecked)}.
      A snapshot, not a live feed.</p>
  </div>
</section>`;
  })();

  /* ------------------------------------------------------------- watch band
   *
   * The one band on this page whose job is the channel rather than the cards.
   *
   * IT MOVED UP, from dead last to directly after the priced band, and the
   * placement is the larger half of this change. As the last section it sat at
   * y=27,195 on charizard.html and at y=10,078-equivalent on a page that had no
   * band at all: correct content nobody reaches. After the priced grid is where
   * the page has just delivered what the reader came for (the cards and what
   * they cost) and before the long tail of untranslated printings and the video
   * game type table, neither of which is why anybody arrived.
   *
   * IT IS TEXT, NOT TILES, AND THAT IS DELIBERATE. See the note beside the
   * chrome imports at the top of this file: these pages ship without
   * packplayer.js and packs.css on purpose, so a video tile added here would
   * NAVIGATE rather than play in place, which reads as a bug. Pack art would
   * also put 40 to 158KB per tile onto 918 pages to decorate a list whose rows
   * are already a reason to click. The rows link to the rip page, which is where
   * the player and the pack wrapper live. Every click stays on the site.
   *
   * NO OUTBOUND LINK IN HERE. The CTA goes to /videos.html, filtered. A reader
   * who wants the channel has Subscribe in the menu and the footer; this band's
   * job is to prove there is something worth subscribing TO.
   */
  const watchBand = (() => {
    const titled = p.rips;
    const { rips: viaSet, slugs, total } = p.setRips;
    if (!titled.length && !viaSet.length) return "";

    // What the channel IS, in one sentence, because this page is somebody's
    // first contact with it. A search for "gible cards" does not come with any
    // idea of who wrote the page, and "Rochester pack openings" means nothing
    // without the word Pokemon in front of it.
    const whoWeAre = `<p class="lede" style="max-width:40em">Garbage Rips 585 is a Pokemon card pack opening
      channel out of Rochester, New York. We film every pack we open, hit or no hit.</p>`;

    // THE SET LABEL EARNS ITS LINE: 95 of the 301 set-tagged rips do not name
    // their set in the title ("8 Packs and NO HITS?!" is Pitch Black), so
    // without it a third of these rows are a joke with no context.
    //
    // `.rip-meta` RATHER THAN `.rr`, and the first attempt used `.rr` and looked
    // broken. `.rr` is only ever declared as `.chase-card .rr`, so a bare one
    // inherits body copy: the set name came out LARGER than the title it was
    // annotating and ran straight on from it. `.rip-meta` is declared on its own
    // and is mono, .78rem, ink-soft, which is what a caption should be. Its
    // margin-bottom is inert here because the span stays inline; a <div> would
    // apply it and open a 20px hole in every row. The <br> is what puts the
    // label on its own line without any new CSS, which ui.css being off limits
    // is the reason for.
    const rows = (list, withSet) => `<ul class="poke-rips">
      ${list
        .map(
          (v) => `<li><a href="/${esc(v.path)}">${esc(v.title)}</a>${
            withSet && v.viaSet && setLabel.has(v.viaSet)
              ? `<br><span class="rip-meta">${esc(setLabel.get(v.viaSet))}</span>`
              : ""
          }</li>`,
        )
        .join("\n      ")}
    </ul>`;

    // TIER ONE: the rip named this Pokemon. Strongest possible reason to watch,
    // and it is what this band said before, kept word for word.
    if (titled.length) {
      return `
<section class="band tight" id="watch">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We went hunting <span class="hl">${titled.length}</span> time${titled.length === 1 ? "" : "s"}</h2>
    ${whoWeAre}
    ${rows(titled.slice(0, 8))}
    ${titled.length > 8 ? `<p class="price-note"><a href="/videos.html?q=${encodeURIComponent(p.name)}">All ${titled.length} rips mentioning ${esc(p.name)}</a>.</p>` : ""}
    <div class="btn-row" style="margin-top:16px">
      <a class="btn btn-yt" href="/videos.html?q=${encodeURIComponent(p.name)}">Watch the ${esc(p.name)} rips</a>
    </div>
  </div>
</section>`;
    }

    // TIER TWO: no rip names it, but we have opened the sets it is printed in.
    // THE SENTENCE IS ABOUT WHAT WE OPENED, NEVER ABOUT ODDS. "Packs that print
    // Gible cards" is a fact from two files. "Packs where you might pull one" is
    // a pull rate wearing a hat, and this site does not state those.
    const lead = setLabel.get(slugs[0]) || "";
    return `
<section class="band tight" id="watch">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See these packs opened</p>
    <h2>We have ripped <span class="hl">${n(total)}</span> pack${total === 1 ? "" : "s"} from
      ${slugs.length === 1 ? "the set" : `the ${n(slugs.length)} sets`} that print
      <span class="hl">${esc(p.name)}</span></h2>
    ${whoWeAre}
    ${rows(viaSet, true)}
    <div class="btn-row" style="margin-top:16px">
      <a class="btn btn-yt" href="/videos.html?set=${esc(slugs[0])}">Watch every ${esc(lead)} rip</a>
    </div>
  </div>
</section>`;
  })();

  return (
    head({
      // No " | Garbage Rips 585" suffix here, and that is deliberate. Measured
      // 17 August 2026 in headless Chrome at 20px Arial: with the suffix all 844
      // of these ran 648-736px against Google's ~580px desktop cut, so the brand
      // was truncated away on every single one and bought nothing. Without it
      // they run 468-558px and the whole title renders. og:site_name below still
      // declares the brand, which is what Google reads for the site-name line.
      title: `${p.name} Cards and Prices: Every Printing We Could Find`,
      desc,
      canonical: url,
      ld,
      noindex: !p.index,
    }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">#${p.id} &bull; ${esc(list(types))} &bull; Generation ${p.gen}${REGION[p.gen] ? `, ${REGION[p.gen]}` : ""}</span>
    <h1>${esc(p.name)} <span class="hl">cards</span></h1>
    <p class="lede" style="max-width:34em">Every ${esc(p.name)} card we could find, what the ones we price are worth,
      and everything else worth knowing about ${esc(p.name)}.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/pokemon/">Pokemon</a> / ${esc(p.name)}</p>
    <div class="dx-top">
      ${portrait(p, "dx-art", true)}
      <ul class="facts-list">
        ${facts.map((f) => `<li>${f}</li>`).join("\n        ")}
      </ul>
    </div>
    <div class="facts">
      <div class="fact"><div class="n">${n(p.prints.length)}</div><div class="l">Printing${p.prints.length === 1 ? "" : "s"} we can name</div></div>
      <div class="fact"><div class="n">${n(p.sets.size)}</div><div class="l">Set${p.sets.size === 1 ? "" : "s"} they appear in</div></div>
      ${p.priciest ? `<div class="fact"><div class="n">${moneyRound(p.priciest.price)}</div><div class="l">Priciest one we price</div></div>` : ""}
      ${p.cheapest ? `<div class="fact"><div class="n">${moneyExact(p.cheapest.price)}</div><div class="l">Cheapest way in</div></div>` : ""}
      ${/* THE ONLY MARK ABOVE THE FOLD-ISH THAT SAYS THERE IS A CHANNEL.
             The facts row lands around y=1,900 at 390x844; the watch band, even
             after moving up, is thousands of pixels below it. This tile is what
             carries the fact that far up the page, and it points at the band on
             THIS page rather than at the library, so one tap shows the rows, the
             sentence saying what the channel is, and the CTA into the library.
             It counts rips we can put a name to, so the number is never a
             promise the band below then fails to keep. */ ""}
      ${p.rips.length
        ? `<a class="fact fact-link" href="#watch"><div class="n">${p.rips.length}</div><div class="l">${p.rips.length === 1 ? "Rip that mentions" : "Rips that mention"} one <span aria-hidden="true">&darr;</span></div></a>`
        : p.setRips.rips.length
          ? `<a class="fact fact-link" href="#watch"><div class="n">${n(p.setRips.total)}</div><div class="l">Rips of the sets they are in <span aria-hidden="true">&darr;</span></div></a>`
          : ""}
    </div>
    ${p.art ? `<p class="price-note">Artwork and Pokedex data from pokeapi.co, read ${esc(longDate(dexDoc.checked) || dexDoc.checked)}.
      Pokemon and Pokemon character names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc.</p>` : ""}
  </div>
</section>
${evoBand}
${pricedBand}
${watchBand}
${elsewhereBand}
${effBand}

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <img id="lbImg" src="" alt="">
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
  </div>
</div>

</main>
${footer(priceFooter("Pokedex data and artwork from PokeAPI. Fan made, not official."))}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    img.src=b.dataset.img; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.set,b.dataset.rarity,b.dataset.number].filter(Boolean).join(' • ');
    document.getElementById('lbPr').textContent=b.dataset.price||'';
    lb.classList.add('on'); document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){ lb.classList.remove('on'); document.body.style.overflow=''; if(last) last.focus(); }
  document.querySelectorAll('.chase-card').forEach(function(b){
    b.addEventListener('click',function(){ if(b.dataset.img) open(b); });
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>
${APP_JS}
</body>
</html>
`
  );
}

/* ------------------------------------------------------------- the index */

// MOST VALUABLE **AND** MOST POPULAR, which are not the same list.
//
// Ranking by priciest card alone is a value list: it surfaces whatever happens
// to carry an expensive chase card and misses species that are printed
// constantly and cheaply. Pikachu has 250 printings across the corpus and Eevee
// 153; both are obviously "popular Pokemon" and neither is guaranteed a slot by
// price. Printing count is the popularity signal and it is a real one rather
// than a guess: it is how often The Pokemon Company has chosen to print that
// species. The two lists are taken separately and unioned, so the band is
// genuinely "the most valuable and the most popular" rather than a blended score
// that satisfies neither description.
//
// THIS IS NOW A FEATURED BAND RATHER THAN THE WHOLE PAGE. It used to BE the
// roster, which is why the file it writes was capped at 30: the cap was the
// answer to "which pages exist". Every species has a page now, so this list
// answers a much smaller question, namely which 33 get a card picture at the top
// of the index. The Pokedex below it is the real index.
const eligible = species.filter((p) => p.index && p.priciest);
const byValue = [...eligible].sort((a, b) => b.priciest.price - a.priciest.price).slice(0, FEATURED);
const byPopularity = [...eligible].sort((a, b) => b.prints.length - a.prints.length).slice(0, FEATURED);
// THE MASCOTS ARE PINNED. The band ranks by priciest card, which is the right
// default and would never surface either of these: Trubbish and Garbodor are
// commons worth pennies. They are also the channel's whole identity and the
// reason the site is called Garbage Rips, and the corpus gives them real pages
// rather than thin ones.
const PINNED = ["Trubbish", "Garbodor"];
const featured = [];
const seen = new Set();
for (const p of [...byValue, ...byPopularity, ...PINNED.map((nm) => species.find((s) => s.name === nm))]) {
  if (!p || seen.has(p.id)) continue;
  seen.add(p.id);
  featured.push(p);
}

function indexPage() {
  const url = `${SITE}/pokemon/`;
  const indexed = species.filter((p) => p.index).length;
  const desc =
    `Every Pokemon in the National Pokedex, all ${n(DEX.length)} of them, with every card we could find for each one ` +
    `and what the ones we price are worth. Charizard, Umbreon, Pikachu, Eevee and 1,021 more.`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Pokemon" },
      ],
    },
  ];

  const gens = [...new Set(DEX.map((p) => p.gen))].sort((a, b) => a - b);

  return (
    head({
      title: `Every Pokemon, Every Card: the ${n(DEX.length)} Species Pokedex`,
      desc,
      canonical: url,
      ld,
    }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>By <span class="hl">Pokemon</span></h1>
    <p class="lede" style="max-width:34em">All ${n(DEX.length)} species, each with every card of it we could find,
      what the ones we price are worth, its evolution line and what beats it.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Pokemon</p>
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Most valuable, most printed</p>
    <h2>The ones people <span class="hl">chase</span></h2>
    <div class="poke-grid">
      ${featured
        .map(
          // THE LCP ELEMENT OF THIS PAGE WAS loading="lazy".
          //
          // The grid starts 422px down a 844px phone viewport, so the first
          // card is on screen at first paint and is what Chrome picks as the
          // Largest Contentful Paint: measured at 390x844 and 1440x900, the LCP
          // element is one of these images and the LCP url is its low.webp.
          // Marking it lazy tells the browser it is NOT needed for the first
          // screen, which is the opposite of true, and it cost 100-120ms:
          // FCP 72-96ms against LCP 188-192ms with nothing else in between.
          //
          // Only the FIRST tile is eager. Everything from the second on stays
          // lazy, which is right: on the narrowest phone only one is above the
          // fold, and 33 eager images would be a worse bug than the one this
          // fixes.
          //
          // NO fetchpriority="high". It was tried and measured, and it is the
          // WORST of the three at both widths: median LCP over five runs each,
          // rebuilt back to back so the CDN is the same,
          //     390x844    all lazy 296ms   eager+high 436ms   eager 228ms
          //     1440x900   all lazy 212ms   eager+high 232ms   eager 204ms
          // Read the ranges before believing any of that, though: they are
          // 144-684ms. The LCP element is a card scan on assets.tcgdex.net and
          // the CDN's own latency swamps everything this page does, so the
          // honest reading is that eager is no worse and the three are not
          // separable here. This change stands on the rule rather than on the
          // number: an element the browser is told is not needed for the first
          // screen cannot also be the largest thing on the first screen.
          (p, i) => `<a class="poke-card" href="/pokemon/${esc(p.slug)}.html">
        ${p.priciest.img ? avifPicture(`<img src="${esc(p.priciest.img)}/low.webp" onerror="this.remove()" alt="${esc(p.priciest.name)}, the most valuable ${esc(p.name)} card" ${i === 0 ? `decoding="async"` : `loading="lazy"`} width="245" height="337">`) : ""}
        <span class="poke-nm">${esc(p.name)}</span>
        <span class="poke-meta">${n(p.prints.length)} cards &bull; ${n(p.sets.size)} sets</span>
        ${
          // NOTHING RATHER THAN A ZERO, which is the rule wanted.html states in
          // its own footnote and which this page was breaking: two entries
          // rendered "top $0" because their priciest card has no market price
          // yet. A zero reads as "worthless", which is a claim about the card
          // rather than about our data.
          // NOT price > 0. Magnemite's dearest card is $0.32 and Magneton's is
          // $0.31, and moneyRound turns both into "$0", which reads as
          // worthless rather than as cheap. The guard has to be on what will be
          // PRINTED, not on the underlying number.
          !p.priciest.price
            ? `<span class="poke-pr poke-pr--none">no price yet</span>`
            : p.priciest.price < 1
              ? `<span class="poke-pr">top ${moneyExact(p.priciest.price)}</span>`
              : `<span class="poke-pr">top ${moneyRound(p.priciest.price)}</span>`
        }
      </a>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>All of them</p>
    <h2>The whole <span class="hl">Pokedex</span></h2>
    <!-- A THOUSAND TILES IS A FINDING PROBLEM, NOT A SCROLLING PROBLEM, and the
         answer is a filter over markup that is already there rather than a
         paginated list. The whole dex ships as plain text in the HTML, so the
         page is complete and crawlable with JS off and every one of the 1,025
         urls is a real link a crawler can follow from here; the box below only
         HIDES rows. NO PICTURES IN THIS LIST, deliberately: 1,025 portraits at
         9KB each is 9MB, and even lazy that is a scroll that never stops
         loading. The pictures live on the pages and in the band above. -->
    <label class="sr-only" for="dxq">Find a Pokemon by name or Pokedex number</label>
    <input class="dx-find" id="dxq" type="search" autocomplete="off"
      placeholder="Find a Pokemon: name or dex number">
    <div class="dx-chips" role="group" aria-label="Filter by generation">
      <button class="chip" type="button" data-gen="" aria-pressed="true">All</button>
      ${gens
        .map(
          (g) =>
            `<button class="chip" type="button" data-gen="${g}" aria-pressed="false">Gen ${g}${REGION[g] ? ` &bull; ${REGION[g]}` : ""}</button>`,
        )
        .join("\n      ")}
    </div>
    <p class="dx-count" id="dxCount" role="status">All ${n(DEX.length)} Pokemon</p>
    ${gens
      .map(
        (g) => `<div class="dx-gen" data-gen="${g}">
      <h3>Generation ${g}${REGION[g] ? ` &bull; ${REGION[g]}` : ""}</h3>
      <ul class="dx-list">
        ${species
          .filter((p) => p.gen === g)
          .map(
            (p) =>
              `<li><a class="dx-item" href="/pokemon/${esc(p.slug)}.html"><b>${esc(p.name)}</b><span>#${String(p.id).padStart(4, "0")} &bull; ${n(p.prints.length)} cards</span></a></li>`,
          )
          .join("\n        ")}
      </ul>
    </div>`,
      )
      .join("\n    ")}
    <p class="price-note">Species list from the National Pokedex, pokeapi.co, read
      ${esc(longDate(dexDoc.checked) || dexDoc.checked)}. Card counts are every printing we could name for that
      Pokemon in any language, from the TCGdex card database, read ${esc(longDate(pChecked) || pChecked)}.
      ${n(indexed)} of the ${n(DEX.length)} pages carry a price on at least one card and enough scans to be
      worth a search engine's time; the rest are published but marked noindex until they do.
      Anything else is on the <a href="/cards.html">card search</a>, which covers all ${n(cards.length)}.</p>
  </div>
</section>

</main>
${footer(priceFooter("Pokedex data from PokeAPI. Fan made, not official."))}
<script>
(function(){
  var q=document.getElementById('dxq'), count=document.getElementById('dxCount');
  var gens=[].slice.call(document.querySelectorAll('.dx-gen'));
  var chips=[].slice.call(document.querySelectorAll('.dx-chips .chip'));
  // THE NAME AND THE DEX NUMBER, NOT THE WHOLE TILE. Matching a.textContent
  // meant the card count was searchable too, so typing 47 lit up every Pokemon
  // with 47 printings as well as every dex number containing 47. The tile
  // carries no data- attribute for this on purpose: 1,025 of them would be real
  // bytes on the wire and both strings are already in the markup.
  var items=[].slice.call(document.querySelectorAll('.dx-item')).map(function(a){
    var nm=a.querySelector('b'), meta=a.querySelector('span');
    var k=(nm?nm.textContent:'')+' '+(meta?meta.textContent.split('•')[0]:'');
    return {el:a.parentNode, k:k.toLowerCase().replace(/[^a-z0-9 #]/g,'')};
  });
  var gen='';
  function apply(){
    var t=(q.value||'').toLowerCase().trim().replace(/[^a-z0-9 #]/g,'');
    var shown=0;
    for(var i=0;i<items.length;i++){
      var hit=!t||items[i].k.indexOf(t)>-1;
      items[i].el.classList.toggle('is-off',!hit);
      if(hit) shown++;
    }
    for(var g=0;g<gens.length;g++){
      var offGen=gen&&gens[g].dataset.gen!==gen;
      var empty=!gens[g].querySelector('li:not(.is-off)');
      gens[g].classList.toggle('is-off', !!offGen||empty);
      if(offGen){
        var hidden=gens[g].querySelectorAll('li:not(.is-off)').length;
        shown-=hidden;
      }
    }
    count.textContent = shown===${DEX.length} ? 'All ${n(DEX.length)} Pokemon'
      : shown===0 ? 'Nothing matches that' : shown+(shown===1?' Pokemon':' Pokemon');
  }
  q.addEventListener('input',apply);
  chips.forEach(function(c){
    c.addEventListener('click',function(){
      gen=c.dataset.gen||'';
      chips.forEach(function(o){ o.setAttribute('aria-pressed', o===c ? 'true':'false'); });
      apply();
    });
  });
})();
</script>
${APP_JS}
</body>
</html>
`
  );
}

/* -------------------------------------------------------------------- write */

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const p of species) await writeFile(join(OUT, `${p.slug}.html`), pokePage(p));
await writeFile(join(OUT, "index.html"), indexPage());

// The search index the site-wide search reads for these pages, and the list
// build-pages.mjs turns into sitemap entries.
//
// EVERY SPECIES IS IN HERE AND ONLY SOME OF THEM ARE INDEXABLE. The site's own
// search should find Bonsly; Google should not be asked to rank a page that
// cannot put a price on a single card. `index` is what tells the two apart, and
// build-pages.mjs filters the sitemap on it. Dropping that filter would put
// noindex pages in the sitemap, which check-build.py fails the build over.
const indexed = species.filter((p) => p.index);
await writeFile(
  join(ROOT, "public/data/pokemon-index.json"),
  JSON.stringify({
    checked,
    // THE PRICE STAMPS TRAVEL WITH THE PRICES. /eevee.html reads `top` out of
    // this index rather than the card files, so without these it had no way to
    // name the source of a figure it prints, and it was crediting TCGplayer.
    // Passing the whole stamp block means the two pages cannot drift.
    priceSource: priceDoc?.priceSource || null,
    pricesChecked: priceDoc?.pricesChecked || null,
    pricedBy: priceDoc?.pricedBy || null,
    count: species.length,
    indexable: indexed.length,
    pokemon: species.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      cards: p.prints.length,
      sets: p.sets.size,
      top: p.priciest ? p.priciest.price : null,
      index: p.index,
    })),
  }) + "\n",
);

const noArt = species.filter((p) => !p.art).length;
console.log(`Wrote ${species.length} Pokemon pages + index to public/pokemon/`);
console.log(
  `  ${indexed.length} indexable, ${species.length - indexed.length} noindex ` +
    `(bar: ${MIN_PRICED}+ priced card, ${MIN_EN_SCANS}+ English scans, ${MIN_SETS}+ sets)`,
);
if (unresolved) console.log(`  ${unresolved} priced cards could not be resolved to a dex number`);
if (noArt) console.log(`  ${noArt} have no mirrored artwork: run node scripts/sync-species-art.mjs`);
if (!typeDoc) console.log(`  no data/type-chart.json, so no page shows a type table: run node scripts/sync-type-chart.mjs`);
for (const p of indexed.slice().sort((a, b) => b.prints.length - a.prints.length).slice(0, 6)) {
  console.log(
    `  /pokemon/${p.slug}.html`.padEnd(34) +
      `${String(p.prints.length).padStart(4)} printings, ${p.sets.size} sets, ` +
      `${p.priced.length} priced, top ${moneyRound(p.priciest.price)}, ${p.rips.length} rips`,
  );
}
