/**
 * Writes assets-source/fun-palette-preview.html: five candidate palettes, each
 * rendering the SAME set of real site components, each rendered TWICE, once in
 * a 390px frame and once in a 1440px frame.
 *
 * WHY THIS EXISTS. Tim, 18 August 2026: "still not loving the overall site
 * colour scheme ... maybe we try a rainbow version with lots of colours? lets
 * moc up a few other versions to to check out before changing anything".
 * The operative words are the last four. NOTHING HERE SHIPS.
 *
 * IT IS A SECOND FILE RATHER THAN AN EDIT TO gen-palette-preview.mjs, and that
 * is deliberate. That file is the DECISION RECORD for the palette the site is
 * wearing: assets-source/ui.css names its `Option C` entry as the thing its
 * :root block must not drift from, so editing it to hold a different set of
 * candidates would break the one cross-check that keeps the live site and its
 * decision aid in step. This file records a NEW question and cites the old one.
 *
 * EVERYTHING gen-palette-preview.mjs SAYS ABOUT NOT SHIPPING APPLIES HERE AND
 * FOR THE SAME REASONS. Three guards, all belt and braces on top of the fourth:
 *   1. It writes OUTSIDE public/. pages.yml uploads the whole of public/ on
 *      every push, so a working file under it is a published file the moment
 *      LIVE flips in shared/site.mjs. assets-source/ is the documented home
 *      for input the site is built from but does not ship.
 *   2. It is `noindex,nofollow`, which is also how build-search.mjs decides a
 *      top level page needs no PAGES entry.
 *   3. sitemap.xml is a hand written list in build-pages.mjs. This file was
 *      never added to it, and check-build.py fails on any noindex page that
 *      turns up in the sitemap, so the two cannot silently disagree.
 * The site launches on Friday 21 August 2026. A stray mockup in the index is a
 * real cost that week, which is why all four hold rather than just the last.
 *
 * DELIBERATELY NOT NAMED build-*.mjs OR stamp-*.mjs. check-build.py fails the
 * build on any scripts/build-* or scripts/stamp-* file that build-all.mjs does
 * not run, and this must never be in the nightly: it is a decision aid with a
 * short life. Run it by hand:
 *
 *     node scripts/gen-fun-palettes.mjs
 *
 * NOTHING HERE TOUCHES assets-source/ui.css. Every palette is a scoped token
 * block on a wrapper element and every component rule lives in this file.
 * Deleting this script and its output leaves no trace in the stylesheet.
 *
 * THE COLOUR NAMES IN THIS REPO LIE AND THIS FILE READS VALUES INSTEAD.
 * `--ketchup` and `--navy` are BOTH #111111 since the 16 August repaint, so a
 * rule written as `fill:var(--ketchup)` draws black. The `cur` palette below is
 * a hand transcription of what assets-source/ui.css resolves to TODAY, not of
 * what any token is called. checkCurrent() at the foot of this file re-reads
 * that :root block on every run and throws if the two have drifted, so the
 * "current" column cannot quietly stop being current.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* The fonts are inlined with their urls rewritten relative to the output, for
   the reason gen-palette-preview.mjs gives at length: this file lives outside
   public/, so an absolute /assets/ url resolves against nothing and the page
   silently renders in a fallback font. On a page whose whole job is judging
   how type and colour sit together, that is the worst possible failure. */
const fontCss = (await readFile(join(ROOT, "public/assets/fonts.css"), "utf8"))
  .replace(/url\(\/assets\//g, "url(../public/assets/");

/* ==========================================================================
   MEASUREMENT. WCAG 2.1 relative luminance, same maths as
   scripts/gen-palette-preview.mjs. Every ratio printed on the output page is
   computed from the token values below. None is asserted by hand.
   ========================================================================== */
const hex2rgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const rgb2hex = (a) =>
  "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0").toUpperCase()).join("");
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
  return rgb2hex([mix(r, gr), mix(g, gg), mix(b, gb)]);
}

/* THE TWO DERIVATIONS THAT MAKE THE RAINBOW OPTION POSSIBLE AT ALL.

   The eleven canonical type colours span a huge luminance range: Lightning
   #E0A21F sits at 0.42 relative luminance and Darkness #39394A at 0.045. No
   single rule ("type colour = text" or "type colour = fill") can hold across
   that spread, which is precisely why a rainbow palette normally fails. So
   each type colour is used at TWO derived values and never raw as text:

     onFill(fill)     near-black or white, whichever measures further from the
                      fill, asserted at 4.5:1. This is the label on a rank
                      badge or a chip whose background is the type colour.
     textOn(c, bg)    the type colour walked toward black one step at a time
                      until it clears 4.5:1 on the ground it will sit on. This
                      is the section kicker, the only TEXT that takes a type
                      hue. Lightning yellow becomes a dark ochre, which still
                      reads as "the electric section" beside a yellow chip.

   Both are computed here rather than eyeballed, so the option cannot ship a
   swatch nobody measured. */
/* labelFill IS THE ONE THAT ACTUALLY UNLOCKED THE RAINBOW, and the first
   version of this file got it wrong in an instructive way. It originally just
   picked black or white, whichever measured further from the raw type colour,
   and asserted 4.5:1. TWO OF THE ELEVEN CANNOT SATISFY THAT AT ALL: Fire
   #D9482B tops out at 4.42:1 against white and Water #2E7FB8 at 4.36:1. They
   are mid-luminance colours, so BOTH black and white are too close, and no
   choice of label rescues them. A rainbow scheme that puts a label on a raw
   Fire chip is failing AA and cannot be fixed by picking the other label.

   So the FILL moves instead of the label. Each type colour is walked in both
   directions, darker until white clears the floor and lighter until near-black
   does, and whichever lands CLOSER to the original colour wins. Lightning
   stays a recognisable yellow with black on it; Fire becomes a slightly deeper
   red with white on it. The hue survives, the label passes, and the number is
   computed rather than chosen. */
function labelFill(c, target = 4.5) {
  const dist = (a, b) => {
    const A = hex2rgb(a), B = hex2rgb(b);
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  };
  let d = hex2rgb(c);
  for (let i = 0; i < 200 && ratio(rgb2hex(d), "#FFFFFF") < target; i++) d = d.map((v) => v * 0.97);
  let l = hex2rgb(c);
  for (let i = 0; i < 200 && ratio(rgb2hex(l), "#111111") < target; i++) l = l.map((v) => Math.min(255, v * 1.03 + 2));
  const dh = rgb2hex(d), lh = rgb2hex(l);
  const okD = ratio(dh, "#FFFFFF") >= target, okL = ratio(lh, "#111111") >= target;
  if (okD && (!okL || dist(dh, c) <= dist(lh, c))) return { fill: dh, on: "#FFFFFF" };
  if (okL) return { fill: lh, on: "#111111" };
  return { fill: dh, on: "#FFFFFF" };
}
function textOn(c, bg, target = 4.5) {
  let rgb = hex2rgb(c);
  for (let i = 0; i <= 100; i++) {
    const hex = rgb2hex(rgb);
    if (ratio(hex, bg) >= target) return hex;
    rgb = rgb.map((v) => v * 0.96);
  }
  return "#000000";
}

/* ==========================================================================
   THE ELEVEN TYPE COLOURS, AND WHY IT IS ELEVEN AND NOT EIGHTEEN.

   The brief for this mockup asked for "the 18 official Pokemon TYPE colors".
   Eighteen is the VIDEO GAME's type chart. The TRADING CARD GAME, which is the
   entire subject of this site, has ELEVEN energy types, and this repo already
   holds all eleven with hexes: scripts/build-types.mjs lines 123-133 defines
   them beside their energy symbols and /types.html renders them.

   So the rainbow option uses the site's OWN eleven rather than importing a
   second, conflicting set of colours from a different game. They are copied
   here by value, not imported, because this file must not make build-types.mjs
   a dependency of a throwaway decision aid; checkTypes() below re-reads that
   file on every run and throws if any hex has moved.
   ========================================================================== */
const TYPES = [
  ["Grass", "grass", "#4C8B3F"],
  ["Fire", "fire", "#D9482B"],
  ["Water", "water", "#2E7FB8"],
  ["Lightning", "lightning", "#E0A21F"],
  ["Psychic", "psychic", "#8A5BA6"],
  ["Fighting", "fighting", "#B0552A"],
  ["Darkness", "darkness", "#39394A"],
  ["Metal", "metal", "#7E8C99"],
  ["Colorless", "colorless", "#B9B08A"],
  ["Dragon", "dragon", "#A98B2E"],
  ["Fairy", "fairy", "#C86A9A"],
];

/* ==========================================================================
   SUBSCRIBE IS NOT A PALETTE CHOICE AND DOES NOT VARY.

   assets-source/ui.css fences these three tokens off from the palette in a
   long comment: YouTube is the site's primary channel and its own button is
   allowed to look like itself. Tim asked for it by name on 18 August 2026.
   The value is #EE0000 rather than YouTube's #FF0000 because white on #FF0000
   measures 4.00:1 and FAILS AA for the 15px label, which cannot grow: at 390px
   the bar is 366px wide and a large-text label does not fit beside the
   wordmark. #EE0000 is the lightest red that clears 4.5.

   So it is a constant here, spliced into all five palettes, and the pairs
   table scores it under every one of them. What DOES vary is whether the red
   pill is still findable against that palette's own bar, which is a 3:1
   requirement under WCAG 1.4.11 and is the one place a fun palette can break
   Subscribe without touching Subscribe. See the Yellow Border note.
   ========================================================================== */
const YT = { "yt-red": "#EE0000", "yt-red-deep": "#C00000", "on-yt": "#FFFFFF" };

/* ==========================================================================
   THE FIVE CANDIDATES.

   `t` is the token block. `accents` is the per-section accent rotation and is
   the mechanism the rainbow option turns on: the fragment renders four bands
   and each band takes the next accent in the list. A palette with one accent
   repeats it and looks unchanged band to band, which is exactly the
   comparison being made.
   ========================================================================== */
const solid = (name, fill, deep) => [{ name, fill, deep }];

const PALETTES = [
  {
    id: "cur",
    label: "Today",
    name: "Black / White / Gold",
    pitch:
      "What the site wears right now, unchanged, so there is something to compare against.",
    idea:
      "One accent hue, no tinted bands, everything else a value of grey, so the pack art and the card scans are the only colour on a page. Chosen 16 August 2026 and transcribed here from what ui.css resolves to today.",
    argument:
      "It is the safest option on this page and the least characterful. Every number it posts is comfortable and nothing on it is memorable. The honest description is that it looks like a well built reference site, which is what it was designed to be before the channel's voice was the thing being sold.",
    accents: solid("Gold", "#C99700", "#6E5000"),
    t: {
      ink: "#111111", "ink-2": "#5B5B5B", "ink-soft": "#5B5B5B",
      page: "#FAFAF8", card: "#FFFFFF",
      paper: "#F4F3EF", "paper-2": "#FFFFFF", "paper-3": "#E6E4DD",
      hair: "rgba(17,17,17,.18)",
      "navy-deep": "#000000",
      keyline: "#111111", "chrome-bg": "#111111", "on-accent": "#111111", "on-alert": "#FFFFFF",
      "chrome-ink": "#F5F4F0", "chrome-dim": "#A6A6A6", "foot-ink": "#BDBDBD",
      mustard: "#E8B93A", gold: "#C99700", "gold-deep": "#6E5000", "chip-gold-bg": "#F5E7BD",
      "brand-accent": "#E8B93A",
      ketchup: "#111111", "ketchup-deep": "#6E5000",
      sky: "#D9D6CC", "sky-deep": "#5B5B5B", "sky-tint": "#F1EFE8",
      trubbish: "#8A8A8A", plum: "#3A3A3A", "lilac-pale": "#F2F1EC",
    },
  },

  {
    id: "wheel",
    label: "Option 1",
    name: "Energy Wheel",
    pitch:
      "The rainbow, solved: eleven canonical energy-type colours, ONE per section, carried on chips and edges and never behind body text.",
    idea:
      "The colour rotates by SECTION rather than by element. Each band takes one energy type and holds it for the whole band, so the page runs Grass, Fire, Water, Lightning, Psychic as you scroll and only one hue is ever in view. The chrome, the paper and every line of body copy stay exactly as they are today, which is why this measures like the mono palette rather than like a rainbow.",
    argument:
      "This is the one Tim asked for by name and it is the only version of it that survives contact with a contrast checker. Eighteen or eleven colours all doing something at once is confetti; eleven colours taking it in turns is a system, and it is one the audience already reads fluently because it is printed on the corner of every card they own.",
    accents: TYPES.slice(0, 5).map(([name, , fill]) => ({ name, fill })),
    wheel: true,
    t: {
      ink: "#14161A", "ink-2": "#565C66", "ink-soft": "#565C66",
      page: "#FBFAF7", card: "#FFFFFF",
      paper: "#F5F3EE", "paper-2": "#FFFFFF", "paper-3": "#E7E4DC",
      hair: "rgba(20,22,26,.18)",
      "navy-deep": "#000000",
      keyline: "#14161A", "chrome-bg": "#14161A", "on-accent": "#14161A", "on-alert": "#FFFFFF",
      "chrome-ink": "#F6F5F1", "chrome-dim": "#A8ACB3", "foot-ink": "#BFC3C9",
      mustard: "#E8B93A", gold: "#C99700", "gold-deep": "#6E5000", "chip-gold-bg": "#F5E7BD",
      "brand-accent": "#E8B93A",
      ketchup: "#14161A", "ketchup-deep": "#B03A1E",
      sky: "#BFD9E8", "sky-deep": "#1F6B96", "sky-tint": "#EEF5F9",
      trubbish: "#8A8A8A", plum: "#3A3A3A", "lilac-pale": "#F2F1EC",
    },
  },

  {
    id: "pop",
    label: "Option 2",
    name: "Slushie",
    pitch:
      "Bright and loud without being a rainbow: indigo chrome, a yellow CTA, magenta for anything you can click, cyan for the second choice.",
    idea:
      "A sports card wrapper or a toy box, where three or four colours are turned all the way up and each one has exactly one job. Deep indigo chrome so the bar reads as a wrapper rather than as a browser toolbar, a yellow primary that survives being next to YouTube red, magenta prices and links, cyan for secondary actions.",
    argument:
      "It is the only candidate that reads as loud from a thumbnail, which matters more than it sounds: most people arrive from a Short and the first thing they see is 60px of header. It is also the furthest from Tim's stated taste, so it is the one most likely to be a hard no, and that is useful information on a page like this.",
    accents: solid("Magenta", "#D6006E"),
    t: {
      ink: "#161226", "ink-2": "#544D6B", "ink-soft": "#544D6B",
      page: "#FFFCF7", card: "#FFFFFF",
      paper: "#F6F2FB", "paper-2": "#FFFFFF", "paper-3": "#E5DEF2",
      hair: "rgba(22,18,38,.18)",
      "navy-deep": "#120C2E",
      keyline: "#161226", "chrome-bg": "#2B1B5A", "on-accent": "#161226", "on-alert": "#FFFFFF",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#BFB4E8", "foot-ink": "#CFC6EE",
      mustard: "#FFD23F", gold: "#FFB000", "gold-deep": "#7A4E00", "chip-gold-bg": "#FFEFB8",
      "brand-accent": "#FFD23F",
      ketchup: "#D6006E", "ketchup-deep": "#C1005F",
      sky: "#35D0E8", "sky-deep": "#0A6A7C", "sky-tint": "#E4F9FC",
      trubbish: "#8A7FB5", plum: "#4A1D5E", "lilac-pale": "#F7ECFB",
    },
  },

  {
    id: "border",
    label: "Option 3",
    name: "Yellow Border",
    pitch:
      "The site dressed as the object it is about: the chrome is the yellow border of a real card, with black type on it.",
    idea:
      "Every Pokemon card ever printed has the same yellow frame, and nothing else in the world looks like it. Putting it in the header and the footer makes the whole page read as a card at a glance, before a single word is read. Inside the frame it is warm white card stock, near-black type, HP red for links and prices, and a pale holo blue for secondary actions.",
    argument:
      "The strongest identity on the page by a distance, and the one with a real cost attached: a yellow bar puts every other bright thing in the header into competition, and Subscribe is the thing that loses. See the measured note under this option.",
    argument2:
      "MEASURED PROBLEM AND ITS FIX. YouTube red #EE0000 against the card yellow #F2C900 is 2.83:1, under the 3:1 that WCAG 1.4.11 asks of a control's own boundary, so the Subscribe pill stops being findable even though its white label is still a comfortable 4.53:1. Subscribe cannot change colour, so the FIX IS A KEYLINE: a 2px near-black border round the pill, which measures 11.41:1 against the yellow and bounds the control properly, and that is the figure the table below scores rather than the fill. It also happens to be what a card does. This is the only candidate that needs a structural change rather than a colour change, and it is written down here rather than discovered after launch.",
    accents: solid("Card yellow", "#F2C900"),
    ytKeyline: true,
    t: {
      ink: "#191505", "ink-2": "#57502E", "ink-soft": "#57502E",
      page: "#FFFDF5", card: "#FFFFFF",
      paper: "#FBF6E4", "paper-2": "#FFFFFF", "paper-3": "#EDE3C4",
      hair: "rgba(25,21,5,.20)",
      "navy-deep": "#2A2205",
      keyline: "#191505", "chrome-bg": "#F2C900", "on-accent": "#191505", "on-alert": "#FFFFFF",
      "chrome-ink": "#191505", "chrome-dim": "#4A3F05", "foot-ink": "#2A2405",
      mustard: "#FFDE3D", gold: "#F2C900", "gold-deep": "#6B5300", "chip-gold-bg": "#FFF3C2",
      /* NOT the yellow. The chrome IS the yellow here, so the wordmark accent
         has to leave the hue entirely. This is the card's own HP red. */
      "brand-accent": "#B3261E",
      ketchup: "#B3261E", "ketchup-deep": "#A32019",
      sky: "#A9DCEF", "sky-deep": "#00637F", "sky-tint": "#E8F6FB",
      trubbish: "#9A8F62", plum: "#4A2A05", "lilac-pale": "#FBF1DA",
    },
  },

  {
    id: "dark",
    label: "Option 4",
    name: "Lights Out",
    pitch:
      "My pick. A dark site, because the card scans are the content and a dark ground is the only one that lets them glow.",
    idea:
      "Near-black page, warm light type, gold as the single bright accent and a mint secondary. Every card scan, pack wrapper and set logo on the site is a bright rectangle photographed on white, and on a white page they sit flat. On this ground they light up without a single pixel of them changing.",
    argument:
      "The argument is about where readers come FROM. Most arrive from a Short, which means they were just inside YouTube's dark UI on a phone, and the current site hits them with a full screen of near-white. It is also the palette that costs the content nothing: the whole point of the mono option was that the art should be the only colour on the page, and a dark ground delivers that better than a light one does, because contrast against the art is what makes it read as art rather than as decoration. Subscribe red also sits far better on near-black (4.40:1 boundary) than on any bright ground on this page.",
    accents: solid("Gold", "#F5C542"),
    dark: true,
    t: {
      ink: "#F2F3F5", "ink-2": "#A8AFBB", "ink-soft": "#B2B9C4",
      page: "#0E0F12", card: "#171A20",
      paper: "#14171C", "paper-2": "#171A20", "paper-3": "#232832",
      hair: "rgba(242,243,245,.16)",
      "navy-deep": "#000000",
      keyline: "#5A6272", "chrome-bg": "#08090B", "on-accent": "#131519", "on-alert": "#131519",
      "chrome-ink": "#F2F3F5", "chrome-dim": "#9BA2AE", "foot-ink": "#B0B7C2",
      mustard: "#F5C542", gold: "#E0A21F", "gold-deep": "#FFD86B", "chip-gold-bg": "#3A2E10",
      "brand-accent": "#F5C542",
      ketchup: "#FF8F6B", "ketchup-deep": "#FF9E7A",
      sky: "#5EE0C0", "sky-deep": "#5EE0C0", "sky-tint": "#14211F",
      trubbish: "#3A414E", plum: "#E7CDEF", "lilac-pale": "#241B2A",
    },
  },
];

/* ==========================================================================
   THE PAIRS. Every row is a component the fragment actually renders, so
   nothing is scored that Tim cannot see on the page beside the number.

   `min` is the AA floor for that ROLE and not one blanket figure: 4.5 for body
   size text (1.4.3), 3.0 for large text and for non-text UI boundaries
   (1.4.11). Anything scored null is measured, printed and not judged, which is
   reserved for genuinely decorative things.
   ========================================================================== */
const PAIRS = [
  ["Body copy on the page", "ink", "page", 4.5, "running text"],
  ["Body copy on a card", "ink", "card", 4.5, "rip card, ranked row"],
  ["Heading on the page (large)", "ink", "page", 3.0, "h1 and h2"],
  ["Link in running text", "ketchup-deep", "page", 4.5, "prose link"],
  ["Secondary meta on a card", "ink-2", "card", 4.5, "row meta, tile label"],
  ["Video card meta on the page", "ink-soft", "page", 4.5, "rip card date line"],
  ["Wordmark accent on the bar (large)", "brand-accent", "chrome-bg", 3.0, "the word RIPS"],
  ["Footer wordmark on the chrome (large)", "brand-accent", "chrome-bg", 3.0, "GARBAGE RIPS 585"],
  ["Bar text on the bar", "chrome-ink", "chrome-bg", 4.5, "Menu, magnifier"],
  ["Bar sub-label on the bar", "chrome-dim", "chrome-bg", 4.5, "ROCHESTER, NY"],
  ["Nav link in the open menu", "chrome-ink", "chrome-bg", 4.5, "accordion links"],
  ["Accordion group heading", "chrome-dim", "chrome-bg", 4.5, "THE CHANNEL"],
  ["Subscribe label on the pill", "on-yt", "yt-red", 4.5, "fixed, all palettes"],
  ["Subscribe pill against the bar", "yt-red", "chrome-bg", 3.0, "control boundary"],
  ["Stat tile numeral (large)", "ink", "card", 3.0, "$18,750"],
  ["Stat tile label", "ink-2", "card", 4.5, "HIGHEST SEALED PRICE"],
  ["Ranked row rank numeral", "ink-2", "card", 4.5, "the 1, the 2"],
  ["Ranked row product name", "ink", "card", 4.5, "Legendary Treasures"],
  ["Ranked row price", "ink", "card", 4.5, "$18,750.00"],
  ["Ranked row low line", "ink-2", "card", 4.5, "low $16,000.00"],
  ["CTA label, light end of fill", "on-accent", "mustard", 4.5, "gold CTA button"],
  ["CTA label, dark end of fill", "on-accent", "gold", 4.5, "gold CTA button"],
  ["Secondary button label", "on-accent", "sky", 4.5, "second button"],
  ["Footer body on the chrome", "foot-ink", "chrome-bg", 4.5, "footer nav"],
  ["Footer fan-content line", "foot-ink", "chrome-bg", 4.5, "the required line"],
  ["Keyline against the page", "keyline", "page", 3.0, "card borders"],
  ["Hairline on a card", "hair", "card", null, "decorative divider"],
];

/* THE ONE PALETTE-AWARE ROW. WCAG 1.4.11 asks 3:1 of the BOUNDARY of a
   control, and on Yellow Border the pill's boundary stops being its own fill
   and becomes the keyline drawn round it, because the red is only 2.83:1
   against a yellow bar. So for that palette the fill figure is still measured
   and printed but is no longer the thing being judged, and the keyline is
   scored in its place. Scoring the fill there would report a failure that the
   rendered component does not actually have; deleting the row would hide a
   number Tim should see. Both are printed. */
function score(p) {
  const tok = { ...p.t, ...YT };
  const pairs = PAIRS.flatMap((row) => {
    if (row[0] === "Subscribe pill against the bar" && p.ytKeyline) {
      return [
        [row[0], row[1], row[2], null, "measured, but the keyline is the boundary"],
        ["Subscribe keyline against the bar", "keyline", "chrome-bg", 3.0, "the 2px border round the pill"],
      ];
    }
    return [row];
  });
  return pairs.map(([label, fg, bg, min, where]) => {
    const b = tok[bg];
    const f = tok[fg].startsWith("rgba") ? flat(tok[fg], b) : tok[fg];
    const v = r2(f, b);
    return { label, where, f, b, min, v, pass: min === null ? null : v >= min };
  });
}

/* The accent rows are scored separately because their count varies: one row
   per accent for a solid palette, eleven for the wheel. Both derivations are
   asserted here, so a type colour that could not be made to work would show up
   as a failure rather than as a quietly wrong swatch. */
function accentRows(p) {
  const bg = p.t.page, card = p.t.card;
  const list = p.wheel ? TYPES.map(([name, , fill]) => ({ name, fill })) : p.accents;
  return list.map(({ name, fill }) => {
    const { fill: solid, on } = labelFill(fill);
    const deep = textOn(fill, bg);
    return {
      name, fill, solid, on, deep,
      onV: r2(on, solid),
      deepV: r2(deep, bg),
      fillV: r2(fill, card),
      onPass: r2(on, solid) >= 4.5,
      deepPass: r2(deep, bg) >= 4.5,
    };
  });
}

/* ==========================================================================
   THE FRAGMENT. Exactly the components Tim listed, in the order he listed
   them, with the class names and the pixel sizes taken from the real rules so
   the mockup can be checked against a live page:

     .bar/.brand/.bar-find/.menu-btn/.sub   assets-source/ui.css 274-300, 1018,
                                            1838-1856
     .menu/.menu-g/.menu-h/.menu-x          ui.css 1124 and the block at 1838
     .v/.vid-shell/.vid-title/.vid-meta     ui.css, the rip tile
     .luck-stat                             public/luck.html, its own style block
     .t100-li and friends                   public/most-expensive-sealed.html
     .btn/.btn-yt/.btn-sky                  ui.css, the button block

   THE ACCENT IS PASSED PER BAND, which is the whole mechanism of the rainbow
   option: `--acc` is the fill, `--acc-on` the label that sits on it and
   `--acc-deep` the only text that takes the hue. A one-accent palette gets the
   same three values in every band and therefore looks identical band to band.
   ========================================================================== */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const RIPS = [
  ["Six packs of Prismatic Evolutions and one very bad decision", "2 DAYS AGO &middot; 3,102 VIEWS", "#7FD8E8", "#B98BE0", "#5B4A8C"],
  ["Destined Rivals ETB, the whole thing, no cuts", "4 DAYS AGO &middot; 1,884 VIEWS", "#D6453F", "#8E2C46", "#1E1838"],
  ["Chaos Rising blister from the Wegmans on Ridge", "6 DAYS AGO &middot; 2,461 VIEWS", "#E0563A", "#C2361F", "#4A100A"],
];

const ROWS = [
  ["1", "Legendary Treasures Booster Box", "Legendary Treasures", "Booster box", "$18,750.00", "low $16,000.00"],
  ["2", "Pokemon Base Set (Shadowless) [1st Edition] Booster Pack", "Base Set (Shadowless)", "Booster pack", "$15,000.00", "low $15,000.00"],
  ["3", "Neo Genesis Booster Box [1st Edition]", "Neo Genesis", "Booster box", "$11,400.00", "low $11,400.00"],
];

function band(p, i, inner) {
  const list = p.wheel ? TYPES.map(([name, , fill]) => ({ name, fill })) : p.accents;
  const a = list[i % list.length];
  const { fill: solid, on } = labelFill(a.fill);
  const deep = textOn(a.fill, p.t.page);
  /* THREE VALUES PER ACCENT AND EACH HAS ONE JOB, which is the whole answer to
     "what carries the colour". --acc is the raw type colour and is DECORATION
     ONLY: the card border, the tile's top rule, the kicker dot, none of which
     has anything readable on it. --acc-solid is the same hue moved until a
     label on it clears 4.5:1, and is what anything carrying text takes: the
     play button here, and a chip or a rank badge on a real page. --acc-deep is
     the only TEXT that takes the hue. Mixing these up is how a rainbow scheme
     fails a contrast check while looking fine in a screenshot. */
  return `<section class="bandx" style="--acc:${a.fill};--acc-solid:${solid};--acc-on:${on};--acc-deep:${deep}" data-acc="${escAttr(a.name)}">${inner(a)}</section>`;
}

function fragment(p) {
  const B = (i, inner) => band(p, i, inner);
  return `
<header class="bar">
  <div class="bar-in">
    <span class="brand"><b>GARBAGE <i>RIPS</i> 585</b><span>Rochester, NY</span></span>
    <span class="bar-find" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg></span>
    <span class="menu-btn" aria-expanded="true">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <span>Menu</span>
    </span>
    <span class="sub${p.ytKeyline ? " sub-keyed" : ""}"><span>Subscribe</span></span>
  </div>
</header>

<!-- The nav accordion, drawn OPEN, because a closed one shows none of the
     colour decisions that matter: the group heading uses --chrome-dim and the
     links use --chrome-ink, and those two against the chrome are where a
     bright chrome palette usually fails. -->
<nav class="menu" aria-label="All sections">
  <div class="menu-inner">
    <details class="menu-g" open>
      <summary class="menu-h">The channel<span class="menu-x" aria-hidden="true"></span></summary>
      <ul>
        <li><span class="menu-a">Rips</span></li>
        <li><span class="menu-a">Playlists</span></li>
        <li><span class="menu-a">Best pulls</span></li>
        <li><span class="menu-a">Rip results</span></li>
      </ul>
    </details>
  </div>
</nav>

${B(0, () => `
<div class="wrap">
  <p class="sec-label"><span class="dot"></span>Latest rips</p>
  <h2 class="h2">Fresh out of the garbage</h2>
  <div class="vid-grid">
    ${RIPS.map(([t, m, a, b, c]) => `
    <div class="v">
      <span class="vid-shell"><span class="pk" style="--pk-a:${a};--pk-b:${b};--pk-c:${c}"></span><span class="vid-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span>
      <h3 class="vid-title">${t}</h3>
      <p class="vid-meta">${m}</p>
    </div>`).join("")}
  </div>
</div>`)}

${B(1, () => `
<div class="wrap">
  <p class="sec-label"><span class="dot"></span>Rip results</p>
  <h2 class="h2">What 313 rips actually returned</h2>
  <div class="luck-head">
    ${[["$18,750", "HIGHEST SEALED PRICE"], ["324", "PACKS OPENED"], ["11", "CHASE HITS"], ["3.4%", "HIT RATE"]]
      .map(([n, l]) => `<div class="luck-stat"><b>${n}</b><span>${l}</span></div>`).join("")}
  </div>
</div>`)}

${B(2, () => `
<div class="wrap">
  <p class="sec-label"><span class="dot"></span>Most expensive sealed</p>
  <h2 class="h2">The sealed products people ask about</h2>
  <ol class="t100">
    ${ROWS.map(([r, n, set, tag, price, low]) => `
    <li class="t100-li">
      <span class="t100-rank">${r}</span>
      <span class="t100-shot"></span>
      <span class="t100-name">${n}</span>
      <span class="t100-set">${set}</span>
      <span class="t100-tag">${tag}</span>
      <span class="t100-price"><b>${price}</b><span class="t100-low">${low}</span></span>
    </li>`).join("")}
  </ol>
</div>`)}

${B(3, () => `
<div class="wrap prose">
  <p class="sec-label"><span class="dot"></span>Card guides and tools</p>
  <h2 class="h2">Everything we know, written down</h2>
  <p class="lede">Thirty-seven set guides, a 4,481 card price index and a rarity chart with real scans.</p>
  <p>The chase card is Umbreon ex at #161, and it is the reason this set is still on shelves. If you are opening these to complete the set rather than to hit, the <a class="plink" href="#${p.id}">rarity ladder further down</a> is the honest version of what you are getting per box. Prices come from the nightly sync and were last checked this morning. We never state pull rates, because nobody publishes them.</p>
  <p class="btn-row"><span class="btn btn-yt">Watch the rips</span><span class="btn btn-sky">Browse the sets</span></p>
</div>`)}

<footer class="foot">
  <div class="wrap">
    <p class="foot-tag">GARBAGE RIPS 585</p>
    <p class="foot-nav"><span>About</span><span>Rips</span><span>Sets</span><span>Cards</span><span>Shops</span></p>
    <p class="fine">Fan content. Not affiliated with The Pokemon Company.</p>
  </div>
</footer>`;
}

/* ==========================================================================
   THE COMPONENT STYLESHEET for the fragment. Self contained: it links nothing
   and it adds nothing to assets-source/ui.css. Every colour goes through a
   token so a palette swap is a swap of the wrapper's :root and nothing else.
   ========================================================================== */
const FRAG_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--page);color:var(--ink);font:400 17px/1.55 var(--body);
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
.h2{font:400 clamp(1.25rem,3.2vw,1.9rem)/1.12 var(--display);margin-bottom:14px;color:var(--ink)}

/* THE BAR. min-height 60px is --bar-h from ui.css and the three controls are
   44px, which is the tap target the real bar holds to. */
.bar{background:var(--chrome-bg);color:var(--chrome-ink)}
.bar-in{display:flex;align-items:center;gap:16px;max-width:1500px;margin:0 auto;
  padding:8px 24px;min-height:60px}
.brand{display:flex;align-items:baseline;gap:8px;flex:none;min-height:44px;
  align-content:center;flex-wrap:wrap}
.brand b{font:400 1.05rem/1 var(--display);letter-spacing:.01em;color:var(--chrome-ink)}
/* --brand-accent, NOT --mustard, AND THIS SPLIT IS THE SAME BUG ui.css ALREADY
   DOCUMENTS TWICE. One token was doing two unrelated jobs: the accent word in
   the wordmark (which sits ON the chrome) and the light end of the CTA
   gradient (which sits on the PAGE, with dark text on it). Those two only
   coincide while the chrome is dark. On Yellow Border the chrome IS the accent
   hue, so a mustard wordmark measured 1.20:1 against its own bar and the word
   RIPS simply vanished. Splitting the token is the fix; recolouring mustard
   would have broken the CTA on all five. */
.brand b i{font-style:normal;color:var(--brand-accent)}
.brand span{font:700 .6875rem/1 var(--mono);letter-spacing:.1em;color:var(--chrome-dim);
  text-transform:uppercase}
.bar-find{flex:none;display:flex;width:44px;height:44px;border-radius:50%;
  align-items:center;justify-content:center;margin-left:auto;
  background:var(--chrome-well);border:1px solid var(--chrome-edge)}
.bar-find svg{width:19px;height:19px;fill:none;stroke:var(--chrome-ink);
  stroke-width:2.2;stroke-linecap:round}
.menu-btn{flex:none;display:flex;align-items:center;gap:8px;min-width:44px;height:44px;
  border-radius:999px;padding:0 14px;background:var(--chrome-well);border:1px solid var(--chrome-edge)}
.menu-btn svg{width:20px;height:20px;fill:none;stroke:var(--chrome-ink);stroke-width:2.2;
  stroke-linecap:round}
.menu-btn span{font:700 .875rem/1 var(--body);color:var(--chrome-ink)}
/* SUBSCRIBE. The fill and the label are constants across all five palettes.
   .sub-keyed is the Yellow Border fix: the pill gains a hard keyline because
   the red is only 2.83:1 against a yellow bar. */
.sub{flex:none;background:var(--yt-red);color:var(--on-yt);font:700 15px/1 var(--body);
  border-radius:999px;padding:0 16px;min-height:44px;display:inline-flex;
  align-items:center;justify-content:center;white-space:nowrap}
.sub-keyed{border:2px solid var(--keyline)}

/* THE OPEN NAV. */
.menu{background:var(--chrome-bg);color:var(--chrome-ink);border-top:1px solid var(--chrome-edge)}
.menu-inner{max-width:1500px;margin:0 auto;padding:12px 24px 8px}
.menu-h{display:flex;align-items:center;justify-content:space-between;gap:8px;
  list-style:none;font:700 .6875rem/1 var(--mono);letter-spacing:.12em;
  text-transform:uppercase;color:var(--chrome-dim);padding:12px 12px}
.menu-h::-webkit-details-marker{display:none}
.menu-x{flex:none;width:9px;height:9px;margin:4px 0 0;
  border-right:2.5px solid currentColor;border-bottom:2.5px solid currentColor;
  transform:rotate(-135deg)}
.menu ul{list-style:none}
.menu-a{display:flex;align-items:center;min-height:48px;padding:0 12px;
  color:var(--chrome-ink);font:600 1rem/1 var(--body);
  border-bottom:1px solid var(--chrome-edge)}
.menu li:last-child .menu-a{border-bottom:0}

/* THE BANDS. --acc is set per band by the generator. */
.bandx{padding:28px 0 32px;border-top:1px solid var(--hair)}
.sec-label{display:flex;align-items:center;gap:8px;font:700 .75rem/1 var(--mono);
  letter-spacing:.16em;text-transform:uppercase;color:var(--acc-deep);margin-bottom:10px}
.sec-label .dot{width:11px;height:11px;border-radius:50%;background:var(--acc);flex:none}

/* THE RIP CARD. 2/3 is the pack aspect the real tile uses. */
.vid-grid{display:grid;gap:18px;grid-template-columns:repeat(3,1fr)}
.v{display:flex;flex-direction:column;gap:8px;min-width:0}
.vid-shell{position:relative;aspect-ratio:2/3;width:100%;border-radius:10px;overflow:hidden;
  background:var(--navy-deep);border:4px solid var(--acc);
  outline:2px solid var(--keyline);outline-offset:-6px;
  box-shadow:0 6px 0 var(--trubbish),0 12px 22px rgba(0,0,0,.28);display:block}
.pk{position:absolute;inset:0;display:block;
  background:radial-gradient(120% 70% at 50% 12%,rgba(255,255,255,.22),transparent 60%),
    linear-gradient(160deg,var(--pk-a) 0%,var(--pk-b) 45%,var(--pk-c) 100%)}
.pk::after{content:"";position:absolute;inset:0;
  background:linear-gradient(115deg,transparent 26%,rgba(125,249,233,.32) 40%,rgba(249,139,217,.32) 50%,rgba(255,232,107,.32) 60%,transparent 74%);
  mix-blend-mode:screen;opacity:.75}
/* --acc-solid, NOT --acc: this circle carries a glyph, so it is the label-safe
   variant of the accent rather than the raw one. */
.vid-play{position:absolute;left:50%;top:68%;transform:translate(-50%,-50%);z-index:2;
  width:54px;height:54px;border-radius:50%;background:var(--acc-solid);
  border:3px solid var(--paper-2);display:grid;place-items:center;
  box-shadow:0 4px 12px rgba(0,0,0,.45)}
.vid-play svg{width:18px;height:18px;fill:var(--acc-on);margin-left:3px}
.vid-title{font:600 .875rem/1.32 var(--body);color:var(--ink)}
.vid-meta{font:700 .6875rem/1.4 var(--mono);color:var(--ink-soft);letter-spacing:.03em}

/* THE STAT TILE, from public/luck.html's own style block. The accent is the
   top rule only: the numeral stays --ink, because a stat you cannot read is
   not a stat. */
.luck-head{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.luck-stat{background:var(--card);border:1px solid var(--hair);border-top:4px solid var(--acc);
  border-radius:10px;padding:16px;box-shadow:var(--lift)}
.luck-stat b{display:block;font:400 clamp(1.75rem,5vw,2.75rem)/1 var(--display);
  color:var(--ink);margin-bottom:4px}
.luck-stat span{font:700 .6875rem/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}

/* THE RANKED ROW, from public/most-expensive-sealed.html. Desktop grid is the
   real one: 36px rank, 72px shot, then name / set / tag / price. */
.t100{list-style:none;display:grid;gap:8px}
.t100-li{position:relative;background:var(--card);border:1px solid var(--hair);
  border-radius:6px;display:grid;gap:0 10px;padding:9px 10px;align-items:start;
  grid-template-columns:26px 52px minmax(0,1fr);
  grid-template-areas:"rank shot name" "rank shot meta" "rank shot price"}
.t100-rank{grid-area:rank;align-self:center;font:700 .875rem/1 var(--mono);
  color:var(--ink-2);text-align:right;font-variant-numeric:tabular-nums}
.t100-shot{grid-area:shot;width:52px;height:72px;border-radius:4px;
  background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px);
  border:1px solid var(--hair)}
.t100-name{grid-area:name;font:600 .95rem/1.3 var(--body);color:var(--ink)}
.t100-set{grid-area:meta;font:400 .8rem/1.35 var(--body);color:var(--ink-2)}
.t100-tag{display:none}
.t100-price{grid-area:price;display:flex;flex-wrap:wrap;align-items:baseline;
  gap:1px 10px;margin-top:4px}
.t100-price b{font:700 1rem/1.3 var(--mono);color:var(--ink);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.t100-low{font:400 .6875rem/1.3 var(--mono);color:var(--ink-2)}

/* RUNNING TEXT. */
.prose .lede{font-size:1.1rem;max-width:38em;color:var(--ink-soft);margin-bottom:14px}
.prose p{max-width:66ch;margin-bottom:16px;color:var(--ink)}
.plink{color:var(--ketchup-deep);text-decoration:underline;
  text-decoration-thickness:1px;text-underline-offset:2px}
.btn-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.btn{display:inline-flex;align-items:center;font:700 1rem/1 var(--body);
  padding:13px 24px;border-radius:999px;border:2px solid var(--keyline)}
.btn-yt{background:linear-gradient(180deg,var(--mustard),var(--gold));
  color:var(--on-accent);box-shadow:4px 4px 0 var(--keyline)}
.btn-sky{background:var(--sky);color:var(--on-accent);box-shadow:4px 4px 0 var(--keyline)}

/* THE FOOTER. The fan-content line is required copy and is scored. */
.foot{background:var(--chrome-bg);color:var(--foot-ink);padding:30px 0 28px;text-align:center}
.foot-tag{font:400 clamp(1.2rem,3.2vw,1.7rem)/1 var(--display);color:var(--brand-accent);
  margin-bottom:12px}
.foot-nav{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.foot-nav span{font:700 .875rem/1 var(--body);color:var(--foot-ink)}
.fine{font:700 .6875rem/1.7 var(--mono);color:var(--foot-ink);letter-spacing:.03em}

/* THE ONE BREAKPOINT THAT MATTERS. 560px is where ui.css drops the bar's
   sub-label and the magnifier, so a 390px frame must do the same or it is not
   showing the phone the site actually ships. */
@media(max-width:860px){
  .vid-grid{grid-template-columns:repeat(2,1fr)}
  .luck-head{grid-template-columns:repeat(2,1fr)}
  .menu-inner{padding:8px 14px}
}
@media(max-width:560px){
  .wrap{padding:0 14px}
  .bar-in{padding:8px 14px;gap:10px}
  .brand span{display:none}
  .bar-find{display:none}
  .menu-btn{padding:0;width:44px;justify-content:center;margin-left:auto}
  .menu-btn span{display:none}
  .vid-grid{grid-template-columns:1fr 1fr}
  .luck-head{grid-template-columns:repeat(2,1fr)}
}`;

/* Build one complete standalone document for one palette. This is what goes in
   an iframe, and it is a whole document rather than a scoped div ON PURPOSE:
   a media query answers to the VIEWPORT, so the only way to see what the 390px
   layout really does is to give it a 390px viewport. A scoped wrapper inside a
   1400px page would render the desktop layout at a narrow width and quietly
   show Tim something the site never does. */
function doc(p) {
  const tok = { ...p.t, ...YT };
  const vars = Object.entries(tok).map(([k, v]) => `--${k}:${v}`).join(";");
  /* Two derived tokens the chrome needs. The real ui.css writes these as
     rgba(255,255,255,.12) literals, which is correct on a dark bar and wrong
     on a bright one: on Yellow Border a white wash is invisible. So they are
     derived from whether the chrome is light or dark. */
  const chromeDark = lum(tok["chrome-bg"]) < 0.4;
  const well = chromeDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.09)";
  const edge = chromeDark ? "rgba(255,255,255,.20)" : "rgba(0,0,0,.22)";
  const lift = p.dark
    ? "0 1px 2px rgba(0,0,0,.5),0 6px 14px rgba(0,0,0,.45)"
    : "0 1px 1px rgba(17,17,17,.07),0 2px 3px rgba(17,17,17,.07),0 6px 10px rgba(17,17,17,.07)";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(p.name)}</title>
<style>${fontCss}</style>
<style>
:root{${vars};--chrome-well:${well};--chrome-edge:${edge};--lift:${lift};
  --display:'Titan One',system-ui,sans-serif;
  --body:'Outfit',system-ui,sans-serif;
  --mono:'Space Mono',ui-monospace,monospace}
${FRAG_CSS}
</style></head><body>${fragment(p)}</body></html>`;
}

/* ==========================================================================
   THE OUTPUT PAGE
   ========================================================================== */
function pairTable(rows) {
  const body = rows.map((r) => {
    const tag = r.pass === null ? "info" : r.pass ? "ok" : "bad";
    const verdict = r.pass === null ? "not scored" : r.pass ? "AA pass" : "AA FAIL";
    return `<tr class="${tag}"><td>${esc(r.label)}</td><td class="num">${r.v.toFixed(2)}</td><td class="num">${r.min ?? "-"}</td><td>${verdict}</td><td class="sm"><code>${r.f}</code> on <code>${r.b}</code></td><td class="sm">${esc(r.where)}</td></tr>`;
  }).join("\n");
  return `<div class="scroller"><table class="ct"><thead><tr><th>Pair</th><th class="num">Ratio</th><th class="num">Floor</th><th>Verdict</th><th>Colours</th><th>Where you can see it</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function accTable(p, rows) {
  const body = rows.map((a) => `<tr class="${a.onPass && a.deepPass ? "ok" : "bad"}">
    <td><span class="chipx" style="background:${a.fill};color:${a.on}">${esc(a.name)}</span></td>
    <td class="sm"><code>${a.fill}</code></td>
    <td class="num">${a.onV.toFixed(2)}</td>
    <td class="sm"><code>${a.deep}</code></td>
    <td class="num">${a.deepV.toFixed(2)}</td>
    <td class="num">${a.fillV.toFixed(2)}</td>
    <td>${a.onPass && a.deepPass ? "AA pass" : "AA FAIL"}</td></tr>`).join("\n");
  return `<div class="scroller"><table class="ct"><thead><tr>
    <th>Accent</th><th>Fill</th><th class="num">Label on fill<br>(min 4.5)</th>
    <th>Derived text</th><th class="num">Text on page<br>(min 4.5)</th>
    <th class="num">Fill on card<br>(reference)</th><th>Verdict</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

const sections = PALETTES.map((p) => {
  const rows = score(p);
  const acc = accentRows(p);
  const scored = rows.filter((r) => r.pass !== null);
  const fails = scored.filter((r) => !r.pass);
  const accFails = acc.filter((a) => !a.onPass || !a.deepPass);
  const worst = scored.reduce((a, r) => (r.v < a.v ? r : a));
  const d = escAttr(doc(p));
  const swatch = Object.entries(p.t).map(([k, v]) =>
    `<span class="sw"><span class="sw-c" style="background:${v}"></span><code>--${k}</code><code class="hex">${v}</code></span>`).join("");

  return `
<section class="opt" id="${p.id}">
  <div class="opt-head">
    <p class="kicker">${esc(p.label)}${p.id === "cur" ? " &middot; unchanged baseline" : ""}</p>
    <h2>${esc(p.name)}</h2>
    <p class="pitch">${esc(p.pitch)}</p>
    <p class="idea">${esc(p.idea)}</p>
    <p class="idea"><b>The argument.</b> ${esc(p.argument)}</p>
    ${p.argument2 ? `<p class="idea warnx">${esc(p.argument2)}</p>` : ""}
    <ul class="stats">
      <li><b>${worst.v.toFixed(2)}:1</b><span>worst scored pair<br>${esc(worst.label)}</span></li>
      <li class="${fails.length ? "bad" : "ok"}"><b>${fails.length}</b><span>AA failures across<br>${scored.length} component pairs</span></li>
      <li class="${accFails.length ? "bad" : "ok"}"><b>${accFails.length}</b><span>AA failures across<br>${acc.length} accent${acc.length === 1 ? "" : "s"}</span></li>
      <li><b>${acc.length}</b><span>accent${acc.length === 1 ? "" : "s"} in rotation<br>${p.wheel ? "one per section" : "one, everywhere"}</span></li>
    </ul>
    <div class="swatches">${swatch}</div>
  </div>

  <div class="views">
    <div class="viewbox">
      <p class="vlabel">Desktop &middot; 1440px viewport <span>shown at 79% so it fits, layout is real 1440</span></p>
      <div class="scalebox"><iframe class="fr fr-desk" title="${escAttr(p.name)} at 1440px" srcdoc="${d}" loading="lazy"></iframe></div>
    </div>
    <div class="viewbox">
      <p class="vlabel">Phone &middot; 390px viewport <span>shown at true size, this is what a Short lands on</span></p>
      <iframe class="fr fr-ph" title="${escAttr(p.name)} at 390px" srcdoc="${d}" loading="lazy"></iframe>
    </div>
  </div>

  <details class="numbers">
    <summary>Measured contrast for ${esc(p.name)}: ${scored.length} component pairs, ${acc.length} accent${acc.length === 1 ? "" : "s"}</summary>
    ${pairTable(rows)}
    <p class="tnote">The accents. ${p.wheel
      ? "All eleven are listed because the wheel rotates through all eleven, even though the mockup above only reaches the first five. The derived text column is computed by walking the type colour toward black until it clears 4.5:1 on this palette's page ground."
      : "One accent, so one row. The derived text column is computed the same way for every palette so the numbers are comparable."}</p>
    ${accTable(p, acc)}
  </details>
</section>`;
}).join("\n");

const summary = `<div class="scroller"><table class="ct sum"><thead><tr>
<th>Candidate</th><th class="num">Body copy<br>on page</th><th class="num">Link in<br>running text</th>
<th class="num">Bar text<br>on bar</th><th class="num">Subscribe<br>on bar</th>
<th class="num">Worst<br>pair</th><th class="num">AA<br>failures</th></tr></thead><tbody>
${PALETTES.map((p) => {
  const rows = score(p);
  const acc = accentRows(p);
  const scored = rows.filter((r) => r.pass !== null);
  const get = (l) => rows.find((r) => r.label === l).v.toFixed(2);
  const fails = scored.filter((r) => !r.pass).length + acc.filter((a) => !a.onPass || !a.deepPass).length;
  const worst = scored.reduce((a, r) => (r.v < a.v ? r : a)).v.toFixed(2);
  return `<tr><td><a href="#${p.id}"><b>${esc(p.label)}</b> &middot; ${esc(p.name)}</a></td>
  <td class="num">${get("Body copy on the page")}</td>
  <td class="num">${get("Link in running text")}</td>
  <td class="num">${get("Bar text on the bar")}</td>
  <td class="num">${get("Subscribe pill against the bar")}</td>
  <td class="num">${worst}</td>
  <td class="num ${fails ? "bad" : "ok"}">${fails}</td></tr>`;
}).join("\n")}
</tbody></table></div>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- NOINDEX IS LOAD BEARING. build-search.mjs fails the build on any top level
     page that is neither in its PAGES array nor marked noindex, and
     check-build.py fails on any noindex page that appears in sitemap.xml. This
     file is also outside public/ entirely, so pages.yml never uploads it. See
     the header of scripts/gen-fun-palettes.mjs. -->
<meta name="robots" content="noindex,nofollow">
<title>Colour scheme mockups &mdash; Garbage Rips 585 working file</title>
<style>${fontCss}</style>
<style>
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
.intro p{max-width:64ch;margin-bottom:14px;color:var(--sh-dim)}
.intro p strong{color:var(--sh-ink)}
.toc{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 8px;position:sticky;top:0;
  background:var(--sh-bg);padding:12px 0;z-index:20;border-bottom:1px solid var(--sh-line)}
.toc a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;
  border:1px solid var(--sh-line);background:var(--sh-panel);border-radius:999px;
  font:700 .8rem/1 var(--body);color:var(--sh-ink);text-decoration:none}
.toc a:hover{border-color:var(--sh-ink)}

.opt{margin:0 0 46px;border-top:3px solid var(--sh-ink);padding-top:8px}
.opt-head{padding:26px 0 20px}
.kicker{font:700 .7rem/1 var(--mono);letter-spacing:.16em;color:var(--sh-dim);
  text-transform:uppercase;margin-bottom:10px}
.opt-head h2{font:400 clamp(1.5rem,4vw,2.2rem)/1.1 var(--display);margin-bottom:10px}
.pitch{max-width:66ch;font-size:1.1rem;color:var(--sh-ink);margin-bottom:14px}
.idea{max-width:72ch;color:var(--sh-dim);margin-bottom:12px;font-size:.95rem}
.idea b{color:var(--sh-ink)}
.warnx{background:#FFF6E5;border-left:4px solid #B87200;padding:12px 14px;
  border-radius:0 6px 6px 0;color:var(--sh-ink)}
.stats{list-style:none;display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
.stats li{background:var(--sh-panel);border:1px solid var(--sh-line);border-radius:10px;
  padding:10px 14px;min-width:160px}
.stats b{display:block;font:400 1.35rem/1.1 var(--display)}
.stats span{display:block;font:700 .62rem/1.4 var(--mono);letter-spacing:.05em;
  text-transform:uppercase;color:var(--sh-dim);margin-top:4px}
.stats li.ok b{color:var(--sh-ok)} .stats li.bad b{color:var(--sh-bad)}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}
.sw{display:flex;align-items:center;gap:7px;font:400 .62rem/1.2 var(--mono);min-width:0}
.sw-c{width:20px;height:20px;border-radius:4px;border:1px solid var(--sh-line);flex:none}
.sw code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sw .hex{color:var(--sh-dim);margin-left:auto;flex:none}

/* THE TWO VIEWPORTS. The desktop frame is a real 1440px viewport scaled down
   by transform so the layout inside it is the true 1440 layout; the phone
   frame is left at true size because a phone mockup shrunk is a lie about
   how big the type is, and this site is mobile first. */
.views{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
/* overflow-x ON THE BOX, NOT ON THE BODY. The phone frame is a hard 390px and
   the shell adds 20px of padding either side, so on a 390px screen the frame
   is 40px wider than the space it has and the whole DOCUMENT scrolled
   sideways: measured scrollWidth 410 against clientWidth 390. Scaling the
   frame down would have been the wrong fix, because the one thing a true-size
   phone mockup is for is judging how big the type really is. So the frame
   keeps its 390px and its own container scrolls instead. */
.viewbox{flex:1 1 100%;min-width:0;overflow-x:auto}
.vlabel{font:700 .68rem/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--sh-dim);margin-bottom:8px}
.vlabel span{text-transform:none;letter-spacing:0;font-weight:400;opacity:.85}
/* THE HEIGHTS ARE MEASURED, NOT GUESSED, and they have to be. An iframe with
   no content-height feedback defaults to 150px and a too-short one gives the
   frame its own scrollbar, which would let Tim compare the top third of five
   palettes and quietly hide the footer on all of them. Driven in headless
   Chrome on 18 August 2026, the fragment renders 2254px tall at a 1440px
   viewport and 2664px at 390px, identical across all five candidates because
   they share one fragment. A little slack is added to each so a font fallback
   on a machine without the woff2 files cannot clip the footer. */
.fr{border:1px solid var(--sh-line);border-radius:10px;background:#fff;display:block}
.scalebox{width:100%;height:1815px;overflow:hidden;border-radius:10px}
.fr-desk{width:1440px;height:2290px;transform:scale(.7917);transform-origin:top left;
  border-radius:12px}
.fr-ph{width:390px;height:2700px;margin:0 auto}
@media(max-width:1220px){
  .scalebox{height:1445px}
  .fr-desk{transform:scale(.63)}
}

.numbers{margin:18px 0 0;background:var(--sh-panel);border:1px solid var(--sh-line);
  border-radius:10px}
.numbers summary{padding:14px 16px;cursor:pointer;font:700 .85rem/1 var(--body)}
.ct{width:100%;border-collapse:collapse;font:400 .78rem/1.4 var(--body)}
.numbers .ct{border-top:1px solid var(--sh-line)}
.ct th,.ct td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--sh-line);
  vertical-align:top}
.ct th{font:700 .66rem/1.3 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--sh-dim)}
.ct .num{text-align:right;font-family:var(--mono);white-space:nowrap}
.ct .sm{font:400 .68rem/1.35 var(--mono);color:var(--sh-dim)}
.ct tr.ok td:nth-child(4){color:var(--sh-ok)}
.ct tr.bad td{background:#FDECEC}
.ct tr.bad td:last-child{color:var(--sh-bad);font-weight:700}
.ct tr.info td:nth-child(4){color:var(--sh-dim)}
.sum{background:var(--sh-panel);border:1px solid var(--sh-line);border-radius:10px;
  margin:10px 0 30px}
.sum td.ok{color:var(--sh-ok);font-weight:700}
.sum td.bad{color:var(--sh-bad);font-weight:700}
.scroller{overflow-x:auto;-webkit-overflow-scrolling:touch}
.chipx{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;
  border-radius:999px;font:700 .7rem/1 var(--body)}
.tnote{padding:12px 16px;font-size:.8rem;color:var(--sh-dim);max-width:80ch}
</style>
</head>
<body>
<div class="shell">
  <div class="intro">
    <h1>Colour scheme mockups</h1>
    <p><strong>Nothing here ships and nothing here is decided.</strong> This is a working
      file, not a page of the site: it is marked <code>noindex</code>, it lives outside
      <code>public/</code> so the deploy never sees it, and it is not in
      <code>sitemap.xml</code>. <code>assets-source/ui.css</code> is untouched. The live
      palette is exactly what it was this morning.</p>
    <p>Five candidates, each rendering the <strong>same seven components</strong>: the header
      bar with the wordmark, the magnifier, Menu and the Subscribe pill; the nav accordion
      drawn open; a rip card; the stat tiles from Rip results; a ranked row from Most
      expensive sealed; the gold CTA and the secondary button; and a heading, body copy and
      a link in running text.</p>
    <p>Each one is rendered <strong>twice</strong>, at a real 1440px viewport and a real
      390px viewport, because a palette that sings on a desktop can be unreadable on a
      phone and most people arrive here from a Short.</p>
    <p><strong>Every ratio on this page is computed, not eyeballed.</strong> WCAG 2.1
      floors, applied per role: 4.5:1 for body size text, 3:1 for large text and for a
      control's own boundary. A candidate that fails is not a candidate.</p>
    <p><strong>Subscribe does not change.</strong> It is YouTube red in all five, because
      it is a brand mark rather than a palette choice. What varies is whether that red is
      still findable against each palette's bar, which is measured in the table below.</p>
  </div>
  <nav class="toc">${PALETTES.map((p) => `<a href="#${p.id}">${esc(p.label)} &middot; ${esc(p.name)}</a>`).join("")}</nav>
  ${summary}
</div>
<div class="shell">
${sections}
</div>
</body>
</html>
`;

/* ==========================================================================
   THE TWO CROSS CHECKS. Both throw rather than warn, for the reason this repo
   keeps relearning: a decision aid that has quietly stopped describing the
   thing it claims to describe is worse than no decision aid.
   ========================================================================== */
async function checkCurrent() {
  const css = await readFile(join(ROOT, "assets-source/ui.css"), "utf8");
  const root = css.slice(css.indexOf(":root{"), css.indexOf("}\n*{"));
  /* TOKENS THIS MOCKUP PROPOSES THAT ui.css DOES NOT HAVE YET. They are
     exempt from the drift check because there is nothing to drift from: the
     check exists to catch the 'Today' column quietly ceasing to be today's
     values, not to forbid a candidate from needing a token that does not
     exist. Each one has to be justified here to earn its exemption.

       --brand-accent  the accent word in the wordmark and the footer tag.
                       Today this is --mustard, and today that is fine because
                       the chrome is near-black. It has to split before any
                       palette with a BRIGHT chrome is buildable: see the note
                       beside .brand b i. If a candidate here is chosen, this
                       split lands in ui.css in the same commit.

     THE VALUE FOR THE 'Today' PALETTE IS THEREFORE ASSERTED AGAINST --mustard
     INSTEAD, so the baseline still cannot drift: if ui.css's mustard moves and
     this file's brand-accent does not, this throws. */
  const PROPOSED = { "brand-accent": "mustard" };
  const bad = [];
  for (const [k, v] of Object.entries(PALETTES[0].t)) {
    if (!v.startsWith("#") && !v.startsWith("rgba")) continue;
    if (PROPOSED[k]) {
      const m = new RegExp(`--${PROPOSED[k]}\\s*:\\s*([^;]+);`).exec(root);
      if (!m) { bad.push(`--${k}: stands in for --${PROPOSED[k]}, which is not in ui.css :root`); continue; }
      if (m[1].trim().toLowerCase() !== v.toLowerCase()) {
        bad.push(`--${k}: proposed split of --${PROPOSED[k]}, which ui.css has as ${m[1].trim()}, but this file says ${v}`);
      }
      continue;
    }
    const m = new RegExp(`--${k}\\s*:\\s*([^;]+);`).exec(root);
    if (!m) { bad.push(`--${k}: not found in ui.css :root`); continue; }
    const live = m[1].trim();
    if (live.toLowerCase() !== v.toLowerCase()) bad.push(`--${k}: ui.css has ${live}, this file says ${v}`);
  }
  if (bad.length) {
    throw new Error(
      "The 'Today' column has drifted from assets-source/ui.css:\n  " + bad.join("\n  ") +
      "\nFix the values in PALETTES[0] so the baseline is really the baseline."
    );
  }
}

async function checkTypes() {
  const src = await readFile(join(ROOT, "scripts/build-types.mjs"), "utf8");
  const bad = [];
  for (const [name, key, hex] of TYPES) {
    const m = new RegExp(`${key}:\\s*\\["(#[0-9A-Fa-f]{6})"`).exec(src);
    if (!m) { bad.push(`${name}: no entry in build-types.mjs`); continue; }
    if (m[1].toUpperCase() !== hex.toUpperCase()) bad.push(`${name}: build-types.mjs has ${m[1]}, this file says ${hex}`);
  }
  if (bad.length) {
    throw new Error(
      "The energy type colours have drifted from scripts/build-types.mjs:\n  " + bad.join("\n  ")
    );
  }
}

await checkCurrent();
await checkTypes();
await writeFile(join(ROOT, "assets-source/fun-palette-preview.html"), html);

console.log("Wrote assets-source/fun-palette-preview.html");
console.log(`  ${PALETTES.length} candidates, ${PAIRS.length} component pairs each, 2 viewports each`);
console.log("  cross-checks passed: 'Today' matches ui.css, type colours match build-types.mjs\n");
let total = 0;
for (const p of PALETTES) {
  const rows = score(p).filter((r) => r.pass !== null);
  const acc = accentRows(p);
  const fails = rows.filter((r) => !r.pass);
  const accFails = acc.filter((a) => !a.onPass || !a.deepPass);
  total += fails.length + accFails.length;
  const worst = rows.reduce((a, r) => (r.v < a.v ? r : a));
  console.log(
    `  ${p.label.padEnd(9)} ${p.name.padEnd(22)} worst ${worst.v.toFixed(2)}:1 (${worst.label}), ` +
      `${fails.length} pair + ${accFails.length} accent AA failures`
  );
  for (const r of fails) console.log(`      FAIL  ${r.label}: ${r.v.toFixed(2)} < ${r.min} (${r.f} on ${r.b})`);
  for (const a of accFails) console.log(`      FAIL  accent ${a.name}: label ${a.onV.toFixed(2)}, text ${a.deepV.toFixed(2)}`);
}
console.log(`\n  ${total} AA failures in total across all five candidates.`);
