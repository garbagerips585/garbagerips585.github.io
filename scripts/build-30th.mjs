#!/usr/bin/env node
// /30th-celebration.html -- the set guide for Pokemon TCG: 30th Celebration,
// plus the owner's own master set tracked as a nine pocket binder.
//
//   node scripts/build-30th.mjs
//
// Reads data/30th.json (facts, products, Japan's card list) and
// data/30th-binder.json (what the owner actually owns). Both are hand
// maintained and both carry their own readme; read those before editing
// anything here, because the rules about what may be printed as a fact live in
// them and not in this file.
//
// WHY THIS PAGE EXISTS SEPARATELY FROM /sets/ AND FROM /upcoming.html.
// /upcoming.html answers "what is coming and when" for every set at once, and
// deletes a set the day it ships -- its own readme says so. /sets/<slug>.html
// is generated from TCGdex and cannot exist for a set TCGdex has never heard
// of; checked 11 September 2026 and the API's 218 sets include the 2021
// Celebrations and nothing for 2026. So on the day the owner asked for this,
// the set had no guide page, could not have one, and was five days out.
//
// AND THE MASTER SET IS THE PART NEITHER OF THOSE COULD EVER DO. It is one
// person's binder, which is not a fact about the set and does not belong in a
// generated set guide.
//
// NO BROWSER STORAGE, AND THAT IS THE DESIGN RATHER THAN A LIMITATION. The
// owner's ask was a tracker he fills in by listing cards after a video. A
// localStorage tracker would have been fewer moving parts and would have been
// worse: one browser on one device, gone the first time site data is cleared,
// unreadable on his phone, and invisible to search. A committed JSON file
// rendered at build time is none of those things. See data/30th-binder.json.
//
// WHAT THIS PAGE MAY NOT DO, AND THE REASON IT KEEPS COMING UP HERE. The set
// leaked months early, so there is more confident wrong information about it
// than about any other set on the site. TPCi has published NO card count:
// checked against pokemon.com's product showcase and both press releases
// (1 June, 30 June 2026). Every total here is PokeBeach's, is attributed on
// the page in words, and the English card NAMES are not published at all --
// PokeBeach's own English gallery is images numbered to 158 with four blanks
// and no names anywhere. So this page prints Japan's list, labeled as Japan's,
// and does not invent an English one by mapping the numbers across: English has
// 128 main set cards to Japan's 103, so the numbering demonstrably does not
// line up and a mapped list would be fiction with a source attached.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { localDay } from "../shared/today.mjs";
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
import { esc, longDate, shortDate, clipMeta, imgDims, avifPicture, moneyExact, moneyRound } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATH = "/30th-celebration.html";

const doc = JSON.parse(await readFile(join(ROOT, "data/30th.json"), "utf8"));
const binder = JSON.parse(await readFile(join(ROOT, "data/30th-binder.json"), "utf8"));
// Real intrinsic sizes for the owner's own card photographs, written by
// scripts/build-30th-cards.py. Absent before that script has ever run, in which
// case the pictures are declared without dimensions rather than not drawn.
let shotDims = {};
try {
  shotDims = JSON.parse(await readFile(join(ROOT, "data/30th-card-dims.json"), "utf8"));
} catch {}
/* WHO DREW EACH CARD, from scripts/sync-30th-illustrators.mjs (TCGdex). Keyed
   by TCGdex localId, so it answers for the same three sections TCGdex draws
   pictures for and is silent for the Classic Collection and the Energy. */
let ILLUS = {};
try {
  ILLUS = JSON.parse(await readFile(join(ROOT, "data/30th-illustrators.json"), "utf8")).cards || {};
} catch {}
const owned = binder.owned || [];
/* PROMOS ARE COUNTED SEPARATELY AND NEVER ADDED TO `owned`. See the
   `_promoNote` in data/30th-binder.json: the five sections add to 199 because
   that is what the set is, and a promo is in none of them, so counting one
   would make the percentage in the hero wrong. */
const promos = binder.promos || [];
const PROMO_CELLS = (() => {
  const mine = new Map(promos.map((o) => [Number(o.n), o]));
  const nums = new Set([...mine.keys(), ...((doc.promosToFind || {}).rows || []).map((r) => Number(r.n))]);
  return [...nums].sort((a, b) => a - b).map((n) => {
    const o = mine.get(n);
    if (o) return { has: true, owned: o, slot: null, promo: true };
    const r = doc.promosToFind.rows.find((x) => Number(x.n) === n);
    return { has: false, owned: null, promo: true,
      slot: { name: r.name, n: String(r.n).padStart(3, "0"), section: "promo", setCode: "MEP", pid: r.pid || null } };
  });
})();
/* JUMBOS ARE A THIRD LIST AND NOT A SIXTH SECTION, same reason as the promos and
   spelled out in `_jumboNote`: the five sections add to 199 because that is the
   SET, and an oversized card is in none of them. It is also deliberately not
   folded in with the promos, because a jumbo is a physical FORMAT and a Black
   Star Promo is a distribution channel -- the owner's Greninja ex is both, as
   two separate objects, which is the case that proves they cannot share a list. */
const jumbos = binder.jumbos || [];

/* THE SET'S OWN LOGO IN THE HERO. The owner sent the artwork on 16 September
 * 2026 -- "30th logo now in the downloads folder" -- which closes the one gap
 * this page had carried since it was built: the logo could not be obtained
 * before then, because press.pokemon.com's CDN 404s a non-browser request and
 * only exposed a 240x81 thumbnail.
 *
 * IT GOES THROUGH scripts/build-logos.py LIKE EVERY OTHER SET LOGO, dropped in
 * assets-source/logos/ named by the set's slug, which that script's own header
 * describes as the whole interface: "adding a set is just dropping a file in
 * here". It crops to the alpha box and writes three heights in WebP and AVIF,
 * so nothing is special-cased for this file.
 *
 * SIZES IS THE CSS CLAMP TIMES THE ASPECT, not a guess. `.t30-logo` is
 * `height:clamp(56px,17vw,110px);width:auto`, so the WIDTH the browser needs is
 * the height times 544/300. Getting this wrong is the documented oversizing
 * trap in build-logos.py, where /sets/ shipped 937KB of logo into 110px boxes.
 *
 * AND THE AVIF SOURCE IS CONDITIONAL. build-logos.py drops an AVIF whenever the
 * WebP came out smaller, and a <picture> that has committed to a <source> does
 * not fall back to the <img> -- it paints a broken image. That is the exact bug
 * shared/logo-srcset.mjs exists to end, in three other builders. So every
 * rendition is checked on disk and the source is offered only if all of them
 * have one. */
const LOGO_STEM = `${doc.set.slug}-pokemon-tcg-set-logo`;
const logoDims = await readFile(join(ROOT, "data/logo-dims.json"), "utf8")
  .then((t) => JSON.parse(t)[`${LOGO_STEM}.webp`] || null)
  .catch(() => null);
const heroLogo = () => {
  const base = `/assets/logos/${LOGO_STEM}`;
  const master = join(ROOT, "public", `assets/logos/${LOGO_STEM}.webp`);
  if (!logoDims || !existsSync(master)) return "";
  const [mw, mh] = logoDims;
  const aspect = mw / mh;
  const cands = [[100, "-sm"], [150, "-md"], [mh, ""]]
    .filter(([, sfx]) => sfx === "" || existsSync(join(ROOT, "public", `assets/logos/${LOGO_STEM}${sfx}.webp`)))
    .map(([h, sfx]) => ({ w: Math.max(1, Math.round((mw * h) / mh)), sfx }))
    .filter((c, i, a) => a.findIndex((x) => x.w === c.w) === i);
  const px = (n) => Math.round(n * 10) / 10;
  const sizes =
    `(max-width:329px) ${px(56 * aspect)}px, ` +
    `(max-width:647px) ${px(17 * aspect)}vw, ${px(110 * aspect)}px`;
  const img =
    `<img class="t30-logo" src="${base}.webp" width="${mw}" height="${mh}"` +
    ` srcset="${cands.map((c) => `${base}${c.sfx}.webp ${c.w}w`).join(", ")}" sizes="${sizes}"` +
    ` alt="" onerror="this.remove()">`;
  const allAvif = cands.every((c) => existsSync(join(ROOT, "public", `assets/logos/${LOGO_STEM}${c.sfx}.avif`)));
  if (!allAvif) return img;
  return `<picture><source type="image/avif" srcset="${
    cands.map((c) => `${base}${c.sfx}.avif ${c.w}w`).join(", ")
  }" sizes="${sizes}">${img}</picture>`;
};
/* THE ENGLISH CHECKLIST, written by scripts/sync-30th-tcgplayer.mjs. Absent
   before that has ever run, in which case the pockets draw as numbers exactly
   as they did before it existed. See that script's header for why TCGplayer is
   the source and why this retires itself once TCGdex holds the set. */
let checklist = { cards: [] };
try {
  checklist = JSON.parse(await readFile(join(ROOT, "data/30th-checklist.json"), "utf8"));
} catch {}

// THE FIVE BINDER SECTIONS AND WHERE THE NUMBERS COME FROM. PokeBeach's English
// breakdown is 128 main / 33 secret / 30 Classic / 8 Energy = 199, and the 30
// Pikachu are PART of the 128. They get their own section here anyway, because
// one is guaranteed in every pack and they are the subset a master set lives or
// dies on, so `main` below is the 98 that are not Pikachu. 98+30+33+30+8 = 199,
// which is the same 199 and not a second opinion about it.
const E = doc.structure.english;
/* THE SECRET RARES NOTHING LISTS. See data/30th.json's `unlistedSecrets` readme:
   PokeBeach counts 33 secret rares, the checklist holds 30, and these three Mew
   are the difference. They are why the secret section's caption must not claim
   the shortfall is unrevealed cards -- they were revealed on 15 September, they
   are simply unacknowledged by TPCi and listed by nobody, so there is no product
   id to draw a picture from. */
const US = doc.unlistedSecrets || {};
/* THEY HAVE A POCKET NOW, 23 September 2026. TCGplayer lists all three (ids
   717607-717609, each scan opened and checked: red, green and blue Mew with the
   RGB number), so they join the checklist here, once, and the binder, the
   checklist band and the "still to find" lists all take them from the same
   rows. No price is attached: PriceCharting's figures moved between two reads
   the same afternoon, which is not publishable on this site (see the blurb). */
for (const c of US.cards || []) {
  if (!c.pid) continue;
  if ((checklist.cards || []).some((r) => r.section === "secret" && r.n === c.n)) continue;
  (checklist.cards ||= []).push({ section: "secret", n: c.n, name: c.name, rarity: "Secret Rare (RGB)", pid: c.pid });
}
const US_POCKETED = (US.cards || []).every((c) => c.pid);
/* PRICECHARTING'S GUIDE VALUES, written by scripts/sync-30th-prices.mjs. The
   same source every other set guide on this site prints, which is the whole
   reason that script exists: the normal chain is keyed on TCGdex sets and
   TCGdex has never held this one. Absent before it has run, in which case the
   value bands simply do not render. */
/* WHAT THE CHANNEL HAS ACTUALLY PULLED FROM THIS SET, which every generated set
   guide carries as "Pulled on camera" and this page could not until the hits
   resolved to pictures. Read from the same data/hits.json the rip pages use, so
   the two can never disagree about what came out of a pack. */
let HITS = {};
let VIDS = [];
try {
  HITS = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
  VIDS = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8")).videos || [];
} catch {}
let prices = { cards: {} };
try {
  prices = JSON.parse(await readFile(join(ROOT, "data/30th-prices.json"), "utf8"));
} catch {}
const PRICE = new Map(Object.entries(prices.cards || {}));
const priceOf = (c) => PRICE.get(`${c.section}|${c.n}`) || null;
/* EVERY PRICED CARD, DEAREST FIRST. `raw` is PriceCharting's Ungraded figure,
   which other pages on this site call raw NM. Sorting on raw and NOT on psa10
   is build-pages.mjs's own recorded rule: a graded figure is a different number
   about a different object, and ranking a set by it puts the cards somebody
   happened to grade at the top. */
const pricedCards = (checklist.cards || [])
  .map((c) => ({ ...c, pr: priceOf(c) }))
  .filter((c) => c.pr && typeof c.pr.raw === "number")
  .sort((a, b) => b.pr.raw - a.pr.raw);
const SECTIONS = [
  ["pikachu", "The 30 Pikachu", E.pikachu, "One in every pack, each by a different illustrator. Japan's first is Ken Sugimori redrawing his own Jungle Pikachu."],
  ["main", "Main set", E.main - E.pikachu, "Everything else in the numbered main set."],
  ["secret", "Secret rares", E.secret, `Illustration rares, special illustration rares, and the two Futuristic rares.${
    US.count && !US_POCKETED
      ? ` ${US.count} of them have no pocket here: ${US.blurb}`
      : US.count ? ` The last ${US.count} are the RGB Mews. ${US.blurb}` : ""
  }`],
  ["classic", "Classic Collection", E.classic, "Reprints on gold bordered sparkle foil, numbered outside the main set. Not Standard legal."],
  ["energy", "Basic Energy", E.energy, "All eight are foil and all eight count. One comes in every pack."],
];
const TOTAL = SECTIONS.reduce((a, [, , n]) => a + n, 0);

const ownedIn = (key) => owned.filter((c) => c.section === key);
const haveTotal = owned.length;
const pct = TOTAL ? Math.round((haveTotal / TOTAL) * 100) : 0;

// ---------------------------------------------------------------------------
// THE BINDER
// ---------------------------------------------------------------------------
// Nine pockets to a page, because the set's own Binder Collection product is a
// nine pocket portfolio and this is meant to read as that object. An owned card
// fills a pocket; the rest of the section draws as empty pockets so the gap is
// the thing you see, which is the entire point of a master set tracker.
//
// EMPTY POCKETS ARE CAPPED AT ONE PAGE PAST THE LAST OWNED CARD. Drawing all
// 199 gives 23 binder pages of identical empty squares on a phone, which is
// 1,800 DOM nodes saying one sentence. The count is in the heading and in the
// bar; the pockets show the shape.
const POCKETS = 9;

// THE PICTURES, AND THE ONE FIELD THAT TURNS THEM ON. The owner asked for every
// card shown and the ones he does not own yet grayed out, "so you can see what
// cards we still need to collect". That needs 199 card scans, and on 11
// September 2026 they did not exist in any source this site may use: TCGdex has
// no 2026 anniversary set, and PokeBeach's English gallery is images with no
// names attached. So the mechanism is built and `tcgdex.set` is null, which
// draws numbered placeholders. Fill in the two ids after release and every
// pocket draws its card with no other edit.
/* THE NEWEST DATE ANY SOURCE THIS PAGE READS WAS CHECKED.
   doc.checked is when the FACTS block was last reviewed -- 11 September -- and
   it was being published as dateModified in the JSON-LD and as "Set facts read"
   in the footer while the page carried a checklist from the 16th, prices from
   the 16th, a binder from the 17th and a TCGdex switch from the 18th. A
   dateModified is a machine-readable claim to a search engine that nothing has
   changed since; it was a week wrong. The facts line still credits doc.checked,
   because that IS when the facts were read -- only the page-level stamp moves. */
const PAGE_CHECKED = [
  doc.checked,
  doc.tcgdex && doc.tcgdex.checked,
  checklist.checked,
  prices.checked,
  binder.checked,
].filter(Boolean).sort().pop();

const TD = doc.tcgdex || {};
/* TCGDEX IS STILL THE PREFERRED SOURCE AND STILL ANSWERS FIRST. Filling in the
   two ids in data/30th.json moves every pocket onto it and the TCGplayer tier
   below goes quiet without an edit. */
const HAVE_DEX = Boolean(TD.series && TD.set);

/* THE CHECKLIST, INDEXED THE WAY A POCKET ASKS FOR IT.
 *
 * THE KEY IS NOT THE SAME SHAPE IN EVERY SECTION AND THAT IS NOT TIDINESS.
 * The numbered sections are unique on their numerator -- 099/128 is the only
 * 99 there is -- and the owner types those as bare padded numbers ("099") in
 * data/30th-binder.json, so they have to meet on the numerator or they never
 * meet at all. The CLASSIC COLLECTION CANNOT DO THAT: its cards are reprints
 * that KEEP THEIR ORIGINAL numbering, so it holds 11/101 AND 11/113, and
 * 106/160, 106/106 AND 106/105. Counted out of the file, not guessed at: two
 * cards collide on 11 and three on 106. Keying that section on the numerator
 * would have put Metagross in Genesect's pocket and shown two of the three
 * 106s as the same card, which looks right and is the worst kind of wrong. */
const clKey = (section, n) =>
  section === "classic"
    ? `classic|${String(n)}`
    : `${section}|${String(n).split("/")[0].replace(/^0+/, "") || "0"}`;
const CHECKLIST = new Map();
for (const c of checklist.cards || []) CHECKLIST.set(clKey(c.section, c.n), c);
const HAVE_SCANS = HAVE_DEX || CHECKLIST.size > 0;

/* HOW MANY POCKETS EACH SOURCE ACTUALLY DRAWS, for the note under the binder.
   COMPUTED, AND THE FIRST VERSION OF THIS PRINTED THE WRONG NUMBER by using
   CHECKLIST.size for the hotlinked count. Two of the checklist's cards are
   cards the owner owns AND has photographed, so they render as his photograph
   and not as a hotlink: the hotlinked figure is the checklist MINUS those, or
   the note credits TCGplayer for pictures it did not supply. */

// LOCALID IS ZERO PADDED AND THAT COST A TEST RUN. TCGdex's own checklist for
// these sets gives "001", not "1", and api.tcgdex.net/v2/en/sets/me02.5 returns
// its sample image url as .../me02.5/001. Passing a bare number builds a url
// that 404s, and because the pockets are lazy and the CDN was separately
// unhealthy at the time, it looked exactly like a loading problem.
// WHEN THE REAL CHECKLIST IS WIRED UP, PASS ITS localId STRING STRAIGHT THROUGH
// rather than padding here: a future set could pad to a different width, and the
// checklist always holds the true value. The pad below is for the owner's own
// typed numbers in data/30th-binder.json, which are plain integers.
const padId = (id) => (/^\d+$/.test(String(id)) ? String(id).padStart(3, "0") : String(id));
const scanBase = (localId) =>
  `https://assets.tcgdex.net/${TD.lang || "en"}/${TD.series}/${TD.set}/${padId(localId)}`;

// GRAYING OUT IS A CSS FILTER AND THAT IS THE WHOLE POINT OF DOING IT THIS WAY.
// A desaturated COPY of each card would be 199 derivative images to generate,
// store and keep in step; `filter:grayscale()` is a display effect on the same
// hotlinked file every other card image on this site already uses, so owning a
// card changes one class name and nothing is ever rewritten.
//
// TWO RUNGS, AND THE DPR 3 ARITHMETIC IS WHY. TCGdex serves exactly two widths,
// 245 and 600. A pocket is about 104px at 375 and 163px at the grid's 520px cap,
// so DPR 1 and DPR 2 are covered by 245 (208 needed at worst) and DPR 3 wants
// 312 to 489, which only 600 covers. Both are offered rather than picking one:
// capping the pocket at 81px would let 245 cover every density and is too small
// to recognise a card in, which is the job. Every one is lazy, and 199 lazy card
// scans is the same shape as /topps-card-values.html's 200.
// THE OWNER'S OWN PHOTOGRAPH OF A CARD HE OWNS, preferred over a scan wherever
// there is one. Same two rungs as the TCGdex ladder below so a pocket resolves
// through identical arithmetic whichever kind of picture it holds.
/* THE sizes EVERY CARD PICTURE DEFAULTS TO, a binder pocket's. The value and
   hit tiles are drawn two to three times larger than a pocket on a desktop and
   pass their own, or a DPR 1 laptop would stretch the 245w file across 240px. */
const SIZES = "(max-width:544px) 30vw, 163px";
const shotImg = (stem, name, sizes = SIZES) => {
  const d = shotDims[`${stem}.webp`];
  const img =
    `<img class="t30-card" src="/assets/30th-cards/${stem}.webp" ` +
    `srcset="/assets/30th-cards/${stem}-sm.webp 245w, /assets/30th-cards/${stem}-md.webp 380w, ` +
    `/assets/30th-cards/${stem}.webp 600w" ` +
    `sizes="${sizes}" ` +
    `alt="${esc(name)}, photographed by Garbage Rips 585" loading="lazy" decoding="async" onload="t30l(this)" onerror="t30e(this)"` +
    (d ? ` width="${d[0]}" height="${d[1]}"` : "") +
    `>`;
  return avifPicture(img);
};

/* A CARD PICTURE FROM TCGPLAYER, for the whole window where TCGdex has no set.
 *
 * TWO RUNGS, 200w AND 400w, AND THE LADDER WAS MEASURED RATHER THAN CHOSEN.
 * tcgplayer-cdn serves _200w at 13.9KB and _400w at 43.5KB; _300w, _500w and
 * _1000w all answer 403, so there is nothing between them and nothing above.
 * A pocket is about 104px at 375 and 163px at the grid's 520px cap, so 200w
 * covers DPR 1 and 400w covers DPR 2 and DPR 3 on a phone (312 needed at
 * worst). A DPR 3 DESKTOP wants 489 and gets 400, which is the one soft case
 * and the rare one -- the same trade the TCGdex ladder makes in the other
 * direction. _in_1000x1000 exists at 100.5KB and is deliberately NOT offered:
 * a browser at DPR 2 would pick it for all 188 pockets, which is 19MB of
 * binder against 8.2MB for 400w.
 *
 * NO WIDTH OR HEIGHT, AND FOR ONCE THAT COSTS NOTHING. .t30-card is
 * `position:absolute;inset:0;width:100%;height:100%;object-fit:cover`, so the
 * pocket defines the box and the image cannot shift it. The renditions are
 * card shaped anyway and not padded, which was worth checking because
 * data/card-shots.json's note about this host padding to a fixed canvas is
 * about its _in_ renditions: every _200w sampled across all four sections is
 * exactly 200x279, a ratio of 0.717 against a real card's 0.714. */
const tcgpBase = (pid) => `https://tcgplayer-cdn.tcgplayer.com/product/${pid}`;
const tcgpImg = (pid, name, low = false, sizes = SIZES) =>
  `<img class="t30-card" src="${tcgpBase(pid)}_200w.jpg" ` +
  /* A GREY POCKET TAKES THE SMALL FILE ONLY (\`low\`), 23 September 2026. It is
     drawn greyscaled at 78% opacity, so the 400w file bought nothing a reader
     can see, and at DPR 3 it was 470KB per Classic page turn on a phone. */
  (low ? "" : `srcset="${tcgpBase(pid)}_200w.jpg 200w, ${tcgpBase(pid)}_400w.jpg 400w" ` +
  `sizes="${sizes}" `) +
  /* WIDTH AND HEIGHT, WHICH THIS USED TO OMIT ON PURPOSE AND SHOULD NOT HAVE.
     The reasoning was imgDims()'s rule that tcgplayer-cdn pads to a fixed
     canvas -- true of its _in_ renditions, NOT of _200w, which is exactly
     200x279 on every card sampled across all four sections. In a binder pocket
     it cost nothing because .t30-pk reserves the box with aspect-ratio; in a
     .t30-ct tile the image is height:auto, so 30 Classic Collection tiles were
     0px tall until they loaded. The Classic section is 100% TCGplayer, so that
     is a whole 30-tile grid shifting down as it fills in.
     onerror, BECAUSE EVERY OTHER CARD IMAGE ON THIS SITE HAS ONE. data/no-scan
     .json's readme rests the site's whole graceful-failure story on it: a
     withdrawn image removes itself instead of painting a broken glyph. This
     page had 393 images and one onerror, on the logo. */
  `alt="${esc(name)}" loading="lazy" decoding="async" width="200" height="279" ` +
  `onload="t30l(this)" onerror="t30e(this)">`;

const cardImg = (localId, name, low = false, sizes = SIZES) => {
  const url = `${scanBase(localId)}/low.webp`;
  const d = imgDims(url);
  const img =
    `<img class="t30-card" src="${url}" ` +
    /* 245w only on a grey pocket, same reason as tcgpImg's \`low\`: about 94%
       of what a DPR 3 pocket asks for, drawn greyscale, at under half the bytes. */
    (low ? "" : `srcset="${scanBase(localId)}/low.webp 245w, ${scanBase(localId)}/high.webp 600w" ` +
    `sizes="${sizes}" `) +
    /* alt="" ON PURPOSE -- see the note above pictureFor. The pocket carries the
       card name as its own accessible name and 62 of them print it visibly as
       well, so an alt here made a screen reader say it two or three times. */
    `alt="" loading="lazy" decoding="async"${d ? " " + d : ""} onload="t30l(this)" onerror="t30e(this)">`;
  return avifPicture(img);
};

/* THE ONE PLACE THAT DECIDES WHICH PICTURE ANY CARD ON THIS PAGE GETS, so the
   checklist tile, the value band and the binder pocket can never disagree.
 *
 * A SOURCED SCAN NOW BEATS THE OWNER'S OWN PHOTOGRAPH, AND THAT IS A REVERSAL.
 * It used to put his photo first, on the reasoning that a picture of the copy in
 * his hand is the better picture on a page about HIS binder. He asked for the
 * opposite on 16 September 2026: "I want to source the images, not use mine as my
 * photos won't be as good". He is right, and the reason got stronger the moment
 * this page grew a 188 card checklist: a photograph sitting in a grid of scans
 * reads as a mistake, and every card he does not own can only ever be a scan.
 * Consistency across 188 tiles beats provenance on three of them.
 *
 * HIS PHOTOGRAPHS ARE NOT DELETED, THEY ARE THE LAST RESORT, and that is load
 * bearing rather than sentimental: the eight foil basic Energy are numbered in a
 * different set and NOBODY lists them, so his own photograph of Basic Metal
 * Energy MEE 016 is the only picture of that card this site can show. Dropping
 * the fallback would blank a card he owns.
 *
 * Order: TCGdex if data/30th.json's two ids are filled in, then TCGplayer from
 * the checklist, then his own photograph, then nothing. `row` is the checklist
 * row when there is one. */
/* WHICH SECTIONS TCGDEX CAN ANSWER FOR, AND IT IS NOT ALL OF THEM.
 *
 * TCGdex took the set on 18 September 2026 as two sets: `30th`, 158 cards with
 * images, and `30th-c`, 30 Classic Collection cards with NO images at all --
 * every 30th-c url answers 404, checked. So only the three sections numbered in
 * the 30th's own sequence can use it.
 *
 * SWITCHING IT ON WITHOUT THIS GUARD DRAWS THE WRONG CARDS, and not subtly.
 * The Energy is numbered in a DIFFERENT set: Basic Metal Energy is MEE 016, and
 * localId 016 in the 30th main set is SLOWPOKE. All seven Energy he owns would
 * have drawn somebody else's card while looking perfectly correct. The Classic
 * Collection is worse-shaped: its numbers are its original sets', so 69/132
 * builds .../30th/69/132, which is not a url at all.
 *
 * So: pikachu, main and secret get TCGdex; classic falls through to the
 * TCGplayer product id on its checklist row; energy falls through to his own
 * photograph, which is still the only picture of those eight anywhere. */
const DEX_SECTIONS = new Set(["pikachu", "main", "secret"]);

/* THE LOCALID TCGDEX WANTS, DERIVED HERE RATHER THAN AT FOUR CALL SITES.
 *
 * The same number reaches this function in two shapes and that is not going to
 * change: data/30th-binder.json stores what the owner types ("023"), and
 * data/30th-checklist.json stores what the card prints ("023/128"). TCGdex keys
 * on the numerator zero-padded to three.
 *
 * THE FIRST VERSION OF THIS TESTED /^\d{3}$/ AND FIXED ONE CALL SITE, WHICH IS
 * WORSE THAN FIXING NONE because it looked finished. Counted off the built page:
 * only the 17 OWNED main-section pockets passed, while all 186 needed pockets
 * and every one of the 188 checklist tiles silently fell back to TCGplayer --
 * 0 TCGdex references in the whole checklist section. Both sources draw the
 * right card so nothing looked wrong; the canonical one was just unused.
 *
 * Returning null rather than a guess is what keeps the Energy safe: MEE 016 must
 * never become .../30th/016, which is Slowpoke. */
const dexLocalId = (section, n) => {
  if (!HAVE_DEX || !DEX_SECTIONS.has(section)) return null;
  const m = /^0*(\d{1,3})(?:\/\d+)?$/.exec(String(n || "").trim());
  return m ? m[1].padStart(3, "0") : null;
};

/* THE PICTURE IS DECORATIVE AND ITS alt IS EMPTY, which is a change from
   passing the card name in. The POCKET names itself -- every one carries
   title="<card name>", which is the listitem's accessible name -- and 62 of the
   75 filled pockets ALSO print the name visibly beside the image. So the name
   was being announced two or three times in a row: "Pikachu, image Pikachu,
   Pikachu". An image that repeats the text next to it is decorative by
   definition. The name is still passed in because tcgpImg/shotImg build their
   own alt and a future caller may need it; only the card scan goes silent. */
const pictureFor = (name, { shot, n, row, section, low = false, sizes = SIZES }) => {
  const dex = dexLocalId(section ?? row?.section, n);
  if (dex) return cardImg(dex, name, low, sizes);
  /* NO avifPicture() AROUND THIS ONE. That helper rewrites a .webp srcset to
     .avif for TCGdex and for our own pack renditions and returns its input
     untouched for anything else, so on a third party's .jpg the call was a
     no-op dressed as an optimisation. TCGplayer publishes no AVIF. */
  if (row && row.pid) return tcgpImg(row.pid, name, low, sizes);
  if (shot) return shotImg(shot, name, sizes);
  return "";
};

/* WHICH SOURCE ACTUALLY DRAWS EACH CARD, ASKED IN pictureFor's OWN ORDER.
 *
 * THIS NOTE HAS NOW BEEN WRONG THREE TIMES AND EACH WAS A DIFFERENT MISTAKE,
 * which is why it is derived here rather than reasoned about:
 *   1. It credited TCGplayer with 188 by counting CHECKLIST.size -- checklist
 *      rows, not hotlinks.
 *   2. Corrected to 186, then TCGdex took the set and 329 of the page's
 *      pictures moved to it while the sentence still said 186 TCGplayer.
 *   3. The first attempt at THIS block asked "own photograph?" first, which is
 *      not the order pictureFor() resolves in -- it puts TCGdex first -- so it
 *      claimed three photographs when only one is drawn. Hydreigon and
 *      Igglybuff both HAVE a photo and neither renders it any more.
 * So this walks the same cards the page draws and asks the same questions in
 * the same order. A fourth wrong version has to get past a mirror of the real
 * function to happen.
 *
 * THE UNION, NOT THE CHECKLIST. The eight Energy are in no checklist row, so
 * counting CHECKLIST alone silently drops the one card whose only picture is
 * his own photograph. */
const ALL_CARDS = (() => {
  const out = [...CHECKLIST.values()].map((c) => ({ section: c.section, n: c.n, pid: c.pid }));
  const seen = new Set(out.map((c) => clKey(c.section, c.n)));
  for (const o of owned) {
    const k = clKey(o.section, o.n || "");
    if (!seen.has(k)) { out.push({ section: o.section, n: o.n, pid: o.pid || null }); seen.add(k); }
  }
  return out;
})();
const shotFor = (c) => {
  const mine = owned.find((o) => clKey(o.section, o.n || "") === clKey(c.section, c.n));
  return mine && mine.shot ? mine.shot : null;
};
const SRC_TALLY = ALL_CARDS.reduce((a, c) => {
  /* pictureFor's order, exactly: TCGdex, then a TCGplayer product id, then his
     own photograph, then nothing. */
  const k = dexLocalId(c.section, c.n) ? "dex" : c.pid ? "tcgp" : shotFor(c) ? "own" : "none";
  a[k] = (a[k] || 0) + 1;
  return a;
}, {});
const DEX_PICS = SRC_TALLY.dex || 0;
const REMOTE_PICS = SRC_TALLY.tcgp || 0;
const OWN_PICS = SRC_TALLY.own || 0;
const NO_PICS = TOTAL - DEX_PICS - REMOTE_PICS - OWN_PICS;
/* Defined here, BELOW pictureFor, because it calls dexLocalId(): placed above
   it this threw "Cannot access 'dexLocalId' before initialization" at build
   time. Const declarations are hoisted into a temporal dead zone, so the
   reference compiles and fails only when it runs. */

// A pocket is one of three states and they are visibly different from each
// other, never by colour alone: owned draws the card in full colour with a
// solid border, needed draws the same card desaturated and dimmed behind a
// dashed border, and unknown draws a number because there is no picture to show.
// THE DENOMINATOR IS NOISE IN THREE SECTIONS AND IS THE IDENTIFIER IN THE
// FOURTH, so this cannot be one rule. main, pikachu and secret are all one
// set: "023/128" repeats "/128" down 158 pockets and says nothing, so it is
// cut. The Classic Collection is 30 REPRINTS OF CARDS FROM 30 DIFFERENT SETS,
// and the denominator is the only thing telling them apart -- "11/101" and
// "11/113" are two different cards and both were printing as "#11". Cutting it
// there merges two pockets into one label. Measured on the built page before
// this: 194 of 197 pocket numbers were bare, so every classic empty pocket was
// ambiguous while the OWNED classic pockets beside them printed the whole
// number from data/30th-binder.json -- the same card, two labels, one row apart.
const pocketNum = (section, n) =>
  section === "classic" || /RGB/.test(String(n)) ? String(n) : String(n).split("/")[0];

/* THE LABEL ON THE STRIP AT THE FOOT OF A POCKET. The set code is dropped where
   it says nothing -- "30C" was on 97 pockets of a binder that is entirely 30th
   Celebration -- and kept where it tells two runs apart: MEE on the Energy, MEP
   on the promos, whose numbers collide with the main set's. */
const pocketLabel = (section, n, setCode) =>
  (n ? "#" + pocketNum(section, n) : "") + (setCode && setCode !== "30C" ? " " + setCode : "");

/* THE CARD BACK BEHIND EVERY PICTURE, 23 September 2026. The owner, twice:
   the grey cards go missing when he flips. They never failed to load -- 711
   candidate urls answered 200 and no image was ever removed, in Chrome and in
   real WebKit -- but a grey pocket WHILE ITS PICTURE WAS ON THE WAY was a dashed
   empty slot with a faint number in it, and on a phone flipping every second or
   two over cellular that lasted a second or more per page. So every pocket now
   draws a card of its own underneath the picture: the number large and the
   name under it. A picture that is late, or that fails twice and is removed by
   t30e(), leaves a card that still says what goes there, never a hole. */
const phOf = (name, label) =>
  `<span class="t30-ph" aria-hidden="true"><b>${esc(label)}</b><i>${esc(name)}</i></span>`;

/* THE ENLARGED CARD, 25 September 2026. The owner: "make the cards clickable in
   the master set binder ... when you click on them it pop up the card larger so
   you can see it in detail, and give you the market value for the raw and psa 10
   if available ... if those prices aren't available don't show". So each pocket
   carries what the pop-up needs as data attributes and nothing is fetched:
     - the LARGE picture, from the same source pictureFor() chose for the pocket
       (TCGdex high.webp, else TCGplayer's _in_1000x1000, else his own photo), so
       the enlarged card can never be a different card from the small one
     - raw and PSA 10 from data/30th-prices.json, the same PriceCharting read the
       rest of the page prints; a missing figure is simply not written, and the
       pop-up only draws what it is handed. Promos and jumbos read `promos`
       there, keyed promo|NNN and jumbo|NNN. */
const pxOf = (c, slot) => {
  const s = c || slot || {};
  if (c && /jumbo/i.test(c.kind || "")) return (prices.promos || {})[`jumbo|${c.n}`] || null;
  if ((c && c.setCode === "MEP") || s.section === "promo") {
    return (prices.promos || {})[`promo|${String(s.n || "").padStart(3, "0")}`] || null;
  }
  const row = CHECKLIST.get(clKey(s.section, s.n || ""));
  return row ? PRICE.get(`${row.section}|${row.n}`) || null : null;
};
const bigOf = (s, row) => {
  const dex = dexLocalId(s.section ?? row?.section, s.n);
  if (dex) return `${scanBase(dex)}/high.webp`;
  const pid = row?.pid || s.pid;
  if (pid) return `${tcgpBase(pid)}_in_1000x1000.jpg`;
  if (s.shot) return `/assets/30th-cards/${s.shot}.webp`;
  return "";
};
const money = (v) => (typeof v === "number" && v > 0 ? (v >= 100 ? moneyRound(v) : moneyExact(v)) : "");

/* WHAT THE POP-UP READS, FOR ANY CARD ON THE PAGE, 25 September 2026. The
   owner, the same day the binder got it: "update the 30th set page so that if
   you click on a card image it enlarges like on the binder". So the value
   tiles, every checklist row and the hits all carry the same attributes the
   binder pockets do, built here once so a card cannot pop up with one price in
   the checklist and another in the binder. `rip` is a hit's video, which the
   pop-up offers as a link; nothing else has one. */
const illOf = (section, n) => {
  const id = dexLocalId(section, n);
  return id ? ILLUS[id] || "" : "";
};
const zoomAttrs = ({ name, num, rar, big, px, own, rip, when, ill }) =>
  ` data-name="${esc(name)}" data-num="${esc(num)}"` +
  (rar ? ` data-rar="${esc(rar)}"` : "") +
  (big ? ` data-big="${esc(big)}"` : "") +
  /* Raw to the cent and PSA 10 rounded, the same two formats the checklist
     row prints, so the pop-up never disagrees with the row. */
  (money(px?.raw) ? ` data-raw="${esc(moneyExact(px.raw))}"` : "") +
  (money(px?.psa10) ? ` data-psa="${esc(moneyRound(px.psa10))}"` : "") +
  (own ? ` data-own="1"` : "") +
  (rip ? ` data-rip="${esc(rip)}"` : "") +
  (when ? ` data-when="${esc(when)}"` : "") +
  (ill ? ` data-ill="${esc(ill)}"` : "");
/* A checklist card's pop-up, for the value tiles and the checklist rows. The
   owned test is the binder's own join, the one clOwned makes below; it is
   rebuilt here because the value band is written before the checklist is. */
const OWNED_KEYS = new Set(owned.map((c) => clKey(c.section, c.n || "")));
const zoomOf = (c, extra = {}) =>
  zoomAttrs({
    name: c.name,
    num: pocketLabel(c.section, c.n),
    rar: c.rarity,
    big: bigOf({ section: c.section, n: c.n }, c),
    px: c.pr || priceOf(c),
    own: OWNED_KEYS.has(clKey(c.section, c.n)),
    ill: illOf(c.section, c.n),
    ...extra,
  });

/* THE LABEL IS A STRIP UNDER THE CARD, NOT ON IT, 25 September 2026. The owner:
   "make sure the card number or name that's listed doesn't cover the card
   artwork at all ... make a space for them that's not on the actual card
   artwork, keep that looking like an exact replica of the cards". The number
   used to be a pill laid over the foot of the picture and the owned check sat
   over its top right corner. Both now live in .t30-pn, BELOW the card frame and
   inside the pocket, so the card itself is drawn whole and untouched. The card
   frame is a <button> because it is the control that opens the enlarged card. */
const pocket = (c, i, slot) => {
  if (c || (HAVE_SCANS && slot)) {
    const s = c || slot;
    const row = CHECKLIST.get(clKey(s.section, s.n || ""));
    const lab = pocketLabel(s.section, s.n, s.setCode);
    const pic = c
      ? /* A promo or jumbo is in no checklist row, so each carries its own `pid`
           in data/30th-binder.json instead; see `_pidNote` there. */
        pictureFor(c.name, { shot: c.shot, n: c.n, row: row || (c.pid ? { pid: c.pid } : null), section: c.section })
      : pictureFor(slot.name, { n: slot.n, row: slot, section: slot.section, low: true });
    const px = pxOf(c, slot);
    /* A JUMBO'S PRODUCT PHOTO CARRIES TCGPLAYER'S "OVERSIZE CARD" SASH across
       the art, so the enlarged view uses its standard-size twin's scan: the same
       artwork, clean. */
    const twin = c && /jumbo/i.test(c.kind || "") ? promos.find((o) => String(o.n) === String(c.n) && o.pid) : null;
    const big = bigOf(twin ? { ...s, pid: twin.pid } : s, twin ? { pid: twin.pid } : row || (s.pid ? { pid: s.pid } : null));
    const rar = row?.rarity || s.rarity || (c && /jumbo/i.test(c.kind || "") ? "Jumbo" : s.section === "promo" || s.setCode === "MEP" ? "Black Star Promo" : "");
    const attrs = zoomAttrs({ name: s.name, num: lab, rar, big, px, own: !!c, ill: illOf(s.section, s.n) });
    /* "Collected" IS SAID OUT LOUD, because otherwise it was communicated only
       by absence. NO DATE ON THE CARD either (the owner, 22 September 2026:
       "remove the dates overalyed on top of the cards"); `got` still drives the
       "Last added" line above the binder. */
    return `<li class="t30-pk ${c ? "has" : "need"}" title="${esc(s.name)}">
        <button type="button" class="t30-cf"${attrs} aria-label="${esc(s.name)} ${esc(lab)}, ${c ? "collected" : "not collected yet"}. Show it larger">
          ${phOf(s.name, lab)}
          ${pic}
        </button>
        <span class="t30-pn">${c ? '<span class="t30-ok" aria-hidden="true"></span>' : ""}${esc(lab)}</span>
      </li>`;
  }
  return `<li class="t30-pk" aria-hidden="true"><span class="t30-cf">${phOf("", String(i + 1))}</span><span class="t30-pn">${i + 1}</span></li>`;
};

/* A PAD IS A POCKET WITH NOTHING IN IT, and it has to be the same height as a
   full one now that a pocket is a card frame plus a label strip rather than a
   single 5:7 box. The same two children, empty. The binder script builds the
   back of a turning sheet out of these too. */
const PAD_POCKET = `<li class="t30-pk pad" aria-hidden="true"><span class="t30-cf"></span><span class="t30-pn"></span></li>`;

// WHICH CARDS A SECTION'S EMPTY POCKETS SHOW. Once TCGdex holds the set this
// reads its checklist; until then it returns nothing and the placeholders draw.
// It is deliberately NOT the Japanese list on this page: those are Japan's
// numbers and this binder is the English set, and the numbering does not line up
// (128 English main set cards to Japan's 103), so borrowing them would put the
// wrong picture in the wrong pocket, which looks right and is the worst kind of
// wrong. Empty until there is an English checklist to read.
const slotsFor = (key) => (checklist.cards || []).filter((c) => c.section === key);

/* WHAT HE STILL NEEDS, AT A GLANCE, 23 September 2026. The binder answers "what
   is on page 12"; nobody wants to flip 26 pages to answer "which Pikachu am I
   missing". One closed list per section, computed from the same checklist and
   the same owned list the pockets are, so the two cannot disagree. A <details>
   so it costs no height until it is opened, and no script at all. */
const needList = (() => {
  const rows = SECTIONS.map(([key, label]) => {
    const have = new Set(ownedIn(key).map((c) => clKey(c.section, c.n || "")));
    const miss = slotsFor(key).filter((c) => !have.has(clKey(c.section, c.n)));
    if (!miss.length) return "";
    return `      <details class="t30-need">
        <summary><b>${esc(label)}</b> <span>${miss.length} still to find</span></summary>
        <ul>
${miss.map((c) => `          <li><span>${esc("#" + pocketNum(c.section, c.n))}</span> ${esc(c.name)}${
  /* The owner counts his Pikachu by their place in the thirty, "x/30", which
     is the number the card itself prints (023 is 1/30). "Pikachu Rare" on all
     fourteen rows said nothing; the position is what he looks them up by. */
  key === "pikachu" ? ` <i>${Number(String(c.n).split("/")[0]) - 22} of 30</i>` : c.rarity ? ` <i>${esc(c.rarity)}</i>` : ""}</li>`).join("\n")}
        </ul>
      </details>`;
  }).filter(Boolean);
  return rows.length ? `    <div class="t30-needs">
      <h3>Still to find</h3>
${rows.join("\n")}
    </div>` : "";
})();

/* ONE TILE, USED BY THE VALUE BAND AND THE CHECKLIST, so a card cannot look
   like two different things on one page. The picture comes from the same
   pictureFor() the binder pockets use, which is what keeps the owner's own
   photographs, TCGdex and TCGplayer in one precedence order across the page. */
/* THE PICTURE IS THE BUTTON THAT ENLARGES IT, and only the picture: the words
   under it are for reading, and a tile that opened on a tap anywhere would take
   a scroll that started on the name for a tap. */
const TILE_SIZES = "(max-width:559px) 44vw, (max-width:899px) 19vw, 250px";
const cardTile = (c, { showPrice = true } = {}) => {
  const pr = c.pr || priceOf(c);
  const pic = pictureFor(c.name, { n: c.n, row: c, section: c.section, sizes: TILE_SIZES });
  return `        <li class="t30-ct${pic ? "" : " nopic"}">
          ${pic ? `<button type="button" class="t30-zm"${zoomOf(c)} aria-label="Show ${esc(c.name)} ${esc(pocketLabel(c.section, c.n))} larger">${pic}</button>` : ""}
          <p class="t30-ct-n">${esc(c.name)}</p>
          <p class="t30-ct-m">#${esc(pocketNum(c.section, c.n))}${
            c.rarity ? ` &bull; ${esc(c.rarity)}` : ""
          }</p>${
            showPrice
              ? pr && typeof pr.raw === "number"
                ? `\n          <p class="t30-ct-p">${moneyExact(pr.raw)}<span>raw NM</span></p>${
                    typeof pr.psa10 === "number"
                      ? `\n          <p class="t30-ct-g">${moneyRound(pr.psa10)} <i>PSA 10</i></p>`
                      : ""
                  }`
                : `\n          <p class="t30-ct-p none">No price yet</p>`
              : ""
          }
        </li>`;
};

/* ======================================================================== *
 * THE BINDER AS AN OBJECT YOU FLIP, NOT A LIST YOU SCROLL.
 *
 * The owner, 17 September 2026: "can we make it look more like an actual card
 * binder, and have pages you flip through instead of just listing them all out
 * under each other ... click a turn page button or click the page corner to
 * turn the page ... so the page isn't as long and its more like a real card
 * binder to virtually flip through".
 *
 * IT WAS 100KB OF THE PAGE'S 261KB AND 197 POCKETS STACKED VERTICALLY. Every
 * section drew its whole grid, so the binder alone was 22 screens of scrolling
 * and the sections below it were unreachable without passing all of them.
 *
 * NO JAVASCRIPT IS REQUIRED AND THAT IS THE DESIGN, NOT A CONCESSION. The
 * leaves sit in a horizontal scroll-snap track and every control is a plain
 * anchor to the next leaf's id, so turning a page is a native scroll a browser
 * does on its own. The script at the bottom of the page only stops the WINDOW
 * jumping while the track scrolls; with it blocked you still get a working
 * binder, which is the same bargain the pack player and the lightbox already
 * make on this site.
 *
 * A LEAF NEVER STRADDLES TWO SECTIONS. A real binder starts a new page for a
 * new run of cards, and more practically: the leaf header names its section, so
 * a leaf holding the end of the Pikachu and the start of the main set could not
 * label itself honestly. That is why the page count is 25 rather than the 23
 * you get from dividing 199 by 9 -- four of the five sections end mid-leaf.
 * ====================================================================== */
const leafOf = (cells, meta) => {
  const held = cells.filter((c) => c.has).length;
  return { ...meta, cells, held };
};

/* Every leaf in the binder, in order, across all five sections and the promos.
   Built before anything renders so the leaf headers can say "page 4 of 25"
   without a second pass. */
const BINDER_LEAVES = (() => {
  const out = [];
  for (const [key, label, total] of SECTIONS) {
    const have = ownedIn(key);
    const slots = HAVE_SCANS ? slotsFor(key) : [];
    const cards = [];
    if (slots.length) {
      const byKey = new Map(have.map((c) => [clKey(c.section, c.n || ""), c]));
      for (const slot of slots) {
        const k = clKey(slot.section, slot.n);
        const mine = byKey.get(k);
        if (mine) byKey.delete(k);
        cards.push({ has: Boolean(mine), owned: mine, slot });
      }
      for (const c of have) if (byKey.has(clKey(c.section, c.n || ""))) cards.push({ has: true, owned: c, slot: null });
    } else {
      /* NO CHECKLIST FOR THIS SECTION, so it draws what he owns plus enough
         empty pockets to finish the leaf. The Energy is this case: those eight
         are numbered MEE and nobody lists them, so there are no slots to draw
         and a full 199-pocket grid of numbered placeholders would be worse than
         a short honest one. */
      const shown = Math.min(total, Math.max(POCKETS, Math.ceil(have.length / POCKETS) * POCKETS));
      for (let i = 0; i < shown; i++) cards.push({ has: Boolean(have[i]), owned: have[i], slot: null });
    }
    const pages = Math.max(1, Math.ceil(cards.length / POCKETS));
    for (let p = 0; p < pages; p++)
      out.push(leafOf(cards.slice(p * POCKETS, (p + 1) * POCKETS), {
        key, label, total, page: p + 1, pages, of: cards.length,
      }));
  }
  /* EVERY KNOWN 30th PROMO GETS A POCKET, 23 September 2026. The owner, asked
     whether the promos he does not have should show as pockets to fill: "yes".
     The pages held only the promos he owned; they now hold every MEP number in
     the set's run (his, plus data/30th.json's promosToFind), in number order,
     his in colour and the rest grey, pictured from the TCGplayer id each row
     carries. */
  if (PROMO_CELLS.length) {
    const pages = Math.max(1, Math.ceil(PROMO_CELLS.length / POCKETS));
    for (let p = 0; p < pages; p++)
      out.push(leafOf(PROMO_CELLS.slice(p * POCKETS, (p + 1) * POCKETS),
        { key: "promo", label: "Promos", total: PROMO_CELLS.length, page: p + 1, pages, of: PROMO_CELLS.length }));
  }
  if (jumbos.length) {
    const pages = Math.max(1, Math.ceil(jumbos.length / POCKETS));
    for (let p = 0; p < pages; p++)
      out.push(leafOf(jumbos.slice(p * POCKETS, (p + 1) * POCKETS).map((o) => ({ has: true, owned: o, slot: null, promo: true })),
        { key: "jumbo", label: "Jumbo cards", total: jumbos.length, page: p + 1, pages, of: jumbos.length }));
  }
  return out.map((l, i) => ({ ...l, no: i + 1 }));
})();
const LEAF_N = BINDER_LEAVES.length;

/* ONE LEAF. Nine pockets, a header that says which section and which page, and
   a turn control in each bottom corner -- which is literally what he asked for:
   "click the page corner to turn the page". The corners are anchors to the
   neighbouring leaf's id, so they work before any script runs.
   THEY WRAP AT BOTH ENDS rather than disappearing. A missing control on the
   first and last leaf shifts the layout and leaves a dead corner; wrapping
   keeps the object consistent and a binder you can flip round from the back is
   not a wrong idea. */
const leafHtml = (l) => {
  const prev = BINDER_LEAVES[(l.no - 2 + LEAF_N) % LEAF_N];
  const next = BINDER_LEAVES[l.no % LEAF_N];
  const cellHtml = l.cells
    .map((c, i) =>
      c.has
        ? pocket(c.owned, i, null)
        : c.slot
          ? pocket(undefined, i, c.slot)
          : pocket(undefined, i, undefined)
    )
    .join("\n");
  /* THE LEAF IS PADDED TO NINE SO EVERY PAGE IS THE SAME SHAPE. A real binder
     page has nine pockets whether or not nine cards are in it, and without this
     the last leaf of a section collapses to one row and the track's snap points
     stop being the same height. These extras are aria-hidden: they are the
     empty part of a physical page, not cards that exist. */
  const pad = Array.from({ length: Math.max(0, POCKETS - l.cells.length) },
    () => `            ${PAD_POCKET}`).join("\n");
  /* THE LABEL LEADS WITH THE ABSOLUTE PAGE NUMBER, which is what the visible
     header says and what the reader is looking at. It used to carry the
     WITHIN-SECTION number only, so leaf 20 announced "Classic Collection, page 1
     of 4" while its own header read "Page 20 of 26". Both numbers are useful, so
     it says both in the order the eye meets them. */
  return `        <article class="t30-leaf" id="bl${l.no}" aria-label="Page ${l.no} of ${LEAF_N}, ${esc(l.label)}${l.pages > 1 ? `, ${l.page} of ${l.pages} in this section` : ""}">
          <div class="t30-leaf-h">
            <b>${/* THE JUMBO LEAF NAMES ITS GUIDE. /jumbo-cards.html is what these
                   eight-inch cards are and what they are worth, and this leaf is
                   the one place on the page a reader is looking at one. */
              l.key === "jumbo" ? `<a href="/jumbo-cards.html">${esc(l.label)}</a>` : esc(l.label)}</b>
            <span>${/* THE SECTION IS NOT SAID TWICE. The header read "PAGE 5 OF 26 ·
                     MAIN SET 1/11" beside a heading that already says Main set,
                     and at 390 it wrapped to two lines on some leaves and not
                     others, so the pocket grid jumped 27px between pages as you
                     flipped. The within-section count stays in the aria-label. */
              `Page ${l.no} of ${LEAF_N}`}</span>
          </div>
          <ol class="t30-pkts">
${cellHtml}${pad ? "\n" + pad : ""}
          </ol>
          ${/* THE COVER IS PAGE 0 NOW, so page 1 turns back to it and the last page
               turns on to it rather than wrapping round to page 1. */
            l.no === 1
              ? `<a class="t30-turn back" href="#bl0" aria-label="Close to the cover"><span aria-hidden="true">&lsaquo;</span></a>`
              : `<a class="t30-turn back" href="#bl${prev.no}" aria-label="Turn back to page ${prev.no}, ${esc(prev.label)}"><span aria-hidden="true">&lsaquo;</span></a>`}
          ${l.no === LEAF_N
              ? `<a class="t30-turn fwd" href="#bl0" aria-label="Back to the cover"><span aria-hidden="true">&rsaquo;</span></a>`
              : `<a class="t30-turn fwd" href="#bl${next.no}" aria-label="Turn to page ${next.no}, ${esc(next.label)}"><span aria-hidden="true">&rsaquo;</span></a>`}
        </article>`;
};

/* THE RAIL IS THE ONLY WAY TO REACH LEAF 19 WITHOUT SEVENTEEN CLICKS, and it is
   anchors again so it needs no script either. Grouped by section, because "page
   14" means nothing to a reader and "main set 6" does. */
const railHtml = (() => {
  const groups = [];
  for (const l of BINDER_LEAVES) {
    const g = groups[groups.length - 1];
    if (g && g.label === l.label) g.leaves.push(l);
    else groups.push({ label: l.label, leaves: [l] });
  }
  return groups
    .map(
      (g) => `          <div class="t30-railg">
            <span>${esc(g.label)}</span>
            <p>${g.leaves
              .map((l) => `<a href="#bl${l.no}"${l.held ? ' class="filled"' : ""} aria-label="${
                esc(g.label)}, page ${l.page} of ${l.pages}, ${l.held} of ${l.cells.length} collected">${l.page}</a>`)
              .join("")}</p>
          </div>`
    )
    .join("\n");
})();

/* The per-section counts the old stacked layout carried in its headings. They
   still matter -- he asked for the percentage in the first place -- so they
   survive as a compact summary above the binder rather than being lost with the
   headings they used to live on. */
const sectionSummary = [...SECTIONS.map(([key, label, total]) => ({ key, label, total, have: ownedIn(key).length })),
  ...(PROMO_CELLS.length ? [{ key: "promo", label: "Promos", total: PROMO_CELLS.length, have: promos.length }] : []),
  ...(jumbos.length ? [{ key: "jumbo", label: "Jumbo cards", total: null, have: jumbos.length }] : [])]
  .map(({ label, total, have }) => {
    const pcLocal = total ? Math.round((have / total) * 100) : 0;
    const first = BINDER_LEAVES.find((l) => l.label === label);
    return `          <li>
            <a href="#bl${first ? first.no : 1}">
              <b>${have}${total ? ` <i>of ${total}</i>` : ""}</b>
              <span>${esc(label)}</span>
              ${total ? `<span class="t30-bar" role="img" aria-label="${have} of ${total} collected"><span style="width:${pcLocal}%"></span></span>` : ""}
            </a>
          </li>`;
  })
  .join("\n");

const binderSection = ([key, label, total, note]) => {
  const have = ownedIn(key);
  // WITH PICTURES, EVERY POCKET IS DRAWN, because a grid of grayed out cards IS
  // the feature: the owner asked to see which ones are still missing. Without
  // pictures a full grid is 199 identical empty squares saying one sentence, so
  // it stays capped at one page past the last card owned.
  /* EVERY POCKET IS A PARTICULAR CARD NOW, WHICH IT WAS NOT BEFORE.
   *
   * This loop used to be `pocket(have[i], i, slots[i])`: the owned cards filled
   * the FIRST pockets of the section and the rest drew as placeholders. That was
   * right while there was no checklist -- a pocket meant nothing but "a card
   * belongs here" -- and it is wrong the moment each pocket is a named card,
   * because it would have drawn Hydreigon 099 in the first pocket of the main
   * set, on top of Chansey 001, and left 099's own pocket showing Hydreigon
   * greyed out as though he did not own it. So a slot is matched to an owned
   * card BY NUMBER through clKey, and the positional version survives only for
   * a section the checklist cannot answer.
   *
   * AND AN OWNED CARD THE CHECKLIST DOES NOT HOLD STILL GETS A POCKET, appended
   * after the slots. That is not hypothetical: the eight foil Energy are
   * numbered in a different set entirely and TCGplayer lists none of them, and
   * the owner already owns one of them -- Basic Metal Energy, MEE 016. Rendering
   * only the checklist would have deleted a card he owns from his own binder. */
  const slots = HAVE_SCANS ? slotsFor(key) : [];
  const cells = [];
  let shown;
  if (slots.length) {
    const byKey = new Map(have.map((c) => [clKey(c.section, c.n || ""), c]));
    for (let i = 0; i < slots.length; i++) {
      const mine = byKey.get(clKey(slots[i].section, slots[i].n));
      if (mine) byKey.delete(clKey(slots[i].section, slots[i].n));
      cells.push(pocket(mine, i, slots[i]));
    }
    // Whatever he owns that no slot claimed, in the order he recorded it.
    for (const c of have) if (byKey.has(clKey(c.section, c.n || ""))) cells.push(pocket(c, cells.length, null));
    shown = cells.length;
  } else {
    shown = Math.min(total, (Math.floor(have.length / POCKETS) + 1) * POCKETS);
    for (let i = 0; i < shown; i++) cells.push(pocket(have[i], i, undefined));
  }
  const done = have.length >= total;
  return `      <section class="t30-bs">
        <h3>${esc(label)} <span class="t30-cnt${done ? " done" : ""}">${have.length} of ${total}</span></h3>
        <p class="t30-bn">${esc(note)}</p>
        <div class="t30-bar" role="img" aria-label="${have.length} of ${total} collected"><span style="width:${total ? Math.round((have.length / total) * 100) : 0}%"></span></div>
        <figure class="t30-fig">
          <ol class="t30-pkts">
${cells.join("\n")}
          </ol>
          <figcaption>${esc(label)}, ${have.length} of ${total} in the binder.${
            shown >= total
              ? ""
              : slots.length
                /* THE TWO REASONS A POCKET CAN BE MISSING ARE DIFFERENT AND THIS
                   HAS NOW GIVEN THE WRONG ONE TWICE. First it gave the cap's
                   reason -- "not drawn until they are closer to being filled" --
                   for a section that was short because no source lists the card.
                   Then it said those cards "have not been revealed yet", which
                   was ALREADY FALSE when it was written on 16 September 2026:
                   the three Mew RGB were revealed on the 15th through an
                   internal Pokemon TCG Live update. So this no longer explains
                   itself at all. It states the count, and the section's own note
                   carries the reason, which is where there is room to be exact
                   about it. A caption should not hold a claim that can rot. */
                ? ` ${total - shown} more ${total - shown === 1 ? "card" : "cards"} in this section ${total - shown === 1 ? "has" : "have"} no pocket yet.`
                : ` ${total - shown} further pocket${total - shown === 1 ? "" : "s"} in this section are not drawn until they are closer to being filled.`
          }</figcaption>
        </figure>
      </section>`;
};

// ---------------------------------------------------------------------------
// PRODUCTS, GROUPED BY RELEASE WAVE
// ---------------------------------------------------------------------------
/* A SOURCE READS AS WHAT IT IS, not as its url. The list printed bare urls, some
   cut off mid-word ("...30th-Celebra"); these name the publisher and the page. */
const SRC_HOST = {
  "press.pokemon.com": "The Pokemon Company press release",
  "www.pokemon.com": "pokemon.com",
  "pokemon.com": "pokemon.com",
  "tcg.pokemon.com": "pokemon.com card gallery",
  "www.pokebeach.com": "PokeBeach",
  "pokebeach.com": "PokeBeach",
  "www.tcgplayer.com": "TCGplayer",
  "bulbapedia.bulbagarden.net": "Bulbapedia",
  "www.pokemoncenter.com": "Pokemon Center",
};
const srcLabel = (u) => {
  let url; try { url = new URL(u); } catch { return u; }
  const who = SRC_HOST[url.hostname] || url.hostname.replace(/^www\./, "");
  const tail = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "")
    .replace(/\.(html?|php)$/, "").replace(/^\d{4}\/\d{2}\//, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!tail || /^\d+$/.test(tail)) return who;
  const words = tail.split(" ").slice(0, 9).join(" ");
  return `${who}: ${words.charAt(0).toUpperCase()}${words.slice(1)}${tail.split(" ").length > 9 ? "..." : ""}`;
};
/* WHICH OPENING GUIDE A PRODUCT IS, so each product links to what opening one
   is like. Only kinds that have a guide on this site. */
const OPENING_FOR = (name) =>
  /Pokemon Center Elite Trainer/i.test(name) || /Elite Trainer/i.test(name) ? "etb"
  : /Booster Bundle/i.test(name) ? "bundle"
  : /Mini Tin|ex Tin|\bTin\b/i.test(name) ? "tin"
  : /Blister|Tech Sticker/i.test(name) ? "blister"
  : /Knock Out/i.test(name) ? "knock-out"
  : /Ultra Premium/i.test(name) ? "upc"
  : /Collection|ex Box/i.test(name) ? "collection-box"
  : null;
const waves = new Map();
for (const p of doc.products) {
  const d = p.date || doc.set.release;
  if (!waves.has(d)) waves.set(d, []);
  waves.get(d).push(p);
}
const waveBlocks = [...waves.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(
    ([date, items]) => `        <section class="t30-wave">
          <h3>${esc(longDate(date))} ${date <= localDay()
            ? `<span class="t30-tag off">Out now</span>`
            : `<span class="t30-tag">Coming</span>`}</h3>
          <ul>
${items
  .map(
    (p) => `            <li>
              <span class="t30-p">${OPENING_FOR(p.name)
                ? `<a href="/openings/${OPENING_FOR(p.name)}.html">${esc(p.name)}</a>`
                : esc(p.name)}</span>
              <span class="t30-meta">${[p.packs ? `${p.packs} pack${p.packs === 1 ? "" : "s"}` : null, p.price || null,
                /* WHAT A PACK WORKS OUT TO, which is what a parent standing in
                   the aisle is comparing: list price over packs, arithmetic
                   only. Everything else in the box is left out of it, so it is
                   the price of the packs at most, never of a pack alone. */
                p.packs && /^\$\d/.test(p.price || "") ? `$${(parseFloat(p.price.slice(1)) / p.packs).toFixed(2)} a pack` : null]
                .filter(Boolean)
                .map(esc)
                .join(" &bull; ")}</span>
              ${p.note ? `<span class="t30-note">${esc(p.note)}</span>` : ""}
            </li>`
  )
  .join("\n")}
          </ul>
        </section>`
  )
  .join("\n");

const packTotal = doc.products.reduce((a, p) => a + (p.packs || 0), 0);

// ---------------------------------------------------------------------------
// JAPAN'S LIST
// ---------------------------------------------------------------------------
const JP_LABEL = {
  main: "Main set",
  pikachu: "Pikachu subset",
  secret: "Secret rare",
  classic: "Classic Collection",
  energy: "Basic Energy",
};
const jpRows = doc.japanList
  .map(
    (c) => `            <tr><td>${esc(c.n ? "#" + String(c.n).padStart(3, "0") : "--")}</td><td>${esc(c.name)}</td><td>${esc(
      JP_LABEL[c.section] || c.section
    )}</td></tr>`
  )
  .join("\n");

/* How many progress tiles sit over the binder, so a desktop can put them all in one row. */
const sectionSummaryN = (sectionSummary.match(/<li>/g) || []).length;
/* Defined before the stylesheet, which interpolates clCss. */
const clSections = SECTIONS.filter(([key]) => (checklist.cards || []).some((c) => c.section === key));
const clCss = clSections.map(([key]) =>
  `#checklist:has(#cls-${key}:checked) .t30-cl>li:not([data-s="${key}"]){display:none}`).join("\n");
const style = `
.t30-hero{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);box-shadow:var(--lift)}
.t30-facts{list-style:none;display:grid;gap:var(--s3);margin:var(--s4) 0 0;max-width:48em}
.t30-facts li{padding-left:1.15em;position:relative;line-height:1.45}
.t30-facts li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--ketchup)}
.t30-tag{display:inline-block;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;
  padding:4px 7px;border-radius:999px;border:1px solid var(--keyline);color:var(--ink-2);background:var(--paper);margin-right:6px;vertical-align:.12em}
.t30-tag.off{color:var(--ink);border-color:var(--ketchup)}
.t30-sum{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin:var(--s4) 0 0}
/* THE HERO. Tighter on a phone, where it was two screens before the first card:
   a 1.55 line height under a 34px h1, stat numerals that wrapped ("Sep 16,
   2026" on two lines of display type) and three rows of jump chips. */
.t30-top h1{line-height:1.12}
@media(max-width:599px){
  .t30-sum{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .t30-sum div{padding:10px 8px}
  .t30-sum b{font-size:1.6rem}
}
.t30-sum b{white-space:nowrap}
.t30-fan{display:none}
@media(min-width:1000px){
  .t30-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--s6,48px);align-items:center}
  .t30-fan{display:block;padding-bottom:var(--s6)}
  .t30-fan ol{list-style:none;margin:0;padding:0;display:flex;gap:14px;align-items:flex-end}
  .t30-fan li{width:clamp(120px,10.5vw,158px)}
  .t30-fan li:nth-child(1){transform:rotate(-4deg) translateY(6px)}
  .t30-fan li:nth-child(3){transform:rotate(4deg) translateY(6px)}
  .t30-fan .t30-zm{display:block;width:100%}
  /* .t30-card is a binder pocket's absolute fill; put it back in flow here, as
     ui.css does for .t30-ct. Missed the first time, the three cards collapsed
     their boxes to 0px and laid themselves over the value band below. */
  .t30-fan .t30-card{position:static;inset:auto;object-fit:initial;filter:none;opacity:1}
  .t30-fan img{display:block;width:100%;height:auto;border-radius:4.6%/3.3%;box-shadow:0 14px 30px rgb(0 0 0 / .5);
    transition:transform .18s ease}
  .t30-fan .t30-zm:hover img,.t30-fan .t30-zm:focus-visible img{transform:translateY(-6px)}
  .t30-fan p{margin:var(--s4) 0 0;text-align:center;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
    text-transform:uppercase;letter-spacing:.06em}
}
@media(prefers-reduced-motion:reduce){.t30-fan img{transition:none}}
/* HEADINGS INSIDE A SECTION HAD NO SPACE ABOVE THEM: all eleven body h3s measured
   margin-top 0, so each sat against the list before it. */
.wrap>h3,.t30-more-d h3{margin-top:var(--s5)}
/* ON THIS PAGE: routes, so teal; 44px chips. */
.t30-jump{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s4) 0 0}
.t30-jump a{display:inline-grid;place-items:center;min-height:44px;padding:0 14px;border-radius:999px;
  border:1px solid var(--keyline);background:var(--paper);color:var(--sky-deep);
  font:700 var(--t-sm)/1 var(--body,inherit);text-decoration:none}
.t30-jump a:hover,.t30-jump a:focus-visible{border-color:var(--sky);color:var(--sky)}
/* One row that scrolls sideways on a phone, edge to edge, rather than three rows. */
@media(max-width:599px){
  .t30-jump{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;
    margin-inline:calc(-1 * var(--gut,16px));padding:2px var(--gut,16px) 6px;scroll-padding-inline:var(--gut,16px)}
  .t30-jump::-webkit-scrollbar{display:none}
  .t30-jump a{flex:none}
}
/* PRODUCTS: two release dates side by side on a wide screen, where each product
   was a 1,392px bar holding one line. */
.t30-waves{display:grid;gap:var(--s4)}
@media(min-width:900px){.t30-waves{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}}
.t30-wave h3 .t30-tag{vertical-align:.2em;margin-left:6px}
/* THE DETAILS A COLLECTOR MOSTLY SKIPS, one tap away rather than on the page. */
.t30-more-d{margin-top:var(--s5);border:1px solid var(--keyline);border-radius:var(--r-sm);background:var(--card);padding:0 var(--s4)}
.t30-more-d>summary{min-height:44px;display:flex;align-items:center;cursor:pointer;
  font:700 var(--t-body)/1.3 var(--body,inherit);color:var(--sky-deep)}
.t30-more-d[open]{padding-bottom:var(--s4)}
/* A TABLE THAT FITS ITS BOX: min-width 24em pushed the Japanese box table to
   446px inside a 348px scroller and cut its caption off. */
.t30-tbl--fit{min-width:0}
/* .t30-tbl.t30-tbl--fit, TWO CLASSES, because ".t30-tbl th{white-space:nowrap}"
   further down had the same weight and won, so --fit did nothing: the promo
   table was 849px inside a 348px scroller at 390 with "Comes in" cut mid word. */
.t30-tbl.t30-tbl--fit th,.t30-tbl.t30-tbl--fit td{white-space:normal}
/* JAPAN'S LIST, closed by default: 7,068px of a different set at 390. */
.t30-jp>summary{list-style:none;cursor:pointer;display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--s3);min-height:44px}
.t30-jp>summary::-webkit-details-marker{display:none}
.t30-jp>summary h2{margin:0}
.t30-jp>summary span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--sky-deep);text-transform:uppercase;letter-spacing:.06em}
.t30-jp[open]>summary span{display:none}
/* IT DID NOT LOOK OPENABLE: one line of 11px mono in a 146px band. A plus in a
   ring, the same mark the "Still to find" rows use for the same job. */
.t30-jp>summary::after{content:"+";margin-left:auto;display:grid;place-items:center;width:36px;height:36px;border-radius:999px;
  border:1px solid var(--keyline);color:var(--sky-deep);font:400 24px/1 var(--body,inherit)}
.t30-jp[open]>summary::after{content:"\\2212"}
.t30-jp>summary:hover::after{border-color:var(--sky);color:var(--sky)}
.t30-jpl{list-style:none;margin:var(--s4) 0 0;padding:0;font-size:var(--t-sm);line-height:1.6}
.t30-jpl span{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
.t30-jpl i{font-style:normal;color:var(--ink-2);font-size:var(--t-micro)}
@media(min-width:768px){.t30-jpl{columns:3;column-gap:var(--s5)}}
.t30-faq{margin:var(--s4) 0 0;max-width:46em}
.t30-faq dt{font:700 var(--t-body)/1.3 var(--body,inherit);color:var(--ink);margin-top:var(--s4)}
.t30-faq dd{margin:6px 0 0;line-height:1.55}
/* LINKS OUTSIDE A <p> WERE PLAIN TEXT. ui.css colors prose links only as
   "main p a:not([class])", so the FAQ's, the pack facts' and all twelve
   Sources links drew in the body color with no underline: routes that did not
   look like routes, against the rule that a route is teal. */
.t30-faq dd a:not([class]),.t30-src a:not([class]),.t30-facts a:not([class]){color:var(--sky-deep);text-decoration:underline;
  text-underline-offset:.15em;text-decoration-color:color-mix(in srgb,currentColor 45%,transparent)}
.t30-faq dd a:not([class]):hover,.t30-src a:not([class]):hover,.t30-facts a:not([class]):hover,
.t30-faq dd a:not([class]):focus-visible,.t30-src a:not([class]):focus-visible,.t30-facts a:not([class]):focus-visible{color:var(--sky);text-decoration-color:currentColor}
.t30-src a{display:inline-block;padding-block:4px}
/* THE CHECKLIST LIST. Rows, not tiles; see checklistBand. The filter chips are
   labels for visually hidden inputs, 44px tall, teal when checked because a
   checked filter is a current state. */
.t30-clf{display:flex;flex-wrap:wrap;gap:var(--s3) var(--s5);margin:var(--s4) 0 var(--s3)}
/* THE FILTERS STAY ON SCREEN, 25 September 2026. The list is 20 screens on a
   phone and the chips scrolled away with the first of them, so "Still need" and
   "Price" were out of reach from anywhere but the top. Sticky inside the
   section only, so the bar lets go when the checklist ends; the background is
   the section's own, which alternates, so both are named. On a phone it is one
   row that scrolls sideways rather than four rows of chips. */
#checklist .t30-clf{position:sticky;top:var(--bar-h,60px);z-index:5;background:var(--page);
  margin-inline:-8px;padding:8px;border-bottom:1px solid color-mix(in srgb,var(--keyline) 60%,transparent)}
section.band#checklist .t30-clf{background:var(--sky-tint)}
@media(max-width:699px){
  #checklist .t30-clf{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain;
    margin-inline:calc(-1 * var(--gut,16px));padding:6px var(--gut,16px);gap:var(--s4)}
  #checklist .t30-clf::-webkit-scrollbar{display:none}
  #checklist .t30-clf fieldset{flex-wrap:nowrap;flex:none}
  #checklist .t30-clf label{flex:none;white-space:nowrap}
}
.t30-clf fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.t30-clf legend{float:left;margin-right:8px;font:700 var(--t-micro)/44px var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.06em}
.t30-clf input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.t30-clf label{display:inline-grid;place-items:center;min-height:44px;padding:0 14px;border-radius:999px;cursor:pointer;
  background:var(--paper);border:1px solid var(--keyline);font:700 var(--t-sm)/1 var(--body,inherit);color:var(--ink)}
.t30-clf input:checked+label{border:2px solid var(--sky);background:var(--paper-3)}
.t30-clf input:focus-visible+label{outline:3px solid var(--sky);outline-offset:2px}
/* A GRID, NOT CSS COLUMNS, 25 September 2026. Three columns of a column
   layout read down and then across, so column two opened at #064 in the middle
   of the main set with no heading over it and the first screen showed #023,
   #064 and #127 side by side. As a grid the rows read across like a binder
   page, every section starts under its own full width heading, and the price
   sort is the same grid in a different order. */
.t30-cl{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);column-gap:var(--s5,32px)}
.t30-clh{grid-column:1/-1;font:400 var(--t-m)/1.2 var(--display);color:var(--ink);padding:var(--s4) 0 var(--s2);
  display:flex;align-items:center;gap:8px}
@media(min-width:700px){.t30-cl{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:1280px){.t30-cl{grid-template-columns:repeat(3,minmax(0,1fr));column-gap:var(--s6,48px)}}
/* THE THUMBNAIL GROWS WITH THE SCREEN, 25 September 2026. The owner: "make the
   thumbnails larger as they are impossible to see the artwork on desktop". It
   was 40px everywhere, which is a card you can recognise by its colours and
   nothing else. --rt is the one number: the grid column and the picture both
   read it.
   THE NUMBER MOVED INTO THE TEXT, out of a 3.6em column of its own that held
   "#026" and a check and cost the name 60px, so five Classic Collection names
   wrapped at 360. */
.t30-cl{--rt:44px}
.t30-row{display:grid;grid-template-columns:var(--rt) minmax(0,1fr) auto;align-items:center;gap:12px;
  padding:6px 6px 6px 10px;border-bottom:1px solid color-mix(in srgb,var(--keyline) 40%,transparent);position:relative}
/* A card in the binder: a pink edge down the row and a check before its
   number, marks that go nowhere and never touch the card. */
.t30-row.is-have{box-shadow:inset 3px 0 0 var(--ketchup)}
.t30-rn{font:700 var(--t-micro)/1.2 var(--mono);color:var(--ink-2)}
.t30-row.is-have .t30-rn::before{content:"\\2713\\00a0";color:var(--ketchup-deep)}
.t30-rh{position:absolute}
.t30-rt{position:relative;width:var(--rt);aspect-ratio:5/7;border-radius:3px;overflow:hidden;background:var(--paper-3)}
/* A ROW OPENS ITS CARD FROM ANYWHERE ON IT (the script forwards the click to
   the picture, which is the one focusable control), so the whole row answers
   the pointer. */
.t30-row:has(.t30-zm){cursor:zoom-in}
@media(hover:hover){.t30-row:has(.t30-zm):hover{background:color-mix(in srgb,var(--paper-3) 45%,transparent)}}
@media(min-width:600px){.t30-cl{--rt:60px}}
@media(min-width:1000px){.t30-cl{--rt:68px}}
@media(min-width:1280px){.t30-cl{--rt:76px}}
.t30-row .t30-rt .t30-card{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.t30-rm{min-width:0;display:grid;gap:3px}
.t30-rm b{font:700 var(--t-sm)/1.25 var(--body,inherit);color:var(--ink);overflow-wrap:anywhere}
/* 13px, up from 11: the PSA 10 figure and the credit are information. */
.t30-rm i,.t30-rp i{font:400 .8125rem/1.25 var(--body,inherit);font-style:normal;color:var(--ink-2)}
.t30-rm .t30-ri{color:var(--ink-2);opacity:.9}
.t30-rp{display:grid;justify-items:end;gap:2px;text-align:right;white-space:nowrap}
.t30-rp b{font:700 var(--t-sm)/1.2 var(--mono);color:var(--ketchup-deep)}
/* THE FILTERS. Sections: generated per section below. Still need hides rows in
   the binder. Price sort reorders the same grid by rank and drops the section
   headings, which mean nothing in price order. */
#checklist:has(#cln:checked) .t30-row[data-have="1"]{display:none}
.t30-cnt-need{display:none}
#checklist:has(#cln:checked) .t30-cnt-all{display:none}
#checklist:has(#cln:checked) .t30-cnt-need{display:inline-block}
#checklist:has(#clo-price:checked) .t30-row{order:var(--rank)}
#checklist:has(#clo-price:checked) .t30-clh{display:none}
${clCss}
.t30-sum--set{list-style:none;padding:0;margin:var(--s5) 0 var(--s2)}
.t30-sum--set li{background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3);text-align:center}
.t30-sum--set b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep)}
.t30-sum--set span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
@media(max-width:599px){.t30-sum--set{grid-template-columns:repeat(2,minmax(0,1fr))}}
.t30-sum div{background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3);text-align:center}
.t30-sum b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink)}
.t30-sum span{display:block;margin-top:4px;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-bs{margin-top:var(--s5)}
.t30-bs h3{display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap;margin:0}
.t30-cnt{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);background:var(--paper);border:1px solid var(--keyline);border-radius:999px;padding:4px 8px}
.t30-cnt.done{color:var(--ink);border-color:var(--ketchup)}
.t30-bn{color:var(--ink-2);margin:6px 0 var(--s3)}
.t30-bar{height:6px;border-radius:999px;background:var(--paper);border:1px solid var(--keyline);overflow:hidden;margin-bottom:var(--s4)}
/* --hl NEVER EXISTED, and every rule on this page that used it painted nothing.
   Measured on the live page 23 September 2026: the progress-bar fill computed to
   rgba(0,0,0,0), so all six bars -- the "how close to 100%" the owner asked for --
   have shown an empty track since the day they shipped, the fact bullets were
   invisible, and an owned pocket's border fell back to the ink colour. qa-sweep
   could not see it: it measures TEXT contrast and a transparent decorative fill
   is not text. Each use is now a real token by the accent rule -- these are all
   marks that go nowhere, so they are the pink, --ketchup, which clears 3:1 on
   the card for non-text UI. */
.t30-bar span{display:block;height:100%;background:var(--ketchup)}
/* ---------------------------------------------------------- the binder ---
 * A HORIZONTAL SNAP TRACK, WHICH IS WHY THIS NEEDS NO SCRIPT. Each leaf is one
 * full-width column of the track and a snap point, so a browser turns the page
 * itself when an anchor points at the next leaf's id. The page-corner links are
 * those anchors.
 * overflow-x HERE AND NOWHERE ELSE: the site's rule is that the body never
 * scrolls sideways and only a contained object may, which this is. */
.t30-binder{margin:var(--s4) 0 0;max-width:560px}
/* THE COVER IS PAGE 0 AND IT IS A BOARD, NOT A SHEET: --chrome-bg, the page's
   darkest surface, with a stitched inset line, because a binder's cover is
   darker and stiffer than the plastic pages inside it. The inside back cover
   (.t30-leaf-end) is the same board. */
.t30-leaf-cover,.t30-leaf-end{background:var(--chrome-bg)}
.t30-board{height:100%;min-height:22rem;display:grid;align-content:center;justify-items:center;
  gap:10px;text-align:center;padding:var(--s5) var(--s4);border-radius:var(--r-sm);
  box-shadow:inset 0 0 0 1px var(--keyline);outline:1px dashed color-mix(in srgb,var(--keyline) 60%,transparent);
  outline-offset:-9px}
.t30-board img{width:min(240px,70%);height:auto;display:block}
.t30-cover-t{margin:0;font:400 var(--t-l)/1.1 var(--display);color:var(--ink)}
.t30-cover-s{margin:0;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.06em}
.t30-board .t30-bar{width:min(220px,70%);margin:4px 0 0}
/* A REAL CONTROL NOW. It looked like a button and was words: a tap on the cover
   did nothing, and only the 52px corner turned the page. */
.t30-cover-o{margin:var(--s3) 0 0}
.t30-cover-o a{display:inline-grid;place-items:center;min-height:44px;padding:0 18px;border-radius:999px;
  border:1px solid var(--keyline);background:var(--card);color:var(--sky-deep);text-decoration:none;
  font:700 var(--t-micro)/1.3 var(--mono);text-transform:uppercase;letter-spacing:.08em}
.t30-cover-o a:hover,.t30-cover-o a:focus-visible{border-color:var(--sky);color:var(--sky)}
.t30-rings{display:none}
.t30-track{display:grid;grid-auto-flow:column;grid-auto-columns:100%;
  overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;
  scrollbar-width:none;border-radius:var(--r);background:var(--paper);
  border:1px solid var(--keyline);box-shadow:var(--lift)}
.t30-track::-webkit-scrollbar{display:none}
.t30-track:focus-visible{outline:2px solid var(--sky);outline-offset:2px}
/* THE RINGS. Three of them down the left edge, drawn rather than pictured:
   a repeating-linear-gradient costs nothing, scales with the leaf and cannot
   404. They sit in the leaf's own left padding so no pocket overlaps them. */
/* THE BOTTOM PADDING IS WHAT KEEPS THE CORNERS OFF THE CARDS, and it was 6px
   short. The two 44px turn controls sit at the foot of the leaf and were
   overlapping the bottom row of pockets by 4px -- measured, not guessed. The
   controls move down into the padding rather than the grid moving up, so the
   pockets keep their size. */
.t30-leaf{scroll-snap-align:center;scroll-snap-stop:always;position:relative;
  padding:var(--s4) var(--s5) calc(var(--s5) + var(--s4) + 14px) calc(var(--s5) + 10px);
  min-width:0}
.t30-leaf::before{content:"";position:absolute;left:10px;top:12%;bottom:12%;width:12px;
  background:repeating-linear-gradient(to bottom,
    var(--keyline) 0 18px, transparent 18px 34%);
  border-radius:999px;opacity:.85}
/* ONE LINE ON EVERY LEAF, so the pocket grid starts at the same height on all
   26 and does not jump as the pages turn (it moved 27px between leaves). */
.t30-leaf-h{display:flex;align-items:baseline;justify-content:space-between;
  gap:var(--s3);flex-wrap:nowrap;margin:0 0 var(--s3);min-height:1.6em}
.t30-leaf-h b{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t30-leaf-h b{font:400 var(--t-m)/1.1 var(--display);color:var(--ink)}
/* The jumbo leaf's header and the binder caption link to /jumbo-cards.html,
   and ui.css's in-text underline is scoped to \`main p a\`, so neither got it:
   measured, both rendered as plain off-white text with no underline, a link
   nobody could see was one. Same treatment as that rule, copied here. */
.t30-leaf-h b a,.t30-binder figcaption a{color:inherit;text-decoration:underline;
  text-decoration-thickness:1px;text-underline-offset:2px;
  text-decoration-color:color-mix(in srgb,currentColor 45%,transparent)}
.t30-leaf-h b a:hover,.t30-leaf-h b a:focus-visible,
.t30-binder figcaption a:hover,.t30-binder figcaption a:focus-visible{text-decoration-color:currentColor}
.t30-leaf-h span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;flex:none}
/* THE PAGE CORNERS. 44px targets, which is the tap-target floor qa-sweep checks
   and well over its 24px minimum, sitting in the padding the leaf reserved at
   the bottom so they never cover a pocket. */
.t30-turn{position:absolute;bottom:6px;width:44px;height:44px;display:grid;
  place-items:center;text-decoration:none;color:var(--ink-2);
  font:400 var(--t-l)/1 var(--display);background:var(--card);
  border:1px solid var(--keyline)}
.t30-turn.back{left:0;border-radius:0 var(--r) 0 var(--r)}
.t30-turn.fwd{right:0;border-radius:var(--r) 0 var(--r) 0}
.t30-turn:hover,.t30-turn:focus-visible{color:var(--sky);border-color:var(--sky)}

/* ================================================================ BOOK MODE
   23 September 2026. The owner: "Want it to look as much like a real card
   binder as possible, page turn animations, anything to make it look and feel
   like a real binder", with pages side by side on desktop and tablet.

   EVERYTHING BELOW IS BEHIND .is-book, WHICH ONLY THE BINDER SCRIPT SETS. With
   no script the binder is the swipe track above and every control an anchor,
   exactly as before. With it, the leaves stop being a scroller: they are stacked
   in one grid cell (so the binder is always as tall as its tallest page and
   never jumps), only the open page or pages are visible, and a turn is a sheet
   that rotates about the spine in 3D.
   data-mode="one": a phone. One page, rings down the left edge.
   data-mode="two": 900px and up, or 760px held sideways. A tablet upright
   used to get the open binder too, and each pocket came out 71px wide, the
   same as on a phone; one page at 560px is twice that. Rings down the middle.  */
/* THE BOARDS: the binder's own cover, dark, behind and around the pages. Only
   the pages and the rings sit on it; the caption stays outside, under it. */
.t30-binder.is-book{max-width:560px;scroll-margin-top:84px}
/* WIDTH FROM THE SCREEN'S HEIGHT, so the open binder fits under the site bar
   whole. The ratio is measured, not assumed: an open spread is 1.21 times as
   wide as it is tall, and the 1.33 this used left it 30px taller than the
   screen at 1440x900. */
.t30-binder.is-book[data-mode="two"]{max-width:min(1120px,calc((100dvh - 84px) * 1.2));margin-inline:auto}
/* The share link, the page jumps and "Still to find" line up under the binder
   rather than starting at the left edge of the section beside it. */
#masterset:has(.t30-binder[data-mode="two"]) :is(.t30-share,.t30-rail){
  max-width:min(1120px,calc((100dvh - 84px) * 1.2));margin-inline:auto}
#masterset:has(.t30-binder[data-mode="two"]) .t30-needs{
  margin-left:max(0px,calc((100% - min(1120px,calc((100dvh - 84px) * 1.2))) / 2))}
@media(min-width:1000px){#masterset .t30-rail{grid-template-columns:repeat(2,minmax(0,1fr))}}
.is-book .t30-book{position:relative;background:var(--chrome-bg);border:1px solid var(--keyline);
  border-radius:calc(var(--r) + 6px);padding:8px 10px 12px 14px;box-shadow:var(--lift)}
.is-book[data-mode="two"] .t30-book{padding:14px 18px 18px}
/* THE TURNING PAGE STAYS INSIDE THE BINDER. Perspective makes its free edge grow
   as it lifts, and it ran above the binder and over the caption under it. */
.is-book .t30-book{overflow:hidden}
.is-book .t30-track{overflow:visible;scroll-snap-type:none;display:grid;grid-auto-flow:row;
  grid-template-columns:minmax(0,1fr);perspective:3000px;touch-action:pan-y;position:relative;
  border-radius:3px var(--r) var(--r) 3px;background:transparent;
  /* THE PAGES STILL TO TURN, as sheet edges peeking out below and right. --rs
     is set by the script from how far through the binder you are, so the stack
     is thick at the cover and thin at the last page, like the real thing. */
  --rs:6px;--ls:2px;
  box-shadow:calc(var(--rs) * .5) calc(var(--rs) * .5 + 1px) 0 -1px var(--paper),
    calc(var(--rs) * .5) calc(var(--rs) * .5 + 1px) 0 0 var(--keyline),
    var(--rs) calc(var(--rs) + 2px) 0 -1px var(--paper),var(--rs) calc(var(--rs) + 2px) 0 0 var(--keyline),var(--lift)}
/* Open, the turned pages stack on the left (--ls) and the rest on the right. */
.is-book[data-mode="two"] .t30-track{grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  border-radius:var(--r);perspective:3600px;
  box-shadow:calc(var(--ls) * -.5) calc(var(--ls) * .5 + 1px) 0 -1px var(--paper),
    calc(var(--ls) * -.5) calc(var(--ls) * .5 + 1px) 0 0 var(--keyline),
    calc(var(--ls) * -1) calc(var(--ls) + 2px) 0 -1px var(--paper),calc(var(--ls) * -1) calc(var(--ls) + 2px) 0 0 var(--keyline),
    calc(var(--rs) * .5) calc(var(--rs) * .5 + 1px) 0 -1px var(--paper),
    calc(var(--rs) * .5) calc(var(--rs) * .5 + 1px) 0 0 var(--keyline),
    var(--rs) calc(var(--rs) + 2px) 0 -1px var(--paper),var(--rs) calc(var(--rs) + 2px) 0 0 var(--keyline),var(--lift)}
.is-book .t30-leaf{grid-area:1/1;visibility:hidden;background:var(--paper);scroll-snap-align:none}
.is-book .t30-leaf.is-on{visibility:visible}
/* A PAGE NOBODY HAS TURNED TO DOES NOT DOWNLOAD ITS CARDS. visibility:hidden
   keeps a leaf in the layout, and a lazy image in the layout loads when it is
   near the viewport, so all 26 stacked pages fetched their pictures: 122 images
   and 2.19MB never seen. display:none on the PICTURE (not the pocket, whose
   aspect-ratio keeps every page the same height) stops the lazy load; warm()
   still flips the pages either side of the open one to eager, and an eager image
   loads even under display:none, so a turn still lands on pictures that are in. */
.is-book .t30-leaf:not(.is-on) .t30-pk picture,
.is-book .t30-leaf:not(.is-on) .t30-pk img{display:none}
/* On a phone every pixel of width is pocket width: the page's right margin
   drops to --s4 and its left keeps just enough to clear the rings. */
.is-book[data-mode="one"] .t30-leaf{padding-right:var(--s4);padding-left:calc(var(--s4) + 14px)}
/* The folded corners need far less room than the old buttons did: the pocket
   grid ends just outside the fold's diagonal, measured, not a margin to spare. */
.is-book .t30-leaf{padding-bottom:44px}
.is-book[data-mode="one"] .t30-leaf{padding-bottom:54px}
.is-book[data-mode="two"] .t30-leaf.is-r{grid-area:1/2}
.is-book .t30-leaf::before{display:none}
/* THE CURVE INTO THE SPINE. A page does not lie flat where it meets the rings:
   it darkens as it bends away. Drawn as a gradient on the spine side only. */
.is-book .t30-leaf.is-on:not(.t30-leaf-cover):not(.t30-leaf-end),
.is-book .t30-face .t30-leaf:not(.t30-leaf-cover):not(.t30-leaf-end){
  background:linear-gradient(to right,rgb(0 0 0 / .30),rgb(0 0 0 / .08) 5%,transparent 11%),var(--paper)}
.is-book[data-mode="two"] .t30-leaf.is-l:not(.t30-leaf-cover):not(.t30-leaf-end){
  background:linear-gradient(to left,rgb(0 0 0 / .30),rgb(0 0 0 / .08) 5%,transparent 11%),var(--paper);
  padding-left:var(--s5);padding-right:calc(var(--s5) + 18px);border-radius:var(--r) 0 0 var(--r)}
.is-book[data-mode="two"] .t30-leaf.is-r{padding-left:calc(var(--s5) + 18px);border-radius:0 var(--r) var(--r) 0}
.is-book[data-mode="two"] .t30-leaf.is-l.t30-leaf-cover{border-radius:var(--r) 0 0 var(--r)}
/* THE RINGS, drawn over everything including a turning page, because the page
   hangs on them. Three chrome bars across the spine, shaded top to bottom so
   they read as round. Token colours only: --ink-2 highlight to --card shadow. */
.is-book .t30-rings{display:flex;flex-direction:column;justify-content:space-between;
  position:absolute;z-index:40;top:14%;bottom:14%;left:2px;width:28px;pointer-events:none}
.is-book[data-mode="two"] .t30-rings{left:calc(50% - 17px);top:12%;bottom:12%}
.t30-rings i{display:block;height:16px;border-radius:999px;
  background:linear-gradient(to bottom,var(--ink-2),var(--keyline) 45%,var(--card) 100%);
  box-shadow:0 2px 3px rgb(0 0 0 / .45),inset 0 1px 0 rgb(255 255 255 / .35)}
.is-book[data-mode="two"] .t30-rings{width:34px}
.is-book[data-mode="two"] .t30-rings i{height:18px}
/* THE PAGE CORNERS BECOME DOG-EARS: a folded corner you pull, still a 48px
   target, teal when pointed at or focused. Two-page view keeps back on the left
   page and forward on the right, like a real book; neither shows past the ends. */
.is-book .t30-turn{width:52px;height:52px;bottom:0;border:0;border-radius:0;background:none;
  display:grid;place-items:end;padding:0 9px 5px;color:var(--ink-2);font-size:var(--t-m);z-index:6}
.is-book .t30-turn.fwd{right:0;justify-items:end;
  background:linear-gradient(to top left,var(--chrome-bg) 0 48%,var(--keyline) 49% 51%,var(--paper-3) 52%);
  border-radius:0 0 var(--r) 0}
.is-book .t30-turn.back{left:0;justify-items:start;
  background:linear-gradient(to top right,var(--chrome-bg) 0 48%,var(--keyline) 49% 51%,var(--paper-3) 52%);
  border-radius:0 0 0 var(--r)}
.is-book .t30-turn span{display:block;transform:translateY(-14px)}
.is-book .t30-turn.fwd span{transform:translate(-2px,-14px)}
.is-book .t30-turn.back span{transform:translate(2px,-14px)}
.is-book .t30-turn:hover,.is-book .t30-turn:focus-visible{color:var(--chrome-bg);outline:none}
.is-book .t30-turn.fwd:hover,.is-book .t30-turn.fwd:focus-visible{
  background:linear-gradient(to top left,var(--chrome-bg) 0 48%,var(--sky) 49%)}
.is-book .t30-turn.back:hover,.is-book .t30-turn.back:focus-visible{
  background:linear-gradient(to top right,var(--chrome-bg) 0 48%,var(--sky) 49%)}
.is-book[data-mode="two"] .t30-leaf.is-l .t30-turn.fwd,
.is-book[data-mode="two"] .t30-leaf.is-r .t30-turn.back,
.is-book.at-first .t30-leaf.is-on .t30-turn.back,
.is-book.at-last .t30-leaf.is-on .t30-turn.fwd{display:none}
/* THE TURNING SHEET. Built by the script from copies of the pages on its two
   faces, rotated about the spine: the left edge on a phone and when turning
   forward, the right edge of the left page when turning back. */
.t30-sheet{position:absolute;top:0;bottom:0;left:0;width:100%;z-index:30;pointer-events:none;
  transform-style:preserve-3d;-webkit-transform-style:preserve-3d;transform-origin:left center}
.is-book[data-mode="two"] .t30-sheet.fwd{left:50%;width:50%}
.is-book[data-mode="two"] .t30-sheet.back{left:0;width:50%;transform-origin:right center}
.t30-face{position:absolute;inset:0;display:grid;overflow:hidden;
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  box-shadow:0 6px 18px rgb(0 0 0 / .35)}
.t30-face.b{transform:rotateY(180deg)}
.t30-face > .t30-leaf{grid-area:1/1;visibility:visible;height:100%}
.t30-shade{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:9;
  background:linear-gradient(to right,rgb(0 0 0 / .55),rgb(0 0 0 / .15))}
.t30-face.b .t30-shade{background:linear-gradient(to left,rgb(0 0 0 / .55),rgb(0 0 0 / .15))}
/* THE BACK OF A SHEET on a phone, where the page turning away shows its reverse:
   the same nine pockets, empty, as a real sheet's back looks from behind. */
.t30-sheetback{padding:var(--s4) var(--s5) calc(var(--s5) + var(--s4) + 14px);background:var(--paper)}
.t30-sheetback .t30-leaf-h{visibility:hidden}
.is-book .t30-track.is-dragging{cursor:grabbing}
.is-book .t30-track:focus-visible{outline:2px solid var(--sky);outline-offset:4px}
.t30-pkts{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:0}
/* An empty pocket that only exists to keep the page nine pockets tall. Hatched
   rather than blank so it reads as page, not as a missing card. */
.t30-pk.pad{border-style:dashed;opacity:.35;background:var(--chrome-bg)}
.t30-share{margin:var(--s3) 0 0;display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap}
.t30-share-a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;
  border:1px solid var(--keyline);background:var(--card);color:var(--sky-deep);font:700 var(--t-sm)/1 var(--body);text-decoration:none}
.t30-share-a:hover,.t30-share-a:focus-visible{border-color:var(--sky);color:var(--sky)}
.t30-share span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
/* THE PICTURE THAT OPENS THE POP-UP, on a value tile, a hit or a checklist
   row. A bare button: no box of its own, so the card looks exactly as it did
   and only the pointer, a lift on hover and a focus ring say it does more. */
.t30-zm{appearance:none;display:block;padding:0;margin:0;border:0;background:none;color:inherit;font:inherit;
  cursor:zoom-in;border-radius:var(--r-sm);-webkit-tap-highlight-color:transparent}
.t30-ct .t30-zm{width:100%}
/* ONE SHAPE FOR EVERY TILE'S PICTURE. A TCGplayer scan is 0.717 and a TCGdex
   one 0.727, so names sat 4px apart from tile to tile. Contain, never cover:
   the card is drawn whole. */
.t30-ct .t30-zm img{aspect-ratio:63/88;object-fit:contain}
.t30-zm:focus-visible{outline:3px solid var(--sky);outline-offset:3px}
.t30-ct .t30-zm img{transition:transform .18s ease,box-shadow .18s ease}
@media(hover:hover){.t30-ct .t30-zm:hover img{transform:translateY(-3px);box-shadow:0 10px 22px rgb(0 0 0 / .45)}}
@media(prefers-reduced-motion:reduce){.t30-ct .t30-zm img{transition:none}}
/* BIGGER TILES ON A DESKTOP. The top ten is two rows of five, which the note
   on TOP_N always meant and auto-fill never did: at 1440 it drew nine and one.
   The hits take the same size. */
@media(min-width:900px){
  .t30-cts--top{grid-template-columns:repeat(5,minmax(0,1fr));gap:var(--s4)}
  .t30-cts--hits{grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr));gap:var(--s4)}
  .t30-cts--top .t30-ct-n,.t30-cts--hits .t30-ct-n{font-size:var(--t-body)}
}
/* ============================================================ THE ENLARGED CARD
   25 September 2026. The owner: "when you click on them it pop up the card
   larger so you can see it in detail, and give you the market value for the raw
   and psa 10 if available ... make sure that info is not covering the cards
   artwork at all". So the card and the words never share a box: on a phone the
   card sits above the panel, from 760px beside it, and the close button lives in
   its own bar above the card rather than on it. A price that is not published is
   not drawn, not drawn as a dash. */
.t30-lb{margin:auto;padding:0;border:1px solid var(--keyline);border-radius:var(--r);background:var(--chrome-bg);color:var(--ink);
  width:min(94vw,900px);max-width:94vw;max-height:94dvh;box-shadow:0 20px 60px rgb(0 0 0 / .6)}
/* margin:auto IS WHAT CENTRES A MODAL DIALOG, and ui.css's reset zeroes every
   margin, so without it the card opened pinned to the top left corner. */
.t30-lb::backdrop{background:rgb(8 14 11 / .82)}
.t30-lb-in{display:flex;flex-direction:column;max-height:94dvh}
.t30-lb-top{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);
  padding:6px 6px 6px var(--s4);border-bottom:1px solid var(--keyline)}
.t30-lb-count{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.06em;text-transform:uppercase;margin:0}
.t30-lb-x{appearance:none;border:1px solid var(--keyline);background:var(--card);color:var(--ink);
  width:44px;height:44px;border-radius:999px;font:400 28px/1 var(--body);cursor:pointer;display:grid;place-items:center}
.t30-lb-x:hover{border-color:var(--sky);color:var(--sky)}
.t30-lb-x:focus-visible,.t30-lb-go:focus-visible{outline:3px solid var(--sky);outline-offset:2px}
.t30-lb-body{display:flex;flex-direction:column;gap:var(--s4);padding:var(--s4);overflow:auto;overscroll-behavior:contain}
/* THE CARD NEVER SHRINKS INTO THE PANEL. On a 664px tall phone the figure was
   allowed below the picture's height, so the card spilled up under the top bar
   and down under its own name. The figure keeps its size, the image is capped to
   leave the panel room, and the body scrolls if a phone is shorter still. The
   page behind does not scroll while the card is open. */
html:has(dialog.t30-lb[open]){overflow:hidden}
.t30-lb-fig{display:flex;justify-content:center;align-items:center;flex:none;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.t30-lb-fig img{-webkit-user-drag:none}
.t30-lb-nav .t30-lb-close{flex:0 0 auto;padding:0 18px;color:var(--ink)}
/* THE CARD, WHOLE. Contain, never cover, so no edge of the card is cropped, and
   capped by the viewport's height so the panel under it is still on screen. */
/* A HEIGHT, NOT A MAX-HEIGHT: with only a cap the box was 0px tall until the
   picture arrived, so the panel jumped and a quick second tap on Next landed on
   whatever had moved under it. */
/* The second term is the width the panel has on a phone (94vw, less the
   border and padding) turned into a height, so a narrow phone gets a smaller
   card rather than a card letterboxed in a taller box. */
.t30-lb-img{display:block;width:auto;height:min(max(220px,min(62dvh,640px,calc(94dvh - 360px))),calc((94vw - 34px) * 1.397));max-width:100%;aspect-ratio:63/88;
  object-fit:contain;border-radius:4.6%/3.3%;background:var(--paper);box-shadow:0 8px 24px rgb(0 0 0 / .45)}
.t30-lb-info{min-width:0}
.t30-lb-info h3{font:400 var(--t-l)/1.1 var(--display);margin:0 0 6px}
.t30-lb-meta{font:700 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);letter-spacing:.04em;text-transform:uppercase;margin:0}
.t30-lb-meta b{color:var(--ink);font-weight:700}
.t30-lb-px{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--s3);margin:var(--s4) 0 0}
.t30-lb-px div{background:var(--card);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3)}
.t30-lb-px dt{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.05em;text-transform:uppercase}
.t30-lb-px dd{margin:4px 0 0;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep)}
/* The hit tile's route to its rip, which the picture no longer is. Teal: a route. */
.t30-ct-w{margin:6px 0 0;font:700 var(--t-sm)/1.3 var(--body,inherit);color:var(--sky-deep)}
.t30-ct>a:hover .t30-ct-w,.t30-ct>a:focus-visible .t30-ct-w{color:var(--sky)}
.t30-lb-ill{margin:6px 0 0;font:400 var(--t-sm)/1.4 var(--body);color:var(--ink-2)}
.t30-lb-rip{margin:var(--s3) 0 0;font:700 var(--t-sm)/1.4 var(--body)}
.t30-lb-rip a{color:var(--sky-deep)}
.t30-lb-rip a:hover,.t30-lb-rip a:focus-visible{color:var(--sky)}
.t30-lb-src{font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2);margin:var(--s2) 0 0}
.t30-lb-nav{display:flex;gap:var(--s3);margin-top:var(--s4)}
.t30-lb-go{appearance:none;flex:1;min-height:44px;border:1px solid var(--keyline);background:var(--card);color:var(--sky-deep);
  border-radius:999px;font:700 var(--t-sm)/1 var(--body);cursor:pointer}
.t30-lb-go:hover,.t30-lb-go:focus-visible{border-color:var(--sky);color:var(--sky)}
@media(min-width:760px){
  .t30-lb-body{flex-direction:row;align-items:center;padding:var(--s5)}
  .t30-lb-fig{flex:0 0 auto}
  .t30-lb-img{height:min(78dvh,620px,calc(94dvh - 120px))}
  .t30-lb-info{flex:1}
}

/* The per-section summary that replaced the old stacked headings. */
.t30-secsum{list-style:none;margin:var(--s4) 0 0;padding:0;display:grid;gap:var(--s3);
  grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))}
.t30-secsum a{display:block;text-decoration:none;background:var(--card);
  border:1px solid var(--line);border-radius:var(--r);padding:var(--s3)}
.t30-secsum a:hover,.t30-secsum a:focus-visible{border-color:var(--sky)}
.t30-secsum b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ink)}
.t30-secsum b i{font-style:normal;font-size:var(--t-sm);color:var(--ink-2)}
.t30-secsum span{display:block;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.t30-secsum .t30-bar{margin:6px 0 0;height:8px}
/* All seven in one row on a desktop; auto-fit drew six and one at 1024. */
@media(min-width:1000px){.t30-secsum{grid-template-columns:repeat(${sectionSummaryN},minmax(0,1fr))}.t30-secsum span{letter-spacing:0}}
.t30-needs{margin:var(--s5) 0 0;max-width:560px}
.t30-needs h3{margin:0 0 var(--s3);font:400 var(--t-m)/1.15 var(--display);color:var(--ink)}
.t30-need{background:var(--card);border:1px solid var(--keyline);border-radius:var(--r-sm);margin:0 0 var(--s2)}
.t30-need summary{display:flex;align-items:center;justify-content:space-between;gap:var(--s3);
  min-height:44px;padding:0 var(--s3);cursor:pointer;list-style:none}
.t30-need summary::-webkit-details-marker{display:none}
.t30-need summary b{font:700 var(--t-body)/1.2 var(--body,inherit);color:var(--ink)}
.t30-need summary span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-need summary:hover span,.t30-need summary:focus-visible span{color:var(--sky)}
.t30-need summary::after{content:"+";font:700 var(--t-m)/1 var(--mono);color:var(--ink-2)}
.t30-need[open] summary::after{content:"\u2212"}
.t30-need ul{list-style:none;margin:0;padding:0 var(--s3) var(--s3);display:grid;gap:6px;
  grid-template-columns:repeat(auto-fill,minmax(15em,1fr))}
.t30-need li{font-size:var(--t-sm);color:var(--ink);line-height:1.35}
.t30-need li span{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);margin-right:4px}
.t30-need li i{font-style:normal;color:var(--ink-2);font-size:var(--t-micro)}
/* The page rail. Grouped by section, because "page 14" means nothing and
   "main set 6" does. */
.t30-rail{margin:var(--s4) 0 0;display:grid;gap:var(--s3)}
.t30-railg{display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap}
.t30-railg>span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.04em;min-width:9rem}
.t30-railg p{display:flex;gap:6px;flex-wrap:wrap;margin:0}
.t30-railg a{display:grid;place-items:center;min-width:44px;min-height:44px;
  padding:0 6px;text-decoration:none;border-radius:var(--r-sm);
  background:var(--paper);border:1px solid var(--keyline);
  font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
/* A PAGE WITH CARDS ON IT IS SOLID, AN EMPTY ONE DASHED, and neither is pink.
   This was a pink border on 24 of the 26 and, loading after ui.css at equal
   specificity, it beat the teal current-page rule, so "you are here" was pink:
   a route painted in the colour this site keeps for marks that go nowhere. */
.t30-railg a:not(.filled){border-style:dashed}
.t30-railg a.filled{color:var(--ink)}
.t30-railg a:hover,.t30-railg a:focus-visible{border-color:var(--sky);color:var(--sky)}
.t30-railg a.is-here,.t30-railg a[aria-current="page"]{border:2px solid var(--sky);
  color:var(--ink);background:var(--paper-3);font-weight:700}
/* SMOOTH ONLY WHERE MOTION IS WELCOME. Three other places on this site honour
   this and a page that slides sideways is exactly the kind a reader who asked
   for less motion does not want. */
@media(prefers-reduced-motion:no-preference){
  .t30-track{scroll-behavior:smooth}
}
/* A POCKET IS A SLEEVE, NOT A BOX. The inset shadow is the only thing that
   says 'the card is behind plastic' and it costs nothing; the filled ones
   keep their outer lift so an owned card still sits proud of the page. */
.t30-pk{border:1px dashed var(--keyline);border-radius:var(--r-sm);background:var(--paper);box-shadow:inset 0 1px 3px rgb(0 0 0 / .22);
  display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:4px;padding:5px 5px 3px;text-align:center;min-width:0}
/* THE CARD FRAME, 25 September 2026: the card at a real card's own shape (63 by
   88mm) with a real card's rounded corners, and NOTHING drawn over it but the
   sleeve's faint sheen. The label strip is its sibling, underneath. It is the
   <button> that opens the enlarged card; a pad's frame is a plain span. */
.t30-cf{appearance:none;-webkit-appearance:none;display:block;position:relative;width:100%;aspect-ratio:63/88;
  flex:none;padding:0;margin:0;border:0;background:none;color:inherit;font:inherit;text-align:inherit;
  border-radius:4.6%/3.3%;overflow:hidden}
button.t30-cf{cursor:zoom-in}
button.t30-cf:focus-visible{outline:3px solid var(--sky);outline-offset:2px}
@media(prefers-reduced-motion:no-preference){
  button.t30-cf{transition:transform .15s cubic-bezier(.2,.7,.3,1)}
  button.t30-cf:hover{transform:translateY(-2px)}
}
.t30-pk .t30-pn{font:700 var(--t-micro)/1 var(--mono)}
.t30-pk.has{border-style:solid;border-color:var(--ketchup);background:var(--card);box-shadow:inset 0 1px 3px rgb(0 0 0 / .18),var(--lift)}
/* .t30-got is gone with the date overlay it styled, 22 September 2026. */
.t30-more{color:var(--ink-2);font-size:var(--t-sm);margin-top:var(--s3)}
.t30-wave{margin-top:var(--s4)}
/* --t-m, not --t-l: a release date in Titan One at 32px outshouted the section's
   own 25px heading above it. */
.t30-wave h3{margin:0 0 var(--s3);font:400 var(--t-m)/1.15 var(--display)}
.t30-wave ul{list-style:none;display:grid;gap:var(--s3);margin:0}
.t30-wave li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);padding:var(--s3);display:grid;gap:4px}
.t30-p{font-weight:700;color:var(--ink)}
.t30-p a{color:var(--sky-deep);text-decoration:underline;text-underline-offset:2px;text-decoration-color:color-mix(in srgb,currentColor 45%,transparent)}
.t30-p a:hover,.t30-p a:focus-visible{text-decoration-color:currentColor}
/* A product with an opening page answers a tap anywhere on its card: the name
   alone was a 21px tall target. */
.t30-wave li:has(.t30-p a){position:relative}
.t30-wave li:has(.t30-p a):hover{border-color:var(--sky)}
.t30-p a::after{content:"";position:absolute;inset:0}
.t30-meta{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.45}
.t30-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--keyline);border-radius:var(--r-sm);margin-top:var(--s4)}
.t30-tbl{border-collapse:collapse;width:100%;min-width:24em;font-size:var(--t-sm)}
.t30-tbl th,.t30-tbl td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--keyline);white-space:nowrap}
.t30-tbl th{font:700 var(--t-micro)/1 var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2);position:sticky;top:0;background:var(--card)}
.t30-tbl td:nth-child(1){font-family:var(--mono);color:var(--ink-2)}
.t30-tbl tr:last-child td{border-bottom:0}
/* ON A PHONE A --fit TABLE STACKS: each row is the number over its words, with
   the header kept for screen readers. Nothing is left off to the side. */
@media(max-width:599px){
  .t30-tbl.t30-tbl--fit{min-width:0}
  .t30-tbl--fit,.t30-tbl--fit tbody{display:block}
  .t30-tbl--fit thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .t30-tbl--fit tr{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;padding:8px 10px;border-bottom:1px solid var(--keyline)}
  .t30-tbl--fit tr:last-child{border-bottom:0}
  .t30-tbl.t30-tbl--fit td{border:0;padding:0}
  .t30-tbl--fit td:nth-child(3){grid-column:2;color:var(--ink-2)}
  .t30-tbl--fit caption{display:block;padding:8px 10px}
}
.t30-src{list-style:none;margin:var(--s4) 0 0;display:grid;gap:8px}
.t30-src li{overflow-wrap:anywhere;font-size:var(--t-sm)}
/* A PARAGRAPH IN THE BODY FACE. price-note is mono at .68rem, right for a
   one line credit under a table and hard going for these two, which run to
   seventy words each. */
.price-note.t30-prose{font:400 var(--t-sm)/1.55 var(--body,inherit);max-width:46em}
`;

/* LED BY WHAT PEOPLE SEARCH FOR, 23 September 2026: "30th celebration card
   list", "checklist", "most valuable", "release dates". The old title led with
   products, and the description never said checklist or most valuable. */
const TITLE = "Pokemon 30th Celebration Card List, Values and Release Dates";
const DESC =
  `The full 30th Celebration checklist with every card's price, the most valuable cards, ` +
  `every product and release date, and what is in a pack.`;
/* COMPUTED, BECAUSE THE TYPED VERSION SAID 176 WHILE THE PAGE SAID 173. Japan's
   set is 176 cards and 173 of them are revealed; japanList holds the revealed
   ones, and the H2 has always printed its length. The meta description and the
   JSON-LD were the only places still claiming the full 176, which is a
   machine-readable claim to a search engine that the page carries a list it
   does not have. */

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: clipMeta(DESC),
    url: SITE + PATH,
    dateModified: PAGE_CHECKED,
    author: { "@type": "Organization", name: "Garbage Rips 585" },
    publisher: { "@type": "Organization", "@id": SITE + "/#org", name: "Garbage Rips 585", url: SITE + "/" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Sets", item: SITE + "/sets/" },
      { "@type": "ListItem", position: 3, name: "30th Celebration", item: SITE + PATH },
    ],
  },
];

/* ---------------------------------------------------------- the value bands --
 *
 * The owner, 16 September 2026: "want to see what cards in the set are the most
 * valuable", and "we can show the market prices for the NM singles, like the
 * other sets". Like the other sets is the operative half: these are
 * PriceCharting guide values, the same figure /sets/chaos-rising.html prints,
 * so a number here can be compared with a number there.
 *
 * HE EXPECTED NO PSA 10 PRICES AND THERE ARE SOME. 25 of the 51 priced cards
 * already carry one the day after release, so the line renders where it exists
 * and is left off where it does not, which is the same rule build-pages.mjs
 * uses on a rip page.
 *
 * THE SECTION SAYS HOW MUCH OF THE SET IT HAS PRICED. A set one day old is
 * mostly unpriced -- 51 of 199 -- and a "most valuable" list that does not say
 * so invites a reader to think the other 148 are worthless. They are unpriced.
 */
/* TEN, so it fills two rows of five at desktop width; twelve wrapped nine and three. */
const TOP_N = 10;
/* THE PRODUCTS THAT HOLD PACKS. The Battle Deck is a product of this set with
   no booster in it, so "every pack comes inside one of 15 products" was one
   too many. */
const PACK_PRODUCTS = doc.products.filter((p) => p.packs).length;
/* WHAT THE SET ADDS UP TO, 25 September 2026, out of the same PriceCharting
   figures the tiles print: a sum, a median and two counts. Arithmetic only and
   no expected value, which would need pull rates nobody has published. It
   answers the question a viewer arrives with from a rip, "is it worth it", the
   honest way: most cards are worth little and the money is in a few. */
const RAWS = pricedCards.map((c) => c.pr.raw).sort((a, b) => a - b);
const SET_SUM = RAWS.reduce((a, v) => a + v, 0);
const SET_MED = RAWS.length ? (RAWS.length % 2 ? RAWS[(RAWS.length - 1) / 2] : (RAWS[RAWS.length / 2 - 1] + RAWS[RAWS.length / 2]) / 2) : 0;
const UNDER_1 = RAWS.filter((v) => v < 1).length;
const OVER_20 = RAWS.filter((v) => v >= 20).length;
const valueBand = !pricedCards.length ? "" : `
<section class="band tight" id="values">
  <div class="wrap">
    <p class="sec-label">The ones you want</p>
    <h2>Most valuable <span class="hl">30th Celebration</span> cards</h2>
    <p class="lede" style="max-width:44em">The top ${Math.min(TOP_N, pricedCards.length)} by what an ungraded copy is worth.
      ${pricedCards.length} of the ${TOTAL} cards have a price, ${prices.counts && prices.counts.psa10 ? `${prices.counts.psa10} with a PSA 10 figure; ` : ""}the
      rest have not sold enough yet for a guide value. Every price is in the <a href="#checklist">checklist</a>,
      which sorts by price too.</p>
    <ol class="t30-cts t30-cts--top" data-zg="values">
${pricedCards.slice(0, TOP_N).map((c) => cardTile(c)).join("\n")}
    </ol>
    <ul class="t30-sum t30-sum--set" aria-label="The priced cards, added up">
      <li><b>${esc(moneyRound(SET_SUM))}</b><span>All ${pricedCards.length} priced cards, one of each, raw</span></li>
      <li><b>${esc(moneyExact(SET_MED))}</b><span>The median card</span></li>
      <li><b>${UNDER_1}</b><span>Cards under $1</span></li>
      <li><b>${OVER_20}</b><span>Cards at $20 or more</span></li>
    </ul>
    <p class="price-note">Raw NM and PSA 10 are pricecharting.com guide values, read ${esc(
      longDate(prices.checked || doc.checked)
    )}. A guide value is computed across the sales PriceCharting tracks, which is wider than any one
      marketplace. The Classic Collection is priced too: its 30 cards are reprints that keep their original
      numbering, so each is matched on its name and that number together. We do not sell cards.</p>
  </div>
</section>`;

/* ------------------------------------------------------------ the rarities --
 *
 * WHAT IS ACTUALLY RARE, counted out of the checklist rather than typed. Every
 * other set guide carries this band and it is the one a reader uses to work out
 * what a pack can even contain. TCGplayer's own rarity names are used verbatim,
 * including "Pikachu Rare", which is this set's own tier and not a name this
 * site invented.
 */
const rarityRows = (() => {
  const tally = new Map();
  for (const c of checklist.cards || []) {
    const k = c.rarity || "Not stated";
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]);
})();
const rarityBand = !rarityRows.length ? "" : `
<section class="tight" id="rarity">
  <div class="wrap">
    <p class="sec-label">What is actually rare</p>
    <h2>Rarity breakdown</h2>
    <p style="max-width:44em">Counted off the ${
      (checklist.cards || []).length
    } cards on the checklist, not typed in. <strong>Every card in this set is foil</strong>, basic Energy
      included, so a rarity here is about how hard a card is to find rather than whether it shines.</p>
    <ul class="t30-rar" data-zg="rarity">
${rarityRows
  .map(
    ([name, n]) => {
      /* WHAT THE RARITY LOOKS LIKE, 25 September 2026: nine bare numbers on
         a page about card art. Each tile shows the dearest card of its rarity
         (or the first on the checklist where none is priced), and opens it. */
      const c = pricedCards.find((x) => x.rarity === name) || (checklist.cards || []).find((x) => x.rarity === name);
      const pic = c ? pictureFor(c.name, { n: c.n, row: c, section: c.section, sizes: "(max-width:1099px) 28vw, 130px" }) : "";
      return `      <li>${pic ? `<button type="button" class="t30-zm"${zoomOf(c)} aria-label="Show ${esc(c.name)} ${esc(pocketLabel(c.section, c.n))}, a ${esc(name)}, larger">${pic}</button>` : ""}<b>${n}</b><span>${esc(name)}</span></li>`;
    }
  )
  .join("\n")}
    </ul>
  </div>
</section>`;

/* ------------------------------------------------------------ the checklist --
 *
 * EVERY CARD, WHICH IS THE SECTION THIS PAGE MOST OBVIOUSLY LACKED. Grouped by
 * the same five sections the binder uses, so the page tells one story about how
 * the set is put together. It is the whole checklist and not a sample: a set
 * guide that shows twelve cards and calls itself a checklist is the thing a
 * reader came here to avoid.
 */
/* THE CHECKLIST IS A LIST, 23 September 2026. It was 188 picture tiles two to
   a row, 32,647px at 390 -- 57% of the whole page. A row per card (number, a
   small picture, name, rarity, raw and PSA 10) says the same in about a third
   of the height, and a checklist is read down a column anyway.

   FILTERS WITH NO SCRIPT. Section, "still need" and a price sort are radio and
   checkbox inputs inside the section, and CSS :has() hides or reorders rows. A
   browser without :has() shows every row in number order, which is the page
   this replaced, so nothing is lost where it is not supported. The price sort
   is flex `order` from --rank, each row's place in pricedCards; unpriced rows
   sort last. "Still need" reads the binder's own owned list, the same join the
   "Still to find" lists use, so the two cannot disagree. */
const clRank = new Map(pricedCards.map((c, i) => [clKey(c.section, c.n), i + 1]));
const clOwned = new Set(owned.map((c) => clKey(c.section, c.n || "")));
const clRow = (c) => {
  const k = clKey(c.section, c.n), pr = priceOf(c), have = clOwned.has(k), ill = illOf(c.section, c.n);
  const pic = pictureFor(c.name, { n: c.n, row: c, section: c.section, low: true });
  return `      <li class="t30-row${have ? " is-have" : ""}" data-s="${esc(c.section)}"${have ? ' data-have="1"' : ""} style="--rank:${clRank.get(k) || 9999}">
        ${pic ? `<button type="button" class="t30-rt t30-zm"${zoomOf(c)} aria-label="Show ${esc(c.name)} ${esc(pocketLabel(c.section, c.n))} larger">${pic}</button>` : `<span class="t30-rt"></span>`}
        <span class="t30-rm"><b>${esc(c.name)}</b><i><span class="t30-rn">#${esc(pocketNum(c.section, c.n))}</span> &middot; ${esc(
          /* A Pikachu's place in the thirty, which is how the owner counts them
             ("x/30"), in place of "Pikachu Rare" printed thirty times. */
          c.section === "pikachu" ? `${Number(String(c.n).split("/")[0]) - 22} of 30` : c.rarity || ""
        )}</i>${ill ? `<i class="t30-ri">Illus. ${esc(ill)}</i>` : ""}</span>
        <span class="t30-rp">${pr && typeof pr.raw === "number"
          ? `<b>${moneyExact(pr.raw)}</b>${typeof pr.psa10 === "number" ? `<i>${moneyRound(pr.psa10)} PSA 10</i>` : ""}`
          : `<i>No price yet</i>`}</span>
        ${have ? `<span class="t30-rh" title="In the binder"><span class="t30-sr">In the binder</span></span>` : ""}
      </li>`;
};
const checklistBand = !(checklist.cards || []).length ? "" : `
<section class="band tight" id="checklist">
  <div class="wrap">
    <p class="sec-label">Every card</p>
    <h2>30th Celebration checklist: <span class="hl">every numbered card</span></h2>
    <p class="lede" style="max-width:44em">${(checklist.cards || []).length} of the ${TOTAL} are listed here,
      ${pricedCards.length} with a raw price${prices.counts && prices.counts.psa10 ? ` and ${prices.counts.psa10} with a PSA 10` : ""}. Not listed here: the ${E.energy} foil basic Energy, which are numbered in their own MEE set and
      live in the binder above. Filter by section, sort by price, or show only the cards still missing from the
      binder.</p>
    <form class="t30-clf" onsubmit="return false" aria-label="Filter the checklist">
      <fieldset><legend>Show</legend>
        <input type="radio" name="cls" id="cls-all" checked><label for="cls-all">All</label>
${clSections.map(([key, label]) => `        <input type="radio" name="cls" id="cls-${key}"><label for="cls-${key}">${esc(label.replace(/^The /, ""))}</label>`).join("\n")}
      </fieldset>
      <fieldset><legend>Sort</legend>
        <input type="radio" name="clo" id="clo-num" checked><label for="clo-num">Number</label>
        <input type="radio" name="clo" id="clo-price"><label for="clo-price">Price</label>
      </fieldset>
      <fieldset><legend>Binder</legend>
        <input type="checkbox" id="cln"><label for="cln">Still need</label>
      </fieldset>
    </form>
    <ol class="t30-cl" data-zg="checklist">
${clSections.map(([key, label]) => {
  const rows = (checklist.cards || []).filter((c) => c.section === key);
  /* TWO COUNTS, ONE SHOWN. Under "Still need" the heading counted every row
     while only the missing ones showed: 30 over five Pikachu. */
  const need = rows.filter((c) => !clOwned.has(clKey(c.section, c.n))).length;
  return `      <li class="t30-clh" data-s="${key}">${esc(label)} <span class="t30-cnt t30-cnt-all">${rows.length}</span><span class="t30-cnt t30-cnt-need">${need} to find</span></li>
${rows.map(clRow).join("\n")}`;
}).join("\n")}
    </ol>
    <p class="price-note">Raw NM and PSA 10 are pricecharting.com guide values, read ${esc(
      longDate(prices.checked || doc.checked)
    )}. A tick marks a card already in the binder.</p>
  </div>
</section>`;

/* ------------------------------------------------------------ pulled on camera --
 *
 * The owner, 18 September 2026: "also on the set page for what hits we have
 * gotten from the set so far".
 *
 * ONE ROW PER HIT, NEWEST FIRST, each linking to the rip it came out of. The
 * card picture comes from pictureFor() like everything else on this page, so a
 * hit and its binder pocket cannot show different art. The NUMBER is the join:
 * a hit row carries the collector number the owner typed, and that is what
 * finds the checklist row that carries the product id.
 *
 * IT SAYS WHAT IT DOES NOT KNOW. A card PriceCharting has not priced yet shows
 * no figure rather than a zero, and on a set two days old that is most of them.
 */
const setHits = (() => {
  const byId = new Map(VIDS.map((v) => [v.id, v]));
  const rows = [];
  for (const [vid, list] of Object.entries(HITS)) {
    for (const h of list || []) {
      if (h.set !== doc.set.slug) continue;
      const v = byId.get(vid);
      if (!v) continue;
      const n = String(h.number || "");
      /* MATCH ON THE NUMERATOR, NOT ON A FABRICATED "main" KEY.
         This compared clKey(c.section, c.n) -- "pikachu|23" for a Pikachu --
         against clKey("main", n) -- "main|23" -- so the section prefix could
         never agree unless the card happened to be in `main`. 60 of the 188
         checklist cards, every Pikachu and every secret rare, were
         unreachable: a hit on Mew ex 158 rendered "No price yet" and no
         picture on this band while the value band 15 sections above printed
         the same card at $1,075 with its scan. Classic keeps its exact-string
         key because that subset reuses numerators. */
      const numKey = String(n).split("/")[0].replace(/^0+/, "") || "0";
      /* THE NAME HAS TO AGREE TOO, AND IT DID NOT. This matched on the NUMBER
         alone, so any hit whose number belongs to a different card in this set
         borrowed that card's picture and price under its own name. It is not
         hypothetical: the Greninja ex Black Star Promo is numbered 099 and 099
         in the main set is HYDREIGON, so adding that promo rendered a Greninja
         ex row wearing Hydreigon's scan and Hydreigon's figure. A number is not
         a key across a set that has promos beside it, and a row that fails to
         match should fall through to name-only -- which this band already
         handles -- rather than match the wrong thing confidently. */
      const nm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const sameName = (c) => nm(c.name) === nm(h.card);
      const row = (() => {
        const cl = CHECKLIST.get(clKey("classic", n));
        if (cl && sameName(cl)) return cl;
        return [...CHECKLIST.values()].find(
          (c) =>
            c.section !== "classic" &&
            (String(c.n).split("/")[0].replace(/^0+/, "") || "0") === numKey &&
            sameName(c)
        ) || null;
      })();
      const pr = row ? priceOf(row) : null;
      /* A PROMO HAS NO CHECKLIST ROW AND DREW AN EMPTY FRAME HERE, the Greninja
         ex Black Star Promo first. The binder's own promo list carries the
         TCGplayer product id, matched on name AND number for the same reason
         as above. It lends the PICTURE only, never a price: `pr` stays null. */
      const promoPid = !row && h.promo
        ? (promos.find((o) => sameName(o) && (String(o.n).replace(/^0+/, "") || "0") === numKey)?.pid ?? null)
        : null;
      /* AND ITS PRICE, once PriceCharting has one, from the same file every
         other price on this page comes from. Keyed promo|<number> and held to
         the same name check, so it cannot borrow Hydreigon's 099 either. */
      const promoPr = !row && h.promo ? (prices.promos || {})[`promo|${String(n).padStart(3, "0")}`] : null;
      rows.push({ h, v, row, pr: pr || (promoPr && sameName(promoPr) ? promoPr : null), promoPid, section: row ? row.section : null });
    }
  }
  rows.sort((a, b) => String(b.v.publishedAt ?? "").localeCompare(String(a.v.publishedAt ?? "")));
  return rows;
})();

const hitsBand = !setHits.length ? "" : `
<section class="tight" id="hits">
  <div class="wrap">
    <p class="sec-label">Pulled on camera</p>
    <h2>What we have hit from <span class="hl">this set</span></h2>
    <p class="lede" style="max-width:44em">${setHits.length} hit${setHits.length === 1 ? "" : "s"} from
      ${setHits.length === 1 ? "one rip" : `${new Set(setHits.map((r) => r.v.id)).size} rips`} so far. Every one
      links to the rip it came from.${(() => {
        const pn = setHits.filter((r) => !r.row && r.h.promo).length;
        return pn ? ` The count includes ${pn === 1 ? "one Black Star promo" : `${pn} Black Star promos`}.` : "";
      })()} This is a different list from the binder below: the binder is every
      card owned however it got there, and this is only what came out on camera.</p>
    <ol class="t30-cts t30-cts--hits" data-zg="hits">
${setHits
  .map(({ h, v, row, pr, promoPid }) => {
    /* No normalising here any more: dexLocalId() inside pictureFor() takes the
       number in either shape, which is the whole point of moving it there. */
    const pic = pictureFor(h.card, { n: row ? row.n : h.number, row: row || (promoPid ? { pid: promoPid } : null), section: row ? row.section : null, sizes: TILE_SIZES });
    /* THE FULL NUMBER FOR A CLASSIC COLLECTION CARD, because "69" on its own
       is not what the card says and is not unique in that section -- it holds
       two 11s and three 106s. Everything else is numbered in the 30th's own
       sequence, where the numerator is the whole answer. */
    const num = (!row && h.promo ? "MEP " : "#") +
      (row && row.section === "classic" ? String(h.number) : String(h.number).split("/")[0]);
    /* THE PICTURE ENLARGES AND THE WORDS GO TO THE RIP. They used to be one
       link, and a button cannot sit inside a link, so the tile is two controls
       now; the pop-up offers the rip as well, so the picture loses nothing. */
    const zoom = zoomAttrs({
      name: h.card,
      num,
      rar: row?.rarity || h.rarity,
      big: row ? bigOf({ section: row.section, n: row.n }, row) : promoPid ? bigOf({}, { pid: promoPid }) : "",
      px: pr,
      /* NOT "in the binder": the binder and the hits are separate lists by
         the owner's rule, so a hit's pop-up says when it was pulled instead. */
      when: shortDate(v.published),
      rip: "/" + v.path,
      ill: row ? illOf(row.section, row.n) : "",
    });
    return `        <li class="t30-ct${pic ? "" : " nopic"}">
          ${pic ? `<button type="button" class="t30-zm"${zoom} aria-label="Show ${esc(h.card)} ${esc(num)} larger">${pic}</button>` : ""}
          <a href="/${esc(v.path)}">
            <p class="t30-ct-n">${esc(h.card)}</p>
            <p class="t30-ct-m">${esc(num)}${
              /* The checklist's spelling of the rarity when the card has a row:
                 the owner's typed "Double rare" sat beside "Double Rare". */
              row?.rarity || h.rarity ? ` &bull; ${esc(row?.rarity || h.rarity)}` : ""
            }</p>
            ${
              pr && typeof pr.raw === "number"
                ? `<p class="t30-ct-p">${moneyExact(pr.raw)}<span>raw NM</span></p>`
                : `<p class="t30-ct-p none">No price yet</p>`
            }
            <p class="t30-ct-v">Pulled ${esc(shortDate(v.published))}</p>
            <p class="t30-ct-w">Watch the rip &rarr;</p>
          </a>
        </li>`;
  })
  .join("\n")}
    </ol>
  </div>
</section>`;

const body = `<main id="main">
<script>
/* ONE RETRY, THEN THE CARD BACK. Every card picture on this page carried
   onerror="this.remove()", so a single dropped request -- a tunnel, a wifi to
   LTE handoff -- blanked that pocket until a reload. First failure: drop the
   AVIF source and the srcset and ask for the small file again after 1.5s.
   Second failure: remove the picture, and the .t30-ph card behind it shows the
   number and the name. Defined here, before the first image, so an early error
   has a handler to call. */
function t30e(i){var p=i.parentNode,box=p&&p.tagName==="PICTURE"?p:i;
/* Outside a binder pocket (a checklist or value tile) there is no card back
   under the picture, and removing it collapsed the tile: CLS 2.51 on a run
   where TCGdex was failing. There it is hidden and keeps its space. */
if(i.getAttribute("data-r")){if(i.closest&&!i.closest(".t30-pk")){box.style.visibility="hidden";return}box.remove();return}
i.setAttribute("data-r","1");
if(box!==i){var s=p.querySelectorAll("source");for(var k=0;k<s.length;k++)s[k].remove()}
var u=i.getAttribute("src")||"";i.removeAttribute("srcset");i.removeAttribute("sizes");
setTimeout(function(){i.src=u+(u.indexOf("?")<0?"?r=1":"&r=1")},1500)}
/* AND THE CARD BACK STEPS OUT ONCE THE PICTURE IS IN. A grey card is drawn at
   78% opacity, so the name on the card back underneath showed through it. */
function t30l(i){var k=i.closest&&i.closest(".t30-pk");if(k)k.classList.add("ld")}
</script>

<header class="band-sky tight">
  <div class="wrap t30-top">
    <div class="t30-top-l">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/sets/">Sets</a> / 30th Celebration</nav>
    ${heroLogo()}
    <h1>Pokemon 30th Celebration card list and set guide</h1>
    <p class="lede" style="max-width:42em">${esc(doc.set.releaseNote.split(".")[0])}, on ${esc(longDate(doc.set.release))}.
      Every card is foil, there is no booster box, and every pack comes inside one of ${PACK_PRODUCTS}
      products. Here is the full checklist with prices, every product and its date, and one collector's master set.</p>
    <div class="t30-sum">
      <!-- shortDate, NOT longDate: "September" alone is 262px of Titan One in a 209px box. -->
      ${/* THE YEAR GOES IN THE CAPTION: "Sep 16, 2026" wrapped onto two lines of
           display type at 1280 and below, and clipped once it was told not to. */""}<div><b>${esc(shortDate(doc.set.release).replace(/,\s*\d{4}$/, ""))}</b><span>Released ${esc(doc.set.release.slice(0, 4))}, worldwide</span></div>
      <div><b>${E.count}</b><span>Cards in English</span></div>
      <div><b>${doc.products.length}</b><span>Products, ${waves.size} release dates</span></div>
      ${pricedCards[0] ? `<div><b>${esc(moneyRound(pricedCards[0].pr.raw))}</b><span>Top priced card, ${esc(pricedCards[0].name)}</span></div>` : ""}
    </div>
    ${/* ON THIS PAGE. Not sticky: a pinned bar costs a phone a slice of every
         screen for a page read mostly top to bottom. Teal, because these are
         routes. IN PAGE ORDER, which it was not: "Checklist" led while the
         value band came first, and the hits had no chip at all. On a phone the
         chips are one row that scrolls sideways, not three rows of wrap. */""}<nav class="t30-jump" aria-label="On this page">
      <a href="#values">Most valuable</a>
      ${setHits.length ? `<a href="#hits">Our hits</a>` : ""}
      <a href="#masterset">Master set binder</a>
      <a href="#checklist">Checklist</a>
      <a href="#products">Products and dates</a>
      <a href="#in-a-pack">In a pack</a>
      <a href="#faq">FAQ</a>
    </nav>
    <p class="t30-msjump"><a class="t30-msjump-a" href="#masterset"><b>${pct}% of the set collected</b>
      <span>${haveTotal} of ${TOTAL} cards &middot; see the master set&nbsp;binder&nbsp;&rarr;</span></a></p>
    </div>
    ${/* THE CARDS PEOPLE ARE CHASING, IN THE FIRST SCREEN, 25 September 2026. A
         design review measured the first card picture at 880px down on a laptop
         with the right half of the hero empty. The top three by raw price, the
         same three the value band opens with, each opening the pop-up. Laid
         side by side and never overlapping, because nothing on this page may
         cover a card's artwork. Desktop only: on a phone the value band is the
         next thing on screen anyway. */""}${pricedCards.length >= 3 ? `<div class="t30-fan">
      <ol data-zg="fan">
${pricedCards.slice(0, 3).map((c) => `        <li>${`<button type="button" class="t30-zm"${zoomOf(c)} aria-label="Show ${esc(c.name)} ${esc(pocketLabel(c.section, c.n))} larger">${pictureFor(c.name, { n: c.n, row: c, section: c.section, sizes: "(max-width:999px) 1px, 150px" })}</button>`}</li>`).join("\n")}
      </ol>
      <p>The top three by raw price</p>
    </div>` : ""}
  </div>
</header>
${valueBand}
${hitsBand}
<section class="tight" id="masterset">
  <div class="wrap">
    <p class="sec-label">One collector's copy</p>
    <h2>The master set, pocket by pocket</h2>
    <p style="max-width:42em">Nine pockets to a page, the same as the set's own Binder Collection. A filled pocket
      is a card actually in the binder. The empty ones are the job.${
        CHECKLIST.size
          ? ` Every card is shown: the ones still to find are the gray ones.`
          : ""
      }${
        /* THE PROGRESS CARD THAT STOOD HERE IS GONE, 25 September 2026: "136 of
           199" was printed four times between the hero and the first page. The
           tiles below and the cover carry the count; only the date moved. */
        haveTotal === 0
          ? ` Nothing in it yet: cards get added here as they are opened.`
          : ` Last added ${esc(longDate(owned.map((c) => c.got).filter(Boolean).sort().pop() || binder.checked))}.`
      }</p>
    <ul class="t30-secsum">
${sectionSummary}
    </ul>

    <figure class="t30-binder">
      ${/* THE COVER. The owner asked for it in these words: "give it a 30th Celebration
           logo at the top of the binder and then under the 30th logo it says Master
           Set Binder". Since 23 September 2026 it is PAGE 0 of the binder, the front
           board you open, rather than a strip above the pages: "make it look as
           much like a real card binder as possible". On a phone that also gave the
           first sheet the whole screen, where cover plus sheet did not fit.

           THE LOGO IS THE SET'S OWN and is already on this page's hero, so it is a
           cache hit rather than a second download. It is DECORATIVE here: the
           accessible name of this component lives on the track's aria-label and the
           words "Master Set Binder" are real text underneath, so alt="" is correct
           and an alt of "30th Celebration" would make a screen reader say the set
           name twice in a row. */""}
      <div class="t30-book">
      <span class="t30-rings" aria-hidden="true"><i></i><i></i><i></i></span>
      <div class="t30-track" id="binder" tabindex="0" role="group" aria-label="Binder pages, ${LEAF_N} of them and a cover. Turn with the page corners, the arrow keys, or a swipe.">
        <article class="t30-leaf t30-leaf-cover" id="bl0" aria-label="Cover">
          <div class="t30-board">
            <picture>
              <source type="image/avif" srcset="/assets/logos/30th-celebration-pokemon-tcg-set-logo-sm.avif">
              <img src="/assets/logos/30th-celebration-pokemon-tcg-set-logo-sm.webp" alt=""
                   width="180" height="84" decoding="async" onerror="this.remove()">
            </picture>
            <p class="t30-cover-t">Master Set Binder</p>
            <p class="t30-cover-s">${haveTotal} of ${TOTAL} cards &middot; ${pct}% complete</p>
            <span class="t30-bar" role="img" aria-label="${haveTotal} of ${TOTAL} collected"><span style="width:${pct}%"></span></span>
            <p class="t30-cover-o"><a href="#bl1">Open the binder</a></p>
          </div>
          <a class="t30-turn fwd" href="#bl1" aria-label="Open the binder to page 1, ${esc(BINDER_LEAVES[0].label)}"><span aria-hidden="true">&rsaquo;</span></a>
        </article>
${BINDER_LEAVES.map(leafHtml).join("\n")}
        ${/* THE INSIDE BACK COVER. Only the two-page desktop spread uses it, as the
             right-hand page opposite the last sheet, so it is hidden until the
             binder script opens that view. */""}<article class="t30-leaf t30-leaf-end" id="bl${LEAF_N + 1}" aria-label="Inside back cover" hidden>
          <div class="t30-board">
            <p class="t30-cover-t">That is the binder</p>
            <p class="t30-cover-s">${haveTotal} of ${TOTAL} so far &middot; ${TOTAL - haveTotal} still to find</p>
          </div>
          <a class="t30-turn back" href="#bl${LEAF_N}" aria-label="Turn back to page ${LEAF_N}"><span aria-hidden="true">&lsaquo;</span></a>
        </article>
      </div>
      </div>
      <p class="t30-sr" id="binder-live" role="status" aria-live="polite"></p>
      <figcaption>${haveTotal} of ${TOTAL} toward the set, across ${LEAF_N} pages of nine pockets${promos.length + jumbos.length ? `, plus ${promos.length + jumbos.length} outside it` : ""}.
        Turn a page with either corner, or jump to one below. A gray card is one still to find.${
          jumbos.length ? ` The jumbos on the last page have <a href="/jumbo-cards.html">a guide of their own</a>.` : ""
        }</figcaption>
    </figure>
    ${/* THE BINDER'S OWN SHARE LINK, /30th-binder.html, which previews as the
         drawn binder (scripts/build-og-binder.py) rather than as the set guide.
         A plain link that works with no script; the script turns it into the
         phone's share sheet where there is one, and a copy-to-clipboard where
         there is not. */""}<p class="t30-share"><a class="t30-share-a" id="t30Share" href="/30th-binder.html">Share this binder</a>
      <span id="t30ShareMsg" role="status" aria-live="polite"></span></p>

    <nav class="t30-rail" aria-label="Jump to a binder page">
${railHtml}
    </nav>
${needList}

  </div>
</section>
${checklistBand}
<section class="tight" id="products">
  <div class="wrap">
    <h2>30th Celebration products and release dates</h2>
    <div class="t30-waves">
${waveBlocks}
    </div>
    <h3>Free promo at the counter</h3>
    <p style="max-width:42em">${esc(doc.storePromo)}</p>
${(doc.promosToFind && doc.promosToFind.rows || []).length ? `    <h3>Every 30th Celebration promo, by number</h3>
    <p style="max-width:42em">Black Star promos numbered in the MEP run, and the product each one comes in. The numbers
      are printed on the cards; which product carries which is from Bulbapedia's promo list.</p>
    <div class="t30-scroll" style="max-width:40em">
      <table class="t30-tbl t30-tbl--fit">
        <thead><tr><th scope="col">No.</th><th scope="col">Card</th><th scope="col">Comes in</th></tr></thead>
        <tbody>
${doc.promosToFind.rows.map((r) => `          <tr><td>MEP ${esc(r.n)}</td><td>${esc(r.name)}${promos.some((o) => Number(o.n) === Number(r.n)) ? " <span class=\"t30-tag off\">In the binder</span>" : ""}</td><td>${esc(r.from)}</td></tr>`).join("\n")}
        </tbody>
      </table>
    </div>` : ""}
    <h3>Cards the English set does not have</h3>
    <p style="max-width:42em">${esc(doc.cutCards)}</p>
    <h3>Accessories</h3>
    <p style="max-width:42em">${esc(doc.accessories)}</p>
  </div>
</section>
<section class="band tight" id="in-a-pack">
  <div class="wrap">
    <h2>What is in a 30th Celebration pack</h2>
    <p style="max-width:42em">${esc(doc.guaranteesNote)}</p>
    <ul class="t30-facts">
${doc.guarantees
  .map(
    (g) =>
      `      <li><span class="t30-tag${g.source === "official" ? " off" : ""}">${
        g.source === "official" ? "Official" : "PokeBeach"
      }</span>${esc(g.claim)} <span class="t30-src-i">${esc(g.where)}</span></li>`
  )
  .join("\n")}
      <li><span class="t30-tag">No box</span>${esc(doc.set.noBox)}</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.classicLegality)}</li>
      ${doc.set.legalDate ? `<li><span class="t30-tag off">Official</span>${esc(doc.set.legalDate)}</li>` : ""}
      <li><span class="t30-tag off">Official</span>${esc(doc.set.tcgLive)} <a href="/tcg-live.html">How TCG Live works</a>.</li>
    </ul>
    ${/* A LARGE OPENING, NOT A RATE, and the heading says so rather than leaving
         it to a tag. CLAUDE.md's pull-rate rule: a non-publisher opening is a
         sample, however big, and "Pull rates" over it read as odds. */""}<h3>One large opening, not official odds</h3>
    <p style="max-width:42em"><span class="t30-tag">Not official</span>${esc(doc.englishRates)}</p>
    <p style="max-width:42em">What this channel has opened is counted separately and labeled as observed results,
      not odds. <a href="/luck.html">See those numbers</a>.</p>
    <details class="t30-more-d">
      <summary>What the cards themselves settled, and one Japanese box</summary>
      <p style="max-width:42em">Three cards we got early, on September 11, settle these straight from the printing.</p>
      <ul class="t30-facts">
        <li><span class="t30-tag off">Set code</span>${esc(doc.fromTheCards.setCode)}</li>
        <li><span class="t30-tag off">128 confirmed</span>${esc(doc.fromTheCards.mainSetSize)}</li>
        <li><span class="t30-tag off">Energy</span>${esc(doc.fromTheCards.energyNumbering)}</li>
        <li><span class="t30-tag off">Japan differs</span>${esc(doc.fromTheCards.japanMismatchProved)}</li>
      </ul>
      <p style="max-width:42em"><span class="t30-tag">One box, not a rate</span>${esc(doc.japanBoxOpening.caveat)}</p>
      <div class="t30-scroll" style="max-width:32em">
        <table class="t30-tbl t30-tbl--fit">
          <caption class="t30-cap">What came out of one ${doc.japanBoxOpening.packs} pack Japanese box. ${esc(doc.japanBoxOpening.where)}.</caption>
          <thead><tr><th scope="col">Card</th><th scope="col">In that box</th></tr></thead>
          <tbody>
${doc.japanBoxOpening.rows.map((r) => `            <tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("\n")}
          </tbody>
        </table>
      </div>
    </details>
  </div>
</section>
${rarityBand}
<section class="band tight" id="japan">
  <div class="wrap">
    <details class="t30-jp">
      <summary><h2>Japan's card list, ${doc.japanList.length} of ${doc.structure.japan.count} revealed</h2><span>A different set: open the list</span></summary>
      <p style="max-width:42em">Japan's set is a different set: ${esc(doc.structure.japan.note)} For English cards, use the
        <a href="#checklist">checklist above</a>.</p>
      <ol class="t30-jpl">
${doc.japanList.map((c) => `        <li><span>${esc(c.n ? "#" + String(c.n).padStart(3, "0") : "--")}</span> ${esc(c.name)} <i>${esc(JP_LABEL[c.section] || c.section)}</i></li>`).join("\n")}
      </ol>
    </details>
  </div>
</section>
<section class="tight" id="faq">
  <div class="wrap">
    <h2>30th Celebration questions</h2>
    <dl class="t30-faq">
      <dt>When did 30th Celebration come out?</dt>
      <dd>${esc(longDate(doc.set.release))}, on the same day worldwide in participating markets, the first Pokemon TCG set to do that.</dd>
      <dt>How many cards are in 30th Celebration?</dt>
      <dd>${E.count} by PokeBeach's count: ${E.main} in the main set (${E.pikachu} of them Pikachu), ${E.secret} secret rares
        including the ${US.count || 3} RGB Mews, ${E.classic} Classic Collection reprints and ${E.energy} foil basic Energy.
        The cards themselves confirm the ${E.main}. The Pokemon Company itself only says "over 150 cards".</dd>
      <dt>Is there a booster box?</dt>
      <dd>No. There are no booster boxes and no loose packs: every pack comes inside one of the ${PACK_PRODUCTS}
        products that hold them, from the ${esc(longDate(doc.set.release))} Elite Trainer Box to the December tins.</dd>
      <dt>What comes in a pack?</dt>
      <dd>${esc(doc.set.packContents.split(".")[0])}. Every pack also has one of the 30 Pikachu.</dd>
      ${pricedCards[0] ? `<dt>What is the most valuable 30th Celebration card?</dt>
      <dd>${esc(pricedCards[0].name)} (#${esc(pocketNum(pricedCards[0].section, pricedCards[0].n))}), at ${esc(moneyExact(pricedCards[0].pr.raw))}
        raw on PriceCharting, read ${esc(longDate(prices.checked || doc.checked))}, among the cards with a published price.
        The three RGB Mews sell for far more and are left out of every price list here: the first copies surfaced through a leak before release. <a href="#values">The top ten</a>.</dd>` : ""}
      <dt>Can you play the Classic Collection cards in tournaments?</dt>
      <dd>${esc(doc.set.classicLegality)}</dd>
      <dt>Are there official pull rates?</dt>
      <dd>Not from The Pokemon Company yet. The largest count so far is TCGplayer opening 3,000 packs,
        which is a sample rather than official odds. <a href="#in-a-pack">More on that</a>.</dd>
    </dl>
  </div>
</section>
<section class="tight">
  <div class="wrap">
    <h2>Sources</h2>
    <p style="max-width:42em">Anything marked <span class="t30-tag off">Official</span> is The Pokemon Company's
      own words. Everything else names its source in the sentence that uses it. Nothing on this page comes
      from a leak, a comment thread or a set tracker's guess.</p>
    <ul class="t30-src">
${[...doc.sources, ...((doc.unlistedSecrets || {}).sources || []), ...(doc.englishRatesSource ? [doc.englishRatesSource] : []), ...((doc.promosToFind || {}).sources || [])]
  .filter((u, i, a) => a.indexOf(u) === i)
  .map((u) => `      <li><a href="${esc(u)}" rel="noopener nofollow" target="_blank" aria-label="${esc(srcLabel(u))}, opens on ${esc(new URL(u).hostname.replace(/^www\\./, ""))}">${esc(srcLabel(u))}</a></li>`).join("\n")}
    </ul>
    <p class="price-note t30-prose"><strong>199 is not an official number.</strong>
      ${esc(E.note)} The Pokemon Company has never published a card count for this set, so these bars run
      against PokeBeach's count.</p>
${
  /* WHERE THE PICTURES CAME FROM, SAID ON THE PAGE. This site names the source
     of every figure it prints and a card scan is no different -- and here it is
     doubly worth saying, because these are NOT the source the other 59,758 card
     images on this site come from. The count is computed, never typed, so it
     cannot drift from the binder above it. */
  CHECKLIST.size
    ? `    <p class="price-note t30-prose"><strong>Where the card pictures come from.</strong>
      ${DEX_PICS} of the ${TOTAL} come from TCGdex, which is where the rest of this site's card
      scans come from; it took this set two days after release. ${REMOTE_PICS} are hotlinked from
      TCGplayer instead: the whole Classic Collection, because TCGdex holds those as a separate set with
      no images at all, and the eight foil Energy, which TCGplayer files under its own MEE set rather than
      under either 30th Celebration name${US_POCKETED && US.count ? `, and the ${US.count} RGB Mews, which TCGdex does not have` : ""}.${OWN_PICS > 0 ? ` ${OWN_PICS} ${OWN_PICS === 1 ? "is" : "are"} the
      owner's own ${OWN_PICS === 1 ? "photograph" : "photographs"} of a card in his hand.` : ""} Nothing here is
      rehosted or resized.${
        NO_PICS > 0
          ? ` The remaining ${NO_PICS} ${NO_PICS === 1 ? "has" : "have"} no picture anywhere this site may use:
      the ${US.count || 0} Mew RGB secret rares, which were revealed but which The Pokemon Company
      still has not acknowledged.`
          : ""
      }</p>`
    : ""
}
  </div>
</section>
<dialog class="t30-lb" id="t30lb" aria-labelledby="t30lbT">
  <div class="t30-lb-in">
    <div class="t30-lb-top">
      <p class="t30-lb-count" id="t30lbN"></p>
      <button type="button" class="t30-lb-x" id="t30lbX" aria-label="Close">&times;</button>
    </div>
    <div class="t30-lb-body">
      <div class="t30-lb-fig" id="t30lbF"><img class="t30-lb-img" id="t30lbI" alt="" decoding="async"></div>
      <div class="t30-lb-info">
        <h3 id="t30lbT"></h3>
        <p class="t30-lb-meta" id="t30lbM"></p>
        <p class="t30-lb-ill" id="t30lbA" hidden></p>
        <dl class="t30-lb-px" id="t30lbP" hidden></dl>
        <p class="t30-lb-rip" id="t30lbR" hidden><a id="t30lbRa" href="#">Watch the rip it came from</a></p>
        <p class="t30-lb-src" id="t30lbS" hidden>Market value from PriceCharting, read ${esc(longDate(prices.checked || doc.checked))}.</p>
        <div class="t30-lb-nav">
          <button type="button" class="t30-lb-go" id="t30lbPrev" aria-label="Previous card">&larr; Previous</button>
          <button type="button" class="t30-lb-go" id="t30lbNext" aria-label="Next card">Next &rarr;</button>
          <button type="button" class="t30-lb-go t30-lb-close" id="t30lbC">Close</button>
        </div>
      </div>
    </div>
  </div>
</dialog>

</main>`;

/* THE BANDS ALTERNATE BY POSITION, NOT BY SECTION. Each section used to carry
   its own "band" class, which was right only in the order they were typed; the
   order changed on 25 September 2026 (the hits and the binder moved up, above
   the checklist), so the shading is dealt out here in page order instead. */
let bandN = 0;
const bodyBanded = body.replace(/<section class="(?:band )?tight"/g, () => `<section class="${bandN++ % 2 === 0 ? "band " : ""}tight"`);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(clipMeta(DESC))}">
<link rel="canonical" href="${SITE}${PATH}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon 30th Celebration: products, dates and card list">
<meta property="og:description" content="Every product with its date and price, what is really in a pack, and Japan's full card list.">
<meta property="og:url" content="${SITE}${PATH}">
<meta property="og:image" content="${SITE}/assets/og-30th-celebration.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-30th-celebration.jpg">
<!-- PRECONNECT, WHICH 1,039 OTHER PAGES HAVE AND THE HEAVIEST TCGDEX PAGE ON
     THE SITE DID NOT. This page draws 158 distinct cards from assets.tcgdex.net
     and 30 from tcgplayer-cdn, and every one is loading="lazy" -- so the
     preload scanner never sees them and the FIRST request to either host is
     issued at layout, paying DNS + TCP + TLS from cold at the moment a reader
     starts scrolling. build-pokemon.mjs and build-intl-pages.mjs already do
     this; this builder simply never got the line. -->
<link rel="preconnect" href="https://assets.tcgdex.net">
<link rel="preconnect" href="https://tcgplayer-cdn.tcgplayer.com" crossorigin>
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
${bodyBanded}

${footer(
  `Page last checked ${longDate(PAGE_CHECKED)}. Set facts read ${longDate(doc.checked)} from The Pokemon Company's press releases and product pages, and from PokeBeach where marked. The Pokemon Company has published no card count for this set; totals here are PokeBeach's.`
)}
${APP_JS_NO_PACKPLAYER}
<script>
/* THE BINDER AS A BINDER, 23 September 2026. The owner: "Want it to look as much
   like a real card binder as possible, page turn animations, anything to make it
   look and feel like a real binder", with two pages side by side on desktop and
   tablet.

   THE BINDER STILL WORKS WITHOUT THIS. Every control is an anchor to a leaf id
   and the track is a scroll-snap row, so with no script a reader swipes and taps
   exactly as before. This script turns that row into a book: it stacks the
   leaves (CSS, under .is-book), shows the open page or pages, and turns a page
   as a sheet rotating about the spine, with copies of the real pages on its two
   faces. A drag on the page turns it under your finger; the corners, the arrow
   keys and every #blN link on the page turn it too.

   PREFERS-REDUCED-MOTION GETS THE BOOK WITHOUT THE ANIMATION: the page simply
   changes. A turn is the motion a reader who asked for less would not want. */
(function () {
  var fig = document.querySelector(".t30-binder"), t = document.getElementById("binder");
  if (!fig || !t || !window.requestAnimationFrame || !t.classList) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var twoMQ = window.matchMedia ? matchMedia("(min-width: 900px), (min-width: 760px) and (orientation: landscape)") : null;
  var all = Array.prototype.slice.call(t.querySelectorAll(".t30-leaf"));
  var endLeaf = t.querySelector(".t30-leaf-end");
  var rail = document.querySelectorAll('.t30-rail a[href^="#bl"]');
  var live = document.getElementById("binder-live");
  var two = false, seq = [], pos = 0, busy = null, announced = null;
  var queued = null, relayout = false, asked = null;

  fig.classList.add("is-book");
  t.scrollLeft = 0;

  function layout() {
    two = !!(twoMQ && twoMQ.matches);
    fig.setAttribute("data-mode", two ? "two" : "one");
    /* THE INSIDE BACK COVER ONLY WHEN THE LAST SPREAD NEEDS A RIGHT PAGE. With
       an even number of pages it filled the gap; the promo page that took the
       binder to 27 sheets left it alone on a spread of its own, facing nothing. */
    seq = all.filter(function (l) { return l !== endLeaf; });
    if (two && endLeaf && seq.length % 2) seq.push(endLeaf);
    if (endLeaf) endLeaf.hidden = seq.indexOf(endLeaf) < 0;
  }
  function slots(p) { return two ? [seq[2 * p], seq[2 * p + 1]] : [seq[p]]; }
  function last() { return two ? Math.ceil(seq.length / 2) - 1 : seq.length - 1; }
  function posOf(leaf) {
    var i = seq.indexOf(leaf);
    if (i < 0) return leaf === endLeaf ? last() : 0;
    return two ? Math.floor(i / 2) : i;
  }
  function clearSlots() { all.forEach(function (l) { l.classList.remove("is-on", "is-l", "is-r"); }); }
  function put(leaf, side) { if (leaf) leaf.classList.add("is-on", side || "is-s"); }

  /* LOAD AHEAD, as the scroll version did: the open page or pages and the ones
     either side go eager, so a turn lands on pictures that are already in. */
  /* NOT UNTIL THE BINDER IS NEAR. paint() runs at load and warm() flipped the
     cover's neighbours to eager right then, so 18 card pictures, 446KB, came
     down for a binder 52,000px below the reader. An IntersectionObserver with
     Chrome's own lazy margin (1250px) says when the reader is close; until then
     nothing is warmed. No IntersectionObserver: warm as before. */
  var near = !("IntersectionObserver" in window);
  if (!near) {
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      near = true; io.disconnect(); warm(pos);
    }, { rootMargin: "1250px 0px" });
    io.observe(fig);
  }
  function warm(p) {
    if (!near) return;
    for (var k = p - 1; k <= p + 2; k++) {
      if (k < 0 || k > last()) continue;
      slots(k).forEach(function (lf) {
        if (!lf || lf.getAttribute("data-warm")) return;
        lf.setAttribute("data-warm", "1");
        var im = lf.querySelectorAll('img[loading="lazy"]');
        for (var j = 0; j < im.length; j++) im[j].loading = "eager";
      });
    }
  }

  /* WHICH PAGE AM I ON, for the rail (aria-current plus a class the stylesheet
     paints teal) and for a screen reader, told once per turn. */
  function mark() {
    var open = slots(pos).filter(Boolean), ids = open.map(function (l) { return "#" + l.id; });
    /* aria-current goes on the page that was ASKED FOR when it is open (rail 13
       opens 12 and 13 as a spread; 13 is the one that should read as current),
       and otherwise on the first open page that has a rail link. */
    var cur = asked && open.indexOf(asked) >= 0 ? "#" + asked.id : null;
    for (var i = 0; i < rail.length; i++) {
      var on = ids.indexOf(rail[i].getAttribute("href")) >= 0;
      rail[i].classList.toggle("is-here", on);
      if (on && !cur) cur = rail[i].getAttribute("href");
    }
    for (var j = 0; j < rail.length; j++) {
      if (rail[j].getAttribute("href") === cur) rail[j].setAttribute("aria-current", "page");
      else rail[j].removeAttribute("aria-current");
    }
    var say = open.map(function (l) { return l.getAttribute("aria-label") || ""; }).join(", and ");
    if (live && announced !== null && say !== announced) live.textContent = say;
    announced = say;
  }

  function paint(p) {
    pos = Math.max(0, Math.min(p, last()));
    clearSlots();
    var s = slots(pos);
    if (two) { put(s[0], "is-l"); put(s[1], "is-r"); } else put(s[0]);
    fig.classList.toggle("at-first", pos === 0);
    fig.classList.toggle("at-last", pos === last());
    var k = last() ? pos / last() : 0;
    t.style.setProperty("--ls", Math.round(2 + 6 * k) + "px");
    t.style.setProperty("--rs", Math.round(2 + 6 * (1 - k)) + "px");
    warm(pos);
    mark();
  }

  /* A FACE OF THE TURNING SHEET: a copy of a real page, stripped of ids and
     hidden from assistive tech (the real page underneath is the one it reads). */
  function face(leaf, side, slot) {
    var f = document.createElement("div");
    f.className = "t30-face " + side;
    var c;
    if (leaf) {
      c = leaf.cloneNode(true);
      c.removeAttribute("id");
      c.hidden = false;
      c.classList.remove("is-l", "is-r");
      c.classList.add("is-on");
      if (slot) c.classList.add(slot);
      var ids = c.querySelectorAll("[id]");
      for (var i = 0; i < ids.length; i++) ids[i].removeAttribute("id");
    } else {
      c = document.createElement("div");
      c.className = "t30-sheetback";
      var hd = document.createElement("div"); hd.className = "t30-leaf-h"; hd.innerHTML = "<b>&nbsp;</b>";
      var ol = document.createElement("ol"); ol.className = "t30-pkts";
      ol.innerHTML = new Array(10).join(${JSON.stringify(PAD_POCKET)});
      c.appendChild(hd); c.appendChild(ol);
    }
    c.setAttribute("aria-hidden", "true");
    c.setAttribute("inert", "");
    f.appendChild(c);
    var sh = document.createElement("span"); sh.className = "t30-shade"; f.appendChild(sh);
    return f;
  }

  /* START A TURN from the open position to the page asked for. Returns a controller whose
     angle can be driven by a finger (set) and then finished or abandoned. The
     pages that end up visible are laid out underneath first, so the sheet only
     ever uncovers what is really there. */
  function begin(to) {
    if (busy || reduce || to === pos || to < 0 || to > last()) return null;
    var fwd = to > pos, from = slots(pos), dest = slots(to);
    /* FOCUS MUST NOT SIT ON A PAGE THAT IS ABOUT TO HIDE: it fell to <body> for
       the length of the turn and a screen reader lost its place. The track holds
       it until the turn lands and focusCorner() places it on the new page. */
    var ae = document.activeElement;
    if (ae && ae !== t && t.contains(ae)) t.focus({ preventScroll: true });
    var sheet = document.createElement("div");
    sheet.className = "t30-sheet " + (fwd ? "fwd" : "back");
    sheet.setAttribute("aria-hidden", "true");
    var front, back, a0, a1;
    if (two) {
      if (fwd) { front = face(from[1], "f", "is-r"); back = face(dest[0], "b", "is-l"); a0 = 0; a1 = -180; }
      else { front = face(from[0], "f", "is-l"); back = face(dest[1], "b", "is-r"); a0 = 0; a1 = 180; }
    } else {
      if (fwd) { front = face(from[0], "f"); back = face(null, "b"); a0 = 0; a1 = -180; }
      else { front = face(dest[0], "f"); back = face(null, "b"); a0 = -180; a1 = 0; }
    }
    sheet.appendChild(front); sheet.appendChild(back);
    clearSlots();
    if (two) {
      if (fwd) { put(from[0], "is-l"); put(dest[1], "is-r"); }
      else { put(dest[0], "is-l"); put(from[1], "is-r"); }
    } else put(fwd ? dest[0] : from[0]);
    t.appendChild(sheet);
    warm(to);
    var fs = front.lastChild, bs = back.lastChild, cur = a0;
    function set(a) {
      cur = a;
      sheet.style.transform = "rotateY(" + a + "deg)";
      var q = Math.abs(a - a0) / 180; // 0 at rest, 1 fully turned
      fs.style.opacity = String(Math.min(1, q * 2) * 0.45);
      bs.style.opacity = String(Math.max(0, 1 - (q - 0.5) * 2) * 0.45);
      /* On a phone the page turning away leaves the binder altogether, so it
         fades over its last quarter rather than hanging off the edge. */
      if (!two) sheet.style.opacity = String(fwd ? Math.min(1, (1 - q) * 4) : Math.min(1, q * 4));
    }
    set(a0);
    busy = {
      set: function (p) { set(a0 + (a1 - a0) * Math.max(0, Math.min(1, p))); },
      progress: function () { return Math.abs(cur - a0) / 180; },
      end: function (complete, done) {
        var goal = complete ? a1 : a0, start = cur, span = Math.abs(goal - start) / 180;
        var ms = reduce ? 0 : Math.max(120, 700 * span), t0 = null;
        var over = false;
        function fin() {
          if (over) return;
          over = true;
          sheet.remove(); busy = null;
          paint(complete ? to : pos);
          if (done) done(complete);
          /* A width change during the turn was held back (the sheet was built
             for the old layout); apply it now. Then any jump asked for mid-turn. */
          if (relayout) { relayout = false; onMode(); }
          if (queued !== null) { var q = queued; queued = null; turnTo(q.to, q.done); }
        }
        if (!ms) return fin();
        function step(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / ms);
          var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out
          set(start + (goal - start) * e);
          if (over) return;
          if (k < 1) requestAnimationFrame(step); else fin();
        }
        requestAnimationFrame(step);
        /* A BACKGROUND TAB STOPS ANIMATION FRAMES, and a turn waiting on them
           would leave the binder mid-flip with every control ignored. The timer
           finishes it regardless; fin() only ever runs once. */
        setTimeout(fin, ms + 400);
      }
    };
    return busy;
  }

  function turnTo(to, done) {
    to = Math.max(0, Math.min(to, last()));
    /* ASKED MID-TURN: remember the latest request and run it when this turn
       lands, rather than dropping it (a rail jump during a turn used to scroll
       the reader to the binder and leave the wrong page open). */
    if (busy) { queued = { to: to, done: done }; return; }
    if (to === pos) { if (done) done(false); return; }
    if (reduce) { paint(to); if (done) done(true); return; }
    var c = begin(to);
    if (c) c.end(true, done);
  }

  /* KEEP THE BINDER ON SCREEN FOR THE TURN. The rail and the section tiles sit
     below it, so a jump from there brings it into view first, then turns. */
  function inView() {
    var r = fig.getBoundingClientRect();
    return r.top >= -40 && r.top < (window.innerHeight || 800) * 0.5;
  }
  function focusCorner(fwd) {
    var open = slots(pos).filter(Boolean);
    for (var i = open.length - 1; i >= 0; i--) {
      var c = open[i].querySelector(fwd ? ".t30-turn.fwd" : ".t30-turn.back");
      if (c && c.offsetParent) { c.focus({ preventScroll: true }); return; }
    }
    t.focus({ preventScroll: true });
  }

  var swallowClick = false;
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#bl"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (!el || !t.contains(el)) return;
    e.preventDefault();
    if (swallowClick) { swallowClick = false; return; }
    var to = posOf(el), corner = a.classList.contains("t30-turn");
    if (!corner) asked = el;
    var fromKeys = e.detail === 0;
    function go() {
      turnTo(to, function () { if (corner && fromKeys) focusCorner(to > pos || a.classList.contains("fwd")); });
    }
    if (!corner && !inView()) {
      fig.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      setTimeout(go, reduce ? 0 : 420);
    } else go();
  });

  t.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    var onCorner = e.target.closest && e.target.closest(".t30-turn"), fwd = e.key === "ArrowRight";
    turnTo(pos + (fwd ? 1 : -1), function () {
      /* Keep the keyboard in the binder: a second arrow press did nothing
         because focus had fallen to <body> with the page it was on. */
      if (onCorner) focusCorner(fwd);
      else if (!t.contains(document.activeElement)) t.focus({ preventScroll: true });
    });
  });
  /* NO NATIVE DRAG OF A CARD PICTURE OR A CORNER: the browser's own drag-and-drop
     took the pointer away mid-turn (pointercancel) and left the page to finish
     turning on its own with the mouse button still down. */
  t.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* THE PAGE UNDER YOUR FINGER. A sideways drag lifts the page and turns it as
     far as you have pulled; let go past a third of the way (or with a flick)
     and it finishes, short of that and it falls back. Vertical drags are left to
     the browser (touch-action: pan-y), so the page still scrolls. */
  var d = null;
  t.addEventListener("pointerdown", function (e) {
    if (busy || (e.pointerType === "mouse" && e.button !== 0)) return;
    d = { x: e.clientX, y: e.clientY, id: e.pointerId, c: null, t: Date.now(), lx: e.clientX, lt: Date.now(), v: 0,
      link: !!(e.target.closest && e.target.closest('a[href^="#bl"]')), mouse: e.pointerType === "mouse", dx: 0 };
  });
  t.addEventListener("pointermove", function (e) {
    if (!d || e.pointerId !== d.id) return;
    /* A mouse released outside the binder never sent us its pointerup, and the
       page then followed the bare cursor. No button held means no drag. */
    if (d.mouse && !e.buttons) { release(null); return; }
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.dx = dx;
    if (!d.c) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      /* Reduced motion: no sheet follows the finger; release() just turns. */
      if (reduce) { d.flat = true; return; }
      d.c = begin(pos + (dx < 0 ? 1 : -1));
      if (!d.c) { d = null; return; }
      d.fwd = dx < 0;
      try { t.setPointerCapture(e.pointerId); } catch (_) {}
      t.classList.add("is-dragging");
    }
    var w = two ? t.clientWidth / 2 : t.clientWidth;
    var now = Date.now();
    d.v = (e.clientX - d.lx) / Math.max(1, now - d.lt); d.lx = e.clientX; d.lt = now;
    d.c.set((d.fwd ? -dx : dx) / (w * 0.9));
    e.preventDefault();
  });
  function release(e) {
    if (!d || (e && e.pointerId !== d.id)) return;
    var c = d.c, fwd = d.fwd, link = d.link, flat = d.flat, ddx = d.dx;
    /* A flick is speed AT the release: a drag that paused before letting go
       still carried its old speed and turned the page on a stall. */
    var v = Date.now() - d.lt > 80 ? 0 : d.v;
    d = null;
    t.classList.remove("is-dragging");
    if (flat) {
      var w0 = two ? t.clientWidth / 2 : t.clientWidth;
      if (Math.abs(ddx) > w0 * 0.25) turnTo(pos + (ddx < 0 ? 1 : -1));
      return;
    }
    if (!c) return;
    /* The click that can follow a drag only lands on a link the drag began on;
       swallowing on every drag ate the NEXT real tap on a corner. */
    if (link) {
      swallowClick = true;
      setTimeout(function () { swallowClick = false; }, 400);
    }
    var flick = fwd ? v < -0.5 : v > 0.5;
    c.end(c.progress() > 0.33 || flick);
  }
  t.addEventListener("pointerup", release);
  t.addEventListener("pointercancel", release);
  document.addEventListener("pointerup", release);

  /* A LINK TO A PAGE OPENS THE BINDER AT THAT PAGE, and a change of width
     (a tablet turned round, a desktop window narrowed) keeps the same page open
     while the binder switches between one page and two. */
  layout();
  var start = location.hash && /^#bl\\d+$/.test(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
  if (start && t.contains(start)) asked = start;
  paint(start && t.contains(start) ? posOf(start) : 0);
  if (start && t.contains(start)) fig.scrollIntoView({ block: "start" });
  function onMode() {
      if (busy) { relayout = true; return; }
      var open = slots(pos).filter(Boolean), keep = open[open.length > 1 && open[0].classList.contains("t30-leaf-cover") ? 1 : 0];
      /* The page the reader ASKED for wins over the spread's left page, so 9 at
         a phone width stays 9 after a round trip through two pages. */
      if (asked && open.indexOf(asked) >= 0) keep = asked;
      layout();
      paint(posOf(keep));
  }
  if (twoMQ) {
    if (twoMQ.addEventListener) twoMQ.addEventListener("change", onMode);
    else if (twoMQ.addListener) twoMQ.addListener(onMode);
  }
})();
</script>
<script>
(function () {
  var a = document.getElementById("t30Share"), msg = document.getElementById("t30ShareMsg");
  if (!a) return;
  var url = location.origin + "/30th-binder.html";
  a.addEventListener("click", function (e) {
    if (navigator.share) {
      e.preventDefault();
      navigator.share({ title: "Pokemon 30th Celebration Virtual Master Set Binder", url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      e.preventDefault();
      navigator.clipboard.writeText(url).then(function () { msg.textContent = "Link copied"; },
        function () { location.href = a.href; });
    }
  });
})();
</script>
<script>
/* THE ENLARGED CARD. Reads the data attributes each pocket was built with and
   fills one <dialog>; nothing is fetched but the large picture. A tap that was
   really the start of a page drag is not a tap: the binder turns pages by
   dragging, so a press that moved more than 10px does not open anything. */
(function () {
  var dlg = document.getElementById("t30lb");
  if (!dlg || typeof dlg.showModal !== "function") return;
  var img = document.getElementById("t30lbI"), T = document.getElementById("t30lbT"),
      M = document.getElementById("t30lbM"), P = document.getElementById("t30lbP"),
      S = document.getElementById("t30lbS"), N = document.getElementById("t30lbN");
  var list = [], at = -1, opener = null, down = null;
  var R = document.getElementById("t30lbR"), Ra = document.getElementById("t30lbRa"), A = document.getElementById("t30lbA");
  var SEL = "button.t30-cf, button.t30-zm";
  /* PREVIOUS AND NEXT STAY INSIDE THE LIST THE CARD WAS OPENED FROM: the
     binder's pockets, the top ten, the checklist or the hits. In the checklist
     they follow what is on screen, so a filtered list steps through only the
     rows showing, and a price sort steps in price order, which is CSS order
     and not the order of the markup. */
  function groupOf(b) { return b.closest(".t30-track, [data-zg]"); }
  function all(b) {
    var g = groupOf(b);
    var bs = [].slice.call(g.querySelectorAll(SEL));
    if (g.getAttribute("data-zg") !== "checklist") return bs;
    bs = bs.filter(function (x) { return x.offsetParent !== null; });
    var ord = function (x) { return parseInt(getComputedStyle(x.closest("li")).order, 10) || 0; };
    return bs.map(function (x, i) { return { x: x, i: i, o: ord(x) }; })
      .sort(function (p, q) { return p.o - q.o || p.i - q.i; })
      .map(function (p) { return p.x; });
  }
  function esc(v) { var d = document.createElement("div"); d.textContent = v; return d.innerHTML; }
  function show(i) {
    at = (i + list.length) % list.length;
    var b = list[at], d = b.dataset;
    var small = b.querySelector("img.t30-card");
    /* THE THREE RGB MEWS HAVE NO PICTURE ANYWHERE this site may use, so their
       pop-up is the words alone rather than an empty frame. */
    document.getElementById("t30lbF").hidden = !(d.big || (small && (small.currentSrc || small.src)));
    img.removeAttribute("src");
    img.alt = d.name || "";
    if (small && (small.currentSrc || small.src)) img.src = small.currentSrc || small.src;
    if (d.big) {
      var hi = new Image();
      hi.onload = function () { if (list[at] === b) img.src = d.big; };
      hi.src = d.big;
    }
    T.textContent = d.name || "";
    M.innerHTML = [d.num ? "<b>" + esc(d.num) + "</b>" : "", d.rar ? esc(d.rar) : "",
      d.when ? "Pulled " + esc(d.when) : d.own ? "In the binder" : "Still to find"].filter(Boolean).join(" &middot; ");
    A.hidden = !d.ill;
    A.textContent = d.ill ? "Illustrated by " + d.ill : "";
    R.hidden = !d.rip;
    if (d.rip) Ra.href = d.rip;
    var px = "";
    if (d.raw) px += "<div><dt>Raw, ungraded</dt><dd>" + esc(d.raw) + "</dd></div>";
    if (d.psa) px += "<div><dt>PSA 10</dt><dd>" + esc(d.psa) + "</dd></div>";
    P.innerHTML = px; P.hidden = !px; S.hidden = !px;
    N.textContent = "Card " + (at + 1) + " of " + list.length;
  }
  function open(b) {
    list = all(b); opener = b;
    show(list.indexOf(b));
    dlg.showModal();
  }
  /* The control a press lands on: the picture itself, or a checklist row
     anywhere outside a link, which stands in for its picture. */
  function hit(t) {
    if (!t.closest) return null;
    var b = t.closest(SEL);
    if (b) return b;
    var r = t.closest(".t30-row");
    return r && !t.closest("a") ? r.querySelector(SEL) : null;
  }
  document.addEventListener("pointerdown", function (e) {
    down = hit(e.target) ? { x: e.clientX, y: e.clientY } : null;
  }, true);
  document.addEventListener("click", function (e) {
    var b = hit(e.target);
    if (!b || !groupOf(b)) return;
    if (down && e.detail !== 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
    down = null;
    e.preventDefault();
    open(b);
  });
  document.getElementById("t30lbX").addEventListener("click", function () { dlg.close(); });
  document.getElementById("t30lbPrev").addEventListener("click", function () { show(at - 1); });
  document.getElementById("t30lbNext").addEventListener("click", function () { show(at + 1); });
  document.getElementById("t30lbC").addEventListener("click", function () { dlg.close(); });
  /* SWIPE THE CARD, 25 September 2026: a phone review found a sideways swipe
     on the open card did nothing, and the only close control was the X at the
     top, the hardest place for a thumb. Sideways steps a card, a pull down
     closes. The figure takes pan-y so the browser leaves the sideways move to
     this; a vertical scroll of the panel still works. */
  var fig = document.getElementById("t30lbF"), sw = null;
  fig.addEventListener("pointerdown", function (e) { sw = { x: e.clientX, y: e.clientY }; });
  fig.addEventListener("pointercancel", function () { sw = null; });
  fig.addEventListener("pointerup", function (e) {
    if (!sw) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) show(at + (dx < 0 ? 1 : -1));
    else if (dy > 90 && dy > 1.5 * Math.abs(dx)) dlg.close();
  });
  dlg.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
  });
  /* A click on the dimmed backdrop lands on the dialog element itself. */
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", function () {
    img.removeAttribute("src");
    if (opener && opener.isConnected && opener.offsetParent) opener.focus({ preventScroll: true });
  });
})();
</script>
</body>
</html>
`;

await writeFile(join(ROOT, "public" + PATH), html);

/* ------------------------------------------------- /sets/30th-celebration.html
 *
 * A REDIRECT STUB, BECAUSE THE URL EVERY OTHER SET GUIDE USES IS THE ONE PEOPLE
 * ACTUALLY TYPE. The owner's own launch-day video description linked to
 * garbagerips.com/sets/30th-celebration.html, which answered 404: this guide
 * cannot live in /sets/, because that family is generated from TCGdex and
 * TCGdex has never held this set. He asked for the link to work rather than for
 * the page to move, 17 September 2026.
 *
 * IT IS WORTH KEEPING EVEN AFTER HE EDITS THE DESCRIPTION. /sets/<slug>.html is
 * the shape of all 43 other guides, so it is the address a reader guesses, the
 * one already sitting in a published video, and the one anybody linking to this
 * set from elsewhere will reach for.
 *
 * FOUR THINGS THIS PAGE MUST NOT DO, and each is a check that would otherwise
 * fail. It is `noindex`, so it never competes with the real guide in search,
 * and check-build.py fails the build on a noindex page that is in the sitemap,
 * so it is deliberately not registered there. It carries NO canonical: pointing
 * one at the real guide is the usual advice and here it would collide, because
 * seo-sweep.py's DUPLICATE CANON check counts repeated canonicals across every
 * page and the real guide already owns that value. It carries NO meta
 * description, because the DESC OUTSIDE 70-165 check applies to every page
 * whether indexable or not, and there is nothing to say in 70 characters that
 * the redirect does not do faster. And it has EXACTLY ONE h1, because the NOT
 * EXACTLY ONE H1 check is the one flag with no indexable exemption at all.
 *
 * THE LINK IS VISIBLE AND NOT ONLY A META REFRESH. A refresh covers the normal
 * case; a reader with it disabled gets a sentence and a link rather than a
 * blank page, which is the same reason the noscript paths elsewhere on this site
 * exist. */
const REDIRECT_TO = PATH;
await writeFile(
  join(ROOT, "public/sets/30th-celebration.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url=${REDIRECT_TO}">
<title>30th Celebration set guide has moved</title>
</head>
<body>
<h1>30th Celebration set guide</h1>
<p>This guide lives at <a href="${REDIRECT_TO}">${SITE}${REDIRECT_TO}</a>. Taking you there now.</p>
</body>
</html>
`
);
console.log(`Wrote public/sets/30th-celebration.html  redirect -> ${REDIRECT_TO}`);

/* --------------------------------------------------------- /30th-binder.html
 *
 * THE BINDER'S OWN SHARE LINK. The owner, 25 September 2026: "make a special
 * link share image for a link that takes you directly to the 30th collection
 * master set binder, and make the image look like a real card binder with the
 * 30th logo and have it say Virtual Master Set Binder". A preview is read off a
 * page's own og tags and the #fragment is dropped before any of them are read,
 * so the binder can only get a picture of its own from a page of its own. This
 * is that page: it carries og-30th-binder.jpg (scripts/build-og-binder.py) and
 * hands a person straight on to the binder.
 *
 * THE HAND-OFF IS SCRIPT, NOT A META REFRESH, ON PURPOSE. A link unfurler that
 * follows a refresh would read the set guide's tags instead of these, which is
 * the whole problem this page exists to solve; unfurlers do not run script, and
 * a person's browser does. With script off there is a sentence and a link.
 *
 * Same four constraints as the stub above: noindex and out of the sitemap, one
 * h1, a description inside 70-165, and a canonical of its OWN (not the guide's,
 * which seo-sweep.py's duplicate-canonical check would flag). og:url is this
 * page too, because some unfurlers re-fetch og:url and would find the guide. */
const BINDER_SHARE = "/30th-binder.html";
const BINDER_TARGET = `${PATH}#masterset`;
const BINDER_TITLE = "Pokemon 30th Celebration Virtual Master Set Binder";
const BINDER_DESC =
  `Flip through a virtual card binder of the whole Pokemon 30th Celebration master set: ` +
  `${haveTotal} of ${TOTAL} cards collected so far. Tap any card to see it up close.`;
await writeFile(
  join(ROOT, "public/30th-binder.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<title>${esc(BINDER_TITLE)}</title>
<meta name="description" content="${esc(BINDER_DESC)}">
<link rel="canonical" href="${SITE}${BINDER_SHARE}">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="${esc(BINDER_TITLE)}">
<meta property="og:description" content="${esc(BINDER_DESC)}">
<meta property="og:url" content="${SITE}${BINDER_SHARE}">
<meta property="og:image" content="${SITE}/assets/og-30th-binder.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="An open card binder full of Pokemon 30th Celebration cards beside the 30th Celebration logo and the words Virtual Master Set Binder">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(BINDER_TITLE)}">
<meta name="twitter:description" content="${esc(BINDER_DESC)}">
<meta name="twitter:image" content="${SITE}/assets/og-30th-binder.jpg">
<script>location.replace(${JSON.stringify(BINDER_TARGET)});</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1F382B;color:#E4DCCC;font:18px/1.5 system-ui,sans-serif;text-align:center;padding:24px}a{color:#81BEDE}</style>
</head>
<body>
<main>
<h1>30th Celebration Virtual Master Set Binder</h1>
<p><a href="${BINDER_TARGET}">Open the binder</a></p>
</main>
</body>
</html>
`
);
console.log(`Wrote public${BINDER_SHARE}  share page -> ${BINDER_TARGET}`);
console.log(
  `Wrote public${PATH}  ${haveTotal}/${TOTAL} owned, ${doc.products.length} products, ${doc.japanList.length} Japanese cards`
);
