#!/usr/bin/env node
// Build the "Set 101" band for the homepage prototype straight from
// public/data/sets.json, so the card counts and dates on the home page can
// never drift from the guides they link to.
//
//   node scripts/inject-sets101.mjs
//
// Idempotent: it replaces whatever sits between the two marker comments.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "public/proto-wall.html");
const START = "<!-- SETS101:START -->";
const END = "<!-- SETS101:END -->";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

// Rip counts per set, so the band can say how much of each set we have opened.
let counts = {};
try {
  const raw = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
  for (const v of raw.videos || raw) for (const s of v.sets || []) counts[s] = (counts[s] || 0) + 1;
} catch {
  /* prototype can render without it */
}

// Which logos actually exist. A missing file is not an error: five sets are
// still waiting on artwork, and those tiles fall back to their name set in the
// display face. Deciding here rather than with an onerror handler matters
// because these images are lazy and below the fold, so onerror would not fire
// until the user scrolled to them and the tile would flash empty first.
const logos = new Set(
  (await readdir(join(ROOT, "public/assets/logos")))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/-pokemon-tcg-set-logo\.webp$/, ""))
);

/**
 * Read a WebP's pixel dimensions from its header.
 *
 * Worth the 20 lines: these logos range from 1.3:1 (151) to 5:1 (Mega
 * Evolution), and sizing them all to one height makes the wide ones look
 * half the size of the tall ones. Sizing by area instead needs the real
 * aspect ratio, and only the file knows it.
 */
function webpSize(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X") {
    return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  if (fourcc === "VP8 ") {
    // keyframe: 3-byte frame tag, 3-byte start code, then 14-bit w and h
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21); // 14 bits width-1, then 14 bits height-1
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

// The tile's art box, and the target area every logo aims to fill. Tuned so a
// mid-ratio logo lands near 45px tall; the clamp stops the extremes running
// away and the width cap keeps every logo inside its tile.
const BOX_W = 144;
const TARGET_AREA = 5000;
const MIN_H = 34;
const MAX_H = 58;

async function logoHeight(id) {
  try {
    const buf = await readFile(join(ROOT, `public/assets/logos/${id}-pokemon-tcg-set-logo.webp`));
    const size = webpSize(buf);
    if (!size || !size.h) return null;
    const ratio = size.w / size.h;
    const byArea = Math.min(MAX_H, Math.max(MIN_H, Math.sqrt(TARGET_AREA / ratio)));
    return Math.round(Math.min(byArea, BOX_W / ratio));
  } catch {
    return null;
  }
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function when(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] || ""} ${y}`.trim();
}

// Newest first: that is the order collectors think in, and it puts the sets
// currently on shelves at the front of the band.
const ordered = [...sets].sort((a, b) => String(b.released).localeCompare(String(a.released)));

const cards = (
  await Promise.all(
    ordered.map(async (s) => {
      const n = counts[s.id] || 0;
      const total = s.total || s.printedTotal;
      const bits = [total ? `${total} cards` : null, when(s.released) || null].filter(Boolean);
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

const block = `${START}
<section class="sets101">
  <div class="wrap">
    <div class="brk s101-head">
      <h2>Set 101</h2>
      <span class="ln"></span>
      <a href="/sets/">All ${sets.length} guides &rarr;</a>
    </div>
    <p class="s101-lede">Every set I rip, explained. Card counts, what the rarities actually mean, the chase cards worth chasing, and what a pack of it goes for.</p>
    <div class="set-grid">
${cards}
    </div>
  </div>
</section>
${END}`;

const html = await readFile(TARGET, "utf8");
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`Markers not found in ${TARGET}. Add ${START} / ${END} first.`);
  process.exit(1);
}
await writeFile(TARGET, html.slice(0, a) + block + html.slice(b + END.length));

const missing = ordered.filter((s) => !logos.has(s.id));
console.log(`Wrote Set 101 band: ${sets.length} sets, ${sets.length - missing.length} with logos.`);
if (missing.length) {
  console.log(`\nStill needs a logo (${missing.length}):`);
  for (const s of missing) console.log(`  ${s.id.padEnd(20)} ${s.name}`);
}
