#!/usr/bin/env node
// Screenshot the four browser games, for the cards on /games/.
//
//   node .claude/server.js                    (in another shell, port 4585)
//   node scripts/sync-game-shots.mjs          capture anything not held yet
//   node scripts/sync-game-shots.mjs --force  recapture all of them
//
// WHY THIS EXISTS. /games/index.html was the last page on the site that
// check-build.py named outright: 305 words and nothing visual in <main>, and
// the `games` section sitting at 0.0 in the image-density table. Every other
// page here illustrates itself with a card scan, a set logo or a drawn figure,
// and the hub had nothing to borrow: the four games are <canvas> and live DOM,
// so there is no artwork file anywhere in the tree that is a picture of them.
// The honest picture of a game you can play in a browser is a picture of it
// being played, so this drives the real pages and takes one.
//
// THESE ARE OUR OWN PAGES, which is the whole reason this is allowed to exist
// where sync-app-shots.mjs had to argue itself into being. Nothing here is
// somebody else's screenshot. The only third-party pixels inside a shot are the
// ones those pages already publish and already credit on the page itself:
// PokeAPI's official artwork (silhouetted) and a TCGdex card scan.
//
// DETERMINISTIC ON PURPOSE. Every one of these games picks its question with
// Math.random, so a plain recapture would produce a different Pokemon, a
// different card and a different question every run, and rewrite four binaries
// for no reason. A seeded mulberry32 is installed over Math.random BEFORE any
// page script runs, so --force is reproducible and a re-run leaves the tree
// clean unless the game itself changed. Same reasoning as the seeded generator
// in build-games.mjs.
//
// THE ALT TEXT DESCRIBES THE SHAPE, NOT THE CONTENTS, and that is deliberate
// rather than lazy. "A Ninetales silhouette" would be true of today's file and
// false the first time somebody bumps SEED or the game's own pool changes, and
// a caption that only stays true by luck is the failure mode this site's image
// rule exists to stop. What does not change is that the screen is a picture
// above four answer buttons, so that is what the alt says. What each shot must
// CONTAIN is asserted below instead, which is checkable: four choice buttons, a
// stage with a decoded image in it, a canvas with something drawn on it.
//
// SIZE. The thumbnail column on the hub is min(46%, 190px), so 190px is the
// widest box any of these is ever painted into, at any viewport. The mirrored
// file is 380 wide, 2x that, and the height follows the shot. Captured at DPR 2
// on a 390px viewport and downsampled, rather than captured at the target size,
// because rasterising this text at a fractional scale is visibly soft.
//
// THIS WAS 624 FIRST, sized for a full-width thumbnail that the hub tried and
// dropped, and the card scan in the Guess the Set shot alone was 48KB of a
// 90KB page for a picture drawn at 143px on a phone. If the hub's layout moves,
// move SHOT_W with it and recapture: nothing checks this for you.
//
// IF THE GAMES CHANGE, RERUN IT. That is the standing cost of a screenshot and
// there is no way round it. check-build.py cannot tell a stale screenshot from
// a fresh one, so this is not in build-all.mjs: it needs a running server and a
// browser, and a builder that silently needs Chrome is worse than a manual step
// somebody has to remember.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { localDay } from "../shared/today.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "assets", "games");
const MANIFEST = join(ROOT, "data", "game-shots.json");
const ORIGIN = process.env.GRIPS_ORIGIN || "http://localhost:4585";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FORCE = process.argv.includes("--force");

/** 2x the widest box the thumbnail is ever painted into. See SIZE above. */
const SHOT_W = 380;
/** The viewport the shots are taken on: the phone this site is built for first. */
const VIEW = { w: 390, h: 950, dpr: 2 };
/** Bump to reroll every question. Any recapture at the same seed is identical. */
const SEED = 5850;

// ---------------------------------------------------------------------------
// What to shoot.
//
// `shows` is written after opening the file, and it is what the page's alt text
// says. `assert` is the structural check that has to pass before a shot is
// kept: it is the part a later reader can trust without looking at the picture.
// ---------------------------------------------------------------------------
const SHOTS = [
  {
    key: "garbage-run",
    page: "/games/garbage-run.html",
    file: "garbage-run-screenshot.webp",
    // The canvas alone. Everything outside it is site chrome, and the score
    // readout above it is the page, not the game.
    clip: ".gr-stage",
    // THIS ONE BROKE THE RULE THE HEADER OF THIS FILE SETS OUT, and the
    // recapture on 17 August 2026 proved it. It read "Trubbish MID-AIR on a
    // dark street, a curve of trash ahead of him, ANOTHER POKEMON PERCHED ON
    // THE EDGE OF THE LANE", and the new capture has Trubbish on the floor with
    // no second Pokemon anywhere on screen. Both of those were true of one
    // frame of one run and neither survives a rerun, which is exactly the drift
    // the three quiz shots below are written to avoid.
    //
    // It is the hardest of the four to describe honestly, because unlike them it
    // has no fixed furniture: the assert guarantees the run is ALIVE and the
    // score is at least 8, and that is all that is guaranteed. So the alt says
    // only that, plus the two things the canvas always draws.
    shows:
      "Garbage Run part way through a run: Trubbish on a dark street with trash laid out ahead of him, the score in the corner and the count of what is left before he evolves",
    assert: `(function(){if(!document.getElementById('grOver').hasAttribute('hidden'))return 'the run ended';` +
      `var s=+document.getElementById('grScore').textContent;` +
      `return s>=${8}?'':('score only reached '+s);})()`,
    // A SCREENSHOT OF THE TITLE CARD WOULD HAVE BEEN A LIE BY OMISSION, so this
    // one plays the game. Starting it and waiting is not enough: Trubbish parks
    // on the floor when nobody taps, trash only ever spawns in the middle
    // band, and the first attempt at this produced a black rectangle with a
    // score of 0. So an autopilot taps on a fixed 180ms cadence, which is the
    // "hold the midline" bot the game's own comments describe, and it is timed
    // in the page rather than over CDP because a round trip per tap jitters
    // enough to change the answer. Measured across 120/150/180/220/260ms: only
    // 180 scored at all.
    //
    // THE ONLY SHOT HERE THAT IS NOT REPRODUCIBLE. Seeding Math.random fixes
    // what spawns but not when a frame lands, so this file differs a little on
    // every recapture. That is why the assert checks the SCORE and that the run
    // is still alive rather than checking pixels, and why it retries: a run that
    // died early is a bad picture, not a broken build.
    // WAITING A FIXED 15s WAS NOT ENOUGH and the failure is instructive: the
    // autopilot is not playing, it is wobbling, so what it collects in a given
    // fifteen seconds is luck. Four runs at the same seed scored 16, 11, 3 and
    // 4. So it plays until the score is worth photographing instead of until
    // the clock says so, and gives up if Trubbish dies first, which is a retry
    // rather than a failure.
    retries: 4,
    async ready(run) {
      await run.click("#grStart");
      await run.eval(
        `window.__autopilot=setInterval(function(){document.getElementById('grStage')` +
          `.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));},180)`
      );
      let score = 0;
      for (let i = 0; i < 80 && score < 9; i++) {
        await run.wait(500);
        const state = await run.eval(
          `JSON.stringify({s:+document.getElementById('grScore').textContent,` +
            `over:!document.getElementById('grOver').hasAttribute('hidden')})`
        );
        const { s, over } = JSON.parse(state);
        if (over) break;
        score = s;
      }
      // KEEP TAPPING THROUGH THE SHUTTER, which reverses what this did before
      // and the reason is what the old rule produced. It read "stop tapping
      // before the capture so Trubbish is not caught mid-kick", and stopping is
      // exactly how he ends up parked in the bottom corner: nothing tapping
      // means gravity, and gravity in this game means the floor. The recapture
      // on 17 August 2026 came out as a black rectangle with a 26px Trubbish in
      // one corner, which at the 143px the hub draws it is a picture of nothing.
      //
      // Mid-kick is not the failure the old comment thought it was. The game is
      // one mechanic, flipping between the floor and the ceiling, so a frame
      // with Trubbish off the ground is the frame that shows what the game IS.
      // The 90ms settle is still there to let the current frame finish drawing.
      await run.wait(90);
      await run.eval("clearInterval(window.__autopilot)");
    },
  },
  {
    key: "whos-that-pokemon",
    page: "/games/whos-that-pokemon.html",
    file: "whos-that-pokemon-screenshot.webp",
    clip: [".gq-stage", ".gq-choices"],
    shows: "Who's That Pokemon mid-round: a Pokemon blacked out to a silhouette, with four names to choose from underneath",
    assert: `(function(){var i=document.querySelector('.gq-sil img');` +
      `if(!i||!i.naturalWidth)return 'silhouette did not decode';` +
      `var n=document.querySelectorAll('.gq-choices button').length;` +
      `return n===4?'':('expected 4 choices, got '+n);})()`,
  },
  {
    key: "guess-the-set",
    page: "/games/guess-the-set.html",
    file: "guess-the-set-screenshot.webp",
    clip: [".gq-stage", ".gq-choices"],
    shows: "Guess the Set mid-round: a full scan of a real Pokemon card, with four set names to choose from underneath",
    assert: `(function(){var i=document.querySelector('.gq-card img');` +
      `if(!i||!i.naturalWidth)return 'card scan did not decode';` +
      `var n=document.querySelectorAll('.gq-choices button').length;` +
      `return n===4?'':('expected 4 choices, got '+n);})()`,
  },
  {
    key: "pokemon-trivia",
    page: "/games/pokemon-trivia.html",
    file: "pokemon-trivia-screenshot.webp",
    clip: [".gq-stage", ".gq-choices"],
    shows: "Pokemon Trivia mid-round: a question in large type, with four answers to choose from underneath",
    assert: `(function(){var q=document.querySelector('.gq-q');` +
      `if(!q||!q.textContent.trim())return 'no question rendered';` +
      `var n=document.querySelectorAll('.gq-choices button').length;` +
      `return n===4?'':('expected 4 choices, got '+n);})()`,
  },
];

// ---------------------------------------------------------------------------
// A very small CDP client. There is no puppeteer in this tree and adding one
// for four screenshots would be a 300MB dependency for a script nobody runs in
// CI. Node 24 ships a global WebSocket, which is all this needs.
// ---------------------------------------------------------------------------
async function launchChrome(port) {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}`);
  const dir = mkdtempSync(join(tmpdir(), "grips-shots-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-extensions",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return proc;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error("Chrome never opened its debugger port");
}

async function openTab(port) {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method) events.push(m.method);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => pending.has(i) && (pending.delete(i), rej(new Error(`CDP timeout: ${method}`))), 60000);
    });
  return {
    send,
    events,
    close: async () => {
      ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`).catch(() => {});
    },
  };
}

const evaluate = async (tab, expression) => {
  const r = await tab.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 600));
  return r.result.value;
};

/**
 * Replace Math.random with a seeded mulberry32, before any page script runs.
 * Page.addScriptToEvaluateOnNewDocument is the only hook that lands early
 * enough: an evaluate after navigation is already too late, the first question
 * has been picked.
 */
const SEEDER = `(function(){var s=${SEED}>>>0;Math.random=function(){` +
  `s=(s+0x6d2b79f5)>>>0;var t=s;t=Math.imul(t^(t>>>15),t|1);` +
  `t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};})();`;

// ---------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });

const wanted = SHOTS.filter((s) => FORCE || !existsSync(join(OUT, s.file)));
if (wanted.length) {
  const port = 9222 + (process.pid % 300);
  const chrome = await launchChrome(port);
  try {
    for (const shot of wanted) {
      const tries = shot.retries || 1;
      for (let attempt = 1; attempt <= tries; attempt++) {
      const tab = await openTab(port);
      try {
        await tab.send("Page.enable");
        await tab.send("Runtime.enable");
        await tab.send("Emulation.setDeviceMetricsOverride", {
          width: VIEW.w,
          height: VIEW.h,
          deviceScaleFactor: VIEW.dpr,
          mobile: true,
        });
        await tab.send("Page.addScriptToEvaluateOnNewDocument", { source: SEEDER });
        await tab.send("Page.navigate", { url: ORIGIN + shot.page });
        for (let i = 0; i < 80 && !tab.events.includes("Page.loadEventFired"); i++) {
          await new Promise((r) => setTimeout(r, 250));
        }
        // The games fetch their data and then mount, so the load event is only
        // the starting gun. Poll for the thing the shot is of.
        const target = Array.isArray(shot.clip) ? shot.clip[shot.clip.length - 1] : shot.clip;
        let up = false;
        for (let i = 0; i < 60 && !up; i++) {
          up = await evaluate(tab, `!!document.querySelector(${JSON.stringify(target)})`);
          if (!up) await new Promise((r) => setTimeout(r, 250));
        }
        if (!up) throw new Error(`${shot.key}: ${target} never appeared`);

        const run = {
          click: async (sel) => {
            const ok = await evaluate(tab, `(function(){var e=document.querySelector(${JSON.stringify(sel)});` +
              `if(!e)return false;e.click();return true;})()`);
            if (!ok) throw new Error(`${shot.key}: nothing matched ${sel}`);
          },
          eval: (expr) => evaluate(tab, expr),
          wait: (ms) => new Promise((r) => setTimeout(r, ms)),
        };
        if (shot.ready) await shot.ready(run);
        else await new Promise((r) => setTimeout(r, 900));

        const problem = await evaluate(tab, shot.assert);
        if (problem) throw new Error(`${shot.key}: ${problem}`);

        // The clip is the union of the named elements' boxes, in CSS pixels.
        const sels = Array.isArray(shot.clip) ? shot.clip : [shot.clip];
        const box = await evaluate(
          tab,
          `(function(){var r=${JSON.stringify(sels)}.map(function(q){var e=document.querySelector(q);` +
            `return e&&e.getBoundingClientRect();}).filter(Boolean);` +
            `if(!r.length)return null;` +
            `var x=Math.min.apply(null,r.map(function(b){return b.left;}));` +
            `var y=Math.min.apply(null,r.map(function(b){return b.top;}));` +
            `var x2=Math.max.apply(null,r.map(function(b){return b.right;}));` +
            `var y2=Math.max.apply(null,r.map(function(b){return b.bottom;}));` +
            `return {x:Math.round(x),y:Math.round(y),w:Math.round(x2-x),h:Math.round(y2-y)};})()`
        );
        if (!box || box.w < 40 || box.h < 40) throw new Error(`${shot.key}: clip came out empty`);

        const png = await tab.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: true,
          clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: VIEW.dpr },
        });
        const raw = join(OUT, shot.file.replace(/\.webp$/, ".raw.png"));
        writeFileSync(raw, Buffer.from(png.data, "base64"));
        // Downsample to SHOT_W and write webp. Pillow rather than cwebp: this
        // machine has Pillow and the other image steps in this repo use it.
        execFileSync("python3", [
          "-c",
          [
            "import sys",
            "from PIL import Image",
            "src, dst, w = sys.argv[1], sys.argv[2], int(sys.argv[3])",
            "im = Image.open(src).convert('RGB')",
            "h = round(im.height * w / im.width)",
            "im.resize((w, h), Image.LANCZOS).save(dst, 'WEBP', quality=76, method=6)",
          ].join("\n"),
          raw,
          join(OUT, shot.file),
          String(SHOT_W),
        ]);
        execFileSync("rm", ["-f", raw]);
        console.log(`  captured ${shot.file}  (clip ${box.w}x${box.h} css)`);
        break;
      } catch (err) {
        if (attempt === tries) throw err;
        console.log(`  attempt ${attempt} of ${tries} failed, retrying: ${err.message}`);
      } finally {
        await tab.close();
      }
      }
    }
  } finally {
    chrome.kill();
  }
}

// The manifest is rebuilt from what is ON DISK, the way sync-app-shots.mjs and
// sync-symbols.mjs do it, so a run that captured nothing still writes a
// complete and correct file.
const out = { _readme: [
  "Screenshots of the four browser games, for the cards on /games/.",
  "Written by scripts/sync-game-shots.mjs. Do not hand-edit: `w` and `h` are the",
  "decoded size of the file and the builder emits them as width/height.",
  "Rerun the script after any change to a game or these go stale, which nothing",
  "else in the build can detect for you.",
], checked: localDay(), shots: {} };
let missing = 0;
for (const shot of SHOTS) {
  const path = join(OUT, shot.file);
  if (!existsSync(path)) {
    missing++;
    console.log(`  MISSING ${shot.file}`);
    continue;
  }
  const size = execFileSync("python3", [
    "-c",
    "import sys;from PIL import Image;im=Image.open(sys.argv[1]);print(im.width,im.height)",
    path,
  ])
    .toString()
    .trim()
    .split(" ")
    .map(Number);
  out.shots[shot.key] = {
    file: shot.file,
    w: size[0],
    h: size[1],
    bytes: statSync(path).size,
    shows: shot.shows,
  };
}
// Keep `checked` stable when nothing moved, so a no-op run leaves no diff.
if (existsSync(MANIFEST)) {
  const old = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const same = JSON.stringify(old.shots) === JSON.stringify(out.shots);
  if (same) out.checked = old.checked;
}
await writeFile(MANIFEST, JSON.stringify(out, null, 2) + "\n");

console.log(
  `data/game-shots.json: ${Object.keys(out.shots).length} of ${SHOTS.length} shots` +
    (missing ? `, ${missing} missing` : "") +
    `\n  ${Object.values(out.shots).reduce((n, s) => n + s.bytes, 0).toLocaleString("en-US")} bytes total`
);
