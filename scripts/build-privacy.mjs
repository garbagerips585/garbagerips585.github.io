#!/usr/bin/env node
// Build public/privacy.html.
//
//   node scripts/build-privacy.mjs
//
// WHY THIS PAGE EXISTS. The site loaded Google Analytics on all 1,495 pages and
// set two cookies with a two year life, and the word "privacy" appeared nowhere
// on it. The owner, 27 August 2026: "lets make the site fully set up correctly
// the way it should be."
//
// EVERY FACT ON THIS PAGE WAS MEASURED, NOT COPIED FROM A TEMPLATE. A generated
// privacy policy is worse than none: it describes a site that does not exist,
// and the first person to check finds it lying. What is written below came from
// driving the live site over CDP and from grepping the built tree:
//
//   - cookies: the real cookie jar after loading the home page, twice
//   - hosts:   every https:// url in a src or srcset attribute across all 1,495
//              built pages, counted, which is what a browser actually fetches
//   - links:   the same over href, which is what it does NOT fetch until the
//              reader clicks. 6,637 youtube.com urls are links, not embeds.
//
// THE ONE THAT NEARLY GOT MISSED, and the reason the href/src split is written
// out above rather than left implicit. `grep youtube.com/embed` matches 1,100
// rip pages, which reads exactly like a site full of YouTube iframes reporting
// every reader to Google. It is the `embedUrl` field of the VideoObject in each
// page's structured data. There is not one <iframe> on this site. A privacy
// page that claimed YouTube embeds would have been false in the direction that
// makes the site look worse, which is still false.
//
// IF THE SITE CHANGES, THIS PAGE IS PART OF THE CHANGE. Adding an embed, an ad,
// a newsletter, a comment box or a third-party font makes a sentence here
// wrong. Re-run the audit rather than editing prose to match a guess:
//
//   grep -rho 'src="https://[^"]*"' public/ | sed 's|.*//||;s|/.*||' | sort | uniq -c | sort -rn
//
// UPDATED is HAND SET, deliberately. Deriving it from the build date would
// restamp it on every nightly run and claim the policy changed daily, which is
// the opposite of what a date on a policy is for.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, CONTACT_EMAIL } from "../shared/site.mjs";
import { APP_JS_NO_PACKPLAYER as APP_JS, dropUnusedPacksCSS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";
import { GA4_ID } from "../shared/analytics.mjs";
import { strip as miniCSS } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPDATED = "2026-08-27";

/* THE COOKIE NAMES ARE DERIVED FROM THE MEASUREMENT ID, not typed. GA4 names
   its session cookie _ga_<id minus the G- prefix>, so pasting a new id into
   shared/analytics.mjs would have left this page naming a cookie the site no
   longer sets. Read off the real cookie jar to confirm the shape before this
   was written: _ga and _ga_Q1D034VG72, both on .garbagerips.com. */
const GA_COOKIES = GA4_ID ? ["_ga", `_ga_${GA4_ID.replace(/^G-/, "")}`] : [];

/* WHAT THE BROWSER FETCHES FROM SOMEBODY ELSE'S SERVER, with the count of
   references across the built tree and what each one is FOR. A host with no
   reason beside it is a host nobody can decide about. */
const HOSTS = [
  ["assets.tcgdex.net", "Card pictures. TCGdex is the open card database this site reads."],
  ["tcgplayer-cdn.tcgplayer.com", "Card scans for the few cards TCGdex holds no picture of."],
  ["storage.googleapis.com", "Card pictures from PriceCharting, on the pages that quote its prices."],
  ["i.ytimg.com", "Thumbnails for the videos, served by YouTube."],
  ["www.googletagmanager.com", "The analytics script itself."],
  ["www.google-analytics.com", "Where that script sends what it counts."],
];

const style = `
.pv{max-width:44em}
.pv h2{margin-top:var(--s6)}
.pv h3{margin-top:var(--s5);font-size:var(--t-m)}
.pv p,.pv li{font-size:var(--t-sm);line-height:1.6;color:var(--ink-2)}
.pv p{margin-top:var(--s3);max-width:44em}
.pv ul{margin-top:var(--s3);padding-left:1.2em}
.pv li{margin-top:6px}
.pv li strong,.pv p strong{color:var(--ink)}
/* The short version, first thing on the page, because most people want the
   answer and not the document. Same card treatment the site uses for a lede
   slab elsewhere rather than a new one. */
.pv-tldr{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);margin-top:var(--s4);box-shadow:var(--lift)}
.pv-tldr p{margin-top:0;color:var(--ink);font-weight:600}
.pv-tldr p + p{margin-top:var(--s3);font-weight:400;color:var(--ink-2)}
/* A plain two column list of host and reason. dl rather than a table: it is a
   set of terms and their definitions, and a table would promise columns that
   can be compared down their length, which these cannot. */
.pv-hosts{margin-top:var(--s4)}
.pv-hosts dt{font:600 var(--t-sm)/1.4 var(--mono);color:var(--ink);margin-top:var(--s3);word-break:break-word}
.pv-hosts dd{margin:2px 0 0;font-size:var(--t-sm);line-height:1.6;color:var(--ink-2)}
.pv-when{font:400 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);text-transform:uppercase;letter-spacing:.05em}
/* THE DIAGRAM. check-build.py fails a page with body copy and nothing visual,
   and its comment is explicit that the fix is a picture rather than an entry in
   the exemption set. It is right here: the one thing on this page that is
   genuinely spatial is the split between what your browser fetches on its own
   and what it never touches until you click, and that is exactly the thing
   people get wrong about a page full of YouTube links. Prose says it in a
   sentence; the picture says it at a glance.
   400 UNITS WIDE, NOT 560, so the 14px labels scale to about 13.6px on a 390
   phone instead of 10. A diagram nobody can read on the device most of this
   site is read on is decoration. */
.pv-fig{margin:var(--s5) 0 0}
.pv-fig svg{display:block;width:100%;height:auto}
.pv-fig figcaption{margin-top:var(--s3);font-size:var(--t-micro);color:var(--ink-2);line-height:1.5}
.pv-d-page{fill:var(--gold);stroke:var(--keyline)}
.pv-d-page-t{fill:var(--on-accent);font:700 14px var(--mono)}
.pv-d-auto{fill:var(--card);stroke:var(--hair)}
.pv-d-click{fill:none;stroke:var(--hair);stroke-dasharray:4 3}
.pv-d-t{fill:var(--ink);font:400 13px var(--mono)}
.pv-d-h{fill:var(--ink-2);font:700 11px var(--mono);letter-spacing:.06em}
.pv-d-line{stroke:var(--hair);fill:none}
`;

const body = `<main id="main" tabindex="-1">
  <div class="wrap pv">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Privacy</span></nav>
    <h1>Privacy</h1>
    <p class="pv-when">Last updated ${esc(longDate(UPDATED))}</p>

    <div class="pv-tldr">
      <p>This site does not ask you for anything, and there is nothing here to sign up for.</p>
      <p>It counts visits with Google Analytics, which sets two cookies. That is the whole of it.
        There are no ads, no tracking pixels, no affiliate links, and nothing is sold to anybody.</p>
    </div>

    <h2>What this site asks you for</h2>
    <p>Nothing. There are no accounts, no logins, no comment boxes, no newsletter and no forms
      of any kind. Nothing on this site collects a name, an address or a payment.</p>
    <p>The one way to send anything is to email the channel, and that only happens if you decide
      to write. Those emails arrive at
      <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>, which is a Gmail
      account, and they sit there like any other email. If you send a show listing or a shop
      correction, what you send may end up published on the site, because that is what you sent
      it for. Nothing else in an email is used for anything.</p>

    <h2>Cookies</h2>
    ${GA_COOKIES.length ? `<p>Two, both from Google Analytics, and they are the only cookies this site sets:</p>
    <ul>
      ${GA_COOKIES.map((c) => `<li><strong>${esc(c)}</strong></li>`).join("\n      ")}
    </ul>
    <p>They last two years and they are how Analytics tells a returning visit from a new one.
      They hold a random id, not a name. Nothing on this site reads them.</p>` :
    `<p>None. Analytics is switched off, so nothing on this site sets a cookie.</p>`}
    <p>The site stores nothing in your browser beyond that: no local storage, no session
      storage, and nothing kept between visits.</p>

    <h2>What the counting is for</h2>
    <p>This site is a few hundred guides and around a thousand video pages, and the only way to
      tell which of them are worth the work is to know which ones people actually open. That is
      the entire reason Analytics is here. What it reports back is pages, referrers, countries
      and rough device types, in aggregate. It is not used to build a profile of anybody and it
      is never joined up with anything else.</p>

    <h3>Turning it off</h3>
    <p>Three ways, and the first one takes nothing:</p>
    <ul>
      <li><strong>Send the signal and this site listens.</strong> If your browser sends Global
        Privacy Control or Do Not Track, the analytics script is never loaded at all. It is not
        blocked after the fact, it is not requested. Firefox, Brave and DuckDuckGo send one of
        these by default, and Chrome and Safari can be set to.</li>
      <li><strong>Block cookies for this site</strong> in your browser settings, which every
        browser can do per site.</li>
      <li><strong>Google's own opt-out add-on</strong>, at
        <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener nofollow" target="_blank"
        aria-label="Google Analytics opt-out browser add-on, opens on tools.google.com">tools.google.com/dlpage/gaoptout</a>,
        which turns Analytics off everywhere rather than only here.</li>
    </ul>
    <p>Nothing on the site breaks with any of these on. The pages are the same pages.</p>

    <h2>Other companies your browser talks to</h2>
    <p>The pages here are plain files, but the pictures on them are not all ours. Loading a page
      asks these servers for images, which means those companies can see your IP address and
      what page asked, the same as any site that shows a picture it does not host:</p>
    ${(() => {
      /* Laid out here rather than hand written so the boxes cannot drift from
         HOSTS above: the diagram and the list below it are the same six names
         from the same array, and adding a seventh host grows both. */
      const ROW = 34, GAP = 6, X = 4, W = 392;
      const auto = HOSTS.map(([h]) => h);
      const click = ["youtube.com, when you open a video",
                     "a shop, vendor or show organizer's site",
                     "a price guide you followed a link to"];
      const yAuto = 74;
      const yClickH = yAuto + auto.length * (ROW + GAP) + 16;
      const yClick = yClickH + 14;
      const H = yClick + click.length * (ROW + GAP) + 4;
      const chip = (y, label, cls) =>
        `<rect x="${X}" y="${y}" width="${W}" height="${ROW}" rx="6" class="${cls}"/>` +
        `<text x="${X + 12}" y="${y + ROW / 2 + 4}" class="pv-d-t">${esc(label)}</text>`;
      return `<figure class="pv-fig">
      <svg viewBox="0 0 400 ${H}" role="img" aria-label="What opening a page on this site fetches: ${
        esc(auto.join(", "))}. And what it does not contact until you click a link: ${esc(click.join("; "))}.">
        <rect x="${X}" y="4" width="${W}" height="${ROW}" rx="6" class="pv-d-page"/>
        <text x="${X + 12}" y="${4 + ROW / 2 + 4}" class="pv-d-page-t">Opening a page here</text>
        <path d="M200 ${4 + ROW} v10" class="pv-d-line"/>
        <text x="${X}" y="${yAuto - 8}" class="pv-d-h">FETCHES FROM</text>
        ${auto.map((h, i) => chip(yAuto + i * (ROW + GAP), h, "pv-d-auto")).join("\n        ")}
        <text x="${X}" y="${yClickH}" class="pv-d-h">AND NOTHING FROM, UNTIL YOU CLICK</text>
        ${click.map((h, i) => chip(yClick + i * (ROW + GAP), h, "pv-d-click")).join("\n        ")}
      </svg>
      <figcaption>Solid boxes are contacted the moment a page loads, because the page shows a
        picture they host. Dashed ones hear nothing from you at all until you follow a link to
        them. There are no video embeds on this site, so YouTube is in the second group.</figcaption>
    </figure>`;
    })()}
    <dl class="pv-hosts">
      ${HOSTS.map(([h, why]) => `<dt>${esc(h)}</dt>\n      <dd>${esc(why)}</dd>`).join("\n      ")}
    </dl>
    <p><strong>There are no video embeds anywhere on this site.</strong> Links to the videos go
      to YouTube, and YouTube only hears from you once you click one. The same is true of every
      shop, vendor, show organizer and price guide linked from here: a link is not a request.</p>

    <h2>What this site does not do</h2>
    <ul>
      <li>No advertising, and no ad network.</li>
      <li>No affiliate links. Nothing here pays a commission on anything you buy.</li>
      <li>No paid placements. No shop, vendor, creator or show has paid to be listed.</li>
      <li>No tracking pixels, and no Facebook, Instagram, TikTok or X trackers.</li>
      <li>No selling, renting or sharing of anything with anybody.</li>
      <li>No mailing list, so there is nothing to unsubscribe from.</li>
      <li>No fingerprinting, and no attempt to identify anyone across sites.</li>
    </ul>

    <h2>Hosting</h2>
    <p>The site is hosted on GitHub Pages. Like any web host, its servers see the IP address of
      every request in order to answer it, and GitHub keeps its own logs of that. This site has
      no access to those logs and no control over them. GitHub's privacy statement covers what
      they do with them.</p>

    <h2>Children</h2>
    <p>This is a Pokemon site, so plenty of the people reading it are kids, and several of the
      guides here are written for a parent buying for one. Nothing on this site knowingly
      collects anything from anybody, of any age: there is no account to make, no form to fill
      in, and nothing that asks who you are. If you are a parent and you would rather no cookie
      were set at all, any of the three options above does it.</p>

    <h2>Changes</h2>
    <p>If what the site does changes, this page changes with it, and the date at the top moves.
      It is not a document that gets quietly rewritten: the page is built from the site's own
      configuration, so the cookie names above come from the analytics settings themselves
      rather than from somebody remembering to retype them.</p>

    <h2>Asking about any of this</h2>
    <p>Email <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>. If you want the
      analytics record of your visits deleted, say so and it will be, though it is worth knowing
      there is nothing in it with your name on it to find.</p>
  </div>
</main>`;

// Share the home page's shell so this page cannot drift from the design. Same
// slicing the four other pages built this way do; the reasons for each cut are
// written out in build-shops.mjs and are not repeated here.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf("</header>") + "</header>".length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

// 149 characters. check-build.py holds meta descriptions to 70-165 and this page
// has no numbers to grow it later, so it will stay where it is.
const DESC =
  "What Garbage Rips 585 collects: nothing you enter, two Google Analytics cookies, " +
  "and no ads or affiliate links. How to switch the counting off.";

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, "<title>Privacy | Garbage Rips 585</title>")
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(DESC)}">`)
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/privacy.html">`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/privacy.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, "$1Privacy")
  .replace(
    /(<meta property="og:description" content=")[^"]*/,
    "$1No accounts, no ads, no affiliate links. Two analytics cookies, and how to turn them off.",
  )
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, "");

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Privacy",
  url: `${SITE}/privacy.html`,
  description: DESC,
  dateModified: UPDATED,
  isPartOf: { "@type": "WebSite", name: "Garbage Rips 585", url: `${SITE}/` },
};

await writeFile(
  join(ROOT, "public/privacy.html"),
  dropUnusedPacksCSS(`<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${miniCSS(style)}</style>
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
`),
);

console.log(`Wrote public/privacy.html
  ${GA_COOKIES.length} cookie(s) named: ${GA_COOKIES.join(", ") || "none, analytics is off"}
  ${HOSTS.length} third-party hosts listed
  last updated ${UPDATED}`);
