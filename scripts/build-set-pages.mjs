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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { labelFor, CARD_SETS } from "../shared/taxonomy.mjs";
import { parseHits, rarityLabelOf, rarityMark, RARITY_CSS } from "../shared/rarity.mjs";
import { esc, shortDate, longDate, moneyCompact, moneyExact, rarityLabel, RARITY_ORDER, cardNumKey, imgDims, avifPicture } from "../shared/format.mjs";
import { ripLabel } from "../shared/riplabel.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Intrinsic size of each set logo, measured from the files themselves. These
// are lazy and sit below the fold, so without a reserved box the section
// reflows as each one lands.
let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* run: python3 scripts/measure-logos.py */
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
// build-logos.py then measure-logos.py, and the logo appears with no edit here.
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
const setCardLogo = (setId, alt) => {
  if (!hasLogo(setId)) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  const srcset = d
    ? ` srcset="${base}-sm.webp ${Math.round((d[0] * SM_H) / d[1])}w, ${base}.webp ${d[0]}w" sizes="110px"`
    : "";
  return `<img${logoAttrs(setId)} src="${base}${d ? "-sm" : ""}.webp"${srcset} alt="${alt}" loading="lazy" onerror="this.remove()">`;
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

let psa10 = {};
try {
  psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8")) || {};
} catch {
  /* optional */
}
// Two sources, and the person always wins. `prices` is what Tim typed through
// the spreadsheet; `auto` is what sync-prices.mjs fetched and owns. A sync must
// never overwrite a number he checked himself, so it is read second.
const gnum = (v) => (typeof v === "number" ? v : typeof v?.price === "number" ? v.price : null);
// A synced price needs enough sales behind it to mean anything. Volcarona came
// back at 15x its raw price off six recorded sales, which is an anecdote, not a
// market. Hand-entered prices skip this test: if Tim typed it, he stands
// behind it.
const MIN_SALES = 10;
const gradedPrice = (setId, number) => {
  const k = `${setId}-${number}`;
  const manual = gnum(psa10.prices?.[k]) ?? gnum(psa10[k]);
  if (manual) return manual;
  const a = psa10.auto?.[k];
  if (!a?.psa10) return null;
  if (a.psa10Sales != null && a.psa10Sales < MIN_SALES) return null;
  return a.psa10;
};
const gradedAsOf = (setId, number) => {
  const k = `${setId}-${number}`;
  return psa10.prices?.[k]?.asOf || psa10[k]?.asOf || psa10.auto?.[k]?.asOf || null;
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
// sets Tim actually rips had less detail than the ones he does not.
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
    checked: doc.checked,
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
  return `<div class="svc">
      <div class="svc-row">
        <p class="svc-k">The ${v.half} priciest card${v.half === 1 ? "" : "s"}</p>
        ${bar(cardShare)}
        <p class="svc-v">${pct(cardShare * 100)} of the ${priced} cards with a price</p>
      </div>
      <div class="svc-row">
        <p class="svc-k">What those ${v.half} are worth</p>
        ${bar(0.5)}
        <p class="svc-v">half of the ${moneyCompact(v.sum)} the whole checklist comes to</p>
      </div>
    </div>`;
}

function valueBand(s, cls) {
  const v = setValue(s);
  if (!v) return "";
  const some = v.counted === v.total ? "every card" : `each of the ${v.counted} cards that has a price`;
  return `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Where the value sits</p>
    <h2>Where the <span class="hl">money</span> is</h2>
    <p class="lede w42">Buy one copy of ${some} in ${esc(s.name)} at market price and you would spend
      ${moneyExact(v.sum)}. ${
        v.half === 1
          ? `More than half of that is a single card.`
          : `Half of it sits in ${v.half} cards.`
      } The other ${v.restCount} come to ${moneyExact(v.rest)} between them${
        v.restEach ? `, which is ${moneyExact(v.restEach)} a card` : ""
      }.</p>
    ${valueChart(v)}
    <div class="facts">
      <div class="fact"><div class="n">${moneyCompact(v.sum)}</div><div class="l">One of every card</div></div>
      <div class="fact"><div class="n">${v.half}</div><div class="l">Cards holding half the value</div></div>
      <div class="fact"><div class="n">${v.topShare}%</div><div class="l">Held by the ${v.topN} priciest</div></div>
      <div class="fact"><div class="n">${moneyExact(v.median)}</div><div class="l">The middle card</div></div>
    </div>
    <p class="lede sv-say">In plain terms: a handful of cards carry the set and everything else is bulk. That is normal,
      it is true of nearly every modern set, and it is worth knowing before you buy a box hoping to "get your money
      back".</p>
    <p class="price-note">Added up from the ${v.counted} market prices in the checklist below, read
      ${esc(longDate(v.checked) || v.checked)}. This is what buying one of each card would cost. It is not what a booster
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
          .map(
            (c) => `<li><span class="ig-no">${esc(c.n || "")}</span>
          <span class="ig-nm">${esc(c.name)}</span>
          ${c.price != null ? `<span class="ig-pr">${moneyExact(c.price)}</span>` : ""}
          ${c.rarity ? `<span class="ig-rr2">${esc(rarityLabel(c.rarity))}</span>` : ""}</li>`
          )
          .join("\n        ")}
      </ol>
    </details>
    <p class="price-note">TCGplayer market prices via TCGdex, read ${esc(longDate(doc.checked) || doc.checked)}.
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
 * checklist prices the band prints "No market prices yet" and says so.
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
  st.chasePriceSource = "TCGplayer";
  // Both stamps, because the price note reads pricesAsOf first and that date
  // described a read this list no longer uses.
  st.chasePricesAsOf = doc.checked;
  st.pricesAsOf = doc.checked;
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
// Pokemon at several rarities, the rarity Tim typed breaks the tie. If it
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
const descriptions = JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8").catch(() => "{}"));

function yearsSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
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
  const cards = items
    .map(
      (p) => `      <li class="prod">
        <a class="prod-shot" href="${esc(affLink(p.url))}" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
          ${deadImg(p.thumb) ? "" : `<img src="${esc(p.thumb)}" srcset="${esc(p.thumb)} 200w, ${esc(p.image)} 1000w"
               sizes="88px" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(p.thumb)} referrerpolicy="no-referrer">`}
        </a>
        <div class="prod-body">
          <h3><a href="${esc(affLink(p.url))}" rel="noopener" target="_blank">${esc(productLabel(p, s.released).kind)}</a></h3>
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
      `The extra ${s.secretCount} are secret rares numbered past the printed count.`
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
    out.push(
      `The chase card is <b>${esc(top.name)}</b>${top.rarity ? ` (${BOOKLET_MARK[topR] ? rarityMark(BOOKLET_MARK[topR]) : ""}${esc(topR)})` : ""}, ` +
      `sitting around <b>${moneyCompact(top.price)}</b> raw` +
      (gradedPrice(s.id, top.number)
        ? `, and <b>${moneyCompact(gradedPrice(s.id, top.number))}</b> in a PSA 10.`
        : `.`)
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
.band-sky .rar-pr{color:var(--navy)}
/* The plain-English read of the value band. Same size as a lede, set apart so
   it does not read as a third paragraph of numbers. */
.sv-say{max-width:42em;margin-top:var(--s5);border-left:4px solid var(--gold);
  padding-left:var(--s4);font-size:var(--t-body)}
/* Cost per pack. Sits directly under the total price it is derived from. */
.prod-per{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.04em;text-transform:uppercase;margin-top:3px}
.prod-per b{display:inline-block;background:var(--mustard);color:var(--ink);
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
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
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
<main id="main">
`;

// ------------------------------------------------------------------ a set
function setPage(s) {
  const url = `${SITE}/sets/${s.id}.html`;
  const logo = `/assets/logos/${s.id}-pokemon-tcg-set-logo.webp`;
  const rips = ripsBySet[s.id] || 0;
  const label = labelFor("sets", s.id);
  const desc =
    `${s.name} Pokemon TCG set guide: ${s.total || "?"} cards, released ` +
    `${longDate(s.released) || "recently"}, full rarity breakdown` +
    (s.chase?.length ? `, and the top chase cards with current market values.` : `.`);

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
        { "@type": "ListItem", position: 2, name: "Card Sets", item: `${SITE}/sets/` },
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
    (() => {
      // Newest twelve. All of them on a 90-rip set would be a wall, and the link at
      // the end covers the rest.
      const all = ripsList.get(s.id) || [];
      const show = all.slice(0, 12);
      if (!show.length) return null;
      return (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>On the channel</p>
    <h2>Every ${esc(s.name)} <span class="hl">rip</span></h2>
    <p class="lede w38">${all.length} video${all.length === 1 ? "" : "s"} opening this set${
        all.length > show.length ? `, newest ${show.length} below` : ""
      }.</p>
    <ul class="riplist">
      ${show
        .map(
          (v) => `<li><a href="/${esc(v.path)}">${esc(v.label || v.siteTitle || v.title)}</a>
        <span>${esc(shortDate(v.published))}</span></li>`,
        )
        .join("\n      ")}
    </ul>
    ${all.length > show.length ? `<p style="margin-top:var(--s3)"><a class="btn btn-ghost btn-sm" href="/videos.html?set=${esc(s.id)}">All ${all.length} ${esc(s.name)} rips</a></p>` : ""}
  </div>
</section>`;
    })(),

    (() => {
      const mine = (hitsBySet.get(s.id) || [])
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
          rips: h.path ? [{ path: h.path, label: h.label }] : [],
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
    <p class="lede w38">${priced.length + prose.length} card${priced.length + prose.length === 1 ? "" : "s"} out of our own packs. Every one of them is in a video you can watch.</p>
    ${priced.length ? `<ul class="mine-grid">
      ${priced
        .map(
          (h) => `<li class="mine${h.kind === "promo" ? " is-promo" : ""}">
        ${h.img ? avifPicture(`<img class="mine-img" src="${esc(h.img)}" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(h.img)}>`) : `<div class="mine-img is-none" aria-hidden="true"></div>`}
        <p class="mine-n">${h.name}</p>
        <p class="mine-r">${h.meta}</p>
        <p class="mine-p">${typeof h.price === "number" ? moneyExact(h.price) : "No market price"}${
            typeof h.psa10 === "number" ? ` <span class="mine-psa">${moneyExact(h.psa10)} in a 10</span>` : ""
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

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    ${s.chase?.length ? `
    <div class="chase-grid">
      ${s.chase.map((c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(c.name)}" data-rarity="${esc(rarityLabel(c.rarity) || "")}"
        data-number="${esc(c.number)}" data-price="${esc(moneyCompact(c.price))}"
        data-psa10="${esc(gradedPrice(s.id, c.number) ? moneyCompact(gradedPrice(s.id, c.number)) : "")}"
        data-url="${esc(c.url ? affLink(c.url) : "")}"
        aria-label="Enlarge ${esc(c.name)}">
        ${c.image ? avifPicture(`<img src="${c.image}" alt="${esc(c.name)} ${esc(c.number)}, ${esc(rarityLabel(c.rarity) || "card")}" loading="lazy" onerror="this.remove()"${imgDims(c.image)}>`) : ""}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(rarityLabel(c.rarity) || "")} &bull; ${esc(c.number)}</div>
        <div class="pr">${moneyCompact(c.price)}</div>
        ${gradedPrice(s.id, c.number)
          ? `<div class="pr10">PSA 10 ${moneyCompact(gradedPrice(s.id, c.number))}${
              // longDate, not the raw ISO string the price file stores. Every other date
              // on this page is long form, including the "last updated" line directly
              // under this grid, so a bare 2026-08-12 here read as a different site.
              gradedAsOf(s.id, c.number) ? `<span> &bull; ${esc(longDate(gradedAsOf(s.id, c.number)))}</span>` : ""
            }</div>`
          : ""}
      </button>`).join("\n      ")}
    </div>
    <p class="price-note">TCGplayer market prices via TCGdex${longDate(s.pricesAsOf || s.chasePricesAsOf) ? `, read ${longDate(s.pricesAsOf || s.chasePricesAsOf)}` : ""}. These are the same eight rows the checklist further down prints, sorted by price, so the two agree by construction. Singles move fast, so treat them as a ballpark rather than a quote.${affOn ? ` ${esc(aff.tcgplayer.disclosure)}` : ""}</p>
    ` : `
    <div class="no-prices">
      <strong>No market prices yet.</strong> ${esc(s.name)} is recent enough that pricing data has not landed in the card database. The card list and rarity counts above are accurate; the values will fill in as the market settles.
    </div>`}
  </div>
</section>`,

    setValue(s) ? (cls) => valueBand(s, cls) : null,

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
    </ul>
  </div>
</section>` },

    (cls) => `<section class="${cls}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${ordered.length ? `${rarPr.size ? `<p class="lede w42">How many cards sit at each rarity, and what those
      cards are worth. <b>Mid</b> is the middle card at that rarity: half of them cost more than that and half cost
      less, which is a far better guide to what you will actually see than the one famous card at the top.</p>` : ""}
    <div class="rarity-list">
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
      booklet that ships inside a modern set. The colour carries as much of the meaning as the count: two silver
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

  return head({ title: setTitle(s.name), desc, canonical: url, image: `${SITE}/assets/${ogCards.has(s.id) ? `og-${s.id}` : "og-image"}.jpg?v=2`, ld, css: PAGE_CSS }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    ${hasLogo(s.id) ? `<img class="logo-big"${logoAttrs(s.id)} src="${logo}" alt="" onerror="this.remove()">` : ""}
    <h1>${esc(s.name)}</h1>
    <p class="lede w34">Everything worth knowing about ${esc(s.name)} in one screen. Card counts, what is actually rare, and what the chase cards are going for.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/sets/">Card sets</a> / ${esc(s.name)}</p>

    <div class="facts">
      <div class="fact"><div class="n">${s.total ?? "?"}</div><div class="l">Cards total</div></div>
      <div class="fact"><div class="n">${s.printedTotal ?? "?"}</div><div class="l">In the printed set</div></div>
      <div class="fact"><div class="n">${s.secretCount ?? "?"}</div><div class="l">Secret rares</div></div>
      ${rips
        ? `<a class="fact fact-link" href="/videos.html?set=${s.id}"><div class="n">${rips}</div><div class="l">Rip${rips === 1 ? "" : "s"} on this channel <span aria-hidden="true">&rarr;</span></div></a>`
        : `<div class="fact"><div class="n">-</div><div class="l">Rips on this channel</div></div>`}
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${longDate(s.released) || "Unknown"}</div><div class="l">Release date${s.released ? ` &bull; ${yearsSince(s.released)}` : ""}</div></div>
    </div>
${(() => {
  // The pack price was waiting on a human and did not need to be. Every one of
  // the 23 sets already carries a live TCGplayer "Single Pack" market price
  // through sync-products.mjs, and the SAME figure is already printed further
  // down this page in the "What you can buy" band, so surfacing it up here adds
  // no claim the page was not already making. data/set-notes.json held nothing
  // but its readme, so this tile was hidden on all 23 sets while the number sat
  // in the data.
  //
  // A hand-written note still wins: someone who has actually stood in a shop
  // knows something TCGplayer does not.
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
  if (!s.notes?.inPrint && !packPrice) return "";
  return `
    <div class="facts" style="margin-top:12px">
      ${s.notes?.inPrint ? `<div class="fact"><div class="n" style="font-size:1.1rem">${esc(s.notes.inPrint)}</div><div class="l">Still in print?</div></div>` : ""}
      ${packPrice ? `<div class="fact"><div class="n">${esc(packPrice)}</div><div class="l">${esc(packFrom)}</div></div>` : ""}
    </div>`;
})()}
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
${footer("Card data from TCGdex, prices from TCGplayer. Prices are estimates and move constantly.")}
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
        { "@type": "ListItem", position: 2, name: "Card Sets" },
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
  return head({ title: `Pokemon TCG Set Guides: Cards, Rarities & Chase Values | Garbage Rips 585`, desc, canonical: url, image: `${SITE}/assets/og-image.jpg?v=2`, ld, css: PAGE_CSS }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>Card <span class="hl">sets</span></h1>
    ${/* "we cover", not "we rip". Eight of the sets listed below have a guide
          and no rip on them, which the "N rips" line on each card says out
          loud, so the lede was contradicted by the grid under it. */ ""}
    <p class="lede w34">Every set we cover, boiled down to the facts that matter. Card counts, what is genuinely rare, and what the chase cards cost.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Card sets</p>
    <div class="set-index">
      ${sets.map((s) => `<a class="set-card" href="/sets/${s.id}.html">
        ${setCardLogo(s.id, `${esc(s.name)} logo`)}
        <span>
          <span class="ttl">${esc(s.name)}</span><br>
          <span class="meta">${s.total ?? "?"} cards${s.released ? ` &bull; ${s.released.slice(0, 4)}` : ""}${ripsBySet[s.id] ? ` &bull; ${ripsBySet[s.id]} rip${ripsBySet[s.id] === 1 ? "" : "s"}` : ""}${(s.chase || [])[0]?.price ? ` &bull; top ${moneyCompact(s.chase[0].price)}${gradedPrice(s.id, s.chase[0].number) ? ` / ${moneyCompact(gradedPrice(s.id, s.chase[0].number))} PSA 10` : ""}` : ""}</span>
        </span>
      </a>`).join("\n      ")}
    </div>
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
            g.native || null,
            g.cardCount?.total ? `${g.cardCount.total} cards` : null,
            g.released ? g.released.slice(0, 4) : null,
            ripsBySet[id] ? `${ripsBySet[id]} rip${ripsBySet[id] === 1 ? "" : "s"}` : null,
            en ? `= ${en.name}` : g.exclusive ? "no English version" : null,
          ].filter(Boolean).map(esc).join(" &bull; ")}</span>
        </span>
      </a>`;
        })
        .join("\n      ")}
    </div>
  </div>
</section>` : ""}

</main>
${footer("Card data from TCGdex, prices from TCGplayer. Prices are estimates and move constantly.")}
${APP_JS}
</body>
</html>
`;
}

// Clears the whole folder so a renamed or dropped set cannot leave a stale page
// behind. NOTE: the 13 non-English guides live in here too and are written by
// scripts/build-intl-pages.mjs, so that ALWAYS runs after this one. Reverse the
// order and they are deleted immediately after being built.
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const s of sets) await writeFile(join(OUT, `${s.id}.html`), setPage(s));
await writeFile(join(OUT, "index.html"), indexPage());

console.log(`
Wrote ${sets.length} set pages + index to public/sets/

  with prices:  ${sets.filter((s) => s.chase?.length).length}
  no prices:    ${sets.filter((s) => !s.chase?.length).map((s) => s.id).join(", ") || "none"}

Remember to re-run build-pages.mjs so the sitemap picks these up.
`);
