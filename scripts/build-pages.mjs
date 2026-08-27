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
//
// EVERY COMMENT INSIDE THE TEMPLATE IS A JS COMMENT, WRITTEN AS
// ${/* ... */ ""}, AND THAT IS A RULE RATHER THAN A STYLE. Two reasons, and
// the second is the one that bites.
//
// It SHIPS otherwise. Five HTML comments in here were rendering into all 317
// pages: 4,549 bytes raw and 2,079 gzipped PER PAGE, about 659KB gzipped
// across the family, of prose no reader can see. This builder does not strip
// comments the way build-css.mjs strips the stylesheet, so an HTML comment
// here is a shipped asset. They were converted on 19 August 2026 with every
// word kept; the built pages were diffed with comments removed and whitespace
// collapsed and all 317 came out identical, so nothing but the comments moved.
// The two FOOT_SUB markers are not prose and stay.
//
// A BACKTICK IN AN HTML COMMENT HERE CLOSES THE TEMPLATE LITERAL AND FAILS THE
// BUILD. That has happened twice in this file and to four builders in one
// night across the repo. Inside ${/* ... */ } the backtick is ordinary comment
// text and cannot do it, so the form removes the hazard rather than warning
// about it. The only sequence a JS block comment cannot contain is */.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, robots, LIVE, DOMAIN } from "../shared/site.mjs";
import { localDay } from "../shared/today.mjs";
import { priceNote, priceFooter, priceRead, chaseByPrice } from "../shared/card-prices.mjs";
// SUBSCRIBE is imported rather than retyped. The channel URL and its
// ?sub_confirmation=1 were hard coded here as a literal, which is one place for
// the ID to be wrong and never noticed; shared/chrome.mjs is where the other
// three Subscribe controls get it.
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS, SUBSCRIBE, dropUnusedHitLightbox } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { raritiesIn, rarityChip, RARITY_CSS } from "../shared/rarity.mjs";
import { ripPath } from "../shared/paths.mjs";
import { loadGradedPrices } from "../shared/graded-price.mjs";
import { loadFirstPartner } from "../shared/first-partner.mjs";
import { norm } from "../shared/intl-printing.mjs";
// THE RULE IS intl-printing.mjs AND IT IS UNCHANGED. This asks it in the rip
// log's own vocabulary and hands back the guide's own row; see that file.
import { pickIntlPrintingJp } from "../shared/intl-vocab.mjs";
// THE CORPUS THIS FILE WAS NAMED AS NOT ASKING, AND THE PANEL A SLOT WITH NO
// SCAN RENDERS. build-hall.mjs held corpusScan privately and its own header
// said "build-pages.mjs has the identical gap on the identical rows and would
// want the identical three lines, but that file is not this pass's to edit."
// It is shared now rather than copied, for the reason five private copies of
// gradedPrice() are the receipt for in CLAUDE.md.
import { corpusScan, noScanBox, pinnedShot, NOSCAN_CSS } from "../shared/card-scan.mjs";
import { loadCorpus, corpusCard } from "../shared/subset-cards.mjs";
import { esc, longDate, moneyCompact, moneyExact, moneyRound, shortDate, rarityLabel, cardNumKey, imgDims, viewCount, avifPicture, packTileImg, clipMeta, plainDashesAll, RIP_BANNER} from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUT = join(ROOT, "public/rip");

// THE RARITY MARKS SHIP THEIR OWN PROSE TO EVERY RIP PAGE, and two thirds of
// the block is the prose. RARITY_CSS is 1,915 bytes and 1,292 of those are the
// /* */ notes explaining why the marks are drawn as artwork rather than as
// chrome. Those notes are worth keeping where they are read, in
// shared/rarity.mjs, and they are worth nothing in a render blocking <style>
// element on 317 pages.
//
// STRIPPED HERE RATHER THAN AT THE SOURCE, on purpose. build-set-pages.mjs,
// build-intl-pages.mjs and build-start.mjs import the same constant, and this
// builder does not own what they ship; the same reasoning applies to them and
// the same one line would do it, but that is their edit to make. Counted off
// the built tree: 318 pages carry the comment today, 317 of them rip pages.
//
// SAFE BECAUSE THE BLOCK HAS NO STRINGS AND NO URLS. A blanket comment strip
// over arbitrary CSS can eat a content:"/*" or a url() containing the token.
// Checked: RARITY_CSS has zero content declarations and zero url() calls, and
// the brace count is 10 open and 10 close before and after. This is the same
// transform build-css.mjs applies to the main stylesheet and for the same
// reason, which is that the file is render blocking and 40% of it was prose.
//
// MEASURED at 390x844, one page, gzipped, which is how the host serves it:
// 11,808 -> 11,162 bytes, a 646 byte saving per page and about 205KB across
// the 317.
const RARITY_CSS_MIN = RARITY_CSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n{2,}/g, "\n").trim();

/**
 * The line under a "More <set>" tile that says WHAT WAS OPENED.
 *
 * PAGE LEVEL RATHER THAN ui.css, and that is a scope decision rather than a
 * shortcut: .vid-kind exists on the rip pages and nowhere else, the same
 * arrangement the third home-page layout took while ui.css was being rewritten
 * under it. It ships only on the pages whose set rail actually opened more than
 * one kind of thing, so the 34 single-kind rails and every page with no set rail
 * pay nothing. stamp-assets.mjs strips this comment out of the built page, which
 * is why it is written at length here.
 *
 * IT IS COPY UNDER THE ARTWORK AND NOT A PLATE ON TOP OF IT. CLAUDE.md is
 * explicit about the wrapper: the pack art is CONTENT, "the mascot is the
 * point", and the banner note ends "The copy goes underneath." ui.css says the
 * same thing about this exact element from the other direction -- ".pack--tile
 * .pack-mascot,.pack--tile .pack-hint,.pack--tile .pack-flash{display:none}",
 * because at ~170px "the mascot badge and the hint strip do not survive the
 * shrink". A chip laid over the tile would be reintroducing the strip that rule
 * removed.
 *
 * PINK, AND THE SMALL PINK. It is a mark that goes nowhere, which is the
 * accent rule's own definition of the pink side; teal is reserved for routes,
 * and the title under it IS a route. At .66rem it is nowhere near the 24px
 * where the big --ketchup clears 3:1, so it takes --ketchup-deep. That
 * measures 6.24:1 on --sky-tint by arithmetic and 6.49:1 read off the RENDERED
 * pixels at 390x844 DPR 2, which is the number to believe: the band paints a
 * gradient, so the ground under the first tile's kicker is (31,52,51) rather
 * than the token. Taken by hiding the glyphs and screenshotting the same box.
 *
 * .66rem IS .vid-meta's SIZE ON PURPOSE. The kicker was .62 for one build and
 * came out SMALLER than the date it sits two lines above, which inverts the
 * order the two are meant to be read in. Weight, case and colour carry the
 * difference instead, which is what they do everywhere else on this site.
 *
 * -5px OF NEGATIVE MARGIN, not a change to .vid's own gap. .vid is a 9px flex
 * column shared with /videos.html, /playlists.html and the box rail, so
 * touching the gap would move tiles this change has no business moving. The
 * kicker and the title it belongs to close up; the date keeps its own spacing.
 */
const KIND_CSS = `.vid-kind{margin:0 0 -5px;font-family:var(--mono);font-weight:700;
font-size:.66rem;letter-spacing:.11em;text-transform:uppercase;
color:var(--ketchup-deep);line-height:1.3}`;

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

/**
 * Which pack a GRID TILE in the two rip rails wears.
 *
 * The expression was written out twice, once in "More from <box>" and once in
 * "More <set>", and it now decides two things rather than one: the wrapper
 * class AND the artwork file the tile's <img> asks for. Two copies of a rule
 * that has to agree with itself in four places is how a tile comes to wear one
 * set's wrapper over another set's picture, so it is one function.
 *
 * IT CAN ONLY EVER NAME A SET WITH ARTWORK, which is why the caller can add
 * .pack--img unconditionally: a multi-set rip falls back to "multi" and an
 * unknown one to "default", and build-packs.py ships a master for both.
 *
 * THE TILES ARE LAZY AND ON THIS PAGE FAMILY THAT SAVES NOTHING, which is
 * worth writing down because LAUNCH.md said it would save 38.8KB on each of
 * 317 pages. It does not, and the reason is geometry rather than markup.
 * Measured 20 August 2026 off each .pack-art's own border box at scroll 0: the
 * first rail tile sits at y=1774 at 390x844 and y=1296 at 1440x900, which is
 * 930 and 396 pixels below the fold, and Chrome's lazy threshold on a 4G
 * connection is 1250. A lazy image that close is fetched immediately. On top of
 * that, 248 of the 279 rip pages that carry rails draw every tile in the hero's
 * own set, so the rails cost ONE file whatever happens. They are still images
 * rather than backgrounds, because the preload scanner can see an image and
 * because one tile emitter that behaves two ways is how the two renders of this
 * component drifted before. Do not quote a saving for this family.
 */
const tileSet = (r) =>
  r.sets.length > 1 ? "multi" : packsOnDisk.has(r.sets[0]) ? r.sets[0] : "default";

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
// THE PSA 10 CHAIN IS NOT WRITTEN HERE ANY MORE, AND THAT IS THE FIX RATHER
// THAN A TIDY-UP. This file used to hold a private copy of it that read
// data/psa10.json and nothing else, so when build-hall.mjs was moved onto
// PriceCharting on 18 August 2026 ("lets use pricecharting as the main numbers
// for the entire site") the chaser band below stayed behind: Mega Greninja ex,
// Chaos Rising #122 printed $838 from pokemonpricetracker.com on 53 of these
// pages while /hall.html printed PriceCharting's $906 for the same printing.
//
// The join is on the card's NAME and its SET's name, not on a set-id key, so
// both callers below pass those through. See shared/graded-price.mjs for the
// precedence and for why the printing number is re-checked.
const gradedFor = await loadGradedPrices();
const firstPartner = await loadFirstPartner();
const gradedPrice = (setId, number, name, setName) =>
  gradedFor.price(setId, number, { name, setName });

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
/* THE PRINTINGS CORPUS, FOR THE SETS THIS SITE KEEPS NO CHECKLIST FOR.
 * public/data/cards holds 28 English sets; Silver Tempest, Lost Origin, the
 * Trainer and Galarian Galleries and every Black Star Promo set are not among
 * them, and their cards were reaching rip pages as a bare name with no number,
 * no scan and no price. /hall.html has read the corpus since 23 August 2026 and
 * this file had the identical gap on the identical rows, which is the same
 * sentence build-hall.mjs's own note was written under a day earlier. Loaded
 * once, over only the shards the logged card names could live in.
 * See shared/subset-cards.mjs. */
const HIT_CORPUS = await loadCorpus(ROOT, Object.values(HITS).flat().map((c) => c.card));
// THE HIT CARDS TAKE THE SAME CHAIN AS THE CHASER BAND, AND THEY DID NOT.
//
// This was a SECOND copy of the lookup inside one file, and a laxer one: it
// took `prices` or `auto` with no ten-sale floor and stripped leading zeros off
// the key, so it could answer differently from gradedPrice twelve lines above
// it about the same card. Every hit card here is also a plaque on /hall.html,
// which is where the two answers met in public on Mega Greninja ex.
//
// It also makes an existing sentence true rather than changing what it says:
// the sourcing note under this list already reads "PSA 10 prices come from
// PriceCharting's guide too", which was written about a column that was being
// filled by pokemonpricetracker.com.
const psaFor = (setId, n, name, setName) =>
  gradedFor.price(setId, n, { name, setName });

// ===========================================================================
// THE SECOND CHECKLIST. THE NOTE BELOW resolveHits SAID READING IT "BUYS THIS
// FILE NOTHING" AND THAT WAS TRUE OF FIVE SETS AND FALSE OF A SIXTH.
// ===========================================================================
//
// public/data/intl-guides.json is the Japanese, Korean and Chinese half of the
// card data, and build-hall.mjs has read it since 21 August 2026. This file was
// deliberately NOT given the same reader, on the recorded grounds that those
// guides carry "no image and no price for any set in them", so an intl hit
// resolved against them would still fail showableHits and still render as text.
//
// THAT IS A PER-SET FACT AND IT WAS WRITTEN DOWN AS A PER-FILE ONE. Counted out
// of the file itself on 2026-08-21: hasImages is FALSE on ja-abyss-eye,
// ja-ninja-spinner, ja-nihil-zero, ja-mega-symphonia and ja-mega-brave, and
// ja-cyber-judge and zh-gem-pack-2 carry no card list at all -- which is the
// seven sets the note was looking at. It is TRUE on six others, and every one
// of them is complete rather than partial: ja-stellar-miracle 135 of 135,
// ja-violet-ex 108 of 108, ko-clay-burst 99 of 99, ko-crimson-haze 96 of 96,
// ko-mask-of-change 101 of 101 and ko-battle-partners 132 of 132. 671 scans the
// build could already see and never asked for.
//
// Three of them are logged hits: Crabominable on yJujjKbIVFg and Meditite and
// Raboot on bh8OGK_jE2Y, all out of Stellar Miracle.
//
// THE PRICE HALF OF THAT NOTE IS STILL TRUE and nothing here changes it. An
// intl row carries a scan and no money, which is what a reader gets: the hit
// band's own test is "a scan OR a price", so a scan alone is enough to show the
// card and the price line reads "No market price", exactly as it does for a
// promo.
let INTL_SETS = {};
try {
  INTL_SETS = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

// THE SCANS THIS BUILDER NOW EMITS ARE THE FIRST ON A PATH THAT CHECKED
// NOTHING, SO IT CHECKS data/no-scan.json.
//
// An English scan reaches this file through sync-cards.mjs, which applies that
// file per card, for the reason build-cards.mjs argues at length: a page
// builder rewriting a sync's output is undone by the next sync. The intl half
// has no such step -- sync-intl-guides.mjs does not read no-scan.json -- so a
// scan TCGdex withdraws would keep being requested, and `onerror` would hide
// the hole. That is the exact failure no-scan.json's own readme was written
// about: "the picture silently vanished and the site paid for a dead round
// trip to find out."
//
// Filtering here rather than in the sync is the lesser of the two evils and is
// deliberately the narrower one: it drops an IMAGE, never a card, so the row
// still resolves, still prints its collector number and still renders the
// .hitcard-img.is-none placeholder. A withdrawn scan therefore looks exactly
// like a card that never had one, which is what makes it visible.
//
// FIVE LINES COPIED FROM build-intl-pages.mjs, which does this to the intl
// chase cards already and explains why in the same words. If a third caller
// wants it, that is the moment it becomes a shared helper rather than now.
//
// sweep-scans.mjs is the other half and it needs nothing: its input is every
// assets.tcgdex.net card base in the built tree, and these are four-segment
// card bases in the HTML now, so the next run tests them like any other.
let NO_SCAN = new Set();
try {
  NO_SCAN = new Set(JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).bases || []);
} catch {
  /* optional: a missing base then renders as an img that removes itself */
}

/* ------------------------------------------------- the hit card's own scan --
 *
 * THE BIGGEST CARD ART ON THE SITE WAS THE ONLY CARD ART ON IT WITH NO LADDER,
 * AND IT WAS THE SOFTEST PICTURE WE PUBLISH. Fixed 21 August 2026.
 *
 * READ OFF `currentSrc` AT DPR 1, 2 AND 3, never naturalWidth, which the spec
 * density-corrects with a `w` descriptor and which has already built one
 * 958-image finding out of nothing on this site. Boxes measured in the runtime
 * DOM with prefers-reduced-motion forced, because .hitcards.is-armed carries a
 * scale(.97) and getBoundingClientRect reports the TRANSFORMED width: the first
 * pass read 138.71 for a 143px box and nearly wrote the wrong number down.
 *
 *      viewport      box     wanted at DPR 3      served (245w)
 *      320           108     324                  76%
 *      390           143     429                  57%
 *      1440          194     388 (at DPR 2)       63%
 *
 * The box is `50vw - 52px` up to the 520px breakpoint and a flat 194px above
 * it, measured at 21 widths from 320 to 1920. `sizes` below is that curve.
 *
 * SO THE READER WAS BEING HANDED A 245px FILE FOR A 429px BOX, a 1.75x upscale,
 * of the one card the whole page is about. ui.css's own comment on .hitcards
 * says the track is "Capped at 220px: the scan is 245px wide, so a wider cell
 * upscales it and the card goes soft" -- an argument that is only true at DPR 1,
 * which is the exact trap CLAUDE.md's "checked at DPR 2 and shipped at DPR 3"
 * entry is about, one density further along.
 *
 * WHAT IT COSTS, and quote the pair or quote neither. TCGdex publishes 245 and
 * 600 and nothing between, so the only rung available is `high`. Measured by
 * fetching all 126 distinct hit-card files at both widths:
 *
 *      low.avif    16.7KB mean      2,579KB over the 121 pages
 *      high.avif   58.0KB mean      8,836KB over the 121 pages
 *
 * so +38.8KB on the median page, +570KB on the Costco UPC rip's fourteen, and
 * nothing at all at DPR 1 or on a 320px phone at DPR 2 (216 device px still
 * clears 245). The band is 1,356 to 1,772px down a rip page and every image in
 * it is lazy, so most of that is a scrolled cost rather than a load-path one.
 *
 * TWO THINGS PAY FOR IT AND NEITHER IS TASTE.
 *  - THE LIGHTBOX ON THE SAME PAGE ALREADY FETCHES `high.avif` FOR THE SAME
 *    CARD the moment anyone taps it. A reader who taps used to pay 16.7 + 58.0;
 *    they now pay 58.0 once and the tap is a cache hit. The thumbnail got
 *    sharper and the tapping reader got LIGHTER.
 *  - /wanted.html draws a 151px box, one hair wider than this one, and its own
 *    builder rejected the 245w file there in as many words: "VISIBLY SOFT ... a
 *    site whose subject is card scans does not take that trade." It spent a new
 *    460w rendition to avoid it. This box is 143 and was taking that trade on
 *    every rip page.
 *
 * THE THIRD OPTION WAS COSTED AND REFUSED. Mirroring a middle width locally,
 * which is what sync-card-thumbs.mjs does for /wanted.html's ten cards, saves
 * 19.9% against the 600w by that script's own measurement -- so it would still
 * cost +31KB a page, over 126 files that grow with every import, for about 21MB
 * of committed binaries and a fourth rendition pipeline. The saving does not
 * pay for the machinery at this count. If the hit corpus ever stops growing,
 * re-open it; the script already derives its list rather than pinning it.
 */
const HITCARD_SIZES = "(max-width:520px) calc(50vw - 52px), 194px";
/**
 * ONLY TCGDEX HAS THE SECOND RUNG. `high.webp` is a sibling of `low.webp` on
 * that host and nowhere else: the First Partner promos fall back to a local
 * /assets/first-partner/ file whose renditions are named differently, and
 * emitting `${url} 245w, ${url} 600w` for one of those would offer the browser
 * the same file under two widths and let it pick the wrong one on purpose.
 * Nothing in the built tree takes that path today, checked across all 158 hit
 * slots, which is exactly why it is guarded rather than assumed.
 *
 * THREE CARDS DO TAKE IT NOW, and they are the tcgplayer-cdn pins out of
 * data/card-shots.json. That host has two renditions off one product id but
 * they are NOT siblings by string surgery -- `_200w.jpg` and
 * `_in_1000x1000.jpg` -- so the guard above correctly emits no srcset for
 * them, and the lightbox is handed the big one through `imgLarge` rather than
 * by rewriting the small one's url. The `low.webp -> high.webp` swap on
 * `data-img` is a silent no-op on any other host, which is how those three
 * cards would have enlarged to a 200px thumbnail.
 */
function hitcardImg(url) {
  const two = /^https:\/\/assets\.tcgdex\.net\/.+\/low\.webp$/.test(url);
  const ladder = two
    ? ` srcset="${esc(url)} 245w, ${esc(url.replace(/low\.webp$/, "high.webp"))} 600w" sizes="${HITCARD_SIZES}"`
    : "";
  return avifPicture(
    `<img class="hitcard-img" src="${esc(url)}"${ladder} alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(url)}>`,
  );
}

// One intl checklist in the SAME SHAPE as an English one out of
// public/data/cards/, so the matching below is one code path and not two.
//
// `image` in that file is a whole url ending in /low.webp, while every other
// caller in this builder holds a BASE and appends the rendition itself, so it
// is cut back to the base here. That keeps three things working for free that
// would each otherwise need a special case: avifPicture finds the .webp and the
// assets.tcgdex.net host and wraps it, imgDims reads 245x337 off the same host,
// and the lightbox's low.webp -> high.webp swap lands on a file that exists.
//
// THE ENGLISH NAME IS THE KEY, because that is what the rip log writes. Same
// call build-hall.mjs makes and for the reason data/intl-rips.json's readme
// settles for the guides: the native name is the verifiable one and is never
// dropped, but a hit has one name slot and it gets the one the sheet joins on.
const intlChecklist = (setId) => {
  const g = INTL_SETS[setId];
  if (!g || !g.cards || !g.cards.length) return null;
  return g.cards.map((c) => {
    const base = c.image ? String(c.image).replace(/\/(low|high)\.(webp|avif|png|jpg)$/, "") : null;
    return {
      n: c.localId,
      name: c.en || c.native,
      rarity: c.rarity || null,
      // THE SAME CARD'S TIER IN THE WORDS ON THE JAPANESE WRAPPER, WHICH IS THE
      // VOCABULARY data/hits.json IS WRITTEN IN. Asked with, never printed:
      // `rarity` above is what this page shows and what corpusScan below
      // cross-checks against the printings corpus. See shared/intl-vocab.mjs.
      rarityJp: c.rarityJp || null,
      img: base && !NO_SCAN.has(base) ? base : null,
      price: null,
      // BOTH NAMES SURVIVE THE FLATTENING NOW, AND ONLY corpusScan READS THEM.
      // The printings corpus is sharded by the first letter of whichever name
      // it holds, and it files a Japanese card under "0" where TCGdex has no
      // translation, so a lookup with one name misses half the corpus. Nothing
      // else in this builder touches either field: `name` above is still the
      // one key a hit joins on, for the reason written over this function.
      en: c.en || null,
      native: c.native || null,
    };
  });
};

/*
 * WHICH PRINTING AN INTL HIT IS: the rule, the argument for it and the three
 * branches all live in shared/intl-printing.mjs now, imported above.
 *
 * THIS FILE AND build-hall.mjs EACH HELD A COPY, and each carried a comment
 * telling the reader to change the other one in the same edit. A set guide
 * became the third caller on 21 August 2026 and that was the moment "keep two
 * copies in step by hand" stopped being arguable. `norm` comes from the same
 * module, because it was the other half of the copy.
 */

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
      // THE FIRST PARTNER PROMOS HAVE A PRICE ON THIS SITE AND THESE ROWS WERE
      // NOT ASKING FOR IT. data/hits.json names that product in `printing` and
      // nothing in the build read `printing` as a key, so six rows across
      // M7NqqhR8V4M and xNGxOuMpSiw printed "No market price" for three cards
      // /first-partner-illustration-collection.html has published a raw price
      // AND a PSA 10 for since 19 August 2026. They were 6 of only 7 such rows
      // in the whole tree. The scan resolved the whole time; only the money was
      // missing. See shared/first-partner.mjs for why the join is on `printing`
      // and not on the card name.
      const fp = firstPartner.priceForHit(h);
      out.push({
        // THE SET NAME COMES BACK FROM THE SAME RECORD AS THE NUMBER, and until
        // 21 August 2026 it did not, which is why one hit card on the site
        // printed a naked "#025" where the set line goes. Mega Kangaskhan ex on
        // l6RPdGNs7uE has no set, no number and no setName on its rip log row.
        // The printings corpus resolved it to MEP Black Star Promos #025 and
        // handed back the collector number and the scan while `pm.s`, the set
        // that number belongs to, was dropped on the floor. So the page printed
        // a collector number with no catalog behind it, one row from a correct
        // "MEGA EVOLUTION - #151".
        //
        // Same rule the graded join two hundred lines up is held to: the
        // number, the label and the picture arrive together or not at all.
        // Order is the sheet first, then the priced product, then the corpus,
        // so a set name a person wrote down still wins over a derived one.
        // THE PRICED PRODUCT OUTRANKS THE CORPUS GUESS, AND IT DID NOT, AND SIX
        // CARDS SHOWED THE WRONG ARTWORK BECAUSE OF IT.
        //
        // `pm` has two finds. The first is exact -- name AND collector number.
        // The second fires when the row carries no number and takes the first
        // printing of that name in ANY set matching /promo/, which is shard file
        // order and nothing else. `t.json` happens to hold "DP Black Star Promos
        // DP01" before "MEP Black Star Promos 040", so Turtwig, Chimchar and
        // Piplup on JjTm-bYLhGE and C4mvo_Justc rendered the 2007 Diamond and
        // Pearl promo scans under the First Partner set name at the MEP price:
        // a three-way hybrid, with the picture belonging to a different card
        // printed nineteen years earlier. Rowlet, Litten and Popplio escaped
        // only because MEP sorts before SM in their shards.
        //
        // `fp` is not a guess. It fires only when the row NAMES the First
        // Partner Illustration Collection, the card name is in that product's
        // 27-card list, and any number on the row agrees with the card's. So
        // where fp answers it answers exactly, and it now takes the whole
        // record rather than being outvoted field by field.
        //
        // WHOLE RECORD, NOT FIELD BY FIELD, which is the rule the paragraph
        // above already states: the number, the label and the picture arrive
        // together or not at all. Mixing fp's number with pm's picture is how
        // this got shipped in the first place.
        name: h.card,
        setName: h.setName || fp?.setName || (fp ? null : pm && pm.s) || null, setId: null,
        rarity: h.rarity || (fp ? null : pm && pm.r) || null,
        n: h.number || fp?.number || (fp ? null : pm && pm.i) || null,
        img: fp?.img || (pm && pm.g && !fp ? `${pm.g}/low.webp` : null),
        // A promo has no price in the nightly feed, so where one is recorded on
        // the hit itself we use it, and carry its source and date so the page
        // can say where it came from rather than implying it is a live figure.
        // The hit's own figure still wins: it is what a person wrote down about
        // the card that came out, and the promo file is the fallback for the
        // product it covers.
        // AND THEN THE SHEET'S OWN Raw NM COLUMN. A promo has no price in the
        // nightly feed by construction, and five of them had no hand-kept
        // `price` either, so /hall.html was dropping them outright and the rip
        // pages printed "No market price". The owner's TCGplayer links gave each one a
        // market figure; typed into the My Hits tab, it lands here. Last in the
        // chain, because it is frozen and the two above it are not.
        price: typeof h.price === "number" ? h.price
          : fp?.price ?? (typeof h.rawNm === "number" ? h.rawNm : null),
        psa10: typeof h.psa10 === "number" ? h.psa10 : fp?.psa10 ?? null,
        priceSource: h.priceSource || (fp && (fp.price != null || fp.psa10 != null) ? fp.source : null),
        priceAsOf: h.priceAsOf || (fp && (fp.price != null || fp.psa10 != null) ? fp.asOf : null),
        promo: true, unresolved: !pm && !fp,
      });
      continue;
    }
    // THE ENGLISH CHECKLIST FIRST, THEN THE INTL ONE, AND NEVER BOTH. Nothing
    // is in public/data/cards/ AND in intl-guides.json: the first holds the 28
    // English sets and the second holds the thirteen it does not. The English
    // one wins where it exists so no English page can start reading a different
    // file, and `intl` below is what tells the rest of this function which
    // vocabulary it is holding.
    //
    // `norm` used to be redeclared here, byte for byte identical to the one at
    // module scope. Removed rather than shadowed.
    const english = cardCache.get(h.set);
    const cards = english || intlChecklist(h.set);
    const intl = !english && Boolean(cards);
    const same = cards ? cards.filter((c) => norm(c.name) === norm(h.card)) : [];
    // EXACT TIER FIRST. THE EIGHT CHARACTER PREFIX IS A FALLBACK NOW, NOT THE
    // RULE, AND ONE CARD ON THIS SITE ONLY EVER RESOLVED BECAUSE IT WAS.
    //
    // This was `norm(h.rarity).slice(0, 8)` matched with `.includes()`, which
    // is a substring test on a truncated word. "hyperrar" is a substring of
    // "megahyperrare", so the log's Mega Greninja ex, written down as a Hyper
    // Rare, landed on Chaos Rising #122 Mega Hyper Rare -- the right card, by
    // luck. The set carries no Hyper Rare at all, so there was nothing else for
    // it to hit. On a set that prints BOTH tiers the same test files a Hyper
    // Rare pull as a Mega Hyper Rare, silently, and the same eight characters
    // cannot tell "Illustration rare" from "Special illustration rare" either
    // once a set prints both under one name.
    //
    // THE PREFIX IS KEPT RATHER THAN DELETED, and that is deliberate. Removing
    // it turns every tier the sheet words differently from TCGdex into `same[0]`
    // -- a silently MISSING answer swapped for a silently wrong one, which is no
    // better. Exact wins where it can, the loose test only runs where exact
    // found nothing, and check-build.py now fails the build on a written tier
    // the card is not printed at, so a row that reaches the fallback for the
    // wrong reason cannot ship.
    const want = h.rarity ? norm(h.rarity) : null;
    // TWO RULES, ONE PER VOCABULARY, AND THE INTL ONE IS THE STRICTER OF THEM.
    // pickIntlPrinting never reaches `same[0]`; see its own comment for the
    // whole argument and for why Goldeen still gets no number.
    // THE RARITY IS THE OWNER'S OWN DATA AND THE NUMBER IS DERIVED, WHICH IS THE
    // OPPOSITE OF WHAT I ASSUMED FOR SIX HOURS ON 23 AUGUST 2026.
    //
    // I made the collector number win over the rarity word, on the evidence that
    // hits.json carried "#290 Double Rare" for a Mega Dragonite ex and #290 is a
    // Special Illustration Rare worth $668.50. I read that as a right number
    // beside a wrong rarity. It is the other way round.
    //
    // THE My Hits Number COLUMN IS EMPTY ON THOSE ROWS. import-sheet.mjs writes
    // `number: cell(r, hi.number) || found?.n`, so with nothing typed the number
    // is filled in from a lookup, and that lookup had already picked the wrong
    // printing. Making the number authoritative promoted a DERIVED value over
    // the one a person actually entered, and then ranked the site on it.
    //
    // What the owner typed for that card, in the Video Log's own Hit Info cell:
    // "Mega Dragonite ex - Double Black Star - Double Rare". A double black star
    // IS Double Rare. He pulled the Double Rare.
    //
    // The visible damage: /hall.html filled with chase printings of cards that
    // were pulled as commons, so it read as if the most-wanted list had been
    // pasted into the hall. The owner: "you added in all sorts of cards that are not
    // logged as hits in my video ... that is wrong."
    //
    // SO THE RARITY WINS AGAIN. It is the field a person fills in while looking
    // at the card.
    //
    // AND THE DERIVED NUMBER HAS NOW STOPPED BEING DERIVED FROM A GUESS, which
    // is what the paragraph this replaced said the fix would have to be. As of
    // 23 August 2026 import-sheet.mjs picks the printing with pickPrinting():
    // an explicit number first, then the typed rarity where it names exactly
    // one printing, and only then the dearest. So the number it writes into
    // data/hits.json now AGREES with the rarity on the same row by
    // construction, and the two fields can no longer point at different cards.
    //
    // The old rule was "keep the dearest printing of a name", and it moved 86
    // rows. It claimed 51 Special Illustration Rares out of 462 packs, roughly
    // one in nine, against a real pull rate near one in a hundred. With the
    // rarity honoured the same 462 packs give 75 Double rares, 40 Illustration
    // rares, 35 Ultra Rares and 2 SIRs, which is what a box of modern Pokemon
    // actually does. Three separate confirmations, none of them mine:
    //   - The owner's Hit Info cells name the SYMBOL as well as the tier, and they say
    //     "Mega Dragonite ex - Double Black Star - Double Rare". Two black stars
    //     is Double Rare. He pulled the $4.56 card, not the $668.50 one.
    //   - He sent the TCGplayer link for Mega Charizard Y ex 022/217 himself,
    //     against the 294 the old rule had chosen.
    //   - data/graded.json's readme, written 14 August, records "Dawn #129 where
    //     ours is #118" and "Mega Gardevoir ex #178 where ours is #159" -- our
    //     numbers back then are the numbers the rarity gives back now.
    //
    // The order here stays rarity-first regardless, because it is the same
    // answer by a shorter route and because this file must not start naming a
    // different printing from build-hall.mjs.
    const m = intl
      ? pickIntlPrintingJp(same, want)
      : (want && same.find((c) => norm(c.rarity) === want)) ||
        (want && same.find((c) => norm(c.rarity).includes(want.slice(0, 8)))) ||
        same[0] || null;
    // THE SECOND PLACE A JAPANESE SCAN LIVES, AND THIS BUILDER HAD NEVER ASKED
    // IT. build-hall.mjs gained the lookup on 21 August 2026 and its note said
    // in as many words that this file "has the identical gap on the identical
    // rows". It did: Mega Abomasnow ex, Mega Symphonia #018, resolved to a real
    // printing here, found no scan on the intl checklist and fell out of the
    // hit-card band into the text list, while the plaque for the same card on
    // /hall.html carried the picture. 92 of Mega Symphonia's 92 cards and 120
    // of Ninja Spinner's 120 are in the corpus with their scans.
    //
    // ASKED ONLY AFTER THE PRINTING IS SETTLED, so it cannot change which card
    // this row names: it is keyed on that printing's own (set, collector
    // number) and cross-checks the native name and the rarity before taking a
    // url. Frogadier in Ninja Spinner has scans for both #021 and #087 and
    // still gets nothing, because pickIntlPrinting refuses to choose.
    const backfill = intl && m && !m.img ? await corpusScan(INTL_SETS[h.set]?.native, { localId: m.n, en: m.en, native: m.native, rarity: m.rarity }) : null;
    // NO CHECKLIST, OR A NAME THAT IS NOT ON ONE: TRY THE CORPUS BEFORE GIVING UP.
    // Silver Tempest and Lost Origin have no per-set file here at all, and the
    // Trainer and Galarian Galleries are separate set names inside
    // public/data/printings that nothing else joins to. Six logged cards -- the
    // three V cards out of that 2-pack blister, Corviknight V TG18, Paras GG32
    // and Victini 208 -- were rendering on their rip pages as a name and nothing
    // else while the corpus held every one of them.
    //
    // ONLY WHERE THE CHECKLIST FOUND NOTHING, so it can never overrule a set
    // file, and never on an intl row, which has its own stricter join above.
    // The corpus carries no prices, so the sheet's own Raw NM column is the
    // money for these; and where TCGdex has no scan for the printing at all,
    // data/card-shots.json pins one. Same three sources, same order, as the
    // plaque on /hall.html: the two files must agree or a card shows one number
    // here and another there.
    const sub = !m && !intl
      ? corpusCard(HIT_CORPUS, { card: h.card, setName: h.setName || h.set, rarity: h.rarity, number: h.number })
      : null;
    // THE PIN IS ASKED WHENEVER NOTHING ELSE PRODUCED A PICTURE, including on a
    // row the checklist DID resolve. Poke Pad 103 is the case: ja-nihil-zero
    // pins the printing exactly and holds no scan for any card in the set, so
    // gating the pin on an unresolved row left the one card it was added for
    // still drawing a grey box. It is keyed on the printing that won, so it
    // cannot change which card the row names.
    const artFrom = m ? (m.img || backfill) : sub?.img;
    const pin = artFrom
      ? null
      : pinnedShot([sub?.setName, m?.setName, h.setName, h.set], m?.n || sub?.n || h.number);
    out.push({
      // THE CORPUS'S OWN NAME AND SET WHERE IT ANSWERED, and /hall.html has done
      // this since the subset lookup went in. The rip log glues the subset onto
      // the card -- "Corviknight V Trainer Gallery" -- because that is the only
      // slot the sheet has for it, and printing it back read as a card called
      // "Corviknight V Trainer Gallery" in "Silver Tempest". It is Corviknight
      // V, in Silver Tempest Trainer Gallery, and the two pages now say the same
      // thing about it.
      name: sub?.name || h.card, setName: sub?.setName || h.setName, setId: h.set,
      rarity: (m && m.rarity) || sub?.rarity || h.rarity || null,
      n: m ? m.n : sub?.n || null,
      // THE GUIDE'S OWN SCAN FIRST, THEN THE CORPUS. Same precedence
      // build-hall.mjs uses: the file this row was resolved out of wins and the
      // second source stands behind it rather than over it.
      img: m && (m.img || backfill) ? `${m.img || backfill}/low.webp` : sub?.img || pin?.thumb || null,
      // The pinned scan is a TCGplayer url and carries its own full-size
      // rendition, which the lightbox wants instead of a `/high.webp` built off
      // a TCGdex base that does not exist for this card.
      imgLarge: pin?.image || null,
      price: m && typeof m.price === "number" ? m.price
        : sub && typeof sub.price === "number" ? sub.price
        : typeof h.rawNm === "number" ? h.rawNm
        : null,
      // NO GRADED LOOKUP ON AN INTL ROW. shared/graded-price.mjs is keyed on an
      // English set id and a PriceCharting console, and neither exists for a
      // Japanese or Korean set, so asking is at best a miss and at worst a hit
      // on an English printing that shares the collector number.
      psa10: m && !intl ? psaFor(h.set, m.n, m.name, setData.get(h.set)?.name || h.setName) : null,
      // A promo, or a card outside the set checklist, will not resolve. Kept
      // and shown by name rather than dropped, because it WAS pulled.
      unresolved: !m && !sub,
      // Which checklist answered, for the report at the foot of this run. An
      // intl row that resolved and still has nothing to show is a different
      // fact from a set this site holds no list for, and the two used to print
      // the same sentence.
      intl,
      listed: Boolean(cards),
      printings: same.length,
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
  /* written by scripts/build-logos.py, which measures as it resizes.
     There is no measure-logos.py: it was named in five comments and had
     never been in the tree, which is how five logos came to have no
     dimensions and therefore no srcset at all. */
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
  // THE MIDDLE RUNG WAS ON DISK ALL ALONG AND THIS SRCSET DID NOT OFFER IT.
  //
  // The table above records "DPR 3 both master 52.5KB (unchanged)" as if that
  // were the floor. It is not. -sm and the master straddle every DPR 3 phone and
  // every retina desktop, so the browser correctly takes the master:
  //
  //     sizes on a 390 phone   77px   ->  DPR 3 wants 231w
  //     sizes at >=1080px     122px   ->  DPR 2 wants 244w
  //     surging-sparks -sm             226w      master 679w
  //
  // Five pixels short on the phone, eighteen on the desktop, and it pays the
  // master both times. Measured across the 23 logos a rip page can name: -sm is
  // too small for DPR 3 on 10 of them and for retina desktop on 11.
  //
  // RAISING -sm WOULD NOT FIX IT, WHICH IS WHY THIS IS A RUNG AND NOT A NUMBER.
  // The rungs are normalised by HEIGHT and the `sizes` are widths, so a tall
  // narrow logo gains almost nothing from a taller rung: 151 is 132w at 100px
  // tall and would still miss 231w at SMALL_H 120. Raising SMALL_H to 105 covers
  // only 16 of 23; to 120, only 19.
  //
  // build-logos.py already writes a -md at 150px tall for exactly this reason on
  // the set guides, and it covers DPR 3 phones on 26 of 27 sets and retina
  // desktop on 24 of 27, at about 21KB against the master's 51KB. Offering it
  // costs one more candidate in the attribute and no new files. Guarded on the
  // file existing, because Celebrations has no -md -- and does not need one, its
  // -sm is already 428w.
  const mdW = Math.round(ar * 150);
  const md = hasMd(setId) ? `, ${base}-md.webp ${mdW}w` : "";
  return (
    `<img class="${cls}" width="${smW}" height="100" src="${base}-sm.webp"` +
    ` srcset="${base}-sm.webp ${smW}w${md}, ${base}.webp ${d[0]}w" sizes="${sizes}"` +
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

// The -md rendition, which not every set has. Same read, same directory, and
// kept separate from `logosOnDisk` so a missing middle rung can never be
// mistaken for a missing logo.
const mdOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo-md\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
const hasMd = (setId) => Boolean(setId) && mdOnDisk.has(setId);

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

const descriptions = plainDashesAll(JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}")));

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

/* ------------------------------------------------- what each rip was worth --
 *
 * ONE NUMBER PER VIDEO: the raw guide value of the best card that came out of
 * it. Written here because this is the file that already resolves every hit
 * against its checklist, and read by build-proto.mjs to order the Greatest Hits
 * shelf on the home page.
 *
 * The owner, 23 August 2026: "the Greatest Hits videos should go in order of top hit
 * cards based on RAW market price ... always sort cards on all pages by most
 * valuable." That shelf had been ranked by pull TIER and then by view count, a
 * stand-in this repo's own TODO admits to, so a Hyper Rare with 932 views
 * outranked a more valuable card with fewer.
 *
 * IT IS WRITTEN RATHER THAN RE-DERIVED, and that is the whole point. Resolving
 * a hit to a printing and a price is 400 lines of promo handling, intl
 * checklists, First Partner joins and graded gates, and a second copy of it in
 * build-proto.mjs is exactly how this site would come to print two answers to
 * one question. build-all.mjs now runs build-proto AFTER this file so the
 * number is this run's, not last run's.
 *
 * `psa10` IS DELIBERATELY NOT THE FALLBACK. A graded figure is a different
 * measurement from a raw one and sorting a mixed column by whichever is bigger
 * is the exact bug /luck.html fixed in its own ordering: any card with a PSA 10
 * recorded outranked every card without one.
 */
const hitValues = {};
for (const [vid, list] of HITS_RESOLVED) {
  const best = list.reduce((n, h) => (typeof h.price === "number" && h.price > n ? h.price : n), 0);
  if (best > 0) hitValues[vid] = Math.round(best * 100) / 100;
}
await writeFile(
  join(ROOT, "data/hit-values.json"),
  JSON.stringify({
    _readme:
      "Best RAW guide value of any card pulled in each rip, keyed by YouTube id. " +
      "Written by scripts/build-pages.mjs, which resolves the hits; read by " +
      "scripts/build-proto.mjs to order the home page's Greatest Hits shelf. " +
      "Do not hand-edit: it is regenerated on every build.",
    checked: localDay(),
    videos: hitValues,
  }, null, 2) + "\n"
);
console.log(`Wrote data/hit-values.json  (${Object.keys(hitValues).length} rip(s) carry a raw value)`);

// A LOGGED CARD THAT REACHES NO CARD BAND IS REPORTED, ONE LINE EACH.
//
// The hit band renders a card the reader can SEE: `showableHits` needs a scan
// or a price, and a row with neither is dropped out of the band and falls back
// to the free-text panel. That behaviour is right and is argued at length where
// the filter is defined. What was missing is that it happened in SILENCE, on
// the same file that decides whether 319 rip pages show their pull at all.
// build-hall.mjs took exactly this lesson on 21 August 2026 -- it had been
// dropping eleven rows of the same file with three `continue`s that said
// nothing, on a page whose lede promises the whole list -- and every drop there
// reports now. This is the sibling file and it had the same gap.
//
// THE OTHER HALF WAS "MEASURED AND NOT DONE" AND THE MEASUREMENT WAS WRONG.
// This paragraph used to say that reading public/data/intl-guides.json, which
// build-hall.mjs does, "buys this file NOTHING", because those guides carry
// "no image and no price for any set in them". The price half is true. The
// image half was a fact about seven of the thirteen guides, written down as a
// fact about the file: six of them carry a complete set of scans, 671 in all.
// Three logged cards were rendering as text with a live TCGdex url sitting in a
// checklist this builder had been told not to open. It opens it now; the
// argument, the counts and the per-set breakdown are at intlChecklist above.
//
// The rest of that paragraph still stands and is honoured rather than reversed:
// the rarity slot is NOT handed to TCGdex's English word for a Japanese tier,
// pickIntlPrinting refuses a printing it cannot separate, and Goldeen still
// goes in with no collector number.
const unshowable = [];
for (const [vid, list] of HITS_RESOLVED) {
  for (const h of list) {
    if (h.img || typeof h.price === "number") continue;
    unshowable.push(
      // FIVE REASONS NOW, NOT FOUR, AND THE ONE THAT SPLIT WAS DOING THE MOST
      // WORK. "no English checklist for that set" was printed for every intl
      // hit, which was true and stopped being the whole story once this builder
      // started reading intl-guides.json: an intl set can now have a checklist,
      // hold the card, and still separate no printing, and that is a different
      // thing to go and fix from a set the site holds no list for at all.
      `${vid}: "${h.name}"${h.setName ? ` (${h.setName})` : ""} -- ` +
        (h.promo
          ? "a promo that matched no entry in public/data/printings/ and carries no price of its own"
          : !h.listed
            ? "this site holds no checklist for that set, in public/data/cards/ or in public/data/intl-guides.json, so there is no scan and no price to show"
            : h.printings === 0
              ? "that name is not on the checklist we hold for that set"
              : h.unresolved && h.intl
                ? `${h.printings} printings on that intl checklist carry that name and the tier written in the log separates none of them, so nothing here can say which was pulled`
                : h.unresolved
                  ? "that name is not on the checklist we hold for that set"
                  : "the checklist holds it and carries no scan and no price")
    );
  }
}

for (const v of tagged) {
  for (const s of v.sets) {
    if (!bySet.has(s)) bySet.set(s, []);
    bySet.get(s).push(v);
  }
}

// NEWEST FIRST IS AN ASSUMPTION THE "More <set>" BAND RESTS ON, SO IT IS
// CHECKED RATHER THAN TRUSTED.
//
// THE CLAIM THIS GUARD PROTECTS CHANGED ON 22 AUGUST 2026 AND THE GUARD DID
// NOT, which is the right way round: the band stopped calling the first entry
// of each kind "the newest", so the sentence that said so had to move rather
// than the throw. See `related` below. The band now takes entry
// (round + spin) % length of each kind, where spin is this page's own position
// in bySet.get(setId), so what this order actually buys is:
//
//   - THE ROTATION HAS A MEANING. spin walks the set's own rips newest to
//     oldest, so the newest rip of a set leads its rail with the newest of
//     each kind, the next one leads with the second newest, and so on down.
//     In any other order the offset is still a valid spread but it is a
//     spread over an arbitrary sequence, and "the newest rip shows you the
//     newest of each thing" stops being true of any page.
//   - IT IS STILL A DATED SEQUENCE INSIDE EACH KIND, so a rail reads as a run
//     rather than as a shuffle, and two pages one apart in the set differ by
//     one step rather than by a hash.
//
// If sync-youtube.mjs ever writes the catalogue in another order every page
// would still build, every gate would still be green, and nothing on the page
// would look wrong, which is exactly the failure a throw is for. Same
// reasoning as checkSetMap in build-decks.mjs and checkMapping in
// build-topps.mjs: a silent wrong answer is worth a throw.
for (const list of bySet.values()) {
  for (let i = 1; i < list.length; i++) {
    if (String(list[i].published || "") > String(list[i - 1].published || "")) {
      throw new Error(
        `public/data/videos.json is no longer newest-first (${list[i - 1].id} ${list[i - 1].published} ` +
          `before ${list[i].id} ${list[i].published}). The "More <set>" band walks each product kind from ` +
          `an offset taken from this page's own position in the same order, so both halves of that band ` +
          `become arbitrary; sort the catalogue or sort bySet here.`
      );
    }
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
  /* "a Elite Trainer Box" IS WHAT A HARDCODED ARTICLE WRITES HERE. Three of
     the 22 product labels start with a vowel sound -- Elite Trainer Box, ex Box
     and ex Premium Collection Box -- and until now the composed tail reached
     only two pages, neither of them one of those, so the sentence had never
     been wrong on a built page. Widening the fallback below is what would have
     made it wrong.

     U IS THE TRAP IN THE OTHER DIRECTION. UPC is spoken "you-pee-see" and takes
     "a", so a plain vowel-letter test fails on the one label that starts with
     one. An initial U followed by another capital is an acronym being spelled
     out; followed by a lowercase letter it is a word. */
  const article = (s) => (/^[aeio]/i.test(s) ? "an" : /^u[a-z]/.test(s) ? "an" : "a");
  const descTail = isTagged
    ? `: ${article(prodLabel)} ${prodLabel} rip from ${setLabel}, opened on Garbage Rips 585 in Rochester, NY.`
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
   * THE EMOJI TRAVELS WITH THE FULL STOP. The owner writes "...a certified Garbage
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
  /* A DESCRIPTION THAT ONLY REPEATS THE TITLE IS NOT A DESCRIPTION. One video's
     YouTube description is its own title and nothing else, so this published a
     48-character meta description word for word identical to the <title> above
     it: two identical lines in a search result and no reason to click either.
     The composed tail below already exists for a video with no description at
     all, and a description that says nothing the title did not is the same
     situation wearing a value.

     NARROW, AND COUNTED RATHER THAN GUESSED. Of the 322 rip pages exactly one
     has a description that repeats its title or runs under 70 characters, so
     this rewrites that page and leaves the other 321 byte for byte. 70 is the
     floor seo-sweep.py already applies to every page on the site, not a number
     invented here.

     ONLY THE META DESCRIPTION. The visible blurb and the VideoObject schema
     still carry the real YouTube text, because that is what the video actually
     says about itself; this is the page's own summary, which is a different
     claim with a different audience. */
  const flat = (t) => t.replace(/\s+/g, " ").trim().toLowerCase();
  const descSaysNothingNew = !desc || desc.length < 70 || flat(desc) === flat(title);
  const metaDesc = descSaysNothingNew
    ? shortTitle + descTail
    : clip(desc.replace(/\s+/g, " "), 158);
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
  //
  // SORTED, BECAUSE sets.json's ORDER IS NOT. That list is only ever repriced in
  // place and never re-sorted, so slicing three off the front is slicing off
  // whatever was most expensive the day it was built. On Perfect Order that put Mega
  // Zygarde ex at $120 above Meowth ex at $128 and led the band with a card the
  // set guide does not call the chase card. See chaseByPrice in
  // shared/card-prices.mjs.
  const chaseCards = chaseByPrice(setData.get(setId)?.chase).slice(0, 3).map((c) => ({
    ...c,
    psa10: gradedPrice(setId, c.number, c.name, setData.get(setId)?.name || setLabel),
  }));
  // WILL THE HITS BAND CARRY THE SOURCING NOTE? The chase band below prints
  // prices too, so it needs one -- but only when the hits band is not already
  // going to print the identical paragraph further down the same page. This is
  // the same test the hits band applies to itself; it is read here rather than
  // duplicated as a literal so the two cannot drift into disagreeing about
  // which pages get a note.
  const ripHits = HITS_RESOLVED.get(v.id) || [];
  const hitsBandHasNote =
    ripHits.some((h) => typeof h.price === "number") || ripHits.some((h) => h.psa10);

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
    ${/* THE CHASE BAND PRINTS PRICES AND HAD NO SOURCE LINE, ON 154 PAGES.
          Found by a content audit on 24 August 2026. The site's hard rule is
          that every price carries a source and the date it was read, and the
          note that says so was gated on `pricedHits.length || hits.some(h =>
          h.psa10)` down in the HITS section. So a rip that produced a hit got
          the note and a rip that produced NOTHING did not, while this band
          printed "Raw $967 PSA 10 $2,378" either way.

          Measured on the built tree before the fix: 299 rip pages print a
          price, 145 carried the note, 154 carried no attribution anywhere on
          the page. The numbers were never wrong -- they match the set guides
          exactly -- only the sourcing was missing, which on this site is the
          part that makes a number worth reading.

          IT IS THE SAME SENTENCE, NOT A SHORTER ONE. A band that cites its
          source in fewer words than the band above it invites the reader to
          wonder which one is the real disclosure. */ ""}
    ${hitsBandHasNote ? "" : `<p class="price-note">${esc(priceNote(pricesDoc, { lead: "Raw prices" }))}
      PSA 10 prices come from PriceCharting's guide too, read the same day, and only exist for some cards, so the
      line is shown where we have one and left off where we do not. We do not sell cards.</p>`}
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
//
// THAT FIX ONLY WENT ONE WAY AND THE OTHER HALF SHIPPED. `unresolved` was the
// wrong test in both directions, because an unresolved PROMO can still resolve
// a scan out of the printings corpus while a resolved card can still have no
// price. What the band is FOR is showing a card: a scan, a price, or both. So
// the test is what a row can actually show, and it is the same test on both
// sides of the branch, which is what stops the panel and the band appearing
// together. Counted off the built tree on 19 August 2026: 8 rip pages carried
// BOTH, the free text panel naming the card and then a band 500px below it
// promising "1 card worth keeping, with what they go for raw" over one blank
// placeholder reading "No market price", followed by 347px of PriceCharting
// methodology about prices that were not on the page. About 1,150px of nothing
// per page, under a heading that says what came out of this one.
const showableHits = hits.filter((h) => h.img || typeof h.price === "number");
const pricedHits = hits.filter((h) => typeof h.price === "number");
// WHETHER THIS PAGE PAYS FOR THE NO-SCAN PANEL'S RULES. The band renders every
// hit once ANY of them is showable, so a row with neither a scan nor a price
// still gets a tile, and that tile is the empty box the owner asked about. Four pages
// of the 319 carry one today, so the rules are gated rather than shipped
// everywhere: they are render-blocking bytes and 315 rip pages have nothing for
// them to style. Same gate on /hall.html and on both set-guide builders.
const noScanHits = showableHits.length && hits.some((h) => !h.img);
  // PACKS OUT OF THE SAME BOX, which is a stronger connection than "same set":
  // #1 through #10 of one ETB are one sitting, and a viewer who watched pack 3
  // usually wants pack 4, not another Chaos Rising rip.
  //
  // THIS BAND HAD NEVER RENDERED ONCE. It read `v.box`, and no video has ever
  // carried a `box` field: the sheet writes `label`, which is the name this
  // rip goes by everywhere else on the site ("Pitch Black ETB 1 - Pack 8" is
  // what /videos.html, the home page and the playlist pages print as its
  // title). Verified against the built tree: 0 of 317 pages had the band.
  //
  // The box is the label with its pack suffix taken off, so the grouping is
  // the owner's own naming rather than anything derived. 17 boxes, 48 videos in a
  // box with at least one sibling.
  //
  // ORDERED BY WHAT COMES NEXT, then filled backwards, then printed in pack
  // order. Six tiles off the front of a nine pack run would show packs 1 to 6
  // to somebody who just watched pack 9.
  const boxOf = (x) => {
    const m = /^(.+?) - Pack \d+$/.exec(x.label || "");
    return m ? m[1] : null;
  };
  const myBox = boxOf(v);
  const boxMates = myBox ? videos.filter((x) => x.id !== v.id && boxOf(x) === myBox) : [];
  // OFF THE LABEL, NOT OFF packNumber. The two agree on all 55 videos that have
  // either today, but the label is what the grouping above is keyed on, so
  // reading the order from a second field is a way for them to disagree later.
  const packNo = (x) => Number((/ - Pack (\d+)$/.exec(x.label || "") || [])[1] || 0);
  const sameBox = [
    ...boxMates.filter((x) => packNo(x) > packNo(v)).sort((a, b) => packNo(a) - packNo(b)),
    ...boxMates.filter((x) => packNo(x) < packNo(v)).sort((a, b) => packNo(b) - packNo(a)),
  ]
    .slice(0, 6)
    .sort((a, b) => packNo(a) - packNo(b));

  // ==========================================================================
  // "More <set>" WAS A NEWEST-FIRST SLICE AND IT KEPT REPRINTING THE BAND
  // ABOVE IT. Fixed 22 August 2026.
  //
  // THE RULE IS ALREADY WRITTEN DOWN AND THIS FILE WAS THE ONE PLACE NOT
  // FOLLOWING IT. CLAUDE.md, under "Which pages have something to watch":
  // "ONE PER KIND BEFORE ANY KIND REPEATS. Same round robin as setRipsFor in
  // build-pokemon.mjs ... Single packs are 90 of the 316 videos, so a
  // newest-first slice off the pool turns a band about the VARIETY of sealed
  // product into a band about single packs." setRipsFor rounds robin over
  // SETS because a species is printed in many; this band is already scoped to
  // one set, so the axis that is left is WHAT WAS OPENED.
  //
  // WHAT THE FLAT SLICE WAS ACTUALLY PRODUCING, measured over all 319 rips
  // before this change:
  //
  //   - 333 of the 1,306 set-rail tiles on the 221 pages that carry BOTH
  //     rails, 25.5%, were a video already shown in "More from <box>" higher
  //     up the same page. On 25 of those pages the lower band was a COMPLETE
  //     copy of the upper one: twelve tiles, six videos, one picture.
  //   - 132 of the 300 set rails, 44.0%, were a single product kind end to
  //     end, and the mean was 1.66 kinds over six tiles.
  //
  // AFTER: 4.64 distinct kinds per rail and 34 rails, 11.3%, still one kind.
  // Those 34 are sets the channel has only ever opened one way, which is a
  // true thing about the set rather than a shortfall of the sort. The repeats
  // go 333 to 14, 25.5% to 0.8%, and no rail loses a tile: sizes are identical
  // to the old slice, 270 rails of six and the rest short because the set has
  // nothing more in it.
  //
  // BUSIEST KIND FIRST so the lead tile comes off the kind this set has been
  // opened most, exactly as setRipsFor leads with the busiest set. Newest
  // first inside each kind, which is what the pool already is (videos.json is
  // sorted newest-first and bySet preserves it; asserted where bySet is built
  // rather than trusted, because this band silently degrades to the OLDEST of
  // each kind if that ever stops being true and nothing on the page shows it).
  //
  // THE BOX RAIL GOES LAST RATHER THAN OUT, and that pair of measurements is
  // the reason. `exclude` in setRipsFor is a hard drop, which is right there
  // because its two tiers draw on the same large pool; here the pool IS the
  // set, and a hard drop empties four rails outright and shortens ten more.
  // Sorting the box rail's own videos to the BACK of the queue instead costs
  // nothing: every rail keeps exactly the length it had, and the 14 tiles that
  // still repeat are the sets where there is genuinely nothing else to show.
  //
  // ==========================================================================
  // THE MARK THAT WAS PROPOSED FOR THESE TILES AND WAS MEASURED AND REJECTED,
  // written here so nobody pays for the measurement twice. A design review
  // proposed a hit / no-hit mark on every rail tile, on the grammar that "a
  // mark earns its place when it states something true about that page's own
  // data, emitted from a field, and the field must be false on most pages". It
  // is a good idea and the field is there: hasHit answers 290 of 319 rips, and
  // the outcome rule build-luck.mjs settled on (hasHit, or a card named in
  // data/hits.json) answers 291. THREE MEASUREMENTS KILLED IT.
  //
  //   1. IT IS NOT RARE, WHICH IS ITS OWN TEST. Counted per rail rather than
  //      sitewide: a no-hit mark lands on 648 of the 1,190 box-rail tiles,
  //      54.5%, and 775 of the 1,688 set-rail tiles, 45.9%. The rule wants a
  //      field that is FALSE on most pages and on the box rail it is TRUE on
  //      most of them. A mark on more than half the tiles is wallpaper with an
  //      opinion in it. (The mark does SPLIT a rail -- 91.4% of box rails and
  //      94.3% of set rails are mixed, mean hit fraction 45.5% and 49.0% -- so
  //      the failure is not that it differentiates nothing. It is that half a
  //      wall of badges is still a wall.)
  //   2. IT IS THE POSTER-FRAME PROBLEM IN SMALLER TYPE. ogCard at the top of
  //      this file exists because the share card used to be YouTube's poster
  //      frame, which is nearly always the pulled card, so "sharing a rip page
  //      in a message showed the hit before anyone opened it, the one thing the
  //      pack wrappers exist to prevent". Stamping the OUTCOME on a tile is
  //      that decision reversed one notch, on the control whose whole job is to
  //      get the rip opened.
  //   3. THE MASCOT'S WORD IS ALREADY SPENT ON THIS PAGE. build-search.mjs
  //      argues that "Trubbish already means 'there is nothing in this one' in
  //      three places and the meaning is worth keeping single", and one of
  //      those three is the .nohits band a few hundred lines below, on this
  //      same page. A no-hit rip would then carry a 180px Trubbish saying it
  //      once and three 20px Trubbishes saying it again about other rips.
  //
  // WHAT WAS BUILT INSTEAD answers the question a reader actually has before
  // they press play -- what is about to be opened -- takes it from a field
  // (products[0]), gives nothing away, and after the sort above it differs on
  // 5.11 of the six tiles rather than on one bit.
  // ==========================================================================
  // AND THE ROUND ROBIN WAS STILL THE SAME SIX TITLES ON EVERY PAGE IN A SET.
  // Fixed 22 August 2026, and it is one index rather than any new copy.
  //
  // The sort above is a per-page fix to a per-page complaint: the lower band
  // was reprinting the upper one. It never touched the SIDEWAYS problem, which
  // is that byKind.get(k)[round] is a fixed window off the HEAD of each kind
  // list and the kind lists are a property of the SET. Two rips of Chaos
  // Rising differ only in which one of them is filtered out of its own rail,
  // so 30 pages of a set were handed the same six tiles, the same six titles
  // and the same six dates, and a crawler reads that as 30 near-copies.
  //
  // MEASURED, 7-word shingles over <main>, best match against any sibling,
  // over all 320 rip pages, on a real build of each tree:
  //
  //                             >=0.50   >=0.60   >=0.70    mean
  //     as shipped                 277      233       76   0.619
  //     minus "More from <box>"    285      233       69   0.623
  //     minus "More <set>"         242      114       17   0.548
  //
  // The box rail is worth NOTHING here and removing it makes the page very
  // slightly worse, because it is already differentiated: it is scoped to one
  // box and the boxes are small. This band was essentially the whole effect,
  // and none of it was boilerplate -- only 13.8% of a page's shingles appear
  // on half the rip pages, so it is sibling-to-sibling and not chrome. Adding
  // WORDS does not touch it either: the pages that carry a named-hit band are
  // MORE duplicated (0.643) than the ones that do not (0.598) despite being
  // 131 words longer, which is what a rail-shaped problem looks like from the
  // outside.
  //
  // THE FIX IS TO SPIN THE WINDOW, NOT TO WIDEN IT. Each kind list is walked
  // from an offset taken from this page's own index in bySet.get(setId), so
  // page 0 of a set gets the newest of each kind, page 1 the second newest,
  // page 2 the third, wrapping at the end of each kind independently. The
  // wrap is per kind, and because the kind lists are different lengths the
  // offsets decorrelate on their own rather than marching in step.
  //
  // EVERY INVARIANT THE SORT ABOVE BOUGHT SURVIVES, and that is arithmetic
  // rather than luck: which ROUND a kind contributes on is untouched, so the
  // shape of the rail cannot move. `round >= list.length` is the same stop
  // condition the old `if (!x) continue` was, which is what keeps ONE PER KIND
  // BEFORE ANY KIND REPEATS true and, just as importantly, stops the modulo
  // handing the same video back twice on a short kind list. Rail LENGTHS,
  // DISTINCT KINDS PER RAIL, and therefore `showKind`, all depend only on the
  // kind list lengths and are identical to the tile-for-tile. The box rail's
  // videos are still demoted to the BACK of the queue rather than dropped, and
  // whether the fallback fires depends only on pool sizes, so the 14 tiles
  // that still repeat the box rail stay 14.
  //
  // WHAT IT ACTUALLY BOUGHT, same measurement, same trees:
  //
  //                             >=0.50   >=0.60   >=0.70    mean
  //     before                     277      233       76   0.619
  //     after                      193       66        4   0.516
  //
  // 271 of the 305 pages that carry a set rail have a pool bigger than the
  // rail, so there is room to rotate on nearly all of them. The 34 that do not
  // are sets the channel has opened six or fewer times, where the rail is the
  // whole pool and there is nothing to spin: those pages are unchanged and
  // always will be, which is a true thing about the set rather than a
  // shortfall of the sort.
  //
  // WHAT IT COSTS, said plainly because the table does not show it: a reader
  // walking a set's rips in order no longer sees the same six recommendations
  // on each one, which is the point, but it also means the SINGLE most recent
  // rip of a kind is no longer on every page of that set. It leads page 0's
  // rail and then steps back one page at a time. That is the trade, and it is
  // the right way round for a band whose heading is "More <set>" rather than
  // "Latest <set>".
  // ==========================================================================
  const railFor = (pool, spin = 0) => {
    const byKind = new Map();
    for (const x of pool) {
      const k = (x.products || [])[0] || "";
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k).push(x);
    }
    const kinds = [...byKind.keys()].sort((a, b) => byKind.get(b).length - byKind.get(a).length);
    const out = [];
    for (let round = 0; out.length < 6 && round < 40; round++) {
      let added = false;
      for (const k of kinds) {
        const list = byKind.get(k);
        // The old test was `if (!x) continue`, on a plain [round]. It has to
        // stay a test on ROUND rather than on the element, because the modulo
        // below never returns undefined and would otherwise loop a two-video
        // kind forever and print the same tile three times.
        if (round >= list.length) continue;
        out.push(list[(round + spin) % list.length]);
        added = true;
        if (out.length >= 6) break;
      }
      if (!added) break;
    }
    return out;
  };
  const related = (() => {
    const setPool = setId ? bySet.get(setId) || [] : [];
    const pool = setPool.filter((x) => x.id !== v.id);
    // THIS PAGE'S OWN INDEX IN THE SET, newest first, asserted where bySet is
    // built. Not a hash of the id: a hash spreads just as well and gives up
    // the one thing this ordering is good for, which is that the newest rip of
    // a set leads its rail with the newest of every kind. Both railFor calls
    // take the SAME spin so the fallback tail stays in step with the head.
    const spin = Math.max(0, setPool.findIndex((x) => x.id === v.id));
    const shownAbove = new Set(sameBox.map((x) => x.id));
    const out = railFor(pool.filter((x) => !shownAbove.has(x.id)), spin);
    if (out.length < 6) {
      for (const x of railFor(pool.filter((x) => shownAbove.has(x.id)), spin)) {
        if (out.length >= 6) break;
        out.push(x);
      }
    }
    return out;
  })();

  // THE CHIP IS CONDITIONAL AND THAT IS THE WHOLE OF ITS ARGUMENT. A label
  // repeated on all six tiles is not a differentiator, it is wallpaper with a
  // word in it, so the tiles say what was opened only where the rail opened
  // more than one thing. It is on 266 of the 300 set rails and on NEITHER
  // rail of the box band, where every tile is by construction one pack out of
  // one box and a chip would say "Single Pack" six times under a heading that
  // already names the box.
  const railKinds = new Set(related.map((x) => (x.products || [])[0] || ""));
  const showKind = railKinds.size > 1;

  const ld = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: desc || metaDesc,
    thumbnailUrl: [thumb],
    /* THE TIMESTAMP, NOT THE DATE. Google reads uploadDate as a datetime and a
       bare "2026-02-05" fails it twice over: invalid value, and no timezone.
       v.publishedAt is YouTube's own RFC 3339 stamp; v.published is the sliced
       display date and is only the fallback for a record synced before that
       field existed. */
    uploadDate: v.publishedAt || v.published,
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
<meta name="description" content="${esc(clipMeta(metaDesc))}">${isTagged ? "" : '\n<meta name="robots" content="noindex,follow">'}
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
${/* NO PRECONNECT TO i.ytimg.com, AND IT WAS HERE ON ALL 317 OF THESE PAGES
     UNTIL 20 August 2026. Measured at 390x844 with the network log: a rip page
     makes ZERO requests to that host, on load AND after a real click on the
     pack. The player mounts youtube-nocookie.com. The only i.ytimg.com string
     left outside a noscript block is thumbnailUrl inside the JSON-LD, which a
     crawler may read and a browser never fetches. So this bought a DNS lookup,
     a TCP connect and a TLS handshake to a host the page never speaks to,
     multiplied by 317.

     AND NOTHING REPLACES IT, DELIBERATELY. youtube-nocookie.com is the host the
     click actually hits, so preconnecting THAT looks like the obvious fix. It
     is not: it would open a connection to Google on every rip page view whether
     or not the reader ever presses play. This site chose the nocookie host on
     purpose, and paying for that handshake up front on 317 pages, for a request
     most readers never make, hands back the thing that choice was protecting. */ ""}
${/* THE PACK IS THIS PAGE'S LCP ELEMENT AND THE PRELOAD SCANNER CANNOT SEE IT.
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
     "default" otherwise, and both ship a pack. */ ""}
<link rel="preload" as="image" href="/assets/packs/${packSet}-garbage-rips-585-booster-pack.avif" type="image/avif" fetchpriority="high">
${FONTS}
${STYLES}
<style>${RARITY_CSS_MIN}${noScanHits ? `\n${NOSCAN_CSS}` : ""}${showKind ? `\n${KIND_CSS}` : ""}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}

<main id="main" tabindex="-1" class="rip tight${v.greatest ? " hall" : ""}">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/videos.html">Every rip</a>${setId ? ` / <a href="/videos.html?set=${setId}">${esc(setLabel)}</a>` : ""}</nav>
    <div class="rip-grid${v.vertical === false && !(OVERRIDES[v.id] || {}).pillarboxed ? " rip-grid--wide" : ""}">
      <div class="rip-stage">
        <div class="rip-player pack-player${(OVERRIDES[v.id] || {}).pillarboxed ? " rip-player--crop" : v.vertical === false ? " rip-player--wide" : ""}" id="player" data-id="${v.id}" data-title="${esc(title)}">
          ${/* THIS POSTER IS COMPLETELY COVERED BY THE PACK, AND IT IS IN A
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
               closed the string and failed the build once already.) */ ""}
          <noscript>
            <picture>
              <source type="image/webp" srcset="${thumbWebp}">
              <img src="${thumb}" alt="" width="${v.vertical === false ? 1280 : 720}" height="${v.vertical === false ? 720 : 1280}" decoding="async">
            </picture>
          </noscript>
          ${/* THE VISIBLE WORDS HAVE TO BE IN THE ACCESSIBLE NAME. WCAG 2.5.3, Label in
              Name: this button SHOWS "CLICK TO RIP THE PACK" and its name said
              "Rip open: <title>", so somebody driving the page by voice says what
              they can see and nothing happens. The name now starts with the
              visible string and keeps the title after it, which is what a screen
              reader needs to tell one rip page's button from another's.
              The tile banners elsewhere are a different case and stay as they
              are: there the banner is aria-hidden decoration repeated on every
              card and the control's real label is the video title. See the note
              over RIP_BANNER in shared/format.mjs. */ ""}<button class="pack pack--${packSet}" id="pack" type="button" aria-label="Click to rip the pack: ${esc(title)}">
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
            ${/*
              The pack is a button that mounts the player, so with scripting off
              it is a picture that does nothing and the visitor cannot watch the
              rip at all. This link only exists in that case: it never renders
              for anyone whose browser runs the pack.

              It is a deliberate exception to "every click stays on the site".
              That rule exists so a tile does not bounce somebody to YouTube
              when the site could have shown them the video itself. Here the
              site cannot, so a dead pack is the only other option.
            */ ""}
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
          ${/*
            THE BIGGEST CARD THE CHANNEL HAS EVER PULLED SAID NOTHING ON ITS OWN
            PAGE. `greatest` and `hofRank` are stamped onto the video and the
            only thing this file did with them was add a "hall" class to <main>,
            whose single rule in ui.css is a hover shadow on the related tiles,
            so on a phone the flag rendered nothing at all. Meanwhile the 38
            pages with NO hit all carry a button to /hall.html and the one page
            that IS the Hall of Fame did not.

            A CHIP AND NOT THE GOLD BADGE. The gold is semantic and lives in
            three named places in ui.css; a fourth would have to be added there,
            and that file is not this builder's to change. A plain chip is the
            control this page already has room for and it says the true thing.
          */ ""}${v.greatest ? `<a class="chip" href="/hall.html">Hall of Fame${v.hofRank ? ` #${v.hofRank}` : ""} <span aria-hidden="true">&rarr;</span></a>` : ""}
          ${
            // THE RARITIES COME OUT OF THE HIT FIELD, not out of a second column.
            // The owner writes every hit into one free text cell because a single rip
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
        ${/*
          WHAT WAS OPENED, WHICH THE PAGE ABOUT THE OPENING DID NOT SAY.
          `label` is the sheet's own name for this rip, "Pitch Black ETB 1 -
          Pack 8": the set, the product, WHICH copy of that product, and which
          pack out of it. 294 of the 317 videos carry one and build-pages.mjs
          printed none of them, while /videos.html, the home page, the playlist
          pages, the set guides and /openings/etb.html all use it as the tile
          title. So a reader clicked a tile reading "Pitch Black ETB 1 - Pack 8"
          and landed on a page headed "Trubbish Food | Pitch Black Pack #8" with
          nothing on it confirming they were in the right place.

          It also settles the pack count, which is the thing this project has
          got wrong more often than anything else: a chip reading "Booster
          Bundle" says what the PRODUCT HOLDS, and on "Did this Bundle have ANY
          hits?!" a reader could not tell whether the video opened all six packs
          or the sixth one. "Pitch Black Booster Bundle 1, pack 6" says which.

          It REPLACES openingType rather than joining it. Every one of the 58
          videos with an openingType has a label, and the label already contains
          the product, so printing both gave "Pitch Black Pack - Pack 9 ...
          Sleeved Booster Pack", which is the same fact twice.

          The separator inside the label is normalised because "Pitch Black
          Pack - Pack 8" reading across a bullet is a puzzle. A box name gets a
          comma ("Pitch Black ETB 1, pack 8") and a name that already ends in
          Pack takes a number instead, since "Pitch Black Pack, pack 8" says
          pack twice. The owner's words, site punctuation.
        */ ""}<p class="rip-meta">${
          v.label
            ? esc(v.label.replace(/ - Pack (\d+)$/, (_m, n) => (/Pack$/i.test(v.label.slice(0, -_m.length)) ? ` #${n}` : `, pack ${n}`))) + " &bull; "
            : ""
        }${shortDate(v.published)}${v.views ? " &bull; " + niceViews(v.views) : ""}${!v.label && v.openingType ? " &bull; " + esc(v.openingType) : ""}</p>
        ${/*
          THE PARAGRAPH IS A FALLBACK, NOT A HEADING.
          The Hit Card column is free text, and on a 14-pull video it arrives as
          a 936 character comma-separated dump: "Phantasmal Flames - Trainer -
          Dawn - Double Silver Star - Ultra Rare, Phantasmal Flames - Mega
          Gengar ex - ...". Those same 14 cards render below with their scans,
          their prices and a lightbox, so printing the dump as well says nothing
          the reader is not about to see, badly.

          So it renders only when there is nothing to show it with. One card
          named in the sheet and no scan and no price for it is exactly the case
          this paragraph exists for, and it still gets it. showableHits is the
          same test the band below uses, so the two can never both appear.

          IT PRINTS THE PARSE WHERE THERE IS ONE, AND THE CELL ONLY WHERE THERE
          IS NOT. Until 20 August 2026 it always printed the cell, and on the
          one page in the tree that reaches this branch the cell is
          "Cyber Judge - Incineroar ex - SR - Super Rare": a reader was shown
          spreadsheet syntax, dashes and all, on the only page on the site that
          did that. data/hits.json already holds that same cell read out into a
          card, a set and a rarity, so the parse is strictly more of what the
          paragraph is for and none of the punctuation.

          THE CELL IS STILL THE FLOOR AND THAT IS THE WHOLE POINT OF IT. A
          fragment the parser did not understand produces no hit, and those
          pages fall through to the owner's own words exactly as before, which is the
          promise import-sheet.mjs makes when it keeps the raw string: nothing
          he types can be lost by a rule that failed to read it.
        */ ""}${v.hitCard && !showableHits.length ? `<div class="hit-panel">
          <p class="hit-label">The hit</p>
          <p class="hit-card">${esc(hits.length ? hits.map((h) => h.name).join(", ") : tidy(v.hitCard))}</p>
          ${(() => {
            // The sheet's own Hit Rarity column first, because it is a column he
            // filled rather than a sentence something read. Where it is blank and
            // every parsed hit agrees on one tier, that tier says the same thing.
            const tiers = [...new Set(hits.map((h) => h.rarity).filter(Boolean))];
            const r = v.hitRarity || (hits.length && tiers.length === 1 ? tiers[0] : null);
            return r ? `<p class="hit-rarity">${esc(rarityLabel(r))}</p>` : "";
          })()}
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
  showableHits.length
    ? `<section class="band tight hits-band">
  <div class="wrap">${/* IT SAID "Below the fold", WHICH IS WEB JARGON FOR WHERE A THING SITS,
         and it was the only section label on the site that named a POSITION
         instead of a subject. Swept across all 1,483 built pages: every other
         .sec-label reads as content ("The whole list", "What is actually rare",
         "Pulled on camera", "In the video games"), and this one read like a
         note the author left themselves. That is the same failure as the
         "dearest" leak: a code comment's register turning up in the copy. It
         shipped on the 38 rip pages that have a card to show. */ ""}
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Out of the wrapper</p>
    <h2>What came out of <span class="hl">this one</span></h2>
    ${/*
      THE LEDE PROMISED PRICES THE BAND DID NOT HAVE.
      It said "with what they go for raw" whenever there was a hit at all, and
      counted every row whether or not that row carried a number. On the Costco
      UPC rip that read "21 cards worth keeping, with what they go for raw and
      in a PSA 10" over 14 priced rows, 7 unpriced ones and 2 PSA 10 figures.
      The count now describes what is on the page: the total is still every
      card, because every card really was pulled, and the price clause names how
      many of them the price file actually covers.
    */ ""}<p class="lede" style="max-width:38em">${hits.length} card${hits.length === 1 ? "" : "s"} worth keeping${(() => {
        const one = hits.length === 1;
        if (!pricedHits.length) {
          return one
            ? ". It carries no sourced price, so this is what came out rather than what it is worth"
            : ". None of them carry a sourced price, so this is what came out rather than what it is worth";
        }
        const raw =
          pricedHits.length === hits.length
            ? one ? ", with what it goes for raw" : ", with what they go for raw"
            : `, with what ${pricedHits.length} of them go${pricedHits.length === 1 ? "es" : ""} for raw`;
        const graded = hits.filter((h) => h.psa10).length;
        const psa = !graded ? "" : graded === hits.length ? " and in a PSA 10" : " and in a PSA 10 where we have one";
        return raw + psa;
      })()}.</p>
    <ul class="hitcards" id="hitcards">
      ${hits
        .map(
          (h, hi) => `<li class="hitcard" style="--i:${hi}" data-name="${esc(h.name)}" data-set="${esc(h.setName || "")}" data-n="${esc(h.n || "")}" data-rarity="${esc(rarityLabel(h.rarity) || "")}" data-img="${esc(h.imgLarge || (h.img ? h.img.replace("low.webp", "high.webp") : ""))}" data-price="${typeof h.price === "number" ? moneyExact(h.price) : ""}" data-psa="${h.psa10 ? moneyRound(h.psa10) : ""}" data-src="${esc(h.priceSource || "")}">
        ${/* A HIT CARD WITH NO SCAN IS NOT A BUTTON, AND UNTIL 21 AUGUST 2026
              IT WAS ONE ON EVERY ONE OF THEM. The control was emitted
              unconditionally, so a card with nothing to enlarge still shipped
              a full-card target aria-labelled "See Mabosstiff ex larger". It
              opened the dialog, locked the scroll and drew a picture box
              measuring 0px, leaving the reader the name, the set and "No
              market price": the three lines they had already read on the tile
              they tapped. Six slots on four rip pages, and the count grows
              with every import (it was two a commit earlier).
              /hall.html has done this right since the day the intl plaques
              landed, in the same words -- "A CARD WITH NO SCAN IS NOT A
              BUTTON" -- and its plaqueArt branch is what this copies: the
              named box stays, the button does not, so nothing offers a tap
              that does nothing. The dialog and its markup are untouched. */ ""}
        ${h.img ? `<button class="hitcard-open" type="button" aria-label="See ${esc(h.name)} larger"></button>` : ""}
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
            ? hitcardImg(h.img)
            // AND A HIT CARD WITH NO SCAN IS NOT AN EMPTY BOX EITHER, since
            // 22 August 2026. The owner: "there should be no empty place holder
            // images anywhere on the site." The branch above stopped it being
            // a button; this stops it being a hatched rectangle. It is the
            // set's own symbol and the words "No scan", still aria-hidden,
            // still holding the same ratio box so the grid cannot jump. Six
            // slots on four rip pages today. The argument for what goes in it,
            // and for the three things that deliberately do not, is the second
            // half of shared/card-scan.mjs.
            : noScanBox("hitcard-img is-none", { slug: h.setId, name: h.setName })
        }
        <div class="hitcard-b">
          <p class="hitcard-n">${esc(h.name)}</p>
          ${/* A HIT CAN LEGITIMATELY HAVE NO SET. The owner writes the set on most hit
               lines and leaves it off some, and on a video that opened packs
               from several sets nothing can honestly say which one a card came
               from. esc(undefined) rendered the literal string "undefined" on
               three rip pages. Absent means print nothing, which is what the
               rest of this file does with missing data. */ ""}
          ${/* AND A COLLECTOR NUMBER WITH NO SET IS NOT A SET LINE. This used
               to fall back to printing the bare number, which is the half of
               the "#025" fault that lives in the markup rather than in the
               join. A number is only checkable against the catalog it was
               issued in, so with no set named it asserts nothing a reader can
               act on and it reads like a broken template. The number is still
               on the li as data-n and still reaches the lightbox, which prints
               it only alongside a set for the same reason.
               The join above should now mean this branch never fires; it is
               kept honest rather than deleted, because the next import is what
               produced the last one. */ ""}
          ${h.setName ? `<p class="hitcard-s">${esc(h.setName)}${h.n ? ` &bull; #${esc(h.n)}` : ""}</p>` : ""}
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
    ${/*
      THE SOURCING NOTE ONLY SHIPS WHERE THERE IS A NUMBER TO SOURCE. It is
      347px of PriceCharting methodology at 390x844, and it was printing on
      pages where not one card carried a price: the last thing on the Japanese
      Cyber Judge rip, with no chase band and no related band under it, was a
      paragraph explaining how prices nobody had shown were arrived at. Where a
      price IS shown the note stays exactly as it was, because that is the
      sentence that makes the number worth trusting.
    */ ""}${pricedHits.length || hits.some((h) => h.psa10)
      ? `<p class="price-note">${esc(priceNote(pricesDoc, { lead: "Raw prices" }))}
      PSA 10 prices come from PriceCharting's guide too, read the same day, and only exist for some cards, so the
      line is shown where we have one and left off where we do not. Promos are not in that feed at all: where a promo carries a price it was
      read by hand from the source named under it, on the date shown, and it does not refresh overnight like the rest. We do not sell cards.</p>`
      : ""}
  </div>
</section>`
    : v.hasHit === false
      ? `<section class="band tight nohits">
  <div class="wrap">
    <img class="nohits-img" src="/assets/trubbish.webp" alt="" loading="lazy" onerror="this.remove()" decoding="async" width="180" height="180">
    <h2>No hits. Just another <span class="hl">classic</span> garbage rip.</h2>
    ${/*
      "THAT IS MOST OF THEM" WAS A PULL RATE IN A FRIENDLY VOICE, on 38 pages.
      Read on a page about one pack that produced nothing, it tells the reader
      how often a pack produces nothing, which is the one claim this site never
      makes because The Pokemon Company does not publish odds and a channel's
      own log is a sample. /luck.html goes out of its way to say so in its first
      sentence, that it is one person's luck and not the odds, and this line sat
      on 38 rip pages contradicting it.

      It was not even true of the log it was implicitly quoting. Of the 106 rips
      marked either way, 68 hit and 38 did not, so "most of them" is the wrong
      side of the site's own count.

      What replaced it keeps the feeling and gives the frequency question the
      page it belongs on. That link is also the only thing pointing at
      /luck.html from this family, and a rip that came up empty is the most
      natural place on the site to ask how often that happens.
    */ ""}<p class="lede">The good ones only mean anything because of these. How often a rip comes up empty is <a href="/luck.html">counted on the luck page</a>, not guessed at.</p>
    <p><a class="btn btn-sky btn-sm" href="/hall.html">See the ones that did hit</a></p>
  </div>
</section>`
      : ""
}

${sameBox.length ? `<section class="band tight">
  <div class="wrap">
    <div class="sec-head">
      <div><h2>More from <span class="hl">${esc(myBox)}</span></h2></div>
    </div>
    ${/*
      THE TILES ARE NUMBERED, NOT TITLED, and that is the whole point of the
      band. Under a heading naming one box, "Pack 4" and "Pack 5" put the rip
      the reader is on in a sequence; six YouTube titles do not, and the "More
      <set>" band below already lists those. The full name stays on the link
      for anyone not reading the heading.
    */ ""}<div class="vid-grid">
      ${sameBox.map((r) => `<article class="vid">
        <a class="vid-shell" href="/${pathFor(r)}" aria-label="${esc(r.label || r.title)}">
          <span class="pack pack--tile pack--${tileSet(r)} pack--img" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art">${packTileImg(tileSet(r))}</span>
              <span class="pack-brand">${esc(r.sets[0] ? labelFor("sets", r.sets[0]) : "GARBAGE RIPS")}<small>${r.sets[0] ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>
          ${/* THE BANNER, NOT THE DISC, ON THESE RAILS TOO. 24 August 2026, and
                this is the owner's call being taken: "make sure on any page that has
                videos to play that all the thumbnails have the click to rip the
                pack bar at the bottom and have the pack opening animation,
                thats my favorite feature of the site".

                CLAUDE.md has recorded this gap for a while and parked the
                decision: every pack artwork on the site says CLICK TO RIP THE
                PACK except the rip-page rails, which kept a play disc from
                before the banner existed. Measured on the built tree before
                this change: 322 rip pages carried 322 banners, one each for
                the hero, and 3,020 discs across the rail tiles.

                THE DISC WAS ALSO THE WEAKER CONTROL. Measured off rendered
                pixels, its outer edge is 1.00:1 against the pack art for 88 to
                97% of its perimeter, because the pink sits on pink-heavy
                artwork nearly all the way round. The banner floors at 3.82:1
                on every one of the nineteen pack skins, because it is opaque
                and carries a near-white ring outside a near-black keyline,
                which are 14.6x apart in luminance so one of them always reads.

                Both were aria-hidden and decorative, so nothing changes for a
                screen reader: the enclosing <a class="vid-shell"> carries the
                real accessible name. */ ""}
          ${RIP_BANNER}
        </a>
        <h3 class="vid-title"><a href="/${pathFor(r)}">Pack ${packNo(r)}</a></h3>
        <p class="vid-meta">${shortDate(r.published)}</p>
      </article>`).join("\n      ")}
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
          <span class="pack pack--tile pack--${tileSet(r)} pack--img" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art">${packTileImg(tileSet(r))}</span>
              <span class="pack-brand">${esc(r.sets[0] ? labelFor("sets", r.sets[0]) : "GARBAGE RIPS")}<small>${r.sets[0] ? "GARBAGE RIPS 585" : "585"}</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>
          ${/* THE BANNER, NOT THE DISC, ON THESE RAILS TOO. 24 August 2026, and
                this is the owner's call being taken: "make sure on any page that has
                videos to play that all the thumbnails have the click to rip the
                pack bar at the bottom and have the pack opening animation,
                thats my favorite feature of the site".

                CLAUDE.md has recorded this gap for a while and parked the
                decision: every pack artwork on the site says CLICK TO RIP THE
                PACK except the rip-page rails, which kept a play disc from
                before the banner existed. Measured on the built tree before
                this change: 322 rip pages carried 322 banners, one each for
                the hero, and 3,020 discs across the rail tiles.

                THE DISC WAS ALSO THE WEAKER CONTROL. Measured off rendered
                pixels, its outer edge is 1.00:1 against the pack art for 88 to
                97% of its perimeter, because the pink sits on pink-heavy
                artwork nearly all the way round. The banner floors at 3.82:1
                on every one of the nineteen pack skins, because it is opaque
                and carries a near-white ring outside a near-black keyline,
                which are 14.6x apart in luminance so one of them always reads.

                Both were aria-hidden and decorative, so nothing changes for a
                screen reader: the enclosing <a class="vid-shell"> carries the
                real accessible name. */ ""}
          ${RIP_BANNER}
        </a>${showKind ? `
        ${/*
          WHAT WAS OPENED, NOT WHAT CAME OUT. The obvious mark to put here is
          the hit, and it was measured and rejected: see the note above
          related. A rip's OUTCOME on a tile is the poster-frame problem in
          smaller type, which is the thing the pack wrappers and ogCard above
          both exist to prevent; what was opened is the fact a reader wants
          BEFORE they press play and it gives nothing away.

          NOT DUPLICATED IN THE aria-label. The shell's label is the video's
          own title and this line is a visible sibling of it, read in document
          order exactly as the date under it is. Folding it into the label
          would say it twice to the one reader who cannot see it said once.
        */ ""}<p class="vid-kind">${esc(labelFor("products", (r.products || [])[0]))}</p>` : ""}
        <h3 class="vid-title"><a href="/${pathFor(r)}">${esc(r.title)}</a></h3>
        <p class="vid-meta">${shortDate(r.published)}</p>
      </article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}
${/* </main> CLOSES HERE, NOT ABOVE THE THREE BANDS.
     It used to close right after the player, which left "What you are chasing",
     "More from <box>" and "More <set>" as direct children of <body>: three
     content sections with their own h2, outside every landmark, on all 311 rip
     pages. That is not a tidiness point. The skip link targets #main, so a
     reader who takes it lands in a region that ends before more than half the
     page, and anyone navigating by landmark finds those sections in no region
     at all. axe reports it as "All page content should be contained by
     landmarks"; the lived version is that the skip link undersells the page.
     main{padding:var(--s4) 0 var(--s8)} now puts its 64px bottom padding below
     the last band instead of above the first, which is where it belonged. */ ""}
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
  if(!r||!window.GRPack) return;
  GRPack.attach(r);
  // THE HERO NEVER JOINED THE SINGLE-PLAYER REGISTRY, so a rip page could run
  // TWO embeds and two audio tracks at once. GRPack.attach() wires the pack;
  // GRPack.open() is what registers with the registry, and only the rail tiles
  // called it. So the hero mounted with the registry still empty and nothing was torn
  // down, and the hero was invisible to the registry when a tile opened later.
  // Reproduced with real clicks in fresh browsers in BOTH orders.
  //
  // It is not new: the hero has always been outside the registry. Putting the
  // banner on 3,020 rail tiles on 24 August 2026 made it far easier to reach,
  // which is how it was found.
  //
  // REGISTERING IS THE WHOLE FIX AND IT CLOSES BOTH DIRECTIONS. open() tears
  // down whatever is live before arming the next, so clicking the hero now
  // stops a playing tile, and clicking a tile afterwards runs this teardown.
  // The teardown drops the iframe rather than restoring the pack: the pack has
  // already been animated away and its opened flag is latched, and a hero that
  // silently re-sealed itself would be a stranger thing than an empty stage.
  // Dropping the embed is what stops the audio and frees the ~540KB, which is
  // the actual harm.
  var pk=r.querySelector('.pack');
  if(pk) pk.addEventListener('click',function(){
    var host=r.querySelector('.rip-player')||r;
    GRPack.open(host,function(){
      var f=host.querySelector('iframe');
      if(f) f.remove();
    });
  });
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
  //
  // AND THIS EARLY RETURN USED TO TAKE THE LIGHTBOX WITH IT, THE SAME FAULT
  // THE ART-LESS CARDS HAD, AT 158 SLOTS INSTEAD OF 6. Found 21 August 2026
  // while driving the art-less fix: with prefers-reduced-motion set, or in any
  // browser without IntersectionObserver, this bailed out before the wiring
  // eighty lines below ever ran, so EVERY hit card on all 121 pages shipped a
  // full-card control aria-labelled "See NAME larger" that did nothing at all.
  // Reproduced at HEAD as well as here, so it is not new; it is just invisible
  // unless you test with the media feature emulated, which nothing did.
  //
  // The reveal animation is the only thing a reduced-motion reader should lose.
  // Looking at the card is not an animation. So the bail-out is now a bail-out
  // from ARMING, and the lightbox is wired first, unconditionally.
  var reduced = !('IntersectionObserver' in window) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  wireLightbox();
  if(reduced) return;   // never armed, so the cards are simply visible
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

  // Tap a card for a bigger scan and the full price detail. Declared as a
  // function rather than run inline, so the reduced-motion bail-out above can
  // call it BEFORE it returns; see the note beside that return for what leaving
  // it down here cost. Hoisting is what makes the call site legal.
  function wireLightbox(){
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
    // THE PREVIOUS CARD'S PICTURE USED TO STAY IN THE DOM. Nothing ever cleared
    // src, so opening a card with a scan and then one without left a 600px
    // high.webp under the wrong card's name; it was invisible only because the
    // box collapsed to 0px, which is a CSS change away from being wrong on
    // screen. Only a card WITH a scan can open this dialog now, so this branch
    // should be unreachable -- it clears anyway, because "unreachable" is what
    // the old one was too.
    if(img){ lbImg.src=img; lbImg.alt=li.getAttribute('data-name')+', '+li.getAttribute('data-set'); lbImg.hidden=false; }
    else { lbImg.removeAttribute('src'); lbImg.alt=''; lbImg.hidden=true; }
    txt('hitlbName', li.getAttribute('data-name'));
    var n=li.getAttribute('data-n');
    // A NUMBER WITH NO SET NAMES NO CATALOG, same rule as the tile's own set
    // line. Joined on the parts that exist rather than concatenated, so an
    // empty data-set cannot leave a leading " \u2022 #025".
    txt('hitlbSet', [li.getAttribute('data-set'), n ? '#'+n : ''].filter(Boolean).join(' \u2022 '));
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
  }
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
// THE HIT LIGHTBOX COMES OFF THE PAGES THAT CANNOT OPEN IT, and it is done
// HERE, on the finished document, rather than by another `showableHits.length`
// test inside the template. The argument for the post-processing shape, the
// counts and the bytes are all beside dropUnusedHitLightbox in
// shared/chrome.mjs; it is a no-op on a page that carries a #hitcards and it
// throws rather than going quiet if the markup ever moves out from under it.
// The tally is printed because the ratio is the thing that goes stale: it
// moves every time import-sheet.mjs reads a new hit out of the log.
let lightboxKept = 0, lightboxDropped = 0;
for (let i = 0; i < ordered.length; i++) {
  const v = ordered[i];
  const html = page(v, ordered[i + 1], ordered[i - 1]);
  const out = dropUnusedHitLightbox(html);
  if (out === html) lightboxKept++;
  else lightboxDropped++;
  await writeFile(join(ROOT, "public", pathFor(v)), out);
}
console.log(
  `hit lightbox: kept on ${lightboxKept} rip page${lightboxKept === 1 ? "" : "s"}, ` +
  `dropped from ${lightboxDropped} with no hit card to open it`,
);

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
  // The local hub, /rochester.html. HIGH priority because it is the entrance to
  // the five local pages and the one url on this site aimed straight at "pokemon
  // rochester ny", which is the query family CLAUDE.md's nav note calls the one
  // this site can realistically rank first for. WEEKLY rather than monthly and
  // that is not a guess: every number on it is counted out of data/shows.json at
  // build time, and the show list expires a row every few days, so the page
  // genuinely changes on a weekly cadence without anybody editing it.
  //
  // UNCONDITIONAL, unlike the two lines below. It has no empty state to be
  // honest about: with no shows at all it still holds the shops, the plate and
  // the routes, so there is no version of it that is a thin page pretending
  // otherwise.
  { loc: `${SITE}/rochester.html`, freq: "weekly", pri: "0.9" },
  // YEARLY AND LOW, because that is the truth about it: it changes when what
  // the site does changes, which is rarely, and it is not a page anybody should
  // be sent to from a search result. It is in the sitemap rather than left out
  // because a privacy page a crawler cannot find is the one kind of missing
  // page that reads as evasive.
  { loc: `${SITE}/privacy.html`, freq: "yearly", pri: "0.3" },
  { loc: `${SITE}/shops.html`, freq: "monthly", pri: "0.7" },
  // The Garbage Plate. HIGH priority and monthly, which is the pair the set
  // list and the release calendar get, because it is the same kind of page:
  // the most linkable thing on the site to anybody who is not here for Pokemon
  // at all. Monthly rather than weekly because a restaurant's hours move and
  // its history does not, and almost all of the page is the history.
  { loc: `${SITE}/garbage-plate.html`, freq: "monthly", pri: "0.9" },
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
  // Card show 101. The calendar answers when and where; this answers what a
  // show IS, for somebody who has never been. Monthly rather than weekly and a
  // notch below the calendar, because the calendar changes every week and this
  // does not -- but it is a real destination and an orphan page is a page that
  // never ranks.
  { loc: `${SITE}/card-show-101.html`, freq: "monthly", pri: "0.7" },
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
  // The memory game. Monthly like the arcade one: the board is generated in the
  // browser, so the only thing that changes the PAGE is the game changing or
  // data/top-raw.json being re-crawled.
  { loc: `${SITE}/games/chase-match.html`, freq: "monthly", pri: "0.7" },
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

{
  let logged = 0;
  for (const list of HITS_RESOLVED.values()) logged += list.length;
  console.log(
    `  ${logged - unshowable.length} of ${logged} logged card(s) reached a hit-card band with a scan or a price`
  );
  if (unshowable.length) {
    console.log(`  ${unshowable.length} did not, and render as text in "The hit" panel instead:`);
    for (const s of unshowable) console.log("    " + s);
  }

  // AND THE SAME LIST GOES TO THE WORKBOOK, so the highlighting cannot rot.
  //
  // The owner reviews the sheet by row, and the rows worth reviewing are exactly the
  // ones this build could not resolve. Handing him a list typed out by hand
  // would be right for a day and wrong the moment a cell changes; writing it
  // here means the workbook highlights whatever is ACTUALLY unresolved on the
  // run that built it. scripts/build-sheet.py reads this and tints those rows.
  //
  // Keyed by video id rather than row number, because a row number is a fact
  // about one export and the id is a fact about the video.
  const review = {};
  for (const s of unshowable) {
    const m = /^([\w-]+): (.*)$/.exec(s);
    if (!m) continue;
    (review[m[1]] ||= []).push(m[2].replace(/\s+/g, " ").trim());
  }
  await writeFile(
    join(ROOT, "data/sheet-review.json"),
    JSON.stringify(
      {
        _readme: [
          "Videos whose logged hit card did not resolve to a printing on the last",
          "build, and why. WRITTEN BY scripts/build-pages.mjs, READ BY",
          "scripts/build-sheet.py, which tints those rows so the owner can find them.",
          "",
          "Do not hand-edit: it is regenerated every build. If a row is here and",
          "the cell looks right, the fault is more likely a vocabulary the site",
          "does not hold yet than a typo -- check the reason before retyping.",
        ],
        built: localDay(),
        videos: review,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`  wrote data/sheet-review.json (${Object.keys(review).length} videos to review)`);
}
