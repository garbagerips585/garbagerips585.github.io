#!/usr/bin/env node
// Make TCGdex the single source of truth for card prices AND art.
//
//   node scripts/sync-cards.mjs       (first, fetches both)
//   node scripts/reconcile-cards.mjs  (this, pushes them into the other files)
//
// WHY THIS EXISTS. Three feeds were quoting the same cards:
//
//   public/data/sets.json      chase prices from api.pokemontcg.io   19 sets
//   data/chase-tcg.json        chase prices scraped from TCGplayer    4 sets
//   public/data/cards/*.json   every card, from TCGdex               23 sets
//
// So /sets/index.html said Umbreon ex was $1,480.32 and
// /sets/prismatic-evolutions.html, one click away, said $1,470.58. 113 of the
// 136 chase cards carried two different numbers, and no page named its source.
//
// TCGDEX WINS, and the reason is measured rather than assumed:
//   - Reliability. api.pokemontcg.io failed about half its requests in testing
//     and its own site now redirects to a paid successor. TCGdex served ~6,700
//     requests across a single build day without a failure.
//   - Coverage. 4,468 of 4,481 English cards carry a price. The old API had
//     NONE for the four newest sets, which is why chase-tcg.json had to be
//     scraped separately in the first place.
//   - Freshness. TCGdex re-reads TCGplayer daily.
//   - It is the same measurement. Every one of the 113 disagreements was on a
//     card with exactly ONE variant, so the gap is not our dearest-variant
//     rule; both feeds report TCGplayer market price, read a day apart. Median
//     gap 0.56%, p90 1.98%.
//
// Doing it here rather than in the eighteen scripts that read a price means one
// place to change, and no page can disagree with another by construction.
//
// The old API still supplies things TCGdex is not being asked for here: set
// card counts, the rarity breakdown, release dates and set symbols. Only the
// PRICES move. If a chase card cannot be found in the TCGdex data its existing
// price is left alone rather than blanked, and the run says so.

import { readFile, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Card numbers are written "161" in one file and "021" in another, so compare
// them stripped of leading zeros rather than as strings.
const norm = (n) => String(n ?? "").replace(/^0+(?=\d)/, "").toLowerCase();

const truth = new Map(); // "set|number" -> price
const art = new Map(); // "set|number" -> TCGdex image base
const bySet = new Map(); // slug -> every card, for building a chase list
// THE CARD DATA AND THE MONEY ARE READ ON DIFFERENT DAYS FROM DIFFERENT PLACES,
// and this file used to collapse them. `checked` is when TCGdex was read for the
// CARD LIST. The prices come from PriceCharting and carry their own
// `pricesChecked`, several days apart in practice: 2026-08-12 against
// 2026-08-16 as this was written.
//
// Stamping the checklist's date and the literal string "TCGdex" onto sets.json's
// PRICE fields meant every set claimed its money came from a feed the site
// stopped using on 18 August 2026, dated to an event that was not the reading of
// that money. Nothing rendered it, so nothing caught it, and the home page's
// price grid was one join away from publishing it.
//
// Per set, out of the file the prices are actually in, so it cannot drift again.
const priceMeta = new Map(); // slug -> { source, asOf }
let checked = null;
for (const f of await readdir(join(ROOT, "public/data/cards"))) {
  if (!f.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
  // The NEWEST of the per-set dates, not whichever file readdir returned first.
  if (doc.checked && (!checked || doc.checked > checked)) checked = doc.checked;
  bySet.set(doc.set, doc.cards);
  priceMeta.set(doc.set, { source: doc.priceSource, asOf: doc.pricesChecked });
  for (const c of doc.cards) {
    const k = `${doc.set}|${norm(c.n)}`;
    if (typeof c.price === "number") truth.set(k, c.price);
    if (c.img) art.set(k, c.img);
  }
}
console.log(`TCGdex holds ${truth.size} priced cards and ${art.size} card images, read ${checked}`);

// ART IS THE BIGGER WIN OF THE TWO. The English set guides served
// images.pokemontcg.io/<set>/<n>_hires.png as the thumbnail in an 8 card grid:
// 836KB per card for a picture rendered 245px wide, measured. TCGdex's low.webp
// of the same card is 35KB. Twenty-three times smaller, on the pages that are
// the site's main search landing pages, and all 184 chase cards have one. The
// imported guides already used it; the English ones were never converted.
let artChanged = 0;
let changed = 0;
let builtChase = 0;

// Rarity strings come through in two shapes. TCGplayer's feed sends screaming
// snake case for the newest tiers, and MEGA_ATTACK_RARE was rendering verbatim
// to readers on a set page.
const prettyRarity = (r) =>
  !r
    ? null
    : /^[A-Z0-9_]+$/.test(r)
      ? r.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
      : r;

/**
 * A chase list built from the full checklist.
 *
 * Ascended Heroes shipped a ladder topping out at $69.94 while its dearest card
 * is $1,118.76: the scraped source carried eight cards and none of the secret
 * rare tier, so the set guide, the /sets/ index and the home page chip all
 * agreed with each other and disagreed with the card data on the same site.
 *
 * We now hold every card and its price for all 23 sets, so a set with no chase
 * list gets one from the top of its own checklist rather than from a partial
 * scrape. Sets that already have a good one keep it.
 */
function chaseFromCards(slug, n = 8) {
  const cards = bySet.get(slug) || [];
  return cards
    .filter((c) => typeof c.price === "number" && c.price > 0)
    .sort((a, b) => b.price - a.price)
    .slice(0, n)
    .map((c) => ({
      name: c.name,
      number: c.n,
      rarity: prettyRarity(c.rarity),
      price: c.price,
      image: c.img ? `${c.img}/low.webp` : null,
      imageLarge: c.img ? `${c.img}/high.webp` : null,
      source: "TCGdex",
    }));
}
let unchanged = 0;
const orphans = [];

// ------------------------------------------------------------- sets.json

/** Credit a set's money to the feed it came from, on the day THAT was read.
 *  Falls back to the checklist date only when a set has no price file at all,
 *  and says which feed it means rather than naming the card-data one. */
function stampPrices(s) {
  const m = priceMeta.get(s.id) || {};
  s.pricesAsOf = m.asOf || checked;
  s.priceSource = m.source || "unknown";
}

const setsPath = join(ROOT, "public/data/sets.json");
const setsDoc = JSON.parse(await readFile(setsPath, "utf8"));
for (const s of setsDoc.sets || []) {
  // UNCONDITIONALLY, not only when something else about the set changed. These
  // two fields describe the price file, which is read every run, so they are
  // never "unchanged" in a way that justifies leaving an old value behind. The
  // first version of this stamped only inside the two conditional branches, which
  // is why running it changed nothing at all: 28 sets kept a "TCGdex" label from
  // a run months of price feeds ago, and the fix looked like it had worked.
  stampPrices(s);
  // An empty chase list means the page renders "no market prices yet" or falls
  // back to a partial scrape. We have the whole checklist now.
  if (!(s.chase || []).length) {
    const built = chaseFromCards(s.id);
    if (built.length) {
      s.chase = built;
      s.pricedCount = (bySet.get(s.id) || []).filter((c) => typeof c.price === "number").length;
      builtChase++;
      console.log(`  ${s.id.padEnd(21)} built a chase list from the checklist, top ${built[0].name} $${built[0].price}`);
      continue;
    }
  }
  for (const c of s.chase || []) {
    const p = truth.get(`${s.id}|${norm(c.number)}`);
    if (p == null) {
      orphans.push(`${s.id}-${c.number} (${c.name})`);
      continue;
    }
    const a = art.get(`${s.id}|${norm(c.number)}`);
    if (a) {
      const thumb = `${a}/low.webp`;
      const large = `${a}/high.webp`;
      if (c.image !== thumb || c.imageLarge !== large) {
        c.image = thumb;
        c.imageLarge = large;
        artChanged++;
      }
    }
    if (c.rarity) c.rarity = prettyRarity(c.rarity);
    if (typeof c.price === "number" && Math.abs(c.price - p) < 0.005) {
      unchanged++;
      continue;
    }
    c.price = p;
    changed++;
  }
  if (s.rarities) {
    const fixed = {};
    let renamed = false;
    for (const [r, n] of Object.entries(s.rarities)) {
      const nice = prettyRarity(r);
      if (nice !== r) renamed = true;
      fixed[nice] = (fixed[nice] || 0) + n;
    }
    if (renamed) s.rarities = fixed;
  }
}
await writeFile(setsPath, JSON.stringify(setsDoc, null, 2) + "\n");

// -------------------------------------------------------- chase-tcg.json
//
// NOTHING TO RECONCILE HERE ANY MORE. This used to walk every card in
// chase-tcg.json and overwrite its price, image and rarity with the checklist's,
// because that file held a second copy of all three and the two disagreed.
//
// It is link-only now: a TCGplayer product url per collector number and nothing
// else. There is no price to correct and no card name to argue with. The
// nightly job also used to run this whole script a second time, purely to undo
// what sync-chase.mjs had just written back; that second pass is gone with it.

// ------------------------------------------------- public/data/wanted.json
//
// sync-wanted resolves the hunt list against the Pokemon TCG API, which hands
// back _hires.png: six cards at 489KB to 824KB each, for tiles rendered 245px
// wide. Editing the source file does not help, because the sync overwrites it.
// Reconciling here means the fix survives the next sync, same as everywhere
// else.
let wantedFixed = 0;
try {
  const wp = join(ROOT, "public/data/wanted.json");
  const doc = JSON.parse(await readFile(wp, "utf8"));
  const list = Array.isArray(doc) ? doc : doc.cards || doc.wanted || [];
  for (const c of list) {
    const a = art.get(`${c.set}|${norm(c.number)}`);
    if (!a) continue;
    const thumb = `${a}/low.webp`;
    const large = `${a}/high.webp`;
    if (c.image !== thumb || c.imageLarge !== large) {
      c.image = thumb;
      c.imageLarge = large;
      wantedFixed++;
    }
  }
  if (wantedFixed) await writeFile(wp, JSON.stringify(doc, null, 2) + "\n");
} catch {
  /* run: node scripts/sync-wanted.mjs */
}

console.log(`  ${changed} price(s) rewritten, ${unchanged} already matched`);
if (wantedFixed) console.log(`  ${wantedFixed} most-wanted card image(s) repointed at TCGdex`);
console.log(`  ${artChanged} card image(s) repointed at TCGdex`);
if (builtChase) console.log(`  ${builtChase} set(s) got a chase list built from their own checklist`);
if (orphans.length) {
  console.log(`\n${orphans.length} chase card(s) not found in the TCGdex data, left as they were:`);
  for (const o of orphans.slice(0, 12)) console.log("  " + o);
  if (orphans.length > 12) console.log(`  ... and ${orphans.length - 12} more`);
}
