#!/usr/bin/env node
// Build /how-many-packs.html: how many packs are inside each sealed product,
// biggest to smallest, and how those counts have changed.
//
//   node scripts/build-how-many-packs.mjs
//
// Reads data/pack-counts-current.json (22 current products, every numeric field
// carrying the source it was read from and the date), data/pack-counts-history.json
// (23 sources, how the counts moved by era) and public/data/products.json for
// the only real product photography this site has.
//
// WHY THIS PAGE EXISTS. /pack-prices.html answers "what does a pack cost" by
// dividing a price by a pack count. It could only ever do that for the five
// product kinds whose count is in our data, so the question underneath it,
// "how many packs am I actually getting", had no page at all: nothing on the
// site said what is in a UPC, an SPC, an ex Premium Collection, an ex Box, a
// Knock Out Collection, a Poke Ball Tin, a standard tin, a collection box or a
// blister. Somebody standing in a Target aisle deciding between a $60 box and
// three $15 tins cannot do that arithmetic from anything we published.
//
// THE ORDER IS THE OWNER'S AND IT IS THE RIGHT ONE: biggest first, down to the
// single blister. That is the order somebody scans when they are working out
// what a pack costs them, because it is the order of the money.
//
// ============================================================================
// FIVE TRAPS, ALL FROM THE RESEARCH, ALL HANDLED HERE ON PURPOSE.
//
// 1. CARDS PER PACK WENT 11, THEN 9, THEN 10. Not 11 to 10. There is a 9-card
//    era from Expedition Base Set (September 2002) through the end of the EX
//    Series, and it is exactly the era a vintage buyer is most likely holding.
//    An EX-era pack is a smaller pack, not a short-packed one.
//
// 2. ROWS ARE KEYED ON THE PRODUCT NAME, NEVER ON THE TAXONOMY ID. The site's
//    ex-premium tag folds together the ex Premium Collection (8 packs) and the
//    ex Box (4 packs); the tin tag spans Mini Tin (2), Stacking Tin (3) and the
//    standard tin (4 now, 5 in 2025). One row per id would publish a number
//    that is wrong for half the products it claims to describe. The guard below
//    fails the build if an id carrying two different counts renders once.
//
// 3. THE tin TAG SPANS FOUR SIZES. See above. There is no "tins have N packs"
//    row on this page and there must never be one.
//
// 4. A 30th CELEBRATION PACK IS NOT A TEN-CARD PACK. It holds 5 foil cards plus
//    1 foil Basic Energy. The pack COUNTS for its products are normal, so the
//    per-pack arithmetic on this page is fine, but any per-CARD figure would be
//    wrong for it. This page therefore does no per-card arithmetic at all, and
//    says why.
//
// 5. THERE IS NO MSRP. The Pokemon Company publishes none. Every price in the
//    research is a store or a retailer price with isMsrp false, so there is no
//    MSRP column here and there cannot be one. Prices that do appear carry the
//    seller's name and the date they were read.
// ============================================================================
//
// THE ETB CONTRADICTION THIS PAGE SETTLES. /pack-prices.html printed "9 packs"
// as a flat property of the kind and said the count was "printed on the
// product". /openings/etb.html said the count has changed and to check the box.
// Both were live and they disagreed. The blurb trap comment in
// build-openings.mjs is right about the mechanism: that "9 packs" is a constant
// written into sync-products.mjs per KIND, not a number read off any particular
// box. What it could not do was give the reader the real answer, because
// nothing in the repo held one.
//
// It does now, so the position this page takes is the narrow one that is
// actually sourced: NINE is right for a main-expansion Elite Trainer Box from
// the Scarlet & Violet era onward, confirmed on four separate pokemon.com
// product pages and three official expansion pages, and it is NOT a fact about
// Elite Trainer Boxes in general. Before that they held 7, then 8, then 10 on
// most special expansions, and the Pokemon Center version has always held more.
// Both other pages now point here and neither states a number this one does not.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page below is one template literal
// and a backtick inside a comment closes it. That has broken this build three
// times.
//
// NO PULL RATES. Pack counts are printed on the packaging and are verifiable,
// which is the only reason this page is allowed to exist. Odds are not
// published by anybody and are never stated here or derived from these counts.

import { readFile, writeFile } from "node:fs/promises";
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
import { esc, longDate, imgDims, moneyExact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const cur = JSON.parse(await readFile(join(ROOT, "data/pack-counts-current.json"), "utf8"));
const hist = JSON.parse(await readFile(join(ROOT, "data/pack-counts-history.json"), "utf8"));

let productsBySet = {};
let productsChecked = "";
try {
  const doc = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
  productsBySet = doc.sets || {};
  productsChecked = doc.checked || "";
} catch {
  /* run: node scripts/sync-products.mjs. The page renders without photography. */
}

// The 4 TCGplayer urls that answer 403. Builders skip them up front rather than
// emitting an img that vanishes on error and pays for a dead round trip.
const DEAD = new Set(
  JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || []
);

// ---------------------------------------------------------------- photography
//
// THE ONLY REAL PRODUCT PHOTOGRAPHY THIS SITE HAS IS TCGPLAYER'S, and it is per
// SET, never per product type. assets-source/packshots/ is deliberately empty
// and there is no in-house shoot. So every shot here is a specific set's
// product being used to illustrate a type, and the caption has to name the set
// it actually is or the picture is quietly claiming to be something else.
//
// Each entry is chosen so the pictured product's OWN pack count is the number
// the row states. The Pitch Black run is the same era the research read, and
// the Prismatic Evolutions Mini Tin is the exact product pokemon.com describes
// as holding two packs. The Shrouded Fable and Prismatic Evolutions blisters
// are different sets from the ones in the research, but their pack count is in
// the product name, which is why they are captioned with the full name.
//
// ON A ROW WHOSE COUNT VARIES, the test is the same one read against the NAMED
// product rather than against the headline. The Ultra-Premium Collection row
// has no single number, it has five sourced products from 16 packs to 30, so
// the photo has to be one of those five and it is: pokemon.com states 16 for
// the 151 Ultra-Premium Collection and that is the product in the picture.
// Same for the Super-Premium Collection, where pokemon.com states 15 for the
// Prismatic Evolutions one. A shot of some sixth Ultra-Premium Collection
// nobody sourced would be a picture of an unknown number.
//
// ELEVEN ROWS HAD NO PHOTO AND TEN OF THEM DO NOW. The paragraph this replaces
// said the eleven were "the honest answer, not a gap somebody should close later
// by relaxing the rule above", and then listed exactly how somebody would be
// tempted to close them wrongly. Both halves were right. They were closed the
// other way instead, on 16 August 2026.
//
// FOUR were simply unreachable: Stacking Tin, Knock Out Collection, Holiday
// Calendar and Trick or Trade are general-release products that belong to no
// expansion, so TCGplayer files them outside the 28 set names pinned in
// shared/tcgplayer.mjs and a per-set pull could never see one.
//
// THE OTHER SEVEN were listed in sets we track, and were left blank because in
// every case the listing was a DIFFERENT PRODUCT from the one the count on that
// row was read off, so the pictured box's own pack count was not sourced.
//
// data/extra-products.json closes both groups the same way: it pins, by
// TCGplayer product id with the returned name asserted, THE PRODUCT THE COUNT
// WAS READ OFF. The Mega Greninja ex Premium Collection whose pokemon.com page
// states the eight. The Mega Latias ex Box that states the four, rather than
// one of the three Ascended Heroes boxes that do not. The Charizard ex Special
// Collection rather than the Crown Zenith line. The December 2025 Poke Ball Tin
// rather than the 2022 Pokemon GO one. The Prismatic Evolutions Surprise Box,
// which the old paragraph itself noted "is sourced at four AND is listed" and
// was only missing because sync-products.mjs takes the cheapest per set. So the
// test at the top of this block still passes on every one of them: the pictured
// product's own pack count is the number the row states.
//
// STACKING TIN IS THE ONE THAT IS STILL BLANK, and it is the reason this file
// still needs a hatched box at all. pokemon.com sources three packs for the run
// that launched on 7 March 2025. TCGplayer lists eleven Stacking Tins spread
// over four years and publishes no release date, so choosing one is a guess and
// a guess here is a photograph of an unknown number. It would look completely
// fine on the page. That is the problem.
//
// NO WIDTH OR HEIGHT ON THESE. imgDims() returns nothing for tcgplayer-cdn on
// purpose: those files run 200x268 to 200x417 and a declaration would be wrong
// by up to 34%. And sizes is 88px, not a viewport unit, because the box is a
// fixed 88x88; that is a measured fix worth 4x the bytes and it is not a
// placeholder to be improved.
// The products pinned by hand for their photographs, because the per-set pull
// cannot reach them. See scripts/sync-extra-products.mjs, and the note on
// photoFor below for why they satisfy the rule this file sets rather than
// bending it. Keyed here by the row's productName.
const EXTRA = JSON.parse(await readFile(join(ROOT, "data/extra-products.json"), "utf8")).products;

const PHOTOS = {
  "Booster Display Box": ["pitch-black", "Booster Box", "Pitch Black Booster Box"],
  "Elite Trainer Box": ["pitch-black", "Elite Trainer Box", "Pitch Black Elite Trainer Box"],
  "Pokemon Center Elite Trainer Box": [
    "pitch-black",
    "Pokemon Center Elite Trainer Box",
    "Pitch Black Pokemon Center Elite Trainer Box",
  ],
  "Ultra-Premium Collection": ["151", "Ultra-Premium Collection", "151 Ultra-Premium Collection"],
  "Super-Premium Collection": [
    "prismatic-evolutions",
    "Super-Premium Collection",
    "Prismatic Evolutions Super-Premium Collection",
  ],
  "Booster Bundle": ["pitch-black", "Booster Bundle", "Pitch Black Booster Bundle"],
  "Build & Battle Box": ["pitch-black", "Build & Battle Box", "Pitch Black Build & Battle Box"],
  "Booster pack (loose or sleeved)": ["pitch-black", "Single Pack", "Pitch Black Booster Pack"],
  "Three-Booster Blister (3-pack blister)": ["shrouded-fable", "Blister Pack", "Shrouded Fable 3 Pack Blister"],
  "Checklane Blister (single-pack blister)": ["pitch-black", "Blister Pack", "Pitch Black Single Pack Blister"],
  "Mini Tin": ["prismatic-evolutions", "Tin", "Prismatic Evolutions Mini Tin"],
  "Two-pack blister": ["prismatic-evolutions", "Blister Pack", "Prismatic Evolutions 2-Pack Blister"],
};

/**
 * The photo for a product type, or null.
 *
 * Matched on the set id AND the kind, and then checked against the NAME we
 * expected to find there. sync-products.mjs picks the cheapest variant per
 * kind, so the product behind "prismatic-evolutions / Blister Pack" can change
 * under us; if it does, the caption would name a product that is not in the
 * picture. Better to drop the photo than to caption the wrong box.
 *
 * THE SECOND LOOKUP IS THE ONE THAT FILLED TEN OF THE ELEVEN BLANKS, and it did
 * it by satisfying the rule rather than by loosening it. data/extra-products.json
 * pins, by TCGplayer id and with the returned name asserted, THE PRODUCT THE
 * COUNT ON THAT ROW WAS READ OFF: the Mega Greninja ex Premium Collection whose
 * pokemon.com page states the eight, the January 2025 Knock Out Collection that
 * states the two, the December 2025 Poke Ball Tin that states the three, and so
 * on. So the pictured box's own pack count IS the number beside it, which is the
 * test the header comment sets. Every one of the seven "listed but a different
 * product" cases above is closed that way, and the four general-release ones are
 * simply reachable now that the pull is not per-set.
 *
 * THE ELEVENTH IS STILL BLANK AND IT SHOULD BE. pokemon.com sources the Stacking
 * Tin at three packs for the 7 March 2025 run. TCGplayer lists eleven Stacking
 * Tins across four years and publishes no release date, so picking one is a
 * guess, and a guessed photo here is a picture of an unknown number.
 */
function photoFor(name) {
  const spec = PHOTOS[name];
  if (spec) {
    const [sid, kind, expect] = spec;
    const hit = (productsBySet[sid]?.products || []).find((p) => p.kind === kind);
    if (!hit || !hit.thumb || DEAD.has(hit.thumb)) return null;
    if (!String(hit.name || "").toLowerCase().startsWith(expect.toLowerCase())) return null;
    return { src: hit.thumb, large: hit.image, name: hit.name };
  }
  const extra = Object.values(EXTRA).find((p) => p.row === name);
  if (!extra || !extra.thumb || DEAD.has(extra.thumb)) return null;
  return { src: extra.thumb, large: extra.image, name: extra.name };
}

// ---------------------------------------------------------------- the copy
//
// TWO HAND-WRITTEN MAPS, AND BOTH ARE GUARDED. The research file was written
// for whoever built this page, not for a reader, and it shows in two fields.
//
// productName carries builder-facing parentheticals ("ex Box (shares the
// ex-premium tag, but is half the size)") that describe this site's taxonomy
// rather than the product. DISPLAY gives each one the name it has on a shelf.
//
// `confidence` is worse, because it is genuinely useful and genuinely in the
// wrong voice: "COUNT VARIES BY PRODUCT and this is the single biggest trap on
// the page ... Always name the specific UPC" is an instruction to me. NOTE is
// the reader's version of the same fact. Neither map may quietly go missing, so
// a product with no entry in either stops the build rather than shipping the
// research voice or the taxonomy note to a reader.
const DISPLAY = {
  "Booster Display Box": "Booster box",
  "Elite Trainer Box": "Elite Trainer Box",
  "Pokemon Center Elite Trainer Box": "Pokemon Center Elite Trainer Box",
  "Booster Bundle": "Booster Bundle",
  "Ultra-Premium Collection": "Ultra-Premium Collection (UPC)",
  "Super-Premium Collection": "Super-Premium Collection (SPC)",
  "ex Premium Collection": "ex Premium Collection",
  "ex Box (shares the ex-premium tag, but is half the size)": "ex Box",
  "ex Special Collection": "ex Special Collection",
  "Poke Ball Tin": "Poke Ball Tin",
  "Standard collector tin": "Standard collector tin",
  "Mini Tin": "Mini Tin",
  "Stacking Tin": "Stacking Tin",
  "Three-Booster Blister (3-pack blister)": "Three-pack blister",
  "Two-pack blister": "Two-pack blister",
  "Checklane Blister (single-pack blister)": "Single-pack blister (checklane)",
  "Booster pack (loose or sleeved)": "One booster pack",
  "Knock Out Collection": "Knock Out Collection",
  "Collection boxes (a family, not one product)": "Collection boxes",
  "Build & Battle Box": "Build & Battle Box",
  "Battle Deck": "Battle Deck",
  "Holiday Calendar": "Holiday Calendar",
  "Trick or Trade BOOster Bundle": "Trick or Trade BOOster Bundle",
};

const NOTE = {
  "Booster Display Box":
    "Thirty-six has held across the Scarlet and Violet and Mega Evolution eras. The Enhanced Booster Display Box is also thirty-six, with one extra stamped promo card.",
  "Elite Trainer Box":
    "Nine held on every Elite Trainer Box checked, from Destined Rivals in 2025 to 30th Celebration in 2026. What is in the box besides packs does move: the Energy card count runs 40, 45 or 16 foil depending on the set, and you get either a plastic coin or condition markers.",
  "Pokemon Center Elite Trainer Box":
    "Two more packs and a second promo card than the standard box, held on Paldea Evolved, Prismatic Evolutions, Pitch Black and 30th Celebration. Pokemon Center lists every current-era one at the same price as the standard box, which is worth knowing before you buy either.",
  "Booster Bundle":
    "Six, on every bundle checked from the 2023 debut to now. Pokemon Center literally names the product with the count in it. The Booster Bundle is a Scarlet and Violet invention, so a sealed product older than 2023 will never be one.",
  "Ultra-Premium Collection":
    "There is no such thing as the UPC pack count. Sixteen, eighteen and thirty are all sourced on separate products, so the only safe way to buy one is by its full name. The 30th Celebration pair is the biggest sealed product on this page after a booster box.",
  "Super-Premium Collection":
    "Only two current-era Super-Premium Collections were found and they disagree with each other. Nothing has shipped under this name since May 2025, so treat it as a shelf leftover rather than a live line.",
  "ex Premium Collection":
    "Eight on both 2026 Premium Collections checked. Do not read this row across to the ex Box below it: same family, same shelf, half the packs.",
  "ex Box (shares the ex-premium tag, but is half the size)":
    "Four on all three current ex Boxes checked. This is the distinction most worth getting right on this page, because an ex Box and an ex Premium Collection sit next to each other and differ by four packs.",
  "ex Special Collection":
    "One product, one source. Only a single current-era ex Special Collection was found, so five is what that one held rather than what the line holds. If a second one appears this row needs re-reading.",
  "Poke Ball Tin":
    "Three, on the December 2025 run. The whole ball family is the same shape: Poke Ball, Great Ball, Ultra Ball, Premier Ball, Moon Ball, Lure Ball, Love Ball and Luxury Ball.",
  "Standard collector tin":
    "The count changed. Every 2025 standard tin checked held five packs and every 2026 one holds four, so four is what is on a shelf now and five is what an older tin still in stock will have. Check the release rather than the shape.",
  "Mini Tin":
    "Two on every Mini Tin checked, from Prismatic Evolutions in February 2025 to Lumiose City in June 2026. It is the smallest tin and it is the one most often mistaken for a standard one in a photo.",
  "Stacking Tin":
    "One current-era source, from March 2025. Stacking Tins carry no promo card, which is what separates them from a standard tin at a similar price.",
  "Three-Booster Blister (3-pack blister)":
    "Both retailers agree on three packs and disagree about everything else: one lists a foil promo and a coin, the other lists only the packs. There is no pokemon.com page for blisters of any size, so a shop listing is the best source that exists.",
  "Two-pack blister": null,
  "Checklane Blister (single-pack blister)":
    "One pack, a promo and a coin, which is the shape the checklane blister has had for years. The listing read was a marketplace seller rather than the store itself, so it is a weaker source than the rest of this section.",
  "Booster pack (loose or sleeved)":
    "One pack is one pack, and that part needs no source. The price does: it is one shop's shelf price for a sleeved pack, and it is more than twice what the same pack costs inside a bundle. Take it as that shop on that day, not a baseline.",
  "Knock Out Collection":
    "Two packs on both the January 2024 and January 2025 editions. There is no 2026 edition, so this is what the product held as of its last release rather than a live line.",
  "Collection boxes (a family, not one product)":
    "The widest spread on the page, and the reason there is no single row for it. Everything from a tech sticker collection to a Collector Chest lands in this family, and the counts run from three to six. Buy these by name.",
  "Build & Battle Box":
    "Four packs and a forty-card deck, on both Mega Evolution and Pitch Black, and unchanged since the Sword and Shield era. This is the answer to whether starter products hold packs: this one does.",
  "Battle Deck":
    "No booster packs at all, and this is the thing a returning buyer gets wrong most often. Sixty foil cards making a ready-to-play deck. Verified on the newest one; League and Deluxe Battle Decks were not individually checked.",
  "Holiday Calendar":
    "Six real booster packs behind twenty-five doors. The seven three-card fun packs are not booster packs and are never added to that total. Sourced from the 2025 calendar; no 2026 one has appeared yet.",
  "Trick or Trade BOOster Bundle":
    "Zero booster packs, despite the word Bundle in the name. The mini-pack count has moved too, from forty in 2022 to thirty-five in 2024, and no newer edition has appeared. If a listing calls this a bundle and quotes six packs, it is confusing it with the Booster Bundle.",
};

// ---------------------------------------------------------------- current rows
//
// EVERY ROW IS ONE ENTRY IN pack-counts-current.json, keyed on productName.
// See trap 2 in the header: keying on `id` would collapse the ex Premium
// Collection into the ex Box and three sizes of tin into one.
const rows = cur.products.map((p) => {
  const list = Array.isArray(p.packsByProduct) ? p.packsByProduct : null;
  if (p.packs === null && !list) {
    throw new Error(`pack-counts-current.json: "${p.productName}" has neither packs nor packsByProduct`);
  }
  const counts = list ? list.map((x) => x.packs) : [p.packs];
  const lo = Math.min(...counts);
  const hi = Math.max(...counts);
  if (!DISPLAY[p.productName]) {
    throw new Error(`"${p.productName}" has no entry in DISPLAY, so it would print its research name to a reader`);
  }
  if (!(p.productName in NOTE)) {
    throw new Error(`"${p.productName}" has no entry in NOTE. Write the reader's version of its confidence line.`);
  }
  return {
    id: p.id,
    raw: p.productName,
    name: DISPLAY[p.productName],
    note: NOTE[p.productName],
    openings: p.openingsPage,
    packs: p.packs,
    byProduct: list,
    miniPacks: p.miniPacks ?? null,
    lo,
    hi,
    label: p.packs !== null ? String(p.packs) : lo === hi ? String(lo) : `${lo} to ${hi}`,
    varies: p.packs === null && lo !== hi,
    cardsPerPack: p.cardsPerPack,
    cardsNote: p.cardsPerPackNote || "",
    extras: p.alsoIncludes || [],
    price: p.price || null,
    priceNote: p.priceNote || "",
    // p.confidence is deliberately NOT carried onto the row. It is written to
    // the builder, not the reader, and NOTE above is its published version.
    sources: p.sources || [],
    photo: photoFor(p.productName),
  };
});

// A blister configuration the research could not source anywhere official, and
// the reason it gets a row anyway.
//
// The owner asked for the two-pack blister by name. pokemon.com has no product
// gallery page for blisters at all, and Bulbapedia's merchandise pages document
// the two-pack through the Sun & Moon era and then stop mentioning it, which is
// an absence rather than a statement. Meanwhile this site's own nightly
// TCGplayer pull carries a product literally called "Prismatic Evolutions
// 2-Pack Blister". That listing is a weaker source than a pokemon.com page and
// it is labelled as one on the page, but it is a real source with a read date,
// which is the whole test. It is derived rather than typed so it disappears by
// itself if TCGplayer stops listing one.
const twoPack = (() => {
  for (const [sid, entry] of Object.entries(productsBySet)) {
    for (const p of entry.products || []) {
      if (p.kind !== "Blister Pack") continue;
      const m = /\b2[- ]pack blister\b/i.exec(p.name || "");
      if (!m) continue;
      return {
        id: "blister",
        raw: "Two-pack blister",
        name: DISPLAY["Two-pack blister"],
        note: "The weakest sourcing on this page, and it is here because it is a real thing people buy. There is no official Pokemon page for a blister of any size, so the count comes from the product name on a shop listing. Bulbapedia's era pages document a two-pack blister through the Sun and Moon era and then stop naming one, so treat it as a configuration that still turns up rather than a current standard.",
        openings: "/openings/blister.html",
        packs: 2,
        byProduct: null,
        miniPacks: null,
        lo: 2,
        hi: 2,
        label: "2",
        varies: false,
        cardsPerPack: null,
        cardsNote: "Not stated on the listing, and there is no official page for a blister of any size to check it against.",
        extras: [],
        price: null,
        priceNote: "",
        sources: [
          {
            tier: 3,
            publisher: "TCGplayer",
            title: p.name,
            url: p.url,
            excerpt: "Product listed under this name in our own nightly price pull.",
            readAt: productsChecked,
            supports: ["packs"],
          },
        ],
        photo: photoFor("Two-pack blister"),
      };
    }
  }
  return null;
})();
if (twoPack) rows.push(twoPack);

// THE GUARD TRAP 2 EXISTS FOR. Two entries share id "ex-premium" (8 packs and
// 4) and three share "tin" (4, 2 and 3). A renderer keyed on id would print one
// of each group and silently drop the rest, which is a wrong number rather than
// a missing one. So: every id carrying more than one distinct pack figure has
// to reach the page that many times.
{
  const want = new Map();
  for (const p of cur.products) {
    if (!p.id) continue;
    const key = p.packs !== null ? String(p.packs) : (p.packsByProduct || []).map((x) => x.packs).join("/");
    if (!want.has(p.id)) want.set(p.id, new Set());
    want.get(p.id).add(key);
  }
  for (const [id, sizes] of want) {
    if (sizes.size < 2) continue;
    const shown = rows.filter((r) => r.id === id && cur.products.some((p) => p.productName === r.raw)).length;
    if (shown !== sizes.size) {
      throw new Error(
        `id "${id}" carries ${sizes.size} different pack counts (${[...sizes].join(", ")}) but ` +
          `${shown} row(s) reached the page. Split by product NAME, never by id.`
      );
    }
  }
}
if (rows.length < cur.products.length) {
  throw new Error(`${cur.products.length} researched products but ${rows.length} rows rendered`);
}

// BIGGEST FIRST, DOWN TO THE SINGLE BLISTER. Sorted on the largest sourced
// count, so a product whose count varies sits where its biggest version puts
// it, with the range on the row. Ties break on the smallest count and then on
// the name, so the order is stable rather than dependent on file order.
rows.sort((a, b) => b.hi - a.hi || b.lo - a.lo || a.name.localeCompare(b.name));

const withNumber = rows.filter((r) => r.hi > 0);
const noPacks = rows.filter((r) => r.hi === 0);

// Price per pack, ONLY where both halves are sourced. Never per card: a 30th
// Celebration pack holds 5 foil cards and 1 foil Energy rather than 10 and 1,
// so a per-card figure would be wrong for a whole current line. Per PACK is
// safe, because the pack counts for those products are unchanged.
const perPack = (r) => {
  if (!r.price || typeof r.price.amount !== "number" || r.packs === null || r.packs < 1) return null;
  return r.price.amount / r.packs;
};
const priced = rows.filter((r) => perPack(r) !== null).sort((a, b) => perPack(a) - perPack(b));

// ---------------------------------------------------------------- history
//
// SOURCES COME OUT OF THE DATA FILE, NEVER TYPED HERE. src("S1","S3") looks the
// ids up in pack-counts-history.json and throws on one it does not know, so a
// claim can never quietly lose the source it was written against.
const S = hist.sources || {};
function src(...ids) {
  return ids.map((id) => {
    const s = S[id];
    if (!s || !s.url) throw new Error(`history source "${id}" is not in pack-counts-history.json`);
    return s;
  });
}
// EACH LINK SAYS WHICH PAGE IT IS, not which site. Three of these rows cite two
// Bulbapedia articles, and rendering both as the word "Bulbapedia" gives a
// reader tabbing through two identical links side by side with no way to tell
// them apart. The article title is the thing that differs, so it is the label.
const cite = (...ids) =>
  `<span class="hp-cite">${src(...ids)
    .map((s) => {
      const site = s.site.replace(/ \(official.*$/, "");
      const short = s.title.replace(/\s*\(TCG\)$/, "").replace(/^Expansion Overview:\s*/, "");
      return `<a href="${esc(s.url)}" rel="noopener nofollow" target="_blank" aria-label="${esc(
        s.title
      )}, on ${esc(site)}">${esc(short.length > 42 ? `${short.slice(0, 40)}...` : short)}<span>${esc(
        site
      )}</span></a>`;
    })
    .join(" ")}</span>`;

// How far a historical claim can be trusted, said on the row rather than in a
// footnote. The research file is explicit that everything about tins, blisters
// and collection boxes before 2020 rests on Bulbapedia's era merchandise pages
// alone, and that this is not a reason to drop them: Bulbapedia is often the
// only record there is. It is a reason to mark them.
const TRUST = {
  official: ["Official", "ok"],
  both: ["Official and Bulbapedia", "ok"],
  two: ["Bulbapedia, two pages", "mid"],
  one: ["Bulbapedia only", "low"],
  shop: ["Shop listing only", "low"],
};
const trust = (k) => {
  const t = TRUST[k];
  if (!t) throw new Error(`unknown trust level "${k}"`);
  return `<span class="hp-tr ${t[1]}">${esc(t[0])}</span>`;
};

// The cards-per-pack timeline, which is the single most useful fact on the page
// for anybody holding older sealed product.
const ERAS = [
  {
    era: "Base Set to Neo Destiny",
    when: "1999 to 2002",
    cards: "11",
    what: "Eleven cards. This is the only era on this list that rests on one sentence on one page, and no individual set page was found repeating it, so treat it as the weakest line here.",
    trust: "one",
    ids: ["S1"],
  },
  {
    era: "Expedition Base Set to the end of the EX Series",
    when: "September 2002 to 2007",
    cards: "9",
    what: "Nine cards. This is the era people get wrong. A pack from here is a smaller pack, not a short-packed or tampered one, and it is the era anybody buying vintage sealed product is most likely holding. The set's own page states the drop from eleven independently of the summary article, and it is also where the reverse holo slot arrived.",
    trust: "two",
    ids: ["S1", "S2"],
  },
  {
    era: "Diamond & Pearl onward",
    when: "May 2007 to today",
    cards: "10",
    what: "Ten cards, and the game-card count has not moved since. Same double-sourced shape as the drop to nine: the summary article and the set's own page both state the increase.",
    trust: "two",
    ids: ["S1", "S3"],
  },
  {
    era: "Sun & Moon onward",
    when: "February 2017 to today",
    cards: "10",
    what: "Still ten game cards, with a Basic Energy card and a code card added on top. This is why you will see the same pack called ten, eleven or twelve depending on whether a source counts the extras. The number this page uses is the ten.",
    trust: "two",
    ids: ["S1", "S5"],
  },
  {
    era: "Scarlet & Violet and Mega Evolution",
    when: "Today",
    cards: "10",
    what: "The Pokemon Company's own wording on the current expansion pages is 10 cards and 1 Basic Energy. That is the safest sentence on this page, because it is theirs.",
    trust: "official",
    ids: ["S9", "S11"],
  },
];

/**
 * The cards-per-pack timeline, drawn.
 *
 * WHY THIS SECTION EARNED A PICTURE AND THE ONES EITHER SIDE OF IT DID NOT.
 * The whole argument of this section is a SHAPE: "it did not go from eleven
 * straight to ten, there is a nine-card era in the middle and it lasted nearly
 * five years". That is a claim about a dip and about how wide the dip is, and a
 * list of five paragraphs is the one format that cannot show either. Every
 * neighbouring section on this page carries product photography; this one was
 * 2,323 characters of prose with nothing but the section's flower glyph.
 *
 * THE STEPS ARE DERIVED, NOT TYPED. It walks ERAS in order and emits a step
 * only where `cards` actually CHANGES, which is why the five rows above draw
 * three levels: rows 3, 4 and 5 are all ten, and the page says so in words
 * ("the game-card count has not moved since"). If somebody adds a sixth era
 * this figure follows it without being touched, and if they add one that does
 * not move the number it correctly draws nothing new.
 *
 * THE DATES ARE PARSED FROM `when` AND A FAILURE THROWS. The alternative was a
 * second numeric field beside the prose, which is a number that can drift away
 * from the sentence next to it while both look right. Parsing the one string
 * the reader is shown means the picture and the paragraph cannot disagree.
 */
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};
function eraStart(when) {
  // "September 2002 to 2007" -> 2002.667, "1999 to 2002" -> 1999, "Today" -> null
  const s = String(when).trim();
  if (/^today$/i.test(s)) return null;
  let m = s.match(/^([A-Za-z]+)\s+(\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo === undefined) throw new Error(`eraStart: unknown month in "${when}"`);
    return Number(m[2]) + mo / 12;
  }
  m = s.match(/^(\d{4})\b/);
  if (m) return Number(m[1]);
  throw new Error(`eraStart: cannot read a start date out of "${when}"`);
}

/**
 * SPACE MONO ADVANCE, THE SAME GUARD build-grade-check.mjs USES.
 * SVG neither wraps nor clips, so a label wider than the room it has paints
 * straight through whatever is beside it and nothing errors. 0.6em is Space
 * Mono's advance per character. Anything that does not fit throws at build
 * time rather than shipping a figure that looks fine until you read it.
 */
function fits(text, px, budget, what) {
  const w = String(text).length * px * 0.6;
  if (w > budget) {
    throw new Error(
      `eraChart: "${text}" is ${w.toFixed(1)}px at ${px}px but ${what} only has ${budget.toFixed(1)}px`,
    );
  }
  return text;
}

function eraChart(builtAt) {
  // Steps: one per CHANGE in the card count, in era order.
  const steps = [];
  for (const e of ERAS) {
    const n = Number(e.cards);
    if (!Number.isFinite(n)) throw new Error(`eraChart: era "${e.era}" has a non-numeric card count`);
    const at = eraStart(e.when);
    if (at === null) continue; // "Today" adds no change point
    if (steps.length && steps[steps.length - 1].n === n) continue;
    steps.push({ n, at, era: e.era, when: e.when });
  }
  if (steps.length < 2) return ""; // nothing to draw a shape out of

  const counts = steps.map((s) => s.n);
  const lo = Math.min(...counts);
  const hi = Math.max(...counts);
  const t0 = steps[0].at;
  // The axis ends on the BUILD clock, so "to today" on the last row and the
  // right-hand end of the line are the same day rather than a typed year.
  const t1 = builtAt.getFullYear() + builtAt.getMonth() / 12;
  if (t1 <= t0) throw new Error("eraChart: the build clock is before the first era");

  const W = 360, H = 190;
  const L = 30, R = 350, TOP = 26, BASE = 148;
  const ROW = 40; // px per card, so a one-card step is always the same height
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (R - L);
  const y = (v) => BASE - (v - lo) * ROW;

  // Gridlines and the y labels, one rung per whole card in the range.
  let grid = "";
  for (let v = lo; v <= hi; v++) {
    grid += `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${R}" y2="${y(v).toFixed(1)}" stroke="#111111" stroke-opacity=".14" stroke-width="1"/>
    <text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="hp-fnum">${v}</text>`;
  }

  // THE DIP IS THE POINT, so the era that sits BELOW its neighbours gets a
  // shaded column behind it. It is a pale fill rather than a second hue: with
  // colour removed entirely it is still a lighter column, and the step line on
  // top carries the argument on its own either way.
  const dipIdx = counts.indexOf(lo);
  let dip = "";
  let note = "";
  if (dipIdx > 0 && dipIdx < steps.length - 1) {
    const a = x(steps[dipIdx].at);
    const b = x(steps[dipIdx + 1].at);
    dip = `<rect x="${a.toFixed(1)}" y="${TOP}" width="${(b - a).toFixed(1)}" height="${(BASE - TOP).toFixed(1)}" fill="#F5E7BD"/>`;
    // The annotation sits in the empty room UNDER the last step and to the
    // RIGHT of the dip, which is the only large clear area in the box. It is
    // not centred on the column it describes: the column is 54px wide and the
    // date line is 21 characters, so centring it would paint it through both
    // neighbours. A leader line does the pointing instead.
    const nx = b + 24;
    const budget = R - nx;
    const l1 = fits(`the ${["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"][lo] || lo}-card era`, 11, budget, "the annotation");
    // The era's own window verbatim if it fits, so the label and the paragraph
    // below say the same thing, and its start alone if it does not.
    const full = String(steps[dipIdx].when);
    const l2 = fits(
      full.length * 11 * 0.6 <= budget ? full : shortWhen(full),
      11, budget, "the annotation",
    );
    note = `${dip}
    <line x1="${(nx - 6).toFixed(1)}" y1="${(BASE - 16).toFixed(1)}" x2="${(b - 14).toFixed(1)}" y2="${(BASE - 5).toFixed(1)}" stroke="#111111" stroke-width="1.2"/>
    <text x="${nx.toFixed(1)}" y="${(BASE - 20).toFixed(1)}" class="hp-fnote">${esc(l1)}</text>
    <text x="${nx.toFixed(1)}" y="${(BASE - 6).toFixed(1)}" class="hp-fdate">${esc(l2)}</text>`;
  }

  // The step line itself: flat across each era, vertical at each change.
  let d = `M ${x(steps[0].at).toFixed(1)} ${y(steps[0].n).toFixed(1)}`;
  for (let i = 1; i < steps.length; i++) {
    d += ` L ${x(steps[i].at).toFixed(1)} ${y(steps[i - 1].n).toFixed(1)}`;
    d += ` L ${x(steps[i].at).toFixed(1)} ${y(steps[i].n).toFixed(1)}`;
  }
  d += ` L ${R} ${y(steps[steps.length - 1].n).toFixed(1)}`;

  // Year ticks at each change, plus the ends. The LAST one is end-anchored:
  // centred it would run past the right edge of the viewBox, which an SVG
  // renders happily and invisibly wrong.
  let ticks = "";
  const marks = [{ t: t0, lbl: String(Math.floor(t0)), anchor: "middle" }];
  for (let i = 1; i < steps.length; i++) {
    marks.push({ t: steps[i].at, lbl: String(Math.floor(steps[i].at)), anchor: "middle" });
  }
  marks.push({ t: t1, lbl: String(builtAt.getFullYear()), anchor: "end" });
  for (const m of marks) {
    ticks += `<line x1="${x(m.t).toFixed(1)}" y1="${BASE + 6}" x2="${x(m.t).toFixed(1)}" y2="${BASE + 11}" stroke="#111111" stroke-width="1.2"/>
    <text x="${x(m.t).toFixed(1)}" y="${BASE + 24}" text-anchor="${m.anchor}" class="hp-ftick">${esc(m.lbl)}</text>`;
  }

  const spoken = steps
    .map((s, i) => `${s.n} cards from ${s.when.replace(/ to .*$/, "")}${i === steps.length - 1 ? " to today" : ""}`)
    .join(", then ");

  return `<figure class="hp-fig">
  ${/* THE ARIA LABEL CARRIES ONLY WHAT THE DATA SAYS. It read "and it is
        roughly a fifth of the width of the whole chart" until that fraction
        was checked: the shaded column is 54.1 of 320 units, which is a sixth.
        Nothing errored and no sighted reader would ever have seen it, which is
        what makes a typed figure in an aria-label the worst place to put one.
        The era's own window is stated instead, and it comes from ERAS. */ ""}
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="A step chart of the game cards in a booster pack over time: ${esc(spoken)}. The ${lo}-card era in the middle, ${esc(steps[dipIdx] ? steps[dipIdx].when : "")}, is drawn as a dip and shaded.">
    ${grid}
    ${note}
    <line x1="${L}" y1="${BASE + 6}" x2="${R}" y2="${BASE + 6}" stroke="#111111" stroke-width="1.4"/>
    <path d="${d}" fill="none" stroke="#111111" stroke-width="3" stroke-linejoin="miter"/>
    ${ticks}
    <text x="${L}" y="${TOP - 10}" class="hp-fnote">game cards in a booster pack</text>
  </svg>
  <figcaption>Game cards only. Since Sun &amp; Moon a pack has also held a Basic Energy card and a code card, which
    is why the same pack gets called ten, eleven or twelve depending on who is counting. The step down is the part
    worth knowing: a pack from the middle era is a smaller pack, not a tampered one.</figcaption>
</figure>`;
}

// "September 2002 to 2007" -> "September 2002". The window's END is the next
// era's start and is already drawn by the next step, so repeating it in the
// label spends characters the box does not have.
function shortWhen(when) {
  return String(when).replace(/\s+to\s+.*$/i, "").trim();
}

// The Elite Trainer Box, which is the product the site contradicted itself
// about and the one this section exists to settle.
const ETB = [
  { n: "7", when: "Plasma Storm, February 2013", what: "The first Elite Trainer Box. A contemporaneous reveal article lists seven packs, so the count is not resting on one page even though calling it the first one is.", trust: "two", ids: ["S7", "S8"] },
  { n: "8", when: "Plasma Blast to Silver Tempest", what: "Nine years at eight packs for main expansions, confirmed on the XY, Sun & Moon and Sword & Shield merchandise pages separately. This is the best-supported historical figure here.", trust: "two", ids: ["S7", "S13", "S14"] },
  { n: "10", when: "Most special expansions, Generations to Crown Zenith", what: "Which is why a flat claim that Elite Trainer Boxes used to hold eight is wrong for that whole window. Bulbapedia hedges with most, and so does this row.", trust: "one", ids: ["S7"] },
  { n: "9", when: "Scarlet & Violet onward, still current", what: "Nine on every main expansion since 2023, confirmed on three official expansion pages including the current one. This is the number on the shelf today.", trust: "both", ids: ["S9", "S10", "S11"] },
  { n: "11", when: "Pokemon Center version, Scarlet & Violet onward", what: "Two more packs and a second promo card for the same money at the time of writing. Not a region split, a retail-channel one, and the names differ by two words.", trust: "both", ids: ["S7", "S9"] },
  { n: "12", when: "Pokemon Center Pokemon GO and Pokemon Center Crown Zenith", what: "Two products only.", trust: "one", ids: ["S7"] },
  { n: "10 + 5", when: "Celebrations, 2021", what: "Ten Celebrations packs plus five from other Sword & Shield sets, and thirteen plus six in the Pokemon Center version. Celebrations packs hold four cards, so ten of them is not ten of anything else.", trust: "one", ids: ["S7", "S6"] },
  { n: "8", when: "Pokemon Center Chilling Reign, a packing error", what: "It should have held ten. Recorded because it is a real trap on one specific product rather than a rule.", trust: "one", ids: ["S7"] },
];

const REGIONAL = [
  { trap: "Sword & Shield era tins", detail: "Five packs in North America and four everywhere else. Same product name, same art.", trust: "one", ids: ["S13"] },
  { trap: "The European half booster box", detail: "An eighteen-pack half display is sold in Europe, notably the UK, alongside the thirty-six. Both get called a booster box.", trust: "one", ids: ["S17"] },
  { trap: "Japanese booster packs", detail: "Five cards a pack against ten in English, stated on the official Japanese page for Battle Partners. Japanese special sets break even that: the 30th Celebration expansion pack is six holo cards.", trust: "official", ids: ["S18", "S19"] },
  { trap: "Brazilian booster packs", detail: "Seven cards a pack, and six before Sun & Moon.", trust: "one", ids: ["S1"] },
  { trap: "Diamond & Pearl Collector's Tins, September 2007", detail: "Four packs in both regions, but North America got two Mysterious Treasures and two Diamond & Pearl while the international run got four Diamond & Pearl.", trust: "one", ids: ["S15"] },
  { trap: "Lucario Collector's Tin", detail: "Four packs in the 2007 run and three in the 2008 re-issue. Same name, same art.", trust: "one", ids: ["S15"] },
  { trap: "Elite Trainer Box against Pokemon Center Elite Trainer Box", detail: "Nine packs against eleven for the same expansion, sold at the same price at the time of writing.", trust: "official", ids: ["S9", "S11"] },
];

const OLD = [
  { what: "Mixed-set blisters", detail: "Older blisters routinely held packs from different sets, and the odd one out was often from the previous generation entirely: two Diamond & Pearl packs and one late EX Series pack, or one Diamond & Pearl pack and one POP Series 2 pack. The set named on the packaging is not necessarily the set of every pack inside. Modern blisters are single-set.", trust: "one", ids: ["S15"] },
  { what: "The four-pack and five-pack blister", detail: "DP Value Pack 2 held four packs and DP Value Pack 1 held five, two of them from Diamond & Pearl and three from three different EX Series sets. Neither configuration survived the Diamond & Pearl era.", trust: "one", ids: ["S15"] },
  { what: "The two-pack blister", detail: "Documented in the Diamond & Pearl, XY and Sun & Moon merchandise pages and absent from Sword & Shield onward. That absence is not a statement, so the honest phrasing is that it was last documented in the Sun & Moon era rather than that it was discontinued. Shops do still list one, which is the row above.", trust: "one", ids: ["S15", "S16"] },
  { what: "Theme Decks", detail: "Never contained booster packs at all, confirmed on two separate era pages. Sixty cards, damage counters, a coin, a playmat, a deck box and a code card. We could not verify when the line ended or what replaced it, so this page does not say.", trust: "two", ids: ["S14", "S16"] },
  { what: "Trainer Kits", detail: "The Diamond & Pearl era kits included one booster pack. The XY era kits included none. The pack count changed inside one product line, which is the reason this line is worth knowing about. No source was found for when the line ended.", trust: "one", ids: ["S15", "S14"] },
  { what: "Build & Battle Box", detail: "Four packs plus a forty-card deck, unchanged from the Sword & Shield era to the current one. The one product on this page that has not moved at all.", trust: "both", ids: ["S12", "S13"] },
  { what: "Build & Battle Stadium", detail: "Two Build & Battle Boxes plus three loose packs. Eleven packs in total is arithmetic on the quoted contents rather than a figure anybody printed, and it is labelled that way on purpose.", trust: "one", ids: ["S12"] },
  { what: "Celebrations, 2021", detail: "Four cards a pack, fourteen years after ten became the standard, and no booster box was ever made: it could only be bought inside branded merchandise. The best single illustration of why cards per pack is a per-product question and not only a per-era one.", trust: "one", ids: ["S6"] },
  { what: "Hidden Fates, 2019", detail: "Normal ten-card packs, but again no booster box. Anybody selling you a Hidden Fates booster box is selling something that was never made as a standard product.", trust: "one", ids: ["S5"] },
  { what: "Collection boxes and tins before 2020", detail: "XY Figure Collections and the Legends of Kalos and Legends of Alola tins held four packs. Collector's Albums held one. The Darkrai Premium Box held two, both from the previous generation. V Boxes are described as typically four, and typically is the source's own hedge, so this page does not turn it into a flat number.", trust: "one", ids: ["S13", "S14", "S15", "S16"] },
];

// ---------------------------------------------------------------- copy helpers
//
// STOP THE RESEARCH FILE SHOUTING AT THE READER. Its prose fields use ALL CAPS
// for emphasis, which is right in a note to whoever builds the page and wrong in
// published copy: "7 three-card fun packs, which are NOT booster packs" and
// "These are MINI packs of 3 cards". DISPLAY and NOTE above already replace the
// two fields that were worst; this catches the emphasis wherever else it lands
// in a field that reaches the page. The keep list is initialisms and one product
// name that really is capitalised, so a genuine acronym is never lowercased.
const KEEP_CAPS = new Set(["TCG", "MSRP", "UPC", "SPC", "ETB", "VSTAR", "VMAX", "PSA", "USD", "NA", "EX", "POP", "DP", "XY"]);
const deshout = (s) =>
  String(s).replace(/\b[A-Z]{2,}\b/g, (w) => (KEEP_CAPS.has(w) ? w : w[0] + w.slice(1).toLowerCase()));
const packNumber = (r) =>
  r.hi === 0
    ? `<span class="hp-zero">None</span>`
    : `<span class="hp-nn">${esc(r.label)}</span><span class="hp-nu">pack${r.hi === 1 && r.lo === 1 ? "" : "s"}</span>`;

// THE PAGE, NOT THE PUBLISHER. Four rows cite three pokemon.com pages, and
// labelling all three "pokemon.com" gives a reader tabbing through three
// identical links. The product title is what differs, so it is the link text,
// with the publisher underneath it.
const sourceLine = (r) => {
  if (!r.sources.length) return "";
  return `<p class="hp-src">${r.sources
    .map((s) => {
      const short = s.title.replace(/^Pokemon (?:Trading Card Game|TCG):?\s*/i, "");
      return `<a href="${esc(s.url)}" rel="noopener nofollow" target="_blank" aria-label="${esc(
        r.name
      )}, source: ${esc(s.title)}, on ${esc(s.publisher)}">${esc(
        short.length > 44 ? `${short.slice(0, 42)}...` : short
      )}<span>${esc(s.publisher)}</span></a>`;
    })
    .join(" ")}${cur.readAt ? `<span class="hp-read">All read ${esc(longDate(cur.readAt))}</span>` : ""}</p>`;
};

const shot = (r) =>
  r.photo
    ? `      <figure class="hp-shot">
        <img src="${esc(r.photo.src)}" srcset="${esc(r.photo.src)} 200w, ${esc(r.photo.large)} 1000w"
             sizes="88px" alt="${esc(r.photo.name)}, sealed" loading="lazy" decoding="async"${imgDims(
        r.photo.src
      )} referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">
        <figcaption>${esc(r.photo.name)}</figcaption>
      </figure>`
    // NOT AN IMG AND NOT A BROKEN ONE. There is no photograph of these products
    // that this site is allowed to publish, so the slot holds the same hatched
    // box /sets/ uses for a set with no logo (.set-noart in ui.css) rather than
    // a grey rectangle that reads as a failed load. It is aria-hidden because
    // the prose under the list already explains the absence once, and ten screen
    // reader announcements of "no photo" is ten interruptions to say nothing.
    : `      <div class="hp-noshot" aria-hidden="true"><span>No photo</span></div>`;

const card = (r) => `    <li class="hp-card"${r.varies ? ' data-varies="1"' : ""}>
${shot(r)}
      <div class="hp-body">
        <h3>${r.openings ? `<a href="${esc(r.openings)}">${esc(r.name)}</a>` : esc(r.name)}</h3>
        <p class="hp-count">${packNumber(r)}${r.varies ? `<span class="hp-var">varies by product</span>` : ""}</p>
        ${
          r.miniPacks
            ? `<p class="hp-line"><b>What it does hold.</b> ${r.miniPacks} mini packs of ${
                r.cardsPerPack || "a few"
              } cards each, which are not booster packs and should never be added to a booster total.</p>`
            : ""
        }
        ${
          r.byProduct
            ? `<ul class="hp-by">${r.byProduct
                .map(
                  (x) =>
                    `<li><b>${x.packs}</b> ${esc(x.product)}${
                      x.released ? ` <span>${esc(longDate(x.released))}</span>` : ""
                    }${x.packsNote ? `<span class="hp-bn">${esc(x.packsNote)}</span>` : ""}${
                      x.extras ? `<span class="hp-bn">Also inside: ${esc(x.extras)}</span>` : ""
                    }</li>`
                )
                .join("")}</ul>`
            : ""
        }
        ${
          // The note is the fuller sentence and usually repeats the number, so
          // printing both gave every row a doubled "10. 10 cards plus 1 Basic
          // Energy." The note wins where there is one, and the notes on the
          // rows with no number are written to stand on their own rather than
          // being prefixed, which produced "Not stated for this product. Not
          // stated on the listing."
          r.cardsNote
            ? `<p class="hp-line"><b>Cards in each pack.</b> ${esc(deshout(r.cardsNote))}</p>`
            : r.cardsPerPack
              ? `<p class="hp-line"><b>Cards in each pack.</b> ${r.cardsPerPack}.</p>`
              : ""
        }
        ${
          // SEMICOLONS, NOT COMMAS. Several of these items contain their own
          // commas ("1 sticker sheet or 1 coin, depending on the release"), and
          // a comma join ran them into one unreadable sentence.
          r.extras.length
            ? `<p class="hp-line"><b>Also in the box.</b> ${r.extras.map((x) => esc(deshout(x))).join("; ")}.</p>`
            : ""
        }
        ${
          r.price
            ? `<p class="hp-line hp-price"><b>${esc(moneyExact(r.price.amount))}</b> at ${esc(
                r.price.retailer
              )}${
                r.packs ? `, which is ${esc(moneyExact(r.price.amount / r.packs))} a pack` : ""
              }. That is a ${esc(r.price.kind)} rather than an MSRP${
                r.price.product ? `, read on ${esc(r.price.product)}` : ""
              }.</p>`
            : r.priceNote
              ? `<p class="hp-line hp-nb">${esc(r.priceNote)}</p>`
              // Said once per row and explained once per section. The full
              // sentence was repeated on sixteen of twenty-three cards, which
              // is a paragraph of boilerplate somebody has to scroll past
              // sixteen times to reach the numbers they came for.
              : `<p class="hp-line hp-nb">No sourced price for this one.</p>`
        }
        ${r.note ? `<p class="hp-line hp-nb"><b>How sure we are.</b> ${esc(r.note)}</p>` : ""}
${sourceLine(r)}
      </div>
    </li>`;

// A single headline number is not the whole truth for the standard tin, whose
// 2025 stock holds five and whose 2026 stock holds four, and the table is the
// half of this page people will screenshot. So a row whose named products
// disagree with its headline count says so in the cell rather than only on the
// card above.
const alsoHeld = (r) => {
  if (!r.byProduct || r.packs === null) return "";
  const other = [...new Set(r.byProduct.map((x) => x.packs))].filter((n) => n !== r.packs).sort((a, b) => a - b);
  if (!other.length) return "";
  // WITH THE YEARS, because "also sold with 5" reads as a choice on the shelf
  // and the truth is a change of date: the 2025 tins hold five and the 2026
  // ones hold four. The years come off the release dates in the data rather
  // than being typed, so a new tin moves them.
  const bits = other.map((n) => {
    const yrs = [...new Set(r.byProduct.filter((x) => x.packs === n).map((x) => String(x.released).slice(0, 4)))];
    return `${n} on ${yrs.sort().join(" and ")} releases`;
  });
  return `<span class="hp-tvar">${bits.join(", ")}</span>`;
};

const tableRow = (r) => `          <tr>
            <th scope="row">${r.openings ? `<a href="${esc(r.openings)}">${esc(r.name)}</a>` : esc(r.name)}${
  r.varies ? `<span class="hp-tvar">varies by product</span>` : alsoHeld(r)
}</th>
            <td class="num"><b>${r.hi === 0 ? "0" : esc(r.label)}</b></td>
            <td class="num">${
              r.cardsPerPack
                ? esc(String(r.cardsPerPack))
                : `<span class="hp-none" aria-hidden="true">not stated</span><span class="sr-only">Cards per pack not stated for this product</span>`
            }</td>
            <td>${
              perPack(r) !== null
                ? `${esc(moneyExact(perPack(r)))} <span class="hp-tsell">${esc(r.price.retailer)}</span>`
                : `<span class="hp-none" aria-hidden="true">no sourced price</span><span class="sr-only">No sourced price for this product</span>`
            }</td>
          </tr>`;

// ---------------------------------------------------------------- meta
//
// Google truncates the snippet around 160 characters and product names are long,
// so this is measured rather than hoped for. Same check build-pack-prices.mjs
// runs, and for the same reason.
const desc =
  `How many packs are in a Pokemon booster box, ETB, bundle, tin or blister. ` +
  `${rows.length} current products, biggest to smallest, with a source on every number.`;
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "How many packs", item: `${SITE}/how-many-packs.html` },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How many packs are in a Pokemon booster box?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Thirty-six, for an English booster display box, and that has held across the Scarlet & Violet and Mega Evolution eras. Two things catch people out: Europe also sells an eighteen-pack half display that gets called a booster box, and a Japanese box is a different product with five-card packs.",
        },
      },
      {
        "@type": "Question",
        name: "How many packs are in an Elite Trainer Box?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Nine, for a main-expansion Elite Trainer Box from the Scarlet & Violet era onward, and eleven for the Pokemon Center version of the same set. That is not a fact about Elite Trainer Boxes in general: the first one held seven, then it was eight for nine years, and most special expansions from Generations to Crown Zenith held ten.",
        },
      },
      {
        "@type": "Question",
        name: "How many cards are in a Pokemon booster pack?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Ten game cards plus one Basic Energy card and a code card, in the current English packs. It has not always been ten. Packs held eleven cards from Base Set to Neo Destiny, then nine from Expedition Base Set in September 2002 through the end of the EX Series, then ten from Diamond & Pearl in May 2007. An EX-era pack is a smaller pack, not a short-packed one.",
        },
      },
    ],
  },
];

const style = `
.hp-lede{max-width:44em}
.hp-key{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:var(--chrome-ink);
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.hp-key h2{color:var(--chrome-ink);margin-bottom:var(--s3)}
.hp-key ol{margin:0 0 0 var(--s4);color:var(--foot-ink);line-height:1.6;max-width:44em}
.hp-key li{margin-bottom:var(--s3)}
.hp-key b{color:var(--mustard)}
.hp-key a{color:var(--mustard)}
/* The code card line sits INSIDE the navy box, so it needs its own colour: the
   box sets #F4F1E2 on itself but the list gets #DDE6EC, and a bare <p> would
   inherit the brighter one and read as another heading. Separated by a hairline
   rather than a margin so it is clearly an aside to the four points above it. */
.hp-code{color:var(--foot-ink);line-height:1.6;max-width:44em;font-size:var(--t-sm);
  margin-top:var(--s4);padding-top:var(--s3);border-top:1px solid rgba(244,241,226,.22)}

/* The illustrated list. One column on a phone, because the whole point is the
   pack number and the picture sitting on one line where they can be compared
   down the page rather than across it. */
/* align-items:start, or grid stretches every card to the height of the tallest
   one in its row. On a two-column desktop layout that put 700px of empty box
   under the booster box card, which sits next to the Ultra-Premium Collection
   and its five named products. */
.hp-list{list-style:none;margin:var(--s5) 0 0;padding:0;display:grid;
  grid-template-columns:repeat(2,1fr);gap:var(--s4);align-items:start}
@media(max-width:900px){.hp-list{grid-template-columns:1fr}}
.hp-card{display:flex;gap:var(--s4);align-items:flex-start;background:var(--card);
  border:3px solid var(--navy);border-radius:12px;padding:var(--s4);box-shadow:var(--hard-lg)}
/* Product photography arrives on a white background, so the tile is white
   rather than the page cream. Same reasoning as .prod-shot on the set guides,
   and the same 88px box, because sizes="88px" is measured against it. */
.hp-shot{flex:none;width:88px;margin:0}
.hp-shot img{width:88px;height:88px;object-fit:contain;display:block;background:#fff;
  border:1px solid var(--hair);border-radius:6px}
.hp-shot figcaption{font:400 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);margin-top:4px}
/* The row with no photograph. Same 88x88 footprint as .hp-shot so the
   headings stay on one line down the column, and the same 45 degree hatch
   .set-noart uses on /sets/ for a set with no logo, which is this site's
   existing way of saying "there is no art for this, on purpose". A plain empty
   box at this size reads as an image that failed to load, which is the one
   thing it must not look like: every one of its neighbours is a real
   photograph now, so it is the only box on the page that is not one. */
.hp-noshot{flex:none;width:88px;height:88px;display:grid;place-items:center;
  border:1px solid var(--hair);border-radius:6px;
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
.hp-noshot span{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);
  letter-spacing:.04em;text-transform:uppercase;background:var(--card);
  padding:3px 5px;border-radius:4px}
.hp-body{min-width:0;flex:1}
.hp-body h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:4px}
.hp-count{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:var(--s3)}
.hp-nn{font:400 var(--t-xl)/1 var(--display);color:var(--ketchup)}
.hp-nu,.hp-var{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.hp-zero{font:400 var(--t-l)/1 var(--display);color:var(--ink-2)}
.hp-line{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.hp-nb{color:var(--ink-2)}
.hp-price b{color:var(--ink)}
.hp-by{list-style:none;margin:var(--s2) 0 0;padding:0;font-size:var(--t-sm);line-height:1.45}
.hp-by li{padding-left:var(--s3);border-left:3px solid var(--gold);margin-bottom:var(--s2)}
.hp-by b{font:400 var(--t-m)/1 var(--display);color:var(--ketchup);margin-right:4px}
.hp-by span{display:block;color:var(--ink-2);font:400 var(--t-micro)/1.4 var(--mono)}
.hp-bn{display:block;color:var(--ink-2);font-size:var(--t-micro);margin-top:2px}
.hp-src{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:flex-end;
  font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);margin-top:var(--s4)}
.hp-src a{display:inline-block;max-width:100%}
.hp-src a span{display:block;color:var(--ink-soft);text-decoration:none}
.hp-read{color:var(--ink-soft)}

/* The at-a-glance table. Four columns and it still needs a scroll container at
   390px: the product names alone are long enough that shrinking to fit wraps
   them to four lines each. It borrows .cc-table wholesale, which already has
   the sticky first column and the edge shadows that say there is more to the
   right. 560px rather than the 660px default, because four columns of short
   values do fit in less. */
.hp-table{min-width:560px}
.cc-table.hp-table thead th{white-space:normal}
.hp-table td.num b{font:400 var(--t-m)/1 var(--display);color:var(--ketchup)}
.hp-tvar,.hp-tsell{display:block;font:400 var(--t-micro)/1.3 var(--mono);color:var(--ink-soft);font-weight:400}
.hp-none{color:var(--ink-soft);font:400 var(--t-micro)/1.3 var(--mono)}

/* The drawn timeline above the history list.
   EVERY COLOUR IN THE FIGURE IS A LITERAL, WHICH IS DELIBERATE. --ketchup and
   --navy are both #111111 since the repaint, so a chart written against the
   tokens draws a black shape on a black shape and nothing errors. The one fill
   is #F5E7BD, the same value as --chip-gold-bg, and it is a TINT rather than a
   second hue: with colour removed the shaded era is still a lighter column and
   the step line still carries the whole argument on its own.
   max-width is 520px to match the drawn figures on /base-set.html. */
/* max-width ON THE FIGURE, not just on the svg, and the first version had only
   the second. The svg caps at 520 and centres, so inside an uncapped figure a
   desktop drew a 520px chart marooned in the middle of a 1,180px white box
   with the caption starting at the far left of it, which is the same "fixed cap
   inside a full-width wrap" fault ui.css's home page block exists to fix. 620
   is what .bs-fig-wide already uses for the drawn figures on /base-set.html. */
.hp-fig{margin:var(--s5) 0 0;background:var(--card);border:1px solid var(--hair);
  border-radius:10px;padding:var(--s4) var(--s4) var(--s3);max-width:620px}
.hp-fig svg{display:block;width:100%;height:auto;max-width:520px;margin-inline:auto}
/* 10 AND 11 UNITS, NOT 9. The svg is 360 units wide and renders at about 326px
   inside the wrap on a 390px phone, so a unit is ~0.9px: 9 units would land at
   8.2 rendered pixels, which is under the line where a label stops being
   readable on a phone. These land at 9.0 and 9.9. */
.hp-fig text{font-family:var(--mono)}
.hp-fnum{font-size:13px;font-weight:700;fill:#111111}
.hp-ftick{font-size:11px;font-weight:400;fill:#5B5B5B}
.hp-fnote{font-size:11px;font-weight:700;fill:#111111}
.hp-fdate{font-size:11px;font-weight:400;fill:#5B5B5B}
.hp-fig figcaption{font-size:var(--t-sm);color:var(--ink-2);line-height:1.5;
  margin-top:var(--s3);max-width:46em}

/* History. A definition-list shape rather than a table: every row here is a
   number, a window of time and a paragraph, and the paragraph is the load
   bearing half. */
.hp-eras{list-style:none;margin:var(--s5) 0 0;padding:0;max-width:52em}
.hp-eras li{border-left:4px solid var(--gold);padding:0 0 0 var(--s4);margin-bottom:var(--s5)}
.hp-eh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}
.hp-eh b{font:400 var(--t-l)/1 var(--display);color:var(--ketchup)}
.hp-eh strong{font:400 var(--t-m)/1.2 var(--display);font-weight:400}
.hp-ew{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.hp-eras p{font-size:var(--t-sm);line-height:1.6}
.hp-tr{display:inline-block;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
/* THE THREE RUNGS READ AS A LADDER, BY WEIGHT, AND NO LONGER BY HUE.
   They used to be a green pill, a mustard pill and a white one, and all three
   were wrong after the site repainted to one accent. The green was the only
   green left anywhere and read as a leftover rather than as a decision. Mustard
   is the site's HIGHLIGHT, so the MIDDLE rung was the loudest chip in the list
   and pulled the eye past the top one. And .low was --card on a --card
   background, 1.00:1, carried entirely by a 1px dashed hairline: the bottom of
   a confidence ladder was invisible.
   So the ladder now descends by fill weight, which a ladder should: solid ink,
   then a filled tint, then an outline. That is legible with no colour vision at
   all, which is the right property for a scale, and it needs no colour outside
   the palette. If the confirmed state ever wants to be green again, it should
   be green everywhere it appears on the site and argued once, not here. */
.hp-tr.ok{background:var(--ink);color:var(--paper-2);border-color:var(--ink)}
.hp-tr.mid{background:var(--paper-3);color:var(--ink);border-color:var(--ink-2)}
.hp-tr.low{background:var(--card);color:var(--ink-2);border-style:dashed;border-color:var(--ink-2)}
.hp-cite{display:flex;flex-wrap:wrap;gap:6px 14px;font:400 var(--t-micro)/1.4 var(--mono);
  color:var(--ink-2);margin-top:8px}
.hp-cite a{display:inline-block}
.hp-cite a span{display:block;color:var(--ink-soft);text-decoration:none}
.hp-two{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4);margin-top:var(--s5)}
@media(max-width:820px){.hp-two{grid-template-columns:1fr}}
.hp-box{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
.hp-box h3{font:400 var(--t-m)/1.2 var(--display);margin-bottom:6px}
.hp-box p{font-size:var(--t-sm);line-height:1.55}
.hp-box p + p{margin-top:var(--s2)}
.hp-gap{border-left:4px solid var(--ketchup);padding-left:var(--s4);margin-top:var(--s5);
  max-width:48em;font-size:var(--t-sm);line-height:1.6;color:var(--ink-2)}
.hp-gap b{color:var(--ink)}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>How Many Packs Are in Each Pokemon Box?</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/how-many-packs.html">
<meta property="og:title" content="How many packs are in each Pokemon box?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/how-many-packs.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-how-many-packs.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-how-many-packs.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Sourced ${esc(longDate(cur.readAt) || "recently")}</span>
    <h1>How many packs are <span class="hl">in there?</span></h1>
    <p class="lede hp-lede">Every current English sealed product, biggest first, with the number of packs inside
      and where that number was read from. It is the half of the price question nothing on this site answered:
      you cannot work out what a pack is costing you until you know how many are in the box.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / How many packs</p>

    <div class="facts">
      <div class="fact"><div class="n">${withNumber.length}</div><div class="l">Products with a sourced pack count</div></div>
      <div class="fact"><div class="n">36</div><div class="l">Packs in a booster display box, the biggest</div></div>
      <div class="fact"><div class="n">10</div><div class="l">Cards in a current pack, plus a Basic Energy</div></div>
      <div class="fact"><div class="n">${
        // Counted as "has more than one sourced figure", which is the thing a
        // buyer needs to know, not just the rows that render a range: the
        // standard tin has a current number AND a different one on last year's
        // stock, and it is the single most likely product to catch somebody out.
        rows.filter((r) => r.varies || (r.byProduct && new Set(r.byProduct.map((x) => x.packs)).size > 1)).length
      }</div><div class="l">Products with more than one sourced pack count</div></div>
    </div>

    <div class="hp-key">
      <h2>Four things to know before you compare anything</h2>
      <ol>
        <li><b>There is no manufacturer price.</b> The Pokemon Company does not publish an MSRP, so every price on
          this page is one shop's or one retailer's price on one day, and it says which. Anybody quoting you "the
          MSRP" is quoting a shelf price.</li>
        <li><b>The name on the box is not the size of the box.</b> An ex Premium Collection holds eight packs and an
          ex Box holds four. A Mini Tin holds two, a Stacking Tin three and a standard tin four. Read the actual
          product name, not the family.</li>
        <li><b>Cards per pack has moved twice, and one of the moves was down.</b> Eleven cards, then nine, then ten.
          The nine-card era ran from September 2002 to 2007, so an EX-era pack is a smaller pack rather than a
          short-packed one. <a href="#history">The whole timeline is below.</a></li>
        <li><b>A 30th Celebration pack is not a ten-card pack.</b> It holds five foil cards plus one foil Basic
          Energy. Its pack <em>counts</em> are normal, so cost per pack still works, which is why this page does cost per
          pack and never cost per card.</li>
      </ol>
      ${/* ONE SENTENCE AND A LINK, not a banner. Everybody reading this page is
            counting packs, and there is a card in every one of those packs this
            page never mentions. Deliberately carries NO NUMBER: /tcg-live.html
            holds the counted figure, and one number in one place is how the two
            pages stay agreed. */ ""}
      <p class="hp-code">Every one of those packs holds one more card that is not a Pokemon card, and it is the
        only one nobody keeps. <a href="/tcg-live.html">What the code card actually gets you.</a></p>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On shelves now</p>
    <h2>Biggest box to <span class="hl">smallest</span> blister</h2>
    <p class="lede" style="max-width:42em">${rows.length} products, ordered by how many packs are inside. Where a
      product line has shipped different counts, the row gives the range and then names each one, because there is
      no single honest number for those. Photos are of a specific set's product and the caption says which.</p>
    <p class="lede" style="max-width:42em">Most rows say "no sourced price". That is not a gap in the research, it is
      the finding: The Pokemon Company publishes no MSRP, and the ${rows.filter((r) => r.price).length} products below
      with a price are the ones a seller actually listed a figure for on the day this was read. A number lifted off a
      comparison site would be a guess about your money, so the rest are left blank.</p>
    <ul class="hp-list">
${rows.map(card).join("\n")}
    </ul>
    <p class="prod-note">Product photos are TCGplayer's, from the nightly price pull${
      productsChecked ? ` read ${esc(longDate(productsChecked))}` : ""
    }. We are not a shop and we do not sell any of this. There is no in-house photography, so a photo only exists
      here where TCGplayer lists the exact product the count on that row was read off, and the pictured box's own
      pack count is the number beside it. Most come out of the per-set price pull. The ones sold outside any
      expansion, like the tins and the calendar, and the ones whose set listing is a different box from the one the
      research read, are each pinned by hand instead.${
        // Counted and named, not typed. A photo can appear or disappear without
        // anybody editing this sentence, and naming the row is what stops the
        // count going stale while still reading as a sentence.
        (() => {
          const gaps = rows.filter((r) => !r.photo);
          if (!gaps.length) return " Every row has one.";
          const names = gaps.map((r) => r.name);
          const list =
            names.length === 1
              ? names[0]
              : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
          return ` ${gaps.length} of the ${rows.length} rows ${
            gaps.length === 1 ? "has a hatched box" : "have a hatched box"
          } instead, ${esc(list)}: TCGplayer lists ${
            gaps.length === 1 ? "it" : "them"
          } across several years and publishes no release date, so picking one would put a photograph of an
          unknown number beside a sourced one.`;
        })()
      }</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>All of it on one screen</p>
    <h2>The whole list, <span class="hl">no pictures</span></h2>
    <p class="lede" style="max-width:42em">The same products in the same order, for scanning. The last column is the
      sourced price divided by the sourced pack count, and it is only filled in where both halves were actually read
      off a seller's page. Different sellers, same day, so it compares products rather than shops.</p>
    <div class="cc-scroll" tabindex="0" role="region" aria-label="Packs per sealed product, scrollable table">
      <table class="cc-table hp-table">
        <caption class="sr-only">Packs inside each current sealed Pokemon product, biggest first</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col" class="num">Packs</th>
            <th scope="col" class="num">Cards per pack</th>
            <th scope="col">Cost per pack</th>
          </tr>
        </thead>
        <tbody>
${rows.map(tableRow).join("\n")}
        </tbody>
      </table>
    </div>
    <p class="price-note">Prices read ${esc(longDate(cur.readAt))} from Pokemon Center, Target, GameStop and the
      official product pages, each named on the card above. They are shelf prices on one day and not an MSRP,
      because no MSRP exists. What packs are actually selling for right now, per set, is on
      <a href="/pack-prices.html">pack prices</a>, which is recomputed from the market every night.</p>

${
  priced.length
    ? `    <p class="lede" style="max-width:42em;margin-top:var(--s5)">Ordered by cost per pack, the ${priced.length}
      products where both numbers are sourced run from ${esc(moneyExact(perPack(priced[0])))} in the
      ${esc(priced[0].name.toLowerCase())} to ${esc(moneyExact(perPack(priced[priced.length - 1])))} for
      ${esc(priced[priced.length - 1].name.toLowerCase())}. That is the comparison this page is for, and it is the
      whole of it: nothing here says what is inside the packs, because nobody publishes that.</p>`
    : ""
}
  </div>
</section>

<section class="band tight" id="etb">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The one everybody asks</p>
    <h2>How many packs in an <span class="hl">Elite Trainer Box</span>?</h2>
    <p class="lede" style="max-width:42em">Nine, if it is a main expansion from the Scarlet & Violet era onward,
      which is everything currently on a shelf. Eleven if it is the Pokemon Center version of the same set. That is
      the answer, and the reason it needs a sentence of scope rather than a number on its own is that Elite Trainer
      Boxes have held ${
        // Counted off the rows below rather than written down, because a number
        // in a sentence about how numbers change is the first thing to go stale.
        new Set(ETB.map((e) => e.n).filter((n) => /^\d+$/.test(n))).size
      } different counts, plus one product that held two kinds of pack at once.</p>
    <ul class="hp-eras">
${ETB.map(
  (e) => `      <li>
        <p class="hp-eh"><b>${esc(e.n)}</b> <strong>${esc(e.when)}</strong> ${trust(e.trust)}</p>
        <p>${esc(e.what)}</p>
        ${cite(...e.ids)}
      </li>`
).join("\n")}
    </ul>
    <p class="hp-gap"><b>Why this page says it and the others do not.</b> The pack counts printed next to products
      elsewhere on this site come from a per-kind label written once in our own sync script, not from any particular
      box, which is why <a href="/openings/etb.html">the Elite Trainer Box page</a> has always refused to state a
      count for a named set and told you to check the box instead. That was the right call with nothing sourced
      behind it. This page is where the sourced version lives, so it is the one that gives the number and the years
      it applies to.</p>
  </div>
</section>

<section class="tight" id="history">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The historical bit</p>
    <h2>How many cards were in a pack, <span class="hl">by era</span></h2>
    <p class="lede" style="max-width:42em">The single most useful thing on this page if you are holding older sealed
      product, and the one most often got wrong. It did not go from eleven straight to ten. There is a nine-card era
      in the middle and it lasted nearly five years.</p>
    ${eraChart(new Date())}
    <ul class="hp-eras">
${ERAS.map(
  (e) => `      <li>
        <p class="hp-eh"><b>${esc(e.cards)}</b> <strong>${esc(e.era)}</strong> <span class="hp-ew">${esc(
    e.when
  )}</span> ${trust(e.trust)}</p>
        <p>${esc(e.what)}</p>
        ${cite(...e.ids)}
      </li>`
).join("\n")}
    </ul>
    <p class="hp-gap"><b>Why the same pack gets called ten, eleven or twelve.</b> Since Sun & Moon a pack has held
      ten game cards, a Basic Energy card and a code card. Sources that count the extras arrive at eleven or twelve
      for the same object. Our sources disagree with each other on exactly this point, so this page uses the ten and
      lists the extras separately rather than picking a side.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Same name, different box</p>
    <h2>The <span class="hl">regional</span> and channel traps</h2>
    <p class="lede" style="max-width:42em">Every one of these is the same product name holding a different number of
      packs. If you are buying from overseas, or comparing a listing photo to a shelf, these are the ones that cost
      money.</p>
    <ul class="hp-eras">
${REGIONAL.map(
  (t) => `      <li>
        <p class="hp-eh"><strong>${esc(t.trap)}</strong> ${trust(t.trust)}</p>
        <p>${esc(t.detail)}</p>
        ${cite(...t.ids)}
      </li>`
).join("\n")}
    </ul>
    <p class="hp-gap"><b>The Japanese box count is deliberately missing.</b> Everybody repeats thirty packs a box.
      We could only find it on card-shop blogs and marketplace listings, several of which also publish per-box
      rarity guarantees that this site will not repeat, and the official Japanese page confirms the pack <em>size</em>
      without the box count. So this page states the five-card pack, which is official, and leaves the box out.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Products that changed or went away</p>
    <h2>What older sealed product <span class="hl">actually held</span></h2>
    <p class="lede" style="max-width:42em">Everything in this section before 2020 rests on Bulbapedia's era
      merchandise pages, which are marked as such row by row. That is often the only record there is, so the
      alternative is not a better source, it is no page.</p>
    <ul class="hp-eras">
${OLD.map(
  (o) => `      <li>
        <p class="hp-eh"><strong>${esc(o.what)}</strong> ${trust(o.trust)}</p>
        <p>${esc(o.detail)}</p>
        ${cite(...o.ids)}
      </li>`
).join("\n")}
    </ul>

    <div class="hp-two">
      <div class="hp-box">
        <h3>The 2025 story that was wrong</h3>
        <p>In July 2025 the fine print on a Mega Evolution booster box was reported as saying packs would contain
          either an Energy card or a code card rather than both, which was read as a card being removed. On
          1 August 2025 The Pokemon Company said the packaging text was an error and that packs would continue to
          include both.</p>
        <p>It is here rather than left out because printed boxes carrying the incorrect text physically exist, so
          you can read the wrong thing off the product in your own hands. The current official expansion pages still
          say ten cards and one Basic Energy.</p>
        ${cite("S20")}
      </div>
      <div class="hp-box">
        <h3>What we could not source, and did not print</h3>
        <p>How many packs were in a 1999 to 2002 booster box. When thirty-six became the standard. When the two-pack
          blister ended. When Theme Decks ended and what replaced them. What was in the Base Set 2-Player Starter
          Set. When the Trainer Kit line ended. How many packs are in a Japanese booster box.</p>
        <p>Every one of those has a confident answer somewhere on the internet. None of them had a source we could
          read, so none of them is on this page. That is the whole rule here and it is worth more than the
          missing lines.</p>
      </div>
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What this page will not tell you</p>
    <h2>Packs are counted. What is <span class="hl">in</span> them is not.</h2>
    <ul class="facts-list">
      <li><strong>Whether any of it is worth buying.</strong> That needs pull rates, and The Pokemon Company does
        not publish them, so nobody quoting you one has them either. What this channel has instead is
        <a href="/luck.html">what actually came out of the packs we opened</a>, which is observed results and a
        different thing.</li>
      <li><strong>What it costs today.</strong> The prices here were read on one day off four sellers.
        <a href="/pack-prices.html">Pack prices</a> divides live market prices by pack count for every set we track
        and is recomputed nightly.</li>
      <li><strong>What is in the box besides packs.</strong> Sleeves, dice, promos, playmats and coins are listed
        where the product page listed them, and nothing on this page puts a value on any of it.</li>
      ${/* THIS BULLET NAMED NO PAGE THAT ANSWERS IT UNTIL /what-to-buy.html EXISTED,
            which made it a refusal rather than a handover: it told a reader the
            question was reasonable, said this page would not answer it, and left
            them there. That page answers it by situation, prices every
            recommendation against data/msrp.json and links back here for the
            counts, so the two do not overlap. The "cheapest per pack is not
            best" sentence stays, because it is still the trap. */ ""}
      <li><strong>Which one to buy.</strong> Cheapest per pack is not best. This is a list of what is inside things.
        <a href="/what-to-buy.html">What to actually buy</a> answers it by who it is for and what it should cost,
        and <a href="/openings/">every kind of sealed product opened on camera</a> is the closest thing to a second
        opinion we can honestly offer.</li>
    </ul>
    <p class="price-note">Pack counts were read from pokemon.com product gallery pages, Pokemon Center, Target and
      GameStop listings on ${esc(longDate(cur.readAt))}, and the historical section from Bulbapedia, Bulbanews and
      the official expansion pages at tcg.pokemon.com and pokemon-card.com on ${esc(longDate(hist.readAt))}. Every
      row links its own sources and says how strong they are. Where a number could not be traced to a source it is
      absent and the page says so, which is why several rows read "not stated" rather than carrying a plausible
      figure. Nothing here states or implies how likely any card is to appear in any pack.</p>
  </div>
</section>

</main>
${footer("Pack counts are printed on the packaging, so they are checkable. Odds are not published by anybody.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/how-many-packs.html"), page);
console.log(`Wrote public/how-many-packs.html
  ${rows.length} products, ${withNumber.length} with a pack count, ${noPacks.length} with none at all
  ${rows.filter((r) => r.photo).length} carry a product photo, ${priced.length} carry a cost per pack
  ${ERAS.length} cards-per-pack eras, ${ETB.length} Elite Trainer Box counts, ${REGIONAL.length} regional traps`);
