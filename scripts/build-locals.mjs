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
//
// THESE TWO PAGES CARRY NO PICTURES AND THAT HAS NOW BEEN DECIDED TWICE, so
// here is the reasoning rather than a third agent working it out from scratch.
// Both sit at 0.0 in check-build.py's image-density table and both are below
// its 250 word floor, so nothing flags them; the question is whether they
// should have one anyway, and the answer is no on three counts.
//
//   - THE OBVIOUS IMAGE IS SOMEBODY ELSE'S FACE. Every row is a real local
//     person or a real small business. The site holds no mark for any of them,
//     and pulling an avatar or a logo off their profile is a different kind of
//     decision from mirroring a public-domain wordmark or an App Store
//     screenshot the publisher uploaded. Nobody here has been asked.
//   - A MAP WAS CONSIDERED AND IT HAS NO SHAPE. /shops.html earns a drawn map
//     because its rows carry addresses that are spread across the region.
//     These rows carry an `area`, and today every entry on both pages reads
//     "Rochester". A map of four pins in one place, one of which (Toak Pulls)
//     is the same entity appearing on both pages, teaches a reader nothing the
//     word Rochester has not already told them.
//   - PLATFORM LOGOS WOULD BE DECORATION. The link row already says YouTube,
//     Instagram, TikTok in words, which are shorter to read than an icon is to
//     recognise, and swapping them for marks would add requests and remove the
//     labels.
//
// WHAT WOULD CHANGE THIS: a vendor sending us their own artwork to use, which
// the "know one we missed" invitation could ask for; or enough entries spread
// widely enough that a regional map becomes a real picture. Neither is true
// yet, and an empty-ish page with no picture is better than a padded one.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
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

/* FOUR OF THE SEVEN GET A GLYPH, AND THE OTHER THREE MUST NOT.
   These two pages carried zero pictures in <main>: 118 words on /creators.html
   and 177 on /vendors.html, entirely text. The site already draws YouTube,
   Instagram, TikTok and Facebook marks, as a sprite that is on every page for
   the footer, so putting them on the matching pills costs no bytes at all for
   the artwork.
   Twitch, Whatnot and eBay stay as words, and so do Website and All their
   links. We do not hold those marks, and CLAUDE.md's rule on exactly this,
   written when Collectr was linked without one, is that inventing a logo to sit
   beside four real ones is worse than a named text link. A pill that says a
   platform's name is not a broken version of a pill with its logo. */
const GLYPH = { youtube: "yt", instagram: "ig", tiktok: "tt", facebook: "fb" };
const glyphFor = (k) =>
  GLYPH[k] ? `<svg class="loc-i" aria-hidden="true"><use href="#i-${GLYPH[k]}"/></svg>` : OUT;

/* AN ARROW LEAVING A BOX IS NOT A LOGO, which is why this one may be drawn and
   a Whatnot or an eBay mark may not. It means "this goes off the site", it is
   the same thing the outbound rule already makes every one of these links
   announce in its aria-label, and it is ours to draw.
   Inline rather than added to the sprite in shared/chrome.mjs, because the
   sprite ships on all 1,483 pages and this is wanted on two. Three pills on
   /vendors.html and none on /creators.html carry it today; /vendors.html would
   otherwise still have had no picture anywhere in main, which is where this
   whole pass started. aria-hidden, because the pill's own text and its
   aria-label already say where it goes. */
const OUT =
  `<svg class="loc-i" viewBox="0 0 24 24" aria-hidden="true">` +
  `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" ` +
  `fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// The first address this page shows for somebody, in the same order the row
// renders them: socials first, then a website, then a link-in-bio hub. It is
// the ListItem target in the schema below, so what a crawler is told about a
// creator is the exact link a reader would click, never a second guess.
const primaryUrl = (o) => {
  const social = SOCIALS.find(([k]) => o[k]);
  return social ? social[2](o[social[0]]) : o.url || o.links || null;
};

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build. Same helper as build-shows.mjs.
const hostOf = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// EVERY LINK THIS FUNCTION EMITS IS OUTBOUND AND NONE OF THEM CARRIED THE
// aria-label CLAUDE.md MAKES THE CONDITION OF ONE. These are the only links in
// the body of /vendors.html and /creators.html, so both pages were at 0 of their
// outbound links labelled while the site was at 783 of 877.
//
// The visible text is the reason it matters here more than the count suggests.
// It is a fixed vocabulary -- "YouTube", "Instagram", "TikTok", "Website", "All
// their links" -- repeated once per person, so on a page of five links the
// accessible names were "YouTube", "Instagram", "YouTube", "Instagram",
// "TikTok", and NONE of them said whose. The person's name is in the h2 above
// and was in no link name. Naming them inside the label fixes the ambiguity and
// the missing outbound warning together, exactly as build-shows.mjs does on a
// show row.
const links = (o) => {
  const named = (what, url) =>
    `${esc(o.name ? `${what} for ${o.name}` : what)}, opens on ${esc(hostOf(url))}`;
  const out = SOCIALS.filter(([k]) => o[k]).map(
    ([k, label, url]) =>
      `<a class="loc-soc" href="${esc(url(o[k]))}" rel="noopener" target="_blank" aria-label="${named(label, url(o[k]))}">${glyphFor(k)}${label}</a>`,
  );
  // A plain website sits last: it is the least likely to be how somebody in a
  // card community actually finds them.
  if (o.url) out.push(`<a class="loc-soc" href="${esc(o.url)}" rel="noopener" target="_blank" aria-label="${named("Website", o.url)}">${OUT}Website</a>`);
  // A link-in-bio page (solo.to, linktr.ee) is often the ONLY address a vendor
  // publishes: no site of their own, and their socials change. Labelled as what
  // it is rather than as a website, because it is a hub and not a shop.
  if (o.links) out.push(`<a class="loc-soc" href="${esc(o.links)}" rel="noopener" target="_blank" aria-label="${named("All their links", o.links)}">${OUT}All their links</a>`);
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
/* A ROW WITH NO BLURB IS THE STATE THAT SHIPPED AND NOTHING ON THE PAGE SAID SO.
   Elliot Does Pokemon carries a name, an area and the two words "Pokemon
   content", and `.loc-socs` is `margin-top:auto`, so at 1440 the card stretched
   to its neighbour's height and left a hollow band where a description would go.
   A reader cannot tell that from a card that failed to render.

   This is /retailers.html's Staples row, one page along: that page prints, in
   its own words, "This is the reason Staples is a row here and not a page of its
   own", rather than leaving a thin entry to be read as a broken one. Say what is
   missing and whose fault it is. The links are still the point of the row and
   they are still checked, so the sentence has to make clear that the GAP IS
   OURS: nothing here is a judgement about the person on the card. */
const NO_WRITE_UP =
  `<p class="loc-nowrite">We have not written this one up yet. The links are theirs and they work; ` +
  `the description is the part we owe them.</p>`;

const card = (o, kind) => `      <li class="loc">
        <div class="loc-h">
          <h2>${esc(o.name)}</h2>
          ${o.vouched ? `<span class="loc-vouch">Bought from them</span>` : ""}
        </div>
        ${o.area ? `<p class="loc-area">${esc(o.area)}</p>` : ""}
        ${o.does || o.sells ? `<p class="loc-does">${esc(o.does || o.sells)}</p>` : ""}
        ${o.blurb ? `<p class="loc-blurb">${esc(o.blurb)}</p>` : NO_WRITE_UP}
        ${o.shows ? `<p class="loc-shows">Usually at: ${esc(o.shows)}</p>` : ""}
        ${links(o)}
      </li>`;

/* THE ZERO-ROW EMPTY STATE WAS BUILT AND THE ONE-THIN-ROW STATE WAS NOT, AND
   ONE-THIN-ROW IS WHAT SHIPPED. A page with nothing on it says "Nothing here
   yet / This list is being built" and reads as a deliberate, honest state. A
   page with two cards, one of which is a name and two words, says nothing at
   all: it looks like a finished list of two, or like a page where something
   failed to load. /creators.html had 118 words in <main>, the thinnest
   non-utility page on the site, and not one of them admitted it.

   THE MODEL IS /retailers.html AND IT IS NAMED HERE ON PURPOSE. That page has a
   row it cannot make a page out of, and instead of hiding the fact it prints
   "This is the reason Staples is a row here and not a page of its own." A
   reader who is told why a thing is short trusts the short thing. A reader who
   is not told assumes the site is broken.

   EVERY NUMBER IN IT IS COUNTED, NEVER WRITTEN. "Two creators" and "one of them"
   come off the array, so this paragraph cannot go stale the way a hand-typed
   count does, and the band switches itself off the moment the list clears the
   bar.

   THE BAR IS FOUR ENTRIES AND NO GAPS, and it is written as a test rather than
   as a promise in a comment, which is the shape earnsPage() takes in
   build-retailers.mjs. Four is an editorial floor and not a layout fact: below
   it, a "local scene" list is a handful of people somebody happened to know
   rather than a survey, and saying so is cheaper than pretending otherwise. A
   row with no `blurb` counts as a gap however many rows there are. NOTHING HERE
   INVENTS AN ENTRY TO CLEAR THE BAR: the whole file exists to refuse that. */
const earlyNote = (rows, noun) => {
  const thin = rows.filter((o) => !o.blurb).length;
  if (rows.length >= 4 && !thin) return "";
  const n = rows.length;
  const nWord = ["no", "one", "two", "three"][n] || String(n);
  const isAre = n === 1 ? "is" : "are";
  const nounWord = n === 1 ? noun.replace(/s$/, "") : noun;
  const gap = thin
    ? ` ${thin === n ? (n === 1 ? "It has" : "None of them has") : `${["", "One", "Two", "Three"][thin] || thin} of them ${thin === 1 ? "has" : "have"}`} no write-up yet, which is our gap and not theirs.`
    : "";
  return `    <div class="fk-golden">
      <p class="fk-golden-h">Early days</p>
      <h2>This list is still <span class="hl">short</span></h2>
      <p>${esc(nWord.replace(/^./, (c) => c.toUpperCase()))} ${esc(nounWord)} ${esc(isAre)} on this page.${esc(gap)}
        That is what we can actually point you at today rather than what we would like the page to look like, and
        it stays that way until somebody real goes on it.</p>
      <p style="margin-top:12px"><a class="btn btn-yt btn-sm" href="https://www.youtube.com/@GarbageRips585">Tell us who we are missing</a></p>
    </div>`;
};

/* TWO GUARDS, BECAUSE THIS PAGE'S COPY HAS NOW DRIFTED AHEAD OF ITS DATA THREE
   SEPARATE TIMES and every one of them was caught by a person reading the page
   rather than by the build. The lede named four kinds of creator against one;
   it named three cities against one; and /vendors.html's lede claimed a vouch
   the rows do not carry. All three are the same shape: a sentence about what
   the list is FOR, standing where a sentence about what it HOLDS belongs.

   These are the smallest checks that would have caught the last two, and they
   are deliberately narrow. They read the copy this file writes and compare it
   to the rows this file was handed, and they THROW, because the alternative is
   a comment saying "keep these in step", which is what was there. They do not
   police prose in general and must not grow into that: `empty` and `note` are
   exempt on purpose, since both are plainly asks rather than descriptions
   ("anywhere in Upstate New York close enough to count belongs here"). */
const CITY_WORDS = ["Rochester", "Buffalo", "Syracuse"];

const checkCities = (text, rows, where) => {
  const areas = rows.map((o) => String(o.area || "")).join(" | ");
  for (const city of CITY_WORDS) {
    if (!text.includes(city)) continue;
    if (areas.includes(city)) continue;
    throw new Error(
      `build-locals: ${where} names ${city} and no entry's "area" does.\n` +
        `  Areas on the page: ${areas || "(none)"}\n` +
        `  A lede describes the list in front of the reader. Name the cities the rows are in,\n` +
        `  or add somebody from ${city}. Do NOT widen the sentence to cover a city the page\n` +
        `  does not: that is what "Rochester, Buffalo, Syracuse and nearby" was doing over two\n` +
        `  Rochester entries. The invitation to the wider region belongs in "empty" and "note".`
    );
  }
};

const VOUCH_CLAIMS = /\b(we (actually )?buy from|handed money to|bought from|we have bought)\b/i;

const checkVouch = (text, rows, where) => {
  if (!VOUCH_CLAIMS.test(text)) return;
  if (rows.some((o) => o.vouched)) return;
  throw new Error(
    `build-locals: ${where} says this site buys from the people on it, and no entry is marked "vouched".\n` +
      `  "vouched" is the one editorial signal these pages have and it means Tim actually bought\n` +
      `  from them. A page that claims it in prose and renders it on no card is claiming it twice\n` +
      `  as loudly as the chip would and backing it with nothing. Set "vouched" where it is true,\n` +
      `  or say something the page can show.`
  );
};

function page({ metaDesc, slug, title, h1, kicker, lede, list, kind, empty, note, updated }) {
  // Alphabetical, always. See the header note on why this is not a ranking.
  const rows = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));

  // Only when there IS a list. An empty page's lede is its whole pitch and the
  // rows it is measured against do not exist yet.
  if (rows.length) {
    checkCities(lede, rows, `the lede on /${slug}`);
    checkCities(metaDesc || "", rows, `the meta description on /${slug}`);
    checkVouch(lede, rows, `the lede on /${slug}`);
    checkVouch(kicker, rows, `the kicker on /${slug}`);
    checkVouch(metaDesc || "", rows, `the meta description on /${slug}`);
  }
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
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
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
    </ul>${/* "because we rate them" IS BRITISH AND IT MEANS THE OPPOSITE HERE. In
         American English "we rate them" reads as "we rank them", and the same
         paragraph on /creators.html opens "Listed alphabetically, not ranked",
         so the sentence contradicted itself eleven words later. The claim being
         made is that nobody paid to be on the list, so say that. */ ""}
${earlyNote(rows, kind)}
    <p class="price-note">${esc(note)} Last updated ${esc(longDate(updated) || "recently")}. No paid placements and no
      affiliate links on this page: everybody here is listed because they are worth your time.</p>`
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
    "Pokemon card sellers around Rochester NY worth knowing, what each one carries, and a link to " +
    "find them. No paid placements.",
  slug: "vendors.html",
  title: "Pokemon Card Vendors in Rochester, NY | Garbage Rips 585",
  h1: "Local vendors",
  // A literal bullet, not &bull;. The kicker goes through esc() like every
  // other value here, so an HTML entity written in the source comes out as the
  // visible text "&BULL;" on the page.
  /* WAS "585 • People we buy from", which is the vouch claim a third time, in
     the largest chip on the page, over two rows that carry no "vouched". The
     kicker goes through checkVouch() with the lede and the meta description
     now, so it cannot come back without the flag coming back with it. */
  kicker: "585 • Sellers worth knowing",
  /* THREE CLAUSES AGAINST TWO VENDORS, AND ONE OF THE THREE WAS NOT TRUE. It
     read "the ones at the shows, the ones with a table every month, the ones we
     have actually handed money to", which promises a survey; the page holds two
     entries. The third clause is the worse half: "handed money to" IS the
     `vouched` flag, the one editorial signal this file has, and NEITHER row
     carries it, so the lede was announcing a chip the page never renders.
     checkVouch() below now stops the build on that sentence rather than leaving
     it to be re-read by eye. The metaDesc lost the same claim in the same edit,
     and it was the more expensive of the two because it is the copy Google
     prints. */
  lede: "Sellers around Rochester worth knowing: who they are, what they carry, and where to find them.",
  list: vendors.vendors || [],
  updated: vendors.updated,
  kind: "vendors",
  empty:
    "We are putting together a list of vendors around Rochester who are worth buying from: who they are, what they " +
    "carry, and which shows you will find them at. If you sell locally, or you have bought from somebody good, tell us.",
  note: "Vendors are people who sell, usually at the shows on the card show calendar. For shops with a door and opening hours, see Card shops.",
});

const C = page({
  // THE DESCRIPTION AND THE LEDE BOTH NAMED FOUR KINDS OF CREATOR AND THE PAGE
  // HAS ONE. data/creators.json holds two entries, both Rochester, both channels;
  // there is no artist and no competitive player on it, and the description is
  // the copy Google prints. The title keeps the three cities because that is the
  // search this page is for and the list is meant to grow into it, but neither
  // line promises a roster the page cannot show. Add the roles back the day the
  // file has them.
  metaDesc:
    "Pokemon creators worth following in Rochester and around Upstate New York, " +
    "with a link to each. No paid placements.",
  slug: "creators.html",
  title: "Pokemon Creators in Rochester, Buffalo and Syracuse",
  h1: "Local creators",
  kicker: "Upstate NY • Support your scene",
  /* THE LEDE NAMED THREE CITIES AND THE PAGE COVERS ONE. It read "Other people
     making Pokemon content in Rochester, Buffalo, Syracuse and nearby", against
     two entries whose `area` is "Rochester" both times. That is the same fault
     the comment above this one describes and fixed for the ROLES, one line
     later, in the same paragraph: a true statement about what the page is FOR,
     written as a statement about what it HOLDS. The city list is now what the
     rows actually say, and checkCities() below stops the build if that stops
     being true. The invitation to the rest of Upstate New York survives, in the
     `empty` copy and in the note under the list, where it is plainly an ask.
     THE TITLE KEEPS THE THREE CITIES and that was already argued above: a title
     is the search this page is for. A lede is a description of the page in front
     of the reader, which is why the two are allowed to differ. */
  lede: "Other people around Rochester making Pokemon content. Go watch them.",
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
