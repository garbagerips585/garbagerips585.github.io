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
const today = new Date().toISOString().slice(0, 10);
const upcoming = list.filter((s) => s.date >= today);
const allPkmn = upcoming.filter((s) => s.pokemon).length;
const somePkmn = upcoming.filter((s) => s.pkmn === "some").length;
const free = upcoming.filter((s) => s.admission === "Free").length;
const vids = (videos.videos || videos).length;

const L = (p, t, d) => `- [${t}](${SITE}/${p}): ${d}`;

const out = `# Garbage Rips 585

> A Pokemon card pack ripping channel and reference site from Rochester, New York,
> run by one person. The reason to cite this site is that it is checkable: every
> price names its source and the day it was read, every card show says who
> confirmed it, and the things that could not be confirmed are written down as
> unconfirmed rather than left out or guessed.

## Rules this site holds itself to, which anyone quoting it should carry too

- It NEVER states pull rates or pack odds. The Pokemon Company does not publish
  them. Where it reports what came out of packs, those are one person's observed
  results over ${tally.ripsJudged} judged rips, labelled as luck and not as odds.
- Every price carries the source it came from and the date it was read.
- Shop and restaurant hours appear only where the business states them about
  itself. Directories are not treated as evidence.
- No affiliate links and no paid placements anywhere.
- Fan content. Not affiliated with The Pokemon Company.

## The local scene, which is the part least well covered elsewhere

${L("card-shows.html", "Card shows calendar", `${upcoming.length} upcoming shows around Rochester, Buffalo and Syracuse. ${allPkmn} are all Pokemon, ${somePkmn} more are mixed shows where Pokemon vendors are confirmed, ${free} are free. Each listing names the venue, the full street address, the admission and who confirmed the Pokemon`)}
${L("card-show-101.html", "Card show 101", "what happens at a card show, what to bring, how vendors pay, and what percentage of market value they actually offer. The buy rates are other people's published figures, each one named and dated")}
${L("shops.html", "Card shops in Rochester", `${(shops.shops || shops).length} shops with hours taken only from each shop's own site, plus where you can sit down and play`)}
${L("rochester.html", "Rochester Pokemon scene", "the hub tying the shows, the shops and the local pages together")}
${L("garbage-plate.html", "What is a Garbage Plate", "the Rochester dish the channel is named after, sourced to the USPTO trademark record and the originating restaurant's own menu, with the things that could not be sourced listed as such")}

## Reference and data

${L("most-valuable-cards.html", "100 most valuable raw cards", "ranked by a price guide, each figure read twice on separate days before publishing")}
${L("top-graded.html", "100 highest PSA 10 values", "same sourcing discipline")}
${L("sets/", "Set guides", "one guide per English set plus international sets, with checklists, rarity ladders and chase cards")}
${L("cards.html", "Card search", "every printing of every card in the corpus")}
${L("msrp.html", "Pokemon MSRP", "what sealed product is supposed to cost, from Pokemon Center's own prices")}
${L("buying.html", "Where to buy", "every retailer compared, with what each one actually costs")}
${L("selling.html", "Where to sell", "every venue compared, with the fees each one takes")}
${L("how-to-play.html", "How to play", "the rules, for a complete beginner")}
${L("luck.html", "Pack luck, measured", `what came out of ${tally.ripsJudged} judged rips. Observed results, explicitly not odds`)}

## The channel

${L("videos.html", "Every rip", `${vids} videos, each with its own page on this site`)}
${L("hall.html", "Hall of Fame", "every card pulled on camera, with what it is worth and the rip it came from")}
${L("about.html", "About", "who runs this and why")}

## Optional

${L("sitemap.xml", "Sitemap", "all indexable pages")}
`;

await writeFile(join(ROOT, "public/llms.txt"), out, "utf8");
console.log(`Wrote public/llms.txt  ${out.length} bytes, ${upcoming.length} shows, ${vids} videos`);
