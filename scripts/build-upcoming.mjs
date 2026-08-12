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
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer } from "../shared/chrome.mjs";
import { esc, longDate, MONTHS_LONG } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const doc = JSON.parse(await readFile(join(ROOT, "data/upcoming.json"), "utf8"));

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

const ld = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Upcoming Pokemon TCG sets and products",
  description: "Announced English Pokemon Trading Card Game releases with confirmed dates.",
  url: `${SITE}/upcoming.html`,
  itemListElement: [...sets, ...extras].map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: s.name,
  })),
};

const nextUp = sets[0] || extras[0];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upcoming Pokemon TCG Sets ${new Date(TODAY).getFullYear()}: Release Dates and Products | Garbage Rips 585</title>
<meta name="description" content="Every announced English Pokemon TCG set and product with its release date${
  nextUp ? `, starting with ${nextUp.name} on ${longDate(nextUp.date)}` : ""
}. Confirmed dates marked apart from expected ones.">
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
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer(`Release dates checked ${longDate(doc.checked)}. Dates come from The Pokemon Company unless marked otherwise.`)}

<script src="/assets/app.js" defer></script>
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
