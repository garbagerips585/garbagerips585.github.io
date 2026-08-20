#!/usr/bin/env node
// Build public/hall.html, the Card Hall of Fame: the cards actually pulled on
// camera, ranked by what they are worth.
//
//   node scripts/build-hall.mjs
//
// Prices are NOT stored in data/hall.json. They are looked up here from
// public/data/sets.json, data/psa10.json and data/graded.json, so a price
// refresh moves this page without anyone re-importing the spreadsheet, and one
// card can never show two different numbers on two different pages.
//
// Ranked by PSA 10 where there is one, and by raw near mint otherwise, because
// a graded price is the better measure of what a card is worth and most cards
// have no graded price at all.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { esc, shortDate, moneyCompact, noValue, rarityLabel, imgDims, cardNumKey, avifPicture } from "../shared/format.mjs";
import { loadGradedPrices, MIN_SALES } from "../shared/graded-price.mjs";
import { loadFirstPartner } from "../shared/first-partner.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The floor is imported rather than retyped: a gate applied on one page and not
// another is how this whole class of bug starts. See shared/graded-price.mjs.

const hallDoc = JSON.parse(await readFile(join(ROOT, "data/hall.json"), "utf8"));
let hall = hallDoc.cards;

/* --------------------------------------------------------- what it looks like
 *
 * THE ONE THING THIS PAGE COULD NOT SAY. A plaque gives a name, a set, a
 * number, a rarity and two prices, and every one of those is a LABEL. None of
 * them is the picture, and the picture is the entire reason a channel about
 * opening packs exists: these are illustration rares, so the art IS the value.
 * A reader who has never seen the card, and a reader who cannot see it at all,
 * both got the same nothing.
 *
 * VISIBLE COPY, NOT ALT TEXT, and that is deliberate. A caption under the
 * identity line helps somebody browsing, somebody searching and somebody
 * listening, all at once, and it cannot rot silently the way an alt attribute
 * can because anybody looking at the page can see it is wrong.
 *
 * THE SENTENCES LIVE IN data/hall.json, keyed <set-id>-<number>, so they
 * survive a rebuild and can be edited without touching this file. Each one was
 * written by opening that card's own scan and looking at it. See the readme
 * there before adding one.
 *
 * THE NAME IS CHECKED, AND THAT IS THE POINT. hall.json stores the card's name
 * beside the sentence. A hall card is resolved out of data/hits.json, so its
 * number can change under this map without anybody noticing, and a description
 * silently moved onto the wrong card is worse than no description at all. When
 * the names disagree the caption is dropped: absent beats wrong, which is the
 * standing pattern on every other field here.
 */
const artNotes = hallDoc.art || {};
const artNorm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function artLook(c) {
  // A promo carries no set id (see the `!h.set` branch below), so it is keyed
  // by the MEP Black Star Promos set the rip log resolves it against.
  const rec = artNotes[`${c.set || "mep"}-${c.number}`];
  if (!rec || artNorm(rec.name) !== artNorm(c.name)) return null;
  return rec.look || null;
}

// FALL BACK TO WHAT WAS ACTUALLY PULLED.
//
// This page waited on a "Card Hall of Fame" tick in the spreadsheet and, until
// somebody ticked one, published "No cards inducted yet" to a nav link and to
// two separate above-the-fold promises on the home page. The site advertised a
// hall of fame twice and the hall of fame was empty, which is the worst version
// of this: not a missing page, a page that says there is nothing here.
//
// data/hits.json already records every card pulled on camera, and this page's
// own lede is "Every card worth remembering that has come out of a pack on this
// channel, ranked by what it is worth". That IS the hits list. So when nothing
// has been inducted by hand, the hall is every hit, ranked by value, and the
// page says so rather than implying a curation nobody performed.
//
// A hand-picked list still wins outright the moment one exists, which keeps the
// tick meaningful: it becomes "promote the best" rather than "make the page
// work at all".
let derivedFromHits = false;
let hitsLedger = null;
const firstPartner = await loadFirstPartner();
if (!hall.length) {
  const hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
  const seen = new Set();
  const out = [];
  // EVERY DROP IS LEDGERED AND EVERY LEDGER IS PRINTED AT THE END OF A RUN.
  // Four things could take a row off this page and three of them did it in
  // silence, on the one page that promises in its lede to be the whole list.
  // A page that quietly stops being complete is worse than one that never
  // claimed to be, and the only thing standing between the two is this run
  // saying what it did with all 93 rows.
  const unmatched = [];
  const unlisted = [];
  const intlIn = [];
  const ambiguous = [];
  let rowsRead = 0;
  // The other checklist. /sets/ja-*.html, /sets/ko-*.html and /sets/zh-*.html
  // are all built out of this file; nothing but the English 28 lives under
  // public/data/cards.
  let intlGuides = {};
  try {
    intlGuides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
  } catch { /* optional: the intl rows fall through to the sheet's own words */ }
  // `Object.entries`, NOT `Object.values`, AND THAT ONE WORD IS THE WHOLE
  // "see it pulled" LINK. data/hits.json is keyed BY YOUTUBE VIDEO ID, so every
  // card in this hall already knew which rip it came out of and this loop threw
  // the key away on the first line. The page then carried one link to the whole
  // rip library and none to the video the card is actually in, on the most
  // shareable page on the site: every plaque here is a card that came out of a
  // specific opening, which is the single most relevant reason to watch one.
  // Checked before it was built: 18 of 18 hit entries and 3 of 3 video ids
  // resolve against public/data/videos.json, so the join is total.
  for (const [vid, list] of Object.entries(hits)) {
    for (const h of list) {
      rowsRead++;
      // A PROMO HAS NO SET CHECKLIST, AND THAT IS NOT A REASON TO DROP IT.
      // This used to skip anything without a set, on the reasoning that it
      // could not be priced or pictured. But the rip log carries the price and
      // the PSA 10 for these directly, and the two it was skipping are the two
      // most valuable cards on the whole site: a Mega Charizard X ex at $176.57
      // in a 10 and an Oricorio ex at $99.78, both MEP Black Star Promos out of
      // the Costco UPC. They would rank second and third. The page meanwhile
      // says "this is the whole list of what was pulled on camera", so it was
      // claiming completeness while hiding the top of its own ranking.
      if (!h.set) {
        // THE FIRST PARTNER PROMOS BELONG HERE AND THE GATE BELOW WAS KEEPING
        // THEM OUT, WHICH IS A JUDGEMENT AND IS ARGUED RATHER THAN MADE
        // QUIETLY. Three of them, Rowlet MEP 043, Litten MEP 044 and Popplio
        // MEP 045, were pulled on camera twice, on M7NqqhR8V4M and
        // xNGxOuMpSiw. They carry no set and no price on the hit row, so the
        // gate below dropped all six rows.
        //
        // THE CASE FOR LETTING THEM IN IS THIS PAGE'S OWN LEDE. It says "Every
        // card that has come out of a pack on this channel" and "Nothing here
        // was hand picked: this is the whole list of what was pulled on
        // camera". These came out of a pack on this channel. Worse than the
        // omission is WHICH cards were omitted: this site publishes a raw price
        // AND a PSA 10 for all three on
        // /first-partner-illustration-collection.html, read twice through two
        // parsers and stamped, so the hall was leaving out cards it prices
        // elsewhere while claiming to be the whole list. That is the same
        // failure the comment above records about the two Costco promos.
        //
        // THE CASE AGAINST, stated because it is not silly: a promo out of an
        // illustration collection is not "pulled from a booster pack" in the
        // sense the page's artwork implies, and Rowlet's $64.99 in a 10 puts it
        // inside the top fifteen of 74 on a ranking most readers will read as a
        // ranking of pack pulls. It loses to the lede. The page says "out of a
        // pack", these came out of a sealed product bought for the cards in it,
        // and a ranking that quietly drops the entries it finds unrepresentative
        // is exactly the hand-picking the lede promises it is not doing.
        //
        // The prices come from data/first-partner.json through
        // shared/first-partner.mjs, which enforces that file's own rule about
        // publishing nothing whose two reads disagreed. See that module for why
        // the join is on `printing` rather than on the card name.
        const fp = firstPartner.priceForHit(h);
        if (typeof h.price !== "number" && typeof h.psa10 !== "number"
            && !(fp && (fp.price != null || fp.psa10 != null))) continue;
        // DEDUPE, BECAUSE A PROMO CAN BE PULLED TWICE AND THREE OF THEM WERE.
        // The set branch below has always deduped on `<set>-<number>` and this
        // branch had nothing, which cost nothing while the only two rows here
        // came from one video. Six First Partner rows for three cards would
        // have put each of them on the page twice, on a page whose count is
        // printed in its own headline stat. First occurrence wins, same as
        // below, so the plaque links the first rip the card came out of.
        const pkey = `promo-${String(h.card).toLowerCase()}-${h.number || fp?.number || ""}`;
        if (seen.has(pkey)) continue;
        seen.add(pkey);
        // `_img` WAS HARDCODED null AND THE SCANS EXISTED THE WHOLE TIME.
        // data/hits.json carries an `img` on both promos, pointing at TCGdex's
        // MEP set, and both resolve: mep/023 and mep/024 answer 200 at low,
        // high and .avif (checked 16 August 2026, 31.6KB and 40.9KB at low).
        // Neither is in data/no-scan.json. So the two most valuable cards on
        // the site rendered as a grey `chof-noart` box with their own name in
        // it, on the page whose entire job is showing the cards, while the
        // scan sat one string concatenation away. Same `/high.webp` shape the
        // set-card branch below uses, so plaqueArt() gives these the 245w
        // thumbnail and the 600w enlargement exactly like every other card.
        out.push({
          set: null, number: h.number || fp?.number || null, name: h.card,
          _vid: vid,
          _img: h.img ? `${h.img}/high.webp` : fp?.imgLarge || null,
          _raw: typeof h.price === "number" ? h.price : fp?.price ?? null,
          _rarity: h.rarity || "Black Star Promo",
          _psa10: typeof h.psa10 === "number" ? h.psa10 : fp?.psa10 ?? null,
          // The rip log stores ONE source, date and url per promo entry and
          // both its numbers came off that one page, so the PSA 10 stamp reads
          // from the same three fields the raw price does.
          _psa10AsOf: h.priceAsOf || fp?.asOf || null,
          _psa10Source: h.priceSource || fp?.source || null,
          _psa10Url: h.priceUrl || fp?.url || null,
          _setName: h.setName || fp?.setName || "Black Star Promo",
        });
        continue;
      }
      // THE CHECKLIST, AND FOR THREE ROWS IT USED TO BE A SILENT `continue`.
      //
      // `catch { continue; }` on a missing public/data/cards/<id>.json meant
      // EVERY Japanese, Korean and Chinese hit was structurally excluded from
      // this page, because that directory holds the 28 English sets and nothing
      // else. It is not a data gap and it never was: it is a builder that could
      // only read one of the two checklist files this repo ships. Three rows,
      // Incineroar ex out of Cyber Judge and Goldeen and Manectric out of Abyss
      // Eye, on a page whose lede says "this is the whole list of what was
      // pulled on camera" and says it twice.
      //
      // public/data/intl-guides.json IS the other checklist and /sets/ja-*.html
      // has been rendering out of it for weeks. It carries localId, the English
      // name and the rarity for the sets TCGdex holds card records for, and NO
      // image and NO price for any of them, which is a real limit and not one
      // this page has to hide: a plaque with a name, a set and a rarity is the
      // truth about that card, and the site's standing pattern everywhere else
      // is that absent data renders as absent.
      let cards = null;
      let source = "checklist";
      try {
        cards = JSON.parse(await readFile(join(ROOT, `public/data/cards/${h.set}.json`), "utf8")).cards;
      } catch {
        const g = intlGuides[h.set];
        // `hasCards` is false and `cards` is empty for the Korean and Chinese
        // guides and for Cyber Judge, because TCGdex publishes a card COUNT for
        // those sets and zero card records. An empty list is not a checklist,
        // so it falls through to the last resort below rather than being
        // searched and missed.
        if (g?.cards?.length) {
          source = "intl";
          cards = g.cards.map((c) => ({
            n: c.localId,
            // THE ENGLISH NAME, because that is what the rip log writes and
            // what an English-speaking reader is looking at. data/intl-rips
            // .json's own readme settles this for the guides: "ENGLISH NAMES
            // LEAD ... The native name is still the verifiable one, so it is
            // always shown, never dropped." A plaque has one name slot, so it
            // gets the one the sheet can be joined on.
            name: c.en || c.native,
            rarity: c.rarity || null,
            img: null,
            price: null,
          }));
        }
      }
      const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
      // NO CHECKLIST IN EITHER FILE IS A DIFFERENT CASE FROM A CARD THAT IS NOT
      // ON ONE, and they used to share a `continue`. Where the site holds no
      // list for the set at all there is nothing to fail to match against, so
      // the row goes in on what the sheet itself says: the card, the set it
      // names and the rarity. That is Incineroar ex, Cyber Judge, Super Rare.
      // No number, no scan and no price, all of which render as absent.
      if (!cards?.length) {
        const key = `${h.set}-${norm(h.card)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unlisted.push({ set: h.set, setName: h.setName || h.set, card: h.card });
        out.push({
          set: h.set, number: null, name: h.card,
          _vid: vid,
          _img: null,
          _raw: null,
          _rarity: h.rarity || null,
          _setName: h.setName || null,
        });
        continue;
      }
      const same = cards.filter((c) => norm(c.name) === norm(h.card));
      // Where the sheet named a rarity, take the printing that matches: that is
      // the one actually pulled. Same rule build-pages.mjs uses for rip pages,
      // so a card cannot show one number here and another there.
      const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
      let m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0];
      // THE RARITY MATCH DOES NOT SURVIVE THE TRIP TO A JAPANESE SET, AND THE
      // FALLBACK IS WORSE THAN NO ANSWER THERE. `same[0]` is a safe last resort
      // on an English checklist because the sheet and TCGdex share a
      // vocabulary. They do not across languages: the rip log writes Goldeen's
      // tier as "Art Rare", which is the letter code アートレア printed on the
      // Japanese wrapper, and TCGdex's English field for the same card says
      // "Illustration rare". Abyss Eye lists Goldeen TWICE, #012 Common and
      // #084 Illustration rare, so the prefix test missed and `same[0]` handed
      // the plaque the COMMON. A bulk Goldeen with an Art Rare's name on it is
      // the same class of error the graded join two hundred lines below drops a
      // price rather than commit.
      //
      // MAPPING AR ONTO ILLUSTRATION RARE WOULD FIX IT AND IS REFUSED.
      // shared/rarity.mjs keeps the seven Japanese letter tiers deliberately
      // SEPARATE from the English ladder and says why in as many words: "SAR
      // and Special Illustration Rare are close cousins, not the same thing,
      // and asserting an equivalence the two companies do not publish would be
      // this site inventing a fact." That rule does not get bent to win a
      // collector number.
      //
      // So an intl row takes a printing ONLY where the name is unique in the
      // set and nothing contradicts it. Otherwise it falls through to the
      // branch below and goes in on the sheet's own words, with no number,
      // which asserts nothing about which of the two printings came out.
      if (source === "intl" && !(same.length === 1 && (!want || norm(same[0].rarity).includes(want)))) {
        m = null;
        ambiguous.push({ set: h.set, card: h.card, rarity: h.rarity || null, printings: same.length });
      }
      // A NAME THAT IS NOT ON A CHECKLIST WE HOLD IS A DATA ERROR AND IS SAID
      // OUT LOUD. This is the one drop that is NOT fixed above, on purpose. We
      // have the set's full checklist and the card is not on it, so publishing
      // the row anyway would print a card name no catalogue holds, which is the
      // exact mistake data/hits.json's own readme records the old importer
      // making. Today it fires once: the sheet says "Iono's Bellibolt" and
      // Ascended Heroes lists "Iono's Bellibolt ex". The fix is in the
      // spreadsheet, not here, because import-sheet.mjs rebuilds this file per
      // video and would overwrite an edit made to it by hand.
      if (!m) {
        // An ENGLISH checklist we hold and a name that is not on it is a data
        // error and is dropped; see above. An INTL row that could not be
        // pinned to one printing is not an error about the card, it is the
        // limit of what two vocabularies can be joined on, so it goes in
        // unpinned exactly like a set with no checklist at all.
        if (source !== "intl") {
          unmatched.push({ set: h.set, card: h.card, rarity: h.rarity || null, source });
          continue;
        }
        const ikey = `${h.set}-${norm(h.card)}`;
        if (seen.has(ikey)) continue;
        seen.add(ikey);
        out.push({
          set: h.set, number: null, name: h.card,
          _vid: vid,
          _img: null,
          _raw: null,
          _rarity: h.rarity || null,
          _setName: h.setName || null,
        });
        continue;
      }
      const key = `${h.set}-${m.n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (source === "intl") intlIn.push({ set: h.set, card: m.name, n: m.n });
      // Carry the card's OWN art, price and rarity from the checklist. resolve()
      // below only knows how to look a card up in the set's `chase` list, which
      // is the dozen or so cards a set page features, and 15 of 15 hits were not
      // in it: the page rendered with no images and no prices at all.
      out.push({
        set: h.set, number: m.n, name: m.name,
        _vid: vid,
        _img: m.img ? `${m.img}/high.webp` : null,
        _raw: typeof m.price === "number" ? m.price : null,
        _rarity: m.rarity || h.rarity || null,
        // The intl checklist carries no set name of its own that this page can
        // use, and sets.json is English only, so resolve() would otherwise
        // print the slug. The sheet's own words are the right label: "Abyss Eye
        // (JP)" says both which set and which printing.
        _setName: source === "intl" ? h.setName || null : null,
      });
    }
  }
  if (out.length) {
    hall = out;
    derivedFromHits = true;
  }
  hitsLedger = { rowsRead, inducted: out.length, unmatched, unlisted, intlIn, ambiguous };
}
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

/* --------------------------------------------------------- the rip behind it
 *
 * THE PLAQUE'S OWN VIDEO, which this page did not link and had the id for all
 * along. See the `Object.entries` note above for how it was thrown away.
 *
 * ONE LOOKUP, NO MATCHING. `_vid` is a YouTube id and videos.json is keyed by
 * the same id, so there is no title fuzz to get wrong here and no chance of
 * putting the wrong video under a card. A card with no id, which is any card a
 * human inducts by hand in data/hall.json, resolves to null and RENDERS
 * NOTHING: the standing pattern everywhere on this site for data we do not
 * have. Do not fall back to /videos.html per plaque. The page already carries
 * one link to the whole library at the foot, and a row-level control that goes
 * somewhere generic teaches a reader the control is not worth tapping.
 */
const ripById = new Map(
  (JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8")).videos || [])
    .map((v) => [v.id, v]),
);

// BOTH GRADED STORES COME OUT OF ONE MODULE NOW, AND THAT IS THE POINT OF THE
// MODULE. `graded` is data/psa10.json, `pc` is data/graded.json, and this file
// used to open both by hand alongside four other builders that opened one of
// them by hand. See shared/graded-price.mjs.
const { psa10: graded } = await loadGradedPrices();

const setById = new Map(sets.map((s) => [s.id, s]));

// THE PSA 10 COLUMN WAS LOOKING IN THE WRONG FILE.
//
// data/psa10.json is keyed <set-id>-<number> and is filled by sync-prices.mjs
// for CHASE cards: all 76 of its entries are secret rares in the 150s and up.
// Not one card in this hall is a chase card, so every lookup missed and the
// column rendered fifteen dashes, which is a column that says nothing at all.
//
// The file that actually holds these prices is data/graded.json, whose own
// readme says "SCOPED TO CARDS WE PULLED": sync-pricecharting.mjs runs it over
// data/hits.json, which is exactly this list. It was never wired up here. It is
// keyed by name and number the way the sheet wrote them, so it is joined on
// name, set and printing rather than on a set-id key it does not have.
//
// THE JOIN ITSELF NOW LIVES IN shared/graded-price.mjs AND THIS FILE NO LONGER
// OWNS IT. It was correct here and wrong everywhere else, which is the whole
// story: the chaser band on 53 rip pages and on /sets/chaos-rising.html printed
// pokemonpricetracker's $838 for Mega Greninja ex #122 while this page printed
// PriceCharting's $906 for the same printing. Two renderers, one card, two
// numbers, which is exactly what the header of this file says cannot happen.
// Read that module before changing anything below: the number check against
// `matched` is load bearing and its reasons are listed there.
const { pc, pricecharting, nearMisses } = await loadGradedPrices();

// TCGplayer product links, keyed by set then collector number.
//
// These used to come out of sets.json's chase array, and the note further down
// records what that was worth here: zero of fifteen hall cards carried a url,
// because a hall card is resolved out of data/hits.json and is almost never one
// of the eight cards a set page happens to feature. The chase array's urls were
// also prices.pokemontcg.io addresses, which have to be followed through a
// redirect while the page builds, on a host that has been failing.
//
// data/chase-tcg.json is link-only now and covers every card in every
// checklist, so a hall card can have a real buy link for the first time.
let chaseLinks = {};
try {
  chaseLinks = JSON.parse(await readFile(join(ROOT, "data/chase-tcg.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-chase.mjs */
}

/** Everything the site knows about one pulled card, from every source. */
function resolve(c) {
  const key = `${c.set}-${c.number}`;
  const set = setById.get(c.set);
  const chase = (set?.chase || []).find((x) => String(x.number) === String(c.number)) || null;
  // `_setName` FIRST, and the underscore is the whole bug. The promo branch
  // above carries its fields under `_img`, `_raw`, `_rarity` and `_setName`,
  // and every one of those was read back here except this one, which looked for
  // a bare `setName` that nothing writes. A promo has no set id and no entry in
  // sets.json, so all three fallbacks were empty and the page printed the
  // literal string "null" as a set name on the two most valuable cards on the
  // site. The set pages had it right off the same file the whole time.
  //
  // The last resort is "" rather than `c.set`, because `c.set` is NULL for
  // exactly the rows that reach it: a name we do not have has to render as
  // absent, never as the word for absent. `chof-set` is dropped entirely when
  // this is empty, so there is no stray bullet either.
  const setName = set?.name || c._setName || c.setName || c.set || "";

  const manual = graded.prices?.[key];
  const auto = graded.auto?.[key];
  // A PERSON STILL WINS, THEN PRICECHARTING, THEN THE PRICE SYNC. The middle two
  // swapped places on 18 August 2026 on Tim's instruction: "lets use
  // pricecharting as the main numbers for the entire site". PriceCharting is now
  // the site's source for every raw price and every graded figure, so the hall's
  // PSA 10 column has to sit in the same order as the rest of the site rather
  // than keep its own. pokemonpricetracker.com stays as a NAMED fallback rather
  // than being deleted: it covers cards PriceCharting's crawl does not resolve
  // to an exact printing, and a stamped fallback figure beats a dash.
  //
  // WHAT IT MOVED, measured on the fifteen hall cards before and after: see the
  // "PSA 10" lines this script prints at the end of a run. Mega Greninja was the
  // reported case, $838 from pokemonpricetracker against PriceCharting's $906.41
  // for the same printing.
  const pcHit = pricecharting(c.name, setName, c.number);
  // `c._psa10` LAST, AND ITS ABSENCE HERE IS THE SAME BUG AS `_setName` ABOVE:
  // the promo branch wrote a field under an underscore and nothing read it
  // back. `_raw` was read (which is why $38.75 showed) and `_psa10` was not, so
  // the two promos printed "no PSA 10 price for this printing" over a stored
  // $176.57 and $99.78. That is not a missing number, it is a number the page
  // held and would not say.
  //
  // It goes at the END of the chain on purpose. Every source above it can be
  // regenerated by a sync; this one cannot, because TCGdex carries no
  // TCGplayer pricing for promo sets, so a promo has no price in the nightly
  // feed at all and hits.json is the only copy. A frozen number should lose to
  // a fresh one and win against nothing.
  // THE WINNER IS NAMED, NOT INFERRED, and that is a correctness fix rather than
  // a tidy-up. The old chain worked out who had answered afterwards, from
  // `manual || auto`, which credited pokemonpricetracker.com whenever an `auto`
  // entry merely EXISTED, including when MIN_SALES had just thrown it away and
  // PriceCharting was the number actually on the page. Reordering the chain
  // would have made that misattribution common instead of rare, so the source is
  // now recorded by whoever supplies the figure, in the same expression.
  const manualPrice =
    typeof manual?.price === "number" ? manual.price : typeof manual === "number" ? manual : null;
  const autoPrice =
    auto?.psa10 && !(auto.psa10Sales != null && auto.psa10Sales < MIN_SALES) ? auto.psa10 : null;

  const psaChain = [
    { v: manualPrice, from: "manual" },
    { v: pcHit?.psa10 ?? null, from: "pricecharting" },
    { v: autoPrice, from: "tracker" },
    // `c._psa10` LAST, AND ITS ABSENCE HERE WAS THE SAME BUG AS `_setName` ABOVE:
    // the promo branch wrote a field under an underscore and nothing read it
    // back. `_raw` was read (which is why $38.75 showed) and `_psa10` was not, so
    // the two promos printed "no PSA 10 price for this printing" over a stored
    // $176.57 and $99.78. That is not a missing number, it is a number the page
    // held and would not say.
    //
    // It goes at the END of the chain on purpose. Every source above it can be
    // regenerated by a sync; this one cannot, because TCGdex carries no
    // TCGplayer pricing for promo sets, so a promo has no price in the nightly
    // feed at all and hits.json is the only copy. A frozen number should lose to
    // a fresh one and win against nothing.
    { v: typeof c._psa10 === "number" ? c._psa10 : null, from: "log" },
  ];
  const won = psaChain.find((x) => x.v != null) || { v: null, from: null };
  const psa10 = won.v;
  const psaFrom = won.from;

  const rip = c._vid ? ripById.get(c._vid) || null : null;

  return {
    ...c,
    setName,
    // THE HUMAN TITLE, NOT `label`. `label` is the dry shelf tag the video log
    // writes ("Phantasmal Flames UPC"); `title` is what Tim called the video
    // ("Only Garbage Rips from the Latest Costco Charizard UPC Drop"), which is
    // the thing that makes somebody want to watch it. `siteTitle` is checked
    // first only because the rest of the site checks it; nothing writes one
    // today, on 0 of 316 videos.
    rip: rip ? { path: rip.path, title: rip.siteTitle || rip.title } : null,
    // ONE CASING FOR RARITY. TCGdex ships "Ultra Rare" and "Double rare" in the
    // same checklist, so this list carried both shapes at once. Title Case is
    // what the rarity guide, the ladder in sync-sets.mjs and the sheet's own
    // rarities in data/hits.json already use.
    rarity: rarityLabel(c._rarity || c.rarity || chase?.rarity || null),
    image: c._img || chase?.imageLarge || chase?.image || null,
    url: chaseLinks[c.set]?.links?.[cardNumKey(c.number)] || null,
    // RAW FROM THE CHECKLIST FIRST, AND THE CHECKLIST IS PRICECHARTING NOW.
    // This used to carry a note saying PriceCharting's own ungraded figure was
    // deliberately unused because "every other page on the site quotes TCGdex
    // for raw". That stopped being true on 18 August 2026: sync-cards.mjs prices
    // public/data/cards/<set>.json from PriceCharting's ungraded column, so
    // `c._raw` IS a PriceCharting figure and the whole site agrees by
    // construction. `pcHit.ungraded` sits behind it for the promos, which have
    // no set file to read, and pokemonpricetracker's rawNm is the last resort.
    raw: c._raw ?? chase?.price ?? pcHit?.ungraded ?? auto?.rawNm ?? null,
    psa10,
    psa10AsOf:
      psaFrom === "manual" ? manual?.asOf || null
      : psaFrom === "pricecharting" ? pc.checked || null
      : psaFrom === "tracker" ? auto?.asOf || null
      : psaFrom === "log" ? c._psa10AsOf || null
      : null,
    // ONLY THE TRACKER PUBLISHES A SALE COUNT, so this must not be filled in
    // when the tracker did not supply the figure: a "182 sales" note under a
    // PriceCharting number would be describing a different measurement.
    psa10Sales: psaFrom === "tracker" ? auto?.psa10Sales ?? null : null,
    psa10Source:
      psaFrom === "manual" ? "Tim"
      : psaFrom === "pricecharting" ? pc.source || "pricecharting.com"
      : psaFrom === "tracker" ? auto?.source || "pokemonpricetracker.com"
      : psaFrom === "log" ? c._psa10Source || "pricecharting.com"
      : null,
    psa10Url:
      psaFrom === "pricecharting" ? pcHit?.url || null
      : psaFrom === "log" ? c._psa10Url || null
      : null,
  };
}

const ranked = hall
  .map(resolve)
  // TWO SORT KEYS, AND THE PAGE HAS TO SAY SO. A card with a graded price is
  // ranked by it; a card without is ranked by its raw price. That is the right
  // order, and it looks broken to a stranger, because the RAW price is the
  // first and largest number on every plaque and the raw column is not sorted:
  // measured on the built page it runs 175, 14.72, 38.75, 5.99. Twelve of the
  // 49 have a PSA 10 and are strictly descending on it; the other 37 are
  // strictly descending on raw underneath them.
  //
  // The lede used to say "ranked by what it is worth" and "in value order",
  // which names neither key. It now states the rule, because the alternative
  // fixes are worse: sorting on raw alone would put a $175 card above a $906
  // one, and hiding the raw price would drop the only figure most of these
  // cards have.
  .sort((a, b) => (b.psa10 || b.raw || 0) - (a.psa10 || a.raw || 0));

// A SUM, and the label has to say so. This was printed as "Best known value",
// which reads as the best single card, next to a table whose priciest card is
// $15.30. Every figure on the page contradicted the headline stat, and read
// correctly it was announcing the channel's entire on-camera haul as one
// number without saying that is what it was.
//
// EACH TILE IS ONE MEASURE OVER A STATED SET OF CARDS. This used to be
// psa10-or-raw per card summed into a single "all of them together", which was
// safe only while no card had a PSA 10 price at all. The moment the graded
// lookup below started resolving, that tile would have jumped roughly tenfold
// and claimed a pile of raw cards is worth its graded value. Nothing here is
// graded. So: raw is summed over every card, PSA 10 is summed only over the
// cards that have one, and the label names the subset.
const rawCards = ranked.filter((c) => c.raw);
const totalRaw = rawCards.reduce((n, c) => n + c.raw, 0);
const gradedCards = ranked.filter((c) => c.psa10);
const totalGraded = gradedCards.reduce((n, c) => n + c.psa10, 0);

// SAY WHERE THE PSA 10 FIGURES CAME FROM, because all three facts about them
// are load bearing and none is guessable from the table: a different source
// from the raw prices, read on a different day, and a sold price for a slab
// that nobody in this list actually owns.
const psaSources = [...new Set(gradedCards.map((c) => c.psa10Source).filter(Boolean))];
const psaAsOf = gradedCards.map((c) => c.psa10AsOf).filter(Boolean).sort().pop();
const psaNote = gradedCards.length
  ? ` PSA 10 FROM ${psaSources.join(" AND ").toUpperCase()}${psaAsOf ? `, READ ${shortDate(psaAsOf).toUpperCase()}` : ""},` +
    ` AND ONLY WHERE IT RESOLVED TO THIS EXACT PRINTING. NONE OF THESE CARDS IS GRADED:` +
    ` IT IS WHAT THE SAME CARD SELLS FOR IN A PSA 10 SLAB.`
  : "";

/**
 * THE GRID WAS PAINTING A 600px CARD SCAN INTO A 120px BOX.
 *
 * `.chof-art` is `width:clamp(96px,26vw,120px)`, so the art is never wider than
 * 120 CSS px at any viewport: measured at 360/390/560/768/900/1100/1440/1920 it
 * is 96px on the narrowest phone and 120px everywhere from 560 up. The src was
 * TCGdex's `high.webp`, 600x825 and 100-135KB each, so hall.html transferred
 * 1,364KB of images at 1440x900 and 800KB at 390x844.
 *
 * TCGdex publishes exactly two sizes and there is no third to ask for: low is
 * 245x337 (~25KB), high is 600x825 (~130KB). 245 covers a 120px box at 2x
 * exactly, so every 1x and 2x screen now takes the 25KB file and only a 3x
 * phone reaches for the 600. Nothing is resampled: both files already exist.
 *
 * THE LIGHTBOX STILL OPENS THE HIGH ONE. `data-img` below is deliberately left
 * on c.image, because the enlargement is the one place on this page where 600px
 * is the right amount of detail.
 *
 * sizes is a flat 120px rather than the clamp: with only 245 and 600 to choose
 * between, 96px and 120px select the same file, so the extra precision would
 * buy nothing and could drift out of step with the clamp unnoticed.
 */
const TCGDEX_HIGH = /^(https:\/\/assets\.tcgdex\.net\/.+)\/high\.webp$/;
// THE OTHER FAMILY OF SCANS THIS PAGE CAN NOW SHOW, and it is on our own disk
// rather than on TCGdex. The three First Partner promos come out of
// data/first-partner.json, which stores a 420w and a 245w rendition of each
// (build-first-partner.mjs writes both). Same split as the TCGdex branch:
// the small file is the src for a 120px box, the large one is the srcset's top
// candidate and is what the lightbox enlarges.
//
// THE DIMENSIONS COME BACK WITH IT because imgDims() cannot supply them. That
// function switches on the HOST and knows the four remote card hosts; a path on
// our own origin falls through to "" and the plaque shipped with no width or
// height on it, which is a layout shift on the one page whose whole job is
// showing the cards. The numbers are the ones data/first-partner.json records
// for these files, measured when they were written.
const FP_HIGH = /^(\/assets\/first-partner\/mep-\d+)-420\.webp$/;
function plaqueArt(url) {
  const m = TCGDEX_HIGH.exec(url || "");
  if (m) {
    const low = `${m[1]}/low.webp`;
    return { src: low, extra: ` srcset="${esc(low)} 245w, ${esc(url)} 600w" sizes="120px"`, dims: "" };
  }
  const fp = FP_HIGH.exec(url || "");
  if (fp) {
    const small = `${fp[1]}.webp`;
    return {
      src: small,
      extra: ` srcset="${esc(small)} 245w, ${esc(url)} 420w" sizes="120px"`,
      dims: ` width="245" height="342"`,
    };
  }
  return { src: url, extra: "", dims: "" };
}

// ONE PLAQUE IS IN THE FIRST SCREEN AND IT DOES NOT GET loading="lazy".
// Measured over CDP at 390x844 DPR 2, reading each img's own border box at
// scroll 0: plaque one sits at y=557, inside the 844px viewport, and plaque two
// does not. `loading="lazy"` is a vertical heuristic, so an in-viewport image is
// fetched at first paint anyway; the attribute only costs it the preload
// scanner, which is the one chance the fetch had to start during the HTML parse
// rather than after layout. No byte moves onto the load path.
//
// THIS WAS 2 AND THE .chof-look CAPTION IS WHY IT IS NOT. Plaque two's image was
// at y=746 before every plaque grew a sentence saying what its card looks like;
// re-measured the same way afterwards it is at 857, genuinely below the fold, so
// eager on it would have been a preload of an image nobody has scrolled to. The
// number is measured, never assumed: re-measure it if the plaque changes shape
// again. y=557 for plaque one is unchanged, because the caption sits UNDER the
// row rather than above it.
const EAGER_PLAQUES = 1;
/*
 * .chof-look: WHERE THE ART SENTENCE SITS, AND WHY IT IS NOT IN .chof-body.
 *
 * The obvious place is under the rarity line, inside the body column. Measured
 * over CDP at 390x844 DPR 2 it is a 215px column there, which ran the longest
 * sentences to FIVE lines, grew plaque one by 105px and pushed plaque two's
 * image from y=746 to y=853, past the fold. Given the whole plaque instead it
 * is 332px and 3 lines at 390, 419px and 2 lines at 1440, and plaque one still
 * closes at y=824 inside the 844 viewport. Nothing overflows at either width:
 * checked the way the note further up demands, an element whose right edge is
 * past documentElement.clientWidth with no clipping ancestor, not scrollWidth.
 *
 * IT IS EMITTED BEFORE .chof-body AND MOVED BY order, on purpose. In the DOM it
 * follows the art button, so a screen reader hears what the picture shows
 * immediately after the picture itself rather than after the prices and the
 * link. .chof-body takes order:1 so the sighted layout still reads name, set,
 * rarity, prices, and flex-basis:100% is what drops the caption onto its own
 * row. Removing the wrap collapses it back into the body column and quietly
 * costs plaque two the fold again.
 *
 * WHAT IT DOES NOT SAY: the name, set and number are printed two lines above it
 * and announced already, so repeating them there would be the duplication the
 * accessibility pass spent a night removing. No rarity, no odds, no value.
 */
function plaque(c, i) {
  const rank = i + 1;
  const top = rank <= 3 ? ` chof-top chof-${rank}` : "";
  const art = plaqueArt(c.image);
  const look = artLook(c);
  // AVIF in front of the WebP. TCGdex serves the same scan at four extensions
  // off one path and AVIF is 31.7% smaller than WebP at low.*, measured over the
  // 15 urls this page emits (all 30 low+high answer 200 as .avif, checked
  // 2026-08-16). picture{display:contents} in ui.css keeps `.chof-art img` and
  // the 245/337 aspect-ratio rule reaching the <img> exactly as before.
  const img = c.image
    ? avifPicture(`<img src="${esc(art.src)}"${art.extra} alt="${[esc(c.name), esc(c.rarity || ""), c.setName ? `from Pokemon ${esc(c.setName)}` : ""].filter(Boolean).join(" ")}"${i < EAGER_PLAQUES ? "" : ` loading="lazy"`} onerror="this.remove()"${art.dims || imgDims(art.src)}>`)
    : `<span class="chof-noart">${esc(c.name)}</span>`;
  // A CARD WITH NO SCAN IS NOT A BUTTON, AND UNTIL 21 AUGUST 2026 IT WAS GOING
  // TO BE. `.chof-noart` had never fired: every plaque came out of an English
  // checklist and every English checklist has scans. The Japanese rows admitted
  // on that date do not, because TCGdex publishes no image for any card in
  // those sets, and they would have rendered as a control aria-labelled
  // "Enlarge Goldeen" wired to a lightbox with no picture to put in it. That is
  // the Celebrations Mew fault on /sets/celebrations.html word for word: a
  // card-shaped hole that announces an action it cannot perform. The named box
  // stays and the button does not, so nothing offers a tap that does nothing.
  const frame = c.image
    ? `<button class="chof-art" type="button"
          data-img="${esc(c.image)}" data-name="${esc(c.name)}"
          data-set="${esc(c.setName)}" data-rarity="${esc(c.rarity || "")}"
          data-number="${esc(c.number || "")}" data-url="${esc(c.url || "")}"
          data-raw="${c.raw ? esc(moneyCompact(c.raw)) : ""}"
          data-psa="${c.psa10 ? esc(moneyCompact(c.psa10)) : ""}"
          aria-label="Enlarge ${esc(c.name)}">${img}</button>`
    : `<div class="chof-art">${img}</div>`;
  return `      <li class="chof${top}">
        <span class="chof-rank">${rank}</span>
        ${frame}
        ${look ? `<p class="chof-look">${esc(look)}</p>` : ""}
        <div class="chof-body">
          <b class="chof-name">${esc(c.name)}</b>
          <span class="chof-set">${[c.setName ? esc(c.setName) : "", c.number ? `#${esc(c.number)}` : ""].filter(Boolean).join(" &bull; ")}</span>
          ${c.rarity ? `<span class="chof-rar">${esc(c.rarity)}</span>` : ""}
          <dl class="chof-prices">
            <div><dt>Raw NM</dt><dd>${c.raw ? moneyCompact(c.raw) : noValue("Not recorded")}</dd></div>
            <div class="psa"><dt>PSA 10${c.psa10 && c.psa10AsOf ? ` <i>${esc(shortDate(c.psa10AsOf) || c.psa10AsOf)}</i>` : ""}</dt><dd>${c.psa10 ? moneyCompact(c.psa10) : noValue("No PSA 10 price for this printing")}</dd></div>
          </dl>
          ${c.pulledOn || c.pulledIn
            ? `<span class="chof-pulled">Pulled${c.pulledOn ? ` ${shortDate(c.pulledOn)}` : ""}${
                c.pulledIn ? ` &bull; ${esc(c.pulledIn)}` : ""
              }</span>`
            : ""}
          ${/* THE REASON THIS PAGE EXISTS, made tappable. Every plaque here is a
                card that came out of a specific opening and the video id was in
                data/hits.json the whole time. INTERNAL: it goes to that rip's
                own page under /rip/, where the pack wrapper and the player
                live, never to youtube.com. Every click stays on the site.

                THE TITLE IS PART OF THE LINK rather than sitting beside it, so
                the accessible name says which video without an aria-label
                repeating text that is already on screen. It is the same shape
                the species pages use in `watchBand`: the row IS the title, and
                the label above it says what tapping does. */ ""}
          ${c.rip
            ? `<a class="chof-see" href="/${esc(c.rip.path)}"><span>See it pulled</span>${esc(c.rip.title)}</a>`
            : ""}
        </div>
      </li>`;
}

const style = `
/* --------------------------------------------------------------------------
   Card Hall of Fame. Dark, because a hall of fame is a lit room with the
   exhibits picked out of it, and because foil reads as foil against near-black
   in a way it never does on cream.
   -------------------------------------------------------------------------- */
/* WAS background:var(--ink). An INK token used as a BACKGROUND, which is the
   mirror image of the .hofx-t bug and just as invisible: on the light palette
   --ink was #111111 and the page was a near-black slab, and on this one it is
   #EEF1EF with --chrome-ink written on top, so the WHOLE Hall of Fame page
   measured 1.06:1. --band-bg is the token that names this job. */
.chofpage{background:var(--band-bg);color:var(--chrome-ink);padding:var(--s7) 0 var(--s8);
  background-image:radial-gradient(120% 70% at 50% 0%, rgba(224,162,31,.16), transparent 60%)}
.chof-head{text-align:center;max-width:44em;margin:0 auto var(--s6)}
/* THE ACCENT RULE, ON A PAGE THAT USED TO BE BUILT OUT OF GOLD. Every
   --gold and --mustard here became a TEAL when the palette landed, and teal
   means "this takes you somewhere". None of these do: a page title, a tally, a
   rarity label and two prices are all MARKS, so they are pink. Gold survives on
   this page and only on this page, on the rank medallion and the podium bloom,
   where it means "this is the big pull" and nothing else. */
.chof-head h1{font:400 clamp(2rem,6vw,3.1rem)/1.05 var(--display);color:var(--ketchup-deep)}
.chof-head p{color:var(--foot-ink);margin-top:var(--s3)}
.chof-tally{display:flex;justify-content:center;gap:var(--s3);flex-wrap:wrap;margin-top:var(--s5)}
.chof-tally div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);
  border-radius:var(--r);padding:var(--s3) var(--s5);min-width:132px}
.chof-tally b{display:block;font:400 1.5rem/1 var(--display);color:var(--ketchup-deep)}
.chof-tally span{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.08em;color:var(--chrome-dim);
  text-transform:uppercase}

.chof-list{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s5) var(--s4);
  counter-reset:chof}
@media(max-width:1080px){.chof-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.chof-list{grid-template-columns:1fr;gap:var(--s4)}}
.chof{position:relative;display:flex;gap:var(--s4);align-items:flex-start;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  border-radius:14px;padding:var(--s4);transition:border-color .15s,transform .15s}
.chof:hover{border-color:rgba(224,162,31,.55);transform:translateY(-3px)}
/* The top three get the plaque treatment. Everything below is still an
   exhibit, just not on the podium. */
.chof-top{border-color:rgba(224,162,31,.45);background:rgba(224,162,31,.09)}
.chof-1{box-shadow:0 0 0 1px rgba(224,162,31,.5), 0 14px 34px rgba(0,0,0,.45)}
.chof-rank{position:absolute;left:-10px;top:-10px;z-index:3;width:34px;height:34px;
  border-radius:50%;display:grid;place-items:center;font:400 1rem/1 var(--display);
  /* GOLD STAYS ON THIS PAGE AND ONLY ON THIS PAGE. Tim: "its cool to keep the
     hall of fame gold, but just not use that color in the general pallet of
     the site colors". So the medallion is a LITERAL gold, the same pair the
     HALL OF FAME HIT badge uses, rather than var(--gold), which is a teal now.
     The label was var(--ink), a near-white on gold: the .hero-cta bug again. */
  color:var(--on-accent);background:linear-gradient(180deg,#FFD23F,#FFB000);
  box-shadow:0 2px 6px rgba(0,0,0,.5)}
.chof-top .chof-rank{width:40px;height:40px;font-size:1.2rem}

.chof-art{flex:none;width:clamp(96px,26vw,120px);padding:0;border:0;background:none;
  cursor:zoom-in;border-radius:8px;overflow:hidden;line-height:0;
  box-shadow:0 6px 18px rgba(0,0,0,.45)}
/* THE DROP SHADOW ABOVE DELETES HALF THE FOCUS INDICATOR, so this puts it
   back. ui.css's :focus-visible is an outline PLUS a white halo, and on this
   near-black page the outline alone is #6E5000 at 2.22:1, under the 3:1 that
   WCAG 2.2 SC 1.4.11 requires: the halo is the half that carries it. All 17
   cards are buttons, so all 17 were affected.

   It is fixed here rather than in ui.css because this block is emitted into a
   page-level <style> that lands AFTER the stylesheet at equal specificity, so
   a ui.css rule could not win. The drop shadow is restated because box-shadow
   does not compose: without it the card goes flat the instant you tab to it.
   The long note at the end of ui.css records the other two instances. */
.chof-art:focus-visible{
  box-shadow:0 6px 18px rgba(0,0,0,.45), 0 0 0 5px rgba(255,255,255,.95)}
/* 245/337 is the real intrinsic shape of TCGdex low.webp. It was 245/342,
   which at the 120px max width made the box 167.5 tall instead of 165 and
   object-fit:contain letterboxed every card by ~3px against var(--paper-3). */
/* THE LEFTOVER NAVY. This page kept #0E1B2A behind every card image and behind
   the "no scan" placeholder, plus #B3C2CF and #ACBBC8 for its secondary text,
   from the palette before this one. After the switch to black, white and gold
   they were the only blue things on a mono site, and the placeholder was the
   worse of the two: a navy card sitting at 1.03:1 against its band reads as a
   real dark card face rather than as "we have no image for this one". Rank 7
   looked like a card nobody had photographed well, not like a gap.

   The two greys were also doing one job in two temperatures, cold #B3C2CF next
   to warm --lilac, where every other page on the site uses one neutral for
   secondary text. */
.chof-art img{width:100%;height:auto;aspect-ratio:245/337;object-fit:contain;background:var(--paper-3)}
.chof-noart{display:grid;place-items:center;aspect-ratio:245/337;padding:10%;
  font:400 .8rem/1.2 var(--display);color:var(--chrome-dim);text-align:center;background:var(--paper-3)}
.chof-body{min-width:0;flex:1}
.chof-name{font:600 var(--t-body)/1.25 var(--body);display:block}
.chof-set,.chof-rar,.chof-pulled{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.03em;color:var(--chrome-dim)}
/* --lilac is a TEAL now (it equals --sky). A rarity label is a mark, not a route. */
.chof-rar{color:var(--plum)}
/* WHAT THE PICTURE SHOWS. Prose in --body, not the mono the labels above use:
   those are tags, this is a sentence. Full width on its own row, and the reason
   that is a fold fix rather than a taste call is written beside plaque() in the
   builder. This block ships to the browser; that one does not. */
.chof{flex-wrap:wrap}
.chof-body{order:1}
.chof-look{order:2;flex-basis:100%;font:400 var(--t-sm)/1.5 var(--body);color:var(--chrome-dim)}
.chof-prices{display:flex;gap:var(--s4);margin-top:var(--s3);padding-top:var(--s3);
  border-top:1px dashed rgba(255,255,255,.18)}
/* opacity:.7 on #9FB0C0 measured 3.32:1 against the lightest card tint on this
   page (#3E4445) where AA wants 4.5 for 11px text, and the steel itself was
   4.46:1 at full strength: under the line before the opacity was applied.
   The steel is now var(--chrome-dim) (5.45:1) and the date gets an explicit dimmer
   colour instead of a multiplier, because opacity compounds with whatever
   the card tint happens to be and cannot be checked by reading it. */
.chof-prices dt i{font-style:normal;font-weight:400;color:var(--chrome-dim);
  text-transform:none;letter-spacing:.02em}
.chof-prices dt{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;color:var(--chrome-dim);
  text-transform:uppercase}
.chof-prices dd{font:700 var(--t-m)/1.2 var(--body);color:var(--chrome-ink)}
.chof-prices .psa dd{color:var(--ketchup-deep)}
.chof-pulled{margin-top:var(--s2)}
/* "See it pulled", the route from a plaque to the rip it came out of.
   TEAL, because teal is how you get around and this is the only route out of a
   plaque. Composited rather than guessed: the plaque ground is
   rgba(255,255,255,.05) over --band-bg #192D22, which is #25382D, and the top
   three are rgba(224,162,31,.09) over the same, #2B3822. --sky measures 5.53:1
   and 5.50:1 on those two, clear of AA at any size. The label is --chrome-dim,
   7.51:1 and 7.47:1, and it is a caption rather than a route, which is why it
   is not the second accent.
   ui.css declares a{color:inherit} globally, so an unstyled link here would
   have come out the same grey as the set name beside it and read as nothing.
   BLOCK, not inline: it makes the whole two-line run the tap target rather
   than a 90px phrase, which is the shape requirement every link on this site
   is held to. min-height 44px for the same reason, and it is only ever reached
   after the prices, so nothing above it moves. */
/* --sky-deep, NOT --sky, AND THE COMPOSITE ABOVE IS WHY. It is right about the
   plaque and misses the band: main.chofpage also carries
   radial-gradient(120% 70% at 50% 0%, rgba(224,162,31,.16), transparent 60%),
   so the top of the list wears the gold bloom ON TOP of the plaque tint. Read
   off rendered pixels at 390x844 (glyphs hidden, box screenshotted) rather than
   composited by hand: cards 1-4 sit on rgb(68,71,34)..rgb(59,69,45) and --sky
   measures 4.29 / 4.36 / 4.38 / 4.48, all under AA at 14px. Card 5 is 4.56 and
   desktop is 4.59: that is the bloom fading, not a different colour.
   --sky-deep #81BEDE measures 4.83 on the worst of the four, and is already the
   token this site spends on small type (.hof-head a, same size, always has). */
.chof-see{display:block;margin-top:var(--s3);min-height:44px;
  font:600 var(--t-sm)/1.35 var(--body);color:var(--sky-deep)}
.chof-see span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--chrome-dim)}
.chof-see:hover,.chof-see:focus-visible{text-decoration:underline}
.chof-empty{text-align:center;color:var(--foot-ink);background:rgba(255,255,255,.05);
  border:1px dashed rgba(255,255,255,.2);border-radius:14px;padding:var(--s7) var(--s5)}
.chof-note{font:700 var(--t-micro)/1.7 var(--mono);color:var(--chrome-dim);text-align:center;
  margin-top:var(--s7);max-width:52em;margin-inline:auto}

/* lightbox */
.lb{position:fixed;inset:0;z-index:200;display:none;place-items:center;padding:var(--s5);
  background:rgba(0,0,0,.92)}
.lb.on{display:grid}
.lb-in{max-width:520px;width:100%;text-align:center}
.lb-in img{width:100%;max-height:76vh;object-fit:contain;border-radius:10px}
.lb-in h2{font:400 1.4rem/1.2 var(--display);color:var(--chrome-ink);margin-top:var(--s4)}
.lb-in p{font:700 var(--t-sm)/1.6 var(--mono);color:var(--chrome-dim)}
.lb-in .lb-pr{color:var(--ketchup-deep);font-size:var(--t-m)}
.lb-close{position:absolute;top:var(--s4);right:var(--s4);width:44px;height:44px;
  border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);
  color:#fff;font-size:1.3rem;cursor:pointer}
`;

const body = `
<main id="main" class="chofpage">
  <div class="wrap">
    <div class="chof-head">
      ${/* "Best pulls" IS WHAT THE REST OF THE SITE CALLS THIS PAGE. All 1,478
        pages link to it as "Best pulls" in the nav and the footer, and it
        answered to "Card Hall of Fame" in its own h1, which is the same drift
        this page has already been the example of once: it was "Hits" in the
        bar, "Best pulls" in the menu and "Card Hall of Fame" in the footer.
        The hall of fame name is not lost, it is where it earns its keep: the
        <title> is still "Card Hall of Fame: Our Best Pokemon Pulls", so the
        phrase is in the search result and the h1 agrees with the link that got
        you here. */ ""}
      <h1>Our best Pokemon <span class="hl">pulls</span></h1>
      <p>Every card that has come out of a pack on this channel, ranked by its PSA 10 price where we have one and by its raw price where we do not. Tap a card to see it full size.${derivedFromHits ? " Nothing here was hand picked: this is the whole list of what was pulled on camera." : ""}</p>
      ${ranked.length ? `<div class="chof-tally">
        <div><b>${ranked.length}</b><span>${derivedFromHits ? "Cards pulled" : "Cards inducted"}</span></div>
        ${/* "ALL OF THEM RAW" HAS TO STOP SAYING "ALL" WHEN IT IS NOT ALL, and
              that became live the day this page started admitting cards it
              holds no price for. It is a SUM over the cards that HAVE a raw
              price, and while every plaque had one the word was exact. The
              three Japanese and Korean rows do not: nothing on this site prices
              a non-English printing. Same shape as the PSA 10 tile beside it,
              which has always named its subset, so the fix is to make the two
              labels agree rather than to invent a third form of words. */ ""}${totalRaw ? `<div><b>${moneyCompact(totalRaw)}</b><span>${rawCards.length === ranked.length ? "All of them raw" : `Raw on ${rawCards.length} of ${ranked.length}`}</span></div>` : ""}
        ${gradedCards.length ? `<div><b>${moneyCompact(totalGraded)}</b><span>PSA 10 on ${gradedCards.length} of ${ranked.length}</span></div>` : ""}
      </div>` : ""}
    </div>

    ${ranked.length
      ? `<ol class="chof-list">
${ranked.map(plaque).join("\n")}
    </ol>`
      : `<p class="chof-empty">No cards inducted yet. Flag a card as <b>Card Hall of Fame</b> on the
         Chase Cards tab of the video log and it appears here, ranked automatically.</p>`}

    <p class="chof-note">RANKED BY PSA 10 WHERE THERE IS ONE, AND BY RAW NEAR MINT OTHERWISE.
      A DASH MEANS NO PRICE WE ARE WILLING TO STAND BEHIND YET, NOT A CARD WORTH NOTHING.
      RAW NEAR MINT IS PRICECHARTING'S UNGRADED PRICE GUIDE VALUE, THE SAME FIGURE EVERY SET GUIDE
      AND THE CARD SEARCH PRINT FOR THESE CARDS.${psaNote}</p>

    ${/* WHOSE PULLS THESE ARE. /about.html carried ZERO in-body inbound links
          from anywhere on the site, and this is the page most obviously making
          a first-person claim: "our best pulls" with no link to who "our" is.
          The rip library link is the same fix in the other direction, since
          every card here came out of a video that has its own page. */ ""}
    <p class="chof-note"><a href="/about.html">WHO PULLED ALL OF THIS</a>, AND
      <a href="/videos.html">EVERY RIP THEY CAME OUT OF</a>. THE ONES STILL BEING CHASED ARE ON
      <a href="/wanted.html">MOST WANTED</a>.</p>
  </div>
</main>

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card">
  <button class="lb-close" type="button" aria-label="Close">&times;</button>
  <div class="lb-in">
    <picture><source id="lbAvif" type="image/avif"><img id="lbImg" src="" alt=""></picture>
    <h2 id="lbNm"></h2>
    <p id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
  </div>
</div>

<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    var src=b.dataset.img;
    if(!src) return;                       // no art, nothing to enlarge
    // The lightbox is the one place on this page that loads high.webp, 600x825
    // and 80-136KB, and AVIF is 34-47% smaller at that size. avifPicture()
    // cannot reach it because the url only becomes an image url on click, so
    // the <source> is filled here, applying the SAME host test avifPicture
    // applies: only assets.tcgdex.net publishes an AVIF beside its WebP, and a
    // <source> pointing at a 404 paints a broken card instead of falling back.
    // srcset FIRST, then src, so the webp is never requested and abandoned.
    var avif=document.getElementById('lbAvif');
    if(src.indexOf('https://assets.tcgdex.net/')===0 && src.slice(-5)==='.webp')
      avif.setAttribute('srcset', src.slice(0,-5)+'.avif');
    else avif.removeAttribute('srcset');
    img.src=src; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.set,b.dataset.rarity,'#'+b.dataset.number].filter(Boolean).join(' \\u2022 ');
    document.getElementById('lbPr').textContent=[
      b.dataset.raw?'Raw NM '+b.dataset.raw:'',
      b.dataset.psa?'PSA 10 '+b.dataset.psa:''
    ].filter(Boolean).join('   \\u2022   ');
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on');
    document.body.style.overflow='';
    if(last) last.focus();                 // send focus back where it came from
  }
  document.querySelectorAll('.chof-art').forEach(function(b){
    b.addEventListener('click',function(){open(b)});
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>`;

// NO ItemList HERE. This page used to emit one and it never earned anything.
//
// `c.url` is the chase list's TCGplayer link, and it is only ever set for a
// card the SET page happens to feature. Every card in the hall is resolved out
// of data/hits.json instead, none of which are in a chase list, so in practice
// the count of entries carrying a url was zero out of fifteen. A ListItem with
// only `name` and `position` points nowhere, and Google ignores an ItemList
// whose entries have no resolvable target, so the block was dead weight.
//
// It cannot be fixed by pointing somewhere plausible. There is no per-card page
// on this site to link to. The rip page is about the video, not the card, and
// several hall cards come out of the same video, so those entries would all
// collide on one URL. Bring the block back when a card actually has a page.

const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
// Stop at </header>. Slicing to the rail also swallowed the menu that sits
// between them, and these pages then append their own copy, so every one
// shipped two <nav id="menu"> blocks: invalid HTML and a duplicated landmark.
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf('</header>') + '</header>'.length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
// The bar carries the menu button; the panel it controls lives after </header>,
// so it has to be copied across too or the button opens nothing.
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>Card Hall of Fame: Our Best Pokemon Pulls | Garbage Rips 585</title>`)
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="The best Pokemon cards ever pulled on Garbage Rips 585, ranked by value, with raw near mint and PSA 10 market prices.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/hall.html">`)
  .replace(/(<meta property="og:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-hall.jpg`)
  .replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-hall.jpg`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/hall.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1Card Hall of Fame | Garbage Rips 585`);

await writeFile(
  join(ROOT, "public/hall.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${style}</style>
</head>
<body>
${skipLink}
${sprite}

${bar}
${menuPanel}
${body}
${footer}

${APP_JS}
</body>
</html>
`
);

console.log(`Wrote public/hall.html
  cards inducted   ${ranked.length}
  with PSA 10      ${ranked.filter((c) => c.psa10).length}${psaSources.length ? `  (${psaSources.join(", ")})` : ""}
  with a raw price ${ranked.filter((c) => c.raw).length}
  with card art    ${ranked.filter((c) => c.image).length}
  rarities         ${[...new Set(ranked.map((c) => c.rarity).filter(Boolean))].sort().join(", ")}
`);
// WHAT HAPPENED TO ALL 93 ROWS, because the lede on this page says it is the
// whole list and nothing was checking that.
//
// Eleven rows used to leave without a word: seven on a promo with no price,
// three on a set whose checklist this builder could not open, one on a card
// name that is not on the checklist it CAN open. Three of the four were fixed
// and the fourth is a typo in the spreadsheet, which is not this file's to
// correct. What is this file's job is saying so on every run, so the next
// silent drop is loud on the day it appears rather than in the next audit.
if (hitsLedger) {
  const l = hitsLedger;
  console.log(`  from data/hits.json: ${l.rowsRead} row${l.rowsRead === 1 ? "" : "s"} read, ${l.inducted} card${l.inducted === 1 ? "" : "s"} inducted`);
  for (const x of l.intlIn) {
    console.log(`  ${x.card} #${x.n} (${x.set}) resolved against public/data/intl-guides.json, so it carries no scan and no price`);
  }
  for (const x of l.ambiguous) {
    console.log(`  ${x.card}${x.rarity ? ` (${x.rarity})` : ""} in ${x.set} went in with no collector number: ${x.printings} printing${x.printings === 1 ? "" : "s"} carry that name on the intl checklist and the Japanese rarity ladder is deliberately not mapped onto the English one, so nothing here can say which was pulled`);
  }
  for (const x of l.unlisted) {
    console.log(`  ${x.card} (${x.setName}) went in on the sheet's own words: this site holds no checklist for that set, so it has no number, no scan and no price`);
  }
  for (const x of l.unmatched) {
    console.log(`  DROPPED ${x.card}${x.rarity ? ` (${x.rarity})` : ""}: not on the ${x.set} checklist. Fix the name in the My Hits tab and re-import; do not edit data/hits.json, which import-sheet.mjs rebuilds per video.`);
  }
  if (!l.unmatched.length) console.log(`  every row that named a set resolved to a card on that set's checklist`);
}

// A graded record that named a different printing is dropped on purpose. Say
// which ones and why, so a run that drops MORE of them is visible rather than
// looking like a source that quietly went empty.
for (const c of ranked) {
  if (c.psa10) continue;
  const near = nearMisses(c.name, c.setName);
  for (const r of near) {
    console.log(`  no PSA 10 for ${c.name} #${c.number} (${c.setName}): graded.json holds "${r.matched}", a different printing`);
  }
}
if (!ranked.length) {
  console.log(`Nothing inducted yet. Mark cards "Card Hall of Fame" on the Chase Cards
tab, export it, and run:  node scripts/import-cards.mjs <csv>
`);
}
