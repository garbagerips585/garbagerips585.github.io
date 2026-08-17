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
import { APP_JS } from "../shared/chrome.mjs";
import { esc, shortDate, moneyCompact, imgDims, avifPicture, rarityLabel } from "../shared/format.mjs";

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

/* --------------------------------------------- rarity, from the checklist --
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
 */
const rarities = new Map();
for (const c of cards) {
  if (!c.set || !c.number) continue;
  if (!rarities.has(c.set)) {
    try {
      rarities.set(
        c.set,
        JSON.parse(await readFile(join(ROOT, `public/data/cards/${c.set}.json`), "utf8")).cards
      );
    } catch {
      rarities.set(c.set, null);
    }
  }
  const m = (rarities.get(c.set) || []).find((x) => String(x.n) === String(c.number));
  c.rarity = rarityLabel(m?.rarity || c.rarity) || null;
}

const hunting = cards.filter((c) => !c.got);
const caught = cards.filter((c) => c.got);

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
function cardArt(c) {
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
      `<img src="${esc(one)}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()"${imgDims(one)}>`
    );
  }
  const scryMid = /images\.scrydex\.com/.test(large) ? large.replace(/\/large$/, "/medium") : null;
  const webp = [`${small} 245w`, ...local("webp"), scryMid ? `${scryMid} 365w` : null, `${large} ${LARGE_W(large)}w`]
    .filter(Boolean)
    .join(", ");
  const tag =
    `<img src="${esc(small)}" srcset="${esc(webp)}" sizes="${esc(ART_SIZES)}" alt="${esc(alt)}"` +
    ` loading="lazy" onerror="this.remove()"${imgDims(small)}>`;
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

function cardTile(c, { hunted = true } = {}) {
  // The SMALL file is the src now, so a browser that ignores srcset gets the
  // 68KB one rather than the 1.2MB one.
  const art = cardArt(c);
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
  return c.url
    ? `      <a class="wc" href="${esc(c.url)}" rel="nofollow noopener" target="_blank">${inner}
      </a>`
    : `      <div class="wc">${inner}
      </div>`;
}

// The NEWEST date, not whichever card happens to sort first: with card A
// checked in January and card B in August, "find" claimed every price on the
// page was last checked in January.
const asOf = cards.map((c) => c.psa10AsOf).filter(Boolean).sort().pop() || null;
const anyPsa = cards.some((c) => c.psa10);

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
  overflow:hidden;background:#E8E4D6;margin-bottom:var(--s2)}
.wc-art img{width:100%;height:100%;object-fit:contain}
.wc-none{position:absolute;inset:0;display:grid;place-items:center;padding:12%;
  font:400 .9rem/1.25 var(--display);color:var(--ink-2);text-align:center}
.wc-flag{position:absolute;left:0;bottom:10px;z-index:2;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--ketchup-deep);color:#fff;padding:5px 7px;border-radius:0 4px 4px 0}
.wc-flag.wc-got{background:#2F7A4A}
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
`;

const body = `
<main id="main" class="wanted">
  <div class="wrap">
    <div class="brk"><h1>Most <span class="hl">wanted</span></h1><span class="ln"></span>
      <a href="/sets/">All ${guideCount} set guides &rarr;</a></div>
    <p class="w-lede">The cards I am actually chasing right now. Every pack opened on this
      channel is opened hoping for one of these. Tap a card to see it on TCGplayer.</p>
    <div class="w-grid">
${hunting.map((c) => cardTile(c)).join("\n")}
${caught.map((c) => cardTile(c, { hunted: false })).join("\n")}
    </div>
    <p class="price-note">RAW PRICES ARE TCGPLAYER MARKET VALUES READ THROUGH TCGDEX${
      rawAsOf ? `, LAST CHECKED ${shortDate(rawAsOf).toUpperCase()}` : ""
    }. THEY ARE THE SAME FIGURES THE SET GUIDES AND THE CHECKLISTS PRINT, AND THEY MOVE ON THEIR OWN.${
      anyUnpriced
        ? ` A SET THIS NEW SOMETIMES HAS NO MARKET PRICE YET, AND WE SHOW NOTHING RATHER THAN A ZERO.`
        : ""
    }${
        anyPsa
          ? `<br>PSA 10 PRICES COME FROM GRADED SALES DATA${asOf ? `, LAST CHECKED ${shortDate(asOf).toUpperCase()}` : ""}, AND ARE NOT PART OF THE TCGPLAYER FEED.`
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

await writeFile(join(ROOT, "public/wanted.html"), html);
console.log(`Wrote public/wanted.html
  hunting: ${hunting.length}${caught.length ? `, caught: ${caught.length}` : ""}
  with a raw price:    ${cards.filter((c) => c.raw).length} of ${cards.length}
  with a PSA 10 price: ${cards.filter((c) => c.psa10).length} of ${cards.length}
`);
