/**
 * Writes public/preview-midnight.html and public/preview-charcoal.html: the
 * REAL home page, twice, once in each of the two dark palettes Tim shortlisted.
 *
 *     node scripts/gen-palette-samples.mjs
 *
 * WHY THIS EXISTS. Tim, 18 August 2026, on Variation A (Slushie Midnight) and
 * Variation B (Slushie Charcoal) from scripts/gen-slushie-variants.mjs: "I like
 * both of A and B can you moc up one sample pages in each that I can view on my
 * phone to see what I like better".
 *
 * THE PHONE IS THE WHOLE POINT, WHICH IS WHY THESE TWO SHIP AND THE OTHER THREE
 * PREVIEW FILES DO NOT. assets-source/*-preview.html is a working file opened
 * off disk; a phone cannot open a file off this laptop's disk. So these two go
 * under public/, get pushed, and are reachable at a real url. That is a
 * deliberate exception to the rule gen-fun-palettes.mjs, gen-palette-preview.mjs
 * and gen-slushie-variants.mjs all state in their headers, and it is bought with
 * the four guards below rather than waved through.
 *
 *   1. Both carry <meta name="robots" content="noindex,nofollow">, and the
 *      canonical, og:url and JSON-LD are STRIPPED rather than left pointing at
 *      the real home page. A duplicate of / claiming to be / is the one way a
 *      throwaway page can cost the real site something.
 *   2. Neither is in sitemap.xml. That list is hand written in build-pages.mjs
 *      and nothing was added to it; check-build.py fails the build on any
 *      noindex page that turns up there, so it is checked rather than trusted.
 *   3. NOTHING LINKS TO THEM. Not the nav, not the footer, not a built page.
 *      They cross-link to EACH OTHER and to nothing else, which is the one
 *      link Tim asked for so he can flip between them on the phone without
 *      retyping a url.
 *   4. assets-source/ui.css is not touched and neither is the built copy. The
 *      whole palette is a token block in each page's OWN <style>, appended
 *      after the stylesheet link so it wins on source order at equal
 *      specificity. Every other page on the site is byte identical after this
 *      script runs.
 *
 * ============================ DELETE THESE BEFORE LAUNCH ====================
 * These are two extra copies of the front door sitting in the deploy root three
 * days before the site goes live. Once Tim has picked, delete both files, delete
 * this script, and re-run the build:
 *
 *     rm public/preview-midnight.html public/preview-charcoal.html
 *     rm scripts/gen-palette-samples.mjs
 *     node scripts/build-all.mjs
 *
 * The reminder is also in LAUNCH.md, under "Before flipping it on", because a
 * comment in a file nobody opens is not a reminder.
 * ===========================================================================
 *
 * DELIBERATELY NAMED gen- RATHER THAN build- OR stamp-. check-build.py fails on
 * any scripts/build-* or scripts/stamp-* that build-all.mjs does not run, and
 * build-all.mjs must NOT run this: it writes two pages that are going to be
 * deleted, and wiring them into the nightly is how a temporary file becomes
 * permanent. The staleness check in check-build.py only weighs scripts that
 * build-all runs, so this file's mtime cannot report the tree as stale either.
 *
 * IT REGENERATES FROM public/index.html EVERY RUN, so it must be run AFTER
 * build-all.mjs. Run it before and you get two previews of the previous build.
 *
 * THE TOKEN VALUES ARE READ OUT OF gen-slushie-variants.mjs, NOT COPIED FROM IT.
 * Transcribing 30 hexes twice is how the preview and the sample quietly stop
 * being the same colour, and that would make this page a liar about the exact
 * thing it is being used to decide. That file has no exports and writes a file
 * at import time, so importing it would rewrite assets-source/ and report every
 * page in the tree as stale; readTokens() parses the source text instead.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEN = join(ROOT, "scripts/gen-slushie-variants.mjs");
const src = await readFile(GEN, "utf8");

/* ==========================================================================
   READING THE PALETTES OUT OF THE GENERATOR.

   Each candidate there is `{ id: "midnight", ..., t: { ...30 tokens } }`. The
   object literal uses a mix of bare and quoted keys, so it is evaluated rather
   than JSON.parsed. This is a local build script reading a file from its own
   repo, so there is nothing here to be careful about that a `git diff` is not
   already careful about.

   IT THROWS RATHER THAN FALLING BACK. A missing block means somebody renamed or
   removed a candidate, and the wrong answer to that is two sample pages quietly
   wearing last week's colours.
   ========================================================================== */
function readBlock(id) {
  const at = src.indexOf(`id: "${id}"`);
  if (at < 0) throw new Error(`gen-slushie-variants.mjs has no candidate id:"${id}" any more`);
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

/* The Subscribe constants. #EE0000 with a white label, fixed in all eight
   candidates and fixed here: it is the one control on the page that is not a
   palette choice. Read from the generator for the same reason the tokens are. */
const ytBlock = /const YT = \{([^}]*)\}/.exec(src);
if (!ytBlock) throw new Error("gen-slushie-variants.mjs no longer defines YT");
const YT = new Function(`return ({${ytBlock[1]}})`)();
if (YT["yt-red"] !== "#EE0000" || YT["on-yt"] !== "#FFFFFF") {
  throw new Error(`Subscribe moved: ${JSON.stringify(YT)}. It is not a palette choice.`);
}

/* The dark shadow recipe, out of doc()'s `lift` ternary. Both candidates here
   have dark:true, so both take the first arm. ui.css spells this token --lift
   and every card, tile and shelf on the home page reads it. */
const liftM = /const lift = p\.dark\s*\n?\s*\?\s*"([^"]+)"/.exec(src);
if (!liftM) throw new Error("gen-slushie-variants.mjs no longer defines the dark lift recipe");
const DARK_LIFT = liftM[1];

/* ==========================================================================
   THE GAP BETWEEN THE TWO TOKEN SETS, AND IT IS THE ONLY PLACE THIS FILE HAS
   AN OPINION.

   The generator renders its own fragment against its own 30 tokens. The real
   home page renders against ui.css, which defines 43 and uses a handful the
   generator never had to name. Those extras are DERIVED from tokens the
   generator does supply rather than picked, so there is no second palette here
   to drift out of step:

     --navy      ui.css has it at #111111, the same value as --ink, --keyline
                 and --chrome-bg in the mono palette, which is exactly how it
                 stayed unnoticed. On the home page its only job is
                 `.soc svg{fill:var(--navy)}`, the four footer social glyphs,
                 sitting on a `--paper-2` tile. So it takes --ink. NOTE FOR
                 ANYBODY SHIPPING ONE OF THESE PALETTES FOR REAL: --navy is also
                 a BACKGROUND in .next-show, .fk-golden and .cc-table on other
                 pages, with `color:var(--paper)` on top, and one value cannot
                 do both jobs on a dark ground. Splitting it is real work and it
                 is not done here, because these two files render one page.
     --lilac     ui.css defines it equal to --sky in the shipped palette, and
                 uses it once, for a quote rule. Takes --sky.
     --sky-lite  the light end of one gradient whose dark end is --sky. Takes
                 --sky-tint, which is the tint the generator does supply.
     --teal      one hover border. Takes --sky, its neighbour in ui.css.

   --hard-lg and --line are already `var(--keyline)` in ui.css, so they follow
   the keyline for free. --gold-band-label is text drawn on --gold, and --gold
   is #FFB000 in both candidates, so it keeps its value: #332500 on #FFB000 is
   7.63:1 and moving it would be a change for its own sake.
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

const SAMPLES = [
  {
    id: "midnight",
    file: "preview-midnight.html",
    label: "A",
    name: "Midnight",
    other: { file: "preview-charcoal.html", label: "B", name: "Charcoal" },
    t: readBlock("midnight"),
  },
  {
    id: "charcoal",
    file: "preview-charcoal.html",
    label: "B",
    name: "Charcoal",
    other: { file: "preview-midnight.html", label: "A", name: "Midnight" },
    t: readBlock("charcoal"),
  },
];

/* ==========================================================================
   THE FLIP CONTROL.

   One fixed pill at the foot of the screen saying which palette you are looking
   at and offering the other one. It is the single thing that makes two urls
   useful rather than annoying on a phone, and it is the only link on either
   page that does not exist on the real home page.

   IT IS BUILT NOT TO LIE ABOUT THE PALETTE IT SITS ON. Every colour in it is a
   literal, not a token, so it reads the same on both grounds and cannot be
   mistaken for part of the design being judged. `left:50%;translateX(-50%)`
   with a max-width rather than `left:0;right:0`, so it cannot widen the
   document; `env(safe-area-inset-bottom)` keeps it off the iPhone home
   indicator; and body gets bottom padding so it never covers the footer's last
   line.
   ========================================================================== */
const swapCss = `
/* PREVIEW CHROME. Not part of either palette. Deleted with these files. */
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

const swapHtml = (s) =>
  `<div class="pvbar" role="group" aria-label="Palette sample switcher">` +
  `<b>${s.label} &middot; ${s.name}</b>` +
  `<a href="/${s.other.file}">See the ${s.other.name} version</a>` +
  `</div>`;

/* ==========================================================================
   THE PAGE.

   A transform of the BUILT home page rather than a rebuild of it, so the drops
   band, the Hall of Fame trophy, the carousels, the Pokedex band, the tool grid
   and the footer are the real markup with the real card art in them. Both files
   sit at the deploy root exactly like index.html, so every relative asset path
   in it resolves unchanged.
   ========================================================================== */
const home = await readFile(join(ROOT, "public/index.html"), "utf8");

function build(s) {
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
    `<title>Palette sample ${s.label}: Slushie ${s.name} &mdash; Garbage Rips 585 home page</title>`
  );
  h = h.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="Temporary palette sample. The Garbage Rips 585 home page drawn in Slushie ${s.name}. Not a real page of the site.">`
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
    `<style>\n/* ===== PALETTE SAMPLE ${s.label}: Slushie ${s.name}. TEMPORARY. =====\n` +
    `   Values read from scripts/gen-slushie-variants.mjs by\n` +
    `   scripts/gen-palette-samples.mjs. ui.css is NOT touched: this block is\n` +
    `   scoped to this one file and dies with it. */\n` +
    `:root{\n${vars}\n}\n${swapCss}\n</style>\n`;
  h = h.replace(/<\/head>/, `${style}</head>`);

  // 5. The flip control, last thing in <body>.
  h = h.replace(/<\/body>/, `${swapHtml(s)}\n</body>`);

  return h;
}

for (const s of SAMPLES) {
  const out = build(s);
  await writeFile(join(ROOT, "public", s.file), out);
  console.log(`  wrote public/${s.file}  ${(out.length / 1024).toFixed(1)}KB  ` +
    `page ${s.t.page}  bar ${s.t["chrome-bg"]}  ink ${s.t.ink}`);
}
console.log("\n  TEMPORARY. Delete both files and this script before launch.");
