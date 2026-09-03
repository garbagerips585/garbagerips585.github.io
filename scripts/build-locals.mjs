#!/usr/bin/env node
// Build /vendors.html and /creators.html: the people, not the shops.
//
//   node scripts/build-locals.mjs
//
// Two pages from one script because they are the same page with a different
// noun: a name, what they do, and the places you can follow them. Splitting
// them into two builders would mean two copies of the link rendering and two
// places to fix the next time a platform is added.
//
// THEY START EMPTY AND THAT IS CORRECT. Both files name real businesses and
// real people. A placeholder vendor sends somebody to a seller that does not
// exist; a guessed handle sends them to a stranger. So the pages render a
// proper empty state that says what the list is for and invites a suggestion,
// and they are kept OUT of the sitemap until they have entries, because an
// empty page is a thin page.
//
// NOT A RANKING, on either page. Both sort alphabetically on purpose. A local
// list that reads as a league table makes enemies of the people it leaves out,
// and the whole point is to be useful to the scene rather than to grade it.
//
// `vouched` on a vendor is the one editorial signal, and it means the owner has
// actually bought from them. It is not a star rating and there is no scale.
//
// THESE TWO PAGES CARRY NO PICTURES AND THAT HAS NOW BEEN DECIDED TWICE, so
// here is the reasoning rather than a third agent working it out from scratch.
// Both sit at 0.0 in check-build.py's image-density table and both are below
// its 250 word floor, so nothing flags them; the question is whether they
// should have one anyway, and the answer is no on three counts.
//
//   - THE OBVIOUS IMAGE IS SOMEBODY ELSE'S FACE. Every row is a real local
//     person or a real small business. The site holds no mark for any of them,
//     and pulling an avatar or a logo off their profile is a different kind of
//     decision from mirroring a public-domain wordmark or an App Store
//     screenshot the publisher uploaded. Nobody here has been asked.
//   - A MAP WAS CONSIDERED AND IT HAS NO SHAPE. /shops.html earns a drawn map
//     because its rows carry addresses that are spread across the region.
//     These rows carry an `area`, and today every entry on both pages reads
//     "Rochester". A map of four pins in one place, one of which (TOAK Pulls)
//     is the same entity appearing on both pages, teaches a reader nothing the
//     word Rochester has not already told them.
//   - PLATFORM LOGOS WOULD BE DECORATION. The link row already says YouTube,
//     Instagram, TikTok in words, which are shorter to read than an icon is to
//     recognise, and swapping them for marks would add requests and remove the
//     labels.
//
// WHAT WOULD CHANGE THIS: a vendor sending us their own artwork to use, which
// the "know one we missed" invitation could ask for; or enough entries spread
// widely enough that a regional map becomes a real picture. Neither is true
// yet, and an empty-ish page with no picture is better than a padded one.

import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
// A logo is only an opener where a -lg rendition is actually on disk.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, CONTACT_EMAIL, mailtoHref} from "../shared/site.mjs";
import { SOCIALS, GLYPH } from "../shared/socials.mjs";
// The overlay the show flyers open in. Shared rather than copied: see the note
// at the top of shared/lightbox.mjs.
import { imgLbMarkup, imgLbJs } from "../shared/lightbox.mjs";
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
import { esc, clipMeta, plainDashesAll} from "../shared/format.mjs";
// The same comment stripper build-css.mjs runs over ui.css. PAGE_CSS below is
// mostly prose about why four rules exist, and an inline style block is render
// blocking like the stylesheet is. stamp-assets.mjs would strip it last anyway,
// but running it here means what this builder writes is what ships.
import { strip as miniCSS } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendors = JSON.parse(await readFile(join(ROOT, "data/vendors.json"), "utf8"));
const creators = JSON.parse(await readFile(join(ROOT, "data/creators.json"), "utf8"));

/* THE CALENDAR, READ HERE SO A VENDOR CARD CAN SAY WHERE THEY WILL BE.
 *
 * The owner, 3 September 2026: "also add in a list of confirmed shows under the
 * vendors info too so people can quickly see". The join already exists in the
 * other direction -- data/shows.json names confirmed vendors and
 * build-shows.mjs renders them on the show card -- so this reads the SAME field
 * back rather than introducing a second list that could disagree with it.
 * data/vendors.json holds no show dates and must not: one fact, one home.
 *
 * ONLY WHAT IS STILL AHEAD. A vendor card is a "where can I find them" answer,
 * so a show that has already happened is noise on it. The show pages keep the
 * history; this list is forward-looking and empties itself. */
const SHOW_ROWS = (() => {
  const raw = JSON.parse(readFileSync(join(ROOT, "data/shows.json"), "utf8"));
  return Array.isArray(raw) ? raw : raw.shows || [];
})();
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const confirmedFor = (name) =>
  SHOW_ROWS.filter((s) => s.date >= TODAY_ISO && (s.vendors || []).some((v) => v && v.name === name))
    .sort((a, b) => a.date.localeCompare(b.date));
const showDay = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* THE HUB THESE TWO PAGES NOW HANG UNDER. /rochester.html, built by
   scripts/build-rochester.mjs, is the one page that says what the local scene
   is and routes to all five of the local pages. Before it existed these two
   sat directly under Home in the breadcrumb and named their sibling pages in
   plain text that was not a link, so a reader who landed here from a search had
   no way to discover that the card show calendar, the shop list and the plate
   page were even on the same site. Written once here because it appears in the
   visible crumb, in the BreadcrumbList and in the routing row at the foot.

   THE LABEL IS "Local scene" AND IT WAS "Rochester, NY" FOR AN AFTERNOON, WHICH
   WAS A BUG IN A PLACE WHERE THIS SITE HAS A NAMED RULE. The nav group these
   five pages sit in is HEADED "Rochester, NY", so a link inside it reading
   "Rochester, NY" is a heading and its own child with the same words: the
   two-names-one-page failure shared/chrome.mjs exists to prevent, read from the
   other end. It is also redundant, because a label inside a group headed
   Rochester does not have to say Rochester.

   ONE NAME ON EVERY SURFACE, which is the actual rule and the reason this is a
   single constant rather than three strings. The nav item, the visible crumb on
   all five local pages, the BreadcrumbList Google prints, and the routing rows
   at the foot of each page ALL take this. A page called one thing in the menu
   and another in the breadcrumb is two pages as far as a reader is concerned.

   IT IS ECHOED BY THE PAGE, which is the nav's own condition on a label. The
   hub's title ends "Shows, Shops and the Local Scene" and its kicker reads
   "585 - The local scene", so a reader who taps the label lands on a page
   saying it back to them in the first thing they see. Eleven characters, well
   inside the 20 the footer grid allows at 138px. */
const HUB = { url: "/rochester.html", label: "Local scene" };
/* FOUR OF THE SEVEN GET A GLYPH, AND THE OTHER THREE MUST NOT.
   These two pages carried zero pictures in <main>: 118 words on /creators.html
   and 177 on /vendors.html, entirely text. The site already draws YouTube,
   Instagram, TikTok and Facebook marks, as a sprite that is on every page for
   the footer, so putting them on the matching pills costs no bytes at all for
   the artwork.
   Twitch, Whatnot and eBay stay as words, and so do Website and All their
   links. We do not hold those marks, and CLAUDE.md's rule on exactly this,
   written when Collectr was linked without one, is that inventing a logo to sit
   beside four real ones is worse than a named text link. A pill that says a
   platform's name is not a broken version of a pill with its logo. */

const glyphFor = (k) =>
  GLYPH[k] ? `<svg class="loc-i" aria-hidden="true"><use href="#i-${GLYPH[k]}"/></svg>` : OUT;

/* AN ARROW LEAVING A BOX IS NOT A LOGO, which is why this one may be drawn and
   a Whatnot or an eBay mark may not. It means "this goes off the site", it is
   the same thing the outbound rule already makes every one of these links
   announce in its aria-label, and it is ours to draw.
   Inline rather than added to the sprite in shared/chrome.mjs, because the
   sprite ships on all 1,483 pages and this is wanted on two. Three pills on
   /vendors.html and none on /creators.html carry it today; /vendors.html would
   otherwise still have had no picture anywhere in main, which is where this
   whole pass started. aria-hidden, because the pill's own text and its
   aria-label already say where it goes. */
const OUT =
  `<svg class="loc-i" viewBox="0 0 24 24" aria-hidden="true">` +
  `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" ` +
  `fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// The first address this page shows for somebody, in the same order the row
// renders them: socials first, then a website, then a link-in-bio hub. It is
// the ListItem target in the schema below, so what a crawler is told about a
// creator is the exact link a reader would click, never a second guess.
const primaryUrl = (o) => {
  const social = SOCIALS.find(([k]) => o[k]);
  return social ? social[2](o[social[0]]) : o.url || o.links || null;
};

// The bare host, for the "opens on <host>" half of an outbound aria-label.
// Falls back to the empty string rather than throwing: a malformed url in the
// data should cost a label, not the build. Same helper as build-shows.mjs.
const hostOf = (u) => {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// EVERY LINK THIS FUNCTION EMITS IS OUTBOUND AND NONE OF THEM CARRIED THE
// aria-label CLAUDE.md MAKES THE CONDITION OF ONE. These are the only links in
// the body of /vendors.html and /creators.html, so both pages were at 0 of their
// outbound links labelled while the site was at 783 of 877.
//
// The visible text is the reason it matters here more than the count suggests.
// It is a fixed vocabulary -- "YouTube", "Instagram", "TikTok", "Website", "All
// their links" -- repeated once per person, so on a page of five links the
// accessible names were "YouTube", "Instagram", "YouTube", "Instagram",
// "TikTok", and NONE of them said whose. The person's name is in the h2 above
// and was in no link name. Naming them inside the label fixes the ambiguity and
// the missing outbound warning together, exactly as build-shows.mjs does on a
// show row.
const links = (o) => {
  const named = (what, url) =>
    `${esc(o.name ? `${what} for ${o.name}` : what)}, opens on ${esc(hostOf(url))}`;
  const out = SOCIALS.filter(([k]) => o[k]).map(
    ([k, label, url]) =>
      `<a class="loc-soc" href="${esc(url(o[k]))}" rel="noopener" target="_blank" aria-label="${named(label, url(o[k]))}">${glyphFor(k)}${label}</a>`,
  );
  // A plain website sits last: it is the least likely to be how somebody in a
  // card community actually finds them.
  if (o.url) out.push(`<a class="loc-soc" href="${esc(o.url)}" rel="noopener" target="_blank" aria-label="${named("Website", o.url)}">${OUT}Website</a>`);
  // A link-in-bio page (solo.to, linktr.ee) is often the ONLY address a vendor
  // publishes: no site of their own, and their socials change. Labelled as what
  // it is rather than as a website, because it is a hub and not a shop.
  if (o.links) out.push(`<a class="loc-soc" href="${esc(o.links)}" rel="noopener" target="_blank" aria-label="${named("All their links", o.links)}">${OUT}All their links</a>`);
  return out.length ? `<p class="loc-socs">${out.join("")}</p>` : "";
};

// h2, NOT h3. These names are the only headings on the page under the h1, so an
// h3 here skipped a level: a screen reader user walking the heading list heard
// the page jump from level 1 to level 3 and had to guess whether a section
// heading had gone missing. There is no h2 for these to sit under and there
// should not be one, because the list is the page. The empty state below
// already uses an h2 for the same slot, so the two states now agree as well.
// Visually identical: `.loc h2` in assets-source/ui.css carries the same font
// shorthand `.loc h3` did, so the size does not come from the UA default.
/* A ROW WITH NO BLURB IS THE STATE THAT SHIPPED AND NOTHING ON THE PAGE SAID SO.
   Elliot Does Pokemon carries a name, an area and the two words "Pokemon
   content", and `.loc-socs` is `margin-top:auto`, so at 1440 the card stretched
   to its neighbour's height and left a hollow band where a description would go.
   A reader cannot tell that from a card that failed to render.

   This is /retailers.html's Staples row, one page along: that page prints, in
   its own words, "This is the reason Staples is a row here and not a page of its
   own", rather than leaving a thin entry to be read as a broken one. Say what is
   missing and whose fault it is. The links are still the point of the row and
   they are still checked, so the sentence has to make clear that the GAP IS
   OURS: nothing here is a judgement about the person on the card. */
const NO_WRITE_UP =
  `<p class="loc-nowrite">We have not written this one up yet. The links are theirs and they work; ` +
  `the description is the part we owe them.</p>`;

/* A LOGO ONLY WHERE THE PERSON SENT ONE, which is the same rule /shops.html
   already runs on and the same rule CLAUDE.md sets for the platform marks a few
   lines up: we draw what we hold and we do not go and fetch one. `logoNote` in
   data/creators.json records who sent it and when, so the permission is written
   down beside the file rather than remembered.

   THE SHOP SHAPE, DELIBERATELY. Same two renditions at 200w and 400w, same
   AVIF-then-WebP order, so a creator card and a shop card cannot drift apart.
   Height comes off the stored logoW/logoH rather than being assumed square --
   Elliot's is 1024x856, and a hardcoded square would have squashed it.

   THE BOX IS NO LONGER 56px AND `sizes` HAD TO MOVE WITH IT. The owner asked
   for a bigger logo on 27 August 2026, so .loc-logo in ui.css is now
   clamp(96px,24cqw,168px). `sizes` is the only thing that tells the browser how
   big the box is: leave it at 56px and every one of these is fetched at 112
   physical pixels and stretched across 336, which reads as a bad master rather
   than as a stale attribute. The two ends of the clamp are chosen so the 200w
   file covers the floor at DPR 2 and the 400w covers the ceiling; the whole
   sum is written out beside the rule in ui.css. CHANGE ONE AND CHANGE BOTH. */
/* AND IT OPENS LARGER ON A CLICK, at the owner's request on 27 August 2026, in
   the same overlay the show flyers use. build-brand-logos.py writes the -lg
   rendition at min(800, master) and writes none at all under a 500px master, so
   a logo becomes an opener only where there is genuinely more of it to see:
   reopening a 400px file at 400px is a control that appears to do nothing. The
   AVIF is checked separately, because that script drops one that came out bigger
   than its WebP and Elliot's did exactly that. */
const lgFor = (o) => {
  const w = `assets/creators/${o.logo}-lg.webp`;
  if (!existsSync(join(ROOT, "public", w))) return null;
  const a = `assets/creators/${o.logo}-lg.avif`;
  return { w: `/${w}`, a: existsSync(join(ROOT, "public", a)) ? `/${a}` : "" };
};
const logoFor = (o) => o.logo
  ? `${(() => {
      const lg = lgFor(o);
      return lg
        ? `<button type="button" class="loc-logo" aria-label="Enlarge the ${esc(o.name)} logo" data-imglb="${lg.w}"${
            lg.a ? ` data-imglb-avif="${lg.a}"` : ""
          } data-imglb-alt="${esc(o.name)} logo">`
        : `<span class="loc-logo">`;
    })()}<picture>
            ${/* THE AVIF SOURCE IS BUILT FROM THE FILES THAT EXIST, NOT ASSUMED.
                  build-brand-logos.py DROPS a rendition whose AVIF encoded LARGER
                  than its WebP -- "so this one is served as webp only" -- and this
                  srcset named both widths unconditionally. Legends Card Shop is the
                  first logo where the 200w lost, so the browser picked a source
                  that had deliberately never been written and the card rendered a
                  BROKEN IMAGE. lgFor() a few lines up already guards its own file
                  with existsSync for exactly this reason; this half never did.
                  Emitting only the widths on disk means a dropped rendition costs
                  a candidate rather than the picture. */ ""}${(() => {
              const av = [200, 400]
                .filter((w) => existsSync(join(ROOT, "public", `assets/creators/${o.logo}-${w}.avif`)))
                .map((w) => `/assets/creators/${esc(o.logo)}-${w}.avif ${w}w`);
              return av.length
                ? `<source type="image/avif" srcset="${av.join(", ")}" sizes="(min-width:900px) 168px, 96px">`
                : "";
            })()}
            <img src="/assets/creators/${esc(o.logo)}-200.webp" alt="${esc(o.name)} logo" width="200" height="${
              Math.round(200 * (o.logoH || 1) / (o.logoW || 1))
            }" loading="lazy" decoding="async" srcset="/assets/creators/${esc(o.logo)}-200.webp 200w, /assets/creators/${esc(o.logo)}-400.webp 400w" sizes="(min-width:900px) 168px, 96px">
          </picture>${lgFor(o) ? "</button>" : "</span>"}`
  : "";

/* THE SHOW DATES FLYER, WHERE A VENDOR SENT ONE. Same lightbox contract as the
   logo above and the show flyers on /card-shows.html: a button carrying
   data-imglb, bound by shared/lightbox.mjs, so a reader taps the thumbnail and
   gets the poster at full size. It reuses build-show-logos.py's flyer pipeline
   rather than a second one, so the file lives beside every other flyer and gets
   the same widths, the same AVIF-or-not decision and the same EXIF handling.

   THE -full FILE IS CHECKED BEFORE IT IS LINKED, exactly as lgFor does for the
   logos, because build-show-logos.py DROPS an AVIF that came out bigger than
   its JPEG. Linking a file that was deliberately not written is how you ship a
   lightbox that opens onto nothing. */
const flyerFor = (o) => {
  if (!o.flyer) return "";
  const stem = String(o.flyer).replace(/\.[a-z]+$/i, "");
  const full = `assets/shows/${stem}-full.jpg`;
  if (!existsSync(join(ROOT, "public", full))) return "";
  const fullAvif = `assets/shows/${stem}-full.avif`;
  const avif = `assets/shows/${stem}.avif`;
  const alt = `${o.name} upcoming show dates`;
  return `        <button type="button" class="loc-flyer" aria-label="Enlarge the ${esc(o.name)} show dates flyer" data-imglb="/${esc(full)}"${
    existsSync(join(ROOT, "public", fullAvif)) ? ` data-imglb-avif="/${esc(fullAvif)}"` : ""
  } data-imglb-alt="${esc(alt)}">
          <picture>
            ${existsSync(join(ROOT, "public", avif)) ? `<source type="image/avif" srcset="/${esc(avif)}">` : ""}
            <img src="/assets/shows/${esc(stem)}.jpg" alt="${esc(alt)}" width="${o.flyerW || 440}" height="${o.flyerH || 0}" loading="lazy" decoding="async">
          </picture>
        </button>`;
};

/* WHERE THEY WILL ACTUALLY BE, COUNTED OFF data/shows.json RATHER THAN TYPED.
   `shows` above is the vendor's own sentence about the circuit they work --
   "Rochester, NY, Buffalo and Syracuse, plus out of state" -- and it never goes
   stale because it names no dates. This is the opposite: real rows, real dates,
   and it empties itself as they pass. Both earn their place and they are
   labelled differently so a reader is not asked to reconcile them.

   THE DATES ARE NOT LINKED ONE BY ONE because /card-shows.html has no per-show
   anchor to link to. Inventing one here would mean a link that 404s to the
   middle of a page. One link to the calendar, at the end, is honest. */
const confirmedShows = (o) => {
  const up = confirmedFor(o.name);
  if (!up.length) return "";
  return `        <div class="loc-conf">
          <p class="loc-conf-h">Confirmed at ${up.length} upcoming ${up.length === 1 ? "show" : "shows"}</p>
          <ul class="loc-conf-l">${up
            .map((s) => `<li><b>${esc(showDay(s.date))}</b> ${esc(s.name)}<span>${esc(s.city)}</span></li>`)
            .join("")}</ul>
          <p class="loc-conf-m"><a href="/card-shows.html">See them on the calendar</a></p>
        </div>`;
};

const card = (o, kind) => `      <li class="loc">
        <div class="loc-h">
          ${logoFor(o)}
          <h2>${esc(o.name)}</h2>
          ${o.vouched ? `<span class="loc-vouch">Bought from them</span>` : ""}
        </div>
        ${o.area ? `<p class="loc-area">${esc(o.area)}</p>` : ""}
        ${o.does || o.sells ? `<p class="loc-does">${esc(o.does || o.sells)}</p>` : ""}
        ${o.blurb ? `<p class="loc-blurb">${esc(o.blurb)}</p>` : NO_WRITE_UP}
        ${o.shows ? `<p class="loc-shows">Usually at: ${esc(o.shows)}</p>` : ""}
${confirmedShows(o)}
${flyerFor(o)}
        ${links(o)}
      </li>`;

/* THE ZERO-ROW EMPTY STATE WAS BUILT AND THE ONE-THIN-ROW STATE WAS NOT, AND
   ONE-THIN-ROW IS WHAT SHIPPED. A page with nothing on it says "Nothing here
   yet / This list is being built" and reads as a deliberate, honest state. A
   page with two cards, one of which is a name and two words, says nothing at
   all: it looks like a finished list of two, or like a page where something
   failed to load. /creators.html had 118 words in <main>, the thinnest
   non-utility page on the site, and not one of them admitted it.

   THE MODEL IS /retailers.html AND IT IS NAMED HERE ON PURPOSE. That page has a
   row it cannot make a page out of, and instead of hiding the fact it prints
   "This is the reason Staples is a row here and not a page of its own." A
   reader who is told why a thing is short trusts the short thing. A reader who
   is not told assumes the site is broken.

   EVERY NUMBER IN IT IS COUNTED, NEVER WRITTEN. "Two creators" and "one of them"
   come off the array, so this paragraph cannot go stale the way a hand-typed
   count does, and the band switches itself off the moment the list clears the
   bar.

   THE BAR IS FOUR ENTRIES AND NO GAPS, and it is written as a test rather than
   as a promise in a comment, which is the shape earnsPage() takes in
   build-retailers.mjs. Four is an editorial floor and not a layout fact: below
   it, a "local scene" list is a handful of people somebody happened to know
   rather than a survey, and saying so is cheaper than pretending otherwise. A
   row with no `blurb` counts as a gap however many rows there are. NOTHING HERE
   INVENTS AN ENTRY TO CLEAR THE BAR: the whole file exists to refuse that. */
const earlyNote = (rows, noun) => {
  const thin = rows.filter((o) => !o.blurb).length;
  if (rows.length >= 4 && !thin) return "";
  const n = rows.length;
  const nWord = ["no", "one", "two", "three"][n] || String(n);
  const isAre = n === 1 ? "is" : "are";
  const nounWord = n === 1 ? noun.replace(/s$/, "") : noun;
  /* THE SECOND SENTENCE IS AN ASK ON BOTH PAGES NOW, 25 August 2026, at the
     owner's request. It used to end "it stays that way until somebody real goes
     on it" -- a statement of editorial policy, addressed to nobody, sitting
     directly above a button labelled "Here is how to get on it".

     The first sentence still admits the list is short, because that part is
     true and worth saying. What follows it now asks the one person who can
     actually fix it, which is the reader.

     "TO GET LISTED" AND NOT "AND YOU GO ON THE PAGE", and the difference is
     load-bearing. The Get listed section below promises "We look before we
     list ... every handle here has been opened and checked, because a wrong
     handle sends somebody to a stranger." A line up here reading "tell us and
     you are on it" would contradict that eleven lines later and promise a
     listing this page does not hand out on request. Both pages invite; neither
     guarantees. */
  const pitch =
    {
      creators:
        "Live in Western New York and make Pokemon content? Send us an email or a DM on socials with your info to get added to the page.",
      vendors:
        "Are you a Pokemon vendor in the greater Western New York area? Email or DM us to get listed on this page.",
    }[noun] ||
    "That is what we can actually point you at today rather than what we would like the page to look like, and it stays that way until somebody real goes on it.";
  const gap = thin
    ? ` ${thin === n ? (n === 1 ? "It has" : "None of them has") : `${["", "One", "Two", "Three"][thin] || thin} of them ${thin === 1 ? "has" : "have"}`} no write-up yet, which is our gap and not theirs.`
    : "";
  /* IT IS AN .empty BOX NOW AND NOT A .fk-golden ONE, 21 August 2026, AND THE
     MASCOT IS THE REASON RATHER THAN THE DECORATION.

     TRUBBISH MEANS "THERE IS NOTHING IN THIS ONE" ON THIS SITE and he means it
     in three other places already: /404.html, the no-hits band on the rip
     pages, and the filtered-to-empty state /videos.html gets from emptyState()
     in public/assets/app.js. The heading this band prints is "This list is
     still short". That is the sentence he exists to illustrate, so this is a
     placement rather than a fourth invention of the same idea.

     GARBODOR WOULD BE WRONG HERE AND THE DISTINCTION IS WORTH KEEPING SINGLE.
     He is on /search.html's no-match and nowhere else, and what he says there
     is "we went through the whole heap": 316 openings, 5,181 cards, 1,025
     species. Nothing was searched here. The list is short.

     NO NEW CSS, WHICH IS THE WHOLE REASON THE CONTAINER CHANGED. .empty and
     .empty-mascot are both already in ui.css, written for app.js's grid states
     and reused verbatim by /search.html, so this band now looks like the
     site's other empty states instead of like a new one. It also FIXES A
     LAYOUT FAULT for free: .fk-golden took the whole 1,392px band at 1440
     while its paragraph capped at 504px, so the copy sat hard left with about
     890px of empty green beside it. .empty centres its own contents, so the
     mark, the heading and the paragraph land in the middle of the band the way
     /search.html's do.

     NO INLINE CENTERING HERE ANY MORE, AND THE REASON IS WORTH KEEPING.
     This box used to carry two inline margin-inline:auto declarations working
     around a fault /search.html has too: .empty is text-align:center, so the
     mark and the heading center, but a paragraph inside it sat hard left of the
     box it was supposedly centered in. Measured on /search.html's no-match at
     1440x900: mascot 0, p.big -95, p -365.

     The first diagnosis of that was wrong in a way that mattered. There is no
     margin-left:0 anywhere in ui.css. The cause is
     main :is(p,dd,blockquote,figcaption){max-width:var(--measure)} inside
     @media(min-width:1000px), and a capped block with default inline margins
     sits flush left while text-align:center only centers the line INSIDE that
     narrower block. --measure is 36em and em is the ELEMENT'S OWN, which is why
     the two lines were off by different amounts and read like two separate
     bugs: p.big is 32px so 36em is 1152 and the slack is 190; p is 17px so 36em
     is 612 and the slack is 730. One rule, two numbers.

     ui.css now carries .empty p{margin-inline:auto}, +8 bytes gzipped, which
     fixes every .empty on the site at once, so a workaround sitting on top of a
     real fix would be dead weight that reads like it is load-bearing. Verified
     by stripping the inline styles from the live document and re-measuring:
     nothing moved at 1440 or at 390.

     THE BUTTON'S margin KEPT ITS 12px AND LOST ONLY THE auto. It was written as
     the shorthand margin:12px auto 0, so it looks like a third workaround and
     is not: delete the whole declaration and the button rises 12px at BOTH
     widths. Only the inline axis was ever redundant.

     THE HEADING KEEPS ITS TAG AND TAKES THE .big CLASS. /search.html writes a
     paragraph there because app.js builds that node in the browser; this is a
     real section heading on a static page and dropping it to a <p> would
     silence the only h2 in main. ui.css carries no bare h2 rule, and .empty
     .big sets font, colour, display and margin itself, so h2.big renders
     exactly as p.big does.

     THE "Early days" KICKER WENT WITH THE CONTAINER RATHER THAN BEING CARRIED
     OVER. .fk-golden-h is --gold, which resolves to a TEAL, and CLAUDE.md's
     accent rule is that teal is how you get around: it is every link and every
     button, never a label that goes nowhere. It survives inside .fk-golden as
     that component's own exception, on the near-black --band-bg. Moving it onto
     the --card green of an .empty box would be a new teal on a new ground with
     no route behind it, which is the rule breaking rather than a colour choice.
     The dashed border and the mascot say "this state is deliberate" without it.

     THE 256px FILE, NOT THE 512, AND THE ARGUMENT IS build-search.mjs's.
     .empty-mascot clamps to clamp(88px,22vw,116px), so the box is 88 at 390 and
     116 at 1440: a DPR 3 phone asks for 264 device pixels and 256 is the
     smallest rendition on disk that covers it. /assets/species/568.webp is
     9,056 bytes against /assets/trubbish.webp's 25,678 for pixels no box on
     this page can use, and the 96px sm/568.webp loses at every DPR either
     placement has. There is no srcset worth writing, so there is none, which
     also means the rung cannot disagree with the box. */
  return `    <div class="empty">
      <img class="empty-mascot" src="/assets/species/568.webp" alt=""
           width="256" height="256" loading="lazy" decoding="async" onerror="this.remove()">
      <h2 class="big">This list is still <span class="hl">short</span></h2>
      <p>${esc(nWord.replace(/^./, (c) => c.toUpperCase()))} ${esc(nounWord)} ${esc(isAre)} on this page.${esc(gap)}
        ${esc(pitch)}</p>
      <p style="margin-top:12px"><a class="btn btn-yt btn-sm" href="#get-listed">Here is how to get on it</a></p>
    </div>`;
};

/* THE BUTTON ABOVE USED TO GO TO youtube.com/@GarbageRips585 AND THAT IS THE
   ONE THING ON THIS PAGE THAT WAS A DEAD END. The band admits the list is
   short, and the only action it offered was a channel home page: no inbox, no
   form, no sentence saying what to send. Somebody who wanted to be on this list
   arrived at a wall of thumbnails and had to work out the rest themselves.
   It now goes DOWN THE PAGE to the section below, which is the answer, and it
   costs the page one outbound link rather than adding one.

   WHY A WHOLE SECTION AND NOT A LONGER SENTENCE IN THE BAND. The band switches
   itself off the moment the list clears four entries with no gaps, and the
   invitation is the part that must NOT switch off: a list that stops inviting
   people the day it gets useful stops growing the day it gets useful. So the
   ask is a permanent section of both pages and the band is the temporary
   admission of where the list is today. They say different things and only one
   of them is meant to go away.

   THE FIELDS ARE THE JSON'S OWN FIELDS, IN THE JSON'S OWN ORDER, and that is
   the entire point of writing them out. data/vendors.json takes name, area,
   sells, blurb, shows and a handle per platform; data/creators.json takes name,
   area, does, blurb and its handles. A vendor who sends those five things has
   written the row, and adding them is a paste rather than an interview. That is
   the lowest-friction path this page can offer without a server, and this site
   has no server.

   NO NET NEW OUTBOUND LINK, WHICH IS THE CONDITION CLAUDE.md PUTS ON ONE. The
   Instagram link is new; the YouTube channel link it replaces is gone; both
   hosts are already in the footer of all 1,487 pages, so no destination this
   site did not already point at appears here. Instagram is first because a DM
   is a real inbox and a channel page is not, and the second control is
   INTERNAL, to our own rips, where the comment box a local creator would
   actually use lives. Both carry the aria-label the outbound rule makes the
   condition of a link that leaves, and both are 44px controls at the end of the
   section rather than links buried in a sentence.

   NOTHING HERE PROMISES A LISTING AND THAT IS DELIBERATE. The third card says
   we check first, because the whole value of these two pages is that a name on
   them was looked at. An invitation that reads as automatic would be a
   directory signup, which is the thing this page is not. */
const getListed = ({ noun, one, fields, emailFields, sends, asset, subject }) => `
<section class="band tight" id="get-listed">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>How this list grows</p>
    <h2>How to get on <span class="hl">this page</span></h2>
    <p class="lede" style="max-width:44em">There is no form, no fee and no application. Tell us you exist and we
      will look you up and put you on. This list is short because nobody has been asked, not because anybody was
      turned down.</p>
    <p class="btn-row" style="margin:var(--s4) 0 var(--s2)">
      ${/* SHORT LABELS IN THE BODY, NOT THE PROSE FROM THE BULLET ABOVE. The
            first version appended a colon to each `fields` sentence and produced
            "What you carry: singles, sealed, graded, all of it:" -- a line with
            two colons that reads as a broken template. The page explains; the
            email prompts. They are different jobs and now different strings. */ ""}
      <a class="btn btn-sky btn-sm" href="${esc(mailtoHref(subject, [...emailFields.map((f) => `${f}: `), "", `(attach your ${asset})`]))}">Email your listing</a>
    </p>
    <ul class="facts-list" style="max-width:44em">
      <li><b>Send it however you like.</b> ${esc(sends)} Email is the surest one:
        <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>. It does not have to be you: if you buy from
        somebody good, or you watch somebody local, send them instead.</li>
      <li><b>Tell us ${esc(fields.length === 4 ? "these four things" : "these five things")}.</b> ${fields
        .map((f) => esc(f))
        .join(" ")} That is exactly what a card on this page holds, so nothing gets lost between you telling us and
        it going up.</li>
      ${/* THE ARTWORK GETS ITS OWN BULLET RATHER THAN A SIXTH FIELD. The owner, 24
            August 2026: "I want vendors and creators to send me their brand
            logos". Folding it into `fields` would have been the obvious move
            and it is wrong twice: the sentence above counts that array to say
            "these five things", so a sixth entry makes it lie, and an
            attachment is a different KIND of ask from a line of text. It also
            deserves the emphasis, because it is the thing that makes a card on
            this page look like the business rather than like a row. */ ""}
      <li><b>Attach your ${esc(asset)}.</b> Any size, any format, straight off your phone is fine. It is what makes
        your card here look like you rather than like a line in a list. Nothing is uploaded on this site: it rides
        along on the email.</li>
      <li><b>We look before we list.</b> Every name here is a real ${esc(one)} and every handle here has been opened
        and checked, because a wrong handle sends somebody to a stranger. That is also why the list grows slowly:
        it moves at the speed of checking rather than the speed of asking.</li>
      <li><b>It costs nothing and it buys nothing.</b> No paid placements and no affiliate links, on this page or
        anywhere on this site. ${
          noun === "vendors"
            ? "There is one editorial mark here, Bought from them, and it means money actually changed hands. It cannot be requested."
            : /* WAS "The order is alphabetical and it always will be, so nobody can pay
                 or ask their way up it." It was true when it was written and stopped
                 being true on 24 August 2026, when the order became hand picked at
                 the owner's request. A promise a page cannot keep is worse than no promise,
                 and the half that still holds is the half worth saying: the ordering
                 changed, the not-for-sale part did not. */
              "Nothing here is paid for and nothing here can be bought: no placements, no fees and no affiliate links, whatever order the list happens to be in."
        }</li>
    </ul>
    <p class="btn-row" style="margin-top:var(--s4)">
      <a class="btn btn-sky btn-sm" href="https://www.instagram.com/garbagerips585/" rel="noopener" target="_blank"
         aria-label="Message Garbage Rips 585 on Instagram, opens on instagram.com">Message us on Instagram</a>
      <a class="btn btn-ghost btn-sm" href="/videos.html">Or comment on any rip</a>
    </p>
  </div>
</section>`;

/* TWO GUARDS, BECAUSE THIS PAGE'S COPY HAS NOW DRIFTED AHEAD OF ITS DATA THREE
   SEPARATE TIMES and every one of them was caught by a person reading the page
   rather than by the build. The lede named four kinds of creator against one;
   it named three cities against one; and /vendors.html's lede claimed a vouch
   the rows do not carry. All three are the same shape: a sentence about what
   the list is FOR, standing where a sentence about what it HOLDS belongs.

   These are the smallest checks that would have caught the last two, and they
   are deliberately narrow. They read the copy this file writes and compare it
   to the rows this file was handed, and they THROW, because the alternative is
   a comment saying "keep these in step", which is what was there. They do not
   police prose in general and must not grow into that: `empty` and `note` are
   exempt on purpose, since both are plainly asks rather than descriptions
   ("anywhere in Upstate New York close enough to count belongs here"). */
const CITY_WORDS = ["Rochester", "Buffalo", "Syracuse"];

const checkCities = (text, rows, where) => {
  const areas = rows.map((o) => String(o.area || "")).join(" | ");
  for (const city of CITY_WORDS) {
    if (!text.includes(city)) continue;
    if (areas.includes(city)) continue;
    throw new Error(
      `build-locals: ${where} names ${city} and no entry's "area" does.\n` +
        `  Areas on the page: ${areas || "(none)"}\n` +
        `  A lede describes the list in front of the reader. Name the cities the rows are in,\n` +
        `  or add somebody from ${city}. Do NOT widen the sentence to cover a city the page\n` +
        `  does not: that is what "Rochester, NY, Buffalo, Syracuse and nearby" was doing over two\n` +
        `  Rochester, NY entries. The invitation to the wider region belongs in "empty" and "note".`
    );
  }
};

const VOUCH_CLAIMS = /\b(we (actually )?buy from|handed money to|bought from|we have bought)\b/i;

const checkVouch = (text, rows, where) => {
  if (!VOUCH_CLAIMS.test(text)) return;
  if (rows.some((o) => o.vouched)) return;
  throw new Error(
    `build-locals: ${where} says this site buys from the people on it, and no entry is marked "vouched".\n` +
      `  "vouched" is the one editorial signal these pages have and it means the owner actually bought\n` +
      `  from them. A page that claims it in prose and renders it on no card is claiming it twice\n` +
      `  as loudly as the chip would and backing it with nothing. Set "vouched" where it is true,\n` +
      `  or say something the page can show.`
  );
};

/* THE ONLY PAGE CSS THESE TWO PAGES HAVE, and it is four rules because
   everything else on them was already in ui.css. The routing row is a new
   shape: a labelled strip of five internal links at the foot of the list, and
   the nearest thing already in the stylesheet is .st-also, which is a single
   link beside a button on /start.html rather than a row of its own.

   TEAL, BECAUSE THEY ARE ROUTES. CLAUDE.md's accent rule in one line: teal is
   how you get around. --sky-deep and not --sky, because this type is 14px and
   the big teal only clears its ratio above 24px; --sky-deep measures 4.50:1 on
   --page, which is the ground this row actually sits on.
   THE LABEL IS NOT AN ACCENT AT ALL. It is --ink-soft, a neutral, for the same
   reason a section heading on this site is neither teal nor pink: the two
   accents must never land on each other, and a mono label above a row of teal
   links is exactly where that goes wrong.

   44px MINIMUM ON EVERY LINK. Five small links in a row is the tap-target
   failure the footer's Collectr link was caught by, so each gets the full
   height and the gap keeps them apart rather than the padding alone. */
const PAGE_CSS = `
.loc-more{margin-top:var(--s5);padding-top:var(--s4);border-top:1px solid var(--hair)}
.loc-more-h{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-soft);margin-bottom:var(--s2)}
.loc-more a{display:inline-flex;align-items:center;min-height:44px;margin-right:var(--s4);
  font:700 var(--t-sm)/1.2 var(--body);color:var(--sky-deep)}
.loc-more a:hover,.loc-more a:focus-visible{text-decoration:underline}
`;

function page({ metaDesc, slug, title, h1, kicker, lede, list, kind, empty, ask }) {
  /* THE FILE'S OWN ORDER, NOT ALPHABETICAL, SINCE 24 August 2026.
     The owner asked for TOAK Pulls first on both lists. This used to sort by name and
     therefore ignored data/vendors.json and data/creators.json entirely, so
     reordering those files did nothing at all and the change looked like it had
     not landed. Both files now carry a note saying their array order IS the page
     order, which is only true because this line stopped overriding them.
     The old comment said "See the header note on why this is not a ranking", and
     that note is still right about the important half: this is not a ranking and
     nothing on either page is paid for. What changed is that the order is picked
     by hand rather than by the alphabet, so the sentence in getListed that
     promised alphabetical was rewritten in the same commit rather than left
     standing as a promise the data breaks. */
  const rows = [...list];

  // Only when there IS a list. An empty page's lede is its whole pitch and the
  // rows it is measured against do not exist yet.
  if (rows.length) {
    checkCities(lede, rows, `the lede on /${slug}`);
    checkCities(metaDesc || "", rows, `the meta description on /${slug}`);
    checkVouch(lede, rows, `the lede on /${slug}`);
    checkVouch(kicker, rows, `the kicker on /${slug}`);
    checkVouch(metaDesc || "", rows, `the meta description on /${slug}`);
  }
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      /* THREE LEVELS SINCE /rochester.html EXISTS. These two pages sat directly
         under Home, which said in structured data that they are top-level
         subjects of this site. They are not: they are two of the five pages
         that make up the local section, and the hub is the page that says so.
         The visible crumb below emits the same three, because a breadcrumb that
         disagrees with its own markup is worse than neither. */
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: HUB.label, item: `${SITE}${HUB.url}` },
        { "@type": "ListItem", position: 3, name: h1, item: `${SITE}/${slug}` },
      ],
    },
  ];
  // Only claim an ItemList when there is a list. Marking up an empty page as a
  // collection asserts something the page does not show.
  //
  // And every entry has to carry a `url`. This block used to emit a `name` and
  // a `position` and stop, which describes a thing with no address: Google
  // drops an ItemList whose items cannot be resolved, so it was doing nothing
  // at all. These people are not pages on this site, they are real accounts
  // elsewhere, so the target is their own address, exactly as build-shops.mjs
  // already does for the card shops.
  //
  // All or nothing. A list where some entries resolve and some do not is not a
  // partial win, it is a list a crawler cannot use, and it would quietly
  // publish "we have no address for this person" as structured data. One row
  // with no link anywhere means no ItemList, and the page still reads fine.
  const targets = rows.map(primaryUrl);
  if (rows.length && targets.every(Boolean)) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: h1,
      itemListElement: rows.map((o, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: o.name,
        url: targets[i],
      })),
    });
  }
  // ONE MAIL MERGE FOR TWO INDEXED PAGES IS DUPLICATE CONTENT. vendors.html and
  // creators.html were both getting "N <kind> around Rochester, New York and the
  // wider region, with links to follow them", differing only in a noun and a
  // number, which is the description Google sees on both. Each page names its
  // own now, and the mail merge is only the fallback.
  const desc = metaDesc || (rows.length
    ? `${rows.length} ${kind} around Rochester, New York and the wider region, with links to follow them.`
    : lede);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/${slug}">
${rows.length ? "" : '<meta name="robots" content="noindex,follow">\n'}<meta property="og:title" content="${esc(h1)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/${slug}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
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
<style>${miniCSS(PAGE_CSS)}</style>
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
    <span class="kicker">${esc(kicker)}</span>
    <h1>${h1.replace(/\b(vendors|creators)\b/, '<span class="hl">$1</span>')}</h1>
    <p class="lede" style="max-width:38em">${esc(lede)}</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="${HUB.url}">${esc(HUB.label)}</a> / ${esc(h1)}</nav>
    ${
      rows.length
        ? `<ul class="loc-list">
${rows.map((o) => card(o, kind)).join("\n")}
    </ul>${/* "because we rate them" IS BRITISH AND IT MEANS THE OPPOSITE HERE. In
         American English "we rate them" reads as "we rank them", and the same
         paragraph on /creators.html opens "Listed alphabetically, not ranked",
         so the sentence contradicted itself eleven words later. The claim being
         made is that nobody paid to be on the list, so say that. */ ""}
${earlyNote(rows, kind)}`
        : `<div class="fk-golden">
      <p class="fk-golden-h">Nothing here yet</p>
      <h2>This list is being <span class="hl">built</span></h2>
      <p>${esc(empty)}</p>
      <p style="margin-top:12px"><a class="btn btn-yt btn-sm" href="#get-listed">Here is how to get on it</a></p>
    </div>
    <p class="price-note">We would rather show an empty page than a made up one. Everybody listed here will be a real
      person or a real business we can point you at, so the list starts empty and grows.</p>`
    }
    ${/* THE PAGE NAMED ITS SIBLINGS AND LINKED NONE OF THEM. Both notes run
          through esc(), which is correct, so "see Card shops" on /vendors.html
          and the invitation to the wider region on /creators.html were plain
          text pointing at pages one tap away that a reader had no way to reach
          from here. A local section whose pages do not link each other is five
          separate pages that happen to share a heading in the nav.

          IT IS A ROW OF CONTROLS AND NOT LINKS INSIDE THE SENTENCE, which is
          the shape CLAUDE.md asks for and also the reason the notes above did
          not simply get anchors dropped into them: a route at the end of a
          block is a route, a route in the middle of an explanation is a
          reader losing their place. Every one of these is internal. */ ""}
    <nav class="loc-more" aria-label="More local pages">
      <p class="loc-more-h">More around Rochester, NY</p>
      <a href="${HUB.url}">The whole local scene</a>
      <a href="/card-shows.html">Card shows</a>
      <a href="/shops.html">Card shops</a>
      <a href="${slug === "vendors.html" ? "/creators.html" : "/vendors.html"}">${
        slug === "vendors.html" ? "Local creators" : "Local vendors"
      }</a>
      <a href="/garbage-plate.html">Garbage Plate</a>
    </nav>
  </div>
</section>
${getListed(ask)}

</main>
${imgLbMarkup("Logo")}
${footer("Local listings. No paid placements.")}
<script>
(function(){
${imgLbJs("Logo")}
})();
</script>
${APP_JS}
</body>
</html>
`;
}

const V = page({
  metaDesc:
    "Pokemon card sellers around Rochester, NY worth knowing, what each one carries, and a link to " +
    "find them. No paid placements.",
  slug: "vendors.html",
  title: "Pokemon Card Vendors in Rochester, NY | Garbage Rips 585",
  h1: "Local vendors",
  // A literal bullet, not &bull;. The kicker goes through esc() like every
  // other value here, so an HTML entity written in the source comes out as the
  // visible text "&BULL;" on the page.
  /* WAS "585 • People we buy from", which is the vouch claim a third time, in
     the largest chip on the page, over two rows that carry no "vouched". The
     kicker goes through checkVouch() with the lede and the meta description
     now, so it cannot come back without the flag coming back with it. */
  kicker: "585 • Sellers worth knowing",
  /* THREE CLAUSES AGAINST TWO VENDORS, AND ONE OF THE THREE WAS NOT TRUE. It
     read "the ones at the shows, the ones with a table every month, the ones we
     have actually handed money to", which promises a survey; the page holds two
     entries. The third clause is the worse half: "handed money to" IS the
     `vouched` flag, the one editorial signal this file has, and NEITHER row
     carries it, so the lede was announcing a chip the page never renders.
     checkVouch() below now stops the build on that sentence rather than leaving
     it to be re-read by eye. The metaDesc lost the same claim in the same edit,
     and it was the more expensive of the two because it is the copy Google
     prints. */
  lede: "Sellers around Rochester, NY worth knowing: who they are, what they carry, and where to find them.",
  list: vendors.vendors || [],
  kind: "vendors",
  empty:
    "We are putting together a list of vendors around Rochester, NY who are worth buying from: who they are, what they " +
    "carry, and which shows you will find them at. If you sell locally, or you have bought from somebody good, tell us.",
  /* THE FIVE THINGS ARE data/vendors.json's OWN FIELDS IN ITS OWN ORDER: name,
     area, sells, shows, and the handles. Written out because a vendor who sends
     those five has written their row, and the difference between a page that
     invites and a page that collects is whether the ask is specific enough to
     answer in one message. */
  ask: {
    noun: "vendors",
    one: "seller",
    asset: "logo",
    subject: "vendor listing",
    emailFields: ["Name as you want it printed", "Town you work out of", "What you carry",
      "Shows you are usually at", "Handles and website"],
    sends:
      "A message, a comment, a photo of your table at a show, whatever is easiest.",
    fields: [
      "Your name as you want it printed.",
      "The town you work out of.",
      "What you carry: singles, sealed, graded, all of it.",
      "Which shows you are usually at.",
      "Every handle you want on the card, and your own site if you have one.",
    ],
  },
});

const C = page({
  // THE DESCRIPTION AND THE LEDE BOTH NAMED FOUR KINDS OF CREATOR AND THE PAGE
  // HAS ONE. data/creators.json holds two entries, both Rochester, both channels;
  // there is no artist and no competitive player on it, and the description is
  // the copy Google prints. The title keeps the three cities because that is the
  // search this page is for and the list is meant to grow into it, but neither
  // line promises a roster the page cannot show. Add the roles back the day the
  // file has them.
  metaDesc:
    "Pokemon creators worth following in Rochester, NY and around Upstate New York, " +
    "with a link to each. No paid placements.",
  slug: "creators.html",
  title: "Pokemon Creators in Rochester, NY, Buffalo and Syracuse",
  h1: "Local creators",
  kicker: "Upstate NY • Support your scene",
  /* THE LEDE NAMED THREE CITIES AND THE PAGE COVERS ONE. It read "Other people
     making Pokemon content in Rochester, Buffalo, Syracuse and nearby", against
     two entries whose `area` is "Rochester" both times. That is the same fault
     the comment above this one describes and fixed for the ROLES, one line
     later, in the same paragraph: a true statement about what the page is FOR,
     written as a statement about what it HOLDS. The city list is now what the
     rows actually say, and checkCities() below stops the build if that stops
     being true. The invitation to the rest of Upstate New York survives, in the
     `empty` copy and in the note under the list, where it is plainly an ask.
     THE TITLE KEEPS THE THREE CITIES and that was already argued above: a title
     is the search this page is for. A lede is a description of the page in front
     of the reader, which is why the two are allowed to differ. */
  lede: "Other people around Rochester, NY making Pokemon content. Go watch them.",
  list: creators.creators || [],
  kind: "creators",
  empty:
    "We want to point people at everybody else making Pokemon content in Rochester, NY, Buffalo, Syracuse and the towns " +
    "around them. If that is you, or somebody you watch, let us know and you go on the list.",
  /* FOUR RATHER THAN FIVE, because data/creators.json holds four fields and not
     five: a creator has no "shows" and no "sells". The count is written into the
     ask rather than typed into the sentence, so the two cannot disagree. */
  ask: {
    noun: "creators",
    one: "person",
    asset: "logo or channel art",
    subject: "creator listing",
    emailFields: ["Name as you want it printed", "Where you are", "What you make",
      "Handles and website"],
    sends:
      "A message, a comment on a rip, a tag in a story, whatever is easiest.",
    fields: [
      "Your name as you want it printed.",
      "Where you are: \"Rochester, NY\", \"Buffalo\", \"Syracuse\", or the town if it is none of those.",
      "What you make: rips, singles, art, competitive, something we have not thought of.",
      "Every handle you want on the card, and your own site if you have one.",
    ],
  },
});

await writeFile(join(ROOT, "public/vendors.html"), V);
await writeFile(join(ROOT, "public/creators.html"), C);
const nv = (vendors.vendors || []).length;
const nc = (creators.creators || []).length;
console.log(`Wrote public/vendors.html (${nv} vendor${nv === 1 ? "" : "s"}) and public/creators.html (${nc} creator${nc === 1 ? "" : "s"})`);
if (!nv || !nc) {
  console.log("  Empty lists render an honest empty state and stay noindex and out of the sitemap.");
  console.log("  Fill data/vendors.json and data/creators.json to publish them.");
}

/* THE LOWEST-FRICTION WAY TO GROW THESE TWO LISTS IS NOT A SEARCH, IT IS THE
 * CHANNEL'S OWN DESCRIPTIONS, and nothing was reading them.
 *
 * The pages are short because nobody has added to them, and the obvious fix,
 * going and finding local vendors, is the one thing this file exists to refuse:
 * an unsourced name here is worse than a short list. But there IS a source that
 * is already in the tree, already the owner's own words, and already a statement that
 * he knows and works with somebody: the @mentions in his video descriptions. He
 * tags the shop a box came from and the people he films with. Every one of those
 * is a local account he has vouched for in public, on his own channel.
 *
 * SO THIS PRINTS A TO-DO AND NEVER WRITES A ROW. It cannot publish anybody: an
 * @mention is not consent to be listed and this build has no way to check the
 * account is local, which is the check the page promises its readers. What it
 * removes is the part that actually stops the list growing, which is remembering
 * who you have already worked with.
 *
 * THREE FILES, NOT TWO. A handle already on data/shops.json is not missing, it is
 * on the right page: /shops.html is bricks and mortar and this is people, and
 * data/vendors.json's own readme draws that line. Matching is on the handle and
 * on a squashed form of the name, because "LingSter Games" is tagged
 * @lingstergames.
 *
 * IT IS SILENT WHEN THERE IS NOTHING TO SAY, and today there is nothing: both
 * handles the 319 descriptions contain are already on a local page. That is the
 * check working rather than the check being pointless. It also cannot fail the
 * build, because descriptions.json is written by a sync that is not in
 * build-all.mjs and a missing file must not stop two pages rendering. */
try {
  const desc = plainDashesAll(JSON.parse(await readFile(join(ROOT, "data/descriptions.json"), "utf8")));
  const shops = JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8"));
  const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const known = new Set();
  for (const o of [...(vendors.vendors || []), ...(creators.creators || []), ...(shops.shops || [])]) {
    known.add(flat(o.name));
    for (const [k] of SOCIALS) if (o[k]) known.add(flat(o[k]));
  }
  const seen = new Map();
  for (const text of Object.values(desc)) {
    for (const m of String(text).match(/@[A-Za-z0-9._-]{2,30}/g) || []) {
      const h = m.slice(1);
      seen.set(flat(h), (seen.get(flat(h)) || 0) + 1);
    }
  }
  const missing = [...seen.entries()].filter(([h]) => !known.has(h)).sort((a, b) => b[1] - a[1]);
  if (missing.length) {
    console.log(
      `  ${missing.length} account${missing.length === 1 ? "" : "s"} tagged in our own video descriptions ` +
        `and on no local page yet:`
    );
    for (const [h, n] of missing.slice(0, 12)) {
      console.log(`    @${h}  (tagged in ${n} description${n === 1 ? "" : "s"})`);
    }
    console.log(
      "  Check each one is local and still active, then add it to data/vendors.json, data/creators.json\n" +
        "  or data/shops.json. Do NOT paste a handle in without opening it: see the readme in either file."
    );
  }
} catch {
  /* data/descriptions.json comes from scripts/sync-youtube.mjs, which needs a
     key and is not in build-all.mjs. No file, no nudge, no failure. */
}
