// The sealed-product PHOTOGRAPH PINS, once, for /msrp.html and /what-to-buy.html.
//
// WHY THIS FILE EXISTS. The map below lived in build-msrp.mjs, and
// build-what-to-buy.mjs carried a second copy of the subset it pictured. Its own
// comment admitted it: "a second copy of the pin map in build-msrp.mjs ... the
// honest fix is a shared module". Two copies of a product-to-photograph mapping
// drift, and this site has already been bitten by exactly that shape: two
// Pokemon Center SKUs sharing one name resolved to whichever a Map saw last, and
// the page built cleanly either way (see the PC_BY_NAME note in build-msrp.mjs).
// A pin now exists ONCE and both pages read it.
//
// KEYED BY data/msrp.json's `rowId`, which is the one identifier both pages
// already share. It is NOT the taxonomy `id`: the taxonomy deliberately buckets
// an ETB and a Pokemon Center ETB under one tag, and a mini tin and a collector
// tin under another, and those pairs have different prices and different boxes.
// build-what-to-buy.mjs joins to msrp.json by label and looks the rowId up
// there, so the two pages cannot pin different photographs to one row.
//
// WHAT A PIN IS. TCGplayer's product shots are the only product photography this
// repo can reach, they are per SET rather than per TYPE, and pokemoncenter.com
// is off limits (it serves a bot challenge; see the header of build-msrp.mjs).
// So the picture on a row is ONE specific product standing in for the type, and
// both pages NAME the product in the picture in visible text as well as in the
// alt. Anything looser is a photograph quietly claiming to be a category.
//
// Where a row shows the same kind as an /openings/ page, the set is deliberately
// the same one, so a reader moving between the pages sees the same box.
//
// THE NAME CHECK IS THE SAFETY PROPERTY AND IT SURVIVED THE MOVE INTACT, one
// notch louder. sync-products.mjs picks the cheapest variant per kind, so the
// product sitting behind "prismatic-evolutions / Tin" can change under us; if it
// does, the caption would name a product that is not in the picture. The old
// copies DROPPED the photograph in that case, which is safe but silent. This
// THROWS instead, because a drifted pin is never a legitimate missing photo: it
// is a hand-written claim that has stopped being true, and the page it would
// quietly degrade is the one recommending a first present to a parent. A row
// with NO pin at all still returns null and still gets the site's hatch, which
// is the case that must keep working and is the reason the throw is scoped to
// pins only.
//
// A KNOWN-DEAD IMAGE IS NOT A DRIFT and does not throw. data/no-scan.json
// records the urls that answer 403; a pin whose photograph has gone gets the
// hatch, because that is a missing picture rather than a wrong one.
//
// TWO MORE COPIES OF THIS SHAPE EXIST and were deliberately left alone:
// build-openings.mjs and build-how-many-packs.mjs each hold their own PHOTOS map
// keyed by taxonomy id and by pack-count row name respectively, which are
// different keys over a different subset. Folding those in is a real cleanup and
// a bigger one; do it as its own change, with their arguments carried over
// rather than summarised.

/**
 * [set id, products.json kind, the name expected there]  or  ["extra", key]
 *
 * "extra" reads data/extra-products.json, which is written by
 * sync-extra-products.mjs and holds the products sync-products.mjs cannot reach:
 * it pulls per EXPANSION, and a stacking tin, a battle deck, a Battle Academy
 * and a Trainer's Toolkit belong to no expansion at all. Every entry there is
 * pinned by TCGplayer id and checked by name, with the argument for the pin
 * written beside it.
 */
export const PRODUCT_PHOTOS = {
  etb: ["pitch-black", "Elite Trainer Box", "Pitch Black Elite Trainer Box"],
  "etb-pc": ["pitch-black", "Pokemon Center Elite Trainer Box", "Pitch Black Pokemon Center Elite Trainer Box"],
  bundle: ["pitch-black", "Booster Bundle", "Pitch Black Booster Bundle"],
    // THE SLEEVED ROW HAS NO PIN AND TAKES THE HATCH. It was pinned to
    // stellar-crown, which flipped on 1 September 2026 and failed the nightly for
    // two days; re-pinned to obsidian-flames, which flipped by 3 September and
    // failed it again, three nights out of six. The throw below describes exactly
    // this and the pin kept walking into it, because a set-and-kind pin cannot
    // hold a VARIANT: sync-products.mjs keeps only the CHEAPEST product of each
    // kind, and a sleeved pack is the cheapest Single Pack only by accident of
    // the day's prices.
    //
    // CHECKED BEFORE DROPPING IT RATHER THAN ASSUMED: on 4 September 2026 not ONE
    // set in products.json has a sleeved pack as its cheapest Single Pack, so the
    // third re-pin was never available in the first place.
    //
    // /msrp.html draws its own hatch for a row with no photograph and still owes
    // that row its price, which is the state this leaves. Pin it again only if a
    // set's cheapest Single Pack becomes a sleeved one AND looks likely to stay
    // that way; otherwise this row is a hatch by design.
  "pack-loose": ["pitch-black", "Single Pack", "Pitch Black Booster Pack"],
  "booster-box": ["pitch-black", "Booster Box", "Pitch Black Booster Box"],
  "blister-1": ["pitch-black", "Blister Pack", "Pitch Black Single Pack Blister"],
  // The only 3-pack blister in products.json. Every other set's Blister Pack row
  // is a 1-pack or a 2-pack, so this row cannot follow the others onto
  // Pitch Black without the caption naming a product that is not in the picture.
  "blister-3": ["shrouded-fable", "Blister Pack", "Shrouded Fable 3 Pack Blister"],
  "mini-tin": ["prismatic-evolutions", "Tin", "Prismatic Evolutions Mini Tin"],
  upc: ["151", "Ultra-Premium Collection", "151 Ultra-Premium Collection"],
  spc: ["prismatic-evolutions", "Super-Premium Collection", "Prismatic Evolutions Super-Premium Collection"],
  "poster-collection": ["151", "Collection Box", "151 Poster Collection"],
  "tech-sticker": ["white-flare", "Collection Box", "White Flare Tech Sticker Collection"],
  "build-battle": ["pitch-black", "Build & Battle Box", "Pitch Black Build & Battle Box"],
  // The ones the per-set pull cannot reach, pinned by hand in
  // data/extra-products.json. Most of them belong to no expansion at all, which
  // is why sync-products.mjs has never seen them.
  "collector-tin": ["extra", "collector-tin"],
  "poke-ball-tin": ["extra", "poke-ball-tin"],
  "knock-out": ["extra", "knock-out"],
  "ex-premium": ["extra", "ex-premium"],
  "ex-box": ["extra", "ex-box"],
  // The ex Box pin is the Mega Latias ex Box, which is ALSO one of the nine
  // listings that row's $21.99 rests on, so the picture and the price are the
  // same object for once rather than two boxes of the same type.
  "holiday-calendar": ["extra", "holiday-calendar"],
  // THE FOUR BEGINNER AND DECK ROWS WERE PINNED 17 AUGUST 2026 and they are the
  // reason this file exists at all. Battle Academy and My First Battle are the
  // two things /what-to-buy.html recommends to a parent buying a first present,
  // and they were recommended with no picture of what to look for on a shelf.
  // Each of these four is pinned to a product the row's OWN price rests on,
  // named in that row's `pcFrom`, rather than to a nearby box of the same type;
  // the argument for each is in sync-extra-products.mjs.
  "battle-academy": ["extra", "battle-academy"],
  "my-first-battle": ["extra", "my-first-battle"],
  "league-battle-deck": ["extra", "league-battle-deck"],
  "v-battle-deck": ["extra", "v-battle-deck"],
  // THE LAST EIGHT HATCHED BOXES ON /msrp.html WERE FILLED ON 18 AUGUST 2026,
  // the same way the four above were and not by loosening anything. The entry
  // that used to sit here said these rows had no pin because products.json holds
  // eleven kinds and none of them is any of these, which was true and is still
  // true: sync-products.mjs pulls per EXPANSION and none of these belongs to
  // one. It also said the hatch was the CORRECT answer rather than a gap, and
  // that the way to fix one properly was to add it to sync-extra-products.mjs
  // with the argument for the pin. That is exactly what was done, seven times.
  //
  // EACH IS PINNED TO A PRODUCT NAMED IN THAT ROW'S OWN `pcFrom` in
  // data/msrp.json, so the photograph is one of the boxes the price was read
  // off, never a nearby box of the same type. Where a row rests on several at
  // one figure the pin is the newest of them. The argument for every one, and
  // the wrong-year box each row's note excludes, is in sync-extra-products.mjs.
  "build-battle-stadium": ["extra", "build-battle-stadium"],
  binder: ["extra", "binder"],
  "pin-collection": ["extra", "pin-collection"],
  "premium-tournament": ["extra", "premium-tournament"],
  "collector-chest": ["extra", "collector-chest"],
  "trainers-toolkit": ["extra", "trainers-toolkit"],
  "tcg-classic": ["extra", "tcg-classic"],
  // THE EIGHTH ROW NEEDED NO NEW PRODUCT. Special Collection's $29.99 rests on
  // seven boxes and the first name in its `pcFrom` is the Charizard ex Special
  // Collection, which was already pinned in extra-products.json for
  // /how-many-packs.html's "ex Special Collection" row. So this row points at
  // the entry that already exists rather than a second copy of the same box:
  // one photograph, one name, one thing to re-check when TCGplayer moves it.
  "special-collection": ["extra", "ex-special"],
  // NO PIN, STILL, AND IT IS THE ONE ROW ON THE PAGE THAT KEEPS THE HATCH:
  // stacking-tin. It is not an oversight and it is not the same case as the
  // seven above. That row prints NO price at all, because Pokemon's own shop
  // runs seven stacking tins at two different figures by energy type, and
  // pokemon.com sources the 7 March 2025 run at 3 packs while TCGplayer lists
  // eleven Stacking Tins across four years with no release date published. So
  // there is no single product the row is about to photograph, and picking one
  // would be a guess wearing a caption. See sync-extra-products.mjs, which has
  // said so since the file was written.
};

/**
 * Build the photo lookup for one page.
 *
 * `products`  public/data/products.json, parsed.
 * `extra`     data/extra-products.json's `products` object, parsed.
 * `dead`      a Set of the image urls that answer 403, from data/no-scan.json.
 *
 * Returns `photoFor(rowId)` -> `{ src, large, name }` or null.
 *
 * Matched on set AND kind, then CHECKED AGAINST THE NAME expected there. See the
 * header: an unpinned row returns null, a dead image returns null, and a pin
 * that no longer resolves to the product it names fails the build.
 */
export function makePhotoFor({ products, extra, dead }) {
  return function photoFor(rowId) {
    const spec = PRODUCT_PHOTOS[rowId];
    if (!spec) return null;

    if (spec[0] === "extra") {
      const e = extra?.[spec[1]];
      if (!e) {
        throw new Error(
          `shared/product-photos.mjs pins the row "${rowId}" to the hand-pinned product\n` +
            `  ${JSON.stringify(spec[1])}\n` +
            `  and data/extra-products.json has no entry under that key. Either the pin was\n` +
            `  renamed in scripts/sync-extra-products.mjs, or that script dropped it because\n` +
            `  TCGplayer no longer answers for the pinned id, which it says out loud when it\n` +
            `  runs. Re-probe and re-pin, or remove the line here so the row takes the hatch.\n` +
            `  Do NOT point it at a nearby product: that is one box's photograph under\n` +
            `  another box's price.`
        );
      }
      if (!e.thumb || dead?.has(e.thumb)) return null;
      return { src: e.thumb, large: e.image, name: e.name };
    }

    const [sid, kind, expect] = spec;
    const hit = (products?.sets?.[sid]?.products || []).find((p) => p.kind === kind);
    if (!hit) {
      throw new Error(
        `shared/product-photos.mjs pins the row "${rowId}" to ${sid} / ${JSON.stringify(kind)}\n` +
          `  and public/data/products.json holds no product of that kind in that set. The set\n` +
          `  rotated out of the pull, or the kind was renamed. Re-pin the row onto a set that\n` +
          `  still has one, or remove the line so the row takes the hatch.`
      );
    }
    if (!String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) {
      throw new Error(
        `shared/product-photos.mjs pins the row "${rowId}" to ${sid} / ${JSON.stringify(kind)}\n` +
          `  expecting ${JSON.stringify(expect)}, and the product sitting there today is\n` +
          `  ${JSON.stringify(hit.name)}.\n` +
          `  sync-products.mjs takes the CHEAPEST variant of each kind, so the box behind a\n` +
          `  set-and-kind pin can change under us. The caption prints the name of whatever is\n` +
          `  in the picture, so shipping this would put one product's photograph beside\n` +
          `  another product's price. Re-pin the row, or drop it and take the hatch.`
      );
    }
    if (!hit.thumb || dead?.has(hit.thumb)) return null;
    return { src: hit.thumb, large: hit.image, name: hit.name };
  };
}
