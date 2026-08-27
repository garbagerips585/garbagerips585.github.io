/**
 * /card-show-101.html -- what a card show is, for somebody who has never been.
 *
 * WHY THIS PAGE EXISTS, and it is worth writing down because it was not planned.
 * On 26 August 2026 the card show calendar was posted to r/Rochester. Two of the
 * first comments were not about dates at all. One asked whether the shows were
 * any good and what the mix was; the next asked, in as many words, "Are these
 * shows to purchase cards, sell them or both?"
 *
 * The calendar answered WHEN and WHERE and had nothing on what happens in the
 * room: no mention of trade, graded, singles or cash anywhere on it. A calendar
 * that only serves people who already go is half a calendar, and the people
 * asking were exactly the ones a local card show most wants through the door.
 *
 * EVERY CLAIM HERE IS FIRST HAND OR COMPUTED. The owner has been going to the
 * Rochester and Batavia shows since February 2026, and the payment and floor
 * detail is his. The admission split is computed from data/shows.json so it
 * cannot drift from the calendar it sits beside.
 *
 * WHAT IS DELIBERATELY NOT ON THIS PAGE, because nobody has established it and
 * a beginner guide is the worst place to guess: what time to turn up for first
 * pick, whether to haggle and how, whether to bring sleeves, toploaders or a
 * binder for cards you are selling, how table prices work if you want to set up,
 * and anything about getting cards graded at a show. Each of those is a real
 * question and each needs a real answer before it goes up. See the note at the
 * foot of this file.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { faqBlock, FAQ_CSS } from "../shared/faq.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where it
// sits, so both attach to nothing. See the note in shared/chrome.mjs beside the
// two exports before adding a video tile or a carousel here.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, clipMeta } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const shows = JSON.parse(await readFile(join(ROOT, "data/shows.json"), "utf8"));

/* THE SAME TEST THE CALENDAR'S OWN COUNTER TILE USES, so the two numbers on two
   pages about the same shows cannot disagree. This site has published a figure
   that contradicted another page often enough to have a rule about it. */
const TODAY = new Date().toISOString().slice(0, 10);
const upcoming = (shows.shows || []).filter((s) => s.date >= TODAY);
const nFree = upcoming.filter((s) => String(s.admission || "").trim().toLowerCase() === "free").length;
const nPokemon = upcoming.filter((s) => s.pokemon).length;

const desc =
  "What actually happens at a card show, for anybody who has never been to one. " +
  "Buying, selling and trading, what is on the tables, how vendors take payment, and what it costs to get in.";

const QA = [
  ["Are card shows for buying cards, selling them, or both?",
    "Both, and trading as well. You can do all three at the same table in the same visit, and you do not have to " +
    "decide before you walk in. Showing up with cards to sell is as normal as showing up with money to spend."],
  ["Do I need to bring cash?",
    "Cash gets you the best price, and it is worth bringing some for that reason alone. It is not the only way to " +
    "pay though: most vendors take PayPal, Apple Cash, Venmo or Zelle, and most carry a card reader as well. A card " +
    "sometimes costs slightly more, because the vendor is covering the processing fee rather than charging you extra."],
  ["Is it all Pokemon cards?",
    "Usually not. Most shows around here are general card shows with sports, Pokemon and other trading card games on " +
    "the same floor, which is why the Pokemon-only ones are marked as such on the calendar. Of the " +
    upcoming.length + " coming up, " + nPokemon + " are all Pokemon."],
  ["Does it cost anything to get in?",
    nFree + " of the " + upcoming.length + " shows on our calendar are free to walk into. Where a show has not " +
    "published an admission price we say so rather than guess at it, so check the listing before you head out."],
  ["Does sealed product get a better offer than singles?",
    "Yes, and by a wide margin. At shops that publish their rates, sealed Pokemon goes at 70 to 80 percent of " +
    "market low in cash and 80 to 90 in store credit, while singles run about 60 percent cash and up to 80 in " +
    "credit. Sealed cannot be damaged in a binder and does not need grading, so a vendor can move it on fast " +
    "and pays for the privilege. Graded 10s sit near sealed, around 70 cash and 80 credit."],
  ["What will a vendor pay for my cards?",
    "Less than they sell them for, and how much less depends on what it is and how easily it sells on. Published " +
    "Pokemon buy rates run about 60 percent cash on singles, 70 to 80 on sealed and 70 on graded 10s, with store " +
    "credit worth roughly another 10 to 20 points on top of whichever of those applies. Watch what the percentage " +
    "is measured against, though: sealed rates are quoted off market LOW and graded off the last five sales, both " +
    "of which are below the headline price you looked up."],
  ["Is an early bird ticket worth paying for?",
    "It depends whether you are hunting something specific. Paying the premium gets you in ahead of general " +
    "admission, when the room is quiet enough to actually talk to a vendor and the best sealed product and standout " +
    "singles are still on the tables. If you are browsing rather than hunting, general admission is fine."],
  ["What do I say to a vendor?",
    "Walk up and ask what they have, and what they are looking for. That is the whole of it. Every table is somebody " +
    "else's collection and stock, so the person behind it is the only one who knows what is in the boxes underneath."],
];

const FAQ = faqBlock(QA, {
  heading: "The questions people actually ask first",
  path: "/card-show-101.html",
  site: SITE,
  bare: true,
});

const ld = [
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Local scene", item: SITE + "/rochester.html" },
      { "@type": "ListItem", position: 3, name: "Card shows", item: SITE + "/card-shows.html" },
      { "@type": "ListItem", position: 4, name: "Card show 101" },
    ],
  },
  FAQ.ld,
];

// Same trade eight other builders make: the reasoning stays in this file and
// stops being served inside a render blocking <head>.
const miniCSS = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/[ \t]*\n[ \t\n]*/g, "\n").trim();

const style = `
.cs-lede{max-width:44em}
.cs-s{margin-top:var(--s6);scroll-margin-top:var(--s5)}
.cs-s > p{max-width:44em;line-height:1.6}
.cs-s > p + p{margin-top:var(--s3)}
.cs-back{margin-top:var(--s7)}
.cs-fig{margin:var(--s5) 0 0;max-width:44em;overflow-x:auto}
.cs-plan{width:100%;height:auto;display:block}
.cs-room{fill:var(--card);stroke:var(--keyline);stroke-width:2}
.cs-table{fill:var(--sky);opacity:.85}
.cs-door{stroke:var(--card);stroke-width:6}
.cs-in{fill:var(--ink-2);font:400 12px var(--mono);text-anchor:middle}
.cs-tiers{width:100%;border-collapse:collapse;font-size:var(--t-sm)}
.cs-tiers caption{text-align:left;font-weight:600;padding-bottom:var(--s2)}
.cs-tiers th,.cs-tiers td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--hair);vertical-align:top}
.cs-tiers thead th{border-bottom:2px solid var(--keyline)}
/* WAS white-space:nowrap, WHICH BROKE THE PAGE AT 320px. "Graded, 10s" became
   unbreakable, forcing column one to 102px, which pushed the table to its
   min-content width of 329 inside a 280px figure: it escaped by 49px and took
   the document with it, 349 against a 320 viewport. Page-level sideways scroll
   is the one layout rule this site does not bend.
   AND .cs-fig SCROLLS ITS OWN OVERFLOW as the backstop, which is the convention
   already: wide content scrolls inside its own container, the body never does.
   Both, because the wrap fix alone leaves nothing catching the next long cell
   somebody adds. */
.cs-tiers tbody th{font-weight:600;padding-right:10px}
.cs-fig figcaption{margin-top:var(--s3);font-size:var(--t-sm);color:var(--ink-2);line-height:1.55;max-width:40em}
`;

/* A DRAWN FLOOR PLAN, NOT A PHOTOGRAPH, and the distinction is the point. This
   page describes a room to somebody who has never stood in one, and there is no
   photograph of these shows in the repo that we have the right to publish. A
   diagram asserts nothing about any particular show: it is the FORMAT, which is
   the thing being explained.

   check-build.py asks every page with real body copy to carry something visual
   in <main>, and it was right to stop this one. 803 words describing a layout,
   with no layout on it.

   role="img" with a <title>, so a screen reader gets the sentence rather than
   silence or a list of rectangles. Tokens rather than hex, so it follows the
   palette in both themes. */
const FLOORPLAN = `
      <figure class="cs-fig">
        <svg viewBox="0 0 640 268" role="img" aria-labelledby="planT planD" class="cs-plan">
          <title id="planT">A card show floor plan</title>
          <desc id="planD">A rectangular hall with tables around three walls and two rows down the middle,
            an aisle between them, and the way in at the bottom.</desc>
          <rect x="8" y="8" width="624" height="252" rx="10" class="cs-room"/>
          ${[
            // three walls of tables
            ...Array.from({ length: 7 }, (_, i) => [36 + i * 82, 24]),
            ...Array.from({ length: 7 }, (_, i) => [36 + i * 82, 216]),
            ...Array.from({ length: 3 }, (_, i) => [16, 62 + i * 52]),
            ...Array.from({ length: 3 }, (_, i) => [596, 62 + i * 52]),
            // two rows down the middle
            ...Array.from({ length: 5 }, (_, i) => [78 + i * 82, 104]),
            ...Array.from({ length: 5 }, (_, i) => [78 + i * 82, 148]),
          ].map(([x, y]) => `<rect x="${x}" y="${y}" width="${x === 16 || x === 596 ? 28 : 66}" height="${x === 16 || x === 596 ? 38 : 28}" rx="3" class="cs-table"/>`).join("")}
          <path d="M296 260 h48" class="cs-door"/>
          <text x="320" y="252" class="cs-in">way in</text>
        </svg>
        <figcaption>Every rectangle is one seller. There is no register and no back room: the person behind the
          table owns what is on it, prices it themselves, and takes it home at the end of the day.</figcaption>
      </figure>`;

/* POKEMON RATES, BY CATEGORY, FROM SHOPS THAT PUBLISH THEM.
   The first pass at this question found sports-card guides quoting one number
   for everything. The owner pushed back: singles, sealed and graded each have
   their own nuance. He was right, and the gap is not small -- sealed pays about
   twenty points better than singles at the same shop.
   These are PUBLISHED RATE CARDS rather than opinions, which is why they are
   worth more than the ranges a guide quotes: a shop that prints its buy rate is
   committing to it.
   THE BASIS MATTERS AS MUCH AS THE PERCENTAGE and almost nobody says so, which
   is why it gets a paragraph of its own below. "70 percent of market low" and
   "70 percent of the last five sold" are both lower than 70 percent of the
   headline number a price site shows you. */
const TIERS = `
      <figure class="cs-fig">
        <table class="cs-tiers">
          <caption>Published Pokemon buy rates, by what you are selling</caption>
          <thead><tr><th scope="col">What you are selling</th><th scope="col">Cash</th><th scope="col">Store credit</th><th scope="col">Measured against</th></tr></thead>
          <tbody>
            <tr><th scope="row">Singles</th><td>About 60 percent, up to 65</td><td>Up to 80 percent</td><td>Market, or TCGplayer low</td></tr>
            <tr><th scope="row">Sealed</th><td>70 to 80 percent</td><td>80 to 90 percent</td><td>Market low</td></tr>
            <tr><th scope="row">Graded, 10s</th><td>70 percent</td><td>80 percent</td><td>Average of the last five sold</td></tr>
          </tbody>
        </table>
        <figcaption>Market low means the cheapest listing rather than the headline market price, which matters more than it sounds and is covered below. Knight and Day Games publishes all three of those lines; Zulus Games publishes the higher
          sealed pair at 80 cash and 90 credit; Game Goblins puts singles at up to 65 percent cash with credit
          worth another quarter on top. All read August 26, 2026. Knight and Day also want Lightly Played or
          better, meaning light edge wear at worst and nothing creased or scuffed, and will not take singles under fifty cents, which is normal and worth knowing before you sort
          a box.</figcaption>
      </figure>`;

const SECTIONS = [
  ["what", "A room of tables, and each one is somebody's stock",
   ["A card show is a hall or a function room with tables around it, and a different seller behind every table. " +
    "There is no single shop and no one price: each vendor brings their own cards, prices them their own way, and " +
    "packs them up at the end of the day.",
    "That is the whole format. Walk in, walk around, and look at what is out."], FLOORPLAN],
  ["buysell", "You can buy, you can sell, and you can trade",
   ["All three, and often with the same person in the same conversation. Vendors are not only there to sell to you: " +
    "most are actively buying, and plenty will trade.",
    "So bringing cards with you is normal. If you have a box in a closet and no idea what is in it, a show is a " +
    "room full of people who will tell you, and some of them will make you an offer."]],
  ["tables", "Sealed, singles and graded",
   ["Sealed means unopened product: booster boxes, elite trainer boxes, loose packs. Singles are individual cards, " +
    "usually in binders or in boxes you flip through. Graded means a card sealed in a slab by a grading company with " +
    "a number on it.",
    "Which of the three a table carries varies table to table, and most shows have all three somewhere in the room."]],
  ["pay", "How vendors take payment",
   ["Cash gets the best price. That is the short version, and it is worth bringing some even if you plan to pay " +
    "another way.",
    "Beyond that, most vendors take PayPal, Apple Cash, Venmo or Zelle, and most carry a card reader too. Paying by " +
    "card sometimes costs a little more than the cash price. That is not a surcharge aimed at you: card processing " +
    "takes a percentage of the sale, and on a thin margin the vendor is passing on the fee rather than eating it."]],
  ["cost", "What it costs to get in, and what an early bird ticket buys",
   [nFree + " of the " + upcoming.length + " shows on our calendar are free to walk into. That is the normal shape " +
    "of a regular local show: no door charge, show up whenever you like.",
    "The bigger ones charge, and they often sell a tier above general admission that gets you through the door " +
    "early. That premium is buying you two things. The room is quieter, so you can actually get to a table and talk " +
    "to the person behind it. And you get first pick: the good sealed product and the standout singles are bought in " +
    "the first hour, and by general admission a lot of the best of it has gone.",
    "It is a real gap, not fifteen minutes. Collectorfest at the Syracuse Fairgrounds on September 13 runs $5 general from 9:30am " +
    "with a $20 early bird at 9am. RocPokeCon on Halloween runs $5 general from 10am, $15 early entry from 9am, and " +
    "a $95 VIP that is on the vendor floor at 8:30am. Whether that is worth it depends entirely on whether you are " +
    "hunting something specific.",
    "Where a show has not published an admission price anywhere we could find it, the calendar says so rather than " +
    "guessing. Showing up expecting free entry and finding a cover charge is exactly the sort of wrong a calendar " +
    "must not be."]],
  ["value", "What vendors pay, and why it is less than the sticker",
   ["A vendor prices what they are selling at or near market value, which is what the card actually trades for, not " +
    "what a price guide dreams about. That part is straightforward.",
    "What surprises people is the other direction. When a vendor buys FROM you they have to buy below market, " +
    "because they are covering rent, table cost, the time the card sits in a box, and the risk it moves against " +
    "them before it sells.",
    "AND IT IS NOT ONE NUMBER, it is three, because sealed, singles and graded are three different risks. Sealed " +
    "cannot be damaged in a binder and does not need grading, so a vendor can move it fast and pays accordingly. A " +
    "raw single, and raw means ungraded and straight out of a binder, carries condition risk and has to find the " +
    "one person who wants that card. A slab is somewhere " +
    "between: the condition question is already settled, but the buyer pool is narrower.",
    "These are rates that shops publish rather than ranges a guide estimates, which is why they are worth more:"], TIERS],
  ["basis", "The trap in every one of those numbers",
   ["Look at the right-hand column, because it is where the money actually goes. Those percentages are not taken " +
    "against the price you looked up. Sealed rates are quoted against MARKET LOW, and graded rates against the " +
    "average of the last five sales.",
    "Both of those sit below the headline figure a price site shows you, so an offer of 70 percent of market low is " +
    "not 70 percent of what you think your box is worth. It is 70 percent of a smaller number. Nothing dishonest is " +
    "happening, and the two shops quoted here say exactly which basis they use, but nobody points out what it does " +
    "to the arithmetic.",
    "So when a vendor names a percentage, the useful follow-up is a percentage OF WHAT. It is a completely normal " +
    "question and it is the difference between comparing two offers properly and comparing two words."]],
  ["spread", "Why those four numbers disagree",
   ["Those are shop rates, published and standing. Ask around about card shows and the answers scatter much wider: " +
    "a show-focused guide says 60 to 80 percent cash, two shop-facing guides say 40 to 60 on desirable singles, and " +
    "collectors on the Collectors Universe forum say you are lucky to get 50. All read August 26, 2026.",
    "Guides quote the better end and collectors report the worse one, and both are honest, because they are not " +
    "measuring the same thing. A guide describes what a good deal looks like. A forum post describes an average " +
    "Sunday, including the ones where somebody took a bad offer because they had driven an hour.",
    "What actually decides where you land is how easily your card sells on. One dealer writing about his own table " +
    "put it as plainly as anyone: a high demand card is worth more to him than a low demand one even when the two " +
    "carry the same retail value, because the first one turns into money and the second one turns into storage. " +
    "The same dealer puts his gross margin at about 20 percent on average and 30 percent as a very good day, which " +
    "is the other half of the arithmetic and the reason none of this is personal.",
    "So a thin parallel, meaning an alternate printing of a card that few people collect, or a condition-sensitive " +
    "raw card, or something falling after a release, gets a worse offer " +
    "than its price guide suggests, and the card everybody is chasing this month gets a better one. Sports Card " +
    "Vending's dealer guide makes the same point in one line: a percentage is an output of the deal and not a " +
    "universal rule."]],
  ["credit", "Why trade credit beats cash",
   ["Credit is consistently the better of the two. The Card Shop Finder puts it at 25 to 50 percent above whatever " +
    "the cash offer was: an offer of $100 cash is commonly $125 to $150 in credit. Read August 26, 2026.",
    "The reason is that the money never leaves the room. You are agreeing to spend it at their table, so the vendor " +
    "keeps the sale and their cash position both, and can afford to be more generous. If you were going to buy " +
    "something anyway, take the credit almost every time.",
    "The corollary is worth saying plainly: if you need the money for something other than more cards, that gap is " +
    "what you are paying for the privilege, and it is a real cost rather than a trick."]],
  ["buying", "Buying: where the room to move actually is",
   ["Most prices are at or near market, and most vendors have a little room in them. Asking is normal and nobody is " +
    "offended by it, as long as you are asking rather than telling.",
    "The room is almost always in the BUNDLE rather than the single card. A vendor who will not move on one card " +
    "will often come down properly on four of them, because it is one transaction instead of four and it clears more " +
    "of the table. Pick out everything you want first, then ask what they can do for the lot.",
    "Have cash for it. The best price a vendor can give is the cash price, for the reason in the payment section " +
    "above, and it is much easier to agree on a round number when the money is in your hand.",
    "There is a number for this side too, and it is the one nobody tells you: Card Codex, a hobby guide site, says a fair opening " +
    "offer at a show is 80 to 90 percent of what the card has recently sold for, and 85 to 90 percent is a good " +
    "place to land, read August 26, 2026. Read that both ways. It means there is usually something there, so ask. It also means the room " +
    "is a slice and not a half, so an offer at 60 percent of what it last sold for is not a hard bargain, it is a " +
    "waste of the " +
    "vendor's afternoon.",
    "On a raw card, condition is fair leverage: a soft corner or an off-center front is a real reason the card is " +
    "worth less, and saying so politely is different from picking holes. And the strongest thing you can do costs " +
    "nothing, which is to be willing to walk. There are other tables, and both of you know it."]],
  ["selling", "Selling: know the number before you go",
   ["Look up roughly what your cards are worth before you walk in, so an offer means something to you. You do not " +
    "need a spreadsheet, just a sense of which two or three cards carry the value.",
    "Then work out which band your cards are actually in, because that is what decides whether an offer is fair. " +
    "Forty to sixty percent in cash on a desirable single is a NORMAL offer and not somebody lowballing you; the same " +
    "forty percent on hot modern product is low. Knowing which of those you are holding is most of the negotiation.",
    "Ask for the credit number as well as the cash number before you decide. It is a different offer, not a " +
    "courtesy, and on the published spread it is worth a quarter to a half again.",
    "It is still worth getting two or three offers on anything that actually matters. Vendors specialize, and the " +
    "one who already has a buyer for your card can afford to pay more for it than the one who does not.",
    "Bring the cards in something that lets a person go through them quickly. A vendor is deciding whether to give " +
    "you money, and anything that makes it slow to see what you have works against you."]],
  ["trading", "Trading: the one where both sides can win",
   ["Card for card, both sides usually value at market and look for something close to even, sometimes with cash " +
    "from one side to balance it.",
    "It is the friendliest of the three because nobody has to be the one losing the margin. A card sitting dead in " +
    "your binder and worth nothing to you can be exactly what somebody else has been chasing, and the reverse is " +
    "just as true, which is how a trade makes both people better off when a sale would not have.",
    "Ask what they are LOOKING for as well as what they have. That question is the one that starts most trades, and " +
    "it is the one people forget to ask."]],
  ["talk", "What to say when you get there",
   ["Ask what they have, and ask what they are looking for. That is genuinely it.",
    "Every table is one person's stock and they know it better than any label does, including what is in the boxes " +
    "under the table that never made it out. Nobody minds being asked, and it is how you find the thing you came for."]],
];

const body = `
      <p class="kicker">585 &bull; Never been to one?</p>
      <h1>Card show <span class="hl">101</span></h1>
      <p class="lede cs-lede">${esc(desc)}</p>
${SECTIONS.map(([id, h, ps, fig]) => `      <section class="cs-s" id="${id}">
        <h2>${h}</h2>
${ps.map((p) => `        <p>${esc(p)}</p>`).join("\n")}${fig || ""}
      </section>`).join("\n")}
      ${FAQ.html}
      <p class="cs-back"><a class="btn btn-sky btn-sm" href="/card-shows.html">See every show coming up &rarr;</a></p>
`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Card Show 101: What Happens, What to Bring, How to Pay</title>
<meta name="description" content="${esc(clipMeta(desc))}">
<link rel="canonical" href="${SITE}/card-show-101.html">
<meta property="og:title" content="Never been to a card show?">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE}/card-show-101.html">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:image" content="${SITE}/assets/og-card-shows.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-card-shows.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
${FONTS}
${STYLES}
<style>${miniCSS(style)}
${FAQ_CSS}</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
${SPRITE}
${SKIP}
${BAR}
${MENU}
<main id="main" tabindex="-1">
  <section class="tight">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/rochester.html">Local scene</a> / <a href="/card-shows.html">Card shows</a> / Card show 101</nav>
${body}
    </div>
  </section>
</main>
${footer("What the floor is like and how vendors take payment is from going to these shows. The buy rates are other people's published figures, named and dated on the page. Not affiliated with any of them.")}
${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/card-show-101.html"), page);
console.log(`Wrote public/card-show-101.html
  ${SECTIONS.length} sections, ${QA.length} FAQ entries
  ${nFree} of ${upcoming.length} upcoming shows free, ${nPokemon} all Pokemon (computed from data/shows.json)`);

/* STILL TO ANSWER, and each one needs the owner rather than a guess:
     - what time to turn up if you want first pick
     - whether haggling is expected, and how it is done politely
     - what to bring if you are there to SELL (sleeves, toploaders, a binder?)
     - what a table costs and how you book one
     - whether any of these shows have graders on site
   Each is a real beginner question. None of them is on this page because none
   of them is established, and a beginner guide is the worst possible place to
   sound confident about something nobody checked. */
