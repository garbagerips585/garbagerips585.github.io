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
//
// THE JAPANESE SECTION IS A THIRD LIST AND IT IS DELIBERATELY NOT MIXED IN.
// data/upcoming.json's _readme used to say, flatly, "Japanese sets are not
// English sets. Do not put a Japanese date on this page." Tim asked for the
// Japanese calendar on 21 August 2026 because he collects Japanese cards and
// they land months ahead of the English ones, so the rule was REWRITTEN rather
// than dropped, and it is worth reading there before touching this file.
//
// The purpose behind it survives intact: a reader must never be able to take a
// Japanese date for an English street date. What that purpose actually forbids
// is MIXING, not mentioning. So `japan.releases` renders under its own heading,
// after both English lists, behind its own lede saying what these dates are,
// and EVERY card in it carries a "Japan only" flag of its own. The flag is the
// part that matters and is not decoration: the heading and the lede only work
// for somebody who arrived at the top of the section, and a card gets read on
// its own the moment anybody screenshots one or lands on it from a search
// result. Do not "tidy" the flag away because the heading already says it.

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
import { esc, longDate, MONTHS_LONG, imgDims } from "../shared/format.mjs";

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

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build. Same helper as build-shows.mjs.
//
// ALL SEVENTEEN REAL OUTBOUND LINKS ON THIS PAGE WERE UNLABELLED, which CLAUDE.md
// makes the condition of every outbound link on the site. The nine picture links
// above them were already right and are the reason to be careful reading a count
// here: po-shot carries tabindex="-1" and aria-hidden="true" because it is a
// DUPLICATE of the product name link beside it, so it is correctly absent from
// the AX tree rather than an unnamed link. Do not "fix" those by giving them a
// label; that would put nine duplicate links back into the tab order.
const hostOf = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function preorderBand(setName) {
  const e = preorders[setName];
  if (!e?.products?.length && !e?.chase?.length) return "";
  const worst = e.products.filter((p) => p.overMsrp).sort((a, b) => b.overMsrp - a.overMsrp)[0];

  const prods = e.products.slice(0, 9).map((p) => `        <li class="po">
          <a class="po-shot" href="${esc(p.url)}" rel="noopener" target="_blank" tabindex="-1" aria-hidden="true">
            <img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(p.thumb)} referrerpolicy="no-referrer">
          </a>
          <div class="po-body">
            <h4><a href="${esc(p.url)}" rel="noopener" target="_blank" aria-label="${esc(p.name)}, ${usd(p.price)} preorder, opens on ${esc(hostOf(p.url))}">${esc(p.name)}</a></h4>
            <p class="po-price"><b>${usd(p.price)}</b>${
              p.msrp ? ` <span class="po-msrp">MSRP ${usd(p.msrp)}</span>` : ""
            }</p>
            ${p.overMsrp ? `<p class="po-over">${p.overMsrp}x retail</p>` : ""}
            ${p.listings ? `<p class="po-sellers">${p.listings} seller${p.listings === 1 ? "" : "s"}</p>` : ""}
          </div>
        </li>`).join("\n");

  const cards = e.chase.slice(0, 8).map((c) => `        <li class="poc">
          <a href="${esc(c.url)}" rel="noopener" target="_blank" aria-label="${esc(c.name)}${c.rarity ? `, ${esc(c.rarity)}` : ""}${c.number ? `, card ${esc(c.number)}` : ""}, opens on ${esc(hostOf(c.url))}">
            <img src="${esc(c.thumb)}" alt="${esc(c.name)}" loading="lazy" onerror="this.remove()" decoding="async"${imgDims(c.thumb)} referrerpolicy="no-referrer">
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

// Japanese releases, held apart from the two English lists on purpose. Same
// `future` filter, so Storm Emeralda and the MEGA Starter Set ex Decks (both
// 31 July 2026) fall off exactly as an English entry would.
const japan = doc.japan || {};
const jpSets = (japan.releases || [])
  .filter((r) => future(r.date))
  .sort((a, b) => String(a.date).localeCompare(String(b.date)));

const dropped =
  (doc.sets || []).length -
  sets.length +
  ((doc.products || []).length - extras.length) +
  ((japan.releases || []).length - jpSets.length);

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

// EVERY CARD CARRIES ITS OWN DATE, so the browser can check it. The countdown
// is worked out here, at build time, and then frozen into a static file: "in 13
// days" is true on the day it is written and counts down to nothing on its own
// afterwards, silently going negative in meaning while the words stay put. The
// pass at the bottom of the page redoes the sum from the reader's clock. The
// long date beside it is absolute and never needs correcting.
const setCard = (s) => `      <article class="up-set" data-date="${esc(s.date || "")}">
        <div class="up-head">
          <div>
            <p class="up-when"><b>${longDate(s.date)}</b> <span class="up-cd">${countdown(s.date)}</span></p>
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

const extraCard = (p) => `      <li class="up-extra" data-date="${esc(p.date || "")}">
        <p class="up-when"><b>${longDate(p.date)}</b> <span class="up-cd">${countdown(p.date)}</span></p>
        <h3>${esc(p.name)}</h3>
        <p class="up-blurb">${esc(p.blurb)}</p>
        <p class="up-meta">${[p.packs ? `${p.packs} pack${p.packs === 1 ? "" : "s"}` : null, p.price || null]
          .filter(Boolean)
          .map(esc)
          .join(" &bull; ")}</p>
      </li>`;

// A Japanese release. Same card as extraCard, plus the flag and the badge.
//
// THE FLAG IS ON THE CARD AND NOT ONLY ON THE SECTION, for the reason argued in
// the header: a heading is read once and a card is read wherever it is found.
// It comes FIRST in the date line, before the date itself, so the qualifier is
// read before the thing it qualifies rather than after it.
//
// Prices are printed exactly as the data holds them, in yen with a yen sign,
// and no conversion is done. A dollar figure here would be a rate on the day
// somebody typed it, frozen into a static file, on a page whose entire job is
// not printing numbers that quietly stop being true.
const japanCard = (r) => `      <li class="up-extra up-jp" data-date="${esc(r.date || "")}">
        <p class="up-when"><span class="up-jp-flag">Japan only</span>
          <b>${longDate(r.date)}</b> <span class="up-cd">${countdown(r.date)}</span></p>
        <h3>${esc(r.name)}</h3>
        <p class="up-blurb">${esc(r.blurb)}</p>
        ${r.price ? `<p class="up-meta">${esc(r.price)}</p>` : ""}
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
.up-tag.ok{background:var(--mustard);color:var(--on-accent);border:1px solid var(--gold-deep)}
.up-tag.win{background:var(--lilac-pale);color:var(--plum);border:1px solid rgba(245,197,213,.35)}
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

/* The Japanese calendar. Its own section, its own lede, and a flag on every
   card; the header of this file argues why the card-level flag is not redundant
   with the heading sitting above it.

   PINK, NOT TEAL, AND THAT IS THE ACCENT RULE RATHER THAN TASTE. Teal is how
   you get around this site and pink is what the site is SAYING, so a flag that
   goes nowhere is pink, exactly like the NEW and #1 HIT flags. It is the SMALL
   pink, --ketchup-deep, because this chip is var(--t-micro) and nowhere near
   the 24px at which #E87EA1's 3.45:1 would be allowed to stand. ui.css has
   already measured the pair beside its own token: --ketchup-deep is 6.25:1 on
   --page, so the chip clears AA on the well it sits in, and --page inside a
   --card is the documented inset rather than a lighter surface.

   .up-when goes flex here because the line now carries three things. It was a
   plain block with two, and at 390 the flag and the date collided in the same
   way .up-key's label and badge did before that rule was written. */
/* WIDER TRACKS THAN .up-extras, AND THE REASON IS THE NAMES RATHER THAN THE
   COUNT. The English extras are called things like "Mini Portfolio" and
   "Ascended Heroes Tin" and sit happily in a 266px card. A Japanese product is
   named after everything in it: "Special Deck Set, Mega Feraligatr ex, Mega
   Dragonite ex and Mega Gengar ex" took FOUR display lines of heading in a
   266px track at 1440, measured, which is a heading taller than some of the
   blurbs under it.

   min(400px,100%) AND NOT A BARE 400px. minmax(400px,1fr) makes the track floor
   400 even when the wrap is 342 at 390, so the grid hangs off the right edge on
   the narrowest phone. The min() clamps the floor to the space that exists.

   IT ALSO HAPPENS TO FILL EVENLY TODAY AND THAT IS A COINCIDENCE, NOT THE
   POINT. 1,392px of content at a 16px gap gives three tracks, and there are six
   Japanese releases, so it lands 3x2 with no hole. A seventh entry makes the
   last row ragged again, exactly like every other grid on this site. Do not
   re-tune this number to keep the last row full: that is fitting the layout to
   whatever the data happens to hold this week. */
.up-jp-grid{grid-template-columns:repeat(auto-fill,minmax(min(400px,100%),1fr))}
.up-jp-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}
.up-jp .up-when{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.up-jp-flag{flex:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;padding:4px 8px;border-radius:var(--r-pill);
  background:var(--page);color:var(--ketchup-deep);border:1px solid var(--ketchup-deep)}
/* Mono at var(--t-micro), so it is the .up-foot case and NOT the .up-lede one:
   it is deliberately absent from the measure block at the foot of this file.
   Read that block's comment before "fixing" this width. */
.up-jp-src{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  margin-top:var(--s4);max-width:56em}

/* Live preorder prices, product photos and revealed cards. */
.po-wrap{margin-top:var(--s4);border-top:1px solid var(--hair);padding-top:var(--s4)}
.po-count{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:var(--s3)}
/* The point of the whole band. Loud on purpose: it is the one number that
   changes whether somebody should preorder. */
.po-warn{background:var(--lilac-pale);border:1px solid rgba(245,197,213,.35);border-radius:var(--r);
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

/* Already out, worked out in the browser rather than at build time. The card
   stays on the page because it is still information, but it stops standing in
   the queue of things that have not happened: it moves to the end of its list
   and the countdown is replaced by what is now true. No transition on any of
   this, deliberately: the whole site honours prefers-reduced-motion, and a card
   silently in a different place on load needs no animation to explain it. */
.up-cd.out{color:var(--plum);background:var(--lilac-pale);border:1px solid rgba(245,197,213,.35);
  border-radius:var(--r-pill);padding:2px 8px}
.up-set.is-out,.up-extra.is-out{border-style:dashed}

/* The page with nothing on it. It was an h1, a lede, a legend and a void. */
.up-none{background:var(--card);border:1px dashed var(--ink-2);border-radius:var(--r);
  padding:var(--s5);max-width:46em}
.up-none h2{font:400 var(--t-l)/1.1 var(--display);margin-bottom:var(--s3)}
.up-none p{color:var(--ink-2);line-height:1.6}
.up-none p + p{margin-top:var(--s3)}
.up-none a{text-decoration:underline}

/* DESKTOP READING MEASURE. The caps above were written in em as if 1em were
   one character. It is not: Outfit runs 2.31 to 2.47 characters per em here,
   so 42 to 46em bought .up-lede 92 and .up-blurb 95 real characters a line at
   1440. ui.css already caps main prose at var(--measure) and these rules only
   outranked it by landing after the stylesheet. All min-width:1000, ui.css's
   own desktop breakpoint, so the phone and the tablet range keep exactly the
   rules they had.

   .up-foot IS DELIBERATELY NOT IN HERE AND ITS 56em IS NOT THE SAME MISTAKE.
   It is Space Mono at 11px, and mono runs about 1.77 characters per em rather
   than Outfit's 2.31, so its 616px box measures 87 to 89 real characters and
   not one line over 90. Capping it to 36em would take it to about 57 and make
   it worse. Same reason ui.css keeps .price-note on its own 52em: the font is
   what decides how many characters an em width buys. The identical block at
   the foot of build-rarity.mjs, .rg-foot, was left alone for the same reason.
   Measured, 1440x900, 16 August 2026. */
@media(min-width:1000px){
.up-lede,.up-blurb,.up-jp-lede{max-width:var(--measure)}
}
`;

// THE PAGE HAD NO EMPTY STATE AND EXITED 0 WITHOUT ONE.
//
// data/upcoming.json is maintained by hand and runs out: the last dated entry
// in it today is 6 November 2026. Everything past that date is filtered out by
// `future` above, so once the file is exhausted this page rendered an h1, a
// lede, a legend for badges that were not on the page, and then a void. The
// build printed a friendly note to a console nobody reads and returned success,
// so nothing anywhere said the page was empty.
//
// It is in the markup on every build, hidden when there is something to show,
// because the browser pass below needs it too: a reader can arrive after the
// last entry has come out even though the entries were all in the future when
// the page was built, and that is the same blank page arrived at a different
// way. Links go to pages that are still true when this one has nothing.
const emptyState = `      <div class="up-none" id="upNone"${sets.length || extras.length ? " hidden" : ""}>
        <h2>Nothing on the calendar right now</h2>
        <p>Every release this page was tracking has come out. No English set after them has been
          named or dated, and this page does not print a set name nobody has announced, so there is
          nothing honest to put here yet. It fills up again the moment The Pokemon Company says
          something.</p>
        <p>In the meantime: <a href="/sets/">the set guides</a> cover what is already out,
          <a href="/drops.html">drops</a> is where stock is expected to turn up, and
          <a href="/pack-prices.html">pack prices</a> is what a pack costs before anyone marks it up.</p>${
          // THIS BOX IS ABOUT THE ENGLISH LISTS AND SAYS SO. It is shown when
          // the two English arrays are both empty, and the Japanese list is
          // neither of those, so it can quite correctly appear above a Japanese
          // section that still has entries on it. Without this line that reads
          // as a contradiction: a heading saying nothing is on the calendar,
          // directly above a calendar. It is not a contradiction, it is the
          // page being precise about which calendar it means, so it says which.
          jpSets.length
            ? `
        <p>Japan is a separate calendar and it is <a href="#upJapanBand">still filling</a>: those
          dates are Japanese releases, not English ones.</p>`
            : ""
        }
      </div>`;

const body = `
<main id="main">
  <section class="up">
    <div class="wrap">
      <div class="brk"><h1>What is <span class="hl">coming next</span></h1><span class="ln"></span></div>
      <p class="up-lede">Every announced English Pokemon TCG release, with what is actually in it.
        Dates say how well known they are, because a confirmed date and a shop's guess are not the
        same thing and most sites print them identically.</p>
      ${
        // The legend explains three badges. With nothing on the page it explained
        // nothing, directly above the void it was standing in for.
        sets.length || extras.length
          ? `<div class="up-key">
        <span>${badge("confirmed")} straight from The Pokemon Company</span>
        <span>${badge("window")} an official month, no exact day</span>
        <span>${badge("expected")} what the last set had, not an announcement</span>
      </div>`
          : ""
      }

      <div class="up-list" id="upList" data-today="${esc(TODAY)}">
${sets.map(setCard).join("\n")}
      </div>
${emptyState}
    </div>
  </section>

  ${
    extras.length
      ? `<section class="band tight">
    <div class="wrap">
      <h2>Other things with a <span class="hl">date on them</span></h2>
      <p class="up-blurb" style="margin-bottom:var(--s4)">Tins, blisters and collections that are not
        full expansions but are worth knowing about.</p>
      <ul class="up-extras" id="upExtras">
${extras.map(extraCard).join("\n")}
      </ul>
    </div>
  </section>`
      : ""
  }

  ${
    jpSets.length
      ? `<section class="band tight" id="upJapanBand">
    <div class="wrap">
      <h2>Out in <span class="hl">Japan first</span></h2>
      <p class="up-jp-lede">Japan gets most of this months before we do, and we collect the Japanese
        cards too, so here is Japan's own calendar. <b>Every date in this section is a Japanese
        release date.</b> None of them is the English street date, and a Japanese set is not simply
        the English set early: Delta Reign above is being built out of more than one Japanese
        release, so the two calendars do not line up card for card either. The English dates are the
        two sections above this one.</p>
      <ul class="up-extras up-jp-grid" id="upJapan">
${jpSets.map(japanCard).join("\n")}
      </ul>
      <p class="up-jp-src">JAPANESE DATES AND PRICES REPORTED BY POKEBEACH, READ ${esc(
        longDate(japan.checked || doc.checked).toUpperCase()
      )}. PRICES ARE IN YEN AND ARE NOT CONVERTED: A DOLLAR FIGURE HERE WOULD BE THE EXCHANGE RATE ON
        THE DAY IT WAS TYPED, FROZEN INTO THE PAGE.</p>
    </div>
  </section>`
      : ""
  }

  <section class="tight">
    <div class="wrap">
      <p class="up-foot">CHECKED ${esc(longDate(doc.checked).toUpperCase())}. NOTHING BEYOND THE SETS
        ABOVE HAS BEEN ANNOUNCED: NO ENGLISH SET AFTER THEM HAS BEEN NAMED OR DATED, SO THIS PAGE
        DOES NOT LIST ONE. JAPANESE SETS OFTEN COME OUT MONTHS EARLIER AND ARE NOT THE SAME RELEASE,
        SO THEY ${
          jpSets.length
            ? "GET THEIR OWN SECTION ABOVE AND ARE NEVER MIXED INTO THE ENGLISH LISTS"
            : "ARE NOT ON HERE EITHER"
        }. DATES SLIP. IF YOU SPOT ONE THAT HAS CHANGED, SAY SO ON ANY
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
<title>Upcoming Pokemon TCG Sets ${new Date(TODAY).getFullYear()}: Release Dates and Products</title>
<meta name="description" content="Every announced English Pokemon TCG set and product with its release date${
  nextUp ? `, next up ${nextUp.name} on ${longDate(nextUp.date)}` : ""
}. Confirmed dates marked apart.">
<link rel="canonical" href="${SITE}/upcoming.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Upcoming Pokemon TCG Sets and Release Dates">
<meta property="og:description" content="Every announced English Pokemon TCG release, with what is in it and how confirmed the date is.">
<meta property="og:url" content="${SITE}/upcoming.html">
<meta property="og:image" content="${SITE}/assets/og-upcoming.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-upcoming.jpg">
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
<script>
(function () {
  // BELT AND BRACES ON THE COUNTDOWNS, the same idea as the date sweep at the
  // bottom of /card-shows.html.
  //
  // The build drops anything already released and writes "in 13 days" next to
  // everything else. Both facts are true at the moment of the build and neither
  // is checked again, so a deploy that sits still keeps counting down to a day
  // that has been and gone: the page goes on calling a released set upcoming,
  // in the present tense, with a number attached.
  //
  // PROGRESSIVE ENHANCEMENT. With JS off the server's own answer stands and the
  // page is complete. Nothing here is animated: cards move on load, before
  // first paint of the section, so there is nothing to transition and no
  // reduced-motion case to honour.
  var list = document.getElementById("upList");
  if (!list) return;
  // The later of the build's clock and the reader's, so a reader whose clock is
  // behind the build cannot resurrect something the build already knew was out.
  var built = list.getAttribute("data-today") || "";
  // COMPARE LOCAL MIDNIGHTS, NOT UTC ONES. This read the reader's "today" from
  // toISOString(), which is the UTC date, while anchoring each published date
  // at UTC midnight. West of Greenwich those disagree for the last hours of
  // every evening: at 9pm in Rochester it is already tomorrow in UTC, so every
  // date on the page aged by a day and the hero said "Yesterday's Rip" over a
  // video published that morning. Four hours a night, five in winter, in the
  // owner's own timezone. Both sides are local now.
  function localDay(iso) {
    var p = String(iso || "").split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).getTime();
  }
  function todayLocal() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  }
  function todayIso() {
    var n = new Date();
    var m = n.getMonth() + 1, d = n.getDate();
    return n.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d;
  }
  var today = todayIso();
  if (built > today) today = built;
  var t0 = localDay(today);

  // Kept in step with countdown() in scripts/build-upcoming.mjs.
  function countdown(days) {
    if (days <= 0) return "out now";
    if (days === 1) return "tomorrow";
    if (days < 14) return "in " + days + " days";
    if (days < 60) return "in " + Math.round(days / 7) + " weeks";
    return "in " + Math.round(days / 30.44) + " months";
  }

  var dated = 0, out = 0;
  // THE JAPANESE BOX IS SWEPT LIKE THE OTHER TWO AND COUNTED LIKE NEITHER.
  // Its countdowns and its already-out marking have to be redone on the
  // reader's clock for exactly the same reason the English ones do. But dated
  // and out feed the empty state, and that box speaks about the ENGLISH lists
  // in its own words: counting Japanese rows into the tally would hold "nothing
  // on the calendar" back until Japan had run dry too, which is a different
  // claim from the one the box actually makes.
  [list, document.getElementById("upExtras"), document.getElementById("upJapan")].forEach(function (box, i) {
    if (!box) return;
    var counts = i < 2;
    var past = [];
    [].slice.call(box.querySelectorAll("[data-date]")).forEach(function (card) {
      var iso = card.getAttribute("data-date");
      // \\d, NOT \\d ONCE. This whole script is inside a template literal in
      // scripts/build-upcoming.mjs, so a single backslash is eaten before the
      // page is written and the pattern ships as /^d{4}-d{2}-d{2}$/, which
      // matches nothing. Every card was skipped and the sweep did nothing at
      // all, silently, on a page that looked fine because the server render is
      // meant to look fine.
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) return;
      if (counts) dated++;
      var days = Math.round((localDay(iso) - t0) / 86400000);
      var cd = card.querySelector(".up-cd");
      if (cd) cd.textContent = countdown(days);
      if (days > 0) return;
      if (counts) out++;
      // Marked, and moved to the end of its own list. Leaving it in date order
      // at the top puts the one thing that is not coming next in the position
      // reserved for what is.
      card.className += " is-out";
      if (cd) cd.className += " out";
      past.push(card);
    });
    past.forEach(function (card) { box.appendChild(card); });
  });

  // Everything on the page has come out. Same state the build renders when
  // data/upcoming.json is exhausted, reached from the other direction.
  var none = document.getElementById("upNone");
  if (none && dated && out === dated) none.hidden = false;
})();
</script>

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/upcoming.html"), html);

console.log(`Wrote public/upcoming.html
  ${sets.length} upcoming set(s), ${extras.length} other product(s)
  ${jpSets.length} Japanese release(s), in their own labeled section
  ${dropped} entr(y/ies) already released and filtered out
  next up: ${nextUp ? `${nextUp.name}, ${longDate(nextUp.date)} (${countdown(nextUp.date)})` : "nothing"}`);
if (!sets.length && !extras.length) {
  console.log(`
  Everything in data/upcoming.json has already come out. Add the next
  announcements there, and only ones with an official name.`);
}
