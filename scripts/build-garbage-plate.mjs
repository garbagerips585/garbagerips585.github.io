#!/usr/bin/env node
// Build public/garbage-plate.html from data/garbage-plate.json: what a Garbage
// Plate is, where it came from, what is on one, and where to eat one.
//
//   node scripts/build-garbage-plate.mjs
//
// WHY THIS PAGE EXISTS. Tim asked for it twice, and the second ask is the one
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
// THE DISH IS NOBODY'S PROPERTY AND THE NAME IS SOMEBODY'S. Tim settled the
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
// The licences, the photographers and the dates live in data/garbage-plate.json
// beside the sourced facts, in the same shape and for the same reason, and
// scripts/sync-plate-photos.py re-reads all of it from Commons on every run and
// refuses to write a file whose licence, author or licence url has moved.
//
// THE CREDIT IS NOT OPTIONAL AND IT IS NOT A FOOTNOTE. CC BY and CC BY-SA both
// require the photographer's name, an indication of the licence and a LINK to
// that licence, and a credit a reader cannot connect to the picture it belongs
// to is not a credit. So every photograph on this page is a <figure> whose
// <figcaption> carries the photographer, the licence name linked to the deed,
// and a link to the file on Commons, directly under the picture. There was no
// precedent on this site for that: the retailer marks in shared/brands.mjs are
// all public domain and are credited in JSON only. This is the precedent, and
// it is written down in CLAUDE.md rather than left in one builder.
//
// NOTHING IS CROPPED, AND THAT IS A LICENCE DECISION. Four of the ten are
// CC BY-SA, which asks that an ADAPTED work carry the same licence. Resizing
// and re-encoding for delivery is not an adaptation; cropping is. Where the
// layout wants a 4:3 shape it gets it with object-fit, which changes what is
// DISPLAYED and not what is distributed.
//
// THE DIAGRAM IS STILL THE ASSET. The photographs show what a plate looks like;
// only the drawing can be cut open and labelled, it is the one thing on this
// subject that does not already exist somewhere, and it keeps the top of the
// anatomy section. The photographs sit under it, not over it.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS, same call and same reason as
// build-shops.mjs: nothing on this page plays a rip where it sits.
import { APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, plateRule, PLATE_CSS } from "../shared/format.mjs";

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
for (const row of [...(doc.history || []), ...(doc.anatomy?.layers || [])]) {
  for (const id of [...(row.src || []), row.quoteSrc].filter(Boolean)) {
    if (!SRC.has(id)) throw new Error(`garbage-plate.json: unknown source id "${id}"`);
  }
}
for (const p of places) {
  if (!p.name || !p.url) throw new Error(`garbage-plate.json: a place needs a name and a url`);
  if (p.hours && !p.hoursSrc) {
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
// and the licence work behind it is wasted without anything erroring.
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
    // to the licence, so a record that names one and cannot link it is not a
    // licence we can meet. Public domain is the only value allowed to have no
    // url, and it is the only one whose credit line makes no claim.
    if (ph.license !== "Public domain" && !ph.licenseUrl) {
      throw new Error(`garbage-plate.json: photo "${ph.slug}" is "${ph.license}" with no ` +
        `licenceUrl. Attribution licences require a link to the licence; do not publish it.`);
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

  // THE CREDIT LINE. Photographer, licence, link to the licence, link to the
  // file. Public domain gets no licence link because there is no licence to
  // link, and it says so in words rather than printing a bare "Public domain"
  // that reads like a licence name nobody can check.
  const who = `<a href="${esc(ph.page)}" rel="noopener" target="_blank" aria-label="${esc(
    ph.by,
  )}'s photograph on Wikimedia Commons, where its licence is stated, opens on commons.wikimedia.org">${esc(ph.by)}</a>`;
  const lic =
    ph.license === "Public domain"
      ? "released into the public domain"
      : `<a href="${esc(ph.licenseUrl)}" rel="noopener" target="_blank" aria-label="The ${esc(
          ph.license,
        )} licence deed, opens on creativecommons.org">${esc(ph.license)}</a>`;
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
 * THE DIAGRAM. A labelled cutaway of a Garbage Plate, drawn.
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
           rather than on a disc behind it. */ ""}
      <ellipse cx="310" cy="432" rx="286" ry="60" class="gpd-china"/>

      ${/* THE TWO SIDES ARE THE MOUND, split down the middle. The seam is drawn
           as an EDGE rather than left as a colour change, so which side is
           which survives the picture being greyscaled. */ ""}
      <g clip-path="url(#gpSides)">
        <rect x="80" y="290" width="230" height="180" fill="#F2E9CD"/>
        <rect x="310" y="290" width="240" height="180" fill="#DFA93C"/>
        <g class="gpd-mac">${mac}</g>
        <g class="gpd-fries">${fries}</g>
        <path class="gpd-seam" d="M310 306L310 458"/>
      </g>
      <path class="gpd-sides" d="${SIDES}"/>

      ${/* THE MEAT OVERHANGS ON PURPOSE. Drawn outside the clip so both pieces
           poke past the mound's outline, which is what makes them read as two
           objects lying on the sides rather than as a third stripe of it. */ ""}
      <g class="gpd-meat">
        <rect x="102" y="278" width="206" height="64" rx="32"/>
        <rect x="290" y="252" width="212" height="64" rx="32"/>
      </g>

      <path class="gpd-sauce" d="${SAUCE}"/>
      <g class="gpd-drip">
        <path d="M188 280C182 316 178 366 184 388C189 405 200 400 199 384C197 350 194 312 188 280Z"/>
        <path d="M436 278C442 312 447 358 441 380C436 397 425 392 426 376C428 342 431 308 436 278Z"/>
      </g>
      <g clip-path="url(#gpSauce)">
        <g class="gpd-specks">${specks}</g>
        <g class="gpd-onion">${onion}</g>
        ${/* The mustard, clipped to the sauce so the stripe cannot end up
             floating in the air beside the plate, which is what it did the
             first time it was drawn unclipped. */ ""}
        <path class="gpd-mustard" d="M204 200c26-26 44 12 70-14s46 20 72-8 44 18 68-4"/>
      </g>

      ${/* The near rim, painted over the foot of the mound. */ ""}
      <path class="gpd-china" d="M24 432a286 60 0 0 0 572 0"/>
      <path class="gpd-rim" d="M78 428a232 42 0 0 0 464 0"/>

      ${/* Bread and butter BESIDE the plate rather than on it, which is both
           how it arrives and the only place on this drawing with room for it.
           Two slices, because the 1918 dish was two pieces of Italian bread and
           butter and it still is. */ ""}
      <g class="gpd-bread">
        <path d="${slice}" transform="translate(418 476) scale(1.16)"/>
        <path d="${slice}" transform="translate(482 460) scale(1.16)"/>
      </g>
      <rect class="gpd-butter" x="526" y="502" width="38" height="29" rx="5"
        transform="rotate(-12 545 516)"/>

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

// A history entry. The kicker is the DATE or the shape of the claim, the source
// line is not optional, and a quote is set apart from our own prose so a reader
// can always tell which words are ours.
const historyBlocks = (doc.history || [])
  .map((h) => {
    const cites = (h.src || []).map((id) => SRC.get(id));
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
          // same screen asks for 960 and gets 800, which is 1.2x. It also takes
          // roughly 80px off every history card that has one.
          sizes: "(min-width:720px) 480px, calc(100vw - 72px)",
          mod: "gpph--card",
        })}
        <p class="gph-src">Source${cites.length === 1 ? "" : "s"}: ${cites
          .map(
            (s) =>
              `<a href="${esc(cleanUrl(s.url))}" rel="noopener" target="_blank" aria-label="${esc(
                s.name,
              )}, the source for this, opens on ${esc(hostOf(s.url))}">${esc(s.name)}</a>`,
          )
          .join("; ")}. Read ${esc(longDate(doc.read) || doc.read)}.</p>
      </li>`;
  })
  .join("\n");

// A restaurant. EVERYTHING EXCEPT THE NAME AND THE LINK IS OPTIONAL AND SIMPLY
// DOES NOT RENDER WHEN MISSING, which is data/shops.json's rule and is what
// lets this page be honest about a business whose own site says less than
// another's. The one field that behaves differently is the hours: a missing
// hour prints a LINE saying it is not confirmed rather than nothing at all,
// because a silent gap reads as "no hours today" and this page would rather say
// "we could not check" out loud.
const placeCards = places
  .map((p, i) => {
    const url = cleanUrl(p.url);
    const menu = p.menuUrl ? cleanUrl(p.menuUrl) : "";
    // THE PHOTO SITS ABOVE THE HEAD AND THREE OF ELEVEN CARDS HAVE ONE, which
    // is the case the grid had to survive: `align-items:start` was already set
    // so a card is as tall as its own content, so a card with a picture is
    // simply taller than the one beside it rather than pushing a hole into it.
    // Checked at both widths with the neighbours, not assumed from the CSS.
    const shot = photoRun(`place:${p.name}`, {
      // 1 / 2 / 3 columns inside the 1392 wrap, less the card's own padding.
      sizes: "(min-width:981px) 408px, (min-width:641px) calc(50vw - 76px), calc(100vw - 72px)",
      mod: "gpph--place",
    });
    return `      <li class="gpp"${p.origin ? ' data-origin="1"' : ""}>
        ${shot}
        <div class="gpp-head">
          <p class="gpp-num" aria-hidden="true">${i + 1}</p>
          <h3>${esc(p.name)}</h3>
          ${p.origin ? `<span class="gpp-flag">The original</span>` : ""}
        </div>
        ${p.plateName ? `<p class="gpp-dish">Calls it: <b>${esc(p.plateName)}</b>${p.platePrice ? ` &bull; ${esc(p.platePrice)}` : ""}</p>` : ""}
        ${p.blurb ? `<p class="gpp-blurb">${esc(p.blurb)}</p>` : ""}
        <dl class="gpp-facts">
          ${
            p.address
              ? `<dt>Where</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  p.address,
                )}" rel="noopener" target="_blank" aria-label="${esc(p.address)}, where ${esc(
                  p.name,
                )} is, opens on google.com">${esc(p.address)}</a></dd>`
              : ""
          }
          ${p.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(p.phone.replace(/[^0-9+]/g, ""))}">${esc(p.phone)}</a></dd>` : ""}
          ${
            p.hours
              ? `<dt>Open</dt><dd>${esc(p.hours)}<span class="gpp-checked">confirmed on their own site, ${esc(
                  longDate(p.hoursRead || doc.read) || doc.read,
                )}</span></dd>`
              : `<dt>Open</dt><dd class="gpp-unknown">Not confirmed. ${esc(
                  p.hoursUnknown || "Their own site does not publish hours, and this page will not copy them off a directory.",
                )} Call before you go.</dd>`
          }
        </dl>
        ${p.note ? `<p class="gpp-note">${esc(p.note)}</p>` : ""}
        <p class="gpp-links">
          <a class="gpp-link" href="${esc(url)}" rel="noopener" target="_blank" aria-label="${esc(
            hostOf(url),
          )}, ${esc(p.name)}'s own site, opens on their site">${esc(hostOf(url))} <span aria-hidden="true">&rarr;</span></a>
          ${
            menu && menu !== url
              ? `<a class="gpp-link" href="${esc(menu)}" rel="noopener" target="_blank" aria-label="${esc(
                  p.menuLabel || "Menu",
                )} for ${esc(p.name)}, opens on ${esc(hostOf(menu))}">${esc(
                  p.menuLabel || "Menu",
                )} <span aria-hidden="true">&rarr;</span></a>`
              : ""
          }
        </p>
      </li>`;
  })
  .join("\n");

// SCHEMA. Article for the page itself, because that is what it is: a written,
// sourced piece about a dish. The restaurants are an ItemList inside it and
// NOT a set of LocalBusiness nodes, which is the same call build-shops.mjs
// makes and states in its header: these are other people's businesses and we
// are not their authority. Emitting LocalBusiness for a restaurant we do not
// own would be claiming to speak for it, and it would be claiming opening
// hours this page has gone out of its way not to claim.
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${SITE}/garbage-plate.html#article`,
      headline: "What Is a Garbage Plate? The Rochester Dish, Explained",
      description:
        "The history of the Rochester Garbage Plate, sourced, plus a diagram of what is on one and where to eat one.",
      inLanguage: "en-US",
      dateModified: doc.updated,
      about: { "@type": "Thing", name: "Garbage Plate" },
      isPartOf: { "@type": "WebSite", name: "Garbage Rips 585", url: `${SITE}/` },
      citation: (doc.sources || []).map((s) => ({
        "@type": "CreativeWork",
        name: s.name,
        url: cleanUrl(s.url),
      })),
    },
    {
      "@type": "ItemList",
      name: "Where to eat a garbage plate in Rochester, NY",
      description:
        "Restaurants around Rochester, New York whose own menus say they serve a plate. A list, not a ranking.",
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: places.length,
      itemListElement: places.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: cleanUrl(p.url),
      })),
    },
  ],
};

// Comments out of the shipped page, argument kept in this file. Same regex and
// the same trade build-shops.mjs and seven other builders make: this block is
// inline in a render blocking <head>, so every line of reasoning in it is paid
// for by every reader on a phone.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
.gp{padding:var(--s7) 0 var(--s8)}
.gp-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s5)}
.gp h2{font:400 var(--t-l)/1.1 var(--display);margin:var(--s7) 0 var(--s3)}
/* NOT PINK AND NOT TEAL, and CLAUDE.md's accent rule is explicit about why: a
   body section heading is neither, so the two accents always land on a neutral
   and never on each other. */
.gp h3{font:400 var(--t-m)/1.2 var(--display)}
.gp-sub{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}

/* ---- The diagram, and the list that labels it -------------------------- */
/* One figure, two halves. Side by side above 900px so the numbers in the
   drawing are next to the numbers in the list and the eye can go between them
   without scrolling; stacked below that, because the drawing needs the whole
   column to stay legible on a phone. */
.gp-fig{margin:0 0 var(--s6);color:var(--ink)}
.gp-fig-in{display:grid;gap:var(--s5);align-items:start}
@media(min-width:900px){.gp-fig-in{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
/* Fills its column on a desktop rather than stopping at a fixed cap, and
   centres itself in the row: the label list beside it is taller than the
   drawing, so a top-aligned drawing left 300px of empty band under it at 1440
   and made the best asset on the page look like an afterthought. */
.gpd{display:block;width:100%;height:auto;max-width:640px;margin:0 auto;align-self:center}
.gp-fig figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);
  margin-top:var(--s3);max-width:52em}
/* currentColor on the group, so every stroke in the drawing follows the page's
   ink and the figure is still correct if this block ever moves onto the dark
   chrome. The same discipline the shop map and the hours chart keep. */
.gpd-ink{stroke:#231F20;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}
.gpd-china{fill:var(--ink,#E4DCCC)}
.gpd-rim{fill:none;stroke-width:3}
.gpd-sides{fill:none;stroke-width:4.5}
.gpd-mac{fill:none;stroke:#AC9D71;stroke-width:3.4}
/* OUTLINES AND NO FILL. A darker gold chunk on a lighter gold ground is a
   difference that vanishes the moment somebody greyscales the page or
   screenshots it on a bad screen. The drawn edge is what survives. */
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
/* The callouts. Near-white disc, near-black ring and numeral, so the number
   reads whatever food it is sitting next to. 21 units at the phone's 0.56 draw
   scale is a 23px disc carrying a 15px numeral. */
.gpd-call circle{fill:#FFFDF6;stroke:#231F20;stroke-width:4}
.gpd-call line{stroke:#231F20;stroke-width:3.5}
.gpd-call text{font:700 26px var(--mono);fill:#231F20;stroke:none;text-anchor:middle}

.gp-layers{list-style:none;display:grid;gap:var(--s4)}
.gp-layers li{display:grid;grid-template-columns:auto 1fr;gap:var(--s3);align-items:start}
/* The same disc as the drawing's, in HTML, so the two are visibly one system.
   Fixed at 34px rather than sized in ems: it has to match a circle in an SVG
   that does not scale with the reader's type size.
   SELECTED AS .gp-layers .gpl-n AND THAT IS LOAD BEARING. Written as a single
   class it is (0,1,0) and the .gp-layers p rule two below is (0,1,1), so the
   later rule won and every numeral in this list took var(--ink-2) on a
   near-white disc: six invisible numbers pointing at a drawing that depends on
   them. Caught by looking at the render, not by reading the CSS, because both
   rules are individually correct. */
.gp-layers .gpl-n{flex:none;width:34px;height:34px;border-radius:50%;background:#FFFDF6;
  color:#231F20;border:3px solid #231F20;font:700 17px/28px var(--mono);text-align:center}
.gp-layers h3{margin-bottom:4px}
.gp-layers p{color:var(--ink-2);font-size:var(--t-sm);line-height:1.6}

/* ---- The photographs and their credits ---------------------------------- */
/* ONE SHAPE FOR ALL TEN, and the credit is part of it rather than a thing bolted
   under some of them. CC BY and CC BY-SA both require the photographer's name,
   the licence and a link to the licence, so the figcaption is not decoration
   and must not be dropped to save a line. There was no precedent on this site
   for a visible image credit, because the retailer marks are all public domain;
   this is it, and CLAUDE.md records it. */
.gpph{margin:0;display:block}
/* aspect-ratio comes off the width and height attributes, so the box is
   reserved before the picture arrives and nothing under it moves. The paper
   fill is what fills that box in the meantime: a transparent one flashes the
   page green through a photograph-shaped hole. */
.gpph img{display:block;width:100%;height:auto;border-radius:var(--r-sm);
  background:var(--paper)}
.gpph figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin-top:8px}
/* The credit runs on from the caption rather than sitting on its own line: it
   is the same sentence about the same picture, and a second block under a small
   photograph reads as chrome. Teal, like every other link on the page. */
.gpph-cr a{color:var(--gold-deep);font-weight:600}
.gpph-cr a:hover{text-decoration:underline}
/* The hero. Capped at 720 rather than filling the 1392 wrap, because a plate of
   food at 1392 across is a banner and this is an illustration in an article. */
.gpph--hero{max-width:720px;margin:var(--s5) 0 var(--s6)}
/* The pair under the diagram: side by side where there is room, stacked where
   there is not, and never wider than the prose column beside them. */
.gp-shots{display:grid;gap:var(--s4);max-width:52em;margin:0 0 var(--s6)}
@media(min-width:700px){.gp-shots{grid-template-columns:1fr 1fr}}
.gpph--card{margin:var(--s4) 0 0;max-width:480px}
/* THE ONLY CROP ON THE PAGE, AND IT IS A DISPLAY CROP. The three restaurant
   cards sit in one grid and their photographs are 3801x2474, 3024x3276 and
   3445x2772, so left at their own shapes they would put three different card
   heights in one row. object-fit does the framing in the browser; the file that
   ships is the whole frame, which is what keeps the CC BY-SA files out of
   "adapted work" territory. See the header of this builder. */
.gpph--place{margin:0 0 var(--s2)}
.gpph--place img{aspect-ratio:4/3;object-fit:cover}

/* ---- The history ------------------------------------------------------- */
.gp-hist{list-style:none;display:grid;gap:var(--s5);max-width:52em}
.gph{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
/* The kicker is the small pink. CLAUDE.md's measurement: #E87EA1 is 3.45:1 and
   anything under 24px takes --ketchup-deep, which is why .hl is the small one. */
.gph-when{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ketchup-deep);margin-bottom:6px}
.gph h3{margin-bottom:var(--s2)}
.gph-body{color:var(--ink-2);line-height:1.65}
/* A quote is somebody else's words and is set apart so a reader can always tell
   which sentences on this page are ours. */
.gph-q{margin:var(--s3) 0 0;padding:var(--s3) var(--s4);background:var(--paper);
  border-left:3px solid var(--mustard);border-radius:0 var(--r-sm) var(--r-sm) 0}
.gph-q p{font-size:var(--t-sm);line-height:1.6}
.gph-q p::before{content:"\\201C"}
.gph-q p::after{content:"\\201D"}
.gph-q cite{display:block;margin-top:6px;font:700 var(--t-micro)/1.5 var(--mono);
  font-style:normal;color:var(--ink-2)}
.gph-src{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin-top:var(--s3)}
.gph-src a{color:var(--gold-deep);font-weight:600}
.gph-src a:hover{text-decoration:underline}

/* ---- What is not on the page ------------------------------------------- */
.gp-gaps{list-style:none;display:grid;gap:var(--s3);max-width:52em;
  border-left:3px solid var(--keyline);padding-left:var(--s4)}
.gp-gaps li{font-size:var(--t-sm);line-height:1.6;color:var(--ink-2)}

/* ---- The restaurants ---------------------------------------------------- */
.gp-places{list-style:none;display:grid;align-items:start;
  grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:980px){.gp-places{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.gp-places{grid-template-columns:1fr}}
/* align-items:start above, so a card is as tall as its own content. Stretched
   to a common height, a restaurant whose own site says less than its neighbour
   grew a hole in the middle. That is /shops.html's measurement and its fix. */
.gpp{display:flex;flex-direction:column;gap:var(--s2);background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);box-shadow:var(--lift)}
.gpp[data-origin]{border:2px solid var(--mustard)}
.gpp-head{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.gpp-num{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
.gpp-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--mustard);color:var(--on-accent);border:1px solid var(--gold-deep);
  padding:4px 7px;border-radius:var(--r-pill)}
.gpp-dish{font-size:var(--t-sm);color:var(--ink-2)}
.gpp-dish b{color:var(--ink)}
.gpp-blurb{color:var(--ink-2);font-size:var(--t-sm);line-height:1.6}
.gpp-facts{display:grid;grid-template-columns:auto 1fr;gap:2px var(--s3);margin-top:var(--s2);
  font-size:var(--t-sm)}
.gpp-facts dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2)}
.gpp-facts dd{line-height:1.5}
.gpp-facts a{color:var(--gold-deep);font-weight:600}
.gpp-facts a:hover{text-decoration:underline}
.gpp-checked{display:block;font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2)}
/* The unconfirmed hour is LOUD on purpose. The cost of a quiet blank here is
   somebody driving across Rochester to a locked door, which is the same reason
   /shops.html shouts its league-night disagreements. */
.gpp-unknown{font:400 var(--t-micro)/1.6 var(--body);color:var(--plum)}
.gpp-note{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin-top:var(--s2);
  padding:8px 10px;background:var(--paper);border-radius:var(--r-sm)}
.gpp-links{margin-top:auto;padding-top:var(--s3);display:flex;flex-wrap:wrap;gap:var(--s4)}
.gpp-link{font:700 var(--t-sm)/1 var(--body);color:var(--gold-deep);
  min-height:44px;display:inline-flex;align-items:center}
.gpp-link:hover{text-decoration:underline}

.gp-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--mustard);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
/* The section ornament, from shared/format.mjs, same as /shops.html. Not in
   ui.css: render blocking on every page, drawn on six. */
${PLATE_CSS}
`;

const leftOut = (doc.checkedAndLeftOut || [])
  .map((g) => `      <li>${esc(g)}</li>`)
  .join("\n");

const gaps = (doc.notSourced || [])
  .map((g) => `      <li>${esc(g)}</li>`)
  .join("\n");

const sourceList = (doc.sources || [])
  .map(
    (s) =>
      `      <li><a href="${esc(cleanUrl(s.url))}" rel="noopener" target="_blank" aria-label="${esc(
        s.name,
      )}, opens on ${esc(hostOf(s.url))}">${esc(s.name)}</a>${
        s.note ? ` <span>${esc(s.note)}</span>` : ""
      }</li>`,
  )
  .join("\n");

const body = `
<main id="main" class="gp">
  <div class="wrap">
    <div class="brk"><h1>What is a <span class="hl">Garbage Plate</span>?</h1><span class="ln"></span></div>
    <p class="gp-lede">It is the dish this channel is named after, and if you have never had one, here is
      the whole thing. A Garbage Plate is two sides on the bottom, meat on top of them, a spiced meat
      sauce poured over the lot, then raw onions and mustard, with bread and butter on the side. It comes
      from one restaurant in Rochester, New York, it has a federal trademark, and that trademark is why
      everywhere else in this city sells you a trash plate instead. Nobody eats one with a plan.</p>
    <p class="gp-lede">Everything on this page names where it came from and the day it was read, which is
      how the rest of this site handles a price and is the only honest way to handle a history. Where we
      could not source something, it is not here, and there is a list further down of exactly what that
      means.</p>

    ${photoRun("hero", { sizes: "(min-width:800px) 720px, calc(100vw - 32px)", mod: "gpph--hero" })}

    <h2>What is actually <span class="hl">on one</span></h2>
    <p class="gp-sub">${esc(doc.anatomy?.intro || "")}</p>
    <figure class="gp-fig">
      <div class="gp-fig-in">
        ${plateDiagram()}
        <ol class="gp-layers">
${layerList}
        </ol>
      </div>
      <figcaption>Drawn rather than photographed, because a drawing can be cut open and labelled and a
        photograph cannot. The order is bottom to top and it matters: the sauce goes over everything,
        which is what makes it a plate and not a tray of sides. ${esc(doc.anatomy?.srcNote || "")}</figcaption>
    </figure>

    <div class="gp-shots">
      ${photoRun("anatomy", {
        // Two up above 700px inside a 52em column, one up below it.
        sizes: "(min-width:700px) 340px, calc(100vw - 32px)",
      })}
    </div>

    <h2>Where it <span class="hl">came from</span></h2>
    <p class="gp-sub">Told in the order it happened, with the source for every claim on the claim itself.
      Two of these are primary: a federal trademark file, and the restaurant's own order form.</p>
    <ol class="gp-hist">
${historyBlocks}
    </ol>

    <h2>What this page <span class="hl">does not know</span></h2>
    <p class="gp-sub">A short sourced history beats a long plausible one. These are the things that get
      repeated about the Garbage Plate that could not be sourced on ${esc(
        longDate(doc.read) || doc.read,
      )}, so they are not stated above. They are written down here rather than left out silently, so
      nobody has to research them twice.</p>
    <ul class="gp-gaps">
${gaps}
    </ul>

${plateRule()}

    <h2>Where to <span class="hl">eat one</span></h2>
    <p class="gp-sub">${esc(doc.listNote || "")}</p>
    <p class="gp-sub">${esc(doc.listRule || "")}</p>
    <ol class="gp-places">
${placeCards}
    </ol>
    <p class="gp-sub" style="margin-top:var(--s5)">Addresses and links were checked on
      ${esc(longDate(doc.updated) || doc.updated)}. Opening hours are only printed where the
      restaurant states them on its own site, and every other card says so instead of guessing.
      Restaurants move, change hands and change their hours, so call before you make a trip of it.</p>

    <h3 style="margin-top:var(--s6)">Places we checked and left off</h3>
    <p class="gp-sub">Every one of these turns up on somebody's list of the best plates in Rochester.
      None of them could be confirmed from the business itself, so none of them are above. They are
      written down here so nobody researches them again, and so you know the list is short on purpose.</p>
    <ul class="gp-gaps">
${leftOut}
    </ul>

    <h2>Every <span class="hl">source</span> on this page</h2>
    <p class="gp-sub">All of them were read on ${esc(longDate(doc.read) || doc.read)}.</p>
    <ul class="gp-gaps">
${sourceList}
    </ul>

    <h3 style="margin-top:var(--s6)">Where the photographs came from</h3>
    <p class="gp-sub">${esc(doc.photoNote || "")}</p>
    <ul class="gp-gaps">
${
  // `placeNote` FIRST, and it is printed rather than kept in the data as a
  // comment for maintainers. Two of the pictures are attached to a restaurant
  // on the strength of what the PHOTOGRAPHER wrote about their own file, and
  // one of those files is titled with a dish name the restaurant's own menu
  // does not use. On a page whose entire pitch is that its claims are
  // checkable, the working behind "this photograph is of that restaurant"
  // belongs on the page like every other source line. An unrendered field is
  // also how a data file quietly fills with notes nobody reads.
  PHOTOS.filter((x) => x.placeNote)
    .map((x) => `      <li>${esc(x.placeNote)}</li>`)
    .concat((doc.photosRejected || []).map((g) => `      <li>${esc(g)}</li>`))
    .join("\n")
}
    </ul>

    <p class="gp-sub" style="margin-top:var(--s6)">Hungry for the other local pages? The
      <a href="/shops.html">card shops around Rochester</a> are where this channel actually buys, the
      <a href="/card-shows.html">card show calendar</a> has everything coming up around Rochester,
      Buffalo and Syracuse, and <a href="/about.html">about the channel</a> explains what Garbage Rips
      585 is and why it is named after dinner.</p>

    <p class="gp-note">NOT SPONSORED AND NOT AFFILIATE LINKS. NOBODY PAID TO BE ON THIS PAGE.
      IF YOU RUN A PLACE AROUND ROCHESTER THAT SERVES A PLATE AND YOU ARE NOT ON HERE, SAY HELLO ON ANY
      OF THE SOCIALS.</p>
  </div>
</main>`;

// Share the home page's shell so this page cannot drift from the design. Same
// slicing, same four landmarks, as build-shops.mjs.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf("</header>") + "</header>".length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

// THE TITLE FRONT-LOADS THE THING PEOPLE ACTUALLY TYPE. "what is a garbage
// plate" is the query, so it is the first four words, and "Rochester NY" is the
// disambiguator that has to survive the ~580px cut Google renders at. No
// "| Garbage Rips 585" suffix, per the standing rule: og:site_name carries the
// brand and a suffix that gets cut off adds nothing.
//
// THE META DESCRIPTION LEADS WITH THE MOST CLICKABLE TRUE FACT rather than
// summarising the page, which is the one real CTR idea CLAUDE.md records and
// has never had a page small enough to try it on. The trademark dates are the
// most surprising true thing here and they are checkable, which is the pitch.
const swapped = head
  .replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>What Is a Garbage Plate? Rochester's Dish, and Where to Eat One</title>`,
  )
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="GARBAGE PLATE has been a federal trademark since 18 August 1992, which is why everywhere else in Rochester sells a trash plate. A sourced history of the dish, a labelled diagram of what is on one, and ${places.length} places around Rochester, NY that serve it.">`,
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/garbage-plate.html">`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/garbage-plate.html`)
  .replace(
    /(<meta property="og:title" content=")[^"]*/,
    `$1What Is a Garbage Plate? Rochester's Dish, Explained`,
  );

const html = `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${miniCSS(style)}</style>
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

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/garbage-plate.html"), html);

console.log(
  `Wrote public/garbage-plate.html  (${(doc.history || []).length} sourced history entries, ` +
    `${(doc.anatomy?.layers || []).length} labelled layers, ${places.length} place${
      places.length === 1 ? "" : "s"
    })`,
);
const withHours = places.filter((p) => p.hours).length;
console.log(`  hours confirmed on ${withHours} of ${places.length}; the rest say so on the card`);
for (const p of places.filter((x) => cleanUrl(x.url) !== x.url)) {
  console.log(`  cleaned tracking parameters off ${p.name}:\n    ${cleanUrl(p.url)}`);
}
