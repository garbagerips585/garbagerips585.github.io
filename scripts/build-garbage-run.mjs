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
// TWO PLAYERS ON ONE PHONE, which is the part a queue actually needs. Duel mode
// splits the screen into two lanes, one per thumb, and the last one alive wins.
// There is no server anywhere in this project and there never will be, so
// multiplayer had to mean two people and one device. That turns out to be the
// right answer for a line anyway: nobody is going to install anything.
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
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const desc =
  "A one thumb arcade game for the restock line. Flip Trubbish between floor and ceiling, dodge the junk, and duel a friend on the same phone.";

const style = `
.gr-wrap{max-width:760px;margin:0 auto}
.gr-stage{position:relative;border:3px solid var(--navy);border-radius:14px;overflow:hidden;
  box-shadow:var(--hard-lg);background:#16210F;touch-action:manipulation;user-select:none}
.gr-stage canvas{display:block;width:100%;height:auto;image-rendering:auto}
.gr-hud{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:center;justify-content:space-between;
  margin:var(--s4) 0 var(--s3)}
.gr-score{font:400 var(--t-l)/1 var(--display);color:var(--ink)}
.gr-best{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.gr-modes{display:flex;gap:var(--s2)}
.gr-mode{min-height:44px;padding:0 var(--s4);border:2px solid var(--navy);border-radius:999px;
  background:var(--card);color:var(--ink);font:700 var(--t-label)/1 var(--body);cursor:pointer}
.gr-mode[aria-pressed="true"]{background:var(--navy);color:#F4F1E2}
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
<link rel="stylesheet" href="/assets/fonts.css">
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
        <div class="gr-modes" role="group" aria-label="Game mode">
          <button class="gr-mode" id="grSolo" type="button" aria-pressed="true">Solo</button>
          <button class="gr-mode" id="grDuel" type="button" aria-pressed="false">Two players</button>
        </div>
      </div>

      <div class="gr-stage" id="grStage">
        <canvas id="grCanvas" width="720" height="340" role="img"
          aria-label="Garbage Run. Trubbish runs along a Rochester street and you tap to flip him between the floor and the ceiling."></canvas>
        <div class="gr-over" id="grOver">
          <h2 id="grTitle">Garbage Run</h2>
          <p id="grMsg">Tap the screen, or press space, to flip. Eat the rubbish, dodge the Pokemon.</p>
          <button class="gr-go" id="grStart" type="button">Start</button>
        </div>
      </div>

      <p class="gr-how"><b>Solo.</b> Tap anywhere, or press <span class="gr-keys">space</span>. Every pack you
        eat is a point. Other Pokemon are out there too and touching one ends the run. Get to 100 and Trubbish evolves into Garbodor for the rest of the game.<br>
        <b>Two players.</b> The screen splits. Left thumb is the top lane, right thumb is the bottom lane, or
        <span class="gr-keys">A</span> and <span class="gr-keys">L</span> on a keyboard. Last one still running
        wins. Hand the phone over and settle it.<br>
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
  var bSolo = document.getElementById("grSolo");
  var bDuel = document.getElementById("grDuel");

  var BEST_KEY = "gr-best";
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; } catch (e) {}
  elBest.textContent = "Best " + best;

  var duel = false, running = false, raf = 0;
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

  // A lane is one player's strip of the world. Solo uses one full height lane,
  // duel splits the canvas so two thumbs never fight over the same space.
  function makeLane(top, height, keyName) {
    return {
      top: top, h: height, key: keyName,
      y: top + height / 2, vy: 0, flip: 1, alive: true, score: 0,
      obs: [], packs: [], nextObs: 60, nextPack: 90, chase: 0,
      evolved: false, evoFlash: 0,
    };
  }
  var lanes = [];
  var speed = 0, t = 0;

  function reset() {
    speed = calm ? 2.4 : 3.1;
    t = 0;
    lanes = duel
      ? [makeLane(0, H / 2, "a"), makeLane(H / 2, H / 2, "l")]
      : [makeLane(0, H, "space")];
    draw();
  }

  function flip(i) {
    var L = lanes[i];
    if (!L || !L.alive) return;
    L.flip = -L.flip;
  }

  // ---- world ----------------------------------------------------------
  function step(L) {
    if (!L.alive) return;
    var floor = L.top + L.h - 26, ceil = L.top + 26;
    L.vy += 0.62 * L.flip;
    L.y += L.vy;
    if (L.y > floor) { L.y = floor; L.vy = 0; }
    if (L.y < ceil) { L.y = ceil; L.vy = 0; }

    L.nextObs -= 1; L.nextPack -= 1;
    // THE HAZARD is another Pokemon, on the floor or the ceiling. Touch it and
    // the run ends.
    if (L.nextObs <= 0) {
      L.obs.push({
        x: W + 20, onFloor: Math.random() < 0.5, w: 42, h: 42,
        foe: FOES[Math.floor(Math.random() * FOES.length)],
      });
      L.nextObs = Math.max(46, 104 - t / 70) + Math.random() * 40;
    }
    // THE PICKUP is rubbish, which is the entire point of being a Trubbish.
    if (L.nextPack <= 0) {
      L.packs.push({
        x: W + 20, y: L.top + 44 + Math.random() * (L.h - 88), got: false,
        emoji: JUNK[Math.floor(Math.random() * JUNK.length)],
      });
      L.nextPack = 34 + Math.random() * 34;
    }

    var i;
    for (i = L.obs.length - 1; i >= 0; i--) {
      var o = L.obs[i];
      o.x -= speed;
      if (o.x + o.w < -20) { L.obs.splice(i, 1); continue; }
      var oy = o.onFloor ? L.top + L.h - o.h : L.top;
      if (o.x < 116 && o.x + o.w > 78 && L.y + 18 > oy && L.y - 18 < oy + o.h) L.alive = false;
    }
    for (i = L.packs.length - 1; i >= 0; i--) {
      var p = L.packs[i];
      p.x -= speed;
      if (p.x < -20) { L.packs.splice(i, 1); continue; }
      if (!p.got && Math.abs(p.x - 96) < 24 && Math.abs(p.y - L.y) < 28) {
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
  function trubbish(x, y, up, evolved) {
    var SP = evolved ? SP_GARB : SP_TRUB;
    if (SP.ready) {
      var S = evolved ? 76 : 58;
      ctx.save();
      ctx.translate(x, y);
      if (!up) ctx.scale(1, -1);
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
      ctx.strokeStyle = "#D9482B"; ctx.lineWidth = 3;
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

    trubbish(96, L.y, L.flip > 0, L.evolved);

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
    if (duel) {
      ctx.textAlign = "left";
      ctx.fillStyle = L.alive ? "#EFC94C" : "#D9482B";
      ctx.font = "700 13px ui-monospace, monospace";
      ctx.fillText(i === 0 ? "TOP" : "BOTTOM", 12, L.top + 28);
    }
    ctx.restore();

    if (duel && i === 0) {
      ctx.fillStyle = "#0B1108";
      ctx.fillRect(0, H / 2 - 2, W, 4);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < lanes.length; i++) drawLane(lanes[i], i);
  }

  function tick() {
    if (!running) return;
    t += 1;
    speed += calm ? 0.00035 : 0.0007;
    for (var i = 0; i < lanes.length; i++) step(lanes[i]);
    draw();

    var live = lanes.filter(function (L) { return L.alive; });
    if ((duel && live.length <= 1) || (!duel && !lanes[0].alive)) return end();

    elScore.textContent = duel
      ? lanes[0].score + " - " + lanes[1].score
      : String(lanes[0].score);
    raf = requestAnimationFrame(tick);
  }

  function end() {
    running = false;
    cancelAnimationFrame(raf);
    if (duel) {
      var a = lanes[0], b = lanes[1];
      var win = a.alive ? "Top thumb wins" : b.alive ? "Bottom thumb wins" : "Both of you, at once";
      elTitle.textContent = win;
      elMsg.textContent = "Top " + a.score + ", bottom " + b.score + ". Best of three, then let the line move.";
    } else {
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
    }
    elStart.textContent = "Go again";
    elOver.hidden = false;
  }

  function start() {
    reset();
    running = true;
    elOver.hidden = true;
    elScore.textContent = duel ? "0 - 0" : "0";
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  // ---- input ----------------------------------------------------------
  function laneFromPoint(clientY) {
    if (!duel) return 0;
    var r = cv.getBoundingClientRect();
    return clientY - r.top < r.height / 2 ? 0 : 1;
  }
  cv.addEventListener("pointerdown", function (e) {
    if (!running) return;
    e.preventDefault();
    flip(laneFromPoint(e.clientY));
  });
  document.addEventListener("keydown", function (e) {
    var k = e.key.toLowerCase();
    if (k === " " || k === "spacebar") {
      if (running) { e.preventDefault(); flip(0); }
      else if (!elOver.hidden) { e.preventDefault(); start(); }
    } else if (duel && running && k === "a") { e.preventDefault(); flip(0); }
    else if (duel && running && k === "l") { e.preventDefault(); flip(1); }
  });

  elStart.addEventListener("click", start);
  function setMode(isDuel) {
    duel = isDuel;
    bSolo.setAttribute("aria-pressed", String(!isDuel));
    bDuel.setAttribute("aria-pressed", String(isDuel));
    running = false;
    cancelAnimationFrame(raf);
    elTitle.textContent = isDuel ? "Two players, one phone" : "Garbage Run";
    elMsg.textContent = isDuel
      ? "Top half is one thumb, bottom half is the other. Last one still running wins."
      : "Tap the screen, or press space, to flip. That is the whole game.";
    elStart.textContent = "Start";
    elOver.hidden = false;
    reset();
  }
  bSolo.addEventListener("click", function () { setMode(false); });
  bDuel.addEventListener("click", function () { setMode(true); });

  // Nobody wants to come back to a tab that kept playing without them.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && running) {
      running = false;
      cancelAnimationFrame(raf);
      elTitle.textContent = "Paused";
      elMsg.textContent = "You looked away. The line probably moved.";
      elStart.textContent = "Resume";
      elOver.hidden = false;
      elStart.onclick = function () { elStart.onclick = null; elOver.hidden = true; running = true; raf = requestAnimationFrame(tick); };
    }
  });

  reset();
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/games/garbage-run.html"), page);
console.log("Wrote public/games/garbage-run.html");
