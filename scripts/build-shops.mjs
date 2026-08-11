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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://garbagerips585.com";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

const { shops } = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8"));

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
          <h3>${esc(s.name)}</h3>
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
        <a class="shop-link" href="${esc(url)}" rel="noopener" target="_blank">
          ${esc(host)} <span aria-hidden="true">&rarr;</span>
        </a>
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
.shop-list{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:980px){.shop-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.shop-list{grid-template-columns:1fr}}
.shop{display:flex;flex-direction:column;gap:var(--s2);background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.shop-head{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.shop h3{font:400 var(--t-m)/1.15 var(--display)}
.shop-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--mustard);color:var(--ink);border:1px solid var(--gold-deep);
  padding:4px 7px;border-radius:var(--r-pill)}
.shop-area{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase}
.shop-blurb{color:var(--ink-2);font-size:var(--t-sm)}
.shop-tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s1)}
.shop-tags li{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.03em;
  background:var(--lilac-pale);color:var(--plum);padding:5px 9px;border-radius:var(--r-pill)}
.shop-link{margin-top:auto;padding-top:var(--s3);font:700 var(--t-sm)/1 var(--body);
  color:var(--ketchup-deep);min-height:44px;display:inline-flex;align-items:center}
.shop-link:hover{text-decoration:underline}
.shops-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
`;

const body = `
<section class="shops">
  <div class="wrap">
    <div class="brk"><h2>Card shops in <span class="hl">the 585</span></h2><span class="ln"></span></div>
    <p class="shops-lede">Where I actually buy. Real shops around Rochester, New York, run by people
      who know the hobby. Buy local when you can: the shop is why the local scene exists.</p>
    <ul class="shop-list">
${cards}
    </ul>
    <p class="shops-note">NOT SPONSORED AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO.
      IF YOU RUN A CARD SHOP AROUND ROCHESTER AND YOU ARE NOT ON HERE, SAY HELLO ON ANY OF THE SOCIALS.</p>
  </div>
</section>`;

// Share the home page's shell so this page cannot drift from the design.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf('<div class="rail">'));
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>Pokemon Card Shops in Rochester, NY | Garbage Rips 585</title>`
  )
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="Local Pokemon card shops around Rochester, New York, from the channel that rips packs from them. ${esc(
      shops.map((s) => s.name).join(", ")
    )}.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/shops.html">`)
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
${sprite}

${bar}
${body}
${footer}

<script src="assets/app.js"></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/shops.html"), html);

const cleaned = shops.filter((s) => cleanUrl(s.url) !== s.url);
console.log(`Wrote public/shops.html  (${shops.length} shop${shops.length === 1 ? "" : "s"})`);
for (const s of cleaned) {
  console.log(`  cleaned tracking parameters off ${s.name}:\n    ${cleanUrl(s.url)}`);
}
