// The deck corpus, resolved against the site's own card data.
//
// Imported by scripts/build-decks.mjs and scripts/build-playable.mjs. It exists
// so the two pages cannot disagree: they print the same format banner, the same
// sample size, the same wording for what the ranking measures, and they resolve
// a card to a picture the same way.
//
// THE SET CODE MAP IS VERIFIED BY DATA, NOT REMEMBERED. Limitless writes set
// codes like TWM, MEG and PR-SV; this site keys everything by its own slugs
// (twilight-masquerade, mega-evolution). Getting one wrong would put the wrong
// picture next to a card name, which is the kind of error that looks fine.
//
// So `checkSetMap` re-derives the answer on every build instead of trusting the
// table: for every printing in the corpus it looks up (slug, number) in
// public/data/card-index.json and compares the NAME the site holds against the
// name Limitless wrote. On 2026-08-16 that was 262 of 271 distinct printings
// matched exactly, 0 mismatched, and 9 unresolved for the honest reason that
// the site has no such set (8 basic energies from the MEE energy set and 1
// PR-SV promo). The build fails on a MISMATCH, and only warns on an unresolved
// code, because those two mean different things: a mismatch means the map is
// wrong, an unresolved code means we simply do not cover that set and the card
// correctly renders without a picture.
//
// WHY THE PICTURE MATTERS ENOUGH TO DO THIS. Both pages are lists of cards, and
// a list of card names with no cards on it is a worse page than the same list
// with them. TCGdex urls are the ones that get avifPicture() and imgDims() for
// free, and card-index.json holds nothing but TCGdex bases, so every image
// these pages emit is on the cheap host by construction.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Limitless set code -> this site's set slug.
 *
 * EVERY ENTRY IS CHECKED AT BUILD TIME by checkSetMap below, so this table is a
 * hypothesis rather than an authority. Add a code here and the build will tell
 * you whether you were right.
 *
 * Deliberately absent, because the site holds no such set and the cards render
 * without a picture rather than with a wrong one:
 *   MEE     the basic Energy sheet that ships with the Mega Evolution era
 *   PR-SV   Scarlet & Violet Black Star Promos
 */
export const SET_CODES = {
  ASC: "ascended-heroes",
  BLK: "black-bolt",
  CRI: "chaos-rising",
  DRI: "destined-rivals",
  JTG: "journey-together",
  MEG: "mega-evolution",
  PBL: "pitch-black",
  PFL: "phantasmal-flames",
  POR: "perfect-order",
  PRE: "prismatic-evolutions",
  SCR: "stellar-crown",
  SFA: "shrouded-fable",
  SSP: "surging-sparks",
  SVI: "scarlet-violet",
  TEF: "temporal-forces",
  TWM: "twilight-masquerade",
  WHT: "white-flare",
};

/** Load the corpus and the card index together. */
export async function loadDecks() {
  const d = JSON.parse(await readFile(join(ROOT, "data/decks.json"), "utf8"));
  if (!d.checked) throw new Error("decks.json has no checked date");
  if (!d.decks?.length) throw new Error("decks.json holds no decks");

  const idx = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
  const noScan = new Set(
    JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases || []
  );

  // (slug, unpadded number) -> the site's own record, which carries the
  // canonical zero-padded number the image url needs.
  const byKey = new Map();
  for (const [name, slug, number, rarity, price] of idx.cards) {
    byKey.set(`${slug}|${Number(number)}`, { name, slug, number, rarity, price });
  }

  const setNames = idx.sets || {};
  const imgBase = idx.imgBase || {};

  /** Resolve one decklist entry to a card with a picture, or to a bare name. */
  const resolve = (c) => {
    const slug = SET_CODES[c.set];
    const hit = slug ? byKey.get(`${slug}|${Number(c.number)}`) : null;
    if (!hit || !imgBase[slug]) {
      return { ...c, slug: null, img: null, setName: null, rarity: null };
    }
    const base = `${imgBase[slug]}/${hit.number}`;
    return {
      ...c,
      slug,
      setName: setNames[slug] || slug,
      rarity: hit.rarity || null,
      // data/no-scan.json records bases TCGdex answers 404 for. Skipping up
      // front costs nothing; emitting one costs a dead round trip and a gap.
      img: noScan.has(base) ? null : `${base}/low.webp`,
    };
  };

  return { d, resolve, byKey, setNames, imgBase };
}

/**
 * Re-derive the set map from the data and fail loudly if it is wrong.
 * Returns a small report the builders print, so a drift shows up in the log
 * rather than only in an exception nobody sees.
 */
export function checkSetMap(d, byKey) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const seen = new Map();
  for (const arch of d.decks) {
    for (const list of arch.lists) {
      for (const sec of Object.values(list.cards)) {
        for (const c of sec) seen.set(`${c.set}|${c.number}`, c);
      }
    }
  }
  let matched = 0;
  const unresolved = new Map();
  const wrong = [];
  for (const c of seen.values()) {
    const slug = SET_CODES[c.set];
    if (!slug) {
      unresolved.set(c.set, (unresolved.get(c.set) || 0) + 1);
      continue;
    }
    const hit = byKey.get(`${slug}|${Number(c.number)}`);
    if (hit && norm(hit.name) === norm(c.name)) matched += 1;
    else wrong.push(`${c.set} ${c.number} "${c.name}" -> ${slug} holds "${hit?.name || "nothing"}"`);
  }
  if (wrong.length) {
    throw new Error(
      `SET_CODES in shared/decks.mjs is wrong for ${wrong.length} printing(s), so a ` +
        `card would be drawn with another card's picture:\n  ${wrong.slice(0, 8).join("\n  ")}`
    );
  }
  return { printings: seen.size, matched, unresolved };
}

/**
 * Rank the corpus by how many decklists play each card.
 *
 * THE METRIC IS DECK INCLUSION and the pages say so in those words: the number
 * of collected decklists that play at least one copy. Total copies is carried
 * as the tie-break and is printed beside it, because the two answer different
 * questions and a card played as a 4-of in half the field is a different animal
 * from one played as a 1-of in all of it.
 *
 * A PRINTING IS NOT A CARD. Four players can register the same Ultra Ball off
 * four different sets, and counting printings would split one staple into four
 * entries that each look marginal. So cards are grouped by NAME, the most
 * common printing supplies the picture and the set line, and the other
 * printings are counted and reported rather than dropped.
 */
export function rankCards(d, resolve) {
  const byName = new Map();
  let lists = 0;
  for (const arch of d.decks) {
    for (const list of arch.lists) {
      lists += 1;
      const inThis = new Map();
      for (const [section, cards] of Object.entries(list.cards)) {
        for (const c of cards) {
          const key = c.name;
          let e = byName.get(key);
          if (!e) {
            e = {
              name: c.name,
              section,
              // `lists`, NOT `decks`. It is incremented once per DECKLIST
              // below, and this field was called `decks` while counting lists.
              // The page then inferred "a staple of exactly one deck lands on
              // 21" from a corpus holding 18 archetypes, which is a quantity
              // that cannot exist. `archetypes` beside it is the real deck
              // count. Renamed so the name states the unit.
              lists: 0,
              copies: 0,
              printings: new Map(),
              archetypes: new Set(),
            };
            byName.set(key, e);
          }
          e.copies += c.qty;
          e.archetypes.add(arch.name);
          const pk = `${c.set}|${c.number}`;
          const p = e.printings.get(pk) || { ...c, n: 0 };
          p.n += c.qty;
          e.printings.set(pk, p);
          inThis.set(key, (inThis.get(key) || 0) + c.qty);
        }
      }
      for (const key of inThis.keys()) byName.get(key).lists += 1;
    }
  }

  const ranked = [...byName.values()]
    .map((e) => {
      const printings = [...e.printings.values()].sort((a, b) => b.n - a.n);
      return {
        name: e.name,
        section: e.section,
        lists: e.lists,
        copies: e.copies,
        archetypes: e.archetypes.size,
        printingCount: printings.length,
        card: resolve(printings[0]),
      };
    })
    .sort(
      (a, b) =>
        b.lists - a.lists || b.copies - a.copies || a.name.localeCompare(b.name)
    );

  return { ranked, lists };
}
