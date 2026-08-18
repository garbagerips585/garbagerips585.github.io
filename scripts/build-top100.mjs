#!/usr/bin/env node
// Two ranked lists: /most-valuable-cards.html and /most-expensive-sealed.html
//
//   node scripts/build-top100.mjs
//
// THE TWO PAGES NOW READ DIFFERENT SOURCES, which is the first thing to know
// before editing anything below:
//
//   cards   data/top-raw.json, PriceCharting's UNGRADED price guide value,
//           written by scripts/sync-raw-top.mjs off the cached crawl and
//           stamped by scripts/verify-raw-top.mjs.
//   sealed  data/top100.json, TCGplayer's MARKET PRICE, written by
//           scripts/sync-top100.mjs.
//
// Both syncs are network jobs and neither is in build-all.mjs, the same
// arrangement sync-sets.mjs and sync-chase.mjs have. This builder is, and it
// works from whatever the last sync left on disk, so a build with no network
// reprints the last lists with the date they were actually read on them.
//
// ---------------------------------------------------------------------------
// WHY THE CARDS PAGE MOVED TO PRICECHARTING, 18 AUGUST 2026
// ---------------------------------------------------------------------------
//
// Tim: "lets get all raw prices and all graded prices from pricecharting across
// the site all pages", and then, asked what to do about sealed: "use price
// charting for everything if they have data for everything, if they dont have
// data for sealed just use tcg player for that, but pricecharting seems to be
// most trusted pricing online".
//
// The set guides, the Pokedex pages and the checklists moved first, in
// scripts/sync-pricecharting-cards.mjs. This page was the last raw price on the
// site still coming from TCGplayer, and leaving it there meant the site's most
// prominent list of card values disagreed with every set guide it linked to.
//
// SEALED STAYS ON TCGPLAYER AND IT IS NOT A HALF MEASURE. The crawl behind the
// PriceCharting figures ran with `exclude-hardware=true`, which is how that site
// drops sealed product, so the cache holds essentially no boxes: 144
// sealed-looking rows across 89,910, most of them mis-hits on card names like
// "Iron Bundle". There is no top 100 of sealed product in it to publish, and
// re-crawling 793 consoles without that filter to chase one is not a trade
// worth making against somebody else's bandwidth. So the sealed page keeps
// TCGplayer, says so in its own title, and this is the arrangement Tim asked
// for in as many words.
//
// ---------------------------------------------------------------------------
// THE PAGE CHANGED WHAT IT IS, AND THAT IS AN EDITORIAL DECISION, NOT A SWAP
// ---------------------------------------------------------------------------
//
// THIS FILE USED TO ARGUE THE OPPOSITE OF WHAT IT NOW DOES. The paragraph that
// stood here said:
//
//     JAPANESE CARDS. `productLineName: pokemon` is the English catalogue.
//     Japanese is a separate product line on the same site and is not ranked
//     here.
//
// That was true of TCGplayer, whose catalogue really is split by language, and
// the page was English-only BECAUSE THE FEED WAS. PriceCharting does not split
// its Pokemon catalogue at all, so switching sources without deciding this
// would have quietly turned an English list into a mostly Japanese one and left
// the old sentence sitting on the page saying it had not. That is exactly the
// silent change CLAUDE.md spends four paragraphs complaining about, so here is
// the decision and the argument, made in the same edit as the change.
//
// THE PAGE NOW RANKS EVERY LANGUAGE, AND THAT IS TIM'S DECISION RATHER THAN
// THIS FILE'S. Asked the question directly on 18 August 2026, in conversation,
// he answered: "yes lets add in all forgein cards into the top value cards so
// its an all incusive list". The argument below is recorded because the file
// argued the opposite at length and a reversal with no reasoning behind it is
// worth nothing to the next person, but the call was made by the person whose
// site it is. Measured on the published hundred: 50 rows are Japanese, 2 are
// Chinese and 48 are English or unmarked.
//
// "ALL INCLUSIVE" IS ABOUT LANGUAGE AND NOTHING ELSE. It does not license the
// title people search for. These are still one price guide's ungraded values,
// read on one day, and they still cannot see auction or private sales, so the
// page is titled for what the data is and the honesty block still lists what
// the ranking cannot see. Widening the scope widens the list, not the claim.
//
// THE CASE FOR IT. Somebody typing "most valuable Pokemon cards" is not asking
// a question about a marketplace's catalogue structure. The Illustrator Pikachu
// is the answer to that question by any measure anybody outside a price feed
// would use, and a list that omits it because of how one American marketplace
// files its inventory is answering an easier question and hoping nobody
// notices. This site already publishes an all-language PriceCharting ranking at
// /top-graded.html, whose number one is the same card, so an English-only raw
// list would have contradicted the graded list one nav item away.
//
// THE CASE AGAINST, because it is real. Half this list is cards a viewer in
// Rochester will never see in a local shop and cannot buy without an importer,
// and the rest of this site is about English product: what to open, what a pack
// costs, which set to chase. A reader who came from /pack-prices.html now meets
// a list where the top three are Japanese promos. The mitigation is that the
// page SAYS SO, in the kicker, in the honesty block and in a fact tile, rather
// than letting somebody work it out.
//
// AND IT SAYS SO ROW BY ROW TOO, without a new chip or badge, because
// PriceCharting's own set names carry the region: every one of the 52
// non-English rows sits in a set called "Japanese Promo", "Chinese 151
// Collect", "Korean Promo" and so on. CHECKED RATHER THAN ASSUMED: the count
// of rows whose set name begins with a language is exactly the count of
// non-English rows, so no row is foreign without saying it. The set is painted
// on every row at every width, under the name on a phone and in its own column
// from 760px up, so a reader meeting Illustrator Pikachu at number one is told
// it is a Japanese promo in the same glance. A separate language flag would be
// a second copy of a fact already on the row.
//
// IF A LATER EDITOR WANTS THE ENGLISH-ONLY LIST BACK, that is a real argument
// and not a silly one. The way to do it is a filter on the console name in
// sync-raw-top.mjs, with the count of what it removes printed on the page, and
// this paragraph rewritten to say which way it went and why. What is not on the
// table is filtering quietly and leaving these paragraphs in place.
//
// TOPPS IS THE OTHER SURPRISE AND IT IS KEPT FOR THE SAME REASON. Thirteen of
// the hundred are Topps' 2000 Pokemon chrome and movie cards, which are trading
// cards of Pokemon rather than Pokemon TCG cards you could play with.
// PriceCharting files them under Pokemon and prices them there. They are kept,
// and the honesty block names them, because dropping them would be editing the
// answer to suit the question. The kicker says "Pokemon cards" rather than
// "Pokemon TCG" for exactly that reason.
//
// SEALED PRODUCT IS THE ONE THING REMOVED BY HAND, and it is removed because
// the page's own title says "cards". `exclude-hardware=true` let twelve sealed
// products through inside the ranking window and eight of them were dear enough
// to make the hundred, including a $26,347 Japanese Special Box at what would
// have been number four. The verdicts are one by one, by product id, in
// sync-raw-top.mjs, the dropped rows are kept in the data, and the page names
// them and says how many. See that file's header for why the list is written by
// hand rather than by regex alone.
//
// ---------------------------------------------------------------------------
// THE TITLE IS THE HONEST ONE, NOT THE ONE PEOPLE SEARCH FOR
// ---------------------------------------------------------------------------
//
// "The 100 most valuable Pokemon cards ever" is the phrase with the traffic and
// it is a claim this data cannot support, so it is not written anywhere on
// either page. What we hold is one price guide's ungraded value and one
// marketplace's Market Price, each read on one day. So the pages say that:
//
//   The 100 most valuable RAW Pokemon cards in PriceCharting's price guide
//   The 100 most expensive SEALED Pokemon products on TCGplayer
//
// with the date in the subtitle and in a fact tile, and a block near the top
// that lists what the number is not. What the RAW page excludes, and each one
// would change the ranking:
//
//   GRADED CARDS ARE NOT WHAT IS RANKED. The Grade 9 and PSA 10 values sit
//   beside every raw price on the page, because they come off the same row of
//   the same source and hiding them would be pretending the raw price is the
//   whole story. The ORDER is the ungraded column and nothing else, and
//   /top-graded.html is the list ranked the other way.
//   AUCTION AND PRIVATE SALES. The million dollar figures people mean by "most
//   valuable" are single hammer prices at Heritage, Goldin and PWCC. A guide
//   value is a computed estimate across many sales and it is a different kind
//   of fact. The Illustrator Pikachu at number one has a widely reported 2022
//   sale of about $5.3m against the guide value printed here.
//   SEALED PRODUCT. Removed by hand, named on the page, argued above.
//   JAPANESE CARDS ARE NO LONGER EXCLUDED, and the block says so out loud
//   rather than leaving the old sentence to rot.
//
// ---------------------------------------------------------------------------
// THE ONE OUTBOUND LINK PER ROW, ARGUED HERE RATHER THAN ADDED QUIETLY
// ---------------------------------------------------------------------------
//
// CLAUDE.md's rule is that every click stays on the site, with four documented
// exceptions, and it says the playlist cards became an exception by being made
// quietly rather than argued. So: these pages add a SIXTH, and this is the
// argument.
//
// Each row carries one small link to that product's own page at the source the
// row is priced from, in the price cell, reading "check on PriceCharting" or
// "check on TCGplayer" with an aria-label saying it opens there. THE LINK
// FOLLOWS THE PRICE and that is the condition of the exception, not a detail:
// the argument for it is that the number is checkable, so a row priced by
// PriceCharting pointing at TCGplayer would be a citation to a page that does
// not hold the figure printed beside it. Which is worse than no link at all.
//
// The case for it is not commercial and there is no affiliate code in it. It is
// that these two pages consist of two hundred numbers, and the whole reason
// they are allowed to exist is that every one of those numbers can be traced to
// a source. A page that boasts about checkability and then gives the reader no
// way to check is worse than one that never made the claim. The link IS the
// citation. Removing it does not keep anybody on the site, it just makes two
// hundred figures unverifiable.
//
// NOTE THE DISAGREEMENT WITH /top-graded.html, which prints the PriceCharting
// PATH on every row as plain text and links nothing, and says in
// build-top-graded.mjs that 100 outbound links would be the largest exception
// on the site. That was written before this pair of pages existed and the count
// it worried about is now live and documented in CLAUDE.md. The two pages are
// therefore inconsistent with each other, deliberately noted here rather than
// tidied away in passing: either that page gains links or these lose them, and
// it is a call for Tim rather than for whoever is next in this file.
//
// The case against is the count: two hundred outbound links is more than the
// whole rest of the site holds, and that is a real objection rather than a
// formality.
//
// THE SHAPE IS THE MITIGATION AND IT IS THE CONDITION OF THE EXCEPTION, exactly
// as it is for /how-to-play.html and the two app pages:
//
//   - The BIG tap target on every row, the rank, the picture, the name and the
//     set, is an INTERNAL link and always has been. Nobody leaves by tapping
//     the obvious thing. The outbound link is a small labelled chip in the
//     price cell and nothing else on the row points off site.
//   - It is labelled in visible text and in an aria-label, like every other
//     documented exception.
//   - There is no affiliate tag, no referral parameter and no revenue. The
//     honest description is a footnote pointing at a source.
//
// If a later editor disagrees, the fix is to drop the per-row chip and put ONE
// link at the foot of the page to TCGplayer's Pokemon catalogue, not to spread
// more of them through the rows.
//
// ---------------------------------------------------------------------------
// WHERE THE INTERNAL LINK GOES, AND WHY IT IS THREE RULES DEEP
// ---------------------------------------------------------------------------
//
// The site's rule is that clicks stay here, so every row needs somewhere here
// to go. Measured against the real data on 18 Aug 2026, after the cards page
// moved to PriceCharting:
//
//   raw cards    4 of 100 belong to a set this site has a guide for, matched on
//                the PriceCharting CONSOLE in the row's own url rather than on
//                the set name, because "Scarlet & Violet" and "Scarlet & Violet
//                151" are two consoles a name match would confuse. The rest are
//                vintage, Japanese promo or Topps.
//                64 of 100 name a Pokemon that has a page under /pokemon/.
//                The remaining 32 fall through to /search.html?q=<name>, which
//                is the site's own search and finds the card, the set or the
//                rip that pulled one. The Pokemon share went UP with the source
//                change, from 45 to 64, because PriceCharting titles lead with
//                the Pokemon far more often than TCGplayer's do.
//   sealed       42 of 100 map to a set guide. The rest go to
//                /how-many-packs.html, which is the page about what is inside a
//                sealed product and how many packs it holds, and is the actual
//                next question somebody asks about an $11,900 display case.
//
// ALL FOUR OF THE SET GUIDE ROWS ARE SPECIAL PRINTINGS, AND THE GUIDE PRICES
// THE SET CARD AT A FRACTION OF WHAT THIS PAGE SAYS. That is not a
// contradiction and it is worth knowing before somebody "fixes" it. The rows
// are Voltorb [Cosmos Professor Program] #100 at $8,500, Mew Ex [Ultra Ball
// League] #151 at $7,760, Voltorb [Professor Program] #100 at $2,300 and Budew
// [Premier Ball League Judge] #4 at $2,713. /sets/151.html prices Voltorb #100
// at $0.63, because sync-pricecharting-cards.mjs deliberately prices ONLY the
// three standard printings a checklist is about: taking the dearest product at
// a collector number made a bulk Bulbasaur $40.30 off a stamped promo, and its
// header records that. A league promo and the set card share a number and are
// different products, which is exactly what the bracketed part of the name on
// this page says. The row still goes to the set guide because that is the page
// about where the card comes from, and the name it is labelled with is the
// printing, not the checklist row.
//
// The Pokemon match is a WORD BOUNDARY match against the longest name first, so
// "Mewtwo" cannot be swallowed by "Mew" and "Rocket's Mewtwo ex" still lands on
// the Mewtwo page. It is anchored at the start of the product name, because a
// card named "Mega Tokyo's Pikachu" is a Pikachu card and a card whose name
// merely mentions a Pokemon halfway through usually is not.
//
// ---------------------------------------------------------------------------
// PICTURES: 100 PER PAGE, AND THE HOST WAS CHOSEN BY MEASUREMENT
// ---------------------------------------------------------------------------
//
// CLAUDE.md's rule is to check the host before adding an image, because one
// Scrydex PNG was 1,100,908 bytes where the TCGdex AVIF of the same card was
// 26,529. So both were measured for this box rather than assumed, and the
// answer here is the opposite of the set guides':
//
//   tcgplayer-cdn  _150w.jpg   150x206..214, 12.0 to 19.3KB   <- sealed page
//   tcgplayer-cdn  _200w.jpg   200x274..286, 19.1 to 30.8KB
//   assets.tcgdex  low.avif    245x337, around 20KB, and only for cards
//   pricecharting  /240.jpg    240 high, variable wide, 8.0 to 17.6KB
//                                                        <- cards page
//
// EACH PAGE TAKES ITS PICTURE FROM THE SOURCE THAT PRICED IT, and that is the
// same rule as the outbound link rather than a coincidence. The image is
// addressed by the same product record the price came from, so a row cannot
// show one card's picture beside another card's price. Reaching TCGdex for the
// cards page would need a hand-built mapping from vintage and Japanese set
// names to TCGdex set ids, and data/graded.json already records what name-only
// lookups cost here: 4 of 12 landed on a different printing of the right card.
// Half this list is 1st Edition, Gold Star and Japanese promo printings, which
// is precisely where that goes wrong, and a picture of the wrong printing
// beside a $585,600 figure is a worse page than a plainer scan.
//
// THE PRICECHARTING RENDITION IS THE ONE /top-graded.html ALREADY USES, /240.jpg,
// and its existence is CHECKED rather than assumed: verify-raw-top.mjs HEADs
// every one of them on every run and reports any that 404. On the published
// hundred, 0 missing, 12.8KB average, 17.6KB largest.
//
// THE SMALLER TCGPLAYER RENDITIONS DO NOT EXIST. _50w, _100w and _120w all
// answer 403, checked against five product ids. _150w is the floor. The
// PriceCharting listing thumbnail is /60.jpg, which is 60 pixels HIGH and far
// too small for a box that paints 99px tall at DPR 2.
//
// NO WIDTH OR HEIGHT ATTRIBUTES ON EITHER HOST, and that is deliberate rather
// than an oversight: tcgplayer-cdn's renditions are a fixed width and a
// VARIABLE height, 206 to 214px at 150w, and PriceCharting's are a fixed height
// and a variable width, 169 to 174px at 240. Which is why imgDims() in
// shared/format.mjs returns "" for both hosts. The box reserves the space in
// CSS instead. avifPicture() also declines both, correctly: there is no AVIF at
// either to offer.
//
// LAZY IS RIGHT HERE AND THE CAROUSEL TRAP DOES NOT APPLY. `loading="lazy"` is
// a VERTICAL heuristic, which is why it fails on the home page's horizontal
// slide tracks. These are 100-row vertical lists, so the browser's measure is
// the right one and rows below the fold genuinely do not fetch. What that
// means, and the page weight section of the report says both numbers rather
// than the flattering one, is that a reader who scrolls to row 100 pays for all
// hundred pictures. That is the honest figure for a list page.
//
// data/no-scan.json records two dead TCGplayer product ids. They are skipped
// up front rather than fetched to find out, and neither is in the sealed list
// today, which is checked rather than assumed. OTHER IDS IN THAT LIST ARE DEAD
// and are found by sync-top100.mjs, which fetches every image url on each run.
// A flagged row emits no <img> at all rather than an <img> plus an onerror, so
// the page never spends the round trip. The cards page gets the same treatment
// from a different file: verify-raw-top.mjs records `imgOk` per row and a row
// without one emits the empty frame instead.
//
// ---------------------------------------------------------------------------
// WEIGHT, RE-MEASURED 18 Aug 2026 AFTER THE SOURCE CHANGE, BOTH NUMBERS RATHER
// THAN THE FLATTERING ONE
// ---------------------------------------------------------------------------
//
// Headless Chrome over CDP, cache off, the viewport override applied and then
// ASSERTED before anything is believed, scrolled to the bottom with lazy
// loading allowed to run. .claude/server.js sends no Content-Encoding, so the
// gzipped column re-totals every local html, css and js at gzip -9 and leaves
// the images and woff2 alone, which is what GitHub Pages actually serves.
//
//                              on-load                fully scrolled
//                          raw        gzip          raw        gzip
//   cards   390x844 DPR2   393.3KB    137.4KB     1,653.7KB   1,397.8KB
//   cards  1440x900 DPR2   393.3KB    137.4KB     1,654.6KB   1,398.7KB
//   sealed  390x844 DPR2   368.1KB    132.2KB     1,199.3KB     963.4KB
//   sealed 1440x900 DPR2   434.7KB    198.7KB     1,199.5KB     963.5KB
//
// THE CARDS PAGE GOT LIGHTER AND TALLER. Lighter because PriceCharting's scans
// average 12.8KB against TCGplayer's 15.7KB: 1,679.1KB gzipped fully scrolled
// before, 1,397.8KB now. Taller because every row gained a line of graded
// figures on a phone: 17,491px to 20,742px at 390x844, which is 3,251px of
// extra scrolling for two more facts per row. That is the trade and it is
// stated rather than buried. Desktop is 16,748px, where the same two figures
// cost nothing at all because they went into columns that were already there.
//
// QUOTE THE PAIR OR QUOTE NEITHER, the same rule CLAUDE.md sets for
// rarity.html. The first is what a reader waits for and it is fine. The second
// is what a hundred pictures cost somebody who reaches row 100, and there is no
// version of this page that shows 100 cards and does not pay it. The cards
// page's two on-load figures are the same because the same 16 or so scans fall
// inside Chrome's lazy-loading distance at both widths, one page being taller
// per row and the other wider; the sealed page, whose rows are a different
// height again, does show the usual desktop-loads-more pattern.
//
// No single image is over 200KB, which is a site-wide invariant: the largest on
// either page is 24.4KB.

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
import { TCG_SET } from "../shared/tcgplayer.mjs";
import { esc, longDate, moneyExact, moneyCompact, noValue } from "../shared/format.mjs";
// THE PUBLICATION GATE ON THE PRICECHARTING FILE, shared with /top-graded.html
// and /base-set.html. Nothing out of that file may be printed on a single read:
// `new_price` means PSA 10 on a listing page and Grade 8 on a product page, a
// 21x error on Base Set Charizard that looks like a reasonable price. Read that
// file before relaxing anything here.
import { gradedGate } from "../shared/graded-gate.mjs";
import { PC_CONSOLES } from "../shared/pricecharting.mjs";
// THE CASE STAND-IN RULE. TCGplayer photographs what a collector buys, so it
// carries no picture of a CASE at all, and every unphotographed row on the
// sealed page is one. That module reads the inner product out of the row's own
// name and hands back its photograph; this file is where the caption naming it
// gets written, because a stand-in nobody labels is a photograph claiming to be
// something it is not. Read its header before touching either half.
import { caseStandIn, standInIndex } from "../shared/case-standin.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// SEALED, from TCGplayer. Cards no longer come out of this file; its `cards`
// half is still written by sync-top100.mjs and is still what shared/price-basis
// .mjs reads to explain the gap between a market price and a guide value on
// /base-set.html.
const top = JSON.parse(await readFile(join(ROOT, "data/top100.json"), "utf8"));

// CARDS, from PriceCharting. Gated: no verify block, or a verify block stamped
// for a different crawl, or a disagreeing row with no recorded reason, and this
// build stops rather than printing a figure that was only read once.
const rawFile = JSON.parse(await readFile(join(ROOT, "data/top-raw.json"), "utf8"));
const { verified: rawOk } = gradedGate(
  rawFile,
  "data/top-raw.json",
  "scripts/verify-raw-top.mjs",
);

// ---------------------------------------------------------------------------
// THE PUBLISHED HUNDRED, ASSEMBLED HERE RATHER THAN IN THE PAGE LOOP
// ---------------------------------------------------------------------------
//
// A row is published only if its RANKING column was read twice and agreed. A
// row that failed is not printed and not renumbered around: the ranks are the
// positions in the published list, 1 to 100 with no gaps, and how many
// candidates were dropped and why is said in words above the list. That is the
// same call /top-graded.html makes, and the alternative, printing the source
// file's own rank with visible gaps, would claim to be a top 100 of something
// while showing 96 rows.
//
// THE TWO GRADED FIGURES ARE GATED SEPARATELY from the row itself. A card whose
// ungraded figure was confirmed and whose PSA 10 figure was not is still a row
// worth printing; what it must not do is print the PSA 10. So each carries its
// own reason string and the row prints the reason instead of the figure.
const rawSay = {
  none: (label) => `No ${label} value recorded for this card`,
  onesided: (label) =>
    `Only one of our two reads found a ${label} value for this card, so none is published`,
  disagree: (label) => `Our two reads of this card's ${label} value did not agree, so neither is published`,
  unreadable: (label) => `We could not read a ${label} value for this card a second time, so none is published`,
};
const rawCol = (c, key, label) => {
  const v = rawOk.get(c.rank)?.cols?.[key];
  const status = v?.status || "unreadable";
  return status === "agree"
    ? { value: c[key], why: "" }
    : { value: null, why: (rawSay[status] || rawSay.unreadable)(label) };
};

const rawPublished = rawFile.cards.filter((c) => rawOk.get(c.rank)?.status === "agree").slice(0, 100);
const RAW = {
  checked: rawFile.checked,
  scanned: rawFile.scanned,
  sourceMethodology: rawFile.sourceMethodology,
  verify: rawFile.verify,
  excluded: rawFile.excluded,
  notCards: rawFile.notCards,
  items: rawPublished.map((c, i) => {
    const g9 = rawCol(c, "g9", "Grade 9");
    const psa10 = rawCol(c, "psa10", "PSA 10");
    return {
      rank: i + 1,
      name: c.name,
      setName: c.set,
      price: c.ungraded,
      g9: g9.value,
      g9Why: g9.why,
      psa10: psa10.value,
      psa10Why: psa10.why,
      url: c.url,
      // The listing thumbnail is 60 pixels high. This is the same file at the
      // size the box actually paints, which is the rendition /top-graded.html
      // uses and the one verify-raw-top.mjs HEADs on every run.
      img: c.pcImg ? c.pcImg.replace(/\/\d+\.jpg$/, "/240.jpg") : null,
      noImg: rawOk.get(c.rank)?.imgOk !== true,
      // Where it sat before the rows that failed their second read were taken
      // out. Not printed; kept so the log can say when the two differ.
      sourceRank: c.rank,
    };
  }),
};

let noScan = { deadUrls: [] };
try {
  noScan = JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8"));
} catch {
  /* optional */
}
// The dead ids, reduced to the product number so any rendition of them is
// skipped rather than only the exact url that was recorded.
const DEAD = new Set(
  (noScan.deadUrls || [])
    .map((u) => /tcgplayer-cdn\.tcgplayer\.com\/product\/(\d+)/.exec(String(u))?.[1])
    .filter(Boolean)
);

// THE CASE STAND-IN INDEX. public/data/products.json is the catalogue
// sync-products.mjs pulls per expansion and the same one /msrp.html trusts for
// product photography. Optional on purpose: a build with no products.json still
// writes both pages, every case row simply keeps the empty frame it had before
// this rule existed. See shared/case-standin.mjs for what happens to a case
// nobody has seen yet, which is the case this whole arrangement is for.
let productsDoc = {};
try {
  productsDoc = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
} catch {
  /* optional; every case row falls back to the empty frame */
}
const STAND_INDEX = standInIndex(productsDoc);
// Memoised per productId because row() is called once per row and the honesty
// block counts the same rows again to say how many carry a stand-in. The two
// must not be able to disagree about which rows those are.
const standCache = new Map();
function standInFor(item) {
  const key = String(item.productId ?? item.name);
  if (!standCache.has(key)) standCache.set(key, caseStandIn(item, STAND_INDEX, DEAD));
  return standCache.get(key);
}

let pokemonPages = [];
try {
  pokemonPages = JSON.parse(
    await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8")
  ).pokemon || [];
} catch {
  /* optional; rows fall through to the site search */
}
// Longest name first so "Mewtwo" is tested before "Mew" and cannot be eaten by
// it. Sorted once here rather than inside the per-row loop.
const POKEMON = pokemonPages
  .filter((p) => p.slug && p.name)
  .slice()
  .sort((a, b) => b.name.length - a.name.length);

// TCGplayer's setName -> our set guide slug. shared/tcgplayer.mjs holds the
// forward map and every entry in it was read back off a probe rather than
// guessed, so reversing it is safe.
const GUIDE = Object.fromEntries(Object.entries(TCG_SET).map(([slug, name]) => [name, slug]));

// PriceCharting console path -> our set guide slug, the same map
// sync-pricecharting-cards.mjs prices the guides from, reversed. Every entry in
// it was read off the crawled console list and checked against the card count
// the guide expects, so reversing it is safe in the same way GUIDE is. A row on
// the cards page carries no set slug of its own: its url is
// /game/pokemon-<console>/<product>, so the console is read back off the url
// rather than matched by set name, which would have to guess between "Scarlet &
// Violet" and "Scarlet & Violet 151".
const PC_GUIDE = Object.fromEntries(
  Object.entries(PC_CONSOLES).map(([slug, path]) => [path.replace("/console/", ""), slug]),
);
const pcConsoleOf = (url) => /\/game\/([^/]+)\//.exec(url)?.[1] || "";

const rx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where a row's big tap target goes. Always somewhere on this site. */
function internalLink(item, kind) {
  const guide =
    kind === "cards"
      ? PC_GUIDE[decodeURIComponent(pcConsoleOf(item.url))]
      : GUIDE[item.setName];
  if (guide) return { href: `/sets/${guide}.html`, why: "our guide to this set" };
  if (kind === "sealed") {
    return { href: "/how-many-packs.html", why: "what is inside a sealed product" };
  }
  const hit = POKEMON.find((p) => new RegExp(`^${rx(p.name)}\\b`, "i").test(item.name));
  if (hit) return { href: `/pokemon/${hit.slug}.html`, why: `every ${hit.name} card we cover` };
  return { href: `/search.html?q=${encodeURIComponent(item.name)}`, why: "search this site" };
}

/**
 * What SHAPE of sealed product a row is.
 *
 * WHY THE SEALED PAGE NEEDS THIS AT ALL: 65 of its 100 rows are CASES, the
 * shipping cartons that hold six booster boxes or sixteen elite trainer boxes.
 * They are genuinely sealed Pokemon products genuinely listed on TCGplayer at
 * genuinely those prices, so removing them would be editing the answer to suit
 * the question. But a reader who came to see expensive Pokemon boxes and got a
 * list of freight pallets has been misled by omission just as surely.
 *
 * So every row is labelled with its form, the page says the count out loud in
 * its opening block, and a toggle hides the cases without renumbering anything.
 * The ranks stay 1 to 100 with visible gaps, so the filtered view still shows
 * you what it is hiding rather than pretending to be a different top 100.
 *
 * Order matters: "151 Booster Bundle Display Case" is a Case, not a Bundle and
 * not a Display, so the multiples are tested before the singles.
 */
const FORMS = [
  { id: "case", label: "Case", multi: true, re: /\bcase\b/i },
  { id: "display", label: "Display", multi: true, re: /\bdisplay\b/i },
  { id: "multi", label: "Set of 2", multi: true, re: /\bset of \d+\b/i },
  { id: "box", label: "Booster box", multi: false, re: /\bbooster box\b/i },
  { id: "etb", label: "Elite Trainer Box", multi: false, re: /\belite trainer box\b/i },
  { id: "bundle", label: "Bundle", multi: false, re: /\bbooster bundle\b|\bbundle\b/i },
  { id: "pack", label: "Booster pack", multi: false, re: /\bbooster pack\b|\bpack\b/i },
  { id: "tin", label: "Tin", multi: false, re: /\btin\b/i },
  { id: "blister", label: "Blister", multi: false, re: /\bblister\b/i },
  { id: "collection", label: "Collection", multi: false, re: /\bcollection\b|\bbox set\b/i },
];
const formOf = (name) => FORMS.find((f) => f.re.test(name)) || { id: "other", label: "Other", multi: false };

const money = (v) => (v == null ? "" : moneyExact(v));

/** One row. */
function row(item, kind) {
  const link = internalLink(item, kind);
  const form = kind === "sealed" ? formOf(item.name) : null;
  // NO SRC AT ALL when the product has no photo, rather than a src plus an
  // onerror. sync-top100.mjs fetches all 200 image urls every run and flags the
  // dead ones, and data/no-scan.json's own dead TCGplayer ids are folded in on
  // top, so the page never spends a request finding out what we already know.
  // The onerror stays on the rest, for a photo that dies between the sync and
  // the reader.
  // On the cards page the flag comes from verify-raw-top.mjs, which HEADs every
  // scan on every run; on the sealed page from sync-top100.mjs plus the dead
  // TCGplayer ids in data/no-scan.json. Either way it is known before the page
  // is written, so no reader ever spends the round trip.
  const dead =
    kind === "cards"
      ? item.noImg === true
      : item.noImg === true || DEAD.has(String(item.productId));
  // THE STAND-IN, AND IT ONLY EVER FILLS A FRAME THAT WOULD OTHERWISE BE EMPTY.
  // Sealed only, and only where the product's own photograph is known dead.
  // Every unphotographed row on that page is a CASE, because TCGplayer
  // photographs what a collector buys and a case is a carton a distributor
  // buys; shared/case-standin.mjs reads the inner product out of the row's own
  // name and returns its picture, or null, in which case nothing below changes.
  //
  // THE CAPTION IS NOT OPTIONAL AND IS NOT A tooltip, A title OR AN alt ON ITS
  // OWN. A reader has to be unable to think the photograph IS the case, so the
  // product in the picture is named in visible text on the row, the same way
  // /msrp.html prints "pictured: <name>" under a pinned photograph. If the
  // caption ever cannot be painted, drop the picture rather than the caption:
  // an empty frame is honest and an unlabelled stand-in is not.
  //
  // THE ROW ITSELF DOES NOT MOVE. Its rank, its name, its form label and its
  // price still describe the CASE, which is what the reader is being shown the
  // price of. Only the picture and the line under it describe one unit.
  const stand = kind === "sealed" && dead ? standInFor(item) : null;
  const shot = stand
    ? // No width/height: BOTH hosts vary on one axis. See the header.
      // alt names WHAT IS IN THE PICTURE rather than what the row is about,
      // which is the opposite of every other row here, where alt is empty
      // because the name beside it already says it.
      `<img class="t100-img" src="${esc(stand.img)}" alt="${esc(stand.name)}" loading="lazy" decoding="async"
        onerror="this.classList.add('t100-img-none');this.removeAttribute('src');this.removeAttribute('alt')">`
    : dead || !item.img
      ? `<span class="t100-img t100-img-none" aria-hidden="true"></span>`
      : `<img class="t100-img" src="${esc(item.img)}" alt="" loading="lazy" decoding="async"
        onerror="this.classList.add('t100-img-none');this.removeAttribute('src')">`;

  // The visible caption. Full row width on a phone and full row width in the
  // table layout, because at 52px the picture's own column cannot hold a legible
  // line and a caption that has to be squinted at is not a caption.
  // The form label is lowercased into the sentence so a Display row does not
  // read "no photograph of this case".
  const pictured = stand
    ? `<span class="t100-pic">pictured: ${esc(stand.name)}, one unit from inside. TCGplayer has no photograph of this ${esc(
        form.label.toLowerCase(),
      )}.</span>`
    : "";

  // The phone line under the name. The set, and on the cards page nothing else:
  // the graded figures ride in the price cell instead, where they sit under the
  // raw price they are being compared with. From 760px up both are columns of
  // their own and this line is not painted at all.
  const meta = [
    esc(item.setName),
    kind === "cards" && item.number ? `no. ${esc(item.number)}` : "",
    kind === "cards" && item.rarity ? esc(item.rarity) : "",
    kind === "sealed" ? esc(form.label) : "",
  ].filter(Boolean);

  // The lowest live asking price sits beside the market price on purpose. They
  // are different numbers and a page that shows only one of them invites the
  // reader to treat it as both. "no listings" is printed rather than left blank
  // because an empty cell reads as a data gap, and a product with nothing for
  // sale is a fact about the product.
  // "NO ASKING PRICE", NOT "NO LISTINGS", and the difference is not pedantry.
  // Four rows across the two pages report a listing count above zero and no
  // lowest price at all, so the old wording put "no listings" directly under a
  // column reading "1 listing" on the same row. What is actually missing is the
  // price, not the listing.
  const low =
    item.low != null
      ? `<span class="t100-low">low ${esc(money(item.low))}</span>`
      : `<span class="t100-low t100-low-none">no asking price</span>`;
  const listings =
    item.listings != null && item.listings > 0
      ? `${item.listings} listing${item.listings === 1 ? "" : "s"}`
      : `none for sale`;

  // THE TWO GRADED FIGURES ON A CARDS ROW, AND THE THREE THINGS THEY CAN SAY.
  // A figure is printed only where BOTH reads of it agreed. Where neither page
  // carried one, the row says so in words, because an empty PSA 10 cell is an
  // ANSWER on this source and not a gap: PriceCharting prices from completed
  // sales, and a card with no recent sale in that grade has no value to report.
  // Where the two reads did not agree, or only one of them had a figure, the
  // row says THAT instead, which is a different fact and must not be dressed up
  // as the first one.
  // THE GRADE LABEL STAYS ON A ROW WITH NO FIGURE. Printed without it, a card
  // with neither graded value showed a phone line reading nothing but two
  // dashes, which says less than saying nothing. The dash carries the reason
  // for a screen reader and the label says which grade is missing.
  const graded = (value, label, why) =>
    `${value != null ? esc(moneyCompact(value)) : noValue(why, "t100-na")} ` +
    `<span class="t100-gt">${esc(label)}</span>`;
  const gradedCell = (key, label) =>
    graded(
      item[key],
      label,
      item[`${key}Why`] || `No ${label} value recorded for this card`,
    );

  // The one outbound link on the row, argued in the header above: it points at
  // whichever source the figure beside it came from, is labelled in visible
  // text and in an aria-label, carries no affiliate tag, and is not the row's
  // main tap target.
  const where = kind === "cards" ? "PriceCharting" : "TCGplayer";
  const check = `<a class="t100-check" href="${esc(item.url)}" rel="noopener nofollow"
      aria-label="Check ${esc(item.name)} on ${where} (opens ${where})">check on ${where}</a>`;

  const flag =
    item.confirmed === false
      ? `<span class="t100-flag" title="TCGplayer's search index and its product page report different prices for this product">two TCGplayer sources disagree${
          item.altMarket ? `, the other says ${esc(money(item.altMarket))}` : ""
        }</span>`
      : "";

  // THE ROW IS FLAT, NOT NESTED, AND THE INTERNAL LINK IS STRETCHED OVER IT.
  //
  // The obvious markup wraps the rank, the picture, the name and the set in one
  // <a> and puts the price beside it, and that is what this was. It cost 41px
  // of height on every phone row, because the picture is 72px tall while the
  // name and the set together are 53px, so the anchor's box was 19px taller
  // than its own contents and the price could only start underneath all of it.
  // A hundred rows of that is 4,100px of scrolling bought with nothing.
  //
  // Flat means every cell is a direct child of one grid, so the picture spans
  // three text rows instead of pushing them down, and the row is as tall as the
  // taller of the two columns rather than the sum. Measured: 137px to 98px on a
  // phone, which is 3,900px off the page.
  //
  // The link is put back with the stretched-link pattern rather than by nesting:
  // .t100-name is the anchor, and its ::after covers the whole <li>, so the rank,
  // the picture and the set are all still one tap target and the anchor's
  // accessible name is the product name rather than a run-on of four cells. The
  // price cell is raised above it so the one outbound link stays clickable.
  // The known cost of a stretched link is that dragging to select text inside
  // the row starts a drag on the link instead, which is a fair trade on a browse
  // list and would not be on a page you quote from.
  return `<li class="t100-li${form && form.multi ? " is-multi" : ""}${pictured ? " has-pic" : ""}">
  <span class="t100-rank">${item.rank}</span>
  <span class="t100-shot">${shot}</span>
  <a class="t100-name" href="${esc(link.href)}">${esc(item.name)}<span class="t100-go">, ${esc(link.why)}</span></a>
  <span class="t100-meta">${meta.join(' <i aria-hidden="true">&bull;</i> ')}</span>
  <span class="t100-set">${esc(item.setName)}</span>
  <span class="t100-tag">${kind === "cards" ? gradedCell("g9", "Grade 9") : esc(form.label)}</span>
  <span class="t100-count">${kind === "cards" ? gradedCell("psa10", "PSA 10") : esc(listings)}</span>
  <span class="t100-price">
    <b>${esc(money(kind === "cards" ? item.price : item.market))}</b>
    ${
      kind === "cards"
        ? `<span class="t100-grades">${gradedCell("psa10", "PSA 10")} ${gradedCell("g9", "Grade 9")}</span>`
        : low
    }
    ${check}
    ${flag}
  </span>${pictured ? `\n  ${pictured}` : ""}
</li>`;
}

// ---------------------------------------------------------------------------
// The two pages
// ---------------------------------------------------------------------------

const CSS = `
/* This page's own block rather than ui.css. ui.css is render blocking on every
   page on the site and these rules are used by two of them. */

/* THE ROW IS ONE FLAT GRID AT TWO SHAPES. Phone stacks name, then set, then
   price, all beside one picture that spans the three; from 760px up the same
   cells become table columns with a header above them, which is where a hundred
   row list is actually read. Nothing is nested, which is what lets the picture
   span rather than push. See the note above row() for why that is worth 3,900px
   of page height on a phone.

   THE NAME GETS THE FULL WIDTH ON A PHONE, and that is the second attempt.
   The first gave the price a column of its own and it cost more than it looked
   like it would. Measured at 390: .wrap leaves 366px for the row, the price
   column took 116px of it ("$18,750.00" is ten characters of Space Mono at 1rem
   and cannot wrap), the rank and picture took another 94px, and the name was
   left with 146px. At .95rem Outfit that is about 20 REAL characters a line, so
   a two line clamp held about 40. CHECKED IN THE BROWSER RATHER THAN ASSUMED:
   23 of 100 card names and 72 of 100 sealed names were being cut off, the
   longest sealed name being 70 characters. Dropping the price under the name
   gives it 248px, about 34 real characters a line, and the clamp is 3 lines, so
   nothing in either list truncates on a phone. Re-measured after: 0 of 200.

   REAL CHARACTERS, NOT THE ch UNIT. One ch is the advance width of a "0", and
   in Outfit a digit is around 1.43 times the average character, so sizing a
   text column in ch over-promises by about 40%. Every width here was measured
   against the actual longest string in data/top100.json. */
.t100{list-style:none;margin:var(--s4) 0 0;padding:0;display:flex;flex-direction:column;gap:5px}
.t100-li{position:relative;background:var(--card);border:1px solid var(--hair);
  border-radius:var(--r-sm);
  display:grid;gap:0 10px;padding:9px 10px;align-items:start;
  grid-template-columns:26px 52px minmax(0,1fr);
  grid-template-areas:"rank shot name" "rank shot meta" "rank shot price"}
.t100-li:hover{border-color:var(--keyline)}
.t100-set,.t100-tag,.t100-count{display:none}

/* THE CASE CAPTION GETS A ROW OF ITS OWN, THE FULL WIDTH OF THE CARD, AT BOTH
   SHAPES. It cannot go under the picture: that column is 52px on a phone and
   72px at its widest, and CLAUDE.md's rule for this site is that an illegible
   label is worse than no picture, so a caption that will not fit means the
   frame stays empty instead. Full width is the only place on this row where a
   sentence naming a product fits without being clamped away.

   Note the areas: rank and shot are named on the first three phone rows and on
   the single desktop row only, so the picture keeps centring against the name,
   the set and the price rather than drifting down beside the caption. The
   caption is the ONLY thing on the extra row.

   THE ROW GROWS AND NOTHING SHIFTS. This is static markup with the class
   already on it, so the taller card is the card's first and only height; the
   page's CLS is 0 before and after. */
.t100-li.has-pic{grid-template-areas:"rank shot name" "rank shot meta" "rank shot price" "pic pic pic"}
.t100-pic{grid-area:pic;font-size:var(--t-micro);line-height:1.4;color:var(--ink-2);
  margin-top:7px;padding-top:6px;border-top:1px dashed var(--hair)}

.t100-rank{grid-area:rank;align-self:center;font-family:var(--mono);font-size:var(--t-sm);
  color:var(--ink-2);text-align:right;font-variant-numeric:tabular-nums}
/* WHITE, NOT THE GREY TINT. object-fit:contain letterboxes every photo whose
   shape is not the box's, and TCGplayer's product photography is shot on white,
   so a tinted frame drew grey bands above and below every booster box. The grey
   is kept for the frame with no photo in it at all, where it is the point. */
.t100-shot{grid-area:shot;align-self:center;display:block;width:52px;height:72px;
  background:var(--paper-2);border-radius:3px;overflow:hidden}
.t100-img{display:block;width:100%;height:100%;object-fit:contain}
/* A product with no photo keeps the tinted frame rather than showing a broken
   icon, and never fires a request: sync-top100.mjs fetches all 200 urls each run
   and flags the dead ones, so the markup carries no src at all for those. */
.t100-img-none{background:var(--paper-3)}

/* The stretched link. ::after covers the whole <li> so the rank, the picture
   and the set are one tap target, while the anchor's accessible name stays the
   product name. .t100-price is raised above it so the one outbound link on the
   row is still clickable. */
.t100-name{grid-area:name;align-self:end;font-weight:600;line-height:1.25;
  color:inherit;text-decoration:none;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.t100-name::after{content:"";position:absolute;inset:0;z-index:0}
.t100-li:hover .t100-name{text-decoration:underline}
.t100-name:focus-visible::after{outline:2px solid var(--keyline);outline-offset:2px;border-radius:var(--r-sm)}
.t100-meta{grid-area:meta;align-self:start;font-size:var(--t-label);color:var(--ink-2);
  line-height:1.35;margin-top:2px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.t100-meta i{font-style:normal;opacity:.5;padding:0 2px}
/* Where the row goes, for a screen reader. Part of the link's accessible name,
   never painted: there is no room for it on a phone and it would be noise on a
   desktop where the set is already its own column. */
.t100-go{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);
  clip-path:inset(50%);white-space:nowrap}

.t100-price{grid-area:price;position:relative;z-index:1;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:1px 10px;margin-top:4px;min-width:0}
.t100-price b{font-family:var(--mono);font-size:1rem;font-variant-numeric:tabular-nums;
  letter-spacing:-.02em;white-space:nowrap}
.t100-low{font-size:var(--t-micro);color:var(--ink-2);font-family:var(--mono);white-space:nowrap}
.t100-low-none{opacity:.65}
/* THE TWO GRADED FIGURES, PHONE ONLY. From 760px up they are columns of their
   own and this line is not painted, exactly like .t100-meta: printing both
   would put the same two numbers on one row twice. Same size and colour as
   .t100-low, because they play the same part, a smaller fact beside the figure
   the list is ordered by. */
.t100-grades{display:flex;flex-wrap:wrap;gap:1px 10px;font-family:var(--mono);
  font-size:var(--t-micro);color:var(--ink-2);white-space:nowrap}
/* The unit label. Never the same weight as the figure: the number is the fact
   and the grade is the caption. */
.t100-gt{letter-spacing:.04em;text-transform:uppercase;opacity:.75}
.t100-na{opacity:.65}
/* THE THUMB TARGET, WITHOUT MOVING A PIXEL OF THE LAYOUT.
   Measured at 390x844: this link was 108.8 x 17.0, one 11px line box, and there
   are 100 of them on /most-valuable-cards.html and 100 more on
   /most-expensive-sealed.html. RE-MEASURED 18 Aug 2026 after the cards page's
   label became "check on PriceCharting": 123.7 x 44.0 there and 108.8 x 44.0 on
   the sealed page, at both 390 and 1440. The longer word costs 14.9px of width
   and nothing at all in height, and both pages still have no horizontal
   overflow: scrollTo(400, 0) leaves scrollX at 0 and document.scrollWidth
   equals the viewport at 390 and at 1440. 17px is under half the 44px WCAG 2.5.5 asks for
   and it is the only outbound action in the card.
   The padding grows the hit box to 44 and the equal negative margins give the
   space straight back, so the flex line, the card and the page are all the
   height they were. Measured before and after, page height at 390x844:
   /most-valuable-cards.html 17,491 -> 17,491, /most-expensive-sealed.html
   18,068 -> 18,068, and at 1440x900 15,573 -> 15,573. The link went 108.8x17.0
   to 108.8x44.0 at 320, 390 and 1440. Its BORDER BOX top moves up 13px, which
   is the padding, and the underlined text itself lands within half a pixel of
   where it was. The 13/14 split is the 27px of growth put back where it came
   from, the extra pixel downward because the card's own padding is below and
   only the price line, which is not a target, is above.
   Not applied to .t100-name: that one is already 21.3 to 42.5px tall and sits
   directly under the next card's picture, where growing it would overlap a
   different card's target rather than empty padding.
   PADDING ONLY, NOT inline-flex WITH align-items:center, and the reason is the
   arrow. The ::after below is a space followed by U+2197. In an inline-flex box
   that pseudo element becomes a FLEX ITEM and its leading space is dropped, so
   the label rendered with the arrow jammed against the r and the link measured
   106.5 wide instead of 108.8. Left as a block flex item the arrow stays an
   inline box and keeps its space. */
.t100-check{font-size:var(--t-micro);color:var(--ink-2);text-decoration:underline;
  text-underline-offset:2px;white-space:nowrap;
  padding-top:13px;padding-bottom:14px;margin-top:-13px;margin-bottom:-14px}
.t100-check:hover{color:var(--ink)}
.t100-check::after{content:" \\2197"}
.t100-flag{font-size:var(--t-micro);color:var(--ink);background:var(--chip-gold-bg);
  border-radius:3px;padding:1px 5px;flex-basis:100%}

/* The header strip only exists in the table layout. */
.t100-head{display:none}

@media (min-width:760px){
  /* Seven columns: rank, picture, name, set, rarity or form, listings, price.
     The name column is twice the set column because it carries the longest
     strings in the data, 51 characters raw and 70 sealed. */
  .t100-li,.t100-head{grid-template-columns:32px 60px minmax(0,2fr) minmax(0,1.05fr) 116px 88px 138px}
  .t100-li{grid-template-areas:"rank shot name set tag count price";align-items:center;
    gap:0 12px;padding:9px 12px}
  /* Same idea in the table layout: the seven columns keep their row and the
     caption spans all seven underneath, so the picture still centres against
     the columns and the sentence gets the whole card width to be read in. */
  .t100-li.has-pic{grid-template-areas:"rank shot name set tag count price" "pic pic pic pic pic pic pic"}
  /* THE PICTURE GROWS ON DESKTOP BECAUSE THE BYTES ARE ALREADY PAID FOR. The
     smallest rendition this CDN serves is 150px wide; _50w, _100w and _120w all
     answer 403, checked on five ids. So a 52px box on a phone asks for nearly
     three times the pixels it paints and there is nothing to be done about it.
     Desktop has the room, so it takes 60px and then 72px, which at DPR 2 is 120
     and 144 real pixels against the 150 that arrived: the same download, most of
     it now actually used. */
  .t100-shot{width:60px;height:83px}
  /* The set, the two graded figures or the form, and the listing count get their
     own columns, so the lines under the name stop repeating them. */
  .t100-meta{display:none}
  .t100-grades{display:none}
  .t100-name{align-self:center;-webkit-line-clamp:2}
  .t100-set,.t100-tag,.t100-count{display:block;font-size:var(--t-sm);color:var(--ink-2);
    min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .t100-count{font-size:var(--t-label);text-align:right}
  /* THE GRADE LABEL GOES QUIET IN THE TABLE LAYOUT, WITHOUT LEAVING THE PAGE.
     Each of these cells sits under a column header that already says "Grade 9"
     or "PSA 10", so painting the label again put the same words on the screen
     a hundred times each. It is hidden the sr-only way rather than with
     display:none, because .t100-head is aria-hidden and the phone line that
     carries the same labels is not painted here either: display:none would
     leave a screen reader with a hundred rows of unlabelled money. */
  .t100-tag .t100-gt,.t100-count .t100-gt{position:absolute;width:1px;height:1px;
    overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
  .t100-price{flex-direction:column;flex-wrap:nowrap;align-items:flex-end;gap:1px;
    margin-top:0;text-align:right}
  .t100-price b{font-size:1.05rem}
  .t100-flag{flex-basis:auto;max-width:100%}
  .t100-head{display:grid;align-items:end;padding:0 12px 6px;font-family:var(--mono);
    font-size:var(--t-micro);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
  .t100-head .t100-h-name{grid-column:1/4}
  .t100-head .t100-h-count,.t100-head .t100-h-price{text-align:right}
}
@media (min-width:1080px){
  .t100-li,.t100-head{grid-template-columns:36px 72px minmax(0,2fr) minmax(0,1.05fr) 122px 94px 142px}
  .t100-shot{width:72px;height:99px}
}

/* The filter, sealed page only. Ranks are NOT renumbered when rows hide: the
   gaps are the point, because a filtered view that renumbers itself is quietly
   claiming to be a different top 100. */
.t100-filter{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:var(--s4)}
.t100-filter button{font:inherit;font-size:var(--t-sm);padding:6px 12px;cursor:pointer;
  background:var(--card);border:1px solid var(--keyline);border-radius:var(--r-pill);color:var(--ink)}
.t100-filter button[aria-pressed="true"]{background:var(--keyline);color:var(--chrome-ink)}
.t100-filter p{margin:0;font-size:var(--t-sm);color:var(--ink-2)}
.t100.hide-multi .t100-li.is-multi{display:none}

/* ui.css draws .fk-golden full bleed inside the wrap, which is right for the
   two or three sentences the other pages put in one. This one holds four
   paragraphs, and at 1440 that ran the text to about 700px inside a 1392px
   black box, leaving half of it empty and the lines longer than is comfortable
   to read. Capped to a measure instead. */
.fk-golden{max-width:58em}

/* The methodology block. Deliberately plain and deliberately long: it is the
   only reason the numbers above it are allowed on the page. */
.t100-src{display:grid;gap:10px;margin-top:var(--s4)}
.t100-src div{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);padding:12px 14px}
.t100-src h3{margin:0 0 4px;font-size:var(--t-body);font-family:var(--body);font-weight:700}
.t100-src p{margin:0;font-size:var(--t-sm);color:var(--ink-2);max-width:60em}
.t100-src code{font-family:var(--mono);font-size:.85em;word-break:break-all}
@media (min-width:900px){.t100-src{grid-template-columns:1fr 1fr}}
`;

/**
 * The block that says what the number is and what it is not, at the top of the
 * page rather than in a footnote. If a reader only reads one thing above the
 * list, this is the thing that stops the list being misleading.
 *
 * TWO OF THEM NOW, ONE PER SOURCE, rather than one block with conditionals
 * running through it. The market version below belongs to the SEALED page and
 * talks about Market Price, lowest listings and listing counts, none of which a
 * price guide publishes; the guide version talks about languages, grades and a
 * computed value, none of which the marketplace feed carries. One block saying
 * both would be vague on both pages, which is the opposite of what it is for.
 * The last paragraph, about prices moving and this page not, is deliberately
 * the same sentence in both.
 *
 * THE PARAGRAPH THAT USED TO SIT HERE NAMING THE OTHER FEED IS GONE, and its
 * absence is the point rather than an oversight: it existed because this page
 * ranked a Shadowless Base Set Charizard at $10,000 out of TCGplayer while
 * /base-set.html printed $988 for the same ungraded card out of PriceCharting,
 * and a reader who met both concluded one page was wrong. Both pages now read
 * the same guide, so there is nothing left to reconcile. shared/price-basis.mjs
 * still holds the explanation and /base-set.html still prints it, because the
 * gap between a guide value and a marketplace price is still real and a reader
 * who clicks through to buy still meets it.
 */
function honestyMarket(cfg, d) {
  const when = longDate(d.checked) || d.checked;
  return `<div class="fk-golden">
      <p class="fk-golden-h">What this list actually is</p>
      <h2>One marketplace, one number, <span class="hl">one day</span></h2>
      <p>Every figure here is TCGplayer's own <b>Market Price</b> for that product, read on
        <b>${esc(when)}</b>. Market Price is their figure, worked out from recent completed sales on their
        marketplace. It is not the cheapest copy on sale right now, it is not what one sold for last week,
        and it is not an appraisal. The cheapest live listing is printed next to it${
          // NOT "on every row". It is on every row that HAS one, and the number
          // that do not is derived here rather than claimed: a product can have
          // listings and no asking price, or nothing for sale at all, and both
          // print "no asking price" instead of a figure. The old sentence said
          // "on every row" over a list where several rows carry no low at all.
          cfg.noLow
            ? `, on the ${cfg.withLow} rows that have one, so the two cannot be mistaken for each other.
        The other ${cfg.noLow} say so instead of showing a figure: nothing is listed for sale, or the
        listings carry no asking price`
            : ` on every row so the two cannot be mistaken for each other`
        }.</p>
      <p><b>What this ranking cannot see.</b> ${cfg.excludes}</p>
      <p><b>The cheapest copy is often dearer than the market price, and that is not a mistake.</b>
        ${esc(String(cfg.aboveMarket))} of these 100 have a lowest listing above their market price today.
        Market Price looks backwards at what actually sold; a listing is what somebody is asking right now.
        On thin, old or barely traded things, and most of this list is all three, the asking prices sit well
        above the last sales, and sometimes there is nothing for sale at all.</p>
      <p>Prices move every day and this page does not. The date above is the date the numbers were read,
        and if it looks old then the numbers are old.</p>
    </div>`;
}

function methodologyMarket(cfg, d) {
  const m = d.method || {};
  return `<div class="t100-src">
    <div>
      <h3>Where the numbers come from</h3>
      <p>TCGplayer's own search service, the one behind their website:
        <code>${esc(m.feed || "")}</code>. It needs no key. Their official developer API has been closed
        to new applicants for years, so this is the route, and it is the same feed the set guides on this
        site already use for buy links and box prices. The field is <code>marketPrice</code>, filtered to
        <code>productLine ${esc(m.productLine || "")}</code> and
        <code>productType ${esc(m.productType || "")}</code>.</p>
    </div>
    <div>
      <h3>How we know it is the top 100 and not the first 100 we found</h3>
      <p>The search will not page past its ten thousandth result, so there is no way to walk all
        ${esc(String(cfg.lineTotal))} products and sort them. Instead we set a price floor of
        <b>${esc(moneyExact(d.floor))}</b>, pulled <b>every one</b> of the ${esc(String(d.walked))} products at or
        above it, and ranked those. Then we checked the answer: a fresh query asking how many products sit at or
        above ${esc(moneyExact(d.cut))}, the price of the hundredth row, came back with
        <b>${esc(String(m.completenessAtCut))}</b>. Nothing above the cut was missed, so this really is the top
        hundred of the ${esc(String(cfg.lineTotal))}.</p>
    </div>
    <div>
      <h3>Checked twice, on purpose</h3>
      <p>Every one of the 100 prices was read a second time from a different TCGplayer endpoint, the one their
        product page itself uses, and <b>${esc(String(m.corroborated))} of 100</b> matched to the cent. The ranking
        was also re-run through their own server-side sort as a second opinion, and it named
        <b>${esc(String(m.sortAgreed))} of ${esc(String(m.sortOf))}</b> of the same products. Where two sources
        disagree about a row, the row says so instead of quietly picking one.</p>
    </div>
    <div>
      <h3>What a row is</h3>
      <p>A row is a TCGplayer <b>product</b>, which is not always one physical card. Base Set Charizard is a
        single product whose listings cover both the 1st Edition and the Unlimited printing, and the feed
        publishes one Market Price for it rather than one per printing. So treat a row as "this product on
        this marketplace", not as a valuation of a specific copy in a specific condition.</p>
    </div>
  </div>`;
}

/**
 * The same block for the PRICE GUIDE page. See the note above honestyMarket()
 * for why this is a second block rather than a conditional.
 */
function honestyGuide(cfg, d) {
  const when = longDate(d.checked) || d.checked;
  const v = d.verify || {};
  const removed = cfg.sealedAboveCut;
  return `<div class="fk-golden">
      <p class="fk-golden-h">What this list actually is</p>
      <h2>One price guide, one number, <span class="hl">one day</span></h2>
      <p>Every figure here is PriceCharting's <b>Ungraded</b> price guide value for that exact printing, read
        on <b>${esc(when)}</b>. Their published method computes it from completed eBay sales and their own
        marketplace, blending the most recent sale, the median, the average and an age weighted average, with
        outliers and sale dates taken into account. It is an estimate of what a loose, ungraded copy is worth
        right now. It is not a live listing, it is not any one sale, and it is not an appraisal. The Grade 9
        and PSA 10 values from the same row sit beside it, so the raw price is never the only number on a row.</p>
      <p><b>Every language is in this ranking, and half of it is Japanese.</b>
        ${esc(String(cfg.langJa))} of these hundred are Japanese cards, ${esc(String(cfg.langZh))} are Chinese
        and ${esc(String(cfg.langEn))} are English or carry no language in their set name. That is a change:
        until August 2026 this page was English only, because the marketplace feed behind it kept Japanese in a
        separate catalogue. PriceCharting does not split its Pokemon catalogue by language, and neither does
        this page any more. The card at number one is a Japanese promo, and a list of the most valuable Pokemon
        cards that leaves it out is answering an easier question.</p>
      <p><b>${esc(String(cfg.topps))} of them are Topps cards rather than Pokemon TCG cards.</b> Topps printed
        Pokemon trading cards under licence from 1999 to 2004, chrome and movie cards you cannot play a game
        with, and PriceCharting files and prices them under Pokemon. They are left in, because taking them out
        would be editing the answer to suit the question. Their set names say Topps on every row, and
        <a href="/topps.html">what they are, every set, and how to spot one</a> explains them properly. There is
        also <a href="/topps-card-values.html">a Topps top 100 of its own</a>, raw and PSA 10.</p>
      <p><b>Sealed product was taken out by hand, and here is what went.</b> The crawl behind these figures
        excludes sealed boxes, and ${esc(String(cfg.sealedTotal))} slipped through it anyway.
        ${esc(String(removed))} of those were dear enough to have made this hundred:
        ${esc(cfg.sealedNames)}. They are boxes and blisters, not cards, and a page
        titled cards should not rank one at number four. Unopened product has its own list, priced by a
        marketplace instead: <a href="/most-expensive-sealed.html">the 100 most expensive sealed Pokemon
        products</a>.</p>
      <p><b>An empty grade cell is an answer, and a raw price above a graded one is not a mistake.</b>
        ${esc(String(cfg.noPsa))} of these hundred carry no PSA 10 value and ${esc(String(cfg.noG9))} carry no
        Grade 9 value, because this guide prices from completed sales and a card nobody has sold in that grade
        recently has no value to report. On ${esc(String(cfg.rawOverPsa))} rows the ungraded figure is higher
        than the PSA 10 figure next to it. That is what thin data looks like rather than an error: these are
        cards that trade a handful of times a year, so one raw sale and one graded sale years apart can leave
        the two columns in an order that looks backwards.</p>
      <p><b>What this ranking cannot see.</b> ${cfg.excludes}</p>
      <p><b>Every figure was read twice before it went on this page.</b> The ranking comes off PriceCharting's
        set listings; each row was then re-read from that card's own product page, which is a different page
        with different columns, and the two readings compared. ${esc(String(v.agree))} of the
        ${esc(String(v.checked))} candidates agreed. ${esc(String(v.disagree))} did not and are printed nowhere
        on this site, all of them below the hundredth place.${esc(cfg.excNote || "")} A figure that was read once
        is not published here, because the column names on those two pages do not mean the same thing and a
        single read cannot tell.</p>
      <p>Prices move every day and this page does not. The date above is the date the numbers were read,
        and if it looks old then the numbers are old.</p>
    </div>`;
}

function methodologyGuide(cfg, d) {
  const sc = d.scanned || {};
  const v = d.verify || {};
  return `<div class="t100-src">
    <div>
      <h3>Where the numbers come from</h3>
      <p>PriceCharting's own price guide, the <b>Ungraded</b> column of their Pokemon set pages:
        <code>pricecharting.com</code>. Their method is published at
        <code>${esc(d.sourceMethodology || "")}</code> and every row on this page carries a link to the exact
        product record its figures came from. It is the same source the set guides, the Pokedex pages and the
        checklists on this site are priced from, so a card here and the same card on its set page cannot
        disagree.</p>
    </div>
    <div>
      <h3>How we know it is the top 100 and not the first 100 we found</h3>
      <p>There is no all-of-Pokemon listing to sort and their one price sort works a set at a time, so the top
        of any one set says nothing about the top of the catalogue. Instead every set was pulled and ranked
        here: <b>${esc(String(sc.consoles))}</b> Pokemon sets, <b>${esc(String(sc.products))}</b> products, of
        which <b>${esc(String(sc.productsWithUngraded))}</b> carry an ungraded value. This hundred is the top of
        all ${esc(String(sc.productsWithUngraded))}, not the top of a sample, and the hundredth row is
        ${esc(moneyExact(cfg.cut))}.</p>
    </div>
    <div>
      <h3>Checked twice, on purpose</h3>
      <p>Every candidate was read again from its own product page, a different template with different columns,
        and <b>${esc(String(v.agree))} of ${esc(String(v.checked))}</b> agreed. Across all three price columns,
        ${esc(String(cfg.identical))} readings came back identical to the cent and the other
        ${esc(String(cfg.moved))} all reconcile exactly against the change PriceCharting itself reports for that
        card, with none left over. That is the check that catches a column read off the wrong header, which on
        one card is a 21 times error that still looks like a reasonable price.</p>
    </div>
    <div>
      <h3>What a row is</h3>
      <p>A row is one PriceCharting <b>product</b>, which is one printing of one card: "Charizard #4",
        "Charizard [Shadowless] #4" and "Charizard [1st Edition] #4" are three rows, not one, and the part in
        brackets is the printing. A guide value is computed across the sales that guide tracks rather than
        quoted from one of them, so treat a row as "what a loose copy of this printing is worth", not as a
        quote for a specific card in a specific condition.</p>
    </div>
  </div>`;
}

/** Which pair of blocks a page gets. */
const honesty = (cfg, d) => (cfg.source === "pricecharting" ? honestyGuide(cfg, d) : honestyMarket(cfg, d));
const methodology = (cfg, d) =>
  cfg.source === "pricecharting" ? methodologyGuide(cfg, d) : methodologyMarket(cfg, d);

const PAGES = [
  {
    key: "cards",
    source: "pricecharting",
    slug: "most-valuable-cards",
    og: "most-valuable-cards",
    navTitle: "Most valuable cards",
    title: "The 100 Most Valuable Raw Pokemon Cards in PriceCharting's Price Guide",
    h1: ["The 100 most valuable ", "raw", " Pokemon cards"],
    // "Pokemon cards", not "Pokemon TCG": thirteen of the hundred are Topps
    // cards, and "every language" is the change this page made in August 2026
    // and the first thing a reader should know about the list.
    kicker: "Pokemon cards &bull; Ungraded, every language, priced by PriceCharting",
    lede:
      "Every one of these is a loose card, out of a sleeve, ungraded. Ranked by PriceCharting's ungraded price " +
      "guide value across their whole Pokemon catalogue, Japanese and English together, read on the date below " +
      "and read a second time from each card's own product page.",
    desc:
      "The 100 most valuable ungraded Pokemon cards by PriceCharting's price guide, read %DATE%. Every language, " +
      "no sealed product, no auction records, with the Grade 9 and PSA 10 value beside every raw price.",
    excludes:
      "Graded slabs are not what it ranks: the PSA 10 and Grade 9 values are printed on every row, but the order " +
      "is the ungraded column and nothing else, and the list ranked the other way is our PSA 10 top 100. Auction " +
      "and private sales are not in it either. The six and seven figure numbers people usually mean by most " +
      "valuable are single hammer prices at auction houses, and a guide value is a computed estimate across many " +
      "sales, which is a different kind of fact: the card at number one has a widely reported 2022 sale of about " +
      "$5.3 million against the guide value shown here.",
    searchBlurb: "The dearest ungraded Pokemon cards in PriceCharting's guide, ranked and dated",
    listLede:
      "Ranked by ungraded guide value, dearest first. The picture, the name and the set take you to our page for " +
      "it; the small link under each price opens that card on PriceCharting so you can check the figure yourself.",
    filter: null,
  },
  {
    key: "sealed",
    source: "tcgplayer",
    slug: "most-expensive-sealed",
    og: "most-expensive-sealed",
    navTitle: "Most expensive sealed",
    title: "The 100 Most Expensive Sealed Pokemon Products on TCGplayer",
    h1: ["The 100 most expensive ", "sealed", " Pokemon products"],
    kicker: "Pokemon TCG &bull; Boxes, cases and packs nobody opened",
    lede:
      "Booster boxes, elite trainer boxes, single packs from 1999 and a lot of freight cases. Ranked by " +
      "TCGplayer's own market price for their English Pokemon catalogue, read on the date below.",
    desc:
      "The 100 most expensive sealed Pokemon products by TCGplayer market price, read %DATE%. Booster boxes, " +
      "cases, ETBs and vintage packs, with the cheapest live listing beside every market price.",
    lineTotal: "2,896",
    excludes:
      "Japanese sealed product is not in it, because it is a separate catalogue on the same site. Neither are " +
      "the sealed cases that change hands at auction houses, which is where most of the really old unopened " +
      "product actually sells. And a listed price is not a sold price: some of these have one listing and no " +
      "recent sales at all, which the listing count on every row will tell you.",
    searchBlurb: "The dearest sealed Pokemon product on TCGplayer, ranked and dated",
    listLede:
      "Ranked by market price, dearest first. The picture and the name take you to our page for it; the small " +
      "link under each price opens that product on TCGplayer so you can check the figure yourself.",
    filter: true,
  },
];

const built = [];

for (const cfg of PAGES) {
  const d = cfg.source === "pricecharting" ? RAW : top[cfg.key];
  if (!d?.items?.length) {
    console.log(
      `  ${cfg.slug}: nothing to build from ${
        cfg.source === "pricecharting" ? "data/top-raw.json" : `data/top100.json under "${cfg.key}"`
      }, skipped. Run ${cfg.source === "pricecharting" ? "sync-raw-top.mjs then verify-raw-top.mjs" : "sync-top100.mjs"}.`,
    );
    continue;
  }
  const items = d.items;
  const when = longDate(d.checked) || d.checked;
  const desc = cfg.desc.replace("%DATE%", when);
  const url = `${SITE}/${cfg.slug}.html`;

  // Any dead scan actually in this list, named rather than assumed away.
  const dead = items.filter((i) =>
    cfg.source === "pricecharting" ? i.noImg === true : i.noImg === true || DEAD.has(String(i.productId)),
  );
  // Of those, the ones a captioned stand-in fills, and the ones still empty.
  // Counted through the SAME standInFor() the rows go through, so the sentence
  // under the list cannot claim a different number of pictures from the number
  // the list actually draws.
  const stood = cfg.source === "pricecharting" ? [] : dead.filter((i) => standInFor(i));
  const blank = dead.length - stood.length;

  const multi = cfg.filter ? items.filter((i) => formOf(i.name).multi).length : 0;
  // EVERY NUMBER IN THE PROSE IS COUNTED OFF THE DATA RATHER THAN TYPED,
  // because it is the kind of number that is right on the day it is written and
  // wrong every day after.
  if (cfg.source === "pricecharting") {
    // Language is read off the set name, which is where PriceCharting puts it:
    // "Japanese Promo", "Chinese 151 Collect", "Korean Promo". A set with no
    // language in its name is English or unmarked, and the copy says both
    // rather than claiming all 48 are English.
    const lang = (i) => /^(Japanese|Chinese|Korean)\b/.exec(i.setName)?.[1] || "";
    cfg.langJa = items.filter((i) => lang(i) === "Japanese").length;
    cfg.langZh = items.filter((i) => lang(i) === "Chinese").length;
    cfg.langEn = items.length - cfg.langJa - cfg.langZh;
    cfg.topps = items.filter((i) => /\bTopps\b/i.test(i.setName)).length;
    cfg.cut = items[items.length - 1].price;
    // The sealed rows that were dear enough to have made this hundred. Only
    // those: naming the ones that fell below the cut anyway would inflate what
    // the removal actually did.
    const above = (d.notCards || []).filter((n) => n.ungraded >= cfg.cut);
    cfg.sealedAboveCut = above.length;
    cfg.sealedTotal = (d.notCards || []).length;
    // SEMICOLONS, NOT COMMAS, because every item in this list carries a money
    // figure with a comma in it. Joining on commas produced one long string a
    // reader could not parse into items, and an "and the last one" regex over
    // it matched inside "$26,347.39" instead of between two products.
    const list = above.map((n) => `${n.name} at ${moneyExact(n.ungraded)}`);
    cfg.sealedNames =
      list.length > 1 ? `${list.slice(0, -1).join("; ")} and ${list[list.length - 1]}` : list[0] || "";
    // The two classes every reading of every column fell into. The claim the
    // methodology block makes is that there is no third class, so both are
    // counted here rather than asserted.
    // The three shapes a reader will notice and wonder about, counted rather
    // than described vaguely: an empty grade cell, and a raw price sitting
    // above the PSA 10 price beside it.
    cfg.noPsa = items.filter((i) => i.psa10 == null).length;
    cfg.noG9 = items.filter((i) => i.g9 == null).length;
    cfg.rawOverPsa = items.filter((i) => i.psa10 != null && i.price > i.psa10).length;
    const readings = (d.verify?.rows || []).flatMap((r) => Object.values(r.cols || {}));
    cfg.identical = readings.filter((c) => c.listing != null && c.listing === c.product).length;
    cfg.moved = readings.filter((c) => c.reconciles === true).length;
    // ONE SENTENCE PER EXCLUDED ROW, each reason coming off the entry's own
    // `public` string rather than a sentence written here, so an exclusion made
    // later for some other reason cannot inherit this one's explanation. Same
    // rule build-top-graded.mjs keeps. No `public` on any entry, no sentence.
    const exc = d.excluded || [];
    const oneReason = exc.length && exc.every((e) => e.public === exc[0].public);
    cfg.excNote = !exc.length || exc.some((e) => !e.public)
      ? ""
      : oneReason
        ? // All of them for the same reason, said once. Five sentences with the
          // same clause in each reads as boilerplate and buries the names.
          ` They are ${
            exc.length > 1
              ? `${exc.slice(0, -1).map((e) => e.name).join("; ")} and ${exc[exc.length - 1].name}`
              : exc[0].name
          }, in every case because ${exc[0].public}.`
        : " " + exc.map((e) => `${e.name} was dropped because ${e.public}.`).join(" ");
  } else {
    cfg.aboveMarket = items.filter((i) => i.low != null && i.low > i.market).length;
    // Same rule, for the same reason: the honesty block used to promise the
    // lowest listing "on every row" and several rows carry none.
    cfg.withLow = items.filter((i) => i.low != null).length;
    cfg.noLow = items.length - cfg.withLow;
  }
  const filterBlock = cfg.filter
    ? `<div class="t100-filter">
      <button type="button" id="t100All" aria-pressed="true" aria-controls="t100list">All 100</button>
      <button type="button" id="t100Solo" aria-pressed="false" aria-controls="t100list">Hide cases and displays</button>
      <p id="t100Count">Showing all 100. ${multi} of them are cases, displays or multi-packs.</p>
    </div>`
    : "";

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(cfg.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-${cfg.og}.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-${cfg.og}.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${CSS}</style>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">${cfg.kicker}</span>
    <h1>${esc(cfg.h1[0])}<span class="hl">${esc(cfg.h1[1])}</span>${esc(cfg.h1[2])}</h1>
    <p class="lede" style="max-width:40em">${esc(cfg.lede)}</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / ${esc(cfg.navTitle)}</p>

    ${honesty(cfg, d)}

    <div class="facts" style="margin-top:20px">${
      cfg.source === "pricecharting"
        ? `
      <div class="fact"><div class="n">${esc(moneyCompact(items[0].price))}</div><div class="l">Dearest, ${esc(items[0].name)}</div></div>
      <div class="fact"><div class="n">${esc(moneyCompact(cfg.cut))}</div><div class="l">What it takes to make the 100</div></div>
      <div class="fact"><div class="n">${esc(String(cfg.langJa + cfg.langZh))}</div><div class="l">Japanese or Chinese, of 100</div></div>
      <div class="fact"><div class="n">${esc(d.scanned.productsWithUngraded.toLocaleString("en-US"))}</div><div class="l">Priced cards ranked to find them</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(when)}</div><div class="l">Prices read on</div></div>`
        : `
      <div class="fact"><div class="n">${esc(moneyCompact(items[0].market))}</div><div class="l">Dearest, ${esc(items[0].name)}</div></div>
      <div class="fact"><div class="n">${esc(moneyCompact(d.cut))}</div><div class="l">What it takes to make the 100</div></div>
      <div class="fact"><div class="n">${esc(String(d.walked))}</div><div class="l">Products checked to find them</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(when)}</div><div class="l">Prices read on</div></div>`
    }
    </div>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The list</p>
    <h2>All ${items.length}, dearest <span class="hl">first</span></h2>
    <p class="lede" style="max-width:44em">${esc(cfg.listLede)}</p>
    ${filterBlock}

    <div class="t100-head" aria-hidden="true">
      <span class="t100-h-name">Rank and name</span><span>Set</span><span>${
        cfg.key === "sealed" ? "Form" : "Grade 9"
      }</span><span class="t100-h-count">${cfg.key === "sealed" ? "For sale" : "PSA 10"}</span><span class="t100-h-price">${
        cfg.key === "sealed" ? "Market price" : "Ungraded"
      }</span>
    </div>
    <ol class="t100" id="t100list">
${items.map((i) => row(i, cfg.key)).join("\n")}
    </ol>

    <p class="price-note" style="margin-top:var(--s5)">${
      cfg.source === "pricecharting"
        ? `Prices are PriceCharting price guide values for a loose, ungraded copy of that exact printing, read on
      ${esc(when)} and re-read from each card's own product page before publication. They move daily, so treat them as
      the shape of the market rather than a quote. Card scans are PriceCharting's, shown at the size these rows draw
      them and linked back to the record they belong to. The link under each price leaves this site and opens on
      PriceCharting; there is no affiliate code in it and we make nothing from it, it is there so you can check the
      number. ${dead.length ? `${dead.length} of these cards have no scan in PriceCharting's catalogue and show an empty frame; that is their record, not a fault here.` : ""}`
        : `Prices are TCGplayer market prices for their English Pokemon
      catalogue, read on ${esc(when)} and re-read from a second TCGplayer endpoint the same day. They move daily, so
      treat them as the shape of the market rather than a quote. Product photography is TCGplayer's, shown at the size
      these rows draw it and linked back to the product it belongs to. The link under each price leaves this site and
      opens on TCGplayer; there is no affiliate code in it and we make nothing from it, it is there so you can check the
      number. ${
        stood.length
          ? `${stood.length} of these products are cases, and TCGplayer photographs what a collector buys rather than the
      carton a shop receives, so it holds no picture of them at all. Those rows show one unit from inside the case
      instead, and the line under each names exactly which product is in the picture. The rank, the name and the price
      on those rows are still the case's.`
          : ""
      } ${blank ? `${blank} of these products have no photo in TCGplayer's catalogue and show an empty frame; that is their listing, not a fault here.` : ""}`
    }
      Not financial advice, and definitely not a suggestion to buy any of this.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Showing our working</p>
    <h2>How this list was <span class="hl">made</span></h2>
    <p class="lede" style="max-width:44em">A hundred prices is a hundred chances to publish something nobody can
      check. Here is exactly where each one came from and how we know the list is not just the first hundred rows
      that came back.</p>
    ${methodology(cfg, d)}
    <p class="price-note" style="margin-top:var(--s4)">Want the other half of the question? <a href="/grading.html">Is it
      worth grading?</a> does the subtraction on raw against graded prices, <a href="/pack-prices.html">pack prices by
      set</a> covers what a pack costs today, and <a href="/complete-a-set.html">cost to complete a set</a> prices the
      whole checklist. Every card we actually pulled is in the <a href="/cards.html">card search</a>.</p>
  </div>
</section>

</main>
${footer("Prices move daily. The date on this page is the date they were read.")}
${
  cfg.filter
    ? `<script>
(function(){
  var list=document.getElementById('t100list');
  var all=document.getElementById('t100All'), solo=document.getElementById('t100Solo');
  var out=document.getElementById('t100Count');
  var total=${items.length}, multi=${multi};
  function set(hide){
    list.classList.toggle('hide-multi',hide);
    all.setAttribute('aria-pressed',String(!hide));
    solo.setAttribute('aria-pressed',String(hide));
    // The ranks do not change. Say what is hidden rather than renumbering, so
    // the filtered view cannot be mistaken for a different top 100.
    out.textContent = hide
      ? 'Showing '+(total-multi)+' of '+total+'. '+multi+' cases, displays and multi-packs are hidden and the ranks still count them.'
      : 'Showing all '+total+'. '+multi+' of them are cases, displays or multi-packs.';
  }
  all.addEventListener('click',function(){set(false)});
  solo.addEventListener('click',function(){set(true)});
})();
</script>`
    : ""
}
${APP_JS}
</body>
</html>
`;

  await writeFile(join(ROOT, `public/${cfg.slug}.html`), page);
  built.push({ cfg, d, items, dead, stood, blank, multi });
}

for (const b of built) {
  if (b.cfg.source === "pricecharting") {
    const v = b.d.verify || {};
    console.log(
      `Wrote public/${b.cfg.slug}.html\n` +
        `  ${b.items.length} rows, ${moneyExact(b.items[0].price)} down to ${moneyExact(b.cfg.cut)}, ` +
        `read ${b.d.checked} (PriceCharting ungraded)\n` +
        `  ranked from ${b.d.scanned.productsWithUngraded} priced products across ${b.d.scanned.consoles} sets; ` +
        `${v.agree}/${v.checked} candidates confirmed on a second read, ${v.disagree} excluded\n` +
        `  ${b.cfg.langJa} Japanese, ${b.cfg.langZh} Chinese, ${b.cfg.langEn} English or unmarked, ` +
        `${b.cfg.topps} Topps; ${b.cfg.sealedAboveCut} sealed products removed from above the cut\n` +
        `  ${b.items.length - b.dead.length} card scans, ${b.dead.length} skipped as known dead` +
        (b.items[b.items.length - 1].sourceRank !== b.items.length
          ? `\n  NOTE: the hundredth published row is candidate ${b.items[b.items.length - 1].sourceRank}, ` +
            `so ${b.items[b.items.length - 1].sourceRank - b.items.length} candidate(s) above it did not survive the second read`
          : ""),
    );
    continue;
  }
  console.log(
    `Wrote public/${b.cfg.slug}.html\n` +
      `  ${b.items.length} rows, ${moneyExact(b.items[0].market)} down to ${moneyExact(b.d.cut)}, read ${b.d.checked}\n` +
      `  walked ${b.d.walked} products at ${moneyExact(b.d.floor)}+, ` +
      `${b.d.method.corroborated}/100 price-confirmed, ${b.d.method.sortAgreed}/${b.d.method.sortOf} agreed with their own sort\n` +
      `  ${b.items.length - b.dead.length} product photos, ${b.dead.length} skipped as known dead` +
      (b.stood.length
        ? `\n  ${b.stood.length} of those are cases with a captioned stand-in (` +
          b.stood.map((i) => `#${i.rank} ${i.name}`).join("; ") +
          `), ${b.blank} still blank`
        : "") +
      (b.cfg.filter ? `, ${b.multi} rows are cases or displays` : "")
  );
}
if (!built.length) {
  console.log("Nothing built. Run: node scripts/sync-raw-top.mjs and node scripts/sync-top100.mjs");
  process.exit(1);
}
