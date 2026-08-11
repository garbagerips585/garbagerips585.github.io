// The bits of chrome every page wears: the bar, the mobile menu, the footer,
// the icon sprite and the skip link.
//
// These used to be copied into build-set-pages.mjs and build-pages.mjs as
// separate string constants, so a change to the nav had to be made twice and
// the two had already drifted. One source now; both generators import it.
//
// The home page and the three pages built from it take their chrome by slicing
// index.html rather than importing this, because they also need its <head>.
// Keep the two in step: shared/chrome.test is a plain string compare in
// build-proto.mjs that fails the build if they diverge.

/** Nav destinations, in the order they appear in the mobile menu. */
export const NAV_LINKS = [
  ["/", "Home"],
  ["/videos.html", "All rips"],
  ["/sets/", "Card Pokedex"],
  ["/wanted.html", "Most wanted"],
  ["/hall.html", "Card Hall of Fame"],
  ["/shops.html", "Card shops"],
  ["/playlists.html", "Playlists"],
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

/** Stylesheets, in the order they must load. */
export const STYLES = `<link rel="stylesheet" href="/assets/ui.css">
<link rel="stylesheet" href="/assets/packs.css">`;

/**
 * The sticky bar.
 *
 * The search field is hidden below 640px and the magnifier below 480px,
 * because at 375px the brand, the icon, the menu button and Subscribe add up
 * to more than the row is wide and none of them can shrink.
 */
export const BAR = `<header class="bar">
  <div class="bar-in">
    <a class="brand" href="/"><b>GARBAGE <i>RIPS</i> 585</b><span>Rochester, NY</span></a>
    <form role="search" action="/videos.html" method="get">
      <label class="sr-only" for="navSearch">Search every rip</label>
      <input id="navSearch" name="q" type="search" placeholder="Search rips" aria-label="Search every rip by set, product or card">
    </form>
    <a class="icon-btn" href="/videos.html" aria-label="Search all rips">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg>
    </a>
    <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="menu" aria-label="Menu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <a class="sub" href="${SUBSCRIBE}"><span>Subscribe</span></a>
  </div>
</header>`;

/** The panel the bar's button controls. Must sit after </header>. */
export const MENU = `<nav class="menu" id="menu" aria-label="Site">
  <ul>
${NAV_LINKS.map(([href, label]) => `    <li><a href="${href}">${label}</a></li>`).join("\n")}
  </ul>
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

/** Icon definitions. Only the four socials are still referenced by <use>. */
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-yt" viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12zM9.8 15.4V8.6l5.8 3.4z"/></symbol>
  <symbol id="i-ig" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm8.4-11.2a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/></symbol>
  <symbol id="i-tt" viewBox="0 0 24 24"><path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.2-2.6V9.4a5.9 5.9 0 1 0 5.3 5.9V8.7a7 7 0 0 0 4.1 1.3V6.9a3.9 3.9 0 0 1-4.1-3.9z"/></symbol>
  <symbol id="i-fb" viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></symbol>
</svg>`;
