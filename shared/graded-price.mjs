// ONE PSA 10 FIGURE PER CARD, ACROSS EVERY PAGE THAT PRINTS ONE.
//
// This module exists because the site published two different PSA 10 prices for
// the same printing on 54 pages at once, which is the exact failure
// build-hall.mjs's own header says cannot happen ("one card can never show two
// different numbers on two different pages").
//
// WHAT WENT WRONG, and it is worth stating precisely because the fix is not
// obvious from either side of it. On 18 August 2026 the owner said "lets use
// pricecharting as the main numbers for the entire site", and build-hall.mjs
// was moved onto data/graded.json for its graded column that day. Nothing else
// was. Five builders held their own private copy of a `gradedPrice(setId,
// number)` helper that reads data/psa10.json and NOTHING ELSE, so:
//
//      Mega Greninja ex, Chaos Rising #122
//        /hall.html and /grading.html   $906   graded.json, PriceCharting
//        53 rip pages + /sets/chaos-rising.html  $838   psa10.json `auto`,
//                                                        pokemonpricetracker.com
//
// A COPIED LOOKUP IS THE BUG, NOT THE PRECEDENCE. Five copies of the chain were
// survivable while all five read one file. The moment a second source went in
// front of it in ONE copy, the five copies had to agree about a rule that only
// one of them had been told, and that is not a thing five copies can do. So the
// chain lives here and every renderer calls it, which is the same argument
// shared/graded-gate.mjs and shared/decks.mjs make about their own shared half.
//
// ---------------------------------------------------------------------------
// THE PRECEDENCE, AND WHY IT IS IN THIS ORDER.
//
//   1. data/psa10.json `prices`   A HUMAN TYPED IT. It is a deliberate override
//                                 of whatever any feed says, entered through
//                                 the spreadsheet, and a sync must never win
//                                 against a number the owner checked himself. It is
//                                 empty today (0 entries), which is exactly why
//                                 it has to be implemented rather than assumed
//                                 away: the day somebody types one, it wins.
//   2. data/graded.json           PRICECHARTING. The owner's instruction of 18 August
//                                 2026, quoted above, and the source of every
//                                 raw price on the site since the same day.
//   3. data/psa10.json `auto`     pokemonpricetracker.com, the automated
//                                 fallback. NOT deleted: PriceCharting's graded
//                                 crawl is deliberately scoped (see below) and
//                                 covers 83 cards, so this is what stands
//                                 behind the several hundred it does not reach.
//                                 A stamped fallback figure beats a dash.
//
// The `auto` tier keeps its ten-sale floor. Volcarona came back at 15x its raw
// price off six recorded sales, which is an anecdote and not a market. The
// human tier skips the floor, because if the owner typed it he stands behind it, and
// PriceCharting publishes no sale count for the gate to read.
//
// ---------------------------------------------------------------------------
// THE PRINTING HAS TO AGREE AND IT IS NOT AUTOMATIC. This is the careful half
// and it is lifted from build-hall.mjs unchanged, comment and all, because the
// reason it is careful is a list of real bad matches rather than a worry.
//
// sync-pricecharting.mjs only rejects a wrong number when it was GIVEN one, and
// it was run over data/hits.json, which mostly carries no number. Four records
// came back for a different printing of the right card in the right set: Dawn
// #129 where ours is #118, Mega Gardevoir ex #178 where ours is #159, Mega
// Venusaur ex #177 where ours is #003, Cetitan ex #210 where ours is #065.
// data/graded.json's own readme records the Dawn one as a known bad match and
// says in as many words not to backfill an empty `number` from `matched`.
//
// `matched` carries the product PriceCharting actually landed on, so the number
// is re-checked HERE and a disagreement is DROPPED rather than printed. A dash
// is honest; a secret rare's price against a bulk rare is not. Preserve that.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The ten-sale floor, exported so a builder cannot quietly pick its own. */
export const MIN_SALES = 10;

// Same folding sync-pricecharting.mjs uses, for the same reason: accents have
// to go before the strip or "Pokémon GO" and "Pokemon GO" never meet.
const pcNorm = (x) =>
  String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pcNum = (x) => String(x ?? "").replace(/^0+(?=\d)/, "");
const gnum = (v) => (typeof v === "number" ? v : typeof v?.price === "number" ? v.price : null);

/**
 * Load both graded stores once and return the resolvers over them.
 *
 * Shaped like shared/price-basis.mjs: the module reads its own files off ROOT
 * rather than making five builders each remember which two they need and which
 * of them is optional. Both are optional and both fail soft, because a missing
 * graded store must render a dash and never stop a build.
 */
export async function loadGradedPrices() {
  let psa10 = {};
  try {
    psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8")) || {};
  } catch {
    /* optional: every lookup falls through to null and the pages print dashes */
  }
  let pc = { cards: {} };
  try {
    pc = JSON.parse(await readFile(join(ROOT, "data/graded.json"), "utf8"));
  } catch {
    /* no graded sample yet; the chain skips tier 2 */
  }

  const pcByName = new Map();
  for (const rec of Object.values(pc.cards || {})) {
    const k = pcNorm(rec.name);
    if (!pcByName.has(k)) pcByName.set(k, []);
    pcByName.get(k).push(rec);
  }

  /**
   * The PriceCharting record for one printing, or null.
   *
   * See the long note at the top of this file: the number is verified out of
   * `matched` and a disagreement is dropped rather than printed.
   */
  function pricecharting(name, setName, number) {
    for (const rec of pcByName.get(pcNorm(name)) || []) {
      if (typeof rec.psa10 !== "number") continue;
      if (!setsAgree(rec.set, setName)) continue;
      const got = /#\s*(\d+)/.exec(rec.matched || "");
      if (!got || pcNum(got[1]) !== pcNum(number)) continue;
      return rec;
    }
    return null;
  }

  /**
   * Do PriceCharting's set and ours name the same set?
   *
   * Normally a substring test, which is what this has always been. The one
   * exception is promos, and it cost five cards a graded price they already had
   * on file.
   *
   * PRICECHARTING FILES EVERY ENGLISH PROMO IN ONE CONSOLE, "Pokemon Promo".
   * We file them by the set actually printed on the card: "MEP Black Star
   * Promos", "SVP Black Star Promos". Neither string contains the other, so no
   * promo could ever join and the hall printed "No PSA 10 price for this
   * printing" over $39.50, $40, $57.13, $72.50 and $95 sitting in
   * data/graded.json. The two hand-kept promos escaped only because someone had
   * typed their figures into data/hits.json by hand years' worth of comments ago.
   *
   * WHAT MAKES THIS SAFE IS THE NUMBER CHECK ABOVE, NOT THIS FUNCTION. A promo
   * still has to agree on the card NAME and on the collector number PriceCharting
   * actually landed on, and that pair is unique: checked across all 12 promo
   * records and all 13 promo hits on the site, every match is one-to-one and
   * every non-match is a card PriceCharting holds no record for at all. The
   * loosening is only ever applied where OUR set name says "black star promos",
   * so a set card can never fall through it.
   *
   * See shared/first-partner.mjs for the case this must NOT be used to solve:
   * a bare "Rowlet" with no number is a different question, and that join is
   * keyed on the product for exactly this reason.
   */
  function setsAgree(pcSet, setName) {
    if (pcNorm(pcSet).includes(pcNorm(setName))) return true;
    return pcNorm(pcSet) === "pokemonpromo" && /black\s*star\s*promos?$/i.test(String(setName || ""));
  }

  /**
   * The records for the right card in the right set whose PRINTING disagrees.
   *
   * A dropped match must be VISIBLE. build-hall.mjs prints one line per record
   * this returns, so a run that starts dropping more of them reads as a run
   * that dropped more of them, rather than as a source that quietly went empty.
   * That reporting is the only thing standing between the number check above
   * and a column of silent dashes.
   */
  function nearMisses(name, setName) {
    return (pcByName.get(pcNorm(name)) || []).filter((r) => setsAgree(r.set, setName));
  }

  // THE KEY IS TRIED LITERALLY FIRST AND ZERO-STRIPPED SECOND, which is a
  // superset of the two shapes the five copies of this helper used between
  // them and changes no existing answer. It matters on exactly one row today:
  // data/psa10.json is keyed `perfect-order-094` and sets.json spells that
  // chase card's number "094", so the literal form is the one that hits and a
  // stripped-only lookup (build-pages.mjs's psaFor did this) missed it.
  const at = (store, setId, number) =>
    store?.[`${setId}-${number}`] ?? store?.[`${setId}-${pcNum(number)}`];

  /**
   * Everything the site knows about one card's PSA 10 price, or null.
   *
   * `name` and `setName` are required for tier 2 and are OPTIONAL only in the
   * sense that leaving them out silently skips PriceCharting: the join is on
   * the card's name and its set's name, because data/graded.json is keyed by
   * what the spreadsheet wrote rather than by a set id it does not carry.
   *
   * Returns { price, from, source, asOf, url, sales }. `sales` is non-null ONLY
   * where the tracker supplied the figure, because it is the only feed that
   * publishes a sale count and a "182 sales" note under a PriceCharting number
   * would be describing a different measurement.
   *
   * THE WINNER IS NAMED, NOT INFERRED. build-hall.mjs learned this the hard
   * way: working out afterwards who had answered, from `manual || auto`,
   * credited pokemonpricetracker.com whenever an `auto` row merely EXISTED,
   * including when the ten-sale floor had just thrown it away. The source is
   * recorded by whoever supplies the figure, in the same expression.
   */
  function resolve(setId, number, { name = null, setName = null } = {}) {
    const manualRec = at(psa10.prices, setId, number) ?? at(psa10, setId, number);
    const manual = gnum(manualRec);
    if (manual) {
      return {
        price: manual,
        from: "manual",
        // A hand-entered price is the owner's own figure and carries no feed name,
        // which is the call build-hall.mjs, build-proto.mjs and
        // build-wanted.mjs all already make.
        source: manualRec?.source || null,
        asOf: manualRec?.asOf || null,
        url: null,
        sales: null,
      };
    }

    const hit = name && setName ? pricecharting(name, setName, number) : null;
    if (hit) {
      return {
        price: hit.psa10,
        from: "pricecharting",
        source: pc.source || "pricecharting.com",
        // THE FILE'S DATE, NOT THE CARD'S. data/graded.json is a snapshot taken
        // by one hand-run crawl and stamps the whole file, which is why it says
        // so at the top level rather than per record.
        asOf: pc.checked || null,
        url: hit.url || null,
        sales: null,
      };
    }

    const a = at(psa10.auto, setId, number);
    if (!a?.psa10) return null;
    if (a.psa10Sales != null && a.psa10Sales < MIN_SALES) return null;
    return {
      price: a.psa10,
      from: "tracker",
      source: a.source || null,
      asOf: a.asOf || null,
      url: null,
      sales: a.psa10Sales ?? null,
    };
  }

  /** Just the figure, for the callers that only print one. */
  const price = (setId, number, opts) => resolve(setId, number, opts)?.price ?? null;

  /** Who said so and when, for the sourcing lines under a grid. */
  const stamp = (setId, number, opts) => {
    const r = resolve(setId, number, opts);
    return { asOf: r?.asOf || null, source: r?.source || null, url: r?.url || null };
  };

  return { psa10, pc, pricecharting, nearMisses, resolve, price, stamp };
}
