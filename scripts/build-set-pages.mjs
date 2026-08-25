#!/usr/bin/env node
// Generate a "Card Pokedex" page per card set, plus the /sets/ index.
//
//   node scripts/build-set-pages.mjs
//
// Reads public/data/sets.json (written by sync-sets.mjs) and videos.json.
// Everything on these pages is either a fact from the API or something a
// human wrote in data/set-notes.json. Nothing is invented: a set with no
// price data says so rather than showing zeros, and the "fun facts" are
// derived from the checklist, never from pull odds we do not have.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { priceNote, priceFooter, priceRead } from "../shared/card-prices.mjs";
import { loadGradedPrices } from "../shared/graded-price.mjs";
// NO packplayer.js, BUT packs.css STAYS. These pages wear a .pack facade as
// decoration, so the stylesheet is doing real work; the script is not.
// THE "On the channel" LIST IS PLAIN TEXT LINKS, which is the whole reason this
// is safe and is the opposite of what shared/chrome.mjs's note assumed: it says
// every set guide plays a tile in place. Driven in headless Chrome with a real
// dispatched click, no set guide ever did. packplayer only claims an <a> to a
// rip that WRAPS an <img> or a .pack facade, and a bare <li><a>title</a> has
// neither, so those links navigated before this change and navigate after it.
// If a set guide ever grows a picture tile, put APP_JS back in the same edit.
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, FONTS, dropUnusedPacksCSS,
  APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { labelFor, CARD_SETS } from "../shared/taxonomy.mjs";
import { parseHits, rarityLabelOf, rarityMark, RARITY_CSS } from "../shared/rarity.mjs";
import { esc, shortDate, longDate, moneyCompact, moneyExact, rarityLabel, RARITY_ORDER, cardNumKey, imgDims, productSrcsetAttr, avifPicture, plural, count, clipMeta, plainDashesAll, nat} from "../shared/format.mjs";
// WHAT A CARD SLOT SHOWS WHEN THERE IS NO SCAN. One panel for /hall.html, the
// rip pages and both set-guide builders, so four grids cannot answer the same
// question four ways. corpusScan is the other half of that module and this file
// does not call it: it is an intl lookup, and the rows that reach the panel
// here are English cards whose NAME is not on the checklist, which is a
// spreadsheet fix rather than a missing file.
import { noScanBox, NOSCAN_CSS } from "../shared/card-scan.mjs";

/* ------------------------------------------- the .mine tiles get a 600w rung
 *
 * THE SAME CARD WAS SHARP ON ITS RIP PAGE AND SOFT HERE, and the two grids are
 * the same geometry to the pixel. `hitcardImg` in build-pages.mjs gave the rip
 * pages a 245w/600w ladder on 21 August 2026 and scoped the decision to hit
 * cards; these tiles carried a bare `src` and nothing else, so a reader who
 * followed "Watch the rip" from this band saw a crisper copy of the card they
 * had just tapped.
 *
 * THE BOX IS MEASURED AND IT IS NOT COPIED FROM THE STYLESHEET. Driven at 22
 * widths from 320 to 1920, reading offsetWidth (getBoundingClientRect is the
 * TRANSFORMED box and would have been the wrong number if anything ever put a
 * scale() on these): `calc(50vw - 52px)` holds exactly to 520, and 194px flat
 * from 521 up. 108 at 320, 143 at 390, 208 at 520, 194 everywhere above. That
 * is HITCARD_SIZES' curve to the pixel, arrived at independently, which is the
 * reason this is the same fix rather than a similar one.
 *
 * WHAT IT WAS SERVING. 245w against a box that asks 429 device pixels at 390
 * DPR 3 is 0.57x, 286 at 390 DPR 2 is 0.86x and 388 at 1440 DPR 2 is 0.63x.
 * Read off `currentSrc` at all three densities, never naturalWidth, which is
 * density-corrected with `w` descriptors and hands back the `sizes` value.
 *
 * AND IT IS VISIBLE, settled on rendered pixels rather than on the ratio.
 * Screenshotted element-exact at the real 143px box at DPR 3, 245w against
 * 600w over three cards: mean absolute Laplacian 8.98 -> 23.26, 11.43 -> 29.24
 * and 14.47 -> 42.80, so 2.6 to 3.0x, at PSNR 24.29, 23.44 and 22.00 dB
 * between the two. That is a BIGGER picture difference than the 24.9 to 28.5 dB
 * /msrp.html's entry calls "a real picture change". On Espeon ex the card's own
 * rules text is mush at 245w and legible at 600w.
 *
 * WHAT IT COSTS, and quote the pair or quote neither. TCGdex publishes 245 and
 * 600 and nothing between, so `high` is the only rung there is. Measured by
 * fetching both renditions of all 131 distinct files on the 16 English guides:
 *
 *      low.avif    16.3KB mean      2,135.8KB over the 16 pages
 *      high.avif   56.3KB mean      7,381.4KB over the 16 pages
 *
 * so +40.0KB a card, +296.8KB on the MEDIAN guide, +784.1KB on Ascended
 * Heroes' twenty-one, and +5,245.6KB over the family. Nothing at DPR 1 at any
 * width, and nothing at 320 DPR 2 (216 device px still clears 245); 390 DPR 2,
 * 390 DPR 3, 1440 DPR 2 and 320 DPR 3 all move.
 *
 * THAT IS 8x THE HIT-CARD FIX PER PAGE AND THE PER-CARD PRICE IS IDENTICAL
 * (16.7 -> 58.0KB there against 16.3 -> 56.3 here). A guide holds a median of
 * eight of these where a rip page holds one, so the only thing that changed is
 * the count. Do not re-derive this as a new finding.
 *
 * IT IS ALL OFF THE LOAD PATH AND THAT WAS MEASURED. `.mine-grid` sits at
 * y=4,766 of a 19,168px page on Ascended Heroes at 390 and y=4,657 of 15,907 on
 * Pitch Black, far outside Chrome's 1,250px lazy window, and every tile is
 * `loading="lazy"`. On-load weight does not move; fully scrolled at 390 DPR 2
 * is 1,215.0 -> 1,999.1KB and 952.2 -> 1,249.0KB on those two.
 *
 * NEITHER OF THE TWO THINGS THAT PAID FOR THE HIT-CARD FIX IS HERE, and saying
 * so is the point. There is no lightbox on a .mine tile, so nobody was fetching
 * `high` for this card anyway; and only 6 of the 131 are also drawn large
 * elsewhere on their own page, checked url by url against every `/high.` on
 * each built guide, so the cache-hit argument is worth almost nothing. This is
 * paid for by the picture alone.
 *
 * THE LOCAL MIRROR WAS NOT RE-OPENED. build-pages.mjs costed it at 126 files
 * and refused; this is 131 of the same files and the arithmetic has not moved.
 *
 * ONLY TCGDEX HAS THE SECOND RUNG, same guard and same reason as `hitcardImg`:
 * `high.webp` is a sibling of `low.webp` on that host and nowhere else, and
 * emitting one url under two descriptors would let the browser pick the wrong
 * one on purpose. All 137 slots in the built tree are TCGdex low.webp today,
 * which is exactly why it is guarded rather than assumed.
 *
 * THE FOUR /sets/ja-*.html GUIDES ARE NOT FIXED BY THIS. Their six tiles come
 * from build-intl-pages.mjs, which carries its own copy of this grid the way it
 * carries its own copy of the lede. Same fix, same shape, that file's call.
 */
const MINE_SIZES = "(max-width:520px) calc(50vw - 52px), 194px";
function mineImg(url) {
  const two = /^https:\/\/assets\.tcgdex\.net\/.+\/low\.webp$/.test(url);
  const ladder = two
    ? ` srcset="${esc(url)} 245w, ${esc(url.replace(/low\.webp$/, "high.webp"))} 600w" sizes="${MINE_SIZES}"`
    : "";
  return avifPicture(
    `<img class="mine-img" src="${esc(url)}"${ladder} alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(url)}>`,
  );
}
import { ripLabel, ownLineProduct } from "../shared/riplabel.mjs";
import { daysSince } from "../shared/today.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Intrinsic size of each set logo, measured from the files themselves. These
// are lazy and sit below the fold, so without a reserved box the section
// reflows as each one lands.
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* written by scripts/build-logos.py, which measures as it resizes.
     There is no measure-logos.py: it was named in five comments and had
     never been in the tree, which is how five logos came to have no
     dimensions and therefore no srcset at all. */
}
const logoAttrs = (setId) => {
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  return d ? ` width="${d[0]}" height="${d[1]}"` : "";
};

// Which sets actually have a logo file, the same guard build-pages.mjs already
// applies for the same reason. This file emitted its two logos unconditionally
// behind `onerror="this.remove()"`, which held only while every set in
// sets.json happened to have art sitting next to it. Adding the five Sword &
// Shield sets broke that assumption immediately and produced five broken links
// across /sets/index.html and three guide pages.
//
// `onerror` hides the gap in a browser and that is the trap: nothing looks
// wrong while every page load still pays for a request that 404s, which is the
// case CLAUDE.md already records about the missing card scans. Not emitting the
// img is the fix, and both places degrade cleanly without it because the set
// name is already written beside the logo as an <h1> or a .ttl span.
//
// Drop artwork named <set-id>.png into assets-source/logos/, run
// build-logos.py, which writes both the renditions and data/logo-dims.json,
// and the logo appears with no edit here.
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
const hasLogo = (setId) => Boolean(setId) && logosOnDisk.has(setId);

/**
 * THE 110px LOGO BOX. `.set-card img` is `height:42px; max-width:110px` and
 * measures 110px wide at every viewport from 360 to 1920, but the file it
 * loaded is the 300px-tall master: 480 to 1489px across and 19 to 69KB each.
 * /sets/ shows 23 of them, so it transferred 937KB of logo at 1440x900 to fill
 * boxes 110 CSS px wide. That was the worst intrinsic-to-box ratio measured
 * anywhere on the site, between 7x and 13.5x.
 *
 * **110 IS THE CAP, NOT THE WIDTH, AND WRITING IT AS A FLAT `sizes` COST A
 * RETINA PHONE MOST OF THE WIN ABOVE.** The rule is `height:42px` with
 * `width:auto`, so a card's real width is 42 x its own aspect and only the
 * WIDE logos ever reach the 110px cap. Measured over CDP at 390x844 DPR 2,
 * reading each img's own border box: pitch-black, chaos-rising, stellar-crown
 * and six others do sit at exactly 110, but 151 paints 55.3, black-bolt 67.19,
 * pokemon-go 67.05, white-flare 69, paldean-fates 76.86 and ascended-heroes
 * 82.88. Declaring 110 for those over-states the box by up to 1.99x.
 *
 * That is not a rounding detail, it changes WHICH FILE IS FETCHED. `sizes`
 * times DPR is what the browser compares the `w` descriptors against, so a
 * declared 110 asks a DPR 2 phone for 220px, every `-sm` here is 132 to 197px
 * wide, and six logos therefore skipped the small file and pulled the master:
 * 151 took 18KB instead of 5KB, paldean-fates 39KB instead of 9KB. Roughly
 * 130KB on /sets/ alone, and this rail is on all 29 set pages.
 *
 * So the declaration is now computed per logo, and it is the SAME arithmetic
 * the layout does rather than a second guess at it: 42 x aspect, capped at the
 * 110 the CSS caps at. Verified against the measured boxes above, exactly, to
 * two decimal places on all 22 that had loaded. This is the same fix, and the
 * same reasoning, as `logoAttrs` in build-proto.mjs: one flat number cannot
 * describe 28 different aspect ratios, which is what CLAUDE.md means by two
 * individually correct declarations making one regression.
 *
 * build-logos.py now writes a -sm.webp beside each master at 100px tall
 * (5-17KB), which covers the 42px box at 2.4x, and this offers both so a denser
 * screen can still take the big one. The width descriptors are the real widths
 * from data/logo-dims.json rather than a guess, because the logos are
 * normalised by HEIGHT and every one is a different width.
 *
 * Only the .set-card grids use this. `.logo-big` on a set page renders at 296px
 * and `.rip-setlogo` at up to 197px, and both should keep taking the master.
 */
const SM_H = 100;
const MD_H = 150;

/**
 * THE HERO LOGO WAS THE LARGEST RESOURCE ON THIS WHOLE TEMPLATE AND IT HAD NO
 * `srcset` AT ALL.
 *
 * `.logo-big` hardcoded the 300px-tall master. Measured over CDP at 390x844
 * DPR 2 with the network throttled to a mid-range phone on 4G, on 19 August
 * 2026: /sets/pitch-black.html painted it into a 241.3 x 66.3 CSS box, so a
 * DPR 2 screen wanted 483 x 133 device px and was handed 1092 x 300. 51.2KB,
 * 2.26x oversized in each direction, ABOVE THE FOLD, and the single biggest
 * request on a 332KB page. Every other logo on the site had been given a
 * srcset months ago; this one was missed because it is the only logo on the
 * site that is neither a card tile nor a rail thumbnail.
 *
 * Two things fix it and they are independent:
 *   - a `-md` rendition at 150px tall (build-logos.py), because -sm at 100 and
 *     the master at 300 straddle the 133 this box actually wants;
 *   - AVIF in front of the WebP, which is 23-39% smaller on these files.
 *
 * `sizes` IS COMPUTED PER LOGO AND IT IS THE SAME ARITHMETIC THE LAYOUT DOES,
 * which is the lesson `setCardLogo` above already paid for once: one flat
 * number cannot describe 28 aspect ratios, and over-declaring the box is what
 * makes a browser skip the small file. ui.css says
 * `.set-hero img.logo-big{height:clamp(56px,17vw,110px);width:auto}`, so the
 * WIDTH is the height times this logo's own aspect. 17vw crosses 56px at
 * 329px of viewport and 110px at 647px, so the clamp is three plain media
 * conditions rather than a `clamp()` in a sizes attribute, which not every
 * browser parses there.
 *
 * Verified against the real box: pitch-black is 3.64:1, so 17 x 3.64 = 61.9vw,
 * and 390 x 0.619 = 241.4 against the 241.3 measured off the element.
 *
 * THE `<picture>` IS ONLY EMITTED WHEN EVERY CANDIDATE HAS AN AVIF ON DISK.
 * build-logos.py deliberately does not write an AVIF that came out larger than
 * its WebP (it loses on eleven of the small renditions), and a <picture> takes
 * the first source it can decode rather than the smallest file, so a source
 * listing a rendition that has no AVIF would either 404 or hand a desktop the
 * phone's file. Reading the directory is the check; there is no manifest to go
 * stale.
 */
const logoFiles = new Set(await readdir(join(ROOT, "public/assets/logos")).catch(() => []));
function heroLogo(setId) {
  if (!hasLogo(setId)) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  if (!d) return `<img class="logo-big" src="${base}.webp" alt="" onerror="this.remove()">`;
  const [mw, mh] = d;
  const aspect = mw / mh;
  // The renditions build-logos.py actually wrote for this logo. A master that
  // was already shorter than a step has no file for it.
  const cands = [
    [SM_H, "-sm"], [MD_H, "-md"], [mh, ""],
  ]
    .filter(([h, sfx]) => sfx === "" || logoFiles.has(`${setId}-pokemon-tcg-set-logo${sfx}.webp`))
    .map(([h, sfx]) => ({ w: Math.max(1, Math.round((mw * h) / mh)), sfx }))
    .filter((c, i, a) => a.findIndex((x) => x.w === c.w) === i);
  const px = (n) => Math.round(n * 10) / 10;
  const sizes =
    `(max-width:329px) ${px(56 * aspect)}px, ` +
    `(max-width:647px) ${px(17 * aspect)}vw, ${px(110 * aspect)}px`;
  const srcset = cands.map((c) => `${base}${c.sfx}.webp ${c.w}w`).join(", ");
  const img =
    `<img class="logo-big"${logoAttrs(setId)} src="${base}.webp"` +
    ` srcset="${srcset}" sizes="${sizes}" alt="" onerror="this.remove()">`;
  const allAvif = cands.every((c) => logoFiles.has(`${setId}-pokemon-tcg-set-logo${c.sfx}.avif`));
  if (!allAvif) return img;
  const avifSet = cands.map((c) => `${base}${c.sfx}.avif ${c.w}w`).join(", ");
  return `<picture><source type="image/avif" srcset="${avifSet}" sizes="${sizes}">${img}</picture>`;
}
// `.set-card img{height:42px;width:auto;max-width:110px}` in assets-source/ui.css.
// Both numbers are read from there; if that rule moves, these move with it.
const CARD_H = 42, CARD_MAX_W = 110;
// One column at 390, four cards inside an 844px viewport.
const EAGER_SET_CARDS = 4;
/*
 * `eager` IS THE FIRST FOUR CARDS OF THE /sets/ GRID AND NOTHING ELSE.
 *
 * Measured over CDP at 390x844 DPR 2, reading each img's own border box at
 * scroll 0: the index is one column on a phone and cards one to four sit at
 * y=445, 572, 699 and 826, all inside the 844px viewport. `loading="lazy"` is a
 * VERTICAL heuristic, so those four were fetched immediately anyway; the
 * attribute only cost them the preload scanner, which is the one chance the
 * fetch had to start during the HTML parse instead of after layout. Nothing
 * moves onto the load path, because those four were always on it.
 *
 * Everything past the fourth keeps the attribute, and the "Other sets" grid at
 * the foot of a set guide is entirely lazy: it is six cards several screens
 * down and not one of them is ever in the first viewport.
 */
const setCardLogo = (setId, alt, { eager = false } = {}) => {
  if (!hasLogo(setId)) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  // 42 x aspect, capped at the CSS cap. See the note above: this is the box the
  // layout actually paints, not the 110px cap that only the widest logos reach.
  const boxW = d ? Math.min(CARD_MAX_W, Math.round(CARD_H * (d[0] / d[1]))) : CARD_MAX_W;
  // THE -md CANDIDATE IS FOR DPR 3 AND IT DOES NOTHING AT DPR 2. THAT WAS
  // MEASURED BOTH WAYS RATHER THAN ARGUED, because the first version of this
  // comment claimed a DPR 2 win and there is none: the note above already fixed
  // that half by declaring the real 42 x aspect box, so every -sm here is
  // wide enough for a DPR 2 phone and the ladder never reaches the master.
  // /sets/index.html measured 272.3KB against 272.4KB with and without it,
  // which is the extra srcset text in the gzipped HTML and nothing else.
  //
  // At DPR 3 the same box wants up to 330px and the ladder jumped 100px
  // straight to 300px, so 19 of the 28 logos took the master. Measured over CDP
  // at 390x844 DPR 3, cache off, gzipped, filenames read off the request log:
  // /sets/index.html went 601.5 -> 350.6KB on load and 1,045.5 -> 647.2KB fully
  // scrolled. QUOTE THE PAIR OR QUOTE NEITHER, and quote the DENSITY too: this
  // is the rare change that is worth 41% to one phone and 0.0% to another.
  //
  // Only emitted when build-logos.py wrote one; a logo whose master is already
  // under 150px tall has no -md file and keeps the two-candidate ladder.
  const hasMd = logoFiles.has(`${setId}-pokemon-tcg-set-logo-md.webp`);
  const cand = d
    ? [
        `${base}-sm.webp ${Math.round((d[0] * SM_H) / d[1])}w`,
        ...(hasMd ? [`${base}-md.webp ${Math.round((d[0] * MD_H) / d[1])}w`] : []),
        `${base}.webp ${d[0]}w`,
      ]
    : [];
  const srcset = d ? ` srcset="${cand.join(", ")}" sizes="${boxW}px"` : "";
  return `<img${logoAttrs(setId)} src="${base}${d ? "-sm" : ""}.webp"${srcset} alt="${alt}"${eager ? "" : ` loading="lazy"`} onerror="this.remove()">`;
};

/**
 * THE SET SYMBOL, which is the one picture that answers "is this card from this
 * set?" and which these guides did not carry anywhere.
 *
 * A guide names the set, dates it, counts it and prices it, and never showed the
 * mark a reader has to match against the card in their hand. That is a picture
 * doing a job prose cannot: the symbols are shapes, and describing one ("a
 * stylised M with a swoosh") is worse than showing it at any length.
 *
 * Mirrored locally by scripts/sync-symbols.mjs, which fits every one inside a
 * 48px box as lossless WebP and records its REAL shape in data/symbol-dims.json.
 * The files are not all square (base1 comes out 48x25), so the dimensions come
 * from the manifest rather than being assumed, exactly as build-expansions.mjs
 * and build-what-set.mjs already do.
 *
 * NO REMOTE FALLBACK HERE, unlike those two pages. They were showing a symbol
 * already and degrading to the API url preserved that; this element is new, so a
 * set with no mirrored file simply does not get one rather than reaching for a
 * 500x500 png to paint a 40px box. All 28 English sets are in the manifest
 * today, so nothing is currently skipped.
 */
let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(await readFile(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* run: node scripts/sync-symbols.mjs */
}
/** Drawn at 40 CSS px, so the 48px master covers it at 1.2x and DPR2 at 0.83x. */
const SYMBOL_BOX = 40;
const symbolFor = (s) => {
  const d = SYMBOL_DIMS[s.apiId];
  if (!d) return "";
  // Scale the manifest's real size into the 40px box the CSS paints, so the
  // attributes reserve the right SHAPE. Declaring 40x40 for base1 would reserve
  // a square for a file that is nearly 2:1.
  const k = Math.min(SYMBOL_BOX / d[0], SYMBOL_BOX / d[1], 1);
  return `<img class="setsym-i" src="/assets/symbols/${esc(s.apiId)}-pokemon-tcg-set-symbol.webp"
        width="${Math.round(d[0] * k)}" height="${Math.round(d[1] * k)}"
        alt="The ${esc(s.name)} set symbol" decoding="async">`;
};

const OUT = join(ROOT, "public/sets");

/**
 * Product photos the CDN will not serve.
 *
 * Two TCGplayer products answer 403 at both sizes, while the other 275 images
 * from the same host are fine, so it is those products rather than a bot
 * block. They carried onerror="this.remove()" like everything else, so the
 * photo vanished and left an empty 88x88 box beside the name and price, and
 * the page paid for a refused request to get there.
 *
 * Recorded in data/no-scan.json beside the 101 missing card scans, since it is
 * the same fact about a different host.
 */
let deadUrls = new Set();
try {
  deadUrls = new Set(
    JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || [],
  );
} catch {
  /* optional: without it those two render an empty box, as before */
}
const deadImg = (u) => !!u && deadUrls.has(u);



const { sets, rarityOrder, syncedAt } = JSON.parse(
  await readFile(join(ROOT, "public/data/sets.json"), "utf8")
);
// PSA 10 prices are hand-checked and live in one file, because no free price
// feed carries graded sales. A card with no entry shows its raw price alone.
// Which sets have wrapper art. Five have neither art nor a color skin, and
// naming them rendered the base Garbage Rips green: a green booster pack as
// the hero of a page titled "Black Bolt". Fall back to the generic wrapper.
const packsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/packs")))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/-garbage-rips-585-booster-pack\.webp$/, ""))
);
const packClass = (id) => (packsOnDisk.has(id) ? id : "default");

/**
 * THE PACKSHOT WAS TAKING THE 810x1440 MASTER TO PAINT A 172x262 BOX.
 *
 * `.packshot .pack-art` measured 172x262 CSS px at 390 AND at 1440, because the
 * box is fixed. That is 344x524 at DPR2, and packs.css was handing it
 * `<set>-garbage-rips-585-booster-pack.webp`, 810x1440 and 122 to 154KB, on
 * every one of the 42 guides. A 4.7x linear oversample and the single heaviest
 * image on most of these pages, for the one picture on them that is decoration.
 *
 * build-packs.py already writes a `-tile.webp` beside each master at 400x711
 * and 43 to 50KB, which covers the box at 1.16x on a retina phone. packs.css
 * offers it behind `.pack--tile`, but that class also carries
 * `position:absolute;inset:0` in ui.css, which is right for a video tile and
 * would tear this element out of its row. So the FILE is taken without the
 * layout, as an inline background-image on the element itself.
 *
 * INLINE RATHER THAN A STYLESHEET RULE for two reasons. It beats
 * `.pack--<set> .pack-art` without a specificity contest, and the url is
 * absolute: packs.css writes `url('packs/...')` relative to /assets/packs.css,
 * and the same string inside a /sets/ page would resolve to /sets/packs/.
 *
 * Skipped, leaving the master in place, if the tile is not on disk.
 */
const packTile = (id) => {
  const cls = packClass(id);
  const f = `${cls}-garbage-rips-585-booster-pack-tile.webp`;
  return packsOnDisk.has(f)
    ? ` style="background-image:url('/assets/packs/${f}')"`
    : "";
};

// Which sets have their own share card, for the Article schema's image.
const ogCards = new Set(
  (await readdir(join(ROOT, "public/assets")))
    .map((f) => /^og-(.+)\.jpg$/.exec(f)?.[1])
    .filter(Boolean)
);

// THREE SOURCES NOW, AND THE CHAIN IS SHARED RATHER THAN WRITTEN HERE.
//
// A person still wins first: `prices` in data/psa10.json is what the owner typed
// through the spreadsheet and a sync must never overwrite a number he checked
// himself. PriceCharting (data/graded.json) is second, which is the site's
// source for every other figure since 18 August 2026. pokemonpricetracker's
// `auto` is the automated fallback and keeps its ten-sale floor, because
// Volcarona came back at 15x its raw price off six recorded sales, which is an
// anecdote and not a market.
//
// THE MIDDLE TIER IS NEW HERE AND IT IS WHY THIS BLOCK MOVED. build-hall.mjs
// gained it on 18 August 2026 and these guides did not, so the chase grid on
// /sets/chaos-rising.html printed $838 for Mega Greninja ex #122 while
// /hall.html printed $906 for the same printing off the same instruction.
//
// THE OBJECTION THIS FILE ALREADY RECORDS IS ANSWERED RATHER THAN IGNORED. The
// note under gradedSource below says data/graded.json "covers 83 cards and not
// the 99 these guides print. Moving the guides onto it would strand most of
// them." That is true of MOVING and false of LAYERING: `auto` is still behind
// it, so no row that had a figure loses one, and rows it does reach gain a
// PriceCharting number with PriceCharting's own date and name carried beside
// it. The date and the source move WITH the figure, through the same resolver,
// so a guide can no longer credit one feed for another feed's number.
//
// The join is on the card's NAME and its SET's name rather than on a set-id
// key, because data/graded.json carries neither. Every call site below passes
// both. See shared/graded-price.mjs.
const gradedFor = await loadGradedPrices();
const gradedPrice = (setId, number, name, setName) =>
  gradedFor.price(setId, number, { name, setName });
const gradedAsOf = (setId, number, name, setName) =>
  gradedFor.stamp(setId, number, { name, setName }).asOf;

/**
 * WHO SAID SO ABOUT THE GRADED FIGURES. 14 GUIDES PRINTED 99 OF THEM AND NAMED
 * NOBODY.
 *
 * The only sourcing sentence anywhere near them is the one under the chase
 * grid, and that sentence credits pricecharting.com for the UNGRADED price. So
 * a reader met "PSA 10 $2,200" sitting directly above a line naming a feed that
 * publishes a different number for that card, and the honest reading of the
 * page was that PriceCharting had said $2,200. It had not. Every other page on
 * this site that publishes a graded price names its feed: /wanted.html prints
 * "PSA 10 PRICES COME FROM ..." off each card's own psa10Source, and
 * /index.html and /hall.html do the same off data/graded.json.
 *
 * THE NAME AND THE DATE ARE READ OFF WHOEVER SUPPLIED THE FIGURE rather than
 * being typed here, for the reason shared/card-prices.mjs exists at all: a feed
 * swap must not be a second chance to leave a page crediting a source it no
 * longer reads. Both come back from the same resolver call that produced the
 * number, so they cannot describe a different reading from the one on the page.
 *
 * THE GRADED COLUMN NOW MIXES TWO FEEDS AND THE NOTE SAYS SO WHEN IT DOES.
 * This paragraph used to end "Moving the guides onto it would strand most of
 * them", about data/graded.json covering 83 cards against the 99 these guides
 * print. That is true of MOVING and false of LAYERING, which is what changed on
 * 21 August 2026: PriceCharting sits in FRONT of pokemonpricetracker rather
 * than instead of it, so no row that had a figure lost one. Where a guide ends
 * up printing both feeds gradedWho below returns "a separate graded sales
 * feed", which is the existing behaviour for a mixed page and is why it exists.
 */
const gradedSource = (setId, number, name, setName) =>
  gradedFor.stamp(setId, number, { name, setName }).source;
/** Every chase row on this page that actually renders a graded figure. */
const gradedRows = (s) => (s.chase || []).filter((c) => gradedPrice(s.id, c.number, c.name, s.name));
/** Every distinct feed credited for a graded figure on this page. */
const gradedFeeds = (s, rows = gradedRows(s)) => [
  ...new Set(rows.map((c) => gradedSource(s.id, c.number, c.name, s.name)).filter(Boolean)),
];
/**
 * WHO TO CREDIT, AND SINCE 21 AUGUST 2026 IT CAN BE TWO OF THEM.
 *
 * This returned the generic "a separate graded sales feed" for anything that
 * was not exactly one name, which was right while a mixed page was a
 * theoretical case. It is not one any more: PriceCharting went in front of
 * pokemonpricetracker on that date and 14 of these guides now print rows from
 * both. Naming NEITHER of two known feeds is strictly worse than naming both,
 * and on the footer line it produced "PSA 10 prices from a separate graded
 * sales feed", which tells a reader nothing they can check.
 *
 * The generic survives for the case it was actually written for: a figure whose
 * source the data does not record at all. That is a page that genuinely cannot
 * name its feed, which is a different thing from one that has two.
 */
const gradedWho = (s, rows = gradedRows(s)) => {
  const names = gradedFeeds(s, rows);
  if (!names.length) return "a separate graded sales feed";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/**
 * Hand written set notes, merged straight from data/set-notes.json.
 *
 * sync-sets.mjs also folds these into sets.json, but that script pulls the full
 * checklist for every set from an API that rate-limits hard, so requiring a run
 * of it to publish a one-line fun fact meant the note either waited for the
 * next sync or never appeared. Read here as well, so the loop is import then
 * build, and whatever the file says wins over whatever sets.json was carrying.
 */
let setNotes = {};
try {
  setNotes = JSON.parse(await readFile(join(ROOT, "data/set-notes.json"), "utf8"));
} catch {
  /* optional */
}
for (const st of sets) {
  const n = setNotes[st.id];
  if (!n) continue;
  st.notes = { ...(st.notes || {}), ...n };
}

/**
 * The foreign set an English release came from, for the "Also known as" panel.
 *
 * Worth a panel rather than a footnote because the relationship is not one to
 * one and almost nobody knows it: Mega Evolution is TWO Japanese sets merged,
 * and every English set trails its Japanese parent by weeks, which is why the
 * cards turn up in Japanese first and why people ask about them.
 */
let intlSets = {};
try {
  intlSets = JSON.parse(await readFile(join(ROOT, "public/data/intl-sets.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-intl.mjs */
}

// The non-English sets that have a guide of their own, keyed by the English set
// they map to. The panel above names the foreign set a guide is built from;
// where we have also opened packs of it, that name should be a link rather than
// a dead end. Written by sync-intl-guides.mjs.
let intlGuides = {};
const guideForForeign = new Map(); // tcgdex id + language -> our page id
try {
  intlGuides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
  for (const [id, g] of Object.entries(intlGuides)) guideForForeign.set(`${g.lang}:${g.tcgdexId}`, { id, ...g });
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

// The full card list per set, written by sync-cards.mjs. Until this existed the
// English guides showed rarity totals and eight chase cards and nothing else,
// while the imported guides listed every card, which was exactly backwards: the
// sets the owner actually rips had less detail than the ones he does not.
let checklists = {};
try {
  const dir = join(ROOT, "public/data/cards");
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    checklists[doc.set] = doc;
  }
} catch {
  /* run: node scripts/sync-cards.mjs */
}

/**
 * THE SET THAT COMES OUT OF THIS SET'S PACKS AND IS NOT ON THIS SET'S PAGE.
 *
 * Three guides were answering a different question from the one a reader asks.
 * Shining Fates is 73 cards here and the page named Skyla at $11.35 as the
 * chase card, in the hero lede, in the meta description, at the top of the
 * chase grid and again in Quick facts. All four are true of the 73 cards this
 * site holds. None of them describes the product: the Shiny Vault is 122 more
 * cards out of the same packs, and it is the reason anyone opens Shining Fates
 * at all. Crown Zenith and Celebrations have the same shape.
 *
 * data/set-notes.json used to carry the correction as a hand written fun fact,
 * which put it in the LAST band of the page, under every claim it qualifies.
 * A reader who has read "the chase card is Skyla" three times by then has
 * already decided. So it is emitted from data now, beside each claim, and the
 * fun facts that said it were removed rather than left to say it twice.
 *
 * NO PRICES. See the WHY NO PRICES block in data/companion-sets.json: this
 * repo holds not one figure for these 217 cards, so the pages name what is
 * missing and why, and print no number for it.
 */
let companions = {};
try {
  companions = JSON.parse(await readFile(join(ROOT, "data/companion-sets.json"), "utf8")).sets || {};
} catch {
  /* optional, but see the check below: an unreadable file is not a silent one */
}
{
  // THE COUNT IS RE-CHECKED AGAINST expansions.json ON EVERY BUILD, the same
  // contract checkSetMap keeps in shared/decks.mjs and for the same reason.
  // These pages print "122 cards" inside the sentence that says the 122 are
  // not counted, so a stale count makes the correction itself a wrong number,
  // and nothing about the page would look broken.
  let expansions = [];
  try {
    expansions = JSON.parse(
      await readFile(join(ROOT, "public/data/expansions.json"), "utf8")
    ).sets || [];
  } catch {
    /* run: node scripts/sync-expansions.mjs */
  }
  const byApi = new Map(expansions.map((x) => [x.apiId, x]));
  const bad = [];
  for (const [setId, c] of Object.entries(companions)) {
    if (!sets.some((s) => s.id === setId)) {
      bad.push(`${setId} is not a set in public/data/sets.json`);
      continue;
    }
    const e = byApi.get(c.apiId);
    if (!e) {
      bad.push(`${setId}: ${c.apiId} is not in public/data/expansions.json`);
      continue;
    }
    if (e.total !== c.cards) {
      bad.push(`${setId}: companion-sets.json says ${c.cards} cards, expansions.json says ${e.total}`);
    }
    // "none of them is counted here" has to stay TRUE. It is only true while
    // the parent's own checklist is the parent's own total.
    const doc = checklists[setId];
    const own = sets.find((s) => s.id === setId);
    if (doc?.cards?.length && own?.total && doc.cards.length !== own.total) {
      bad.push(
        `${setId}: the checklist holds ${doc.cards.length} cards where sets.json says ${own.total}, ` +
          `so the page cannot claim the companion is absent from it`
      );
    }
    if (c.priced) {
      bad.push(
        `${setId}: priced is true, but nothing in this build reads a companion price. ` +
          `See the WHY NO PRICES block in data/companion-sets.json before wiring one up.`
      );
    }
  }
  if (bad.length) {
    throw new Error(
      "data/companion-sets.json disagrees with the data it is checked against, and every " +
        "line it writes is a correction, so a wrong one is worse than none:\n  " +
        bad.join("\n  ")
    );
  }
}
const companionOf = (setId) => companions[setId] || null;

/**
 * THE SAME CORRECTION, IN FIVE PLACES, WRITTEN ONCE.
 *
 * The wrong belief is not formed in one spot, so it cannot be undone in one
 * spot: the lede promises the chase cards, the meta description names one in
 * search results before the page is even opened, the chase grid shows eight,
 * the value band sums a checklist, and Quick facts names the chase card again.
 * Each of the five gets the shortest true clause that fits it, and all five
 * come out of these helpers so they cannot drift apart into five slightly
 * different claims about the same 122 cards.
 *
 * WHAT EACH CLAUSE MAY SAY IS BOUNDED BY WHAT THIS REPO HOLDS. The count, the
 * release date and "filed as a separate set" are public/data/expansions.json.
 * The numbering and the rarity shape are public/data/printings. There is no
 * price for any of it anywhere in the tree, so no clause names a figure, and
 * the ones that qualify a figure say which cards that figure covers instead.
 */
const compClause = (c) => `${c.cards} more cards this page does not cover`;
const compChaseNote = (s, c) =>
  `The ${c.cards} cards of ${c.fullName} are not on it, and this site holds no price for any of them, ` +
  `so there is no honest way for this page to tell you whether one of those beats it.`;
const compBand = (s, c) => `<p class="lede comp"><b>There is a second ${esc(s.name)} set and it is not on this page.</b>
      ${esc(c.name[0].toUpperCase() + c.name.slice(1))} is ${c.cards} cards numbered ${esc(c.numbering)},
      released the same day: ${esc(c.what)}. The card databases this site reads file it as a set of its
      own, so none of it is in the chase cards, on the checklist, or in any total anywhere on this page,
      and we hold no price for a single one of those ${c.cards} cards. Everything below is the
      ${s.total} card checklist, which is not the whole of what carries the ${esc(s.name)} symbol.</p>`;

/**
 * EVERY RARITY THIS BUILD CAN PRINT HAS A RUNG, OR THERE IS NO BUILD.
 *
 * The ladder sort below used to give an unknown name index 99. That is not a
 * fallback, it is a silent demotion: it sorted the name BELOW Common and took
 * its chase highlight away, and it did that to 9 of the 28 guides at once.
 * Black Bolt filed its two Black White Rares, the $604 and $602 cards that are
 * the entire reason anybody opens the set, underneath 39 commons. Paldean Fates
 * did the same to its 120 Shiny Rares, which is half the set. Crown Zenith
 * dropped five tiers down there and read Common 42, then Rare Holo V 17.
 *
 * Nobody noticed for as long as the page rendered, because a wrong ORDER still
 * renders. So the check is here rather than in review, it covers both feeds a
 * guide reads, and it fails the build.
 *
 * IT REPORTS RATHER THAN GUESSES. A name it does not know is not sorted into a
 * plausible slot: the answer to "what is a Futuristic Rare worth chasing next
 * to" is a decision about the card, not something a build script can infer, and
 * a guessed rung is a claim this site made up. Give it a rung in RARITY_ORDER,
 * or an entry in RARITY_ALIAS pointing at a rung that already exists, and say
 * which in the commit.
 */
{
  const seen = new Map();
  const note = (raw, where) => {
    const name = rarityLabel(raw);
    if (!name) return;
    if (!seen.has(name)) seen.set(name, new Set());
    seen.get(name).add(where);
  };
  for (const s of sets) {
    for (const r of Object.keys(s.rarities || {})) note(r, `sets.json ${s.id} ladder`);
    for (const c of s.chase || []) note(c.rarity, `sets.json ${s.id} chase`);
  }
  for (const [id, doc] of Object.entries(checklists)) {
    for (const c of doc.cards || []) note(c.rarity, `cards/${id}.json`);
  }
  const orphans = [...seen].filter(([name]) => !RARITY_ORDER.includes(name));
  if (orphans.length) {
    throw new Error(
      `${orphans.length} rarity name${orphans.length === 1 ? "" : "s"} with no rung in RARITY_ORDER, so ` +
        `${orphans.length === 1 ? "it would sort" : "they would sort"} below Common on every guide that prints ` +
        `${orphans.length === 1 ? "it" : "them"}:\n` +
        orphans
          .map(([name, where]) => `  "${name}"  from ${[...where].sort().slice(0, 4).join(", ")}`)
          .join("\n") +
        `\nAdd a rung in RARITY_ORDER or an alias in RARITY_ALIAS, both in shared/format.mjs, then re-run ` +
        `node scripts/sync-sets.mjs so public/data/sets.json carries the same ladder.`
    );
  }
  // sets.json ships its own copy of the ladder for anything reading the data
  // file directly. This builder uses the imported one, so the two cannot drift
  // into disagreeing about where a tier sits, but a stale copy on disk would
  // still mislead the next reader.
  if ((rarityOrder || []).join("|") !== RARITY_ORDER.join("|")) {
    throw new Error(
      `public/data/sets.json carries a different rarityOrder than shared/format.mjs. ` +
        `Re-run node scripts/sync-sets.mjs.`
    );
  }
}

/**
 * ONE CARD, ONE NAME. The chase list and the checklist come from two APIs and
 * they do not always spell a card the same way.
 *
 * pokemontcg.io, which fills `chase`, calls Rebel Clash #189 and #200 "Boss's
 * Orders". TCGdex, which fills the checklist, calls both of them "Boss's Orders
 * (Giovanni)". So /complete-a-set.html said "Boss's Orders (Giovanni)" while
 * /sets/rebel-clash.html said "Boss's Orders" about the identical card, and
 * rebel-clash.html disagreed with ITSELF: the chase grid said one thing, and
 * the checklist band, the top-card sentence and the three "in a rip" credits
 * further down the same page all said the other.
 *
 * The checklist wins, because it is what /cards.html, /pokemon/ and every
 * checklist band on the site already print, so it is the name with four pages
 * behind it rather than one. It is also the more useful of the two: Rebel Clash
 * carries three Boss's Orders printings and the subtitle is how a reader tells
 * a search result apart.
 *
 * Matched on NUMBER, never on name, for the obvious reason that the names are
 * the thing in dispute. Only `name` is taken. The prices, the rarity and the
 * images on a chase entry stay exactly where they were: this is a spelling
 * reconciliation and nothing else. Measured at the time of writing it renames
 * two cards site-wide, and both of them are this one.
 *
 * THE MATCH IS PADDING-BLIND, and it was not. `chase` numbers come from
 * api.pokemontcg.io, which never pads; the checklist comes from TCGdex, which
 * pads to three digits in 24 of the 28 English sets. Comparing them as strings
 * meant this reconciliation was a no-op for every card numbered 1 to 99 in
 * those 24 sets, so it only ever ran on the four unpadded ones. It happens to
 * rename the same two Rebel Clash cards either way today, because Rebel Clash
 * is one of the unpadded four, but the join was dead everywhere else and would
 * have stayed dead on the next set that needed it. Same fix, same reasoning,
 * as the rarity join in sync-sets.mjs.
 */
for (const s of sets) {
  const doc = checklists[s.id];
  if (!doc || !s.chase) continue;
  for (const c of s.chase) {
    const m = doc.cards?.find((x) => cardNumKey(x.n) === cardNumKey(c.number));
    if (m?.name && m.name !== c.name) c.name = m.name;
  }
}

/**
 * WHERE A SET'S VALUE ACTUALLY SITS, from the checklist and nothing else.
 *
 * The guides could already tell you the eight priciest cards and the total card
 * count and never the relationship between them, which is the thing a person
 * deciding whether to open a set is actually asking. It is pure arithmetic over
 * prices this page already prints, so it costs no new source and can be checked
 * by hand against the checklist band directly below it.
 *
 * Everything here is a sum, a sort or a count. NONE of it is a pull rate, an
 * expected value or a claim about what is in a pack: it is what buying one copy
 * of every card would cost and how that total is distributed, which is a
 * different question and the only one the data can answer.
 *
 * Returns null rather than a half-filled object when there is not enough priced
 * data to say anything, and THROWS when the arithmetic does not close, because
 * a concentration figure that does not add up is worse than no band at all.
 */
function setValue(s) {
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return null;

  const prices = doc.cards
    .filter((c) => typeof c.price === "number" && c.price > 0)
    .map((c) => c.price)
    .sort((a, b) => b - a);
  // Under twenty priced cards there is no distribution to describe: "half the
  // value is in 2 cards" out of 9 is a sentence about a rounding error.
  if (prices.length < 20) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  // Smallest number of cards from the top whose prices reach half the total.
  let acc = 0;
  let half = 0;
  for (const p of prices) {
    acc += p;
    half += 1;
    if (acc >= sum / 2) break;
  }
  const topN = Math.min(10, prices.length);
  const topSum = prices.slice(0, topN).reduce((a, b) => a + b, 0);
  const median = prices[Math.floor(prices.length / 2)];
  const rest = sum - acc;
  const restCount = prices.length - half;
  const topShare = Math.round((topSum / sum) * 100);

  const bad = [];
  if (!(sum > 0) || !Number.isFinite(sum)) bad.push(`total is ${sum}`);
  if (acc < sum / 2 - 0.005) bad.push(`top ${half} cards sum to ${acc}, under half of ${sum}`);
  if (acc > sum + 0.005) bad.push(`top ${half} cards sum to ${acc}, over the total ${sum}`);
  if (half < 1 || half > prices.length) bad.push(`half-of-value count is ${half} of ${prices.length}`);
  if (restCount < 0 || half + restCount !== prices.length) bad.push(`${half} + ${restCount} is not ${prices.length}`);
  if (rest < -0.005) bad.push(`remainder is ${rest}`);
  if (topSum > sum + 0.005) bad.push(`top ${topN} sum ${topSum} exceeds total ${sum}`);
  if (topShare < 0 || topShare > 100) bad.push(`top ${topN} share is ${topShare}%`);
  if (median > prices[0] || median < prices[prices.length - 1]) bad.push(`middle price ${median} is outside the range`);
  if (bad.length) {
    throw new Error(
      `setValue(${s.id}): the checklist arithmetic does not close, so the band would print a wrong figure.\n  ` +
        bad.join("\n  ") +
        `\nCheck public/data/cards/${s.id}.json, then re-run scripts/sync-cards.mjs.`
    );
  }

  return {
    // THE VALUE BAND'S DATE IS THE PRICE DATE. It sums 207 dollar figures and
    // stamps one date under them, so it has to be the day those figures were
    // read (PriceCharting's crawl) and not the day the checklist was read.
    checked: doc.pricesChecked || doc.checked,
    priceStamps: {
      priceSource: doc.priceSource,
      pricesChecked: doc.pricesChecked,
      checked: doc.checked,
      pricedBy: doc.pricedBy,
    },
    counted: prices.length,
    total: doc.cards.length,
    sum,
    half,
    rest,
    restCount,
    restEach: restCount > 0 ? rest / restCount : null,
    topN,
    topShare,
    median,
  };
}

/**
 * "Where the money is": the concentration band.
 *
 * Sits above the Quick Facts because it reframes everything under it. The
 * rarity ladder and the checklist both read differently once you know that four
 * cards hold half the set.
 */
/**
 * THE CONCENTRATION, DRAWN. Two bars, one over the other, on one scale.
 *
 * The band's whole claim is that a handful of cards carry a set, and it made
 * that claim in a sentence, four fact tiles and a pull quote: five ways of
 * saying one thing, none of which you can see. Two bars say it at a glance,
 * because the point is a COMPARISON of two shares, and the eye does that for
 * free where the sentence asks a reader to hold 8, 207, $1,084 and $932 in
 * their head at once.
 *
 * DRAWN, NOT FETCHED, so it costs a few hundred bytes of markup and nothing at
 * all over the wire, which is the whole argument for putting it on 28 pages.
 *
 * IT ADDS NO CLAIM. Both numbers are already printed in the paragraph directly
 * above it and both come out of setValue(), which throws rather than renders
 * when its arithmetic does not close. It is emphatically not a pull rate: a
 * share of a checklist's VALUE says nothing whatever about what is in a pack,
 * and the note under the band already says so out loud.
 *
 * REAL ASPECT RATIO, not preserveAspectRatio="none", so the rounded ends stay
 * round at every width. No text inside the SVG either: type in a scaled SVG
 * scales with the box and stops matching the rest of the page.
 */
function valueChart(v) {
  const W = 300;
  const priced = v.half + v.restCount;
  const cardShare = v.half / priced;
  const bar = (share) => {
    // A 2px floor, because on a 245 card set the top 8 are 3% and a rect
    // rounded to 9px wide with rx=8 draws as a lozenge rather than a bar.
    const w = Math.max(6, Math.round(share * W));
    return `<svg class="svc-bar" viewBox="0 0 ${W} 16" width="${W}" height="16" aria-hidden="true" focusable="false">
          <rect x="0" y="0" width="${W}" height="16" rx="8" class="svc-track"/>
          <rect x="0" y="0" width="${w}" height="16" rx="8" class="svc-fill"/>
        </svg>`;
  };
  const pct = (x) => (x < 1 ? "under 1%" : `${Math.round(x)}%`);
  // data-figure MARKS A FIGURE DRAWN IN MARKUP RATHER THAN FETCHED, and it is
  // read by check-build.py's image-coverage report, which counted <img> and
  // <svg> only and so scored a page's charts at zero. It selects nothing: no
  // rule in ui.css or in this file's <style> touches it, and no script reads it.
  // Put it on the OUTER element of a chart, once per chart.
  return `<div class="svc" data-figure="chart">
      ${/* ONE IS A REAL VALUE HERE AND THESE LABELS DID NOT SURVIVE IT.
            `v.half` is how many cards hold half the set's value, so on a small
            or flat set it is legitimately 1: Celebrations (25 cards) and
            Phantasmal Flames both sit there. The chart then read "The 1 priciest
            card", "What those 1 ARE worth" and, in the tile below, "1 / Cards
            holding half the value". The PROSE in the lede above was already
            correct, because it carries a hand-written `v.half === 1` branch, so
            the page contradicted itself between the paragraph and the picture.
            Bare numerals also read badly at 1 in a label: "The priciest card"
            beats "The 1 priciest card" even where the digit is not wrong. */ ""}
      <div class="svc-row">
        <p class="svc-k">${v.half === 1 ? "The priciest card" : `The ${v.half} priciest cards`}</p>
        ${bar(cardShare)}
        <p class="svc-v">${pct(cardShare * 100)} of the ${priced} cards with a price</p>
      </div>
      <div class="svc-row">
        <p class="svc-k">${v.half === 1 ? "What that one is worth" : `What those ${v.half} are worth`}</p>
        ${bar(0.5)}
        <p class="svc-v">half of the ${moneyCompact(v.sum)} the whole checklist comes to</p>
      </div>
    </div>`;
}

function valueBand(s, cls) {
  const v = setValue(s);
  if (!v) return "";
  // "Buy one copy of EVERY CARD" is the strongest claim on the page and it is
  // a sum, so it cannot be hedged in the note underneath and left alone in the
  // sentence. Where a companion set exists, "every card" is not what was
  // summed, and the phrase names the checklist instead. The figure itself does
  // not move: nothing here has ever counted those cards, which is the point.
  const comp = companionOf(s.id);
  const some = v.counted === v.total ? "every card" : `each of the ${v.counted} cards that has a price`;
  // WHICH CARDS, IN THE SENTENCE, NOT ONLY IN THE NOTE UNDER IT. The obvious
  // edit was to swap "every card" for "every card on the 73 card checklist",
  // and it produced "one copy of every card on the 73 card checklist in
  // Shining Fates", which is the qualifier fighting the "in <set>" that was
  // already there. Naming the set once, as the checklist's owner, fixes both.
  const opening = comp
    ? `Buy one copy of each of the ${v.total} cards on this guide's ${esc(s.name)} checklist at its guide value and you would spend`
    : `Buy one copy of ${some} in ${esc(s.name)} at its guide value and you would spend`;
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Where the value sits</p>
    <h2>Where the <span class="hl">money</span> is</h2>
    <p class="lede w42">${opening}
      ${moneyExact(v.sum)}. ${
        v.half === 1
          ? `More than half of that is a single card.`
          : `Half of it sits in ${v.half} cards.`
      } The other ${v.restCount} come to ${moneyExact(v.rest)} between them${
        v.restEach ? `, which is ${moneyExact(v.restEach)} a card` : ""
      }.</p>
    ${valueChart(v)}
    <div class="facts">
      ${/* THE TILE LABEL IS A CLAIM TOO, and it is the one a reader photographs.
            "One of every card" is false on the three guides with a companion
            set, in four words, directly under a dollar figure. */ ""}<div class="fact"><div class="n">${moneyCompact(v.sum)}</div><div class="l">One of every card${comp ? " listed" : ""}</div></div>
      <div class="fact"><div class="n">${v.half}</div><div class="l">${plural(
        v.half,
        "Card"
      )} holding half the value</div></div>
      <div class="fact"><div class="n">${v.topShare}%</div><div class="l">Held by the ${v.topN} priciest</div></div>
      <div class="fact"><div class="n">${moneyExact(v.median)}</div><div class="l">The middle card</div></div>
    </div>
    <p class="lede sv-say">In plain terms: a handful of cards carry the set and everything else is bulk. That is normal,
      it is true of nearly every modern set, and it is worth knowing before you buy a box hoping to "get your money
      back".</p>
    <p class="price-note">Added up from the ${v.counted} prices in the checklist below.${
      comp ? ` It does not include ${esc(comp.fullName)}, which is ${comp.cards} more cards filed as a separate set and unpriced anywhere in this site's data, so the real cost of one of everything with a ${esc(s.name)} symbol on it is higher than this and we cannot say by how much.` : ""
    }
      ${esc(priceNote(v.priceStamps || {}))} This is what buying one of each card would cost. It is not what a booster
      box is worth, and it is not the chance of pulling anything: nobody outside The Pokemon Company has pull rates, so
      you will not find any on this site.</p>
  </div>
</section>`;
}

/**
 * Median and top price per rarity, keyed by the Title Case rarity label.
 *
 * ONLY returned for a rarity where the checklist and the set's own rarity
 * counts agree AND every card at that rarity carries a price, because the line
 * says "half are worth more, half less" and that is only true of a complete
 * set of prices. Four sets disagree with their own checklists on at least one
 * tier (sets.json calls seven Ascended Heroes cards "Mega Attack Rare" where
 * the checklist calls them Ultra Rare, and Pokemon GO uses an entirely
 * different vocabulary), so those tiers get no price line rather than a figure
 * describing a different number of cards than the one printed next to it.
 */
function rarityPrices(s) {
  const out = new Map();
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return out;

  const by = new Map();
  for (const c of doc.cards) {
    const k = rarityLabel(c.rarity);
    if (!k) continue;
    if (!by.has(k)) by.set(k, { n: 0, prices: [] });
    const e = by.get(k);
    e.n += 1;
    if (typeof c.price === "number" && c.price > 0) e.prices.push(c.price);
  }

  for (const [r, n] of Object.entries(s.rarities || {})) {
    const key = rarityLabel(r) || r;
    // THE WORD ORDER IS ALREADY RECONCILED, one step earlier than it used to be.
    // This line held a regex swapping a leading "Rare Holo" for "Holo Rare",
    // because sets.json and the checklists come from different APIs and one says
    // "Rare Holo VSTAR" where the other says "Holo Rare VSTAR". rarityLabel now
    // maps whole strings through RARITY_ALIAS, so both sides of this join have
    // already been through it and the special case has nothing left to do. It
    // also only ever covered the Holo family, which is why "Rare Ultra" and
    // "Rare Secret" still missed and showed a count with no money beside it.
    //
    // It deliberately does NOT reconcile the cases where the two sources
    // genuinely carve the set up differently: Ascended Heroes lists 14 Ultra
    // Rares plus 7 Mega Attack Rares where the checklist lists 21 Ultra Rares
    // and no Mega Attack Rare. 14 + 7 = 21, so nothing is missing, but merging
    // them would attach one tier's prices to another tier's name. Those stay
    // suppressed, which is why some ladders show a count and no money.
    const e = by.get(key);
    if (!e || e.n !== n || e.prices.length !== n) continue;
    const asc = e.prices.slice().sort((a, b) => a - b);
    const mid = asc[Math.floor(asc.length / 2)];
    const top = asc[asc.length - 1];
    if (!(mid > 0) || !(top > 0) || mid > top) {
      throw new Error(
        `rarityPrices(${s.id}): ${key} produced mid ${mid} and top ${top} from ${asc.length} prices, ` +
          `which cannot both be right. Check public/data/cards/${s.id}.json.`
      );
    }
    out.set(key, { n, mid, top });
  }
  return out;
}

function checklistBand(s, cls) {
  const doc = checklists[s.id];
  if (!doc?.cards?.length) return "";
  const priced = doc.cards.filter((c) => c.price != null);
  const priciest = priced.slice().sort((a, b) => b.price - a.price)[0];

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>Full <span class="hl">checklist</span></h2>
    <p class="lede">All ${doc.cards.length} cards in ${esc(s.name)}, with what each one is worth.${
      priciest ? ` The most expensive card in the set is ${esc(priciest.name)} at ${moneyExact(priciest.price)}.` : ""
    }</p>
    <details class="ig-list">
      <summary>Show the full ${esc(s.name)} checklist</summary>
      <ol class="ig-cards en">
        ${doc.cards
          .map((c) => {
            /**
             * THE WALL OF ROWS, GIVEN TWO THINGS TO SCAN BY.
             *
             * 207 rows on /sets/151.html is roughly 17,000px of identical
             * three-line entries on a 390px phone, and a reader scrolling it had
             * no way to see where the part of the set they came for begins. Both
             * marks below are drawn, so they cost markup and not one byte over
             * the wire, which is the whole reason they are affordable on 28
             * pages and 4,900 rows.
             *
             * THE STARS ARE THE SAME WHITELIST THE LADDER USES, and they are not
             * a repeat of the word beside them. The word is the tier's NAME; the
             * stars are the mark PRINTED ON THE CARD the reader is holding, and
             * matching a card to a row is the job this page does in a shop.
             * BOOKLET_MARK covers the eight tiers the set booklet actually
             * shows, so Common and Uncommon get nothing rather than an invented
             * glyph, exactly as the ladder above argues.
             *
             * THE GOLD ROWS ARE `CHASE`, the same set of tiers the ladder
             * highlights and the quick facts count, so the three cannot disagree
             * about what counts as worth chasing. It adds no claim: every one of
             * those rows already prints its own rarity and its own price.
             *
             * ON PALDEAN FATES THAT IS 154 ROWS OF 245 AND THAT IS NOT A BUG.
             * Counted across the 28 guides the highlight covers 4 to 154 rows,
             * and the two extremes are both the set telling the truth about
             * itself: Celebrations has 4 chase cards, Paldean Fates is a Shiny
             * set and is 63% chase, which is exactly the sentence its own quick
             * facts already print. A narrower rule just for this list was the
             * obvious alternative and was rejected: three parts of one page
             * quietly disagreeing about the word "chase" is the failure this
             * codebase has already fixed twice.
             *
             * Measured cost of both marks together, gzipped: 0.08KB on
             * Celebrations, 0.35KB on 151, 0.75KB on Ascended Heroes.
             */
            const r = rarityLabel(c.rarity);
            const chase = Boolean(r) && CHASE.has(r);
            return `<li${chase ? ` class="is-chase"` : ""}><span class="ig-no">${esc(c.n || "")}</span>
          <span class="ig-nm">${esc(c.name)}</span>
          ${c.price != null ? `<span class="ig-pr">${moneyExact(c.price)}</span>` : ""}
          ${c.rarity ? `<span class="ig-rr2">${BOOKLET_MARK[r] ? rarityMark(BOOKLET_MARK[r]) : ""}${esc(r)}</span>` : ""}</li>`;
          })
          .join("\n        ")}
      </ol>
    </details>
    <p class="price-note">${
      /**
       * THE TWO CLAUSES ARE GATED SEPARATELY BECAUSE THE TWO MARKS DO NOT ALWAYS
       * BOTH APPEAR. Pokemon GO prints 24 gold rows and only 8 star rows, because
       * its rarity vocabulary is its own and BOOKLET_MARK is a whitelist of the
       * eight tiers the set booklet actually shows. A sentence promising stars on
       * a page that has almost none is the sort of small wrongness a reference
       * page cannot afford.
       */
      [
        doc.cards.some((c) => CHASE.has(rarityLabel(c.rarity)))
          ? `The gold rows are the chase tiers, the same ones the rarity breakdown above highlights.`
          : "",
        doc.cards.some((c) => BOOKLET_MARK[rarityLabel(c.rarity)])
          ? `The stars beside a rarity are the ones printed on that card.`
          : "",
      ].filter(Boolean).join(" ")
    } ${esc(priceNote(doc))}
      Where a card exists as a normal, holo and reverse holo at different prices, the figure shown is the priciest of
      them, because that is the one people mean. ${priced.length} of ${doc.cards.length} cards have a price.
      Looking for one card in particular? <a href="/cards.html?set=${esc(s.id)}">Search every card on the site</a>.</p>
  </div>
</section>`;
}

/** "8 weeks earlier", from two ISO dates. */
function leadTime(earlier, later) {
  if (!earlier || !later) return null;
  const days = Math.round((new Date(later) - new Date(earlier)) / 86400000);
  if (days < 7) return null;
  if (days < 60) return `${Math.round(days / 7)} weeks earlier`;
  return `${Math.round(days / 30.44)} months earlier`;
}

function intlBand(s, cls) {
  const e = intlSets[s.id];
  if (!e?.sources?.length) return "";
  const many = e.sources.length > 1;
  const rows = e.sources
    .map((src) => {
      const lead = leadTime(src.released, s.released);
      // Where we have opened packs of this exact set, it has a guide here and
      // the link should stay on the site. Sending someone to TCGdex when we
      // have our own page for it is the one thing this panel should not do.
      const own = guideForForeign.get(`${src.lang}:${src.id}`);
      return `      <li class="intl">
        <p class="intl-lang">${esc(src.langName)}${src.id ? ` &bull; ${esc(src.id)}` : ""}</p>
        <h3 lang="${src.lang}">${esc(src.name)}</h3>
        ${(() => {
          const en = (own && own.english) || src.romaji || null;
          return en && en.toLowerCase() !== String(src.name).toLowerCase()
            ? `<p class="intl-romaji">${esc(en)}</p>`
            : "";
        })()}
        <p class="intl-meta">${[
          src.total ? `${src.total} cards` : null,
          src.released ? longDate(src.released) : null,
        ].filter(Boolean).map(esc).join(" &bull; ")}</p>
        ${lead ? `<p class="intl-lead">Out ${esc(lead)} than the English set</p>` : ""}
        ${own
          ? `<a class="intl-link" href="/sets/${esc(own.id)}.html">Read the ${esc(own.english)} guide &rarr;</a>`
          : // The fallback used to link to www.tcgdex.net/<lang>/sets/<id>, which
            // 404s: TCGdex publishes api., assets. and tcgdex.dev and has no
            // consumer site. Rather than send people to a dead page, the card
            // says plainly that we have not written this one up.
            `<p class="intl-lead is-none">No guide for this one yet</p>`}
      </li>`;
    })
    .join("\n");

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Same set, other language</p>
    ${(() => {
      // The heading printed the native name only, so "Chaos Rising is also
      // ニンジャスピナー" told an English reader nothing they could hold on to,
      // and the words that would have ("Ninja Spinner") sat below in small
      // italics inside a card. Both names go in the heading now, at the same
      // size, native first because that is what is printed on the pack.
      const named = e.sources.map((x) => {
        const own = guideForForeign.get(`${x.lang}:${x.id}`);
        const en = (own && own.english) || x.romaji || null;
        return { native: x.name, en: en && en.toLowerCase() !== x.name.toLowerCase() ? en : null };
      });
      const native = named.map((n) => esc(n.native)).join(" + ");
      const eng = named.map((n) => n.en).filter(Boolean);
      return `<h2>${esc(s.name)} is also <span class="hl" lang="ja">${native}</span>${
        eng.length ? `<span class="intl-en">${eng.map(esc).join(" + ")}</span>` : ""
      }</h2>`;
    })()}
    <p class="lede intl-lede">${
      many
        ? `Two Japanese sets were merged into one English release, which is why ${esc(s.name)} is bigger than either of them.`
        : `The Japanese release came first. Same cards, different printing and a different set symbol.`
    }${e.note ? ` ${esc(e.note)}` : ""}</p>
    <ul class="intl-grid">
      <li class="intl is-en">
        <p class="intl-lang">English${s.apiId ? ` &bull; ${esc(String(s.apiId).toUpperCase())}` : ""}</p>
        <h3>${esc(s.name)}</h3>
        <p class="intl-meta">${[
          s.total ? `${s.total} cards` : null,
          s.released ? longDate(s.released) : null,
        ].filter(Boolean).map(esc).join(" &bull; ")}</p>
        <p class="intl-lead">The one on this page</p>
      </li>
${rows}
    </ul>
    ${
      e.confidence !== "confirmed"
        ? `<p class="intl-warn">Matched on set numbering and card counts rather than an official statement. If that is wrong, say so on any of the socials.</p>`
        : ""
    }
  </div>
</section>`;
}

/**
 * TOP CHASE CARDS, READ OUT OF THE SAME CHECKLIST AS THE REST OF THE PAGE.
 *
 * ONE SOURCE OF TRUTH PER PAGE. This list used to come from sets.json, which
 * sync-sets.mjs fills from api.pokemontcg.io, while the rarity ladder, the
 * "where the money is" band and the full checklist under it all came from
 * public/data/cards/<id>.json (TCGdex, prices from TCGplayer). Two vendors
 * reading a moving market on two different days, so 22 of 28 set guides priced
 * their own chase card twice and disagreed with themselves a few hundred pixels
 * apart: Umbreon ex read $1,495 in the grid and $1,470.58 in the checklist,
 * Mega Charizard X ex read $712.54 against $715.98. Both reads were honest. A
 * page showing both without reconciling them is not.
 *
 * The checklist wins for the same reason it already won the rarity counts a few
 * hundred lines up: it is the list this page renders card by card, so a reader
 * can check the figure against the page it is printed on. A number they cannot
 * check is worse than no number.
 *
 * IT ALSO FIXES A WRONG CARD, not just a wrong price. api.pokemontcg.io carries
 * no prices at all for the four newest sets, so sets.json held `chase: []` for
 * them and this fell back to data/chase-tcg.json, an eight card list that for
 * Ascended Heroes is missing every Special Illustration Rare. The fallback
 * therefore named Psyduck at $69.94 as that set's chase card while
 * /complete-a-set.html, /cards.html, /pokemon/gengar.html and /rarity.html all
 * named Mega Gengar ex at $1,118.76, which the 295 priced cards in the
 * checklist agree with and which is sixteen times bigger. It looked like a
 * one-set bug only because the same incomplete fallback happened to pick
 * correctly for the other three. A missing chase card is much better than a
 * wrong one, so an incomplete list is no longer allowed to publish one: with no
 * checklist prices the band prints "No prices yet" and says so.
 *
 * TCGplayer product links are the one thing the checklist does not carry, so
 * they come from data/chase-tcg.json, matched on card number. That file is now
 * link-only and covers every set with a checklist, which is why this no longer
 * also reads sets.json's `chase` array for a url.
 *
 * READING BOTH WAS THE PROBLEM. chase-tcg.json only ever held the handful of
 * sets api.pokemontcg.io had no prices for, so the other 24 sets fell through
 * to sets.json's `url`, a prices.pokemontcg.io address that has to be followed
 * through a redirect while the page is being built. A build that depends on a
 * third party answering a redirect breaks when they do not, and that host has
 * been 502ing. One source, no redirect, and a card with no link simply gets no
 * buy button, which the lightbox already handles.
 *
 * NUMBERS ARE UNPADDED here and padded in the checklist ("20" against "020").
 * That is deliberate: unpadded is what data/psa10.json is keyed on and what
 * every other page uses, so padding these would silently drop the PSA 10 line
 * off eight cards.
 */
// The 101 TCGdex image bases that 404 and the 4 TCGplayer urls that 403, so no
// builder emits a dead round trip. Read up here rather than beside the hit
// grid because the chase list below is the first thing that needs it.
const NO_SCAN = new Set(
  (JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8").catch(() => "{}")).bases || [])
  // THE KEY IS `bases`, AND THIS ASKED FOR `tcgdex`, WHICH DOES NOT EXIST.
  // A missing JSON key is undefined, `|| []` turns that into an empty list, and
  // an empty NO_SCAN excludes nothing, so every one of the 101 scans this file
  // exists to suppress was emitted anyway. The failure mode of a lookup table
  // that silently comes back empty is that everything looks fine: the images
  // just 404 one at a time in the background. The sibling read twelve lines up
  // uses `deadUrls` and was always correct, which is why only half of this
  // feature worked.
);

let chaseLinks = {};
try {
  chaseLinks = JSON.parse(await readFile(join(ROOT, "data/chase-tcg.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-chase.mjs */
}
for (const st of sets) {
  // Keyed the way cardNumKey writes them, which is how the sync wrote them.
  const urls = new Map(Object.entries(chaseLinks[st.id]?.links || {}));

  const doc = checklists[st.id];
  const priced = (doc?.cards || []).filter((c) => typeof c.price === "number" && c.price > 0);

  if (!priced.length) {
    // Nothing this page can show its working for, so it shows nothing.
    st.chase = [];
    st.chasePricesAsOf = null;
    st.pricesAsOf = null;
    continue;
  }

  st.chase = priced
    .slice()
    .sort((a, b) => b.price - a.price)
    .slice(0, 8)
    .map((c) => {
      const n = cardNumKey(c.n);
      const base = c.img && !NO_SCAN.has(c.img) ? c.img : null;
      return {
        name: c.name,
        number: n,
        rarity: c.rarity,
        price: c.price,
        image: base ? `${base}/low.webp` : null,
        imageLarge: base ? `${base}/high.webp` : null,
        url: urls.get(n) || null,
      };
    });
  // PRICECHARTING, AND THE DATE IS THE PRICE DATE. `doc.checked` is the day
  // TCGdex was read for the CHECKLIST and it moves nightly; `doc.pricesChecked`
  // is the day PriceCharting was read for the money. Stamping the first one
  // against a column of dollars claimed a freshness the figures do not have.
  st.chasePriceSource = "PriceCharting";
  st.priceStamps = {
    priceSource: doc.priceSource,
    pricesChecked: doc.pricesChecked,
    checked: doc.checked,
    pricedBy: doc.pricedBy,
  };
  // Both stamps, because the price note reads pricesAsOf first and that date
  // described a read this list no longer uses.
  st.chasePricesAsOf = doc.pricesChecked || doc.checked;
  st.pricesAsOf = doc.pricesChecked || doc.checked;
}

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

// CARDS WE ACTUALLY PULLED FROM THIS SET, which is a different question from
// the chase list above it. The chase list is what the set is worth hunting;
// this is what came out of the packs on camera, so it is the only part of a set
// guide that no other site can write.
//
// Prices are looked up from the set's own card data, never stored here, so a
// nightly refresh moves this section like everything else. A promo carries its
// own price because it is not in any set checklist.
const HITS = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};

// SET NAME -> SET ID, for reading hits out of the free text Hit Card field.
// Registered twice: as written, and with the region suffix stripped, because
// the label is "Cyber Judge (JP)" and nobody types the bracket when logging a
// pull. Without the alias every Japanese and Korean hit went unmatched.
const SET_BY_NAME = new Map();
for (const cs of CARD_SETS) {
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  SET_BY_NAME.set(norm(cs.label), cs.id);
  SET_BY_NAME.set(norm(String(cs.label).replace(/\s*\((?:JP|KR|CN|TW)\)\s*$/i, "")), cs.id);
}

// Hits typed as prose, grouped by set. The My Hits tab gives a card a number
// and a price; this gives the ones that only ever got a sentence. Both are
// real pulls and a set page should show both.
// RESOLVE A TYPED CARD NAME TO A REAL CARD, so a hit logged as a sentence can
// still show its scan. card-index.json holds every card in every set with its
// number, rarity, price and an image base, which is the same source the grid
// above already uses.
//
// Matching is by name WITHIN THE SET the hit already names, which is a much
// smaller haystack than the whole catalogue and is why this is safe enough to
// do at all. Where a name appears more than once in a set, usually the same
// Pokemon at several rarities, the rarity the owner typed breaks the tie. If it
// cannot, the card stays unresolved and is listed as text rather than shown as
// the wrong scan.
const CARD_INDEX = JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8"));
const cardsBySetName = new Map();
{
  const [fName, fSet, fNum, fRar, fPrice] = [0, 1, 2, 3, 4];
  const norm = (x) =>
    String(x || "").toLowerCase().replace(/\b(trainer|supporter|item|stadium)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  for (const c of CARD_INDEX.cards || []) {
    const k = `${c[fSet]}::${norm(c[fName])}`;
    if (!cardsBySetName.has(k)) cardsBySetName.set(k, []);
    cardsBySetName.get(k).push({
      name: c[fName], set: c[fSet], number: c[fNum], rarity: c[fRar], price: c[fPrice],
    });
  }
}

function resolveCard(setId, cardName, rarityId) {
  const norm = (x) =>
    String(x || "").toLowerCase().replace(/\b(trainer|supporter|item|stadium)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim();
  const hits = cardsBySetName.get(`${setId}::${norm(cardName)}`) || [];
  if (!hits.length) return null;

  // AN AMBIGUOUS NAME WITH NO RARITY IS NOT RESOLVED, and the comment above
  // this function already promised that. It used to take hits[0], which is the
  // base print, so a name that exists at several rarities in one set silently
  // rendered the cheap one with its scan and its price as though it were the
  // card that was pulled. 985 names in card-index.json are ambiguous inside
  // their own set: the worst is a Prismatic Evolutions Umbreon ex at $7.45
  // against one at $1,470.58, and two of the logged hits already carry a null
  // rarity. Showing the wrong card confidently is worse than showing text.
  if (hits.length === 1) return withImg(hits[0], setId);
  if (!rarityId) return null;

  const want = rarityLabelOf(rarityId).toLowerCase();
  const byRarity = hits.filter((h) => String(h.rarity || "").toLowerCase() === want);
  // Still ambiguous after the rarity narrows it, so still not resolved.
  if (byRarity.length !== 1) return null;
  const pick = byRarity[0];
  return withImg(pick, setId);
}

function withImg(pick, setId) {
  const base = (CARD_INDEX.imgBase || {})[setId];
  const imgBase = base && pick.number ? `${base}/${pick.number}` : null;
  return {
    ...pick,
    img: imgBase && !NO_SCAN.has(imgBase) ? `${imgBase}/low.webp` : null,
  };
}

{
  const homeless = [];
  for (const [vid, list] of Object.entries(HITS)) {
    for (const h of list) if (h.promo && !h.forSet) homeless.push(`${vid}: ${h.card}`);
  }
  if (homeless.length) {
    console.log(`  ${homeless.length} promo(s) have no forSet, so they are on no set page:`);
    for (const x of homeless) console.log(`    ${x}`);
  }
}

const PROSE_HITS = new Map();
{
  const unmatchedAll = [];
  for (const v of videos) {
    if (!v.hitCard) continue;
    const { hits, unmatched } = parseHits(v.hitCard, SET_BY_NAME);
    for (const u of unmatched) unmatchedAll.push(`${v.id}: ${u}`);
    for (const h of hits) {
      if (!PROSE_HITS.has(h.set)) PROSE_HITS.set(h.set, []);
      PROSE_HITS.get(h.set).push({ ...h, path: v.path, label: v.siteTitle || v.title });
    }
  }
  if (unmatchedAll.length) {
    console.log(`  ${unmatchedAll.length} hit fragment(s) named no set we know, so they are not on any set page:`);
    for (const u of unmatchedAll) console.log(`    ${u}`);
  }
}
const hitsBySet = new Map();
for (const [vid, list] of Object.entries(HITS)) {
  for (const h of list) {
    if (!h.set) continue;
    if (!hitsBySet.has(h.set)) hitsBySet.set(h.set, []);
    hitsBySet.get(h.set).push({ ...h, vid });
  }
}
const videoById = new Map(videos.map((v) => [v.id, v]));
const setNameById = new Map(sets.map((x) => [x.id, x.name]));
// Every rip of this set, newest first. The guide previously linked only to
// /videos.html?set=<id>, which is a static file: every variant serves a
// canonical pointing at the bare url, so 888 internal links across the site
// funnelled into one page and not one of the rips was reachable from a guide.
// 115 rip pages sat more than three clicks from the home page as a result.
const ripsList = new Map();
for (const v of videos) {
  for (const id of v.sets || []) {
    if (!ripsList.has(id)) ripsList.set(id, []);
    ripsList.get(id).push(v);
  }
}
for (const list of ripsList.values()) {
  list.sort((a, b) => String(b.published).localeCompare(String(a.published)));
}

// EVERY RUN OF THIS SET, WHICH IS THE FACT THIS PAGE HAD NOWHERE TO PUT.
//
// A run is a YouTube playlist every one of whose videos carries the same single
// set tag. That rule is NOT invented here: scripts/build-playlists.mjs resolves
// its own setId exactly this way, and a playlist spanning several sets, which
// today means Hits Only and only Hits Only, is a sibling of no set at all.
// Mirroring it is the entire point. A count printed beside a link has to be the
// number the page at the far end of that link prints about itself, and the only
// way to guarantee that is to compute it the same way from the same file.
//
// THREE FIGURES, AND WHERE EACH ONE IS ALLOWED TO COME FROM:
//   n      resolved videos, NEVER playlists.json's own count. YouTube's figure
//          counts private and deleted entries that never reach a tile, so it is
//          the wrong number to put next to a link into this tree. That builder
//          says so in as many words; this is the second reader of the same file
//          and it would have been the second place to get it wrong.
//   sec    the sum of the durations, printed ONLY under the condition the
//          playlist page itself prints it under: more than one video, and every
//          one of them timed. A single video run shows no total there, because
//          it would repeat that video's own chip, so it shows none here.
//   cover  the sealed product photograph /playlists.html already carries, from
//          data/playlist-covers.json. One of the 22 has no cover, so a set
//          without one falls back to the set logo rather than to a hole.
//
// Sorted biggest first: the run with the most in it is the one worth offering.
const PLAYLISTS = JSON.parse(
  await readFile(join(ROOT, "public/data/playlists.json"), "utf8").catch(() => '{"playlists":[]}'),
).playlists || [];
const PL_COVERS = JSON.parse(
  await readFile(join(ROOT, "data/playlist-covers.json"), "utf8").catch(() => "{}"),
).covers || {};
const runsBySet = new Map();
for (const p of PLAYLISTS) {
  const vids = (p.videoIds || []).map((id) => videoById.get(id)).filter(Boolean);
  if (!vids.length) continue;
  // NO PATH MEANS NO PAGE TO LINK TO, SO THERE IS NOTHING TO OFFER.
  //
  // build-playlists.mjs sets path only on the playlists that get a page, and
  // sync-youtube.mjs writes a freshly discovered playlist with none. Without
  // this test that playlist renders href="/undefined": a link to a page that
  // cannot exist, on every set guide it touches. It is not hypothetical -- it
  // shipped through a whole build on 20 August 2026 and check-build.py failed
  // it on public/sets/ascended-heroes.html.
  //
  // Skipping is the right answer rather than falling back to the set's video
  // list, because this section's promise is "these runs play in order" and a
  // filtered grid is not a run. A set whose only playlist is skipped falls to
  // the newest-rip row below, which is the same shape as a set with no runs.
  if (!p.path) continue;
  const seen = new Set();
  for (const v of vids) for (const id of v.sets || []) seen.add(id);
  if (seen.size !== 1) continue;
  const setId = [...seen][0];
  const cover = PL_COVERS[p.id] || null;
  if (!runsBySet.has(setId)) runsBySet.set(setId, []);
  runsBySet.get(setId).push({
    title: p.title,
    path: p.path,
    n: vids.length,
    sec: vids.reduce((a, v) => a + (v.duration || 0), 0),
    timed: vids.length > 1 && vids.every((v) => v.duration),
    img: cover && cover.webp ? cover.webp : null,
    alt: (cover && cover.alt) || "",
  });
}
for (const list of runsBySet.values()) list.sort((a, b) => b.n - a.n || b.sec - a.sec);

// m:ss, copied from build-playlists.mjs so the two pages spell a runtime the
// same way. It is deliberately not rounded to "3 min": the figure is the sum of
// the durations printed on the tiles of the page it points at, in the notation
// those tiles use, so a reader can check it.
const clockMS = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "");

// The run title with the set name taken off the front, because the heading
// three lines above it has already said the set name and the guide is not a
// list of playlists, it is the Pitch Black page. "Pokemon Chaos Rising ETB
// Opening Series" becomes "ETB Opening Series", which is the half of the title
// that tells two runs apart. The optional Pokemon prefix is there because the owner
// names some playlists "Pokemon <set>" and some "<set>", and the trailing
// channel name is there because he adds it to some and not others.
// FALLS BACK TO THE WHOLE TITLE rather than to a stub: if the trim leaves fewer
// than six characters the title did not have the shape this expects and the
// safe answer is to print what YouTube says.
const runTitle = (title, setName) => {
  const t = String(title).replace(/\s*\|\s*Garbage Rips 585\s*$/i, "").trim();
  const rx = new RegExp(`^(?:Pok[eé]mon\\s+)?${setName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  const cut = t.replace(rx, "").trim();
  return cut.length >= 6 ? cut : t;
};

const descriptions = plainDashesAll(JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}")));

function yearsSince(iso) {
  if (!iso) return null;
  // LOCAL DAYS. This was `Date.now() - new Date(iso)`, an absolute instant
  // minus a UTC-midnight parse, so every set guide aged a week at 8pm Eastern:
  // Pitch Black read "4 weeks ago" at 19:44 and "5 weeks ago" at 20:04 on the
  // same evening. See shared/today.mjs.
  const days = daysSince(iso) ?? 0;
  if (days < 0) return "not out yet";
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

// Sealed product prices keep their cents at every size. moneyCompact() rounds above
// $100, which is right for a card worth "about $400" and wrong for a shelf
// price: it turned a $149.76 Elite Trainer Box into "$150", which is a number
// that appears on no listing anywhere.
const priceUSD = (n) =>
  `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Rarities worth chasing. ONE definition, read off RARITY_ORDER, used by both
 * the highlight in the rarity breakdown and the count in the quick facts, so
 * the two halves of the page cannot say different things.
 *
 * THIS USED TO BE A HAND-KEPT LIST AND IT WENT STALE THE MOMENT THE LADDER
 * GREW. It named ten tiers and the sentence above the count read "N of the M
 * cards are Ultra Rare or better". Four tiers were then added to RARITY_ORDER
 * and not to this list, so seven guides highlighted Ultra Rare and left four
 * neighbouring rows unmarked:
 *
 *   paldean-fates   Shiny Rare 120 and Shiny Ultra Rare 12, unhighlighted,
 *                   sitting ABOVE Ultra Rare on the ladder
 *   crown-zenith, pokemon-go, celebrations, chilling-reign, shining-fates,
 *   rebel-clash     Holo Rare VSTAR and Holo Rare VMAX, unhighlighted
 *
 * BE PRECISE ABOUT WHICH ARGUMENT APPLIES TO WHICH PAIR, because they are not
 * the same argument and this comment said they were. The Shiny pair sorts above
 * Ultra Rare in RARITY_ORDER, so leaving it out contradicted the ladder outright.
 * VSTAR and VMAX sort just BELOW Ultra Rare; what puts them in is the price
 * evidence recorded in shared/format.mjs, medians of $4.17 and $3.30 across the
 * six Sword and Shield sets against Ultra Rare's $2.53. That is an average over
 * sets and it does not hold in every set: on Pokemon GO the guide prints VSTAR
 * $4.17 and VMAX $7.95 against Ultra Rare $2.35 and the highlight reads
 * correctly, while on Crown Zenith it prints VSTAR $1.81 and VMAX $3.20 against
 * Ultra Rare $4.28 and two newly highlighted rows are cheaper than the
 * highlighted row above them. The highlight is a claim about the TIER, which is
 * what a ladder is; the money column beside it is per set and is free to
 * disagree. If that pairing ever needs settling, settle it in RARITY_ORDER,
 * where the ladder is, rather than by keeping a second opinion here.
 *
 * The note that stood here recorded the reason those four were left out and it
 * was a good one: adding Shiny Rare takes Paldean Fates from 22 of 245 to 154 of
 * 245, and "154 of the 245 cards are Ultra Rare or better" is a true count of
 * something the sentence does not describe. So the SENTENCE went first, in
 * derivedFacts below, and the list follows it.
 *
 * THE SHAPE IS A CUT PLUS TWO NAMED EXCEPTIONS, not a list of names, because a
 * list of names is the thing that just went stale. The cut is everything down
 * to and including Holo Rare VMAX, so a tier added to the top of the ladder is
 * chase the day it lands and nobody has to remember this file.
 *
 * WHAT THE CUT DELIBERATELY LEAVES OUT, and it is the rung immediately under
 * it: Holo Rare V, at a $0.99 median, and Double Rare, which replaced it in the
 * Scarlet and Violet era. Both are the workhorse tier of their era rather than
 * a chase, and Double Rare has sat outside this set since it existed.
 *
 * THE TWO EXCEPTIONS ARE BELOW THE CUT AND ARE NAMED ANYWAY. ACE SPEC Rare and
 * Radiant Rare sort under Double Rare on price, which is where RARITY_ORDER
 * puts them, but each is a one-off mechanic printed a handful of times per set
 * that has it (33 ACE SPEC across 6 sets, 6 Radiant across 2) and both were
 * already highlighted before this change. Keeping them is the status quo, not a
 * new claim; they are listed out loud rather than smuggled in by moving the cut
 * down past Double Rare, which would drag 317 Double Rares in with them.
 */
const CHASE_FLOOR = "Holo Rare VMAX";
const CHASE_EXTRA = ["ACE SPEC Rare", "Radiant Rare"];
{
  // Same principle as the orphan check above: a name that is not on the ladder
  // is a silent miscount here rather than a visible failure, so fail loudly.
  const missing = [CHASE_FLOOR, ...CHASE_EXTRA].filter((r) => !RARITY_ORDER.includes(r));
  if (missing.length) {
    throw new Error(
      `CHASE names with no rung in RARITY_ORDER: ${missing.join(", ")}. The chase highlight and the ` +
        `"N of the M cards" count are both derived from RARITY_ORDER, so a renamed tier silently drops ` +
        `out of both. Fix the name here or in shared/format.mjs.`
    );
  }
}
const CHASE = new Set([
  ...RARITY_ORDER.slice(0, RARITY_ORDER.indexOf(CHASE_FLOOR) + 1),
  ...CHASE_EXTRA,
]);

/**
 * THE PRINTED STAR ROW FOR A RARITY NAME, and it is a whitelist on purpose.
 *
 * The rarity ladder is the band a reader scans to find out what is worth
 * chasing, and it was a column of words. The stars are what is actually printed
 * on the card, so drawing them beside the name is the picture that lets somebody
 * hold a card up to the screen. They are inline SVG out of shared/rarity.mjs, so
 * they cost a request and a byte of transfer each: nothing.
 *
 * WHY A HAND-WRITTEN MAP RATHER THAN raritiesIn(). Two reasons, both of which
 * produce a wrong mark rather than no mark.
 *
 *   - raritiesIn("Common") returns "jp-c" and raritiesIn("Uncommon") returns
 *     "jp-u", because the English key in shared/rarity.mjs has no rung for
 *     either. Those two would have painted a JAPANESE letter badge onto every
 *     English guide, on the two most numerous rows of every ladder.
 *   - The key is a photograph of ONE booklet, and RARITY_ORDER carries 21 names
 *     spanning 2020 to 2026. Rainbow Rare, Secret Rare, Shiny Rare, Black White
 *     Rare, Radiant, Amazing and the whole Holo Rare V family are not on that
 *     page, and inventing a star count for them is exactly the confident error
 *     a reference page must not make.
 *
 * So eight names get a mark, they are the eight the booklet actually shows, and
 * every other rung renders as it always did. The caption under the ladder says
 * as much rather than leaving a reader to wonder why some rows have stars.
 *
 * Every id here is checked against RARITY_KEY at build time below, because a
 * typo would silently drop the mark rather than fail.
 */
const BOOKLET_MARK = {
  "Mega Hyper Rare": "mega-hyper",
  "Hyper Rare": "gold",
  "Special Illustration Rare": "sir",
  "Illustration Rare": "ir",
  "ACE SPEC Rare": "ace-spec",
  "Ultra Rare": "ultra",
  "Double Rare": "double-rare",
  "Rare": "rare",
};
{
  const bad = [];
  for (const [name, id] of Object.entries(BOOKLET_MARK)) {
    if (!RARITY_ORDER.includes(name)) bad.push(`"${name}" is not a rung in RARITY_ORDER`);
    if (!rarityMark(id)) bad.push(`"${name}" points at mark id "${id}", which RARITY_KEY does not define`);
  }
  if (bad.length) {
    throw new Error(
      `BOOKLET_MARK does not line up with the rarity key, so a ladder would quietly lose its stars:\n  ` +
        bad.join("\n  ") +
        `\nFix the name here, in RARITY_ORDER (shared/format.mjs) or in RARITY_KEY (shared/rarity.mjs).`
    );
  }
}

// Affiliate config. Off by default; flip enabled in data/affiliate.json once
// the Impact application is approved and every TCGplayer link is rewritten.
let aff = { tcgplayer: { enabled: false } };
try {
  aff = JSON.parse(await readFile(join(ROOT, "data/affiliate.json"), "utf8"));
} catch {
  /* optional */
}
const affOn = Boolean(aff.tcgplayer?.enabled && aff.tcgplayer?.linkTemplate);
/**
 * A set guide's <title>, brand appended only when it fits.
 *
 * The fixed part was "Set Guide: Cards, Rarities & Chase Card Values | Garbage
 * Rips 585", which is 65 characters BEFORE the set name. Every one of the 23
 * guides therefore blew past the ~60 characters Google shows, and the two
 * longest reached 90: the brand and half the description were cut off in the
 * result, on the pages doing most of the site's SEO work.
 *
 * The descriptor is shorter now, and the brand is appended only if the whole
 * thing still fits. Dropping the brand on a long set name is the better trade:
 * the set name is what somebody searched for, and a truncated brand helps
 * nobody. Short names keep it.
 */
const MAX_TITLE = 60;
const BRAND = " | Garbage Rips 585";
const setTitle = (name) => {
  // The brand is kept in EVERY case and the descriptor gives way instead.
  // Dropping it saved characters but cost the thing these pages are for: the
  // site is trying to become a recognized entity, and 22 of 23 guides losing
  // the name was the wrong half to sacrifice. "Set Guide" is the phrase people
  // actually search next to a set name, so it is the part that stays; the
  // rarities and values wording lives on in the H1 and the meta description,
  // which is where it was doing the work anyway.
  const rich = `${name} Set Guide: Cards & Values${BRAND}`;
  return rich.length <= MAX_TITLE ? rich : `${name} Set Guide${BRAND}`;
};

const affLink = (url) =>
  affOn ? aff.tcgplayer.linkTemplate.replace("{url}", encodeURIComponent(url)) : url;

const ripsBySet = {};
for (const v of videos) for (const s of v.sets || []) ripsBySet[s] = (ripsBySet[s] || 0) + 1;

// HOW MUCH SEALED PRODUCT THIS SET HAS COST US, which is a different question
// from how many videos there are and the guides could not answer it at all.
//
// Asked for by name: "we should be able to see I have opened 3 Chaos Rising
// ETBs ... on the set stats we should show Opened ETB number, Open Booster
// Bundle Number and Single Booster Pack numbers". The obvious answer, counting
// videos, is wrong by a factor of nine: 21 Chaos Rising ETB rips came out of
// THREE ETBs, one pack per video, and every one of those 21 rows says
// "Packs Opened 9" because that is what an ETB holds. Nothing in the catalogue
// distinguished the box from the pack until the sheet gained a Box # column.
//
// SO A BOX IS COUNTED ONLY WHERE A HUMAN NUMBERED IT. `boxNumber` comes from
// the sheet and nowhere else; there is no rule that could derive it, because
// the fact lives in the prose of a description that often carries two different
// numbers in one sentence ("Pack #2 of our third Chaos Rising ETB"). A set
// nobody has numbered yet gets NO count rather than a guess or a zero.
//
// THE COUNT IS THE HIGHEST NUMBER RECORDED, NOT HOW MANY WERE RECORDED, and
// that is the one judgement call in here. "Chaos Rising ETB #3" is a statement
// that there was a first and a second, made by the person who opened them, and
// a box opened off camera is still a box opened. Publishing "1 ETB" on a page
// whose own video list says ETB #3 would be the site arguing with itself.
// The cost is that one mis-key publishes a wrong total, so the gaps are
// reported at build time below rather than left to be noticed.
//
// LOOSE PACKS HAVE NO BOX, so they are counted per video: an id ending in
// "-pack" is single-pack, japanese-pack, korean-pack or chinese-pack and
// nothing else in shared/taxonomy.mjs. Derived from the id rather than listed,
// because every hand-kept product list in this project has gone stale at least
// once. Where such a row states a pack count and the video opened only one set,
// that count is used, so a video opening three loose packs counts three.
//
// AND A BOX THAT IS NOT THIS SET'S BOX IS NOT COUNTED HERE AT ALL. The heading
// on this block is "What we have opened OF THIS SET", so every row is a claim
// that the sealed product it names was this set's sealed product. That is true
// of an ETB, a bundle, an ex Premium Collection and a loose pack. It is not
// true of a First Partner Illustration Collection, which holds one promo pack
// plus TWO ASSORTED boosters: this site's own First Partner guide says "The two
// boosters are assorted rather than a named set: The owner's Series 1 box held one
// Phantasmal Flames and one Mega Evolution pack."
//
// WHAT THAT SHIPPED AS: the two First Partner rips are tagged with the sets
// whose packs were INSIDE them, phantasmal-flames and mega-evolution, and the
// highest box number on them is 6. So this loop credited SIX Collection Boxes
// to Phantasmal Flames and the same six again to Mega Evolution: twelve boxes
// published off six real ones, on two guides, each telling a reader that the
// channel had been through six boxes of THAT set. Six boxes of the First
// Partner line yielded six First Partner promo packs, six Phantasmal Flames
// PACKS and six Mega Evolution PACKS, and not one box of either set.
//
// THE HONEST NUMBER IS NO NUMBER, and it is worth saying why the alternatives
// were rejected rather than just dropping the row. Counting the box as a box of
// this set is the bug. Counting it as a fraction of a box invents a unit
// nobody sells. Counting it as loose packs is the closest to true but files
// six packs that came out of a box under a row headed by a product that is
// bought loose, and the pack count is not recorded for the four boxes that were
// never filmed anyway. What is left is the rule this whole band already runs
// on, stated in the price note on the page: "Anything we have not written a
// number against is not counted here, so these are a floor rather than a
// total." A cross-line box is one more thing this band does not count, and the
// page already tells the reader it is reading a floor. The rips themselves are
// not hidden: both still appear in this set's rip list and rip count above,
// where the claim being made is only that the set turned up in the video.
//
// SAME QUESTION, SAME ANSWER, ONE PLACE. ownLineProduct() is shared/riplabel
// .mjs's list of products that are nobody's set's, and it is the same call the
// tile label makes to keep a set name off the front of one. A second copy of
// that list here is a second thing to go stale.
const LOOSE_PACK = /-pack$/;
const openedBySet = new Map();
for (const v of videos) {
  const prod = (v.products || [])[0];
  if (!prod) continue;
  if (ownLineProduct(v)) continue;
  for (const sid of v.sets || []) {
    if (!openedBySet.has(sid)) openedBySet.set(sid, new Map());
    const per = openedBySet.get(sid);
    if (!per.has(prod)) per.set(prod, { numbered: [], loose: 0 });
    const rec = per.get(prod);
    if (v.boxNumber) rec.numbered.push({ n: v.boxNumber, published: v.published });
    if (LOOSE_PACK.test(prod)) {
      rec.loose += (v.sets || []).length === 1 && v.packs > 0 ? v.packs : 1;
    }
  }
}

/** The rows a set's "what we have opened" block prints, biggest count first. */
function openedRows(setId) {
  const per = openedBySet.get(setId);
  if (!per) return [];
  const rows = [];
  for (const [prod, rec] of per) {
    const highest = rec.numbered.length ? Math.max(...rec.numbered.map((x) => x.n)) : 0;
    const n = highest || rec.loose;
    if (n > 0) rows.push({ prod, n, counted: highest ? "boxes" : "packs" });
  }
  // BOXES BEFORE LOOSE PACKS, then biggest first. Sorting on the count alone
  // put "13 Single Packs" ahead of "3 Elite Trainer Boxes" on Chaos Rising,
  // which buries the only number on the block that took a human to record
  // behind the one that did not.
  return rows.sort(
    (a, b) =>
      (b.counted === "boxes") - (a.counted === "boxes") || b.n - a.n || a.prod.localeCompare(b.prod)
  );
}

// WHERE THE TYPED NUMBER AND THE LOG DISAGREE, SAY SO AT BUILD TIME.
//
// The typed number wins on the page, for the reason argued above, and the price
// of that is that nothing would ever notice a 33 typed for a 3. So the same
// numbers are ALSO derived the only way they can be, by counting the distinct
// boxes the log has actually seen in publish order, and every disagreement is
// printed. A box numbered 3 that is the first one on record is either a typo or
// two videos that were never numbered, and both are worth knowing about.
//
// It is deliberately NOT printed on the page. A public set guide is not the
// place for a note about the completeness of a spreadsheet, and the person who
// can fix it is the person running this build.
{
  const gaps = [];
  for (const [sid, per] of openedBySet) {
    for (const [prod, rec] of per) {
      if (!rec.numbered.length) continue;
      const order = [];
      for (const x of [...rec.numbered].sort((a, b) => String(a.published).localeCompare(String(b.published)))) {
        if (!order.includes(x.n)) order.push(x.n);
      }
      order.forEach((n, i) => {
        if (n !== i + 1) {
          gaps.push(
            `${sid} / ${prod}: #${n} came ${i + 1} of ${order.length} in the order this log saw them, ` +
              `so the numbering has a gap. Either the earlier ones were never numbered in the sheet, ` +
              `or the number is a typo.`
          );
        }
      });
    }
  }
  if (gaps.length) {
    console.log(`  ${gaps.length} box number(s) do not line up with what the log has seen:`);
    for (const g of gaps.slice(0, 12)) console.log(`    ${g}`);
    if (gaps.length > 12) console.log(`    ...and ${gaps.length - 12} more`);
    console.log(`    The pages print the number you typed, because you are the one who opened them.`);
  }
}

// Sealed products and their TCGplayer market prices, from sync-products.mjs.
// Optional: a set with no entry simply renders no band rather than an empty one.
let productsBySet = {};
try {
  productsBySet = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-products.mjs */
}

/**
 * "What you can buy": the sealed products for this set, cheapest first.
 *
 * Two prices per product, because they answer different questions and people
 * conflate them constantly. Market is what it actually sells for, which is the
 * honest number for "is this worth it". Low is the cheapest listing right now,
 * which is what you would pay today. Showing only one of them would mislead in
 * one direction or the other, and on some products they are wildly apart: the
 * Phantasmal Flames booster box reads $391 market against an $87 low.
 *
 * Images are hotlinked to TCGplayer's CDN. Every card links back to the
 * listing, and the band says out loud where the numbers came from and when,
 * because these move daily and a stale price presented as current is the one
 * way this section could actually cost somebody money.
 */
/**
 * How many packs are in a sealed product, READ OFF THE BLURB ON THE SAME CARD.
 *
 * Deliberately not a lookup table keyed by product kind. The blurb is printed
 * two lines above the price on the page, so a reader can check the division
 * themselves, and a kind-keyed table is exactly what would have got this wrong:
 * eight of the fifteen "Booster Box" entries are a HALF booster box, which is a
 * different number of packs from the "36 packs" the kind carries. Dividing
 * those by 36 would have published a per-pack price roughly half the real one
 * on a third of the guides.
 *
 * So: a count only when the blurb states one, and never when the product name
 * carries a size word whose real pack count is not in our data. No count means
 * no per-pack figure on that card. Blisters, tins and collection boxes say
 * "packs plus a promo" with no number and are left alone for the same reason.
 */
const SIZE_WORD = /\b(half|enhanced|mini|jumbo|premium|double)\b/i;
/**
 * AND THE BLURB IS ONLY SOURCED FOR THE ERA IT WAS WRITTEN ABOUT.
 *
 * The blurbs are per-KIND constants hardcoded in sync-products.mjs describing
 * current product. "9 packs plus sleeves and dice" is carried by every Elite
 * Trainer Box entry, and nine is right for a main expansion from the Scarlet &
 * Violet era onward: four pokemon.com product pages and three official
 * expansion pages say so, recorded in data/pack-counts-current.json and
 * published on /how-many-packs.html. It is not a fact about the product line.
 * Elite Trainer Boxes have held 7, 8, 9 and 10 packs, the Celebrations one held
 * ten Celebrations packs plus five from other sets, and the Pokemon Center
 * versions have always held more.
 *
 * Six sets in the nightly pull predate that window (Rebel Clash, Shining Fates,
 * Chilling Reign, Celebrations, Pokemon GO, Crown Zenith) and their guides were
 * dividing by the current constants. So the generics stop at the Scarlet &
 * Violet base set release, which is also when the Booster Bundle was invented.
 * "Single Pack" is exempt: one pack is one pack in every era.
 *
 * Same gate, same date and the same reasoning as build-pack-prices.mjs, which
 * prints per-pack figures for the same products. If you change one, change the
 * other: a reader will compare the two pages.
 */
const GENERIC_FROM = "2023-03-31";
function packsIn(p, released) {
  if (SIZE_WORD.test(p.name || "")) return null;
  if (p.kind !== "Single Pack" && String(released || "") < GENERIC_FROM) return null;
  const blurb = String(p.blurb || "");
  const m = /^(\d+)\s+packs?\b/i.exec(blurb);
  const n = m ? Number(m[1]) : /^one pack\b/i.test(blurb) ? 1 : null;
  if (n === null) return null;
  if (!Number.isInteger(n) || n < 1 || n > 40) {
    throw new Error(`packsIn: "${p.name}" parsed ${n} packs out of "${blurb}", which cannot be right.`);
  }
  if (p.kind === "Single Pack" && n !== 1) {
    throw new Error(`packsIn: "${p.name}" is a Single Pack but its blurb says ${n} packs.`);
  }
  return n;
}

/**
 * What to CALL a product, and what to say is inside it.
 *
 * `kind` and `blurb` are per-kind generics written by sync-products.mjs, and on
 * eight of the twenty-three guides they are wrong about the same product:
 * TCGplayer sells a "Half Booster Box" and the card was labelling it "Booster
 * Box" with "36 packs" underneath. The guide was already printing a pack count
 * for a product that does not hold that many; adding a price per pack on top of
 * it would have doubled the error rather than introduced it.
 *
 * Where the product NAME ends in "<size word> <kind>" the size word is real and
 * the generic blurb is not, so the name wins and the blurb is DROPPED rather
 * than corrected. How many packs a half box or an enhanced box holds is not in
 * our data, and a plausible guess in a slot people read as a fact is exactly
 * the thing this site does not do.
 */
function productLabel(p, released) {
  // REQUIRED, NOT OPTIONAL, and this guard exists because the missing argument
  // shipped for one build. Three call sites were left passing only the product,
  // so `released` was undefined, "" sorted before every date, and every product
  // on every guide fell through the era gate below and printed "Pack count not
  // in our data". A silently absent argument here reads as a data problem
  // rather than a code one, which is the worst way for it to fail.
  if (!released) throw new Error(`productLabel("${p.name}") was called without the set's release date`);
  // The blurb is a claim about the contents, printed two lines above the price,
  // so it has to obey the same era gate as the division does. Dropping the
  // per-pack figure for a 2021 Elite Trainer Box while still printing "9 packs
  // plus sleeves and dice" under it would leave the wrong number on the page and
  // only remove the arithmetic that made it checkable.
  const stale = p.kind !== "Single Pack" && String(released || "") < GENERIC_FROM && /^\d+\s+packs?\b/i.test(String(p.blurb || ""));
  const blurb = stale ? "Pack count not in our data" : p.blurb;
  const q = SIZE_WORD.exec(p.name || "")?.[1];
  if (!q) return { kind: p.kind, blurb };
  const full = `${q} ${p.kind}`;
  if (!String(p.name).toLowerCase().endsWith(full.toLowerCase())) return { kind: p.kind, blurb };
  return { kind: full.charAt(0).toUpperCase() + full.slice(1), blurb: "Pack count not in our data" };
}

/** Market price per pack, or null where the pack count is not knowable. */
function perPack(p, released) {
  const packs = packsIn(p, released);
  if (!packs || typeof p.market !== "number" || !(p.market > 0)) return null;
  const each = p.market / packs;
  if (!Number.isFinite(each) || each <= 0 || each > p.market + 0.005) {
    throw new Error(`perPack: "${p.name}" gives ${each} per pack from ${p.market} over ${packs} packs.`);
  }
  return { packs, each };
}

function productBand(s, cls) {
  const entry = productsBySet[s.id];
  if (!entry?.products?.length) return "";

  const items = [...entry.products].sort((a, b) => a.market - b.market);
  const cheapest = items[0];

  // THE QUESTION THE OLD BAND DID NOT ANSWER. It listed six prices for six
  // differently sized things, cheapest total first, which tells you what you can
  // afford and not what anything costs. A booster box at $179 next to a pack at
  // $6.55 is not a comparison until both are per pack.
  const perPacks = items
    .map((p) => ({ p, ...(perPack(p, s.released) || {}) }))
    .filter((x) => x.each)
    .sort((a, b) => a.each - b.each);
  const bestPack = perPacks[0] || null;
  const singly = perPacks.find((x) => x.packs === 1) || null;
  const next = perPacks[1] || null;
  // Two different questions, and the lede answers whichever ones apply without
  // saying the same dollar figure twice. "Cheapest way in" is the smallest
  // amount of money that gets you playing. "Cheapest per pack" is what a pack
  // costs, which is the one that decides between a box and a handful of packs.
  const name = (x) => esc(productLabel(x, s.released).kind.toLowerCase());
  let lede = `Every sealed ${esc(s.name)} product still being sold, cheapest first.`;
  const cheaperBox = bestPack && singly && bestPack.p !== singly.p;
  const off = cheaperBox ? Math.round(((singly.each - bestPack.each) / singly.each) * 100) : 0;

  if (singly && cheapest === singly.p) {
    // A single pack is both the smallest outlay and, on 13 of the 23 sets, the
    // cheapest pack there is. Saying "$6.55" twice in two sentences is what the
    // first draft did, so the two claims share one figure here.
    lede += cheaperBox
      ? ` The cheapest way in is one pack at ${priceUSD(singly.each)}, but the cheapest pack in the set is inside the
      ${name(bestPack.p)} at ${priceUSD(bestPack.each)}${off >= 1 ? `, which is ${off}% less` : ""}.`
      : ` The cheapest way in is also the cheapest pack: one pack at ${priceUSD(singly.each)}.${
          next ? ` The ${name(next.p)} works out at ${priceUSD(next.each)} a pack, so on this set the bigger boxes cost
      more per pack, not less.` : ""
        }`;
  } else {
    lede += ` The cheapest way in is ${name(cheapest)} at ${priceUSD(cheapest.market)}.`;
    if (cheaperBox) {
      lede += ` Packs bought one at a time are ${priceUSD(singly.each)} each; the cheapest pack in the set is inside the
      ${name(bestPack.p)} at ${priceUSD(bestPack.each)}${off >= 1 ? `, which is ${off}% less` : ""}.`;
    } else if (bestPack && singly) {
      lede += ` No box here beats a single pack per pack, at ${priceUSD(singly.each)}${
        next ? `: the ${name(next.p)} works out at ${priceUSD(next.each)}` : ""
      }.`;
    } else if (bestPack) {
      lede += ` The cheapest pack here is inside the ${name(bestPack.p)} at ${priceUSD(bestPack.each)}.`;
    }
  }

  // imgDims(), not a literal, and on TCGplayer's host it deliberately returns
  // NOTHING. These 139 photos carried width="245" height="337", which is a card
  // scan's shape: the real files are 200x268, 200x294, 200x360 and 200x417
  // depending on the product, so the declaration was wrong by up to 34%. It
  // reserved nothing anyway, because .prod-shot is a fixed 88x88 box with
  // object-fit:contain. Use the helper for every remote image so the site
  // cannot drift back into guessing at somebody else's file.
  //
  // SIZES DESCRIBES THE BOX, NOT THE FILE. It said "(max-width:640px) 40vw,
  // 200px", which claims 156 CSS px on a 390px phone. The box is the 88x88
  // .prod-shot above. 156 x DPR2 = 312, so Chrome skipped the 200w candidate
  // and downloaded _in_1000x1000.jpg every time. Measured on one set page,
  // five products: 450.4KB fetched where 103.9KB was needed. 88px x DPR2 =
  // 176, which 200w covers, so this is 4x less data at identical pixels.
  //
  // THAT FIX STOPPED AT DPR 2 AND THE SENTENCE ABOVE IS WHY IT WAS EASY TO MISS.
  // Every line of it is true and every number in it is a DPR 2 number, so the
  // page read as solved. 88 x DPR3 = 264, 264 clears 200, and a DPR 3 phone went
  // on taking _in_1000x1000.jpg for all 225 of these across 41 guides. The
  // ladder is productSrcset() in shared/format.mjs now, which is where the DPR 3
  // arithmetic lives for all seven builders that were writing it by hand.
  const cards = items
    .map(
      (p) => `      <li class="prod">
        ${/*
             A PRODUCT ROW WITH NO PHOTOGRAPH WAS A SOLID WHITE 88x88 SQUARE,
             fixed 22 August 2026. `.prod-shot` in ui.css is `background:#fff`
             because product photography arrives on white and a cream tile reads
             as a halo round the box, so an anchor with no <img> in it painted a
             bright white block on the dark green card, between five correct
             photographs. On the two rows that hit it -- TCGplayer product
             646039, the Surging Sparks Half Booster Box, and 709097, the Mega
             Evolution Ascended Heroes Collection (Larry) -- that reads as a
             broken image rather than as an absence, which is the worst way to
             show a gap and is exactly what the owner asked to be rid of.

             IT IS NOT A DATA GAP AND THAT WAS CHECKED BEFORE ANYTHING CHANGED.
             Both urls are in data/no-scan.json's `deadUrls`: TCGplayer's own
             CDN answers 403 for BOTH rungs of both products while serving the
             other 181 photographs on these pages. No corpus in this repo holds
             either box -- shared/product-photos.mjs is per row-kind and pins
             the same host, data/topps-images.json is Topps, and the sealed
             PriceCharting cache is Topps as well. The photograph is genuinely
             absent, so the branch stays and only what it renders changes.

             THE FALLBACK IS THE SITE'S OWN AND IT IS ALREADY ON THESE PRODUCTS.
             build-openings.mjs draws `.op-px` for the identical 403s: it takes
             the white plate off and lays the same diagonal hatch every other
             missing picture on this site uses. This is that, plus the words,
             because a hatch on its own is the empty placeholder rather than the
             fix for it. The label says "No photo" and not "No scan": these are
             sealed boxes, and the panel's default wording is about a card.

             THE ANCHOR STAYS AND THAT IS NOT THE /hall.html CASE. That rule is
             about a control that cannot do what it offers -- a lightbox with no
             picture in it. This one still opens the product on TCGplayer, which
             is what the other 181 do, and the row's real labelled link is the
             product name beside it. */ ""}${deadImg(p.thumb)
          ? noScanBox("prod-shot is-none", { label: "No photo", tag: "a",
              attrs: ` href="${esc(affLink(p.url))}" rel="noopener" target="_blank" tabindex="-1"` })
          : `<a class="prod-shot" href="${esc(affLink(p.url))}" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
          <img src="${esc(p.thumb)}"${productSrcsetAttr(p.thumb, 88)}
               sizes="88px" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(p.thumb)} referrerpolicy="no-referrer">
        </a>`}
        <div class="prod-body">
          ${/* THE SHAPE REQUIREMENT, which this row met in every respect except
                the label. "Every outbound link carries an aria-label saying it
                leaves the site" is the half of the outbound rule that is
                checkable, and 184 links across the 42 guides did not.

                IT IS ALSO THE WORST ACCESSIBLE NAME ON THE PAGE, which is why
                this one is worth more than the convention. The name was
                "Single Pack": read out of a list of links it says nothing
                about which set, and one guide carries up to seven of these
                differing only in that word. The label names the product, the
                set and the host.

                THE PICTURE ABOVE STAYS UNLABELLED and that is not an
                oversight. It is the same href with aria-hidden and
                tabindex="-1", one target split in two for the eye, so a label
                there would announce the row twice. 192 links in the built tree
                are that pattern and none of them may gain one.

                ", opens on <host>" IS THE SITE'S WORDING, 381 uses against 100
                of the older "(opens TCGplayer)" on the preorder pages. */ ""}<h3><a href="${esc(affLink(p.url))}" rel="noopener" target="_blank"
            aria-label="${esc(productLabel(p, s.released).kind)} for ${esc(s.name)}, opens on tcgplayer.com">${esc(productLabel(p, s.released).kind)}</a></h3>
          <p class="prod-what">${esc(productLabel(p, s.released).blurb)}</p>
          <p class="prod-price"><b>${priceUSD(p.market)}</b> <span>market</span></p>
          ${(() => {
            const e = perPack(p, s.released);
            if (!e || e.packs === 1) return "";
            return `<p class="prod-per">${priceUSD(e.each)} a pack${
              bestPack && bestPack.p === p ? ` <b>cheapest</b>` : ""
            }</p>`;
          })()}
          ${
            p.low
              ? `<p class="prod-low">Cheapest listing ${priceUSD(p.low)}${
                  p.listings ? ` &bull; ${p.listings} seller${p.listings === 1 ? "" : "s"}` : ""
                }</p>`
              : ""
          }
        </div>
      </li>`
    )
    .join("\n");

  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What you can buy</p>
    <h2>Ways to open <span class="hl">${esc(s.name)}</span></h2>
    <p class="lede prod-lede">${lede}</p>
    <ul class="prod-grid">
${cards}
    </ul>
    <p class="prod-note">Prices are TCGplayer market and lowest-listing prices, read on
      ${esc(longDate(entry.checked))}. They move every day, so treat them as a rough idea and not a quote.
      Product photos are TCGplayer's. We are not a shop and we do not sell any of this.</p>
    ${perPacks.length ? `<p class="prod-note">Cost per pack is the market price divided by the pack count printed on
      each card above, so you can check it. Sleeves, dice, decks and promo cards are counted as worth nothing, which
      flatters every box that includes them. Anything whose pack count is not in our data gets no per-pack figure
      rather than a guessed one, which is why blisters, tins and collection boxes have none, and why sets from before
      2023 have none either: our counts are sourced for the current era and were not the same in earlier ones. What
      each product has held, and when it changed, is on <a href="/how-many-packs.html">how many packs are in it</a>.</p>` : ""}
  </div>
</section>`;
}

/** Facts pulled straight out of the checklist. No pull rates: we do not have them. */
function derivedFacts(s) {
  const out = [];
  const rar = s.rarities || {};
  const total = s.cardsSeen || 0;

  if (s.released) {
    out.push(`<b>Released ${longDate(s.released)}</b>, which was ${yearsSince(s.released)}.`);
  }
  if (s.printedTotal && s.secretCount) {
    out.push(
      `The set is <b>${s.printedTotal} cards</b> on paper, but there are <b>${s.total}</b> in total. ` +
      // Crown Zenith and Shining Fates both have exactly one, and both read
      // "The extra 1 are secret rares" until 19 August 2026.
      (s.secretCount === 1
        ? `The extra one is a secret rare numbered past the printed count.`
        : `The extra ${s.secretCount} are secret rares numbered past the printed count.`)
    );
  }
  /**
   * THE COUNT AND THE SENTENCE ARE THE SAME CLAIM, so they are written next to
   * each other. Both come from CHASE, which comes from RARITY_ORDER.
   *
   * IT USED TO READ "N of the M cards are Ultra Rare or better", which was true
   * of the number beside it and not true of the ladder underneath it. Four tiers
   * had been added to RARITY_ORDER that the count did not include, two of them
   * (Shiny Rare, Shiny Ultra Rare) sorting ABOVE Ultra Rare and two of them
   * (Holo Rare VSTAR, Holo Rare VMAX) sorting just below it but out-earning it
   * on price. Adding them to a sentence phrased that way makes it false: Shiny
   * Ultra Rare is not "Ultra Rare or better", it is its own tier, and Paldean
   * Fates would have read "154 of the 245 cards are Ultra Rare or better".
   *
   * So the sentence names the thing the page actually highlights, and it says
   * where to check it. The rarity breakdown is the next band down and every row
   * this number counts is marked there, so a reader can add them up.
   *
   * THE SECOND HALF IS A GUARD, NOT A FLOURISH, and it is the reason 154 of 245
   * on Paldean Fates now reads as a fact instead of a boast. "Worth pulling"
   * invited a reader to hear a big number as good odds, which is the one thing
   * this site never says. A count of how many KINDS of card exist at a rarity is
   * checklist composition, the same reasoning the Japanese wrapper's 種類 counts
   * get in shared/rarity.mjs, and it says nothing whatever about what is in a
   * pack. The sentence now says that out loud rather than relying on the reader
   * not to make the leap.
   */
  const chaseCount = Object.entries(rar)
    .filter(([r]) => CHASE.has(rarityLabel(r)))
    .reduce((a, [, n]) => a + n, 0);
  if (chaseCount && total) {
    out.push(
      `<b>${chaseCount} of the ${total} cards</b> sit at a chase rarity, which is every tier ` +
      `highlighted in the rarity breakdown below. That is what the checklist holds, not how ` +
      `often any of it turns up.`
    );
  }
  // THE MARK GOES IN FRONT OF THE TIER IT NAMES, in the two facts that name one.
  // Both of these are sentences about a rarity, and the rarity is a printed
  // symbol before it is a phrase: a reader who has just met the star key in the
  // ladder below can carry it straight into the prose. Inline SVG out of
  // shared/rarity.mjs, so it costs nothing over the wire, and BOOKLET_MARK is a
  // whitelist, so a tier the booklet does not show gets no mark rather than an
  // invented one.
  for (const r of ["Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare"]) {
    if (rar[r]) {
      const n = rar[r];
      out.push(
        `Only <b>${BOOKLET_MARK[r] ? rarityMark(BOOKLET_MARK[r]) : ""}${n} ${r}${n === 1 ? "" : "s"}</b> ` +
        `${n === 1 ? "exists" : "exist"} in the entire set.`
      );
      break;
    }
  }
  if (s.chase?.length) {
    const top = s.chase[0];
    const topR = rarityLabel(top.rarity);
    // "THE CHASE CARD IS SKYLA" WAS THE SHARPEST WRONG SENTENCE ON THE SITE,
    // because it is the one a reader repeats. It is not false, it is answering
    // about a checklist while the reader is asking about a product, and the
    // fix is to say which of the two out loud rather than to drop the fact.
    const comp = companionOf(s.id);
    out.push(
      `The chase card ${comp ? `of the ${s.total} on this checklist ` : ``}is <b>${esc(top.name)}</b>${top.rarity ? ` (${BOOKLET_MARK[topR] ? rarityMark(BOOKLET_MARK[topR]) : ""}${esc(topR)})` : ""}, ` +
      `sitting around <b>${moneyCompact(top.price)}</b> raw` +
      (gradedPrice(s.id, top.number, top.name, s.name)
        ? `, and <b>${moneyCompact(gradedPrice(s.id, top.number, top.name, s.name))}</b> in a PSA 10.`
        : `.`) +
      (comp ? ` ${esc(compChaseNote(s, comp))}` : ``)
    );
  }
  const rips = ripsBySet[s.id];
  if (rips) {
    out.push(`We have ripped <b>${rips} ${rips === 1 ? "video" : "videos"}</b> worth of this set on the channel.`);
  }
  return out;
}

/**
 * The handful of rules only a set guide needs, inlined here rather than added
 * to assets-source/ui.css, which is render blocking on all 426 pages. Same
 * pattern as build-expansions.mjs and build-luck.mjs. Everything else on these
 * pages is a class ui.css already carries.
 */
const PAGE_CSS = `
/* The money-per-rarity line under each bar. .rar is a two column grid whose
   .rar-bar already spans both, so this sits between the count and the bar and
   spans the full width too. Mono, because it is a figure. */
.rar-pr{grid-column:1 / -1;font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.02em}
.rar-pr b{color:var(--ketchup-deep);font-weight:700}
.band-sky .rar-pr{color:var(--ink)}
/* The plain-English read of the value band. Same size as a lede, set apart so
   it does not read as a third paragraph of numbers. */
/* .comp IS THE COMPANION SET NOTE, on the three guides that have one, and it
   SHARES this selector rather than declaring the same six properties again.
   It wants exactly the .sv-say treatment: that rule was in the 39 page contrast
   pass on 18 August 2026 and cleared it, it paints no ground of its own so it
   sits on whatever band it lands in, and a note whose whole job is to be
   believed should not look like an ad. The border is var(--gold), which
   resolves to a teal, and it is the only color either class carries.
   A SECOND BLOCK WOULD HAVE COST 25 PAGES 118 BYTES OF DEAD CSS. This <style>
   is inlined on all 28 guides and only three of them ever emit a .comp, so a
   duplicate rule ships to the other 25 to style nothing. The shared selector is
   six bytes. Measured on the first build, which is how it was caught.
   No emphasis color on the b inside it: this paragraph is the one element here
   that can land on either the page green or a card, so a small accent tuned for
   one of them is the .set-rips bug again. Bold carries it. */
.sv-say,.comp{max-width:42em;margin-top:var(--s5);border-left:4px solid var(--gold);
  padding-left:var(--s4);font-size:var(--t-body)}
/* Cost per pack. Sits directly under the total price it is derived from. */
.prod-per{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.04em;text-transform:uppercase;margin-top:3px}
.prod-per b{display:inline-block;background:var(--mustard);color:var(--on-accent);
  border-radius:var(--r-pill);padding:1px 7px;margin-left:4px;font-weight:700}

/* DESKTOP. Every rule below is min-width only, so a phone and a tablet render
   what they rendered before: measured identical at 390 on /sets/151.html before
   and after.

   MEASURED AT 1440 ON /sets/151.html. Two long single columns of short items
   sat inside a 1,392px band and neither of them used it.

   Quick facts. ui.css caps .facts-list li at 64em, and the comment above that
   cap in ui.css says out loud what it buys: "roughly 100 characters". That is
   the cap doing its job at the wrong number. Six cards, each 972px wide with
   100 characters a line, stacked, with 420px of empty band beside every one of
   them. Two columns fixes both halves at once: the band is full, the page loses
   about half the height of the section, and the measure drops to roughly 70
   because the column is 684px instead of 972px. The em cap has to be released
   for the second column to exist at all, which is why max-width goes to none
   here and not anywhere narrower.

   Rarity breakdown. .rar is a two column grid, a rarity name on the left and a
   count on the right, with the bar spanning underneath. At 1,392px the name and
   its count were most of a metre apart. Two of them per row halves that and
   halves the section.

   1200 is where two 684px columns still hold the longest item without the
   measure going the other way and getting too short. */
@media(min-width:1200px){
  .facts-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
    gap:11px;align-items:start}
  .facts-list li{max-width:none}
  .rarity-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
    gap:9px 20px;align-items:start}
}
/* Reading measure for the standalone prose. These are capped in em, which is
   the font SIZE and not the character width, so the same number gives a
   different count in a different face: .lede at 38em measured 78 characters
   here, and .intl-lede on /sets/index.html measured 95.7 at 810px, the widest
   measure on any set page.

   50ch AND NOT 70ch. ch is the advance width of a "0" and a digit is one of the
   widest glyphs in Outfit, so a character averages about 0.7 of a ch: 50ch sets
   around 70 and 70ch would set 100. The measurement, and the first pass that
   used ch as if it meant characters and made a page WORSE, are written out in
   build-buying.mjs.

   Gated at 1000 because below it the wrap is narrower than any of these caps
   and none of them bind.

   .wNN ARE THE INLINE style="max-width:38em" ATTRIBUTES, MOVED TO CLASSES. An
   inline style beats every stylesheet rule that is not !important, so a media
   query could not reach them. The four declarations below reproduce the inline
   values exactly, so every width under the breakpoint renders what it rendered
   before and the media query is the only behaviour change. */
.w34{max-width:34em}
.w38{max-width:38em}
.w40{max-width:40em}
.w42{max-width:42em}
@media(min-width:1000px){
  .lede,.sv-say,.intl-lede,.w34,.w38,.w40,.w42{max-width:50ch}
  .prod-note,.price-note{max-width:64ch}
}

/* THE SET SYMBOL STRIP, under the fact tiles in the hero.
   The BOX is fixed at 40px square with object-fit:contain, and the img carries
   the file's own scaled shape in its attributes. The two do different jobs: the
   attributes stop a reflow before the file decodes, the box stops the row
   changing height between guides. The symbols are not one shape (base1 is
   48x25, sv1 is 40x40), so a guide-to-guide jump is real without it. */
.setsym{display:flex;align-items:center;gap:var(--s4);margin-top:var(--s4);
  padding:var(--s3) var(--s4);border:1px solid var(--hair);border-radius:var(--r);
  background-color:var(--card);box-shadow:var(--lift);max-width:44em}
.setsym-i{flex:0 0 40px;width:40px;height:40px;object-fit:contain}
.setsym p{margin:0;font-size:var(--t-sm);line-height:1.5}

/* THE CHASE CARD WE CANNOT PICTURE. .flat-list and .flat-item are ui.css's
   already, written for exactly this case on the Pokemon pages, and the only
   thing they do not carry is a price, because the rows they were built for have
   none. ".flat-item .flat-pr" rather than a bare ".flat-pr": ".flat-item span"
   is 0,1,1 and would win against a bare class, which is what left the price
   rendering as another line of 0.6rem grey caption on the first attempt.
   The link gets a 44px tap target because it is the only action on the row and
   the row exists precisely because the lightbox is not available to it. */
.flat-item .flat-pr{font:700 var(--t-sm)/1.5 var(--mono);color:var(--ketchup-deep);
  letter-spacing:0;text-transform:none}
.flat-item a{display:inline-flex;align-items:center;min-height:44px;
  font:700 var(--t-micro)/1 var(--body);letter-spacing:.03em;color:var(--ketchup-deep)}

/* THE CHECKLIST'S CHASE ROWS AND ITS STAR MARKS.
   The tint is the same idiom, and the same rgba of --mustard, that the
   card-for-card table on the imported guides already uses to mark the rows that
   matter (.rcmp tr.is-same in build-intl-pages.mjs): gold at 18% leaves the row
   text at its normal contrast rather than tinting it. The negative inline margin
   pulls the tint out past the row's own padding so the highlight reads as a band
   across the row rather than as a box around the middle column; .ig-cards li is
   padded 6px 0, so there is nothing horizontal to eat into.
   THE STARS ARE SMALLER HERE THAN IN THE LADDER, 9px against 11px. .ig-rr2 is
   --t-micro uppercase mono, roughly two thirds the size of the ladder's tier
   name, and an 11px star beside it sat proud of the cap height and made the
   rarity column look like it had a bullet in it. */
/* TINTED DOWN, NOT UP. A teal wash at 18% lifted the row to #3B6156 and took
   the small pink price on it from 4.51:1 to 3.42:1: on a dark palette a
   highlight that LIGHTENS eats the contrast of everything inside it. The
   palette's own dark teal tint marks the row and every ink on it improves. */
.ig-cards li.is-chase{background:var(--sky-tint);border-radius:6px;
  padding-left:7px;padding-right:7px;margin-left:-7px;margin-right:-7px}
.ig-rr2 .rk{margin-right:4px}
.ig-rr2 .rk svg{width:9px;height:9px}

/* THE RARITY LADDER'S STAR ROW. .rar-name holds the tier name and the mark sits
   inline in front of it, so it rides the text's own baseline. RARITY_CSS below
   is the shared key's own stylesheet, appended verbatim rather than copied:
   shared/rarity.mjs keeps the colours next to the shapes precisely so the two
   cannot drift, and this page was already emitting .rk markup in the hits band
   with NO stylesheet behind it, which left the one Japanese letter badge on
   /sets/ja-cyber-judge.html rendering as bare text. */
.rar-name .rk{margin-right:5px}

/* THE VALUE CONCENTRATION CHART. Label, bar, label, stacked on a phone and one
   row from 560px up, so the two bars sit on the same left edge and are directly
   comparable, which is the only reason the chart exists.
   The SVG is width:100%;height:auto against its own 300x16 viewBox, so it
   scales as one piece and the rounded ends stay round. display:block matters:
   an inline SVG sits on the text baseline and leaves a descender gap under it
   that reads as a misaligned bar. */
.svc{margin-top:var(--s5);max-width:42em;display:flex;flex-direction:column;gap:var(--s4)}
.svc-row{display:grid;gap:4px}
.svc-bar{display:block;width:100%;height:auto}
.svc-track{fill:var(--paper-3);stroke:var(--keyline);stroke-width:2}
.svc-fill{fill:var(--gold)}
.band-sky .svc-track{fill:#fff;fill-opacity:.55}
.svc-k{margin:0;font-weight:700;font-size:var(--t-sm)}
.svc-v{margin:0;font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.02em}
@media(min-width:560px){
  .svc-row{grid-template-columns:11em minmax(0,1fr);align-items:center;gap:2px var(--s4)}
  .svc-k{grid-row:1;grid-column:1}
  .svc-bar{grid-row:1;grid-column:2}
  .svc-v{grid-row:2;grid-column:2}
}

/* THE "WHAT WE HAVE OPENED" TILE ROW IS .facts WITH ONE RULE TURNED OFF.
   ui.css ends its .facts block with

       .fact:last-child:nth-child(4n + 1){grid-column:1 / -1}

   which spans a LONE tile across the whole row. That rule is right where it
   was written: the orphan there is the Pokemon pages' fifth tile, the only
   tappable thing on the page, and it looked like a mistake sitting in 1,099px
   of space. This block's orphan is a statistic, and it is not tappable, so the
   same rule turned "7 SINGLE PACKS" into a 1,392px bar with two words floating
   in the middle of it. Measured on /sets/pitch-black.html at 1440x900.

   So the tracks are capped at one tile's natural width instead, which leaves a
   single tile the same size as it would be with three beside it, and the span
   is switched back off. Four tiles at 1440 are unchanged to the pixel, because
   4 x 21.2em plus the gaps is the wrap.

   IT LIVES HERE RATHER THAN IN ui.css on purpose, and CLAUDE.md records the
   same call being made for the home page's 545-999px rules: this is one band on
   one page family, and another pass owns that stylesheet. Fold it in when both
   settle. */
@media(min-width:700px){
  .facts.opened{grid-template-columns:repeat(4,minmax(0,21.2em));justify-content:start}
  .facts.opened .fact:last-child:nth-child(4n + 1){grid-column:auto}
}
${RARITY_CSS}`;

/**
 * The same trade build-css.mjs makes for ui.css, for the same reason: the
 * comments are the point of the SOURCE and pure weight in the shipped page, and
 * this block is inline in a render blocking <head>. Comments only, plus the
 * indentation between rules. Nothing else is touched.
 */
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const head = ({ title, desc, canonical, image, ld, css = "" }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<link rel="preconnect" href="https://images.pokemontcg.io" crossorigin>
${FONTS}
${STYLES}${css ? `\n<style>${miniCSS(css)}</style>` : ""}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">
`;

// ------------------------------------------------------------------ a set
function setPage(s) {
  const url = `${SITE}/sets/${s.id}.html`;
  // The hero logo's url is built inside heroLogo(), which needs the whole
  // rendition ladder rather than one filename. The lone `const logo` that used
  // to live here was its only reader.
  const rips = ripsBySet[s.id] || 0;
  const label = labelFor("sets", s.id);
  const top = s.chase?.[0];
  // THE ONE CLICKABLE FACT WAS BEHIND THE CUT, AND ON 28 GUIDES IT WAS NOT
  // THERE AT ALL. Every description said "the top chase cards with current
  // guide values" and named none of them, so 28 results in a search page read
  // as the same sentence with the set name swapped. The card and its price now
  // sit in the SECOND sentence, ahead of the ~920px cut, which is the CTR idea
  // CLAUDE.md records against the Pokemon pages, applied to the pages where it
  // is one line rather than an 844-page rewrite. The figure is the same
  // checklist value the page prints and sources under the chase grid.
  // THE DESCRIPTION IS THE FIRST PLACE THE WRONG CLAIM LANDS, and on three
  // guides it landed before the page was ever opened. "The priciest card is
  // Skyla at $11.35" is the sentence a reader sees in a search result, and it
  // is the sentence they carry into the shop. Where a companion set exists,
  // the count and the price both say WHICH cards they describe, in the same
  // breath, because there is no room in a description for a second sentence.
  const comp = companionOf(s.id);
  const desc =
    `${s.name} Pokemon TCG set guide: ${s.total || "?"} cards, released ` +
    `${longDate(s.released) || "recently"}.` +
    (top && typeof top.price === "number"
      ? comp
        ? ` The priciest of those ${s.total} is ${top.name} at ${moneyCompact(top.price)}; ${comp.fullName} is a separate ${comp.cards} cards we hold no prices for.`
        : ` The priciest card is ${top.name} at ${moneyCompact(top.price)}.`
      : ``) +
    ` Full rarity breakdown, every card priced` +
    (s.chase?.length ? `, and the cards worth chasing.` : `.`);

  // Keyed through rarityLabel, so a set whose counts came from the API rather
  // than from a checklist sorts by the same names the rest of the page prints.
  // The guard at the top of this file has already proved every one of them has
  // a rung, so there is no -1 to fall back from.
  const ordered = Object.entries(s.rarities || {}).sort(
    (a, b) => RARITY_ORDER.indexOf(rarityLabel(a[0])) - RARITY_ORDER.indexOf(rarityLabel(b[0]))
  );
  const maxN = Math.max(1, ...ordered.map(([, n]) => n));

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${s.name} Pokemon TCG Set Guide`,
      description: desc,
      // Required for the Article rich result. All 23 guides were omitting it,
      // which made every one of them structurally ineligible. Prefer the set's
      // own share card where we generated one.
      image: [ogCards.has(s.id) ? `${SITE}/assets/og-${s.id}.jpg` : `${SITE}/assets/og-image.jpg`],
      about: { "@type": "Thing", name: `${s.name} (Pokemon Trading Card Game)` },
      url,
      // `url` and `mainEntityOfPage` are NOT interchangeable and only the
      // second is the one Google's Article documentation names. `url` says
      // where the Article can be read; mainEntityOfPage says that THIS page is
      // the Article's canonical home rather than a page that merely mentions
      // it. Every guide carried the first and none carried the second.
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      datePublished: syncedAt,
      dateModified: syncedAt,
      author: { "@type": "Organization", name: "Garbage Rips 585", url: SITE + "/" },
      publisher: {
        "@type": "Organization",
        name: "Garbage Rips 585",
        logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Set guides", item: `${SITE}/sets/` },
        { "@type": "ListItem", position: 3, name: s.name },
      ],
    },
  ];
  // NO "top chase cards" ItemList. Every set page used to push one whose
  // entries carried a `name` and a `position` and nothing else, which names a
  // card the crawler cannot follow, so the whole block was ignored.
  //
  // Nothing on this site can stand in as the target. The chase cards render as
  // `<button class="chase-card">` with no id to anchor to, and their only real
  // link is the TCGplayer url behind the lightbox, which is a shop listing and
  // not a page about the card. The /sets/ index ItemList further down is the
  // one that stays, because a set genuinely has a page of its own.

  const rarPr = rarityPrices(s);

  // ---------------------------------------------------------------- the bands
  //
  // Each section is a function of ONE argument: the class that paints it. They
  // were hard coded, and the result was three identical sky bands stacked on
  // Surging Sparks (rips, pulled on camera, chase cards) and three identical
  // cream ones on Pitch Black (rarity, checklist, also-known-as). A guide read
  // as one long scroll rather than as sections, which is a real cost on a page
  // whose whole job is to be skimmed.
  //
  // It cannot be fixed by hard coding a better order either, because which
  // sections exist varies per set: eight guides have no rips, most have nothing
  // in "pulled on camera", and only some have a foreign twin. The tone has to
  // be assigned after the list of present sections is known.
  const bands = [
    // ORDER: THE PICTURES AND THE MONEY FIRST, THE CHANNEL SECOND.
    //
    // These two bands used to sit third and fourth, under the rip list and the
    // "pulled on camera" grid, and on a 390x844 phone that put the chase cards
    // 1,150px down on the shortest guide and 3,971px down on Phantasmal Flames:
    // 4.7 screens of scrolling before the first card scan on a page whose own
    // hero lede promises "what the chase cards are going for". Measured on all
    // 28 English guides, six of them were past 2,800px.
    //
    // A reader standing in a shop holding a pack is asking what is in it and
    // whether it is worth opening, and the chase grid plus the concentration
    // chart are the two bands that answer that with a picture. The rip list is a
    // list of text links and "pulled on camera" is our own hits, which is the
    // best thing on the page and also the thing somebody who came for the set
    // will happily scroll to. Both keep their sections, one screen lower.
    //
    // This is a judgement about who the page is for and it is reversible in one
    // edit: move these two entries back under the two IIFEs above and nothing
    // else has to change, because the tone alternation is computed from the pin
    // rather than written down.
    (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    ${s.chase?.length ? (() => {
      /**
       * A CHASE CARD WITH NO SCAN IS A ROW, NOT AN EMPTY TILE.
       *
       * data/no-scan.json holds 101 TCGdex bases that answer 404, and one of
       * them is the top chase card of an English set: Celebrations #25 Mew,
       * Secret Rare, $62.22, the priciest card in the set. It rendered as a
       * `<button class="chase-card">` with no picture in it, sized by the 245x342
       * scans on either side, carrying `aria-label="Enlarge Mew"` and a lightbox
       * handler gated on `data-img`, which is empty. So the set's headline card
       * was a card-shaped hole that announced an action it could not perform, and
       * the TCGplayer link it does have was unreachable, because the only way to
       * that link is through the lightbox that never opens.
       *
       * Same split, same classes and the same argument as build-pokemon.mjs and
       * the imported guides: a card with a scan keeps the grid, a card without
       * one becomes a named row sized by its own text, and it says out loud that
       * there is no scan rather than leaving a gap that reads as a slow image.
       * The buy link becomes a real link on the row, which is the one thing this
       * card gained rather than lost.
       *
       * It fires on exactly one card across the 28 English guides today. It is
       * here so that the next one is not found by somebody wondering why a set's
       * best card is a blank rectangle.
       */
      const withScan = s.chase.filter((c) => c.image);
      const noScan = s.chase.filter((c) => !c.image);
      const psa = (c) => gradedPrice(s.id, c.number, c.name, s.name);
      return `
    ${withScan.length ? `<div class="chase-grid">
      ${withScan.map((c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(c.name)}" data-rarity="${esc(rarityLabel(c.rarity) || "")}"
        data-number="${esc(c.number)}" data-price="${esc(moneyCompact(c.price))}"
        data-psa10="${esc(psa(c) ? moneyCompact(psa(c)) : "")}"
        data-url="${esc(c.url ? affLink(c.url) : "")}"
        aria-label="Enlarge ${esc(c.name)}">
        ${/* alt="" ON PURPOSE: the button above is aria-labelled "Enlarge <name>"
              and the .nm / .rr lines below print the name, rarity and number in
              full, so an alt here made the AX tree read the card out a second
              time inside a control that had already named it. Chrome does not
              treat button descendants as presentational, so it really was
              announced. `onerror` removes the node, so no broken image is ever
              left nameless. */ ""}${avifPicture(`<img src="${c.image}" alt="" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>`)}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(rarityLabel(c.rarity) || "")} &bull; ${esc(c.number)}</div>
        <div class="pr">${moneyCompact(c.price)}</div>
        ${psa(c)
          ? `<div class="pr10">PSA 10 ${moneyCompact(psa(c))}${
              // longDate, not the raw ISO string the price file stores. Every other date
              // on this page is long form, including the "last updated" line directly
              // under this grid, so a bare 2026-08-12 here read as a different site.
              gradedAsOf(s.id, c.number, c.name, s.name) ? `<span> &bull; ${esc(longDate(gradedAsOf(s.id, c.number, c.name, s.name)))}</span>` : ""
            }</div>`
          : ""}
      </button>`).join("\n      ")}
    </div>` : ""}
    ${noScan.length ? `${withScan.length ? `<h3 class="flat-h">No scan for ${noScan.length === 1 ? "this one" : "these"}</h3>` : ""}
    <ul class="flat-list">
      ${noScan.map((c) => `<li class="flat-item">
        <b>${esc(c.name)}</b>
        <span>${esc(rarityLabel(c.rarity) || "")} &bull; ${esc(c.number)}</span>
        <span class="flat-pr">${moneyCompact(c.price)}${psa(c) ? ` &bull; PSA 10 ${moneyCompact(psa(c))}` : ""}</span>
        ${/* "Check current price" names no card, and there can be several of
              these rows on one guide. It fires once in the whole tree today,
              on Celebrations' Mew 25, which is that set's own chase card, so
              the least useful accessible name on the page belongs to its most
              important row. */ ""}${c.url ? `<a href="${esc(affLink(c.url))}" rel="nofollow noopener" target="_blank"
          aria-label="Check the current price of ${esc(c.name)} ${esc(c.number)}, opens on tcgplayer.com">Check current price</a>` : ""}
      </li>`).join("\n      ")}
    </ul>
    <p class="mine-note">The card database has no scan for ${
      noScan.length === 1 ? `${esc(noScan[0].name)} ${esc(noScan[0].number)}` : `${noScan.length} of these`
    }, so ${noScan.length === 1 ? "it is" : "they are"} named and priced here rather than shown as an empty card.</p>` : ""}
    <p class="price-note">${esc(priceNote(s.priceStamps || { pricesChecked: s.pricesAsOf || s.chasePricesAsOf }))} These are the same eight rows the checklist further down prints, sorted by price, so the two agree by construction.${/* "SORTED BY PRICE" IS ONLY REASSURING IF THE READER KNOWS WHAT WAS SORTED.
          On the three guides with a companion set these eight are the top of a
          checklist, not the top of a set, and the band above the grid has
          already said so. This is the one clause that keeps the sentence true
          where somebody has scrolled straight to the pictures. */ ""}${
      comp ? ` Sorted out of the ${s.total} on that checklist: ${esc(comp.fullName)} is a separate ${comp.cards} cards and none of them can be here, because this site holds no price for any of them.` : ""
    } Singles move fast, so treat them as a ballpark rather than a quote.${affOn ? ` ${esc(aff.tcgplayer.disclosure)}` : ""}</p>
    ${/* THE GRADED FIGURES GET THEIR OWN SENTENCE, BECAUSE THE ONE ABOVE IS NOT
          ABOUT THEM. It credits PriceCharting for an UNGRADED price, and a
          PSA 10 figure standing over it read as PriceCharting's too. The name
          and each date are read out of data/psa10.json, never typed here. */ ""}${(() => {
      const rows = gradedRows(s);
      if (!rows.length) return "";
      const one = rows.length === 1;
      const dated = rows.some((c) => gradedAsOf(s.id, c.number, c.name, s.name));
      // THE POSSESSIVE HAD TO GO WHEN THE COLUMN GAINED A SECOND FEED. It read
      // "are NAME's graded sales data", which turns into "are a separate graded
      // sales feed's graded sales data" the moment two feeds are credited, a
      // sentence that says the same three words twice. "graded sales data from
      // NAME" carries one name or two without changing shape.
      return `<p class="price-note">The PSA 10 ${one ? "figure is" : "figures are"} graded sales data from ${esc(gradedWho(s, rows))}, a different measurement from the guide values above and read separately, so the two are not one reading.${
        dated ? ` The date printed beside a graded figure is the day it was read.` : ""
      } A PSA 10 is a card somebody has paid to have graded and sealed at the top grade, so it is not what the same card is worth loose in your hand.</p>`;
    })()}
    `;
    })() : `
    <div class="no-prices">
      ${/* "further down", not "above": this band moved to the top of the page and
            the rarity breakdown it points at is now below it. A section that
            tells a reader to look the wrong way is worse than one that says
            nothing, and this one is only ever seen on a set we have no prices
            for, which is exactly when somebody is hunting for the rest. */ ""}
      <strong>No prices yet.</strong> ${esc(s.name)} is recent enough that pricing data has not landed in the card database. The card list and rarity counts further down this page are accurate; the values will fill in as the market settles.
    </div>`}
  </div>
</section>`,

    setValue(s) ? (cls) => valueBand(s, cls) : null,

    (() => {
      // A COUNT, THE WAYS IN, AND ONE THING TO PRESS PLAY ON. Redesigned
      // 20 August 2026 on the owner's own note, looking at this section on Pitch
      // Black: "right now its just a list of text, looks pretty big and boring,
      // maybe there is a simpler way we can show how many packs / videos we
      // ripped, just by showing a number and linking to the playlist page".
      //
      // WHAT IT USED TO BE AND WHY HE WAS RIGHT. Twelve tiles, each a label and
      // a date, of which the newest twelve on a 23 rip set were "Pitch Black
      // Pack - Pack 9", "Pitch Black ETB 1 - Pack 8", "Pitch Black Pack - Pack
      // 8" and so on down. Every row on the page differed from its neighbour in
      // one digit. That is 1,077px at 390, the tallest thing on the guide that
      // is not the checklist, spent on twelve near identical strings. MEASURED
      // AFTERWARDS: 465px on Pitch Black, so 612px and roughly two thirds of a
      // phone screen came back, on 22 guides.
      //
      // THE TWO FACTS IN IT THAT ARE WORTH A READER'S TIME ARE THE COUNT AND
      // THE ROUTE, and the twelve labels were neither.
      //
      // THE COUNT WAS ALREADY ON THE PAGE, TWICE. The Quick facts band prints
      // it as a stat tile linking to /videos.html?set=<id>, and the "See it
      // opened" band near the foot prints it again in a sentence over the pack
      // art with a button to the same url. So a third recital of "23 videos"
      // above twelve rows was the section's whole content, and the thing this
      // page genuinely could not say anywhere was HOW THE SET GOT OPENED: that
      // there are three Pitch Black runs, that the ETB marathon is two videos
      // and 41 seconds, that the Chaos Rising ETB series is 21 videos and 7:36.
      // The runtime is the reason to press play; a bare count is not, on a
      // channel of Shorts where 21 videos is under eight minutes.
      //
      // ZERO, ONE AND SEVERAL ALL HAD TO WORK, and 16 of the 28 English sets
      // have no run at all. A set with runs shows them. A set with rips but no
      // run shows its NEWEST rip, so there is always one thing to play rather
      // than a number and a link, which would be thin. A set with no rips at
      // all still returns null and renders no section, exactly as before: the
      // Quick facts tile already says "None yet" on those six guides, which is
      // the deliberate empty state, and returning null here also leaves the
      // band tone alternation on those pages untouched.
      const all = ripsList.get(s.id) || [];
      if (!all.length) return null;
      const newest = all[0];
      const runs = runsBySet.get(s.id) || [];
      const nRuns = ["", "One", "Two", "Three", "Four", "Five", "Six"][runs.length] || String(runs.length);
      // The logo the hero on this same page already loaded, so the fallback
      // costs a phone nothing it has not already paid for. Only reached by the
      // one playlist in the tree with no product photograph.
      const fallbackImg = hasLogo(s.id)
        ? `<img class="rr-img rr-fall" src="/assets/logos/${esc(s.id)}-pokemon-tcg-set-logo-sm.webp" width="60" height="45" loading="lazy" decoding="async" alt="">`
        : `<span class="rr-img rr-fall" aria-hidden="true"></span>`;
      const rows = runs.length
        ? runs
            .map(
              (r) => `      <li><a class="runrow" href="/${esc(r.path)}">
        ${
          r.img
            ? `<img class="rr-img" src="${esc(r.img)}" width="60" height="45" loading="lazy" decoding="async" alt="${esc(r.alt)}">`
            : fallbackImg
        }
        <span class="rr-x"><span class="rr-t">${esc(runTitle(r.title, s.name))}</span><span class="rr-m">${r.n} video${
                r.n === 1 ? "" : "s"
              }${r.timed ? ` &bull; ${clockMS(r.sec)}` : ""}</span></span>
      </a></li>`,
            )
            .join("\n")
        : `      <li><a class="runrow" href="/${esc(newest.path)}">
        <span class="rr-x"><span class="rr-k">Newest rip</span><span class="rr-t">${esc(
          newest.label || newest.siteTitle || newest.title,
        )}</span><span class="rr-m">${esc(shortDate(newest.published))}${
            newest.duration ? ` &bull; ${clockMS(newest.duration)}` : ""
          }</span></span>
      </a></li>`;
      return (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On the channel</p>
    <h2>Every ${esc(s.name)} <span class="hl">rip</span></h2>
    <a class="ripcount" href="/videos.html?set=${esc(s.id)}">
      <b>${all.length}</b>
      <span class="rc-t">rip${all.length === 1 ? "" : "s"} of ${esc(s.name)} <i>on the channel&nbsp;&rarr;</i><small>newest ${esc(shortDate(newest.published))}</small></span>
    </a>
    ${/* THE LINE ABOVE THE ROWS EARNS ITS PLACE BY SAYING WHERE THEY PLAY.
          "Three runs" alone would be a caption for something the reader can
          already count. What a reader does not know, and what these pages spent
          months not saying, is that a run plays on this site rather than on
          YouTube, which is the one thing our playlist page does that YouTube's
          does not. Kept to one line at 390 on all 22 guides.
          THE ONE RIP CASE GETS ITS OWN WORDING because "the most recent one"
          promises a second one. Six guides are at one or two rips. */ ""}<p class="run-h">${
      runs.length > 1
        ? `${nRuns} runs of this set, each one plays here in order`
        : runs.length === 1
          ? "One run of this set, and it plays here in order"
          : all.length === 1
            ? "The only one, and it plays here"
            : "The most recent one, and it plays here"
    }</p>
    <ul class="runrows">
${rows}
    </ul>
  </div>
</section>`;
    })(),

    (() => {
      const mineRaw = (hitsBySet.get(s.id) || [])
        .map((h) => {
          const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
          const same = ((checklists[s.id] || {}).cards || []).filter((c) => norm(c.name) === norm(h.card));
          const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
          const m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0] || null;
          const v = videoById.get(h.vid);
          return {
            name: h.card,
            n: m ? m.n : h.number || null,
            rarity: (m && m.rarity) || h.rarity || null,
            img: m && m.img ? `${m.img}/low.webp` : null,
            price: m && typeof m.price === "number" ? m.price : typeof h.price === "number" ? h.price : null,
            path: v ? v.path : null,
            label: v ? ripLabel(v, setNameById, descriptions[v.id]) || v.title : null,
          };
        })
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      // THE SAME CARD PULLED TWICE IS ONE CARD AND A COUNT, NOT TWO TILES.
      //
      // The owner: "when we hit the same card more than once, don't show it twice on
      // the pages where we show hits, just show the card and then make a new
      // badge for showing 2x or 3x or however many we have". Chespin appeared
      // twice on the Chaos Rising guide, identical scan, identical price,
      // identical everything, which reads as a rendering fault rather than as
      // a fact about the pulls.
      //
      // GROUPED ON THE RESOLVED CARD, not the typed string, so "Trainer Dawn"
      // and "Dawn" collapse the way they already do for the text-only rows: the
      // catalogue number is the identity when there is one, and the normalised
      // name when there is not.
      //
      // Every rip is kept, not just the first, because "we hit this twice" is
      // only interesting if you can watch both. The badge is hidden at one, per
      // his instruction: "if its only 1 dont show any number".
      const seenCard = new Map();
      for (const h of mineRaw) {
        const k = h.n ? `n:${h.n}` : `x:${String(h.name).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        const prev = seenCard.get(k);
        if (!prev) { seenCard.set(k, { ...h, count: 1, rips: h.path ? [{ path: h.path, label: h.label }] : [] }); continue; }
        prev.count += 1;
        if (h.path && !prev.rips.some((r) => r.path === h.path)) prev.rips.push({ path: h.path, label: h.label });
      }
      const mine = [...seenCard.values()];
      // Hits that only ever got a sentence in the log, minus any card the My
      // Hits tab already covers properly, so a card with a scan and a price is
      // not also listed as bare text underneath it.
      // MATCHING ON THE EXACT STRING WAS TOO STRICT AND IT SHOWED. The My Hits
      // tab had "Dawn" and the rip log said "Trainer Dawn", so the same card
      // rendered twice on Phantasmal Flames: once with a scan and a price, once
      // as bare text underneath. The log writes a card type in front of a
      // supporter's name and the catalogue does not, so the comparison drops
      // that word and then accepts either string containing the other.
      const key = (x) =>
        String(x || "")
          .toLowerCase()
          .replace(/\b(trainer|supporter|item|stadium)\b/g, " ")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      // PROMOS FROM THE PRODUCTS THAT OPENED THIS SET. A Black Star Promo out
      // of a UPC is not a card in the set, and it is absolutely part of what
      // came out of that rip, so it belongs on the page with its own scan,
      // number and price and a label that says what it is.
      // ONE SET PAGE PER PROMO, named in the data by `forSet`. Matching on
      // "any set this video opened" put the same two promos at the top of four
      // different pages, because the UPC held packs from four sets. A promo is
      // in none of them; it shipped alongside one of them, and that is the only
      // answer that reads true. Anything without forSet appears on no set page
      // rather than being guessed onto one, and is named at build time below.
      const promoHits = [];
      for (const v of videos) {
        for (const h of HITS[v.id] || []) {
          if (!h.promo || h.forSet !== s.id) continue;
          if (promoHits.some((x) => x.card === h.card)) continue;
          promoHits.push({ ...h, path: v.path, label: v.siteTitle || v.title });
        }
      }
      const seen = mine.map((h) => key(h.name)).filter(Boolean)
        .concat(promoHits.map((h) => key(h.card)));
      // A CARD PULLED TWICE IS ONE ROW WITH A COUNT, not two identical rows.
      // Doubles are ordinary across hundreds of packs, and listing the same
      // card again tells the reader nothing except that the page repeats
      // itself. The count is the interesting part, so it goes on the row, and
      // every rip it came out of stays linked.
      const grouped = new Map();
      for (const h of PROSE_HITS.get(s.id) || []) {
        const k = key(h.card);
        if (!k || seen.some((m) => m === k || m.includes(k) || k.includes(m))) continue;
        if (!grouped.has(k)) grouped.set(k, { ...h, count: 0, rips: [] });
        const g = grouped.get(k);
        g.count += 1;
        // Same card from the same video is still one pull for linking purposes.
        if (!g.rips.some((r) => r.path === h.path)) g.rips.push({ path: h.path, label: h.label });
        // Keep the most specific rarity seen for it.
        if (!g.rarity && h.rarity) g.rarity = h.rarity;
      }
      // Resolve what we can to a real card so it shows its scan in the grid
      // with everything else. Anything that will not resolve stays a text row
      // rather than being shown as a guess.
      const proseAll = [...grouped.values()].sort((a, b) => b.count - a.count);
      const proseCards = [];
      const prose = [];
      for (const h of proseAll) {
        // A promo is not in this set's checklist and must never be resolved
        // against it. It still has a scan and a price of its own, carried by
        // the rip log, so it renders as a full card rather than a bare line.
        const c = h.promo ? null : resolveCard(s.id, h.card, h.rarity);
        if (c) proseCards.push({ ...h, resolved: c });
        else prose.push(h);
      }

      // ONE LIST, SORTED BY VALUE. The three kinds of hit used to render as
      // three consecutive blocks, each sorted within itself, so a $38.75 promo
      // sat below a $2.87 card purely because it came from a different file.
      // Nobody reading the page cares which file a card came out of. They care
      // what it is worth, so everything with a picture is normalised to one
      // shape and sorted on price. Anything with no market price sorts last
      // rather than sorting as if it were free.
      const priced = [
        ...mine.map((h) => ({
          kind: "mine", img: h.img, name: esc(h.name),
          meta: `${esc(rarityLabel(h.rarity) || "")}${h.n ? ` &bull; #${esc(h.n)}` : ""}`,
          price: typeof h.price === "number" ? h.price : null, psa10: null,
          // COUNT AND RIPS BOTH COME FROM THE GROUPING ABOVE. This rebuild used
          // to derive rips from a single h.path, which was right when every row
          // was one pull; now a row can be several, and dropping count here was
          // why the first attempt deduplicated Chespin correctly and then
          // rendered it with no badge.
          count: h.count || 1,
          rips: h.rips && h.rips.length ? h.rips : h.path ? [{ path: h.path, label: h.label }] : [],
        })),
        ...promoHits.map((h) => ({
          kind: "promo", img: h.img ? `${h.img}/low.webp` : null, name: esc(h.card),
          meta: `${esc(h.setName || "Black Star Promo")}${h.number ? ` &bull; #${esc(h.number)}` : ""}`,
          price: typeof h.price === "number" ? h.price : null,
          psa10: typeof h.psa10 === "number" ? h.psa10 : null,
          rips: [{ path: h.path, label: h.label }],
        })),
        ...proseCards.map((h) => ({
          kind: "prose", img: h.resolved.img,
          name: `${esc(h.resolved.name)}${h.count > 1 ? ` <span class="mine-x">x${h.count}</span>` : ""}`,
          // rarityLabel, for the same reason the `mine` rows above call it: this
          // is TCGdex's raw field and TCGdex ships "Double rare" and "Ultra Rare"
          // inside ONE checklist. Printed verbatim it put 5 sentence-case entries
          // among 18 title-case ones in a single grid, and /sets/mega-evolution
          // read "Illustration rare" in a component on a page that writes
          // "Illustration Rare" 54 times elsewhere. Only this branch was missing
          // it, which is why the split looked random rather than per-set.
          meta: `${esc(rarityLabel(h.resolved.rarity) || rarityLabelOf(h.rarity) || "")}${h.resolved.number ? ` &bull; #${esc(h.resolved.number)}` : ""}`,
          price: typeof h.resolved.price === "number" ? h.resolved.price : null, psa10: null,
          rips: h.rips,
        })),
      ].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      if (!mine.length && !proseAll.length && !promoHits.length) return null;
      return (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Pulled on camera</p>
    <h2>What we have <span class="hl">hit</span> from this set</h2>
    ${/* The SECOND sentence has to agree too, and only the first one did. Four
          guides today have hit exactly one card from a set, and they read
          "1 card out of our own packs. Every one of them is in a video you can
          watch." Same fix in build-intl-pages.mjs, which carries this lede
          word for word. */ ""}<p class="lede w38">${priced.length + prose.length} card${
      priced.length + prose.length === 1 ? "" : "s"
    } out of our own packs. ${
      priced.length + prose.length === 1 ? "It is" : "Every one of them is"
    } in a video you can watch.</p>
    ${priced.length ? `<ul class="mine-grid">
      ${priced
        .map(
          (h) => `<li class="mine${h.kind === "promo" ? " is-promo" : ""}">
        ${/* A TILE WITH NO SCAN IS NOT AN EMPTY BOX, since 22 August 2026. The owner,
              about the whole site: "there should be no empty place holder
              images anywhere on the site." Every one of these is a row whose
              card NAME matches nothing on this set's checklist, so there is no
              printing to fetch a picture of; the build says which rows and why
              on every run. The box holds the same ratio and the same hatch and
              now carries this set's own symbol and the words "No scan". The
              symbol is honest here because the row is on that set's own guide,
              it is a 40px glyph rather than a card face, and the page header
              has already fetched the same file so it costs no request. The
              three things deliberately NOT in it are argued in
              shared/card-scan.mjs. */ ""}${h.img ? mineImg(h.img) : noScanBox("mine-img is-none", { slug: s.id, name: s.name })}
        <!-- The count rides on the name, not on the picture, because the
             picture is the card and the count is a fact about our pulls.
             Hidden at one: a "x1" badge on every other card would make the
             ordinary case look annotated. -->
        <p class="mine-n">${h.name}${h.count > 1 ? ` <span class="mine-x">&times;${h.count}</span>` : ""}</p>
        <p class="mine-r">${h.meta}</p>
        ${/* moneyCompact, NOT moneyExact, AND THAT IS THE HALL OF FAME'S SHAPE
              RATHER THAN A TASTE CALL. These tiles and the plaques on
              /hall.html are the same cards out of the same data/hits.json, and
              they printed the same card two ways: $175.00 here against $175
              there for Mega Greninja ex, Chaos Rising #122. shared/format.mjs
              says which is which and this band is squarely on the compact side
              of it: a tile in a list, where the cents are noise and the column
              has to stay narrow. The checklist and the rarity ladder further
              down keep moneyExact, because those really are rows where the
              number is the point. */ ""}<p class="mine-p">${typeof h.price === "number" ? moneyCompact(h.price) : "No price"}${
            typeof h.psa10 === "number" ? ` <span class="mine-psa">${moneyCompact(h.psa10)} in a 10</span>` : ""
          }</p>
        ${h.rips.map((r) => `<a class="mine-w" href="/${esc(r.path)}">Watch the rip &rarr;</a>`).join("\n        ")}
      </li>`
        )
        .join("\n      ")}
    </ul>` : ""}
    ${prose.length ? `<ul class="mine-list">
      ${prose
        .map(
          (h) => `<li><b>${esc(h.card)}</b>${
            h.count > 1 ? ` <span class="mine-x">x${h.count}</span>` : ""
          }${
            h.rarity ? ` <span class="mine-rk">${rarityMark(h.rarity)}${esc(rarityLabelOf(h.rarity))}</span>` : ""
          }
        ${h.rips
          .map((r) => `<a class="mine-btn" href="/${esc(r.path)}">Watch the rip &rarr;</a>`)
          .join("\n        ")}</li>`
        )
        .join("\n      ")}
    </ul>
    <p class="mine-note">Those came out of the rip log as written. They do not have a card number or a
      price against them yet, so they are listed rather than priced.</p>` : ""}
  </div>
</section>`;
    })(),

    (() => {
      // HOW MUCH SEALED PRODUCT THIS SET HAS COST US. Sits directly under
      // "pulled on camera", because the two are the same thought in the two
      // directions a reader cares about: what came out, and what went in.
      //
      // IT IS NOT A FIFTH WAY OF SAYING "we have 21 videos". "See it opened"
      // further down counts VIDEOS and the rip list above counts videos again;
      // this counts BOXES, and on Chaos Rising those are 21 and 3. That is the
      // whole reason the block earns its place: nothing else on the page can
      // tell you how many ETBs a set has taken.
      //
      // NO RATE, NO AVERAGE, NO PACKS PER HIT. This block sits two sections
      // under a grid of the cards we pulled, which makes "3 ETBs" and "6 hits"
      // one division away from a pull rate the site does not have and never
      // states. So it counts product and stops. See "Never state pull rates" in
      // CLAUDE.md and the same refusal on /luck.html.
      //
      // A SET WITH NOTHING RECORDED RENDERS NOTHING. 27 of the 28 English
      // guides are in that state today and the section is simply absent from
      // them, which is the same rule the pulled-on-camera band above and the
      // set notes below already follow.
      const rows = openedRows(s.id);
      if (!rows.length) return null;
      // A BAND THAT SAYS "1 SINGLE PACK" SAYS LESS THAN ITS OWN HEADING.
      //
      // Measured on the first build: 19 of 28 guides rendered the section and
      // 17 of those held one tile reading 1 or 2 loose packs, because a single
      // pack needs no box number and every set with one rip has one. A section
      // label, a heading, a lede and a source note, to print a 1. That is the
      // "five ways of saying one thing" failure this file's own band ordering
      // comment is about.
      //
      // So the floor is two rules, both about whether the block is saying
      // anything the page does not already say, and neither is a magic number:
      //
      //   - one product opened once is less than its own heading
      //   - a single row equal to the set's own rip count is the VIDEO COUNT in
      //     other words, and that number is already in the facts row at the top
      //     of the page, in "See it opened" and in the rip list. Four guides
      //     were doing exactly this: Pokemon GO 12 packs against 12 rips,
      //     Rebel Clash, Shining Fates and Temporal Forces 2 against 2.
      //
      // Both rules are switched off by a box number, because a numbered box is
      // the one fact here that exists nowhere else on the site, and both heal
      // themselves: the day a Pokemon GO ETB is logged the block comes back
      // with something to say.
      if (
        rows.length === 1 &&
        rows[0].counted !== "boxes" &&
        (rows[0].n === 1 || rows[0].n === (ripsBySet[s.id] || 0))
      ) {
        return null;
      }
      // Every plural on this block, derived from the label rather than kept in
      // a list. "Collection Box" needs "es" and "Blister" needs "s", and a
      // hand-written table of eighteen plurals is one more thing to go stale
      // the day a product is added to shared/taxonomy.mjs.
      const plural = (word, n) =>
        n === 1 ? word : /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`;
      const anyBoxes = rows.some((r) => r.counted === "boxes");
      const anyPacks = rows.some((r) => r.counted === "packs");
      return (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Out of our own pocket</p>
    <h2>What we have <span class="hl">opened</span> of this set</h2>
    <p class="lede w38">Sealed product we have been through, counted from the rip log rather than from the video count. A box counts once however many videos it took to get through it.</p>
    <div class="facts opened">
      ${rows
        .map(
          (r) => `<div class="fact"><div class="n">${r.n}</div><div class="l">${esc(
            plural(labelFor("products", r.prod), r.n)
          )}</div></div>`
        )
        .join("\n      ")}
    </div>
    <p class="price-note">${
      anyBoxes
        ? "The box count is the highest number we wrote against a box in the log, so one marked as our third counts as three whether or not the first two were filmed. "
        : ""
    }${anyPacks ? "Loose packs are counted one per opening. " : ""}Anything we have not written a number against is not counted here, so these are a floor rather than a total.</p>
  </div>
</section>`;
    })(),

    // PINNED to the sky gradient, and the tone of everything else is worked out
    // by alternating outward from here. Alternating outward from a fixed point
    // can never produce two neighbours the same; alternating from the top and
    // then forcing one section into place can.
    { pin: true, html: (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Quick facts</p>
    <h2>${esc(s.name)} <span class="hl">101</span></h2>
    <ul class="facts-list">
      ${derivedFacts(s).map((f) => `<li>${f}</li>`).join("\n      ")}
      ${(s.notes?.funFacts || []).map((f) => `<li>${esc(f)}</li>`).join("\n      ")}
    </ul>${/* The chase-card fact prints a PSA 10 figure, and this band is a long
              way from the sourcing sentence under the chase grid. A graded
              number has to carry its feed and its date wherever it lands, so
              the one bullet that quotes one gets its own line. Both values are
              read from data/psa10.json rather than written in prose. */ ""}${(() => {
      const top = s.chase?.[0];
      if (!top || !gradedPrice(s.id, top.number, top.name, s.name)) return "";
      const read = gradedAsOf(s.id, top.number, top.name, s.name);
      return `
    <p class="price-note">That PSA 10 figure is graded sales data from ${esc(gradedWho(s, [top]))}${
      read ? `, read ${esc(longDate(read) || read)}` : ""
    }. ${/* "A DIFFERENT FEED" WAS RIGHT WHILE THE GRADED COLUMN WAS
              pokemonpricetracker's AND IS NOT NOW. Both halves of this sentence
              name pricecharting.com on most guides since 21 August 2026, and
              telling a reader they are different companies when they are the
              same one is worse than saying nothing. The true difference is what
              is being measured and when it was read, which is what the sentence
              was always for. Same correction in build-proto.mjs and
              build-wanted.mjs. */ ""}The raw figure beside it is ${esc(s.priceStamps?.priceSource || "pricecharting.com")}'s price guide value for an ungraded copy, which is a different measurement read on a different day.</p>`;
    })()}
  </div>
</section>` },

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${ordered.length ? `${rarPr.size ? `<p class="lede w42">How many cards sit at each rarity, and what those
      cards are worth. <b>Mid</b> is the middle card at that rarity: half of them cost more than that and half cost
      less, which is a far better guide to what you will actually see than the one famous card at the top.</p>` : ""}
    <div class="rarity-list" data-figure="chart">
      ${ordered.map(([r, n]) => {
        const key = rarityLabel(r) || r;
        const pr = rarPr.get(key);
        return `<div class="rar${CHASE.has(key) ? " chase" : ""}">
        <span class="rar-name">${BOOKLET_MARK[key] ? rarityMark(BOOKLET_MARK[key]) : ""}${esc(key)}</span>
        <span class="rar-n">${n}</span>
        ${pr
          ? `<span class="rar-pr">${
              n === 1
                ? `<b>${moneyExact(pr.top)}</b>`
                : `Mid <b>${moneyExact(pr.mid)}</b> &bull; top <b>${moneyExact(pr.top)}</b>`
            }</span>`
          : ""}
        <span class="rar-bar"><i style="width:${Math.max(4, Math.round((n / maxN) * 100))}%"></i></span>
      </div>`;
      }).join("\n      ")}
    </div>${ordered.some(([r]) => BOOKLET_MARK[rarityLabel(r) || r]) ? `
    <p class="price-note">The stars beside a tier are the ones printed on the card, redrawn from the key in the
      booklet that ships inside a modern set. The color carries as much of the meaning as the count: two silver
      stars is Ultra Rare and two black stars is Double Rare. Tiers with no stars are not on that page, so this
      site does not draw one for them. <a href="/rarity.html">The whole rarity key</a>.</p>` : ""}${rarPr.size ? `
    <p class="price-note">Prices worked out from the ${esc(s.name)} checklist below, read ${esc(
      longDate(checklists[s.id]?.checked) || checklists[s.id]?.checked || ""
    )}. A rarity only gets a figure where every card at that rarity has a price and the checklist agrees with the set's
      own count, so a few tiers show a count and no money rather than a number covering a different set of cards than
      the one beside it.</p>` : ""}` : `<p class="lede">Card list not available for this set yet.</p>`}
  </div>
</section>`,

    checklists[s.id]?.cards?.length ? (cls) => checklistBand(s, cls) : null,
    intlSets[s.id]?.sources?.length ? (cls) => intlBand(s, cls) : null,
    productsBySet[s.id]?.products?.length ? (cls) => productBand(s, cls) : null,

    rips ? (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We ripped <span class="hl">${rips}</span> of these</h2>
    <div class="set-watch">
      <div class="packshot pack pack--${packClass(s.id)}"><span class="pack-face pack-l"><span class="pack-art"${packTile(s.id)}></span></span></div>
      <div>
        <p class="lede">Want to see what actually comes out of ${esc(s.name)} instead of reading about it? Every ${esc(s.name)} rip on the channel is one tap away.</p>
        ${/* ONE SENTENCE, AND IT DELIBERATELY DOES NOT NAME THIS SET.
              The obvious line to write here is "the codes from these packs give
              you digital packs of ${s.name}". It was not written, and the reason
              is in data/tcg-live.json: the code gives a pack of the same
              expansion, but nothing official says every expansion is still in
              the game, and `expiry.twoRealLimits` records "Live has removed old
              content before. Not verified, so do not assert it." These guides
              cover sets back to 2020, so a promise per set would be a claim
              about a back catalogue nobody has published. The general sentence
              is true of every set page and needs no such claim. */ ""}
        <p style="margin-top:12px;font-size:var(--t-sm);line-height:1.55">There is one more card in each of
          those packs and it is not a Pokemon card: <a href="/tcg-live.html">what the code card actually gets
          you</a>.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${s.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
  </div>
</section>` : null,

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <h2>Other <span class="hl">sets</span></h2>
    <div class="set-index">
      ${sets.filter((o) => o.id !== s.id).slice(0, 6).map((o) => `<a class="set-card" href="/sets/${o.id}.html">
        ${setCardLogo(o.id, "")}
        <span><span class="ttl">${esc(o.name)}</span><br><span class="meta">${o.total ?? "?"} cards</span></span>
      </a>`).join("\n      ")}
    </div>
    <div style="text-align:center;margin-top:22px"><a class="btn btn-ghost" href="/sets/">Every set &rarr;</a></div>
  </div>
</section>`,
  ].filter(Boolean);

  const pin = bands.findIndex((b) => b.pin);
  if (pin === -1) throw new Error(`setPage(${s.id}): no pinned band, so the section tones have nothing to alternate from.`);
  const body = bands
    .map((b, i) => {
      const isBand = Math.abs(i - pin) % 2 === 0;
      const cls = b.pin ? "band-sky tight" : isBand ? "band tight" : "tight";
      return (b.pin ? b.html : b)(cls);
    })
    .join("\n\n");

  // THE NO-SCAN PANEL'S RULES RIDE WITH THE PANEL. Eight of the 28 guides emit
  // one today, so they are gated rather than added to PAGE_CSS: that block is
  // render-blocking on every guide and 20 of them have nothing for it to style.
  // Read off the drawn body rather than recomputed, so this cannot drift out of
  // step with the condition inside the tile.
  const css = body.includes("noscan") ? `${PAGE_CSS}\n${NOSCAN_CSS}` : PAGE_CSS;
  return head({ title: setTitle(s.name), desc, canonical: url, image: `${SITE}/assets/${ogCards.has(s.id) ? `og-${s.id}` : "og-image"}.jpg?v=2`, ld, css }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    ${heroLogo(s.id)}
    <h1>${esc(s.name)}</h1>
    ${/* THIS SENTENCE WAS THE SAME ON ALL 28 ENGLISH GUIDES WITH THE NAME
          SWAPPED, and at 390x844 it held 231px of the only screen most readers
          see: hero logo, set name, and four lines that told a stranger nothing
          they could not read off the h1 above it. A sentence that says nothing
          costs 28 times.

          WHAT IT SAYS NOW IS THE ONE THING THAT DIFFERS PER SET: the year, the
          size, and the name of the card at the top of the money. Somebody who
          has just pulled something wants to know whether it is the card, and
          somebody comparing two guides now learns something different from
          each. NO DOLLAR FIGURE GOES IN HERE deliberately: the first sourcing
          sentence on the page is under the chase grid, 1,178px down, and a
          price above it would be a number with no source in reach. The name is
          not a number.

          s.chase has already been rebuilt from the checklist and sorted by
          price further up this file, which is why chase[0] can be trusted here
          when CLAUDE.md says it cannot be trusted out of sets.json. */ ""}<p class="lede w34">${(() => {
      // Year off the ISO string rather than through Date(), which shifts a
      // date-only value across a year boundary in a westward timezone.
      const yr = /^(\d{4})/.exec(String(s.released || ""))?.[1];
      // "A 2021 set, 73 cards" is the first number on the page and on three
      // guides it was the count of a checklist rather than of a set. The
      // companion clause is short on purpose: the lede's job is to stop a
      // reader believing 73 is the whole story, and the band under the fact
      // tiles is where the rest of it is said.
      const opener =
        yr && s.total ? `A ${yr} set, ${s.total} cards${comp ? `, plus ${compClause(comp)}` : ""}.`
        : yr ? `A ${yr} set.`
        : s.total ? `${s.total} cards${comp ? `, plus ${compClause(comp)}` : ""}.`
        : "";
      const body =
        `What is in ${esc(s.name)}, what is actually rare in it, and what ` +
        (top
          ? comp
            ? `the cards worth chasing are going for. ${esc(top.name)} leads those ${s.total}, and ${esc(comp.name)} is not priced here.`
            : `the cards worth chasing are going for. ${esc(top.name)} leads them at the moment.`
          : `each card will be worth once prices land.`);
      return opener ? `${opener} ${body}` : body;
    })()}</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/sets/">Set guides</a> / ${esc(s.name)}</nav>

    <div class="facts">
      <div class="fact"><div class="n">${s.total ?? "?"}</div><div class="l">Cards total</div></div>
      <div class="fact"><div class="n">${s.printedTotal ?? "?"}</div><div class="l">In the printed set</div></div>
      ${/* THE TILE SAID "Secret rares" AND IT HAS NEVER COUNTED THEM.
            sync-sets.mjs computes secretCount as total minus printedTotal, so
            what it holds is "cards numbered past the printed checklist". On 27
            of the 28 guides nobody notices. On Celebrations the tile read
            "0 Secret rares" eight lines above a rarity ladder reading
            "Secret Rare 1 $61.30", and above a chase line naming Mew (Secret
            Rare) at $61.30: the set's 25th card really is a Secret Rare and it
            really is numbered 25 of 25, which is the one case where the two
            questions give different answers.

            THE NUMBER WAS RIGHT AND THE LABEL WAS THE LIE, so the label moved.
            Counting the rarity ladder instead would have been much worse: the
            22 Scarlet & Violet guides have ZERO cards whose rarity is spelled
            "Secret Rare" (theirs are Illustration, Special Illustration and
            Hyper Rare) while carrying 31 to 154 cards numbered past the
            printed total, so Pitch Black would have gone from 36 to 0.

            "Numbered past the set" is not invented here: build-intl-pages.mjs
            has printed exactly that on the imported guides since they were
            built, off a secretCount of its own. This is the English half
            catching up with it.

            plural() goes with it. It was here for the stat-tile plural bug, and
            the new label has no plural to get wrong. */ ""}<div class="fact"><div class="n">${
        s.secretCount ?? "?"
      }</div><div class="l">Numbered past the set</div></div>
      ${rips
        ? `<a class="fact fact-link" href="/videos.html?set=${s.id}"><div class="n">${rips}</div><div class="l">Rip${rips === 1 ? "" : "s"} on this channel <span aria-hidden="true">&rarr;</span></div></a>`
        : `${/* A BARE HYPHEN IN THE BIG NUMBER SLOT READS AS MISSING DATA, NOT
                 AS ZERO, and it is the only tile on the page that is not a
                 fact. Eight guides wear it. "None yet" says the true thing,
                 which is that we have not opened this set on camera, and it
                 takes the release tile's own font-size override because it is a
                 word in a slot sized for two digits. */ ""}<div class="fact"><div class="n" style="font-size:1.15rem">None yet</div><div class="l">Rips on this channel</div></div>`}
      ${(() => {
  // THESE TWO USED TO BE A SECOND .facts GRID OF THEIR OWN, and a grid of one
  // tile is the one case the orphan rules cannot help. Above 700
  // `.fact:last-child:nth-child(4n + 1)` spans a lone tile across the row,
  // which is right when it is the last tile of a full strip and wrong when it
  // is the ONLY tile: on /sets/151.html it made "$29.58" sit in a 1,232px bar
  // at a 1,280px viewport, under a row of four 298px tiles. Measured at five
  // widths; the bar appeared at every one of them from 768 up.
  //
  // IN THE SAME GRID THEY ARE ORDINARY TILES. The price becomes the fifth
  // child, which lands it on `.fact:nth-child(4n + 1):nth-last-child(2)` --
  // the row-of-two rule -- so it and the release date each take half the row.
  // Below 700 nothing changes: the orphan rules live in a min-width query, and
  // the tile was already a plain half-width cell there.
  //
  // BEFORE THE WIDE TILE, NOT AFTER, so the release date stays last. It is the
  // one tile written to end the strip, and both orphan rules are anchored to
  // where a tile falls in the order.
  const live = (productsBySet[s.id]?.products || []).find((p) => p.kind === "Single Pack");
  const packPrice = s.notes?.packPrice || (typeof live?.market === "number" ? moneyExact(live.market) : null);
  // The two are different claims and the label says which. "Typical" is a
  // person who has stood in a shop; "market price" is TCGplayer.
  //
  // The source and the date are NOT repeated here. This page already carries
  // "Prices are TCGplayer market and lowest-listing prices, read on <date>"
  // under the products band, and spelling it out again in a fact tile ran the
  // label to three lines on a phone for information the reader already has.
  const packFrom = s.notes?.packPrice ? "Single pack, typical" : "Single pack, market price";
  return `${s.notes?.inPrint ? `<div class="fact"><div class="n" style="font-size:1.1rem">${esc(s.notes.inPrint)}</div><div class="l">Still in print?</div></div>\n      ` : ""}${packPrice ? `<div class="fact"><div class="n">${esc(packPrice)}</div><div class="l">${esc(packFrom)}</div></div>\n      ` : ""}`;
})()}
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${longDate(s.released) || "Unknown"}</div><div class="l">Release date${s.released ? ` &bull; ${yearsSince(s.released)}` : ""}</div></div>
    </div>${/* DIRECTLY UNDER THE COUNT IT CORRECTS, AND ABOVE THE CHASE GRID.
          The "Cards total" tile two lines up is the number a reader takes away,
          and on three guides it is the size of a checklist rather than of a
          set. Below the chase grid is after the damage, and inside Quick facts
          is where this already lived and was missed.
          THE NEWLINE IS INSIDE THE TERNARY. Written the obvious way, with the
          interpolation on its own indented line, the 25 guides with no
          companion each gained a line of trailing spaces. */ ""}${
      comp ? `\n    ${compBand(s, comp)}` : ""}

${symbolFor(s) ? `
    <div class="setsym">
      ${symbolFor(s)}
      <p>That is the ${esc(s.name)} set symbol. Every card in the set prints it at the bottom, beside the
        collector number. <a href="/what-set.html">Holding a card and not sure which set it is?</a></p>
    </div>` : ""}
  </div>
</section>

${body}

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <picture><source id="lbAvif" type="image/avif"><img id="lbImg" src="" alt=""></picture>
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
    <div class="lb-actions"><a class="btn btn-sky btn-sm" id="lbUrl" href="#" rel="nofollow noopener" hidden>Check current price</a></div>
  </div>
</div>

</main>
${/* The stock credit names TCGdex for the card data and PriceCharting for the
      money, and on the 14 guides that also publish graded figures that is an
      incomplete credit rather than a wrong one. The graded feed is named here
      too, from the data, and only on the pages that actually print one. */ ""}
${footer(priceFooter(`${gradedRows(s).length ? `PSA 10 prices from ${gradedWho(s)}. ` : ""}Prices are estimates and move constantly.`))}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg');
  var last=null;
  function open(b){
    last=b;
    // The lightbox is the one place on this page that loads high.webp, 600x825
    // and 100-135KB, and AVIF is 37% smaller at that size. avifPicture() cannot
    // reach it because the url only becomes an image url on click, so the
    // <source> is filled here, applying the SAME host test avifPicture applies:
    // only assets.tcgdex.net publishes an AVIF beside its WebP, and a <source>
    // pointing at a 404 paints a broken card instead of falling back.
    // srcset FIRST, then src, so the webp is never requested and abandoned.
    var big=b.dataset.img, avif=document.getElementById('lbAvif');
    if(big.indexOf('https://assets.tcgdex.net/')===0 && big.slice(-5)==='.webp')
      avif.setAttribute('srcset', big.slice(0,-5)+'.avif');
    else avif.removeAttribute('srcset');
    img.src=big; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.rarity,b.dataset.number].filter(Boolean).join(' \u2022 ');
    document.getElementById('lbPr').textContent=b.dataset.price
      + (b.dataset.psa10 ? '  \u2022  PSA 10 ' + b.dataset.psa10 : '');
    var u=document.getElementById('lbUrl');
    if(b.dataset.url){u.href=b.dataset.url;u.hidden=false;}else{u.hidden=true;}
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on'); document.body.style.overflow='';
    if(last) last.focus();      // return focus where it came from
  }
  document.querySelectorAll('.chase-card').forEach(function(b){
    b.addEventListener('click',function(){ if(b.dataset.img) open(b); });
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>
${APP_JS}
</body>
</html>
`;
}

// ---------------------------------------------------------------- the index
function indexPage() {
  const url = `${SITE}/sets/`;
  const desc =
    `Pokemon TCG set guides: card counts, rarity breakdowns and chase card values for ` +
    `${sets.length + Object.keys(intlGuides).length} sets, from ${sets[sets.length - 1]?.name} to ${sets[0]?.name}.`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Set guides" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Pokemon TCG set guides",
      itemListElement: sets.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: s.name,
        url: `${SITE}/sets/${s.id}.html`,
      })),
    },
  ];
  // PAGE_CSS reaches the index too now. It used to go only to the guides, so
  // the index was the one page in this builder with no desktop rules on it, and
  // it held the widest measure of any of them: .intl-lede ran 810px and set
  // 95.7 characters a line. The rules it does not use, the two column .facts-
  // list and .rarity-list, match nothing here and cost a few hundred bytes.
  // The index carries no brand suffix: with it this ran 706px at 20px Arial
  // against Google's ~580px cut and lost "& Chase Values", bare it is 527px.
  // setTitle above is untouched and stays that way; the individual guides drop
  // their DESCRIPTOR rather than their brand and 26 of 27 already fit the cut.
  return head({ title: `Pokemon TCG Set Guides: Cards, Rarities & Chase Values`, desc, canonical: url, image: `${SITE}/assets/og-image.jpg?v=2`, ld, css: PAGE_CSS }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    ${/* "Set guides", which is what the nav, the footer and this page's own
          <title> ("Pokemon TCG Set Guides") all call it. "Card sets" was a
          fourth name for the same destination and named the content type
          rather than what is on the page, which is 42 written guides. The
          breadcrumb on every set guide was changed with it; four names for one
          page is how this site's nav drifted the first time. */ ""}
    <h1>Pokemon <span class="hl">set guides</span></h1>
    ${/* "we cover", not "we rip". Eight of the sets listed below have a guide
          and no rip on them, which the "N rips" line on each card says out
          loud, so the lede was contradicted by the grid under it. */ ""}
    <p class="lede w34">Every set we cover, boiled down to the facts that matter. Card counts, what is genuinely rare, and what the chase cards cost.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Set guides</nav>
    <div class="set-index">
      ${sets.map((s, i) => `<a class="set-card" href="/sets/${s.id}.html">
        ${setCardLogo(s.id, `${esc(s.name)} logo`, { eager: i < EAGER_SET_CARDS })}
        <span>
          <span class="ttl">${esc(s.name)}</span><br>
          <span class="meta">${s.total ?? "?"} cards${s.released ? ` &bull; ${s.released.slice(0, 4)}` : ""}${ripsBySet[s.id] ? ` &bull; ${ripsBySet[s.id]} rip${ripsBySet[s.id] === 1 ? "" : "s"}` : ""}${(s.chase || [])[0]?.price ? ` &bull; top ${moneyCompact(s.chase[0].price)}${gradedPrice(s.id, s.chase[0].number, s.chase[0].name, s.name) ? ` / ${moneyCompact(gradedPrice(s.id, s.chase[0].number, s.chase[0].name, s.name))} PSA 10` : ""}` : ""}</span>
        </span>
      </a>`).join("\n      ")}
    </div>
    ${/* THIS PAGE PUBLISHED 28 RAW PRICES AND 21 PSA 10 FIGURES AND SOURCED
          NEITHER. It was not in the count of guides that print a graded number
          without naming a feed, because it is the index rather than a guide,
          and its only credit was the footer's "Card prices from PriceCharting",
          which is true of the raw half and not of the graded half.

          The stamps are read off the same per-set price documents the guides
          print from, newest read wins, so this line cannot claim a freshness
          the figures behind it do not have. */ ""}${(() => {
      const priced = sets.filter((s) => (s.chase || [])[0]?.price);
      if (!priced.length) return "";
      const newest = priced
        .map((s) => s.priceStamps)
        .filter((d) => d?.pricesChecked || d?.checked)
        .sort((a, b) => String(priceRead(a)).localeCompare(String(priceRead(b))))
        .pop();
      const graded = priced.filter((s) => gradedPrice(s.id, s.chase[0].number, s.chase[0].name, s.name));
      const who = graded.length
        ? [...new Set(graded.map((s) => gradedSource(s.id, s.chase[0].number, s.chase[0].name, s.name)).filter(Boolean))]
        : [];
      const gradedRead = graded
        .map((s) => gradedAsOf(s.id, s.chase[0].number, s.chase[0].name, s.name))
        .filter(Boolean)
        .sort()
        .pop();
      return `
    <p class="price-note">Top is the priciest card in that set. ${esc(priceNote(newest || {}))}${
      graded.length
        ? ` The PSA 10 figures beside ${graded.length === 1 ? "one of them" : `${graded.length} of them`} are ${esc(
            who.length === 1 ? who[0] : "a separate graded sales feed"
          )}'s graded sales data${gradedRead ? `, read ${esc(longDate(gradedRead) || gradedRead)}` : ""}, a different feed and a different measurement. A row with no PSA 10 figure has no graded reading we are willing to publish yet, which is not the same as a card nobody grades.`
        : ""
    }</p>`;
    })()}
  </div>
</section>
${Object.keys(intlGuides).length ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Imported packs</p>
    <h2>Japanese, Korean and <span class="hl">Chinese</span> sets</h2>
    <p class="lede intl-lede">Most of these are a set you already know under a different name: Abyss Eye is Pitch Black,
      Clay Burst is half of Paldea Evolved. Each guide says which English set it becomes, so you can work out what you
      are actually looking at. Names are in English, with the native name kept alongside.</p>
    <div class="set-index">
      ${Object.entries(intlGuides)
        .sort((a, b) => String(b[1].released || "").localeCompare(String(a[1].released || "")))
        .map(([id, g]) => {
          const en = sets.find((x) => x.id === g.equivalent);
          return `<a class="set-card" href="/sets/${id}.html">
        <span>
          <span class="ttl">${esc(g.english)}${g.langFlag ? ` ${g.langFlag}` : ""}</span><br>
          <span class="meta">${[
            g.native ? nat(g.native, g.dataSource?.lang || g.lang) : null,
            g.cardCount?.total ? `${g.cardCount.total} cards` : null,
            g.released ? g.released.slice(0, 4) : null,
            ripsBySet[id] ? `${ripsBySet[id]} rip${ripsBySet[id] === 1 ? "" : "s"}` : null,
            en ? `= ${esc(en.name)}` : g.exclusive ? "no English version" : null,
            /* WAS .map(esc) OVER THE WHOLE ARRAY, which re-escaped the lang span
               nat() returns and printed <span lang="ja"> as visible text on 12
               cards. Every other entry here is a number, a year slice or a
               literal; the only one that ever needed escaping is the English set
               name, so it escapes itself and the markup passes through. */
          ].filter(Boolean).join(" &bull; ")}</span>
        </span>
      </a>`;
        })
        .join("\n      ")}
    </div>
  </div>
</section>` : ""}

</main>
${/* Same incomplete credit as the guides had: this page prints graded figures
      too, so the feed behind them is named here as well, from the data. */ ""}
${footer(priceFooter(`${(() => {
  const who = [...new Set(
    sets
      .filter((s) => (s.chase || [])[0]?.price && gradedPrice(s.id, s.chase[0].number, s.chase[0].name, s.name))
      .map((s) => gradedSource(s.id, s.chase[0].number, s.chase[0].name, s.name))
      .filter(Boolean)
  )];
  return who.length === 1 ? `PSA 10 prices from ${who[0]}. ` : "";
})()}Prices are estimates and move constantly.`))}
${APP_JS}
</body>
</html>
`;
}

// Clears the whole folder so a renamed or dropped set cannot leave a stale page
// behind. NOTE: the 13 non-English guides live in here too and are written by
// scripts/build-intl-pages.mjs, so that ALWAYS runs after this one. Reverse the
// order and they are deleted immediately after being built.
// AND THE COMMENT ABOVE IS NOT A GUARD, WHICH IT LOOKED LIKE FOR MONTHS. It
// tells you the ordering matters and then trusts you to keep it. An agent ran
// this builder on its own on 19 August 2026, deleted all 13 non-English guides,
// and only noticed because it happened to look; a standalone run followed by a
// commit would have removed 13 live pages with every check still green, since
// nothing downstream knows those pages were ever meant to exist.
//
// So the deletion now reports itself. Listing the folder first costs one readdir
// and turns a silent wipe into a printed line naming exactly what this run
// removed and did not put back.
const before = new Set(await readdir(OUT).catch(() => []));
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

/**
 * Drop the images.pokemontcg.io preconnect from any page that never asks that
 * host for anything.
 *
 * head() emits it unconditionally, and it has been dead on EVERY page it
 * reaches since sync-symbols.mjs mirrored the set symbols: measured 18 August
 * 2026 off the request log on /sets/ and /sets/ascended-heroes.html at 390x844
 * DPR 2, the hosts actually contacted are this origin, assets.tcgdex.net and
 * tcgplayer-cdn.tcgplayer.com. Not one request goes to images.pokemontcg.io,
 * and grep agrees: zero of the built set pages contain a url on that host.
 *
 * A preconnect is not free and an unused one is pure loss. It spends a DNS
 * lookup, a TCP handshake and a TLS negotiation, and it spends them in the
 * one window where the stylesheet and the fonts are competing for the same
 * link. build-expansions.mjs and build-what-set.mjs already gate theirs on
 * exactly this and say so in a comment; this file was the one that did not.
 *
 * The test is the url form, not the bare host: every real reference carries a
 * path, so the trailing slash distinguishes an image from the hint itself and
 * the hint comes back on its own the day a page starts using one.
 */
const dropUnusedPreconnect = (html) =>
  html.includes("images.pokemontcg.io/")
    ? html
    : html.replace('<link rel="preconnect" href="https://images.pokemontcg.io" crossorigin>\n', "");

// dropUnusedPacksCSS SITS BESIDE dropUnusedPreconnect AND IS THE SAME KIND OF
// CLEANUP: head() emits a link unconditionally and some pages never use what it
// points at. SEVEN of these pages do not. Six guides draw no packshot, because
// the whole "See it opened" band is gated on `rips` and nothing has been ripped
// out of Black Bolt, Paldean Fates, Scarlet & Violet, Shrouded Fable, Stellar
// Crown or White Flare yet, and /sets/index.html never had one. It is a
// PREDICATE ON THE FINISHED HTML rather than a second read of `rips`, so the
// stylesheet returns on its own the first time one of those sets is opened on
// camera. See the note beside it in shared/chrome.mjs.
const finish = (html) => dropUnusedPacksCSS(dropUnusedPreconnect(html));

for (const s of sets) await writeFile(join(OUT, `${s.id}.html`), finish(setPage(s)));
await writeFile(join(OUT, "index.html"), finish(indexPage()));

console.log(`
Wrote ${sets.length} set pages + index to public/sets/

  with prices:  ${sets.filter((s) => s.chase?.length).length}
  no prices:    ${sets.filter((s) => !s.chase?.length).map((s) => s.id).join(", ") || "none"}

Remember to re-run build-pages.mjs so the sitemap picks these up.
`);

// What this run deleted and did not put back. On a build-all run the answer is
// always nothing, because build-intl-pages.mjs writes the non-English guides
// immediately after. On a standalone run it is those 13 pages, and saying so is
// the difference between noticing and shipping the deletion.
const after = new Set(await readdir(OUT));
const lost = [...before].filter((f) => !after.has(f));
if (lost.length) {
  console.log(
    `  ${lost.length} page(s) were deleted and NOT rewritten by this builder:\n` +
    `    ${lost.slice(0, 6).join(", ")}${lost.length > 6 ? `, and ${lost.length - 6} more` : ""}\n` +
    `  They belong to another builder. Run node scripts/build-all.mjs before\n` +
    `  committing, or public/sets/ ships without them.`
  );
}
