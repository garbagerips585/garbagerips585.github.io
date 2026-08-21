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
// THE MASCOTS ARE THE REAL SPRITES, because Tim asked for the actual Trubbish
// rather than a green blob standing in for one.
//
// IT IS ONE SHARED FILE, NOT TWO, and this line said two until 20 August 2026.
// /assets/trubbish.webp is the sprite the 404 page and the no-hits panel
// already use; /assets/garbodor.webp appears NOWHERE else in the tree -- grep
// it and this game is the only hit. The figcaption on the evolution figure
// carried the same wrong claim and has been narrowed to the Trubbish. If you
// ever put Garbodor on another page, widen both together.
// Both are loaded from /assets/ so the
// canvas is never tainted by a third-party host and the game keeps working
// offline once the page is cached.
//
// The junk is EMOJI on purpose: a banana, a pizza slice, a bin, a drinks can.
// Emoji were the wrong tool for the rarity key, where the tier IS the colour of
// the star and there is no silver star to be had, and they are the right tool
// here, where the job is "this is trash and it is funny". They also cost no
// bytes and need no art pipeline.
//
// A SPRITE THAT HAS NOT LOADED MUST NOT BLOCK THE GAME. Both images are drawn
// only once complete; until then the original drawn shapes render instead, so a
// slow connection gets a playable game rather than an empty rectangle.
//
// WHAT THE GAME ACTUALLY PLAYS LIKE, DRIVEN RATHER THAN READ. 18 August 2026,
// headless Chrome, Math.random seeded and the clock faked so a run is
// reproducible, and every figure below is the median of 60 runs on 60 seeds.
// The player model is a person and not a servo: decisions land 133ms late, the
// aim is loose by +/-24px, and one decision in twenty is simply missed.
//
//                                run length   score   ever evolved
//   fly the safe corridor, take     39s        31       9 of 60
//     what happens to fly into you
//   go after the trash            13s        18       3 of 60
//
// THOSE FOUR NUMBERS WERE MEASURED ON A RANDOM STREAM THAT NO LONGER EXISTS, 20
// August 2026, and they are kept rather than deleted because the SHAPE of the
// finding under them is what matters and is unchanged. The opening trail added
// to reset() puts five pieces of trash on the street before the count-in ends;
// collecting them moves the score, the score feeds the spark loop count, and the
// spark loop draws randoms, so every pickup after the first re-phases. See the
// long note beside primeStreet for the proof that it is a reshuffle and not a
// bias, and for the 40-seed table that replaces the first two columns. Do not
// quote the run lengths above as current; do quote "chasing the trash loses to
// ignoring it", which was re-measured after the change and still holds.
//
// THE GAME'S OWN OBJECTIVE IS A MISTAKE TO PURSUE, and that is the finding this
// pass would fix first if it knew how to. Chasing a piece of trash costs a
// third of your run and buys nothing: 15 of 15 collector deaths were at the
// FLOOR OR THE CEILING against a bare 42px hazard, never against the tall
// stacks or a pinch. The reason is structural rather than tuned. A flip is one
// fixed 4.6 kick, so any excursion is a commitment, and the place an unattended
// Trubbish ends up is the floor or the ceiling, which is the only place
// anything can kill him. Every deviation you do not perfectly arrest ends in
// the lethal row. Meanwhile a player who never deviates still collects
// ~40 a minute from trails that fly into them.
//
// It inverts above human speed. At zero latency, chasing beats surviving by
// 5.6x (1346 against 240 over eleven minutes), so the mechanic works; it just
// works above the reaction time of the person in the queue this was built for.
//
// ONE FIX WAS TRIED AND REJECTED, and the numbers are here so nobody tries it
// twice. Trails pick their height uniformly across the lane, so consecutive
// trails demand random 400px excursions; making the height a bounded walk from
// the last trail's (a continuous path to fly, which is what the trail comment
// further down claims trails already are) was measured over 60 paired seeds:
//
//                             collector mean   survivor mean
//   as shipped                     26.4             55.1
//   continuous path, step 120      36.7             54.5
//
// It does exactly what it was meant to, +39% to the collector and nothing to
// the survivor, AND IT STILL LOSES 36.7 TO 54.5. It buys a real design cost, a
// predictable trash path, for a change that does not flip the decision it was
// aimed at. Not shipped. If somebody attacks this again, attack the excursion
// (what a tap costs) rather than the target (where the trash is).
//
// TWO THINGS THAT LOOKED LIKE FINDINGS AND DID NOT SURVIVE THEIR OWN RE-CHECK:
//
// THE DIFFICULTY CURVE IS COMPLETELY FLAT AFTER 200 SECONDS. Every parameter
// hits its ceiling and stops: obstacle spacing at t=3960, speed at t=8000, the
// tall-stack probability at t=6750, the stack cap at t=10392, the pinch chance
// at t=12000. Nothing whatever changes after that. It is also unreachable: no
// human-latency policy tested got past t=8877, so the plateau is 35% further
// out than the longest realistic run. Left alone.
//
// A BOT THAT ONLY FLIES THE CORRIDOR IS IMMORTAL: 3 of 3 alive after 120,000
// frames, 33 minutes, and 10 of 10 at 11 minutes. That reads exactly like the
// idle-bot finding that made the hazards reach into the lane, and it is not the
// same thing. It needs decisions every 100ms or better; at 200ms the same
// policy dies at a median of 115 seconds and at 133ms with a human's aim it
// dies at 39. The narrowest window the game can build is 260px of a 680px lane
// against a 36px collision box, which is why a servo lives there forever and a
// person does not. Do not widen the hazards on the strength of a bot that taps
// sixty times a second.
//
// ACCESSIBILITY, and a game makes this awkward rather than impossible.
// prefers-reduced-motion cannot mean "no movement" in a game about movement,
// so it means: nothing moves until you press start, the parallax and the screen
// shake are off, and the speed ramp is gentler. Keyboard plays it too.
//
// TWO MORE WENT IN ON 20 August 2026 AND BOTH WERE HOLES RATHER THAN POLISH.
// The game over panel carries role="status", because a canvas tells a screen
// reader nothing: its aria-label describes the SCENE and cannot describe a run,
// so until this went in a blind player could finish a run and be told neither
// the score nor that it had ended. And with JavaScript off the board collapsed
// to an eight pixel dot sitting under a live-looking "0 BEST 0" readout, which
// reads as a broken page rather than a page whose game needs a script; a
// noscript block in the head hides the two dead elements and one in the body
// says so in a sentence. The prose below the board was always there and still
// is, which is the half a crawler sees.

import { readFile, writeFile } from "node:fs/promises";
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
import { esc } from "../shared/format.mjs";
// The stylesheet's own comment stripper, reused rather than re-written: it is a
// tokenizer, so a /* inside a quoted value or a url() cannot open a comment.
import { strip as miniCSS } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const desc =
  "A one thumb arcade game for the restock line. Flip Trubbish between floor and ceiling, eat the trash, dodge the Pokemon, and evolve into Garbodor.";

// THE EVOLUTION THRESHOLD, ONCE. It was a `var EVOLVE_AT = 100` inside the page
// script and the number 100 spelled out in the copy above it, in two places,
// which is exactly how a game and the paragraph explaining it end up disagreeing
// after somebody tunes the game. The script now takes it from here too, so there
// is one number and the prose cannot go stale on its own.
const EVOLVE_AT = 100;

// THE HAZARDS, AND THEIR NAMES, FROM ONE LIST. The dex ids used to be a literal
// inside the page script and nothing anywhere knew what they were called, which
// is why every death for months read "A wild Pokemon got you" over a picture of
// a Koffing. The ids live here now because the NAMES have to be looked up at
// build time and a second copy of the list is how a sprite and a caption come to
// disagree: the id picks BOTH the file and the word, so they cannot drift.
//
// THE NAMES ARE NOT TYPED IN. They are read from public/data/pokemon-index.json,
// the same file the Pokedex pages are built from, so a name on this page is the
// name the rest of the site uses and it has a source. An id the index does not
// hold THROWS rather than shipping a hazard the game cannot name, which is the
// same call build-games.mjs makes on a missing species sprite.
const FOES = [92, 109, 88, 316, 434, 453, 451];

const FOE_NAMES = await (async () => {
  const raw = await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8");
  const doc = JSON.parse(raw);
  const list = doc.pokemon || Object.values(doc).find((v) => Array.isArray(v));
  if (!Array.isArray(list)) throw new Error("pokemon-index.json: no species array");
  const out = {};
  for (const id of FOES) {
    const hit = list.find((p) => p.id === id);
    if (!hit || !hit.name) throw new Error("build-garbage-run: no name for dex id " + id);
    out[id] = hit.name;
  }
  return out;
})();

// ---- THE TITLE SCREEN'S ALPHABET, 5x7, DRAWN AS RECTANGLES ------------------
//
// WHY THERE IS A FONT IN A PAGE BUILDER AT ALL. Tim asked for "a really cool 8
// bit looking title screen ... like an old school computer game title screen",
// and the one thing that makes a screen read as 8-bit is the LETTERING. The
// obvious way to get it is a pixel web font, and that is the wrong trade on
// this page: this site already ships three faces (Titan One, Outfit, Space
// Mono), the page is opened on mobile data by somebody standing in a restock
// line, and a fourth file would be a real download for one screen that is
// looked at for two seconds. A woff2 pixel face is 8-20KB.
//
// This table is 40 glyphs at 7 characters each, 280 characters of base-32, plus
// the 40-character key. It costs under 400 bytes raw and close to nothing
// gzipped, because it is one long run of a 32-symbol alphabet, which is exactly
// what a compressor eats. Measured on the built page: the whole title screen,
// alphabet, the drawing code and the prose here together, is +1.7KB gzipped:
// the page goes 53,958 -> 59,463 raw and 16,042 -> 17,785 gzipped, measured
// with gzip -9. No new request of any kind: no font file, no image, no asset.
//
// THE SOURCE STAYS BINARY AND THE PAGE GETS BASE-32. Each glyph is seven rows
// of five characters here, so a person can read the letter shapes in this file
// and edit one by eye; the build turns each row into a number 0-31 and writes
// it as a single base-32 digit, so the page ships "ehhvhhh" for A rather than
// seven integers. Runtime decode is parseInt(row, 32).
//
// ONLY THE CHARACTERS THE SCREEN ACTUALLY NEEDS. A-Z for the lettering, 0-9
// because the high score is a number and 585 is in the brand, and space, comma,
// period and hyphen because Tim's line is "Garbage Run - Rochester, NY -
// Garbage Rips 585". There are no lowercase glyphs: an arcade title screen is
// upper case, so every string drawn is upper-cased at the call.
const GLYPHS = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  // N is the one glyph with a doubled diagonal step: at 5 wide a single-pixel
  // diagonal from row 1 to row 5 leaves a visible gap at both ends, and the
  // doubled version is what every 5x7 ROM font of the period actually drew.
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11111", "00010", "00100", "00110", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
};

// A GLYPH THAT IS NOT 7 ROWS OF 5 THROWS HERE rather than drawing a letter one
// pixel out of line on every phone. The runtime decoder trusts the width, so a
// six-character row would silently shift the rest of that letter's column.
const FONT_KEYS = Object.keys(GLYPHS);
for (const k of FONT_KEYS) {
  const rows = GLYPHS[k];
  if (rows.length !== 7) throw new Error("build-garbage-run: glyph " + k + " is not 7 rows");
  for (const r of rows) {
    if (!/^[01]{5}$/.test(r)) throw new Error("build-garbage-run: glyph " + k + " has a bad row " + r);
  }
}
// Both strings come off the SAME key array, so the index of a character in one
// is the index of its rows in the other and they cannot fall out of step.
const FONT_K = FONT_KEYS.join("");
const FONT_R = FONT_KEYS
  .map((k) => GLYPHS[k].map((r) => parseInt(r, 2).toString(32)).join(""))
  .join("");

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
   lede below, which is 1.8x the playing area on the commonest phone there is.
   THE BLOCK THAT DID THIS HAS MOVED to the end of the base rules below, next to
   the desktop block, because two of its three declarations were losing a
   specificity contest and doing nothing. See the note there. */

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
/* THE STAGE IS FOCUSABLE NOW (tabindex="-1"), AND IT DELIBERATELY DECLARES NO
   FOCUS STYLE OF ITS OWN. ui.css sets one ring for the whole site on bare
   :focus-visible, and it lands on this element unchanged: an outline is painted
   outside the box, so the stage's own overflow:hidden does not clip it. The
   thing worth writing down is why nothing appears on a TAP. Focus is taken
   programmatically when you tap the board or press Start, because holding focus
   is what entitles the game to the keys (see THE KEYS BELONG TO THE GAME ONLY
   WHILE IT HAS FOCUS beside the keydown handler), and :focus-visible does not
   match a programmatic focus that followed a pointer. So the mouse and touch
   player never sees a ring they did not ask for, and the keyboard player, who
   got here by pressing Start, does. */

.gr-hud{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:baseline;justify-content:flex-start;
  margin:var(--s4) 0 var(--s3)}
.gr-score{font:400 var(--t-xl)/1 var(--display);color:var(--ink);font-variant-numeric:tabular-nums}
.gr-best,.gr-stat{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
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
.gr-go:hover{background:var(--mustard);border-color:var(--mustard);color:var(--on-accent)}

/* ---- ATTRACT MODE: THE PANEL GETS OUT OF THE WAY OF THE SCREEN -------------
   The title screen is DRAWN ON THE CANVAS, at the game's own resolution, in the
   game's own pixels. That is the whole reason it reads as an old title screen
   rather than as a web page with blocky type on it: it is the same surface, the
   same scale and the same paint as the game behind it.
   So in this one state the HTML panel keeps its job and gives up its looks. It
   still holds the h2, the instructions and the Start button, because a canvas
   tells a screen reader NOTHING and the drawn letters are not text: an
   assistive reader gets the title and the rules from the DOM exactly as before,
   they are just not painted twice.
   THE BUTTON BECOMES THE SCREEN. inset:0 makes it the whole board, so the tap
   that started the game before starts it now, in one tap, anywhere, and it is
   still a real focusable <button> with an accessible name of "Start". font-size
   0 and color transparent hide the label without taking it out of the
   accessibility tree, which is why this is not display:none and not a
   background-image.
   A TRANSPARENT BUTTON STILL HAS TO SHOW ITS FOCUS. It has no fill and no
   border here, so the site's normal focus ring would have nothing to sit on;
   the outline is drawn INSIDE the board with a negative offset, over the drawn
   screen, and the color is the light blue the prompt on the canvas uses.
   This block is layout and state only. The panel is unchanged for the game over
   and the paused states, which are prose that has to be read rather than a
   screen to be looked at. */
.gr-over.gr-attract{background:transparent;padding:0;gap:0}
.gr-over.gr-attract h2,.gr-over.gr-attract p{position:absolute;width:1px;height:1px;margin:-1px;
  padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.gr-over.gr-attract .gr-go{position:absolute;inset:0;width:100%;height:100%;min-height:0;padding:0;
  border:0;border-radius:0;background:transparent;color:transparent;font-size:0;line-height:0}
.gr-over.gr-attract .gr-go:hover{background:transparent;border-color:transparent;color:transparent}
.gr-over.gr-attract .gr-go:focus-visible{outline:3px solid #70B5D9;outline-offset:-9px}
.gr-how{margin-top:var(--s5);color:var(--ink-2);font-size:var(--t-sm);line-height:1.6;max-width:44em}
.gr-how b{color:var(--ink)}

/* THE EVOLUTION FIGURE. Two sprites and the number between them, on one line at
   every width: the whole content is "this becomes this", and stacking it would
   turn a single glance into a scroll. The images are 512px files drawn at 84,
   which is deliberate rather than sloppy: they are the canvas sprites, already
   in cache the moment the game has run once, so a second rendition would be a
   new download to save nothing.
   The mark between them is a number, not an arrow glyph: an arrow says
   "becomes" and the number says "when", and when is the part the player is
   actually working towards. */
.gr-evo{display:flex;flex-wrap:wrap;gap:var(--s3);align-items:center;justify-content:flex-start;
  margin-top:var(--s4);padding:var(--s3) var(--s4);background:var(--card);border:2px solid var(--ink);
  border-radius:var(--r)}
.gr-evo img{width:84px;height:84px;object-fit:contain;display:block;flex:none}
.gr-evo-at{flex:none;display:grid;place-items:center;min-width:46px;height:34px;padding:0 10px;
  border-radius:999px;background:var(--gold);color:var(--on-accent);
  font:700 var(--t-sm)/1 var(--mono);letter-spacing:.04em}
/* The caption takes the whole second row rather than sitting beside the pair,
   because at 390px there is 342px of board width and three items already in it. */
.gr-evo figcaption{flex-basis:100%;font:400 var(--t-micro)/1.5 var(--mono);color:var(--ink-2)}
.gr-keys{font:700 var(--t-micro)/1 var(--mono);background:var(--card);border:1px solid var(--hair);
  border-radius:5px;padding:3px 6px;white-space:nowrap}

/* SHORT SCREEN AND PHONE: TAKE THE CHROME ABOVE THE BOARD BACK AND GIVE IT TO
   THE GAME. This block used to sit up beside the grid areas and it fired on
   height alone, and BOTH of those were wrong.

   IT WAS IN THE WRONG PLACE, so two of its three rules never applied. A media
   query adds nothing to specificity, so its .gr-hud sat at (0,1,0) against the
   plain .gr-hud further down the same stylesheet and lost on source order; the
   hud kept its 16/12 margins on every screen the block was written for. Measured
   at 360x704, where the query definitely matched: score margins 16 and 12, i.e.
   exactly the values it was overriding. The block is down here now, after every
   base rule and before the desktop one, which is the only position where it wins
   what it is meant to win and loses what desktop is meant to win.

   IT COULD NOT SEE A PHONE. A max-height query resolves against the LARGE
   viewport, the one with the browser's bar retracted, so a 390x844 iPhone tests
   844 against 740 and the block never fired: the page laid itself out against a
   height the reader does not have until they scroll. That is the same class of
   mistake as sizing the board from the dynamic viewport, which is the bug this
   pass was opened for. 544 is the site's own phone breakpoint, the one the home
   page uses, and it is an OR with the height so a short landscape window keeps
   what it had.

   EVERY PIXEL ABOVE THE BOARD IS A PIXEL OFF THE BOARD, which the desktop block
   below says about a laptop and is far truer here: the board is 1.62 portrait,
   so it is height bound on every phone there is and its WIDTH is what the height
   buys. At 390x844 this takes 109.8px back, 35.8 of breadcrumb, 40 of section
   padding, 22 of heading and 12 of score margin, and every pixel of it goes into
   the game: board 279x452 to 347x562 on the phone Tim holds.

   section.gr-sec, NOT .gr-sec, and that is the same trap as the hud above.
   ui.css sets section.tight{padding:48px 0} at (0,1,1), so a single class here
   cannot beat it however late it appears. The desktop block below had the same
   fault and the same fix: its padding note has been describing a rule that never
   applied. */
@media (max-height: 740px), (max-width: 544px) {
  section.gr-sec{padding-top:var(--s2)}
  .gr-wrap .crumbs{display:none}
  .gr-title{font-size:var(--t-l);margin-bottom:4px}
  .gr-hud{margin:var(--s2) 0}
}

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
  /* section.gr-sec, not .gr-sec: this rule had been at (0,1,0) against ui.css's
     section.tight{padding:48px 0} at (0,1,1) and had never once applied, so the
     "48px of padding is 48px of board" argument above it was describing a saving
     the page was not making. Measured at 1440x900: board top 149.8 with 48px of
     section padding under it. It is 32px shorter now and the board is 32px
     taller, which is what the paragraph always claimed. */
  section.gr-sec{padding-top:var(--s4);padding-bottom:var(--s7)}
  .gr-wrap .crumbs{margin-bottom:var(--s2)}
  .gr-layout{grid-template-columns:auto minmax(300px,1fr);column-gap:var(--s7);align-content:start;
    grid-template-areas:"board title" "board hud" "board lede" "board how" "board other" "board ."}
  .gr-board{align-items:flex-start}
  .gr-title{margin-top:0}
  .gr-lede{margin-top:var(--s3)}
  .gr-how{margin-top:var(--s5)}
}
`;

// SHIP THE CODE, KEEP THE PROSE. The same trade build-css.mjs makes for the
// stylesheet, made here for the one page on this site that carries a large
// inline script. 512 of this script's lines are whole-line comments, 36.8KB of
// 66.2KB, and every one of them is worth keeping in this file and worth nothing
// at all to somebody opening the page on mobile data in a restock line.
//
// MEASURED on the built page, comments in against comments out, script and
// inline stylesheet together:
//
//     raw      91,650 -> 49,676 bytes
//     gzip     32,602 -> 15,181     the page more than halves
//     brotli   27,495 -> 13,060     which is what a static host actually sends
//
// That is 14.4KB off the wire, more than the whole skyline feature cost, and
// the source above is unchanged.
//
// IT ONLY DROPS WHOLE-LINE COMMENTS, WHICH IS WHAT MAKES IT SAFE WITHOUT A
// JAVASCRIPT PARSER. A line whose first non-space characters are // is a
// comment for the whole of its length, so nothing on it can be code, and
// deleting it leaves the newline that ended the PREVIOUS line in place, so no
// two tokens that were on separate lines land on one and no automatic semicolon
// moves. Blank lines go the same way, for the same reason build-css.mjs drops
// them: whitespace between statements is never part of one.
//
// THE ONE CONSTRUCT THAT WOULD BREAK IT IS A STRING SPANNING LINES, which in
// JavaScript means a template literal, and a line inside one that begins with
// // is text rather than a comment. There is not one backtick in the script
// today; if somebody adds one this THROWS rather than quietly shipping a
// mangled game, which is the failure mode this file spends most of its comments
// warning about. Trailing comments after code are left alone: telling one from
// a // inside a string or a regex literal needs a real tokenizer, and they are
// 4% of the total.
function miniJS(js) {
  if (js.indexOf("\u0060") !== -1) {
    throw new Error(
      "build-garbage-run: the game script now contains a backtick, so it may " +
      "hold a multi-line string and miniJS can no longer prove that a line " +
      "starting with // is a comment. Use a real tokenizer, or keep the script " +
      "free of template literals."
    );
  }
  return js
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line) => line !== "" && !/^\s*\/\//.test(line))
    .join("\n");
}

// The game script, kept out of the page template so it can go through miniJS on
// the way out. It is emitted verbatim apart from the comment strip.
const GAME_JS = `
(function () {
  "use strict";
  var cv = document.getElementById("grCanvas");
  // THE PANEL SHIPS IN ATTRACT MODE IN THE MARKUP, so that a browser painting
  // before this inline script runs never shows the plain card for a frame. That
  // makes the class a promise this script has to keep: on the one path where it
  // gives up, a canvas it cannot get a context from, the class comes straight
  // back off and the ordinary panel with its visible Start button is what the
  // reader gets.
  if (!cv || !cv.getContext) {
    var dead = document.getElementById("grOver");
    if (dead) dead.classList.remove("gr-attract");
    return;
  }
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
  var EVOLVE_AT = ${EVOLVE_AT};

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
  // trash at a glance, which matters more than variety when the thing is
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
  // Both of these come from the builder now, off one list, so the sprite a
  // hazard wears and the name the game calls it cannot disagree. See FOES and
  // FOE_NAMES up there for where the names are read from.
  var FOES = ${JSON.stringify(FOES)};
  var FOE_NAMES = ${JSON.stringify(FOE_NAMES)};
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
  // dist IS NOT t * speed AND THAT IS THE POINT. The old block strip scrolled on
  // t * speed * 0.28, which is the distance travelled only while speed is
  // constant: every time the ramp nudged speed the whole strip jumped sideways
  // by t times the increment. It was invisible on seven identical rectangles and
  // it would not be on a skyline with a waterfall in it. This accumulates the
  // real distance instead, one addition per world step.
  var speed = 0, t = 0, dist = 0;
  // Animation frames since the run began. Not the world clock: this one keeps
  // counting through the count-in, the evolution freeze and the death hold. The
  // flip guard above is its only reader.
  var frameN = 0;

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

  // THE STREET WAS EMPTY FOR THE FIRST FOUR AND A HALF SECONDS AND THAT IS THE
  // WHOLE SESSION FOR MOST PLAYERS. Driven at 390x844 with the clock faked and
  // Math.random seeded, on the game exactly as it shipped: nextPack starts at 90,
  // so the first trail is born on frame 90 at x=440, and at the starting speed of
  // 2.4 it needs another 152 frames to reach the player at x=74. Add the 45 frame
  // count-in and the first point a new player can score lands 4.8 SECONDS after
  // the tap that started the run. Measured over 24 seeds with a human-latency
  // policy, the median score at the ten second mark is 1. Nothing whatever
  // happens on screen for the first two seconds: no trash, no hazard, one
  // Trubbish falling down an empty black column.
  //
  // This game is for somebody who opened it in a restock line, and for most of
  // them the first ten seconds ARE the game. Handing them four of those seconds
  // of empty street is the single worst thing about it.
  //
  // THE OPENING TRAIL IS HAND PLACED AND DRAWS NO RANDOM NUMBERS ITSELF, which
  // is why the indices are fixed rather than rolled. THAT IS NOT THE SAME THING
  // AS LEAVING THE STREAM ALONE, AND THE FIRST VERSION OF THIS COMMENT CLAIMED
  // IT WAS. It was checked instead of believed, and it was wrong: 0 of 12 seeds
  // came out identical. The route is the one the plate flag's own note warns
  // about two hundred lines down. Collecting a piece moves the SCORE, big is
  // score % 5 === 0, and big sets a spark LOOP COUNT that draws two randoms
  // per spark. Five free pieces at the top of a run therefore re-phase every
  // pickup after them. A COSMETIC FLAG THAT FEEDS A LOOP COUNT IS A DIFFICULTY
  // CHANGE, exactly as that note says, and anything that touches the score is
  // upstream of it. There is no way to add trash to the street and keep the old
  // stream, so the question is not whether it re-rolls but whether it BIASES.
  //
  // IT DOES NOT. It is a reshuffle, and that was measured rather than argued.
  // 40 seeds a side, human latency (8 frames, 24px of aim slop, one decision in
  // twenty missed), same harness both sides, medians:
  //
  //                        first point   at 5s   at 10s   run     score
  //   survive, before          10.37s       0       1     134.0s    39
  //   survive, after            1.47s       5       5     141.3s    46
  //   collect, before          10.18s       0       0       6.7s     0
  //   collect, after            1.45s       5       7      76.7s    34
  //
  // SURVIVAL TIME IS THE NUMBER THAT MATTERS AND IT DID NOT MOVE: 134.0 to
  // 141.3 seconds is inside the seed-to-seed spread. The game is not easier, it
  // simply is not EMPTY. The collector's jump is real but do not quote it as a
  // balance fix: that policy chases the nearest pack, and without an opening
  // trail its first target is far away, so it makes one huge committed excursion
  // and dies. What the trail actually teaches it, and a person, is to hold the
  // middle of the lane, which is where the trash is and where nothing can reach
  // you. The deeper finding at the top of this file, that chasing trash is a
  // mistake, is UNTOUCHED by this and is still the thing to fix next.
  //
  // IT IS ALSO THE ONLY TUTORIAL THE GAME HAS, AND IT NEEDS NO COPY. The five
  // pieces sit at the exact height Trubbish starts at and run from x=200 to
  // x=336, so they are already on screen while the count-in is still counting.
  // A player who taps nothing falls to the floor and watches all five sail past
  // at head height, which teaches what a tap is for better than a sentence
  // above the board can. A player who taps scores inside the first second.
  //
  // WHY IT CANNOT REACH THE REST OF THE RUN. The first hazard is born on frame
  // 60 at x=440, by which time these five have moved to x<=192, and clearOfPacks
  // only looks from x-100 to x+180, i.e. 340 to 620. So the opening trail is out
  // of that window before the first hazard exists and cannot shorten it. The one
  // piece at 336 is the closest it ever gets and it is 148px clear.
  var OPEN_TRAIL = [13, 1, 12, 4, 8];
  function primeStreet(L) {
    for (var i = 0; i < OPEN_TRAIL.length; i++) {
      var ji = OPEN_TRAIL[i];
      L.packs.push({
        x: 200 + i * 34, y: L.top + L.h / 2, got: false,
        emoji: JUNK[ji], plate: ji % 3 === 0,
      });
    }
  }

  function reset() {
    speed = calm ? 1.9 : 2.4;
    t = 0;
    dist = 0;
    lanes = [makeLane(0, H)];
    primeStreet(lanes[0]);
    paint();
  }

  // TWO FINGERS AT ONCE USED TO BE NO FLIP AT ALL, and it was found by driving
  // the board with real touch events rather than with a PointerEvent built in
  // page script. A two-finger tap is two pointerdowns in the same task, so it
  // was two flips, so it was a flip and its exact undo: measured at 390x844 on
  // DPR 3 and DPR 2, flip went 1 -> 1 and Trubbish did not move. The game is
  // one thumb by design, but a phone handed to somebody else is held in two
  // hands, and a panicking player slaps at it. A silent no-op is the worst
  // possible answer there: nothing on the screen says the tap was heard.
  //
  // The guard is the ANIMATION FRAME rather than a millisecond window, so there
  // is no constant to tune and it cannot drift with the frame rate. Two contacts
  // of the same tap land in the same task, before the next frame, and coalesce
  // into one flip; two deliberate taps are 236ms apart at the measured human
  // rate, fourteen frames, and are untouched. Verified inert: 30 bot runs across
  // three policies are identical to the frame with and without it.
  //
  // IT COUNTS ANIMATION FRAMES AND NOT WORLD FRAMES, and the first version
  // counted world frames, which is wrong in the two places the world stops. t
  // does not advance during the count-in or during the evolution freeze, so
  // every tap in the first 750ms of a run and every tap in the 200ms of the
  // evolution collapsed into one: measured, three separate taps 120ms apart at
  // the start of a run produced ONE flip. frameN advances whenever tick() does,
  // which is every frame the game is up, stopped or not.
  var lastFlipF = -1;
  function flip(i) {
    var L = lanes[i];
    if (!L || !L.alive) return;
    if (lastFlipF === frameN) return;
    lastFlipF = frameN;
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
  // The tallest this stack may be without burying trash that is already in
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
    // the hazards and the trash completely and did nothing but hold the
    // midline: ten runs of ten minutes, ten survivals, no deaths, and a passive
    // score of 242 to 326 collected purely by things flying into it. The
    // hazards were scenery and the difficulty curve was flat forever.
    //
    // A hazard can now be a STACK: the Pokemon perched on top of a column of
    // trash that comes some way into the lane, so the safe corridor moves and
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
      // trash that is already in flight beside it, it gets shorter; if it
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
    // THE PICKUP is trash, which is the entire point of being a Trubbish.
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
      // trash you cannot take without dying is not a reward, it is a trap.
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
      // column, trash drawn in a place you could not reach without dying. A
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
        // SOME OF THE RUBBISH IS A GARBAGE PLATE, and which ones is decided
        // WITHOUT DRAWING A NEW RANDOM NUMBER. That is not tidiness, it is the
        // whole reason this change is provably not a difficulty change: one
        // extra Math.random() per pickup shifts every draw after it, so the
        // hazard heights, the pinch rolls and the trail arcs all move and every
        // measured number in this file is quietly invalidated. The plate rides
        // on the index that was already drawn for the emoji, so the random
        // stream is byte for byte what it was. Verified: the camper bot's death
        // frame and the hash of its whole random stream are identical before and
        // after, on all ten seeds.
        // 14 of the 40 indices are plates, so it is roughly one piece in three.
        var ji = Math.floor(Math.random() * JUNK.length);
        L.packs.push({
          x: pxk, y: yy, got: false,
          emoji: JUNK[ji], plate: ji % 3 === 0,
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
        // A plate gets the bigger ring and the bigger +1. It is worth ONE POINT
        // like everything else, deliberately: scoring is where a difficulty
        // change hides, and what Tim asked for is that some of the trash IS a
        // Garbage Plate, not that it is worth more. The reward is the moment.
        //
        // AND THE SPARK COUNT IS DELIBERATELY NOT PART OF IT, which cost a whole
        // measurement pass to learn. The first version was one flag, big =
        // score % 5 === 0 || p.plate, and every spark draws TWO random numbers
        // for its velocity, so three extra sparks on a plate meant six extra
        // draws and the entire random stream shifted from that pickup on. The
        // camper bot's death frames moved by up to 11,000 frames on the same
        // seeds and every difficulty number in this file was quietly invalid.
        // A COSMETIC FLAG THAT FEEDS A LOOP COUNT IS A DIFFICULTY CHANGE. The
        // spark loop keeps the old flag; only the ring and the number, which
        // draw nothing, look at the plate.
        var big = L.score % 5 === 0;
        var pop = big || p.plate;
        L.bits.push({ k: "ring", x: p.x, y: p.y, life: pop ? 20 : 14, max: pop ? 20 : 14, big: pop });
        L.bits.push({ k: "num", x: p.x, y: p.y, life: 26, max: 26, big: pop });
        for (var sp = 0; sp < (big ? 6 : 3); sp++) {
          L.bits.push({ k: "spark", x: p.x, y: p.y, life: 16, max: 16,
            vx: -1.6 - Math.random() * 2.4, vy: (Math.random() - 0.5) * 4.6 });
        }
        // EVOLVE AT A HUNDRED. Trubbish becomes Garbodor for the rest of the
        // run and stays that way: there is no going back, which is the point of
        // an evolution and also the reward for surviving that long.
        //
        // AND IT NOW LANDS LIKE ONE. It used to be marked by a gold tint and a
        // word appearing over a world that never paused to notice. freeze holds
        // the whole simulation for twelve frames, which is the oldest trick in
        // the genre and the cheapest: nothing moves, so the change of sprite is
        // the only thing your eye has to look at.
        if (!L.evolved && L.score >= EVOLVE_AT) {
          L.evolved = true; L.evoFlash = 42; L.evoRing = 34;
          L.freeze = calm ? 0 : 12; L.shake = calm ? 0 : 10;
        }
        // HOW OFTEN ANYBODY ACTUALLY SEES IT, MEASURED, because the sentence
        // above used to say "a hundred pieces of trash is several minutes of
        // unbroken play" and that has been wrong since trails went in. It is
        // ~49 SECONDS for a player who never misses, and the reason it still
        // reads as rare is that almost nobody survives 49 seconds:
        //
        //   perfect play, no latency                  evolves at t=2673..3124
        //   human latency, playing it safe             9 runs in 60
        //   human latency, taking the trash          3 runs in 60
        //
        // So the evolution is roughly a one-in-ten event, and the figure on the
        // page above is the only place most readers will ever see Garbodor. That
        // is an argument for keeping the figure, not for moving EVOLVE_AT: the
        // number is round, the copy is built from it, and a reward you reach
        // every run is not one. If a later pass does want it commoner, change
        // EVOLVE_AT and re-run the bots, because it moves the freeze, the freeze
        // moves nothing else, and the whole difficulty question is upstream of
        // it anyway.
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
    // A "block" token used to live here at rgba(255,255,255,.055): the seven
    // scrolling rectangles that were the background before the skyline. That
    // number is kept in the skyline's own comment as the brightness ceiling the
    // new layers must not pass, which is the only job it has left, so the token
    // itself is gone rather than sitting here unread.
    band: "#242424", bandEdge: "rgba(232,185,58,.34)",
    hazard: "#F5F4F0", near: "#E8B93A",
    gold: "#E8B93A", goldDim: "rgba(232,185,58,.11)",
    ink: "#F5F4F0", inkDim: "rgba(245,244,240,.55)",
    onGold: "#111111", scrim: "rgba(10,10,10,.55)",
    // THE TITLE SCREEN'S OWN FOUR COLORS, AND ONLY FOUR. The scene under it is
    // painted in the game's older gold-and-mono set; the title screen is painted
    // in Trubbish Deep, the site's palette, because it is the first thing on the
    // page a reader looks at and it is the site talking rather than the game.
    // titlePink is the same #E87EA1 as .hl in the h1 directly above the board,
    // so the word RUN is pink on the canvas for exactly the reason it is pink in
    // the heading. titleBlue is the light blue, on the prompt, because teal is
    // how you get around and pressing start is how you get in. titleShade is the
    // bag green and it is the letters' extrude, which is the one thing that
    // stops big pixel type reading as flat blocky text.
    titleScrim: "rgba(8,14,10,.92)", titleScrimLow: "rgba(8,14,10,.2)",
    titlePink: "#E87EA1", titleBlue: "#70B5D9", titleShade: "#2F4F39",
    titleDim: "rgba(236,228,212,.5)",
  };

  // ---- downtown Rochester ---------------------------------------------
  // WHAT THE BACKGROUND WAS: seven 44x74 rectangles at rgba(255,255,255,.055),
  // scrolling along the bottom. It read as "some blocks", which is fair, and it
  // was the safest thing that could be there. This replaces it with the actual
  // skyline and the ONLY interesting question is whether the game is still
  // readable over it, because a reflex game that looks better and plays worse
  // is a straight loss.
  //
  // THE RULE THIS LAYER OBEYS, and it is the whole reason it is safe: NOTHING IN
  // THE SKYLINE IS BRIGHTER THAN THE STRIP IT REPLACES, which measured #282828
  // where it crossed the brightest part of the sky gradient. Every piece of
  // detail inside a building is CUT OUT of the mass with destination-out rather
  // than drawn over it in a lighter colour, so a fin, a floor band or a truss
  // member can only ever be darker than the silhouette it sits in. There is not
  // one lit window anywhere. That leaves the gold hairlines, the white hazard
  // rings, the gold pickup rings, the sprites and the HUD as the only bright
  // objects on the canvas, which is exactly the state the board was already in.
  //
  // AND THE CEILING IS STRUCTURAL, NOT ARITHMETIC, WHICH IT WAS NOT AT FIRST.
  // Version one painted both tiles WHITE and blitted each at an alpha worked out
  // to land under #282828, which is correct for either layer on its own and
  // wrong for both: source-over composites, so the near layer laid over the far
  // one added to it and the overlap measured #323232, brighter than the thing it
  // replaced, and gold over it fell from 8.03:1 to 6.98:1. Nothing about that is
  // visible while writing it.
  //
  // The tiles are painted in SKY_TOP itself now, a flat grey, instead of in
  // white. Compositing a value V at any alpha over a background B lands between
  // B and V, so as long as every layer's paint is SKY_TOP and everything behind
  // it is darker, no stack of them can pass SKY_TOP however many there are. The
  // far layer's extra dimming is then purely a depth cue and cannot break the
  // ceiling by being tuned wrong.
  //
  // MEASURED, on the frame reset() draws at load, where no obstacle and no
  // pickup has spawned yet so every pixel outside the two sprites is background
  // by construction. Brightest background grey anywhere on the board, and the
  // contrast of the two marks that matter over that worst case:
  //
  //                        peak bg      gold on it   hazard white on it
  //   before, 7 blocks     #282828        8.03:1          13.40:1
  //   white tiles, v1      #323232        6.98:1          11.65:1
  //   flat tiles, now      #242424        8.45:1          14.10:1
  //
  // At 1440x900 the peak is #252525 and gold is 8.34:1. So the board a player
  // reads is very slightly CLEANER than it was before the city went in, which is
  // the only version of this change worth shipping.
  //
  // TILES, NOT SHAPES PER FRAME. Both layers are drawn ONCE into an offscreen
  // canvas and blitted at most twice each, so the per-frame cost is four
  // drawImage calls whatever the buildings are made of. That is what makes the
  // detail free: the Xerox tower's fins, the silo tops and the Pont de Rennes
  // truss cost nothing at runtime because they are already pixels.
  //
  // THE FAR TILE IS 840 WIDE, TWICE THE WORLD, so half of it is on screen at
  // once, which is why there is exactly ONE of each landmark in it. Two sets of
  // the Times Square wings 420 apart would both be visible and the repeat would
  // be the first thing anybody noticed. The generic blocks repeat; the
  // recognisable shapes do not.
  var FAR_W = 840, FAR_H = 250, NEAR_W = 630, NEAR_H = 130;
  // The ceiling colour every tile is painted in, and the far layer's dimming.
  // SKY_TOP is the one number to turn if this ever has to get quieter still:
  // drop it and the whole skyline, both layers, moves with it and the invariant
  // above still holds. FAR_A only pushes the far layer further back.
  //
  // IT IS #242424 AND NOT THE OLD STRIP'S #282828, FOR ONE REASON. A hazard's
  // stack column is filled #2B2B2B, so at #282828 the tallest hazards in the
  // game stood three values out of 255 clear of the city behind them: the
  // silhouette was carried entirely by the column's gold outline and its
  // highlight bars, with the fill doing nothing. Four values back puts seven
  // between them, which is not much and is more than twice as much, and it also
  // makes "no brighter than the strip it replaces" true with room to spare
  // rather than true by a single antialiased pixel. Measured cost: the city
  // steps 12 values above the sky instead of 16 at the bottom of the lane. It
  // is still plainly a skyline at 342 CSS pixels wide, which was checked by
  // looking at it and not by looking at this number.
  var SKY_TOP = "#242424";
  var FAR_A = 0.55, NEAR_A = 1;
  // Parallax. The old strip ran at 0.28 of world speed; the near layer keeps
  // roughly that and the far one crawls, which is the entire depth cue.
  var FAR_P = 0.10, NEAR_P = 0.26;
  var SKY = { far: null, near: null, plate: null, px: 0, ppx: 0 };

  function offtile(w, h, px) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * px));
    c.height = Math.max(1, Math.round(h * px));
    var g = c.getContext("2d");
    g.setTransform(px, 0, 0, px, 0, 0);
    g.fillStyle = SKY_TOP;
    return { c: c, g: g };
  }
  // Detail is subtracted, never added. See the rule above.
  function cut(g, x, y, w, h, a) {
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.globalAlpha = a;
    g.fillRect(x, y, w, h);
    g.restore();
  }
  // Atmospheric haze, baked into the tile so it costs nothing per frame. It is
  // not only for looks: the tall towers are the part of this layer that reaches
  // up into the band where trash flies, and fading their tops is what stops a
  // 220px tower edge running vertically past a gold pickup ring.
  function haze(g, w, h, solid, topCut) {
    g.save();
    g.globalCompositeOperation = "destination-out";
    var gr = g.createLinearGradient(0, h - solid, 0, -30);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(0,0,0," + topCut + ")");
    g.fillStyle = gr;
    g.fillRect(0, -30, w, h - solid + 30);
    g.restore();
  }

  // KODAK TOWER, 343 State Street. A slender shaft with a stepped crown and a
  // mast on top. The steps are what make it Kodak rather than a rectangle.
  function bKodak(g, x, y, w, h) {
    g.fillRect(x, y + 46, w, h - 46);
    g.fillRect(x + w * 0.11, y + 28, w * 0.78, 19);
    g.fillRect(x + w * 0.24, y + 15, w * 0.52, 14);
    g.fillRect(x + w * 0.36, y + 6, w * 0.28, 10);
    g.fillRect(x + w * 0.46, y - 8, w * 0.08, 15);
    cut(g, x + w * 0.46, y + 50, w * 0.08, h - 54, 0.5);
  }
  // THE TIMES SQUARE BUILDING AND ITS FOUR WINGS OF PROGRESS. Four aluminium
  // fins, forty two feet each, and the one Rochester roofline somebody would
  // name from a silhouette alone. If only one shape in this layer survives being
  // dimmed, it has to be this one, so the wings are drawn tall and separated
  // rather than accurately proportioned.
  function bTimes(g, x, y, w, h) {
    var cx = x + w / 2;
    g.fillRect(x, y + 44, w, h - 44);
    g.fillRect(x + w * 0.13, y + 30, w * 0.74, 15);
    g.fillRect(x + w * 0.27, y + 20, w * 0.46, 11);
    var lean = [-1, -0.34, 0.34, 1];
    for (var s = 0; s < 4; s++) {
      var q = lean[s], tall = Math.abs(q) > 0.5 ? 21 : 30;
      g.beginPath();
      g.moveTo(cx - 3 + q * 2, y + 22);
      g.quadraticCurveTo(cx + q * 12, y + 6, cx + q * 20, y + 22 - tall);
      g.quadraticCurveTo(cx + q * 8, y + 11, cx + 3 + q * 2, y + 22);
      g.closePath();
      g.fill();
    }
  }
  // XEROX TOWER: thirty storeys, flat topped, tallest thing in the city, and
  // covered top to bottom in vertical concrete fins. The fins are the only
  // detail it gets and they are cut, not drawn.
  function bXerox(g, x, y, w, h) {
    g.fillRect(x, y, w, h);
    for (var f = 6; f < w - 4; f += 7) cut(g, x + f, y + 5, 1.5, h - 5, 0.42);
    cut(g, x, y + 3.5, w, 1.5, 0.55);
  }
  // Chase Tower: a plain slab with a slightly narrower crown, banded by floor.
  function bChase(g, x, y, w, h) {
    g.fillRect(x, y + 9, w, h - 9);
    g.fillRect(x + w * 0.15, y, w * 0.7, 10);
    for (var r = 17; r < h - 8; r += 13) cut(g, x + 2, y + r, w - 4, 1.3, 0.4);
  }
  // Bausch and Lomb Place: postmodern setbacks, a staircase from one side.
  function bStep(g, x, y, w, h) {
    g.fillRect(x, y + 34, w, h - 34);
    g.fillRect(x, y + 19, w * 0.72, 16);
    g.fillRect(x, y + 7, w * 0.46, 13);
    g.fillRect(x, y, w * 0.24, 8);
    cut(g, x + w * 0.7, y + 38, 1.4, h - 42, 0.45);
  }
  // The grain elevator by the river: four tangent cylinders with domed tops.
  function bSilo(g, x, y, w, h) {
    var n = 4, cw = w / n;
    for (var s = 0; s < n; s++) {
      var sx = x + s * cw;
      g.beginPath();
      g.moveTo(sx, y + h);
      g.lineTo(sx, y + cw * 0.55);
      g.quadraticCurveTo(sx + cw / 2, y - 2, sx + cw, y + cw * 0.55);
      g.lineTo(sx + cw, y + h);
      g.closePath();
      g.fill();
      if (s) cut(g, sx - 0.7, y + 3, 1.4, h - 3, 0.42);
    }
  }
  // A church spire. Rochester has a skyline full of them and one narrow pointed
  // shape does more for "this is a city" at this size than another slab does.
  function bSpire(g, x, y, w, h) {
    g.fillRect(x + w * 0.14, y + 34, w * 0.72, h - 34);
    g.beginPath();
    g.moveTo(x + w * 0.04, y + 36);
    g.lineTo(x + w / 2, y + 3);
    g.lineTo(x + w * 0.96, y + 36);
    g.closePath();
    g.fill();
    g.fillRect(x + w * 0.46, y - 9, w * 0.08, 13);
    g.fillRect(x + w * 0.34, y - 5, w * 0.32, 1.6);
  }
  // Public Market sheds: long, low, sawtooth roofed. THE TEETH WERE HALF THIS
  // SIZE AND TWICE AS MANY and three sheds' worth of them ran the full width of
  // the near layer as one continuous zigzag: it read as a picket fence, or as
  // hills, and not as buildings at all. Fewer and shallower, and only one shed
  // in the plan instead of three.
  function bShed(g, x, y, w, h) {
    g.fillRect(x, y + 7, w, h - 7);
    var n = Math.max(2, Math.round(w / 27)), sw = w / n;
    for (var s = 0; s < n; s++) {
      g.beginPath();
      g.moveTo(x + s * sw, y + 8);
      g.lineTo(x + s * sw + sw * 0.62, y);
      g.lineTo(x + (s + 1) * sw, y + 8);
      g.closePath();
      g.fill();
    }
  }
  // A row of low brick warehouses, which is what the near bank of the river
  // actually is: two or three flat roofs at slightly different heights with a
  // chimney, and a horizontal course line so the mass is not one flat slab.
  function bRow(g, x, y, w, h) {
    var n = 3, sw = w / n, hs = [0, 7, 3];
    for (var s = 0; s < n; s++) {
      g.fillRect(x + s * sw, y + hs[s], sw - 1.2, h - hs[s]);
    }
    g.fillRect(x + w * 0.2, y - 9, 3, 11);
    cut(g, x, y + 15, w, 1.4, 0.4);
    cut(g, x, y + 26, w, 1.4, 0.4);
  }
  function bTank(g, x, y, w, h) {
    g.fillRect(x + w * 0.14, y + 22, 2.4, h - 22);
    g.fillRect(x + w * 0.72, y + 22, 2.4, h - 22);
    g.fillRect(x + w * 0.1, y + 31, w * 0.8, 1.8);
    g.beginPath();
    g.moveTo(x, y + 23);
    g.lineTo(x, y + 11);
    g.quadraticCurveTo(x + w / 2, y - 7, x + w, y + 11);
    g.lineTo(x + w, y + 23);
    g.closePath();
    g.fill();
    g.fillRect(x + w * 0.45, y - 10, w * 0.1, 8);
  }
  // A works with a chimney: the brewery end of the river.
  function bWorks(g, x, y, w, h) {
    g.fillRect(x, y + 25, w, h - 25);
    g.fillRect(x + w * 0.62, y + 1, w * 0.13, 25);
    g.fillRect(x + w * 0.59, y - 2, w * 0.19, 4);
    for (var r = 31; r < h; r += 11) cut(g, x + 3, y + r, w - 6, 1.2, 0.4);
  }
  // HIGH FALLS AND THE PONT DE RENNES. Ninety six feet of the Genesee dropping
  // through the middle of downtown with a steel arch footbridge over the top of
  // it, which is the postcard. It earns its place twice: it is the second most
  // recognisable thing in the city, and the gorge is the one place the built up
  // line breaks, so the near layer stops reading as an unbroken wall.
  function bFalls(g, x, y, w, h) {
    var gw = w * 0.42, gx = x + (w - gw) / 2, base = y + h;
    // The cliffs, cut back hard so the water is the lighter thing between them.
    g.fillRect(x, y + 46, gx - x, h - 46);
    g.fillRect(gx + gw, y + 46, x + w - (gx + gw), h - 46);
    cut(g, x, y + 48, gx - x, h - 48, 0.42);
    cut(g, gx + gw, y + 48, x + w - (gx + gw), h - 48, 0.42);
    // The sheet of water, streaked vertically.
    g.fillRect(gx, y + 50, gw, h - 58);
    for (var s = 3; s < gw - 2; s += 6) cut(g, gx + s, y + 52, 1.6, h - 62, 0.45);
    // The plume where it lands.
    var mg = g.createRadialGradient(gx + gw / 2, base - 8, 1, gx + gw / 2, base - 8, gw * 0.8);
    mg.addColorStop(0, "rgba(36,36,36,.85)");
    mg.addColorStop(1, "rgba(36,36,36,0)");
    g.save();
    g.fillStyle = mg;
    g.fillRect(gx - gw * 0.6, base - 26, gw * 2.2, 26);
    g.restore();
    g.fillStyle = SKY_TOP;
    // The bridge: a straight deck on a shallow arch, with hangers between them.
    // Sampled off one quadratic so the hangers land on the arch rather than near
    // it, which is the difference between a bridge and a comb.
    var y0 = y + 62, yc = y + 18, deck = y + 30;
    function arcY(u) { return (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * yc + u * u * y0; }
    for (var v = 0.08; v < 0.93; v += 0.085) {
      var ax = x + 2 + v * (w - 4), ay = arcY(v);
      if (ay > deck + 3) g.fillRect(ax - 1, deck + 3, 2, ay - deck - 3);
    }
    g.beginPath();
    g.moveTo(x + 2, y0);
    g.quadraticCurveTo(x + w / 2, yc, x + w - 2, y0);
    g.lineTo(x + w - 2, y0 + 3.4);
    g.quadraticCurveTo(x + w / 2, yc + 3.4, x + 2, y0 + 3.4);
    g.closePath();
    g.fill();
    g.fillRect(x, deck, w, 4.5);
  }

  var FAR_PLAN = [
    [6, 52, 96, "b"], [62, 30, 178, "kodak"], [96, 58, 74, "b"],
    [158, 46, 150, "times"], [208, 34, 92, "b"], [246, 64, 220, "xerox"],
    [314, 40, 126, "step"], [358, 30, 68, "b"], [392, 54, 192, "chase"],
    [450, 36, 104, "b"], [490, 46, 138, "step"], [540, 28, 76, "b"],
    [572, 58, 116, "b"], [634, 36, 150, "silo"], [676, 44, 88, "b"],
    [724, 48, 128, "b"], [778, 26, 168, "spire"], [810, 26, 82, "b"],
  ];
  // GAPS ARE PART OF THE PLAN. The first near layer had a building at every x
  // and read as one continuous wall along the bottom of the lane, which is both
  // wrong for a river city and the version most likely to sit under a pickup.
  // The river gorge is the big break and there are two more.
  var NEAR_PLAN = [
    [6, 66, 36, "row"], [80, 22, 58, "tank"], [110, 86, 30, "shed"],
    [214, 156, 100, "falls"],
    [388, 50, 50, "row"], [446, 30, 38, "b"],
    [500, 58, 70, "works"], [566, 56, 32, "row"],
  ];
  var PAINT = {
    kodak: bKodak, times: bTimes, xerox: bXerox, chase: bChase, step: bStep,
    silo: bSilo, spire: bSpire, shed: bShed, tank: bTank, works: bWorks,
    falls: bFalls, row: bRow,
  };
  function skyline(plan, w, h, px, solid, topCut) {
    var o = offtile(w, h, px);
    for (var i = 0; i < plan.length; i++) {
      var b = plan[i], fn = PAINT[b[3]];
      if (fn) fn(o.g, b[0], h - b[2], b[1], b[2]);
      else o.g.fillRect(b[0], h - b[2], b[1], b[2]);
    }
    haze(o.g, w, h, solid, topCut);
    return o.c;
  }

  // THE GARBAGE PLATE, which is what this whole channel is named after. Nick
  // Tahou Hots: home fries and macaroni salad underneath, two hots or burgers on
  // top, meat hot sauce over all of it, mustard and raw onion, on a paper plate.
  //
  // IT HAS TO READ AT THIRTY PIXELS AND THAT IS THE ENTIRE BRIEF. Every honest
  // attempt at the real thing is a brown blob at this size, so the drawing is
  // four statements in the order of what survives shrinking: a pale oval that is
  // unmistakably a plate, a dark mass sitting on it, one mustard streak, three
  // white specks of onion. Anything past that disappears and only costs pixels.
  // It is pre-rendered like the skyline, so a plate is one drawImage.
  var PLATE_W = 34, PLATE_H = 26;
  function plateTile(px) {
    var o = offtile(PLATE_W, PLATE_H, px), g = o.g;
    var cx = PLATE_W / 2, cy = PLATE_H / 2 + 2;
    // THE FIRST VERSION READ AS A BOWL OF SOUP and that is the failure mode to
    // watch for: a dark sauce mass covering most of a pale disc leaves a thin
    // pale ring, and a thin pale ring around something dark is a bowl. The rim
    // has to stay WIDE and the food has to sit inside a smaller well, so the
    // plate is a flat thing seen from above rather than a container.
    g.fillStyle = "#9C9584";
    g.beginPath(); g.ellipse(cx, cy + 1.7, 16, 8.6, 0, 0, 7); g.fill();
    g.fillStyle = "#F7F3E7";
    g.beginPath(); g.ellipse(cx, cy, 16, 8.6, 0, 0, 7); g.fill();
    g.fillStyle = "#E2DBC6";
    g.beginPath(); g.ellipse(cx, cy - 0.2, 12.4, 6.1, 0, 0, 7); g.fill();
    // Home fries on one side, macaroni salad on the other. They are the bed, so
    // they are only just separated from the plate.
    g.fillStyle = "#D3A15C";
    g.beginPath(); g.ellipse(cx - 4.8, cy + 1.4, 7, 3.3, 0, 0, 7); g.fill();
    g.fillStyle = "#F0E5BE";
    g.beginPath(); g.ellipse(cx + 5.2, cy + 1.5, 6, 3, 0, 0, 7); g.fill();
    // The two hots, then the meat hot sauce ladled over the pair of them. The
    // sauce is a warm mid brown rather than the near black it was: at this size
    // a truly dark mass reads as a hole in the plate.
    g.fillStyle = "#A55E2C";
    g.beginPath(); g.ellipse(cx - 3.9, cy - 2.7, 5.6, 2.4, -0.12, 0, 7); g.fill();
    g.beginPath(); g.ellipse(cx + 4.1, cy - 2.3, 5.4, 2.4, 0.1, 0, 7); g.fill();
    g.fillStyle = "#71401D";
    g.beginPath();
    g.moveTo(cx - 9.4, cy - 1.8);
    g.bezierCurveTo(cx - 6, cy - 6.2, cx + 3, cy - 6.4, cx + 9.4, cy - 2.8);
    g.bezierCurveTo(cx + 6, cy + 1.2, cx - 5, cy + 1.4, cx - 9.4, cy - 1.8);
    g.closePath(); g.fill();
    // Mustard and raw onion. THESE TWO ARE WHY IT IS FOOD. Without them the
    // middle is one brown shape and the whole thing is a pebble on a saucer;
    // they are also the only two marks small and bright enough to survive being
    // drawn at 26 CSS pixels on a phone.
    g.strokeStyle = "#F2C734"; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - 7.4, cy - 1.6);
    g.quadraticCurveTo(cx - 2.6, cy - 5, cx + 1.2, cy - 1.6);
    g.quadraticCurveTo(cx + 4.6, cy + 1.4, cx + 8, cy - 3);
    g.stroke();
    g.fillStyle = "#FDFBF4";
    g.beginPath(); g.arc(cx - 5.6, cy - 3.9, 1.3, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + 1.2, cy - 4.4, 1.2, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + 6.4, cy - 1, 1.25, 0, 7); g.fill();
    return o.c;
  }

  // Rebuilt only when the device scale moves, from fit(). The skyline tiles are
  // capped at 2 device pixels per world unit: a desktop board asks for 3.2 and
  // that would be a 5,400px wide tile for a silhouette nobody is meant to look
  // at directly. The PLATE is not capped, because it is a gameplay object and
  // the player is meant to look straight at it.
  function buildTiles(px) {
    var sp = Math.min(2, px);
    if (SKY.px !== sp) {
      SKY.far = skyline(FAR_PLAN, FAR_W, FAR_H, sp, 100, 0.66);
      SKY.near = skyline(NEAR_PLAN, NEAR_W, NEAR_H, sp, 74, 0.42);
      SKY.px = sp;
    }
    if (SKY.ppx !== px) { SKY.plate = plateTile(px); SKY.ppx = px; }
  }

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

  // The stack a tall hazard rides in on, drawn as bagged trash rather than as
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

  // THE SHAKE HAS ITS OWN GENERATOR AND THAT IS NOT TIDINESS. It used to call
  // Math.random() twice per shaking frame, from inside drawLane, and draw() runs
  // ONCE PER ANIMATION FRAME while step() runs up to FOUR times per animation
  // frame. So the number of numbers the shake pulled out of the game's stream
  // depended on the frame rate, which means the hazard sequence after a shake
  // did too, and tick()'s own comment ("the physics are deterministic, which the
  // pack counts and the difficulty curve both assume") was not true.
  //
  // MEASURED, idle bot, same three seeds, driving the same world at one, two and
  // three world steps per animation frame. The death frame is identical every
  // time, which is the physics being right; the stream is not:
  //
  //                     seed 1              seed 2              seed 3
  //   1 step/frame   78 draws, h=2808308947   55, 1716976529   68, 1405947259
  //   2 steps/frame  64 draws, h=2778097658   41,  161708980   54, 2094265979
  //   3 steps/frame  60 draws, h=1669787473   37, 3154426850   50, 1406013808
  //
  // The gaps are exactly the shake arithmetic: 14 frames of death shake is 14
  // draw calls at 60Hz and 7 at 30Hz, two numbers each, so 28 draws against 14.
  // It only bites mid-run at the EVOLUTION, which shakes for 10 frames, and the
  // consequence is that a phone dropping frames gets a different street after
  // evolving than one that is not. Same class as the plate-spark bug this file
  // already records, found the same way and fixed the same way: the cosmetic
  // thing does not get to touch the stream.
  var shakeS = 0x2545F491;
  function wobble(amp) {
    shakeS = (Math.imul(shakeS, 1664525) + 1013904223) | 0;
    return ((shakeS >>> 8) / 16777216 - 0.5) * amp;
  }

  function drawLane(L, i) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, L.top, W, L.h); ctx.clip();
    // The shake. Applied to the world and not to the canvas element, so it costs
    // nothing on the compositor and cannot leave a gap at the frame's edge.
    if (L.shake > 0) {
      ctx.translate(wobble(L.shake), wobble(L.shake));
    }

    var g = ctx.createLinearGradient(0, L.top, 0, L.top + L.h);
    g.addColorStop(0, C.skyTop); g.addColorStop(1, C.skyBot);
    ctx.fillStyle = g; ctx.fillRect(-20, L.top - 20, W + 40, L.h + 40);

    // DOWNTOWN, TWO LAYERS, FOUR drawImage CALLS. Each tile is at most twice as
    // wide as the world, so a layer needs at most two blits to cover the frame.
    //
    // UNDER prefers-reduced-motion THE CITY IS STILL THERE AND IT DOES NOT MOVE.
    // The old strip was switched off entirely by calm, which threw away
    // content to remove motion. A skyline is a place, not an animation: the
    // reduced-motion reading is that the parallax stops, so the offset is pinned
    // at zero and the same picture is drawn every frame. Same cost, no movement.
    var sBase = L.top + L.h - 14;
    if (SKY.far) {
      var d = calm ? 0 : dist;
      var fx = -((d * FAR_P) % FAR_W);
      ctx.save();
      ctx.globalAlpha = FAR_A;
      for (; fx < W; fx += FAR_W) ctx.drawImage(SKY.far, fx, sBase - FAR_H, FAR_W, FAR_H);
      ctx.globalAlpha = NEAR_A;
      var nx = -((d * NEAR_P) % NEAR_W);
      for (; nx < W; nx += NEAR_W) ctx.drawImage(SKY.near, nx, sBase - NEAR_H, NEAR_W, NEAR_H);
      ctx.restore();
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

    // THE ATTRACT SCREEN GETS THE CITY AND NOTHING ELSE. Everything from here
    // down is the RUN: the hazards, the trash, Trubbish himself, the confetti
    // and the score readout in the corner. Under a title screen they are not a
    // backdrop, they are litter: the primed street put a ghost Trubbish and a
    // row of hazard rings behind the logo, and the corner readout showed a live
    // "100 to evolve" over a game nobody had started. Stopping here leaves the
    // sky, downtown, High Falls and the two rows that kill you, which is a place
    // rather than a paused game, and it is the reason the scrim can be light
    // enough to see it at all.
    if (titleUp) { ctx.restore(); return; }

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
    // A RING, NOT A DISC. The glow behind each piece was a flat gold fill at 20
    // per cent, which on the old olive street was a soft halo and on a near
    // black one is a solid brown coin with an emoji sitting on top of it: the
    // trash stopped reading as trash and started reading as tokens. A fainter
    // fill with a crisp gold edge says "take this" without painting over it.
    for (var b = 0; b < L.packs.length; b++) {
      var pk = L.packs[b];
      ctx.fillStyle = C.goldDim;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 16, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(232,185,58,.55)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 16.5, 0, 7); ctx.stroke();
      if (pk.plate && SKY.plate) {
        ctx.drawImage(SKY.plate, pk.x - PLATE_W / 2, pk.y - PLATE_H / 2, PLATE_W, PLATE_H);
      } else {
        ctx.font = "24px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        ctx.fillText(pk.emoji, pk.x, pk.y);
      }
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

  // ---- THE TITLE SCREEN -------------------------------------------------
  //
  // IT IS DRAWN ON THE CANVAS THE GAME ALREADY HAS, and that is the whole
  // trick. The overlay that used to carry it was an h2, a paragraph and a
  // button in the site's own type on the site's own card: correct, and a web
  // page pretending. A title screen is the machine's first screen. Drawing it
  // here means it is at the game's resolution, in the game's pixels, over the
  // game's own city, and it looks like a cartridge booting rather than like
  // markup.
  //
  // EVERY PIXEL IS A fillRect AT AN INTEGER SIZE IN DEVICE SPACE. The world
  // transform maps 420x680 onto whatever the board measured, which is almost
  // never a whole number of device pixels per world unit, so a 5x7 letter drawn
  // in world units would land on half pixels and come out soft and unevenly
  // spaced: exactly the "blocky text" failure this is trying not to be. So the
  // transform is reset to identity for the length of this function and the
  // whole screen is laid out in the canvas's REAL pixels, with the pixel size
  // derived from the board's width. Every coordinate below is an integer.
  // imageSmoothingEnabled goes off for the same reason, for the mascot.
  //
  // THE SIZES COME OFF THE WIDTH, so the screen is the same picture at 320 and
  // at 1440 and crisp at both. The board's aspect ratio is fixed at 420:680, so
  // the height follows from the width and the layout below cannot overflow: the
  // centre block measures 0.53 of the height at every size.
  var FONT_K = ${JSON.stringify(FONT_K)};
  var FONT_R = ${JSON.stringify(FONT_R)};
  var GW = 5, GH = 7, GADV = 6;

  function textW(s, u) { return s.length ? (s.length * GADV - 1) * u : 0; }

  // Left-anchored, because the high score row is two colors on one line and a
  // centered-only helper cannot place the second half.
  function pxAt(s, x, y, u, col) {
    ctx.fillStyle = col;
    for (var i = 0; i < s.length; i++) {
      var gi = FONT_K.indexOf(s.charAt(i));
      if (gi < 0) continue;
      var gx = x + i * GADV * u;
      for (var r = 0; r < GH; r++) {
        var bits = parseInt(FONT_R.charAt(gi * GH + r), 32);
        if (!bits) continue;
        for (var c = 0; c < GW; c++) {
          if (bits & (16 >> c)) ctx.fillRect(gx + c * u, y + r * u, u, u);
        }
      }
    }
  }
  function pxMid(s, cx, y, u, col) {
    pxAt(s, Math.round(cx - textW(s, u) / 2), y, u, col);
  }
  // THE EXTRUDE IS WHAT STOPS BIG PIXEL TYPE READING AS FLAT BLOCKS. One copy
  // of the word offset by exactly one pixel down and right, in the bag green,
  // under the real one. A period title logo is never a single flat fill and a
  // single flat fill is the thing that reads as clip art.
  function pxLogo(s, cx, y, u, col) {
    pxMid(s, cx + u, y + u, u, C.titleShade);
    pxMid(s, cx, y, u, col);
  }

  // THE MASCOT IS THE GAME'S OWN SPRITE, PUT THROUGH A 32 WIDE GRID. Trubbish is
  // a 512px illustration, and dropping that on a screen made of 5x7 letters is
  // the mismatch that makes a retro screen look like a mock-up: smooth artwork
  // next to hard pixels. Drawing it small into an offscreen canvas and blowing
  // that back up with smoothing off turns the sprite the game already loaded
  // into real pixel art, off the same file, so it cannot describe a different
  // Trubbish from the one you are about to play as. Built once and cached.
  //
  // THE TILE IS 32x29 AND NOT 32x32 SINCE HE SAT DOWN. Three rows out of
  // thirty-two is the squash that turns a sprite resting on a plate into a
  // sprite with weight on a plate, and the SQUASH HAPPENS ON THE WAY DOWN, in
  // the resample from 512, rather than on the way back up. Squashing on the way
  // up would ask for 29 rows of output from 32 rows of tile, so five of the
  // mascot's pixels would come out a different height from the other
  // twenty-four, on a screen whose whole argument is one pixel size. This way
  // every cell is exactly mk square and the only thing that changed is how much
  // of Trubbish went into it. He is a squat blob to start with, so it reads as
  // him settling rather than as a distortion.
  var MASC_H = 29;
  var mascotTile = null;
  function mascot() {
    if (mascotTile) return mascotTile;
    if (!SP_TRUB.ready) return null;
    var off = document.createElement("canvas");
    off.width = 32; off.height = MASC_H;
    var oc = off.getContext("2d");
    if (!oc) return null;
    oc.drawImage(SP_TRUB.img, 0, 0, 32, MASC_H);
    mascotTile = off;
    return off;
  }

  // ---- THE GARBAGE PLATE HE IS SITTING ON --------------------------------
  //
  // Tim, on the title screen that shipped an hour before this: "can we make the
  // trubbish mascot sitting on a big Garbage Plate, then it will be perfect".
  // The channel is named after the dish and the reference is the channel's own
  // commissioned banner, public/assets/banner-trubbish.jpg, which already has
  // this exact picture in it: Trubbish on a Rochester street with a plate beside
  // him. The only change is that he is ON it here.
  //
  // IT IS THE SAME DISH THE GAME ALREADY DRAWS, IN THE SAME NINE COLOURS.
  // plateTile() up in the world paints a Garbage Plate at 34x26 as a collectible,
  // and its comment records both the recipe and the palette that survived being
  // shrunk to that: a pale plate with a WIDE rim so it cannot read as a bowl,
  // home fries on one side and macaroni salad on the other, meat hot sauce
  // ladled over the seam, one mustard streak, white specks of raw onion. Not one
  // colour below is new. The one thing that is not one of the nine is the
  // shadow the mascot casts on his dinner, and that is a wash at 30 per cent
  // black rather than a colour, the same move the scanlines over the whole
  // screen already make. The two drawings are the same object at two sizes,
  // which is the point: the plate you sit on is the plate you chase.
  //
  // WHAT IS DIFFERENT IS THE PITCH, AND IT IS THE ONLY THING THAT COULD MAKE
  // THIS LOOK PASTED ON. plateTile is ellipses and beziers because it is a world
  // object and the world is drawn in curves. This one shares a screen with a 5x7
  // bitmap alphabet, so there is no curve anywhere below: every mark is a
  // fillRect one cell of u across, u being the same unit the ROCHESTER, NY line
  // under the dish is drawn at. The ovals are rasterised a row at a time into
  // whole cells and the staircase on their edges is the drawing rather than an
  // artifact of it.
  //
  // THE MUSTARD IS THE ONE YELLOW ON THIS SCREEN AND IT IS NOT THE GOLD.
  // #F2C734 is plateTile's own mustard, and plateTile argues for it: without the
  // mustard and the onion the middle of the dish is one brown shape and the
  // whole thing is a pebble on a saucer. The Hall of Fame gold never appears
  // here, and a real dish keeping its own colours is the same exemption the site
  // gives the Base Set schematic and the eighteen pack skins.

  // One row of a pixel ellipse, in whole cells. Rows where the ellipse is
  // narrower than a cell are dropped rather than rounded to nothing, so the
  // shape ends on a flat cap instead of fraying to single pixels.
  function ovalHalf(dy, rx, ry) {
    var t = 1 - (dy * dy) / (ry * ry);
    return t <= 0 ? 0 : Math.max(1, Math.round(rx * Math.sqrt(t)));
  }
  // ox, oy are device pixels; cx, cy, rx, ry are cells. from/to clip rows.
  function pxOval(ox, oy, u, cx, cy, rx, ry, col, from, to) {
    ctx.fillStyle = col;
    var a = from === undefined ? -ry : from;
    var b = to === undefined ? ry : to;
    for (var dy = a; dy <= b; dy++) {
      var hw = ovalHalf(dy, rx, ry);
      if (!hw) continue;
      ctx.fillRect(ox + (cx - hw) * u, oy + (cy + dy) * u, hw * 2 * u, u);
    }
  }
  // A table of marks laid ON a mound and CLIPPED TO THAT MOUND'S OWN RASTERISED
  // ROWS, so a fry cannot hang off the side of the pile it is meant to be in.
  // Each row is [x as a fraction of rx, y as a fraction of ry, length as a
  // fraction of rx] and every mark is one cell tall. THE TABLES ARE FIXED AND
  // NOT RANDOM:
  // this screen repaints just under twice a second for the blinking prompt, and
  // a scatter reboiled on every repaint is a shimmer nobody asked for.
  // side, when given, keeps the marks on one half of the shape, which is how the
  // split bed gets macaroni shadows on its left and fry edges on its right off
  // one oval. A mark that STARTS outside the shape is dropped rather than pulled
  // back to the edge: clamping it stacked every stray mark against the rim in a
  // line, which is a seam and not a texture.
  function pxMarks(ox, oy, u, cx, cy, rx, ry, tab, col, side) {
    ctx.fillStyle = col;
    for (var i = 0; i < tab.length; i++) {
      var dy = Math.round(tab[i][1] * ry);
      var hw = ovalHalf(dy, rx, ry);
      if (!hw) continue;
      var x0 = cx + Math.round(tab[i][0] * rx);
      var len = Math.max(1, Math.round(tab[i][2] * rx));
      var lft = side > 0 ? cx : cx - hw;
      var rgt = side < 0 ? cx : cx + hw;
      if (x0 < lft || x0 >= rgt) continue;
      if (x0 + len > rgt) len = rgt - x0;
      if (len < 1) continue;
      ctx.fillRect(ox + x0 * u, oy + (cy + dy) * u, len * u, u);
    }
  }

  // Left half, right half, one oval. The bed under the two heaps is drawn this
  // way so the seam between macaroni and home fries runs straight down the
  // middle of the dish instead of being an accident of where two circles met.
  function pxOvalSplit(ox, oy, u, cx, cy, rx, ry, colL, colR) {
    for (var dy = -ry; dy <= ry; dy++) {
      var hw = ovalHalf(dy, rx, ry);
      if (!hw) continue;
      var sm = cx + SEAM[(dy + 200) % SEAM.length];
      ctx.fillStyle = colL;
      ctx.fillRect(ox + (cx - hw) * u, oy + (cy + dy) * u, (sm - cx + hw) * u, u);
      ctx.fillStyle = colR;
      ctx.fillRect(ox + sm * u, oy + (cy + dy) * u, (cx + hw - sm) * u, u);
    }
  }

  // THE MARKS ARE GENERATED ONCE FROM A FIXED SEED RATHER THAN HAND TYPED. A
  // convincing heap of home fries wants forty sticks in it and forty hand typed
  // triples is a table nobody can read, let alone tune. The generator is a plain
  // linear congruential one with a constant seed, so the pile is the same pile
  // on every load, in every browser and on every repaint. That last one is the
  // point rather than tidiness: this screen repaints just under twice a second
  // for the blinking prompt, and a scatter reboiled on each repaint is a
  // shimmer nobody asked for. Built once, at parse time, into four arrays.
  function marks(n, seed, spread, lo, hi) {
    var out = [], s = seed >>> 0, i, a, b, c;
    for (i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0; a = (s >>> 8) / 16777216;
      s = (s * 1664525 + 1013904223) >>> 0; b = (s >>> 8) / 16777216;
      s = (s * 1664525 + 1013904223) >>> 0; c = (s >>> 8) / 16777216;
      out.push([(a * 2 - 1) * spread, (b * 2 - 1) * spread, lo + c * (hi - lo)]);
    }
    return out;
  }
  // Home fries are a GOLDEN MASS WITH THE EDGES BETWEEN THE STICKS DRAWN DARK,
  // and that is the way round that reads. The first attempt had it the other
  // way, a browned mass with gold sticks laid over it, and the pile came out the
  // same value as the meat sauce next to it, so the right half of the dish read
  // as more sauce. The second had the dark runs at two thirds of the heap's
  // width and they read as wood grain. They are 2 to 5 cells now: short, many,
  // and jumbled, which is what a pile of cut potato looks like from across a
  // diner. Macaroni is the pale mass with the shadows BETWEEN the elbows and a
  // few highlights on top of them, because a scoop of it at this size is texture
  // rather than shape.
  var FRIES = marks(46, 20250820, 0.86, 0.10, 0.30);
  var MAC = marks(44, 585585, 0.88, 0.05, 0.13);
  var MACD = marks(24, 30303, 0.84, 0.05, 0.11);
  var MAC2 = marks(30, 1971, 0.86, 0.05, 0.11);
  var CHUNK = marks(26, 4242, 0.82, 0.06, 0.16);
  // These four are placed by hand because there are few of them and where they
  // land is the whole of their job. The mustard is one drizzle stepped across
  // the sauce, drawn as runs rather than as a stroked curve for the same reason
  // nothing else here is a curve.
  var MUSTARD = [
    [-.80, .26, .28], [-.56, .06, .26], [-.32, -.12, .26], [-.08, -.22, .26],
    [.16, -.14, .26], [.40, .04, .26], [.62, .22, .24]
  ];
  var ONION = [
    [-.66, -.30, .10], [-.30, -.54, .09], [.08, -.46, .10], [.42, -.24, .09],
    [-.48, .18, .10], [.24, .30, .09], [-.10, .10, .10], [.62, .12, .09]
  ];
  var DRIPS = [
    [-.68, .40, .05], [-.44, .66, .04], [-.14, .80, .05],
    [.16, .78, .04], [.44, .62, .05], [.66, .38, .04]
  ];
  var SAUCE = [
    [-.78, .30, .22], [-.40, -.62, .26], [.06, .58, .24],
    [.52, -.52, .24], [.84, .18, .20], [-.06, -.30, .30]
  ];
  // THE SEAM BETWEEN THE TWO HALVES IS NOT A STRAIGHT LINE, and it read as one
  // when it was: a dead vertical edge down the middle of the dish that said
  // "two shapes" rather than "one plate". One cell of wobble per row, off a
  // fixed table, is enough to make it a boundary between two foods.
  var SEAM = [0, 1, -1, 1, 0, -1, 2, 0, -1, 1, 0, -2, 1, 0, -1, 1, 2, -1, 0, 1];
  // Where the pile squeezes out AROUND AND OVER him. Ten lobes across his own
  // half width, each with its own row so the contact line is not flat, and all
  // of them ABOVE his bottom edge rather than under it: a lobe drawn under him
  // lands on food the same colour as itself and is invisible, which is what the
  // version before this one did. Biting into his silhouette is the whole job.
  var SPILL = [
    [-1.00, -1], [-.80, -4], [-.60, -2], [-.40, -5], [-.20, -2],
    [.02, -4], [.24, -1], [.46, -4], [.68, -2], [.90, -3], [1.02, 0]
  ];

  // EVERY NUMBER IN THE DISH COMES OFF ONE INPUT, the plate's width in cells, so
  // it is the same picture at 320 and at 1440 and crisp at both. The proportions
  // are read off the banner art.
  //
  // THE SHAPE OF THE HEAP IS THE WHOLE OF THE "SITTING ON IT" PROBLEM AND IT
  // TOOK FOUR GOES. What does NOT work, in order: one mound centred under him,
  // which puts its crown behind him so nothing rises at his sides and he reads
  // as standing BEHIND a plate on a table; and a wide two bump heap filling the
  // well, which is a plateau, so he reads as standing on a table again, this
  // time a stripey one.
  //
  // A dome under him does not work either, and the reason is worth writing down
  // because it is not obvious: he is a ROUND BLOB and a dome is round, so the
  // two only ever meet at a point. Widen the dome until it clears him and it is
  // a plateau again; sink him into it until it closes over him and two thirds of
  // him is under dinner.
  //
  // WHAT WORKS IS A CRATER. Three shapes: a wide low SKIRT spreading out toward
  // the rim so the mass visibly widens on the way down; a broad shallow CROWN he
  // sits down onto; and TWO BUMPS, one either side, whose tops sit OUTSIDE his
  // silhouette and stand a good way ABOVE where his bottom edge lands. Food
  // higher than his seat on both sides of him, dipping in the middle where his
  // weight is, is the thing the eye reads as sitting. The sauce then crosses the
  // dip, closing over his bottom edge and running down the front of the heap
  // where it can actually be seen. Every shape is split down a wobbling seam,
  // macaroni salad to the left and home fries to the right, the way the banner
  // has them, so the two halves carry through the whole dish.
  function plateGeom(pw) {
    var ry = Math.max(4, Math.round(pw * 0.200));
    var th = Math.max(1, Math.round(pw * 0.036));
    var kry = Math.max(3, Math.round(ry * 0.68));
    var kdy = Math.max(1, Math.round(ry * 0.55));
    var up = kdy + kry;
    return {
      w: pw,
      rx: pw >> 1,
      ry: ry,
      th: th,
      wrx: Math.max(3, (pw >> 1) - Math.max(2, Math.round(pw * 0.120))),
      wry: Math.max(2, ry - Math.max(1, Math.round(ry * 0.42))),
      // the skirt, the wide low base the rest of the heap sits in
      brx: Math.max(4, Math.round(pw * 0.375)),
      bry: Math.max(2, Math.round(ry * 0.55)),
      bdy: Math.max(1, Math.round(ry * 0.12)),
      // the crown, broad and shallow, which is what he sits down onto
      crx: Math.max(4, Math.round(pw * 0.330)),
      cry: Math.max(2, Math.round(ry * 0.55)),
      cdy: Math.max(1, Math.round(ry * 0.45)),
      // the two bumps either side of him, which are the ones that read
      krx: Math.max(3, Math.round(pw * 0.130)),
      kry: kry,
      kdx: Math.max(3, Math.round(pw * 0.210)),
      kdy: kdy,
      // the sauce, poured across the dip and over his bottom edge
      srx: Math.max(4, Math.round(pw * 0.300)),
      sry: Math.max(2, Math.round(ry * 0.26)),
      sdy: Math.max(2, Math.round(ry * 0.53)),
      up: up,
      h: up + ry + th,
      // WHERE THE MASCOT'S BOTTOM EDGE LANDS, measured down from the crown of
      // the dome. Deep enough that the dome's shoulders and the sauce close over
      // his lower edge, shallow enough that he is a Trubbish sitting down rather
      // than a head on a dinner plate.
      seat: Math.max(2, Math.round(ry * 0.55))
    };
  }

  function platePx(ox, oy, u, G) {
    var cx = G.rx, cy = G.up, d, dy, dx, hw;

    // THE PLATE. Its underside first, one whole plate offset down by its own
    // thickness, so what stays showing is the crescent of the edge and the dish
    // has a side to it. Then the top face, then a shallower well inside a WIDE
    // rim: the rim is the thing that stops a pale disc under a dark mass reading
    // as a bowl of soup, which is the failure plateTile's own comment warns
    // about and the first version of that one actually shipped.
    pxOval(ox, oy, u, cx, cy + G.th, G.rx, G.ry, "#9C9584");
    pxOval(ox, oy, u, cx, cy, G.rx, G.ry, "#F7F3E7");
    pxOval(ox, oy, u, cx, cy, G.wrx, G.wry, "#E2DBC6");

    // THE HEAP: the shadow it throws into the well, then the skirt, then the
    // dome. Macaroni salad left, home fries right, both times, so the seam runs
    // through the whole dish instead of the two layers disagreeing about where
    // the middle is.
    pxOval(ox, oy, u, cx, cy - G.bdy + 2, G.brx + 1, G.bry, "#9C9584");
    pxOvalSplit(ox, oy, u, cx, cy - G.bdy, G.brx, G.bry, "#F0E5BE", "#D3A15C");
    pxOvalSplit(ox, oy, u, cx, cy - G.cdy, G.crx, G.cry, "#F0E5BE", "#D3A15C");
    pxOval(ox, oy, u, cx - G.kdx, cy - G.kdy, G.krx, G.kry, "#F0E5BE");
    pxOval(ox, oy, u, cx + G.kdx, cy - G.kdy, G.krx, G.kry, "#D3A15C");
    pxMarks(ox, oy, u, cx, cy - G.bdy, G.brx, G.bry, MAC, "#E2DBC6", -1);
    pxMarks(ox, oy, u, cx, cy - G.bdy, G.brx, G.bry, MACD, "#9C9584", -1);
    pxMarks(ox, oy, u, cx, cy - G.bdy, G.brx, G.bry, MAC2, "#FDFBF4", -1);
    pxMarks(ox, oy, u, cx, cy - G.bdy, G.brx, G.bry, FRIES, "#A55E2C", 1);
    pxMarks(ox, oy, u, cx, cy - G.cdy, G.crx, G.cry, MAC, "#E2DBC6", -1);
    pxMarks(ox, oy, u, cx, cy - G.cdy, G.crx, G.cry, MACD, "#9C9584", -1);
    pxMarks(ox, oy, u, cx, cy - G.cdy, G.crx, G.cry, MAC2, "#FDFBF4", -1);
    pxMarks(ox, oy, u, cx, cy - G.cdy, G.crx, G.cry, FRIES, "#A55E2C", 1);
    pxMarks(ox, oy, u, cx - G.kdx, cy - G.kdy, G.krx, G.kry, MAC, "#E2DBC6");
    pxMarks(ox, oy, u, cx - G.kdx, cy - G.kdy, G.krx, G.kry, MAC2, "#FDFBF4");
    pxMarks(ox, oy, u, cx + G.kdx, cy - G.kdy, G.krx, G.kry, FRIES, "#A55E2C");

    // MEAT HOT SAUCE, LADLED OVER THE SEAM AND OVER BOTH HALVES, because that is
    // the layer that makes a Garbage Plate one dish instead of two sides. It is
    // the warm mid brown plateTile settled on rather than the near black it
    // started as: a truly dark mass reads as a hole punched in the plate. Then
    // it runs off the dome onto the skirt, which is four rectangles and is most
    // of what says this was poured rather than arranged.
    pxOval(ox, oy, u, cx, cy - G.sdy, G.srx, G.sry, "#71401D");
    // A clean ellipse of sauce is a lens sitting on the food. Six lobes around
    // its edge and it is a ladleful that landed where it landed.
    for (d = 0; d < SAUCE.length; d++) {
      pxOval(ox, oy, u,
        cx + Math.round(SAUCE[d][0] * G.srx),
        cy - G.sdy + Math.round(SAUCE[d][1] * G.sry),
        Math.max(2, Math.round(SAUCE[d][2] * G.srx)),
        Math.max(2, Math.round(SAUCE[d][2] * G.srx * 0.62)), "#71401D");
    }
    ctx.fillStyle = "#71401D";
    for (d = 0; d < DRIPS.length; d++) {
      dy = Math.round(DRIPS[d][1] * G.sry);
      hw = ovalHalf(dy, G.srx, G.sry);
      if (!hw) continue;
      dx = Math.round(DRIPS[d][0] * G.srx);
      if (dx < -hw || dx > hw) continue;
      ctx.fillRect(
        ox + (cx + dx) * u, oy + (cy - G.sdy + dy) * u,
        Math.max(1, Math.round(DRIPS[d][2] * G.srx)) * u,
        Math.max(2, Math.round(G.sry * 1.45)) * u
      );
    }
    pxMarks(ox, oy, u, cx, cy - G.sdy, G.srx, G.sry, CHUNK, "#A55E2C");

    // MUSTARD AND RAW ONION. THESE TWO ARE WHY IT IS FOOD, which is plateTile's
    // own sentence and it is just as true at this size: they are the only bright
    // marks on a pile of browns and creams, and without them the middle of the
    // dish is one shape.
    pxMarks(ox, oy, u, cx, cy - G.sdy, G.srx, G.sry, MUSTARD, "#F2C734");
    pxMarks(ox, oy, u, cx, cy - G.sdy, G.srx, G.sry, ONION, "#FDFBF4");
  }

  // THE PILE SQUEEZES OUT AROUND HIM, and this is the part that stops the whole
  // thing reading as a sprite parked in front of a drawing of dinner. It runs
  // AFTER the mascot: eight small lobes of food drawn back OVER his bottom edge,
  // macaroni under his left, home fries under his right and sauce under the
  // middle, each sitting on its own row so the contact line is not flat. Overlap
  // is what sells weight, and a straight bar of it read as a shelf, which is
  // what the version before this one drew.
  function plateSpill(ox, oy, u, G, halfCells) {
    var cx = G.rx, lr = Math.max(2, Math.round(halfCells * 0.17));
    halfCells = Math.min(halfCells, G.crx);
    for (var i = 0; i < SPILL.length; i++) {
      var lx = cx + Math.round(SPILL[i][0] * halfCells);
      var ly = G.seat + SPILL[i][1];
      var col = SPILL[i][0] < -0.28 ? "#F0E5BE"
        : SPILL[i][0] > 0.28 ? "#D3A15C" : "#71401D";
      pxOval(ox, oy, u, lx, ly, lr, Math.max(2, Math.round(lr * 0.62)), col);
    }
  }

  // HE HAS TO CAST ONE OR HE IS NOT STANDING ON ANYTHING. Drawn after the food
  // and before the mascot, so it is a shadow ON the dinner rather than a mark on
  // top of him. It is an OVAL and not a bar: a full width bar of shadow under
  // him read as a shelf he was standing behind, which is how the version before
  // this one failed.
  function plateShade(ox, oy, u, G, halfCells) {
    ctx.fillStyle = "rgba(0,0,0,.30)";
    var rx = Math.max(3, Math.round(Math.min(halfCells, G.crx) * 0.96));
    var ry = Math.max(2, Math.round(rx * 0.20));
    for (var dy = -ry; dy <= ry; dy++) {
      var hw = ovalHalf(dy, rx, ry);
      if (!hw) continue;
      ctx.fillRect(ox + (G.rx - hw) * u, oy + (G.seat + dy) * u, hw * 2 * u, u);
    }
  }

  function pad5(n) {
    var s = String(n);
    while (s.length < 5) s = "0" + s;
    return s;
  }

  // TAP ON A PHONE, PRESS START ON A KEYBOARD. Read off the pointer rather than
  // off the width, because a touch laptop at 1440 is still a tap and a 400px
  // desktop window is still a keyboard.
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var PROMPT = coarse ? "TAP TO START" : "PRESS START";

  function drawTitle() {
    var pw = cv.width, ph = cv.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // THE SCRIM IS A GRADIENT AND NOT A FLAT WASH, and that is the difference
    // between a title screen and a black rectangle with type on it. Flat at the
    // opacity the logo needs, downtown vanished completely and the bottom third
    // of the screen was dead space; flat at the opacity downtown needs, the
    // logo sat in a haze. Heavy at the top where the lettering is, thin at the
    // bottom where the skyline and High Falls are, so the game's own city is
    // the art on its own title screen.
    var sg = ctx.createLinearGradient(0, 0, 0, ph);
    // The stops are the SKYLINE'S OWN GEOMETRY and not a taste: downtown's
    // tallest roof sits about two thirds of the way down the board and its base
    // is at the street, so the scrim is flat and heavy over the top 55 per cent,
    // where the lettering is, and has fallen to a fifth by the time it reaches
    // the buildings. Measured against a running game at 390x844: the skyline
    // under this reads at the same weight it does mid-run.
    sg.addColorStop(0, C.titleScrim);
    sg.addColorStop(0.55, C.titleScrim);
    sg.addColorStop(0.92, C.titleScrimLow);
    sg.addColorStop(1, C.titleScrimLow);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, pw, ph);

    var u = Math.max(2, Math.round(pw / 190));
    var U = Math.max(u + 2, Math.floor(pw * 0.78 / (7 * GADV - 1)));
    var m = Math.max(u + 1, Math.round(u * 1.6));
    var f = Math.max(1, u - 1);
    var mk = Math.max(2, Math.round(ph * 0.17 / 32));
    var mW = 32 * mk, mH = MASC_H * mk;
    var cx = Math.round(pw / 2);

    // THE STATUS ROW AT THE TOP AND THE LICENSE LINE AT THE BOTTOM ARE THE TWO
    // CONVENTIONS THAT DATE A SCREEN. Neither is decoration: the top row is the
    // number the player is here to beat, shown the way the machine would show
    // it, and the bottom line is the honest one this site has to carry anyway.
    var topY = Math.round(ph * 0.045);
    var hs = "HI-SCORE", hv = pad5(best);
    var hx = Math.round(cx - textW(hs + " " + hv, u) / 2);
    pxAt(hs, hx, topY, u, C.titleDim);
    pxAt(hv, hx + (hs.length + 1) * GADV * u, topY, u, C.ink);

    var footY = ph - Math.round(ph * 0.045) - GH * f;
    pxMid("FAN GAME - NOT AFFILIATED", cx, footY, f, C.titleDim);

    // The center block, measured then centered in what the two pinned rows left.
    var blockH = (GH + 1) * U + 2 * U + (GH + 1) * U + 6 * u + mH + 6 * u +
      GH * u + 3 * u + GH * u + 10 * u + GH * m;
    var lo = topY + GH * u + Math.round(ph * 0.04);
    var hi = footY - Math.round(ph * 0.035);

    // THE PLATE IS SIZED LAST, OUT OF WHAT IS LEFT, AND THAT IS THE FOLD RULE
    // RATHER THAN A DETAIL. Tim asked for a BIG plate, so it wants to be half
    // again the mascot's width, which is what makes him look sat on it instead
    // of standing behind a saucer. But only the part of the dish BELOW his seat
    // costs the layout anything, and on a short screen there may not be room for
    // all of it, so the loop below shrinks the plate two cells at a time until
    // what hangs below him fits the gap the two pinned rows left AND the whole
    // dish fits the width. A smaller dinner is a fair trade; PRESS START falling
    // off the bottom of the screen is not.
    var G = plateGeom(Math.max(20, Math.round(mW * 2.1 / u)));
    while (G.w > 20 &&
      ((G.h - G.seat) * u > hi - lo - blockH || (G.w + 2) * u > pw)) {
      G = plateGeom(G.w - 2);
    }
    blockH += (G.h - G.seat) * u;
    var y = Math.max(lo, lo + Math.round((hi - lo - blockH) / 2));

    pxLogo("GARBAGE", cx, y, U, C.ink);
    y += (GH + 1) * U + 2 * U;
    pxLogo("RUN", cx, y, U, C.titlePink);
    y += (GH + 1) * U + 6 * u;

    // PLATE, THEN MASCOT, THEN THE FOOD THAT SPILLS BACK OVER HIM. The order is
    // the whole illusion: drawn under him the dish is a dish he is standing on,
    // and the last two rows of base coming back over his bottom edge are what
    // make it a dish he is sitting IN.
    var px0 = Math.round(cx - (G.w * u) / 2);
    var py0 = y + mH - G.seat * u;
    platePx(px0, py0, u, G);
    plateShade(px0, py0, u, G, Math.round(mW / (2 * u)));
    var mt = mascot();
    if (mt) ctx.drawImage(mt, Math.round(cx - mW / 2), y, mW, mH);
    plateSpill(px0, py0, u, G, Math.round(mW / (2 * u)));
    y = py0 + G.h * u + 6 * u;

    pxMid("ROCHESTER, NY", cx, y, u, C.titleBlue);
    y += GH * u + 3 * u;
    pxMid("GARBAGE RIPS 585", cx, y, u, C.titleDim);
    y += GH * u + 10 * u;

    // UNDER prefers-reduced-motion THE PROMPT IS SIMPLY ON. blinkOn is pinned
    // true and no timer is ever started, so this screen has zero animating
    // elements under reduce, which is the rule the rest of the site keeps. The
    // words still say what to do, which is the part that was load bearing.
    if (blinkOn) pxMid(PROMPT, cx, y, m, C.ink);

    // SCANLINES, STATIC, AT THE DEVICE'S OWN PITCH. A dark line every other
    // pixel row of the title's own grid. It is the cheapest thing on this
    // screen that says CRT, it never moves, and it is drawn last so it lies
    // over the mascot and the type the way a shadow mask would.
    ctx.fillStyle = "rgba(0,0,0,.3)";
    var lh = Math.max(1, Math.round(u / 2));
    for (var sy = 0; sy < ph; sy += u * 2) ctx.fillRect(0, sy, pw, lh);

    ctx.restore();
  }

  // ---- ATTRACT MODE, AND WHAT PAINTS WHILE NOTHING IS RUNNING -------------
  // paint() is what every idle repaint goes through: the board is drawn, and if
  // the title is up the screen goes over it. fit() and reset() both call it, so
  // a resize, a rotation and a late font all keep the title screen rather than
  // wiping it back to a bare street.
  var titleUp = false, blinkOn = true, blinkT = 0;
  function paint() {
    draw();
    if (titleUp) drawTitle();
  }
  function stopBlink() {
    if (blinkT) { clearInterval(blinkT); blinkT = 0; }
  }
  function showTitle() {
    titleUp = true;
    blinkOn = true;
    elOver.classList.add("gr-attract");
    stopBlink();
    // 520ms on, 520ms off. Nothing else on the screen moves, so this is one
    // repaint of a static picture just under twice a second, and the picture is
    // the pre-rendered skyline tiles plus about 900 fillRects.
    //
    // THERE IS NO document.hidden GUARD IN HERE AND THAT IS DELIBERATE. One was
    // written, to save the repaint while the tab is in the background, and it
    // leaves the prompt STUCK IN WHATEVER PHASE IT WAS IN: come back to the tab
    // on an off beat and the title screen has no "press start" on it at all,
    // which is a screen that looks broken to save a paint the browser was
    // already throttling to once a second. The toggle is unconditional and the
    // phase is always recoverable.
    if (!calm) {
      blinkT = setInterval(function () {
        if (!titleUp) return;
        blinkOn = !blinkOn;
        paint();
      }, 520);
    }
    paint();
  }
  function hideTitle() {
    if (!titleUp) return;
    titleUp = false;
    stopBlink();
    elOver.classList.remove("gr-attract");
  }
  // THE SPRITE MAY LAND AFTER THE FIRST PAINT and a title screen with a hole in
  // it where the mascot goes is worse than one without a mascot. The screen is
  // repainted the moment the file decodes, which under reduce is the only
  // repaint this screen ever gets.
  SP_TRUB.img.addEventListener("load", function () { if (titleUp) paint(); });

  function tick() {
    if (!running) return;
    frameN += 1;
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
      dist += speed;
      if (speed < SPEED_MAX) speed = Math.min(SPEED_MAX, speed + (calm ? 0.00025 : 0.00045));
      for (var i = 0; i < lanes.length; i++) step(lanes[i]);
    }
    draw();

    if (!L0.alive && L0.hit <= 0) return end();
    elScore.textContent = String(L0.score);
    raf = requestAnimationFrame(tick);
  }

  // THE PANEL WAS THROWN AWAY BY THE TAP YOU WERE ALREADY MAKING, and this is
  // the same bug as "the death happened off screen" one step further along. That
  // one was fixed by holding the world for 34 frames so you can see what hit
  // you. Then the panel comes up, and the panel is the half that tells you the
  // score, whether it is a new best, and how much more you needed to evolve.
  //
  // A player of this game is tapping continuously: measured over 120 runs of the
  // human-latency bot, 4.2 to 4.4 taps a second, so the next tap is 236ms away
  // on average and never more than 236ms away. Driven on the real page with a
  // steady 4.3 taps a second, ten seeds, the panel was visible for a MEDIAN OF
  // 10 FRAMES, 167ms, before that tap restarted the run: 67ms at the worst seed
  // and 200ms at the best. Nobody reads a score in 167ms, so every death looked
  // like the game simply starting again.
  //
  // 500ms is chosen against that 236ms cadence: it swallows at most two taps, so
  // a player who wanted to go again presses once more and it works, and it is
  // under the delay at which a person decides a control is broken. It gates the
  // BUTTON too, on purpose. The button is centred in the play area, which is
  // exactly where a thumb that is mid-rhythm lands, so leaving it live would
  // leave the commonest accidental restart in place.
  //
  // Nothing here can move the game: it draws no random numbers and runs no world
  // step, and every bot run below is byte-identical before and after.
  var GO_LOCK = 500;
  var overAt = -1e9;
  function nowMs() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }
  function goReady() { return nowMs() - overAt >= GO_LOCK; }

  function end() {
    running = false;
    hideTitle();
    cancelAnimationFrame(raf);
    overAt = nowMs();
    var sc = lanes[0].score;
    // bank() may already have stored this score mid-run, so "is it a new best"
    // is asked against what the run started with rather than against best.
    // THE PANEL CARRIES role="status" AND IT IS THE ONLY THING ON THIS PAGE A
    // SCREEN READER CAN LEARN A RESULT FROM. A canvas announces nothing: its
    // aria-label describes the SCENE, Trubbish and the skyline, and cannot
    // describe a run. Every line below writes its text BEFORE end() unhides the
    // panel, so the score, the cause of death and whether it beat the best go
    // out as one polite update instead of being painted silently over a picture
    // the reader cannot see. Keep that order if you add a line here.
    //
    // NAME THE THING THAT KILLED YOU. The panel said "A wild Pokemon got you"
    // over a picture of a Koffing for as long as this game has existed, and the
    // game has always known which one: the killer is stored on the lane at the
    // moment of the hit, and its foe id is the same id that picked the sprite.
    // A player who cannot say what got them cannot decide to play differently,
    // which is the whole job of a game over screen.
    var killer = lanes[0].killer;
    var foe = (killer && FOE_NAMES[killer.foe]) || "Pokemon";
    var newBest = sc > startBest;
    elTitle.textContent = newBest ? "New best" : "A wild " + foe + " got you";
    bank(sc);
    elBest.textContent = "Best " + best;
    // THE OLD MESSAGE DID THE EVOLUTION ARITHMETIC AT EVERY SCORE, so the first
    // thing a first-timer ever read was "0 pieces of trash eaten. 100 more and
    // you would have evolved." That is true, and telling somebody who has just
    // scored nothing that they were a hundred short is the opposite of the
    // "no gatekeeping" this site is built on. The near-miss line is worth
    // printing when it IS a near miss, so it is held back until half way.
    var parts = [];
    parts.push(sc === 0 ? "Not one piece of trash."
      : sc + " piece" + (sc === 1 ? "" : "s") + " of trash eaten.");
    // The title only carries the cause when it is not a new best, so a run that
    // set one still gets told what ended it.
    if (newBest && killer) parts.push("A wild " + foe + " got you in the end.");
    if (lanes[0].evolved) parts.push("You made it to Garbodor.");
    else if (sc >= EVOLVE_AT / 2) parts.push((EVOLVE_AT - sc) + " more and you would have evolved.");
    else if (sc === 0) parts.push("Tap to flip. The trash comes to you.");
    elMsg.textContent = parts.join(" ");
    elStart.textContent = "Go again";
    elOver.hidden = false;
  }

  var countIn = 0, acc = 0, last = 0;
  function start() {
    // BEFORE THE OVERLAY GOES, NOT AFTER. elOver holds the Start button, and
    // hiding the element that contains the focused button hands focus to
    // <body>, which is now the state in which the game hears no keys at all.
    // A keyboard player would have pressed Start and then found space dead.
    takeKeys();
    paused = false;
    startBest = best;
    hideTitle();
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
  // TAKING THE KEYS IS AN ACT, AND THIS IS THE ONE PLACE IT HAPPENS. Every way
  // into the game routes through here: the board is tapped, Start is clicked,
  // or a key that already belonged to the game started a run. See the long note
  // on the keydown handler for why holding focus is the whole entitlement.
  //
  // preventDefault() on the pointerdown above is what makes this NECESSARY
  // rather than tidy: cancelling that event also cancels the focus the browser
  // would have moved here itself, so without this line a tap plays the game
  // with focus still on <body> and the keys stay dead. And hiding the overlay
  // in start() drops focus off the Start button onto <body>, which is the same
  // hole arriving from the other side.
  function takeKeys() {
    try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); }
  }
  stage.addEventListener("pointerdown", function (e) {
    // Let the actual button behave like a button.
    if (e.target && e.target.closest && e.target.closest("button")) return;
    e.preventDefault();
    takeKeys();
    if (running) flip(0);
    else if (paused) resume();
    else if (!elOver.hidden && goReady()) start();
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
    // THE KEYS BELONG TO THE GAME ONLY WHILE IT HAS FOCUS, AND THE LINE BELOW
    // IS THE WHOLE OF THAT. WCAG 2.1.4 wants a single-key shortcut turned off,
    // remapped, OR scoped to focus, and this file took the fourth option, which
    // is not on the list: it took the keys page-wide and preventDefault()ed
    // them in every reachable state.
    //
    // MEASURED BEFORE THE GATE, at 1280x844, fresh load, focus on <body>,
    // scrolled to y=1200 with the board entirely off screen on a 2,211px page:
    // space, up, down, W and S each left scrollY at exactly 1200 and dismissed
    // the attract overlay, so a reader who had never touched the game scrolled
    // nowhere and started a run they could not see. Only PageDown moved the
    // page. The comment two paragraphs down worried about a space bar pressed
    // in the lock window and took the reader's five scroll keys with it.
    //
    // FOCUS, NOT VISIBILITY, AND THAT IS A CHOICE RATHER THAN THE EASY HALF. An
    // IntersectionObserver on the stage would also let the keys work for
    // somebody who has scrolled the board into view without touching it, and it
    // was rejected: the reader who has just scrolled the game onto the screen
    // is, by definition, mid-scroll, and space is how they were doing it. That
    // is the reported bug again, moved 1,200px down the page and made harder to
    // find. Seeing a thing is not asking for it. Every real way to ask now
    // hands focus to the stage: tapping the board, pressing Start, or tabbing
    // to Start and pressing it. takeKeys() is that, in one place.
    //
    // stage.contains() rather than an identity test, because the Start button
    // lives INSIDE the stage: a keyboard player who has tabbed to Start has the
    // game's focus and must be able to press space to begin.
    if (!stage.contains(document.activeElement)) return;
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
      // The key is swallowed either way, so a space bar pressed in the lock
      // window still cannot throw the page down a screen. That now costs the
      // page nothing, because we only get here with focus inside the stage:
      // this is a control the reader is standing on eating its own key, which
      // is what a button does.
      else if (!elOver.hidden) { e.preventDefault(); if (goReady()) start(); }
    }
  });

  elStart.addEventListener("click", function () {
    if (paused) resume();
    else if (goReady()) start();
  });

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
    // Same reason as in start(): the Resume button is inside the overlay this
    // line is about to hide, and losing focus to <body> here would leave the
    // run going with the keys dead.
    takeKeys();
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

  // THE BOARD MUST NOT CHANGE SIZE WHILE SOMEBODY IS LOOKING AT IT, AND IT DID.
  // Tim, on his own phone: "when you load it on mobile its got a short play
  // area, then when you scroll down it makes the play area larger, kind of
  // strange". Both halves of that were true and they had two separate causes,
  // which is why the board grew by more than either one alone would explain.
  //
  // CAUSE ONE, THE URL BAR. This read window.visualViewport.height, which is the
  // DYNAMIC viewport: the browser's bar is showing when the page loads and
  // retracts on the first scroll, so that number GROWS mid-session and anything
  // sized from it grows with it. Reproduced at 390x844 with a bar costing 101px:
  // the canvas is 279x452 with the bar showing and 342x553 without it, a 22 per
  // cent jump arriving in the middle of a run.
  //
  // CAUSE TWO WAS THE SUBTLER OF THE PAIR. The budget subtracted
  // getBoundingClientRect().top, which is the board's distance from the top of
  // the VIEWPORT and therefore falls by one pixel for every pixel scrolled: at
  // 390x844 the board reports 276.5 at rest and -123.5 four hundred pixels down,
  // so the same function asked the same question twice answers 400px apart.
  // Nothing calls fit() on scroll, which is the only reason this never showed on
  // a desktop. On a phone the bar retraction fires the resize FOR you, and it
  // fires it WHILE SCROLLED, so the two faults compounded into one jump.
  //
  // THE FIX IS TO ASK ONLY QUESTIONS WHOSE ANSWERS CANNOT MOVE.
  //   - svh, the SMALL viewport, is by definition the viewport with the
  //     browser's bars SHOWN, and the spec says it does not change when they
  //     retract. So the budget is the room the reader has at load, and the
  //     retraction hands the game free space it deliberately declines to spend.
  //     lvh would be the opposite mistake: correct after a scroll and too tall
  //     on arrival, which is a game hanging off the bottom of the screen.
  //   - the board's top is taken in DOCUMENT space, rect.top plus scrollY, which
  //     is where the board sits on the PAGE rather than on the SCREEN. Scrolling
  //     cannot change it.
  // Nothing in here reads visualViewport, innerHeight, dvh or vh any more.
  // Reintroducing one brings the bug back, and brings it back on a phone only,
  // which is the hardest place on this project to see it.
  //
  // 100svh IS READ FROM A PROBE RATHER THAN COMPUTED, because there is no other
  // way to get the number. A custom property holding 100svh comes back out of
  // getComputedStyle as the string "100svh": an unregistered custom property is
  // untyped, so nothing resolves the unit until a box is laid out in it. The
  // probe is fixed, zero wide and hidden, so it is out of flow and cannot
  // lengthen the document or take a tap.
  // A BROWSER WITH NO svh DROPS THE DECLARATION and the div keeps height:auto,
  // which on an empty fixed box measures 0. That zero is the fallback signal,
  // and the fallback is documentElement.clientHeight, the LAYOUT viewport, which
  // is the most stable height an older browser has to offer.
  var probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100svh;" +
    "visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  function smallVH() {
    return probe.offsetHeight || document.documentElement.clientHeight;
  }

  function fit() {
    var r = board.getBoundingClientRect();
    var wide = wideQ ? wideQ.matches : false;
    var vh = smallVH();
    // THE 680 CAP IS GONE ON A BIG SCREEN and it was the reason a 1920x1080
    // desktop and an iPhone SE got a board the same size. It was there to stop a
    // very tall column on a desktop, which the aspect ratio already prevents:
    // the board can only be as tall as it is wide times 1.62, and the width is
    // capped by the column. What it actually did was pin the board to its
    // drawing surface, so the extra 400px of a laptop window went unused.
    var cap = wide ? 1100 : 680;
    // DOCUMENT SPACE, not viewport space. See the note above fit(): r.top alone
    // is what made the board grow as the reader scrolled.
    var top = r.top + (window.scrollY || window.pageYOffset || 0);
    var availH = Math.max(260, Math.min(vh - top - 14, cap));
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
    // The skyline and the plate are pre-rendered at the device's own pixels, so
    // they are rebuilt here and only here, for the same reason the transform is.
    buildTiles(cv.width / W);
    paint();
  }
  // A REAL RESIZE STILL RE-FITS: a rotation, or a desktop window dragged wider,
  // genuinely changes how much room the game has and the board should follow.
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  // THE visualViewport RESIZE LISTENER IS GONE ON PURPOSE. That is the event the
  // URL bar retraction and the on-screen keyboard fire, and reacting to either
  // is precisely the bug this block is about. fit() is idempotent now, so the
  // listener would be harmless rather than wrong, but a subscription to the one
  // signal the board must ignore is a standing invitation to start reading it
  // again. There is no text input on this page, so no keyboard should ever open;
  // if one does, the board does not move.
  // ONE REFIT AFTER THE FONTS SETTLE, and it is a no-op on this site rather than
  // a second resize the reader sees. Titan One and Outfit are self hosted and
  // preloaded ahead of a render-blocking stylesheet, so the heading is already
  // at its final height when this script runs and the key below is unchanged.
  // It is here for the case where that stops being true: a heading that grows
  // after paint moves the board down, and a board that never re-measures would
  // sit off the bottom of the screen for the rest of the session.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();

  reset();
  // THE ATTRACT SCREEN IS THE LAST THING SET UP, after the board has a size and
  // the street has been primed, so the first thing painted is the finished
  // picture rather than a title over an empty canvas.
  showTitle();
})();
`;

// NO " | Garbage Rips 585" IN <title>, for the reason CLAUDE.md records under
// "Page titles carry no suffix". Measured in headless Chrome, canvas
// measureText at 20px Arial, which is what Google's desktop result draws:
// with the suffix 675.6px against the ~580px cut, without it 497.0px.
// CLAUDE.md keeps the suffix on "most game pages" because it renders in full
// there. On this one it does not, which is the condition that sentence names.
// The suffix is 178.6px and it was never being drawn, so it cost the tail of
// the title it sat behind and returned nothing. og:site_name carries the brand
// beside the result, and og:title below has always been the bare title, so
// dropping it also stops <title> and og:title disagreeing.
const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Garbage Run: a One Thumb Game for the Restock Line</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/games/garbage-run.html">
<meta property="og:title" content="Garbage Run">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/games/garbage-run.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${miniCSS(style)}</style>
<noscript><style>.gr-hud,.gr-board{display:none}</style></noscript>
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
          ${/* THE BIG NUMBER NEEDED A NAME HERE TOO. This shipped as a bare 28px
               "0" beside "BEST 0" with no visible label and no accessible name.
               Chase Match's identical numeral was labelled today and the note
               there excused this one -- "everybody knows what a score is" -- and
               that note has been corrected, because the excuse does not survive
               the game's own wording. What this counts is not an abstract
               score: it is PIECES OF TRASH, the game over panel says "N pieces
               of trash eaten", the hub blurb says "A hundred pieces of trash and
               he evolves", and EVOLVE_AT is read against this exact number. So
               the label is "trash", which is the word the rest of the page uses,
               rather than "score", which would name it no better than the bare
               numeral did. .gr-stat is .gr-best's declaration under a name that
               is not a lie about what it holds. */ ""}
          <div class="gr-stat">trash</div>
          <div class="gr-best" id="grBest">Best 0</div>
        </div>

        <div class="gr-board" id="grBoard">
          ${/* tabindex="-1" AND NOT 0, AND THE DIFFERENCE IS THE WHOLE FIX.
               The stage has to be able to HOLD focus, because the keydown
               handler below only acts while it does; it does not need to be a
               TAB STOP, because the Start button sitting inside it already is
               one and that button is how a keyboard player gets in. A second
               tab stop on a generic div with no accessible name would announce
               nothing and would sit in the tab order of every reader who is
               only passing through on their way to the copy below. -1 is
               focusable and never tabbed to, which is exactly the pair of
               properties this wants. */ ""}
          <div class="gr-stage" id="grStage" tabindex="-1">
            <canvas id="grCanvas" width="420" height="680" role="img"
              aria-label="Garbage Run. Trubbish runs through downtown Rochester, past the Times Square building, the Xerox tower and High Falls, and you tap to flip him between the floor and the ceiling."></canvas>
            <div class="gr-over gr-attract" id="grOver" role="status">
              <h2 id="grTitle">Garbage Run</h2>
              <p id="grMsg">Tap the screen, or press space, to flip. Eat the trash, dodge the Pokemon.</p>
              <button class="gr-go" id="grStart" type="button">Start</button>
            </div>
          </div>
        </div>

        <noscript><p class="lede gr-lede">Garbage Run needs JavaScript, and yours is turned off, so there is no game on
          this page right now. Everything below still says how it works, and the rest of the site reads fine without
          it.</p></noscript>

        <p class="lede gr-lede">One thumb, no rules to read. Tap to flip Trubbish between the floor and the ceiling and
          eat everything on the street, Garbage Plates included. A hundred pieces of trash and he evolves.</p>

        <div class="gr-how">
          ${/* "ONCE THE BOARD HAS YOUR FOCUS" IS NOT PADDING, it is the one
               sentence that stops the fix above reading as a broken game. The
               keys only work while the stage holds focus, so a reader who takes
               this line at its word from the bottom of the page, having never
               touched the board, would press space and get a screen of scroll
               instead. Tapping the board or pressing Start is what hands the
               keys over, and both are named here in the order a hand finds
               them. */ ""}
          <p><b>How it works.</b> Tap anywhere, or press Start and then use <span class="gr-keys">space</span>,
          <span class="gr-keys">W</span> or the <span class="gr-keys">arrow keys</span>, which flip Trubbish once the
          board has your focus. Every piece of trash you eat is a point. Other Pokemon are out there too and
          touching one ends the run. Get to ${EVOLVE_AT} and Trubbish evolves into Garbodor for the rest of the game.<br>
          <b>Some of the trash is a Garbage Plate</b>, because of course it is. Home fries, macaroni salad, hot sauce,
          mustard and onion, exactly like Nick Tahou would hand you at two in the morning. A plate is worth the same one
          point as everything else on the street. It just tastes better.<br>
          <b>That is downtown Rochester behind him.</b> The Times Square building and its four wings, the Xerox tower,
          Kodak, the grain silos, and High Falls with the Pont de Rennes over the top of it. It is drawn on the canvas
          like everything else here, and it is kept dim on purpose so the things that can kill you stay the brightest
          objects on the screen.<br>
          <b>Nothing is saved anywhere but your own phone</b>, and there is no account and no server. Your best
          score lives in this browser and goes away if you clear it.</p>

          <!-- THE ONLY PICTURE ON THIS PAGE, and it is deliberately not a
               screenshot. A screenshot of Garbage Run, sitting directly above
               Garbage Run, playable, is the least useful image this site could
               carry: the reader can look at the real one, moving, for free. The
               hub is where a shot of this game earns its place, because there
               the game is not on the screen.
               What this shows instead is the thing the sentence above names and
               cannot show: the score you are playing towards buys you a
               different Trubbish, and until you get there you have never seen
               him. Both files are the sprites the canvas itself draws, so the
               picture cannot describe a game that has moved on without it. -->
          <figure class="gr-evo">
            <img src="/assets/trubbish.webp" width="512" height="512" alt="Trubbish, the sprite the game starts you as"
              loading="lazy" decoding="async">
            <span class="gr-evo-at">${EVOLVE_AT}</span>
            <img src="/assets/garbodor.webp" width="512" height="512" alt="Garbodor, what Trubbish becomes"
              loading="lazy" decoding="async">
            <figcaption>What ${EVOLVE_AT} pieces of trash buys you. Both are the sprites the game draws on the
              canvas, and the Trubbish is the same file the 404 page uses.</figcaption>
          </figure>
        </div>

        <p class="gr-how gr-other"><a href="/games/">The other games</a> are quicker: a memory board dealt from the
          hundred most valuable cards in Pokemon, a set guesser, a silhouette round and a trivia run. This one is for a
          longer wait.</p>
      </div>
    </div>
  </section>
</main>
${footer()}
<script>${miniJS(GAME_JS)}</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/games/garbage-run.html"), page);
console.log("Wrote public/games/garbage-run.html");
