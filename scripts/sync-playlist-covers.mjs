#!/usr/bin/env node
// Work out which sealed product each playlist opens, fetch that product's
// photograph, and stamp the answer onto the data.
//
//   node scripts/sync-playlist-covers.mjs
//   node scripts/sync-playlist-covers.mjs --check   resolve and print, write nothing
//
// Then draw the covers:  python3 scripts/build-playlist-covers.py
//
// WHY THIS EXISTS. Every playlist card on /playlists.html used to carry
// YouTube's own cover, which is a frame grabbed from the first video in the run:
// a hand holding a card against a wall. Twenty-one of them, all dark, all
// near-identical, none of them saying which product the playlist opens. A
// playlist called "Pokemon Chaos Rising ETB Opening Series" should show a Chaos
// Rising Elite Trainer Box.
//
// NOT IN build-all.mjs, and check-build.py's _ONE_OFF list records that for the
// python half. This touches the network and writes assets from originals, which
// is exactly the shape of build-packs.py and build-logos.py: run it by hand when
// a playlist appears or a product photograph moves, and commit what it writes.
//
// ---------------------------------------------------------------- THE JOIN
//
// A cover needs a SET and a TYPE, and both are already derivable from things
// this repo owns. Nothing here is a new hand-written table of playlists.
//
//   1. TITLE FIRST, through deriveTags() in shared/taxonomy.mjs. That is the
//      same matcher that tagged every video on the site, pointed at the
//      playlist title instead of a video title. Tim names the product in the
//      title on purpose ("Perfect Order Booster Bundle Series", "Ascended
//      Heroes Elite Trainer Box Pack Series"), so the title is the most direct
//      statement of intent there is. It resolves the SET on all 20 live
//      playlists and the TYPE on 18.
//
//   2. THE PLAYLIST'S OWN VIDEOS SECOND, as a plurality vote over the tags
//      already on them in videos.json. This is the join CLAUDE.md calls
//      reusable: a rip is tagged with what it opened, so a playlist is
//      described by its contents without anybody hand-tagging the playlist.
//      It covers the two titles that say only "Pack Opening Series", which
//      deriveTags cannot read as a product because the single-pack pattern
//      wants the word "booster" next to "pack".
//
//   3. NEITHER, which is Hits Only: 55 videos across 9 sets and 7 product
//      types, so there is no product to photograph. It gets the hand-drawn
//      cover instead. See build-playlist-covers.py.
//
// The title wins over the vote where they disagree, and one playlist disagrees:
// "Journey Together Booster Pack Opening Series" holds two videos and both are
// tagged `blister`. The title says booster pack, the cover shows a Journey
// Together booster pack, and the report notes it. A playlist title is Tim's
// description of the run; the tags describe individual rips inside it.
//
// ------------------------------------------------ WHICH PHOTOGRAPH, AND WHOSE
//
// public/data/products.json is TCGplayer's per-SET product list, so unlike
// /msrp.html this page can have the exact set AND the exact type rather than one
// product standing in for a category: there really is a "Chaos Rising Elite
// Trainer Box" row with its own photograph.
//
// THE TAXONOMY-ID-TO-KIND STEP IS READ OUT OF shared/product-photos.mjs RATHER
// THAN RETYPED. That file already owns the answer to "what is this product type
// called in products.json" for every row on /msrp.html, and its header is four
// paragraphs about what happens when that mapping exists in two places. So
// `etb` reads PRODUCT_PHOTOS.etb[1] and gets "Elite Trainer Box"; only the SET
// is swapped, for the playlist's own. Nothing here writes to that file and
// nothing here depends on its pins, only on the kind names.
//
// THE NAME CHECK CAME WITH IT, in the spirit of the one in that file. If the
// product sitting behind a set-and-kind pair stops belonging to the set we
// asked for, that is a photograph of the wrong box and it fails the run rather
// than shipping quietly. It is looser than the one on /msrp.html for a reason:
// there the caption is hand-written and can disagree with the picture, here the
// alt text is built from the resolved product's own name, so the two cannot
// come apart. What is left to check is the set, which is the half that would
// put a Prismatic Evolutions box on a Perfect Order playlist.
//
// Accents are folded before comparing: taxonomy.mjs says "Pokémon GO" and
// TCGplayer says "Pokemon GO Booster Pack", and an unfolded startsWith would
// fail a correct row.
//
// ------------------------------------------- THE OTHER COPY OF THIS JOIN
//
// scripts/build-playlists.mjs ALREADY DOES A VERSION OF THIS for the individual
// playlist PAGES, with its own `PRODUCT_KIND` table and a `theProduct()` that
// answers the same question. That is a fourth copy of the type-to-kind mapping
// (shared/product-photos.mjs's header names two more, in build-openings.mjs and
// build-how-many-packs.mjs) and folding all of them into one module is the real
// cleanup that header asks for, as its own change. It was NOT done here: another
// agent is editing shared/product-photos.mjs in this tree right now, and a
// four-file refactor landed on top of that is how two half-changes meet.
//
// SO THE TWO ARE CROSS-CHECKED INSTEAD, and they agree today. Read off the built
// pages, comparing the alt text of `.plid-shot` on each /playlists/<slug>.html
// against the product this file resolved for the same playlist: 11 pages name a
// product and all 11 name the SAME one. The other 10 show no product shot at
// all, because `theProduct()` is stricter: it requires EVERY video in the run to
// tag one set and one type, so a run holding one ex Box among its packs falls
// out. This file is looser on purpose, because a COVER may lean on the title Tim
// wrote and a page making a claim in body copy should not. If you change either
// join, re-run that comparison rather than assuming: a card showing an ETB that
// links to a page showing a booster pack is the failure to avoid.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deriveTags, labelFor } from "../shared/taxonomy.mjs";
import { PRODUCT_PHOTOS } from "../shared/product-photos.mjs";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const CACHE = join(ROOT, ".cache/playlist-covers");
const MANIFEST = join(ROOT, "data/playlist-covers.json");

// Where the drawn covers land, and the shape they are drawn at. 4:3 to match
// .pl-thumb, which is `width:118px; aspect-ratio:4/3` at every viewport from
// 360 to 1920, so 360x270 is just over 3x and covers a DPR 3 phone outright.
// build-playlist-covers.py restates these two numbers; if they move, move them
// there in the same edit or the stamped width/height stop describing the file.
const PUB_DIR = "/assets/playlist-covers";
const COVER_W = 360;
const COVER_H = 270;

// The product types a playlist can be about, mapped onto the row ids that
// shared/product-photos.mjs already keys its pins by. The VALUE is a rowId in
// that file, not a products.json kind: the kind is read from the pin, so this
// table cannot drift away from the one on /msrp.html.
//
// Only three, because only three appear in this channel's playlists. A playlist
// about a type that is not here resolves no product and gets no cover, which is
// the hatch case and is correct: the alternative is a nearby box standing in.
const TYPE_ROW = {
  etb: "etb",
  bundle: "bundle",
  "single-pack": "pack-loose",
};

// Hits Only has no single product: 55 videos across 14 sets and 10 product
// types, so there is nothing one photograph could honestly claim to be. Tim
// asked for something custom showing several product types instead, and this is
// where the three it shows are chosen.
//
// MATCHED ON THE PLAYLIST ID rather than on the title, because the title is
// Tim's and can change on YouTube without anything here noticing, and because
// "no set and no product tag" is a state a MIS-TAGGED playlist could also reach.
// A named exception fails loudly if the playlist goes away; a rule that quietly
// catches anything untagged would swallow a tagging bug instead.
//
// THE THREE PRODUCTS ARE ALL GENUINELY IN THIS PLAYLIST, which matters because
// the alt text names them. Counted over the tags on its own 55 videos: Chaos
// Rising ETB is 5 of them, Perfect Order Booster Bundle 2 and Ascended Heroes
// Booster Pack 2. They are one of each of the three types this page has
// photography for, from three different sets, which is what makes the cover read
// as "everything, all of it" rather than as a fourth Chaos Rising card.
const CUSTOM = {
  "PLn62_rIirK-3MK6S68mVy82C4ukzsXuhd": {
    art: "hits",
    file: "hits-only",
    label: "HITS ONLY",
    show: [
      ["chaos-rising", "etb"],
      ["perfect-order", "bundle"],
      ["ascended-heroes", "single-pack"],
    ],
  },
};

/** Fold accents so "Pokémon GO" and "Pokemon GO" compare equal. */
const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const [plDoc, vidDoc, prodDoc, noScan] = await Promise.all([
  readFile(join(ROOT, "public/data/playlists.json"), "utf8").then(JSON.parse),
  readFile(join(ROOT, "public/data/videos.json"), "utf8").then(JSON.parse),
  readFile(join(ROOT, "public/data/products.json"), "utf8").then(JSON.parse),
  readFile(join(ROOT, "data/no-scan.json"), "utf8").then(JSON.parse).catch(() => ({})),
]);

const playlists = plDoc.playlists || [];
const videos = vidDoc.videos || vidDoc;
const byId = new Map(videos.map((v) => [v.id, v]));
const dead = new Set(noScan.deadUrls || []);

/** Plurality vote over the tags on a playlist's own videos. */
function vote(p, group) {
  const n = new Map();
  for (const id of p.videoIds || []) {
    for (const t of byId.get(id)?.[group] || []) n.set(t, (n.get(t) || 0) + 1);
  }
  let best = null;
  for (const [t, c] of n) if (!best || c > best[1]) best = [t, c];
  return best ? { id: best[0], count: best[1], of: (p.videoIds || []).length } : null;
}

/**
 * One set plus one product type -> the photograph of that exact product.
 *
 * Returns `{ setId, setLabel, productType, kind, productId, productName, source }`
 * or `{ error }`. The Hits Only cover resolves its three products through here
 * too, so a hand-picked trio is held to the same set check as an ordinary cover.
 */
function resolve(setId, typeId) {
  const rowId = TYPE_ROW[typeId];
  if (!rowId) {
    return {
      error:
        `the product type "${typeId}" is not in TYPE_ROW in this file, so there is no ` +
        `shared/product-photos.mjs row to read a products.json kind out of. Add it there if ` +
        `products.json holds that kind, or give the playlist a drawn cover in CUSTOM.`,
    };
  }
  const kind = PRODUCT_PHOTOS[rowId]?.[1];
  if (!kind) {
    return {
      error:
        `shared/product-photos.mjs no longer has a row "${rowId}", so there is nothing to read ` +
        `the products.json kind out of. Re-point TYPE_ROW in this file.`,
    };
  }
  const setLabel = labelFor("sets", setId);
  const hit = (prodDoc.sets?.[setId]?.products || []).find((x) => x.kind === kind);
  if (!hit) {
    return {
      error:
        `public/data/products.json holds no ${JSON.stringify(kind)} for the set "${setId}". ` +
        `Re-run scripts/sync-products.mjs, or the set has rotated out of the pull.`,
    };
  }
  // See the header: the alt text is built from this name, so a caption cannot
  // disagree with the picture. What can still go wrong is the SET, and that is
  // what this catches.
  if (!fold(hit.name).startsWith(fold(setLabel))) {
    return {
      error:
        `${setId} / ${JSON.stringify(kind)} resolves to ${JSON.stringify(hit.name)}, which is ` +
        `not a ${setLabel} product. That is one set's photograph under another set's name. ` +
        `Do not ship it.`,
    };
  }
  if (!hit.image || dead.has(hit.image)) {
    return {
      error:
        `${JSON.stringify(hit.name)} has no usable photograph (missing, or listed in ` +
        `data/no-scan.json as a url that 403s). Give the playlist a drawn cover in CUSTOM.`,
    };
  }
  return {
    setId,
    setLabel,
    productType: typeId,
    kind,
    productId: hit.productId,
    productName: hit.name,
    source: hit.image,
  };
}

/**
 * Join the three names in a list the way a person writes one. The alt text is
 * read aloud, so "A, B and C" and not "A, B, C".
 */
const andList = (xs) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

const covers = {};
const rows = [];
const problems = [];

for (const p of playlists) {
  // A playlist with nothing in it does not render a card, so it needs no cover.
  if (!(p.count > 0)) continue;

  const custom = CUSTOM[p.id];
  if (custom) {
    const shown = [];
    let bad = null;
    for (const [sid, tid] of custom.show) {
      const r = resolve(sid, tid);
      if (r.error) { bad = r.error; break; }
      shown.push(r);
    }
    if (bad) {
      problems.push(`${p.title}\n    ${bad}`);
      continue;
    }
    covers[p.id] = {
      art: custom.art,
      file: custom.file,
      label: custom.label,
      products: shown.map((r) => ({
        setId: r.setId,
        productType: r.productType,
        productId: r.productId,
        productName: r.productName,
        source: r.source,
      })),
      // NAMES EVERY PRODUCT IN THE PICTURE, same rule as the single-product
      // covers. A reader who cannot see the image gets told what is in it, not
      // told that it is a cover.
      alt: `Sealed ${andList(shown.map((r) => r.productName))}, on the Hits Only cover`,
      webp: `${PUB_DIR}/${custom.file}.webp`,
      jpg: `${PUB_DIR}/${custom.file}.jpg`,
      w: COVER_W,
      h: COVER_H,
    };
    rows.push([p.title, `${shown.length} products, drawn`, "custom", custom.file]);
    continue;
  }

  const fromTitle = deriveTags({ title: p.title, description: "" });
  const setId = fromTitle.sets[0] || vote(p, "sets")?.id || null;
  const typeId = fromTitle.products[0] || vote(p, "products")?.id || null;
  const how = [fromTitle.sets[0] ? "title" : "tags", fromTitle.products[0] ? "title" : "tags"];

  if (!setId || !typeId) {
    problems.push(
      `${p.title}\n    no ${!setId ? "set" : "product type"} could be resolved from the title or ` +
        `from the tags on its ${p.count} videos. Either it is a genuinely mixed run, in which case ` +
        `give it an entry in CUSTOM above with its own drawn cover, or its videos need tagging.`,
    );
    continue;
  }

  const r = resolve(setId, typeId);
  if (r.error) {
    problems.push(`${p.title}\n    ${r.error}`);
    continue;
  }

  const file = `${setId}-${typeId}`;
  covers[p.id] = {
    art: "product",
    file,
    setId: r.setId,
    setLabel: r.setLabel,
    productType: r.productType,
    kind: r.kind,
    productId: r.productId,
    productName: r.productName,
    source: r.source,
    resolvedFrom: { set: how[0], product: how[1] },
    // NAMES THE PRODUCT IN THE PICTURE, which is the whole reason for the
    // change: the old alt was the empty string on a YouTube frame that said
    // nothing. "Sealed" is not decoration, it is the difference between a
    // photograph of a box and a photograph of what came out of one.
    alt: `Sealed ${r.productName}`,
    webp: `${PUB_DIR}/${file}.webp`,
    jpg: `${PUB_DIR}/${file}.jpg`,
    w: COVER_W,
    h: COVER_H,
  };
  rows.push([p.title, r.productName, `${how[0]}/${how[1]}`, file]);
}

if (problems.length) {
  console.error(`\n${problems.length} playlist(s) could not be resolved to a product:\n`);
  for (const m of problems) console.error("  " + m + "\n");
  process.exit(1);
}

for (const [title, product, how, file] of rows) {
  console.log(`  ${title.slice(0, 46).padEnd(48)} ${product.padEnd(40)} ${how.padEnd(12)} ${file}`);
}
console.log(`\n  ${rows.length} covers resolved`);

if (CHECK) {
  console.log("  --check: nothing written");
  process.exit(0);
}

/* ------------------------------------------------------- fetch the originals -
 *
 * Into .cache/, which is gitignored, exactly like every other sync here: the
 * committed artefact is the DRAWN cover in public/assets/, not the 1000x1000
 * original. A warm cache makes this a no-op, so re-running costs nothing.
 */
await mkdir(CACHE, { recursive: true });
let fetched = 0;
let warm = 0;
// One entry per PRODUCT, not per cover: the Hits Only cover names three, and two
// covers could name the same box without anybody meaning them to.
const wanted = new Map();
for (const c of Object.values(covers)) {
  for (const q of c.products || [c]) if (q.source) wanted.set(q.productId, q.source);
}
for (const [productId, url] of wanted) {
  const dest = join(CACHE, `${productId}.jpg`);
  const have = await readFile(dest).then(() => true).catch(() => false);
  if (have) { warm += 1; continue; }
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`\n  ${url} answered ${res.status}. Nothing written.`);
    process.exit(1);
  }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  fetched += 1;
}
console.log(`  originals: ${fetched} fetched, ${warm} already cached`);

/* --------------------------------------------------------------- write it out */

const manifest = {
  _readme:
    "Written by scripts/sync-playlist-covers.mjs. Which sealed product each playlist opens, and " +
    "whose photograph it is. Drawn into public/assets/playlist-covers/ by " +
    "scripts/build-playlist-covers.py. Product photographs are TCGplayer's, set logos are " +
    "The Pokemon Company's, and /playlists.html credits both.",
  syncedAt: localDay(),
  source: "TCGplayer, via public/data/products.json",
  size: { w: COVER_W, h: COVER_H },
  covers,
};
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");

// STAMPED ONTO playlists.json the same way build-playlists.mjs stamps `path`,
// and for the same reason CLAUDE.md gives there: app.js cannot import a module,
// so if the browser rebuilt the cover url from the title it would be a second
// implementation free to drift from this one. The browser reads what it is
// given and computes nothing. build-playlists.mjs spreads `...p` when it
// re-stamps, so this survives that run; sync-youtube.mjs rewrites the file
// wholesale, so re-run this after a sync.
const stamped = {
  ...plDoc,
  playlists: playlists.map((p) => {
    const c = covers[p.id];
    if (!c) return { ...p };
    // setId AND setLabel TRAVEL WITH THE COVER so /playlists.html can group the
    // grid by set. Tim, 23 August 2026: "sort them by set type so every product
    // from the set are showing together." This file is the only one that works
    // out which product a playlist opens, so it is the only one that can say
    // which SET that product belongs to; build-proto.mjs reading a second file
    // to answer the same question is how two builders come to disagree.
    return {
      ...p,
      cover: { webp: c.webp, jpg: c.jpg, w: c.w, h: c.h, alt: c.alt },
      setId: c.setId || null,
      setLabel: c.setLabel || null,
      productType: c.productType || null,
    };
  }),
};
await writeFile(join(ROOT, "public/data/playlists.json"), JSON.stringify(stamped, null, 1));

console.log(`  wrote data/playlist-covers.json and stamped ${Object.keys(covers).length} covers onto public/data/playlists.json
  now run: python3 scripts/build-playlist-covers.py`);
