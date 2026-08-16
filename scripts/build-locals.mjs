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
import { BAR, MENU, SPRITE, SKIP, STYLES, APP_JS, footer, FONTS } from "../shared/chrome.mjs";
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

// The first address this page shows for somebody, in the same order the row
// renders them: socials first, then a website, then a link-in-bio hub. It is
// the ListItem target in the schema below, so what a crawler is told about a
// creator is the exact link a reader would click, never a second guess.
const primaryUrl = (o) => {
  const social = SOCIALS.find(([k]) => o[k]);
  return social ? social[2](o[social[0]]) : o.url || o.links || null;
};

const links = (o) => {
  const out = SOCIALS.filter(([k]) => o[k]).map(
    ([k, label, url]) =>
      `<a class="loc-soc" href="${esc(url(o[k]))}" rel="noopener" target="_blank">${label}</a>`,
  );
  // A plain website sits last: it is the least likely to be how somebody in a
  // card community actually finds them.
  if (o.url) out.push(`<a class="loc-soc" href="${esc(o.url)}" rel="noopener" target="_blank">Website</a>`);
  // A link-in-bio page (solo.to, linktr.ee) is often the ONLY address a vendor
  // publishes: no site of their own, and their socials change. Labelled as what
  // it is rather than as a website, because it is a hub and not a shop.
  if (o.links) out.push(`<a class="loc-soc" href="${esc(o.links)}" rel="noopener" target="_blank">All their links</a>`);
  return out.length ? `<p class="loc-socs">${out.join("")}</p>` : "";
};

// h2, NOT h3. These names are the only headings on the page under the h1, so an
// h3 here skipped a level: a screen reader user walking the heading list heard
// the page jump from level 1 to level 3 and had to guess whether a section
// heading had gone missing. There is no h2 for these to sit under and there
// should not be one, because the list is the page. The empty state below
// already uses an h2 for the same slot, so the two states now agree as well.
// Visually identical: `.loc h2` in assets-source/ui.css carries the same font
// shorthand `.loc h3` did, so the size does not come from the UA default.
const card = (o, kind) => `      <li class="loc">
        <div class="loc-h">
          <h2>${esc(o.name)}</h2>
          ${o.vouched ? `<span class="loc-vouch">Bought from them</span>` : ""}
        </div>
        ${o.area ? `<p class="loc-area">${esc(o.area)}</p>` : ""}
        ${o.does || o.sells ? `<p class="loc-does">${esc(o.does || o.sells)}</p>` : ""}
        ${o.blurb ? `<p class="loc-blurb">${esc(o.blurb)}</p>` : ""}
        ${o.shows ? `<p class="loc-shows">Usually at: ${esc(o.shows)}</p>` : ""}
        ${links(o)}
      </li>`;

function page({ metaDesc, slug, title, h1, kicker, lede, list, kind, empty, note, updated }) {
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
  //
  // And every entry has to carry a `url`. This block used to emit a `name` and
  // a `position` and stop, which describes a thing with no address: Google
  // drops an ItemList whose items cannot be resolved, so it was doing nothing
  // at all. These people are not pages on this site, they are real accounts
  // elsewhere, so the target is their own address, exactly as build-shops.mjs
  // already does for the card shops.
  //
  // All or nothing. A list where some entries resolve and some do not is not a
  // partial win, it is a list a crawler cannot use, and it would quietly
  // publish "we have no address for this person" as structured data. One row
  // with no link anywhere means no ItemList, and the page still reads fine.
  const targets = rows.map(primaryUrl);
  if (rows.length && targets.every(Boolean)) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: h1,
      itemListElement: rows.map((o, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: o.name,
        url: targets[i],
      })),
    });
  }
  // ONE MAIL MERGE FOR TWO INDEXED PAGES IS DUPLICATE CONTENT. vendors.html and
  // creators.html were both getting "N <kind> around Rochester, New York and the
  // wider region, with links to follow them", differing only in a noun and a
  // number, which is the description Google sees on both. Each page names its
  // own now, and the mail merge is only the fallback.
  const desc = metaDesc || (rows.length
    ? `${rows.length} ${kind} around Rochester, New York and the wider region, with links to follow them.`
    : lede);

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
<meta name="theme-color" content="#111111">
${FONTS}
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
    <p class="price-note">${esc(note)} Last updated ${esc(longDate(updated) || "recently")}. No paid placements and no
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
  metaDesc:
    "Card shops, breakers and sellers around Rochester NY that we actually buy from, with what each one is " +
    "good for and a link to find them.",
  slug: "vendors.html",
  title: "Pokemon Card Vendors in Rochester, NY | Garbage Rips 585",
  h1: "Local vendors",
  // A literal bullet, not &bull;. The kicker goes through esc() like every
  // other value here, so an HTML entity written in the source comes out as the
  // visible text "&BULL;" on the page.
  kicker: "585 • People we buy from",
  lede:
    "Sellers around Rochester worth knowing: the ones at the shows, the ones with a table every month, " +
    "the ones we have actually handed money to.",
  list: vendors.vendors || [],
  updated: vendors.updated,
  kind: "vendors",
  empty:
    "We are putting together a list of vendors around Rochester who are worth buying from: who they are, what they " +
    "carry, and which shows you will find them at. If you sell locally, or you have bought from somebody good, tell us.",
  note: "Vendors are people who sell, usually at the shows on the card show calendar. For shops with a door and opening hours, see Card shops.",
});

const C = page({
  metaDesc:
    "Pokemon YouTubers, rippers, collectors and artists in Rochester, Buffalo and Syracuse. Upstate New York " +
    "creators worth following, with a link to each.",
  slug: "creators.html",
  title: "Pokemon Creators in Rochester, Buffalo and Syracuse | Garbage Rips 585",
  h1: "Local creators",
  kicker: "Upstate NY • Support your scene",
  lede:
    "Other people making Pokemon content in Rochester, Buffalo, Syracuse and nearby. Rippers, collectors, " +
    "artists and players. Go and watch them.",
  list: creators.creators || [],
  updated: creators.updated,
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
