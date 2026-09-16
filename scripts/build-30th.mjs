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
import { esc, longDate, shortDate, clipMeta, imgDims, avifPicture } from "../shared/format.mjs";

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
const SECTIONS = [
  ["pikachu", "The 30 Pikachu", E.pikachu, "One in every pack, each by a different illustrator. Japan's first is Ken Sugimori redrawing his own Jungle Pikachu."],
  ["main", "Main set", E.main - E.pikachu, "Everything else in the numbered main set."],
  ["secret", "Secret rares", E.secret, "Illustration rares, special illustration rares, and the two Futuristic rares."],
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
const OWN_PICS = owned.filter((c) => c.shot).length;
const REMOTE_PICS =
  CHECKLIST.size -
  owned.filter((c) => c.shot && CHECKLIST.has(clKey(c.section, c.n || ""))).length;
const NO_PICS = TOTAL - REMOTE_PICS - OWN_PICS;
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
    `alt="${esc(name)}, photographed by Garbage Rips 585" loading="lazy" decoding="async"` +
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
const tcgpImg = (pid, name) =>
  `<img class="t30-card" src="${tcgpBase(pid)}_200w.jpg" ` +
  `srcset="${tcgpBase(pid)}_200w.jpg 200w, ${tcgpBase(pid)}_400w.jpg 400w" ` +
  `sizes="(max-width:544px) 30vw, 163px" ` +
  `alt="${esc(name)}" loading="lazy" decoding="async">`;

const cardImg = (localId, name) => {
  const url = `${scanBase(localId)}/low.webp`;
  const d = imgDims(url);
  const img =
    `<img class="t30-card" src="${url}" ` +
    `srcset="${scanBase(localId)}/low.webp 245w, ${scanBase(localId)}/high.webp 600w" ` +
    `sizes="(max-width:544px) 30vw, 163px" ` +
    `alt="${esc(name)}" loading="lazy" decoding="async"${d ? " " + d : ""}>`;
  return avifPicture(img);
};

/* THE ONE PLACE THAT DECIDES WHICH PICTURE A POCKET GETS, so the owned and the
   needed pocket can never disagree about it. Precedence is the owner's own
   photograph, then TCGdex, then TCGplayer, then nothing -- his photo of the
   copy in his hand is the better picture on a page about HIS binder, and
   TCGdex is the canonical source the rest of the site's 59,758 card images
   come from. `row` is the checklist row when there is one. */
const pictureFor = (name, { shot, n, row }) => {
  if (shot) return shotImg(shot, name);
  if (HAVE_DEX && n) return cardImg(n, name);
  /* NO avifPicture() HERE, AND IT USED TO BE WRAPPED IN ONE. That helper
     rewrites a .webp srcset to .avif for TCGdex and our own pack renditions
     only, and returns its input untouched for anything else -- these are .jpg
     off a third party, so the call was a no-op dressed as an optimisation.
     TCGplayer publishes no AVIF. */
  if (row && row.pid) return tcgpImg(row.pid, name);
  return "";
};

// A pocket is one of three states and they are visibly different from each
// other, never by colour alone: owned draws the card in full colour with a
// solid border, needed draws the same card desaturated and dimmed behind a
// dashed border, and unknown draws a number because there is no picture to show.
const pocket = (c, i, slot) => {
  if (c) {
    const row = CHECKLIST.get(clKey(c.section, c.n || ""));
    return `<li class="t30-pk has" title="${esc(c.name)}">
        ${pictureFor(c.name, { shot: c.shot, n: c.n, row })}
        <span class="t30-pn">${esc(c.n ? "#" + c.n : "")}${c.setCode ? " " + esc(c.setCode) : ""}</span>
        ${c.shot ? "" : `<span class="t30-nm">${esc(c.name)}</span>`}
        ${c.got ? `<span class="t30-got">${esc(longDate(c.got))}</span>` : ""}
      </li>`;
  }
  if (HAVE_SCANS && slot) {
    const pic = pictureFor(slot.name, { n: slot.n, row: slot });
    return `<li class="t30-pk need" title="${esc(slot.name)}">
        <span class="t30-sr">Not collected yet</span>
        ${pic}
        <span class="t30-pn">${esc("#" + String(slot.n).split("/")[0])}</span>
        ${pic ? "" : `<span class="t30-nm">${esc(slot.name)}</span>`}
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
                   USED TO GIVE THE CAP'S REASON FOR BOTH. With a checklist, a
                   short section means the CARD HAS NOT BEEN REVEALED: three
                   secret rares were still blank on release day and PokeBeach's
                   own guide says so. "Not drawn until they are closer to being
                   filled" is the cap's reason and was simply untrue of those. */
                ? ` ${total - shown} more ${total - shown === 1 ? "card" : "cards"} in this section ${total - shown === 1 ? "has" : "have"} not been revealed yet, so ${total - shown === 1 ? "it has" : "they have"} no pocket to show.`
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
.t30-facts li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--hl)}
.t30-tag{display:inline-block;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;
  padding:4px 7px;border-radius:999px;border:1px solid var(--keyline);color:var(--ink-2);background:var(--paper);margin-right:6px;vertical-align:.12em}
.t30-tag.off{color:var(--ink);border-color:var(--hl)}
.t30-sum{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin:var(--s4) 0 0}
.t30-sum div{background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3);text-align:center}
.t30-sum b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink)}
.t30-sum span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-bs{margin-top:var(--s5)}
.t30-bs h3{display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap;margin:0}
.t30-cnt{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);background:var(--paper);border:1px solid var(--keyline);border-radius:999px;padding:4px 8px}
.t30-cnt.done{color:var(--ink);border-color:var(--hl)}
.t30-bn{color:var(--ink-2);margin:6px 0 var(--s3)}
.t30-bar{height:6px;border-radius:999px;background:var(--paper);border:1px solid var(--keyline);overflow:hidden;margin-bottom:var(--s4)}
.t30-bar span{display:block;height:100%;background:var(--hl)}
.t30-pkts{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:0;max-width:520px}
.t30-pk{aspect-ratio:5/7;border:1px dashed var(--keyline);border-radius:var(--r-sm);background:var(--paper);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;text-align:center;min-width:0}
.t30-pk .t30-pn{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-3,var(--ink-2));opacity:.55}
.t30-pk.has{border-style:solid;border-color:var(--hl);background:var(--card);box-shadow:var(--lift)}
.t30-pk.has .t30-pn{opacity:1;color:var(--ink-2)}
.t30-nm{font:700 var(--t-sm)/1.2 var(--body,inherit);color:var(--ink);overflow-wrap:anywhere}
.t30-got{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
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
  "Japan's full 176 card list, and a master set tracked pocket by pocket.";

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: clipMeta(DESC),
    url: SITE + PATH,
    dateModified: doc.checked,
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

const body = `<main id="main">

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
      <div><b>${doc.products.length}</b><span>Products, five waves</span></div>
      <div><b>${packTotal}</b><span>Packs across them all</span></div>
    </div>
  </div>
</header>

<section class="tight">
  <div class="wrap">
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
          : `Last added ${esc(longDate(binder.checked))}.`
      }</p>
    </div>
${SECTIONS.map(binderSection).join("\n")}
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
      ${REMOTE_PICS} of the ${TOTAL} are hotlinked from TCGplayer, who listed this set before
      TCGdex did &mdash; TCGdex is where the rest of this site's card scans come from, and on release
      day it still held no 2026 anniversary set. ${OWN_PICS} are the owner's own photographs of the
      copies in his hands, which is why they look different from the rest. Nothing here is rehosted
      or resized.${
        NO_PICS > 0
          ? ` The remaining ${NO_PICS} have no picture yet: the eight foil Energy are numbered in a
      different set and are not listed, and a few secret rares are still unrevealed.`
          : ""
      }</p>`
    : ""
}
  </div>
</section>

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
    )} It is here because it is the only full list of this set that exists in words anywhere:
      the English card images have been revealed but their names have not been published, so an English
      checklist would have to be guessed from Japanese numbers that demonstrably do not line up.</p>
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

<section class="tight">
  <div class="wrap">
    <h2>Where all this came from</h2>
    <p style="max-width:42em">Anything marked <span class="t30-tag off">Official</span> is The Pokemon Company's
      own words. Everything else is PokeBeach, named in the sentence that uses it. Nothing on this page comes
      from a leak, a comment thread or a set tracker's extrapolation.</p>
    <ul class="t30-src">
${doc.sources.map((u) => `      <li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(u.replace(/^https?:\/\//, ""))}</a></li>`).join("\n")}
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
  `Set facts read ${longDate(doc.checked)} from The Pokemon Company's press releases and product pages, and from PokeBeach where marked. The Pokemon Company has published no card count for this set; totals here are PokeBeach's.`
)}
${APP_JS_NO_PACKPLAYER}
</body>
</html>
`;

await writeFile(join(ROOT, "public" + PATH), html);
console.log(
  `Wrote public${PATH}  ${haveTotal}/${TOTAL} owned, ${doc.products.length} products, ${doc.japanList.length} Japanese cards`
);
