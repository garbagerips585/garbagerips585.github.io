#!/usr/bin/env node
// Generate a set guide for every non-English set the channel has ripped.
//
//   node scripts/sync-intl-guides.mjs   (first, writes the data)
//   node scripts/build-intl-pages.mjs   (this, writes public/sets/<id>.html)
//
// These live in /sets/ alongside the English guides and share their markup, so
// the two never drift into looking like different websites.
//
// ENGLISH LEADS, NATIVE STAYS. Roughly 95% of the audience is in the US, so the
// H1 is the English name and the native name sits under it. The native name is
// never dropped: it is the verifiable one, and it is what is printed on the pack
// somebody is holding.
//
// THE POINT OF THESE PAGES is the "same set, different name" band. Somebody who
// watched the Abyss Eye rips and then went looking for Pitch Black had no way to
// learn they are the same cards. That comparison is the reason to build them,
// so it sits above everything except the quick facts.
//
// WHAT IS NOT ON THEM. No prices: TCGdex carries Cardmarket euro figures for
// some of these and nothing at all for the newest, and half a price table is
// worse than none. No pull rates, same rule as the English guides. Trainer and
// Supporter names stay in their native script because no keyless source
// translates them and guessing at 35 of them would be exactly the sort of
// confident error a reference page must not make.
//
// **THIS PARAGRAPH USED TO SAY "no product photography" TOO, AND THE REASON
// GIVEN WAS ABOUT THIS REPO RATHER THAN ABOUT THE WORLD.** 22 August 2026.
// sync-products.mjs hardcoded `productLineName: ["pokemon"]`, so the sealed
// pull was English-only BY CONFIGURATION, and that limit was read back off our
// own data and written down as a fact about TCGplayer's catalogue: an earlier
// pass reported that they carry no non-English sealed product at all. They
// carry 308 Japanese ones. **That is the same shape of error the Garbage Plate
// page confesses to three times in CLAUDE.md: a true statement about what
// somebody looked at, written as a statement about what exists.** Eight of
// these guides carry a photograph of the actual pack now; see packBand.
//
// THE PRICE STILL IS NOT ON THEM, and that is now a decision rather than a gap,
// because products.json has one for all eight. The argument is over packBand.
//
// **ONE GUIDE'S CHECKLIST IS NOT TCGDEX'S AND EVERY BAND THAT SAYS WHOSE IT IS
// HAS TO CHECK.** 22 August 2026. TCGdex declares SV5M Cyber Judge, states a
// card count and publishes no cards for it, so that page was a noindex stub;
// sync-intl-guides.mjs now fills it from TCGplayer, whose Japanese catalogue
// carries the names, the collector numbers and the JAPANESE rarity words. The
// scans are still TCGdex's, read out of public/data/printings, so nothing about
// the pictures on this page family changed. `g.checklistFrom` is the flag, it
// is ABSENT on the other twelve, and four bands branch on it: sourceBand,
// checklistBand, rarityBand and the lede in the checklist. The reason it is a
// flag rather than a rewrite is that the words a page prints have to name the
// catalogue they came out of, and the rarity words in particular are in a
// different vocabulary from the one on the guide next to it.
//
// AND FIVE GUIDES STILL CARRY NO PHOTOGRAPH, which is a fact about the world
// this time and was checked before it was written: TCGplayer has exactly two
// Pokemon product lines and neither is Korean or Chinese. The proof, and the
// reason the Japanese pack of the same set is NOT an acceptable stand-in on a
// Korean guide, is over TCG_SET_INTL in shared/tcgplayer.mjs.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NO packplayer.js, BUT packs.css STAYS. These pages wear a .pack facade as
// decoration, so the stylesheet is doing real work; the script is not.
// THE "On the channel" LIST IS PLAIN TEXT LINKS, which is the whole reason this
// is safe and is the opposite of what shared/chrome.mjs's note assumed: it says
// every set guide plays a tile in place. Driven in headless Chrome with a real
// dispatched click, no set guide ever did. packplayer only claims an <a> to a
// rip that WRAPS an <img> or a .pack facade, and a bare <li><a>title</a> has
// neither, so those links navigated before this change and navigate after it.
// If a set guide ever grows a picture tile, put APP_JS back in the same edit.
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, FONTS,
  APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { labelFor, CARD_SETS } from "../shared/taxonomy.mjs";
import { raritiesIn, rarityLabelOf, rarityMark, RARITY_CSS } from "../shared/rarity.mjs";
import { norm, nameKeyOrThrow } from "../shared/intl-printing.mjs";
// THE RULE IS intl-printing.mjs AND IT IS UNCHANGED. This asks it in the rip
// log's own vocabulary and hands back the guide's own row; see that file.
import { pickIntlPrintingJp } from "../shared/intl-vocab.mjs";
// THE THIRD AND FOURTH CALLERS OF A LOOKUP build-hall.mjs HELD PRIVATELY. Its
// own header named build-pages.mjs as having the same gap and did not know this
// file had it too: six of the thirteen guides carry no scan in intl-guides.json
// and three of those six are complete in public/data/printings. See
// shared/card-scan.mjs for the table and for the two cross-checks.
import { corpusScan, noScanBox, NOSCAN_CSS } from "../shared/card-scan.mjs";
import { esc, longDate, shortDate, rarityLabel, imgDims, avifPicture, moneyCompact,
  productSrcsetAttr, clipMeta, nat, natRuns} from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sets");

/**
 * THE ENGLISH SET, SHOWN RATHER THAN NAMED.
 *
 * These pages exist to answer one question: "I watched the Abyss Eye rips, what
 * do I buy in a US store?" They answered it in words and the words are the weak
 * form of the answer, because the two things a person matches in a store are
 * both pictures. The logo is what is printed across the box and the pack. The
 * symbol is what is printed on the card, and it is the only way to check a
 * loose single.
 *
 * BOTH BELONG TO THE ENGLISH SET AND ARE LABELLED AS THE ENGLISH SET'S. There
 * is no Japanese or Korean logo on this site and TCGdex publishes none for
 * these sets (M1 through M5 return no logo, no symbol and no card images at
 * all), so the native column stays text. An asymmetric panel is the honest
 * shape here: putting the English artwork on the Japanese side, or captioning
 * it loosely enough to read as either, is exactly the swap the brief forbids.
 */
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* written by scripts/build-logos.py, which measures as it resizes.
     There is no measure-logos.py: it was named in five comments and had
     never been in the tree, which is how five logos came to have no
     dimensions and therefore no srcset at all. */
}
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);

/* WHICH OF THESE GUIDES HAVE THEIR OWN SHARE CARD, read off the directory
   exactly as logosOnDisk is, and for the same reason: a typed list goes stale
   the next time a file lands.

   ALL TWELVE OF THESE PAGES PREVIEWED AS THE SAME PICTURE OF A BOOSTER PACK
   until 21 August 2026, so /sets/ja-abyss-eye.html and /sets/ko-clay-burst.html
   were indistinguishable in a chat unfurl. They have no pack artwork -- there
   are 18 wrappers in assets-source/packs and none of them is a Japanese, Korean
   or Chinese print -- so scripts/build-og.py gives them the TYPOGRAPHIC card
   build-og-pages.py draws for every other page with nothing to illustrate, and
   it draws the ENGLISH name, because Titan One has no CJK glyph and because the
   English equivalent is the whole reason somebody lands on one of these.

   THE FALLBACK IS THE POINT OF READING DISK. build-og.py is deliberately not in
   build-all.mjs, so on a machine that has never run it the file is absent, this
   set is empty, every page keeps the generic card and nothing breaks. Same
   arrangement as ogCards in build-set-pages.mjs. */
const ogCardsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets")).catch(() => []))
    .map((f) => /^og-(.+)\.jpg$/.exec(f)?.[1])
    .filter(Boolean)
);

// This guide's own card where there is one, the site-wide card where there is
// not. ONE FUNCTION, spent by both the head and the Article node below, so the
// tag and the schema cannot name two different pictures.
const ogImage = (g) =>
  `${SITE}/assets/${ogCardsOnDisk.has(g.id) ? `og-${g.id}` : "og-image"}.jpg`;
/**
 * Drawn at 150px wide inside the panel. The masters are normalised by HEIGHT to
 * 300px and every one is a different width, so the -sm.webp (100px tall, 5-17KB)
 * is offered first with its own real width descriptor and the master second,
 * exactly as setCardLogo does in build-set-pages.mjs. Never emitted for a set
 * with no file: onerror hides a 404 in the browser and still pays for it.
 */
const LOGO_BOX_W = 150;
const LOGO_BOX_H = 56;
const enLogo = (setId, alt) => {
  if (!logosOnDisk.has(setId)) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  if (!d) return "";
  const smW = Math.round((d[0] * 100) / d[1]);
  // SIZES IS THE DRAWN WIDTH, WHICH object-fit:contain DECIDES, NOT THE BOX
  // WIDTH. A flat "150px" claims 300 device px at DPR2, which no -sm.webp is
  // wide enough to satisfy, so Chrome correctly reached past it for the 300px
  // tall master on every guide. contain scales by min(boxW/w, boxH/h), so the
  // drawn width is the smaller of the box width and the height-limited width,
  // and that is the number the browser needs.
  const drawnW = Math.round(Math.min(LOGO_BOX_W, (LOGO_BOX_H * d[0]) / d[1]));
  return `<img class="intl-logo" src="${base}-sm.webp"
          srcset="${base}-sm.webp ${smW}w, ${base}.webp ${d[0]}w" sizes="${drawnW}px"
          width="${smW}" height="100" alt="${esc(alt)}" loading="lazy" decoding="async">`;
};

// The TCGdex bases that answer 404, found by fetching all 4,655 image urls the
// site emits. Same file the English guides read for the same reason.
let NO_SCAN = new Set();
try {
  NO_SCAN = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases || []);
} catch {
  /* optional: a missing base then renders as an img that removes itself */
}

let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(await readFile(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* run: node scripts/sync-symbols.mjs */
}
/** 32px box here rather than the 40px the English guides use: it sits in a caption line. */
const enSymbol = (en) => {
  const d = SYMBOL_DIMS[en?.apiId];
  if (!d) return "";
  const k = Math.min(32 / d[0], 32 / d[1], 1);
  return `<img class="intl-sym" src="/assets/symbols/${esc(en.apiId)}-pokemon-tcg-set-symbol.webp"
          width="${Math.round(d[0] * k)}" height="${Math.round(d[1] * k)}"
          alt="The ${esc(en.name)} set symbol" loading="lazy" decoding="async">`;
};

const guides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
const { sets: enSets, rarityOrder } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

/* ---------------------------------------------------- the pack photograph --
 *
 * public/data/products-intl.json, written by sync-products.mjs. Eight of these
 * thirteen guides have an entry in it since 22 August 2026; see the long note
 * over TCG_SET_INTL in shared/tcgplayer.mjs for which, why the other five have
 * none, and how each match was verified on four independent axes before it was
 * pinned.
 *
 * **IT IS A SEPARATE FILE FROM products.json AND THAT IS NOT TIDINESS.** The
 * first version of this put the eight sets into products.json, whose ids they
 * cannot collide with, and that file turns out to be a CORPUS that five
 * builders iterate wholesale rather than a map they look up. The eight Japanese
 * packs promptly appeared as the cheapest rows of the price-by-set table on
 * /openings/single-pack.html, an English page, labelled with TCGplayer's raw
 * set string because our taxonomy has no name for them. Nothing errored and the
 * page rendered perfectly; check-tree-drift.mjs was the only thing that noticed.
 * The full account is in sync-products.mjs over the intl loop. If you merge the
 * two files, grep for every wholesale iteration of `.sets` first.
 *
 * Optional on purpose: a guide with no entry renders no band, which is the
 * standing pattern on this site for absent data and is what the four Korean
 * guides and the Chinese one get.
 */
let PRODUCTS = { sets: {} };
try {
  PRODUCTS = JSON.parse(await readFile(join(ROOT, "public/data/products-intl.json"), "utf8"));
} catch {
  /* optional: no products-intl.json means no pack band on any guide */
}

/* The TCGplayer product urls that answer 403. NOT the same key as NO_SCAN
 * above, which holds TCGdex BASES: this is `deadUrls`, the whole-url list, and
 * reading the wrong one of the two is how half of this feature worked on the
 * English guides once. A dead photograph drops the band rather than painting an
 * empty frame, for the reason argued over packBand. */
let DEAD_IMG = new Set();
try {
  DEAD_IMG = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []);
} catch {
  /* optional: without it a dead url renders an img that removes itself */
}

/* Affiliate config, read exactly as build-set-pages.mjs reads it and for the
 * one reason worth the four lines: it is OFF today, and if it is ever switched
 * on, these eight pages must not be the only TCGplayer links on the site that
 * quietly ignore it. */
let aff = {};
try {
  aff = JSON.parse(await readFile(join(ROOT, "data/affiliate.json"), "utf8"));
} catch {
  /* optional: links stay plain */
}
const affOn = Boolean(aff.tcgplayer?.enabled && aff.tcgplayer?.linkTemplate);
const affLink = (url) =>
  affOn ? aff.tcgplayer.linkTemplate.replace("{url}", encodeURIComponent(url)) : url;

const enById = new Map(enSets.map((s) => [s.id, s]));

/* ------------------------------------------- who priced the English chase --
 *
 * THESE TWELVE PAGES CREDITED THE WRONG FEED FOR FOUR MONTHS' WORTH OF DOLLARS,
 * found 19 August 2026. The English chase band's note read "English <set> card
 * scans from TCGdex, TCGplayer market prices, read August 16, 2026" while every
 * figure in it is PriceCharting's ungraded price guide value: Gastly #177 on
 * /sets/ja-cyber-judge.html is $92.67, which is exactly what
 * public/data/cards/temporal-forces.json holds under priceSource
 * pricecharting.com. The date was right the whole time; only the name was
 * wrong, which is the version of this bug nobody catches by looking.
 *
 * IT IS READ FROM THE CARD FILE AND NOT FROM sets.json, and that is the point
 * of doing it at all rather than typing "PriceCharting" here. sets.json still
 * carries priceSource "TCGdex" on every record, written by
 * scripts/reconcile-cards.mjs, which is a second stale stamp sitting one field
 * away from the prices this band prints. public/data/cards/<id>.json is the
 * file shared/card-prices.mjs calls the one source for a card price, so it is
 * the one to ask. A set with no card file falls back to the site-wide default
 * that module already uses.
 */
const enPriceDocs = new Map();
for (const s of enSets) {
  try {
    const doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${s.id}.json`), "utf8"));
    enPriceDocs.set(s.id, { priceSource: doc.priceSource, pricesChecked: doc.pricesChecked, checked: doc.checked });
  } catch {
    /* no checklist for this set; the caller falls back */
  }
}

const ripsBySet = {};
for (const v of videos) for (const s of v.sets || []) (ripsBySet[s] ||= []).push(v);

/* --------------------------------------------- what we pulled from this set --
 *
 * THESE PAGES HAD A BAND AND IT WAS READING THE WRONG FILE, SO SIX OF THE SEVEN
 * GUIDES WITH LOGGED CARDS LISTED NONE OF THEM. Fixed 21 August 2026.
 *
 * The band went in to fix "a pull logged against Cyber Judge appeared on its rip
 * page and nowhere else", and it fed on `parseHits(v.hitCard)` -- the raw Hit
 * Card CELL, re-parsed here, counting a fragment only where its first segment
 * spells a set name we recognise. That is a text join, and it lands on exactly
 * one of the thirteen guides. Measured against the log before this change:
 *
 *      guide                    cards the log records    rows on the page
 *      ja-nihil-zero                     3                      0
 *      ja-stellar-miracle                3                      0
 *      ja-abyss-eye                      2                      0
 *      ja-mega-symphonia                 2                      0
 *      ja-mega-brave                     1                      0
 *      ja-ninja-spinner                  1                      0
 *      ja-cyber-judge                    1                      1
 *
 * Meanwhile /hall.html carries plaques for Crabominable, Meditite and Raboot,
 * all three out of Stellar Miracle, all three WITH card art, and that guide said
 * nothing about any of them. Two pages in the same nav disagreeing about what
 * came out of a pack is the same fault class as the hall's own count, and it is
 * the one this site can least afford.
 *
 * IT WAS NEVER A DATA GAP AND IT IS NOT A LIMIT OF TCGDEX. data/hits.json is the
 * structured file import-sheet.mjs writes per video, keyed by youtube id, with
 * the set ALREADY resolved on every row -- which is what build-hall.mjs and the
 * 34 English guides have both been reading all along. This reads the same file
 * now. The rip band above it was always joined correctly; only the card band was
 * looking somewhere else. CLAUDE.md records the same shape once before, when
 * build-hall.mjs could only open one of the two checklist files this repo ships:
 * "it is a builder that could only read one of the two."
 *
 * WHICH PRINTING, AND THE ANSWER IS THE SAME ONE THE OTHER TWO GIVE. The rule
 * lives in shared/intl-printing.mjs and this is its third caller; going through
 * it is what stops a guide naming a different printing from the plaque for the
 * card. Four of the thirteen rows pin to a printing and nine do not, so nine go
 * in on the sheet's own words with no number, which asserts nothing.
 *
 * STILL NO PRICES ON THESE PAGES, which is this file's standing rule and the
 * one visible difference from the English band. A tile here carries the picture,
 * the name, the tier and the number, and the note under the band says why there
 * is no money on it rather than printing a column of "No price".
 */
const HITS = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
const videoById = new Map(videos.map((v) => [v.id, v]));
/* ---------------------------------------------------------------------------
 * THIS FILE HELD TWO NORMALISATIONS OF ONE CARD NAME AND USED BOTH, 22 August
 * 2026. There is one now, and it is the SHARED one.
 * ---------------------------------------------------------------------------
 *
 * The dedupe below was keyed with a private `cardKey()` that stripped a leading
 * card-TYPE word ("Trainer", "Supporter", "Item", "Stadium") and collapsed to
 * spaces; the checklist match forty lines down uses `norm(c.name) ===
 * norm(h.card)`, which strips neither. So one row could be filed under
 * "rare candy" and looked up as "trainerrarecandy" in the same pass.
 *
 * **THE OBVIOUS FIX IS TO SHARE cardKey AND IT IS THE WRONG ONE. MEASURED.**
 * build-hall.mjs and build-pages.mjs have no `cardKey` at all: both match AND
 * dedupe intl rows on `norm`. Standardising on cardKey therefore means editing
 * those two as well, and generalising its type-word strip damages real names
 * that this repo's own data contains:
 *
 *       "Turffield Stadium"  -> "turffield"       a real Stadium card
 *       "Lively Stadium"     -> "lively"          a real Stadium card
 *       "Gym Trainer"        -> "gym"             a real Supporter card
 *       "Corviknight V Trainer Gallery" -> "corviknightvgallery"
 *                                                 a LIVE row in data/hits.json
 *
 * That is the same class of fault as the empty key `norm` used to produce: a
 * key that throws away the distinguishing word. So the unification goes the
 * other way, onto `norm`, which is the key the other two builders already use
 * and the one that now folds accents and keeps CJK. See shared/intl-printing.mjs.
 *
 * **IT IS A NO-OP ON TODAY'S DATA AND THAT WAS COUNTED RATHER THAN ASSUMED**,
 * over every set in data/hits.json and not just the intl ones, 2026-08-22:
 * 144 dedupe groups under cardKey and 144 under `norm`, zero groups merging two
 * differently-written names under either, and zero empty keys under either.
 *
 * **WHAT THIS DOES NOT FIX, SAID OUT LOUD.** "Trainer Rare Candy" and "Trainer
 * Poké Pad" still find no candidate, because the log writes a type word the
 * checklist does not. Stripping it is a change to a key that build-hall.mjs and
 * build-pages.mjs also read, so it belongs in one shared place and cannot be
 * made from this file alone. Those two cells are the owner's; see the report.
 * ------------------------------------------------------------------------- */

/**
 * The guide's own checklist in the shape pickIntlPrinting expects. Same cut
 * build-hall.mjs and build-pages.mjs make: `image` in intl-guides.json is a
 * whole url ending in /low.webp and every emitter here appends its own
 * rendition, so it is reduced to the base and tested against no-scan.json,
 * which sync-intl-guides.mjs does not apply.
 */
// `setId` is passed explicitly rather than read off `g.id`: only the objects
// hitsBand is handed carry an id, and the CORPUS_ART loop's do not, so the
// guard below reported "undefined #103" from one of its two call sites.
function guideChecklist(g, setId) {
  if (!g?.cards?.length) return null;
  return g.cards.map((c) => {
    const base = c.image ? String(c.image).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "") : null;
    // THE OTHER HALF OF THE GUARD. The dedupe above refuses an unkeyable HIT
    // name; this refuses an unkeyable CHECKLIST name, which is the side the
    // hazard actually lived on: 202 of these 1,310 rows keyed to "" before
    // shared/intl-printing.mjs stopped dropping Japanese and Korean, so any
    // unkeyable hit row would have matched all 202 at once. It is 0 of 1,310
    // now, and this is what stops it silently becoming 1.
    nameKeyOrThrow(c.en || c.native, `public/data/intl-guides.json, ${setId} #${c.localId}`);
    return {
      n: c.localId,
      name: c.en || c.native,
      rarity: c.rarity || null,
      // THE SAME CARD'S TIER IN THE WORDS ON THE JAPANESE WRAPPER, WHICH IS THE
      // VOCABULARY data/hits.json IS WRITTEN IN. Carried so pickIntlPrintingJp
      // can ASK with it; `rarity` above stays TCGdex's and is what this page
      // prints, what the ladder is ranked on and what corpusScan checks against.
      // Absent on every guide with no TCGplayer pin. See shared/intl-vocab.mjs.
      rarityJp: c.rarityJp || null,
      img: base && !NO_SCAN.has(base) ? base : null,
      // Both names survive the flattening, and only corpusScan reads them: that
      // corpus is sharded by the first letter of whichever name TCGdex holds,
      // so a Japanese card with no translation is filed under "0" and a lookup
      // with one name misses it. pickIntlPrinting reads neither.
      en: c.en || null,
      native: c.native || null,
    };
  });
}

const HITS_BY_SET = new Map();
for (const [vid, list] of Object.entries(HITS)) {
  const v = videoById.get(vid);
  if (!v) continue;
  for (const h of list) {
    if (!h.set) continue;
    // THE GUARD, AND IT REPLACES A SILENT `if (!k) continue`. An unkeyable card
    // name is not a row to skip, it is a row that would match every OTHER
    // unkeyable row on the checklist it is about to be looked up in, and then be
    // separated on rarity alone on a page that prints a collector number. It
    // throws for the reason shared/intl-printing.mjs gives over the same guard:
    // a comment does not stop the next person. Zero of the rows in
    // data/hits.json produce one today, counted across every set and not just
    // the thirteen intl ones.
    const k = nameKeyOrThrow(h.card, `data/hits.json, video ${vid}, set ${h.set}`);
    if (!HITS_BY_SET.has(h.set)) HITS_BY_SET.set(h.set, new Map());
    const g = HITS_BY_SET.get(h.set);
    // A CARD PULLED TWICE IS ONE ROW WITH A COUNT, same rule as the English
    // guides and as /hall.html's dedupe. The count is the interesting part.
    if (!g.has(k)) g.set(k, { card: h.card, rarity: h.rarity || null, count: 0, rips: [] });
    const e = g.get(k);
    e.count += 1;
    if (!e.rarity && h.rarity) e.rarity = h.rarity;
    if (!e.rips.some((r) => r.path === v.path)) e.rips.push({ path: v.path, label: v.siteTitle || v.title });
  }
}

/**
 * THE SCAN THE GUIDE ITSELF DOES NOT HAVE, RESOLVED ONCE BEFORE ANY BAND DRAWS.
 *
 * hitsBand is synchronous and is called from inside a .map that builds the
 * page, so the file lookup cannot happen there. It happens here instead, keyed
 * on the printing pickIntlPrinting has ALREADY chosen, which is the same
 * ordering /hall.html and the rip pages use and is what stops a picture ever
 * deciding which card a tile names. A guide whose own checklist has the image
 * never reaches this.
 */
const CORPUS_ART = new Map();
for (const [setId, cards] of HITS_BY_SET) {
  const g = guides.sets?.[setId];
  const checklist = guideChecklist(g, setId);
  if (!g?.native || !checklist) continue;
  for (const h of cards.values()) {
    const same = checklist.filter((c) => norm(c.name) === norm(h.card));
    const m = pickIntlPrintingJp(same, h.rarity ? norm(h.rarity) : null);
    if (!m || m.img) continue;
    const base = await corpusScan(g.native, { localId: m.n, en: m.en, native: m.native, rarity: m.rarity });
    if (base) CORPUS_ART.set(`${setId}|${m.n}`, base);
  }
}

/**
 * THE LETTER BADGE, FROM A LABEL RATHER THAN FROM AN ID, AND IT REFUSES A NEAR
 * MISS. The band used to be fed by parseHits, which hands back a rarity ID that
 * rarityMark and rarityLabelOf take directly. data/hits.json stores what the
 * person WROTE ("Art Rare", "Super Rare"), so the id has to be recovered, and
 * raritiesIn is a substring matcher: it reads "Secret Rare" as `rare` and would
 * print a one-star English black star on a Japanese secret. So the id is only
 * accepted where the tier it names spells the log's own words back exactly.
 * Anything else keeps the words and loses the mark, which is the standing rule
 * everywhere a tier cannot be pinned on these pages.
 */
function rarityBadge(written) {
  const words = rarityLabel(written);
  if (!words) return "";
  const id = raritiesIn(words)[0];
  const exact = id && rarityLabelOf(id).toLowerCase() === String(words).toLowerCase();
  return `<span class="mine-rk">${exact ? rarityMark(id) : ""}${esc(words)}</span>`;
}

function hitsBand(g, cls) {
  const rows = [...(HITS_BY_SET.get(g.id) || new Map()).values()].sort((a, b) => b.count - a.count);
  if (!rows.length) return "";
  const checklist = guideChecklist(g, g.id);
  const pinned = [];
  const plain = [];
  for (const h of rows) {
    const same = checklist ? checklist.filter((c) => norm(c.name) === norm(h.card)) : [];
    const m = pickIntlPrintingJp(same, h.rarity ? norm(h.rarity) : null);
    if (m) pinned.push({ ...h, m });
    else plain.push(h);
  }
  const total = rows.length;
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pulled on camera</p>
    <h2>What we have <span class="hl">hit</span> from this set</h2>
    ${/* The second sentence agrees as well as the first. An imported guide that
          has hit exactly one card read "1 card out of our own packs. Every one
          of them is in a video you can watch." build-set-pages.mjs carries the
          same lede and got the same fix. */ ""}<p class="lede" style="max-width:38em">${total} card${
      total === 1 ? "" : "s"
    } out of our own packs.
      ${total === 1 ? "It is" : "Every one of them is"} in a video you can watch.</p>
    ${pinned.length ? `<ul class="mine-grid">
      ${pinned
        .map(
          (h) => `<li class="mine">
        ${/* THE GUIDE'S OWN SCAN, THEN THE CORPUS, THEN THE PANEL. Six of the
              thirteen guides carry no image at all in intl-guides.json and
              three of those six are complete in public/data/printings, which
              this band had never asked; CORPUS_ART above is that lookup, done
              before the page draws because this function is synchronous. What
              is left after both is a card we hold no picture of anywhere, and
              since 22 August 2026 that is a panel rather than a hatched
              rectangle: no symbol here, because the only mark we hold for a
              Japanese set is its ENGLISH twin's, and putting that on a Japanese
              card would name the wrong printing. */ ""}${(() => {
          const art = h.m.img || CORPUS_ART.get(`${g.id}|${h.m.n}`) || null;
          return art
            ? avifPicture(`<img class="mine-img" src="${esc(art)}/low.webp" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(`${art}/low.webp`)}>`)
            : noScanBox("mine-img is-none");
        })()}
        <p class="mine-n">${esc(h.m.name)}${h.count > 1 ? ` <span class="mine-x">&times;${h.count}</span>` : ""}</p>
        ${/* THE CHECKLIST'S TIER FIRST, THEN THE LOG'S OWN WORD. Same
              precedence as the plaque on /hall.html, which is the point: the
              two pages must not print different tiers for one card. TCGdex
              leaves 36 of Stellar Miracle's 135 unfiled, which is exactly the
              three cards this grid holds, so without the fallback the row
              would show a bare collector number. */ ""}
        ${/* THE JAPANESE WORD WINS ON A ROW THAT HAS ONE, and rarityJp is the
              field that carries it. Pinning these six rows moved them onto the
              shared precedence, which prints TCGdex's anglicized tier -- so a
              card that read "Art Rare" before, matching the letters printed on
              the wrapper and on the card itself, started reading "Illustration
              Rare". The rip log is written in the wrapper's vocabulary because
              that is what the owner reads off the pack, and a guide that renames his
              tier is the guide disagreeing with the card in his hand. rarityJp
              is additive and only exists where sync-intl-guides.mjs stamped it,
              so this cannot reach a row that never had a Japanese word.

              THIS BLOCK WAS WRITTEN AS A LINE COMMENT AND A LINE COMMENT IS NOT
              A COMMENT HERE. It sits inside a template literal, so all nine
              lines of it were TEXT, and they shipped: every pinned row on all
              seven Japanese guides printed them between the card name and its
              tier, in the reader's own type, at HEAD on 22 August 2026. Nobody
              caught it because a builder that emits prose looks like a builder
              that emits prose. Every other note in this template uses the
              interpolated-block-comment form for exactly this reason, so copy
              a neighbour rather than writing a new one, keep BACKTICKS out of
              it (CLAUDE.md's own gotcha: a backtick in a comment inside a
              template literal ends the literal), and rebuild and read the page
              before believing it. */ ""}
        <p class="mine-r">${[esc(rarityLabel(h.m.rarityJp || h.m.rarity || h.rarity) || ""), h.m.n ? `#${esc(h.m.n)}` : ""].filter(Boolean).join(" &bull; ")}</p>
        ${h.rips.map((r) => `<a class="mine-w" href="/${esc(r.path)}">Watch the rip &rarr;</a>`).join("\n        ")}
      </li>`
        )
        .join("\n      ")}
    </ul>` : ""}
    ${plain.length ? `<ul class="mine-list">
      ${plain
        .map(
          (h) => `<li><b>${esc(h.card)}</b>${h.count > 1 ? ` <span class="mine-x">x${h.count}</span>` : ""}${
            h.rarity ? ` ${rarityBadge(h.rarity)}` : ""
          }
        ${h.rips.map((r) => `<a href="/${esc(r.path)}">${esc(r.label)} &rarr;</a>`).join("\n        ")}</li>`
        )
        .join("\n      ")}
    </ul>` : ""}
    ${/* THE NOTE HAS TO DESCRIBE WHICHEVER HALVES ARE ON THE PAGE, because a
          guide can show all four shapes: pinned with a scan, pinned without one,
          and unpinned. Saying "they are listed rather than priced" over a grid
          of pictures with collector numbers on them would be describing the
          version of this band that existed before it read the rip log. */ ""}
    ${/* AND A CARD WITH NO NUMBER HAS TWO DIFFERENT REASONS, which is the
          distinction build-hall.mjs already draws on the console and which this
          note used to flatten into one sentence. TCGdex publishes a card COUNT
          and zero card records for Cyber Judge and for the Chinese guide, so
          there is no list to look anything up on; everywhere else there IS a
          list and the tier is what cannot separate two printings of one name.
          Saying "the rarity ladder is not mapped" over a set we hold no
          checklist for names the wrong cause. */ ""}
    <p class="mine-note">${[
      plain.length
        ? `${
            plain.length === total
              ? plain.length === 1 ? "That one came" : "Those came"
              : `${plain.length} of them came`
          } out of the rip log as written, with no card number: ${
            checklist
              ? "the Japanese rarity ladder is deliberately not mapped onto the English one, so where a name is printed more than once in a set nothing here can say which printing it was"
              : "the card database publishes a card count for this set and no card records, so there is no checklist here to look a number up on"
          }.`
        : "",
      "We do not price non-English printings anywhere on this site, so these are shown rather than valued.",
    ].filter(Boolean).join(" ")}</p>
  </div>
</section>`;
}

const yearsSince = (iso) => {
  if (!iso) return "";
  const y = (Date.now() - new Date(iso).getTime()) / 31557600000;
  if (y < 1) return `${Math.max(1, Math.round(y * 12))} months ago`;
  return `${y < 2 ? "1 year" : `${Math.floor(y)} years`} ago`;
};

/**
 * The rules only the comparison table needs, inlined rather than added to
 * assets-source/ui.css, which is render blocking on all 426 pages and would be
 * carrying them for the four guides that use them. Same pattern as
 * build-expansions.mjs.
 */
/**
 * The rules the pictures need, and they are ALWAYS emitted rather than gated on
 * a section, because the elements they paint are on every guide that has an
 * English twin, which is twelve of the thirteen. Same trade as PAGE_CSS below:
 * inline here rather than in ui.css, which is render blocking on all 426 pages.
 */
const ART_CSS = `
/* The English set logo, in the English half of the twin panel. 150px wide with
   a FIXED 56px-tall box, because the logos are normalised by height at the
   source but not all the same width: without the box the two columns of the
   panel end up different heights and the grid rows jump between guides. */
.intl-logo{display:block;width:auto;max-width:150px;height:56px;object-fit:contain;
  object-position:left center;margin:6px 0 10px}
/* The symbol line under the panel. 32px box, object-fit:contain, same reasoning
   as .setsym-i on the English guides: the files are not one shape. */
.intl-spot{display:flex;align-items:center;gap:var(--s3);margin-top:var(--s4);
  max-width:44em;font-size:var(--t-sm);line-height:1.5}
.intl-sym{flex:0 0 32px;width:32px;height:32px;object-fit:contain}
/* The borrowed English chase grid. The heading has to sit apart from the native
   grid above it or the two read as one list of cards, which is the single thing
   this block must not do. */
.intl-enh{margin-top:var(--s6);font-size:var(--t-h3)}
.intl-ensay{max-width:42em;margin-top:6px;font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
/* .chase-card is a <button> in ui.css and these are anchors, so the two type
   rules a button does not inherit are restated. Nothing else changes. */
.intl-enchase .chase-card{display:block;text-align:left;text-decoration:none;color:inherit;font:inherit}
`;

/**
 * The sealed pack photograph. Carried only on the eight guides that have one.
 *
 * **THE BOX IS PINNED IN CSS AND THAT IS THE WHOLE CLS STORY.** imgDims()
 * deliberately returns "" for tcgplayer-cdn, because that host serves a fixed
 * 200 WIDE and a variable height, so there is no width/height pair to declare.
 * Measured across the eight files this band actually loads: 200x200, 200x359,
 * 200x366 twice, 200x388, 200x400 and 200x403 twice, so the ratio runs 1.00 to
 * 2.02 and no single declaration is right for all of them. Same answer
 * build-topps.mjs reached for PriceCharting's scans: a FIXED frame with the
 * picture centred inside it by object-fit, which reserves its space before the
 * image arrives and measures CLS 0.000.
 *
 * **THE SQUARE ONE IS REAL AND IS NOT A BROKEN FILE.** Abyss Eye's photograph
 * (product 695111) is 200x200 where the other seven are portrait: TCGplayer
 * padded that one into a square at the source. The img ELEMENT still fills the
 * frame at 126x234 like every other one, and object-fit letterboxes the square
 * picture to about 126x126 inside it with page green above and below, which is
 * the correct rendering of a square picture in a portrait box. Do not "fix" it
 * by cropping to fill: `cover` would cut the top and bottom off the pack art on
 * that one guide and off nothing else, which is the least predictable thing
 * this band could do.
 *
 * The frame is 128x236 (1.844), chosen to sit between the two clusters the
 * eight files fall into rather than to match the tallest: pinning 2.02 would
 * have left every 1.79-1.83 pack floating in a box a fifth taller than it.
 *
 * **THREE OF THE EIGHT ARE SOFT AT DPR 3 AND IT IS A CEILING RATHER THAN A
 * DECLARATION BUG, which is the distinction the Card images section of
 * CLAUDE.md spends two entries on.** Every rung of the CDN was fetched and
 * MEASURED rather than trusted, because the file behind `_400w.jpg` is capped
 * at the master:
 *
 *       Abyss Eye        150x150   200x200   400x400    (1000x1000 exists)
 *       Violet ex        150x302   200x403   400x805
 *       Stellar Miracle  150x300   200x400   400x800
 *       Nihil Zero       150x291   200x388   400x776
 *       Ninja Spinner    150x269   200x359   400x718
 *       Cyber Judge      150x302   200x403   298x600  <- not 400 wide
 *       Mega Brave       150x275   200x366   213x390  <- not 400 wide
 *       Mega Symphonia   150x275   200x366   213x390  <- not 400 wide
 *
 * A 128px box wants 384 device pixels at DPR 3. Five packs have 400 and are
 * exact. Cyber Judge has 298 and is 1.29x short; the two Mega packs have 213
 * and are 1.80x short. **There is nothing larger to ask for and that was
 * checked, not assumed:** `_in_1000x1000.jpg` returns the SAME 298x600 and
 * 213x390 bytes for those three, because it is the master that is small. So
 * this is not the /msrp.html case of a missing rung, and shrinking the frame to
 * cover the worst of them would need a 71px box, which is not a photograph any
 * more. Accepted on the /topps-card-values.html precedent, which took an 11%
 * short pick over putting a megabyte back on a phone, and recorded here so the
 * next pass does not go looking for a rung that does not exist.
 */
const PACK_CSS = `
.pk-band{display:flex;gap:var(--s5);align-items:flex-start;flex-wrap:wrap;margin-top:var(--s4)}
/* The fixed frame. background is the site's own paper rather than the white
   .prod-shot uses on the English guides: these photographs arrive on a
   transparent-looking white plate already, and a second white block behind a
   square picture reads as a broken image on the dark green card. */
.pk-shot{flex:0 0 auto;display:flex;align-items:center;justify-content:center;
  width:128px;height:236px;border-radius:var(--r);background-color:var(--paper);
  border:1px solid var(--hair);overflow:hidden}
/* THE BOX IS FORCED, NOT SUGGESTED, AND THIS RULE WAS WRONG ONCE.
   It read max-width/max-height with width:auto;height:auto, which lets the
   image's INTRINSIC size win wherever it is smaller than the frame -- and with
   the w descriptors the intrinsic size is DENSITY-CORRECTED, so it is computed
   from the descriptor rather than from the file. productSrcset() labels the top
   rung 400w because that is what the url says, and for three of these eight
   products the file behind it IS NOT 400 PIXELS WIDE: TCGplayer caps _400w at
   the master, so Cyber Judge's is 298x600 and both Mega packs' are 213x390.
   The browser divided 400 by the 128px sizes value anyway, got 3.125, and laid the
   298px file out at 95 CSS px. Measured: Cyber Judge drew 95x192 inside a
   128x236 frame at DPR 2 and 3 while the other five drew 116x234, so three
   guides showed a visibly smaller pack for a reason nothing in the markup or
   the CSS showed. Forcing width/height to 100% and letting object-fit do the
   letterboxing makes the drawn size a function of the FRAME alone, which is
   what .prod-shot img in ui.css has always done.
   min-height:0 and min-width:0 are load bearing for the same reason that rule
   gives: a flex item's default minimum is its intrinsic size, which overrides
   height:100% and would push the picture back out of the box. */
.pk-shot img{width:100%;height:100%;min-height:0;min-width:0;object-fit:contain;display:block}
.pk-say{flex:1 1 16em;min-width:0}
.pk-name{font-weight:700;font-size:var(--t-m);line-height:1.35;margin:0}
.pk-native{margin:4px 0 0;font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.pk-note{margin-top:var(--s4);max-width:56ch;font-size:var(--t-sm);line-height:1.55;color:var(--ink-2)}
/* The link back to the listing. A 44px labelled control at the END of the
   caption, which is the shape every outbound link on this site has to meet.
   --sky-deep #81BEDE and NOT --sky #70B5D9: this is var(--t-sm), which clamps
   under the 24px line where the big teal stops clearing 4.5:1, and it is the
   same token .fk-see-list a takes for the same reason. */
.pk-see{display:inline-flex;align-items:center;min-height:44px;margin-top:var(--s3);
  color:var(--sky-deep);font:700 var(--t-sm)/1.2 var(--mono);
  text-transform:uppercase;letter-spacing:.04em}
.pk-see:hover{text-decoration:underline}
`;

const PAGE_CSS = `
/* Three columns fit 320px without help (1fr plus two 4em numerics), but the
   wrapper scrolls anyway rather than trusting that: a long rarity name is the
   one thing here that could grow and the page must never scroll sideways. */
.rcmp-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:var(--s4);
  border:1px solid var(--hair);border-radius:var(--r);background-color:var(--card);
  box-shadow:var(--lift)}
.rcmp{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.rcmp th,.rcmp td{padding:9px var(--s4);text-align:right;border-bottom:1px solid var(--hair)}
.rcmp thead th{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase;vertical-align:bottom}
.rcmp th[scope=row],.rcmp thead th:first-child{text-align:left;font-weight:600}
.rcmp td{font:700 var(--t-sm)/1.4 var(--mono);white-space:nowrap}
.rcmp tbody tr:last-child th,.rcmp tbody tr:last-child td{border-bottom:0}
/* Gold marks a tier that holds the same number of cards in both printings,
   which is the thing the table is for. --mustard at 16% keeps the row text at
   its normal contrast rather than tinting it. */
.rcmp tr.is-same{background:var(--sky-tint)}
.rcmp tr.is-same th[scope=row]{color:var(--gold-deep)}
.rcmp tr.is-total th,.rcmp tr.is-total td{border-top:2px solid var(--ink);font-weight:700}
.rcmp-say{max-width:42em;margin-top:var(--s4);border-left:4px solid var(--gold);
  padding-left:var(--s4);font-size:var(--t-body)}
`;

/**
 * The same trade build-css.mjs makes for ui.css, for the same reason: the
 * comments are the point of the SOURCE and pure weight in the shipped page, and
 * this block is inline in a render blocking <head>. Comments only, plus the
 * indentation between rules. Nothing else is touched.
 */
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const head = ({ title, desc, canonical, image, ld, noindex = false, css = "" }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clipMeta(desc))}">${
  noindex
    ? '\n<meta name="robots" content="noindex,follow">'
    : ""
}
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<link rel="preconnect" href="https://assets.tcgdex.net" crossorigin>
${FONTS}
${STYLES}${css ? `\n<style>${miniCSS(css)}</style>` : ""}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">
`;

/** The card name a US reader can actually read, with the native name kept alongside. */
const cardName = (c) => c.en || c.native || "";
const cardSub = (c) => (c.en && c.native && c.en !== c.native ? c.native : "");

/** Human label for what kind of card this is, used where no English name exists. */
const kindOf = (c) => (c.category === "Pokemon" ? "" : c.category === "Trainer" ? "Trainer" : c.category === "Energy" ? "Energy" : "");

// --------------------------------------------------------- the comparison band

/**
 * The reason these pages exist: this set next to the English set it became.
 * Reuses the .intl-* markup the English guides already use for the mirror of
 * this panel, so the two read as two views of one fact rather than two designs.
 */
function twinBand(g, cls) {
  const en = g.equivalent ? enById.get(g.equivalent) : null;

  if (g.exclusive || !g.equivalent) {
    return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>No English version</p>
    <h2>This one <span class="hl">never left</span></h2>
    <p class="lede intl-lede">${esc(g.english)} looks to be a regional exclusive. There is no English set to compare it
      to and no Japanese one either: its set code returns nothing under Japanese, Korean or Traditional Chinese on
      TCGdex, which is where we checked. If you want these cards, imported ${esc(g.langName)} packs are the way.</p>
  </div>
</section>`;
  }

  if (!en) return "";

  const enTotal = en.total || en.printedTotal || 0;
  const merged = g.siblingName || (g.sibling ? guides.sets[g.sibling]?.english : null);

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Same cards, different name</p>
    <h2>${esc(g.english)} is <span class="hl">${esc(en.name)}</span></h2>${/* "in a US SHOP", not store, went out on all 12 imported set guides. The
         whole point of the sentence is US retail: Target, Walmart, a card shop
         counter. "Shop" is the British word for the first two, and this site is
         written in American English. The hobby term "card shop" is a different
         word and stays wherever it appears. */ ""}
    <p class="lede intl-lede">If you have watched these rips and then gone looking for the set in a US store, this is the
      one you want. ${esc(g.english)} is the ${esc(g.langName)} printing behind English ${esc(en.name)}${
        merged ? `, which English built by merging it with ${natRuns(merged, g.dataSource?.lang || g.lang)}` : ""
      }.</p>
    <ul class="intl-grid">
      <li class="intl">
        <p class="intl-lang">${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.langName)}${g.tcgdexId ? ` &bull; ${esc(g.tcgdexId)}` : ""}</p>
        <h3>${esc(g.english)}</h3>
        ${g.native ? `<p class="intl-native" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
        <p class="intl-meta">${[
          g.cardCount?.total ? `${g.cardCount.total} cards` : null,
          longDate(g.released) || null,
        ].filter(Boolean).join(" &bull; ")}</p>
        <!--
          There was a "Full checklist on TCGdex" link here, pointing at
          www.tcgdex.net/<lang>/sets/<id>. All 15 URLs it built are 404s, and so
          is the root: TCGdex publishes api., assets. and tcgdex.dev and has no
          consumer site, so the link could never have worked. It was redundant
          as well, because the checklist is further down THIS page and the
          source line at the foot already credits TCGdex.
        -->
        ${/* AND IT ONLY PROMISES THE CHECKLIST WHERE THERE IS ONE. Two of these
              guides have no card records at all and render a "No checklist yet"
              band further down, so this line was sending a reader past the whole
              page to find something the page says it does not have. Found while
              re-reading every directional phrase on these guides after the
              sections moved; it predates that move. */ ""}
        <p class="intl-lead">The one on this page${g.cards?.length ? `, checklist below` : ""}</p>
      </li>
      <li class="intl is-en">
        <p class="intl-lang">English${en.apiId ? ` &bull; ${esc(String(en.apiId).toUpperCase())}` : ""}</p>
        <h3>${esc(en.name)}</h3>
        ${enLogo(g.equivalent, `The English ${en.name} set logo`)}
        <p class="intl-meta">${[
          enTotal ? `${enTotal} cards` : null,
          longDate(en.released) || null,
        ].filter(Boolean).join(" &bull; ")}</p>
        ${g.released && en.released && g.released < en.released
          ? `<p class="intl-lead">Out ${esc(gap(g.released, en.released))} later</p>`
          : `<p class="intl-lead">The English release</p>`}
        <a class="intl-link" href="/sets/${esc(g.equivalent)}.html">Read the ${esc(en.name)} guide</a>
      </li>
    </ul>
    ${enSymbol(en) ? `<p class="intl-spot">${enSymbol(en)}<span>That is the symbol on an English ${esc(en.name)} card,
      printed at the bottom beside the collector number. It is not the mark on the ${esc(g.langName)} cards in these
      rips: the two printings carry their own.</span></p>` : ""}
    ${g.confidence === "partial"
      ? `<p class="intl-warn">A partial match. ${esc(g.note || "")}</p>`
      : g.note ? `<p class="price-note">${esc(g.note)}</p>` : ""}
  </div>
</section>`;
}

/**
 * THE SAME CHECKLIST IN BOTH LANGUAGES, TIER BY TIER.
 *
 * The twin band above asserts "same cards, different name" and then prints two
 * different card counts underneath it, 118 against 120, and never says where
 * the difference went. That is the one question these pages exist to answer and
 * it was the one thing they left hanging.
 *
 * Both ladders come from TCGdex and both are counts of the checklists further
 * down each page, so the comparison is arithmetic over data we already publish.
 *
 * IT IS GATED HARD, and only four of the thirteen guides pass. TCGdex labels
 * the rarity on every card in the current Japanese sets and on almost none of
 * the Korean ones, where the higher tiers are simply absent from the data. A
 * side by side there would print "Illustration Rare 0 / 36", which reads as
 * "the Korean set has none" and is false. So the band renders only when:
 *
 *   - both sides name exactly the same set of rarities, and
 *   - each ladder accounts for every card in its own set.
 *
 * Anything less and the page shows nothing rather than a table that invites a
 * wrong conclusion. Mega Symphonia fails on the first test and is the reason it
 * exists: TCGdex files its top tier as "Secret Rare" where the English set says
 * "Ultra Rare", so the two ladders would have lined up 11 real cards against a
 * column of zeroes.
 */
function rarityCompare(g, en) {
  if (!en) return null;
  const norm = (obj) => {
    const out = new Map();
    for (const [k, v] of Object.entries(obj || {})) {
      const key = rarityLabel(k);
      if (!key || typeof v !== "number") return null;
      out.set(key, (out.get(key) || 0) + v);
    }
    return out.size ? out : null;
  };
  const mine = norm(g.rarities);
  const theirs = norm(en.rarities);
  if (!mine || !theirs) return null;

  const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const myTotal = g.cardCount?.total;
  const enTotal = en.total || en.printedTotal;
  if (!myTotal || !enTotal) return null;
  if (sum(mine) !== myTotal || sum(theirs) !== enTotal) return null;
  if (mine.size !== theirs.size) return null;
  for (const k of mine.keys()) if (!theirs.has(k)) return null;

  // Rarest first, in the ladder sets.json already ranks rarities in, so the
  // chase tiers are the first thing read rather than 38 commons. Anything the
  // ladder does not name falls to the bottom in count order.
  const rows = [...mine.keys()]
    .map((r) => ({ r, mine: mine.get(r), theirs: theirs.get(r) }))
    .sort((a, b) => {
      const ia = rarityOrder.indexOf(a.r);
      const ib = rarityOrder.indexOf(b.r);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.mine + a.theirs - (b.mine + b.theirs);
    });

  const same = rows.filter((x) => x.mine === x.theirs);
  const check = rows.reduce((a, x) => a + x.mine, 0);
  if (check !== myTotal) {
    throw new Error(
      `rarityCompare(${g.id}): the rows add to ${check} against a stated ${myTotal} cards. ` +
        `Check public/data/intl-guides.json.`
    );
  }
  return { rows, same, myTotal, enTotal, diff: enTotal - myTotal };
}

/** A list read out in prose: "a, b and c". */
const andList = (xs) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

function compareBand(g, en, cls) {
  const c = rarityCompare(g, en);
  if (!c) return "";
  const merged = g.siblingName || (g.sibling ? guides.sets[g.sibling]?.english : null);
  const say = [];
  if (c.same.length) {
    say.push(
      `${c.same.length} of the ${c.rows.length} rarities hold exactly the same number of cards in both printings: ` +
        `${andList(c.same.map((x) => `${x.mine} ${esc(x.r)}${x.mine === 1 ? "" : "s"}`))}.`
    );
  } else {
    say.push(`No rarity holds the same number of cards in both printings.`);
  }
  say.push(
    c.diff === 0
      ? `The two sets are the same size.`
      : `English ${esc(en.name)} is ${Math.abs(c.diff)} card${Math.abs(c.diff) === 1 ? "" : "s"} ${
          c.diff > 0 ? "bigger" : "smaller"
        }, ${c.enTotal} against ${c.myTotal}.` +
        (merged && c.diff > 0 ? ` It was built by merging this set with ${esc(merged)}, which is where the extra came from.` : "")
  );

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Card for card</p>
    <h2>How close is it to <span class="hl">${esc(en.name)}</span>?</h2>
    <p class="lede" style="max-width:42em">"Same set" is nearly true and worth checking rather than taking on trust.
      Here is every rarity in both printings, side by side.${
        c.same.length ? ` The gold rows are the ones that match.` : ""
      }</p>
    <div class="rcmp-wrap">
      <table class="rcmp">
        <caption class="sr-only">Card count by rarity in ${esc(g.english)} against ${esc(en.name)}</caption>
        <thead>
          <tr><th scope="col">Rarity</th><th scope="col">${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.english)}</th><th scope="col">${esc(en.name)}</th></tr>
        </thead>
        <tbody>
          ${c.rows
            .map(
              (x) => `<tr${x.mine === x.theirs ? ` class="is-same"` : ""}>
            <th scope="row">${esc(x.r)}</th><td>${x.mine}</td><td>${x.theirs}</td>
          </tr>`
            )
            .join("\n          ")}
          <tr class="is-total"><th scope="row">Every card</th><td>${c.myTotal}</td><td>${c.enTotal}</td></tr>
        </tbody>
      </table>
    </div>
    <p class="lede rcmp-say">${say.join(" ")}</p>
    <p class="price-note">Both counts are the rarities on the two checklists, from TCGdex, read
      ${esc(longDate(guides.checked) || guides.checked)}. A rarity is only counted where TCGdex labels it, so this table
      appears on a guide only when both sides label every card. It says nothing about how often any of them turn up in a
      pack, because nobody outside The Pokemon Company knows that.</p>
  </div>
</section>`;
}

// ------------------------------------------------------- the rest of the page
//
// One function per section, each taking the class that paints it, so guidePage
// can decide the tones once it knows which sections exist. The markup inside is
// unchanged from when these were inlined in the page template.

/**
 * A CARD-SHAPED BUTTON WITH NO CARD IN IT IS THE WORST OF BOTH THINGS, and this
 * grid was drawing twelve of them on five of the thirteen guides.
 *
 * TCGdex publishes no card images for the current Japanese sets, so Abyss Eye,
 * Ninja Spinner, Nihil Zero, Mega Brave and Mega Symphonia each rendered
 * `notable` as twelve `<button class="chase-card">` tiles holding three lines of
 * text apiece. Measured at 390x844 that is 1,786px, more than two full screens,
 * of a grid whose row height is set by a 245x342 scan that never arrives. Every
 * one of those buttons also carried `aria-label="Enlarge <card>"` and did
 * nothing at all when pressed: the lightbox handler is gated on `data-img`,
 * which is empty on every one of them. A control that announces an action it
 * cannot perform is a worse failure than a missing picture.
 *
 * SPLIT BY WHETHER THERE IS A SCAN, which is exactly what build-pokemon.mjs
 * already does for the identical problem, down to the `.flat-list` classes: they
 * are in ui.css already and the argument for them is written above them there.
 * A card with a scan keeps the grid. A card without one becomes a named row in a
 * list that is sized by its text, so it says out loud that it is an index of
 * names rather than pretending to be a wall of cards.
 *
 * IT IS NOT A PLACEHOLDER AND MUST NEVER BECOME ONE. The rule these pages work
 * under is that a row with no scan says so; borrowing the English card's
 * artwork for a Japanese entry was measured and rejected long before this, for
 * the reason written above enChase below.
 */
function chaseBand(g, en, cls) {
  const withScan = g.notable.filter((c) => c.image);
  const noScan = g.notable.filter((c) => !c.image);
  /**
   * WHERE THE NATIVE SIDE HAS NOT ONE SCAN, THE ENGLISH GRID GOES FIRST.
   *
   * Splitting the imageless tiles into a list was the honest fix and it bought
   * no scrolling at all: measured at 390x844 the band went 1,786px to 1,838px,
   * because twelve text items sit in two columns whichever element they are, and
   * the new lede is a paragraph. So on those five guides the four English scans
   * were still 3,726px down, which is worse than the 3,674px they started at.
   *
   * Putting them above the name list moves the only pictures on the page up by
   * about a screen. It is only done when the native side has NOTHING, because
   * that is the only case where the section's own cards are not being pushed
   * under somebody else's: with even one native scan the grid leads, as it
   * always has.
   */
  const enFirst = !withScan.length && Boolean(enChase(g, en));
  const enBlock = enChase(g, en, { nativeBelow: enFirst });
  // NO LEDE WHERE THERE IS NOTHING TO EXPLAIN. This band carried none before and
  // the six guides whose grid is complete still carry none: a sentence counting
  // the tiles under a heading that already says what they are is the "picture
  // that repeats the sentence beside it" failure in prose form. `notable` is also
  // capped at twelve out of however many qualify, so "the 12 cards worth hunting"
  // would have been a claim about the set that the cap, not the set, decided.
  const say = !noScan.length
    ? ""
    : !withScan.length
      ? `TCGdex publishes no card scans for ${esc(g.english)}, so this page can name the cards worth hunting but cannot show them.${
          enBlock ? " What it can show is the same cards in English." : ""
        }`
      : `${withScan.length} of these have a scan and are pictured. The other ${noScan.length} we can name but not show.`;
  // The name list needs a heading of its own wherever something else sits above
  // it, and the two cases want different words: beside a grid of this set's own
  // scans it is the remainder, under the English grid it is this set's list.
  const flatHead = withScan.length
    ? `<h3 class="flat-h">Named, with no scan to show</h3>`
    : enFirst
      ? `<h3 class="flat-h">The ${esc(g.english)} chase list</h3>`
      : "";

  const tile = (c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(cardName(c))}" data-rarity="${esc(rarityLabel(c.rarity) || (c.secret ? "Numbered past the set" : ""))}"
        data-number="${esc(c.localId || "")}" data-price=""
        aria-label="Enlarge ${esc(cardName(c))}">
        ${/* alt="" : the button is aria-labelled "Enlarge <name>" and the .nm
              and .rr lines below repeat the name and number, so an alt made a
              screen reader say the card three times over on one tile. */ ""}${avifPicture(`<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>`)}
        <div class="nm">${esc(cardName(c))}</div>
        ${cardSub(c) ? `<div class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</div>` : ""}
        <div class="rr">${esc(rarityLabel(c.rarity) || (c.secret ? "Secret" : kindOf(c) || "Card"))} &bull; ${esc(c.localId || "")}</div>
      </button>`;

  const row = (c) => `<li class="flat-item">
        <b>${esc(cardName(c))}</b>
        ${cardSub(c) ? `<span lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</span>` : ""}
        <span>${esc(rarityLabel(c.rarity) || (c.secret ? "Secret" : kindOf(c) || "Card"))} &bull; ${esc(c.localId || "")}</span>
      </li>`;

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    ${say ? `<p class="lede" style="max-width:42em">${say}</p>` : ""}
${enFirst ? enBlock : ""}    ${withScan.length ? `<div class="chase-grid">
      ${withScan.map(tile).join("\n      ")}
    </div>` : ""}
    ${noScan.length ? `${flatHead}
    <ul class="flat-list">
      ${noScan.map(row).join("\n      ")}
    </ul>` : ""}
    <p class="price-note">No prices here on purpose. Imported singles are priced in euro or yen by the
      databases that carry them at all, and a converted half-filled price table is worse than none. The English
      ${en ? `<a href="/sets/${esc(g.equivalent)}.html">${esc(en.name)} guide</a> carries` : "guides carry"} live USD
      values for the same cards.</p>
${enFirst ? "" : enBlock}  </div>
</section>`;
}

/**
 * THE ENGLISH CHASE GRID WAS TRAPPED INSIDE A BAND THAT DOES NOT ALWAYS RENDER.
 *
 * enChase is the one honest picture of a card these pages have, and it was only
 * ever reached through chaseBand, which the band list gates on `g.notable`.
 * Two guides carry no notable list at all, so /sets/ja-cyber-judge.html and
 * /sets/ko-mask-of-change.html showed THREE images each across a 5,198px and a
 * 5,534px page, with the first one 1,304px down, while the English set they are
 * both about had eight priced, pictured chase cards sitting in sets.json the
 * whole time. Nothing was missing from the data; the grid was simply behind a
 * door that never opened.
 *
 * The band says whose cards these are in its own heading and in the paragraph
 * under it, which is the same guard the in-chaseBand version carries: they are
 * the English set's cards, numbers and prices, and they are not presented as the
 * imported printing's.
 */
function enOnlyBand(g, en, cls) {
  // TWO GUIDES REACHED THIS AND THEY WERE EMPTY FOR TWO DIFFERENT REASONS, so
  // the sentence is worked out from the data rather than written once and
  // reused. ja-cyber-judge had no card records at all. ko-mask-of-change has
  // 101 of them, none labelled above Double Rare and none numbered past the
  // printed set, which is the condition sync-intl-guides.mjs already warns about
  // at build time. Saying "TCGdex has no cards for this set" on the second one
  // would be plainly false to anybody who scrolled to the checklist.
  //
  // IT IS ONE GUIDE SINCE 22 AUGUST 2026 and the branch below is not dead:
  // ja-cyber-judge has a TCGplayer checklist and twelve chase cards of its own
  // now, so it takes chaseBand instead. The no-card-records branch stays because
  // the condition that produced it has not gone anywhere: zh-gem-pack-2 is in
  // the same state today and only misses this band because it has no English
  // twin to show. Do not delete a branch because the one page that reached it
  // stopped reaching it.
  const why = g.cards?.length
    ? `No card in the ${esc(g.langName)} printing is labeled at a chase rarity, so there is nothing of its own to picture here. Its full checklist is further down.`
    : `TCGdex has not published a card list for the ${esc(g.langName)} printing yet, so there is nothing of its own to picture here.`;
  const block = enChase(g, en, { standalone: true, why });
  if (!block) return "";
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>What to <span class="hl">chase</span> in English</h2>
${block}  </div>
</section>`;
}

/**
 * THE FOUR PRICIEST CARDS IN THE ENGLISH SET, WITH THEIR SCANS.
 *
 * TCGdex publishes no card images for the newest Japanese sets, so six of the
 * thirteen guides render this grid as twelve captioned boxes with nothing in
 * them: a wall that looks like cards and shows none. Abyss Eye is 1,555 words
 * with one picture on it, and that picture is the empty lightbox.
 *
 * THE ONE THING THAT CANNOT BE DONE IS THE OBVIOUS ONE. Borrowing the English
 * scan for each Japanese chase card was measured before it was rejected: not a
 * single one of the sixty chase cards across those five guides resolves to
 * exactly one English card. Mega Darkrai ex exists in English Pitch Black four
 * times, at Double Rare, Ultra Rare, Special Illustration Rare and Mega Hyper
 * Rare, and the Japanese entry carries no rarity at all to choose between them,
 * because TCGdex leaves it null on every card numbered past the set. Picking one
 * would put a specific card's artwork under another card's name, which is the
 * error a reader cannot see.
 *
 * WHAT IS SAFE is the English set's OWN chase list, shown as the English set's
 * own and nothing else. Each row is a card, a number, a rarity and a price that
 * all come from the same record in public/data/sets.json, and the heading says
 * whose they are. It is also the paragraph directly above it, made real: that
 * paragraph says the English guide carries USD values for these cards, and four
 * priced cards say it better than a sentence pointing somewhere else.
 *
 * FOUR, NOT EIGHT. Two rows on a phone. The English guide holds all eight and is
 * one tap away, and this band is a signpost rather than a second copy of it.
 * IT STAYS FOUR EVEN WHERE IT IS THE ONLY PICTURE ON THE PAGE. Raising it to six
 * or eight on the imageless guides was considered and is exactly the wrong
 * reason to change an argued number: the four are a signpost wherever they sit,
 * and adding borrowed scans to lift a density figure is not the same thing as
 * answering a reader's question.
 *
 * `standalone` drops the <h3> and the "not the ones above" clause, for the case
 * where enOnlyBand carries this block as a section of its own and there is no
 * native grid above it for the sentence to point at. `why` is the caller's
 * one-clause statement of what is absent, and it is passed in rather than
 * written here because the two guides that need it are absent for two different
 * reasons and a single sentence covering both would be false about one of them.
 */
function enChase(g, en, { standalone = false, why = "", nativeBelow = false } = {}) {
  // Skip the 101 TCGdex bases that 404, up front. onerror hides the gap in the
  // browser and the page still pays for the round trip to find out, which is
  // the reason data/no-scan.json exists. None of the current chase cards is on
  // that list; this is here so a future set's is not the way it gets noticed.
  const chase = (en?.chase || [])
    .filter((c) => c.image && !NO_SCAN.has(String(c.image).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "")))
    .slice(0, 4);
  if (chase.length < 2) return "";
  return `${standalone ? "" : `    <h3 class="intl-enh">The same cards in English</h3>\n`}    <p class="intl-ensay">The priciest cards in English ${esc(en.name)}, which is the set on the shelf in a US store.
      These are that set's own cards, numbers and prices${
        // THE PREPOSITION HAS TO FOLLOW THE LAYOUT. This block sits under the
        // native grid in the ordinary case, above the native NAME LIST where
        // that list has no scans, and alone on the two guides with no chase list
        // at all. "Not the Japanese ones above" printed over the top of a page
        // whose Japanese cards are below it is a small lie that a reader
        // scrolling in a shop will notice before anything else on the section.
        standalone ? `` : nativeBelow ? `, not the ${esc(g.langName)} ones listed below` : `, not the ${esc(g.langName)} ones above`
      }.${standalone && why ? ` ${why}` : ""}</p>
    <div class="chase-grid intl-enchase">
      ${chase
        .map(
          // alt="" HERE MATTERS MORE THAN ON THE BUTTONS. This tile is an <a>,
          // so its accessible name is COMPUTED FROM ITS CONTENTS: the alt was
          // being concatenated with the .nm/.rr/.pr text into one link name
          // reading "Bulbasaur 001, English Base Set Bulbasaur Rare • 001
          // $1.23". Emptying the alt leaves the link named by the words that
          // are actually on the screen, which is also what WCAG 2.5.3 wants.
          (c) => `<a class="chase-card" href="/sets/${esc(g.equivalent)}.html">
        ${avifPicture(`<img src="${esc(c.image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()"${imgDims(c.image)}>`)}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(rarityLabel(c.rarity) || "")} &bull; ${esc(c.number)}</div>
        <div class="pr">${moneyCompact(c.price)}</div>
      </a>`
        )
        .join("\n      ")}
    </div>
    <p class="price-note">English ${esc(en.name)} card scans from TCGdex, ${
      esc(enPriceDocs.get(en.id)?.priceSource || "pricecharting.com")
    } price guide values for an ungraded copy${
      // The card file's own price date first, because that is the day the money
      // was read; the set record's stamp is the fallback and says the same
      // thing today. Both beat the checklist date, which is a different read.
      longDate(enPriceDocs.get(en.id)?.pricesChecked || en.pricesAsOf || en.chasePricesAsOf)
        ? `, read ${esc(longDate(enPriceDocs.get(en.id)?.pricesChecked || en.pricesAsOf || en.chasePricesAsOf))}`
        : ""
    }. Every one of them links through to the ${esc(en.name)} guide, which prices the whole checklist.</p>
`;
}

function rarityBand(g, rarities, maxN, secretCount, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${/* THE LADDER WAS DRAWING EVERY BAR FULL, on all thirteen guides.
          ui.css styles `.rar-name`, `.rar-n` and `.rar-bar i`, which is the
          markup build-set-pages.mjs emits. This file emitted `.rar-n` for the
          NAME, `.rar-c` for the count and a `<span>` inside the bar, so the fill
          matched no rule at all: the width was on an unstyled inline element
          inside an overflow:hidden track, and 38 Commons and 1 Mega Hyper Rare
          rendered as identical empty full-width pills.
          A chart cannot be wrong quietly, which is what this was: the numbers
          beside it were right the whole time, so nothing read as broken.

          data-figure marks a figure drawn in markup rather than fetched, so
          check-build.py's image-coverage report can see it. It selects nothing
          and matches build-set-pages.mjs, which puts it on the same ladder.
          Note where this comment sits: a second `${...  ""}` block of its own
          would have added a blank line and an indent to all thirteen pages,
          which is a rendered change made by a comment. */ ""}
    <div class="rarity-list" data-figure="chart">
      ${rarities.map(([r, n]) => `<div class="rar">
        <span class="rar-name">${esc(rarityLabel(r) || r)}</span>
        <span class="rar-n">${n}</span>
        <span class="rar-bar"><i style="width:${Math.max(4, Math.round((n / maxN) * 100))}%"></i></span>
      </div>`).join("\n      ")}
    </div>
    ${/* THE SECOND SENTENCE IS ABOUT TCGDEX AND ONE GUIDE'S LADDER IS NOT
          TCGDEX'S. "TCGdex does not label the rarity on every one of them" is
          the reason those cards are counted rather than named on twelve of
          these pages; on the TCGplayer-sourced one every secret IS labelled and
          the ladder above already shows all four of its tiers, so the sentence
          would be describing a gap the reader can see is not there. What is
          worth saying there instead is which vocabulary the words above are in,
          because "Ultra Rare" means the top of this set here and a rung four
          lower on the guides next to it. */ ""}${secretCount ? `<p class="price-note">${secretCount} more cards are numbered past card ${g.cardCount?.official}, which is
      how ${esc(g.dataSource?.langName || g.langName)} sets carry their secret rares. ${
        g.checklistFrom
          ? `Every one of them is named above, and the tier names are the ${esc(g.langName)} ones off the wrapper rather than
      the English ladder: Art Rare, Super Rare, Special Art Rare and Ultra Rare are their own tiers and we do not translate
      them into English ones.`
          : `TCGdex does not label the rarity on every
      one of them, so they are counted here rather than guessed at.`
      }</p>` : ""}
  </div>
</section>`;
}

/**
 * THE PACK ITSELF, and it is one product rather than a shelf of them.
 *
 * Asked for by name on 22 August 2026. The owner: "I'm not shooting any of my own
 * images, you should be able to source the images for the Japanese and Korean
 * packs", and, on how much to show, "one representative item per product" --
 * a booster pack for a set, not a montage of the whole box. So this band is a
 * single photograph and a caption, where the English guides carry a grid of up
 * to eight products with prices and per-pack arithmetic.
 *
 * **THERE IS NO PRICE ON IT AND THAT IS THIS PAGE FAMILY'S OWN RULE RATHER
 * THAN AN OVERSIGHT.** The header of this file says "WHAT IS NOT ON THEM. No
 * prices", and products.json carries a market price for all eight of these.
 * The rule was written about TCGdex's Cardmarket figures, whose coverage is
 * partial, and the argument given is that half a price table is worse than
 * none -- which does not obviously apply to one figure that exists on 8 of 8.
 * It is still the rule, and it is left standing for a better reason than
 * inertia: the ask was for PICTURES, a price is a claim with an expiry that
 * drags a read date and a staleness note onto a page whose data is otherwise
 * dated once at the foot, and nothing about showing the wrapper needs one.
 * If a later editor wants the price here, that is a real argument; make it in
 * CLAUDE.md and in this comment first, and take the source note below with it.
 *
 * **THE LINK BACK IS NOT DISCRETIONARY AND IS NOT A NEW EXCEPTION.** These
 * photographs are hotlinked from TCGplayer's CDN, exactly as the 975 product
 * and card images already in this tree are, and sync-products.mjs states the
 * terms that makes acceptable in its own header: "pointing at the source is
 * both lighter and the honest way to use them. Every product links back to its
 * TCGplayer listing." Dropping the link here would make these eight the only
 * TCGplayer product photographs on the site that do not, which is a worse use
 * of somebody else's photography, not a tidier one. It meets the shape: one
 * small labelled 44px control at the END of the caption, never mid
 * explanation, aria-labelled as leaving the site, rel="noopener".
 */
function packBand(g, cls) {
  const entry = PRODUCTS.sets?.[g.id];
  const p = entry?.products?.[0];
  // No entry is the normal state for five of the thirteen guides. Render
  // nothing at all rather than an empty frame captioned "no photo": the band
  // is one picture, so a band with no picture in it is not a band.
  if (!p?.thumb || DEAD_IMG.has(p.thumb)) return "";

  const alt = `A sealed ${g.english} Japanese booster pack`;
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What it looks like</p>
    <h2>The <span class="hl">pack</span> itself</h2>
    <p class="lede" style="max-width:38em">What to look for on a shelf, or in somebody's rip.${
      g.native ? ` The ${esc(g.langName)} name runs across the bottom of the wrapper.` : ""
    }</p>
    <div class="pk-band">
      ${/* The picture is aria-hidden with tabindex="-1" and shares its href
            with the labelled link below, which is the pattern 192 links in the
            built tree already use: one destination split in two for the eye, so
            a label here would announce the row twice. See the matching note in
            build-set-pages.mjs. */ ""}<a class="pk-shot" href="${esc(affLink(p.url))}" rel="noopener" target="_blank"
         tabindex="-1" aria-hidden="true">
        <img src="${esc(p.thumb)}"${productSrcsetAttr(p.thumb, 128)} sizes="128px"
             alt="${esc(alt)}" loading="lazy" decoding="async"${imgDims(p.thumb)}
             onerror="this.remove()" referrerpolicy="no-referrer">
      </a>
      <div class="pk-say">
        <p class="pk-name">${esc(p.name)}</p>
        ${g.native ? `<p class="pk-native cjk" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
        <a class="pk-see" href="${esc(affLink(p.url))}" rel="noopener" target="_blank"
           ${/* THE VISIBLE WORDS COME FIRST, WCAG 2.5.3 Label in Name. The label
                 was "&lt;product&gt; on TCGplayer, opens on tcgplayer.com" while the
                 link READS "See the listing", so the two shared no word at all
                 and a speech-input user saying what they can see activated
                 nothing. Same rule .pack already follows on the rip pages,
                 where the banner text is inside the accessible name. */ ""}
           aria-label="See the listing: ${esc(p.name)} on TCGplayer, opens on tcgplayer.com">See the listing &rarr;</a>
      </div>
    </div>
    ${/* The set code is NOT printed separately, because TCGplayer's own set
          name already opens with it ("m1L: Mega Brave"), and the first draft
          said it twice in one sentence. It is still checked on every sync
          against the guide's tcgdexId, which is where that check belongs. */ ""}<p class="pk-note">Photograph is TCGplayer's, from their ${esc(entry.tcgLine || "Pokemon Japan")}
      catalog, where this set is filed as ${esc(entry.tcgSet)}. We are not a shop and we do not sell any of this.</p>
  </div>
</section>`;
}

function checklistBand(g, cls) {
  if (!g.cards?.length) {
    return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>No <span class="hl">checklist</span> yet</h2>
    <p class="lede">TCGdex knows this set exists, when it landed and how big it is, but has not published its card list.
      As soon as it does, this page fills in on the next nightly build.</p>
  </div>
</section>`;
  }
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>Full <span class="hl">checklist</span></h2>
    ${/* TWO SENTENCES, BECAUSE THE TWO CHECKLIST SOURCES DO NOT COVER THE SAME
          CARDS. "English names where the card is a Pokemon" is exactly true of
          a TCGdex checklist and understates a TCGplayer one, which names the
          Trainers and the Energy as well; printing it over a list where every
          row has an English name reads as a page that has not looked at itself.
          The price-note at the foot of this band says the same thing the other
          way round and is switched with it. */ ""}<p class="lede">${
      g.checklistFrom
        ? `All ${g.cards.length} cards, in English, including the Trainers and the Energy.`
        : `All ${g.cards.length} cards, English names where the card is a Pokemon.`
    }${
      g.dataSource?.borrowed
        ? ` This list is the ${esc(g.dataSource.langName)} printing's, because TCGdex has no ${esc(g.langName)} card records for this set.`
        : ""
    }${
      g.checklistFrom
        ? ` The ${esc(g.checklistFrom.denominator)} cards of the printed set come first and the ${
            g.cards.length - g.checklistFrom.denominator
          } numbered past it follow, which is how ${esc(g.langName)} sets carry their secret rares.`
        : ""
    }</p>
    <details class="ig-list">
      <summary>Show the full ${esc(g.english)} checklist</summary>
      <ol class="ig-cards">
        ${g.cards.map((c) => `<li><span class="ig-no">${esc(c.localId || "")}</span>
          <span class="ig-nm">${nat(cardName(c), g.dataSource?.lang || g.lang)}</span>
          ${cardSub(c) ? `<span class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</span>` : ""}
          ${c.rarity ? `<span class="ig-rr">${esc(rarityLabel(c.rarity))}</span>` : c.secret ? `<span class="ig-rr">Secret</span>` : kindOf(c) ? `<span class="ig-rr">${esc(kindOf(c))}</span>` : ""}</li>`).join("\n        ")}
      </ol>
    </details>
    ${g.checklistFrom
      ? `<p class="price-note">Every name here is the one TCGplayer files this card under in their ${esc(g.checklistFrom.line)}
      catalog, so the Trainers and the Energy are named too, which is the one thing our other imported checklists cannot do.
      Nothing on this page is transliterated or guessed at: where a name could not be read off a catalog it is not printed.
      The ${esc(g.langName)} name is beside each one, because that is what is on the card in your hand.</p>`
      : `<p class="price-note">Pokemon names come from the National Pokedex number on each card, so they are looked up rather
      than transliterated. Trainer and Supporter cards keep their ${esc(g.dataSource?.langName || g.langName)} names: no
      free source translates them, and a guessed name on a reference page is worse than an honest one you can paste into
      a search.</p>`}
  </div>
</section>`;
}

function ripsBand(g, rips, label, cls) {
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We ripped <span class="hl">${rips.length}</span> of these</h2>
    <div class="set-watch">
      ${/* THE TILE FILE, NOT THE MASTER. `.packshot .pack-art` measures 172x262
            CSS px at every width, so 344x524 at DPR2, and packs.css hands it the
            810x1440 master: 129.8KB to paint a box a 400x711 file covers at
            1.16x for 45.3KB. Taken as an inline background rather than by adding
            `.pack--tile`, because that class also carries position:absolute in
            ui.css and would tear this element out of its row. The url is
            absolute because packs.css's own is relative to /assets/. Same change
            and same reasoning as packTile() in build-set-pages.mjs.
            The wrapper stays the GENERIC one. This is a page about a Japanese or
            Korean set and the site has drawn no wrapper for one; putting the
            English twin's skin here would be a picture of the wrong pack. */ ""}
      <div class="packshot pack pack--default"><span class="pack-face pack-l"><span class="pack-art" style="background-image:url('/assets/packs/default-garbage-rips-585-booster-pack-tile.webp')"></span></span></div>
      <div>
        <p class="lede">Imported packs, opened on camera in Rochester. No idea what any of the text says, which is half
          the fun. Every ${esc(g.english)} rip on the channel is one tap away.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${g.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
    ${/* THE SENTENCE ABOVE PROMISED "one tap away" AND CHARGED TWO.
          Twelve of these pages had the rips tagged and joined correctly and
          still linked no rip: the band printed a count and a button to
          /videos.html filtered by this set, so watching the video the page is
          about meant landing on a filtered index first. The join was never
          broken, the list was simply never written. Same `.riplist` shape as
          build-set-pages.mjs's English "Every <set> rip" band, same twelve-row
          cap and same "all N" fallback, so a reader who has seen one set guide
          has seen this one.

          THE CAP IS INERT TODAY AND STAYS ANYWAY. The busiest imported set is
          Abyss Eye at 5, so nothing is currently truncated; the day one of
          these gets ripped forty times, a wall of rows should not be the way
          anybody finds out. */ ""}
    <ul class="riplist">
${rips
  .slice()
  .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
  .slice(0, 12)
  .map(
    (v) => `      <li><a href="/${esc(v.path)}">${esc(v.siteTitle || v.title)}</a>${
      v.published ? `\n        <span>${esc(shortDate(v.published))}</span>` : ""
    }</li>`,
  )
  .join("\n")}
    </ul>
    ${rips.length > 12
      ? `<p style="margin-top:var(--s3)"><a class="btn btn-ghost btn-sm" href="/videos.html?set=${esc(g.id)}">All ${rips.length} ${esc(label)} rips</a></p>`
      : ""}
  </div>
</section>`;
}

/**
 * WHOSE WORDS ARE ON THIS PAGE, AND ONE GUIDE'S ANSWER IS NOT TCGDEX'S.
 *
 * Twelve of these thirteen take their checklist, their rarities and their card
 * names from TCGdex plus PokeAPI, and this band said so for all thirteen. Since
 * 22 August 2026 ja-cyber-judge takes its checklist from TCGplayer, because
 * TCGdex declares that set and publishes no cards for it, and a source line
 * naming the wrong catalogue is worse on this page than on any other: the whole
 * pitch of these guides is that a reader can check them.
 *
 * The three things that change with it are all real and all visible:
 *   - the CHECKLIST and the RARITY WORDS are TCGplayer's
 *   - the SCANS are still TCGdex's, so the credit is split rather than moved
 *   - the card names are TCGplayer's English catalogue names, which is why that
 *     guide has an English name on its Trainers and Energy where every other
 *     one keeps them in Japanese. PokeAPI is not credited there because it did
 *     no work there.
 */
function sourceBand(g, cls) {
  const tcg = g.checklistFrom;
  return `<section class="${cls}">
  <div class="wrap">
    <h2>Where this <span class="hl">came from</span></h2>
    <ul class="facts-list">
      ${tcg
        ? `<li>Card scans from <a href="https://tcgdex.dev/" rel="noopener" target="_blank" aria-label="TCGdex, the card database these scans came from, opens on tcgdex.dev">TCGdex</a>, and the set details read there ${esc(longDate(guides.checked) || guides.checked)}.</li>
      <li><strong>The checklist, the card names and the rarities on this page are TCGplayer's</strong>, read ${esc(longDate(tcg.checked) || tcg.checked)} from their ${esc(tcg.line)} catalog, where this set is filed as ${esc(tcg.setName)}. TCGdex lists the set and has published no cards for it: its own record declares ${g.declaredCount ?? "a"} card${g.declaredCount === 1 ? "" : "s"} and carries none of them. Every collector number in the TCGplayer list is written out of ${esc(String(tcg.denominator).padStart(3, "0"))}, which is the same printed set size TCGdex states, and the two catalogs were matched card for card on the collector number before any of this was published.</li>`
        : `<li>Set details, checklist and rarities from <a href="https://tcgdex.dev/" rel="noopener" target="_blank" aria-label="TCGdex, the card database this checklist came from, opens on tcgdex.dev">TCGdex</a>, read ${esc(longDate(guides.checked) || guides.checked)}.</li>`}
      ${/* "on this page", not "below": this band is the LAST section, so it was
            pointing at a checklist that sits above it. */ ""}
      ${g.dataSource?.borrowed ? `<li><strong>The checklist on this page is the ${esc(g.dataSource.langName)} one.</strong> ${
        g.dataNote
          ? esc(g.dataNote)
          : `TCGdex lists this set in ${esc(g.langName)} but carries no cards for it, so the checklist comes from ${esc(g.dataSource.langName)} ${esc(g.dataSource.id)}, the printing it was translated from.`
      }${g.declaredCount && g.cardCount?.total && g.declaredCount !== g.cardCount.total
          ? ` Its own entry claims ${g.declaredCount} cards against ${g.cardCount.total} in the ${esc(g.dataSource.langName)} set; that figure has no cards behind it to check, so the verifiable number is the one shown above.`
          : ""}</li>` : ""}
      ${g.nameNote ? `<li><strong>On the name.</strong> ${esc(g.nameNote)}</li>` : ""}
      ${tcg
        ? `<li><strong>The rarity words here are the ${esc(g.langName)} ones.</strong> This set's tiers read Art Rare, Super Rare, Special Art Rare and Ultra Rare, which is what is printed on the wrapper. Our other imported guides read TCGdex's anglicized names for the same ladder, so the same card can be called two things across two of these pages. We do not map one onto the other: the two companies publish different names and inventing an equivalence between them is not something this site does.</li>`
        : `<li>Pokemon card names in English via the National Pokedex number, through <a href="https://pokeapi.co" rel="noopener" target="_blank" aria-label="PokeAPI, the source of the English card names, opens on pokeapi.co">PokeAPI</a>.</li>`}
      <li>This is a fan page. Nothing here is sold by us and none of it is official.</li>
    </ul>
  </div>
</section>`;
}

/** "about three months" style gap between two dates. */
function gap(a, b) {
  const days = Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000);
  if (days < 45) return `${days} days`;
  const months = Math.round(days / 30.4);
  return months < 18 ? `${months} months` : `${(months / 12).toFixed(1)} years`;
}

// ------------------------------------------------------------------ the page

function guidePage(g) {
  const url = `${SITE}/sets/${g.id}.html`;
  const en = g.equivalent ? enById.get(g.equivalent) : null;
  const rips = ripsBySet[g.id] || [];
  const label = labelFor("sets", g.id);
  const total = g.cardCount?.total;

  const desc =
    `${g.english} (${g.native || g.langName}) Pokemon TCG set guide: ` +
    `${total ? `${total} cards, ` : ""}released ${longDate(g.released) || "recently"}` +
    (en ? `, and why it is the same set as English ${en.name}.` : `, a ${g.langName} exclusive.`);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${g.english} Pokemon TCG Set Guide`,
      description: desc,
      image: [ogImage(g)],
      about: { "@type": "Thing", name: `${g.english} (Pokemon Trading Card Game, ${g.langName})` },
      url,
      // See the matching note in build-set-pages.mjs: `url` is not a substitute
      // for mainEntityOfPage, which is the property Google's Article
      // documentation actually names. Both English and imported guides were
      // emitting only the first.
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      // datePublished is when the guide first appeared and never moves;
      // dateModified is when its data was last re-read. Setting both to the
      // sync date made one false and the other meaningless.
      datePublished: g.published || guides.checked,
      dateModified: guides.checked,
      author: { "@type": "Organization", name: "Garbage Rips 585", url: SITE + "/" },
      publisher: {
        "@type": "Organization",
        name: "Garbage Rips 585",
        logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Set guides", item: `${SITE}/sets/` },
        { "@type": "ListItem", position: 3, name: g.english },
      ],
    },
  ];

  const rarities = Object.entries(g.rarities || {}).sort((a, b) => b[1] - a[1]);
  const maxN = Math.max(1, ...rarities.map(([, n]) => n));
  const secretCount = (g.cards || []).filter((c) => c.secret).length;

  // A guide with no checklist, no rarities and no chase cards is a stub, and the
  // site already noindexes thin rip pages for exactly this reason. It stays
  // reachable and in the nav; it just does not go to search until somebody
  // publishes the cards.
  //
  // THE CONDITION IS UNCHANGED AND ONE PAGE CAME OUT FROM UNDER IT ON 22 AUGUST
  // 2026, WHICH IS THE ORDER THAT MATTERS. /sets/ja-cyber-judge.html was a
  // 32,572-byte noindex stub with no card of its own on it, and it is indexable
  // now because it stopped being thin, not because anybody decided it should be
  // indexed: it renders a 100-row checklist, a nine-rung rarity ladder, twelve
  // chase tiles and the pulled-card grid. `thin` was not touched. If a future
  // guide is still a stub, this still hides it.
  const thin = !g.hasCards;

  // ---------------------------------------------------------------- the bands
  //
  // Each section is a function of the class that paints it, and the tones are
  // assigned only once the list of sections that actually render is known.
  // Which ones render varies a lot here: four guides have a card-for-card
  // table, two have no checklist at all, one has no English twin. Hard coded
  // classes therefore stacked two cream sections on Abyss Eye the moment the
  // comparison band was added between the twin panel and the chase grid.
  //
  // The rarity ladder is PINNED to the sky gradient it has always had and the
  // rest alternate outward from it, which cannot produce two neighbours the
  // same. See the matching note in build-set-pages.mjs.
  const bands = [
    (cls) => twinBand(g, cls),
    (cls) => compareBand(g, en, cls),
    // NOT `: null`. A guide with no chase list of its own still has an English
    // twin whose chase cards are priced and pictured, and hiding the only card
    // art on the page behind an empty native list is what left two of these
    // guides with three images apiece. enOnlyBand returns "" where there is
    // genuinely nothing to show, and the empty-band filter below drops it.
    g.notable?.length ? (cls) => chaseBand(g, en, cls) : (cls) => enOnlyBand(g, en, cls),
    rarities.length ? { pin: true, html: (cls) => rarityBand(g, rarities, maxN, secretCount, cls) } : null,
    // THE PACK GOES UNDER THE RARITY LADDER AND ABOVE THE CHECKLIST, which is
    // where a reader has just been told what is IN the set and has not yet been
    // handed 118 rows of it. It cannot go higher: the twin panel and the
    // comparison band are the reason these pages exist, per the header, and a
    // photograph above them would answer a question nobody came with. It
    // returns "" on the five guides with no entry and the empty-band filter
    // below drops it, so the zebra never gains a gap.
    (cls) => packBand(g, cls),
    (cls) => checklistBand(g, cls),
    rips.length ? (cls) => ripsBand(g, rips, label, cls) : null,
    HITS_BY_SET.has(g.id) ? (cls) => hitsBand(g, cls) : null,
    (cls) => sourceBand(g, cls),
  ].filter(Boolean);

  // twinBand and compareBand both return "" on some guides, and an empty string
  // still occupies a slot in the alternation, which would leave a visible gap
  // in the zebra. Render first, then drop the empties, then tone what is left.
  const drawn = bands.map((b) => ({ b, html: (b.pin ? b.html : b)("") })).filter((x) => x.html.trim());
  const pin = Math.max(0, drawn.findIndex((x) => x.b.pin));
  const body = drawn
    .map((x, i) => {
      const cls = x.b.pin ? "band-sky tight" : Math.abs(i - pin) % 2 === 0 ? "band tight" : "tight";
      return (x.b.pin ? x.b.html : x.b)(cls);
    })
    .join("\n\n");

  return head({
    // No " | Garbage Rips 585". These are the longest titles in /sets/, because
    // the name carries a language in brackets before the descriptor even starts.
    // Measured 17 August 2026 at 20px Arial, all 12 ran 702-788px against
    // Google's ~580px cut, and what the cut ate was "English Equivalent", which
    // is the whole reason somebody lands on a Japanese or Korean set guide.
    // Bare they run 523-609px. The sibling English guides in build-set-pages.mjs
    // KEEP their brand and should: setTitle drops the descriptor instead and 26
    // of 27 already fit, so there is nothing there for this change to buy.
    title: g.equivalent
      ? `${g.english} (${g.langName}) Set Guide: Cards & English Equivalent`
      : `${g.english} (${g.langName}) Set Guide`,
    desc, canonical: url, image: `${ogImage(g)}?v=2`, ld, noindex: thin,
    // Three blocks, each carried only where its markup exists. ART_CSS is the
    // pictures, PAGE_CSS is the card-for-card table, and RARITY_CSS is the
    // shared key's own stylesheet, which these pages were emitting `.rk` markup
    // without: the SR badge on /sets/ja-cyber-judge.html rendered as bare text
    // because nothing on the page defined the class.
    // A FOURTH BLOCK, AND IT IS READ OFF THE DRAWN BODY RATHER THAN GUESSED.
    // The no-scan panel fires on a card this repo holds no picture of anywhere,
    // which is one tile on one of these thirteen guides today and none on the
    // other twelve. Testing the rendered markup is exact and cannot drift out
    // of step with the condition inside hitsBand the way a second copy of that
    // condition would.
    // A FIFTH BLOCK, and it is read off the drawn body for the same reason the
    // no-scan panel's is: packBand renders on eight of the thirteen guides and
    // testing the rendered markup cannot drift out of step with the condition
    // inside it, where a second copy of that condition would.
    css: [en ? ART_CSS : "", rarityCompare(g, en) ? PAGE_CSS : "", HITS_BY_SET.has(g.id) ? RARITY_CSS : "",
      body.includes("noscan") ? NOSCAN_CSS : "", body.includes("pk-band") ? PACK_CSS : ""]
      .filter(Boolean).join("\n"),
  }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; ${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.langName)} set</span>
    <h1>${esc(g.english)}</h1>
    ${g.native ? `<p class="intl-hero-native cjk" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
    <p class="lede" style="max-width:34em">${
      en
        ? `The ${esc(g.langName)} printing of the set English calls ${esc(en.name)}. Same cards, different name.` +
          (g.released && en.released && g.released < en.released ? " And out first." : "")
        : `A ${esc(g.langName)} set that never got an English release.`
    }</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/sets/">Set guides</a> / ${esc(g.english)}</nav>

    <div class="facts">
      <div class="fact"><div class="n">${total ?? "?"}</div><div class="l">Cards total</div></div>
      ${g.cardCount?.official ? `<div class="fact"><div class="n">${g.cardCount.official}</div><div class="l">In the printed set</div></div>` : ""}
      ${secretCount ? `<div class="fact"><div class="n">${secretCount}</div><div class="l">Numbered past the set</div></div>` : ""}
      ${rips.length
        ? `<a class="fact fact-link" href="/videos.html?set=${g.id}"><div class="n">${rips.length}</div><div class="l">Rip${rips.length === 1 ? "" : "s"} on this channel <span aria-hidden="true">&rarr;</span></div></a>`
        : `<div class="fact"><div class="n">-</div><div class="l">Rips on this channel</div></div>`}
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${longDate(g.released) || "Unknown"}</div><div class="l">Release date${g.released ? ` &bull; ${yearsSince(g.released)}` : ""}</div></div>
    </div>
  </div>
</section>
${body}


<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <picture><source id="lbAvif" type="image/avif"><img id="lbImg" src="" alt=""></picture>
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
  </div>
</div>

</main>
${footer("Set data from TCGdex, card names via PokeAPI. Fan made, not official.")}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    // Same AVIF <source> the English guides fill in, and for the same reason:
    // the lightbox is the only place either page loads high.webp, 600x825, and
    // AVIF is 37% smaller at that size. avifPicture() cannot reach it because
    // the url only becomes an image url on click. The host test is the one
    // avifPicture applies: only assets.tcgdex.net publishes an AVIF beside its
    // WebP, and a <source> aimed at a 404 paints a broken card in some browsers
    // rather than falling back. srcset FIRST so the webp is never requested.
    var big=b.dataset.img, avif=document.getElementById('lbAvif');
    if(big.indexOf('https://assets.tcgdex.net/')===0 && big.slice(-5)==='.webp')
      avif.setAttribute('srcset', big.slice(0,-5)+'.avif');
    else avif.removeAttribute('srcset');
    img.src=big; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.rarity,b.dataset.number].filter(Boolean).join(' • ');
    document.getElementById('lbPr').textContent='';
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on'); document.body.style.overflow='';
    if(last) last.focus();
  }
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
`;
}

// ------------------------------------------------------------------------ run

await mkdir(OUT, { recursive: true });
const written = [];
for (const [id, g] of Object.entries(guides.sets || {})) {
  const page = guidePage({ ...g, id });
  await writeFile(join(OUT, `${id}.html`), page);
  written.push({ id, english: g.english, rips: (ripsBySet[id] || []).length, cards: g.cards?.length || 0 });
}

console.log(`Wrote ${written.length} non-English set guides to public/sets/`);
for (const w of written) {
  console.log(`  /sets/${w.id}.html`.padEnd(34) + `${w.english.padEnd(18)} ${String(w.cards).padStart(3)} cards, ${w.rips} rip${w.rips === 1 ? "" : "s"}`);
}
