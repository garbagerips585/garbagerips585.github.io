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

/* WHICH PRINTING A CHECKLIST FIGURE IS FOR, added 14 October 2026.
 *
 * A checklist row carries ONE price per collector number, and where the number
 * is printed more than once sync-pricecharting-cards.mjs takes the DEAREST
 * printing and names it in `variant`. Bidoof, Pokemon GO #059, is "Reverse
 * Holo": `price` 1.72 and `psa10` 1150 are the Reverse Holo's, `all.Base` is
 * 1.15. The /pokemon/ pages say so ("the figure is the priciest of them").
 * /hall.html and /luck.html did not, and turned that $1,150 into "the best
 * graded card" the channel has pulled, while the rip log row says Common with
 * no printing named and its own raw figure is $0.57.
 *
 * So a LOGGED PULL only takes a checklist figure whose printing it can stand
 * behind: a standard printing (Base, Holo, none named), or the printing the
 * row itself names in `variant`. Anything else is a different printing of the
 * right card, which is the case the load-bearing number check above exists
 * for, and the answer is the same: drop it rather than print it. */
const canonPrinting = (v) => String(v || "").toLowerCase().replace(/[^a-z]/g, "").replace(/holo$/, "");
const STANDARD_PRINTINGS = new Set(["", "base", "normal", "unlimited"]);
/** True when a checklist figure is for a printing the logged row did not name. */
export function offPrinting(cardVariant, rowVariant = null) {
  const v = canonPrinting(cardVariant);
  if (STANDARD_PRINTINGS.has(v)) return false;
  return canonPrinting(rowVariant) !== v;
}
/**
 * The raw figure a checklist row can honestly put behind a logged pull: its own
 * `price` where that is the row's printing, otherwise the standard printing's
 * figure out of `all`, otherwise null.
 */
export function rawForPull(card, hit = null) {
  if (!card || typeof card.price !== "number") return null;
  if (!offPrinting(card.variant, hit?.variant)) return card.price;
  const base = card.all?.Base ?? card.all?.Normal ?? card.all?.Holo;
  return typeof base === "number" ? base : null;
}

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

  /* THE SAME PRICECHARTING READ THE CHECKLISTS ALREADY CARRY, 25 August 2026.
   *
   * data/graded.json holds 153 hand-verified rows. The per-set checklists under
   * public/data/cards/ hold a PriceCharting psa10 for 5,128 of 5,181 cards, out
   * of the same crawl, and every builder that reads THOSE has been answering
   * differently from every builder that reads this module. /grading.html builds
   * its own map off the checklists; the set guides, /hall.html and /index.html
   * come through here and fell past graded.json's 153 rows straight to the
   * tracker.
   *
   * SO THE SAME CARD WAS PUBLISHED TWICE AT TWO PRICES. Maushold, Paldea
   * Evolved #226: $1,452.50 on /grading.html and $709 on the set guide, both
   * dated, both sourced, on a site whose rule is that every price says where it
   * came from. Every one of the 20 cards that appears on both pages disagreed
   * with itself.
   *
   * IT GOES BEHIND graded.json, NOT IN FRONT. That file is hand-verified and
   * drops a row whose `matched` number disagrees, so it is the better answer
   * where it has one; this only fills the fall-through. No figure graded.json
   * supplies changes.
   *
   * THE JOIN IS SAFER THAN THE ONE ABOVE IT. These are our own checklists,
   * keyed by set id and card number, so there is no name matching to get wrong
   * -- which is the failure mode the long note at the top of this file exists
   * to guard against.
   *
   * THE DATE IS THE PRICE CRAWL'S, NOT THE FILE'S. Each checklist carries
   * `checked` for its card data and `pricesChecked` for the money, and they are
   * different days. Stamping a price with the card-data date would credit a
   * reading that never happened. */
  const pcCards = {};
  let pcCardsSource = null;
  try {
    const { readdir } = await import("node:fs/promises");
    const dir = join(ROOT, "public/data/cards");
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
      if (!doc?.set || !Array.isArray(doc.cards)) continue;
      pcCardsSource = pcCardsSource || doc.priceSource || "pricecharting.com";
      for (const c of doc.cards) {
        if (typeof c?.psa10 !== "number" || !c.psa10) continue;
        const rec = {
          psa10: c.psa10,
          // Which printing the figure is for; see offPrinting() above.
          variant: c.variant || null,
          url: c.pcUrl || null,
          source: doc.priceSource || "pricecharting.com",
          asOf: doc.pricesChecked || null,
        };
        // Both spellings, for the same reason `at` above looks up both: one
        // checklist numbers a chase card "094" and another store says "94".
        pcCards[`${doc.set}-${c.n}`] = rec;
        pcCards[`${doc.set}-${pcNum(c.n)}`] ??= rec;
      }
    }
  } catch {
    /* no checklists on disk; the chain simply skips this tier */
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
  // `logged: true` is a pricing of a pull out of data/hits.json, and then a
  // checklist figure for a printing the row did not name is refused (see
  // offPrinting() at the top of this file). `variant` is the row's own printing.
  function resolve(setId, number, { name = null, setName = null, logged = false, variant = null } = {}) {
    const pccFits = (rec) => rec && !(logged && offPrinting(rec.variant, variant));
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
    /* THE NEWER OF THE TWO PRICECHARTING READS WINS, 23 September 2026. Tier 2
       is data/graded.json, one hand-run crawl stamped August 23; tier 3 is the
       nightly checklist read of the SAME product pages. Tier 2 always won, so
       104 of the Hall's 151 PSA 10s were a month old while tonight's figure sat
       one tier down (Mienshao $155 against $305, Rampardos ex $37.41 against
       $14). Same source, so the fresher read is simply the better one; tier 2
       still answers wherever the nightly has no row, which is every promo. */
    const pccEarly = at(pcCards, setId, number);
    if (hit && pccFits(pccEarly) && typeof pccEarly.psa10 === "number" && pccEarly.asOf && pc.checked && pccEarly.asOf > pc.checked) {
      return { price: pccEarly.psa10, from: "pricecharting", source: pccEarly.source, asOf: pccEarly.asOf, url: pccEarly.url, sales: null };
    }
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

    // TIER 3: the same PriceCharting figure /grading.html has always used.
    const pcc = at(pcCards, setId, number);
    if (pccFits(pcc)) {
      return {
        price: pcc.psa10,
        from: "pricecharting",
        source: pcc.source,
        asOf: pcc.asOf,
        url: pcc.url,
        // Null for the same reason tier 2 is null: PriceCharting publishes no
        // sale count, and a "279 sales" note under its number would be
        // describing the other feed's measurement.
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

  /**
   * PriceCharting's UNGRADED figure for one printing out of data/graded.json,
   * or null. Same join as `pricecharting()` above, number check and all; it
   * only reads the other column.
   */
  function ungraded(name, setName, number) {
    if (!name || !setName || number == null) return null;
    for (const rec of pcByName.get(pcNorm(name)) || []) {
      if (typeof rec.ungraded !== "number") continue;
      if (!setsAgree(rec.set, setName)) continue;
      const got = /#\s*(\d+)/.exec(rec.matched || "");
      if (!got || pcNum(got[1]) !== pcNum(number)) continue;
      return { price: rec.ungraded, source: pc.source || "pricecharting.com", asOf: pc.checked || null, url: rec.url || null };
    }
    return null;
  }

  /**
   * THE RAW FIGURE FOR A PROMO HIT, ONE CHAIN FOR ALL THREE RENDERERS. Added
   * 14 October 2026.
   *
   * A promo has no checklist, so its raw price used to be the figure typed onto
   * its data/hits.json row, and each of build-pages.mjs, build-hall.mjs and
   * build-luck.mjs read that first. The Costco Mega Charizard X ex MEP 023 row
   * says $38.75 and $176.57, read 13 August; data/graded.json read the SAME
   * PriceCharting page on 13 October at $30.18 and $139.99. The rip page and
   * the hall took the fresh PSA 10 and the stale raw, /luck.html took both
   * stale, so one card printed $140 on two pages and $177 on a third.
   *
   * SO THE FRESHER READ WINS, and the hand figure is the fallback rather than
   * the override. That is the order CLAUDE.md gives for every price on the site
   * ("a frozen number should lose to a fresh one and win against nothing"). The
   * hand figure still wins where it is the NEWER read of the two, or where
   * graded.json holds no row for the printing at all. A hand figure with no
   * date loses to a dated one.
   *
   * Returns { price, source, asOf, url, from } with `from` either
   * "pricecharting" (graded.json) or "log" (the hit row), or null.
   */
  function rawForHit(h, { name = null, setName = null, number = null } = {}) {
    const fresh = ungraded(name || h?.card, setName || h?.setName, number ?? h?.number);
    const hand = typeof h?.price === "number"
      ? { price: h.price, source: h.priceSource || null, asOf: h.priceAsOf || null, url: h.priceUrl || null, from: "log" }
      : null;
    if (fresh && (!hand || !hand.asOf || (fresh.asOf && fresh.asOf >= hand.asOf))) return { ...fresh, from: "pricecharting" };
    return hand;
  }

  /** Just the figure, for the callers that only print one. */
  const price = (setId, number, opts) => resolve(setId, number, opts)?.price ?? null;

  /** Who said so and when, for the sourcing lines under a grid. */
  const stamp = (setId, number, opts) => {
    const r = resolve(setId, number, opts);
    return { asOf: r?.asOf || null, source: r?.source || null, url: r?.url || null };
  };

  return { psa10, pc, pricecharting, nearMisses, resolve, price, stamp, ungraded, rawForHit };
}
