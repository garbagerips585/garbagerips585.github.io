/* PRICES FOR THE 30th CELEBRATION CARDS THE NORMAL CHAIN CANNOT REACH.
 *
 * public/data/cards/30th-celebration.json carries the 158 numbered cards and
 * their money, and every builder reads it. Two kinds of 30th card are not in
 * it and never will be, and both were printing "No price yet" on the site
 * after PriceCharting had started pricing them:
 *
 *   - the Classic Collection, 30 reprints that keep their ORIGINAL numbers
 *     (69/132, 4/102), deliberately left out of that file because TCGdex holds
 *     them as a separate set with no images;
 *   - the Black Star Promos and jumbos, which are no set's checklist at all.
 *
 * data/30th-prices.json holds both, written by scripts/sync-30th-prices.mjs.
 * This reads them back for a hit row in data/hits.json, in the same shape
 * shared/first-partner.mjs's priceForHit() returns, so a builder can chain it
 * beside that one and nothing else has to know which file answered.
 *
 * THE NAME MUST AGREE AS WELL AS THE NUMBER. The Greninja ex promo is 099 and
 * 099 in the main set is Hydreigon; a promo key and a classic key cannot collide
 * with the main set by construction, and the name check is what stops a typo in
 * a hit row landing on another card in the same key space.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let doc = { cards: {}, promos: {} };
try {
  doc = JSON.parse(readFileSync(join(ROOT, "data/30th-prices.json"), "utf8"));
} catch {}

/* The promo's own picture, off the TCGplayer id the binder records for it
   (see `_pidNote` in data/30th-binder.json). Returned with the price so a
   plaque gets both from one call, the way first-partner.mjs hands back both. */
let binder = { promos: [], jumbos: [] };
try {
  binder = JSON.parse(readFileSync(join(ROOT, "data/30th-binder.json"), "utf8"));
} catch {}
const CDN = "https://tcgplayer-cdn.tcgplayer.com/product/";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const PC = "https://www.pricecharting.com";

const shape = (r) =>
  r && typeof r.raw === "number"
    ? { price: r.raw, psa10: r.psa10 ?? null, source: "PriceCharting", asOf: doc.checked || null, url: r.pc ? PC + r.pc : null }
    : null;

/** A Classic Collection card by its printed number, "69/132". */
export function classicPrice(number, name) {
  const r = (doc.cards || {})[`classic|${number}`];
  return r && norm(r.name).startsWith(norm(name)) ? shape(r) : null;
}

/** A 30th promo ("promo") or jumbo ("jumbo") by its number, "099". */
export function promoPrice(number, name, kind = "promo") {
  const r = (doc.promos || {})[`${kind}|${String(number).padStart(3, "0")}`];
  const out = r && norm(r.name) === norm(name) ? shape(r) : null;
  const mine = (kind === "jumbo" ? binder.jumbos : binder.promos || [])
    .find((o) => norm(o.name) === norm(name) && Number(o.n) === Number(number));
  if (out && mine?.pid) {
    out.img = `${CDN}${mine.pid}_200w.jpg`;
    out.imgLarge = `${CDN}${mine.pid}_in_1000x1000.jpg`;
  }
  return out;
}

/** A data/hits.json row, or null when it is not a 30th card this file covers. */
export function priceForHit(h) {
  if (!h || h.set !== "30th-celebration" || !h.number) return null;
  if (h.promo) return promoPrice(h.number, h.card, "promo");
  if (String(h.number).includes("/")) return classicPrice(h.number, h.card);
  return null;
}
