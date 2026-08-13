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

/** Product tag -> how it is written on a tile. */
export const PRODUCT_LABEL = {
  etb: "ETB",
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
  upc: "UPC",
};

// "Pack #3", "pack 3", "#3", "Pack 3 of 9". Capped at two digits: a four digit
// number in a title is a year or a card number, not a pack count.
const NUM = /(?:\bpack\s*#?\s*(\d{1,2})\b|#\s*(\d{1,2})\b)/i;

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

  const setId = (v.sets || [])[0];
  const prodId = (v.products || [])[0];
  if (!setId || !prodId) return null;

  const set = (setName && setName.get(setId)) || setId;
  const product = PRODUCT_LABEL[prodId] || prodId;

  // THE PACK NUMBER IS IN THE DESCRIPTION MORE OFTEN THAN THE TITLE, which is
  // the opposite of what you would guess: 238 videos carry it in the
  // description against 197 in the title, and 239 in one or the other. The
  // title is checked first because when it IS there it is the headline fact;
  // the description is the fallback and it is where most of them live.
  // It is the one part of the label that is parsed rather than looked up, so it
  // is dropped silently when absent rather than guessed at.
  const m = String(v.title || "").match(NUM) || String(desc || "").match(NUM);
  const n = m ? m[1] || m[2] : null;

  return `${set} ${product}${n ? ` #${n}` : ""}`;
}
