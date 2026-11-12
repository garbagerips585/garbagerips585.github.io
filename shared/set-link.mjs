/* A SET NAME IN A SENTENCE -> A LINK TO THAT SET'S GUIDE. 11 November 2026.
 *
 * WHY THIS EXISTS. An SEO audit of the built tree found Delta Reign, five days
 * old and with a full guide at /sets/delta-reign.html, named on /upcoming.html,
 * /start.html, /what-to-buy.html and /drops.html without one link to that guide
 * between them. The names were all in hand-written data (data/drops.json rows,
 * data/upcoming.json blurbs) or in video titles, which no builder linked.
 *
 * IT TAKES RAW TEXT AND RETURNS HTML, AND THAT IS THE WHOLE SAFETY ARGUMENT.
 * linkSetNames() is never handed markup: it splits a plain string on the set
 * names it finds, escapes every piece itself, and wraps only the matches. It
 * therefore cannot nest a link inside a link or write inside an attribute,
 * because the string it works on has neither. Do not "save a step" by calling
 * it on text that has already been through esc() or already carries tags.
 *
 * WHICH NAMES ARE LINKED. Every English guide in public/data/sets.json, plus
 * the guides that live outside /sets/ and say what they are called below.
 * Left out, because the words mean something else at least as often:
 *
 *   a set whose name is also a series name   "Mega Evolution", "Scarlet &
 *                                            Violet": a restock row saying
 *                                            "Mega Evolution products" means
 *                                            the series
 *   a one-word name                          "Celebrations"
 *   "Pokémon GO"                             the phone game
 *
 * A NUMERIC NAME ("151") IS LINKED ONLY IN FRONT OF A PRODUCT WORD, so "151
 * Mini Tins" links and "November 15", "$151" and "the first 151 Pokemon" never
 * can.
 *
 * ONE LINK PER SET PER `seen` SET. Pass the same Set to every call on a page
 * and each guide is linked at its first mention only; a restock page that says
 * "30th Celebration" nine times gets one link, not nine.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Guides built outside /sets/ (see shared/guide-count.mjs), by the id the
// video tagger uses and the name they are written as in prose.
const OUTSIDE = [{ id: "30th-celebration", name: "30th Celebration", href: "/30th-celebration.html" }];
const NOT_A_SET_IN_PROSE = new Set(["Pokémon GO", "Pokemon GO"]);
const PRODUCT_WORD =
  "(?:Mini Tins?|Booster|Elite Trainer|ETBs?|Ultra Premium|UPCs?|Poster|Binder|Bundles?|Tins?|Blisters?|Collections?|packs?|products?)";
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns { hrefFor(id), nameFor(id), linkSetNames(text, esc, seen), newest }.
 * A clone with no public/data/sets.json links nothing and builds as before.
 */
export async function loadSetLinks(root) {
  let sets = [];
  try {
    sets = JSON.parse(await readFile(join(root, "public/data/sets.json"), "utf8")).sets || [];
  } catch {
    /* run: node scripts/sync-sets.mjs */
  }
  const guides = [
    ...sets.map((s) => ({ id: s.id, name: s.name, href: `/sets/${s.id}.html`, released: s.released || "" })),
    ...OUTSIDE,
  ];
  const byId = new Map(guides.map((g) => [g.id, g]));
  const series = new Set(sets.map((s) => s.series).filter(Boolean));

  const linkable = guides.filter(
    (g) => g.name && !series.has(g.name) && !NOT_A_SET_IN_PROSE.has(g.name) && (/\s/.test(g.name) || /^\d+$/.test(g.name)),
  );
  // Longest name first, so a name that contains another one wins the match.
  linkable.sort((a, b) => b.name.length - a.name.length);
  const alt = linkable
    .map((g) => (/^\d+$/.test(g.name) ? `${reEsc(g.name)}(?= ${PRODUCT_WORD}\\b)` : reEsc(g.name)))
    .join("|");
  const re = alt ? new RegExp(`(?<![\\p{L}\\p{N}$#.,'-])(?:${alt})(?![\\p{L}\\p{N}])`, "gu") : null;
  const byName = new Map(linkable.map((g) => [g.name, g]));

  function linkSetNames(text, esc, seen = new Set()) {
    const s = String(text ?? "");
    if (!re) return esc(s);
    let out = "";
    let at = 0;
    for (const m of s.matchAll(re)) {
      const g = byName.get(m[0]);
      if (!g || seen.has(g.id)) continue;
      seen.add(g.id);
      out += `${esc(s.slice(at, m.index))}<a href="${esc(g.href)}">${esc(m[0])}</a>`;
      at = m.index + m[0].length;
    }
    return out + esc(s.slice(at));
  }

  const newest = [...sets].filter((s) => s.released).sort((a, b) => b.released.localeCompare(a.released));
  return {
    hrefFor: (id) => byId.get(id)?.href || null,
    nameFor: (id) => byId.get(id)?.name || null,
    linkSetNames,
    /** English guides, newest release first: { id, name, released, ... } from sets.json. */
    newest,
  };
}
