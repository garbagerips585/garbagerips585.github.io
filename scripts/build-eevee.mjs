#!/usr/bin/env node
// Build /eevee-evolutions.html: the eight, one at a time.
//
//   node scripts/build-eevee.mjs
//
// WHY THIS IS ITS OWN PAGE AND NOT A SECTION OF /evolution.html. Eevee is not a
// hard line, it is eight lines that happen to share a first box, and it is the
// only entry in the whole dataset where the answer to "how does it evolve" is
// eight different mechanics: three stones, two friendship-and-time-of-day, two
// that were a place and became a stone, and one that wants a move of a
// particular type. It also carries 20 of the 553 routes in the file, because
// Leafeon and Glaceon changed method five times each between Diamond and Pearl
// and Sword and Shield. On the chart page that is one card six times the height
// of its neighbours; here it is the page.
//
// It is also, by a distance, the most searched evolution question there is, and
// it is asked as its own question ("how do I get Umbreon") rather than as part
// of a browse. A reader arriving on that query should land on a page about
// Eevee, not on a chart with 340 cards on it and Eevee somewhere down it.
//
// EVERY CONDITION ON THIS PAGE COMES THROUGH shared/evolution.mjs, exactly as
// the chart page does, so the two cannot say different things about the same
// arrow. The only thing written here is the framing paragraph under each one,
// and the guard below fails the build if a branch has no paragraph, so a ninth
// Eeveelution stops the build rather than shipping with a blank.
//
// THE PARAGRAPHS SAY NOTHING THE DATA DOES NOT. That rule is enforced by
// reading rather than by code, so it needs stating: no paragraph below claims a
// method works in a game the source did not file it under, and none of them
// says "since" or "still" about a version group, because a version group is
// where a condition is filed and not a claim about later games.
//
// NO BACKTICKS IN COMMENTS IN THIS FILE. The page is one template literal.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";
import {
  loadEvolutions, groupRoutes, gameLabels, condsFor, nodeCard, dexNo,
  EVO_MARKS, EVO_CSS, renderChain,
} from "../shared/evolution.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = await loadEvolutions();

// Found by walking rather than by chain id, so a re-sync that renumbers the
// chains cannot silently build this page about something else.
let eevee = null;
for (const c of d.chains) if (c.root.slug === "eevee") eevee = c.root;
if (!eevee) throw new Error("build-eevee.mjs: no eevee chain in data/evolutions.json");
if (eevee.to.length < 8) {
  throw new Error(`build-eevee.mjs: eevee has ${eevee.to.length} branches, expected 8 or more`);
}

let hasPage = new Set();
try {
  const pk = JSON.parse(await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8"));
  hasPage = new Set((pk.pokemon || []).map((p) => p.slug));
} catch {
  /* run: node scripts/build-pokemon.mjs */
}

// ---------------------------------------------------------------------------
// THE FRAMING, one per branch. Restatement and emphasis only: every fact in
// here is already in the condition printed beside it. The guard under this map
// fails the build on a branch with no entry, which is the same discipline
// build-types.mjs keeps over its COPY block, and for the same reason: a page
// that quietly ships a blank where an explanation should be reads as finished.
const COPY = {
  vaporeon: "A Water Stone, and nothing else. No level, no friendship, no time of day. The three stone ones are the easy three, and they are easy in exactly the same way.",
  jolteon: "A Thunder Stone. Same shape as Vaporeon, different stone.",
  flareon: "A Fire Stone. That is the last of the three that are one item and no conditions.",
  espeon: "The first one that is not an item. Friendship 160 or higher, then a level up, and it has to happen in the daytime. Friendship is not a stat you can see on the card, which is what makes this the one people get wrong: it is built up by carrying the Pokemon around rather than bought.",
  umbreon: "Exactly Espeon's condition with the clock moved. Friendship 160 or higher, a level up, at night. The pair is deliberate and it is the reason both are famous: one Eevee, one number, and the only difference is what time you press the button.",
  leafeon: "The one that changed the most. Our source files six different answers for Leafeon, and five of them are a place: a particular rock in a particular forest, in a different forest in every generation. The sixth is a Leaf Stone. Every one of them is listed above with the games it belongs to, because there is no single true answer to give.",
  glaceon: "Leafeon's twin, and it changed the same way at the same times. Five different cold places across five sets of games, then an Ice Stone. Both are above with their games.",
  sylveon: "The only one with a move condition. It wants a Fairy type move known, and the other half of the condition changed: affection in one set of games, friendship in another. Both are printed above.",
};
for (const b of eevee.to) {
  if (!COPY[b.slug]) {
    throw new Error(
      `build-eevee.mjs: ${b.name} has no paragraph in COPY. Write one before this ships. ` +
        `A branch with a blank under it reads as a finished page that forgot one.`
    );
  }
}

// The branches, in dex order, which is also the order they were introduced.
const branches = eevee.to.slice().sort((a, b) => (a.id ?? 9999) - (b.id ?? 9999));

// How many distinct answers each branch has, which is the whole reason three of
// them need more room than the other five.
const spread = branches.map((b) => ({ b, n: groupRoutes(b.routes).length }));
const changed = spread.filter((x) => x.n > 1);

const sections = branches
  .map((b) => {
    const groups = groupRoutes(b.routes);
    const rows = groups
      .map((g) => {
        const labels = g.sole ? [] : gameLabels(g.games, d.games);
        return { g, labels };
      })
      .filter(Boolean);
    return `        <article class="ee-t" id="${esc(b.slug)}">
          <div class="ee-th">
            <h3>${esc(b.name)}</h3>
            <span class="ee-no">${esc(dexNo(b))}</span>
            <!-- NO "n answers" BADGE HERE. condsFor already prints that heading
                 immediately below, so the badge repeated it two lines apart and
                 read like a stutter. Screenshotted at 390 before removing. -->
          </div>
          <div class="ee-body">
            ${condsFor(b, d)}
            <p class="ee-say">${esc(COPY[b.slug])}</p>
          </div>
        </article>`;
  })
  .join("\n");

const desc =
  "All eight Eevee evolutions and exactly what each one takes: which stone, which " +
  "friendship level, which time of day, and where the answer changes by game.";
if (desc.length > 160) throw new Error(`meta description is ${desc.length} characters, over 160:\n${desc}`);

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Evolution chart", item: `${SITE}/evolution.html` },
      { "@type": "ListItem", position: 3, name: "Eevee" },
    ],
  },
];

const style = `
.ee-lede{max-width:46em}
.ee-fan{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin:var(--s5) 0}
.ee-jump{display:flex;flex-wrap:wrap;gap:6px;margin:var(--s4) 0 0}
.ee-jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.ee-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.ee-list{display:flex;flex-direction:column;gap:var(--s4);margin-top:var(--s4)}
.ee-t{border:2px solid var(--hair);border-radius:12px;background:var(--card);padding:var(--s4);
  scroll-margin-top:var(--s5)}
.ee-th{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--s2);margin-bottom:var(--s3)}
.ee-th h3{font:400 var(--t-m)/1.15 var(--display)}
.ee-no{font:400 var(--t-micro)/1 var(--mono);color:var(--ink-2)}
.ee-badge{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--keyline);background:var(--mustard);
  color:var(--on-accent)}
.ee-say{font-size:var(--t-sm);line-height:1.55;max-width:44em;margin-top:var(--s3)}
.ee-note{border:3px solid var(--keyline);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4);margin:var(--s5) 0}
.ee-note p{font-size:var(--t-sm);line-height:1.55;max-width:46em}
.ee-note p + p{margin-top:var(--s3)}
.ee-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s6);line-height:1.6;max-width:46em}
@media(min-width:1000px){
  .ee-lede,.ee-src,.ee-note p,.ee-say,.ev-p{max-width:var(--measure)}
}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>All 8 Eevee Evolutions and How to Get Each One | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/eevee-evolutions.html">
<meta property="og:title" content="How do you get every Eeveelution?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/eevee-evolutions.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-eevee.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-eevee.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>${EVO_CSS}${style}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${EVO_MARKS}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> /
        <a href="/evolution.html">Evolution chart</a> / <span>Eevee</span></nav>
      <h1>How do you get every <span class="hl">Eeveelution</span>?</h1>
      <p class="lede ee-lede">Eight of them, and no two work the same way. Three want a stone. Two want friendship
        and a clock. Two used to want a specific rock in a specific forest and now want a stone instead. One wants
        a move. <b>Eevee is the only Pokemon whose answer is eight answers</b>, which is why it gets a page.</p>
      <p class="lede ee-lede">Here is the whole fork first, then each one on its own with what it takes.</p>

      <div class="ee-fan">
${renderChain(eevee, d, hasPage)}
      </div>

      <nav class="ee-jump" aria-label="Jump to an Eeveelution">
${branches.map((b) => `        <a href="#${esc(b.slug)}">${esc(b.name)}</a>`).join("\n")}
      </nav>

      <div class="ee-list">
${sections}
      </div>

      <div class="ee-note">
        <h2>Why three of them have <span class="hl">more than one answer</span></h2>
        <p>${changed.length} of the eight carry more than one condition, and that is not us hedging. The method
          genuinely changed between games, and every version of it is printed with the games it belongs to. Leafeon
          and Glaceon are the extreme case at ${Math.max(...spread.map((x) => x.n))} apiece: for five sets of games
          the answer was a particular rock in a particular place, and the place was different every time.</p>
        <p>A page that gives you one of those has given most of its readers the wrong instruction. So this one
          gives you all of them and tells you which games each belongs to.</p>
        <p>Where a condition carries no game tag at all, our source records only one method for it. That means the
          source files one answer, not that the answer is guaranteed identical in every game ever made.</p>
      </div>

      <section>
        <h2>The rest of the <span class="hl">chart</span></h2>
        <p class="ev-p">Eevee is the hardest line to draw and far from the only interesting one.
          <a href="/evolution.html">The full evolution chart</a> has all ${d.counts.chains} chains with the
          condition on every arrow, filterable by what it takes: every trade evolution, every held item, every one
          that needs a time of day.</p>
        <p class="ev-p">On the card side, <a href="/types.html">the card types page</a> explains why Sylveon is not a Fairy card
          and why the card game has no type chart at all. <a href="/pokemon/">Browse by Pokemon</a> has every
          Umbreon and Vaporeon card we cover, priced.</p>
      </section>

      <p class="ee-src">Every condition on this page is read from PokeAPI (pokeapi.co) on
        ${esc(longDate(d.checked))}, including the item, move and place names and the names of the games. The
        paragraphs are ours and say nothing the conditions above them do not. Pokemon and Pokemon names are
        trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This is a fan site and nothing on it is
        affiliated with or endorsed by them. The arrows and fork marks are our own drawings.</p>
    </div>
  </section>
</main>
${footer("Evolution data from PokeAPI. Arrows drawn by us.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/eevee-evolutions.html"), page);

console.log(`Wrote public/eevee-evolutions.html
  ${branches.length} branches, ${changed.length} with more than one answer
  ${branches.reduce((n, b) => n + b.routes.length, 0)} routes in total, read ${d.checked}`);
