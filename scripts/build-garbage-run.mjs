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
// THE ART IS DRAWN, NOT BORROWED. Trubbish and Garbodor are canvas shapes in
// the site's own palette, the same decision as the booster wrappers: this site
// does not reproduce official Pokemon art. A green bag with a torn top and two
// eyes reads as Trubbish at 24 pixels on a phone, and it is ours.
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
        keep him off the junk. Garbodor is right behind you and he does not get tired.</p>

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
        <canvas id="grCanvas" width="720" height="440" role="img"
          aria-label="Garbage Run. Trubbish runs along a Rochester street and you tap to flip him between the floor and the ceiling."></canvas>
        <div class="gr-over" id="grOver">
          <h2 id="grTitle">Garbage Run</h2>
          <p id="grMsg">Tap the screen, or press space, to flip. That is the whole game.</p>
          <button class="gr-go" id="grStart" type="button">Start</button>
        </div>
      </div>

      <p class="gr-how"><b>Solo.</b> Tap anywhere, or press <span class="gr-keys">space</span>. Every pack you
        grab is a point and the street speeds up.<br>
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

  // A lane is one player's strip of the world. Solo uses one full height lane,
  // duel splits the canvas so two thumbs never fight over the same space.
  function makeLane(top, height, keyName) {
    return {
      top: top, h: height, key: keyName,
      y: top + height / 2, vy: 0, flip: 1, alive: true, score: 0,
      obs: [], packs: [], nextObs: 60, nextPack: 90, chase: 0,
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
    if (L.nextObs <= 0) {
      var onFloor = Math.random() < 0.5;
      L.obs.push({ x: W + 20, onFloor: onFloor, w: 16 + Math.random() * 14, h: 22 + Math.random() * 20 });
      L.nextObs = Math.max(26, 78 - t / 90) + Math.random() * 26;
    }
    if (L.nextPack <= 0) {
      L.packs.push({ x: W + 20, y: L.top + 40 + Math.random() * (L.h - 80), got: false });
      L.nextPack = 70 + Math.random() * 70;
    }

    var i;
    for (i = L.obs.length - 1; i >= 0; i--) {
      var o = L.obs[i];
      o.x -= speed;
      if (o.x + o.w < -20) { L.obs.splice(i, 1); continue; }
      var oy = o.onFloor ? L.top + L.h - o.h : L.top;
      if (o.x < 60 && o.x + o.w > 34 && L.y + 13 > oy && L.y - 13 < oy + o.h) L.alive = false;
    }
    for (i = L.packs.length - 1; i >= 0; i--) {
      var p = L.packs[i];
      p.x -= speed;
      if (p.x < -20) { L.packs.splice(i, 1); continue; }
      if (!p.got && Math.abs(p.x - 47) < 20 && Math.abs(p.y - L.y) < 24) {
        p.got = true; L.score += 1; L.packs.splice(i, 1);
      }
    }
    if (!L.alive) L.chase = 1;
  }

  // ---- drawing: everything here is our own shapes ---------------------
  function trubbish(x, y, up) {
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
      ctx.fillStyle = "#B5471F";
      ctx.fillRect(o.x, o.onFloor ? L.top + L.h - o.h : L.top, o.w, o.h);
    }
    for (var b = 0; b < L.packs.length; b++) pack(L.packs[b].x, L.packs[b].y);

    if (L.chase > 0) { garbodor(20 + L.chase * 26, L.top + L.h - 34, 46); L.chase += 0.06; }
    else garbodor(-6, L.top + L.h - 34, 46);

    trubbish(47, L.y, L.flip > 0);

    ctx.fillStyle = "#F4F1E2";
    ctx.font = "700 20px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(L.score), W - 12, L.top + 30);
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
        elTitle.textContent = "Garbodor got you";
      }
      elBest.textContent = "Best " + best;
      elMsg.textContent = sc + " pack" + (sc === 1 ? "" : "s") + " grabbed.";
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
