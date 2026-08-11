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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function when(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] || ""} ${y}`.trim();
}

// Newest first: that is the order collectors think in, and it puts the sets
// currently on shelves at the front of the band.
const ordered = [...sets].sort((a, b) => String(b.released).localeCompare(String(a.released)));

const cards = ordered
  .map((s) => {
    const n = counts[s.id] || 0;
    const total = s.total || s.printedTotal;
    const bits = [total ? `${total} cards` : null, when(s.released) || null].filter(Boolean);
    const face = logos.has(s.id)
      ? `<img src="assets/logos/${s.id}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" width="300" height="120">`
      : `<span class="set-name">${esc(s.name)}</span>`;
    return `        <a class="set" href="/sets/${s.id}.html">
          <span class="set-art">${face}</span>
          <b>${esc(s.name)}</b>
          <span class="set-meta">${esc(bits.join(" · "))}</span>
          ${n ? `<span class="set-rips">${n} rip${n === 1 ? "" : "s"}</span>` : ""}
        </a>`;
  })
  .join("\n");

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
