#!/usr/bin/env node
// Two ranked lists: /most-valuable-cards.html and /most-expensive-sealed.html
//
//   node scripts/build-top100.mjs
//
// Reads data/top100.json, written by scripts/sync-top100.mjs. That sync is a
// network job of a couple of minutes and is NOT in build-all.mjs, the same
// arrangement sync-sets.mjs and sync-chase.mjs have. This builder is, and it
// works from whatever the last sync left on disk, so a build with no network
// reprints the last lists with the date they were actually read on them.
//
// ---------------------------------------------------------------------------
// THE TITLE IS THE HONEST ONE, NOT THE ONE PEOPLE SEARCH FOR
// ---------------------------------------------------------------------------
//
// "The 100 most valuable Pokemon cards ever" is the phrase with the traffic and
// it is a claim this data cannot support, so it is not written anywhere on
// either page. What we hold is one marketplace's own Market Price for its
// English Pokemon catalogue, read on one day. So the pages say that:
//
//   The 100 most valuable RAW Pokemon cards on TCGplayer
//   The 100 most expensive SEALED Pokemon products on TCGplayer
//
// with the date in the subtitle and in a fact tile, and a block near the top
// that lists what the number is not. Four separate things are excluded and each
// one would change the ranking:
//
//   GRADED CARDS. A PSA 10 Base Set Charizard is a different object at a
//   different price and this feed does not carry it. The raw page says so.
//   JAPANESE CARDS. `productLineName: pokemon` is the English catalogue.
//   Japanese is a separate product line on the same site and is not ranked here.
//   AUCTION AND PRIVATE SALES. The million dollar cards people mean by "most
//   valuable" sell at Heritage and PWCC, not on TCGplayer, and nothing here
//   sees them.
//   THE LOWEST LISTING AND THE LAST SALE. Both are different numbers from
//   Market Price. The lowest listing is printed beside it on every row that has
//   one, precisely so the two cannot be confused.
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
// Each row carries one small link to that product's own TCGplayer page, in the
// price cell, reading "check on TCGplayer" with an aria-label saying it opens
// there. The case for it is not commercial and there is no affiliate code in
// it. It is that these two pages consist of two hundred numbers, and the whole
// reason they are allowed to exist is that every one of those numbers can be
// traced to a source. A page that boasts about checkability and then gives the
// reader no way to check is worse than one that never made the claim. The link
// IS the citation. Removing it does not keep anybody on the site, it just makes
// two hundred figures unverifiable.
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
// to go. Measured against the real data on 16 Aug 2026:
//
//   raw cards    4 of 100 belong to a set this site has a guide for. The rest
//                are vintage: Base Set, Neo Destiny, the EX era, Worlds promos.
//                45 of 100 name a Pokemon that has a page under /pokemon/.
//                The remaining 51 fall through to /search.html?q=<name>, which
//                is the site's own search and finds the card, the set or the
//                rip that pulled one.
//   sealed       42 of 100 map to a set guide. The rest go to
//                /how-many-packs.html, which is the page about what is inside a
//                sealed product and how many packs it holds, and is the actual
//                next question somebody asks about an $11,900 display case.
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
//   tcgplayer-cdn  _150w.jpg   150x206..214, 12.0 to 19.3KB   <- used
//   tcgplayer-cdn  _200w.jpg   200x274..286, 19.1 to 30.8KB
//   assets.tcgdex  low.avif    245x337, around 20KB, and only for cards
//
// The TCGplayer rendition is smaller than the TCGdex one at the size these rows
// draw, and it is CORRECT BY CONSTRUCTION: the image is addressed by the same
// productId the price came from, so a row cannot show one card's picture beside
// another card's price. Reaching TCGdex would need a hand-built mapping from 52
// vintage TCGplayer set names to TCGdex set ids, and a wrong picture is a worse
// failure than a slightly heavier one. TCGdex also has no photography at all
// for sealed product, so the sealed page could not use it either way.
//
// THE SMALLER RENDITIONS DO NOT EXIST. _50w, _100w and _120w all answer 403,
// checked against five product ids across both lists. _150w is the floor.
//
// NO WIDTH OR HEIGHT ATTRIBUTES, and that is deliberate rather than an
// oversight: this CDN's renditions are a fixed width and a VARIABLE height,
// 206 to 214px at 150w across the ids measured, which is why imgDims() in
// shared/format.mjs returns "" for this host. The box reserves the space in CSS
// instead. avifPicture() also declines this host, correctly: there is no AVIF
// at tcgplayer-cdn to offer.
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
// up front rather than fetched to find out, and neither is in either list
// today, which is checked rather than assumed. SIX OTHER IDS IN THESE LISTS ARE
// DEAD and are found by sync-top100.mjs, which fetches all 200 image urls on
// every run. A flagged row emits no <img> at all rather than an <img> plus an
// onerror, so the page never spends the round trip.
//
// ---------------------------------------------------------------------------
// WEIGHT, MEASURED 16 Aug 2026, BOTH NUMBERS RATHER THAN THE FLATTERING ONE
// ---------------------------------------------------------------------------
//
// Headless Chrome over CDP, cache off, scrolled to the bottom with lazy loading
// allowed to run. .claude/server.js sends no Content-Encoding, so the gzipped
// column re-totals every local html, css and js at gzip -9 and leaves the images
// and woff2 alone, which is what GitHub Pages actually serves.
//
//                              on-load                fully scrolled
//                          raw        gzip          raw        gzip
//   cards   390x844 DPR2   409.8KB    155.9KB     1,933.0KB   1,679.1KB
//   cards  1440x900 DPR2   506.4KB    252.5KB     1,933.9KB   1,680.0KB
//   sealed  390x844 DPR2   413.4KB    157.7KB     1,227.6KB     971.9KB
//   sealed 1440x900 DPR2   496.8KB    241.1KB     1,227.7KB     972.0KB
//
// QUOTE THE PAIR OR QUOTE NEITHER, the same rule CLAUDE.md sets for
// rarity.html. The first is what a reader waits for and it is fine. The second
// is what a hundred pictures cost somebody who reaches row 100, and there is no
// version of this page that shows 100 cards and does not pay it: 98 scans at
// 15.7KB average is 1.5MB of the 1.68. The desktop on-load figure is higher
// than the phone's because a 900px viewport with 119px rows has more rows above
// the fold, which is lazy loading working rather than failing.
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
import { esc, longDate, moneyExact, moneyCompact } from "../shared/format.mjs";
// WHY /base-set.html PRICES THE #1 CARD ON THIS LIST AT A TENTH OF THIS FIGURE.
// Read that file's header before changing a word of the honesty block below.
import { loadPriceBasis, basisSentence } from "../shared/price-basis.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const top = JSON.parse(await readFile(join(ROOT, "data/top100.json"), "utf8"));

// The same cards, priced by the other feed. Resolved by TCGplayer productId and
// by exact PriceCharting row name, so neither side can land on a wrong printing.
const BASIS = await loadPriceBasis();
const BASIS_TEXT = basisSentence(BASIS, "market");

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

const rx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where a row's big tap target goes. Always somewhere on this site. */
function internalLink(item, kind) {
  const guide = GUIDE[item.setName];
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
  const dead = item.noImg === true || DEAD.has(String(item.productId));
  const shot = dead
    ? `<span class="t100-img t100-img-none" aria-hidden="true"></span>`
    : // No width/height: this CDN's height varies by product. See the header.
      `<img class="t100-img" src="${esc(item.img)}" alt="" loading="lazy" decoding="async"
        onerror="this.classList.add('t100-img-none');this.removeAttribute('src')">`;

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

  // The one outbound link on the row. Argued in the header above. Labelled in
  // text and in the aria-label, no affiliate tag, and it is not the row's main
  // tap target.
  const check = `<a class="t100-check" href="${esc(item.url)}" rel="noopener nofollow"
      aria-label="Check ${esc(item.name)} on TCGplayer (opens TCGplayer)">check on TCGplayer</a>`;

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
  return `<li class="t100-li${form && form.multi ? " is-multi" : ""}">
  <span class="t100-rank">${item.rank}</span>
  <span class="t100-shot">${shot}</span>
  <a class="t100-name" href="${esc(link.href)}">${esc(item.name)}<span class="t100-go">, ${esc(link.why)}</span></a>
  <span class="t100-meta">${meta.join(' <i aria-hidden="true">&bull;</i> ')}</span>
  <span class="t100-set">${esc(item.setName)}</span>
  <span class="t100-tag">${esc(kind === "sealed" ? form.label : item.rarity || "")}</span>
  <span class="t100-count">${esc(listings)}</span>
  <span class="t100-price">
    <b>${esc(money(item.market))}</b>
    ${low}
    ${check}
    ${flag}
  </span>
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
/* THE THUMB TARGET, WITHOUT MOVING A PIXEL OF THE LAYOUT.
   Measured at 390x844: this link was 108.8 x 17.0, one 11px line box, and there
   are 100 of them on /most-valuable-cards.html and 100 more on
   /most-expensive-sealed.html. 17px is under half the 44px WCAG 2.5.5 asks for
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
  /* THE PICTURE GROWS ON DESKTOP BECAUSE THE BYTES ARE ALREADY PAID FOR. The
     smallest rendition this CDN serves is 150px wide; _50w, _100w and _120w all
     answer 403, checked on five ids. So a 52px box on a phone asks for nearly
     three times the pixels it paints and there is nothing to be done about it.
     Desktop has the room, so it takes 60px and then 72px, which at DPR 2 is 120
     and 144 real pixels against the 150 that arrived: the same download, most of
     it now actually used. */
  .t100-shot{width:60px;height:83px}
  /* The set, the rarity or form and the listing count get their own columns, so
     the line under the name stops repeating them. */
  .t100-meta{display:none}
  .t100-name{align-self:center;-webkit-line-clamp:2}
  .t100-set,.t100-tag,.t100-count{display:block;font-size:var(--t-sm);color:var(--ink-2);
    min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .t100-count{font-size:var(--t-label);text-align:right}
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
 */
function honesty(cfg, d) {
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
        }.</p>${
        // THE OTHER FEED, NAMED ON THE PAGE THAT LEADS WITH THE BIGGEST FIGURE.
        // Row 1 here is a Shadowless Base Set Charizard at ten times what
        // /base-set.html prints for the same ungraded card out of a price guide.
        // Both are correct measurements of different things, and until 17 August
        // 2026 neither page admitted the other existed. Cards only: the pairs in
        // shared/price-basis.mjs are single cards, so the sealed page has nothing
        // to reconcile and says nothing.
        cfg.key === "cards" && BASIS_TEXT
          ? `
      <p><b>Where a price guide disagrees with this list.</b>
        ${esc(BASIS_TEXT)} The guide figures for those Base Set printings are on
        <a href="/base-set.html">the Base Set print run guide</a>, which carries the same explanation
        from the other side.</p>`
          : ""
      }
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

function methodology(cfg, d) {
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

const PAGES = [
  {
    key: "cards",
    slug: "most-valuable-cards",
    og: "most-valuable-cards",
    navTitle: "Most valuable cards",
    title: "The 100 Most Valuable Raw Pokemon Cards on TCGplayer",
    h1: ["The 100 most valuable ", "raw", " Pokemon cards"],
    kicker: "Pokemon TCG &bull; Ungraded, English, priced by TCGplayer",
    lede:
      "Every one of these is a loose card, out of a sleeve, ungraded. Ranked by TCGplayer's own market price for " +
      "their English Pokemon catalogue, read on the date below and checked against a second TCGplayer source.",
    desc:
      "The 100 most valuable ungraded Pokemon cards by TCGplayer market price, read %DATE%. English cards only, " +
      "no graded slabs, no auction sales, with the cheapest live listing beside every market price.",
    lineTotal: "29,652",
    excludes:
      "Graded cards are not in it: a PSA 10 of any of these is a different object at a different price and this " +
      "feed does not carry one. Japanese cards are not in it either, because they are a separate catalogue on the " +
      "same site. Nor are the six and seven figure cards people usually mean by most valuable, because those sell " +
      "at auction houses and private sales that TCGplayer never sees.",
    searchBlurb: "The dearest ungraded singles on TCGplayer, ranked and dated",
    listLede:
      "Ranked by market price, dearest first. The picture, the name and the set take you to our page for it; " +
      "the small link under each price opens that product on TCGplayer so you can check the figure yourself.",
    filter: null,
  },
  {
    key: "sealed",
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
  const d = top[cfg.key];
  if (!d?.items?.length) {
    console.log(`  ${cfg.slug}: nothing in data/top100.json under "${cfg.key}", skipped. Run sync-top100.mjs.`);
    continue;
  }
  const items = d.items;
  const when = longDate(d.checked) || d.checked;
  const desc = cfg.desc.replace("%DATE%", when);
  const url = `${SITE}/${cfg.slug}.html`;

  // Any dead scan actually in this list, named rather than assumed away.
  const dead = items.filter((i) => i.noImg === true || DEAD.has(String(i.productId)));

  const multi = cfg.filter ? items.filter((i) => formOf(i.name).multi).length : 0;
  // Counted from the data rather than typed, because it is the kind of number
  // that is right on the day it is written and wrong every day after.
  cfg.aboveMarket = items.filter((i) => i.low != null && i.low > i.market).length;
  // Same rule, for the same reason: the honesty block used to promise the lowest
  // listing "on every row" and several rows carry none. Counted off the items.
  cfg.withLow = items.filter((i) => i.low != null).length;
  cfg.noLow = items.length - cfg.withLow;
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

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${esc(moneyCompact(items[0].market))}</div><div class="l">Dearest, ${esc(items[0].name)}</div></div>
      <div class="fact"><div class="n">${esc(moneyCompact(d.cut))}</div><div class="l">What it takes to make the 100</div></div>
      <div class="fact"><div class="n">${esc(String(d.walked))}</div><div class="l">Products checked to find them</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(when)}</div><div class="l">Prices read on</div></div>
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
      <span class="t100-h-name">Rank and name</span><span>Set</span><span>${cfg.key === "sealed" ? "Form" : "Rarity"}</span><span class="t100-h-count">For sale</span><span class="t100-h-price">Market price</span>
    </div>
    <ol class="t100" id="t100list">
${items.map((i) => row(i, cfg.key)).join("\n")}
    </ol>

    <p class="price-note" style="margin-top:var(--s5)">Prices are TCGplayer market prices for their English Pokemon
      catalogue, read on ${esc(when)} and re-read from a second TCGplayer endpoint the same day. They move daily, so
      treat them as the shape of the market rather than a quote. Product photography is TCGplayer's, shown at the size
      these rows draw it and linked back to the product it belongs to. The link under each price leaves this site and
      opens on TCGplayer; there is no affiliate code in it and we make nothing from it, it is there so you can check the
      number. ${dead.length ? `${dead.length} of these products have no photo in TCGplayer's catalogue and show an empty frame; that is their listing, not a fault here.` : ""}
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
  built.push({ cfg, d, items, dead, multi });
}

for (const b of built) {
  console.log(
    `Wrote public/${b.cfg.slug}.html\n` +
      `  ${b.items.length} rows, ${moneyExact(b.items[0].market)} down to ${moneyExact(b.d.cut)}, read ${b.d.checked}\n` +
      `  walked ${b.d.walked} products at ${moneyExact(b.d.floor)}+, ` +
      `${b.d.method.corroborated}/100 price-confirmed, ${b.d.method.sortAgreed}/${b.d.method.sortOf} agreed with their own sort\n` +
      `  ${b.items.length - b.dead.length} product photos, ${b.dead.length} skipped as known dead` +
      (b.cfg.filter ? `, ${b.multi} rows are cases or displays` : "")
  );
}
if (!built.length) {
  console.log("Nothing built. Run: node scripts/sync-top100.mjs");
  process.exit(1);
}
