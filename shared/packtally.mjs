// The channel's own pack tally, derived ONCE at build time and imported by
// every page that prints it.
//
// WHY THIS EXISTS. /tcg-live.html can say a thing no general guide to that app
// can: how many code cards have actually come out of the packs on this channel.
// Pokemon states that every booster pack contains a TCG Live code card, and
// public/data/videos.json carries a per-video `packs` count, so the two together
// give a number that is ours. The moment that number is typed into a page it is
// stale, because the catalogue grows every night, so nothing here is hardcoded
// and every page that quotes a figure imports it from this file.
//
// ---------------------------------------------------------------------------
// WHAT `packs` ACTUALLY IS, because the whole tally rests on it.
//
// It is the "Packs" columns of the video log, summed per row by
// scripts/import-sheet.mjs (see the long comment at its `num` helper). It is a
// human counting booster packs opened in that video, entered per set. It is NOT
// derived from the product type and it is NOT a box's advertised contents, so a
// Poke Ball Tin with no pack count contributes nothing rather than contributing
// a guess. That is why every figure below is described as COUNTED and never as
// a total: 241 of 313 videos carry a count, so the true number of packs opened
// on the channel is higher than anything here. A floor is honest. A guess is not.
//
// ---------------------------------------------------------------------------
// ENGLISH ONLY, AND THIS IS THE CAREFUL PART.
//
// data/tcg-live.json's `codeCards.noCodeInThePack` records that NO SOURCE WAS
// FOUND, in either direction, on whether a Japanese, Korean or Chinese pack
// carries a code that is redeemable in the English TCG Live client. Pokemon's
// July 2025 announcement is about "all Pokemon TCG booster packs" in the
// English-language product line, and data/tcg-live-PLAN.md lists any claim about
// non-English pack codes under what to leave out.
//
// So the headline figure EXCLUDES them and says so on the page. It is a smaller
// number than the one on the openings index and that is the point: the narrower
// number is the one that can be stood behind.
//
// THE EXCLUSION IS BY SET, NOT BY PRODUCT TYPE, and that is not a preference.
// Filtering on the japanese-pack / korean-pack / chinese-pack product tags alone
// misses jO7K2zX6Rlg, a Japanese Violet ex pack tagged `single-pack`, and lets
// one Japanese pack into an "English packs" figure. INTL_SET_IDS is the
// taxonomy's own answer to "is this a non-English set" and it catches both
// shapes. Filtering on BOTH is belt and braces and costs nothing.
//
// ---------------------------------------------------------------------------
// THE PER-SET SPLIT ONLY USES SINGLE-SET VIDEOS, and it has to.
//
// The sheet holds a pack count PER SET, but videos.json stores only the row
// total, so a rip of an ex Premium Collection tagged with three sets has one
// number and no way to divide it. Attributing all of it to the first set would
// invent a figure. Those videos are therefore counted in the headline total and
// left out of the per-set split, which makes every per-set number a floor as
// well. `unattributed` reports how much is sitting outside the split so a later
// reader can see the size of the gap rather than assume there is none.

import { readFile } from "node:fs/promises";
import { CARD_SETS, INTL_SET_IDS } from "./taxonomy.mjs";

const NON_ENGLISH_PRODUCTS = new Set(["japanese-pack", "korean-pack", "chinese-pack"]);

const { videos } = JSON.parse(
  await readFile(new URL("../public/data/videos.json", import.meta.url), "utf8")
);

const SET_LABEL = new Map(CARD_SETS.map((s) => [s.id, s.label]));

/** True when the rip is of a non-English pack, by set tag or by product tag. */
const isNonEnglish = (v) =>
  (v.sets || []).some((s) => INTL_SET_IDS.has(s)) ||
  (v.products || []).some((p) => NON_ENGLISH_PRODUCTS.has(p));

const counted = videos.filter((v) => v.packs > 0);
const english = counted.filter((v) => !isNonEnglish(v));
const nonEnglish = counted.filter(isNonEnglish);
const sum = (list) => list.reduce((n, v) => n + v.packs, 0);

// The per-set split. Single-set rips only; see the header.
const bySetMap = new Map();
for (const v of english) {
  if ((v.sets || []).length !== 1) continue;
  const id = v.sets[0];
  bySetMap.set(id, (bySetMap.get(id) || 0) + v.packs);
}
const bySet = [...bySetMap.entries()]
  .map(([id, packs]) => ({ id, packs, label: SET_LABEL.get(id) || id }))
  .sort((a, b) => b.packs - a.packs || a.id.localeCompare(b.id));

const englishPacks = sum(english);

/**
 * Everything a page might want to print, already added up.
 *
 * Every field is a COUNT OF WHAT WAS RECORDED, never an estimate of what was
 * opened. Read the header before quoting any of it on a page.
 */
export const PACKS = {
  /** Every pack counted in any rip, English or not. What /openings/ prints. */
  counted: sum(counted),
  /** Rips carrying a pack count at all. */
  countedRips: counted.length,

  /** Packs counted in rips of English packs only. THE FIGURE THE APP PAGES USE. */
  english: englishPacks,
  /** Rips those English packs came out of. */
  englishRips: english.length,

  /** The non-English packs deliberately held out of the figure above. */
  nonEnglish: sum(nonEnglish),
  nonEnglishRips: nonEnglish.length,

  /** Distinct English expansions those counted English packs came from. */
  englishSets: new Set(english.flatMap((v) => v.sets || [])).size,

  /** English packs per set, biggest first. Single-set rips only. */
  bySet,
  /** The biggest single-expansion pile, which is the one worth naming. */
  top: bySet[0] || null,
  /** English packs sitting outside the per-set split, so the gap is visible. */
  unattributed: englishPacks - bySet.reduce((n, s) => n + s.packs, 0),
};

// A guard rather than a comment. Every figure above is a sum of positive
// integers, so a zero here means videos.json arrived empty or lost its `packs`
// fields, which is exactly the silent failure import-sheet.mjs records having
// shipped once: a formula column read as blank took the site's pack total to 0
// and nothing complained. A page that prints "0 code cards" is worse than a
// build that stops.
if (!(PACKS.english > 0) || !PACKS.top) {
  throw new Error(
    "packtally: no English packs counted in public/data/videos.json. " +
      "Either the catalogue is empty or the `packs` field was dropped on import."
  );
}
