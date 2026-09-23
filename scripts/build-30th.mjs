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
const owned = binder.owned || [];
/* PROMOS ARE COUNTED SEPARATELY AND NEVER ADDED TO `owned`. See the
   `_promoNote` in data/30th-binder.json: the five sections add to 199 because
   that is what the set is, and a promo is in none of them, so counting one
   would make the percentage in the hero wrong. */
const promos = binder.promos || [];
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
    US.count
      ? ` ${US.count} of them have no pocket here: ${US.blurb}`
      : ""
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
const shotImg = (stem, name) => {
  const d = shotDims[`${stem}.webp`];
  const img =
    `<img class="t30-card" src="/assets/30th-cards/${stem}.webp" ` +
    `srcset="/assets/30th-cards/${stem}-sm.webp 245w, /assets/30th-cards/${stem}-md.webp 380w, ` +
    `/assets/30th-cards/${stem}.webp 600w" ` +
    `sizes="(max-width:544px) 30vw, 163px" ` +
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
const tcgpImg = (pid, name, low = false) =>
  `<img class="t30-card" src="${tcgpBase(pid)}_200w.jpg" ` +
  /* A GREY POCKET TAKES THE SMALL FILE ONLY (\`low\`), 23 September 2026. It is
     drawn greyscaled at 78% opacity, so the 400w file bought nothing a reader
     can see, and at DPR 3 it was 470KB per Classic page turn on a phone. */
  (low ? "" : `srcset="${tcgpBase(pid)}_200w.jpg 200w, ${tcgpBase(pid)}_400w.jpg 400w" ` +
  `sizes="(max-width:544px) 30vw, 163px" `) +
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

const cardImg = (localId, name, low = false) => {
  const url = `${scanBase(localId)}/low.webp`;
  const d = imgDims(url);
  const img =
    `<img class="t30-card" src="${url}" ` +
    /* 245w only on a grey pocket, same reason as tcgpImg's \`low\`: about 94%
       of what a DPR 3 pocket asks for, drawn greyscale, at under half the bytes. */
    (low ? "" : `srcset="${scanBase(localId)}/low.webp 245w, ${scanBase(localId)}/high.webp 600w" ` +
    `sizes="(max-width:544px) 30vw, 163px" `) +
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
const pictureFor = (name, { shot, n, row, section, low = false }) => {
  const dex = dexLocalId(section ?? row?.section, n);
  if (dex) return cardImg(dex, name, low);
  /* NO avifPicture() AROUND THIS ONE. That helper rewrites a .webp srcset to
     .avif for TCGdex and for our own pack renditions and returns its input
     untouched for anything else, so on a third party's .jpg the call was a
     no-op dressed as an optimisation. TCGplayer publishes no AVIF. */
  if (row && row.pid) return tcgpImg(row.pid, name, low);
  if (shot) return shotImg(shot, name);
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
  section === "classic" ? String(n) : String(n).split("/")[0];

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

const pocket = (c, i, slot) => {
  if (c) {
    const row = CHECKLIST.get(clKey(c.section, c.n || ""));
    /* "Collected" IS SAID OUT LOUD, because before this it was communicated
       only by ABSENCE: the 124 uncollected pockets each carry a visually hidden
       "Not collected yet" and the filled ones carried no counterpart, so a
       screen reader user could only infer the good news from a missing phrase.
       46 of the 75 have no date either, so absence was the ONLY signal on those. */
    return `<li class="t30-pk has" title="${esc(c.name)}">
        <span class="t30-sr">Collected</span>
        ${phOf(c.name, pocketLabel(c.section, c.n, c.setCode))}
        ${/* A promo or jumbo is in no checklist row, so `row` is null for all
             eight and they drew no picture at all. Each carries its own `pid`
             in data/30th-binder.json instead; see `_pidNote` there. */
          pictureFor(c.name, { shot: c.shot, n: c.n, row: row || (c.pid ? { pid: c.pid } : null), section: c.section })}
        <span class="t30-pn">${esc(pocketLabel(c.section, c.n, c.setCode))}</span>
        ${/* NO DATE ON THE CARD. The owner, 22 September 2026: "remove the dates
             overalyed on top of the cards in the binder". It was printed over
             the artwork on the 29 pockets that have a `got`, which is a minority
             of the 75 -- so it also read as a property of those cards rather
             than of the binder. THE DATA IS NOT DELETED: `got` stays in
             data/30th-binder.json and still drives the "Last added" line above
             the binder, which is the one place a date belongs on this page. */""}
      </li>`;
  }
  if (HAVE_SCANS && slot) {
    const pic = pictureFor(slot.name, { n: slot.n, row: slot, section: slot.section, low: true });
    return `<li class="t30-pk need" title="${esc(slot.name)}">
        <span class="t30-sr">Not collected yet</span>
        ${phOf(slot.name, pocketLabel(slot.section, slot.n))}
        ${pic}
        <span class="t30-pn">${esc(pocketLabel(slot.section, slot.n))}</span>
      </li>`;
  }
  return `<li class="t30-pk" aria-hidden="true"><span class="t30-pn">${i + 1}</span></li>`;
};

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
const cardTile = (c, { showPrice = true } = {}) => {
  const pr = c.pr || priceOf(c);
  const pic = pictureFor(c.name, { n: c.n, row: c, section: c.section });
  return `        <li class="t30-ct${pic ? "" : " nopic"}">
          ${pic}
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
  if (promos.length) {
    const pages = Math.max(1, Math.ceil(promos.length / POCKETS));
    for (let p = 0; p < pages; p++)
      out.push(leafOf(promos.slice(p * POCKETS, (p + 1) * POCKETS).map((o) => ({ has: true, owned: o, slot: null, promo: true })),
        { key: "promo", label: "Promos", total: promos.length, page: p + 1, pages, of: promos.length }));
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
    () => `            <li class="t30-pk pad" aria-hidden="true"></li>`).join("\n");
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
          <a class="t30-turn back" href="#bl${prev.no}" aria-label="Turn back to page ${prev.no}, ${esc(prev.label)}"><span aria-hidden="true">&lsaquo;</span></a>
          <a class="t30-turn fwd" href="#bl${next.no}" aria-label="Turn to page ${next.no}, ${esc(next.label)}"><span aria-hidden="true">&rsaquo;</span></a>
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
  ...(promos.length ? [{ key: "promo", label: "Promos", total: null, have: promos.length }] : []),
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
          <h3>${esc(longDate(date))}</h3>
          <ul>
${items
  .map(
    (p) => `            <li>
              <span class="t30-p">${esc(p.name)}</span>
              <span class="t30-meta">${[p.packs ? `${p.packs} pack${p.packs === 1 ? "" : "s"}` : null, p.price || null]
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

const style = `
.t30-hero{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);box-shadow:var(--lift)}
.t30-facts{list-style:none;display:grid;gap:var(--s3);margin:var(--s4) 0 0}
.t30-facts li{padding-left:1.15em;position:relative;line-height:1.45}
.t30-facts li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--ketchup)}
.t30-tag{display:inline-block;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;
  padding:4px 7px;border-radius:999px;border:1px solid var(--keyline);color:var(--ink-2);background:var(--paper);margin-right:6px;vertical-align:.12em}
.t30-tag.off{color:var(--ink);border-color:var(--ketchup)}
.t30-sum{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin:var(--s4) 0 0}
.t30-sum div{background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3);text-align:center}
.t30-sum b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink)}
.t30-sum span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
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
/* THE COVER, AND WHY IT IS NOT JUST A HEADING. It is the binder's front board:
   it shares the track's left, right and top border, sits flush on it with no
   gap and no margin, and carries the only rounded corners at the top so the
   two elements read as one bound object rather than a title above a widget.
   The darker fill is --chrome-bg, the page's own darkest surface, because a
   binder board is darker than the sheet inside it and that is the whole cue. */
.t30-cover{background:var(--chrome-bg);border:1px solid var(--keyline);border-bottom:0;
  border-radius:var(--r) var(--r) 0 0;padding:var(--s4) var(--s4) var(--s3);
  text-align:center;display:grid;justify-items:center;gap:6px}
.t30-cover img{max-width:180px;height:auto;display:block}
.t30-cover-t{margin:0;font:400 var(--t-l)/1.1 var(--display);color:var(--ink)}
.t30-cover-s{margin:0;font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.06em}
/* The track loses its own top rounding so the seam with the cover disappears. */
.t30-binder .t30-track{border-radius:0 0 var(--r) var(--r)}
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
.t30-pkts{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:0}
/* An empty pocket that only exists to keep the page nine pockets tall. Hatched
   rather than blank so it reads as page, not as a missing card. */
.t30-pk.pad{border-style:dashed;opacity:.35;background:var(--chrome-bg)}
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
.t30-needs{margin:var(--s5) 0 0;max-width:560px}
.t30-needs h3{margin:0 0 var(--s3);font:400 var(--t-l)/1.15 var(--display);color:var(--ink)}
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
.t30-pk{aspect-ratio:5/7;border:1px dashed var(--keyline);border-radius:var(--r-sm);background:var(--paper);box-shadow:inset 0 1px 3px rgb(0 0 0 / .22);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;text-align:center;min-width:0}
.t30-pk .t30-pn{font:700 var(--t-micro)/1 var(--mono)}
.t30-pk.has{border-style:solid;border-color:var(--ketchup);background:var(--card);box-shadow:inset 0 1px 3px rgb(0 0 0 / .18),var(--lift)}
/* .t30-got is gone with the date overlay it styled, 22 September 2026. */
.t30-more{color:var(--ink-2);font-size:var(--t-sm);margin-top:var(--s3)}
.t30-wave{margin-top:var(--s4)}
.t30-wave h3{margin:0 0 var(--s3);font:400 var(--t-l)/1.15 var(--display)}
.t30-wave ul{list-style:none;display:grid;gap:var(--s3);margin:0}
.t30-wave li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);padding:var(--s3);display:grid;gap:4px}
.t30-p{font-weight:700;color:var(--ink)}
.t30-meta{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.45}
.t30-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--keyline);border-radius:var(--r-sm);margin-top:var(--s4)}
.t30-tbl{border-collapse:collapse;width:100%;min-width:24em;font-size:var(--t-sm)}
.t30-tbl th,.t30-tbl td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--keyline);white-space:nowrap}
.t30-tbl th{font:700 var(--t-micro)/1 var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2);position:sticky;top:0;background:var(--card)}
.t30-tbl td:nth-child(1){font-family:var(--mono);color:var(--ink-2)}
.t30-tbl tr:last-child td{border-bottom:0}
.t30-src{list-style:none;margin:var(--s4) 0 0;display:grid;gap:8px}
.t30-src li{overflow-wrap:anywhere;font-size:var(--t-sm)}
`;

const TITLE = "Pokemon 30th Celebration: Products, Dates and Card List";
const DESC =
  "Every 30th Celebration product with its date and price, what is actually in a pack, " +
  `Japan's full ${doc.japanList.length} card list, and a master set tracked pocket by pocket.`;
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
    publisher: { "@type": "Organization", name: "Garbage Rips 585" },
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
const TOP_N = 12;
const valueBand = !pricedCards.length ? "" : `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label">The ones you want</p>
    <h2>Most valuable <span class="hl">30th Celebration</span> cards</h2>
    <p class="lede" style="max-width:44em">Most valuable first, by what an ungraded copy is worth. ${
      pricedCards.length
    } of the ${TOTAL} cards have a price so far${
      prices.counts && prices.counts.psa10
        ? `, and ${prices.counts.psa10} of those already have a PSA 10 figure`
        : ""
    }. The rest are not cheap, they are <strong>unpriced</strong>: the set came out ${esc(
      shortDate(doc.set.release)
    )} and a guide value needs sales to compute from.</p>
    <ol class="t30-cts">
${pricedCards.slice(0, TOP_N).map((c) => cardTile(c)).join("\n")}
    </ol>
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
<section class="tight">
  <div class="wrap">
    <p class="sec-label">What is actually rare</p>
    <h2>Rarity breakdown</h2>
    <p style="max-width:44em">Counted off the ${
      (checklist.cards || []).length
    } cards on the checklist, not typed in. <strong>Every card in this set is foil</strong>, basic Energy
      included, so a rarity here is about how hard a card is to find rather than whether it shines.</p>
    <ul class="t30-rar">
${rarityRows
  .map(
    ([name, n]) => `      <li><b>${n}</b><span>${esc(name)}</span></li>`
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
const checklistBand = !(checklist.cards || []).length ? "" : `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label">Every card</p>
    <h2>Full ${TOTAL} card <span class="hl">checklist</span></h2>
    <p class="lede" style="max-width:44em">${
      (checklist.cards || []).length
    } of the ${TOTAL} are listed and pictured. What is missing is missing at the source: the eight foil
      basic Energy are numbered in a separate MEE set that the card checklists leave out, so the binder
      below adds all eight by hand, read off the cards themselves${
        US.count ? `, and ${US.count} secret rares are the Mew RGB cards The Pokemon Company still has not acknowledged` : ""
      }.</p>
${SECTIONS.map(([key, label]) => {
  const rows = (checklist.cards || []).filter((c) => c.section === key);
  if (!rows.length) return "";
  return `    <h3>${esc(label)} <span class="t30-cnt">${rows.length}</span></h3>
    <ol class="t30-cts">
${rows.map((c) => cardTile(c)).join("\n")}
    </ol>`;
}).filter(Boolean).join("\n")}
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
<section class="tight">
  <div class="wrap">
    <p class="sec-label">Pulled on camera</p>
    <h2>What we have hit from <span class="hl">this set</span></h2>
    <p class="lede" style="max-width:44em">${setHits.length} card${setHits.length === 1 ? "" : "s"} out of
      ${setHits.length === 1 ? "one rip" : `${new Set(setHits.map((r) => r.v.id)).size} rips`} so far. Every one
      links to the pack it came out of. This is a different list from the binder below: the binder is every
      card owned however it got there, and this is only what came out on camera.</p>
    <ol class="t30-cts">
${setHits
  .map(({ h, v, row, pr, promoPid }) => {
    /* No normalising here any more: dexLocalId() inside pictureFor() takes the
       number in either shape, which is the whole point of moving it there. */
    const pic = pictureFor(h.card, { n: row ? row.n : h.number, row: row || (promoPid ? { pid: promoPid } : null), section: row ? row.section : null });
    return `        <li class="t30-ct${pic ? "" : " nopic"}">
          <a href="/${esc(v.path)}">
            ${pic}
            <p class="t30-ct-n">${esc(h.card)}</p>
            <p class="t30-ct-m">#${esc(
              /* THE FULL NUMBER FOR A CLASSIC COLLECTION CARD, because "69" on
                 its own is not what the card says and is not unique in that
                 section -- it holds two 11s and three 106s. Everything else is
                 numbered in the 30th's own sequence, where the numerator is the
                 whole answer. */
              row && row.section === "classic" ? String(h.number) : String(h.number).split("/")[0]
            )}${
              h.rarity ? ` &bull; ${esc(h.rarity)}` : ""
            }</p>
            ${
              pr && typeof pr.raw === "number"
                ? `<p class="t30-ct-p">${moneyExact(pr.raw)}<span>raw NM</span></p>`
                : `<p class="t30-ct-p none">No price yet</p>`
            }
            <p class="t30-ct-v">${esc(shortDate(v.published))}</p>
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
if(i.getAttribute("data-r")){box.remove();return}
i.setAttribute("data-r","1");
if(box!==i){var s=p.querySelectorAll("source");for(var k=0;k<s.length;k++)s[k].remove()}
var u=i.getAttribute("src")||"";i.removeAttribute("srcset");i.removeAttribute("sizes");
setTimeout(function(){i.src=u+(u.indexOf("?")<0?"?r=1":"&r=1")},1500)}
/* AND THE CARD BACK STEPS OUT ONCE THE PICTURE IS IN. A grey card is drawn at
   78% opacity, so the name on the card back underneath showed through it. */
function t30l(i){var k=i.closest&&i.closest(".t30-pk");if(k)k.classList.add("ld")}
</script>

<header class="band-sky tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/sets/">Sets</a> / 30th Celebration</nav>
    ${heroLogo()}
    <h1>Pokemon 30th Celebration</h1>
    <p class="lede" style="max-width:42em">${esc(doc.set.releaseNote.split(".")[0])}. It is all foil, there is
      no booster box, and every pack comes inside one of ${doc.products.length} products. This page is what is
      known about it, what is not, and how far along one master set is.</p>
    <div class="t30-sum">
      <!-- shortDate, NOT longDate, AND THE DIFFERENCE IS 53px OF CLIPPED TEXT.
       These cells are 44px Titan One in a 209px box, which is roomy for the
       other three values -- they are 199, 15 and 93 -- and far too narrow for
       a month name: "September" alone measures 262px and was being cut off
       mid-word, so the page's most prominent fact read "Septembe". Measured in
       the browser against the real computed font rather than eyeballed, and
       "Sep 16, 2026" has a longest word of 115px and wraps to two lines that
       both fit. Any value that can be a word rather than a number needs this
       check; the box does not grow. -->
      <div><b>${esc(shortDate(doc.set.release))}</b><span>Release, worldwide</span></div>
      <div><b>${E.count}</b><span>Cards in English, per PokeBeach</span></div>
      <div><b>${doc.products.length}</b><span>Products, ${waves.size} wave${waves.size === 1 ? "" : "s"}</span></div>
      <div><b>${packTotal}</b><span>Packs across them all</span></div>
    </div>
    <p class="t30-msjump"><a href="#masterset"><b>${pct}% of the set collected</b>
      <span>${haveTotal} of ${TOTAL} cards &middot; see the master set binder &rarr;</span></a></p>
  </div>
</header>
${valueBand}
${hitsBand}

<section class="band tight">
  <div class="wrap">
    <h2>What is actually in a pack</h2>
    <ul class="t30-facts">
      <li><span class="t30-tag off">Official</span>${esc(doc.set.packContents.split(".")[0])}.</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.allFoil)}</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.classicLegality.split(": ")[1] || doc.set.classicLegality)}</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.tcgLive.split(".")[0])}.</li>
      <li><span class="t30-tag">No box</span>${esc(doc.set.noBox)}</li>
    </ul>
    <h3>What the cards themselves settled</h3>
    <p style="max-width:42em"><span class="t30-tag off">From the printing</span>${esc(
      doc.fromTheCards._note
    )}</p>
    <ul class="t30-facts">
      <li><span class="t30-tag off">Set code</span>${esc(doc.fromTheCards.setCode)}</li>
      <li><span class="t30-tag off">128 confirmed</span>${esc(doc.fromTheCards.mainSetSize)}</li>
      <li><span class="t30-tag off">Energy</span>${esc(doc.fromTheCards.energyNumbering)}</li>
      <li><span class="t30-tag off">Japan differs</span>${esc(doc.fromTheCards.japanMismatchProved)}</li>
    </ul>

    <h3>What every pack guarantees</h3>
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
    </ul>

    <h3>${esc(doc.japanBoxOpening.label)}</h3>
    <p style="max-width:42em"><span class="t30-tag">One box, not a rate</span>${esc(doc.japanBoxOpening.caveat)}</p>
    <div class="t30-scroll" style="max-width:32em">
      <table class="t30-tbl">
        <caption class="t30-cap">What came out of one ${doc.japanBoxOpening.packs} pack Japanese box. ${esc(
          doc.japanBoxOpening.where
        )}.</caption>
        <thead><tr><th scope="col">Card</th><th scope="col">In that box</th></tr></thead>
        <tbody>
${doc.japanBoxOpening.rows
  .map((r) => `            <tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`)
  .join("\n")}
        </tbody>
      </table>
    </div>

    <h3>English pull rates</h3>
    <p style="max-width:42em"><span class="t30-tag">Not published</span>${esc(doc.englishRates.split(". ADD THEM")[0])}.
      They will be added here when the publisher or PokeBeach states them. A number worked out from somebody's
      early box is not one of those, and this page will not carry it as one.</p>
    <p style="max-width:42em">What the channel has actually opened is counted separately and labeled as
      observed results rather than as odds. <a href="/luck.html">See those numbers</a>.</p>
  </div>
</section>

${rarityBand}
${checklistBand}

<section class="tight">
  <div class="wrap">
    <h2>Every product, by release wave</h2>
${waveBlocks}
    <h3>Free promo at the counter</h3>
    <p style="max-width:42em">${esc(doc.storePromo)}</p>
    <h3>Cards the English set does not have</h3>
    <p style="max-width:42em">${esc(doc.cutCards)}</p>
    <h3>Accessories</h3>
    <p style="max-width:42em">${esc(doc.accessories)}</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <h2>Japan's card list, all ${doc.japanList.length} revealed</h2>
    <p style="max-width:42em"><strong>This is Japan's set and not the English one.</strong> ${esc(
      doc.structure.japan.note
    )} It is here because Japan's set is a different set, not an early look at this one, and the
      numbering does not line up card for card, so for anything English, use the English checklist
      above. A Japanese number is not a guide to an English one.</p>
    <p class="price-note">${esc(doc.structure.derived)}</p>
    <div class="t30-scroll">
      <table class="t30-tbl">
        <thead><tr><th scope="col">No.</th><th scope="col">Card</th><th scope="col">Part of</th></tr></thead>
        <tbody>
${jpRows}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="tight" id="masterset">
  <div class="wrap">
    <p class="sec-label">One collector's copy</p>
    <h2>The master set, pocket by pocket</h2>
    <p style="max-width:42em">Nine pockets to a page, the same as the set's own Binder Collection. A filled pocket
      is a card actually in the binder. The empty ones are the job.${
        CHECKLIST.size
          ? ` Every card is shown: the ones still to find are the grey ones.`
          : ""
      }</p>
    <div class="t30-hero">
      <h3 style="margin:0">${haveTotal} of ${TOTAL} cards <span class="t30-cnt">${pct}%</span></h3>
      <div class="t30-bar" style="margin-top:var(--s3)" role="img" aria-label="${haveTotal} of ${TOTAL} collected"><span style="width:${pct}%"></span></div>
      <p class="t30-bn" style="margin-bottom:0">${
        haveTotal === 0
          ? `Nothing in it yet, which is correct rather than broken: the set does not release until ${esc(
              longDate(doc.set.release)
            )}. Cards get added here as they are opened.`
          : /* THE NEWEST `got`, NOT THE FILE'S `checked`. This printed the date the
             binder was last REVIEWED as the date a card was last ADDED, so it
             claimed a card entered on 17 September when the newest of all 27 is
             the 16th. One is an event the data contains; the other is when
             somebody looked at the file. */
          `Last added ${esc(longDate(
            owned.map((c) => c.got).filter(Boolean).sort().pop() || binder.checked
          ))}.`
      }</p>
    </div>
    <ul class="t30-secsum">
${sectionSummary}
    </ul>

    <figure class="t30-binder">
      ${/* THE COVER. The owner asked for it in these words: "give it a 30th Celebration
           logo at the top of the binder and then under the 30th logo it says Master
           Set Binder". It is the front board of the binder rather than a heading
           floating above one, which is why it shares the track's border and has no
           gap under it -- the two read as one object, and the rings below run past
           both.

           THE LOGO IS THE SET'S OWN and is already on this page's hero, so it is a
           cache hit rather than a second download. It is DECORATIVE here: the
           accessible name of this component lives on the track's aria-label and the
           words "Master Set Binder" are real text underneath, so alt="" is correct
           and an alt of "30th Celebration" would make a screen reader say the set
           name twice in a row. */""}
      <div class="t30-cover">
        <picture>
          <source type="image/avif" srcset="/assets/logos/30th-celebration-pokemon-tcg-set-logo-sm.avif">
          <img src="/assets/logos/30th-celebration-pokemon-tcg-set-logo-sm.webp" alt=""
               width="180" height="84" decoding="async" onerror="this.remove()">
        </picture>
        <p class="t30-cover-t">Master Set Binder</p>
        <p class="t30-cover-s">${haveTotal} of ${TOTAL} cards &middot; ${pct}% complete</p>
      </div>
      <div class="t30-track" id="binder" tabindex="0" role="group" aria-label="Binder pages, ${LEAF_N} of them. Scroll sideways or use the page corners.">
${BINDER_LEAVES.map(leafHtml).join("\n")}
      </div>
      <p class="t30-sr" id="binder-live" role="status" aria-live="polite"></p>
      <figcaption>${haveTotal} of ${TOTAL} toward the set, across ${LEAF_N} pages of nine pockets${promos.length + jumbos.length ? `, plus ${promos.length + jumbos.length} outside it` : ""}.
        Turn a page with either corner, or jump to one below. A grey card is one still to find.${
          jumbos.length ? ` The jumbos on the last page have <a href="/jumbo-cards.html">a guide of their own</a>.` : ""
        }</figcaption>
    </figure>

    <nav class="t30-rail" aria-label="Jump to a binder page">
${railHtml}
    </nav>
${needList}

    <p class="price-note" style="margin-top:var(--s5)"><strong>199 is not an official number.</strong>
      ${esc(E.note)} The Pokemon Company has never published a card count for this set, so these bars run
      against PokeBeach's count and may move when the last secret rares are shown.</p>
${
  /* WHERE THE PICTURES CAME FROM, SAID ON THE PAGE. This site names the source
     of every figure it prints and a card scan is no different -- and here it is
     doubly worth saying, because these are NOT the source the other 59,758 card
     images on this site come from. The count is computed, never typed, so it
     cannot drift from the binder above it. */
  CHECKLIST.size
    ? `    <p class="price-note"><strong>Where the card pictures come from.</strong>
      ${DEX_PICS} of the ${TOTAL} come from TCGdex, which is where the rest of this site's card
      scans come from; it took this set two days after release. ${REMOTE_PICS} are hotlinked from
      TCGplayer instead: the whole Classic Collection, because TCGdex holds those as a separate set with
      no images at all, and the eight foil Energy, which TCGplayer files under its own MEE set rather than
      under either 30th Celebration name.${OWN_PICS > 0 ? ` ${OWN_PICS} ${OWN_PICS === 1 ? "is" : "are"} the
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

<section class="tight">
  <div class="wrap">
    <h2>Where all this came from</h2>
    <p style="max-width:42em">Anything marked <span class="t30-tag off">Official</span> is The Pokemon Company's
      own words. Everything else is PokeBeach, named in the sentence that uses it. Nothing on this page comes
      from a leak, a comment thread or a set tracker's extrapolation.</p>
    <ul class="t30-src">
${[...doc.sources, ...((doc.unlistedSecrets || {}).sources || [])]
  /* THE MEW RGB SOURCE WAS MISSING AND IT IS THE ONE CLAIM THAT MOST NEEDS IT.
     This section promises "everything else is PokeBeach, named in the sentence
     that uses it", and the sentence about three cards TPCi has never
     acknowledged cited nobody. unlistedSecrets carries its source; it just was
     not in the rendered list. */
  .filter((u, i, a) => a.indexOf(u) === i)
  .map((u) => `      <li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(u.replace(/^https?:\/\//, ""))}</a></li>`).join("\n")}
    </ul>
  </div>
</section>

</main>`;

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
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<!-- PRECONNECT, WHICH 1,039 OTHER PAGES HAVE AND THE HEAVIEST TCGDEX PAGE ON
     THE SITE DID NOT. This page draws 158 distinct cards from assets.tcgdex.net
     and 30 from tcgplayer-cdn, and every one is loading="lazy" -- so the
     preload scanner never sees them and the FIRST request to either host is
     issued at layout, paying DNS + TCP + TLS from cold at the moment a reader
     starts scrolling. build-pokemon.mjs and build-intl-pages.mjs already do
     this; this builder simply never got the line. -->
<link rel="preconnect" href="https://assets.tcgdex.net" crossorigin>
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
${body}

${footer(
  `Page last checked ${longDate(PAGE_CHECKED)}. Set facts read ${longDate(doc.checked)} from The Pokemon Company's press releases and product pages, and from PokeBeach where marked. The Pokemon Company has published no card count for this set; totals here are PokeBeach's.`
)}
${APP_JS_NO_PACKPLAYER}
<script>
/* THE BINDER WORKS WITHOUT THIS. Every control is an anchor to a leaf id and the
   track is a scroll-snap container, so a browser turns the page on its own. What
   this adds is that the WINDOW stays put while the track scrolls: following a
   plain #bl7 also scrolls the document to bring the track into view, which on a
   page this tall means the binder jumps under your thumb every turn.
   scrollIntoView with inline:"center" and block:"nearest" moves the track and
   leaves the document alone.
   It also restores the two things an anchor cannot do: left and right arrow keys
   once the track has focus, and keeping the address bar free of 25 #bl hashes as
   you flip. */
(function () {
  var t = document.getElementById("binder");
  if (!t || !t.scrollIntoView) return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* LOAD AHEAD OF THE READER. Every picture is loading="lazy", and WebKit starts
     a lazy image in a sideways scroller only about one leaf ahead, so flipping
     every second or two on cellular outran it: measured in real WebKit at
     1.6Mbps, leaves arrived showing 0 to 4 of their 9 cards and took 1 to 1.5s to
     fill. warm() flips the current leaf, the one behind and the two ahead to
     eager, which starts them now. The HTML stays lazy so the first load is
     unchanged and a reader with no script still gets every picture. */
  function warm(i) {
    var leaves = t.querySelectorAll(".t30-leaf");
    for (var k = i - 1; k <= i + 2; k++) {
      var lf = leaves[(k + leaves.length) % leaves.length];
      if (!lf || lf.getAttribute("data-warm")) continue;
      lf.setAttribute("data-warm", "1");
      var im = lf.querySelectorAll('img[loading="lazy"]');
      for (var j = 0; j < im.length; j++) im[j].loading = "eager";
    }
  }
  function show(el, focusIt) {
    if (!el) return;
    /* A JUMP IS NOT A PAGE TURN. The rail's smooth scroll from page 1 to page 14
       travelled past every leaf between and queued about 117 images ahead of the
       one asked for, which then sat at 0 of 9 for over a second and a half. More
       than one leaf away, the destination is warmed first and the track goes
       straight there. */
    var leaves = t.querySelectorAll(".t30-leaf"), to = Array.prototype.indexOf.call(leaves, el), from = current().i;
    if (to >= 0) warm(to);
    var far = to >= 0 && Math.abs(to - from) > 1;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce || far ? "auto" : "smooth" });
    if (focusIt) setTimeout(function () { mark(); }, reduce ? 0 : 260);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#bl"]');
    if (!a) return;
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (!el || !t.contains(el)) return;
    e.preventDefault();
    show(el);
  });
  /* WHICH LEAF IS NEAREST THE MIDDLE, not whichever the last click named: a
     swipe changes the page without any click at all, so the arrow keys have to
     read the track rather than remember. */
  function current() {
    var leaves = t.querySelectorAll(".t30-leaf"), mid = t.scrollLeft + t.clientWidth / 2, best = 0, d = Infinity;
    for (var i = 0; i < leaves.length; i++) {
      var c = leaves[i].offsetLeft + leaves[i].offsetWidth / 2, x = Math.abs(c - mid);
      if (x < d) { d = x; best = i; }
    }
    return { leaves: leaves, i: best };
  }
  t.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var c = current(), step = e.key === "ArrowRight" ? 1 : -1;
    var n = (c.i + step + c.leaves.length) % c.leaves.length;
    e.preventDefault();
    show(c.leaves[n], true);
  });

  /* WHICH PAGE AM I ON. The rail is 26 numbers and none of them said. There was
     no aria-current anywhere in the component and no :target rule, so the only
     anchor was the leaf header you happened to be able to read -- and the rail
     restarts its numbering inside each section, so "Main set 3" and "Page 7 of
     26" are the same page and neither number appears in the other place.
     This marks the live one in both senses at once: aria-current="page" for a
     screen reader, and a class the stylesheet can paint. */
  var rail = document.querySelectorAll('.t30-rail a[href^="#bl"]');
  var live = document.getElementById("binder-live");
  var lastAnnounced = -1;
  function mark() {
    var c = current(), id = c.leaves[c.i] && c.leaves[c.i].id;
    if (!id) return;
    warm(c.i);
    /* ONE PAGE IN THE TAB ORDER, NOT 26. Each leaf carries two turn corners, so
       the binder alone was 52 tab stops, 50 of them on pages nobody could see.
       Leaves off screen are inert; the scroll and the swipe are unaffected. */
    for (var q = 0; q < c.leaves.length; q++) {
      if (q === c.i) c.leaves[q].removeAttribute("inert");
      else c.leaves[q].setAttribute("inert", "");
    }
    for (var i = 0; i < rail.length; i++) {
      var on = rail[i].getAttribute("href") === "#" + id;
      if (on) { rail[i].setAttribute("aria-current", "page"); rail[i].classList.add("is-here"); }
      else { rail[i].removeAttribute("aria-current"); rail[i].classList.remove("is-here"); }
    }
    /* ANNOUNCE IT, ONCE IT HAS SETTLED. A page turn swapped the contents of a
       container the reader is not focused in and said nothing at all, so
       pressing Enter produced no evidence anything had happened. The live region
       is polite and fires on the leaf CHANGING rather than on every scroll
       frame, so a swipe does not machine-gun it. */
    if (live && c.i !== lastAnnounced) {
      lastAnnounced = c.i;
      /* The leaf's own label ALREADY reads "Page 2 of 26, <section>", so the
         section is what gets kept and the count is not appended a second time.
         The first cut announced "Page 2 of 26 of 26". */
      live.textContent = c.leaves[c.i].getAttribute("aria-label") || "";
    }
  }
  var tick;
  t.addEventListener("scroll", function () {
    clearTimeout(tick);
    tick = setTimeout(mark, 120);
  }, { passive: true });
  mark();

  /* FOCUS FOLLOWS THE TURN, which is the one that made the keyboard unusable.
     Activating a corner moved the track and left focus on the control you just
     left -- now off-screen -- and that control still pointed at the page you
     were already on, so a second Enter did nothing and you had to Tab twice to
     turn twice. Focus now lands on the same corner of the leaf you arrived at,
     so Enter, Enter, Enter pages through. It is only done for a REAL activation,
     never for a scroll or a swipe, because moving focus at somebody who is
     swiping is its own bug. */
  function follow(el, fwd) {
    if (!el) return;
    /* mark() makes off-screen leaves inert and an inert corner cannot take
       focus, so the arriving leaf is released before focus is sent to it. */
    el.removeAttribute("inert");
    var target = el.querySelector(fwd ? ".t30-turn.fwd" : ".t30-turn.back");
    if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var a = e.target.closest && e.target.closest('.t30-turn[href^="#bl"]');
    if (!a) return;
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (!el || !t.contains(el)) return;
    var fwd = a.classList.contains("fwd");
    setTimeout(function () { follow(el, fwd); mark(); }, reduce ? 0 : 260);
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
console.log(
  `Wrote public${PATH}  ${haveTotal}/${TOTAL} owned, ${doc.products.length} products, ${doc.japanList.length} Japanese cards`
);
