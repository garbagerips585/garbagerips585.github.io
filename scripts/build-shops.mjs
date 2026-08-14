#!/usr/bin/env node
// Build public/shops.html from data/shops.json: the card shops around
// Rochester that Tim actually buys from.
//
//   node scripts/build-shops.mjs
//
// This is the most local-SEO page on the site. "pokemon card shop rochester ny"
// is a real search with real intent, and a page that names shops, links them
// properly and says what each is good for is the kind of page that earns it.
// LocalBusiness schema is deliberately NOT emitted: these are other people's
// businesses and we are not their authority. ItemList is what this actually is.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { APP_JS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");



/**
 * Strip tracking and session parameters from an outbound link.
 *
 * A URL copied out of a shop's own site usually carries them. They point at one
 * person's browsing session rather than at the page, they stop working, and
 * they leak where the visitor came from. The clean path is the durable link.
 */
function cleanUrl(raw) {
  try {
    const u = new URL(raw);
    const junk = /^(_su_rec|_su_rec_id|utm_|fbclid|gclid|gbraid|wbraid|mc_eid|mc_cid|ref|_ga|igshid|si)$/i;
    for (const k of [...u.searchParams.keys()]) {
      if (junk.test(k) || k.startsWith("utm_")) u.searchParams.delete(k);
    }
    u.hash = "";
    return u.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

const shopsDoc = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8"));
const { shops } = shopsDoc;

const cards = shops
  .map((s) => {
    const url = cleanUrl(s.url);
    const host = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })();
    return `      <li class="shop">
        <div class="shop-head">
          <h2>${esc(s.name)}</h2>
          ${s.visited ? `<span class="shop-flag">Filmed here</span>` : ""}
        </div>
        ${s.area ? `<p class="shop-area">${esc(s.area)}</p>` : ""}
        ${s.blurb ? `<p class="shop-blurb">${esc(s.blurb)}</p>` : ""}
        ${
          (s.goodFor || []).length
            ? `<ul class="shop-tags">${s.goodFor
                .map((t) => `<li>${esc(t)}</li>`)
                .join("")}</ul>`
            : ""
        }
        ${s.address || s.phone || s.hours ? `<dl class="shop-facts">
          ${s.address ? `<dt>Where</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}" rel="noopener" target="_blank">${esc(s.address)}</a></dd>` : ""}
          ${s.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(s.phone.replace(/[^0-9+]/g, ""))}">${esc(s.phone)}</a></dd>` : ""}
          ${s.hours ? `<dt>Open</dt><dd>${esc(s.hours)}</dd>` : ""}
        </dl>` : ""}
        ${(s.plays || []).length ? `<div class="shop-play">
          <p class="shop-play-h">You can play here</p>
          <ul>${s.plays.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          ${s.playNote ? `<p class="shop-play-note">${esc(s.playNote)}</p>` : ""}
          ${s.playWarn ? `<p class="shop-play-warn">${esc(s.playWarn)}</p>` : ""}
        </div>` : ""}
        <p class="shop-links">
          <a class="shop-link" href="${esc(url)}" rel="noopener" target="_blank">
            ${esc(host)} <span aria-hidden="true">&rarr;</span>
          </a>
          ${s.leagueUrl ? `<a class="shop-link" href="${esc(s.leagueUrl)}" rel="noopener" target="_blank">Official league page <span aria-hidden="true">&rarr;</span></a>` : ""}
        </p>
      </li>`;
  })
  .join("\n");

const schema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Pokemon card shops in Rochester, NY",
  description:
    "Local card shops around Rochester, New York that Garbage Rips 585 buys from.",
  itemListElement: shops.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.name,
    url: cleanUrl(s.url),
  })),
};

const style = `
.shops{padding:var(--s7) 0 var(--s8)}
.shops-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s5)}
.shop-list{list-style:none;display:grid;align-items:start;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:980px){.shop-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.shop-list{grid-template-columns:1fr}}
/* align-items:start on the list above, so a card is as tall as its own content.
   Stretched to a common height, a shop with less to say grew a hole in the
   middle: LingSter Games had 280px of blank white between its facts and its
   website link, Millennium 147px, because something below them is pushed to the
   bottom of whatever height the tallest card sets. One full card beside two
   that look broken is worse than three cards of honest, different heights. */
.shop{display:flex;flex-direction:column;gap:var(--s2);background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.shop-head{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.shop h2{font:400 var(--t-m)/1.15 var(--display)}
.shop-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--mustard);color:var(--ink);border:1px solid var(--gold-deep);
  padding:4px 7px;border-radius:var(--r-pill)}
.shop-area{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase}
.shop-blurb{color:var(--ink-2);font-size:var(--t-sm)}
.shop-tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s1)}
.shop-tags li{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.03em;
  background:var(--lilac-pale);color:var(--plum);padding:5px 9px;border-radius:var(--r-pill)}
/* The auto margin moved off .shop-link and onto the wrapper. Left on the link
   itself it stopped pushing anything anywhere once the links were wrapped in a
   <p>, and the cards lost their aligned bottom row. */
.shop-links{margin-top:auto;padding-top:var(--s3);display:flex;flex-wrap:wrap;gap:var(--s4)}
.shop-link{font:700 var(--t-sm)/1 var(--body);
  color:var(--ketchup-deep);min-height:44px;display:inline-flex;align-items:center}
.shop-link:hover{text-decoration:underline}

/* Address, phone and hours. A definition list because that is what it is, and
   it gives the labels somewhere to live without inventing a class each. */
.shop-facts{display:grid;grid-template-columns:auto 1fr;gap:2px var(--s3);margin-top:var(--s2);
  font-size:var(--t-sm)}
.shop-facts dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2)}
.shop-facts dd{line-height:1.5}
.shop-facts a{color:var(--ketchup-deep);font-weight:600}
.shop-facts a:hover{text-decoration:underline}

/* What you can actually turn up and play. */
.shop-play{margin-top:var(--s3);padding:var(--s3);background:var(--paper-3);border-radius:var(--r-sm)}
.shop-play-h{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--plum);margin-bottom:6px}
.shop-play ul{list-style:none;display:grid;gap:4px}
.shop-play li{font-size:var(--t-sm);padding-left:14px;position:relative}
.shop-play li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;
  border-radius:50%;background:var(--gold-deep)}
.shop-play-note{font-size:var(--t-micro);color:var(--ink-2);margin-top:8px;line-height:1.5}
/* Where the shop's own league page and a secondhand listing disagree. Loud,
   because the cost of being wrong is a wasted drive. */
.shop-play-warn{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);
  background:var(--lilac-pale);border-radius:var(--r-sm);padding:8px 10px;margin-top:8px}
.shops-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
`;

const body = `
<main id="main" class="shops">
  <div class="wrap">
    <div class="brk"><h1>Card shops and <span class="hl">where to play</span></h1><span class="ln"></span></div>
    <p class="shops-lede">Where I actually buy, and where you can sit down and play. Real shops around
      Rochester, New York, run by people who know the hobby. Round here the counter you buy from and the
      table you play at are usually the same building, so both are on one page. Buy local when you can:
      the shop is why the local scene exists.</p>
    <ul class="shop-list">
${cards}
    </ul>
    ${shopsDoc.playNote ? `<p class="shops-lede" style="margin-top:var(--s5)">${esc(shopsDoc.playNote)}</p>` : ""}
    <p class="shops-lede">Looking for a one off rather than a weekly night? The
      <a href="/card-shows.html">card show calendar</a> has every show coming up around Rochester, Buffalo
      and Syracuse.</p>
    <p class="shops-lede">Addresses, phone numbers and opening hours were last checked on
      ${esc(longDate(shopsDoc.updated) || "an unrecorded date")}. Shops move and change their hours, so call ahead if you are
      making a trip of it.</p>
    <p class="shops-note">NOT SPONSORED AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO.
      IF YOU RUN A CARD SHOP AROUND ROCHESTER AND YOU ARE NOT ON HERE, SAY HELLO ON ANY OF THE SOCIALS.</p>
  </div>
</main>`;

// Share the home page's shell so this page cannot drift from the design.
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
  .replace(
    /<title>[\s\S]*?<\/title>/,
    // Both halves of what the page now answers. "Where to play pokemon rochester
    // ny" is its own search with its own intent, and the old title only claimed
    // the buying half.
    `<title>Pokemon Card Shops in Rochester NY &amp; Where to Play | Garbage Rips 585</title>`
  )
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${
      shops.length
    } local Pokemon card shops around Rochester, New York, and where to play: league nights, prereleases and organized play, with addresses and hours.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/shops.html">`)
  .replace(/(<meta property="og:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-shops.jpg`)
  .replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-shops.jpg`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/shops.html`)
  .replace(
    /(<meta property="og:title" content=")[^"]*/,
    `$1Pokemon Card Shops in Rochester, NY`
  );

const html = `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${style}</style>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
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
`;

await writeFile(join(ROOT, "public/shops.html"), html);

const cleaned = shops.filter((s) => cleanUrl(s.url) !== s.url);
console.log(`Wrote public/shops.html  (${shops.length} shop${shops.length === 1 ? "" : "s"})`);
for (const s of cleaned) {
  console.log(`  cleaned tracking parameters off ${s.name}:\n    ${cleanUrl(s.url)}`);
}
