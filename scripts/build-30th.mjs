#!/usr/bin/env node
// /30th-celebration.html -- the set guide for Pokemon TCG: 30th Celebration,
// plus the owner's own master set tracked as a nine pocket binder.
//
//   node scripts/build-30th.mjs
//
// Reads data/30th.json (facts, products, Japan's card list) and
// data/30th-binder.json (what the owner actually owns). Both are hand
// maintained and both carry their own readme; read those before editing
// anything here, because the rules about what may be printed as a fact live in
// them and not in this file.
//
// WHY THIS PAGE EXISTS SEPARATELY FROM /sets/ AND FROM /upcoming.html.
// /upcoming.html answers "what is coming and when" for every set at once, and
// deletes a set the day it ships -- its own readme says so. /sets/<slug>.html
// is generated from TCGdex and cannot exist for a set TCGdex has never heard
// of; checked 11 September 2026 and the API's 218 sets include the 2021
// Celebrations and nothing for 2026. So on the day the owner asked for this,
// the set had no guide page, could not have one, and was five days out.
//
// AND THE MASTER SET IS THE PART NEITHER OF THOSE COULD EVER DO. It is one
// person's binder, which is not a fact about the set and does not belong in a
// generated set guide.
//
// NO BROWSER STORAGE, AND THAT IS THE DESIGN RATHER THAN A LIMITATION. The
// owner's ask was a tracker he fills in by listing cards after a video. A
// localStorage tracker would have been fewer moving parts and would have been
// worse: one browser on one device, gone the first time site data is cleared,
// unreadable on his phone, and invisible to search. A committed JSON file
// rendered at build time is none of those things. See data/30th-binder.json.
//
// WHAT THIS PAGE MAY NOT DO, AND THE REASON IT KEEPS COMING UP HERE. The set
// leaked months early, so there is more confident wrong information about it
// than about any other set on the site. TPCi has published NO card count:
// checked against pokemon.com's product showcase and both press releases
// (1 June, 30 June 2026). Every total here is PokeBeach's, is attributed on
// the page in words, and the English card NAMES are not published at all --
// PokeBeach's own English gallery is images numbered to 158 with four blanks
// and no names anywhere. So this page prints Japan's list, labeled as Japan's,
// and does not invent an English one by mapping the numbers across: English has
// 128 main set cards to Japan's 103, so the numbering demonstrably does not
// line up and a mapped list would be fiction with a source attached.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import {
  BAR,
  MENU,
  SKIP,
  SPRITE,
  FONTS,
  STYLES_NO_PACKS_CSS,
  APP_JS_NO_PACKPLAYER,
  footer,
} from "../shared/chrome.mjs";
import { esc, longDate, clipMeta } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATH = "/30th-celebration.html";

const doc = JSON.parse(await readFile(join(ROOT, "data/30th.json"), "utf8"));
const binder = JSON.parse(await readFile(join(ROOT, "data/30th-binder.json"), "utf8"));
const owned = binder.owned || [];

// THE FIVE BINDER SECTIONS AND WHERE THE NUMBERS COME FROM. PokeBeach's English
// breakdown is 128 main / 33 secret / 30 Classic / 8 Energy = 199, and the 30
// Pikachu are PART of the 128. They get their own section here anyway, because
// one is guaranteed in every pack and they are the subset a master set lives or
// dies on, so `main` below is the 98 that are not Pikachu. 98+30+33+30+8 = 199,
// which is the same 199 and not a second opinion about it.
const E = doc.structure.english;
const SECTIONS = [
  ["pikachu", "The 30 Pikachu", E.pikachu, "One in every pack, each by a different illustrator. Japan's first is Ken Sugimori redrawing his own Jungle Pikachu."],
  ["main", "Main set", E.main - E.pikachu, "Everything else in the numbered main set."],
  ["secret", "Secret rares", E.secret, "Illustration rares, special illustration rares, and the two Futuristic rares."],
  ["classic", "Classic Collection", E.classic, "Reprints on gold bordered sparkle foil, numbered outside the main set. Not Standard legal."],
  ["energy", "Basic Energy", E.energy, "All eight are foil and all eight count. One comes in every pack."],
];
const TOTAL = SECTIONS.reduce((a, [, , n]) => a + n, 0);

const ownedIn = (key) => owned.filter((c) => c.section === key);
const haveTotal = owned.length;
const pct = TOTAL ? Math.round((haveTotal / TOTAL) * 100) : 0;

// ---------------------------------------------------------------------------
// THE BINDER
// ---------------------------------------------------------------------------
// Nine pockets to a page, because the set's own Binder Collection product is a
// nine pocket portfolio and this is meant to read as that object. An owned card
// fills a pocket; the rest of the section draws as empty pockets so the gap is
// the thing you see, which is the entire point of a master set tracker.
//
// EMPTY POCKETS ARE CAPPED AT ONE PAGE PAST THE LAST OWNED CARD. Drawing all
// 199 gives 23 binder pages of identical empty squares on a phone, which is
// 1,800 DOM nodes saying one sentence. The count is in the heading and in the
// bar; the pockets show the shape.
const POCKETS = 9;
const pocket = (c, i) =>
  c
    ? `<li class="t30-pk has" title="${esc(c.name)}">
        <span class="t30-pn">${esc(c.n ? "#" + c.n : "")}</span>
        <span class="t30-nm">${esc(c.name)}</span>
        ${c.got ? `<span class="t30-got">${esc(longDate(c.got))}</span>` : ""}
      </li>`
    : `<li class="t30-pk" aria-hidden="true"><span class="t30-pn">${i + 1}</span></li>`;

const binderSection = ([key, label, total, note]) => {
  const have = ownedIn(key);
  const shown = Math.min(total, (Math.floor(have.length / POCKETS) + 1) * POCKETS);
  const cells = [];
  for (let i = 0; i < shown; i++) cells.push(pocket(have[i], i));
  const done = have.length >= total;
  return `      <section class="t30-bs">
        <h3>${esc(label)} <span class="t30-cnt${done ? " done" : ""}">${have.length} of ${total}</span></h3>
        <p class="t30-bn">${esc(note)}</p>
        <div class="t30-bar" role="img" aria-label="${have.length} of ${total} collected"><span style="width:${total ? Math.round((have.length / total) * 100) : 0}%"></span></div>
        <figure class="t30-fig">
          <ol class="t30-pkts">
${cells.join("\n")}
          </ol>
          <figcaption>${esc(label)}, ${have.length} of ${total} in the binder.${
            shown < total
              ? ` ${total - shown} further pocket${total - shown === 1 ? "" : "s"} in this section are not drawn until they are closer to being filled.`
              : ""
          }</figcaption>
        </figure>
      </section>`;
};

// ---------------------------------------------------------------------------
// PRODUCTS, GROUPED BY RELEASE WAVE
// ---------------------------------------------------------------------------
const waves = new Map();
for (const p of doc.products) {
  const d = p.date || doc.set.release;
  if (!waves.has(d)) waves.set(d, []);
  waves.get(d).push(p);
}
const waveBlocks = [...waves.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(
    ([date, items]) => `        <section class="t30-wave">
          <h3>${esc(longDate(date))}</h3>
          <ul>
${items
  .map(
    (p) => `            <li>
              <span class="t30-p">${esc(p.name)}</span>
              <span class="t30-meta">${[p.packs ? `${p.packs} pack${p.packs === 1 ? "" : "s"}` : null, p.price || null]
                .filter(Boolean)
                .map(esc)
                .join(" &bull; ")}</span>
              ${p.note ? `<span class="t30-note">${esc(p.note)}</span>` : ""}
            </li>`
  )
  .join("\n")}
          </ul>
        </section>`
  )
  .join("\n");

const packTotal = doc.products.reduce((a, p) => a + (p.packs || 0), 0);

// ---------------------------------------------------------------------------
// JAPAN'S LIST
// ---------------------------------------------------------------------------
const JP_LABEL = {
  main: "Main set",
  pikachu: "Pikachu subset",
  secret: "Secret rare",
  classic: "Classic Collection",
  energy: "Basic Energy",
};
const jpRows = doc.japanList
  .map(
    (c) => `            <tr><td>${esc(c.n ? "#" + String(c.n).padStart(3, "0") : "--")}</td><td>${esc(c.name)}</td><td>${esc(
      JP_LABEL[c.section] || c.section
    )}</td></tr>`
  )
  .join("\n");

const style = `
.t30-hero{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);box-shadow:var(--lift)}
.t30-facts{list-style:none;display:grid;gap:var(--s3);margin:var(--s4) 0 0}
.t30-facts li{padding-left:1.15em;position:relative;line-height:1.45}
.t30-facts li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--hl)}
.t30-tag{display:inline-block;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;
  padding:4px 7px;border-radius:999px;border:1px solid var(--keyline);color:var(--ink-2);background:var(--paper);margin-right:6px;vertical-align:.12em}
.t30-tag.off{color:var(--ink);border-color:var(--hl)}
.t30-sum{display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin:var(--s4) 0 0}
.t30-sum div{background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3);text-align:center}
.t30-sum b{display:block;font:400 var(--t-xl)/1 var(--display);color:var(--ink)}
.t30-sum span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-bs{margin-top:var(--s5)}
.t30-bs h3{display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap;margin:0}
.t30-cnt{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);background:var(--paper);border:1px solid var(--keyline);border-radius:999px;padding:4px 8px}
.t30-cnt.done{color:var(--ink);border-color:var(--hl)}
.t30-bn{color:var(--ink-2);margin:6px 0 var(--s3)}
.t30-bar{height:6px;border-radius:999px;background:var(--paper);border:1px solid var(--keyline);overflow:hidden;margin-bottom:var(--s4)}
.t30-bar span{display:block;height:100%;background:var(--hl)}
.t30-pkts{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3);margin:0;max-width:520px}
.t30-pk{aspect-ratio:5/7;border:1px dashed var(--keyline);border-radius:var(--r-sm);background:var(--paper);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;text-align:center;min-width:0}
.t30-pk .t30-pn{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-3,var(--ink-2));opacity:.55}
.t30-pk.has{border-style:solid;border-color:var(--hl);background:var(--card);box-shadow:var(--lift)}
.t30-pk.has .t30-pn{opacity:1;color:var(--ink-2)}
.t30-nm{font:700 var(--t-sm)/1.2 var(--body,inherit);color:var(--ink);overflow-wrap:anywhere}
.t30-got{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
.t30-more{color:var(--ink-2);font-size:var(--t-sm);margin-top:var(--s3)}
.t30-wave{margin-top:var(--s4)}
.t30-wave h3{margin:0 0 var(--s3);font:400 var(--t-l)/1.15 var(--display)}
.t30-wave ul{list-style:none;display:grid;gap:var(--s3);margin:0}
.t30-wave li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-sm);padding:var(--s3);display:grid;gap:4px}
.t30-p{font-weight:700;color:var(--ink)}
.t30-meta{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.04em}
.t30-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.45}
.t30-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--keyline);border-radius:var(--r-sm);margin-top:var(--s4)}
.t30-tbl{border-collapse:collapse;width:100%;min-width:24em;font-size:var(--t-sm)}
.t30-tbl th,.t30-tbl td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--keyline);white-space:nowrap}
.t30-tbl th{font:700 var(--t-micro)/1 var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2);position:sticky;top:0;background:var(--card)}
.t30-tbl td:nth-child(1){font-family:var(--mono);color:var(--ink-2)}
.t30-tbl tr:last-child td{border-bottom:0}
.t30-src{list-style:none;margin:var(--s4) 0 0;display:grid;gap:8px}
.t30-src li{overflow-wrap:anywhere;font-size:var(--t-sm)}
`;

const TITLE = "Pokemon 30th Celebration: Products, Dates and Card List";
const DESC =
  "Every 30th Celebration product with its date and price, what is actually in a pack, " +
  "Japan's full 176 card list, and a master set tracked pocket by pocket.";

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: clipMeta(DESC),
    url: SITE + PATH,
    dateModified: doc.checked,
    author: { "@type": "Organization", name: "Garbage Rips 585" },
    publisher: { "@type": "Organization", name: "Garbage Rips 585" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Sets", item: SITE + "/sets/" },
      { "@type": "ListItem", position: 3, name: "30th Celebration", item: SITE + PATH },
    ],
  },
];

const body = `<main id="main">

<header class="band-sky tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/sets/">Sets</a> / 30th Celebration</nav>
    <h1>Pokemon 30th Celebration</h1>
    <p class="lede" style="max-width:42em">${esc(doc.set.releaseNote.split(".")[0])}. It is all foil, there is
      no booster box, and every pack comes inside one of ${doc.products.length} products. This page is what is
      known about it, what is not, and how far along one master set is.</p>
    <div class="t30-sum">
      <div><b>${esc(longDate(doc.set.release))}</b><span>Release, worldwide</span></div>
      <div><b>${E.count}</b><span>Cards in English, per PokeBeach</span></div>
      <div><b>${doc.products.length}</b><span>Products, five waves</span></div>
      <div><b>${packTotal}</b><span>Packs across them all</span></div>
    </div>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <h2>The master set, pocket by pocket</h2>
    <p style="max-width:42em">Nine pockets to a page, the same as the set's own Binder Collection. A filled pocket
      is a card actually in the binder. The empty ones are the job.</p>
    <div class="t30-hero">
      <h3 style="margin:0">${haveTotal} of ${TOTAL} cards <span class="t30-cnt">${pct}%</span></h3>
      <div class="t30-bar" style="margin-top:var(--s3)" role="img" aria-label="${haveTotal} of ${TOTAL} collected"><span style="width:${pct}%"></span></div>
      <p class="t30-bn" style="margin-bottom:0">${
        haveTotal === 0
          ? `Nothing in it yet, which is correct rather than broken: the set does not release until ${esc(
              longDate(doc.set.release)
            )}. Cards get added here as they are opened.`
          : `Last added ${esc(longDate(binder.checked))}.`
      }</p>
    </div>
${SECTIONS.map(binderSection).join("\n")}
    <p class="price-note" style="margin-top:var(--s5)"><strong>199 is not an official number.</strong>
      ${esc(E.note)} The Pokemon Company has never published a card count for this set, so these bars run
      against PokeBeach's count and may move when the last secret rares are shown.</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <h2>What is actually in a pack</h2>
    <ul class="t30-facts">
      <li><span class="t30-tag off">Official</span>${esc(doc.set.packContents.split(".")[0])}.</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.allFoil)}</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.classicLegality.split(": ")[1] || doc.set.classicLegality)}</li>
      <li><span class="t30-tag off">Official</span>${esc(doc.set.tcgLive.split(".")[0])}.</li>
      <li><span class="t30-tag">No box</span>${esc(doc.set.noBox)}</li>
    </ul>
    <h3>What every pack guarantees</h3>
    <p style="max-width:42em">${esc(doc.guaranteesNote)}</p>
    <ul class="t30-facts">
${doc.guarantees
  .map(
    (g) =>
      `      <li><span class="t30-tag${g.source === "official" ? " off" : ""}">${
        g.source === "official" ? "Official" : "PokeBeach"
      }</span>${esc(g.claim)} <span class="t30-src-i">${esc(g.where)}</span></li>`
  )
  .join("\n")}
    </ul>

    <h3>${esc(doc.japanBoxOpening.label)}</h3>
    <p style="max-width:42em"><span class="t30-tag">One box, not a rate</span>${esc(doc.japanBoxOpening.caveat)}</p>
    <div class="t30-scroll" style="max-width:32em">
      <table class="t30-tbl">
        <caption class="t30-cap">What came out of one ${doc.japanBoxOpening.packs} pack Japanese box. ${esc(
          doc.japanBoxOpening.where
        )}.</caption>
        <thead><tr><th scope="col">Card</th><th scope="col">In that box</th></tr></thead>
        <tbody>
${doc.japanBoxOpening.rows
  .map((r) => `            <tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`)
  .join("\n")}
        </tbody>
      </table>
    </div>

    <h3>English pull rates</h3>
    <p style="max-width:42em"><span class="t30-tag">Not published</span>${esc(doc.englishRates.split(". ADD THEM")[0])}.
      They will be added here when the publisher or PokeBeach states them. A number worked out from somebody's
      early box is not one of those, and this page will not carry it as one.</p>
    <p style="max-width:42em">What the channel has actually opened is counted separately and labeled as
      observed results rather than as odds. <a href="/luck.html">See those numbers</a>.</p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <h2>Every product, by release wave</h2>
${waveBlocks}
    <h3>Free promo at the counter</h3>
    <p style="max-width:42em">${esc(doc.storePromo)}</p>
    <h3>Cards the English set does not have</h3>
    <p style="max-width:42em">${esc(doc.cutCards)}</p>
    <h3>Accessories</h3>
    <p style="max-width:42em">${esc(doc.accessories)}</p>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <h2>Japan's card list, all ${doc.japanList.length} revealed</h2>
    <p style="max-width:42em"><strong>This is Japan's set and not the English one.</strong> ${esc(
      doc.structure.japan.note
    )} It is here because it is the only full list of this set that exists in words anywhere:
      the English card images have been revealed but their names have not been published, so an English
      checklist would have to be guessed from Japanese numbers that demonstrably do not line up.</p>
    <p class="price-note">${esc(doc.structure.derived)}</p>
    <div class="t30-scroll">
      <table class="t30-tbl">
        <thead><tr><th scope="col">No.</th><th scope="col">Card</th><th scope="col">Part of</th></tr></thead>
        <tbody>
${jpRows}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <h2>Where all this came from</h2>
    <p style="max-width:42em">Anything marked <span class="t30-tag off">Official</span> is The Pokemon Company's
      own words. Everything else is PokeBeach, named in the sentence that uses it. Nothing on this page comes
      from a leak, a comment thread or a set tracker's extrapolation.</p>
    <ul class="t30-src">
${doc.sources.map((u) => `      <li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(u.replace(/^https?:\/\//, ""))}</a></li>`).join("\n")}
    </ul>
  </div>
</section>

</main>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(clipMeta(DESC))}">
<link rel="canonical" href="${SITE}${PATH}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon 30th Celebration: products, dates and card list">
<meta property="og:description" content="Every product with its date and price, what is really in a pack, and Japan's full card list.">
<meta property="og:url" content="${SITE}${PATH}">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
${FONTS}
${STYLES_NO_PACKS_CSS}
<style>${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer(
  `Set facts read ${longDate(doc.checked)} from The Pokemon Company's press releases and product pages, and from PokeBeach where marked. The Pokemon Company has published no card count for this set; totals here are PokeBeach's.`
)}
${APP_JS_NO_PACKPLAYER}
</body>
</html>
`;

await writeFile(join(ROOT, "public" + PATH), html);
console.log(
  `Wrote public${PATH}  ${haveTotal}/${TOTAL} owned, ${doc.products.length} products, ${doc.japanList.length} Japanese cards`
);
