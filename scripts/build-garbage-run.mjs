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
.gr-wrap{max-width:560px;margin:0 auto}

/* THE PAGE IS A GRID SO THE BOARD CAN MOVE WITHOUT THE COPY MOVING WITH IT.
   Every child of .gr-layout is placed by name, which is the only way to have
   one DOM order (heading, score, board, lede, help) read as a stack on a phone
   and as board-beside-copy on a desktop without duplicating any of it. */
.gr-layout{display:grid;grid-template-areas:"title" "hud" "board" "lede" "how" "other"}
.gr-title{grid-area:title;margin-bottom:var(--s2)}
.gr-hud{grid-area:hud}
.gr-board{grid-area:board;min-width:0}
.gr-lede{grid-area:lede;margin-top:var(--s5)}
.gr-how{grid-area:how}
.gr-other{grid-area:other}

/* ON A SHORT PHONE THE GAME IS THE PAGE. Getting the aspect ratio right meant
   the board could only be as wide as the leftover height allowed, and on a
   667px screen the heading, the lede and the score left so little that the
   board came out 168px wide: the correct shape and too small to play. The copy
   is still there, it just stops taking the space the game needs. Everything
   below the board is unaffected, so nothing is lost, only moved down.
   THE LEDE IS NOW BELOW THE BOARD AT EVERY WIDTH rather than hidden under a
   height query, which is strictly better than what the query was doing: the
   words stay on the page for a reader and for a crawler, and a 390x844 phone
   stops paying 130px of board height for copy it can read after its first run.
   Measured at 390x844: board 277x449 with the lede above it, 372x602 with the
   lede below, which is 1.8x the playing area on the commonest phone there is. */
@media (max-height: 740px) {
  .gr-title{font-size:var(--t-l);margin-bottom:4px}
  .gr-hud{margin:var(--s2) 0}
  .gr-wrap .crumbs{display:none}
}

.gr-board{display:flex;justify-content:center}
/* WIDTH:MIN-CONTENT SO THE FRAME HUGS THE BOARD. The stage used to be a fixed
   420px box with the canvas centred inside it, and the canvas is only as wide
   as the aspect ratio allows: measured 44px of dead stage either side of the
   picture on a 390px phone and 48px on a 1440px desktop, in a colour one shade
   off the board's own, so the game looked like it had a mount round it. */
.gr-stage{position:relative;width:min-content;border:3px solid var(--keyline);border-radius:14px;
  overflow:hidden;box-shadow:var(--hard-lg);background:#101010;user-select:none;
  -webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.gr-stage canvas{display:block;image-rendering:auto}
/* touch-action none, not manipulation: manipulation still allows the browser's
   double-tap-to-zoom heuristic, which on a game that is nothing but taps means
   a fast double flip can zoom the page instead. overscroll-behavior stops a
   flick near the edge dragging the whole page. */
.gr-stage{touch-action:none;overscroll-behavior:contain}
.gr-stage canvas{touch-action:none}

.gr-hud{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:baseline;justify-content:flex-start;
  margin:var(--s4) 0 var(--s3)}
.gr-score{font:400 var(--t-xl)/1 var(--display);color:var(--ink);font-variant-numeric:tabular-nums}
.gr-best{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.gr-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--s3);background:rgba(10,10,10,.88);color:var(--chrome-ink);text-align:center;padding:var(--s4)}
.gr-over[hidden]{display:none}
.gr-over h2{color:var(--chrome-ink);font:400 var(--t-xl)/1 var(--display)}
.gr-over p{color:var(--foot-ink);max-width:30em;font-size:var(--t-sm);line-height:1.5}
.gr-go{min-height:52px;padding:0 var(--s5);border:3px solid var(--gold);border-radius:999px;
  /* --on-accent, not the #2A2410 that was here: that is a hand-mixed dark
     olive-brown for a gold button, i.e. a fifth colour invented in a page
     builder for a job the palette now has a token for. It measures 7.11:1 on
     --gold and 10.28:1 on the --mustard the button takes on hover. */
  background:var(--gold);color:var(--on-accent);font:700 var(--t-m)/1 var(--body);cursor:pointer}
.gr-go:hover{background:var(--mustard);border-color:var(--mustard)}
.gr-how{margin-top:var(--s5);color:var(--ink-2);font-size:var(--t-sm);line-height:1.6;max-width:44em}
.gr-how b{color:var(--ink)}
.gr-keys{font:700 var(--t-micro)/1 var(--mono);background:var(--card);border:1px solid var(--hair);
  border-radius:5px;padding:3px 6px;white-space:nowrap}

/* DESKTOP HAD NEVER BEEN DESIGNED and the numbers said so. Measured before this
   block: the board was 323x523 at both 1280x900 and 1440x900 and 414x670 at
   1920x1080, i.e. 21.6 to 25.2 per cent of the viewport's width and 13 to 15
   per cent of its pixels, sitting in a 520px column with the rest of a 1440px
   screen left blank. It was also height-bound: 365px of heading, lede and score
   above it meant the board could not be taller than what was left, so a 900px
   desktop and a 667px phone got a board the same size.
   The fix is not a wider game. The world stays 420x680 and the physics with it,
   because the hazard spacing and every difficulty number assume that shape and
   a wider board would silently hand the player more runway. What desktop gets
   is the SPACE: the board moves into its own column at the full height of the
   window and the copy goes beside it, which is what all that width was for. */
@media (min-width: 1000px) {
  .gr-wrap{max-width:1180px}
  /* EVERY PIXEL ABOVE THE BOARD IS A PIXEL OFF THE BOARD, because the board is
     height-bound on a laptop and always will be: a 1.62 portrait shape in a
     900px window runs out of height long before it runs out of width. The
     section's shared 48px of padding is 48px of board, so this page takes less
     of it. That is also why the board is NOT sticky: a sticky board has to be
     sized for its stuck position, 68px from the top, and would then hang below
     the fold on arrival, which trades the first impression for a scroll nobody
     asked for. */
  .gr-sec{padding-top:var(--s4);padding-bottom:var(--s7)}
  .gr-wrap .crumbs{margin-bottom:var(--s2)}
  .gr-layout{grid-template-columns:auto minmax(300px,1fr);column-gap:var(--s7);align-content:start;
    grid-template-areas:"board title" "board hud" "board lede" "board how" "board other" "board ."}
  .gr-board{align-items:flex-start}
  .gr-title{margin-top:0}
  .gr-lede{margin-top:var(--s3)}
  .gr-how{margin-top:var(--s5)}
}
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
<meta name="theme-color" content="#111111">
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
  <section class="tight gr-sec">
    <div class="wrap gr-wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/games/">Games</a> / <span>Garbage Run</span></nav>

      <div class="gr-layout">
        <h1 class="gr-title">Garbage <span class="hl">Run</span></h1>

        <div class="gr-hud">
          <div class="gr-score" id="grScore">0</div>
          <div class="gr-best" id="grBest">Best 0</div>
        </div>

        <div class="gr-board" id="grBoard">
          <div class="gr-stage" id="grStage">
            <canvas id="grCanvas" width="420" height="680" role="img"
              aria-label="Garbage Run. Trubbish runs along a Rochester street and you tap to flip him between the floor and the ceiling."></canvas>
            <div class="gr-over" id="grOver">
              <h2 id="grTitle">Garbage Run</h2>
              <p id="grMsg">Tap the screen, or press space, to flip. Eat the rubbish, dodge the Pokemon.</p>
              <button class="gr-go" id="grStart" type="button">Start</button>
            </div>
          </div>
        </div>

        <p class="lede gr-lede">One thumb, no rules to read. Tap to flip Trubbish between the floor and the ceiling and
          eat everything on the street. A hundred pieces of rubbish and he evolves.</p>

        <p class="gr-how"><b>How it works.</b> Tap anywhere, or press <span class="gr-keys">space</span>, <span class="gr-keys">W</span>
          or the <span class="gr-keys">arrow keys</span>. Every piece of rubbish you eat is a point. Other Pokemon are out there too and
          touching one ends the run. Get to 100 and Trubbish evolves into Garbodor for the rest of the game.<br>
          <b>Nothing is saved anywhere but your own phone</b>, and there is no account and no server. Your best
          score lives in this browser and goes away if you clear it.</p>

        <p class="gr-how gr-other"><a href="/games/">The other games</a> are quicker: a set guesser, a silhouette round and
          a trivia run. This one is for a longer wait.</p>
      </div>
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
  // THE WORLD IS 420x680 AND THAT IS NOT THE CANVAS ANY MORE. It used to be
  // both, which is why the game rendered soft on every phone ever tested: the
  // backing store stayed 420 wide while the element was laid out at 277 CSS px
  // on a 390x844 phone, and a DPR 3 phone paints those 277 px with 831 real
  // ones. Measured resolution ratio 0.505 there, 0.65 at 1440x900 DPR 2, and
  // 1.014 only at 1920x1080 DPR 1, which is the one screen nobody plays it on.
  // fit() now sizes the backing store to the DEVICE pixels and scales the
  // context, so every coordinate below is still in 420x680 world units and the
  // physics, the spacing and every measured difficulty number are untouched.
  var W = 420, H = 680;

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

  // BANK THE BEST WHEN IT IS EARNED, NOT WHEN THE RUN ENDS. It was only written
  // in end(), so a run that never reached a game over never counted: measured a
  // run of 8 leaving a stored best of 3 after a reload. On a phone that is the
  // normal way a session finishes. You put the game down, take a call, swipe
  // away the tab, and the best run of the night is the one the game forgets.
  function bank(sc) {
    if (sc <= best) return false;
    best = sc;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    elBest.textContent = "Best " + best;
    return true;
  }
  elBest.textContent = "Best " + best;

  var running = false, raf = 0;
  // What the best was when this run began, so "New best" stays truthful even
  // though bank() may have already stored the score mid-run.
  var startBest = 0;
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
      obs: [], packs: [], bits: [], nextObs: 60, nextPack: 90,
      evolved: false, evoFlash: 0, evoRing: 0, tilt: 0, land: 0,
      hit: 0, killer: null, shake: 0, freeze: 0,
    };
  }
  var lanes = [];
  var speed = 0, t = 0;

  // SPEED IS CAPPED NOW AND IT WAS NOT. The ramp had no ceiling, so a long run
  // kept accelerating for as long as it lasted: measured 21.8 px per frame after
  // twelve minutes, from a start of 2.4. That is not difficulty, it is a
  // reaction test nobody can pass, and worse it eats the warning time the new
  // hazards depend on. A hazard is born at x=440 and is lethal from x=96, so the
  // time you get to see it coming is 344/speed frames: 2.4 seconds at the
  // starting speed, 0.95 at the cap, and 0.26 at the speed a twelve minute run
  // used to reach. Past the cap the game gets harder by putting more in front of
  // you, not by making it arrive faster than a person can answer.
  var SPEED_MAX = calm ? 4.2 : 6.0;

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
  // A hazard is a column anchored to the floor or the ceiling, "reach" tall,
  // with the Pokemon riding its inner end. h IS the reach, so the collision test
  // below did not have to change at all.
  function pushObs(L, x, onFloor, reach) {
    L.obs.push({
      x: x, onFloor: onFloor, w: 42, h: reach,
      foe: FOES[Math.floor(Math.random() * FOES.length)],
    });
  }
  // The tallest this stack may be without burying rubbish that is already in
  // flight next to it. Returns 0 when even the short version would.
  // A TRAIL IS UP TO 136px LONG and this window used to be 108, so the tail of a
  // five piece trail was invisible to the stack about to be built through it.
  function clearOfPacks(L, x, onFloor, reach) {
    for (var i = 0; i < L.packs.length; i++) {
      var p = L.packs[i];
      if (p.x < x - 100 || p.x > x + 180) continue;
      var room = onFloor ? (L.top + L.h) - (p.y + 44) : (p.y - 44) - L.top;
      if (room < reach) reach = room;
    }
    return reach;
  }

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
    //
    // HAZARDS NOW REACH INTO THE LANE, AND BEFORE THIS THEY DID NOT MATTER AT
    // ALL. Every hazard was a 42px block on the floor or the ceiling, so the
    // lethal rows were y < 60 and y > 620 out of 680 and the middle 560px of the
    // lane was permanently safe. Rubbish only ever spawns in that middle band,
    // so there was never a reason to leave it. Measured with a bot that ignored
    // the hazards and the rubbish completely and did nothing but hold the
    // midline: ten runs of ten minutes, ten survivals, no deaths, and a passive
    // score of 242 to 326 collected purely by things flying into it. The
    // hazards were scenery and the difficulty curve was flat forever.
    //
    // A hazard can now be a STACK: the Pokemon perched on top of a column of
    // rubbish that comes some way into the lane, so the safe corridor moves and
    // the player has to fly a line instead of parking on one. Nothing changes in
    // the first thirty seconds, which is the part that was already fair.
    if (L.nextObs <= 0) {
      var ox = W + 20;
      // HOW TALL IS TALL ENOUGH TO MATTER? Exactly one number decides it and it
      // is not obvious: a stack has to pass the middle of the lane, 340, before
      // a player parked on the midline has to move at all. A first version
      // capped every stack at 192 and measured perfectly reasonable in every
      // other way, then the idle bot went back to surviving ten runs out of ten
      // for ten minutes each, because 192 out of 680 leaves the centre line
      // untouched and the centre line is where a camper sits. The cap is 400
      // now, which is past the middle, and the corridor it leaves is still 264px
      // of open lane, seven Trubbish tall. The whole point is that the way
      // through MOVES; a gap that always contains the same pixel is not a gap.
      var tallCap = 42 + (t > 1800 ? Math.min(358, (t - 1800) / 24) : 0);
      var reach = 42;
      if (t > 1800) {
        var tallP = Math.min(0.55, (t - 1800) / 9000);
        // Weighted towards the short end, so the wall that crosses the middle is
        // an event rather than the texture. Uniform made every other hazard a
        // full-height wall the moment the cap grew.
        if (Math.random() < tallP) reach = 42 + (tallCap - 42) * Math.pow(Math.random(), 1.7);
      }
      var onFloor = Math.random() < 0.5;
      // FAIRNESS IS ARITHMETIC HERE, NOT A HOPE. Everything on screen moves left
      // at the same speed, so the gap between two things is fixed the moment
      // both exist and can simply be checked. If this stack would swallow
      // rubbish that is already in flight beside it, it gets shorter; if it
      // cannot get short enough, it is launched further back instead. Rubbish
      // you cannot take without dying is a trap, and a trap you could not see
      // coming is the thing that makes an endless runner feel cheap.
      reach = clearOfPacks(L, ox, onFloor, reach);
      if (reach < 42) { ox += 150; reach = clearOfPacks(L, ox, onFloor, 42); }
      if (reach < 42) reach = 42;
      pushObs(L, ox, onFloor, reach);
      // A PINCH is one stack from each side at the same distance, so the way
      // through is a window rather than a ceiling or a floor.
      // ITS SECOND STACK IS HELD TO 192 whatever the first one is doing, and the
      // first version of it was not: it took anything that left a 260px gap,
      // which against a short partner meant a wall of 370px out of a 680px lane
      // at a moment every other line of this file believed the tallest thing
      // possible was 192. Three of them were logged inside two minutes of one
      // run. A pinch is meant to narrow the way through, not to be the tall
      // hazard on its own; the 260px arithmetic below then means a pinch simply
      // does not happen behind a stack that is already most of the lane.
      if (t > 4800 && Math.random() < Math.min(0.3, (t - 4800) / 24000)) {
        var room = Math.min(192, L.h - 260 - reach);
        if (room >= 42) {
          var r2 = clearOfPacks(L, ox, !onFloor, 42 + Math.random() * (room - 42));
          if (r2 >= 42) pushObs(L, ox, !onFloor, r2);
        }
      }
      L.nextObs = Math.max(58, 130 - t / 55) + Math.random() * 44;
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
      var px0 = W + 20;
      // The other half of the fairness arithmetic. A trail launched into the
      // same stretch of street as a stack already in flight gets pushed clear of
      // it; if the stacks have left no room worth flying, the trail waits and
      // goes out 150px further back instead.
      for (var q = 0; q < 2; q++) {
        var lo2 = lo, hi2 = hi;
        for (var oi = 0; oi < L.obs.length; oi++) {
          var ob = L.obs[oi];
          if (ob.x + ob.w < px0 - 60 || ob.x > px0 + 34 * n + 60) continue;
          if (ob.onFloor) hi2 = Math.min(hi2, L.top + L.h - ob.h - 44);
          else lo2 = Math.max(lo2, L.top + ob.h + 44);
        }
        if (hi2 - lo2 >= 70) { lo = lo2; hi = hi2; break; }
        px0 += 150;
      }
      if (hi < lo) { hi = lo = L.top + L.h / 2; }
      var y0 = lo + Math.random() * (hi - lo);
      var dir = Math.random() < 0.5 ? -1 : 1;
      // AND THEN EVERY PIECE IS CHECKED ON ITS OWN, which is the only version of
      // this that is actually a guarantee. The band above is chosen once for the
      // whole trail, so it is right about the stacks it looked at and says
      // nothing about a piece whose own x sits beside a different one. Measured
      // with the band check alone: one trail in forty runs came out inside a
      // column, rubbish drawn in a place you could not reach without dying. A
      // piece with nowhere safe to go is simply not spawned.
      for (var k = 0; k < n; k++) {
        var yy = y0 + dir * 30 * Math.sin((k / (n - 1)) * Math.PI);
        if (yy < lo) yy = lo; if (yy > hi) yy = hi;
        var pxk = px0 + k * 34;
        var kLo = L.top + 30, kHi = L.top + L.h - 30;
        for (var oj = 0; oj < L.obs.length; oj++) {
          var ok = L.obs[oj];
          if (ok.x + ok.w < pxk - 34 || ok.x > pxk + 34) continue;
          if (ok.onFloor) kHi = Math.min(kHi, L.top + L.h - ok.h - 40);
          else kLo = Math.max(kLo, L.top + ok.h + 40);
        }
        if (kHi < kLo) continue;
        if (yy < kLo) yy = kLo; if (yy > kHi) yy = kHi;
        L.packs.push({
          x: pxk, y: yy, got: false,
          emoji: JUNK[Math.floor(Math.random() * JUNK.length)],
        });
      }
      // TRAILS WERE TOO FAR APART. At 150 to 240 frames the street went two and a
      // half to four seconds with nothing on it, so a run came down to whether
      // you happened to meet a trail at the right height. Measured over 8 runs
      // a side, the trail version doubled the best score, 11 to 20, and also
      // scored zero six times in eight: you either connected or you got nothing.
      // Closer together turns one lucky meeting into a steady stream of
      // chances, which is what a hundred needs.
      L.nextPack = 85 + Math.random() * 55;
    }

    var i;
    for (i = L.obs.length - 1; i >= 0; i--) {
      var o = L.obs[i];
      o.x -= speed;
      if (o.x + o.w < -20) { L.obs.splice(i, 1); continue; }
      var oy = o.onFloor ? L.top + L.h - o.h : L.top;
      if (o.x < 96 && o.x + o.w > 52 && L.y + 18 > oy && L.y - 18 < oy + o.h) {
        L.alive = false; L.killer = o; L.hit = 34; L.shake = calm ? 0 : 14;
      }
      // A near miss flashes the ring, so squeezing past something reads as a
      // thing you did rather than a thing that happened to you.
      // A NEAR MISS HAS TO BE NEAR. This tested horizontal overlap only, so the
      // ring lit gold on essentially every obstacle that went past, including
      // ones more than 200px away: measured 465 gold rings against 1079 red
      // while the player hovered nowhere near any of them. Within 70px of the
      // hazard row is close enough to have felt like something.
      else if (!o.near && o.x < 96 && o.x + o.w > 52) {
        var gap = L.y < oy ? oy - L.y : L.y - (oy + o.h);
        // A NEAR MISS ONLY CHANGED THE COLOUR OF A RING YOU WERE NOT LOOKING AT,
        // because at the moment of the squeeze your eye is on Trubbish and the
        // ring is behind him. Two short speed lines are drawn beside the player
        // instead, where the attention already is, and the closer the shave the
        // longer they run.
        if (gap < 70) {
          o.near = 1;
          L.bits.push({ k: "wind", x: 74, y: L.y, life: 12, max: 12, len: 26 + (70 - gap) });
        }
      }
    }
    for (i = L.packs.length - 1; i >= 0; i--) {
      var p = L.packs[i];
      p.x -= speed;
      if (p.x < -20) { L.packs.splice(i, 1); continue; }
      if (!p.got && Math.abs(p.x - 74) < 28 && Math.abs(p.y - L.y) < 34) {
        p.got = true; L.score += 1; L.packs.splice(i, 1);
        bank(L.score);
        // A PICKUP HAD NO MOMENT. The emoji simply stopped existing and a number
        // in the corner went up by one, which is the least a game can do with
        // the thing it is entirely about. A ring, a rising +1 and three sparks,
        // all on the existing draw pass and all gone inside half a second.
        // Every fifth one is bigger, so a trail flown cleanly builds.
        var big = L.score % 5 === 0;
        L.bits.push({ k: "ring", x: p.x, y: p.y, life: big ? 20 : 14, max: big ? 20 : 14, big: big });
        L.bits.push({ k: "num", x: p.x, y: p.y, life: 26, max: 26, big: big });
        for (var sp = 0; sp < (big ? 6 : 3); sp++) {
          L.bits.push({ k: "spark", x: p.x, y: p.y, life: 16, max: 16,
            vx: -1.6 - Math.random() * 2.4, vy: (Math.random() - 0.5) * 4.6 });
        }
        // EVOLVE AT A HUNDRED. Trubbish becomes Garbodor for the rest of the
        // run and stays that way: there is no going back, which is the point of
        // an evolution and also the reward for surviving that long.
        //
        // AND IT NOW LANDS LIKE ONE. A hundred pieces of rubbish is several
        // minutes of unbroken play and it used to be marked by a gold tint and a
        // word appearing over a world that never paused to notice. freeze holds
        // the whole simulation for twelve frames, which is the oldest trick in
        // the genre and the cheapest: nothing moves, so the change of sprite is
        // the only thing your eye has to look at.
        if (!L.evolved && L.score >= EVOLVE_AT) {
          L.evolved = true; L.evoFlash = 42; L.evoRing = 34;
          L.freeze = calm ? 0 : 12; L.shake = calm ? 0 : 10;
        }
      }
    }

    for (i = L.bits.length - 1; i >= 0; i--) {
      var b = L.bits[i];
      b.life -= 1;
      if (b.life <= 0) { L.bits.splice(i, 1); continue; }
      b.x -= speed;
      if (b.k === "num") b.y -= 1.1;
      if (b.k === "spark") { b.x += b.vx; b.y += b.vy; b.vy *= 0.9; }
    }
    if (L.evoRing > 0) L.evoRing -= 1;
    if (L.shake > 0) L.shake -= 1;
  }

  // ---- drawing: everything here is our own shapes ---------------------
  // THE BOARD IS BLACK, WHITE AND GOLD NOW BECAUSE THE SITE IS. Until 16 August
  // 2026 the site wore "Diner Plate" and the canvas was painted to match it:
  // an olive street, ketchup-red hazard rings, mustard glows, cream text. The
  // stylesheet moved to one accent hue over greys and the canvas could not
  // follow it, because a canvas draws in numbers rather than in tokens, so the
  // game was the last warm-coloured object on a monochrome site.
  // The rule the rest of the site follows is that the ART is the only colour, so
  // that is the rule here: the street is grey, the furniture is grey, gold is
  // reserved for the two things worth an accent, and Trubbish and the Pokemon
  // are the only coloured objects on screen because they are pictures.
  var C = {
    skyTop: "#0E0E0E", skyBot: "#1C1C1C",
    block: "rgba(255,255,255,.055)",
    band: "#242424", bandEdge: "rgba(232,185,58,.34)",
    hazard: "#F5F4F0", near: "#E8B93A",
    gold: "#E8B93A", goldDim: "rgba(232,185,58,.20)",
    ink: "#F5F4F0", inkDim: "rgba(245,244,240,.55)",
    onGold: "#111111", scrim: "rgba(10,10,10,.55)",
  };

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
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3;
    ctx.fillStyle = "#D6D6D6";
    ctx.beginPath();
    ctx.moveTo(-13, 12); ctx.lineTo(-9, -6); ctx.lineTo(-3, -12);
    ctx.lineTo(4, -5); ctx.lineTo(11, -11); ctx.lineTo(13, 12);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8A8A8A";
    ctx.fillRect(-13, 9, 26, 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.arc(-4, 0, 3.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 1, 3.4, 0, 7); ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath(); ctx.arc(-3.4, 0.4, 1.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(5.6, 1.4, 1.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  // The stack a tall hazard rides in on, drawn as bagged rubbish rather than as
  // a stretched Pokemon: drawImage over the whole column was the obvious way and
  // it turns a 42px sprite into a 190px smear.
  function stack(x, top, h) {
    ctx.fillStyle = "#2B2B2B";
    ctx.fillRect(x + 4, top, 34, h);
    ctx.fillStyle = "rgba(255,255,255,.09)";
    for (var s = 0; s < h; s += 22) ctx.fillRect(x + 8, top + s + 4, 26, 3);
    ctx.strokeStyle = "rgba(232,185,58,.30)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 5, top + 1, 32, h - 2);
  }

  function drawLane(L, i) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.top, W, L.h); ctx.clip();
    // The shake. Applied to the world and not to the canvas element, so it costs
    // nothing on the compositor and cannot leave a gap at the frame's edge.
    if (L.shake > 0) {
      ctx.translate((Math.random() - 0.5) * L.shake, (Math.random() - 0.5) * L.shake);
    }

    var g = ctx.createLinearGradient(0, L.top, 0, L.top + L.h);
    g.addColorStop(0, C.skyTop); g.addColorStop(1, C.skyBot);
    ctx.fillStyle = g; ctx.fillRect(-20, L.top - 20, W + 40, L.h + 40);

    if (!calm) {
      ctx.fillStyle = C.block;
      for (var k = 0; k < 7; k++) {
        var bx = (k * 150 - (t * speed * 0.28) % 1050 + 1050) % 1050 - 60;
        ctx.fillRect(bx, L.top + L.h - 74, 44, 74);
      }
    }
    // THE TWO ROWS THAT KILL YOU ARE MARKED NOW. The floor and the ceiling were
    // a flat band the same weight as everything else, so the one rule the game
    // has, stay off the edges, was told to you only by dying. A gold hairline
    // along the inner edge of each is the whole notation.
    ctx.fillStyle = C.band;
    ctx.fillRect(-20, L.top + L.h - 16, W + 40, 20);
    ctx.fillRect(-20, L.top - 4, W + 40, 20);
    ctx.fillStyle = C.bandEdge;
    ctx.fillRect(-20, L.top + L.h - 17, W + 40, 1.5);
    ctx.fillRect(-20, L.top + 15.5, W + 40, 1.5);

    for (var a = 0; a < L.obs.length; a++) {
      var o = L.obs[a];
      var oy = o.onFloor ? L.top + L.h - o.h : L.top;
      // The head of the stack: the 42px square the Pokemon actually occupies,
      // at the end that reaches into the lane.
      var hy = o.onFloor ? oy : oy + o.h - 42;
      if (o.h > 46) stack(o.x, o.onFloor ? oy + 34 : oy, o.h - 34);
      // A ring under every hazard, always drawn, whether or not the sprite has
      // loaded. A player must never be killed by something they could not see
      // because a file was still downloading.
      var lit = o === L.killer;
      ctx.strokeStyle = lit ? C.ink : (o.near ? C.near : C.hazard);
      ctx.lineWidth = lit ? 5 : (o.near ? 4 : 3);
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, hy + 21, o.w * 0.58, 0, 7); ctx.stroke();
      var fs = foeSprites[o.foe];
      if (fs && fs.ready) ctx.drawImage(fs.img, o.x, hy, o.w, 42);
      else { ctx.fillStyle = C.hazard; ctx.fillRect(o.x + 8, hy + 8, o.w - 16, 26); }
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var b = 0; b < L.packs.length; b++) {
      var pk = L.packs[b];
      ctx.fillStyle = C.goldDim;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 17, 0, 7); ctx.fill();
      ctx.font = "24px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
      ctx.fillText(pk.emoji, pk.x, pk.y);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    trubbish(74, L.y, L.flip > 0, L.evolved, L.tilt, L.land);

    // The confetti. One pass, four shapes, all of them fading by life/max so
    // nothing needs its own timer and a dropped frame cannot leave one stuck.
    for (var c = 0; c < L.bits.length; c++) {
      var bt = L.bits[c], f = bt.life / bt.max;
      if (bt.k === "ring") {
        ctx.strokeStyle = "rgba(232,185,58," + f.toFixed(3) + ")";
        ctx.lineWidth = bt.big ? 3 : 2;
        ctx.beginPath();
        ctx.arc(bt.x, bt.y, (bt.big ? 34 : 24) * (1 - f) + 8, 0, 7);
        ctx.stroke();
      } else if (bt.k === "spark") {
        ctx.fillStyle = "rgba(232,185,58," + f.toFixed(3) + ")";
        ctx.fillRect(bt.x - 1.5, bt.y - 1.5, 3, 3);
      } else if (bt.k === "num") {
        ctx.fillStyle = "rgba(232,185,58," + f.toFixed(3) + ")";
        ctx.font = "700 " + (bt.big ? 20 : 15) + "px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(bt.big ? "+1!" : "+1", bt.x, bt.y);
        ctx.textAlign = "left";
      } else if (bt.k === "wind") {
        ctx.strokeStyle = "rgba(245,244,240," + (f * 0.7).toFixed(3) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bt.x + 22, bt.y - 9); ctx.lineTo(bt.x + 22 + bt.len * f, bt.y - 9);
        ctx.moveTo(bt.x + 26, bt.y + 8); ctx.lineTo(bt.x + 26 + bt.len * f * 0.7, bt.y + 8);
        ctx.stroke();
      }
    }

    // The evolution moment. A gold wash, a shockwave and a word, for about two
    // thirds of a second, then it is gone and you are Garbodor.
    if (L.evoRing > 0) {
      var ef = L.evoRing / 34;
      ctx.strokeStyle = "rgba(232,185,58," + ef.toFixed(3) + ")";
      ctx.lineWidth = 6 * ef + 1;
      ctx.beginPath(); ctx.arc(74, L.y, 300 * (1 - ef) + 20, 0, 7); ctx.stroke();
    }
    if (L.evoFlash > 0) {
      ctx.fillStyle = "rgba(232,185,58," + (L.evoFlash / 90) + ")";
      ctx.fillRect(-20, L.top - 20, W + 40, L.h + 40);
      ctx.fillStyle = C.onGold;
      ctx.font = "700 30px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EVOLVED", W / 2, L.top + L.h / 2);
      ctx.textAlign = "left";
      L.evoFlash -= 1;
    }
    // THE DEATH USED TO HAPPEN OFF SCREEN. end() was called on the same frame as
    // the collision, so the overlay covered the board before the impact had been
    // drawn even once and the answer to "what hit me" was hidden by the panel
    // asking whether you would like to go again. The world now holds for just
    // over half a second: the thing that got you keeps a white ring, the board
    // shakes, and a white flash falls off over four frames.
    if (L.hit > 0 && L.hit > 28) {
      ctx.fillStyle = "rgba(255,255,255," + ((L.hit - 28) / 12).toFixed(3) + ")";
      ctx.fillRect(-20, L.top - 20, W + 40, L.h + 40);
    }

    // THE READOUT SAT IN THE CEILING ROW, which is where the ceiling hazards
    // are. The score and the countdown were drawn at y=30 and y=46 straight onto
    // the world, so a Pokemon coming along the ceiling passed through the number
    // telling you how close you were to the thing you are playing for, and a
    // tall ceiling stack sat behind both. It is under the band now, on a plate
    // of its own, so it is legible over anything the game can put there.
    var label = L.evolved ? "GARBODOR" : (EVOLVE_AT - L.score) + " to evolve";
    ctx.font = "700 11px ui-monospace, monospace";
    var lw = Math.max(ctx.measureText(label).width, 26) + 16;
    ctx.fillStyle = "rgba(10,10,10,.62)";
    ctx.fillRect(W - lw - 8, L.top + 24, lw + 8, 44);
    ctx.fillStyle = C.ink;
    ctx.font = "700 20px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(L.score), W - 14, L.top + 48);
    ctx.fillStyle = L.evolved ? C.gold : C.inkDim;
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillText(label, W - 14, L.top + 62);
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
      ctx.fillStyle = C.scrim;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.ink;
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
    var L0 = lanes[0];
    while (acc >= 16.667 && steps < 4) {
      acc -= 16.667;
      steps += 1;
      // HITSTOP AND THE DEATH HOLD BOTH LIVE HERE, in the fixed-step loop rather
      // than in a timer, so they are counted in world frames like everything
      // else and a background tab cannot desync them. The clock still drains,
      // so a freeze eats real time exactly once however slow the device is.
      if (L0.freeze > 0) { L0.freeze -= 1; if (L0.shake > 0) L0.shake -= 1; continue; }
      if (!L0.alive) {
        L0.hit -= 1;
        if (L0.shake > 0) L0.shake -= 1;
        // He goes over. The world is stopped, so this rotation is the only thing
        // moving and it is what the eye follows to the thing that hit him.
        L0.tilt = (34 - L0.hit) * 0.075 * (L0.flip > 0 ? 1 : -1);
        continue;
      }
      t += 1;
      if (speed < SPEED_MAX) speed = Math.min(SPEED_MAX, speed + (calm ? 0.00025 : 0.00045));
      for (var i = 0; i < lanes.length; i++) step(lanes[i]);
    }
    draw();

    if (!L0.alive && L0.hit <= 0) return end();
    elScore.textContent = String(L0.score);
    raf = requestAnimationFrame(tick);
  }

  function end() {
    running = false;
    cancelAnimationFrame(raf);
    var sc = lanes[0].score;
    // bank() may already have stored this score mid-run, so "is it a new best"
    // is asked against what the run started with rather than against best.
    elTitle.textContent = sc > startBest ? "New best" : "A wild Pokemon got you";
    bank(sc);
    elBest.textContent = "Best " + best;
    elMsg.textContent = sc + " piece" + (sc === 1 ? "" : "s") + " of rubbish eaten." +
      (lanes[0].evolved ? " You made it to Garbodor." : " " + (EVOLVE_AT - sc) + " more and you would have evolved.");
    elStart.textContent = "Go again";
    elOver.hidden = false;
  }

  var countIn = 0, acc = 0, last = 0;
  function start() {
    paused = false;
    startBest = best;
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
    //
    // AND HOLDING IT IS NOT MEANT TO WORK. Blocking the repeat is not a tax on
    // the keyboard player, it is the game: the flip is one decision per tap on a
    // phone and it has to be one decision per press here, or the two controls
    // are playing different games and only one of them has a best score worth
    // keeping. A hover is a rhythm you tap out either way.
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // A KEYDOWN LISTENER ON document HEARS THE SEARCH BOX TOO, and this one has
    // done since the day it was written: the site bar at the top of this page
    // carries a text input, and typing a space into it flipped Trubbish, while
    // typing one before pressing Start began a run behind the dropdown. Nothing
    // on the page reported it because the game is off screen while you type.
    var tgt = e.target;
    if (tgt && (tgt.isContentEditable || /^(input|textarea|select)$/i.test(tgt.tagName || ""))) return;
    var k = e.key.toLowerCase();
    // SPACE IS NOT THE ONLY KEY ANY MORE. It was, on a page nobody had ever
    // played with a keyboard, and space on a long page is also the browser's own
    // scroll-a-screen key: the game preventDefaults it while a run is up, but a
    // player who has not started yet and reaches for the obvious key gets the
    // page thrown down instead. The arrows and W and S are the two other things
    // a hand lands on, and none of them scroll sideways into anything.
    // Enter is deliberately NOT here. It is the key that submits the search box
    // and follows a focused link, and a global handler that eats it is worse
    // than a game with one key fewer.
    if (k === " " || k === "spacebar" || k === "arrowup" || k === "arrowdown" ||
        k === "w" || k === "s") {
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
  //
  // MEASURE THE COLUMN, NOT THE STAGE. The stage now shrinks to whatever the
  // canvas is, so asking it how much room there is and then resizing the canvas
  // to the answer is a loop that settles at whatever it was last time and never
  // grows back. .gr-board is the thing that owns the width.
  //
  // AND ON A DESKTOP THE COLUMN CANNOT ANSWER EITHER. The board sits in an
  // "auto" grid track there, so the track is as wide as its contents, which is
  // the canvas, which is what this function is trying to decide: asking it how
  // much room there is returns whatever the canvas already was and the board can
  // never grow. Measured with that circular version in place: 420x680 at 1280,
  // 1440 AND 1920, i.e. the fix for the desktop cap changed nothing at all. The
  // wide branch asks the LAYOUT how wide it is and subtracts the copy column.
  var board = document.getElementById("grBoard");
  var layout = document.querySelector(".gr-layout");
  var wideQ = window.matchMedia ? window.matchMedia("(min-width: 1000px)") : null;
  var lastKey = "";
  function fit() {
    var r = board.getBoundingClientRect();
    var wide = wideQ ? wideQ.matches : false;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    // THE 680 CAP IS GONE ON A BIG SCREEN and it was the reason a 1920x1080
    // desktop and an iPhone SE got a board the same size. It was there to stop a
    // very tall column on a desktop, which the aspect ratio already prevents:
    // the board can only be as tall as it is wide times 1.62, and the width is
    // capped by the column. What it actually did was pin the board to its
    // drawing surface, so the extra 400px of a laptop window went unused.
    var cap = wide ? 1100 : 680;
    var availH = Math.max(260, Math.min(vh - r.top - 14, cap));
    // 348 is the copy column's 300px floor plus the 48px gutter between them,
    // both of which are declared in the grid above and repeated here because a
    // grid track cannot be read back in pixels before it has been laid out.
    var availW = Math.max(200, wide ? (layout.clientWidth - 348) : r.width);
    var scale = Math.min(availW / W, availH / H);
    var cw = Math.round(W * scale), ch = Math.round(H * scale);
    // RENDER AT THE DEVICE'S PIXELS. Capped at 2 rather than taken raw: a DPR 3
    // phone would ask for 3.9x the fill of DPR 2 for a difference no eye finds
    // on a 24px sprite, and this game has to hold 60fps on a phone that has been
    // in a queue for forty minutes with the screen on.
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var key = cw + "x" + ch + "@" + dpr;
    if (key === lastKey) return;
    lastKey = key;
    cv.style.width = cw + "px";
    cv.style.height = ch + "px";
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    // Resizing the backing store resets every context property, so the world
    // transform is reinstalled here and nowhere else. Everything above this line
    // draws in 420x680 units and does not know this happened.
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    draw();
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
