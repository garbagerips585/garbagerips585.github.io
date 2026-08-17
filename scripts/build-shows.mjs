#!/usr/bin/env node
// Generate /card-shows.html, the local card show calendar.
//
//   node scripts/build-shows.mjs
//
// Reads data/shows.json. Everything on the page came off a real listing and
// carries the link it came from, because there is no card show API and the
// aggregators that exist disagree with each other often enough to matter.
//
// NOTE THE URL. /card-shows.html, not /shows.html, because /shops.html already
// exists for card SHOPS and the two would be one typo apart forever. It also
// happens to be the better search target: people type "card shows near me".
//
// PAST EVENTS ARE HANDLED TWICE, on purpose. The build drops anything already
// gone, and the page hides stragglers again on load. The build filter alone
// would be enough only if the site rebuilt every single day; the nightly does,
// but the client pass means a stale deploy still never shows somebody a date
// that has already been and gone, which on this page is the one unforgivable
// bug. The client pass is also why the empty state is written in HTML rather
// than decided at build time.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
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
import { esc, longDate, MONTHS_LONG } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8"));

const TODAY = new Date().toISOString().slice(0, 10);

const REGIONS = [
  { id: "all", label: "All" },
  { id: "roc", label: "Rochester" },
  { id: "buffalo", label: "Buffalo & Niagara" },
  { id: "syracuse", label: "Syracuse" },
];

/** "10:00" -> "10am", "16:30" -> "4:30pm". */
function clock(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, "0")}${ampm}` : `${hr}${ampm}`;
}
const timeRange = (s, e) => [clock(s), clock(e)].filter(Boolean).join(" to ");

/**
 * Eastern offset for a given date: -04:00 in daylight time, -05:00 in standard.
 * This was hardcoded to -04:00, which is wrong for every show from November on,
 * and there are eight of those. Google reads these times literally, so it was
 * advertising those shows an hour early while the page itself showed the right
 * time. US DST runs from the second Sunday in March to the first Sunday in
 * November.
 */
function tzOffset(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const y = d.getUTCFullYear();
  const nth = (month, weekday, n) => {
    const first = new Date(Date.UTC(y, month, 1));
    const shift = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(y, month, 1 + shift + (n - 1) * 7));
  };
  const start = nth(2, 0, 2); // second Sunday in March
  const end = nth(10, 0, 1); // first Sunday in November
  return d >= start && d < end ? "-04:00" : "-05:00";
}

/** Days from today, for the "this weekend" style nudge. */
function daysAway(iso) {
  const d = Math.round((new Date(iso + "T12:00:00") - new Date(TODAY + "T12:00:00")) / 86400000);
  if (d < 0) return null;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return `In ${d} days`;
  return null;
}

const weekday = (iso) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(iso + "T12:00:00").getDay()
  ];

/** A maps link built from the venue and city. Never an address we made up. */
const mapLink = (s) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [s.address || s.venue, s.address ? "" : s.city, s.address ? "" : "NY"].filter(Boolean).join(" ")
  )}`;

// The page covers three metro areas and nothing else. These feeds are regional
// and cheerfully mix in the Southern Tier, and a national search for "Rochester
// Pokemon league" returns Rochester MINNESOTA and Rochester MICHIGAN before it
// returns ours, so an out-of-area entry is a question of when, not whether.
// Anything not on this list stops the build rather than quietly telling somebody
// in the 585 to drive to another state.
const AREA = new Set([
  // Rochester and its ring
  "Rochester", "Fairport", "Henrietta", "Webster", "Greece", "Penfield", "Victor",
  "Batavia", "Canandaigua", "Brockport", "Pittsford",
  // Buffalo and Niagara
  "Buffalo", "Depew", "Sanborn", "Niagara Falls", "Amherst", "Cheektowaga",
  "Lancaster", "Hamburg", "Lockport", "Williamsville", "Tonawanda",
  // Syracuse and its ring
  "Syracuse", "Liverpool", "Cicero", "Camillus", "Baldwinsville", "East Syracuse",
]);
const strays = (data.shows || []).filter((s) => !AREA.has(s.city));
if (strays.length) {
  console.error(
    `${strays.length} show(s) outside the Rochester, Buffalo and Syracuse areas:\n` +
      strays.map((s) => `  ${s.id}: ${s.city}`).join("\n") +
      `\n\nEither drop them from data/shows.json or, if the city really is local, add it to AREA in this script.`
  );
  process.exit(1);
}

const upcoming = (data.shows || [])
  .filter((s) => s.date >= TODAY)
  .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));

// Group by calendar month so the page reads like a calendar rather than a list.
const byMonth = [];
for (const s of upcoming) {
  const key = s.date.slice(0, 7);
  let g = byMonth.find((x) => x.key === key);
  if (!g) byMonth.push((g = { key, label: `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`, shows: [] }));
  g.shows.push(s);
}

const next = upcoming[0] || null;
const pokemonCount = upcoming.filter((s) => s.pokemon).length;

// ---------------------------------------------------------------- the calendar
//
// A PAGE CALLED A CALENDAR THAT WAS NOT ONE. This page held 1,081 words and a
// single decorative flower, and the thing it is for is a question a list
// answers badly: which Saturdays are free, where the gaps are, and which day has
// two shows on it. So the months get drawn, from the same `upcoming` array the
// list below is built from. No new data, no new source, no new claim: it is the
// list, arranged the way a calendar arranges things.
//
// DRAWN, NOT PHOTOGRAPHED, because there is nothing to photograph. The flyer
// slot in data/shows.json has been empty since the file was written, and a stock
// picture of some cards on a table would be an illustration of nothing.
//
// MONOCHROME BECAUSE THE PALETTE IS. There is exactly one accent on this site
// and it is gold, so a three-colour key for the three regions is not available
// and was not faked with three greys nobody could tell apart. Region is handled
// by the filter chips instead, which already exist and which this now moves
// with; the marks themselves carry the distinction that matters on a Pokemon
// channel, which is whether the whole floor is Pokemon.
const CAL_W = 25; // day column
const CAL_H = 23; // day row
const CAL_TOP = 15; // room for the S M T W T F S header

/** Every month from the month we are in to the month of the last show. */
function calMonths() {
  if (!upcoming.length) return [];
  const start = new Date(`${TODAY.slice(0, 7)}-01T12:00:00Z`);
  const last = new Date(`${upcoming[upcoming.length - 1].date.slice(0, 7)}-01T12:00:00Z`);
  const out = [];
  for (let d = start; d <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12))) {
    out.push({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }
  return out;
}
const CAL = calMonths();

const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const firstDow = (y, m) => new Date(Date.UTC(y, m, 1)).getUTCDay();
const rowsFor = (y, m) => Math.ceil((firstDow(y, m) + daysIn(y, m)) / 7);

// One height for every month so the row of them does not come out ragged. Five
// rows covers all five months as this is written, but a month that starts on a
// Saturday and runs 31 days needs six, so it is computed rather than assumed.
const CAL_ROWS = CAL.reduce((n, { y, m }) => Math.max(n, rowsFor(y, m)), 0);
const CAL_VB_H = CAL_TOP + CAL_ROWS * CAL_H;

/** Shows keyed by ISO date, so a day can carry two. */
const showsOn = new Map();
for (const s of upcoming) {
  if (!showsOn.has(s.date)) showsOn.set(s.date, []);
  showsOn.get(s.date).push(s);
}

const ordinal = (n) =>
  n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

/**
 * One month, drawn.
 *
 * `role="img"` with a written label, rather than leaving 31 loose numbers for a
 * screen reader to read out one at a time. Everything in here is also in the
 * list below, in sentences, so the picture is the redundant copy and the label
 * only has to say what it shows.
 */
function calMonth({ y, m }) {
  const dim = daysIn(y, m);
  const off = firstDow(y, m);
  const label = `${MONTHS_LONG[m]} ${y}`;
  const cells = [];
  const hits = [];
  for (let day = 1; day <= dim; day++) {
    const i = off + day - 1;
    const col = i % 7;
    const row = Math.floor(i / 7);
    const cx = col * CAL_W + CAL_W / 2;
    const top = CAL_TOP + row * CAL_H;
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const list = showsOn.get(iso) || [];
    const past = iso < TODAY;
    if (list.length) hits.push(list.length > 1 ? `${ordinal(day)} (two)` : ordinal(day));
    const dots = list
      .map((s, n) => {
        const spread = (n - (list.length - 1) / 2) * 7;
        return `<circle class="cal-dot${s.pokemon ? " pk" : ""}" data-region="${esc(s.region || "")}"
            data-date="${esc(iso)}" cx="${(cx + spread).toFixed(1)}" cy="${top + 17.5}" r="2.7"></circle>`;
      })
      .join("");
    cells.push(
      `<g class="cal-d${list.length ? " has" : ""}${
        list.some((s) => s.featured) ? " feat" : ""
      }${past ? " is-past" : ""}" data-date="${esc(iso)}">` +
        (list.length
          ? `<rect class="cal-pill" x="${cx - 10.5}" y="${top + 1}" width="21" height="20" rx="5"></rect>`
          : "") +
        `<text class="cal-n" x="${cx}" y="${top + 10}">${day}</text>${dots}</g>`
    );
  }
  const head = ["S", "M", "T", "W", "T", "F", "S"]
    .map((d, i) => `<text class="cal-dow" x="${i * CAL_W + CAL_W / 2}" y="7">${d}</text>`)
    .join("");
  const aria = hits.length
    ? `${label}: shows on the ${hits.join(", the ")}.`
    : `${label}: nothing listed yet.`;
  return `<figure class="cal-m">
          <figcaption>${esc(label)}</figcaption>
          <svg viewBox="0 0 ${CAL_W * 7} ${CAL_VB_H}" role="img" aria-label="${esc(aria)}">
            ${head}
            ${cells.join("\n            ")}
          </svg>
        </figure>`;
}

const calDays = showsOn.size;
const calDouble = [...showsOn.values()].filter((v) => v.length > 1).length;

// ---------------------------------------------------------------- flyer check

// A flyer named in the data but missing on disk would render as a broken box on
// the most visual part of the page, so it is checked here rather than trusted.
const missingFlyers = [];
const flyerSrc = (s) => {
  if (!s.flyer) return null;
  const rel = `assets/shows/${s.flyer}`;
  if (existsSync(join(ROOT, "public", rel))) return `/${rel}`;
  missingFlyers.push(`${s.id}: public/${rel} not found`);
  return null;
};

// ------------------------------------------------------------------ structured

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Card shows" },
    ],
  },
  ...upcoming.map((s) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: s.name,
    startDate: s.start ? `${s.date}T${s.start}:00${tzOffset(s.date)}` : s.date,
    ...(s.end ? { endDate: `${s.date}T${s.end}:00${tzOffset(s.date)}` } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: s.venue,
      address: {
        "@type": "PostalAddress",
        ...(s.address ? { streetAddress: s.address.split(",")[0] } : {}),
        addressLocality: s.city,
        addressRegion: "NY",
        addressCountry: "US",
      },
    },
    // Offers only where a real price exists. A free show is price 0; a show with
    // ticket tiers lists each one; a show whose admission was never stated gets
    // no offers block at all, rather than a made up zero that would show as
    // "Free" in a search result.
    ...((s.tiers || []).length
      ? {
          offers: s.tiers.map((t) => ({
            "@type": "Offer",
            name: t.name,
            price: String(t.price).replace(/[^0-9.]/g, ""),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: s.ticketUrl || s.url,
          })),
        }
      : s.admission === "Free"
        ? {
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: s.url,
            },
          }
        : {}),
    ...(s.url ? { url: s.url } : {}),
  })),
];

const desc =
  `Every upcoming Pokemon and trading card show near Rochester, Buffalo and Syracuse NY. ` +
  `${upcoming.length} shows with dates, venues and admission, checked ${longDate(data.checked) || data.checked}.`;

const head = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Card Shows Near Rochester NY: Buffalo & Syracuse Calendar | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/card-shows.html">
<meta property="og:title" content="Card shows near Rochester, Buffalo and Syracuse">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/card-shows.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-card-shows.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-card-shows.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
${/* Inline, not in ui.css: this page is the only user and ui.css is render
      blocking on all 426 pages. The set guides already work this way. */ ""}
<style>
.cal-wrap{margin:var(--s5) 0 0}
.cal-grid{display:grid;gap:var(--s4);grid-template-columns:repeat(auto-fit,minmax(148px,1fr));
  align-items:start}
.cal-m{margin:0}
.cal-m figcaption{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-2);margin-bottom:6px}
.cal-m svg{display:block;width:100%;height:auto;overflow:visible}
.cal-dow{font:700 7px/1 var(--mono);fill:var(--ink-2);text-anchor:middle;letter-spacing:.02em}
.cal-n{font:400 9.5px/1 var(--mono);fill:var(--ink-2);text-anchor:middle}
.cal-d.has .cal-n{font-weight:700;fill:var(--ink)}
.cal-pill{fill:var(--chip-gold-bg)}
.cal-d.feat .cal-pill{stroke:var(--ink);stroke-width:1.4}
.cal-dot{fill:var(--ink)}
.cal-dot.pk{fill:var(--gold);stroke:var(--gold-deep);stroke-width:.8}
/* Dimmed rather than removed: a month with the first half greyed out is how
   you see at a glance where in it you are standing. */
.cal-d.is-past{opacity:.36}
/* Toggled by the filter below, which drives the calendar and the list together.
   display:none rather than the hidden attribute, which SVG elements do not
   reliably honour. */
.cal-dot.is-off{display:none}
.cal-d.is-empty .cal-pill{display:none}
.cal-d.is-empty .cal-n{font-weight:400;fill:var(--ink-2)}
.cal-key{display:flex;flex-wrap:wrap;gap:var(--s2) var(--s4);margin-top:var(--s3);
  font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2)}
.cal-key span{display:inline-flex;align-items:center;gap:6px}
.cal-key i{width:9px;height:9px;border-radius:50%;background:var(--ink);flex:none}
.cal-key i.pk{background:var(--gold);border:1px solid var(--gold-deep)}
.cal-key i.day{width:16px;height:15px;border-radius:4px;background:var(--chip-gold-bg)}
.cal-note{margin-top:var(--s2);font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2);
  max-width:44em}

/* DESKTOP READING MEASURE. 44em was written as if 1em were one character. It
   is not: Outfit at 11px runs about 2.31 characters per em, so that 484px box
   measured 95 real characters a line at 1440. ui.css already caps main prose
   at var(--measure) and this rule only outranked it by landing after the
   stylesheet. min-width:1000 is ui.css's own desktop breakpoint, so the phone
   and the tablet range keep exactly the rule they had. Note this is the body
   face, not the mono one: the same 44em on Space Mono would be about 78
   characters and would need leaving alone. */
@media(min-width:1000px){
.cal-note{max-width:var(--measure)}
}
</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
`;

/** One event card. */
function showCard(s) {
  const flyer = flyerSrc(s);
  const soon = daysAway(s.date);
  const d = new Date(s.date + "T12:00:00");
  return `      <article class="show${s.featured ? " is-featured" : ""}" data-region="${esc(s.region || "")}" data-date="${esc(s.date)}"${s.pokemon ? ' data-pokemon="1"' : ""}>
        <div class="show-when" aria-hidden="true">
          <span class="show-mon">${MONTHS_LONG[d.getMonth()].slice(0, 3)}</span>
          <span class="show-day">${d.getDate()}</span>
        </div>
        <div class="show-body">
          ${s.featured ? `<p class="show-flag">The big one</p>` : ""}
          <h3>${esc(s.name)}</h3>
          <p class="show-meta">${esc(weekday(s.date))}${
            timeRange(s.start, s.end) ? ` &bull; ${esc(timeRange(s.start, s.end))}` : ""
          }</p>
          <p class="show-where"><a href="${esc(mapLink(s))}" rel="noopener" target="_blank">${esc(s.venue)}, ${esc(s.city)} NY</a></p>
          <div class="show-tags">
            ${s.pokemon ? `<span class="chip pk">Pokemon show</span>` : ""}
            ${soon ? `<span class="chip soon">${esc(soon)}</span>` : ""}
            <span class="chip">${s.admission ? esc(s.admission) : "Check the listing"}</span>
          </div>
          ${s.blurb ? `<p class="show-blurb">${esc(s.blurb)}</p>` : ""}
          ${(s.tiers || []).length ? `<ul class="tiers">
            ${s.tiers.map((t) => `<li>
              <span class="tier-price">${esc(t.price)}</span>
              <span class="tier-name">${esc(t.name)}${t.from ? ` <span class="tier-from">from ${esc(clock(t.from))}</span>` : ""}</span>
              ${t.note ? `<span class="tier-note">${esc(t.note)}</span>` : ""}
            </li>`).join("\n            ")}
          </ul>` : ""}
          ${s.warn ? `<p class="show-warn">${esc(s.warn)}</p>` : ""}
          <p class="show-links">
            ${s.ticketUrl ? `<a class="tickets" href="${esc(s.ticketUrl)}" rel="noopener" target="_blank">Get tickets <span aria-hidden="true">&rarr;</span></a>` : ""}
            ${s.url ? `<a href="${esc(s.url)}" rel="noopener" target="_blank">${s.organiserUrl && s.url === s.organiserUrl ? "Official site" : "Listing &amp; details"}</a>` : ""}
            ${s.organiserUrl && s.organiserUrl !== s.url ? `<a href="${esc(s.organiserUrl)}" rel="noopener" target="_blank">${esc(s.organiser || "Organizer")}</a>` : ""}
          </p>
        </div>
        ${flyer ? `<a class="show-flyer" href="${esc(flyer)}" target="_blank" rel="noopener">
          <img src="${esc(flyer)}" alt="Flyer for ${esc(s.name)}, ${esc(longDate(s.date) || s.date)}" loading="lazy">
        </a>` : ""}
      </article>`;
}

const page = head + `
<header class="set-hero">
  <div class="wrap">
    <span class="kicker">585 &bull; Get out of the house</span>
    <h1>Card <span class="hl">shows</span> near Rochester</h1>
    <p class="lede" style="max-width:36em">Every card show we can find within driving distance of Rochester, Buffalo
      and Syracuse. Dates, times, where to park yourself, and what it costs to get in. Built because working this out
      every month from six different Facebook pages is genuinely annoying.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Card shows</p>
${next ? `
    <a class="next-show" data-date="${esc(next.date)}" href="${esc(next.url || "#list")}"${next.url ? ' rel="noopener" target="_blank"' : ""}>
      <span class="next-label">Next one up${daysAway(next.date) ? ` &bull; ${esc(daysAway(next.date))}` : ""}</span>
      <span class="next-name">${esc(next.name)}</span>
      <span class="next-meta">${esc(longDate(next.date) || next.date)}${
        timeRange(next.start, next.end) ? `, ${esc(timeRange(next.start, next.end))}` : ""
      } &bull; ${esc(next.venue)}, ${esc(next.city)}</span>
    </a>` : ""}

    <div class="facts" style="margin-top:20px">
      <div class="fact"><div class="n">${upcoming.length}</div><div class="l">Shows coming up</div></div>
      <div class="fact"><div class="n">${pokemonCount}</div><div class="l">All Pokemon shows</div></div>
      <div class="fact"><div class="n">${upcoming.filter((s) => s.admission === "Free").length}</div><div class="l">Free to get in</div></div>
      <div class="fact wide"><div class="n" style="font-size:1.15rem">${esc(longDate(data.checked) || data.checked)}</div><div class="l">Listings last checked</div></div>
    </div>
  </div>
</section>

<section class="tight" id="list">
  <div class="wrap">
    <div class="rail">
      <div class="rail-in" role="group" aria-label="Filter by area">
        ${REGIONS.map((r) => `<button class="chip filt" type="button" data-region="${r.id}"${r.id === "all" ? ' aria-current="true"' : ""}>${esc(r.label)}</button>`).join("\n        ")}
      </div>
    </div>
${CAL.length ? `
    <div class="cal-wrap">
      <div class="cal-grid">
        ${CAL.map(calMonth).join("\n        ")}
      </div>
      <p class="cal-key">
        <span><i class="day"></i>a day with a show</span>
        <span><i></i>a card show</span>
        <span><i class="pk"></i>an all Pokemon show</span>
        <span><i class="day" style="background:none;border:1.4px solid var(--ink)"></i>the big one</span>
      </p>
      <p class="cal-note">${upcoming.length} show${upcoming.length === 1 ? "" : "s"} on
        ${calDays} day${calDays === 1 ? "" : "s"}${
          calDouble ? `, ${calDouble === 1 ? "one day" : `${calDouble} days`} with two of them` : ""
        }. Same list as below, drawn. The area buttons above move both.</p>
    </div>` : ""}

    <div id="showList">
${byMonth
  .map(
    (g) => `    <div class="show-month" data-month="${esc(g.key)}">
      <h2 class="show-mon-h">${esc(g.label)}</h2>
${g.shows.map(showCard).join("\n")}
    </div>`
  )
  .join("\n")}
    </div>
    <p class="show-empty" id="showEmpty" hidden>Nothing listed in that area yet. Try another, or send us one.</p>
  </div>
</section>
${(data.watchFor || []).length ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>No date yet</p>
    <h2>Worth <span class="hl">watching for</span></h2>
    <p class="lede intl-lede">Real shows that run round here but have not announced their next date. Worth a follow so
      you are not the person who finds out on the Monday after.</p>
    <ul class="watch-list">
      ${(data.watchFor || []).map((w) => `<li>
        <h3>${esc(w.name)}</h3>
        <p>${esc(w.what)}</p>
        ${w.where ? `<p class="watch-where">${esc(w.where)}</p>` : ""}
        ${w.url ? `<a class="intl-link" href="${esc(w.url)}" rel="noopener" target="_blank">Keep an eye on it &rarr;</a>` : ""}
      </li>`).join("\n      ")}
    </ul>
  </div>
</section>` : ""}

<section class="tight">
  <div class="wrap">
    <h2>Know one we <span class="hl">missed</span>?</h2>
    <p class="lede" style="max-width:44em">This list is kept by hand, so it is only as good as what we can find. If you
      run a show, or you have a flyer from a local Discord or a shop counter, send it over on any of the socials at the
      bottom of the page and it goes up here. Flyers get shown in full.</p>
    <ul class="facts-list">
      <li>Dates and times come from public listings, mostly ${(data.sources || []).map((s) => `<a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.name)}</a>`).join(" and ")}, read ${esc(longDate(data.checked) || data.checked)}.</li>
      <li><strong>Always check the listing before you drive.</strong> Small shows move, sell out of tables, or get called off, and a page like this is a starting point rather than a promise.</li>
      <li>We are not the organizer of any of these and we do not take a cut. It is just a list.</li>
      <li>Shows in the Southern Tier are left off on purpose. They show up in the same feeds but they are closer to Binghamton than to any of these three cities.</li>
    </ul>
  </div>
</section>

</main>
${footer("Show listings are collected by hand and change without notice. Check with the organizer before traveling.")}
<script>
(function(){
  // Belt and braces on dates. The build already dropped past shows, but a deploy
  // can sit for a few days, and a card show calendar that lists yesterday is
  // worse than no calendar at all.
  var today = new Date().toISOString().slice(0,10);
  document.querySelectorAll('.show').forEach(function(el){
    if (el.dataset.date < today) el.remove();
  });
  document.querySelectorAll('.show-month').forEach(function(m){
    if (!m.querySelector('.show')) m.remove();
  });
  // The "next one up" slab is neither a .show nor a .show-month, so the sweep
  // above walked straight past the single most prominent thing on the page. A
  // stale deploy showed a date that had already been and gone, in the biggest
  // type on the page, which is the exact failure this pass exists to prevent.
  var next=document.querySelector('.next-show');
  if(next && next.dataset.date && next.dataset.date < today){
    var first=document.querySelector('.show');
    if(first){
      next.querySelector('.next-name').textContent=first.querySelector('h3').textContent;
      next.querySelector('.next-meta').textContent=first.querySelector('.show-meta').textContent
        + ' \u2022 ' + first.querySelector('.show-where').textContent;
      var lbl=next.querySelector('.next-label');
      if(lbl) lbl.textContent='Next one up';
      var href=first.querySelector('.show-links a');
      if(href) next.setAttribute('href', href.getAttribute('href'));
    } else {
      next.remove();
    }
  }

  // The calendar is drawn from the same list, so it gets the same sweep. A mark
  // for a show that has already happened is the identical bug, just smaller.
  document.querySelectorAll('.cal-dot').forEach(function(d){
    if (d.dataset.date < today) d.remove();
  });
  document.querySelectorAll('.cal-d').forEach(function(g){
    // Re-derived rather than trusted: the build stamped is-past against the
    // build clock, and the whole point of this pass is that the build clock can
    // be days old.
    g.classList.toggle('is-past', g.dataset.date < today);
  });

  var empty = document.getElementById('showEmpty');
  function apply(region){
    document.querySelectorAll('.show').forEach(function(el){
      el.hidden = region !== 'all' && el.dataset.region !== region;
    });
    var any = false;
    document.querySelectorAll('.show-month').forEach(function(m){
      var vis = m.querySelectorAll('.show:not([hidden])').length;
      m.hidden = vis === 0;
      if (vis) any = true;
    });
    if (empty) empty.hidden = any;
    // Same filter, same click, both views. A calendar that kept showing
    // Syracuse while the list below had been narrowed to Rochester would be
    // worse than no calendar.
    document.querySelectorAll('.cal-dot').forEach(function(d){
      d.classList.toggle('is-off', region !== 'all' && d.dataset.region !== region);
    });
    document.querySelectorAll('.cal-d').forEach(function(g){
      g.classList.toggle('is-empty', !g.querySelector('.cal-dot:not(.is-off)'));
    });
  }
  document.querySelectorAll('.chip.filt').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.chip.filt').forEach(function(o){ o.removeAttribute('aria-current'); });
      b.setAttribute('aria-current','true');
      apply(b.dataset.region);
    });
  });
  apply('all');
})();
</script>
${APP_JS}
</body>
</html>
`;

await mkdir(join(ROOT, "public/assets/shows"), { recursive: true });
await writeFile(join(ROOT, "public/card-shows.html"), page);

console.log(`Wrote public/card-shows.html
  ${upcoming.length} upcoming shows across ${byMonth.length} months
  ${pokemonCount} all-Pokemon, ${upcoming.filter((s) => s.admission === "Free").length} free entry
  next: ${next ? `${next.name}, ${next.date}, ${next.city}` : "nothing listed"}
  ${(data.shows || []).length - upcoming.length} past show(s) dropped
  flyers: ${upcoming.filter((s) => s.flyer).length} named`);
if (missingFlyers.length) {
  console.log(`\n${missingFlyers.length} flyer(s) named but missing:`);
  for (const m of missingFlyers) console.log("  " + m);
}
