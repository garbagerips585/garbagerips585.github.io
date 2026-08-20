#!/usr/bin/env node
// The 27 First Partner Illustration Collection promos: identity, official
// artwork, and PriceCharting's raw and PSA 10 figures read TWICE.
//
//   node scripts/sync-first-partner.mjs            crawl, verify, write
//   node scripts/sync-first-partner.mjs --report   read the cache, write nothing
//
// Writes data/first-partner.json and mirrors the official card images into
// public/assets/first-partner/. Then: node scripts/build-first-partner.mjs.
//
// ---------------------------------------------------------------------------
// NOT IN build-all.mjs, AND THAT IS THE STANDING ARRANGEMENT
// ---------------------------------------------------------------------------
//
// Same call as sync-decks.mjs, sweep-scans.mjs and the two Topps syncs: this
// makes a few hundred requests against PriceCharting and pokemon.com, and what
// it records is a dated measurement. A scheduled build must not depend on a
// step that is not scheduled. build-first-partner.mjs IS in build-all.mjs and
// reads only the file this writes.
//
// ---------------------------------------------------------------------------
// WHY THIS PRODUCT NEEDED ITS OWN SYNC
// ---------------------------------------------------------------------------
//
// The 27 promos are MEP 037 to MEP 063, and none of the site's existing price
// machinery reaches them. sync-pricecharting-cards.mjs prices the 28 SET
// guides off PC_CONSOLES, and there is no console in that map for promos.
// TCGdex holds the set (`mep`) but carries NO IMAGE for any of these cards and
// knows only 037-045; 046-063 are absent from it entirely. So neither of the
// site's two usual card sources can draw this page.
//
// ---------------------------------------------------------------------------
// THE COLLISION THAT MAKES NAME+NUMBER THE KEY, AND NOT NUMBER ALONE
// ---------------------------------------------------------------------------
//
// PriceCharting files every English promo, from every era, in ONE console
// (/console/pokemon-promo) and titles them "<Name> #<number>" with no set
// code. The numbers therefore collide across promo sets, and they collide on
// exactly these numbers:
//
//     MEP 037 Bulbasaur   SVP 037 Cleffa
//     MEP 043 Rowlet      SVP 043 Eevee
//     MEP 046 Chikorita   SVP 046 Bulbasaur
//     MEP 048 Totodile    SVP 048 Squirtle
//
// Matching on the number alone would have priced Chikorita off an SVP
// Bulbasaur. Every lookup below is therefore keyed on the NAME and the NUMBER
// together, and NAMES is checked to be collision free within the 27 before any
// row is accepted. This is the same failure sync-pricecharting-cards.mjs's
// standard-printing allowlist exists to stop, arriving through a different
// door.
//
// A row carrying a bracketed printing (`[Jumbo]`, `[Poke Ball]`) is REFUSED
// rather than taken, for the reason that file records at length: the dearest
// product filed against a collector number is usually not the card.
//
// ---------------------------------------------------------------------------
// THE DOUBLE READ IS THE SAME GATE THE REST OF THE SITE IS HELD TO
// ---------------------------------------------------------------------------
//
// Nothing out of PriceCharting is publishable on this site on a single read.
// Every figure here is read once off the console LISTING page and once off the
// card's own PRODUCT page, through the two different parsers in
// shared/pricecharting.mjs, because `new_price` means PSA 10 on one template
// and Grade 8 on the other. Same TOLERANCE (15%) and the same reconciliation
// against PriceCharting's own reported change as verify-raw-top.mjs.
//
// A column that does not agree is written with its status and NO published
// figure. build-first-partner.mjs prints only what says "agree".
//
// ---------------------------------------------------------------------------
// THE IMAGES ARE THE PUBLISHER'S AND THEY ARE MIRRORED, NOT HOTLINKED
// ---------------------------------------------------------------------------
//
// The only scans of these 27 cards anywhere are the ones The Pokemon Company
// publishes on its own product galleries. They are fetched once and written to
// public/assets/first-partner/, the same arrangement /assets/species/ has and
// for the same reason recorded under "WHO'S THAT POKEMON WAS HOTLINKING":
// this site does not make a reader's browser fetch somebody else's origin.
// The page credits pokemon.com by name for them.
//
// THREE PATHS EXIST AND THE BIGGEST ONE IS COMPLETE. Measured 19 August 2026,
// all 27 cards, status AND body size AND the PNG's own IHDR dimensions:
//
//   .../cards/full/MEP/MEP_EN_<n>.png          420x585   200 on ALL 27
//   .../cards/web/MEP/MEP_EN_<n>.png           245x342   200 on 037-054, 403 on 055-063
//   .../cards/site_search/MEP/MEP_EN_<n>.png   160x224   200 on all 27
//
// `high_res` and `detail` answer 403 on all 27, so `full` is the largest
// rendition the publisher has released.
//
// **THIS FILE USED TO CLAIM SERIES 3 WAS THUMBNAIL-ONLY AND THAT WAS WRONG.**
// It read the 403 on `web` as a fact about the CARDS when it is a fact about
// ONE PATH: the nine Series 3 cards are refused on `web` and served on `full`,
// at 420x585, from a url the gallery HTML links directly. The sync had simply
// never tried `full`. Nine cards shipped at 160x224 for it, and the page
// printed a sentence about the publisher that was not true. **A 403 ON ONE
// PATH IS NOT PROOF OF ABSENCE ANYWHERE** -- which is the same trap
// build-topps.mjs records from the other direction -- and the fix is to probe
// every path before writing a claim about what a publisher holds, not to
// retry the one path harder.
//
// TWO RENDITIONS SHIP, 245w AND 420w, and that is a measurement rather than a
// preference. The panorama strip renders each card at 121 CSS px at 390 and
// 227 at 1440, so a retina desktop needs 454 device px and a phone needs 242.
// One file cannot serve both: 245w alone leaves the desktop upscaled (which is
// what it was, on all 27, before this), and 420w alone charges every phone
// +882KB across the 27 for pixels it cannot show. So both are written and the
// `<source>` carries a `w` ladder. Nothing is upscaled at any width.

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePage, productColumns, columnChange, CONSOLE_HEADERS } from "../shared/pricecharting.mjs";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache/pricecharting-promo");
const IMGDIR = join(ROOT, "public/assets/first-partner");
const OUT = join(ROOT, "data/first-partner.json");
const REPORT = process.argv.includes("--report");

const CONSOLE_PATH = "/console/pokemon-promo";
const PC = "https://www.pricecharting.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Same 15% as verify-raw-top.mjs, and for the reason that file states: the
// second read proves we read the RIGHT COLUMN, not that the market held still.
const TOLERANCE = 0.15;

// ---------------------------------------------------------------------------
// THE 27, AND EVERY FIELD HERE WAS READ OFF THE OFFICIAL ARTWORK
// ---------------------------------------------------------------------------
//
// Name, collector number and series were confirmed by opening each of the 27
// card images published on the three pokemon.com product galleries and reading
// the card. That matters because only 037-045 exist in TCGdex, so for 18 of
// these the publisher's own picture is the only record there is. The MEP set
// code, the "EN" language mark and the 2026 copyright line are legible on the
// cards themselves.
const CARDS = [
  // Series 1 -- Kanto, Sinnoh, Alola. pokemon.com gallery, launch 20 Mar 2026.
  { n: 37, name: "Bulbasaur", region: "Kanto", series: 1, hp: 80, attack: "Leech Seed" },
  { n: 38, name: "Charmander", region: "Kanto", series: 1, hp: 80, attack: "Ember" },
  { n: 39, name: "Squirtle", region: "Kanto", series: 1, hp: 80, attack: "Bubble" },
  { n: 40, name: "Turtwig", region: "Sinnoh", series: 1, hp: 90, attack: "Razor Leaf" },
  { n: 41, name: "Chimchar", region: "Sinnoh", series: 1, hp: 60, attack: "Fury Swipes" },
  { n: 42, name: "Piplup", region: "Sinnoh", series: 1, hp: 70, attack: "Peck" },
  { n: 43, name: "Rowlet", region: "Alola", series: 1, hp: 70, attack: "Tackle" },
  { n: 44, name: "Litten", region: "Alola", series: 1, hp: 70, attack: "Fire Fang" },
  { n: 45, name: "Popplio", region: "Alola", series: 1, hp: 70, attack: "Disarming Voice" },
  // Series 2 -- Johto, Unova, Galar. pokemon.com gallery, launch 19 Jun 2026.
  { n: 46, name: "Chikorita", region: "Johto", series: 2, hp: 70, attack: "Razor Leaf" },
  { n: 47, name: "Cyndaquil", region: "Johto", series: 2, hp: 70, attack: "Tackle" },
  { n: 48, name: "Totodile", region: "Johto", series: 2, hp: 80, attack: "Bite" },
  { n: 49, name: "Snivy", region: "Unova", series: 2, hp: 60, attack: null },
  { n: 50, name: "Tepig", region: "Unova", series: 2, hp: 80, attack: null },
  { n: 51, name: "Oshawott", region: "Unova", series: 2, hp: 70, attack: null },
  { n: 52, name: "Grookey", region: "Galar", series: 2, hp: 70, attack: null },
  { n: 53, name: "Scorbunny", region: "Galar", series: 2, hp: 70, attack: null },
  { n: 54, name: "Sobble", region: "Galar", series: 2, hp: 70, attack: null },
  // Series 3 -- Hoenn, Kalos, Paldea. pokemon.com gallery, launch 7 Aug 2026.
  { n: 55, name: "Treecko", region: "Hoenn", series: 3, hp: 70, attack: null },
  { n: 56, name: "Torchic", region: "Hoenn", series: 3, hp: 60, attack: null },
  { n: 57, name: "Mudkip", region: "Hoenn", series: 3, hp: 70, attack: null },
  { n: 58, name: "Chespin", region: "Kalos", series: 3, hp: 70, attack: null },
  { n: 59, name: "Fennekin", region: "Kalos", series: 3, hp: 70, attack: null },
  { n: 60, name: "Froakie", region: "Kalos", series: 3, hp: 70, attack: null },
  { n: 61, name: "Sprigatito", region: "Paldea", series: 3, hp: 70, attack: "Leafage" },
  { n: 62, name: "Fuecoco", region: "Paldea", series: 3, hp: 90, attack: "Flamethrower" },
  { n: 63, name: "Quaxly", region: "Paldea", series: 3, hp: 70, attack: "Wing Attack" },
];

// A name repeated inside the 27 would make the name+number key ambiguous the
// moment PriceCharting filed two of them. It does not happen today and the
// check is cheap, so it is made rather than assumed.
{
  const seen = new Set();
  for (const c of CARDS) {
    const k = `${c.name.toLowerCase()}#${c.n}`;
    if (seen.has(k)) throw new Error(`duplicate card key ${k}`);
    seen.add(k);
  }
  if (CARDS.length !== 27) throw new Error(`expected 27 cards, have ${CARDS.length}`);
}

const IMG_BASE = "https://www.pokemon.com/static-assets/content-assets/cms2/img/cards";
const GALLERY = (s) =>
  `https://www.pokemon.com/us/pokemon-tcg/product-gallery/first-partner-illustration-collection-series-${s}`;

// ---------------------------------------------------------------------------
// THE PACKAGING SHOT, WHICH THE FIRST PASS OF THIS FILE MISSED ENTIRELY
// ---------------------------------------------------------------------------
//
// This script mirrored 27 CARDS and no PRODUCT. A page about a boxed product
// that never shows the box fails the reader it is written for: somebody stood
// in a Target holding one of these, trying to work out which series it is.
// Every other product page on this site shows the box.
//
// Each of the three galleries leads with one, and it is the same asset the
// page's own og:image points at:
//
//   .../first-partner-illustration-collection/series-<n>/
//       first-partner-illustration-collection-169-en.png     578x325 PNG
//
// ALL THREE EXIST AND ALL THREE ARE THE PACKAGE, not key art: the blister
// with its three booster packs visible through the window, the FIRST PARTNER
// ILLUSTRATION COLLECTION lockup and the SERIES <n> flash along the foot,
// which is exactly the strip a shopper reads off a shelf.
//
// 578x325 IS THE ONLY RENDITION. `-2x-en`, `-detail-en`, `-product-en` and
// five other plausible names were probed and every one answered **403**, which
// on this CDN is what a missing file answers -- the same trap the card sizes
// hit below and build-topps.mjs records from the other direction. So this is
// what the publisher has released and nothing here is upscaled.
//
// CROPPED TO THE PACKAGE, AND THAT IS THE ONE EDIT MADE TO IT. The 169 asset
// is a 16:9 marketing frame: the package occupies the middle ~52% and the rest
// is a rainbow gradient backdrop. Shown whole in a three-up row the box itself
// would land at about 140px and be useless for matching a shelf. The crop is
// the publisher's own photograph with its backdrop trimmed -- not a composite,
// not a resample, nothing added -- and it roughly doubles the pixels on the
// only part of the frame anybody needs. One rectangle serves all three because
// the three share one template; it was checked against all three, and it
// leaves a margin of backdrop on every side rather than cutting to the edge,
// so a package sitting slightly differently in frame still cannot clip.
const PKG_BASE =
  "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/" +
  "series/incrementals/2026/first-partner-illustration-collection";
const PKG_CROP = [140, 8, 440, 318]; // -> 300x310 of the 578x325 frame

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function cached(url, key, { binary = false } = {}) {
  await mkdir(CACHE, { recursive: true });
  const file = join(CACHE, `${key}-${createHash("sha1").update(url).digest("hex").slice(0, 12)}${binary ? ".bin" : ".html"}`);
  try {
    await stat(file);
    return binary ? readFile(file) : readFile(file, "utf8");
  } catch {}
  if (REPORT) return binary ? null : "__NOCACHE__";
  await sleep(1100); // one request a second against somebody else's server
  const r = await fetch(url, { headers: { "user-agent": UA, referer: PC + CONSOLE_PATH } });
  if (!r.ok) {
    const marker = `__HTTP_${r.status}__`;
    if (binary) return null;
    return marker;
  }
  if (binary) {
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(file, buf);
    return buf;
  }
  const html = await r.text();
  await writeFile(file, html);
  return html;
}

/** Walk the promo console until every card is found or the listing runs out. */
async function crawlListing() {
  const want = new Map(CARDS.map((c) => [`${norm(c.name)}#${c.n}`, c]));
  const found = new Map();
  let cursor = null;
  let pages = 0;
  while (found.size < want.size && pages < 80) {
    const url = `${PC}${CONSOLE_PATH}${cursor == null ? "" : `?cursor=${cursor}`}`;
    const html = await cached(url, `list-${cursor ?? 0}`);
    if (/^__(HTTP_\d+|NOCACHE)__$/.test(html)) break;
    const { rows, next, headers } = parsePage(html);
    // The header contract, refused rather than read positionally. Same check
    // sync-graded-top.mjs makes, and the reason shared/pricecharting.mjs
    // decodes entities before trimming.
    if (headers.join("|") !== CONSOLE_HEADERS.join("|")) {
      throw new Error(`unexpected console headers: ${headers.join("|")}`);
    }
    pages += 1;
    for (const row of rows) {
      // A bracketed qualifier is a different PRODUCT of the same number.
      if (/\[[^\]]+\]/.test(row.name)) continue;
      const m = /^(.*?)\s*#\s*(\d+)\s*$/.exec(row.name);
      if (!m) continue;
      const key = `${norm(m[1])}#${Number(m[2])}`;
      if (!want.has(key) || found.has(key)) continue;
      found.set(key, { row, card: want.get(key) });
    }
    if (next == null) break;
    cursor = next;
  }
  return { found, pages };
}

/**
 * One PNG to the .webp/.avif pair, through PIL.
 *
 * PYTHON RATHER THAN NODE ON PURPOSE, and it is the convention already: every
 * image this repo encodes goes through PIL (build-packs.py writes both pack
 * renditions, build-logos.py and build-favicon.py the rest). There is no sharp
 * in this tree and adding a native dependency to write 54 files would be a
 * larger change than the feature. Quality 78 WebP and 60 AVIF are the numbers
 * build-packs.py settled on and CLAUDE.md records the PSNR work behind them.
 */
async function encode(png, name, { crop = null, resize = null } = {}) {
  const out = join(IMGDIR, name);
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert("RGBA")
${crop ? `im = im.crop(tuple(${JSON.stringify(crop)}))` : ""}
${resize ? `im = im.resize(tuple(${JSON.stringify(resize)}), Image.LANCZOS)` : ""}
print(im.size[0], im.size[1])
im.save(${JSON.stringify(out)} + ".webp", "WEBP", quality=78, method=6)
im.save(${JSON.stringify(out)} + ".avif", "AVIF", quality=60)
`;
  const { execFile } = await import("node:child_process");
  // PIL reports the dimensions it actually wrote rather than this file
  // asserting them, so a crop that moves cannot leave the JSON claiming a size
  // the file on disk does not have. Same reason the card loop below takes its
  // width and height from the size it fetched.
  const stdout = await new Promise((res, rej) =>
    execFile("python3", ["-c", py], (e, so) => (e ? rej(e) : res(so)))
  );
  const [w, h] = stdout.trim().split(/\s+/).map(Number);
  if (!w || !h) throw new Error(`encode ${name}: no dimensions back from PIL`);
  return { width: w, height: h };
}

function judge(listing, product) {
  if (listing == null && product == null) return "none";
  if (listing == null || product == null) return "onesided";
  return Math.abs(product - listing) / listing <= TOLERANCE ? "agree" : "disagree";
}

async function main() {
  const { found, pages } = await crawlListing();
  console.log(`listing: ${pages} pages, ${found.size} of 27 matched`);

  const out = [];
  for (const card of CARDS) {
    const hit = found.get(`${norm(card.name)}#${card.n}`);
    const rec = {
      number: String(card.n).padStart(3, "0"),
      name: card.name,
      region: card.region,
      series: card.series,
      hp: card.hp,
      attack: card.attack,
      illustrator: "Saboteri",
      gallery: GALLERY(card.series),
      img: null,
      imgWidth: null,
      imgHeight: null,
      pc: null,
    };
    if (hit) {
      const purl = hit.row.path.startsWith("http") ? hit.row.path : PC + hit.row.path;
      const html = await cached(purl, `prod-${card.n}`);
      const pc = { url: purl, title: hit.row.name, id: hit.row.id, cols: {} };
      const prod = productColumns(html);
      for (const [key, header, li] of [
        ["raw", "Ungraded", hit.row.ungraded],
        ["psa10", "PSA 10", hit.row.psa10],
      ]) {
        const pv = prod.cols ? (prod.cols[header] ?? null) : null;
        const status = prod.error ? "unreadable" : judge(li ?? null, pv);
        const cell = { listing: li ?? null, product: pv, status };
        if (status === "disagree") {
          const change = columnChange(html, header);
          if (change != null) cell.reconciles = Number((pv - change).toFixed(2));
        }
        // ONLY an agreeing column carries a published figure. The two readings
        // stay in the file either way, so a later reader can see what was
        // refused and why rather than finding a blank.
        cell.value = status === "agree" ? pv : null;
        pc.cols[key] = cell;
      }
      rec.pc = pc;
    }
    out.push(rec);
  }

  // ------------------------------------------------------------------ images
  await mkdir(IMGDIR, { recursive: true });
  let done = 0;
  for (const rec of out) {
    const n = Number(rec.number);
    const url = `${IMG_BASE}/full/MEP/MEP_EN_${n}.png`;
    const buf = await cached(url, `img-full-${n}`, { binary: true });
    // A real image body, not a 200 on an error page. Same test
    // sync-topps-images.mjs applies: only a genuine PNG sets the field.
    if (!(buf && buf.length > 2000 && buf.slice(1, 4).toString() === "PNG")) continue;
    // THE PNG IS NOT WHAT SHIPS. pokemon.com serves these as PNG and the 27
    // of them are 11.9MB, which is the same mistake /rarity.html made with a
    // 1.1MB Scrydex PNG: "THE LESSON IS THE HOST, NOT THE CARD". They are
    // re-encoded to WebP and AVIF, the pair build-packs.py writes for the
    // pack art, and the page emits a <picture> with the AVIF in front. The
    // PNG is kept OUT of public/ entirely; the original stays in the cache.
    await writeFile(join(CACHE, `png-${rec.number}.png`), buf);
    const src = join(CACHE, `png-${rec.number}.png`);
    // TWO RENDITIONS, AND THE SMALL ONE IS STILL THE `src`. See the header:
    // 245w satisfies the strip on a phone and on a DPR 1 desktop, 420w is the
    // only one that satisfies it at 1440 DPR 2. A single file cannot do both
    // without either softening the desktop or charging the phone 882KB it has
    // no use for, so the ladder is what ships and the browser picks.
    const small = await encode(src, `mep-${rec.number}`, { resize: [245, 342] });
    const large = await encode(src, `mep-${rec.number}-420`);
    rec.img = `/assets/first-partner/mep-${rec.number}.webp`;
    rec.imgWidth = small.width;
    rec.imgHeight = small.height;
    rec.imgLarge = `/assets/first-partner/mep-${rec.number}-420.webp`;
    rec.imgLargeWidth = large.width;
    rec.imgLargeHeight = large.height;
    done += 1;
  }
  console.log(`images: ${done} of 27 at 245x342 + 420x585, ${27 - done} missing`);

  // --------------------------------------------------------------- packaging
  // One per series, mirrored on the same terms as the card scans and cropped
  // to the package. See the note beside PKG_BASE. A series whose shot cannot be
  // fetched gets NO entry rather than another series' box, and
  // build-first-partner.mjs says out loud which one is missing.
  const packaging = [];
  for (const n of [1, 2, 3]) {
    const url = `${PKG_BASE}/series-${n}/first-partner-illustration-collection-169-en.png`;
    const buf = await cached(url, `pkg-${n}`, { binary: true });
    // The same body test the card loop makes, and it is doing real work here:
    // this CDN answers a missing asset with a 403 and a 111 byte body, so a
    // status check alone would let an error page through as a photograph.
    if (!(buf && buf.length > 2000 && buf.slice(1, 4).toString() === "PNG")) {
      console.log(`packaging: series ${n} MISSING (${buf ? `${buf.length} bytes, not a PNG` : "no body"})`);
      continue;
    }
    const png = join(CACHE, `pkg-${n}.png`);
    await writeFile(png, buf);
    const { width, height } = await encode(png, `box-series-${n}`, { crop: PKG_CROP });
    packaging.push({
      series: n,
      img: `/assets/first-partner/box-series-${n}.webp`,
      imgWidth: width,
      imgHeight: height,
      source: url,
      gallery: GALLERY(n),
      crop: PKG_CROP,
    });
  }
  console.log(`packaging: ${packaging.length} of 3 boxes`);

  const agree = out.filter((r) => r.pc?.cols.raw.status === "agree").length;
  const psa = out.filter((r) => r.pc?.cols.psa10.status === "agree").length;
  console.log(`prices: raw agrees on ${agree}, PSA 10 agrees on ${psa}`);

  const doc = {
    _readme: [
      "The 27 First Partner Illustration Collection promos, MEP 037 to MEP 063.",
      "",
      "IDENTITY (name, number, region, series, HP) was read off the official card",
      "artwork on the three pokemon.com product galleries. TCGdex holds only",
      "037-045 of this set and carries no image for any of them, so for eighteen",
      "of these cards the publisher's own picture is the only record that exists.",
      "",
      "PRICES are PriceCharting's, read TWICE through the two different parsers",
      "in shared/pricecharting.mjs, once off the /console/pokemon-promo listing",
      "and once off the card's own product page. A column only carries a `value`",
      "when the two reads agree within 15%. Both readings stay on every row so a",
      "refusal is visible rather than blank. Never publish a figure whose status",
      "is not 'agree'.",
      "",
      "The name+number key is load bearing: PriceCharting files every English",
      "promo in one console with no set code, and SVP collides with MEP on four",
      "of these numbers. See the header of scripts/sync-first-partner.mjs.",
      "",
      "PACKAGING is one product shot per series, the image each official gallery",
      "leads with, mirrored on the same terms as the card scans and cropped to",
      "the package out of its 16:9 marketing frame. `crop` records the rectangle",
      "taken. A series with no obtainable shot gets no entry here at all and the",
      "page names it rather than borrowing another series' box.",
    ],
    checked: localDay(),
    priceSource: "PriceCharting",
    priceSourceUrl: PC + CONSOLE_PATH,
    imageSource: "pokemon.com product galleries",
    cards: out,
    packaging,
  };
  if (REPORT) {
    console.log(JSON.stringify(doc, null, 1).slice(0, 2000));
    return;
  }
  await writeFile(OUT, JSON.stringify(doc, null, 1) + "\n");
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
