/* A CARD NAME -> ITS /pokemon/<species>.html PAGE, FOR THE BUILDERS THAT ARE
 * NOT build-pokemon.mjs. 11 November 2026.
 *
 * WHY THIS EXISTS. An internal link audit counted the 851 indexable species
 * pages by how many OTHER pages link to them: 143 had exactly one and 507 had
 * three or fewer, because the set guides list every card in a set without
 * linking a single name and the rip pages had no link into /pokemon/ at all.
 * /sets/pitch-black.html names Mega Darkrai ex five times and
 * /pokemon/darkrai.html had one inbound link.
 *
 * IT IS build-pokemon.mjs's OWN JOIN, NOT A SECOND MATCHER. That builder
 * decides which species a printing belongs to in two steps and both are
 * repeated here exactly:
 *
 *   1. speciesOf() strips the owner ("Iono's Bellibolt ex" -> "Bellibolt"),
 *      the mechanic suffix and "Mega". It is the same function, moved here
 *      word for word, and build-pokemon.mjs imports it from this file (since
 *      later on 11 November 2026; it carried its own copy for a few hours).
 *      This is the only definition: change it here and both sides move.
 *   2. the name that is left is looked up in a tally built from the printing
 *      corpus (public/data/printings/*.json), where every Pokemon card carries
 *      its National Dex number. That is what resolves "Galarian Zigzagoon",
 *      "Radiant Charizard" and "Bloodmoon Ursaluna" without a list of prefixes
 *      anybody has to maintain: the corpus already knows which dex number
 *      those names were printed under.
 *
 * A Trainer or an Energy is in the corpus as its own category and never enters
 * the tally, so it resolves to nothing and gets no link. Nothing here guesses.
 *
 * ONLY INDEXABLE PAGES ARE RETURNED. build-pokemon.mjs writes a page for every
 * species and ships about 170 of them noindex because they cannot put a price
 * on a card yet. public/data/pokemon-index.json carries that decision as
 * `index`, the same flag build-pages.mjs filters the sitemap on, and a species
 * whose flag is false gets no link from here.
 *
 * THE INDEX IS READ FROM THE LAST BUILD by the two set guide builders, because
 * build-all.mjs runs them before build-pokemon.mjs. Every species page exists
 * either way, so a link can never 404; the worst a stale flag can do is link
 * one noindex page, or skip one newly indexable page, until the next build.
 * A clone with no index at all gets no links and builds as before.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/** "Mega Charizard ex" and "Team Rocket's Mewtwo" both come back "Charizard"/"Mewtwo". */
export function speciesOf(name) {
  let n = String(name || "").trim();
  // A Trainer's Pokemon files under the Pokemon. Split on the LAST possessive so
  // two-word owners work too: "Team Rocket's Mewtwo" is one owner, not two.
  if (n.includes("'s ")) n = n.split("'s ").pop();
  n = n.replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)$/, "");
  n = n.replace(/^Mega\s+/, "");
  return n.trim();
}

/**
 * Returns `speciesLink(cardName)`: `{ slug, name, href }` for a card whose
 * species has an indexable page, otherwise null.
 */
export async function loadSpeciesLinks(root) {
  let index = [];
  try {
    index = JSON.parse(await readFile(join(root, "public/data/pokemon-index.json"), "utf8")).pokemon || [];
  } catch {
    return () => null; // run: node scripts/build-pokemon.mjs
  }
  const byId = new Map(index.map((p) => [p.id, p]));

  // name -> dex number, most common wins: build-pokemon.mjs's nameToDex.
  const nameToDex = new Map();
  const dir = join(root, "public/data/printings");
  for (const f of await readdir(dir).catch(() => [])) {
    if (!f.endsWith(".json") || f === "manifest.json") continue;
    for (const c of JSON.parse(await readFile(join(dir, f), "utf8"))) {
      if (c.c !== "Pokemon" || !c.d || c.u) continue;
      const sp = speciesOf(c.n);
      if (!sp) continue;
      if (!nameToDex.has(sp)) nameToDex.set(sp, new Map());
      const tally = nameToDex.get(sp);
      tally.set(c.d, (tally.get(c.d) || 0) + 1);
    }
  }
  const dexIdFor = (sp) => {
    const tally = nameToDex.get(sp);
    return tally ? [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  };

  const memo = new Map();
  return function speciesLink(cardName) {
    const key = String(cardName || "");
    if (!memo.has(key)) {
      const p = byId.get(dexIdFor(speciesOf(key)));
      memo.set(key, p && p.slug && p.index !== false ? { slug: p.slug, name: p.name, href: `/pokemon/${p.slug}.html` } : null);
    }
    return memo.get(key);
  };
}
