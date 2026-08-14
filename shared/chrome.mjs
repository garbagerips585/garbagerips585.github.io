import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
// The bits of chrome every page wears: the bar, the mobile menu, the footer,
// the icon sprite and the skip link.
//
// These used to be copied into build-set-pages.mjs and build-pages.mjs as
// separate string constants, so a change to the nav had to be made twice and
// the two had already drifted. One source now; both generators import it.
//
// The home page and the three pages built from it take their chrome by slicing
// index.html rather than importing this, because they also need its <head>.
// That is real duplication, and it has already bitten: index.html's copy of the
// bar carried onsubmit="return false" with no action and no name, so the search
// box did nothing on six pages while working on the other 332.
//
// checkDrift() below is called by build-proto.mjs and fails the build when the
// two diverge. A comment claiming a guard is not a guard.

/**
 * THE NAV, and it is the ONLY place nav is defined.
 *
 * The bar, the menu and the footer are all derived from this one array. They
 * used to be three hand-maintained lists and they drifted, exactly as you would
 * expect: /hall.html was "Hits" in the bar, "Best pulls" in the menu and "Card
 * Hall of Fame" in the footer, so somebody who clicked Hits and later looked
 * for it in the footer was hunting a page that appeared not to exist. /sets/
 * carried three names too, and /collection.html was in the menu but missing
 * from the footer entirely. Derivation is the fix; a guard cannot catch what it
 * is not told to compare.
 *
 * GROUPED BY WHAT YOU CAME TO DO, not by content type and not by audience.
 * Audience-based nav ("new collectors", "returning collectors") is a known
 * failure: NN/G lists five reasons, the first being that users do not know
 * which group they are in. Serious Eats is the closest real analogue to this
 * site, a mix of tools, guides, reference data and a media archive, and it
 * splits its top level by intent and only its second level by subject.
 *
 * LABELS ARE FRONT-LOADED NOUNS. Nielsen's first-two-words study (80 people)
 * found users see about two words per list item, and for 35% of links the
 * first 11 characters left them unsure where it led. "Real or fake?" spends
 * that budget on "Real or", "Worth grading?" on "Worth grad". "Fakes" and
 * "Grading" put the load-bearing word first. The pages keep their question
 * headlines, where the search-matching value actually is.
 *
 * Each entry is [group title, [[href, label], ...]].
 */
export const NAV = [
  ["Watch", [
    ["/videos.html", "Rips"],
    ["/playlists.html", "Playlists"],
  ]],
  // Tim's own cards in three states: pulled, owned, wanted. This is NOT "watch"
  // material, which is where two of these used to sit. It is also the thing no
  // competitor has: the nav audit found no Pokemon creator site that publishes
  // what they actually pulled and what it is worth. The owned half now lives on
  // his real Collectr profile, linked from the footer, rather than a page of
  // ours competing with the pages meant to earn traffic.
  ["The binder", [
    ["/hall.html", "Best pulls"],
    ["/wanted.html", "Most wanted"],
  ]],
  ["Cards", [
    ["/cards.html", "Card search"],
    ["/pokemon/", "By Pokemon"],
    ["/sets/", "Set guides"],
    ["/expansions.html", "Every set ever"],
    ["/upcoming.html", "Coming next"],
    ["/complete-a-set.html", "Cost to complete"],
  ]],
  ["Guides", [
    ["/start.html", "Start here"],
    ["/rarity.html", "Rarity guide"],
    ["/fake-cards.html", "Fakes"],
    ["/grading.html", "Grading"],
    // Matches the page's own H1 and title. It was "Pull rates", which is what
  // people search for but not what the page has: the body says in as many words
  // that these are observed results and not official pull rates, because The
  // Pokemon Company does not publish those. A nav label promising a number the
  // page refuses to state is the one place the site contradicted its own rule.
  ["/luck.html", "Luck, measured"],
  ]],
  // Its own group rather than an item under Guides, because it answers a
  // different question: everything else here helps you buy, open or value a
  // card, and this is the only part of the site that is just for fun. Filed
  // under "Play" and not "Games" so the lore page is not the odd one out.
  // TWO LINKS, NOT FIVE. This shipped listing all three games AND the hub that
  // exists to list them, which is the nav doing the hub's job and paying for it
  // in every other group's visibility. The hub is one tap away and names them
  // better than a nav label can.
  ["Play", [
    ["/games/", "Games"],
    ["/lore.html", "Pokemon lore"],
  ]],
  ["Rochester, NY", [
    // Shops and shows sit next to each other deliberately: they answer the same
    // question a week apart. Keep the labels distinct, the urls are one letter
    // apart and the menu is the only place a reader sees both at once.
    ["/card-shows.html", "Card shows"],
    ["/shops.html", "Card shops"],
    ["/vendors.html", "Local vendors"],
    ["/creators.html", "Local creators"],
    ["/about.html", "About"],
  ]],
];

/**
 * The handful of links the bar shows on desktop.
 *
 * FIVE, NOT THREE. The folklore is that a nav should hold 7±2 items, but the
 * people who actually tested navigation published the refutation: Larson and
 * Czerwinski built 8, 16 and 32 link versions of a 512 document site and users
 * were "reliably slowest and were most lost" on the EIGHT link one. Sixteen was
 * fastest. Real content sites cluster at six or seven top level items. Three
 * was under-broad, not restrained.
 *
 * These are hrefs into NAV, never their own labels, so the bar cannot drift
 * from the menu again. A link in two places with two names is two mental
 * models and one of them is always wrong.
 */
export const BAR_LINKS = ["/videos.html", "/cards.html", "/sets/", "/start.html", "/card-shows.html"];

/** Every [href, label] in NAV, flattened, in order. */
export const NAV_LINKS = NAV.flatMap(([, links]) => links);

/** Label lookup, so the bar and anything else name a page exactly once. */
const LABEL = new Map(NAV_LINKS);
const labelFor = (href) => {
  const l = LABEL.get(href);
  if (!l) throw new Error(`chrome.mjs: ${href} is in BAR_LINKS but not in NAV`);
  return l;
};

export const SUBSCRIBE =
  "https://www.youtube.com/channel/UCnpEGJ2G_0af1YRyW2euIZQ?sub_confirmation=1";

export const SOCIALS = [
  ["yt", "YouTube", "https://www.youtube.com/@GarbageRips585"],
  ["ig", "Instagram", "https://www.instagram.com/garbagerips585/"],
  ["tt", "TikTok", "https://www.tiktok.com/@garbagerips585"],
  ["fb", "Facebook", "https://www.facebook.com/GarbageRips585"],
];

export const SKIP = `<a class="skip" href="#main">Skip to content</a>`;

/**
 * Web fonts.
 *
 * Titan One for display, Outfit for body, Space Mono for labels. Lived only in
 * index.html's head and in each generator's own head template, which meant the
 * two pages built from shared/chrome.mjs alone shipped with no font link at
 * all: valid HTML, correct CSS, every heading silently falling back to the
 * system sans. Nothing errors when a font never loads, so it renders as
 * "the design looks a bit off" rather than as a bug.
 */
export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

/** Stylesheets, in the order they must load. */
// CACHE BUST THE STYLESHEET, keyed to its own contents.
//
// The link was a bare /assets/ui.css with no version, so a browser that had the
// file cached kept serving it after a deploy. That is invisible for a colour
// tweak and catastrophic for a new component: the hits grid shipped its markup
// and its CSS together, and anyone holding an older ui.css got the <ul> with no
// grid rules at all, which renders as one full-width list item per card with a
// 245px scan stretched across the viewport. It looked like a layout bug and was
// a caching bug.
//
// The suffix is a hash of the file, so it changes when and only when the CSS
// does: no version to remember to bump, and no needless re-download.
// Same treatment for the script. A stale app.js is worse than stale CSS: the
// card search, the pack tear and the hits reveal all live in it, so a cached
// copy silently disables features whose markup already shipped.
export const APP_V = createHash("sha1")
  .update(await readFile(new URL("../public/assets/app.js", import.meta.url)))
  .digest("hex")
  .slice(0, 8);
// packplayer.js rides along on every page, not just rip pages: it is what makes
// a tile play where it sits, and tiles are on the homepage, the set guides and
// /videos.html. ~8KB, and it mounts nothing until something is clicked.
export const APP_JS = `<script src="/assets/app.js?v=${APP_V}" defer></script>
<script src="/assets/packplayer.js" defer></script>`;

const CSS_V = createHash("sha1")
  .update(await readFile(new URL("../public/assets/ui.css", import.meta.url)))
  .digest("hex")
  .slice(0, 8);

export const STYLES = `<link rel="stylesheet" href="/assets/ui.css?v=${CSS_V}">
<link rel="stylesheet" href="/assets/packs.css">`;

/**
 * The sticky bar.
 *
 * The search field is hidden below 640px and the magnifier below 480px,
 * because at 375px the brand, the icon, the menu button and Subscribe add up
 * to more than the row is wide and none of them can shrink.
 *
 * It posts to /search.html, not /videos.html. It searched only the 310 rips
 * for as long as rips were the whole site; it now sits above 4,481 cards, 36
 * set guides and 30 Pokemon pages, and returning videos alone for "umbreon"
 * hid most of what the site knows. /videos.html?q= still works and is still
 * what the library's own filter uses.
 */
export const BAR = `<header class="bar">
  <div class="bar-in">
    <a class="brand" href="/"><b>GARBAGE <i>RIPS</i> 585</b><span>Rochester, NY</span></a>
    <form class="bar-search" role="search" action="/search.html" method="get">
      <label class="sr-only" for="navSearch">Search cards, sets, guides and rips</label>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg>
      <input id="navSearch" name="q" type="search" placeholder="Search cards, sets, rips" aria-label="Search cards, sets, guides and every rip" autocomplete="off">
    </form>
    <nav class="nav-links" aria-label="Primary">
${BAR_LINKS.map((h) => `      <a href="${h}">${labelFor(h)}</a>`).join("\n")}
    </nav>
    <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="menu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <span>Menu</span>
    </button>
    <a class="sub" href="${SUBSCRIBE}"><span>Subscribe</span></a>
  </div>
</header>`;

/**
 * The panel behind the Menu button. Must sit after </header>.
 *
 * Grouped rather than a flat list. NN/G's mobile study (179 people) found
 * hidden navigation cost more than 20% of content discoverability and made
 * people 15% slower, and that the fix is combo navigation: a few links always
 * visible plus a labelled menu for the rest. Their later work found a 45 point
 * swing in menu usage between two different hamburger implementations, so how
 * the button is presented matters more than whether it exists. Ours keeps the
 * word "Menu" beside the icon for that reason.
 *
 * "Home" is deliberately absent: it was the first thing a thumb landed on,
 * spent on the page you are already reading, and the wordmark already goes
 * home.
 */
/**
 * The menu panel.
 *
 * EACH GROUP IS ONE UNBREAKABLE BLOCK, because the panel lays them out in CSS
 * columns and a group split across a column boundary reads as two groups, one
 * of them unlabelled. `.menu-g` plus break-inside: avoid is what stops that.
 *
 * The panel used to be a single tall column at every width: 22 links and six
 * headings in a 752px window meant a large part of the nav was below the fold
 * on open, including whole groups, on the one screen whose entire job is to
 * show what the site contains. Columns fix it without hiding anything behind a
 * second tap.
 *
 * NO NESTED <nav>. sync-chrome.mjs slices this block with a non-greedy match up
 * to the first </nav>, so a nav inside a nav would have it write a truncated
 * menu into all eight hand-maintained pages and mean it. Divs are safe.
 */
export const MENU = `<nav class="menu" id="menu" aria-label="Site">
  <div class="menu-inner">
${NAV.map(
  ([title, links]) => `    <div class="menu-g">
      <p class="menu-h">${title}</p>
      <ul>
${links.map(([href, label]) => `        <li><a href="${href}">${label}</a></li>`).join("\n")}
      </ul>
    </div>`
).join("\n")}
  </div>
  <a class="menu-sub" href="${SUBSCRIBE}">Subscribe on YouTube</a>
</nav>`;

/**
 * The footer.
 *
 * `extra` takes a line of page-specific small print, which the set guides use
 * to say where their card data and prices come from.
 */
/**
 * Tim's public Collectr profile.
 *
 * We used to BUILD a collection page from Collectr's API. It is his own
 * tracking app view, not something a visitor comes here for, and a personal
 * utility page in the nav competes for attention with the pages meant to earn
 * traffic. Linking the real profile is one less thing to keep in sync and
 * sends people to the live version rather than last night's snapshot.
 *
 * Deliberately NOT given a social icon: we do not have Collectr's brand mark
 * and inventing one would be putting a made up logo next to four real ones.
 * A named text link says more anyway.
 */
export const COLLECTR = "https://app.getcollectr.com/showcase/profile/563e3401-e88d-48fe-b42f-8f9816dd7f5a";

/**
 * The footer.
 *
 * GROUPED, IN THE SAME ORDER AS THE MENU. It used to print all eighteen links
 * as one undifferentiated row. Baymard's benchmarking is blunt about why that
 * fails: dividing footer links into sections "helps break the flood of links
 * into manageable groups that are easy for the user to scan", and adds that
 * visual separation is worthless if the groups are not also semantically
 * separate. Nobody has run a controlled grouped-versus-flat experiment, so this
 * is expert guidance rather than measured fact, but the flat version also
 * violated the one hard rule here: WCAG 2.2 SC 3.2.3 wants repeated navigation
 * in the same relative order every time, and a flat list in menu order was not
 * that once the menu was grouped.
 *
 * The footer is a low traffic, high intent surface. NN/G: "A footer is the
 * place users go when users they're lost." Optimise it for finding a known
 * thing, not for link count.
 *
 * `extra` takes a line of page-specific small print, which the set guides use
 * to say where their card data and prices come from.
 */
export const FOOT_NAV = `<nav class="foot-nav" aria-label="Site">
${NAV.map(
  ([title, links]) => `      <div class="foot-col">
        <p class="foot-h">${title}</p>
${links.map(([href, label]) => `        <a href="${href}">${label}</a>`).join("\n")}
      </div>`,
).join("\n")}
    </nav>`;

export const footer = (extra = "") => `<footer>
  <div class="wrap">
    ${FOOT_NAV}
    <p class="foot-tag">Grab a fork. Let's rip.</p>
    <div class="foot-social">
${SOCIALS.map(
  ([cls, label, href]) =>
    `      <a class="soc ${cls}" href="${href}" aria-label="${label}"><svg aria-hidden="true"><use href="#i-${cls}"/></svg></a>`
).join("\n")}
    </div>
    <p class="foot-collectr"><a href="${COLLECTR}" rel="noopener" target="_blank">See the whole collection on Collectr &rarr;</a></p>
    <p>&copy; <span id="year">2026</span> Garbage Rips 585 &bull; Made in the Flower City &bull; Rochester, NY<br>
    ${extra ? extra + "<br>" : ""}Card and sticker art by Unableplacebo. Fan content. Not affiliated with The Pokemon Company or Nintendo.</p>
  </div>
</footer>`;

/**
 * Icon definitions.
 *
 * <use href="#x"> only resolves within the same document, so every symbol a
 * page references has to be in that page's sprite. The set guides use
 * fc-flower before their section labels, and it was missing from here, so 23
 * pages rendered a blank space where the flower should be.
 */
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="fc-flower" viewBox="0 0 24 24"><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(72 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(144 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(216 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(288 12 12)"/></symbol>
  <symbol id="i-yt" viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12zM9.8 15.4V8.6l5.8 3.4z"/></symbol>
  <symbol id="i-ig" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm8.4-11.2a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/></symbol>
  <symbol id="i-tt" viewBox="0 0 24 24"><path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.2-2.6V9.4a5.9 5.9 0 1 0 5.3 5.9V8.7a7 7 0 0 0 4.1 1.3V6.9a3.9 3.9 0 0 1-4.1-3.9z"/></symbol>
  <symbol id="i-fb" viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></symbol>
</svg>`;


/**
 * Compare index.html's inlined chrome against this module.
 *
 * Called by build-proto.mjs. Whitespace is normalised because the two are
 * formatted differently; everything else must match exactly.
 */
export function checkDrift(indexHtml) {
  const norm = (x) => x.replace(/\s+/g, " ").trim();
  const slice = (start, end) => {
    const a = indexHtml.indexOf(start);
    if (a === -1) return null;
    const b = indexHtml.indexOf(end, a);
    return b === -1 ? null : indexHtml.slice(a, b + end.length);
  };

  const problems = [];
  const checks = [
    ["bar", slice('<header class="bar">', "</header>"), BAR],
    ["menu", slice('<nav class="menu"', "</nav>"), MENU],
    // The footer nav was NOT checked, and that is exactly where the drift
    // happened: index.html kept a hand-written six link footer while
    // NAV_LINKS grew to seventeen, and four builders lift the footer out of
    // index.html verbatim, so seven pages shipped without a single link to
    // any card guide. A guard with a hole in it is the shape of the bug.
    [
      "foot-nav",
      slice('<nav class="foot-nav"', "</nav>"),
      FOOT_NAV,
    ],
  ];
  for (const [name, found, want] of checks) {
    if (found == null) problems.push(`${name}: not found in index.html`);
    else if (norm(found) !== norm(want)) problems.push(`${name}: differs from shared/chrome.mjs`);
  }
  return problems;
}
