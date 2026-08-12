#!/usr/bin/env node
// Build public/collection.html: the cards actually owned, from Collectr.
//
//   node scripts/sync-collection.mjs && node scripts/build-collection.mjs
//
// WHAT THIS PAGE IS FOR, which decides its shape.
// It is not an inventory screen. Collectr already is one, and a flat grid of
// 132 cards sorted by nothing is a worse version of an app he already has open
// on his phone. What a visitor wants from a ripper's collection page is: what
// is the best card in there, what is it worth, and what moved today. So it
// leads with the headline number, then the best cards, then the movers, and
// only then the full list.
//
// The daily change is the reason to come back. It is also the one thing a
// static site cannot compute for itself, and Collectr hands it over per card.
//
// Their API terms ask for a "Powered by Collectr" credit, which is at the
// bottom and in the header link. Fair trade for the data.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let d;
try {
  d = JSON.parse(await readFile(join(ROOT, "public/data/collection.json"), "utf8"));
} catch {
  console.error("No public/data/collection.json. Run: node scripts/sync-collection.mjs");
  process.exit(1);
}

const cards = d.cards || [];
const usd = (n) =>
  n == null ? "" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd0 = (n) => `$${Math.round(Number(n)).toLocaleString("en-US")}`;

const priced = cards.filter((c) => c.price > 0);
const top = [...priced].sort((a, b) => b.price - a.price).slice(0, 12);

// Movers, by absolute dollar change rather than percent: a 40% jump on a 30c
// card is noise, and this page is about what the collection is worth.
const movers = priced
  .filter((c) => c.diff != null && Math.abs(c.diff) >= 0.5)
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  .slice(0, 8);
const dayChange = priced.reduce((n, c) => n + (c.diff || 0) * (c.qty || 1), 0);

// By set, biggest holding first.
const bySet = new Map();
for (const c of cards) {
  const k = c.set || "Other";
  if (!bySet.has(k)) bySet.set(k, { name: k, n: 0, value: 0, cards: [] });
  const e = bySet.get(k);
  e.n += c.qty || 1;
  e.value += (c.price || 0) * (c.qty || 1);
  e.cards.push(c);
}
const sets = [...bySet.values()].sort((a, b) => b.value - a.value);

const shot = (c, w) =>
  c.image ? `${c.image.split("?")[0]}?optimizer=image&format=webp&width=${w}` : null;

const cardTile = (c, rank) => `        <li class="cc">
          ${rank ? `<span class="cc-rank">${rank}</span>` : ""}
          <div class="cc-art">${
            shot(c, 300)
              ? `<img src="${esc(shot(c, 300))}" alt="${esc(c.name)}" loading="lazy" decoding="async" width="245" height="342" referrerpolicy="no-referrer">`
              : `<span class="cc-none">${esc(c.name)}</span>`
          }</div>
          <p class="cc-n">${esc(c.name)}${c.qty > 1 ? ` <span class="cc-q">x${c.qty}</span>` : ""}</p>
          <p class="cc-s">${esc(c.set || "")}${c.number ? ` &bull; ${esc(c.number)}` : ""}</p>
          ${c.rarity ? `<p class="cc-r">${esc(c.rarity)}</p>` : ""}
          <p class="cc-p">${usd(c.price)}${
            c.diff
              ? ` <span class="cc-d ${c.diff > 0 ? "up" : "down"}">${c.diff > 0 ? "+" : ""}${usd(c.diff).replace("$-", "-$")}</span>`
              : ""
          }</p>
        </li>`;

const style = `
.col{padding:var(--s7) 0 var(--s5)}
.col-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
.col-head{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s4)}
@media(max-width:700px){.col-head{grid-template-columns:repeat(2,1fr)}}
.col-stat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.col-stat b{display:block;font:400 var(--t-xl)/1 var(--display);margin-bottom:4px}
.col-stat span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);letter-spacing:.06em;
  text-transform:uppercase}
.col-stat .up{color:#1F8C76}
.col-stat .down{color:var(--ketchup-deep)}
.col-when{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:var(--s6)}
.col-when a{color:var(--ketchup-deep);text-decoration:underline}

.col-sec{padding:var(--s6) 0}
.col-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s2)}
.col-note{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}

.cc-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
  gap:var(--s4)}
@media(max-width:420px){.cc-grid{grid-template-columns:repeat(2,1fr);gap:var(--s3)}}
.cc{position:relative;display:flex;flex-direction:column;gap:2px}
.cc-art{border-radius:8px;overflow:hidden;background:var(--card);border:1px solid var(--hair);
  aspect-ratio:245/342;display:grid;place-items:center}
.cc-art img{width:100%;height:100%;object-fit:cover;display:block}
.cc-none{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);padding:var(--s3);text-align:center}
.cc-rank{position:absolute;left:-6px;top:-6px;z-index:2;width:26px;height:26px;border-radius:50%;
  background:var(--mustard);border:2px solid var(--ink);display:grid;place-items:center;
  font:400 var(--t-sm)/1 var(--display);color:var(--ink)}
.cc-n{font:700 var(--t-sm)/1.25 var(--body);margin-top:6px}
.cc-q{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
.cc-s,.cc-r{font:700 9px/1.4 var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-2)}
.cc-p{font:700 var(--t-sm)/1.3 var(--body);color:var(--ink);margin-top:2px}
.cc-d{font:700 var(--t-micro)/1 var(--mono)}
.cc-d.up{color:#1F8C76}
.cc-d.down{color:var(--ketchup-deep)}

.set-rows{list-style:none;display:flex;flex-direction:column;gap:var(--s2)}
.set-row{display:flex;align-items:center;gap:var(--s3);background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s3) var(--s4)}
.set-row b{flex:1;min-width:0;font:700 var(--t-body)/1.3 var(--body)}
.set-row .n{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);white-space:nowrap}
.set-row .v{font:400 var(--t-m)/1 var(--display);color:var(--ketchup-deep);white-space:nowrap}

.col-src{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
.col-src a{color:var(--ketchup-deep);text-decoration:underline}
`;

const body = `
<main id="main">
  <section class="col">
    <div class="wrap">
      <div class="brk"><h1>The <span class="hl">collection</span></h1><span class="ln"></span></div>
      <p class="col-lede">Everything kept out of ${cards.length ? "the rips" : "the packs"}, tracked card by card.
        This is the ${esc((d.collections || [])[0] || "main")} portfolio: what it holds, what it is worth,
        and what moved today.</p>

      <div class="col-head">
        <div class="col-stat"><b>${d.totalCards}</b><span>cards</span></div>
        <div class="col-stat"><b>${usd0(d.totalValue)}</b><span>market value</span></div>
        <div class="col-stat"><b>${sets.length}</b><span>sets</span></div>
        <div class="col-stat"><b class="${dayChange >= 0 ? "up" : "down"}">${dayChange >= 0 ? "+" : ""}${usd(dayChange).replace("$-", "-$")}</b><span>today</span></div>
      </div>
      <p class="col-when">Last read ${esc(longDate(d.checked))} from
        <a href="${esc(d.profileUrl)}" rel="noopener" target="_blank">the Collectr showcase</a></p>
    </div>
  </section>

  <section class="band col-sec">
    <div class="wrap">
      <h2>The <span class="hl">best of it</span></h2>
      <p class="col-note">The twelve most valuable cards in the binder, by current market price.</p>
      <ul class="cc-grid">
${top.map((c, i) => cardTile(c, i + 1)).join("\n")}
      </ul>
    </div>
  </section>

  ${
    movers.length
      ? `<section class="col-sec">
    <div class="wrap">
      <h2>Moved <span class="hl">today</span></h2>
      <p class="col-note">Biggest changes in market price since yesterday, in dollars rather than
        percent: a big percentage swing on a cheap card is noise.</p>
      <ul class="cc-grid">
${movers.map((c) => cardTile(c)).join("\n")}
      </ul>
    </div>
  </section>`
      : ""
  }

  <section class="band col-sec">
    <div class="wrap">
      <h2>By <span class="hl">set</span></h2>
      <p class="col-note">Where the value actually sits.</p>
      <ul class="set-rows">
${sets
  .map(
    (s) => `        <li class="set-row"><b>${esc(s.name)}</b><span class="n">${s.n} card${s.n === 1 ? "" : "s"}</span><span class="v">${usd0(s.value)}</span></li>`
  )
  .join("\n")}
      </ul>
    </div>
  </section>

  <section class="col-sec">
    <div class="wrap">
      <p class="col-src">Collection data and card images come from
        <a href="https://getcollectr.com" rel="noopener" target="_blank">Collectr</a>, read
        ${esc(longDate(d.checked))}. Powered by Collectr. Market prices move daily and are an
        estimate of what a card sells for, not an offer to buy or sell anything. Nothing here is
        for sale.</p>
    </div>
  </section>
</main>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Collection: ${d.totalCards} Pokemon Cards Kept From the Rips | Garbage Rips 585</title>
<meta name="description" content="Every Pokemon card kept out of the rips, tracked card by card. ${d.totalCards} cards across ${sets.length} sets, with current market values.">
<link rel="canonical" href="${SITE}/collection.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#15263A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="The Collection">
<meta property="og:description" content="${d.totalCards} Pokemon cards kept from the rips, with current market values.">
<meta property="og:url" content="${SITE}/collection.html">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${STYLES}
<style>${style}</style>
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer("Collection data from Collectr. Powered by Collectr.")}

<script src="/assets/app.js" defer></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/collection.html"), html);

console.log(`Wrote public/collection.html
  ${d.totalCards} cards, ${usd(d.totalValue)}, ${sets.length} sets
  top: ${top[0]?.name} ${usd(top[0]?.price)}
  ${movers.length} movers, day change ${usd(dayChange)}`);
