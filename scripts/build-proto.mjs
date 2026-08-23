#!/usr/bin/env node
// Fill the homepage prototype with real data.
//
//   node scripts/build-proto.mjs
//
// Everything the page shows comes from public/data/videos.json and sets.json:
// the filter counts, the Hall of Fame, the newest rips, the most watched, and
// the Card Pokedex band. Nothing on the page is a number anyone typed, so what the
// prototype shows is what the real homepage will show.
//
// Idempotent: each region is replaced between its own pair of markers.

import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import { ripLabel } from "../shared/riplabel.mjs";
import { SITE, DOMAIN, STAGING, LIVE } from "../shared/site.mjs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDrift, SITE_SAY } from "../shared/chrome.mjs";
import { esc, MONTHS_SHORT as MONTHS, moneyCompact, imgDims, viewCount, avifPicture, packTileImg, longDate, noWidowEmoji, RIP_BANNER } from "../shared/format.mjs";
import { labelFor, PRODUCT_TYPES } from "../shared/taxonomy.mjs";
// The sourcing sentence for a raw card price, and the "which of the two dates
// in that file is the money's" helper. NOT re-worded here: this page prints the
// same figures the set guides and /wanted.html do, out of the same files, so it
// has to print the same sentence about them or the site has two answers to one
// question. See shared/card-prices.mjs.
import { priceNote, priceRead, chaseByPrice } from "../shared/card-prices.mjs";
import { loadGradedPrices } from "../shared/graded-price.mjs";
// The drops band's expiry model. NOT reimplemented here: /drops.html and this
// page print the same rows, so "is this row still true" is answered in one
// place for both. See shared/drops.mjs.
import {
  dropsClock, expiresOn as dropExpiresOn, isPerishable, splitByExpiry, isStale,
  homeBandRows, CONF_LABEL, CLIENT_DAY_JS,
} from "../shared/drops.mjs";
// The retailer marks, from the same module and the same mirrored files
// /drops.html, /buying.html, /selling.html and /retailers.html use. Extending
// that is the whole point: a second way of drawing a shop's logo is how the
// home band and the page it links to end up looking like two different
// features. BRAND_STYLE_MIN rather than BRAND_STYLE because this band can only
// ever draw one company mark per row; see the note on it in shared/brands.mjs.
import { brandMark, BRAND_STYLE_MIN } from "../shared/brands.mjs";
import { daysSince } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The live home page and the prototype share one design and one generator, so
// the prototype can never drift into showing something the real page does not.
// The prototypes are gone: they were scratch pages that shipped to the deploy
// root, publicly reachable and carrying no canonical or description.
// ALL THREE HAND-MAINTAINED PAGES, not just the home page.
//
// This list was one entry, and the domain rewrite below (see OTHER) is the only
// thing that moves an absolute url off the staging host. Every other page is
// generated and takes its urls from shared/site.mjs, so flipping LIVE moves
// them automatically. videos.html and playlists.html are written by nobody, so
// they kept their github.io canonical, og:url and og:image through the flip.
//
// /videos.html is the "Every Rip" hub and the joint highest-priority entry in
// the sitemap at 0.9. After launch the sitemap would have said
// garbagerips.com/videos.html while the page canonicalised to an abandoned
// host, which is a conflict a search engine usually resolves by dropping the
// url rather than by picking one.
const TARGETS = [
  join(ROOT, "public/index.html"),
  join(ROOT, "public/videos.html"),
  join(ROOT, "public/playlists.html"),
];

/* ------------------------------------------------------------------ data -- */

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
// How many set guides /sets/ actually publishes: the English sets plus the
// imported ones that have a checklist. The rail used to print sets.length,
// which is only the English half, so one page carried "All 23 sets" and "All 36
// guides" pointing at the same url 2,500px apart.
// EVERY guide /sets/ links, not just the ones with a checklist. Filtering on
// hasCards gave 34 against the 36 files that page actually lists: the two
// imported guides with no checklist are published noindex but are still linked
// there, so a visitor who follows this chip finds 36 of them.
const rawVideos = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));
const videos = rawVideos.videos || rawVideos;

// THE SET NAMES THIS PAGE PRINTS, AND sets.json IS NOT ALL OF THEM.
//
// Four places below do `setName.get(id) || id`, and the raw id is what lands on
// a public tile when the map misses: the filter rail chip, the Hall of Fame
// meta line, the hero kicker and the tile meta. sets.json holds the 28 sets
// with a guide page, so it missed every non-English set already, and now misses
// the 146 English sets with no guide that the video log's Set dropdown offers.
// A tin holding one 2019 pack is enough to put "unbroken-bonds" on the home
// page in capitals.
//
// labelFor() knows every one of them: CARD_SETS for the tagged sets and
// GUIDELESS_SET_LABELS for the rest. sets.json still wins where it has an
// entry, because that is the name the guide pages print.
const setName = new Map(sets.map((s) => [s.id, s.name]));
const setLabel = (id) => (id ? setName.get(id) || labelFor("sets", id) : "");

// FILTER ON THE SUFFIX, not on ".webp". This took anything webp in the folder
// and stripped the suffix if it happened to match, so the moment a second size
// appeared beside the originals (logos now ship a -sm.webp for the 110px boxes
// on /sets/) the set gained 23 entries whose "id" was a whole filename. Nothing
// broke, because every lookup is by set id and no set is called
// "pitch-black-pokemon-tcg-set-logo-sm.webp", which is exactly why it would
// have sat there.
const dirSet = async (sub, suffix) =>
  new Set(
    (await readdir(join(ROOT, "public/assets", sub)))
      .filter((f) => suffix.test(f))
      .map((f) => f.replace(suffix, ""))
  );
// Graded prices, so a Pokedex tile can say what the best card in that set is
// worth. Same precedence and same ten-sale floor as everywhere else, and since
// 21 August 2026 that is literally true rather than a claim: the chain lives in
// shared/graded-price.mjs and this file no longer writes its own. It used to,
// and so did four other builders, which is how /hall.html came to print $906
// for Mega Greninja ex #122 while 54 other pages printed $838.
//
// WHO SAID SO AND WHEN comes back from the same call as the number, so this
// page cannot credit one feed for another feed's figure. A hand-entered price
// is Tim's own and carries no feed name, which is the resolver's own call now
// rather than a rule three builders each remembered separately.
//
// The join needs the card's NAME and its SET's name, because data/graded.json
// is keyed by neither a set id nor a collector number on its own.
const gradedFor = await loadGradedPrices();
const gradedPrice = (setId, number, name, setName) =>
  gradedFor.price(setId, number, { name, setName });
const gradedStamp = (setId, number, name, setName) =>
  gradedFor.stamp(setId, number, { name, setName });

/* -------------------------------------------------- the checklist, once ----
 *
 * ONE READER FOR public/data/cards/<set>.json, memoized, because BOTH price
 * bands on this page join against it: the Most Wanted shelf for its raw figure
 * (see the long note below) and the Card Pokedex grid for its top card's. Two
 * readers of one file is how a page ends up printing two dates for one number.
 *
 * Card numbers are written "078" in the checklist and "78" in the chase list,
 * so they are compared stripped of leading zeros. reconcile-cards.mjs already
 * matches them padding-blind for the same reason; matching on the raw string
 * here would have silently dropped Shrouded Fable and Pokemon GO out of the
 * dated set and left two tiles credited to nothing.
 */
const _cardDocs = new Map();
async function cardDoc(setId) {
  if (!_cardDocs.has(setId)) {
    let doc = null;
    try {
      doc = JSON.parse(await readFile(join(ROOT, `public/data/cards/${setId}.json`), "utf8"));
    } catch {
      /* no checklist for this set yet */
    }
    _cardDocs.set(setId, doc);
  }
  return _cardDocs.get(setId);
}
const unpad = (n) => String(n ?? "").replace(/^0+(?=\d)/, "").toLowerCase();
const cardRow = (doc, number) =>
  (doc?.cards || []).find((x) => unpad(x.n) === unpad(number)) || null;

/* --------------------------------------------------- what the notes say ----
 *
 * THE HOME PAGE PUBLISHED 34 PRICES WITH NO SOURCE AND NO DATE ON EITHER BAND,
 * on the most visited page on the site, against a rule that says a number that
 * cannot be traced to a source does not get published. /wanted.html, the set
 * guides and /complete-a-set.html all carried the credit already; the two bands
 * that summarise them did not.
 *
 * The stamps are ACCUMULATED FROM THE FILES THE TILES WERE ACTUALLY BUILT FROM
 * rather than typed, which is the whole point: a note whose date is written by
 * hand into public/index.html is wrong within the week and nobody notices. Five
 * pages were found naming a retired feed on 19 August 2026 for exactly that
 * reason. If a band ever stops mixing two feeds, or gains a third, the sentence
 * changes by itself.
 */
function priceLedger() {
  return {
    // The merged shape shared/card-prices.mjs's priceNote() reads. `pricedBy`
    // counts ONLY the cards this band prints, not all 5,181 in the checklists,
    // because the clause it feeds says "priced here".
    doc: null,
    rawSources: new Set(),
    psaSources: new Set(),
    psaAsOf: null,
    psaFrom: null,
    raw: 0,
    psa: 0,
    // A price the band prints that no checklist backs, so the note cannot date
    // it. Zero today. Counted rather than ignored, because the failure mode
    // here is a figure quietly falling outside the sentence that sources it.
    unsourced: [],
  };
}
// A raw figure, taken out of the checklist doc it was priced from, folded into
// the band's ledger. `src: "tcgdex"` is stamped by sync-cards.mjs on the handful
// of rows PriceCharting does not list, so the fallback clause counts itself.
function addRaw(led, doc, row, what = "a card") {
  if (!doc) {
    led.unsourced.push(what);
    return;
  }
  led.raw += 1;
  if (!led.doc) {
    led.doc = {
      priceSource: doc.priceSource,
      pricesChecked: doc.pricesChecked,
      checked: doc.checked,
      pricedBy: { pricecharting: 0, tcgdex: 0 },
    };
  }
  // The NEWEST read across the sets the band actually used, not whichever file
  // was read first: with one set crawled in July and one in August, "first
  // wins" dates every price on the band to July.
  const read = priceRead(doc);
  if (read && read > priceRead(led.doc)) {
    led.doc.pricesChecked = doc.pricesChecked;
    led.doc.checked = doc.checked;
  }
  if (doc.priceSource) led.rawSources.add(doc.priceSource);
  if (row?.src === "tcgdex") led.doc.pricedBy.tcgdex += 1;
  else led.doc.pricedBy.pricecharting += 1;
}
// BOTH ENDS OF THE GRADED READ, not just the newest one. data/psa10.json is
// filled a card at a time as the credits allow, so the 28 tiles in the Pokedex
// grid carry graded figures read on three different days. "Last checked August
// 16" over a band whose oldest figure is the 11th claims a freshness five of
// them do not have, which is the same overclaim as stamping the checklist's
// date under a column of dollars. One date where they agree, both where they
// do not, and either way it is the file's own.
function addPsa(led, stamp) {
  led.psa += 1;
  if (stamp.source) led.psaSources.add(stamp.source);
  if (stamp.asOf) {
    if (!led.psaAsOf || stamp.asOf > led.psaAsOf) led.psaAsOf = stamp.asOf;
    if (!led.psaFrom || stamp.asOf < led.psaFrom) led.psaFrom = stamp.asOf;
  }
}
/**
 * The band's sourcing note, or nothing at all when the band prints no price.
 *
 * The raw half is priceNote() verbatim, so this page cannot word it differently
 * from the set guides it links to. The graded half mirrors the sentence
 * /wanted.html prints under the same two feeds, in this page's sentence case.
 * NEITHER IS WRITTEN WHERE THERE IS NOTHING TO SAY: a band with no graded
 * figure gets no graded sentence rather than a claim about a feed it did not
 * read.
 */
function bandNote(led, { lead, psaLead, trailing = "" }) {
  const bits = [];
  if (led.rawSources.size > 1) {
    // ONE SENTENCE CANNOT CREDIT TWO FEEDS FOR ONE COLUMN, and picking whichever
    // set was read first would credit one of them for the other's figures. Stop
    // rather than publish it: today all 28 checklists carry pricecharting.com,
    // so this only fires if the source swap is ever done half way.
    console.error(
      `\nThe home page's price bands read ${led.rawSources.size} different raw price sources ` +
        `(${[...led.rawSources].join(", ")}). The sourcing note under the band can only name one.\n`
    );
    process.exit(1);
  }
  if (led.raw) bits.push(esc(priceNote(led.doc, { lead, trailing })));
  if (led.psa) {
    // NAME BOTH RATHER THAN NEITHER. This fell back to "graded sales data" for
    // anything that was not exactly one name, which was right while a mixed
    // band was hypothetical. PriceCharting went in front of pokemonpricetracker
    // in shared/graded-price.mjs on 21 August 2026 and these bands now print
    // rows from both, so the fallback started firing and the home page stopped
    // naming either. The generic is kept for the case it was written for: a
    // figure whose source the data does not record.
    const names = [...led.psaSources];
    const who = !names.length
      ? "graded sales data"
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const when = !led.psaAsOf
      ? ""
      : led.psaFrom && led.psaFrom !== led.psaAsOf
        ? // "between August 11 and August 16, 2026", not "August 11, 2026 and
          // August 16, 2026": the year is said once where both ends share it.
          `, checked between ${
            led.psaFrom.slice(0, 4) === led.psaAsOf.slice(0, 4)
              ? longDate(led.psaFrom).replace(/,\s*\d{4}$/, "")
              : longDate(led.psaFrom)
          } and ${longDate(led.psaAsOf)}`
        : `, last checked ${longDate(led.psaAsOf)}`;
    bits.push(
      esc(
        `${psaLead} the figure comes from ${who} instead${when}` +
          // NOT "a separate feed from the raw prices". Both halves of this note
          // can name pricecharting.com now, and telling a reader they are
          // different companies when they are the same one is worse than
          // saying nothing. What is still true is that a graded sale and an
          // ungraded guide value measure different objects and are read off
          // different files on different days, which is the whole point of the
          // sentence. Same correction in build-wanted.mjs and
          // build-set-pages.mjs, made in the same pass so the three cannot
          // word it three ways.
          ". A graded price is a different measurement from the raw guide value and is read separately, so the two are not one number."
      )
    );
  }
  return bits.length ? `    <p class="price-note">${bits.join(" ")}</p>` : "";
}
const wantedLedger = priceLedger();
const setsLedger = priceLedger();

const packs = await dirSet("packs", /-garbage-rips-585-booster-pack\.webp$/);

let wanted = { cards: [] };
try {
  wanted = JSON.parse(await readFile(join(ROOT, "public/data/wanted.json"), "utf8"));
} catch {
  /* no hunt list yet: the band renders empty and the section hides itself */
}

/* --------------------------- the hunt list's raw price, from the checklist --
 *
 * THE HOME PAGE CONTRADICTED ITSELF ABOUT ONE CARD, found 19 August 2026. Most
 * Wanted read "Mega Darkrai ex, PITCH BLACK, RAW $233" and the Card Pokedex
 * grid nine hundred pixels below read "Pitch Black, Top card $249". They are
 * the same card, Pitch Black #116, on the same page.
 *
 * public/data/wanted.json is a SNAPSHOT of the card prices taken by
 * sync-wanted.mjs on 12 August, when the site's raw prices were TCGplayer's
 * market price via TCGdex. The whole site moved to PriceCharting's ungraded
 * guide on 18 August in one file (sync-cards.mjs), which is why nothing else
 * had to change; a snapshot cannot be corrected by a swap it never sees, so
 * this band kept serving the retired feed's numbers with no way to tell.
 *
 * So read the figure out of public/data/cards/<set>.json, which is the file
 * shared/card-prices.mjs calls the one source for a card price and the file the
 * set grid on this very page is already priced from. build-wanted.mjs does the
 * identical join for /wanted.html, beside a longer note; the two builders read
 * the same file so they cannot answer differently. The wanted file's own number
 * survives only where a set has no checklist yet, which is the standing pattern
 * for absent data everywhere else here.
 *
 * THE PSA 10 FIGURE IS THE SAME SNAPSHOT BUG ONE FEED OVER, and this paragraph
 * said it was "not touched ... so the two bands already agree about graded
 * money", which was true only by luck. The shelf's graded number came out of
 * the same 12 August copy in public/data/wanted.json, NOT out of data/psa10.json
 * the way gradedPrice hands it to the set grid twenty lines below, so the two
 * bands on this page agreed only for as long as the copy happened to match.
 * Three cards on the shelf had gained a figure in the store since the copy was
 * taken and were still rendering RAW, while /wanted.html and the set guides
 * printed a PSA 10 for them.
 *
 * So the store wins here as well, through the same gradedPrice and gradedStamp
 * the set grid uses. build-wanted.mjs does the identical overlay for
 * /wanted.html.
 *
 * THE EXAMPLE THIS PARAGRAPH USED TO END ON WENT OUT OF DATE ON 21 AUGUST 2026
 * AND THE FLOOR DID NOT MOVE. It read "which applies the same ten-sale floor:
 * Mega Darkrai ex, Pitch Black #116 has one reading of 8 sales and stays blank
 * on all three pages". That card prints $2,700 on all three now, because
 * shared/graded-price.mjs put PriceCharting in FRONT of pokemonpricetracker
 * and data/graded.json holds a figure for it. The eight sales are still under
 * the floor and that reading is still discarded; a different feed answered
 * above it. PriceCharting publishes no sale count, so the floor has nothing to
 * read on that tier rather than being skipped on it.
 */
for (const c of wanted.cards || []) {
  if (!c.set || !c.number) continue;
  const g = gradedPrice(c.set, c.number, c.name, c.setName || setLabel(c.set));
  if (g != null) {
    const stamp = gradedStamp(c.set, c.number, c.name, c.setName || setLabel(c.set));
    c.psa10 = g;
    c.psa10AsOf = stamp.asOf || c.psa10AsOf;
    c.psa10Source = stamp.source || c.psa10Source;
  }
  const doc = await cardDoc(c.set);
  const row = cardRow(doc, c.number);
  if (typeof row?.price === "number" && row.price > 0) {
    c.raw = row.price;
    // THE FILE THE FIGURE CAME OUT OF, CARRIED WITH THE FIGURE. The note under
    // the shelf has to date the six cards the shelf shows, not the ten in the
    // hunt file, so the stamps are folded in where the tiles are built rather
    // than here. Dating a band off cards it does not print is the same class of
    // error as dating money off the checklist's `checked`.
    c.rawDoc = doc;
    c.rawRow = row;
  }
}

const logos = await dirSet("logos", /-pokemon-tcg-set-logo\.webp$/);

/* ------------------------------------------------------------- formatting - */

function shortDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`.trim() + (Number(y) < new Date().getFullYear() ? ` ${y}` : "");
}
function monthYear(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] || ""} ${y}`.trim();
}
function clock(sec) {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// COUNT AND NOUN TOGETHER, because they have to agree. This was `compact`,
// which returned the number alone and left every call site to append " VIEWS",
// so all four of them printed "1 VIEWS" on the newest upload. Getting the noun
// out of the call sites is the fix: there is nowhere left to write it wrong.
// See viewCount in shared/format.mjs.
const views = (n) => viewCount(n).toUpperCase();

/* ------------------------------------------------------------------ tiles - */

// The pull ladder, richest first. These are the tags shared/taxonomy.mjs
// assigns, and the label is what the card's own rarity symbol means.
const PULL_RANK = [
  ["gold", "&starf;&starf;&starf; HYPER"],
  ["sir", "&starf;&starf; SIR"],
  ["ir", "&starf; IR"],
  ["double-rare", "&starf;&starf; DOUBLE"],
  ["charizard", "CHARIZARD"],
];
const pullIndex = new Map(PULL_RANK.map(([k], i) => [k, i]));

function bestPull(v) {
  let best = null;
  for (const p of v.pulls || []) {
    const i = pullIndex.get(p);
    if (i != null && (best == null || i < best)) best = i;
  }
  return best;
}

/**
 * One video tile.
 *
 * The face is the booster wrapper for the video's set, never YouTube's poster
 * frame: the poster is almost always the pulled card, so it spoils the video
 * before you press play. A video with no set tag, or a set with no artwork
 * yet, falls back to the set logo on a plain field rather than to a broken
 * image or a spoiler.
 */
/**
 * Which set's wrapper to show for a video.
 *
 * A video can carry several sets: an ex Box or a premium collection holds packs
 * from more than one, and one video is often one of those packs. The first
 * tagged set is the one the video is really about, so it wins; but if we have
 * no artwork for it and do for another, show the one we can actually draw
 * rather than falling back to the plain tile.
 */
function faceSet(v) {
  const list = v.sets || [];
  // A tin with packs from two sets, or a box with packs from four, is not
  // honestly represented by any one of their wrappers. If the generic
  // multi-set wrapper exists, that is the truthful tile. Until the artwork is
  // drawn this falls through to the old behaviour rather than breaking.
  if (list.length > 1 && packs.has("multi")) return "multi";
  return list.find((s) => packs.has(s)) || list[0] || null;
}

// THE BUILD DAY, WRITTEN INTO THE PAGE. Every relative date below is computed
// from the clock at build time and then frozen into a static file, so a deploy
// that stops moving turns each of them into a lie: a month later the newest rip
// still says TODAY, over a tile reading 1 VIEW, in the largest type above the
// fold. The browser pass at the bottom of index.html recomputes them all from
// the reader's own clock, and it uses this stamp as a floor so a reader whose
// clock is behind the build can only ever see what the server already rendered.
// Same idea as the date sweep in build-shows.mjs, which is the only reason
// /card-shows.html survives a frozen deploy.
//
// LOCAL MIDNIGHT, NOT UTC, AND shared/drops.mjs ALREADY SAYS WHY IN CAPITALS.
// The note beside CLIENT_DAY_JS ends "Do not simplify this to
// toISOString().slice(0,10)", and this line was exactly that, four hours a
// night, five in winter, in the owner's own timezone. Found on the evening of
// 19 August 2026, at 8:20pm in Rochester, with the build stamping 2026-08-20:
//
//   - DROPS_TODAY takes the LATER of the drops clock and this stamp, so the
//     band had already deleted the Walmart row reading "Wednesday 19 August,
//     from 9pm Eastern". The drop was forty minutes away and the front door had
//     stopped mentioning it. The client sweep cannot put it back: that sweep
//     only ever REMOVES rows, and the row was not in the HTML at all.
//   - Every `ago` chip aged by a day: a rip published 17 August rendered
//     "3 DAYS AGO" on the 19th.
//   - data-built is the FLOOR the browser pass is not allowed to go below, so
//     the one mechanism that exists to correct a stale date was pinned to the
//     wrong one.
//
// Hand rolled from the local date parts, the same three lines todayIso() ships
// to the browser, so the server and the reader answer the same question.
const localDay = (dt) => {
  const m = dt.getMonth() + 1, d = dt.getDate();
  return `${dt.getFullYear()}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
};
const BUILT = localDay(new Date());

/** "TODAY", "3 DAYS AGO", "2 WEEKS AGO". Short enough for a corner chip. */
function ago(iso) {
  if (!iso) return "";
  // WHOLE DAYS BETWEEN TWO LOCAL MIDNIGHTS, for the reason above. `new
  // Date("2026-08-17")` is midnight UTC, which is 8pm on the 16th in Rochester,
  // so subtracting it from Date.now() answered a question about a different
  // pair of days. Both ends are pinned to local midnight now, so the answer is
  // the one a reader would give looking at a calendar.
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - then) / 86400000);
  if (days <= 0) return "TODAY";
  if (days === 1) return "YESTERDAY";
  if (days < 7) return `${days} DAYS AGO`;
  if (days < 30) return `${Math.round(days / 7)} WEEK${Math.round(days / 7) === 1 ? "" : "S"} AGO`;
  // SINGULAR AT ONE MONTH. days is 30 to 45 here, so Math.round gives 1 and this
  // read "1 MONTHS AGO". Invisible while the site was rebuilt nightly, because
  // nothing on the home page was ever a month old; it is the first thing a
  // frozen deploy would have printed.
  if (days < 365) {
    const m = Math.round(days / 30.44);
    return `${m} MONTH${m === 1 ? "" : "S"} AGO`;
  }
  return `${Math.floor(days / 365)}Y AGO`;
}

/**
 * The same string, wrapped so the browser can correct it.
 *
 * `datetime` is the machine-readable version of whatever text is inside, which
 * is exactly what a `<time>` element is for, and it is the only thing the
 * client pass needs: it re-runs `ago` from the reader's clock and rewrites the
 * text. With JS off the server's own answer stands, so the page never depends
 * on the script for its content.
 */
const agoTag = (iso, cls) =>
  iso ? `<time class="${cls}" datetime="${esc(iso)}">${esc(ago(iso))}</time>` : "";

/**
 * The badge on the newest rip.
 *
 * Tim uploads at least once a day, so this reads "Today's Rip" almost every
 * day, which is what he asked for. It is NOT hardcoded, because "almost every
 * day" is not every day: the nightly build failed three nights running once,
 * and a hardcoded label over a four day old video would be the most visible
 * false claim on the site. Past yesterday it drops the date claim rather than
 * stretching it.
 */
function newestLabel(iso) {
  if (!iso) return "Latest Rip";
  // LOCAL DAYS, NOT AN INSTANT MINUS A UTC MIDNIGHT. This read
  // `Date.now() - new Date(iso)`, which crosses a whole number at UTC midnight
  // -- 8pm here -- so the badge on a video uploaded today flipped to
  // "Yesterday's Rip" every evening. daysSince reduces both sides to a local
  // calendar date first. See shared/today.mjs.
  const days = daysSince(iso);
  if (days == null) return "Latest Rip";
  if (days <= 0) return "Today's Rip";
  if (days === 1) return "Yesterday's Rip";
  return "Latest Rip";
}

/* tile() LIVED HERE AND WAS DELETED ON 19 AUGUST 2026 BECAUSE NOTHING CALLED IT.
 *
 * It returned the <article class="v"> grid tile and had no callers anywhere in
 * the repo: every other `tile(` in the tree is build-playlists.mjs's own
 * function, heroTile, a -tile.webp filename or .tile-stage.
 *
 * DEAD CODE THAT LOOKS LIVE COSTS MORE THAN DEAD CODE THAT LOOKS DEAD. This
 * function was the ONLY emitter of <span class="when">, the relative-date chip,
 * and both LAUNCH.md and CLAUDE.md listed it as one of the seven places that
 * emit the artwork's control. So it was faithfully kept in step during the
 * rip-banner change earlier the same day: markup edited, reasoning written, and
 * not one byte of it ever rendered. Two documents pointed at it, which is how a
 * dead branch keeps recruiting maintenance.
 *
 * The .v .when rules went with it, being its only consumer. The helpers it used
 * did NOT: agoTag, PULL_RANK, bestPull and faceSet all have live callers.
 *
 * If a band ever wants a grid tile again, git history has this, and rebuilding
 * it against the current banner is less work than keeping a copy that renders
 * nowhere honest. */


/* ------------------------------------------------------------- selections - */

// "Feature" on the sheet pins a rip to the front of Latest, whatever its date:
// a rip worth leading with is not always the newest one.
const byNewest = [...videos].sort((a, b) =>
  (b.feature ? 1 : 0) - (a.feature ? 1 : 0) ||
  String(b.published).localeCompare(String(a.published)) ||
  (b.views || 0) - (a.views || 0)
);

// Greatest Hits: the RIPS worth watching, which is a different thing from the
// Card Hall of Fame on /hall.html. That page ranks cards; this ranks videos.
// A real pull outranks a big view count, and views break ties
// inside a tier. This is a stand-in until the Greatest Hits playlist exists on
// YouTube, which is what the production page will key off.
//
// One per set. Strict ranking put three identical Destined Rivals wrappers in
// the first three slots, which reads as a duplicate render rather than as three
// different rips. Taking each set's best pull instead keeps the order honest
// (the heading says "ranked", and it is) while making every wrapper different.
// The full ranking is one tap away behind "All hits".
//
// Needs a wrapper to show, so a hit with no set tag is skipped here rather
// than rendering the fallback tile in the most prominent row on the page. It
// still counts toward "All hits" and still has its own page.
const HALL_PER_SET = 1;
const hall = [];
const perSet = {};
for (const v of videos
  .filter((v) => bestPull(v) != null && (v.sets || []).some((s) => packs.has(s)))
  // A rank typed on the sheet wins outright; everything without one falls in
  // behind by pull tier, then views.
  .sort((a, b) =>
    (a.hofRank ?? 999) - (b.hofRank ?? 999) ||
    bestPull(a) - bestPull(b) ||
    (b.views || 0) - (a.views || 0)
  )) {
  const s = faceSet(v) || "_";
  if ((perSet[s] = (perSet[s] || 0) + 1) > HALL_PER_SET) continue;
  hall.push(v);
  // SIX, NOT EIGHT. The grid is 6 columns wide, so eight tiles filled one row
  // and left two stranded on a second, which is what made the band read as a
  // spilling wall rather than a shelf. Six is exactly one row.
  if (hall.length === 6) break;
}

// MOST WATCHED IS GONE FROM THE HOME PAGE. It was the least curated of the
// three bands: whatever the algorithm happened to reward, which is not the same
// as the best work, and on a page that should be a considered introduction it
// was three more rows of pack art earning nothing. /videos.html?sort=views
// still exists for anybody who wants it. Bring it back when there is a video
// whose view count is itself the story.

const setCounts = {};
const productCounts = {};
for (const v of videos) {
  for (const s of v.sets || []) setCounts[s] = (setCounts[s] || 0) + 1;
  for (const p of v.products || []) productCounts[p] = (productCounts[p] || 0) + 1;
}
// A MISSING ENTRY HERE PRINTS THE RAW TAG ID, and one was missing. The chip
// below falls back to `|| id`, so the home page carried a filter chip reading
// "ex-premium 24": a lowercase hyphenated slug sitting in a row of proper names,
// two chips along from "Chaos Rising". "ex-box" was present but written "ex box",
// which is neither the slug nor the name.
//
// The names match the rail on /videos.html, which is where every one of these
// chips lands, and the rail is built by labelOf() in app.js. A chip that renames
// itself the moment it is clicked is its own small bug, so the two tables say
// the same words. Keep every product id in taxonomy.mjs listed in both.

const hitCount = videos.filter((v) => bestPull(v) != null).length;

/* ------------------------------------------------------------------ logos - */

/**
 * Read a WebP's pixel dimensions from its header.
 *
 * Worth the 20 lines: these logos range from 1.3:1 (151) to 5:1 (Mega
 * Evolution), and sizing them all to one height makes the wide ones look half
 * the size of the tall ones. Sizing by area instead needs the real aspect
 * ratio, and only the file knows it.
 */
function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  if (fourcc === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

const BOX_W = 144, TARGET_AREA = 5000, MIN_H = 34, MAX_H = 58;

async function logoHeight(id) {
  try {
    const size = webpSize(await readFile(join(ROOT, `public/assets/logos/${id}-pokemon-tcg-set-logo.webp`)));
    if (!size?.h) return null;
    const ratio = size.w / size.h;
    return Math.round(Math.min(Math.min(MAX_H, Math.max(MIN_H, Math.sqrt(TARGET_AREA / ratio))), BOX_W / ratio));
  } catch {
    return null;
  }
}

/**
 * width/height for a set logo, from the file itself.
 *
 * logoHeight() above already reads the real dimensions to compute the display
 * height; they were just never emitted as attributes, so 23 lazy logos on the
 * home page had no reserved box and the section reflowed as they landed.
 *
 * AND IT ALSO EMITS THE srcset NOW, 18 August 2026, because the home page was
 * the LAST family still handing a reader the full size logo. /sets/,
 * /openings/, /playlists/ and the 316 rip pages all moved to the `-sm`
 * rendition months apart; this one kept a bare `src` on the master and nobody
 * noticed because the markup looks correct either way. Measured at 390x844
 * DPR 2 off the request log: chaos-rising is 1051x300 and 68KB, painted 133css
 * wide. That is the 4x case the rip pages were fixed for, on the page every
 * reader from a Short lands on first, 28 times.
 *
 * `sizes` IS THE REAL BOX AND NOT A GUESS: logoHeight() above already computes
 * the painted height off the file's own aspect, so width is height x ratio and
 * no breakpoint has to be repeated here. That matters because the two
 * candidates are 3x apart, so a DPR 3 phone still resolves to the master and a
 * DPR 2 one does not, which is the honest split rather than a blanket
 * downgrade. Do not replace this with a flat `sizes`: the 28 logos have 28
 * different aspects and one number would over declare most of them.
 */
async function logoAttrs(id, dispH) {
  try {
    const base = `assets/logos/${id}-pokemon-tcg-set-logo`;
    const size = webpSize(await readFile(join(ROOT, `public/${base}.webp`)));
    if (!size?.w) return "";
    const attrs = ` width="${size.w}" height="${size.h}"`;
    let small = null;
    try {
      small = webpSize(await readFile(join(ROOT, `public/${base}-sm.webp`)));
    } catch {
      // No small rendition on disk: keep the master and change nothing.
    }
    // src carries the SMALL file when there is one, matching setLogoImg in
    // build-pages.mjs. A browser old enough to ignore srcset is old enough to
    // be on a 1x screen, where the small file is already the right pick.
    if (!small?.w || !dispH) return `${attrs} src="${base}.webp"`;
    const boxW = Math.round(dispH * (size.w / size.h));
    return `${attrs} src="${base}-sm.webp"` +
      ` srcset="${base}-sm.webp ${small.w}w, ${base}.webp ${size.w}w" sizes="${boxW}px"`;
  } catch {
    return "";
  }
}

/* ----------------------------------------------------------------- regions */


// THE ONE HALL OF FAME HIT, framed. Separate from the Greatest Hits shelf
// below it: the shelf is a row of six to browse, this is a single card the page
// stops on. hall is already sorted by a typed hofRank, then pull tier, then
// views, so hall[0] is the pick and Tim can override it from the sheet.
//
// Renders nothing when there is no hall, so the band cannot appear as an empty
// gold frame on a fresh clone.
const hofPick = hall[0] || null;
const hofHtml = hofPick
  ? `<a class="hofx" href="/${esc(hofPick.path)}">
        <span class="hofx-tag">Hall of Fame hit</span>
        <span class="hofx-art">
          ${(() => {
            // Same pack art the tiles use, at the larger size: this one is the
            // feature, so it is not sharing a row with five others.
            // THIS IS THE LCP ELEMENT OF THE HOME PAGE, measured in headless
            // Chrome at 390x844 and 1440x900. It carried loading="lazy" and no
            // priority while the ten carousel packs below the fold all carried
            // fetchpriority="high", so five of them started fetching 28ms
            // BEFORE the one image the page is actually waiting on. Priority
            // belongs to exactly one image and this is it, so do not add
            // fetchpriority to heroTile and do not make this one lazy.
            //
            // The srcset is the other half: without it a 359px box on a phone
            // was downloading the 810px file.
            //
            // THE `sizes` HERE IS MEASURED, NOT GUESSED, and it used to be
            // neither. It read "(max-width:640px) 92vw, 520px", which claims
            // 359px on a 390px phone against a box that ui.css caps at 250px,
            // and 520px on a desktop against a box that measures 464px at its
            // widest (464 from 641 to 1199 and again past 1400, 404 between).
            // Both over-declare, which is the direction that costs bytes.
            //
            // RE-MEASURED 16 Aug 2026, because ui.css dropped the phone's 250px
            // cap and gave the art a 2:3 crop from 425 up, so the old
            // "(max-width:640px) 250px" now UNDER-declares by up to 230px,
            // which is the direction that costs pixels rather than bytes.
            // Swept in headless Chrome, every figure below is a real
            // getBoundingClientRect on the <img>:
            //   320 -> 256   390 -> 326   414 -> 350   424 -> 360
            //   425 -> 361   480 -> 416   544 -> 480   545..640 -> 480
            //   641..1199 -> 464   1200..1399 -> 404   1400+ -> 464
            // Below 545 the frame is 100vw - 24 and the art is 40px inside it,
            // hence 100vw - 64. At 545 .hofx hits its 520px max-width and the
            // art pins at 480. The crop changes the HEIGHT at 425, not the
            // width, so 425 needs no stop of its own.
            //
            // IT MOVED ZERO BYTES WHEN IT WAS WRITTEN and that was not a reason
            // to leave it wrong. There were two candidates, 400w and 810w, so
            // every request over 400 device pixels landed on the same file
            // whatever the number said: 250 x 2 and 359 x 2 both ask for 810.
            // The note ended "the moment a middle width is added the honest
            // figure is what decides whether it gets used, so it is recorded
            // now, while the measurement is in front of somebody."
            //
            // THAT MOMENT ARRIVED THE SAME DAY. 560w exists now (see MID in
            // build-packs.py), and because the figures below are real
            // getBoundingClientRects rather than a guess, this frame lands on
            // it correctly at every DPR 1 desktop width: 404 declared at 1280
            // and 464 at 1440 and 1920, all of them over 400 and under 560.
            // Verified from the network, not from the markup. The old
            // "(max-width:640px) 92vw, 520px" would have declared 520 here and
            // taken the 810 file at 1440 and 1920 for a 464px box, so the
            // honest sweep is what turned the new rendition into a saving.
            // At DPR 2 this box asks for 808 and still takes 810w, unchanged.
            //
            // THE PHONE STOP IS `calc(78vw - 40px)` SINCE 20 AUGUST 2026 and
            // it is still measured rather than guessed. The fold pass capped
            // .hofx at 78vw below 545 (see the .hof block in ui.css), so the
            // art is that less a 4px border and var(--s4) padding either side,
            // which is the 40. 264.2 at 390, and the number the box actually
            // measures at every phone width where the cap binds.
            //
            // THE OLD "calc(100vw - 64px)" IS NOT JUST STALE, IT IS THE
            // EXPENSIVE DIRECTION. It claims 326 at 390 against a 264 box, and
            // 326 x 2 asks for 652 device pixels and takes the 810w file while
            // 264 x 2 asks for 529 and the 560w one satisfies it. Read off the
            // request log at 390 DPR 2, chaos-rising: 114,395 bytes of 810w
            // AVIF -> 64,438 of 560w, which is the whole of that width's
            // saving. DPR 3 is unchanged and has to be: 264 x 3 is 793 and
            // 810w is still the smallest candidate that covers it.
            //
            // IT IS EXACT AT EVERY PHONE WIDTH, WHICH IS A PROPERTY OF THE
            // CAP RATHER THAN LUCK. The cap can only lose to the wrap when
            // 100vw - 2*--gut drops under 78vw, which with the 20px phone
            // gutter is 182px, so there is no device on which this declaration
            // is a guess. THE NUMBER WAS 145px WHILE THE GUTTER WAS 16px and
            // it is restated here because the gutter moved to 20 on 21 August
            // 2026: the CONCLUSION is unchanged, and the reason it is unchanged
            // is the one ui.css gives beside .hofx, that 78vw is a CAP rather
            // than a width precisely so a gutter change cannot reach it. The
            // measured boxes below did not move either and were re-read after.
            // Read off the DOM: 209.6 at 320, 240.8 at 360, 264.2 at
            // 390, 282.9 at 414, 295.4 at 430, 384.3 at 544, every one of them
            // the number calc gives. So there is no second phone stop to write.
            //
            // AND IT IS SERVED AS AVIF FIRST SINCE 16 AUGUST 2026, which is the
            // only change to this element that a retina screen can feel. 560w
            // moved nothing here at DPR 2 because 808 device pixels still need
            // the 810w file; the codec shrinks that file instead of trying to
            // avoid it. avifPicture leaves every attribute above on the <img>
            // and adds one <source>, so the WebP is still what Safari 16.0-16.3
            // gets and fetchpriority still lands on the LCP element.
            const fs = faceSet(hofPick);
            return fs && packs.has(fs)
              ? avifPicture(`<img src="assets/packs/${fs}-garbage-rips-585-booster-pack.webp"
           srcset="assets/packs/${fs}-garbage-rips-585-booster-pack-tile.webp 400w, assets/packs/${fs}-garbage-rips-585-booster-pack-mid.webp 560w, assets/packs/${fs}-garbage-rips-585-booster-pack.webp 810w"
           sizes="(max-width:544px) calc(78vw - 40px), (max-width:640px) 480px, (max-width:1199px) 464px, (max-width:1399px) 404px, 464px" alt="" fetchpriority="high" decoding="async" width="810" height="1440">`)
              : packs.has("default")
                ? avifPicture(`<img src="assets/packs/default-garbage-rips-585-booster-pack.webp" alt="" fetchpriority="high" decoding="async">`)
                : `<b>Garbage Rips</b>`;
          })()}
          ${
            // THE TROPHY IS A VIDEO AND WAS THE ONLY ARTWORK ON THE PAGE THAT
            // NEVER SAID SO. Every other pack here carries a play pip and a
            // duration: the seven .hero-art slides in the two carousels do, the
            // grid tiles do, the shelf does. This one, the biggest pack on the
            // page and its LCP element at every width, carried neither.
            //
            // Measured at 390x844: the art box runs 265px to 845px, so on a
            // phone the first screen ends one pixel before the caption. The
            // title, the set, the view count and "Watch the pull" are ALL below
            // the fold, which left the whole opening screen as a picture of a
            // booster pack with nothing anywhere saying it plays. The pip and
            // the clock are the two marks that fit inside the art box itself,
            // so they are the only ones that can say it above the fold.
            //
            // Both live INSIDE .hofx-art on purpose. playInTile in
            // packplayer.js swaps that one box for the player and keeps the
            // rest of the card, so these two go with the artwork they describe
            // and nothing has to remember to remove them.
            hofPick.duration
              ? `${RIP_BANNER}<span class="dur">${clock(hofPick.duration)}</span>`
              : RIP_BANNER
          }
        </span>
        <span class="hofx-b">
          <span class="hofx-t">${esc(ripLabel(hofPick, setName, descriptions[hofPick.id]) || hofPick.siteTitle || hofPick.title)}</span>
          <span class="hofx-m">${[setLabel(faceSet(hofPick)), viewCount(hofPick.views)]
            .filter(Boolean).map(esc).join(" &bull; ")}</span>
          <span class="hofx-cta">Watch the pull <span aria-hidden="true">&rarr;</span></span>
        </span>
      </a>`
  : "";

// THE SHELF SKIPS WHATEVER THE GOLD FRAME ALREADY SHOWS. hofPick is hall[0],
// so mapping the whole of `hall` printed the same rip twice within 250px: once
// as a 614px spotlight and again as shelf rank #1, wearing the same wrapper
// both times. Twelve tiles were showing ten videos. "A little more curated"
// starts with not repeating yourself.
const hallList = hall.filter((v) => !hofPick || v.id !== hofPick.id);
/**
 * The newest rip, given its own row.
 *
 * Six equal tiles made the freshest thing on the channel look like one of six,
 * and because five of them usually wear the same wrapper it read as a column
 * of repeats rather than as news. One wide tile plus four beneath it says
 * which one is new without anybody having to read a date.
 */
function heroTile(v, opts) {
  const o = opts || {};
  const set = faceSet(v);
  const hasArt = set && packs.has(set);
  const src = hasArt
    ? `assets/packs/${set}-garbage-rips-585-booster-pack-tile.webp`
    : `assets/packs/default-garbage-rips-585-booster-pack.webp`;
  // THREE CANDIDATES, NOT TWO, SINCE 16 AUGUST 2026. With only 400 and 810 in
  // here, every pack request on this page took the 810 file at every width and
  // every DPR, logged from the network with cache off. The art box measures
  // 328px at 1280, 373 to 378 at 1440 and 391 to 408 at 1920: all of them over
  // 400, so the tile could never satisfy one, and all of them under 560, so 810
  // was the only thing left. 560w is the width that closes that gap.
  //
  // IT IS A DPR 1 FIX AND NOTHING ELSE, AND THE `sizes` BELOW IS STILL WRONG.
  // At DPR 2 a 402px box asks for 804 device pixels, so 810w is already the
  // smallest candidate that satisfies it and a retina laptop fetches exactly
  // what it fetched before. Every phone is unchanged byte for byte, which is
  // the property that makes this safe rather than the property that sells it.
  const srcset = hasArt
    ? `assets/packs/${set}-garbage-rips-585-booster-pack-tile.webp 400w, assets/packs/${set}-garbage-rips-585-booster-pack-mid.webp 560w, assets/packs/${set}-garbage-rips-585-booster-pack.webp 810w`
    : "";
  // 440px OVER-DECLARES AND IS KEPT ANYWAY, WHICH IS A TRADE AND NOT AN
  // OVERSIGHT. The real box is 328 / 373 / 391, so an honest figure would pick
  // the 400w tile at 1280 and 1440 and save another ~130KB at DPR 1 on top of
  // what 560w already saves. Writing it honestly means writing ui.css's
  // 1000/1200/1400 slide-count breakpoints a SECOND time, right here, which is
  // exactly what the "NO MEDIA QUERY IN HERE" note below argues against: the
  // two bands do not even share a count, and the copy goes silently soft the
  // day ui.css's counts move. 560w wins at all three desktop widths with no
  // breakpoints at all. If somebody later decides the extra 130KB is worth a
  // duplicated breakpoint, the measured boxes are in the paragraph above.
  const sizes = hasArt ? "(max-width:640px) 87vw, 440px" : "";
  const rest = `alt="" width="400" height="711" loading="lazy" decoding="async"`;
  // AVIF IN FRONT OF THE WEBP, AND IT IS THE ONE LEVER HERE THAT PAYS AT EVERY
  // DPR. The three widths above only help a screen whose box happens to fall in
  // a gap between them; a smaller codec shrinks whichever width the browser
  // picked anyway, so this is the change a retina laptop and a phone can both
  // feel. Measured on the generated files, avif q60 against webp q78 and at a
  // higher PSNR than it: 810w 150.6 -> 123.1KB, 560w 82.2 -> 68.0KB, 400w tile
  // 49.4 -> 41.2KB. avifPicture only rewrites the extension; build-packs.py is
  // what guarantees the file on the other end exists.
  const live = avifPicture(`<img src="${src}"${
    srcset ? `\n           srcset="${srcset}"\n           sizes="${sizes}"` : ""
  } ${rest}>`);
  // A SLIDE THE TRACK IS NOT SHOWING DOES NOT FETCH ITS PACK, AND
  // loading="lazy" IS NOT WHAT STOPS IT. Measured on the home page at 390x844
  // with a DPR 3 phone: five pack WebPs, 124 to 151KB each, all arrived before
  // first paint and exactly one of them was on screen.
  //
  // Lazy loading is a VERTICAL heuristic. A slide parked 407px to the right
  // inside a horizontal scroll track is, as far as Chrome's distance check
  // cares, next to the viewport, so every slide in the track fetches whatever
  // `loading` says. Two of the five were purely horizontal misses: 289.9KB of
  // the page's 681.6KB of pack art, for artwork behind the right-hand edge of
  // a band that is itself below the fold. The other three are the two bands'
  // first slides and the Hall of Fame frame, which lazy prefetches for the
  // ordinary vertical reason, and those are left alone.
  //
  // SLIDE 0 KEEPS A REAL src. It is visible in every layout at every width, and
  // it is the one image here the preload scanner should find while parsing.
  // Slides 1 and up carry the same attributes under data-, and packplayer.js
  // promotes them when the track is about to show them.
  //
  // NO MEDIA QUERY IN HERE, deliberately. The visible slide count is 1 on a
  // phone, 2.35 at 1000, 2.75 at 1200 and 3.3 at 1400, and the Hall of Fame
  // band overrides all of that with exactly 2 at 1200. A `media` attribute
  // written in this file would be a second copy of four breakpoints that live
  // in ui.css, and it would already be wrong for one of the two bands.
  // Measuring the real track in the browser cannot drift.
  //
  // loading="lazy" STAYS on the promoted image, so the vertical half of the
  // decision is still the browser's. This only takes back the horizontal half.
  //
  // The <noscript> copy is what a reader with JS off gets. ui.css lays it over
  // the empty box rather than under it, because the deferred <img> still
  // occupies the slide.
  //
  // THE <source> HAS TO BE DEFERRED WITH THE <img> AND THAT IS NOT OPTIONAL. A
  // <picture> whose <source> matches loads that source even when the <img>
  // carries no src at all, so a live `srcset` on the source would fetch every
  // slide's AVIF at first paint and put the phone straight back to 800KB, in a
  // new format, with the markup still looking correct. avifPicture({defer:true})
  // writes the source's candidates under the SAME data- names the img uses, and
  // hydrateSlides promotes the source first. Verified from the request log: at
  // 390x844 exactly one pack file arrives on load, and it is an .avif.
  const face = o.defer
    ? avifPicture(`<img data-packsrc="${src}"${
      srcset ? ` data-packsrcset="${srcset}" data-packsizes="${sizes}"` : ""
    } ${rest}>`, { defer: true }) + `<noscript>${live}</noscript>`
    : live;
  const all = v.sets || [];
  const label = all.length ? setLabel(all[0]).toUpperCase() : "GARBAGE RIPS";
  const p = bestPull(v);
  return `      <article class="hero">
        <a class="hero-art" href="/${esc(v.path)}" aria-label="${esc(v.siteTitle || v.title)}">
          ${face}${RIP_BANNER}${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""}
        </a>
        <div class="hero-body">
          <p class="hero-kicker">${
            // THE NEWEST RIP CARRIES A LABEL, NOT A TIMESTAMP. It used to read
            // "Newest rip TODAY", which is two claims where one will do and the
            // weaker of the two goes stale first. The label says the same thing
            // in the words Tim uses for it, and says less when it knows less.
            o.dated
              ? `<span class="hero-new" data-newest data-date="${esc(v.published || "")}">${esc(newestLabel(v.published))}</span>`
              : o.rankOf
                ? `<span class="hero-new">${esc(o.rankOf(v))}</span> ${agoTag(v.published, "ago")}`
                : agoTag(v.published, "ago")
          }</p>
          <h3><a href="/${esc(v.path)}">${esc(ripLabel(v, setName, descriptions[v.id]) || v.siteTitle || v.title)}</a></h3>
          <p class="hero-meta">${label}${p != null ? ` &bull; ${PULL_RANK[p][1]}` : ""} &bull; ${views(v.views)}</p>
        </div>
      </article>`;
}

// AND LATEST SKIPS WHATEVER IS ALREADY ABOVE IT. The newest rip was also
// sitting in the Greatest Hits shelf 1,300px higher, so the page opened with
// the same video presented as two different kinds of recommendation. Filtered
// against everything already shown, then the hero is the newest of what is
// left, which is still genuinely the newest thing a visitor has not just seen.
const shownAbove = new Set([hofPick && hofPick.id, ...hall.map((v) => v.id)].filter(Boolean));
const freshest = byNewest.filter((v) => !shownAbove.has(v.id));

/**
 * A band of one large video at a time.
 *
 * The home page showed 11 tiles across two bands, which asked a casual visitor
 * to choose from a wall of near-identical pack wrappers before seeing a second
 * of anything. Worse now that a tile plays where it sits: a 158px tile gives a
 * 133px video, which is not worth playing. One slide per band makes the video
 * as large as the band allows and puts the rest a swipe away.
 *
 * Every slide uses the hero shape, so the artwork is large and the title, set
 * and view count sit beside it rather than under it.
 *
 * The track is a native scroll-snap row. Swipe, trackpad, shift+wheel and
 * keyboard all work with no JavaScript; the arrows only call scrollBy, so with
 * JS off this is still a usable horizontal scroller rather than a dead band.
 */
function carousel(list, opts) {
  const o = opts || {};
  if (!list.length) return "";
  return `<div class="vcar" data-vcar data-built="${BUILT}">
      <div class="vcar-track">
${list
        .map((v, i) => `        <div class="vcar-slide">${heroTile(v, {
          // "Newest rip" is true of exactly one video, so only slide one wears
          // the badge. The rest carry their date, which is the honest version
          // of the same information.
          dated: !!o.dated && i === 0,
          rankOf: o.showSet ? () => `#${i + 1} hit` : null,
          // Everything past the first slide waits for the track to reach it.
          // See the long note in heroTile for why this is an index and not a
          // media query.
          //
          // SLIDE 0 KEEPS ITS REAL src EVEN THOUGH THE PHONE NOW HIDES A WHOLE
          // BAND. The obvious follow-up to the max-width:544px block beside
          // homeCss is to defer slide 0 as well, so the hidden Greatest Hits
          // shelf cannot download pack art the phone will not paint. It was
          // written, measured and taken back out: it saves NOTHING. The saving
          // is already there because this slide carries loading="lazy" and a
          // lazy image inside display:none never enters the viewport, so the
          // load never fires. 390x844 DPR 2, gzipped, cache off, read off the
          // request log: 389.8KB and 9 image requests either way, with
          // multi-...-booster-pack.avif absent from both. Deferring it would
          // have put a desktop's first slide behind JavaScript to buy zero
          // bytes. Do not add it back without a number.
          defer: i > 0,
        })}</div>`)
        .join("\n")}
      </div>
      ${list.length > 1 ? `<div class="vcar-bar">
        <button class="vcar-nav" type="button" data-vcar-prev aria-label="Previous rip">&larr;</button>
        <p class="vcar-count" aria-live="polite"><span data-vcar-i>1</span> / ${list.length}</p>
        <button class="vcar-nav" type="button" data-vcar-next aria-label="Next rip">&rarr;</button>
      </div>` : ""}
    </div>`;
}

// FIVE PER BAND, NOT ELEVEN ON THE PAGE. The point of one-at-a-time is that
// the landing view is short, so the slides that exist beyond the first cost
// nothing but a swipe. Five is enough to feel like there is more without
// turning the band into a scroll the length of the old grid.
const latestHtml = carousel((freshest.length ? freshest : byNewest).slice(0, 5), { dated: true });
const hallHtml = carousel(hallList.slice(0, 5), { showSet: true });

const ordered = [...sets].sort((a, b) => String(b.released).localeCompare(String(a.released)));
const setsHtml = (
  await Promise.all(
    ordered.map(async (s) => {
      const n = setCounts[s.id] || 0;
      const total = s.total || s.printedTotal;
      const bits = [total ? `${total} cards` : null, monthYear(s.released) || null].filter(Boolean);
      const h = logos.has(s.id) ? await logoHeight(s.id) : null;
      // THE NO-LOGO FALLBACK MUST NOT REPEAT THE NAME THAT IS ALREADY BELOW IT.
      // Five sets ship no logo artwork (Crown Zenith, Celebrations, Chilling
      // Reign, Shining Fates, Rebel Clash) and this used to drop the set's name
      // into the logo slot, so those five tiles printed "Crown Zenith" in
      // display type and then "Crown Zenith" again in the <b> two lines down.
      // It reads as a rendering fault rather than a fallback, and a screen
      // reader heard the name twice per tile.
      //
      // Same answer .hitcard-img.is-none and .mine-img.is-none already use for
      // a card with no scan: HOLD THE BOX so the grid does not jump, hatch it
      // so it reads as deliberately empty rather than as a broken image, and
      // let the name below carry the tile. aria-hidden because it says nothing
      // the <b> does not already say.
      const face = h
        ? `<img${await logoAttrs(s.id, h)} alt="" loading="lazy" style="--lh:${h}px">`
        : `<span class="set-noart" aria-hidden="true"></span>`;
      // What the best card in this set is worth. PSA 10 where we have one,
      // raw otherwise, and nothing at all when we have neither.
      // THE TOP CARD IS THE DEAREST ONE, NOT chase[0]. sets.json's chase list is
      // only ever REPRICED in place, never re-sorted, so its order is stale the
      // moment two of its cards swap places. That is how this tile came to read
      // "Top card $536 PSA 10" for Perfect Order while the set guide, the guide's
      // own lede and the /sets/ index card all named a different card at $339.
      // The full argument is beside chaseByPrice in shared/card-prices.mjs.
      // Scored on the checklist price, which is the same figure this tile
      // re-reads below, so the card picked and the number printed cannot part.
      const topDoc = await cardDoc(s.id);
      const top =
        chaseByPrice(s.chase, (c) => {
          const row = cardRow(topDoc, c.number);
          return typeof row?.price === "number" && row.price > 0 ? row.price : c.price;
        })[0] || null;
      const topPsa = top ? gradedPrice(s.id, top.number, top.name, s.name || setLabel(s.id)) : null;
      // THE RAW FIGURE IS RE-READ OUT OF THE CHECKLIST IT IS DATED BY, and that
      // is not tidying. sets.json's chase price is a COPY, written by
      // reconcile-cards.mjs out of public/data/cards/<set>.json, and the only
      // date beside it in that file is `pricesAsOf`, which reconcile fills from
      // the checklist's `checked` rather than from `pricesChecked`. Crediting a
      // copied number with the original's read date is a guess about how long
      // ago the two were in step; reading the number and the date out of the
      // same file is not. All 28 copies match the checklist to the cent today,
      // so no tile's figure moves, and the snapshot is still the fallback for a
      // set whose checklist has not landed. This is the same fix, for the same
      // reason, that the Most Wanted shelf above got on 19 August 2026.
      // topDoc is read above, because picking WHICH card is top now scores on
      // the same checklist this reads the figure out of.
      const topRow = top ? cardRow(topDoc, top.number) : null;
      const topRaw = typeof topRow?.price === "number" && topRow.price > 0 ? topRow.price : top?.price || null;
      const topVal = topPsa || topRaw || null;
      if (topPsa) addPsa(setsLedger, gradedStamp(s.id, top.number, top.name, s.name || setLabel(s.id)));
      else if (topRaw) addRaw(setsLedger, topRow ? topDoc : null, topRow, s.id);
      return `        <a class="set" href="/sets/${s.id}.html">
          <span class="set-art">${face}</span>
          <b>${esc(s.name)}</b>
          <span class="set-meta">${esc(bits.join(" · "))}</span>
          ${topVal ? `<span class="set-top">Top card ${moneyCompact(topVal)}${topPsa ? " <i>PSA 10</i>" : ""}</span>` : ""}
          ${n ? `<span class="set-rips">${n} rip${n === 1 ? "" : "s"}</span>` : ""}
        </a>`;
    })
  )
).join("\n");

// Most Wanted band. Shows a price only when there is one: the newest sets have
// no market data, and no free feed carries PSA 10 at all, so a card with
// neither simply says what it is.
const wantedHtml = (wanted.cards || [])
  .filter((c) => !c.got)
  .slice(0, 6)
  .map((c) => {
    const img = c.image || c.imageLarge;
    const price = c.psa10
      ? `PSA 10 ${moneyCompact(c.psa10)}`
      : c.raw
        ? `RAW ${moneyCompact(c.raw)}`
        : "CHASING";
    // Source and date for the six tiles this shelf prints, and only those six.
    // The graded stamps are the hunt file's own, because the graded FIGURE is
    // too; the raw stamps come from the checklist the raw figure was read out
    // of a hundred lines above. A card that says CHASING adds nothing to
    // either, so the note never dates a price the shelf does not show.
    if (c.psa10) addPsa(wantedLedger, { source: c.psa10Source, asOf: c.psa10AsOf });
    else if (c.raw) addRaw(wantedLedger, c.rawDoc, c.rawRow, `${c.name} (${c.set})`);
    const inner = `<span class="mw-art">${
      img
        ? avifPicture(`<img src="${esc(img)}" alt="${esc(c.name)} ${esc(c.rarity || "")} from ${esc(c.setName)}" loading="lazy" onerror="this.remove()"${imgDims(img)}>`)
        : `<span class="mw-none">${esc(c.name)}</span>`
    }</span>
        <b>${esc(c.name)}</b><p>${esc(c.setName.toUpperCase())} &bull; ${price}</p>`;
    // ALWAYS INTERNAL. These used to link out to prices.pokemontcg.io whenever
    // the card carried a url, which was 5 of the 6 cards, making the third band
    // on the home page the first thing that sends a visitor away. That already
    // contradicted the site's own rule that the only deliberate outbound links
    // are Subscribe and the socials.
    //
    // Worse than that: those urls 302 to tcgplayer.pxf.io, an affiliate
    // network. The home page was routing its visitors through somebody else's
    // affiliate link, on a band about cards Tim is still chasing. Nobody chose
    // that; it came in with the card data.
    //
    // The set guide is the honest destination: it is ours, it shows the card in
    // its checklist with the same price, and it keeps the visitor on the site.
    return `      <a class="mw" href="/sets/${esc(c.set)}.html" aria-label="${esc(c.name)} from ${esc(c.setName)}, see the ${esc(c.setName)} set guide">${inner}</a>`;
  })
  .join("\n");

/* ------------------------------------------------ the two sourcing notes --
 *
 * WHY THESE ARE GENERATED AND THE CHROME AROUND THEM IS NOT. public/index.html
 * is one of the three hand-maintained pages, so the paragraph could have been
 * typed straight into it in ten seconds. The date is the reason not to: a date
 * typed into a page is wrong the next time a crawl runs and nobody notices,
 * which is how five pages came to name a feed the site had stopped reading. So
 * the wording sits in a marker pair placed by hand ONCE, and everything inside
 * it, the feed names, the dates and whether there is a graded sentence at all,
 * is derived from the files the tiles above were built from.
 *
 * TWO NOTES, NOT ONE, because they describe two different reads. The shelf's
 * graded figures were last checked days before the grid's, and one note under
 * one band cannot honestly date the other. They sit OUTSIDE .mw-shelf and
 * .set-grid: both are layout containers (a flex scroller and a six-column
 * grid), and a paragraph dropped inside either becomes a column of it.
 *
 * AND THEY DO NOT SHIP ui.css's FONT FOR .price-note, which is the whole of the
 * .price-note override further down in homeCss. The component is Space Mono at
 * weight 400 and this page loads only the 700 cut (space-mono-i6WZ3Q.woff2), so
 * two paragraphs of it fetched space-mono-Xi4EwQ.woff2 as well. Measured on the
 * built page in headless Chrome with the cache off, against the same page with
 * both notes stripped out:
 *
 *     390x844    585,926 -> 597,278 bytes, 19 -> 20 requests
 *     1440x900   607,860 -> 619,210 bytes, 15 -> 16 requests
 *
 * 1.1KB of prose costing 11.3KB and a request, which is the same shape and the
 * same file as the .wdr-ch note in homeCss, found the same way. That comment
 * says CHECK THE WEIGHT BEFORE ADDING A FONT DECLARATION HERE; this is what
 * checking it found. In the body font both notes are free.
 */
const wantedNote = bandNote(wantedLedger, {
  lead: "Raw prices",
  psaLead: "Where a card is marked PSA 10",
  trailing:
    "They are read out of the same set checklists the set guides print from, so the two cannot disagree about one card.",
});
const setsNote = bandNote(setsLedger, {
  lead: "Top card prices",
  psaLead: "Where a set's top card is marked PSA 10",
  trailing: "Each one is the most expensive card on that set's own guide, linked from the tile.",
});
for (const [band, led] of [["Most Wanted", wantedLedger], ["Card Pokedex", setsLedger]]) {
  if (led.unsourced.length) {
    console.log(
      `\n  ${led.unsourced.length} price(s) on the ${band} band have no checklist behind them, so the ` +
        `note under it does not date them: ${led.unsourced.join(", ")}`
    );
  }
}

// The imported set guides live in their own file and are listed on the same
// /sets/ index, so any count of "guides" has to include them.
let intlGuideCount = 0;
try {
  intlGuideCount = Object.keys(
    JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {}
  ).length;
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

/* ------------------------------------------- the two client-rendered grids -
 *
 * BOTH GRIDS USED TO SHIP EMPTY and app.js filled them once videos.json (166KB)
 * resolved. That is a layout shift, not a loading state: the page is short
 * enough before the tiles land that the FOOTER starts INSIDE the viewport, and
 * the arriving content shoves it out. Measured in headless Chrome:
 *
 *   /videos.html     CLS 0.2600 at 1440x900   (FOOTER [0,666,1440,234] -> gone)
 *   /playlists.html  CLS 0.1989 at 1440x900   (FOOTER [0,423,1440,477] -> gone)
 *
 * against a 0.1 budget. THE OBVIOUS FIX DOES NOT WORK ON PLAYLISTS. Reserving
 * height needs a number, and at 1440 the FILLED playlist grid is only 526px
 * tall, which still leaves the footer at 807px, inside a 900px viewport. Any
 * reserve big enough to push the footer out is bigger than the grid ever gets,
 * so the footer would come back UP when the tiles land, and a shift upward
 * counts exactly the same as a shift downward. The only height that costs
 * nothing is the real one, which means rendering the tiles.
 *
 * So the server renders both grids and app.js takes over on the first filter,
 * search or sort. Three things this had to get right:
 *
 * 1. THE MARKUP IS BYTE-IDENTICAL to what app.js's makeCard() and
 *    initPlaylists() build. Not "close enough": generated here, captured from
 *    the browser's own outerHTML, and diffed. 312 library tiles and 20
 *    playlist tiles, zero differences. If you change either side, re-check it
 *    the same way rather than by eye.
 * 2. app.js MUST NOT WIPE IT. It appended a "Loading the bulk..." placeholder
 *    unconditionally, which would have destroyed the static render before
 *    videos.json arrived and traded one flash for another. See initLibrary.
 * 3. THE LABELS COME FROM taxonomy.mjs, not from a third hand-copy. app.js
 *    mirrors that table by hand and title-cases anything missing from it, so
 *    labelOf below reproduces the fallback too: "multi" has no entry and has
 *    to read "Multi" on both sides or the pack brand differs.
 *
 * Cost, measured rather than estimated: all 312 library tiles are 225.1KB raw
 * and 17.8KB gzipped, which is how the host serves them. videos.html goes from
 * 3.5KB to 21.3KB gzipped, against the 33KB of app.js and the 166KB of
 * videos.json the page already fetches. In exchange every rip page picks up a
 * static link from the hub that exists to list them: crawl depth from the home
 * page collapses from a 13-deep tail with 78 pages at depth 4 or worse, to
 * every rip at depth 2 and nothing deeper.
 */
// THE PULL BADGE IS DELIBERATELY SHORTER THAN THE TAXONOMY LABEL. taxonomy.mjs
// calls these "Gold / Hyper Rare" and "Special Illustration Rare", which is the
// right name for a heading and far too long for a chip sitting in the corner of
// a 200px tile, so app.js carries its own six-entry table. Using labelFor here
// put "Gold / Hyper Rare" on 74 of the 312 tiles against app.js's "Gold": found
// by diffing the two renders, which is exactly what that diff is for.
const PULL_BADGE = {
  sir: "SIR", ir: "IR", gold: "Gold", "alt-art": "Alt Art",
  "double-rare": "Double Rare", charizard: "Charizard",
};
// THE PRODUCT LABEL IS THE SHORT ONE WHERE TAXONOMY CARRIES ONE, for the same
// reason PULL_BADGE above is shorter than the taxonomy label: app.js draws this
// page's product filter chips from its own LABELS.products, and that table says
// "ETB". labelFor() returns `label`, which is "Elite Trainer Box", so using it
// for the tile caption would have captioned twelve of the first 48 tiles with a
// name the chip directly above them does not use -- "the product rail and the
// tiles under it disagreed", recorded in CLAUDE.md, word for word again.
const productLabel = (id) => {
  const e = PRODUCT_TYPES.find((p) => p.id === id);
  return e ? e.short || e.label : id;
};
const labelOf = (group, id) => {
  const hit = group === "pulls" ? PULL_BADGE[id] || id
    : group === "products" ? productLabel(id)
    : labelFor(group, id);
  if (hit !== id) return hit;
  return String(id).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};
// libCard below is the SERVER copy of app.js makeCard, so this has to emit the
// same bytes as fmtViews() in public/assets/app.js, singular included. Both now
// defer to viewCount in shared/format.mjs, which app.js restates by hand
// because a browser cannot import it.
const fmtViews = viewCount;
const fmtDate = (iso) => {
  if (!iso) return "";
  const p = iso.split("-");
  return `${MONTHS[Number(p[1]) - 1]} ${Number(p[2])}, ${p[0]}`;
};

/**
 * app.js makePack(), as HTML, with the artwork as an <img> so it can be lazy.
 *
 * THE FACADE IS UNCHANGED AND THE ARTWORK MOVED. It used to be a background on
 * .pack-art, painted by packs.css, and a CSS background can never be lazy:
 * Chrome fetches one for every element in the render tree whether or not the
 * reader scrolls to it. Measured 20 August 2026 on this page with NO scroll at
 * all, cache off, waiting for the network to go quiet, all seven distinct tile
 * files arrived, 279.7KB, and FOUR of the 48 tiles are above the fold at
 * 390x844. That is the same shape as /rarity.html's magnified corners, which
 * went 2,536KB to 388KB on load by becoming lazy img elements under the same
 * facade.
 *
 * .pack--img IS WHAT SWITCHES THE BACKGROUND OFF, at (0,4,0) in packs.css, and
 * it is opt in. The facade app.js builds in the browser carries no img and no
 * such class, so it keeps its background and did not have to change. That
 * matters: this function and app.js makePack are the same component written
 * twice in this codebase, and the one thing they must not do is disagree about
 * what a tile with no artwork looks like.
 *
 * A SET WITH NO MASTER GETS NO IMG. `set` here is app.js's choice rather than
 * faceSet's, deliberately (see libCard), so it can name a set that has only the
 * generated colour design. Emitting an img for one would be a round trip to a
 * file that does not exist.
 *
 * EVERY TILE IS LAZY, THE FIRST FOUR INCLUDED, and that was measured rather
 * than assumed. Marking the four above the fold at 390x844 eager moved the
 * on-load bytes not at all, to a tenth of a kilobyte, and cost 592ms of LCP on
 * a Slow 4G phone over HTTP/2, because an eager tile is discovered during the
 * HTML parse and spends the pipe the render-blocking stylesheet is waiting on.
 * The full pair of tables is in packTileImg in shared/format.mjs. The one
 * element that must not be left to the browser here is tile 0, which is this
 * page's LCP element, and it is not: the head preloads its AVIF by name.
 */
function packFacade(setId) {
  const art = packs.has(setId) ? packTileImg(setId) : "";
  return `<span class="pack pack--${setId} pack--tile${art ? " pack--img" : ""}" aria-hidden="true"><span class="pack-face pack-l">` +
    `<span class="pack-art">${art}</span><span class="pack-brand">${esc(labelOf("sets", setId))}<small>GARBAGE RIPS 585</small></span>` +
    `<span class="pack-seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></span>` +
    `</span></span>`;
}

/**
 * app.js makeCard(), as HTML. Unfiltered, so no preferSet and no rank.
 *
 * THE CAPTION NAMES THE PRODUCT, NOT THE SET, AND THAT IS THE WHOLE POINT OF
 * IT. This page is 48 server-rendered tiles drawn from 6 wrappers, and 36 of
 * the 48 are two of them: pitch-black 24, chaos-rising 12. At 1440 that is 12
 * tiles above the fold showing 2 distinct pictures; at 390 it is 4 showing 2.
 *
 * THE OBVIOUS FIX IS THE WRONG ONE HERE and it is worth saying why, because it
 * is the fix that was right one file over. The rip rails in build-pages.mjs
 * round-robin by product kind. /videos.html cannot: it is a chronological
 * library whose own control says "Newest first", and re-sorting it by product
 * would make that label a lie. libVideos below sorts by `published` and must
 * keep doing so.
 *
 * WHAT WAS ACTUALLY REDUNDANT WAS THE CAPTION. It read "CHAOS RISING • 611
 * VIEWS" under an h3 reading "Chaos Rising Pack" over a pack with CHAOS RISING
 * printed across it: one fact three times, measured at 48 of 48 tiles, while
 * what was opened was only implicit. Swapping the set for the product spends
 * the same field and the same bytes on the one thing the picture cannot say.
 *
 * MEASURE IT AS THE PICTURE PLUS THE CAPTION, NOT THE CAPTION ALONE. "Distinct
 * captions" is a decoy: the view count is on the end of every one of them, so
 * it was already 47 of 48 before this change and is 47 of 48 after. The pair
 * that matters is (wrapper, caption lead), because that is what a reader
 * actually distinguishes two tiles by. Measured off the built tree at both
 * widths: above the fold that pair goes 2 -> 4, and across the 48 it goes
 * 6 -> 13. Six wrappers and six product kinds, but they cross rather than
 * coincide, which is the whole reason the second field is worth its bytes.
 *
 * A TILE WITH NO PRODUCT PRINTS NOTHING RATHER THAN FALLING BACK TO THE SET.
 * That is this function's existing pattern -- 5 videos carry no set and already
 * drop the bit -- and falling back would reintroduce the duplication on exactly
 * the tiles least able to afford it. Today it is unreachable: all 319 videos
 * carry exactly one product, because deriveTags in taxonomy.mjs truncates to
 * one ("a video is only ever ripped from one product at a time"). That is also
 * why neither side writes a "+N", which the set branch above needed.
 */
function libCard(v) {
  const all = v.sets || [];
  // NOT faceSet(). app.js picks the wrapper without consulting which artwork
  // exists, so this has to as well or the two disagree on the pack class.
  let set = all[0];
  if (all.length > 1) set = "multi";
  else if (!set) set = "default";
  const href = v.path ? `/${v.path}` : "/videos.html";
  const pull = (v.pulls || [])[0];
  const bits = [];
  const prod = (v.products || [])[0];
  if (prod) bits.push(labelOf("products", prod).toUpperCase());
  if (v.views) bits.push(fmtViews(v.views).toUpperCase());
  else if (v.published) bits.push(fmtDate(v.published).toUpperCase());
  return `<article class="v"><a class="art" href="${esc(href)}" aria-label="${esc(v.siteTitle || v.title)}">` +
    packFacade(set) +
    (pull ? `<span class="hit">${esc(labelOf("pulls", pull))}</span>` : "") +
    (v.duration ? `<span class="dur">${clock(v.duration)}</span>` : "") +
    RIP_BANNER + `</a>` +
    `<h3><a href="${esc(href)}">${esc(v.label || v.siteTitle || v.title)}</a></h3>` +
    `<p>${esc(bits.join("  •  "))}</p></article>`;
}

/**
 * HOW MANY TILES THE SERVER RENDERS. 48, which is app.js's own PAGE size, so
 * the HTML carries exactly the first page app.js would have built and the Load
 * more flow underneath is unchanged.
 *
 * ALL 312 WAS MEASURED AND REJECTED, and the reason is not the HTML. 312 tiles
 * are 225.1KB raw but only 17.8KB gzipped, which is how the host serves them,
 * so the document was never the problem. The pack wrappers are:
 *
 *   tiles   distinct wrappers   pack art fetched at load   page transfer @1440
 *      48         8                    376KB                       815KB
 *      96         9                    426KB                        --
 *     144        13                    573KB                        --
 *     312        32                    851KB                     1,493KB
 *
 * A wrapper is a CSS background-image on .pack--<set>, so Chrome fetches every
 * one that any element in the render tree references, whether or not it is
 * anywhere near the viewport. Putting all 312 rips on the page brings 24 more
 * sets with it, and 719KB of booster art the visitor has not scrolled to lands
 * on first paint. Measured at 1440x900: 774KB before, 815KB at 48 tiles,
 * 1,493KB at 312. FCP went 112 -> 124 -> 140ms.
 *
 * The SEO case for 312 is real but smaller than it looks. Crawl depth from the
 * home page over the static links, BFS over public/, measured per variant:
 *
 *   0 tiles    depth 2:207  3:155  4:23  5:2    median rip depth 3, max 5
 *   48 tiles         2:217  3:147  4:21  5:2    median 3, max 5
 *   144 tiles        2:285  3:90   4:10  5:2    median 2, max 5
 *   312 tiles        2:387                      median 2, max 2
 *
 * So 312 does flatten it completely, and if someone decides that is worth
 * 719KB, change this number: everything else here already handles it. But CLS,
 * which is what this render exists to fix, is 0 at 48 and 0 at 312 alike.
 *
 * CONTENT-VISIBILITY DOES NOT BUY YOU THE 312, AND IT IS THE OBVIOUS THING TO
 * TRY. The theory is sound: the wrappers are CSS background-images, so if the
 * off-screen tiles are never rendered their backgrounds should never be
 * fetched. It was built and measured on a throwaway copy, `.wall > .v` with
 * `content-visibility:auto` and `contain-intrinsic-size:auto 320px`, 3 runs per
 * variant:
 *
 *              mobile 390            desktop 1440
 *   48 tiles     819KB / 21 reqs      1,038KB / 23 reqs
 *   312 + c-v  1,499KB / 34 reqs      1,717KB / 35 reqs
 *
 * The rule applied: computed contentVisibility was "auto" on a tile measured
 * off-screen. Chrome fetched the backgrounds anyway, so the cost is the same
 * ~680KB it always was. Do not re-run this experiment expecting a different
 * answer; if you want 312, pay for it or make the wrappers <img> so they can
 * be lazy.
 */
const LIB_TILES = 48;
// app.js's default sort: newest first, and it compares the ISO strings rather
// than parsing them. Same comparison here so the two orders cannot differ.
const libVideos = [...videos].sort((a, b) => (a.published < b.published ? 1 : -1)).slice(0, LIB_TILES);
const libHtml = libVideos.map(libCard).join("\n");

/*
 * THE PACK IS /videos.html's LCP ELEMENT AND THE PRELOAD SCANNER CANNOT SEE IT.
 *
 * The identical problem the rip pages had, and this is the identical fix; see
 * the long note beside the preload in scripts/build-pages.mjs for the reasoning
 * and for why type="image/avif" is what makes it safe rather than a gamble.
 *
 * TILE, NOT THE FULL PACK. The rip page preloads
 * `<set>-garbage-rips-585-booster-pack.avif` because its pack is a big hero.
 * Every wrapper on this page carries .pack--tile, and packs.css overrides the
 * background on `.pack--<set>.pack--tile .pack-art` to the `-tile` variant, a
 * different file at ~39KB against ~110KB. Preloading the hero file here would
 * fetch 110KB nothing on the page ever uses AND leave the tile still
 * undiscovered until packs.css parsed: strictly worse than doing nothing.
 *
 * MEASURED, headless Chrome over CDP against a frozen snapshot of public/, so
 * the only thing varying between the rows is this block. 390x844 DPR 2, Slow
 * 4G, 4x CPU slowdown, cache off, 5 runs each, innerWidth asserted at 390 on
 * every run. MEDIANS:
 *
 *      preloads      LCP        FCP     LCP element fetch starts at
 *          0        3920ms     2728ms          +2678ms
 *          1        2932ms     2932ms           +597ms
 *          2        3140ms     3140ms           +597ms
 *
 * ONE. NOT TWO, AND TWO IS THE ANSWER THE REQUEST LOG TALKS YOU INTO: at 390
 * the wall is two columns and Chrome fetches exactly two pack backgrounds in
 * the first wave (chaos-rising, pitch-black), the other six distinct wrappers
 * deferred to +6854ms. So preloading both looks like preloading "the first
 * screen". It measured 208ms of LCP WORSE than preloading one. The second pack
 * is 35.8KB on a 184KB/s pipe that ui.css is still using, and only the first
 * one is ever the LCP element. Preload the LCP element, not the viewport.
 *
 * THE FCP COST IS REAL, IS THE SAME 39.5KB OF CONTENTION, AND IS THE TRADE.
 * First paint goes 2728 -> 2932ms because ui.css now shares the pipe; largest
 * paint goes 3920 -> 2932ms. Both land in the same frame afterwards, which is
 * why the two columns are identical below row 0: the pack is now IN the first
 * paint rather than a second paint 1.2s later. Quote the pair or quote neither.
 *
 * fetchpriority="high" WAS MEASURED AND CHANGES NOTHING HERE, 2932 against
 * 2944ms median with it dropped. The pipe is bandwidth bound rather than
 * priority bound at this profile, so it cannot buy back the FCP either. It
 * stays only because it matches the rip pages, where the same attribute is on
 * the same kind of link, and a reader comparing the two heads should not have
 * to wonder what the difference means.
 *
 * Guarded on the tile file actually existing, not on `packs`, because `packs`
 * is keyed off the full-size .webp: a set could in principle ship a hero and no
 * tile, and a preload pointing at a 404 costs a request and buys nothing.
 */
const packTiles = await dirSet("packs", /-garbage-rips-585-booster-pack-tile\.avif$/);
const LIB_PRELOAD = 1;
const libPreloadHtml = [
  ...new Set(
    libVideos.map((v) => {
      // The SAME wrapper choice as libCard above, and it has to stay that way:
      // preloading a file the tile does not reference is a wasted round trip on
      // the one connection that matters.
      const all = v.sets || [];
      if (all.length > 1) return "multi";
      return all[0] || "default";
    }),
  ),
]
  .filter((s) => packTiles.has(s))
  .slice(0, LIB_PRELOAD)
  .map(
    (s) =>
      `<link rel="preload" as="image" href="/assets/packs/${s}-garbage-rips-585-booster-pack-tile.avif" type="image/avif" fetchpriority="high">`,
  )
  .join("\n");

const playlists = JSON.parse(
  await readFile(join(ROOT, "public/data/playlists.json"), "utf8").catch(() => '{"playlists":[]}'),
).playlists || [];
const videoById = new Map(videos.map((v) => [v.id, v]));

// HOW MANY COVERS LOAD EAGERLY, and 5 is the width of the FIRST ROW rather than
// a guess. `.pl-grid` is `auto-fill minmax(240px,1fr)` with a 20px gap inside a
// `.wrap` capped at 1500px, so the most columns it can ever produce is 5, and at
// 390 it is 1. Every card in that first row is above the fold at every width.
//
// `loading="lazy"` ON A FIRST-ROW IMAGE IS THE BUG CLAUDE.md ALREADY DESCRIBES
// ONCE, in the other direction: the heuristic is VERTICAL, so it is right about
// what is below the fold and says nothing useful about what is beside you. Here
// the whole first row is in the viewport on load, and marking it lazy costs a
// round trip on the only covers anybody sees immediately. The other 16 keep it.
const PL_EAGER = 5;

/** app.js initPlaylists(), as HTML. */
function plTile(p, i) {
  let thumb;
  if (p.cover) {
    // THE COVER IS OURS NOW AND THE YOUTUBE ONE IS GONE. Every card used to
    // carry `p.thumb`, which is YouTube's playlist cover, which is a frame
    // grabbed off the first video in the run. An earlier comment here and in
    // app.js claimed those covers were set by hand and showed the sealed
    // packaging; they were not and they did not. All twenty-one were the same
    // dark shot of a hand holding a card against a wall, so the grid told a
    // reader nothing about which product each run opens.
    //
    // What replaces it is a drawn panel: the actual sealed product on paper with
    // the set logo reversed out on a black band. scripts/sync-playlist-covers.mjs
    // works out which product, scripts/build-playlist-covers.py draws it, and the
    // urls, the size and the alt text are STAMPED onto playlists.json, the same
    // way `path` is, so this and app.js read the answer instead of computing it
    // twice. A playlist with no cover stamped falls through to the pack wrapper
    // below rather than back to YouTube.
    const c = p.cover;
    thumb = `<span class="pl-thumb"><picture><source type="image/webp" srcset="${esc(c.webp)}">` +
      `<img src="${esc(c.jpg)}" alt="${esc(c.alt)}" width="${c.w}" height="${c.h}" decoding="async"` +
      `${i < PL_EAGER ? "" : ' loading="lazy"'}></picture></span>`;
  } else {
    let setId = null;
    for (const id of p.videoIds || []) {
      const s = (videoById.get(id)?.sets || [])[0];
      if (s) { setId = s; break; }
    }
    // THE COVERS' FIRST-ROW RULE DOES NOT APPLY TO THIS BRANCH AND THAT IS
    // MEASURED, not an oversight. Every one of these 22 cards falls through to
    // the pack wrapper, so this branch is the whole grid, and its artwork is now
    // an <img> that can be lazy: with no scroll at all, cache off and the
    // network left to go quiet, this page pulled all twelve distinct tile files,
    // 477.2KB of a 606.5KB page, with four of the 22 tiles above the fold at
    // 390x844. It is 276.9KB across seven now.
    //
    // Marking the first row eager the way the covers are moved ZERO of those
    // bytes and cost 748ms of first paint on a Slow 4G phone over HTTP/2, which
    // on this page is also its LCP because the largest element is text. A cover
    // is one 240px picture and the whole point of the card; a pack tile is a
    // 74px thumbnail on a card whose title is what a reader is scanning for.
    // The tables are in packTileImg in shared/format.mjs.
    thumb = `<span class="pl-thumb pl-thumb--pack">${packFacade(setId || "default")}</span>`;
  }
  // ON THIS SITE. This used to link to youtube.com/playlist, and so did the
  // copy of these cards that app.js builds at runtime. Both now point at the
  // playlist's own page under /playlists/, generated by build-playlists.mjs,
  // which shows the same run in the same order with the packs opening in place.
  //
  // `path` is read from the data, never re-derived from the title here: it is
  // stamped by build-playlists.mjs for the same reason a video's path is
  // stamped by the sync, so three places cannot disagree about a url. A
  // playlist with no path has no page and renders as a card, not a dead link.
  const body =
    thumb +
    `<span class="pl-body"><b class="pl-title">${
      /* A LONE EMOJI ON ITS OWN LINE, on two of the first three cards at 390px.
         "Pitch Black ETB Opening Marathon 🛡️💎" broke between the two emoji and
         put "💎" on line two by itself, inside a .pl-title that is
         -webkit-line-clamp:2, so a widow does not just look wrong, it spends
         half the card's title. The emoji are Tim's own titles and none of them
         is dropped: noWidowEmoji binds the run to the word before it.
         THE aria-label BELOW STILL TAKES THE PLAIN TITLE. It is text, not
         markup, and a span in it would be read out. */
      noWidowEmoji(esc(p.title))
    }</b>` +
    `<span class="pl-count">${p.count}${p.count === 1 ? " video" : " videos"}</span>` +
    (p.path ? `<span class="pl-out">Open the playlist</span>` : "") +
    `</span>`;
  return p.path
    ? `<a class="pl" href="/${esc(p.path)}" aria-label="${esc(
        // Pluralised, like the visible .pl-count beside it. It was not, and a
        // one-video playlist read "1 videos" to a screen reader while the same
        // number two lines up read "1 video". app.js's runtime copy of this
        // card had the same split.
        `${p.title}, ${p.count}${p.count === 1 ? " video" : " videos"}`,
      )}">${body}</a>`
    : `<span class="pl">${body}</span>`;
}
// A playlist with nothing in it is not content, and app.js drops those too.
// The index is passed through because PL_EAGER above counts position in the
// FILTERED list, which is what the grid actually lays out.
const plHtml = playlists.filter((p) => (p.count || 0) > 0).map(plTile).join("\n");

/* -------------------------------------------- this week's drops, in a band -
 *
 * A compact pointer at /drops.html: three rows out of the week's list, high on
 * the page, linking through. Asked for in these words: "easy to just land on
 * home page and see what upcoming pokemon drops to keep an eye out for this
 * week".
 *
 * WHERE IT SITS, AND THE COST OF PUTTING IT THERE. First thing inside <main>,
 * above Greatest Hits. This is the only position that answers what was asked
 * for: at 390x844 the Greatest Hits band alone is 1,656px tall, so anything
 * below it is two screens down and a reader who has to hunt for this week's
 * drops will not come back for them. What that costs is measured rather than
 * waved at: the band is 630px at 390 and 288px at 1440, so the "Greatest Hits"
 * heading sits at 802px on a phone and stays above the fold, and the trophy
 * artwork loses about two thirds of its first-screen showing.
 *
 * RE-MEASURED 17 August 2026 WHEN THE RETAILER MARKS WENT IN, and the earlier
 * figures here (424px band, heading at 791) no longer describe the page: the
 * same harness reads 550 -> 630px and 722 -> 802px across that one change, so
 * the band was already taller than this paragraph claimed before a mark was
 * added. THE SECOND NUMBER IS THE LIVE CONSTRAINT: 802 of an 844px screen is
 * 42px of margin, and the whole case for putting the band first is that the
 * heading under it survives. Re-measure it after anything is added to a row,
 * and do not trust the number written here without checking the date on it. The
 * trade is a strip of text against the top of one booster pack photo, on a page
 * that is 7,267px of the channel's own work either way. If a later editor
 * decides the channel must own the whole first screen, moving this below the
 * .hof section is a one line change in index.html; do not instead shrink it by
 * cutting the lede or the credit, which are the two things it must not lose.
 *
 * IT WAS TEXT AND IT COST NO IMAGE BYTES UNTIL 17 August 2026, when the three
 * rows got the retailers' own marks. That paragraph is kept rather than deleted
 * because the argument in it is still the one to answer before adding anything
 * else here: the home page is the heaviest on-load page on the site and 84% of
 * that is pack art, so a band that fetches anything has to justify itself
 * against the artwork it pushes down.
 *
 * WHAT THE MARKS COST, measured on the built page with one harness, gzipped,
 * cache off, the same band with and without them, and read off the REQUEST LOG
 * rather than off the markup. The figures are in the "4. THIS WEEK'S DROPS
 * BAND" comment beside the CSS below, because that is where somebody deciding
 * whether to add a fourth thing will be reading. The short version is three SVG
 * files, all mirrored locally, none of them hotlinked, and the whole set is
 * smaller than one card scan.
 *
 * THEY ARE lazy AND THAT IS NOT A CONTRADICTION ABOVE THE FOLD. Chrome fetches
 * a lazy image inside or near the viewport anyway, so the attribute costs
 * nothing here; what it buys is that the marks queue behind the artwork rather
 * than in front of it on a slow connection, which is the right order for a
 * picture that only labels a row somebody is already reading.
 *
 * STALENESS IS THE WHOLE RISK AND IT IS WORSE HERE THAN ON /drops.html. "Be
 * ready for a possible drop today" sitting above the fold on the site's front
 * door three days after it was true is the most damaging thing this feature
 * could do. So the band inherits the expiry model from shared/drops.mjs rather
 * than reimplementing it, and it is STRICTER than /drops.html in two ways:
 *
 *   - /drops.html keeps a passed week behind a banner, because last week's
 *     expectations are still worth reading as a pattern. THE BAND DELETES
 *     ITSELF INSTEAD. It is a pointer to what to watch for this week, and last
 *     week's list is not a worse version of that, it is a different thing. The
 *     record stays one tap away on the page that is the record.
 *   - its build clock is the LATER of the drops clock and the real build day.
 *     /drops.html deliberately uses the reproducible clock (newest upload plus
 *     the compiled date) so a stale checkout cannot make an old week look
 *     current. Taking the later of the two can only ever expire MORE rows, so
 *     it keeps that property and adds one: a rebuild that happens after the
 *     week has passed drops the band even if nobody has touched drops.json.
 *
 * And the build-time filter is only half of it. This site's nightly has failed
 * three nights running before now, and CLAUDE.md records that a deploy which
 * stops moving is what turns TODAY into a lie in the largest type above the
 * fold. So the sweep runs AGAIN in the browser on the reader's own clock, and
 * if it takes the last row the band removes itself entirely rather than sitting
 * there as an empty frame. A page nobody rebuilds still tells the truth.
 */
let dropsHtml = "";
const dropsLog = [];
try {
  const doc = JSON.parse(await readFile(join(ROOT, "data/drops.json"), "utf8"));
  const R = doc.retailers || {};
  // The later of the two clocks. See the note above.
  const DROPS_TODAY = [dropsClock(doc, videos), BUILT].sort().pop();

  if (isStale(doc, DROPS_TODAY)) {
    dropsLog.push(`drops band: week ended ${doc.weekEnds}, before ${DROPS_TODAY}. No band.`);
  } else {
    const known = (doc.drops || []).filter((d) => R[d.retailer]);
    const { live, expired } = splitByExpiry(doc, known, DROPS_TODAY);
    const { picked, skipped } = homeBandRows(doc, live);

    // THE COUNT NAMES THE DESTINATION, SO IT IS COUNTED THE WAY THE DESTINATION
    // COUNTS ITSELF. The sweep below was added precisely because "All 9 drops"
    // has to mean the size of the list it points at, and then the server render
    // was handed `known`, which is every row in the file INCLUDING the ones the
    // build had already expired. On 19 August 2026 that put "9 drops" and "All 9
    // drops" on the home page over a /drops.html reading "5 in store, 3 online".
    // The client sweep hid it from anybody running JavaScript, which is what
    // made it survive: it subtracts the same row again on read and lands on 8.
    // With scripts off the front door contradicted the page it linked to.
    //
    // build-drops.mjs splits on dropsClock alone, so that is what this counts
    // on. DROPS_TODAY is deliberately the LATER of that clock and the build day
    // and it stays the filter for the ROWS SHOWN, because a band claiming a drop
    // today is the loudest thing the site can get wrong; but using it for the
    // count would undercount the destination on any day the two clocks differ.
    // data-dx comes off the same list for the same reason: a date already
    // subtracted here must not be handed to the sweep to subtract twice.
    const destLive = splitByExpiry(doc, known, dropsClock(doc, videos)).live;

    // The credit, once, at the foot of the band. On /drops.html it repeats on
    // every card, because there a card is the unit somebody screenshots and it
    // travels without the page's lede. Here the BAND is that unit: it is one
    // bordered strip about 400px tall with its own heading, and nobody crops a
    // single row out of it. What must not be lost either way is the claim the
    // lede makes, so the band carries "community intelligence, not fact" in its
    // own words rather than pointing at the page for it.
    const src = doc.source || {};
    const credit = src.name
      ? `${esc(src.name)}${src.read ? `, read ${esc(longDate(src.read))}` : ""}`
      : "";

    const row = (d) => {
      const r = R[d.retailer];
      const ex = dropExpiresOn(doc, d);
      const dies = isPerishable(doc, d);
      // data-expires and data-perish are the same contract /drops.html stamps
      // on its cards, read by the same predicates. A row with no data-perish is
      // never swept, here or there.
      //
      // THE MARK COMES FIRST AND THE CONFIDENCE CHIP STILL COMES LAST, WHICH IS
      // /drops.html's OWN ORDER. Asked for in these words: "can we add the store
      // logos to these announcements instead of just the box that says pattern
      // only". The chip is not what was being complained about, it is what the
      // row had INSTEAD of a logo, and it is the one thing on this band that
      // must not move: `pattern` is the weakest tier the site has, it exists
      // because no retailer publishes a restock schedule, and a row carrying a
      // retailer's own mark looks more official than the same row in plain text.
      // The logo is exactly the reason the hedge has to be louder, not quieter.
      // If a layout change ever costs the chip its prominence, move the mark.
      return `        <li class="wdr"${dies ? ` data-expires="${esc(ex)}" data-perish="1"` : ""}>
          <p class="wdr-top">${brandMark(d.retailer, r.name)}<b>${esc(r.name)}</b><span class="wdr-ch">${
            d.channel === "store" ? "In store" : "Online"
          }</span><span class="wdr-cf">${esc(CONF_LABEL[d.confidence] || CONF_LABEL.expected)}</span></p>
          ${d.when ? `<p class="wdr-when">${esc(d.when)}</p>` : ""}
          <p class="wdr-what">${esc(d.what)}</p>${
            dies
              ? `\n          <p class="wdr-exp">Off this page after <time datetime="${esc(ex)}">${esc(longDate(ex))}</time></p>`
              : ""
          }
        </li>`;
    };

    if (!picked.length) {
      dropsLog.push("drops band: nothing this week fits the band. No band.");
    } else {
      /* THE SWEEP, RUN AGAIN ON THE READER'S CLOCK.
       *
       * The build already removed the rows it knew had passed, and that is
       * sound as far as it goes. What it cannot see is itself: the page is a
       * static file, so the build's answer is frozen the moment it is written,
       * and a nightly that stops running leaves "be ready for a possible drop
       * today" above the fold on the front door for as long as the deploy sits
       * there. The reader's clock has none of those problems, and this only
       * ever REMOVES: it cannot resurrect a row and it cannot make the band say
       * anything the build did not.
       *
       * Rows go straight out of the DOM rather than being hidden, the same call
       * /drops.html and build-shows.mjs make, and for the same reason: there is
       * nothing to read in a window that has closed.
       *
       * THE WEEK IS CHECKED FIRST AND IT TAKES THE WHOLE BAND. This is where
       * the band parts company with /drops.html: that page bands a passed week
       * and keeps its rows, because it IS the record. A pointer to what to
       * watch for this week has nothing left to point at once the week has
       * gone.
       *
       * AN EMPTY BAND IS WORSE THAN NO BAND: a heading, a disclaimer and a link
       * with nothing between them reads as a broken page and still takes the
       * space it was arguing for. Rule 4 in homeBandRows keeps at least one row
       * that runs to the end of the week, so the last line here is the belt to
       * that braces rather than the expected path.
       *
       * INLINE AND IMMEDIATELY AFTER THE BAND, not deferred and not on
       * DOMContentLoaded, so the band is corrected before it is painted rather
       * than flashing a dead row and then losing it.
       *
       * THE COMMENTS STAY IN THIS FILE AND THE CODE SHIPS BARE, which is the
       * same trade homeCss makes below and for the same reason: this is the
       * most visited page on the site and the block is in the critical path.
       * Written out in full, the argument above cost 1.4KB gzipped of a 13KB
       * document, which is more than the band's markup.
       *
       * THE LINK'S OWN NUMBER IS SWEPT TOO, AND IT WAS THE ONE THING ON THIS
       * BAND THAT WAS NOT. "All 9 drops" names the size of the list it points
       * at, and /drops.html sweeps that list on the reader's clock exactly as
       * the loop above sweeps these three rows, so a count frozen at build time
       * drifts one row at a time and is at its worst the day somebody first
       * sees the site. Driven on the tree built 17 August, with the page's clock
       * faked, the link said 9 every day while the destination showed 8 on the
       * 18th and 6 on the 20th and the 21st.
       *
       * `known` is every row in the file, not the three the band shows, so the
       * band cannot count the destination out of its own DOM. The perishable
       * rows' dates travel on the link in `data-dx` and the sweep redoes the
       * subtraction: same predicate, same clock, same answer /drops.html
       * reaches. 33 bytes of dates and about 190 of script, uncompressed.
       * Non-perishable rows carry no date and are never subtracted, which is
       * what /drops.html does with them: it bands a passed week rather than
       * removing its ordinary rows.
       */
      const sweep = `<script>
(function () {
  var band = document.querySelector(".wdrop");
  if (!band) return;
${CLIENT_DAY_JS}
  function drop() { if (band.parentNode) band.parentNode.removeChild(band); }
  var today = todayIso();
  var ends = band.getAttribute("data-week-ends");
  if (isIsoDay(ends) && ends < today) return drop();
  var rows = [].slice.call(band.querySelectorAll(".wdr[data-perish]"));
  for (var i = 0; i < rows.length; i++) {
    var ex = rows[i].getAttribute("data-expires");
    if (isIsoDay(ex) && ex < today && rows[i].parentNode) rows[i].parentNode.removeChild(rows[i]);
  }
  var lk = band.querySelector("[data-dx]");
  if (lk) {
    var n = +lk.getAttribute("data-dn") || 0, xs = lk.getAttribute("data-dx");
    xs = xs ? xs.split(" ") : [];
    for (var j = 0; j < xs.length; j++) if (isIsoDay(xs[j]) && xs[j] < today) n--;
    lk.textContent = n > 0 ? n + " drop" + (n === 1 ? "" : "s") : "Drops";
    var mr = band.querySelector(".wdrop-more a");
    if (mr) mr.textContent = (n > 0 ? "All " + n + " drop" + (n === 1 ? "" : "s") : "All drops") + " \\u2192";
  }
  if (!band.querySelectorAll(".wdr").length) drop();
})();
</` + `script>`;

      /* COLLAPSED BY DEFAULT, 18 August 2026. This band sits directly under the
       * filter rail and above the Hall of Fame, and open it ran about 900px on
       * a phone: a heading, a four line disclaimer and three rows of week-of
       * August prose before the first video thumbnail. The most valuable thing
       * on the home page is the top hit, and a reader landing on the site was
       * scrolling past a week's restock rumours to reach it. Now one row until
       * somebody asks for it.
       *
       * NATIVE <details>, NOT A JS TOGGLE. It works with the script blocked, it
       * is keyboard operable and announced as expanded or collapsed for free,
       * and this is the most visited page on the site so the cheapest correct
       * thing wins. The summary keeps the h2 so the document outline is
       * unchanged and aria-labelledby still resolves.
       *
       * NO HEIGHT ANIMATION. A <details> cannot animate to auto without JS
       * measuring the panel first, and the usual fake, a max-height guess, is
       * either too small and clips the third row or too large and eases at the
       * wrong speed. An honest instant open beats a transition that jumps.
       *
       * THE COUNT MOVES TO THE SUMMARY AND THE LINK STAYS IN THE BODY. A link
       * inside a <summary> is nested interactive content: the tap toggles and
       * navigates and browsers disagree about which wins. The number is the
       * part a reader needs before deciding to open it, so the number is what
       * the summary carries, and it is swept on the reader's clock exactly as
       * the link was.
       */
      dropsHtml = `<section class="wdrop" aria-labelledby="wdropH" data-week-ends="${esc(doc.weekEnds || "")}">
  <div class="wrap">
    <details class="wdrop-d">
      <summary class="brk wdrop-sum">
        <h2 id="wdropH">Drops to <span class="hl">watch</span> this week</h2>
        <span class="wdrop-n" data-dn="${destLive.length}" data-dx="${esc(
        destLive.map((d) => (isPerishable(doc, d) ? dropExpiresOn(doc, d) : "")).filter(Boolean).join(" ")
      )}">${destLive.length} drops</span>
        <span class="ln" aria-hidden="true"></span>
        <span class="wdrop-chev" aria-hidden="true"></span>
      </summary>
      <div class="wdrop-body">
        <p class="wdrop-lede"><b>Week of ${esc(longDate(doc.weekOf))}.</b> Community intelligence, not fact: nobody
          announces any of this, and <b>these are not our findings.</b> We are passing on what the trackers said,
          in the words they hedged it with.</p>
        <ul class="wdrop-list">
${picked.map(row).join("\n")}
        </ul>
        <p class="wdrop-more"><a href="/drops.html">All ${destLive.length} drops &rarr;</a></p>
        <p class="wdrop-src">${credit || "Community restock trackers"}. Not a retailer speaking. Logos are the retailers&rsquo; own trademarks, here to name the shop and nothing more.</p>
      </div>
    </details>
  </div>
</section>
${sweep}`;
      dropsLog.push(
        `drops band: ${picked.length} of ${live.length} live row(s), ${
          picked.filter((d) => isPerishable(doc, d)).length
        } perishable: ` +
          picked.map((d) => `${d.retailer}/${d.channel}${d.expires ? ` to ${d.expires}` : ""}`).join(", ")
      );
    }
    if (expired.length) {
      dropsLog.push(
        `  ${expired.length} row(s) already past on ${DROPS_TODAY} and never offered to the band`
      );
    }
    // LOUD, BECAUSE THE ALTERNATIVE IS SILENT. A week written in longer prose
    // than last week's would shrink or empty the band with nothing to show for
    // it, and the page would simply stop carrying the feature. Rule 2 in
    // homeBandRows is deliberate, but it should never be invisible.
    if (skipped.long.length) {
      dropsLog.push(
        `  ${skipped.long.length} row(s) too long to print whole, so left off the band (not truncated): ` +
          skipped.long.map((d) => `${d.retailer}/${d.channel}`).join(", ")
      );
    }
  }
} catch (e) {
  // The band is optional. A missing or broken drops.json costs the home page a
  // band, not a build: this script owns the site's most important page.
  dropsLog.push(`drops band: skipped (${e.message})`);
}

/* ------------------------------------------------- the home page's own CSS -
 *
 * A <style> in index.html's head, generated here so the ARGUMENT can live in
 * this file and only the RULES ship. Same trade build-css.mjs makes for
 * ui.css: written out in full, this block was 4.5KB raw and 2.1KB gzipped on
 * top of an 11.7KB document, render blocking, on the most visited page on the
 * site. Comments are free here and cost every visitor there.
 *
 * WHY IT IS NOT IN ui.css. Every selector below exists on this page and
 * nowhere else: `.vcar` and `.hofx` are emitted only by this script, into this
 * one file, checked across public/. So a rule here reaches exactly the page it
 * is about, and the other 425 pages do not pay for it. When ui.css's home page
 * block settles, folding these in is a lift and shift; the breakpoints and the
 * reasoning are already written to match it.
 */

/* 1. THE PLAY PIP ON THE HALL OF FAME TROPHY.
 *
 * `.play` is opacity:0 until :hover in ui.css because it was written for the
 * grid tiles, and `.hero-art .play` already opts back in at .95. This is the
 * same opt-in for the one artwork on the page that is not a `.hero-art`. Same
 * value on purpose, so the trophy's pip matches the seven slide pips beside it
 * rather than reading as a second, louder mark. Opacity only, so there is
 * nothing here for prefers-reduced-motion to switch off.
 */

/* 2. THE CAROUSELS BETWEEN 900 AND 999px.
 *
 * The gap ui.css's desktop block left behind, and the only range left on this
 * page where a band shows one video in a row wide enough for three. Measured
 * in headless Chrome, one slide of the Latest band:
 *
 *     width   slide   artwork   artwork as a share of the slide
 *       768     720       360        50%
 *       820     772       360        47%
 *       900     852       440        52%
 *       999     951       440        46%
 *      1000     391       357        91%
 *
 * At 999 the band paints 46% artwork and 54% empty, and one pixel later it
 * paints 91%. That is not a taper, it is a cliff, and everything on the wrong
 * side of it is a tablet in portrait, a half screen window on a 1440 monitor,
 * or a small laptop.
 *
 * ui.css names this exact failure in its own comment ("a 360px pack marooned
 * in a 720px card with 180px of white either side") and its min-width:900 rule
 * answers it by capping the CARD at 520px and centring it. That stops the card
 * stretching. It does not stop the BAND being half empty, because the slide is
 * still the whole track.
 *
 * So this is the min-width:1000 block run 100px lower, with that block's own
 * numbers rather than new ones. 2.35 slides, the same fraction, so the next
 * card is cut by the band's edge and the row reads as continuing.
 *
 * 2.35 IS CHOSEN BECAUSE IT MAKES 999 AND 1000 THE SAME PICTURE. Artwork is
 * (track - 2 gaps) / 2.35, less 34px of card padding and border: 315px at 900
 * and 357px at 999, against the 357px the min-width:1000 rule computes at
 * 1000. The old boundary stepped 440 -> 357 in a single pixel. This one does
 * not step at all.
 *
 * IT COSTS ARTWORK AT THE BOTTOM OF THE RANGE and that is the trade, not an
 * oversight: 360px down to 315px at 900, in exchange for 2.35 videos instead
 * of one. 2.35 x 315 x 473 against 1 x 440 x 660 is 20% more pack on screen,
 * from a band that stops being half empty. Page height at 900x900 went
 * 7,628px to 7,339px.
 *
 * NOTHING OUTSIDE 900..999 MOVES. 390, 768, 820, 879, 1000, 1200 and 1440 were
 * all re-measured and are identical to the pixel.
 */
/* 3. THE CARD BETWEEN 545 AND 899px, which is the SAME BUG one layout down.
 *
 * ui.css writes it out itself: "Between 768 and 899 it was the other failure,
 * a 360px pack marooned in a 720px card with 180px of white either side." The
 * rule that answers it is min-width:900, so from 545 to 899 the failure it
 * describes is still on the page, exactly as described. Measured card against
 * artwork, one slide of the Latest band:
 *
 *     width   card   artwork   white either side, INSIDE the card
 *       545    521      360        80px
 *       641    617      360       128px
 *       768    720      360       180px
 *       899    851      360       245px
 *
 * And the caption is left aligned to the CARD while the pack is centred in it,
 * so at 768 the title starts 180px to the left of the thing it names. That is
 * the part that reads as broken rather than as roomy.
 *
 * The fix is ui.css's own min-width:900 rule, run from 545 instead: cap the
 * card at 520 and centre it, cap the artwork at 440. Nothing new is invented
 * here, the existing answer is just applied to the whole range it was written
 * for. 545 is where the wrap first exceeds the 520 cap, so below it the card
 * is already the width of the band and there is no gutter to close.
 *
 * IT MAKES THE PAGE LONGER AND THAT IS THE TRADE. The artwork goes 360 to
 * 440px, 22% wider, so at 768 each band gains 144px and the page goes 6,776 to
 * 7,064. On a screen 768px wide that is a fair price for the one thing the
 * band exists to show being a fifth larger and no longer floating.
 *
 * The 545 edge does step the artwork 360 -> 440 in one pixel. Making it fluid
 * instead means raising the art cap from 414 up, which is phone width, and the
 * phone layout is measured and settled; a resize across 544 is not a thing
 * anyone does, and a load either side of it is correct on both sides.
 */
/* 4. THIS WEEK'S DROPS BAND.
 *
 * Text on paper with one keyline under it, no fill, and ONE PICTURE PER ROW:
 * the retailer's own mark. The palette argument still stands and still rules
 * out a tinted "alert" band, this being black, white and gold on purpose; and
 * the band's own content is a list of hedges, so a shouty frame around it would
 * be the page disagreeing with itself. What changed on 17 August 2026 is the
 * artwork rule, and it was asked for: "can we add the store logos to these
 * announcements instead of just the box that says pattern only".
 *
 * THE MARKS ARE NOT A NEW SYSTEM. shared/brands.mjs and the 21 files
 * scripts/sync-brands.mjs mirrors from Wikimedia Commons already dress
 * /buying.html, /selling.html, /retailers.html and, in its retailer chip,
 * /drops.html itself. The band draws the same box from the same module against
 * the same manifest, so the front door and the page it links to are one feature
 * seen twice rather than two features that happen to list the same shops. A
 * retailer Commons has nothing for gets the site's hatched name tile, which is
 * what a set with no logo already gets.
 *
 * THE CONFIDENCE CHIP DID NOT MOVE AND MUST NOT. Read the ask again: the row
 * had the chip INSTEAD of a logo, not as well as one. `Pattern only` is the
 * weakest tier the site has and its own key says no retailer publishes a
 * restock schedule. A row carrying a retailer's mark reads as more official
 * than the same row in plain text, so the hedge is worth MORE next to a logo,
 * not less. If a layout change ever squeezes the chip, move the mark.
 *
 * ONE COLUMN UNDER 900px, THREE ABOVE. The rows are 40 to 130 characters of
 * prose, so a phone gets them stacked and full width; at 900 the wrap is wide
 * enough that three side by side keeps the whole band to one screen band rather
 * than a fourth of the page. 900 rather than 1000 because the rows are text and
 * have none of the artwork-width problem the carousels have at that boundary.
 *
 * WHAT THE MARKS COST, and this is the number to argue with before adding a
 * fourth thing to this band. Measured with one harness, gzipped the way the
 * host serves, cache off, the same tree with and without them, and the mark
 * files read off the REQUEST LOG rather than off the markup:
 *
 *                          on-load           fully scrolled    band height
 *      390x844  DPR 2   354.0 -> 360.6KB    934.6 -> 941.1KB    550 -> 630px
 *      1440x900 DPR 1   439.8 -> 446.4KB   1798.0 -> 1804.6KB   265 -> 288px
 *
 * Three requests, at every width: pokemon-center.svg 2,878B, walmart.svg
 * 2,174B, target.svg 401B over the wire, 5.3KB the set. The document itself
 * went 15,632 to 16,929 bytes gzipped, which is the markup, this block of CSS
 * and BRAND_STYLE_MIN together. So +6.6KB on load, 1.9% of a phone's, against
 * 84% of that page still being pack art.
 *
 * THE ONE FIGURE TO WATCH IS NOT THE BYTES, IT IS 802. The "Greatest Hits"
 * heading sits at y=802 of an 844px phone screen now, where it sat at 722, and
 * the whole case for putting this band first is that the heading under it stays
 * above the fold. 42px of margin is what is left. A fourth row, a taller mark
 * box or one more line of lede spends it. The 96px width cap on .wdr .bmk below
 * is what keeps a two line row from becoming three.
 *
 * Nothing here transitions, animates or transforms, so there is no
 * prefers-reduced-motion case: the band is the same object at both settings,
 * verified under an emulated reduce with the marks decoding.
 */

/* ================================================================== RIPSTATS
 *
 * "The channel, counted": six figures and a source line, between Latest rips
 * and Most wanted.
 *
 * Tim, 22 August 2026: "add a little stats widget to the home page where you
 * can quickly see all of my youtube channel stats, including total number of
 * channel views and all the pack opening info made into a little section on
 * home page as well", and then "put the total number of packs we have ripped
 * overall and the total number of hits we have gotten overall".
 *
 * IT IS A DOORWAY AND NOT A SECOND /luck.html. That page is the whole
 * dashboard: eleven product cards, a run-length chart, a pack-position chart, a
 * month histogram and a method table. What is here is the smallest set of
 * numbers that makes somebody want to open it, plus the two counters that page
 * does not hold at all because they are YouTube's rather than the log's.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIGURE, AND WHERE IT COMES FROM
 * ---------------------------------------------------------------------------
 *   views        rawVideos.channel.views        YouTube channels?part=statistics
 *   subscribers  rawVideos.channel.subscribers  the same call
 *   rips         videos.length                  public/data/videos.json
 *   packs        sum of v.packs                 the rip log, via the sheet
 *   hit cards    rows in data/hits.json         the sheet's My Hits tab
 *   hit rate     hitRips / judged               resolved outcome, see below
 * Nothing is typed and nothing needs hand-editing when the next rip lands.
 *
 * ---------------------------------------------------------------------------
 * THE TWO VIEW COUNTS DISAGREE AND THIS BAND PRINTS ONE OF THEM
 * ---------------------------------------------------------------------------
 * On 22 August 2026 YouTube's channel counter said 265,348 and the 320
 * per-video `views` fields summed to 266,441, a gap of 1,093. Neither is a bug:
 * they are aggregated differently and stamped at different moments.
 *
 * THIS BAND TAKES THE CHANNEL COUNTER, for the reason everything else on this
 * site is sourced the way it is: it is the number YouTube itself publishes on
 * the channel page, so a reader can check it, and the sum is arithmetic of ours
 * that matches nothing anybody can look up. It is also literally what was asked
 * for ("total number of channel views").
 *
 * THE SUM IS NOT PRINTED ANYWHERE, on this page or any other, and it must not
 * be added: two totals for one quantity, on one site, is the top-severity fault
 * here. The per-video figures ARE printed, one per tile, and the source line
 * under this band says in as many words that the channel total is not their
 * sum. Checked across the built tree before this went in: no page stated a view
 * TOTAL of any kind, so this band is the site's first and only one.
 *
 * ---------------------------------------------------------------------------
 * THE RIP FIGURES ARE build-luck.mjs'S RULES, COPIED, AND MUST STAY IN STEP
 * ---------------------------------------------------------------------------
 * The same arrangement retag-videos.mjs has with sync-youtube.mjs, and for the
 * same reason: the rule is short, the two files run in one build, and a shared
 * module would still leave two copies because build-luck.mjs cannot import a
 * builder's private helper without running it.
 *
 * A RIP'S OUTCOME IS KNOWN WHEN THE OWNER HAS SAID SO, AND HE SAYS IT TWO WAYS:
 * he ticks Has Hit, or he writes the cards that came out into the My Hits tab.
 * Naming a card can only ever mean a hit. So `judged` is the rips whose outcome
 * we can determine and `hitRips` is the ones that produced something, which is
 * 154 ticked plus 1 whose only answer is a named card. Take the Has Hit column
 * alone and this band would say 154 of 317 where /luck.html says 155 of 318.
 * See build-luck.mjs, the block above `hitDoc`, for the full argument.
 *
 * VERIFIED AGAINST THE BUILT /luck.html, 22 August 2026: 320 rips, 455 packs,
 * 318 answered, 155 with a hit, 48.7%. Identical, and they have to be.
 *
 * ---------------------------------------------------------------------------
 * "TOTAL HITS" IS TWO NUMBERS AND BOTH ARE ON THE BAND, LABELLED
 * ---------------------------------------------------------------------------
 * 210 is CARDS: a rip that produced three chase cards contributed three rows to
 * the My Hits tab. 155 is RIPS: a rip that produced three counts once. Only the
 * second can carry a rate, because the denominator is rips.
 *
 * PRINTING "210" AND "48.7%" SIDE BY SIDE WITH NO LABELS WOULD BE THE 56%
 * MISTAKE AGAIN, the one on record here where a COVERAGE figure was published
 * as a HIT RATE. So the rate tile names its own numerator and denominator on
 * the tile itself, and the source line says which of the two hit figures counts
 * cards and which counts rips.
 *
 * BOTH AGREE WITH THE PAGES THAT ALREADY STATE THEM. /hall.html: "the rip log
 * records 210 cards" and "155 Printings of 210 pulls". /luck.html: "210 card
 * rows across 155 rips". NOTE THE COLLISION: /hall.html's 155 is PRINTINGS and
 * this band's 155 is RIPS, two different quantities that happen to be equal
 * today. That is why the tile says "155 of 318 answered rips" and not "155".
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 * ---------------------------------------------------------------------------
 * NO MASCOT AND NO PLATE. The plate ornament is one per page and its argued job
 * (shared/format.mjs) is a breather on a page of unbroken prose; this page is
 * bands of pack art and its seams are already marked by .brk. Trubbish means
 * "there is nothing in this one" in three places and Garbodor means "we went
 * through the whole heap" in two, both of them EMPTY states; putting Garbodor
 * on a band of full counters would make it mean a third thing. Text also keeps
 * the load path at zero new requests, which is the constraint that matters most
 * on this page.
 *
 * NO YouTube `videoCount`. It is 320 and so is videos.length, and printing the
 * counter would be a second source for one number that can drift the day a row
 * is hidden on the sheet. The rip count is videos.length, which is what
 * /luck.html counts and what the "All 320" chip above already says.
 *
 * NO NEW REQUEST, NO IMAGE, NO SCRIPT, AND NOTHING IN ui.css. The rules are in
 * homeCss below, which rides in with the document and is never the last
 * render-blocking thing on the page (CLAUDE.md's waterfall note). Space Mono
 * 700 and Titan One 400 are both already on this page, so no font weight is
 * added: see the .wdr-ch note in homeCss for what one stray 400 cost.
 */
const hitRows = JSON.parse(
  await readFile(join(ROOT, "data/hits.json"), "utf8").catch(() => "{}")
).videos || {};

// Rips whose Hit Card cell named something. build-luck.mjs's `namedHitIds`.
const namedHit = new Set(
  Object.entries(hitRows).filter(([, list]) => Array.isArray(list) && list.length).map(([id]) => id)
);
// The resolved outcome: true, false, or null for still unknown.
const outcome = (v) => (typeof v.hasHit === "boolean" ? v.hasHit : namedHit.has(v.id) ? true : null);
const judgedRips = videos.filter((v) => outcome(v) !== null);
const hitRips = judgedRips.filter((v) => outcome(v) === true);
// build-luck.mjs's `packsIn`: a pack count is published only where the sheet
// states one, so `packRips` is smaller than `videos.length` and the source line
// says so rather than letting "455 packs" read as 455 over 320 rips.
const packsIn = (v) => (Number.isFinite(v.packs) && v.packs > 0 ? v.packs : null);
const allPacks = videos.reduce((n, v) => n + (packsIn(v) || 0), 0);
const packRips = videos.filter(packsIn).length;
const hitCards = Object.values(hitRows).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
const hitRate = judgedRips.length
  ? `${Math.round((hitRips.length / judgedRips.length) * 1000) / 10}%`
  : null;

const chStats = rawVideos.channel || null;
const num = (n) => Number(n).toLocaleString("en-US");
const statTile = (big, label) => `      <div class="rstat"><b>${big}</b><span>${label}</span></div>`;

/* A tile is emitted only where the figure exists, so a missing feed is a
 * shorter band rather than a zero. `channel` is absent from any videos.json
 * written before sync-youtube.mjs started keeping it, and data/hits.json is
 * absent on a checkout with no rip log imported; in both cases the band still
 * renders the counters it does have. If NOTHING can be counted there is no
 * band at all, because the markers sit outside the <section> exactly as the
 * drops band's do. */
const ripStatTiles = [
  chStats && chStats.views ? statTile(num(chStats.views), "views on the channel") : "",
  chStats && chStats.subscribers ? statTile(num(chStats.subscribers), "subscribers") : "",
  videos.length ? statTile(num(videos.length), "rips filmed") : "",
  allPacks ? statTile(num(allPacks), "packs ripped on camera") : "",
  hitCards ? statTile(num(hitCards), "hit cards logged") : "",
  hitRate ? statTile(hitRate, `hit rate, ${num(hitRips.length)} of ${num(judgedRips.length)} answered rips`) : "",
].filter(Boolean);

/* THE SOURCE LINE IS THE FEATURE, not a footnote on it. Six numbers with no
 * provenance is the shape of thing this site refuses to ship: two of them are
 * YouTube's and four are ours, one counts cards and one counts rips, and one
 * has a denominator that is not the rip total. Every one of those is said here,
 * in the page's own body face rather than .price-note's Space Mono 400, which
 * is a weight this page does not otherwise load. */
const ripStatsHtml = !ripStatTiles.length
  ? ""
  : `<section class="rstats" aria-labelledby="rstatsH">
  <div class="wrap">
    <div class="brk"><h2 id="rstatsH">The channel, <span class="hl">counted</span></h2><span class="ln"></span><a href="/luck.html">Every rip result &rarr;</a></div>
    <div class="rstats-grid">
${ripStatTiles.join("\n")}
    </div>
    <p class="rstats-src">${
      chStats
        ? `Views and subscribers are YouTube's own counters for the channel, read ${esc(longDate(chStats.readAt))}. ` +
          `The view total is not the sum of the counts on the rip tiles above: YouTube totals the two differently, ` +
          `and this is the one YouTube publishes. `
        : ""
    }The rest is counted out of the rip log.${
      allPacks ? ` Packs is packs opened on camera, over the ${num(packRips)} rips that state a count.` : ""
    }${
      hitCards && hitRate
        ? ` The two hit figures count different things: ${num(hitCards)} is CARDS, so a rip that produced three counts ` +
          `three, and ${num(hitRips.length)} is RIPS, which is what a rate can be taken over. ` +
          `${num(judgedRips.length)} of ${num(videos.length)} rips have an answer.`
        : ""
    }</p>
  </div>
</section>`;

/* ------------------------------------------------- what this site IS, said --
 *
 * THE PROSE IS HERE AND NOT IN index.html, AND THAT IS THE SAME TRADE NOTE 4
 * BELOW MAKES ABOUT THE STYLE BLOCK. index.html SHIPS. An HTML comment in it is
 * bytes on the front door on every cold visit, and stamp-assets.mjs strips
 * comments out of inline <style> blocks and out of nothing else. The first
 * draft of this argument lived beside the h1 and the three markers and cost
 * **2,218 bytes gzipped on index.html**, measured against HEAD; moved here and
 * replaced with five-line pointers it costs 470. build-proto.mjs is not served
 * to anybody, so the argument is free where it is now.
 *
 * THE h1 IS sr-only AND IT STAYS THAT WAY. THIS IS THE DEFENCE THAT WAS
 * MISSING, and the design pass was right that nothing in the repo carried it.
 * It is in the git history instead: fc7fc9dfe, 11 August 2026, "Fix the mobile
 * and accessibility findings", whose message says it in as many words --
 * "Three of four pages had no h1 at all. Outlines began at h2, so the home
 * page, the hunt list and the shops page each presented as a document with no
 * title. The home page's design has no visible page title, so it gets a screen
 * reader one." So the element exists to give the document a title, and sr-only
 * is the form that did that without inventing a page heading the design has
 * never had. It is a decision, not a leftover.
 *
 * AND UN-HIDING IT WOULD COST THE FOLD, WHICH IS THE HALF THAT COMMIT COULD NOT
 * HAVE KNOWN, because the trophy work is nine days younger than it. The h1 is
 * 65 characters at var(--t-l), which wraps to three lines at 375. The stack
 * above the trophy is in note 4 and every pixel in it has already been argued
 * and spent: main's padding-top is 0, .hof's is 8, the heading row is 44 and is
 * held there by a tap target, and the artwork is the last lever and was taken.
 * A visible display h1 puts the Hall of Fame banner under the fold at every
 * phone width. IF TIM WANTS IT VISIBLE THE LEVER IS THE BAND ORDER, not the
 * type size: moving the two DROPS markers below .hof pays 59.41px, which is
 * four times what the h1 needs. CLAUDE.md and note 4 both park that with him.
 *
 * THE PAGE NEVER SAID WHAT IT IS, AND THE ONE ELEMENT THAT DID WAS INVISIBLE.
 * A design pass read the rendered pixels on 22 August 2026: the largest visible
 * type on the first screen, at every width, was "Drops to watch this week" -- a
 * retailer restock band. There was no SENTENCE on that screen at any width, and
 * below 900px the word "Rochester" was not on it at all, because `.brand span`
 * in the header lockup is display:none there. The h1 carries the answer and is
 * `sr-only`; see the comment above it in public/index.html for why that is
 * staying, which is a separate decision from this one.
 *
 * ONE STRING, TWO ELEMENTS, AND THE POINT OF THE TWO REGIONS IS THAT THEY
 * CANNOT DRIFT. Both are written from `siteSay` below, so there is no second
 * copy of the sentence anywhere in the tree to keep in step by hand -- the same
 * arrangement RIP_BANNER has in shared/format.mjs, and for the same reason.
 * Exactly one of the two is ever rendered, so a screen reader hears it once:
 * SAYTOP is display:none at 544 and under, SAYHEAD is display:none above it.
 *
 * WHY IT IS NOT ONE ELEMENT AT THE TOP OF <main>, WHICH IS WHERE IT BELONGS:
 * THERE ARE 9.52 PIXELS THERE AND A LINE OF TYPE IS 13.75. Measured over CDP,
 * bottom edge of .pack-hint on the trophy against this file's own target of
 * viewport-140 (note 4 below): 320x800 has 51.42px of slack, 375x812 has 9.52,
 * 390x844 has 20.72, 414x896 has 39.66. 375 is the binding width and it always
 * was -- it is the shortest viewport that still takes the full 78vw pack. A
 * strip above the drops band was built and measured before this shape was
 * chosen: at --t-micro with no padding at all it costs 13.75px, which busts 375
 * by 4.23 and 390 by nothing to spare. With the 5px of padding it wants, 23.75.
 *
 * SO THE PHONE COPY GOES WHERE THERE IS ALREADY DEAD SPACE, AND THERE IS
 * EXACTLY ONE SUCH PLACE ABOVE THE TROPHY. .hof-head is 44px tall and holds
 * 22.41px of "Greatest Hits": the row is held open by the "All N hits" link's
 * 44px tap target beside it, which note 4 correctly says is not SPENDABLE.
 * Filling it is not spending it. Stacked under the h2 at 4px of gap the column
 * is 22.41 + 4 + 13.75 = 40.16, still under 44, so THE ROW DOES NOT GROW AND
 * THE FOLD DOES NOT MOVE AT ALL: the banner's bottom edge is 662.48 at 375,
 * 683.28 at 390 and 716.34 at 414 before and after, to the pixel.
 *
 * THE ONE WIDTH IT COSTS ANYTHING IS 320, where the column is 187.5px wide and
 * the sentence takes two lines: 9.9px, out of the 51.42 that width has spare.
 * That is the trade written down rather than discovered.
 *
 * THE WORDING IS PICKED FOR THE COLUMN IT HAS TO FIT IN, and the headroom is
 * the reason it is "NY" rather than "New York". The column at 375 is 242.5px
 * (343 of wrap, less the link's 90 and the 12px gap). "Pokemon pack rips from
 * Rochester, New York" renders 227.2px there -- one line, and 15.3px of
 * headroom. "Pokemon pack rips from Rochester, NY" renders 195.3 and has 47.
 * THE DIFFERENCE MATTERS BECAUSE A SECOND LINE AT 375 COSTS 9.91px AGAINST A
 * 9.52px BUDGET: it is the one width where wrapping this sentence puts the
 * trophy banner under the fold. 47px of headroom survives a four-digit hit
 * count widening the link beside it and a fallback face rendering wider than
 * Outfit before the webfont lands; 15.3px does not. The h1 and the about band
 * both still spell "Rochester, New York" in full, so nothing is lost to search.
 *
 * BODY FACE AT 700, NOT SPACE MONO, AND NOT A NEW WEIGHT. It is a sentence
 * rather than a label, so it is set as one; Outfit 700 is already on this page
 * (`.hof-head a` right beside it is `700 var(--t-sm)/1 var(--body)`), so no
 * font file is added. See the .wdr-ch note in homeCss for what one stray
 * weight declaration cost above the fold on this same page.
 */
const siteSay = SITE_SAY;
// ui.css's own .wrap on the outer box, so the sentence starts on the same
// gutter line as every heading under it rather than inventing a second one.
// BOTH REGIONS RENDER EMPTY NOW. The sentence moved into the header, under the
// wordmark, at every width -- see SITE_SAY in shared/chrome.mjs. Leaving these
// two as empty strings rather than deleting the regions keeps the markers in
// public/index.html valid, which the loop below still requires, and keeps the
// fold arithmetic above readable as the history of why the pair existed.
// siteSay is still read by the counters note below, so it stays declared.
const sayTopHtml = "";
const sayHeadHtml = "";
void siteSay;

/* --------------------------------------------------- Rochester on the page --
 *
 * /rochester.html WAS NOT LINKED FROM <main> ONCE. Measured 22 August 2026 over
 * every href inside <main> on the built page: 78 links, 60 distinct targets, and
 * the Rochester hub was not among them. It was reachable from the footer's
 * "Local scene" column, at 85 to 89% of the page's height, and from the closed
 * menu drawer, and from nowhere else. Rochester is the second group in NAV and
 * the second thing Tim asked to highlight ("I want to be a hub for the local
 * community ... this area is massive for pokemon cards and i want the world to
 * know"), so a front door that never points at it is the site disagreeing with
 * its own nav.
 *
 * THE FIGURES ARE RE-COUNTED HERE AND THAT IS A KNOWN COST, SO IT IS WRITTEN
 * DOWN AND PRINTED. build-rochester.mjs owns these three rules; this band
 * copies them, which is the same arrangement the counters band above has with
 * build-luck.mjs and carries the same hazard: two files computing one number is
 * how a site comes to print two answers to one question. The mitigations are
 * the ones that band uses. The rules are one line each and are copied exactly,
 * the source line below says which files they come from, and the run prints
 * them at the end so a person running this by hand can hold them against
 * /rochester.html's own counted cards without opening the page. IF THEY EVER
 * DISAGREE, ONE OF THE TWO FILES HAS CHANGED ITS RULE AND THE SITE IS
 * CONTRADICTING ITSELF; fix the rule, do not edit a number.
 *
 * NOTHING IS FETCHED AND NO NEW FILE IS INVENTED. All three are already in the
 * tree and are read by build-rochester.mjs, /card-shows.html, /shops.html and
 * /garbage-plate.html today.
 *
 * A TILE IS EMITTED ONLY WHERE THE FIGURE EXISTS and the whole band disappears
 * if none of them do, because the markers sit OUTSIDE the <section> exactly as
 * the drops band's and the counters band's do. An empty frame with a heading on
 * it is worse than no band.
 *
 * THE SHOWS FIGURE IS THE ONE THAT MOVES ON A CLOCK and it is the only one that
 * can go stale between deploys. It can only ever over-state, never under-state:
 * a show that has happened stays in the count until the next build. /rochester
 * .html carries exactly the same exposure with exactly the same filter, so this
 * band cannot be more wrong than the page it points at, and the label says
 * "coming up" rather than naming a date. THE ONE THING NOT TO DO HERE is give
 * it the drops band's client sweep: that band removes rows because "be ready
 * for a drop today" above the fold is the loudest lie the site can tell, and
 * this is a count 2,000px down with no date in it.
 *
 * NO PACK COUNT, NO VIEW COUNT, NO HIT RATE. Those are the counters band's,
 * eight hundred pixels up, and repeating one here would be the second source
 * for a number this page already prints once.
 */
const rocShowsDoc = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8").catch(() => "{}"));
const rocShopsDoc = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8").catch(() => "{}"));
const rocPlateDoc = JSON.parse(await readFile(join(ROOT, "data/garbage-plate.json"), "utf8").catch(() => "{}"));
// build-rochester.mjs's `upcoming`, filter and all. BUILT is this file's own
// localDay(new Date()) and is the SAME three lines shared/today.mjs exports and
// build-rochester.mjs imports, so the two pages filter on the same day. NOT
// toISOString: after 8pm in Rochester UTC is already tomorrow, which is the bug
// recorded above BUILT, and it would sweep a show off this count on the evening
// BEFORE it happens.
const rocToday = BUILT;
const rocShows = (rocShowsDoc.shows || []).filter((s) => s.date >= rocToday).length;
const rocShops = (rocShopsDoc.shops || []).length;
const rocPlates = (rocPlateDoc.places || []).length;

const rocTile = (big, label, href) =>
  `      <li><a href="${href}"><b>${big}</b><span>${label}</span></a></li>`;
const rocTiles = [
  rocShows ? rocTile(num(rocShows), rocShows === 1 ? "card show coming up" : "card shows coming up", "/card-shows.html") : "",
  rocShops ? rocTile(num(rocShops), rocShops === 1 ? "card shop" : "card shops", "/shops.html") : "",
  rocPlates ? rocTile(num(rocPlates), rocPlates === 1 ? "place serves a plate" : "places serve a plate", "/garbage-plate.html") : "",
].filter(Boolean);

/* THE SENTENCE IS THE HUB'S OWN FIRST LINE, not a new one written for this
 * band. /rochester.html opens "This is a card town and most of the internet has
 * no idea", and that is the best sentence on the site for what this band is
 * for; a paraphrase here would be the same claim in two voices. The clause
 * after it is shortened from the hub's own, because the hub is listing what is
 * ON it and this band is saying where to go.
 *
 * NO LINK INSIDE THE SENTENCE, AND THERE WAS ONE AND IT WAS TAKEN OUT. "one
 * page" was an anchor to /rochester.html and it MEASURED THE SAME COLOUR AS THE
 * PROSE AROUND IT, rgb(201,209,204) for both, read off rendered pixels rather
 * than off the token: ui.css gives a bare <a> inside a <p> in a new section no
 * route colour at all, so it was a link nothing marked as one. That fails this
 * site's accent rule in the way that matters ("teal is how you get around"),
 * and the band already carries its route in the .brk beside the heading plus
 * three counted links under it. The fix was to DELETE the fourth rather than to
 * paint it: a labelled control at the end of a heading row is the shape this
 * file uses everywhere else, and a route buried mid-sentence is the shape
 * CLAUDE.md complains about. */
const rocHtml = !rocTiles.length
  ? ""
  : `<section class="roc" aria-labelledby="rocH">
  <div class="wrap">
    <div class="brk"><h2 id="rocH">Rochester, <span class="hl">New York</span></h2><span class="ln"></span><a href="/rochester.html">The local scene &rarr;</a></div>
    <p class="roc-lede">This is a card town and most of the internet has no idea. The shows, the shops, the people who sell and film around here, and the dish the channel is named after are all on the local scene page.</p>
    <ul class="roc-counts">
${rocTiles.join("\n")}
    </ul>
    <p class="roc-src">Counted on the day this page was built, out of the same records the local scene page counts. Shows are the ones still to come, so between deploys that figure can only ever be too high, never too low.</p>
  </div>
</section>`;

// ---------------------------------------------------------------------------
// THIS SITS IN JS AND NOT BESIDE THE DECLARATIONS IT DESCRIBES, because the
// style block below ships to the browser verbatim: nothing strips comments out
// of a page-level <style> the way build-css.mjs strips them out of ui.css, so
// prose written in there is render-blocking page weight. Measured when these
// notes were first written into the CSS: +1,411 bytes gzipped on /rarity.html,
// +634 on /will-it-grade.html, +519 on /index.html and +459 on /start.html.
//
// A ROTATED SQUARE PAINTS OUTSIDE ITS OWN LAYOUT BOX, which is why this chevron
// was the only thing on the home page hanging into the page gutter. The element
// is 11x11 and transform does not change layout, so flex lays it out 11px wide
// and ends it exactly on the wrap's right edge, while rotate(45deg) paints it
// 11 * sqrt(2) = 15.556px wide about its centre. Measured at both 320 and 390:
// the tip painted at 306.28 and 376.28 against limits of 304 and 374, so 2.28px
// of it sat in the gutter at every width.
// --chev-bleed IS THE ARITHMETIC RATHER THAN THE ANSWER, so a change to the
// 11px does not silently leave the number 2.28 behind: it is half the
// difference between the painted diagonal and the laid-out side. The margin
// pulls the layout box in by exactly that, which lands the painted tip ON the
// gutter line instead of past it. THE OPEN STATE HAS TO RESTATE IT: margin is
// a shorthand and margin:5px 0 0 was zeroing the right side, at a higher
// specificity than any longhand written above it.
// ---------------------------------------------------------------------------
const homeCss = `<style>.hofx-art .play{opacity:.95}
/* The heading is ui.css's own .brk, the same object "Latest rips" and "Card
   Pokedex" use further down the page, so the band arrives in the page's own
   grammar rather than inventing a fifth heading treatment above the fold. It
   also costs nothing: heading, rule, link, right aligned, already written. The
   week label went into the lede instead, which is where a reader looking for
   "is this current" reads next anyway. */
.wdrop{border-bottom:3px solid var(--keyline);background:var(--paper-2);padding:var(--s4) 0}
.wdrop-d{margin:0}
.wdrop-sum{min-height:56px;margin:0;cursor:pointer;list-style:none;-webkit-tap-highlight-color:transparent}
.wdrop-sum::-webkit-details-marker{display:none}
.wdrop-sum::marker{content:""}
.wdrop-n{flex:none;font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.04em;text-transform:uppercase}
/* --chev-bleed: see the note above homeCss. */
.wdrop-chev{flex:none;width:11px;height:11px;--chev-bleed:calc((11px * 1.41421356 - 11px) / 2);
  margin:0 var(--chev-bleed) 5px 0;border-right:3px solid var(--ketchup-deep);border-bottom:3px solid var(--ketchup-deep);transform:rotate(45deg)}
.wdrop-d[open] .wdrop-chev{margin:5px var(--chev-bleed) 0 0;transform:rotate(-135deg)}
.wdrop-body{padding-top:var(--s4)}
.wdrop-more{margin-top:var(--s4)}
.wdrop-more a{display:inline-flex;align-items:center;min-height:44px;font:700 var(--t-sm)/1 var(--body);color:var(--ketchup-deep)}
.wdrop-more a:hover{text-decoration:underline}
.wdrop-lede{font-size:var(--t-sm);line-height:1.4;color:var(--ink-2);max-width:52em;margin-bottom:var(--s4)}
.wdrop-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr;gap:var(--s3)}
@media(min-width:900px){.wdrop-list{grid-template-columns:repeat(3,1fr);gap:var(--s5)}}
.wdr{border-left:3px solid var(--keyline);padding-left:var(--s3);min-width:0}
.wdr-top{display:flex;align-items:center;flex-wrap:wrap;gap:var(--s2)}
.wdr-top b{font:700 var(--t-label)/1.1 var(--body);letter-spacing:.04em;text-transform:uppercase;color:var(--ink)}
/* THE RETAILER MARK. shared/brands.mjs's box, the same one /drops.html draws in
   its retailer chip, so the band and the page it links to are visibly one
   feature rather than two takes on the same list. */
${BRAND_STYLE_MIN}
/* A SHORTER BOX THAN THE 34px ONE THE LONG PAGES USE, and it is the only thing
   about the mark this band changes. A drops card on /drops.html is 3px of
   keyline around 200px of prose and the chip is its heading; a band row here is
   four lines of text against a hairline, at a third of the width on a desktop,
   and 34px of logo is then the tallest thing in the row. 26px keeps the mark
   the second thing the eye lands on rather than the first, which is the correct
   order for a row that is somebody's guess about a shop.

   THE WIDTH CAP IS WHAT KEEPS THE CONFIDENCE CHIP WHERE IT IS. At 390 the row
   has 326px to spend. 96px of mark leaves the retailer name beside it and puts
   the channel and the chip together on the second line, directly under the
   logo, at the size they already were. A 124px cap pushes the name onto its own
   line and strands the chip two lines below the mark it is hedging. */
.wdr .bmk{height:26px;min-width:44px;max-width:96px;padding:3px 7px;gap:8px}
/* THE NAME TILE IS THE ONE THING ALLOWED TO BE TALLER, because it holds words
   rather than a drawing and 26px of fixed height clips the second line of one
   silently. No retailer in data/drops.json needs it today, every one of the six
   resolves to a mirrored mark; this is here so that adding a seventh that
   Commons has nothing for costs the band a slightly uneven row instead of half
   a word. Clipping is the failure mode that looks intentional. */
.wdr .bmk-n{height:auto;min-height:26px}
/* 700, NOT 400, AND IT IS WORTH 9.4KB ABOVE THE FOLD. Every other Space Mono on
   this page is bold, so a single 400 declaration here fetched a second weight
   file, space-mono-Xi4EwQ.woff2, that nothing else on the home page wanted:
   9.4KB and one request, seven times the whole band's 1.3KB of markup. Caught
   by diffing the request log against the same page with the band stripped out,
   which is the only way it shows up: the markup, the CSS and the rendering all
   look correct. The channel reads as secondary through colour instead, which
   costs nothing. CHECK THE WEIGHT BEFORE ADDING A FONT DECLARATION HERE. */
.wdr-ch{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
/* The confidence rung, in the hatch /drops.html gives its weakest tier. Every
   row that reaches this band is 'expected' or weaker, so one treatment is
   honest here; the four-rung ladder stays on the page that explains it. */
.wdr-cf{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink);
  padding:3px 7px;border-radius:5px;border:1.5px dashed var(--ink-2);
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.wdr-when{font:700 var(--t-sm)/1.3 var(--body);color:var(--ink);margin-top:2px}
.wdr-what{font-size:var(--t-sm);line-height:1.35;color:var(--ink-2)}
.wdr-exp{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2)}
.wdrop-src{font-size:var(--t-micro);line-height:1.45;color:var(--ink-2);margin-top:var(--s3);max-width:52em}
/* THE .wdr-ch TRAP ABOVE, FIRING AGAIN. ui.css's .price-note is Space Mono 400,
   the one weight this page does not already load, so the two sourcing notes
   fetched a second cut: +11,352 bytes and a request for 1.1KB of prose,
   measured. Body font instead, which is what .wdrop-src right above uses for
   the same job. The rest of the component is ui.css's and is untouched.
   Scoped, because .price-note is not a home-page-only selector. */
.mwband .price-note,.pokedex .price-note{font-family:var(--body)}
/* ---------------------------------------------------------------- RIPSTATS.
   The counters band between Latest rips and Most wanted. What every figure is
   and where it comes from is argued above ripStatsHtml in build-proto.mjs.

   THE TILE IS /luck.html'S OWN .luck-stat, DELIBERATELY AND ALMOST TO THE
   DECLARATION: same --card ground, same --hair hairline, same --lift, a Titan
   One number over a Space Mono label at --t-micro in --ink-2. This band is a
   doorway to that page, and a doorway that looks like the room it opens onto is
   one less thing for a reader to learn. It is also the safe colour choice: that
   exact pairing is inside the 0-AA-failures sweep of 18 August 2026.

   THE NUMBER IS --t-l WHERE .luck-stat b IS --t-xl, AND THAT IS ARITHMETIC
   RATHER THAN TASTE. --t-xl tops out at 44px. Six tiles across a 1,452px wrap
   is a 242px tile and a 183px content box after padding and borders, and
   "265,348" is seven Titan One glyphs, about 26px each at 44px, so 182 against
   183. One pixel of headroom is not headroom, and an over-wide number in a grid
   item sets the track's min-content width and pushes the page sideways, which
   is the /topps-card-values.html <code> bug in a different costume. --t-l tops
   out at 32px and the same string measures about 133px.

   THE SECTION HAS NO BACKGROUND OF ITS OWN. .mwband directly below it is a
   full-width --card band and these tiles are --card, so painting this band
   --card too would run the two together and six cards would read as one slab.
   The page green between them is the separation, which is what the bottom
   padding is buying.

   2 / 3 / 6 COLUMNS, FIXED COUNTS RATHER THAN auto-fit, AND EVERY ONE OF THEM
   DIVIDES SIX EXACTLY. auto-fit with a 150px floor gives four and five columns
   through the middle of the range, and five into six strands one tile alone on
   a row: the same orphan .luck-head has to fix by spanning its last child. Six
   across wants about 170px of content per tile for the widest number, so the
   last step waits until 1200 instead of 1000. */
.rstats{padding:var(--s6) 0}
.rstats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s3)}
@media(min-width:600px){.rstats-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1200px){.rstats-grid{grid-template-columns:repeat(6,1fr)}}
.rstat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift);min-width:0}
/* THE NARROWEST PHONE IS WHERE THIS RUNS OUT AND HERE IS THE ARITHMETIC, so
   nobody has to rediscover it the day the channel passes a million views.
   Titan One digits measure about 0.581 x the font size, and --t-l floors at
   22.4px, so a digit is 13.01px. At 320 the tile is 132px and 16px of padding
   either side leaves 100, against 91.09px for "265,348". That is 8.91px of
   headroom and ONE more character does not fit. Side padding drops to --s3 at
   360 and under, which buys 8px and takes it to 16.91. A SEVEN FIGURE VIEW
   COUNT STILL WILL NOT FIT AT 320: nine glyphs is 117px against 108, so when
   this channel gets there the number wants --t-m below 360, not another 4px of
   padding. */
@media(max-width:360px){.rstat{padding:var(--s4) var(--s3)}}
/* overflow-wrap IS THE FLOOR UNDER THAT, and it is not decoration: a grid
   item's default minimum is its MIN-CONTENT width, so an unbreakable number
   one pixel too wide does not clip, it widens the track and then the document,
   which is the /topps-card-values.html <code> bug exactly. A number broken
   across two lines looks wrong and can be seen; a page 12px wider than the
   phone does not look like anything. */
.rstat b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ink);
  margin-bottom:6px;overflow-wrap:anywhere}
.rstat span{display:block;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}
/* Body face, not .price-note's Space Mono 400. This page loads Space Mono at
   700 only, and a single 400 declaration on it fetches a second weight file:
   see the .wdr-ch note above, where that cost 9.4KB above the fold. */
.rstats-src{font-size:var(--t-micro);line-height:1.5;color:var(--ink-2);
  margin-top:var(--s4);max-width:60em}
/* 5. WHAT THIS SITE IS, SAID ON THE FIRST SCREEN. Argued in full above
   siteSay in build-proto.mjs, which is where the fold arithmetic and the
   two-element reason are written; the two rules that matter are here. There
   are 9.52 above the trophy at 375, so the phone copy lives in .hof-head's
   existing 44px row instead of taking a row of its own. */
.hsay{margin:0;font:700 var(--t-micro)/1.25 var(--body);color:var(--chrome-dim)}
/* THE COLUMN IS display:contents ABOVE 544 SO THE DESKTOP ROW IS THE ONE IT
   ALWAYS WAS. The wrapper exists only to stack the heading and the sentence on
   a phone; letting it be a real box at every width would put the h2 and .sub2
   into a column on a desktop and grow that row. contents makes its children the
   flex items of .hof-head directly, which is exactly the markup that shipped
   before this change. .hof-head itself is NOT touched, deliberately: it is on
   /hall.html as well, and that page slices its <head> out of index.html and so
   carries this block verbatim. .hof-ht and .hsay are new names and match
   nothing there. */
.hof-ht{display:contents}
.hsay-in{display:none}
/* --ink AND NOT --ink-2 ABOVE 544. This is the page saying what it is, in
   first position, and a caption colour reads as a caption. It measured 8.12:1
   at --ink-2 and 9.29 at --ink off rendered pixels, so this is a legibility
   gain as well. It stays --chrome-dim on the phone, where the same sentence
   sits on .hof's dark band under a heading rather than alone on the page. */
.hsay-top .hsay{color:var(--ink);font-size:var(--t-sm)}
.hsay-top{padding-bottom:var(--s3)}
/* 6. ROCHESTER. Argued above rocHtml in build-proto.mjs. .brk, .hl and .wrap
   are ui.css's own, so the band arrives in the page's grammar; the new rules
   are the counts
   row, and it is a ROW rather than a second .rstat card grid on purpose. The
   counters band 800px above it is six of those cards, and three more of the
   same object under a different heading is how a page grows two navigation
   systems that look alike (which is the tools band's own diagnosis). */
.roc{padding:var(--s6) 0}
.roc-lede{font-size:var(--t-sm);line-height:1.45;color:var(--ink-2);max-width:46em;margin:0}
.roc-counts{list-style:none;margin:var(--s4) 0 0;padding:0;
  display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3)}
/* min-width:0 IS THE FLOOR UNDER THE TRACKS, same rule the .rstat note above
   gives: a grid item's default minimum is its MIN-CONTENT width, so a long
   label widens the track and then the document rather than wrapping. */
.roc-counts li{min-width:0}
.roc-counts a{display:block;border-left:3px solid var(--keyline);padding-left:var(--s3)}
.roc-counts b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep);
  margin-bottom:6px;overflow-wrap:anywhere}
.roc-counts span{display:block;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}
.roc-counts a:hover span{text-decoration:underline}
.roc-src{font-size:var(--t-micro);line-height:1.5;color:var(--ink-2);
  margin-top:var(--s4);max-width:60em}
@media(min-width:545px) and (max-width:899px){
.vcar .hero{max-width:520px;margin:0 auto;padding:var(--s5)}
.vcar .hero-art,
.vcar .tile-stage{max-width:440px}
}
@media(min-width:900px) and (max-width:999px){
.vcar-slide{flex:0 0 calc((100% - 2 * var(--s4)) / 2.35);scroll-snap-align:start}
.vcar .hero{max-width:none;margin:0;padding:var(--s4)}
.vcar .hero-art,
.vcar .tile-stage{max-width:none}
.vcar .vcar-bar{justify-content:flex-start}
.hof .vcar-slide{flex:0 0 calc((100% - var(--s4)) / 2)}
}
@media(max-width:544px){
.hof .shelf{display:none}
.vcar-slide:not(:first-child){display:none}
.vcar-bar{display:none}
/* 4. THE FOLD. Argued in full in note 4 below this template. */
main{padding-top:0}
.wdrop{padding:6px 0}
.wdrop-sum{min-height:44px;row-gap:6px}
/* 5, the phone half. The column stacks the sentence under "Greatest Hits"
   inside the 44px row that link's tap target already holds open: 22.41 + 4 +
   13.75 = 40.16, so the row does not grow and the trophy does not move. The
   .sub2 beside it is already display:none here (ui.css, max-width:560), so
   exactly one line ever occupies this slot. Full argument above siteSay. */
.hof-ht{display:flex;flex-direction:column;gap:4px;min-width:0}
.hsay-in{display:block}
.hsay-top{display:none}
}
/* ONE COLUMN ONLY AT 359 AND UNDER, NOT AT 544 AND UNDER, AND THE NUMBER IS
   MEASURED. Three tracks at 390 is 110px each and the longest label, PLACES
   SERVE A PLATE, is 146px at 11px mono with .06em of tracking, so it takes two
   lines and the row is 57px. Stacked, the same three are 160.1px. Below 360 the
   track is 85px and the same label goes to three lines with the words broken
   oddly, which is where a row stops being a row. */
@media(max-width:359px){
.roc-counts{grid-template-columns:1fr;gap:var(--s4)}
}</style>`;
/* 3. ONE VIDEO PER BAND ON A PHONE, max-width:544px. LAYOUT ONLY: three
 * display rules, no colour, no spacing, nothing that changes above 544.
 *
 * Tim, 18 August 2026: "only update to the home page on mobile is to only show
 * 1 video for each section, so show the Hall of fame video, but no other
 * greatest hits videos, then show the latest rip video but no other videos on
 * home page for now." So Greatest Hits keeps the trophy and loses the whole
 * shelf, and Latest rips keeps slide 0 and loses the other four.
 *
 * DESKTOP IS UNTOUCHED AND WAS MEASURED TO BE, not assumed, at 1440x900 DPR 1
 * against the same tree with and without these five lines: 5 tiles in each band
 * before and after, 381.6 -> 381.7KB on load with 6 image requests either way,
 * 1,739.8 -> 1,739.9KB fully scrolled with 42 either way, page height 5,673px
 * identical, and the same LCP element (a Greatest Hits slide's pack art, which
 * is what the note above about four square pixels is describing). The 0.1KB is
 * these rules in the gzipped document. index.html's own diff is the media query
 * and nothing else.
 *
 * 544 IS THE SITE'S OWN PHONE LINE, not a new number: it is the breakpoint the
 * Hall of Fame frame's own `sizes` already turns on ("(max-width:544px)
 * calc(100vw - 64px)"), the width at which .hofx stops growing with the
 * viewport and pins at 480, and the top of the range where a carousel shows one
 * slide anyway. Between 545 and 899 the bands are unchanged, because that range
 * is a tablet and Tim asked about a phone.
 *
 * THE BAR GOES WITH THE SLIDES AND IT HAS TO. `.vcar-bar` reads "1 / 5" off
 * list.length at build time, so leaving it under a band showing one video would
 * be a counter describing tiles that are not there, next to two arrows with
 * nowhere to travel. packplayer.js's own .is-static would hide it a moment
 * later anyway (syncCarousel toggles it when scrollWidth fits clientWidth, and
 * with four slides display:none it does), but that is JavaScript arriving after
 * first paint, and a reader with JS off would keep the counter forever.
 *
 * THE COUNT LINKS ARE NOT TOUCHED AND MUST NOT BE. "All 10 hits" and "All 316"
 * count the DESTINATION pages, /videos.html?pull=1 and /videos.html, not the
 * tiles in the band. They are the only way onward from a band showing one
 * video, so they matter MORE here, not less, and both headings and both links
 * stay at every width.
 *
 * THE LCP IS STILL THE TROPHY AND IT IS STILL NOT LAZY, which is the one thing
 * a band cut to a single tile could quietly break. At 390x844 DPR 2 the LCP is
 * the .hofx-art image, 326x580 at y=295, the same element and the same file as
 * before, and it keeps its fetchpriority="high" and no `loading` attribute. The
 * Latest band's surviving slide DOES keep loading="lazy" and should: that band
 * now starts at y=1,131 of an 844px screen, so it is still below the fold and
 * lazy is doing the job it was written for. Nothing above the fold is lazy.
 *
 * The boundary is exact, driven at four widths: 544 shows one tile per band and
 * no pager, 545 and 768 show five and five with both pagers, 1440 the same.
 * scrollX is 0 after scrollTo(400,0) at every one of them, one h1 throughout,
 * and with lazy forced every image the phone lays out resolves to pixels.
 *
 * THIS IS A CSS CUT AND THE ALTERNATIVE WAS MEASURED BEFORE IT WAS REJECTED.
 * The case against hiding tiles in CSS is that a phone still downloads every
 * hidden tile's artwork, which is the opposite of what "show less on mobile" is
 * for. That case does not hold on this page, and here is the request log that
 * says so. 390x844 DPR 2, gzipped, cache off, filenames read off the network:
 *
 *                      on-load    img reqs   fully scrolled   img reqs
 *      before          345.5KB        4          814.3KB         16
 *      after           389.9KB        9          717.3KB         15
 *
 * NOT ONE HIDDEN TILE FETCHES ITS PACK ART. The Latest band's slides 1 to 4
 * were already deferred (`defer: i > 0` in carousel()), so a phone never asked
 * for them. The Greatest Hits shelf's slide 0 DOES carry a real src, and it is
 * still not fetched, because heroTile puts `loading="lazy"` on it and a lazy
 * image inside a display:none container never enters the viewport, so the load
 * never fires. multi-...-booster-pack.avif, 97KB, is on the before log and on
 * neither after log. A build-time cut would have removed the same 97KB and
 * nothing else, at the price of removing the tiles from the desktop too, which
 * is the one thing this change may not do.
 *
 * **THAT SAVING IS LOAD-BEARING ON `loading="lazy"` AND NOWHERE ELSE.** If a
 * later edit makes the Greatest Hits shelf's first slide eager, or gives its
 * <source> a live srcset, a phone starts paying 97KB for a band it does not
 * paint and nothing on the page will look wrong. Re-read the request log after
 * any change to heroTile's loading attribute.
 *
 * THE ON-LOAD NUMBER WENT UP AND IT IS NOT A REGRESSION, BUT IT IS THE HONEST
 * NUMBER SO IT IS PRINTED FIRST. The page is 804px shorter at 390 (7,638 to
 * 6,834; the Greatest Hits band alone goes 1,656 to 908 and Latest 741 to 685),
 * so Most wanted arrives a screen closer to the fold and its six tcgdex card
 * scans, 142KB the set, fall inside Chrome's lazy window at load instead of on
 * the way down. Nothing new was added to the page and nothing that was deferred
 * became eager: the same images arrive, six of them sooner, and one 97KB pack
 * no longer arrives at all. The number that measures the change rather than the
 * reflow is the fully scrolled one, 814.3 to 717.3KB, 16 image requests to 15.
 *
 * 360x800 DPR 2 is the same page: 345.5 -> 389.9KB on load, 7,639 -> 6,879px.
 */

/* 4. THE FOLD, 20 August 2026. Tim, looking at the page on his own phone:
 * "lets also make it so when you land on the home page you can see the entire
 * hall of fame video on the screen, and see the click to rip open the pack
 * banner and watch the video right when you land on home page above the fold
 * no scrolling, we can make the video smaller so its fits and tighten up
 * everything else."
 *
 * THE TARGET IS 700, NOT 844, AND THAT IS WHY THIS LOOKS OVER-TIGHTENED IN A
 * HEADLESS VIEWPORT. Safari's own chrome takes 100 to 140px of an iPhone's
 * 844, so a banner that clears 844 in a browser with no chrome is still under
 * the reader's thumb on the phone Tim is holding. The acceptance test is the
 * BOTTOM EDGE of .pack-hint on the trophy, read with getBoundingClientRect at
 * 390x844: 860.33 before, 683.28 after.
 *
 * THE ORDER THE PIXELS WERE TAKEN IN IS THE POINT. Shrinking the artwork is
 * Tim's own suggestion and it is the LAST lever here rather than the first,
 * because a pack too small to want stops being the thing worth landing on.
 * Measured at 390x844, top of the document down to the banner's bottom edge:
 *
 *      the top bar                   60.00      not touched, not ours
 *      main's own padding-top     16 ->  0      -16.00
 *      the drops band             91 -> 59.41   -31.59
 *      .hof padding-top           24 ->  8      -16.00   in ui.css
 *      the Greatest Hits heading     44.00      unchanged, see below
 *      heading bottom to art top  60 -> 42      -18.00   in ui.css
 *      the pack artwork        565.33 -> 469.88 -95.45   318 -> 264.2 wide
 *                             --------------------------
 *      banner bottom           860.33 -> 683.28
 *
 * So 81.59 of the 177.05px came off the chrome before a pixel came off the
 * pack, and the pack is still 68% of the screen's width. The two figures ui.css
 * owns are argued beside the rules that produce them, in the max-width:544
 * block under .hofx; the arithmetic that makes 42 a FLOOR rather than a taste
 * decision is there too.
 *
 * THE HEADING ROW IS 44 AND STAYS 44. "Greatest Hits" is 22.4px of type, and
 * the row is held open by the "All N hits" link's 44px tap target beside it.
 * That link is the only way onward from a band showing one video on a phone,
 * which is exactly why the one-video-per-band note above says it must stay, so
 * the 22px between the type and the target is not spendable.
 *
 * THE BAND ORDER WAS THE OTHER LEVER AND IT WAS NOT TAKEN. CLAUDE.md names it
 * twice ("move the two DROPS markers in index.html below the .hof section",
 * "the lever is the band ORDER, not the bar") and it would have paid the whole
 * 59.41px this band still costs AND left the pack near 307 wide instead of 264.
 * It is not taken because Tim asked for this band above the fold on 17 August,
 * in as many words, and trading one of his asks for another one quietly is not
 * a saving. Everything the band must not lose, its lede and its credit line, is
 * inside the collapsed body and none of it was touched. If Tim would rather
 * have the bigger pack, that swap is two markers and this paragraph.
 *
 * WHAT ACTUALLY COST 31.59px IN THE BAND, AND ONLY 20 OF IT IS PADDING. The
 * summary WRAPS to two lines at 390 and always has: the heading measures 306.8
 * and the count chip 50.2, which is 3px more than the wrap gives them. So the
 * row is 22.4 of heading, a 12px ROW gap, and 15.6 of chip and chevron: 50px of
 * content held open to 56 by a min-height. The row gap is the free one. At 6px
 * the content is 44, which is exactly the tap target a <summary> has to keep,
 * so min-height comes down to meet the content instead of holding the row open
 * above it. COLUMN gap stays 12: it is what separates the chip from the chevron
 * on the line they share.
 *
 * WHAT IT COSTS ON THE WIRE, one harness, gzipped the way the host serves,
 * cache off, filenames read off the REQUEST LOG rather than off the markup:
 *
 *                       on-load          fully scrolled     trophy pack file
 *      390x844  DPR 2  495.3 -> 447.8KB  607.9 -> 560.4KB   810w -> 560w avif
 *      390x844  DPR 3  495.3 -> 496.5KB  766.1 -> 767.3KB   810w -> 810w
 *      820x1180 DPR 2  461.3 -> 462.5KB  785.7 -> 786.9KB   810w -> 810w
 *      1440x900 DPR 1  382.0 -> 383.3KB  872.4 -> 873.7KB   560w -> 560w
 *      1440x900 DPR 2  558.3 -> 559.6KB 1245.2 -> 1246.5KB  810w -> 810w
 *
 * THE ONE ROW THAT MOVES IS THE PHONE AT DPR 2 and it moves because `sizes` was
 * re-measured with the box, not because anything was compressed: 264 x 2 asks
 * for 529 device pixels and the 560w rendition covers it, where 318 x 2 asked
 * for 636 and took the 810w file. 114,395 bytes to 64,438 off the request log.
 * DPR 3 cannot be helped and is not meant to be: 264 x 3 is 793 and 810w is
 * still the smallest candidate that covers it.
 *
 * THE +1.2 TO +1.3KB ON EVERY OTHER ROW IS THIS BLOCK AND THE ui.css ONE, and
 * it is the whole cost of the change to a reader it cannot help: index.html
 * 20,213 -> 20,268 bytes gzipped and ui.css 20,512 -> 20,546, so 89 bytes of
 * text against 47.5KB of image on the row that pays. THE PROSE IS DELIBERATELY
 * NOT IN THE STYLE BLOCK. The first draft of this note lived inside the
 * template above and put 2.4KB gzipped of comment into a render-blocking
 * element on the most visited page on the site, which is precisely what the
 * HTML comment above HOMECSS in index.html says must not happen.
 *
 * DESKTOP AND TABLET ARE UNTOUCHED AND WERE MEASURED TO BE, not assumed. Every
 * rule added here and in ui.css is inside max-width:544. At 820x1180 and
 * 1440x900 the banner's bottom edge is 991.00 and 944.98 before and after, the
 * pack is 464.0x696.0 and 406.7x610.0 before and after, the same file is picked
 * off the request log, and the document is the same height to the pixel.
 *
 * CONTRAST WAS RE-READ OFF RENDERED PIXELS, glyphs hidden, because this moves
 * the Greatest Hits heading UP the .hof band and that band's radial gradient
 * blooms from its own top edge. Both figures fall and both clear the 4.5 floor:
 * .hof-head h2 5.75 -> 5.67 and .hof-head a 6.06 -> 5.87. The band is also
 * SHORTER, which compresses the gradient, so the heading is now sitting on
 * rgb(37,63,46), within a point of the strongest the bloom can paint. Nothing
 * else moved into or out of it: the trophy's own frame is opaque, and
 * .pack-hint is an opaque fill, so scaling the artwork under it changes no
 * pixel either of them is measured against.
 *
 * THE FOLD AT OTHER PHONE SIZES, driven the same way, because 390 is one phone
 * and the cap in ui.css is a SHARE rather than a pixel count precisely so the
 * others come along. Banner bottom, before -> after:
 *
 *      320x800    752.89 -> 608.58        414x896    903.00 -> 716.34
 *      360x800    807.00 -> 641.48        430x932    832.00 -> 656.48
 *      375x812    833.66 -> 662.28        500x900    937.00 -> 738.00
 *      390x844    860.33 -> 683.28        544x900   1003.00 -> 789.47
 *
 * Every one of them lands under its own viewport less 140px. 430 and up are
 * shorter than the trend because the 2:3 crop takes over at 425, which is the
 * min-width:425 block in ui.css and not this pass.
 */

/* The four rules inside the min-width:900 media query, in the order they
 * appear:
 * - .vcar .hero drops the 520px cap ui.css gives it in this range and takes
 *   the slide, so there is no white gutter inside the card either.
 * - .vcar .tile-stage has to lose the cap WITH the art, because the player
 *   replaces the art link; ui.css's own note on that line records that without
 *   it, pressing play shoved the page down 501px at 768.
 * - .vcar-bar is a control for the row beside it, not a caption under a
 *   centred card, so it moves to the row's start.
 * - .hof gets exactly 2, not 2.35. Greatest Hits has two hits left after the
 *   trophy takes the best one, so a fraction leaves a wedge of empty band and
 *   gives the arrows a quarter of a card to travel. At 2 they fill the shelf
 *   edge to edge and packplayer.js hides the bar through .is-static, which is
 *   the same answer the min-width:1200 block reaches.
 */

// Regions that live on videos.html / playlists.html and NOT on index.html, so
// the "index.html carries every marker" check below has to skip them.
// DROPS is deliberately NOT here: index.html owns it and a missing marker there
// must fail the build, because an empty region and a deleted marker look the
// same on the page and only one of them is intended.
// LIBPRELOAD is the first region this script writes into a <head>, and it is on
// videos.html only: the packs it names are the first tiles of LIBGRID, so the
// two have to be generated together or the preload drifts off the grid it was
// derived from the next time a rip is published.
const OWNED_ELSEWHERE = new Set(["LIBGRID", "LIBPRELOAD", "PLGRID"]);

const REGIONS = {
  LIBGRID: libHtml,
  LIBPRELOAD: libPreloadHtml,
  PLGRID: plHtml,
  HOMECSS: homeCss,
  // Empty when the week has passed or nothing fits, and the markers sit OUTSIDE
  // the <section>, so an empty region is no band rather than an empty frame.
  DROPS: dropsHtml,
  WANTED: wantedHtml,
  // The sourcing note under each price band. Empty when the band prints no
  // price at all, which is the same "no frame around nothing" rule DROPS uses:
  // the markers sit outside the paragraph, so an empty region is no note.
  WANTEDNOTE: wantedNote,
  SETSNOTE: setsNote,
  HOF: hallHtml,
  HOFPICK: hofHtml,
  LATEST: latestHtml,
  // The counters band. Empty when there is nothing at all to count, and the
  // markers sit OUTSIDE the <section>, so that case is no band rather than an
  // empty frame. Same rule DROPS and WANTEDNOTE use.
  RIPSTATS: ripStatsHtml,
  // TWO REGIONS, ONE STRING. Both come from `siteSay` and exactly one of them
  // is ever rendered; the argument for the pair, and for why the phone copy is
  // not simply at the top of <main>, is above `siteSay`. Neither may be
  // hand-edited in index.html: the whole point of the pair being generated is
  // that the sentence cannot exist in two versions.
  SAYTOP: sayTopHtml,
  SAYHEAD: sayHeadHtml,
  // The Rochester band. Empty when none of its three figures can be counted,
  // and the markers sit OUTSIDE the <section> for the same reason the two
  // bands above give.
  ROCHESTER: rocHtml,
  SETS101: setsHtml,
  COUNT_ALL: String(videos.length),
  COUNT_HITS: String(hitCount),
  // Every guide under /sets/, not just the English ones. The chip said "All 23
  // sets" and landed on a page listing 36, because the imported guides were
  // never counted.
  COUNT_SETS: String(sets.length + intlGuideCount),
};

// index.html carries its own copy of the bar and menu, because three other
// build scripts slice their chrome out of it. Fail loudly when that copy stops
// matching shared/chrome.mjs rather than letting six pages quietly differ.
{
  const drift = checkDrift(await readFile(TARGETS[0], "utf8"));
  if (drift.length) {
    console.error("\nindex.html has drifted from shared/chrome.mjs:");
    for (const d of drift) console.error("  " + d);
    console.error("\nMake them match, then re-run.\n");
    process.exit(1);
  }
}

// public/CNAME, generated rather than remembered.
//
// GitHub Pages deployed from an Actions workflow reads the custom domain from a
// CNAME file INSIDE the uploaded artifact. pages.yml uploads public/ only, so
// without this the custom domain setting is dropped on the next deploy and the
// site quietly reverts to the github.io host, which is the exact thing the
// canonical rewrite above exists to prevent.
//
// Written only when LIVE is true, because a CNAME naming a domain nobody owns
// yet would break the current staging deploy. So it appears at the flip, from
// the same flag, and cannot be forgotten separately.
const CNAME = join(ROOT, "public/CNAME");
if (LIVE) {
  const host = DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  await writeFile(CNAME, host + "\n");
  console.log(`  wrote public/CNAME -> ${host}`);
} else {
  await rm(CNAME, { force: true });
}

for (const target of TARGETS) {
  let html = await readFile(target, "utf8");
  for (const [name, body] of Object.entries(REGIONS)) {
    const start = `<!-- ${name}:START -->`;
    const end = `<!-- ${name}:END -->`;
    const a = html.indexOf(start);
    const b = html.indexOf(end);
    // A MISSING MARKER IS ONLY FATAL ON THE PAGE THAT OWNS THE REGION.
    // index.html carries all of them EXCEPT the two grids, which belong to
    // videos.html and playlists.html and to nothing else. videos.html and
    // playlists.html were originally in TARGETS purely so the domain rewrite
    // below reached them, so an absent marker there is still not an error.
    if (a === -1 || b === -1) {
      if (basename(target) === "index.html" && !OWNED_ELSEWHERE.has(name)) {
        console.error(`Marker ${name} not found in ${target}`);
        process.exit(1);
      }
      continue;
    }
    html = html.slice(0, a + start.length) + "\n" + body + "\n" + html.slice(b);
  }
  // THESE THREE HEADS ARE HAND MAINTAINED AND WERE NOT DERIVED FROM SITE.
// index.html is the one page not generated wholesale: this script only replaces
// the marked regions, so seven absolute URLs in its head (canonical, og:url,
// og:image, twitter:image and three in the Organization JSON-LD) stayed frozen
// at whatever domain they were typed with. Flipping LIVE regenerated the other
// 396 pages onto the real domain and left the single most important URL on the
// site canonicalising to the one being abandoned. Rewriting them here means the
// homepage follows SITE like everything else.
const OTHER = SITE === DOMAIN ? STAGING : DOMAIN;
const before = (html.match(new RegExp(OTHER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
if (before) {
  html = html.split(OTHER).join(SITE);
  console.log(`  ${basename(target)}: rewrote ${before} absolute url(s) to ${SITE}`);
}

/* --------------------------------------------- which sets HAVE a set logo --
 *
 * app.js decides whether to ask for a set logo, and it was deciding by set-id
 * PREFIX: anything not ja-, ko- or zh- was assumed to have one. Its own comment
 * said why that was safe -- the intl sets "are the only sets without artwork" --
 * which was true when it was written. Two English sets, silver-tempest and
 * lost-origin, are tagged on videos with no logo file and no guide page, so
 * selecting either chip on /videos.html fetched a 404 and printed the only red
 * line in an otherwise silent console.
 *
 * A PREFIX IS A PROXY. THE FACT IS THE FOLDER, and this script already reads it
 * (`logos`, from dirSet above, is where the "logos: 28/28" line at the foot of
 * this run comes from). Stamping the ids onto the element that uses them means
 * the list is regenerated on every build and cannot go stale the way app.js's
 * hand-mirrored LABELS map openly can.
 *
 * ON ONE PAGE, NOT IN app.js. The script ships on all 1,486 built pages and
 * only /videos.html has a #setHeader, so a constant in there would be paid for
 * everywhere and read in one place. This is about 380 bytes on the one page.
 *
 * NOT AN ERROR WHERE THERE IS NO MARKER. index.html and playlists.html are in
 * TARGETS for the domain rewrite above and carry no set header, exactly as they
 * carry none of the two grid REGIONS.
 */
const SET_HEADER = /<div class="set-header" id="setHeader"([^>]*)>/;
if (SET_HEADER.test(html)) {
  const ids = [...logos].sort().join(" ");
  html = html.replace(SET_HEADER, (m, rest) =>
    `<div class="set-header" id="setHeader" data-logos="${ids}"${rest.replace(/\s*data-logos="[^"]*"/, "")}>`);
  console.log(`  ${basename(target)}: set logo manifest stamped, ${logos.size} sets`);
}

await writeFile(target, html);
}

const noArt = [...new Set(videos.flatMap((v) => v.sets || []))].filter((s) => !packs.has(s));
const untagged = videos.filter((v) => !(v.sets || []).length).length;
console.log(`index.html rebuilt from real data:
  ${videos.length} videos, ${hitCount} with a graded pull, ${sets.length} sets
  Hall of Fame: ${hall.map((v) => (v.pulls || []).join("/")).slice(0, 3).join(", ")}...
  logos: ${logos.size}/${sets.length}    pack art: ${packs.size} sets`);
// THE COUNTERS BAND, PRINTED SO A PERSON RUNNING THIS BY HAND CAN HOLD THEM
// AGAINST /luck.html's OWN HEADER WITHOUT OPENING THE PAGE. The rip figures are
// build-luck.mjs's rules copied into this file (see the block above
// ripStatsHtml), so this line is the cheap half of keeping the two in step:
// the five numbers below must equal the five in .luck-head, and if they ever
// do not, one of the two files has changed its rule and the site is
// contradicting itself. build-all.mjs swallows a builder's stdout on success,
// so this is a line for a hand run rather than a gate.
console.log(
  `  counters band: ${chStats ? `${num(chStats.views)} views, ${num(chStats.subscribers)} subs (read ${chStats.readAt}), ` : "no channel counters in videos.json, "}` +
    `${num(videos.length)} rips, ${num(allPacks)} packs over ${num(packRips)} rips that say, ` +
    `${num(hitCards)} hit cards, ${hitRate || "-"} over ${num(hitRips.length)}/${num(judgedRips.length)} answered` +
    `\n    ^ the last five must match /luck.html's .luck-head exactly`
);
// THE ROCHESTER BAND'S THREE FIGURES, PRINTED FOR THE SAME REASON THE FIVE
// ABOVE ARE: this file copies build-rochester.mjs's three counting rules, so
// this line is the cheap half of keeping the two in step. They must equal the
// counted cards on /rochester.html. If they ever do not, one of the two files
// has changed its rule and the site is contradicting itself: fix the rule, not
// the number. build-all.mjs swallows stdout on success, so this is a line for a
// hand run rather than a gate.
console.log(
  `  Rochester band: ${num(rocShows)} shows still to come on ${rocToday}, ` +
    `${num(rocShops)} shops, ${num(rocPlates)} plate places` +
    `\n    ^ these three must match /rochester.html's counted cards`
);
for (const line of dropsLog) console.log(`  ${line}`);
if (noArt.length) console.log(`  sets ripped but with no pack art: ${noArt.join(", ")}`);
if (untagged) {
  console.log(
    `  ${untagged} videos still have no set tag and show the generic wrapper` +
      `${packs.has("default") ? "" : " (and there is no default.png yet, so they show the wordmark)"}`
  );
}

// The most valuable tagging work: a hit with no set tag cannot appear on the
// Hall of Fame shelf at all, however good the pull was.
const hiddenHits = videos.filter((v) => bestPull(v) != null && !(v.sets || []).some((s) => packs.has(s)));
if (hiddenHits.length) {
  console.log(
    `\n  ${hiddenHits.length} graded hit${hiddenHits.length === 1 ? " is" : "s are"} kept off the Hall of Fame for want of a set tag.` +
      `\n  They would all show the same generic wrapper, and a shelf of identical packs is worse than a shorter one:`
  );
  for (const v of hiddenHits.slice(0, 10)) {
    console.log(`    ${(v.pulls || []).join("/").padEnd(12)} ${v.title.slice(0, 62)}`);
  }
  if (hiddenHits.length > 10) console.log(`    ...and ${hiddenHits.length - 10} more`);
}
