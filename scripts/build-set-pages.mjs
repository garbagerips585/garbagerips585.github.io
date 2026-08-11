#!/usr/bin/env node
// Generate a "Card Pokedex" page per card set, plus the /sets/ index.
//
//   node scripts/build-set-pages.mjs
//
// Reads public/data/sets.json (written by sync-sets.mjs) and videos.json.
// Everything on these pages is either a fact from the API or something a
// human wrote in data/set-notes.json. Nothing is invented: a set with no
// price data says so rather than showing zeros, and the "fun facts" are
// derived from the checklist, never from pull odds we do not have.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { labelFor } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://garbagerips585.com";
const OUT = join(ROOT, "public/sets");

const { sets, rarityOrder, syncedAt } = JSON.parse(
  await readFile(join(ROOT, "public/data/sets.json"), "utf8")
);
// PSA 10 prices are hand-checked and live in one file, because no free price
// feed carries graded sales. A card with no entry shows its raw price alone.
let psa10 = {};
try {
  psa10 = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8")) || {};
} catch {
  /* optional */
}
// Two sources, and the person always wins. `prices` is what Tim typed through
// the spreadsheet; `auto` is what sync-prices.mjs fetched and owns. A sync must
// never overwrite a number he checked himself, so it is read second.
const gnum = (v) => (typeof v === "number" ? v : typeof v?.price === "number" ? v.price : null);
// A synced price needs enough sales behind it to mean anything. Volcarona came
// back at 15x its raw price off six recorded sales, which is an anecdote, not a
// market. Hand-entered prices skip this test: if Tim typed it, he stands
// behind it.
const MIN_SALES = 10;
const gradedPrice = (setId, number) => {
  const k = `${setId}-${number}`;
  const manual = gnum(psa10.prices?.[k]) ?? gnum(psa10[k]);
  if (manual) return manual;
  const a = psa10.auto?.[k];
  if (!a?.psa10) return null;
  if (a.psa10Sales != null && a.psa10Sales < MIN_SALES) return null;
  return a.psa10;
};
const gradedAsOf = (setId, number) => {
  const k = `${setId}-${number}`;
  return psa10.prices?.[k]?.asOf || psa10[k]?.asOf || psa10.auto?.[k]?.asOf || null;
};

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function niceDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function yearsSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 0) return "not out yet";
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}
const money = (n) =>
  n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`;

// Rarities worth chasing, for highlighting in the ladder.
const CHASE = new Set([
  "Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare",
  "Illustration Rare", "Ultra Rare", "ACE SPEC Rare", "Radiant Rare",
]);

// Which sets have a real packshot photo. Decided at build time: an onerror
// fallback never fires while the image is lazy and below the fold, so the
// empty panel would sit there and then pop out mid-scroll.
const packshots = new Set();
try {
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync(join(ROOT, "public/assets/packshots"))) {
    const m = /^(.+)-booster-pack\.webp$/.exec(f);
    if (m) packshots.add(m[1]);
  }
} catch {
  /* none yet */
}

// Affiliate config. Off by default; flip enabled in data/affiliate.json once
// the Impact application is approved and every TCGplayer link is rewritten.
let aff = { tcgplayer: { enabled: false } };
try {
  aff = JSON.parse(await readFile(join(ROOT, "data/affiliate.json"), "utf8"));
} catch {
  /* optional */
}
const affOn = Boolean(aff.tcgplayer?.enabled && aff.tcgplayer?.linkTemplate);
const affLink = (url) =>
  affOn ? aff.tcgplayer.linkTemplate.replace("{url}", encodeURIComponent(url)) : url;

const ripsBySet = {};
for (const v of videos) for (const s of v.sets || []) ripsBySet[s] = (ripsBySet[s] || 0) + 1;

/** Facts pulled straight out of the checklist. No pull rates: we do not have them. */
function derivedFacts(s) {
  const out = [];
  const rar = s.rarities || {};
  const total = s.cardsSeen || 0;

  if (s.released) {
    out.push(`<b>Released ${niceDate(s.released)}</b>, which was ${yearsSince(s.released)}.`);
  }
  if (s.printedTotal && s.secretCount) {
    out.push(
      `The set is <b>${s.printedTotal} cards</b> on paper, but there are <b>${s.total}</b> in total. ` +
      `The extra ${s.secretCount} are secret rares numbered past the printed count.`
    );
  }
  const chaseCount = Object.entries(rar)
    .filter(([r]) => CHASE.has(r))
    .reduce((a, [, n]) => a + n, 0);
  if (chaseCount && total) {
    out.push(
      `<b>${chaseCount} of the ${total} cards</b> are Ultra Rare or better. ` +
      `That is the slice of the checklist worth pulling.`
    );
  }
  for (const r of ["Mega Hyper Rare", "Hyper Rare", "Special Illustration Rare"]) {
    if (rar[r]) {
      const n = rar[r];
      out.push(
        `Only <b>${n} ${r}${n === 1 ? "" : "s"}</b> ${n === 1 ? "exists" : "exist"} in the entire set.`
      );
      break;
    }
  }
  if (s.chase?.length) {
    const top = s.chase[0];
    out.push(
      `The chase card is <b>${esc(top.name)}</b>${top.rarity ? ` (${esc(top.rarity)})` : ""}, ` +
      `sitting around <b>${money(top.price)}</b>.`
    );
  }
  const rips = ripsBySet[s.id];
  if (rips) {
    out.push(`We have ripped <b>${rips} ${rips === 1 ? "video" : "videos"}</b> worth of this set on the channel.`);
  }
  return out;
}

const NAV = (depth) => {
  const up = depth ? "/" : "";
  return `<nav class="site" aria-label="Main">
  <div class="nav-in">
    <a class="logo" href="${up || "/"}">GARBAGE <span>RIPS</span> 585</a>
    <form class="search" data-route role="search">
      <svg aria-hidden="true"><use href="#i-search"/></svg>
      <label class="sr-only" for="navSearch">Search every rip</label>
      <input id="navSearch" type="search" placeholder="Search rips, sets, boxes...">
    </form>
    <button class="nav-toggle" aria-expanded="false" aria-label="Menu"><svg aria-hidden="true"><use href="#i-menu"/></svg></button>
    <ul class="nav-links">
      <li><a href="/">Home</a></li>
      <li><a href="/videos.html">All Rips</a></li>
      <li><a href="/sets/">Card Sets</a></li>
      <li><a href="/playlists.html">Playlists</a></li>
      <li><a href="/#five85">The 585</a></li>
    </ul>
    <div class="nav-social">
      <a href="https://www.youtube.com/@GarbageRips585" aria-label="YouTube"><svg aria-hidden="true"><use href="#i-yt"/></svg></a>
      <a href="https://www.instagram.com/garbagerips585/" aria-label="Instagram"><svg aria-hidden="true"><use href="#i-ig"/></svg></a>
      <a href="https://www.tiktok.com/@garbagerips585" aria-label="TikTok"><svg aria-hidden="true"><use href="#i-tt"/></svg></a>
      <a href="https://www.facebook.com/GarbageRips585" aria-label="Facebook"><svg aria-hidden="true"><use href="#i-fb"/></svg></a>
    </div>
  </div>
</nav>`;
};

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="fc-flower" viewBox="0 0 24 24"><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(72 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(144 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(216 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(288 12 12)"/></symbol>
  <symbol id="i-yt" viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12zM9.8 15.4V8.6l5.8 3.4z"/></symbol>
  <symbol id="i-ig" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm8.4-11.2a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/></symbol>
  <symbol id="i-tt" viewBox="0 0 24 24"><path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.2-2.6V9.4a5.9 5.9 0 1 0 5.3 5.9V8.7a7 7 0 0 0 4.1 1.3V6.9a3.9 3.9 0 0 1-4.1-3.9z"/></symbol>
  <symbol id="i-fb" viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z"/></symbol>
</svg>`;

const FOOTER = `<footer>
  <div class="wrap">
    <p class="foot-tag">Grab a fork. Let's rip.</p>
    <div class="foot-social">
      <a class="soc yt" href="https://www.youtube.com/@GarbageRips585" aria-label="YouTube"><svg aria-hidden="true"><use href="#i-yt"/></svg></a>
      <a class="soc ig" href="https://www.instagram.com/garbagerips585/" aria-label="Instagram"><svg aria-hidden="true"><use href="#i-ig"/></svg></a>
      <a class="soc tt" href="https://www.tiktok.com/@garbagerips585" aria-label="TikTok"><svg aria-hidden="true"><use href="#i-tt"/></svg></a>
      <a class="soc fb" href="https://www.facebook.com/GarbageRips585" aria-label="Facebook"><svg aria-hidden="true"><use href="#i-fb"/></svg></a>
    </div>
    <p>&copy; <span id="year">2026</span> Garbage Rips 585 &bull; Made in the Flower City &bull; Rochester, NY<br>
    Card data from the Pokemon TCG API. Prices are estimates and move constantly.<br>
    Fan content. Not affiliated with The Pokemon Company or Nintendo.</p>
  </div>
</footer>`;

const head = ({ title, desc, canonical, image, ld }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://images.pokemontcg.io" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/packs.css">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${NAV(1)}
`;

// ------------------------------------------------------------------ a set
function setPage(s) {
  const url = `${SITE}/sets/${s.id}.html`;
  const logo = `/assets/logos/${s.id}-pokemon-tcg-set-logo.webp`;
  const rips = ripsBySet[s.id] || 0;
  const label = labelFor("sets", s.id);
  const desc =
    `${s.name} Pokemon TCG set guide: ${s.total || "?"} cards, released ` +
    `${niceDate(s.released) || "recently"}, full rarity breakdown` +
    (s.chase?.length ? `, and the top chase cards with current market values.` : `.`);

  const ordered = Object.entries(s.rarities || {}).sort((a, b) => {
    const ia = rarityOrder.indexOf(a[0]), ib = rarityOrder.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const maxN = Math.max(1, ...ordered.map(([, n]) => n));

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${s.name} Pokemon TCG Set Guide`,
      description: desc,
      about: { "@type": "Thing", name: `${s.name} (Pokemon Trading Card Game)` },
      url,
      datePublished: syncedAt,
      dateModified: syncedAt,
      author: { "@type": "Organization", name: "Garbage Rips 585", url: SITE + "/" },
      publisher: {
        "@type": "Organization",
        name: "Garbage Rips 585",
        logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Card Sets", item: `${SITE}/sets/` },
        { "@type": "ListItem", position: 3, name: s.name },
      ],
    },
  ];
  if (s.chase?.length) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Top chase cards in ${s.name}`,
      itemListElement: s.chase.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${c.name} ${c.number}`,
      })),
    });
  }

  return head({ title: `${s.name} Set Guide: Cards, Rarities & Chase Card Values | Garbage Rips 585`, desc, canonical: url, image: `${SITE}/assets/og-image.jpg`, ld }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <img class="logo-big" src="${logo}" alt="${esc(s.name)} Pokemon TCG set logo" onerror="this.remove()">
    <h1>${esc(s.name)}</h1>
    <p class="lede" style="max-width:34em">Everything worth knowing about ${esc(s.name)} in one screen. Card counts, what is actually rare, and what the chase cards are going for.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/sets/">Card sets</a> / ${esc(s.name)}</p>

    <div class="facts">
      <div class="fact"><div class="n">${s.total ?? "?"}</div><div class="l">Cards total</div></div>
      <div class="fact"><div class="n">${s.printedTotal ?? "?"}</div><div class="l">In the printed set</div></div>
      <div class="fact"><div class="n">${s.secretCount ?? "?"}</div><div class="l">Secret rares</div></div>
      <div class="fact"><div class="n">${rips || "-"}</div><div class="l">Rips on this channel</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${niceDate(s.released) || "Unknown"}</div><div class="l">Release date${s.released ? ` &bull; ${yearsSince(s.released)}` : ""}</div></div>
    </div>
${s.notes?.inPrint || s.notes?.packPrice ? `
    <div class="facts" style="margin-top:12px">
      ${s.notes.inPrint ? `<div class="fact"><div class="n" style="font-size:1.1rem">${esc(s.notes.inPrint)}</div><div class="l">Still in print?</div></div>` : ""}
      ${s.notes.packPrice ? `<div class="fact"><div class="n">${esc(s.notes.packPrice)}</div><div class="l">Single pack, typical</div></div>` : ""}
    </div>` : ""}
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    ${ordered.length ? `<div class="rarity-list">
      ${ordered.map(([r, n]) => `<div class="rar${CHASE.has(r) ? " chase" : ""}">
        <span class="rar-name">${esc(r)}</span>
        <span class="rar-n">${n}</span>
        <span class="rar-bar"><i style="width:${Math.max(4, Math.round((n / maxN) * 100))}%"></i></span>
      </div>`).join("\n      ")}
    </div>` : `<p class="lede">Card list not available for this set yet.</p>`}
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    ${s.chase?.length ? `
    <div class="chase-grid">
      ${s.chase.map((c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(c.name)}" data-rarity="${esc(c.rarity || "")}"
        data-number="${esc(c.number)}" data-price="${esc(money(c.price))}"
        data-psa10="${esc(gradedPrice(s.id, c.number) ? money(gradedPrice(s.id, c.number)) : "")}"
        data-url="${esc(c.url ? affLink(c.url) : "")}"
        aria-label="Enlarge ${esc(c.name)}">
        ${c.image ? `<img src="${c.image}" alt="${esc(c.name)} ${esc(c.number)}, ${esc(c.rarity || "card")}" loading="lazy" width="245" height="342">` : ""}
        <div class="nm">${esc(c.name)}</div>
        <div class="rr">${esc(c.rarity || "")} &bull; ${esc(c.number)}</div>
        <div class="pr">${money(c.price)}</div>
        ${gradedPrice(s.id, c.number) ? `<div class="pr10">PSA 10 ${money(gradedPrice(s.id, c.number))}</div>` : ""}
      </button>`).join("\n      ")}
    </div>
    <p class="price-note">Prices are TCGplayer market estimates${s.pricesAsOf ? `, last updated ${esc(s.pricesAsOf)}` : ""}. Singles move fast, so treat these as a ballpark rather than a quote.${affOn ? ` ${esc(aff.tcgplayer.disclosure)}` : ""}</p>
    ` : `
    <div class="no-prices">
      <strong>No market prices yet.</strong> ${esc(s.name)} is recent enough that pricing data has not landed in the card database. The card list and rarity counts above are accurate; the values will fill in as the market settles.
    </div>`}
  </div>
</section>

<section class="band-sky tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Quick facts</p>
    <h2>${esc(s.name)} <span class="hl">101</span></h2>
    <ul class="facts-list">
      ${derivedFacts(s).map((f) => `<li>${f}</li>`).join("\n      ")}
      ${(s.notes?.funFacts || []).map((f) => `<li>${esc(f)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Know it on the shelf</p>
    <h2>What the <span class="hl">pack</span> looks like</h2>
    <div class="packshots"${packshots.has(s.id) ? "" : ' style="grid-template-columns:1fr;max-width:340px"'}>
      ${packshots.has(s.id) ? `<div class="packshot-card">
        <div class="ph"><img src="/assets/packshots/${s.id}-booster-pack.webp" alt="${esc(s.name)} booster pack" loading="lazy" width="720" height="1080"></div>
        <p class="cap">The real ${esc(s.name)} pack</p>
        <p class="sub">What you are looking for in the shop.</p>
      </div>` : ""}
      <div class="packshot-card">
        <div class="ph pack pack--${s.id}"><span class="pack-face pack-l"><span class="pack-art"></span></span></div>
        <p class="cap">Our version</p>
        <p class="sub">The Garbage Rips 585 wrapper we put on every ${esc(s.name)} rip. Not a real product, just ours.</p>
      </div>
    </div>
  </div>
</section>

${rips ? `<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We ripped <span class="hl">${rips}</span> of these</h2>
    <div class="set-watch">
      <div class="packshot pack pack--${s.id}"><span class="pack-face pack-l"><span class="pack-art"></span></span></div>
      <div>
        <p class="lede">Want to see what actually comes out of ${esc(s.name)} instead of reading about it? Every ${esc(s.name)} rip on the channel is one tap away.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${s.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
  </div>
</section>` : ""}

<section class="tight">
  <div class="wrap">
    <h2>Other <span class="hl">sets</span></h2>
    <div class="set-index">
      ${sets.filter((o) => o.id !== s.id).slice(0, 6).map((o) => `<a class="set-card" href="/sets/${o.id}.html">
        <img src="/assets/logos/${o.id}-pokemon-tcg-set-logo.webp" alt="" loading="lazy" onerror="this.remove()">
        <span><span class="ttl">${esc(o.name)}</span><br><span class="meta">${o.total ?? "?"} cards</span></span>
      </a>`).join("\n      ")}
    </div>
    <div style="text-align:center;margin-top:22px"><a class="btn btn-ghost" href="/sets/">Every set &rarr;</a></div>
  </div>
</section>

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <img id="lbImg" src="" alt="">
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
    <div class="lb-actions"><a class="btn btn-sky btn-sm" id="lbUrl" href="#" rel="nofollow noopener" hidden>Check current price</a></div>
  </div>
</div>

${FOOTER}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg');
  var last=null;
  function open(b){
    last=b;
    img.src=b.dataset.img; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.rarity,b.dataset.number].filter(Boolean).join(' \u2022 ');
    document.getElementById('lbPr').textContent=b.dataset.price
      + (b.dataset.psa10 ? '  \u2022  PSA 10 ' + b.dataset.psa10 : '');
    var u=document.getElementById('lbUrl');
    if(b.dataset.url){u.href=b.dataset.url;u.hidden=false;}else{u.hidden=true;}
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on'); document.body.style.overflow='';
    if(last) last.focus();      // return focus where it came from
  }
  document.querySelectorAll('.chase-card').forEach(function(b){
    b.addEventListener('click',function(){ if(b.dataset.img) open(b); });
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>
<script src="/assets/app.js"></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- the index
function indexPage() {
  const url = `${SITE}/sets/`;
  const desc =
    `Pokemon TCG set guides: card counts, rarity breakdowns and chase card values for ` +
    `${sets.length} sets, from ${sets[sets.length - 1]?.name} to ${sets[0]?.name}.`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: "Card Sets" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Pokemon TCG set guides",
      itemListElement: sets.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: s.name,
        url: `${SITE}/sets/${s.id}.html`,
      })),
    },
  ];
  return head({ title: `Pokemon TCG Set Guides: Cards, Rarities & Chase Values | Garbage Rips 585`, desc, canonical: url, image: `${SITE}/assets/og-image.jpg`, ld }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Card Pokedex</span>
    <h1>Card <span class="hl">sets</span></h1>
    <p class="lede" style="max-width:34em">Every set we rip, boiled down to the facts that matter. Card counts, what is genuinely rare, and what the chase cards cost.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Card sets</p>
    <div class="set-index">
      ${sets.map((s) => `<a class="set-card" href="/sets/${s.id}.html">
        <img src="/assets/logos/${s.id}-pokemon-tcg-set-logo.webp" alt="${esc(s.name)} logo" loading="lazy" onerror="this.remove()">
        <span>
          <span class="ttl">${esc(s.name)}</span><br>
          <span class="meta">${s.total ?? "?"} cards${s.released ? ` &bull; ${s.released.slice(0, 4)}` : ""}${ripsBySet[s.id] ? ` &bull; ${ripsBySet[s.id]} rips` : ""}</span>
        </span>
      </a>`).join("\n      ")}
    </div>
  </div>
</section>

${FOOTER}
<script src="/assets/app.js"></script>
</body>
</html>
`;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const s of sets) await writeFile(join(OUT, `${s.id}.html`), setPage(s));
await writeFile(join(OUT, "index.html"), indexPage());

console.log(`
Wrote ${sets.length} set pages + index to public/sets/

  with prices:  ${sets.filter((s) => s.chase?.length).length}
  no prices:    ${sets.filter((s) => !s.chase?.length).map((s) => s.id).join(", ") || "none"}

Remember to re-run build-pages.mjs so the sitemap picks these up.
`);
