#!/usr/bin/env node
// Generate a set guide for every non-English set the channel has ripped.
//
//   node scripts/sync-intl-guides.mjs   (first, writes the data)
//   node scripts/build-intl-pages.mjs   (this, writes public/sets/<id>.html)
//
// These live in /sets/ alongside the English guides and share their markup, so
// the two never drift into looking like different websites.
//
// ENGLISH LEADS, NATIVE STAYS. Roughly 95% of the audience is in the US, so the
// H1 is the English name and the native name sits under it. The native name is
// never dropped: it is the verifiable one, and it is what is printed on the pack
// somebody is holding.
//
// THE POINT OF THESE PAGES is the "same set, different name" band. Somebody who
// watched the Abyss Eye rips and then went looking for Pitch Black had no way to
// learn they are the same cards. That comparison is the reason to build them,
// so it sits above everything except the quick facts.
//
// WHAT IS NOT ON THEM. No prices: TCGdex carries Cardmarket euro figures for
// some of these and nothing at all for the newest, and half a price table is
// worse than none. No pull rates, same rule as the English guides. Trainer and
// Supporter names stay in their native script because no keyless source
// translates them and guessing at 35 of them would be exactly the sort of
// confident error a reference page must not make.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { labelFor } from "../shared/taxonomy.mjs";
import { esc, longDate, rarityLabel } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/sets");

const guides = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8"));
const { sets: enSets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const enById = new Map(enSets.map((s) => [s.id, s]));
const ripsBySet = {};
for (const v of videos) for (const s of v.sets || []) (ripsBySet[s] ||= []).push(v);

const yearsSince = (iso) => {
  if (!iso) return "";
  const y = (Date.now() - new Date(iso).getTime()) / 31557600000;
  if (y < 1) return `${Math.max(1, Math.round(y * 12))} months ago`;
  return `${y < 2 ? "1 year" : `${Math.floor(y)} years`} ago`;
};

const head = ({ title, desc, canonical, image, ld, noindex = false }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${
  noindex
    ? '\n<meta name="robots" content="noindex,follow">'
    : ""
}
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
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://assets.tcgdex.net" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css">
${STYLES}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
`;

/** The card name a US reader can actually read, with the native name kept alongside. */
const cardName = (c) => c.en || c.native || "";
const cardSub = (c) => (c.en && c.native && c.en !== c.native ? c.native : "");

/** Human label for what kind of card this is, used where no English name exists. */
const kindOf = (c) => (c.category === "Pokemon" ? "" : c.category === "Trainer" ? "Trainer" : c.category === "Energy" ? "Energy" : "");

// --------------------------------------------------------- the comparison band

/**
 * The reason these pages exist: this set next to the English set it became.
 * Reuses the .intl-* markup the English guides already use for the mirror of
 * this panel, so the two read as two views of one fact rather than two designs.
 */
function twinBand(g) {
  const en = g.equivalent ? enById.get(g.equivalent) : null;

  if (g.exclusive || !g.equivalent) {
    return `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>No English version</p>
    <h2>This one <span class="hl">never left</span></h2>
    <p class="lede intl-lede">${esc(g.english)} looks to be a regional exclusive. There is no English set to compare it
      to and no Japanese one either: its set code returns nothing under Japanese, Korean or Traditional Chinese on
      TCGdex, which is where we checked. If you want these cards, imported ${esc(g.langName)} packs are the way.</p>
  </div>
</section>`;
  }

  if (!en) return "";

  const enTotal = en.total || en.printedTotal || 0;
  const merged = g.siblingName || (g.sibling ? guides.sets[g.sibling]?.english : null);

  return `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Same cards, different name</p>
    <h2>${esc(g.english)} is <span class="hl">${esc(en.name)}</span></h2>
    <p class="lede intl-lede">If you have watched these rips and then gone looking for the set in a US shop, this is the
      one you want. ${esc(g.english)} is the ${esc(g.langName)} printing behind English ${esc(en.name)}${
        merged ? `, which English built by merging it with ${esc(merged)}` : ""
      }.</p>
    <ul class="intl-grid">
      <li class="intl">
        <p class="intl-lang">${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.langName)}${g.tcgdexId ? ` &bull; ${esc(g.tcgdexId)}` : ""}</p>
        <h3>${esc(g.english)}</h3>
        ${g.native ? `<p class="intl-native" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
        <p class="intl-meta">${[
          g.cardCount?.total ? `${g.cardCount.total} cards` : null,
          longDate(g.released) || null,
        ].filter(Boolean).join(" &bull; ")}</p>
        <!--
          There was a "Full checklist on TCGdex" link here, pointing at
          www.tcgdex.net/<lang>/sets/<id>. All 15 URLs it built are 404s, and so
          is the root: TCGdex publishes api., assets. and tcgdex.dev and has no
          consumer site, so the link could never have worked. It was redundant
          as well, because the checklist is further down THIS page and the
          source line at the foot already credits TCGdex.
        -->
        <p class="intl-lead">The one on this page, checklist below</p>
      </li>
      <li class="intl is-en">
        <p class="intl-lang">English${en.apiId ? ` &bull; ${esc(String(en.apiId).toUpperCase())}` : ""}</p>
        <h3>${esc(en.name)}</h3>
        <p class="intl-meta">${[
          enTotal ? `${enTotal} cards` : null,
          longDate(en.released) || null,
        ].filter(Boolean).join(" &bull; ")}</p>
        ${g.released && en.released && g.released < en.released
          ? `<p class="intl-lead">Out ${esc(gap(g.released, en.released))} later</p>`
          : `<p class="intl-lead">The English release</p>`}
        <a class="intl-link" href="/sets/${esc(g.equivalent)}.html">Read the ${esc(en.name)} guide</a>
      </li>
    </ul>
    ${g.confidence === "partial"
      ? `<p class="intl-warn">A partial match. ${esc(g.note || "")}</p>`
      : g.note ? `<p class="price-note">${esc(g.note)}</p>` : ""}
  </div>
</section>`;
}

/** "about three months" style gap between two dates. */
function gap(a, b) {
  const days = Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000);
  if (days < 45) return `${days} days`;
  const months = Math.round(days / 30.4);
  return months < 18 ? `${months} months` : `${(months / 12).toFixed(1)} years`;
}

// ------------------------------------------------------------------ the page

function guidePage(g) {
  const url = `${SITE}/sets/${g.id}.html`;
  const en = g.equivalent ? enById.get(g.equivalent) : null;
  const rips = ripsBySet[g.id] || [];
  const label = labelFor("sets", g.id);
  const total = g.cardCount?.total;

  const desc =
    `${g.english} (${g.native || g.langName}) Pokemon TCG set guide: ` +
    `${total ? `${total} cards, ` : ""}released ${longDate(g.released) || "recently"}` +
    (en ? `, and why it is the same set as English ${en.name}.` : `, a ${g.langName} exclusive.`);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${g.english} Pokemon TCG Set Guide`,
      description: desc,
      image: [`${SITE}/assets/og-image.jpg`],
      about: { "@type": "Thing", name: `${g.english} (Pokemon Trading Card Game, ${g.langName})` },
      url,
      // datePublished is when the guide first appeared and never moves;
      // dateModified is when its data was last re-read. Setting both to the
      // sync date made one false and the other meaningless.
      datePublished: g.published || guides.checked,
      dateModified: guides.checked,
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
        { "@type": "ListItem", position: 3, name: g.english },
      ],
    },
  ];

  const rarities = Object.entries(g.rarities || {}).sort((a, b) => b[1] - a[1]);
  const maxN = Math.max(1, ...rarities.map(([, n]) => n));
  const secretCount = (g.cards || []).filter((c) => c.secret).length;

  // A guide with no checklist, no rarities and no chase cards is a stub, and the
  // site already noindexes thin rip pages for exactly this reason. It stays
  // reachable and in the nav; it just does not go to search until TCGdex
  // publishes the cards.
  const thin = !g.hasCards;
  return head({
    title: g.equivalent
      ? `${g.english} (${g.langName}) Set Guide: Cards & English Equivalent | Garbage Rips 585`
      : `${g.english} (${g.langName}) Set Guide | Garbage Rips 585`,
    desc, canonical: url, image: `${SITE}/assets/og-image.jpg?v=2`, ld, noindex: thin,
  }) + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; ${g.langFlag ? `${g.langFlag} ` : ""}${esc(g.langName)} set</span>
    <h1>${esc(g.english)}</h1>
    ${g.native ? `<p class="intl-hero-native cjk" lang="${esc(g.lang)}">${esc(g.native)}</p>` : ""}
    <p class="lede" style="max-width:34em">${
      en
        ? `The ${esc(g.langName)} printing of the set English calls ${esc(en.name)}. Same cards, different name.` +
          (g.released && en.released && g.released < en.released ? " And out first." : "")
        : `A ${esc(g.langName)} set that never got an English release.`
    }</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / <a href="/sets/">Card sets</a> / ${esc(g.english)}</p>

    <div class="facts">
      <div class="fact"><div class="n">${total ?? "?"}</div><div class="l">Cards total</div></div>
      ${g.cardCount?.official ? `<div class="fact"><div class="n">${g.cardCount.official}</div><div class="l">In the printed set</div></div>` : ""}
      ${secretCount ? `<div class="fact"><div class="n">${secretCount}</div><div class="l">Numbered past the set</div></div>` : ""}
      ${rips.length
        ? `<a class="fact fact-link" href="/videos.html?set=${g.id}"><div class="n">${rips.length}</div><div class="l">Rip${rips.length === 1 ? "" : "s"} on this channel <span aria-hidden="true">&rarr;</span></div></a>`
        : `<div class="fact"><div class="n">-</div><div class="l">Rips on this channel</div></div>`}
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${longDate(g.released) || "Unknown"}</div><div class="l">Release date${g.released ? ` &bull; ${yearsSince(g.released)}` : ""}</div></div>
    </div>
  </div>
</section>
${twinBand(g)}
${g.notable?.length ? `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The ones you want</p>
    <h2>Top <span class="hl">chase cards</span></h2>
    <div class="chase-grid">
      ${g.notable.map((c) => `<button class="chase-card" type="button"
        data-img="${esc(c.imageLarge || c.image || "")}"
        data-name="${esc(cardName(c))}" data-rarity="${esc(rarityLabel(c.rarity) || (c.secret ? "Numbered past the set" : ""))}"
        data-number="${esc(c.localId || "")}" data-price=""
        aria-label="Enlarge ${esc(cardName(c))}">
        ${c.image ? `<img src="${esc(c.image)}" alt="${esc(cardName(c))} ${esc(c.localId || "")}, ${esc(g.english)}" loading="lazy" onerror="this.remove()" width="245" height="337">` : ""}
        <div class="nm">${esc(cardName(c))}</div>
        ${cardSub(c) ? `<div class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</div>` : ""}
        <div class="rr">${esc(rarityLabel(c.rarity) || (c.secret ? "Secret" : kindOf(c) || "Card"))} &bull; ${esc(c.localId || "")}</div>
      </button>`).join("\n      ")}
    </div>
    <p class="price-note">No prices here on purpose. Imported singles are priced in euro or yen by the
      databases that carry them at all, and a converted half-filled price table is worse than none. The English
      ${en ? `<a href="/sets/${esc(g.equivalent)}.html">${esc(en.name)} guide</a> carries` : "guides carry"} live USD
      values for the same cards.</p>
  </div>
</section>` : ""}
${rarities.length ? `
<section class="band-sky tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>What is actually rare</p>
    <h2>Rarity <span class="hl">breakdown</span></h2>
    <div class="rarity-list">
      ${rarities.map(([r, n]) => `<div class="rar">
        <div class="rar-n">${esc(rarityLabel(r) || r)}</div>
        <div class="rar-bar"><span style="width:${Math.round((n / maxN) * 100)}%"></span></div>
        <div class="rar-c">${n}</div>
      </div>`).join("\n      ")}
    </div>
    ${secretCount ? `<p class="price-note">${secretCount} more cards are numbered past card ${g.cardCount?.official}, which is
      how ${esc(g.dataSource?.langName || g.langName)} sets carry their secret rares. TCGdex does not label the rarity on every
      one of them, so they are counted here rather than guessed at.</p>` : ""}
  </div>
</section>` : ""}
${g.cards?.length ? `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>Full <span class="hl">checklist</span></h2>
    <p class="lede">All ${g.cards.length} cards, English names where the card is a Pokemon.${
      g.dataSource?.borrowed
        ? ` This list is the ${esc(g.dataSource.langName)} printing's, because TCGdex has no ${esc(g.langName)} card records for this set.`
        : ""
    }</p>
    <details class="ig-list">
      <summary>Show the full ${esc(g.english)} checklist</summary>
      <ol class="ig-cards">
        ${g.cards.map((c) => `<li><span class="ig-no">${esc(c.localId || "")}</span>
          <span class="ig-nm">${esc(cardName(c))}</span>
          ${cardSub(c) ? `<span class="ig-native" lang="${esc(g.dataSource?.lang || g.lang)}">${esc(cardSub(c))}</span>` : ""}
          ${c.rarity ? `<span class="ig-rr">${esc(rarityLabel(c.rarity))}</span>` : c.secret ? `<span class="ig-rr">Secret</span>` : kindOf(c) ? `<span class="ig-rr">${esc(kindOf(c))}</span>` : ""}</li>`).join("\n        ")}
      </ol>
    </details>
    <p class="price-note">Pokemon names come from the National Pokedex number on each card, so they are looked up rather
      than transliterated. Trainer and Supporter cards keep their ${esc(g.dataSource?.langName || g.langName)} names: no
      free source translates them, and a guessed name on a reference page is worse than an honest one you can paste into
      a search.</p>
  </div>
</section>` : `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Every card</p>
    <h2>No <span class="hl">checklist</span> yet</h2>
    <p class="lede">TCGdex knows this set exists, when it landed and how big it is, but has not published its card list.
      As soon as it does, this page fills in on the next nightly build.</p>
  </div>
</section>`}
${rips.length ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>See it opened</p>
    <h2>We ripped <span class="hl">${rips.length}</span> of these</h2>
    <div class="set-watch">
      <div class="packshot pack pack--default"><span class="pack-face pack-l"><span class="pack-art"></span></span></div>
      <div>
        <p class="lede">Imported packs, opened on camera in Rochester. No idea what any of the text says, which is half
          the fun. Every ${esc(g.english)} rip on the channel is one tap away.</p>
        <div class="btn-row" style="margin-top:16px">
          <a class="btn btn-yt" href="/videos.html?set=${g.id}">Watch the ${esc(label)} rips</a>
        </div>
      </div>
    </div>
  </div>
</section>` : ""}

<section class="tight">
  <div class="wrap">
    <h2>Where this <span class="hl">came from</span></h2>
    <ul class="facts-list">
      <li>Set details, checklist and rarities from <a href="https://tcgdex.dev/" rel="noopener" target="_blank">TCGdex</a>, read ${esc(longDate(guides.checked) || guides.checked)}.</li>
      ${g.dataSource?.borrowed ? `<li><strong>The checklist below is the ${esc(g.dataSource.langName)} one.</strong> ${
        g.dataNote
          ? esc(g.dataNote)
          : `TCGdex lists this set in ${esc(g.langName)} but carries no cards for it, so the checklist comes from ${esc(g.dataSource.langName)} ${esc(g.dataSource.id)}, the printing it was translated from.`
      }${g.declaredCount && g.cardCount?.total && g.declaredCount !== g.cardCount.total
          ? ` Its own entry claims ${g.declaredCount} cards against ${g.cardCount.total} in the ${esc(g.dataSource.langName)} set; that figure has no cards behind it to check, so the verifiable number is the one shown above.`
          : ""}</li>` : ""}
      ${g.nameNote ? `<li><strong>On the name.</strong> ${esc(g.nameNote)}</li>` : ""}
      <li>Pokemon card names in English via the National Pokedex number, through <a href="https://pokeapi.co" rel="noopener" target="_blank">PokeAPI</a>.</li>
      <li>This is a fan page. Nothing here is sold by us and none of it is official.</li>
    </ul>
  </div>
</section>

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card image">
  <div class="lb-inner">
    <button class="lb-close" type="button" aria-label="Close">&times;</button>
    <img id="lbImg" src="" alt="">
    <p class="lb-nm" id="lbNm"></p>
    <p class="lb-rr" id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
  </div>
</div>

</main>
${footer("Set data from TCGdex, card names via PokeAPI. Fan made, not official.")}
<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    img.src=b.dataset.img; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.rarity,b.dataset.number].filter(Boolean).join(' • ');
    document.getElementById('lbPr').textContent='';
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on'); document.body.style.overflow='';
    if(last) last.focus();
  }
  document.querySelectorAll('.chase-card').forEach(function(b){
    b.addEventListener('click',function(){ if(b.dataset.img) open(b); });
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>
${APP_JS}
</body>
</html>
`;
}

// ------------------------------------------------------------------------ run

await mkdir(OUT, { recursive: true });
const written = [];
for (const [id, g] of Object.entries(guides.sets || {})) {
  const page = guidePage({ ...g, id });
  await writeFile(join(OUT, `${id}.html`), page);
  written.push({ id, english: g.english, rips: (ripsBySet[id] || []).length, cards: g.cards?.length || 0 });
}

console.log(`Wrote ${written.length} non-English set guides to public/sets/`);
for (const w of written) {
  console.log(`  /sets/${w.id}.html`.padEnd(34) + `${w.english.padEnd(18)} ${String(w.cards).padStart(3)} cards, ${w.rips} rip${w.rips === 1 ? "" : "s"}`);
}
