import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
// The bits of chrome every page wears: the bar, the mobile menu, the footer,
// the icon sprite and the skip link.
//
// These used to be copied into build-set-pages.mjs and build-pages.mjs as
// separate string constants, so a change to the nav had to be made twice and
// the two had already drifted. One source now; both generators import it.
//
// The home page and the three pages built from it take their chrome by slicing
// index.html rather than importing this, because they also need its <head>.
// That is real duplication, and it has already bitten: index.html's copy of the
// bar carried onsubmit="return false" with no action and no name, so the search
// box did nothing on six pages while working on the other 332.
//
// checkDrift() below is called by build-proto.mjs and fails the build when the
// two diverge. A comment claiming a guard is not a guard.

/**
 * THE NAV, and it is the ONLY place nav is defined.
 *
 * The bar, the menu and the footer are all derived from this one array. They
 * used to be three hand-maintained lists and they drifted, exactly as you would
 * expect: /hall.html was "Hits" in the bar, "Best pulls" in the menu and "Card
 * Hall of Fame" in the footer, so somebody who clicked Hits and later looked
 * for it in the footer was hunting a page that appeared not to exist. /sets/
 * carried three names too, and /collection.html was in the menu but missing
 * from the footer entirely. Derivation is the fix; a guard cannot catch what it
 * is not told to compare.
 *
 * GROUPED BY WHAT YOU CAME TO DO, not by content type and not by audience.
 * Audience-based nav ("new collectors", "returning collectors") is a known
 * failure: NN/G lists five reasons, the first being that users do not know
 * which group they are in. Serious Eats is the closest real analogue to this
 * site, a mix of tools, guides, reference data and a media archive, and it
 * splits its top level by intent and only its second level by subject.
 *
 * LABELS ARE FRONT-LOADED NOUNS. Nielsen's first-two-words study (80 people)
 * found users see about two words per list item, and for 35% of links the
 * first 11 characters left them unsure where it led. "Real or fake?" spends
 * that budget on "Real or", "Worth grading?" on "Worth grad". "Fakes" and
 * "Grading" put the load-bearing word first. The pages keep their question
 * headlines, where the search-matching value actually is.
 *
 * EVERY LABEL REPEATS A CONTENT WORD FROM ITS OWN PAGE'S h1 OR title, and that
 * is a rule rather than a preference. Seventeen of the old forty-six did not,
 * so a reader who clicked "Every set ever" landed on a page that says "All 174
 * English sets", and one who clicked "Phone version" landed on "Pokemon TCG
 * Pocket". A label the destination does not echo reads as the wrong page.
 *
 * AND THE HONESTY RULE OUTRANKS THE SEO ONE. Three renames were refused here
 * rather than shipped, each of them the phrase with more traffic in it:
 * "Fair price check" for /msrp.html, "What's in each box" for /openings/, and
 * "Pull rates" for /luck.html, which this file has had to refuse twice. Every
 * one of them promises something its page says on its face it does not have.
 * The nav label is not where ranking is won anyway; the <title> and the <h1>
 * are, and those are on the pages.
 *
 * LABELS FIT IN 20 CHARACTERS, and the binding constraint is the FOOTER, not
 * the menu. The footer's group grid is repeat(auto-fill,minmax(138px,1fr)) and
 * 138px is about twenty characters at 14px/600, so "Stores that sell cards"
 * (22) wrapped there. The mobile menu is now one column and gives roughly
 * 330px, so it is no longer the tightest surface.
 *
 * Each entry is [group title, [[href, label], ...]].
 */
export const NAV = [
  // EIGHT GROUPS, AND THE NUMBER WAS MEASURED RATHER THAN CHOSEN. See the long
  // note above for what changed: an accordion moves the cost of a heading from
  // a scarce budget to a spare one on a phone, and smaller blocks pack better
  // into the desktop panel's four CSS columns. Rendered into the real panel,
  // menu closed at 390x844 and open at 1440x900:
  //
  //     groups   390 panel   scrolls?   1440 panel   scrolls?
  //     6        432px       no         912 / 838    YES
  //     7        488px       no         956 / 838    YES
  //     8        544px       no         816 / 838    no
  //
  // Eight is the only count measured NOT to scroll at either end. Going back to
  // six is two array edits and costs the desktop panel its fit, not the phone.
  //
  // THE OLD SIX WERE 2 / 2 / 14 / 18 / 5 / 5 and "Guides" was not a category,
  // it was the leftovers: eighteen links in one unbreakable block, 827px tall,
  // which blew the second column out and pushed Play and Rochester ENTIRELY
  // below the fold. 16 of 46 links were unreachable without scrolling and every
  // Rochester page was one of them. No group here is larger than eight.
  //
  // THE TABLE ABOVE IS STALE BY 65px AND THE SHAPE OF IT IS STILL RIGHT. It was
  // taken before `.menu-find` pinned a search line above the groups, so the 390
  // panel measures 609px today where that row says 544. Re-measured 22 August
  // 2026 on the built tree, driven headless over CDP, menu opened by clicking
  // #menuBtn rather than by adding a class: 390x844 panel 609px in an 844px
  // window, 0.72 of a screen, does not scroll; 1440x900 panel 716px, scrollH
  // 714 against clientH 714, does not scroll. Both ends still fit.
  //
  // THE ORDER CHANGED ON 22 August 2026 AND THE MEMBERSHIP DID NOT. Tim: "keep
  // looking at the nav ... everything thats related to my Youtube Channel and
  // the pack rips info data should all be together, second thing I want to
  // highlight is the Rochester, NY pages, and then the fun games section, and
  // then all the guides can be last ... I want to be a hub for the local
  // community to showcase what they do best". So it is channel, Rochester,
  // games, then the five guide groups in the relative order they already had.
  // Rochester went from eighth to second and Just for fun from seventh to
  // third; nothing was renamed, nothing moved between groups, and every
  // argument written beside a label below is untouched. It is a permutation of
  // whole blocks, which is the only kind of nav edit that cannot lose one.
  //
  // MERGING THE FIVE GUIDE GROUPS WAS THE OBVIOUS NEXT MOVE AND IT WAS
  // MEASURED AND REFUSED. The ask was for a nav that is easier to sort through,
  // and with the guides pushed to the back it looks like they could be one
  // block. Two things say no, and the first is the one that is invisible from
  // the markup:
  //
  //   - ON A PHONE THE PANEL IS ALREADY AN ACCORDION WITH EVERY GROUP SHUT, so
  //     its height is 48px per HEADING and not one pixel per link. Eight shut
  //     summaries plus the pinned search line and the Subscribe pill is 609px
  //     in an 844px window. A reader does not scroll it once, let alone twice,
  //     so the failure the ask describes is not in this panel.
  //   - THE DESKTOP PANEL IS WHERE A MERGE IS PAID FOR, and fewer groups means
  //     taller columns in the same four tracks. Measured 22 August 2026 by
  //     injecting each regrouping into the REAL panel on the real page, the
  //     same 50 links throughout, app.js's own accordion collapse re-applied,
  //     menu opened by clicking #menuBtn:
  //
  //       groups  390 panel  scrolls?   1440 panel     scrolls?  390 footNav
  //       8        609px      no        714 / 714       no        1,535px
  //       7        553px      no        865 / 838       YES       1,492px
  //       6        497px      no        865 / 838       YES       1,448px
  //       4        385px      no      1,523 / 838       YES       1,318px
  //
  //     Every merge scrolls the desktop panel, which is exactly what the table
  //     at the top of this note bought when it settled on eight. The phone
  //     saves 56px per merged group off a panel that already fits in 0.72 of a
  //     screen, and the phone FOOTER, which is the tall surface people actually
  //     mean, barely moves: collapsing all five guide groups into one saves
  //     217px of a 1,535px footer nav and costs the 1440 panel 1.69 screens.
  //
  //   - AND EVERY AVAILABLE MERGE BREAKS THE EIGHT-LINK CAP ANYWAY. Cards and
  //     Sets is 14 links, Prices and Buy-sell-grade is 15, all five guides is
  //     34. The cap is what stopped "Guides" being the leftovers bucket the
  //     paragraph above describes, so a merge is not one array edit: it is a
  //     redistribution, and every label argument written below would have to be
  //     re-opened to do it.
  //
  // So the win the ask is really after is ORDER, not count: the two things Tim
  // named are now the first two headings a thumb lands on, and the guides he is
  // happy to have last are last. No group here is larger than eight.

  // The channel, which is what the site is for. Rips, the playlists that sort
  // them, the best of what came out, what is still being hunted, and how the
  // luck actually ran. "The binder" used to be a separate two-link group for
  // the middle two; two links is not a category either, and these five are one
  // continuous story about the same shoebox.
  //
  // FIRST GROUP, AND SINCE 22 August 2026 THAT IS AN INSTRUCTION RATHER THAN AN
  // INFERENCE. Tim: "everything thats related to my Youtube Channel and the
  // pack rips info data should all be together ... the main focus of the site
  // overall should be my youtube channel, the rip videos, the rip and hit
  // stats". THE FIVE ALREADY WERE THAT LIST and were checked against it one at
  // a time rather than assumed: /videos.html is the rip videos, /playlists.html
  // is how they are sorted, /hall.html is the hit stats, /luck.html is the rip
  // stats, and /wanted.html is the hunt those stats are kept for. Nothing was
  // added and nothing was moved out.
  //
  // "The channel" KEPT AS THE HEADING. It is Tim's own word for the thing, and
  // it is the one heading here that names a SOURCE rather than an errand, which
  // is allowed for the same reason "Rochester, NY" is: for these five the thing
  // you came to do is watch what this channel put out.
  //
  // /about.html IS NOT IN THIS GROUP AND THAT WAS ASKED AND ANSWERED. It is the
  // page that explains the channel, so it has a real claim here; Tim put it in
  // Rochester instead ("About can be under Rochester section too"). The
  // argument is recorded beside it down there rather than repeated here.
  ["The channel", [
    ["/videos.html", "Rips"],
    ["/playlists.html", "Playlists"],
    ["/hall.html", "Best pulls"],
    ["/wanted.html", "Most wanted"],
    // "Rip results" and NOT "Luck, measured". The old label front-loaded a
    // mood, spent its two words on a comma, and named the MEASUREMENT rather
    // than the thing measured. "Rips" is the brand word and is in this page's
    // own title ("What Actually Came Out of 291 Rips" -- this note said 80
    // until 22 August 2026, which is the count the page carried when the label
    // was chosen; the label does not depend on the number, but a quoted title
    // that no longer matches the page is the thing this file keeps catching);
    // "results" is the exact
    // word the page's body uses, and it is the honest one: these are observed
    // results and not pull rates, which The Pokemon Company does not publish
    // and this site never states. Do not retitle this "Pull rates".
    //
    // RE-CHECKED 22 August 2026 WHEN THIS GROUP WAS CONFIRMED AS THE SITE'S
    // FIRST, because "the rip and hit stats" is what Tim called this page and
    // it is a full stats dashboard now rather than the single tally it was.
    // The label still echoes the title, still says results rather than rates,
    // and the refusal above stands. It was not reopened.
    ["/luck.html", "Rip results"],
  ]],

  // The local angle, kept as its own heading because it is the one thing no
  // other Pokemon site has and the one query family this site can realistically
  // rank first for.
  //
  // SECOND GROUP SINCE 22 August 2026, UP FROM EIGHTH, on Tim's ask: "second
  // thing I want to highlight is the Rochester, NY pages ... I want to be a hub
  // for the local community to showcase what they do best, this area is massive
  // for pokemon cards and i want the world to know!" It was LAST, which meant
  // the one family of pages nothing else on the internet competes for was the
  // last heading in the menu and the last column in the footer.
  //
  // "Rochester, NY" SURVIVED A RENAME AND THE QUESTION WAS A FAIR ONE. With the
  // Garbage Plate and About both in it, this stopped being a list of local
  // listings and became the group that carries what the site IS, so a heading
  // nearer "what this is about" was put up. It is refused on three grounds:
  //
  //   - THE PLACE NAME IS THE ERRAND HERE. The rule above is that groups are
  //     named by what you came to do, not by content type, and for this one
  //     family the thing you came to do IS geographic. Somebody who came
  //     because they are local recognises "Rochester, NY" with no context;
  //     nobody recognises "Local scene" without already knowing whose.
  //   - TWO LABELS INSIDE IT DEPEND ON THE HEADING. "Local vendors" and "Local
  //     creators" are local to whatever the heading says. Take the city out of
  //     the heading and both become local to nowhere, which would cost two
  //     renames to fix a heading that was not broken.
  //   - IT IS THE PHRASE PEOPLE TYPE, which is the whole reason the paragraph
  //     above says this is the one query family the site can rank first for. A
  //     heading that reads well and is searched by nobody trades the only SEO
  //     this group has for tidiness.
  //
  // AND THE GROUP DID NOT ACTUALLY STOP BEING ABOUT ROCHESTER when those two
  // joined. /about.html's own description opens "Garbage Rips 585 is a Pokemon
  // card channel from Rochester, New York" and the page calls itself a love
  // letter to the city; /garbage-plate.html's h1 is the city's own dish. Both
  // are Rochester pages that also happen to explain the site.
  //
  // A HUB PAGE MAY LAND AT THE TOP OF THIS GROUP. Another pass is rewriting
  // /vendors.html and /creators.html so they read as a community hub rather
  // than a directory, and may add a Rochester landing page. If it does, it goes
  // FIRST, above "Card shows", because a hub is the thing the other five hang
  // off. Seven links is still inside the eight this file's own note caps groups
  // at, so it costs nothing measured; an eighth would, and would need the panel
  // re-driven at both widths before it shipped.
  ["Rochester, NY", [
    // THE HUB GOES FIRST, and its label is deliberately NOT "Rochester, NY".
    //
    // /rochester.html summarises the five pages below it, so it is the one entry
    // that earns the top of the group. It was proposed as "Rochester, NY" and
    // that is exactly the two-names-one-page failure the note at the top of this
    // file exists to prevent: a group heading and a link inside it reading
    // identically render as a broken duplicate, and a reader who clicks the
    // heading's own words expects the heading's own contents.
    //
    // "Local scene" is 11 characters, front-loaded, and ECHOED BY THE PAGE --
    // its title ends "and the Local Scene" and its kicker reads "585 - The
    // local scene". build-rochester.mjs THROWS if that echo stops being true or
    // if the label passes 20 characters, so this cannot rot quietly.
    //
    // Seven links here, still inside the eight the panel measurement allows.
    ["/rochester.html", "Local scene"],
    // Shops and shows sit next to each other deliberately: they answer the same
    // question a week apart. Keep the labels distinct, the urls are one letter
    // apart and the menu is the only place a reader sees both at once.
    ["/card-shows.html", "Card shows"],
    ["/shops.html", "Card shops"],
    ["/vendors.html", "Local vendors"],
    ["/creators.html", "Local creators"],
    // THE SIXTH LINK IN THIS GROUP, and the note at the top of NAV is what
    // makes it safe: eight groups is the measured count that does not scroll
    // either panel, no group here is larger than eight, and this one was at
    // five. Added 20 August 2026 on Tim's ask for a page about the dish the
    // channel is named after.
    //
    // "Garbage Plate" AND NOT "The plate" OR "Food". The label is the thing
    // people type and the thing on the sign, it is the only two words in this
    // menu that a Rochester reader will recognise instantly, and the page's own
    // h1 asks "What is a Garbage Plate?" so the label and the destination say
    // the same words. It sits under the two card-shopping links and above
    // About, which is reading order: shops and shows are why you came, this is
    // why the channel is called what it is, and About is who is talking.
    //
    // BOTH OF THESE WERE RE-OPENED WHEN ROCHESTER WENT SECOND AND TIM SETTLED
    // BOTH, 22 August 2026. THEY ARE DECISIONS, NOT DEFAULTS: do not move
    // either on a rules argument.
    //
    //   - THE PLATE. "Garbage Plate page needs to go in the Rochester section,
    //     its a piece of Rochester, NY legend and lore." The case for moving it
    //     to "Just for fun" was that it helps nobody buy, open or value a card,
    //     which is that group's stated definition. The case against, and the
    //     one that holds, is that every other page in that group is about
    //     POKEMON: the minigames, the console timeline, the Pokedex facts. A
    //     restaurant list would be the only non-Pokemon page in a group whose
    //     definition is Pokemon-rather-than-cards, while here it sits with five
    //     other Rochester places and is the page that explains the channel's
    //     name to a stranger.
    //   - ABOUT. "About can be under Rochester section too." It was already
    //     here, so this confirms rather than moves it. The argument for pulling
    //     it into "The channel" was that promoting Rochester turns the last
    //     link of the last group into the eleventh link in the nav, and About
    //     is the page explaining the whole site rather than a local listing.
    //     Tim's reading is the other one and it is the site's own: the page is
    //     a love letter to Rochester, so it belongs with Rochester. The reading
    //     order above is unchanged and still describes what is here.
    ["/garbage-plate.html", "Garbage Plate"],
    ["/about.html", "About"],
  ]],

  // Pokemon rather than Pokemon cards: the minigames, the console timeline, the
  // Pokedex facts and the evolution lines. Nothing here helps anybody buy,
  // open or value a card, which is exactly why it is not filed with the pages
  // that do.
  //
  // THIRD GROUP SINCE 22 August 2026, UP FROM SEVENTH. Tim: "and then the fun
  // games section". That is this group, and the ranking is his: channel, then
  // Rochester, then this, then the guides.
  //
  // "Just for fun" KEPT, AGAINST A RENAME TO "Fun and games". The rename had a
  // real argument behind it, which is this file's own: labels are front-loaded
  // nouns because a reader spends about two words per item, and "Just for"
  // spends both on nothing. It is refused because "just" is the word doing the
  // group's actual work. The definition above is that nothing in here helps you
  // buy, open or value a card, and "just for fun" says precisely that in three
  // words; "Fun and games" says the opposite of nothing, it says games, and two
  // of the five links here are not games. The two-word budget is also a finding
  // about scanning a list of fifty LINKS, not about eight headings that a phone
  // renders as the entire menu with a chevron on each.
  //
  // AND IT IS STILL NOT CALLED "Games". /games/ below is called Games and the
  // note on it says why two things called Games in one menu is a navigation
  // problem. Promoting the group does not change that.
  ["Just for fun", [
    ["/games/", "Games"],
    // "Video games" and NOT "Games", which the line above already owns. Two
    // things called Games in one menu is a navigation problem, and the hub is
    // the older claim on the word. This is the reference timeline of every
    // official Pokemon release; that one is the minigames you play here.
    ["/video-games.html", "Video games"],
    ["/lore.html", "Pokemon lore"],
    ["/evolution.html", "Evolution chart"],
    // /eevee-evolutions.html WAS LEFT OUT OF THE NAV ONCE AND THAT WAS THE BUG.
    // The argument was that it is one entry from the chart. What happened is
    // that nothing on the site linked to it at all: 1,849 indexable words in
    // the sitemap and invisible to any crawler following links. It also earns
    // the line: eight branches from one species, each with a different trigger,
    // and "how do I get Umbreon" is asked as its own question.
    ["/eevee-evolutions.html", "Eevee evolutions"],
  ]],

  // Everything you do while holding a card, or looking for one.
  ["Cards", [
    ["/cards.html", "Card search"],
    // /search.html WAS IN NEITHER THE MENU NOR THE FOOTER, on a site where it
    // indexes all 46 nav destinations, 1,025 Pokemon, 5,181 cards, 316 pack
    // openings and 41 set guides. The argument for leaving it out was that the
    // bar's search form is its action, so it needs no nav line.
    //
    // MEASURED, THE BAR FORM DOES NOT EXIST ON A PHONE. Driving /start.html
    // headless, the width of #navSearch:
    //
    //     390   0.0px      560   118.3px      640   190.5px      1440  370.3px
    //
    // Zero. The field is squeezed out of the flex row below about 600px.
    // `.bar-find`, added the same day by another pass, did put a 44px magnifier
    // there pointing at this page. THAT IS AN ICON AND THIS IS A NAME, and the
    // difference was the whole reason to keep both: the icon is a glyph a
    // reader has to guess at, and this is a labelled line sitting beside "Card
    // search", which is the only place the two searches are told apart in
    // words.
    //
    // THE ICON IS GONE ON A PHONE SINCE 19 August 2026 (Tim's ask; see the BAR
    // note below), SO THIS LINE IS NOT A SECOND ROUTE ANY MORE, IT IS THE
    // ROUTE. Do not remove it, do not rename it to something a reader would not
    // recognise as search, and do not move it out of the Cards group without
    // checking that the ui.css rule hiding the magnifier goes at the same time.
    //
    // "Search the site" is the page's own h2, verbatim, so the label and the
    // destination say the same words. It sits under "Card search" rather than
    // above it because the card index is what most people actually want, and
    // the two read as a pair: one searches cards, one searches everything.
    ["/search.html", "Search the site"],
    ["/pokemon/", "By Pokemon"],
    // "What set is it" and NOT "Set finder". A finder is a thing this site
    // does not have; the page is a guide to reading the number after the
    // slash, its h1 is "What set is my card from?", and the label should be
    // the reader's question rather than a product name for a tool.
    ["/what-set.html", "What set is it"],
    ["/rarity.html", "Rarity guide"],
    // "Card types" and not "Types", which is too thin to scan, and not "Energy
    // types", which is the game's word rather than a beginner's.
    ["/types.html", "Card types"],
    ["/base-set.html", "Base Set prints"],
    ["/fake-cards.html", "Fakes"],
  ]],

  // Its own group and no longer four links buried at the top of a fourteen
  // link "Cards" pile. A set is the other thing a reader arrives holding a
  // question about, and all four of these answer it at a different scale:
  // one set, every set, the next set, the whole set's bill.
  ["Sets", [
    ["/sets/", "Set guides"],
    // "All English sets" and NOT "Every set ever", which the page contradicts
    // on its face: it says "All 174 English sets from 1999 to 2026" and then
    // "The site also holds guides for Japanese and Korean sets, which are not
    // English releases and so are on no row here". A label that promises every
    // set ever is a label the page spends a sentence retracting.
    ["/expansions.html", "All English sets"],
    ["/upcoming.html", "Coming next"],
    ["/complete-a-set.html", "Cost to complete"],
    // "Topps cards" (11), added 18 August 2026. It is a family of eleven sets
    // from 1999 to 2004 that are NOT Pokemon TCG sets, so it does not belong
    // beside the set guides on any reading of the word except the one that
    // matters here: a set is the thing a reader arrives holding a question
    // about, and "what set is this from" is exactly the question a Topps card
    // provokes.
    //
    // IT WANTED TO GO IN "Cards", NEXT TO "Base Set prints", and that is the
    // better fit by subject: both are pages about telling a specific vintage
    // card apart in your hand. That group is already at eight, which is the
    // largest any group here is, and this one is at four. Adding a ninth link
    // to the tallest group to save a fifth in the shortest one is the wrong way
    // round for a panel laid out in four columns. RE-MEASURED after adding it,
    // menu open, driven headless over CDP rather than eyeballed:
    //
    //     1440x900   panel 818px, scrollHeight == clientHeight, does not scroll
    //     1280x900   panel 818px, does not scroll
    //      390x900   panel 545px, does not scroll
    //
    // The table above recorded 816px at 1440 and 544px at 390 for eight groups,
    // so a 49th link cost 2px and 1px. It is nearly free because the desktop
    // panel is four CSS columns and this row went into a short one rather than
    // the tall one. All 49 links measure exactly 48px high at 1440 and 44px at
    // 390, so nothing wraps to a second line; "Topps cards" is 154.5px wide in a
    // column that gives about 157.
    //
    // The LABEL is not "Topps" alone, which names a company and could be about
    // anything, and not "Topps sets", which would read as more set guides of the
    // kind /sets/ holds. The page's own h1 is "Topps made Pokemon cards too" and
    // its title leads "Topps Pokemon Cards", so "Topps cards" is the shared
    // word pair. The VALUES page is deliberately not in the nav: it is one tap
    // from the guide, in the site search, and linked from the three ranked price
    // pages, and a second Topps line would spend a nav slot on the second half
    // of one subject.
    ["/topps.html", "Topps cards"],
    // A GUIDE TO ONE PRODUCT LINE, WHICH IS WHAT "Topps cards" ABOVE IS TOO, so
    // it belongs beside it rather than in Prices: a reader looking for it is
    // looking for what the thing IS, and the price is one section of that.
    // 14 characters, inside the 16 the menu column measures.
    ["/first-partner-illustration-collection.html", "First Partners"],
  ]],

  // What a thing costs and what it is worth. Recomputed from the nightly price
  // pull, which is what separates this group from the guides below it.
  ["Prices", [
    // MSRP is the manufacturer's SUGGESTED retail price, and Pokemon Center is
    // The Pokemon Company's own shop selling its own product, so the price it
    // sells at IS the price the manufacturer suggests. Nobody has to honour a
    // suggestion, which is the entire reason for the page.
    //
    // "MSRP check" SURVIVED A PROPOSED RENAME TO "Fair price check" and the
    // refusal is the point. "Fair" is a judgement this page refuses to make:
    // some rows carry no price at all, a display box cannot be priced by
    // multiplying a pack, and Pokemon Center itself lists some product types at
    // two prices on the same day. MSRP is also the page's own h1 word and the
    // one noun in this menu that appears nowhere else. The label promises a
    // check rather than a figure for exactly that reason.
    ["/msrp.html", "MSRP check"],
    ["/pack-prices.html", "Pack prices"],
    // Pack prices divides a price by a pack count and could only ever do that
    // for the kinds whose count is in our data; this is the page that holds the
    // counts themselves, sourced, for every product including the ones that
    // page leaves blank.
    ["/how-many-packs.html", "Packs per box"],
    // "Sealed products" KEPT, against a proposed "What's in each box". Five of
    // the product types this hub covers are not boxes: blister, bundle, and the
    // Chinese, Japanese and Korean single packs. A label promising a box for a
    // page about a blister pack is the same fault as "Every set ever".
    ["/openings/", "Sealed products"],
    // THREE PARALLEL LISTS, and the labels now say so. They are one question
    // asked of three markets: what is the priciest thing you can buy ungraded,
    // sealed, and in a slab. "Priciest cards" and "Priciest sealed" front
    // loaded a superlative and buried the fact that each is a HUNDRED-row list;
    // "Raw top 100" and "Sealed top 100" front-load the market and share the
    // shape of "PSA 10 top 100", which already worked.
    //
    // The third names the MEASUREMENT rather than the subject deliberately. The
    // page is PriceCharting's PSA 10 price guide ranked, not a record of what
    // anything sold for: every auction-record source is gated, and the guide
    // value for Illustrator Pikachu is $16.5m against a reported $5.3m sale. A
    // label reading "Priciest graded" would promise a sales list.
    //
    // "Top 100" is now shared by three labels and by nothing else in the menu:
    // /top-100-playable.html is "Most played" precisely so it does not join them.
    ["/most-valuable-cards.html", "Raw top 100"],
    ["/most-expensive-sealed.html", "Sealed top 100"],
    ["/top-graded.html", "PSA 10 top 100"],
  ]],

  // The three things you do with money and a card, in the order you do them.
  // Grading used to sit under "Guides" on the argument that it is policy rather
  // than market data. That is true and it is not a category: a reader who has
  // just read "Where to sell" is one question away from "will it grade first",
  // and the two pages already link to each other.
  ["Buy, sell, grade", [
    ["/start.html", "Start here"],
    // "I am holding a wallet, what now", against Start here's "I am holding a
    // card, what now". The page exists because of something Tim said: he ends
    // up helping people in shops all the time, because a parent facing a wall
    // of boxes from $10 to $180 has no way to tell which is right.
    ["/what-to-buy.html", "Beginner buys"],
    ["/buying.html", "Where to buy"],
    // "Chain stores" and NOT "Stores that sell cards", which was 22 characters
    // against a 16 character column and wrapped to two lines in both the menu
    // and the footer. "Chain" is the page's own word, used sixteen times on it
    // ("Eight more chains were checked and are not on this list"), and it is
    // what tells this page apart from its two neighbours: /buying.html is
    // online, /shops.html is the local card shop, this is Target and Walmart
    // and GameStop. It is also the parent of nine per-retailer pages, which are
    // reached from the directory and deliberately not listed here.
    ["/retailers.html", "Chain stores"],
    // "Restocks" and NOT "Drops this week". "Drop" is community jargon that
    // also means a price drop and a thing falling; "restock" is the word the
    // trackers themselves use and it is in this page's own title. It sits here
    // rather than under Prices because it is a where-and-when-to-buy page, and
    // it is the only page on the site made of forecasts rather than facts.
    //
    // THE TIME WORDS ARE GONE ON PURPOSE, TWICE OVER. "Restocks this week" was
    // written first and measured at 18 characters: it wrapped to two lines in
    // the desktop menu, whose four columns give a label about 157px, which is
    // roughly 16 characters. It is also a claim with a clock in it, printed
    // into the chrome of 1,478 pages. /drops.html has an expiry model for
    // exactly that reason (see shared/drops.mjs), and a nav label promising
    // "this week" keeps promising it until somebody rebuilds. "Restocks" is
    // true on any day the site is up.
    ["/drops.html", "Restocks"],
    ["/selling.html", "Where to sell"],
    // A PAIR, and the labels have to say so. These answer the two halves of the
    // question somebody asks holding one card: will it grade, and does grading
    // it pay. Labelled "Grading" and "Will it grade" they read as two links to
    // the same page.
    ["/will-it-grade.html", "Will it grade"],
    ["/grading.html", "Grading cost"],
  ]],

  // The card game itself: the rules, the two official apps, and what to build.
  // This was tangled with the Pokedex and minigame pages under one heading and
  // they are not the same errand.
  ["Playing", [
    ["/how-to-play.html", "How to play"],
    // The two free official apps, under the rules page because that is the
    // order somebody meets them: learn the game, then the digital version.
    // "Code cards" is the noun the reader is physically holding, it is that
    // page's own h1 and its first section, and no other label starts with
    // either word.
    ["/tcg-live.html", "Code cards"],
    // "TCG Pocket app" REPLACES "Phone version", and this reverses an argument
    // this file used to make. The old rule was: never front-load an acronym a
    // beginner does not know. What that produced was a label whose words appear
    // NOWHERE on the page it leads to, in a navigation menu, where "Phone
    // version" reads as the mobile version of this website. TCG Pocket is the
    // product's actual name, it is the page's title and h1, and it is what
    // somebody who has heard of it types. "app" carries the beginner.
    ["/tcg-pocket.html", "TCG Pocket app"],
    // The files really do paste into TCG Live: the export format was read off a
    // real artifact and verified byte-for-byte, not written from memory.
    ["/decks.html", "Deck builds"],
    // "Most played" and NOT "Best cards", which is a claim the data cannot
    // support: the ranking is deck-inclusion across published lists from ONLINE
    // tournaments, and the page says so in those words. Shortened from "Most
    // played cards" because "cards" is the noun every label in this menu could
    // carry and therefore the one that distinguishes nothing.
    ["/top-100-playable.html", "Most played"],
  ]],
];

/**
 * The handful of links the bar shows on desktop.
 *
 * FIVE, NOT THREE. The folklore is that a nav should hold 7±2 items, but the
 * people who actually tested navigation published the refutation: Larson and
 * Czerwinski built 8, 16 and 32 link versions of a 512 document site and users
 * were "reliably slowest and were most lost" on the EIGHT link one. Sixteen was
 * fastest. Real content sites cluster at six or seven top level items. Three
 * was under-broad, not restrained.
 *
 * These are hrefs into NAV, never their own labels, so the bar cannot drift
 * from the menu again. A link in two places with two names is two mental
 * models and one of them is always wrong.
 *
 * THE ORDER FOLLOWS NAV'S ORDER, AND THAT IS WHY /card-shows.html MOVED FROM
 * FIFTH TO SECOND on 22 August 2026, in the same edit that made Rochester the
 * second group. This list is a SUBSET of the menu, so its order is the one
 * place the bar can still contradict the panel behind it: a reader who is told
 * Rips, Card search, Set guides, Start here, Card shows across the top, and
 * then opens the menu and is told Rips, Card shows, ... , has been given two
 * priorities for the same site. WCAG 2.2 SC 3.2.3 is about repeated navigation
 * keeping its relative order, and this file already invokes it for the footer
 * matching the menu; the bar is the third surface and was the one left out.
 *
 * IT ALSO DECIDES WHICH LINKS SURVIVE A NARROW WINDOW, AND THE MECHANISM IS
 * POSITIONAL RATHER THAN ELASTIC, which is what makes this array order load
 * bearing rather than cosmetic. assets-source/ui.css has exactly two rules on
 * this row: `@media(min-width:900px){.nav-links{display:flex}}` and
 * `@media(max-width:1099px){.nav-links a:nth-child(n+4){display:none}}`. So the
 * row never overflows and never drops a link for want of space -- between 900
 * and 1099 CSS keeps THE FIRST THREE IN DOCUMENT ORDER and hides the rest, and
 * below 900 it hides all five. `nth-child` reads this array's order directly.
 *
 * Measured 22 August 2026 on the built tree, links actually painted (width and
 * height non-zero, visibility not hidden), old order -> new order:
 *
 *     1440, 1280, 1100   all five                      all five
 *     1000, 900          Rips, Card search, Set        Rips, Card shows,
 *                        guides                        Card search
 *     820, 700, 390      none                          none
 *
 * So the only width band this changes is 900 to 1099, and there it swaps a
 * guide hub out of the three visible slots for the Rochester page, which is the
 * second thing Tim asked to highlight. Nothing about the row's width changed:
 * same five labels, same total, and no label wraps at any width from 320 up.
 *
 * THE PHONE IS UNAFFECTED BY THIS ARRAY ENTIRELY. Below 900 there are no bar
 * links at all, so a phone reader reaches Card shows through the menu panel,
 * where it is now the second group. Do not quote this table as a mobile win.
 */
export const BAR_LINKS = ["/videos.html", "/card-shows.html", "/cards.html", "/sets/", "/start.html"];

/** Every [href, label] in NAV, flattened, in order. */
export const NAV_LINKS = NAV.flatMap(([, links]) => links);

/** Label lookup, so the bar and anything else name a page exactly once. */
const LABEL = new Map(NAV_LINKS);
const labelFor = (href) => {
  const l = LABEL.get(href);
  if (!l) throw new Error(`chrome.mjs: ${href} is in BAR_LINKS but not in NAV`);
  return l;
};

export const SUBSCRIBE =
  "https://www.youtube.com/channel/UCnpEGJ2G_0af1YRyW2euIZQ?sub_confirmation=1";

/**
 * The accessible name on every Subscribe control this file emits.
 *
 * WORD ORDER IS LOAD BEARING AND IT IS NOT A TYPO. This read "Subscribe to
 * Garbage Rips 585 on YouTube. Opens YouTube." until 22 August 2026, which
 * failed WCAG 2.5.3 Label in Name on the two controls whose VISIBLE text is
 * "Subscribe on YouTube" -- the menu pill and the footer button. 2.5.3 wants
 * the visible words to appear as a CONTIGUOUS run inside the accessible name,
 * and "Subscribe ... on YouTube" is split by "to Garbage Rips 585", so voice
 * control on "click Subscribe on YouTube" matched nothing. Measured on the
 * built tree before the change: 2,974 failures, 2 on every one of the 1,487
 * pages. After: 0.
 *
 * Nothing is lost to a screen reader. Same words, same channel name, same
 * "Opens YouTube." tail; the tail sits AFTER the visible run and so costs
 * 2.5.3 nothing, which is the shape build-msrp/selling/upcoming already use.
 *
 * ONE CONSTANT, THREE CALL SITES, because the string used to be typed out
 * three times in this file and a fix that reordered two of them would have
 * left the third reading differently for no reason. It also covers the bar
 * pill, whose visible text is the bare word "Subscribe": that one PASSED 2.5.3
 * before and passes now, because "Subscribe" is still the first word.
 *
 * If you are tempted to restore the smoother English, don't -- re-read the
 * paragraph above. Two more copies of this string live outside this file, on
 * controls that show only "Subscribe" and therefore do not fail: line ~1443 of
 * scripts/build-pages.mjs and line ~766 of scripts/build-about.mjs.
 */
export const SUB_LABEL =
  "Subscribe on YouTube to Garbage Rips 585. Opens YouTube.";

export const SOCIALS = [
  ["yt", "YouTube", "https://www.youtube.com/@GarbageRips585"],
  ["ig", "Instagram", "https://www.instagram.com/garbagerips585/"],
  ["tt", "TikTok", "https://www.tiktok.com/@garbagerips585"],
  ["fb", "Facebook", "https://www.facebook.com/GarbageRips585"],
];

export const SKIP = `<a class="skip" href="#main">Skip to content</a>`;

/**
 * Web fonts.
 *
 * Titan One for display, Outfit for body, Space Mono for labels. Lived only in
 * index.html's head and in each generator's own head template, which meant the
 * two pages built from shared/chrome.mjs alone shipped with no font link at
 * all: valid HTML, correct CSS, every heading silently falling back to the
 * system sans. Nothing errors when a font never loads, so it renders as
 * "the design looks a bit off" rather than as a bug.
 */
// NO PRELOAD LINKS. They were added on the usual reasoning that a font is
// discovered late, only once the CSS has parsed. Measured, the preload did not
// dedupe against the @font-face request and Outfit was fetched TWICE, 32KB each
// time, which is worse than the problem it was meant to solve. fonts.css is a
// single same-origin stylesheet in the head, so the faces are discovered
// immediately anyway.
// PRELOAD IS BACK, AND ONLY BECAUSE IT WAS RE-MEASURED. The warning above was
// real: preload used to fetch Outfit twice, 32KB each, because the preload URL
// and the @font-face src did not match. The variable-font consolidation in
// fonts.css made them identical, so the two requests dedupe and the count is
// verified at 1 per face, not assumed. If fonts.css ever changes a filename,
// re-measure this before trusting it again.
//
// What it buys: fonts.css finished at 328ms but the faces did not start until
// 575ms, a three-hop chain of HTML -> fonts.css -> woff2. Outfit then landed at
// 2,381ms on a throttled phone and the swap reflow was the only layout shift
// left on the site (0.0235 on /cards.html). Seven pages already preloaded and
// scored a clean 0.0000; this gives the other 461 the same head start.
//
// Only Outfit and Titan One. Space Mono is not on every page and preloading a
// face a page never uses is pure waste on the same pipe.

/**
 * The cache-buster, for every asset this file links.
 *
 * WHY THIS EXISTS AS ONE HELPER RATHER THAN THREE MORE COPIES OF THE HASH.
 * ui.css and app.js were stamped here from the day the stale-stylesheet bug was
 * found, and fonts.css, packs.css and packplayer.js were left bare on the
 * reasoning that scripts/stamp-assets.mjs sweeps public/ at the end of the
 * build and adds them. It does, and that is exactly the hole: THE GUARANTEE
 * ONLY HOLDS FOR A FULL BUILD. Run one builder by hand, which is the normal way
 * to work on one page family, and every page it wrote ships with a bare
 * /assets/fonts.css. Nothing errors, nothing looks wrong locally with a warm
 * cache, and the next full build silently repairs it, so the window is invisible
 * from both ends. On launch day a partial build is the likeliest kind there is.
 *
 * So the rule is now: THIS FILE EMITS EVERY ASSET LINK ALREADY STAMPED, and
 * stamp-assets.mjs stays as the sweep that covers the pages this file does not
 * write. Two independent passes agreeing is the point, not duplication: they
 * compute the same sha1 of the same bytes, so a page stamped here is left alone
 * there, and check-build.py now fails the build if either one missed something.
 *
 * SAFE TO HASH AT IMPORT TIME, which is the one thing to check before adding an
 * asset to this list. Nothing in build-all.mjs rewrites fonts.css, packs.css or
 * packplayer.js: fonts.css is hand maintained and committed, packs.css comes
 * from build-packs.py which is deliberately not in the build, and packplayer.js
 * is source. ui.css is the exception that proves it, and build-all.mjs runs
 * build-css.mjs FIRST for exactly this reason. If you ever add a generated
 * asset here, its generator has to run before any page builder or every page
 * carries the hash of a file it is not serving.
 */
const assetV = async (rel) =>
  createHash("sha1")
    .update(await readFile(new URL(`../public/assets/${rel}`, import.meta.url)))
    .digest("hex")
    .slice(0, 8);

const FONTS_V = await assetV("fonts.css");

export const FONTS = `<link rel="preload" href="/assets/fonts/outfit-UYLknw.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/titan-one--khykw.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v=${FONTS_V}">`;

/** Stylesheets, in the order they must load. */
// CACHE BUST THE STYLESHEET, keyed to its own contents.
//
// The link was a bare /assets/ui.css with no version, so a browser that had the
// file cached kept serving it after a deploy. That is invisible for a color
// tweak and catastrophic for a new component: the hits grid shipped its markup
// and its CSS together, and anyone holding an older ui.css got the <ul> with no
// grid rules at all, which renders as one full-width list item per card with a
// 245px scan stretched across the viewport. It looked like a layout bug and was
// a caching bug.
//
// The suffix is a hash of the file, so it changes when and only when the CSS
// does: no version to remember to bump, and no needless re-download.
// Same treatment for the script. A stale app.js is worse than stale CSS: the
// card search, the pack tear and the hits reveal all live in it, so a cached
// copy silently disables features whose markup already shipped.
export const APP_V = await assetV("app.js");
const PACKPLAYER_V = await assetV("packplayer.js");
// packplayer.js rides along on every page, not just rip pages: it is what makes
// a tile play where it sits, and tiles are on the homepage, the set guides and
// /videos.html. ~8KB, and it mounts nothing until something is clicked.
export const APP_JS = `<script src="/assets/app.js?v=${APP_V}" defer></script>
<script src="/assets/packplayer.js?v=${PACKPLAYER_V}" defer></script>`;

const CSS_V = await assetV("ui.css");
const PACKS_V = await assetV("packs.css");

export const STYLES = `<link rel="stylesheet" href="/assets/ui.css?v=${CSS_V}">
<link rel="stylesheet" href="/assets/packs.css?v=${PACKS_V}">`;

/**
 * The same two, for a page that has no pack and no rip tile on it.
 *
 * ADDITIVE, AND DELIBERATELY OPT-IN. APP_JS and STYLES above are untouched, so
 * every page that does not ask for these is byte identical. Only
 * build-video-games.mjs asks so far.
 *
 * WHAT THEY COST WHERE THEY ARE NOT USED, measured 16 August 2026 off the live
 * site's own request log at 1440x900 DPR 2, cache off, which is how GitHub
 * Pages serves them (gzipped):
 *
 *     packplayer.js   27.2KB on disk, 10.3KB transferred, 1 request
 *     packs.css        10.3KB on disk,  1.4KB transferred, 1 request
 *
 * On /video-games.html that was 11.9KB of a 147.0KB on-load total and 2 of the
 * 10 requests that fire before the load event, for a file that finds nothing to
 * attach to and a stylesheet none of whose 29 classes appear in the markup.
 *
 * DO NOT REACH FOR THESE WITHOUT CHECKING THE PAGE, and the check is not the
 * obvious one. packplayer.js looks like it only wires `[data-vcar]` and
 * `img[data-packsrc]`, and a scan for those two says 481 of 487 pages do not
 * need it. That scan is WRONG. Its real entry point is a delegated click
 * handler on `document` matching `a[href*="/rip/"]` that contains an `<img>`
 * OR a `.pack` facade, which is how /videos.html plays a tile in place with no
 * data attribute anywhere in the markup.
 *
 * THE COUNT ABOVE USED TO SAY 294 NEED IT AND 192 DO NOT, AND IT NAMED THE SET
 * GUIDES AS AN EXAMPLE. Both halves were wrong, corrected 16 August 2026 by
 * driving all 173 non-rip pages and asking the RUNTIME DOM the same question
 * packplayer.js asks, rather than grepping the markup:
 *
 *   313  /rip/ pages       every one carries an inline GRPack.attach(r); that
 *                          IS the pack wrapper, so 313 is the FLOOR and any
 *                          answer below it is arithmetically impossible
 *    23  real tile pages   /index.html, /videos.html, and the 21 /playlists/*
 *   ---
 *   336  need it           150 do not, of 486
 *
 * Runtime and not markup, because /videos.html builds its 96 tiles from JSON
 * after load and a static scan sees none of them.
 *
 * A SET GUIDE DOES NOT PLAY A TILE IN PLACE and never did. Its "On the
 * channel" band is `<li><a href="/rip/...">title</a><span>date</span></li>`:
 * plain text, no <img>, no .pack. packplayer requires artwork inside the
 * anchor, so it never claimed those links. All 42 confirmed by dispatched
 * click. What the guides DO carry is a decorative .pack facade with no rip
 * artwork behind it, which is what made a naive regex read 372: 313 + 23 + 36
 * decorative facades reconciles exactly.
 *
 * Guessing still breaks a page silently, which is why this is worth the
 * paragraph: a tile that no longer plays where it sits still navigates to the
 * rip page, so it looks like a design decision rather than a missing script.
 * Verify by dispatching a real click, with a positive control on a page you
 * know does play in place. A null result with no control proves nothing.
 *
 * The three conditions a page must ALL meet, in full:
 *   1. no `<a href*="/rip/">` wrapping an `<img>` or a `.pack`
 *   2. no `[data-vcar]` and no `img[data-packsrc]`
 *   3. none of packs.css's classes in any `class=` attribute (for NO_PACKS_CSS)
 * /video-games.html meets all three: 0 rip links, 0 carousels, 0 pack classes.
 *
 * The other 191 pages that meet them were NOT converted here. Each one belongs
 * to a builder another pass owns, and the win is 11.9KB on a page rather than
 * anything a reader waits for: nothing here is render blocking except
 * packs.css, and none of it is on the critical path. Worth taking when a
 * builder is open anyway, not worth a sweep of its own.
 */
export const APP_JS_NO_PACKPLAYER = `<script src="/assets/app.js?v=${APP_V}" defer></script>`;

export const STYLES_NO_PACKS_CSS = `<link rel="stylesheet" href="/assets/ui.css?v=${CSS_V}">`;

/**
 * Take packs.css off a FINISHED page that turned out to have no pack on it.
 *
 * THE NOTE ABOVE SAYS "worth taking when a builder is open anyway, not worth a
 * sweep of its own", AND IT WAS WRONG ABOUT WHICH KIND OF COST THIS IS. It
 * files packs.css with packplayer.js, and then says of the pair that "nothing
 * here is render blocking except packs.css". packs.css IS the render blocking
 * one. It is a `<link rel="stylesheet">` in the head, so it delays first paint
 * on every page that carries it, and the phone this site is read on is on cell
 * data in a shop queue. 1,888 bytes gzipped, measured on the built file with
 * `gzip -9c public/assets/packs.css | wc -c`, but the byte count is not the
 * point: it is a whole extra render blocking round trip in the one window where
 * ui.css and the fonts are already competing for the link.
 *
 * TWELVE PAGES CARRY IT AND DRAW NO PACK, confirmed from the BUILT HTML rather
 * than from a coverage tool, which matters because CSS coverage is a documented
 * weak signal on this site: it reported packs.css at 0% on a page that plainly
 * renders pack art, because the art is a background on a class the tool never
 * sampled. The eight of those twelve that come through this file's STYLES are
 * head slices of index.html, which is why they could not opt out at the source:
 * their stylesheet links are the home page's.
 *
 * THE TEST IS THE THREE CONDITIONS THE NOTE ABOVE ALREADY STATES, applied to
 * the rendered document rather than trusted from the builder:
 *
 *   1. no class token that packs.css can select. Every rule in that file is
 *      some compound of .pack, .pack-art, .pack-face, .pack-brand,
 *      .pack-mascot, .pack--tile, .pack--img and .pack--<set>, so one token
 *      test beginning "pack" covers all 29 of them and covers a set skin added
 *      next month that nothing here knows the name of.
 *   2. no facade the SCRIPTS build at runtime: no [data-vcar], no
 *      img[data-packsrc], no GRPack.attach.
 *   3. no <a href*="/rip/"> WRAPPING an <img> or a .pack. This is the
 *      condition a static scan gets wrong in both directions, and the note
 *      above is emphatic about it. A bare <li><a>title</a> link to a rip is NOT
 *      a tile: packplayer only claims an anchor with artwork inside it, which
 *      is why 42 set guides and /hall.html keep their rip links and lose the
 *      stylesheet.
 *
 * IT IS A NO-OP ON A PAGE THAT PASSES ANY ONE OF THEM, so it is safe to wrap
 * around every page a builder writes, and it comes back on its own the day a
 * page grows a facade. That is the property the alternative did not have:
 * gating on a builder's own `rips` variable is a second copy of the question
 * that goes stale silently the first time the markup changes.
 */
const PACK_CLASS = /class="[^"]*(?:^|["\s])pack(?=[-\s"])/i;
const PACK_RUNTIME = /\bdata-vcar\b|\bdata-packsrc\b|GRPack\.attach/;
// One anchor to a rip page, up to its own </a>, containing artwork.
const PACK_RIP_TILE = /<a\b[^>]*href="[^"]*\/rip\/[^"]*"[^>]*>(?:(?!<\/a>)[\s\S])*?(?:<img\b|class="[^"]*(?:^|["\s])pack[-\s"])/i;
const PACKS_LINK = /[ \t]*<link rel="stylesheet" href="\/assets\/packs\.css\?v=[^"]*">\n?/;

export function pageUsesPacksCSS(html) {
  return PACK_CLASS.test(html) || PACK_RUNTIME.test(html) || PACK_RIP_TILE.test(html);
}

export function dropUnusedPacksCSS(html) {
  if (pageUsesPacksCSS(html)) return html;
  // A page that never carried the link is not an error: build-video-games.mjs
  // already opts out at the source through STYLES_NO_PACKS_CSS.
  return html.replace(PACKS_LINK, "");
}

/**
 * The sticky bar.
 *
 * THE COMMENT HERE WAS WRONG BY TWO REWRITES. It said the search field is
 * hidden below 640px and the magnifier below 480px. Neither was true: the field
 * was visible all the way down and the magnifier had been deleted from the
 * markup entirely. It described the bar of two passes ago.
 *
 * THERE IS NO SEARCH FIELD IN THE BAR AT ANY WIDTH, AND THAT IS TIM'S CALL,
 * 18 August 2026, in his words: "we can get rid of the search bar, don't think
 * we need search bar". THE REASON MATTERS MORE THAN THE RULE, because the
 * reason is what a later pass will weigh. It is not that the field did not
 * fit. It did not fit on a PHONE, which is a measurement and is written out
 * beside the 560px block in assets-source/ui.css; on a 1440px desktop it fitted
 * with 370px of typable room. It is gone at every width because the owner of
 * the site does not want it there. Do not "restore it on desktop where there
 * is space": the space is not the argument.
 *
 * WHAT REPLACES IT IS A ROUTE, NOT NOTHING, and this is the part that must not
 * be dropped. /search.html indexes all 47 nav destinations, 1,025 Pokemon,
 * 5,181 cards, 41 set guides and 316 pack openings, and until today it was in
 * NEITHER the menu nor the footer. It is now reachable three ways: `.bar-find`,
 * a 44px magnifier in this bar; a named "Search the site" line in the Cards
 * group of the menu; and the same line in the footer. Removing any two of those
 * is survivable. Removing all three strands the largest index on the site
 * behind a URL nobody is told about.
 *
 * `.bar-find` IS NOT IN THIS BAR ON A PHONE ANY MORE, since 19 August 2026, and
 * this line used to say "at every width". Tim, reading his own phone: "lets
 * remove the search icon in the top mobile nav." The markup below is unchanged
 * and the icon is still emitted, because this one string feeds the bar, the
 * menu and the footer and a markup edit would have taken it out of a desktop
 * bar as well; ui.css hides it under max-width:700px alone, with the argument
 * beside the row arithmetic there.
 *
 * SO A PHONE IS DOWN TO TWO OF THE THREE ROUTES AND THAT IS WHY THE MENU LINE
 * IS NOW LOAD BEARING. The paragraph above says removing any two is survivable,
 * which is still true, but it is no longer any two: on a phone the menu line
 * and the footer line are all there is, and the footer one is at the bottom of
 * the document. If a later pass takes the menu line out of the Cards group,
 * take the ui.css rule out in the same edit.
 *
 * WHAT IT COSTS IS THREE TAPS AND NOT TWO, AND THAT IS WORTH WRITING DOWN
 * BECAUSE IT IS EASY TO GET WRONG BY READING THE MARKUP. Every <details> below
 * ships `open`, so a static read of the panel says "Search the site" is on
 * screen the moment the menu opens. It is not: app.js strips `open` below
 * 821px, so a phone gets eight collapsed summaries. Measured at 390x844 over
 * CDP with the panel open, the link's own getBoundingClientRect reports
 * 24,221 342x44 and offsetParent is non-null, and elementFromPoint at the
 * middle of that rect returns the "Cards" SUMMARY: the rect is real and the
 * link is not reachable at it. THE HONEST TEST FOR A LINK INSIDE A CLOSED
 * <details> IS elementFromPoint, NOT offsetParent AND NOT THE RECT.
 *
 * SO THE MENU PINS ITS OWN SEARCH LINE, above the groups and outside every
 * <details>, which is what `.menu-find` is. Two taps, and the second one is
 * labelled rather than guessed at.
 *
 * Tim asked to take the magnifier out of the phone bar. He did not ask to put
 * search three taps away behind a group heading nobody would think to open,
 * and that is what removing it alone did. The line inside Cards STAYS: it is
 * that group's own contents and this is a shortcut, not a move.
 *
 * The route was Menu, Cards, Search the site: 1 tap before this change,
 * 3 after, and the middle one is a group label a reader has to guess holds
 * search. That is the price of the ask and it is Tim's to weigh. If he wants
 * it closer, the cheap fix is a single "Search" line pinned above the groups
 * in this panel, outside every <details>, which is a menu change nobody asked
 * for tonight and is deliberately NOT made here.
 *
 * `.bar-find` IS A LINK, NOT A DISCLOSURE. /search.html is a full page of field
 * plus results, so one tap gets a reader somewhere better than a popover would.
 * It carries the accessible name that the deleted <label> used to.
 *
 * WHAT THE ROW GAINED. 178px at every width above 560px, which went to the nav
 * links: they used to need 1,140px before three of them appeared and 1,340px
 * before all five did, because the form was the only flexible item in the row
 * and five links ate 167px of it. Those thresholds moved down. The arithmetic
 * and the measured sweep are beside `.nav-links` in assets-source/ui.css.
 */
export const BAR = `<header class="bar">
  <div class="bar-in">
    <a class="brand" href="/"><b>GARBAGE <i>RIPS</i> 585</b><span>Rochester, NY</span></a>
    <a class="bar-find" href="/search.html" aria-label="Search cards, sets, guides and rips"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/></svg></a>
    <nav class="nav-links" aria-label="Primary">
${BAR_LINKS.map((h) => `      <a href="${h}">${labelFor(h)}</a>`).join("\n")}
    </nav>
    <button class="menu-btn" type="button" id="menuBtn" aria-expanded="false" aria-controls="menu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <span>Menu</span>
    </button>
    <a class="sub" href="${SUBSCRIBE}" rel="noopener" target="_blank"
      aria-label="${SUB_LABEL}"><span>Subscribe</span></a>
  </div>
</header>`;

/**
 * The panel behind the Menu button. Must sit after </header>.
 *
 * Grouped rather than a flat list. NN/G's mobile study (179 people) found
 * hidden navigation cost more than 20% of content discoverability and made
 * people 15% slower, and that the fix is combo navigation: a few links always
 * visible plus a labeled menu for the rest. Their later work found a 45 point
 * swing in menu usage between two different hamburger implementations, so how
 * the button is presented matters more than whether it exists. Ours keeps the
 * word "Menu" beside the icon for that reason.
 *
 * "Home" is deliberately absent: it was the first thing a thumb landed on,
 * spent on the page you are already reading, and the wordmark already goes
 * home.
 */
/**
 * The menu panel.
 *
 * EACH GROUP IS ONE UNBREAKABLE BLOCK, because the panel lays them out in CSS
 * columns and a group split across a column boundary reads as two groups, one
 * of them unlabelled. `.menu-g` plus break-inside: avoid is what stops that.
 *
 * The panel used to be a single tall column at every width: 22 links and six
 * headings in a 752px window meant a large part of the nav was below the fold
 * on open, including whole groups, on the one screen whose entire job is to
 * show what the site contains. Columns fix it without hiding anything behind a
 * second tap.
 *
 * COLUMNS WERE NOT ENOUGH AND THE NUMBERS SAY SO. With 46 links in six groups
 * the two-column phone panel held 1,449px of content in an 812px window: 16
 * links unreachable without scrolling, all five Rochester pages among them,
 * because one 18-link group is an 827px block that break-inside: avoid will not
 * split. Each group is now a native <details>, shipped open and closed by
 * app.js below 821px. See the block above the template for the whole argument,
 * including why it cannot be done from CSS.
 *
 * EACH GROUP IS A <details>, SO IT IS ALSO A LANDMARK-FREE DISCLOSURE. No
 * nested <nav>: sync-chrome.mjs slices this block with a non-greedy match up to
 * the first </nav>, so a nav inside a nav would have it write a truncated menu
 * into all eight hand-maintained pages and mean it. <details> is safe.
 */
/* THE NAME HAS TO BE UNIQUE, not just present. This panel and the footer nav
   were both aria-label="Site", and a third <nav aria-label="Primary"> sits in
   the bar. A screen reader's landmark list then reads "Site navigation, Site
   navigation, Primary navigation" and the two identical entries are the two
   biggest ones on the page. ARIA11/H97 is explicit that repeated landmarks of
   the same role need labels that tell them apart. Named for where each one is,
   which is how a reader would ask for it. */
/**
 * EACH GROUP IS A NATIVE <details>, AND IT SHIPS `open`.
 *
 * NATIVE, NOT A JS TOGGLE, and the precedent is the home page drops band in
 * scripts/build-proto.mjs: it works with the script blocked, it is keyboard
 * operable, and it is announced as expanded or collapsed for free. There is NO
 * height animation, for the reason recorded there: a <details> cannot animate
 * to auto without JS measuring the panel first, and a max-height guess either
 * clips the last link or eases at the wrong speed. Nothing interactive goes
 * inside the <summary> either, because a link in there is nested interactive
 * content and browsers disagree about whether the tap toggles or navigates.
 * The chevron is an empty aria-hidden span, drawn in CSS.
 *
 * IT SHIPS OPEN AND app.js REMOVES `open` BELOW 821px, WHICH IS THE ONLY ORDER
 * THAT WORKS. A closed <details> cannot be reliably forced open from CSS across
 * browsers, so "collapsed on a phone, expanded on a desktop" cannot be a media
 * query. Open is therefore the default, and it is also the right default: the
 * served HTML then contains all 47 links in their expanded state for anything
 * that reads the markup without running the script, and if the collapse ever
 * throws the reader gets a worse layout rather than a menu that will not open.
 *
 * DO NOT WRITE THAT THIS "DEGRADES TO TODAY'S BEHAVIOUR WITH JS BLOCKED". It
 * was checked with script execution disabled and it does not: `.menu` is
 * display:none until app.js adds `.on`, so with JavaScript off this panel has
 * never opened, before this change or after it. The reader's no-script
 * navigation is the footer, which carries the same 47 links in the same order.
 *
 * app.js also puts `menu-acc` on the panel when it closes them, and that class
 * is what switches ui.css from two columns to one. Same reason: with no class
 * the panel is the old layout exactly.
 *
 * `.menu-h` moved from a <p> to the <summary> and kept its class, so the type
 * treatment did not move. `.menu-g` moved from a <div> onto the <details>, so
 * break-inside: avoid still applies to the whole group.
 */
export const MENU = `<nav class="menu" id="menu" aria-label="All sections">
  <a class="menu-find" href="/search.html">Search the site</a>
  <div class="menu-inner">
${NAV.map(
  ([title, links]) => `    <details class="menu-g" open>
      <summary class="menu-h">${title}<span class="menu-x" aria-hidden="true"></span></summary>
      <ul>
${links.map(([href, label]) => `        <li><a href="${href}">${label}</a></li>`).join("\n")}
      </ul>
    </details>`
).join("\n")}
  </div>
  <a class="menu-sub" href="${SUBSCRIBE}" rel="noopener" target="_blank"
    aria-label="${SUB_LABEL}">Subscribe on YouTube</a>
</nav>`;

/**
 * The footer.
 *
 * `extra` takes a line of page-specific small print, which the set guides use
 * to say where their card data and prices come from.
 */
/**
 * Tim's public Collectr profile.
 *
 * We used to BUILD a collection page from Collectr's API. It is his own
 * tracking app view, not something a visitor comes here for, and a personal
 * utility page in the nav competes for attention with the pages meant to earn
 * traffic. Linking the real profile is one less thing to keep in sync and
 * sends people to the live version rather than last night's snapshot.
 *
 * Deliberately NOT given a social icon: we do not have Collectr's brand mark
 * and inventing one would be putting a made up logo next to four real ones.
 * A named text link says more anyway.
 */
export const COLLECTR = "https://app.getcollectr.com/showcase/profile/563e3401-e88d-48fe-b42f-8f9816dd7f5a";

/**
 * The footer.
 *
 * GROUPED, IN THE SAME ORDER AS THE MENU. It used to print all eighteen links
 * as one undifferentiated row. Baymard's benchmarking is blunt about why that
 * fails: dividing footer links into sections "helps break the flood of links
 * into manageable groups that are easy for the user to scan", and adds that
 * visual separation is worthless if the groups are not also semantically
 * separate. Nobody has run a controlled grouped-versus-flat experiment, so this
 * is expert guidance rather than measured fact, but the flat version also
 * violated the one hard rule here: WCAG 2.2 SC 3.2.3 wants repeated navigation
 * in the same relative order every time, and a flat list in menu order was not
 * that once the menu was grouped.
 *
 * The footer is a low traffic, high intent surface. NN/G: "A footer is the
 * place users go when users they're lost." Optimise it for finding a known
 * thing, not for link count.
 *
 * IT CARRIES EXACTLY WHAT THE MENU CARRIES, ALL 47, AND THAT IS THE DECISION
 * RATHER THAN THE DEFAULT. The brief for this pass called the footer "the one
 * place a long tail can live without costing every reader a scroll", so the
 * obvious move was to hang extra links here that the menu does not show: the
 * nine per-retailer pages, the fourteen sealed product pages, the five games.
 * That was checked and refused. Every one of those is already one tap from a
 * hub that IS in this footer, so they would not be a long tail, they would be
 * a second copy of a page that already indexes them, printed onto 1,471 pages.
 * The thing that genuinely was missing was /search.html, which sat in neither
 * the menu nor this footer while indexing all 47 nav destinations, 1,025
 * Pokemon, 5,181 cards, 41 set guides and 316 openings. It is in NAV now, so it
 * is in both, and that is the whole of the long tail worth adding.
 *
 * WHAT THE REGROUP COST THIS SURFACE, measured on /start.html, headless, the
 * old six-group 46-link footer injected into the same page for the before:
 *
 *     360    1,316.3  ->  1,491.1     +174.8
 *     390    1,316.3  ->  1,491.1     +174.8
 *     768      766.2  ->    745.6      -20.6
 *     1024     502.2  ->    502.2       0.0
 *     1280     502.2  ->    502.2       0.0
 *     1440     415.4  ->    372.8      -42.6
 *
 * So it is TALLER ON A PHONE ONLY, by two headings and by the half-rows that
 * odd-sized groups waste in a two-track grid, and it is the same or shorter
 * everywhere else. The ladder of column counts below was left exactly where the
 * sweep in ui.css put it: three of the four candidate ladders tried there had a
 * width at which the footer got taller as the screen got wider, and none of
 * these numbers is close enough to a breakpoint to justify reopening that.
 *
 * NO LABEL WRAPS AT ANY WIDTH FROM 320 UP, checked by counting client rects
 * rather than by eye. "Stores that sell cards" did, at 22 characters against a
 * 138px track; it is "Chain stores" now.
 *
 * `extra` takes a line of page-specific small print, which the set guides use
 * to say where their card data and prices come from.
 */
/* "Footer", not "Site": see the note on MENU. These two carried the same name. */
export const FOOT_NAV = `<nav class="foot-nav" aria-label="Footer">
${NAV.map(
  ([title, links]) => `      <div class="foot-col">
        <p class="foot-h">${title}</p>
${links.map(([href, label]) => `        <a href="${href}">${label}</a>`).join("\n")}
      </div>`,
).join("\n")}
    </nav>`;

/**
 * The footer Subscribe block.
 *
 * BELOW 560px THE BAR'S OWN .sub IS display:none, so on a phone the only
 * Subscribe above this point is inside the closed hamburger. Measured 17 August
 * 2026 at 390x844 DPR 2, driving the real pages: on /pokemon/gible.html the
 * first VISIBLE control of any kind pointing at the channel was the unlabelled
 * YouTube circle in .foot-social at y=10,078 of a 10,363px page. On
 * /evolution.html it was y=94,648 of 94,910. Those icons carry an aria-label and
 * nothing else, so to a sighted reader who scrolled the whole way the reward was
 * a 44px glyph with no words on it.
 *
 * So the footer gets a NAMED Subscribe with a reason attached, rather than a
 * bare mark. The reason is the point: "Subscribe" alone asks for something and
 * offers nothing, and this is the one place on an informational page where a
 * reader has already read to the end and might say yes.
 *
 * NOT A NEW OUTBOUND DESTINATION. youtube.com was already in this footer, four
 * lines down, as the yt circle. This labels and argues the link the footer
 * already had. Subscribe is the first of the five exceptions in CLAUDE.md and
 * this stays inside it; nothing here adds youtube.com to a page that did not
 * already carry it.
 *
 * IT IS `.btn-sub` NOW, NOT `.btn-yt`, since 18 August 2026. All four Subscribe
 * controls on the site read as one control: the bar pill, the menu pill, this,
 * and the one under the player on a rip page. They share YouTube red, a white
 * label and a hover that darkens rather than inverts. `.btn-yt` could not carry
 * that because it is a gold CTA eight builders point at INTERNAL pages, so
 * recolouring it would have spread red across roughly 1,400 pages. The fence
 * around that colour is written out in the `--yt-red` block in
 * assets-source/ui.css and it names every place the red is allowed.
 *
 * KEEP THE MARKER COMMENTS. sync-chrome.mjs slices this block out by them to
 * keep the eight hand-maintained pages in step, exactly as it does for the bar,
 * the menu and the footer nav. The footer nav is the precedent and the warning:
 * it was the one block NOT guarded, and it is the one that drifted.
 */
export const FOOT_SUB = `<!--FOOT_SUB:START-->
    ${/* THE BADGE LIVES IN FOOT_SUB AND THAT IS NOT WHERE IT BELONGS SEMANTICALLY.
          It is a brand mark and this constant is the Subscribe block. It is here
          because this is the only guarded region between the footer nav and
          .foot-social, and sync-chrome.mjs copies exactly that span into the
          eight hand-maintained pages. Put the mark outside it and those eight
          pages silently do not get it -- which is the drift this file's own
          header calls out as having already happened once to the footer nav.
          If a FOOT_MARK block is ever split out, add it to BLOCKS in
          sync-chrome.mjs in the same commit or it will not travel. */ ""}
    <img class="foot-mark" src="/assets/made-in-roc.webp" width="256" height="218"
      alt="The Garbage Rips 585 badge: a Rochester manhole cover carrying the city's flower emblem, with Trubbish in the middle and the words MADE IN ROC across the bottom" loading="lazy" decoding="async">
    <p class="foot-tag">Grab a fork. Let's rip.</p>
    <a class="btn btn-sub" href="${SUBSCRIBE}" rel="noopener" target="_blank"
      aria-label="${SUB_LABEL}">Subscribe on YouTube</a>
    <p>A new rip most days. Every pack we open goes up, hit or no hit.</p>
    <!--FOOT_SUB:END-->`;

export const footer = (extra = "") => `<footer>
  <div class="wrap">
    ${FOOT_NAV}
    ${FOOT_SUB}
    <div class="foot-social">
${SOCIALS.map(
  ([cls, label, href]) =>
    `      <a class="soc ${cls}" href="${href}" aria-label="${label}"><svg aria-hidden="true"><use href="#i-${cls}"/></svg></a>`
).join("\n")}
    </div>
    <p class="foot-collectr"><a href="${COLLECTR}" rel="noopener" target="_blank" aria-label="See the whole collection on Collectr, opens on their site">See the whole collection on Collectr &rarr;</a></p>
    <p>&copy; <span id="year">2026</span> Garbage Rips 585 &bull; Made in the Flower City &bull; Rochester, NY<br>
    ${extra ? extra + "<br>" : ""}Card and sticker art by Unableplacebo. Fan content. Not affiliated with The Pokemon Company or Nintendo.</p>
  </div>
</footer>`;

/**
 * Icon definitions.
 *
 * <use href="#x"> only resolves within the same document, so every symbol a
 * page references has to be in that page's sprite. The set guides use
 * fc-flower before their section labels, and it was missing from here, so 23
 * pages rendered a blank space where the flower should be.
 */
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="fc-flower" viewBox="0 0 24 24"><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(72 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(144 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(216 12 12)"/><ellipse cx="12" cy="5.4" rx="3.1" ry="4.6" transform="rotate(288 12 12)"/></symbol>
  <symbol id="i-yt" viewBox="0 0 24 24"><path d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12zM9.8 15.4V8.6l5.8 3.4z"/></symbol>
  <symbol id="i-ig" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm8.4-11.2a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5z"/></symbol>
  <symbol id="i-tt" viewBox="0 0 24 24"><path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.2-2.6V9.4a5.9 5.9 0 1 0 5.3 5.9V8.7a7 7 0 0 0 4.1 1.3V6.9a3.9 3.9 0 0 1-4.1-3.9z"/></symbol>
  <symbol id="i-fb" viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></symbol>
</svg>`;


/**
 * Compare index.html's inlined chrome against this module.
 *
 * Called by build-proto.mjs. Whitespace is normalised because the two are
 * formatted differently; everything else must match exactly.
 */
export function checkDrift(indexHtml) {
  const norm = (x) => x.replace(/\s+/g, " ").trim();
  const slice = (start, end) => {
    const a = indexHtml.indexOf(start);
    if (a === -1) return null;
    const b = indexHtml.indexOf(end, a);
    return b === -1 ? null : indexHtml.slice(a, b + end.length);
  };

  const problems = [];
  const checks = [
    ["bar", slice('<header class="bar">', "</header>"), BAR],
    ["menu", slice('<nav class="menu"', "</nav>"), MENU],
    // The footer nav was NOT checked, and that is exactly where the drift
    // happened: index.html kept a hand-written six link footer while
    // NAV_LINKS grew to seventeen, and four builders lift the footer out of
    // index.html verbatim, so seven pages shipped without a single link to
    // any card guide. A guard with a hole in it is the shape of the bug.
    [
      "foot-nav",
      slice('<nav class="foot-nav"', "</nav>"),
      FOOT_NAV,
    ],
    // The footer Subscribe block. Guarded from the day it was added rather than
    // after it drifted, which is the one lesson the foot-nav entry above is.
    // Matched between the footer nav and .foot-social for the same reason
    // sync-chrome.mjs does, and with the same refusal to cross a </nav>: see the
    // long note beside that regex for what a plain lazy match destroys here.
    [
      "foot-sub",
      /<\/nav>(?:(?!<\/nav>)[\s\S])*?<div class="foot-social">/.exec(indexHtml)?.[0] ?? null,
      `</nav>\n    ${FOOT_SUB}\n    <div class="foot-social">`,
    ],
  ];
  for (const [name, found, want] of checks) {
    if (found == null) problems.push(`${name}: not found in index.html`);
    else if (norm(found) !== norm(want)) problems.push(`${name}: differs from shared/chrome.mjs`);
  }
  return problems;
}
