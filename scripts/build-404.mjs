#!/usr/bin/env node
// Build public/404.html.
//
//   node scripts/build-404.mjs
//
// GitHub Pages serves this for any URL it cannot find, at ANY depth. The
// browser's address bar keeps the URL that missed, so /rip/something-wrong
// renders this file while the document base is /rip/. Every asset path here is
// therefore absolute. A relative "assets/app.js" resolves to /rip/assets/app.js
// and 404s inside the 404, on exactly the URLs most likely to be mistyped.
//
// It is also noindex with no canonical: a canonical would tell search engines
// this page is the real version of whatever URL was missed.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer, APP_JS } from "../shared/chrome.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const style = `
/* The pack is torn open and there is nothing in it, which is the one joke this
   page is uniquely placed to make on a channel about opening packs. */
.e404{min-height:64vh;display:grid;place-items:center;text-align:center;padding:var(--s7) 0 var(--s8)}
.e404-in{max-width:36em}
/* The pack art comes from the site's own .pack component rather than a bare
   <img>. Two reasons: pack--multi paints the wrapper over a navy fill with
   background-size:cover, so the photo's baked-in light backdrop is cropped away
   instead of showing as a gray rectangle; and rendering only the .pack-l half
   reuses the jagged tear edge every rip page already uses, so the torn pack
   here is literally the same tear, not a second hand-drawn approximation. */
.e404-art{--pw:clamp(148px,40vw,186px);
  display:flex;align-items:flex-end;justify-content:center;
  margin:0 auto var(--s5);width:max-content;max-width:100%}
/* .pack-l clips the art at about 53% of the box, so the right 47% of .e404-pack
   is empty space. Without pulling it back the mascot stands 47px clear of a
   pack it is supposed to be leaning on, and the two read as separate stickers.
   Tied to --pw so it holds at every size in the clamp. */
.e404-pack{width:var(--pw);aspect-ratio:2/3;margin-right:calc(var(--pw) * -.38);
  position:relative;transform:rotate(-5deg);
  filter:drop-shadow(0 12px 20px rgba(21,38,58,.28))}
/* He is looking at the empty pack, which is the whole gag, so he sits beside it
   rather than above the heading. Overlapped slightly and pulled down so the two
   read as one piece of art instead of two stickers side by side. */
.e404-mascot{width:clamp(104px,29vw,136px);height:auto;margin-bottom:-2%;
  transform:rotate(4deg);position:relative;z-index:2;
  filter:drop-shadow(0 8px 14px rgba(17,17,17,.26))}
@media(max-width:360px){.e404-mascot{display:none}}
.e404-pack .pack{cursor:default}
.e404 h1{font:400 clamp(2.2rem,9vw,3.6rem)/1 var(--display);margin-bottom:var(--s3)}
.e404 p{color:var(--ink-2);font-size:var(--t-lede);margin-bottom:var(--s5)}
/* Was --plum on --lilac-pale over an rgba(78,47,72) hairline: a purple chip on
   a site whose palette is black, white and gold, and after the repaint a grey
   one at 1.08:1 against the page. Ink on --paper-3 with the standard hairline
   is the palette's chip, and it is the same one .xp-tag and .bmk use. */
.e404-code{display:inline-block;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.14em;
  color:var(--ink);background:var(--paper-3);border:1px solid var(--hair);
  padding:7px var(--s3);border-radius:var(--r-pill);margin-bottom:var(--s4)}
.e404-links{display:flex;gap:var(--s3);flex-wrap:wrap;justify-content:center}
.e404-links a{display:inline-flex;align-items:center;min-height:48px;padding:0 var(--s5);
  border:2px solid var(--ink);border-radius:var(--r-pill);background:var(--card);
  font:700 var(--t-body)/1 var(--body);box-shadow:var(--lift)}
.e404-links a:first-child{background:var(--mustard)}
.e404-links a:hover{transform:translateY(-2px)}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Garbage Rip: page not found | Garbage Rips 585</title>
<meta name="description" content="That page is not here. Every rip, every set guide and the card hall of fame are.">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${style}</style>
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}

<main id="main" class="e404">
  <div class="wrap">
    <div class="e404-in">
      <div class="e404-art">
        <div class="e404-pack">
          <span class="pack pack--multi" aria-hidden="true">
            <span class="pack-face pack-l"><span class="pack-art"></span></span>
          </span>
        </div>
        <img class="e404-mascot" src="/assets/trubbish.webp" alt=""
             width="512" height="512" decoding="async">
      </div>
      <span class="e404-code">Error 404</span>
      <h1>Garbage rip.</h1>
      <p>You opened this one and there was nothing in it. The page you were after
        has been moved, renamed, or never existed.</p>
      <div class="e404-links">
        <a href="/">Back to the rips</a>
        <a href="/videos.html">Search every rip</a>
        <a href="/sets/">Card Pokedex</a>
      </div>
    </div>
  </div>
</main>

${footer()}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/404.html"), html);

// Guard the one mistake this page invites. Anything that is not absolute,
// a full URL, a fragment or a data: URI will break at depth.
const bad = [...html.matchAll(/(?:src|href)="(?!\/|https?:|#|data:|mailto:)([^"]*)"/g)].map((m) => m[1]);
console.log(`Wrote public/404.html`);
if (bad.length) {
  console.error(`\n${bad.length} relative path(s), which break when served at /rip/ depth:`);
  for (const b of bad) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`  every asset path is absolute, so it renders from any depth`);
