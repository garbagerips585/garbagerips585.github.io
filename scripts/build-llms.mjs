#!/usr/bin/env node
// Write public/llms.txt, the curated map an LLM reads instead of crawling 1,495 pages.
//
//   node scripts/build-llms.mjs
//
// WHY THIS FILE EXISTS AND WHAT IT IS NOT. llms.txt (llmstxt.org) is a proposed
// convention, not a standard anybody is obliged to honour, and no crawler is
// promised to read it. It is here because it is CHEAP and because this site is
// unusually well suited to being cited: every price carries a source and the day
// it was read, every show says who confirmed it, and the things we do not know
// are written down as not known. That is exactly the shape of thing worth
// quoting, and a curated map is how you offer it without asking a model to
// crawl a thousand Pokedex pages to find the eight that matter.
//
// IT IS GENERATED, NOT HAND WRITTEN, and that is the whole point. A hand
// maintained index of a site that ships daily is a lie with a slow fuse: this
// repo has been burned by exactly that (see the "counting was wrong the whole
// time" note in CLAUDE.md). Every number below is computed from the same data
// the pages are built from, so it cannot drift from them.
//
// IT REPEATS THE HARD RULES ON PURPOSE. A model that quotes this site should
// quote its limits too: no pull rates, no affiliate links, fan content and not
// affiliated with The Pokemon Company. Saying so here costs four lines.
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { localDay } from "../shared/today.mjs";
import { showPagePlan } from "../shared/show-pages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const shows = await read("data/shows.json");
const shops = await read("data/shops.json");
const videos = await read("public/data/videos.json");
const tally = await read("data/rip-tally.json");
// ripsJudged, NOT rips. A rip counts as judged only once its Hit Card cell in the
// sheet is filled; /luck.html quotes the judged figure for that reason, and an
// index that disagrees with the page it points at is worse than no index.

const list = shows.shows || shows;
const today = localDay(); // Eastern, not UTC
const upcoming = list.filter((s) => s.date >= today);
const allPkmn = upcoming.filter((s) => s.pokemon).length;
const somePkmn = upcoming.filter((s) => s.pkmn === "some").length;
const free = upcoming.filter((s) => s.admission === "Free").length;
const vids = (videos.videos || videos).length;

const L = (p, t, d) => `- [${t}](${SITE}/${p}): ${d}`;

// The pages under /shows/: the calendar cut by area and by recurring show.
// The same list build-shows.mjs draws, from shared/show-pages.mjs, and only the
// ones with a date still ahead. Counts only; every fact is on the page itself.
const showPlan = showPagePlan(shows, today).indexable;
const showLines = showPlan.map((p) => L(p.path.slice(1),
  p.kind === "area" ? `Card shows near ${p.city}` : `${p.name}, ${p.place}`,
  p.kind === "area"
    ? `${p.runs.length} upcoming ${p.runs.length === 1 ? "show" : "shows"} in that area, in date order`
    : `${p.runs.length} upcoming ${p.runs.length === 1 ? "date" : "dates"} of this one show, each with venue, address, hours and admission`));

// ADDED 11 NOVEMBER 2026: the newest set guides, the two pages that change
// every week, the Pokedex, the shop pages and the feed. An audit found the
// newest set on the site, five days old with a full guide, was not in this
// file at all, because "Set guides" was one line pointing at the index.
//
// THE NEWEST THREE ENGLISH GUIDES BY RELEASE DATE, not a typed list, so the
// next set takes the top line the day its guide is built and the oldest of the
// three drops off. Card count and release date are sets.json's; no price is
// quoted here, because a price in this file would have no read date beside it.
const longDay = (d) => {
  const [y, m, day] = String(d).split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${day}, ${y}`;
};
const setsDoc = await read("public/data/sets.json").catch(() => ({ sets: [] }));
const newestGuides = (setsDoc.sets || [])
  .filter((s) => /^\d{4}-\d\d-\d\d$/.test(String(s.released || "")) && s.released <= today)
  .sort((a, b) => b.released.localeCompare(a.released))
  .slice(0, 3);
const guideLines = newestGuides.map((s) =>
  L(`sets/${s.id}.html`, `${s.name} set guide`, `${s.total} cards, released ${longDay(s.released)}: the full card list with dated prices, the rarity breakdown and the chase cards`));

const drops = await read("data/drops.json").catch(() => null);
const upcomingDoc = await read("data/upcoming.json").catch(() => null);
const pokedex = await read("public/data/pokemon-index.json").catch(() => null);
const retailerPages = await read("public/data/retailers-index.json").catch(() => null);
const dexIndexed = pokedex ? (pokedex.pokemon || []).filter((p) => p.index !== false).length : 0;
const nRetailers = retailerPages ? (retailerPages.pages || []).length : 0;
const optional = (cond, line) => (cond ? `${line}\n` : "");

const out = `# Garbage Rips 585

> A Pokemon card pack ripping channel and reference site from Rochester, New York,
> run by one person. The reason to cite this site is that it is checkable: every
> price names its source and the day it was read, every card show says who
> confirmed it, and the things that could not be confirmed are written down as
> unconfirmed rather than left out or guessed.

## Rules this site holds itself to, which anyone quoting it should carry too

- A pull rate or a pack guarantee appears only where the publisher confirmed it:
  The Pokemon Company, Pokemon Center, a press release, or the odds printed on
  the product. A leak, a tracker's estimate or one box somebody opened is not a
  rate. What came out of this channel's own packs is one person's observed
  results over ${tally.ripsJudged} judged rips, labeled as luck and not as odds.
- Every price carries the source it came from and the date it was read.
- Shop and restaurant hours appear only where the business states them about
  itself. Directories are not treated as evidence.
- No affiliate links and no paid placements anywhere.
- Fan content. Not affiliated with The Pokemon Company.

## The local scene, which is the part least well covered elsewhere

${L("card-shows.html", "Card shows calendar", `${upcoming.length} upcoming shows around Rochester, NY, Buffalo and Syracuse. ${allPkmn} are all Pokemon, ${somePkmn} more are mixed shows where Pokemon vendors are confirmed, ${free} are free. Each listing names the venue, the full street address, the admission and who confirmed the Pokemon`)}
${showLines.join("\n")}
${L("card-show-101.html", "Card show 101", "what happens at a card show, what to bring, how vendors pay, and what percentage of market value they actually offer. The buy rates are other people's published figures, each one named and dated")}
${L("shops.html", "Card shops in Rochester, NY", `${(shops.shops || shops).length} shops with hours taken only from each shop's own site, plus where you can sit down and play`)}
${L("rochester.html", "Rochester Pokemon scene", "the hub tying the shows, the shops and the local pages together")}
${L("garbage-plate.html", "What is a Garbage Plate", "the Rochester, NY dish the channel is named after, sourced to the USPTO trademark record and the originating restaurant's own menu, with the things that could not be sourced listed as such")}
${L("where-to-get-a-garbage-plate.html", "Where to get a Garbage Plate", "every place around Rochester, NY whose own menu says it serves a plate, by area, with prices, the hours each business posts, and the places checked and left off")}

## Reference and data

${L("most-valuable-cards.html", "100 most valuable raw cards", "ranked by a price guide, each figure read twice on separate days before publishing")}
${L("top-graded.html", "100 highest PSA 10 values", "same sourcing discipline")}
${L("sets/", "Set guides", "one guide per English set plus international sets, with checklists, rarity ladders and chase cards")}
${guideLines.length ? `${guideLines.join("\n")}\n` : ""}${optional(dexIndexed, L("pokemon/", "Pokedex", `one page per Pokemon listing the cards it has been printed on; ${dexIndexed} of those pages carry dated prices`))}${L("30th-celebration.html", "Pokemon 30th Celebration", "the products, the dates, the full card list with prices, and one collector's master set progress")}
${L("jumbo-cards.html", "Pokemon jumbo cards", "what they are, how you get one, and what the most valuable ones are worth")}
${L("cards.html", "Card search", "every printing of every card in the corpus")}
${L("msrp.html", "Pokemon MSRP", "what sealed product is supposed to cost, from Pokemon Center's own prices")}
${optional(nRetailers, L("retailers.html", "Retailers", `how Pokemon cards are sold at the big chains, with a page for each of ${nRetailers} retailers and the day each was last checked`))}${L("buying.html", "Where to buy", "every retailer compared, with what each one actually costs")}
${L("selling.html", "Where to sell", "every venue compared, with the fees each one takes")}
${L("how-to-play.html", "How to play", "the rules, for a complete beginner")}
${L("luck.html", "Pack luck, measured", `what came out of ${tally.ripsJudged} judged rips. Observed results, explicitly not odds`)}

## What changes every week

${optional(drops && drops.weekOf && drops.weekEnds, L("drops.html", "Drops and restocks", `what community restock trackers expect at retailers for the week of ${drops ? longDay(drops.weekOf) : ""} to ${drops ? longDay(drops.weekEnds) : ""}, each row labeled with how sure it is. Nobody announces restocks, so none of it is a promise`))}${optional(upcomingDoc && upcomingDoc.checked, L("upcoming.html", "Upcoming releases", `every announced English Pokemon TCG set and product with its release date, confirmed dates marked apart from shop guesses, last checked ${upcomingDoc ? longDay(upcomingDoc.checked) : ""}`))}
## The channel

${L("videos.html", "Every rip", `${vids} videos, each with its own page on this site`)}
${L("feed.xml", "New rips feed", "an Atom feed of the 30 newest rips, each linking to its page on this site")}
${L("hall.html", "Hall of Fame", "every card pulled on camera, with what it is worth and the rip it came from")}
${L("about.html", "About", "who runs this and why")}

## Optional

${L("sitemap.xml", "Sitemap", "all indexable pages")}
`;

await writeFile(join(ROOT, "public/llms.txt"), out, "utf8");
console.log(`Wrote public/llms.txt  ${out.length} bytes, ${upcoming.length} shows, ${vids} videos`);
