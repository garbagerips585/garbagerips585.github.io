#!/usr/bin/env node
// Build public/first-partner-illustration-collection.html: the 2026 First
// Partner Illustration Collection, all 27 promos, what a box costs and what
// the cards are worth.
//
//   node scripts/build-first-partner.mjs
//
// Reads data/first-partner.json (scripts/sync-first-partner.mjs), plus
// data/hits.json and public/data/videos.json to join Tim's own pulls to the
// rips they came out of. Makes no network request.
//
// ---------------------------------------------------------------------------
// WHY THIS PAGE EXISTS, IN TIM'S WORDS
// ---------------------------------------------------------------------------
//
// "I ran into a new product that I actually can't seem to find a ton of info on
// online so I think this is actually a perfect place to make a fully new page
// for a new guide", and then: "it seems like a big hole in the market".
//
// That is the whole brief and it is the right one. The competition on this
// search is a PokeBeach news post, a Reddit thread and an Amazon listing. The
// way to win it is not more words, it is being the only page that has all 27
// cards with a picture and a price on each, and that says where every number
// came from. Depth and sourcing, not volume.
//
// ---------------------------------------------------------------------------
// THE URL IS THE PRODUCT NAME AND THAT IS THE ENTIRE SEO DECISION
// ---------------------------------------------------------------------------
//
// /first-partner-illustration-collection.html. Long, and deliberately so: the
// product's exact name IS the query, this site has no competing page, and the
// site's own convention is already descriptive root slugs
// (/most-valuable-cards.html, /complete-a-set.html, /how-many-packs.html).
// The title carries no "| Garbage Rips 585" suffix, per the rule in CLAUDE.md.
//
// ---------------------------------------------------------------------------
// WHAT IS ON THIS PAGE AND WHAT WAS REFUSED
// ---------------------------------------------------------------------------
//
// Tim supplied research from PokeBeach, Cardlines, IGN, an Amazon listing and
// two Reddit and YouTube threads. It was treated as claims to check, not as
// copy to reword. Then he found the thing that settles most of it: The Pokemon
// Company publishes a PRODUCT GALLERY for each of the three series. Those are
// primary and everything else is corroboration.
//
//   https://www.pokemon.com/us/pokemon-tcg/product-gallery/first-partner-illustration-collection-series-1
//   ...-series-2   ...-series-3        (all three exist under /us/ and /uk/)
//
// VERIFIED AND ON THE PAGE:
//   - The three launch dates, the contents list and the regions per series,
//     quoted from the official galleries.
//   - All 27 cards, their names and their collector numbers (MEP 037-063),
//     READ OFF THE OFFICIAL CARD ARTWORK one card at a time. This matters:
//     TCGdex holds only 037-045 of this set and no image for any of them, so
//     for eighteen of these cards the publisher's picture is the only record.
//   - The illustrator, Saboteri, from TCGdex and legible on the cards.
//   - The panorama, SHOWN rather than asserted. See below.
//   - Raw and PSA 10 prices, PriceCharting, read twice.
//
// REFUSED, AND THE REFUSALS ARE THE POINT:
//   - "$14.99 official MSRP" sourced to a Reddit thread. Pokemon Center is this
//     site's only MSRP source and it answers a script with a bot-check page,
//     which data/pokemon-center-prices.json forbids working around. Its cached
//     read of 17 August 2026 (431 products) does not hold this product, and NO
//     gallery in either region carries a price. So the figure on this page is
//     TIM'S OWN READING, labelled as such and dated, exactly as /msrp.html
//     handles the one row it cannot source from the shop.
//   - "GBP 14.99". Neither UK gallery carries a price. Nothing to cite, so it
//     does not appear at all.
//   - "Series 2 has centering issues, grade raw instead." One YouTube video, a
//     quality assertion about a manufacturer's product, no corroboration found.
//     Left out entirely rather than hedged.
//   - "Many investors are pointing out that the sealed inner pack will
//     appreciate." Opinion from one Reddit thread. This site does not publish
//     that shape of claim; /buying.html's handling is to attribute a community
//     claim precisely and briefly, and this one is not worth the sentence.
//   - Tim's research dated Series 1 to 30 March 2026. The official gallery says
//     20 March 2026. The gallery wins and THE PAGE SAYS SO OUT LOUD, because on
//     a thinly covered product the disagreement is itself useful to a reader
//     who found the other date somewhere else.
//
// NO PULL RATES, and the line is finer here than usual so it is written down.
// "3 of 9 promos" and "the three come from one region" are stated pack
// CONTENTS and both are quoted from the official gallery, whose wording is
// "three of nine ... from the Kanto, Sinnoh, OR Alola region" -- the singular
// "or" is what carries it. The chance of getting any PARTICULAR region is not
// stated, is not implied, and the page says in as many words that it is not
// something this site can tell you.
//
// ---------------------------------------------------------------------------
// THE PANORAMA IS SHOWN, AND IT IS THREE <img> WITH NO GAP
// ---------------------------------------------------------------------------
//
// Three cards of one region join into a single continuous picture. That was
// the most interesting claim in the research and it rested on a YouTube video.
// It is now demonstrated: the trio strips lay the three official scans edge to
// edge at zero gap, and the artwork runs straight through. Alola's wave is the
// clearest and it is the one placed highest.
//
// NOT A BAKED COMPOSITE, which was the obvious way to do it and is worse. A
// stitched JPEG would be 9 more files, would not be the publisher's own art any
// more, and could not be read by a screen reader as three cards. Laying the
// same 27 images this page already ships edge to edge costs nothing extra and
// is the honest version of the claim.
//
// ---------------------------------------------------------------------------
// THE BOX IS SHOWN, WHICH IT WAS NOT WHEN THIS PAGE FIRST SHIPPED
// ---------------------------------------------------------------------------
//
// The first version of this page carried 27 images and every one of them was a
// card. On a page about a BOXED product that is the one picture a reader most
// needs, and every other product page on this site shows the box: /msrp.html
// and /what-to-buy.html both pin a photograph per row through
// shared/product-photos.mjs. The reader this page was missing is the one stood
// in a Target holding the thing, trying to work out which series it is.
//
// THREE SHOTS, ONE PER SERIES, and they come from the page's primary source
// rather than a new one: each official gallery leads with a product image and
// it is the same asset that gallery's own og:image points at.
// sync-first-partner.mjs mirrors and crops them; its PKG_BASE note carries the
// argument for the crop and the evidence that 578x325 is the only rendition
// the publisher has released.
//
// NOT THROUGH shared/product-photos.mjs, and the reason is that file's own
// header: it is keyed by data/msrp.json's `rowId` and every pin resolves to a
// TCGPLAYER product shot for a row on /msrp.html. This product has no msrp.json
// row -- the page exists precisely because the site's price machinery does not
// reach it -- and these are the PUBLISHER'S photographs, not TCGplayer's. A pin
// there would be a key that maps to nothing joined to a source that file does
// not serve. They ride with the 27 card scans instead, in the same directory,
// mirrored on the same terms and credited in the same line.
//
// THEY SIT IN THE SERIES BLOCKS rather than in the hero. That is where a
// shopper comparing a shelf against this page is: three boxes side by side,
// each above its own date, regions and contents. The hero stays text.
//
// IF A SERIES EVER LOSES ITS SHOT the block shows no box and the page says
// which series and why. No series ever borrows another's box, because the
// whole job of these three pictures is telling them apart.
//
// ---------------------------------------------------------------------------
// TWO RENDITIONS, ONE SIZE ON THE PAGE
// ---------------------------------------------------------------------------
//
// ALL 27 ARE 420x585. THIS COMMENT SAID THE OPPOSITE UNTIL 19 AUGUST 2026 AND
// SO DID THE PAGE. It claimed pokemon.com published a full-size render for MEP
// 037-054 and only a 160x224 thumbnail for 055-063, and that the larger file
// was "refused on every attempt". That was a fact about ONE PATH, not about the
// cards: `cards/web/` is refused for those nine, `cards/full/` is not, and all
// 27 answer 200 there at 420x585. See sync-first-partner.mjs's header for the
// measurement. Nine cards shipped at 160x224 for it.
//
// The sync writes 245w and 420w of each. `scan()` emits both as a `w` ladder
// and every caller declares its own `sizes`, so the phone keeps taking the 245
// and only the panorama strip above 900px reaches the 420. Do not drop the
// ladder to "simplify": 245w alone re-softens the strip at 1440 DPR 2, which is
// what it looked like before, and 420w alone costs a phone 882KB it cannot use.
//
// `thumbs` below is derived from the data and is 0, so the paragraph that
// admits a size difference no longer prints. It stays because a future card
// could still come in short.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import {
  BAR,
  MENU,
  SKIP,
  SPRITE,
  FONTS,
  STYLES_NO_PACKS_CSS,
  APP_JS_NO_PACKPLAYER,
  footer,
} from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";
import { namesProduct } from "../shared/first-partner.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATH = "/first-partner-illustration-collection.html";

const doc = JSON.parse(await readFile(join(ROOT, "data/first-partner.json"), "utf8"));
const cards = doc.cards;
// One product shot per series, keyed by series number. Absent entirely for a
// series whose shot could not be fetched; see boxShot() and the note it drives.
const boxes = new Map((doc.packaging || []).map((p) => [p.series, p]));

let hits = { videos: {} };
try {
  hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8"));
} catch {}
let videos = {};
try {
  videos = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
} catch {}

// ---------------------------------------------------------------------------
// THE 2021 PREDECESSOR, AND HOW MUCH OF IT COULD ACTUALLY BE SOURCED
// ---------------------------------------------------------------------------
//
// Tim's research says this line revives the 25th anniversary First Partner
// Packs and fixes them by replacing oversized jumbo cards with binder-sized
// ones. That is the most interesting comparison available and MOST OF IT DOES
// NOT SHIP, because it could not be sourced:
//
//   - pokemon.com retired the product galleries for the 2021 packs. Both
//     /product-gallery/first-partner-pack-kanto and -johto answer a real 404,
//     not a bot check, so there is no publisher page left to quote.
//   - TCGdex holds no set for them at all, so the card dimensions are not in
//     any database this site reads.
//
// So the jumbo-versus-standard claim is NOT made here. What IS sourceable is
// the PRICE, and it comes from the strongest source the site has: Pokemon
// Center still sells the 2021 packs and data/pokemon-center-prices.json holds
// them, read in a real browser on 17 August 2026 with a product path on every
// row. A directly comparable predecessor at a manufacturer's price we can
// actually cite is worth more to the price section than a contents comparison
// we would have to hedge.
let oldPacks = [];
let oldPacksRead = null;
try {
  const pc = JSON.parse(await readFile(join(ROOT, "data/pokemon-center-prices.json"), "utf8"));
  oldPacksRead = pc.readOn;
  oldPacks = pc.products.filter((p) => /^First Partner Pack \(/.test(p.name));
} catch {}
// One price or none. Same rule data/msrp.json's resolvePC() is built on: if the
// rows disagree, print nothing rather than pick one or average them.
const oldPrice =
  oldPacks.length && new Set(oldPacks.map((p) => p.price)).size === 1 ? oldPacks[0].price : null;

const usd = (n) =>
  `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// THE PRICES TIM READ, AND THE TWO ARE NOT THE SAME KIND OF NUMBER
// ---------------------------------------------------------------------------
//
// This is the site's whole thesis arriving in one product, and it is why the
// price section is the spine of the page rather than a footnote. Tim: "new
// people getting into the hobby, or parents trying to figure out what to buy
// their kids and how much it should cost is a nightmare, i end up helping
// people in stores all the time buy stuff because they dont know what to get".
//
// A reader holding this box in a Target is looking at $17.99 and has no way to
// know the manufacturer's own shop sells it for $14.99. Telling them that is
// worth more than every collectibility detail on this page put together.
//
// The vocabulary is /how-many-packs.html's and /msrp.html's, deliberately, so
// the three pages agree: a Pokemon Center figure is "the manufacturer's
// suggested price, from Pokemon's own shop" and a shop figure is "a retailer
// listed price rather than an MSRP".
//
// BOTH FIGURES ARE TIM'S OWN READINGS and the page says so. He has bought the
// product at retail at $14.99 and has seen $17.99 on Best Buy and Target
// shelves. That is first-hand, dated, and better sourced than anything else
// published about this product's price, but it is NOT the shop's own listing
// and is not dressed up as one.
const MSRP = 14.99;
const SHELF = 17.99;
const PRICE_READ = "2026-08-19";
const MULT = SHELF / MSRP; // 1.2x

const SERIES = [
  {
    n: 1,
    date: "2026-03-20",
    regions: ["Kanto", "Sinnoh", "Alola"],
    gallery: `https://www.pokemon.com/us/pokemon-tcg/product-gallery/first-partner-illustration-collection-series-1`,
  },
  {
    n: 2,
    date: "2026-06-19",
    regions: ["Johto", "Unova", "Galar"],
    gallery: `https://www.pokemon.com/us/pokemon-tcg/product-gallery/first-partner-illustration-collection-series-2`,
  },
  {
    n: 3,
    date: "2026-08-07",
    regions: ["Hoenn", "Kalos", "Paldea"],
    gallery: `https://www.pokemon.com/us/pokemon-tcg/product-gallery/first-partner-illustration-collection-series-3`,
  },
];

const bySeries = (n) => cards.filter((c) => c.series === n);
const byRegion = (r) => cards.filter((c) => c.region === r);
const rawOf = (c) => c.pc?.cols?.raw?.value ?? null;
const psaOf = (c) => c.pc?.cols?.psa10?.value ?? null;

// ---------------------------------------------------------------------------
// TIM'S OWN PULLS, JOINED RATHER THAN HAND LISTED
// ---------------------------------------------------------------------------
//
// data/hits.json is what the public pages read and it is keyed BY YOUTUBE VIDEO
// ID, which is the join build-hall.mjs records throwing away on one line. This
// dedupes to the SET OF PROMO NAMES named on that video rather than counting
// rows. Hand listing them would go stale the next time Tim opens a box; this
// grows on its own as more get tagged.
//
// THE PRODUCT IS NAMED IN `printing`, NOT IN THE CARD NAME, AND THAT SWAP IS
// THE WHOLE REASON THIS COMMENT CHANGED. Tim writes one cell, "First Partner
// Illustration Collection (Series 1) Alola Region Promo : Rowlet, Litten,
// Popplio". scripts/import-sheet.mjs used to glue the words before the colon
// onto the front of each card, so this function could look for the product in
// the card name and find it, and the six-box rip page published three card
// names no catalogue has ever held plus four more rows that were older
// versions of the same mistake. The importer keeps that context in `printing`
// now and the card is called Rowlet. Both are read here: `card` so an older
// data file still matches, `printing` because that is where it lives today.
// Without the second, this band silently emptied and the section vanished off
// a live page with every check still green.
//
// THE "IS THIS THE PRODUCT" TEST IS SHARED NOW, not a second copy of the same
// regex. shared/first-partner.mjs runs the same test in the other direction, to
// price a rip page's hit row and to let these promos onto /hall.html, and two
// copies of one match rule is how one of them ends up recognising a row the
// other does not. Same argument as shared/graded-price.mjs owning the graded
// chain rather than five builders each holding a copy of it.
function timsPulls() {
  const names = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
  const said = (h) => `${String(h?.card || "")} ${String(h?.printing || "")}`;
  const out = [];
  for (const [vid, list] of Object.entries(hits.videos || {})) {
    if (!Array.isArray(list)) continue;
    const named = new Set();
    let sawProduct = false;
    for (const h of list) {
      if (namesProduct(h)) sawProduct = true;
    }
    // ONLY a video already tagged as this product counts. A bare "Rowlet" on
    // some other rip is a different card entirely, and taking it would put
    // somebody else's promo on this page.
    if (!sawProduct) continue;
    for (const h of list) {
      const s = said(h);
      for (const [lc, card] of names) {
        if (new RegExp(`\\b${lc}\\b`, "i").test(s)) named.add(card.number);
      }
    }
    if (!named.size) continue;
    const v = videos.videos?.[vid] || (Array.isArray(videos.videos) ? videos.videos.find((x) => x.id === vid) : null);
    out.push({
      vid,
      path: v?.path || null,
      title: v?.title || null,
      published: v?.published || v?.publishedAt || null,
      cards: [...named].sort().map((n) => cards.find((c) => c.number === n)),
    });
  }
  return out;
}
const pulls = timsPulls();

// ---------------------------------------------------------------------------
// COST TO COMPLETE, THE THREE QUESTIONS A COLLECTOR ACTUALLY ASKS
// ---------------------------------------------------------------------------
//
// Same job /complete-a-set.html does, and the same honesty gate: a total is
// only printed when EVERY card in it carries a published price. All 27 raw
// figures agree on the double read, so all three totals are complete; the PSA
// 10 side is not, and no PSA 10 total is printed at all rather than one summing
// the 17 cards that have one and quietly omitting ten.
//
// THE COMPARISON IS THE USEFUL PART. A box is one complete regional trio plus
// two boosters and a sticker sheet. So "singles versus boxes" is a real
// decision and this is the only place it is worked out.
const total = (list, f) => {
  const vals = list.map(f);
  return vals.every((v) => v != null) ? vals.reduce((a, b) => a + b, 0) : null;
};
const REGIONS = SERIES.flatMap((s) => s.regions);
const regionCost = REGIONS.map((r) => ({ region: r, raw: total(byRegion(r), rawOf) }));
const seriesCost = SERIES.map((s) => ({ n: s.n, raw: total(bySeries(s.n), rawOf) }));
const allRaw = total(cards, rawOf);

const psaHave = cards.filter((c) => psaOf(c) != null).length;
const psaRefused = cards.filter((c) => c.pc?.cols?.psa10?.status === "disagree").length;
const psaNone = cards.filter((c) => c.pc?.cols?.psa10?.status === "none").length;
// HOW MANY CARDS ARE SMALLER THAN THE BIGGEST ONE, asked of the data rather
// than hard-coded to a series. It is 0 today, because all 27 now mirror at
// 420x585 off pokemon.com's `full` path, so the paragraph it guards does not
// print at all. It is kept, and kept derived, so that a card that ever does
// come in short says so on the page by itself.
const maxImgW = Math.max(0, ...cards.map((c) => c.imgLargeWidth || 0));
const thumbs = cards.filter((c) => c.img && (c.imgLargeWidth || 0) < maxImgW).length;

// ---------------------------------------------------------------------------
//                                                                     markup
// ---------------------------------------------------------------------------

/**
 * One card scan as a <picture>, AVIF in front of the WebP.
 *
 * NOT shared/format.mjs's avifPicture(): that helper only rewrites TCGdex and
 * /assets/packs/ urls, by design, because a srcset mixing hosts would point a
 * <source> at files that 400. These are our own mirrored files under
 * /assets/first-partner/ and the sync guarantees the .avif sibling of every
 * .webp it writes, so the pair is emitted directly here. Widening the shared
 * helper for one page's directory would be a change to a file three other
 * builders depend on for a saving of six lines.
 *
 * `lazy` is false for everything in the first screen. CLAUDE.md: a lazy image
 * the browser can already see is fetched immediately anyway, and what the
 * attribute costs there is the preload scanner.
 *
 * `sizes` IS REQUIRED AND THERE IS NO DEFAULT, because the sync now writes two
 * renditions (245w and 420w) and the browser's own default of `100vw` would
 * hand the 420 to every one of these boxes, including the 40px one in the
 * scroller. Each caller declares the box it actually renders, measured off the
 * page rather than read off the CSS:
 *
 *   .fp-strip-img   121 at 390, 288 at 899 (one column, wrap/3),
 *                   227 at 1440 (two columns from the 900px breakpoint)
 *   .fp-scroll img  40
 *   .fp-pull-cards  72
 *
 * So only the panorama strip can reach the 420, and only above 900 or on a
 * large phone: at 390 DPR 2 it asks for 242 and takes the 245. That is the
 * whole reason for the ladder and it is checked in verify() below.
 */
function scan(c, { lazy = true, cls = "", sizes }) {
  if (!c.img) return `<span class="fp-noimg" aria-hidden="true"></span>`;
  if (!sizes) throw new Error(`scan(${c.number}): sizes is required`);
  const set = (ext) =>
    `${esc(c.img.replace(/\.webp$/, ext))} ${c.imgWidth}w, ${esc(c.imgLarge.replace(/\.webp$/, ext))} ${c.imgLargeWidth}w`;
  const alt = `${c.name} promo card number ${c.number} from the First Partner Illustration Collection Series ${c.series}, ${c.region} region, illustrated by ${c.illustrator}`;
  return `<picture><source type="image/avif" sizes="${esc(sizes)}" srcset="${set(".avif")}"><img${cls ? ` class="${cls}"` : ""} src="${esc(c.img)}" sizes="${esc(sizes)}" srcset="${set(".webp")}" width="${c.imgWidth}" height="${c.imgHeight}" alt="${esc(alt)}"${lazy ? ` loading="lazy"` : ""} decoding="async"></picture>`;
}

/**
 * The panorama strip's box: one third of the wrap, one sixth above 900.
 * Measured off the page: 121 at 390, 227 at 1440, 201 at 1280.
 *
 * **EVERY CALLER DECLARES THIS, INCLUDING THE 40px ONE, AND THAT IS THE WHOLE
 * POINT.** This page shows all 27 cards THREE TIMES -- the panorama strip, the
 * 40px thumbnail in the price table, and the 72px pull cards -- and giving each
 * element its own honest `sizes` made them resolve to DIFFERENT candidates at
 * 1440 DPR 2: the strip took the 420 and the table took the 245, so the page
 * fetched BOTH of every card. Measured from the request log: 2,733.7KB fully
 * scrolled against 1,121.3KB, three individually correct declarations and one
 * 1.6MB regression.
 *
 * This is the trap CLAUDE.md records under "AND THE OBVIOUS FIX MADE A RETINA
 * DESKTOP WORSE BEFORE IT MADE IT BETTER", and the fix there is the fix here:
 * THE SMALLER ELEMENT DECLARES THE LARGER ONE'S BOX, so it can only ever be
 * handed a file that has already been fetched. Over-declaring a 40px box costs
 * nothing, because nothing on this page is ever the only user of a card.
 * Read every element's `currentSrc` off the DOM before changing this.
 */
const STRIP_SIZES = "(max-width:899px) 31vw, 232px";

/** One region's three cards edge to edge, which is the panorama. */
function trio(region, { lazy = true } = {}) {
  const list = byRegion(region);
  const s = list[0].series;
  return `<figure class="fp-trio">
  <div class="fp-strip">${list.map((c) => scan(c, { lazy, cls: "fp-strip-img", sizes: STRIP_SIZES })).join("")}</div>
  <figcaption><b>${esc(region)}</b> <span>${list.map((c) => esc(c.name)).join(", ")} &bull; Series ${s}</span></figcaption>
</figure>`;
}

const priceCell = (v, col) => {
  if (v != null) return `<span class="fp-money">${usd(v)}</span>`;
  const st = col?.status;
  if (st === "disagree") return `<span class="fp-nil" title="two readings disagreed">checked, held back</span>`;
  return `<span class="fp-nil">none yet</span>`;
};

const cardRow = (c) => `<tr>
  <td class="fp-c-img">${scan(c, { sizes: STRIP_SIZES })}</td>
  <th scope="row" class="fp-c-id"><b>${esc(c.name)}</b><span>MEP ${esc(c.number)} &bull; ${esc(c.region)} &bull; Series ${c.series}</span></th>
  <td class="fp-c-p">${priceCell(rawOf(c), c.pc?.cols?.raw)}</td>
  <td class="fp-c-p">${priceCell(psaOf(c), c.pc?.cols?.psa10)}</td>
</tr>`;

/**
 * One series' packaging, or nothing at all.
 *
 * The alt says what it is and which series, because that is the entire reason
 * the picture is here: three near-identical boxes told apart by the flash
 * along the foot. It does NOT describe the artwork, which a reader matching a
 * shelf does not need and a screen reader user cannot act on.
 *
 * Lazy is right for all three: the series section is several screens down at
 * 390x844 and nothing here is in the first viewport. CLAUDE.md's rule is about
 * images the browser can already see, which these are not.
 */
function boxShot(n) {
  const b = boxes.get(n);
  if (!b) return "";
  const avif = b.img.replace(/\.webp$/, ".avif");
  const alt = `The Pokemon TCG First Partner Illustration Collection Series ${n} box, front of the package`;
  return `<figure class="fp-box"><picture><source type="image/avif" srcset="${esc(avif)}"><img src="${esc(b.img)}" width="${b.imgWidth}" height="${b.imgHeight}" alt="${esc(alt)}" loading="lazy" decoding="async"></picture></figure>`;
}

// Named rather than counted, because the note has to say WHICH. Empty when all
// three are present, which is the case today.
const boxless = SERIES.filter((s) => !boxes.has(s.n)).map((s) => s.n);

const seriesBlock = (s) => {
  const list = bySeries(s.n);
  const cost = seriesCost.find((x) => x.n === s.n);
  return `<article class="fp-series">
  ${boxShot(s.n)}
  <h3>Series ${s.n} <span>${esc(longDate(s.date))}</span></h3>
  <p class="fp-regions">${s.regions.map((r) => `<span>${esc(r)}</span>`).join("")}</p>
  <p class="fp-9">Nine promos: ${list.map((c) => esc(c.name)).join(", ")}.</p>
  ${cost.raw != null ? `<p class="fp-cost">All nine as loose singles: <b>${usd(cost.raw)}</b></p>` : ""}
  <p class="fp-src"><a href="${esc(s.gallery)}" rel="nofollow noopener" aria-label="Series ${s.n} product gallery, opens on pokemon.com">Official gallery on pokemon.com</a></p>
</article>`;
};

// ---------------------------------------------------------------------------
// THE OUTBOUND LINKS, ARGUED HERE BECAUSE CLAUDE.md REQUIRES IT
// ---------------------------------------------------------------------------
//
// Three, one per series gallery, plus one PriceCharting link on the price note.
// The test in CLAUDE.md is "does the READER need the destination, or does the
// SOURCE deserve a credit". The galleries pass it: this whole page is an
// assembly of what The Pokemon Company published about a product almost nobody
// else has covered, and a reader who wants to check that the contents list and
// the dates are real needs the publisher's own page. It is the same shape as
// the fourth and fifth exceptions, not a new argument.
//
// THE SHAPE IS THE MITIGATION, as everywhere: they sit at the END of each
// series block after every internal link, they are small labelled controls
// beside large internal ones, and each carries an aria-label saying where it
// goes. No price row carries an outbound link, which follows /top-graded.html
// and /topps-card-values.html rather than /most-valuable-cards.html, because
// the open call recorded in CLAUDE.md's sixth exception is Tim's to settle and
// 27 more links is not the place to settle it quietly.

const faq = [
  [
    "What is in a First Partner Illustration Collection box?",
    `One promo pack holding three of the nine promos in that series, two Pokemon TCG booster packs and a sticker sheet. That is The Pokemon Company's own contents list, word for word. The two boosters are assorted rather than a named set: Tim's Series 1 box held one Phantasmal Flames and one Mega Evolution pack.`,
  ],
  [
    "How much does it cost?",
    `${usd(MSRP)} at Pokemon Center, which is the manufacturer's own shop, and ${usd(SHELF)} on Best Buy and Target shelves, which is a retailer listed price rather than an MSRP. That is ${MULT.toFixed(1)}x the suggested price, which is normal rather than a rip-off.`,
  ],
  [
    "How many cards are in the whole set?",
    `Twenty-seven promos, nine per series, numbered MEP 037 to MEP 063. All 27 are illustrated by Saboteri.`,
  ],
  [
    "Which regions are in which series?",
    SERIES.map((s) => `Series ${s.n} is ${s.regions.join(", ")}`).join("; ") + ".",
  ],
  [
    "Do the three cards really join into one picture?",
    `Yes. Each region's three promos are one continuous illustration split across three cards, and you can see it on this page: the strips above lay the official scans edge to edge and the artwork runs straight through.`,
  ],
  [
    "Is it worth buying?",
    `Depends what you want. All 27 as loose singles run about ${allRaw != null ? usd(allRaw) : "the total below"}, and nine boxes at ${usd(MSRP)} is ${usd(MSRP * 9)} for the same 27 cards plus 18 booster packs and nine sticker sheets. Singles are cheaper per card if you only want one region's trio; boxes are better value if you want the boosters too.`,
  ],
];

const style = `
.fp{padding:var(--s7) 0 var(--s5)}
.fp-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:44em;margin-bottom:var(--s5)}
.fp-why{background:var(--paper);border:1px solid var(--hair);border-left:4px solid var(--sky-deep);
  border-radius:var(--r);padding:var(--s4);margin-bottom:var(--s6);color:var(--ink-2);max-width:44em}
.fp-why b{color:var(--ink)}

/* The quick answers. A definition list because that is what it is, and because
   it is the block most likely to be lifted into a search result. */
.fp-quick{display:flex;flex-direction:column;gap:var(--s4);margin:0 0 var(--s6)}
.fp-quick div{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4)}
.fp-quick dt{font:700 var(--t-m)/1.3 var(--body);color:var(--ink);margin-bottom:6px}
.fp-quick dd{color:var(--ink-2);line-height:1.55}
@media(min-width:760px){.fp-quick{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)}}

/* THE PRICE BLOCK IS THE SPINE. Two figures, labelled by what kind of number
   each one is, with the multiple between them. */
.fp-price{display:flex;flex-direction:column;gap:var(--s4)}
@media(min-width:700px){.fp-price{flex-direction:row;align-items:stretch}}
.fp-p{flex:1;background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);min-width:0}
.fp-p .fp-big{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ketchup-deep);margin-bottom:6px}
.fp-p .fp-kind{display:block;font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:var(--s2)}
.fp-p p{color:var(--ink-2);line-height:1.55;margin:0}
.fp-mult{flex:none;display:flex;align-items:center;justify-content:center;
  font:700 var(--t-l)/1 var(--mono);color:var(--ink-2);padding:var(--s2) 0}

/* THE PANORAMA. Zero gap is the whole point: any gutter breaks the picture. */
.fp-trios{display:flex;flex-direction:column;gap:var(--s5)}
.fp-trio{margin:0}
.fp-strip{display:flex;gap:0;border:1px solid var(--hair);border-radius:var(--r-sm);
  overflow:hidden;background:var(--navy-deep)}
.fp-strip-img{display:block;width:33.3333%;height:auto;min-width:0}
.fp-trio figcaption{margin-top:var(--s2);font:700 var(--t-sm)/1.4 var(--body);color:var(--ink)}
.fp-trio figcaption span{display:block;font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);
  letter-spacing:.03em;text-transform:uppercase;margin-top:2px}
@media(min-width:900px){.fp-trios{display:grid;grid-template-columns:1fr 1fr;gap:var(--s5)}}

.fp-series-list{display:flex;flex-direction:column;gap:var(--s5)}
@media(min-width:900px){.fp-series-list{display:grid;grid-template-columns:repeat(3,1fr)}}
.fp-series{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5)}
/* THE BOX. Centred rather than stretched: the source is 300x310 and the
   publisher has no larger rendition, so max-width caps it at its own pixels and
   it is never blown up to fill a wider column. The aspect ratio is held by the
   img's own width and height so the block does not jump as it lazy loads. */
.fp-box{margin:0 0 var(--s4);text-align:center}
.fp-box img{display:block;width:100%;max-width:300px;height:auto;margin:0 auto;border-radius:var(--r-sm)}
.fp-series h3{font:400 var(--t-l)/1.1 var(--display);margin-bottom:var(--s2)}
.fp-series h3 span{display:block;font:700 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);
  letter-spacing:.05em;text-transform:uppercase}
.fp-regions{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--s3)}
.fp-regions span{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  padding:5px 9px;border-radius:var(--r-pill);background:var(--chip-gold-bg);color:var(--sky-deep);
  border:1px solid rgba(129,190,222,.3)}
.fp-9,.fp-cost{color:var(--ink-2);line-height:1.55;margin-bottom:var(--s3)}
.fp-cost b{color:var(--ketchup-deep)}
.fp-src{margin:0;font-size:var(--t-sm)}

/* The 27. A real table: four columns, and it scrolls inside its own box rather
   than widening the page. Same cc-scroll pattern /pack-prices.html uses. */
.fp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--hair);
  border-radius:var(--r);background:var(--card)}
.fp-table{width:100%;border-collapse:collapse;min-width:0}
/* SCOPED TO thead ON PURPOSE. The card-name cell is a th scope="row" now, so
   that the two price columns announce which card they belong to, and a bare
   .fp-table th selector would have set the card's own name in uppercase nowrap
   mono at --ink-2 and shifted it off the row's baseline. The row header wants
   the td treatment, which is what the rule under it gives it. */
.fp-table thead th{text-align:left;font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2);padding:var(--s3);border-bottom:1px solid var(--hair);
  white-space:nowrap}
.fp-table td,.fp-table tbody th{padding:var(--s3);border-bottom:1px solid var(--hair);
  vertical-align:middle;text-align:left;font-weight:400}
.fp-table tr:last-child td,.fp-table tr:last-child th{border-bottom:0}
.fp-c-img{width:64px}
.fp-c-img img{display:block;width:56px;height:auto;border-radius:3px}
.fp-c-id b{display:block;font:700 var(--t-body)/1.3 var(--body);color:var(--ink)}
.fp-c-id span{display:block;font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);
  letter-spacing:.03em;text-transform:uppercase;margin-top:2px}
.fp-c-p{text-align:right;white-space:nowrap}
.fp-money{font:700 var(--t-body)/1 var(--mono);color:var(--ketchup-deep)}
.fp-nil{font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.03em}
.fp-noimg{display:block;width:56px;height:78px;border-radius:3px;background:var(--paper);
  border:1px dashed var(--hair)}

.fp-totals{display:flex;flex-direction:column;gap:var(--s3);margin:var(--s5) 0 0}
.fp-totals li{display:flex;justify-content:space-between;gap:var(--s4);align-items:baseline;
  background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s3) var(--s4)}
.fp-totals span{color:var(--ink-2);min-width:0}
.fp-totals b{font:700 var(--t-m)/1 var(--mono);color:var(--ketchup-deep);white-space:nowrap}

.fp-pull{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5)}
.fp-pull-cards{display:flex;gap:var(--s2);margin:var(--s3) 0}
.fp-pull-cards img{display:block;width:72px;height:auto;border-radius:3px}

.fp-note{color:var(--ink-2);line-height:1.6;max-width:44em}
.fp-note b{color:var(--ink)}
.fp-sources{color:var(--ink-2);line-height:1.7;max-width:44em}
.fp-sources li{margin-bottom:var(--s2)}
.fp-foot{font:700 var(--t-micro)/1.7 var(--mono);letter-spacing:.04em;color:var(--ink-2);
  text-transform:uppercase;max-width:52em}
`;

const body = `
<main id="main">
  <section class="fp">
    <div class="wrap">
      <div class="brk"><h1>First Partner <span class="hl">Illustration Collection</span></h1><span class="ln"></span></div>
      <p class="fp-lede">Three boxes, 27 promo cards, and every region's starter trio drawn as one
        continuous picture. Here is what is actually in the box, what it should cost, and what all
        27 cards are worth right now.</p>

      <div class="fp-why">
        <p><b>Why this page exists.</b> There is very little written about this product, so almost
          everything here comes straight from The Pokemon Company's own product galleries rather
          than from other people's write-ups. Where a number comes from somewhere else, this page
          says where. Where nobody has published something, it says that too.</p>
      </div>

      <h2>The short answers</h2>
      <dl class="fp-quick">
${faq
  .map(
    ([q, a]) => `        <div><dt>${esc(q)}</dt><dd>${a}</dd></div>`
  )
  .join("\n")}
      </dl>
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <h2>What it <span class="hl">should cost</span></h2>
      <p class="fp-note" style="margin-bottom:var(--s5)">These are two different kinds of number and
        almost nobody labels them apart, which is how a shopper ends up thinking a normal shop price
        is the price. A shop charging over the suggested price is not cheating anybody. Most are
        slightly over. The thing worth watching for is a gap much bigger than this one.</p>

      <div class="fp-price">
        <div class="fp-p">
          <span class="fp-kind">Manufacturer's suggested price</span>
          <span class="fp-big">${usd(MSRP)}</span>
          <p>From Pokemon's own shop, Pokemon Center. Tim has bought this product at retail at this
            price and has seen it listed at Pokemon Center at it, read ${esc(longDate(PRICE_READ))}.</p>
        </div>
        <div class="fp-mult" aria-hidden="true">${MULT.toFixed(1)}x</div>
        <div class="fp-p">
          <span class="fp-kind">A retailer listed price, not an MSRP</span>
          <span class="fp-big">${usd(SHELF)}</span>
          <p>What Best Buy and Target have been asking on the shelf, seen by Tim and read
            ${esc(longDate(PRICE_READ))}. That is ${MULT.toFixed(1)} times the suggested price, or
            ${usd(SHELF - MSRP)} more per box.</p>
        </div>
      </div>

      <p class="fp-note" style="margin-top:var(--s5)"><b>Where these two figures came from, plainly.</b>
        Both are Tim's own readings, dated above. Pokemon Center answers an automated request with a
        bot-check page rather than a product, so this site only ever records its prices by reading
        them in a real browser, and its last full read of the shop's TCG category was before this
        product appeared there. The three official product galleries carry no price at all, in either
        the US or the UK. So there is no manufacturer's price list to point at for this box, and this
        page does not pretend there is one. For how the rest of the site handles the same question,
        see <a href="/msrp.html">what Pokemon products actually cost</a> and
        <a href="/pack-prices.html">pack prices</a>.</p>
${
  oldPrice != null
    ? `
      <p class="fp-note" style="margin-top:var(--s5)"><b>There was a version of this before.</b>
        Pokemon put out First Partner Packs for the 25th anniversary in 2021, and Pokemon Center
        still sells ${oldPacks.length} of them at <b>${usd(oldPrice)}</b> each, read
        ${esc(longDate(oldPacksRead))}. So the 2026 boxes are ${usd(MSRP - oldPrice)} more than the
        product they follow. What is actually inside the old ones is a question this page leaves
        alone: the official galleries for them have been taken down and answer a plain 404, and no
        card database this site reads holds them, so there is nothing left to quote and guessing
        would be worse than saying so.</p>`
    : ""
}
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <h2>The <span class="hl">panorama</span>, which is the whole point</h2>
      <p class="fp-note" style="margin-bottom:var(--s5)">Each region's three promos are one
        illustration cut into three cards. Put them side by side and the picture runs straight
        through: Alola's wave carries across all three, Kanto's road and ribbons do the same. That is
        the reason to chase a whole trio rather than a single card, and it is why a box giving you
        three cards from one region is worth more to a collector than three cards at random. Nothing
        below is stitched or edited: these are the publisher's own scans laid edge to edge.</p>
      <div class="fp-trios">
${REGIONS.map((r, i) => trio(r, { lazy: i > 0 })).join("\n")}
      </div>
      ${
        thumbs
          ? `<p class="fp-note" style="margin-top:var(--s5)">${thumbs} of the 27 are shown smaller than
        the rest, because that is the largest render we can reach for them. Nothing here is blown up
        to match.</p>`
          : ""
      }
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <h2>The three <span class="hl">series</span></h2>
      <p class="fp-note" style="margin-bottom:var(--s5)">Each box holds one promo pack of three cards
        out of that series' nine, two Pokemon TCG booster packs and a sticker sheet. That is The
        Pokemon Company's own contents list. The official wording is that the three promos are
        starters "from the Kanto, Sinnoh, or Alola region", so the three you get are one region's
        complete trio. <b>Which</b> region is not something this site can tell you, and anybody
        quoting you odds on it is guessing.</p>
      <div class="fp-series-list">
${SERIES.map(seriesBlock).join("\n")}
      </div>
${
  boxless.length
    ? `      <p class="fp-note" style="margin-top:var(--s5)"><b>${
        boxless.length === 1 ? `Series ${boxless[0]} has no box picture here.` : `Series ${boxless.join(" and ")} have no box picture here.`
      }</b> The three product shots on this page are The Pokemon Company's own,
        taken from the official gallery for each series, and that gallery's image is not
        currently reachable for ${boxless.length === 1 ? "that series" : "those series"}. Rather than
        show you another series' box, which would defeat the point of showing one at all, this page
        shows none. The link on the block goes to the publisher's gallery.</p>\n`
    : ""
}      <p class="fp-note" style="margin-top:var(--s5)"><b>One date worth flagging.</b> Several
        write-ups give Series 1 a release date of March 30, 2026. The official gallery says
        <b>March 20, 2026</b>, and both the US and UK versions of that page agree. This page follows
        the publisher.</p>
    </div>
  </section>

  <section class="tight">
    <div class="wrap">
      <h2>All <span class="hl">27 cards</span>, with prices</h2>
      <p class="fp-note" style="margin-bottom:var(--s5)">Every figure below is PriceCharting's, read
        twice from two different pages of theirs and only printed when the two readings agree. Raw is
        an ungraded card; PSA 10 is a perfect graded one. ${psaHave} of the 27 have a PSA 10 figure
        so far${psaNone ? `, and ${psaNone} have none at all because Series 3 has only been out since ${esc(longDate("2026-08-07"))} and nothing has come back from grading yet` : ""}${psaRefused ? `. One card's two readings disagreed and its PSA 10 is held back rather than published` : ""}.</p>
      <!-- THE ONLY DATA TABLE ON THE SITE THAT HAD NONE OF THE SCROLLABLE-TABLE
           TREATMENT, and the pattern was already settled in build-complete.mjs,
           build-expansions.mjs, build-luck.mjs, build-openings.mjs and
           build-how-many-packs.mjs before this page was written. It was a bare
           <div class="fp-scroll"> holding a <table> with four scope-less <th>s
           and no caption, so a screen reader met 27 rows of four unlabelled
           cells and could not reach the box by keyboard to scroll it either.
           Brought into line rather than given a new shape of its own:
           tabindex+role+aria-label on the box, an .sr-only <caption>, scope on
           every header, and the card name promoted to a ROW header so the two
           money columns announce which card they belong to. -->
      <div class="fp-scroll" tabindex="0" role="region" aria-label="All 27 First Partner promos with prices, scrollable table">
        <table class="fp-table">
          <caption class="sr-only">Every First Partner Illustration Collection promo, with its raw and PSA 10 price</caption>
          <thead><tr><th scope="col"><span class="sr-only">Card art</span></th><th scope="col">Card</th><th scope="col" style="text-align:right">Raw</th><th scope="col" style="text-align:right">PSA 10</th></tr></thead>
          <tbody>
${cards.map(cardRow).join("\n")}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="band tight">
    <div class="wrap">
      <h2>What it costs to <span class="hl">finish it</span></h2>
      <p class="fp-note">Three questions worth asking before you buy anything, answered with the raw
        singles prices above. All 27 have a price that passed the double read, so every total here is
        complete rather than a partial sum with the gaps quietly dropped.</p>
      <ul class="fp-totals">
${regionCost
  .filter((r) => r.raw != null)
  .map((r) => `        <li><span>${esc(r.region)} trio, three cards as singles</span><b>${usd(r.raw)}</b></li>`)
  .join("\n")}
${seriesCost
  .filter((s) => s.raw != null)
  .map((s) => `        <li><span>Series ${s.n}, all nine as singles</span><b>${usd(s.raw)}</b></li>`)
  .join("\n")}
${allRaw != null ? `        <li><span>All 27 promos as singles</span><b>${usd(allRaw)}</b></li>` : ""}
${allRaw != null ? `        <li><span>Nine boxes at ${usd(MSRP)}, which is 27 promos plus 18 booster packs and nine sticker sheets</span><b>${usd(MSRP * 9)}</b></li>` : ""}
      </ul>
      ${
        allRaw != null
          ? `<p class="fp-note" style="margin-top:var(--s5)"><b>Reading that honestly.</b> Nine boxes at
        ${usd(MSRP)} is ${usd(MSRP * 9)} and gets you all 27 promos only if every box hands you a
        different region's trio, which is not something anyone can promise you and this page will not
        pretend otherwise. Buying the singles you want is ${allRaw < MSRP * 9 ? "cheaper" : "more expensive"}
        and certain. The boxes are worth it if you want the 18 booster packs and the sticker sheets
        as well, and if opening them is the part you enjoy, which on this site it usually is. For the
        same arithmetic on full sets, see <a href="/complete-a-set.html">what it costs to complete a
        set</a>.</p>`
          : ""
      }
    </div>
  </section>
${
  pulls.length
    ? `
  <section class="tight">
    <div class="wrap">
      <h2>What <span class="hl">we have pulled</span></h2>
      <p class="fp-note" style="margin-bottom:var(--s5)">Real boxes opened on the channel, with the
        video attached. This grows as more get opened.</p>
${pulls
  .map(
    (p) => `      <div class="fp-pull">
        <p class="fp-note"><b>${esc(p.cards.map((c) => c.name).join(", "))}</b> &bull;
          ${esc(p.cards[0].region)} trio${p.published ? `, ${esc(longDate(String(p.published).slice(0, 10)))}` : ""}</p>
        <div class="fp-pull-cards">${p.cards.map((c) => scan(c, { sizes: STRIP_SIZES })).join("")}</div>
        ${p.path ? `<p class="fp-note"><a href="${esc(p.path)}">Watch the rip</a></p>` : ""}
      </div>`
  )
  .join("\n")}
    </div>
  </section>`
    : ""
}
  <section class="band tight">
    <div class="wrap">
      <h2>Where every fact on this page <span class="hl">came from</span></h2>
      <ul class="fp-sources">
        <li><b>The product itself.</b> Names, contents, release dates and the nine promos per series
          are The Pokemon Company's, from its three official product galleries on pokemon.com, linked
          on each series above. The contents list is quoted rather than paraphrased.</li>
        <li><b>The 27 card names and numbers.</b> Read off the official card artwork one card at a
          time. Only nine of these cards (MEP 037 to 045) exist in the usual card databases and none
          of them carries a picture there, so for the other eighteen the publisher's own scan is the
          only record there is.</li>
        <li><b>The artwork and the box photographs.</b> All 27 cards are illustrated by Saboteri.
          Every picture on this page is The Pokemon Company's, from the same three galleries: the 27
          card scans, and the ${boxes.size === 3 ? "three" : boxes.size} product ${boxes.size === 1 ? "shot" : "shots"} of the boxes
          themselves, which are the image each gallery leads with, cropped to the package out of its
          wider marketing frame and otherwise unaltered. All of them are mirrored onto this site
          rather than loaded from pokemon.com's servers.</li>
        <li><b>The prices.</b> PriceCharting, read ${esc(longDate(doc.checked))}, twice per figure
          from two different pages and only published where the two readings agreed.
          <a href="${esc(doc.priceSourceUrl)}" rel="nofollow noopener" aria-label="PriceCharting's Pokemon promo price guide, opens on pricecharting.com">PriceCharting's promo price guide</a>.</li>
        <li><b>The box price.</b> Tim's own readings, dated above, because no official page publishes
          one for this product.</li>
      </ul>
      <p class="fp-note" style="margin-top:var(--s5)"><b>What is not on this page, on purpose.</b>
        No pull rates and no odds on which region a box gives you: The Pokemon Company does not
        publish them and neither does anybody else, so nobody has them. No claim about how well these
        will hold their value. And no quality complaints about the print run, because the only thing
        published about that is one person's opinion in one video and that is not enough to repeat.</p>
      <p class="fp-foot">PRICES READ ${esc(longDate(doc.checked).toUpperCase())} AND THEY MOVE.
        THIS IS A FAN PAGE, NOT A SHOP, AND NOTHING HERE IS BOUGHT OR SOLD.
        IF YOU SPOT SOMETHING WRONG, SAY SO ON ANY OF THE SOCIALS AND IT GETS FIXED.</p>
    </div>
  </section>
</main>`;

// ---------------------------------------------------------------------------
// STRUCTURED DATA, AND IT ONLY ENCODES WHAT THE VISIBLE PAGE SAYS
// ---------------------------------------------------------------------------
//
// A BreadcrumbList and an FAQPage. The FAQ entries are the SAME six questions
// and the SAME answers rendered in the "short answers" block above, built from
// one array, so the markup cannot drift from the page the way a hand-written
// block does. No Product block: a Product with an `offers` price would be
// asserting a manufacturer's price this page has just spent a section
// explaining nobody publishes, and structured data is exactly the wrong place
// to launder a figure that the visible copy carefully attributes.
const strip = (s) => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "First Partner Illustration Collection" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({
      "@type": "Question",
      name: strip(q),
      acceptedAnswer: { "@type": "Answer", text: strip(a) },
    })),
  },
];

const TITLE = "First Partner Illustration Collection: All 27 Cards and Prices";
const DESC =
  `Every card in the 2026 Pokemon First Partner Illustration Collection: all 27 promos with raw and PSA 10 prices, what is in each box, ` +
  `the ${usd(MSRP)} suggested price against ${usd(SHELF)} on shelves, and the three series' release dates from Pokemon's own product galleries.`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${SITE}${PATH}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="First Partner Illustration Collection: all 27 cards and prices">
<meta property="og:description" content="All 27 promos with prices, what is in the box, and the panorama artwork shown rather than described.">
<meta property="og:url" content="${SITE}${PATH}">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
${FONTS}
${STYLES_NO_PACKS_CSS}
<style>${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer(`Card prices from PriceCharting, read ${longDate(doc.checked)}, every figure read twice. Card images are The Pokemon Company's, from its official product galleries.`)}
${APP_JS_NO_PACKPLAYER}
</body>
</html>
`;

await writeFile(join(ROOT, "public" + PATH), html);

console.log(`Wrote public${PATH}
  ${cards.length} cards, ${cards.filter((c) => c.img).length} with a scan (${thumbs} thumbnail only)
  raw prices published: ${cards.filter((c) => rawOf(c) != null).length}
  PSA 10 published: ${psaHave}, held back: ${psaRefused}, none yet: ${psaNone}
  ${pulls.length} tagged rip(s) of this product`);
