// The CASE STAND-IN rule, for /most-expensive-sealed.html.
//
// WHY THIS FILE EXISTS, AND IT IS A CATEGORY RATHER THAN FOUR ROWS.
// On 18 August 2026 four of the hundred rows on /most-expensive-sealed.html
// drew the empty frame, and all four were CASES: the outer carton a shop
// receives, holding many inner units.
//
//   rank  8  Paldean Fates Booster Bundle Display Case   635609
//   rank 55  Prismatic Evolutions Booster Bundle Case    615027
//   rank 60  151 Mini Tin Display Case                   668357
//   rank 73  Crown Zenith Mini Tin Display Case          631791
//
// THE MISSING PHOTOGRAPHS ARE NOT A FETCH PROBLEM AND THAT WAS CHECKED RATHER
// THAN ASSUMED. All four were fetched at _150w, _200w, _400w and _in_1000x1000
// and every one answers 403, while product 98580 from the same list answers 200
// under the identical User-Agent in the same run. Same request, different
// answer, so the file is absent from TCGplayer's CDN. sync-top100.mjs's `noImg`
// flag is correct and must not be "fixed".
//
// It is also not a coincidence. TCGplayer photographs the thing a collector
// buys; a case is a shipping carton a distributor buys, so the catalogue
// carries the listing without ever carrying a picture. Any case entering this
// hundred next month arrives with the same gap, which is why this is a rule and
// not four hard-coded ids.
//
// WHAT THE RULE DOES. It reads the INNER product out of the row's own name,
// resolves that name against public/data/products.json, and hands back the
// inner product's photograph. The row keeps describing the case: its rank, its
// name and its price are untouched. Only the picture, its alt text and a
// VISIBLE caption describe the inner unit. This is the same bargain
// shared/product-photos.mjs already strikes on /msrp.html, where "a pin is ONE
// specific product standing in for the type" and the page prints the pictured
// product's name in visible text. An unlabelled stand-in would be a photograph
// quietly claiming to be a case, which is the one thing that must not happen:
// the blank frame is honest, an unlabelled stand-in is not.
//
// HOW IT BEHAVES FOR A CASE NOBODY HAS SEEN YET, which is the whole point:
//
//   "Mega Evolution Booster Bundle Case"   -> strips "Case", looks for
//                                            "Mega Evolution Booster Bundle" in
//                                            the mega-evolution set, finds the
//                                            Booster Bundle, captions it.
//   "Black Bolt Mini Tin Display Case"     -> strips "Display Case", finds
//                                            "Black Bolt Mini Tin [<art>]" by
//                                            the bracket rule below, captions
//                                            the exact tin in the picture.
//   a case from a set products.json has
//   never pulled                           -> no set match, returns null, the
//                                            row keeps the empty frame.
//   a case whose inner kind products.json
//   does not carry (a Booster Box Case
//   for a set we hold no Booster Box for)  -> no name match, returns null, the
//                                            row keeps the empty frame.
//   a case whose inner product's own
//   photograph is dead                     -> caller passes the no-scan ids in
//                                            as `dead`, returns null, the row
//                                            keeps the empty frame.
//
// So the failure mode is always a blank, never a wrong or an unlabelled
// picture. That is deliberate: this file can only ever ADD a captioned
// photograph to a row that would otherwise be empty, so the worst thing a bad
// day here can do is leave the page exactly as it was before this rule existed.
//
// WHY IT READS products.json RATHER THAN SEARCHING TCGPLAYER. The builder is
// offline by design (see the header of scripts/build-top100.mjs): it works from
// whatever the last sync left on disk, so a build with no network reprints the
// last list. products.json is written by sync-products.mjs, is the same
// catalogue the case row came from, and is already the source /msrp.html and
// /what-to-buy.html trust for product photography. A stand-in whose id is in
// data/no-scan.json is skipped up front, the same guard those two pages use,
// and sync-top100.mjs fetches the resolved stand-in on every run so a
// photograph that dies later is flagged rather than left to 403 at a reader.

/** Strip diacritics, collapse whitespace, lowercase. */
const norm = (v) =>
  String(v ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * The words that make a product a MULTIPLE of something else.
 *
 * Deliberately the same vocabulary as the FORMS table in build-top100.mjs,
 * which already labels these rows "Case", "Display" and "Set of N" and already
 * offers a toggle to hide them. This file does not get to disagree with the
 * label the row is wearing.
 */
const MULTI_TAIL = [
  /\s+display\s+case$/i,
  /\s+case$/i,
  /\s+display$/i,
  /\s+\(?set of \d+\)?$/i,
];
const MULTI_ANY = /\bcase\b|\bdisplay\b|\bset of \d+\b/i;

/** Is this product name itself a multiple of some smaller product? */
export const isMultiName = (name) => MULTI_ANY.test(String(name ?? ""));

/**
 * The inner product's name, read off the row's own name, or null.
 *
 * Peeled rather than matched once, because "Booster Bundle Display Case" wears
 * two of these words and dropping only the last one leaves "... Display", which
 * is still a multiple and would resolve to nothing.
 */
export function innerName(rowName) {
  let out = String(rowName ?? "").trim();
  if (!out) return null;
  let peeled = false;
  for (let pass = 0; pass < 4; pass++) {
    const hit = MULTI_TAIL.find((re) => re.test(out));
    if (!hit) break;
    out = out.replace(hit, "").trim();
    peeled = true;
  }
  // Nothing was peeled, or the peel ate the whole name, or what is left is
  // still a multiple ("Case of Displays" and anything else this vocabulary
  // cannot take apart). All three mean: this file has nothing to say.
  if (!peeled || !out || isMultiName(out)) return null;
  return out;
}

/**
 * Index public/data/products.json by the TCGplayer set name the sealed rows
 * carry, which is the `tcgSet` field on each set and the `setName` on each row.
 * Joining on that string rather than on our own set slug means a set this repo
 * has never written a guide for still resolves.
 */
export function standInIndex(productsDoc) {
  const bySet = new Map();
  for (const [slug, set] of Object.entries(productsDoc?.sets || {})) {
    if (!set?.tcgSet || !Array.isArray(set.products)) continue;
    bySet.set(norm(set.tcgSet), { slug, products: set.products });
  }
  return bySet;
}

/**
 * The photograph to stand in for a case row, or null.
 *
 * @param item  a sealed row: { name, setName, productId }
 * @param index the Map from standInIndex()
 * @param dead  Set of TCGplayer product ids (as strings) known to have no
 *              photograph, from data/no-scan.json
 * @returns {{productId:number,name:string,img:string,url:string}|null}
 */
export function caseStandIn(item, index, dead = new Set()) {
  if (!item || !index) return null;
  const inner = innerName(item.name);
  if (!inner) return null;

  const set = index.get(norm(item.setName));
  if (!set) return null;

  const want = norm(inner);
  const candidates = set.products.filter(
    (p) =>
      p &&
      p.productId &&
      p.thumb &&
      // Never stand a multiple in for a multiple: the picture has to be of one
      // unit, not of a smaller carton.
      !isMultiName(p.name) &&
      String(p.productId) !== String(item.productId) &&
      !dead.has(String(p.productId)),
  );

  // Exact first. Then the BRACKET rule: TCGplayer files the several artworks of
  // one mini tin as "151 Mini Tin [Magneton & Ekans]", and a case row names the
  // type without one, so "<inner> [" is a real match and "<inner> anything
  // else" is not. Taking any prefix here would let "151 Booster Bundle" answer
  // for "151 Booster", which is a different product.
  const hit =
    candidates.find((p) => norm(p.name) === want) ||
    candidates.find((p) => norm(p.name).startsWith(`${want} [`)) ||
    null;
  if (!hit) return null;

  return {
    productId: hit.productId,
    name: hit.name,
    // The 150w rendition, which is what the sealed rows already use and what
    // sync-top100.mjs checks. products.json stores a 200w thumb and a
    // 1000x1000; neither is the size this box paints.
    img: `https://tcgplayer-cdn.tcgplayer.com/product/${hit.productId}_150w.jpg`,
    url: hit.url || `https://www.tcgplayer.com/product/${hit.productId}`,
  };
}
