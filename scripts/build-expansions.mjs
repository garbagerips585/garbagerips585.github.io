#!/usr/bin/env node
// Build public/expansions.html: every Pokemon TCG set ever, oldest to newest.
//
//   node scripts/sync-expansions.mjs && node scripts/build-expansions.mjs
//
// This is the reference page. The Card Pokedex at /sets/ covers only the sets
// the owner has actually opened and always will, because those pages promise rips and
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
import { esc, shortDate, longDate, noValue } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { sets, seriesOrder, syncedAt } = JSON.parse(
  await readFile(join(ROOT, "public/data/expansions.json"), "utf8")
);

// RIP COUNTS ARE COMPUTED HERE, NOT READ FROM THE SNAPSHOT.
//
// expansions.json carries a `rips` field written when it was last synced, and
// it went stale the moment the tag rules changed. It still said 151 had 5 rips
// after the taxonomy fix cut that to 1, and disagreed with the home page and
// the set guides on eight sets at once. Those pages count from videos.json on
// every build; this one now does the same, so the three cannot drift again.
const { videos: allVideos } = JSON.parse(
  await readFile(join(ROOT, "public/data/videos.json"), "utf8")
);
const ripsBySet = {};
for (const v of allVideos) for (const sid of v.sets || []) ripsBySet[sid] = (ripsBySet[sid] || 0) + 1;

/**
 * The slug to look a row's rips up under.
 *
 * A ROW'S `slug` IS ONLY SET WHERE THE SITE HAS A SET GUIDE, and rips do not
 * need one. 28 of the 174 rows carry a slug; the other 146 are sets with no
 * guide, and TWO OF THOSE HAVE BEEN RIPPED ON CAMERA. So Silver Tempest and
 * Lost Origin printed "None" in the Our rips column while /luck.html counted
 * "2 over 2 rips" and "1 over 1 rip" for the same two sets and /hall.html
 * showed four cards pulled out of them, including a Silver Tempest Trainer
 * Gallery Corviknight V at rank 11. Three pages, one fact, two answers.
 *
 * Found by a content audit on 24 August 2026, the day after launch. The header
 * above this block says the three pages "cannot drift again" because they all
 * count from videos.json; they do, and they still disagreed, because this page
 * was asking the question with a key that is null for 84% of its own rows.
 *
 * The fallback is deliberately narrow: a slugified name is used ONLY when it
 * is already a real tag in videos.json, so it can never invent a link to a
 * filter that would come back empty. Measured on the built tree, it changes
 * exactly two rows.
 */
const ripSlug = (row) => {
  if (row.slug) return row.slug;
  const guess = String(row.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return guess && ripsBySet[guess] ? guess : null;
};

/* --------------------------------------------------------- the companion sets
 *
 * THREE ROWS ON THIS TABLE ARE NOT SETS YOU CAN BUY, and until 19 August 2026
 * nothing on the page said so. Shining Fates Shiny Vault, Crown Zenith Galarian
 * Gallery and Celebrations: Classic Collection each sit directly under their
 * parent, sharing its release date, with a card count, no rips and no link, so
 * they read as two separate products released on the same day.
 *
 * The guides had the matching half of this bug and it was the worse half: they
 * priced the parent's checklist and never mentioned the companion, so
 * /sets/shining-fates.html called an $11.35 Skyla the set's chase card. The
 * fix there is in build-set-pages.mjs. This is the same fact in the other place
 * a reader meets these names, and it comes out of the same file so the two
 * cannot end up describing the relationship differently.
 *
 * KEYED BY apiId, NOT BY NAME. data/companion-sets.json is keyed by our set
 * slug, because that is what a guide has; this page has neither a slug nor a
 * guide for most of its 174 rows, and it does have an apiId for every one.
 */
let companionByApiId = new Map();
try {
  const doc = JSON.parse(await readFile(join(ROOT, "data/companion-sets.json"), "utf8"));
  const byApiId = new Map(sets.map((s) => [s.apiId, s]));
  // The three with a guide, keyed by our slug there because that is what a
  // guide has, and re-keyed by apiId here because that is what a row has.
  for (const [parentSlug, c] of Object.entries(doc.sets || {})) {
    const parent = sets.find((x) => x.slug === parentSlug);
    companionByApiId.set(c.apiId, { parentName: parent?.name, parentSlug, parentPresent: Boolean(parent) });
  }
  // ALL EIGHT OR NONE. Tagging three subset rows and leaving five identical
  // ones bare teaches a reader the wrong thing about the five, and it teaches
  // it more firmly than saying nothing did: an Astral Radiance Trainer Gallery
  // row with no tag, two rows under a Galarian Gallery row that has one, reads
  // as a set that stands alone rather than as one nobody got round to.
  for (const [apiId, c] of Object.entries(doc.noGuide || {})) {
    const parent = byApiId.get(c.parentApiId);
    companionByApiId.set(apiId, { parentName: parent?.name, parentSlug: null, parentPresent: Boolean(parent) });
  }
  const bad = [];
  for (const [apiId, c] of companionByApiId) {
    if (!byApiId.has(apiId)) bad.push(`${apiId} is not a row in public/data/expansions.json`);
    if (!c.parentPresent) bad.push(`${apiId}: its parent is not a row on this page, so the tag would name nothing`);
  }
  if (bad.length) {
    throw new Error(
      "data/companion-sets.json does not line up with public/data/expansions.json, and every " +
        "line it writes says which set a row belongs to, so a wrong one is worse than none:\n  " +
        bad.join("\n  ")
    );
  }
} catch (err) {
  if (err instanceof SyntaxError || /does not line up/.test(err.message)) throw err;
  /* file absent: every row renders exactly as it did before it existed */
}

/* ---------------------------------------------------- the single-rip shortcut
 *
 * WHERE A SET HAS EXACTLY ONE RIP, THE CELL LINKS THE RIP.
 *
 * The rips cell has always read "N rips" and pointed at /videos.html filtered
 * by that set, which is the right destination for a number: a reader asked for
 * fifty-four Chaos Rising rips wants the list. It is the WRONG destination for
 * ONE. "1 rip" led to an index page holding a single tile, so the shortest
 * route from this table to the only video it is describing was two taps
 * through a page whose entire content was that video's thumbnail.
 *
 * Fifteen of the thirty-five sets tagged on a video have exactly one, and they
 * are the imported Japanese, Korean and Chinese sets plus the old English ones
 * opened once, which is to say the rows a curious reader is most likely to
 * stop on. Nothing else about the cell changes and no row gains a link that
 * did not have one.
 *
 * NOT EXTENDED TO TWO. "2 rips" pointing at one of them would be picking a
 * favourite and hiding the other, and there is no honest label for that.
 */
const soleRipBySet = {};
for (const [sid, n] of Object.entries(ripsBySet)) {
  if (n !== 1) continue;
  const v = allVideos.find((x) => (x.sets || []).includes(sid));
  if (v?.path) soleRipBySet[sid] = v;
}

// THE SET SYMBOLS ARE MIRRORED LOCALLY. Measured over CDP at 390x844 DPR2 with
// the cache disabled and every lazy image forced to load, this page transferred
// 2,604.9 KB of images and 2,183 KB of that was 174 symbol pngs painted into a
// 20px box. The API ships base1 at 884x452 and most of the legacy sets at
// 500x500; the newer ones were already small, which is why the weight is spread
// across the page instead of sitting in one obvious file.
//
// scripts/sync-symbols.mjs fits each one inside a 48px box as lossless WebP and
// records its real size in data/symbol-dims.json. A set that is not in the
// manifest keeps the remote url it has always had, so a symbol that would not
// download degrades to today's behaviour rather than to a broken image.
let SYMBOL_DIMS = {};
try {
  SYMBOL_DIMS = JSON.parse(await readFile(join(ROOT, "data/symbol-dims.json"), "utf8")).symbols || {};
} catch {
  /* not synced yet: every symbol falls back to its remote url */
}
let remoteSymbols = 0;

/**
 * The <img> for one set symbol.
 *
 * Both the local and the remote branch carry width and height. The CSS pins
 * the box at 20px with object-fit:contain either way, so these are about the
 * aspect ratio rather than the size, and they are the file's REAL shape: base1
 * is 48x25, not 48x48, and the old markup declared 20x20 for every one of them.
 */
function symbolImg(s) {
  const d = SYMBOL_DIMS[s.apiId];
  if (d) {
    return `<img src="/assets/symbols/${esc(s.apiId)}-pokemon-tcg-set-symbol.webp" alt="" width="${d[0]}" height="${d[1]}" loading="lazy" decoding="async">`;
  }
  remoteSymbols += 1;
  return `<img src="${esc(s.symbol)}" alt="" width="20" height="20" loading="lazy" onerror="this.remove()" decoding="async">`;
}


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
  POP: "Organized Play kits from the Play! Pokemon program, earned at events rather than bought.",
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

/**
 * An era that has a guide of its own, as [href, label].
 *
 * SEPARATE FROM ERA_NOTE BECAUSE ERA_NOTE IS ESCAPED, and it has to stay that
 * way: those strings are prose and an anchor smuggled into one would be printed
 * as text on the day somebody adds a set name with an ampersand in it. So the
 * link is its own field with its own element.
 *
 * ONE ENTRY, AND THAT IS THE BAR. This is not a slot for every page that
 * mentions an era. The Base row lists a set whose three print runs are worth
 * ten times apart and whose table above says nothing about that at all: a reader
 * looking up Base Set here is holding a 1999 card and has the wrong question
 * answered. Nothing else on this page has that problem.
 */
const ERA_GUIDE = {
  Base: ["/base-set.html", "1st Edition, Shadowless or Unlimited? Telling the 1999 Base Set printings apart"],
};

/**
 * HOW MANY CARDS ONE ROW IS SAYING, AND WHY IT IS A FUNCTION.
 *
 * The headline tile read 20,460 while its own 174 rows added up to 20,482, a
 * gap of 22 that a reader could find with a calculator on the same screen.
 * The cause was two different sums of two different fields: the tile summed
 * `total` and the rows printed `printedTotal` with a "+N" secret tail bolted
 * on only when `total > printedTotal`. Both are now this one function, called
 * once for the number and once for the markup, so they cannot diverge again.
 *
 * THE 22 IS TWO ROWS AND IT IS DATA RATHER THAN A PARSE BUG. Both come
 * straight off api.pokemontcg.io in sync-expansions.mjs, unmodified:
 *
 *     SWSH Black Star Promos              total 304   printedTotal 307   +3
 *     Scarlet & Violet Black Star Promos  total 196   printedTotal 215   +19
 *
 * Everywhere else on this page `total` is the larger number, because a set
 * prints secret rares numbered past the count on the card, so 82/81 is one
 * printed total of 81 and a total of 82. These two invert it, and the reason is
 * that a Black Star Promos set is OPEN ENDED. It has no print run and no end:
 * cards are added to it for years, numbered SWSH001 upward, so `printedTotal`
 * is the highest number issued so far and `total` is how many card records the
 * API actually holds. The API is behind its own numbering by 3 and 19. That is
 * a gap in one catalogue's coverage of an unfinished set, not a set with
 * negative secret rares, and it will move again next time either side updates.
 *
 * SO THE PRINTED NUMBER WINS AND THE ROW SAYS WHY. `printedTotal` is what is
 * on the cards, which is the thing a reader holding one can check; `total` is
 * one API's record count. Taking the larger of the two would silently pick a
 * different field per row, and dropping the two rows would delete 500 real
 * cards from a page that calls itself complete. So the count is the printed
 * one, the two promo rows carry a visible marker saying the catalogue lists
 * fewer than the numbering reaches, and the tile sums exactly what the column
 * shows. That is why the tile now reads 20,482 rather than 20,460: the old
 * figure was 22 cards short of the page's own rows.
 *
 * Returns { n, html }: `n` is what the tile adds up, `html` is the cell.
 */
function cardCount(s) {
  const total = s.total || 0;
  const printed = s.printedTotal || 0;

  // No printed total at all: the API's record count is the only figure there is.
  if (!printed) return { n: total, html: total ? String(total) : "" };

  // The ordinary case, 155 of the 174 rows: secret rares numbered past the
  // printed total, so the row reads "82 +1" and counts 83.
  if (total > printed) {
    const secret = total - printed;
    return {
      n: total,
      html: `${printed} <span class="sec">+${secret}</span><span class="sr-only">, plus ${secret} secret ${
        secret === 1 ? "card" : "cards"
      } numbered past the printed total</span>`,
    };
  }

  // The two open-ended promo sets. The numbering has run past what the API
  // lists, so the count is the numbering and the shortfall is named.
  if (total && total < printed) {
    const gap = printed - total;
    return {
      n: printed,
      // "3 unlisted" AND NOT "-3", WHICH WAS THE FIRST ATTEMPT AND WAS WORSE
      // THAN THE BUG. The "+N" beside every other row is an ADDEND: a reader
      // adding the column reads "82 +1" as 83, which is what the tile counts. A
      // minus sign in the same column reads the same way and subtracts, so
      // "307 -3" made the rendered column total 20,460, which is exactly the
      // wrong figure this whole fix exists to retire. The gap is not an operand
      // on 307, it is a note ABOUT 307, so it is worded as one. Checked by
      // summing the rendered column both ways off the built DOM.
      html: `${printed} <span class="sec">${gap} unlisted</span><span class="sr-only">, of which ${gap} ${
        gap === 1 ? "is" : "are"
      } numbered but not yet in the Pokemon TCG API's card list, because this set is still open</span>`,
    };
  }

  return { n: printed, html: String(printed) };
}

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
      cards: list.reduce((n, s) => n + cardCount(s).n, 0),
    };
  })
  .filter((e) => e.list.length);

// SUMMED THROUGH cardCount() SO THE TILE CANNOT DISAGREE WITH THE COLUMN. It
// summed `total` while the rows printed `printedTotal (+secret)`, and the two
// promo rows described in cardCount() made that a visible 22 card gap: tile
// 20,460, rows 20,482. The assertion below is not decoration. It is the only
// thing standing between this page and the same bug the next time somebody
// changes what a cell shows without changing what the tile adds.
const totalCards = sets.reduce((n, s) => n + cardCount(s).n, 0);
const openEnded = sets.filter((s) => s.total && s.printedTotal && s.printedTotal > s.total);
const eraSum = eras.reduce((n, e) => n + e.cards, 0);
if (eraSum !== totalCards) {
  throw new Error(
    `expansions: the era subtotals add up to ${eraSum} and the headline tile says ${totalCards}. ` +
      `Both go through cardCount(), so one of them is no longer summing every row.`
  );
}
const ripped = sets.filter((s) => s.slug);
const firstYear = year(sets[0].released);
const lastYear = year(sets.at(-1).released);

/** One era's table. */
function eraTable(e) {
  const rows = e.list
    .map((s) => {
      const cc = cardCount(s);
      const name = s.slug
        ? `<a href="/sets/${s.slug}.html">${esc(s.name)}</a>`
        : esc(s.name);
      const comp = companionByApiId.get(s.apiId);
      return `        <tr${s.slug ? ' class="mine"' : ""}>
          <th scope="row">
            ${/* THE NAME IS WRAPPED IN ITS OWN SPAN so that the copy button can
                  take it without the pills beside it. It used to read the cell
                  and strip a trailing "promo" with an expression, which worked
                  only while "promo" was the one thing that could follow a name.
                  A second pill would have pasted a sentence into the Set column
                  of somebody's spreadsheet, which is a bug you find a week
                  later in a file you no longer have. */ ""}<span class="xp-name${comp ? " xp-name-sub" : ""}">${
              s.symbol
                ? symbolImg(s)
                : `<span class="xp-nosym" aria-hidden="true"></span>`
            }<span class="xp-n">${name}</span>${s.promo ? ` <span class="xp-tag">promo</span>` : ""}${
              comp
                ? ` <span class="xp-sub">part of ${
                    comp.parentSlug
                      ? `<a href="/sets/${esc(comp.parentSlug)}.html">${esc(comp.parentName)}</a>`
                      : esc(comp.parentName)
                  }</span>`
                : ""
            }</span>
          </th>
          <td class="xp-date"><time datetime="${esc(s.released || "")}">${shortDate(s.released)}</time></td>
          ${/* data-cards CARRIES THE PLAIN NUMBER FOR THE COPY BUTTON. That
                script reads textContent, so the .sr-only explanation added to
                this cell would otherwise paste a sentence into a spreadsheet
                column of integers. The attribute is written from the same
                cardCount() the tile sums, so a copied list, the column and the
                headline are one number in three places. */ ""}<td class="xp-cards" data-cards="${cc.n}">${cc.html}</td>
          <td class="xp-rips">${(() => {
            const rs = ripSlug(s);
            if (rs && soleRipBySet[rs]) return `<a href="/${esc(soleRipBySet[rs].path)}">1 rip</a>`;
            if (rs && ripsBySet[rs]) {
              return `<a href="/videos.html?set=${esc(rs)}">${ripsBySet[rs]} rip${ripsBySet[rs] === 1 ? "" : "s"}</a>`;
            }
            return noValue("None", "xp-none");
          })()}</td>
        </tr>`;
    })
    .join("\n");

  // The era heading, its date range and its blurb are wrapped in .xp-era-head
  // so that a desktop can put them BESIDE the table instead of above it. The
  // wrapper is inert until the min-width rule in `style` turns .xp-era-in into
  // a grid, and it exists as an element rather than as three grid-column
  // assignments because ERA_NOTE is optional: three of the seventeen eras have
  // no blurb, so a rule that placed each child by hand would have to cope with
  // a row that is sometimes there and sometimes not.
  return `<section class="xp-era" id="era-${e.id}">
  <div class="wrap xp-era-in">
    <div class="xp-era-head">
    <p class="sec-label"><svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>${
      e.from === e.to ? e.from : `${e.from} to ${e.to}`
    }</p>
    <h2>${esc(e.name)} <span class="xp-count">${e.list.length} set${e.list.length === 1 ? "" : "s"}</span></h2>
    ${ERA_NOTE[e.name] ? `<p class="xp-note">${esc(ERA_NOTE[e.name])}</p>` : ""}
    ${
      ERA_GUIDE[e.name]
        ? `<p class="xp-note"><a href="${esc(ERA_GUIDE[e.name][0])}">${esc(ERA_GUIDE[e.name][1])}</a></p>`
        : ""
    }
    </div>
    <!-- tabindex="0" AND role/aria-label, because an overflowing box a keyboard
         cannot reach is content a keyboard cannot read.
         The table is min-width:520px inside a 366px box on a phone: 156px, about
         a quarter of every row, is off to the right. A mouse or a thumb drags
         it. A keyboard can only scroll a box by focusing it, and these are the
         tables with NOTHING focusable inside: the early eras have no set guide
         and no rips, so there is not one link in them to tab to. Chrome 127
         added implicit focus for scrollers with no focusable children and hides
         the problem there; Firefox and Safari do not, and on those the hidden
         quarter of the oldest tables was unreachable without a mouse.
         A focusable region announces as an unlabelled group without a name, so
         role="region" + aria-label, worded like the caption. -->
    <div class="xp-scroll" tabindex="0" role="region" aria-label="${esc(e.name)} sets, scrollable table">
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

// COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. Same trade
// build-css.mjs makes for ui.css and miniCSS makes in build-set-pages.mjs, and
// the same regex: comments, plus the indentation between rules. Nothing else.
//
// It is here because this block is inline in a render blocking <head> and the
// desktop rules added on 16 August 2026 came with the measurements that justify
// them written alongside. Measured on this page set, those comments were 17.1KB
// raw and 7.1KB gzipped across eight pages, up to 13% of one of them. Stripped,
// every one of these pages is smaller than it was before the rules were added.
const miniCSS = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

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
/* min-height 44, not 40. WCAG 2.5.5 asks for 44x44 and these chips are the
   page's primary navigation on a phone: they are the only way to reach a
   section without scrolling the whole article. Measured 40px before this, so
   they already cleared 2.5.8's 24px AA floor -- this is the AAA target, taken
   because a one-handed reader thumbing down the page hits these first.
   THE GAP IS UNTOUCHED AND HAS TO STAY THAT WAY: the parent sets gap:8px,
   which is row AND column gap, so growing the box does not close the 8px
   between two chips or between two wrapped rows. Re-measured after: 44px tall,
   still 8px apart in both axes. */
.xp-jump a{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--s3);
  border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--card);
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.05em;text-transform:uppercase}
.xp-jump a:hover{border-color:var(--ink);background:var(--mustard);color:var(--on-accent)}
/* color:var(--on-accent) IS NOT OPTIONAL ON A --mustard FILL, AND THIS WAS THE
   ONE PLACE IT WAS MISSING. A button with no color declaration inherits the user
   agent's own, which is white, and --mustard is a light teal since the palette
   swap -- so this button shipped white-on-light-blue at 2.26:1 against the 4.5
   it needs at 16px bold. Measured by sampling the rendered pixels, not computed
   from the tokens. Every one of the other 41 --mustard background rules in this
   repo already pairs the token with --on-accent; .xp-jump a:hover does it on the
   line directly above. #231F20 on #70B5D9 is 7.22:1. */
.xp-copy{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 var(--s5);
  border:2px solid var(--ink);border-radius:var(--r-pill);background:var(--mustard);
  color:var(--on-accent);
  font:700 var(--t-body)/1 var(--body);box-shadow:var(--lift);cursor:pointer}
.xp-copy:hover{transform:translateY(-2px)}

.xp-era{padding:var(--s6) 0}
/* A PALETTE HID IN A var() FALLBACK. --card-2 is defined nowhere, so what
   actually painted these 17 tables was the FALLBACK: rgba(21,38,58,.03), the
   old navy ink at 3%. A token swap cannot reach that, and a grep for the
   palette will not find it either, because the value is not a palette colour,
   it is a palette colour with an alpha on it. Neutral now, and INVERTED for
   the dark palette: 3% black on a dark ground is nothing at all, so the
   alternating band is a white wash instead. Same 17 tables, same idea. */
.xp-era:nth-of-type(even){background:var(--card-2,rgba(255,255,255,.05))}
.xp-era h2{font:400 var(--t-xl)/1.1 var(--display);margin-bottom:var(--s2)}
.xp-count{font:700 var(--t-micro)/1 var(--mono);color:var(--ink-2);letter-spacing:.08em;
  text-transform:uppercase;vertical-align:middle;margin-left:8px}
.xp-note{color:var(--ink-2);max-width:44em;margin-bottom:var(--s4)}

/* The table scrolls inside this, never the page. */
.xp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;
  border:1px solid var(--hair);border-radius:var(--r);background-color:var(--card)}
/* background-COLOR, not the shorthand: ui.css paints a four layer scroll
   affordance on this class, and the background shorthand resets
   background-image, which would silently wipe all four layers. */
.xp-table{border-collapse:collapse;width:100%;min-width:520px;font-size:var(--t-sm)}
.xp-table th,.xp-table td{text-align:left;padding:10px var(--s3);border-bottom:1px solid var(--hair);
  vertical-align:middle}
.xp-table tbody tr:last-child th,.xp-table tbody tr:last-child td{border-bottom:0}
/* THREE STATES ON THIS TABLE ALL COLLAPSED TO INVISIBLE IN THE REPAINT, and
   none of them looked broken, which is why they are worth a note this long.
   The palette folded several tokens onto the same value: --card, --paper-2 and
   --on-alert are all #FFFFFF, and --page, --paper, --sky-lite, --sky-tint and
   --lilac-pale are within 1.08:1 of each other. Any rule that told two states
   apart by picking two of those is now a no-op, and reaching for a different
   one of the five does not help.

   THE STICKY HEADER was --page on a white body, 1.05:1, floating over 68 rows
   of content with no edge. It is the ink chrome now, which is the palette's own
   answer to "this bar sits above the content", and it needs no border to hold
   its shape while it moves. */
.xp-table thead th{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.08em;
  text-transform:uppercase;color:var(--chrome-dim);background:var(--chrome-bg);
  position:sticky;top:0;z-index:1}
/* HOVER was --lilac-pale on white, 1.13:1. It was a lilac tint on cream before
   the repaint and is an off-white on white now. --paper-3 is the palette's only
   ground that is actually distinguishable from the card, at 1.19:1, so the gold
   rule on the left does the work and the tint only supports it. Hover only, so
   nothing here is the sole carrier of any meaning. */
/* --navy-deep, not --paper-3: same inversion as .cc-table in ui.css, where the
   repaint left --paper-3 lighter than the stripes it was chosen to sit under.
   It also put .xp-rips a (--ketchup-deep) at 3.60:1; on --navy-deep it is
   8.07:1 and the hover is finally darker than either stripe. */
.xp-table tbody tr:hover{background:var(--navy-deep)}
.xp-table tbody tr:hover th{box-shadow:inset 3px 0 0 var(--gold)}
.xp-table tbody th{font-weight:600}
.xp-name{display:flex;align-items:center;gap:10px}
.xp-name img{flex:none;width:20px;height:20px;object-fit:contain}
.xp-nosym{flex:none;width:20px;height:20px;border-radius:4px;background:var(--hair)}
/* "WE HAVE OPENED THIS SET" was #FFFFFF on #FFFFFF, 1.00:1, and the gold
   underline on the link was the entire surviving marker. That underline also
   reads as an ordinary link style, so the row was saying nothing.
   A GOLD RULE DOWN THE ROW, not a tint. A tint cannot work here: every ground
   in this palette that is light enough to keep the text legible is within
   1.19:1 of the card, and this marker has to survive next to the hover tint
   rather than be replaced by it. The rule is 4px of the site's accent against
   the row's own edge, it is visible at any zoom, and it does not move when the
   row is hovered.
   THE COLOUR IS NOT ALONE. .xp-rips already prints "12 rips" as a link in that
   same row and the no-value cell says "None" to a screen reader, so the mark is
   a second, faster reading of something the row already states in words. */
.xp-table tr.mine th{box-shadow:inset 4px 0 0 var(--gold)}
.xp-table tr.mine:hover th{box-shadow:inset 4px 0 0 var(--gold)}
.xp-table tr.mine th a{text-decoration:underline;text-decoration-color:var(--gold);
  text-underline-offset:3px;text-decoration-thickness:2px}
/* --plum on --lilac-pale was a purple chip on a cream site and is now a grey
   chip on an off-white one, 1.08:1 against the card. Ink on --paper-3 with a
   hairline is the palette's chip and it is the same one .bmk uses on
   /buying.html, so the two pages agree about what a chip looks like. */
.xp-tag{font:700 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink);background:var(--paper-3);border:1px solid var(--hair);
  border-radius:var(--r-pill);padding:3px 6px}
/* THE COMPANION POINTER. Three rows on this table are a subset of the row
   above them and nothing said so, so they read as two products released the
   same day. It wraps to its own line rather than pushing the name, because the
   name is the column and this is a footnote to it: .xp-name is a flex row and
   flex-basis:100% on this child is what puts it underneath without touching
   the 171 rows that do not have one.
   THE LINK IS THE SMALL TEAL, not the pink .xp-rips uses two rules down. This
   is 9px, which is exactly the case --gold-deep exists for, and it is a route
   to another page rather than a mark that goes nowhere. */
.xp-sub{flex-basis:100%;font:700 9px/1.3 var(--mono);letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-2)}
/* --ink, NOT --gold-deep. Measured 4.499:1 against the 4.5 this needs -- a
   hair under, at 9px, which is the smallest text on the page. --gold-deep is
   4.50:1 on this ground by arithmetic and lands under it once the real pixels
   are sampled, so it was never passing with anything to spare. --ink is 6.70:1.
   The underline stays and is what marks it as a link, which is the rule
   anyway: colour alone is never allowed to be the only signal. */
.xp-sub a{color:var(--ink);text-decoration:underline;text-underline-offset:2px}
/* THE WRAP IS ON A SECOND CLASS, NOT ON .xp-name, and that is not fussiness.
   .xp-name is a nowrap flex row today, so its content width is part of what
   sets this table's minimum width at 390. Letting all 174 of them wrap could
   make the table narrower and relay every column on a phone, to fix three rows.
   This class is emitted only on the three that carry an .xp-sub. */
.xp-name-sub{flex-wrap:wrap;row-gap:3px}
/* KEEP THE NAME BESIDE THE SYMBOL. The moment .xp-name-sub above is allowed to
   wrap, the two longest of the eight, "Celebrations: Classic Collection" and
   "Astral Radiance Trainer Gallery", go over the width left in the cell and
   wrap WHOLE, leaving the 20px set symbol alone on the line above them and
   reading as a layout fault.
   THE BASIS IS 0, NOT auto, and that is the whole rule. At auto the item asks
   for its own content width first and still wraps as a block; at 0 it takes
   what is left of the row and wraps its own text inside it, which is what the
   four long names on this table did before any of this and what the 166 rows
   around them still do. min-width:0 is the other half: a flex item will not
   shrink below its longest word without it. Measured at 390 against HEAD's own
   build of this page: same two names, same two lines each. */
.xp-name-sub .xp-n{flex:1 1 0;min-width:0}
.xp-date{white-space:nowrap;color:var(--ink-2);font-variant-numeric:tabular-nums}
.xp-cards{font-variant-numeric:tabular-nums;white-space:nowrap}
.xp-cards .sec{color:var(--ink-2);font-size:var(--t-micro)}
.xp-rips{white-space:nowrap}
.xp-rips a{font-weight:700;color:var(--ketchup-deep)}
.xp-rips a:hover{text-decoration:underline}
/* --steel is not a token this stylesheet defines, so this always fell through
   to the #9FB0C0 literal: 2.22:1 on the white table, the worst contrast
   measured anywhere on the site. It is the em dash standing in for "no rips",
   which is information, not decoration. --ink-2 is the secondary text colour
   already used two rules up in .xp-cards .sec, and measures 5.27:1 on white. */
.xp-none{color:var(--ink-2)}
.xp-foot{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}

/* DESKTOP. Every rule below is min-width, so nothing a phone or a tablet
   renders changed: measured identical at 390 before and after.

   WHAT WAS WRONG, MEASURED AT 1440. Seventeen era tables, one under the other,
   each 1,392px wide and each holding four short columns: a set name, a date, a
   card count and a rip count. The set column took the whole remainder, 520px,
   to hold "Neo Genesis", and the page ran 17,574px. Nobody had looked at this
   above 820px, which is the same diagnosis the home page got on 16 August 2026.

   The fix is not a wider table, it is a shorter page. The era heading, its date
   range and its blurb move BESIDE the table rather than above it, which is
   about 110px back per era, and the table stops stretching, which pulls the
   date, card and rip columns back next to the names they belong to.

   300px for the head column is chosen against the content: the longest era name
   is "HeartGold & SoulSilver" and it sets on two lines at 300px with the
   display face at --t-xl. Do not narrow it without re-checking that one. */
@media(min-width:1200px){
  .xp-era-in{display:grid;grid-template-columns:300px minmax(0,1fr);
    gap:var(--s6);align-items:start}
  /* The head is short and the table is long, so the heading would otherwise sit
     alone at the top of a 900px tall row. Sticky keeps the era name next to
     whichever row of it you are reading. top is the sticky nav's height plus a
     little air; the table's own thead is sticky at top:0 inside its scroller
     and the two do not interact, because they are in different scroll boxes. */
  .xp-era-head{position:sticky;top:96px}
  .xp-note{margin-bottom:0}
}
/* At 1600 and beyond the table is wide enough that the set column starts to
   spread again, so pin the three data columns and let the names keep the rest.
   These are content widths: "September 22, 2023" is the longest date and the
   rips cell holds "12 rips" at most. The longest COUNT used to be "20,460",
   which was the headline tile rather than anything in this column; the widest
   cell is now "307 3 unlisted" on the two open-ended promo rows, and 140px
   holds it because the note sets at --t-micro. Re-check that cell, not the
   tile, before narrowing this. */
@media(min-width:1600px){
  .xp-table thead th:nth-child(2){width:180px}
  .xp-table thead th:nth-child(3){width:140px}
  .xp-table thead th:nth-child(4){width:140px}
}
`;

const body = `
<main id="main" tabindex="-1">
  <section class="xp">
    <div class="wrap">
      <div class="brk"><h1>Every Pokemon TCG set, <span class="hl">in order</span></h1><span class="ln"></span></div>
      <p class="xp-lede">All ${sets.length} English sets from ${firstYear} to ${lastYear}, oldest first,
        grouped by era. Release dates and card counts come straight from the Pokemon TCG API.</p>

      <div class="xp-stats">
        <div class="xp-stat"><b>${sets.length}</b><span>sets</span></div>
        <div class="xp-stat"><b>${totalCards.toLocaleString("en-US")}</b><span>cards</span></div>
        <div class="xp-stat"><b>${eras.length}</b><span>eras</span></div>
${/* "with a full guide", NOT "we have ripped". `ripped` is sets that have a slug,
      which means a guide page, and eight of those have no rip on them at all.
      The label said 23 while the tables below showed 17 sets with a rip count,
      on the same screen.

      "OF THESE" IS LOAD BEARING. This page lists the 174 ENGLISH sets the
      Pokemon TCG API knows about, and the site also publishes guides for
      Japanese and Korean sets that are on no row here, so the site-wide count
      in the nav is larger than this number and always will be. A bare "with a
      full guide" on the page that calls itself the complete index invites a
      reader to take it as the site total, and it was read that way while it
      said 23 against the nav's 41. It is now ${ripped.length} because
      sync-expansions.mjs joins public/data/sets.json, which had gained five
      Sword & Shield sets that this file was synced before. */ ""}        <div class="xp-stat"><b>${ripped.length}</b><span>of these have a guide</span></div>
      </div>

      <nav class="xp-jump" aria-label="Jump to an era">
${eras.map((e) => `        <a href="#era-${e.id}">${esc(e.name)}</a>`).join("\n")}
      </nav>

      <button class="xp-copy" type="button" id="copyAll">Copy the whole list</button>
      <p class="xp-foot">Set names, release dates and card counts are from the Pokemon TCG API.
        Card counts show the printed set size, with secret rares beyond it listed separately as a plus.
        ${/* NAMED AND COUNTED FROM THE DATA, not typed, so this sentence disappears
              on its own the day the API catches up with the numbering. Without it
              the two minus signs are the only unexplained mark on the page, and
              the 22 cards they account for are the difference between the tile
              and the column that a reader can add up. */ ""}${
        openEnded.length
          ? `An "unlisted" note is the opposite case and only ${
              openEnded.length === 1 ? "one set carries" : `${openEnded.length} sets carry`
            } it:
        ${openEnded
          .map((s) => `${esc(s.name)}, numbered to ${s.printedTotal} with ${s.printedTotal - s.total} not yet in the API's list`)
          .join(", and ")}. Those sets are still open, so the numbering runs ahead of the catalog and the
        count here follows the numbering.`
          : ""
      }
        Underlined sets have a full guide on this site. The site also holds guides for Japanese and
        Korean sets, which are not English releases and so are on no row here.
        ${/* THE TOPPS LINE SITS HERE AND NOWHERE ELSE ON THIS PAGE, and the
              placement is the argument. This is the complete index of English
              Pokemon TCG sets, and Topps' own Pokemon sets are not Pokemon TCG
              sets at all, so putting them in a row or an era would be wrong in
              exactly the way this page exists to avoid. But a reader who has just
              failed to find their 1999 card in a list titled "every set" is
              standing at the one sentence that says what is deliberately absent,
              and that is where they are owed the pointer. Same shape as the
              Japanese and Korean clause it follows. */ ""}Topps made its own
        Pokemon cards from 1999 to 2004, trading cards rather than game cards, and those are on no row
        here either: <a href="/topps.html">the Topps guide</a> covers every one of them. Fan made
        reference. Not affiliated with The Pokemon Company or Nintendo.</p>
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
  // Visible text only. The reasoning is in the builder, above the html template.
  const clean = (el) => {
    if (!el) return "";
    const n = el.cloneNode(true);
    if (n.querySelectorAll) for (const sr of n.querySelectorAll(".sr-only")) sr.remove();
    return (n.textContent || "").replace(/\\s+/g, " ").trim();
  };
  const lines = ["Era\\tSet\\tType\\tReleased\\tCards\\tOur rips"];
  for (const sec of document.querySelectorAll(".xp-era")) {
    const era = clean(sec.querySelector("h2")?.firstChild);
    for (const tr of sec.querySelectorAll("tbody tr")) {
      const tag = tr.querySelector(".xp-tag");
      const sub = tr.querySelector(".xp-sub");
      // Read the name out of its own span, which holds the set name and
      // nothing else. This used to read the whole cell and strip a trailing
      // "promo", which was fine while that was the only pill that could follow
      // a name and wrong the moment a second one existed.
      const name = clean(tr.querySelector(".xp-n")) || clean(tr.querySelector(".xp-name"));
      const rips = clean(tr.querySelector(".xp-rips"));
      lines.push([
        era,
        name,
        tag ? "Promo" : sub ? "Subset" : "Expansion",
        clean(tr.querySelector(".xp-date")),
        tr.querySelector(".xp-cards")?.dataset.cards || clean(tr.querySelector(".xp-cards")),
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

/* WHY THE COPY BUTTON'S `clean()` STRIPS .sr-only BEFORE READING TEXT.
   Kept out here rather than inside the <script> template below, because a
   comment in that template is bytes on the page: this one is 1,091 raw and 487
   gzipped, on a document that gzips to 17KB. That is the same trade the
   build-shows.mjs note got wrong, where a comment inside a row template shipped
   once per row and cost 19.5% of the served page.

   noValue() in shared/format.mjs builds an empty cell out of TWO spans: an
   aria-hidden em dash for the eye, and an .sr-only word for a screen reader.
   textContent concatenates both. So the 152 sets with no rips returned
   "\u2014None", the `rips === "\u2014"` test never matched a bare em dash, and
   the sentinel was pasted verbatim into a spreadsheet column that otherwise
   holds "2 rips" or nothing at all.

   STRIPPING IN clean() RATHER THAN SPECIAL-CASING THE RIPS CELL, because the
   Cards cell is built the same way: its sr-only half reads ", plus 36 secret
   cards numbered past the printed total". That one does not leak today only
   because the extraction prefers data-cards, which all 174 rows currently
   carry. A row that ever lacked it would paste that sentence into a numeric
   column.

   clean() takes a Node and not always an Element: the era heading is read as
   h2.firstChild, a text node, which has no querySelectorAll. Hence the guard
   rather than an unconditional call.

   Checked before fixing: build-decks.mjs is the only other builder with a copy
   button, its page has no .sr-only at all and it copies a <pre> verbatim, and
   the five other noValue() callers only ever WRITE textContent. This is the
   only instance of the shape in the tree. */
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Every Pokemon TCG Set in Order: ${sets.length} Sets, ${firstYear} to ${lastYear}</title>
<meta name="description" content="The complete list of Pokemon TCG sets in release order, ${firstYear} to ${lastYear}. All ${sets.length} English expansions with release dates and card counts, grouped by era.">
<link rel="canonical" href="${SITE}/expansions.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Every Pokemon TCG Set in Order">
<meta property="og:description" content="All ${sets.length} English Pokemon TCG expansions, ${firstYear} to ${lastYear}, with release dates and card counts.">
<meta property="og:url" content="${SITE}/expansions.html">
<meta property="og:image" content="${SITE}/assets/og-expansions.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-expansions.jpg">
${FONTS}
${
  remoteSymbols
    ? `<!-- ${remoteSymbols} set symbol(s) are still served from the API host because
     sync-symbols.mjs has no local copy of them. The hint is emitted only when
     that is true: with every symbol mirrored it would open a connection the
     page never uses, which costs a DNS lookup and a handshake for nothing. -->
<link rel="preconnect" href="https://images.pokemontcg.io" crossorigin>`
    : `<!-- No preconnect to images.pokemontcg.io: every set symbol on this page is
     mirrored locally by scripts/sync-symbols.mjs and served from this origin. -->`
}
${STYLES}
<style>${miniCSS(style)}</style>
<script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    /* THERE IS DELIBERATELY NO `license` HERE, AND SEARCH CONSOLE WILL KEEP
       ASKING FOR ONE. It reports "Missing field license" against this page as a
       non-critical Datasets issue, first seen 25 August 2026, and the obvious
       move is to copy /luck.html's CC BY 4.0 across. That would be a false
       claim, and build-luck.mjs says why in as many words: the numbers there
       "are counted out of this channel's own rip log and are the owner's to
       license; the card names, prices and SET DATA they sit beside come from
       TCGdex, PriceCharting and the Pokemon TCG API and are not his to give
       away. A licence line that did not draw that line would be claiming more
       than it holds."
       This dataset is ENTIRELY set data -- release dates and card counts. There
       is nothing of the channel's own measurement in it, so there is nothing
       here the owner can license to anybody. A non-critical warning is the
       correct outcome and the honest one; Google's own text says items with
       this issue are valid. If a future editor wants the warning gone, the way
       to earn it is to establish what TCGdex and the Pokemon TCG API actually
       grant, in writing, not to assert a licence we do not hold. */
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
  // Spelled out, not the raw ISO stamp. `syncedAt` is "2026-08-11" and the
  // footer was printing it verbatim, which is the only date on the site in that
  // shape: card-shows.html, grading.html and shops.html all say "August 12,
  // 2026" in their prose. The ISO form still goes out in the Dataset
  // dateModified above, where a machine is the reader.
  `Set data from the Pokemon TCG API, last checked ${longDate(syncedAt) || syncedAt}.`
)}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/expansions.html"), html);

console.log(`Wrote public/expansions.html
  ${sets.length} sets, ${eras.length} eras, ${firstYear} to ${lastYear}
  ${ripped.length} link through to a set guide
  ${(html.length / 1024).toFixed(0)} KB`);
