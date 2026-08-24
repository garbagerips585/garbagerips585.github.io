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
// Ranked by RAW near mint price, top to bottom, because that is the figure
// nearly every card here has and the only one the whole page can be compared
// on. A PSA 10 is still printed on every plaque that has one, and the tile at
// the top names the best of them and links to it. The full argument, including
// the one this replaced, is beside the .sort() below.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { APP_JS_NO_PACKPLAYER as APP_JS, dropUnusedPacksCSS } from "../shared/chrome.mjs";
import { loadCorpus, corpusCard } from "../shared/subset-cards.mjs";
import { esc, shortDate, moneyCompact, noValue, rarityLabel, imgDims, cardNumKey, avifPicture } from "../shared/format.mjs";
import { loadGradedPrices, MIN_SALES } from "../shared/graded-price.mjs";
import { loadFirstPartner } from "../shared/first-partner.mjs";
// THE RULE IS intl-printing.mjs AND IT IS UNCHANGED. This asks it in the rip
// log's own vocabulary and hands back the guide's own row; see that file.
import { pickIntlPrintingJp } from "../shared/intl-vocab.mjs";
// corpusScan MOVED OUT OF THIS FILE ON 22 AUGUST 2026 AND THE NOTE THAT LIVED
// HERE PREDICTED IT. It ended: "build-pages.mjs has the identical gap on the
// identical rows and would want the identical three lines, but that file is not
// this pass's to edit." It is now, and so are the two set-guide builders, so
// the choice stopped being "one private copy" and became four of them. The
// whole argument, the 312-scan table and the two cross-checks are in
// shared/card-scan.mjs, which is intl-printing.mjs's impure neighbour rather
// than a change to it: that module is a pure function about a rule and this one
// reads two files off disk.
import { corpusScan, noScanBox, pinnedShot, NOSCAN_CSS } from "../shared/card-scan.mjs";

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
/*
 * WHICH PRINTING AN INTL HIT IS: shared/intl-printing.mjs, imported above.
 *
 * THIS USED TO BE THE SECOND COPY OF ONE RULE, kept in step with the one in
 * build-pages.mjs by a comment in each file ordering the reader to edit both.
 * A Japanese set guide became the third caller on 21 August 2026 and the rule
 * moved into a module instead. Nothing about the decision changed: exact tier
 * on the SAME ladder wins; failing that, drop every printing that states a
 * DIFFERENT tier; take what is left only if it is alone and its own tier is
 * unstated. `same[0]` is never reached, so a Japanese tier is never mapped onto
 * an English one to win a collector number.
 */
// The bases TCGdex does not have. See the note beside `img` in the intl
// checklist mapping below for why this page reads it now and what it drops.
let NO_SCAN = new Set();
try {
  NO_SCAN = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases || []);
} catch {
  /* optional: a missing base then renders as an img that removes itself */
}

/* THE SECOND PLACE A JAPANESE SCAN LIVES, AND WHAT A SLOT SHOWS WHEN THERE IS
 * NONE, are both shared/card-scan.mjs now. `corpusScan` is called below, once
 * the printing is already settled, and it is keyed on that printing's own (set,
 * collector number) with two cross-checks on the way. `noScanBox` is what a
 * plaque with no scan renders. The 312-scan table, the Frogadier case that
 * proves this cannot pick a printing, and the argument for the panel's contents
 * are all in that file's header. */

let derivedFromHits = false;
let hitsLedger = null;
const firstPartner = await loadFirstPartner();
if (!hall.length) {
  const hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
  /* The printings corpus, loaded once, and only the shards these card names
   * need. It answers for sets this site keeps no per-set checklist for and
   * for the subsets that live inside one. See shared/subset-cards.mjs. */
  const CORPUS = await loadCorpus(ROOT, Object.values(hits).flat().map((c) => c.card));
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
  const fromCorpus = [];
  const intlIn = [];
  const ambiguous = [];
  // A ROW THE HALL CAN PUT NOTHING BEHIND. Two shapes reach it: a promo with no
  // set, no number and no price (see the gate below), and any row whose name is
  // not on a checklist we hold (`unmatched`). The lede counts them together
  // because the reader's question is the same one either way -- why is a card I
  // watched come out of a pack not on the page -- and the answer is the same
  // too: we would be publishing a name with nothing behind it.
  const unplaceable = [];
  let rowsRead = 0;
  // THE FOURTH THING THAT TAKES A ROW OFF THIS PAGE, AND IT WAS THE ONE NOBODY
  // COUNTED. Every `seen.has(...)` below drops a row because the printing is
  // already on the page, which is right -- a card pulled twice is one plaque --
  // but it was the only drop with no line in the ledger, so the run could say
  // it read 183 rows and inducted 140 and leave 33 of the difference unexplained.
  // The page now states the whole subtraction in its own lede, and it cannot do
  // that from numbers the build does not keep. See the lede below.
  let repeats = 0;
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
        // AND THIS WAS THE FOURTH SILENT DROP, FOUND ON 21 AUGUST 2026 BY THE
        // ARITHMETIC THE LEDE NOW PRINTS. The three above were fixed and
        // ledgered; this one was never counted, so 183 rows came out as
        // 140 + 32 + 10 = 182 and one card left with nothing said about it. It
        // is Mega Kangaskhan ex on l6RPdGNs7uE, whose rip log row carries a
        // name and a rarity and NO set, NO number and NO price, the only row of
        // the 183 like that.
        //
        // IT STILL GOES, and the gate above it is still right: this branch is
        // for a promo the log prices itself, and a plaque with no set, no
        // number, no scan and no price is a name in a gold frame. What changes
        // is that the run says so and the page counts it.
        //
        // TWO THINGS CHANGED ON 23 AUGUST 2026 AND THEY ARE THE SAME CHANGE.
        // Tim sent TCGplayer links for six promos this branch had been dropping
        // -- Mega Kangaskhan ex 025, Mabosstiff ex 086, Mega Charizard Y ex 030,
        // Mega Charizard X ex 029, Mega Venusaur ex 013 and Victini 208 -- and
        // what each link supplies is a COLLECTOR NUMBER and a MARKET PRICE.
        // Both now go in the sheet, so both have to be read here:
        //
        //   `promoArt` resolves the number against public/data/printings, which
        //   is where every one of those six scans already was. The branch used
        //   to read only `h.img`, a field nothing writes any more, so a promo
        //   without a hand-kept image had no picture available to it at all.
        //
        //   `h.rawNm` joins price and psa10 in the gate below. A promo has no
        //   price in any live feed by construction -- TCGdex carries no TCGplayer
        //   pricing for promo sets -- so the sheet's Raw NM column is not a
        //   second-best source for these cards, it is the only one.
        //
        // The gate itself is unchanged in spirit: a plaque still needs SOMETHING
        // beyond a name. It just now counts the two fields a person can actually
        // fill in.
        const promoArt = corpusCard(CORPUS, { card: h.card, setName: h.setName || null, rarity: h.rarity, number: h.number });
        if (typeof h.price !== "number" && typeof h.psa10 !== "number"
            && typeof h.rawNm !== "number"
            && !(fp && (fp.price != null || fp.psa10 != null))) {
          unplaceable.push({ card: h.card, rarity: h.rarity || null, vid });
          continue;
        }
        // DEDUPE, BECAUSE A PROMO CAN BE PULLED TWICE AND THREE OF THEM WERE.
        // The set branch below has always deduped on `<set>-<number>` and this
        // branch had nothing, which cost nothing while the only two rows here
        // came from one video. Six First Partner rows for three cards would
        // have put each of them on the page twice, on a page whose count is
        // printed in its own headline stat. First occurrence wins, same as
        // below, so the plaque links the first rip the card came out of.
        const pkey = `promo-${String(h.card).toLowerCase()}-${h.number || fp?.number || ""}`;
        if (seen.has(pkey)) { repeats++; continue; }
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
          set: null, number: h.number || fp?.number || promoArt?.n || null, name: h.card,
          _vid: vid,
          _img: h.img ? `${h.img}/high.webp` : fp?.imgLarge || promoArt?.img?.replace(/\/low\.webp$/, "/high.webp") || null,
          // `h.rawNm` LAST, for the reason spelled out at the corpus branch below:
          // a promo has no price in any live feed, so the sheet's own column is the
          // only figure there is. It sits behind both live sources, never in front.
          _raw: typeof h.price === "number" ? h.price : fp?.price ?? (typeof h.rawNm === "number" ? h.rawNm : null),
          _rarity: h.rarity || "Black Star Promo",
          _psa10: typeof h.psa10 === "number" ? h.psa10 : fp?.psa10 ?? null,
          // The rip log stores ONE source, date and url per promo entry and
          // both its numbers came off that one page, so the PSA 10 stamp reads
          // from the same three fields the raw price does.
          _psa10AsOf: h.priceAsOf || fp?.asOf || null,
          _psa10Source: h.priceSource || fp?.source || null,
          _psa10Url: h.priceUrl || fp?.url || null,
          // THE CORPUS SET NAME BEFORE THE GENERIC ONE. "MEP Black Star Promos"
          // and "SVP Black Star Promos" are different sets and the plaque should
          // say which; "Black Star Promo" is the last resort, not the label.
          _setName: h.setName || fp?.setName || promoArt?.setName || "Black Star Promo",
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
      // HOISTED OUT OF THE catch SO THE SCAN BACKFILL CAN REACH IT. The guide
      // record carries the NATIVE SET NAME, which is the key the printings
      // corpus files this set under: see corpusScan at the top of this file.
      let guide = null;
      try {
        cards = JSON.parse(await readFile(join(ROOT, `public/data/cards/${h.set}.json`), "utf8")).cards;
      } catch {
        const g = (guide = intlGuides[h.set]);
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
            // BOTH NAMES AND THE RAW localId ARE CARRIED THROUGH, and they are
            // not decoration: corpusScan needs the localId to find the row, the
            // native name to prove it is the same row, and BOTH names because
            // the corpus is sharded by whichever of the two it filed the card
            // under. Nothing else reads them.
            localId: c.localId,
            native: c.native || null,
            en: c.en || null,
            rarity: c.rarity || null,
            // THE SAME CARD'S TIER IN THE WORDS ON THE JAPANESE WRAPPER, WHICH
            // IS THE VOCABULARY data/hits.json IS WRITTEN IN. Asked with, never
            // shown: `rarity` above is what this plaque prints and what
            // corpusScan cross-checks against public/data/printings, and a
            // Japanese word in that slot would cost these rows their scan. See
            // shared/intl-vocab.mjs.
            rarityJp: c.rarityJp || null,
            // `img: null` WAS A LITERAL AND IT WAS WRONG ON SIX OF THE THIRTEEN
            // GUIDES. The comment above this block says those guides carry "NO
            // image and NO price for any of them", and it read as a measured
            // fact because the price half is one. The image half was a fact
            // about the seven that were being looked at: hasImages is false on
            // ja-abyss-eye, ja-ninja-spinner, ja-nihil-zero, ja-mega-symphonia
            // and ja-mega-brave, and ja-cyber-judge and zh-gem-pack-2 carry no
            // card list at all, which is exactly the seven. On the other six it
            // is true and COMPLETE: ja-stellar-miracle 135 of 135, ja-violet-ex
            // 108 of 108, ko-clay-burst 99 of 99, ko-crimson-haze 96 of 96,
            // ko-mask-of-change 101 of 101, ko-battle-partners 132 of 132.
            //
            // So .chof-noart, which this page's own note says "had never fired",
            // is now the branch for a set with no scans rather than for every
            // intl plaque there is.
            //
            // AND "hasImages IS FALSE" IS A FACT ABOUT THIS FILE, NOT ABOUT
            // TCGdex. Three of the five sets named above publish a full set of
            // scans in public/data/printings/*.json, which is a different
            // sync's output; corpusScan at the top of this builder picks them
            // up AFTER the printing is settled, so this field staying null is
            // no longer the end of the question. The three that are a genuine
            // upstream gap are ja-abyss-eye, ja-nihil-zero and ja-mega-brave.
            //
            // A BASE, NOT A URL, because the emitter below appends the
            // rendition: `image` in that file ends in /low.webp and this page
            // asks for /high.webp. Same cut build-pages.mjs makes, and the two
            // files must agree here for the same reason they must agree about
            // the printing.
            //
            // AND IT IS CHECKED AGAINST data/no-scan.json, because nothing on
            // the intl path had ever checked it: sync-intl-guides.mjs does not
            // apply that file the way sync-cards.mjs applies it to the English
            // 28. Dropping the IMAGE and not the card is the point -- the
            // plaque keeps its number and falls to .chof-noart, so a scan
            // TCGdex withdraws looks exactly like a card that never had one
            // instead of a dead round trip behind an onerror. Same five lines
            // build-intl-pages.mjs already runs over the intl chase cards, and
            // build-pages.mjs now runs over the same checklist.
            img: (function () {
              const b = c.image ? String(c.image).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "") : null;
              return b && !NO_SCAN.has(b) ? b : null;
            })(),
            price: null,
          }));
        }
      }
      // ACCENTS ARE FOLDED, NOT STRIPPED, AND THE DIFFERENCE IS A WHOLE CARD.
// This used to go straight to `[^a-z0-9]`, which DELETES an accented letter
// rather than replacing it: "Poke Pad" with the accent came out "pokpad" and
// the checklist's "Poke Pad" came out "pokepad", so the two never met and the
// card went on the page with no collector number for want of one letter. NFKD
// splits the letter from its accent and the strip then removes only the accent.
const norm = (x) =>
  String(x).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      // NO CHECKLIST IN EITHER FILE IS A DIFFERENT CASE FROM A CARD THAT IS NOT
      // ON ONE, and they used to share a `continue`. Where the site holds no
      // list for the set at all there is nothing to fail to match against, so
      // the row goes in on what the sheet itself says: the card, the set it
      // names and the rarity. That is Incineroar ex, Cyber Judge, Super Rare.
      // No number, no scan and no price, all of which render as absent.
      if (!cards?.length) {
        const key = `${h.set}-${norm(h.card)}`;
        if (seen.has(key)) { repeats++; continue; }
        seen.add(key);
        // THE CORPUS ANSWERS FOR SETS THIS SITE KEEPS NO CHECKLIST FOR, and for
        // the subsets that live inside one. public/data/cards/ holds 28 English
        // sets; public/data/printings/ holds 370, including Silver Tempest, Lost
        // Origin, "Crown Zenith Galarian Gallery" and "Silver Tempest Trainer
        // Gallery". Five real cards were rendering as a bare name with no
        // number, no scan and no price while the corpus held all of them.
        //
        // The rip log glues the subset onto the NAME -- "Paras Galarian
        // Gallery" -- so those words are routing information rather than part
        // of the card, and shared/subset-cards.mjs peels them off to pick the
        // set. It refuses a name it cannot separate rather than guessing, which
        // is the same rule the checklists are held to.
        const sub = corpusCard(CORPUS, { card: h.card, setName: h.setName || h.set, rarity: h.rarity, number: h.number });
        if (sub) {
          out.push({
            set: h.set, number: sub.n, name: sub.name,
            _vid: vid,
            _img: sub.img,
            // `h.rawNm` LAST. It is the Raw NM USD column of the My Hits tab, and for
            // most rows it is a figure this site derived and wrote back, so it must
            // never outrank a live one. For a handful of cards it is the ONLY figure
            // that exists: Silver Tempest and Lost Origin have no checklist here, the
            // printings corpus carries no prices, and TCGdex has no pricing for promo
            // sets at all, so ten cards Tim sent TCGplayer links for on 23 August 2026
            // had a scan, a number and no money. Typed into the sheet, it reaches the
            // page. Frozen beats nothing; it does not beat fresh.
            _raw: sub.price ?? (typeof h.rawNm === "number" ? h.rawNm : null),
            _rarity: sub.rarity || h.rarity || null,
            _setName: sub.setName || h.setName || null,
          });
          fromCorpus.push(`${sub.name} #${sub.n} (${sub.setName})`);
          continue;
        }
        unlisted.push({ set: h.set, setName: h.setName || h.set, card: h.card });
        out.push({
          set: h.set, number: null, name: h.card,
          _vid: vid,
          _img: null,
          _raw: typeof h.rawNm === "number" ? h.rawNm : null,
          _rarity: h.rarity || null,
          _setName: h.setName || null,
        });
        continue;
      }
      const same = cards.filter((c) => norm(c.name) === norm(h.card));
      // Where the sheet named a rarity, take the printing that matches: that is
      // the one actually pulled. Same rule build-pages.mjs uses for rip pages,
      // so a card cannot show one number here and another there.
      //
      // EXACT TIER FIRST, PREFIX ONLY AS A FALLBACK, changed in step with
      // build-pages.mjs and for the reason written out in full there: the
      // eight-character `includes` test cannot tell "Hyper Rare" from "Mega
      // Hyper Rare", and this page's own #1 plaque is the card that proved it.
      // The two files must move together or the plaque and the rip page start
      // naming different printings of one card, which is the fault the comment
      // above this one was written to prevent.
      const want = h.rarity ? norm(h.rarity) : null;
      // REVERTED 23 August 2026, SAME DAY IT WENT IN. I made the collector
      // number beat the rarity word here and in build-pages.mjs and
      // build-luck.mjs, on the evidence that this page carried "#290 Double
      // Rare" for a card whose #290 is a $668.50 Special Illustration Rare.
      //
      // THE NUMBER IS THE DERIVED FIELD, NOT THE RARITY. The My Hits Number
      // column is EMPTY on those rows; import-sheet.mjs fills it from a lookup
      // that had already chosen the wrong printing. So the fix promoted a guess
      // over the thing a person typed while holding the card, and this page
      // filled up with chase printings of cards that were pulled as commons.
      //
      // Tim, looking at the result: "you added in all sorts of cards that are
      // not logged as hits in my video ... that is wrong." Nothing had been
      // added -- every plaque was a real logged card -- but they were the wrong
      // PRINTINGS, which reads exactly like the wanted list leaking in.
      let m = (want && same.find((c) => norm(c.rarity) === want)) ||
              (want && same.find((c) => norm(c.rarity).includes(want.slice(0, 8)))) ||
              same[0];
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
      // So an intl row takes a printing ONLY where nothing can contradict it.
      // Otherwise it falls through to the branch below and goes in on the
      // sheet's own words, with no number, which asserts nothing about which of
      // the two printings came out.
      //
      // ====================================================================
      // THAT TEST WAS "the name is unique in the set" AND IT WAS TOO BLUNT BY
      // EXACTLY ONE CASE, WHICH IS THE ONE THIS SITE HAD A PICTURE FOR.
      // ====================================================================
      //
      // Changed 2026-08-21 IN STEP WITH build-pages.mjs, which is the contract
      // the paragraph above this one exists to enforce. The rule and the whole
      // argument for it are written out once, in pickIntlPrinting in that file;
      // this is the same three branches and it must stay the same three, or a
      // plaque and a rip page start naming different printings of one card.
      //
      // 1. The tier is stated and it is the log's word. One vocabulary.
      // 2. Nothing states the log's tier: drop every printing that states a
      //    DIFFERENT one. This is where Goldeen stops. Both of its printings
      //    state a tier, neither is "Art Rare", nothing survives, no number.
      // 3. Take a survivor only when it is ALONE and its own tier is unstated.
      //
      // WHAT IT WINS is Stellar Miracle, where TCGdex states the four lowest
      // Japanese tiers and leaves 36 of 135 unfiled: Crabominable is #024
      // "Uncommon" and #107 unfiled, the log says Art Rare, and Uncommon and
      // Art Rare are two different tiers on the SAME Japanese ladder (jp-u and
      // jp-ar in shared/rarity.mjs). #024 is not the card, so #107 is the only
      // one left. No English tier is consulted and nothing is mapped onto
      // anything: the refusal above stands exactly as written.
      //
      // WHAT IT ALSO WINS, and this one is not about Japanese at all, is Mega
      // Abomasnow ex: Mega Symphonia prints it at #018 "Double rare" and #076
      // "Secret Rare", the log says Double Rare, and the old test refused it
      // for having two printings when one of them matches the log exactly.
      if (source === "intl") {
        const nm = pickIntlPrintingJp(same, want);
        if (!nm) {
          m = null;
          ambiguous.push({ set: h.set, card: h.card, rarity: h.rarity || null, printings: same.length });
        } else {
          m = nm;
        }
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
          // THE SUBSETS ARE TRIED BEFORE THE ROW IS CALLED A DATA ERROR.
          // Crown Zenith HAS a checklist and Paras is genuinely not on it,
          // because Paras is a GALARIAN GALLERY card: the corpus files it under
          // "Crown Zenith Galarian Gallery" GG32, a set this site keeps no
          // per-set list for. Same for Corviknight V, which is Silver Tempest
          // TRAINER GALLERY TG18. Dropping those as spelling mistakes was
          // wrong; they are real cards in a subset the checklist does not cover.
          //
          // It still refuses what it cannot separate: Reshiram V has two Silver
          // Tempest printings and the log names no rarity, so that one stays
          // unmatched and gets reported rather than guessed at.
          const sub = corpusCard(CORPUS, { card: h.card, setName: h.setName || h.set, rarity: h.rarity, number: h.number });
          if (sub) {
            const skey = `${h.set}-${norm(sub.name)}-${sub.n}`;
            if (seen.has(skey)) { repeats++; continue; }
            seen.add(skey);
            out.push({
              set: h.set, number: sub.n, name: sub.name,
              _vid: vid,
              _img: sub.img,
              // Same as the branch above: the corpus carries no prices, so the
            // sheet's own Raw NM column is the last resort and the only figure
            // Silver Tempest, Lost Origin and the promo sets have.
            _raw: sub.price ?? (typeof h.rawNm === "number" ? h.rawNm : null),
              _rarity: sub.rarity || h.rarity || null,
              _setName: sub.setName || h.setName || null,
            });
            fromCorpus.push(`${sub.name} #${sub.n} (${sub.setName})`);
            continue;
          }
          unmatched.push({ set: h.set, card: h.card, rarity: h.rarity || null, source });
          continue;
        }
        const ikey = `${h.set}-${norm(h.card)}`;
        if (seen.has(ikey)) { repeats++; continue; }
        seen.add(ikey);
        out.push({
          set: h.set, number: null, name: h.card,
          _vid: vid,
          _img: null,
          _raw: typeof h.rawNm === "number" ? h.rawNm : null,
          _rarity: h.rarity || null,
          _setName: h.setName || null,
        });
        continue;
      }
      const key = `${h.set}-${m.n}`;
      if (seen.has(key)) { repeats++; continue; }
      seen.add(key);
      // THE SCAN THE GUIDE DOES NOT HAVE AND THE PRINTINGS CORPUS DOES. Only
      // ever asked AFTER the printing is settled, and only when the guide has
      // no image of its own, so it can never change which card a plaque names.
      // The whole argument is beside corpusScan at the top of this file.
      const backfill = source === "intl" && !m.img ? await corpusScan(guide?.native, m) : null;
      // `art` IS CARRIED SO THE LEDGER LINE CANNOT GO STALE. It used to end "so it
// carries no scan and no price", which was a true sentence about every intl
// plaque on the day it was written and became false for three of them the
// moment this builder started reading the intl checklist's own image field.
// It names WHICH file answered now, because "with a scan" stopped being one
// fact the moment there were two places a scan could come from, and a run that
// silently stops reaching the corpus should not read the same as one that never
// needed it.
if (source === "intl") intlIn.push({ set: h.set, card: m.name, n: m.n, art: m.img ? "guide" : backfill ? "corpus" : null });
      // Carry the card's OWN art, price and rarity from the checklist. resolve()
      // below only knows how to look a card up in the set's `chase` list, which
      // is the dozen or so cards a set page features, and 15 of 15 hits were not
      // in it: the page rendered with no images and no prices at all.
      out.push({
        set: h.set, number: m.n, name: m.name,
        _vid: vid,
        // THE GUIDE'S OWN SCAN FIRST, THEN THE CORPUS. Same precedence every
        // other chain in this file uses: the file this row was resolved out of
        // wins, and the second source stands behind it rather than over it.
        _img: (m.img || backfill) ? `${m.img || backfill}/high.webp` : null,
        // The intl guides carry no prices at all by design, so every Japanese
        // and Korean hit on this page reaches here with `m.price` null. The
        // sheet's Raw NM column is the only figure those cards will ever have.
        _raw: typeof m.price === "number" ? m.price
          : typeof h.rawNm === "number" ? h.rawNm : null,
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
  hitsLedger = { rowsRead, inducted: out.length, repeats, unmatched, unlisted, intlIn, ambiguous, unplaceable };
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
    // AND LAST, THE PIN LIST. Three logged cards are in no TCGdex url at any
    // extension, so every source above them returns null and the plaque drew a
    // grey "No scan" box: Corviknight V TG18, Victini 208 and Poke Pad 103.
    // data/card-shots.json pins each to the TCGplayer product Tim linked. It is
    // last because it is hand-kept and frozen, and a scan we sync should always
    // win over one somebody typed in; see shared/card-scan.mjs for why an entry
    // can only exist where the TCGdex url was checked and 404'd.
    image: c._img || chase?.imageLarge || chase?.image
      || pinnedShot([setName, c._setName, c.set], c.number)?.image || null,
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
      // NOT THE OWNER'S NAME. This string is PUBLISHED: it lands in
      // public/data/wanted.json and prints in the "PSA 10 prices come from"
      // note on the set pages. It said "Tim" until 24 August 2026, when he
      // asked that his real name not appear anywhere on the site. No card
      // currently uses the manual path, so nothing was rendering it, but a
      // single hand-entered price would have put his name on a live page.
      psaFrom === "manual" ? "a hand-checked sale"
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

/* THE CHANNEL'S HEADLINE COUNTS, READ AND NOT RECOMPUTED.
 *
 * build-proto.mjs owns these and writes data/rip-tally.json; build-all.mjs runs
 * it before this file. THIS PAGE AND /luck.html ONCE PRINTED 140 AND 183 FOR THE
 * SAME QUANTITY, one nav item apart, and the comments a hundred lines up are
 * about that incident. Two files computing one number is how it happened, so
 * this one reads.
 *
 * Empty is a real state and renders no tiles rather than zeros: on a first run,
 * or if the writer is ever moved after this file in the build order, the page
 * loses its widget and keeps its list, which is the honest failure.
 */
/* THE HERO CARD AND THE REST. ranked is already sorted by raw, highest first,
 * so the MVC is simply its head. Promoted OUT rather than copied, so no card is
 * on this page twice and the list's own numbering picks up at 2.
 *
 * A hero needs a picture to be a hero: if the top card has no scan it stays in
 * the list and the frame does not render, which is this page's standing rule for
 * absent data rather than a special case.
 */
/** Thousands separators, the same form every other builder prints. */

const num = (n) => Number(n).toLocaleString("en-US");

let TALLY = null;
try {
  TALLY = JSON.parse(await readFile(join(ROOT, "data/rip-tally.json"), "utf8"));
} catch {
  console.log("  data/rip-tally.json missing, so the stat tiles are skipped. Run scripts/build-proto.mjs.");
}

const ranked = hall
  .map(resolve)
  /* ======================================================================
   * ONE SORT KEY, AND IT IS RAW. Tim, 2026-08-21: "make sure they are all
   * ranked by their RAW value."
   * ======================================================================
   *
   * THE COMMENT THAT STOOD HERE ARGUED THE OTHER WAY AND IS ANSWERED RATHER
   * THAN DELETED, because half of it was right and that half is why this
   * page needs the three changes below rather than only a new comparator.
   *
   * What it said: a card with a graded price is ranked by it and a card
   * without is ranked by raw, "that is the right order, and it looks broken
   * to a stranger", because the raw price is the first and largest number on
   * every plaque and the raw column then runs 175, 14.72, 38.75, 5.99 down
   * the page. Its objection to raw-only ranking was that it "would put a
   * $175 card above a $906 one".
   *
   * WHY THE OBJECTION LOSES, and it is a counting argument rather than a
   * taste one. Measured on the built page at HEAD before this change: 145
   * plaques, 126 carry a raw price and 21 carry a PSA 10. So the old key was
   * ranking the whole page on a figure 14% of it has, and the other 86% were
   * being ordered by a DIFFERENT measure and interleaved with them. Two
   * measures in one column is not a ranking, it is two rankings stacked, and
   * the stranger reading 175, 14.76, 58.00, 14.72 is not misreading the page:
   * they are correctly reading the only column that is on every row.
   *
   * "$175 above $906" IS ALSO NOT A COMPARISON THE PAGE WAS ENTITLED TO
   * MAKE. $906 is what Mega Greninja ex #122 sells for AFTER a grading fee,
   * a two month wait and a 10 nobody has been given yet: nothing on this page
   * is graded, which is the exact argument the tally tiles thirty lines below
   * already make in their own comment ("a pile of raw cards is worth its
   * graded value" is the claim they refuse to make). Ranking on a price
   * conditional on an event that has not happened, against prices that are
   * not, is comparing a hypothetical with a market.
   *
   * AND THE SITE HAD ALREADY MADE THIS CALL EVERYWHERE ELSE. The hit band on
   * every rip page sorts the same cards out of the same data/hits.json, and
   * build-pages.mjs's resolveHits ends on
   *
   *     return out.sort((a, b) => (b.price ?? b.psa10 ?? 0) - (a.price ?? a.psa10 ?? 0));
   *
   * under a comment headed "ORDER BY RAW, NOT BY WHICHEVER NUMBER IS BIGGER"
   * that makes this argument in almost these words and names the same fault:
   * "Oricorio ex at $12.03 raw sat above Marshadow at $14.95 because its PSA
   * 10 was $99.78". So /hall.html was the last page on the site still doing
   * it, and a plaque and that card's own rip page have been disagreeing about
   * which of two cards is the better pull. THE COMPARATOR BELOW IS THAT LINE,
   * deliberately the same shape, so the two cannot drift apart again.
   *
   * THE psa10 FALLBACK IS DEAD TODAY AND IS KEPT ANYWAY. 0 of 145 plaques
   * carry a PSA 10 without a raw price, so it never fires; it exists so that
   * a card whose only figure is a graded one is ranked on the figure it has
   * instead of being dumped in the unpriced tail, and because build-pages.mjs
   * carries it and this comparator is supposed to be that one.
   *
   * THE NAME TIEBREAK IS NOT DECORATION. 19 plaques carry no price at all and
   * every one of them keys 0. Without it their order is whatever
   * Object.entries(hits.json) happened to yield, which changes when a video
   * is re-imported and makes a diff of this page unreadable.
   *
   * WHAT THIS COSTS, AND THE THREE THINGS THAT PAY FOR IT are all in this
   * file: the lede states the key (see below), the PSA 10 tile now names the
   * best graded card and links to its plaque, because raw order no longer
   * floats it to the top, and every plaque that has a PSA 10 keeps printing
   * it. Nothing was hidden to make the column sort.
   */
  .sort((a, b) =>
    (b.raw ?? b.psa10 ?? 0) - (a.raw ?? a.psa10 ?? 0) ||
    String(a.name).localeCompare(String(b.name)));

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
const mvc = ranked.length && ranked[0].image ? ranked[0] : null;
const rest = mvc ? ranked.slice(1) : ranked;
const mvcArt = !mvc
  ? ""
  : (() => {
      const look = artLook(mvc);
      // 600w IS RIGHT HERE AND ONLY HERE. The plaques draw at 120px and dropped
      // the high rung for it; this frame draws the card at 192 to 260 CSS px,
      // which asks for 630 to 780 device pixels at DPR 3. One extra request on
      // the page, not 164.
      const big = String(mvc.image).replace(/\/low\.(webp|avif)$/, "/high.$1");
      return `<button class="mvc-art" type="button"
          data-img="${esc(mvc.image)}" data-name="${esc(mvc.name)}"
          data-set="${esc(mvc.setName || "")}" data-rarity="${esc(mvc.rarity || "")}"
          data-number="${esc(mvc.number || "")}" data-url="${esc(mvc.url || "")}"
          data-raw="${mvc.raw ? esc(moneyCompact(mvc.raw)) : ""}"
          data-psa="${mvc.psa10 ? esc(moneyCompact(mvc.psa10)) : ""}"
          aria-label="Enlarge ${esc(mvc.name)}">${avifPicture(
            `<img src="${esc(big)}" alt="${[esc(mvc.name), esc(mvc.rarity || ""), mvc.setName ? `from Pokemon ${esc(mvc.setName)}` : ""].filter(Boolean).join(" ")}" width="600" height="825">`
          )}</button>`;
    })();

const rawCards = ranked.filter((c) => c.raw);
const totalRaw = rawCards.reduce((n, c) => n + c.raw, 0);
const gradedCards = ranked.filter((c) => c.psa10);
const totalGraded = gradedCards.reduce((n, c) => n + c.psa10, 0);

/* ==========================================================================
 * A PLAQUE NEEDS AN ADDRESS BEFORE ANYTHING CAN POINT AT IT.
 * ==========================================================================
 *
 * NOT `#1`, `#2`, `#3`. The obvious id is the rank, and the rank is the one
 * thing on this page guaranteed to move: it changed for 145 plaques the day
 * the comparator above changed, and it moves again every time a price feed
 * refreshes. An anchor keyed to it would be a link that silently starts
 * landing on a different card, which is the cross-page fault this site keeps
 * having, aimed at itself.
 *
 * SO IT IS THE PRINTING, which is what a plaque IS: one per `<set>-<number>`
 * is the dedupe rule the whole builder is written around, so the same key
 * makes the same address every run and survives a re-rank. A card with no
 * number falls back to its name, and the counter catches the collision that
 * leaves (three plaques share a name today, two Mega Greninja ex and two
 * Mega Gardevoir ex at different numbers, and those all HAVE numbers).
 *
 * AN ADDRESS IS COMPUTED FOR EVERY PLAQUE AND EMITTED ONLY WHERE SOMETHING
 * LINKS TO IT, WHICH IS ONE. Emitting all 145 was the first version and it
 * cost 4,305 bytes raw and 990 GZIPPED, measured on the built page, to publish
 * 144 anchors nothing on the site points at and no reader can discover. This
 * page is 38KB gzipped and a kilobyte of it is 2.6%. The generator stays
 * whole, collision counter included, so the day a second link wants an address
 * it is one word in plaque() and not a new mechanism.
 */
const idSlug = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const idTaken = new Map();
for (const c of ranked) {
  const stem = `card-${idSlug(c.set || "promo")}-${idSlug(c.number || c.name)}`;
  const n = (idTaken.get(stem) || 0) + 1;
  idTaken.set(stem, n);
  c.domId = n === 1 ? stem : `${stem}-${n}`;
}

/* ==========================================================================
 * THE BEST GRADED CARD IS NO LONGER AT THE TOP, SO THE PAGE HAS TO SAY WHERE
 * IT IS. THIS IS THE HALF OF THE OLD SORT COMMENT THAT WAS RIGHT.
 * ==========================================================================
 *
 * Ranking on raw is Tim's call and the argument for it is beside the sort.
 * What that call genuinely costs is the one thing the old key bought: it
 * floated the channel's headline pull, Mega Greninja ex #122 at $906 in a
 * PSA 10, to plaque one, where nobody could miss it. Under raw order it
 * lands wherever $175 lands, and 124 of the 145 plaques print no PSA 10 at
 * all, so a reader scrolling for the biggest number on the site would have to
 * read every row to find it.
 *
 * WHY A LINE OF COPY AND A FLAG ON THE PLAQUE, and not the other three
 * candidates:
 *
 *   - A SECOND ORDER (a graded section above the raw list) reintroduces the
 *     exact fault the sort comment describes: two rankings stacked, and the
 *     rank medallion counting 1..145 through both of them.
 *   - SORT CONTROLS would need JavaScript, a default to argue about, and a
 *     shareable url this page does not have. `.chof-list` is also emitted
 *     with a grid whose last-row spans are computed from ranked.length (see
 *     evenBand), so a client-side re-sort has to keep that in step or orphan
 *     the last row. That is a real feature and it is not this change.
 *   - A FLAG ALONE, with no line at the top, is only found by scrolling,
 *     which is the problem rather than the fix.
 *
 * So: ONE SENTENCE where the reader already is, in the head block under the
 * tally, carrying the figure and a link; and a MARK on the plaque itself so
 * that arriving there explains itself and so that somebody who scrolls past
 * the sentence still meets the card. The sentence is computed, never typed,
 * and it names the rank it is sending you to, so a reader can tell before
 * tapping that the page has not hidden anything.
 *
 * IT IS NOT GOLD. Gold on this site means "the biggest card the channel has
 * ever pulled" and Tim confined it to three places written as literal hexes
 * (see CLAUDE.md): the HALL OF FAME HIT badge, the trophy frame, and this
 * page's rank medallion. A fourth gold thing would spend the one semantic
 * colour the palette has on a second meaning. The flag is the SMALL PINK
 * instead, which is already what a PSA 10 figure is painted in in
 * `.chof-prices .psa dd`, so the mark and the number it points at are the same
 * colour. --ketchup-deep and not --ketchup: 11px mono is nowhere near WCAG's
 * large-text line and #E87EA1 measures 3.45:1, which is the whole reason `.hl`
 * exists.
 *
 * THE LINK IS --sky-deep AND NOT --sky, for the reason the `.chof-see` note at
 * the foot of the style block gives: main.chofpage carries a gold radial bloom
 * at 50% 0%, and this sentence sits nearer the centre of it than anything else
 * on the page. --sky was measured UNDER AA on the first four plaques, which
 * have less bloom over them than this line does. Underlined as well as
 * coloured, because it is one link inside a run of prose and colour alone is
 * the failure WCAG 1.4.1 names.
 *
 * ==========================================================================
 * MEASURED OFF RENDERED PIXELS, headless Chrome over CDP, 2026-08-21.
 * ==========================================================================
 *
 * Glyphs hidden, the element's own box screenshotted and averaged. Compositing
 * the background-color chain by hand gives the wrong answer here and CLAUDE.md
 * says why: the bloom is a background-IMAGE over a TRANSPARENT
 * background-color, so a walk up the ancestors cannot see it at all.
 *
 *       390 DPR 3    .chof-best 7.71:1   .chof-best a 5.90:1   .chof-flag 4.94:1
 *      1440 DPR 2    .chof-best 7.55:1   .chof-best a 5.46:1   .chof-flag 5.20:1
 *
 * CLS 0 at both widths, scrolled end to end so every lazy plaque image lands.
 *
 * THE FIRST READING OF THE LINK WAS 4.24:1 AND WAS A HARNESS FAULT, written
 * down because the next person measuring an inline link on this site will hit
 * it. At 390 the link WRAPS, so getBoundingClientRect returns the UNION of
 * both line boxes, and that union also covers this paragraph's own near-white
 * text. Hiding only the link's own glyphs left those in the sample and
 * averaged them into the "ground", making it 45% lighter than it is. Hide the
 * block container too, or sample one client rect rather than the union.
 *
 * THE THREE PARAGRAPHS ABOVE ARE HERE RATHER THAN BESIDE THE RULES THEY
 * DESCRIBE BECAUSE THIS PAGE'S <style> SHIPS ITS COMMENTS. Only
 * assets-source/ui.css is stripped by build-css.mjs; the block at the foot of
 * this file is emitted into the HTML verbatim, comments and all, which is what
 * the `.chof-look` note means by "this block ships to the browser; that one
 * does not". So the CSS keeps the measured numbers, which are worth their
 * bytes to whoever reads the built page, and the argument lives here, which
 * costs nothing.
 */
const bestGraded = gradedCards.reduce((best, c) => (!best || c.psa10 > best.psa10 ? c : best), null);
const bestGradedRank = bestGraded ? ranked.indexOf(bestGraded) + 1 : 0;
// TWO SENTENCES, because the interesting one stops being true the day the best
// graded card is also the best raw one. Claiming "the biggest number is not at
// the top" while it sits at plaque one would be the page contradicting itself
// in its own first screen, and that is not a hypothetical: the two are one
// place apart today. Same rule as `scopeSentence` below, which falls back to
// saying less rather than saying something the arithmetic no longer supports.
const bestGradedLine = !bestGraded ? "" : (() => {
  const link = `<a href="#${esc(bestGraded.domId)}">${esc(bestGraded.name)}</a>`;
  const from = bestGraded.setName ? ` out of ${esc(bestGraded.setName)}` : "";
  const money = moneyCompact(bestGraded.psa10);
  return bestGradedRank === 1
    ? `<p class="chof-best">The best graded card here is the best raw one too: ${link}${from}, ${money} in a PSA 10.</p>`
    : `<p class="chof-best">The biggest number on this page is not at the top of it. The best graded card is ${link}${from}, ${money} in a PSA 10, and raw order puts it at ${bestGradedRank}.</p>`;
})();

/* ------------------------------------------------ what this page ACTUALLY is
 *
 * "NOTHING HERE WAS HAND PICKED: THIS IS THE WHOLE LIST OF WHAT WAS PULLED ON
 * CAMERA" WAS FALSE ON A PAGE IN THE MAIN NAV, AND THE PAGE BESIDE IT SAID SO.
 *
 * /luck.html prints "183 cards the log records" off exactly the same
 * data/hits.json this file reads. This page printed 140 under a lede promising
 * completeness twice, so two pages one nav item apart disagreed by 43 about the
 * one fact the whole site is built on. That is the top-severity failure here:
 * the site's claim is that its numbers are sourced and agree.
 *
 * BOTH ENDS WERE LOOKED AT AND ONLY ONE OF THEM IS WRONG. The omission is right
 * and is argued in three places in this file already:
 *   - 33 rows are a printing already on this page, PULLED AGAIN. One plaque per
 *     printing is the model, and a hall of fame that lists the same card twice
 *     is worse, not more complete.
 *   - 10 rows name a card that is not on any checklist this site holds. The
 *     comment above the `unmatched` drop says why publishing them anyway would
 *     be worse: it prints a card name no catalog holds. That is a spreadsheet
 *     fix, the build names every one of them on every run, and it is NOT this
 *     page's job to paper over it.
 * So the CLAIM is the defect. The page states its own arithmetic now, computed
 * from the ledger and never typed, so it reconciles with /luck.html by
 * subtraction that a reader can follow: read = plaques + repeats + held back.
 *
 * IF THE ARITHMETIC EVER STOPS ADDING UP, SAY LESS RATHER THAN SAYING IT WRONG.
 * `scopeSentence` falls back to naming only what is on the page when the three
 * numbers do not reconcile, which is the same rule as "absent beats wrong"
 * everywhere else in this builder.
 */
const L = hitsLedger;
const heldBack = L ? L.unmatched.length + L.unplaceable.length : 0;
const scopeSentence = (() => {
  if (!derivedFromHits || !L) return "";
  const reconciles = L.rowsRead === ranked.length + L.repeats + heldBack;
  if (!reconciles) {
    return " Nothing here was hand picked: it is one plaque per printing, straight out of the rip log.";
  }
  // SHORT ENOUGH TO READ, because this is the first thing on the page and a
  // phone gives it the whole screen. The first draft ran ten lines at 390 and
  // pushed the top plaque below the fold, which is a page that explains itself
  // instead of showing you the cards. Every number in it is still computed.
  const parts = [];
  if (L.repeats) parts.push(`${L.repeats} of them a printing already on this page, pulled again`);
  if (heldBack) parts.push(`${heldBack} carrying a name no catalog we hold can match`);
  if (!parts.length) return ` Nothing here was hand picked: all ${L.rowsRead} cards the rip log records are below.`;
  return " Nothing here was hand picked, and it is one plaque per printing:" +
    ` the rip log records ${L.rowsRead} cards, ${parts.join(", and ")}, which leaves the ${ranked.length} below.`;
})();
/* The tally tile said "Cards pulled" over a deduplicated count, which is the
   same phrase /luck.html counts row-wise. It names what it is counting now, and
   against what, in the "X of Y" shape the two tiles beside it already use. */
const tallyLabel = derivedFromHits && L
  ? `Printings of ${L.rowsRead} pulls`
  : "Cards inducted";

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
 * ===========================================================================
 * AND "ONLY A 3x PHONE" WAS THE WHOLE BUG, 21 August 2026.
 * ===========================================================================
 *
 * That sentence reads like a rounding error and it was the entire page. This
 * site is read on a phone in a restock line, and the phone in that line is a
 * DPR 3 one. A 120px box at DPR 3 asks for 360 device pixels, 360 clears 245,
 * so EVERY plaque took high.avif: measured at 390x844 DPR 3, Slow 4G, 4x CPU,
 * over HTTP/2, cache off, this page moved 4,524KB fully scrolled with 79 scans
 * on it, two of them 88KB and 134KB for a thumbnail.
 *
 * NOTE HOW LITTLE MARGIN THE 2x ROW HAD, because it is the reason the fix is
 * the rung and not a smaller number in `sizes`. 120 x 2 = 240 against a 245w
 * candidate: FIVE PIXELS. Any future box wider than 122px fires this on the far
 * more common DPR 2 as well, and nothing in the CSS would look wrong.
 *
 * SO THE 600w RUNG COMES OFF THIS PLACEMENT. low.webp is the only candidate a
 * plaque offers now, which is 245 into a 120px box: 2.04x, above the 2x this
 * whole site targets and 32% short of a 3x screen's ideal. Measured before and
 * after with one harness at 390x844 DPR 3 on the same tree, medians of 3.
 *
 * DO NOT QUOTE sync-card-thumbs.mjs's "245w IS VISIBLY SOFT" AT THIS. That
 * rejection is real and it is about a 302px box on /wanted.html, where 245w is
 * 0.81x and lands BELOW one device pixel per CSS pixel. Here the same file is
 * 2.04x. The ratio is the fact; the filename is not.
 *
 * THE 360w MIRROR WAS THE OTHER OPTION AND IT WAS REJECTED ON THE ARITHMETIC.
 * sync-card-thumbs.mjs could encode a 360w rendition of all 79 and make DPR 3
 * exact. Its own header records that Pillow only ever beats TCGdex by dropping
 * pixels, never at equal width, and a 360w local AVIF interpolates from the
 * measured 310w and 420w pair at around 55KB against TCGdex's 36 to 112KB
 * high.avif. That is 158 committed binaries to save a fraction of what taking
 * the rung off saves outright, on a page that already hands the reader the full
 * 600px scan on a tap.
 *
 * THE LIGHTBOX STILL OPENS THE HIGH ONE, and that is now load bearing rather
 * than a nicety. `data-img` below is deliberately left on c.image, because the
 * enlargement is the one place on this page where 600px is the right amount of
 * detail, and it is the reader's route to it.
 *
 * NO srcset AND NO sizes ON THE TCGDEX BRANCH ANY MORE. One candidate is a
 * `src`, and a one-entry srcset with a `sizes` beside it is a decision waiting
 * to be misread as a live ladder. avifPicture() reads the `src` when there is
 * no srcset, so the AVIF source survives untouched.
 */
const TCGDEX_HIGH = /^(https:\/\/assets\.tcgdex\.net\/.+)\/high\.webp$/;
// THE OTHER FAMILY OF SCANS THIS PAGE CAN NOW SHOW, and it is on our own disk
// rather than on TCGdex. The three First Partner promos come out of
// data/first-partner.json, which stores a 420w and a 245w rendition of each
// (build-first-partner.mjs writes both). Same split as the TCGdex branch:
// the small file is the src for a 120px box, the large one is the srcset's top
// candidate and is what the lightbox enlarges.
//
// THE 420w RUNG STAYS HERE WHILE THE TCGDEX 600w ONE GOES, AND THAT IS A
// DECISION RATHER THAN A PLACE THE SWEEP STOPPED. Three plaques on this grid
// take it. It is the honest DPR 3 answer for a 120px box, 420 against the 360
// asked for, where TCGdex's next rung up is 600 and 67% over; it is on OUR
// origin, so it costs no second DNS and TLS handshake and rides the connection
// the page already has; and at 47.7KB it is twice the 245w file rather than
// three to five times it. The inconsistency a reader could in principle see is
// between what the two HOSTS publish, not between two decisions. If a later
// pass wants all 79 plaques at one density, drop this rung too and re-measure;
// do not add a 600w one back to the branch above to match it.
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
    return { src: low, extra: "", dims: "" };
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
  // TCGPLAYER'S CDN SERVES TWO SIZES OFF ONE ID and the pin list stores the
  // large one, so the thumbnail is derived rather than stored twice. 13-29KB
  // against 135-170KB, both measured 23 Aug 2026. No width or height: that host
  // pads to a fixed canvas and the plaque's own aspect-ratio rule owns the box.
  const tcg = /^(https:\/\/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+)_in_1000x1000\.jpg$/.exec(url || "");
  if (tcg) return { src: `${tcg[1]}_200w.jpg`, extra: "", dims: "" };
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
    // THE BOX HELD THE CARD'S NAME UNTIL 22 AUGUST 2026 AND ui.css HAD ALREADY
    // WRITTEN DOWN WHY THAT IS WRONG. `.set-noart`, the five set tiles with no
    // logo file, took the same treatment and reversed it: "The slot used to be
    // filled with the set's NAME, which the <b> underneath already prints, so
    // those five tiles showed the same words twice and looked broken rather
    // than degraded." `.chof-name` prints this card's name two lines down, so
    // this plaque was the last place on the site still printing it twice.
    // It is the set's own symbol and the words "No scan" now, on the same hatch
    // the hit cards and the `mine` tiles use, and the whole box is aria-hidden
    // because the plaque already announces the name, the set and the rarity.
    // Nine of the fourteen are Japanese sets we hold no symbol for and get the
    // words alone; the argument for all of it is in shared/card-scan.mjs.
    : noScanBox("chof-noart", { slug: c.set, name: c.setName });
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
  // THE ADDRESS, ON THE ONE PLAQUE SOMETHING LINKS TO. It is the printing
  // rather than the rank: see the idSlug block above for why an anchor keyed to
  // `rank` would rot on the next price refresh, and for what emitting all 145
  // of them measured.
  const addr = c === bestGraded ? ` id="${esc(c.domId)}"` : "";
  return `      <li class="chof${top}"${addr}>
        <span class="chof-rank">${rank}</span>
        ${frame}
        ${look ? `<p class="chof-look">${esc(look)}</p>` : ""}
        <div class="chof-body">
          ${/* THE FLAG THE LINE AT THE TOP IS POINTING AT. It is emitted ABOVE
                the name so a screen reader hears why this plaque is special
                before it hears which card it is, and so the sighted reader who
                followed the anchor lands on the explanation rather than having
                to look for the pink number four lines down. One per page by
                construction: `bestGraded` is a single object out of `ranked`
                and this is an identity test, so a tie on the figure cannot
                flag two plaques. */ ""}
          ${c === bestGraded ? `<span class="chof-flag">Best PSA 10 on this page</span>` : ""}
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

/**
 * A GRID THAT CANNOT ORPHAN, WRITTEN IN THE ONLY PLACE THAT KNOWS THE COUNT.
 *
 * Measured before this went in, headless Chrome over CDP, DPR 1, the plaque
 * count 103: the last row held ONE plaque at every width above 620 and the
 * band beside it was dead track.
 *
 *       viewport   columns   last row   dead track
 *          621         2          1        298.50px
 *          768         2          1        368.00px
 *         1080         2          1        524.00px
 *         1081         3          1        699.34px
 *         1440         3          1        938.67px   67.4% of the row
 *         1920         3          1        978.67px
 *
 * The rightmost PAINTED pixel is what makes that a defect rather than a wide
 * box: plaque 103 inks to 477.33 at 1440 and the grid box ends at 1416, so the
 * 938.67px is genuinely uninked and not a card quietly filling its track. Rows
 * 1 to 34 ink to the full 1416 and are left exactly as they are.
 *
 * 103 IS PRIME, so there is no column count above 1 that divides it and the
 * "step down to a divisor" answer /lore.html takes is not available here. The
 * remainder gets the row instead: with r plaques left over in a c wide grid,
 * declare lcm(c, r) tracks, span a normal plaque lcm/c of them and the last r
 * plaques lcm/r each. At r = 1 that is exactly grid-column:1/-1.
 *
 * IT IS A NO-OP ON EVERY FULL ROW AND THAT IS ARITHMETIC, NOT LUCK. With N
 * tracks, gap g and a span of s = N/c, an item measures
 *   s*(W - (N-1)g)/N + (s-1)g  =  (W - (c-1)g)/c
 * which is the width a plain repeat(c,1fr) gives. So 320, 390 and every row
 * but the last are unchanged to the pixel. Verified after: identical.
 *
 * DO NOT PIN IT TO 103. The Hall grows with every rip, and a rule keyed to
 * today's count rots the next time a card is flagged. The count comes from
 * ranked.length below, so the emitted CSS follows the data.
 */
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const evenBand = (sel, n, c) => {
  const r = n % c;
  if (r === 0 || n <= c) return `${sel}{grid-template-columns:repeat(${c},1fr)}`;
  const N = (c * r) / gcd(c, r);
  return `${sel}{grid-template-columns:repeat(${N},1fr)}\n` +
    // span 1 is what a track already does, so it is only worth its bytes when
    // the lcm actually multiplied the track count.
    (N === c ? "" : `${sel}>li{grid-column:span ${N / c}}\n`) +
    `${sel}>li:nth-last-child(-n+${r}){grid-column:span ${N / r}}`;
};

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
/* ------------------------------------------------------------------ MVC ---
   THE GOLD IS COPIED FROM .hofx, .hofx-tag AND .chof-rank, byte for byte, and
   NOT mixed fresh. CLAUDE.md rations gold to one meaning, "the biggest card the
   channel has ever pulled", and keeps it as literal hexes so a token edit cannot
   leak it back into the palette. Nothing here reads var(--gold): that token is a
   teal. The animated sheen .hofx carries is deliberately left off, so there is
   no motion to gate under prefers-reduced-motion. */
.mvc{position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s4);
  align-items:center;text-align:center;margin:0 auto var(--s6);max-width:520px;
  padding:var(--s6) var(--s4) var(--s5);
  background:radial-gradient(120% 140% at 12% 0%,rgba(232,185,58,.20) 0%,rgba(232,185,58,0) 58%),
    linear-gradient(135deg,#3A3A3A 0%,#212121 55%,#121212 100%);
  border:4px solid #FFB000;border-radius:16px;
  box-shadow:inset 0 0 0 2px rgba(17,17,17,.6),inset 0 0 0 5px rgba(232,185,58,.5),
    0 0 34px rgba(232,185,58,.22),0 16px 44px rgba(17,17,17,.46)}
/* left:52px, NOT --s4: the rank medallion hangs at left:-10px and is 40px wide,
   so at 16px the ribbon sat under it. 52 leaves a 22px gap and the ribbon still
   ends well inside the frame at 350px. */
.mvc-tag{position:absolute;top:-16px;left:52px;z-index:2;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;
  color:var(--on-accent);background:linear-gradient(180deg,#FFD23F,#FFB000);
  border:2px solid #FFDF7A;border-radius:var(--r-pill);padding:8px 14px;
  box-shadow:0 3px 0 #FFDF7A,0 8px 18px rgba(17,17,17,.35)}
.mvc-rank{position:absolute;left:-10px;top:-10px;z-index:3;width:40px;height:40px;
  border-radius:50%;display:grid;place-items:center;font:400 1.2rem/1 var(--display);
  color:var(--on-accent);background:linear-gradient(180deg,#FFD23F,#FFB000);
  box-shadow:0 2px 6px rgba(0,0,0,.5)}
.mvc-art{position:relative;width:min(62%,210px);margin:0 auto;padding:0;border:0;
  background:none;cursor:zoom-in;line-height:0}
.mvc-art::before{content:"";position:absolute;inset:-14%;border-radius:50%;
  background:radial-gradient(circle,rgba(232,185,58,.42) 0%,rgba(232,185,58,0) 70%)}
.mvc-art img{position:relative;display:block;width:100%;height:auto;border-radius:10px;
  box-shadow:0 8px 22px rgba(0,0,0,.45)}
.mvc-b{display:flex;flex-direction:column;gap:var(--s2);min-width:0}
.mvc-nm{font:400 var(--t-l)/1.1 var(--display);color:var(--chrome-ink);
  text-shadow:0 2px 0 rgba(0,0,0,.35)}
.mvc-set{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--chrome-dim)}
.mvc-pr{display:flex;justify-content:center;gap:var(--s5);margin:var(--s3) 0 0}
.mvc-pr dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--chrome-dim)}
.mvc-pr dd{font:400 1.5rem/1 var(--display);color:var(--ketchup-deep);margin:0}
.mvc-pr i{font-style:normal}
.mvc-see{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  align-self:center;margin-top:var(--s3);min-height:44px;text-decoration:none;
  font:700 var(--t-sm)/1 var(--body);color:var(--on-accent);background:var(--mustard);
  border:2px solid var(--chrome-ink);border-radius:var(--r-pill);padding:11px 18px}
@media(min-width:621px){
  .mvc{grid-template-columns:minmax(0,34%) minmax(0,1fr);text-align:left;gap:var(--s5);
    padding:var(--s6) var(--s5) var(--s5);max-width:760px}
  .mvc-art{width:100%;max-width:260px;margin:0}
  .mvc-pr{justify-content:flex-start}
  .mvc-see{align-self:flex-start}
}
@media(min-width:1081px){
  .mvc{max-width:820px;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:var(--s6)}
}
/* The rate line under the tiles: the figure is a mark and goes nowhere, so it is
   pink; the link is a route, so it is teal. 400 weight on the b, because 700
   here would be a font weight this page does not already load. */
.chof-rate{margin-top:var(--s3);font:400 var(--t-sm)/1.6 var(--body);color:var(--foot-ink)}
.chof-rate b{font-weight:400;color:var(--ketchup-deep)}
.chof-rate a{color:var(--sky-deep)}
/* The counting rule, closed. Native <details>, no script. */
.chof-how{max-width:44em;margin:0 auto var(--s6);text-align:left}
.chof-how summary{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;
  list-style:none;font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--sky-deep)}
.chof-how summary::-webkit-details-marker{display:none}
.chof-how summary::after{content:"+";font:400 1rem/1 var(--display)}
.chof-how[open] summary::after{content:"−"}
.chof-how p{font:400 var(--t-sm)/1.6 var(--body);color:var(--foot-ink);margin-top:var(--s2)}
/* Two by two on a phone rather than a 253px stack of three. */
@media(max-width:620px){
  .chof-tally{gap:var(--s2)}
  .chof-tally div{flex:1 1 calc(50% - var(--s2));min-width:0}
  .chof-tally b{font-size:1.35rem}
}
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
/* Where the best graded card is: --sky-deep, not --sky, because the bloom.
   7.71:1 / 5.90:1 at 390 DPR 3, 7.55:1 / 5.46:1 at 1440 DPR 2, off rendered
   pixels. The argument and the harness note are beside bestGradedLine. */
.chof-best{margin-top:var(--s4);font:400 var(--t-sm)/1.6 var(--body);color:var(--foot-ink)}
.chof-best a{color:var(--sky-deep);text-decoration:underline;text-underline-offset:2px}

/* Generated from the plaque count: see evenBand in scripts/build-hall.mjs.
   The bands are mutually exclusive because the spans are keyed to a column
   count and one leaking out of its band invents an implicit column. */
.chof-list{list-style:none;display:grid;gap:var(--s5) var(--s4);counter-reset:chof}
@media(max-width:620px){.chof-list{gap:var(--s4)}
${evenBand(".chof-list", ranked.length, 1)}}
@media(min-width:621px) and (max-width:1080px){
${evenBand(".chof-list", ranked.length, 2)}}
@media(min-width:1081px){
${evenBand(".chof-list", ranked.length, 3)}}
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
/* THE BOX, AND NOTHING ELSE. This rule used to centre the card's NAME in
   var(--display) on a flat var(--paper-3), which is the treatment .set-noart in
   ui.css reversed for the reason quoted beside plaque(): the name is printed
   two lines below and twice looked broken. Everything except the ratio moved to
   .chof-noart.noscan in shared/card-scan.mjs, so this page, the hit cards and
   the set guides' own tiles now paint one panel and cannot drift into three.
   The ratio stays here: it holds the plaque's shape whatever is in it.

   NO BACKTICKS IN THIS BLOCK. It sits inside a template literal, and the one
   that was here took the build down on the first run. */
.chof-noart{aspect-ratio:245/337}
.chof-body{min-width:0;flex:1}
.chof-name{font:600 var(--t-body)/1.25 var(--body);display:block}
.chof-set,.chof-rar,.chof-pulled{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.03em;color:var(--chrome-dim)}
/* --lilac is a TEAL now (it equals --sky). A rarity label is a mark, not a route. */
.chof-rar{color:var(--plum)}
/* The one flagged plaque. SMALL pink, not gold: see plaque() in the builder.
   4.94:1 at 390 DPR 3, 5.20:1 at 1440 DPR 2, off rendered pixels, on the worst
   ground it can land on (the podium gold tint under the page bloom). */
.chof-flag{display:block;margin-bottom:var(--s2);font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ketchup-deep)}
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
      ${/* "EVERY CARD THAT HAS COME OUT OF A PACK" IS THE OTHER HALF OF THE
            SAME OVERCLAIM and it went in the same edit. The scope is stated
            once, in scopeSentence above, computed from the build's own ledger.
            Do not put a completeness promise back in this opening clause: it
            would then be making a claim the sentence after it has to walk
            back. */ ""}
      ${/* THE LEDE NAMES THE KEY, WHICH IS THE SAME OBLIGATION IT HAD BEFORE
            AND A DIFFERENT KEY. It used to read "ranked by their PSA 10 price
            where we have one and by their raw price where we do not", which
            was an honest description of a two-key sort. There is one key now,
            so this says so in one clause instead of two, and says which
            number on the plaque it is: "raw" is a word, "Raw NM" is the
            label the reader is about to see 145 times, and a lede that names
            the key without naming the column has not actually told anybody
            anything. Do not soften it back to "by what it is worth": that
            phrasing names no key at all and is what this page carried for
            months while its own column looked unsorted. */ ""}
      ${/* THE LEDE OPENED WITH METHODOLOGY AND TIM SAID SO. It ran 394
            characters and NINE LINES at 390px, so the whole first screen of a
            page of best pulls was prose and the first card started at y=807.
            It explained deduplication before it said what the page is.

            144 characters now, four lines at 390 and two above it. Nothing is
            deleted: "ranked on the Raw NM price" was already the first line of
            .chof-note at the foot, so the lede was the SECOND copy of it, and
            scopeSentence moves into the disclosure under the hero where "why
            isn't the card I watched here" actually gets asked. */ ""}
      <p>Every hit this channel has pulled on camera, most expensive first. Nothing hand picked,
        straight out of the 585. Tap a card to see it full size.</p>
      ${/* FOUR CHANNEL FACTS, NOT PAGE BOOKKEEPING. The first tile used to
            read "164 / Printings of 211 pulls" and Tim said in as many words
            that he did not know what it was. "Printing" is a word only this
            builder uses. The two money tiles beside it were sums over subsets
            nobody owns -- "$914 raw on 146 of 164" -- printed twenty-two pixels
            above a sentence naming a single $919 card, so the page's headline
            aggregate was smaller than one of its own rows.

            Left to right these make a sentence: 462 packs across 321 videos,
            156 of them hit, 214 cards came out. Nobody has to know what a
            printing is, and every one is a fact about the CHANNEL rather than
            about this page's deduplication.

            "RIPS THAT HIT" IS RIPS AND "CARDS PULLED" IS CARDS. 156 and 214 are
            different quantities and the rate below divides into the first. That
            distinction is the one thing the old copy got right and it is why
            the labels say which is which. */ ""}
      ${TALLY ? `<div class="chof-tally">
        <div><b>${num(TALLY.packs)}</b><span>Packs ripped</span></div>
        <div><b>${num(TALLY.rips)}</b><span>Rips filmed</span></div>
        <div><b>${num(TALLY.ripsWithHit)}</b><span>Rips that hit</span></div>
        <div><b>${num(TALLY.cards)}</b><span>Cards pulled</span></div>
      </div>
      ${TALLY.hitRate ? `<p class="chof-rate">That is a <b>${esc(TALLY.hitRate)}</b> hit rate. <a href="/luck.html">See it broken down by set and product</a>.</p>` : ""}` : ""}
      ${/* WHERE THE BIGGEST GRADED NUMBER WENT. Computed above, never typed;
            the full argument for a line of copy rather than a second sort
            order is beside `bestGraded`. It sits AFTER the tally because the
            tile immediately above it is the one that says "PSA 10 on 21 of
            145", so the sentence reads as that tile's footnote, which is what
            it is. It renders nothing at all when no plaque carries a graded
            price, which is the standing pattern on this page for absent
            data. */ ""}
    </div>

    ${/* THE MVC. Tim: "lets pull out the #1 most valuable card and put it in a
          gold frame at the top as the MVC most valuable card, something to make
          it special and stand out."

          IT IS PROMOTED OUT OF THE LIST, NOT COPIED. The list below starts at 2
          and the hero carries the 1 medallion itself, so there is no duplicate,
          no second sort order and no card that appears twice. Without the
          medallion a list starting at 2 reads as an off-by-one bug.

          THE GOLD IS BORROWED, NOT INVENTED. CLAUDE.md rations it: gold means
          "the biggest card the channel has ever pulled" and survives in exactly
          three places, all written as literal hexes so no token edit can leak it
          back. This is the truest use of it there is, so every value here is
          copied from .hofx, .hofx-tag and .chof-rank rather than mixed fresh.
          Nothing reads var(--gold): that token is a TEAL.

          THE PRICES STAY PINK. The frame carries the gold and already says
          "biggest card"; painting the number gold spends the semantic twice.

          AND IT ONLY BECAME THE RIGHT CARD AN HOUR AGO. Until the collector
          number started beating the rarity word, ranked[0] was Mega Greninja ex
          at $173 and this frame would have gone round the channel's THIRD best
          pull. */ ""}
    ${/* THE ANCHOR THE LEDE POINTS AT HAS TO EXIST HERE TOO.
          `bestGradedLine` above links to `#${bestGraded.domId}`, and the only
          place that id was emitted is the plaque loop below. When the best
          graded card is ALSO rank 1 it gets lifted out of that loop into this
          frame, the list starts at chof-2, and the link at the top of the page
          went nowhere -- which is today's state and is why hall.html shipped a
          dead in-page anchor. The plaque branch carries the same identity test,
          so exactly one of the two can ever fire. */ ""}
    ${mvc ? `<div class="mvc"${mvc === bestGraded ? ` id="${esc(mvc.domId)}"` : ""}>
      <span class="mvc-rank">1</span>
      <span class="mvc-tag">MVC &middot; Most valuable card</span>
      ${mvcArt}
      <div class="mvc-b">
        <b class="mvc-nm">${esc(mvc.name)}</b>
        <span class="mvc-set">${esc(mvc.setName || "")}${mvc.number ? ` &bull; #${esc(mvc.number)}` : ""}${mvc.rarity ? ` &bull; ${esc(mvc.rarity)}` : ""}</span>
        <dl class="mvc-pr">
          ${mvc.raw ? `<div><dt>Raw NM</dt><dd>${esc(moneyCompact(mvc.raw))}</dd></div>` : ""}
          ${mvc.psa10 ? `<div><dt>PSA 10${mvc.psa10AsOf ? ` <i>${esc(shortDate(mvc.psa10AsOf))}</i>` : ""}</dt><dd>${esc(moneyCompact(mvc.psa10))}</dd></div>` : ""}
        </dl>
        ${mvc.rip ? `<a class="mvc-see" href="/${esc(mvc.rip.path)}">See it pulled <span aria-hidden="true">&rarr;</span></a>` : ""}
      </div>
    </div>` : ""}

    ${/* THE BEST GRADED CARD, UNDER THE HERO RATHER THAN ABOVE IT. It renders
          only when the top graded card is NOT the top raw card, which is the
          branch it has always had, and today it fires: Mega Dragonite ex leads
          on raw and Mega Charizard Y ex leads on PSA 10. Above the frame it
          explained the ranking to somebody who had not seen the ranking yet;
          under it, it reads as the footnote to the gold that it is. */ ""}
    ${bestGradedLine}

    ${/* THE COUNTING RULE, MOVED RATHER THAN DELETED. It was the back half of
          the lede, where it explained deduplication to somebody who had not yet
          been told what the page was. Closed by default, native <details>, no
          script. This is where "why isn't the card I watched here" gets asked,
          so this is where the answer belongs. */ ""}
    ${scopeSentence ? `<details class="chof-how">
      <summary>How this list is counted</summary>
      <p>${scopeSentence.replace(/^\s*/, "")}</p>
    </details>` : ""}

    ${ranked.length
      ? `<ol class="chof-list">
${rest.map((c, i) => plaque(c, i + 1)).join("\n")}
    </ol>`
      : `<p class="chof-empty">No cards inducted yet. Flag a card as <b>Card Hall of Fame</b> on the
         Chase Cards tab of the video log and it appears here, ranked automatically.</p>`}

    ${/* THE METHOD NOTE AND THE LEDE HAVE TO NAME THE SAME KEY. This said
          "RANKED BY PSA 10 WHERE THERE IS ONE, AND BY RAW NEAR MINT
          OTHERWISE" and would have been the last sentence on the page still
          describing the old comparator, which is exactly how a page comes to
          contradict itself. It carries the extra fact the lede has no room
          for: the graded figure is printed but is not the key. */ ""}
    <p class="chof-note">RANKED ON RAW NEAR MINT, HIGHEST TO LOWEST. A PSA 10 IS PRINTED WHEREVER WE
      HAVE ONE AND IS NOT WHAT THE ORDER IS BUILT ON: NOTHING HERE IS GRADED.
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
    // "RANKED BY VALUE" NAMED NO KEY, which is the same fault the lede had.
    // The description is the one line a stranger reads before deciding to
    // click, so it says which of the two prices the order is built on.
    `<meta name="description" content="The best Pokemon cards ever pulled on Garbage Rips 585, ranked on raw near mint price, with PSA 10 market values where we have them.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/hall.html">`)
  .replace(/(<meta property="og:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-hall.jpg`)
  .replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-hall.jpg`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/hall.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1Card Hall of Fame | Garbage Rips 585`);

await writeFile(
  join(ROOT, "public/hall.html"),
  dropUnusedPacksCSS(`<!DOCTYPE html>
<html lang="en">
${/* THE NO-SCAN PANEL'S RULES RIDE WITH THE PANEL AND ONLY WITH IT. They are
      render-blocking bytes, so they go in on the page that emitted a box and
      nowhere else -- the same gate build-pages.mjs and the two set-guide
      builders apply. Today every run emits some, and a run where none is
      emitted must not ship the rules for nothing. */ ""}<head>${swapped}<style>${style}${ranked.some((c) => !c.image) ? NOSCAN_CSS : ""}</style>
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
`)
);

console.log(`Wrote public/hall.html
  cards inducted   ${ranked.length}
  with PSA 10      ${ranked.filter((c) => c.psa10).length}${psaSources.length ? `  (${psaSources.join(", ")})` : ""}
  with a raw price ${ranked.filter((c) => c.raw).length}
  with card art    ${ranked.filter((c) => c.image).length}${hitsLedger?.intlIn.filter((x) => x.art === "corpus").length ? `  (${hitsLedger.intlIn.filter((x) => x.art === "corpus").length} of them out of public/data/printings, which the intl checklist has no scan for)` : ""}
  ranked on        raw near mint, ${ranked.filter((c) => c.raw).length} of ${ranked.length} carry one${bestGraded ? `; best PSA 10 is ${bestGraded.name} at ${moneyCompact(bestGraded.psa10)}, plaque ${bestGradedRank}` : ""}
  rarities         ${[...new Set(ranked.map((c) => c.rarity).filter(Boolean))].sort().join(", ")}
`);
// WHAT HAPPENED TO EVERY ROW, because the lede on this page describes its own
// scope by subtraction and nothing else is checking that arithmetic.
// THIS SAID "ALL 93 ROWS" AND THE LOG HOLDS 183. A row count written into a
// comment goes stale on the next import, silently, which is the same failure
// the page itself just had. It is not written down here any more; the run
// prints it.
//
// Eleven rows used to leave without a word: seven on a promo with no price,
// three on a set whose checklist this builder could not open, one on a card
// name that is not on the checklist it CAN open. Three of the four were fixed
// and the fourth is a typo in the spreadsheet, which is not this file's to
// correct. What is this file's job is saying so on every run, so the next
// silent drop is loud on the day it appears rather than in the next audit.
if (hitsLedger) {
  const l = hitsLedger;
  console.log(`  from data/hits.json: ${l.rowsRead} row${l.rowsRead === 1 ? "" : "s"} read, ${l.inducted} card${l.inducted === 1 ? "" : "s"} inducted, ${l.repeats} a printing already on the page`);
  // THE SUBTRACTION THE PAGE PRINTS, CHECKED ON EVERY RUN. The lede states
  // read = plaques + repeats + held back, so if that ever stops holding the
  // page falls back to a shorter sentence and this line says why.
  for (const x of l.unplaceable) {
    console.log(`  DROPPED ${x.card}${x.rarity ? ` (${x.rarity})` : ""} on ${x.vid}: the rip log gives it no set, no number and no price, so there is nothing to put on a plaque but the name. Fill the Set cell in the My Hits tab and re-import.`);
  }
  if (l.rowsRead !== l.inducted + l.repeats + l.unmatched.length + l.unplaceable.length) {
    console.log(`  LEDGER DOES NOT RECONCILE: ${l.rowsRead} read against ${l.inducted} + ${l.repeats} + ${l.unmatched.length} + ${l.unplaceable.length}. The lede has fallen back to naming only what is on the page.`);
  }
  for (const x of l.intlIn) {
    const art =
      x.art === "guide" ? "with that checklist's own scan"
      : x.art === "corpus" ? "which holds no scan for that set, so the scan came from public/data/printings"
      : "and neither that checklist nor public/data/printings holds a scan for that set";
    console.log(`  ${x.card} #${x.n} (${x.set}) resolved against public/data/intl-guides.json, ${art}, and no price either way`);
  }
  for (const x of l.ambiguous) {
    // TWO REASONS WORE ONE SENTENCE AND ONLY ONE OF THEM WAS ABOUT RARITY. A
    // row with ZERO printings is not a card the ladder cannot separate, it is a
    // card name the checklist does not hold, and telling the reader of this log
    // that the Japanese rarity ladder is the reason sends them to fix the wrong
    // thing. Trainer Rare Candy and Trainer Poke Pad are both that case.
    console.log(
      x.printings === 0
        ? `  ${x.card}${x.rarity ? ` (${x.rarity})` : ""} in ${x.set} went in with no collector number: no printing on that intl checklist carries that name, so there is nothing to pin it to`
        : `  ${x.card}${x.rarity ? ` (${x.rarity})` : ""} in ${x.set} went in with no collector number: ${x.printings} printings carry that name on the intl checklist, each states a tier and none of them is the one the log wrote, and the Japanese rarity ladder is deliberately not mapped onto the English one, so nothing here can say which was pulled`);
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
