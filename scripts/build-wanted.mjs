#!/usr/bin/env node
// Build public/wanted.html, the hunt list, and the Most Wanted band that sits
// on the home page.
//
//   node scripts/sync-wanted.mjs      first, to attach images and prices
//   node scripts/build-wanted.mjs
//
// Prices are shown only when they exist. A set the market has not reached has
// no raw price, and no free API carries PSA 10 at all, so both are omitted
// rather than printed as zero or invented. Where a PSA 10 figure is present it
// carries the date it was checked, because a graded price without a date is
// not a fact about anything.

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
import { esc, shortDate, moneyCompact, imgDims, avifPicture, rarityLabel } from "../shared/format.mjs";
// priceRead(), so this page cannot stamp the checklist's date under a column of
// dollars. See the long note beside the checklist join below.
import { priceRead } from "../shared/card-prices.mjs";
import { loadGradedPrices } from "../shared/graded-price.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The same count /sets/ actually publishes, computed the same way the home
// page computes it. This said 23 (the English sets only) while the home page
// said 36 for the identical destination.
const guideCount = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8")).sets.length +
  Object.keys(
    JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {},
  ).length;

const { cards, updated } = JSON.parse(
  await readFile(join(ROOT, "public/data/wanted.json"), "utf8")
);
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

/* ------------------------------------ rarity AND price, from the checklist --
 *
 * THE CHECKLIST WINS, because it is what the other four pages print.
 *
 * Victini, White Flare #172 read "Rare" here while /sets/white-flare.html,
 * /pokemon/victini.html and /cards.html all read "Black White Rare" for the
 * same card. One page out of four was telling a reader the wrong thing about a
 * card it was telling them to go and buy.
 *
 * IT IS NOT A TYPO, WHICH IS WHY FIXING THE TYPE-IN ALONE WOULD NOT HOLD. The
 * two feeds genuinely disagree: sync-wanted.mjs takes `card.rarity` from
 * api.pokemontcg.io, which returns "Rare" for that card, while the checklists
 * under public/data/cards/ come from TCGdex, which returns "Black White Rare".
 * pokemontcg.io is simply behind on the rarity Black Bolt and White Flare
 * introduced. Correcting data/wanted.json is worth doing and is done, but the
 * sync overwrites it from the API on its next run, so the correction has to
 * live where the page is rendered or it lasts exactly one sync.
 *
 * So: read the rarity out of the same file every other page reads it out of,
 * and keep the wanted.json value only where there is no checklist entry to read
 * (the newest sets ship a wanted card before their checklist lands). Cased
 * through rarityLabel for the usual reason, which is that TCGdex ships
 * "Special illustration rare" and the rest of the site writes Title Case.
 *
 * ------------------------------------------------------ AND SO DOES THE PRICE
 *
 * THE SAME ARGUMENT APPLIES WORD FOR WORD TO THE MONEY, and it took until 19
 * August 2026 to notice, by which point this page was printing a sentence that
 * was flatly false: "THEY ARE THE SAME FIGURES THE SET GUIDES AND THE
 * CHECKLISTS PRINT". They were not. All ten of them disagreed.
 *
 *      Mega Darkrai ex, Pitch Black #116     $233 here    $249.22 on the guide
 *      Mega Dragonite ex, Ascended Heroes    $705 here    $670
 *      Mega Charizard X ex, Phantasmal F.    $716 here    $750
 *
 * public/data/wanted.json was last written by sync-wanted.mjs on 12 August,
 * when the site's raw card prices were TCGplayer's market price via TCGdex. The
 * whole site moved to PriceCharting's ungraded price guide on 18 August, in one
 * place (sync-cards.mjs), which is exactly why nine other builders did not have
 * to change. This one did, because it reads a SNAPSHOT of those prices taken on
 * a different day rather than reading the file itself, and a snapshot cannot be
 * corrected by a source swap it never sees.
 *
 * IT WAS WORST ON THE HOME PAGE, where both bands are visible at once: the Most
 * Wanted shelf said Mega Darkrai ex RAW $233 and the Card Pokedex grid nine
 * hundred pixels below said Pitch Black, Top card $249. Same card, same page,
 * two prices, no source line on either.
 *
 * So the raw figure is read out of the same file the rarity is, and the wanted
 * file's own number is kept only where the checklist has no row (a card wanted
 * out of a set whose checklist has not landed). `rawFrom` records which, so the
 * note under the grid can say what it is actually describing.
 *
 * THE PSA 10 FIGURE STAYS ON ITS OWN FEED and that half of the paragraph above
 * is untouched: it is pokemonpricetracker.com, in data/psa10.json, a different
 * measurement from the raw column, and switching it to the checklist's
 * PriceCharting column would change what is on the page rather than correct it.
 *
 * WHAT WAS WRONG WAS THE SAME SNAPSHOT BUG AS THE RAW COLUMN, ONE FEED OVER.
 * This paragraph used to add "it is not what the set guides print", and that
 * was simply false: every set guide prices its chase cards out of
 * data/psa10.json through gradedPrice(), and so does the home page. This page
 * was not reading that file at all. It was reading `psa10` out of
 * public/data/wanted.json, a COPY sync-wanted.mjs took on 12 August, so the six
 * cards that had a figure then still carry the 11 August reading while the rest
 * of the site prints the 16 August one, and three cards that gained a figure
 * since simply showed nothing:
 *
 *      Mega Greninja ex, Chaos Rising #116        blank here    $598 on the guide
 *      Meowth ex, Perfect Order #121              blank here    $339
 *      Mega Dragonite ex, Ascended Heroes #290    blank here    $1,448
 *
 * data/psa10.json's own readme already says what is supposed to happen: "One
 * store for graded prices across the whole site: the set guides read it for
 * their chase cards, and the hunt list reads it for the cards being chased."
 * So read it, with the SAME precedence and the same ten-sale floor every other
 * builder applies, and keep the wanted-file value only where that store has
 * nothing.
 *
 * THIS PARAGRAPH USED TO END "Mega Darkrai ex, Pitch Black #116 stays blank on
 * both: its only reading is 8 sales, under the floor", AND IT STOPPED BEING
 * TRUE ON 21 AUGUST 2026 WITHOUT THE FLOOR MOVING. That card now prints $2,700
 * here, on the home page's Most Wanted shelf and on /sets/pitch-black.html,
 * because shared/graded-price.mjs put PriceCharting in FRONT of
 * pokemonpricetracker and data/graded.json holds a figure for it. The eight
 * sales are still under the floor and the tracker's reading is still thrown
 * away; a different feed answered above it.
 *
 * THE HALF OF THAT SENTENCE THAT STILL STANDS is the reason it was written: a
 * gate applied on one page and not another is how this class of bug starts.
 * The gate is applied in ONE place now, to one tier, which is why the card
 * moved on all three pages in the same build rather than on one of them.
 * PriceCharting publishes no sale count, so there is nothing for the floor to
 * read on that tier and it is not silently skipped: it does not apply.
 */
// THE CHAIN IS SHARED NOW, and the paragraph above is the reason it had to be.
// This page was reading the graded store "with the SAME precedence and the same
// ten-sale floor every other builder applies" by writing that precedence out a
// fourth time, and on 18 August 2026 a fifth copy in build-hall.mjs gained a
// tier the other four never heard about. Same class of bug as the snapshot one
// argued above, one level up: not a stale copy of a number, a stale copy of the
// RULE. shared/graded-price.mjs owns it, holds the ten-sale floor, and hands
// back the date and the feed name alongside the figure so they cannot part.
//
// The join needs the card's name and its set's name; both are on every row of
// data/wanted.json already.
const gradedFor = await loadGradedPrices();
const gradedPrice = (setId, number, name, setName) =>
  gradedFor.price(setId, number, { name, setName });
const gradedStamp = (setId, number, name, setName) =>
  gradedFor.stamp(setId, number, { name, setName });

const rarities = new Map();
const priceStamps = new Map();
for (const c of cards) {
  if (!c.set || !c.number) continue;
  if (!rarities.has(c.set)) {
    try {
      const doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${c.set}.json`), "utf8"));
      rarities.set(c.set, doc.cards);
      priceStamps.set(c.set, {
        priceSource: doc.priceSource,
        pricesChecked: doc.pricesChecked,
        checked: doc.checked,
      });
    } catch {
      rarities.set(c.set, null);
    }
  }
  const m = (rarities.get(c.set) || []).find((x) => String(x.n) === String(c.number));
  c.rarity = rarityLabel(m?.rarity || c.rarity) || null;
  if (typeof m?.price === "number" && m.price > 0) {
    c.raw = m.price;
    c.rawFrom = "checklist";
    // priceRead(), not the checklist's own `checked`: that one is the day
    // TCGdex was read for names and rarities and it moves nightly, and stamping
    // it under a column of dollars claims a freshness the figures do not have.
    c.rawAsOf = priceRead(priceStamps.get(c.set));
  }
  // The graded store wins over the snapshot, for the reason argued above. The
  // date and the feed name move with the figure, so the note under the grid
  // cannot end up dating a number it is no longer describing.
  const g = gradedPrice(c.set, c.number, c.name, c.setName);
  if (g != null) {
    const stamp = gradedStamp(c.set, c.number, c.name, c.setName);
    c.psa10 = g;
    c.psa10AsOf = stamp.asOf || c.psa10AsOf;
    c.psa10Source = stamp.source || c.psa10Source;
  }
}

// The stamps the note prints, taken from whichever set files the page actually
// used. One source across all ten today; if that ever stops being true the note
// says so rather than picking one and hoping.
const usedStamps = [...priceStamps.values()].filter(Boolean);
const rawSources = [...new Set(usedStamps.map((s) => s.priceSource).filter(Boolean))];
const anyChecklistPrice = cards.some((c) => c.rawFrom === "checklist");

const hunting = cards.filter((c) => !c.got);
const caught = cards.filter((c) => c.got);

/* ------------------------------------------- the packs the hunt happens in
 *
 * THIS PAGE'S OWN LEDE SAID "EVERY PACK OPENED ON THIS CHANNEL IS OPENED
 * HOPING FOR ONE OF THESE" AND THEN LINKED NO PACK BEING OPENED. The only
 * destinations on it were TCGplayer, one per card, and the set index. A reader
 * who believes that sentence has exactly one next question and the page had no
 * answer to it.
 *
 * THE JOIN IS BY SET, which is the second tier build-pokemon.mjs uses and it
 * is a fact out of two files rather than a guess: a wanted card is printed in
 * a set, a rip is tagged with the set it opened, so a rip of that set is a
 * video of somebody looking for this card. Seven of the ten wanted cards sit
 * in six sets we have opened, 210 rips between them; the other three are in
 * White Flare and Black Bolt, which this channel has never opened, and they
 * contribute NOTHING here rather than borrowing another set's video.
 *
 * WHAT THIS MUST NEVER SAY is that opening those packs is likely to produce
 * the card. "We are opening the set that prints it" is a fact. Anything about
 * the chances is a pull rate, and this site does not state those. See CLAUDE.md.
 *
 * ONE ROW PER SET, NEWEST FIRST, not six rows off one busy set: the same
 * round-robin reasoning as setRipsFor in build-pokemon.mjs, where a straight
 * newest-first slice turned a band about eight sets into a band about one.
 */
const { videos: allVideos } = JSON.parse(
  await readFile(join(ROOT, "public/data/videos.json"), "utf8")
);
const setNameById = new Map(sets.map((s) => [s.id, s.name]));
const huntRips = (() => {
  const bySet = new Map();
  for (const v of allVideos) {
    if (!v.path) continue;
    for (const sid of v.sets || []) {
      if (!bySet.has(sid)) bySet.set(sid, []);
      bySet.get(sid).push(v);
    }
  }
  const wantedSets = [...new Set(hunting.map((c) => c.set).filter(Boolean))];
  return wantedSets
    .map((sid) => {
      const list = (bySet.get(sid) || [])
        .slice()
        .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")));
      if (!list.length) return null;
      return {
        set: sid,
        name: setNameById.get(sid) || sid,
        total: list.length,
        v: list[0],
        cards: hunting.filter((c) => c.set === sid).map((c) => c.name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);
})();
const huntRipTotal = huntRips.reduce((n, r) => n + r.total, 0);

/** The two price rows under a card. Each disappears entirely when unknown. */
function prices(c) {
  const rows = [];
  if (c.raw) {
    rows.push(`<div class="pr"><span class="pr-k">Raw</span><span class="pr-v">${moneyCompact(c.raw)}</span></div>`);
  } else {
    rows.push(`<div class="pr pr-none"><span class="pr-k">Raw</span><span class="pr-v">no market price yet</span></div>`);
  }
  if (c.psa10) {
    rows.push(
      `<div class="pr pr-psa"><span class="pr-k">PSA 10</span><span class="pr-v">${moneyCompact(c.psa10)}</span></div>`
    );
  }
  return rows.join("");
}

/**
 * THIS PAGE WAS 7.2MB OF CARD ART, and every byte of it was the wrong file.
 *
 * `c.imageLarge` is 733x1024 from both CDNs: 1.2MB per card from Scrydex,
 * 500-825KB per card from pokemontcg.io. The box it lands in is 136px wide on a
 * 360px phone and never wider than 325px on a 1920px screen, so the ten cards
 * on the page pulled 6,997KB of image to paint at most 325 CSS px. Measured in
 * headless Chrome at 390 and 1440: 7,241KB transferred, both widths.
 *
 * The sizes are not resampled, because the CDNs already publish the smaller
 * files and wanted.json already carries the small URL alongside the large one:
 *
 *   tcgdex       low.webp 245x337 (17-40KB)                      high.webp 600x825 (84-205KB)
 *   scrydex      /small 245x342 (68KB)  /medium 365x512 (143KB)  /large 712x997 (1.2MB)
 *   pokemontcg   X.png  245x342 (183KB)                          X_hires.png 733x1024 (500KB+)
 *
 * ALL TEN CARDS ARE ON TCGDEX NOW, so the paragraph that used to sit here about
 * pokemontcg.io's two candidates was describing a page that no longer exists.
 * Check `grep -o 'src="http[^"]*"' public/wanted.html` before writing another.
 *
 * THE MIDDLE SIZE DOES NOT EXIST ANYWHERE WE CAN REACH, and that was tested
 * rather than assumed, because a 310px box wants roughly a 350-400px file:
 *   - TCGdex publishes exactly `low` and `high`. `medium.webp`, `mid.webp` and
 *     `600.webp` all 404. Only the EXTENSION varies (webp/avif/png/jpg).
 *   - Scrydex has /medium at 365x512, which is the right shape, but it is PNG:
 *     over the same ten cards it is 1,219KB against TCGdex high's 1,320KB in
 *     WebP. A 7.6% saving to go from a 600px source to a 365px one, which is
 *     then short of what a 2x screen asks for. Rejected on the measurement.
 *   - pokemontcg.io's 245px PNGs are 1,177KB for the ten, LARGER than TCGdex's
 *     600px WebPs. There is no version of "use the small file" that wins there.
 * The middle size that does exist is a FORMAT, not a width: see avifPicture.
 *
 * The large descriptor is per host because the hosts disagree, and it was 733w
 * for everything while every file on this page is 600px wide. That happens to
 * pick the same candidate either way (245 is the only alternative, and it loses
 * at every DPR), so it changed nothing today and would have quietly mispriced
 * the first srcset anyone added a third size to.
 *
 * ==========================================================================
 * AND THEN IT DID GET A THIRD SIZE, 16 August 2026, BECAUSE THIS IS STILL THE
 * WORST PAGE ON THE SITE TO WAIT FOR AND THE TWO WIDTHS ABOVE ARE WHY.
 * ==========================================================================
 *
 * Measured at 390x844 DPR2, gzipped, cache off: 983.8KB on load, of which
 * 874.9KB is card art, AND THE FULLY SCROLLED FIGURE IS THE SAME 983.8KB. Ten
 * cards in a two column grid all fall inside Chrome's lazy-load lead, so the
 * `loading="lazy"` below defers exactly nothing on a phone. Every other heavy
 * page on this site at least makes the reader scroll for its weight; this one
 * charges the whole thing before first paint. That is what makes it worse to
 * wait for than /cards.html, whose raw total is larger.
 *
 * Every one of the ten fetched the 600w file. It lands in a 151px box.
 *
 * THE HOST WAS CHECKED FIRST and there was nothing free left: all ten are
 * TCGdex, all ten already take the AVIF, and the biggest is 154KB. The fix had
 * to be a width that does not exist upstream, so scripts/sync-card-thumbs.mjs
 * now mirrors 310w and 420w renditions of these ten. Its header carries the
 * encode measurements and the reason 245w was rejected on sight: it is soft,
 * and the attack text on Seismitoad ex turns to mush at the size this page
 * paints it.
 *
 * `sizes` HAD TO BE FIXED IN THE SAME BREATH OR THE RENDITIONS WOULD BE DEAD
 * BYTES, and that is the trap in this whole change. The old value declared 42vw
 * below 760, which is 163.8px at a 390px viewport, or 328 device pixels at
 * DPR2. The box is 151px, so 302. A browser told 328 skips a 310w candidate and
 * takes the 600w one, and the mirror would have cost 40 files to save nothing.
 * The values below are the measured box, driven with CDP at 18 widths:
 *
 *      320   116px      761   201px       1081  220px
 *      390   151px      860   234px       1200  250px
 *      414   163px     1000   281px       1440  310px
 *      430   171px     1080   307px       1600+ 325px  (capped by .wrap)
 *      700   306px
 *
 * which is (100vw - 88px)/2, (100vw - 158px)/3 and (100vw - 200px)/4 exactly,
 * across .w-grid's three column counts. The subtracted constants are .wrap's
 * padding plus the grid gap, and THEY ARE NOT A SECOND COPY OF SOMEBODY ELSE'S
 * BREAKPOINTS: the media queries they track are the ones in this file's own
 * `style` block, sixty lines below. If ui.css moves the wrap padding underneath
 * us these go soft in the safe direction, because an over-declared size picks a
 * LARGER candidate, which is exactly what this page shipped for months.
 */
const LARGE_W = (u) => (/assets\.tcgdex\.net/.test(u) ? 600 : 733);
const ART_SIZES =
  "(max-width:760px) calc((100vw - 88px) / 2), " +
  "(max-width:1080px) calc((100vw - 158px) / 3), " +
  "(max-width:1499px) calc((100vw - 200px) / 4), 325px";

/**
 * The mirrored middle widths, keyed by TCGdex base url. A card that is not in
 * here keeps the two remote widths it has today, which is also what a card
 * added to the hunt list gets until sync-card-thumbs.mjs is run again.
 */
const REND = JSON.parse(await readFile(join(ROOT, "data/card-thumbs.json"), "utf8")).renditions?.wanted || {
  widths: [],
  dir: "/assets/cards/",
  cards: {},
};

/**
 * The art for one tile, as a <picture> with an AVIF source over a WebP <img>.
 *
 * This is avifPicture()'s shape hand built rather than borrowed, because that
 * helper only rewrites a srcset that is entirely TCGdex and these mix a local
 * mirror with remote rungs. Its two rules are kept. The AVIF source only ever
 * names files that exist: TCGdex encodes all four extensions off one path, and
 * the local pair is listed only when sync-card-thumbs.mjs saw every file of it
 * on disk. And the <img> underneath stays untouched WebP, so a Safari 16.0
 * reader gets a card rather than a hole.
 *
 * THE REMOTE RUNGS STAY. 245w is still the right answer for a 320px phone,
 * which needs 232 device pixels and would otherwise be handed a locally
 * re-encoded 310w that is bigger AND worse: TCGdex's encoder beats this
 * pipeline at equal width every time, and the only thing we can do better is
 * drop pixels nobody can see. 600w is still the right answer at DPR3 and on a
 * retina desktop. Nothing comes off the ladder; a middle goes into it.
 */
/*
 * `eager` MARKS THE TILES A READER CAN ALREADY SEE, and it is four of them.
 *
 * Measured over CDP at 390x844 DPR 2, reading each img's own border box at
 * scroll 0: the grid is two columns and rows one and two start at y=306 and
 * y=680, both inside the 844px viewport. `loading="lazy"` is a VERTICAL
 * heuristic, so those four were being fetched at once regardless; what the
 * attribute cost them was the PRELOAD SCANNER, the only chance the fetch had to
 * begin during the HTML parse rather than after layout. The comment above
 * already says the lazy on this page "defers exactly nothing on a phone" and
 * this is the four tiles where that is true no matter how tall the viewport is.
 *
 * The other tiles keep it: on a short viewport or a narrow one they really are
 * off screen, and this page is the heaviest on the site.
 */
function cardArt(c, eager = false) {
  const LAZY = eager ? "" : ' loading="lazy"';
  const small = c.image, large = c.imageLarge;
  const one = small || large;
  if (!one) return "";
  const alt = `${c.name} ${c.rarity || ""} from Pokemon ${c.setName}`.trim();
  const base = String(small || "").replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "");
  const mirror = REND.cards?.[base];
  const local = (ext) =>
    mirror ? (REND.widths || []).map((w) => `${REND.dir}${mirror.stem}-${w}.${ext} ${w}w`) : [];

  // Only one url to offer: no srcset, no sizes, exactly as before.
  if (!small || !large || small === large) {
    return avifPicture(
      `<img src="${esc(one)}" alt="${esc(alt)}"${LAZY} onerror="this.remove()"${imgDims(one)}>`
    );
  }
  const scryMid = /images\.scrydex\.com/.test(large) ? large.replace(/\/large$/, "/medium") : null;
  const webp = [`${small} 245w`, ...local("webp"), scryMid ? `${scryMid} 365w` : null, `${large} ${LARGE_W(large)}w`]
    .filter(Boolean)
    .join(", ");
  const tag =
    `<img src="${esc(small)}" srcset="${esc(webp)}" sizes="${esc(ART_SIZES)}" alt="${esc(alt)}"` +
    `${LAZY} onerror="this.remove()"${imgDims(small)}>`;
  // Every candidate is either ours or TCGdex: offer the whole ladder as AVIF.
  // Anything else (Scrydex publishes none) goes to the shared helper, which
  // declines it and emits the plain <img>, which is what shipped before.
  if (!/https?:\/\/(?!assets\.tcgdex\.net)/.test(webp)) {
    const avif = [
      `${small.replace(/\.webp$/, ".avif")} 245w`,
      ...local("avif"),
      `${large.replace(/\.webp$/, ".avif")} ${LARGE_W(large)}w`,
    ].join(", ");
    return `<picture><source type="image/avif" srcset="${esc(avif)}" sizes="${esc(ART_SIZES)}">${tag}</picture>`;
  }
  return avifPicture(tag);
}

// Two columns at 390 and two rows inside an 844px viewport.
const EAGER_TILES = 4;

function cardTile(c, { hunted = true, eager = false } = {}) {
  // The SMALL file is the src now, so a browser that ignores srcset gets the
  // 68KB one rather than the 1.2MB one.
  const art = cardArt(c, eager);
  const inner = `
        <span class="wc-art">${
          art || `<span class="wc-none">${esc(c.name)}</span>`
        }${hunted ? `<span class="wc-flag">Hunting</span>` : `<span class="wc-flag wc-got">Caught</span>`}</span>
        <b class="wc-name">${esc(c.name)}</b>
        <span class="wc-meta">${esc(c.setName)} &bull; #${esc(c.number)}</span>
        ${c.rarity ? `<span class="wc-rar">${esc(c.rarity)}</span>` : ""}
        <span class="wc-prices">${prices(c)}</span>`;
  // Only a real TCGplayer link makes the tile a link; otherwise it is a card,
  // not a dead anchor.
  //
  // THE LABEL IS THE OUTBOUND CONVENTION AND IT ALSO FLATTENS THE NAME. Nine
  // of these tiles left the site with no aria-label, which is the checkable
  // half of the outbound rule. Their accessible name was the whole tile read
  // in order, "Hunting Mega Darkrai ex Pitch Black #116 Special Illustration
  // Rare Raw $249", because the name of a link is every text node inside it
  // and this one wraps six. The label replaces that with the card, the set and
  // the host, in the site's own wording. The prices stay visible and stay out
  // of the name on purpose: they move nightly and the label would then be a
  // figure read aloud with no date on it.
  return c.url
    ? `      <a class="wc" href="${esc(c.url)}" rel="nofollow noopener" target="_blank"
        aria-label="${esc(c.name)} from ${esc(c.setName)}, opens on tcgplayer.com">${inner}
      </a>`
    : `      <div class="wc">${inner}
      </div>`;
}

// The NEWEST date, not whichever card happens to sort first: with card A
// checked in January and card B in August, "find" claimed every price on the
// page was last checked in January.
const asOf = cards.map((c) => c.psa10AsOf).filter(Boolean).sort().pop() || null;
const anyPsa = cards.some((c) => c.psa10);

// WHO SAID SO, AND THE DATA HAD IT ALL ALONG. Every card with a graded figure
// carries `psa10Source` and the note said only "GRADED SALES DATA", which is a
// price on a fan page with no source under it.
//
// "WHERE TWO FEEDS EVER APPEAR" STOPPED BEING HYPOTHETICAL ON 21 AUGUST 2026,
// and the generic fallback this comment used to describe became the WRONG
// answer the same day. PriceCharting went in front of pokemonpricetracker in
// shared/graded-price.mjs, so this grid now prints rows from both, and naming
// NEITHER of two known feeds is strictly worse than naming both. The generic
// survives only for a figure whose source the data does not record at all.
const psaSources = [...new Set(cards.filter((c) => c.psa10).map((c) => c.psa10Source).filter(Boolean))];
const psaWho = !psaSources.length
  ? "GRADED SALES DATA"
  : psaSources.length === 1
    ? psaSources[0]
    : `${psaSources.slice(0, -1).join(", ")} AND ${psaSources[psaSources.length - 1]}`;

// THE RAW COLUMN HAD A DATE ALL ALONG AND NEVER PRINTED IT. Every card carries
// `rawAsOf`, and the note under the grid dated only the PSA 10 figures, so half
// the page looked timeless and half did not. Newest read, same reason as above.
// Dates arrive as either 2026-08-16 or 2026/08/14 depending on the feed, so
// they are normalised before sorting or 2026/08/14 sorts after 2026-08-16.
const rawAsOf =
  cards
    .map((c) => c.rawAsOf)
    .filter(Boolean)
    .map((d) => String(d).replace(/\//g, "-"))
    .sort()
    .pop() || null;
// Whether the "we show nothing rather than a zero" line is still true of this
// page. It was left standing after the last sync priced every card on it, which
// is an explanation for something the reader can see is not happening.
const anyUnpriced = cards.some((c) => !c.raw);

const style = `
.wanted{padding:var(--s7) 0 var(--s8)}
.w-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s5)}
.w-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s4)}
@media(max-width:1080px){.w-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.w-grid{grid-template-columns:repeat(2,1fr);gap:var(--s3)}}
.wc{display:flex;flex-direction:column;gap:var(--s1);min-width:0;text-decoration:none;
  background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s3);box-shadow:var(--lift);transition:transform .14s,border-color .14s}
a.wc:hover{transform:translateY(-3px);border-color:var(--ink)}
/* The card art keeps the real 245:342 proportion of a Pokemon card, so it is
   never stretched, and reserves its height before the image loads. */
.wc-art{position:relative;display:block;aspect-ratio:245/342;border-radius:6px;
  overflow:hidden;background:var(--paper-3);margin-bottom:var(--s2)}
.wc-art img{width:100%;height:100%;object-fit:contain}
.wc-none{position:absolute;inset:0;display:grid;place-items:center;padding:12%;
  font:400 .9rem/1.25 var(--display);color:var(--ink-2);text-align:center}
.wc-flag{position:absolute;left:0;bottom:10px;z-index:2;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--ketchup-deep);color:var(--on-accent);padding:5px 7px;border-radius:0 4px 4px 0}
/* WAS #2F7A4A, which is two points off the new card green #2F4F39: the GOT IT
   flag would have vanished into the card it sits on. Want is pink and got is
   teal now, which is the site's own pair and needs no third hue. */
.wc-flag.wc-got{background:var(--sky-deep)}
.wc-name{font:600 var(--t-sm)/1.3 var(--body)}
.wc-meta{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.03em}
.wc-rar{font:700 var(--t-micro)/1.4 var(--mono);color:var(--plum)}
.wc-prices{display:flex;flex-direction:column;gap:2px;margin-top:var(--s2);
  padding-top:var(--s2);border-top:1px dashed var(--hair)}
.pr{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s2)}
.pr-k{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.06em;color:var(--ink-2);
  text-transform:uppercase}
.pr-v{font:700 var(--t-sm)/1.4 var(--body);color:var(--ink)}
.pr-none .pr-v{font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2)}
.pr-psa .pr-v{color:var(--gold-deep)}
.price-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}

/* WHERE THE HUNT IS ACTUALLY HAPPENING. See huntRips for what picks these.
   NOT .riplist: ui.css gives its caption white-space:nowrap, which is right for
   a set guide's "18 Aug 2026 &bull; 3 packs" and wrong the moment a caption is
   a set name plus a count on a 390px phone. Measured elsewhere on this site, a
   nowrap caption in that list ran 505px and hung 204px off the viewport with
   the document refusing to scroll to it, which the overflow test passes.
   TEAL for the title because teal is how you get around, --sky-deep and not
   --sky because the type is small: 4.50:1 on --card #2F4F39 against --sky's
   4.05:1, which fails. The set-and-count line above it is --ink-2 at 5.73:1, a
   caption and not a route. 44px minimum on the anchor, and it is the whole
   two-line row rather than the title's text run. */
.w-watch{margin-top:var(--s7)}
.w-watch h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s3)}
.w-watchlede{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.w-riplist{list-style:none;margin:0;padding:0;display:grid;gap:var(--s2);
  grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))}
.w-riplist li{background:var(--card);border:1px solid var(--hair);
  border-radius:var(--r-sm);padding:10px 12px;min-width:0}
.w-riplist a{display:block;min-height:44px;font:600 var(--t-sm)/1.35 var(--body);
  color:var(--sky-deep)}
.w-riplist a:hover,.w-riplist a:focus-visible{text-decoration:underline}
.w-riplist a span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);white-space:normal}
`;

const body = `
<main id="main" class="wanted">
  <div class="wrap">
    <div class="brk"><h1>Most <span class="hl">wanted</span></h1><span class="ln"></span>
      <a href="/sets/">All ${guideCount} set guides &rarr;</a></div>
    <p class="w-lede">The cards I am actually chasing right now. Every pack opened on this
      channel is opened hoping for one of these. Tap a card to see it on TCGplayer.</p>
    <div class="w-grid">
${hunting.map((c, k) => cardTile(c, { eager: k < EAGER_TILES })).join("\n")}
${caught.map((c) => cardTile(c, { hunted: false })).join("\n")}
    </div>
    ${huntRips.length ? `<section class="w-watch">
      <h2>The packs we are opening <span class="hl">looking for them</span></h2>${/* IT SAID "of the N sets these cards are printed in", AND huntRips
           IS NOT THAT SET. It holds only the sets that have a rip, so the cards
           above are printed across more sets than this number: on the current
           list, White Flare and Black Bolt print three of the ten wanted cards
           and neither has been opened on camera, so the page claimed seven when
           it meant nine. Say what the number counts. */ ""}
      <p class="w-watchlede">${huntRipTotal} rips of the ${
        huntRips.length === 1 ? "set" : `${huntRips.length} sets`
      } we have opened that print these cards, newest of each below. No promises about what is in a pack:
        this is just where the hunt is happening.</p>
      <ul class="w-riplist">
${huntRips
  .map(
    (r) => `        <li><a href="/${esc(r.v.path)}"><span>${esc(r.name)} &bull; ${r.total} rip${
      r.total === 1 ? "" : "s"
    }</span>${esc(r.v.siteTitle || r.v.title)}</a></li>`,
  )
  .join("\n")}
      </ul>
    </section>` : ""}
    <p class="price-note">RAW PRICES ARE ${
      esc((rawSources.length === 1 ? rawSources[0] : "PRICECHARTING.COM").toUpperCase())
    }'S PRICE GUIDE VALUE FOR AN UNGRADED COPY${
      rawAsOf ? `, READ ${shortDate(rawAsOf).toUpperCase()}` : ""
    }.${
      anyChecklistPrice
        ? ` THEY ARE READ OUT OF THE SAME SET CHECKLIST THE SET GUIDES AND THE CARD SEARCH PRINT FROM, SO THE THREE CANNOT DISAGREE ABOUT ONE CARD. THEY MOVE ON THEIR OWN.`
        : ` THEY MOVE ON THEIR OWN.`
    }${
      anyUnpriced
        ? ` A SET THIS NEW SOMETIMES HAS NO PRICE YET, AND WE SHOW NOTHING RATHER THAN A ZERO.`
        : ""
    }${
        anyPsa
          ? `<br>PSA 10 PRICES COME FROM ${
              esc(psaWho.toUpperCase())
            }${asOf ? `, LAST CHECKED ${shortDate(asOf).toUpperCase()}` : ""}. ${/* NOT "A SEPARATE FEED FROM THE RAW FIGURES", WHICH STOPPED BEING TRUE
                 ON 21 AUGUST 2026. Both columns can now name pricecharting.com,
                 and a sentence telling a reader they are different companies
                 when they are the same one is worse than saying nothing. What
                 IS still true, and is the thing the sentence exists to say, is
                 that a graded sale and an ungraded guide value measure
                 different objects and are read off different files on
                 different days. */ ""}A GRADED PRICE IS A DIFFERENT MEASUREMENT FROM THE UNGRADED GUIDE VALUE ABOVE AND IS READ SEPARATELY, SO THE TWO COLUMNS ARE NOT ONE READING.`
          : `<br>PSA 10 PRICES ARE NOT LISTED FOR THESE YET. GRADED SALES COME FROM A SEPARATE FEED AND FROM CHECKING BY HAND.`
      }</p>
  </div>
</main>`;

// Reuse the home page's shell so the hunt page cannot drift from the design.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
// Stop at </header>, or the slice also takes the menu that follows it and the
// page ships two <nav id="menu"> blocks.
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf("</header>") + "</header>".length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
// The bar carries the menu button; the panel it controls lives after </header>,
// so it has to be copied across too or the button opens nothing.
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>Most Wanted: The Cards We Are Hunting | Garbage Rips 585</title>`)
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="The ${
      hunting.length
    } Pokemon cards Garbage Rips 585 is chasing right now, led by ${esc(
      hunting[0]?.name || "the current chase card"
    )}. Raw and PSA 10 market prices, updated as the market moves.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/wanted.html">`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/wanted.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1Most Wanted | Garbage Rips 585`);

const html = `<!DOCTYPE html>
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
`;

await writeFile(join(ROOT, "public/wanted.html"), dropUnusedPacksCSS(html));
console.log(`Wrote public/wanted.html
  hunting: ${hunting.length}${caught.length ? `, caught: ${caught.length}` : ""}
  with a raw price:    ${cards.filter((c) => c.raw).length} of ${cards.length}
  with a PSA 10 price: ${cards.filter((c) => c.psa10).length} of ${cards.length}
`);
