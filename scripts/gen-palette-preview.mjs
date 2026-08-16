/**
 * Writes public/palette-preview.html: the same homepage-and-guide fragment
 * rendered five times, once per candidate palette, so they can be compared
 * like for like.
 *
 * THIS IS A WORKING FILE, NOT A PAGE OF THE SITE, and three things keep it
 * that way. It is `noindex`, which is also how build-search.mjs decides a top
 * level page does not need a PAGES entry (see the guard at the foot of that
 * file); the sitemap is a hand written list in build-pages.mjs, so a file that
 * is never added to it is never in it; and robots.txt disallows everything
 * while the site is on the staging address anyway.
 *
 * DELIBERATELY NOT NAMED build-*.mjs. check-build.py fails the build on any
 * scripts/build-* or scripts/stamp-* file that build-all.mjs does not run, and
 * this one must not be in the nightly: it is a decision aid with a short life,
 * not part of the site. Run it by hand:
 *
 *     node scripts/gen-palette-preview.mjs
 *
 * NOTHING HERE TOUCHES assets-source/ui.css. Every palette is a scoped copy of
 * the token block on a wrapper element, and the fragment carries its own
 * component CSS inline. Deleting public/palette-preview.html and this file
 * leaves no trace in the shared stylesheet.
 */
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ==========================================================================
   THE PALETTES

   Each is a complete token set. The names match assets-source/ui.css, plus
   five colours ui.css hard codes in rules rather than tokenising (chrome-ink
   #F4F1E2, chrome-dim #9FB0C0, foot-ink #B9C6D2, chip-gold-bg #FCF0CC and the
   gold band's label #5A3B06), and four tokens that do not exist yet:

     --chrome-bg   the fill of .bar, .hof, .about and footer, today
                   var(--ink). So "the body text colour" and "the dark
                   chrome's background" are the same token and cannot move
                   apart. In every light palette chrome-bg == ink.
     --on-accent   text drawn ON the gold, mustard and sky fills, today
                   var(--ink) in .sub/.rank/.nav-links[aria-current] and
                   var(--navy) in .btn-yt/.btn-sky/.chip.guide/.pack-hint.
     --keyline     the 2-3px hard borders and the offset hard shadows, today
                   var(--navy), whose other job is the line above.
     --on-alert    the label on the ketchup fill, today a hardcoded #fff in
                   .chip.soon and var(--paper) in .chip.clear:hover.

   The light options set all four equal to what ui.css already uses, so for
   them the split changes nothing. The dark option is the one that needs it,
   which is the point: the current token set cannot express a dark theme.
   ========================================================================== */
const PALETTES = [
  {
    id: "cur",
    label: "Current",
    name: "Diner Plate",
    idea:
      "What the site wears today. Cream diner paper, dark navy chrome, mustard and ketchup sampled from the commissioned art, and a sky-blue band system carried over from the old set guides.",
    t: {
      ink: "#15263A", "ink-2": "#5A6E82", "ink-soft": "#5A6150",
      page: "#F7F5EC", card: "#FFFFFF",
      paper: "#F7F2DE", "paper-2": "#FFFCF0", "paper-3": "#EDE6CB",
      hair: "rgba(21,38,58,.14)",
      navy: "#1E3A54", "navy-deep": "#132637",
      keyline: "#1E3A54", "chrome-bg": "#15263A", "on-accent": "#1E3A54", "on-alert": "#FFFFFF",
      mustard: "#EFC94C", gold: "#E0A21F", "gold-deep": "#8A6109",
      ketchup: "#D9482B", "ketchup-deep": "#A83318", teal: "#1F8C76",
      sky: "#35BEEF", "sky-deep": "#0E6E96", "sky-lite": "#A8E4F7", "sky-tint": "#DCF2FB",
      trubbish: "#6E7D4F",
      lilac: "#CAA6CA", "lilac-pale": "#F0E4F1", plum: "#4E2F48",
      "chrome-ink": "#F4F1E2", "chrome-dim": "#9FB0C0", "foot-ink": "#B9C6D2",
      "chip-gold-bg": "#FCF0CC", "gold-band-label": "#5A3B06",
    },
  },
  {
    id: "a",
    label: "Option A",
    name: "Plate, calmed",
    idea:
      "Keep the energy, cut the hue count. Cream, dark chrome, gold and red all stay; the sky-blue band system leaves and the bands become the same paper one shade down. Gold means highlight, red means interactive, and nothing else on the page means anything.",
    t: {
      ink: "#1B1E22", "ink-2": "#5C6169", "ink-soft": "#5A5750",
      page: "#F6F2E7", card: "#FFFFFF",
      paper: "#F6F2E7", "paper-2": "#FFFDF6", "paper-3": "#E8E1CE",
      hair: "rgba(27,30,34,.18)",
      navy: "#2A2E34", "navy-deep": "#16181C",
      keyline: "#2A2E34", "chrome-bg": "#1B1E22", "on-accent": "#2A2E34", "on-alert": "#FFFFFF",
      mustard: "#F0C64A", gold: "#DFA524", "gold-deep": "#7A5405",
      ketchup: "#C03A26", "ketchup-deep": "#9C2F17", teal: "#4A5D3C",
      sky: "#C9BFA4", "sky-deep": "#6A5A2E", "sky-lite": "#EFE8D4", "sky-tint": "#F0E9D6",
      trubbish: "#6E7D4F",
      lilac: "#C9BFA4", "lilac-pale": "#F2ECDD", plum: "#4A3B2A",
      "chrome-ink": "#F5F1E4", "chrome-dim": "#AAA79E", "foot-ink": "#C3BFB4",
      "chip-gold-bg": "#FBF0CE", "gold-band-label": "#4A3005",
    },
  },
  {
    id: "b",
    label: "Option B",
    name: "Night Rip",
    idea:
      "The sludge greens from the commissioned art used as the ground rather than as a detail. Cream type on a dark page, gold as the only bright thing, and the pack art lit up against it. Looks like the stream it links to. This is the one that needs the four token split above.",
    t: {
      ink: "#F2EEDF", "ink-2": "#A9B19D", "ink-soft": "#B4BBA8",
      page: "#161A13", card: "#20261C",
      paper: "#20261C", "paper-2": "#262D21", "paper-3": "#2F3729",
      hair: "rgba(242,238,223,.20)",
      navy: "#14180F", "navy-deep": "#0B0E09",
      keyline: "#78876A", "chrome-bg": "#0F1310", "on-accent": "#14180F", "on-alert": "#20160F",
      mustard: "#F3CE5C", gold: "#E0A21F", "gold-deep": "#F0C860",
      ketchup: "#E4593A", "ketchup-deep": "#F0866B", teal: "#63C9AB",
      sky: "#E0A21F", "sky-deep": "#9AD9F2", "sky-lite": "#F3CE5C", "sky-tint": "#1F2519",
      trubbish: "#3E4A34",
      lilac: "#6E5F78", "lilac-pale": "#2A2430", plum: "#DEC8E2",
      "chrome-ink": "#F2EEDF", "chrome-dim": "#98A18F", "foot-ink": "#AEB6A5",
      "chip-gold-bg": "#3A3316", "gold-band-label": "#3A2A05",
    },
  },
  {
    id: "c",
    label: "Option C",
    name: "Black / White / Gold",
    idea:
      "The palette the internal tools already use, brought over here. One accent hue, no tinted bands, everything else a value of grey, so the pack art and the card scans are the only colour on the page. The restrained option.",
    t: {
      ink: "#111111", "ink-2": "#5B5B5B", "ink-soft": "#5B5B5B",
      page: "#FAFAF8", card: "#FFFFFF",
      paper: "#F4F3EF", "paper-2": "#FFFFFF", "paper-3": "#E6E4DD",
      hair: "rgba(17,17,17,.18)",
      navy: "#111111", "navy-deep": "#000000",
      keyline: "#111111", "chrome-bg": "#111111", "on-accent": "#111111", "on-alert": "#FFFFFF",
      mustard: "#E8B93A", gold: "#C99700", "gold-deep": "#6E5000",
      ketchup: "#111111", "ketchup-deep": "#6E5000", teal: "#4A4A4A",
      sky: "#D9D6CC", "sky-deep": "#5B5B5B", "sky-lite": "#F0EEE7", "sky-tint": "#F1EFE8",
      trubbish: "#8A8A8A",
      lilac: "#D9D6CC", "lilac-pale": "#F2F1EC", plum: "#3A3A3A",
      "chrome-ink": "#F5F4F0", "chrome-dim": "#A6A6A6", "foot-ink": "#BDBDBD",
      "chip-gold-bg": "#F5E7BD", "gold-band-label": "#332500",
    },
  },
  {
    id: "d",
    label: "Option D",
    name: "Newsstand",
    idea:
      "Maximum legibility. White paper, near-black type, one red for emphasis and one blue for links, grey for everything else. Reads as a reference site rather than a channel, which is either the point of it or the objection to it.",
    t: {
      ink: "#101418", "ink-2": "#4E5560", "ink-soft": "#4E5560",
      page: "#FFFFFF", card: "#FFFFFF",
      paper: "#F4F5F7", "paper-2": "#FFFFFF", "paper-3": "#E4E7EB",
      hair: "rgba(16,20,24,.20)",
      navy: "#101418", "navy-deep": "#000000",
      keyline: "#101418", "chrome-bg": "#101418", "on-accent": "#101418", "on-alert": "#FFFFFF",
      mustard: "#F2C63D", gold: "#D9A21A", "gold-deep": "#6F5200",
      ketchup: "#C81E1E", "ketchup-deep": "#A81616", teal: "#0F6B57",
      sky: "#BFD3E6", "sky-deep": "#0B5FA5", "sky-lite": "#E4EDF5", "sky-tint": "#EDF3F8",
      trubbish: "#6E7D4F",
      lilac: "#CBD3DC", "lilac-pale": "#F0F3F6", plum: "#2B3440",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#A9B2BD", "foot-ink": "#C2C9D1",
      "chip-gold-bg": "#FBEFC9", "gold-band-label": "#3D2D00",
    },
  },
];

/* ==========================================================================
   CONTRAST, measured rather than asserted.
   ========================================================================== */
const hex2rgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lin = (c) => ((c /= 255), c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = hex2rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const r2 = (a, b) => Math.round(ratio(a, b) * 100) / 100;
// An rgba token flattened onto the ground it sits on, so it can be measured.
function flat(c, ground) {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return c;
  const [r, g, b, a = 1] = m[1].split(",").map(parseFloat);
  const [gr, gg, gb] = hex2rgb(ground);
  const mix = (f, bg) => Math.round(f * a + bg * (1 - a));
  return "#" + [mix(r, gr), mix(g, gg), mix(b, gb)]
    .map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Every row is a real rule in assets-source/ui.css, named by line.
 *
 * `min` is the AA floor for that ROLE, not one blanket number: 4.5 for body
 * size text (1.4.3), 3.0 for large text and for non-text UI (1.4.11). The
 * hairline row is measured and printed but not scored, because a decorative
 * divider that is not the only way a component is identified is outside
 * 1.4.11, and scoring it would mark all five palettes as failing for a thing
 * nobody needs to fix.
 */
const PAIRS = [
  ["body text on the page ground", "ink", "page", 4.5, "body L61"],
  ["body text on a white card", "ink", "card", 4.5, ".tool L393"],
  ["body text on guide paper", "ink", "paper-2", 4.5, ".rip-desc L894"],
  ["secondary meta on a card", "ink-2", "card", 4.5, ".v p L371"],
  ["secondary meta on the page", "ink-2", "page", 4.5, ".lib-count L460"],
  ["guide lede and meta on paper", "ink-soft", "paper-2", 4.5, ".lede L817"],
  ["guide meta on paper-3", "ink-soft", "paper-3", 4.5, ".show-row L1735"],
  ["prose link on the page", "ketchup-deep", "page", 4.5, "main p a L109"],
  ["prose link on a card", "ketchup-deep", "card", 4.5, ".mw-head a L259"],
  ["prose link on guide paper", "ketchup-deep", "paper-2", 4.5, ".facts-list b L989"],
  ["section kicker on the page", "sky-deep", "page", 4.5, ".sec-label L814"],
  ["breadcrumb link on guide paper", "sky-deep", "paper", 4.5, ".crumbs a L905"],
  ["chrome text on the dark bar", "chrome-ink", "chrome-bg", 4.5, ".bar L127"],
  ["bar sub-label on the dark bar", "chrome-dim", "chrome-bg", 4.5, ".brand span L135"],
  ["footer body on the dark chrome", "foot-ink", "chrome-bg", 4.5, "footer L623"],
  ["accent heading on dark, large", "mustard", "chrome-bg", 3.0, ".hof-head h2 L213"],
  ["Subscribe button label", "on-accent", "mustard", 4.5, ".sub L147"],
  ["current chip label", "chrome-ink", "chrome-bg", 4.5, ".chip[aria-current] L198"],
  ["gold chip label", "gold-deep", "chip-gold-bg", 4.5, ".chip.gold L200"],
  ["primary button, gold end", "on-accent", "gold", 4.5, ".btn-yt L835"],
  ["primary button, light end", "on-accent", "mustard", 4.5, ".btn-yt L835"],
  ["secondary button label", "on-accent", "sky", 4.5, ".btn-sky L837"],
  ["pressed filter chip label", "on-accent", "sky", 4.5, ".chip[aria-pressed] L1114"],
  ["guide chip label on gold", "on-accent", "gold", 4.5, ".chip.guide L1632"],
  ["'coming soon' chip label", "on-alert", "ketchup-deep", 4.5, ".chip.soon L1688"],
  ["clear-filter chip on hover", "on-alert", "ketchup-deep", 4.5, ".chip.clear L1114"],
  ["body text on the tinted band", "ink", "sky-tint", 4.5, "section.band L820"],
  ["kicker on the tinted band", "sky-deep", "sky-tint", 4.5, ".sec-label L814"],
  ["full band text, top of gradient", "on-accent", "sky", 4.5, ".band-sky L823"],
  ["full band text, foot of gradient", "on-accent", "sky-lite", 4.5, ".band-sky L823"],
  ["warning note on its tint", "plum", "lilac-pale", 4.5, ".intl-warn L1480"],
  ["gold band kicker", "gold-band-label", "gold", 4.5, ".band-gold L884"],
  ["rank badge numeral", "on-accent", "gold", 4.5, ".rank L236"],
  ["focus ring against the page", "ketchup-deep", "page", 3.0, ":focus-visible L120"],
  ["accent fill against the page", "ketchup", "page", 3.0, ".flower L816"],
  ["accent fill against the band", "ketchup", "sky-tint", 3.0, ".flower on .band"],
  ["heavy keyline against the page", "keyline", "page", 3.0, ".set-card L1004"],
  ["heavy keyline against a card", "keyline", "card", 3.0, ".fact L931"],
  ["hairline divider on a card", "hair", "card", null, ".chip L193, decorative"],
];

function score(t) {
  return PAIRS.map(([label, fg, bg, min, where]) => {
    const b = t[bg];
    const f = t[fg].startsWith("rgba") ? flat(t[fg], b) : t[fg];
    const v = r2(f, b);
    return { label, where, f, b, min, v, pass: min === null ? null : v >= min };
  });
}

// Hue families, weighted by how often ui.css actually reaches for the token.
// The unweighted count flatters a palette that hides extra hues in tokens used
// once (--teal is named on one line, --lilac on one) and punishes one that
// spends its hues on the tokens the page is mostly made of.
const USES = {
  ink: 66, "ink-2": 77, "ink-soft": 22, page: 5, card: 43, paper: 11,
  "paper-2": 20, "paper-3": 12, navy: 69, mustard: 48, gold: 26, "gold-deep": 26,
  ketchup: 8, "ketchup-deep": 47, teal: 1, sky: 9, "sky-deep": 3, "sky-lite": 1,
  "sky-tint": 3, trubbish: 11, lilac: 1, plum: 7,
};
function hues(t) {
  const fam = new Map();
  for (const k of Object.keys(USES)) {
    const v = t[k];
    if (!v || !v.startsWith("#")) continue;
    let [r, g, b] = hex2rgb(v).map((x) => x / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (s < 0.12) continue;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    const key = (Math.round(h / 30) * 30) % 360;
    fam.set(key, (fam.get(key) || 0) + USES[k]);
  }
  const all = fam.size;
  const loadBearing = [...fam.values()].filter((n) => n >= 5).length;
  return { all, loadBearing };
}

/* ==========================================================================
   THE FRAGMENT. Same markup five times, only the token block changes.
   Class names mirror ui.css so the rendering can be checked against the real
   pages, but the rules live in this file and nowhere else.
   ========================================================================== */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Pack art tokens copied from ui.css lines 494-511. They are NOT part of any
// palette: the pack wrappers are photographs of real products and stay exactly
// as colourful under every option, which is most of the argument for the
// restrained ones.
const PACKS = [
  ["Ascended Heroes", "ASCENDED<small>HEROES</small>", "#EFC65C", "#D8A93A", "#95681A", "#5E4110", "#FFF6D2", "#3A280A"],
  ["Prismatic Evolutions", "PRISMATIC<small>EVOLUTIONS</small>", "#7FD8E8", "#B98BE0", "#E08AB4", "#5B4A8C", "#FFFFFF", "#2C2350"],
  ["Destined Rivals", "DESTINED<small>RIVALS</small>", "#D6453F", "#8E2C46", "#3E2A63", "#1E1838", "#FFD9DE", "#150F26"],
  ["Chaos Rising", "CHAOS<small>RISING</small>", "#E0563A", "#C2361F", "#7E1D12", "#4A100A", "#FFC48A", "#320A06"],
];

function pack(i, cls = "") {
  const [, brand, a, b, c, d, ink, edge] = PACKS[i % PACKS.length];
  return `<span class="pk ${cls}" style="--pk-a:${a};--pk-b:${b};--pk-c:${c};--pk-d:${d};--pk-ink:${ink};--pk-edge:${edge}" aria-hidden="true"><span class="pk-art"></span><span class="pk-brand">${brand}</span></span>`;
}

function fragment(id) {
  return `
<div class="bar">
  <div class="bar-in">
    <span class="brand"><b>GARBAGE RIPS <i>585</i></b><span>ROCHESTER NY</span></span>
    <span class="fakeform"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 2a6 6 0 104.2 10.3l4.3 4.2 1.4-1.4-4.2-4.3A6 6 0 008 2zm0 2a4 4 0 110 8 4 4 0 010-8z"/></svg><span class="ph">Search 313 rips, 4,481 cards</span></span>
    <span class="sub">Subscribe</span>
  </div>
  <div class="navrow">
    <span class="nav"><a href="#${id}" aria-current="page">Rips</a><a href="#${id}">Sets</a><a href="#${id}">Cards</a><a href="#${id}">Guides</a><a href="#${id}">Games</a></span>
  </div>
</div>

<!-- The filter rail. The chips live HERE on the real site, on the page ground
     under the bar, not inside the dark Greatest Hits band: a first draft put
     them there and the aria-current chip, whose fill is the dark chrome
     colour, vanished into the band it was sitting on. -->
<div class="rail">
  <div class="wrap chiprow">
    <span class="chip" aria-current="true">All rips</span>
    <span class="chip gold">Chase hits</span>
    <span class="chip">Ascended Heroes</span>
    <span class="chip">Booster box</span>
    <span class="chip">Prismatic Evolutions</span>
  </div>
</div>

<div class="hof">
  <div class="wrap">
    <div class="hof-head"><h2>GREATEST HITS</h2><a href="#${id}">See all 313 rips</a></div>
    <div class="hof-card">
      <div class="hof-art">${pack(0)}<span class="rank">1</span></div>
      <div class="hof-txt">
        <b>Pulled a Moonbreon out of a $4 pack at the Public Market</b>
        <p class="mono">ASCENDED HEROES &middot; BOOSTER PACK &middot; 41,208 VIEWS</p>
        <p class="hof-lede">The one everybody asks about. Filmed in the car outside Wegmans because I could not wait to get home.</p>
        <span class="hof-badges"><span class="badge">TODAY'S RIP</span><span class="badge b2">CHASE HIT</span></span>
      </div>
    </div>
  </div>
</div>

<div class="mwband">
  <div class="wrap">
    <div class="sec-head"><div><span class="sub2">MOST WANTED</span><h2 class="h2">The cards Rochester keeps asking for</h2></div><a class="more-link" href="#${id}">Full want list</a></div>
    <div class="mwgrid">
      ${[["Umbreon ex", "#161", "$412.00"], ["Pikachu ex SIR", "#238", "$188.50"], ["Charizard ex", "#199", "$96.25"], ["Sylveon ex", "#086", "$74.10"]]
        .map(([n, num, p]) => `<div class="mw"><span class="mw-art"></span><b>${n}</b><p class="mono">${num} &middot; SPECIAL ILLUSTRATION</p><span class="price">${p}</span></div>`)
        .join("")}
    </div>
  </div>
</div>

<div class="ripband">
  <div class="wrap">
    <div class="sec-head"><div><span class="sec-label"><svg class="flower" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>LATEST RIPS</span><h2 class="h2">Fresh out of the <span class="hl">garbage</span></h2></div></div>
    <div class="vid-grid">
      ${[["Six packs of Prismatic Evolutions and one very bad decision", "2 DAYS AGO &middot; 3,102 VIEWS"],
         ["Destined Rivals ETB, the whole thing, no cuts", "4 DAYS AGO &middot; 1,884 VIEWS"],
         ["Chaos Rising blister from the Wegmans on Ridge", "6 DAYS AGO &middot; 2,461 VIEWS"]]
        .map(([t, m], i) => `<div class="vid"><span class="vid-shell">${pack(i + 1, "pk--tile")}<span class="vid-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span><span class="vid-title">${t}</span><span class="vid-meta">${m}</span></div>`)
        .join("")}
    </div>
    <p class="more"><a href="#${id}">All 313 rips</a></p>
  </div>
</div>

<div class="band">
  <div class="wrap">
    <span class="sec-label"><svg class="flower" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>CARD GUIDES AND TOOLS</span>
    <h2 class="h2">Everything we <span class="hl">know</span>, written down</h2>
    <p class="lede">Thirty-seven set guides, a 4,481 card price index and a rarity chart with real scans. No pull rates, because nobody publishes them.</p>
    <p class="btn-row"><a class="btn btn-yt" href="#${id}">Watch on YouTube</a><a class="btn btn-sky" href="#${id}">Browse the sets</a><a class="btn btn-ghost" href="#${id}">Card search</a></p>
    <div class="facts">
      ${[["313", "RIPS FILMED"], ["4,481", "CARDS PRICED"], ["37", "SET GUIDES"]]
        .map(([n, l]) => `<span class="fact"><span class="n">${n}</span><span class="l">${l}</span></span>`).join("")}
    </div>
  </div>
</div>

<div class="guidepg">
  <div class="wrap">
    <p class="crumbs"><a href="#${id}">Home</a> / <a href="#${id}">Set guides</a> / Ascended Heroes</p>
    <h1>Ascended Heroes <span class="rip">set guide</span></h1>
    <p class="lede">295 cards, released 2026. Still in print, so packs are around $4.50 at the big box stores and $6 at the local shops.</p>
    <p>The chase card is Umbreon ex at #161, and it is the reason this set is still on shelves. If you are opening these to complete the set rather than to hit, the <a href="#${id}">rarity ladder further down</a> is the honest version of what you are getting per box. Prices come from the nightly sync and were last checked this morning.</p>
    <div class="rarities">
      ${[["Common", 92, 62, false], ["Uncommon", 58, 39, false], ["Rare", 34, 23, false], ["Double Rare", 18, 12, false], ["Special Illustration Rare", 9, 6, true]]
        .map(([n, c, w, chase]) => `<span class="rar${chase ? " chase" : ""}"><span class="rar-name">${n}</span><span class="rar-n">${c} cards</span><span class="rar-bar"><i style="width:${w}%"></i></span></span>`).join("")}
    </div>
    <div class="chases">
      ${[["Umbreon ex", "#161 &middot; SIR", "$412.00"], ["Pikachu ex", "#238 &middot; SIR", "$188.50"], ["Sylveon ex", "#086 &middot; SIR", "$74.10"]]
        .map(([n, r, p]) => `<span class="chase-card"><span class="cc-art"></span><b>${n}</b><span class="rr">${r}</span><span class="pr">${p}</span></span>`).join("")}
    </div>
    <p class="note">Still in print and pack prices are not in the API and are not guessed. They live in data/set-notes.json for a human, and are left out when blank.</p>
    <p class="chiprow"><span class="chip guide">Set guide</span><span class="chip">Booster pack</span><span class="chip soon">Guide coming soon</span><span class="chip clearish">Clear filters</span></p>
    <p class="warn">Japanese printings use a different numbering scheme, so a card number from a JP pack will not match this checklist.</p>
  </div>
</div>

<div class="foot">
  <div class="wrap">
    <p class="foot-tag">GARBAGE RIPS 585</p>
    <p class="foot-nav"><a href="#${id}">About</a><a href="#${id}">Rips</a><a href="#${id}">Sets</a><a href="#${id}">Cards</a><a href="#${id}">Shops</a></p>
    <p class="fine">FAN CONTENT. NOT AFFILIATED WITH THE POKEMON COMPANY. CARD AND STICKER ART BY UNABLEPLACEBO.</p>
  </div>
</div>`;
}

/* ==========================================================================
   THE PAGE
   ========================================================================== */
const TOKEN_ORDER = [
  "page", "card", "paper", "paper-2", "paper-3", "ink", "ink-2", "ink-soft",
  "chrome-bg", "chrome-ink", "chrome-dim", "foot-ink", "keyline", "on-accent",
  "navy", "navy-deep", "mustard", "gold", "gold-deep", "chip-gold-bg",
  "gold-band-label", "ketchup", "ketchup-deep", "on-alert", "sky", "sky-deep",
  "sky-lite", "sky-tint", "teal", "trubbish", "lilac", "lilac-pale", "plum", "hair",
];

function swatches(t) {
  return TOKEN_ORDER.map((k) => {
    const v = t[k];
    return `<span class="sw"><span class="sw-c" style="background:${v}"></span><code>--${k}</code><code class="hex">${v}</code></span>`;
  }).join("");
}

function table(rows) {
  const body = rows.map((r) => {
    const tag = r.pass === null ? "info" : r.pass ? "ok" : "bad";
    const verdict = r.pass === null ? "not scored" : r.pass ? "AA pass" : "AA FAIL";
    return `<tr class="${tag}"><td>${r.label}</td><td class="num">${r.v.toFixed(2)}</td><td class="num">${r.min ?? "-"}</td><td>${verdict}</td><td class="sm"><code>${r.f}</code> on <code>${r.b}</code></td><td class="sm">${r.where}</td></tr>`;
  }).join("\n");
  return `<table class="ct"><thead><tr><th>Pair</th><th class="num">Ratio</th><th class="num">Floor</th><th>Verdict</th><th>Colours</th><th>Rule in ui.css</th></tr></thead><tbody>${body}</tbody></table>`;
}

const sections = PALETTES.map((p) => {
  const rows = score(p.t);
  const scored = rows.filter((r) => r.pass !== null);
  const fails = scored.filter((r) => !r.pass);
  const worst = scored.reduce((a, r) => (r.v < a.v ? r : a));
  const h = hues(p.t);
  const vars = Object.entries(p.t).map(([k, v]) => `--${k}:${v}`).join(";");
  return `
<section class="opt" id="${p.id}">
  <div class="opt-head">
    <p class="kicker">${p.label}</p>
    <h2>${esc(p.name)}</h2>
    <p class="idea">${esc(p.idea)}</p>
    <ul class="stats">
      <li><b>${h.all}</b> hue families<span>${h.loadBearing} of them load bearing</span></li>
      <li><b>${worst.v.toFixed(2)}:1</b> worst measured pair<span>${esc(worst.label)}</span></li>
      <li class="${fails.length ? "bad" : "ok"}"><b>${fails.length}</b> AA failures<span>across ${scored.length} scored pairs</span></li>
    </ul>
    <div class="swatches">${swatches(p.t)}</div>
  </div>
  <div class="frame" style="${vars}">${fragment(p.id)}</div>
  <details class="numbers">
    <summary>All ${rows.length} measured pairs for ${esc(p.name)}</summary>
    ${table(rows)}
  </details>
</section>`;
}).join("\n");

const summary = `<table class="ct sum"><thead><tr><th>Palette</th><th class="num">Hue families</th><th class="num">Worst pair</th><th class="num">Body text on page</th><th class="num">Prose link on page</th><th class="num">Chrome text on bar</th><th class="num">AA failures</th></tr></thead><tbody>
${PALETTES.map((p) => {
  const rows = score(p.t);
  const scored = rows.filter((r) => r.pass !== null);
  const get = (l) => rows.find((r) => r.label === l).v.toFixed(2);
  const fails = scored.filter((r) => !r.pass).length;
  const worst = scored.reduce((a, r) => (r.v < a.v ? r : a)).v.toFixed(2);
  return `<tr><td><a href="#${p.id}">${p.label} &mdash; ${esc(p.name)}</a></td><td class="num">${hues(p.t).all}</td><td class="num">${worst}</td><td class="num">${get("body text on the page ground")}</td><td class="num">${get("prose link on the page")}</td><td class="num">${get("chrome text on the dark bar")}</td><td class="num ${fails ? "bad" : "ok"}">${fails}</td></tr>`;
}).join("\n")}
</tbody></table>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- NOINDEX IS LOAD BEARING AND IS ALSO HOW THE SITE SEARCH SKIPS THIS PAGE.
     build-search.mjs walks public/*.html and fails the build on any top level
     page that is neither listed in its PAGES array nor marked noindex. This
     page is deliberately the second kind. It is not in sitemap.xml either:
     that list is hand written in build-pages.mjs and this file was never
     added to it, which check-build.py then cross checks by failing on any
     noindex page that turns up in the sitemap. -->
<meta name="robots" content="noindex,nofollow">
<title>Palette options &mdash; Garbage Rips 585 working file</title>
<link rel="stylesheet" href="/assets/fonts.css">
<style>
/* ==========================================================================
   SELF CONTAINED ON PURPOSE. This page does not link /assets/ui.css and adds
   nothing to it. Every palette is a scoped token block on .frame and the
   component rules below exist only in this file, so deleting the page leaves
   the shared stylesheet exactly as it was.

   The page shell is a fixed neutral that never changes between options. If
   the chrome around the samples moved too, nothing could be compared.
   ========================================================================== */
:root{
  --sh-bg:#F2F2F0; --sh-panel:#FFFFFF; --sh-ink:#17181A; --sh-dim:#5E6167;
  --sh-line:#D6D6D2; --sh-ok:#0F6B3F; --sh-bad:#A81616;
  --display:'Titan One',system-ui,sans-serif;
  --body:'Outfit',system-ui,sans-serif;
  --mono:'Space Mono',ui-monospace,monospace;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--sh-bg);color:var(--sh-ink);font:400 17px/1.55 var(--body)}
.shell{max-width:1180px;margin:0 auto;padding:0 20px}
.intro{padding:44px 0 8px}
.intro h1{font:400 clamp(1.6rem,4.5vw,2.4rem)/1.1 var(--display);margin-bottom:14px}
.intro p{max-width:60ch;margin-bottom:14px;color:var(--sh-dim)}
.intro p strong{color:var(--sh-ink)}
.intro a{color:#0B5FA5}
.toc{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 8px;position:sticky;top:0;
  background:var(--sh-bg);padding:12px 0;z-index:20;border-bottom:1px solid var(--sh-line)}
.toc a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;
  border:1px solid var(--sh-line);background:var(--sh-panel);border-radius:999px;
  font:700 .8rem/1 var(--body);color:var(--sh-ink);text-decoration:none}
.toc a:hover{border-color:var(--sh-ink)}

.opt{margin:0 0 12px}
.opt-head{padding:40px 0 22px}
.kicker{font:700 .7rem/1 var(--mono);letter-spacing:.16em;color:var(--sh-dim);text-transform:uppercase;margin-bottom:10px}
.opt-head h2{font:400 clamp(1.4rem,4vw,2rem)/1.1 var(--display);margin-bottom:12px}
.idea{max-width:66ch;color:var(--sh-dim);margin-bottom:18px}
.stats{list-style:none;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.stats li{background:var(--sh-panel);border:1px solid var(--sh-line);border-radius:10px;
  padding:10px 14px;min-width:140px}
.stats b{display:block;font:400 1.35rem/1.1 var(--display)}
.stats span{display:block;font:700 .62rem/1.3 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--sh-dim);margin-top:4px}
.stats li.ok b{color:var(--sh-ok)} .stats li.bad b{color:var(--sh-bad)}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
.sw{display:flex;align-items:center;gap:7px;font:400 .62rem/1.2 var(--mono);min-width:0}
.sw-c{width:20px;height:20px;border-radius:4px;border:1px solid var(--sh-line);flex:none}
.sw code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sw .hex{color:var(--sh-dim);margin-left:auto;flex:none}

/* The sample sits in a plain frame so the neutral shell cannot be mistaken
   for part of the design being judged. */
.frame{border:1px solid var(--sh-line);border-radius:14px;overflow:hidden;
  background:var(--page);color:var(--ink);font:400 17px/1.55 var(--body)}
.numbers{margin:16px 0 0;background:var(--sh-panel);border:1px solid var(--sh-line);border-radius:10px}
.numbers summary{padding:14px 16px;cursor:pointer;font:700 .85rem/1 var(--body)}
.ct{width:100%;border-collapse:collapse;font:400 .78rem/1.4 var(--body)}
.numbers .ct{border-top:1px solid var(--sh-line)}
.ct th,.ct td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--sh-line);vertical-align:top}
.ct th{font:700 .66rem/1.2 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--sh-dim)}
.ct .num{text-align:right;font-family:var(--mono);white-space:nowrap}
.ct .sm{font:400 .68rem/1.35 var(--mono);color:var(--sh-dim)}
.ct tr.ok td:nth-child(4){color:var(--sh-ok)}
.ct tr.bad td{background:#FDECEC}
.ct tr.bad td:nth-child(4){color:var(--sh-bad);font-weight:700}
.ct tr.info td:nth-child(4){color:var(--sh-dim)}
.ct td.ok{color:var(--sh-ok);font-weight:700} .ct td.bad{color:var(--sh-bad);font-weight:700}
.sum{background:var(--sh-panel);border:1px solid var(--sh-line);border-radius:10px;margin:10px 0 30px}
.scroller{overflow-x:auto;-webkit-overflow-scrolling:touch}

/* ==========================================================================
   THE FRAGMENT'S OWN COMPONENTS. Class names mirror assets-source/ui.css so
   the sample can be checked against a real page, but every rule here is local
   to this file and every colour goes through a token.
   ========================================================================== */
.frame .wrap{max-width:1180px;margin:0 auto;padding:0 22px}
.frame a{color:inherit;text-decoration:none}
.frame .mono{font:700 .68rem/1.4 var(--mono);letter-spacing:.04em;color:var(--ink-2)}
.frame h1{font:400 clamp(1.5rem,4vw,2.3rem)/1.12 var(--display)}
.frame .h2{font:400 clamp(1.2rem,3.2vw,1.8rem)/1.12 var(--display)}
.frame .hl{color:var(--ketchup-deep);text-shadow:2px 2px 0 var(--mustard)}
.frame .lede{font-size:1.05rem;max-width:44ch;color:var(--ink-soft)}

.bar{background:var(--chrome-bg);color:var(--chrome-ink)}
.bar-in{display:flex;align-items:center;gap:16px;max-width:1180px;margin:0 auto;
  padding:10px 22px;min-height:60px;flex-wrap:wrap}
.brand{display:flex;align-items:baseline;gap:8px;flex:none}
.brand b{font:400 1.05rem/1 var(--display)}
.brand b i{font-style:normal;color:var(--mustard)}
.brand span{font:700 .6875rem/1 var(--mono);letter-spacing:.1em;color:var(--chrome-dim);text-transform:uppercase}
.fakeform{flex:1;display:flex;align-items:center;gap:8px;min-width:180px;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
  border-radius:999px;padding:0 16px;height:42px;max-width:420px;margin:0 auto}
.fakeform svg{width:15px;height:15px;fill:var(--chrome-dim);flex:none}
.fakeform .ph{font:400 .85rem/1 var(--body);color:var(--chrome-dim);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.sub{flex:none;background:var(--mustard);color:var(--on-accent);font:700 .875rem/1 var(--body);
  padding:0 16px;height:42px;display:inline-flex;align-items:center;border-radius:999px}
.navrow{background:var(--chrome-bg);border-top:1px solid rgba(255,255,255,.12)}
.nav{display:flex;gap:4px;max-width:1180px;margin:0 auto;padding:6px 22px;flex-wrap:wrap}
.nav a{padding:8px 12px;border-radius:999px;font:700 .8rem/1 var(--body);color:var(--chrome-ink)}
.nav a[aria-current=page]{background:var(--mustard);color:var(--on-accent)}

.hof{background:var(--chrome-bg);color:var(--chrome-ink);padding:26px 0 34px}
.hof-head{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.hof-head h2{font:400 clamp(1.3rem,3.5vw,1.9rem)/1 var(--display);color:var(--mustard)}
.hof-head a{margin-left:auto;font:700 .875rem/1 var(--body);color:var(--mustard);text-decoration:underline}
.hof-card{display:grid;grid-template-columns:minmax(150px,210px) 1fr;gap:24px;align-items:start}
.hof-art{position:relative;aspect-ratio:2/3;border:4px solid var(--mustard);border-radius:12px;
  overflow:hidden;background:var(--navy-deep)}
.rank{position:absolute;left:8px;top:8px;z-index:4;width:34px;height:34px;border-radius:50%;
  display:grid;place-items:center;font:400 1rem/1 var(--display);color:var(--on-accent);
  background:linear-gradient(180deg,var(--mustard),var(--gold));border:2px solid var(--keyline)}
.hof-txt b{display:block;font:600 1.15rem/1.25 var(--body);margin-bottom:8px}
.hof-txt .mono{color:var(--chrome-dim);margin-bottom:10px}
.hof-lede{color:var(--foot-ink);max-width:52ch;margin-bottom:14px;font-size:.95rem}
.hof-badges{display:flex;gap:8px;flex-wrap:wrap}
.badge{display:inline-flex;align-items:center;height:28px;padding:0 12px;border-radius:999px;
  font:700 .66rem/1 var(--mono);letter-spacing:.08em;background:var(--mustard);color:var(--on-accent)}
.badge.b2{background:transparent;color:var(--mustard);border:1px solid var(--mustard)}
.rail{background:var(--page);border-bottom:1px solid var(--hair);padding:12px 0}
.chiprow{display:flex;gap:8px;flex-wrap:wrap}
/* flex:none and nowrap are not tidying. Without them the chips are flex items
   that shrink below their own text, the label wraps to two lines inside a
   999px radius and every chip renders as a circle. */
.chip{display:inline-flex;align-items:center;min-height:34px;padding:0 13px;flex:none;
  white-space:nowrap;background:var(--card);border:1px solid var(--hair);border-radius:999px;
  font:600 .8rem/1 var(--body);color:var(--ink)}
.chip[aria-current]{background:var(--chrome-bg);color:var(--chrome-ink);border-color:var(--chrome-ink)}
.chip.gold{background:var(--chip-gold-bg);border-color:var(--gold);color:var(--gold-deep);font-weight:700}
.chip.guide{background:var(--gold);border-color:var(--keyline);color:var(--on-accent);font-weight:700}
.chip.soon{background:var(--ketchup-deep);border-color:var(--ketchup-deep);color:var(--on-alert);font-weight:700}
.chip.clearish{background:var(--ketchup-deep);border-color:var(--ketchup-deep);color:var(--on-alert)}

.mwband{background:var(--card);border-bottom:1px solid var(--hair);padding:26px 0 32px}
.sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;
  flex-wrap:wrap;margin-bottom:20px}
.sub2{display:block;font:700 .6875rem/1 var(--mono);letter-spacing:.09em;color:var(--ink-2);
  text-transform:uppercase;margin-bottom:8px}
.more-link{font:700 .875rem/1 var(--body);color:var(--ketchup-deep);text-decoration:underline}
.mwgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.mw{display:flex;flex-direction:column;gap:6px;min-width:0}
.mw-art{aspect-ratio:245/342;border-radius:8px;border:1px solid var(--hair);
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
.mw b{font:600 .9rem/1.25 var(--body);color:var(--ink)}
.mw .price{font:400 1.05rem/1 var(--display);color:var(--ketchup-deep)}

.ripband{padding:30px 0 36px}
.sec-label{display:flex;align-items:center;gap:8px;font:700 .75rem/1 var(--mono);
  letter-spacing:.16em;text-transform:uppercase;color:var(--sky-deep);margin-bottom:10px}
.flower{width:13px;height:13px;fill:var(--ketchup);flex:none}
.vid-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.vid{display:flex;flex-direction:column;gap:8px;min-width:0}
.vid-shell{position:relative;display:block;aspect-ratio:2/3;border:3px solid var(--gold);
  border-radius:12px;overflow:hidden;background:var(--navy-deep);
  box-shadow:0 6px 0 var(--trubbish)}
.vid-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;
  width:44px;height:44px;border-radius:50%;display:grid;place-items:center;
  background:var(--ketchup);border:2px solid var(--keyline)}
.vid-play svg{width:18px;height:18px;fill:var(--paper-2);margin-left:2px}
.vid-title{font:600 .88rem/1.32 var(--body);color:var(--ink)}
.vid-meta{font:400 .66rem/1.3 var(--mono);color:var(--ink-soft);letter-spacing:.04em}
.more{margin-top:20px}
.more a{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;
  font:700 1rem/1 var(--body);background:var(--card);border:2px solid var(--ink);
  border-radius:999px;color:var(--ink)}

.band{background:var(--sky-tint);border-top:3px solid var(--sky);border-bottom:3px solid var(--sky);
  padding:32px 0 36px}
.btn-row{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0 22px}
.btn{display:inline-flex;align-items:center;min-height:46px;padding:0 22px;border-radius:999px;
  font:700 1rem/1 var(--body);border:2px solid var(--keyline)}
.btn-yt{background:linear-gradient(180deg,var(--mustard),var(--gold));color:var(--on-accent);
  box-shadow:4px 4px 0 var(--keyline)}
.btn-sky{background:var(--sky);color:var(--on-accent);box-shadow:4px 4px 0 var(--keyline)}
.btn-ghost{background:var(--paper-2);color:var(--ink);box-shadow:4px 4px 0 var(--trubbish)}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:620px}
.fact{display:block;background:var(--paper-2);border:3px solid var(--keyline);border-radius:12px;
  padding:14px 12px;text-align:center;box-shadow:0 5px 0 var(--trubbish)}
.fact .n{display:block;font:400 clamp(1.3rem,5vw,1.9rem)/1.05 var(--display);color:var(--ketchup-deep)}
.fact .l{display:block;font:700 .62rem/1.3 var(--mono);letter-spacing:.08em;color:var(--ink-soft);margin-top:5px}

/* NAMED .guidepg, NOT .guide. ui.css already has a .chip.guide modifier, and
   a section wrapper called .guide matched those chips too: they picked up the
   section's padding:34px 0 40px, blew out to 88px tall and, at border-radius
   999px, rendered as circles. The sibling chips stretched to match. */
.guidepg{background:var(--paper);padding:34px 0 40px}
.crumbs{font:700 .72rem/1 var(--mono);color:var(--ink-soft);margin-bottom:16px}
.crumbs a{color:var(--sky-deep);text-decoration:underline;text-underline-offset:2px}
.guidepg h1{margin-bottom:12px}
.guidepg h1 .rip{color:var(--ketchup-deep);text-shadow:5px 5px 0 var(--keyline)}
.guidepg .lede{margin-bottom:16px}
.guidepg p{max-width:66ch;margin-bottom:18px}
.guidepg p a{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;
  color:var(--ketchup-deep)}
.rarities{display:grid;gap:8px;max-width:620px;margin-bottom:22px}
.rar{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center}
.rar-name{font:600 .9rem/1.2 var(--body)}
.rar-n{font:700 .8rem/1.2 var(--mono);color:var(--ketchup-deep)}
.rar-bar{grid-column:1/-1;height:11px;border-radius:999px;background:var(--paper-3);overflow:hidden}
.rar-bar i{display:block;height:100%;background:var(--sky)}
.rar.chase .rar-bar i{background:linear-gradient(90deg,var(--mustard),var(--gold))}
.rar.chase .rar-name{color:var(--gold-deep);font-weight:700}
.chases{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:620px;margin-bottom:20px}
.chase-card{display:flex;flex-direction:column;gap:3px;background:var(--paper-2);
  border:3px solid var(--keyline);border-radius:12px;padding:12px;box-shadow:0 5px 0 var(--trubbish)}
.cc-art{aspect-ratio:245/342;border-radius:6px;
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px);margin-bottom:6px}
.chase-card b{font:600 .85rem/1.2 var(--body)}
.chase-card .rr{font:400 .6rem/1.2 var(--mono);color:var(--ink-soft);letter-spacing:.06em}
.chase-card .pr{font:400 1.1rem/1 var(--display);color:var(--ketchup-deep);margin-top:2px}
.note{background:var(--paper-2);border:3px dashed var(--trubbish);border-radius:12px;
  padding:16px 18px;font-size:.92rem;color:var(--ink-soft);max-width:66ch}
.guidepg .chiprow{margin:18px 0}
.warn{font:700 .6875rem/1.7 var(--mono);color:var(--plum);background:var(--lilac-pale);
  border-radius:8px;padding:12px 14px;max-width:66ch}

.foot{background:var(--chrome-bg);color:var(--foot-ink);padding:34px 0 30px;text-align:center}
.foot-tag{font:400 clamp(1.2rem,3.2vw,1.7rem)/1 var(--display);color:var(--mustard);margin-bottom:14px}
.foot-nav{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
.foot-nav a{font:700 .875rem/1 var(--body);color:var(--foot-ink)}
.fine{font:700 .6875rem/1.7 var(--mono);color:var(--foot-ink);letter-spacing:.03em}

/* The pack faces. These tokens are NOT part of any palette: the wrappers are
   real products and stay exactly as colourful under every option, which is
   most of the case for the restrained ones. */
.pk{position:absolute;inset:0;display:block;overflow:hidden}
.hof-art .pk,.vid-shell .pk{position:absolute;inset:0}
.pk-art{position:absolute;inset:0;
  background:radial-gradient(120% 70% at 50% 12%,rgba(255,255,255,.22),transparent 60%),
    linear-gradient(160deg,var(--pk-a) 0%,var(--pk-b) 38%,var(--pk-c) 72%,var(--pk-d) 100%)}
.pk-art::after{content:"";position:absolute;inset:0;
  background:linear-gradient(115deg,transparent 26%,rgba(125,249,233,.32) 40%,rgba(249,139,217,.32) 50%,rgba(255,232,107,.32) 60%,transparent 74%);
  mix-blend-mode:screen;opacity:.75}
.pk-art::before{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 4px,transparent 4px 9px) top/100% 20px no-repeat,
    repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 4px,transparent 4px 9px) bottom/100% 20px no-repeat}
.pk-brand{position:absolute;left:0;right:0;bottom:14%;text-align:center;padding:0 8%;
  font:400 clamp(.7rem,2.2vw,1.3rem)/1.05 var(--display);color:var(--pk-ink);
  text-shadow:3px 3px 0 var(--pk-edge),-1px -1px 0 var(--pk-edge);transform:rotate(-3deg)}
.pk-brand small{display:block;color:#fff;opacity:.86;font-size:.5em;margin-top:.5em;
  font-family:var(--mono);letter-spacing:.16em;text-shadow:2px 2px 0 var(--pk-edge)}

@media(max-width:860px){
  .mwgrid{grid-template-columns:repeat(2,1fr)}
  .vid-grid{grid-template-columns:repeat(2,1fr)}
  .chases{grid-template-columns:repeat(2,1fr)}
  .hof-card{grid-template-columns:1fr;gap:16px}
  .hof-art{max-width:230px}
}
@media(max-width:560px){
  .facts{grid-template-columns:1fr}
  .bar-in{gap:10px}
  .fakeform{order:3;flex-basis:100%;max-width:none;margin:0}
  .frame .wrap{padding:0 14px}
}
</style>
</head>
<body>
<div class="shell">
  <div class="intro">
    <h1>Palette options</h1>
    <p><strong>This is a working file, not a page of the site.</strong> It is marked
      <code>noindex</code>, it is not in <code>sitemap.xml</code> and it is not in the
      site search. Nothing here changes the live palette: every option below is a scoped
      copy of the token block, and <code>assets-source/ui.css</code> is untouched.</p>
    <p>The same homepage-and-guide fragment is rendered five times, starting with what
      the site wears today so there is a baseline to compare against. Scroll, or jump
      with the buttons. Every contrast figure on this page is computed from the actual
      token values against the WCAG 2.1 formula, and the floor is set per role: 4.5:1
      for body-size text, 3:1 for large text and for non-text UI.</p>
    <p>Nothing is decided. Pick one, pick bits of several, or say none of them.</p>
  </div>
  <nav class="toc">${PALETTES.map((p) => `<a href="#${p.id}">${p.label} &middot; ${esc(p.name)}</a>`).join("")}</nav>
  <div class="scroller">${summary}</div>
</div>
<div class="shell">
${sections}
</div>
</body>
</html>
`;

await writeFile(join(ROOT, "public/palette-preview.html"), html);
console.log("Wrote public/palette-preview.html");
console.log(`  ${PALETTES.length} palettes, ${PAIRS.length} measured pairs each`);
for (const p of PALETTES) {
  const rows = score(p.t).filter((r) => r.pass !== null);
  const fails = rows.filter((r) => !r.pass);
  const worst = rows.reduce((a, r) => (r.v < a.v ? r : a));
  console.log(
    `  ${p.label.padEnd(9)} ${p.name.padEnd(22)} ${hues(p.t).all} hues, ` +
      `worst ${worst.v.toFixed(2)}:1 (${worst.label}), ${fails.length} AA failures`
  );
}
