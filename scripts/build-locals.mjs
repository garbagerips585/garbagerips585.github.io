#!/usr/bin/env node
// Build /vendors.html and /creators.html: the people, not the shops.
//
//   node scripts/build-locals.mjs
//
// Two pages from one script because they are the same page with a different
// noun: a name, what they do, and the places you can follow them. Splitting
// them into two builders would mean two copies of the link rendering and two
// places to fix the next time a platform is added.
//
// THEY START EMPTY AND THAT IS CORRECT. Both files name real businesses and
// real people. A placeholder vendor sends somebody to a seller that does not
// exist; a guessed handle sends them to a stranger. So the pages render a
// proper empty state that says what the list is for and invites a suggestion,
// and they are kept OUT of the sitemap until they have entries, because an
// empty page is a thin page.
//
// NOT A RANKING, on either page. Both sort alphabetically on purpose. A local
// list that reads as a league table makes enemies of the people it leaves out,
// and the whole point is to be useful to the scene rather than to grade it.
//
// `vouched` on a vendor is the one editorial signal, and it means Tim has
// actually bought from them. It is not a star rating and there is no scale.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, APP_JS, footer } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendors = JSON.parse(await readFile(join(ROOT, "data/vendors.json"), "utf8"));
const creators = JSON.parse(await readFile(join(ROOT, "data/creators.json"), "utf8"));

// Handle in, link out. Stored without the @ and without a url so one platform
// change is one edit here, not an edit to every row.
const SOCIALS = [
  ["youtube", "YouTube", (h) => `https://www.youtube.com/@${h}`],
  ["instagram", "Instagram", (h) => `https://www.instagram.com/${h}/`],
  ["tiktok", "TikTok", (h) => `https://www.tiktok.com/@${h}`],
  ["twitch", "Twitch", (h) => `https://www.twitch.tv/${h}`],
  ["facebook", "Facebook", (h) => `https://www.facebook.com/${h}`],
  ["whatnot", "Whatnot", (h) => `https://www.whatnot.com/user/${h}`],
  ["ebay", "eBay", (h) => `https://www.ebay.com/usr/${h}`],
];

const links = (o) => {
  const out = SOCIALS.filter(([k]) => o[k]).map(
    ([k, label, url]) =>
      `<a class="loc-soc" href="${esc(url(o[k]))}" rel="noopener" target="_blank">${label}</a>`,
  );
  // A plain website sits last: it is the least likely to be how somebody in a
  // card community actually finds them.
  if (o.url) out.push(`<a class="loc-soc" href="${esc(o.url)}" rel="noopener" target="_blank">Website</a>`);
  return out.length ? `<p class="loc-socs">${out.join("")}</p>` : "";
};

const card = (o, kind) => `      <li class="loc">
        <div class="loc-h">
          <h3>${esc(o.name)}</h3>
          ${o.vouched ? `<span class="loc-vouch">Bought from them</span>` : ""}
        </div>
        ${o.area ? `<p class="loc-area">${esc(o.area)}</p>` : ""}
        ${o.does || o.sells ? `<p class="loc-does">${esc(o.does || o.sells)}</p>` : ""}
        ${o.blurb ? `<p class="loc-blurb">${esc(o.blurb)}</p>` : ""}
        ${o.shows ? `<p class="loc-shows">Usually at: ${esc(o.shows)}</p>` : ""}
        ${links(o)}
      </li>`;

function page({ slug, title, h1, kicker, lede, list, kind, empty, note }) {
  // Alphabetical, always. See the header note on why this is not a ranking.
  const rows = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: h1, item: `${SITE}/${slug}` },
      ],
    },
  ];
  // Only claim an ItemList when there is a list. Marking up an empty page as a
  // collection asserts something the page does not show.
  if (rows.length) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: h1,
      itemListElement: rows.map((o, i) => ({ "@type": "ListItem", position: i + 1, name: o.name })),
    });
  }
  const desc = rows.length
    ? `${rows.length} ${kind} around Rochester, New York and the wider region, with links to follow them.`
    : lede;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${slug}">
${rows.length ? "" : '<meta name="robots" content="noindex,follow">\n'}<meta property="og:title" content="${esc(h1)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/${slug}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
${STYLES}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">${esc(kicker)}</span>
    <h1>${h1.replace(/\b(vendors|creators)\b/, '<span class="hl">$1</span>')}</h1>
    <p class="lede" style="max-width:38em">${esc(lede)}</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / ${esc(h1)}</p>
    ${
      rows.length
        ? `<ul class="loc-list">
${rows.map((o) => card(o, kind)).join("\n")}
    </ul>
    <p class="price-note">${esc(note)} Last updated ${esc(longDate(list.updated) || "recently")}. No paid placements and no
      affiliate links on this page: everybody here is listed because we rate them.</p>`
        : `<div class="fk-golden">
      <p class="fk-golden-h">Nothing here yet</p>
      <h2>This list is being <span class="hl">built</span></h2>
      <p>${esc(empty)}</p>
      <p style="margin-top:12px"><a class="btn btn-yt btn-sm" href="https://www.youtube.com/@GarbageRips585">Tell us on the channel</a></p>
    </div>
    <p class="price-note">We would rather show an empty page than a made up one. Everybody listed here will be a real
      person or a real business we can point you at, so the list starts empty and grows.</p>`
    }
  </div>
</section>

</main>
${footer("Local listings. No paid placements.")}
${APP_JS}
</body>
</html>
`;
}

const V = page({
  slug: "vendors.html",
  title: "Pokemon Card Vendors in Rochester, NY | Garbage Rips 585",
  h1: "Local vendors",
  kicker: "585 &bull; People we buy from",
  lede:
    "Sellers around Rochester worth knowing: the ones at the shows, the ones with a table every month, " +
    "the ones we have actually handed money to.",
  list: vendors.vendors || [],
  kind: "vendors",
  empty:
    "We are putting together a list of vendors around Rochester who are worth buying from: who they are, what they " +
    "carry, and which shows you will find them at. If you sell locally, or you have bought from somebody good, tell us.",
  note: "Vendors are people who sell, usually at the shows on the card show calendar. For shops with a door and opening hours, see Card shops.",
});

const C = page({
  slug: "creators.html",
  title: "Pokemon Creators in Rochester, Buffalo and Syracuse | Garbage Rips 585",
  h1: "Local creators",
  kicker: "Upstate NY &bull; Support your scene",
  lede:
    "Other people making Pokemon content in Rochester, Buffalo, Syracuse and nearby. Rippers, collectors, " +
    "artists and players. Go and watch them.",
  list: creators.creators || [],
  kind: "creators",
  empty:
    "We want to point people at everybody else making Pokemon content in Rochester, Buffalo, Syracuse and the towns " +
    "around them. If that is you, or somebody you watch, let us know and you go on the list.",
  note: "Listed alphabetically, not ranked. Rochester first by focus, but anywhere in Upstate New York close enough to count belongs here.",
});

await writeFile(join(ROOT, "public/vendors.html"), V);
await writeFile(join(ROOT, "public/creators.html"), C);
const nv = (vendors.vendors || []).length;
const nc = (creators.creators || []).length;
console.log(`Wrote public/vendors.html (${nv} vendor${nv === 1 ? "" : "s"}) and public/creators.html (${nc} creator${nc === 1 ? "" : "s"})`);
if (!nv || !nc) {
  console.log("  Empty lists render an honest empty state and stay noindex and out of the sitemap.");
  console.log("  Fill data/vendors.json and data/creators.json to publish them.");
}
