// THE COMPANION SUBSETS, PRICED, FOR EVERY RENDERER THAT IS NOT A SET GUIDE.
//
// Added 14 October 2026. data/companion-sets.json names three subsets that come
// out of another set's packs and are filed separately by the card databases:
// Crown Zenith's Galarian Gallery, Shining Fates' Shiny Vault and Celebrations'
// Classic Collection. data/companion-prices.json has priced all 217 cards since
// 2 October, and build-set-pages.mjs merges them into the three guides. NOTHING
// ELSE DID, so four other places answered the very question companion-sets.json
// was written to stop them answering:
//
//   /complete-a-set.html   "Master set: everything, secret rares included" was
//                          Crown Zenith at $270 against about $2,361 with the
//                          Galarian Gallery, and named a $41 Pikachu as the
//                          set's priciest card beside a $267 Giratina VSTAR.
//   the home page tiles    "Top card" $232 PSA 10 for Crown Zenith, where the
//                          set guide and /sets/ say $267 / $510.
//   a rip page and /hall   Paras GG32 printed a frozen rip-log $9.26 and "No PSA
//                          10 price" over companion-prices' $8.00 and $157.50.
//
// THIS IS DELIBERATELY THE MONEY ONLY. build-set-pages.mjs also joins each row
// to the printings corpus for its name, rarity and scan and re-checks the card
// counts on every build; that check stays where it is (it fails the build, so a
// drift is caught there before any page reads this). What a cost total, a top
// card and a hit card need is the figure, the name and the printed number, and
// every one of those is in data/companion-prices.json itself.
//
// Only a subset whose companion-sets.json entry says `priced: true` is read,
// which is the same gate build-set-pages.mjs applies.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const num = (v) => (typeof v === "number" && v > 0 ? v : null);
const key = (x) => String(x ?? "").toUpperCase().replace(/^([A-Z]+)0+(?=\d)/, "$1");

/**
 * Map of parent set id -> { label, fullName, checked, source, cards }, where
 * each card is { key, name, printed, price, psa10, g9, all, url }.
 * Fails soft: a missing file is an empty map, never a broken build.
 */
export async function loadCompanionCards(root) {
  let meta = {};
  let prices = {};
  try {
    meta = JSON.parse(await readFile(join(root, "data/companion-sets.json"), "utf8")).sets || {};
  } catch { /* no companions: every page renders as it did */ }
  try {
    prices = JSON.parse(await readFile(join(root, "data/companion-prices.json"), "utf8"));
  } catch { /* run: node scripts/sync-pricecharting-cards.mjs --companions */ }

  const out = new Map();
  for (const [setId, m] of Object.entries(meta)) {
    if (!m?.priced) continue;
    const p = prices.sets?.[setId];
    if (!p?.cards) continue;
    const cards = Object.entries(p.cards).map(([k, c]) => ({
      key: k,
      name: c.name,
      // Celebrations' Classic Collection prints its ORIGINAL set numbers
      // (Charizard 4/102), which companion-sets.json records under `printed`.
      printed: m.printed?.[k]?.no || k,
      price: num(c.price),
      psa10: num(c.psa10),
      g9: num(c.g9),
      all: c.all || null,
      url: c.url || null,
    }));
    out.set(setId, {
      label: String(m.name || "").replace(/^the\s+/i, ""),
      fullName: m.fullName || null,
      checked: p.checked || null,
      source: prices.source || "pricecharting.com",
      cards,
    });
  }
  return out;
}

/**
 * The companion card a logged hit names, or null. A hit names one when its
 * collector number is a subset number (GG32, SV107, CC002) or when the row
 * routes it through the subset name ("Paras - Galarian Gallery"). The NAME
 * must agree as well, the rule every join on this site keeps: a number alone
 * matched Hydreigon to a Greninja promo on the 30th page.
 */
export function companionForHit(companions, h) {
  const comp = companions.get(h?.set);
  if (!comp) return null;
  const norm = (x) => String(x || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const label = norm(comp.label);
  const said = `${h.card || ""} ${h.printing || ""} ${h.rarity || ""}`;
  const cardName = norm(String(h.card || "").replace(new RegExp(`\\s*${comp.label}$`, "i"), ""));
  const byNum = h.number ? comp.cards.filter((c) => key(c.key) === key(h.number)) : [];
  if (byNum.length === 1 && norm(byNum[0].name) === cardName) return { ...byNum[0], subset: comp };
  if (!norm(said).includes(label)) return null;
  const byName = comp.cards.filter((c) => norm(c.name) === cardName);
  return byName.length === 1 ? { ...byName[0], subset: comp } : null;
}
