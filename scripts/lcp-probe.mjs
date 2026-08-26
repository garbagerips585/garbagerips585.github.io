// Measure LCP, FCP and the LCP resource under Lighthouse-like throttling.
//
// WHY THIS EXISTS. On 25 August 2026 I shipped a "performance fix" reasoned from
// a PageSpeed screenshot and it cost the desktop score 16 points, because I had
// no way to check a change before it was live. PageSpeed is a round trip through
// somebody else's queue; this is the same question asked locally in ten seconds.
//
//   node scripts/lcp-probe.mjs [url] [mobile|desktop] [runs]
//
// THE OBSERVER IS INSTALLED BEFORE THE NAVIGATION, via
// Page.addScriptToEvaluateOnNewDocument. Reading
// performance.getEntriesByType('largest-contentful-paint') after the fact
// returned nothing on the first attempt at this, which reads as "no LCP" and is
// really "asked too late".
//
// Numbers are NOT comparable to PageSpeed's: no packet-level shaping, a
// different CPU. They are comparable to EACH OTHER on the same machine, which
// is the only thing a before/after needs.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_ = process.argv[2] || "http://127.0.0.1:4585/index.html";
const MOBILE = (process.argv[3] || "mobile") !== "desktop";
const RUNS = Number(process.argv[4] || 3);
// DPR MATTERS MORE THAN ANYTHING ELSE HERE. srcset picks by device pixels, so
// 1.75 and 2.625 fetch DIFFERENT FILES for the same layout -- 560w against
// 810w on the pack art. Measuring at the wrong one answers a question nobody
// asked. PageSpeed's mobile run lands on the 810w file.
const DPR = Number(process.argv[5] || 1.75);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OBSERVE = `
  window.__lcp = null; window.__fcp = null;
  new PerformanceObserver(l => { const e = l.getEntries().pop();
    if (e) window.__lcp = { t: e.startTime, url: e.url || '', size: e.size,
      id: e.element ? (e.element.className || e.element.tagName) : null }; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries())
    if (e.name === 'first-contentful-paint') window.__fcp = e.startTime; })
    .observe({ type: 'paint', buffered: true });
`;

async function once(port) {
  const profile = mkdtempSync(join(tmpdir(), "lcp-"));
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu"], { stdio: "ignore" });
  try {
    let tab = null;
    for (let i = 0; i < 40 && !tab; i++) {
      await sleep(250);
      try { tab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
        .find((t) => t.type === "page"); } catch {}
    }
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0; const waiting = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m.result); waiting.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res) => {
      const i = ++id; waiting.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    if (MOBILE) {
      await send("Emulation.setDeviceMetricsOverride",
        { width: 412, height: 823, deviceScaleFactor: DPR, mobile: true });
      await send("Network.emulateNetworkConditions", { offline: false, latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await send("Emulation.setCPUThrottlingRate", { rate: 4 });
    } else {
      await send("Emulation.setDeviceMetricsOverride",
        { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false });
      await send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
    await send("Page.navigate", { url: URL_ });
    await sleep(MOBILE ? 11000 : 6000);
    const { result } = await send("Runtime.evaluate", { returnByValue: true,
      expression: `({ lcp: window.__lcp, fcp: window.__fcp,
        bytes: performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0) })` });
    ws.close();
    return result.value;
  } finally {
    chrome.kill();
    await sleep(200);
    /* THE CLEANUP KILLED THE MEASUREMENT IT WAS CLEANING UP AFTER. On Node 24 this
       rmSync throws ENOTEMPTY: Chrome is still flushing its profile when we get
       here, so a file appears in a directory rm has already walked. Thrown from a
       `finally`, it REPLACES whatever the try block was returning -- so the probe
       exited 1 with no output, having already done the work and measured the page.
       A failure to delete a temp directory is not a failure to measure, and it
       must not be allowed to look like one. Worst case a few MB sit in $TMPDIR
       until the OS clears them, which is what $TMPDIR is for. */
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      /* ignore: the numbers are already in hand */
    }
  }
}

const rows = [];
for (let i = 0; i < RUNS; i++) rows.push(await once(9400 + i));
const ok = rows.filter((r) => r && r.lcp);
const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(`${MOBILE ? `MOBILE (412px, DPR ${DPR}, 4x CPU, ~1.6Mbps)` : "DESKTOP (1350px, no throttle)"}  ${URL_}`);
if (!ok.length) { console.log("  no LCP recorded"); process.exit(1); }
console.log(`  runs        ${ok.length}/${RUNS}`);
console.log(`  FCP  median ${Math.round(med(ok.map((r) => r.fcp || 0)))} ms   (${ok.map((r)=>Math.round(r.fcp||0)).join(", ")})`);
console.log(`  LCP  median ${Math.round(med(ok.map((r) => r.lcp.t)))} ms   (${ok.map((r)=>Math.round(r.lcp.t)).join(", ")})`);
console.log(`  bytes median ${Math.round(med(ok.map((r) => r.bytes)) / 1024)} KiB`);
const l = ok[0].lcp;
console.log(`  LCP element ${l.id}`);
console.log(`  LCP url     ${(l.url || "(text)").split("/").pop()}`);
