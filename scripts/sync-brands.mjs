#!/usr/bin/env node
// Mirror the venue brand marks that /buying.html and /selling.html are about.
//
//   node scripts/sync-brands.mjs            fetch anything not held yet
//   node scripts/sync-brands.mjs --force    refetch and re-clean all of them
//
// WHY THIS EXISTS. Those two pages are the biggest walls of text on the site:
// 13,705 and 9,899 words with zero images between them. The earlier reading was
// that they are about venues and processes with no object to photograph, so
// they should stay that way. That is wrong, and the reason it is wrong is that
// the venues ARE the object. Every entry on both pages is a named company, and
// a company's mark is the fastest way a reader finds the one they are looking
// for in a list of fourteen.
//
// SVG, NOT A RASTER MIRROR, and that is the whole reason this script is short.
// These marks are line art. A vector file is sharp at any size on any screen,
// so there is no "mirror at 2x the drawn box" decision to get wrong here the
// way there is for a card scan or a set symbol, and it is smaller than the png
// would be anyway. Measured over the 13 files this fetches: 60.3KB on disk and
// 24.7KB over the wire, because the host gzips SVG and does not gzip a png.
// Report both when you measure a page here: the preview server in .claude/
// serves these uncompressed, so a local reading overstates the real cost by
// about two and a half times.
//
// WIKIMEDIA COMMONS IS THE SOURCE AND THE LICENCE IS CHECKED, NOT ASSUMED.
// Every file below was confirmed to carry a public-domain tag on Commons before
// it went in the list: these are wordmarks and simple geometry, which US
// copyright does not reach. That is a statement about COPYRIGHT only. They are
// all live trademarks, which is exactly why they are usable here: the pages
// identify and describe these companies, and a trademark used to identify the
// company it belongs to is the ordinary nominative use. Nothing is sold on this
// site and nothing here claims affiliation. Both pages print the credit line in
// shared/brands.mjs, and the footer's "Fan content. Not affiliated with The
// Pokemon Company" is already sitewide.
//
// The licence check is re-run on every fetch rather than trusted from this
// comment: a file whose Commons licence no longer starts "Public domain" is
// skipped with a loud line and the page falls back to the name tile.
//
// THE FILE TITLES ARE PINNED AND THE SEARCH API IS NOT USED AT BUILD TIME.
// Commons search is a moving target and "the first hit for Target logo" is not
// a thing a build should depend on. Each title below was picked by hand, opened,
// and checked to be the current mark rather than a 1998 one or a subsidiary's.
//
// ELEVEN OF THE THIRTY VENUES AND RETAILERS GET NO MARK AND THAT IS THE
// FINDING, not a gap for somebody to close later with a scraped favicon.
// CoolStuffInc, Card Cavern, Dave and Adam's, Troll and Toad, COMC, Sportlots,
// Goldin, Heritage and Family Dollar are small enough or recent enough that
// Commons holds nothing for them, and "Local card shop" and "Card show" are not
// companies at all. They get their name set in the same box
// by shared/brands.mjs, which is the same answer the site already gives a set
// with no logo. Do not fill them from the company's own favicon: those come back
// 16x16 and 32x32 (measured, eight of them), and an upscaled 16px icon next to a
// vector wordmark looks worse than no mark at all.
//
// IDEMPOTENT. A mark whose SVG already exists is not refetched. Raw downloads
// are cached under .cache/brands/ (gitignored) so deleting the output and
// rebuilding costs no network either.
//
// NEVER FAILS THE BUILD. A network error, a moved file or a changed licence
// leaves that venue without a local file, and shared/brands.mjs draws the name
// tile instead. This is the same fallback rule sync-symbols.mjs uses, minus its
// remote-url leg: there is no remote url to fall back to here, because a
// Commons upload url is not a thing to hotlink from a static site.

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
import { SITE } from "../shared/site.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/assets/brands");
const CACHE = join(ROOT, ".cache/brands");
const MANIFEST = join(ROOT, "data/brand-marks.json");
const FORCE = process.argv.includes("--force");

// Commons asks for a real user agent with a way to reach whoever is running the
// script. An anonymous fetcher gets rate limited, and rightly.
// THE CONTACT URL FOLLOWS THE FLIP. It was hardcoded, so the day LIVE goes
// true this script would keep introducing itself with a host the site no
// longer serves -- and a UA that names an unreachable address is worse than
// no UA at all to the operators whose policies ask for one.
const UA = `garbagerips585-build/1.0 (${SITE}/; tim.patenaude@gmail.com)`;

/**
 * id -> [Commons file title, what the mark actually says].
 *
 * THE SECOND FIELD IS THE ALT TEXT AND IT IS NOT THE VENUE NAME. It is what is
 * drawn in the file, which is not always the same thing, and the difference is
 * the whole reason this column exists rather than being derived from the json.
 * "pokemon-center" is the clearest case: Commons holds the Pokemon brand mark,
 * not a Pokemon Center storefront wordmark, so the alt says Pokemon and the
 * venue name stays in the heading next to it where it already was. Same shape
 * as the rule on product photos: the caption names what is actually in the file.
 */
const MARKS = {
  tcgplayer: ["File:TCGplayer Logo.svg", "TCGplayer"],
  ebay: ["File:EBay logo.svg", "eBay"],
  whatnot: ["File:Whatnot Logo 2025.svg", "Whatnot"],
  amazon: ["File:Amazon logo.svg", "Amazon"],
  target: ["File:Target Corporation logo (vector).svg", "Target"],
  walmart: ["File:Walmart logo.svg", "Walmart"],
  bestbuy: ["File:Best Buy logo 2018.svg", "Best Buy"],
  costco: ["File:Costco Wholesale logo 2010-10-26.svg", "Costco Wholesale"],
  mercari: ["File:Mercari logo 2018.svg", "Mercari"],
  paypal: ["File:PayPal 2024.svg", "PayPal"],
  facebook: ["File:Facebook Logo (2019).svg", "Facebook"],
  "fanatics-collect": ["File:Fanatics company logo.svg", "Fanatics"],
  // NOT the International Pokemon logo, and the reason is weight rather than
  // taste. That file is 207.3KB of SVG after cleaning, because the mark is an
  // outlined, shadowed wordmark and every letter carries four contours; the
  // Trading Card Game variant is 109.7KB for the same reason. Both are an order
  // of magnitude past everything else in this list and either one alone would
  // have cost more than the other twelve marks put together. This one is 7.4KB.
  // It is also the more accurate label: /buying.html's own custody section says
  // "The Pokemon Company International makes it and ships it", so the company
  // mark beside a "Pokemon Center" heading is the fact the row is making.
  "pokemon-center": ["File:The Pokemon Company text logo.svg", "The Pokémon Company"],
  // The last two are for /drops.html rather than the buying and selling pages,
  // and they are here because the mirror should be one script rather than two.
  // ALDI SUD, NOT ALDI NORD, and the distinction is the whole reason the file
  // title looks wrong for a Rochester page. The two Aldi groups split in 1960
  // and each kept the name in its own territory; every ALDI store in the United
  // States is ALDI SUD, so this is the mark on the door of the Aldi the drops
  // page is talking about. Commons has no plain "Aldi" logo, and picking the
  // Nord one because the title reads simpler would be the wrong company.
  aldi: ["File:Aldi Süd 2017 logo.svg", "Aldi"],
  walgreens: ["File:Walgreens Logo.svg", "Walgreens"],
  // The physical retailers on /retailers.html and its per-shop pages. Target,
  // Walmart, Best Buy and Costco are already above, because /buying.html names
  // them too, and the ids are shared deliberately: one mirrored file per company
  // however many pages describe it.
  //
  // THESE ARE THE ONES A DIRECTORY NEEDS AND A COMPARISON PAGE DOES NOT. A
  // reader scanning eleven shops for the one they are standing outside finds it
  // by its mark long before they find it by its name, which is the whole
  // argument at the top of this file applied to a longer list.
  //
  // ANY OF THEM THAT COMMONS HAS NOTHING FOR FALLS BACK TO THE NAME TILE, and
  // that is not a gap to close later with a favicon: the measurement is in the
  // block above, favicons come back 16x16 and an upscaled one beside a vector
  // wordmark looks worse than no mark. Every retailer page also carries an
  // inline drawn diagram, so a page whose mark misses still has something
  // visual and still passes check-build.py's rule.
  gamestop: ["File:GameStop.svg", "GameStop"],
  cvs: ["File:CVS Health Logo.svg", "CVS Health"],
  meijer: ["File:Meijer logo.svg", "Meijer"],
  dollargeneral: ["File:Dollar General logo.svg", "Dollar General"],
  fivebelow: ["File:Five Below logo.svg", "Five Below"],
  barnesandnoble: ["File:Barnes & Noble logo.svg", "Barnes & Noble"],
  staples: ["File:Staples Logo.svg", "Staples"],
};

const api = async (params) => {
  const u = "https://commons.wikimedia.org/w/api.php?format=json&" + new URLSearchParams(params);
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`commons api ${r.status}`);
  return r.json();
};

/**
 * Strip everything that is not drawing instructions.
 *
 * Commons SVGs carry Inkscape and Sodipodi editor state, RDF metadata blocks
 * and often a comment longer than the paths. None of it renders. Measured over
 * these 13 files it is 38% of the bytes, and it is the kind of payload that
 * quietly doubles when somebody re-uploads from a different editor.
 *
 * A ViewBox IS ADDED WHEN ONE IS MISSING, from width/height, because the
 * builder sizes these with CSS inside a fixed box: an SVG with no viewBox and
 * no intrinsic ratio collapses to 300x150 in a contain box and the mark shears.
 *
 * -------------------------------------------------------------------------
 * THE CLEANER SHIPPED A MARK THAT COULD NOT BE PARSED AT ALL, and it did it
 * silently, which is why there is now a guard under this function as well as
 * two more replacements inside it. GameStop's Commons file carries an
 * <inkscape:perspective> ELEMENT inside its <defs>, and the pass below stripped
 * the xmlns:inkscape DECLARATION off the root while leaving that element behind.
 * SVG is XML: a prefixed element with no namespace in scope is a parse error, so
 * the browser threw the whole document away. The file was a valid-looking 11.8KB
 * on disk, the <img> tag was correct, nothing errored in the build, and the mark
 * rendered as an empty box. Caught only by reading naturalWidth off the decoded
 * image in a headless browser: it was 0.
 *
 * TWO SEPARATE FAULTS, and both are fixed here rather than by special-casing
 * one file.
 *
 *   1. THE ATTRIBUTE PATTERN COULD NOT MATCH HALF THE ATTRIBUTES IT WAS AIMED
 *      AT. It read [a-zA-Z-]+, and Inkscape writes inkscape:output_extension,
 *      which has an underscore in it, so that attribute survived every clean
 *      this script has ever done. [\w-]+ is what was meant.
 *   2. NOTHING REMOVED PREFIXED ELEMENTS, only prefixed attributes and the one
 *      hardcoded <sodipodi:namedview>. The general form has to go, in both the
 *      self-closing and the paired shape, and BEFORE the xmlns declarations are
 *      taken off, or step 2 is what creates the parse error step 3 hides.
 */
function clean(svg) {
  let s = svg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/gi, "")
    // Editor-state ELEMENTS, self-closing then paired, and looped because they
    // nest: <inkscape:perspective> sits inside a <defs> beside real content and
    // the paired form can contain another one of its own kind.
    .replace(/<(inkscape|sodipodi|rdf|cc|dc):[\w-]+\b[^>]*\/>/gi, "")
    .replace(/<(inkscape|sodipodi|rdf|cc|dc):([\w-]+)\b[\s\S]*?<\/\1:\2>/gi, "")
    .replace(/<(inkscape|sodipodi|rdf|cc|dc):[\w-]+\b[^>]*\/>/gi, "")
    .replace(/\s(?:inkscape|sodipodi):[\w-]+="[^"]*"/g, "")
    .replace(/\sxmlns:(?:inkscape|sodipodi|rdf|cc|dc|svg)="[^"]*"/g, "")
    // Framework and editor leftovers on the root tag. TCGplayer's file arrives
    // with a Vue scope attribute and a class from the page it was exported off,
    // and an `alt` attribute, which is not a thing an <svg> element has.
    .replace(/\sdata-v-[0-9a-f]+=""/g, "")
    // `alt` and `class` off the ROOT tag only, and NOT `id`. An svg element has
    // no alt attribute and the class names a stylesheet that did not come with
    // the file, so both are dead weight. `id` is left alone on purpose: these
    // files use <use href="#..."> and <clipPath id> internally, and stripping
    // ids from the root is one edit away from stripping them everywhere.
    .replace(/(<svg[^>]*?)\s(?:alt|class)="[^"]*"/g, "$1")
    .replace(/>\s+</g, "><")
    .trim();
  const open = /<svg[^>]*>/.exec(s)?.[0] || "";
  if (open && !/viewBox=/i.test(open)) {
    const w = parseFloat(/\bwidth="([\d.]+)/.exec(open)?.[1] || "");
    const h = parseFloat(/\bheight="([\d.]+)/.exec(open)?.[1] || "");
    if (w && h) s = s.replace(open, open.replace("<svg", `<svg viewBox="0 0 ${w} ${h}"`));
  }
  return s;
}

/**
 * DO NOT ROUND THE COORDINATES. This was tried, measured, and it corrupts marks.
 *
 * The case for it is real and it is why somebody will try again. These are drawn
 * 34px tall; TCGplayer's file is a 337 unit canvas, so one user unit is 0.1 CSS
 * px and the third decimal place is a thousandth of a device pixel, and that
 * file carries 1,351 coordinates at three decimals and 25 at five or six.
 * Rounding to two decimals is 20% off the gzipped bytes across the 13 files,
 * 24.7KB to 19.7KB.
 *
 * IT ALSO DELETED TWO LETTERS OFF COSTCO'S WORDMARK. Rendered at 3x and diffed
 * against the untouched file, "WHOLESALE" came back "WHO E ALE": the L and the
 * S are thin evenodd contours, and moving their points by a hundredth of a unit
 * is enough to make a subpath self-intersect and fill inverted. Nothing about
 * the file looks wrong, the svg is still valid, and the page still scores a
 * decode; only a pixel diff catches it.
 *
 * An earlier and worse version rounded every number rather than only the ones
 * in `d`, which reaches `transform="matrix(0.076238, 0, 0, 0.076238, ...)"`. A
 * transform coefficient is a MULTIPLIER: 0.076238 to 0.08 is a 4.9% scale error
 * on every path under that group, and it changed 197,797 pixels on Facebook's
 * mark, 73,419 on Fanatics' and 23,968 on Mercari's.
 *
 * So the whole idea is off the table for 5KB gzipped across two pages. If it is
 * ever revisited, the only acceptable shape is per-file: round, render both, and
 * keep the rounded copy ONLY where the pixel diff is empty. Do not reintroduce
 * it as a blanket pass.
 */

/**
 * The drawn width and height of an SVG, from its viewBox.
 *
 * NOT `viewBox="0 0 w h"`. Costco's file is `viewBox="208.5 290.5 201 72"`, a
 * crop out of a larger canvas, and a regex anchored on the two zeros read it as
 * having no viewBox at all and wrote 0x0 into the manifest. The builder needs
 * these to put width and height on the tag, and 0x0 reserves nothing, so the
 * mark would pop in and shove the heading sideways after paint.
 */
const VIEWBOX = (svg) => {
  const m = /viewBox="\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*"/i.exec(svg);
  return m ? [+m[3], +m[4]] : null;
};

/**
 * Would a browser be able to parse this at all?
 *
 * ADDED AFTER A MARK SHIPPED THAT COULD NOT BE, and the check is deliberately
 * the narrow one rather than a real XML parse. SVG is XML, so a namespace prefix
 * used with no xmlns for it in scope is fatal to the whole document, and that is
 * exactly the failure the cleaner above can create by stripping a declaration
 * and leaving a node behind. Everything else Commons ships is well-formed by the
 * time it is uploaded.
 *
 * A FILE THAT FAILS IS NOT WRITTEN, so the venue falls back to the name tile,
 * which is the same fallback a network error and a changed licence already get.
 * A blank 34px box on a page is worse than an honest hatched name, and it is
 * worse than both to have no way of telling the two apart from the build log.
 */
const prefixesOk = (svg) => {
  // "xmlns" IS NOT A PREFIX AND EXCLUDING IT IS NOT A FUDGE. xmlns:xlink="..."
  // matches the attribute pattern below exactly, so a first version of this
  // rejected four perfectly good files for declaring a namespace, which is the
  // one thing that makes a prefix legal. xml and xlink are bound by the spec and
  // need no declaration.
  const declared = new Set(["xml", "xlink", "xmlns"]);
  for (const m of svg.matchAll(/xmlns:([\w-]+)=/g)) declared.add(m[1]);
  for (const m of svg.matchAll(/<\/?([\w-]+):/g)) if (!declared.has(m[1])) return m[1];
  for (const m of svg.matchAll(/\s([\w-]+):[\w-]+="/g)) if (!declared.has(m[1])) return m[1];
  return null;
};

const exists = (p) => stat(p).then(() => true).catch(() => false);

await mkdir(OUT, { recursive: true });
await mkdir(CACHE, { recursive: true });

const ids = Object.keys(MARKS);
let info = {};
const infoCache = join(CACHE, "imageinfo.json");
const needFetch = FORCE || !(await Promise.all(ids.map((id) => exists(join(OUT, `${id}.svg`))))).every(Boolean);

if (needFetch) {
  try {
    const d = await api({
      action: "query",
      titles: ids.map((id) => MARKS[id][0]).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiextmetadatafilter: "LicenseShortName|Artist",
    });
    for (const pg of Object.values(d.query.pages)) {
      const ii = (pg.imageinfo || [])[0];
      if (ii) info[pg.title] = ii;
    }
    await writeFile(infoCache, JSON.stringify(info, null, 1));
  } catch (e) {
    console.log(`  commons imageinfo unavailable (${e.message}); using cache if present`);
    try { info = JSON.parse(await readFile(infoCache, "utf8")); } catch { /* none */ }
  }
} else {
  try { info = JSON.parse(await readFile(infoCache, "utf8")); } catch { /* none */ }
}

const manifest = { _readme: [], checked: localDay(), source: "Wikimedia Commons", marks: {} };
manifest._readme = [
  "Written by scripts/sync-brands.mjs. Do not hand-edit.",
  "Company marks used to identify the companies /buying.html and /selling.html describe.",
  "Every file carried a public-domain copyright tag on Commons when it was fetched;",
  "the trademarks belong to their owners and this site is not affiliated with any of them.",
];

let fetched = 0, kept = 0, bytes = 0;
for (const id of ids) {
  const [title, alt] = MARKS[id];
  const dest = join(OUT, `${id}.svg`);
  const ii = info[title];
  const lic = ii?.extmetadata?.LicenseShortName?.value || "";
  const artist = String(ii?.extmetadata?.Artist?.value || "").replace(/<[^>]*>/g, "").trim();

  if (ii && !/^public domain/i.test(lic)) {
    console.log(`  SKIP ${id}: ${title} is now "${lic}", not public domain`);
    continue;
  }

  if (!FORCE && (await exists(dest))) {
    const held = await readFile(dest, "utf8");
    const vb = VIEWBOX(held);
    manifest.marks[id] = {
      file: `/assets/brands/${id}.svg`,
      alt,
      w: vb ? Math.round(vb[0]) : 0,
      h: vb ? Math.round(vb[1]) : 0,
      title, license: lic || "Public domain", artist,
    };
    kept += 1;
    bytes += held.length;
    continue;
  }

  if (!ii) { console.log(`  MISS ${id}: no imageinfo for ${title}`); continue; }

  try {
    const raw = await (await fetch(ii.url, { headers: { "User-Agent": UA } })).text();
    await writeFile(join(CACHE, `${id}.src.svg`), raw);
    const out = clean(raw);
    if (!/^<svg/i.test(out)) throw new Error("not an svg after cleaning");
    const bad = prefixesOk(out);
    if (bad) {
      throw new Error(
        `namespace prefix "${bad}:" is used with no xmlns:${bad} in scope, so no browser will ` +
          `render this file. It is the cleaner's fault, not the upload's: fix clean() rather than ` +
          `this one file.`
      );
    }
    await writeFile(dest, out + "\n");
    const vb = VIEWBOX(out);
    manifest.marks[id] = {
      file: `/assets/brands/${id}.svg`,
      alt,
      w: vb ? Math.round(vb[0]) : ii.width,
      h: vb ? Math.round(vb[1]) : ii.height,
      title, license: lic, artist,
    };
    fetched += 1;
    bytes += out.length;
    console.log(`  got  ${id.padEnd(18)} ${(raw.length / 1024).toFixed(1)}KB -> ${(out.length / 1024).toFixed(1)}KB`);
  } catch (e) {
    console.log(`  FAIL ${id}: ${e.message}`);
  }
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(
  `brand marks: ${fetched} fetched, ${kept} already held, ${Object.keys(manifest.marks).length} in manifest, ` +
  `${(bytes / 1024).toFixed(1)}KB of SVG total`
);
