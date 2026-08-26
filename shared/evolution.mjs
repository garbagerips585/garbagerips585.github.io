// The shared half of the evolution pages: it loads data/evolutions.json, groups
// the routes, and turns one route into English.
//
// WHY THIS IS SHARED AND NOT INSIDE THE BUILDER. Two different places on this
// site want to say how a Pokemon evolves: the standalone chart at
// /evolution.html and the species pages under /pokemon/. If each wrote its own
// sentence, the chart could say "Trade it holding a Metal Coat" while a species
// page said "Trade" and both would look right. Same reason shared/decks.mjs
// exists for the two deck pages and shared/app-compare.mjs for the two app
// pages. ANY PAGE THAT PRINTS AN EVOLUTION CONDITION GOES THROUGH conditionText
// AND groupRoutes, so the two cannot drift.
//
// THE DATA FILE HOLDS FIELDS, THIS FILE HOLDS SENTENCES. data/evolutions.json
// is what PokeAPI said, structured, with nothing written by us in it. That
// separation is deliberate and it is the same one data/types.json keeps: a
// research file that got printed verbatim once shipped a builder's memo to
// readers.
//
// THE ONE RULE THAT MATTERS. A route carries the version group PokeAPI files it
// under, and that is NOT the same as "only in those games". Charmeleon's
// "Level 16" is filed under Red and Blue and is true in every game since. So:
//
//   - groupRoutes collapses routes that describe the SAME condition. A species
//     with one condition prints it plainly, with no games attached, because
//     attaching "Red and Blue" to Level 16 would be a false restriction.
//   - Where the conditions genuinely DIFFER, every one is printed with the
//     games it is filed under, and none is picked over the others. Milotic is
//     the case that makes this necessary: maximum Beauty in Ruby and Sapphire,
//     a trade holding a Prism Scale in Black and White. Picking one would
//     publish a false answer to half the people asking.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The pages that import it are one
// template literal each and a backtick in a comment closes it.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ===========================================================================
// PokeAPI CONTRADICTS ITSELF ABOUT FOUR SPECIES, AND THIS IS WHERE THAT IS
// SETTLED SO THAT EVERY PAGE SETTLES IT THE SAME WAY.
//
// data/evolutions.json is the evolution-chain endpoint. data/pokedex.json is the
// pokemon-species endpoint. They are the same project, read on the same day, and
// on 17 August 2026 they disagreed on exactly 2 of the 1,025 species. Both
// disagreements are visible on the site, because /evolution.html reads the first
// file and the species pages under /pokemon/ read the second:
//
//   MELMETAL. pokemon-species/809 says evolves_from_species = meltan.
//             evolution-chain/428 holds meltan alone and evolution-chain/429
//             holds melmetal alone, as two separate one-species chains. So
//             /evolution.html listed Meltan AND Melmetal under "these do not
//             evolve" while /pokemon/meltan.html drew "Meltan, which becomes
//             Melmetal". Both pages counted 201 species with no evolution and
//             the two lists of 201 were not the same list.
//
//   MANAPHY.  pokemon-species/489 (Phione) and /490 (Manaphy) BOTH say
//             evolves_from_species = null, and both point at
//             evolution-chain/250, which draws phione -> manaphy. So the chart
//             drew an evolution arrow that neither species record supports, and
//             the species pages, correctly, drew nothing.
//
// THE SPECIES RECORD WINS, BOTH TIMES, and the two cases are decided for the
// same reason rather than for two convenient ones. `evolves_from_species` is one
// species' statement about its own immediate predecessor. An evolution CHAIN is
// a FAMILY grouping, and a family is a looser thing: it is what puts Manaphy and
// Phione in one box, which is a real relationship (Phione hatches from a Manaphy
// egg) and is not an evolution. Where the two disagree, the narrower field is
// the one making the claim we are printing.
//
// It also lands right against the games in both cases, which is the check that
// matters more than the argument: Meltan does become Melmetal, with 400 Meltan
// Candy in Pokemon GO, and the pair has been printed on Pokemon cards. Phione
// does not become Manaphy in any game; it is bred from one.
//
// THE ARROW CARRIES NO CONDITION AND THAT IS DELIBERATE. PokeAPI records no
// evolution_details for Meltan, because the trade that triggers it is not a
// mainline game mechanic and its schema has no field for one. This file will not
// invent one: the step is drawn, `note` says where the step came from and that
// the source records no condition, and no level, item or trade is stated.
//
// ANY OTHER DISAGREEMENT FAILS THE BUILD. reconcile() compares every species in
// both files and throws on a mismatch it has not been told about. That is the
// part that makes this a fix rather than a patch: the two pages cannot drift
// apart again without somebody being told, by name, which species moved.
const SPECIES_OVERRIDES = {
  melmetal: {
    parent: "meltan",
    note:
      "Our source's chain data files Meltan and Melmetal as two separate species that do not " +
      "evolve, while its own species record for Melmetal names Meltan as what it evolves from. " +
      "The step is drawn from the species record. The same source states no condition for it.",
  },
  manaphy: {
    parent: null,
    note: null,
  },
};

/**
 * Load the chains, reconciled against the species records, with the counts
 * recomputed from what the reconciliation actually left behind.
 *
 * Returns the same document shape every caller already expects, plus
 * `reconciled`, which lists what was moved and is printed in the build log.
 */
export async function loadEvolutions() {
  const d = JSON.parse(await readFile(join(ROOT, "data/evolutions.json"), "utf8"));
  const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8"));
  d.reconciled = reconcile(d, dex);
  recount(d);
  return d;
}

/** slug -> { node, parent, chain } across every chain in the document. */
function indexChains(d) {
  const ix = new Map();
  for (const c of d.chains || []) {
    walkChain(c.root, (node, parent) => ix.set(node.slug, { node, parent, chain: c }));
  }
  return ix;
}

function reconcile(d, dex) {
  const bySlug = new Map((dex.pokemon || []).map((p) => [p.slug, p]));
  const slugOfName = new Map((dex.pokemon || []).map((p) => [p.name, p.slug]));
  const moved = [];

  for (const p of dex.pokemon || []) {
    const ix = indexChains(d);
    const here = ix.get(p.slug);
    if (!here) {
      throw new Error(
        `shared/evolution.mjs: data/pokedex.json holds "${p.slug}" and data/evolutions.json has no\n` +
          `  chain containing it. Every species has to be on the chart, as a line or as one of the\n` +
          `  species that do not evolve. Re-run scripts/sync-evolution.mjs.`
      );
    }
    const want = p.evolvesFrom ? slugOfName.get(p.evolvesFrom) || p.evolvesFrom : null;
    const have = here.parent ? here.parent.slug : null;
    if (want === have) continue;

    const fix = SPECIES_OVERRIDES[p.slug];
    if (!fix || fix.parent !== want) {
      throw new Error(
        `shared/evolution.mjs: the two PokeAPI files disagree about "${p.slug}".\n` +
          `  data/pokedex.json says it evolves from ${JSON.stringify(want)}.\n` +
          `  data/evolutions.json puts it under ${JSON.stringify(have)}.\n` +
          `  /evolution.html reads the second and the species pages read the first, so shipping this\n` +
          `  publishes two contradictory answers to one question. Decide which endpoint is right for\n` +
          `  this species, write the decision and its evidence into SPECIES_OVERRIDES above, and let\n` +
          `  both pages take it from here. Do NOT fix it in one builder.`
      );
    }

    // Detach. A node with a parent leaves that parent's `to`; a node that is a
    // chain root takes its whole subtree with it and the chain goes.
    if (here.parent) {
      here.parent.to = (here.parent.to || []).filter((n) => n !== here.node);
    } else {
      d.chains = (d.chains || []).filter((c) => c !== here.chain);
    }

    // Attach, and drop any routes it was carrying: they described the step it is
    // no longer taking.
    here.node.routes = [];
    here.node.note = fix.note || null;
    if (want === null) {
      d.chains.push({
        id: here.chain.id,
        babyTriggerItem: here.chain.babyTriggerItem ?? null,
        reconciled: true,
        root: here.node,
      });
    } else {
      const parentEntry = indexChains(d).get(want);
      if (!parentEntry) {
        throw new Error(
          `shared/evolution.mjs: SPECIES_OVERRIDES puts "${p.slug}" under "${want}" and no chain\n` +
            `  holds "${want}". Name a species that is on the chart.`
        );
      }
      parentEntry.chain.reconciled = true;
      parentEntry.node.to = parentEntry.node.to || [];
      parentEntry.node.to.push(here.node);
    }
    moved.push({ slug: p.slug, from: have, to: want });
  }

  // Stages are depth from the chain root and half the layout reads them, so they
  // are recomputed rather than left describing where a node used to sit.
  for (const c of d.chains || []) {
    const stamp = (node, depth) => {
      node.stage = depth;
      for (const k of node.to || []) stamp(k, depth + 1);
    };
    stamp(c.root, 0);
  }
  // Dex order, so a chain that moved lands where a reader expects it.
  d.chains.sort((a, b) => (a.root.id ?? 99999) - (b.root.id ?? 99999));

  // Every species in the dex is accounted for exactly once, checked after the
  // moves rather than assumed by them.
  const after = indexChains(d);
  for (const p of dex.pokemon || []) {
    if (!after.has(p.slug)) {
      throw new Error(`shared/evolution.mjs: reconciling lost "${p.slug}" off the chart.`);
    }
  }
  for (const [slug] of after) {
    if (!bySlug.has(slug)) {
      throw new Error(
        `shared/evolution.mjs: data/evolutions.json holds "${slug}" and data/pokedex.json does not.`
      );
    }
  }
  return moved;
}

/**
 * The counts, recomputed from the chains as they now stand.
 *
 * `counts` was written by sync-evolution.mjs against the file BEFORE
 * reconciliation, and /evolution.html prints two of them in its sourcing note.
 * A count that survives a restructure unchanged is a count that has stopped
 * describing the page.
 */
function recount(d) {
  const c = { chains: 0, single: 0, multi: 0, nodes: 0, routes: 0, branching: 0, noGames: 0 };
  for (const chain of d.chains || []) {
    c.chains++;
    let n = 0;
    let branches = false;
    walkChain(chain.root, (node) => {
      n++;
      for (const r of node.routes || []) {
        c.routes++;
        if (!r.games) c.noGames++;
      }
      if ((node.to || []).length > 1) branches = true;
    });
    c.nodes += n;
    if (n === 1) c.single++;
    else c.multi++;
    if (branches) c.branching++;
  }
  d.counts = c;
}

/** Depth-first walk of a chain, parent passed with each node. */
export function walkChain(node, fn, parent = null) {
  fn(node, parent);
  for (const c of node.to || []) walkChain(c, fn, node);
}

/** Every species name in a chain, root first. */
export function chainNames(root) {
  const out = [];
  walkChain(root, (n) => out.push(n.name));
  return out;
}

// ---------------------------------------------------------------------------
// EVERY FIELD MUST BE SPOKEN FOR.
//
// This is the same guard build-types.mjs puts on its COPY block, for the same
// reason. PokeAPI adds fields: `used_move` and `min_steps` were not in the
// schema this site first read, and `used_move` is the entire answer to how
// Annihilape works. A field that arrives and is silently ignored produces a
// condition that is missing its most important clause and still reads like a
// finished sentence, which is the worst possible failure here.
const BOOKKEEPING = new Set(["trigger", "games", "isDefault", "fromForm", "toForm"]);
const SPOKEN = new Set([
  "level", "item", "held", "happiness", "affection", "beauty", "time", "place", "rock",
  "move", "usedMove", "moveType", "moveCount", "partyOf", "partyType", "tradeFor",
  "gender", "stats", "rain", "upsideDown", "steps", "damage", "multiplayer", "region",
]);

// The exotic triggers, in PokeAPI's own words. `label` is copied from the
// source's English name for the trigger and is NOT ours; `gloss` is ours, is
// marked as ours on the page, and only ever says what the label already says in
// plainer words. Where we do not know more than the label, gloss is null and
// the label stands alone rather than being padded out with a guess.
const TRIGGER = {
  "level-up": { gloss: null },
  "use-item": { gloss: null },
  trade: { gloss: null },
  "use-move": { gloss: null },
  "agile-style-move": { gloss: "Agile Style is one of the two move styles in Legends: Arceus." },
  "strong-style-move": { gloss: "Strong Style is the other Legends: Arceus move style." },
  "recoil-damage": { gloss: "Damage it does to itself, added up rather than taken in one go." },
  "take-damage": { gloss: "Damage taken, then a specific place to walk to. PokeAPI records the number and not the place." },
  shed: { gloss: "Not a choice you make. It happens alongside another evolution." },
  spin: { gloss: null },
  "tower-of-darkness": { gloss: null },
  "tower-of-waters": { gloss: null },
  "three-critical-hits": { gloss: null },
  "three-defeated-bisharp": { gloss: null },
  "gimmighoul-coins": { gloss: null },
  other: { gloss: "PokeAPI's own way of saying the condition does not fit its data model. Whatever else is printed here is all it records." },
};

const TIME = {
  day: "during the day",
  night: "at night",
  dusk: "at dusk",
  "full-moon": "during a full moon",
};

// relative_physical_stats, in PokeAPI's documented meaning: 1 is Attack higher
// than Defense, 0 is equal, -1 is Defense higher. Tyrogue is the check, and it
// lands right: 1 gives Hitmonlee, -1 gives Hitmonchan, 0 gives Hitmontop.
const STATS = {
  1: "with Attack higher than Defense",
  0: "with Attack and Defense exactly equal",
  "-1": "with Defense higher than Attack",
};

// PokeAPI gender ids. 1 is female, 2 is male.
const GENDER = { 1: "females only", 2: "males only" };

const n = (x) => Number(x).toLocaleString("en-US");

// "a Water Stone" but "an Ice Stone". Six of the 43 items PokeAPI names here
// start with a vowel and read as a typo without this: an Ice Stone, an Oval
// Stone, an Upgrade, an Electirizer, an Auspicious Armor, an Unremarkable
// Teacup. Crude on purpose, since every string it sees is a proper noun from
// the source rather than free text.
const art = (s) => `${/^[aeiou]/i.test(String(s)) ? "an" : "a"} ${s}`;

/**
 * One route as English.
 *
 * Returns { head, extras, trigger, label, gloss, incomplete }, never a single
 * string, so a caller can set the headline in one weight and the conditions in
 * another without re-parsing a sentence.
 *
 * `incomplete` is true when PokeAPI itself says it does not hold the whole
 * condition. The pages must show that rather than presenting a partial
 * condition as the answer.
 */
export function conditionText(r, triggerLabels = {}) {
  for (const k of Object.keys(r)) {
    if (!BOOKKEEPING.has(k) && !SPOKEN.has(k)) {
      throw new Error(
        `shared/evolution.mjs: route field "${k}" has no phrasing. PokeAPI has ` +
          `added a field. Write a clause for it here before this ships, because ` +
          `an ignored field reads as a finished condition that is missing its point.`
      );
    }
  }
  const t = r.trigger;
  if (!(t in TRIGGER)) {
    throw new Error(`shared/evolution.mjs: no rule for trigger "${t}". Add one to TRIGGER.`);
  }
  const label = triggerLabels[t] || t;
  const used = new Set();
  const take = (k) => {
    used.add(k);
    return r[k];
  };

  let head;
  if (t === "level-up" || t === "other") {
    head = r.level ? `Level ${take("level")}` : "Level up";
  } else if (t === "use-item") {
    head = `Use ${art(take("item"))}`;
  } else if (t === "trade") {
    head = r.tradeFor ? `Trade it for ${art(take("tradeFor"))}` : "Trade it";
  } else if (t === "use-move") {
    head = r.usedMove
      ? `Use ${take("usedMove")}${r.moveCount ? ` ${take("moveCount")} times` : ""}`
      : `Use one move${r.moveCount ? ` ${take("moveCount")} times` : ""}`;
  } else if (t === "agile-style-move" || t === "strong-style-move") {
    const style = t === "agile-style-move" ? "Agile Style" : "Strong Style";
    head = r.usedMove
      ? `Use ${take("usedMove")} in ${style}${r.moveCount ? ` ${take("moveCount")} times` : ""}`
      : `Use a move in ${style}${r.moveCount ? ` ${take("moveCount")} times` : ""}`;
  } else if (t === "recoil-damage") {
    head = `Take ${n(take("damage"))} recoil damage`;
  } else if (t === "take-damage") {
    head = `Take ${n(take("damage"))} damage, then go to the right place`;
  } else {
    // shed, spin, the two towers, three critical hits, three Bisharp, the coins.
    // PokeAPI's own label is already a full instruction for every one of these,
    // so it is used as written rather than paraphrased.
    head = label;
  }

  const extras = [];
  const add = (k, s) => {
    if (r[k] !== undefined && !used.has(k)) {
      used.add(k);
      extras.push(s(r[k]));
    }
  };
  add("held", (v) => `holding ${art(v)}`);
  add("item", (v) => `using ${art(v)}`);
  add("happiness", (v) => `with friendship ${v} or higher`);
  add("affection", (v) => `with ${v} or more affection hearts`);
  add("beauty", (v) => `with Beauty ${v} or higher`);
  add("move", (v) => `knowing ${v}`);
  add("moveType", (v) => `knowing ${art(v)} type move`);
  add("moveCount", (v) => `after using that move ${v} times`);
  add("time", (v) => TIME[v] || `at ${v}`);
  // A "special rock" with a place named reads better as the place. Without one
  // it is all PokeAPI gives, and saying so beats inventing a location.
  if (r.rock !== undefined && r.place !== undefined) {
    used.add("rock");
    used.add("place");
    extras.push(`near the special rock at ${r.place}`);
  }
  add("place", (v) => `at ${v}`);
  add("rock", () => "near a special rock");
  add("stats", (v) => STATS[String(v)] || `with a stat condition PokeAPI records as ${v}`);
  add("gender", (v) => GENDER[v] || `for one gender only`);
  add("partyOf", (v) => `with ${art(v)} in your party`);
  add("partyType", (v) => `with ${art(v)} type Pokemon in your party`);
  add("rain", () => "while it is raining in the overworld");
  add("upsideDown", () => "with the console turned upside down");
  add("steps", (v) => `after ${n(v)} steps walking with it`);
  add("multiplayer", () => "in a group with another player");
  add("damage", (v) => `after taking ${n(v)} damage`);
  // The region is already carried by the form name on every route that has one
  // ("Alolan Raichu" says Alola better than a tag does), and the routes that
  // carry a region without a form are the plain species in that region, where a
  // tag would suggest a difference there is not one. Consumed and not printed.
  used.add("region");

  return {
    head,
    extras,
    trigger: t,
    label,
    gloss: TRIGGER[t].gloss,
    incomplete: t === "other" || t === "take-damage",
  };
}

/**
 * The routes into one node, grouped by the CONDITION they describe.
 *
 * This is where the generational honesty actually happens, so read the rule
 * before changing it. Two routes that say the same thing under different
 * version groups are ONE answer that PokeAPI happens to file twice: Cyndaquil
 * reaches Quilava at level 17 in Gold and Silver and at level 17 in Legends:
 * Arceus, and printing that twice with two game labels invents a difference.
 * Two routes that say DIFFERENT things are two answers and both are kept.
 *
 * Returns [{ key, route, games: [slug], sole }] where `sole` is true when this
 * is the only condition on the node, which is the signal to the page that the
 * games must NOT be printed beside it.
 */
export function groupRoutes(routes) {
  const groups = new Map();
  for (const r of routes || []) {
    // The key is everything about the condition and nothing about where it is
    // filed. `region` is excluded on purpose: Cyndaquil's Hisui route is the
    // same level 17, and a region tag would split it into two lines that say
    // the same thing.
    const { games, isDefault, region, ...cond } = r;
    const key = JSON.stringify(cond);
    if (!groups.has(key)) groups.set(key, { key, route: r, games: [], isDefault: false });
    const g = groups.get(key);
    if (r.games) g.games.push(r.games);
    g.isDefault = g.isDefault || r.isDefault === true;
  }
  const out = [...groups.values()];
  for (const g of out) g.sole = out.length === 1;
  return out;
}

/**
 * What a reader has to DO, as a small set of tags, so the chart can be filtered
 * by method. This is the "show me every trade evolution" question, which is a
 * real one and which nothing else on this site can answer.
 *
 * A route can carry more than one tag: a trade holding a Metal Coat is both.
 */
export function methodTags(r) {
  const tags = new Set();
  if (r.trigger === "trade") tags.add("trade");
  if (r.trigger === "use-item") tags.add("item");
  if (r.held) tags.add("held");
  if (r.happiness !== undefined || r.affection !== undefined) tags.add("friendship");
  if (r.time !== undefined) tags.add("time");
  if (r.place !== undefined || r.rock !== undefined) tags.add("place");
  if (r.move !== undefined || r.usedMove !== undefined || r.moveType !== undefined) tags.add("move");
  if (r.trigger === "level-up" && r.level !== undefined && tags.size === 0) tags.add("level");
  // Everything that is none of the above and is not a plain level: the shed,
  // the spin, the towers, the coins, the upside-down console, the walk.
  const plain = new Set(["level", "trade", "item", "held", "friendship", "time", "place", "move"]);
  if (![...tags].some((x) => plain.has(x))) tags.add("odd");
  else if (
    r.upsideDown ||
    r.steps !== undefined ||
    r.multiplayer ||
    r.rain ||
    r.stats !== undefined ||
    r.gender !== undefined ||
    r.beauty !== undefined ||
    r.damage !== undefined ||
    r.partyOf !== undefined ||
    r.partyType !== undefined
  ) {
    tags.add("odd");
  }
  return [...tags];
}

/** Human labels for the tags above, used by the filter chips and the key. */
export const METHOD_LABELS = {
  level: "Level up",
  item: "Use an item",
  trade: "Trade",
  held: "Held item",
  friendship: "Friendship",
  time: "Time of day",
  place: "A place",
  move: "A move",
  odd: "One of a kind",
};

/** Every game label a set of version group slugs names, oldest first. */
export function gameLabels(slugs, games) {
  const seen = new Set();
  return slugs
    .filter((s) => {
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    })
    .map((s) => games[s])
    .filter(Boolean)
    .sort((a, b) => (a.gen || 99) - (b.gen || 99) || a.order - b.order)
    .map((g) => g.label);
}

// ---------------------------------------------------------------------------
// THE DRAWING, and it lives here rather than in a builder because TWO pages
// draw the same chain: /evolution.html and /eevee-evolutions.html. A chain
// drawn two ways is two mental models of the same picture, which is the exact
// failure shared/chrome.mjs describes for the nav. Anything that draws an
// evolution chain, including a species page under /pokemon/, should call
// renderChain rather than write its own boxes and arrows.
//
// TWO MARKS, DRAWN, because a chain only needs two: a step and a fork. This
// site draws its own symbols rather than hotlinking somebody else's art, the
// same way rarityMark() in shared/rarity.mjs and the type marks in
// build-types.mjs do.
export const EVO_MARKS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="evoArrow" viewBox="0 0 40 24"><path d="M2 9h21V3l15 9-15 9v-6H2z"/></symbol>
<symbol id="evoFork" viewBox="0 0 28 44"><path d="M8 0v19c0 6 3 9 9 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M15 22.5L23 28l-8 5.5z"/></symbol>
</defs></svg>`;

/** The chain rules. Both pages include this verbatim so they cannot diverge. */
export const EVO_CSS = `
/* THE CHAIN. A COLUMN ON A PHONE and a row from 720px, and that is not a
   preference: at 390px the content box measures about 326px, and three name
   boxes plus two arrows do not fit across it at any legible size. Laid out as a
   row it either pushes the document sideways or shrinks the names to 10px.
   Vertical, every box is full width and the condition sits beside the arrow. */
.ev-line{display:flex;flex-direction:column;align-items:stretch;gap:0}
.ev-node{display:flex;align-items:baseline;gap:8px;padding:9px 12px;border:2px solid var(--keyline);
  border-radius:9px;background:var(--paper);color:inherit;text-decoration:none;min-height:44px;
  box-sizing:border-box}
a.ev-node{background:var(--chip-gold-bg)}
a.ev-node:hover{background:var(--mustard);color:var(--on-accent)}
/* .ev-no carries its own --ink-2, so the dex number stayed put while the tile
   went mustard: 8.11:1 at rest, 1.45:1 on hover, across 824 nodes on
   evolution.html and 9 on eevee-evolutions.html. Third instance of the same
   parent-flips-child-does-not bug found on 25 August 2026. */
a.ev-node:hover .ev-no{color:inherit}
.ev-nm{font:700 var(--t-body)/1.3 var(--body)}
.ev-no{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
/* The step: the drawn arrow and the condition it carries. ONE symbol in a
   SQUARE box, turned a quarter turn by CSS on a phone, so the layout box is
   identical in both directions and nothing jumps when the breakpoint flips.
   Two separate symbols would have been a second element on every one of the
   500-odd steps on the chart page. */
.ev-step{display:flex;align-items:center;gap:10px;padding:4px 0 4px 6px}
.ev-ar{width:30px;height:30px;flex:0 0 30px;fill:var(--gold);transform:rotate(90deg)}
.ev-cond{font-size:var(--t-sm);line-height:1.45;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px}
.ev-cond b{font-weight:700}
.ev-cond span{color:var(--ink-2)}
.ev-plus{color:var(--gold-deep) !important;font-weight:700}
.ev-form{display:block;flex:1 0 100%;font:700 var(--t-micro)/1.4 var(--mono);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ink) !important}
.ev-games{display:flex;flex-wrap:wrap;gap:4px;flex:1 0 100%;margin-top:2px}
.ev-games span{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2) !important;
  border:1px solid var(--hair);border-radius:var(--r-pill);padding:4px 8px}
.ev-inc{flex:1 0 100%;font-size:var(--t-micro);line-height:1.5;color:var(--ink-2) !important;margin-top:2px}
/* A step whose only content is the note about where it came from. The note is
   already .ev-inc, so this only stops the flex row collapsing it to nothing. */
.ev-cond-note{display:block}
/* MORE THAN ONE ANSWER. This is the block both pages really exist for, so it is
   fenced rather than run on: a reader has to see at a glance that the answer
   depends on which game they are holding. */
.ev-multi{border-left:4px solid var(--gold);padding-left:10px;margin:2px 0}
.ev-multi-h{display:block;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink);margin-bottom:4px}
.ev-cond-alt + .ev-cond-alt{margin-top:6px;padding-top:6px;border-top:1px solid var(--hair)}
/* THE FORK. One drawn elbow per arm rather than one shared trunk: a trunk has
   to know the height of the arms it spans, which CSS cannot tell an SVG, and
   eight stacked elbows read as a fan on their own. */
.ev-arms{list-style:none;margin:0;padding:0}
.ev-arm{display:grid;grid-template-columns:24px minmax(0,1fr);gap:6px;align-items:start;margin-top:4px}
.ev-fk{width:22px;height:34px;fill:var(--gold);color:var(--gold);margin-top:-4px}
.ev-armbody{min-width:0}
.ev-armbody .ev-line{margin-top:4px}
/* VIEWPORT AND NOT CONTAINER, ON PURPOSE, AND THIS BLOCK IS NOT STRIPPED SO
   the argument is kept short. A chain sits in a card 302 to 1354px wide across
   the two pages that draw one, so a container query is the right SHAPE here.
   It was written and measured on both, at every width: it changes nothing,
   because a row chain that runs out of width staircases, and the threshold
   that DOES change something costs 6,036px of scroll. The numbers are beside
   the .ev-list breakpoint in scripts/build-evolution.mjs. */
@media(min-width:720px){
  .ev-line{flex-direction:row;align-items:center;flex-wrap:wrap;gap:2px}
  .ev-ar{transform:none}
  .ev-step{padding:4px 6px;max-width:22em}
  .ev-arm{grid-template-columns:28px minmax(0,1fr)}
}
`;

const escHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * One condition, rendered.
 *
 * `group.sole` means this is the only condition on the node, and then the games
 * are NOT rendered: the version group on a single route is where the source
 * files it, not a restriction, and "Level 16, in Red and Blue" is a false
 * sentence about Charmeleon. The throw is here rather than in a comment because
 * that mistake is one careless edit away and reads perfectly well on the page.
 */
export function condBlock(group, data, cls = "ev-cond") {
  const t = conditionText(group.route, data.triggers);
  const labels = group.sole ? [] : gameLabels(group.games, data.games);
  if (group.sole && labels.length) {
    throw new Error("shared/evolution.mjs: a sole condition must never print its version group");
  }
  const bits = [`<b>${escHtml(t.head)}</b>`, ...t.extras.map((x) => `<span>${escHtml(x)}</span>`)].join(
    `<span class="ev-plus" aria-hidden="true">+</span>`
  );
  const from = group.route.fromForm ? `<span class="ev-form">from ${escHtml(group.route.fromForm)}</span>` : "";
  const form = group.route.toForm ? `<span class="ev-form">into ${escHtml(group.route.toForm)}</span>` : "";
  const gs = labels.length
    ? `<span class="ev-games">${labels.map((l) => `<span>${escHtml(l)}</span>`).join("")}</span>`
    : "";
  const inc = t.incomplete
    ? `<span class="ev-inc">Our source files this under "${escHtml(t.label)}" and records nothing further, so this is not the whole condition.</span>`
    : "";
  return `<div class="${cls}">${bits}${from}${form}${gs}${inc}</div>`;
}

/** Every condition into a node. More than one is the case these pages exist for. */
export function condsFor(node, data) {
  const groups = groupRoutes(node.routes);
  // A STEP WITH NO CONDITION SAYS WHY IT HAS NONE. Reconciliation puts a `note`
  // on the one step this site draws from the species record rather than from the
  // chain data, and a bare arrow with nothing beside it would look like a
  // rendering failure rather than an honest gap. Nothing here states a level, an
  // item or a trade: the note says where the step came from and that the source
  // records no condition for it.
  if (!groups.length) {
    return node.note
      ? `<div class="ev-cond ev-cond-note"><span class="ev-inc">${escHtml(node.note)}</span></div>`
      : "";
  }
  if (groups.length === 1) return condBlock(groups[0], data);
  return (
    `<div class="ev-multi"><span class="ev-multi-h">${groups.length} different answers, by game</span>` +
    groups.map((g) => condBlock(g, data, "ev-cond ev-cond-alt")).join("") +
    `</div>`
  );
}

export const dexNo = (n) => (n.id ? `#${String(n.id).padStart(3, "0")}` : "");

/** A species box, linked when this site has a page for that Pokemon. */
export function nodeCard(n, hasPage) {
  const inner = `<span class="ev-nm">${escHtml(n.name)}</span><span class="ev-no">${escHtml(dexNo(n))}</span>`;
  return hasPage && hasPage.has(n.slug)
    ? `<a class="ev-node" href="/pokemon/${escHtml(n.slug)}.html">${inner}</a>`
    : `<div class="ev-node">${inner}</div>`;
}

/**
 * The chain, drawn.
 *
 * A linear run is FLATTENED into one row rather than nested, so three stages are
 * three boxes and two arrows at every width instead of a stack of wrappers that
 * indents further with every stage. Recursion only starts again at a fork, which
 * is the only place the picture genuinely branches.
 */
export function renderChain(node, data, hasPage) {
  const parts = [nodeCard(node, hasPage)];
  let cur = node;
  while ((cur.to || []).length === 1) {
    const nxt = cur.to[0];
    parts.push(
      `<div class="ev-step"><svg class="ev-ar" viewBox="0 0 40 24" aria-hidden="true" focusable="false"><use href="#evoArrow"/></svg>${condsFor(nxt, data)}</div>`
    );
    parts.push(nodeCard(nxt, hasPage));
    cur = nxt;
  }
  let html = `<div class="ev-line">${parts.join("")}</div>`;
  if ((cur.to || []).length > 1) {
    html +=
      `<ul class="ev-arms">` +
      cur.to
        .map(
          (ch) =>
            `<li class="ev-arm"><svg class="ev-fk" viewBox="0 0 28 44" aria-hidden="true" focusable="false"><use href="#evoFork"/></svg>` +
            `<div class="ev-armbody">${condsFor(ch, data)}${renderChain(ch, data, hasPage)}</div></li>`
        )
        .join("") +
      `</ul>`;
  }
  return html;
}
