// Cards the per-set checklists cannot answer for, resolved out of the printings
// corpus instead.
//
// WHY THIS EXISTS. public/data/cards/ holds 28 English sets and is what every
// hit resolves against. Three kinds of real card fall outside it:
//
//   1. SUBSET CARDS. Crown Zenith's Galarian Gallery and Silver Tempest's
//      Trainer Gallery are separate set names in public/data/printings/ --
//      "Crown Zenith Galarian Gallery", "Silver Tempest Trainer Gallery" -- and
//      have no checklist of their own here. Paras GG32 and Corviknight V TG18
//      are real cards that were rendering as a bare name.
//   2. SETS WITH NO CHECKLIST AT ALL, like Silver Tempest and Lost Origin. The
//      corpus holds every card in them; only the per-set file is missing.
//   3. The rip log glues the subset onto the NAME, so it arrives as "Paras
//      Galarian Gallery" and "Corviknight V Trainer Gallery". The subset words
//      are the routing information, not part of the card's name.
//
// WHAT IT REFUSES. Same rule the checklists are held to: a name that matches
// more than one printing and a rarity that separates none of them returns null
// rather than guessing. A wrong printing is worse than no printing, which is
// the lesson of 23 August 2026 twice over.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SUBSETS = ["Galarian Gallery", "Trainer Gallery"];
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Load the shards a set of card names could live in, once. */
export async function loadCorpus(root, names) {
  const want = new Set();
  for (const n of names) {
    const c = String(n).trim()[0];
    want.add(/[a-z]/i.test(c) ? c.toLowerCase() : "0");
  }
  const out = [];
  for (const shard of want) {
    try {
      const rows = JSON.parse(await readFile(join(root, `public/data/printings/${shard}.json`), "utf8"));
      for (const r of rows) if (r && typeof r === "object") out.push(r);
    } catch { /* a shard with no cards in it is not an error */ }
  }
  return out;
}

/**
 * Resolve one logged hit against the corpus.
 * Returns { n, name, rarity, price, img, setName } or null.
 */
export function corpusCard(corpus, { card, setName, rarity }) {
  if (!corpus?.length || !card || !setName) return null;
  let name = String(card).trim();
  let set = String(setName).trim();
  // "Paras Galarian Gallery" is Paras, in Crown Zenith Galarian Gallery.
  for (const sub of SUBSETS) {
    const re = new RegExp(`\\s*${sub}$`, "i");
    if (re.test(name)) { name = name.replace(re, "").trim(); set = `${set} ${sub}`; break; }
  }
  // THE SET AND ITS SUBSETS, because the suffix is not always on the name.
  // "Paras Galarian Gallery" carries its own routing; a row that just says
  // "Paras" in "Crown Zenith" does not, and the card is still only in the
  // Gallery. So try the named set first and then each subset of it, and take
  // the first that holds the name at all. First rather than merged: a card in
  // BOTH the base set and its gallery is two different printings and merging
  // them would make every such row ambiguous.
  const tries = [set, ...SUBSETS.map((sub) => `${set} ${sub}`)];
  let same = [];
  for (const t of tries) {
    same = corpus.filter((c) => norm(c.n) === norm(name) && norm(c.s) === norm(t));
    if (same.length) { set = t; break; }
  }
  if (!same.length) return null;
  const want = norm(rarity);
  const pick =
    (want && same.find((c) => norm(c.r) === want)) ||
    (same.length === 1 ? same[0] : null);
  if (!pick) return null;
  return {
    n: pick.i || null,
    name: pick.n,
    rarity: pick.r || null,
    price: typeof pick.p === "number" ? pick.p : null,
    img: pick.g ? `${pick.g}/low.webp` : null,
    setName: pick.s || set,
  };
}
