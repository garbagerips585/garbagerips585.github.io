/**
 * WHERE A CARD SCAN CAN STILL BE FOUND, AND WHAT A SLOT SHOWS WHEN IT CANNOT.
 *
 * Two exports, and they are the two halves of one question a tile asks about
 * every card on it: is there a picture, and if there is not, what goes in the
 * hole. They live together because answering the first badly is how the second
 * one starts firing, and because four builders ask both.
 *
 * ==========================================================================
 * PART ONE: corpusScan. THE SECOND PLACE A JAPANESE SCAN LIVES.
 * ==========================================================================
 *
 * public/data/intl-guides.json is the checklist an intl row resolves against,
 * and its `image` field is null for every card in six of its thirteen guides.
 * The note this replaced recorded that correctly and treated it as the end of
 * the story: "a set with no scans".
 *
 * IT IS NOT THE END OF THE STORY FOR THREE OF THE SIX. public/data/printings
 * /*.json is a different sync's output (sync-all-printings.mjs, 39,707
 * printings across 370 sets, 29,934 of them with an image) and it holds the
 * SAME sets with their scans. Counted on disk, 2026-08-21:
 *
 *       set                intl-guides scans   printings corpus scans
 *       メガシンフォニア        0 of 92               92 of 92
 *       ニンジャスピナー        0 of 120             120 of 120
 *       サイバージャッジ        no card list         100 of 100
 *       アビスアイ              0 of 118               0 of 118
 *       ムニキスゼロ            0 of 117               0 of 117
 *       メガブレイブ            0 of 92                0 of 92
 *
 * So 312 scans were reachable and never asked for, which is the same shape as
 * the `img: null` literal that hid 671 of them until 21 August 2026. The bottom
 * three are a real TCGdex gap and stay absent.
 *
 * ==========================================================================
 * THIS FILE EXISTS BECAUSE THE NOTE IN build-hall.mjs SAID IT WOULD.
 * ==========================================================================
 *
 * That builder held this function privately and its own header ended: "It stays
 * in this file rather than moving into shared/intl-printing.mjs. That module is
 * a pure function about a rule, argued at length as one; this reads two files
 * off disk to answer a different question. build-pages.mjs has the identical
 * gap on the identical rows and would want the identical three lines, but that
 * file is not this pass's to edit."
 *
 * That is now three more callers, so the choice is not "one private copy" any
 * more, it is four of them. CLAUDE.md has the receipt for what four private
 * copies of one lookup cost: five builders each holding a `gradedPrice()` is
 * how Mega Greninja ex printed $906 on two pages and $838 on fifty-four for
 * three days. THE PURITY ARGUMENT WAS RIGHT AND IT WAS AN ARGUMENT ABOUT
 * shared/intl-printing.mjs, NOT ABOUT SHARING. So intl-printing.mjs stays pure
 * and this is its impure neighbour: same subject, different guarantee.
 *
 * ==========================================================================
 * IT LOOKS UP A PICTURE. IT DOES NOT PICK A PRINTING.
 * ==========================================================================
 *
 * shared/intl-printing.mjs owns which printing an intl hit is, and the four
 * callers must never disagree about that. Nothing here touches it: corpusScan
 * is called ONLY after pickIntlPrinting has already chosen a printing, and it
 * is keyed on that printing's own (set, collector number). A card the rule
 * refuses still gets no number and no scan. Frogadier in ニンジャスピナー is the
 * case that proves it: the corpus holds scans for BOTH #021 and #087, the rule
 * cannot separate them, and this returns nothing rather than choosing a picture
 * the page cannot name.
 *
 * TWO FIELDS ARE CROSS-CHECKED BEFORE THE URL IS TAKEN, because (set, number)
 * being a primary key in both files is an assumption rather than a promise, and
 * a scan silently moved onto the wrong card is worse than no scan. The corpus
 * record has to agree with the guide on the NATIVE CARD NAME and on the RARITY.
 * Both files are TCGdex output, so agreement is cheap where the row is
 * genuinely the same row and impossible where it is not. Verified on the one
 * card this fires for today: guide ja-mega-symphonia #018 is メガユキノオーex
 * "Double rare"; corpus メガシンフォニア #018 is メガユキノオーex "Double rare" at
 * assets.tcgdex.net/ja/M/M1S/018, whose low/high webp and avif all answer 200
 * (27,672 / 146,992 / 18,327 / 92,706 bytes, checked 2026-08-21).
 *
 * THE CORPUS STORES THE TRANSLATED NAME WHERE IT HAS ONE AND THE NATIVE NAME
 * WHERE IT DOES NOT (`u` is 1 for untranslated, `p` carries the native name
 * when `n` is a translation), and it is SHARDED BY THE FIRST LETTER OF `n`.
 * That is why both shards are tried: this card is filed under "0" because its
 * name is untranslated Japanese, and a lookup that only tried the English
 * name's shard would have found nothing and reported "no scan for that set".
 */

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The bases TCGdex does not have. Loaded here rather than taken from a caller
// because this module returns a url and is the last thing standing between a
// withdrawn base and an <img> that pays for a round trip to remove itself.
let NO_SCAN = new Set();
try {
  NO_SCAN = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases || []);
} catch {
  /* optional: a missing base then renders as an img that removes itself */
}

const shardCache = new Map();
async function shard(name) {
  const c = String(name || "").trim()[0]?.toLowerCase() ?? "0";
  const key = /[a-z]/.test(c) ? c : "0";
  if (!shardCache.has(key)) {
    try {
      shardCache.set(key, JSON.parse(await readFile(join(ROOT, `public/data/printings/${key}.json`), "utf8")));
    } catch { shardCache.set(key, []); }
  }
  return shardCache.get(key);
}
const scanNorm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿가-힯]/g, "");

/**
 * @param {string} setNative the guide's own native set name, which is the
 *        name the printings corpus files that set under.
 * @param {{localId:string, en:?string, native:?string, rarity:?string}} card
 *        the printing ALREADY chosen by shared/intl-printing.mjs. Never a
 *        candidate.
 * @returns {Promise<?string>} the TCGdex image base, or null.
 */
export async function corpusScan(setNative, card) {
  if (!setNative || !card?.localId) return null;
  for (const nm of [card.en, card.native]) {
    if (!nm) continue;
    for (const rec of await shard(nm)) {
      if (rec.s !== setNative || String(rec.i) !== String(card.localId)) continue;
      // The two cross-checks. A disagreement means these are not the same row
      // and the answer is nothing, per every caller's standing rule.
      if (scanNorm(rec.r) !== scanNorm(card.rarity)) continue;
      const native = rec.u ? rec.n : rec.p;
      if (card.native && native && scanNorm(native) !== scanNorm(card.native)) continue;
      const base = rec.g ? String(rec.g).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "") : null;
      // data/no-scan.json applies here exactly as it applies to the guide's own
      // image field: a base TCGdex has withdrawn renders as a dead round trip
      // behind an onerror, which is what that file exists to prevent.
      return base && !NO_SCAN.has(base) ? base : null;
    }
  }
  return null;
}

/* ==========================================================================
 * PART TWO: THE PANEL. WHAT A CARD SLOT WITH NO SCAN SHOWS.
 * ==========================================================================
 *
 * Tim, on the whole site: "there should be no empty place holder images
 * anywhere on the site." Seventeen slots were one -- six hit cards on four rip
 * pages, eleven `mine` tiles on eight set guides -- plus fourteen plaques on
 * /hall.html that were doing something else and are now doing this.
 *
 * THE SHAPE IS ALREADY DECIDED AND THE ARGUMENT FOR IT IS NOT MINE. Two rules
 * in assets-source/ui.css settled it between them and this only obeys both:
 *
 *  - `.set-noart` (five sets with no logo file): "The slot used to be filled
 *    with the set's NAME, which the <b> underneath already prints, so those
 *    five tiles showed the same words twice and looked broken rather than
 *    degraded. Hold the box so the grid does not jump and hatch it ... It is
 *    aria-hidden in the markup, so this is decoration only and the tile still
 *    announces its name once."
 *  - `.hitcard-img.is-none` and `.mine-img.is-none`: the same hatch, for the
 *    same reason, on a card with no scan.
 *
 * So the box, the hatch and the aria-hidden are not new. What is new is that
 * the hatch was ALL that was in there, and a hatch on its own is the empty
 * placeholder the instruction is about.
 *
 * TWO THINGS GO IN IT AND NEITHER MAY BE THE CARD.
 *
 *  1. THE SET'S OWN SYMBOL, where we hold one. It is a real published mark of
 *     the exact set the card came out of, it is a 40px glyph rather than a
 *     card face so nothing about it reads as a scan, and the files are already
 *     mirrored locally by sync-symbols.mjs at 0.4 to 1.8KB each. On a set guide
 *     the page header has already fetched the same file, so it is a cache hit
 *     and costs a request on nothing but the four rip pages.
 *
 *     ONLY WHERE EXACTLY ONE EXPANSION MATCHES. public/data/expansions.json
 *     carries `slug` for the 28 guides and null for the other 146, so the
 *     lookup falls back to the set NAME and refuses a tie. A symbol is a claim
 *     about which set this is, and this file does not make one it cannot check.
 *
 *  2. THE WORDS "No scan", on an opaque plate. The tile already prints "No
 *     price" or "No market price" in the same register two lines down, so this
 *     is that sentence about the picture rather than a new voice. The plate is
 *     /shops.html's own lesson: a label over a busy ground goes on an opaque
 *     one. #D4CCBC on --page measures 7.93:1; on the bare hatch it would be
 *     4.57:1 at the light stripe, which passes and reads badly.
 *
 * WHY NOT TRUBBISH. The site's mascot grammar is settled and it does not fit:
 * build-search.mjs, build-locals.mjs and build-pokemon.mjs all say Trubbish
 * means "there is nothing in this one", and build-pokemon.mjs turned him down
 * for exactly this reason -- "A mascot here would have been the opposite of
 * true". A card WAS pulled out of this pack. Putting the empty-container mascot
 * on it would say the rip produced nothing, which is the one thing these tiles
 * exist to contradict.
 *
 * WHY NOT THE CARD'S NAME. That is `.set-noart`'s finding above, verbatim: the
 * tile prints the name directly underneath, and printing it twice looked
 * broken. /hall.html's `.chof-noart` was the last place still doing it and this
 * is what took it off.
 *
 * WHY NOT DELETE THE SLOT. These grids are pictures of cards. A tile with the
 * picture removed is a text block in a row of card faces, which reads as a
 * different kind of thing rather than as the same thing with a gap, and the
 * grid's row height comes off the ratio box.
 *
 * IT IS aria-hidden AND THAT IS THE EXISTING CALL RATHER THAN A NEW ONE. The
 * tile names the card, the set, the rarity and the missing price already. A
 * reader who cannot see the grid perceives no hole to explain, and a second
 * absence announced per card is the duplication /hall.html's accessibility pass
 * spent a night removing.
 */

/**
 * The rules. Ship them in a page's own <style>, and ONLY on a page that emitted
 * a panel: they are render-blocking bytes on 319 rip pages otherwise, and 315
 * of those have every scan they need.
 *
 * TWO-CLASS SELECTORS ON PURPOSE. `.hitcard-img` and `.chof-noart` both set
 * display and `.chof-art img` sets four properties the symbol has to shed, so a
 * one-class rule would be settled by source order on one page and lost outright
 * on another. `.is-none.noscan` is (0,2,0) against `.hitcard-img`'s (0,1,0) and
 * `.noscan .noscan-s` is (0,2,0) against `.chof-art img`'s (0,1,1).
 */
export const NOSCAN_CSS = `.is-none.noscan,.chof-noart.noscan{display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:6px;padding:8%;box-sizing:border-box;
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
.noscan .noscan-s{aspect-ratio:auto;object-fit:contain;background:none;opacity:.92}
.noscan .noscan-t{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);background:var(--page);padding:4px 7px;border-radius:999px;text-align:center}`;

/** Drawn at 40 CSS px, the same box build-set-pages.mjs already draws one in. */
const SYMBOL_BOX = 40;
let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(readFileSync(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* run: node scripts/sync-symbols.mjs. No symbol then, and the panel is words. */
}

// slug -> apiId for the 28 guides, normalised name -> apiId for all 174, and a
// name that resolves to two apiIds resolves to none. Built once.
const BY_SLUG = new Map();
const BY_NAME = new Map();
try {
  const sets = JSON.parse(readFileSync(join(ROOT, "public/data/expansions.json"), "utf8")).sets || [];
  const nameKey = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  for (const s of sets) {
    if (s.slug) BY_SLUG.set(s.slug, s.apiId);
    const k = nameKey(s.name);
    if (!k) continue;
    BY_NAME.set(k, BY_NAME.has(k) ? null : s.apiId);
  }
} catch {
  /* no expansions file, no symbols, and every panel is words. */
}
const nameKey = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/**
 * The <img> for one set symbol, or "" where we hold no unambiguous one.
 *
 * @param {?string} slug the set id a hit or a guide carries, e.g. paradox-rift.
 * @param {?string} name the set name as written, e.g. "Silver Tempest". Used
 *        only when the slug misses, which is every set outside the 28 guides.
 */
export function symbolTag(slug, name) {
  const apiId = (slug && BY_SLUG.get(slug)) || BY_NAME.get(nameKey(name)) || null;
  const d = apiId && SYMBOL_DIMS[apiId];
  if (!d) return "";
  // Scale the manifest's REAL size into the 40px box, so the attributes reserve
  // the right shape rather than a square: base1 comes out 48x25.
  const k = Math.min(SYMBOL_BOX / d[0], SYMBOL_BOX / d[1], 1);
  const [w, h] = [Math.round(d[0] * k), Math.round(d[1] * k)];
  // THE SIZE IS AN INLINE STYLE AS WELL AS AN ATTRIBUTE, AND THAT WAS MEASURED
  // RATHER THAN BELT-AND-BRACES. `.chof-art img` in build-hall.mjs sets
  // width:100% at (0,1,1), so the first version of this rule shed it with
  // width:auto;height:auto -- which throws the ATTRIBUTES away too. Driven at
  // 1440 over CDP, the SVP symbol then drew at its natural 48x44 rather than
  // the declared 40x37, and every one of them measured 0x0 until it decoded, so
  // the attributes were reserving nothing and the panel re-centred on arrival.
  // An inline style beats every selector and holds before the file lands, which
  // is what makes the box honest at both ends.
  return `<img class="noscan-s" src="/assets/symbols/${esc(apiId)}-pokemon-tcg-set-symbol.webp"` +
    ` width="${w}" height="${h}" style="width:${w}px;height:${h}px" alt=""` +
    ` loading="lazy" decoding="async">`;
}

/**
 * The whole panel.
 *
 * @param {string} cls the caller's own class on the box, so each grid keeps the
 *        ratio and the border it already had.
 * @param {object} [opts]
 * @param {?string} opts.slug set id, for the symbol. Omit for no symbol.
 * @param {?string} opts.name set name, for the symbol when the slug misses.
 * @param {string}  [opts.label] the words. "No scan" is right for a CARD and
 *        wrong for a sealed box, so /sets/ passes "No photo" on its product
 *        rows. It is the only thing a caller may change about the panel.
 * @param {string}  [opts.tag] the element. An `a` keeps a product row's own
 *        link, which still goes somewhere real; everything else is a `div`.
 * @param {string}  [opts.attrs] extra attributes for that element.
 */
export const noScanBox = (cls, opts = {}) => {
  const { slug = null, name = null, label = "No scan", tag = "div", attrs = "" } = opts;
  return `<${tag} class="${cls} noscan" aria-hidden="true"${attrs}>` +
    `${symbolTag(slug, name)}<span class="noscan-t">${esc(label)}</span></${tag}>`;
};
