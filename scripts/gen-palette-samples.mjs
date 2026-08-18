/**
 * Writes FIVE copies of the REAL home page under public/, one per palette Tim
 * is choosing between:
 *
 *     public/preview-midnight.html      A  Slushie Midnight
 *     public/preview-charcoal.html      B  Slushie Charcoal          <- baseline
 *     public/preview-charcoal-a.html    C  Charcoal Aqua
 *     public/preview-charcoal-b.html    D  Charcoal Quiet
 *     public/preview-trubbish.html      E  Trubbish
 *
 *     node scripts/gen-palette-samples.mjs
 *
 * WHY THIS EXISTS. Tim, 18 August 2026, on Variation A (Slushie Midnight) and
 * Variation B (Slushie Charcoal) from scripts/gen-slushie-variants.mjs: "I like
 * both of A and B can you moc up one sample pages in each that I can view on my
 * phone to see what I like better".
 *
 * THEN HE PICKED CHARCOAL AND NAMED TWO THINGS ON IT: "I love the charcoal
 * version but the pink and yellow watch text is throwing me off, I think the
 * yellow text on the purple is looking kind of strange too, can you try another
 * version of Charcoal with those changed to other colors to try". Followed by
 * "you can give me two variants on charcoal with other color schemes, but
 * similar idea just try some other contrasting colors".
 *
 * SO THE GROUND IS SETTLED AND IS NOT REOPENED HERE. C and D carry Charcoal's
 * thirty tokens UNCHANGED, byte for byte the same block B gets, and differ from
 * it only in the two accent rules at the foot of each palette block. He is
 * choosing an accent, so nothing else may vary or the comparison is worthless.
 *
 * AND THEN THE MASCOT: "would be interesting to try a sample page in the colors
 * of our mascott pokemon Trubbish, here are his colors to test on one page as
 * well", with five hexes. E is that page. It is the only one of the five with a
 * reason to exist beyond taste: the channel is called Garbage Rips, the pack art
 * is a Trubbish on a plate of trash, and the og:image on this very page is
 * described as "Trubbish sitting on a Rochester sidewalk".
 *
 * THE PHONE IS THE WHOLE POINT, WHICH IS WHY THESE SHIP AND THE OTHER THREE
 * PREVIEW FILES DO NOT. assets-source/*-preview.html is a working file opened
 * off disk; a phone cannot open a file off this laptop's disk. So these go
 * under public/, get pushed, and are reachable at a real url. That is a
 * deliberate exception to the rule gen-fun-palettes.mjs, gen-palette-preview.mjs
 * and gen-slushie-variants.mjs all state in their headers, and it is bought with
 * the four guards below rather than waved through.
 *
 *   1. All five carry <meta name="robots" content="noindex,nofollow">, and the
 *      canonical, og:url and JSON-LD are STRIPPED rather than left pointing at
 *      the real home page. A duplicate of / claiming to be / is the one way a
 *      throwaway page can cost the real site something.
 *   2. None is in sitemap.xml. That list is hand written in build-pages.mjs
 *      and nothing was added to it; check-build.py fails the build on any
 *      noindex page that turns up there, so it is checked rather than trusted.
 *   3. NOTHING LINKS TO THEM. Not the nav, not the footer, not a built page.
 *      They link to EACH OTHER in a RING and to nothing else, which is the one
 *      link Tim asked for so he can flip between them on the phone without
 *      retyping a url. The ring closes, so five taps from any page returns you
 *      to it and no page is a dead end.
 *   4. assets-source/ui.css is not touched and neither is the built copy. Each
 *      palette is a token block in that page's OWN <style>, appended after the
 *      stylesheet link so it wins on source order at equal specificity. Every
 *      other page on the site is byte identical after this script runs.
 *
 * ============================ DELETE THESE BEFORE LAUNCH ====================
 * These are five extra copies of the front door sitting in the deploy root
 * three days before the site goes live. Once Tim has picked, delete all five,
 * delete this script, and re-run the build:
 *
 *     rm public/preview-midnight.html public/preview-charcoal.html \
 *        public/preview-charcoal-a.html public/preview-charcoal-b.html \
 *        public/preview-trubbish.html
 *     rm scripts/gen-palette-samples.mjs
 *     node scripts/build-all.mjs
 *
 * The reminder is also in LAUNCH.md, under "Before flipping it on", because a
 * comment in a file nobody opens is not a reminder.
 * ===========================================================================
 *
 * DELIBERATELY NAMED gen- RATHER THAN build- OR stamp-. check-build.py fails on
 * any scripts/build-* or scripts/stamp-* that build-all.mjs does not run, and
 * build-all.mjs must NOT run this: it writes pages that are going to be
 * deleted, and wiring them into the nightly is how a temporary file becomes
 * permanent. The staleness check in check-build.py only weighs scripts that
 * build-all runs, so this file's mtime cannot report the tree as stale either.
 *
 * IT REGENERATES FROM public/index.html EVERY RUN, so it must be run AFTER
 * build-all.mjs. Run it before and you get five previews of the previous build.
 *
 * THE SLUSHIE TOKEN VALUES ARE READ OUT OF gen-slushie-variants.mjs, NOT COPIED
 * FROM IT. Transcribing 30 hexes five times is how the preview and the sample
 * quietly stop being the same colour, and that would make this page a liar
 * about the exact thing it is being used to decide. That file has no exports
 * and writes a file at import time, so importing it would rewrite
 * assets-source/ and report every page in the tree as stale; readBlock() parses
 * the source text instead. The ONE new hex C and D need, the violet Charcoal
 * already declares as its own accent, is parsed out of the same file for the
 * same reason rather than typed here.
 *
 * EVERY RATIO IN THE REPORT IS COMPUTED AT THE BOTTOM OF THIS FILE AND THROWS
 * ON A FAILURE. A palette sample that quietly ships an illegible accent is
 * worse than one that refuses to build, because the illegible one gets picked.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEN = join(ROOT, "scripts/gen-slushie-variants.mjs");
const src = await readFile(GEN, "utf8");

/* ==========================================================================
   WCAG ARITHMETIC. Used by the self-check at the foot of this file and by the
   derivation of Trubbish's tokens, so no number in either is asserted.
   ========================================================================== */
const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (c) => {
  const [r, g, b] = (typeof c === "string" ? hex(c) : c).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/* src over dst at alpha a, so a translucent overlay is measured rather than
   guessed at. .hof paints a gold bloom over the bar and that bloom is the true
   ground under the section heading Tim pointed at. */
const over = (s, d, a) => {
  const [x, y] = [hex(s), hex(d)];
  return x.map((v, i) => Math.round(v * a + y[i] * (1 - a)));
};
const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join("");
const fmt = (n) => n.toFixed(2) + ":1";

/* ==========================================================================
   READING THE PALETTES OUT OF THE GENERATOR.

   Each candidate there is `{ id: "midnight", ..., t: { ...30 tokens } }`. The
   object literal uses a mix of bare and quoted keys, so it is evaluated rather
   than JSON.parsed. This is a local build script reading a file from its own
   repo, so there is nothing here to be careful about that a `git diff` is not
   already careful about.

   IT THROWS RATHER THAN FALLING BACK. A missing block means somebody renamed or
   removed a candidate, and the wrong answer to that is five sample pages
   quietly wearing last week's colours.
   ========================================================================== */
function blockOf(id) {
  const at = src.indexOf(`id: "${id}"`);
  if (at < 0) throw new Error(`gen-slushie-variants.mjs has no candidate id:"${id}" any more`);
  return at;
}
function readBlock(id) {
  const at = blockOf(id);
  const tAt = src.indexOf("t: {", at);
  if (tAt < 0) throw new Error(`candidate "${id}" has no t: block`);
  // Brace matching from the "{" of `t: {`. The token block holds no braces of
  // its own and no strings containing one, so counting is enough here.
  const open = src.indexOf("{", tAt);
  let depth = 0, end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) { end = i; break; }
  }
  if (end < 0) throw new Error(`candidate "${id}" has an unclosed t: block`);
  const t = new Function(`return (${src.slice(open, end + 1)})`)();
  const n = Object.keys(t).length;
  if (n < 25) throw new Error(`candidate "${id}" parsed to only ${n} tokens, expected ~30`);
  return t;
}
/* Each candidate declares the ONE colour it considers its own accent, as
   `accents: solid("Violet", "#BE9BF5")`. Variant D wants exactly that colour
   and nothing new, so it is read from there rather than typed again here. */
function readAccent(id) {
  const at = blockOf(id);
  const m = /accents:\s*solid\("[^"]+",\s*"(#[0-9A-Fa-f]{6})"\)/.exec(src.slice(at, at + 4000));
  if (!m) throw new Error(`candidate "${id}" no longer declares accents: solid(name, hex)`);
  return m[1].toUpperCase();
}

/* The Subscribe constants. #EE0000 with a white label, fixed in all eight
   candidates and fixed here: it is the one control on the page that is not a
   palette choice. Read from the generator for the same reason the tokens are. */
const ytBlock = /const YT = \{([^}]*)\}/.exec(src);
if (!ytBlock) throw new Error("gen-slushie-variants.mjs no longer defines YT");
const YT = new Function(`return ({${ytBlock[1]}})`)();
if (YT["yt-red"] !== "#EE0000" || YT["on-yt"] !== "#FFFFFF") {
  throw new Error(`Subscribe moved: ${JSON.stringify(YT)}. It is not a palette choice.`);
}

/* The dark shadow recipe, out of doc()'s `lift` ternary. Every candidate here
   is a dark one, so all five take the first arm. ui.css spells this token
   --lift and every card, tile and shelf on the home page reads it. */
const liftM = /const lift = p\.dark\s*\n?\s*\?\s*"([^"]+)"/.exec(src);
if (!liftM) throw new Error("gen-slushie-variants.mjs no longer defines the dark lift recipe");
const DARK_LIFT = liftM[1];

const CHARCOAL = readBlock("charcoal");
const CHARCOAL_ACCENT = readAccent("charcoal");

/* ==========================================================================
   TRUBBISH, AND IT IS THE ONLY PALETTE ON THIS PAGE THAT IS NOT READ FROM
   SOMEWHERE ELSE, BECAUSE IT DID NOT EXIST BEFORE TIM SENT IT.

   His five, verbatim, 18 August 2026:
     Dark Bag Green    #2F4F39   deep olive/hunter green, the main body
     Dark Teal Feet    #1F382B   muted dark green-gray, the stubby feet
     Accent Pink       #E87EA1   spilling debris, mouth accents
     Accent Light Blue #70B5D9   exposed protruding waste
     Mouth / eyes      #FFFFFF and #231F20

   All five are below as constants and every other value in the block is
   DERIVED from one of them by a stated move, so there is no second palette
   here to drift.

   WHICH GREEN IS WHICH SURFACE. Charcoal's shape is bar < page < card: three
   surfaces you can actually see, and the argument for it over Midnight is that
   the shadow separating a card from the page is invisible on a true black. Tim's
   two greens land on that shape almost exactly in the order feet-then-bag: the
   card ends up 1.97x the page's luminance where Charcoal's is 1.65x. Taken the
   other way round, with the bag green as the page, there is nothing left to make
   a card out of that is not lighter than either colour he sent. So the feet
   green is the page, the bag green is the card, and the bar is derived.

   THE BAR IS ARITHMETIC AND NOT TASTE, and this is the one place Tim's palette
   could not be used as sent. gen-slushie-variants.mjs states the rule: the
   Subscribe red is a constant at luminance 0.1818, every dark bar is below it,
   so the pill's boundary against the bar is (0.1818 + 0.05) / (barLum + 0.05)
   and it only improves as the bar goes DOWN. RED ON GREEN IS THE ONE PAIR WHERE
   THIS BITES, because the two hues sit close in luminance: the pill measures
   2.02:1 on the bag green and 2.79:1 on the feet green, and BOTH FAIL the 3:1
   a control boundary needs. The feet green is scaled down 80% instead, which
   holds the hue and the saturation exactly where Tim put them and buys 3.22:1.
   A blend toward his outline colour was tried first and rejected: it reaches the
   same number by walking the green grey, and the point of this page is the
   green. The keyline round the pill, which is the structural fix the Yellow
   Border candidate needed, is again NOT used, for the reason that file gives.

   THE OFF-WHITE IS #EEF1EF AND IT IS TINTED, but not for Midnight's reason.
   Midnight's headache was pure white on pure black at 21.0:1; nothing here gets
   near that, because white on the lightest surface of this palette is 9.14:1,
   which is already inside the comfortable band. So this is not a legibility fix
   and is not claimed as one. It is 8% of the bag green mixed into white, which
   costs 1.1 points of contrast and makes the ink belong to the ground instead
   of sitting on top of it. Tim's #FFFFFF keeps the job he gave it, teeth, which
   on this page means the Subscribe label.

   GOLD STAYS GOLD AND THAT IS A DECISION, NOT AN OVERSIGHT. --mustard and
   --gold are the same values here as in Charcoal and Midnight, because on this
   site they are not a palette choice either: they are the wordmark accent, the
   fill of every CTA, the HALL OF FAME HIT badge and the 4px frame round the
   trophy. Tim's screenshot showed the badge and the frame in gold and he did not
   complain about them. The mascot palette has no yellow in it, so this is the
   one place the two schemes are simply layered rather than merged, and it is
   worth looking at on the page rather than deciding here.
   ========================================================================== */
const TRUB = { bag: "#2F4F39", feet: "#1F382B", pink: "#E87EA1", blue: "#70B5D9",
               white: "#FFFFFF", outline: "#231F20" };

/* the feet green scaled to 80%, which is the first step that clears 3:1 with
   margin rather than by a rounding error */
const scale = (c, k) => toHex(hex(c).map((v) => Math.round(v * k)));
const TRUB_BAR = scale(TRUB.feet, 0.80);
/* the smallest lift, toward white and in the same hue, that carries each accent
   through 4.5:1 on the CARD. The card is the lightest ground ui.css puts a link
   on: .mw-head a, .wdrop-more a and .pl-out are all --card or --paper-2. Tim's
   exact values keep every LARGE job, which is both of the two he named. */
function liftTo(c, ground, target) {
  for (let a = 0; a <= 80; a += 2) {
    const w = toHex(over(TRUB.white, c, a / 100));
    if (ratio(w, ground) >= target) return w;
  }
  throw new Error(`${c} cannot reach ${target}:1 on ${ground} without going white`);
}
const TRUB_PINK_SM = liftTo(TRUB.pink, TRUB.bag, 4.5);
const TRUB_BLUE_SM = liftTo(TRUB.blue, TRUB.bag, 4.5);

const TRUBBISH = {
  ink: toHex(over(TRUB.bag, TRUB.white, 0.08)),
  "ink-2": toHex(over(TRUB.bag, TRUB.white, 0.26)),
  "ink-soft": toHex(over(TRUB.bag, TRUB.white, 0.20)),
  page: TRUB.feet,
  card: TRUB.bag,
  paper: toHex(over(TRUB.bag, TRUB.feet, 0.45)),
  "paper-2": TRUB.bag,
  "paper-3": toHex(over(TRUB.white, TRUB.bag, 0.08)),
  hair: `rgba(${hex(toHex(over(TRUB.bag, TRUB.white, 0.08))).join(",")},.18)`,
  "navy-deep": scale(TRUB.feet, 0.62),
  keyline: toHex(over(TRUB.white, TRUB.bag, 0.42)),
  "chrome-bg": TRUB_BAR,
  "on-accent": TRUB.outline,
  "on-alert": TRUB.outline,
  "chrome-ink": toHex(over(TRUB.bag, TRUB.white, 0.04)),
  "chrome-dim": toHex(over(TRUB.bag, TRUB.white, 0.30)),
  "foot-ink": toHex(over(TRUB.bag, TRUB.white, 0.22)),
  // unchanged from Charcoal on purpose; see the gold paragraph above
  mustard: CHARCOAL.mustard, gold: CHARCOAL.gold,
  "gold-deep": CHARCOAL["gold-deep"], "chip-gold-bg": CHARCOAL["chip-gold-bg"],
  "brand-accent": CHARCOAL["brand-accent"],
  ketchup: TRUB.pink, "ketchup-deep": TRUB_PINK_SM,
  sky: TRUB.blue, "sky-deep": TRUB_BLUE_SM,
  "sky-tint": toHex(over(TRUB.blue, scale(TRUB.feet, 0.62), 0.14)),
  // --trubbish is the site's HARD SHADOW colour, `box-shadow: Npx Npx 0 var(--trubbish)`
  // in twelve places. Tim's outline colour is exactly that job.
  trubbish: TRUB.outline,
  plum: toHex(over(TRUB.white, TRUB.pink, 0.55)),
  "lilac-pale": toHex(over(TRUB.pink, scale(TRUB.feet, 0.62), 0.16)),
};

/* ==========================================================================
   THE GAP BETWEEN THE TOKEN SETS, AND IT IS THE ONLY PLACE THIS FILE HAS AN
   OPINION ABOUT A COLOUR IT WAS NOT GIVEN.

   The generator renders its own fragment against its own 30 tokens. The real
   home page renders against ui.css, which defines more and uses a handful the
   generator never had to name. Those extras are DERIVED from tokens the
   generator does supply rather than picked, so there is no second palette here
   to drift out of step:

     --navy      ui.css has it at #111111 in the shipped mono palette, the same
                 value as --ink, --keyline and --chrome-bg, which is exactly how
                 it stayed unnoticed. On the home page its only job is
                 `.soc svg{fill:var(--navy)}`, the four footer social glyphs,
                 sitting on a `--paper-2` tile. So it takes --ink. NOTE FOR
                 ANYBODY SHIPPING ONE OF THESE PALETTES FOR REAL: --navy is also
                 a BACKGROUND in .next-show, .fk-golden and .cc-table on other
                 pages, with `color:var(--paper)` on top, and one value cannot
                 do both jobs on a dark ground. Splitting it is real work and it
                 is not done here, because these five files render one page.
     --lilac     ui.css defines it equal to --sky in the shipped palette, and
                 uses it once, for a quote rule. Takes --sky.
     --sky-lite  the light end of one gradient whose dark end is --sky. Takes
                 --sky-tint, which is the tint the generator does supply.
     --teal      one hover border. Takes --sky, its neighbour in ui.css.

   --hard-lg and --line are already `var(--keyline)` in ui.css, so they follow
   the keyline for free. --gold-band-label is text drawn on --gold, and --gold
   is #FFB000 in all five, so it keeps its value: #332500 on #FFB000 is 7.63:1
   and moving it would be a change for its own sake.
   ========================================================================== */
function tokensFor(t) {
  return {
    ...t,
    ...YT,
    navy: t.ink,
    lilac: t.sky,
    "sky-lite": t["sky-tint"],
    teal: t.sky,
    lift: DARK_LIFT,
  };
}

/* ==========================================================================
   THE TWO ACCENT RULES, WHICH ARE THE ENTIRE DIFFERENCE BETWEEN B, C AND D.

   WHAT TIM POINTED AT, both of them on the home page at 390px:

   1. `.hl`, the highlighted word inside a heading. ui.css draws it
      `color:var(--ketchup-deep); text-shadow:2px 2px 0 var(--mustard)`, which
      on Charcoal is #FF8ACB with a hard #FFD23F offset behind it: his "pink and
      yellow watch text". THE MEASUREMENT SAYS THE TREATMENT IS THE FAULT AND
      NOT EITHER HUE. The pink reads 7.05:1 against the card it sits on and the
      yellow reads 10.51:1, so both are individually fine; the pink against its
      own stamp is 1.49:1. Two saturated colours a rounding error apart in
      luminance, 2px apart on the screen, so the yellow does not read as a
      shadow behind the word, it reads as a coloured blur around it. That is why
      C keeps the stamp and changes what it is made of, and D drops it entirely:
      between them they answer whether the treatment or the palette is wrong,
      which is a thing a page can settle and an argument cannot.

   2. The "Greatest Hits" heading and the "All 10 hits ->" link beside it, both
      `color:var(--mustard)` on the `.hof` band, whose ground is --chrome-bg:
      his "yellow text on the purple". THE FOOTER'S "Grab a fork. Let's rip."
      IS THE SAME COLOUR ON THE SAME GROUND and moves with them in every variant
      here, even though he named only the two. Leaving it yellow while the
      heading above it turned would have put the fault back on the page in a
      second place and invited the same note again.

   WHAT DOES NOT MOVE, and it is written down because --mustard is doing double
   duty and changing the token would have swept all of this along with it: the
   wordmark accent in the bar, every CTA fill, the HALL OF FAME HIT badge, the
   4px gold frame round the trophy, the gold bloom over the band and the gold
   rule under it. His screenshot showed the badge and the frame and he did not
   complain about either. So these are CSS rules against the two elements he
   named, not a token change, and --mustard is identical in all five files.

   SPECIFICITY. `.hl` is 0,1,0 and `.hof-head h2` is 0,1,1, the same as ui.css's
   own rules for them, so these win on SOURCE ORDER from the page's own <style>
   block. That is deliberate rather than lazy: ui.css also carries
   `.fk-golden .hl` and `section.band-gold .hl` at 0,2,0 and 0,2,1 for two bands
   that paint themselves gold, and raising the specificity here to be safe would
   silently clobber both. Neither band is on the home page, but these rules are
   written the way they would have to be written to ship.
   ========================================================================== */
const accentCss = (o) => `
/* THE TWO ACCENTS, and the only thing that differs from sample B. */
.hl{color:${o.hl};text-shadow:${o.hlShadow}}
.hof-head h2,.foot-tag{color:${o.heading}}
.hof-head a{color:${o.link}}`;

const SAMPLES = [
  {
    file: "preview-midnight.html",
    label: "A",
    name: "Slushie Midnight",
    note: "the first dark one, true black",
    t: readBlock("midnight"),
  },
  {
    file: "preview-charcoal.html",
    label: "B",
    name: "Slushie Charcoal",
    note: "the one you picked, unchanged. This is what C, D and E are against.",
    t: CHARCOAL,
  },
  {
    file: "preview-charcoal-a.html",
    label: "C",
    name: "Charcoal Aqua",
    note: "Charcoal exactly, with the cyan already in the palette doing both accent jobs.",
    t: CHARCOAL,
    /* Cyan is the natural contrast against purple and it is already Slushie's
       own --sky, so nothing new enters the scheme. The stamp behind .hl stays,
       because a hard offset is a real part of this site's look, but it is made
       of --navy-deep, the palette's own deepest value: a shadow the colour of a
       shadow. Cyan against that stamp is 15.7:1 where the pink against the
       yellow was 1.49:1, which is the whole complaint answered without giving
       up the treatment. */
    accents: {
      hl: "var(--sky)",
      hlShadow: "2px 2px 0 var(--navy-deep)",
      heading: "var(--sky)",
      link: "var(--sky)",
    },
  },
  {
    file: "preview-charcoal-b.html",
    label: "D",
    name: "Charcoal Quiet",
    note: "Charcoal exactly, with white headings and ONE accent, and the stamp gone.",
    t: CHARCOAL,
    /* The other hypothesis: that neither colour is wrong and TWO saturated
       accents fighting is the whole of it. So the section headings go to the
       palette's own near-white, colour is spent only on the small link and the
       highlighted word, the stamp behind .hl is dropped so it is a single
       coloured word, and the one accent is the violet Charcoal ALREADY declares
       as its accent, read out of the generator. D introduces no new colour at
       all: every value on this page is one Charcoal had already argued for. */
    accents: {
      hl: CHARCOAL_ACCENT,
      hlShadow: "none",
      heading: "var(--chrome-ink)",
      link: CHARCOAL_ACCENT,
    },
  },
  {
    file: "preview-trubbish.html",
    label: "E",
    name: "Trubbish",
    note: "the mascot's own colours. Green ground, pink highlight, blue headings.",
    t: TRUBBISH,
    /* PINK AND BLUE TAKE ONE ROLE EACH AND DO NOT MIX INSIDE ONE WORD, which is
       exactly the thing Tim flagged. Pink is his "spilling debris, mouth
       accents", which is what an inline highlight is, and it takes .hl. Blue is
       his "exposed protruding waste", a larger structural thing, and it takes
       the section headings and the small link beside them. THE NUMBERS AGREE
       WITH THE MEANING, which is why it is this way round rather than the
       other: the heading role includes a SMALL link at a 4.5:1 gate and the
       .hl role is large text at 3:1, so the safer of the two colours takes the
       stricter role. The stamp behind .hl is Tim's own outline #231F20, which
       is the job he gave that colour and is why this variant can keep the
       treatment C keeps without reintroducing his complaint. */
    accents: {
      hl: "var(--ketchup)",
      hlShadow: "2px 2px 0 var(--trubbish)",
      heading: "var(--sky)",
      link: "var(--sky)",
    },
  },
];

/* ==========================================================================
   THE FLIP CONTROL.

   One fixed pill at the foot of the screen saying which palette you are looking
   at and offering the next one. It is the single thing that makes five urls
   useful rather than annoying on a phone, and it is the only link on any of
   these pages that does not exist on the real home page.

   IT IS A RING, NOT A LIST. Each page points at the next and the last points
   back at the first, so there is no dead end and no "back" to find on a phone.

   IT IS BUILT NOT TO LIE ABOUT THE PALETTE IT SITS ON. Every colour in it is a
   literal, not a token, so it reads the same on all five grounds and cannot be
   mistaken for part of the design being judged. `left:50%;translateX(-50%)`
   with a max-width rather than `left:0;right:0`, so it cannot widen the
   document; `env(safe-area-inset-bottom)` keeps it off the iPhone home
   indicator; and body gets bottom padding so it never covers the footer's last
   line.
   ========================================================================== */
const swapCss = `
/* PREVIEW CHROME. Not part of any palette. Deleted with these files. */
.pvbar{position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:200;
  max-width:min(560px,calc(100vw - 20px));width:max-content;
  margin-bottom:calc(10px + env(safe-area-inset-bottom,0px));
  display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;
  border-radius:999px;background:rgba(20,20,22,.94);border:1px solid rgba(255,255,255,.28);
  box-shadow:0 6px 22px rgba(0,0,0,.55);backdrop-filter:blur(6px)}
.pvbar b{font:700 12px/1.2 'Space Mono',ui-monospace,monospace;letter-spacing:.06em;
  color:#FFFFFF;text-transform:uppercase;white-space:nowrap}
/* 44px, which is the tap target the real bar holds to. It was 36 and that is
   the wrong size for the one control on this page that exists to be tapped. */
.pvbar a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;
  border-radius:999px;background:#FFFFFF;color:#141416;text-decoration:none;
  font:700 13px/1.1 'Outfit',system-ui,sans-serif;white-space:nowrap}
.pvbar a:hover,.pvbar a:focus-visible{background:#E4E4E8}
body{padding-bottom:76px}
@media(max-width:400px){
  .pvbar{gap:8px;padding:7px 8px 7px 12px}
  .pvbar b{font-size:11px}
  .pvbar a{font-size:12px;padding:0 12px}
}`;

const swapHtml = (s, next) =>
  `<div class="pvbar" role="group" aria-label="Palette sample switcher">` +
  `<b>${s.label} &middot; ${s.name}</b>` +
  `<a href="/${next.file}">Next: ${next.label} &middot; ${next.name} &rarr;</a>` +
  `</div>`;

/* ==========================================================================
   THE PAGE.

   A transform of the BUILT home page rather than a rebuild of it, so the drops
   band, the Hall of Fame trophy, the carousels, the Pokedex band, the tool grid
   and the footer are the real markup with the real card art in them. All five
   sit at the deploy root exactly like index.html, so every relative asset path
   in it resolves unchanged.
   ========================================================================== */
const home = await readFile(join(ROOT, "public/index.html"), "utf8");

function build(s, next) {
  let h = home;

  // 1. Nothing about this page may claim to be the home page. Canonical,
  //    og:url and both JSON-LD blocks come out; robots goes in high in <head>
  //    so it is the first thing a crawler reads.
  h = h.replace(/^.*<link rel="canonical"[^>]*>\n/m, "");
  h = h.replace(/^.*<meta property="og:url"[^>]*>\n/m, "");
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, "");
  h = h.replace(
    /<meta name="viewport"([^>]*)>/,
    `<meta name="viewport"$1>\n<meta name="robots" content="noindex,nofollow">`
  );
  if (!/name="robots" content="noindex,nofollow"/.test(h)) {
    throw new Error("robots meta was not inserted: the viewport tag moved");
  }
  if (/rel="canonical"|og:url|application\/ld\+json/.test(h)) {
    throw new Error("canonical, og:url or JSON-LD survived the strip");
  }

  // 2. Say what it is in the tab and in the share card, so a screenshot of one
  //    of these cannot be mistaken for the real site.
  h = h.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>Palette sample ${s.label}: ${s.name} &mdash; Garbage Rips 585 home page</title>`
  );
  h = h.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="Temporary palette sample. The Garbage Rips 585 home page drawn in ${s.name}. Not a real page of the site.">`
  );

  const tok = tokensFor(s.t);

  // 3. The browser chrome colour on a phone follows the bar, or the sample is
  //    framed in the old palette's near-black on the very device it is for.
  h = h.replace(
    /<meta name="theme-color" content="[^"]*">/,
    `<meta name="theme-color" content="${tok["chrome-bg"]}">`
  );

  // 4. The palette itself, last in <head>. Same specificity as ui.css's :root
  //    and ui.css's second :root, so source order decides and this wins. The
  //    <style> block build-proto.mjs writes into this page is above it too.
  const vars = Object.entries(tok)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  --${k}:${v};`)
    .join("\n");
  const style =
    `<style>\n/* ===== PALETTE SAMPLE ${s.label}: ${s.name}. TEMPORARY. =====\n` +
    `   ${s.note}\n` +
    `   Written by scripts/gen-palette-samples.mjs. ui.css is NOT touched: this\n` +
    `   block is scoped to this one file and dies with it. */\n` +
    `:root{\n${vars}\n}\n` +
    (s.accents ? accentCss(s.accents) + "\n" : "") +
    `${swapCss}\n</style>\n`;
  h = h.replace(/<\/head>/, `${style}</head>`);

  // 5. The flip control, last thing in <body>.
  h = h.replace(/<\/body>/, `${swapHtml(s, next)}\n</body>`);

  return h;
}

/* ==========================================================================
   THE SELF CHECK, AND IT RUNS BEFORE ANYTHING IS WRITTEN.

   Every pair Tim can see, measured against the ground it is actually drawn on,
   printed, and THROWN on if it fails, with nothing on disk yet: a sample that
   quietly ships an illegible accent is worse than one that refuses to build,
   because the illegible one gets picked.

   THE GATES ARE WCAG AA: 4.5:1 for normal text, 3:1 for large. .hof-head h2,
   .foot-tag and .hl are all display type in a heading and are large;
   .hof-head a is 0.875rem bold and is SMALL, which is the strictest gate on
   this page and the one that decides which of Trubbish's two accents takes
   which role.

   TWO ROWS ARE REPORTED AND NOT GATED, AND THE REASON MATTERS BECAUSE THE
   FIRST DRAFT GATED THEM AND FAILED THE BUILD ON THE PALETTE TIM ALREADY
   APPROVED. A hard offset behind a word is DECORATION, not text, and no
   contrast minimum applies to it. Worse, gating it runs the wrong way: a stamp
   is doing its job when it is CLOSE to the ground, because that is what makes
   it read as a shadow rather than as a second colour. C's #12101B stamp at
   1.24:1 and E's #231F20 at 1.78:1 are low ON PURPOSE.

   They are still printed, because the pair of them is the whole diagnosis of
   what Tim complained about. Charcoal's pink word against its own yellow stamp
   is 1.49:1: two SATURATED colours a rounding error apart in luminance and 2px
   apart on screen, which is why the yellow does not read as a shadow behind the
   word but as a coloured blur around it. Both individually clear their ground
   easily. So the number to look at is not either accent, it is the pair, and it
   is the reason C changes what the stamp is MADE of instead of dropping it.

   THE .hof GROUND IS MEASURED TWICE. That band paints
   `radial-gradient(130% 90% at 50% 0%, rgba(201,151,0,.18), transparent 62%)`
   over --chrome-bg, so the real pixel under the heading is somewhere between
   the flat bar colour and that gold at full strength. Both ends are scored and
   the worse one is the one that has to pass.
   ========================================================================== */
const GOLD_BLOOM = "#C99700", BLOOM_A = 0.18;
const fails = [];
console.log("  MEASURED. Gate is 4.5:1 for small text, 3:1 for large.");
console.log("  'report' rows are decoration and carry no minimum; see the note above.\n");
for (const s of SAMPLES) {
  const t = s.t;
  const a = s.accents;
  // resolve `var(--x)` against this sample's own tokens
  const val = (v) => (v.startsWith("var(--") ? t[v.slice(6, -1)] : v);
  const hl = a ? val(a.hl) : t["ketchup-deep"];
  const hlShadow = a
    ? (a.hlShadow === "none" ? null : val(a.hlShadow.split(" ").pop()))
    : t.mustard;
  const heading = a ? val(a.heading) : t.mustard;
  const link = a ? val(a.link) : t.mustard;
  const bar = t["chrome-bg"];
  const bloom = toHex(over(GOLD_BLOOM, bar, BLOOM_A));
  const rows = [
    [".hl word on the card", hl, t["paper-2"], 3.0],
    ...(hlShadow ? [[".hl word vs its own stamp", hl, hlShadow, null]] : []),
    ...(hlShadow ? [[".hl stamp on the card", hlShadow, t["paper-2"], null]] : []),
    ["section heading on the bar", heading, bar, 3.0],
    ["section heading, worst bloom", heading, bloom, 3.0],
    ["'All 10 hits' link, SMALL", link, bar, 4.5],
    ["'All 10 hits' link, worst bloom", link, bloom, 4.5],
    ["footer tagline on the bar", heading, bar, 3.0],
    ["body ink on the card", t.ink, t["paper-2"], 4.5],
    ["Subscribe label on #EE0000", YT["on-yt"], YT["yt-red"], 4.5],
    ["Subscribe pill vs the bar", YT["yt-red"], bar, 3.0],
  ];
  console.log(`  ${s.label}  ${s.name}`);
  for (const [name, fg, bg, gate] of rows) {
    const r = ratio(fg, bg);
    const ok = gate === null || r >= gate;
    if (!ok) fails.push(`${s.label} ${s.name}: ${name} ${fg} on ${bg} = ${fmt(r)}, needs ${gate}`);
    console.log(`     ${name.padEnd(32)} ${fg} on ${bg}  ${fmt(r).padStart(9)}  ` +
      (gate === null ? "report" : `${ok ? "pass" : "FAIL"} (${gate})`));
  }
  console.log();
}
if (fails.length) {
  throw new Error("CONTRAST FAILURES, nothing was written:\n  " + fails.join("\n  "));
}

for (let i = 0; i < SAMPLES.length; i++) {
  const s = SAMPLES[i];
  const next = SAMPLES[(i + 1) % SAMPLES.length];
  const out = build(s, next);
  await writeFile(join(ROOT, "public", s.file), out);
  console.log(`  wrote public/${s.file.padEnd(28)} ${(out.length / 1024).toFixed(1)}KB  ` +
    `page ${s.t.page}  bar ${s.t["chrome-bg"]}  ink ${s.t.ink}  -> ${next.label}`);
}
console.log("\n  TEMPORARY. Delete all five files and this script before launch.");
