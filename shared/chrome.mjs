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

/** Nav destinations, in the order they appear in the mobile menu. */
export const NAV_LINKS = [
  ["/", "Home"],
  ["/videos.html", "All rips"],
  ["/start.html", "Start here"],
  ["/cards.html", "Card search"],
  ["/pokemon/", "By Pokemon"],
  ["/rarity.html", "Rarity guide"],
  ["/fake-cards.html", "Real or fake?"],
  ["/grading.html", "Worth grading?"],
  ["/sets/", "Card Pokedex"],
  ["/complete-a-set.html", "Cost to complete"],
  ["/expansions.html", "Every set ever"],
  ["/upcoming.html", "Coming next"],
  ["/wanted.html", "Most wanted"],
  ["/hall.html", "Card Hall of Fame"],
  ["/luck.html", "Luck & pull rates"],
  ["/card-shows.html", "Card shows"],
  ["/shops.html", "Card shops"],
  ["/playlists.html", "Playlists"],
  ["/about.html", "About"],
];

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
export const STYLES = `<link rel="stylesheet" href="/assets/ui.css">
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
      <a href="/videos.html">Rips</a>
      <a href="/hall.html">Hits</a>
      <a href="/sets/">Sets</a>
    </nav>
    <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="menu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <span>Menu</span>
    </button>
    <a class="sub" href="${SUBSCRIBE}"><span>Subscribe</span></a>
  </div>
</header>`;

/** The panel the bar's button controls. Must sit after </header>. */
/**
 * The panel behind the Menu button. Must sit after </header>.
 *
 * Grouped rather than a flat list of twelve. NN/G's mobile study found hidden
 * navigation cost >20% content discoverability and made people 15% slower, and
 * that the fix is combo navigation: a few links always visible plus a labelled
 * menu for the rest. Three headed groups read as three decisions instead of
 * twelve items.
 *
 * "Home" is gone: it was the first thing a thumb landed on, spent on the page
 * you are already reading, and the wordmark already goes home. That alone took
 * the panel from 612px to something that fits the 575px an iPhone actually
 * gives you in Safari once its own toolbars are showing.
 */
export const MENU_GROUPS = [
  ["Watch", [
    ["/videos.html", "All rips"],
    ["/hall.html", "Best pulls"],
    ["/collection.html", "The collection"],
    ["/playlists.html", "Playlists"],
  ]],
  ["Card guides", [
    ["/start.html", "Start here"],
    ["/cards.html", "Card search"],
    ["/pokemon/", "By Pokemon"],
    ["/sets/", "Set guides"],
    ["/rarity.html", "Rarity guide"],
    ["/fake-cards.html", "Real or fake?"],
    ["/grading.html", "Worth grading?"],
    ["/complete-a-set.html", "Cost to complete"],
    ["/expansions.html", "Every set ever"],
    ["/upcoming.html", "Coming next"],
    ["/luck.html", "Luck & pull rates"],
  ]],
  ["The 585", [
    ["/wanted.html", "Most wanted"],
    // Shops and shows sit next to each other deliberately: they answer the same
    // question a week apart. Keep the labels distinct, the urls are one letter
    // apart and the menu is the only place a reader sees both at once.
    ["/card-shows.html", "Card shows"],
    ["/shops.html", "Card shops"],
    ["/about.html", "About"],
  ]],
];

export const MENU = `<nav class="menu" id="menu" aria-label="Site">
${MENU_GROUPS.map(
  ([title, links]) => `  <p class="menu-h">${title}</p>
  <ul>
${links.map(([href, label]) => `    <li><a href="${href}">${label}</a></li>`).join("\n")}
  </ul>`
).join("\n")}
  <a class="menu-sub" href="${SUBSCRIBE}">Subscribe on YouTube</a>
</nav>`;

/**
 * The footer.
 *
 * `extra` takes a line of page-specific small print, which the set guides use
 * to say where their card data and prices come from.
 */
export const footer = (extra = "") => `<footer>
  <div class="wrap">
    <nav class="foot-nav" aria-label="Site">
${NAV_LINKS.slice(1)
  .map(([href, label]) => `      <a href="${href}">${label}</a>`)
  .join("\n")}
    </nav>
    <p class="foot-tag">Grab a fork. Let's rip.</p>
    <div class="foot-social">
${SOCIALS.map(
  ([cls, label, href]) =>
    `      <a class="soc ${cls}" href="${href}" aria-label="${label}"><svg aria-hidden="true"><use href="#i-${cls}"/></svg></a>`
).join("\n")}
    </div>
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
      `<nav class="foot-nav" aria-label="Site">
${NAV_LINKS.slice(1)
        .map(([href, label]) => `      <a href="${href}">${label}</a>`)
        .join("\n")}
    </nav>`,
    ],
  ];
  for (const [name, found, want] of checks) {
    if (found == null) problems.push(`${name}: not found in index.html`);
    else if (norm(found) !== norm(want)) problems.push(`${name}: differs from shared/chrome.mjs`);
  }
  return problems;
}
