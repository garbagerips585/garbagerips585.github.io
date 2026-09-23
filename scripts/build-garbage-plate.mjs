#!/usr/bin/env node
// Build public/garbage-plate.html from data/garbage-plate.json: what a Garbage
// Plate is, where it came from, what is on one, and where to eat one.
//
//   node scripts/build-garbage-plate.mjs
//
// WHY THIS PAGE EXISTS. The owner asked for it twice, and the second ask is the one
// that shapes it: "I think there is really some good SEO juice to be had with a
// dedicated Garbage Plate informational page built out, not a ton of great
// places to get good garbage plate info". He is right about the coverage. What
// is out there is listicles and a paragraph of half-remembered origin story
// repeated from page to page, and almost none of it names a source.
//
// SO THE LEVER IS TRACEABILITY, NOT KEYWORDS, and it is the same lever
// /first-partner-illustration-collection.html pulled. A sourced history with
// the dates and the sources on the page, a diagram that actually shows what the
// layers are, and a restaurant list where every address is real and every
// unconfirmed hour SAYS it is unconfirmed, beats a better written page that
// asserts things. Every claim here carries the source it came from and the day
// it was read, exactly as every price on this site does. Nothing is widened to
// catch a phrase and nothing is stated that data/garbage-plate.json cannot
// source; that file's `notSourced` list is printed on the page rather than
// quietly dropped, because saying what you do not know is itself a reason to
// trust the rest.
//
// THE DISH IS NOBODY'S PROPERTY AND THE NAME IS SOMEBODY'S. The owner settled the
// first half: "im not worried about any Garbage Plate licensing, its a local
// page, and its only supporting the local food in Rochester, NY its not selling
// anything". He is right, and the second half is a fact rather than a worry:
// GARBAGE PLATE is a live federal trademark, which is exactly why every other
// kitchen in this city sells a trash plate. The page explains that instead of
// tiptoeing around it, and it is careful never to describe another restaurant's
// dish as a Garbage Plate when that restaurant does not.
//
// THIS FILE USED TO SAY THERE ARE NO PHOTOGRAPHS ON THIS PAGE AND THAT THE
// ABSENCE WAS THE DESIGN. It said the repo held no licensed photograph of a
// building or of a plate, that a picture of a restaurant is somebody's
// copyright, and that Street View is licensed in a way a static site with no
// keys can never meet. All three sentences are still true. The conclusion drawn
// from them was not, and the reason is worth writing down because it is a shape
// this repo keeps producing: A TRUE STATEMENT ABOUT THE CANDIDATES SOMEBODY
// LOOKED AT WAS WRITTEN AS A STATEMENT ABOUT THE SUBJECT. What had been looked
// at was restaurant sites, food blogs and Street View. What had not been looked
// at was the one place that exists to hold freely licensed pictures. Wikimedia
// Commons holds eleven photographs of this dish and of the restaurant it comes
// from, and ten of them are CC BY, CC BY-SA or public domain.
//
// SO THERE ARE TEN PHOTOGRAPHS ON IT NOW, added 20 August 2026, and every one
// of them was verified by loading that file's OWN description page on Commons.
// The licenses, the photographers and the dates live in data/garbage-plate.json
// beside the sourced facts, in the same shape and for the same reason, and
// scripts/sync-plate-photos.py re-reads all of it from Commons on every run and
// refuses to write a file whose license, author or license url has moved.
//
// THE CREDIT IS NOT OPTIONAL AND IT IS NOT A FOOTNOTE. CC BY and CC BY-SA both
// require the photographer's name, an indication of the license and a LINK to
// that license, and a credit a reader cannot connect to the picture it belongs
// to is not a credit. So every photograph on this page is a <figure> whose
// <figcaption> carries the photographer, the license name linked to the deed,
// and a link to the file on Commons, directly under the picture. There was no
// precedent on this site for that: the retailer marks in shared/brands.mjs are
// all public domain and are credited in JSON only. This is the precedent, and
// it is written down in CLAUDE.md rather than left in one builder.
//
// NOTHING IS CROPPED, AND THAT IS A LICENSE DECISION. Four of the ten are
// CC BY-SA, which asks that an ADAPTED work carry the same license. Resizing
// and re-encoding for delivery is not an adaptation; cropping is. Where the
// layout wants a 4:3 shape it gets it with object-fit, which changes what is
// DISPLAYED and not what is distributed.
//
// THE DIAGRAM IS STILL THE ASSET. The photographs show what a plate looks like;
// only the drawing can be cut open and labeled, it is the one thing on this
// subject that does not already exist somewhere, and it keeps the top of the
// anatomy section. The photographs sit under it, not over it.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, mailtoHref} from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS, same call and same reason as
// build-shops.mjs: nothing on this page plays a rip where it sits.
import { APP_JS_NO_PACKPLAYER as APP_JS, dropUnusedPacksCSS } from "../shared/chrome.mjs";
import { esc, longDate, plateRule, PLATE_CSS, clipMeta} from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Strip tracking and session parameters from an outbound link.
 *
 * Lifted from build-shops.mjs, which argues it in full: a url copied out of a
 * restaurant's own site usually carries them, they point at one person's
 * browsing session rather than at the page, they rot, and they hand a third
 * party a record of where the visitor came from.
 */
function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    const junk = /^(_su_rec|_su_rec_id|utm_|fbclid|gclid|gbraid|wbraid|mc_eid|mc_cid|ref|_ga|igshid|si)$/i;
    for (const k of [...u.searchParams.keys()]) {
      if (junk.test(k) || k.startsWith("utm_")) u.searchParams.delete(k);
    }
    u.hash = "";
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build.
function hostOf(u) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const doc = JSON.parse(await readFile(join(ROOT, "data/garbage-plate.json"), "utf8"));
const places = doc.places || [];
const SRC = new Map((doc.sources || []).map((s) => [s.id, s]));

// A source id in the data that names no source is a citation to nothing, which
// is the one failure this page cannot survive: the whole claim of the page is
// that its facts are traceable. Throw rather than render a dangling footnote.
// Since 23 September 2026 that covers the guide too: every term, sauce note,
// variation, price row and FAQ answer carries its own source ids.
{
  const g = doc.guide || {};
  const rows = [
    ...(doc.history || []), ...(doc.anatomy?.layers || []),
    ...(g.order?.terms || []), ...(g.sauce?.items || []), ...(g.variations?.items || []),
    ...(g.prices?.rows || []), ...(g.faq || []),
    { src: [...(g.order?.tipSrc || []), ...(g.order?.ordersSrc || []), ...(g.home?.src || [])] },
  ];
  for (const row of rows) {
    for (const id of [...(row.src || []), row.quoteSrc].filter(Boolean)) {
      if (!SRC.has(id)) throw new Error(`garbage-plate.json: unknown source id "${id}"`);
    }
  }
}
for (const p of places) {
  if (!p.name || !p.url) throw new Error(`garbage-plate.json: a place needs a name and a url`);
  if (p.hoursSpec && !p.hoursSrc) {
    throw new Error(`garbage-plate.json: ${p.name} publishes hours with no hoursSrc. ` +
      `An hour nobody can check is how somebody drives to a locked door.`);
  }
}

/* ---- The photographs ---------------------------------------------------- *
 *
 * Ten freely licensed pictures, keyed by `where` in data/garbage-plate.json:
 * "hero", "anatomy", "history:<the entry's year field>" and
 * "place:<the restaurant's name>". A key that matches nothing renders nothing
 * and is caught by the check below rather than silently dropped, because a
 * photograph that quietly fails to appear looks exactly like a page that was
 * never given one.
 */
const PHOTOS = doc.photos || [];
const photoAt = (key) => PHOTOS.filter((p) => p.where === key);

// Same discipline as the source-id check above. A `where` naming a history
// entry or a restaurant that does not exist is a picture nobody will ever see,
// and the license work behind it is wasted without anything erroring.
{
  const keys = new Set(["hero", "anatomy"]);
  for (const h of doc.history || []) keys.add(`history:${h.year}`);
  for (const p of places) keys.add(`place:${p.name}`);
  for (const ph of PHOTOS) {
    if (!keys.has(ph.where)) {
      throw new Error(`garbage-plate.json: photo "${ph.slug}" is placed at "${ph.where}", ` +
        `which is not a section, a history entry or a restaurant on this page.`);
    }
    for (const f of ["slug", "alt", "by", "license", "page", "w", "h", "maxw"]) {
      if (!ph[f]) throw new Error(`garbage-plate.json: photo "${ph.slug}" has no ${f}.`);
    }
    // THE ONE THAT MATTERS. CC BY and CC BY-SA are usable here only WITH a link
    // to the license, so a record that names one and cannot link it is not a
    // license we can meet. Public domain is the only value allowed to have no
    // url, and it is the only one whose credit line makes no claim.
    if (ph.license !== "Public domain" && !ph.licenseUrl) {
      throw new Error(`garbage-plate.json: photo "${ph.slug}" is "${ph.license}" with no ` +
        `licenseUrl. Attribution licenses require a link to the license; do not publish it.`);
    }
  }
}

/**
 * One photograph, as a <picture> inside a <figure> with its credit under it.
 *
 * THE RENDITIONS ARE OURS AND BOTH FORMATS ALWAYS EXIST, which is what makes
 * the <source> safe: sync-plate-photos.py writes the .webp and the .avif of
 * every width together, and a <source> pointing at a file that is not there
 * paints a broken image because the browser has committed to it before it finds
 * out. avifPicture() in shared/format.mjs is not used here because it only
 * rewrites TCGdex and assets/packs/ urls, and widening its allowlist for one
 * page would put a second builder's guarantee inside a shared helper.
 *
 * EVERY ONE IS LAZY, INCLUDING THE ONE ABOVE THE FOLD, and that is the measured
 * call rather than the careless one. CLAUDE.md records both halves: a lazy
 * image the browser can already see is fetched immediately anyway, so the
 * attribute costs no bytes, and what it costs is the preload scanner, which on
 * this site's own pages was the thing worth losing. Marking the four above-fold
 * tiles on /videos.html and /playlists.html eager moved zero bytes and cost
 * 592ms of LCP and 748ms of first paint. Re-measured on this page before it
 * shipped; the numbers are in CLAUDE.md's Garbage Plate section.
 */
function photoFig(ph, opts) {
  const o = opts || {};
  const widths = [400, 800, 1200].filter((w) => w <= Math.min(ph.maxw, ph.w));
  const base = `/assets/plates/${ph.slug}`;
  const set = (ext) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  const sizes = o.sizes || "100vw";
  const img =
    `<img src="${base}-${widths[0]}.webp" srcset="${set("webp")}" sizes="${esc(sizes)}"` +
    ` width="${ph.w}" height="${ph.h}" loading="lazy" decoding="async"` +
    ` alt="${esc(ph.alt)}">`;
  const pic = `<picture><source type="image/avif" srcset="${set("avif")}" sizes="${esc(sizes)}">${img}</picture>`;

  // THE CREDIT LINE. Photographer, license, link to the license, link to the
  // file. Public domain gets no license link because there is no license to
  // link, and it says so in words rather than printing a bare "Public domain"
  // that reads like a license name nobody can check.
  const who = `<a href="${esc(ph.page)}" rel="noopener" target="_blank" aria-label="${esc(
    ph.by,
  )}'s photograph on Wikimedia Commons, where its license is stated, opens on commons.wikimedia.org">${esc(ph.by)}</a>`;
  const lic =
    ph.license === "Public domain"
      ? "released into the public domain"
      : `<a href="${esc(ph.licenseUrl)}" rel="noopener" target="_blank" aria-label="The ${esc(
          ph.license,
        )} license deed, opens on creativecommons.org">${esc(ph.license)}</a>`;
  const credit =
    `<span class="gpph-cr">Photograph by ${who}, ${lic}, via Wikimedia Commons.</span>`;

  return `<figure class="gpph${o.mod ? ` ${o.mod}` : ""}">${pic}
        <figcaption>${ph.caption ? `${esc(ph.caption)} ` : ""}${credit}</figcaption>
      </figure>`;
}

// A run of photographs for one slot, or the empty string. Never renders an
// empty <figure> or a frame captioned "no photo": the same rule the Topps
// packaging shots follow, and the same rule this page's hours already follow.
const photoRun = (key, opts) => photoAt(key).map((p) => photoFig(p, opts)).join("\n      ");

/**
 * THE DIAGRAM. A labeled cutaway of a Garbage Plate, drawn.
 *
 * THIS IS THE ONE THING ON THE PAGE THAT DOES NOT ALREADY EXIST SOMEWHERE ELSE,
 * so it gets the care. Every other fact here can in principle be found on some
 * other site; a diagram of the dish cannot, because nobody has drawn one, and
 * it is the asset most likely to be the reason another page links here.
 *
 * IT IS A BIGGER RELATIVE OF plateMark() IN shared/format.mjs AND IT SHARES
 * THAT DRAWING'S HAND ON PURPOSE. Same china, painted var(--ink) so it moves
 * with any repaint, and the same six food colours out of that file: #F2E9CD and
 * #AC9D71 for the macaroni salad, #DFA93C for the potato, #7A4526 and #5C3318
 * for the meat sauce, #F8F3E4 for the onions, #EFBB25 for the mustard. A reader
 * who has seen the little plate at the foot of /shops.html should recognise
 * this as the same plate opened up, and the site should read as one hand.
 * The rule that makes those literals correct rather than a palette leak is
 * CLAUDE.md's: a drawing of a real product keeps its own colours, which is why
 * the eighteen pack skins and the Base Set schematic are exempt too.
 *
 * IT HAS TO WORK WITH NO COLOUR AT ALL, which was a stated requirement and is
 * the constraint that drove the whole layout. Six food colours on a dark green
 * ground is a picture that dies in greyscale, in a screenshot, on a bad phone
 * screen and for anybody with a colour vision deficiency. So the colour carries
 * NONE of the meaning:
 *   - every layer is NUMBERED, in a high contrast disc, and the number is the
 *     thing that ties the drawing to the list beside it
 *   - every layer has its own TEXTURE as well as its own fill: elbow curls in
 *     the macaroni, rectangular chunks in the potato, specks in the sauce,
 *     square flecks in the onions, a zigzag for the mustard
 *   - every band is separated by a drawn edge rather than by a colour change
 * Turn the whole figure grey and it still reads. That was checked by rendering
 * it under a greyscale filter, not assumed.
 *
 * THE LABELS ARE HTML AND NOT SVG TEXT, AND THAT IS THE PHONE DECISION. The
 * figure is capped at 640 units wide and the wrap at 390px gives it about 358,
 * so it is drawn at 0.56 and a unit is not a pixel: 16 unit type renders at
 * 9px. /shops.html's hours chart records losing exactly this argument twice and
 * having to be redrawn at 17 units to clear 10px. Rather than fight it a third
 * time, the drawing carries only NUMBERS, which survive being halved, and the
 * words live in an ordered list underneath in real body type at real body
 * sizes. On a desktop the list sits beside the drawing; on a phone it sits
 * under it. Nothing has to be legible at 9px for the figure to work.
 *
 * THE GEOMETRY IS BUILT RATHER THAN HAND WRITTEN. The bands are painted TOP
 * DOWN inside a clip path shaped like the heap, each one a wavy topped shape
 * that runs off the bottom of the drawing; the band painted after it covers the
 * excess. That is why no boundary has to be written twice and why the bands
 * cannot develop a hairline gap between them, which is what happened when the
 * first version tried to tile them edge to edge.
 */

// A wavy horizontal line, so a layer of food does not have a ruled edge.
// Deterministic in its arguments, because the same boundary is drawn in two
// places when a texture has to sit on it.
function wave(x1, x2, y, amp, humps) {
  const seg = (x2 - x1) / humps;
  let d = `M${x1} ${y}`;
  for (let i = 0; i < humps; i++) {
    const x = x1 + i * seg;
    const up = i % 2 === 0 ? -amp : amp;
    d += `C${(x + seg * 0.35).toFixed(1)} ${(y + up).toFixed(1)} ` +
         `${(x + seg * 0.65).toFixed(1)} ${(y - up).toFixed(1)} ` +
         `${(x + seg).toFixed(1)} ${y}`;
  }
  return d;
}

// Pseudo-random, seeded, so the garnish is scattered rather than gridded and
// is the SAME scatter on every build. A Math.random() here would change the
// built file on every run and check-tree-drift.mjs would report the page as
// permanently stale, which is a real trap and not a hypothetical one.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function plateDiagram() {
  const W = 640, H = 620;

  // THE MOUND OF SIDES, and it is the whole heap rather than one stratum of it.
  // The first version of this drawing stacked five bands inside one silhouette
  // and the result read as a striped MOUNTAIN rather than as dinner: a plate is
  // wide and low, and the layers on it are objects sitting on each other rather
  // than sedimentary rock. So the mound is the SIDES, the meat is drawn on top
  // of it and allowed to overhang, and the sauce is a poured shape with its own
  // edge and its own drips. That is also the order plateMark draws them in, and
  // it is the order they actually arrive in.
  const SIDES =
    "M96 454C94 404 126 356 182 332C230 311 260 304 310 304" +
    "C360 304 390 311 438 332C494 356 526 404 524 454Z";

  // The sauce, poured over the crown. Wavy along the bottom, because the edge of
  // a pour is the one line in this drawing that must not be straight.
  const SAUCE =
    wave(132, 492, 286, 10, 7) +
    "C502 236 476 200 428 180C390 164 352 154 312 154" +
    "C272 154 234 164 196 180C148 200 122 236 132 286Z";

  const r = rng(20260820);
  const at = (x1, x2, y1, y2) => [x1 + r() * (x2 - x1), y1 + r() * (y2 - y1)];

  // ELBOW MACARONI, as little open curls rather than dots, because a dot is the
  // texture the sauce already uses and the two would collide in greyscale. Same
  // arc as the curls in plateMark, scaled up.
  let mac = "";
  for (let i = 0; i < 17; i++) {
    const [x, y] = at(120, 282, 356, 442);
    mac += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}a13 13 0 0 1 21-5"/>`;
  }

  // HOME FRIES, chunky rather than shoestring, and drawn as OUTLINES with no
  // fill of their own. A darker gold chunk on a lighter gold ground is a
  // difference that disappears the moment the page is greyscaled or screenshot
  // by somebody's phone; a drawn edge does not.
  let fries = "";
  for (let i = 0; i < 9; i++) {
    const [x, y] = at(330, 474, 356, 436);
    const rot = (r() * 50 - 25).toFixed(0);
    fries += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="34" height="22" rx="5"` +
             ` transform="rotate(${rot} ${(x + 17).toFixed(0)} ${(y + 11).toFixed(0)})"/>`;
  }

  // Ground meat in the sauce. The one texture allowed to be dots, because
  // nothing else on the plate is.
  let specks = "";
  for (let i = 0; i < 24; i++) {
    const [x, y] = at(158, 460, 178, 274);
    specks += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="10" ry="6"/>`;
  }

  // Chopped onion, as squares. Square is the only shape on this plate with a
  // corner in it, which is what makes this layer identifiable with the colour
  // switched off.
  let onion = "";
  for (let i = 0; i < 15; i++) {
    const [x, y] = at(200, 408, 170, 232);
    const rot = (r() * 60 - 30).toFixed(0);
    onion += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="18" height="14" rx="2.5"` +
             ` transform="rotate(${rot} ${(x + 9).toFixed(0)} ${(y + 7).toFixed(0)})"/>`;
  }

  // A slice of Italian bread: a domed top on a square body, which is the
  // silhouette a reader recognises as bread without being told.
  const slice =
    "M10 96C4 96 2 92 2 86L2 46C2 18 22 4 46 4C70 4 90 18 90 46L90 86C90 92 88 96 82 96Z";

  // A numbered disc and its leader. The disc is the ONLY thing in this drawing
  // that has to be READ, so it is sized off the phone rather than off the
  // viewBox: r=21 in a 640 wide box drawn into 358px is a 23px disc carrying a
  // 15px numeral, which clears the 10px floor /shops.html's hours chart had to
  // be redrawn twice to reach. The ring is near-black outside a near-white
  // fill, the same trick RIP_BANNER uses to survive nineteen pack skins: two
  // values that far apart mean one of them always reads whatever is under it.
  const call = (n, cx, cy, lx, ly) =>
    `<g class="gpd-call">` +
    `<line x1="${cx}" y1="${cy}" x2="${lx}" y2="${ly}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="21"/>` +
    `<text x="${cx}" y="${cy + 8}">${n}</text></g>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="gpd" role="img"
      aria-label="A drawing of a Garbage Plate with its six parts numbered. One, two sides heaped on the plate, macaroni salad on the left and home fries on the right. Two, the meat laid on top of them. Three, hot sauce poured over the lot and running down the sides. Four, chopped raw onions on the sauce. Five, a stripe of mustard over everything. Six, two slices of buttered bread beside the plate. Each number is explained in the list that follows.">
    <defs><clipPath id="gpSides"><path d="${SIDES}"/></clipPath>
      <clipPath id="gpSauce"><path d="${SAUCE}"/></clipPath></defs>

    <g class="gpd-ink">
      ${/* The dish, back half first, exactly as plateMark builds it: the near
           rim is painted again AFTER the food, so the heap sits IN the bowl
           rather than on a disc behind it. THE EMPTY PLATE IS NOT A LAYER and
           is deliberately outside every .gpd-lay wrapper: "Build the plate"
           starts from a plate, and a sequence that begins with nothing at all
           is a loading state rather than a recipe. */ ""}
      <ellipse cx="310" cy="432" rx="286" ry="60" class="gpd-china"/>

      ${/* SIX .gpd-lay WRAPPERS, ONE PER NUMBERED LAYER, AND EACH ONE CARRIES
           ITS OWN CALLOUT DISC. See the "Build the plate" note in the style
           block below for what they are for. Three rules about the wrappers
           themselves, because all three are easy to undo:

           THE ORDER OF THE DRAWING IS UNCHANGED. Every wrapper sits exactly
           where its art already sat, so the painted result with nothing armed
           is what this figure has always rendered. The one group that had to
           be SPLIT is the sauce clip: it held the specks, the onions and the
           mustard, which are layers three, four and five, so it is now three
           clip groups with the same clip and the same contents in the same
           order. Splitting a clip group is free; reordering one is not.

           THE NUMBERED DISCS ARE NOT IN HERE. They stay in one run at the end
           of the drawing, painted over everything, and take the same .is-on
           toggle keyed off the same index. The note beside them says what
           putting them in their layers cost.

           NOTHING HERE IS AN ANIMATION NAME. These are plain wrappers with
           classes toggled on them; the transition lives in CSS. A @keyframes
           referenced by a name that does not exist never runs and never fires
           an event, which is the bug the pack wrapper shipped for weeks. */ ""}
      ${/* THE TWO SIDES ARE THE MOUND, split down the middle. The seam is drawn
           as an EDGE rather than left as a colour change, so which side is
           which survives the picture being greyscaled. */ ""}
      <g class="gpd-lay" data-lay="1">
        <g clip-path="url(#gpSides)">
          <rect x="80" y="290" width="230" height="180" fill="#F2E9CD"/>
          <rect x="310" y="290" width="240" height="180" fill="#DFA93C"/>
          <g class="gpd-mac">${mac}</g>
          <g class="gpd-fries">${fries}</g>
          <path class="gpd-seam" d="M310 306L310 458"/>
        </g>
        <path class="gpd-sides" d="${SIDES}"/>
      </g>

      ${/* THE MEAT OVERHANGS ON PURPOSE. Drawn outside the clip so both pieces
           poke past the mound's outline, which is what makes them read as two
           objects lying on the sides rather than as a third stripe of it. */ ""}
      <g class="gpd-lay" data-lay="2">
        <g class="gpd-meat">
          <rect x="102" y="278" width="206" height="64" rx="32"/>
          <rect x="290" y="252" width="212" height="64" rx="32"/>
        </g>
      </g>

      <g class="gpd-lay" data-lay="3">
        <path class="gpd-sauce" d="${SAUCE}"/>
        <g class="gpd-drip">
          <path d="M188 280C182 316 178 366 184 388C189 405 200 400 199 384C197 350 194 312 188 280Z"/>
          <path d="M436 278C442 312 447 358 441 380C436 397 425 392 426 376C428 342 431 308 436 278Z"/>
        </g>
        <g clip-path="url(#gpSauce)">
          <g class="gpd-specks">${specks}</g>
        </g>
      </g>

      <g class="gpd-lay" data-lay="4">
        <g clip-path="url(#gpSauce)">
          <g class="gpd-onion">${onion}</g>
        </g>
      </g>

      <g class="gpd-lay" data-lay="5">
        ${/* The mustard, clipped to the sauce so the stripe cannot end up
             floating in the air beside the plate, which is what it did the
             first time it was drawn unclipped. */ ""}
        <g clip-path="url(#gpSauce)">
          <path class="gpd-mustard" d="M204 200c26-26 44 12 70-14s46 20 72-8 44 18 68-4"/>
        </g>
      </g>

      ${/* The near rim, painted over the foot of the mound. NOT A LAYER, for
           the same reason the back half is not: it is the dish. */ ""}
      <path class="gpd-china" d="M24 432a286 60 0 0 0 572 0"/>
      <path class="gpd-rim" d="M78 428a232 42 0 0 0 464 0"/>

      ${/* Bread and butter BESIDE the plate rather than on it, which is both
           how it arrives and the only place on this drawing with room for it.
           Two slices, because Alex Tahou's account of the original hots and
           potatoes has two pieces of Italian bread and butter on it, and it
           still arrives that way. NO DATE ON THAT: the page says twice that
           the dish's own start date is not documented, so nothing here may
           quietly attach 1918 to the food. 1918 is the SHOP. */ ""}
      <g class="gpd-lay" data-lay="6">
        <g class="gpd-bread">
          <path d="${slice}" transform="translate(418 476) scale(1.16)"/>
          <path d="${slice}" transform="translate(482 460) scale(1.16)"/>
        </g>
        <rect class="gpd-butter" x="526" y="502" width="38" height="29" rx="5"
          transform="rotate(-12 545 516)"/>
      </g>

      ${/* THE DISCS STAY LAST, WHICH IS WHERE THEY HAVE ALWAYS BEEN, and they
           are NOT inside their layer's wrapper. That was tried and it moved
           pixels: a disc drawn with its own layer is painted before everything
           above it, and the near rim then ate the bottom of disc 1 and the
           mustard ate the end of disc 4's leader. 1,034 pixels on a
           before/after diff of the figure, on a page where the animation is
           supposed to be the only thing that changed. They carry the same
           .is-on toggle instead, driven off the same index, so a number still
           arrives with the food it names. */ ""}
      ${call(1, 38, 420, 112, 420)}
      ${call(2, 602, 288, 506, 288)}
      ${call(3, 38, 232, 150, 238)}
      ${call(4, 602, 164, 408, 182)}
      ${call(5, 314, 52, 314, 190)}
      ${call(6, 378, 568, 486, 542)}
    </g>
  </svg>`;
}

// The numbered list that the diagram's discs point into. It is the LABEL LAYER
// of the figure and not a separate section, which is why it lives inside the
// same <figure>: pull them apart and the numbers in the drawing point at
// nothing.
const layerList = (doc.anatomy?.layers || [])
  .map(
    (l) => `      <li>
        <p class="gpl-n" aria-hidden="true">${l.n}</p>
        <div>
          <h3>${esc(l.name)}</h3>
          <p>${esc(l.what)}</p>
        </div>
      </li>`,
  )
  .join("\n");

/* ---- Source lines --------------------------------------------------------- *
 *
 * ONE HELPER FOR EVERY CITATION ON BOTH PAGES, because the page's whole claim is
 * that a fact can be traced, and two hand-written citation shapes is how one of
 * them quietly starts dropping the link. `short` is the label a reader sees
 * under a claim; the full name is in the aria-label and in the source list at
 * the foot, so nothing is lost by shortening it. A missing `short` falls back to
 * the full name rather than to nothing.
 */
function srcLine(ids, lead = "Source") {
  const cites = (ids || []).map((id) => SRC.get(id)).filter(Boolean);
  if (!cites.length) return "";
  return `<p class="gp-src">${lead}${cites.length === 1 ? "" : "s"}: ${cites
    .map(
      (s) =>
        `<a href="${esc(cleanUrl(s.url))}" rel="noopener" target="_blank" aria-label="${esc(
          s.name,
        )}, opens on ${esc(hostOf(s.url))}">${esc(s.short || s.name)}</a>`,
    )
    .join("; ")}.</p>`;
}

// A history entry. The kicker is the DATE or the shape of the claim, the source
// line is not optional, and a quote is set apart from our own prose so a reader
// can always tell which words are ours.
const historyBlocks = (doc.history || [])
  .map((h) => {
    return `      <li class="gph">
        <p class="gph-when">${esc(h.year)}</p>
        <h3>${esc(h.head)}</h3>
        <p class="gph-body">${esc(h.body)}</p>
        ${
          h.quote
            ? `<blockquote class="gph-q"><p>${esc(h.quote)}</p>
          <cite>${esc(h.quoteWho || SRC.get(h.quoteSrc)?.name || "")}</cite></blockquote>`
            : ""
        }
        ${photoRun(`history:${h.year}`, {
          // THE PICTURE IS HELD TO 480 INSIDE A 640 CARD AND THAT IS A
          // SHARPNESS DECISION, not a margin one. The card's inside is 640px at
          // 1440 and 318 at 390, so a full-width picture on a retina desktop
          // asks for 1280 device pixels and the widest rendition is 800: a 1.6x
          // upscale, and two of these four photographs are 1024px originals
          // from 2007 and 2008 that cannot be re-rendered any bigger. At 480 the
          // same screen asks for 960 and gets 800, which is 1.2x.
          sizes: "(min-width:720px) 480px, calc(100vw - 72px)",
          mod: "gpph--card",
        })}
        ${srcLine(h.src)}
      </li>`;
  })
  .join("\n");

/* ---- Opening hours --------------------------------------------------------- *
 *
 * ONE SPEC, TWO OUTPUTS, SO THE WORDS AND THE "OPEN NOW" CHIP CANNOT DISAGREE.
 * Until 23 September 2026 every place carried its hours as a sentence, which
 * was fine while a human was the only reader. The directory's open-now filter
 * needs them as numbers, and two copies of the same hours, one prose and one
 * numeric, is how a card ends up saying "open until 10" while the chip says
 * closed. So the data holds `hoursSpec`, a tiny grammar, and BOTH the sentence
 * and the data-h attribute the browser reads are generated from it here:
 *
 *   "mon-sat 11:00-22:00; sun 12:00-22:00"
 *   "tue-thu 16:00-24:00; fri 16:00-02:30; mon closed"
 *   "mon-thu 11:00-15:00,17:00-21:00"           two sittings in one day
 *   "mon-sun 24h"
 *
 * A close earlier than its open runs past midnight, so "fri 16:00-02:30" is
 * Friday 4pm to 2:30am Saturday. Day ranges wrap ("fri-sun"). A day the spec
 * does not name is UNKNOWN, not closed, and is simply not printed: Churchville
 * Grill's own site does not list Monday and neither does this page.
 *
 * THE RULE ABOUT WHOSE HOURS THESE ARE DID NOT CHANGE: a spec with no hoursSrc
 * fails the build, exactly as a sentence with no hoursSrc always did.
 */
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_NAME = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

function parseHours(spec, who) {
  const week = new Map(); // day index -> [[open, close], ...] in minutes; [] means closed
  const mins = (t) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (!m) throw new Error(`garbage-plate.json: ${who} has an unreadable time "${t}" in hoursSpec`);
    return +m[1] * 60 + +m[2];
  };
  for (const seg of spec.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [dayPart, timePart] = seg.split(/\s+/);
    const days = [];
    for (const piece of dayPart.split(",")) {
      const [a, b] = piece.split("-");
      const ia = DAYS.indexOf(a);
      const ib = b ? DAYS.indexOf(b) : ia;
      if (ia < 0 || ib < 0) throw new Error(`garbage-plate.json: ${who} has an unknown day in "${seg}"`);
      for (let i = ia; ; i = (i + 1) % 7) {
        days.push(i);
        if (i === ib) break;
      }
    }
    let spans;
    if (timePart === "closed") spans = [];
    else if (timePart === "24h") spans = [[0, 1440]];
    else {
      spans = timePart.split(",").map((r) => {
        const [o, c] = r.split("-").map(mins);
        return [o, c <= o ? c + 1440 : c];
      });
    }
    for (const i of days) {
      if (week.has(i)) throw new Error(`garbage-plate.json: ${who} names ${DAYS[i]} twice in hoursSpec`);
      week.set(i, spans);
    }
  }
  return week;
}

function clock(m) {
  const t = m % 1440;
  if (t === 0) return "midnight";
  if (t === 720) return "noon";
  const h = Math.floor(t / 60);
  const mm = t % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

const spanText = (spans) =>
  spans.length === 1 && spans[0][0] === 0 && spans[0][1] === 1440
    ? "open 24 hours"
    : spans.map(([o, c]) => `${clock(o)} to ${clock(c)}`).join(" and ");

// The sentence. Walks the week from MONDAY, which is how every one of these
// businesses writes its own hours, and folds runs of identical days together.
function hoursText(week) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const key = (i) => (week.has(i) ? JSON.stringify(week.get(i)) : null);
  const runs = [];
  for (const i of order) {
    const k = key(i);
    if (k === null) continue;
    const last = runs[runs.length - 1];
    const prevDay = last ? last.days[last.days.length - 1] : null;
    if (last && last.k === k && order.indexOf(i) === order.indexOf(prevDay) + 1) last.days.push(i);
    else runs.push({ k, days: [i], spans: week.get(i) });
  }
  // A week that starts on Sunday in the business's own words ("Sun to Thu 11am
  // to 10pm") would otherwise come out as "Mon to Thu ..., Sun ..." with the
  // same hours printed twice. Fold a trailing Sunday back onto the front run.
  if (runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    if (last.k === first.k && last.days.length === 1 && last.days[0] === 0 && first.days[0] === 1) {
      first.days.unshift(0);
      runs.pop();
    }
  }
  if (runs.length === 1 && runs[0].days.length === 7) {
    const s = runs[0].spans;
    return s.length ? `Daily, ${spanText(s)}` : "Closed";
  }
  const dayLabel = (days) => {
    const a = DAY_NAME[DAYS[days[0]]];
    const b = DAY_NAME[DAYS[days[days.length - 1]]];
    return days.length === 1 ? a : days.length === 2 ? `${a} and ${b}` : `${a} to ${b}`;
  };
  const open = runs.filter((r) => r.spans.length).map((r) => `${dayLabel(r.days)} ${spanText(r.spans)}`);
  const shut = runs.filter((r) => !r.spans.length).flatMap((r) => r.days);
  const closedTxt = shut.length
    ? `closed ${shut.map((i) => DAY_NAME[DAYS[i]]).join(shut.length === 2 ? " and " : ", ")}`
    : "";
  return [...open, closedTxt].filter(Boolean).join(", ");
}

// What the browser reads: seven slots, Sunday first to match Date.getDay(),
// each "open-close" in minutes with extra sittings after a comma. An unknown
// day and a closed day are both empty, because both mean "do not say open".
const hoursAttr = (week) =>
  DAYS.map((_, i) => (week.get(i) || []).map(([o, c]) => `${o}-${c}`).join(",")).join("|");

// LATE NIGHT IS COUNTED, NOT TAGGED. Anywhere its own hours keep it open past
// 11pm on at least one night. Typed by hand it would drift the first time a
// place changed its Friday.
const isLate = (week) => [...week.values()].some((spans) => spans.some(([, c]) => c > 23 * 60));

/* ---- The places ------------------------------------------------------------ */
const GROUPS = doc.groups || [];
const GROUP_IDS = new Set(GROUPS.map((g) => g.id));
const TAGS = {
  late: "Open late",
  veg: "Meatless plate",
  bar: "Bar or brewery",
  breakfast: "Breakfast plate",
};
for (const p of places) {
  if (!GROUP_IDS.has(p.group)) throw new Error(`garbage-plate.json: ${p.name} is in unknown group "${p.group}"`);
  for (const t of p.tags || []) {
    if (!TAGS[t] || t === "late") {
      throw new Error(`garbage-plate.json: ${p.name} has tag "${t}". Allowed: veg, bar, breakfast; late is computed.`);
    }
  }
  if (p.hours) {
    throw new Error(`garbage-plate.json: ${p.name} still has a free-text "hours". Write it as hoursSpec.`);
  }
  if (p.hoursSpec) {
    p._week = parseHours(p.hoursSpec, p.name);
    p._hoursText = hoursText(p._week);
    p._tags = [...(p.tags || []), ...(isLate(p._week) ? ["late"] : [])];
  } else {
    p._tags = [...(p.tags || [])];
  }
}

// Nick Tahou Hots first because it is the originator and holds the mark, which
// is a matter of record; everything else alphabetical inside its area, ignoring
// a leading "The" so The Gate House files under G where a reader looks for it.
const sortName = (p) => p.name.replace(/^The\s+/i, "").toLowerCase();
const inGroup = (id) =>
  places
    .filter((p) => p.group === id)
    .sort((a, b) => (b.origin ? 1 : 0) - (a.origin ? 1 : 0) || sortName(a).localeCompare(sortName(b)));

const slugOf = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
{
  const seen = new Set();
  for (const p of places) {
    p._id = slugOf(p.name);
    if (seen.has(p._id)) throw new Error(`garbage-plate.json: two places slug to "${p._id}"`);
    seen.add(p._id);
  }
}

const DIR_PATH = "/where-to-get-a-garbage-plate.html";
const GUIDE_PATH = "/garbage-plate.html";
const nPlaces = places.length;
const countOf = (id) => places.filter((p) => p.group === id).length;
const tagCount = (t) => places.filter((p) => p._tags.includes(t)).length;
const mapHref = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

// A restaurant. EVERYTHING EXCEPT THE NAME AND THE LINK IS OPTIONAL AND SIMPLY
// DOES NOT RENDER WHEN MISSING, which is data/shops.json's rule and is what
// lets this page be honest about a business whose own site says less than
// another's. The one field that behaves differently is the hours: a missing
// hour prints a LINE saying it is not confirmed rather than nothing at all,
// because a silent gap reads as "no hours today" and this page would rather say
// "we could not check" out loud.
function placeCard(p, opts = {}) {
  const url = cleanUrl(p.url);
  const menu = p.menuUrl ? cleanUrl(p.menuUrl) : "";
  const shot = opts.noPhoto ? "" : photoRun(`place:${p.name}`, {
    // 1 / 2 / 3 columns of the directory grid, less the card's own padding.
    sizes: "(min-width:1100px) 400px, (min-width:700px) calc(50vw - 64px), calc(100vw - 64px)",
    mod: "gpph--place",
  });
  const tags = p._tags.filter((t) => TAGS[t]);
  const locs = p.locations || [];
  const hoursRow = p._week
    ? `<dt>Open</dt><dd>${esc(p._hoursText)}${
        p.hoursNote ? `. ${esc(p.hoursNote.replace(/\.$/, ""))}.` : ""
      }<span class="gpc-checked">stated by the business on <a href="${esc(
        cleanUrl(p.hoursSrc),
      )}" rel="noopener" target="_blank" aria-label="Hours posted by ${esc(p.name)}, opens on ${esc(
        hostOf(p.hoursSrc),
      )}">${esc(hostOf(p.hoursSrc))}</a>, read ${esc(longDate(p.read || doc.updated) || doc.updated)}</span></dd>`
    : `<dt>Open</dt><dd class="gpc-unknown">Not confirmed. ${esc(
        p.hoursUnknown || "Their own site does not publish hours, and this page will not copy them off a directory.",
      )} Call before you go.</dd>`;
  return `      <li class="gpc"${p.origin ? ' data-origin="1"' : ""} id="${p._id}"${
    tags.length ? ` data-tags="${tags.join(" ")}"` : ""
  }${p._week && !opts.static ? ` data-h="${hoursAttr(p._week)}"` : ""}>
        <div class="gpc-head">
          <h3>${esc(p.name)}</h3>
          ${p.origin ? `<span class="gpc-flag">The original</span>` : ""}
        </div>
        ${shot}
        ${p.area ? `<p class="gpc-where">${esc(p.area)}</p>` : ""}
        ${
          p.plateName
            ? `<p class="gpc-dish">Calls it <b>${esc(p.plateName)}</b>${
                p.platePrice ? ` <span class="gpc-price">${esc(p.platePrice)}</span>` : ""
              }</p>`
            : ""
        }
        ${p.blurb ? `<p class="gpc-blurb">${esc(p.blurb)}</p>` : ""}
        ${
          tags.length || p._week
            ? `<ul class="gpc-tags" aria-label="About this place">${p._week && !opts.static ? `<li class="gpc-open">Open now</li>` : ""}${tags
                .map((t) => `<li>${esc(TAGS[t])}</li>`)
                .join("")}</ul>`
            : ""
        }
        <dl class="gpc-facts">
          ${
            p.address
              ? `<dt class="gpc-tap">Where</dt><dd class="gpc-tap"><a href="${mapHref(
                  p.address,
                )}" rel="noopener" target="_blank" aria-label="${esc(p.address)}, directions to ${esc(
                  p.name,
                )}, opens on google.com">${esc(p.address)}</a></dd>`
              : ""
          }
          ${
            p.phone
              ? `<dt class="gpc-tap">Phone</dt><dd class="gpc-tap"><a href="tel:${esc(
                  p.phone.replace(/[^0-9+]/g, ""),
                )}" aria-label="Call ${esc(p.name)} on ${esc(p.phone)}">${esc(p.phone)}</a></dd>`
              : ""
          }
          ${hoursRow}
        </dl>
        ${
          locs.length
            ? `<details class="gpc-locs"><summary>${locs.length} locations</summary>
          <ul>${locs.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${
            p.locationsUrl
              ? `<p><a href="${esc(cleanUrl(p.locationsUrl))}" rel="noopener" target="_blank" aria-label="Every ${esc(
                  p.name,
                )} location, opens on ${esc(hostOf(p.locationsUrl))}">Every location on ${esc(
                  hostOf(p.locationsUrl),
                )}</a></p>`
              : ""
          }
        </details>`
            : ""
        }
        ${p.note ? `<p class="gpc-note">${esc(p.note)}</p>` : ""}
        <p class="gpc-links">
          <a class="gpc-link" href="${esc(url)}" rel="noopener" target="_blank" aria-label="Website of ${esc(
            p.name,
          )}, opens on ${esc(hostOf(url))}">${esc(p.menuLabel && !menu ? p.menuLabel : hostOf(url))} <span aria-hidden="true">&rarr;</span></a>
          ${
            menu && menu !== url
              ? `<a class="gpc-link" href="${esc(menu)}" rel="noopener" target="_blank" aria-label="${esc(
                  p.menuLabel || "Menu",
                )} for ${esc(p.name)}, opens on ${esc(hostOf(menu))}">${esc(
                  p.menuLabel || "Menu",
                )} <span aria-hidden="true">&rarr;</span></a>`
              : ""
          }
        </p>
      </li>`;
}

// THE HOME PAGE'S SHELL IS READ HERE because both pages take their <head>, bar,
// menu and footer by slicing public/index.html, as they always have.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
if (!/<meta property="og:image" content="/.test(head)) {
  throw new Error("build-garbage-plate: no og:image in the home page head to swap");
}
const ogUrl = (slug) => `${SITE}/assets/og-${slug}.jpg`;

/**
 * One head per page, sliced from the home page's and then swapped.
 *
 * THE SOCIAL TAGS ARE SWAPPED TOO, AND THEY WERE ONCE THE BUG. Every tag not
 * named below arrives holding the HOME PAGE's copy, and og:description,
 * twitter:title and twitter:description were once left out: the page shipped
 * with a good description of itself and handed every chat unfurl the home
 * page's boilerplate. So the description is written once and spent five times,
 * and the loop at the end throws if any swap matched nothing.
 *
 * AND SINCE 23 SEPTEMBER 2026 THE SHARE CARD IS SWAPPED AS WELL. Both pages used
 * to share as the site's generic banner. They have their own typographic cards
 * now, written by build-og-pages.py, and the Article's `image` names the same
 * file, so the head and the schema still cannot disagree about the picture.
 */
function pageHead({ path, title, desc, ogSlug, ogAlt }) {
  const img = ogUrl(ogSlug);
  const out = head
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(clipMeta(desc))}">`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}${path}">`)
    .replace(/(<meta property="og:url" content=")[^"]*/, (m, p1) => `${p1}${SITE}${path}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, (m, p1) => p1 + esc(title))
    .replace(/(<meta property="og:description" content=")[^"]*/, (m, p1) => p1 + esc(desc))
    .replace(/(<meta name="twitter:title" content=")[^"]*/, (m, p1) => p1 + esc(title))
    .replace(/(<meta name="twitter:description" content=")[^"]*/, (m, p1) => p1 + esc(desc))
    .replace(/(<meta property="og:image" content=")[^"]*/, (m, p1) => p1 + img)
    .replace(/(<meta name="twitter:image" content=")[^"]*/, (m, p1) => p1 + img)
    .replace(/(<meta property="og:image:alt" content=")[^"]*/, (m, p1) => p1 + esc(ogAlt));
  for (const [what, needle] of [
    ["title", `<title>${esc(title)}</title>`],
    ["og:title", `<meta property="og:title" content="${esc(title)}`],
    ["og:description", `<meta property="og:description" content="${esc(desc)}`],
    ["twitter:title", `<meta name="twitter:title" content="${esc(title)}`],
    ["twitter:description", `<meta name="twitter:description" content="${esc(desc)}`],
    ["og:image", `<meta property="og:image" content="${img}`],
    ["twitter:image", `<meta name="twitter:image" content="${img}`],
  ]) {
    if (!out.includes(needle)) {
      throw new Error(
        `build-garbage-plate: ${what} was not swapped on ${path}, so it would share as the home page. ` +
          `The tag's shape in public/index.html has changed.`,
      );
    }
  }
  return out;
}

// Comments out of the shipped page, argument kept in this file. stamp-assets.mjs
// strips them again at the end of build-all, so this is belt and braces.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

/* ---- The stylesheet, shared by both pages ---------------------------------- */
const style = `
.gp{padding:var(--s7) 0 var(--s8)}
.gp-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}
/* THE DEFINITION IS THE FIRST SENTENCE ON THE PAGE AND IT IS SET A STEP LARGER.
   "What is a garbage plate" is the query, so the answer is the first thing under
   the h1, in one sentence a search engine can lift whole and a reader can stop
   after. Ink rather than ink-2 because it is the page's answer, not its aside. */
.gp-def{font-size:var(--t-lede);line-height:1.5;color:var(--ink);max-width:40em;margin-bottom:var(--s4)}
.gp h2{font:400 var(--t-l)/1.1 var(--display);margin:var(--s7) 0 var(--s3);scroll-margin-top:80px}
/* NOT PINK AND NOT TEAL, and CLAUDE.md's accent rule is explicit about why: a
   body section heading is neither, so the two accents always land on a neutral
   and never on each other. */
.gp h3{font:400 var(--t-m)/1.2 var(--display)}
.gp-sub{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}
.gp-sub a,.gp-lede a,.gp-def a,.gp-body a{color:var(--sky-deep);font-weight:600;text-decoration:underline;text-underline-offset:2px}
/* THE SOURCE LINE, one shape for every citation on both pages. Micro type,
   ink-2, teal links because a link is a route. */
.gp-src{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin-top:var(--s2)}
.gp-src a{color:var(--sky-deep);font-weight:600}
.gp-src a:hover{text-decoration:underline}

/* ON THIS PAGE: routes, so teal, 44px chips. Same shape as the 30th page's. */
.gp-jump{display:flex;flex-wrap:wrap;gap:8px;margin:var(--s4) 0 var(--s5)}
.gp-jump a{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;
  border:1px solid var(--keyline);background:var(--paper);color:var(--sky-deep);
  font:700 var(--t-sm)/1 var(--body);text-decoration:none}
.gp-jump a:hover,.gp-jump a:focus-visible{border-color:var(--sky);color:var(--sky)}
.gp-jump a b{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}


/* ---- In 30 seconds ------------------------------------------------------ */
/* The card a reader who will read nothing else gets, and the block most likely
   to be quoted back by a search result. A definition list because that is
   what it is: five terms and their answers. */
.gp-cta{margin:0 0 var(--s5)}
.gp-30{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift);max-width:52em;margin:0 0 var(--s6)}
.gp-30 h2{margin:0 0 var(--s3)}
.gp-30 dl{display:grid;gap:var(--s3)}
@media(min-width:700px){.gp-30 dl{grid-template-columns:11em 1fr;gap:var(--s3) var(--s4)}}
.gp-30 dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.gp-30 dd{margin:0;line-height:1.55}

/* ---- The diagram, and the list that labels it -------------------------- */
.gp-fig{margin:0 0 var(--s6);color:var(--ink)}
.gp-fig-in{display:grid;gap:var(--s5);align-items:start}
@media(min-width:900px){.gp-fig-in{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.gpd{display:block;width:100%;height:auto;max-width:640px;margin:0 auto;align-self:center}
.gp-fig figcaption{font:400 var(--t-sm)/1.6 var(--body);color:var(--ink-2);
  margin-top:var(--s3);max-width:52em}
.gpd-ink{stroke:#231F20;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
.gpd-china{fill:var(--ink,#E4DCCC)}
.gpd-rim{fill:none;stroke-width:3}
.gpd-sides{fill:none;stroke-width:4.5}
.gpd-mac{fill:none;stroke:#AC9D71;stroke-width:3.4}
.gpd-fries{fill:none;stroke-width:3}
.gpd-meat{fill:#A8552C;stroke-width:4}
.gpd-sauce{fill:#7A4526;stroke-width:4}
.gpd-specks{fill:#5C3318;stroke:none}
.gpd-onion{fill:#FFFDF6;stroke:#231F20;stroke-width:2.4}
.gpd-mustard{fill:none;stroke:#EFBB25;stroke-width:10}
.gpd-drip{fill:#7A4526;stroke-width:3.4}
.gpd-seam{fill:none;stroke:#231F20;stroke-width:3}
.gpd-bread{fill:#F2E9CD;stroke-width:3.6}
.gpd-butter{fill:#EFBB25;stroke-width:3}
.gpd-call circle{fill:#FFFDF6;stroke:#231F20;stroke-width:4}
.gpd-call line{stroke:#231F20;stroke-width:3.5}
.gpd-call text{font:700 26px var(--mono);fill:#231F20;stroke:none;text-anchor:middle}
.gp-layers{list-style:none;display:grid;gap:var(--s4)}
.gp-layers li{display:grid;grid-template-columns:auto 1fr;gap:var(--s3);align-items:start}
/* SELECTED AS .gp-layers .gpl-n AND THAT IS LOAD BEARING: as a single class the
   .gp-layers p rule below out-ranks it and every numeral goes ink-2 on a
   near-white disc. */
.gp-layers .gpl-n{flex:none;width:34px;height:34px;border-radius:50%;background:#FFFDF6;
  color:#231F20;border:3px solid #231F20;font:700 17px/28px var(--mono);text-align:center}
.gp-layers h3{margin-bottom:4px}
.gp-layers p{color:var(--ink-2);font-size:var(--t-sm);line-height:1.6}
/* "Build the plate". The argument is in the builder above the script. The
   hidden state only exists under .is-armed, which JS adds only once it has
   checked it will run, so a failed script leaves the finished plate. */
.gpd-lay,.gpd-call{transition:opacity .2s cubic-bezier(.2,.7,.3,1),transform .26s cubic-bezier(.2,.7,.3,1);
  transform-origin:50% 100%}
.gpd.is-armed .gpd-lay,.gpd.is-armed .gpd-call{opacity:0;transform:translateY(16px) scale(.985)}
.gpd.is-armed .gpd-lay.is-on,.gpd.is-armed .gpd-call.is-on{opacity:1;transform:none}
.gp-layers li{transition:opacity .2s ease}
.gp-layers.is-armed li{opacity:.3}
.gp-layers.is-armed li.is-on{opacity:1}
.gp-layers.is-armed li.is-now .gpl-n{background:var(--ketchup-deep);color:var(--on-accent);
  border-color:var(--ketchup-deep)}
.gp-build{font-family:inherit;cursor:pointer;margin:0 0 var(--s4)}
.gp-build[disabled],.gp-build[disabled]:hover{box-shadow:none;transform:none;cursor:default}
@media(prefers-reduced-motion:reduce){
  .gp-build{display:none}
  .gpd.is-armed .gpd-lay,.gpd.is-armed .gpd-call{opacity:1;transform:none}
  .gp-layers.is-armed li{opacity:1}}

/* ---- The photographs and their credits ---------------------------------- */
/* ONE SHAPE FOR ALL ELEVEN. CC BY and CC BY-SA both require the photographer's
   name, the license and a link to the license, so the figcaption is not
   decoration and must not be dropped to save a line. */
.gpph{margin:0;display:block}
.gpph img{display:block;width:100%;height:auto;border-radius:var(--r-sm);background:var(--paper)}
.gpph figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin-top:8px}
.gpph-cr a{color:var(--sky-deep);font-weight:600}
.gpph-cr a:hover{text-decoration:underline}
.gpph--hero{max-width:720px;margin:var(--s5) 0 var(--s6)}
.gp-shots{display:grid;gap:var(--s4);max-width:52em;margin:0 0 var(--s6)}
@media(min-width:700px){.gp-shots{grid-template-columns:1fr 1fr}}
.gpph--card{margin:var(--s4) 0 0;max-width:480px}
/* THE ONLY CROP ON EITHER PAGE, AND IT IS A DISPLAY CROP: object-fit frames it
   in the browser and the file that ships is the whole frame, which keeps the
   CC BY-SA files out of "adapted work" territory. */
.gpph--place{margin:0 0 var(--s2)}
.gpph--place img{aspect-ratio:4/3;object-fit:cover}

/* ---- Prose sections: how to order, the sauce, variations ------------------ */
.gp-body{max-width:46em}
.gp-body p{line-height:1.65;color:var(--ink-2);margin-bottom:var(--s3)}
.gp-terms{display:grid;gap:var(--s4);max-width:52em;margin:0 0 var(--s4)}
@media(min-width:800px){.gp-terms{grid-template-columns:1fr 1fr;gap:var(--s4) var(--s5)}}
.gp-terms div{border-top:1px solid var(--hair);padding-top:var(--s3)}
.gp-terms dt{font:400 var(--t-m)/1.2 var(--display);color:var(--ink);margin-bottom:6px}
.gp-terms dd{margin:0;color:var(--ink-2);line-height:1.6;font-size:var(--t-sm)}
.gp-tip{max-width:52em;background:var(--paper);border-left:3px solid var(--keyline);
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:var(--s4);margin:0 0 var(--s4)}
.gp-tip p{line-height:1.6}
.gp-tip b{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);display:block}
.gp-list{list-style:none;display:grid;gap:var(--s4);max-width:52em;margin:0 0 var(--s4)}
.gp-list li{border-top:1px solid var(--hair);padding-top:var(--s3)}
.gp-list h3{margin-bottom:6px}
.gp-list p{color:var(--ink-2);line-height:1.6}
.gp-steps{max-width:46em;margin:0 0 var(--s4) 1.2em;display:grid;gap:6px;color:var(--ink-2);line-height:1.6}
/* The price history is a real table: three price columns a reader compares
   across rows. Prices are pink, which is what a price is on this site. */
.gp-prices{border-collapse:collapse;width:100%;max-width:52em;margin:0 0 var(--s3);font-size:var(--t-sm)}
.gp-prices th,.gp-prices td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--hair);vertical-align:top}
.gp-prices th{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-2)}
.gp-prices td.gp-p{color:var(--ketchup-deep);font-weight:700;white-space:nowrap}
.gp-scroll{overflow-x:auto;max-width:100%}
/* FAQ. Questions are h3s so the outline carries them. */
.gp-faq{max-width:52em;display:grid;gap:var(--s4)}
.gp-faq div{border-top:1px solid var(--hair);padding-top:var(--s3)}
.gp-faq dt h3{font:400 var(--t-m)/1.25 var(--display)}
.gp-faq dd{margin:6px 0 0;color:var(--ink-2);line-height:1.6}

/* ---- The history ------------------------------------------------------- */
.gp-hist{list-style:none;display:grid;gap:var(--s5);max-width:52em}
.gph{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.gph-when{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ketchup-deep);margin-bottom:6px}
.gph h3{margin-bottom:var(--s2)}
.gph-body{color:var(--ink-2);line-height:1.65}
.gph-q{margin:var(--s3) 0 0;padding:var(--s3) var(--s4);background:var(--paper);
  border-left:3px solid var(--keyline);border-radius:0 var(--r-sm) var(--r-sm) 0}
.gph-q p{font-size:var(--t-sm);line-height:1.6}
.gph-q p::before{content:"\\201C"}
.gph-q p::after{content:"\\201D"}
.gph-q cite{display:block;margin-top:6px;font:700 var(--t-micro)/1.5 var(--mono);
  font-style:normal;color:var(--ink-2)}

/* ---- Lists of what is not here, and the sources ------------------------- */
.gp-gaps{list-style:none;display:grid;gap:var(--s3);max-width:52em;
  border-left:3px solid var(--keyline);padding-left:var(--s4)}
.gp-gaps li{font-size:var(--t-sm);line-height:1.6;color:var(--ink-2)}
.gp-gaps a{color:var(--sky-deep);font-weight:600}
.gp-gaps li span{display:block;font-size:var(--t-micro);margin-top:2px}
.gp-more{max-width:52em;margin:var(--s5) 0;border:1px solid var(--hair);border-radius:var(--r);background:var(--card)}
.gp-more>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;padding:var(--s3) var(--s4);
  font:400 var(--t-m)/1.2 var(--display);color:var(--ink);list-style:none}
.gp-more>summary::-webkit-details-marker{display:none}
.gp-more>summary::after{content:"+";margin-left:auto;font:700 var(--t-l)/1 var(--mono);color:var(--sky-deep)}
.gp-more[open]>summary::after{content:"\\2212"}
.gp-more-in{padding:0 var(--s4) var(--s4)}
.gp-more-in h3{margin:var(--s5) 0 var(--s3)}
.gp-more-in h3:first-child{margin-top:0}

/* ---- The directory cards ------------------------------------------------ */
/* align-items:start STAYS, and it is argued in CLAUDE.md's grid rule: only four
   of the 52 cards carry a photograph, so a stretched row would paint 300px of
   empty bordered card under every card beside one of them. */
.gp-places{list-style:none;display:grid;align-items:start;gap:var(--s4);
  grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))}
.gpc{display:flex;flex-direction:column;gap:var(--s2);background:var(--card);min-width:0;
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);box-shadow:var(--lift);scroll-margin-top:80px}
/* THE ORIGINAL WEARS A HEAVIER FRAME, NOT A COLOURED ONE. It was a teal border
   until 23 September 2026, and teal is the colour of a route on this site; the
   card is not one. The flag says "the original" and the flag is the mark. */
.gpc[data-origin]{border:2px solid var(--keyline)}
.gpc-head{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.gpc-head h3{font:400 var(--t-m)/1.2 var(--display)}
/* A MARK THAT GOES NOWHERE IS PINK, per the accent rule: the NEW and #1 HIT
   flags are pink and so is this. The small pink, because it is micro type. */
.gpc-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--ketchup-deep);color:var(--on-accent);padding:5px 8px;border-radius:var(--r-pill)}
.gpc-where{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--ink-2)}
.gpc-dish{font-size:var(--t-sm);color:var(--ink-2)}
.gpc-dish b{color:var(--ink)}
.gpc-price{color:var(--ketchup-deep);font-weight:700;white-space:nowrap}
.gpc-blurb{color:var(--ink-2);font-size:var(--t-sm);line-height:1.6}
.gpc-tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.gpc-tags li{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.03em;color:var(--ink-2);
  border:1px solid var(--keyline);border-radius:999px;padding:5px 9px;background:var(--paper)}
/* OPEN NOW IS A STATE THE READER'S CLOCK DECIDES, so it ships hidden and only
   the script shows it. Neutral, not teal and not pink: it is neither a route
   nor something the site is asserting, it is arithmetic on the business's own
   hours. Its ink is the page ink so it still reads first among the chips. */
.gpc-tags .gpc-open{display:none;background:var(--ink);color:var(--on-accent);border-color:var(--ink)}
.gpc[data-open] .gpc-tags .gpc-open{display:inline-block}
.gpc-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px var(--s3);font-size:var(--t-sm)}
.gpc-facts dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-2)}
.gpc-facts dd{line-height:1.5;overflow-wrap:anywhere}
.gpc-facts a{color:var(--sky-deep);font-weight:600}
.gpc-facts a:hover{text-decoration:underline}
/* The address and the phone are the card's two real actions, so they are built
   to the 44px floor; see the note that used to sit on .gpp-tap. */
.gpc-facts dt.gpc-tap{display:flex;align-items:center}
.gpc-facts dd.gpc-tap{display:flex;align-items:center;min-height:44px}
.gpc-facts dd.gpc-tap a{display:inline-flex;align-items:center;min-height:44px}
.gpc-checked{display:block;font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2)}
.gpc-checked a{font-weight:600}
/* The unconfirmed hour is LOUD on purpose: the cost of a quiet blank here is a
   drive across Rochester, NY to a locked door. */
.gpc-unknown{font:400 var(--t-micro)/1.6 var(--body);color:var(--plum)}
.gpc-note{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);
  padding:8px 10px;background:var(--paper);border-radius:var(--r-sm)}
.gpc-locs{font-size:var(--t-sm)}
.gpc-locs summary{cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--sky-deep);font-weight:700}
.gpc-locs ul{list-style:none;display:grid;gap:4px;margin:0 0 var(--s2);color:var(--ink-2);font-size:var(--t-micro)}
.gpc-locs p a{color:var(--sky-deep);font-weight:600;font-size:var(--t-micro)}
.gpc-links{margin-top:auto;padding-top:var(--s2);display:flex;flex-wrap:wrap;gap:0 var(--s4)}
.gpc-link{font:700 var(--t-sm)/1 var(--body);color:var(--sky-deep);min-height:44px;display:inline-flex;align-items:center}
.gpc-link:hover{text-decoration:underline}

/* ---- The directory: areas and filters ----------------------------------- */
.gpa{margin-top:var(--s7);scroll-margin-top:80px}
.gpa-h{display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s2)}
.gpa-h h2{margin:0}
.gpa-idx{font-size:var(--t-sm);line-height:2;color:var(--ink-2);max-width:60em;margin:0 0 var(--s4)}
.gpa-idx a{color:var(--sky-deep);font-weight:600}
.gpa-idx a:hover{text-decoration:underline}
/* A filter hides cards, so the name index under a heading would point at
   hidden ones. It only shows with nothing filtered. */
.gpdir:has(.gpf input:checked:not(#gpf-all)) .gpa-idx{display:none}
.gpa-n{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
/* THE FILTER IS CSS, NOT SCRIPT, except the one chip that needs a clock. Radio
   inputs and :has(), the 30th page's checklist filter in a second place: a
   reader with no script gets every card, and so does a browser with no :has(),
   because the whole bar is hidden unless the selector is supported. */
.gpf{display:none}
@supports selector(:has(a)){.gpf{display:flex}}
.gpf{flex-wrap:wrap;gap:var(--s3) var(--s5);min-width:0;margin:var(--s3) 0 var(--s2);position:sticky;top:var(--bar-h,60px);z-index:5;
  background:var(--page);padding:var(--s2) 0;border-bottom:1px solid var(--hair)}
/* min-width:0 IS LOAD BEARING. A fieldset's default minimum is its min-content
   width, so without it the phone's single scrolling row pushed the page to
   798px wide instead of scrolling inside itself. */
.gpf fieldset{position:relative;border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px;align-items:center;min-width:0;max-width:100%}
.gpf legend{float:left;margin-right:8px;font:700 var(--t-micro)/44px var(--mono);color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.06em}
.gpf input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.gpf label{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;cursor:pointer;
  background:var(--paper);border:1px solid var(--keyline);font:700 var(--t-sm)/1 var(--body);color:var(--ink)}
.gpf label b{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
.gpf input:checked+label{border:2px solid var(--sky);background:var(--paper-3)}
.gpf input:focus-visible+label{outline:3px solid var(--sky);outline-offset:2px}
.gpf-js[hidden]{display:none}
/* The site bar is sticky and so is the filter under it, so a jump to an area or
   a card has to land below both of them or its heading is hidden. */
.gpdir .gpa,.gpdir .gpc{scroll-margin-top:150px}
.gpf-count{font:700 var(--t-micro)/44px var(--mono);color:var(--ink-2);letter-spacing:.04em}
${Object.keys(TAGS)
  .map(
    (t) =>
      `.gpdir:has(#gpf-${t}:checked) .gpc:not([data-tags~="${t}"]){display:none}` +
      `.gpdir:has(#gpf-${t}:checked) .gpa:not(:has(.gpc[data-tags~="${t}"])){display:none}`,
  )
  .join("\n")}
.gpdir:has(#gpf-open:checked) .gpc:not([data-open]){display:none}
/* UNDER A FILTER THE COUNTS WOULD LIE AND SOME AREA CHIPS WOULD POINT AT A HIDDEN
   SECTION, so the counts go and so do the chips for areas with nothing to show.
   The builder knows which areas carry each tag; "open now" is decided by the
   clock, so the script marks those chips itself. */
.gpdir:has(.gpf input:checked:not(#gpf-all)) .gpa-n,.gpdir:has(.gpf input:checked:not(#gpf-all)) .gp-jump a b{display:none}
${Object.keys(TAGS)
  .flatMap((t) =>
    GROUPS.filter((g) => !places.some((p) => p.group === g.id && p._tags.includes(t))).map(
      (g) => `.gpdir:has(#gpf-${t}:checked) .gp-jump a[href="#${g.id}"]{display:none}`,
    ),
  )
  .join("\n")}
.gpdir:has(#gpf-open:checked) .gp-jump a[data-closed]{display:none}
/* Open now hides every place that posts no hours, Nick Tahou Hots included, and
   says so rather than letting them vanish. */
.gpf-open-note{display:none;max-width:52em}
.gpdir:has(#gpf-open:checked) .gpf-open-note{display:block}
.gpdir:has(#gpf-open:checked) .gpa:not(:has(.gpc[data-open])){display:none}

/* ---- Where to get one, on the guide ------------------------------------- */
.gp-where{display:grid;gap:var(--s5);align-items:start;max-width:72em}
@media(min-width:900px){.gp-where{grid-template-columns:minmax(0,5fr) minmax(0,6fr)}}
.gp-where .gp-places{grid-template-columns:1fr}
.gp-areas{list-style:none;display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));margin:0 0 var(--s4)}
.gp-areas a{display:flex;justify-content:space-between;align-items:center;gap:var(--s2);min-height:56px;
  padding:var(--s2) var(--s4);border:1px solid var(--keyline);border-radius:var(--r);background:var(--card);
  color:var(--sky-deep);font-weight:700;text-decoration:none}
.gp-areas a:hover,.gp-areas a:focus-visible{border-color:var(--sky);color:var(--sky)}
.gp-areas a b{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}

/* LAST IN THE SHEET ON PURPOSE: it overrides .gpf fieldset, which is
   written further up. ON A PHONE THE CHIP ROWS SCROLL SIDEWAYS INSTEAD OF WRAPPING. Wrapped, the
   guide's ten jump links were four rows and 400px of the first screen, and the
   directory's sticky filter was three rows and 200px of every screen after it.
   One row each now. The row clips its own overflow, so nothing hangs off the
   page and scrollX stays 0. */
@media(max-width:899px){
  .gp-jump,.gpf fieldset{flex-wrap:nowrap;overflow-x:auto;max-width:none;scrollbar-width:none;
    margin-left:calc(-1 * var(--gut,16px));margin-right:calc(-1 * var(--gut,16px));padding:0 var(--gut,16px)}
  .gp-jump::-webkit-scrollbar,.gpf fieldset::-webkit-scrollbar{display:none}
  .gp-jump a,.gpf label{flex:none;white-space:nowrap}
  .gpf legend{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .gpf{padding:var(--s2) 0}}
.gp-prices th .gp-src{font:400 var(--t-micro)/1.6 var(--body);text-transform:none;letter-spacing:0}
.gp-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--keyline);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
/* The section ornament, from shared/format.mjs. One per page. */
${PLATE_CSS}
`;

/* ---- Pieces shared by both bodies ------------------------------------------ */
const G = doc.guide || {};
const readOn = esc(longDate(doc.updated) || doc.updated);
const sourceList = (doc.sources || [])
  .map(
    (s) =>
      `      <li><a href="${esc(cleanUrl(s.url))}" rel="noopener" target="_blank" aria-label="${esc(
        s.name,
      )}, opens on ${esc(hostOf(s.url))}">${esc(s.name)}</a>${s.note ? ` <span>${esc(s.note)}</span>` : ""}</li>`,
  )
  .join("\n");
const liList = (arr) => (arr || []).map((g) => `      <li>${esc(g)}</li>`).join("\n");
const photoNotes = PHOTOS.filter((x) => x.placeNote)
  .map((x) => `      <li>${esc(x.placeNote)}</li>`)
  .concat((doc.photosRejected || []).map((g) => `      <li>${esc(g)}</li>`))
  .join("\n");
const emailBlock = `<p class="gp-note">NOT SPONSORED AND NOT AFFILIATE LINKS. NOBODY PAID TO BE ON THESE PAGES.
      IF YOU RUN A PLACE AROUND ROCHESTER, NY THAT SERVES A PLATE AND YOU ARE NOT ON HERE, EMAIL ME.</p>
    <p class="gp-sub">Send the name, the address and what it is called on your menu, and attach a photo of the
      plate: <a href="${esc(
        mailtoHref("garbage plate place", [
          "Place name: ",
          "Address: ",
          "What it is called on your menu: ",
          "Website or socials: ",
          "",
          "(attach a photo of the plate)",
        ]),
      )}">email the channel</a>. A place goes on once its own menu says it serves one.</p>`;
const localLinks = `<p class="gp-sub" style="margin-top:var(--s6)">Hungry for the other local pages? The
      <a href="/shops.html">card shops around Rochester, NY</a> are where this channel actually buys, the
      <a href="/card-shows.html">card show calendar</a> has everything coming up around Rochester, NY,
      Buffalo and Syracuse, and <a href="/about.html">about the channel</a> explains what Garbage Rips
      585 is and why it is named after dinner.</p>`;

/* ================================================================ THE GUIDE ==
 *
 * /garbage-plate.html, the 101. Split from the directory on 23 September 2026
 * when the list went from 11 places to 52: a page that answers "what is a
 * garbage plate" in its first sentence and a page that answers "where can I get
 * one" in its first screen are two different pages, and one page trying to be
 * both put the answer to the second question 12,000px down a phone.
 *
 * THE ORDER IS THE READER'S ORDER. Definition, the 30 second version, the
 * drawing, how to order, where to get one, then everything a curious reader
 * wants after lunch: the sauce, the history, the variations, the prices, the
 * FAQ, and the sources. The history used to be the second section and is now
 * the sixth, because nobody searching "what is a garbage plate" came for 1968.
 */
const origin = places.find((p) => p.origin);
const faq = G.faq || [];
const jump101 = [
  ["in-30-seconds", "In 30 seconds"],
  ["whats-on-it", "What is on it"],
  ["how-to-order", "How to order"],
  ["where-to-get-one", "Where to get one"],
  ["hot-sauce", "The hot sauce"],
  ["history", "History"],
  ["variations", "Kinds of plate"],
  ["prices", "Prices"],
  ["at-home", "At home"],
  ["faq", "FAQ"],
];

const body101 = `
<main id="main" tabindex="-1" class="gp">
  <div class="wrap">
    <div class="brk"><h1>What is a <span class="hl">Garbage Plate</span>?</h1><span class="ln"></span></div>
    <p class="gp-def">A Garbage Plate is Rochester, NY's signature dish: two sides, usually macaroni salad and
      home fries, topped with two hot dogs or burgers, a spiced meat hot sauce, mustard and raw onions, with
      buttered Italian bread on the side. It comes from Nick Tahou Hots, which owns the name.</p>
    <p class="gp-cta"><a class="btn btn-yt" href="${DIR_PATH}">Find a plate: ${nPlaces} places around Rochester, NY</a></p>
    <p class="gp-lede">It is also the dish this channel is named after. Everything on this page names where it
      came from, the way this site handles a price, and where something could not be sourced it says so. Looking
      for somewhere to eat one? <a href="${DIR_PATH}">All ${nPlaces} places around Rochester, NY that serve a
      plate</a> are in the directory.</p>
    <nav class="gp-jump" aria-label="On this page">
      ${jump101.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join("\n      ")}
    </nav>

    <section class="gp-30" aria-labelledby="in-30-seconds">
      <h2 id="in-30-seconds">The Garbage Plate in <span class="hl">30 seconds</span></h2>
      <dl>
        ${(doc.thirty || []).map((x) => `<dt>${esc(x.k)}</dt><dd>${esc(x.v)}</dd>`).join("\n        ")}
        <dt>Where to get one</dt><dd><a href="${DIR_PATH}" style="color:var(--sky-deep);font-weight:700">${nPlaces} places around Rochester, NY</a>, by area, with hours and prices.</dd>
      </dl>
    </section>

    ${photoRun("hero", { sizes: "(min-width:800px) 720px, calc(100vw - 32px)", mod: "gpph--hero" })}

    <h2 id="whats-on-it">What is actually <span class="hl">on one</span></h2>
    <p class="gp-sub">${esc(doc.anatomy?.intro || "")}</p>
    <button type="button" class="btn btn-yt btn-sm gp-build" id="gpBuild" hidden>Build the plate</button>
    <figure class="gp-fig">
      <div class="gp-fig-in">
        ${plateDiagram()}
        <ol class="gp-layers">
${layerList}
        </ol>
      </div>
      <figcaption>Drawn rather than photographed, because a drawing can be cut open and labeled and a
        photograph cannot. The order is bottom to top and it matters: the sauce goes over everything,
        which is what makes it a plate and not a tray of sides. ${esc(doc.anatomy?.srcNote || "")}</figcaption>
    </figure>
    <div class="gp-shots">
      ${photoRun("anatomy", { sizes: "(min-width:700px) 340px, calc(100vw - 32px)" })}
    </div>

    <h2 id="how-to-order">How to <span class="hl">order one</span></h2>
    <p class="gp-sub">${esc(G.order?.intro || "")}</p>
    <dl class="gp-terms">
      ${(G.order?.terms || [])
        .map((t) => `<div><dt>${esc(t.t)}</dt><dd>${esc(t.d)}${srcLine(t.src)}</dd></div>`)
        .join("\n      ")}
    </dl>
    <div class="gp-tip"><b>The owner's own order</b><p>${esc(G.order?.tip || "")}</p>${srcLine(G.order?.tipSrc)}</div>
    <p class="gp-sub">${esc(G.order?.orders || "")}</p>
    ${srcLine(G.order?.ordersSrc)}

    <h2 id="where-to-get-one">Where to <span class="hl">get one</span></h2>
    <p class="gp-sub">Only one kitchen can sell you a Garbage Plate by that name, and it is on West Main Street.
      ${nPlaces - 1} more around Rochester, NY sell their own version under their own name, and every one of
      them is in <a href="${DIR_PATH}">the directory</a>, by area, with prices, the hours they publish and a
      filter for what is open right now.</p>
    <div class="gp-where">
      <ol class="gp-places">
${placeCard(origin, { static: true, noPhoto: true })}
      </ol>
      <div>
        <ul class="gp-areas">
          ${GROUPS.map(
            (g) =>
              `<li><a href="${DIR_PATH}#${g.id}"><span>${esc(g.id === "chain" ? "Chains" : g.name)} <span aria-hidden="true">&rarr;</span></span> <b>${countOf(g.id)}</b></a></li>`,
          ).join("\n          ")}
        </ul>
        <p><a class="btn btn-yt" href="${DIR_PATH}">See all ${nPlaces} places</a></p>
        <p class="gp-sub" style="margin-top:var(--s4)">${esc(doc.listRule || "")}</p>
      </div>
    </div>

    <h2 id="hot-sauce">The <span class="hl">hot sauce</span></h2>
    <p class="gp-sub">${esc(G.sauce?.intro || "")}</p>
    <ul class="gp-list">
      ${(G.sauce?.items || []).map((x) => `<li><p>${esc(x.d)}</p>${srcLine(x.src)}</li>`).join("\n      ")}
    </ul>

    <h2 id="history">Where it <span class="hl">came from</span></h2>
    <p class="gp-sub">Told in the order it happened, with the source for every claim on the claim itself.
      Two of these are primary: a federal trademark file, and the restaurant's own order form.</p>
    <ol class="gp-hist">
${historyBlocks}
    </ol>

    <h2 id="variations">Every kind of <span class="hl">plate</span></h2>
    <p class="gp-sub">${esc(G.variations?.intro || "")}</p>
    <ul class="gp-list">
      ${(G.variations?.items || [])
        .map((x) => `<li><h3>${esc(x.h)}</h3><p>${esc(x.d)}</p>${srcLine(x.src)}</li>`)
        .join("\n      ")}
    </ul>

    <h2 id="prices">What one <span class="hl">costs</span></h2>
    <p class="gp-sub">${esc(G.prices?.intro || "")}</p>
    <div class="gp-scroll"><table class="gp-prices">
      <caption class="gp-sub" style="text-align:left;caption-side:bottom;margin-top:var(--s2)">Nick Tahou Hots, per plate.</caption>
      <thead><tr><th scope="col">When</th><th scope="col">Hot dog plate</th><th scope="col">Cheeseburger plate</th><th scope="col">Chicken or haddock</th></tr></thead>
      <tbody>
        ${(G.prices?.rows || [])
          .map((r) =>
            r.all
              ? `<tr><th scope="row">${esc(r.when)}</th><td colspan="3">${esc(r.all)}${srcLine(r.src)}</td></tr>`
              : `<tr><th scope="row">${esc(r.when)}${srcLine(r.src)}</th><td class="gp-p">${esc(r.hot)}</td><td class="gp-p">${esc(
                  r.cb,
                )}</td><td class="gp-p">${esc(r.fish)}</td></tr>`,
          )
          .join("\n        ")}
      </tbody>
    </table></div>
    <p class="gp-sub">${esc(G.prices?.after || "")}</p>

    <h2 id="at-home">Making one <span class="hl">at home</span></h2>
    <p class="gp-sub">${esc(G.home?.intro || "")}</p>
    <ol class="gp-steps">
      ${(G.home?.steps || []).map((s) => `<li>${esc(s)}</li>`).join("\n      ")}
    </ol>
    <div class="gp-tip"><b>From the people who make it</b><p>${esc(G.home?.tips || "")}</p>${srcLine(G.home?.src)}</div>

    <h2 id="faq">Garbage Plate <span class="hl">questions</span></h2>
    <dl class="gp-faq">
      ${faq
        .map((f) => `<div><dt><h3>${esc(f.q)}</h3></dt><dd>${esc(f.a)}${srcLine(f.src)}</dd></div>`)
        .join("\n      ")}
    </dl>

    ${plateRule()}

    <h2 id="not-known">What this page <span class="hl">does not know</span></h2>
    <p class="gp-sub">A short sourced history beats a long plausible one. These are the things that get
      repeated about the Garbage Plate that could not be sourced, so they are not stated above. They are
      written down here so nobody has to research them twice.</p>
    <ul class="gp-gaps">
${liList(doc.notSourced)}
    </ul>

    <details class="gp-more">
      <summary>Every source on this page</summary>
      <div class="gp-more-in">
        <p class="gp-sub">All of them were read on ${esc(longDate(doc.read) || doc.read)} or re-read on ${readOn}.</p>
        <ul class="gp-gaps">
${sourceList}
        </ul>
        <h3>Where the photographs came from</h3>
        <p class="gp-sub">${esc(doc.photoNote || "")}</p>
        <ul class="gp-gaps">
${photoNotes}
        </ul>
      </div>
    </details>

    ${localLinks}
    ${emailBlock}
  </div>
</main>`;

/* ============================================================ THE DIRECTORY ==
 *
 * /where-to-get-a-garbage-plate.html. Every place whose own site, menu or
 * ordering page says it serves a plate, grouped by area, because "where can I
 * get one" is asked from somewhere. Areas are anchors rather than filters, so a
 * reader with no script and no :has() still gets a page they can jump around,
 * and a search result can deep link to #west. The four filters are CSS; "open
 * now" is the one that needs a clock and is the one that needs a script.
 */
const dirGroups = GROUPS.map((g) => {
  const list = inGroup(g.id);
  if (!list.length) return "";
  return `    <section class="gpa" id="${g.id}" aria-labelledby="${g.id}-h">
      <div class="gpa-h"><h2 id="${g.id}-h">${esc(g.name)}</h2><span class="gpa-n">${list.length} place${
        list.length === 1 ? "" : "s"
      }</span></div>
      <p class="gp-sub">${esc(g.blurb)}</p>
      <p class="gpa-idx">${list.map((p) => `<a href="#${p._id}">${esc(p.name)}</a>`).join('<span aria-hidden="true"> &middot; </span>')}</p>
      <ol class="gp-places">
${list.map((p) => placeCard(p)).join("\n")}
      </ol>
    </section>`;
}).join("\n");

const withHoursN = places.filter((p) => p._week).length;
const bodyDir = `
<main id="main" tabindex="-1" class="gp gpdir">
  <div class="wrap">
    <div class="brk"><h1>Where to get a <span class="hl">Garbage Plate</span> in Rochester, NY</h1><span class="ln"></span></div>
    <p class="gp-def">${nPlaces} places around Rochester, NY that serve a plate, sorted by area, every one
      checked against its own menu on ${readOn}.</p>
    <p class="gp-lede">Only one of them owns the name Garbage Plate: Nick Tahou Hots. The rest sell trash
      plates, junkyard plates, sloppy plates, Genny plates and plain plates under names of their own, and it is
      nearly the same idea every time: two sides, meat on top, meat hot sauce, mustard and onions. Each one is
      here because its own menu says so, and nobody paid to be on it. New to it? Start with
      <a href="${GUIDE_PATH}">what a Garbage Plate is and how to order one</a>.</p>
    <nav class="gp-jump" aria-label="Areas">
      ${GROUPS.map((g) => `<a href="#${g.id}">${esc(g.short || g.name)} <b>${countOf(g.id)}</b></a>`).join("\n      ")}
    </nav>
    <form class="gpf" onsubmit="return false" aria-label="Filter the places">
      <fieldset>
        <legend>Show</legend>
        <input type="radio" name="gpf" id="gpf-all" checked><label for="gpf-all">All <b>${nPlaces}</b></label>
        <span class="gpf-js" hidden><input type="radio" name="gpf" id="gpf-open"><label for="gpf-open">Open now <b id="gpfOpenN"></b></label></span>
        ${Object.entries(TAGS)
          .map(
            ([t, label]) =>
              `<input type="radio" name="gpf" id="gpf-${t}"><label for="gpf-${t}">${esc(label)} <b>${tagCount(t)}</b></label>`,
          )
          .join("\n        ")}
      </fieldset>
    </form>
    <p class="gp-sub gpf-open-note">${nPlaces - withHoursN} places publish no hours of their own, so they are not
      shown here. That includes Nick Tahou Hots. Call them.</p>
${dirGroups}

    <h2 id="how-this-list-works">How this list <span class="hl">works</span></h2>
    <p class="gp-sub">${esc(doc.listRule || "")} ${esc(doc.listNote || "")}</p>
    <p class="gp-sub">Addresses, prices and links were checked on ${readOn}.
      Opening hours are printed for ${withHoursN} of the ${nPlaces} because those are the ones that state them
      on a page they run, and every other card says so instead of guessing. Open now is worked out in your
      browser from those same posted hours, in Rochester, NY time, so a holiday or a short-staffed night will
      not show up in it. Call before you make a trip of it.</p>

    ${plateRule()}

    <details class="gp-more">
      <summary>Places we checked and left off</summary>
      <div class="gp-more-in">
        <p class="gp-sub">Every one of these turns up on somebody's list of plates around Rochester, NY. None of
          them could be confirmed from the business itself, so none of them are above. They are written down so
          nobody researches them again, and so you know the list is short on purpose.</p>
        <ul class="gp-gaps">
${liList(doc.checkedAndLeftOut)}
        </ul>
        <h3>Leads we could not confirm yet</h3>
        <p class="gp-sub">Places that probably do serve a plate, where nothing the business runs says so today.
          If one of these is yours, the email address is below.</p>
        <ul class="gp-gaps">
${liList(doc.leads)}
        </ul>
      </div>
    </details>

    ${localLinks}
    ${emailBlock}
  </div>
</main>`;

/* ---- Schema ------------------------------------------------------------------ *
 *
 * THE RESTAURANTS ARE AN ItemList AND NOT A SET OF LocalBusiness NODES, the
 * call build-shops.mjs makes and states: these are other people's businesses and
 * we are not their authority. Emitting Restaurant or LocalBusiness for a kitchen
 * we do not own would be claiming to speak for it, and it would be claiming
 * opening hours these pages go out of their way to attribute to the business.
 * The directory's ItemList points at each card's own anchor on our page and
 * names the restaurant, which is exactly what this page is.
 */
const publisher = {
  "@type": "Organization",
  "@id": SITE + "/#org",
  name: "Garbage Rips 585",
  url: SITE + "/",
  logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
};
const crumbs = (trail) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: `${SITE}${path}`,
  })),
});
const TITLE_101 = "What Is a Garbage Plate? Where to Get One in Rochester, NY";
const DESC_101 =
  `A Garbage Plate is Rochester, NY's signature dish. What is on one, how to order it, where it came from ` +
  `with a source on every claim, and ${nPlaces} places that serve their own version.`;
const TITLE_DIR = "Where to Get a Garbage Plate in Rochester, NY";
const DESC_DIR =
  `${nPlaces} places around Rochester, NY that serve a plate, by area, with prices, posted hours and ` +
  `an open now filter. Every one checked against its own menu.`;

const schema101 = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${SITE}${GUIDE_PATH}#article`,
      headline: TITLE_101,
      description: DESC_101,
      inLanguage: "en-US",
      image: [ogUrl("garbage-plate")],
      datePublished: doc.published,
      dateModified: doc.updated,
      author: { "@type": "Organization", name: "Garbage Rips 585" },
      publisher,
      mainEntityOfPage: `${SITE}${GUIDE_PATH}`,
      about: { "@type": "Thing", name: "Garbage Plate" },
      isPartOf: { "@type": "WebSite", name: "Garbage Rips 585", url: `${SITE}/` },
      citation: (doc.sources || []).map((s) => ({ "@type": "CreativeWork", name: s.name, url: cleanUrl(s.url) })),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}${GUIDE_PATH}#faq`,
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    crumbs([["Home", "/"], ["Garbage Plate", GUIDE_PATH]]),
  ],
};
const dirOrder = GROUPS.flatMap((g) => inGroup(g.id));
const schemaDir = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE}${DIR_PATH}#page`,
      name: TITLE_DIR,
      description: DESC_DIR,
      inLanguage: "en-US",
      dateModified: doc.updated,
      publisher,
      isPartOf: { "@type": "WebSite", name: "Garbage Rips 585", url: `${SITE}/` },
      mainEntity: { "@id": `${SITE}${DIR_PATH}#list` },
    },
    {
      "@type": "ItemList",
      "@id": `${SITE}${DIR_PATH}#list`,
      name: "Where to get a garbage plate in Rochester, NY",
      description: "Restaurants around Rochester, NY whose own menus say they serve a plate. A directory, not a ranking.",
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: dirOrder.length,
      itemListElement: dirOrder.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: `${SITE}${DIR_PATH}#${p._id}`,
      })),
    },
    crumbs([["Home", "/"], ["Garbage Plate", GUIDE_PATH], ["Where to get one", DIR_PATH]]),
  ],
};

/* ---- Scripts ------------------------------------------------------------------ */
// "BUILD THE PLATE". The one thing on the guide that moves. It passes the pack
// wrapper's four tests (tied to a click, reveals something wanted, short, never
// repeats) and obeys five rules that are scar tissue: the house curve, class
// toggles rather than @keyframes, visible by default with a failsafe, reduced
// motion removes the movement and not the content, and NEVER ARM under reduced
// motion, because ui.css's blanket transition:none leaves an opacity:0 base.
const buildScript = `<script>
(function(){
  var svg=document.querySelector('.gpd'), ol=document.querySelector('.gp-layers');
  var btn=document.getElementById('gpBuild');
  if(!svg||!ol||!btn) return;
  var lays=svg.querySelectorAll('.gpd-lay'), calls=svg.querySelectorAll('.gpd-call'),
      lis=ol.querySelectorAll('li');
  if(lays.length!==6||calls.length!==6||lis.length!==6) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  btn.hidden=false;
  function step(n){
    for(var i=0;i<6;i++){ var on=i<=n;
      lays[i].classList.toggle('is-on',on); calls[i].classList.toggle('is-on',on);
      lis[i].classList.toggle('is-on',on); lis[i].classList.toggle('is-now',i===n); }
  }
  function settle(){
    svg.classList.remove('is-armed'); ol.classList.remove('is-armed'); step(-1);
    btn.disabled=true; btn.textContent='Plate built';
  }
  btn.addEventListener('click',function(){
    if(btn.disabled) return;
    svg.classList.add('is-armed'); ol.classList.add('is-armed'); step(-1);
    var fs=setTimeout(settle,2000), i=0;
    (function tick(){
      step(i);
      if(++i<6){ setTimeout(tick,130); return; }
      setTimeout(function(){ clearTimeout(fs); settle(); },700);
    })();
  });
})();
<\/script>`;

// OPEN NOW. Reads each card's data-h (seven day slots, Sunday first, minutes,
// a close past 1440 running into the next morning) against the time in
// America/New_York, whatever the reader's own zone is, because a plate is
// eaten in Rochester, NY. Checks YESTERDAY's late spans as well, so Vasko's at
// 1am on a Saturday counts as Friday night. Re-runs every minute. If Intl cannot
// resolve the zone it returns before unhiding the chip, so the filter can never
// be offered by a page that cannot answer it.
const openScript = `<script>
(function(){
  /* Keep the chosen chip in view: the inputs are visually hidden, so focusing
     one never scrolls the phone's sideways chip row to its label. */
  var form=document.querySelector('.gpf');
  if(form) form.addEventListener('change',function(e){ var l=document.querySelector('label[for="'+e.target.id+'"]');
    if(l&&l.scrollIntoView) l.scrollIntoView({inline:'nearest',block:'nearest'}); });
  var cards=document.querySelectorAll('.gpc[data-h]'); if(!cards.length) return;
  var f; try{ f=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}); f.format(new Date()); }catch(e){ return; }
  var W=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function now(){ var o={}; f.formatToParts(new Date()).forEach(function(x){o[x.type]=x.value;});
    return {d:W.indexOf(o.weekday), m:(parseInt(o.hour,10)%24)*60+parseInt(o.minute,10)}; }
  function spans(h,i){ return (h[i]||'').split(',').filter(Boolean).map(function(s){var a=s.split('-');return [+a[0],+a[1]];}); }
  function isOpen(attr,n){ var h=attr.split('|'), t=spans(h,n.d), y=spans(h,(n.d+6)%7), i;
    for(i=0;i<t.length;i++) if(n.m>=t[i][0]&&n.m<t[i][1]) return true;
    for(i=0;i<y.length;i++) if(y[i][1]>1440&&n.m<y[i][1]-1440) return true;
    return false; }
  var label=document.getElementById('gpfOpenN');
  function run(){ var n=now(), c=0; if(n.d<0) return;
    for(var i=0;i<cards.length;i++){ var on=isOpen(cards[i].getAttribute('data-h'),n);
      if(on){ cards[i].setAttribute('data-open',''); c++; } else cards[i].removeAttribute('data-open'); }
    if(label) label.textContent=c;
    [].forEach.call(document.querySelectorAll('.gp-jump a[href^="#"]'),function(j){ var sec=document.querySelector(j.getAttribute('href'));
      if(sec&&!sec.querySelector('.gpc[data-open]')) j.setAttribute('data-closed',''); else j.removeAttribute('data-closed'); }); }
  run(); setInterval(run,60000);
  var js=document.querySelector('.gpf-js'); if(js) js.hidden=false;
})();
<\/script>`;

/* ---- Assembly ---------------------------------------------------------------- */
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf("</header>") + "</header>".length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const page = ({ headHtml, schema, body, scripts }) => `<!DOCTYPE html>
<html lang="en">
<head>${headHtml}<style>${miniCSS(style)}</style>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>
${skipLink}
${sprite}

${bar}
${menuPanel}
${body}
${footer}

${scripts}
${APP_JS}
</body>
</html>
`;

const html101 = page({
  headHtml: pageHead({
    path: GUIDE_PATH,
    title: TITLE_101,
    desc: DESC_101,
    ogSlug: "garbage-plate",
    ogAlt: "What is a Garbage Plate? A guide to Rochester, NY's signature dish, from Garbage Rips 585",
  }),
  schema: schema101,
  body: body101,
  scripts: buildScript,
});
const htmlDir = page({
  headHtml: pageHead({
    path: DIR_PATH,
    title: TITLE_DIR,
    desc: DESC_DIR,
    ogSlug: "where-to-get-a-garbage-plate",
    ogAlt: "Where to get a Garbage Plate in Rochester, NY, a directory from Garbage Rips 585",
  }),
  schema: schemaDir,
  body: bodyDir,
  scripts: openScript,
});

await writeFile(join(ROOT, "public/garbage-plate.html"), dropUnusedPacksCSS(html101));
await writeFile(join(ROOT, "public", DIR_PATH.slice(1)), dropUnusedPacksCSS(htmlDir));

console.log(
  `Wrote public/garbage-plate.html  (${(doc.history || []).length} sourced history entries, ` +
    `${(doc.anatomy?.layers || []).length} labeled layers, ${faq.length} questions)`,
);
console.log(
  `Wrote public${DIR_PATH}  (${nPlaces} places in ${GROUPS.length} areas; posted hours on ${withHoursN}, ` +
    `the rest say so on the card)`,
);
for (const p of places.filter((x) => cleanUrl(x.url) !== x.url)) {
  console.log(`  cleaned tracking parameters off ${p.name}:\n    ${cleanUrl(p.url)}`);
}
