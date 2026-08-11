#!/usr/bin/env node
// Fill the homepage prototype with real data.
//
//   node scripts/build-proto.mjs
//
// Everything the page shows comes from public/data/videos.json and sets.json:
// the filter counts, the Hall of Fame, the newest rips, the most watched, and
// the Set 101 band. Nothing on the page is a number anyone typed, so what the
// prototype shows is what the real homepage will show.
//
// Idempotent: each region is replaced between its own pair of markers.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "public/proto-wall.html");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ data -- */

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const rawVideos = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const videos = rawVideos.videos || rawVideos;

const setName = new Map(sets.map((s) => [s.id, s.name]));

const dirSet = async (sub, suffix) =>
  new Set(
    (await readdir(join(ROOT, "public/assets", sub)))
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.replace(suffix, ""))
  );
const packs = await dirSet("packs", /-garbage-rips-585-booster-pack\.webp$/);
const logos = await dirSet("logos", /-pokemon-tcg-set-logo\.webp$/);

/* ------------------------------------------------------------- formatting - */

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function shortDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`.trim() + (Number(y) < new Date().getFullYear() ? ` ${y}` : "");
}
function monthYear(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] || ""} ${y}`.trim();
}
function clock(sec) {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function compact(n) {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "")}K` : String(n);
}

/* ------------------------------------------------------------------ tiles - */

// The pull ladder, richest first. These are the tags shared/taxonomy.mjs
// assigns, and the label is what the card's own rarity symbol means.
const PULL_RANK = [
  ["gold", "&starf;&starf;&starf; HYPER"],
  ["sir", "&starf;&starf; SIR"],
  ["ir", "&starf; IR"],
  ["double-rare", "&starf;&starf; DOUBLE"],
  ["charizard", "CHARIZARD"],
];
const pullIndex = new Map(PULL_RANK.map(([k], i) => [k, i]));

function bestPull(v) {
  let best = null;
  for (const p of v.pulls || []) {
    const i = pullIndex.get(p);
    if (i != null && (best == null || i < best)) best = i;
  }
  return best;
}

/**
 * One video tile.
 *
 * The face is the booster wrapper for the video's set, never YouTube's poster
 * frame: the poster is almost always the pulled card, so it spoils the video
 * before you press play. A video with no set tag, or a set with no artwork
 * yet, falls back to the set logo on a plain field rather than to a broken
 * image or a spoiler.
 */
function tile(v, { rank = null, showSet = true } = {}) {
  const set = (v.sets || [])[0] || null;
  const hasPack = set && packs.has(set);
  const face = hasPack
    ? `<img src="assets/packs/${set}-garbage-rips-585-booster-pack.webp" alt="" loading="lazy">`
    : `<span class="art-none">${
        set && logos.has(set)
          ? `<img src="assets/logos/${set}-pokemon-tcg-set-logo.webp" alt="" loading="lazy">`
          : `<b>Garbage Rips</b>`
      }</span>`;

  const p = bestPull(v);
  const flag = p != null && rank == null ? `<span class="hit">${PULL_RANK[p][1]}</span>` : "";
  const badge = rank != null ? `<span class="rank">${rank}</span>` : "";

  // The meta line is one line, so it has to earn every character. In the wall
  // the wrapper already names the set, so the useful pair is popularity and
  // recency. On the Hall of Fame shelf the date is irrelevant, so the set
  // takes its place.
  const meta = showSet
    ? `${(setName.get(set) || set || "Garbage Rips").toUpperCase()} &bull; ${compact(v.views)} VIEWS`
    : `${compact(v.views)} VIEWS &bull; ${shortDate(v.published).toUpperCase()}`;

  return `      <article class="v"><a class="art" href="/${esc(v.path)}">${badge}${flag}${face}<span class="play"></span>${
    v.duration ? `<span class="dur">${clock(v.duration)}</span>` : ""
  }</a>
        <h3>${esc(v.title)}</h3><p>${meta}</p></article>`;
}

/* ------------------------------------------------------------- selections - */

const byNewest = [...videos].sort((a, b) =>
  String(b.published).localeCompare(String(a.published)) || (b.views || 0) - (a.views || 0)
);

// Hall of Fame: a real pull outranks a big view count, and views break ties
// inside a tier. This is a stand-in until the Greatest Hits playlist exists on
// YouTube, which is what the production page will key off.
//
// One per set. Strict ranking put three identical Destined Rivals wrappers in
// the first three slots, which reads as a duplicate render rather than as three
// different rips. Taking each set's best pull instead keeps the order honest
// (the heading says "ranked", and it is) while making every wrapper different.
// The full ranking is one tap away behind "All hits".
//
// Needs a wrapper to show, so a hit with no set tag is skipped here rather
// than rendering the fallback tile in the most prominent row on the page. It
// still counts toward "All hits" and still has its own page.
const HALL_PER_SET = 1;
const hall = [];
const perSet = {};
for (const v of videos
  .filter((v) => bestPull(v) != null && packs.has((v.sets || [])[0]))
  .sort((a, b) => bestPull(a) - bestPull(b) || (b.views || 0) - (a.views || 0))) {
  const s = (v.sets || [])[0] || "_";
  if ((perSet[s] = (perSet[s] || 0) + 1) > HALL_PER_SET) continue;
  hall.push(v);
  if (hall.length === 8) break;
}

const mostWatched = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 6);

const setCounts = {};
const productCounts = {};
for (const v of videos) {
  for (const s of v.sets || []) setCounts[s] = (setCounts[s] || 0) + 1;
  for (const p of v.products || []) productCounts[p] = (productCounts[p] || 0) + 1;
}
const PRODUCT_LABELS = {
  "single-pack": "Single pack", etb: "ETB", bundle: "Booster bundle", "ex-box": "ex box",
  tin: "Tin", blister: "Blister", "collection-box": "Collection box", upc: "UPC",
};

const topSets = Object.entries(setCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
const hitCount = videos.filter((v) => bestPull(v) != null).length;

/* ------------------------------------------------------------------ logos - */

/**
 * Read a WebP's pixel dimensions from its header.
 *
 * Worth the 20 lines: these logos range from 1.3:1 (151) to 5:1 (Mega
 * Evolution), and sizing them all to one height makes the wide ones look half
 * the size of the tall ones. Sizing by area instead needs the real aspect
 * ratio, and only the file knows it.
 */
function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  if (fourcc === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

const BOX_W = 144, TARGET_AREA = 5000, MIN_H = 34, MAX_H = 58;

async function logoHeight(id) {
  try {
    const size = webpSize(await readFile(join(ROOT, `public/assets/logos/${id}-pokemon-tcg-set-logo.webp`)));
    if (!size?.h) return null;
    const ratio = size.w / size.h;
    return Math.round(Math.min(Math.min(MAX_H, Math.max(MIN_H, Math.sqrt(TARGET_AREA / ratio))), BOX_W / ratio));
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- regions */

const railHtml = [
  `    <a class="chip" href="/videos.html" aria-current="page">Latest <span class="n">${videos.length}</span></a>`,
  `    <a class="chip gold" href="/videos.html?pull=1">Hits only <span class="n">${hitCount}</span></a>`,
  ...topSets.map(([id, n]) =>
    `    <a class="chip" href="/videos.html?set=${id}">${esc(setName.get(id) || id)} <span class="n">${n}</span></a>`),
  ...topProducts.map(([id, n]) =>
    `    <a class="chip" href="/videos.html?product=${id}">${esc(PRODUCT_LABELS[id] || id)} <span class="n">${n}</span></a>`),
  `    <a class="chip" href="/sets/">All ${sets.length} sets &rarr;</a>`,
].join("\n");

const hallHtml = hall.map((v, i) => tile(v, { rank: i + 1, showSet: true })).join("\n");
const latestHtml = byNewest.slice(0, 6).map((v) => tile(v, { showSet: false })).join("\n");
const watchedHtml = mostWatched.map((v) => tile(v, { showSet: false })).join("\n");

const ordered = [...sets].sort((a, b) => String(b.released).localeCompare(String(a.released)));
const setsHtml = (
  await Promise.all(
    ordered.map(async (s) => {
      const n = setCounts[s.id] || 0;
      const total = s.total || s.printedTotal;
      const bits = [total ? `${total} cards` : null, monthYear(s.released) || null].filter(Boolean);
      const h = logos.has(s.id) ? await logoHeight(s.id) : null;
      const face = h
        ? `<img src="assets/logos/${s.id}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" style="--lh:${h}px">`
        : `<span class="set-name">${esc(s.name)}</span>`;
      return `        <a class="set" href="/sets/${s.id}.html">
          <span class="set-art">${face}</span>
          <b>${esc(s.name)}</b>
          <span class="set-meta">${esc(bits.join(" · "))}</span>
          ${n ? `<span class="set-rips">${n} rip${n === 1 ? "" : "s"}</span>` : ""}
        </a>`;
    })
  )
).join("\n");

const REGIONS = {
  RAIL: railHtml,
  HOF: hallHtml,
  LATEST: latestHtml,
  WATCHED: watchedHtml,
  SETS101: setsHtml,
  COUNT_ALL: String(videos.length),
  COUNT_HITS: String(hitCount),
  COUNT_SETS: String(sets.length),
};

let html = await readFile(TARGET, "utf8");
for (const [name, body] of Object.entries(REGIONS)) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a === -1 || b === -1) {
    console.error(`Marker ${name} not found in ${TARGET}`);
    process.exit(1);
  }
  html = html.slice(0, a + start.length) + "\n" + body + "\n" + html.slice(b);
}
await writeFile(TARGET, html);

const noArt = [...new Set(videos.flatMap((v) => v.sets || []))].filter((s) => !packs.has(s));
const untagged = videos.filter((v) => !(v.sets || []).length).length;
console.log(`proto-wall.html rebuilt from real data:
  ${videos.length} videos, ${hitCount} with a graded pull, ${sets.length} sets
  Hall of Fame: ${hall.map((v) => (v.pulls || []).join("/")).slice(0, 3).join(", ")}...
  logos: ${logos.size}/${sets.length}    pack art: ${packs.size} sets`);
if (noArt.length) console.log(`  sets ripped but with no pack art: ${noArt.join(", ")}`);
if (untagged) console.log(`  ${untagged} videos still have no set tag and fall back to the wordmark tile`);

// The most valuable tagging work: a hit with no set tag cannot appear on the
// Hall of Fame shelf at all, however good the pull was.
const hiddenHits = videos.filter((v) => bestPull(v) != null && !packs.has((v.sets || [])[0]));
if (hiddenHits.length) {
  console.log(`\n  ${hiddenHits.length} graded hit${hiddenHits.length === 1 ? " is" : "s are"} kept off the Hall of Fame for want of a set tag:`);
  for (const v of hiddenHits.slice(0, 10)) {
    console.log(`    ${(v.pulls || []).join("/").padEnd(12)} ${v.title.slice(0, 62)}`);
  }
  if (hiddenHits.length > 10) console.log(`    ...and ${hiddenHits.length - 10} more`);
}
