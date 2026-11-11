#!/usr/bin/env node
// Generate /search.html and the index behind it.
//
//   node scripts/build-search.mjs   (run AFTER the pages it indexes)
//
// The bar search used to post to /videos.html, so it searched 310 rips and
// nothing else. That was right when rips were the whole site. It now sits above
// every card, every set guide, every Pokemon page and a dozen reference pages, and
// typing "umbreon" into it and getting only videos undersold everything else.
//
// TWO INDEXES, LOADED SEPARATELY, ON PURPOSE. The site index (rips, guides,
// sets, Pokemon) is small and loads immediately. The card index is 47KB gzipped
// and only loads when the query looks like it might be a card, or when the
// visitor asks for card results. Most searches never need it.
//
// Results are grouped rather than blended into one relevance-ranked list,
// because a card, a video and a guide are not competing answers to the same
// question. Somebody searching "charizard" may want any of the three, and a
// blended list buries two of them under whichever matched a string better.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { GUIDES_OUTSIDE_SETS } from "../shared/guide-count.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { showPagePlan } from "../shared/show-pages.mjs";
import { localDay } from "../shared/today.mjs";
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
import { esc, clipMeta} from "../shared/format.mjs";
import { NORM_SRC, PARSE_SRC, SCORE_SRC } from "../shared/search-text.mjs";
import { FUZZY_SRC, assertFuzzy } from "../shared/fuzzy-text.mjs";
import { CARD_NUMBER_SRC, parseCardNumber } from "../shared/card-number-query.mjs";
import { labelFor } from "../shared/taxonomy.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { videos } = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

let intl = {};
try {
  intl = JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {};
} catch {
  /* optional */
}
let playlistPages = [];
try {
  playlistPages = (JSON.parse(await readFile(join(ROOT, "public/data/playlists.json"), "utf8")).playlists || [])
    .filter((p) => p.path);
} catch {
  /* run: node scripts/build-playlists.mjs */
}
let pokemon = [];
try {
  pokemon = JSON.parse(await readFile(join(ROOT, "public/data/pokemon-index.json"), "utf8")).pokemon || [];
} catch {
  /* optional */
}
// The per-shop pages under /retailers/. Read from what build-retailers.mjs
// actually wrote rather than hand-listed in PAGES, for the reason the comment
// over PAGES gives: four pages once shipped with no entry and were invisible to
// the site's own search for as long as they existed. The guard at the foot of
// this file only walks the top level, so a subdirectory is exactly where that
// mistake would happen again unnoticed.
let retailerPages = [];
try {
  retailerPages = JSON.parse(await readFile(join(ROOT, "public/data/retailers-index.json"), "utf8")).pages || [];
} catch {
  /* run: node scripts/build-retailers.mjs */
}

/* THE SAME FIX FOR /openings/, AND THE COMMENT ABOVE PREDICTED THE BUG.
 *
 * It says the guard at the foot of this file walks only the top level, "so a
 * subdirectory is exactly where that mistake would happen again unnoticed". It
 * did. All THIRTEEN sealed-product pages were unsearchable: "elite trainer box"
 * answered 2 here against 58 on /videos.html, and "booster box", "ultra premium
 * collection" and "japanese pack" answered nothing at all, while a page titled
 * with each of those questions sat in the sitemap.
 *
 * Read from what build-openings.mjs wrote, exactly like the retailers above, so
 * a new product kind is a data edit rather than a line here to remember. */
/* THE CARD SHOW PAGES UNDER /shows/, the third subdirectory and the same trap:
 * the guard at the foot of this file walks only the top level. Not read off
 * disk like the two above. shared/show-pages.mjs decides which pages exist
 * from data/shows.json and the day, and build-shows.mjs draws that same list,
 * so this is the list itself rather than a copy of it. Indexable ones only: a
 * series with no dates left is built noindex and is not a search result. Each
 * is a [title, path, sub] triple; a series is titled with the show's own name,
 * because "Batavia Pokemon show" is what somebody types. */
const showPages = showPagePlan(
  JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8")), localDay()
).indexable.map((p) => p.search);

let openingPages = [];
try {
  openingPages = JSON.parse(await readFile(join(ROOT, "public/data/openings-index.json"), "utf8")).pages || [];
} catch {
  /* run: node scripts/build-openings.mjs */
}

// The reference pages, named here because a page has no other machine-readable
// title. Kept in one list so a new page is one line rather than a grep.
//
// "One line rather than a grep" only works if somebody adds the line, and four
// pages went in without one: games, lore, creators and vendors were all
// unsearchable on a site whose nav search is the main way around it. The guard
// at the bottom of this file now fails the build instead of trusting that.
const PAGES = [
  ["/start.html", "Start here", "New to Pokemon cards, the six questions in order"],
  // SECOND, AND IT COSTS A CARD OFF /search.html's EMPTY STATE, which shows the
  // first eight of this list. That is a deliberate consequence and not a side
  // effect nobody looked at, the same trade the two app pages below record
  // making. The displaced card is "Browse by Pokemon", which is one tap from the
  // card search directly above it and is in the nav twice over.
  //
  // THE TITLE IS THE QUESTION, VERBATIM, because that is what somebody types.
  // "what should i buy my kid pokemon cards" is a real query with no good answer
  // anywhere, and the blurb leads with the word a parent is actually anxious
  // about, which is the price rather than the product.
  ["/what-to-buy.html", "What should I buy?", "For a parent or a beginner: what to get, what it should cost, and what not to buy first"],
  ["/how-to-play.html", "How to play", "The card game itself: setup, a turn, and the three ways to win"],
  // THE TITLES LEAD WITH THE APP NAMES, unlike the nav labels next door, because
  // search is where somebody types "TCG Live" or "pocket". Both sit inside the
  // first eight, which is also what /search.html shows as its empty state, so
  // adding them pushed two cards off the bottom of that grid. That is the right
  // trade for two pages this useful and it is a deliberate consequence rather
  // than a side effect nobody looked at.
  ["/tcg-live.html", "Pokemon TCG Live and code cards", "What the code card in every booster pack gives you, and the free official app it opens"],
  ["/tcg-pocket.html", "Pokemon TCG Pocket", "The free phone version, what it teaches you, and how its rules differ from real cards"],
  // The two deck pages. The first title leads with "Deck builds" because that
  // is the thing somebody types; the second says "most played" rather than
  // "best" because that is the only claim either page actually makes, and the
  // search blurb is not the place to widen it.
  ["/decks.html", "Deck builds to download", "The most played Standard decks, with lists that paste straight into Pokemon TCG Live"],
  ["/top-100-playable.html", "Top 100 cards to play", "The cards played most in Standard decks, counted across hundreds of tournament lists"],
  ["/cards.html", "Card search", "Every card by name with current prices"],
  ["/pokemon/", "Browse by Pokemon", "Every card of one Pokemon across every set"],
  ["/sets/", "Set guides", "Card counts, rarities and chase cards per set"],
  ["/rarity.html", "Rarity guide", "What the symbols mean and what is actually rare"],
  ["/types.html", "Card types", "All 11 types, and why there is no type chart in the card game"],
  ["/fake-cards.html", "Real or fake?", "Eight checks for spotting a counterfeit"],
  // THE TITLE LEADS WITH THE THREE WORDS SOMEBODY TYPES. "Base Set print runs"
  // is what the page is about and nobody searches for it; "1st Edition,
  // Shadowless or Unlimited" is the actual query, three times over. The blurb
  // names the two marks rather than promising a valuation, because the page
  // prices exactly one card and says so.
  ["/base-set.html", "1st Edition, Shadowless or Unlimited?", "Telling the 1999 Base Set print runs apart: the stamp, the drop shadow, and what the gap is worth"],
  ["/grading.html", "Worth grading?", "What grading costs and whether it pays"],
  // THE BLURB SAYS "PSA 10 VALUES", NOT "MOST VALUABLE", and that is the same
  // discipline the two deck lines above are keeping. "Most valuable graded
  // Pokemon cards" is what somebody types, and it is a claim the page cannot
  // make: it ranks one price guide's PSA 10 column, because the auction-record
  // version could not be sourced. Search copy that promises the list nobody
  // could build is how the careful title gets undone one blurb at a time.
  ["/top-graded.html", "Highest PSA 10 values", "The 100 highest PSA 10 price guide values in Pokemon, ranked across 793 sets with the source on every row"],
["/games/garbage-run.html", "Garbage Run", "A one thumb arcade game for the restock line, solo or two players on one phone"],
// THE BLURB NAMES THE DECK, NOT THE GENRE. "A memory game" is a thing a
// thousand pages are; what nobody else has is a concentration board dealt from
// the hundred most valuable ungraded cards in Pokemon, which is also the one
// fact that tells a searcher whether they want this page or /most-valuable-cards.html.
["/games/chase-match.html", "Chase Match", "A memory game played with the 100 most valuable ungraded Pokemon cards: flip two, match the card, see what it is worth"],
["/openings/", "Sealed products", "What is in an ETB, a bundle, a blister, and every one we opened"],
["/will-it-grade.html", "Will it grade?", "Centering tolerances, the flaws that cost grades, and how to check a card at home"],
["/selling.html", "Where to sell", "eBay, TCGplayer, Whatnot and more: fees, payouts and who protects a seller"],
["/buying.html", "Where to buy", "TCGplayer Direct, eBay, Pokemon Center and the big boxes: shipping thresholds, buyer fees and recourse"],
  // THE TITLE LEADS WITH "STORES" because that is the word in the query. Nobody
  // types "retailers"; they type "stores that sell pokemon cards" or "does CVS
  // sell pokemon cards", and the nine per-shop pages that answer the second
  // shape are appended to this index below rather than listed here, so adding a
  // shop is a data edit rather than a line in this file.
  ["/retailers.html", "Stores that sell Pokemon cards", "Which shops stock them, what each one carries, which aisle they file them under, and what we have read them asking"],
  ["/complete-a-set.html", "Cost to complete a set", "What every set costs to finish, priced nightly"],
  ["/drops.html", "Drops this week", "Where stock is expected, in store and online"],
  // THE TITLE LEADS WITH "MSRP" because that is the word somebody types, and the
  // blurb says "should" rather than "does" on purpose: the page next door prices
  // what things actually sell for, this one is the retail figure to measure that
  // against. The two are one keystroke apart in this list and must not read alike.
  ["/msrp.html", "MSRP: what it should cost", "Retail prices for every sealed product, so you can check what a shop is asking"],
  // "BOOSTER BOX" IS SPELLED OUT IN BOTH (14 October 2026). It is the most
  // asked-about sealed product and neither line named it, so the query
  // answered "Nothing matched" while these two pages cover it 36 and 20 times.
  ["/pack-prices.html", "Pack prices by set", "What one pack costs, booster box against bundle against loose"],
  ["/how-many-packs.html", "How many packs are in it?", "Every sealed product from booster box down to blister, and how the counts changed"],
  ["/what-set.html", "What set is my card from?", "Look up the number printed after the slash"],
  ["/luck.html", "How our luck is going", "What actually comes out of the packs"],
  ["/upcoming.html", "Coming next", "Upcoming sets and preorder prices"],
  // THE TITLE IS THE PRODUCT'S FULL NAME because that name IS the query. This
  // is the one page on the site built for a search almost nobody else has
  // answered: the product is 2026, the coverage is a news post and a forum
  // thread, and nowhere else lists all 27 cards with a price on each.
  [
    "/first-partner-illustration-collection.html",
    "First Partner Illustration Collection",
    "All 27 promos with prices, what is in the box, and the panorama artwork",
  ],
  [
    "/30th-celebration.html",
    "30th Celebration",
    "Every product and date, what is in a pack, Japan's full card list, and the master set",
  ],
  ["/expansions.html", "Every set ever", "The complete expansion list"],
  // The two ranked price lists. Both are one line each here for the reason the
  // comment above PAGES gives: four pages once shipped without one and were
  // unsearchable on a site whose nav search is the main way around it.
  ["/most-valuable-cards.html", "Most valuable cards", "The 100 most valuable ungraded Pokemon cards in PriceCharting's guide, dated"],
  // THE TITLE LEADS WITH "TOPPS" because that is the whole of what somebody
  // types, and the blurb leads with what the cards are rather than what they are
  // worth: the commonest way to arrive at this page is holding one and not
  // knowing what it is. The values page says "top 100s" rather than "most
  // valuable", the same discipline the top-graded line above keeps: it ranks two
  // price guide columns read on one day and the blurb must not upgrade that.
  ["/topps.html", "Topps Pokemon cards", "The trading cards Topps made from 1999 to 2004, every set, and how to tell one from a real TCG card"],
  ["/jumbo-cards.html", "Jumbo cards", "Oversize Pokemon cards: how big they are, which products include one, why they cannot be played, and what they are worth"],
  ["/topps-card-values.html", "Topps card values", "Two top 100s of Topps Pokemon cards, ranked raw and by PSA 10 from PriceCharting's guide, dated"],
  ["/most-expensive-sealed.html", "Most expensive sealed", "The 100 most expensive sealed Pokemon products on TCGplayer, dated"],
  ["/hall.html", "Hall of Fame", "The best pulls on the channel"],
  ["/wanted.html", "Most wanted", "The cards still being chased"],
  // THE HUB ABOVE THE FIVE LOCAL PAGES, and it goes IMMEDIATELY BEFORE THEM
  // rather than at the end of this list with the other two it belongs with,
  // because a reader who types "rochester" should be offered the page that
  // routes to all five before any one of them.
  //
  // THE TITLE IS THE SEARCH AND NOT THE NAV LABEL. The menu calls this "The
  // local scene", which is right in a group already headed Rochester, NY and
  // useless here: nobody types "the local scene". They type "pokemon rochester
  // ny" or "pokemon cards rochester", so the title carries the three words and
  // the blurb carries the two things that make this page different from every
  // other result for that query, which are that the shows and the shops are on
  // it and that somebody local can get themselves listed on it.
  ["/rochester.html", "Pokemon in Rochester, NY", "Everything local in one place: the card shows, the shops, the vendors and creators around the 585, and the Garbage Plate"],
  ["/card-shows.html", "Card shows", "Shows around Rochester, NY, Buffalo and Syracuse"],
  ["/card-show-101.html", "Card show 101", "What happens at a card show if you have never been"],
  ["/shops.html", "Card shops and where to play", "Local shops and league nights"],
  ["/videos.html", "All rips", "The full video library"],
  ["/playlists.html", "Playlists", "Rips grouped into playlists"],
  // THE THREE THAT WERE MISSING, and the hub's own count was wrong alongside
  // them. /games/ said "Three Pokemon games" over a directory holding five, and
  // guess-the-set, pokemon-trivia and whos-that-pokemon had no index entry at
  // all, so the site's own search could not find three of its five games.
  // Titled the way they are SEARCHED rather than the way the <title> tag reads:
  // somebody types "whos that pokemon", not "Silhouette Quiz".
  ["/games/", "Games", "Five Pokemon games for the wait in line"],
  ["/games/whos-that-pokemon.html", "Who's That Pokemon?", "Name the Pokemon from its silhouette. The original 151 or all 1,025"],
  ["/games/guess-the-set.html", "Guess the Set", "A real card scan, four sets, one right answer. 130 sets and 3,380 cards"],
  ["/games/pokemon-trivia.html", "Pokemon Trivia", "1,400 questions generated from real Pokedex data"],
  ["/lore.html", "Pokemon lore", "Facts computed from the National Pokedex"],
  // THE TITLE LEADS WITH "EVOLUTION" because that is the whole of what somebody
  // types, and the blurb names the condition rather than the chart: "pokemon
  // evolution chart" gets you a picture everywhere on the web, and what people
  // are actually after is what the arrow costs.
  ["/evolution.html", "Evolution chart", "Every line drawn, with what each step actually takes"],
  // Its own entry rather than being folded into the line above, because it is
  // asked as its own question. Nobody searching "how do I get Umbreon" is
  // browsing a chart.
  ["/eevee-evolutions.html", "Eevee evolutions", "All eight Eeveelutions, and exactly what each one needs"],
  ["/video-games.html", "Every Pokemon video game", "Covers, release dates, platforms and Metascores, 1996 to now"],
  ["/creators.html", "Local creators", "Other Rochester, NY card channels worth watching"],
  // The blurb leads with the trademark date rather than with "the Rochester
  // dish", because the date is the surprising checkable fact and every other
  // page about this dish opens with the summary.
  ["/garbage-plate.html", "Garbage Plate", "What is a Garbage Plate: the dish this channel is named after, sourced, with a diagram and how to order one"],
  // The directory, split off the guide on 23 September 2026 when the list went
  // from 11 places to 52. Its own row because "where can I get one" is its own search.
  ["/where-to-get-a-garbage-plate.html", "Where to get a Garbage Plate", "Every place around Rochester, NY that serves a plate, by area, with hours and an open now filter"],
  ["/vendors.html", "Local vendors", "Who sells cards around Rochester, NY"],
  // Indexable, so build-search.mjs requires it here: the check exists because
  // four pages once shipped invisible to the site's own search.
  ["/privacy.html", "Privacy", "Cookies, analytics and what this site does not do"],
  // The show archive. Listed here BEFORE it is indexable rather than when: this
  // file fails the build on an INDEXABLE page missing from PAGES, and the
  // archive's noindex lifts by itself on 30 August, which would have failed a
  // nightly build nobody was watching.
  ["/past-shows.html", "Past card shows", "Shows around Rochester, NY that have already happened, with the flyers"],
  ["/about.html", "About", "Who this is and why"],
];

// Read from the card index rather than typed in. Written down, it was correct
// today and guaranteed to be a lie the first time a set is added.
let nCards = 0;
try {
  nCards = (JSON.parse(await readFile(join(ROOT, "public/data/card-index.json"), "utf8")).cards || []).length;
} catch {
  /* run: node scripts/sync-cards.mjs */
}

// [title, url, sub] for everything except cards.
// id -> display name, so a rip tagged `pitch-black` is findable by typing
// "Pitch Black". sets.json is already read above for the set-guide rows.
const setNameById = new Map(sets.map((x) => [x.id, x.name]));

const index = {
  pages: [
    ...PAGES.map(([url, title, sub]) => [title, url, sub]),
    // Playlists are named runs people ask for by name ("the Pitch Black ETB
    // marathon"), so they belong in the search rather than only behind the
    // playlists index. Read from the stamped data, never re-slugged here.
    ...playlistPages.map((p) => [
      p.title,
      `/${p.path}`,
      `Playlist • ${p.count} video${p.count === 1 ? "" : "s"}`,
    ]),
    // THE SHOP NAME IS THE TITLE AND THE QUESTION IS THE BLURB, not the other
    // way round. Somebody typing "gamestop" into the bar is looking for a shop,
    // and nine results all beginning "Does" would be nine near-identical strings
    // to scan past. The question still earns its place underneath, because it is
    // what the page answers and it is what was typed into a search engine.
    ...retailerPages.map((p) => [p.name, p.path, p.sub]),
    // The thirteen sealed-product pages. Already [title, path, sub] triples in
    // the file build-openings.mjs writes, so they spread straight in.
    ...openingPages,
    // One per recurring card show and one per area. See showPages above.
    ...showPages,
  ],
  sets: [
    ...sets.map((s) => [s.name, `/sets/${s.id}.html`, `${s.total || "?"} cards${s.released ? ` • ${s.released.slice(0, 4)}` : ""}`]),
    ...Object.entries(intl).map(([id, g]) => [
      g.english,
      `/sets/${id}.html`,
      `${g.langName}${g.native ? ` • ${g.native}` : ""}`,
    ]),
  ],
  pokemon: pokemon.map((p) => [p.name, `/pokemon/${p.slug}.html`, `${p.cards} cards across ${p.sets} sets`]),
  /* A FOURTH FIELD ON EVERY RIP: WHAT THE VIDEO IS ABOUT, NOT WHAT IT IS CALLED.
   *
   * A rip's title is a hook, not a description. Measured across all 322:
   *   156 carry a hitCard the title never mentions
   *   126 carry a set tag the title never mentions
   *   185 carry a product tag the title never mentions
   * So "elite trainer box" answered 2 here while /videos.html answered 58, and
   * "double rare" answered 1 against 100. Both pages read the same catalogue;
   * only this one was searching the wrong part of it.
   *
   * Field [3] rather than [2] because [2] is the published date and the row
   * renderer prints it. `hits()` is told which field to search per list.
   *
   * TAG IDS ARE EXPANDED TO WORDS. The file stores "etb" and "single-pack";
   * nobody types those. labelFor() is the same translation /videos.html uses for
   * its filter chips, so a search and a chip mean the same thing by the same
   * word. The raw id is kept alongside, because "etb" IS typed.
   *
   * 14 OCTOBER 2026: THE PARAGRAPH ABOVE WAS TRUE OF THE INTENT AND NOT OF THE
   * CODE. labelFor takes (group, id) and was being called labelFor(x), so it
   * looked the slug up in a group named after itself, found nothing, and
   * returned the slug: every row said "etb etb", "elite trainer box" found 1
   * rip while "etb" found 63, "booster box" found nothing at all, and pulls
   * were never expanded either, so "double rare" was matching titles only.
   * The group is passed now, for products and pulls.
   */
  rips: videos.map((v) => [
    v.title,
    `/${v.path}`,
    v.published,
    [
      ...(v.sets || []).map((x) => `${x} ${setNameById.get(x) || ""}`),
      ...(v.products || []).map((x) => `${x} ${labelFor("products", x) || ""}`),
      ...(v.pulls || []).map((x) => `${x} ${labelFor("pulls", x) || ""}`),
      v.hitCard || "",
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  ]),
  // THE BROWSER USED TO CARRY ITS OWN COPY OF THIS NUMBER, typed into the
  // placeholder as "4,481 cards". It was true when it was written and false the
  // moment a set was added: the page said 5,181 in three places and 4,481 in
  // the fourth, and no check caught it because both are valid strings. The
  // count ships with the index now, from the same read that produces it.
  cardCount: nCards,
  // [released, printedTotal, promo, subsets] per set slug, the shape
  // printedForm() in shared/card-number-query.mjs reads, so a card row here
  // prints "113/088" the way /cards.html and the set guides do, and a typed
  // "113/088" can pick the set that prints 88. Every card-index set has a
  // guide, so sets.json is the whole of it; card-index holds no subset
  // numbers (TG, GG, SV), so there are none to total. 2 October 2026.
  cardSets: Object.fromEntries(sets.map((x) => [x.id, [x.released || "", x.printedTotal || 0, 0, 0]])),
};

await writeFile(join(ROOT, "public/data/site-index.json"), JSON.stringify(index) + "\n");

// The card number reader ships as source. build-cards.mjs proves it at length;
// this proves the copy THIS page inlines still runs and still agrees, so the
// page cannot ship a reader that throws on the first keystroke.
{
  const shipped = new Function(`${CARD_NUMBER_SRC}\n return parseCardNumber;`)();
  for (const q of ["113/088", "018/072", "pikachu 25", "TG05", "pikachu"]) {
    if (JSON.stringify(shipped(q)) !== JSON.stringify(parseCardNumber(q))) {
      throw new Error(`the parseCardNumber inlined into search.html disagrees with the module on "${q}"`);
    }
  }
}

const total =
  index.pages.length + index.sets.length + index.pokemon.length + index.rips.length;

const nCardsText = nCards.toLocaleString("en-US");
// THE POKEMON COUNT IS FOUR DIGITS TOO AND WAS THE ONLY ONE PRINTED BARE. The
// same sentence read "5,181 cards ... 1025 Pokemon", and /lore.html writes the
// same figure "1,025". Every four-digit number on the site is grouped, so this
// one read as a typo sitting between two that were not.
const nDexText = index.pokemon.length.toLocaleString("en-US");

const desc = `Search everything on Garbage Rips 585: ${index.rips.length} pack openings, ${nCardsText} cards, ${index.sets.length + GUIDES_OUTSIDE_SETS.length} set guides and every reference page.`;

/* WHERE A FAILED SEARCH SENDS YOU NEXT (11 November 2026).
 *
 * The no-results state said "Nothing matched" twice, once in the status line
 * and once in the panel, and then stopped: the one moment on the site where a
 * reader has definitely just failed at something, and the page offered them
 * nothing to press. These eight are the places most searches were headed
 * anyway. Titles and blurbs are read out of PAGES by url rather than retyped,
 * so a renamed page renames its card here, and a url that leaves PAGES fails
 * the build instead of shipping a dead link.
 */
const POPULAR = [
  "/sets/", "/cards.html", "/card-shows.html", "/videos.html",
  "/hall.html", "/what-to-buy.html", "/msrp.html", "/drops.html",
].map((url) => {
  const hit = PAGES.find((x) => x[0] === url);
  if (!hit) throw new Error(`build-search: POPULAR names ${url}, which is no longer in PAGES`);
  return hit;
});
const POPULAR_HTML =
  `<section class="sg" aria-labelledby="sqPopH"><h2 id="sqPopH">Popular places to start</h2><div class="set-index sq-pop">${POPULAR.map(
    ([url, title, sub]) =>
      `<a class="set-card" href="${esc(url)}"><span><span class="ttl">${esc(title)}</span><br><span class="meta">${esc(sub)}</span></span></a>`,
  ).join("")}</div></section>`;

// The typo matcher ships as source. Prove the copy this page inlines before a
// reader does.
assertFuzzy();

/* THE ONE RULE THIS PAGE NEEDS THAT ui.css DOES NOT HAVE. .cq-status is 11px
   uppercase mono, which is right for "29 RESULTS" and wrong for a sentence
   with the reader's own words quoted in it: uppercasing a query turns
   "charzard" into something they did not type. The script adds sq-plain when
   the line is a sentence and removes it when it is a count. --ink on --page
   is the body text pair, so no new contrast to measure. */
const SEARCH_CSS = `<style>
.cq-status.sq-plain{font:400 var(--t-sm)/1.5 var(--body);letter-spacing:0;text-transform:none;color:var(--ink)}
.sq-pop{margin-top:var(--s4)}
.empty + .sg{margin-top:var(--s6)}
</style>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Search | Garbage Rips 585</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/search.html">
<meta name="robots" content="noindex,follow">
<meta property="og:title" content="Search Garbage Rips 585">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/search.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-image.jpg?v=2">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg?v=2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
${SEARCH_CSS}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">

<section class="tight">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Search</nav>
    <h1 class="sr-h1">Search</h1>
    <form class="cardsearch" role="search" onsubmit="return false">
      <label class="sr-only" for="sq">Search the site</label>
      <input id="sq" type="search" placeholder="Umbreon, Pitch Black, grading, card shows..." autocomplete="off" enterkeyhint="search" autofocus>
    </form>
    <p class="cq-status" id="sqStatus" aria-live="polite"></p>
    <div id="sqOut"></div>
    <div id="sqEmpty">
      <p class="cq-head">Searches ${index.rips.length} pack openings, ${nCardsText} cards, ${index.sets.length + GUIDES_OUTSIDE_SETS.length} set guides,
        ${nDexText} Pokemon and every guide on the site.</p>
      <div class="set-index" style="margin-top:var(--s5)">
        ${PAGES.slice(0, 8)
          .map(
            ([url, title, sub]) => `<a class="set-card" href="${esc(url)}">
          <span><span class="ttl">${esc(title)}</span><br><span class="meta">${esc(sub)}</span></span>
        </a>`
          )
          .join("\n        ")}
      </div>
    </div>
  </div>
</section>

</main>
${/* THE CREDIT IS THE CONDITION OF THE PICTURE, not a nicety. The Garbodor the
      no-results state draws is official artwork mirrored from the PokeAPI
      sprite repository by scripts/sync-species-art.mjs, and this site's licence
      for that imagery is that its source is named. /lore.html, /evolution.html,
      /eevee-evolutions.html and all 1,026 Pokemon pages already say it; this
      page had no such line because until now it had no such picture.

      IN THE FOOTER RATHER THAN BESIDE THE MASCOT because the mascot is
      client rendered and only some readers ever see it, and a credit that
      appears only when a search fails is a credit that is usually absent. The
      extra argument to footer() is the site's own mechanism for this and it is
      the same call build-lore.mjs makes. It adds a line and takes nothing
      away: the Collectr link and the Unableplacebo credit are untouched. */ ""}${footer("Pokemon artwork from pokeapi.co.")}
<script>
(function(){
  var input=document.getElementById('sq');
  var out=document.getElementById('sqOut'), status=document.getElementById('sqStatus');
  var empty=document.getElementById('sqEmpty');
  var SITE=null, CARDS=null, cardsTried=false, siteFailed=false, cardsFailed=false;

  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function money(n){
    return typeof n==='number' ? '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '';
  }

  function group(title, rows, more, allHref){
    if(!rows.length) return '';
    var note='';
    if(more){
      note='<p class="price-note">'+esc(more)
        + (allHref?' <a href="'+esc(allHref)+'">See them all</a>.':'')
        + '</p>';
    }
    return '<section class="sg"><h2>'+esc(title)+'</h2><ol class="cq-list">'
      + rows.join('') + '</ol>'+note+'</section>';
  }
  function row(title, url, sub, right){
    return '<li class="cq">'
      + '<a class="cq-name" href="'+esc(url)+'">'+esc(title)+'</a>'
      + (sub?'<span class="cq-set">'+esc(sub)+'</span>':'')
      + (right?'<span class="cq-pr">'+right+'</span>':'')
      + '</li>';
  }

  // Returns {rows, total} so a group can say how much it is hiding. Capping
  // silently is the bug: "chaos rising" matched 39 rips, showed 10, and said
  // nothing, on the page whose whole job is finding things.
  // THE MATCHER. See shared/search-text.mjs for why this is inlined from there
  // rather than written here, and for the list of real queries the old
  // one-line indexOf returned ZERO results for.
  ${NORM_SRC}
  ${PARSE_SRC}
  ${SCORE_SRC}
  // The card number reader /cards.html uses, from shared/card-number-query.mjs.
  ${CARD_NUMBER_SRC}
  // The typo matcher, from shared/fuzzy-text.mjs. Read the rules there.
  ${FUZZY_SRC}

  // norm() IS MEMOISED HERE, because scoreRow folds the row's title and blurb
  // on every call and a relaxed search makes up to five passes over 7,000
  // rows. The fold is the expensive part (a Unicode normalize and five
  // regular expressions) and its input is the same few thousand strings every
  // time. Same function, same answers; the Map only remembers them.
  var normRaw=norm, NORMED=new Map();
  norm=function(str){
    var k=String(str==null?'':str), v=NORMED.get(k);
    if(v===undefined){ v=normRaw(k); NORMED.set(k,v); }
    return v;
  };

  /* FORGIVING SEARCH, 11 November 2026. Measured on the built site before
     this: "delta rein", "charzard", "delta reign card list", "card shows near
     me" and "etb price" all answered "Nothing matched", while "delta reign"
     answered 143 and "card shows" answered 3. Every word had to match, a
     filler word counted as a word, and one wrong letter was a miss.

     THE LADDER. Each rung runs ONLY IF THE ONE ABOVE FOUND NOTHING, so a
     search that already worked returns exactly what it returned before:
       1  every word matches, as typed. This is the old search, untouched.
       2  the filler words are dropped ("near me", "price", "list", "how do
          i") along with a trailing "card", "cards" or "pokemon"; then those
          three wherever they sit, if that still finds nothing. Never down to no words at all: "price" alone stays "price".
       3  typo tolerance, by the rules in shared/fuzzy-text.mjs: a word may
          stand for an index word one edit away (two for 8 letters or more),
          and never a short word or a number.
       4  any word, ranked by how many of them a row has.
     "what to buy", "how to play" and "where to sell" are page titles made
     almost entirely of filler, which is why rung 1 comes first and the filler
     list is not applied up front.

     WHEN A LOWER RUNG ANSWERS, THE STATUS LINE SAYS SO, with the reader's
     words and the words actually searched, so a result for "charizard" under a
     query of "charzard" never reads as the site ignoring what was typed. */
  var FILL={the:1,a:1,an:1,of:1,'for':1,'in':1,on:1,at:1,to:1,and:1,near:1,me:1,my:1,
    list:1,lists:1,price:1,prices:1,what:1,is:1,how:1,'do':1,i:1,where:1,can:1,get:1,buy:1};
  var FILL_SOFT={card:1,cards:1,pokemon:1};
  function strip(terms, soft){
    var out=[], i;
    for(i=0;i<terms.length;i++){
      if(!FILL[terms[i]] && !(soft && FILL_SOFT[terms[i]])) out.push(terms[i]);
    }
    // A TRAILING "card" IS FILLER ON THE FIRST PASS; A LEADING ONE IS NOT.
    // "delta reign card list" means Delta Reign, and keeping "card" found one
    // row (the guide, whose blurb says "141 cards") instead of 143. "card
    // shows near me" means card shows, and dropping "card" there would search
    // "shows". The word in front of another word is naming something.
    if(!soft) while(out.length>1 && FILL_SOFT[out[out.length-1]]) out.pop();
    return out;
  }

  // Every word in the index, counted, for the typo rung. Built on first need,
  // never on page load: most searches match on rung 1 and never ask for it.
  // The Pokemon and set blurbs are left out on purpose. They are a thousand
  // copies of "47 cards across 37 sets", which adds no word worth correcting
  // to and makes "across" the most common word on the site.
  var VOCAB=null, VOCAB_HAS_CARDS=false;
  function vocab(){
    var i, r;
    if(!VOCAB){
      VOCAB=new Map();
      for(i=0;i<SITE.pages.length;i++){ r=SITE.pages[i]; vocabAdd(VOCAB,norm(r[0])); vocabAdd(VOCAB,norm(r[2])); }
      for(i=0;i<SITE.sets.length;i++) vocabAdd(VOCAB,norm(SITE.sets[i][0]));
      for(i=0;i<SITE.pokemon.length;i++) vocabAdd(VOCAB,norm(SITE.pokemon[i][0]));
      for(i=0;i<SITE.rips.length;i++){ r=SITE.rips[i]; vocabAdd(VOCAB,norm(r[0])); vocabAdd(VOCAB,norm(r[3])); }
    }
    if(CARDS && !VOCAB_HAS_CARDS){
      VOCAB_HAS_CARDS=true;
      var h=cardHay();
      for(i=0;i<h.length;i++) vocabAdd(VOCAB,h[i].slice(1,-1));
    }
    return VOCAB;
  }

  // ONE FOLDED STRING PER CARD, MADE ONCE. render() used to fold all 5,000
  // card rows on every keystroke. Padded with a space at each end so a whole
  // word can be tested with indexOf.
  var CARD_HAY=null;
  function cardHay(){
    if(CARD_HAY) return CARD_HAY;
    CARD_HAY=[];
    for(var i=0;i<CARDS.cards.length;i++){
      var r=CARDS.cards[i];
      CARD_HAY.push(' '+norm(r[0]+' '+(CARDS.sets[r[1]]||r[1])+' '+(r[2]||'')+' '+(r[3]||''))+' ');
    }
    return CARD_HAY;
  }

  // A search word, and on the typo rung the index words it may stand for.
  // spec.via is which of them answered the last row tested ('' = as typed);
  // spec.use counts that over the rows that were kept, which is how the
  // status line can name the word the results are actually for.
  function specs(terms, fuzzy){
    var out=[], i;
    for(i=0;i<terms.length;i++){
      out.push({t:terms[i], alts:fuzzy?fuzzyAlts(terms[i], vocab(), 5):null, via:'', use:{}});
    }
    return out;
  }
  function credit(spec, via){ spec.use[via]=(spec.use[via]||0)+1; }
  // The word the kept rows matched most, the typed one winning a tie. null
  // when no kept row used this word at all, which only rung 4 can produce.
  function usedWord(spec){
    var best=null, n=0, k;
    for(k in spec.use) if(spec.use[k]>n || (spec.use[k]===n && k==='')){ best=k; n=spec.use[k]; }
    return best===null ? null : (best===''?spec.t:best);
  }

  // scoreRow as before; then, on the typo rung only, a WHOLE WORD of the
  // title or blurb. Whole word and not substring, because a corrected word is
  // already a guess: "rein" may stand for "rain", and "rain" as a substring
  // is every Trainer on the site. Scored under every exact tier so a row that
  // has the word as typed always outranks one that has its neighbour.
  function termScore(title, sub, spec){
    var s=scoreRow(title, sub, spec.t), i, a, t, u;
    spec.via='';
    if(s || !spec.alts || !spec.alts.length) return s;
    t=' '+norm(title)+' ';
    for(i=0;i<spec.alts.length;i++){
      a=spec.alts[i];
      if(t.indexOf(' '+a.w+' ')!==-1){ spec.via=a.w; return 11-3*a.d; }
    }
    if(!sub) return 0;
    u=' '+norm(sub)+' ';
    for(i=0;i<spec.alts.length;i++){
      a=spec.alts[i];
      if(u.indexOf(' '+a.w+' ')!==-1){ spec.via=a.w; return 1; }
    }
    return 0;
  }
  function cardTerm(hay, spec){
    spec.via='';
    if(hay.indexOf(spec.t)!==-1) return true;
    if(!spec.alts) return false;
    for(var i=0;i<spec.alts.length;i++){
      if(hay.indexOf(' '+spec.alts[i].w+' ')!==-1){ spec.via=spec.alts[i].w; return true; }
    }
    return false;
  }

  // EVERY TERM HAS TO HIT, and the row is ranked by how well they hit.
  //
  // The old version substring-tested field [0] against the whole raw query, so
  // "charizard mega" found nothing while "mega charizard" found eight, and "ir"
  // returned 335 rows because a substring anywhere counted as much as a word.
  // Terms are ANDed, each scores independently, and the totals decide the order.
  //
  // FIELD [2] IS SEARCHED NOW AND IT COSTS NOTHING. Every index row already
  // ships [title, url, sub] and the sub was never consulted, so a page whose own
  // subtitle is "Does GameStop sell Pokemon cards?" could not be found by typing
  // that. It scores far below a title hit, so it broadens without reordering.
  // subIdx says WHICH field holds the searchable extra text, because the lists
  // do not agree: pages and sets carry a subtitle at [2], rips carry the
  // published DATE there and their tags at [3]. Scoring a date was harmless and
  // useless; this is what makes "elite trainer box" reach every rip tagged etb
  // rather than the few that happen to spell it in the title. (It did not until
  // 14 October 2026: field [3] carried the bare slug, see the rips note in
  // build-search.mjs. "elite trainer box" found 1 rip and "etb" found 63.)
  //
  // any=true IS RUNG 4 ONLY: one word is enough, and a row with more of the
  // words always sorts above a row with fewer, whatever they scored.
  // Returns {rows, total} so a group can say how much it is hiding. Capping
  // silently is the bug: "chaos rising" matched 39 rips, showed 10, and said
  // nothing, on the page whose whole job is finding things.
  function hits(list, sp, limit, subIdx, any){
    var si = subIdx === undefined ? 2 : subIdx;
    var scored=[], i, j, row, sc, t, cnt, vias;
    for(i=0;i<list.length;i++){
      row=list[i]; sc=0; cnt=0; vias=[];
      for(j=0;j<sp.length;j++){
        t=termScore(row[0], row[si], sp[j]);
        if(t){ sc+=t; cnt++; vias[j]=sp[j].via; }
        else if(any){ vias[j]=null; }
        else { cnt=0; break; }
      }
      if(!cnt) continue;
      for(j=0;j<sp.length;j++) if(vias[j]!=null) credit(sp[j], vias[j]);
      scored.push([any ? cnt*100000+sc : sc, i, row]);
    }
    // Score first, then ORIGINAL INDEX, never the row object: the index files
    // are ordered deliberately (Pokemon by dex number, rips newest first) and a
    // tie has to fall back to that rather than to whatever sort() happens to do.
    scored.sort(function(a,b){ return b[0]-a[0] || a[1]-b[1]; });
    var rows=[];
    for(i=0;i<scored.length&&rows.length<limit;i++) rows.push(scored[i][2]);
    return {rows:rows, total:scored.length};
  }

  // ONE WRITE PER CHANGED VALUE, AND ONLY AFTER TYPING STOPS.
  //
  // status is aria-live="polite", and assigning textContent REPLACES THE TEXT
  // NODE even when the string is identical -- so a screen reader announces
  // again on a value that did not change. This is the packplayer.js
  // syncCarousel bug and the /cards.html one, both already fixed and both
  // written down; this was the third copy. Typing "charizard" on /cards.html
  // mutated its region ten times for nine keystrokes with the last four
  // identical, and this file had the same shape.
  //
  // The guard alone is not enough: the counts genuinely differ on most
  // keystrokes, so every one still announces and the reader hears a countdown.
  // The 220ms debounce is what makes it one sentence, and it is deliberately
  // NOT applied to render() -- the list must keep repainting as fast as it
  // does today; only the spoken sentence waits.
  //
  // plain=true is a sentence rather than a count, and takes the class the
  // page's own style block reads. Set in the same tick as the text, so the
  // line never shows a sentence in the count's uppercase.
  var sayT=null, said='';
  function say(msg, plain){
    if(sayT) clearTimeout(sayT);
    sayT=setTimeout(function(){
      if(msg===said) return;
      said=msg;
      if(plain) status.classList.add('sq-plain'); else status.classList.remove('sq-plain');
      status.textContent=msg;
    }, 220);
  }

  // One pass over everything for one set of words. Returns the groups and the
  // total, and leaves each spec's use counts filled in. numText is what the
  // card number reader gets: the query as typed on rung 1, the words actually
  // searched on the rungs below it.
  function collect(sp, any, numText){
    var R={n:0, any:any};
    R.p=hits(SITE.pages,sp,6,2,any); R.n+=R.p.total;
    R.s=hits(SITE.sets,sp,8,2,any); R.n+=R.s.total;
    R.k=hits(SITE.pokemon,sp,8,2,any); R.n+=R.k.total;
    if(CARDS){
      var c=[], cx=[], cs=SITE.cardSets||{}, hay=cardHay(), had=any?new Map():null;
      // THE CARD ROWS CARRY set AND rarity AND WERE MATCHED ON NEITHER.
      // r = [name, setId, number, rarity, price]. "illustration rare" found 0
      // cards while 20 rarity values sat in r[3] on every row, and a set name
      // could not narrow a search at all. Folded and ANDed like everything else;
      // the price sort below is untouched and still decides the order.
      //
      // AND A CARD NUMBER IS MATCHED AS A NUMBER, 2 October 2026. "113/088"
      // folds to the terms 113 and 088, and no row holds an 088, so the Perfect
      // Order card printed 113/088 was not found here either. A number read by
      // parseCardNumber matches the card's own number exactly, zeros ignored
      // ("018" is "18"), any other words still have to be in the row, and a
      // typed total keeps only the sets that print it when any do. Those cards
      // come first; the old substring match still runs beside it and fills in
      // after, so nothing it found before is lost.
      var num=parseCardNumber(numText), nsp=null, byT={}, i, j;
      if(num){
        for(j=0;j<sp.length;j++) byT[sp[j].t]=sp[j];
        nsp=parseQuery(num.text).map(function(t){ return byT[t] || {t:t, alts:null, via:'', use:{}}; });
      }
      for(i=0;i<CARDS.cards.length;i++){
        var r=CARDS.cards[i], h=hay[i], cnt=0, ok=true, ex=false, vias=[];
        for(j=0;j<sp.length;j++){
          if(cardTerm(h, sp[j])){ cnt++; vias[j]=sp[j].via; }
          else { ok=false; vias[j]=null; if(!any) break; }
        }
        if(num && numKey(r[2])===num.key){
          ex=true;
          for(j=0;j<nsp.length;j++) if(!cardTerm(h, nsp[j])){ ex=false; break; }
        }
        if(ex) cx.push(r);
        else if(any ? cnt>0 : ok){
          c.push(r);
          if(any) had.set(r, cnt);
          for(j=0;j<sp.length;j++) if(vias[j]!=null) credit(sp[j], vias[j]);
        }
      }
      if(num && num.den && !num.pre){
        var cd=cx.filter(function(r){ return (cs[r[1]]||[])[1]===num.den; });
        if(cd.length) cx=cd;
      }
      // "151" IS A SET AS WELL AS A NUMBER, and here it was the set first: the
      // priciest cards of 151 led the list before numbers were read. So where
      // the typed number is a whole word of any set's name, both lists merge
      // and price decides, exactly as before; only elsewhere do the exact
      // number matches go first.
      var setWord=false;
      if(num) for(var sk in CARDS.sets){
        if((' '+norm(CARDS.sets[sk])+' ').indexOf(' '+num.word+' ')!==-1){ setWord=true; break; }
      }
      if(setWord){ c=cx.concat(c); cx=[]; }
      c.sort(function(a,b){
        return (any ? (had.get(b)||0)-(had.get(a)||0) : 0) || (b[4]||0)-(a[4]||0);
      });
      cx.sort(function(a,b){ return (b[4]||0)-(a[4]||0); });
      R.c=cx.concat(c); R.num=num; R.setWord=setWord;
      R.n+=R.c.length;
    }
    R.v=hits(SITE.rips,sp,10,3,any); R.n+=R.v.total;
    return R;
  }

  // linkQ is the query the "See them all" links carry to /cards.html and
  // /videos.html. Empty on rung 4: both of those pages need every word, so a
  // link built from an any-word search would land on "Nothing matched".
  function paint(R, linkQ){
    var html='';
    function more(h){
      return h.total>h.rows.length
        ? 'Showing '+h.rows.length+' of '+h.total.toLocaleString('en-US')+'.'
        : '';
    }
    html+=group('Guides and pages', R.p.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(R.p));
    html+=group('Set guides', R.s.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(R.s), '/sets/');
    html+=group('Pokemon', R.k.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(R.k), '/pokemon/');
    if(R.c){
      var c=R.c, cs=SITE.cardSets||{};
      html+=group('Cards', c.slice(0,10).map(function(r){
        return row(r[0], '/sets/'+r[1]+'.html', (CARDS.sets[r[1]]||r[1])+' • '+printedForm(r[2], cs[r[1]]), money(r[4]));
      }), c.length>10 ? (R.any || (R.num && !R.setWord) ? 'Showing 10' : 'Showing the 10 priciest')+' of '+c.length.toLocaleString('en-US')+'.' : '',
         c.length>10 && linkQ ? '/cards.html?q='+encodeURIComponent(linkQ) : '');
    }
    html+=group('Pack openings', R.v.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(R.v),
      R.v.total>R.v.rows.length && linkQ ? '/videos.html?q='+encodeURIComponent(linkQ) : '');
    return html;
  }

  // late=true is the call that may use rungs 3 and 4. See the note at rung 3.
  var lateT=null;
  function render(late){
    if(lateT){ clearTimeout(lateT); lateT=null; }
    var typed=input.value.trim();
    var q=typed.toLowerCase();
    var terms=parseQuery(q);
    /* !terms.length AND NOT JUST !q. norm() keeps only [a-z0-9], so a query of
       one emoji, or "!!!", or ".*", is a non-empty string that parses to no
       terms at all -- and every match loop below is a for over terms, so with
       none of them nothing is ever rejected and the page answered "6,900
       results" as though everything matched. /cards.html already gets this
       right, which is where the wording comes from. */
    if(!q || !terms.length){ out.innerHTML=''; say(''); empty.hidden=false; return; }
    empty.hidden=true;
    if(!SITE){
      if(siteFailed){ out.innerHTML=''; say('Search could not load. Everything is still reachable from the menu, and the channel is at youtube.com/@GarbageRips585'); return; }
      say('Loading...'); return;
    }

    // RUNG 1, the query as typed.
    var sp=specs(terms,false), R=collect(sp,false,q), relaxed=false;

    // THE CARD INDEX IS STILL ON ITS WAY, so "nothing" is not known yet.
    // "mega rayquaza" matches no page, set, species or rip and four cards, and
    // relaxing before the cards arrive would announce a correction for a query
    // that needs none, then take it back. Wait, saying what is being waited for.
    var cardNote='';
    if(!CARDS && q.length>=2){
      cardNote='<section class="sg"><h2>Cards</h2><p class="price-note">'+(cardsFailed
        ? 'The card index could not load, so cards are not in these results. Everything else here is.'
        : 'Looking through '+SITE.cardCount.toLocaleString()+' cards...')+'</p></section>';
      if(!R.n && !cardsFailed){ out.innerHTML=cardNote; say('Searching...'); return; }
    }

    // RUNG 2, without the filler. core is whatever the last attempt searched,
    // and is what rungs 3 and 4 work from.
    var core=terms, s, pass;
    for(pass=0; pass<2 && !R.n; pass++){
      s=strip(core, pass===1);
      if(s.length && s.length<core.length){
        core=s; sp=specs(core,false); R=collect(sp,false,core.join(' ')); relaxed=true;
      }
    }
    // RUNGS 3 AND 4 WAIT FOR THE TYPING TO STOP. A half typed word is not a
    // typo: on the way to "charizard" the box holds "chari", which matches,
    // but on the way to "charzard" it holds "charz", which is one edit from
    // "charm", and correcting it would flash 129 Charmanders at somebody in
    // the middle of a word. So a miss on rungs 1 and 2 clears the list and
    // comes back a quarter of a second later, and any keystroke in between
    // cancels that. Nothing is announced meanwhile.
    if(!R.n && late!==true){
      out.innerHTML=cardNote; say('');
      lateT=setTimeout(function(){ render(true); }, 250);
      return;
    }
    // RUNG 3, typo tolerance, where any word has a neighbour in the index.
    if(!R.n){
      sp=specs(core,true);
      if(sp.some(function(x){ return x.alts.length; })){
        R=collect(sp,false,core.join(' ')); relaxed=true;
      }
    }
    // RUNG 4, any word. One word alone has nothing left to relax. A number or
    // a word under three letters cannot carry a row by itself: "psa 11" with
    // nothing holding both is a search for "psa", not for every card numbered
    // 11 and every title with an 11 in it (381 rows when this was tried).
    var loose=core.filter(function(t){ return t.length>=3 && !/^[0-9]+$/.test(t); });
    if(!R.n && core.length>1 && loose.length){
      sp=specs(loose,true);
      R=collect(sp,true,loose.join(' ')); relaxed=true;
    }

    var n=R.n;
    if(!n){
      ${/* THE ONE STATE ON THIS SITE THAT PRINTED ABSENCE WITH NOTHING IN IT.
            Every other empty state already has a mascot: /videos.html and
            /playlists.html get one through emptyState() in public/assets/app.js,
            a rip with no hits gets one from build-pages.mjs, and /404.html has
            two. Site search had a bare sentence, which is the one place on the
            site where a reader has definitely just failed at something.

            IT IS GARBODOR AND THAT IS THE ONLY REASON THIS IS NOT TRUBBISH.
            Trubbish already means "there is nothing in this one" in three places
            and the meaning is worth keeping single. This search reads 316
            openings, 5,181 cards, every set guide and 1,025 species, so what it
            says is "we went through the whole heap", and the heap is the evolved
            one. It also gives the site's ONLY Garbodor a second page: before
            this it was on /404.html and nowhere else.

            NO NEW CSS FOR THE PANEL. .empty and .empty-mascot are both already
            in ui.css, written for app.js's grid states, so this state now looks
            like the filter-empty state on /videos.html rather than like a new
            invention.

            THE 256px FILE, NOT THE 512. .empty-mascot clamps to 116px, so a DPR 2
            phone asks for 232 device pixels and 256 is the smallest rendition
            that covers it: 15,582 bytes against /assets/garbodor.webp's 28,504
            for pixels nothing on this page can use. The 96px sm file loses at
            every DPR this box has, so there is no srcset worth writing.

            "NOTHING MATCHED" IS SAID ONCE, HERE (11 November 2026). The status
            line used to repeat the whole sentence directly above this panel.
            It now gives the count, "0 results", which is the same kind of thing
            it says for every other query and is what a screen reader hears; the
            panel says it in words, and then offers somewhere to go: POPULAR in
            build-search.mjs, eight real pages, as the same cards the page shows
            before anything is typed. */ ""}out.innerHTML='<div class="empty"><img class="empty-mascot" src="/assets/species/569.webp" alt="" width="256" height="256" loading="lazy" decoding="async" onerror="this.remove()"><p class="big">Nothing matched.</p><p>Try a Pokemon name, a set name, or a word from a video title.</p></div>'
        + ${JSON.stringify(POPULAR_HTML)};
      // A ZERO RESULT IS A RESULT AND HAS TO BE SPOKEN. This once said say('')
      // for a miss, so the live region was EMPTIED rather than announced: a
      // screen reader got a count for every query that found something and
      // silence for the one case where the reader most needs telling.
      say('0 results');
      return;
    }

    var count=n.toLocaleString('en-US')+' result'+(n===1?'':'s');
    if(!relaxed){
      out.innerHTML=paint(R, q)+cardNote;
      say(count);
      return;
    }
    // What was actually searched, word by word: the typed word where it
    // matched, the index word it stood for where it did not, and on rung 4
    // only the words that matched anything.
    var words=[], j, w;
    for(j=0;j<sp.length;j++){ w=usedWord(sp[j]); if(w) words.push(w); else if(!R.any) words.push(sp[j].t); }
    var label=words.join(' ');
    out.innerHTML=paint(R, R.any ? '' : label)+cardNote;
    say('No exact match for "'+typed+'". Showing '+count
      +(R.any && words.length>1 ? ' that match any of "' : ' for "')+label+'".', true);
  }

  /* A SWALLOWED REJECTION LEFT THE PAGE SAYING "Loading..." FOR EVER. The
     catch was empty and render()'s !SITE branch has no terminal state, so a
     failed site-index.json hid the intro panel, rendered nothing, and never
     said why -- and cardsTried is set BEFORE the fetch, so a failed
     card-index.json left "Looking through 5,396 cards..." on screen with
     nothing left to retry it. /videos.html degrades properly on the same
     failure ("Could not load the library -- The channel still works"), which
     is the behaviour being matched here. */
  function load(url, then, fail){
    return fetch(url).then(function(r){
      if(!r.ok) throw new Error(r.status);
      return r.json();
    }).then(then).catch(function(){ if(fail) fail(); });
  }

  load('/data/site-index.json', function(j){ SITE=j; render(); },
       function(){ siteFailed=true; render(); });
  // The card index is the big one, so it only loads once somebody has typed
  // enough to plausibly mean a card. Most searches never pull it.
  function wantCards(){
    // Two characters is enough to mean a card ("ex", "V"), and gating on three
    // meant /search.html?q=ex answered "30 results" while typing a third letter
    // and deleting it answered "800". Same url, different answer, decided by
    // typing history.
    if(cardsTried || input.value.trim().length<2) return;
    cardsTried=true;
    load('/data/card-index.json', function(j){ CARDS=j; render(); },
         function(){ cardsFailed=true; render(); });
  }
  input.addEventListener('input', wantCards);

  var t;
  input.addEventListener('input', function(){ clearTimeout(t); t=setTimeout(render,120); });

  var p=new URLSearchParams(location.search).get('q');
  if(p){
    input.value=p;
    wantCards();
  }
})();
</script>
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/search.html"), page);

/**
 * Every indexable page is findable.
 *
 * PAGES is hand-written, and four pages shipped without an entry: games, lore,
 * creators and vendors were invisible to the site's own search for as long as
 * they existed. Nothing noticed, because a missing entry looks exactly like a
 * page that does not exist.
 *
 * So the list is checked against the built site rather than trusted. Anything
 * at the top level that is not noindex has to be here. The exclusions are the
 * three pages that are not destinations: the home page, which the logo already
 * goes to, the search page itself, and the 404.
 */
{
  const SKIP = new Set(["index.html", "search.html", "404.html"]);
  const listed = new Set(PAGES.map(([u]) => u));
  const names = await readdir(join(ROOT, "public"));
  const missing = [];
  for (const f of names) {
    if (!f.endsWith(".html") || SKIP.has(f)) continue;
    const html = await readFile(join(ROOT, "public", f), "utf8");
    if (/<meta name="robots"[^>]*noindex/.test(html)) continue;
    if (!listed.has(`/${f}`)) missing.push(f);
  }
  // Directory pages carry their own index.html and are listed as "/games/".
  for (const d of ["games", "pokemon", "sets"]) {
    if (names.includes(d) && !listed.has(`/${d}/`)) missing.push(`${d}/`);
  }
  if (missing.length) {
    console.error(
      `\nNot in PAGES, so unreachable from the site search:\n  ${missing.join("\n  ")}\n` +
        `Add a line to PAGES in this file, or mark the page noindex if it is not a destination.`
    );
    process.exit(1);
  }
}

console.log(`Wrote public/search.html and public/data/site-index.json
  ${index.rips.length} rips, ${index.sets.length + GUIDES_OUTSIDE_SETS.length} set guides, ${index.pokemon.length} Pokemon, ${index.pages.length} pages
  ${total} entries in the site index, plus ${nCardsText} cards loaded on demand`);
