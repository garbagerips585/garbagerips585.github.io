#!/usr/bin/env node
// Build /selling.html: where to sell Pokemon cards, what it costs, and who is
// holding the money when it goes wrong.
//
//   node scripts/build-selling.mjs
//
// Reads data/selling.json (venues and fees) and data/selling-safety.json
// (protections, attacks, defences). Both carry a source url and a read date on
// every claim, the standard data/grading.json set.
//
// WHY THIS PAGE EXISTS AND WHY IT TOOK TWO PASSES. Every other page here
// answers "what is my card worth". The next question is always "so where do I
// sell it", and the site had no answer. It was deliberately not built once
// already, because fee percentages copied off blog posts are exactly the kind
// of number this site does not publish, and grading.json's readme records that
// when third-party fee figures were last checked against primary sources,
// three of four were wrong.
//
// So every fee here was read off the company's own page. Where one could not
// be, the venue still appears, with what IS known and a link to its fee page,
// and it says UNVERIFIED rather than borrowing a number from somewhere else.
// A gap stated plainly is worth more than a figure that might be wrong,
// because this page is about somebody's money.
//
// THE SAFETY HALF IS FRAMED AS MECHANISM, NOT REPUTATION, and that was a
// deliberate choice against the obvious one. The obvious page warns readers
// off Facebook Marketplace. This site cannot source "Facebook Marketplace is
// full of scammers": it is a character judgment with no publishable evidence
// and it would age badly. What IS sourceable is who stands between buyer and
// seller, what recourse exists, and who eats the loss. A reader given the
// mechanism can judge any venue, including ones that do not exist yet.
//
// And the conclusion that mechanism reaches is the opposite of the expected
// one, which is why it is worth printing: an in-person cash sale carries LESS
// risk than a shipped online sale. Nothing ships, nothing can be charged back,
// both people inspect before the value moves. The FTC says so in its own
// guidance for sellers. What it costs you is the buyer pool and probably the
// price. That is a trade, not a safety ranking, and this site can say it with
// a straight face because it already publishes six verified local shops and a
// show calendar.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, footer, APP_JS } from "../shared/chrome.mjs";
import { esc, longDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const money = JSON.parse(await readFile(join(ROOT, "data/selling.json"), "utf8"));
const safe = JSON.parse(await readFile(join(ROOT, "data/selling-safety.json"), "utf8"));

let shops = 0;
let shows = 0;
try {
  shops = (JSON.parse(await readFile(join(ROOT, "data/shops.json"), "utf8")).shops || []).length;
} catch { /* the in-person section drops its count rather than guessing */ }
try {
  shows = (JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8")).shows || []).length;
} catch { /* same */ }

const venues = money.venues || [];
if (!venues.length) throw new Error("data/selling.json has no venues");

// Group in the order somebody actually works through the question: the places
// you list it yourself, the places that buy it outright, the places that sell
// it for you, and the place you can drive to.
const GROUPS = [
  { key: "market", title: "Marketplaces", blurb: "You list it, a buyer finds it, you ship it. The most money and the most work." },
  { key: "buylist", title: "Buylists", blurb: "They buy it outright at their price. No waiting and no buyer to argue with." },
  { key: "consign", title: "Consignment and auction", blurb: "They sell it for you. Worth it on cards where the buyer pool is small and rich." },
  { key: "person", title: "In person", blurb: "Cash, face to face, done in one moment. Mechanically the safest way to sell." },
];
// READ THE FIELD, DO NOT INFER THE GROUP. This used to pattern match `type` and
// `format`, and because eBay's format mentions auctions it filed eBay, Whatnot
// and Sportlots under "they sell it for you", leaving the Marketplaces section
// holding two venues. Sportlots' own note in the data says nobody sells your
// cards for you there, so the page was contradicting its own source text.
const groupOf = (v) => {
  if (!v.group) throw new Error(`selling.json: venue "${v.id}" has no group`);
  if (!GROUPS.some((g) => g.key === v.group)) {
    throw new Error(
      `selling.json: venue "${v.id}" has group "${v.group}", which is not one of ${GROUPS.map((g) => g.key).join(", ")}`
    );
  }
  return v.group;
};

const STATUS = {
  sourced: { label: "Fees sourced", cls: "ok" },
  partial: { label: "Partly sourced", cls: "part" },
  unverified: { label: "Fees unverified", cls: "unv" },
  structural: { label: "No platform fee", cls: "ok" },
};

const feeRow = (f) => `        <li>
          <b>${esc(f.what)}</b> ${esc(f.rate)}
          ${f.appliesTo ? `<span class="se-on">on ${esc(f.appliesTo)}</span>` : ""}
          ${f.note ? `<span class="se-nt">${esc(f.note)}</span>` : ""}
        </li>`;

// THE GUARD BELOW EXISTED ONLY ON THE OTHER HALF OF THIS FILE. The header says
// "RENDER EVERY FIELD OR THROW", and prot() does; venueCard hand-listed its keys
// and silently dropped the rest. Five researched fields never reached the page:
// `protection` on all 14 venues, `sources` with every per-figure url and read
// date on all 14, `conditions`, and `sellerLevels`. The page meanwhile told the
// reader "every figure here carries the date it was read", which it then did
// not do. Writing the rule down is not the same as applying it.
// NESTED OBJECTS NEED THEIR OWN GUARD. V_KNOWN only inspects top level venue
// keys, so a renderer that guessed at the shape INSIDE one of them passed every
// check while emitting nonsense: an earlier version of this read l.level, l.rate
// and l.note against data whose keys are level, limits and toAdvance, and every
// entry collapsed to a bare integer under a bold label promising rates.
const SL_KNOWN = new Set(["level", "limits", "toAdvance"]);
const sellerLevel = (l) => {
  if (typeof l === "string") return `<li>${esc(l)}</li>`;
  for (const k of Object.keys(l)) {
    if (!SL_KNOWN.has(k)) throw new Error(`selling.json: sellerLevels entry has unrendered key "${k}"`);
  }
  return `<li><b>Level ${esc(String(l.level))}.</b> ${esc(l.limits || "")}${
    l.toAdvance ? ` <span class="se-adv">To move up: ${esc(l.toAdvance)}</span>` : ""
  }</li>`;
};

const V_KNOWN = new Set([
  "id", "name", "url", "type", "format", "bestFor", "status", "access", "fees",
  "payout", "note", "group", "protection", "sources", "conditions", "sellerLevels",
]);

const venueCard = (v) => {
  for (const k of Object.keys(v)) {
    if (!V_KNOWN.has(k)) throw new Error(`selling.json: venue "${v.id}" has unrendered key "${k}"`);
  }
  const st = STATUS[v.status] || STATUS.partial;
  const fees = Array.isArray(v.fees) ? v.fees : [];
  return `      <article class="se-v" id="${esc(v.id)}">
        <div class="se-vh">
          <h3>${v.url ? `<a href="${esc(v.url)}" rel="noopener" target="_blank">${esc(v.name)}</a>` : esc(v.name)}</h3>
          <span class="se-st ${st.cls}">${esc(st.label)}</span>
        </div>
        ${v.type || v.format ? `<p class="se-fmt">${[v.type, v.format].filter(Boolean).map(esc).join(". ")}</p>` : ""}
        ${v.bestFor ? `<p class="se-best"><b>Best for.</b> ${esc(v.bestFor)}</p>` : ""}
        ${fees.length ? `<ul class="se-fees">\n${fees.map(feeRow).join("\n")}\n        </ul>`
          : `<p class="se-none">No fee figures here. ${
              v.status === "unverified"
                ? "Nothing is published where we could read it, and a number copied from somewhere else would be a guess about your money."
                : "There is no platform fee to state."
            }${v.url ? ` Their own page is linked above.` : ""}</p>`}
        ${v.payout ? `<p class="se-pay"><b>Getting paid.</b> ${esc(v.payout)}</p>` : ""}
        ${v.access ? `<p class="se-acc"><b>To sell there.</b> ${esc(v.access)}</p>` : ""}
        ${v.protection ? `<p class="se-prot"><b>If it goes wrong.</b> ${esc(v.protection)}</p>` : ""}
        ${(v.conditions || []).length ? `<p class="se-lbl"><b>Only if.</b></p><ul class="se-cond">${
          v.conditions.map((x) => `<li>${esc(x)}</li>`).join("")
        }</ul>` : ""}
        ${(v.sellerLevels || []).length ? `<p class="se-lbl"><b>What you are allowed to list, by level.</b></p><ul class="se-cond">${
          v.sellerLevels.map(sellerLevel).join("")
        }</ul>` : ""}
        ${v.note ? `<p class="se-nb">${esc(v.note)}</p>` : ""}
        ${(v.sources || []).length ? `<p class="se-src">${v.sources
          .map((x, i) => {
            const u = typeof x === "string" ? x : x.url;
            const what = typeof x === "string" ? "" : x.what || "";
            const read = typeof x === "string" ? "" : x.read || "";
            return u
              ? `<a href="${esc(u)}" aria-label="${esc(v.name)}${what ? `, ${esc(what)}` : ""}, source ${i + 1}" rel="noopener" target="_blank">${
                  esc(what || `Source ${i + 1}`)
                }</a>${read ? ` <span>read ${esc(longDate(read))}</span>` : ""}`
              : esc(what);
          })
          .join(" &bull; ")}</p>` : ""}
      </article>`;
};

// RENDER EVERY FIELD OR THROW. The first version of this hand-listed the keys
// it knew and quietly dropped the rest, which is the worst possible bug on a
// page like this: research that was actually done, sourced and dated would
// simply not appear, and nothing would look broken. Whatever the data carries,
// the page shows, and an unrecognised key stops the build until somebody
// decides where it goes.
const P_LABEL = {
  covers: ["Covers.", "yes"],
  doesNotCover: ["Does not cover.", "no"],
  sellerCarries: ["The seller carries.", "no"],
  sellerBilledBackFor: ["The seller is billed back for.", "no"],
  conditions: ["Only if all of these are true.", ""],
  how: ["How it works.", ""],
  clocks: ["Clocks.", ""],
  excluded: ["Excluded.", "no"],
  threshold: ["Threshold.", ""],
  signatureThreshold: ["Signature on delivery.", ""],
  highValue: ["High value items.", ""],
  packingVideo: ["Packing video.", ""],
  shipping: ["Shipping.", ""],
  counterfeits: ["Counterfeits.", ""],
  returns: ["Returns.", ""],
  cardCarveOut: ["Cards specifically.", ""],
  buyerSideDiffers: ["The buyer's side differs.", ""],
  offPlatform: ["Off platform.", "no"],
};
const P_SKIP = new Set(["venue", "note", "source", "alsoRead", "read", "verifiedTwice"]);

const prot = (p) => {
  const parts = [];
  for (const [k, v] of Object.entries(p)) {
    if (P_SKIP.has(k)) continue;
    if (Array.isArray(v) && !v.length) continue;
    const spec = P_LABEL[k];
    if (!spec) throw new Error(`selling-safety.json: protection "${p.venue}" has key "${k}" with no label in P_LABEL`);
    const [label, tone] = spec;
    const head = `<p class="se-lbl${tone ? ` se-${tone}` : ""}"><b>${esc(label)}</b></p>`;
    parts.push(
      Array.isArray(v)
        ? `${head}<ul>${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : `<p class="se-nb"><b>${esc(label)}</b> ${esc(v)}</p>`
    );
  }
  const srcs = [p.source, ...(p.alsoRead || [])].filter(Boolean);
  return `      <article class="se-p">
        <h3>${esc(p.venue)}</h3>
        ${p.note ? `<p class="se-nb">${esc(p.note)}</p>` : ""}
        ${parts.join("\n        ")}
        ${srcs.length ? `<p class="se-src">${srcs
          .map((u, i) => `<a href="${esc(u)}" aria-label="${esc(p.venue)} policy, source ${i + 1}" rel="noopener" target="_blank">${i ? `Source ${i + 1}` : "Source"}</a>`)
          .join(", ")}${p.read ? `, read ${esc(longDate(p.read))}` : ""}</p>` : ""}
      </article>`;
};

const nSourced = venues.filter((v) => v.status === "sourced").length;
const desc = `Where to sell Pokemon cards and what each place takes. Fees read off each company's own page, plus who protects a seller and who does not.`;

const style = `
.se-lede{max-width:46em}
.se-jump{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:var(--s5) 0 var(--s4)}
.se-jump a{display:inline-flex;align-items:center;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);color:inherit;
  text-decoration:none;font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.se-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.se-jg{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);margin-left:var(--s2)}
.se-jg:first-child{margin-left:0}
.se-v{scroll-margin-top:var(--s5)}
.se-key{border:3px solid var(--navy);border-radius:12px;background:var(--navy);color:#F4F1E2;
  padding:var(--s5);margin:var(--s5) 0;box-shadow:var(--hard-lg)}
.se-key h2{color:#F4F1E2;margin-bottom:var(--s3)}
.se-key p{color:#DDE6EC;line-height:1.55;max-width:44em}
.se-key p + p{margin-top:var(--s3)}
.se-grp{margin-top:var(--s6)}
.se-grp > p{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}
.se-vs{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:900px){.se-vs{grid-template-columns:1fr}}
.se-v,.se-p{border:3px solid var(--navy);border-radius:12px;background:var(--card);
  box-shadow:var(--hard-lg);padding:var(--s4)}
.se-vh{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--s2);margin-bottom:var(--s2)}
.se-vh h3{font:400 var(--t-m)/1.15 var(--display)}
.se-st{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:5px 8px;border-radius:5px;border:1px solid var(--hair);color:var(--ink-2)}
.se-st.ok{background:#1E5B34;color:#EAF6EE;border-color:#1E5B34}
.se-st.unv{background:var(--card);color:var(--ink-2);border-style:dashed}
.se-fmt{color:var(--ink-2);font-size:var(--t-sm);margin-bottom:var(--s2)}
.se-best,.se-pay,.se-acc,.se-nb,.se-none{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.se-nb,.se-none{color:var(--ink-2)}
.se-fees{list-style:none;margin:var(--s3) 0 0;padding:0;display:flex;flex-direction:column;gap:var(--s2)}
.se-fees li{font-size:var(--t-sm);line-height:1.45;padding-left:var(--s3);border-left:3px solid var(--gold)}
.se-on,.se-nt{display:block;color:var(--ink-2);font-size:var(--t-micro);margin-top:2px}
.se-p ul{margin:var(--s2) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.se-lbl{font-size:var(--t-sm);margin-top:var(--s3)}
.se-yes b{color:#1E5B34}
.se-no b{color:var(--ketchup-deep)}
.se-src{font-size:var(--t-micro);color:var(--ink-2);margin-top:var(--s3);line-height:1.6}
.se-prot{font-size:var(--t-sm);line-height:1.5;margin-top:var(--s2)}
.se-s1,.se-rd{font:400 var(--t-micro)/1 var(--mono);white-space:nowrap}
.se-rd{color:var(--ink-2)}
.se-cond{margin:var(--s2) 0 0 var(--s4);font-size:var(--t-sm);line-height:1.5;color:var(--ink-2)}
.se-cond li{margin-bottom:var(--s2)}
.se-adv{display:block;font-size:var(--t-micro);opacity:.85}
.se-ps{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--s4)}
@media(max-width:900px){.se-ps{grid-template-columns:1fr}}
.se-list{margin:var(--s4) 0 0 var(--s4);max-width:46em;line-height:1.55}
.se-list li{margin-bottom:var(--s3)}
.se-list b{color:var(--ink)}
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Where to Sell Pokemon Cards, and What Each Place Takes | Garbage Rips 585</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/selling.html">
<meta property="og:title" content="Where to sell Pokemon cards">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/selling.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-selling.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-selling.jpg">
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
    { "@type": "ListItem", position: 2, name: "Where to sell" },
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
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>Where to sell</span></nav>
      <h1>Where to <span class="hl">sell</span> your cards</h1>
      <p class="lede se-lede">Every other page here answers what a card is worth. This one answers where you turn
        that into money, and what each place takes on the way. ${venues.length} venues, and the fee figures were
        read off each company's own page rather than off anybody's blog: ${nSourced} are fully sourced and the rest
        say so.</p>
      <p class="lede se-lede">Prices and fees move. Every figure here carries the date it was read, and if you are
        about to sell something expensive, check the company's own page before you count on a number.</p>

      <nav class="se-jump" aria-label="Jump to a venue">
${GROUPS.map((g) => {
  const list = venues.filter((v) => groupOf(v) === g.key);
  return list.length
    ? `        <span class="se-jg">${esc(g.title)}</span>\n${list
        .map((v) => `        <a href="#${esc(v.id)}">${esc(v.name)}</a>`)
        .join("\n")}`
    : "";
}).filter(Boolean).join("\n")}
      </nav>

      <div class="se-key">
        <h2>The question that decides how much a sale can hurt you</h2>
        <p>${esc(safe.framing.question)} It is not which site you are on.</p>
        ${(safe.framing.why || []).map((w) => `<p>${esc(w)}</p>`).join("\n        ")}
      </div>
${(() => {
  // NOTHING ANYWHERE CHECKED THAT EVERY VENUE ACTUALLY REACHED THE PAGE. The
  // section loop filters by group, so a venue in no matching section is simply
  // absent, with a clean build and no error. The group value is validated above
  // and this counts the result anyway, because the two failures are different:
  // one catches a bad value, this catches a venue lost for any reason at all.
  const placed = GROUPS.reduce((n, g) => n + venues.filter((v) => groupOf(v) === g.key).length, 0);
  if (placed !== venues.length) {
    throw new Error(`selling.json: ${venues.length} venues but ${placed} rendered`);
  }
  return "";
})()}
${GROUPS.map((g) => {
  const list = venues.filter((v) => groupOf(v) === g.key);
  if (!list.length) return "";
  return `      <section class="se-grp">
        <h2>${esc(g.title)}</h2>
        <p>${esc(g.blurb)}</p>
        <div class="se-vs">
${list.map(venueCard).join("\n")}
        </div>
      </section>`;
}).filter(Boolean).join("\n")}

      <section class="se-grp">
        <h2>Who protects a <span class="hl">seller</span></h2>
        <p>Seller protection and buyer protection are different products, and on every venue below the seller's
          version is the smaller one. This is the part people find out about afterwards.</p>
        <div class="se-ps">
${(safe.protections || []).map(prot).join("\n")}
        </div>
      </section>

      <section class="se-grp">
        <h2>How it actually goes <span class="hl">wrong</span></h2>
        <p>Each of these is a mechanism rather than a type of person. Every one is defined by who controls the
          money at which moment.</p>
        <ol class="se-list">
${(safe.attacks || []).map((a) => `          <li><b>${esc(a.name)}.</b> ${esc(a.how)}${a.why ? ` ${esc(a.why)}` : ""}${a.note ? ` ${esc(a.note)}` : ""}${
            a.source ? ` <a class="se-s1" href="${esc(a.source)}" aria-label="Source for ${esc(a.name)}" rel="noopener" target="_blank">Source</a>${
              a.read ? ` <span class="se-rd">read ${esc(longDate(a.read))}</span>` : ""
            }` : ""
          }</li>`).join("\n")}
        </ol>
      </section>

      <section class="se-grp">
        <h2>What actually <span class="hl">defends</span> against it</h2>
        <ol class="se-list">
${(safe.defences || []).map((d) => `          <li><b>${esc(d.name)}.</b> ${esc(d.why || "")}${
            (d.thresholds || []).length ? ` ${d.thresholds.map(esc).join(" ")}` : ""
          }${
            d.source ? ` <a class="se-s1" href="${esc(d.source)}" aria-label="Source for ${esc(d.name)}" rel="noopener" target="_blank">Source</a>${
              d.read ? ` <span class="se-rd">read ${esc(longDate(d.read))}</span>` : ""
            }` : ""
          }</li>`).join("\n")}
        </ol>
      </section>

      <section class="se-grp">
        <h2>The <span class="hl">safest</span> way to sell is the one nobody expects</h2>
        <p class="se-lede">${esc(safe.inPerson.claim)}</p>
        <ul class="se-list">
${(safe.inPerson.because || []).map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
        <p class="se-lede" style="margin-top:var(--s4)"><b>What it costs you.</b> ${esc(safe.inPerson.cost)}</p>
        <p class="se-lede" style="margin-top:var(--s3)">${esc(safe.inPerson.ftc)}${
          safe.inPerson.source ? ` <a class="se-s1" href="${esc(safe.inPerson.source)}" aria-label="FTC guidance for sellers" rel="noopener" target="_blank">Source</a>${
            safe.inPerson.read ? ` <span class="se-rd">read ${esc(longDate(safe.inPerson.read))}</span>` : ""
          }` : ""
        }</p>
        <p class="se-lede" style="margin-top:var(--s3)"><b>Where the line actually is.</b> The risk in a local
          listing is not the venue, it is three things people do inside it.</p>
        <ul class="se-list">
${(safe.inPerson.whereTheLineIs || []).map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
        <p class="se-lede" style="margin-top:var(--s4)">This site already publishes where the counter-and-table
          venues are${shops ? `: <a href="/shops.html">${shops} shops around Rochester</a>` : ""}${
            shows ? ` and <a href="/card-shows.html">${shows} upcoming shows</a>` : ""
          }. A shop or a show is a busy public room with a proprietor in it, which removes most of the reason
          people are nervous about meeting a stranger.</p>
      </section>

      <p class="se-src" style="margin-top:var(--s6)">Fees read from each company's own pages${
        money.checked ? ` on ${esc(longDate(money.checked))}` : ""
      }. Seller protection and scam mechanics read${safe.checked ? ` on ${esc(longDate(safe.checked))}` : ""} from the
        platforms' own policies and from the FTC. Nothing here came from a comparison site. This is not financial
        advice and fees change, so check before you sell.</p>
    </div>
  </section>
</main>
${footer()}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/selling.html"), page);
console.log(`Wrote public/selling.html
  ${venues.length} venues (${nSourced} fully sourced), ${(safe.protections || []).length} protection policies,
  ${(safe.attacks || []).length} attacks, ${(safe.defences || []).length} defences`);
