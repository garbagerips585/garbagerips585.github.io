// The app-listing artwork, rendered. Shared by /tcg-live.html and /tcg-pocket.html.
//
// The files and the manifest are written by scripts/sync-app-shots.mjs, which is
// where the argument for using them at all lives, along with the note about the
// one screenshot that is deliberately excluded. This module is only the markup.
//
// ONE HELPER FOR TWO PAGES because the two pages are the same shape: an icon in
// the section that tells you to go and install it, and a strip of three shots in
// the section that describes what the thing looks like. Writing it twice is how
// the two drift, and the pair of them already argue with each other on purpose.
//
// A CAPTION NAMES THE FILES UNDER IT, in order, left to right. That is the site
// rule and it does real work here: the strip is three specific screenshots off
// one listing, not an impression of an app, and a reader can check every clause
// of the caption against the picture above it.
//
// THE CAPTION IS SHORT AND THE ALT TEXT IS NOT, which is a budget decision as
// well as an accessibility one. Both pages hold a hard per-section word count,
// so a long caption is paid for out of the argument; alt text is an attribute
// and costs a sighted reader nothing. So the caption carries `brief` and the
// alt carries `shows`, and both come from the manifest, where each was written
// after opening that exact file. The publisher credit lives in one line of the
// page's small print rather than in every caption.
//
// NOTHING HERE MAY DESCRIBE ODDS. Alt text and captions are prose and the site's
// rule against stating pull rates, drop rates or offering rates covers them
// exactly as it covers a paragraph. See the forbidden blocks in
// data/tcg-live.json and data/tcg-pocket.json.
//
// FALLS BACK TO THE REMOTE URL when a local file is missing, decided here at
// build time rather than with onerror, because onerror never fires for a lazy
// image below the fold. A shot with neither is dropped rather than emitted
// broken.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const APP_SHOTS = JSON.parse(
  await readFile(join(ROOT, "data/app-shots.json"), "utf8")
);

/** Local file if it is on disk, otherwise the listing url it was mirrored from. */
const src = (o) => (o && o.file ? `/assets/apps/${o.file}` : o && o.remote) || "";

/**
 * Width and height, and only when they are known.
 *
 * The manifest carries the DECODED size of the mirrored file rather than the
 * size that was requested, the way data/symbol-dims.json does, because a
 * bounding box is a bound and not a shape. A remote fallback gets nothing:
 * Apple's thumb service letterboxes to fit, so the url's own numbers are the
 * box and not necessarily the pixels, and a wrong pair is worse than none.
 */
const dims = (o) => (o && o.file && o.w && o.h ? ` width="${o.w}" height="${o.h}"` : "");

/**
 * The app icon, inline, with the app's name beside it.
 *
 * This is the single most useful picture either page can carry: the reader is
 * about to go and search a store, and the icon is what they are searching for.
 */
export function appIcon(key, note) {
  const app = APP_SHOTS.apps[key];
  if (!app || !app.icon) return "";
  const url = src(app.icon);
  if (!url) return "";
  return `<p class="ap-id">
          <img src="${esc(url)}"${dims(app.icon)} alt="The ${esc(app.name)} app icon"
               loading="lazy" decoding="async">
          <span><b>${esc(app.listedAs)}</b>${esc(note)}</span>
        </p>`;
}

/**
 * Three screenshots in a row, captioned in the order they appear.
 *
 * The row is a three column grid capped at 420px, so each shot draws about
 * 114px wide on a 390px phone and 132px at the cap. The mirrored files are 264
 * wide, which covers the cap at DPR2 and is the number sync-app-shots.mjs
 * fetched them at. Do not widen the cap without changing SHOT_W there and
 * re-running with --force, or the strip goes soft on a retina screen.
 */
export function appStrip(key, lead) {
  const app = APP_SHOTS.apps[key];
  if (!app) return "";
  const shots = app.shots.filter((s) => src(s));
  if (!shots.length) return "";
  const imgs = shots
    .map(
      (s) => `<img src="${esc(src(s))}"${dims(s)} alt="${esc(app.listedAs)}: ${esc(s.shows)}"
              loading="lazy" decoding="async">`
    )
    .join("\n            ");
  const list = shots.map((s) => esc(s.brief || s.shows)).join(", ");
  return `<figure class="ap-strip">
          <div class="ap-row">
            ${imgs}
          </div>
          <figcaption>${esc(app.listedAs)}'s own App Store screenshots. ${esc(
            lead
          )} Left to right: ${list}.</figcaption>
        </figure>`;
}

/** One line of credit, the way the set guides say "Product photos are TCGplayer's." */
export function appCredit(key) {
  const app = APP_SHOTS.apps[key];
  if (!app) return "";
  return `The app icon and the screenshots on this page are from ${esc(
    app.listedAs
  )}'s own App Store listing, published by ${esc(app.seller)}, mirrored here at the size they are drawn.`;
}

/**
 * Styles for both, to be dropped into each page's own style block.
 *
 * Not in ui.css: these two pages are the only users, ui.css is render blocking
 * on all 426 pages, and both builders already carry their own block.
 */
export const APP_SHOT_CSS = `
.ap-id{display:flex;gap:var(--s3);align-items:center;margin:var(--s4) 0 0;max-width:44em}
.ap-id img{flex:none;width:56px;height:56px;border-radius:13px;display:block;
  border:1px solid var(--hair);background:var(--card)}
.ap-id span{font-size:var(--t-sm);line-height:1.5;color:var(--ink-2);min-width:0}
.ap-id b{display:block;color:var(--ink);font-weight:700}
.ap-strip{margin:var(--s4) 0 0;max-width:44em}
/* Three columns at every width. The shots are portrait phone captures, so a
   stack would run a third of a page tall on the device this site is built for
   first, and the point of a strip is that you take all three in at once. */
.ap-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:420px}
.ap-row img{width:100%;height:auto;display:block;border:1px solid var(--hair);
  border-radius:8px;background:var(--card)}
.ap-strip figcaption{margin-top:var(--s2);font-size:var(--t-micro);color:var(--ink-2);line-height:1.5;
  max-width:44em}`;
