#!/usr/bin/env node
// Build /rochester.html, the front door to the local section.
//
//   node scripts/build-rochester.mjs
//
// WHY THIS PAGE EXISTS, AND WHY THE FIVE PAGES ALONE WERE NOT ENOUGH.
// /card-shows.html, /shops.html, /vendors.html, /creators.html and
// /garbage-plate.html are five good pages with nothing above them. That is a
// menu section, not a hub: the only thing that said they belong together was a
// heading in the nav, no one of them said what the local scene IS, and none of
// them linked the other four. A reader who landed on the shop list from a
// search had no way to discover the card show calendar existed.
//
// The owner, on what the site is for: "I want to be a hub for the local community to
// showcase what they do best, this area is massive for pokemon cards and i want
// the world to know". You cannot tell somebody that in a nav heading. This is
// the page that says it, with the numbers under it.
//
// IT OWNS NO FACTS AND EVERY NUMBER ON IT IS COUNTED. That is the same
// discipline /start.html keeps and the reason it can be trusted: a fact lives on
// the page that owns it, so there is one place to fix it, and every figure here
// is read out of data/shows.json, data/shops.json, data/vendors.json,
// data/creators.json and data/garbage-plate.json at build time. Nothing on this
// page is typed. If a show expires the count drops on its own; if the owner adds a
// vendor the "two vendors" sentence rewrites itself and the paragraph admitting
// the list is short switches itself off.
//
// AND IT SAYS WHERE THE CLAIM RUNS OUT, WHICH IS THE HARDER HALF. The brief was
// to make the section deserve a promotion to second in the nav, and the honest
// answer the data gives is split: the shows and the shops carry the claim
// easily, and the two pages about PEOPLE carry nothing, because they hold four
// entries between them. So the closing section prints both halves. A hub that
// only quotes its good numbers is an advert, and this site's whole credibility
// is that a reader can check it.
//
// NO NEW DATA FILE, WHICH WAS THE OTHER OPTION AND WOULD HAVE BEEN WRONG. A
// data/rochester.json would be a sixth file to keep in step with the five that
// already exist, and everything a hub page needs is a projection of them. The
// only hand-written prose here is the copy in this file, exactly as
// build-start.mjs does it.
//
// NOT A MAP, AND THAT IS DECIDED RATHER THAN OVERLOOKED. The obvious picture for
// a page about a region is a map, and there are two on this site already:
// /card-shows.html draws 147 miles of Lake Ontario shore and Thruway and
// /shops.html draws 24 miles of Rochester. Both are fed by their own OSM
// geometry file and both took real work to make legible at 390px. A THIRD map
// here would either duplicate 300 lines that will drift out of step with the two
// real ones, or be the dotted field with no roads on it that CLAUDE.md records
// the owner rejecting BY NAME on both of those pages. The maps are one tap away and
// they are better than anything this page would draw. What this page gets
// instead is one real photograph and the drawn plate, which is the thing the
// channel is named after and the only mark on the site a Rochester reader
// recognises instantly.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, CONTACT_EMAIL, mailtoHref} from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where it
// sits: the two links to the channel go to /videos.html and to the rip pages,
// which carry their own player. Same call and same reasoning as
// build-locals.mjs and build-start.mjs; the three conditions a page has to meet
// before a tile plays in place are written beside the two exports in
// shared/chrome.mjs. READ THAT BEFORE PUTTING A VIDEO TILE ON THIS PAGE.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, shortDate, plateRule, PLATE_CSS, clipMeta} from "../shared/format.mjs";
import { localDay } from "../shared/today.mjs";
import { strip as miniCSS } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const showsDoc = await read("data/shows.json");
const shopsDoc = await read("data/shops.json");
const vendorsDoc = await read("data/vendors.json");
const creatorsDoc = await read("data/creators.json");
const plateDoc = await read("data/garbage-plate.json");

// ---------------------------------------------------------------------------
// EVERY NUMBER THIS PAGE PRINTS, DERIVED HERE AND NOWHERE ELSE.
//
// TODAY IS localDay() AND NOT toISOString(). The card show list is filtered on
// the date, and shared/today.mjs exists because forty-one scripts got this
// wrong in the same way: after 8pm in Rochester, UTC is already tomorrow, so a
// naive filter sweeps a show off this page on the evening BEFORE it happens.
const today = localDay();
const upcoming = (showsDoc.shows || [])
  .filter((s) => s.date >= today)
  .sort((a, b) => a.date.localeCompare(b.date));

const shops = shopsDoc.shops || [];
/* Counted, never assumed: GI Cards is on the list with no address, so
   shops.length overstates every claim about doors and hours by one. */
const withAddr = shops.filter((s) => s.address).length;
const vendors = vendorsDoc.vendors || [];
const creators = creatorsDoc.creators || [];
const plates = plateDoc.places || [];

const nShows = upcoming.length;
const showDays = new Set(upcoming.map((s) => s.date));
const showTowns = new Set(upcoming.map((s) => s.city));
const showRegions = new Set(upcoming.map((s) => s.region));
const first = upcoming[0]?.date || null;
const last = upcoming[upcoming.length - 1]?.date || null;

/* THE CADENCE FIGURE, AND IT IS THE ONE NUMBER ON THIS PAGE WORTH ARGUING ABOUT.
   "23 shows" is a big number with no shape: 23 shows in one weekend and 23 shows
   over five years are the same figure and mean opposite things. What a reader
   actually wants to know is whether there is something on THIS weekend, so the
   claim is stated as weeks covered out of weeks in the stretch.

   COUNTED FROM THE FIRST SHOW, NOT FROM THE ISO WEEK NUMBER. Two shows on a
   Saturday and the Sunday after it fall in different ISO weeks and would count
   twice; a Saturday and the Sunday BEFORE it fall in the same one and would
   count once. Neither is what the sentence means. Bucketing on days-since-the-
   first-show makes every bucket exactly seven days long, which is what "most
   weeks" is a claim about.

   BOTH HALVES ARE PRINTED, ALWAYS. "15 weeks have a show" alone is the advert;
   "15 of the 18" is the fact, and it is the version a reader can disagree with. */
const DAY = 86400000;
const weekOf = (iso) => Math.floor((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / (7 * DAY));
const weeksWithShow = first ? new Set(upcoming.map((s) => weekOf(s.date))).size : 0;
const weeksSpanned = first ? weekOf(last) + 1 : 0;

// Shops that publish something you can turn up and play at. `plays` is the
// confirmed list on a shop card; data/shops.json's readme is explicit that an
// unconfirmed league night does not go in, because the cost of being wrong is
// somebody driving across town to a dark room. So this counts the confirmed
// ones and the copy says "publish", not "run".
const playShops = shops.filter((s) => (s.plays || []).length);

// The dish, counted the way /garbage-plate.html counts it: places that serve
// one, and the sources under the history. The second number is the interesting
// one and it is the reason that page is the strongest in this section.
const nPlates = plates.length;
const nPlateSources = (plateDoc.sources || []).length;
const nPlatePhotos = (plateDoc.photos || []).length;
/* THE NUMBER OF NAMES, NOT THE NUMBER OF PLACES, AND THEY ARE ONLY EQUAL BY
   ACCIDENT TODAY. Both read eleven, which is exactly how a typed figure survives
   a proofread: write the wrong one and it looks right until somebody opens a
   twelfth restaurant serving a Trash Plate. The reason there are so many names
   is on data/garbage-plate.json's own listNote and it is a matter of record
   rather than a joke: Nick Tahou Hots holds the trademark on the two words, so
   everybody else has to call theirs something else. */
const nPlateNames = new Set(plates.map((p) => p.plateName).filter(Boolean)).size;

// The two pages about people. Counted rather than described, because these are
// the two numbers that do NOT support the claim and the page says so.
const nVendors = vendors.length;
const nCreators = creators.length;

// ---------------------------------------------------------------------------
// THE PHOTOGRAPH.
//
// ONE, AND IT IS THE PLATE, because it is the only picture on this site that a
// stranger scrolling past would stop on and the only one that says Rochester
// without a caption. It is already in the tree with its renditions:
// scripts/sync-plate-photos.py wrote the .webp and the .avif of every width
// together, which is what makes the <source> safe, and the same photograph is
// the hero of /garbage-plate.html.
//
// THE CREDIT IS NOT DISCRETIONARY AND THAT IS WHY THIS PAGE CARRIES TWO
// OUTBOUND LINKS. CLAUDE.md's outbound rule is a judgement about what a reader
// needs, everywhere on this site except here: this photograph is CC BY, and that
// license is granted ON CONDITION of naming the photographer and linking the
// deed. A page that prints the picture and drops the credit is not making a
// tidier editorial choice, it is using the picture outside the terms it was
// offered under. Both links are aria-labelled as leaving the site and both sit
// in the figure's own credit line, which is the one place this site puts a link
// inside a sentence and the exception is argued in CLAUDE.md under the Garbage
// Plate page. If the photograph ever comes off this page, these two go with it
// in the same edit.
//
// PUBLIC DOMAIN GETS NO LICENSE LINK, because there is no license to link to,
// and the copy says that in words rather than printing a bare "Public domain"
// that reads like a deed nobody can check. Lifted from photoFig() in
// build-garbage-plate.mjs so the two pages credit the same picture the same way.
const hero = (plateDoc.photos || []).find((p) => p.where === "hero") || (plateDoc.photos || [])[0];

function plateFigure(ph) {
  if (!ph) return "";
  const widths = [400, 800].filter((w) => w <= Math.min(ph.maxw, ph.w));
  if (!widths.length) return "";
  const base = `/assets/plates/${ph.slug}`;
  const set = (ext) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  // Capped at 520 because this figure sits in a two-up next to the copy above
  // 760px and full bleed below it. A sizes of 100vw here would pull the 800
  // rendition onto a phone that renders it at 350.
  const sizes = "(min-width:760px) 520px, 100vw";
  const img =
    `<img src="${base}-${widths[0]}.webp" srcset="${set("webp")}" sizes="${esc(sizes)}"` +
    ` width="${ph.w}" height="${ph.h}" loading="lazy" decoding="async" alt="${esc(ph.alt)}">`;
  const who =
    `<a href="${esc(ph.page)}" rel="noopener" target="_blank" aria-label="${esc(ph.by)}'s photograph on ` +
    `Wikimedia Commons, where its license is stated, opens on commons.wikimedia.org">${esc(ph.by)}</a>`;
  const lic =
    ph.license === "Public domain"
      ? "released into the public domain"
      : `<a href="${esc(ph.licenseUrl)}" rel="noopener" target="_blank" aria-label="The ${esc(
          ph.license,
        )} license deed, opens on creativecommons.org">${esc(ph.license)}</a>`;
  return `<figure class="roc-fig">
        <picture><source type="image/avif" srcset="${set("avif")}" sizes="${esc(sizes)}">${img}</picture>
        <figcaption>A Garbage Plate at ${esc(plates[0]?.name || "Nick Tahou Hots")}, photographed on
          ${esc(ph.taken)}. Photograph by ${who}, ${lic}, via Wikimedia Commons.</figcaption>
      </figure>`;
}

// ---------------------------------------------------------------------------
// THE COUNTED BAND.
//
// SIX FIGURES, EACH WITH THE SENTENCE THAT MAKES IT CHECKABLE UNDER IT. A row of
// big numbers with one-word labels is a marketing block; what makes this one
// usable is that every tile says what was counted and over what stretch, so a
// reader can disagree with it. The two thin ones are in the same row as the four
// strong ones on purpose: pulling them out would be the advert version.
//
// A TILE WITH NOTHING IN IT DOES NOT RENDER. If the show calendar empties out
// between refreshes the tile goes rather than printing a zero, for the same
// reason /shops.html refuses to publish an unconfirmed league night: a zero here
// reads as "there are no card shows in Rochester", which is a claim about the
// city rather than about our list.
const stat = (n, unit, note) =>
  n
    ? `        <li><span class="roc-n">${esc(String(n))}</span><span class="roc-u">${esc(unit)}</span>
          <p>${note}</p></li>`
    : "";

const STATS = [
  stat(
    nShows,
    nShows === 1 ? "card show" : "card shows",
    `On ${showDays.size} different days in ${showTowns.size} towns, from ${esc(longDate(first) || "")} to
       ${esc(longDate(last) || "")}. Listed on the <a href="/card-shows.html">card show calendar</a>.`,
  ),
  stat(
    weeksWithShow,
    `of ${weeksSpanned} weeks`,
    `have a show somewhere in reach. That is the number worth knowing: not how many there are, but
       whether there is one on the weekend you are free.`,
  ),
  stat(
    shops.length,
    shops.length === 1 ? "card shop" : "card shops",
    `${withAddr} of them with a door, an address and opening hours, and ${playShops.length} publishing organized play you can show
       up to. All on <a href="/shops.html">the shop list</a>.`,
  ),
  stat(
    nPlates,
    "places serve a plate",
    `Under ${nPlateNames} different ${nPlateNames === 1 ? "name" : "names"}, because Nick Tahou Hots holds the
       trademark on the two words everybody else has to work around. ${nPlateSources} sources and ${nPlatePhotos}
       photographs on <a href="/garbage-plate.html">the plate page</a>.`,
  ),
  stat(
    nVendors + nCreators,
    "vendors and creators",
    `And this is the thin one. ${nVendors} on <a href="/vendors.html">the vendor list</a>, ${nCreators} on
       <a href="/creators.html">the creator list</a>. Not a survey of the area: a count of who has been in touch,
       and both pages now say exactly how to change it.`,
  ),
].filter(Boolean);

// ---------------------------------------------------------------------------
// THE NEXT SHOWS.
//
// REAL ROWS AND NOT A LINK, WHICH IS THE WHOLE DIFFERENCE BETWEEN A HUB AND A
// MENU. A landing page that says "we have a card show calendar" and links it has
// told the reader nothing they could not have got from the nav. Four rows with a
// date, a town and a venue on them answer the actual question, and the reader who
// wants the other nineteen taps through.
//
// FOUR, AND THE NUMBER IS ARGUED. Two is not enough to show the cadence the band
// above claims; eight is the calendar page rebuilt badly on a page that is not
// it. Four fits above the fold at 1440 and is two screens at 390.
const NEXT = 4;
const nextShows = upcoming.slice(0, NEXT);
const showRow = (s) => `        <li>
          <span class="roc-d"><b>${esc(shortDate(s.date))}</b></span>
          <span class="roc-s"><b>${esc(s.name)}</b>${
            s.pokemon ? `<span class="roc-flag">All Pokemon</span>` : ""
          }<span>${esc([s.venue, s.city].filter(Boolean).join(", "))}</span></span>
        </li>`;

// ---------------------------------------------------------------------------
// THE SHOPS.
//
// ONE LINE EACH AND NO ADDRESSES. The shop page holds the address, the phone,
// the hours, the league nights and the map, and copying any of that here would
// be two pages to keep in step with one shop's opening hours. What a hub can add
// is the thing /shops.html makes you read six cards to work out: which one is
// which. So each row is the name, where it is, and the first thing its own card
// says it is good for.
const shopRow = (s) => `        <li>
          <b>${esc(s.name)}</b>
          <span>${esc(s.area || "")}</span>
          ${(s.goodFor || []).length ? `<span class="roc-tags">${(s.goodFor || []).slice(0, 3).map((g) => `<span>${esc(g)}</span>`).join("")}</span>` : ""}
        </li>`;

// ---------------------------------------------------------------------------
const TITLE = "Pokemon Cards in Rochester, NY: Shows, Shops, Local Scene";

const H1 = 'Pokemon in <span class="hl">Rochester</span>, NY';
const KICKER = "585 &bull; The local scene";

/* THE NAV LABEL, AND THE GUARD THAT KEEPS THE PAGE SAYING IT BACK.
 *
 * This page is linked from the menu as "Local scene", inside a group headed
 * "Rochester, NY". The nav's rule for a label is that the page has to ECHO it:
 * somebody who taps a word in a menu should see that word when they land, or
 * they cannot tell whether they arrived. That rule is enforced in the nav's own
 * file for every OTHER link, and it could not be enforced for this one, because
 * shared/chrome.mjs holds the label and this file holds the page.
 *
 * SO THE CHECK LIVES ON THE PAGE'S SIDE and it is written as a THROW rather than
 * as a comment saying "keep these in step", which is the shape checkCities() and
 * checkVouch() take in build-locals.mjs and for the same reason: the last three
 * times a sentence on those pages drifted from its data, a person reading the
 * page caught it and the build did not.
 *
 * IT CHECKS THE WORDS AND NOT THE STRING. "Local scene" does not appear in the
 * h1 and must not have to: the h1 is "Pokemon in Rochester, NY" because that is
 * the search this page is for, and a title and a menu label are allowed to
 * differ, which is an argument build-locals.mjs already makes for /creators.html
 * keeping three cities in its title. What may NOT happen is the label and the
 * page sharing no word at all. Both content words are matched, "local" and
 * "scene", against the title, the h1 and the kicker together.
 *
 * IF THIS THROWS, the fix is almost never to bend the page: it is that somebody
 * renamed the nav entry. Change it back, or change this constant AND tell
 * whoever owns shared/chrome.mjs, because those two are one decision. */
const NAV_LABEL = "Local scene";
{
  const said = `${TITLE} ${H1} ${KICKER}`.toLowerCase();
  const missing = NAV_LABEL.toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .filter((w) => !said.includes(w));
  if (missing.length) {
    throw new Error(
      `build-rochester: the nav calls this page "${NAV_LABEL}" and the page never says ` +
        `${missing.map((w) => `"${w}"`).join(" or ")}.\n` +
        `  Checked against the title, the h1 and the kicker:\n` +
        `    title:  ${TITLE}\n` +
        `    h1:     ${H1.replace(/<[^>]*>/g, "")}\n` +
        `    kicker: ${KICKER.replace(/&bull;/g, "-")}\n` +
        `  A reader who taps a word in the menu has to see that word when they land, or they\n` +
        `  cannot tell they arrived. Put the word back on the page, or rename NAV_LABEL here\n` +
        `  AND the entry in shared/chrome.mjs, which is one decision and not two.`
    );
  }
  if (NAV_LABEL.length > 20) {
    throw new Error(
      `build-rochester: the nav label "${NAV_LABEL}" is ${NAV_LABEL.length} characters and the ` +
        `footer link grid is 138px wide, which is 20.\n` +
        `  Anything longer wraps in the footer, where every other label is one line.`
    );
  }
}

const desc =
  `Pokemon cards in Rochester, New York: ${nShows} card shows coming up, ${shops.length} local card shops, ` +
  `the vendors and creators around the 585, and the Garbage Plate the channel is named after.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      /* "Local scene", the SAME name the nav item, the four sibling pages'
         crumbs and the routing rows all use. It was "Rochester, NY" for an
         afternoon, which is the heading of the nav group this page sits INSIDE:
         a group and its own child reading identically is the two-names-one-page
         failure shared/chrome.mjs exists to stop, arrived at from the other
         direction. The argument in full is beside HUB in build-locals.mjs. */
      { "@type": "ListItem", position: 2, name: "Local scene", item: `${SITE}/rochester.html` },
    ],
  },
  /* A SiteNavigationElement AND NOT A CollectionPage. This page is the entrance
     to five others and the useful thing to tell a crawler is which five, in
     order. Marking it up as a collection would claim the five pages are items IN
     it, which is what an ItemList on /vendors.html means about two vendors, and
     it is not what this page is. */
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Pokemon in Rochester, NY",
    itemListElement: [
      ["Card shows", "/card-shows.html"],
      ["Card shops", "/shops.html"],
      ["Local vendors", "/vendors.html"],
      ["Local creators", "/creators.html"],
      ["Garbage Plate", "/garbage-plate.html"],
    ].map(([name, url], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      url: `${SITE}${url}`,
    })),
  },
];

/* THE PAGE CSS.
   miniCSS strips every word of this before it ships, which is the only reason it
   can be written at length: an inline style block is render blocking exactly as
   ui.css is, and stamp-assets.mjs measured 8.07% of all the HTML this site
   serves as comments in blocks like this one.

   NOTHING HERE IS A NEW COLOUR. Every value is a token out of ui.css and the two
   accents keep their jobs: teal is every route, so the links in the tiles and the
   card headings that ARE links take --sky-deep, and pink is every mark that goes
   nowhere, so the big counted numbers take --ketchup-deep. A section heading is
   neither, which is why .roc-sec h2 is not styled here at all and inherits the
   off-white ui.css already gives it.

   --ketchup-deep AND NOT --ketchup ON THE BIG NUMBERS, EVEN THOUGH THEY ARE
   BIG. CLAUDE.md's rule is that the big pink is not "large text" at the sizes
   this site uses: WCAG wants 24px, or 18.66px bold, before the 3:1 gate applies,
   and #E87EA1 measures 3.45:1 on the card. These clamp from 30px up, which does
   clear 24, but they are the same figure as the small unit label beside them and
   a number that changes colour when the viewport crosses a breakpoint is worse
   than one that is always the safe pink. Deep everywhere.

   THE TILE IS --card AND THE ROW IS --paper, WHICH IS THE FIVE PAINTED STEPS
   DOING THEIR JOB. A card sits above the page ground and a well sits below it.
   --paper-3 is deliberately NOT used for anything with a small accent on it:
   under Trubbish Deep it is the LIGHTEST surface there is and a small teal on it
   measures 3.60:1, which is the trap CLAUDE.md records three rules falling into.

   THE GRIDS ARE auto-fit WITH A minmax FLOOR AND THE FLOOR IS THE POINT. At 320
   a fixed two-column stat grid gives each tile 148px, and "of 18 weeks" is one
   nowrap unit label 122px wide with 24px of padding around it, so the tile
   overflows its own row. minmax(0,1fr) inside auto-fit lets the grid collapse to
   one column instead of pushing past the right edge, which is the same fault and
   the same fix build-start.mjs records for its rarity ladder at 320. */
const style = `
${PLATE_CSS}
.roc-stats{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));
  gap:var(--s3);margin-top:var(--s4);padding:0}
.roc-stats li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.roc-n{display:block;font:400 clamp(30px,7vw,44px)/1 var(--display);color:var(--ketchup-deep)}
.roc-u{display:block;margin-top:4px;font:700 var(--t-micro)/1.3 var(--mono);letter-spacing:.09em;
  text-transform:uppercase;color:var(--ink-soft)}
.roc-stats p{margin-top:var(--s3);font-size:var(--t-sm);line-height:1.6;color:var(--ink-2);max-width:none}
.roc-stats a{color:var(--sky-deep);text-decoration:underline;text-underline-offset:2px}

.roc-rows{list-style:none;display:grid;gap:var(--s2);margin-top:var(--s4);padding:0;max-width:44em}
.roc-rows li{background:var(--paper-2);border:1px solid var(--hair);border-radius:var(--r-sm);
  padding:12px 14px;display:grid;gap:2px}
.roc-rows b{font:600 var(--t-sm)/1.35 var(--body);color:var(--ink)}
.roc-rows span{font-size:var(--t-sm);color:var(--ink-2)}
.roc-shows li{grid-template-columns:auto 1fr;gap:var(--s3);align-items:baseline}
.roc-d b{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-soft);white-space:nowrap}
.roc-s{display:grid;gap:2px;min-width:0}
.roc-flag{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ketchup-deep)}
.roc-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.roc-tags span{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase;
  background:var(--paper);border-radius:999px;padding:6px 9px;color:var(--ink-soft)}
/* TWO COLUMNS ON A WIDE SCREEN, AND THE 44em CAP GOES WITH IT. These rows are
   CARDS and not prose: a shop row is a name, a street and three chips, so the
   reading-measure cap that is right for a paragraph left 690px of empty band
   beside a column of them at 1440. That is the fault CLAUDE.md records .fk-golden
   having in the opposite direction on /vendors.html, where the box took the whole
   1,392px band and its paragraph capped at 504.
   1000 is ui.css's own desktop breakpoint, the same one that caps figcaptions at
   --measure, so this page has one idea of "desktop" rather than a second. Below
   it nothing moves: the cap is wider than the wrap at every phone and tablet
   width, so the single column at 390 is exactly what it was. */
@media(min-width:1000px){
.roc-rows{max-width:none;grid-template-columns:1fr 1fr}
}

/* THE FIGURE AND ITS COPY, SIDE BY SIDE ONLY WHEN THERE IS ROOM. 760 is where
   ui.css already puts .set-watch into two columns, so the page has one
   breakpoint for "a picture can sit beside a paragraph" rather than two. */
.roc-plate{display:grid;gap:var(--s4);align-items:start;margin-top:var(--s4)}
/* 760 WAS TOO LOW FOR A FIXED 520px TRACK, and at 768 it broke the column it
   was meant to create. The wrap is 720 there, so the 1fr track resolved to 184px and
   the text column carried 382px and 437px of copy in a 184px ribbon, beside a
   figure only 431px tall in an 896px row -- a void to the right AND below.
   The text column needs about 380px, which needs 380 + 520 + 16 = 916 of wrap,
   which is a viewport near 964. 1000 is the site's existing desktop
   breakpoint, so it is used rather than inventing a third one. Measured after:
   at 768 it stacks, text 720 wide, block 896 -> 868; at 1440 unchanged, text
   856 and figure 520 at x=896. */
@media(min-width:1000px){.roc-plate{grid-template-columns:minmax(0,1fr) 520px}}
.roc-fig{margin:0}
.roc-fig img{width:100%;height:auto;display:block;border-radius:var(--r);border:1px solid var(--hair)}
.roc-fig figcaption{margin-top:var(--s3);font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-soft)}
.roc-fig a{color:var(--sky-deep);text-decoration:underline;text-underline-offset:2px}

/* THE FIVE ROUTES. Each is a whole card that is a link, so the tap target is the
   card and not the four words in it: five 18px links in a row is the smallest-
   target failure CLAUDE.md records the footer link being caught by. The heading
   is teal because the card is a route and the sentence under it is a neutral,
   which keeps the two accents off each other inside one component. */
.roc-routes{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));
  gap:var(--s3);margin-top:var(--s4);padding:0}
.roc-routes a{display:block;height:100%;background:var(--card);border:1px solid var(--hair);
  border-radius:var(--r);padding:var(--s4);box-shadow:var(--lift)}
/* Same regression as .wtb-pick a:hover: the ground lifts to --paper-3 and
   .roc-routes b keeps --sky-deep, 4.50:1 -> 3.60:1. The b is 18.4px at weight
   400, which is 0.26px UNDER the 18.66px large-text threshold, so it needs
   4.5:1 and not 3:1 -- close enough to look exempt and not be. 5.35:1 now. */
.roc-routes a:hover,.roc-routes a:focus-visible{background:var(--paper-3)}
.roc-routes a:hover b,.roc-routes a:focus-visible b{color:var(--ink)}
.roc-routes b{display:block;font:400 var(--t-m)/1.2 var(--display);color:var(--sky-deep)}
.roc-routes span{display:block;margin-top:6px;font-size:var(--t-sm);line-height:1.6;color:var(--ink-2)}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/rochester.html">
<meta property="og:title" content="Pokemon in Rochester, NY">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/rochester.html">
<meta property="og:site_name" content="Garbage Rips 585">
${/* THE SHARED og-image AND NOT A CARD OF ITS OWN, deliberately. The 52 share
      cards are painted in Python by scripts/build-og.py and build-og-pages.py,
      NEITHER of which this builder may reach and only one of which is in
      build-all.mjs. Inventing an og-rochester.jpg filename here would emit a
      meta tag pointing at a file nothing writes, so every share of this page
      would be a blank card: exactly the failure shared/site.mjs was created to
      stop. The generic card is correct and checkable. If somebody paints one,
      swap the two lines and nothing else here changes. */ ""}<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">${KICKER}</span>
    <h1>${H1}</h1>
    ${/* STRAIGHT INTO IT. The owner, 24 August 2026: "the top copy needs to be removed
          or changed, just go right into the info." This used to open with two
          sentences of throat-clearing before a reader learned anything -- one
          about the town and one listing what the page contains, which the page
          then contains. The numbers ARE the point, so they lead, and they are
          computed rather than typed so the sentence cannot go stale the week a
          show is added. The one line of voice is kept and moved to the END,
          where it lands on top of the evidence instead of asking for credit
          before any has been shown. */ ""}<p class="lede" style="max-width:40em">${nShows} card show${nShows === 1 ? "" : "s"} on the calendar,
      ${withAddr} shop${withAddr === 1 ? "" : "s"} with a door and an address, and ${plates.length}
      kitchen${plates.length === 1 ? "" : "s"} that will put a garbage plate in front of you. This is a card town and
      most of the internet has no idea.</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Local scene</nav>
    ${/* THE LABEL AND THE LEDE BOTH USED TO BE ABOUT THE METHOD. "Counted, not
          claimed" over a paragraph explaining that the figures are read out of
          the files at build time is a note to the author, not to a reader, and
          the owner said so: "not so much about how you got the info for the stats
          widget."
          The build-time counting is still true and still the reason these
          numbers can be trusted, and it stays written down in the header of
          this file where it belongs. What a reader gets instead is what the
          tiles are ABOUT. The one clause worth keeping from the old paragraph is
          the last one: a thin number saying it is thin is a fact about the
          scene, not about the build. */ ""}<p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Around here</p>
    <h2>What is actually <span class="hl">here</span></h2>
    <p class="lede" style="max-width:44em">Shows you can drive to, shops you can walk into, and the plate the channel
      is named after. Where a number is thin, it says so.</p>
    <ul class="roc-stats">
${STATS.join("\n")}
    </ul>
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Where to go</p>
    <h2>The next ${nextShows.length === 1 ? "show" : `${nextShows.length} shows`}</h2>
    <p class="lede" style="max-width:44em">${
      nShows
        ? `Pulled from the same list as the calendar page, which holds ${nShows} in total across
      ${showRegions.size === 1 ? "one area" : `${showRegions.size} areas`} and checked on
      ${esc(longDate(showsDoc.checked) || "the date on that page")}.`
        : "The calendar is empty right now, which means the next round of dates has not been published yet."
    }</p>
    ${
      nextShows.length
        ? `<ul class="roc-rows roc-shows">
${nextShows.map(showRow).join("\n")}
    </ul>
    <p class="btn-row" style="margin-top:var(--s4)">
      <a class="btn btn-sky btn-sm" href="/card-shows.html">All ${nShows} shows</a>
    </p>`
        : `<p class="btn-row" style="margin-top:var(--s4)">
      <a class="btn btn-sky btn-sm" href="/card-shows.html">The card show calendar</a>
    </p>`
    }
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Open all week</p>
    <h2>The shops with a <span class="hl">door</span></h2>
    <p class="lede" style="max-width:44em">A show is a Saturday. These are open the rest of the week, and
      ${playShops.length} of the ${shops.length} publish organized play you can show up to. Addresses, phone numbers,
      hours and league nights are on the shop page, because one shop's opening hours should live in one place.</p>
    <ul class="roc-rows">
${shops.map(shopRow).join("\n")}
    </ul>
    <p class="btn-row" style="margin-top:var(--s4)">
      <a class="btn btn-sky btn-sm" href="/shops.html">The shop list</a>
      <a class="btn btn-ghost btn-sm" href="/buying.html">Or buying online</a>
    </p>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    ${plateRule(84)}
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Why the name</p>
    <h2>The channel is named after <span class="hl">this</span></h2>
    <div class="roc-plate">
      <div>
        <p class="lede" style="max-width:36em">A Garbage Plate is two mains on a bed of home fries and macaroni
          salad with hot sauce poured over the lot, and outside Monroe County almost nobody has heard of it. A rip
          with nothing in it is a garbage rip. That is the whole joke and it is also the reason a Pokemon channel
          from here is called what it is.</p>
        <p class="lede" style="max-width:36em">${nPlates} places around Rochester, NY serve one, under
          ${nPlateNames} different ${nPlateNames === 1 ? "name" : "names"}: Nick Tahou Hots holds the trademark on
          the words Garbage Plate, so everybody else calls theirs something else. That page carries ${nPlateSources}
          sources and ${nPlatePhotos} photographs, and it also names the ${
            (plateDoc.notSourced || []).length
          } things nobody could source rather than guessing at them.</p>
        <p class="btn-row" style="margin-top:var(--s4)">
          <a class="btn btn-sky btn-sm" href="/garbage-plate.html">What is a Garbage Plate?</a>
        </p>
      </div>
      ${plateFigure(hero)}
    </div>
  </div>
</section>

${/* THE PEOPLE, AND THIS SECTION IS THE REASON THE PAGE EXISTS RATHER THAN THE
      part of it that is behind. Shows and shops are places and they were always
      going to be easy. The thing the owner actually asked for is a hub that showcases
      what the local community does, and that is these two pages, and they hold
      four entries between them. So this section prints the count, says whose gap
      it is, and sends the reader to the ask rather than to the list: a stranger
      who arrives here and reads "two creators" has been told the truth, and the
      only useful next click is the one that makes it three. */ ""}
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The part that is missing</p>
    <h2>The people, and where this page is <span class="hl">short</span></h2>
    <p class="lede" style="max-width:44em">The shows and the shops above are a real answer to what is here. The two
      pages about PEOPLE are not one yet: ${nVendors} ${nVendors === 1 ? "vendor" : "vendors"} and ${nCreators}
      ${nCreators === 1 ? "creator" : "creators"}, in a region that fills ${nShows} shows between
      ${esc(shortDate(first) || "")} and ${esc(shortDate(last) || "")}. Those two numbers do not belong on the same
      page and the fix is not to write more names down, it is to be told them.</p>
    <p class="lede" style="max-width:44em">Nobody is going on either list who has not been checked, which is the
      whole reason a local list is worth more than a directory, and it is also why it grows slowly. If you sell at
      the shows, or you film around here, or you just watch somebody local who deserves the traffic, that is the
      fastest way this page stops being short.</p>
    ${/* AND A ROUTE THAT IS NOT A FORM. The owner, 24 August 2026: "incase someone
          wants to email me their vendor info, creator info, store info, shop
          info, or show info they can just email me directly."
          It sits in THIS section rather than in the footer because this is the
          section that does the asking, and a reader who has just been told the
          page is short is the reader most likely to be able to fix it. The two
          buttons above send people to the per-list pages; this one covers the
          three the buttons do not, and it covers the person who has something
          local and does not know which list it belongs on. */ ""}
    <p class="lede" style="max-width:44em">A shop, a show, a vendor, a creator, or anything else local this page has
      missed: email it straight to <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>. No form, no
      sign up, and every listing gets checked before it goes up.</p>
    <p class="btn-row" style="margin-top:var(--s4)">
      <a class="btn btn-sky btn-sm" href="/vendors.html#get-listed">Get on the vendor list</a>
      <a class="btn btn-sky btn-sm" href="/creators.html#get-listed">Get on the creator list</a>
      ${/* PREFILLED LIKE THE FIVE PAGES BELOW IT, but with the catch-all subject:
            this is the hub, so the person clicking here is the one who has
            something local and does not know which of the five lists it belongs
            on. The raw address stays plain in the sentence above, because there
            the job is to SHOW the address rather than to open a draft. */ ""}
      <a class="btn btn-sky btn-sm" href="${esc(mailtoHref("something local for the site", [
        "What it is (shop, show, vendor, creator, plate): ", "Name: ", "Where: ",
        "Website or socials: ", "", "(attach a logo, a flyer or a photo if you have one)"]))}">Email the channel</a>
    </p>
  </div>
</section>

${/* THE GROUNDS ALTERNATE ALL THE WAY DOWN AND THIS ONE HAD TO GIVE ITS BAND UP
      WHEN THE PLATE MOVED. The order is tight, band, tight, tight, band, tight:
      the only two adjacent sections on the same ground are the shops and the
      plate, and the plateRule ornament sits on exactly that seam, which is the
      job shared/format.mjs says it exists to do. Two .band sections touching
      would read as one very long band with a heading in the middle of it. */ ""}
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>All of it</p>
    <h2>Everything local, in one <span class="hl">place</span></h2>
    <ul class="roc-routes">
      <li><a href="/card-shows.html"><b>Card shows</b><span>${nShows} coming up around Rochester, NY, Buffalo and
        Syracuse, with the dates and the venues.</span></a></li>
      <li><a href="/shops.html"><b>Card shops</b><span>${shops.length} shops, ${withAddr} with a door and an address, what each one is good
        for, and where you can sit down and play.</span></a></li>
      <li><a href="/vendors.html"><b>Local vendors</b><span>People who sell, usually at the shows. ${nVendors} so
        far, and the page says how to be the next one.</span></a></li>
      <li><a href="/creators.html"><b>Local creators</b><span>Other people around here making Pokemon content.
        ${nCreators} so far, in no particular order and never ranked.</span></a></li>
      <li><a href="/garbage-plate.html"><b>Garbage Plate</b><span>The dish, its history, and the ${nPlates} places
        that serve one. Every claim on it carries a source.</span></a></li>
      <li><a href="/videos.html"><b>The rips</b><span>The channel itself: packs opened in Rochester, NY, mostly ending
        in garbage. That is the name.</span></a></li>
    </ul>
  </div>
</section>

</main>
${footer("Local pages for Rochester, New York. No paid placements.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/rochester.html"), page);
console.log(`Wrote public/rochester.html
  ${nShows} shows on ${showDays.size} days in ${showTowns.size} towns (${weeksWithShow} of ${weeksSpanned} weeks), ${shops.length} shops (${playShops.length} with play),
  ${nVendors} vendors, ${nCreators} creators, ${nPlates} plate places, ${nPlatePhotos} photographs`);
/* THE TWO THIN PAGES, SAID OUT LOUD EVERY BUILD. The bar is the same four this
   page's own copy is measured against and the same one build-locals.mjs uses for
   its "still short" band, so the build and the page cannot disagree about
   whether the section is finished. */
for (const [n, what, file] of [
  [nVendors, "vendors", "data/vendors.json"],
  [nCreators, "creators", "data/creators.json"],
]) {
  if (n < 4) {
    console.log(`  ${what}: ${n}. This page prints that as a gap. Add real ones to ${file} to close it.`);
  }
}
