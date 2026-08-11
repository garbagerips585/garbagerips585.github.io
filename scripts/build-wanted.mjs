#!/usr/bin/env node
// Build public/wanted.html, the hunt list, and the Most Wanted band that sits
// on the home page.
//
//   node scripts/sync-wanted.mjs      first, to attach images and prices
//   node scripts/build-wanted.mjs
//
// Prices are shown only when they exist. A set the market has not reached has
// no raw price, and no free API carries PSA 10 at all, so both are omitted
// rather than printed as zero or invented. Where a PSA 10 figure is present it
// carries the date it was checked, because a graded price without a date is
// not a fact about anything.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://garbagerips585.com";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n) =>
  n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const niceDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
};

const { cards, updated } = JSON.parse(
  await readFile(join(ROOT, "public/data/wanted.json"), "utf8")
);
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const hunting = cards.filter((c) => !c.got);
const caught = cards.filter((c) => c.got);

/** The two price rows under a card. Each disappears entirely when unknown. */
function prices(c) {
  const rows = [];
  if (c.raw) {
    rows.push(`<div class="pr"><span class="pr-k">Raw</span><span class="pr-v">${money(c.raw)}</span></div>`);
  } else {
    rows.push(`<div class="pr pr-none"><span class="pr-k">Raw</span><span class="pr-v">no market price yet</span></div>`);
  }
  if (c.psa10) {
    rows.push(
      `<div class="pr pr-psa"><span class="pr-k">PSA 10</span><span class="pr-v">${money(c.psa10)}</span></div>`
    );
  }
  return rows.join("");
}

function cardTile(c, { hunted = true } = {}) {
  const img = c.imageLarge || c.image;
  const alt = `${c.name} ${c.rarity || ""} from Pokemon ${c.setName}`.trim();
  const inner = `
        <span class="wc-art">${
          img
            ? `<img src="${esc(img)}" alt="${esc(alt)}" loading="lazy" width="245" height="342">`
            : `<span class="wc-none">${esc(c.name)}</span>`
        }${hunted ? `<span class="wc-flag">Hunting</span>` : `<span class="wc-flag wc-got">Caught</span>`}</span>
        <b class="wc-name">${esc(c.name)}</b>
        <span class="wc-meta">${esc(c.setName)} &bull; #${esc(c.number)}</span>
        ${c.rarity ? `<span class="wc-rar">${esc(c.rarity)}</span>` : ""}
        <span class="wc-prices">${prices(c)}</span>`;
  // Only a real TCGplayer link makes the tile a link; otherwise it is a card,
  // not a dead anchor.
  return c.url
    ? `      <a class="wc" href="${esc(c.url)}" rel="nofollow noopener" target="_blank">${inner}
      </a>`
    : `      <div class="wc">${inner}
      </div>`;
}

// The NEWEST date, not whichever card happens to sort first: with card A
// checked in January and card B in August, "find" claimed every price on the
// page was last checked in January.
const asOf = cards.map((c) => c.psa10AsOf).filter(Boolean).sort().pop() || null;
const anyPsa = cards.some((c) => c.psa10);

const style = `
.wanted{padding:var(--s7) 0 var(--s8)}
.w-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s5)}
.w-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s4)}
@media(max-width:1080px){.w-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.w-grid{grid-template-columns:repeat(2,1fr);gap:var(--s3)}}
.wc{display:flex;flex-direction:column;gap:var(--s1);min-width:0;text-decoration:none;
  background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s3);box-shadow:var(--lift);transition:transform .14s,border-color .14s}
a.wc:hover{transform:translateY(-3px);border-color:var(--ink)}
/* The card art keeps the real 245:342 proportion of a Pokemon card, so it is
   never stretched, and reserves its height before the image loads. */
.wc-art{position:relative;display:block;aspect-ratio:245/342;border-radius:6px;
  overflow:hidden;background:#E8E4D6;margin-bottom:var(--s2)}
.wc-art img{width:100%;height:100%;object-fit:contain}
.wc-none{position:absolute;inset:0;display:grid;place-items:center;padding:12%;
  font:400 .9rem/1.25 var(--display);color:var(--ink-2);text-align:center}
.wc-flag{position:absolute;left:0;bottom:10px;z-index:2;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--ketchup-deep);color:#fff;padding:5px 7px;border-radius:0 4px 4px 0}
.wc-flag.wc-got{background:#2F7A4A}
.wc-name{font:600 var(--t-sm)/1.3 var(--body)}
.wc-meta{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.03em}
.wc-rar{font:700 var(--t-micro)/1.4 var(--mono);color:var(--plum)}
.wc-prices{display:flex;flex-direction:column;gap:2px;margin-top:var(--s2);
  padding-top:var(--s2);border-top:1px dashed var(--hair)}
.pr{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s2)}
.pr-k{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.06em;color:var(--ink-2);
  text-transform:uppercase}
.pr-v{font:700 var(--t-sm)/1.4 var(--body);color:var(--ink)}
.pr-none .pr-v{font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2)}
.pr-psa .pr-v{color:var(--gold-deep)}
.price-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
`;

const body = `
<section class="wanted">
  <div class="wrap">
    <div class="brk"><h1>Most <span class="hl">wanted</span></h1><span class="ln"></span>
      <a href="/sets/">All ${sets.length} guides &rarr;</a></div>
    <p class="w-lede">The cards I am actually chasing right now. Every pack opened on this
      channel is opened hoping for one of these. Tap a card to see it on TCGplayer.</p>
    <div class="w-grid">
${hunting.map((c) => cardTile(c)).join("\n")}
${caught.map((c) => cardTile(c, { hunted: false })).join("\n")}
    </div>
    <p class="price-note">RAW PRICES COME FROM TCGPLAYER THROUGH THE POKEMON TCG API AND MOVE ON THEIR OWN.
      A SET THIS NEW OFTEN HAS NO MARKET PRICE YET, AND WE SHOW NOTHING RATHER THAN A ZERO.${
        anyPsa
          ? `<br>PSA 10 PRICES COME FROM GRADED SALES DATA${asOf ? `, LAST CHECKED ${niceDate(asOf).toUpperCase()}` : ""}, AND ARE NOT PART OF THE TCGPLAYER FEED.`
          : `<br>PSA 10 PRICES ARE NOT LISTED FOR THESE YET. GRADED SALES COME FROM A SEPARATE FEED AND FROM CHECKING BY HAND.`
      }</p>
  </div>
</section>`;

// Reuse the home page's shell so the hunt page cannot drift from the design.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
const bar = home.slice(home.indexOf("<header class=\"bar\">"), home.indexOf("<div class=\"rail\">"));
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
// The bar carries the menu button; the panel it controls lives after </header>,
// so it has to be copied across too or the button opens nothing.
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>Most Wanted: The Cards We Are Hunting | Garbage Rips 585</title>`)
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="The Pokemon cards Garbage Rips 585 is chasing right now: ${esc(
      hunting.map((c) => c.name).join(", ")
    )}. Raw and PSA 10 market prices, updated as the market moves.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/wanted.html">`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/wanted.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1Most Wanted | Garbage Rips 585`);

const html = `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${style}</style>
</head>
<body>
${skipLink}
${sprite}

${bar}
${menuPanel}
${body}
${footer}

<script src="assets/app.js"></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/wanted.html"), html);
console.log(`Wrote public/wanted.html
  hunting: ${hunting.length}${caught.length ? `, caught: ${caught.length}` : ""}
  with a raw price:    ${cards.filter((c) => c.raw).length} of ${cards.length}
  with a PSA 10 price: ${cards.filter((c) => c.psa10).length} of ${cards.length}
`);
