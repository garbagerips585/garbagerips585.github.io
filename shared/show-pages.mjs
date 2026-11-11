// Which card show pages exist, and where each show is filed.
//
// ONE DERIVATION, FOUR READERS. scripts/build-shows.mjs writes the calendar and
// the pages under /shows/; build-pages.mjs puts those pages in the sitemap,
// build-search.mjs in the site search and build-llms.mjs in llms.txt. All four
// have to agree about WHICH pages exist and which of them are indexable today,
// and build-pages.mjs runs BEFORE build-shows.mjs in build-all, so it cannot read
// a file the show builder wrote without being one build behind it. A page that
// went noindex this morning would then sit in the sitemap until tomorrow, which
// check-build.py rightly fails. So the rule lives here, as a pure function of
// data/shows.json and the day, and nobody keeps a copy.
//
// NOTHING IN THIS FILE ADDS A FACT. A series page and an area page only
// re-sort rows the owner already confirmed in data/shows.json. No address,
// date, hour, price or organizer is written, guessed or defaulted here.

import { longDate, clipMeta } from "./format.mjs";
import { slugify } from "./paths.mjs";

/**
 * Where a show is filed: the three anchors, the 45 mile rule, the two-city
 * margin and the measured drives. MOVED HERE WHOLE from build-shows.mjs on
 * 11 November 2026, comments and all, because the area pages are decided by
 * exactly the function the area chips use and a second copy would drift.
 */
export function showGeo(data) {
// The page covers three metro areas and nothing else. These feeds are regional
// and cheerfully mix in the Southern Tier, and a national search for "Rochester
// Pokemon league" returns Rochester MINNESOTA and Rochester MICHIGAN before it
// returns ours, so an out-of-area entry is a question of when, not whether.
// Anything not on this list stops the build rather than quietly telling somebody
// in the 585 to drive to another state.
/* WHICH SHOWS BELONG HERE, MEASURED RATHER THAN LISTED.
 *
 * This was a hand-typed Set of about thirty city names, and a hand-typed list of
 * exceptions is the thing this repo has been burned by most: it goes stale the
 * first time somebody adds a show and then it lies without anybody editing it.
 * Every city already carries a lat/lon in _towns, so the rule can just be the
 * rule, and it is the owner's own words: "if a show is within 30-45 miles of the
 * main city filters just add it into that filter."
 *
 * FORTY-FIVE MILES FROM ONE OF THREE ANCHORS. Checked against the calendar as it
 * stood when this went in: the farthest city in use was Batavia at 31.2 miles,
 * and every single city's nearest anchor already matched its declared region,
 * 13 of 13. So this codifies what the data was doing rather than changing it.
 *
 * IT CHECKS THE REGION TOO, which the old Set could not. A show in Dryden filed
 * under Rochester would have passed a name list happily; here the nearest anchor
 * IS the answer, so a mis-filed region is caught rather than shipped. That is a
 * real class of bug on a page whose only navigation is three area buttons.
 *
 * The radius is the one number to argue about. Widening it is a decision about
 * how far the owner will tell somebody to drive, not a technical one. */
const ANCHORS = { roc: [43.1566, -77.6088], buffalo: [42.8864, -78.8784], syracuse: [43.0481, -76.1474] };
const RADIUS_MI = 45;
const milesBetween = ([la1, lo1], [la2, lo2]) => {
  const R = 3958.8, r = (d) => (d * Math.PI) / 180;
  const dp = r(la2 - la1), dl = r(lo2 - lo1);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const nearestAnchor = (pt) =>
  Object.entries(ANCHORS)
    .map(([id, a]) => ({ id, mi: milesBetween(pt, a) }))
    .sort((x, y) => x.mi - y.mi)[0];

const towns = data._towns || {};
/* A TOWN BETWEEN TWO CITIES BELONGS IN BOTH FILTERS. The owner, 29 August 2026:
   "waterloo is honestly pretty much inbetween Syracuse and Rochester so just put
   it in both filters ... if anything is close to more than one city just make it
   filter into both."
   Waterloo is 37.5 miles from Syracuse and 41.5 from Rochester, so it filed
   under Syracuse and the Rochester chip -- the one a Rochester reader obviously
   presses -- deleted the nearest show on the calendar while the hero above kept
   advertising it. `region` still holds the NEAREST anchor, so the build guard
   below still checks the one true filing; this only widens which chips show it.
   DUAL_MI is a margin, not a second radius: a town qualifies for a second city
   only if that city is within 15 miles of being its nearest. */
const DUAL_MI = 15;
const regionsFor = (city) => {
  const pt = towns[city];
  if (!pt) return [];
  const all = Object.entries(ANCHORS)
    .map(([id, a]) => ({ id, mi: milesBetween(pt, a) }))
    .sort((x, y) => x.mi - y.mi);
  const best = all[0];
  return all.filter((a) => a.mi <= RADIUS_MI && a.mi - best.mi <= DUAL_MI).map((a) => a.id);
};
/* A SHOW OUT OF AREA BUT INSIDE A DRIVE STILL BELONGS UNDER THE NEAREST CITY'S
   CHIP. The owner, 8 September 2026, asked for exactly this and set the number:
   "ill take your suggestion of 2 hours drives from the main cities, could maybe
   extended it to 3 hours but not further than that."

   WHAT IT FIXES. `farAfield` rows get region "away", which no chip carries, so
   they appeared ONLY under All. A Buffalo collector pressing "Buffalo & Niagara"
   -- the obvious thing to press -- never saw the Erie show at all, though it is a
   two hour drive and the nearest out-of-state show to them. That is the same
   fault the DUAL_MI note above describes for Waterloo: the chip a reader
   obviously presses hiding the show they would most want.

   IT IS A DRIVE, NOT A RADIUS, AND THAT DISTINCTION IS THE WHOLE POINT. The 45
   mile rule stays where it is and stays in straight lines; this reads measured
   ROAD time out of data/shows.json's `_drives`, which is why Erie qualifies at
   92 road miles when its 81 mile straight line tells you nothing useful about a
   lake shore. Nothing is computed here and no build touches the network.

   SET AT TWO HOURS, HIS PRIMARY NUMBER, NOT THE THREE HE WOULD TOLERATE, AND
   TODAY THE TWO ARE THE SAME PAGE. Measured: Erie is 1h59m from Buffalo and
   3h19m from Rochester, NY; Harmony PA is 3h41m from Buffalo, its own nearest
   city. So at 2 hours exactly one pairing qualifies, Erie under Buffalo, and at
   3 hours it is still exactly that one -- Erie/Rochester and Harmony/Buffalo both
   fall outside either way. Taking the tighter number costs nothing today and is
   one constant to move when it does. Do not raise it past 3. */
const DRIVE_HOURS = 2;
const drives = data._drives || {};
const driveFor = (city) => {
  const dr = drives[city];
  return dr && typeof dr.hours === "number" ? dr : null;
};
/* The nearest city's chip, but ONLY when the measured drive is inside the
   threshold. A town with no measured drive returns nothing, which is the honest
   default: absent evidence is not a short drive. */
const driveRegions = (city) => {
  const dr = driveFor(city);
  return dr && dr.hours <= DRIVE_HOURS && dr.anchor ? [dr.anchor] : [];
};
/* Straight-line chips first, then any earned by a drive, de-duplicated. Falls
   back to the row's own `region` so an away show with no qualifying drive still
   carries "away" and still appears under All, exactly as before. */
const chipRegions = (s) => {
  const merged = [...new Set([...regionsFor(s.city), ...driveRegions(s.city)])];
  return merged.length ? merged : [s.region];
};
return { ANCHORS, RADIUS_MI, DUAL_MI, DRIVE_HOURS, towns, milesBetween, nearestAnchor, regionsFor, driveFor, driveRegions, chipRegions };
}

/* ------------------------------------------------------------------ runs --
 * A RUN is consecutive days with the same name and venue: Buffalo Trading Card
 * Con is three rows in the file and one show to a reader. Moved from
 * build-shows.mjs unchanged; the reasoning is in the note over FAR_DAYS there. */
const dayGap = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
export function toRuns(list) {
  const out = [], open = new Map();
  for (const s of list) {
    const k = `${s.name}|${s.venue}`, prev = open.get(k);
    if (prev && dayGap(prev.days[prev.days.length - 1].date, s.date) === 1) {
      prev.days.push(s);
      prev.last = s.date;
      for (const v of s.vendors || []) if (!prev.vendors.some((x) => x.name === v.name)) prev.vendors.push(v);
      for (const f of ["flyer", "flyerW", "flyerH", "blurb", "url", "ticketUrl", "phone", "organiserUrl", "logo"]) {
        if (!prev[f] && s[f]) prev[f] = s[f];
      }
      continue;
    }
    const r = { ...s, days: [s], last: s.date, vendors: [...(s.vendors || [])] };
    open.set(k, r);
    out.push(r);
  }
  return out;
}

/* ----------------------------------------------------------- the pages ----
 *
 * /shows/<slug>.html, two kinds, approved by the owner on 11 November 2026.
 * /card-shows.html is one page holding every show in three metro areas, so a
 * search for "Batavia Pokemon show" or "card shows near Buffalo" landed on a
 * 430KB calendar and had to find its own row. These pages are that calendar
 * cut two ways and nothing else.
 *
 * AN AREA PAGE PER FILTER CHIP, and membership is chipRegions(), the same call
 * the chip makes. No new geography: Batavia is filed under Rochester, NY
 * because the 45 mile rule files it there, so it is on that page and has none
 * of its own. `chip` must match the label build-shows.mjs prints on the button,
 * and that builder checks it.
 *
 * A SERIES IS ROWS THAT SHARE A NAME AND A TOWN, EXACTLY. Not similar names:
 * "Northtowns Card & Memorabilia Show" and "Northtowns Pokemon & TCG Card Show"
 * are two shows in the same hall, and "Batavia Card & Collectibles Show" is not
 * "585Cardz Batavia Card & Collectibles Show". The town is in the key rather
 * than the venue because RocPokeCon has moved between two buildings at RIT and
 * is still one show; a name that turned up in two towns would be two series.
 *
 * WHICH SERIES GET A PAGE: two or more rows dated on or after SHOW_PAGES_SINCE.
 * That one test is "has this series ever had a page". The page is for a series
 * with two or more dates ahead of it, and the first build that could have made
 * one was on SHOW_PAGES_SINCE, so a series holding two rows from that day on
 * has had two dates ahead of it at some build and a series without them never
 * has. It is counted over ROWS THAT STAY IN THE FILE, which is what makes the
 * page permanent: when the dates pass, the rows are still there, the page is
 * still built, and somebody's bookmark does not 404.
 *
 * AND WHAT HAPPENS TO IT THEN is `indexable`. With one or more dates still
 * ahead it is a normal page. With none it is built in its empty state, marked
 * noindex and left out of the sitemap, the search index and llms.txt, because a
 * page that says "no upcoming dates" is worth keeping for a bookmark and worth
 * nothing to a stranger. It comes back by itself when a new date is added.
 *
 * DO NOT MOVE SHOW_PAGES_SINCE FORWARD. It is the day these pages first
 * existed, not a freshness stamp; moving it un-builds pages people have saved.
 */
export const SHOW_PAGES_SINCE = "2026-11-11";

export const SHOW_AREAS = [
  { id: "roc", slug: "rochester-ny", city: "Rochester, NY", chip: "Rochester, NY" },
  { id: "buffalo", slug: "buffalo-ny", city: "Buffalo, NY", chip: "Buffalo & Niagara" },
  { id: "syracuse", slug: "syracuse-ny", city: "Syracuse, NY", chip: "Syracuse" },
];

const norm = (t) => String(t ?? "").trim().normalize("NFC").toLowerCase().replace(/\s+/g, " ");
/* slugify() drops what it cannot spell, so "RocPokéCon" came out "rocpok-con".
   The accent is folded first and only for the url; the page prints the name. */
const plain = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const seriesKey = (s) => `${norm(s.name)}|${norm(s.city)}`;

/* TOWN AND STATE AS THE ROWS HOLD THEM. The city field carries a state only
   where the owner wrote one ("Rochester, NY", "North East, PA"). Everywhere
   else the state is read off the tail of the printed address, the same tail the
   Event markup reads, and only when every row of the series agrees. A series
   with no address to read it from gets its town alone rather than an assumed
   "NY": EC3CON is in Connecticut. */
function placeOf(rows) {
  const city = String(rows[0].city || "");
  if (/,\s*[A-Z]{2}$/.test(city)) return city;
  const states = new Set(
    rows.map((r) => (/,\s*[^,]+,\s*([A-Z]{2})(?:\s+\d{5})?\s*$/.exec(r.address || "") || [])[1]).filter(Boolean)
  );
  return states.size === 1 ? `${city}, ${[...states][0]}` : city;
}

const byDate = (a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || "");
const nDates = (n) => `${n} upcoming ${n === 1 ? "date" : "dates"}`;

/**
 * Every page under /shows/, decided from the data and the day.
 * @param {object} data   data/shows.json, parsed
 * @param {string} today  YYYY-MM-DD on the local calendar (shared/today.mjs)
 */
export function showPagePlan(data, today) {
  const geo = showGeo(data);
  const all = [...(data.shows || [])].sort(byDate);
  // The same test /card-shows.html uses, so a show cannot be upcoming on one
  // page and gone on another.
  const isUp = (s) => s.date >= today;
  const checked = longDate(data.checked) || data.checked || "";
  const areaIds = new Set(SHOW_AREAS.map((a) => a.id));

  const groups = new Map();
  for (const s of all) {
    const k = seriesKey(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const taken = new Map(SHOW_AREAS.map((a) => [a.slug, `the ${a.city} area page`]));
  const series = [];
  for (const [key, rows] of groups) {
    if (rows.filter((s) => s.date >= SHOW_PAGES_SINCE).length < 2) continue;
    const upcoming = rows.filter(isUp);
    const runs = toRuns(upcoming);
    // The newest row names it, so a show that corrects its own spelling is
    // printed the way it spells itself now.
    const name = rows[rows.length - 1].name;
    const place = placeOf(upcoming.length ? upcoming : rows);
    let slug = slugify(plain(name));
    if (!slug || taken.has(slug)) slug = slugify(plain(`${name} ${rows[0].city}`));
    if (!slug || taken.has(slug)) {
      throw new Error(
        `Card show series "${name}" (${rows[0].city}) wants /shows/${slug}.html, which is already ` +
        `${taken.get(slug) || "empty"}. Two pages cannot share a url; rename one show in data/shows.json.`
      );
    }
    taken.set(slug, `the series "${name}"`);
    const areas = [...new Set((upcoming.length ? upcoming : rows).flatMap((s) => geo.chipRegions(s)))]
      .filter((id) => areaIds.has(id));
    const title = [`${name}: Upcoming Dates in ${place}`, `${name}: ${place} Dates`, `${name} Dates`]
      .find((t, i, a) => t.length <= 60 || i === a.length - 1);
    const desc = clipMeta(upcoming.length
      ? `${name}, ${place}: ${nDates(runs.length)} with hours, admission, venue and directions. Listings checked ${checked}.`
      : `${name}, ${place}: no upcoming dates are listed right now. The full card show calendar has what is on.`);
    series.push({
      kind: "series", key, name, slug, path: `/shows/${slug}.html`, place, rows, upcoming, runs, areas,
      indexable: upcoming.length > 0, title, desc, mod: data.checked || null,
      search: [name, `/shows/${slug}.html`, `Card show dates • ${place}`],
    });
  }
  series.sort((a, b) => a.name.localeCompare(b.name));

  const areas = SHOW_AREAS.map((a) => {
    const upcoming = all.filter((s) => isUp(s) && geo.chipRegions(s).includes(a.id));
    const runs = toRuns(upcoming);
    const townList = [...new Set(upcoming.map((s) => s.city))];
    const n = runs.length;
    return {
      kind: "area", ...a, path: `/shows/${a.slug}.html`, upcoming, runs, towns: townList,
      indexable: upcoming.length > 0, mod: data.checked || null,
      title: `Card Shows Near ${a.city}: Upcoming Dates`,
      desc: clipMeta(n
        ? `${n} upcoming card ${n === 1 ? "show" : "shows"} near ${a.city}, in date order, with hours, admission, venue addresses and directions. Listings checked ${checked}.`
        : `No upcoming card shows near ${a.city} are listed right now. The full card show calendar has what is on.`),
      search: [`Card shows near ${a.city}`, `/shows/${a.slug}.html`, `${n} upcoming ${n === 1 ? "show" : "shows"}, in date order`],
      series: series.filter((x) => x.upcoming.length && x.areas.includes(a.id)),
    };
  });

  const pages = [...areas, ...series];
  const titles = new Map();
  for (const p of pages) {
    if (titles.has(p.title)) {
      throw new Error(`Two card show pages share the title "${p.title}": ${titles.get(p.title)} and ${p.path}.`);
    }
    titles.set(p.title, p.path);
  }
  /** The series page for a row or a run, if that series has one. */
  const byKey = new Map(series.map((x) => [x.key, x]));
  const seriesFor = (s) => byKey.get(seriesKey(s)) || null;
  return { series, areas, pages, indexable: pages.filter((p) => p.indexable), seriesFor };
}
