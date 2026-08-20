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
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");



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

const shopsDoc = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8"));
const { shops } = shopsDoc;

/**
 * A drawn map of where the shops actually are.
 *
 * WHY THIS PAGE NEEDED A PICTURE AND WHAT IT HAD TO BE. Every card here says
 * something like "Panorama Plaza, Penfield" or "Jefferson Road, Henrietta",
 * which is precise and useful to somebody who already lives here and means
 * nothing at all to anybody else. This is the most local-SEO page on the site,
 * so a good share of its readers are exactly the people those labels fail. Six
 * dots and a scale bar answer "how far apart are these" in one look, which is
 * the question a list of addresses cannot answer at any length.
 *
 * DRAWN, NOT A MAP TILE, and that is a hard constraint rather than a
 * preference. A tile from any provider is a network request per tile, an
 * attribution requirement, a terms-of-use surface and about 200KB; this is a
 * static site with no keys in it. This is an SVG built from six coordinates,
 * so it costs nothing, needs no attribution beyond the geocoder credit already
 * printed below it, and cannot break when somebody's tile server changes.
 *
 * IT IS A RELATIVE MAP AND IT SAYS SO. There is no coastline, no road and no
 * city outline, because this site has no licensed geometry for any of those and
 * drawing Rochester freehand would be inventing data on a page whose whole
 * point is that the addresses were checked. What IS true is the relative
 * position of six points and the distance between them, so that is all it
 * draws, with a scale bar in miles so the spacing is readable as a distance
 * rather than as a diagram.
 *
 * THE PROJECTION IS THE ONE PART THAT COULD BE QUIETLY WRONG. A degree of
 * longitude is shorter than a degree of latitude everywhere except the equator,
 * by cos(latitude), which at Rochester's 43.15 degrees is 0.729. Plotting raw
 * lon against raw lat stretches the map 37% east to west, so two shops on the
 * same road would look further apart than two the same distance north of each
 * other. The x scale below carries that cosine, which is why the scale bar can
 * be one bar rather than two.
 *
 * A SHOP WITH NO COORDINATE IS NOT PLOTTED. data/shops.json carries `at` only
 * where the geocoder returned the shop's own street address, checked by hand.
 * The alternative, dropping a pin at the middle of the city, would look exactly
 * as authoritative as the other six and be a lie about a drive.
 */
function shopMap(list) {
  const pts = list.filter((s) => Array.isArray(s.at) && s.at.length === 2);
  if (pts.length < 2) return "";

  // H carries 26px of bottom margin the points never use, so the scale bar has
  // a strip of its own and cannot land on a shop name.
  const W = 640, H = 446, PAD = 46, FOOT = 26;
  const lats = pts.map((s) => s.at[0]);
  const lons = pts.map((s) => s.at[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  // Work in miles from the south-west corner, so the scale bar is exact.
  const MI_PER_DEG_LAT = 69.0;
  const x0 = Math.min(...lons), y0 = Math.min(...lats);
  const mx = (lon) => (lon - x0) * MI_PER_DEG_LAT * kx;
  const my = (lat) => (lat - y0) * MI_PER_DEG_LAT;
  const wMi = Math.max(...lons.map(mx)) || 1;
  const hMi = Math.max(...lats.map(my)) || 1;
  // One scale for both axes, or the map is not a map.
  const k = Math.min((W - PAD * 2) / wMi, (H - FOOT - PAD * 2) / hMi);
  const offX = (W - wMi * k) / 2, offY = FOOT + (H - FOOT - hMi * k) / 2;
  const px = (lon) => offX + mx(lon) * k;
  // SVG y grows downward and latitude grows northward, so this flips.
  const py = (lat) => H - (offY + my(lat) * k);

  // A round number of miles that is between a fifth and a half of the drawing.
  const nice = [1, 2, 5, 10, 20].find((n) => n * k > (W - PAD * 2) * 0.2) || 1;

  // THE DOTS ARE WHERE THE SHOPS ARE. THE LABELS ARE NOT, AND ONLY THE LABELS
  // MOVE. Just Games and Great Lakes Gaming are five miles apart east to west
  // and within 0.006 degrees of latitude, so at this scale their names sat on
  // the same line and overprinted each other. Nudging a DOT to fix that would
  // make the picture wrong, which is the one thing this figure cannot be, so
  // the label is what shifts and a leader is not needed at 16px of travel.
  //
  // Greedy, in reading order, and it terminates: each label takes the first free
  // slot at its own height or within four steps of it, up then down. Six points
  // is not a case that needs anything cleverer, and something cleverer would be
  // harder to check by eye than the map it is drawing.
  const placed = [];
  const LH = 17;
  const dots = pts
    .map((s) => {
      const x = px(s.at[1]), y = py(s.at[0]);
      // Labels flip to the left of the dot in the right third, so nothing runs
      // off the edge of the viewBox on a narrow phone.
      const left = x > W * 0.62;
      const w = s.name.length * 8.4 + 16;
      const x1 = left ? x - 13 - w : x + 13;
      let ly = y;
      for (let step = 0; step < 9; step++) {
        // 0, -1, +1, -2, +2 ... so a label prefers to stay where its dot is.
        const off = step === 0 ? 0 : (step % 2 ? -1 : 1) * Math.ceil(step / 2) * LH;
        ly = y + off;
        const clash = placed.some(
          (q) => Math.abs(q.y - ly) < LH && x1 < q.x + q.w && q.x < x1 + w
        );
        if (!clash) break;
      }
      placed.push({ x: x1, y: ly, w });
      return `<g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="var(--gold)" stroke="currentColor" stroke-width="2"/>
        <text x="${(left ? x - 13 : x + 13).toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${left ? "end" : "start"}"
          font-size="15" font-weight="700" fill="currentColor" font-family="var(--body)">${esc(s.name)}</text>
      </g>`;
    })
    .join("");

  const barW = nice * k;
  return `<figure class="shop-map">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Relative positions of the ${pts.length} shops listed below. Their addresses are on each card.">
        <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="var(--paper-3)"/>
        ${dots}
        <g transform="translate(${PAD} ${H - 20})">
          <line x1="0" y1="0" x2="${barW.toFixed(1)}" y2="0" stroke="currentColor" stroke-width="2.5"/>
          <line x1="0" y1="-5" x2="0" y2="5" stroke="currentColor" stroke-width="2.5"/>
          <line x1="${barW.toFixed(1)}" y1="-5" x2="${barW.toFixed(1)}" y2="5" stroke="currentColor" stroke-width="2.5"/>
          <text x="${(barW / 2).toFixed(1)}" y="-9" text-anchor="middle" font-size="13" font-weight="700"
            fill="currentColor" font-family="var(--mono)">${nice} mile${nice === 1 ? "" : "s"}</text>
        </g>
      </svg>
      <figcaption>Where they are relative to each other, drawn from each shop's own street address.
        North is up and the scale is true in both directions. There are no roads on it because we do not
        have any to draw: the addresses on the cards below are the exact thing to put in a map app.
        Positions geocoded from OpenStreetMap.</figcaption>
    </figure>`;
}

/**
 * WHEN THEY ARE OPEN, AS A PICTURE.
 *
 * THE QUESTION THIS PAGE COULD NOT ANSWER. Every card prints its hours as a
 * sentence: "Wed to Sat 11am to 9:30pm, Sun 11am to 6pm, closed Mon and Tue".
 * That is complete and it is correct and it is useless to the reader this page
 * is actually for, who is standing on Ridge Road at seven on a Tuesday evening
 * with a phone in one hand asking one question: who is open right now. Six
 * sentences in six different shapes, scattered down 6,000px of page, is six
 * separate parsing jobs to answer it. The grid answers it by looking: find
 * today's column, look down it, the filled cells are open and the empty ones
 * are shut. LingSter's Monday and Tuesday are the two blank cells on the chart
 * and that is the single most useful fact on this page.
 *
 * IT IS THE SAME SENTENCES, NOT A SECOND SOURCE. The bars are parsed out of the
 * `hours` string that the card below prints verbatim, so the picture and the
 * text cannot disagree: there is nothing for them to disagree about. No new
 * field was added to data/shops.json for this and none should be. If the hours
 * are wrong, they are wrong in one place.
 *
 * THE PARSER THROWS RATHER THAN GUESSES, and that is the whole reason it is
 * safe to draw. A bar in the wrong place is a wasted drive across Rochester,
 * which is exactly the failure this page's own note about league nights is
 * written to avoid, so an hours string it cannot read in full fails the build
 * instead of rendering something plausible. Anything left over after every
 * clause is consumed is an error too, so a trailing "closed holidays" cannot be
 * silently dropped.
 *
 * A SHOP WITH NO HOURS GETS NO BARS, same rule as the map above and for the
 * same reason: Great Lakes Gaming publishes none, so its row says so across the
 * whole width rather than borrowing a neighbour's shape.
 */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_IX = Object.fromEntries(DAYS.map((d, i) => [d.toLowerCase(), i]));

// noon and midnight are words on these cards, and 9:30pm has a colon in it.
function parseClock(raw) {
  const t = raw.trim().toLowerCase();
  if (t === "noon") return 12;
  if (t === "midnight") return 24;
  const m = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(t);
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3] === "pm") h += 12;
  return h + (m[2] ? +m[2] / 60 : 0);
}

function parseHours(str, who) {
  const open = Array(7).fill(null);
  const closed = Array(7).fill(false);
  for (const clause of str.split(",").map((c) => c.trim())) {
    let m = /^closed\s+(.+)$/i.exec(clause);
    if (m) {
      for (const d of m[1].split(/\s+and\s+|\s*,\s*/)) {
        const i = DAY_IX[d.trim().toLowerCase()];
        if (i === undefined) throw new Error(`${who}: cannot read the day "${d}" in "${clause}"`);
        closed[i] = true;
      }
      continue;
    }
    m = /^(.+?)\s+(\S+)\s+to\s+(\S+)$/.exec(clause);
    if (!m) throw new Error(`${who}: cannot read the hours clause "${clause}"`);
    const [, dayPart, fromRaw, toRaw] = m;
    const from = parseClock(fromRaw), to = parseClock(toRaw);
    if (from === null || to === null || to <= from) {
      throw new Error(`${who}: cannot read the times in "${clause}"`);
    }
    let ix = [];
    const range = /^(\w+)\s+to\s+(\w+)$/.exec(dayPart);
    const pair = /^(\w+)\s+and\s+(\w+)$/.exec(dayPart);
    if (range) {
      const a = DAY_IX[range[1].toLowerCase()], b = DAY_IX[range[2].toLowerCase()];
      if (a === undefined || b === undefined || b < a) throw new Error(`${who}: cannot read the day range "${dayPart}"`);
      for (let i = a; i <= b; i++) ix.push(i);
    } else if (pair) {
      ix = [DAY_IX[pair[1].toLowerCase()], DAY_IX[pair[2].toLowerCase()]];
    } else {
      ix = [DAY_IX[dayPart.trim().toLowerCase()]];
    }
    if (ix.some((i) => i === undefined)) throw new Error(`${who}: cannot read the days "${dayPart}"`);
    for (const i of ix) open[i] = [from, to];
  }
  for (let i = 0; i < 7; i++) {
    if (!open[i] && !closed[i]) {
      throw new Error(`${who}: "${str}" says nothing about ${DAYS[i]}, so the chart would have to guess`);
    }
  }
  return open;
}

function hoursChart(list) {
  const rows = list.map((s) => ({
    name: s.name,
    open: s.hours ? parseHours(s.hours, s.name) : null,
  }));
  const spans = rows.flatMap((r) => (r.open || []).filter(Boolean));
  if (!spans.length) return "";

  // The axis is computed from the data and padded by half an hour, so a shop
  // that starts opening at nine cannot quietly have its bar clipped at the edge
  // of a hardcoded 10-to-10 scale.
  const lo = Math.floor(Math.min(...spans.map((s) => s[0])) - 0.5);
  const hi = Math.ceil(Math.max(...spans.map((s) => s[1])) + 0.5);

  // EVERY NUMBER IN HERE IS SIZED FOR 390px, NOT FOR THIS VIEWBOX. The svg is
  // width:100% capped at 660, so on the phone this chart is drawn at 0.59 and a
  // unit is not a pixel. The first version used a 122 unit name column and 13
  // unit type, which is 72px and 7.7px on a phone: it fitted and it could not be
  // read. 178 and 17 put "Millennium Games" in the column at 10px, which is the
  // floor for something a reader has to identify a shop by.
  const W = 660, LBL = 178, GAP = 4, ROW = 40, HEAD = 26, FOOT = 26;
  const H = HEAD + rows.length * ROW + FOOT;
  const colW = (W - LBL - GAP * 6) / 7;
  const colX = (d) => LBL + d * (colW + GAP);
  const INSET = 3;
  const tx = (h) => INSET + ((h - lo) / (hi - lo)) * (colW - INSET * 2);

  const head = DAYS.map((d, i) =>
    `<text class="sh-day" x="${(colX(i) + colW / 2).toFixed(1)}" y="17">${d}</text>`
  ).join("");

  const body = rows.map((r, ri) => {
    const y = HEAD + ri * ROW;
    const label = `<text class="sh-name" x="0" y="${(y + 25).toFixed(1)}">${esc(r.name)}</text>`;
    if (!r.open) {
      return `<g>${label}<rect class="sh-none" x="${colX(0)}" y="${(y + 8).toFixed(1)}"
        width="${(W - LBL).toFixed(1)}" height="24" rx="5"/>
        <text class="sh-nonet" x="${(LBL + (W - LBL) / 2).toFixed(1)}" y="${(y + 25).toFixed(1)}">hours not published</text></g>`;
    }
    const cells = r.open.map((span, d) => {
      const x = colX(d);
      const cell = `<rect class="sh-cell" x="${x.toFixed(1)}" y="${(y + 8).toFixed(1)}" width="${colW.toFixed(1)}" height="24" rx="5"/>`;
      if (!span) return cell;
      const x1 = x + tx(span[0]), x2 = x + tx(span[1]);
      return cell + `<rect class="sh-bar" x="${x1.toFixed(1)}" y="${(y + 12).toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="16" rx="4"/>`;
    }).join("");
    return `<g>${label}${cells}</g>`;
  }).join("");

  // THE RULER IS A BAR UNDER MONDAY AND THE WORDS ARE IN THE NAME COLUMN, and
  // both of the two earlier attempts are why. Three hour labels under one 62px
  // column at 390px is 100 units of type in 62 units of space and came out an
  // unreadable smear. Two labels anchored to the ends of the same column is 40px
  // of type in 37px and printed "9am1pm": better, still overlapping, and the
  // sort of thing that looks fine in the markup and fine at 1440. So the scale
  // is drawn as a bar with end serifs, which needs no width at all, and the
  // range is written once in the 178 units of empty label column beside it. The
  // exact hours are on every card below; this only has to say which way is
  // morning.
  const yF = H - 12;
  const lab = (h) => (h === 12 ? "noon" : h === 24 ? "midnight" : `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`);
  const rx1 = colX(0) + tx(lo), rx2 = colX(0) + tx(hi);
  const ticks =
    `<text class="sh-tick" style="text-anchor:end" x="${(LBL - 10).toFixed(1)}" y="${(yF + 4).toFixed(1)}">${lab(lo)} to ${lab(hi)}</text>` +
    `<line class="sh-axis" x1="${rx1.toFixed(1)}" y1="${yF}" x2="${rx2.toFixed(1)}" y2="${yF}"/>` +
    `<line class="sh-axis" x1="${rx1.toFixed(1)}" y1="${yF - 4}" x2="${rx1.toFixed(1)}" y2="${yF + 4}"/>` +
    `<line class="sh-axis" x1="${rx2.toFixed(1)}" y1="${yF - 4}" x2="${rx2.toFixed(1)}" y2="${yF + 4}"/>`;

  return `<figure class="shop-hours">
      <svg viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Opening hours for all ${rows.length} shops as a grid, one column per day of the week. Each shop's hours are written out in full on its own card below.">
        ${head}${body}
        ${ticks}
      </svg>
      <figcaption>Who is open when, read off the same opening hours printed on each card below. A bar is the
        hours that shop is open that day and an empty cell is closed. Every column runs on the same
        ${lab(lo)} to ${lab(hi)} scale, ruled under Monday, so a bar that reaches further right closes
        later. Hours change and holidays are not on here, so call before you drive.</figcaption>
    </figure>`;
}

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build. Same helper, same reasoning, as the
// one at the top of build-shows.mjs.
function hostOf(u) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ALL THIRTEEN OUTBOUND LINKS ON THIS PAGE WERE UNLABELLED, which CLAUDE.md
// makes the condition of every outbound link on the site, and this page was the
// worst case of it in the guides: 13 of 13, where the site as a whole had 783 of
// 877 labelled. Six of the thirteen are the ADDRESS, which is the primary action
// here -- the page says in as many words that the address is "the exact thing to
// put in a map app" -- so the least labelled control was the one the page is for.
// The other seven are the shop's own site and, on one row, its league page.
//
// The visible text could not survive being read alone either. Six links read as
// a bare street address with no shop attached, and "Official league page" named
// no shop at all. The shop name is in the h2 above and was in no link name, so a
// screen reader's link list was six addresses and seven domains in no order.
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
          <h2>${esc(s.name)}</h2>
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
        ${s.address || s.phone || s.hours ? `<dl class="shop-facts">
          ${s.address ? `<dt>Where</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}" rel="noopener" target="_blank" aria-label="${esc(s.address)}, where ${esc(s.name)} is, opens on google.com">${esc(s.address)}</a></dd>` : ""}
          ${s.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(s.phone.replace(/[^0-9+]/g, ""))}">${esc(s.phone)}</a></dd>` : ""}
          ${s.hours ? `<dt>Open</dt><dd>${esc(s.hours)}</dd>` : ""}
        </dl>` : ""}
        ${(s.plays || []).length ? `<div class="shop-play">
          <p class="shop-play-h">You can play here</p>
          <ul>${s.plays.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          ${s.playNote ? `<p class="shop-play-note">${esc(s.playNote)}</p>` : ""}
          ${s.playWarn ? `<p class="shop-play-warn">${esc(s.playWarn)}</p>` : ""}
        </div>` : ""}
        <p class="shop-links">
          <a class="shop-link" href="${esc(url)}" rel="noopener" target="_blank" aria-label="${esc(host)}, ${esc(s.name)}'s own site, opens on their site">
            ${esc(host)} <span aria-hidden="true">&rarr;</span>
          </a>
          ${s.leagueUrl ? `<a class="shop-link" href="${esc(s.leagueUrl)}" rel="noopener" target="_blank" aria-label="Official league page for ${esc(s.name)}, the Play! Pokemon listing, opens on ${esc(hostOf(s.leagueUrl))}">Official league page <span aria-hidden="true">&rarr;</span></a>` : ""}
        </p>
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

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same regex and
// the same trade as build-css.mjs makes for ui.css and miniCSS makes in seven
// other builders including build-pack-prices.mjs, which argues it in full: this
// block is inline in a render blocking <head>, so every line of reasoning in it
// is paid for by every reader on shop wifi.
//
// THIS PAGE NEVER ADOPTED IT AND IT SHOWED. Measured on the built file before
// this line went in: 6249 bytes of inline <style>, 1875 of them comment, which is
// 30%. The comments stay exactly where they are; they simply stop being served.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
.shops{padding:var(--s7) 0 var(--s8)}
.shops-lede{color:var(--ink-2);max-width:46em;margin-bottom:var(--s5)}
.shop-list{list-style:none;display:grid;align-items:start;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:980px){.shop-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.shop-list{grid-template-columns:1fr}}
/* align-items:start on the list above, so a card is as tall as its own content.
   Stretched to a common height, a shop with less to say grew a hole in the
   middle: LingSter Games had 280px of blank white between its facts and its
   website link, Millennium 147px, because something below them is pushed to the
   bottom of whatever height the tallest card sets. One full card beside two
   that look broken is worse than three cards of honest, different heights. */
.shop{display:flex;flex-direction:column;gap:var(--s2);background:var(--card);
  border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.shop-head{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.shop h2{font:400 var(--t-m)/1.15 var(--display)}
.shop-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--mustard);color:var(--on-accent);border:1px solid var(--gold-deep);
  padding:4px 7px;border-radius:var(--r-pill)}
.shop-area{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase}
.shop-blurb{color:var(--ink-2);font-size:var(--t-sm)}
.shop-tags{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s1)}
.shop-tags li{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.03em;
  background:var(--lilac-pale);color:var(--plum);padding:5px 9px;border-radius:var(--r-pill)}
/* The auto margin moved off .shop-link and onto the wrapper. Left on the link
   itself it stopped pushing anything anywhere once the links were wrapped in a
   <p>, and the cards lost their aligned bottom row. */
.shop-links{margin-top:auto;padding-top:var(--s3);display:flex;flex-wrap:wrap;gap:var(--s4)}
.shop-link{font:700 var(--t-sm)/1 var(--body);
  color:var(--ketchup-deep);min-height:44px;display:inline-flex;align-items:center}
.shop-link:hover{text-decoration:underline}

/* Address, phone and hours. A definition list because that is what it is, and
   it gives the labels somewhere to live without inventing a class each. */
.shop-facts{display:grid;grid-template-columns:auto 1fr;gap:2px var(--s3);margin-top:var(--s2);
  font-size:var(--t-sm)}
.shop-facts dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2)}
.shop-facts dd{line-height:1.5}
.shop-facts a{color:var(--ketchup-deep);font-weight:600}
.shop-facts a:hover{text-decoration:underline}

/* What you can actually turn up and play. */
.shop-play{margin-top:var(--s3);padding:var(--s3);background:var(--paper-3);border-radius:var(--r-sm)}
.shop-play-h{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--plum);margin-bottom:6px}
.shop-play ul{list-style:none;display:grid;gap:4px}
.shop-play li{font-size:var(--t-sm);padding-left:14px;position:relative}
.shop-play li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;
  border-radius:50%;background:var(--gold-deep)}
.shop-play-note{font-size:var(--t-micro);color:var(--ink-2);margin-top:8px;line-height:1.5}
/* Where the shop's own league page and a secondhand listing disagree. Loud,
   because the cost of being wrong is a wasted drive. */
.shop-play-warn{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);
  background:var(--lilac-pale);border-radius:var(--r-sm);padding:8px 10px;margin-top:8px}
/* The map. Full width of the wrap, capped so it does not become a poster on a
   desktop, and the SVG scales with the box because it has a viewBox and no
   width attribute. currentColor throughout, so it is correct on the light page
   and would still be correct if this block ever moved onto the dark chrome. */
.shop-map{margin:0 0 var(--s5);color:var(--ink)}
.shop-map svg{display:block;width:100%;height:auto;max-width:660px}
.shop-map figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);
  margin-top:var(--s2);max-width:52em}
/* The opening hours grid. Same box as the map so the two read as a pair, and
   the same currentColor discipline. Font sizes are in the SVG's own 660 unit
   space, so at 390px on a phone the chart is drawn at 0.59 and a 17 unit shop
   name renders at 10px. Nothing here is set at a size that does not survive
   being nearly halved, which is why the chart is capped at 660 and drawn once
   rather than given a phone layout of its own. Re-measured at 390 after the
   first pass, where 13 unit type came out at 7.7px and could not be read. */
.shop-hours{margin:0 0 var(--s5);color:var(--ink)}
.shop-hours svg{display:block;width:100%;height:auto;max-width:660px}
.shop-hours figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);
  margin-top:var(--s2);max-width:52em}
.sh-day{font:700 17px var(--mono);fill:var(--ink-2);text-anchor:middle;letter-spacing:.04em}
.sh-name{font:700 17px var(--body);fill:var(--ink)}
.sh-cell{fill:var(--paper-3)}
.sh-bar{fill:var(--gold);stroke:var(--gold-deep);stroke-width:1}
.sh-none{fill:var(--paper-3)}
.sh-nonet{font:400 15px var(--mono);fill:var(--ink-2);text-anchor:middle}
.sh-axis{stroke:var(--ink-2);stroke-width:1;opacity:.5}
.sh-tick{font:400 14px var(--mono);fill:var(--ink-2);text-anchor:middle}
.shops-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
`;

const body = `
<main id="main" class="shops">
  <div class="wrap">
    <div class="brk"><h1>Card shops and <span class="hl">where to play</span></h1><span class="ln"></span></div>
    <p class="shops-lede">Where I actually buy, and where you can sit down and play. Real shops around
      Rochester, New York, run by people who know the hobby. Round here the counter you buy from and the
      table you play at are usually the same building, so both are on one page. Buy local when you can:
      the shop is why the local scene exists.</p>
${shopMap(shops)}
${hoursChart(shops)}
    <ul class="shop-list">
${cards}
    </ul>
    ${shopsDoc.playNote ? `<p class="shops-lede" style="margin-top:var(--s5)">${esc(shopsDoc.playNote)}</p>` : ""}
    <p class="shops-lede">Looking for a one off rather than a weekly night? The
      <a href="/card-shows.html">card show calendar</a> has every show coming up around Rochester, Buffalo
      and Syracuse.</p>
    ${/* THE LOCAL CLUSTER WAS THREE PAGES AND ONE EDGE. /vendors.html and
          /creators.html had ZERO in-body inbound links from anywhere on the
          site on 18 August 2026, reachable only from the hamburger, and this is
          the page whose reader is looking for exactly what they hold. The three
          are the same subject cut three ways, which is the case for linking
          them and also the reason a reader who finds one wants the others. */ ""}
    <p class="shops-lede">Not everyone selling cards around here has a shopfront.
      <a href="/vendors.html">Local vendors</a> are the breakers and sellers we buy from without one, and
      <a href="/creators.html">local creators</a> is who else is filming Pokemon in Rochester, Buffalo and
      Syracuse.</p>
    <p class="shops-lede">Addresses, phone numbers and opening hours were last checked on
      ${esc(longDate(shopsDoc.updated) || "an unrecorded date")}. Shops move and change their hours, so call ahead if you are
      making a trip of it.</p>
    <p class="shops-note">NOT SPONSORED AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO.
      IF YOU RUN A CARD SHOP AROUND ROCHESTER AND YOU ARE NOT ON HERE, SAY HELLO ON ANY OF THE SOCIALS.</p>
  </div>
</main>`;

// Share the home page's shell so this page cannot drift from the design.
const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
// Stop at </header>. Slicing to the rail also swallowed the menu that sits
// between them, and these pages then append their own copy, so every one
// shipped two <nav id="menu"> blocks: invalid HTML and a duplicated landmark.
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf('</header>') + '</header>'.length);
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
// The bar carries the menu button; the panel it controls lives after </header>,
// so it has to be copied across too or the button opens nothing.
const menuPanel = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const skipLink = '<a class="skip" href="#main">Skip to content</a>';
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(
    /<title>[\s\S]*?<\/title>/,
    // Both halves of what the page now answers. "Where to play pokemon rochester
    // ny" is its own search with its own intent, and the old title only claimed
    // the buying half.
    `<title>Pokemon Card Shops in Rochester NY &amp; Where to Play</title>`
  )
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${
      shops.length
    } local Pokemon card shops around Rochester, New York, and where to play: league nights, prereleases and organized play, with addresses and hours.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/shops.html">`)
  .replace(/(<meta property="og:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-shops.jpg`)
  .replace(/(<meta name="twitter:image" content="[^"]*\/assets\/)og-image\.jpg/, `$1og-shops.jpg`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/shops.html`)
  .replace(
    /(<meta property="og:title" content=")[^"]*/,
    `$1Pokemon Card Shops in Rochester, NY`
  );

const html = `<!DOCTYPE html>
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
`;

await writeFile(join(ROOT, "public/shops.html"), html);

const cleaned = shops.filter((s) => cleanUrl(s.url) !== s.url);
console.log(`Wrote public/shops.html  (${shops.length} shop${shops.length === 1 ? "" : "s"})`);
for (const s of cleaned) {
  console.log(`  cleaned tracking parameters off ${s.name}:\n    ${cleanUrl(s.url)}`);
}
