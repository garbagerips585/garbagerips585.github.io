#!/usr/bin/env node
// Build /video-games.html: every official Pokemon video game, in order.
//
//   node scripts/sync-game-covers.mjs   (first, by hand, writes data/cover-dims.json)
//   node scripts/build-video-games.mjs  (this)
//
// NO BACKTICKS ANYWHERE IN THIS FILE'S COMMENTS. The page below is one
// template literal and a stray backtick in a comment closes it, which produces
// a syntax error a hundred lines from the thing that caused it.
//
// EVERY FACT ON THIS PAGE IS READ OUT OF data/video-games.json, which carries
// its own source and read date on every field. Same discipline as build-lore.mjs:
// nothing is typed from memory, and the counted summary at the top is computed
// from the array rather than written down, because a typed count becomes a lie
// on the first edit to the data.
//
// FIVE THINGS ABOUT THIS PAGE ARE NOT PREFERENCES. They were measured or
// argued, and undoing any of them quietly breaks something specific.
//
// ONE: THE TIMELINE IS VERTICAL AND THAT IS THE WHOLE PERFORMANCE STORY.
// CLAUDE.md records that loading="lazy" is a VERTICAL heuristic: Chrome
// measures how far an image is from the viewport DOWN the page, so a slide
// parked 407px to the right in a horizontal track counts as on screen and
// fetches at first paint. That cost the home page 289.9KB of pack art and
// needed a bespoke hydration script. This page paints 160 covers. In a
// vertical list lazy loading simply works: measured on load, about six rows
// are in reach and that is roughly 87KB of artwork. Do not rebuild this as a
// scroll track.
//
// TWO: THE COVER BOX IS A SQUARE WITH object-fit:contain, AND THE WIDTH AND
// HEIGHT ARE REAL. The 191 mirrored files run 0.617 to 2.081 in aspect ratio
// and the families are eras of hardware: square Game Boy carts, wide N64 and
// DS boxes, tall Switch keycases, wide phone logos. Any fixed-aspect tile
// crops or stretches somebody's artwork. This is the same call .prod-shot and
// the mirrored set symbols already made. Declaring 320x320 on every image
// would lie about the shape on most of them, which is the class of bug that
// once made 173 card scans wrong, so the dimensions come from the manifest.
//
// THREE: A MISSING METASCORE IS NOT A ZERO, AND THERE ARE TWO KINDS OF
// MISSING. "Not on Metacritic" means no page was found; "No Metascore yet"
// means the page exists and too few critics reviewed it. They render as
// different sentences because merging them would tell a reader that Pokemon
// Red and Blue scored badly. Scores are stored and printed PER VERSION and are
// never averaged: X is 87 and Y is 88, Ruby is 82 and Sapphire has no score at
// all from the same release.
//
// FOUR: THE THREE POKEMON COUNTS ARE THREE NUMBERS. Regional dex entries,
// National Pokedex species, and how many are obtainable in the game are not
// the same thing. Only the first two are published, so only those two are
// printed, and the regional one always says "entries". X and Y has three
// regional dexes at once and no single Kalos figure exists, so all three are
// shown. PokeAPI's per-generation new-species counts sum to exactly the
// National Pokedex total it reports, which is checked below rather than
// asserted: if the sum ever stops matching, the page says so instead of
// printing a claim it cannot support.
//
// FIVE: THE ROWS ARE GROUPED BY ERA, NOT BY BULBAPEDIA'S LABEL. Bulbapedia
// files Pokemon Seek and Find as "Generation III miscellaneous" and it shipped
// in 2006, inside the Generation IV era. Grouping by the label would put the
// dates out of order inside a page whose entire job is chronology, so each
// group is the span between one generation's first CORE release and the next
// one's, computed from the data. Every row still prints Bulbapedia's own label
// in its detail, so nothing is lost and nothing is invented.
//
// The nav label is "Video games" and the url is /video-games.html because
// /games/ is the minigame hub and is already in the nav, the sitemap and
// build-search.mjs's PAGES.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, APP_JS, footer, FONTS } from "../shared/chrome.mjs";
import { esc, longDate, MONTHS_LONG } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(await readFile(join(ROOT, "data/video-games.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(ROOT, "data/cover-dims.json"), "utf8"));

const GAMES = data.games;
const COVERS = manifest.covers || {};
const READ = longDate(data.read_date) || data.read_date;

const n = (x) => Number(x).toLocaleString("en-US");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// ---------------------------------------------------------------------------
// Dates.
//
// Bulbapedia records a region as one or more segments joined by " | ", each of
// which may be a full date, a month and a year, a bare year, a phrase like
// "Unreleased", or a date range. Every one of those shapes is in the file
// today, so the parser keeps what it can read and prints the rest verbatim
// rather than dropping it. A qualifier in brackets is kept and shown, because
// on one row it says "(Game Boy)" and on another it says "(field test)", and
// the second one changes what the date means.
const MON = new Map(MONTHS_LONG.map((m, i) => [m, i + 1]));
const RE_DMY = new RegExp("^(" + MONTHS_LONG.join("|") + ") (\\d{1,2}), (\\d{4})$");
const RE_MY = new RegExp("^(" + MONTHS_LONG.join("|") + ") (\\d{4})$");

function parseSegment(raw) {
  const seg = String(raw).trim();
  const q = seg.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const body = (q ? q[1] : seg).trim();
  const qualifier = q ? q[2].trim() : null;
  let d = null;
  let m = body.match(RE_DMY);
  if (m) d = { y: +m[3], m: MON.get(m[1]), d: +m[2], precision: "day" };
  if (!d && (m = body.match(RE_MY))) d = { y: +m[2], m: MON.get(m[1]), precision: "month" };
  if (!d && /^\d{4}$/.test(body)) d = { y: +body, precision: "year" };
  return { raw: seg, body, qualifier, date: d };
}

/**
 * A LAST GUARD AGAINST RAW WIKITEXT REACHING A LIVE PAGE.
 *
 * data/video-games.json promises that its infobox values are transcribed with
 * the markup stripped, and six fields shipped with an external link left in
 * anyway: Pokemon Yellow's Japanese date rendered as the date followed by a
 * pokemon.co.jp url and the Japanese title of the game. Nothing errored, and
 * on a page of 160 dates nobody would have read all of them. The data was
 * fixed, and this exists because the fix is one hand edit away from coming
 * back. It runs over every field the page prints, not only the dates.
 */
const unwiki = (s) =>
  s == null
    ? s
    : String(s)
        .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
        .replace(/\[https?:\/\/\S+\s+[^\]]*$/g, "")
        .replace(/\[https?:\/\/\S+\]?/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

const segmentsOf = (field) => (field ? unwiki(field).split(" | ").map(parseSegment) : []);

const MON_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** "18 NOV 2022", "NOV 2022", "2027". The face of a timeline row is monospace. */
function stamp(d) {
  if (!d) return null;
  if (d.precision === "year") return String(d.y);
  if (d.precision === "month") return `${MON_SHORT[d.m - 1]} ${d.y}`;
  return `${String(d.d).padStart(2, "0")} ${MON_SHORT[d.m - 1]} ${d.y}`;
}

const REGION_NAME = { na: "North America", jp: "Japan", eu: "Europe", au: "Australia", kr: "Korea" };
const REGION_CODE = { na: "NA", jp: "JP", eu: "EU", au: "AU", kr: "KR" };

/**
 * THE FACE DATE IS THE NORTH AMERICAN ONE.
 *
 * This site is written from Rochester, New York, so NA leads and Japan is
 * shown beside it rather than under a tap. Four titles never left Japan and
 * their record holds a JP field and nothing else, so those lead with JP and
 * say "Japan only" in as many words: the alternative is a blank where every
 * other row has a date, which reads as missing data rather than as a fact.
 *
 * "Unreleased" is a real value in this data and is not a missing one. It is
 * treated as no date for the purpose of choosing a lead, and it still prints
 * in the detail, because "Ruby and Sapphire never came out in Korea" is
 * information.
 */
function leadDate(g) {
  const rd = g.release_dates || {};
  const usable = (k) => {
    const segs = segmentsOf(rd[k]);
    return segs.find((s) => s.date) || null;
  };
  for (const k of ["na", "jp", "eu", "au", "kr"]) {
    const s = usable(k);
    if (s) return { region: k, seg: s };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Eras.
//
// The boundary between two eras is the first CORE SERIES release of the later
// generation, taken from the data rather than typed. Generation I has no lower
// bound: one title in the file carries a bare year that lands before Red and
// Green, and it belongs at the top of the timeline rather than nowhere.
const eraStart = new Map();
for (const g of GAMES) {
  const m = /^Generation ([IVX]+) core series/.exec(g.generation_label || "");
  if (!m || !g._first_release) continue;
  const cur = eraStart.get(m[1]);
  if (!cur || g._first_release < cur) eraStart.set(m[1], g._first_release);
}
const ERAS = ROMAN.filter((r) => eraStart.has(r)).map((r) => ({ roman: r, start: eraStart.get(r) }));
if (!ERAS.length) throw new Error("no core series releases found, so no era boundaries can be computed");

function eraOf(iso) {
  if (!iso) return null;
  let cur = ERAS[0].roman;
  for (const e of ERAS) if (iso >= e.start) cur = e.roman;
  return cur;
}

const GEN_BY_ROMAN = new Map(
  Object.entries(data.generations).map(([key, v]) => [v.roman, { key, ...v }])
);

// ---------------------------------------------------------------------------
// The species arithmetic, checked rather than claimed.
//
// PokeAPI publishes a new-species count per generation and a National Pokedex
// size, and the two are meant to agree. The page says so out loud, which is
// only honest if the page has actually added them up. If they ever stop
// matching, the sentence changes instead of the number being fudged.
const genSpecies = [...GEN_BY_ROMAN.values()]
  .map((g) => g.new_species)
  .filter((v) => typeof v === "number");
const speciesSum = genSpecies.reduce((a, b) => a + b, 0);
const NATDEX = data.national_dex_total.value;
const SPECIES_AGREE = speciesSum === NATDEX;

// ---------------------------------------------------------------------------
// Chips and small facts per row.

/**
 * The Pokemon TCG video games. Listed by id rather than matched on a title
 * substring, because "Pokemon Card Game Gacha" and "Pokemon Trading Card Game"
 * do not share a phrase and "Pokemon TCG Card Dex" is not a game at all.
 * Marked so a card collector can find them without the timeline being broken
 * into two bands, which was the alternative and would have cost the chronology.
 */
const TCG_IDS = new Set([
  "tcg-gb", "pokemon-play-it", "pokemon-play-it-version-2", "tcg-gb2",
  "pokemon-card-game-online", "tcgo", "pokemon-card-game-how-to-play-ds",
  "pokemon-card-game-gacha", "pokemon-medallion-battle", "tcg-live", "tcg-pocket",
]);

/** The two rows that have a guide of their own on this site. Nothing else links out of a row. */
const GUIDE = { "tcg-live": "/tcg-live.html", "tcg-pocket": "/tcg-pocket.html" };

/**
 * The four regional dexes that arrived as paid expansions rather than in the
 * base game. Named from PokeAPI's own version-group list, which carries
 * the-isle-of-armor, the-crown-tundra, the-teal-mask and the-indigo-disk as
 * separate groups from sword-shield and scarlet-violet. Nothing else in the
 * data is DLC, so nothing else is labelled: X and Y has three regional dexes
 * and none of them is an expansion.
 */
const DLC_DEX = new Set(["isle-of-armor", "crown-tundra", "kitakami", "blueberry"]);

const titleCase = (s) =>
  String(s).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** "pokemon-ruby-version" reads as "Ruby" on a chip beside its score. */
const versionLabel = (slug) =>
  titleCase(String(slug || "").replace(/^pokemon-/, "").replace(/-version$/, ""));

/**
 * Metascores, one chip per version, never merged.
 *
 * The two empty states are deliberately different sentences. "Not on
 * Metacritic" is every Game Boy core game, because Metacritic did not cover
 * games yet, plus most of the arcade cabinets and the Pokemon mini library.
 * "No Metascore yet" is a page that exists with too few critic reviews to
 * aggregate. A dash, a blank or a zero would read as a bad score in both
 * cases, and for the best loved games in the series that is the worst thing
 * this page could say.
 */
function scoreChips(g) {
  const scored = g.metacritic.filter((m) => typeof m.metascore === "number");
  if (scored.length) {
    return scored
      .map((m) => {
        const label = g.metacritic.length > 1 ? esc(versionLabel(m.version)) + " " : "";
        const reviews = m.critic_reviews ? ` title="${m.critic_reviews} critic reviews on Metacritic"` : "";
        return `<span class="vg-ms"${reviews}><b>${label}${m.metascore}</b> <i>Metascore</i></span>`;
      })
      .join("");
  }
  const noPage = g.metacritic.some((m) => m.reason === "no Metascore on page");
  return noPage
    ? `<span class="vg-no">No Metascore yet</span>`
    : `<span class="vg-no">Not on Metacritic</span>`;
}

function dexChips(g) {
  const dexes = g.pokedex && g.pokedex.regional_dexes ? g.pokedex.regional_dexes : [];
  return dexes
    .map(
      (d) =>
        `<span class="vg-dex">${esc(titleCase(d.name))} Pokedex: ${n(d.entries)} entries${
          DLC_DEX.has(d.name) ? " <i>DLC</i>" : ""
        }</span>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Cover art.
//
// The local mirror is preferred and the remote url is the fallback, DECIDED
// HERE at build time from the manifest rather than with an onerror handler.
// onerror never fires for a lazy image below the fold, which is exactly what
// every image on this page is, so an onerror fallback on a page like this is
// decoration. Same reasoning as sync-symbols.mjs and sync-expansions.mjs.
const KIND_CHIP = {
  logo: "Logo",
  "cabinet photo": "Cabinet",
  screenshot: "Screenshot",
};

function coverArt(cover, title, cls) {
  if (!cover) {
    return `<div class="vg-art ${cls}"><div class="vg-noart" role="img" aria-label="No cover art held for ${esc(title)}"></div></div>`;
  }
  const local = COVERS[cover.file];
  const alt = cover.kind === "box art" ? `${title} cover art` : `${title} ${cover.kind}`;
  const chip = KIND_CHIP[cover.kind]
    ? `<span class="vg-kind">${esc(KIND_CHIP[cover.kind])}</span>`
    : "";
  if (!local) {
    // No mirrored file. Keep Bulbagarden's own 320px thumbnail and its real
    // intrinsic size, which is what the record already holds.
    const w = cover.intrinsic ? cover.intrinsic[0] : "";
    const h = cover.intrinsic ? cover.intrinsic[1] : "";
    return `<div class="vg-art ${cls}"><img src="${esc(cover.remote_320 || cover.remote_full)}" alt="${esc(alt)}"${
      w ? ` width="${w}" height="${h}"` : ""
    } loading="lazy" decoding="async">${chip}</div>`;
  }
  const base = `/assets/game-covers/${local.slug}-pokemon-game-cover`;
  return `<div class="vg-art ${cls}"><picture><source srcset="${base}.avif" type="image/avif"><img src="${base}.webp" alt="${esc(
    alt
  )}" width="${local.w}" height="${local.h}" loading="lazy" decoding="async"></picture>${chip}</div>`;
}

// ---------------------------------------------------------------------------
// One row.

function regionLines(g) {
  const rd = g.release_dates || {};
  const out = [];
  for (const k of ["jp", "na", "eu", "au", "kr"]) {
    if (!rd[k]) continue;
    const segs = segmentsOf(rd[k]);
    const parts = segs.map((s) => {
      const d = stamp(s.date);
      const shown = d || s.body;
      return esc(shown) + (s.qualifier ? ` <i>${esc(s.qualifier)}</i>` : "");
    });
    out.push(
      `<div class="vg-rel"><b>${esc(REGION_NAME[k])}</b><span>${parts.join(" <em>then</em> ")}</span></div>`
    );
  }
  return out.join("");
}

function row(g) {
  const lead = leadDate(g);
  const rd = g.release_dates || {};
  const jaOnly = Object.keys(rd).length === 1 && rd.jp;
  const cover = g.covers && g.covers[0];
  const paired = g.covers && g.covers[1];
  const tcg = TCG_IDS.has(g.id);

  const face = lead
    ? `<time class="vg-date" datetime="${lead.seg.date.y}${
        lead.seg.date.m ? "-" + String(lead.seg.date.m).padStart(2, "0") : ""
      }${lead.seg.date.d ? "-" + String(lead.seg.date.d).padStart(2, "0") : ""}">${esc(
        stamp(lead.seg.date)
      )} <b>${esc(REGION_CODE[lead.region])}</b>${
        lead.seg.qualifier ? ` <i>${esc(lead.seg.qualifier)}</i>` : ""
      }</time>`
    : `<span class="vg-date vg-undated">Release date not published</span>`;

  // Japan alongside North America, which is the whole point of leading with NA
  // rather than replacing one with the other.
  let alongside = "";
  if (lead && lead.region !== "jp" && rd.jp) {
    const jp = segmentsOf(rd.jp).find((s) => s.date);
    if (jp) alongside = `<span class="vg-alt">Japan ${esc(stamp(jp.date))}</span>`;
  } else if (jaOnly) {
    alongside = `<span class="vg-alt">Japan only</span>`;
  }

  const status = g.status
    ? `<span class="vg-dead">${g.status.state === "ended" ? "No longer playable" : "Delisted"}${
        g.status.date ? ", " + esc(isoStamp(g.status.date)) : ""
      }</span>`
    : "";

  const chips = [
    tcg ? `<span class="vg-tcg">Card game</span>` : "",
    scoreChips(g),
    dexChips(g),
    status,
  ]
    .filter(Boolean)
    .join("");

  const guide = GUIDE[g.id]
    ? `<p class="vg-guide"><a href="${GUIDE[g.id]}">Our guide to ${esc(g.title)}</a></p>`
    : "";

  const mcLinks = g.metacritic
    .filter((m) => m.url)
    .map(
      (m) =>
        `<a href="${esc(m.url)}" target="_blank" rel="noopener" aria-label="${esc(
          versionLabel(m.version) || g.title
        )} on Metacritic, opens on metacritic.com">${esc(versionLabel(m.version) || "Metacritic")}</a>`
    )
    .join(" ");

  return `<li class="vg-row${paired ? " has-pair" : ""}">
  <div class="vg-dot" aria-hidden="true"></div>
  ${coverArt(cover, g.title, "is-lead")}
  <div class="vg-body">
    <h3 class="vg-title">${esc(g.title)}</h3>
    <p class="vg-when">${face}${alongside}</p>
    <p class="vg-plat">${esc(unwiki(g.platform) || "Platform not published")}</p>
    <p class="vg-chips">${chips}</p>
  </div>
  <details class="vg-more">
      <summary>Details</summary>
      <div class="vg-detail">
        ${paired ? coverArt(paired, g.title, "is-pair") : ""}
        <dl>
          <dt>Released</dt><dd>${regionLines(g) || "<span class='vg-undated'>Not published</span>"}</dd>
          <dt>Kind</dt><dd>${esc(unwiki(g.category) || "Not published")}, ${esc(unwiki(g.generation_label))}</dd>
          <dt>Developer</dt><dd>${esc(unwiki(g.developer) || "Not published")}</dd>
          <dt>Publisher</dt><dd>${esc(unwiki(g.publisher) || "Not published")}</dd>
          ${
            g.status
              ? `<dt>Status</dt><dd>${esc(g.status.note)} <span class="vg-quote">Bulbapedia: &ldquo;${esc(
                  g.status.quote
                )}&rdquo;</span></dd>`
              : ""
          }
        </dl>
        ${guide}
        <p class="vg-cite"><a href="${esc(g.bulbapedia)}" target="_blank" rel="noopener" aria-label="${esc(
          g.title
        )} on Bulbapedia, opens on bulbapedia.bulbagarden.net">Bulbapedia</a>${
          mcLinks ? " <span>Metacritic: </span>" + mcLinks : ""
        }</p>
      </div>
  </details>
</li>`;
}

/**
 * data/video-games.json stores a status date as ISO, and the row wants the same
 * monospace stamp every other date on the page wears. Two of the nine sourced
 * statuses are precise to the year or the month only, which the record stores
 * as the first of the period, so those would read as a made-up day. They are
 * stored with an explicit precision note in the quote beside them and the
 * stamp here is the safe one: day precision only when the source gave a day.
 */
function isoStamp(iso) {
  const p = String(iso).split("-");
  const y = +p[0];
  const m = +p[1];
  const d = +p[2];
  if (m === 1 && d === 1) return String(y);
  if (d === 1) return `${MON_SHORT[m - 1]} ${y}`;
  return `${String(d).padStart(2, "0")} ${MON_SHORT[m - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Groups.

const grouped = new Map(ERAS.map((e) => [e.roman, []]));
const undated = [];
for (const g of GAMES) {
  const e = eraOf(g._first_release);
  if (!e) undated.push(g);
  else grouped.get(e).push(g);
}

function eraHeader(roman) {
  const gen = GEN_BY_ROMAN.get(roman);
  const list = grouped.get(roman);
  const first = list.find((g) => g._first_release);
  const last = [...list].reverse().find((g) => g._first_release);
  const years =
    first && last
      ? first._first_release.slice(0, 4) === last._first_release.slice(0, 4)
        ? first._first_release.slice(0, 4)
        : `${first._first_release.slice(0, 4)} to ${last._first_release.slice(0, 4)}`
      : "";
  const species =
    gen && typeof gen.new_species === "number"
      ? `${n(gen.new_species)} new Pokemon`
      : "No species count published";
  const region = gen && gen.region ? titleCase(gen.region) : null;
  return `<header class="vg-era" id="gen-${roman.toLowerCase()}">
  <h2>Generation ${roman}</h2>
  <p>${region ? esc(region) + " &middot; " : ""}${species}${years ? " &middot; " + esc(years) : ""} &middot; ${n(
    list.length
  )} ${list.length === 1 ? "title" : "titles"}</p>
</header>`;
}

const timeline = ERAS.map(
  (e) => `${eraHeader(e.roman)}
<ol class="vg-list">
${grouped.get(e.roman).map(row).join("\n")}
</ol>`
).join("\n");

const undatedBlock = undated.length
  ? `<header class="vg-era" id="gen-undated">
  <h2>No date published</h2>
  <p>${n(undated.length)} ${undated.length === 1 ? "title" : "titles"} whose article carries no release date at all</p>
</header>
<ol class="vg-list">
${undated.map(row).join("\n")}
</ol>`
  : "";

// ---------------------------------------------------------------------------
// The counted summary. Every one of these four is computed.

const withDate = GAMES.filter((g) => g._first_release);
const firstYear = withDate[0]._first_release.slice(0, 4);
const lastYear = withDate[withDate.length - 1]._first_release.slice(0, 4);
const coverCount = GAMES.reduce((a, g) => a + g.covers.length, 0);
const scoredCount = GAMES.filter((g) => g.metacritic.some((m) => typeof m.metascore === "number")).length;
const noPageCount = GAMES.filter(
  (g) =>
    !g.metacritic.some((m) => typeof m.metascore === "number") &&
    g.metacritic.some((m) => m.reason === "no Metascore on page")
).length;
const noEntryCount = GAMES.length - scoredCount - noPageCount;
const tcgCount = GAMES.filter((g) => TCG_IDS.has(g.id)).length;
const deadCount = GAMES.filter((g) => g.status).length;
const notBoxCount = GAMES.reduce(
  (a, g) => a + g.covers.filter((c) => c.kind !== "box art").length,
  0
);
const dexCount = GAMES.filter((g) => g.pokedex && g.pokedex.regional_dexes.length).length;

const rail = [
  ...ERAS.map(
    (e) => `<a href="#gen-${e.roman.toLowerCase()}">Gen ${e.roman}</a>`
  ),
  undated.length ? `<a href="#gen-undated">Undated</a>` : "",
]
  .filter(Boolean)
  .join("");

// ---------------------------------------------------------------------------
// Head.

// Google truncates the snippet around 160 characters, and this one carries two
// computed numbers that can grow, so it is measured rather than hoped for.
// Same guard as build-pack-prices.mjs.
const desc =
  `Every official Pokemon video game in one timeline: ${n(GAMES.length)} titles from ${firstYear}, ` +
  `with cover art, release dates, platforms and Metascores.`;
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const OG = `${SITE}/assets/og-video-games.jpg`;

const STYLE = `<style>
/* ---------------------------------------------------------------------------
   This page carries its own rules rather than adding to assets-source/ui.css,
   which is what every recent guide builder here does. Everything is prefixed
   vg- so nothing can collide with a component the shared stylesheet owns.
   Tokens (--gold, --ink, --paper-2, --s4, --mono and the rest) come from
   ui.css's :root and are not redefined.
   --------------------------------------------------------------------------- */

/* THE RAIL IS NOT OPTIONAL. This page is around thirteen thousand pixels tall
   on a phone, so a reader who lands two thirds of the way down has no way back
   to a generation without a scroll of several seconds. It sticks under the
   site bar, which is itself sticky at 60px, and --bar-h is the single source of
   that number so a taller touch target in the bar cannot tuck the rail under
   it. At 390px the chips scroll sideways INSIDE the rail, which is the one
   horizontal scroll on this page and it holds ten links rather than 160
   pictures. */
.vg-rail{position:sticky;top:var(--bar-h);z-index:40;background:var(--paper-2);
  border-bottom:2px solid var(--keyline);margin-bottom:var(--s5)}
.vg-rail-in{display:flex;gap:var(--s2);overflow-x:auto;overflow-y:hidden;
  scrollbar-width:thin;padding:var(--s2) var(--s4);max-width:var(--wrap);margin:0 auto;
  -webkit-overflow-scrolling:touch}
.vg-rail a{flex:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;padding:10px 12px;min-height:40px;display:flex;align-items:center;
  border:2px solid var(--keyline);border-radius:var(--r-pill);color:var(--ink);
  text-decoration:none;background:var(--paper-2);white-space:nowrap}
.vg-rail a:hover,.vg-rail a:focus-visible{background:var(--mustard);color:var(--on-accent)}

.vg-era{border-top:3px solid var(--keyline);padding-top:var(--s4);margin:var(--s7) 0 var(--s4);
  scroll-margin-top:calc(var(--bar-h) + 64px)}
.vg-era h2{font:400 var(--t-l)/1.1 var(--display)}
.vg-era p{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-top:6px}

.vg-list{list-style:none;margin:0;padding:0;position:relative}
/* The gold rail down the left gutter with a dot per row. It is what makes this
   read as a timeline rather than as a list, and it is the reason the row has a
   left pad it would not otherwise need. */
.vg-list::before{content:"";position:absolute;left:7px;top:0;bottom:0;width:2px;
  background:var(--gold);opacity:.5}
.vg-row{position:relative;padding-left:28px;margin-bottom:var(--s4)}
.vg-dot{position:absolute;left:1px;top:26px;width:14px;height:14px;border-radius:50%;
  background:var(--mustard);border:2px solid var(--keyline)}

.vg-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:0 var(--s3);align-items:start}
/* NO GRID PLACEMENT ON THE DOT, and that omission is the whole rule. An
   absolutely positioned grid child that names a grid area takes THAT AREA as
   its containing block rather than the row's padding box, so left:1px measured
   from the start of column 1 put the dot at x=41 instead of x=13: directly
   under the cover, painted over by it, invisible. The gold rail was there and
   the dots were not, which looks like a design choice. */
.vg-art{grid-column:1;grid-row:1}
/* min-width:0 IS LOAD BEARING ON EVERY ONE OF THESE. A grid item defaults to
   min-width:auto, which means it refuses to shrink below its widest unbreakable
   child, and this page has plenty: a chip reading "Original Johto Pokedex: 251
   entries" is 271px wide inside a 184px column at 390px. Measured over CDP at
   390x844: without these the document scrollWidth was 551 against a viewport of
   390, and the chips were the whole of it. Sideways scroll on a phone is the
   one layout bug a reader cannot work around. */
.vg-body{grid-column:2;grid-row:1;min-width:0}

/* THE BOX IS A SQUARE AND THE ART IS CONTAINED INSIDE IT, NEVER CROPPED.
   The 191 mirrored files run 0.617 to 2.081 in aspect ratio in era-shaped
   families, so a Switch keycase renders 74x120 in here, a DS case 120x107 and
   an N64 box 120x84. Scrolling the page shows the hardware changing shape,
   which is a real thing the page gets for free and which cropping would throw
   away. object-fit:contain on a fixed square is the same decision .prod-shot
   and the mirrored set symbols already made. */
.vg-art{position:relative;width:var(--vg-box,120px);height:var(--vg-box,120px);
  display:grid;place-items:center;background:var(--paper-3);border:2px solid var(--keyline);
  border-radius:var(--r-sm);overflow:hidden}
.vg-art img{width:100%;height:100%;object-fit:contain;background:var(--paper-2)}
.vg-noart{width:100%;height:100%;
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
.vg-kind{position:absolute;left:0;bottom:0;font:700 9px/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;background:var(--keyline);color:var(--paper-2);padding:4px 5px;
  border-top-right-radius:5px}

.vg-title{font:600 var(--t-body)/1.25 var(--body);margin:0 0 4px}
.vg-when{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;margin-bottom:2px}
.vg-date{font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.06em}
.vg-date b{color:var(--gold-deep)}
.vg-date i,.vg-alt{font:400 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);font-style:normal}
.vg-undated{color:var(--ink-2);font-style:normal}
.vg-plat{font:400 var(--t-sm)/1.35 var(--body);color:var(--ink-2)}
.vg-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;min-width:0}
/* The chip text WRAPS. A nowrap chip is the prettier default and it is what
   put 161px of sideways scroll on this page, because the dex chips and the
   per-version score chips carry real sentences: "Original Johto Pokedex: 251
   entries" and "Mystery Dungeon Explorers Of Time 71 Metascore". Two lines
   inside a chip is fine; a page that slides under your thumb is not. */
.vg-chips>*{font:700 var(--t-micro)/1.35 var(--mono);letter-spacing:.04em;padding:6px 8px;
  border-radius:var(--r-sm);border:2px solid var(--keyline);max-width:100%;overflow-wrap:anywhere}
.vg-ms{background:var(--chip-gold-bg)}
.vg-ms b{font-weight:700}
/* THE SCORE CHIP IS NOT COLOUR CODED AND THAT IS DELIBERATE. A green, yellow
   and red scale would be the only place on this site using hue to encode a
   value, in a palette whose entire claim is that the artwork is the only
   colour on the page. */
.vg-ms i{font-style:normal;font-weight:400;color:var(--gold-deep);text-transform:uppercase}
.vg-no{background:var(--paper-3);color:var(--ink-2);font-weight:400}
.vg-dex{background:var(--paper-2);font-weight:400}
.vg-dex i{font-style:normal;color:var(--gold-deep)}
.vg-tcg{background:var(--keyline);color:var(--paper-2)}
.vg-dead{background:var(--paper-2);color:var(--ink-2);font-weight:400;border-style:dashed}

/* Native details, so a row expands with no script at all and keeps working
   with JS off. 79 rows was already too many for a generated page each; 160 is
   emphatically too many, and thin pages are what build-pages.mjs already
   guards against.

   IT SPANS THE WHOLE ROW AND IT HAS TO. This lived inside .vg-body, the second
   grid column, which is about 206px wide at 390px. Take the card padding, the
   gold border, and a 120px paired cover floated inside it and the definition
   list was left with roughly 60px for two columns: the values rendered ONE
   CHARACTER PER LINE, a vertical ladder spelling out A-u-s-t-r-a-l-i-a. It
   looked like a font bug and it was a containing block that had run out of
   room. Nothing errors when a grid column collapses. */
.vg-more{grid-column:1/-1;grid-row:2;margin-top:10px;min-width:0}
.vg-more summary{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  cursor:pointer;display:inline-flex;align-items:center;min-height:40px;color:var(--ink-2)}
.vg-more summary:hover{color:var(--ink)}
.vg-detail{border-left:3px solid var(--gold);padding:var(--s3);margin-top:6px;background:var(--paper-2);
  border-radius:var(--r-sm)}
/* The paired cover STACKS on a phone and only floats once there is room for
   it beside the text. Floating it at 390px is what started the collapse
   described above: a grid container establishes its own formatting context, so
   it shrinks away from a float rather than flowing under it. */
.vg-detail .is-pair{margin:0 0 var(--s3) 0}
/* Label above value on a phone. Two columns need about 320px before the value
   column is worth having, and this list carries whole sentences. */
.vg-detail dl{display:grid;grid-template-columns:minmax(0,1fr);gap:2px var(--s3);
  font-size:var(--t-sm)}
.vg-detail dd{margin-bottom:8px}
.vg-detail dt{font:700 var(--t-micro)/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2)}
.vg-detail dd{min-width:0;overflow-wrap:anywhere}
.vg-rel{display:flex;flex-wrap:wrap;gap:2px 8px;min-width:0}
.vg-rel span{min-width:0;overflow-wrap:anywhere}
.vg-rel b{font-weight:600}
.vg-rel i{font-style:normal;color:var(--ink-2)}
.vg-rel em{font-style:normal;color:var(--ink-2);font-size:var(--t-micro)}
.vg-quote{display:block;color:var(--ink-2);font-size:var(--t-micro);margin-top:4px}
.vg-guide{margin-top:var(--s3);font-size:var(--t-sm)}
.vg-cite{margin-top:var(--s3);font:400 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.vg-cite a{color:var(--ink)}

.vg-sum{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s3);margin:var(--s5) 0}
.vg-sum div{border:3px solid var(--keyline);border-radius:var(--r);padding:var(--s3);
  background:var(--paper-2);box-shadow:var(--hard-lg)}
.vg-sum b{display:block;font:400 clamp(1.5rem,7vw,2.25rem)/1 var(--display)}
.vg-sum span{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2)}

/* Everything below is min-width, so nothing a phone renders is changed by it.
   THE ANSWER TO A WIDE SCREEN IS MORE CARDS, NOT A WIDER CARD, which is the
   lesson the home page learned the expensive way: a fixed 520px column centred
   in a 1392px wrap used 37% of the width and made the top of that page read as
   a different site from the bottom. */
@media(min-width:700px){
  :root{--vg-box:150px}
  .vg-sum{grid-template-columns:repeat(4,1fr)}
  .vg-detail .is-pair{float:right;margin:0 0 var(--s3) var(--s3)}
  .vg-detail dl{grid-template-columns:minmax(0,auto) minmax(0,1fr);gap:6px var(--s3)}
  .vg-detail dd{margin-bottom:0}
}
@media(min-width:900px){
  :root{--vg-box:160px}
  /* Two columns, so the rail down the left gutter would have to be drawn twice
     and would line up with nothing. It is dropped and the era headers carry the
     structure instead. */
  .vg-list{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4);align-items:start}
  .vg-list::before{display:none}
  .vg-row{margin-bottom:0;padding-left:0;border:2px solid var(--keyline);border-radius:var(--r);
    padding:var(--s3);background:var(--paper-2)}
  .vg-dot{display:none}
}
@media(min-width:1400px){
  .vg-list{grid-template-columns:repeat(3,1fr)}
}
@media(prefers-reduced-motion:no-preference){
  .vg-rail a{transition:background .15s ease}
}
</style>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Every Pokemon Video Game, In Order | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/video-games.html">
<meta property="og:title" content="Every Pokemon video game, in order">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/video-games.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${OG}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${OG}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
${STYLE}
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Every Pokemon video game", item: `${SITE}/video-games.html` },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Reference &bull; ${n(GAMES.length)} games</span>
    <h1>Every Pokemon <span class="hl">video game</span>, in order</h1>
    <p class="lede" style="max-width:44em">Every official Pokemon game we could find a record of, oldest first,
      with its cover, its release date, the machine it ran on and its Metascore where one exists. The card game and
      the video games have run alongside each other since ${firstYear}, and the sets on this site are usually named
      after whatever game shipped that year.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Every Pokemon video game</p>

    <div class="vg-sum">
      <div><b>${n(GAMES.length)}</b><span>Games</span></div>
      <div><b>${n(ERAS.length)}</b><span>Generations</span></div>
      <div><b>${n(coverCount)}</b><span>Covers</span></div>
      <div><b>${n(NATDEX)}</b><span>Species</span></div>
    </div>

    <p>Scroll it and the hardware changes shape under your thumb. Nothing here is cropped: every cover sits inside
      the same square box at its own proportions, so the squat Game Boy carts, the wide N64 and DS boxes and the
      tall Switch keycases are all the shape they really are. ${n(notBoxCount)} of the ${n(coverCount)} images are
      not a box at all, because a phone game has no box and an arcade cabinet is furniture, and those are labelled
      rather than passed off as cover art.</p>

    <p style="margin-top:var(--s3)">${n(tcgCount)} of these are card games, marked so you can find them, and they
      are left in date order rather than pulled into a band of their own. ${n(scoredCount)} carry a Metascore.
      ${n(noEntryCount)} have no Metacritic page and ${n(noPageCount)} have a page with no aggregate score, which
      are two different facts and are printed as two different sentences: every Game Boy core game predates
      Metacritic's coverage of games, and that is not the same as a bad review.</p>

    <p style="margin-top:var(--s3)">Where a game has a Pokedex, the number shown is the count of ENTRIES in that
      game's regional Pokedex, which is a different number from the ${n(NATDEX)} species in the National Pokedex and
      a different number again from how many you can actually catch in it. That third figure is not published, so
      this page does not state it. ${n(dexCount)} of the ${n(GAMES.length)} have a regional dex on record at all.
      Pokemon X and Y has three at once and there is no single Kalos figure, so all three are shown.${
        SPECIES_AGREE
          ? ` The new Pokemon each generation added sum to exactly ${n(NATDEX)}, which is the National Pokedex total
      from the same source, so the two figures on this page check each other.`
          : ` The new Pokemon per generation sum to ${n(speciesSum)} against a National Pokedex of ${n(NATDEX)}, so
      those two figures no longer agree and neither should be trusted until the source is re-read.`
      }</p>

    <p style="margin-top:var(--s3)">What counts as a Pokemon game: everything The Pokemon Company and its partners
      released as a game, including the phone titles, the arcade cabinets, the Pokemon mini library, the browser and
      the Japanese educational releases. Out are Pokemon Bank, Pokemon HOME and the Pokedex apps, which store and
      look things up rather than being played, the demos and the expansion passes, which belong to the game they
      extend, and Super Smash Bros., which is not a Pokemon game.
      ${n(deadCount)} rows say a game is gone, and they say it only where the source says so outright: a row without
      that mark is not a promise that the game still runs.</p>

    <nav class="vg-rail" aria-label="Jump to a generation">
      <div class="vg-rail-in">${rail}</div>
    </nav>

${timeline}
${undatedBlock}

    <p class="price-note" style="margin-top:var(--s7)">Cover artwork belongs to Nintendo, Game Freak, Creatures and
      The Pokemon Company. Images are mirrored here from
      <a href="https://archives.bulbagarden.net" target="_blank" rel="noopener" aria-label="Bulbagarden Archives, opens on archives.bulbagarden.net">Bulbagarden Archives</a>,
      and the titles, platforms and release dates come from
      <a href="https://bulbapedia.bulbagarden.net" target="_blank" rel="noopener" aria-label="Bulbapedia, opens on bulbapedia.bulbagarden.net">Bulbapedia</a>,
      both read ${esc(READ)}. Metascores are
      <a href="https://www.metacritic.com" target="_blank" rel="noopener" aria-label="Metacritic, opens on metacritic.com">Metacritic</a>'s,
      read the same day, and are stored per version rather than averaged. Generation and Pokedex counts are from
      <a href="https://pokeapi.co" target="_blank" rel="noopener" aria-label="PokeAPI, opens on pokeapi.co">PokeAPI</a>.
      Scores marked "Not on Metacritic" mean no page was found at the address Metacritic derives from the title,
      which is a weaker check than a search would be, and Metacritic's own robots file disallows its search.
      Pokemon Champions and Pokemon Pokopia only shipped this year, so their scores are still moving: both were read
      on ${esc(READ)} like everything else here, and that date is the whole warranty. Fan content, not affiliated
      with The Pokemon Company, and nothing on this page is for sale.</p>

    <div class="btn-row" style="margin-top:var(--s5);justify-content:center">
      <a class="btn btn-sm" href="/lore.html">Pokedex facts</a>
      <a class="btn btn-sm" href="/games/">Play our games</a>
    </div>
  </div>
</section>

</main>
${footer("Game covers from Bulbagarden Archives, dex counts from pokeapi.co.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/video-games.html"), page);
console.log(`Wrote public/video-games.html`);
console.log(`  ${GAMES.length} games across ${ERAS.length} generations, ${undated.length} undated`);
console.log(`  ${coverCount} covers (${coverCount - notBoxCount} box art, ${notBoxCount} logo, cabinet or screenshot)`);
console.log(`  ${scoredCount} scored, ${noPageCount} page with no score, ${noEntryCount} no Metacritic page`);
console.log(`  species per generation sum ${speciesSum} against a National Pokedex of ${NATDEX}: ${SPECIES_AGREE ? "agree" : "DISAGREE"}`);
console.log(`  meta description ${desc.length} of 160 characters`);
