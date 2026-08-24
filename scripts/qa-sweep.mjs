#!/usr/bin/env node
// Drive a real Chrome over every built page and report what only a browser can see.
//
//   node scripts/qa-sweep.mjs                       every root page, three widths
//   node scripts/qa-sweep.mjs --all                 every page in public/ (1,491)
//   node scripts/qa-sweep.mjs --only rarity,decks   just those
//   node scripts/qa-sweep.mjs --widths 390          one width
//
// WHY A BROWSER AND NOT ANOTHER STATIC CHECK. check-build.py already reads the
// built HTML well: asset hashes, CSS parity, laundered claims, future dates,
// image coverage. What it cannot see is layout. Overflow, an <img> that 404s,
// a <picture> whose only <source> is dead, a console error, contrast against
// the colour actually painted behind the text: every one of those needs the
// page rendered, and several of them have shipped here before precisely
// because they were invisible to a text scan.
//
// IT MUST BE SERVED OVER HTTP AND NOT OPENED FROM DISK. The stylesheet link is
// root-absolute (/assets/ui.css), so under file:// it 404s, the page renders
// with no CSS at all, and the overflow check then reports about 95 fabricated
// failures on the home page alone. The runner starts .claude/server.js itself
// so this cannot be got wrong by whoever runs it.
//
// THE OVERFLOW TEST IS THE ONE WORTH READING CLOSELY. "right edge past the
// viewport" on its own flags every carousel on the site, because a horizontal
// shelf is SUPPOSED to extend past the fold; it is inside a scroller. So an
// element only counts when nothing between it and the root clips or scrolls.
// That single condition is the difference between a useful report and 300
// lines of noise.
//
// NO DEPENDENCIES ON PURPOSE. There is no node_modules in this repo and adding
// one for a check script would be the largest thing in the tree. Node 24 ships
// a global WebSocket, which is all the Chrome DevTools Protocol needs.

import { spawn } from "node:child_process";
import { readdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");
const PORT = 4599;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const WIDTHS = (arg("--widths", "390,768,1440")).split(",").map(Number);
const ONLY = arg("--only", "");
const ALL = argv.includes("--all");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- page list
async function pages() {
  if (ONLY) return ONLY.split(",").map((s) => `/${s.replace(/^\/|\.html$/g, "")}.html`);
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (ALL) await walk(p); continue; }
      if (!e.name.endsWith(".html")) continue;
      out.push("/" + relative(PUB, p));
    }
  };
  await walk(PUB);
  return out.sort();
}

// ---------------------------------------------------------------- chrome
let chrome, profile;
async function startChrome() {
  profile = await mkdtemp(join(tmpdir(), "qa-chrome-"));
  chrome = spawn(CHROME, [
    "--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--hide-scrollbars", "--force-device-scale-factor=1", "--force-color-profile=srgb",
    "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:9333/json/version");
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome did not open a debugging port");
}

// A minimal CDP client. One socket, one id counter, promises keyed by id.
function cdp(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  let id = 0;
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) {
      const { res, rej } = waiting.get(m.id); waiting.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  return {
    ready,
    send(method, params = {}, sessionId) {
      const mid = ++id;
      return new Promise((res, rej) => {
        waiting.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
        setTimeout(() => { if (waiting.has(mid)) { waiting.delete(mid); rej(new Error(method + " timed out")); } }, 30000);
      });
    },
    close: () => ws.close(),
  };
}

// ------------------------------------------------------- the in-page audit
// Runs inside the page. Returns plain JSON. Keep it self-contained: it is
// stringified and evaluated, so it closes over nothing from this module.
const AUDIT = `(() => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const out = { w: vw, overflow: [], images: [], contrast: [], headings: [], tap: [], misc: [] };

  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.');
    return s;
  };

  // OVERFLOW. Only counts when nothing between the element and the root clips
  // or scrolls, which is what separates a real burst-out from a carousel.
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const over = Math.round(r.right - vw);
    if (over <= 1) continue;
    let p = el.parentElement, clipped = false;
    while (p && p !== de) {
      const s = getComputedStyle(p);
      if (s.overflowX !== 'visible' || s.overflow !== 'visible') { clipped = true; break; }
      p = p.parentElement;
    }
    if (!clipped) out.overflow.push({ el: name(el), over, text: (el.textContent||'').trim().slice(0,60) });
  }

  // IMAGES. A loaded <img> with naturalWidth 0 is a 404 or a decode failure.
  // <picture> is checked separately because it does NOT fall back when a
  // matching <source> is dead: the browser commits to that source and paints
  // an empty box, so the <img> underneath never gets a chance.
  for (const img of document.images) {
    // STILL CARRYING data-packsrc MEANS NOT ASKED FOR YET, NOT BROKEN.
    // Pack art is hydrated by assets/packplayer.js when a slide is actually
    // reachable: it skips anything with no laid-out box, so a hidden slide
    // keeps its data- attributes until the reader scrolls or hits an arrow.
    // At 390px the carousels run 'is-static' and show slide 0 only, so eight
    // of them never load at all, on purpose. Counting those as 404s reported
    // eight failures on the home page that were the performance work doing
    // its job. An image that HAS been given a src and still fails is caught
    // by the same test below, which is the case actually worth knowing about.
    if (img.hasAttribute('data-packsrc')) continue;
    // src="" IS A PLACEHOLDER A SCRIPT FILLS IN, NOT A 404. hall.html's
    // lightbox ships <img id="lbImg" src="" alt=""> inside a display:none
    // dialog and gets its src when a card is clicked. An empty src resolves
    // against the document, so currentSrc reads back as the page's own URL
    // and the naive test called the page a broken image on all three widths.
    // Requiring a real src and a real box removes the whole class.
    const rawSrc = img.getAttribute('src');
    const r = img.getBoundingClientRect();
    const laidOut = r.width > 0 && r.height > 0;
    if (rawSrc && img.complete && img.naturalWidth === 0 && laidOut) {
      out.images.push({ kind: 'broken', src: img.currentSrc || img.src || '(no src)', el: name(img),
        inPicture: !!img.closest('picture') });
    }
    if (!img.hasAttribute('alt')) out.images.push({ kind: 'no-alt', src: img.currentSrc || img.src, el: name(img) });
    // A decorative alt="" is fine; a link whose only content is an alt="" image is not.
    // A LINK REMOVED FROM THE ACCESSIBILITY TREE CANNOT BE AN UNLABELLED LINK.
    // upcoming.html wraps each product shot in a[tabindex=-1][aria-hidden=true]
    // pointing at the same url as the properly labelled text link beside it,
    // which is the correct way to publish a redundant image link. Flagging all
    // fourteen of them as missing a name reported the fix as the fault.
    const a = img.closest('a');
    const hidden = a && (a.getAttribute('aria-hidden') === 'true' || a.closest('[aria-hidden=true]'));
    if (a && !hidden && img.getAttribute('alt') === '' && !a.getAttribute('aria-label') && !a.textContent.trim()) {
      out.images.push({ kind: 'unlabelled-link', href: a.getAttribute('href'), el: name(img) });
    }
  }

  // HEADING ORDER. One h1, and no skipped level on the way down.
  const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
  const h1s = hs.filter((h) => h.tagName === 'H1').length;
  if (h1s !== 1) out.headings.push({ kind: 'h1-count', n: h1s });
  let prev = 0;
  for (const h of hs) {
    const lvl = +h.tagName[1];
    if (prev && lvl > prev + 1) out.headings.push({ kind: 'skip', from: prev, to: lvl, text: h.textContent.trim().slice(0,50) });
    prev = lvl;
  }

  // TAP TARGETS, phone only. 24px is the WCAG 2.2 AA minimum.
  if (vw <= 500) {
    for (const el of document.querySelectorAll('main a, main button, main [role=button], main summary')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(el).display === 'inline') continue; // inline links inside prose are exempt
      // WCAG 2.2 target size is 24x24, but a link that is 314px wide and 23px
      // tall is not a target anybody misses, and flagging every decklist row
      // buried the real findings under 200 lines. A target fails only when it
      // is small in one axis AND not generous in the other.
      if ((r.height < 24 && r.width < 44) || (r.width < 24 && r.height < 44)) {
        out.tap.push({ el: name(el), w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim().slice(0,40) });
      }
    }
  }
  // CONTRAST, against the colour actually painted behind the text rather than
  // the one the token says. The 18 August repaint broke 21 logos exactly this
  // way: the token name did not change, its value did, and nothing flagged it.
  const lum = (c) => {
    const [r,g,b] = c;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
  };
  const parse = (s) => { const m = s.match(/[\d.]+/g); return m ? m.slice(0,3).map(Number).concat(m[3] !== undefined ? +m[3] : 1) : null; };
  const bgOf = (el) => {
    let p = el;
    while (p && p !== de.parentElement) {
      const c = parse(getComputedStyle(p).backgroundColor);
      if (c && c[3] > 0.95) return c;
      p = p.parentElement;
    }
    return [255,255,255,1];
  };
  const seen = new Set();
  for (const el of document.querySelectorAll('main p, main li, main dd, main dt, main span, main b, main a, main h1, main h2, main h3, main h4')) {
    // Only elements holding their own text, so a wrapper is not judged twice.
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3);
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.opacity === '0') continue;
    const fg = parse(st.color); if (!fg || fg[3] < 0.95) continue;
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1,L2) + 0.05) / (Math.min(L1,L2) + 0.05);
    const px = parseFloat(st.fontSize);
    const bold = (parseInt(st.fontWeight,10) || 400) >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    if (ratio + 0.005 < need) {
      const key = name(el) + '|' + st.color + '|' + Math.round(px);
      if (seen.has(key)) continue;
      seen.add(key);
      out.contrast.push({ el: name(el), ratio: +ratio.toFixed(2), need, px: Math.round(px),
        fg: st.color, bg: 'rgb(' + bg.slice(0,3).join(',') + ')', text: el.textContent.trim().slice(0,50) });
    }
  }

  return out;
})()`;

// ---------------------------------------------------------------- the run
const server = spawn("node", [join(ROOT, ".claude/server.js")], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, PORT: String(PORT) },
});
process.on("exit", () => { try { server.kill(); chrome?.kill(); } catch {} });

async function main() {
  // Wait for the static server before Chrome, so no page can load half-served.
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/index.html`)).ok) break; } catch {}
    await sleep(100);
  }
  const wsUrl = await startChrome();
  const browser = cdp(wsUrl);
  await browser.ready;

  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (m, p) => browser.send(m, p, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");

  const list = await pages();
  const results = [];
  let n = 0;

  for (const path of list) {
    for (const width of WIDTHS) {
      await send("Emulation.setDeviceMetricsOverride", {
        width, height: 900, deviceScaleFactor: 1, mobile: width <= 500,
      });
      const errors = [];
      // Console and network failures are collected per page load.
      const onEvent = (m) => {};
      await send("Page.navigate", { url: `http://127.0.0.1:${PORT}${path}` });
      // Settle: load event, then lazy images near the top, then a paint.
      await sleep(width === WIDTHS[0] ? 700 : 450);
      // Force every lazy image to commit so a 404 cannot hide below the fold.
      await send("Runtime.evaluate", {
        expression: `document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');`,
      });
      await sleep(500);
      const { result } = await send("Runtime.evaluate", {
        expression: AUDIT, returnByValue: true, awaitPromise: false,
      });
      if (result?.value) results.push({ path, width, ...result.value });
      n++;
      if (n % 25 === 0) process.stderr.write(`  ${n}/${list.length * WIDTHS.length}\n`);
    }
  }

  await writeFile(join(ROOT, ".cache/qa-sweep.json"), JSON.stringify(results, null, 1));
  report(results, list.length);
  browser.close();
  server.kill();
  chrome.kill();
  await rm(profile, { recursive: true, force: true });
}

function report(results, pageCount) {
  const bucket = (k) => {
    const m = new Map();
    for (const r of results) for (const item of r[k] || []) {
      const key = JSON.stringify(item);
      if (!m.has(key)) m.set(key, { item, where: [] });
      m.get(key).where.push(`${r.path}@${r.width}`);
    }
    return [...m.values()];
  };
  const S = [];
  const say = (s) => S.push(s);

  say(`\nQA SWEEP: ${pageCount} pages x ${WIDTHS.join(", ")}px = ${results.length} renders\n`);

  for (const [key, label] of [
    ["overflow", "HORIZONTAL OVERFLOW (nothing clips it before the root)"],
    ["images", "IMAGES"],
    ["contrast", "TEXT CONTRAST BELOW WCAG AA"],
    ["headings", "HEADING STRUCTURE"],
    ["tap", "TAP TARGETS UNDER 24px (390px only)"],
  ]) {
    const rows = bucket(key);
    say(`${label}: ${rows.length === 0 ? "clean" : rows.length + " distinct"}`);
    for (const { item, where } of rows.slice(0, 40)) {
      say(`   ${JSON.stringify(item)}`);
      say(`      ${where.length} render(s): ${where.slice(0, 6).join(" ")}${where.length > 6 ? " ..." : ""}`);
    }
    if (rows.length > 40) say(`   ... and ${rows.length - 40} more, see .cache/qa-sweep.json`);
    say("");
  }
  const clean = ["overflow", "images", "contrast", "headings", "tap"].every((k) => bucket(k).length === 0);
  say(clean ? "no browser-visible defects found" : "defects above; full detail in .cache/qa-sweep.json");
  console.log(S.join("\n"));
}

main().catch((e) => { console.error(e); server.kill(); chrome?.kill(); process.exit(1); });
