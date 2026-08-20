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
    // A TITLE SCREEN USED TO BE THE WRONG PICTURE AND NOW IT IS THE RIGHT ONE,
    // which is a change in the game and not a change of mind. The rule that
    // stood here read "A SCREENSHOT OF THE TITLE CARD WOULD HAVE BEEN A LIE BY
    // OMISSION, so this one plays the game", and it was right about the card it
    // was written against: a start button on a black rectangle tells a visitor
    // nothing. On 20 August 2026 the title became a drawn 8-bit card -- the
    // wordmark, ROCHESTER, NY, and Trubbish sitting on a Garbage Plate -- so it
    // now says more about this game than a frame of autopilot wobble does.
    //
    // IT IS ALSO THE ONLY REPRODUCIBLE SHOT OF THE FOUR, where the old one was
    // explicitly the opposite: no autopilot, no retries, no seeded spawn that
    // still lands on a different frame. The single moving part is the blinking
    // prompt, and prefers-reduced-motion pins it ON by the game's own rule in
    // drawTitle, so the shutter cannot land on a dark frame.
    media: [{ name: "prefers-reduced-motion", value: "reduce" }],
    // I WROTE "TAP TO START" HERE AND THE CAPTURE SAYS "PRESS START". The game
    // picks its wording off (pointer:coarse), and Emulation's mobile:true sets
    // the metrics, not the pointer media feature -- so a shot that is 390px wide
    // and mobile in every other respect still reads as a mouse. Corrected off
    // the pixels rather than off the reasoning, which is the only way alt text
    // for a screenshot can be checked at all.
    shows:
      "The Garbage Run title screen: GARBAGE RUN in blocky 8-bit capitals, Trubbish sitting on a Garbage Plate, and ROCHESTER, NY over GARBAGE RIPS 585 with PRESS START underneath",
    // grOver is NOT a game-over panel, which cost a run to find out: it is one
    // overlay reused for both ends of the game, and on the title it carries the
    // class gr-attract. So "is it hidden" answers nothing here -- it is visible
    // in exactly the state this shot wants. gr-attract is the discriminator.
    assert: `(function(){var o=document.getElementById('grOver');` +
      `if(!o||!/\\bgr-attract\\b/.test(o.className))return 'the title screen is not showing';` +
      `if(+document.getElementById('grScore').textContent!==0)return 'the run had already started';` +
      `var c=document.querySelector('.gr-stage canvas');` +
      `if(!c||!c.width)return 'the board has no size';return '';})()`,
    async ready(run) {
      // Nothing to drive. The canvas sizes itself off the viewport before it
      // paints, so this waits for the card to be on screen rather than for a
      // clock; capturing earlier photographs a wrong-sized card.
      await run.wait(800);
    },
  },
  {
    key: "chase-match",
    page: "/games/chase-match.html",
    file: "chase-match-screenshot.webp",
    // The board and the line under it. The line is half the game: it is where a
    // match tells you what you just paired up and what a raw copy of it costs,
    // and a shot of the grid alone would be a shot of a memory game rather than
    // a shot of THIS one.
    clip: [".cm-board", ".cm-say"],
    // A MID-ROUND BOARD, NOT A FRESH DEAL AND NOT A WIN PANEL. A fresh deal is
    // sixteen identical rectangles, which says nothing about the game and
    // everything about the back; the win panel covers the board entirely. Two
    // matched pairs is the state that holds all four things a reader needs: the
    // drawn back, a real card face, what a match looks like, and the payout.
    //
    // IT IS DETERMINISTIC WITHOUT DEPENDING ON THE SEED. The seeded Math.random
    // makes the DEAL reproducible, but which tile index holds which card is not
    // something this file should have to know, so ready() reads the pairs off
    // the images the board actually rendered and clicks two of them. That
    // survives a change to the shuffle, to the pool and to the tier order,
    // which a hardcoded pair of indexes would not.
    // WRITTEN OFF THE PIXELS, NOT OFF THE MARKUP, which is the rule this file's
    // header sets and which the Garbage Run entry above records getting wrong
    // in the other direction. The first draft said "the drawn Garbage Rips
    // back", and the back does not carry those words: opening the capture, it
    // is a green field with a circular plate emblem and 585 under it. What the
    // description does NOT do is name the two cards that came up, because that
    // is true of this seed and nothing else.
    // IT SAID "IN GOLD FRAMES" AND THE FRAME IS NOT GOLD, which is CLAUDE.md's
    // token-name trap arriving in a caption: a matched card was edged in
    // var(--gold), and --gold on this site resolves to #609CBB, a teal. The
    // treatment has since changed again and the description was rewritten off
    // the capture a second time. It does not claim the matched pair looks
    // dimmed either, because in this shot it does not: the rule is there and
    // both cards that came up are saturated enough to shrug it off.
    shows:
      "A Chase Match board mid-round: a four by four grid where twelve cards are face down showing the drawn back, a green field with a circular Garbage Plate emblem and 585 beneath it, and four are turned up as two matched pairs of real Pokemon card scans, over a line giving the rank, name, set and raw price of the last card found",
    assert: `(function(){var b=document.querySelectorAll('#cmGrid .cm-card');` +
      `if(b.length!==16)return 'expected 16 cards, got '+b.length;` +
      `var done=document.querySelectorAll('#cmGrid .cm-card.is-done');` +
      `if(done.length!==4)return 'expected 4 matched cards, got '+done.length;` +
      `for(var i=0;i<done.length;i++){var m=done[i].querySelector('img');` +
      `if(!m||!m.naturalWidth)return 'a matched card scan did not decode';}` +
      `if(document.querySelectorAll('#cmGrid .cm-card.is-up').length)return 'a card was still mid-flip';` +
      `var s=document.getElementById('cmSay');` +
      `if(!s||!/\\$/.test(s.textContent))return 'the payout line has no price in it';` +
      `if(!document.getElementById('cmOver').hidden)return 'the win panel is showing';return '';})()`,
    async ready(run) {
      // Wait for every scan in the round to decode. A card whose picture has
      // not arrived photographs as an empty navy rectangle, which is a true
      // picture of a slow connection and a false picture of the game.
      for (let i = 0; i < 60; i++) {
        const ready = await run.eval(
          `[].slice.call(document.querySelectorAll('#cmGrid img')).every(function(m){return m.complete&&m.naturalWidth;})`
        );
        if (ready) break;
        await run.wait(250);
      }
      // Find two pairs off the rendered board and match them. Same src is the
      // same card, which is what a pair IS here.
      await run.eval(
        `(function(){var b=[].slice.call(document.querySelectorAll('#cmGrid .cm-card'));` +
          `var seen={},pairs=[];` +
          `for(var i=0;i<b.length;i++){var s=b[i].querySelector('img').src;` +
          `if(seen[s]!==undefined)pairs.push([seen[s],i]);else seen[s]=i;}` +
          `for(var p=0;p<2&&p<pairs.length;p++){b[pairs[p][0]].click();b[pairs[p][1]].click();}` +
          `return pairs.length;})()`
      );
      // Longer than the 320ms flip, so nothing is caught mid-turn.
      await run.wait(900);
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
    // The picture is the point of this shot now. Before 20 August 2026 the round
    // was type set alone and the alt said so; the game draws the species it is
    // asking about, so a description with no picture in it now under-describes
    // the shot for exactly the reader who depends on the description.
    shows: "Pokemon Trivia mid-round: artwork of the Pokemon being asked about, the question in large type underneath, and four answers to choose from below that",
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
        // Per-shot media emulation. Only the title-screen shot uses it, and it
        // uses it to remove the one moving part from an otherwise fixed picture.
        if (shot.media) await tab.send("Emulation.setEmulatedMedia", { features: shot.media });
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
