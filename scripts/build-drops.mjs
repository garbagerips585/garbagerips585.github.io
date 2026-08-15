#!/usr/bin/env node
// Build /drops.html: what retailers are expected to have this week.
//
//   node scripts/build-drops.mjs
//
// Reads data/drops.json, which a human updates weekly.
//
// THIS IS THE ONLY PAGE ON THE SITE BUILT FROM FORECASTS, and everything here
// follows from that. Every other page obeys the rule that a published number
// traces to a source. Nothing on this one does: no retailer announces its
// restock schedule, and the people reporting it are reading shelves, backend
// listings and each other. Pretending otherwise would be the single most
// damaging thing this site could do, because a reader drives somewhere.
//
// So the page is built to be honest about its own reliability:
//   - the lede says nobody has announced any of this
//   - every row carries a confidence, in the three words upcoming.json uses
//     plus a fourth, `pattern`, for the claims with no official origin at all
//   - the compiled date is at the top, not in the footer
//   - and when the week has passed the page SAYS SO before anything else
//
// STALENESS IS THE FAILURE MODE. "Today" comes from the newest upload in the
// catalogue rather than the clock, the same trick build-upcoming.mjs uses, so
// a rebuild is reproducible and a stale checkout cannot silently make an old
// week look current.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = JSON.parse(await readFile(join(ROOT, "data/drops.json"), "utf8"));
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));

const TODAY =
  [videos.map((v) => v.published).filter(Boolean).sort().pop(), doc.compiled]
    .filter(Boolean)
    .sort()
    .pop()
    .slice(0, 10);

const stale = Boolean(doc.weekEnds && doc.weekEnds < TODAY);
const daysOld = doc.weekEnds
  ? Math.round((new Date(TODAY) - new Date(doc.weekEnds)) / 86400000)
  : 0;

const R = doc.retailers || {};
const drops = (doc.drops || []).filter((d) => R[d.retailer]);
if (drops.length !== (doc.drops || []).length) {
  // A row naming a retailer with no entry would render an unlabelled card, and
  // the reader would have no idea which shop it meant.
  const bad = (doc.drops || []).filter((d) => !R[d.retailer]).map((d) => d.retailer);
  throw new Error(`drops.json names retailers with no entry in "retailers": ${bad.join(", ")}`);
}

// PATTERN IS THE WEAKEST TIER AND IT EARNED ITS OWN WORD. The other three all
// imply something official sits behind them, because that is what they mean on
// /upcoming.html. A recurring drop-time claim has no official origin at all:
// every retailer surface was probed and not one publishes a restock schedule,
// so "Walmart Wednesday" is folklore that happens to be well observed. Giving
// it the same badge as an announced date would have been the page telling a
// small lie in its own vocabulary.
const CONF = {
  confirmed: { label: "Confirmed", cls: "ok", note: "A date the retailer put on it, or stock already seen on shelves." },
  window: { label: "Usual window", cls: "win", note: "Expected inside a known range." },
  expected: { label: "Expected", cls: "exp", note: "The community thinks it is coming. No date." },
  pattern: { label: "Pattern only", cls: "pat", note: "A day or time people have noticed. No retailer publishes a restock schedule, so this is the weakest thing on the page." },
};

const byChannel = (c) => drops.filter((d) => d.channel === c);
const nStore = byChannel("store").length;
const nOnline = byChannel("online").length;

// Retailers in the order they first appear, so the filter row matches the page.
const order = [];
for (const d of drops) if (!order.includes(d.retailer)) order.push(d.retailer);

// COLOUR MEANS KIND OF SHOP, NOT WHICH SHOP. A retailer's own brand colour was
// tried first and failed on its own terms: the two red pharmacies-and-discount
// chips landed close enough to be one colour, and better sourcing makes it
// worse rather than better, because Target and Costco use the same Pantone.
// The name identifies. These are the site's own palette describing the site's
// own categories, so they assert nothing about anybody's brand.
const KIND_TINT = {
  "Official store": "var(--gold)",
  "Big box": "var(--navy)",
  Grocery: "var(--teal)",
  Pharmacy: "var(--plum)",
  Discount: "var(--ketchup)",
};

const chip = (id) => {
  const r = R[id];
  const tint = KIND_TINT[r.kind];
  if (!tint) throw new Error(`drops.json: retailer "${r.name}" has kind "${r.kind}" with no colour in KIND_TINT`);
  return `<span class="rt" style="--rt:${tint}">${esc(r.name)}<i>${esc(r.kind)}</i></span>`;
};

const card = (d) => {
  const r = R[d.retailer];
  const c = CONF[d.confidence] || CONF.expected;
  return `      <article class="drop" data-channel="${esc(d.channel)}" data-retailer="${esc(d.retailer)}">
        <div class="drop-top">
          ${chip(d.retailer)}
          <span class="drop-ch">${d.channel === "store" ? "In store" : "Online"}</span>
          <span class="drop-cf ${c.cls}">${esc(c.label)}</span>
        </div>
        <p class="drop-what">${esc(d.what)}</p>
        ${d.when ? `<p class="drop-when"><b>When.</b> ${esc(d.when)}</p>` : ""}
        ${(d.notes || []).map((n) => `<p class="drop-note">${esc(n)}</p>`).join("\n        ")}
        ${d.source ? `<p class="drop-src">${
          d.source.url
            ? `<a href="${esc(d.source.url)}" rel="noopener" target="_blank">${esc(d.source.name)}</a>`
            : esc(d.source.name)
        }${d.source.read ? `, read ${esc(longDate(d.source.read))}` : ""}</p>` : ""}
      </article>`;
};

const weekLabel =
  doc.weekOf && doc.weekEnds
    ? `${longDate(doc.weekOf)} to ${longDate(doc.weekEnds)}`
    : longDate(doc.compiled) || "this week";

const desc = `What Pokemon card stock is expected at Target, Walmart, Best Buy, Pokemon Center and more, in store and online, for ${weekLabel}. Nobody announces these.`.slice(0, 158);

const style = `
.dr-head{padding:var(--s6) 0 var(--s4)}
.dr-stale{background:var(--ketchup);color:#fff;border-radius:var(--r);padding:var(--s3) var(--s4);
  margin-bottom:var(--s4);font:700 var(--t-sm)/1.4 var(--body)}
.dr-when{font:700 var(--t-label)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:var(--s2)}
.dr-filters{display:flex;flex-wrap:wrap;gap:var(--s2);margin:var(--s4) 0 var(--s5)}
.dr-f{flex:none;font:700 var(--t-label)/1 var(--body);letter-spacing:.02em;padding:10px 14px;
  min-height:44px;display:inline-flex;align-items:center;border:2px solid var(--navy);
  border-radius:999px;background:var(--card);color:var(--ink);cursor:pointer}
.dr-f[aria-pressed="true"]{background:var(--navy);color:#F4F1E2}
.dr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:820px){.dr-grid{grid-template-columns:1fr}}
.drop{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);display:flex;flex-direction:column;gap:var(--s2)}
.drop[hidden]{display:none}
.drop-top{display:flex;flex-wrap:wrap;align-items:center;gap:var(--s2)}
.rt{font:700 var(--t-label)/1.1 var(--body);letter-spacing:.04em;text-transform:uppercase;
  padding:6px 10px;border-radius:6px;background:var(--card);color:var(--ink);
  border:1px solid var(--hair);border-left:4px solid var(--rt);
  display:inline-flex;flex-direction:column;gap:3px}
.rt i{font:400 var(--t-micro)/1 var(--mono);letter-spacing:.06em;color:var(--ink-2);font-style:normal}
.drop-ch,.drop-cf{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
.drop-cf.ok{background:#1E5B34;color:#EAF6EE;border-color:#1E5B34}
.drop-cf.win{background:var(--mustard);color:#2A2410;border-color:var(--mustard)}
.drop-cf.pat{background:var(--card);color:var(--ink-2);border-style:dashed}
.drop-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:auto;padding-top:var(--s2)}
.drop-what{font:600 var(--t-m)/1.35 var(--body)}
.drop-when,.drop-note{color:var(--ink-2);font-size:var(--t-sm);line-height:1.45}
.dr-empty{color:var(--ink-2);padding:var(--s5) 0}
.dr-sw{display:inline-block;width:11px;height:11px;border-radius:3px;background:var(--rt);
  border:1px solid var(--hair);vertical-align:-1px;margin-right:5px}
.dr-key h2{margin-bottom:var(--s3)}
.dr-key{margin-top:var(--s5);color:var(--ink-2);font-size:var(--t-sm);line-height:1.5;max-width:44em}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pokemon Card Drops and Restocks This Week | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/drops.html">
<meta property="og:title" content="Pokemon card drops and restocks this week">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/drops.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-drops.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-drops.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="stylesheet" href="/assets/fonts.css">
${STYLES}
<style>${style}</style>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Drops this week" },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Drops this week</span></nav>
      <div class="dr-head">
        ${stale ? `<p class="dr-stale">This list is ${daysOld} day${daysOld === 1 ? "" : "s"} out of date. It covered ${esc(weekLabel)} and has not been updated since. Treat it as a record of what was expected, not as this week's plan.</p>` : ""}
        <p class="dr-when">${esc(weekLabel)}</p>
        <h1>What is <span class="hl">dropping</span> this week</h1>
        <p class="lede" style="max-width:44em">Where Pokemon cards are expected to turn up, in store and online.
          <b>None of this is announced by anyone.</b> Retailers do not publish restock schedules, so every
          line here is people watching shelves and backend listings and comparing notes. Treat it as a
          decent guess, and check the confidence on each one.</p>
        <p class="lede" style="max-width:44em">${nStore} in store, ${nOnline} online, compiled ${esc(longDate(doc.compiled))}${
          doc.source?.name ? ` from ${esc(doc.source.name).toLowerCase()}` : ""
        }.</p>
      </div>

      <div class="dr-filters" role="group" aria-label="Filter drops">
        <button class="dr-f" type="button" data-f="all" aria-pressed="true">Everything</button>
        <button class="dr-f" type="button" data-f="store" aria-pressed="false">In store (${nStore})</button>
        <button class="dr-f" type="button" data-f="online" aria-pressed="false">Online (${nOnline})</button>
        ${order.map((id) => `<button class="dr-f" type="button" data-r="${esc(id)}" aria-pressed="false">${esc(R[id].name)}</button>`).join("\n        ")}
      </div>

      <div class="dr-grid" id="drGrid">
${drops.map(card).join("\n")}
      </div>
      <p class="dr-empty" id="drEmpty" hidden>Nothing matches that combination.</p>
      <!-- FILTERING WAS A SILENT CHANGE. The buttons were correct, aria-pressed
           and all, but pressing one took the grid from 8 cards to 3 and said
           nothing: a screen reader user got a state change with no result. The
           count is announced here rather than on the grid, because making the
           grid itself live would re-read every card on every keystroke. -->
      <p class="sr-only" id="drCount" role="status" aria-live="polite"></p>

      <div class="dr-key">
        <h2>How to read this page</h2>
        <p><b>What the labels mean.</b> ${Object.values(CONF).map((c) => `<b>${c.label}:</b> ${c.note}`).join(" ")}</p>
        <p style="margin-top:var(--s3)"><b>What the colours mean.</b> The stripe on each name is the kind of
          shop, not the shop's own colour: ${Object.entries(KIND_TINT)
            .map(([k, v]) => `<span class="dr-sw" style="--rt:${v}"></span>${esc(k)}`)
            .join(", ")}. Retailer names here are drawn in this site's own typeface and are the property of
          their owners. Nothing on this page is endorsed by, affiliated with or supplied by any of them.</p>
        <p style="margin-top:var(--s3)">Stock varies store to store and the good stuff goes fast, so this tells you
          where to look rather than what you will find. If you would rather buy without the hunt, the
          <a href="/shops.html">Rochester shops</a> and the <a href="/card-shows.html">card shows</a> have
          cards on a table right now, and <a href="/pack-prices.html">pack prices</a> shows what a pack
          actually costs before you pay a scalper for one.</p>
      </div>
    </div>
  </section>
</main>
${footer()}
<script>
(function () {
  // PROGRESSIVE ENHANCEMENT. Without this every card is already visible, which
  // is the honest default: a filter that fails closed would hide stock.
  var grid = document.getElementById("drGrid");
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll(".drop"));
  var empty = document.getElementById("drEmpty");
  var count = document.getElementById("drCount");
  var btns = [].slice.call(document.querySelectorAll(".dr-f"));
  var channel = "all", retailer = null;

  function apply() {
    var shown = 0;
    cards.forEach(function (c) {
      var okC = channel === "all" || c.getAttribute("data-channel") === channel;
      var okR = !retailer || c.getAttribute("data-retailer") === retailer;
      var on = okC && okR;
      c.hidden = !on;
      if (on) shown++;
    });
    if (empty) empty.hidden = shown > 0;
    if (count) {
      count.textContent = shown
        ? shown + (shown === 1 ? " drop shown" : " drops shown")
        : "No drops match that combination";
    }
    btns.forEach(function (b) {
      var f = b.getAttribute("data-f"), r = b.getAttribute("data-r");
      var on = r ? r === retailer : f === "all" ? channel === "all" && !retailer : f === channel;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var f = b.getAttribute("data-f"), r = b.getAttribute("data-r");
      if (r) retailer = retailer === r ? null : r;
      else if (f === "all") { channel = "all"; retailer = null; }
      else channel = channel === f ? "all" : f;
      apply();
    });
  });
  apply();
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/drops.html"), page);
console.log(`Wrote public/drops.html
  ${drops.length} drops across ${order.length} retailers, ${nStore} in store and ${nOnline} online
  week of ${doc.weekOf} to ${doc.weekEnds}${stale ? `  STALE by ${daysOld} days, the page says so` : ""}`);
