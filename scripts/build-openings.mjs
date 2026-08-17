#!/usr/bin/env node
// Build /openings/: one page per kind of sealed product, plus an index.
//
//   node scripts/build-openings.mjs
//
// Reads public/data/videos.json (what was opened), public/data/products.json
// (what each one costs), shared/taxonomy.mjs (the product vocabulary) and
// shared/riplabel.mjs (how a rip is named).
//
// THE GAP THIS FILLS IS STRUCTURAL, NOT EDITORIAL. /videos.html can already
// filter the catalogue by product type, and that filter is a JavaScript state,
// not a url. So "elite trainer box" and "booster bundle", which are among the
// most asked questions in the hobby, had no page on a site holding 62 filmed
// ETB openings. Thirteen product types, zero indexable homes.
//
// WHAT MAKES THESE PAGES DEFENSIBLE rather than another thin category stub:
// nobody else can put the price of the product across every set NEXT TO
// dozens of that exact product being opened on camera. The price half is
// commodity. The footage half is not, and it is already in the repo.
//
// ============================================================================
// THE BLURB TRAP, and it nearly went out as fact.
//
// products.json carries a `blurb` per product, and it reads like a per-set
// contents description: "9 packs plus sleeves and dice". It is not. It is a
// CONSTANT PER KIND, written once and repeated across every set: all 23 Elite
// Trainer Box entries carry that identical string, and real ETB pack counts
// have varied by era. Printing it as a fact about a named set would have been
// this site stating an unsourced number, which is the one thing it does not do.
//
// So the contents line is presented as what the kind USUALLY holds, once, in
// the page's own voice, and never per set. The numbers that ARE stated per
// set come from somewhere the site can actually stand behind: the packs
// counted in its own videos. "549 packs across 62 openings" is a fact about
// this channel's catalogue, and this channel is the source.
//
// Where the count is not in the data, the pages say so rather than estimate,
// which is why several read "count not in our data".
// ============================================================================
//
// PRODUCTS WITH NO FOOTAGE DO NOT GET A PAGE. Booster Box and Build & Battle
// Box are priced in products.json but have never been opened on camera here.
// A page for them would be a price table with the unique half missing, which
// is the thin category stub this is trying not to build.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, shortDate, moneyExact, imgDims } from "../shared/format.mjs";
import { PRODUCT_TYPES, CARD_SETS } from "../shared/taxonomy.mjs";
import { ripLabel } from "../shared/riplabel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/openings");
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const prod = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));

// The 4 TCGplayer urls that answer 403, from the fetch of every image url the
// site emits. Skipped up front rather than emitted behind an onerror that hides
// the gap while every page load still pays for a request that fails.
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);

const SET_NAME = new Map(CARD_SETS.map((s) => [s.id, s.label]));

// The products pinned by hand for their photographs, for the kinds the per-set
// pull cannot reach. See scripts/sync-extra-products.mjs.
const EXTRA = JSON.parse(await readFile(join(ROOT, "data/extra-products.json"), "utf8")).products;

// The Japanese, Korean and Chinese sets, and which English set each one is.
// Read for one reason: TCGdex publishes no logo or symbol art for ANY
// non-English set, so a row for "Abyss Eye (JP)" has nothing of its own to
// show. `equivalent` is what /sets/ja-abyss-eye.html already draws in that
// spot, labelled as the English set rather than passed off as the Japanese
// one, and the same labelling is repeated here in visible text.
const INTL = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets;

// ------------------------------------------------------------------ set logos
//
// WHAT A SET LOGO IS DOING ON THESE PAGES. The stat row says "5 different
// sets" and stopped there, so the one genuinely unique thing these pages hold,
// this channel's own record of what it opened, was three digits. The band below
// spends those digits: which sets, how many of each, how many packs came out.
//
// Dimensions are read off the FILES rather than out of data/logo-dims.json,
// which is 23 entries against 28 logos on disk. The five it misses are exactly
// the older sets that turn up on /openings/single-pack.html (Celebrations,
// Chilling Reign, Crown Zenith, Rebel Clash, Shining Fates), so reading the
// json would have dropped five logos with no error anywhere. Same webp header
// parse build-proto.mjs uses.
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);

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

const logoSize = async (file) => {
  try {
    return webpSize(await readFile(join(ROOT, "public/assets/logos", file)));
  } catch {
    return null;
  }
};

// Measured once per build, not once per row: Chaos Rising appears on six of
// these pages and Mega Evolution twice on one of them.
const LOGO_BOX_W = 116;
const LOGO_BOX_H = 42;
const logoCache = new Map();
async function setLogoTag(setId) {
  if (!logosOnDisk.has(setId)) return "";
  if (!logoCache.has(setId)) {
    const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
    const sm = await logoSize(`${setId}-pokemon-tcg-set-logo-sm.webp`);
    const big = await logoSize(`${setId}-pokemon-tcg-set-logo.webp`);
    if (!sm || !big) {
      logoCache.set(setId, "");
    } else {
      // sizes IS THE DRAWN WIDTH, WHICH object-fit:contain DECIDES, NOT THE BOX.
      // Written flat as "116px" this asks for 232 device px at DPR2, which no
      // -sm.webp is wide enough to satisfy, and Chrome correctly reaches past it
      // for the 300px-tall master on every logo. Same arithmetic and the same
      // trap build-playlists.mjs and build-intl-pages.mjs already record.
      const drawnW = Math.round(Math.min(LOGO_BOX_W, (LOGO_BOX_H * big.w) / big.h));
      logoCache.set(
        setId,
        `<img class="op-sl" src="${base}-sm.webp" srcset="${base}-sm.webp ${sm.w}w, ${base}.webp ${big.w}w"` +
          ` sizes="${drawnW}px" width="${sm.w}" height="${sm.h}" alt="" loading="lazy" decoding="async">`
      );
    }
  }
  return logoCache.get(setId);
}

// taxonomy id -> the `kind` string products.json uses. Only the ones that
// genuinely match; a wrong join here would price the wrong box.
const KIND = {
  etb: "Elite Trainer Box",
  "single-pack": "Single Pack",
  bundle: "Booster Bundle",
  blister: "Blister Pack",
  tin: "Tin",
  "collection-box": "Collection Box",
};

// ---------------------------------------------------------------- photography
//
// A PAGE ASKING "WHAT IS IN AN ELITE TRAINER BOX?" HAD NO PICTURE OF ONE. All
// thirteen of these pages were prose, a stat row and a table, which is the one
// place on this site where a photograph does work a sentence cannot: the reader
// asking the question does not yet know what the object looks like on a shelf.
//
// THE ONLY PRODUCT PHOTOGRAPHY THIS SITE HAS IS TCGPLAYER'S AND IT IS PER SET,
// never per type, which is the same constraint /how-many-packs.html hit and the
// rule it set is followed here exactly: the shot is one specific set's product
// standing in for the type, so the caption NAMES THE SET IT ACTUALLY IS and the
// line beside it says out loud that it is one example of the kind. Anything
// looser would be a picture quietly claiming to be a category.
//
// The set choices deliberately match /how-many-packs.html's where the two pages
// show the same kind, so a reader moving between them sees the same box.
//
// SIX OF THE THIRTEEN KINDS USED TO GET NOTHING, and the reason was real: the
// per-set pull in products.json carries no `kind` matching ex Premium
// Collection, Knock Out Collection or Poke Ball Tin, and no Japanese, Korean or
// Chinese product at all. Substituting a nearby box would caption a photo with a
// claim that is not true of that file, so those pages stayed prose.
//
// FOUR OF THE SIX ARE FILLED NOW, AND NOT BY RELAXING THAT. They come from
// data/extra-products.json, where each is a TCGplayer product pinned by id and
// checked by name, chosen because it IS the object the page describes rather
// than something near it. The per-set pull could never see them: three are
// filed under "Miscellaneous Cards & Products" because they belong to no
// expansion, and the Japanese pack is under TCGplayer's own Japanese product
// line. Same caption rule, same 88px box.
//
// TWO STILL GET NOTHING AND PROBABLY ALWAYS WILL. There is no photograph of a
// Korean or a Chinese booster pack anywhere this repo can reach: TCGplayer
// carries no Korean or Chinese Pokemon product under any product line, and
// TCGdex has no Korean card images (its Korean sets borrow the Japanese scans,
// which public/data/intl-guides.json records as `borrowed`) and none at all for
// Simplified Chinese. Those two pages stay prose, and that is a sourcing fact
// rather than a decision to revisit.
//
// [set id, products.json kind, the name we expect to find there]
const PHOTOS = {
  etb: ["pitch-black", "Elite Trainer Box", "Pitch Black Elite Trainer Box"],
  "single-pack": ["pitch-black", "Single Pack", "Pitch Black Booster Pack"],
  bundle: ["pitch-black", "Booster Bundle", "Pitch Black Booster Bundle"],
  blister: ["pitch-black", "Blister Pack", "Pitch Black Single Pack Blister"],
  tin: ["prismatic-evolutions", "Tin", "Prismatic Evolutions Mini Tin"],
  // Not the cheapest Collection Box in the data, and chosen rather than left to
  // the sync. sync-products.mjs picks the cheapest per set, which on most sets
  // is a Poster Collection: a poster and some packs, which is not what the lede
  // above describes. The Kingambit Illustration Collection is a themed box built
  // around one character, which is.
  "collection-box": ["shrouded-fable", "Collection Box", "Kingambit Illustration Collection"],
  upc: ["151", "Ultra-Premium Collection", "151 Ultra-Premium Collection"],
};

/**
 * The photo for a product type, or null.
 *
 * Matched on set id AND kind, then checked against the NAME expected there,
 * exactly as build-how-many-packs.mjs does and for the same reason:
 * sync-products.mjs picks the cheapest variant per kind, so the product behind
 * "prismatic-evolutions / Tin" can change under us. If it does, the caption
 * would name a product that is not in the picture. Drop the photo instead.
 */
function photoFor(id) {
  const spec = PHOTOS[id];
  if (spec) {
    const [sid, kind, expect] = spec;
    const hit = (prod.sets?.[sid]?.products || []).find((p) => p.kind === kind);
    if (!hit || !hit.thumb || DEAD.has(hit.thumb)) return null;
    if (!String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) return null;
    // perSet: the box is one set's, so the caption can say every set sells its
    // own. That sentence is FALSE of the pinned products below, which belong to
    // no expansion at all, so the flag decides the caption rather than a guess.
    return { src: hit.thumb, large: hit.image, name: hit.name, perSet: true };
  }
  const extra = Object.values(EXTRA).find((p) => p.kind === id);
  if (!extra || !extra.thumb || DEAD.has(extra.thumb)) return null;
  return { src: extra.thumb, large: extra.image, name: extra.name, perSet: false };
}

// NO WIDTH OR HEIGHT. imgDims() returns nothing for tcgplayer-cdn on purpose:
// those files run 200x268 to 200x417 and a declaration would be wrong by up to
// 34%. sizes is 88px, not a viewport unit, because .op-shot is a fixed 88x88
// box; that is a measured fix worth 4x the bytes on the set guides and it is
// not a placeholder to be improved.
const shot = (e) => {
  const p = photoFor(e.id);
  if (!p) return "";
  return `      <figure class="op-shot">
        <img src="${esc(p.src)}" srcset="${esc(p.src)} 200w, ${esc(p.large)} 1000w"
             sizes="88px" alt="${esc(p.name)}, sealed" loading="lazy" decoding="async"${imgDims(p.src)}
             referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">
        <figcaption>One example: the <b>${esc(p.name)}</b>. Photo TCGplayer's. ${
          p.perSet
            ? "Every set sells its own, and the art on the box changes with the set."
            : "This kind is a general release rather than a set's own product, so the one in the picture is a specific release and the next one looks different."
        }</figcaption>
      </figure>`;
};

/**
 * The 88px thumbnail on an index card, or the hatched box that means there is
 * no photograph of this on purpose.
 *
 * THE INDEX WAS THIRTEEN TEXT CARDS ON A PAGE HEADED "EVERY KIND OF SEALED
 * PRODUCT", so somebody browsing the kinds saw no product at all. It is the
 * same complaint the per-page shots answered one level down.
 *
 * A CARD IS NOT A FIGURE AND HAS NO FIGCAPTION, so the rule that a caption names
 * the exact file is kept two other ways: the alt text names the product, and the
 * card prints "Pictured:" and the product's own name in small type. Without one
 * of those, a thumbnail on a card headed "Poke Ball Tin" is a picture quietly
 * claiming to be a category, which is the thing the header comment above is
 * about.
 *
 * The hatch is the same 45 degree one .set-noart uses on /sets/ for a set with
 * no logo and .hp-noshot uses on /how-many-packs.html. A plain empty box at this
 * size reads as an image that failed to load, which is the one thing it must not
 * look like when eleven of its neighbours are real photographs.
 */
const cardShot = (e) => {
  const p = photoFor(e.id);
  if (!p) return `<span class="op-ci op-cn" aria-hidden="true"></span>`;
  return `<img class="op-ci" src="${esc(p.src)}" srcset="${esc(p.src)} 200w, ${esc(p.large)} 1000w"
            sizes="88px" alt="One example of a ${esc(e.label)}: the ${esc(p.name)}, sealed"
            loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
};

/** The product actually in that card's picture, or nothing. */
const cardShotName = (e) => {
  const p = photoFor(e.id);
  return p ? `<span class="op-ex">Pictured: ${esc(p.name)}</span>` : "";
};

// What each kind usually contains, in our own words, stated ONCE and never as
// a fact about a particular set. See the blurb trap above.
const USUALLY = {
  etb: "An Elite Trainer Box is the big one: a stack of packs, a card box to keep them in, sleeves, dice, damage counters and a status marker. The pack count has changed over the years, so check the box you are actually buying.",
  // ^ That sentence stays exactly as it is. It was written when nothing in the
  // repo held a sourced count and it is still true. What changed is that
  // /how-many-packs.html now holds the sourced version, so the note under the
  // lede sends people there rather than leaving them with a warning and no
  // number. See THE BLURB TRAP above: this page still states nothing per set.
  "single-pack": "One booster pack, bought loose off a shelf or a peg.",
  bundle: "A Booster Bundle is a sleeve of packs and nothing else. No sleeves, no dice, no promo. It is usually the cheapest way to buy several packs at once.",
  "ex-premium": "A collection box built around one ex card, with a promo, an oversize card and a few packs.",
  "ex-box": "A smaller box built around one ex card, with a promo and a couple of packs.",
  upc: "An Ultra Premium Collection is the largest sealed product of a set: a big box with a lot of packs, a metal or oversize card and usually a full art promo.",
  tin: "A metal tin with a promo card and a few packs. The tin outlives the cards and is the reason a lot of people buy them.",
  "poke-ball-tin": "A ball-shaped tin, usually with one or two packs and a coin or promo.",
  blister: "A hanging card with one to three packs and a promo, sold on a peg rather than a shelf.",
  "knock-out": "A Knock Out Collection is built around one big ex card: the promo, a playmat or a set of dice depending on the release, and a few packs. They turn up at Target and Walmart more than anywhere else.",
  "collection-box": "A themed box built around a character or a pair of them, with promo cards, sometimes an oversize card, and a few packs. The contents vary more than any other product here.",
  "japanese-pack": "A Japanese booster pack. Japanese sets are smaller and print differently from the English ones.",
  "korean-pack": "A Korean booster pack. Korea gets its own print run and its own set numbering, so a Korean card is not just an English card in another language.",
  "chinese-pack": "A Chinese booster pack. Simplified Chinese sets run on their own schedule and are the hardest of the languages here to find in the US.",
};

// The question somebody types, which becomes the H1.
const ASKS = {
  etb: "What is in an Elite Trainer Box?",
  "single-pack": "What is in a single booster pack?",
  bundle: "What is in a Booster Bundle?",
  "ex-premium": "What is in an ex Premium Collection?",
  "ex-box": "What is in an ex Box?",
  upc: "What is in an Ultra Premium Collection?",
  tin: "What is in a Pokemon tin?",
  "poke-ball-tin": "What is in a Poke Ball Tin?",
  blister: "What is in a blister pack?",
  "knock-out": "What is in a Knock Out Collection?",
  "collection-box": "What is in a collection box?",
  "japanese-pack": "What is in a Japanese booster pack?",
  "korean-pack": "What is in a Korean booster pack?",
  "chinese-pack": "What is in a Chinese booster pack?",
};

const LABEL = new Map(PRODUCT_TYPES.map((p) => [p.id, p.label]));

// THE CODE CARD LINE, and the reason it is not on every page here.
//
// Every pack counted on this site also produced a code card, which is the one
// thing in a booster these pages never mention. It is one sentence and a link,
// deliberately: a reader on an ETB page is mid-question and does not need a
// second pitch.
//
// IT IS ONLY ON THE ENGLISH PRODUCT PAGES. data/tcg-live.json records that
// nothing was found in either direction on whether a Japanese, Korean or Chinese
// pack carries a code the English client takes, so the three foreign pack pages
// get nothing rather than a hedge. The index says "English booster pack" out
// loud for the same reason, because its total covers all of them.
const FOREIGN_PACKS = new Set(["japanese-pack", "korean-pack", "chinese-pack"]);
const CODE_LINE =
  ' Every one of those packs had a code card in it as well: <a href="/tcg-live.html">what the code' +
  " card actually gets you</a>.";

// Splitting on ". " returns the WHOLE string when there is only one sentence,
// full stop included, so appending another gave ten cards a doubled period.
const firstSentence = (t) => {
  const i = t.indexOf(". ");
  return i === -1 ? t : `${t.slice(0, i)}.`;
};

// Which product ids take "an". Deliberately a list and not a first-letter
// test: "UPC" begins with a vowel and takes "a", because it is read out as
// letters. Thirteen labels is few enough to just be right about.
const AN = new Set(["etb", "ex-premium", "ex-box"]);
const article = (id) => (AN.has(id) ? "an" : "a");

// ---------------------------------------------------------------- gather
const byProduct = new Map();
for (const v of videos) {
  for (const p of v.products || []) {
    if (!byProduct.has(p)) byProduct.set(p, []);
    byProduct.get(p).push(v);
  }
}

// Prices for a kind, one row per set that sells it.
//
// THE SET COLUMN SAYS WHAT THIS SITE CALLS THE SET, NOT WHAT TCGPLAYER CALLS IT.
//
// `s.tcgSet` is TCGplayer's own catalogue string and it exists for exactly one
// reason: shared/tcgplayer.mjs maps our ids onto it so the sync can find the
// right products, because their fuzzy search is confidently wrong (the comment
// at the top of that file has the details). It is a lookup key. It was never
// meant to be printed, and printing it put "SV: Scarlet & Violet 151",
// "SV01: Scarlet & Violet Base Set", "ME05: Pitch Black" and "Pokemon GO" into
// a table sitting a few hundred pixels above a rip list on the SAME PAGE that
// says "151", "Scarlet & Violet", "Pitch Black" and "Pokémon GO". /pack-prices
// and /expansions.html both name the same sets the site's way off sets.json.
//
// SET_NAME is the same taxonomy label the rip list below already uses, so the
// two halves of this page cannot drift. Note that it carries "Pokémon GO" with
// the accent: that is the official proper name and is deliberate, and the
// accent is dropped only in the site's own prose. Do not flatten it.
//
// `s.tcgSet` remains the fallback because a set present in products.json but
// absent from the taxonomy still has to render as something, and TCGplayer's
// string is at least a name rather than a slug.
const pricesFor = (id) => {
  const kind = KIND[id];
  if (!kind) return [];
  const rows = [];
  for (const [sid, s] of Object.entries(prod.sets || {})) {
    const hit = (s.products || []).find((x) => x.kind === kind);
    if (hit && typeof hit.market === "number") {
      rows.push({
        sid,
        name: SET_NAME.get(sid) || s.tcgSet || sid,
        market: hit.market, low: hit.low, listings: hit.listings, url: hit.url,
        // The photo of the exact product this row prices. DEAD is checked here
        // rather than behind an onerror: 4 TCGplayer urls answer 403 and the
        // page paid for the round trip to find that out.
        thumb: hit.thumb && !DEAD.has(hit.thumb) ? hit.thumb : "",
        large: hit.image || "",
        product: hit.name || "",
      });
    }
  }
  return rows.sort((a, b) => b.market - a.market);
};

// Which sets a kind was opened from, and how much of each.
//
// A RIP TAGGED WITH TWO SETS COUNTS UNDER BOTH, and the band says so out loud
// rather than letting a reader add the column up and get more openings than the
// stat tile above it claims. Eleven rips carry two set tags (a blister holding
// packs from two sets is the usual reason), so the two numbers genuinely differ
// and neither is wrong.
//
// Packs are summed the same way, and are 0 for whole kinds: nothing in
// videos.json records a pack count for an ex Premium Collection, so those rows
// print openings only rather than a zero that reads as "no packs in it".
const setRowsFor = (vids) => {
  const by = new Map();
  for (const v of vids) {
    for (const sid of v.sets || []) {
      const row = by.get(sid) || { sid, openings: 0, packs: 0 };
      row.openings += 1;
      row.packs += v.packs || 0;
      by.set(sid, row);
    }
  }
  const rows = [...by.values()].sort((a, b) => b.openings - a.openings || b.packs - a.packs);
  const top = Math.max(1, ...rows.map((r) => r.openings));
  return rows.map((r) => {
    const intl = INTL[r.sid];
    return {
      ...r,
      // The taxonomy label, which is what the rip list on this same page uses,
      // so the two halves cannot drift. It carries the "(JP)" and "(KR)" tails.
      name: SET_NAME.get(r.sid) || r.sid,
      // The set whose LOGO is drawn. For an English set that is itself; for a
      // Japanese or Korean one it is the English set it corresponds to, because
      // no non-English set has logo art anywhere this repo can reach.
      logoSet: intl ? intl.equivalent : r.sid,
      enName: intl && intl.equivalent ? SET_NAME.get(intl.equivalent) || intl.equivalent : "",
      exclusive: Boolean(intl && !intl.equivalent),
      pct: Math.round((r.openings / top) * 100),
    };
  });
};

const entries = [...byProduct.entries()]
  .map(([id, vids]) => {
    const packs = vids.reduce((n, v) => n + (v.packs || 0), 0);
    const withPacks = vids.filter((v) => v.packs).length;
    const sets = new Set(vids.flatMap((v) => v.sets || []));
    return {
      id, vids, packs, withPacks, sets, setRows: setRowsFor(vids),
      prices: pricesFor(id), label: LABEL.get(id) || id,
    };
  })
  .filter((e) => e.vids.length)
  .sort((a, b) => b.vids.length - a.vids.length);

// ---------------------------------------------------------------- render
// EVERY LINK ON A PAGE HAS TO SAY WHERE IT GOES ON ITS OWN. ripLabel numbers a
// rip only when the title or description happens to carry a "#n", so on a page
// listing 62 Elite Trainer Boxes a lot of them come out as the same string.
// Sixty identical "Chaos Rising ETB" links is bad for a reader scanning and
// worse for anybody tabbing through with a screen reader, which announces link
// text with no surrounding context.
//
// So: take the derived label, and where two rips share one, add the date. Where
// that STILL collides, which happens when two of the same product from the same
// set went up on one day, fall back to the video's own full title, which is
// unique by construction. Same escalation build-playlists.mjs uses.
// `v.description` DOES NOT EXIST AND HAS NEVER EXISTED ON A VIDEO RECORD.
//
// This line used to read `ripLabel(v, SET_NAME, v.description)`. None of the 313
// records in public/data/videos.json carries a `description` key: the
// descriptions live in data/descriptions.json, which this builder does not open.
// So the third argument was `undefined` on every call, and `undefined` is
// exactly what ripLabel treats as "no description available". Same shape as the
// no-scan `.tcgdex` read: a key that is not there, a fallback that looks like a
// legitimate empty, and a silence.
//
// It cost real text. The pack number in a label comes from the title OR the
// description, and 41 of the 286 stamped labels get their #N from the
// description alone. Those 41 rips read "Pitch Black ETB #7" on the home page,
// /videos.html and their playlist page, all of which use the stamped `v.label`,
// and "Pitch Black ETB" here. One rip, two names, on one site.
//
// It also made the page worse in a second way. labelsFor escalates to a date
// and then to the full YouTube title whenever two rips share a label, so losing
// the numbers created collisions that were not there: 95 colliding rows became
// 124.
//
// stamp-labels.mjs is the ONE writer of `v.label` and it runs before every page
// builder in build-all.mjs, which is why it exists. Read the stamp, the way
// build-playlists.mjs and build-proto.mjs already do, rather than re-deriving it
// here from an argument this file cannot supply.
function labelsFor(vids) {
  const base = new Map(vids.map((v) => [v.id, v.label || v.siteTitle || v.title]));
  // A rip with a set and a product tag always gets a stamped label. If none of
  // them has one, stamp-labels.mjs did not run, and every tile on these pages is
  // about to fall back to its YouTube title: "This ETB is BREAKING me! 🌑💀" on a
  // grid of twenty, which is the thing ripLabel exists to prevent.
  if (vids.length && !vids.some((v) => v.label)) {
    throw new Error(
      `build-openings: not one of ${vids.length} rips carries a stamped \`label\`, so every ` +
        `tile would fall back to its raw YouTube title. Run node scripts/stamp-labels.mjs ` +
        `first; build-all.mjs runs it before every page builder for this reason.`
    );
  }
  const seen = new Map();
  for (const l of base.values()) seen.set(l, (seen.get(l) || 0) + 1);

  const dated = new Map(
    vids.map((v) => {
      const l = base.get(v.id);
      return [v.id, seen.get(l) > 1 && v.published ? `${l}, ${shortDate(v.published)}` : l];
    })
  );
  const after = new Map();
  for (const l of dated.values()) after.set(l, (after.get(l) || 0) + 1);

  return new Map(
    vids.map((v) => [v.id, after.get(dated.get(v.id)) > 1 ? v.siteTitle || v.title : dated.get(v.id)])
  );
}

const ripRow = (labels) => (v) => {
  const label = labels.get(v.id);
  const dateInLabel = Boolean(v.published && label.includes(shortDate(v.published)));
  const bits = [
    dateInLabel ? "" : v.published ? esc(shortDate(v.published)) : "",
    v.packs ? `${v.packs} pack${v.packs === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return `        <li><a href="/${esc(v.path)}">${esc(label)}</a>${
    bits.length ? `\n          <span>${bits.join(" &bull; ")}</span>` : ""
  }</li>`;
};

// Which sets have a guide to link to. Every set tagged on a video has one
// today, including all thirteen Japanese, Korean and Chinese ones, but a link
// emitted for a page that is not there is a 404 the check catches late, so it
// is read rather than assumed. A row with no guide still renders, unlinked.
const setPages = new Set(
  (await readdir(join(ROOT, "public/sets")).catch(() => []))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => f.slice(0, -5))
);

/**
 * The band that answers "which sets, and how many of each".
 *
 * ONE LINK PER ROW, wrapping the logo, the name, the bar and the counts, the
 * way .op-c does on the index. Two links to one destination in one row is two
 * tab stops and two announcements of the same thing.
 *
 * THE LOGO IS DECORATIVE HERE and carries alt="". It sits inside a link whose
 * visible text already names the set, so an alt would be the third time a
 * screen reader says "Chaos Rising" in one row. On a Japanese or Korean row it
 * is the ENGLISH set's logo, and that is stated in visible text under the name
 * rather than buried in an alt, because it is a fact about the picture that a
 * sighted reader needs just as much.
 *
 * The bar is aria-hidden: it is the counts beside it, drawn.
 */
async function setBand(e) {
  if (!e.setRows.length) return "";
  const rows = [];
  for (const r of e.setRows) {
    const logo = r.logoSet ? await setLogoTag(r.logoSet) : "";
    const inner =
      `<span class="op-sw">${
        logo || `<span class="op-sx" aria-hidden="true"></span>`
      }</span>
          <span class="op-sm">
            <b>${esc(r.name)}</b>${
              r.enName
                ? `<span class="op-se">Logo shown is the English ${esc(r.enName)}</span>`
                : r.exclusive
                  ? `<span class="op-se">No English release, and no logo art anywhere we can reach</span>`
                  : ""
            }
            <span class="op-sb" aria-hidden="true"><i style="width:${r.pct}%"></i></span>
          </span>
          <span class="op-sn"><b>${r.openings}</b> opening${r.openings === 1 ? "" : "s"}${
            r.packs ? `<span>${r.packs} pack${r.packs === 1 ? "" : "s"}</span>` : ""
          }</span>`;
    rows.push(
      `        <li class="op-sr">${
        setPages.has(r.sid)
          ? `<a href="/sets/${esc(r.sid)}.html">
          ${inner}
        </a>`
          : `<div>
          ${inner}
        </div>`
      }</li>`
    );
  }
  return `      <ul class="op-sets">
${rows.join("\n")}
      </ul>
      <p class="op-note">Openings and packs counted here, in our own videos, which is the only place
        these numbers come from. A rip tagged with two sets is counted under both, so the column adds
        up to more than the ${e.vids.length} above it. Each row opens that set's guide.</p>`;
}

// THE LEDE'S CAPTION MAKES A CLAIM THE PAGE COULD NOT SHOW: "every set sells
// its own, and the art on the box changes with the set", printed under ONE
// photograph. The price table below it already lists every set that sells the
// thing, one row each, so the photo of that row's exact product goes in the row
// and the sentence becomes checkable instead of asserted.
//
// 48px, so 96 device px at DPR2 and 144 at DPR3, and TCGplayer's 150w rendition
// covers both. THE REST OF THE SITE ASKS FOR 200w AND HERE THAT IS 37% OF THE
// BYTES WASTED: the shots on the set guides, on /how-many-packs.html and in the
// lede above sit in an 88px box, which wants 176 device px at DPR2 and genuinely
// needs the 200. A 48px box does not, and the ETB table draws 28 of them.
//
// _150w IS DERIVED FROM _200w BY STRING SWAP AND THAT WAS CHECKED, not assumed.
// The CDN serves a fixed set of widths and answers 403 for the rest: 50w, 100w
// and 120w are all 403, so a srcset candidate that does not exist is a broken
// image and not a fallback, because the browser has already committed to it. On
// 2026-08-16 all 121 product thumbs these six tables emit were fetched at both
// widths: 121 of 121 answered 200 at 150w, 2,462.8KB of 200w against 1,550.9KB
// of 150w. `onerror` still removes the picture if a later product breaks that.
// The 1000w stays in the srcset for anything denser.
//
// No width/height, because tcgplayer-cdn files run 200x268 to 200x417 and
// imgDims() returns nothing for them on purpose; the 48px box is fixed in CSS
// so nothing reflows anyway.
//
// ALT NAMES THE PRODUCT, NOT THE SET. The row header already says "151"; the
// picture is of the "151 Elite Trainer Box", which is the thing the alt can add.
const small = (u) => u.replace(/_200w\.jpg$/, "_150w.jpg");
const priceShot = (r) =>
  r.thumb
    ? `<img class="op-pt" src="${esc(small(r.thumb))}"${
        r.large ? ` srcset="${esc(small(r.thumb))} 150w, ${esc(r.large)} 1000w"` : ""
      } sizes="48px" alt="${esc(r.product || r.name)}, sealed" loading="lazy" decoding="async"
             referrerpolicy="no-referrer" onerror="this.remove()">`
    : `<span class="op-pt op-px" aria-hidden="true"></span>`;

const priceTable = (e) => {
  if (!e.prices.length) return "";
  const cap = `What ${article(e.id)} ${e.label} costs, by set. TCGplayer market price, read ${longDate(prod.checked)}`;
  // Same reasoning as build-expansions.mjs: a 520px table in a 360px box with
  // no focusable content is unreachable without a mouse.
  return `      <div class="op-tw" tabindex="0" role="region" aria-label="${esc(cap)}, scrollable table">
        <table class="op-t">
          <caption>${esc(cap)}</caption>
          <thead><tr><th scope="col">Set</th><th scope="col">Market</th><th scope="col">Lowest</th><th scope="col">Listings</th></tr></thead>
          <tbody>
${e.prices.map((r) => `            <tr><th scope="row"><span class="op-ps">${priceShot(r)}${
    r.url ? `<a href="${esc(r.url)}" rel="noopener" target="_blank">${esc(r.name)}</a>` : esc(r.name)
  }</span></th><td>${esc(moneyExact(r.market))}</td><td>${
    typeof r.low === "number" ? esc(moneyExact(r.low)) : "<span class=\"op-no\">not listed</span>"
  }</td><td>${typeof r.listings === "number" ? r.listings : `<span class="op-no">not listed</span>`}</td></tr>`).join("\n")}
          </tbody>
        </table>
      </div>`;
};

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css and miniCSS makes in build-set-pages.mjs, and
// the same regex: comments, plus the indentation between rules. Nothing else.
//
// It is here because this block is inline in a render blocking <head> and the
// desktop rules added on 16 August 2026 came with the measurements that justify
// them written alongside. Measured on this page set, those comments were 17.1KB
// raw and 7.1KB gzipped across eight pages, up to 13% of one of them. Stripped,
// every one of these pages is smaller than it was before the rules were added.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const STYLE = `
.op-lede{max-width:46em}
/* The product shot is a HORIZONTAL strip under the lede, not a column beside it.
   Both alternatives were built and looked wrong. Beside the lede, the caption is
   stuck in an 88px column and sets as eleven lines of mono running far below a
   three line paragraph. Above the lede, an 88px box pushes the sentence that
   answers the h1 down the screen on a phone. As a strip it keeps the question
   and its answer adjacent and gives the caption a readable measure, and the
   caption has real work to do here: it names the set the box actually is, which
   is the condition of using one set's product to illustrate a type at all. */
.op-shot{display:flex;gap:var(--s4);align-items:center;margin:0 0 var(--s5);
  max-width:46em;border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s3) var(--s4)}
/* Product photography arrives on a white background, so the tile is white
   rather than the page cream. Same reasoning and the same 88px box as
   .prod-shot on the set guides and .hp-shot on /how-many-packs.html, because
   sizes="88px" is measured against exactly this box. */
.op-shot img{flex:none;width:88px;height:88px;object-fit:contain;display:block;background:#fff;
  border:1px solid var(--hair);border-radius:6px}
.op-shot figcaption{font-size:var(--t-sm);line-height:1.5;color:var(--ink-2);min-width:0}
.op-shot figcaption b{font-weight:700;color:var(--ink)}
.op-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:var(--s5) 0}
@media(max-width:700px){.op-facts{grid-template-columns:1fr}}
.op-f{border:3px solid var(--navy);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4);text-align:center}
.op-f .n{font:400 var(--t-xl)/1 var(--display);color:var(--ketchup)}
.op-f .l{font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-top:var(--s2);display:block}
/* Same "there is more to the right" affordance ui.css gives .cc-scroll and
   friends. .op-t is min-width:520px inside a 360px box, so measured at 390x844
   on /openings/etb.html the wrapper is clientWidth 360, scrollWidth 520: 160px
   of the table off screen with nothing saying so, and 230px at 320x568.
   Covers ride the content (attachment:local), shadows stay on the box, so it
   turns itself off the moment the table fits.
   background-COLOR, not the shorthand, which would reset background-image and
   wipe all four layers. */
.op-tw{overflow-x:auto;border:3px solid var(--navy);border-radius:12px;box-shadow:var(--hard-lg);
  background-color:var(--card);margin:var(--s4) 0;
  background-image:
    linear-gradient(to right,var(--card) 40%,rgba(255,255,255,0)),
    linear-gradient(to left,var(--card) 40%,rgba(255,255,255,0)),
    radial-gradient(farthest-side at 0 50%,rgba(17,17,17,.30),rgba(17,17,17,0)),
    radial-gradient(farthest-side at 100% 50%,rgba(17,17,17,.30),rgba(17,17,17,0));
  background-position:left center,right center,left center,right center;
  background-repeat:no-repeat;
  background-size:44px 100%,44px 100%,15px 100%,15px 100%;
  background-attachment:local,local,scroll,scroll}
.op-t{border-collapse:collapse;width:100%;min-width:520px;font-size:var(--t-sm)}
.op-t caption{caption-side:top;text-align:left;padding:var(--s3) var(--s4);font:700 var(--t-label)/1.3 var(--body);
  letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2);border-bottom:2px solid var(--hair)}
.op-t th,.op-t td{padding:10px var(--s3);text-align:left;border-bottom:1px solid var(--hair)}
.op-t thead th{font:700 var(--t-label)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--navy);color:var(--chrome-ink);border-bottom:none}
.op-t tbody th{font-weight:700}
/* The product photo in the row header. Same 1px hairline and white plate as
   .op-shot: product photography arrives on white, so a cream tile reads as a
   halo round the box. flex:none or the picture squashes as the set name wraps. */
.op-ps{display:flex;gap:var(--s3);align-items:center}
.op-pt{flex:none;width:48px;height:48px;object-fit:contain;display:block;background:#fff;
  border:1px solid var(--hair);border-radius:5px}
/* No usable photo for this row: TCGplayer answers 403 for four of them. Same
   45 degree hatch as .op-cn, so the gap reads as deliberate rather than as an
   image that failed, which matters most when 27 of its neighbours are real. */
.op-px{background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.op-no{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2);opacity:.7}
/* WHICH SETS THESE CAME FROM. A row is one link: logo plate, name and bar, then
   the counts. auto on the last column so "18 openings / 72 packs" sets on one
   line and the bar takes what is left. */
.op-sh{font:400 var(--t-m)/1.2 var(--display);margin:var(--s5) 0 var(--s3)}
.op-sets{list-style:none;margin:var(--s4) 0 var(--s4);padding:0;display:grid;gap:var(--s2);max-width:46em}
.op-sr>a,.op-sr>div{display:grid;grid-template-columns:${LOGO_BOX_W}px minmax(0,1fr) auto;
  gap:var(--s3);align-items:center;border:2px solid var(--hair);border-radius:10px;
  background:var(--card);padding:var(--s2) var(--s3);color:inherit;text-decoration:none}
.op-sr>a:hover,.op-sr>a:focus-visible{border-color:var(--navy)}
/* The logo plate is white for the same reason .op-shot is: these are
   transparent WebPs drawn for a light background. */
.op-sw{display:flex;align-items:center;justify-content:center;width:${LOGO_BOX_W}px;height:${LOGO_BOX_H}px;
  background:#fff;border:1px solid var(--hair);border-radius:5px;flex:none}
.op-sl{width:100%;height:100%;object-fit:contain;display:block}
.op-sx{display:block;width:100%;height:100%;border-radius:4px;
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.op-sm{min-width:0}
.op-sm b{display:block;font-weight:700;font-size:var(--t-sm);line-height:1.3}
.op-se{display:block;font:400 var(--t-micro)/1.35 var(--mono);color:var(--ink-2);margin-top:2px}
.op-sb{display:block;height:8px;margin-top:6px;border-radius:4px;background:var(--paper-3);overflow:hidden}
.op-sb i{display:block;height:100%;background:var(--gold);border-radius:4px}
.op-sn{text-align:right;font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);white-space:nowrap}
/* Inline, not block. As a block the count set as three stacked lines, "20",
   "openings", "180 packs", which reads as three facts rather than one. */
.op-sn b{font:400 var(--t-m)/1 var(--display);color:var(--ketchup);margin-right:.3em}
.op-sn span{display:block}
/* 390px: the three columns are 116 + bar + counts and the middle one collapses
   to nothing once a set name like "Prismatic Evolutions" is in it. Drop to two,
   with the logo spanning both rows and the counts under the name. */
@media(max-width:560px){
  .op-sr>a,.op-sr>div{grid-template-columns:88px minmax(0,1fr);gap:var(--s2) var(--s3)}
  .op-sw{width:88px;height:34px;grid-row:span 2;align-self:start}
  .op-sn{text-align:left}
  .op-sn b{font-size:var(--t-sm)}
  .op-sn span{display:inline;margin-left:.4em}
  .op-sn span::before{content:"\\2022 ";margin-right:.2em}
}
.op-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:900px){.op-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.op-grid{grid-template-columns:1fr}}
.op-c{border:3px solid var(--navy);border-radius:12px;background:var(--card);box-shadow:var(--hard-lg);
  padding:var(--s4);display:block;color:inherit;text-decoration:none}
.op-c h2,.op-c h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:var(--s2)}
.op-c p{font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.op-c .op-n{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);display:block;margin-top:var(--s3)}
/* The card header is a row so the picture and the question sit together. The
   thumb is the same 88px box as .op-shot, .hp-shot and .prod-shot, which is what
   sizes="88px" is measured against; do not change one without the others. */
.op-ch{display:flex;gap:var(--s3);align-items:center;margin-bottom:var(--s3)}
.op-ch h2,.op-ch h3{margin-bottom:0}
.op-ci{flex:none;width:88px;height:88px;object-fit:contain;display:block;background:#fff;
  border:1px solid var(--hair);border-radius:6px}
/* No photograph of this exists that we can publish. Same hatch as .set-noart. */
.op-cn{background:repeating-linear-gradient(45deg,var(--paper-3) 0 6px,var(--paper-2) 6px 12px)}
.op-ex{display:block;margin-top:var(--s3);font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2)}
.op-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.55;max-width:44em}

/* DESKTOP. min-width only, so a phone and a tablet render what they rendered
   before: measured identical at 390 before and after.

   MEASURED AT 1440 AND 1920. The card grid stopped growing at three columns at
   900px and stayed there, so at 1920 the thirteen product cards were 484px wide
   holding a two line description each. Four columns at 1500 keeps the 88px
   thumbnail and the heading on the same row, which is what .op-ch needs and the
   reason this does not go wider still.

   The lede measured 90 characters a line against a 65 to 75 target. 46em is a
   cap on the font SIZE, not on the character count, and this page sets its lede
   in the larger --t-lede, so the same 46em buys it more characters than it buys
   the body text elsewhere. ch is the width of a "0" in the element's own font,
   which is the unit that tracks the count.

   50ch AND NOT 70ch. This page is where the trap was caught: .op-note was
   capped at 70ch on a first pass and came out 643px wide setting 101.7
   characters, WORSE than the 44em it replaced. ch is one DIGIT wide and a digit
   is one of the widest glyphs in Outfit, so a character averages about 0.7 of a
   ch. 50ch sets around 70. The full measurement is in build-buying.mjs. */
@media(min-width:1000px){
  .op-lede{max-width:50ch}
  .op-note{max-width:50ch}
  /* The 46em cap is a MEASURE cap and it is right for prose. On a row of logos
     and numbers it is a hole: at 1280 the set band stopped at 790px directly
     above a price table filling all 1,232 of the wrap, which is the same "the
     top of the page reads as a different site from the bottom" the home page's
     desktop pass was about. Two columns instead, so the band ends where the
     table does. */
  .op-sets{max-width:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s3)}
}
@media(min-width:1500px){
  .op-grid{grid-template-columns:repeat(4,1fr)}
}
`;

const head = (title, desc, path, extraLd = null) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title.split(" | ")[0])}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${miniCSS(STYLE)}</style>
${extraLd ? `<script type="application/ld+json">${JSON.stringify(extraLd)}</script>` : ""}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">`;

// The pictures on these pages are not ours and the footer says whose they are.
// Set logos are The Pokemon Company's, product photography is TCGplayer's, and
// both are here to identify a thing this site is writing about rather than to
// sell it. Nothing on this site is for sale.
const tail = `</main>
${footer(
  "Set logos are The Pokemon Company's. Product photos are TCGplayer's. Both are used to identify " +
    "the sets and the products written about here."
)}
${APP_JS}
</body>
</html>
`;

await mkdir(OUT, { recursive: true });

// ---------------------------------------------------------------- per product
for (const e of entries) {
  const path = `/openings/${e.id}.html`;
  const ask = ASKS[e.id] || `What is in a ${e.label}?`;
  const nSets = e.sets.size;
  // THE DESCRIPTION USED TO PROMISE A PRICE THE PAGE THEN REFUSES TO GIVE.
  // `e.prices.length || nSets` fell back to the set count for every product we
  // do not track prices for, so seven pages advertised "what it costs across N
  // sets" in the search result while their body says "no price table here,
  // this product is not one of the kinds we track prices for". The snippet IS
  // the promise, so it now describes what the page actually has.
  const desc = (
    e.prices.length
      ? `${ask} What it holds, what it costs across ${e.prices.length} set${
          e.prices.length === 1 ? "" : "s"
        }, and ${e.vids.length} of them opened on camera.`
      : `${ask} What it holds, and ${e.vids.length} of them opened on camera${
          nSets ? `, across ${nSets} set${nSets === 1 ? "" : "s"}` : ""
        }.`
  ).slice(0, 158);

  const page =
    head(`${ask} Price and ${e.vids.length} Openings | Garbage Rips 585`, desc, path, {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Openings", item: `${SITE}/openings/` },
        { "@type": "ListItem", position: 3, name: e.label },
      ],
    }) +
    `
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/openings/">Openings</a> / <span>${esc(e.label)}</span></nav>
      <h1>${esc(ask.replace(/\?$/, ""))}<span class="hl">?</span></h1>
      <p class="lede op-lede">${esc(USUALLY[e.id] || `A sealed ${e.label}.`)}</p>
${shot(e)}
      <p class="op-note">That is what this kind of box usually holds. It is deliberately not stated per set,
        because the contents have changed between releases and we do not have a per set count we can stand
        behind. What we do have is what came out of the ones opened here, counted below, and
        <a href="/how-many-packs.html">how many packs each kind of product holds</a>, which is read off the
        manufacturer's and the sellers' own pages with the source on every number.</p>

      <div class="op-facts">
        <div class="op-f"><span class="n">${e.vids.length}</span><span class="l">Opened on camera</span></div>
        <div class="op-f"><span class="n">${e.packs || "&mdash;"}</span><span class="l">${
          e.packs ? `Packs counted, across ${e.withPacks} of them` : "Pack count not in our data"
        }</span></div>
        <div class="op-f"><span class="n">${nSets || "&mdash;"}</span><span class="l">${
          nSets ? "Different sets" : "Set not tagged"
        }</span></div>
      </div>

      <!-- h2, not h3, and the class is what makes that free. This was an h3
           sitting between the page's h1 and the h2 below it, so all 13 openings
           pages jumped h1 -> h3 -> h2: the only skipped heading level on the
           site outside the playlist pages. .op-sh sets font, size, line-height
           and margin itself and ui.css has no bare h2 or h3 rule, so the tag
           swap is semantic only and the page renders to the pixel as before.
           Verified by screenshot rather than assumed. -->
      <h2 class="op-sh">Which sets we opened these from</h2>
${await setBand(e)}
${priceTable(e)}
${e.prices.length
        ? `      <p class="op-note">Prices are TCGplayer market and lowest listing, read ${esc(longDate(prod.checked))},
        the same figures the rest of this site quotes. They move. <a href="/pack-prices.html">Pack prices</a>
        works out what that comes to per pack, and <a href="/msrp.html">what it should cost</a> has the
        retail figure to measure any of it against. Each photograph is TCGplayer's, and it is that row's own
        product rather than a stand-in, which is why the art is different in every one of them.</p>`
        : `      <p class="op-note">No price table here: this product is not one of the kinds we track prices for,
        so there is nothing sourced to show. <a href="/pack-prices.html">Pack prices</a> covers the ones we do,
        and <a href="/msrp.html">what it should cost</a> has the retail figure for the kinds it could source.</p>`}
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On the channel</p>
      <h2>Every ${esc(e.label)} <span class="hl">opened</span> here</h2>
      <p class="lede" style="max-width:38em">${e.vids.length} of them${
        e.packs ? `, ${e.packs} pack${e.packs === 1 ? "" : "s"} counted` : ""
      }. Each one plays on its own page.${e.packs && !FOREIGN_PACKS.has(e.id) ? CODE_LINE : ""}</p>
      <ul class="riplist">
${e.vids
  .slice()
  .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
  .map(ripRow(labelsFor(e.vids)))
  .join("\n")}
      </ul>
      <p class="op-note" style="margin-top:var(--s4)">Other kinds of sealed product are on the
        <a href="/openings/">openings index</a>, and the whole catalogue is on
        <a href="/videos.html">every rip</a>.</p>
    </div>
  </section>
` +
    tail;

  await writeFile(join(OUT, `${e.id}.html`), page);
}

// ---------------------------------------------------------------- index
const totalRips = new Set(entries.flatMap((e) => e.vids.map((v) => v.id))).size;
const totalPacks = videos.reduce((n, v) => n + (v.packs || 0), 0);

const idx =
  head(
    "Every Kind of Pokemon Sealed Product, Opened | Garbage Rips 585",
    `Elite Trainer Boxes, Booster Bundles, blisters, tins and more: what each one holds, what it costs, and ${totalRips} of them opened on camera.`,
    "/openings/",
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Openings" },
      ],
    }
  ) +
  `
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Openings</span></nav>
      <h1>Every kind of <span class="hl">sealed</span> product</h1>
      <p class="lede op-lede">What is actually inside each kind of box, what it costs across the sets that
        sell it, and every one of them opened on this channel. ${entries.length} kinds, ${totalRips} openings,
        ${totalPacks} packs counted.</p>
      <div class="op-grid">
${entries
  .map(
    (e) => `        <a class="op-c" href="/openings/${esc(e.id)}.html">
          <div class="op-ch">
            ${cardShot(e)}
            <h2>${esc(e.label)}</h2>
          </div>
          <p>${esc(firstSentence(USUALLY[e.id] || ""))}</p>
          <span class="op-n">${e.vids.length} opened${
            e.packs ? ` &bull; ${e.packs} pack${e.packs === 1 ? "" : "s"} counted in ${e.withPacks} of them` : ""
          }</span>
          ${cardShotName(e)}
        </a>`
  )
  .join("\n")}
      </div>
      <p class="op-note" style="margin-top:var(--s5)">Pack counts are what we counted in our own videos, not a
        figure off a box. Where a product's contents are not in our data, the page says so rather than guess.
        The counts printed on the products themselves, biggest box to smallest blister with a source on each,
        are on <a href="/how-many-packs.html">how many packs are in it</a>.
        What each kind is SUPPOSED to cost, which is a different question from what it sells for, is on
        <a href="/msrp.html">what sealed product should cost</a>.
        Prices come from TCGplayer, read ${esc(longDate(prod.checked))}, and so do the product photos: each
        one is a specific product standing in for its kind, named on the card and named again on the page.
        Two kinds have no photograph here, because no picture of a Korean or a Chinese booster pack is
        available to this site at all.
        Every English booster pack in that count also held a code card, and
        <a href="/tcg-live.html">what the code card gets you</a> counts them.</p>
    </div>
  </section>
` +
  tail;

await writeFile(join(OUT, "index.html"), idx);

console.log(`Wrote public/openings/ with ${entries.length + 1} pages
  ${entries.length} product types, ${totalRips} openings, ${totalPacks} packs counted
  ${entries.filter((e) => e.prices.length).length} have a price table`);
