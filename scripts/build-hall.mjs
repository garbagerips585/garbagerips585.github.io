#!/usr/bin/env node
// Build public/hall.html, the Card Hall of Fame: the cards actually pulled on
// camera, ranked by what they are worth.
//
//   node scripts/build-hall.mjs
//
// Prices are NOT stored in data/hall.json. They are looked up here from
// data/psa10.json and public/data/sets.json, so a price refresh moves this page
// without anyone re-importing the spreadsheet, and one card can never show two
// different numbers on two different pages.
//
// Ranked by PSA 10 where there is one, and by raw near mint otherwise, because
// a graded price is the better measure of what a card is worth and most cards
// have no graded price at all.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { APP_JS } from "../shared/chrome.mjs";
import { esc, shortDate, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MIN_SALES = 10; // same floor the set guides use

let { cards: hall } = JSON.parse(await readFile(join(ROOT, "data/hall.json"), "utf8"));

// FALL BACK TO WHAT WAS ACTUALLY PULLED.
//
// This page waited on a "Card Hall of Fame" tick in the spreadsheet and, until
// somebody ticked one, published "No cards inducted yet" to a nav link and to
// two separate above-the-fold promises on the home page. The site advertised a
// hall of fame twice and the hall of fame was empty, which is the worst version
// of this: not a missing page, a page that says there is nothing here.
//
// data/hits.json already records every card pulled on camera, and this page's
// own lede is "Every card worth remembering that has come out of a pack on this
// channel, ranked by what it is worth". That IS the hits list. So when nothing
// has been inducted by hand, the hall is every hit, ranked by value, and the
// page says so rather than implying a curation nobody performed.
//
// A hand-picked list still wins outright the moment one exists, which keeps the
// tick meaningful: it becomes "promote the best" rather than "make the page
// work at all".
let derivedFromHits = false;
if (!hall.length) {
  const hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
  const seen = new Set();
  const out = [];
  for (const list of Object.values(hits)) {
    for (const h of list) {
      // No set means a promo, which has no checklist to resolve a number
      // against, so it cannot be priced or pictured here. Left out rather than
      // listed as a card the page cannot say anything about.
      if (!h.set) continue;
      let cards = null;
      try {
        cards = JSON.parse(await readFile(join(ROOT, `public/data/cards/${h.set}.json`), "utf8")).cards;
      } catch { continue; }
      const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
      const same = cards.filter((c) => norm(c.name) === norm(h.card));
      // Where the sheet named a rarity, take the printing that matches: that is
      // the one actually pulled. Same rule build-pages.mjs uses for rip pages,
      // so a card cannot show one number here and another there.
      const want = h.rarity ? norm(h.rarity).slice(0, 8) : null;
      const m = (want && same.find((c) => norm(c.rarity).includes(want))) || same[0];
      if (!m) continue;
      const key = `${h.set}-${m.n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Carry the card's OWN art, price and rarity from the checklist. resolve()
      // below only knows how to look a card up in the set's `chase` list, which
      // is the dozen or so cards a set page features, and 15 of 15 hits were not
      // in it: the page rendered with no images and no prices at all.
      out.push({
        set: h.set, number: m.n, name: m.name,
        _img: m.img ? `${m.img}/high.webp` : null,
        _raw: typeof m.price === "number" ? m.price : null,
        _rarity: m.rarity || h.rarity || null,
      });
    }
  }
  if (out.length) {
    hall = out;
    derivedFromHits = true;
  }
}
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));
let graded = {};
try {
  graded = JSON.parse(await readFile(join(ROOT, "data/psa10.json"), "utf8"));
} catch { /* optional */ }

const setById = new Map(sets.map((s) => [s.id, s]));

/** Everything the site knows about one pulled card, from every source. */
function resolve(c) {
  const key = `${c.set}-${c.number}`;
  const set = setById.get(c.set);
  const chase = (set?.chase || []).find((x) => String(x.number) === String(c.number)) || null;

  const manual = graded.prices?.[key];
  const auto = graded.auto?.[key];
  const psa10 =
    (typeof manual?.price === "number" ? manual.price : typeof manual === "number" ? manual : null) ??
    (auto?.psa10 && !(auto.psa10Sales != null && auto.psa10Sales < MIN_SALES) ? auto.psa10 : null);

  return {
    ...c,
    setName: set?.name || c.set,
    rarity: c._rarity || c.rarity || chase?.rarity || null,
    image: c._img || chase?.imageLarge || chase?.image || null,
    url: chase?.url || null,
    // Raw from the checklist first, then whatever the price sync recorded.
    raw: c._raw ?? chase?.price ?? auto?.rawNm ?? null,
    psa10,
    psa10AsOf: manual?.asOf || auto?.asOf || null,
    psa10Sales: auto?.psa10Sales ?? null,
  };
}

const ranked = hall
  .map(resolve)
  .sort((a, b) => (b.psa10 || b.raw || 0) - (a.psa10 || a.raw || 0));

// One total over one set of cards. Summing PSA 10 across the few cards that
// have a graded price and raw across all of them, then showing the two side by
// side, made the collection look as though grading had lost it money.
// Best-known value per card: graded where we have it, raw otherwise.
// A SUM, and the label has to say so. This was printed as "Best known value",
// which reads as the best single card, next to a table whose priciest card is
// $15.30. Every figure on the page contradicted the headline stat, and read
// correctly it was announcing the channel's entire on-camera haul as one
// number without saying that is what it was.
const totalValue = ranked.reduce((n, c) => n + (c.psa10 || c.raw || 0), 0);
const gradedCards = ranked.filter((c) => c.psa10);
const totalGraded = gradedCards.reduce((n, c) => n + c.psa10, 0);

function plaque(c, i) {
  const rank = i + 1;
  const top = rank <= 3 ? ` chof-top chof-${rank}` : "";
  const img = c.image
    ? `<img src="${esc(c.image)}" alt="${esc(c.name)} ${esc(c.rarity || "")} from Pokemon ${esc(c.setName)}" loading="lazy" width="245" height="342">`
    : `<span class="chof-noart">${esc(c.name)}</span>`;
  return `      <li class="chof${top}">
        <span class="chof-rank">${rank}</span>
        <button class="chof-art" type="button"
          data-img="${esc(c.image || "")}" data-name="${esc(c.name)}"
          data-set="${esc(c.setName)}" data-rarity="${esc(c.rarity || "")}"
          data-number="${esc(c.number)}" data-url="${esc(c.url || "")}"
          data-raw="${c.raw ? esc(moneyCompact(c.raw)) : ""}"
          data-psa="${c.psa10 ? esc(moneyCompact(c.psa10)) : ""}"
          aria-label="Enlarge ${esc(c.name)}">${img}</button>
        <div class="chof-body">
          <b class="chof-name">${esc(c.name)}</b>
          <span class="chof-set">${esc(c.setName)} &bull; #${esc(c.number)}</span>
          ${c.rarity ? `<span class="chof-rar">${esc(c.rarity)}</span>` : ""}
          <dl class="chof-prices">
            <div><dt>Raw NM</dt><dd>${c.raw ? moneyCompact(c.raw) : "&mdash;"}</dd></div>
            <div class="psa"><dt>PSA 10${c.psa10 && c.psa10AsOf ? ` <i>${esc(c.psa10AsOf)}</i>` : ""}</dt><dd>${c.psa10 ? moneyCompact(c.psa10) : "&mdash;"}</dd></div>
          </dl>
          ${c.pulledOn || c.pulledIn
            ? `<span class="chof-pulled">Pulled${c.pulledOn ? ` ${shortDate(c.pulledOn)}` : ""}${
                c.pulledIn ? ` &bull; ${esc(c.pulledIn)}` : ""
              }</span>`
            : ""}
        </div>
      </li>`;
}

const style = `
/* --------------------------------------------------------------------------
   Card Hall of Fame. Dark, because a hall of fame is a lit room with the
   exhibits picked out of it, and because foil reads as foil against near-black
   in a way it never does on cream.
   -------------------------------------------------------------------------- */
.chofpage{background:var(--ink);color:#F4F1E2;padding:var(--s7) 0 var(--s8);
  background-image:radial-gradient(120% 70% at 50% 0%, rgba(224,162,31,.16), transparent 60%)}
.chof-head{text-align:center;max-width:44em;margin:0 auto var(--s6)}
.chof-head h1{font:400 clamp(2rem,6vw,3.1rem)/1.05 var(--display);color:var(--mustard)}
.chof-head p{color:#B9C6D2;margin-top:var(--s3)}
.chof-tally{display:flex;justify-content:center;gap:var(--s3);flex-wrap:wrap;margin-top:var(--s5)}
.chof-tally div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);
  border-radius:var(--r);padding:var(--s3) var(--s5);min-width:132px}
.chof-tally b{display:block;font:400 1.5rem/1 var(--display);color:var(--mustard)}
.chof-tally span{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.08em;color:#9FB0C0;
  text-transform:uppercase}

.chof-list{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s5) var(--s4);
  counter-reset:chof}
@media(max-width:1080px){.chof-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.chof-list{grid-template-columns:1fr;gap:var(--s4)}}
.chof{position:relative;display:flex;gap:var(--s4);align-items:flex-start;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
  border-radius:14px;padding:var(--s4);transition:border-color .15s,transform .15s}
.chof:hover{border-color:rgba(224,162,31,.55);transform:translateY(-3px)}
/* The top three get the plaque treatment. Everything below is still an
   exhibit, just not on the podium. */
.chof-top{border-color:rgba(224,162,31,.45);background:rgba(224,162,31,.09)}
.chof-1{box-shadow:0 0 0 1px rgba(224,162,31,.5), 0 14px 34px rgba(0,0,0,.45)}
.chof-rank{position:absolute;left:-10px;top:-10px;z-index:3;width:34px;height:34px;
  border-radius:50%;display:grid;place-items:center;font:400 1rem/1 var(--display);
  color:var(--ink);background:linear-gradient(180deg,#FBE08A,var(--gold));
  box-shadow:0 2px 6px rgba(0,0,0,.5)}
.chof-top .chof-rank{width:40px;height:40px;font-size:1.2rem}

.chof-art{flex:none;width:clamp(96px,26vw,120px);padding:0;border:0;background:none;
  cursor:zoom-in;border-radius:8px;overflow:hidden;line-height:0;
  box-shadow:0 6px 18px rgba(0,0,0,.45)}
.chof-art img{width:100%;height:auto;aspect-ratio:245/342;object-fit:contain;background:#0E1B2A}
.chof-noart{display:grid;place-items:center;aspect-ratio:245/342;padding:10%;
  font:400 .8rem/1.2 var(--display);color:#9FB0C0;text-align:center;background:#0E1B2A}
.chof-body{min-width:0;flex:1}
.chof-name{font:600 var(--t-body)/1.25 var(--body);display:block}
.chof-set,.chof-rar,.chof-pulled{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.03em;color:#9FB0C0}
.chof-rar{color:var(--lilac)}
.chof-prices{display:flex;gap:var(--s4);margin-top:var(--s3);padding-top:var(--s3);
  border-top:1px dashed rgba(255,255,255,.18)}
.chof-prices dt i{font-style:normal;font-weight:400;opacity:.7}
.chof-prices dt{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;color:#9FB0C0;
  text-transform:uppercase}
.chof-prices dd{font:700 var(--t-m)/1.2 var(--body);color:#F4F1E2}
.chof-prices .psa dd{color:var(--mustard)}
.chof-pulled{margin-top:var(--s2)}
.chof-empty{text-align:center;color:#B9C6D2;background:rgba(255,255,255,.05);
  border:1px dashed rgba(255,255,255,.2);border-radius:14px;padding:var(--s7) var(--s5)}
.chof-note{font:700 var(--t-micro)/1.7 var(--mono);color:#9FB0C0;text-align:center;
  margin-top:var(--s7);max-width:52em;margin-inline:auto}

/* lightbox */
.lb{position:fixed;inset:0;z-index:200;display:none;place-items:center;padding:var(--s5);
  background:rgba(8,14,22,.92)}
.lb.on{display:grid}
.lb-in{max-width:520px;width:100%;text-align:center}
.lb-in img{width:100%;max-height:76vh;object-fit:contain;border-radius:10px}
.lb-in h2{font:400 1.4rem/1.2 var(--display);color:#F4F1E2;margin-top:var(--s4)}
.lb-in p{font:700 var(--t-sm)/1.6 var(--mono);color:#9FB0C0}
.lb-in .lb-pr{color:var(--mustard);font-size:var(--t-m)}
.lb-close{position:absolute;top:var(--s4);right:var(--s4);width:44px;height:44px;
  border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);
  color:#fff;font-size:1.3rem;cursor:pointer}
`;

const body = `
<main id="main" class="chofpage">
  <div class="wrap">
    <div class="chof-head">
      <h1>Card Hall of Fame</h1>
      <p>Every card that has come out of a pack on this channel, ranked by what it is worth. Tap a card to see it full size.${derivedFromHits ? " Nothing here was hand picked: this is the whole list of what was pulled on camera, in value order." : ""}</p>
      ${ranked.length ? `<div class="chof-tally">
        <div><b>${ranked.length}</b><span>${derivedFromHits ? "Cards pulled" : "Cards inducted"}</span></div>
        ${totalValue ? `<div><b>${moneyCompact(totalValue)}</b><span>All of them together</span></div>` : ""}
        ${gradedCards.length ? `<div><b>${moneyCompact(totalGraded)}</b><span>${gradedCards.length} of ${ranked.length} graded</span></div>` : ""}
      </div>` : ""}
    </div>

    ${ranked.length
      ? `<ol class="chof-list">
${ranked.map(plaque).join("\n")}
    </ol>`
      : `<p class="chof-empty">No cards inducted yet. Flag a card as <b>Card Hall of Fame</b> on the
         Chase Cards tab of the video log and it appears here, ranked automatically.</p>`}

    <p class="chof-note">RANKED BY PSA 10 WHERE THERE IS ONE, AND BY RAW NEAR MINT OTHERWISE.
      A DASH MEANS NO PRICE WE ARE WILLING TO STAND BEHIND YET, NOT A CARD WORTH NOTHING.</p>
  </div>
</main>

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Card">
  <button class="lb-close" type="button" aria-label="Close">&times;</button>
  <div class="lb-in">
    <img id="lbImg" src="" alt="">
    <h2 id="lbNm"></h2>
    <p id="lbRr"></p>
    <p class="lb-pr" id="lbPr"></p>
  </div>
</div>

<script>
(function(){
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'), last=null;
  function open(b){
    last=b;
    var src=b.dataset.img;
    if(!src) return;                       // no art, nothing to enlarge
    img.src=src; img.alt=b.dataset.name+' '+b.dataset.number;
    document.getElementById('lbNm').textContent=b.dataset.name;
    document.getElementById('lbRr').textContent=[b.dataset.set,b.dataset.rarity,'#'+b.dataset.number].filter(Boolean).join(' \\u2022 ');
    document.getElementById('lbPr').textContent=[
      b.dataset.raw?'Raw NM '+b.dataset.raw:'',
      b.dataset.psa?'PSA 10 '+b.dataset.psa:''
    ].filter(Boolean).join('   \\u2022   ');
    lb.classList.add('on');
    document.body.style.overflow='hidden';
    lb.querySelector('.lb-close').focus();
  }
  function close(){
    lb.classList.remove('on');
    document.body.style.overflow='';
    if(last) last.focus();                 // send focus back where it came from
  }
  document.querySelectorAll('.chof-art').forEach(function(b){
    b.addEventListener('click',function(){open(b)});
  });
  lb.addEventListener('click',function(e){ if(e.target===lb||e.target.closest('.lb-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&lb.classList.contains('on')) close(); });
})();
</script>`;

const schema = ranked.length
  ? {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Garbage Rips 585 Card Hall of Fame",
      description: "The best Pokemon cards pulled on the Garbage Rips 585 channel, ranked by value.",
      itemListElement: ranked.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${c.name} #${c.number} (${c.setName})`,
        ...(c.url ? { url: c.url } : {}),
      })),
    }
  : null;

const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
// Stop at </header>. Slicing to the rail also swallowed the menu that sits
// between them, and these pages then append their own copy, so every one
// shipped two <nav id="menu"> blocks: invalid HTML and a duplicated landmark.
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf('</header>') + '</header>'.length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
// The bar carries the menu button; the panel it controls lives after </header>,
// so it has to be copied across too or the button opens nothing.
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>Card Hall of Fame: Our Best Pokemon Pulls | Garbage Rips 585</title>`)
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="The best Pokemon cards ever pulled on Garbage Rips 585, ranked by value, with raw near mint and PSA 10 market prices.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/hall.html">`)
  .replace(/(<meta property="og:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-hall.jpg`)
  .replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-hall.jpg`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/hall.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1Card Hall of Fame | Garbage Rips 585`);

await writeFile(
  join(ROOT, "public/hall.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${style}</style>
${schema ? `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>` : ""}
</head>
<body>
${skipLink}
${sprite}

${bar}
${menuPanel}
${body}
${footer}

${APP_JS}
</body>
</html>
`
);

console.log(`Wrote public/hall.html
  cards inducted   ${ranked.length}
  with PSA 10      ${ranked.filter((c) => c.psa10).length}
  with a raw price ${ranked.filter((c) => c.raw).length}
  with card art    ${ranked.filter((c) => c.image).length}
`);
if (!ranked.length) {
  console.log(`Nothing inducted yet. Mark cards "Card Hall of Fame" on the Chase Cards
tab, export it, and run:  node scripts/import-cards.mjs <csv>
`);
}
