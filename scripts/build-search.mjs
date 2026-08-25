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
import { esc, clipMeta} from "../shared/format.mjs";
import { NORM_SRC, PARSE_SRC, SCORE_SRC } from "../shared/search-text.mjs";
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
  ["/pack-prices.html", "Pack prices by set", "What one pack costs, box against bundle against loose"],
  ["/how-many-packs.html", "How many packs are in it?", "Every sealed product biggest to smallest, and how the counts changed"],
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
  ["/card-shows.html", "Card shows", "Shows around Rochester, Buffalo and Syracuse"],
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
  ["/creators.html", "Local creators", "Other Rochester card channels worth watching"],
  // The blurb leads with the trademark date rather than with "the Rochester
  // dish", because the date is the surprising checkable fact and every other
  // page about this dish opens with the summary.
  ["/garbage-plate.html", "Garbage Plate", "The dish this channel is named after, sourced, with a diagram and where to eat one"],
  ["/vendors.html", "Local vendors", "Who sells cards around Rochester"],
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
   */
  rips: videos.map((v) => [
    v.title,
    `/${v.path}`,
    v.published,
    [
      ...(v.sets || []).map((x) => `${x} ${setNameById.get(x) || ""}`),
      ...(v.products || []).map((x) => `${x} ${labelFor(x) || ""}`),
      ...(v.pulls || []),
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
};

await writeFile(join(ROOT, "public/data/site-index.json"), JSON.stringify(index) + "\n");

const total =
  index.pages.length + index.sets.length + index.pokemon.length + index.rips.length;

const nCardsText = nCards.toLocaleString("en-US");
// THE POKEMON COUNT IS FOUR DIGITS TOO AND WAS THE ONLY ONE PRINTED BARE. The
// same sentence read "5,181 cards ... 1025 Pokemon", and /lore.html writes the
// same figure "1,025". Every four-digit number on the site is grouped, so this
// one read as a typo sitting between two that were not.
const nDexText = index.pokemon.length.toLocaleString("en-US");

const desc = `Search everything on Garbage Rips 585: ${index.rips.length} pack openings, ${nCardsText} cards, ${index.sets.length} set guides and every reference page.`;

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
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main">

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
      <p class="cq-head">Searches ${index.rips.length} pack openings, ${nCardsText} cards, ${index.sets.length} set guides,
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
  var SITE=null, CARDS=null, cardsTried=false;

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
  // useless; this is what makes "elite trainer box" reach the 58 rips tagged
  // with it rather than the 3 that happen to spell it in the title.
  function hits(list, terms, limit, subIdx){
    var si = subIdx === undefined ? 2 : subIdx;
    var scored=[], i, j, row, sc, t, ok;
    for(i=0;i<list.length;i++){
      row=list[i]; sc=0; ok=true;
      for(j=0;j<terms.length;j++){
        t=scoreRow(row[0], row[si], terms[j]);
        if(!t){ ok=false; break; }
        sc+=t;
      }
      if(ok) scored.push([sc,i,row]);
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
  var sayT=null, said='';
  function say(msg){
    if(sayT) clearTimeout(sayT);
    sayT=setTimeout(function(){
      if(msg===said) return;
      said=msg;
      status.textContent=msg;
    }, 220);
  }

  function render(){
    var q=input.value.trim().toLowerCase();
    var terms=parseQuery(q);
    if(!q){ out.innerHTML=''; say(''); empty.hidden=false; return; }
    empty.hidden=true;
    if(!SITE){ say('Loading...'); return; }

    var html='';
    var n=0;

    function more(h){
      return h.total>h.rows.length
        ? 'Showing '+h.rows.length+' of '+h.total.toLocaleString('en-US')+'.'
        : '';
    }

    var p=hits(SITE.pages,terms,6); n+=p.total;
    html+=group('Guides and pages', p.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(p));

    var s=hits(SITE.sets,terms,8); n+=s.total;
    html+=group('Set guides', s.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(s), '/sets/');

    var k=hits(SITE.pokemon,terms,8); n+=k.total;
    html+=group('Pokemon', k.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(k), '/pokemon/');

    if(CARDS){
      var c=[];
      // THE CARD ROWS CARRY set AND rarity AND WERE MATCHED ON NEITHER.
      // r = [name, setId, rarity, number, price]. "illustration rare" found 0
      // cards while 20 rarity values sat in r[2] on every row, and a set name
      // could not narrow a search at all. Folded and ANDed like everything else;
      // the price sort below is untouched and still decides the order.
      for(var i=0;i<CARDS.cards.length;i++){
        var r=CARDS.cards[i], ok=true;
        var hay=norm(r[0]+' '+(CARDS.sets[r[1]]||r[1])+' '+(r[2]||'')+' '+(r[3]||''));
        for(var j=0;j<terms.length;j++){
          if(hay.indexOf(terms[j])===-1){ ok=false; break; }
        }
        if(ok) c.push(r);
      }
      c.sort(function(a,b){ return (b[4]||0)-(a[4]||0); });
      n+=c.length;
      html+=group('Cards', c.slice(0,10).map(function(r){
        return row(r[0], '/sets/'+r[1]+'.html', (CARDS.sets[r[1]]||r[1])+' • '+r[2], money(r[4]));
      }), c.length>10 ? 'Showing the 10 priciest of '+c.length.toLocaleString('en-US')+'.' : '',
         c.length>10 ? '/cards.html?q='+encodeURIComponent(q) : '');
    }

    if(!CARDS && q.length>=2){
      html+='<section class="sg"><h2>Cards</h2><p class="price-note">Looking through '+SITE.cardCount.toLocaleString()+' cards...</p></section>';
    }

    var v=hits(SITE.rips,terms,10,3); n+=v.total;
    html+=group('Pack openings', v.rows.map(function(r){ return row(r[0],r[1],r[2]); }), more(v),
      v.total>v.rows.length ? '/videos.html?q='+encodeURIComponent(q) : '');

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

          NO NEW CSS. .empty and .empty-mascot are both already in ui.css,
          written for app.js's grid states, so this state now looks like the
          filter-empty state on /videos.html rather than like a new invention.

          THE 256px FILE, NOT THE 512. .empty-mascot clamps to 116px, so a DPR 2
          phone asks for 232 device pixels and 256 is the smallest rendition
          that covers it: 15,582 bytes against /assets/garbodor.webp's 28,504
          for pixels nothing on this page can use. The 96px sm file loses at
          every DPR this box has, so there is no srcset worth writing. */ ""}out.innerHTML = html || '<div class="empty"><img class="empty-mascot" src="/assets/species/569.webp" alt="" width="256" height="256" loading="lazy" decoding="async" onerror="this.remove()"><p class="big">Nothing matched.</p><p>Try a Pokemon name, a set name, or a word from a video title.</p></div>';
    // A ZERO RESULT IS A RESULT AND HAS TO BE SPOKEN. This said say('') for a
    // miss, so the live region was EMPTIED rather than announced: a screen
    // reader got a count for every query that found something and silence for
    // the one case where the reader most needs telling. /cards.html already
    // gets this right by putting its whole "Nothing matched" sentence in the
    // status region; this is the same sentence the visible panel shows.
    say(n ? n.toLocaleString('en-US')+' result'+(n===1?'':'s')
          : 'Nothing matched. Try a Pokemon name, a set name, or a word from a video title.');
  }

  function load(url, then){
    return fetch(url).then(function(r){ return r.json(); }).then(then).catch(function(){});
  }

  load('/data/site-index.json', function(j){ SITE=j; render(); });
  // The card index is the big one, so it only loads once somebody has typed
  // enough to plausibly mean a card. Most searches never pull it.
  function wantCards(){
    // Two characters is enough to mean a card ("ex", "V"), and gating on three
    // meant /search.html?q=ex answered "30 results" while typing a third letter
    // and deleting it answered "800". Same url, different answer, decided by
    // typing history.
    if(cardsTried || input.value.trim().length<2) return;
    cardsTried=true;
    load('/data/card-index.json', function(j){ CARDS=j; render(); });
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
  ${index.rips.length} rips, ${index.sets.length} set guides, ${index.pokemon.length} Pokemon, ${index.pages.length} pages
  ${total} entries in the site index, plus ${nCardsText} cards loaded on demand`);
