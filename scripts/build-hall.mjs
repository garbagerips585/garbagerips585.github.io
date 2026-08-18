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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIN_SALES = 10; // same floor the set guides use

let { cards: hall } = JSON.parse(await readFile(join(ROOT, "data/hall.json"), "utf8"));

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
if (!hall.length) {
  const hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
  const seen = new Set();
  const out = [];
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
        if (typeof h.price !== "number" && typeof h.psa10 !== "number") continue;
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
          set: null, number: h.number || null, name: h.card,
          _vid: vid,
          _img: h.img ? `${h.img}/high.webp` : null,
          _raw: typeof h.price === "number" ? h.price : null,
          _rarity: h.rarity || "Black Star Promo",
          _psa10: typeof h.psa10 === "number" ? h.psa10 : null,
          // The rip log stores ONE source, date and url per promo entry and
          // both its numbers came off that one page, so the PSA 10 stamp reads
          // from the same three fields the raw price does.
          _psa10AsOf: h.priceAsOf || null,
          _psa10Source: h.priceSource || null,
          _psa10Url: h.priceUrl || null,
          _setName: h.setName || "Black Star Promo",
        });
        continue;
      }
      let cards = null;
      try {
        cards = JSON.parse(await readFile(join(ROOT, `public/data/cards/${h.set}.json`), "utf8")).cards;
      } catch { continue; }
      const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
      const same = cards.filter((c) => norm(c.name) === norm(h.card));
      // Where the sheet named a rarity, take the printing that matches: that is
      // the one actually pulled. Same rule build-pages.mjs uses for rip pages,
      // so a card cannot show one number here and another there.
      const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
      const m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0];
      if (!m) continue;
      const key = `${h.set}-${m.n}`;
      if (seen.has(key)) continue;
      seen.add(key);
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
      });
    }
  }
  if (out.length) {
    hall = out;
    derivedFromHits = true;
  }
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

let graded = {};
try {
  graded = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* optional */ }

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
let pc = { cards: {} };
try {
  pc = JSON.parse(await readFile(join(ROOT, "data/graded.json"), "utf8"));
} catch { /* no graded sample yet; the column falls back to dashes */ }

// Same folding sync-pricecharting.mjs uses, for the same reason: accents have
// to go before the strip or "Pokemon GO" and "Pokémon GO" never meet.
const pcNorm = (x) =>
  String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pcNum = (x) => String(x ?? "").replace(/^0+(?=\d)/, "");
const pcByName = new Map();
for (const rec of Object.values(pc.cards || {})) {
  const k = pcNorm(rec.name);
  if (!pcByName.has(k)) pcByName.set(k, []);
  pcByName.get(k).push(rec);
}

/**
 * The graded record for one printing, or null.
 *
 * THE PRINTING HAS TO AGREE AND IT IS NOT AUTOMATIC. sync-pricecharting.mjs
 * only rejects a wrong number when it was given one, and it was run over the
 * hits, which mostly carry no number. Four records came back for a different
 * printing of the right card in the right set: Dawn #129 where ours is #118,
 * Mega Gardevoir ex #178 where ours is #159, Mega Venusaur ex #177 where ours
 * is #003, Cetitan ex #210 where ours is #065. Its own comment records the
 * Dawn one as a known bad match. `matched` carries the product PriceCharting
 * landed on, so the number is checked here and a disagreement is dropped: a
 * dash is honest, a secret rare's price against a bulk rare is not.
 */
function pricecharting(name, setName, number) {
  for (const rec of pcByName.get(pcNorm(name)) || []) {
    if (typeof rec.psa10 !== "number") continue;
    if (!pcNorm(rec.set).includes(pcNorm(setName))) continue;
    const got = /#\s*(\d+)/.exec(rec.matched || "");
    if (!got || pcNum(got[1]) !== pcNum(number)) continue;
    return rec;
  }
  return null;
}

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
const totalRaw = ranked.reduce((n, c) => n + (c.raw || 0), 0);
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
function plaqueArt(url) {
  const m = TCGDEX_HIGH.exec(url || "");
  if (!m) return { src: url, extra: "" };
  const low = `${m[1]}/low.webp`;
  return { src: low, extra: ` srcset="${esc(low)} 245w, ${esc(url)} 600w" sizes="120px"` };
}

// TWO PLAQUES ARE IN THE FIRST SCREEN AND THEY DO NOT GET loading="lazy".
// Measured over CDP at 390x844 DPR 2, reading each img's own border box at
// scroll 0: plaques one and two sit at y=557 and y=746, inside the 844px
// viewport, and the third does not. `loading="lazy"` is a vertical heuristic, so
// those two were fetched at first paint anyway; the attribute only cost them the
// preload scanner, which is the one chance the fetch had to start during the
// HTML parse rather than after layout. No byte moves onto the load path.
const EAGER_PLAQUES = 2;
function plaque(c, i) {
  const rank = i + 1;
  const top = rank <= 3 ? ` chof-top chof-${rank}` : "";
  const art = plaqueArt(c.image);
  // AVIF in front of the WebP. TCGdex serves the same scan at four extensions
  // off one path and AVIF is 31.7% smaller than WebP at low.*, measured over the
  // 15 urls this page emits (all 30 low+high answer 200 as .avif, checked
  // 2026-08-16). picture{display:contents} in ui.css keeps `.chof-art img` and
  // the 245/337 aspect-ratio rule reaching the <img> exactly as before.
  const img = c.image
    ? avifPicture(`<img src="${esc(art.src)}"${art.extra} alt="${[esc(c.name), esc(c.rarity || ""), c.setName ? `from Pokemon ${esc(c.setName)}` : ""].filter(Boolean).join(" ")}"${i < EAGER_PLAQUES ? "" : ` loading="lazy"`} onerror="this.remove()"${imgDims(art.src)}>`)
    : `<span class="chof-noart">${esc(c.name)}</span>`;
  return `      <li class="chof${top}">
        <span class="chof-rank">${rank}</span>
        <button class="chof-art" type="button"
          data-img="${esc(c.image || "")}" data-name="${esc(c.name)}"
          data-set="${esc(c.setName)}" data-rarity="${esc(c.rarity || "")}"
          data-number="${esc(c.number)}" data-url="${esc(c.url || "")}"
          data-raw="${c.raw ? esc(moneyCompact(c.raw)) : ""}"
          data-psa="${c.psa10 ? esc(moneyCompact(c.psa10)) : ""}"
          aria-label="Enlarge ${esc(c.name)}">${img}</button>
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
.chof-prices{display:flex;gap:var(--s4);margin-top:var(--s3);padding-top:var(--s3);
  border-top:1px dashed rgba(255,255,255,.18)}
/* opacity:.7 on #9FB0C0 measured 3.32:1 against the lightest card tint on this
   page (#3E4445) where AA wants 4.5 for 11px text, and the steel itself was
   4.46:1 at full strength: under the line before the opacity was applied.
   The steel is now var(--chrome-dim) (5.45:1) and the date gets an explicit dimmer
   colour instead of a multiplier, because opacity compounds with whatever
   the card tint happens to be and cannot be checked by reading it. */
.chof-prices dt i{font-style:normal;font-weight:400;color:var(--chrome-dim)}
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
.chof-see{display:block;margin-top:var(--s3);min-height:44px;
  font:600 var(--t-sm)/1.35 var(--body);color:var(--sky)}
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
      <p>Every card that has come out of a pack on this channel, ranked by what it is worth. Tap a card to see it full size.${derivedFromHits ? " Nothing here was hand picked: this is the whole list of what was pulled on camera, in value order." : ""}</p>
      ${ranked.length ? `<div class="chof-tally">
        <div><b>${ranked.length}</b><span>${derivedFromHits ? "Cards pulled" : "Cards inducted"}</span></div>
        ${totalRaw ? `<div><b>${moneyCompact(totalRaw)}</b><span>All of them raw</span></div>` : ""}
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
// A graded record that named a different printing is dropped on purpose. Say
// which ones and why, so a run that drops MORE of them is visible rather than
// looking like a source that quietly went empty.
for (const c of ranked) {
  if (c.psa10) continue;
  const near = (pcByName.get(pcNorm(c.name)) || []).filter((r) => pcNorm(r.set).includes(pcNorm(c.setName)));
  for (const r of near) {
    console.log(`  no PSA 10 for ${c.name} #${c.number} (${c.setName}): graded.json holds "${r.matched}", a different printing`);
  }
}
if (!ranked.length) {
  console.log(`Nothing inducted yet. Mark cards "Card Hall of Fame" on the Chase Cards
tab, export it, and run:  node scripts/import-cards.mjs <csv>
`);
}
