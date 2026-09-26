/* data/30th-illustrators.json: WHO DREW EACH 30TH CELEBRATION CARD.
 *
 *     node scripts/sync-30th-illustrators.mjs
 *
 * WHY, 25 September 2026. The checklist printed "Pikachu / Pikachu Rare" thirty
 * rows running, and the one thing that tells the 30 Pikachu apart to a person
 * collecting them is who drew each one. TCGdex carries the illustrator on every
 * card, the same source the page already draws its pictures from.
 *
 * ONE REQUEST PER CARD, and that is why it is its own script and not a step of
 * build-30th.mjs: the set endpoint lists only id, name and image, so the credit
 * lives on /cards/30th-NNN, 158 requests. A scheduled build must not depend on a
 * network step, so the answer is written to data/ and committed, like every
 * other sync-30th-*.mjs.
 *
 * ONLY WHAT TCGDEX STATES. A card it answers without an illustrator is left out
 * rather than guessed, and the page prints no credit for it. The Classic
 * Collection is not here: TCGdex's `30th-c` has no credits either, and those 30
 * are reprints whose artists are a different question.
 */
import { writeFile } from "node:fs/promises";
import { localDay } from "../shared/today.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/30th-illustrators.json");
const API = "https://api.tcgdex.net/v2/en";

const set = await (await fetch(`${API}/sets/30th`)).json();
const ids = (set.cards || []).map((c) => c.localId).sort();
if (ids.length < 100) throw new Error(`TCGdex returned ${ids.length} cards for 30th; refusing to write`);

const cards = {};
let missing = 0;
const queue = [...ids];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      for (let tries = 0; tries < 3; tries++) {
        try {
          const r = await fetch(`${API}/cards/30th-${id}`);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const c = await r.json();
          if (c.illustrator && String(c.illustrator).trim()) cards[id] = String(c.illustrator).trim();
          else missing++;
          break;
        } catch (e) {
          if (tries === 2) { console.warn(`  ${id}: ${e.message}`); missing++; }
          else await new Promise((res) => setTimeout(res, 800));
        }
      }
    }
  })
);

const sorted = Object.fromEntries(Object.entries(cards).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(
  OUT,
  JSON.stringify(
    {
      _readme: "Illustrator credit per card, keyed by TCGdex localId (the numerator, zero padded to three). Written by scripts/sync-30th-illustrators.mjs from api.tcgdex.net/v2/en/cards/30th-NNN. Only cards TCGdex credits are listed.",
      checked: localDay(),
      source: "https://api.tcgdex.net/v2/en/sets/30th",
      cards: sorted,
    },
    null,
    2
  ) + "\n"
);
console.log(`Wrote data/30th-illustrators.json  ${Object.keys(sorted).length} of ${ids.length} credited, ${missing} without`);
