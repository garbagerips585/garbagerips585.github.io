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

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { avifPicture, esc, imgDims, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/fakes.json"), "utf8"));

// Photographs, when there are any.
//
// THERE IS STILL NO PHOTOGRAPH OF A FAKE AND THERE SHOULD NOT BE: we do not own
// a confirmed counterfeit, and a photo of one whose provenance you cannot verify
// is worth nothing on a page about verifying things. Every drawing here is
// therefore a DIAGRAM and labeled as one.
//
// THE ONE PHOTOGRAPH ON THE PAGE IS A GENUINE CARD, and it belongs to exactly
// one test. See scanCard() below. It is not evidence about a fake and nothing
// about it may be captioned as if it were.
//
// The slot exists so real photos can replace a diagram the day there are some.
// Drop a file in public/assets/fakes/ and name it in data/fakes.json:
//     "photo": { "file": "back-real-vs-fake.jpg", "caption": "..." }
// A named file that is not on disk is reported by the build and left out,
// rather than shipping a broken image. Same rule as the show flyers.
const missingPhotos = [];
function photoFor(t) {
  const p = t.photo;
  if (!p?.file) return "";
  const rel = `assets/fakes/${p.file}`;
  if (!existsSync(join(ROOT, "public", rel))) {
    missingPhotos.push(`${t.id}: public/${rel} not found`);
    return "";
  }
  return `<figure class="fk-fig fk-photo">
          <img src="/${esc(rel)}" alt="${esc(p.alt || `Real and fake compared: ${t.name}`)}" loading="lazy">
          ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}
        </figure>`;
}

/**
 * The genuine card, for the test that says to go and find one.
 *
 * TEST 2 IS "CHECK IT AGAINST A SCAN" AND THE PAGE SHIPPED NO SCAN. Every other
 * test here is a property you can draw, which is why the rest of the page is
 * diagrams and why that is the right call. This one is not a property, it is an
 * instruction to compare, and printing the instruction without an example of the
 * thing to compare against was the gap.
 *
 * IT IS THE ONLY PHOTOGRAPH HERE AND IT IS OF A REAL CARD. The caption says so
 * in those words, because a scan sitting on a page about counterfeits will be
 * read as evidence about a counterfeit unless it says otherwise, and it is not:
 * it is a picture of the ordinary thing, which is the whole point of a test
 * built on comparison.
 *
 * high.webp, 600x825, and that is deliberate rather than lazy. The details this
 * test is about are the set symbol, the set code, the regulation mark and the
 * illustrator credit, all of which are a smear in TCGdex's 245px low.webp. There
 * is no middle width at any host. avifPicture puts the AVIF in front of it and
 * leaves the WebP underneath, which is 37% off at this width.
 */
function scanCard(t) {
  const c = t.scanCard;
  if (!c?.img) return "";
  const high = `${c.img}/high.webp`;
  return `<figure class="fk-fig fk-photo">${avifPicture(
    `<img src="${esc(high)}" sizes="280px" alt="A genuine ${esc(c.card)}, ${esc(c.set)} number ${esc(
      c.number
    )}, scanned front on" loading="lazy" decoding="async" onerror="this.closest('figure').remove()"${imgDims(
      high
    )}>`
  )}
          <figcaption>A <b>real</b> ${esc(c.card)}, ${esc(c.set)} ${esc(
            c.number
          )}, scanned by TCGdex. This is the genuine article, not a fake: it is what the card in your hand
          should match down to the set code and the regulation mark along the bottom.</figcaption>
        </figure>`;
}

const CONF_CLASS = {
  Strong: "hi",
  "Strong on modern rares": "hi",
  Good: "mid",
  "Good as a comparison": "mid",
  "First pass": "lo",
  "Supporting evidence only": "lo",
  "Strongest single test": "hi",
  "Cheap, not conclusive": "lo",
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
      <text x="235" y="75" class="fk-note" text-anchor="middle">one layer, no core</text>
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
  <figcaption>What a solid color looks like under a 10x loupe. The real pattern comes from screening the four plates at 15, 75, 0 and 45 degrees, which is a property of offset printing rather than a design choice, so it is hard to reproduce without the same press.</figcaption>
</figure>`;
}


/**
 * Where to look, every check on one card.
 *
 * This is the piece the page was missing: the tests were described in words and
 * nothing showed WHERE on the card each one happens. Numbers match the test
 * numbers below it.
 *
 * THE COUNT IN THE aria-label IS PASSED IN, not written down. It read "each of
 * the eight checks" as a literal on a page that computes d.tests.length for its
 * own <title>, its <h2> and its meta description, so the one figure a sighted
 * reader never sees was the one figure that would have gone stale silently the
 * first time a ninth test was added to data/fakes.json.
 */
function anatomyDiagram(nTests) {
  const call = (n, x, y, tx, ty, label) => `
    <line x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="#22384F" stroke-width="1.5" stroke-dasharray="3 3"/>
    <circle cx="${tx}" cy="${ty}" r="10" fill="#22384F"/>
    <text x="${tx}" y="${ty + 3.5}" text-anchor="middle" class="fk-num">${n}</text>
    <text x="${tx}" y="${ty + 22}" text-anchor="middle" class="fk-cap">${label}</text>`;
  return `<figure class="fk-fig fk-fig-wide">
  <svg viewBox="0 0 420 300" role="img" aria-label="Diagram of a card showing where each of the ${nTests} checks is made">
    <rect x="120" y="30" width="180" height="250" rx="10" fill="#F5C518" stroke="#22384F" stroke-width="3"/>
    <rect x="132" y="42" width="156" height="120" rx="4" fill="#BFD9E8" stroke="#22384F" stroke-width="2"/>
    <text x="210" y="106" text-anchor="middle" class="fk-cap">artwork</text>
    <rect x="132" y="170" width="156" height="46" rx="3" fill="#F1EDD2" stroke="#22384F" stroke-width="1.5"/>
    <g fill="#22384F">
      <circle cx="144" cy="182" r="5"/><circle cx="157" cy="182" r="5"/>
      <rect x="170" y="178" width="60" height="4" rx="2" opacity=".5"/>
      <rect x="140" y="196" width="130" height="3" rx="1.5" opacity=".35"/>
      <rect x="140" y="204" width="100" height="3" rx="1.5" opacity=".35"/>
    </g>
    <rect x="132" y="252" width="120" height="4" rx="2" fill="#22384F" opacity=".45"/>
    ${call(4, 126, 50, 46, 50, "border: print")}
    ${call(3, 200, 100, 46, 130, "art: texture")}
    ${call(5, 150, 182, 46, 214, "energy symbols")}
    ${call(5, 190, 205, 46, 262, "small text")}
    ${call(2, 300, 155, 374, 92, "edge: core")}
    ${call(1, 296, 60, 374, 40, "light through")}
    ${call(7, 296, 250, 374, 214, "weight")}
    ${call(6, 210, 278, 374, 268, "the back")}
  </svg>
  <figcaption>Every check, and where on the card it happens. A schematic, not a real card: the numbers match the tests below.</figcaption>
</figure>`;
}

/**
 * Back color, which is a comparison test and therefore the one most worth
 * drawing. The real swatch is the actual blue off a genuine card back; the two
 * beside it are the directions fakes miss in, which is what the test describes.
 */
function backDiagram() {
  const swatch = (x, fill, label, sub) => `
    <g>
      <rect x="${x}" y="20" width="110" height="150" rx="8" fill="${fill}" stroke="#22384F" stroke-width="3"/>
      <circle cx="${x + 55}" cy="95" r="34" fill="none" stroke="#F1EDD2" stroke-width="5" opacity=".9"/>
      <path d="M${x + 21} 95 H${x + 89}" stroke="#F1EDD2" stroke-width="5" opacity=".9"/>
      <circle cx="${x + 55}" cy="95" r="12" fill="#F1EDD2" opacity=".9"/>
      <text x="${x + 55}" y="188" text-anchor="middle" class="fk-lbl2s">${label}</text>
      <text x="${x + 55}" y="202" text-anchor="middle" class="fk-cap">${sub}</text>
    </g>`;
  return `<figure class="fk-fig fk-fig-wide">
  <svg viewBox="0 0 380 215" role="img" aria-label="Three card backs: a correct blue, one too purple, one washed out">
    ${swatch(10, "#2C5AA0", "REAL", "deep gray-blue")}
    ${swatch(135, "#4B3FA8", "OFF", "too purple")}
    ${swatch(260, "#6E93C8", "OFF", "washed out")}
  </svg>
  <figcaption>The direction fakes miss in. Color on a screen is never a match for color in your hand, which is exactly why this test is done against a real card rather than against a picture.</figcaption>
</figure>`;
}

/**
 * Color registration on an energy symbol.
 *
 * The test says fakes show "color fringing where one plate is off". That is
 * hard to picture and trivial to draw: the same symbol with the cyan and
 * magenta plates nudged a fraction of a millimeter.
 */
function registrationDiagram() {
  const sym = (x, dx) => `
    <g>
      <circle cx="${x}" cy="60" r="34" fill="#F1EDD2" stroke="#22384F" stroke-width="2"/>
      <circle cx="${x - dx}" cy="${60 - dx}" r="20" fill="#EC008C" opacity=".85"/>
      <circle cx="${x + dx}" cy="${60 + dx}" r="20" fill="#00AEEF" opacity=".7"/>
      <circle cx="${x}" cy="60" r="20" fill="#F5A62B" opacity=".9"/>
    </g>`;
  return `<figure class="fk-fig">
  <svg viewBox="0 0 300 130" role="img" aria-label="An energy symbol printed cleanly, and the same symbol with the color plates misaligned">
    ${sym(80, 0)}
    ${sym(220, 5)}
    <text x="80" y="118" text-anchor="middle" class="fk-lbl2s">REAL</text>
    <text x="220" y="118" text-anchor="middle" class="fk-lbl2s">FAKE</text>
  </svg>
  <figcaption>Exaggerated to be visible on a screen. On a real fake the halo is a fraction of a millimeter, which is why this one wants a loupe.</figcaption>
</figure>`;
}

/** Surface profile: why a textured card sounds different under a fingernail. */
function textureDiagram() {
  let ridges = "";
  for (let i = 0; i < 14; i++) {
    const x = 20 + i * 18;
    ridges += `<path d="M${x} 60 Q${x + 9} 34 ${x + 18} 60" fill="none" stroke="#22384F" stroke-width="2.5"/>`;
  }
  return `<figure class="fk-fig">
  <svg viewBox="0 0 290 140" role="img" aria-label="Side view of a textured card surface against a flat one">
    <text x="145" y="16" text-anchor="middle" class="fk-lbl">REAL, side on</text>
    ${ridges}
    <line x1="20" y1="60" x2="272" y2="60" stroke="#22384F" stroke-width="2"/>
    <text x="145" y="90" text-anchor="middle" class="fk-lbl">FAKE, side on</text>
    <line x1="20" y1="112" x2="272" y2="112" stroke="#22384F" stroke-width="2.5"/>
    <text x="145" y="132" text-anchor="middle" class="fk-cap">nothing to catch a fingernail</text>
  </svg>
  <figcaption>The ridges are physically embossed, not printed, which is why you can hear them as well as feel them.</figcaption>
</figure>`;
}

/** A booster pack seal: flat and tight against ribbed and loose. */
function sealedDiagram() {
  const zig = (y) => {
    let d = `M24 ${y}`;
    for (let x = 24; x < 256; x += 8) d += ` L${x + 4} ${y - 3} L${x + 8} ${y}`;
    return d;
  };
  return `<figure class="fk-fig fk-fig-wide">
  <svg viewBox="0 0 560 170" role="img" aria-label="A real booster pack seal, flat and tight, against a fake one with a wavy seal and loose cards">
    <text x="140" y="18" text-anchor="middle" class="fk-lbl">REAL</text>
    <rect x="24" y="30" width="232" height="110" rx="4" fill="#F1EDD2" stroke="#22384F" stroke-width="3"/>
    <line x1="24" y1="46" x2="256" y2="46" stroke="#22384F" stroke-width="2"/>
    <line x1="24" y1="124" x2="256" y2="124" stroke="#22384F" stroke-width="2"/>
    <rect x="44" y="56" width="192" height="58" rx="3" fill="#BFD9E8" stroke="#22384F" stroke-width="2"/>
    <text x="140" y="90" text-anchor="middle" class="fk-cap">cards, barely any air</text>
    <text x="140" y="158" text-anchor="middle" class="fk-cap">seal straight and flat</text>

    <text x="420" y="18" text-anchor="middle" class="fk-lbl">FAKE</text>
    <rect x="304" y="30" width="232" height="110" rx="4" fill="#F1EDD2" stroke="#22384F" stroke-width="3"/>
    <g transform="translate(280,0)"><path d="${zig(46)}" fill="none" stroke="#22384F" stroke-width="2"/></g>
    <g transform="translate(280,0)"><path d="${zig(124)}" fill="none" stroke="#22384F" stroke-width="2"/></g>
    <rect x="336" y="66" width="150" height="40" rx="3" fill="#BFD9E8" stroke="#22384F" stroke-width="2"/>
    <text x="420" y="90" text-anchor="middle" class="fk-cap">loose, room to move</text>
    <text x="420" y="158" text-anchor="middle" class="fk-cap">seal ribbed or wavy</text>
  </svg>
  <figcaption>The seal is the tell you can check without opening anything. A real booster box is wrapped in soft cellophane carrying a Poke Ball logo; hard crackly wrap means it has been off and back on.</figcaption>
</figure>`;
}

const testCard = (t, i) => `      <article class="fk" id="${esc(t.id)}">
        <div class="fk-head">
          <span class="fk-no">${i + 1}</span>
          <h2>${esc(t.name)}</h2>
          <span class="fk-conf ${CONF_CLASS[t.confidence] || "mid"}">${esc(t.confidence)}</span>
        </div>
        ${t.tools ? `<p class="fk-tools">Needs: ${esc(t.tools)}${
          t.toolLink ? ` &bull; <a href="${esc(t.toolLink.url)}" rel="noopener" target="_blank">${esc(t.toolLink.name)}</a>` : ""
        }</p>` : ""}
        <p class="fk-how">${esc(t.how)}</p>
        <div class="fk-vs">
          <div class="fk-real"><p class="fk-vs-h">Real</p><p>${esc(t.real)}</p></div>
          <div class="fk-fake"><p class="fk-vs-h">Fake</p><p>${esc(t.fake)}</p></div>
        </div>
        ${t.id === "edge" ? layerDiagram() : ""}
        ${t.id === "texture" ? textureDiagram() : ""}
        ${t.id === "print" ? rosetteDiagram() : ""}
        ${t.id === "energy" ? registrationDiagram() : ""}
        ${t.id === "back" ? backDiagram() : ""}
        ${scanCard(t)}
        ${photoFor(t)}
        ${t.why ? `<p class="fk-why"><strong>Why it works.</strong> ${esc(t.why)}</p>` : ""}
        ${t.caveat ? `<p class="fk-caveat"><strong>But.</strong> ${esc(t.caveat)}</p>` : ""}
      </article>`;

const desc =
  `How to tell a real Pokemon card from a fake: ${d.tests.length} physical checks that work, what each ` +
  `one proves, and what to do if you have been sold one.`;

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
<meta property="og:image" content="${SITE}/assets/og-fake-cards.jpg?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-fake-cards.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111111">
${FONTS}
${STYLES}
<style>
/* The one photograph on the page, sized here rather than in ui.css because this
   page is its only user and ui.css is render blocking on all 426 pages.
   .fk-photo already exists there at max-width:720px, which is right for a
   side-by-side comparison photo and three times too wide for one card scan: the
   source is 600px, so 720 would upscale it. 280px is the box, which the 600px
   file covers at DPR2 with room to spare, and it is what sizes="280px" says. */
.fk-fig.fk-photo img{max-width:280px;margin-inline:0}
.fk-fig.fk-photo{max-width:44em}
.fk-fig.fk-photo figcaption{margin-top:var(--s2);font-size:var(--t-micro);color:var(--ink-2);
  line-height:1.5;max-width:40em}
.fk-fig.fk-photo figcaption b{color:var(--ink)}

/* REAL AND FAKE, THE RIGHT WAY ROUND. ui.css paints .fk-real a green tint with
   a green rule and .fk-fake a pink tint with a rule of var(--ketchup), and
   --ketchup is #111111 since the site repainted to one accent hue. So on the
   page about spotting counterfeits the FAKE side had lost its colour and the
   REAL side had kept one, the two washes were 1.08:1 apart, and the warning was
   the quieter of the pair. Overridden here rather than in ui.css because this
   page is the only user of these classes and ui.css is render blocking on all
   426 pages.
   The pair now separates by WEIGHT, not by hue, which is what a mono palette
   has to do and what a reader with no colour vision gets anyway. Real is the
   baseline: paper, a grey rule, quiet. Fake is inverted: solid ink with a gold
   rule and a gold label, which is the loudest thing this page can say without
   inventing a colour. The label words still carry the meaning on their own. */
.fk-real{background:var(--paper);border-left:6px solid var(--ink-2)}
.fk-real .fk-vs-h{color:var(--ink-2)}
.fk-fake{background:var(--ink);color:var(--chrome-ink);border-left:6px solid var(--gold)}
.fk-fake .fk-vs-h{color:var(--gold)}
.fk-fake p{color:var(--chrome-ink)}

/* DESKTOP READING MEASURE. 40em was written as if 1em were one character. It
   is not: Outfit at 11px runs about 2.31 characters per em, so that 440px box
   measured 94 real characters a line at 1440. ui.css already caps every
   figcaption in main at var(--measure) and this rule only outranked it by
   landing after the stylesheet. min-width:1000 is ui.css's own desktop
   breakpoint, so the phone and the tablet range keep exactly the rule they
   had. ONLY THE CAPTION. .fk-fig.fk-photo's own 44em is the FIGURE box, which
   holds a 280px card scan, so capping that would be resizing a picture and
   not a measure. */
@media(min-width:1000px){
.fk-fig.fk-photo figcaption{max-width:var(--measure)}
}
</style>
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

    ${d.seePhotos ? `<div class="fk-see">
      <p class="fk-see-h">${esc(d.seePhotos.title)}</p>
      <p class="fk-see-b">${esc(d.seePhotos.body)}</p>
      <ul class="fk-see-list">
        ${d.seePhotos.links.map((l) => `<li>
          <a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.name)} <span aria-hidden="true">&rarr;</span></a>
          <span>${esc(l.what)}</span>
        </li>`).join("\n        ")}
      </ul>
    </div>` : ""}

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
    ${anatomyDiagram(d.tests.length)}
${d.tests.map(testCard).join("\n")}
  </div>
</section>

${d.notRecommended ? `
<section class="band tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Popular and wrong</p>
    <h2>${esc(d.notRecommended.title)}</h2>
    <div class="fk-no-list">
      ${d.notRecommended.items.map((n) => `<article class="fk-no-item">
        <div class="fk-head"><h3>${esc(n.name)}</h3><span class="fk-conf lo">${esc(n.verdict)}</span></div>
        <p>${esc(n.body)}</p>
      </article>`).join("\n      ")}
    </div>
  </div>
</section>` : ""}
${d.sealed ? `
<section class="tight">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>Sealed product</p>
    <h2>${esc(d.sealed.title)}</h2>
    <p class="lede" style="max-width:46em">${esc(d.sealed.intro)}</p>
    ${sealedDiagram()}
    <ul class="facts-list">
      ${d.sealed.points.map((x) => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul>
  </div>
</section>` : ""}

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
    <p class="price-note">${d.sources.map(esc).join(" ")}${
      (d.sourceLinks || []).length
        ? " Read it yourself: " + d.sourceLinks.map((l) => `<a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.name)}</a>`).join(", ") + "."
        : ""
    } Every drawing on this page is a diagram of the property being described, and not one picture here is a
      photograph of a real counterfeit: we do not own one whose history we can vouch for, and an unverified photo of
      a fake would be an odd thing to put on a page about verifying things. The single photograph is a scan of a
      genuine card, on the test that tells you to compare against one, and it is TCGdex's. Last reviewed ${esc(longDate(d.checked) || d.checked)}.
      Fan made guide, not official, and not a valuation or authentication service. If a card is worth enough for the
      answer to matter, send it to a grading company and let them put their name on it.</p>
  </div>
</section>

</main>
${footer("Real vs fake checks are physical properties anyone can verify. Not an authentication service.")}
${APP_JS}
</body>
</html>
`;

await mkdir(join(ROOT, "public/assets/fakes"), { recursive: true });
await writeFile(join(ROOT, "public/fake-cards.html"), page);
const photos = d.tests.filter((t) => t.photo?.file).length;
console.log(`Wrote public/fake-cards.html
  ${d.tests.length} tests, 7 generated diagrams, ${photos} photo(s) named
  confidence spread: ${[...new Set(d.tests.map((t) => t.confidence))].join(", ")}`);
if (missingPhotos.length) {
  console.log(`\n${missingPhotos.length} photo(s) named but missing:`);
  for (const m of missingPhotos) console.log("  " + m);
}
