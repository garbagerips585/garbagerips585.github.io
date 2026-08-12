#!/usr/bin/env node
// Generate /fake-cards.html, the real vs fake guide.
//
//   node scripts/build-fakes.mjs
//
// Reads data/fakes.json. Editorial, not synced: the physics of a printed card
// does not change nightly.
//
// TWO DIAGRAMS ARE DRAWN AS INLINE SVG rather than photographed, because the
// two tests that matter most are the two hardest to photograph usefully. A
// cross-section through a card cannot be photographed at all without cutting
// one up, and a rosette needs a loupe and a steady hand to shoot in a way that
// reads at phone size. Both are geometry, so both are drawn.
//
// The rosette diagram is generated rather than hand-drawn: real rosettes come
// from screening the four plates at different angles, so the pattern is the
// arithmetic of those angles. Drawing it by eye would have produced a picture
// of what I think a rosette looks like, which is the opposite of the point.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/fakes.json"), "utf8"));

const CONF_CLASS = {
  Strong: "hi",
  "Strong on modern rares": "hi",
  Good: "mid",
  "Good as a comparison": "mid",
  "First pass": "lo",
  "Supporting evidence only": "lo",
};

/** Cross-section through a card, for the light test and the edge test. */
function layerDiagram() {
  return `<figure class="fk-fig">
  <svg viewBox="0 0 320 150" role="img" aria-label="Cross-section of a real card showing three layers with a black core, next to a fake with one layer">
    <text x="80" y="16" class="fk-lbl" text-anchor="middle">REAL</text>
    <text x="240" y="16" class="fk-lbl" text-anchor="middle">FAKE</text>
    <g>
      <rect x="20" y="34" width="120" height="12" fill="#F1EDD2" stroke="#22384F" stroke-width="2"/>
      <rect x="20" y="46" width="120" height="9" fill="#22384F"/>
      <rect x="20" y="55" width="120" height="12" fill="#F1EDD2" stroke="#22384F" stroke-width="2"/>
      <text x="150" y="43" class="fk-note">front</text>
      <text x="150" y="53" class="fk-note">black core</text>
      <text x="150" y="65" class="fk-note">back</text>
    </g>
    <g>
      <rect x="180" y="40" width="110" height="20" fill="#F1EDD2" stroke="#22384F" stroke-width="2"/>
      <text x="296" y="53" class="fk-note">one layer</text>
    </g>
    <g stroke="#F5A62B" stroke-width="3" stroke-linecap="round">
      <path d="M40 118 L40 80"/><path d="M70 118 L70 80"/><path d="M110 118 L110 80"/>
    </g>
    <g stroke="#F5A62B" stroke-width="3" stroke-linecap="round" opacity=".95">
      <path d="M200 118 L200 34"/><path d="M235 118 L235 34"/><path d="M270 118 L270 34"/>
    </g>
    <text x="80" y="138" class="fk-cap" text-anchor="middle">light stops</text>
    <text x="240" y="138" class="fk-cap" text-anchor="middle">light passes through</text>
  </svg>
  <figcaption>Light from below. The black core is why a real card does not glow, and it is visible as a dark stripe if you look at the edge side on.</figcaption>
</figure>`;
}

/**
 * A rosette, generated from the real screen angles.
 *
 * Offset printing screens each plate at a different angle so the dots never sit
 * on top of each other: cyan 15 degrees, magenta 75, yellow 0, black 45. The
 * rosette is what that interference looks like up close, so the picture is
 * built from those angles rather than eyeballed.
 */
function rosetteDiagram() {
  const INKS = [
    { a: 15, c: "#00AEEF", o: 0.75 },
    { a: 75, c: "#EC008C", o: 0.75 },
    { a: 0, c: "#FFF200", o: 0.85 },
    { a: 45, c: "#22384F", o: 0.6 },
  ];
  const STEP = 13;
  const R = 3.6;
  let real = "";
  for (const { a, c, o } of INKS) {
    const rad = (a * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let dots = "";
    for (let i = -9; i <= 9; i++) {
      for (let j = -9; j <= 9; j++) {
        const x = 70 + (i * STEP * cos - j * STEP * sin);
        const y = 70 + (i * STEP * sin + j * STEP * cos);
        if (x < 4 || x > 136 || y < 4 || y > 136) continue;
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}"/>`;
      }
    }
    real += `<g fill="${c}" opacity="${o}">${dots}</g>`;
  }

  // The fake: same inks, no screen angles, random jitter and blotting. This is
  // what an inkjet or a cheap digital press gives you.
  let fake = "";
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const { c, o } of INKS) {
    let dots = "";
    for (let i = 0; i < 110; i++) {
      const x = 4 + rnd() * 132;
      const y = 4 + rnd() * 132;
      const r = 1.6 + rnd() * 3.4;
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
    }
    fake += `<g fill="${c}" opacity="${o}">${dots}</g>`;
  }

  return `<figure class="fk-fig">
  <div class="fk-two">
    <div>
      <svg viewBox="0 0 140 140" role="img" aria-label="Regular rosette pattern of cyan, magenta, yellow and black dots"><rect width="140" height="140" fill="#F1EDD2"/>${real}</svg>
      <p class="fk-lbl2">REAL &bull; regular rosette</p>
    </div>
    <div>
      <svg viewBox="0 0 140 140" role="img" aria-label="Irregular scattered dots of uneven size"><rect width="140" height="140" fill="#F1EDD2"/>${fake}</svg>
      <p class="fk-lbl2">FAKE &bull; irregular dots</p>
    </div>
  </div>
  <figcaption>What a solid colour looks like under a 10x loupe. The real pattern comes from screening the four plates at 15, 75, 0 and 45 degrees, which is a property of offset printing rather than a design choice, so it is hard to reproduce without the same press.</figcaption>
</figure>`;
}

const testCard = (t, i) => `      <article class="fk" id="${esc(t.id)}">
        <div class="fk-head">
          <span class="fk-no">${i + 1}</span>
          <h2>${esc(t.name)}</h2>
          <span class="fk-conf ${CONF_CLASS[t.confidence] || "mid"}">${esc(t.confidence)}</span>
        </div>
        ${t.tools ? `<p class="fk-tools">Needs: ${esc(t.tools)}</p>` : ""}
        <p class="fk-how">${esc(t.how)}</p>
        <div class="fk-vs">
          <div class="fk-real"><p class="fk-vs-h">Real</p><p>${esc(t.real)}</p></div>
          <div class="fk-fake"><p class="fk-vs-h">Fake</p><p>${esc(t.fake)}</p></div>
        </div>
        ${t.id === "light" ? layerDiagram() : ""}
        ${t.id === "print" ? rosetteDiagram() : ""}
        ${t.why ? `<p class="fk-why"><strong>Why it works.</strong> ${esc(t.why)}</p>` : ""}
        ${t.caveat ? `<p class="fk-caveat"><strong>But.</strong> ${esc(t.caveat)}</p>` : ""}
      </article>`;

const desc =
  `How to tell a real Pokemon card from a fake: ${d.tests.length} physical checks that actually work, ` +
  `what each one proves and what it does not, and what to do if you have been sold one.`;

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to spot a fake Pokemon card",
    description: desc,
    totalTime: "PT5M",
    tool: [...new Set(d.tests.map((t) => t.tools).filter(Boolean))].map((t) => ({
      "@type": "HowToTool",
      name: t,
    })),
    step: d.tests.map((t, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: t.name,
      text: `${t.how} Real: ${t.real} Fake: ${t.fake}`,
      url: `${SITE}/fake-cards.html#${t.id}`,
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Real or fake" },
    ],
  },
];

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>How to Spot a Fake Pokemon Card: ${d.tests.length} Tests That Work | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/fake-cards.html">
<meta property="og:title" content="How to spot a fake Pokemon card">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/fake-cards.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Titan+One&family=Outfit:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
${STYLES}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

<header class="set-hero">
  <div class="wrap">
    <span class="kicker">Pokemon TCG &bull; Don't get done</span>
    <h1>Real or <span class="hl">fake</span>?</h1>
    <p class="lede" style="max-width:36em">${esc(d.intro)}</p>
  </div>
</header>

<section class="tight">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> / Real or fake</p>

    <div class="fk-golden">
      <p class="fk-golden-h">Start here</p>
      <h2>${esc(d.goldenRule.title)}</h2>
      <p>${esc(d.goldenRule.body)}</p>
    </div>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>The checks</p>
    <h2>${d.tests.length} tests, <span class="hl">hardest first</span></h2>
${d.tests.map(testCard).join("\n")}
  </div>
</section>

<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Before you buy</p>
    <h2>${esc(d.atPurchase.title)}</h2>
    <ul class="facts-list">
      ${d.atPurchase.points.map((p) => `<li>${esc(p)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <h2>${esc(d.ifFake.title)}</h2>
    <ul class="facts-list">
      ${d.ifFake.points.map((p) => `<li>${esc(p)}</li>`).join("\n      ")}
    </ul>
    <p class="price-note">${d.sources.map(esc).join(" ")} Last reviewed ${esc(longDate(d.checked) || d.checked)}.
      Fan made guide, not official, and not a valuation or authentication service. If a card is worth enough for the
      answer to matter, send it to a grading company and let them put their name on it.</p>
  </div>
</section>

</main>
${footer("Real vs fake checks are physical properties anyone can verify. Not an authentication service.")}
<script src="/assets/app.js" defer></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/fake-cards.html"), page);
console.log(`Wrote public/fake-cards.html
  ${d.tests.length} tests, 2 generated diagrams
  confidence spread: ${[...new Set(d.tests.map((t) => t.confidence))].join(", ")}`);
