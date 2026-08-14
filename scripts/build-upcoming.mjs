#!/usr/bin/env node
// Build public/upcoming.html: what is coming next, and when.
//
//   node scripts/build-upcoming.mjs
//
// Reads data/upcoming.json, which is maintained by hand because there is no
// API for things that have not happened yet.
//
// THIS PAGE HAS ONE JOB AND ONE FAILURE MODE.
// The job: a person wants to know what to save for and when to be in the shop.
// The failure: telling them a date that turns out to be wrong, or a set that
// does not exist. Several AI-written card sites publish invented set names, and
// one of them called Chaos Rising "Rising Chaos". Being a week late with a
// correct date beats being first with a wrong one.
//
// So every entry carries how well known it actually is, and the page shows
// that on the card rather than hiding it in a footnote:
//   confirmed  official date from The Pokemon Company or Pokemon Center
//   window     an official month or quarter with no exact day
//   expected   a lineup matching every previous set in the series, which TPCi
//              has not announced. Retailer preorder pages list these; they are
//              templated from the last set, not sourced.
//
// Anything already released drops off automatically, so the page cannot sit
// there advertising last month as upcoming.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate, MONTHS_LONG } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const doc = JSON.parse(await readFile(join(ROOT, "data/upcoming.json"), "utf8"));

/**
 * Live TCGplayer preorder prices, product photos and card art.
 *
 * The number that matters here is not the price, it is the price NEXT TO MSRP.
 * The 30th Celebration Elite Trainer Box has a $49.99 MSRP and preorders near
 * $190. Showing the preorder alone reads as "this is what it costs"; showing
 * both shows what is actually happening, which is people paying nearly four
 * times retail months before it reaches a shelf. Anyone deciding whether to
 * preorder is exactly who this page is for.
 *
 * Cards for an unreleased set carry names, numbers, rarities and artwork but no
 * price, because none have sold. They are shown anyway, without a price column,
 * as the first look at what is in the set.
 */
let preorders = {};
try {
  preorders = JSON.parse(await readFile(join(ROOT, "public/data/preorders.json"), "utf8")).sets || {};
} catch {
  /* run: node scripts/sync-preorders.mjs */
}

const usd = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function preorderBand(setName) {
  const e = preorders[setName];
  if (!e?.products?.length && !e?.chase?.length) return "";
  const worst = e.products.filter((p) => p.overMsrp).sort((a, b) => b.overMsrp - a.overMsrp)[0];

  const prods = e.products.slice(0, 9).map((p) => `        <li class="po">
          <a class="po-shot" href="${esc(p.url)}" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
            <img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.remove()" decoding="async" width="200" height="200" referrerpolicy="no-referrer">
          </a>
          <div class="po-body">
            <h4><a href="${esc(p.url)}" rel="noopener" target="_blank">${esc(p.name)}</a></h4>
            <p class="po-price"><b>${usd(p.price)}</b>${
              p.msrp ? ` <span class="po-msrp">MSRP ${usd(p.msrp)}</span>` : ""
            }</p>
            ${p.overMsrp ? `<p class="po-over">${p.overMsrp}x retail</p>` : ""}
            ${p.listings ? `<p class="po-sellers">${p.listings} seller${p.listings === 1 ? "" : "s"}</p>` : ""}
          </div>
        </li>`).join("\n");

  const cards = e.chase.slice(0, 8).map((c) => `        <li class="poc">
          <a href="${esc(c.url)}" rel="noopener" target="_blank">
            <img src="${esc(c.thumb)}" alt="${esc(c.name)}" loading="lazy" onerror="this.remove()" decoding="async" width="200" height="280" referrerpolicy="no-referrer">
            <span class="poc-n">${esc(c.name)}</span>
            <span class="poc-r">${esc(c.rarity || "")}${c.number ? ` &bull; ${esc(c.number)}` : ""}</span>
          </a>
        </li>`).join("\n");

  return `      <div class="po-wrap">
        ${e.setTotal ? `<p class="po-count">${e.setTotal} cards in the set, going by the numbering on the cards themselves.</p>` : ""}
        ${
          worst
            ? `<p class="po-warn">Preorders are running hot. The ${esc(worst.name)} has a ${usd(worst.msrp)}
               list price and is going for ${usd(worst.price)}, which is ${worst.overMsrp} times retail, months before
               it is on a shelf. Prices usually fall after release.</p>`
            : ""
        }
        ${prods ? `<h3 class="po-h">Preorder prices</h3>
        <ul class="po-grid">
${prods}
        </ul>` : ""}
        ${cards ? `<h3 class="po-h">Cards revealed so far</h3>
        <ul class="poc-grid">
${cards}
        </ul>
        <p class="po-note">No prices on the cards yet: none have been sold, because the set is not out.</p>` : ""}
        <p class="po-src">Preorder prices and photos from TCGplayer, read ${esc(longDate(e.checked))}. Not affiliate links.</p>
      </div>`;
}

// "Today" comes from the newest thing in the catalogue rather than the clock,
// so a rebuild is reproducible and a stale checkout does not silently hide
// entries. Falls back to the file's own checked date.
const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const newestUpload = videos.map((v) => v.published).filter(Boolean).sort().pop();
const TODAY = [newestUpload, doc.checked].filter(Boolean).sort().pop();

const future = (d) => !d || d >= TODAY;

const sets = (doc.sets || []).filter((s) => future(s.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
const extras = (doc.products || []).filter((p) => future(p.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));

const dropped =
  (doc.sets || []).length - sets.length + ((doc.products || []).length - extras.length);

const badge = (c) =>
  ({
    confirmed: '<span class="up-tag ok">Confirmed date</span>',
    window: '<span class="up-tag win">Date window</span>',
    expected: '<span class="up-tag exp">Not announced</span>',
  }[c] || "");

/** "in 5 weeks", "next Thursday", "out now". Reads better than a raw date. */
function countdown(iso) {
  if (!iso) return "";
  const days = Math.round((new Date(iso) - new Date(TODAY)) / 86400000);
  if (days <= 0) return "out now";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30.44)} months`;
}

const productRow = (p) => `          <li>
            <span class="up-p">${esc(p.name)}</span>
            <span class="up-meta">${[
              p.packs ? `${p.packs} pack${p.packs === 1 ? "" : "s"}` : null,
              p.price || null,
              p.date && p.date !== "" ? longDate(p.date) : null,
            ]
              .filter(Boolean)
              .map(esc)
              .join(" &bull; ")}</span>
            ${p.note ? `<span class="up-note">${esc(p.note)}</span>` : ""}
            ${p.confidence === "expected" ? `<span class="up-tag exp sm">Not announced</span>` : ""}
          </li>`;

const setCard = (s) => `      <article class="up-set">
        <div class="up-head">
          <div>
            <p class="up-when"><b>${longDate(s.date)}</b> <span>${countdown(s.date)}</span></p>
            <h2>${esc(s.name)}${s.code ? ` <span class="up-code">${esc(s.code)}</span>` : ""}</h2>
          </div>
          ${badge(s.confidence)}
        </div>
        <p class="up-blurb">${esc(s.blurb)}</p>
        ${
          (s.highlights || []).length
            ? `<ul class="up-hi">${s.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
            : ""
        }
        ${preorderBand(s.name)}
        ${
          (s.products || []).length
            ? `<details class="up-products"${s.confidence === "confirmed" && !s.productNote ? " open" : ""}>
          <summary>What you can buy <span>${s.products.length}</span></summary>
          <ul>
${s.products.map(productRow).join("\n")}
          </ul>
          ${s.productNote ? `<p class="up-warn">${esc(s.productNote)}</p>` : ""}
          ${
            s.noBoosterBox
              ? `<p class="up-warn">No sealed booster box has been announced for this one. If you see a shop taking preorders for one, be careful.</p>`
              : ""
          }
        </details>`
            : ""
        }
      </article>`;

const extraCard = (p) => `      <li class="up-extra">
        <p class="up-when"><b>${longDate(p.date)}</b> <span>${countdown(p.date)}</span></p>
        <h3>${esc(p.name)}</h3>
        <p class="up-blurb">${esc(p.blurb)}</p>
        <p class="up-meta">${[p.packs ? `${p.packs} pack${p.packs === 1 ? "" : "s"}` : null, p.price || null]
          .filter(Boolean)
          .map(esc)
          .join(" &bull; ")}</p>
      </li>`;

const style = `
.up{padding:var(--s7) 0 var(--s5)}
.up-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
/* Each key item is its own flex row. Left inline, the label wrapped underneath
   its own badge and the two overlapped at 375px. */
.up-key{display:flex;flex-direction:column;gap:10px;margin-bottom:var(--s6)}
.up-key > span{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.04em}
@media(min-width:900px){.up-key{flex-direction:row;flex-wrap:wrap;gap:var(--s4)}}

.up-tag{flex:none;align-self:flex-start;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;padding:6px 9px;border-radius:var(--r-pill);white-space:nowrap}
.up-tag.ok{background:var(--mustard);color:var(--ink);border:1px solid var(--gold-deep)}
.up-tag.win{background:var(--lilac-pale);color:var(--plum);border:1px solid rgba(78,47,72,.3)}
.up-tag.exp{background:var(--page);color:var(--ink-2);border:1px dashed var(--ink-2)}
.up-tag.sm{padding:3px 7px;margin-left:6px;text-transform:none}

.up-list{display:flex;flex-direction:column;gap:var(--s5)}
.up-set{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.up-head{display:flex;gap:var(--s3);align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.up-when{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-2);margin-bottom:4px}
.up-when b{color:var(--ink)}
.up-when span{color:var(--ketchup-deep)}
.up-set h2{font:400 var(--t-l)/1.1 var(--display);margin-bottom:var(--s3)}
.up-code{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);vertical-align:middle;
  letter-spacing:.08em}
.up-blurb{color:var(--ink-2);max-width:46em}
.up-hi{list-style:none;display:flex;flex-direction:column;gap:6px;margin:var(--s4) 0 0}
.up-hi li{display:flex;gap:var(--s3);align-items:flex-start;color:var(--ink-2);font-size:var(--t-sm)}
.up-hi li::before{content:"";flex:none;width:8px;height:8px;margin-top:.5em;border-radius:2px;
  background:var(--mustard);border:1px solid var(--gold-deep);transform:rotate(45deg)}

.up-products{margin-top:var(--s4);border-top:1px solid var(--hair);padding-top:var(--s3)}
.up-products summary{cursor:pointer;font:700 var(--t-sm)/1 var(--body);min-height:44px;
  display:flex;align-items:center;gap:8px}
.up-products summary span{font:700 var(--t-micro)/1 var(--mono);background:var(--page);
  border:1px solid var(--hair);border-radius:var(--r-pill);padding:4px 8px;color:var(--ink-2)}
.up-products ul{list-style:none;display:flex;flex-direction:column;gap:var(--s2);margin-top:var(--s3)}
.up-products li{padding:var(--s3);background:var(--page);border-radius:calc(var(--r) - 6px)}
.up-p{display:block;font-weight:600}
.up-meta{font:700 var(--t-micro)/1.5 var(--mono);color:var(--ink-2);letter-spacing:.04em}
.up-note{display:block;font-size:var(--t-sm);color:var(--ink-2);margin-top:2px}
.up-warn{font:700 var(--t-micro)/1.7 var(--mono);color:var(--plum);background:var(--lilac-pale);
  border-radius:calc(var(--r) - 6px);padding:var(--s3);margin-top:var(--s3)}

.up-extras{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--s4)}
.up-extra{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.up-extra h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:var(--s2)}
.up-extra .up-blurb{font-size:var(--t-sm);margin-bottom:var(--s2)}

/* Live preorder prices, product photos and revealed cards. */
.po-wrap{margin-top:var(--s4);border-top:1px solid var(--hair);padding-top:var(--s4)}
.po-count{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:var(--s3)}
/* The point of the whole band. Loud on purpose: it is the one number that
   changes whether somebody should preorder. */
.po-warn{background:var(--lilac-pale);border:1px solid rgba(78,47,72,.28);border-radius:var(--r);
  padding:var(--s4);color:var(--plum);font-size:var(--t-sm);line-height:1.6;margin-bottom:var(--s4)}
.po-h{font:400 var(--t-m)/1.2 var(--display);margin:var(--s4) 0 var(--s3)}
.po-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:var(--s3)}
.po{display:flex;gap:var(--s3);align-items:center;background:var(--page);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s3)}
.po-shot{flex:none;width:66px;height:66px;display:grid;place-items:center;background:#fff;
  border:1px solid var(--hair);border-radius:calc(var(--r) - 8px);overflow:hidden}
.po-shot img{width:100%;height:100%;object-fit:contain}
.po-body{min-width:0}
.po h4{font:700 var(--t-sm)/1.3 var(--body);margin-bottom:2px}
.po h4 a{display:inline-block;min-height:24px}
.po h4 a:hover{text-decoration:underline}
.po-price{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.po-price b{font:400 var(--t-m)/1 var(--display)}
.po-msrp{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);text-decoration:line-through}
.po-over{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ketchup-deep);letter-spacing:.04em;
  text-transform:uppercase}
.po-sellers{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2)}

.poc-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:var(--s3)}
.poc a{display:flex;flex-direction:column;gap:4px}
.poc img{width:100%;height:auto;border-radius:6px;display:block;background:var(--page)}
.poc-n{font:700 var(--t-sm)/1.25 var(--body)}
.poc-r{font:700 9px/1.3 var(--mono);letter-spacing:.05em;text-transform:uppercase;color:var(--ink-2)}
.po-note,.po-src{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);margin-top:var(--s3)}

.up-foot{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
`;

const body = `
<main id="main">
  <section class="up">
    <div class="wrap">
      <div class="brk"><h1>What is <span class="hl">coming next</span></h1><span class="ln"></span></div>
      <p class="up-lede">Every announced English Pokemon TCG release, with what is actually in it.
        Dates say how well known they are, because a confirmed date and a shop's guess are not the
        same thing and most sites print them identically.</p>
      <div class="up-key">
        <span>${badge("confirmed")} straight from The Pokemon Company</span>
        <span>${badge("window")} an official month, no exact day</span>
        <span>${badge("expected")} what the last set had, not an announcement</span>
      </div>

      <div class="up-list">
${sets.map(setCard).join("\n")}
      </div>
    </div>
  </section>

  ${
    extras.length
      ? `<section class="band tight">
    <div class="wrap">
      <h2>Other things with a <span class="hl">date on them</span></h2>
      <p class="up-blurb" style="margin-bottom:var(--s4)">Tins, blisters and collections that are not
        full expansions but are worth knowing about.</p>
      <ul class="up-extras">
${extras.map(extraCard).join("\n")}
      </ul>
    </div>
  </section>`
      : ""
  }

  <section class="tight">
    <div class="wrap">
      <p class="up-foot">CHECKED ${esc(longDate(doc.checked).toUpperCase())}. NOTHING BEYOND THE SETS
        ABOVE HAS BEEN ANNOUNCED: NO ENGLISH SET AFTER THEM HAS BEEN NAMED OR DATED, SO THIS PAGE
        DOES NOT LIST ONE. JAPANESE SETS OFTEN COME OUT MONTHS EARLIER AND ARE NOT THE SAME RELEASE,
        SO THEY ARE NOT ON HERE EITHER. DATES SLIP. IF YOU SPOT ONE THAT HAS CHANGED, SAY SO ON ANY
        OF THE SOCIALS AND IT GETS FIXED.</p>
    </div>
  </section>
</main>`;

// A BreadcrumbList, and only a BreadcrumbList. Deleting the broken ItemList
// left this the one page on the site carrying no structured data at all, which
// is not the same decision: the ItemList was dropped because its entries could
// not be resolved, and a breadcrumb has nothing to resolve except this page and
// the home page, both of which exist. Same two-item shape every other top level
// page uses, with no `item` on the last crumb because that crumb IS this page.
// "Coming next" is the label the nav in shared/chrome.mjs already uses for it.
const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Coming next" },
    ],
  },
];

// NO ItemList. This page shipped one whose entries were bare names with a
// position and no `url` and no `item`, so there was nothing for a crawler to
// follow and the block was ignored in full.
//
// Every entry here is unreleased, which is the whole point of the page, so
// there is no /sets/ guide to link to yet and there will not be until the set
// is out. The `<article class="up-set">` blocks carry no id either, so there is
// not even an anchor on this page. When these sets ship and get their own set
// pages, an ItemList pointing at those is worth writing.

const nextUp = sets[0] || extras[0];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upcoming Pokemon TCG Sets ${new Date(TODAY).getFullYear()}: Release Dates and Products | Garbage Rips 585</title>
<meta name="description" content="Every announced English Pokemon TCG set and product with its release date${
  nextUp ? `, next up ${nextUp.name} on ${longDate(nextUp.date)}` : ""
}. Confirmed dates marked apart.">
<link rel="canonical" href="${SITE}/upcoming.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#15263A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Upcoming Pokemon TCG Sets and Release Dates">
<meta property="og:description" content="Every announced English Pokemon TCG release, with what is in it and how confirmed the date is.">
<meta property="og:url" content="${SITE}/upcoming.html">
<meta property="og:image" content="${SITE}/assets/og-upcoming.jpg">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${STYLES}
<style>${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer(`Release dates checked ${longDate(doc.checked)}. Dates come from The Pokemon Company unless marked otherwise.`)}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/upcoming.html"), html);

console.log(`Wrote public/upcoming.html
  ${sets.length} upcoming set(s), ${extras.length} other product(s)
  ${dropped} entr(y/ies) already released and filtered out
  next up: ${nextUp ? `${nextUp.name}, ${longDate(nextUp.date)} (${countdown(nextUp.date)})` : "nothing"}`);
if (!sets.length && !extras.length) {
  console.log(`
  Everything in data/upcoming.json has already come out. Add the next
  announcements there, and only ones with an official name.`);
}
