#!/usr/bin/env node
// Build public/expansions.html: every Pokemon TCG set ever, oldest to newest.
//
//   node scripts/sync-expansions.mjs && node scripts/build-expansions.mjs
//
// This is the reference page. The Card Pokedex at /sets/ covers only the sets
// Tim has actually opened and always will, because those pages promise rips and
// chase card prices we can only have for sets we ripped. This one promises
// nothing but the list, so it can be complete: 174 sets, 1999 to now, in order,
// grouped by era.
//
// It is built as real tables on purpose. A table copies cleanly into Sheets or
// Excel with the columns intact, which a grid of styled divs does not, and
// people who want this list overwhelmingly want to paste it somewhere. There is
// also a button that copies the whole thing as tab separated text in one go.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { BAR, MENU, SPRITE, SKIP, STYLES, FONTS, footer } from "../shared/chrome.mjs";
import { esc, shortDate } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { sets, seriesOrder, syncedAt } = JSON.parse(
  await readFile(join(ROOT, "public/data/expansions.json"), "utf8")
);


const year = (iso) => (iso || "").slice(0, 4);
const slugId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * One line per era.
 *
 * Deliberately limited to what the era introduced and who published it, both
 * of which are matters of record. No pull rates, no "the best set ever", no
 * investment talk. Year ranges are computed from the data rather than typed,
 * so they cannot drift out of step with the list underneath them.
 */
const ERA_NOTE = {
  Base: "The original Wizards of the Coast run that started it all in English.",
  Gym: "Kanto gym leaders get their own cards, badges and all.",
  Neo: "Johto arrives, and with it baby Pokemon and the first Shining cards.",
  "E-Card": "Cards printed with dot code strips you could scan with the Nintendo e-Reader.",
  EX: "Nintendo takes over publishing and Pokemon-ex show up, powerful cards that give up two prizes.",
  NP: "Nintendo's promo cards, handed out rather than sold in packs.",
  POP: "Organised play kits from the Play! Pokemon programme, earned at events rather than bought.",
  "Diamond & Pearl": "Sinnoh, and Pokemon LV.X as the new top end.",
  Platinum: "Pokemon SP, and Arceus closing out the era.",
  "HeartGold & SoulSilver": "A return to Johto, with Pokemon Prime and the two card LEGEND Pokemon.",
  "Black & White": "Unova, full art trainers, and the return of Pokemon-EX.",
  XY: "Kalos, Mega Evolution on cardboard, and the BREAK mechanic.",
  "Sun & Moon": "Alola, GX attacks, and Tag Team pairs late in the run.",
  "Sword & Shield": "Galar, the V, VMAX and VSTAR ladder, and the era the hobby went mainstream again.",
  "Scarlet & Violet": "Paldea, ex returns in lowercase, and illustration rares become the cards everybody chases.",
  "Mega Evolution": "The current era. Mega ex, and the sets we are opening right now.",
  Other: "Promos, tie-ins and box sets that do not sit inside a main series.",
};

// Group, keeping the sync's oldest-first order inside each era.
const byEra = new Map(seriesOrder.map((s) => [s, []]));
for (const s of sets) byEra.get(s.series)?.push(s);

// Eras in the order their first set came out, which is how the page reads.
const eras = seriesOrder
  .map((name) => {
    const list = byEra.get(name) || [];
    return {
      name,
      id: slugId(name),
      list,
      from: year(list[0]?.released),
      to: year(list.at(-1)?.released),
      cards: list.reduce((n, s) => n + (s.total || 0), 0),
    };
  })
  .filter((e) => e.list.length);

const totalCards = sets.reduce((n, s) => n + (s.total || 0), 0);
const ripped = sets.filter((s) => s.slug);
const firstYear = year(sets[0].released);
const lastYear = year(sets.at(-1).released);

/** One era's table. */
function eraTable(e) {
  const rows = e.list
    .map((s) => {
      const secret = s.total && s.printedTotal && s.total > s.printedTotal ? s.total - s.printedTotal : 0;
      const cards = s.printedTotal
        ? `${s.printedTotal}${secret ? ` <span class="sec">+${secret}</span>` : ""}`
        : s.total || "";
      const name = s.slug
        ? `<a href="/sets/${s.slug}.html">${esc(s.name)}</a>`
        : esc(s.name);
      return `        <tr${s.slug ? ' class="mine"' : ""}>
          <th scope="row">
            <span class="xp-name">${
              s.symbol
                ? `<img src="${esc(s.symbol)}" alt="" width="20" height="20" loading="lazy" decoding="async">`
                : `<span class="xp-nosym" aria-hidden="true"></span>`
            }${name}${s.promo ? ` <span class="xp-tag">promo</span>` : ""}</span>
          </th>
          <td class="xp-date"><time datetime="${esc(s.released || "")}">${shortDate(s.released)}</time></td>
          <td class="xp-cards">${cards}</td>
          <td class="xp-rips">${
            s.slug && s.rips
              ? `<a href="/videos.html?set=${s.slug}">${s.rips} rip${s.rips === 1 ? "" : "s"}</a>`
              : `<span class="xp-none">&mdash;</span>`
          }</td>
        </tr>`;
    })
    .join("\n");

  return `<section class="xp-era" id="era-${e.id}">
  <div class="wrap">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>${
      e.from === e.to ? e.from : `${e.from} to ${e.to}`
    }</p>
    <h2>${esc(e.name)} <span class="xp-count">${e.list.length} set${e.list.length === 1 ? "" : "s"}</span></h2>
    ${ERA_NOTE[e.name] ? `<p class="xp-note">${esc(ERA_NOTE[e.name])}</p>` : ""}
    <div class="xp-scroll">
      <table class="xp-table">
        <caption class="sr-only">${esc(e.name)} sets, oldest first</caption>
        <thead>
          <tr><th scope="col">Set</th><th scope="col">Released</th><th scope="col">Cards</th><th scope="col">Our rips</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
  </div>
</section>`;
}

const style = `
.xp{padding:var(--s7) 0 var(--s5)}
.xp-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:40em;margin-bottom:var(--s5)}
.xp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-bottom:var(--s5)}
@media(max-width:640px){.xp-stats{grid-template-columns:repeat(2,1fr)}}
.xp-stat{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.xp-stat b{display:block;font:400 var(--t-l)/1 var(--display);margin-bottom:4px}
.xp-stat span{font:700 var(--t-micro)/1.3 var(--mono);color:var(--ink-2);
  letter-spacing:.06em;text-transform:uppercase}
.xp-jump{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:var(--s4)}
.xp-jump a{display:inline-flex;align-items:center;min-height:40px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.xp-jump a:hover{border-color:var(--ink);background:var(--mustard)}
.xp-copy{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 var(--s5);
  border:2px solid var(--ink);border-radius:var(--r-pill);background:var(--mustard);
  font:700 var(--t-body)/1 var(--body);box-shadow:var(--lift);cursor:pointer}
.xp-copy:hover{transform:translateY(-2px)}

.xp-era{padding:var(--s6) 0}
.xp-era:nth-of-type(even){background:var(--card-2,rgba(21,38,58,.03))}
.xp-era h2{font:400 var(--t-xl)/1.1 var(--display);margin-bottom:var(--s2)}
.xp-count{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.08em;
  text-transform:uppercase;vertical-align:middle;margin-left:8px}
.xp-note{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}

/* The table scrolls inside this, never the page. */
.xp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;
  border:1px solid var(--hair);border-radius:var(--r);background:var(--card)}
.xp-table{border-collapse:collapse;width:100%;min-width:520px;font-size:var(--t-sm)}
.xp-table th,.xp-table td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair);
  vertical-align:middle}
.xp-table tbody tr:last-child th,.xp-table tbody tr:last-child td{border-bottom:0}
.xp-table thead th{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink-2);background:var(--page);position:sticky;top:0;z-index:1}
.xp-table tbody tr:hover{background:var(--lilac-pale)}
.xp-table tbody th{font-weight:600}
.xp-name{display:flex;align-items:center;gap:10px}
.xp-name img{flex:none;width:20px;height:20px;object-fit:contain}
.xp-nosym{flex:none;width:20px;height:20px;border-radius:4px;background:var(--hair)}
.xp-table tr.mine th a{text-decoration:underline;text-decoration-color:var(--gold);
  text-underline-offset:3px;text-decoration-thickness:2px}
.xp-tag{font:700 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--plum);background:var(--lilac-pale);border-radius:var(--r-pill);padding:3px 6px}
.xp-date{white-space:nowrap;color:var(--ink-2);font-variant-numeric:tabular-nums}
.xp-cards{font-variant-numeric:tabular-nums;white-space:nowrap}
.xp-cards .sec{color:var(--ink-2);font-size:var(--t-micro)}
.xp-rips{white-space:nowrap}
.xp-rips a{font-weight:700;color:var(--ketchup-deep)}
.xp-rips a:hover{text-decoration:underline}
.xp-none{color:var(--steel,#9FB0C0)}
.xp-foot{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}
`;

const body = `
<main id="main">
  <section class="xp">
    <div class="wrap">
      <div class="brk"><h1>Every Pokemon TCG set, <span class="hl">in order</span></h1><span class="ln"></span></div>
      <p class="xp-lede">All ${sets.length} English sets from ${firstYear} to ${lastYear}, oldest first,
        grouped by era. Release dates and card counts come straight from the Pokemon TCG API.</p>

      <div class="xp-stats">
        <div class="xp-stat"><b>${sets.length}</b><span>sets</span></div>
        <div class="xp-stat"><b>${totalCards.toLocaleString("en-US")}</b><span>cards</span></div>
        <div class="xp-stat"><b>${eras.length}</b><span>eras</span></div>
        <div class="xp-stat"><b>${ripped.length}</b><span>we have ripped</span></div>
      </div>

      <nav class="xp-jump" aria-label="Jump to an era">
${eras.map((e) => `        <a href="#era-${e.id}">${esc(e.name)}</a>`).join("\n")}
      </nav>

      <button class="xp-copy" type="button" id="copyAll">Copy the whole list</button>
      <p class="xp-foot">Set names, release dates and card counts are from the Pokemon TCG API.
        Card counts show the printed set size, with secret rares beyond it listed separately.
        Underlined sets have a full guide on this site. Fan made reference. Not affiliated with
        The Pokemon Company or Nintendo.</p>
    </div>
  </section>

${eras.map(eraTable).join("\n\n")}
</main>

<script>
// Copy the list as tab separated text, which pastes straight into Sheets or
// Excel as four real columns. Built from the DOM rather than duplicated as a
// data blob, so the copy can never disagree with what is on screen.
document.getElementById("copyAll")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const clean = (el) => (el?.textContent || "").replace(/\\s+/g, " ").trim();
  const lines = ["Era\\tSet\\tType\\tReleased\\tCards\\tOur rips"];
  for (const sec of document.querySelectorAll(".xp-era")) {
    const era = clean(sec.querySelector("h2")?.firstChild);
    for (const tr of sec.querySelectorAll("tbody tr")) {
      const tag = tr.querySelector(".xp-tag");
      // Read the name without the promo pill, which sits inside the same cell
      // and would otherwise paste as part of the set's name.
      const name = clean(tr.querySelector(".xp-name a")) ||
        clean(tr.querySelector(".xp-name")).replace(/\\s*promo$/i, "");
      const rips = clean(tr.querySelector(".xp-rips"));
      lines.push([
        era,
        name,
        tag ? "Promo" : "Expansion",
        clean(tr.querySelector(".xp-date")),
        clean(tr.querySelector(".xp-cards")),
        rips === "\\u2014" ? "" : rips,
      ].join("\\t"));
    }
  }
  const text = lines.join("\\n");
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // The async clipboard needs a secure context and a trusted gesture, and it
    // is refused often enough that a fallback is worth having. Telling the user
    // to press Cmd C is not one: nothing is selected, so it copies nothing.
    // Selecting the text first is what makes that instruction true.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
  }
  btn.textContent = ok ? "Copied " + (lines.length - 1) + " sets" : "Could not copy, sorry";
  setTimeout(() => (btn.textContent = "Copy the whole list"), 2600);
});
</script>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Every Pokemon TCG Set in Order: All ${sets.length} Expansions ${firstYear} to ${lastYear} | Garbage Rips 585</title>
<meta name="description" content="The complete list of Pokemon TCG sets in release order, ${firstYear} to ${lastYear}. All ${sets.length} English expansions with release dates and card counts, grouped by era.">
<link rel="canonical" href="${SITE}/expansions.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#15263A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Every Pokemon TCG Set in Order">
<meta property="og:description" content="All ${sets.length} English Pokemon TCG expansions, ${firstYear} to ${lastYear}, with release dates and card counts.">
<meta property="og:url" content="${SITE}/expansions.html">
<meta property="og:image" content="${SITE}/assets/og-expansions.jpg">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Pokemon TCG sets in release order, ${firstYear} to ${lastYear}`,
    description: `Release dates and card counts for all ${sets.length} English Pokemon Trading Card Game sets.`,
    url: `${SITE}/expansions.html`,
    dateModified: syncedAt,
    creator: { "@type": "Organization", name: "Garbage Rips 585", url: `${SITE}/` },
    isAccessibleForFree: true,
    temporalCoverage: `${firstYear}/${lastYear}`,
  },
  null,
  2
)}
</script>
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${footer(
  `Set data from the Pokemon TCG API, last checked ${syncedAt}.`
)}

<script src="/assets/app.js" defer></script>
</body>
</html>
`;

await writeFile(join(ROOT, "public/expansions.html"), html);

console.log(`Wrote public/expansions.html
  ${sets.length} sets, ${eras.length} eras, ${firstYear} to ${lastYear}
  ${ripped.length} link through to a set guide
  ${(html.length / 1024).toFixed(0)} KB`);
