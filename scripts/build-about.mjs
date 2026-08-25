#!/usr/bin/env node
// Build public/about.html.
//
//   node scripts/build-about.mjs
//
// WHAT THIS PAGE IS FOR, because it is three jobs and they pull in different
// directions. It is the page a search engine reads to work out whose site this
// is, so it carries the Organization schema and the links that tie the channel,
// the socials and the site together as one entity. It is the page a stranger
// reads to decide whether the channel is worth their time. And since 21 August
// 2026 it is the page that says WHAT IS ON THE SITE, because the owner asked for that
// in as many words and there was nowhere else that answered it: the footer nav
// lists the urls, and a list of urls is not an answer to "what is this".
//
// IT WENT 456 WORDS TO ABOUT 2,000 IN THAT PASS. The old page was a channel
// description set for the web. It said nothing about the guides, nothing about
// the parents who are the reason half of them exist, and it made two claims
// about Rochester that a stranger could have read as fact. See THE TWO CLAIMS
// below.
//
// EVERY NUMBER ON THE PAGE IS COMPUTED HERE. Not one is typed. The site grows
// by hundreds of pages a month and a hand-typed count on the page that explains
// the site is the worst possible place for a stale one. See countTree() for the
// one figure whose freshness has a caveat, and for the cross-check that catches
// it going wrong.
//
// THE TWO CLAIMS, and this is the part not to undo:
//
//   "The two unofficial Pokemon of Rochester" is a lovely conceit and it is
//   THIS CHANNEL'S OWN. The City of Rochester has not designated a Pokemon and
//   nobody has voted on it. So the page makes it as a joke the channel is
//   making, in the channel's own voice, the way /lore.html already does with
//   "if we get a vote" -- which is funnier than the flat assertion anyway. What
//   IS sourceable, and is the reason the joke lands, is that the Pokedex files
//   Trubbish as the Trash Bag Pokemon and Garbodor as the Trash Heap Pokemon,
//   and /lore.html is the page that prints that with its source. This page
//   points there rather than restating it.
//
//   "The national food of Rochester" is the owner's phrase and he explained what he
//   meant by it: "I just meant its the one food item Rochester, NY is known for
//   globally." That is an ordinary, defensible claim and it is written here
//   with confidence, as "the one food Rochester is known for outside
//   Rochester". What it must not do is read as an official designation the way
//   a national dish is officially one, which is the only thing the literal
//   phrasing risked.
//
// AND THE CEILING ON BOTH: /garbage-plate.html does the work on this subject,
// with a source and a read date on every claim, and this page must not
// out-claim it. Everything About says about the dish is either a summary of
// what that page establishes or a pointer to it. If the two ever disagree, that
// page is right and this one is the bug.
//
// "The ultimate guide" was in the brief for the plate page and is deliberately
// not on this one. A superlative about ourselves is the one kind of claim this
// site cannot source. What the page prints instead is what is actually in it:
// the restaurant count, the source count, and the five things it could not
// source, all read out of data/garbage-plate.json so they cannot drift from it.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { SOCIALS, SUBSCRIBE, APP_JS_NO_PACKPLAYER as APP_JS, dropUnusedPacksCSS } from "../shared/chrome.mjs";
import { MONTHS_LONG as MONTHS, esc, avifPicture, plateRule, plateMark, PLATE_CSS, longDate, clipMeta} from "../shared/format.mjs";
// The stylesheet's own comment stripper, reused rather than re-written: it is a
// tokenizer, so a /* inside a quoted value or a url() cannot open a comment.
// build-css.mjs strips assets-source/ui.css and does NOT touch a page's own
// <style>, so without this every argument written beside a rule below ships to
// every reader. Same trade build-buying.mjs and eight other builders make.
import { strip as miniCSS } from "./build-css.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJSON = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

// The imported guides are listed on the same /sets/ index, so a count of
// "set guides" that omits them contradicts the page it links to.
let intlCount = 0;
try {
  intlCount = Object.keys((await readJSON("public/data/intl-guides.json")).sets || {}).length;
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}

const raw = await readJSON("public/data/videos.json");
const videos = raw.videos || raw;
const { sets } = await readJSON("public/data/sets.json");
const pokedex = await readJSON("public/data/pokemon-index.json");
const plate = await readJSON("data/garbage-plate.json");
const shopFile = await readJSON("data/shops.json");
const msrp = await readJSON("data/msrp.json");
let playlistCount = 0;
try {
  const pl = await readJSON("public/data/playlists.json");
  playlistCount = (Array.isArray(pl) ? pl : pl.playlists || []).length;
} catch {
  /* run: node scripts/sync-youtube.mjs */
}

const setsRipped = new Set(videos.flatMap((v) => v.sets || [])).size;
const guideCount = sets.length + intlCount;
const shopCount = (shopFile.shops || []).length;
const plateSpots = (plate.places || []).length;
const plateSources = (plate.sources || []).length;
const platePhotos = (plate.photos || []).length;
const plateUnsourced = (plate.notSourced || []).length;

const num = (n) => Number(n).toLocaleString("en-US");

/* ------------------------------------------------------------- the inventory
 *
 * HOW MANY PAGES ARE ON THIS SITE, COUNTED RATHER THAN REMEMBERED.
 *
 * THE COUNT COMES OFF THE BUILT TREE, which is the only thing that knows. There
 * is no manifest: 65 builders write pages, several of them clear their own
 * directory first, and the families they own grow at completely different
 * rates. Any number derived from a subset of the data files would be a number
 * about the data rather than about the site.
 *
 * THE ONE CAVEAT, WRITTEN DOWN RATHER THAN GLOSSED. This builder is step 18 of
 * 65 in build-all.mjs. Everything under public/rip/, public/pokemon/ and
 * public/sets/ has already been rewritten by the time this runs, so those three
 * are THIS build's. public/playlists/, public/retailers/, public/openings/,
 * public/games/ and most root pages are built AFTER, so those are the PREVIOUS
 * build's -- which is fine, because public/ is generated AND committed (see
 * scripts/check-tree-drift.mjs), so the tree is never empty and those five
 * families move by ones and twos a month rather than by hundreds. A page added
 * to one of them shows up in this count on the next build.
 *
 * IF THAT EVER STOPS BEING TRUE, MOVE THIS STEP DOWN THE LIST rather than
 * hard-coding a number. It has no ordering constraint that stops it: it takes
 * its chrome by slicing public/index.html (build-proto.mjs, step 6) and must run
 * before build-search.mjs and before check-build.py, and everything between is
 * free.
 *
 * AND THE CROSS-CHECK, because a silent walk over a directory is exactly the
 * shape of measurement that goes wrong without saying so. Three of the families
 * ARE determined exactly by data this file already holds, so the walk is
 * checked against them on every run and a disagreement is printed. It is a
 * warning and not a throw: a stale extra file in public/ is a real thing that
 * happens when a builder stops writing a page, and it should not stop a build.
 */
async function countTree(dir, base = "") {
  const out = { total: 0, families: {}, indexes: {} };
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      const sub = await countTree(full, base ? `${base}/${ent.name}` : ent.name);
      out.total += sub.total;
      for (const [k, v] of Object.entries(sub.families)) out.families[k] = (out.families[k] || 0) + v;
      for (const [k, v] of Object.entries(sub.indexes || {})) out.indexes[k] = (out.indexes[k] || 0) + v;
    } else if (ent.name.endsWith(".html")) {
      out.total += 1;
      const fam = base.split("/")[0] || "root";
      out.families[fam] = (out.families[fam] || 0) + 1;
      // A SECTION INDEX IS A PAGE, BUT IT IS NOT ONE OF THE THINGS. Counted
      // separately so the tree below can label its rows honestly; see the note
      // over TREE_LABELS. `base` is empty at the root, where index.html is the
      // home page and genuinely is one of the fifty.
      if (base && ent.name === "index.html") out.indexes[fam] = (out.indexes[fam] || 0) + 1;
    }
  }
  return out;
}

const tree = await countTree(join(ROOT, "public"));
const fam = tree.families;
// Each expected figure is the family's own data plus its index page, which is
// the one page in each of these directories that is not a record of anything.
const expected = {
  rip: videos.filter((v) => v.path).length,
  pokemon: (pokedex.count || 0) + 1,
  sets: guideCount + 1,
};
const drift = Object.entries(expected)
  .filter(([k, n]) => (fam[k] || 0) !== n)
  .map(([k, n]) => `${k}: tree has ${fam[k] || 0}, data says ${n}`);

/* ------------------------------------------------------------ three to start
 *
 * THIS PAGE SAID "EVERY RIP HAS ITS OWN PAGE HERE" AND LINKED NOT ONE OF THEM.
 * It is the page a stranger reads to decide whether the channel is worth their
 * time, it counts the rips in the sidebar, and the only way out of it towards
 * an actual video was the footer.
 *
 * THREE, NOT A RAIL, and each one is a different REASON to watch rather than
 * three slots off one sort. A "latest videos" strip is what every channel page
 * has and it answers a question nobody asked; "the biggest thing that ever came
 * out of a pack here" is an argument for the channel. The roles are fixed and
 * the picks are computed, so this cannot drift into an editor's favourites.
 *
 * DEDUPED BY FALLING THROUGH, because the roles genuinely collide: the Hall of
 * Fame hit is currently also the newest upload, so "newest" takes the newest
 * video that is not already listed rather than printing the same row twice.
 *
 * `hofRank` IS THE SPREADSHEET'S OWN JUDGEMENT and it is the only one of the
 * three that is not arithmetic. Exactly one video carries it today. If nobody
 * has ranked one, that row is absent and the card shows two: the standing
 * pattern here for data we do not have.
 */
const startHere = (() => {
  const taken = new Set();
  const out = [];
  // `where` is the ROLE's own precondition and it runs before anything is
  // claimed. Sorting first and filtering afterwards would mark a video taken
  // for a role it does not qualify for and then hide it from the next role.
  const pick = (label, where, sort) => {
    const v = videos
      .filter((x) => x.path && !taken.has(x.id) && where(x))
      .sort(sort)[0];
    if (!v) return;
    taken.add(v.id);
    out.push({ label, v });
  };
  pick("The biggest pull", (x) => Boolean(x.hofRank), (a, b) => a.hofRank - b.hofRank);
  pick("Most watched", (x) => (x.views || 0) > 0, (a, b) => (b.views || 0) - (a.views || 0));
  pick("Newest rip", (x) => Boolean(x.published), (a, b) => String(b.published).localeCompare(String(a.published)));
  return out;
})();
const oldest = videos.map((v) => v.published).filter(Boolean).sort()[0] || null;
const since = oldest ? `${MONTHS[Number(oldest.slice(5, 7)) - 1]} ${oldest.slice(0, 4)}` : null;

/* ------------------------------------------------------------- the streak --
 *
 * "PACKS GET OPENED ON CAMERA MOST DAYS" WAS AN UNDERCLAIM AND THE LOG SAYS SO.
 * The owner, 23 August 2026: "we rips pokemon packs daily on youtube, everyday, 365,
 * no days off". Counted here rather than typed, because a cadence claim is
 * exactly the kind of boast a reader should be able to check, and because this
 * one goes stale the first day it stops being true.
 *
 * THE SPAN IS THE DENOMINATOR AND IT IS NOT 365. The channel is younger than a
 * year, so "365" is the cadence and not the history, and the page says what it
 * can prove: how many days there have been and how many of them carry a rip.
 * If a day ever goes missing, `dayGaps` stops being 0 and the sentence below
 * has to change with it -- which is the point of deriving it.
 */
const ripDays = [...new Set(videos.map((v) => String(v.published || "").slice(0, 10)).filter(Boolean))].sort();
const daySpan = ripDays.length
  ? Math.round((Date.parse(`${ripDays[ripDays.length - 1]}T00:00:00Z`) - Date.parse(`${ripDays[0]}T00:00:00Z`)) / 86400000) + 1
  : 0;
const dayGaps = daySpan - ripDays.length;

/* ------------------------------------------------------------------- prices
 *
 * FOUR FIGURES, ALL FOUR READ OUT OF data/msrp.json, WHICH /msrp.html OWNS.
 *
 * The parent section is the one place on this page that has to be concrete: a
 * person standing in an aisle needs a number, and "see the price page" is not
 * one. But a price typed here is a price that can disagree with the page that
 * sources it, and this site's whole claim is that its figures are traceable to
 * one place each. So these are looked up by id from the same file, they carry
 * that file's own read date, and the lookup THROWS on a missing id rather than
 * printing "undefined" or quietly dropping a sentence.
 *
 * WHY THESE FOUR AND NOT A TABLE: /what-to-buy.html already walks five
 * situations with a photograph and a price on each, and /msrp.html prices every
 * kind of sealed product there is. Repeating either here would be a second,
 * worse copy that goes stale on its own. These four are the anchors a person
 * needs to know whether the shelf in front of them is reasonable, and the two
 * pages that do the work are named beside them.
 */
const priceOf = (id) => {
  const row = msrp.products.find((p) => (p.rowId || p.id) === id);
  if (!row || typeof row.price !== "number")
    throw new Error(`build-about.mjs: no price for msrp id "${id}". Check data/msrp.json.`);
  return `$${row.price.toFixed(2)}`;
};
const PACK = priceOf("pack-loose");
const BUNDLE = priceOf("bundle");
const ETB = priceOf("etb");
const FIRST_BATTLE = priceOf("my-first-battle");
const BATTLE_ACADEMY = priceOf("battle-academy");
const MINI_TIN = priceOf("mini-tin");
const msrpRead = longDate(msrp.readOn);
const msrpPriced = msrp.products.filter((p) => typeof p.price === "number").length;

/* -------------------------------------------------------------- the guides
 *
 * WHAT IS ON THE SITE, WHICH IS THE THING THE OWNER ASKED FOR AND THE THING THE OLD
 * PAGE DID NOT ANSWER.
 *
 * IT IS A DATA STRUCTURE AND NOT PROSE, for one reason: the site gains a guide
 * every few days and a paragraph naming six of them is a paragraph that is
 * wrong by Thursday. A list is edited by adding a line.
 *
 * EVERY ENTRY CARRIES A NOTE SAYING WHAT THE PAGE ACTUALLY DOES, checked
 * against that page's own meta description rather than guessed from its url.
 * "Grading" could be either of two pages here and they answer different
 * questions; "where to buy" is four pages and three of them are about different
 * kinds of buying. A hub that mislabels its own destinations is worse than no
 * hub, because the reader spends the click.
 *
 * THE GROUPS ARE THE READER'S QUESTION, NOT THE SITE'S FILING. "What is it
 * worth" and "what should it cost" are two different questions asked by two
 * different people at two different moments, and they are two groups here even
 * though every page in both is a page of prices.
 */
const GUIDES = [
  [
    "brand-new",
    "If you have never opened a pack",
    [
      ["/start.html", "Start here", "Six questions in the order they actually come up, with a short answer to each and a page behind it."],
      ["/how-to-play.html", "How to play", "How a game is set up, what a turn looks like, and the three ways to win. Written for somebody who has only ever opened packs."],
      ["/rarity.html", "Rarity symbols", "What the circle, diamond, star and the rest in the bottom corner mean, shown on real cards."],
      ["/what-set.html", "What set is this from", "Look a card up from the number printed on it."],
      ["/types.html", "Card types", "All eleven, and what each one is strong against."],
      ["/tcg-live.html", "The code card in every pack", "What the extra card in every pack is for, and how the free official game works. The fastest way to learn the rules is to let software enforce them."],
    ],
  ],
  [
    "worth",
    "What a card is worth",
    [
      ["/cards.html", "Card search", "Every printing of every card, with a price guide value on it."],
      ["/most-valuable-cards.html", "The 100 most valuable raw cards", "Ranked on an ungraded price guide value, with a link on every row so you can check whether the figure still holds."],
      ["/top-graded.html", "The 100 highest PSA 10 values", "The same catalog asked a different question: what a perfect graded copy is worth."],
      ["/most-expensive-sealed.html", "The 100 most expensive sealed products", "Boxes and collections rather than cards."],
      ["/base-set.html", "1st Edition, Shadowless or Unlimited", "Which 1999 Base Set print run a card in your hand came from, and why it matters to the price."],
      ["/topps.html", "Topps Pokemon cards", "The Pokemon cards that are not TCG cards at all. Most collectors have never knowingly held one and several are worth real money."],
      ["/complete-a-set.html", "What it costs to complete a set", "Priced nightly, and the argument for buying singles instead of opening packs."],
    ],
  ],
  [
    "cost",
    "What sealed product should cost",
    [
      ["/msrp.html", "The MSRP check", `${msrpPriced} kinds of sealed product against the price Pokemon suggests, so you can work out in the aisle how far over you are being asked to go.`],
      ["/pack-prices.html", "Pack prices by set", "What one booster pack of each set costs, priced nightly."],
      ["/how-many-packs.html", "How many packs are in that", "Box, ETB, bundle, tin or blister. The number you divide by before any of the above means anything."],
      ["/upcoming.html", "What is coming", "Release dates and products for the sets that have not landed yet."],
      ["/drops.html", "Restocks this week", "What the trackers expect and when, said plainly as a guess, because no retailer publishes a restock schedule."],
    ],
  ],
  [
    "buy",
    "Where to buy, and where to sell",
    [
      ["/buying.html", "Buying online", "Shipping thresholds and buyer fees read off each company's own page, plus what recourse you have when a card turns up wrong."],
      ["/retailers.html", "Which chains stock cards", `GameStop to Dollar General: what each one carries, which aisle it is filed in, and a page of its own for ${num(fam.retailers || 0)} of them.`],
      ["/shops.html", "Card shops near Rochester", `The ${shopCount} local shops, with league nights, prereleases and hours.`],
      ["/card-shows.html", "Card shows", "Every upcoming show around Rochester, Buffalo and Syracuse, with dates, venues and admission."],
      ["/selling.html", "Where to sell", "What each venue takes off the top, because the fees are the whole decision."],
      ["/vendors.html", "Local vendors", "Who is set up at the shows and markets around here."],
    ],
  ],
  [
    "grade",
    "Grading, and telling a real card from a fake",
    [
      ["/grading.html", "What grading costs", "PSA against CGC, BGS and TAG, with the break-even math on real cards. Most cards are not worth grading and the page says so."],
      ["/will-it-grade.html", "Will it grade a 10", "Centering tolerances from all five graders, the flaws that cost a grade, and how to check a card at home before you pay."],
      ["/fake-cards.html", "Spotting a fake", "Eight physical checks you can do with the card in your hand and nothing else."],
    ],
  ],
  [
    "channel",
    "The channel's own numbers",
    [
      ["/videos.html", "Every rip", `All ${num(videos.length)} of them, filterable by set and by what kind of product it was.`],
      ["/hall.html", "The Card Hall of Fame", "Every card that has come out of a pack on this channel. Nothing hand-picked."],
      ["/luck.html", "What actually came out", "Observed results from the rips, broken down by set and product. Not pull rates: nobody publishes those and this site never states them."],
      ["/wanted.html", "Most wanted", "The cards we are hunting right now."],
      ["/playlists.html", "Playlists", `${num(playlistCount)} runs, each one playable in order on this site with its total runtime on the front.`],
      ["/openings/", "Sealed products opened", "One page per kind of box, with every rip of it in one place."],
    ],
  ],
  [
    "pokemon",
    "Pokemon beyond the cards",
    [
      ["/sets/", "Set guides", `${num(guideCount)} of them, English and imported. How many cards are in a set, what is actually rare in it, and what the chase cards are going for.`],
      ["/pokemon/", "The Card Pokedex", `A page for all ${num(pokedex.count)} Pokemon: every card that prints it, what those cards cost, and, where we have opened the set, the rips it came out of.`],
      ["/expansions.html", "Every set in order", "The whole run, 1999 to now, in one table."],
      ["/video-games.html", "Every video game", "The whole official timeline from 1996, with cover art, platforms and release dates."],
      ["/evolution.html", "Evolution chart", "Every line, and what each stage actually takes."],
      ["/eevee-evolutions.html", "The eight Eeveelutions", "How to get each one."],
      ["/lore.html", "Pokedex facts", "Including the entry that settles which two Pokemon this city should have had."],
      ["/decks.html", "Decks people actually play", "Real decklists in the format the official app imports by paste."],
      ["/games/", "Small games", `${num(Math.max(0, (fam.games || 0) - 1))} of them, for the restock line.`],
    ],
  ],
  [
    "roc",
    "Rochester, New York",
    [
      ["/garbage-plate.html", "The Garbage Plate", `What is on one, where it came from with a source on every claim, and ${num(plateSpots)} places around Rochester that serve it.`],
      ["/shops.html", "Card shops and where to play", "Drawn on a real map, with roads."],
      ["/card-shows.html", "Shows around the region", "Rochester out to Buffalo and Syracuse."],
      ["/creators.html", "Other people doing this locally", "Rochester, Buffalo and Syracuse."],
    ],
  ],
];

const guideLinkCount = GUIDES.reduce((n, [, , rows]) => n + rows.length, 0);

/* ----------------------------------------------------------------- the FAQ
 *
 * ONE ARRAY, RENDERED TWICE: as the visible section at the foot of the page and
 * as the FAQPage block in the head. Built from one source for the reason
 * build-first-partner.mjs gives for doing the same thing: a hand-written
 * structured-data block drifts from the page it claims to describe, and a
 * search engine can lift one of these answers and show it with no page around
 * it, so an answer that is only true in context is an answer that ships wrong.
 *
 * EVERY ANSWER HERE IS SELF-CONTAINED FOR THAT REASON. None of them says "see
 * above". The two that carry figures carry the qualifier in the same sentence
 * as the number.
 *
 * THE ANSWERS CARRY LINKS AND THE STRUCTURED DATA DOES NOT, which is why they
 * are written as markup and run through strip() on the way into the schema.
 * Same arrangement build-first-partner.mjs uses. A reader who has just been
 * told what to buy for a kid wants the page that says it in full; a snippet
 * with an anchor tag in its text is a snippet nobody can render.
 *
 * THE QUESTIONS ARE THE ONES A STRANGER ACTUALLY ASKS, not the ones that would
 * rank. Four of them are things the owner gets asked in person.
 */
const stripTags = (s) => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const FAQ = [
  [
    "Who runs Garbage Rips 585?",
    "One person, in Rochester, New York. There is no team and no shop behind it: it is one guy with a camera, a table and a lot of packs. The quickest way to reach him is any of the channel's socials.",
  ],
  [
    "How often does Garbage Rips 585 upload?",
    // COUNTED, NOT CLAIMED. The sentence renders from the same two derived
    // figures the lede uses, so a day that ever goes missing changes the
    // answer here instead of leaving a boast behind on a schema block that
    // Google is reading. See "the streak" above.
    dayGaps === 0
      ? `Every day. There have been ${num(daySpan)} days since the first rip and every one of them has a rip on it: no gaps, no days off, ${num(videos.length)} videos so far. Some days there is more than one.`
      : `Most days. ${num(daySpan - dayGaps)} of the ${num(daySpan)} days since the first rip carry one, ${num(videos.length)} videos in total.`,
  ],
  [
    "What is the Trubbish trash can on the channel?",
    "It is a real Pokemon Center item, from a limited run sold at the Pokemon Center in Tokyo and never released here, imported to Rochester. Every rip ends by feeding it: the wrappers, the packaging and the bulk all go in, on camera, in every single video. It is not a prop and it is not a bit that comes and goes.",
  ],
  [
    "Where is Garbage Rips 585 based?",
    `Rochester, New York, which is the 585. The channel is named after <a href="/garbage-plate.html">the city's own dish</a>, the pack art has a Rochester plate on the front of it, and the site carries a local section for <a href="/shops.html">card shops</a>, <a href="/card-shows.html">card shows</a> and <a href="/vendors.html">vendors</a> around Monroe County and out to Buffalo and Syracuse.`,
  ],
  [
    "Is this site affiliated with Pokemon?",
    "No. Garbage Rips 585 is fan content and is not affiliated with The Pokemon Company, Nintendo, Creatures or Game Freak. Nothing here is official and nothing here speaks for them. Where a price comes from Pokemon's own shop, the page says so and links nothing else.",
  ],
  [
    "Do you sell Pokemon cards?",
    `No. Nothing on this site is for sale and there is no affiliate code on any link. The pages that tell you <a href="/buying.html">where to buy</a> are telling you where to buy, and the ones that print a price are printing it so you can check what you are being asked for.`,
  ],
  [
    "What should I buy for a kid who is just getting into Pokemon cards?",
    `It depends on whether they want to open things or play the game, and those are two different presents. For opening: a mini tin at ${MINI_TIN} or a booster bundle at ${BUNDLE}, which is six packs and nothing else. For playing: My First Battle at ${FIRST_BATTLE} for a young kid, or Battle Academy at ${BATTLE_ACADEMY} for one who can follow a rulebook. Neither of those two contains booster packs, which is the point: you cannot learn this game out of booster packs. Those are the prices Pokemon suggests, read ${msrpRead}, not what a shop has to charge. <a href="/what-to-buy.html">What should I buy?</a> goes through five situations with a photograph and a price on each.`,
  ],
  [
    "Why is it called Garbage Rips?",
    `Three reasons and they are all the same reason. Most packs are garbage, which is the honest description of the hobby. Rochester's own dish is <a href="/garbage-plate.html">the Garbage Plate</a>. And the channel's mascot is Trubbish, who is a bag of trash with legs and who is fed every bad pull, every wrapper and all the bulk.`,
  ],
  [
    "What is a Garbage Plate?",
    `Two sides on the bottom, meat on top of them, a spiced meat sauce poured over the lot, then raw onions and mustard, with bread and butter on the side. It comes from one restaurant in Rochester, New York, and the name is a federal trademark, which is why everywhere else in the city sells you a trash plate instead. <a href="/garbage-plate.html">The full guide</a> sources the history and lists ${num(plateSpots)} places to eat one.`,
  ],
  [
    "Do you publish Pokemon pull rates?",
    `No, and nothing on this site ever states one. The Pokemon Company does not publish the odds for its paper packs, so any number you see quoted for them is somebody's guess. What this site has instead is <a href="/luck.html">a count of what actually came out</a> of the packs opened on camera here, labeled as observed results rather than as odds.`,
  ],
];

/* --------------------------------------------------------------------- CSS
 *
 * COMMENTS OUT OF THE SHIPPED PAGE, ARGUMENT KEPT IN THIS FILE. build-css.mjs
 * strips assets-source/ui.css and does not touch a page-level <style>, so
 * without miniCSS every word below is bytes on the wire on a render-blocking
 * path. See the import at the top.
 */
const style = `
.about-page{padding:var(--s7) 0 var(--s8)}
.about-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:34em;margin-bottom:var(--s5)}
.about-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:var(--s7);align-items:start}
@media(max-width:900px){.about-grid{grid-template-columns:1fr;gap:var(--s6)}}
.about-body p{margin-bottom:var(--s4);max-width:36em}
/* OFF-WHITE, AND THAT IS THE ACCENT RULE RATHER THAN A PREFERENCE. Teal is how
   you get around and pink is what the site is saying; a body section heading is
   neither, because the highlighted word inside one would be swallowed by a
   heading painted the same colour. --ink on --page measures 9.29:1. */
.about-body h2{font:400 var(--t-l)/1.15 var(--display);color:var(--ink);
  margin:var(--s7) 0 var(--s3);scroll-margin-top:calc(var(--bar-h) + var(--s4))}
.about-body h3{font:700 var(--t-m)/1.25 var(--body);color:var(--ink);
  margin:var(--s5) 0 var(--s2)}
/* THE PROSE LIST, AND IT IS 0,1,1 SO IT BEATS A ONE-CLASS RULE. Every other
   list in this block therefore carries .about-body in its selector too. This
   was found by looking at a screenshot: the jump chips inherited
   flex-direction:column from here and rendered as eight full-width bars. Same
   shape as the ui.css .set-hero .wrap trap CLAUDE.md records -- a correct rule
   at lower specificity that silently never applies. If you add a list here,
   give it two selectors. */
.about-body ul{list-style:none;display:flex;flex-direction:column;gap:var(--s2);
  margin:var(--s3) 0 var(--s5)}
.about-body li{display:flex;gap:var(--s3);align-items:flex-start;color:var(--ink-2)}
.about-body li::before{content:"";flex:none;width:9px;height:9px;margin-top:.55em;
  border-radius:2px;background:var(--mustard);border:1px solid var(--gold-deep);
  transform:rotate(45deg)}
.about-pull{font:400 var(--t-l)/1.2 var(--display);color:var(--ink);
  border-left:5px solid var(--mustard);padding-left:var(--s4);margin:var(--s6) 0}
/* The mark sits BESIDE the line rather than above it, so the rule down the left
   still reads as one pull quote rather than as a rule and then a picture.
   align-items:center against a 64px drawing and one line of display type. */
.about-signoff{display:flex;align-items:center;gap:var(--s4);flex-wrap:wrap}
.about-signoff svg{flex:none;display:block}

/* THE JUMP NAV, and it is here because the page tripled in length. At 390 this
   is now about nine screens of prose, and a reader who came for one of the four
   things it covers should not have to thumb past the other three.
   44px MINIMUM, not 40. WCAG 2.5.5 asks for 44x44 and these are the page's
   primary navigation on a phone. The chips sit on --paper, where --sky-deep
   measures 5.43:1; they must NOT go on --paper-3, which is the LIGHTEST surface
   on this palette and where the same teal drops to 3.60:1 and fails. */
.about-body ul.about-jump{display:flex;flex-direction:row;flex-wrap:wrap;gap:8px;
  margin:0 0 var(--s6);padding:0;list-style:none}
.about-body ul.about-jump li{display:block}
.about-jump li::before{display:none}
.about-jump a{display:flex;align-items:center;min-height:44px;padding:0 var(--s4);
  border-radius:var(--r-pill);background:var(--paper);border:1px solid var(--hair);
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--sky-deep)}
.about-jump a:hover,.about-jump a:focus-visible{border-color:var(--sky-deep)}

/* THE GUIDE INDEX. Each row is a heading, a note and a whole-row tap target,
   which is the shape every list on this site uses: the large target is the
   internal link and nothing competes with it. */
.about-guides{margin:var(--s4) 0 var(--s6)}
.about-gset{margin-bottom:var(--s5)}
/* The flower is the site's own section mark and it sits ON the heading's
   baseline rather than above it, which is what the set guides do with the same
   symbol. flex, so a heading that wraps to two lines keeps the mark beside the
   first word instead of centring it against the block. */
.about-gset h3{margin-top:0;display:flex;align-items:center;gap:var(--s2)}
.about-body ul.about-glist{list-style:none;margin:0;padding:0;display:grid;gap:0}
.about-body ul.about-glist li{display:block;border-bottom:1px solid var(--hair)}
.about-glist li::before{display:none}
.about-glist li:last-child{border-bottom:0}
.about-glist a{display:block;padding:12px 0;min-height:44px}
.about-glist b{display:block;font:600 var(--t-sm)/1.35 var(--body);color:var(--sky-deep)}
.about-glist span{display:block;margin-top:2px;font:400 var(--t-micro)/1.6 var(--body);
  color:var(--ink-2);max-width:44em}
.about-glist a:hover b,.about-glist a:focus-visible b{text-decoration:underline}

/* THE FAQ. Plain headings and paragraphs rather than a disclosure widget: the
   FAQPage block in the head describes this section, and content folded behind a
   summary is content a reader with no script never opens. */
.about-faq h3{font:600 var(--t-sm)/1.4 var(--body);color:var(--ink);margin:var(--s5) 0 6px}
.about-faq p{color:var(--ink-2);margin-bottom:var(--s3)}

.about-side{position:sticky;top:calc(var(--bar-h) + var(--s4));display:flex;
  flex-direction:column;gap:var(--s4)}
@media(max-width:900px){.about-side{position:static}}
.about-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.about-card h3{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.1em;color:var(--ink-2);
  text-transform:uppercase;margin-bottom:var(--s4)}
.stat-row{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s3);
  padding:var(--s3) 0;border-bottom:1px dashed var(--hair)}
.stat-row:last-child{border-bottom:0}
.stat-row b{font:400 var(--t-l)/1 var(--display);color:var(--ink)}
/* THREE ROUTES OUT OF THIS PAGE TOWARDS AN ACTUAL VIDEO. See startHere above.
   TEAL for the title, because teal is how you get around, and --sky-deep
   rather than --sky because the type is small: 4.50:1 on --card #2F4F39
   against --sky's 4.05:1, which fails. The role above it ("Most watched") is
   --ink-2 at 5.73:1, a caption and not a route. Block anchors with the 44px
   minimum every tap target on this site is held to, so the whole two-line row
   is the target rather than the title's text run. */
.about-rips{list-style:none;margin:0;padding:0;display:grid;gap:0}
.about-rips li{border-bottom:1px solid var(--hair)}
.about-rips li:last-child{border-bottom:0}
.about-rips a{display:block;min-height:44px;padding:10px 0;
  font:600 var(--t-sm)/1.35 var(--body);color:var(--sky-deep)}
.about-rips a:hover,.about-rips a:focus-visible{text-decoration:underline}
.about-rips a span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.about-ripnote{margin-top:var(--s3);font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2)}
.about-ripnote a{color:var(--sky-deep);text-decoration:underline}
.stat-row span{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase;text-align:right}
.about-socials{display:flex;flex-direction:column;gap:var(--s2)}
.about-socials a{display:flex;align-items:center;gap:var(--s3);min-height:48px;
  padding:0 var(--s4);border-radius:var(--r-pill);background:var(--page);
  border:1px solid var(--hair);font:600 var(--t-sm)/1 var(--body)}
.about-socials a:hover{border-color:var(--ink)}
.about-socials i{width:11px;height:11px;border-radius:50%;background:var(--pip);flex:none}

/* THE PACK PICTURE. It sits with the paragraph about the sealed wrapper because
   that paragraph describes an object, and the object exists: it is the wrapper
   drawn for this channel, the one every rip page opens with, and it happens to
   carry the Rochester joke the two paragraphs above it are making.
   170px is the drawn width and the file is 400 wide, which is what
   scripts/build-packs.py makes the tile for: "a tile is never wider than about
   200 CSS px, so 400 covers it at 2x". Do not point this at the non-tile file,
   which is 810x1440 and exists for the rip page player. */
.about-pack{display:flex;gap:var(--s4);align-items:flex-start;margin:var(--s5) 0}
.about-pack img{width:170px;height:auto;flex:none;border-radius:6px;
  filter:drop-shadow(0 10px 18px rgba(17,17,17,.22))}
.about-pack figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin:0}
@media(max-width:420px){
  .about-pack{flex-direction:column;align-items:center;text-align:center}
  .about-pack img{width:min(200px,64vw)}
}

/* THE MASCOTS AS CHARACTERS, WHICH IS AN EXCEPTION AND IS DELIBERATE.
   build-search.mjs argues the site's grammar for these two and it is worth
   keeping single: Trubbish means "there is nothing in this one" (the 404, the
   empty filter, a rip with no hits) and Garbodor means "we went through the
   whole heap" (site search finding nothing across 5,181 cards). Everywhere else
   they are EMPTY-STATE MARKS and nothing else, because a mascot that means two
   things means neither.
   THIS PAGE IS THE ONE PLACE THAT CAN SPEND THEM AS CHARACTERS, and there is
   already a precedent for it that is not this file: /games/garbage-run.html
   draws both of them as the thing you play and the thing you evolve into. The
   exception holds here for the same reason it holds there. This section is not
   an empty state, it is the section that EXPLAINS the grammar, so the two
   pictures are the subject of the sentence rather than a stand-in for missing
   content. If a later editor wants them on a third page, make that argument
   first: two exceptions is a decision and three is a pattern, and a pattern
   here costs the empty states their meaning.
   THE ART IS THE SAME PAIR /lore.html DRAWS, at 132px, and the credit line is
   under it in plain text rather than in the footer. This page's footer is
   sliced from index.html and carries no extra clause, and a credit a reader
   cannot connect to the picture is not a credit: that is the shape
   /garbage-plate.html set for its eleven photographs. */
.about-dex{display:flex;flex-wrap:wrap;gap:var(--s4) var(--s5);align-items:flex-start;
  margin:var(--s5) 0 var(--s3)}
.about-dexfig{margin:0;text-align:center;flex:none;width:132px}
.about-dexfig img{display:block;width:132px;height:132px;object-fit:contain}
.about-dexfig figcaption{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);
  letter-spacing:.04em;text-transform:uppercase;margin-top:6px}
.about-dexfig b{display:block;font:400 var(--t-m)/1.1 var(--display);color:var(--ink);
  text-transform:none;letter-spacing:0;margin-bottom:2px}
.about-credit{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin:0 0 var(--s5)}

/* THE THREE PRICE ANCHORS. Same three-up device /what-to-buy.html opens with,
   on purpose. The money is DISPLAY type at --t-l and off-white, not pink: at
   390 --t-l clamps to 22.4px at weight 400, which is UNDER the 24px line WCAG
   needs before the 3:1 gate applies, so a pink number here would be held to
   4.5:1 and #E87EA1 measures 3.45:1 on a card. --ink is 6.70:1 on --card. */
.about-prices{margin:var(--s4) 0 var(--s6)}
.about-price-row{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s3)}
@media(max-width:560px){.about-price-row{grid-template-columns:1fr}}
.about-price{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4)}
.about-price b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ink)}
.about-price strong{display:block;margin-top:6px;font:700 var(--t-micro)/1.3 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.about-price span{display:block;margin-top:6px;font:400 var(--t-micro)/1.6 var(--body);
  color:var(--ink-2)}
.about-prices figcaption,.about-tree figcaption{margin-top:var(--s3);
  font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);max-width:44em}

/* THE INVENTORY BAR. The count is HTML text and the bar is an aria-hidden
   pseudo-object, so nothing about the figure depends on the drawing: see the
   argument beside treeFigure. The fill is --mustard, which on this palette is a
   teal, and the track is --paper; that pair is a graphical object rather than
   text, and 70B5D9 on 264231 measures 4.88:1 against the 3:1 an object needs.
   grid rather than flex so every bar starts on the same vertical however long
   the label runs, which is the whole reason the numbers are readable as a
   column. */
.about-tree{margin:var(--s4) 0 var(--s6)}
.about-body .about-tree ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.about-body .about-tree li{display:grid;grid-template-columns:5.5em 1fr;grid-template-areas:"n l" "n b";
  align-items:baseline;column-gap:var(--s3);row-gap:4px;color:var(--ink-2)}
.about-tree li::before{display:none}
.about-tree b{grid-area:n;font:400 var(--t-m)/1.1 var(--display);color:var(--ink);
  text-align:right;align-self:center}
.about-tree span{grid-area:l;font:400 var(--t-micro)/1.4 var(--body);color:var(--ink-2)}
.about-tree i{grid-area:b;display:block;height:8px;border-radius:4px;background:var(--paper);
  position:relative;overflow:hidden}
.about-tree i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);
  border-radius:4px;background:var(--mustard)}
@media(max-width:420px){.about-body .about-tree li{grid-template-columns:4.6em 1fr}}
${PLATE_CSS}
`;

/* ---------------------------------------------------------------- the order
 *
 * STORY FIRST, REFERENCE SECOND, AND THE GUIDE INDEX MOVED DOWN BECAUSE OF A
 * MEASUREMENT RATHER THAN A PREFERENCE. With the index sitting third, the run
 * from the pack photograph to the next picture was 8,205px at 390x844: three
 * sections and about two thirds of the page with nothing to look at, on a site
 * whose own build guard counts visuals per thousand words. Moving it below the
 * two sections that CARRY pictures (the mascots and the plate) costs nothing --
 * the jump nav reaches it in one tap either way -- and it is the better reading
 * order anyway: who this is, why the site exists, the one thing a stranger most
 * often needs, then the character stuff, then the full index and the questions.
 */
const jump = [
  ["what", "The channel"],
  ["site", "Why this site"],
  ["parents", "For parents"],
  ["mascots", "Trubbish"],
  ["plate", "Garbage Plates"],
  ["sources", "Our numbers"],
  ["guides", "Every guide"],
  ["faq", "Questions"],
];

// The site's own section mark, already in the sprite this page slices out of
// index.html and already the thing a set guide puts before a section label.
// Decorative and aria-hidden: every heading it sits on says the same thing in
// words one character to the right.
const FLOWER = `<svg class="flower" aria-hidden="true"><use href="#fc-flower"/></svg>`;

/* ------------------------------------------------------- what is in the tree
 *
 * THE INVENTORY, DRAWN. It is the same walk the page prints a total for, split
 * by family, and it is here because "1,487 pages" is a number a reader cannot
 * picture: the honest shape of this site is that two thirds of it is one
 * Pokemon per page and a fifth of it is one video per page.
 *
 * THE BAR CARRIES NONE OF THE MEANING, which is the rule the Garbage Plate
 * diagram was built to and the one /shops.html learned the hard way. Every row
 * states its count as ordinary HTML text at a real body size, so the figure
 * survives being read out, being printed in greyscale, or the CSS not arriving
 * at all. The bar is proportional and aria-hidden.
 *
 * A FLOOR ON THE WIDTH, and it is presentation rather than a fib. Linear
 * against 1,026 puts /games/ at six pixels, which reads as a rendering fault
 * rather than as a small number; the floor keeps every row visible and the
 * number beside it is what anybody actually reads.
 */
const TREE_LABELS = [
  ["pokemon", "Pokemon, one page each"],
  ["rip", "Rips, one page per video"],
  ["root", "Guides, tools and top-level pages"],
  ["sets", "Set guides"],
  ["playlists", "Playlists"],
  ["openings", "Sealed products"],
  ["retailers", "Retailers"],
  ["games", "Small games"],
];
/* THE LABELS SAID "Pokemon, one page each" OVER A COUNT OF 1,026, AND THERE ARE
 * 1,025 POKEMON.
 *
 * `fam` is a raw count of .html files per directory, which is exactly right for
 * the arithmetic -- the rows sum to 1,490 and that is the number the paragraph
 * above them claims. What was wrong were the WORDS: four of those directories
 * carry a section index, and an index is a page but it is not one of the things
 * the label names. So this page said 1,026 Pokemon, 42 set guides, 14 sealed
 * products and 6 small games in the tree, while a second block 150 lines below
 * said 1,025, 41, 13 and 5 -- both computed, both shipping, disagreeing by one
 * in four families.
 *
 * Taking the indexes out of each row and giving them a row of their own fixes
 * the labels AND keeps the total, which subtracting alone would have broken.
 * `playlists` and `retailers` are untouched because their index lives at the
 * root as /playlists.html and /retailers.html, and the root row already counts
 * it; only pokemon, sets, openings and games have one inside the directory.
 */
const idx = tree.indexes || {};
const idxTotal = Object.values(idx).reduce((a, b) => a + b, 0);
const treeRows = [
  ...TREE_LABELS.map(([key, label]) => [label, (fam[key] || 0) - (idx[key] || 0)]),
  ...(idxTotal ? [["Section index pages", idxTotal]] : []),
]
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1]);
const treeMax = Math.max(...treeRows.map(([, n]) => n));
const treeFigure = `<figure class="about-tree">
          <ul>
${treeRows
  .map(
    ([label, n]) => `            <li><b>${num(n)}</b><span>${esc(label)}</span>
              <i aria-hidden="true" style="--w:${Math.max(4, Math.round((n / treeMax) * 100))}%"></i></li>`
  )
  .join("\n")}
          </ul>
          <figcaption>Every HTML page in the deploy, counted at build time. Two thirds of the
            site is one Pokemon per page and most of the rest is one rip per page, which is why
            the list below is the part worth reading.</figcaption>
        </figure>`;

/* -------------------------------------------------------- the three anchors
 *
 * The parent section's prices, as the same three-up block /what-to-buy.html
 * opens with. Deliberately the same device on both pages, because it is the
 * same reader at the same moment and a second visual language for one job is
 * just a second thing to learn. The figures come from the lookup above, so the
 * two pages cannot print different numbers for one product.
 */
const PRICE_ANCHORS = [
  [MINI_TIN, "Mini tin", "two packs, and a tin they will keep pencils in"],
  [BUNDLE, "Booster bundle", "six packs and nothing else in the box"],
  [ETB, "Elite Trainer Box", "the one that looks like the obvious present"],
];
const priceFigure = `<figure class="about-prices">
          <div class="about-price-row">
${PRICE_ANCHORS.map(
  ([price, name, note]) => `            <div class="about-price"><b>${esc(price)}</b>
              <strong>${esc(name)}</strong><span>${esc(note)}</span></div>`
).join("\n")}
          </div>
          <figcaption>What Pokemon suggests these cost, read ${esc(msrpRead)}. Not what a shop
            has to charge, and not what you should expect to pay in December.</figcaption>
        </figure>`;

const packFig = avifPicture(
  `<img src="/assets/packs/default-garbage-rips-585-booster-pack-tile.webp"
               width="400" height="711" loading="lazy" decoding="async"
               alt="The Garbage Rips 585 booster wrapper: a blue Pokemon pack with Trubbish sitting on top of a loaded Garbage Plate, booster packs propped around the rim, and a plate label reading Rochester, NY.">`
);

const dexFig = (id, name, label) =>
  `<figure class="about-dexfig">
            <img src="/assets/dex/${id}.webp" width="320" height="320" loading="lazy" decoding="async"
                 alt="${esc(name)}, the ${esc(label)}, in official Pokedex artwork.">
            <figcaption><b>${esc(name)}</b>#${id} &bull; ${esc(label)}</figcaption>
          </figure>`;

const body = `
<main id="main" tabindex="-1" class="about-page">
  <div class="wrap">
    <div class="brk"><h1>About <span class="hl">Garbage Rips 585</span></h1><span class="ln"></span>
      ${/* THE ONLY SUBSCRIBE CONTROL ON THE SITE WITHOUT THE STANDARD LABEL.
            shared/chrome.mjs puts the same sentence on all four of the others,
            the bar pill, the menu pill, the footer button and the one on every
            rip page, and this fifth one is written here rather than imported
            so it was missed. Same words on purpose: a reader listening to the
            page should not be told two different things about one control. */ ""}<a href="${SUBSCRIBE}"
        aria-label="Subscribe to Garbage Rips 585 on YouTube. Opens YouTube.">Subscribe &rarr;</a></div>
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / About</nav>
    <p class="about-lede">Garbage Rips 585 is a Pokemon card channel from Rochester, New York.
      One guy, a camera and a pile of packs. Every rip ever filmed has its own page on this site,
      and wrapped around them is a guide to the rest of it: what cards are worth, where to buy
      them, how the game is actually played, and what to get a kid who has never opened a pack.</p>

    <div class="about-grid">
      <div class="about-body">
        <ul class="about-jump">
${jump.map(([id, label]) => `          <li><a href="#${id}">${esc(label)}</a></li>`).join("\n")}
        </ul>

        <h2 id="what">A Pokemon card channel from Rochester, New York</h2>
        <p>Welcome to Garbage Rips 585, where Pokemon packs get ripped like a late-night
          Garbage Plate after the bars close.</p>

        <p>It is a YouTube channel, running since ${since}, and it goes up <b>every single
          day</b>. Not most days: ${
            dayGaps === 0
              ? `every day. There have been ${num(daySpan)} days since the first rip and all ${num(daySpan)} of them have one on them, which is the whole run with no gap in it`
              : `${num(daySpan - dayGaps)} of the ${num(daySpan)} days since the first rip carry one`
          }. There are ${num(videos.length)} rips up so far, across ${num(setsRipped)} different
          sets, and every one of them has its own page here with the video on it, so nothing on
          this site sends you to YouTube unless you want to go.</p>

        <p>Rochester is not incidental to any of it. This is the 585: Wegmans, the Public Market,
          High Falls, lake-effect weather that arrives sideways in November, and a dinner nowhere
          else in the country makes. The channel is named after the dinner. Around here chaos is a
          lifestyle and ripping packs is just part of the routine.</p>

        <h3>What actually happens on the channel</h3>
        <p>Packs get opened. Most of them are garbage, which is where the name came from.
          Single packs, booster bundles, ETBs, whatever overpriced box was sitting on the
          counter, and every so often an imported pack nobody in the room can read. When
          something good does fall out, the yelling is real. We celebrate every rip, the good
          ones and the bad ones, because a wall of hits is not what opening packs is like. The
          bad ones have a name here and it is the channel's: those are the garbage rips, and
          they get the same airtime as the hits. That is where the line every video opens with
          comes from: <b>Garbage Rips Only! Let&rsquo;s Go!</b></p>

        <p>Then the wrappers go in the bin, and the bin is the other half of the channel. There
          is a Trubbish trash can on the desk and every rip ends the same way: the empties, the
          packaging and the bulk get fed to him on camera. It happens in every single video, and
          it is one of the things people turn up for.</p>

        <p>The can itself is not a prop we made. It is a Pokemon Center item, sold for a limited
          run at the Pokemon Center in Tokyo and never here, and this one was imported from Japan
          to sit on a desk in Rochester and be fed booster wrappers. Which is either the correct
          use of an exclusive collectible or the worst one, depending on who you ask.</p>

        <p>Nobody is going to be smug at you here. If you have never held a card and you
          want to know what the little star in the corner means, that is what the guides on
          this site are for, and asking is the whole point of them.</p>

        <p>One rule everywhere: a thumbnail never shows the pulled card. Every video sits
          behind a sealed wrapper you have to rip open, because the whole point is not
          knowing.</p>

        <figure class="about-pack">
          ${packFig}
          <figcaption>This is the wrapper. Trubbish on a Garbage Plate, Rochester NY on the
            plate label, and the channel name across the bottom. Every rip page on this site
            opens sealed behind one, and the pack that gets torn is the one for that video's
            set. Tap it and it shakes, tears down the middle and the video is already
            playing underneath.</figcaption>
        </figure>

        <h2 id="site">Why this site exists</h2>
        <p>The channel is the fun part. The site is the part that answers questions.</p>

        <p>Every question a new collector has is answered somewhere on the internet, and it is
          answered in twelve different places, half of them trying to sell you something and
          almost none of them saying where the number came from. You should not have to bounce
          around six sites, or interrogate a chatbot, to find out whether forty dollars is a
          normal thing to pay for a booster bundle.</p>

        <p>So this is one place, and it is all in one spot on purpose. How the game is played.
          What a card is worth and who says so. Where to buy, and what each place charges on top.
          What grading costs and whether it is worth doing. Which of the video games came out
          when. The most valuable cards and the most expensive sealed products. And, since we are
          in Rochester, where to get a Garbage Plate.</p>

        <p>There are ${num(tree.total)} pages on the site as it stands. Most of them are one card,
          one set or one rip, and nobody needs most of them. The ${num(guideLinkCount)} pages
          listed further down are the part you would actually read.</p>

        <h2 id="parents">If you are buying cards for a kid</h2>
        <p>This is the question I get asked most, in person, by parents who do not collect and
          are standing in an aisle with no idea what any of it is. It usually arrives with an
          apology attached, and it should not. Nobody explains any of this in the shop. Half this
          site exists because I have given the same answer out loud a dozen times and would
          rather hand over a link.</p>

        ${priceFigure}

        <h3>Roughly what it should cost</h3>
        <p>Pokemon suggests a price for everything it sells and that number is public, so there
          is a right answer to "is this a rip-off". One booster pack is ${PACK}. A booster bundle,
          which is six packs and nothing else in the box, is ${BUNDLE}. The big Elite Trainer Box
          that looks like the obvious birthday present is ${ETB}. Those figures were read
          ${msrpRead} from Pokemon's own shop and from the price references that agree with it.</p>

        <p>A shop asking more than that is not running a scam, it is charging a markup, and you
          are allowed to put it back. <a href="/msrp.html">The MSRP check</a> prices
          ${num(msrpPriced)} kinds of sealed product against the suggested figure so you can do
          the sum in the aisle, <a href="/pack-prices.html">pack prices</a> covers single packs by
          set, and <a href="/how-many-packs.html">how many packs are in that</a> is the number you
          divide by before any of it means anything.</p>

        <h3>What to buy first</h3>
        <p>It depends on which kid you have, and there are two of them.</p>
        <ul>
          <li>If what they love is <b>opening things</b>, buy packs and nothing else: a mini tin
            at ${MINI_TIN} or a booster bundle at ${BUNDLE}. Everything else in a bigger box is
            dice they will lose and sleeves they will not use.</li>
          <li>If what they want is to <b>play the game</b>, do not buy booster packs at all. My
            First Battle at ${FIRST_BATTLE} works for a young kid straight out of the box, and
            Battle Academy at ${BATTLE_ACADEMY} is three finished decks and a rulebook for one who
            can read. You cannot learn this game out of booster packs, and almost everything else
            on that shelf is booster packs.</li>
          <li>If it has to be <b>one box that is obviously A Present</b>, the Elite Trainer Box at
            ${ETB} is the one, and it is the one shops mark up hardest.</li>
        </ul>
        <p><a href="/what-to-buy.html">What should I buy?</a> walks through five situations with a
          photograph of the actual product and the price on each one.</p>

        <h3>Where to buy it</h3>
        <p>Target, Walmart, GameStop, Costco, the grocery store and the local card shop all sell
          this, and they do not stock the same things or charge the same for them.
          <a href="/retailers.html">The shop-by-shop list</a> says what each chain actually
          carries and which aisle it is filed in, with a page of its own for ${num(fam.retailers || 0)}
          of them. <a href="/buying.html">Buying online</a> covers
          the marketplaces and what each one adds in fees.
          <a href="/shops.html">Card shops near Rochester</a> lists the ${num(shopCount)} local
          ones, which is where to go if you want a person to explain it rather than a page.</p>

        <h3>Two things worth knowing before you spend</h3>
        <p>Nobody publishes pull rates. Not Pokemon, not us. Anybody quoting you the odds of a
          good card is guessing, and this site never states them. What it has instead is
          <a href="/luck.html">what actually came out</a>, which counts the results of every pack
          opened on this channel and says in as many words that observed results are not odds.</p>

        <p>And fake cards are real, mostly sold online, and often sold to somebody buying a
          present. <a href="/fake-cards.html">Eight checks that work</a> can be done with the card
          in your hand and no equipment at all.</p>

        <h2 id="mascots">Trubbish and Garbodor</h2>
        <p>Rochester has no official Pokemon. Nobody at City Hall has voted on this and there is
          no plaque. But if this city ever does get a vote, this channel has already cast one and
          it was not close. A place whose most famous dinner is a pile is not getting an elegant
          mascot and should stop trying for one.</p>

        <p>The joke works because we did not have to invent the punchline: the Pokedex files
          Trubbish as the Trash Bag Pokemon and Garbodor as the Trash Heap Pokemon, which
          <a href="/lore.html">the Pokedex facts page</a> prints with its source. So around here
          they are ours, and we celebrate them.</p>

        <div class="about-dex">
          ${dexFig(568, "Trubbish", "Trash Bag Pokemon")}
          ${dexFig(569, "Garbodor", "Trash Heap Pokemon")}
        </div>
        <p class="about-credit">Pokemon artwork from pokeapi.co.</p>

        <p>Trubbish is the one on the front of the wrapper, sitting on a loaded plate, and on this
          site he has one job: he is what you get when there is nothing in it. A search that finds
          nothing, a filter with no videos left, a rip that produced no hits, a page that does not
          exist. Garbodor is the other kind of nothing, the one that means we went through the
          whole heap and it genuinely is not in there.</p>

        <p>And we feed him, which on this channel is not a figure of speech. There is a Trubbish
          trash can sitting on the desk, a Pokemon Center exclusive from a limited run sold only
          in Tokyo and imported to Rochester for exactly this. He is in every video, and the
          last thing that happens in a rip is the wrappers going into him. All the bulk, the packaging, the bad hits, the
          garbage hits, every card that is never going in a binder. It all goes in and he loves
          it. That is how he lives. He lives off garbage rips.</p>

        ${plateRule()}

        <h2 id="plate">Garbage Plates</h2>
        <p>The Garbage Plate is the one food Rochester is known for outside Rochester. Two sides
          on the bottom, meat on top of them, a spiced meat sauce poured over the lot, then raw
          onions and mustard, with bread and butter on the side. Nobody eats one with a plan.</p>

        <p>The name is a federal trademark, held by the restaurant it came from, which is why
          everywhere else in this city sells you a trash plate, a junkyard plate, a compost plate
          or a sloppy plate instead. Same dinner, different two words.</p>

        <p>There is not much good writing about it. What exists is listicles and one origin story
          repeated from page to page with nobody sourcing any of it, which is exactly the gap this
          site is built to fill. So <a href="/garbage-plate.html">the Garbage Plate guide</a> puts
          a source and a read date on every claim it makes, two of them primary: the trademark
          file itself, and the restaurant's own printable order form, which is where the labeled
          drawing of the six layers comes from. It cites ${num(plateSources)} sources, carries
          ${num(platePhotos)} photographs, lists ${num(plateSpots)} places around Rochester that
          serve it with the hours each business states about itself, and prints
          ${num(plateUnsourced)} things people repeat about this dish that we could not source at
          all, out loud, rather than dropping them quietly.</p>

        <h2 id="sources">How the numbers here are worked out</h2>
        <p>This is the boring part and it is the reason to trust the rest of it.</p>
        <ul>
          <li>Every price says where it came from and the day it was read. A card value is a price
            guide value, a suggested price is Pokemon's own shop, and a marketplace price names
            the marketplace. Those are three different things and the pages never blur them.</li>
          <li>Nothing gets published off a single read. The ranked price lists are read twice, by
            two different parsers, and a row where the two disagree is held back with the
            disagreement recorded rather than quietly averaged.</li>
          <li>Pull rates are never stated. The Pokemon Company does not publish them and we are
            not going to invent them.</li>
          <li>Where something could not be sourced, the page says so and lists it. Saying what we
            do not know is the cheapest way to be worth believing about the rest.</li>
          <li>Prices move. If a figure here looks wrong it may well be: check the date printed
            beside it, and tell us on any of the socials, because that is how it gets fixed.</li>
        </ul>

        <h2 id="guides">Every guide on this site</h2>
        <p>${num(tree.total)} pages get built here, and this is the shape of them.</p>

        ${treeFigure}

        <p>${num(guideLinkCount)} of those are written for a person rather than generated for a
          card, and they are grouped below by the question rather than by where the files live.</p>

        <div class="about-guides">
${GUIDES.map(
  ([id, heading, rows]) => `          <section class="about-gset" id="g-${id}">
            <h3>${FLOWER}${esc(heading)}</h3>
            <ul class="about-glist">
${rows
  .map(
    ([href, name, note]) =>
      `              <li><a href="${href}"><b>${esc(name)}</b><span>${esc(note)}</span></a></li>`
  )
  .join("\n")}
            </ul>
          </section>`
).join("\n")}
        </div>

        <h2 id="faq">Questions people actually ask</h2>
        <div class="about-faq">
${FAQ.map(([q, a]) => `          <h3>${esc(q)}</h3>\n          <p>${a}</p>`).join("\n")}
        </div>

        ${/* THE SIGN-OFF, AND THE MARK ON IT IS plateMark() RATHER THAN
              plateRule(). format.mjs allows ONE fleuron per page and this page
              already spent it on the seam above the Garbage Plate section; a
              tagline is not a section break and has no business spending a
              second one. build-games.mjs makes the same distinction for the
              same reason. The bare mark carries no hairlines and is the same
              drawing, so the site still reads as one hand.
              IT MEANS SOMETHING HERE and that is the test a mark has to pass:
              "Grab a fork" is the site's own tagline, it is in the footer of
              every page on this site, and the fork is for the plate. It is
              aria-hidden because the line beside it says it in words. */ ""}<p class="about-pull about-signoff">${plateMark(64)}<span>Grab a fork. Let's rip.</span></p>
      </div>

      <aside class="about-side">
        <div class="about-card">
          <h3>The channel</h3>
          <div class="stat-row"><b>${num(videos.length)}</b><span>rips filmed</span></div>
          <div class="stat-row"><b>${num(setsRipped)}</b><span>sets opened</span></div>
          <div class="stat-row"><b>${num(guideCount)}</b><span>set guides</span></div>
          ${since ? `<div class="stat-row"><b>${since.split(" ")[0].slice(0, 3)} ${since.split(" ")[1]}</b><span>first rip</span></div>` : ""}
        </div>

        ${/* THE SITE CARD IS GONE. The owner, 24 August 2026: "Remove the site stats
              from about.html."
              It counted the site rather than the channel: pages built, Pokemon
              with a page, guides and tools, playlists. Those are facts about a
              build, and a reader on the about page came for the channel. "The
              channel" card above it stays, because rips filmed and sets opened
              are facts about the owner.
              The figures themselves are NOT orphaned by this. `tree.total` and
              the rest still drive the counted-tree figure further down this
              page, which is where a reader who does want the size of the site
              finds it with the breakdown that makes it mean something. Nothing
              was left computing into a void. */ ""}
        ${startHere.length ? `<div class="about-card">
          <h3>Start with these</h3>
          <ul class="about-rips">
${startHere
  .map(
    ({ label, v }) => `            <li><a href="/${esc(v.path)}"><span>${esc(label)}</span>${esc(v.siteTitle || v.title)}</a></li>`,
  )
  .join("\n")}
          </ul>
          <p class="about-ripnote">Every one plays on its own page, behind the wrapper.
            <a href="/videos.html">All ${num(videos.length)} rips</a>.</p>
        </div>` : ""}

        <div class="about-card">
          <h3>Find us</h3>
          <div class="about-socials">
${SOCIALS.map(
  ([cls, label, href]) =>
    `            <a href="${href}" rel="me"><i style="--pip:${
      { yt: "#FF0033", ig: "#BC1888", tt: "#FFFFFF", fb: "#1877F2" }[cls]
    }"></i>${label}</a>`
).join("\n")}
          </div>
        </div>
      </aside>
    </div>
  </div>
</main>`;

/* ------------------------------------------------------------ structured data
 *
 * Organization and AboutPage, cross-linked, with sameAs pointing at every
 * profile. This is what lets a search engine treat the channel, the socials and
 * this site as one thing rather than four unrelated pages, and it is the whole
 * job of an about page for a small brand: not traffic, identity.
 *
 * NO Person BLOCK, and that is deliberate rather than an omission. The site
 * never names the owner on a page a reader sees, so a Person entity here would
 * be publishing an identity the visible page does not, which is the one thing
 * structured data must never do.
 *
 * A BreadcrumbList and an FAQPage were added 21 August 2026. The FAQ block is
 * generated from the SAME array the visible section renders, for the reason
 * build-first-partner.mjs gives: a hand-written copy drifts from the page it
 * claims to describe, and Google can lift one of these answers and show it with
 * no page around it.
 */
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "Garbage Rips 585",
      alternateName: ["GarbageRips585", "Garbage Rips"],
      url: `${SITE}/`,
      // THE SQUARE MARK, NOT THE SHARE BANNER. og-image.jpg is 1200x630; a
      // schema.org Organization logo is meant to be the square brand mark, and
      // logo-square.jpg (760x760) is the one the other five Organization nodes
      // on this site already use. Feeding the wide banner here made /about.html
      // the odd one out at the exact moment a brand new domain is trying to
      // establish one entity rather than two.
      logo: `${SITE}/assets/logo-square.jpg`,
      description:
        "Pokemon card pack ripping channel from Rochester, New York. Hits, heartbreak and pure chaos.",
      foundingDate: oldest || undefined,
      areaServed: { "@type": "City", name: "Rochester", addressRegion: "NY", addressCountry: "US" },
      sameAs: SOCIALS.map(([, , href]) => href),
    },
    {
      "@type": "AboutPage",
      "@id": `${SITE}/about.html`,
      url: `${SITE}/about.html`,
      name: "About Garbage Rips 585",
      about: { "@id": `${SITE}/#org` },
      isPartOf: { "@id": `${SITE}/#org` },
      inLanguage: "en-US",
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "About" },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}/about.html#faq`,
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: stripTags(q),
        acceptedAnswer: { "@type": "Answer", text: stripTags(a) },
      })),
    },
  ],
};

const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf("</header>") + "</header>".length);
const menu = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

// THE BRAND STAYS AT THE FRONT OF THIS TITLE AND THAT IS WRITTEN DOWN IN
// CLAUDE.md. The "| Garbage Rips 585" suffix was stripped from every other
// group because it could only ever truncate; here the brand IS the
// distinguishing word rather than a suffix, so it leads.
//
// AND IT NOW FITS, WHICH IT DID NOT BEFORE. Measured the way CLAUDE.md says to
// measure a title, canvas measureText at 20px Arial in headless Chrome, which
// is what a Google desktop result renders:
//
//   About Garbage Rips 585 | Pokemon Pack Rips from Rochester, NY   597px  OVER
//   About Garbage Rips 585 | Pokemon Rips and Guides from Rochester NY  650  OVER
//   About Garbage Rips 585 | Pokemon Rips, Guides, Rochester NY     577px  fits
//
// The cut is around 580. The old title was 17px over it and had been since the
// suffix sweep of 17 August 2026, which only ever looked at the pages that
// carried the suffix; this page was exempted from that sweep and therefore
// never measured. The comma list is terser than a sentence would be and that is
// what buys the room: it keeps Pokemon, Rips, Guides and Rochester NY, which is
// the whole set of terms this page should answer to, INCLUDING the local one.
// If you lengthen it, measure it.
const TITLE = "About Garbage Rips 585 | Pokemon Rips, Guides, Rochester NY";
// FRONT LOADED, because the tail of this is cut in a result. The first sentence
// is complete on its own and the numbers in it are computed.
const DESC =
  `Garbage Rips 585 is a Pokemon card channel from Rochester, New York: ${num(videos.length)} pack rips across ` +
  `${num(setsRipped)} sets, all of them on this site. Plus ${num(guideLinkCount)} guides covering what cards are worth, ` +
  `where to buy them, how to play, and what to get a kid who is just starting.`;

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(TITLE)}</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(clipMeta(DESC))}">`)
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/about.html">`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/about.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1About Garbage Rips 585`)
  .replace(
    /(<meta property="og:description" content=")[^"]*/,
    `$1One guy in Rochester, New York, ${num(videos.length)} pack rips, and a guide to the rest of the hobby.`
  )
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, "");

await writeFile(
  join(ROOT, "public/about.html"),
  dropUnusedPacksCSS(`<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${miniCSS(style)}</style>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${sprite}

${bar}
${menu}
${body}
${footer}

${APP_JS}
</body>
</html>
`)
);

console.log(`Wrote public/about.html
  ${videos.length} rips, ${setsRipped} sets opened, ${guideCount} set guides, since ${since}
  ${tree.total} pages counted in public/ (${Object.entries(tree.families)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(", ")})
  ${guideLinkCount} guides listed in ${GUIDES.length} groups, ${FAQ.length} FAQ entries
  Organization, AboutPage, BreadcrumbList and FAQPage schema, sameAs across ${SOCIALS.length} profiles`);
if (drift.length) {
  console.log(
    `\n  CHECK THE TREE COUNT. The walk over public/ disagrees with the data that\n` +
      `  determines these families. A stale file left behind by a builder that\n` +
      `  stopped writing a page looks exactly like this:\n    ${drift.join("\n    ")}`
  );
}
