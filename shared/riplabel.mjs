// What a rip is called on a tile, as opposed to what YouTube calls it.
//
//   ripLabel(video, setName) -> "Pitch Black ETB #3" | null
//
// A YouTube title is written for the algorithm: emoji, hype, a question mark.
// "This ETB is BREAKING me! 🌑💀" is a good thumbnail caption and a poor label
// on a grid of twenty. "Pitch Black ETB #3" says what you are about to watch,
// sorts, and reads the same width every time.
//
// There is an SEO argument too. 261 of the site's 345 indexable titles are
// byte-identical to the YouTube video's own title, so those pages compete head
// on with youtube.com for the same string and lose. A set-and-product label is
// different text describing the same thing.
//
// DERIVED, NOT TYPED. 262 of 311 videos have both a set and a product tag,
// which is all this needs, so 84% get a label for free. The sheet's `Site
// Title` column still wins outright where it is filled in: this is a default,
// not a replacement for a human.
//
// RETURNS NULL RATHER THAN A HALF LABEL. A video with no set tag would come out
// as "ETB #3", which is worse than the YouTube title because it says nothing
// about what was opened. Callers fall back to the real title, and the 41
// untagged videos are the same 41 that are already noindex for the same reason.

import { labelFor } from "./taxonomy.mjs";

/** Product tag -> how it is written on a tile.
 *
 * EVERY PRODUCT ID IN shared/taxonomy.mjs NEEDS A ROW HERE. The fallback below
 * is `PRODUCT_LABEL[prodId] || prodId`, so a missing row does not fail, it
 * prints the raw id: "Pitch Black booster-box #3" on a public tile. Three were
 * missing -- booster-box, spc and ex-special -- and no video carries any of
 * them today, which is the only reason it has not shipped. All three are
 * options in the sheet's Opening Type dropdown, so the first box opening
 * anybody logs prints kebab-case on the grid, the set page and the rip page at
 * once. Latent, not theoretical.
 */
export const PRODUCT_LABEL = {
  etb: "ETB",
  "booster-box": "Booster Box",
  spc: "Super Premium Collection",
  "ex-special": "ex Special Collection",
  "single-pack": "Pack",
  bundle: "Booster Bundle",
  "ex-premium": "ex Premium Collection",
  "ex-box": "ex Box",
  "japanese-pack": "Japanese Pack",
  "korean-pack": "Korean Pack",
  "chinese-pack": "Chinese Pack",
  blister: "Blister",
  tin: "Tin",
  "poke-ball-tin": "Poke Ball Tin",
  "collection-box": "Collection Box",
  "knock-out": "Knock Out Collection",
  upc: "UPC",
};

// "Pack #3", "pack 3", "#3", "Pack 3 of 9". Capped at two digits: a four digit
// number in a title is a year or a card number, not a pack count.
const NUM = /(?:\bpack\s*#?\s*(\d{1,2})\b|#\s*(\d{1,2})\b)/i;

/** Products that are their OWN line rather than a set's, and the word for one.
 *
 * PUTTING A SET NAME IN FRONT OF A PRODUCT IS A CLAIM THAT THE SET MADE IT.
 * "Chaos Rising ETB" and "Phantasmal Flames ex Premium Collection" are both
 * things you can pick off a shelf: the set prints the box, the box carries the
 * set's name, and the label is the product's real name. That is the case for
 * every row of PRODUCT_LABEL above except the ones listed here.
 *
 * A FIRST PARTNER ILLUSTRATION COLLECTION IS NOT ANY SET'S BOX. It holds one
 * promo pack plus TWO ASSORTED boosters, and this site says so in its own
 * words: /first-partner-illustration-collection.html answers "What is in a
 * First Partner Illustration Collection box?" with "One promo pack holding
 * three of the nine promos in that series, two Pokemon TCG booster packs and a
 * sticker sheet", and adds "The two boosters are assorted rather than a named
 * set: Tim's Series 1 box held one Phantasmal Flames and one Mega Evolution
 * pack." Assorted is the whole point. Two copies of box 5 can hold two
 * different sets, so no set name can go on the front of it without being wrong
 * about one of them.
 *
 * WHAT IT SHIPPED AS BEFORE THIS EXISTED, on two live rip pages: the label came
 * out "Phantasmal Flames Collection Box 6 - Pack 3" while the description
 * directly under it said "Box #6 of the Pokemon First Partner Illustration
 * Collection Series 1". Two adjacent lines naming two different products. The
 * product tag was never wrong (a First Partner box IS a collection-box, which
 * is what scripts/import-sheet.mjs maps it to on purpose); what was wrong is
 * that `sets` on these rips is the CONTENTS of the box, and the first entry of
 * a contents list is not a brand.
 *
 * THE NAME IS TIM'S OWN CELL, NOT A LOOKUP. `openingType` is the Opening Type
 * he typed, series number and all, and it is already the product's full name.
 * Re-deriving a prettier one here would be a second place for it to drift, and
 * the series is not decoration: Series 1, 2 and 3 are three different boxes.
 *
 * `unit` is the word for a single copy, so the box number reads as a box.
 * It is stated rather than guessed because the name ends in "Collection" and
 * "First Partner Illustration Collection (Series 1) 6" reads like a card
 * number. Tim's own titles are the model: "Mega Meganium ex Box #2 | Pack #2".
 *
 * THE COLLECTOR CHEST WAS FOUND BY SWEEPING FOR THE SAME SHAPE and it is the
 * second row. TN7_ZsuRQSI is "Only Garbage Rips from the Pokemon Fall 2025
 * Collector Chest", tagged with THREE sets because that is what its assorted
 * packs were, and it went out labeled "Mega Evolution Collection Box": a
 * product name built by taking the first entry of a contents list. Same
 * mistake, different box. It carries no box number, so unlike the First
 * Partner pair it was never over-claiming on a set guide, which is exactly why
 * a sweep found it and a bug report did not.
 *
 * ONE THAT IS NOT FIXABLE HERE, so nobody re-opens it: kj7532tb0_I is "Only
 * Garbage Rips from the Latest Costco Charizard UPC Drop", tagged with FOUR
 * sets and labeled "Phantasmal Flames UPC" off the first of them. It is the
 * same arbitrary pick, but its Opening Type is the bare word "UPC", which names
 * a product TYPE and not a product, so there is nothing in the data to put in
 * front of it. Inventing "Charizard ex Ultra Premium Collection" from the video
 * title would be a guess published as fact, which is the thing the box-number
 * rule further down this file was written to stop. The fix is a typed Opening
 * Type or a typed Site Title, both of which already win here.
 *
 * TO ADD ONE: match the way the Opening Type is written, tolerating a trailing
 * "(Series N)" or "#N" the way scripts/import-sheet.mjs's productKey() does,
 * and only where the Opening Type actually names the product. Anything not
 * listed keeps the set-and-product label, which fails LOUDLY (a visible wrong
 * name) rather than quietly.
 */
const OWN_LINE = [
  { match: /^first partner (?:illustration )?collection\b/i, unit: "Box" },
  { match: /^collector chest\b/i, unit: "Chest" },
];

/**
 * The product a rip opened, when that product is nobody's set's.
 *
 * Exported because scripts/build-set-pages.mjs has to ask the same question for
 * a different reason, and two copies of this list would be two lists.
 *
 * @param v a video from videos.json
 * @returns { name, unit } or null
 */
export function ownLineProduct(v) {
  const typed = String(v?.openingType || "").trim();
  if (!typed) return null;
  const hit = OWN_LINE.find((p) => p.match.test(typed));
  return hit ? { name: typed, unit: hit.unit } : null;
}

/**
 * @param v         a video from videos.json
 * @param setName   Map of set id -> display name
 * @returns the label, or null when it cannot be built honestly
 */
export function ripLabel(v, setName, desc) {
  if (!v) return null;
  // A typed Site Title always wins. It is the escape hatch for the cases where
  // the derived label is wrong or simply worse.
  if (v.siteTitle) return v.siteTitle;

  // A PRODUCT THAT IS ITS OWN LINE NEEDS NO SET IN FRONT OF IT, and must not
  // have one: see OWN_LINE above. This sits ABOVE the set-and-product path
  // deliberately, so the box number and the pack number still print. It also
  // sits above the `!setId` bail, because the typed Opening Type is a whole
  // product name on its own: a First Partner rip that never got a set tag is
  // still fully described by "First Partner Illustration Collection (Series 1)
  // Box 6 - Pack 3", which is the opposite of the half label that bail is for.
  const own = ownLineProduct(v);
  if (own) {
    const b = v.boxNumber;
    const p = v.packNumber;
    if (b && p) return `${own.name} ${own.unit} ${b} - Pack ${p}`;
    if (b) return `${own.name} ${own.unit} ${b}`;
    if (p) return `${own.name} - Pack ${p}`;
    return own.name;
  }

  const setId = (v.sets || [])[0];
  const prodId = (v.products || [])[0];
  if (!setId || !prodId) return null;

  // THE `|| setId` THAT USED TO BE HERE PUT RAW SLUGS ON PUBLIC TILES, TWICE.
  //
  // Every caller hands in a Map built from public/data/sets.json, which is only
  // the sets with a guide page. The first time that showed was 21 videos going
  // out as "ja-abyss-eye Japanese Pack #9", fixed by layering the taxonomy under
  // the map in stamp-labels.mjs and nowhere else. The second time was the day
  // the video log's Set dropdown grew to all 174 English sets: a rip tagged with
  // a set that has no guide came out as "unbroken-bonds ETB #7" on /videos.html.
  //
  // So the fallback is labelFor(), which knows every set the sheet can produce,
  // and the raw id is now genuinely the last resort it always claimed to be.
  // The caller's Map still wins, because sets.json is the name the guide pages
  // print and nothing should disagree with those.
  const set = (setName && setName.get(setId)) || labelFor("sets", setId);
  let product = PRODUCT_LABEL[prodId] || prodId;

  // DO NOT SAY THE LANGUAGE TWICE. Non-English set names already carry their
  // marker, so pairing one with its language-specific product tag reads
  // "Abyss Eye (JP) Japanese Pack" and "Clay Burst (KR) Korean Pack". The
  // marker is the better half of that pair: it sits with the set name, where a
  // reader is already looking, and it survives being read on its own in a
  // filter list. So the product drops back to plain "Pack" when the set has
  // already said it.
  if (/\((?:JP|KR|CN|TW)\)\s*$/.test(set) && /^(?:japanese|korean|chinese)-pack$/.test(prodId)) product = "Pack";

  // WHICH BOX, THEN WHICH PACK OUT OF IT. Asked for by name: "Chaos Rising ETB
  // 3 - Pack 3, or Pitch Black Booster Bundle 2 Pack 6".
  //
  // TYPED ONLY, AND THAT IS THE WHOLE RULE. Tim, 18 August 2026: "make sure you
  // aren't tagging any videos with what type of product it is and what packs
  // are in the video until you get my execl sheet thats filled out with all
  // that exact data".
  //
  // This function used to parse a pack number out of the title or description
  // and print it. That is a guess about what happened inside a video, made by a
  // regex, shown to the public as fact. It is also what produced eight separate
  // videos labelled "Chaos Rising ETB #2" and one labelled "ETB #9", a box that
  // has never existed, because the parsed number is the PACK and it was printed
  // where a reader reads the BOX.
  //
  // So a number appears only when Tim typed it in the sheet. Everything else
  // stops at the product: "Chaos Rising ETB". NUM stays because build-sheet.py
  // still reports what his own copy says, as a note for him to confirm, never
  // as something published.
  const box = v.boxNumber;
  const pack = v.packNumber;
  if (box && pack) return `${set} ${product} ${box} - Pack ${pack}`;
  if (box) return `${set} ${product} ${box}`;
  if (pack) return `${set} ${product} - Pack ${pack}`;

  return `${set} ${product}`;
}
