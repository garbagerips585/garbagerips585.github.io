#!/usr/bin/env node
// Generate a page per YouTube playlist, under public/playlists/.
//
//   node scripts/build-playlists.mjs
//
// WHY THIS EXISTS. /playlists.html rendered 22 cards whose only action was a
// link to youtube.com, on a site whose first rule is that every click stays
// here. That was a real exception, not an oversight, and the argument for it
// was that a playlist is a YouTube object: an ordered, curated run, and
// watching one in order is something YouTube does and this site did not.
//
// It does now. Every video in every playlist already has a page here, so the
// run can be shown in its own order, with the packs, and each one plays in
// place exactly as it does on the home page. The only outbound link left on
// the site is Subscribe.
//
// THE TILES ARE THE SAME COMPONENT the library and the home page use: the same
// `.v` / `.art` / `.pack` markup app.js builds in makeCard, written server side
// here. That matters twice over. It means these pages need no JavaScript to
// show their content, and it means packplayer.js picks the tiles up for free,
// because it binds to any anchor pointing at /rip/ that contains a pack.
//
// ORDER IS THE PLAYLIST'S OWN. videoIds arrives in the order the owner arranged on
// YouTube, and that order is the whole point of a playlist, so it is not
// re-sorted by date or by anything else.

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { slugify } from "../shared/paths.mjs";
import { esc, longDate, shortDate, viewCount, imgDims, productSrcsetAttr, packTileImg, noWidowEmoji, RIP_BANNER, clipMeta, plainDashes} from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/playlists");

const doc = JSON.parse(await readFile(join(ROOT, "public/data/playlists.json"), "utf8"));
const { playlists } = doc;
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const byId = new Map(videos.map((v) => [v.id, v]));

// ============================================================================
// WHAT A PLAYLIST PAGE IS A PICTURE OF.
//
// These were the only pages on the site with no <img> at all. Twenty-one of
// them, 340 to 1,270 words each, and the identity of every one is carried by a
// title and nothing else: "Pokemon Chaos Rising ETB Opening Series" over a grid
// of wrappers the site drew itself. The tiles are lovely and they are the same
// green-and-gold shape on every page, so a reader landing here from search sees
// a page that could be about any set and any product.
//
// A playlist is a RUN OF ONE THING, and that is exactly what makes the two
// pictures possible. Nineteen of the twenty-one cover a single set, and twelve
// of those cover a single product type as well, so the page can show the set's
// own logo and a photograph of the actual product being opened. Between them
// they answer "what is this" and "what is being opened" without a sentence.
//
// BOTH ARE GATED ON BEING SURE, and where it is not sure the page shows nothing
// rather than something close enough. A playlist spanning two sets gets no logo. A
// playlist spanning two product types gets no photo. And the photo is only ever
// the product whose NAME is printed under it, looked up in the same
// public/data/products.json the set guides price from, never a stand-in from
// another set: "a photo of one set's product standing in for a product type
// names that set" is the one caption error that would matter here.
// ============================================================================

let LOGO_DIMS = {};
try {
  LOGO_DIMS = JSON.parse(await readFile(join(ROOT, "data/logo-dims.json"), "utf8"));
} catch {
  /* written by scripts/build-logos.py, which measures as it resizes.
     There is no measure-logos.py: it was named in five comments and had
     never been in the tree, which is how five logos came to have no
     dimensions and therefore no srcset at all. */
}
const logosOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/logos")).catch(() => []))
    .map((f) => /^(.+)-pokemon-tcg-set-logo\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
/* Which sets build-packs.py has actually rendered artwork for. Read off the
   directory rather than listed here for the same reason logosOnDisk is: a
   typed list is a list that goes stale the next time a master lands. Matched on
   the MASTER rendition only, so the -tile and -mid siblings do not each add a
   bogus id; nothing looks those up, but a set called
   "pitch-black-garbage-rips-585-booster-pack-tile" sitting in here is the kind
   of thing that reads as real in a debugger a year from now. */
const packsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets/packs")).catch(() => []))
    .map((f) => /^(.+)-garbage-rips-585-booster-pack\.webp$/.exec(f)?.[1])
    .filter(Boolean)
);
/* WHICH PLAYLISTS HAVE THEIR OWN SHARE CARD, read off the directory for exactly
   the reason the two sets above are. All 22 of these pages previewed as the
   same picture of a booster pack until 21 August 2026, which an audit measured
   and which is a wasted click every time somebody pastes a playlist into a
   chat: a playlist page is one of the two families on this site most likely to
   be shared. scripts/build-og.py writes them, keyed `og-pl-<slug>.jpg` off the
   SAME slugFor() below, and it refuses to write one whose headline is not this
   page's own <h1>. The `pl-` prefix is what stops a playlist slug colliding
   with a set id in one flat assets directory.

   NOT A LIST AND NOT A FLAG. If build-og.py has not been run, the file is not
   here, the page keeps the generic card and nothing breaks; run it and the page
   picks the card up on the next build. That is the same arrangement
   build-set-pages.mjs's ogCards has, and it is why build-og.py can stay out of
   build-all.mjs. */
const ogCardsOnDisk = new Set(
  (await readdir(join(ROOT, "public/assets")).catch(() => []))
    .map((f) => /^og-(pl-.+)\.jpg$/.exec(f)?.[1])
    .filter(Boolean)
);
/**
 * The set logo, drawn 132px wide inside a 132x50 box.
 *
 * Offers the -sm.webp (100px tall, 5-17KB) FIRST with its own real width from
 * data/logo-dims.json, then the 300px master, so a dense screen can still take
 * the big one and nobody else pays for it. That is the same pair build-set-
 * pages.mjs offers its 110px set cards; the box here is a little wider because
 * this one is the page's identity rather than a row item.
 *
 * NOT emitted for a set with no file on disk. onerror hides a 404 in the
 * browser and the page still pays for the round trip, which is the trap
 * CLAUDE.md already records for the card scans.
 */
const LOGO_BOX_W = 132;
const LOGO_BOX_H = 50;
function setLogo(setId, alt) {
  if (!logosOnDisk.has(setId)) return "";
  const d = LOGO_DIMS[`${setId}-pokemon-tcg-set-logo.webp`];
  if (!d) return "";
  const base = `/assets/logos/${setId}-pokemon-tcg-set-logo`;
  const smW = Math.round((d[0] * 100) / d[1]);
  // SIZES IS THE RENDERED WIDTH, WHICH object-fit:contain DECIDES, NOT THE BOX.
  // Written as a flat "132px" this fetched the 300px-tall MASTER for every logo
  // narrower than 2.64:1, which is most of them: Pokemon GO is 479x300, renders
  // 80x50 inside the box, and took 31.3KB where its own -sm.webp is 8KB and
  // 160x100, an exact DPR2 fit. Chrome was right and the markup was lying to it,
  // because 132 CSS px at DPR2 asks for 264 and the -sm is 160 wide.
  // contain scales by min(boxW/w, boxH/h), so the drawn width is the smaller of
  // the box width and the height-limited width. Same arithmetic the browser
  // does; it just has to be told.
  const drawnW = Math.round(Math.min(LOGO_BOX_W, (LOGO_BOX_H * d[0]) / d[1]));
  return `<img class="plid-logo" src="${base}-sm.webp"
            srcset="${base}-sm.webp ${smW}w, ${base}.webp ${d[0]}w" sizes="${drawnW}px"
            width="${smW}" height="100" alt="${esc(alt)}" decoding="async">`;
}

// The product photos the CDN refuses, recorded beside the missing card scans.
// Same reason as build-set-pages.mjs: they carried onerror and vanished, and the
// page paid for a 403 to find out.
let deadUrls = new Set();
try {
  deadUrls = new Set(
    JSON.parse(await readFile(join(ROOT, "data/no-scan.json"), "utf8")).deadUrls || [],
  );
} catch {
  /* optional */
}

let productsBySet = {};
let productsChecked = null;
try {
  const p = JSON.parse(await readFile(join(ROOT, "public/data/products.json"), "utf8"));
  productsBySet = p.sets || {};
  productsChecked = p.checked || null;
} catch {
  /* run: node scripts/sync-products.mjs */
}

/**
 * Taxonomy product id -> the `kind` string products.json uses.
 *
 * DELIBERATELY PARTIAL. Only the ids whose meaning is one specific sealed
 * product with one photograph are here. `blister`, `tin`, `collection-box` and
 * `ex-premium` each cover several different products in a set (three different
 * blisters, four different tins), so "the" photo for them does not exist and a
 * page showing one of the four under a name covering all four would be the
 * caption error this whole block is written to avoid. Those playlists get a
 * logo and no photo, which is the correct amount of certainty.
 *
 * The Japanese, Korean and Chinese pack ids are absent for a different reason:
 * products.json is TCGplayer's US catalogue and holds no imported product.
 */
const PRODUCT_KIND = {
  etb: "Elite Trainer Box",
  bundle: "Booster Bundle",
  "single-pack": "Single Pack",
  "booster-box": "Booster Box",
  upc: "Ultra-Premium Collection",
  spc: "Super-Premium Collection",
};

/**
 * The one product this playlist opens, or null.
 *
 * Requires: every video in the run tags the same single set, every video tags
 * the same single product type, that type maps to a named product above, and
 * that exact product exists in this set's own list. Anything less returns null.
 */
function theProduct(setId, prodId) {
  const kind = PRODUCT_KIND[prodId];
  if (!setId || !kind) return null;
  const p = (productsBySet[setId]?.products || []).find((x) => x.kind === kind);
  if (!p || !p.thumb || deadUrls.has(p.thumb)) return null;
  return p;
}

/**
 * The slug for a playlist page.
 *
 * The YouTube id is NOT in the url. Playlist titles are long and descriptive
 * and the slug reads well on its own, and unlike a video title a playlist
 * title is not one of hundreds that might collide. Collisions are still
 * checked below rather than assumed away.
 */
const slugFor = (p) => slugify(p.title) || p.id.toLowerCase();

// This playlist's own share card where build-og.py has written one, and the
// site-wide one where it has not. ONE FUNCTION, SPENT TWICE in the head, so
// og:image and twitter:image cannot name two different pictures.
const ogImage = (p) => {
  const slug = `pl-${slugFor(p)}`;
  return `${SITE}/assets/${ogCardsOnDisk.has(slug) ? `og-${slug}` : "og-image"}.jpg`;
};

// A playlist with nothing in it is not a page. Two exist on the channel: they
// were created and never filled. They come back on their own once a video
// goes in, and until then there is nothing here to show.
const live = playlists.filter((p) => (p.videoIds || []).length > 0);

const seen = new Map();
for (const p of live) {
  const s = slugFor(p);
  if (seen.has(s)) {
    // Two playlists whose titles slugify the same would silently overwrite one
    // another's page, which is the sort of thing that is noticed months later
    // by a missing url in the sitemap. Fail instead.
    console.error(
      `Two playlists produce the slug "${s}":\n  ${seen.get(s)}\n  ${p.title}\n` +
        `Rename one on YouTube, or add the id to slugFor in this file.`,
    );
    process.exit(1);
  }
  seen.set(s, p.title);
}

/**
 * The playlist's own description, cleaned the same way a rip page cleans a
 * video description: the trailing hashtag wall is a YouTube indexing device
 * and reads as a row of link-less tokens on a web page.
 */
const cleanDesc = (s) => {
  let t = String(s || "");
  // CUT AT THE FIRST HASHTAG, not just the trailing run. A rip page's
  // description ends in a hashtag wall, so stripping the tail is enough there.
  // A playlist description does something else: three of the twenty run
  // "#pokemon #pokemoncards #pokemontcg" mid-text and then continue with a
  // block of untagged search terms ("chaos rising elite trainer box pokemon
  // etb opening series pokemon chaos rising openings..."), which is 279
  // characters of keyword stuffing on the longest one. All of it is written
  // for YouTube's index and none of it is written for a reader, and the human
  // sentences always come first.
  const tag = t.search(/#[A-Za-z]/);
  if (tag > 0) t = t.slice(0, tag);

  // TWO PLAYLISTS OFFERED TO TEST PULL RATES, and this site does not have them.
  // Destined Rivals and Paradox Rift both list "We're testing: Pack luck, Pull
  // rates, Promo value", syndicated straight from YouTube, so the one thing the
  // site refuses to publish was being published as a bullet in its own copy and
  // shipped to Google in the meta description. The line is dropped from the
  // bullet, not the whole sentence: everything else in it is true and is the
  // owner's own writing.
  t = t.replace(/[\u2022*\-]?\s*pull\s+rates?\s*(?=[\u2022*\-\n]|$)/gi, "");

  // THE KEYWORD TAIL IS NOT COPY. Cutting at the first hashtag leaves the
  // untagged version of the same thing: nineteen of twenty two descriptions end
  // in a comma-separated run of search terms ("Pokemon, Pokemon TCG, Pitch
  // Black, ETB, Elite Trainer Box, Pack Opening") set in the same type as the
  // human sentences above it, and eleven close with a bare "garbage rips 585".
  // It is written for an index rather than a reader, and on a site whose whole
  // job is entity SEO it reads as stuffing. The human sentences always come
  // first, so the tail is what is cut.
  t = t.replace(/\n\s*garbage rips 585\s*$/i, "");
  // SPLIT ON ONE NEWLINE, NOT ON A RUN OF THEM. This was `split(/\n+/)` and
  // rejoined with a single "\n", which DELETED every blank line in the blurb
  // while the comment below it said this function kept them deliberately
  // because they are what give the body its paragraphs. The paragraphs were
  // gone before the page ever saw them. Trailing blanks are popped explicitly
  // so the tail tests still see a real line.
  const lines = t.split("\n");
  const dropTrailingBlanks = () => {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  };
  dropTrailingBlanks();
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    // A keyword run: several comma separated fragments, none of them a
    // sentence. Requires 3+ commas and no terminal punctuation, so an ordinary
    // sentence containing a comma is never mistaken for one.
    const commas = (last.match(/,/g) || []).length;
    if (commas >= 3 && !/[.!?]$/.test(last) && last.length < 400) {
      lines.pop();
      dropTrailingBlanks();
    } else break;
  }
  t = lines.join("\n");

  // AND THE TAIL WITH NO COMMAS IN IT, WHICH WAS TWELVE OF THE TWENTY-TWO.
  // The rule above wants 3+ commas on ONE line. Twelve of these descriptions
  // put ONE search term per LINE instead, so there is not a comma in the whole
  // tail and the test never fired: "pokemon perfect order etb" / "perfect order
  // elite trainer box opening" / ... / "garbage rips 585". The three that DO
  // use commas are the ones this file already handled, which is why the shape
  // looked solved. It was half solved.
  //
  // It reads worse than the comma form, not better, because .lede is
  // white-space:normal: the line breaks collapse and the terms run together
  // into one sentence-shaped wall of repeated words. Measured on the built
  // pages at 390x844: 219 of the Surging Sparks blurb's 813 characters, and a
  // full screen of "surging sparks pokemon surging sparks surging sparks
  // booster pack surging sparks opening" between the h1 and the set logo. On
  // Hits Only, the biggest playlist on the channel, 253 of 597.
  //
  // A keyword line is a short fragment with no terminal punctuation. THE TWO
  // EXCLUSIONS ARE WHAT MAKE IT SAFE AND BOTH CAME OUT OF THE OWNER'S OWN COPY: an
  // emoji line ("First Pack Magic", "Pull the Umbreon ex SIR", each with its
  // own emoji) and a bulleted line ("Pack luck") are also short and also
  // unpunctuated, and both are real writing that CLOSES a description. Every
  // human line one of these tails follows ends in . ! ? or a horizontal
  // ellipsis, so the walk back stops on the first one, and the blank line that
  // always separates the tail from the copy stops it too.
  //
  // THREE LINES MINIMUM, because a one line tail is what the comma rule above
  // already handles and requiring a RUN means no single unpunctuated closing
  // line can ever be mistaken for stuffing. The shortest real tail here is six.
  const keywordLine = (s) => {
    const v = s.trim();
    if (!v || v.length > 60) return false;
    if (/[.!?\u2026:;)]$/.test(v)) return false;
    if (/\p{Extended_Pictographic}/u.test(v)) return false;
    if (/[\u2022*|#]/.test(v)) return false;
    return v.split(/\s+/).length <= 7;
  };
  const ls = t.split("\n");
  let cut = ls.length;
  while (cut > 1 && keywordLine(ls[cut - 1])) cut -= 1;
  if (ls.length - cut >= 3) t = ls.slice(0, cut).join("\n");

  // plainDashes LAST, so it sees the finished blurb. This is the single funnel
  // every playlist description goes through -- the meta description and the
  // visible lede both come out of here -- so one call covers both. See the note
  // over plainDashes in shared/format.mjs for why this cannot live in the data.
  return plainDashes(t.replace(/[ \t]{2,}/g, " ").replace(/\s+$/, "").replace(/[\s\u2022|,;:-]+$/, "").trim());
};

/**
 * The blurb as the owner wrote it, which is not what the page showed until now.
 *
 * THE LINE BREAKS WERE THE WRITING AND THE PAGE THREW THEM AWAY. He writes
 * these in short lines on purpose. Read as he typed it:
 *
 *     We're testing:
 *       Pack luck
 *       Promo value
 *       And whether Destined Rivals actually delivers... or is just bulk city
 *
 *     If you enjoy Pokemon TCG openings, ...
 *
 * One esc()'d string inside one <p class="lede"> with white-space:normal is
 * what shipped, so every one of those breaks collapsed to a space and the
 * Destined Rivals page read "...or is just bulk city If you enjoy Pokemon TCG
 * openings", two sentences welded together with no punctuation between them
 * because the punctuation WAS the line break. Twelve of the twenty two run
 * lines like that. Nothing in the markup was wrong; the markup simply could
 * not express what the source said.
 *
 * A blank line opens a paragraph, a single newline is a <br>, which is the
 * shape of the source and the shape YouTube itself renders. Whitespace-only
 * lines are dropped rather than emitted as an empty <br>: the pull rates rule
 * above deletes a bullet and leaves the tab it was indented with behind.
 */
const blurbHtml = (t) =>
  String(t)
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map(esc)
        .join("<br>"),
    )
    .filter(Boolean)
    .map((html) => `<p>${html}</p>`)
    .join("");

/** First sentence or so, for the meta description.
 *
 * CUT AT A SENTENCE, NOT AT A WORD. All 21 of these descriptions ended "..."
 * mid-thought, which is the snippet Google draws under the title; 6 of them end
 * on a finished sentence now and the other 15 are unchanged, because a playlist
 * blurb opens with one long "Welcome to the ..." line and there is often no
 * full stop inside 158 characters to cut at. Same helper and same 60% floor as
 * build-pages.mjs; the long note is there. The emoji is
 * allowed to travel with the full stop it follows, because the owner writes
 * "One classic character promo. 🌿 Full garbage plate" and cutting at the bare
 * "." strands the emoji at the head of a sentence nobody will read.
 */
const SENTENCE_END = /[.!?…][)"'’”]?(?:\s*\p{Extended_Pictographic}️?)*(?=\s|$)/gu;
const clip = (s, n) => {
  if (s.length <= n) return s;
  const window = s.slice(0, n);
  let end = -1;
  SENTENCE_END.lastIndex = 0;
  for (let m; (m = SENTENCE_END.exec(window)) !== null; ) end = m.index + m[0].length;
  if (end >= n * 0.6) return window.slice(0, end).trim();
  return s.slice(0, n - 3).replace(/\s\S*$/, "").replace(/[.,;:\s]+$/, "") + "...";
};

/**
 * Which pack skin a tile wears. Identical to the rule in app.js makeCard: a
 * video carrying several sets wears the generic multi-set wrapper rather than
 * implying the rip was only one of them.
 */
function faceSet(v) {
  const sets = v.sets || [];
  if (sets.length > 1) return "multi";
  return sets[0] || "default";
}

/**
 * A pack facade for one tile, with the artwork as an <img> so it can be lazy.
 *
 * /playlists.html WAS THE HEAVIEST PAGE THIS CHANGE TOUCHES AND LAUNCH.md NEVER
 * NAMED IT. Measured 20 August 2026, cache off, NO scroll at all, waiting for
 * the network to go quiet: all TWELVE distinct tile files arrived, 477.2KB, on
 * a 606.5KB page, and only FOUR of the 22 tiles are above the fold at 390x844.
 * A CSS background can never be lazy, so every one of them was fetched for a
 * reader who never scrolled. /videos.html's 48 tiles are the same shape at
 * 279.7KB.
 *
 * `packsOnDisk` IS THE GUARD AND IT IS NOT DECORATIVE HERE. This helper is
 * called with whatever faceSet returns, which is the video's own first set
 * rather than a set anybody checked for artwork, so several sets reaching it
 * have only the generated colour design in ui.css. Those get the facade and no
 * img, exactly as before, and no .pack--img either, so packs.css leaves them
 * alone. That guard is the difference between this and a dead round trip.
 */
const packMarkup = (setId) => `<span class="pack pack--${esc(setId)} pack--tile${
  packsOnDisk.has(setId) ? " pack--img" : ""
}" aria-hidden="true">
            <span class="pack-face pack-l">
              <span class="pack-art">${packsOnDisk.has(setId) ? packTileImg(setId) : ""}</span>
              <span class="pack-brand">${esc(setId === "default" ? "GARBAGE RIPS" : labelFor("sets", setId) || "GARBAGE RIPS")}<small>${
                setId === "default" ? "585" : "GARBAGE RIPS 585"
              }</small></span>
              <span class="pack-seal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>
            </span>
          </span>`;

/**
 * The rules every playlist page needs, as against the strip rules below, which
 * only 21 of the 22 draw. Same argument for inlining: ui.css is render blocking
 * on all 426 pages and these serve 22.
 *
 * .lede is a div here rather than a p, so its paragraphs need their own gap.
 * That is the whole of it: the sibling list below reuses .riplist, which is
 * already in ui.css, already on the 56 /sets/ and /openings/ pages, and is
 * exactly this shape (a link on the left, a small mono count on the right, a
 * 44px row on a card). A second stylesheet for the same list would be a second
 * thing to keep in step with it.
 */
const BASE_CSS = `
.pl-blurb p+p{margin-top:var(--s3)}
`;

/**
 * THE TILES ARE NOT MIS-SIZED AND THE MEASUREMENT SAYS SO. THE WALL IS.
 *
 * This came off a QA list as "playlist tiles mis-sized at desktop". Measured
 * first, headless Chrome over CDP at DPR 1, a playlist page beside /videos.html
 * on the same tree:
 *
 *       viewport   /videos.html (48 tiles)   a playlist page   verdict
 *          390          2 cols, 169.00            169.00       identical
 *          640          2 cols, 294.00            294.00       identical
 *          768          3 cols, 229.33            229.33       identical
 *         1080          4 cols, 246.00            246.00       identical
 *         1440          6 cols, 218.66           218.66        identical
 *         1920          6 cols, 228.66           228.66        identical
 *
 * So a playlist tile is the site's own .wall tile to the pixel at every width,
 * and NOTHING HERE CHANGES A TILE SIZE ON A PAGE THAT HAS ENOUGH TILES.
 *
 * WHAT IS ACTUALLY WRONG IS THE TRACK COUNT ON A SHORT PLAYLIST. .wall declares
 * six columns at 1301 and up whatever it holds, and six of these 22 pages hold
 * one, two, three or five videos. The single-video Pitch Black hunt at 1440 is
 * one 218.66px tile with 1,173.34px of uninked band beside it, 84.3% of the
 * row, under a full width heading and above a full width sibling list. That is
 * the picture the flag was reacting to, and it is a wall sized for tiles that
 * do not exist rather than a tile sized wrong.
 *
 * TWO NUMBERS, BOTH MEASURED, NEITHER PICKED:
 *
 * - THE COLUMN COUNT NEVER EXCEEDS THE TILE COUNT. The step comes from .wall's
 *   own ladder in assets-source/ui.css, which is 2 up to 640, 3 to 820, 4 to
 *   1080, 5 to 1300 and 6 above it, so the first viewport at which the wall can
 *   ask for more columns than this page has tiles is the entry below. IF THAT
 *   LADDER MOVES IN ui.css THIS TABLE HAS TO MOVE WITH IT, which is the one
 *   coupling in this rule and is why it is written out rather than inlined.
 *
 * - THE TRACK STOPS AT 400px BECAUSE THE ARTWORK DOES. All 258 pack tile images
 *   across these pages are width="400" and there is no larger rung: the tile is
 *   a single 400x711 file with an AVIF twin, not a ladder. 400 CSS px is 1:1 at
 *   DPR 1 and the first width at which the tile would be upscaled, so it is the
 *   ceiling the asset sets rather than a number anybody liked the look of.
 *   Without it a three video page at 1440 would draw 453.33px tiles and upscale
 *   every one of them by 13%.
 *
 * DESKTOP ONLY, ON PURPOSE. Every rule below is min-width, and the narrowest is
 * 641, so 320 and 390 render exactly the bytes they rendered before. A single
 * tile does sit in a two column wall on a phone, 181px of dead track at 390,
 * and that is left alone: it is the same shape the last row of any three video
 * playlist already has there, and the flag was about desktop.
 *
 * align-items IS LEFT ALONE AND THAT IS A DECISION. A .v is not a box: ui.css
 * gives it no border and no background, the artwork carries its own
 * aspect-ratio, and the caption under it is one or two lines. Ragged bottoms
 * are the shipped pattern on every wall on this site and stretch would only
 * stretch the gap under the shortest caption. The two grids in this pass that
 * DO stretch, .chof-list and .lore-list, are both grids of bordered cards.
 *
 * CLS: the tile height is derived from its column by aspect-ratio, so a wider
 * track is a taller box that is still reserved before the image lands. Measured
 * 0 before and after at 390, 768 and 1440.
 */
const WALL_MAX_TILE = 400;
const WALL_LADDER = [
  { cols: 3, from: 641 },
  { cols: 4, from: 821 },
  { cols: 5, from: 1081 },
  { cols: 6, from: 1301 },
];

const wallCss = (n) => {
  const step = WALL_LADDER.find((b) => b.cols > n);
  if (!step) return "";
  const cap = n * WALL_MAX_TILE + (n - 1) * 16;
  return `
@media(min-width:${step.from}px){.wall{grid-template-columns:repeat(${n},1fr);max-width:${cap}px}}
`;
};

/**
 * The rules the strip needs, inlined here rather than added to
 * assets-source/ui.css, which is render blocking on all 426 pages and would be
 * carrying them for the twenty-one that use them. Same pattern as
 * build-intl-pages.mjs and build-expansions.mjs. Emitted only on the pages that
 * actually draw a strip.
 */
const PAGE_CSS = `
/* One column on a phone, two once there is room. The two halves are different
   shapes (a wide logo, a tall box) so they are not forced into a grid: each is
   a flex row that sizes to its own picture. */
.plid{display:flex;flex-wrap:wrap;gap:var(--s4);margin-top:var(--s4);max-width:46em}
.plid-set,.plid-prod{display:flex;align-items:center;gap:var(--s4);flex:1 1 15em;
  padding:var(--s3) var(--s4);border:1px solid var(--hair);border-radius:var(--r);
  background-color:var(--card);box-shadow:var(--lift);
  font-size:var(--t-sm);line-height:1.5}
.plid-set{text-decoration:none;color:inherit}
.plid-set:hover span,.plid-set:focus-visible span{color:var(--ketchup-deep)}
/* FIXED BOXES, both of them, and for the same reason in two different shapes.
   The logos are normalised by height at the source and every one is a different
   width; the TCGplayer product photos are all 200 wide and 268 to 417 tall. So
   neither file's own shape can set the row height without the strip changing
   size from playlist to playlist. object-fit:contain does the fitting. */
.plid-logo{flex:0 0 132px;width:132px;height:50px;object-fit:contain;object-position:center}
.plid-shot{flex:0 0 84px;width:84px;height:84px;object-fit:contain}
.plid small{display:block;margin-top:3px;font-size:var(--t-micro);color:var(--ink-2)}
`;

/**
 * The same trade build-css.mjs makes for ui.css: the comments are the point of
 * the source and pure weight in a render blocking <head>. Comments only.
 */
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

/**
 * The identity strip: what set, and what was opened, as pictures.
 *
 * Neither half is decoration. The logo is the thing printed across the box on
 * the shelf, so it is what a reader arriving from a search recognises before
 * reading a word, and it doubles as the route into the set guide. The product
 * photo is the object in every video on the page: "ETB Opening Series" is nine
 * words for a picture of an Elite Trainer Box.
 *
 * WEIGHT. The logo is the -sm.webp, 5 to 17KB, in a 132px box. The product is
 * TCGplayer's 200w thumb in an 84px box, which covers DPR2 with 32px to spare
 * and is the size build-set-pages.mjs settled on after measuring the 1000x1000
 * being fetched for the same box. Both are EAGER: the strip sits under the h1
 * and its description, which measured 550 CSS px down the longest of the
 * twenty-one at 390 wide, so it is inside the first viewport on every page here
 * and `loading="lazy"` would only delay the two pictures the page is identified
 * by. 22KB together on the heaviest playlist.
 *
 * NO width/height ON THE TCGPLAYER IMG, via imgDims, which returns nothing for
 * that host on purpose: those files are 200x268 through 200x417 depending on
 * the product and a fixed guess is wrong by up to 34%. The 84px box with
 * object-fit:contain is what reserves the space.
 */
function idStrip(p, vids) {
  const sets = new Set();
  const prods = new Set();
  for (const v of vids) {
    for (const s of v.sets || []) sets.add(s);
    for (const q of v.products || []) prods.add(q);
  }
  const setId = sets.size === 1 ? [...sets][0] : null;
  const prodId = prods.size === 1 ? [...prods][0] : null;
  const setName = setId ? labelFor("sets", setId) : null;
  const logo = setId && setName ? setLogo(setId, `${setName} set logo`) : "";
  const prod = setId ? theProduct(setId, prodId) : null;

  if (!logo && !prod) return "";

  return `      <div class="plid">
        ${logo ? `<a class="plid-set" href="/sets/${esc(setId)}.html">
          ${logo}
          <span>Every rip here opens <b>${esc(setName)}</b><br>Read the set guide &rarr;</span>
        </a>` : ""}
        ${/* THE 84px THUMB TAKES productSrcset()'s LADDER, not a hand written one.
              It offered _200w and then _in_1000x1000, and 84 x 3 = 252 clears
              200, so on a DPR 3 phone all 13 of these playlist pages fetched a
              547x1000 JPEG for an 84px box. See shared/format.mjs. */ ""}${prod ? `<div class="plid-prod">
          <img class="plid-shot" src="${esc(prod.thumb)}"${productSrcsetAttr(prod.thumb, 84)}
               sizes="84px" alt="${esc(prod.name)}" decoding="async"${imgDims(prod.thumb)} referrerpolicy="no-referrer">
          <span>Opened here: the <b>${esc(prod.name)}</b>${
            // The blurb is written to stand alone on the set guides, where it is
            // its own line, so it arrives sentence-cased: "One pack", "36 packs".
            // Here it is a clause, and "the Pitch Black Booster Pack, One pack"
            // reads like two sentences collided. Lowercased only when the first
            // word is ordinary capitalised English, so an acronym is left alone.
            prod.blurb ? `, ${esc(/^[A-Z][a-z]/.test(prod.blurb) ? prod.blurb[0].toLowerCase() + prod.blurb.slice(1) : prod.blurb)}` : ""
          }.<br><small>Photo: TCGplayer.</small></span>
        </div>` : ""}
      </div>`;
}

const clock = (sec) =>
  sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "";

// Was a fourth hand-rolled copy of the view formatter, and the one that read
// "1 VIEWS" on the single-pack-hunt playlist. Capitals are this page's own
// styling, so they go on here rather than into the shared helper.
const compactViews = (n) => viewCount(n).toUpperCase();

/**
 * The visible label for a tile, disambiguated within THIS page.
 *
 * ripLabel reduces a title to set plus product plus pack number, which is
 * exactly right in a mixed grid and collides badly inside a playlist: The owner
 * opened nine Chaos Rising ETBs, so nine tiles on that one page all read
 * "Chaos Rising ETB #2", each linking to a different video. Nine identical
 * links is a usability problem for everyone and an accessibility one for a
 * screen reader working from a link list.
 *
 * The upload date is the differentiator, because it is a fact already held and
 * it is the thing that actually separates the runs. Only repeats get it, so
 * the pages where every label is already distinct stay clean.
 */
// EIGHT OF THE TWENTY-ONE PLAYLIST NAMES ALREADY END IN THE BRAND, because
// that is how they were typed on YouTube. Appending it again shipped titles
// reading "... | Garbage Rips 585 | Garbage Rips 585" in the browser tab and in
// search results.
// THE STRIP STAYS AND THE APPEND IS GONE, 17 August 2026. Measured in headless
// Chrome at 20px Arial, 16 of the 21 ran 597-724px with the brand appended,
// against Google's ~580px desktop cut, so it was drawn on 5 of them and
// truncated on the rest. Bare they run 285-545px and all 21 render whole.
// The strip is still doing the job the comment above describes: without it the
// eight names that already end in the brand would keep it while the other
// thirteen lost it, which is the inconsistency this rule exists to prevent.
// og:site_name carries the brand for the search result's site-name line.
const titleFor = (p) =>
  String(p.title || "").trim().replace(/\s*\|\s*Garbage\s*Rips\s*585\s*$/i, "").trim();

function labelsFor(vids) {
  const count = new Map();
  for (const v of vids) {
    const l = v.label || v.siteTitle || v.title;
    count.set(l, (count.get(l) || 0) + 1);
  }
  // The date is not always enough. Two Perfect Order videos went up on the same
  // day and label the same, so the date left them still identical. Where that
  // happens the tile falls back to the video's own full title, which is the
  // real name and is always distinct. Longer, and correct beats tidy.
  const dated = new Map(
    vids.map((v) => {
      const l = v.label || v.siteTitle || v.title;
      return [v.id, count.get(l) > 1 && v.published ? `${l} (${shortDate(v.published)})` : l];
    }),
  );
  const after = new Map();
  for (const t of dated.values()) after.set(t, (after.get(t) || 0) + 1);
  return new Map(
    vids.map((v) => [
      v.id,
      after.get(dated.get(v.id)) > 1 ? v.siteTitle || v.title : dated.get(v.id),
    ]),
  );
}

/**
 * @param oneSet  true when EVERY video on this page opens the same single set,
 *                which is 21 of the 22 pages. See below for what it drops.
 */
function tile(v, labels, oneSet) {
  const sets = v.sets || [];
  // THE SET NAME IS THE THIRD TIME THE PAGE SAYS IT AND IT WAS EATING THE ONE
  // THING ON THIS LINE THE READER CANNOT GET ANYWHERE ELSE.
  //
  // .v p is white-space:nowrap with text-overflow:ellipsis, and 173px of mono
  // micro at 390x844 does not hold "PERFECT ORDER  •  1.2K VIEWS": it holds 184
  // and cuts the number. Measured across the family before this changed, 179 of
  // the 259 tiles were truncated and on 9 of the 22 pages it was every tile on
  // the page. Every one of them lost the view count, never the set name, since
  // the cut comes off the right.
  //
  // On a playlist covering ONE set the name is already in the h1, in the
  // breadcrumb and on the set logo in the identity strip, so it is the half
  // with nothing to say. Dropping it leaves "1.2K VIEWS", which fits whole on
  // every tile at 390. This is the same component /videos.html uses and the
  // set name is load bearing THERE, in a mixed grid, which is why the rule is
  // about the page and not about the tile.
  //
  // HITS ONLY KEEPS IT, and it is the only page that does. Its 55 videos span
  // 14 sets, so the name is the most useful word on the line, and 40 of those
  // tiles still truncate. That is a real cost and it is the right way round:
  // the page where the set matters keeps the set.
  const meta = [
    oneSet
      ? null
      : sets.length > 1
        ? `${String(labelFor("sets", sets[0]) || sets[0]).toUpperCase()} +${sets.length - 1}`
        : sets.length
          ? String(labelFor("sets", sets[0]) || sets[0]).toUpperCase()
          : null,
    compactViews(v.views),
  ].filter(Boolean);
  const pull = (v.pulls || [])[0];
  return `        <article class="v">
          <a class="art" href="/${esc(v.path)}" aria-label="${esc(v.siteTitle || v.title)}">
            ${packMarkup(faceSet(v))}
            ${pull ? `<span class="hit">${esc(labelFor("pulls", pull))}</span>` : ""}
            ${v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""}
            ${RIP_BANNER}
          </a>
          <h3><a href="/${esc(v.path)}">${esc((labels && labels.get(v.id)) || v.label || v.siteTitle || v.title)}</a></h3>
          ${meta.length ? `<p>${esc(meta.join("  \u2022  "))}</p>` : ""}
        </article>`;
}

// EVERY RUN RESOLVED BEFORE ANY PAGE IS WRITTEN, because a page has to be able
// to name its siblings and say how long each of them is, and a count printed on
// one page has to be the number of tiles the page it points at actually
// renders. `count` in playlists.json is YouTube's own figure and includes
// entries that are private or deleted and never reach a tile, so it is not the
// number to print next to a link into this tree.
const runs = live
  .map((p) => {
    const vids = (p.videoIds || []).map((id) => byId.get(id)).filter(Boolean);
    const sets = new Set();
    for (const v of vids) for (const s of v.sets || []) sets.add(s);
    return { p, slug: slugFor(p), vids, setId: sets.size === 1 ? [...sets][0] : null };
  })
  .filter((r) => r.vids.length);

/**
 * The other runs of the same set.
 *
 * WHY THIS IS THE ONE LINK THESE PAGES WERE MISSING. Fourteen of the twenty one
 * single-set playlists have a sibling and not one of them said so: there are
 * three Pitch Black runs, three Chaos Rising, three Perfect Order, three
 * Ascended Heroes and two Journey Together, and somebody who finished the Pitch
 * Black Single Pack Hunt (one video) was offered "All playlists" and "Every
 * rip", both of which are the whole library, and nothing in between. The next
 * thing that reader wants is the ETB marathon of the same set, which is two
 * taps away through an index for no reason.
 *
 * SAME SET, NEVER SAME PRODUCT. The point of the block is that these are the
 * OTHER ways this set got opened, so the ETB run is exactly what belongs under
 * the single pack hunt. Playlists spanning more than one set (Hits Only) have
 * no set to be a sibling of and get nothing.
 */
function nearby(run) {
  if (!run.setId) return "";
  const setName = labelFor("sets", run.setId);
  const others = runs.filter((r) => r.setId === run.setId && r.slug !== run.slug);
  if (!others.length || !setName) return "";
  const items = others
    .map(
      (r) => `        <li><a href="/playlists/${esc(r.slug)}.html">${esc(r.p.title)}</a>` +
        `<span>${r.vids.length} video${r.vids.length === 1 ? "" : "s"}</span></li>`,
    )
    .join("\n");
  return `      <h2 style="font:400 var(--t-m)/1.2 var(--display);margin:var(--s6) 0 var(--s3)">More ${esc(setName)} on the channel</h2>
      <ul class="riplist">
${items}
      </ul>`;
}

// THE WALL NEEDED A HEADING AND THIS IS IT. Every tile title in .wall is an h3,
// and with nothing between it and the page h1 all 21 playlist pages read
// h1 -> h3. Same defect and same fix as .loc h2 in ui.css and .op-sh in
// build-openings.mjs, except that the tile heading here CANNOT be promoted
// instead: .v h3 in ui.css is a tag selector used by every video tile on the
// site, and ui.css is not this builder's to edit. So the level goes in above
// the wall rather than under it. The style is inline and copied from .op-sh.
//
// THIS NOTE WAS AN HTML COMMENT UNTIL 20 August 2026 AND IT SHIPPED. Nothing in
// this builder strips comments out of the page it writes, unlike miniCSS above,
// which strips them out of the stylesheet three lines away. 985 bytes of build
// note went to a reader on all 22 pages, 21.1KB across the family, explaining a
// heading nobody can see it above. It is a JS comment now, which is the only
// kind this file can write for free. Before adding another HTML comment to a
// page template here, check whether the reader is paying for it.
const WALL_H2 =
  '      <h2 style="font:400 var(--t-m)/1.2 var(--display);margin:var(--s5) 0 var(--s3)">In this playlist</h2>';

/**
 * HOW LONG THE WHOLE RUN IS, WHICH IS THE FACT THESE PAGES WERE MISSING.
 *
 * Somebody deciding what to watch next is deciding how much of their evening
 * this costs, and until now the only answer on the page was a count: "21
 * videos", which on a channel of vertical Shorts is unreadable as a time. The
 * real figures are startling and they are the best argument these pages have.
 * The Perfect Order ETB run is nine videos and 3:12. Hits Only, the biggest
 * playlist on the channel at 55 entries, is 30:09, which is one sitting.
 *
 * WRITTEN IN THE SAME m:ss AS THE CHIP ON EVERY TILE BELOW IT, on purpose, so
 * the number is not something a reader has to take on trust: it is the sum of
 * the durations printed on the page's own artwork, in the notation they are
 * printed in. Rounding it to "3 min" would have been friendlier to read and
 * would have made it uncheckable. Only shown when every video on the page has
 * a duration (all 22 do today) and only when there is more than one, since for
 * a single video it would repeat that video's own chip.
 *
 * IT REPLACED "click a pack to rip it open here", which was the one piece of
 * this template that existed because there was room for it. Every tile below
 * carries RIP_BANNER, reading CLICK TO RIP THE PACK across the foot of the
 * artwork, 55 times on the longest page, so the sentence was an instruction
 * for something already labelled in larger type forty pixels lower. What it
 * was reaching for is real and is kept in four words: what separates this page
 * from the same playlist on YouTube is that the videos play HERE.
 */
function statLine(vids, newest) {
  const total = vids.reduce((a, v) => a + (v.duration || 0), 0);
  const timed = vids.length > 1 && vids.every((v) => v.duration);
  return `      <p class="pl-stat">${vids.length} video${vids.length === 1 ? "" : "s"}${
    timed ? ` &bull; ${clock(total)} in total` : ""
  }${newest ? ` &bull; newest ${esc(shortDate(newest))}` : ""} &bull; every one plays here</p>`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let written = 0;
let missing = 0;
for (const p of live) missing += (p.videoIds || []).length - p.videoIds.map((id) => byId.get(id)).filter(Boolean).length;

for (const run of runs) {
  const { p, slug, vids } = run;

  const desc = cleanDesc(p.description);
  const strip = idStrip(p, vids);
  const url = `${SITE}/playlists/${slug}.html`;
  const newest = vids.map((v) => v.published).filter(Boolean).sort().pop();
  // THE NEWLINES COME OUT HERE AND NOWHERE ELSE. cleanDesc keeps blank lines,
  // and since 20 August 2026 that is TRUE rather than merely claimed: the line
  // above this one used to split on a RUN of newlines and rejoin on a single
  // one, so every paragraph break was deleted three steps before the page could
  // use it. A meta description is an ATTRIBUTE value, where a newline is not
  // collapsed and does ship: 19 of these 21 pages had a literal line break
  // inside <meta name="description">. build-pages.mjs already did this for the
  // same reason and this file did not. `desc` below is untouched and goes
  // through blurbHtml, so the page reads in the owner's own paragraphs.
  const metaDesc = clip(
    (desc || `${vids.length} rip${vids.length === 1 ? "" : "s"} from Garbage Rips 585, in the order they were opened.`)
      .replace(/\s+/g, " ")
      .trim(),
    158,
  );

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Playlists", item: `${SITE}/playlists.html` },
        { "@type": "ListItem", position: 3, name: p.title },
      ],
    },
    // Every entry has a real url on this site, which is the whole reason this
    // page exists. An ItemList whose entries point nowhere is not eligible for
    // anything and 76 of them were deleted from this site for exactly that.
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: p.title,
      numberOfItems: vids.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: vids.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: v.siteTitle || v.title,
        url: `${SITE}/${v.path}`,
      })),
    },
  ];

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titleFor(p))}</title>
<meta name="description" content="${esc(clipMeta(metaDesc))}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${ogImage(p)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage(p)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${miniCSS(BASE_CSS + wallCss(vids.length) + (strip ? PAGE_CSS : ""))}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> / <a href="/playlists.html">Playlists</a> / <span>${esc(p.title)}</span>
      </nav>
      ${/* Same widow as the card on /playlists.html, and worse here: the h1 is
           display type, so a trailing emoji alone on a line is a whole line of
           Titan One holding one glyph. noWidowEmoji binds the run to the word
           in front of it and drops nothing. The breadcrumb above keeps the
           plain title, because a crumb is one line and never wraps to two. */ ""}<h1>${noWidowEmoji(esc(p.title))}</h1>
${strip}
      <div class="lede pl-blurb" style="max-width:44em">${
        desc ? blurbHtml(desc) : `<p>${vids.length} rip${vids.length === 1 ? "" : "s"}, in playlist order.</p>`
      }</div>
${WALL_H2}
${statLine(vids, newest)}
      <div class="wall">
${(() => { const labels = labelsFor(vids); return vids.map((v) => tile(v, labels, Boolean(run.setId))).join("\n"); })()}
      </div>
${nearby(run)}
      <p style="margin-top:var(--s5)">
        ${run.setId && labelFor("sets", run.setId) ? `<a class="btn btn-ghost btn-sm" href="/sets/${esc(run.setId)}.html">${esc(labelFor("sets", run.setId))} set guide</a>
        ` : ""}<a class="btn btn-ghost btn-sm" href="/playlists.html">All playlists</a>
        <a class="btn btn-ghost btn-sm" href="/videos.html">Every rip</a>
      </p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

  await writeFile(join(OUT, `${slug}.html`), page);
  written += 1;
}

// STAMP THE PATH ONTO THE DATA, the same way sync-youtube.mjs stamps `path`
// onto every video. CLAUDE.md's reason for that applies here word for word:
// shared/paths.mjs owns the URL shape, and if the browser recomputed the slug
// from the title it would be a second implementation free to drift from this
// one, and the drift would show up as a card linking to a 404. The browser
// reads the path it is given and computes nothing.
const stamped = { ...doc, playlists: playlists.map((p) => {
  const has = (p.videoIds || []).length > 0;
  return has ? { ...p, path: `playlists/${slugFor(p)}.html` } : { ...p };
}) };
await writeFile(join(ROOT, "public/data/playlists.json"), JSON.stringify(stamped, null, 1));

console.log(`Wrote ${written} playlist pages to public/playlists/
  ${live.length} playlists with videos, ${playlists.length - live.length} empty and skipped${
    missing ? `\n  ${missing} playlist entries point at videos not in the catalogue (deleted or private), skipped` : ""
  }`);
