/**
 * Writes assets-source/slushie-variants-preview.html: SLUSHIE plus seven
 * variations on it, each rendering the SAME set of real site components, each
 * rendered TWICE, once in a 390px frame and once in a 1440px frame.
 *
 * WHY THIS EXISTS. Tim, 18 August 2026, after scripts/gen-fun-palettes.mjs:
 * "option 2 slushie is my favorite of those two, could you try a few more
 * variations on that style, maybe a dark slushie option that looks like dark
 * mode on your phone but still has cool colors like slushie does", and then,
 * narrowing it: "yes make another moc up with variation on slushie and ill
 * pick one of those, i really like the purple in slushie".
 *
 * SO THE FIXED POINT OF THIS FILE IS THE PURPLE, NOT SLUSHIE. Every candidate
 * here keeps a purple or an indigo as a LEADING colour rather than as a
 * supporting accent, because a variation that drops it is a wasted slot. The
 * one candidate that hands the page over to a different lead, Slushie Cyan,
 * keeps the purple as the chrome and moves it into the link role, so it shows
 * the purple in a different JOB rather than showing it removed. It is labelled
 * as the odd one out on the page itself.
 *
 * NOTHING HERE SHIPS. It is the third file in the series and it follows the
 * same four guards gen-fun-palettes.mjs sets out at length:
 *   1. It writes OUTSIDE public/. pages.yml uploads the whole of public/ on
 *      every push, so a working file under it is a published file the moment
 *      LIVE flips in shared/site.mjs.
 *   2. It is `noindex,nofollow`, which is also how build-search.mjs decides a
 *      top level page needs no PAGES entry.
 *   3. sitemap.xml is a hand written list in build-pages.mjs. This file was
 *      never added to it, and check-build.py fails on any noindex page that
 *      turns up in the sitemap.
 *   4. assets-source/ui.css is not touched. Every palette is a token block on
 *      one wrapper document and every component rule lives in this file.
 *
 * DELIBERATELY NOT NAMED build-* OR stamp-*. check-build.py fails the build on
 * any scripts/build-* or scripts/stamp-* file that build-all.mjs does not run.
 * Run it by hand:
 *
 *     node scripts/gen-slushie-variants.mjs
 *
 * IT IS A THIRD FILE RATHER THAN AN EDIT TO gen-fun-palettes.mjs FOR THE SAME
 * REASON THAT FILE IS A SECOND ONE. gen-fun-palettes.mjs is the decision record
 * for the question Tim has already answered ("which of these five"), and
 * rewriting it to hold the follow-up question would destroy the record of the
 * choice that got us here. Its Slushie entry is the input to this file, and
 * checkSlushie() below re-reads it on every run and throws if the baseline
 * transcribed here has drifted from it, so the "what you picked" column cannot
 * quietly stop being what he picked.
 *
 * THE COLOUR NAMES IN THIS REPO LIE AND THIS FILE READS VALUES INSTEAD.
 * `--ketchup` and `--navy` are BOTH #111111 in ui.css since the 16 August
 * repaint. Every hex below is a value, and every ratio on the output page is
 * computed from those values rather than asserted by hand.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Fonts inlined with their urls rewritten relative to the output, because this
   file lives outside public/ and an absolute /assets/ url resolves against
   nothing here. On a page whose whole job is judging how type and colour sit
   together, a silent fallback font is the worst possible failure. */
const fontCss = (await readFile(join(ROOT, "public/assets/fonts.css"), "utf8"))
  .replace(/url\(\/assets\//g, "url(../public/assets/");

/* ==========================================================================
   MEASUREMENT. WCAG 2.1 relative luminance, the same maths as
   gen-palette-preview.mjs and gen-fun-palettes.mjs, so the numbers on all
   three pages are directly comparable.
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
function flat(c, ground) {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return c;
  const [r, g, b, a = 1] = m[1].split(",").map(parseFloat);
  const [gr, gg, gb] = hex2rgb(ground);
  const mix = (f, bg) => Math.round(f * a + bg * (1 - a));
  return rgb2hex([mix(r, gr), mix(g, gg), mix(b, gb)]);
}

/* THE INVERSE OF lum() FOR A NEUTRAL GREY. Used only to turn the MEASURED
   luminance of a real card scan's border into something the contrast table can
   score, so the scan rows are computed from the files on disk rather than from
   an opinion about how bright a card looks. */
function greyOfLum(L) {
  const c = L <= 0.0031308 ? L * 12.92 : (L ** (1 / 2.4)) * 1.055 - 0.055;
  const v = Math.round(c * 255);
  return rgb2hex([v, v, v]);
}

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

/* WALKS TOWARD BLACK ON A LIGHT PAGE AND TOWARD WHITE ON A DARK ONE, and that
   second half is new here. gen-fun-palettes.mjs only ever walked darker, which
   is correct for its four light candidates and was harmless for its one dark
   one because that palette's accent was a gold that already cleared 4.5:1 on
   near-black. FIVE OF THE EIGHT CANDIDATES HERE ARE PURPLE-LED AND TWO OF THEM
   ARE DARK, and purple is a low-luminance hue: walking a violet toward black on
   a black ground moves it AWAY from passing, forever, and the loop would have
   quietly returned #000000. Which direction to walk is a property of the
   GROUND, so it is read off the ground. */
function textOn(c, bg, target = 4.5) {
  const up = lum(bg) < 0.18;
  let rgb = hex2rgb(c);
  for (let i = 0; i <= 200; i++) {
    const hex = rgb2hex(rgb);
    if (ratio(hex, bg) >= target) return hex;
    rgb = up ? rgb.map((v) => Math.min(255, v * 1.03 + 2)) : rgb.map((v) => v * 0.96);
  }
  return up ? "#FFFFFF" : "#000000";
}

/* ==========================================================================
   SUBSCRIBE IS NOT A PALETTE CHOICE AND DOES NOT VARY. #EE0000 rather than
   YouTube's #FF0000 because white on #FF0000 measures 4.00:1 and FAILS AA for
   the 15px label, which cannot grow: at 390px the bar is 366px wide and a
   large-text label does not fit beside the wordmark. #EE0000 is the lightest
   red that clears 4.5.
   ========================================================================== */
const YT = { "yt-red": "#EE0000", "yt-red-deep": "#C00000", "on-yt": "#FFFFFF" };

/* ==========================================================================
   THE ONE MEASURED PROBLEM EVERY CANDIDATE ON THIS PAGE HAD TO FIX.

   Slushie's weakest scored pair is the Subscribe pill against its own bar:
   #EE0000 on #2B1B5A is 3.29:1. That clears the 3:1 WCAG 1.4.11 asks of a
   control's own boundary, but only just, and it is the lowest number in the
   whole set.

   THE FIX IS ARITHMETIC RATHER THAN TASTE, and it only runs one way. The red
   is a constant at relative luminance 0.1818. A purple bar is always DARKER
   than that red, so the ratio is (0.1818 + 0.05) / (barLum + 0.05): it
   improves as the bar goes DOWN and gets worse as the bar goes up. Slushie's
   bar sits at 0.0204. Every purple bar on this page is at or below 0.0110,
   which is the luminance that buys 3.8:1, and SUB_FLOOR below asserts it.

   THE TEMPTING WRONG FIX IS A BRIGHTER BAR. A pale lilac bar also scores well,
   because once the bar is lighter than the red the ratio climbs again, and a
   #E9E1FA bar measures 3.59:1. It was tried and dropped: it is the Yellow
   Border problem from gen-fun-palettes.mjs in a new hue, it forces the wordmark
   accent and every bar label to invert, and it is not the purple Tim said he
   liked. Deepening the bar keeps the colour he pointed at and fixes the number
   at the same time, which is why all eight do it the same way.

   THE OTHER FIX, A KEYLINE ROUND THE PILL, IS THE ONE Yellow Border NEEDED and
   is deliberately NOT used here. It is a structural change to a component, and
   none of these candidates needs one. Writing that down matters because "put a
   ring on it" is the obvious move and it would have hidden the fact that the
   bar itself was the thing to move.
   ========================================================================== */
const SUB_FLOOR = 3.8;

/* ==========================================================================
   THE CARD SCANS, AND THE CLAIM THIS FILE EXISTS PARTLY TO TEST.

   gen-fun-palettes.mjs's dark candidate argued that "every card scan, pack
   wrapper and set logo on the site is a bright rectangle photographed on white,
   and on a white page they sit flat. On this ground they light up." Half of
   that sentence is an assumption and it is WRONG, which matters because the
   opposite worry (white scans becoming glaring rectangles on a dark ground) is
   built on the same assumption.

   MEASURED FROM THE FILES IN THE TREE rather than from either argument. 180
   card scans under public/assets/cards/, sampled around the outer ring of every
   one of them, with PIL, 18 August 2026:

     - the ring is 100% opaque and the CORNERS are transparent. These are
       edge-to-edge cards with rounded corners cut out, NOT photographs on a
       white sheet. ui.css already says so at .cs-one-img: "Card scans have a
       light border of their own, so no plate behind them."
     - border luminance across the 180: min 0.029, p25 0.182, median 0.195,
       p75 0.472, max 0.776. Pure white is 1.000. The median scan's edge is
       nowhere near white.
     - set logos and pack art sampled the same way are fully transparent at
       every edge, alpha 0, so they take the page ground whatever it is.

   The four scans rendered in the strip below are the darkest, the median, the
   p75 and the brightest of those 180, so every candidate is judged against its
   own worst case rather than against a flattering pick. The luminances are
   transcribed here and turned into scoreable greys by greyOfLum(), and the
   three rows they add to the contrast table are printed and NOT judged: there
   is no WCAG floor for "how much does the art separate from the page", and
   inventing one would be worse than showing the number.
   ========================================================================== */
const SCANS = [
  ["black-bolt-172-zekrom-ex", 0.029, "darkest of the 180"],
  ["ascended-heroes-289-steven-s-metagross-ex", 0.197, "the median"],
  ["mega-evolution-188-mega-lucario-ex", 0.484, "p75"],
  ["white-flare-173-reshiram-ex", 0.776, "brightest of the 180"],
];
const SCAN_TOK = {
  "scan-lo": greyOfLum(SCANS[0][1]),
  "scan-mid": greyOfLum(SCANS[1][1]),
  "scan-hi": greyOfLum(SCANS[3][1]),
};

/* ==========================================================================
   THE EIGHT CANDIDATES.

   `t` is the token block. `accents` is the per-section accent rotation, kept
   from gen-fun-palettes.mjs so the two pages render the identical fragment.
   `dark` switches the shadow recipe. `note` is the per-candidate paragraph
   that has to say, in Tim's terms, what moved and what it cost.
   ========================================================================== */
const solid = (name, fill) => [{ name, fill }];

const PALETTES = [
  {
    id: "slushie",
    label: "Baseline",
    name: "Slushie",
    tag: "what you picked, unchanged",
    pitch:
      "Option 2 from the last page, byte for byte, so there is something to compare the seven against.",
    idea:
      "Deep indigo chrome, a yellow primary, magenta for anything you can click, cyan for the second choice. Nothing here has been touched.",
    argument:
      "It is on this page as a control, not as a candidate. Its numbers are the ones the seven have to beat, and the one they all beat is the last column: the Subscribe pill against its own bar at 3.29:1, which is the weakest figure in the whole set and the reason every variation below moved the bar down rather than sideways.",
    fixNote:
      "NOT FIXED, ON PURPOSE. 3.29:1 is what you picked and it is what is drawn here. Every other candidate on this page states its own number in this slot.",
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
    id: "midnight",
    label: "Variation A",
    name: "Slushie Midnight",
    tag: "the dark one, true black",
    pitch:
      "Dark mode the way a phone does it, with the Slushie colours left at full strength on top: a true black page, a deep violet bar, and violet, magenta, cyan and yellow doing the work.",
    idea:
      "The page is #000000, which is what an OLED phone actually turns off, and the bar is a deep violet rather than a grey so the purple still leads at night. Cards are lifted a little off the ground rather than outlined, which is how iOS and Android separate surfaces in the dark. Everything that carried colour in Slushie still carries it; the two that had to move are named in the note below.",
    argument:
      "This is the one that answers the question you asked. Most people land here from a Short, which means they were inside YouTube's dark UI on a phone a second earlier, and Slushie hits them with a full screen of near-white. On a true black ground the site costs an OLED screen almost nothing to draw, the pack art and the set logos are transparent so they take the ground for free, and the card scans separate further from the page than they do on the light version, which is measured three rows down rather than asserted.",
    fixNote:
      "SUBSCRIBE 3.29 -> 4.18:1. The bar goes from #2B1B5A to #150A2A, which is the same violet an octave down. No keyline, no change to the pill.",
    darkNote:
      "THE OFF-WHITE IS #D6D1E6 AND IT IS NOT WHITE. Pure white on pure black measures 21.0:1, which is not a pass so much as a headache: the letterforms bloom into the ground at phone brightness. This is a soft lilac-white at 14.12:1, the band Material's dark theme lands in with its 87%-opacity white, and it is tinted rather than neutral so it belongs to the purple rather than sitting on top of it.",
    moved:
      "TWO THINGS MOVED AND BOTH ARE THE SAME PROBLEM. Purple and magenta are low-luminance hues, so anything of theirs that carries SMALL TEXT breaks on a black ground while still looking fine as a fill. Slushie's link magenta #C1005F measures 3.43:1 on black, which fails the 4.5:1 body-text floor outright, so the link becomes #FF8ACB at 9.75:1: the same hue, walked up instead of down. The section kicker takes #C9A7FF for the same reason. The purple keeps every LARGE job it had, the bar, the card edges, the surfaces, which is where a low-luminance hue is strongest.",
    accents: solid("Violet", "#C9A7FF"),
    dark: true,
    t: {
      ink: "#D6D1E6", "ink-2": "#A79FC6", "ink-soft": "#B5AED2",
      page: "#000000", card: "#0E0A1C",
      paper: "#08060F", "paper-2": "#0E0A1C", "paper-3": "#241C3C",
      hair: "rgba(214,209,230,.18)",
      "navy-deep": "#000000",
      keyline: "#7A6BB2", "chrome-bg": "#150A2A", "on-accent": "#150A2A", "on-alert": "#150A2A",
      "chrome-ink": "#EFEBF8", "chrome-dim": "#B9ADE6", "foot-ink": "#C6BCEC",
      mustard: "#FFD23F", gold: "#FFB000", "gold-deep": "#FFDF7A", "chip-gold-bg": "#3A2C08",
      "brand-accent": "#FFD23F",
      ketchup: "#FF63B0", "ketchup-deep": "#FF8ACB",
      sky: "#35D0E8", "sky-deep": "#35D0E8", "sky-tint": "#0C1D22",
      trubbish: "#2A2140", plum: "#E7CDEF", "lilac-pale": "#1C1430",
    },
  },

  {
    id: "charcoal",
    label: "Variation B",
    name: "Slushie Charcoal",
    tag: "the dark one, soft",
    pitch:
      "The same idea as Midnight without the hard floor: a soft violet-charcoal page instead of true black, so the page reads as a surface rather than as a hole.",
    idea:
      "Page #1D1A29, cards a step above it at #282336, the bar a step below at #1A0F33. Three distinct surfaces you can actually see, which is the thing true black gives up. The accents are Midnight's, one notch cooler.",
    argument:
      "Genuinely different from Midnight rather than a lighter copy of it. True black is the better answer on an OLED phone and the worse one everywhere else: on an LCD phone, a laptop and any screen in a lit room it reads as an empty rectangle, and the shadows that separate a card from the page cannot be seen at all against it, so the layout flattens. This version keeps the shadows working and the surfaces legible, at the cost of whatever an OLED would have saved by drawing nothing at all.",
    fixNote:
      "SUBSCRIBE 3.29 -> 4.00:1. The bar is #1A0F33. Softer everywhere else, but the bar still goes down, because the bar is the only place that number lives.",
    darkNote:
      "THE OFF-WHITE IS #E4E0EE, AND IT IS BRIGHTER THAN MIDNIGHT'S ON PURPOSE. The ground is lifted, so the text can be lifted with it and still land at 13.15:1 rather than at 21, which is the most comfortable body figure of the three grounds on this page. Halation is a function of the GAP between the two, not of how light the text is.",
    moved:
      "THE SAME TWO AS MIDNIGHT AND FOR THE SAME REASON, one step less extreme: the link is #FF8ACB at 7.91:1 on this ground and the kicker is #BE9BF5 at 7.46:1. The purple again keeps the bar, the surfaces and the card edges, which are the large jobs.",
    accents: solid("Violet", "#BE9BF5"),
    dark: true,
    t: {
      ink: "#E4E0EE", "ink-2": "#ADA5C6", "ink-soft": "#BBB3D2",
      page: "#1D1A29", card: "#282336",
      paper: "#221E2F", "paper-2": "#282336", "paper-3": "#37314C",
      hair: "rgba(228,224,238,.18)",
      "navy-deep": "#12101B",
      keyline: "#8072B8", "chrome-bg": "#1A0F33", "on-accent": "#16131F", "on-alert": "#16131F",
      "chrome-ink": "#F2EFFA", "chrome-dim": "#BEB2EA", "foot-ink": "#CAC0EE",
      mustard: "#FFD23F", gold: "#FFB000", "gold-deep": "#FFDF7A", "chip-gold-bg": "#3A2C08",
      "brand-accent": "#FFD23F",
      ketchup: "#FF63B0", "ketchup-deep": "#FF8ACB",
      sky: "#35D0E8", "sky-deep": "#35D0E8", "sky-tint": "#16282E",
      trubbish: "#3A3255", plum: "#E7CDEF", "lilac-pale": "#2A2340",
    },
  },

  {
    id: "light",
    label: "Variation C",
    name: "Slushie Light",
    tag: "lighter and airier",
    pitch:
      "Slushie with the volume down on everything except the bar: a cooler, cleaner page, softer tints, thinner lines, and the same deep purple holding the top and the bottom.",
    idea:
      "The page goes from Slushie's warm cream to a cool near-white, the lilac tints go pale, the hairlines drop from 18% to 14%, and the yellow softens from #FFD23F to #FFDE6B. The bar is the one thing that gets DEEPER, which is what keeps it from reading as washed out and is also what fixes the Subscribe number.",
    argument:
      "The strongest version for the pages that are mostly words: the set guides, the how-to-play page, the rarity chart. Slushie's cream page and heavy magenta are a lot underneath 900 words, and this is the same scheme with room to breathe. Against it: it is the least distinctive candidate here, and 'loud from a thumbnail' was one of the reasons Slushie won in the first place.",
    fixNote:
      "SUBSCRIBE 3.29 -> 3.92:1. The bar is #1E0C40. This is the candidate where the fix and the idea pull against each other, and the bar wins: lightening the bar toward the page takes the pill through 1.31:1 at a mid purple, a hard fail, before it climbs back on the far side.",
    accents: solid("Lilac", "#7C3AED"),
    t: {
      ink: "#1C1730", "ink-2": "#5F587A", "ink-soft": "#5F587A",
      page: "#FFFDFF", card: "#FFFFFF",
      paper: "#FAF6FF", "paper-2": "#FFFFFF", "paper-3": "#EDE6FA",
      hair: "rgba(28,23,48,.14)",
      "navy-deep": "#160A32",
      keyline: "#1C1730", "chrome-bg": "#1E0C40", "on-accent": "#1C1730", "on-alert": "#FFFFFF",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#CDC2F2", "foot-ink": "#DAD2F6",
      mustard: "#FFDE6B", gold: "#FFC53D", "gold-deep": "#6E4A00", "chip-gold-bg": "#FFF3CE",
      "brand-accent": "#FFDE6B",
      ketchup: "#E1077A", "ketchup-deep": "#C4006A",
      sky: "#8FE9F7", "sky-deep": "#0A6A7C", "sky-tint": "#EEFBFD",
      trubbish: "#B8AEE0", plum: "#3E2168", "lilac-pale": "#F8F2FE",
    },
  },

  {
    id: "deep",
    label: "Variation D",
    name: "Slushie Deep",
    tag: "deeper and more saturated",
    pitch:
      "Slushie with the volume up: a real lilac wash on the page instead of cream, a near-black violet bar, and the magenta, cyan and yellow all pushed to the edge of what still measures.",
    idea:
      "The page stops pretending to be white. #F6EEFF is a colour, the panels behind it are a deeper lilac, and the accents go to #E6007E, #00D9F5 and #FFC400. The bar goes almost to black-violet, which is what stops the whole thing turning into a sweet shop and is what carries the Subscribe fix.",
    argument:
      "The most Slushie of the eight and the one that reads loudest from a thumbnail, which was the original argument for the scheme. The cost is that the page ground is now competing with the card scans for attention, and that is the one thing the mono palette was chosen to avoid: on this ground a scan with a pale border has less separation from the page than on any other candidate here, which is in the scan rows below.",
    fixNote:
      "SUBSCRIBE 3.29 -> 4.17:1, the second best number on the page. The bar is #16043A. Turning everything else up made this one easy: the bar had to go down anyway to hold the accents in check.",
    accents: solid("Magenta", "#D6006E"),
    t: {
      ink: "#150A2E", "ink-2": "#4A3A6E", "ink-soft": "#4A3A6E",
      page: "#F6EEFF", card: "#FFFFFF",
      paper: "#EDE1FC", "paper-2": "#FFFFFF", "paper-3": "#DCC9F5",
      hair: "rgba(21,10,46,.22)",
      "navy-deep": "#0E0326",
      keyline: "#150A2E", "chrome-bg": "#16043A", "on-accent": "#150A2E", "on-alert": "#FFFFFF",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#C6B0FF", "foot-ink": "#D4C2FF",
      mustard: "#FFC400", gold: "#FF9E00", "gold-deep": "#6B3D00", "chip-gold-bg": "#FFEDAF",
      "brand-accent": "#FFC400",
      ketchup: "#E6007E", "ketchup-deep": "#B80063",
      sky: "#00D9F5", "sky-deep": "#00606E", "sky-tint": "#D9F8FC",
      trubbish: "#6E4FA8", plum: "#3A0A5E", "lilac-pale": "#F3E6FE",
    },
  },

  {
    id: "indigo",
    label: "Variation E",
    name: "Slushie Indigo",
    tag: "the purple, at the blue end",
    pitch:
      "Slushie with the purple walked toward blue. Same page, same yellow, same magenta, same cyan. Only the purple moves, and everything the purple touches moves with it.",
    idea:
      "The bar goes from #2B1B5A to #0C1440 and the lilac panel tints become periwinkle. Nothing else in the token block changes from Slushie at all, which is the point: this candidate and the next one exist so the purple can be picked on its own terms rather than only as part of a scheme.",
    argument:
      "Blue-violet is the cooler, more serious end of the range, and it is also the end that reads most like software rather than like a wrapper. Set beside Grape it is the more grown-up of the two and the less specific to this channel. Worth knowing before picking: a blue-violet carries more green than a red-violet, so it has to be mixed darker to reach the same measured depth. This bar and Grape's are a hair apart in luminance, 0.0095 against 0.0099, which is why their Subscribe numbers land three hundredths apart from hues two thirds of the wheel away.",
    fixNote:
      "SUBSCRIBE 3.29 -> 3.90:1. The bar is #0C1440. Compare with Grape below at the same visual depth: the hue itself moves this number.",
    accents: solid("Magenta", "#D6006E"),
    t: {
      ink: "#121628", "ink-2": "#4C5270", "ink-soft": "#4C5270",
      page: "#FFFCF7", card: "#FFFFFF",
      paper: "#F0F2FB", "paper-2": "#FFFFFF", "paper-3": "#DCE1F4",
      hair: "rgba(18,22,40,.18)",
      "navy-deep": "#0A1030",
      keyline: "#121628", "chrome-bg": "#0C1440", "on-accent": "#121628", "on-alert": "#FFFFFF",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#B4C0F0", "foot-ink": "#C6CFF4",
      mustard: "#FFD23F", gold: "#FFB000", "gold-deep": "#7A4E00", "chip-gold-bg": "#FFEFB8",
      "brand-accent": "#FFD23F",
      ketchup: "#D6006E", "ketchup-deep": "#C1005F",
      sky: "#35D0E8", "sky-deep": "#0A6A7C", "sky-tint": "#E4F9FC",
      trubbish: "#7C87BE", plum: "#1B2456", "lilac-pale": "#EDF0FA",
    },
  },

  {
    id: "grape",
    label: "Variation F",
    name: "Slushie Grape",
    tag: "the purple, at the magenta end",
    pitch:
      "The same experiment run the other way: the purple walked toward magenta instead of toward blue. Everything else is Slushie, untouched.",
    idea:
      "The bar goes from #2B1B5A to #2C0838 and the panel tints go from lilac to a pale orchid. This is the warmest purple that still measures, and it sits in the same family as the magenta the links already use, so the page reads as one hue with a highlight rather than as two.",
    argument:
      "The more characterful end and the one closer to an actual slushie. It is also the riskier one: warm purple next to YouTube red is a smaller hue step than blue-violet next to it, so the Subscribe pill reads as part of the bar rather than as a thing stuck on it, even though the number is fine. Look at the 390px frame for this one specifically, because that is where the pill and the bar are closest together.",
    fixNote:
      "SUBSCRIBE 3.29 -> 3.87:1. The bar is #2C0838. Practically the same number as Indigo, from a hue two thirds of the wheel away, which is the useful thing this pair demonstrates: the number is about depth and the character is about hue, and they are independent.",
    accents: solid("Magenta", "#D6006E"),
    t: {
      ink: "#1E1024", "ink-2": "#5C4A63", "ink-soft": "#5C4A63",
      page: "#FFFCF7", card: "#FFFFFF",
      paper: "#FAEFFA", "paper-2": "#FFFFFF", "paper-3": "#EFD8EF",
      hair: "rgba(30,16,36,.18)",
      "navy-deep": "#22062C",
      keyline: "#1E1024", "chrome-bg": "#2C0838", "on-accent": "#1E1024", "on-alert": "#FFFFFF",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#DCA8E6", "foot-ink": "#E6BCEE",
      mustard: "#FFD23F", gold: "#FFB000", "gold-deep": "#7A4E00", "chip-gold-bg": "#FFEFB8",
      "brand-accent": "#FFD23F",
      ketchup: "#D6006E", "ketchup-deep": "#C1005F",
      sky: "#35D0E8", "sky-deep": "#0A6A7C", "sky-tint": "#E4F9FC",
      trubbish: "#A87FB0", plum: "#3E0D4C", "lilac-pale": "#FAEEFB",
    },
  },

  {
    id: "cyan",
    label: "Variation G",
    name: "Slushie Cyan",
    tag: "the odd one out: cyan leads the page, purple runs the chrome",
    pitch:
      "The same four colours with three of the four jobs swapped. Cyan takes the primary button, yellow drops to the second choice, links go purple, and the purple bar stays exactly where it is.",
    idea:
      "Slushie leads with indigo chrome and a yellow CTA. Here the CTA is cyan, the secondary is yellow, and the links stop being magenta and become a deep violet instead, which is the first time on this page the purple carries running text rather than a surface. The bar does not change role at all.",
    argument:
      "This is the odd one out and it is on the page to answer a question rather than to win. Two things it shows. One: the purple is stronger as a link than the magenta is, because #5B21B6 at 8.74:1 on this page is calmer under a paragraph than Slushie's #C1005F at 5.98:1 and still unmistakably a link. Two: cyan as the primary is the weakest of the swaps, because cyan and YouTube red are the furthest apart on the page and the CTA ends up competing with Subscribe rather than deferring to it. If you like this one, the half worth keeping is the purple link, which can be dropped into any of the other six without touching anything else.",
    fixNote:
      "SUBSCRIBE 3.29 -> 3.98:1. The bar is #1B0B3E. It is the only token this candidate shares with none of the others and it moved for the same arithmetic reason as all of them.",
    accents: solid("Cyan", "#12C4E0"),
    t: {
      ink: "#0E1A1F", "ink-2": "#3E5A63", "ink-soft": "#3E5A63",
      page: "#F7FDFE", card: "#FFFFFF",
      paper: "#E9F8FB", "paper-2": "#FFFFFF", "paper-3": "#CDEDF3",
      hair: "rgba(14,26,31,.18)",
      "navy-deep": "#08171C",
      keyline: "#0E1A1F", "chrome-bg": "#1B0B3E", "on-accent": "#08171C", "on-alert": "#FFFFFF",
      "chrome-ink": "#FFFFFF", "chrome-dim": "#C0B2F0", "foot-ink": "#CFC4F4",
      mustard: "#5BE3F5", gold: "#12C4E0", "gold-deep": "#00505C", "chip-gold-bg": "#CFF4FA",
      "brand-accent": "#5BE3F5",
      ketchup: "#6D28D9", "ketchup-deep": "#5B21B6",
      sky: "#FFD23F", "sky-deep": "#6B4E00", "sky-tint": "#FFF6DC",
      trubbish: "#8FBECB", plum: "#2A0B52", "lilac-pale": "#EFEAFC",
    },
  },
];

/* ==========================================================================
   THE PAIRS. Every row is a component the fragment actually renders.
   `min` is the AA floor for that ROLE and not one blanket figure: 4.5 for body
   size text (1.4.3), 3.0 for large text and for non-text UI boundaries
   (1.4.11). Anything scored null is measured, printed and not judged.
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
  ["Subscribe label on the pill", "on-yt", "yt-red", 4.5, "fixed, all candidates"],
  ["Subscribe pill against the bar", "yt-red", "chrome-bg", 3.0, "control boundary, the pair Slushie was weakest on"],
  ["Stat tile numeral (large)", "ink", "card", 3.0, "$18,750"],
  ["Stat tile label", "ink-2", "card", 4.5, "HIGHEST SEALED PRICE"],
  ["Ranked row rank numeral", "ink-2", "card", 4.5, "the 1, the 2"],
  ["Ranked row product name", "ink", "card", 4.5, "Legendary Treasures"],
  ["Ranked row price", "ink", "card", 4.5, "$18,750.00"],
  ["Ranked row low line", "ink-2", "card", 4.5, "low $16,000.00"],
  ["CTA label, light end of fill", "on-accent", "mustard", 4.5, "primary button"],
  ["CTA label, dark end of fill", "on-accent", "gold", 4.5, "primary button"],
  ["Secondary button label", "on-accent", "sky", 4.5, "second button"],
  ["Footer body on the chrome", "foot-ink", "chrome-bg", 4.5, "footer nav"],
  ["Footer fan-content line", "foot-ink", "chrome-bg", 4.5, "the required line"],
  ["Keyline against the page", "keyline", "page", 3.0, "card borders"],
  ["Hairline on a card", "hair", "card", null, "decorative divider"],
  /* THE THREE SCAN ROWS. Printed, never judged: there is no WCAG floor for how
     far the art stands off the page, and the number is the whole point. */
  ["Darkest card scan edge against the page", "scan-lo", "page", null, "black-bolt Zekrom ex, measured border lum 0.029"],
  ["Median card scan edge against the page", "scan-mid", "page", null, "the median of 180 scans in the tree, lum 0.197"],
  ["Brightest card scan edge against the page", "scan-hi", "page", null, "white-flare Reshiram ex, lum 0.776"],
];

function score(p) {
  const tok = { ...p.t, ...YT, ...SCAN_TOK };
  return PAIRS.map(([label, fg, bg, min, where]) => {
    const b = tok[bg];
    const f = tok[fg].startsWith("rgba") ? flat(tok[fg], b) : tok[fg];
    const v = r2(f, b);
    return { label, where, f, b, min, v, pass: min === null ? null : v >= min };
  });
}

function accentRows(p) {
  const bg = p.t.page, card = p.t.card;
  return p.accents.map(({ name, fill }) => {
    const { fill: solidFill, on } = labelFill(fill);
    const deep = textOn(fill, bg);
    return {
      name, fill, solid: solidFill, on, deep,
      onV: r2(on, solidFill),
      deepV: r2(deep, bg),
      fillV: r2(fill, card),
      onPass: r2(on, solidFill) >= 4.5,
      deepPass: r2(deep, bg) >= 4.5,
    };
  });
}

/* ==========================================================================
   THE FRAGMENT. The same components gen-fun-palettes.mjs renders, in the same
   order, so a candidate here can be put beside a candidate there without
   allowing for a layout difference. ONE THING IS ADDED: the scan strip, four
   real files from public/assets/cards/, because the question "do the scans
   survive a dark ground" cannot be answered by a drawn rectangle.
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
  const a = p.accents[i % p.accents.length];
  const { fill: solidFill, on } = labelFill(a.fill);
  const deep = textOn(a.fill, p.t.page);
  return `<section class="bandx" style="--acc:${a.fill};--acc-solid:${solidFill};--acc-on:${on};--acc-deep:${deep}">${inner(a)}</section>`;
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
    <span class="sub"><span>Subscribe</span></span>
  </div>
</header>

<!-- The nav accordion, drawn OPEN, because a closed one shows none of the
     colour decisions that matter: the group heading uses --chrome-dim and the
     links use --chrome-ink, and those two against the chrome are where a
     purple chrome usually fails first. -->
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
  <!-- REAL FILES, IDENTICAL BYTES IN ALL EIGHT CANDIDATES. No plate behind
       them, which is what ui.css does at .cs-one-img: the scans carry a border
       of their own and their corners are transparent. -->
  <div class="scanrow">
    <p class="scan-note">Four real card scans &middot; darkest, median, p75 and brightest of the 180 in the tree &middot; identical files in every candidate</p>
    <div class="scans">
      ${SCANS.map(([f, l, w]) => `<img class="scan" src="../public/assets/cards/${f}-pokemon-card-180.webp" width="180" height="248" loading="lazy" alt="${escAttr(w)}, border luminance ${l}">`).join("")}
    </div>
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
   and it adds nothing to assets-source/ui.css.
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
/* --brand-accent, NOT --mustard. ui.css documents this split twice: one token
   was doing two unrelated jobs, the accent word in the wordmark (which sits ON
   the chrome) and the light end of the CTA gradient (which sits on the PAGE
   with dark text on it), and those only coincide while the chrome is dark.
   EVERY CANDIDATE ON THIS PAGE HAS A DARK CHROME, so unlike Yellow Border none
   of them NEEDS the split to be legible. Slushie Cyan is the one that uses it
   anyway: its CTA gradient is cyan and its wordmark accent is a lighter cyan,
   which are different values of the same hue. So the split is still required
   before any of these ships, just for a milder reason than a yellow bar. */
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
/* SUBSCRIBE. The fill and the label are constants in all eight. NO KEYLINE ON
   ANY OF THEM: the bar was moved instead. See SUB_FLOOR in the generator. */
.sub{flex:none;background:var(--yt-red);color:var(--on-yt);font:700 15px/1 var(--body);
  border-radius:999px;padding:0 16px;min-height:44px;display:inline-flex;
  align-items:center;justify-content:center;white-space:nowrap}

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

/* THE SCAN STRIP. No background, no plate, no border: whatever these look like
   is what a real card scan looks like on that palette's page ground. */
.scanrow{margin-top:22px}
.scan-note{font:700 .625rem/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-soft);margin-bottom:9px}
.scans{display:flex;gap:12px;flex-wrap:wrap}
.scan{width:104px;height:auto;aspect-ratio:245/337;border-radius:5px;display:block}

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

/* THE RANKED ROW, from public/most-expensive-sealed.html. */
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
  .scans{gap:10px}
  .scan{width:76px}
}`;

/* One complete standalone document per candidate. A whole document rather than
   a scoped div ON PURPOSE: a media query answers to the VIEWPORT, so the only
   way to see what the 390px layout really does is to give it a 390px
   viewport. */
function doc(p) {
  const tok = { ...p.t, ...YT };
  const vars = Object.entries(tok).map(([k, v]) => `--${k}:${v}`).join(";");
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

function accTable(rows) {
  const body = rows.map((a) => `<tr class="${a.onPass && a.deepPass ? "ok" : "bad"}">
    <td><span class="chipx" style="background:${a.solid};color:${a.on}">${esc(a.name)}</span></td>
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
  const sub = rows.find((r) => r.label === "Subscribe pill against the bar");
  const d = escAttr(doc(p));
  const swatch = Object.entries(p.t).map(([k, v]) =>
    `<span class="sw"><span class="sw-c" style="background:${v}"></span><code>--${k}</code><code class="hex">${v}</code></span>`).join("");

  return `
<section class="opt${p.dark ? " opt-dark" : ""}" id="${p.id}">
  <div class="opt-head">
    <p class="kicker">${esc(p.label)} &middot; ${esc(p.tag)}</p>
    <h2>${esc(p.name)}</h2>
    <p class="pitch">${esc(p.pitch)}</p>
    <p class="idea">${esc(p.idea)}</p>
    <p class="idea"><b>The argument.</b> ${esc(p.argument)}</p>
    <p class="idea fixx"><b>The Subscribe pill.</b> ${esc(p.fixNote)}</p>
    ${p.darkNote ? `<p class="idea warnx"><b>The dark-mode trap.</b> ${esc(p.darkNote)}</p>` : ""}
    ${p.moved ? `<p class="idea warnx"><b>What the purple could not do here.</b> ${esc(p.moved)}</p>` : ""}
    <ul class="stats">
      <li><b>${worst.v.toFixed(2)}:1</b><span>worst scored pair<br>${esc(worst.label)}</span></li>
      <li class="${sub.v >= SUB_FLOOR ? "ok" : "bad"}"><b>${sub.v.toFixed(2)}:1</b><span>Subscribe on the bar<br>Slushie is 3.29</span></li>
      <li class="${fails.length ? "bad" : "ok"}"><b>${fails.length}</b><span>AA failures across<br>${scored.length} component pairs</span></li>
      <li class="${accFails.length ? "bad" : "ok"}"><b>${accFails.length}</b><span>AA failures across<br>${acc.length} accent${acc.length === 1 ? "" : "s"}</span></li>
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
    <summary>Measured contrast for ${esc(p.name)}: ${scored.length} scored component pairs, ${rows.length - scored.length} reference rows, ${acc.length} accent</summary>
    ${pairTable(rows)}
    <p class="tnote">The accent. One row, and the derived text column is computed the same way for every candidate so the numbers are comparable: the accent hue is walked toward black on a light page and toward white on a dark one until it clears 4.5:1 on that candidate's own ground.</p>
    ${accTable(acc)}
  </details>
</section>`;
}).join("\n");

const summary = `<div class="scroller"><table class="ct sum"><thead><tr>
<th>Candidate</th><th class="num">Body copy<br>on page</th><th class="num">Link in<br>running text</th>
<th class="num">Bar text<br>on bar</th><th class="num">Subscribe<br>on bar</th>
<th class="num">Brightest scan<br>vs the page</th>
<th class="num">Worst<br>pair</th><th class="num">AA<br>failures</th></tr></thead><tbody>
${PALETTES.map((p) => {
  const rows = score(p);
  const acc = accentRows(p);
  const scored = rows.filter((r) => r.pass !== null);
  const get = (l) => rows.find((r) => r.label === l).v.toFixed(2);
  const fails = scored.filter((r) => !r.pass).length + acc.filter((a) => !a.onPass || !a.deepPass).length;
  const worst = scored.reduce((a, r) => (r.v < a.v ? r : a)).v.toFixed(2);
  const sub = rows.find((r) => r.label === "Subscribe pill against the bar").v;
  return `<tr><td><a href="#${p.id}"><b>${esc(p.label)}</b> &middot; ${esc(p.name)}</a></td>
  <td class="num">${get("Body copy on the page")}</td>
  <td class="num">${get("Link in running text")}</td>
  <td class="num">${get("Bar text on the bar")}</td>
  <td class="num ${sub >= SUB_FLOOR ? "ok" : "bad"}">${sub.toFixed(2)}</td>
  <td class="num">${get("Brightest card scan edge against the page")}</td>
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
     the header of scripts/gen-slushie-variants.mjs. -->
<meta name="robots" content="noindex,nofollow">
<title>Slushie variations &mdash; Garbage Rips 585 working file</title>
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
.opt-dark{border-top-color:#2B1B5A}
.opt-head{padding:26px 0 20px}
.kicker{font:700 .7rem/1 var(--mono);letter-spacing:.16em;color:var(--sh-dim);
  text-transform:uppercase;margin-bottom:10px}
.opt-head h2{font:400 clamp(1.5rem,4vw,2.2rem)/1.1 var(--display);margin-bottom:10px}
.pitch{max-width:66ch;font-size:1.1rem;color:var(--sh-ink);margin-bottom:14px}
.idea{max-width:72ch;color:var(--sh-dim);margin-bottom:12px;font-size:.95rem}
.idea b{color:var(--sh-ink)}
.warnx{background:#FFF6E5;border-left:4px solid #B87200;padding:12px 14px;
  border-radius:0 6px 6px 0;color:var(--sh-ink)}
.fixx{background:#EFF6FF;border-left:4px solid #2456A8;padding:12px 14px;
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
   frame is left at true size because a phone mockup shrunk is a lie about how
   big the type is, and this site is mobile first. */
.views{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
/* overflow-x ON THE BOX, NOT ON THE BODY: the phone frame is a hard 390px and
   the shell adds 20px of padding either side, so on a 390px screen the whole
   DOCUMENT scrolled sideways. Scaling the frame down would be the wrong fix,
   because the one thing a true-size phone mockup is for is judging how big the
   type really is. So the frame keeps its 390px and its own container scrolls. */
.viewbox{flex:1 1 100%;min-width:0;overflow-x:auto}
.vlabel{font:700 .68rem/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--sh-dim);margin-bottom:8px}
.vlabel span{text-transform:none;letter-spacing:0;font-weight:400;opacity:.85}
/* THE HEIGHTS ARE MEASURED, NOT GUESSED. An iframe with no content-height
   feedback defaults to 150px and a too-short one gives the frame its own
   scrollbar, which would let Tim compare the top third of eight candidates and
   quietly hide the footer on all of them. Driven in headless Chrome over CDP,
   18 August 2026: this fragment renders 2444px tall at a 1440px
   viewport and 2847px at 390px, identical across all eight because
   they share one fragment. Slack is added to each so a font fallback on a
   machine without the woff2 files cannot clip the footer. */
.fr{border:1px solid var(--sh-line);border-radius:10px;background:#fff;display:block}
.scalebox{width:100%;height:1965px;overflow:hidden;border-radius:10px}
.fr-desk{width:1440px;height:2480px;transform:scale(.7917);transform-origin:top left;
  border-radius:12px}
.fr-ph{width:390px;height:2890px;margin:0 auto}
@media(max-width:1220px){
  .scalebox{height:1565px}
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
    <h1>Slushie, seven ways</h1>
    <p><strong>Nothing here ships and nothing here is decided.</strong> This is a working
      file, not a page of the site: it is marked <code>noindex</code>, it lives outside
      <code>public/</code> so the deploy never sees it, and it is not in
      <code>sitemap.xml</code>. <code>assets-source/ui.css</code> is untouched. The live
      palette is exactly what it was this morning.</p>
    <p><strong>The purple is the fixed point.</strong> You said you like the purple in
      Slushie, so all seven variations keep a purple or an indigo leading rather than
      demoting it to an accent. Two of them, <b>Indigo</b> and <b>Grape</b>, change
      nothing but the purple, so you can pick the purple on its own. The last one,
      <b>Slushie Cyan</b>, is the odd one out and it is labelled as such: it hands the
      page to cyan but keeps the purple running the chrome, so you can see the purple in
      a different job rather than see it removed.</p>
    <p>Every candidate renders the <strong>same components</strong>: the header bar with
      the wordmark, the magnifier, Menu and the Subscribe pill; the nav accordion drawn
      open; a rip card; the stat tiles from Rip results; a ranked row from Most expensive
      sealed; the primary and secondary buttons; a heading, body copy and a link in
      running text. Each one is rendered <strong>twice</strong>, at a real 1440px viewport
      and a real 390px viewport, because most people arrive here from a Short and the
      phone is the one that counts.</p>
    <p><strong>Every ratio on this page is computed, not eyeballed.</strong> WCAG 2.1
      floors, applied per role: 4.5:1 for body size text, 3:1 for large text and for a
      control's own boundary. A candidate that fails is not a candidate. All eight below
      have zero failures.</p>
    <p><strong>The one number Slushie was weak on has been fixed in all seven.</strong>
      The Subscribe pill against its own bar measures 3.29:1 on Slushie, which clears the
      3:1 a control's boundary needs and is the lowest figure in the set. The red is a
      constant, so the only lever is the bar, and it only moves one way: a purple bar is
      always darker than YouTube red, so the ratio improves as the bar goes DOWN. Every
      variation here sits between 3.87 and 4.18. None of them needed a keyline round the
      pill, which is the structural fix Yellow Border needed on the last page.</p>
    <p><strong>The card scans were measured rather than argued about, and the earlier
      argument was wrong.</strong> The dark option on the last page claimed the scans are
      "bright rectangles photographed on white". They are not: all 180 scans in the tree
      are edge-to-edge cards with transparent corners and no white plate, and their own
      border luminance runs 0.029 to 0.776 with a median of 0.197, against 1.000 for
      white. Pack art and set logos are fully transparent at every edge. The four real
      scans in the strip on every mockup below are the darkest, the median, the p75 and
      the brightest of those 180, so each candidate is judged on its worst case. The
      "brightest scan vs the page" column in the table is the number that decides it.</p>
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
   THE CROSS CHECK. It throws rather than warns, for the reason this repo keeps
   relearning: a decision aid that has quietly stopped describing the thing it
   claims to describe is worse than no decision aid.

   THE BASELINE HERE IS NOT ui.css. It is the Slushie entry in
   gen-fun-palettes.mjs, because that is the thing Tim actually picked and the
   thing these seven are variations ON. If that file's Slushie is edited and
   this one's is not, the "what you picked" column stops being what he picked
   and every "3.29 -> x" claim on the page becomes a comparison against a
   palette nobody chose.
   ========================================================================== */
async function checkSlushie() {
  const src = await readFile(join(ROOT, "scripts/gen-fun-palettes.mjs"), "utf8");
  const i = src.indexOf('id: "pop"');
  if (i < 0) throw new Error("gen-fun-palettes.mjs no longer has a palette with id \"pop\" (Slushie). This file's baseline has nothing to check against.");
  const block = src.slice(i, src.indexOf("\n  },", i));
  const bad = [];
  for (const [k, v] of Object.entries(PALETTES[0].t)) {
    const m = new RegExp(`(?:^|[{;\\s])"?${k.replace(/[-]/g, "\\-")}"?\\s*:\\s*("[^"]+"|[^,\\n]+)`, "m").exec(block);
    if (!m) { bad.push(`--${k}: not found in the Slushie block of gen-fun-palettes.mjs`); continue; }
    const live = m[1].replace(/^"|"$/g, "").trim();
    if (live.toLowerCase() !== v.toLowerCase()) bad.push(`--${k}: gen-fun-palettes.mjs has ${live}, this file says ${v}`);
  }
  if (bad.length) {
    throw new Error(
      "The Slushie baseline has drifted from scripts/gen-fun-palettes.mjs:\n  " + bad.join("\n  ") +
      "\nFix PALETTES[0] here so the baseline is really the thing Tim picked."
    );
  }
}

/* THE SUBSCRIBE FLOOR IS ASSERTED, NOT HOPED FOR. The whole premise of this
   page is that every variation improves the pair Slushie was weakest on, and
   that sentence is printed on the page eight times. If a later edit lightens a
   bar and quietly drops the number back under Slushie's, the page would go on
   claiming the fix while no longer delivering it. */
function checkSubscribe() {
  const bad = [];
  for (const p of PALETTES) {
    if (p.id === "slushie") continue;
    const v = r2(YT["yt-red"], p.t["chrome-bg"]);
    if (v < SUB_FLOOR) bad.push(`${p.name}: Subscribe on the bar is ${v.toFixed(2)}:1, under the ${SUB_FLOOR}:1 floor this page claims (${p.t["chrome-bg"]})`);
  }
  if (bad.length) throw new Error("A candidate no longer beats Slushie's weakest pair by the margin this page claims:\n  " + bad.join("\n  "));
}

await checkSlushie();
checkSubscribe();
await writeFile(join(ROOT, "assets-source/slushie-variants-preview.html"), html);

console.log("Wrote assets-source/slushie-variants-preview.html");
console.log(`  ${PALETTES.length} candidates, ${PAIRS.length} pairs each, 2 viewports each`);
console.log("  cross-check passed: the Slushie baseline matches gen-fun-palettes.mjs\n");
let total = 0;
for (const p of PALETTES) {
  const all = score(p);
  const rows = all.filter((r) => r.pass !== null);
  const acc = accentRows(p);
  const fails = rows.filter((r) => !r.pass);
  const accFails = acc.filter((a) => !a.onPass || !a.deepPass);
  total += fails.length + accFails.length;
  const worst = rows.reduce((a, r) => (r.v < a.v ? r : a));
  const g = (l) => all.find((r) => r.label === l).v.toFixed(2);
  console.log(
    `  ${p.label.padEnd(11)} ${p.name.padEnd(18)} worst ${worst.v.toFixed(2)} (${worst.label}) | ` +
      `sub ${g("Subscribe pill against the bar")} | body ${g("Body copy on the page")} | link ${g("Link in running text")} | ` +
      `bright scan ${g("Brightest card scan edge against the page")} | ${fails.length + accFails.length} AA fails`
  );
  for (const r of fails) console.log(`      FAIL  ${r.label}: ${r.v.toFixed(2)} < ${r.min} (${r.f} on ${r.b})`);
  for (const a of accFails) console.log(`      FAIL  accent ${a.name}: label ${a.onV.toFixed(2)}, text ${a.deepV.toFixed(2)}`);
}
console.log(`\n  ${total} AA failures in total across all ${PALETTES.length} candidates.`);
