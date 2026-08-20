#!/usr/bin/env node
// Generate one page per rip, plus the sitemap.
//
//   node scripts/build-pages.mjs
//
// Needs no API key: it reads what sync-youtube.mjs already wrote. EVERY video
// gets a page, so clicking a tile anywhere on the site never bounces the
// visitor out to youtube.com. Videos missing a set or product tag are marked
// noindex and kept out of the sitemap, since they are too thin to rank.
// Tag them (see UNTAGGED.md) and re-run to promote them.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, robots, LIVE, DOMAIN } from "../shared/site.mjs";
import { priceNote, priceFooter, priceRead } from "../shared/card-prices.mjs";
// SUBSCRIBE is imported rather than retyped. The channel URL and its
// ?sub_confirmation=1 were hard coded here as a literal, which is one place for
// the ID to be wrong and never noticed; shared/chrome.mjs is where the other
// three Subscribe controls get it.
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS, SUBSCRIBE } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { raritiesIn, rarityChip, RARITY_CSS } from "../shared/rarity.mjs";
import { ripPath } from "../shared/paths.mjs";
import { esc, longDate, moneyCompact, moneyExact, moneyRound, shortDate, rarityLabel, cardNumKey, imgDims, viewCount, avifPicture } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUT = join(ROOT, "public/rip");

// Graded prices, hand-entered first and synced second, with the same
// ten-sale floor the set guides use. One store, so a card cannot show two
// different numbers on two different pages.
// Which sets actually have wrapper art. Five (White Flare, Black Bolt,
// Shrouded Fable, Paldean Fates, Paldea Evolved) have neither art nor a color
// skin, so naming them here would render the plain Garbage Rips green rather
// than the generic wrapper we drew for exactly this case.
/**
 * The share card for a rip.
 *
 * This used to be the YouTube poster frame, which is nearly always the pulled
 * card: sharing a rip page in a message showed the hit before anyone opened
 * it, the one thing the pack wrappers exist to prevent. Each set has its own
 * card now, showing its wrapper and nothing else.
 */
const ogCard = (v) => {
  const s = (v.sets || [])[0];
  return s && ogCards.has(s) ? `og-${s}.jpg` : "og-image.jpg";
};

const ogCards = new Set(
  (await readdir(join(ROOT, "public/assets")))
    .filter((f) => f.startsWith("og-") && f.endsWith(".jpg"))
    .map((f) => f.slice(3, -4))
);

const packsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/packs")))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/-garbage-rips-585-booster-pack\.webp$/, ""))
);

const setData = new Map(
  JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8")).sets.map((x) => [x.id, x])
);

// ONE CARD, ONE NAME, and the rip pages are the third page that has to agree.
//
// `chase` comes from pokemontcg.io and the checklists come from TCGdex, and the
// two spell Rebel Clash #189 and #200 differently: "Boss's Orders" against
// "Boss's Orders (Giovanni)". /complete-a-set.html and /sets/rebel-clash.html
// both print the checklist name, so a rip page printing the other one is the
// odd voice out about a card all three are describing. Same reconciliation
// build-set-pages.mjs does, for the same reason and matched the same way: on
// NUMBER, because the names are the thing in dispute, and taking `name` only.
// Prices, rarities and images are untouched.
//
// Through cardNumKey, because the two feeds also disagree about zero padding
// ("079" against "79") and a string compare therefore never fired on the 24 of
// 28 checklists that pad. Rebel Clash is one of the four that do not, which is
// the only reason the two renames above ever happened.
for (const s of setData.values()) {
  if (!s.chase?.length) continue;
  let list;
  try {
    list = JSON.parse(await readFile(join(ROOT, `public/data/cards/${s.id}.json`), "utf8")).cards;
  } catch {
    continue;
  }
  for (const c of s.chase) {
    const m = list.find((x) => cardNumKey(x.n) === cardNumKey(c.number));
    if (m?.name && m.name !== c.name) c.name = m.name;
  }
}
let psa10 = {};
try {
  psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* optional */ }
const MIN_SALES = 10;
const gradedPrice = (setId, number) => {
  const k = `${setId}-${number}`;
  const m = psa10.prices?.[k];
  const manual = typeof m?.price === "number" ? m.price : typeof m === "number" ? m : null;
  if (manual) return manual;
  const a = psa10.auto?.[k];
  if (!a?.psa10 || (a.psa10Sales != null && a.psa10Sales < MIN_SALES)) return null;
  return a.psa10;
};

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

// Cards pulled on camera, one entry per hit, from data/hits.json.
//
// PRICES ARE LOOKED UP HERE, NOT STORED IN hits.json. The sheet records WHICH
// card was pulled; what it is worth comes from the same card data every other
// page uses, so a nightly price refresh moves these pages and no card can show
// two different numbers in two places.
//
// One hit resolves to several printings often enough to matter: Dawn in
// Phantasmal Flames has three. Where the sheet named a rarity we take the
// printing that matches, because that is the one actually pulled; otherwise the
// first, and the page claims nothing it cannot support.
let cardsChecked = null;
// The sourcing stamps for the raw prices. Read off one set file because every
// one of them carries the same PriceCharting crawl date, and a rip page prices
// cards from whichever set it opened. The fallback COUNT is deliberately summed
// across every set rather than taken from this one, so the sentence describes
// the price file as a whole rather than claiming Pitch Black's two exceptions
// are the site's.
let pricesDoc = null;
try {
  const one = JSON.parse(await readFile(join(ROOT, "public/data/cards/pitch-black.json"), "utf8"));
  cardsChecked = one.checked;
  pricesDoc = {
    priceSource: one.priceSource,
    pricesChecked: one.pricesChecked,
    checked: one.checked,
    pricedBy: { pricecharting: 0, tcgdex: 0 },
  };
  const { readdir: _rd } = await import("node:fs/promises");
  for (const f of await _rd(join(ROOT, "public/data/cards"))) {
    if (!f.endsWith(".json")) continue;
    const d = JSON.parse(await readFile(join(ROOT, "public/data/cards", f), "utf8"));
    pricesDoc.pricedBy.pricecharting += d.pricedBy?.pricecharting || 0;
    pricesDoc.pricedBy.tcgdex += d.pricedBy?.tcgdex || 0;
  }
} catch {}
const HITS = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
const psaFor = (setId, n) => {
  const k = `${setId}-${String(n).replace(/^0+(?=\d)/, "")}`;
  const e = (psa10.prices && psa10.prices[k]) || (psa10.auto && psa10.auto[k]);
  return e && typeof e.psa10 === "number" ? e.psa10 : null;
};
const cardCache = new Map();
async function resolveHits(vid) {
  const out = [];
  for (const h of HITS[vid] || []) {
    if (!cardCache.has(h.set)) {
      try {
        cardCache.set(h.set, JSON.parse(await readFile(join(ROOT, `public/data/cards/${h.set}.json`), "utf8")).cards);
      } catch { cardCache.set(h.set, null); }
    }
    // A promo lives outside the 23 sets we price, so it never resolves against
    // the set data and used to match a SET card of the same name: that put the
    // wrong Oricorio ex on the Costco page and lost the Mega Charizard X ex
    // entirely. Promos resolve against the printings corpus instead, which
    // gives a real scan and no price, which is the truth about a promo.
    if (h.promo || !h.set) {
      const shard = String(h.card).trim()[0].toLowerCase();
      let list = [];
      try { list = JSON.parse(await readFile(join(ROOT, `public/data/printings/${/[a-z]/.test(shard) ? shard : "0"}.json`), "utf8")); } catch {}
      const norm0 = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
      const pm = list.find((c) => norm0(c.n) === norm0(h.card) && String(c.i) === String(h.number)) ||
                 list.find((c) => norm0(c.n) === norm0(h.card) && /promo/i.test(String(c.s)));
      out.push({
        name: h.card, setName: h.setName, setId: null,
        rarity: h.rarity || (pm && pm.r) || null,
        n: h.number || (pm && pm.i) || null,
        img: pm && pm.g ? `${pm.g}/low.webp` : null,
        // A promo has no price in the nightly feed, so where one is recorded on
        // the hit itself we use it, and carry its source and date so the page
        // can say where it came from rather than implying it is a live figure.
        price: typeof h.price === "number" ? h.price : null,
        psa10: typeof h.psa10 === "number" ? h.psa10 : null,
        priceSource: h.priceSource || null,
        priceAsOf: h.priceAsOf || null,
        promo: true, unresolved: !pm,
      });
      continue;
    }
    const cards = cardCache.get(h.set);
    const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
    const same = cards ? cards.filter((c) => norm(c.name) === norm(h.card)) : [];
    const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
    const m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0] || null;
    out.push({
      name: h.card, setName: h.setName, setId: h.set,
      rarity: (m && m.rarity) || h.rarity || null,
      n: m ? m.n : null,
      img: m && m.img ? `${m.img}/low.webp` : null,
      price: m && typeof m.price === "number" ? m.price : null,
      psa10: m ? psaFor(h.set, m.n) : null,
      // A promo, or a card outside the set checklist, will not resolve. Kept
      // and shown by name rather than dropped, because it WAS pulled.
      unresolved: !m,
    });
  }
  // ORDER BY RAW, NOT BY WHICHEVER NUMBER IS BIGGER. Sorting on psa10 || price
  // compared a graded figure against an ungraded one, so any card with a PSA 10
  // recorded outranked every card without: Oricorio ex at $12.03 raw sat above
  // Marshadow at $14.95 because its PSA 10 was $99.78. Raw is the number every
  // card here has, so it is the one that can be compared. PSA 10 falls back
  // only when a card has no raw price at all.
  return out.sort((a, b) => (b.price ?? b.psa10 ?? 0) - (a.price ?? a.psa10 ?? 0));
}

// Intrinsic size of each set logo, measured from the files by
// scripts/build-packs.py and stored in data/logo-dims.json. Emitting
// width/height reserves the box before the image lands: these are lazy and
// sit low on the page, so without them every rip page reflows as you scroll.
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* run: python3 scripts/measure-logos.py */
}
// data/logo-dims.json HOLDS 23 OF THE 28 LOGOS ON DISK, so reading it alone
// drops Celebrations, Chilling Reign, Crown Zenith, Rebel Clash and Shining
// Fates with no error anywhere. build-openings.mjs already hit this and parses
// the webp header instead; same parse, same reason, and it is why the srcset
// below can be emitted for every set rather than most of them.
function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  if (fourcc === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  return null;
}
const DIM_CACHE = new Map();
const measure = (file) => {
  if (!DIM_CACHE.has(file)) {
    let d = null;
    try {
      d = webpSize(readFileSync(join(ROOT, "public/assets/logos", file)));
    } catch {
      d = null;
    }
    DIM_CACHE.set(file, d);
  }
  return DIM_CACHE.get(file);
};
const logoDims = (setId) =>
  LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`] || measure(`${setId}-pokemon-tcg-set-logo.webp`);

/**
 * THE SET LOGO ON A RIP PAGE WAS THE 300px-TALL MASTER IN A 34px BOX, and it is
 * the worst intrinsic-to-box ratio left on the site now that /sets/, /openings/
 * and /playlists/ all take the -sm.webp. Measured at 390x844:
 * chaos-rising-pokemon-tcg-set-logo.webp is 1051x300 and 70,522 bytes, drawn at
 * 119x34. The -sm.webp beside it is 350x100 and 17,170 bytes, which covers a
 * 34px box at DPR 2 with room to spare. 530 <img> across 316 rip pages carried
 * the bare master, about 53KB a page and 23.5MB over the family, and this was an
 * INCONSISTENCY rather than a missing asset: the file was already there and
 * three other page families already reached for it.
 *
 * `sizes` IS THE DRAWN WIDTH AND THE DRAWN WIDTH IS A clamp(), which is why this
 * is three clauses and not one number. ui.css sets
 *
 *     .rip-setlogo      height:clamp(34px,5vw,54px)
 *     .sec-head .setlogo height:clamp(30px,4.4vw,50px)
 *
 * and `width:auto`, so the drawn WIDTH is that height times the logo's own
 * aspect and every logo has a different one. A flat "119px" would be wrong on a
 * desktop, and a flat "189px" (the widest it ever draws) asks for 378 device
 * pixels on a phone at DPR 2, which no -sm.webp can satisfy, so Chrome would
 * correctly reach past it for the master on the one screen that most needs the
 * small file. Same arithmetic and the same trap build-openings.mjs,
 * build-playlists.mjs and build-intl-pages.mjs each record separately.
 *
 * THE THREE NUMBERS BELOW ARE UI.CSS'S AND ARE WRITTEN TWICE. If that clamp
 * moves, move these with it: an out-of-date `sizes` goes soft silently, it does
 * not error. They are named after the rule they mirror so a grep for the class
 * finds both ends.
 */
const LOGO_CLAMP = {
  // .rip-setlogo: clamp(34px, 5vw, 54px)
  rip: { min: 34, vw: 5, max: 54 },
  // .sec-head .setlogo: clamp(30px, 4.4vw, 50px)
  sec: { min: 30, vw: 4.4, max: 50 },
};

/*
 * BOTH LOGOS ON A RIP PAGE DECLARE THE RIP-SETLOGO BOX, AND THE SMALLER ONE
 * DOING SO IS THE POINT RATHER THAN A BUG.
 *
 * This page shows the SAME logo twice: `.rip-setlogo` under the pack at up to
 * 197px wide, and `.setlogo` in the "More <set>" heading at up to 182px. Give
 * each its own honest `sizes` and they resolve to DIFFERENT candidates on a
 * retina desktop, which costs the page BOTH FILES. Measured over CDP at 1440x900
 * DPR 2 with each element's currentSrc read off the DOM: the hero took the 1092w
 * master (52,472 bytes) and the heading took the 364w -sm (13,678), 66.2KB
 * against the 52.5KB the page paid when both pointed at the same master and the
 * second was a cache hit. A 13.7KB REGRESSION on exactly the reader CLAUDE.md
 * warns about, arrived at by making each element individually correct.
 *
 * So the smaller element is sized by the LARGER one. It can only ever be handed
 * a file the page has already fetched, which is free, and the alternative is a
 * second file that is smaller than the one already in cache. Re-measured after,
 * per width, both elements' currentSrc:
 *
 *     390x844   DPR 2   both -sm       13.7KB   (was 52.5, one master)
 *     390x844   DPR 3   both master    52.5KB   (unchanged)
 *     1440x900  DPR 1   both -sm       13.7KB   (was 52.5)
 *     1440x900  DPR 2   both master    52.5KB   (unchanged)
 *
 * Never worse than before at any width, and 38.8KB better on a phone at DPR 2
 * and on a 1x desktop. If a later editor gives `.setlogo` its own `sizes` back
 * because it looks wrong here, they will reintroduce the second file.
 */
const SIZED_BY = { rip: "rip", sec: "rip" };
const setLogoImg = (setId, { cls, clamp, lazy }) => {
  if (!hasLogo(setId)) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = logoDims(setId);
  if (!d) {
    // No dimensions means no honest srcset and no reserved box. Emit what the
    // page always emitted rather than guessing a width.
    return `<img class="${cls}" src="${base}.webp" alt=""${lazy ? ` loading="lazy"` : ""} decoding="async" onerror="this.remove()">`;
  }
  const ar = d[0] / d[1];
  // -sm.webp is normalised to 100px tall, so its width is the aspect times 100.
  const smW = Math.round(ar * 100);
  const c = LOGO_CLAMP[SIZED_BY[clamp]];
  const lo = Math.round(c.min * ar);
  const hi = Math.round(c.max * ar);
  const sizes =
    `(max-width:${Math.round(c.min / (c.vw / 100))}px) ${lo}px,` +
    ` (min-width:${Math.round(c.max / (c.vw / 100))}px) ${hi}px,` +
    ` ${(c.vw * ar).toFixed(2)}vw`;
  return (
    `<img class="${cls}" width="${smW}" height="100" src="${base}-sm.webp"` +
    ` srcset="${base}-sm.webp ${smW}w, ${base}.webp ${d[0]}w" sizes="${sizes}"` +
    ` alt=""${lazy ? ` loading="lazy"` : ""} decoding="async" onerror="this.remove()">`
  );
};

// Which sets actually have a logo file. A rip page renders the logo of whatever
// set it is tagged with, and tagging the Japanese, Korean and Chinese rips gave
// 12 pages an <img> pointing at a file that does not exist: TCGdex publishes no
// logo or symbol art for ANY non-English set, so there is nothing to download.
// The tags themselves are right and worth having, so the image is simply not
// emitted when there is no art. `onerror` would have hidden it in a browser,
// but a request that 404s on every page load is still a request, and the build
// check counts it as a broken link, correctly.
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
const hasLogo = (setId) => Boolean(setId) && logosOnDisk.has(setId);

// Which sets have a guide page to link to. The rip page used to reach its set
// guide only through the "what you are chasing" block, which needs chase cards
// with prices, so the imported rips had no route to their own guide at all: you
// could watch five Abyss Eye rips and never learn the page existed, let alone
// that the set is Pitch Black. Both kinds of guide count here.
const guideIds = new Set(
  JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8")).sets.map((s) => s.id)
);
try {
  const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
  for (const id of Object.keys(ig.sets || {})) guideIds.add(id);
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}
const hasGuide = (setId) => Boolean(setId) && guideIds.has(setId);

// `pillarboxed` is read here rather than carried through the YouTube sync,
// because it describes how a video was FILMED versus how it was uploaded, which
// no API reports and only a human can say.
const OVERRIDES = JSON.parse(await readFile(join(ROOT, "data/overrides.json"), "utf8").catch(() => "{}"));

const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));

const pathFor = (v) => v.path || ripPath(v);

function isoDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `PT${m ? m + "M" : ""}${s}S`;
}

// A YouTube title carries hashtags because YouTube indexes them. A <title> tag
// does not, so they are pure noise in the tab, the SERP and the H1. Strip only
// a RUN OF HASHTAGS AT THE END: "#1" mid-title is a pack number, and hashtags
// that sit inside the sentence are part of how the title reads.
function cleanTitle(t) {
  return t
    .replace(/(?:\s*#\s*[\p{L}][\p{L}\p{N}_-]*)+\s*$/u, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Whitespace tidy for text typed into the spreadsheet by hand.
//
// The Hit Card column is free text on purpose, so it arrives with whatever
// spacing it was typed with: "Double Rare , Mega Evolution" renders exactly
// that space before the comma, because HTML collapses runs of whitespace but
// does not move one from the wrong side of a comma. This only touches spacing,
// never words or order, so what it prints is still what was typed.
const tidy = (s) =>
  String(s || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim();

const tagged = videos.filter((v) => v.sets.length && v.products.length);
const taggedIds = new Set(tagged.map((v) => v.id));
const byId = new Map(videos.map((v) => [v.id, v]));

// Two different rips can carry the identical YouTube title, which gives two
// pages the identical <title> tag and makes them look like duplicates to a
// crawler. Only the repeats get a qualifier, and the qualifier is the upload
// date, which is a fact we already hold rather than something invented.
const titleCounts = new Map();
for (const v of videos) {
  const t = cleanTitle(v.siteTitle || v.title);
  titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
}
const bySet = new Map();
const HITS_RESOLVED = new Map();
for (const vid of Object.keys(HITS)) HITS_RESOLVED.set(vid, await resolveHits(vid));

for (const v of tagged) {
  for (const s of v.sets) {
    if (!bySet.has(s)) bySet.set(s, []);
    bySet.get(s).push(v);
  }
}

// Was `niceViews`, one of five copies, each carrying a comment claiming it
// matched one of the others. viewCount in shared/format.mjs records what they
// were all still getting wrong after the last hand reconciliation, including
// the "1 views" that this copy printed on a real page.
const niceViews = viewCount;

function page(v, prev, next) {
  // Same rule as the home page and the library: a rip holding packs from
// several sets wears the generic wrapper rather than one set's, and an
// untagged rip wears it too instead of the unskinned placeholder.
//
// TWO SEPARATE THINGS, and conflating them broke three others. packSet picks
// the ARTWORK and may be "multi" or "default", which are not sets. setId is the
// real first set and stays null when there is none, because it drives the set
// guide link, the set logo, the related-videos band, the breadcrumb, and
// isTagged. Reusing one variable for both pointed multi-set pages at
// /sets/multi.html and, worse, made isTagged true for every untagged video, so
// 39 thin pages lost their noindex and entered the sitemap.
const packSet =
    v.sets.length > 1 ? "multi" : packsOnDisk.has(v.sets[0]) ? v.sets[0] : "default";
const setId = v.sets[0] || null;
const prodId = v.products[0];
  // Every video gets a page so that clicking a tile never leaves the site.
  // Untagged ones are noindex: useful to a visitor, too thin for search.
  const isTagged = Boolean(setId && prodId);
  const setLabel = setId ? labelFor("sets", setId) : null;
  const prodLabel = prodId ? labelFor("products", prodId) : null;
  // The sheet can override both. A YouTube title is written for the algorithm
// and a YouTube description is written for YouTube; the site can say something
// better without changing either.
const title = cleanTitle(v.siteTitle || v.title);
// Only a repeated title earns the date, so the other 300 stay clean.
// headTitle goes into <title> with NO " | Garbage Rips 585" after it. Measured
// 17 August 2026 in headless Chrome at 20px Arial: the suffix is 178.6px and
// 253 of these 286 titles already ran past Google's ~580px desktop cut with it
// on, so on 88% of them the brand was never drawn and the 178.6px it ate came
// out of the pack number and the hook instead. og:title and twitter:title below
// have always been the bare headTitle, so dropping it also stops <title> and
// og:title disagreeing. Uniqueness is titleCounts' job, not the suffix's.
const headTitle =
  titleCounts.get(title) > 1 && v.published
    ? `${title} (${shortDate(v.published)})`
    : title;
// The trailing hashtag wall is how YouTube indexes a video. On a web page it
// is a row of link-less tokens at the end of a paragraph, so it comes off the
// blurb, the meta description and the schema alike.
const desc = (v.blurb || descriptions[v.id] || "")
  .replace(/(?:\s*#\s*[\p{L}][\p{L}\p{N}_-]*)+\s*$/u, "")
  // Runs of spaces and tabs only, never newlines: the blank lines are what give
  // the blurb its paragraphs on the page. HTML collapses a double space so it
  // is invisible in the body, but the meta description and the JSON-LD are
  // attribute and string values where it is not collapsed and does show.
  .replace(/[ \t]{2,}/g, " ")
  .trim();
  // Google truncates the snippet around 160 characters, so the fallback shapes
  // itself around the title rather than assuming the title is short: the tail
  // is fixed, the title gets whatever room is left.
  const descTail = isTagged
    ? `: a ${prodLabel} rip from ${setLabel}, opened on Garbage Rips 585 in Rochester, NY.`
    : `: a Pokemon pack rip from Garbage Rips 585 in Rochester, NY.`;
  /* CUT AT A SENTENCE, NOT AT A WORD, AND ONLY FALL BACK TO THE WORD.
   *
   * 269 of the 289 indexable rip pages had a meta description ending "..."
   * mid-thought, because this only ever cut at the last space inside 158
   * characters. That is the snippet Google draws under the title on the pages
   * closest to the channel, and a snippet that stops mid-sentence reads as a
   * broken page rather than a teaser: the reader has to guess whether the
   * sentence mattered. Counted off the built tree before and after: 269 rip
   * pages ended in an ellipsis, 119 still do, so 150 of them now end on a
   * finished sentence and the rest are byte for byte what they were. A first
   * estimate said 221 and it was made against the HTML-escaped strings, where
   * `&quot;` counts as six characters instead of one and moves the cut; the
   * number above is the one the build actually produced. Re-count, do not
   * inherit.
   *
   * THE EMOJI TRAVELS WITH THE FULL STOP. Tim writes "...a certified Garbage
   * Rip. 🗑️ The goth", where the emoji belongs to the sentence it follows, so
   * cutting at the bare "." would strand it at the head of the next one. The
   * expression allows a closing quote and any run of pictographs after the
   * terminator before it calls the sentence finished.
   *
   * THE 60% FLOOR IS WHAT STOPS THIS BACKFIRING. Without it a blurb whose only
   * full stop is at character 12 would publish a twelve character description.
   * Below that mark the old behaviour is better and is what still runs.
   *
   * YouTube descriptions often already trail off in an ellipsis, so the word
   * fallback strips trailing dots before adding its own or the page reads
   * "and......".
   */
  const SENTENCE_END = /[.!?…][)"'’”]?(?:\s*\p{Extended_Pictographic}️?)*(?=\s|$)/gu;
  const clip = (s, n) => {
    if (s.length <= n) return s;
    const window = s.slice(0, n);
    let end = -1;
    SENTENCE_END.lastIndex = 0;
    for (let m; (m = SENTENCE_END.exec(window)) !== null; ) end = m.index + m[0].length;
    if (end >= n * 0.6) return window.slice(0, end).trim();
    return (
      s
        .slice(0, n - 3)
        .replace(/\s\S*$/, "")
        .replace(/[.…\s]+$/, "") + "..."
    );
  };
  // The title is cut at a word boundary with no ellipsis, because the tail that
  // follows already reads as a continuation.
  const titleRoom = Math.max(24, 160 - descTail.length);
  // `title`, NOT `v.title`. The <title> tag used the cleaned one and this used
  // the raw one, so one page shipped a <title> reading "Only Garbage Rips
  // Suicune Knock Out Collection" above a meta description reading the same
  // thing plus "#pokemon #pokemoncards #pokemontcg #PokemonShorts".
  const shortTitle =
    title.length <= titleRoom
      ? title
      : title.slice(0, titleRoom).replace(/[\s,:;.!?-]+\S*$/, "");
  const metaDesc = desc
    ? clip(desc.replace(/\s+/g, " "), 158)
    : shortTitle + descTail;
  // Still YouTube's frame for the VideoObject schema and the poster behind the
  // pack, where it is correct. It is NOT the share image: see ogCard().
  // The player poster is the LCP image of every rip page, and it was being
  // fetched as a ~178KB JPEG when the same frame is ~81KB as WebP: a 54% cut on
  // the one image that decides how fast the page feels. app.js already had a
  // thumbUrl() helper written to do exactly this, with the saving measured in
  // its comment, and nothing ever called it.
  //
  // "oar" is the original-aspect-ratio frame, the only variant at the video's
  // true vertical shape; hqdefault and maxresdefault are 4:3 and 16:9 crops
  // that letterbox a Short. But oardefault does NOT exist for horizontal
  // uploads (it 404s for kj7532tb0_I), and maxresdefault is already the right
  // shape for those, so each gets the variant that actually exists.
  const frame = v.vertical === false ? "maxresdefault" : "oardefault";
  const thumbWebp = `https://i.ytimg.com/vi_webp/${v.id}/${frame}.webp`;
  const thumb = `https://i.ytimg.com/vi/${v.id}/${frame}.jpg`;
  const url = `${SITE}/${pathFor(v)}`;

  // What the viewer is actually hoping falls out of this pack. Every chase card
  // has a raw price; a PSA 10 shows only where we have one worth standing
  // behind. Three is enough to be useful without turning a video page into a
  // price list.
  const chaseCards = (setData.get(setId)?.chase || []).slice(0, 3).map((c) => ({
    ...c,
    psa10: gradedPrice(setId, c.number),
  }));
  const chaseBlock = chaseCards.length
    ? `<section class="band tight chasers">
  <div class="wrap">
    <div class="sec-head">
      <div><h2>What you are <span class="hl">chasing</span></h2></div>
      ${
        // THROUGH hasGuide, LIKE EVERY OTHER /sets/ LINK ON THIS PAGE.
        //
        // Today this is belt and braces: `chase` is read out of sets.json, so a
        // set with no guide has no chase list, chaseCards is empty and the whole
        // block never renders. But that is a fact about a different file, sitting
        // fourteen lines above an unguarded url, and the Set dropdown now offers
        // 146 sets that have no /sets/ page at all. The day chase data arrives
        // from anywhere wider than sets.json, this line is a 404 in the middle of
        // a rip page and nothing in the build would say so first.
        hasGuide(setId)
          ? `<a class="btn btn-ghost btn-sm" href="/sets/${setId}.html">${esc(setLabel)} guide &rarr;</a>`
          : ""
      }
    </div>
    <ul class="chaser-list">
      ${chaseCards.map((c) => `<li class="chaser">
        ${c.image ? avifPicture(`<img src="${esc(c.image)}" alt="${esc(c.name)}, ${esc(rarityLabel(c.rarity) || "card")} from ${esc(setLabel)}" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>`) : ""}
        <div>
          <b>${esc(c.name)}</b>
          <span class="chaser-rar">${esc(rarityLabel(c.rarity) || "")}${c.number ? ` &bull; #${esc(c.number)}` : ""}</span>
          <span class="chaser-pr">Raw ${moneyCompact(c.price)}${c.psa10 ? ` <i>PSA 10 ${moneyCompact(c.psa10)}</i>` : ""}</span>
        </div>
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>`
    : "";

  // Packs opened out of the same box, which is a stronger connection than
  // "same set": #1 through #10 of one ETB are one sitting, and a viewer who
  // watched pack 3 usually wants pack 4, not another Chaos Rising rip.
  const hits = HITS_RESOLVED.get(v.id) || [];
// RESOLVED, not merely present. resolveHits keeps a hit it could not match to
// a printing and stamps it `unresolved`, because the card WAS pulled and
// dropping it would lose that. But those render with no scan and no price, so
// counting them as "we have something to show" was wrong: an audit mutated the
// data so all 14 hits failed to resolve and got a band of 14 empty cards with
// the free-text fallback suppressed, which is the worst of both.
const resolvedHits = hits.filter((h) => !h.unresolved);
  const sameBox = v.box
    ? videos.filter((x) => x.box === v.box && x.id !== v.id).slice(0, 6)
    : [];

  const related = (setId ? bySet.get(setId) || [] : []).filter((x) => x.id !== v.id).slice(0, 6);

  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: desc || metaDesc,
    thumbnailUrl: [thumb],
    uploadDate: v.published,
    embedUrl: `https://www.youtube.com/embed/${v.id}`,
    url,
    ...(isoDuration(v.duration) ? { duration: isoDuration(v.duration) } : {}),
    ...(v.views ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: v.views } } : {}),
    publisher: {
      "@type": "Organization",
      name: "Garbage Rips 585",
      url: SITE + "/",
      logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
    },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Every rip", item: `${SITE}/videos.html` },
      ...(setId ? [{ "@type": "ListItem", position: 3, name: setLabel, item: `${SITE}/videos.html?set=${setId}` }] : []),
      { "@type": "ListItem", position: setId ? 4 : 3, name: title },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(headTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">${isTagged ? "" : '\n<meta name="robots" content="noindex,follow">'}
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(headTitle)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="video.other">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/${ogCard(v)}?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(headTitle)}">
<meta name="twitter:image" content="${SITE}/assets/${ogCard(v)}?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<link rel="preconnect" href="https://i.ytimg.com" crossorigin>
<!-- THE PACK IS THIS PAGE'S LCP ELEMENT AND THE PRELOAD SCANNER CANNOT SEE IT.
     Measured on the live site at 390x844 DPR 2, Slow 4G with a 4x CPU
     slowdown: LCP 3652ms, the worst of any page family on the site, and the
     element is .pack-art, whose artwork is a background-image in packs.css.
     A background cannot be a <picture> (the note in CLAUDE.md about the
     image-set is about exactly this element), so the url only exists once
     packs.css has arrived AND been parsed: HTML, then the stylesheet, then
     the 100KB pack. Three serialised round trips before the biggest thing on
     the page starts downloading, where every <img> on the site gets to start
     during the HTML parse.

     type="image/avif" is what makes this safe rather than a gamble. A browser
     that cannot decode AVIF drops the preload on the floor and loads the WebP
     from packs.css exactly as before, which is the same fallback the
     image-set() already relies on; a browser that can decode it was going to
     fetch this precise file anyway, because image-set names AVIF first. So
     this cannot cause a double download, and that was verified from the
     request log rather than assumed.

     packSet is never a set without artwork: it resolves to "multi" or
     "default" otherwise, and both ship a pack. -->
<link rel="preload" as="image" href="/assets/packs/${packSet}-garbage-rips-585-booster-pack.avif" type="image/avif" fetchpriority="high">
${FONTS}
${STYLES}
<style>${RARITY_CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}

<main id="main" class="rip tight${v.greatest ? " hall" : ""}">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/videos.html">Every rip</a>${setId ? ` / <a href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}</p>
    <div class="rip-grid${v.vertical === false && !(OVERRIDES[v.id] || {}).pillarboxed ? " rip-grid--wide" : ""}">
      <div class="rip-stage">
        <div class="rip-player pack-player${(OVERRIDES[v.id] || {}).pillarboxed ? " rip-player--crop" : v.vertical === false ? " rip-player--wide" : ""}" id="player" data-id="${v.id}" data-title="${esc(title)}">
          <!-- THIS POSTER IS COMPLETELY COVERED BY THE PACK, AND IT IS IN A
               <noscript> BECAUSE loading="lazy" DID NOT STOP IT DOWNLOADING.
               ui.css pins .rip-player .pack to inset:0 at z-index 3 and the
               pack is opaque, which is the whole point of it.

               It was fetchpriority=high once, raced every rip page to download
               154.7KB nobody can see, and became the LCP element at 3,036ms on
               a throttled phone. Demoting it to lazy+low fixed the PRIORITY and
               not the FETCH: lazy is a heuristic about distance DOWN the page,
               and this sits at the top of it, so all 313 rip pages still paid
               for it. Measured over the wire on 16 August 2026: 89-242KB per
               page, mean about 120KB, 13-18% of a 660KB page. It was also the
               only image anywhere on the site over the 200KB ceiling, and a
               disk scan could never say so because it is served by YouTube.

               Verified never visible in any state before this changed: the
               img rect equalled the pack rect exactly, opacity 1, pack on top;
               and packplayer.js removes the poster outright when it mounts the
               iframe, so the tear never reveals it either. <noscript> keeps the
               fallback the original comment intended, for the one case that
               cannot remove it, and costs a scripted reader nothing.

               packplayer.js's poster lookup is already null-guarded, so it is
               a no-op now rather than a break. (No backticks in this comment:
               it lives inside a template literal, and quoting the code here
               closed the string and failed the build once already.) -->
          <noscript>
            <picture>
              <source type="image/webp" srcset="${thumbWebp}">
              <img src="${thumb}" alt="" width="${v.vertical === false ? 1280 : 720}" height="${v.vertical === false ? 720 : 1280}" decoding="async">
            </picture>
          </noscript>
          <button class="pack pack--${packSet}" id="pack" type="button" aria-label="Rip open: ${esc(title)}">
            <span class="pack-face pack-l" aria-hidden="true">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setLabel || "GARBAGE RIPS")}<small>${setLabel ? "GARBAGE RIPS 585" : "585"}</small></span>
            </span>
            <span class="pack-face pack-r" aria-hidden="true">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(setLabel || "GARBAGE RIPS")}<small>${setLabel ? "GARBAGE RIPS 585" : "585"}</small></span>
            </span>
            <span class="pack-flash" aria-hidden="true"></span>
            <span class="pack-hint">CLICK TO RIP THE PACK</span>
          </button>
          <button class="sound-on" id="soundOn" type="button" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>
            <span class="sound-on-label">Tap for sound</span>
          </button>
        </div>
      </div>
      <div>
        <noscript>
            <!--
              The pack is a button that mounts the player, so with scripting off
              it is a picture that does nothing and the visitor cannot watch the
              rip at all. This link only exists in that case: it never renders
              for anyone whose browser runs the pack.

              It is a deliberate exception to "every click stays on the site".
              That rule exists so a tile does not bounce somebody to YouTube
              when the site could have shown them the video itself. Here the
              site cannot, so a dead pack is the only other option.
            -->
            <p class="pack-nojs">The pack needs JavaScript to open.
              <a href="https://www.youtube.com/watch?v=${v.id}" rel="noopener" target="_blank">Watch this rip on YouTube</a>
              instead, or turn scripting on and click the pack.</p>
        </noscript>
        ${
          // NOT LAZY, AND THAT IS THE OTHER HALF OF THE SAME BUG. Measured at
          // 390x844 this logo's box starts at y=709 of an 844px viewport, so it
          // is IN the first screen, and `loading="lazy"` is a VERTICAL heuristic
          // and nothing else: an image the browser can already see gains nothing
          // from being deferred and loses the preload scanner, which is the only
          // chance it had to start during the HTML parse. It was both oversized
          // and delayed, so both are fixed here together.
          setLogoImg(setId, { cls: "rip-setlogo", clamp: "rip", lazy: false })
        }
        <h1>${esc(title)}</h1>
        <div class="rip-badges">
          ${setId ? `<a class="chip" href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}
          ${prodId ? `<a class="chip prod" href="/videos.html?product=${prodId}">${esc(prodLabel)}</a>` : ""}
          ${hasGuide(setId) ? `<a class="chip guide" href="/sets/${setId}.html">Set guide <span aria-hidden="true">&rarr;</span></a>` : ""}
          ${
            // THE RARITIES COME OUT OF THE HIT FIELD, not out of a second column.
            // Tim writes every hit into one free text cell because a single rip
            // can produce several tiers, and asking for a dropdown as well means
            // typing the same fact twice and losing all but one of them. Where
            // that field names tiers, those win; otherwise fall back to the tags
            // derived from the title.
            (() => {
              const named = raritiesIn(v.hitCard);
              return named.length
                ? named.map((id) => rarityChip(id)).join("\n          ")
                : v.pulls.map((p) => `<span class="chip">${esc(labelFor("pulls", p))}</span>`).join("\n          ");
            })()
          }
        </div>
        <p class="rip-meta">${shortDate(v.published)}${v.views ? " &bull; " + niceViews(v.views) : ""}${v.openingType ? " &bull; " + esc(v.openingType) : ""}</p>
        ${/*
          THE PARAGRAPH IS A FALLBACK, NOT A HEADING.
          The Hit Card column is free text, and on a 14-pull video it arrives as
          a 936 character comma-separated dump: "Phantasmal Flames - Trainer -
          Dawn - Double Silver Star - Ultra Rare, Phantasmal Flames - Mega
          Gengar ex - ...". Those same 14 cards render below with their scans,
          their prices and a lightbox, so printing the dump as well says nothing
          the reader is not about to see, badly.

          So it renders only when there is nothing resolved to show it with.
          One card named in the sheet and no scan for it is exactly the case
          this paragraph exists for, and it still gets it.
        */ ""}${v.hitCard && !resolvedHits.length ? `<div class="hit-panel">
          <p class="hit-label">The hit</p>
          <p class="hit-card">${esc(tidy(v.hitCard))}</p>
          ${v.hitRarity ? `<p class="hit-rarity">${esc(rarityLabel(v.hitRarity))}</p>` : ""}
        </div>` : v.hasHit === false ? `<p class="hit-none">No hit in this one. Certified Garbage Rip.</p>` : ""}
        ${desc ? `<div class="rip-desc">${esc(desc)}</div>` : ""}
        <div class="rip-nav">
        ${/* .btn-sub, not .btn-yt. This is the fourth of the four Subscribe
             controls on the site and it has to match the bar pill, the menu
             pill and the footer button, all three of which a reader on this
             page can see above and below it. The class, the colour and the
             fence around that colour are in the --yt-red block in
             assets-source/ui.css. It carries an aria-label for the same reason
             the footer's does: it leaves the site.

             AS A JS COMMENT, NOT AN HTML ONE. An HTML comment here shipped into
             310 rip pages, and the backticks in it closed the template literal
             and broke the parse, which check-build caught as
             "build-pages.mjs does not parse". */ ""}
          <a class="btn btn-sub btn-sm" href="${SUBSCRIBE}" rel="noopener" target="_blank"
            aria-label="Subscribe to Garbage Rips 585 on YouTube. Opens YouTube.">Subscribe</a>
          ${v.affiliate ? `<a class="btn btn-sky btn-sm" href="${esc(v.affiliate)}" rel="nofollow sponsored noopener">Rip one yourself</a>` : ""}
          ${prev ? `<a class="btn btn-ghost btn-sm" href="/${pathFor(prev)}">&larr; Previous rip</a>` : ""}
          ${next ? `<a class="btn btn-ghost btn-sm" href="/${pathFor(next)}">Next rip &rarr;</a>` : ""}
        </div>
        ${v.affiliate ? `<p class="aff-note">Affiliate link. If you buy through it we may earn a small commission at no extra cost to you.</p>` : ""}
      </div>
    </div>
  </div>
${
  hits.length
    ? `<section class="band tight hits-band">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Below the fold</p>
    <h2>What came out of <span class="hl">this one</span></h2>
    <p class="lede" style="max-width:38em">${hits.length} card${hits.length === 1 ? "" : "s"} worth keeping${
        hits.some((h) => h.psa10) ? ", with what they go for raw and in a PSA 10" : ", with what they go for raw"
      }.</p>
    <ul class="hitcards" id="hitcards">
      ${hits
        .map(
          (h, hi) => `<li class="hitcard" style="--i:${hi}" data-name="${esc(h.name)}" data-set="${esc(h.setName || "")}" data-n="${esc(h.n || "")}" data-rarity="${esc(rarityLabel(h.rarity) || "")}" data-img="${esc(h.img ? h.img.replace("low.webp", "high.webp") : "")}" data-price="${typeof h.price === "number" ? moneyExact(h.price) : ""}" data-psa="${h.psa10 ? moneyRound(h.psa10) : ""}" data-src="${esc(h.priceSource || "")}">
        <button class="hitcard-open" type="button" aria-label="See ${esc(h.name)} larger"></button>
        ${
          h.img
            // alt="" AND THE HIT IS STILL NAMED THREE WAYS WITHOUT IT: the
            // hitcard-open button above is aria-labelled "See NAME larger", and
            // hitcard-n and hitcard-s below print the name and the set as
            // visible text. The alt was a fourth copy, so every hit on all 317
            // rip pages announced the card, then the card again, before the
            // reader reached the price. Same call as the chase grids on the
            // species and set pages. The is-none branch below is already
            // aria-hidden for exactly this reason.
            ? avifPicture(`<img class="hitcard-img" src="${esc(h.img)}" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(h.img)}>`)
            : `<div class="hitcard-img is-none" aria-hidden="true"></div>`
        }
        <div class="hitcard-b">
          <p class="hitcard-n">${esc(h.name)}</p>
          <!-- A HIT CAN LEGITIMATELY HAVE NO SET. Tim writes the set on most hit
               lines and leaves it off some, and on a video that opened packs
               from several sets nothing can honestly say which one a card came
               from. esc(undefined) rendered the literal string "undefined" on
               three rip pages. Absent means print nothing, which is what the
               rest of this file does with missing data. -->
          ${h.setName ? `<p class="hitcard-s">${esc(h.setName)}${h.n ? ` &bull; #${esc(h.n)}` : ""}</p>` : h.n ? `<p class="hitcard-s">#${esc(h.n)}</p>` : ""}
          ${h.rarity ? `<p class="hitcard-r">${esc(rarityLabel(h.rarity))}</p>` : ""}
          <p class="hitcard-p">${
            typeof h.price === "number" ? `<b>${moneyExact(h.price)}</b> <span>raw NM</span>` : `<span class="hitcard-nop">No market price</span>`
          }</p>
          ${h.psa10 ? `<p class="hitcard-psa">${moneyRound(h.psa10)} <span>PSA 10</span></p>` : ""}
          ${h.priceSource ? `<p class="hitcard-src">${esc(h.priceSource)}, ${esc(shortDate(h.priceAsOf) || h.priceAsOf)}</p>` : ""}
        </div>
      </li>`,
        )
        .join("\n      ")}
    </ul>
    <p class="price-note">${esc(priceNote(pricesDoc, { lead: "Raw prices" }))}
      PSA 10 prices come from PriceCharting's guide too, read the same day, and only exist for some cards, so the
      line is shown where we have one and left off where we do not. Promos are not in that feed at all: where a promo carries a price it was
      read by hand from the source named under it, on the date shown, and it does not refresh overnight like the rest. We do not sell cards.</p>
  </div>
</section>`
    : v.hasHit === false
      ? `<section class="band tight nohits">
  <div class="wrap">
    <img class="nohits-img" src="/assets/trubbish.webp" alt="" loading="lazy" onerror="this.remove()" decoding="async" width="180" height="180">
    <h2>No hits. Just another <span class="hl">classic</span> garbage rip.</h2>
    <p class="lede">That is most of them. The good ones only mean anything because of these.</p>
    <p><a class="btn btn-sky btn-sm" href="/hall.html">See the ones that did hit</a></p>
  </div>
</section>`
      : ""
}

${sameBox.length ? `<section class="band tight">
  <div class="wrap">
    <div class="sec-head">
      <div><h2>More from <span class="hl">${esc(v.box)}</span></h2></div>
    </div>
    <div class="vid-grid">
      ${sameBox.map((r) => `<article class="vid"><a class="vid-shell" href="/${pathFor(r)}" aria-label="${esc(r.siteTitle || r.title)}">
        <span class="pack pack--tile pack--${r.sets.length > 1 ? "multi" : packsOnDisk.has(r.sets[0]) ? r.sets[0] : "default"}" aria-hidden="true">
          <span class="pack-face pack-l"><span class="pack-art"></span></span></span>
      </a><h3 class="vid-title"><a href="/${pathFor(r)}">${esc(r.siteTitle || r.title)}</a></h3></article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}

${chaseBlock}

${related.length ? `<section class="band tight">
  <div class="wrap">
    <div class="sec-head">
      <div>
        ${
          // This one KEEPS loading="lazy": the "More <set>" band sits several
          // screens down on every rip page, which is the case the attribute is
          // actually for.
          setLogoImg(setId, { cls: "setlogo", clamp: "sec", lazy: true })
        }
        <h2>More <span class="hl">${esc(setLabel)}</span></h2>
      </div>
      <a class="btn btn-ghost btn-sm" href="/videos.html?set=${setId}">See all &rarr;</a>
    </div>
    <div class="vid-grid">
      ${related.map((r) => `<article class="vid">
        <a class="vid-shell" href="/${pathFor(r)}" aria-label="${esc(r.title)}">
          <span class="pack pack--tile pack--${r.sets.length > 1 ? "multi" : packsOnDisk.has(r.sets[0]) ? r.sets[0] : "default"}" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art"></span>
              <span class="pack-brand">${esc(r.sets[0] ? labelFor("sets", r.sets[0]) : "GARBAGE RIPS")}<small>${r.sets[0] ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>
          <span class="vid-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        </a>
        <h3 class="vid-title"><a href="/${pathFor(r)}">${esc(r.title)}</a></h3>
        <p class="vid-meta">${shortDate(r.published)}</p>
      </article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}
<!-- </main> CLOSES HERE, NOT ABOVE THE THREE BANDS.
     It used to close right after the player, which left "What you are chasing",
     "More from <box>" and "More <set>" as direct children of <body>: three
     content sections with their own h2, outside every landmark, on all 311 rip
     pages. That is not a tidiness point. The skip link targets #main, so a
     reader who takes it lands in a region that ends before more than half the
     page, and anyone navigating by landmark finds those sections in no region
     at all. axe reports it as "All page content should be contained by
     landmarks"; the lived version is that the skip link undersells the page.
     main{padding:var(--s4) 0 var(--s8)} now puts its 64px bottom padding below
     the last band instead of above the first, which is where it belonged. -->
</main>

${footer()}
<script>
// The player lives in /assets/packplayer.js, which shared/chrome.mjs now ships
// on EVERY page via APP_JS, so this page must not request it a second time.
// It did, and the IIFE ran twice on all 311 rip pages: two sets of document
// listeners, and window.GRPack pointing at the second instance while the
// first kept an orphaned registry of what was playing.
addEventListener('DOMContentLoaded',function(){
  var r=document.querySelector('.rip-stage');
  if(r&&window.GRPack) GRPack.attach(r);
});
</script>
<div class="hitlb" id="hitlb" role="dialog" aria-modal="true" aria-labelledby="hitlbName" hidden>
  <div class="hitlb-in">
    <button class="hitlb-x" type="button" id="hitlbX" aria-label="Close">&times;</button>
    <picture><source id="hitlbAvif" type="image/avif"><img id="hitlbImg" alt=""></picture>
    <div class="hitlb-b">
      <p class="hitlb-n" id="hitlbName"></p>
      <p class="hitlb-s" id="hitlbSet"></p>
      <p class="hitlb-p" id="hitlbPrice"></p>
      <p class="hitlb-psa" id="hitlbPsa"></p>
      <p class="hitlb-src" id="hitlbSrc"></p>
    </div>
  </div>
</div>
<script>
(function(){
  var list=document.getElementById('hitcards');
  if(!list) return;
  var cards=list.querySelectorAll('.hitcard');
  if(!cards.length) return;

  // Strips the hidden state at its SOURCE rather than overriding it. Adding
  // .is-in only wins if the transition then runs; dropping .is-armed removes
  // the opacity:0 rule outright, so the cards are visible even if nothing
  // animates. A failsafe that itself depends on the animation is not one.
  function revealAll(){
    list.classList.remove('is-armed');
    for(var i=0;i<cards.length;i++) cards[i].classList.add('is-in');
  }
  // ARM AND REVEAL ARE COUPLED, and they were not. Arming hides every card
  // immediately and the reveal was left entirely to the observer, so anything
  // that stopped the observer firing left all 14 cards permanently invisible.
  // That is a worse failure than no animation at all, and it is what shipped.
  if(!('IntersectionObserver' in window) ||
     (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
    return;   // never armed, so the cards are simply visible
  }
  list.classList.add('is-armed');

  // FAILSAFE. If the observer has not revealed everything within two seconds,
  // show it anyway. No animation is a small loss; an invisible section is not.
  var failsafe=setTimeout(revealAll, 2000);

  var io=new IntersectionObserver(function(entries){
    for(var i=0;i<entries.length;i++){
      if(!entries[i].isIntersecting) continue;
      entries[i].target.classList.add('is-in');
      io.unobserve(entries[i].target);
    }
    if(!list.querySelector('.hitcard:not(.is-in)')) clearTimeout(failsafe);
  },{rootMargin:'0px 0px -5% 0px',threshold:0});
  for(var i=0;i<cards.length;i++) io.observe(cards[i]);

  // Tap a card for a bigger scan and the full price detail.
  var lb=document.getElementById('hitlb'), lbImg=document.getElementById('hitlbImg');
  var lastFocus=null;
  function txt(id,v){ var e=document.getElementById(id); e.textContent=v||''; e.hidden=!v; }
  function open(li){
    lastFocus=document.activeElement;
    var img=li.getAttribute('data-img');
    // The one place this page asks for high.webp, 600x825 and 100-135KB, and
    // AVIF is about 35% smaller for the same pixels. avifPicture() cannot reach
    // it because the url only becomes an image url on click, so the <source> is
    // filled here, applying the SAME host test avifPicture applies: only
    // assets.tcgdex.net publishes an AVIF beside its WebP, and a <source>
    // pointing at a 404 paints a broken card rather than falling back.
    // srcset FIRST, then src, so the webp is never requested and abandoned.
    // Same shape as #lbAvif on the set guides.
    var avif=document.getElementById('hitlbAvif');
    if(img && img.indexOf('https://assets.tcgdex.net/')===0 && img.slice(-5)==='.webp')
      avif.setAttribute('srcset', img.slice(0,-5)+'.avif');
    else avif.removeAttribute('srcset');
    if(img){ lbImg.src=img; lbImg.alt=li.getAttribute('data-name')+', '+li.getAttribute('data-set'); lbImg.hidden=false; }
    else lbImg.hidden=true;
    txt('hitlbName', li.getAttribute('data-name'));
    var n=li.getAttribute('data-n');
    txt('hitlbSet', li.getAttribute('data-set') + (n ? ' \u2022 #'+n : '') );
    var rar=li.getAttribute('data-rarity'), pr=li.getAttribute('data-price');
    txt('hitlbPrice', pr ? pr+' raw NM' + (rar ? '  \u2022  '+rar : '') : (rar||'No market price'));
    var psa=li.getAttribute('data-psa');
    txt('hitlbPsa', psa ? psa+' in a PSA 10' : '');
    var src=li.getAttribute('data-src');
    txt('hitlbSrc', src ? 'Price from '+src : '');
    lb.hidden=false;
    document.body.style.overflow='hidden';
    document.getElementById('hitlbX').focus();
  }
  function close(){
    lb.hidden=true; document.body.style.overflow='';
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }
  list.addEventListener('click',function(e){
    var btn=e.target.closest ? e.target.closest('.hitcard-open') : null;
    if(!btn) return;
    open(btn.parentNode);
  });
  document.getElementById('hitlbX').addEventListener('click',close);
  // Click the backdrop, but not the card itself.
  lb.addEventListener('click',function(e){ if(e.target===lb) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && !lb.hidden) close(); });
})();
</script>
${APP_JS}
</body>
</html>
`;
}

// Newest first, so "previous" walks backwards in time.
const ordered = videos.slice().sort((a, b) => (a.published < b.published ? 1 : -1));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (let i = 0; i < ordered.length; i++) {
  const v = ordered[i];
  await writeFile(join(ROOT, "public", pathFor(v)), page(v, ordered[i + 1], ordered[i - 1]));
}

// Sitemap: the three hubs plus every generated page.
const today = videos[0]?.published || "2026-08-10";
let setPages = [];
try {
  const sd = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
  setPages = (sd.sets || []).map((s) => ({
    loc: `${SITE}/sets/${s.id}.html`, freq: "weekly", pri: "0.8", mod: sd.syncedAt,
  }));
} catch {
  /* set pages not generated yet */
}

// The non-English guides live in the same folder but come from a different
// source file, so they need collecting separately or they stay out of search
// entirely. Lower priority than the English guides on purpose: they answer a
// narrower question, and most of the audience is searching the English name.
try {
  const ig = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
  setPages = setPages.concat(
    Object.entries(ig.sets || {})
      // A guide with no checklist at all is published noindex by
      // build-intl-pages, so listing it here would be the sitemap asking a
      // crawler to fetch a page that tells it to go away. Two of the thirteen.
      .filter(([, g]) => g.hasCards)
      .map(([id]) => ({
        loc: `${SITE}/sets/${id}.html`, freq: "monthly", pri: "0.7", mod: ig.checked,
      }))
  );
} catch {
  /* run: node scripts/sync-intl-guides.mjs && node scripts/build-intl-pages.mjs */
}

// The per-Pokemon pages. ONE PER SPECIES IS WRITTEN AND ONLY THE INDEXABLE ONES
// GO IN HERE, which is the whole reason `index` exists on those rows.
//
// This block used to take every row in the file, and the comment above it said
// the roster was "capped deliberately so this can never balloon into a thousand
// thin pages". The cap has gone: build-pokemon.mjs now writes a page for all
// 1,025 species so that nothing dead-ends, and decides per page whether it has
// enough sourced card data to be worth a crawl. A page below that bar ships
// noindex, so listing it here would be the sitemap asking a crawler to fetch a
// page that tells it to go away, and check-build.py fails the build over exactly
// that. FILTER, do not map.
try {
  const pk = JSON.parse(await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8"));
  setPages = setPages.concat(
    (pk.pokemon || [])
      .filter((p) => p.index !== false)
      .map((p) => ({
        loc: `${SITE}/pokemon/${p.slug}.html`, freq: "weekly", pri: "0.7", mod: pk.checked,
      }))
  );
} catch {
  /* run: node scripts/build-pokemon.mjs */
}

// Every product page build-openings.mjs actually wrote, minus its index, which
// is listed separately with its own priority.
const openingPages = (await readdir(join(ROOT, "public/openings")).catch(() => []))
  .filter((f) => f.endsWith(".html") && f !== "index.html")
  .sort()
  .map((f) => ({ loc: `${SITE}/openings/${f}`, freq: "weekly", pri: "0.8" }));

const urls = [
  { loc: `${SITE}/`, freq: "daily", pri: "1.0" },
  { loc: `${SITE}/videos.html`, freq: "daily", pri: "0.9" },
  { loc: `${SITE}/sets/`, freq: "weekly", pri: "0.9" },
  ...setPages,
  // Changes every week by design, so it asks to be crawled every week.
  { loc: `${SITE}/drops.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/playlists.html`, freq: "weekly", pri: "0.7" },
  // One page per playlist, generated by build-playlists.mjs, which stamps
  // `path` onto each entry. Read from the data rather than re-derived, so a
  // url can never be in the sitemap without the page existing.
  ...(JSON.parse(await readFile(join(ROOT, "public/data/playlists.json"), "utf8")).playlists || [])
    .filter((p) => p.path)
    .map((p) => ({ loc: `${SITE}/${p.path}`, freq: "weekly", pri: "0.6" })),
  // Added later than the rest and missed here: all three are indexable and
  // linked from the nav on every page, so leaving them out told search engines
  // the opposite of what the site says.
  { loc: `${SITE}/wanted.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/hall.html`, freq: "weekly", pri: "0.8" },
  { loc: `${SITE}/shops.html`, freq: "monthly", pri: "0.7" },
  // Only once they have entries. Both render an honest empty state and go
  // noindex while the list is empty, so listing them in the sitemap before
  // then would contradict the page and fail check-build's noindex rule.
  ...(JSON.parse(await readFile(join(ROOT, "data/vendors.json"), "utf8")).vendors.length
    ? [{ loc: `${SITE}/vendors.html`, freq: "monthly", pri: "0.7" }]
    : []),
  ...(JSON.parse(await readFile(join(ROOT, "data/creators.json"), "utf8")).creators.length
    ? [{ loc: `${SITE}/creators.html`, freq: "monthly", pri: "0.7" }]
    : []),
  { loc: `${SITE}/about.html`, freq: "monthly", pri: "0.8" },
  // The complete set list. High priority: it is the most linkable reference
  // page on the site and the one most likely to be found cold in search.
  { loc: `${SITE}/expansions.html`, freq: "weekly", pri: "0.9" },
  // Observed hit rates. The most linkable page on the site: nobody else has
  // this data, so it is the one most likely to be cited from outside.
  // Only when it has data. An empty page in the sitemap at priority 0.9 tells
  // a crawler this is one of the most important pages on the site, and it is
  // currently a dash and a zero. check-build.py already fails a noindex page
  // that appears here, so leaving it in would break the build as well.
  ...(JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8")).videos.some(
    (v) => typeof v.hasHit === "boolean",
  )
    ? [{ loc: `${SITE}/luck.html`, freq: "weekly", pri: "0.9" }]
    : []),
  // Release dates. High priority and frequent: this is the page people search
  // for by name in the weeks before a set drops.
  { loc: `${SITE}/upcoming.html`, freq: "weekly", pri: "0.9" },
  // One product, in depth, and the best untaken search on the site. Weekly
  // rather than monthly because the card prices on it are dated and Series 3
  // only came out on 7 August 2026, so its PSA 10 column is still filling in.
  { loc: `${SITE}/first-partner-illustration-collection.html`, freq: "weekly", pri: "0.9" },
  // The beginner guide. Evergreen and the best long-tail search target on the
  // site: "pokemon card rarity symbols" is asked constantly and never expires.
  { loc: `${SITE}/rarity.html`, freq: "monthly", pri: "0.9" },
  // The 11 card types. Monthly because the content is stable: the type list has
  // not moved since 2020 and the measured tendencies are printed values, not
  // prices. The measurement date is the only thing on it that changes. High
  // priority for the same reason as the rarity guide: "pokemon card types" is
  // asked constantly, almost every answer online is the 18-type video game
  // chart, and this page is the one that is about the cards.
  { loc: `${SITE}/types.html`, freq: "monthly", pri: "0.9" },
  // Local card show calendar. Weekly and high priority: it carries Event
  // structured data, the listings genuinely change, and "card shows near me" is
  // the kind of local search this site can actually win.
  { loc: `${SITE}/card-shows.html`, freq: "weekly", pri: "0.9" },
  // Card search. 4,481 cards with live prices behind one page: the deepest
  // reference on the site and the one worth crawling most often.
  { loc: `${SITE}/cards.html`, freq: "daily", pri: "0.9" },
  // The beginner hub. The natural landing page from a video description, and
  // the front door for every guide on the site.
  { loc: `${SITE}/start.html`, freq: "monthly", pri: "0.9" },
  // The rules of the game. Monthly because the rules do not move; the July 2026
  // rulebook was diffed against the March one and nothing in setup, the turn or
  // winning had changed. High priority because "how to play pokemon cards" is
  // asked constantly and the answer does not expire, which makes it the best
  // long-tail target added here since the rarity guide.
  { loc: `${SITE}/how-to-play.html`, freq: "monthly", pri: "0.9" },
  // The two free official apps, sitting beside the rules page they hang off.
  // Monthly, and a deliberate half-step down in priority each time: the rules do
  // not move, Live describes software that does, and Pocket ships a new
  // expansion every few weeks and moves fastest of the three.
  { loc: `${SITE}/tcg-live.html`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/tcg-pocket.html`, freq: "monthly", pri: "0.7" },
  // The two deck pages. WEEKLY, unlike the three guides above them, and that is
  // the whole difference: those describe rules and software that barely move,
  // while these two are a dated measurement of a metagame. They are only ever
  // as fresh as the last run of scripts/sync-decks.mjs, and both pages print
  // the date they were measured for exactly that reason. High priority because
  // "pokemon deck list" and "best pokemon cards to play" are asked constantly
  // and almost every answer is somebody's opinion rather than a counted one.
  { loc: `${SITE}/decks.html`, freq: "weekly", pri: "0.9" },
  { loc: `${SITE}/top-100-playable.html`, freq: "weekly", pri: "0.9" },
  // The highest PSA 10 values. MONTHLY, and deliberately slower than the deck
  // pages above even though it is also a dated measurement, because it is not
  // on any sync schedule at all: the crawl behind it is run by hand and the
  // page prints the day it was read. Telling a crawler "weekly" would be this
  // site promising a freshness it has not arranged. High priority anyway, since
  // "most valuable pokemon cards" is asked constantly and almost every answer
  // is an unsourced list; this one names its measurement and cites every row.
  { loc: `${SITE}/top-graded.html`, freq: "monthly", pri: "0.9" },
  // The two Topps pages. The GUIDE is monthly and high priority because what it
  // holds is a print run from 1999 to 2004: set names, dates, card counts and
  // how to tell a Topps card from a TCG card do not expire, and "topps pokemon
  // cards" is asked by people who have just found one in a box and cannot work
  // out what it is. The VALUES page is monthly for the same reason
  // /top-graded.html is, and NOT weekly: it is a dated measurement on no sync
  // schedule at all, so promising a crawler more would be promising a freshness
  // this site has not arranged. It steps down a notch because it is the second
  // page a reader reaches rather than the one they land on.
  { loc: `${SITE}/topps.html`, freq: "monthly", pri: "0.9" },
  { loc: `${SITE}/topps-card-values.html`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/pokemon/`, freq: "weekly", pri: "0.8" },
  // Real vs fake. Evergreen and the best long-tail target on the site after the
  // rarity guide: "how to spot fake pokemon cards" is asked constantly and the
  // answer does not expire.
  { loc: `${SITE}/fake-cards.html`, freq: "monthly", pri: "0.9" },
  // The 1999 Base Set print runs. MONTHLY and high priority for the same reason
  // as the rarity guide above it: "is my charizard shadowless" and "what is 1st
  // edition pokemon" are asked constantly by people who have just found a card
  // from 1999 in a cupboard, and the answer is a property of a printed card, so
  // it does not expire. The prices on it are dated and stated as a snapshot,
  // which is what stops that being a freshness promise this site has not made.
  { loc: `${SITE}/base-set.html`, freq: "monthly", pri: "0.9" },
  // Grading costs. Weekly rather than monthly because the fee table goes stale
  // fast: PSA paused two tiers in June with two weeks' notice.
  { loc: `${SITE}/grading.html`, freq: "weekly", pri: "0.9" },
  // Where to sell, and what each venue takes. Weekly for the same reason as
  // grading: it is a page of other companies' fee tables and seller-protection
  // policies, and those move on their schedule rather than ours.
  // The condition half of the grading question. Monthly rather than weekly:
  // unlike the fee table next door, published grading standards barely move.
  { loc: `${SITE}/will-it-grade.html`, freq: "monthly", pri: "0.9" },
  // Sealed product pages. Weekly because the price tables are recomputed from
  // the nightly product sync, so they genuinely change; the openings list only
  // changes when a video goes up.
  { loc: `${SITE}/openings/`, freq: "weekly", pri: "0.9" },
  // DERIVED, NOT TYPED. This was thirteen hand-written lines and they had
  // already drifted in both directions: knock-out.html was being generated and
  // was missing from the sitemap, while ex-box.html was in the sitemap after
  // build-openings.mjs had stopped generating it, so a stale file kept claiming
  // "24 openings" for a product that now has none. Reading the directory cannot
  // drift.
  // The arcade game. Monthly: it does not change unless the game does.
  { loc: `${SITE}/games/garbage-run.html`, freq: "monthly", pri: "0.7" },
  ...openingPages,
  { loc: `${SITE}/selling.html`, freq: "weekly", pri: "0.9" },
  // Where to buy, and what each venue costs a buyer. Weekly for the same
  // reason as selling and grading: it is made of other companies' shipping
  // thresholds and return policies, and those move on their schedule.
  { loc: `${SITE}/buying.html`, freq: "weekly", pri: "0.9" },
  // Where to buy, and what each venue costs a buyer. Weekly for the same reason
  // as selling and grading: it is made of other companies' shipping thresholds
  // and return policies, and those move on their schedule rather than ours.
  // Daily: the totals are recomputed by the nightly price sync, so this page
  // genuinely changes every night. Nothing else here does.
  { loc: `${SITE}/complete-a-set.html`, freq: "daily", pri: "0.9" },
  // Pack prices per set. Daily for the same reason as the line above: every
  // figure on it is recomputed from the product prices the nightly sync pulls,
  // so the page genuinely changes when the market does.
  { loc: `${SITE}/pack-prices.html`, freq: "daily", pri: "0.9" },
  // What sealed product SHOULD cost. MONTHLY, and it is the opposite case to the
  // line above: nothing on it is recomputed from a price feed, because there is
  // no MSRP feed to recompute from. It moves when a person re-reads the sources
  // and edits data/msrp.json, which is a handful of times a year. High priority
  // anyway: "pokemon msrp" is a real search and the page has a sourced answer.
  { loc: `${SITE}/msrp.html`, freq: "monthly", pri: "0.9" },
  // What a beginner or a parent should actually buy. MONTHLY for the same reason
  // as the line above and from the same file: every price on it is joined out of
  // data/msrp.json, so it moves when a person re-reads a source, not when a feed
  // ticks. Promising weekly would be this site claiming a freshness it has not
  // arranged.
  //
  // 0.9, THE SAME AS /start.html, and deliberately not lower. "what pokemon
  // cards should i buy for my kid", "best pokemon cards for beginners" and "what
  // is an elite trainer box" are asked constantly, by people who are about to
  // spend money and have no idea what any of it is, and almost every answer
  // online is an affiliate list. This one names a product per situation and
  // prices every one of them against the manufacturer's own shop.
  { loc: `${SITE}/what-to-buy.html`, freq: "monthly", pri: "0.9" },
  // Which shops actually sell Pokemon cards. MONTHLY on the index and on every
  // retailer page, and the reason is what these pages are made of: the durable
  // half is which department a chain files trading cards under and what it
  // typically stocks, which moves about as often as a shop refits. The dated
  // price readings on them move faster and say so on their face, and asking a
  // crawler back weekly for a page whose sourced facts have not changed is the
  // same overclaim /msrp.html's line above avoids.
  //
  // HIGH PRIORITY ON THE INDEX because "stores that sell pokemon cards" is a
  // real query with no good answer anywhere, and slightly lower on the nine
  // retailer pages because each answers one narrower question.
  //
  // DERIVED FROM THE BUILDER'S OWN OUTPUT, NOT TYPED. build-retailers.mjs writes
  // public/data/retailers-index.json listing exactly the pages it wrote, so this
  // cannot list a url that does not exist and cannot miss one that does. That is
  // the same fix the openings block above records having needed after thirteen
  // hand-written lines drifted in both directions at once.
  { loc: `${SITE}/retailers.html`, freq: "monthly", pri: "0.9" },
  ...(await readFile(join(ROOT, "public/data/retailers-index.json"), "utf8")
    .then((s) => (JSON.parse(s).pages || []).map((p) => ({
      loc: `${SITE}${p.path}`, freq: "monthly", pri: "0.7",
    })))
    .catch(() => [])),
  // The two ranked price lists. DAILY, because the whole page is a price read
  // on one date and a stale one is the failure mode these pages are built to
  // avoid; the nightly re-runs sync-top100.mjs and both pages change.
  { loc: `${SITE}/most-valuable-cards.html`, freq: "daily", pri: "0.8" },
  { loc: `${SITE}/most-expensive-sealed.html`, freq: "daily", pri: "0.8" },
  // How many packs are in each sealed product. Monthly, not daily: unlike the
  // two lines above it, nothing on it is recomputed from a price feed. It moves
  // when a human re-reads the product pages, which is when a new product line
  // ships. High priority anyway, because "how many packs in a booster box" is
  // an evergreen question with a checkable answer.
  { loc: `${SITE}/how-many-packs.html`, freq: "monthly", pri: "0.9" },
  // "What set is my card from". Monthly: the index only moves when a set ships.
  // High priority anyway, because it is the same kind of evergreen reference as
  // the rarity guide and it is the page somebody lands on holding a card.
  { loc: `${SITE}/what-set.html`, freq: "monthly", pri: "0.9" },
  // The games. Monthly rather than weekly: the pages themselves barely change,
  // it is the data behind them that moves. "who's that pokemon" and "pokemon
  // trivia" are both high volume searches this site has a real answer to, which
  // is why they are 0.8 and not an afterthought.
  { loc: `${SITE}/games/`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/games/whos-that-pokemon.html`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/games/guess-the-set.html`, freq: "monthly", pri: "0.8" },
  { loc: `${SITE}/games/pokemon-trivia.html`, freq: "monthly", pri: "0.8" },
  // Pokedex lore. Evergreen, and the only page on the site that is not about
  // buying, opening or valuing anything.
  { loc: `${SITE}/lore.html`, freq: "monthly", pri: "0.8" },
  // Every official Pokemon video game, in order. Monthly, not weekly: nothing
  // on it is recomputed from a price feed, so it only moves when a game ships
  // or a fresh Metascore settles. 0.8 matches the lore page and the games hub.
  { loc: `${SITE}/video-games.html`, freq: "monthly", pri: "0.8" },
  // The evolution chart and the Eevee page. MONTHLY and not weekly: nothing on
  // either is recomputed from a feed. They only move when scripts/sync-
  // evolution.mjs is run by hand, which is when a new generation ships, and
  // both print the date the data was read for exactly that reason.
  //
  // 0.9 rather than the 0.8 the three lines above carry, and the difference is
  // deliberate. Lore and the video game timeline are pages somebody enjoys once
  // they are here; "how does X evolve" is a question typed into a search box
  // several times a day forever and never expires, which is the same profile as
  // the rarity guide and the types page and the same priority they get.
  { loc: `${SITE}/evolution.html`, freq: "monthly", pri: "0.9" },
  // Half a step down, matching the pattern the app pages set: the chart is the
  // reference, this is one entry in it given its own address because the
  // question is asked on its own. It must not outrank the page it is part of.
  { loc: `${SITE}/eevee-evolutions.html`, freq: "monthly", pri: "0.8" },
  ...ordered.filter((v) => taggedIds.has(v.id)).map((v) => ({ loc: `${SITE}/${pathFor(v)}`, freq: "monthly", pri: "0.6", mod: v.published })),
];
await writeFile(
  join(ROOT, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.mod || today}</lastmod>\n` +
          `    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`
);

// robots.txt comes from the same source as the canonicals, so the two can
// never disagree about which address this site lives at.
await writeFile(join(ROOT, "public/robots.txt"), robots());

console.log(`
Wrote public/robots.txt  (${LIVE ? "live: crawling allowed" : `staging: crawling disallowed, real domain will be ${DOMAIN}`})
Wrote ${ordered.length} rip pages to public/rip/
Wrote public/sitemap.xml with ${urls.length} urls

  ${tagged.length} fully tagged, indexed and in the sitemap
  ${videos.length - tagged.length} untagged: page still exists so a click never
  leaves the site, but marked noindex so they are not thin pages in search
  (see UNTAGGED.md; tag them and re-run this)
`);
