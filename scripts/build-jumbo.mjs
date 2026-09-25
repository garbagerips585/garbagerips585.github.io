#!/usr/bin/env node
/* /jumbo-cards.html -- what an oversize Pokemon card is, how you get one, and
 * what they are worth.
 *
 * THE OWNER ASKED FOR "as much info about Jumbo cards as possible", 21 September
 * 2026, after pulling his first one. The research behind it is in data/jumbo.json
 * with a source and a read date on every claim, and the catalogue is
 * data/jumbo-catalogue.json from scripts/sync-jumbo.mjs.
 *
 * THIS PAGE IS MOSTLY ABOUT WHAT NOBODY PUBLISHES, and that shaped every
 * section. The two questions a reader actually arrives with -- how big is one,
 * and how many are there -- have NO official answer. The Pokemon Company
 * publishes no dimensions for oversize cards anywhere, and nobody publishes a
 * total. A dozen SEO sites will give you confident numbers for both; they
 * disagree with each other and none shows a method. So this page prints the
 * measurements people actually took, names who took them, and says out loud
 * where they disagree -- which is more useful than a fake precise answer and is
 * the only version of this page worth having.
 *
 * THREE CALLS THE OWNER MADE, recorded because each one is arguable:
 *   1. BOX TOPPERS ARE IN. They are a different, much smaller format, and nine
 *      of the ten most valuable cards in the category are box toppers rather
 *      than jumbos. Every other site conflates them silently. Covering both and
 *      explaining the difference is the thing this page has that they do not.
 *   2. IMAGES ON THE VALUE LIST ONLY, not on all 345. TCGplayer stamps OVERSIZE
 *      CARD diagonally across its oversize scans -- roughly 96% of them -- and
 *      it is the only host with jumbo images at scale. A reader wants to see the
 *      $900 Charizard, not 345 defaced thumbnails, so the list carries pictures
 *      and the catalogue is text. The stamp is explained where it appears.
 *   3. BULBAPEDIA VERIFIES, IT DOES NOT SUPPLY. Its 395 entry list is the best
 *      catalogue that exists and it is CC BY-NC-SA 2.5, which is
 *      non-commercial. Facts checked against it and written in our own words are
 *      fine; republishing the list is not. So the catalogue backbone is tcgcsv
 *      and Bulbapedia is the cross-check.
 *
 * NO PRICE HERE WAS READ ONLY ONCE. shared/graded-gate.mjs's rule applied by
 * hand: a research pass read every figure off PriceCharting and a second pass
 * re-read all ten through shared/pricecharting.mjs's own parser on the same day.
 * All ten agreed to the cent. Three figures were deliberately NOT published and
 * `excluded` in the data says which and why.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
/* COMPOSED FROM chrome.mjs, NOT SLICED OUT OF index.html, and that was a bug
   before it was a choice. The first cut of this page lifted the header out of
   the home page the way build-garbage-plate.mjs does, and shipped TWO h1s: the
   home page's bar carries the wordmark as an h1 (BAR_HOME) and this page has
   its own. qa-sweep caught it at all three widths. BAR is the same bar without
   that h1 and is what every inner page is supposed to use. */
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
  dropUnusedPacksCSS,
} from "../shared/chrome.mjs";
import { esc, clipMeta } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(await readFile(join(ROOT, "data/jumbo.json"), "utf8"));
const cat = JSON.parse(await readFile(join(ROOT, "data/jumbo-catalogue.json"), "utf8"));

const money = (n) => (n == null ? null : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const dt = (s) => new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/* THE CARD PICTURE. tcgplayer-cdn serves a fixed 200 wide and a VARIABLE height,
   which is why shared/format.mjs's imgDims() declines to give dimensions for
   this host -- so the frame is a fixed box in CSS and the picture is centred
   inside it by object-fit, exactly as /topps.html does for PriceCharting scans.
   Every one carries onerror, because a withdrawn image must remove itself
   rather than paint a broken glyph. */
const cardImg = (pid, alt) => pid == null ? "" :
  `<img class="jb-art" src="https://tcgplayer-cdn.tcgplayer.com/product/${pid}_200w.jpg"` +
  ` srcset="https://tcgplayer-cdn.tcgplayer.com/product/${pid}_200w.jpg 200w,` +
  ` https://tcgplayer-cdn.tcgplayer.com/product/${pid}_400w.jpg 400w" sizes="132px"` +
  ` alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.remove()">`;

const valueRows = doc.value.map((v) => {
  const tag = v.format === "topper" ? `<span class="jb-tag jb-tag--t">Box topper</span>` : `<span class="jb-tag">Jumbo</span>`;
  const grades = [["Raw", v.raw], ["Grade 9", v.g9], ["PSA 10", v.psa10]]
    .filter(([, n]) => n != null)
    .map(([k, n]) => `<span><i>${k}</i> ${money(n)}</span>`).join("");
  return `<li class="jb-v">
      <span class="jb-rank">${v.rank}</span>
      <span class="jb-pic">${cardImg(v.pid, `${v.name} ${v.sub}`)}</span>
      <div class="jb-vb">
        <h3>${esc(v.name)} ${tag}</h3>
        <p class="jb-sub">${esc(v.sub)} &bull; ${esc(v.set)} &bull; ${v.year}</p>
        <p class="jb-prices">${grades}</p>
        <p class="jb-why">${esc(v.why)}</p>
      </div>
    </li>`;
}).join("\n");

/* THE CATALOGUE IS TEXT AND IT IS CAPPED. 345 rows with a picture each would be
   345 requests for defaced thumbnails; 345 rows of text is a wall nobody reads.
   The page shows the priced ones, dearest first, and says what it is showing and
   out of how many rather than implying it is everything. */
const priced = cat.cards.filter((c) => c.market != null);
const SHOW = 120;
const catRows = priced.slice(0, SHOW).map((c) =>
  `<tr><td>${esc(c.name)}</td><td>${esc(c.rarity || "")}</td><td class="jb-n">${money(c.market)}</td></tr>`
).join("\n");

const srcList = doc.sources.map((s) =>
  `<li><a href="${esc(s.url)}" rel="noopener" target="_blank" aria-label="${esc(s.name)}, opens on ${esc(new URL(s.url).host)}">${esc(s.name)}</a>: ${esc(s.for)}, read ${dt(s.read)}</li>`
).join("\n");

/* UNDER 158 CHARACTERS SO IT RENDERS WHOLE, and only what is true of all of
   it: the old one was clipped mid-sentence at "why almost every valuable
   one..." and ended by saying every one of the catalog's prices was read
   twice, which is true of the nine ranked cards and not of the 280. */
const DESC = `What a Pokemon jumbo card is, how you get one, why the valuable ones are box toppers, ` +
  `and what ${cat.counts.priced} of them are worth, read ${dt(cat.checked)}.`;
// 580px IS THE CUT GOOGLE RENDERS AT and the first draft of this title was
// 684px, losing "and What They Are Worth" -- the half a searcher is looking
// for. Shortened to fit rather than left to be truncated, which is the standing
// rule everywhere the title is OURS. The rip pages are the documented exception
// because those titles are the owner's own YouTube titles verbatim.
const TITLE = `Pokemon Jumbo Cards: Sizes, Sets and What They Are Worth`;
const OG_TITLE = `Pokemon Jumbo Cards: What They Are and What They Are Worth`;

const body = `<main id="main">
  <section class="wrap jb-hero">
    <p class="kicker">Oversize cards</p>
    <h1>Pokemon jumbo cards</h1>
    <p class="lede jb-lede">The Pokemon Company calls them <b>oversize</b> cards. The hobby calls them <b>jumbo</b>.
      Both are right, and almost everything else about them is unpublished: there is no official size,
      no official count, and no official explanation of why they exist. This page is what can actually
      be sourced, with the date each source was read, and it says plainly where sources disagree.</p>
    <ul class="jb-facts">
      <li><b>${cat.counts.cards}</b> in TCGplayer's jumbo group</li>
      <li><b>395</b> in Bulbapedia's international list</li>
      <li><b>Neither</b> contains the other</li>
      <li><b>Not</b> tournament legal</li>
    </ul>
  </section>

  <section class="wrap jb-sec">
    <h2>What counts as a jumbo</h2>
    <p>A standard Pokemon card is ${esc(doc.size.standard)}. ${esc(doc.size.standardNote)}</p>
    <p class="jb-warn">${esc(doc.size.officialNote)}</p>
    <table class="jb-tbl"><thead><tr><th>Era</th><th>Measured</th><th>Who measured it</th></tr></thead><tbody>
      ${doc.size.measurements.map((m) => `<tr><td>${esc(m.era)}</td><td class="jb-n">${esc(m.mm)} mm</td><td>${esc(m.src)}: ${esc(m.note)}</td></tr>`).join("\n      ")}
    </tbody></table>
    <p>${esc(doc.size.eras)}</p>
  </section>

  <section class="wrap jb-sec jb-box">
    <h2>${esc(doc.boxToppers.headline)}</h2>
    <p>${esc(doc.boxToppers.body)}</p>
  </section>

  <section class="wrap jb-sec">
    <h2>How you get one</h2>
    <div class="jb-two">
      <div><h3>These normally include one</h3><ul class="jb-do">${doc.howYouGetThem.do.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div><h3>These normally do not</h3><ul class="jb-dont">${doc.howYouGetThem.dont.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    </div>
    <p class="jb-note">${esc(doc.howYouGetThem.dontNote)}</p>
    <p>${esc(doc.howYouGetThem.europe)}</p>
  </section>

  <section class="wrap jb-sec">
    <h2>Can you play with them?</h2>
    <p class="jb-answer">${esc(doc.legality.answer)}</p>
    <p>${esc(doc.legality.ruling)}</p>
    <p class="jb-warn">${esc(doc.legality.twist)}</p>
    <p>${esc(doc.legality.story)}</p>
    <p class="jb-note">${esc(doc.legality.dateNote)}</p>
  </section>

  <section class="wrap jb-sec">
    <h2>Where they came from</h2>
    <ol class="jb-time">${doc.history.map((h) => `<li><b>${esc(h.when)}</b> ${esc(h.what)}</li>`).join("\n")}</ol>
    <p class="jb-note">${esc(doc.historyNote)}</p>
  </section>

  <section class="wrap jb-sec">
    <h2>How many are there?</h2>
    <p>${esc(doc.counts.note)}</p>
  </section>

  <section class="wrap jb-sec">
    <h2>The most valuable ones</h2>
    <p>${/* {checked} and not a typed date: the note said "read September 21" two days after the prices under it were re-read. */ esc(doc.valueNote).replace("{checked}", dt(doc.checked))}</p>
    <p class="jb-note">${esc(doc.images.note)}</p>
    <ol class="jb-vlist">
${valueRows}
    </ol>
    <h3>Three figures deliberately left off</h3>
    <ul class="jb-excl">${doc.excluded.map((x) => `<li><b>${esc(x.what)}.</b> ${esc(x.why)}</li>`).join("\n")}</ul>
  </section>

  <section class="wrap jb-sec jb-base">
    <h2>${esc(doc.baseline.headline)}</h2>
    <p>${esc(doc.baseline.body)}</p>
    <ul class="jb-ex">${doc.baseline.examples.map((e) => `<li><span>${esc(e.name)}</span><b>${money(e.raw)}</b></li>`).join("")}</ul>
    <p class="jb-warn">${esc(doc.baseline.averages)}</p>
  </section>

  <section class="wrap jb-sec">
    <h2>The catalog</h2>
    <p>The ${SHOW} most valuable of the ${cat.counts.priced} cards that carry a market price, out of the
      ${cat.counts.cards} in TCGplayer's jumbo group, read ${dt(cat.checked)}. This is
      <b>not every jumbo card</b>: it is how one marketplace files them. The 25th Anniversary First
      Partner jumbos sit in another set and Japanese jumbos are absent entirely.</p>
    <div class="cc-scroll"><table class="jb-tbl jb-cat"><thead><tr><th>Card</th><th>Rarity</th><th>Market</th></tr></thead><tbody>
${catRows}
    </tbody></table></div>
  </section>

  <section class="wrap jb-sec">
    <h2>What we could not find out</h2>
    <ul class="jb-unk">${doc.unsourced.map((x) => `<li>${esc(x)}</li>`).join("\n")}</ul>
    <h3>Sources</h3>
    <ul class="jb-src">
${srcList}
    </ul>
    <p class="jb-note">Prices read ${dt(doc.checked)} and checked twice. Catalog read ${dt(cat.checked)}.</p>
  </section>
</main>`;

const LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${SITE}/jumbo-cards.html#article`,
  headline: OG_TITLE,
  description: DESC,
  datePublished: doc.checked,
  dateModified: doc.checked,
  author: { "@type": "Organization", name: "Garbage Rips 585", url: `${SITE}/` },
  publisher: {
    "@type": "Organization", "@id": SITE + "/#org", name: "Garbage Rips 585", url: SITE + "/",
    logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-square.jpg` },
  },
  mainEntityOfPage: `${SITE}/jumbo-cards.html`,
  isPartOf: { "@type": "WebSite", name: "Garbage Rips 585", url: `${SITE}/` },
};

const CSS = `<style>
.jb-hero{padding-top:var(--s5)}
.jb-lede{max-width:46em}
.jb-facts{list-style:none;padding:0;margin:var(--s4) 0 0;display:grid;gap:var(--s3);grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.jb-facts li{background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3);text-align:center;font:400 var(--t-sm)/1.3 var(--body);color:var(--ink-2)}
.jb-facts b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ink);margin-bottom:4px}
.jb-sec{padding-top:var(--s5)}
.jb-sec h2{margin:0 0 var(--s3)}
.jb-sec p{max-width:46em}
.jb-warn{border-left:3px solid var(--ketchup);padding-left:var(--s3)}
.jb-note{font:400 var(--t-sm)/1.5 var(--body);color:var(--ink-2)}
.jb-answer{font:400 var(--t-l)/1.2 var(--display);color:var(--ink)}
.jb-tbl{width:100%;border-collapse:collapse;margin:var(--s3) 0;font:400 var(--t-sm)/1.4 var(--body);table-layout:fixed}
.jb-tbl th,.jb-tbl td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--keyline);vertical-align:top;overflow-wrap:anywhere;min-width:0}
.jb-tbl th{font:700 var(--t-micro)/1 var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2)}
.jb-n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.jb-two{display:grid;gap:var(--s4);grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin:var(--s3) 0}
.jb-two h3{margin:0 0 var(--s2)}
.jb-do,.jb-dont{margin:0;padding-left:1.1em}
.jb-do li,.jb-dont li{margin:2px 0}
.jb-time{margin:var(--s3) 0;padding-left:1.2em}
.jb-time li{margin:var(--s2) 0;max-width:46em}
.jb-vlist{list-style:none;padding:0;margin:var(--s4) 0 0;display:grid;gap:var(--s3)}
.jb-v{display:grid;grid-template-columns:auto 132px minmax(0,1fr);gap:var(--s3);align-items:start;background:var(--paper);border:1px solid var(--keyline);border-radius:var(--r-sm);padding:var(--s3)}
.jb-rank{font:400 var(--t-l)/1 var(--display);color:var(--ink-2);min-width:1.4em}
.jb-pic{width:132px;height:184px;display:grid;place-items:center;background:var(--page);border-radius:var(--r-sm);overflow:hidden}
.jb-art{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.jb-vb{min-width:0}
.jb-vb h3{margin:0 0 2px}
.jb-sub{margin:0 0 6px;font:400 var(--t-sm)/1.3 var(--body);color:var(--ink-2)}
.jb-prices{margin:0 0 6px;display:flex;flex-wrap:wrap;gap:10px}
.jb-prices span{font:400 var(--t-sm)/1.3 var(--body);color:var(--ink);white-space:nowrap}
.jb-prices i{font-style:normal;font:700 var(--t-micro)/1 var(--mono);text-transform:uppercase;color:var(--ink-2);margin-right:3px}
.jb-why{margin:0;font:400 var(--t-sm)/1.5 var(--body);color:var(--ink-2)}
.jb-tag{display:inline-block;font:700 var(--t-micro)/1 var(--mono);text-transform:uppercase;letter-spacing:.04em;padding:3px 6px;border-radius:999px;border:1px solid var(--keyline);color:var(--ink-2);vertical-align:.18em;margin-left:6px}
.jb-tag--t{border-color:var(--ketchup);color:var(--ink)}
.jb-excl li,.jb-unk li,.jb-src li{margin:var(--s2) 0;max-width:46em;font:400 var(--t-sm)/1.5 var(--body)}
.jb-ex{list-style:none;padding:0;margin:var(--s3) 0;display:grid;gap:6px;max-width:34em}
.jb-ex li{display:flex;justify-content:space-between;gap:var(--s3);padding:6px 0;border-bottom:1px solid var(--keyline);font:400 var(--t-sm)/1.3 var(--body)}
.jb-cat{margin-top:var(--s3)}
@media (max-width:544px){
  .jb-v{grid-template-columns:auto 96px minmax(0,1fr)}
  .jb-pic{width:96px;height:134px}
}
</style>`;

const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(clipMeta(DESC))}">
<link rel="canonical" href="${SITE}/jumbo-cards.html">
<meta property="og:title" content="${esc(OG_TITLE)}">
<meta property="og:description" content="${esc(clipMeta(DESC))}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/jumbo-cards.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-jumbo-cards.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(OG_TITLE)}">
<meta name="twitter:description" content="${esc(clipMeta(DESC))}">
<meta name="twitter:image" content="${SITE}/assets/og-jumbo-cards.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<link rel="preconnect" href="https://tcgplayer-cdn.tcgplayer.com" crossorigin>
<script type="application/ld+json">${JSON.stringify(LD)}</script>
${FONTS}
${STYLES}`;

const html = `${HEAD}
${CSS}
</head>
<body>
${SKIP}
${SPRITE}
${BAR}
${MENU}
${body}
${footer()}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/jumbo-cards.html"), dropUnusedPacksCSS(html));
console.log(`Wrote public/jumbo-cards.html`);
console.log(`  ${doc.value.length} ranked cards, ${doc.excluded.length} figures withheld`);
console.log(`  catalogue: ${SHOW} of ${cat.counts.priced} priced, from ${cat.counts.cards} in the group`);
console.log(`  ${doc.sources.length} sources, ${doc.unsourced.length} things recorded as unsourced`);
