/**
 * ASK shared/intl-printing.mjs IN THE VOCABULARY THE RIP LOG IS WRITTEN IN.
 *
 * ==========================================================================
 * WHY THIS IS A SECOND FILE AND NOT THREE LINES IN THE THREE CALLERS.
 * ==========================================================================
 *
 * It is the same argument shared/intl-printing.mjs makes about itself, and that
 * file's header has the receipt: build-hall.mjs and build-pages.mjs each held a
 * private copy of the printing rule, both carrying a comment ordering the reader
 * to change the other one in the same edit, and five builders each holding a
 * private `gradedPrice()` is how one card printed two different prices on two
 * sets of pages for three days.
 *
 * There are FOUR call sites for this decision, in three builders --
 * build-hall.mjs, build-pages.mjs, and build-intl-pages.mjs twice -- and they
 * are the plaque, the rip page and the set guide: the exact three surfaces
 * intl-printing.mjs exists to stop from naming different printings of one card.
 * A vocabulary applied at three of the four would reproduce that bug precisely.
 *
 * ==========================================================================
 * WHY IT IS NOT IN intl-printing.mjs, WHICH IS WHERE IT OTHERWISE BELONGS.
 * ==========================================================================
 *
 * Because that file holds THE RULE, and the whole point of this change is that
 * **the rule did not need changing.** All six of the rows this unblocks resolve
 * through `pickIntlPrinting` exactly as it is written today, on branch 1, with
 * that file byte for byte unchanged. Keeping the adapter outside it is what
 * makes that claim checkable by `git log` rather than by argument.
 *
 * ==========================================================================
 * THE ONE THING THIS FILE MUST NOT DO, AND IT IS EASY TO GET WRONG.
 * ==========================================================================
 *
 * **THE JAPANESE WORD GOES INTO THE QUESTION AND NEVER INTO THE ANSWER.** The
 * row handed back is the guide's OWN row, with TCGdex's `rarity` on it, not the
 * clone the question was asked with. Three things downstream read that field and
 * all three would break on a Japanese word:
 *
 *   - `corpusScan` in shared/card-scan.mjs cross-checks the chosen printing's
 *     rarity against public/data/printings, which is TCGdex's. A Japanese word
 *     there fails the check, so all six rows would resolve and then silently
 *     lose their scan on the rip page and the plaque.
 *   - build-pages.mjs and build-hall.mjs both display `m.rarity || h.rarity`,
 *     so the word would reach the page.
 *   - nothing else may see two vocabularies on one guide at once.
 *
 * So `_ask` below is a throwaway. If you find yourself returning it, re-read
 * this paragraph.
 *
 * WHERE `rarityJp` COMES FROM: scripts/sync-intl-guides.mjs, function
 * jpRarityWords, which has the whole argument for why the words are collected
 * this way and why the wide version of this change was measured and refused.
 * It is absent on every guide that has no TCGplayer pin, and absent on the rows
 * of a pinned guide where the two catalogues did not agree, and this is a no-op
 * on both -- which is why every caller can go through it unconditionally.
 */

import { pickIntlPrinting } from "./intl-printing.mjs";

/**
 * @param {Array<{rarity:?string, rarityJp:?string}>} same every printing on the
 *        intl checklist carrying the hit's name, flattened by the caller.
 * @param {?string} want the tier the rip log wrote, ALREADY normalised, or null.
 * @returns the caller's own row, untouched, or null.
 */
export function pickIntlPrintingJp(same, want) {
  if (!same.length) return null;
  const ask = same.map((c) => (c.rarityJp ? { ...c, rarity: c.rarityJp, _row: c } : { ...c, _row: c }));
  const got = pickIntlPrinting(ask, want);
  return got ? got._row : null;
}
