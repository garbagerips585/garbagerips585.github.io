#!/usr/bin/env node
// Build public/shops.html from data/shops.json: the card shops around
// Rochester that the owner actually buys from.
//
//   node scripts/build-shops.mjs
//
// This is the most local-SEO page on the site. "pokemon card shop rochester ny"
// is a real search with real intent, and a page that names shops, links them
// properly and says what each is good for is the kind of page that earns it.
// LocalBusiness schema is deliberately NOT emitted: these are other people's
// businesses and we are not their authority. ItemList is what this actually is.

import { readFile, writeFile } from "node:fs/promises";
// A logo is only an opener where a -lg rendition is actually on disk.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, mailtoHref} from "../shared/site.mjs";
import { socialLinks, GLYPH } from "../shared/socials.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { APP_JS_NO_PACKPLAYER as APP_JS, dropUnusedPacksCSS } from "../shared/chrome.mjs";
import { esc, longDate, plateRule, PLATE_CSS } from "../shared/format.mjs";
// The overlay the show flyers open in. Shared rather than copied: see the note
// at the top of shared/lightbox.mjs.
import { imgLbMarkup, imgLbJs } from "../shared/lightbox.mjs";

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

/* HOURS WITHOUT A SOURCE STOP THE BUILD, the same way they already do on
   /garbage-plate.html. That page has thrown on a place with hours and no
   hoursSrc since it was written, with the reason spelled out beside it: "an
   hour nobody can check is how somebody drives to a locked door." The rule is
   the site's, not that page's, and this page was publishing five shops' hours
   under one page-level "last checked" line with no record of where any of them
   came from.

   They had come from the shops. All five were re-read on 25 August 2026
   against each shop's own site and all five matched what was already here.
   That is exactly why this guard belongs here rather than a correction: the
   data was right and unprovable, which is the state that rots quietly the next
   time somebody adds a shop from a directory listing. */
for (const s of shops) {
  if (s.hours && !s.hoursSrc) {
    throw new Error(
      `data/shops.json: ${s.name} publishes hours with no hoursSrc. ` +
        `Hours go up only where the shop states them about itself. ` +
        `Add the page you read them on, or drop the hours.`
    );
  }
}

/* ONE NUMBER OUT OF ANOTHER PAGE'S FILE, AND IT IS READ RATHER THAN LINKED FOR
   A REASON. The plate paragraph near the foot of this page used to say "eleven
   places around here that serve one" as a typed literal, in the sentence that
   sends the reader to the page holding the actual list. This is the only field
   this builder wants out of that file, so it takes the length of the array and
   nothing else: no shape assumption, no second copy of any restaurant, and if
   the file ever disappears the number falls back to the word the sentence would
   have used anyway rather than failing a page about shops over a page about
   dinner. */
let nPlatePlaces = "several";
try {
  nPlatePlaces = (JSON.parse(await readFile(join(ROOT, "data/garbage-plate.json"), "utf8")).places || []).length
    || "several";
} catch {
  /* data/garbage-plate.json is hand written and belongs to build-garbage-plate.mjs. */
}

// data/shop-map.json IS NO LONGER READ HERE. The map it fed came off this page
// on 27 August 2026; see the headstone below. The file and its sync script are
// deliberately still in the repo.

/* THE MAP WAS HERE AND IT IS GONE, 27 August 2026, ON THE OWNER'S CALL: "remove
   the map and text below it on the local card shop page shops.html just get
   right into the listings of the stores." It is the same instruction he gave
   for /card-shows.html on 21 August and the same reasoning: the thing a reader
   came for is the listings, and 900px of picture and caption above them is 900px
   of scrolling before the page answers anything.

   WHAT WENT WITH IT, so nobody has to work out why these disappeared together:
   the drawn SVG, the numbered west-to-east legend under it, the caption, AND
   THE TWO ODbL LINKS IN THAT CAPTION. Those two were the whole reason this page
   carried outbound links to openstreetmap.org and opendatacommons.org, and
   CLAUDE.md says in as many words that "if the map ever loses its OSM geometry,
   these two go with it in the same edit". It has, so they did.

   WHAT IS STILL HERE AND IS NOT DEAD. data/shop-map.json and
   scripts/sync-shop-map.mjs are untouched, exactly as data/card-show-map.json
   was left when the other map came off: the geometry took four Overpass queries
   to fetch and re-fetching it is the expensive part, not re-drawing it. The
   `at` coordinate on each shop in data/shops.json is untouched too. If this is
   ever wanted back, it is this function that has to be written again and
   nothing else.

   WHAT THE MAP WAS FOR, because it was a real argument and not decoration:
   every card says "Panorama Plaza, Penfield" or "Jefferson Road, Henrietta",
   which is precise to somebody who lives here and meaningless to everybody
   else, and this is the most local page on the site. That reader is now served
   by the address on each card, which is a link into their own map app and is
   the thing to put in one anyway. The map answered "how far apart are these";
   the cards answer "where is this one", which is the question people actually
   arrive with. */

// THE HOURS CHART WAS HERE AND IT IS GONE, 20 August 2026, ON THE OWNER'S CALL:
// "Remove the time chart below that map image doesn't need it, as each listing
// for a store lists out its hours of operations and days they are open."
//
// It was a seven column Mon-to-Sun grid, one row per shop, drawn from the same
// `hours` string each card prints verbatim. The argument for it was real and is
// worth keeping in view rather than deleting silently: it answered "who is open
// right now" by looking, which six sentences scattered down 6,000px of page
// cannot. The argument against it is the one that won, and it is simply that it
// said a second time, in a second shape, something every card already says in
// full a screen further down, and it charged 170 lines of parser and 3.5KB of
// page for the repetition.
//
// WHAT WENT WITH IT, so nobody hunts for a caller: DAYS, DAY_IX, parseClock and
// parseHours existed only to feed this chart, and nothing else on this site
// imports from this file. The `hours` FIELD in data/shops.json stays exactly as
// it is and is still printed on every card; the chart was a second reader of it,
// never a second source, so nothing about the data changes.
//
// ONE THING THE PARSER WAS DOING THAT NOW NOBODY DOES: it threw on an hours
// string it could not read in full, which meant a typo in data/shops.json
// failed the build instead of rendering something plausible. That check is gone
// with it. The string is now printed and not parsed, so a typo shows up as a
// typo on the card, which a person reading the page can see.

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
/* THE LINK ROW WAS SEVEN TINY TEXT LINKS IN A LINE AND IT LOOKED IT. The owner,
   27 August 2026: "can we also add social icons or do the links differently they
   look strange when there are so many tiny text links next to each other like
   that lets re think how we list out the links for the the card shops, vendors
   and creators."
   IT IS THE PILL /vendors.html AND /creators.html ALREADY USE, which is the real
   answer to "re think": those two pages have had a good treatment for weeks and
   /shops.html had a different one, so this is one system replacing two rather
   than a third being invented. Same class, same 44px target, same platform marks
   out of the sprite the footer puts on every page, so it costs no new artwork.
   AND A HIERARCHY, WHICH IS THE PART THAT FIXES THE "so many" HALF. Seven links
   of equal weight is seven decisions. A shop's OWN site is the one a reader
   actually wants and it is filled and first; the two or three that go somewhere
   specific in that shop (singles, events, league) come next; the socials, which
   are a feed rather than an errand, come last. */
const shopPill = (href, label, aria, key) =>
  `<a class="loc-soc${key === "primary" ? " is-primary" : ""}" href="${esc(href)}" rel="noopener" target="_blank" aria-label="${esc(aria)}">${
    key && GLYPH[key] ? `<svg class="loc-i" aria-hidden="true"><use href="#i-${GLYPH[key]}"/></svg>` : OUT_ARROW
  }${esc(label)}</a>`;

/* Ours to draw, unlike a platform's mark: it means "this leaves the site", which
   is the same thing the aria-label on every one of these already says. Inline
   rather than in the shared sprite because two pages want it and 1,497 ship the
   sprite. */
const OUT_ARROW =
  `<svg class="loc-i" viewBox="0 0 24 24" aria-hidden="true">` +
  `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" ` +
  `fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
          ${/* THE SHOP'S OWN LOGO, WHERE THE SHOP SENT ONE. Tim, 24 August
                2026: "they sent me their logo to add." That is the ONLY way a
                logo gets on this page. Do not go and fetch one from a shop's
                site or social feed to fill a gap: that is the shop's artwork
                and being good publicity for them is not a licence from them.
                data/shops.json records who sent it and when, beside the file.

                A SHOP WITH NO LOGO RENDERS EXACTLY AS BEFORE. The heading is
                the shop name either way, so this is additive and the five
                shops that have sent nothing are not made to look unfinished by
                an empty frame, which is the same rule shared/brands.mjs
                follows for a venue Commons has no mark for. */ ""}
          ${/* WRITTEN OUT RATHER THAN THROUGH avifPicture(), and that is not
                laziness. That helper only rewrites TCGdex and assets/packs/
                urls; handed anything else it returns the <img> UNCHANGED, so
                calling it here would have been a silent no-op that looked
                correct in the source and shipped WebP to everybody. Checked by
                reading the function rather than by assuming the name meant
                what it says. */ ""}
          ${s.logo ? `${
            /* THE LOGO OPENS LARGER ON A CLICK where build-brand-logos.py wrote
               a -lg rendition, which it does at min(800, master) and declines to
               do at all under a 500px master. Reading the disk rather than a
               flag in the data means a shop that sends a small logo simply does
               not get a control that appears to do nothing. The AVIF is checked
               separately because that script drops one that lost to its WebP. */ ""
          }${(() => {
            const lgW = `assets/shops/${s.logo}-lg.webp`;
            const lgA = `assets/shops/${s.logo}-lg.avif`;
            /* THE PLATE IS BLACK FOR EVERYONE AND THAT IS ONLY RIGHT FOR A
               MARK DRAWN LIGHT. Legacy Games sent a dark purple one, their own
               brand colour: #5019DC measures 2.51:1 on #000, under the 3:1 a
               graphic needs, so it would have gone on the page as a mark you
               cannot see. On white it is 8.35:1. logoBg lets one shop bring its
               own ground rather than forcing every logo onto a compromise, and
               it is a DELIBERATE value in the data, never a default. */
            const bg = s.logoBg ? ` style="background:${esc(s.logoBg)}"` : "";
            if (!existsSync(join(ROOT, "public", lgW))) return `<span class="shop-logo"${bg}>`;
            const a = existsSync(join(ROOT, "public", lgA));
            return `<button type="button" class="shop-logo"${bg} aria-label="Enlarge the ${esc(s.name)} logo" data-imglb="/${lgW}"${
              a ? ` data-imglb-avif="/${lgA}"` : ""
            } data-imglb-alt="${esc(s.name)} logo">`;
          })()}<picture>
            <source type="image/avif" srcset="/assets/shops/${esc(s.logo)}-200.avif 200w, /assets/shops/${esc(s.logo)}-400.avif 400w" sizes="(min-width:900px) 168px, 96px">
            <img src="/assets/shops/${esc(s.logo)}-200.webp" alt="${esc(s.name)} logo" width="200" height="${
              Math.round(200 * (s.logoH || 1) / (s.logoW || 1))
            }" loading="lazy" decoding="async" srcset="/assets/shops/${esc(s.logo)}-200.webp 200w, /assets/shops/${esc(s.logo)}-400.webp 400w" sizes="(min-width:900px) 168px, 96px">
          </picture>${existsSync(join(ROOT, "public", `assets/shops/${s.logo}-lg.webp`)) ? "</button>" : "</span>"}` : ""}
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
          ${
            /* THE HOURS NOW SAY WHO STATED THEM, 25 August 2026. The site's rule
               is that a business's hours are published only where the business
               states them about itself, and /garbage-plate.html has enforced
               that since it was written: build-garbage-plate.mjs THROWS on a
               place with hours and no hoursSrc, and prints "confirmed on their
               own site" beside every one it renders.

               This page published five shops' hours with a single page-level
               "last checked" line and no record anywhere of WHERE they came
               from. They did come from the shops themselves -- all five were
               re-read on 25 August against each shop's own site and all five
               matched what was already here, WeTheHobby included, whose own
               contact page has a typo ("SAT 11pm to 8pm") that this page had
               already quietly got right as 11am. But the repo did not record
               it, so nobody could check without redoing the work. Now it does. */
            s.hours
              ? `<dt>Open</dt><dd>${esc(s.hours)}${
                  s.hoursSrc
                    ? /* "THEIR OWN SITE" NAMED NOTHING, five times per page. Every other outbound
                         link on this page closes its accessible name with "opens on <host>" -- the
                         address link in the SAME <dl> does it -- and these five were the only ones
                         skipped. Pulled up as a list of links, /shops.html gave five identical
                         "their own site" with no shop and no destination between them; the shop
                         name lives up in the <h2>, outside this <dd>, so there was nothing in
                         context to recover it from either.

                         The visible words stay inside the label for WCAG 2.5.3. */
                      `<span class="shop-checked">confirmed on <a href="${esc(s.hoursSrc)}" rel="noopener" target="_blank" aria-label="their own site, ${esc(s.name)}, opens on ${esc(hostOf(s.hoursSrc))}">their own site</a>, ${esc(longDate(s.hoursRead) || s.hoursRead)}</span>`
                    : ""
                }</dd>`
              : ""
          }
        </dl>` : ""}
        ${/* THE NOTE AND THE WARNING ARE NOT GATED ON `plays` ANY MORE, and that gate
             was a live bug rather than a tidy-up. A shop whose league has gone
             QUIET has no `plays` list by definition, and it is exactly the shop
             whose reader most needs the note: Just Games carried a 700-character
             playNote saying its Pokemon calendar had stopped, three sources deep,
             and none of it rendered, while its blurb told the reader to "read the
             note below". This file's own rules exist to stop somebody driving to a
             locked door, and the gate was hiding the warning that says so. */ ""}
        ${(s.plays || []).length || s.playNote || s.playWarn ? `<div class="shop-play">
          ${(s.plays || []).length ? `<p class="shop-play-h">You can play here</p>
          <ul>${s.plays.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
          ${s.playNote ? `<p class="shop-play-note">${esc(s.playNote)}</p>` : ""}
          ${s.playWarn ? `<p class="shop-play-warn">${esc(s.playWarn)}</p>` : ""}
        </div>` : ""}
        <p class="shop-links loc-socs">
          ${shopPill(url, host, `${host}, the ${s.name} site, opens on their site`, "primary")}
          ${s.leagueUrl ? shopPill(s.leagueUrl, "League page", `Official league page for ${s.name}, the Play! Pokemon listing, opens on ${hostOf(s.leagueUrl)}`) : ""}
          ${/* eventsUrl WAS A DEAD FIELD. Four shops carried one and nothing read it,
             so three shops whose playNote says "check the calendar" had that calendar
             sitting in the data with no link on the page. It renders now. */ ""}
          ${s.eventsUrl && s.eventsUrl !== url ? shopPill(s.eventsUrl, "Events", `Events calendar for ${s.name}, opens on ${hostOf(s.eventsUrl)}`) : ""}
          ${/* A SINGLES STOREFRONT IS A DIFFERENT SHOP AND IS WORTH ITS OWN LINK.
             Two of the six run one on a separate subdomain, and it answers the
             question the main site cannot: which Pokemon singles are actually in
             the case, priced, before you make the drive. Millennium named theirs
             in their reply; Legacy's was already recorded in this file's readme
             and had nowhere to go. */ ""}
          ${s.singlesUrl ? shopPill(s.singlesUrl, "Singles", `Pokemon singles store for ${s.name}, opens on ${hostOf(s.singlesUrl)}`) : ""}
          ${/* SOCIALS, ADDED WHEN THE FIRST SHOP ANSWERED. The outreach email asks for
             "website or socials" and there was nowhere to put the answer, which is the
             kind of gap you only find by actually asking somebody. These pass this
             site's outbound test on their own terms: a reader looking for a local shop
             wants the feed where that shop posts what just came in. */ ""}
          ${/* THE SAME SOCIALS LIST VENDORS AND CREATORS USE, from shared/socials.mjs.
             This builder briefly had its own: a socials:{platform:url} object with a
             private label map, written the hour a shop first sent links. Two files
             disagreeing about how to spell "YouTube" is how that ends, so it moved
             out. Handles in the data, links built here. */ ""}
          ${socialLinks(s).map(({ key, label, href }) =>
            shopPill(href, label, `${s.name} on ${label}, opens on ${hostOf(href)}`, key)
          ).join("\n          ")}
        </p>
      </li>`;
  })
  .join("\n");

/* TWO BLOCKS NOW, AND THE SECOND ONE IS THE OMISSION. This page emitted an
   ItemList and no BreadcrumbList at all, so it was the only one of the five
   local pages with no position in the site at all: not a top-level subject, not
   under anything, just a list floating loose. /card-shows.html, /vendors.html
   and /creators.html all carried one. The hub page it now sits under is
   /rochester.html, and the visible crumb added to the body below says the same
   three, because a breadcrumb that disagrees with its own markup is worse than
   having neither.

   AN ARRAY, SO THE <script> BELOW EMITS BOTH. It was a bare object and the head
   JSON.stringify's it directly, which is why adding a second type here without
   changing that line would have silently replaced the shop list. */
const schema = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Local scene", item: SITE + "/rochester.html" },
      { "@type": "ListItem", position: 3, name: "Card shops" },
    ],
  },
  {
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
  },
];

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
/* STRETCH ABOVE 981, for the reason build-playlists.mjs writes down: a grid of
   BORDERED cards wants equal heights, because a short card proud of its
   neighbours reads as a broken row. Measured spread here at 1440: 237px, and
   247 at 1280. The slack goes below the links row rather than inside the card.
   Measured after: 0, with no trailing empty space. */
.shop-list{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(min-width:981px){
  .shop{display:flex;flex-direction:column}
  .shop > .shop-links{margin-top:auto}
}
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
  box-shadow:var(--lift);
  /* The card is what the logo sizes against, exactly as .loc is on the vendor
     and creator pages. Reasoning in full over .loc in ui.css: this grid is
     auto-fit, so the card width does not track the viewport and a logo sized in
     vw is a different fraction of the card on every page that uses this
     component. */
  container-type:inline-size}
.shop-head{display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap}
/* THE LOGO SITS ON ITS OWN GROUND AND THAT IS NOT A STYLE CHOICE. LingSter's
   mark is yellow and white artwork on BLACK, so on the card green it would
   read as a black rectangle stuck to the card. A brand mark is somebody else's
   artwork and we do not get to recolour it, which is the same rule
   shared/brands.mjs states for the retailer marks, so the plate keeps the
   colour the mark was drawn for and takes a keyline to make it deliberate.
   object-fit:contain because the next shop to send one will not be square. */
/* THE SAME clamp AS .loc-logo, TO THE PIXEL, and that is the point: a shop card
   and a vendor card are the same component wearing different data, and this box
   was left at 56px when the other grew on 27 August 2026. Six shops rather than
   two vendors means these cards are 350 to 453px wide against the vendors' 350
   to 718, so the identical rule lands at 96 to 97px here and 96 to 160 there.
   The rule self-limits; it did not need different numbers, and giving it any
   would have started the drift over again.
   THE PLATE STAYS #000 AND THAT MATTERS MORE AT THIS SIZE. LingSter's mark is
   yellow and white drawn FOR black; on the card green it would read as a black
   rectangle stuck to the card rather than as a brand plate. Checked at 128px
   before this shipped, because a small black square and a large one are not the
   same design decision. Do not "fix" it to var(--card): that is right for the
   creator logos, which are drawn on transparency, and wrong for this one.
   THE CLAMP AND THE sizes ATTRIBUTE ARE ONE PROMISE. Change either and change
   both, or the browser fetches for a box that is not there.
   NO BACKTICKS IN HERE. This block is inside a JS template literal, so a pair
   of them around a word ends the string and the builder stops parsing. It did,
   on this very comment. */
.shop-logo{flex:none;width:clamp(96px,24cqw,168px);height:clamp(96px,24cqw,168px);
  border-radius:var(--r-sm);
  background:#000;border:1px solid var(--hair);overflow:hidden;
  display:inline-flex;align-items:center;justify-content:center}
.shop-logo img{width:100%;height:100%;object-fit:contain;display:block}
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
/* EVERY LINK ON THIS PAGE IS TEAL NOW, AND THE RULE WON RATHER THAN THE
   EXCEPTION. CLAUDE.md's accent rule is one sentence: teal is how you get
   around, pink is what the site is saying. These three rules painted 21 of this
   page's 25 links --ketchup-deep -- every shop address, every phone number,
   every shop's own site, and both halves of the ODbL credit -- so the mark that
   means "this goes nowhere" was on the things that go somewhere. /card-shows
   .html did the same to 2 of its 58 and left the other 49 teal IN THE SAME
   DOCUMENT, which is what settles it: there is no exception being argued here,
   there is one page disagreeing with itself and another agreeing with it 4% of
   the time. Neither file carried a word of reasoning for the pink; all four
   rules were a literal color:var(--ketchup-deep) and nothing else.

   AND IT COSTS NO CONTRAST, which was the one thing that could have made the
   pink worth defending. Read off the built pages against the ground actually
   painted under each: on --card, where every shop card's links sit, the small
   pink is 4.51:1 and the small teal --sky-deep is 4.50:1; on --page, where
   the caption credit sits, 6.25 against 6.24. The two accents are a hundredth
   of a ratio apart at these sizes, so this is a semantic fix with no legibility
   trade in either direction. The 0.01 loss is the site's documented worst pair
   (CLAUDE.md: "the small teal at 4.50:1, deliberate") and not a new low.

   --sky-deep AND NOT --mustard, which is the same teal one step darker
   (#70B5D9) and measures 4.05:1 on the card. Small type takes the light one. */
/* 6px OF GAP, NOT var(--s4). These are pills now rather than bare text links,
   and 24px between two filled shapes reads as two groups rather than one row.
   Matches .loc-socs on the vendor and creator cards exactly, which is the point
   of the change: one treatment on all four pages. */
.shop-links{margin-top:auto;padding-top:var(--s3);display:flex;flex-wrap:wrap;gap:6px}
/* .shop-link WAS THE OLD TREATMENT AND IS GONE: 700 weight teal text with an
   arrow, seven of them in a row on the GI Cards card, which is what the owner
   called "so many tiny text links next to each other". The pill it became is
   .loc-soc in ui.css, shared with /vendors.html and /creators.html. */

/* Address, phone and hours. A definition list because that is what it is, and
   it gives the labels somewhere to live without inventing a class each. */
.shop-facts{display:grid;grid-template-columns:auto 1fr;gap:2px var(--s3);margin-top:var(--s2);
  font-size:var(--t-sm)}
.shop-facts dt{font:700 var(--t-micro)/1.6 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink-2)}
.shop-facts dd{line-height:1.5}
.shop-facts a{color:var(--sky-deep);font-weight:600}
.shop-facts a:hover{text-decoration:underline}
/* Who stated the hours, set below them the way /garbage-plate.html sets its
   own. Its own line is .gpp-checked and this matches it: same size, same
   muted ink, on its own line so it reads as a footnote to the hours rather
   than as part of them. The anchor opts OUT of the 44px min-height that
   .shop-facts dd a carries, because that rule is there to make a phone
   number and an address tappable and this is a word inside a sentence. */
.shop-checked{display:block;font:400 var(--t-micro)/1.5 var(--body);color:var(--ink-2)}
/* .shop-facts dd .shop-checked a, NOT .shop-checked a, AND THE EXTRA CLASS IS
   THE ENTIRE POINT. ui.css sets a 44px min-height on .shop-facts dd a to make
   a phone number and an address tappable, and that selector scores 0-1-2
   against this one's 0-1-1, so the shorter form LOST no matter where it sits in
   the cascade. The result was an 11px footnote rendering inside a 44px box: 27
   pixels of dead air under the hours in every shop card, measured. */
.shop-facts dd .shop-checked a{display:inline;min-height:0}

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
/* The map. Capped so it does not become a poster on a desktop, and the SVG
   scales with the box because it has a viewBox and no width attribute.
   currentColor throughout, so it is correct on the light page and would still
   be correct if this block ever moved onto the dark chrome.

   THE FIGURE USED TO BE THE FULL WIDTH OF THE WRAP AND THE MAP 660 OF IT, so at
   1440 it declared 1392px and left 732 of them bare, 52.6% of the viewport. It
   painted nothing in that space, so this was a box-model fault rather than a
   visible one, but a figure claiming width it never uses is the kind of thing
   that gets "fixed" later by stretching the map into it.

   GROWING THE MAP INSTEAD WAS THE OTHER OPTION AND IT WAS REJECTED, because it
   fights the type fix rather than complementing it. At 1392 the drawing is at
   2.18 units to the pixel, so a 16 unit shop name renders at 34.9px, which
   would have to come back down in units, which is the opposite of what a phone
   needs. Every stroke width and dash length in the block below is also argued
   in units per mile at a stated rendered scale ("5 on 4 at 640 units is 3px on
   and 2.4px off at 390"), and all of it would have to be re-derived. So the
   figure shrinks to the map. Same call, same reasons, on /card-shows.html.

   RENDERED TYPE, before -> after, measured off getBoundingClientRect and off
   the computed font-size times the real viewBox-to-viewport scale, which agree:

        320   unit 0.438   name 6.56 -> 12.25px (a number)   bar 5.69 -> 12.25
        390   unit 0.547   name 8.20 -> 15.32px (a number)   bar 7.11 -> 15.32
        768   unit 1.031   name 15.47 -> 16.50px             bar 13.41 -> 16.50
       1440   unit 1.031   name 15.47 -> 16.50px             bar 13.41 -> 16.50 */
/* The .shop-map rules were here and went with the figure on 27 August 2026.
   Removed as a REGION rather than by grepping for the class, because a
   line-based strip of map rules on this site once left orphaned continuation
   lines and broke the build. */
/* THE MAP'S OWN INK, AND EVERY VALUE IS DERIVED FROM A TOKEN BY A STATED MOVE,
   which is the rule the palette section of CLAUDE.md sets and the reason the
   derivation is written beside the number rather than in a commit message.
   Three of them are literal hexes because they are BLENDS of two tokens and CSS
   cannot state that in a custom property without color-mix, which this
   stylesheet does not use anywhere yet.

   THE GROUND IS --paper-3 (#405D49), unchanged, and everything else is judged
   against it. Roads are the page ink at an opacity, so they are the one thing
   here that is not a new colour at all: a road is a lighter scratch on the land
   and nothing more. Water is the only hue on the map, because water being blue
   is the one map convention a reader has without being told, and it is derived
   from --mustard (#70B5D9) pulled most of the way to --navy-deep (#13231B):
   35/65 gives #34565E, which is DARKER than the land as well as bluer. That
   direction matters. Water lighter than land reads as a road, and the first
   pass of this map had exactly that problem with the Genesee.

   NOTHING HERE COMPETES WITH THE DOTS, WHICH IS THE WHOLE BRIEF. The dot is
   --gold (#609CBB) inside a 2px cream ring, and it is the lightest, most
   saturated and only ringed thing in the frame. The brightest the map itself
   gets is a major road at 42% cream, which is a flat #859280. */
.sm-water{fill:#34565E;stroke:none}
.sm-stream{stroke:#467384;stroke-width:1.6;fill:none}
.sm-road{stroke:currentColor;stroke-width:1.1;opacity:.2}
.sm-road-major{stroke:currentColor;stroke-width:2.4;opacity:.42}
/* The city line is an idea and not a thing, so it is dashed and it is the pink,
   which on this site is the mark that goes nowhere. It is the one place the map
   uses an accent, and it uses it because a dashed cream line at low opacity is
   indistinguishable from a minor road at this size, which defeats the point of
   drawing it. 5 on 4 at 640 units is 3px on and 2.4px off at 390.

   IT WENT IN AT 1.6 AND .62 AND CAME STRAIGHT BACK OUT AT 1.4 AND .46. Look at
   the drawing rather than the value: Rochester, NY's line is a genuinely jagged
   thing, full of annexation notches, and at full strength it was the busiest
   object in the frame, which is exactly backwards for the piece of information
   here that matters least. It is context, so it whispers. */
.sm-edge{stroke:var(--ketchup);stroke-width:1.4;stroke-dasharray:5 4;opacity:.46;fill:none}
/* The plate under each shop name, and under the scale bar. --page at 88%, so a
   label is legible over a motorway; see the note beside the placement code. */
.sm-plate{fill:var(--page);opacity:.88}
/* A disc of the map's own ground behind each dot, so the dot reads as a dot on
   a map and not as a junction of whatever roads it happens to land on.
   Millennium Games sits on the Jefferson Road interchange and is the point that
   made this necessary. */
.sm-halo{fill:var(--paper-3);opacity:.8}
.shops-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin-top:var(--s6);max-width:52em}
/* The section ornament, from shared/format.mjs, same as /buying.html and
   /selling.html. Not in ui.css: render blocking on 1,483 pages, drawn on five. */
${PLATE_CSS}
`;

const body = `
<main id="main" tabindex="-1" class="shops">
  <div class="wrap">
    <div class="brk"><h1>Card shops and <span class="hl">where to play</span></h1><span class="ln"></span></div>
    ${/* THE CRUMB THIS PAGE NEVER HAD. Every other page in the local section
          prints one and this one dropped the reader in with no way back up
          except the logo. .crumbs is a ui.css class and costs nothing here; it
          sits under the h1 rather than above it because this page's h1 is a
          .brk rule-and-heading unit and splitting it would leave the rule
          hanging over a line of mono type. */ ""}
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/rochester.html">Local scene</a> / Card shops</nav>
    ${/* "LCS" IS WHAT THE HOBBY CALLS THESE AND THE PAGE DID NOT SAY IT ONCE.
          The owner, 24 August 2026: "a common word used in this hobby is LCS local
          card shop, might be a good thing to add to this page for SEO."
          Used ONCE in the lede where it reads as a definition rather than as a
          keyword, and expanded in full the first time so the page answers "what
          does LCS mean" for somebody new as well as matching the search. The
          long form already appears in the meta description, so the two agree.
          Not repeated down the page: three letters sprinkled through six shop
          cards is stuffing, and it would read as it is. */ ""}
    <p class="shops-lede">Where I actually buy, and where you can sit down and play. Real shops around
      Rochester, New York, run by people who know the hobby. In the hobby these are your LCS, short for local
      card shop, and around here the counter you buy from and the table you play at are usually the same
      building, so both are on one page. Buy local when you can: the shop is why the local scene exists.</p>
    <ul class="shop-list">
${cards}
    </ul>
${/* THE ONE ORNAMENT ON THIS PAGE, AND THIS IS THE PAGE THE PLATE WAS DRAWN
      FOR. Measured on the built page at 390x844: 7,271px tall, ZERO img tags,
      and the only two pictures on it were the shop map and the hours chart,
      both generated SVG, both in the first 894px. The hours chart is gone now
      and the map is the only picture above the fold, so the page is SHORTER and
      even less illustrated than that measurement says. Everything below the
      list is six shop entries and a sign off with nothing to look at. It is the
      least illustrated Rochester, NY page on the site.

      HERE RATHER THAN AT THE TOP because the sentence under it is the page
      speaking in its own voice: the list of shops ends, and then "NOT SPONSORED
      AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO." A Rochester, NY dish is the
      mark for a Rochester, NY page saying that, and it is the same turn
      /buying.html and /selling.html both make when they end on a local counter.

      NOT UNDER THE h1, which was the obvious spot and is the wrong one: the map
      is 366px down and an ornament above it would put two marks in the first
      screen of the page and none in the 6,377px underneath. */ ""}${plateRule()}
    ${shopsDoc.playNote ? `<p class="shops-lede" style="margin-top:var(--s5)">${esc(shopsDoc.playNote)}</p>` : ""}
    <p class="shops-lede">Looking for a one off rather than a weekly night? The
      <a href="/card-shows.html">card show calendar</a> has every show coming up around Rochester, NY, Buffalo
      and Syracuse.</p>
    ${/* THE LOCAL CLUSTER WAS THREE PAGES AND ONE EDGE. /vendors.html and
          /creators.html had ZERO in-body inbound links from anywhere on the
          site on 18 August 2026, reachable only from the hamburger, and this is
          the page whose reader is looking for exactly what they hold. The three
          are the same subject cut three ways, which is the case for linking
          them and also the reason a reader who finds one wants the others. */ ""}${/* "shopfront" IS BRITISH AND THIS PAGE GETS IT RIGHT 40 LINES LOWER, in
         "They run a separate singles storefront alongside the main site". Same
         word on /card-shows.html. */ ""}
    ${/* THE ORNAMENT ABOVE THIS IS A GARBAGE PLATE AND UNTIL 20 AUGUST 2026 IT
          POINTED NOWHERE. There is a whole page about the dish now, this page is
          the one whose reader is already out driving around Rochester, NY, and the
          mark itself is the natural handle for the link. */ ""}
    ${/* "eleven places" WAS TYPED, ON A SITE WHERE THAT IS THE ONE THING A
          SENTENCE MAY NOT DO. It is correct today and it is correct only because
          nobody has opened a twelfth: the moment a place goes into
          data/garbage-plate.json this page would have contradicted the page it
          is linking to, in the same sentence that sends the reader there. It is
          counted out of that file now, exactly as /rochester.html counts it, so
          the two pages cannot disagree. */ ""}
    <p class="shops-lede">Making a day of it? A plate is the other thing this city is known for,
      and <a href="/garbage-plate.html">the Garbage Plate page</a> has the sourced history, a
      diagram of what is actually on one, and ${nPlatePlaces} places around here that serve one.</p>
    <p class="shops-lede">Not everyone selling cards around here has a storefront.
      <a href="/vendors.html">Local vendors</a> are the breakers and sellers we buy from without one, and
      <a href="/creators.html">local creators</a> is who else is filming Pokemon in Rochester, NY, Buffalo and
      Syracuse. <a href="/rochester.html">Everything local in one place</a> is the short version of all of it,
      with the shows, the shops and the plate counted.</p>
    ${/* HOURS CAME OUT OF THIS SENTENCE, 25 August 2026, because they now date
          themselves. Each shop's card carries "confirmed on their own site" and
          the day it was read, so one blanket date up here covering hours too
          would be a second, older answer to a question already answered beside
          the hours -- and the older one would go stale first while still
          reading as authoritative. What is left is what this line still
          genuinely covers. */ ""}
    <p class="shops-lede">Addresses and phone numbers were last checked on
      ${esc(longDate(shopsDoc.updated) || "an unrecorded date")}; opening hours carry their own
      date and source on each shop. Shops move and change their hours, so call ahead if you are
      making a trip of it.</p>
    ${/* THE ASK ALREADY EXISTED AND HAD NO ROUTE. "Say hello on any of the
          socials" is an invitation that makes a shop owner go and find an
          account, so this names an address and prefills what a listing needs.
          The owner, 24 August 2026: "I want them to send their logos to get added to
          the shops pages as well." */ ""}
    <p class="shops-note">NOT SPONSORED AND NOT AFFILIATE LINKS. THESE ARE SHOPS I GO TO.
      IF YOU RUN A CARD SHOP AROUND ROCHESTER AND YOU ARE NOT ON HERE, EMAIL ME.</p>
    <p class="shops-lede">Send the shop name, address, opening hours and whether you run organized play, and attach
      your logo: <a href="${esc(mailtoHref("card shop listing", ["Shop name: ", "Address: ", "Opening hours: ",
      "Phone: ", "Website or socials: ", "Do you run organized play? ", "", "(attach your logo)"]))}">email the
      channel</a>. It opens your own mail app, so the logo goes on as an attachment like any other email.</p>
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
    `<title>Pokemon Card Shops in Rochester, NY &amp; Where to Play</title>`
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
${imgLbMarkup("Shop logo")}
${footer}

<script>
(function(){
${imgLbJs("Shop logo")}
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/shops.html"), dropUnusedPacksCSS(html));

const cleaned = shops.filter((s) => cleanUrl(s.url) !== s.url);
console.log(`Wrote public/shops.html  (${shops.length} shop${shops.length === 1 ? "" : "s"})`);
for (const s of cleaned) {
  console.log(`  cleaned tracking parameters off ${s.name}:\n    ${cleanUrl(s.url)}`);
}
