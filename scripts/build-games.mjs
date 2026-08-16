#!/usr/bin/env node
// Build /games/ : the hub, Who's That Pokemon, Guess the Set and the trivia.
//
//   node scripts/sync-pokedex.mjs   (first, writes data/pokedex.json)
//   node scripts/build-games.mjs    (this)
//
// Writes the pages AND the data they fetch, from one script on purpose: the
// question shapes and the JSON that feeds them have to agree, and splitting
// them means a change to one silently breaks the other.
//
// WHY GAMES ON A CARD SITE AT ALL. The specific brief is somebody waiting in line to
// buy cards, which is a real and very common few minutes of dead time, on a
// phone, one handed, on venue wifi. That is a genuinely different target from
// "a game page", and it is why the engine offers no typing, no forced timer in
// the default mode, and preloads the next image. See games.js and games.css,
// which both carry the same note, because the constraint is easy to design away
// by accident.
//
// EVERY ANSWER IS TRACEABLE. The trivia does not contain a single hand typed
// fact. Questions are GENERATED from data/pokedex.json (pokeapi.co) and from
// the card corpus this site already publishes, so an answer is wrong only if
// the source is wrong, and the source and its read date are printed on the
// page. Writing a few hundred questions by hand would have been faster and
// there would be no way for a reader to check any of them.
//
// SHIPPING WEIGHT IS THE OTHER CONSTRAINT. These are fetched over the same bad
// wifi, so the JSON is arrays-of-arrays rather than objects: naming every field
// on every one of 1,025 rows costs more than the rows do.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, APP_JS, footer, FONTS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/games");
const DATA = join(ROOT, "public/data/games");
await mkdir(OUT, { recursive: true });
await mkdir(DATA, { recursive: true });

const dex = JSON.parse(await readFile(join(ROOT, "data/pokedex.json"), "utf8"));
const pokemon = dex.pokemon;
const printings = JSON.parse(await readFile(join(ROOT, "public/data/printings/manifest.json"), "utf8"));

// ---------------------------------------------------------------------------
// Who's That Pokemon: id, name, generation. The artwork url is derived from the
// id in the browser rather than stored, because it is the same 80 character
// string 1,025 times and that is 80KB of nothing.
// ---------------------------------------------------------------------------
const whos = pokemon.map((p) => [p.id, p.name, p.gen]);
await writeFile(join(DATA, "dex.json"), JSON.stringify({ checked: dex.checked, pokemon: whos }));

// ---------------------------------------------------------------------------
// Guess the Set: real card scans out of the corpus.
//
// ENGLISH ONLY, AND ONLY SETS WITH ENOUGH CARDS. A Japanese scan asks a
// different question (can you read the set symbol) and a set contributing three
// cards makes an unfair distractor, because the right answer would be a set the
// player has never been shown. 40 is the floor and each set is capped so one
// enormous set does not become the answer to a third of the questions.
// ---------------------------------------------------------------------------
const bySet = new Map();
for (const f of await readdir(join(ROOT, "public/data/printings"))) {
  if (!f.endsWith(".json") || f === "manifest.json") continue;
  for (const c of JSON.parse(await readFile(join(ROOT, "public/data/printings", f), "utf8"))) {
    if (c.l !== "en" || !c.g || !c.s || c.c !== "Pokemon") continue;
    // NO POKEMON TCG POCKET. The corpus includes 13 sets from the digital only
    // mobile game, which is 338 cards here, and they are the wrong answer to
    // this question twice over: nobody has ever seen one in a pack, and the
    // page's own pitch is that this teaches you to sort a bulk box. A quiz that
    // offers Eevee Grove against Neo Revelation is not hard, it is unfair.
    // The series id sits in the image path: .../en/tcgp/A1/023.
    if (/\/tcgp\//.test(c.g)) continue;
    if (!bySet.has(c.s)) bySet.set(c.s, []);
    bySet.get(c.s).push(c);
  }
}
const MIN_PER_SET = 40;
const CAP_PER_SET = 26;
const setNames = [];
const quizCards = [];
for (const [name, list] of [...bySet].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (list.length < MIN_PER_SET) continue;
  const idx = setNames.push(name) - 1;
  // Spread the sample across the set's numbering rather than taking the first
  // 26, so a set is not represented only by its commons.
  const step = Math.max(1, Math.floor(list.length / CAP_PER_SET));
  for (let i = 0, n = 0; i < list.length && n < CAP_PER_SET; i += step, n++) {
    quizCards.push([list[i].g, idx, list[i].n]);
  }
}
await writeFile(
  join(DATA, "setquiz.json"),
  JSON.stringify({ checked: printings.checked, sets: setNames, cards: quizCards }),
);

// ---------------------------------------------------------------------------
// Trivia. Generated, never typed. Each row is
//   [question, correct, wrong1, wrong2, wrong3, note]
// and `note` is what makes it worth getting wrong.
// ---------------------------------------------------------------------------
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
/*
 * ONE SEEDED SOURCE OF RANDOMNESS FOR THIS FILE, and seeding it is the point.
 *
 * Math.random was used in two places: choosing the wrong answers for every
 * question, and shuffling the bank before trimming it to 1,400 of the 2,247
 * generated. Between them, identical input data produced different questions
 * AND different wrong answers on every build, rewrote a 300KB file each time,
 * and left the tree dirty after any build. Churn that size is where a real
 * change hides.
 *
 * Seeded off the Pokedex's own read date, so the output is stable for a given
 * input and moves when the data moves. Same reasoning as build-upcoming.mjs
 * taking "today" from the newest upload rather than from the clock.
 */
const seedFrom = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
let seed = seedFrom(`trivia:${dex.checked || "0"}`);
/** mulberry32. Small, fast, long enough period for a quiz bank. */
const nextRandom = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rnd = (a) => a[Math.floor(nextRandom() * a.length)];
const sample = (pool, n, exclude) => {
  const seen = new Set(exclude);
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < pool.length * 10) {
    const v = rnd(pool);
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.length === n ? out : null;
};

const trivia = [];
const named = pokemon.filter((p) => p.genus);
const allNames = pokemon.map((p) => p.name);
const allTypes = [...new Set(pokemon.flatMap((p) => p.types))];

// 1. Genus. The single best category: the answers are official, they are short,
// and they are frequently absurd. Trubbish is the Trash Bag Pokemon.
// A GENUS IS NOT UNIQUE, which makes the naive version of this question unfair.
// Parasect and Amoonguss are both officially the Mushroom Pokemon; Prinplup and
// Piplup are both the Penguin Pokemon. Drawing distractors at random produced
// five questions where a "wrong" answer was every bit as correct as the right
// one, and the player was marked down for knowing more. Everything sharing the
// genus is excluded from the distractors, so exactly one of the four on screen
// can be right.
const byGenus = new Map();
for (const p of named) {
  if (!byGenus.has(p.genus)) byGenus.set(p.genus, []);
  byGenus.get(p.genus).push(p.name);
}
for (const p of named) {
  const wrong = sample(named.map((x) => x.name), 3, byGenus.get(p.genus));
  if (!wrong) continue;
  trivia.push([`Which Pokemon is the ${p.genus} Pokemon?`, p.name, ...wrong, `#${p.id}, introduced in Generation ${p.gen}.`]);
}

// 2. Type. Single typed only: a dual type has two right answers unless the
// question spells out the order, and a question that needs a rules lawyer is a
// bad question.
for (const p of pokemon.filter((x) => x.types.length === 1)) {
  const wrong = sample(allTypes, 3, p.types);
  if (!wrong) continue;
  trivia.push([`What type is ${p.name}?`, cap(p.types[0]), ...wrong.map(cap), `${p.name} is pure ${cap(p.types[0])}.`]);
}

// 3. Evolution, asked backwards. "What does X evolve into" has more than one
// answer for the branching lines; "what evolves INTO X" has exactly one.
for (const p of pokemon.filter((x) => x.evolvesFrom)) {
  const wrong = sample(allNames, 3, [p.name, p.evolvesFrom]);
  if (!wrong) continue;
  trivia.push([`Which Pokemon evolves into ${p.name}?`, p.evolvesFrom, ...wrong, `${p.evolvesFrom} is #${p.id - 1 > 0 ? "" : ""}${p.id}'s pre-evolution.`]);
}

// 4. Legendary. One real legendary against three ordinary Pokemon.
const legends = pokemon.filter((p) => p.legendary).map((p) => p.name);
const ordinary = pokemon.filter((p) => !p.legendary && !p.mythical).map((p) => p.name);
for (const name of legends) {
  const wrong = sample(ordinary, 3, [name]);
  if (!wrong) continue;
  trivia.push([`Which of these is a Legendary Pokemon?`, name, ...wrong, `${name} is flagged Legendary in the National Pokedex.`]);
}

// 5. Which is heavier. Four real Pokemon, pick the heaviest, with a wide enough
// gap that it is a fair question rather than a coin flip.
const weighed = pokemon.filter((p) => p.wHg > 0);
for (let i = 0; i < 220; i++) {
  const four = sample(weighed, 4, []);
  if (!four) continue;
  const sorted = [...four].sort((a, b) => b.wHg - a.wHg);
  if (sorted[0].wHg < sorted[1].wHg * 1.5) continue; // too close to be fair
  trivia.push([
    "Which of these is the heaviest?",
    sorted[0].name,
    sorted[1].name,
    sorted[2].name,
    sorted[3].name,
    `${sorted[0].name} weighs ${(sorted[0].wHg / 10).toFixed(1)}kg.`,
  ]);
}

// Interleave the categories so a run does not serve six genus questions in a
// row, then trim. The engine picks at random, but a lopsided bank still skews
// what a short session feels like.
// Fisher-Yates, which is an actual shuffle. The old one was
// `sort(() => Math.random() - 0.5)`: an inconsistent comparator, so the result
// was neither uniform nor defined across engines. It only ever looked random.
const shuffled = trivia.slice();
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(nextRandom() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
shuffled.length = Math.min(1400, shuffled.length);
await writeFile(join(DATA, "trivia.json"), JSON.stringify({ checked: dex.checked, q: shuffled }));

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
const GAMES_CSS = `<link rel="stylesheet" href="/assets/games.css">`;
const GAMES_JS = `<script src="/assets/games.js" defer></script>`;

// `compact` moves the explanatory copy BELOW the game and shrinks the header.
//
// MEASURED, NOT PREFERRED. With the site's standard hero the answer buttons
// landed at y=937 on a 375x812 phone, which is 125px below the fold: you had to
// scroll to play, every question. The hero was 319px of that on its own. A page
// whose entire premise is one thumb in a line cannot open below the fold, so
// the game goes first and the prose goes after it, where prose belongs on a
// page nobody came to read.
// THE H1 IS MARKUP AND og:title IS NOT. Every game h1 carries a `<span
// class="hl">` around the highlighted word, and escaping it into the meta tag
// published the tag itself: sharing /games/guess-the-set.html put
// `Guess the <span class="hl">set</span>` in the link preview on all four game
// pages. Strip the tags first, then escape the text that is left.
const plain = (html) => String(html).replace(/<[^>]+>/g, "");

function shell({ slug, title, desc, h1, kicker, lede, body, ld = [], extraJs = "", compact = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/games/${slug}">
<meta property="og:title" content="${esc(plain(h1))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/games/${slug}">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
${FONTS}
${STYLES}
${GAMES_CSS}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero${compact ? " g-hero" : ""}">
  <div class="wrap">
    <span class="kicker">${kicker}</span>
    <h1>${h1}</h1>
    ${compact ? "" : `<p class="lede" style="max-width:38em">${lede}</p>`}
  </div>
</header>

${body}

${
  compact
    ? `<section class="band tight">
  <div class="wrap">
    <h2>About this <span class="hl">game</span></h2>
    <p class="lede" style="max-width:40em">${lede}</p>
  </div>
</section>`
    : ""
}

</main>
${footer("Fan made games. Card data and Pokedex data credited on each page.")}
${APP_JS}
${GAMES_JS}
${extraJs}
</body>
</html>
`;
}

const crumb = (name) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Games", item: `${SITE}/games/` },
    ...(name ? [{ "@type": "ListItem", position: 3, name }] : []),
  ],
});

// --- Hub -------------------------------------------------------------------
const CARDS = [
  // FIRST ON PURPOSE. The other three are quizzes, which are things you finish.
  // This hub is called "Games for the wait" and the longest wait wants the game
  // you can keep playing and hand to somebody else.
  ["garbage-run.html", "Arcade", "Garbage Run", "One thumb, no rules to read. Flip Trubbish between the floor and the ceiling and eat everything on the street. A hundred pieces of rubbish and he evolves."],
  ["whos-that-pokemon.html", "Silhouettes", "Who's That Pokemon?", `Name the shape. All ${whos.length.toLocaleString("en-US")} of them, or just the original 151.`],
  ["guess-the-set.html", "Card scans", "Guess the Set", `A real card, four sets, one right answer. ${setNames.length} sets in the pot.`],
  ["pokemon-trivia.html", "Quiz", "Pokemon Trivia", `${shuffled.length.toLocaleString("en-US")} questions, all generated from real Pokedex and card data.`],
];

const hub = shell({
  slug: "",
  title: "Pokemon Games to Play in Line | Garbage Rips 585",
  desc: `Quick Pokemon games for your phone: name the silhouette, guess the set from a card scan, or take on ${shuffled.length.toLocaleString("en-US")} trivia questions. No sign up, no app.`,
  h1: `Games for the <span class="hl">wait</span>`,
  kicker: "585 &bull; Something to do in line",
  lede:
    "Built for the twenty minutes you spend waiting to get to the counter. One thumb, no sign up, nothing to install, " +
    "and nothing lost if the line moves and you have to stop.",
  ld: [crumb(null)],
  body: `<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Games</p>
    <div class="g-list">
      ${CARDS.map(
        // h2, NOT h3. The three game names are the only headings on this hub
        // under the h1, so an h3 announced a level 3 heading with no level 2
        // above it and left a screen reader user looking for the section that
        // was skipped. The individual game pages already open their body copy
        // with an h2, so the hub was the odd one out.
        // `.g-card h2` in public/assets/games.css carries the same declaration
        // `.g-card h3` did, so this renders identically.
        ([href, tag, name, blurb]) => `<a class="g-card" href="/games/${href}">
        <span class="g-tag">${esc(tag)}</span>
        <h2>${esc(name)}</h2>
        <p>${esc(blurb)}</p>
      </a>`,
      ).join("\n      ")}
    </div>
    <h2 style="margin-top:var(--s6)">The two official <span class="hl">apps</span></h2>
    <p class="lede" style="max-width:46em">Ours are for the twenty minutes in the queue. These two are the real card
      game, both free, both from Pokemon, and both tied to the packs on this channel. The code card in every booster
      goes into one of them.</p>
    <div class="g-list">
      <a class="g-card" href="/tcg-live.html">
        <span class="g-tag">Official</span>
        <h2>Pokemon TCG Live</h2>
        <p>The full card game, same rules as the cards in your hand. It is where the code card from a booster pack
          gets redeemed, and what that code actually gives you is not what most people assume.</p>
      </a>
      <a class="g-card" href="/tcg-pocket.html">
        <span class="g-tag">Official</span>
        <h2>Pokemon TCG Pocket</h2>
        <p>The casual one, and the easier place to learn: shorter matches on a deliberately simplified ruleset, so what
          it teaches you carries over only so far. Your pack codes do not work here.</p>
      </a>
    </div>
    <p class="price-note" style="margin-top:var(--s5)">Your best scores are saved on this device only. There is no
      account and no leaderboard, because the site is a set of static files with nowhere to store one.
      Pokedex data from pokeapi.co, read ${esc(longDate(dex.checked) || dex.checked)}. Card scans from TCGdex.
      Pokemon and all Pokemon names are trademarks of The Pokemon Company. This is fan content.</p>
  </div>
</section>`,
});
await writeFile(join(OUT, "index.html"), hub);

// --- Who's That Pokemon ----------------------------------------------------
const whosPage = shell({
  slug: "whos-that-pokemon.html",
  compact: true,
  title: "Who's That Pokemon? Silhouette Quiz | Garbage Rips 585",
  desc: `Name the Pokemon from its silhouette. Play the original 151 or all ${whos.length.toLocaleString("en-US")}, free, on your phone, no sign up.`,
  h1: `Who's that <span class="hl">Pokemon?</span>`,
  kicker: "Silhouettes &bull; 151 or all of them",
  lede: "Four answers, one shape. Get it wrong and the name comes up so you learn it. Your streak is saved on this device.",
  ld: [crumb("Who's That Pokemon?")],
  body: `<section class="tight">
  <div class="wrap">
    <div id="game"></div>
    <div class="btn-row" style="justify-content:center;margin-bottom:var(--s5)">
      <button class="btn btn-sm" type="button" id="mGen1" aria-pressed="true">The original 151</button>
      <button class="btn btn-sm" type="button" id="mAll" aria-pressed="false">All ${whos.length.toLocaleString("en-US")}</button>
    </div>

    <p class="crumbs"><a href="/">Home</a> / <a href="/games/">Games</a> / Who's That Pokemon?</p>
    <p class="price-note" style="margin-top:var(--s5)">Artwork and Pokedex data from
      <a href="https://pokeapi.co" rel="noopener" target="_blank">pokeapi.co</a>, read
      ${esc(longDate(dex.checked) || dex.checked)}. Pokemon and all Pokemon names are trademarks of
      The Pokemon Company. Fan content, not affiliated.</p>
  </div>
</section>`,
  extraJs: `<script>
(function(){
  var ART='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
  var all=[], pool=[], quiz=null, gen1=true;
  var art=function(id){return ART+id+'.png';};

  function build(){
    var p=GR.pick(pool);
    var wrong=GR.distractors(pool,3,p,function(x){return x[0];});
    var choices=GR.shuffle([p].concat(wrong)).map(function(x){return {label:x[1],id:x[0]};});
    var answer=0;
    for(var i=0;i<choices.length;i++) if(choices[i].id===p[0]) answer=i;
    return {
      stage:'<div class="gq-sil" data-sil><img src="'+art(p[0])+'" alt="A Pokemon silhouette to identify" width="475" height="475"></div>',
      choices:choices, answer:answer,
      note:'#'+p[0]+', Generation '+p[2]+'.',
      // Lifting the filter IS the reveal, so it uses the same element and the
      // full color artwork is already decoded and in cache.
      reveal:function(stage){var s=stage.querySelector('[data-sil]'); if(s) s.className='gq-sil is-shown';},
      _art:art(p[0])
    };
  }

  function setMode(g){
    gen1=g;
    document.getElementById('mGen1').setAttribute('aria-pressed',String(g));
    document.getElementById('mAll').setAttribute('aria-pressed',String(!g));
    pool=g?all.filter(function(x){return x[0]<=151;}):all;
    start();
  }
  function start(){
    GR.Quiz({key:'gr.whos'+(gen1?'.151':'.all'),mount:document.getElementById('game'),
      next:build, preload:function(q){return q._art;}});
  }

  fetch('/data/games/dex.json').then(function(r){return r.json();}).then(function(d){
    all=d.pokemon;
    document.getElementById('mGen1').addEventListener('click',function(){setMode(true);});
    document.getElementById('mAll').addEventListener('click',function(){setMode(false);});
    setMode(true);
  }).catch(function(){
    document.getElementById('game').innerHTML='<p class="price-note">Could not load the Pokedex. Check your connection and reload.</p>';
  });
})();
</script>`,
});
await writeFile(join(OUT, "whos-that-pokemon.html"), whosPage);

// --- Guess the Set ---------------------------------------------------------
const setPage = shell({
  slug: "guess-the-set.html",
  compact: true,
  title: "Guess the Set: Pokemon Card Quiz | Garbage Rips 585",
  desc: `A real Pokemon card scan, four sets, one right answer. ${setNames.length} English sets and ${quizCards.length.toLocaleString("en-US")} cards.`,
  h1: `Guess the <span class="hl">set</span>`,
  kicker: `Card scans &bull; ${setNames.length} sets`,
  lede:
    "A real card off the shelf. Work it out from the frame, the symbol and the era. This is the skill that makes you " +
    "quick at sorting a bulk box, and it is the one people are surprised they can learn.",
  ld: [crumb("Guess the Set")],
  body: `<section class="tight">
  <div class="wrap">
    <div id="game" class="g-cards"></div>
    <p class="crumbs"><a href="/">Home</a> / <a href="/games/">Games</a> / Guess the Set</p>
    <p class="price-note" style="margin-top:var(--s5)">${quizCards.length.toLocaleString("en-US")} cards from
      ${setNames.length} English sets, sampled across each set's numbering so it is not all commons.
      Scans from TCGdex, read ${esc(longDate(printings.checked) || printings.checked)}.
      Fan content, not affiliated with The Pokemon Company.</p>
  </div>
</section>`,
  extraJs: `<script>
(function(){
  var sets=[], cards=[];
  function build(){
    var c=GR.pick(cards);
    var wrong=GR.distractors(sets,3,sets[c[1]],function(x){return x;});
    var choices=GR.shuffle([sets[c[1]]].concat(wrong)).map(function(s){return {label:s};});
    var answer=0;
    for(var i=0;i<choices.length;i++) if(choices[i].label===sets[c[1]]) answer=i;
    // high.webp, not low: the set symbol is the whole point and it is
    // unreadable at the 245px thumbnail size used elsewhere on the site.
    var src=c[0]+'/high.webp';
    return {stage:'<div class="gq-card"><img src="'+src+'" alt="A Pokemon card. Name its set." width="600" height="825"></div>',
      choices:choices,answer:answer,note:c[2]+'.',_art:src};
  }
  fetch('/data/games/setquiz.json').then(function(r){return r.json();}).then(function(d){
    sets=d.sets; cards=d.cards;
    GR.Quiz({key:'gr.setquiz',mount:document.getElementById('game'),next:build,
      preload:function(q){return q._art;}});
  }).catch(function(){
    document.getElementById('game').innerHTML='<p class="price-note">Could not load the card list. Check your connection and reload.</p>';
  });
})();
</script>`,
});
await writeFile(join(OUT, "guess-the-set.html"), setPage);

// --- Trivia ----------------------------------------------------------------
const triviaPage = shell({
  slug: "pokemon-trivia.html",
  compact: true,
  // Counted, not typed. Every OTHER figure on this page already comes from
  // shuffled.length (the kicker, the lede note); the title alone said 1,400 as
  // a literal, and it is a literal that only stays true by coincidence.
  // `shuffled` is trivia.q capped by slice(0, 1400), so the day the generator
  // yields fewer than 1,400 questions the cap stops binding and the count drops
  // while the title, which is what search results and the browser tab show,
  // keeps promising 1,400.
  title: `Pokemon Trivia Quiz: ${shuffled.length.toLocaleString("en-US")} Questions | Garbage Rips 585`,
  desc: `Pokemon trivia generated from real Pokedex data: types, evolutions, Legendaries and the official Pokemon categories. Free, no sign up.`,
  h1: `Pokemon <span class="hl">trivia</span>`,
  kicker: `Quiz &bull; ${shuffled.length.toLocaleString("en-US")} questions`,
  lede:
    "Types, evolutions, Legendaries and the official categories, which are stranger than you remember. Every question " +
    "is generated from the National Pokedex rather than written from memory, so none of it is somebody's half remembered fact.",
  ld: [crumb("Pokemon Trivia")],
  body: `<section class="tight">
  <div class="wrap">
    <div id="game"></div>
    <p class="crumbs"><a href="/">Home</a> / <a href="/games/">Games</a> / Trivia</p>
    <p class="price-note" style="margin-top:var(--s5)">${shuffled.length.toLocaleString("en-US")} questions, every one
      generated from <a href="https://pokeapi.co" rel="noopener" target="_blank">pokeapi.co</a> data read
      ${esc(longDate(dex.checked) || dex.checked)}. Nothing here was typed from memory, which is why there is no
      question about which Pokemon is best. Fan content, not affiliated with The Pokemon Company.</p>
  </div>
</section>`,
  extraJs: `<script>
(function(){
  var qs=[];
  function build(){
    var r=GR.pick(qs);
    var opts=GR.shuffle([{label:r[1],ok:1},{label:r[2]},{label:r[3]},{label:r[4]}]);
    var answer=0;
    for(var i=0;i<opts.length;i++) if(opts[i].ok) answer=i;
    return {stage:'<p class="gq-q">'+r[0]+'</p>',choices:opts,answer:answer,note:r[5]||''};
  }
  fetch('/data/games/trivia.json').then(function(r){return r.json();}).then(function(d){
    qs=d.q;
    GR.Quiz({key:'gr.trivia',mount:document.getElementById('game'),next:build});
  }).catch(function(){
    document.getElementById('game').innerHTML='<p class="price-note">Could not load the questions. Check your connection and reload.</p>';
  });
})();
</script>`,
});
await writeFile(join(OUT, "pokemon-trivia.html"), triviaPage);

console.log(`Wrote public/games/ (4 pages)`);
console.log(`  Who's That Pokemon: ${whos.length} species, ${whos.filter((w) => w[0] <= 151).length} in the 151 pool`);
console.log(`  Guess the Set: ${quizCards.length} cards across ${setNames.length} sets (min ${MIN_PER_SET} per set)`);
console.log(`  Trivia: ${shuffled.length} questions from ${trivia.length} generated`);
