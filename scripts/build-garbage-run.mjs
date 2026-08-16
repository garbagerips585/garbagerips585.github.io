#!/usr/bin/env node
// Build /games/garbage-run.html: a one thumb arcade game for the queue.
//
//   node scripts/build-garbage-run.mjs
//
// WHY THIS EXISTS. The games hub is called "Games for the wait" and every game
// on it was a quiz: Who's That Pokemon, Guess the Set, Trivia. A quiz is a
// thing you finish. Somebody forty minutes deep in a Target restock line wants
// something they can keep playing, and something a friend can grab the phone
// and beat. So this is an actual game.
//
// THE MECHANIC IS GRAVITY FLIP, NOT FLAPPY. Flappy needs repeated taps just to
// stay level, which is fiddly one handed and punishes a moment of inattention
// in a queue. Flip is one tap per decision: Trubbish sticks to the floor or the
// ceiling and you tap to swap. Easy to read at a glance, easy to pick up mid
// conversation, and it still gets hard fast.
//
// IT IS PORTRAIT, AND THAT IS THE WHOLE POINT. A phone in a queue is held one
// handed and upright. A landscape canvas asks somebody to rotate the device,
// which is a decision, and a decision is exactly what this is meant not to
// require. The canvas is taller than it is wide and the whole page reads on a
// phone without turning anything.
//
// The trade is runway: portrait leaves far less horizontal distance between an
// obstacle appearing and reaching you, so the world moves slower and the
// hazards are spaced further apart than the landscape draft. Gravity is also
// stronger, because a taller lane means a longer fall and a flip has to still
// feel immediate.
//
// THERE WAS A TWO PLAYER MODE AND IT IS GONE. Splitting one phone into two
// lanes sounds good in a sentence and is not a thing two people can actually
// play: the device is held by one of them, half the screen is upside down to
// whoever is not holding it, and both thumbs land in the same place. Removed
// rather than left in as a feature nobody would use twice.
//
// THE MASCOTS ARE THE REAL SPRITES, the same two files the 404 page and the
// no-hits panel already use, because Tim asked for the actual Trubbish rather
// than a green blob standing in for one. Both are loaded from /assets/ so the
// canvas is never tainted by a third-party host and the game keeps working
// offline once the page is cached.
//
// The junk is EMOJI on purpose: a banana, a pizza slice, a bin, a drinks can.
// Emoji were the wrong tool for the rarity key, where the tier IS the colour of
// the star and there is no silver star to be had, and they are the right tool
// here, where the job is "this is rubbish and it is funny". They also cost no
// bytes and need no art pipeline.
//
// A SPRITE THAT HAS NOT LOADED MUST NOT BLOCK THE GAME. Both images are drawn
// only once complete; until then the original drawn shapes render instead, so a
// slow connection gets a playable game rather than an empty rectangle.
//
// ACCESSIBILITY, and a game makes this awkward rather than impossible.
// prefers-reduced-motion cannot mean "no movement" in a game about movement,
// so it means: nothing moves until you press start, the parallax and the screen
// shake are off, and the speed ramp is gentler. Keyboard plays it too.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS, FONTS } from "../shared/chrome.mjs";
import { esc } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const desc =
  "A one thumb arcade game for the restock line. Flip Trubbish between floor and ceiling, eat the rubbish, dodge the Pokemon, and evolve into Garbodor.";

const style = `
.gr-wrap{max-width:520px;margin:0 auto}
/* ON A SHORT PHONE THE GAME IS THE PAGE. Getting the aspect ratio right meant
   the board could only be as wide as the leftover height allowed, and on a
   667px screen the heading, the lede and the score left so little that the
   board came out 168px wide: the correct shape and too small to play. The copy
   is still there, it just stops taking the space the game needs. Everything
   below the board is unaffected, so nothing is lost, only moved down. */
@media (max-height: 740px) {
  .gr-wrap h1{font-size:var(--t-l);margin-bottom:4px}
  .gr-wrap > .lede{display:none}
  .gr-hud{margin:var(--s2) 0}
  .gr-wrap .crumbs{display:none}
}
.gr-stage{position:relative;border:3px solid var(--navy);border-radius:14px;overflow:hidden;
  box-shadow:var(--hard-lg);background:#16210F;user-select:none;-webkit-user-select:none;
  -webkit-tap-highlight-color:transparent}
/* Capped so the canvas cannot grow taller than a phone screen on a desktop,
   where it would otherwise render as a very tall column. */
.gr-stage{max-width:420px;margin:0 auto}
.gr-stage canvas{display:block;margin:0 auto;image-rendering:auto}
/* touch-action none, not manipulation: manipulation still allows the browser's
   double-tap-to-zoom heuristic, which on a game that is nothing but taps means
   a fast double flip can zoom the page instead. overscroll-behavior stops a
   flick near the edge dragging the whole page. */
.gr-stage{touch-action:none;overscroll-behavior:contain}
.gr-stage canvas{touch-action:none}
.gr-hud{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:center;justify-content:space-between;
  margin:var(--s4) 0 var(--s3)}
.gr-score{font:400 var(--t-l)/1 var(--display);color:var(--ink)}
.gr-best{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.gr-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--s3);background:rgba(11,17,8,.86);color:#F4F1E2;text-align:center;padding:var(--s4)}
.gr-over[hidden]{display:none}
.gr-over h2{color:#F4F1E2;font:400 var(--t-xl)/1 var(--display)}
.gr-over p{color:#DDE6EC;max-width:30em;font-size:var(--t-sm);line-height:1.5}
.gr-go{min-height:52px;padding:0 var(--s5);border:3px solid var(--gold);border-radius:999px;
  background:var(--gold);color:#2A2410;font:700 var(--t-m)/1 var(--body);cursor:pointer}
.gr-go:hover{background:var(--mustard);border-color:var(--mustard)}
.gr-how{margin-top:var(--s5);color:var(--ink-2);font-size:var(--t-sm);line-height:1.6;max-width:44em}
.gr-how b{color:var(--ink)}
.gr-keys{font:700 var(--t-micro)/1 var(--mono);background:var(--card);border:1px solid var(--hair);
  border-radius:5px;padding:3px 6px}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Garbage Run: a One Thumb Game for the Restock Line | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/games/garbage-run.html">
<meta property="og:title" content="Garbage Run">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/games/garbage-run.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#1E3A54">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Games", item: `${SITE}/games/` },
    { "@type": "ListItem", position: 3, name: "Garbage Run" },
  ],
})}</script>
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">
  <section class="tight">
    <div class="wrap gr-wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/games/">Games</a> / <span>Garbage Run</span></nav>
      <h1>Garbage <span class="hl">Run</span></h1>
      <p class="lede">One thumb, no rules to read. Tap to flip Trubbish between the floor and the ceiling and
        eat everything on the street. A hundred pieces of rubbish and he evolves.</p>

      <div class="gr-hud">
        <div>
          <div class="gr-score" id="grScore">0</div>
          <div class="gr-best" id="grBest">Best 0</div>
        </div>
      </div>

      <div class="gr-stage" id="grStage">
        <canvas id="grCanvas" width="420" height="680" role="img"
          aria-label="Garbage Run. Trubbish runs along a Rochester street and you tap to flip him between the floor and the ceiling."></canvas>
        <div class="gr-over" id="grOver">
          <h2 id="grTitle">Garbage Run</h2>
          <p id="grMsg">Tap the screen, or press space, to flip. Eat the rubbish, dodge the Pokemon.</p>
          <button class="gr-go" id="grStart" type="button">Start</button>
        </div>
      </div>

      <p class="gr-how"><b>How it works.</b> Tap anywhere, or press <span class="gr-keys">space</span>. Every pack you
        eat is a point. Other Pokemon are out there too and touching one ends the run. Get to 100 and Trubbish evolves into Garbodor for the rest of the game.<br>
        <b>Nothing is saved anywhere but your own phone</b>, and there is no account and no server. Your best
        score lives in this browser and goes away if you clear it.</p>

      <p class="gr-how"><a href="/games/">The other games</a> are quicker: a set guesser, a silhouette round and
        a trivia run. This one is for a longer wait.</p>
    </div>
  </section>
</main>
${footer()}
<script>
(function () {
  "use strict";
  var cv = document.getElementById("grCanvas");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var W = cv.width, H = cv.height;

  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var elScore = document.getElementById("grScore");
  var elBest = document.getElementById("grBest");
  var elOver = document.getElementById("grOver");
  var elTitle = document.getElementById("grTitle");
  var elMsg = document.getElementById("grMsg");
  var elStart = document.getElementById("grStart");

  var BEST_KEY = "gr-best";
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) {}
  elBest.textContent = "Best " + best;

  var running = false, raf = 0;
  var EVOLVE_AT = 100;

  // Preload the mascots. The ready flag stays false until the file is actually
  // decodable, and every draw checks it, so nothing is ever drawn from a
  // half-loaded image.
  function sprite(src) {
    var o = { img: new Image(), ready: false };
    o.img.onload = function () { o.ready = o.img.naturalWidth > 0; };
    o.img.onerror = function () { o.ready = false; };
    o.img.src = src;
    return o;
  }
  var SP_TRUB = sprite("/assets/trubbish.webp");
  var SP_GARB = sprite("/assets/garbodor.webp");

  // What counts as garbage. Kept deliberately food-and-bin heavy: it reads as
  // rubbish at a glance, which matters more than variety when the thing is
  // 26 pixels wide and moving.
  // EVERYTHING A TRUBBISH WOULD EAT. The list is long on purpose: at one item
  // every second or so, a short list starts repeating inside the first run and
  // the street stops feeling like a street.
  var JUNK = [
    "\uD83C\uDF4C", "\uD83C\uDF4E", "\uD83C\uDF55", "\uD83D\uDDD1\uFE0F", "\uD83E\uDD6B",
    "\uD83C\uDF57", "\uD83E\uDDC3", "\uD83E\uDDB4", "\uD83E\uDD64", "\uD83D\uDCF0",
    "\uD83C\uDF6C", "\uD83E\uDDFB", "\uD83C\uDF54", "\uD83C\uDF5F", "\uD83C\uDF2D",
    "\uD83E\uDD5A", "\uD83C\uDF69", "\uD83C\uDF70", "\uD83C\uDF3D", "\uD83E\uDDC0",
    "\uD83C\uDF53", "\uD83C\uDF49", "\uD83C\uDF4D", "\uD83E\uDD51", "\uD83C\uDF52",
    "\uD83E\uDD5A", "\uD83E\uDD68", "\uD83C\uDF7F", "\uD83E\uDDCB", "\uD83E\uDDC3",
    "\uD83D\uDC5F", "\uD83E\uDDE6", "\uD83D\uDCDA", "\uD83D\uDCE6", "\uD83E\uDEB6",
    "\uD83D\uDD0B", "\uD83E\uDD5C", "\uD83C\uDF6D", "\uD83C\uDF6B", "\uD83E\uDD5F"
  ];

  // The hazards. Other Pokemon out on the street: touch one and the run is over.
  // Drawn from the same official-artwork source as the two mascots, sized down,
  // so they read as a Pokemon rather than as an abstract obstacle.
  var FOES = [92, 109, 88, 316, 434, 453, 451];
  var foeSprites = {};
  // Preloaded HERE and not beside the other two sprites, because FOES is
  // declared in this block: a var hoists the name but not the value, so a loop
  // above this line read undefined.length, threw on load, and took the entire
  // game with it while the page still looked fine.
  for (var fi = 0; fi < FOES.length; fi++) {
    foeSprites[FOES[fi]] = sprite("/assets/foes/" + FOES[fi] + ".webp");
  }

  // One lane, the full height of a portrait canvas. It stays a "lane" rather
  // than becoming loose variables because every draw and step already takes one.
  function makeLane(top, height) {
    return {
      top: top, h: height,
      y: top + height / 2, vy: 0, flip: 1, alive: true, score: 0,
      obs: [], packs: [], nextObs: 60, nextPack: 90, chase: 0,
      evolved: false, evoFlash: 0, tilt: 0, land: 0,
    };
  }
  var lanes = [];
  var speed = 0, t = 0;

  function reset() {
    speed = calm ? 1.9 : 2.4;
    t = 0;
    lanes = [makeLane(0, H)];
    draw();
  }

  function flip(i) {
    var L = lanes[i];
    if (!L || !L.alive) return;
    L.flip = -L.flip;
    // The kick. Without it a tap only reverses acceleration and the first few
    // frames go nowhere, which reads as lag even though nothing is late.
    L.vy = 4.6 * L.flip;
    L.tilt = -0.5 * L.flip;
  }

  // ---- world ----------------------------------------------------------
  function step(L) {
    if (!L.alive) return;
    var floor = L.top + L.h - 26, ceil = L.top + 26;
    L.vy += 1.05 * L.flip;
    L.y += L.vy;
    if (L.y > floor) { if (L.vy > 6) L.land = 6; L.y = floor; L.vy = 0; }
    if (L.y < ceil) { if (L.vy < -6) L.land = 6; L.y = ceil; L.vy = 0; }
    L.tilt *= 0.86;
    if (L.land > 0) L.land -= 1;

    L.nextObs -= 1; L.nextPack -= 1;
    // THE HAZARD is another Pokemon, on the floor or the ceiling. Touch it and
    // the run ends.
    if (L.nextObs <= 0) {
      L.obs.push({
        x: W + 20, onFloor: Math.random() < 0.5, w: 42, h: 42,
        foe: FOES[Math.floor(Math.random() * FOES.length)],
      });
      L.nextObs = Math.max(60, 130 - t / 60) + Math.random() * 46;
    }
    // THE PICKUP is rubbish, which is the entire point of being a Trubbish.
    //
    // RUBBISH COMES IN TRAILS, NOT SINGLES. It used to spawn one piece per
    // second at a uniformly random height, which sounds generous and is not:
    // the catch window is 60px in a lane over 600px tall, so a player who is
    // flapping rather than hunting collects about one in five by coincidence.
    // Measured with a bot that survived 25 seconds: score 5. At that rate the
    // hundred needed to evolve is over eight minutes of unbroken play, so the
    // Garbodor evolution, which is the whole reward the game is built around,
    // was something almost nobody would ever see.
    //
    // A trail is the endless-runner answer: several pieces along one gentle
    // arc, close enough together that catching the first means you are already
    // lined up for the rest. It turns collecting into a line you choose to fly
    // instead of a coin flip, and it makes a hundred a target you can actually
    // reach in a good run.
    if (L.nextPack <= 0) {
      var n = 3 + Math.floor(Math.random() * 3);
      // Stay out of the floor and ceiling rows: that is where hazards sit, and
      // rubbish you cannot take without dying is not a reward, it is a trap.
      var lo = L.top + 70, hi = L.top + L.h - 70;
      var y0 = lo + Math.random() * (hi - lo);
      var dir = Math.random() < 0.5 ? -1 : 1;
      for (var k = 0; k < n; k++) {
        var yy = y0 + dir * 30 * Math.sin((k / (n - 1)) * Math.PI);
        if (yy < lo) yy = lo; if (yy > hi) yy = hi;
        L.packs.push({
          x: W + 20 + k * 34, y: yy, got: false,
          emoji: JUNK[Math.floor(Math.random() * JUNK.length)],
        });
      }
      L.nextPack = 150 + Math.random() * 90;
    }

    var i;
    for (i = L.obs.length - 1; i >= 0; i--) {
      var o = L.obs[i];
      o.x -= speed;
      if (o.x + o.w < -20) { L.obs.splice(i, 1); continue; }
      var oy = o.onFloor ? L.top + L.h - o.h : L.top;
      if (o.x < 96 && o.x + o.w > 52 && L.y + 18 > oy && L.y - 18 < oy + o.h) L.alive = false;
      // A near miss flashes the ring, so squeezing past something reads as a
      // thing you did rather than a thing that happened to you.
      // A NEAR MISS HAS TO BE NEAR. This tested horizontal overlap only, so the
      // ring lit gold on essentially every obstacle that went past, including
      // ones more than 200px away: measured 465 gold rings against 1079 red
      // while the player hovered nowhere near any of them. Within 70px of the
      // hazard row is close enough to have felt like something.
      else if (!o.near && o.x < 96 && o.x + o.w > 52) {
        var gap = L.y < oy ? oy - L.y : L.y - (oy + o.h);
        if (gap < 70) o.near = 1;
      }
    }
    for (i = L.packs.length - 1; i >= 0; i--) {
      var p = L.packs[i];
      p.x -= speed;
      if (p.x < -20) { L.packs.splice(i, 1); continue; }
      if (!p.got && Math.abs(p.x - 74) < 28 && Math.abs(p.y - L.y) < 34) {
        p.got = true; L.score += 1; L.packs.splice(i, 1);
        // EVOLVE AT A HUNDRED. Trubbish becomes Garbodor for the rest of the
        // run and stays that way: there is no going back, which is the point of
        // an evolution and also the reward for surviving that long.
        if (!L.evolved && L.score >= EVOLVE_AT) { L.evolved = true; L.evoFlash = 42; }
      }
    }
    if (!L.alive) L.chase = 1;
  }

  // ---- drawing: everything here is our own shapes ---------------------
  function trubbish(x, y, up, evolved, tilt, land) {
    var SP = evolved ? SP_GARB : SP_TRUB;
    if (SP.ready) {
      var S = evolved ? 76 : 58;
      ctx.save();
      ctx.translate(x, y);
      if (!up) ctx.scale(1, -1);
      if (tilt) ctx.rotate(tilt);
      // A squash on landing. Four frames, and it is the difference between a
      // sprite that arrives and a character that lands.
      if (land > 0) ctx.scale(1 + land * 0.03, 1 - land * 0.04);
      ctx.drawImage(SP.img, -S / 2, -S / 2, S, S);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (!up) ctx.scale(1, -1);
    // BRIGHT, WITH AN OUTLINE. He started olive on an olive street, which is
    // accurate to the character and useless in a game: at 24px on a phone, in a
    // shop queue, the thing you are steering has to be the lightest object on
    // screen. Same reason the packs are mustard.
    ctx.strokeStyle = "#0B1108";
    ctx.lineWidth = 3;
    ctx.fillStyle = "#A9C07C";
    ctx.beginPath();
    ctx.moveTo(-13, 12); ctx.lineTo(-9, -6); ctx.lineTo(-3, -12);
    ctx.lineTo(4, -5); ctx.lineTo(11, -11); ctx.lineTo(13, 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#5E6B45";
    ctx.fillRect(-13, 9, 26, 4);
    ctx.fillStyle = "#F4F1E2";
    ctx.beginPath(); ctx.arc(-4, 0, 3.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 1, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = "#14200C";
    ctx.beginPath(); ctx.arc(-3.4, 0.4, 1.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(5.6, 1.4, 1.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function garbodor(x, y, h) {
    if (SP_GARB.ready) {
      var S = h * 1.5;
      ctx.drawImage(SP_GARB.img, x - S / 2, y - S / 2 + 4, S, S);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#54614A";
    ctx.beginPath();
    ctx.moveTo(-26, h / 2); ctx.lineTo(-20, -h / 4); ctx.lineTo(-6, -h / 2);
    ctx.lineTo(8, -h / 3); ctx.lineTo(22, -h / 5); ctx.lineTo(26, h / 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#D9482B";
    ctx.beginPath(); ctx.arc(-8, -h / 5, 4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -h / 6, 4, 0, 7); ctx.fill();
    ctx.restore();
  }

  function pack(x, y) {
    ctx.fillStyle = "#EFC94C";
    ctx.fillRect(x - 8, y - 11, 16, 22);
    ctx.fillStyle = "#D9482B";
    ctx.fillRect(x - 8, y - 4, 16, 5);
    ctx.fillStyle = "#22384F";
    ctx.fillRect(x - 8, y - 11, 16, 3);
  }

  function drawLane(L, i) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.top, W, L.h); ctx.clip();

    var g = ctx.createLinearGradient(0, L.top, 0, L.top + L.h);
    g.addColorStop(0, "#232D1B"); g.addColorStop(1, "#333F26");
    ctx.fillStyle = g; ctx.fillRect(0, L.top, W, L.h);

    if (!calm) {
      ctx.fillStyle = "rgba(97,106,79,.30)";
      for (var k = 0; k < 7; k++) {
        var bx = (k * 150 - (t * speed * 0.28) % 1050 + 1050) % 1050 - 60;
        ctx.fillRect(bx, L.top + L.h - 74, 44, 74);
      }
    }
    ctx.fillStyle = "#3C4A2C";
    ctx.fillRect(0, L.top + L.h - 16, W, 16);
    ctx.fillRect(0, L.top, W, 16);

    for (var a = 0; a < L.obs.length; a++) {
      var o = L.obs[a];
      var oy = o.onFloor ? L.top + L.h - o.h : L.top;
      // A red ring under every hazard, always drawn, whether or not the sprite
      // has loaded. A player must never be killed by something they could not
      // see because a file was still downloading.
      ctx.strokeStyle = o.near ? "#EFC94C" : "#D9482B"; ctx.lineWidth = o.near ? 4 : 3;
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, oy + o.h / 2, o.w * 0.58, 0, 7); ctx.stroke();
      var fs = foeSprites[o.foe];
      if (fs && fs.ready) ctx.drawImage(fs.img, o.x, oy, o.w, o.h);
      else { ctx.fillStyle = "#D9482B"; ctx.fillRect(o.x + 8, oy + 8, o.w - 16, o.h - 16); }
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var b = 0; b < L.packs.length; b++) {
      var pk = L.packs[b];
      ctx.fillStyle = "rgba(239,201,76,.22)";
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 17, 0, 7); ctx.fill();
      ctx.font = "24px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
      ctx.fillText(pk.emoji, pk.x, pk.y);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    if (L.chase > 0) { garbodor(14 + L.chase * 30, L.top + L.h - 34, 46); L.chase += 0.06; }

    trubbish(74, L.y, L.flip > 0, L.evolved, L.tilt, L.land);

    // The evolution moment. A gold wash and a word, for about two thirds of a
    // second, then it is gone and you are Garbodor.
    if (L.evoFlash > 0) {
      ctx.fillStyle = "rgba(239,201,76," + (L.evoFlash / 90) + ")";
      ctx.fillRect(0, L.top, W, L.h);
      ctx.fillStyle = "#2A2410";
      ctx.font = "700 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EVOLVED", W / 2, L.top + L.h / 2);
      ctx.textAlign = "left";
      L.evoFlash -= 1;
    }

    ctx.fillStyle = "#F4F1E2";
    ctx.font = "700 20px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(L.score), W - 12, L.top + 30);
    if (!L.evolved) {
      ctx.fillStyle = "rgba(244,241,226,.55)";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText((EVOLVE_AT - L.score) + " to evolve", W - 12, L.top + 46);
    } else {
      ctx.fillStyle = "#EFC94C";
      ctx.font = "700 11px ui-monospace, monospace";
      ctx.fillText("GARBODOR", W - 12, L.top + 46);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < lanes.length; i++) drawLane(lanes[i], i);
  }

  function tick() {
    if (!running) return;
    // Hold the world still for three quarters of a second so the player can
    // get a thumb back on the screen before anything moves.
    if (countIn > 0) {
      countIn -= 1;
      draw();
      ctx.fillStyle = "rgba(11,17,8,.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#F4F1E2";
      ctx.font = "700 64px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.ceil(countIn / 15)), W / 2, H / 2);
      ctx.textAlign = "left";
      raf = requestAnimationFrame(tick);
      return;
    }
    // NORMALISE TO 60Hz. Gravity, obstacle motion and the speed ramp were all
    // per animation frame, so a 120Hz phone ran the whole game at double speed.
    // The double-rAF bug proved the consequence exactly: twice the callbacks
    // gave twice the world speed. Stepping a fixed number of times keeps the
    // physics deterministic, which the pack counts and the difficulty curve
    // both assume, rather than scaling a delta into them.
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    acc += Math.min(now - (last || now), 100);
    last = now;
    var steps = 0;
    while (acc >= 16.667 && steps < 4) {
      acc -= 16.667;
      steps += 1;
      t += 1;
      speed += calm ? 0.00025 : 0.00045;
      for (var i = 0; i < lanes.length; i++) step(lanes[i]);
    }
    draw();

    if (!lanes[0].alive) return end();
    elScore.textContent = String(lanes[0].score);
    raf = requestAnimationFrame(tick);
  }

  function end() {
    running = false;
    cancelAnimationFrame(raf);
    var sc = lanes[0].score;
    if (sc > best) {
      best = sc;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      elTitle.textContent = "New best";
    } else {
      elTitle.textContent = "A wild Pokemon got you";
    }
    elBest.textContent = "Best " + best;
    elMsg.textContent = sc + " piece" + (sc === 1 ? "" : "s") + " of rubbish eaten." +
      (lanes[0].evolved ? " You made it to Garbodor." : " " + (EVOLVE_AT - sc) + " more and you would have evolved.");
    elStart.textContent = "Go again";
    elOver.hidden = false;
  }

  var countIn = 0, acc = 0, last = 0;
  function start() {
    paused = false;
    reset();
    countIn = calm ? 0 : 45;
    acc = 0; last = 0;
    running = true;
    elOver.hidden = true;
    elScore.textContent = "0";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  // ---- input ----------------------------------------------------------
  // THE HANDLER GOES ON THE STAGE, NOT THE CANVAS. The start overlay is
  // positioned over the canvas, so a tap while it is up lands on the overlay
  // and a canvas listener never hears it: tapping the board to begin did
  // nothing and you had to find the button. The stage contains both.
  var stage = document.getElementById("grStage");
  stage.addEventListener("pointerdown", function (e) {
    // Let the actual button behave like a button.
    if (e.target && e.target.closest && e.target.closest("button")) return;
    e.preventDefault();
    if (running) flip(0);
    else if (paused) resume();
    else if (!elOver.hidden) start();
  }, { passive: false });
  document.addEventListener("keydown", function (e) {
    // AUTO-REPEAT WAS AN INVINCIBILITY CHEAT. Holding space fired flip() at the
    // OS repeat rate, and since every flip sets vy to a fixed kick the player
    // simply hovered mid-lane, where nothing can reach: hazards only ever sit
    // on the floor or the ceiling. Measured 40 seconds held with no death and
    // an unbounded score, which makes the best score meaningless. A held key is
    // one press.
    if (e.repeat) return;
    var k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") {
      if (running) { e.preventDefault(); flip(0); }
      else if (paused) { e.preventDefault(); resume(); }
      else if (!elOver.hidden) { e.preventDefault(); start(); }
    }
  });

  elStart.addEventListener("click", function () { if (paused) resume(); else start(); });

  // Nobody wants to come back to a tab that kept playing without them.
  // PAUSE IS A STATE, NOT A SECOND BUTTON. This used to assign elStart.onclick
  // on top of the addEventListener already bound to start(), so one click ran
  // BOTH: start() scheduled a loop, the resume closure scheduled another and
  // overwrote raf, and the first became uncancellable. Two loops means two
  // step() calls per frame, so the game ran at double speed for the rest of the
  // session, measured at exactly 2.00 draws per frame. It also called reset(),
  // so a button saying "Resume" threw the run away and replayed the count-in.
  // And the stale closure survived a keyboard restart, so a later "Go again"
  // double-started too.
  var paused = false;
  function resume() {
    if (!paused) return;
    paused = false;
    elOver.hidden = true;
    running = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && running) {
      running = false;
      paused = true;
      cancelAnimationFrame(raf);
      elTitle.textContent = "Paused";
      elMsg.textContent = "You looked away. The line probably moved.";
      elStart.textContent = "Resume";
      elOver.hidden = false;
    }
  });

  // FIT THE BOARD TO THE SPACE THAT IS LEFT. The canvas keeps its 420x680
  // drawing surface, so none of the game logic cares, and only the CSS height
  // changes. Measured from the stage's own top to the bottom of the viewport so
  // it works whatever the header and the copy above it happen to be.
  // SET BOTH DIMENSIONS OR THE PICTURE IS SQUASHED. This set only the height
  // while the CSS still said width:100%, so on any screen where the available
  // height was the binding constraint the 420x680 drawing surface was stretched
  // unevenly across it. Measured: a 390x667 phone rendered the board at 46 per
  // cent of its correct height, so Trubbish, the Pokemon and the circular
  // hazard rings were all flattened, and the rings were ellipses. Every phone
  // size tested was squashed to some degree.
  //
  // The aspect ratio is fixed at 420:680, so the width follows from whichever
  // of the two constraints binds.
  function fit() {
    var stageEl = document.getElementById("grStage");
    var r = stageEl.getBoundingClientRect();
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    var availH = Math.max(260, Math.min(vh - r.top - 12, 680));
    var availW = stageEl.clientWidth || cv.clientWidth || W;
    var scale = Math.min(availW / W, availH / H);
    cv.style.width = Math.round(W * scale) + "px";
    cv.style.height = Math.round(H * scale) + "px";
  }
  window.addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  fit();

  reset();
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/games/garbage-run.html"), page);
console.log("Wrote public/games/garbage-run.html");
