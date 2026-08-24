/* Garbage Rips 585 — shared behaviour.
   No dependencies, no build step. Everything degrades to working HTML. */
(function () {
  "use strict";

  var CHANNEL_ID = "UCnpEGJ2G_0af1YRyW2euIZQ";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- utils */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // THE BROWSER COPY of viewCount/compactCount in shared/format.mjs. A browser
  // cannot import that module, so this restates it and the two have to stay in
  // step: build-proto.mjs renders the first tiles server side and this renders
  // every tile after a filter, so any difference shows up as two spellings of
  // the same number in one grid. Read the comment there before changing this.
  //
  // Two things this got wrong for as long as it existed. It said "1 views" on
  // the newest upload, which is the first tile in the library. And it kept one
  // decimal above ten thousand where the server dropped it, so the same video
  // would have read "15.5K views" here and "16K VIEWS" from the server.
  function fmtViews(n) {
    if (!(n > 0)) return "";
    var s = n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
      : n >= 1e3 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, "") + "K"
      : String(n);
    return s + (n === 1 ? " view" : " views");
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    if (!iso) return "";
    var p = iso.split("-");
    return MONTHS[+p[1] - 1] + " " + +p[2] + ", " + p[0];
  }

  /* ------------------------------------------------------------ video card
     Tiles do not use YouTube thumbnails at all: the art is a CSS booster pack
     (see makePack below), because the poster frame is nearly always the pulled
     card and would spoil the video. A thumbUrl()/THUMB_CHAIN pair for the
     oardefault WebP chain used to live here, called by nothing since the pack
     replaced it. The rip pages DO want that WebP frame for the player poster,
     and build-pages.mjs now emits it directly in a <picture>. */

  // Warm the player origins the first time a card is hovered, once per page
  // rather than once per tile.
  var warmed = false;
  function warmPlayer() {
    if (warmed) return;
    warmed = true;
    ["https://www.youtube-nocookie.com", "https://www.google.com"].forEach(function (h) {
      var l = document.createElement("link");
      l.rel = "preconnect";
      l.href = h;
      document.head.appendChild(l);
    });
  }


  /**
   * A sealed booster pack skinned to the card set. Skins are original designs
   * keyed to each set's colour identity (see .pack--* in ui.css), not
   * reproductions of the official pack artwork. Unknown sets fall back to the
   * Garbage Rips green.
   */
  function makePack(setId, variant) {
    var pack = el("span", "pack" + (setId ? " pack--" + setId : "") + (variant === "tile" ? " pack--tile" : ""));
    pack.setAttribute("aria-hidden", "true");
    var face = el("span", "pack-face pack-l");
    face.appendChild(el("span", "pack-art"));
    var brand = el("span", "pack-brand");
    brand.appendChild(document.createTextNode(setId ? labelOf("sets", setId) : "GARBAGE RIPS"));
    brand.appendChild(el("small", null, setId ? "GARBAGE RIPS 585" : "585"));
    face.appendChild(brand);
    var seal = el("span", "pack-seal");
    seal.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    face.appendChild(seal);
    pack.appendChild(face);
    return pack;
  }

  /**
   * One video tile, in the same markup the generated pages use, so the library
   * and the home page share a single component instead of two that drift.
   * See .v / .art / .play / .dur in assets/ui.css.
   */
  function makeCard(v, opts) {
    opts = opts || {};
    var card = el("article", "v");

    // Tiles navigate to the video's own page on this site, which is where the
    // embed lives. Nothing on a grid sends the visitor to youtube.com.
    var href = v.path ? "/" + v.path : "/videos.html";
    var art = el("a", "art");
    art.href = href;
    art.setAttribute("aria-label", v.siteTitle || v.title);  // full title stays the accessible name

    // Sealed pack instead of the YouTube poster frame, which is nearly always
    // the pulled card and gives the whole video away before you open it.
    //
    // A video can carry more than one set (a tin holding packs from two, an ex
    // box holding ten across four). When the visitor has filtered to one set,
    // show that set's pack; unfiltered, show the generic multi-set wrapper
    // rather than implying the rip was only one of them.
    var sets = v.sets || [];
    // The set this tile speaks for: the one being filtered on where the video
    // carries it, otherwise the first it is tagged with. The ARTWORK reads from
    // this; the caption no longer does, and the "PERFECT ORDER +1 under a Chaos
    // Rising filter" fault it was added for cannot recur, because the caption
    // can no longer name a set at all.
    var lead = opts.preferSet && sets.indexOf(opts.preferSet) > -1 ? opts.preferSet : sets[0];
    var set = lead;
    if (!opts.preferSet && sets.length > 1) set = "multi";
    else if (!set) set = "default";
    art.appendChild(makePack(set, "tile"));

    if (opts.rank) art.appendChild(el("span", "rank", String(opts.rank)));

    var pull = (v.pulls || [])[0];
    if (pull) art.appendChild(el("span", "hit", labelOf("pulls", pull)));

    if (v.duration) art.appendChild(el("span", "dur", clock(v.duration)));

    // THE BROWSER COPY of RIP_BANNER in shared/format.mjs, and it is the copy
    // that gets missed. This grid is drawn here on load and redrawn on every
    // filter change, so /videos.html, the page with more tiles on it than any
    // other, is the one surface a change made in the builders alone cannot
    // reach: the server render in build-proto.mjs's libCard would say one thing
    // and the first filter tap would replace it with another. The two markups
    // have to match element for element, class for class, word for word.
    //
    // aria-hidden for the reason that constant gives: the anchor above already
    // carries the video's full title as its accessible name, and this is the
    // affordance, not the name.
    var hint = el("span", "pack-hint", "CLICK TO RIP THE PACK");
    hint.setAttribute("aria-hidden", "true");
    art.appendChild(hint);

    art.addEventListener("pointerenter", warmPlayer, { passive: true });
    card.appendChild(art);

    var h3 = el("h3");
    // The tile shows what was opened; the full YouTube title stays as the
    // link's accessible name above, so nothing is lost to a screen reader.
    var a = el("a", null, v.label || v.siteTitle || v.title);
    a.href = href;
    h3.appendChild(a);
    card.appendChild(h3);

    // WHAT WAS OPENED, and it used to be the set. The set is already in the h3
    // and painted on the pack, so this said one fact three times. The argument,
    // the numbers and the reason there is no "+N" are above libCard in
    // build-proto.mjs, which renders the first 48 and must emit the same bytes.
    var bits = [];
    var prod = (v.products || [])[0];
    if (prod) bits.push(labelOf("products", prod).toUpperCase());
    if (v.views) bits.push(fmtViews(v.views).toUpperCase());
    else if (v.published) bits.push(fmtDate(v.published).toUpperCase());
    card.appendChild(el("p", null, bits.join("  \u2022  ")));

    return card;
  }

  function clock(sec) {
    if (!sec) return "";
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }

  /* ------------------------------------------------------------- taxonomy
     Mirrors shared/taxonomy.mjs for display purposes only. The heavy lifting
     (matching) happens at sync time, not in the browser.

     MIRRORS MEANS BYTE FOR BYTE. These labels are rendered onto tiles, and the
     server renders the first batch from CARD_SETS in shared/taxonomy.mjs while
     this renders every tile after a filter. When the two disagree the same set
     is spelled two ways inside one grid, which is what "pokemon-go" did: this
     map said "Pokemon GO" and taxonomy.mjs says "Pokémon GO", which is the name
     the API gives it in public/data/sets.json and the one the set guides use.

     Accenting it is safe for SEARCH because norm() below strips accents before
     comparing, so "pokemon go" typed into the filter still matches. That was
     already true and its comment already said so. */

  var LABELS = {
    sets: {
      "pitch-black": "Pitch Black", "phantasmal-flames": "Phantasmal Flames",
      "ascended-heroes": "Ascended Heroes", "pokemon-go": "Pokémon GO",
      "perfect-order": "Perfect Order", "chaos-rising": "Chaos Rising",
      "mega-evolution": "Mega Evolution", "black-bolt": "Black Bolt",
      "white-flare": "White Flare", "destined-rivals": "Destined Rivals",
      "journey-together": "Journey Together", "prismatic-evolutions": "Prismatic Evolutions",
      "surging-sparks": "Surging Sparks", "stellar-crown": "Stellar Crown",
      "shrouded-fable": "Shrouded Fable", "twilight-masquerade": "Twilight Masquerade",
      "temporal-forces": "Temporal Forces", "paldean-fates": "Paldean Fates",
      "paradox-rift": "Paradox Rift", "obsidian-flames": "Obsidian Flames",
      "paldea-evolved": "Paldea Evolved", "scarlet-violet": "Scarlet & Violet", "151": "151",
      // THE IMPORTED SETS WERE FALLING THROUGH TO THE TITLE-CASE FALLBACK, so
      // 21 of the 312 tiles wore a pack reading "Ja Abyss Eye" and "Ko Clay
      // Burst": the raw slug with a capital letter on it, which is precisely
      // what the fallback exists to avoid looking like. Found by diffing this
      // grid against the one build-proto.mjs now renders into the HTML, which
      // takes its names from shared/taxonomy.mjs and had them right.
      "ja-abyss-eye": "Abyss Eye (JP)", "ja-cyber-judge": "Cyber Judge (JP)",
      "ja-mega-brave": "Mega Brave (JP)", "ja-mega-symphonia": "Mega Symphonia (JP)",
      "ja-nihil-zero": "Nihil Zero (JP)", "ja-ninja-spinner": "Ninja Spinner (JP)",
      "ja-stellar-miracle": "Stellar Miracle (JP)", "ja-violet-ex": "Violet ex (JP)",
      "ko-battle-partners": "Battle Partners (KR)", "ko-clay-burst": "Clay Burst (KR)",
      "ko-crimson-haze": "Crimson Haze (KR)", "ko-mask-of-change": "Mask of Change (KR)",
      "zh-gem-pack-2": "Gem Pack Vol. 2 (CN)",
      // THE 51 SETS THE FALLBACK BELOW GETS WRONG, AND ONLY THOSE 51.
      //
      // The video log's Set dropdown offers all 174 English sets, not just the
      // 28 with a guide page, because a tin can hold a pack from a 2019 set.
      // Any of them can therefore land on a tile this file renders after a
      // filter, and there is no guide page to borrow a name from.
      //
      // Listing all 146 guideless sets here costs 2.1KB gzipped on a file that
      // loads on all 426 pages, and 95 of them do not need it: title-casing
      // "unbroken-bonds" gives "Unbroken Bonds", which is exactly right. These
      // are the ones where it is not, measured rather than guessed, and they
      // fail loudly: "Mcdonald S Collection 2011", "Sword And Shield",
      // "Hgss Black Star Promos", "Breakthrough". 712 bytes gzipped for all 51.
      //
      // check-build.py verifies the whole invariant on every build: for every
      // set id in videos.json, whatever labelOf() would return here has to equal
      // the name shared/taxonomy.mjs prints on the server. So this staying at 51
      // is checked, not assumed, and a future edit to the fallback cannot make
      // this list quietly wrong.
      "scarlet-violet-energies": "Scarlet & Violet Energies",
      "scarlet-violet-black-star-promos": "Scarlet & Violet Black Star Promos",
      "mcdonalds-collection-2022": "McDonald's Collection 2022",
      "celebrations-classic-collection": "Celebrations: Classic Collection",
      "mcdonalds-collection-2021": "McDonald's Collection 2021",
      "champions-path": "Champion's Path",
      "pokemon-futsal-collection": "Pokémon Futsal Collection",
      "sword-shield": "Sword & Shield",
      "swsh-black-star-promos": "SWSH Black Star Promos",
      "mcdonalds-collection-2019": "McDonald's Collection 2019",
      "mcdonalds-collection-2018": "McDonald's Collection 2018",
      "mcdonalds-collection-2017": "McDonald's Collection 2017",
      "sm-black-star-promos": "SM Black Star Promos", "sun-moon": "Sun & Moon",
      "mcdonalds-collection-2016": "McDonald's Collection 2016",
      "breakpoint": "BREAKpoint",
      "mcdonalds-collection-2015": "McDonald's Collection 2015",
      "breakthrough": "BREAKthrough",
      "mcdonalds-collection-2014": "McDonald's Collection 2014", "xy": "XY",
      "xy-black-star-promos": "XY Black Star Promos",
      "mcdonalds-collection-2012": "McDonald's Collection 2012",
      "mcdonalds-collection-2011": "McDonald's Collection 2011",
      "black-white": "Black & White", "bw-black-star-promos": "BW Black Star Promos",
      "call-of-legends": "Call of Legends", "hs-triumphant": "HS—Triumphant",
      "hs-undaunted": "HS—Undaunted", "hs-unleashed": "HS—Unleashed",
      "heartgold-soulsilver": "HeartGold & SoulSilver",
      "hgss-black-star-promos": "HGSS Black Star Promos",
      "pokemon-rumble": "Pokémon Rumble", "pop-series-9": "POP Series 9",
      "pop-series-8": "POP Series 8", "pop-series-7": "POP Series 7",
      "pop-series-6": "POP Series 6", "diamond-pearl": "Diamond & Pearl",
      "dp-black-star-promos": "DP Black Star Promos", "pop-series-5": "POP Series 5",
      "pop-series-4": "POP Series 4", "pop-series-3": "POP Series 3",
      "ex-trainer-kit-2-minun": "EX Trainer Kit 2 Minun",
      "ex-trainer-kit-2-plusle": "EX Trainer Kit 2 Plusle",
      "pop-series-2": "POP Series 2", "firered-leafgreen": "FireRed & LeafGreen",
      "pop-series-1": "POP Series 1", "ex-trainer-kit-latias": "EX Trainer Kit Latias",
      "ex-trainer-kit-latios": "EX Trainer Kit Latios",
      "team-magma-vs-team-aqua": "Team Magma vs Team Aqua",
      "ruby-sapphire": "Ruby & Sapphire", "best-of-game": "Best of Game"
    },
    // THE PRODUCT RAIL AND THE TILES UNDER IT DISAGREED. A tile reads "Ascended
    // Heroes ex Box #2" (riplabel.mjs) while the chip above it said "EX Box",
    // and "ex-premium" was missing entirely so the title-case fallback wrote
    // "Ex Premium" over a tile saying "ex Premium Collection". Same words now,
    // and the same words again in PRODUCT_LABELS in build-proto.mjs, which is
    // the home page's copy of this rail.
    // ON A TILE NOW, NOT ONLY ON A CHIP, so this has to mirror taxonomy.mjs the
    // way LABELS.sets does: `short` where PRODUCT_TYPES carries one, `label`
    // otherwise. Four ids live in videos.json disagreed. See libCard.
    products: {
      upc: "UPC", etb: "ETB", "booster-box": "Booster Box", "ex-box": "ex Box",
      "ex-premium": "ex Premium Collection", bundle: "Booster Bundle",
      blister: "Blister", tin: "Tin", "poke-ball-tin": "Poke Ball Tin",
      "collection-box": "Collection Box", "single-pack": "Single Pack",
      "japanese-pack": "Japanese Booster Pack", "korean-pack": "Korean Booster Pack",
      "chinese-pack": "Chinese Booster Pack", "knock-out": "Knock Out Collection",
      // Unused so far; riplabel.mjs notes the same latency. Without them the
      // day one is logged the fallback prints "Spc" on a tile.
      spc: "Super Premium Collection", "ex-special": "ex Special Collection"
    },
    pulls: {
      sir: "SIR", ir: "IR", gold: "Gold", "alt-art": "Alt Art",
      "double-rare": "Double Rare", charizard: "Charizard"
    }
  };
  // LABELS mirrors shared/taxonomy.mjs by hand, so a set added there but not
  // here would otherwise surface as a raw slug. Title-case the id as a
  // fallback: "ascended-heroes" reads as "Ascended Heroes", not perfect for
  // every name but never broken-looking.
  function labelOf(group, id) {
    var hit = LABELS[group] && LABELS[group][id];
    if (hit) return hit;
    return String(id).split("-").map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }

  /* ------------------------------------------------------------ data load */

  var dataPromise = null;
  function loadVideos() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch("data/videos.json")
      .then(function (r) {
        if (!r.ok) throw new Error("videos.json " + r.status);
        return r.json();
      })
      .then(function (d) {
        var videos = d.videos || [];
        // NO LIVE FEED LAYER. This used to fetch /api/latest, a Cloudflare
        // Pages Function that proxied the YouTube RSS feed, because the feed
        // sends no CORS headers and cannot be read from the browser directly.
        //
        // The site deploys to GitHub Pages, which serves static files and
        // cannot execute a function, so that fetch was a guaranteed 404 on
        // every load of every page with a grid. It failed inside a .catch() so
        // nothing broke visibly; it just spent a request to learn nothing.
        //
        // Freshness comes from the nightly refresh workflow instead, which runs
        // sync-youtube at 07:10 UTC and can be triggered by hand, so a new
        // upload is on the site within a day rather than within a minute.
        return videos;
      });
    return dataPromise;
  }

  function loadPlaylists() {
    return fetch("data/playlists.json")
      .then(function (r) { return r.ok ? r.json() : { playlists: [] }; })
      .catch(function () { return { playlists: [] }; });
  }

  /* --------------------------------------------------------- hits picking
     Prefer a real "Hits" playlist once the sync has run. Until then, derive
     it: videos whose title/description flagged a genuine chase pull, ranked by
     views. Same shape either way, so the UI never has to care. */

  /**
   * The Hall of Fame. Fed by a YouTube playlist whose title mentions
   * "greatest", falling back to anything marked greatest in the manual video
   * log. Returns null when neither exists, and the section hides itself.
   */


  /* ------------------------------------------------------------- homepage */


  /**
   * The "jump straight to a set" band. Built from the real tag counts so a set
   * appears the moment videos are tagged with it, and shows the official set
   * logo when one has been added. No manifest: the URL is derived from the set
   * id, and a set with no logo file falls back to a text chip on error.
   */

  function emptyState(big, small, withMascot) {
    var d = el("div", "empty");
    // Only the "you filtered everything away" case gets the mascot. The loading
    // and error states use this too, and a picture that pops in a moment before
    // the grid replaces it is noise, not personality.
    if (withMascot) {
      var img = document.createElement("img");
      img.className = "empty-mascot";
      img.src = "/assets/trubbish.webp";
      img.alt = "";
      img.width = 512;
      img.height = 512;
      img.decoding = "async";
      d.appendChild(img);
    }
    d.appendChild(el("p", "big", big));
    d.appendChild(el("p", null, small));
    return d;
  }

  /**
   * The mascot lands. Takes an `.empty` ALREADY IN THE DOCUMENT that carries an
   * `.empty-mascot`. Rules, timings and the argument: ui.css, by `.empty-mascot`.
   *
   * COMMENTS ARE NOT FREE IN THIS FILE. ui.css is stripped of them on the way
   * to public/; this file ships to 1,486 pages exactly as written, so the
   * reasoning lives there and the pointers live here.
   *
   * `reduced` first, and it is the whole safety mechanism: ui.css's blanket
   * rule kills the transition and NOT the opacity:0 that arming adds.
   */
  function landMascot(box) {
    if (!box || reduced) return;
    if (!box.querySelector(".empty-mascot")) return;
    box.classList.add("is-armed");
    // Failsafe: strips the hidden state at its SOURCE, like the hit cards.
    // rAF does not run in a background tab, which is the case this is for.
    var fail = setTimeout(function () {
      box.classList.remove("is-armed");
      box.classList.add("is-in");
    }, 2000);
    // Two frames, so the armed state is resolved before the change out of it.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        box.classList.add("is-in");
        clearTimeout(fail);
      });
    });
  }

  /**
   * The search miss on /search.html is the one empty state this file does not
   * build: build-search.mjs writes that panel from its own inline script. One
   * observer on that one panel beats a second copy of the mechanic in a builder.
   *
   * A miss followed by a miss is the same state arriving twice, so only a
   * mascot that was not already on screen lands.
   */
  function initSearchMascot() {
    var out = document.getElementById("sqOut");
    if (!out || reduced || !window.MutationObserver) return;
    new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        var had = false, i;
        for (i = 0; i < r.removedNodes.length; i++) {
          var rn = r.removedNodes[i];
          if (rn.nodeType === 1 && rn.querySelector && rn.querySelector(".empty-mascot")) had = true;
        }
        if (had) return;
        for (i = 0; i < r.addedNodes.length; i++) {
          var an = r.addedNodes[i];
          if (an.nodeType === 1 && an.classList && an.classList.contains("empty")) landMascot(an);
        }
      });
    }).observe(out, { childList: true });
  }

  /* -------------------------------------------------------- library page */

  function initLibrary() {
    var grid = document.getElementById("libGrid");
    if (!grid) return;

    // `pull` IS A FILTER THE URL COULD ASK FOR AND NOTHING IMPLEMENTED. The home
    // page rail has carried a gold "Hits only 10" chip pointing at
    // /videos.html?pull=1 for as long as the rail has existed, beside seven
    // ?set= and ?product= chips that all work. readUrl ignored the parameter and
    // writeUrl then stripped it from the address bar, so the one chip the page
    // draws in gold landed on the unfiltered catalogue: 316 rips under a label
    // promising 10, with the url tidied up on the way so nothing looked wrong.
    // Found by driving the link rather than by reading it.
    var state = { q: "", sets: [], products: [], pull: false, sort: "new" };

    // The pull ladder, mirroring PULL_RANK in build-proto.mjs, which is what
    // counts the "Hits only" chip. Order does not matter here, membership does.
    var PULL_TIERS = ["gold", "sir", "ir", "double-rare", "charizard"];
    var all = [];

    // URL is the source of truth so any filtered view is shareable.
    function readUrl() {
      var p = new URLSearchParams(location.search);
      state.q = p.get("q") || "";
      state.sets = (p.get("set") || "").split(",").filter(Boolean);
      state.products = (p.get("product") || "").split(",").filter(Boolean);
      state.pull = p.get("pull") === "1";
      state.sort = p.get("sort") || "new";
    }
    function writeUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set("q", state.q);
      if (state.sets.length) p.set("set", state.sets.join(","));
      if (state.products.length) p.set("product", state.products.join(","));
      if (state.pull) p.set("pull", "1");
      if (state.sort !== "new") p.set("sort", state.sort);
      var qs = p.toString();
      history.replaceState(null, "", qs ? "?" + qs : location.pathname);
    }

    /* ------------------------------------------------------------ search */

    /**
     * Fold a string into something comparable.
     *
     * Lowercase, accents stripped, "&" spelled out, everything else that is not
     * a letter or digit reduced to a space. Without this the two most likely
     * things anyone types both fail: "pokemon go" does not match "Pokemon GO"
     * once the source carries an accent, and "scarlet and violet" does not
     * match "Scarlet & Violet".
     */
    function norm(str) {
      return String(str == null ? "" : str)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        // APOSTROPHE DELETED, NOT SPACED. See shared/search-text.mjs: folding it
        // to a space split "Erika's" into two tokens and made the natural
        // "erikas invitation" match nothing across 419 cards. Both halves of the
        // site fold the same way or the symmetry this function exists for is
        // gone.
        .replace(/['\u2019]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        // THE ONE SUFFIX FAMILY THE OFFICIAL NAME JOINS AND PEOPLE SPACE OUT.
        // A card is printed "Cinderace VMAX", and a reader typing it that way
        // got 0 of 319 while "Cinderace V Max" got 1, because the rip log's
        // cell for that pull spells it spaced. THE CELL IS THE OWNER'S TO FIX
        // and this is not a workaround for it: after he fixes it the failure
        // simply reverses, and a reader who types "Cinderace V Max" against a
        // correctly spelled catalog gets nothing. Running the collapse inside
        // norm() is what makes it symmetric, because the query and the index
        // both come through here, so the two spellings become one token on
        // both sides and neither direction can miss.
        //
        // SCOPED TO THREE WORDS, NOT TO A GENERAL "JOIN SINGLE LETTERS" RULE,
        // and that scope is measured rather than cautious. Our own checklists
        // under public/data/cards hold 62 cards named VMAX, VSTAR or V-UNION
        // and those are the only names in the catalog that fuse a letter to a
        // word this way; ex, GX and V are already separate tokens and need
        // nothing. Across all 319 records in videos.json the only V-suffix
        // token of any kind, in any field, is that one hitCard cell, so
        // nothing else in the library can collide with this today. "star" is
        // the word to watch if the rule is ever widened: "Black Star Promo" is
        // safe only because no "v" sits in front of it.
        .replace(/\bv (max|star|union)\b/g, "v$1");
    }

    // Rarity tags are codes with no searchable words of their own. Somebody
    // hunting a special illustration rare types "special illustration rare" or
    // "SIR", never "sir" as stored, and both should land.
    var PULL_WORDS = {
      sir: "sir special illustration rare",
      ir: "ir illustration rare",
      gold: "gold hyper rare secret",
      "double-rare": "double rare dual",
      charizard: "charizard zard"
    };

    // Product tags are abbreviations. "ETB" is what the data stores and what a
     // collector says out loud, but "elite trainer box" is what somebody types
     // into a search box, and it matched one single rip out of sixty because the
     // phrase appeared in one title by chance.
    var PRODUCT_WORDS = {
      etb: "etb elite trainer box",
      upc: "upc ultra premium collection",
      "booster-box": "booster box display case",
      "ex-box": "ex box premium collection",
      bundle: "bundle booster bundle six pack",
      blister: "blister three pack checklane sleeved",
      tin: "tin mini tin",
      "collection-box": "collection box premium collection",
      "single-pack": "single pack loose booster one pack"
    };

    /**
     * Everything about one rip, folded, cached on the record.
     *
     * Ids go in alongside labels so a slug pasted from a URL ("pitch-black")
     * matches as readily as the name. The spreadsheet fields are included even
     * though most are still empty: they fill in as Tim tags, and a search that
     * silently ignores the description he just wrote would be worse than one
     * that never had it.
     */
    function haystack(v) {
      if (v._hay != null) return v._hay;
      var parts = [v.title, v.siteTitle, v.blurb, v.box, v.hitCard, v.notes];
      (v.sets || []).forEach(function (x) { parts.push(x, labelOf("sets", x)); });
      (v.products || []).forEach(function (x) { parts.push(x, labelOf("products", x), PRODUCT_WORDS[x] || ""); });
      (v.pulls || []).forEach(function (x) { parts.push(PULL_WORDS[x] || x); });
      parts.push(v.short ? "short" : "long");
      v._hay = norm(parts.join(" "));
      return v._hay;
    }

    /**
     * Parse the query box.
     *
     * Bare words are ANDed, so "mega charizard" finds rips with both anywhere,
     * in any order and across different fields. The old search was one
     * indexOf of the whole string, so it only ever matched words that happened
     * to sit next to each other in that order.
     *
     * A "quoted phrase" must appear intact, and a leading - excludes.
     */
    function parseQuery(raw) {
      var terms = [], neg = [], m;
      var re = /-?"[^"]*"?|\S+/g;
      while ((m = re.exec(raw)) !== null) {
        var tok = m[0], not = tok.charAt(0) === "-";
        if (not) tok = tok.slice(1);
        var t = norm(tok.replace(/"/g, ""));
        if (t) (not ? neg : terms).push(t);
      }
      return { terms: terms, neg: neg };
    }

    /**
     * Relevance, so a title match outranks one buried in a product label.
     *
     * Without this, results came back in date order and searching "charizard"
     * put a rip merely tagged charizard above one with Charizard in its title.
     */
    function score(v, q) {
      var title = norm(v.siteTitle || v.title);
      var hay = haystack(v);
      var n = 0;
      for (var i = 0; i < q.terms.length; i++) {
        var t = q.terms[i];
        if (title === t) n += 100;
        else if (title.indexOf(t) === 0) n += 40;
        else if ((" " + title).indexOf(" " + t) > -1) n += 25;
        else if (title.indexOf(t) > -1) n += 12;
        if (hay.indexOf(t) > -1) n += 2;
      }
      return n;
    }

    var parsed = { terms: [], neg: [] };

    function matches(v) {
      if (state.sets.length && !state.sets.some(function (s) { return (v.sets || []).indexOf(s) > -1; })) return false;
      if (state.products.length && !state.products.some(function (s) { return (v.products || []).indexOf(s) > -1; })) return false;
      // THE LADDER, NOT "HAS ANY TAG", AND THE DIFFERENCE IS THREE RIPS.
      // build-proto.mjs counts the gold chip's number with bestPull(), which
      // only recognises the five tiers in its PULL_RANK, and PULL_TIERS above
      // mirrors that list the way LABELS mirrors shared/taxonomy.mjs. Written
      // as `(v.pulls || []).length` instead, this filter answered 13 to a chip
      // promising 10: three rips carry `ultra` or `super`, which the taxonomy
      // assigns and the ladder does not rank. A filter that disagrees with the
      // control that opened it is the bug this whole parameter was fixing.
      if (state.pull && !(v.pulls || []).some(function (p) { return PULL_TIERS.indexOf(p) > -1; })) return false;
      if (parsed.terms.length || parsed.neg.length) {
        var hay = haystack(v);
        for (var i = 0; i < parsed.terms.length; i++) if (hay.indexOf(parsed.terms[i]) === -1) return false;
        for (var j = 0; j < parsed.neg.length; j++) if (hay.indexOf(parsed.neg[j]) > -1) return false;
      }
      return true;
    }

    var SORTS = {
      new: function (a, b) { return a.published < b.published ? 1 : -1; },
      old: function (a, b) { return a.published > b.published ? 1 : -1; },
      views: function (a, b) { return (b.views || 0) - (a.views || 0); },
      // Newest wins ties, so an unranked list still reads chronologically.
      relevance: function (a, b) {
        return score(b, parsed) - score(a, parsed) || (a.published < b.published ? 1 : -1);
      }
    };

    // Rendering all ~260 tiles at once is a lot of DOM for no benefit, and an
    // endless scroll would put the footer out of reach. Page it.
    var PAGE = 48;
    var shown = PAGE;

    // keepDom: the grid is already showing exactly what this call would build,
    // so update the count, the Load more button and the chips but leave the
    // tiles alone. Used once, on the first load of a server-rendered grid. See
    // the note at the bottom of initLibrary.
    /**
     * The live filters that have no chip on screen to explain themselves.
     *
     * THE PRODUCT FILTER STILL WORKS ON A PHONE AND THE PHONE CANNOT SHOW IT.
     * ui.css hides the product row below 700px because Tim asked for the set
     * filter alone there, but ?product= is linked 330 times across 318 of the
     * built pages (93 of them ?product=single-pack, 57 ?product=etb) and readUrl
     * takes it off the URL rather than off a chip, so every one of those links
     * still lands on the right list. What it loses is the chip that would have lit up
     * to say WHY the list is 56 rips instead of 317, which is exactly the fault
     * `pull` had and the line below was written to fix. So the count line names
     * the product when, and only when, the chips are not on screen to do it.
     *
     * Asked of the LAYOUT, not of a matchMedia copy of the breakpoint, for the
     * same reason isSwipeRail is: ui.css owns the 700px and nothing else should
     * hold a second copy of it. Called at the top of render, before any of that
     * function's writes, so the offsetParent read lands on a clean layout.
     */
    function unlabelledProducts() {
      if (!state.products.length) return "";
      var f = document.querySelector('.facet[data-facet="products"]');
      var slot = f && f.querySelector(".facet-slot");
      // No row at all is the same case as a hidden one, and saying it twice is
      // cheaper than a silently short list.
      if (slot && slot.offsetParent !== null) return "";
      return state.products.map(function (k) { return labelOf("products", k); }).join(" or ");
    }

    /**
     * Lay the tiles out. Same construction as the hit-card reveal on a rip
     * page; rules, timings and the argument are in ui.css, above `.more`.
     * `reduced` first, for the reason written beside landMascot.
     */
    var armFail = 0;
    function armGrid() {
      if (reduced) return;
      var tiles = grid.querySelectorAll(".v");
      if (!tiles.length) return;
      grid.classList.add("is-armed");
      // Failsafe: strips the hidden state at its SOURCE. rAF does not run in a
      // background tab, which is the case this is for.
      armFail = setTimeout(function () {
        grid.classList.remove("is-armed");
        for (var i = 0; i < tiles.length; i++) tiles[i].classList.add("is-in");
      }, 2000);
      // Two frames, so the armed state is resolved before the change out of it.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          for (var i = 0; i < tiles.length; i++) tiles[i].classList.add("is-in");
          clearTimeout(armFail);
        });
      });
    }

    // `animate` IS "THE READER JUST APPLIED A FILTER" and it is the only thing
    // that lays the tiles out rather than swapping them. Passed by the chip
    // taps, the sort, Clear all and the two query-clearing controls, and by
    // NOTHING ELSE: not the first render (a page load, not an act, filtered or
    // not, which is what keeps this off FCP), not "Load 48 more", and not the
    // per-keystroke path, where a 50ms debounce would restart the cascade nine
    // times over "charizard". Argued in full in ui.css, above `.more`.
    function render(keepPage, keepDom, animate) {
      if (!keepPage) shown = PAGE;
      var prodNote = unlabelledProducts();
      var out = all.filter(matches).sort(SORTS[state.sort] || SORTS.new);
      if (!keepDom) {
      // Already on screen? A second letter that still matches nothing rebuilds
      // the same empty state, and re-landing on every keystroke is a flinch.
      var wasEmpty = !!grid.querySelector(".empty-mascot");
      // ALWAYS OFF BEFORE IT CAN GO BACK ON, and not as tidying: a leftover
      // .is-armed would hand "Load 48 more"'s 96 tiles opacity:0 with nothing
      // coming to add .is-in. An empty grid is worse than no animation. The
      // pending failsafe goes too, or it fires against the next grid.
      clearTimeout(armFail);
      grid.classList.remove("is-armed");
      grid.textContent = "";
      if (!out.length) {
        var box = emptyState("Nothing in that pile", "Try clearing a filter. Even the bulk has something in it.", true);
        grid.appendChild(box);
        if (!wasEmpty) landMascot(box);
      } else {
        var frag = document.createDocumentFragment();
        var prefer = state.sets.length === 1 ? state.sets[0] : null;
        var arm = !!animate && !reduced;
        out.slice(0, shown).forEach(function (v, i) {
          var card = makeCard(v, { preferSet: prefer });
          // CAPPED AT 14, bounding the tail at 260 + 14 x 26 = 624ms however
          // many came back. NOT the 442ms this was approved as; that figure is
          // the prototype's eight-tile grid, where the cap never bound. Working
          // in ui.css. Written only where it will be read.
          if (arm) card.style.setProperty("--i", i < 14 ? i : 14);
          frag.appendChild(card);
        });
        grid.appendChild(frag);
        if (arm) armGrid();
      }
      }
      var more = document.getElementById("libMore");
      if (more) {
        if (out.length > shown) {
          more.hidden = false;
          more.textContent = "Load 48 more (" + (out.length - shown) + " left)";
        } else {
          more.hidden = true;
        }
      }
      // When exactly one set is selected, head the results with its logo.
      var head = document.getElementById("setHeader");
      if (head) {
        if (state.sets.length === 1) {
          var sid = state.sets[0], slabel = labelOf("sets", sid);
          head.hidden = false;
          head.textContent = "";
          // ONLY ASK FOR A LOGO THAT EXISTS. Selecting a set with no artwork
          // fired a 404 and logged a console error every time. Nothing was ever
          // visible -- the onerror below strips the broken image and the header
          // keeps its name and rip count -- but a wasted request and a red line
          // in the console is the kind of noise that trains people to ignore
          // the console.
          //
          // THIS TEST USED TO BE `!/^(ja|ko|zh)-/`, AND ITS OWN COMMENT SAID
          // WHY THAT WAS SAFE: the intl sets "are the only sets without
          // artwork". That was true when it was written and stopped being true
          // the day two English sets got tagged with no logo and no guide.
          // silver-tempest and lost-origin both 404ed here on a live page,
          // and silver-tempest carries a hit card, so it was on the site in
          // three places with artwork in none. A prefix is a PROXY for the
          // fact; the fact is which files are on disk.
          //
          // SO THE PAGE CARRIES THE LIST AND THE BUILD WRITES IT.
          // build-proto.mjs already reads public/assets/logos to count them and
          // stamps the ids onto #setHeader as data-logos, so this cannot go
          // stale the way LABELS above it can: add a logo file, rebuild, and
          // the attribute grows. It is one page's worth of bytes and none on
          // the other 1,485 that ship this script.
          //
          // WHAT AN UNSUPPORTED SET TAG LOOKS LIKE, decided rather than left to
          // onerror: exactly what an intl set already looks like. No image
          // element, no request, no console line, and the header keeps the set
          // name and the rip count, which are the two true things we have. The
          // filter itself was always correct and is untouched.
          //
          // FAIL OPEN, NOT CLOSED. With no attribute at all -- an older cached
          // videos.html against a newer script -- every set is allowed to ask,
          // which is the behaviour before this change plus the onerror backstop.
          // Closing instead would silently strip 28 logos.
          var manifest = head.getAttribute("data-logos");
          var hasLogo = manifest === null
            ? true
            : (" " + manifest + " ").indexOf(" " + sid + " ") > -1;
          if (hasLogo) {
            var limg = new Image();
            limg.src = "assets/logos/" + sid + "-pokemon-tcg-set-logo.webp";
            limg.alt = slabel + " Pokemon TCG set logo";
            limg.onerror = function () { limg.remove(); };
            head.appendChild(limg);
          }
          // "N RIPS FROM THIS SET" IS A SENTENCE ABOUT THE SET, AND IT WAS
          // BEING HANDED THE RESULT COUNT. With ?set=chaos-rising alone the two
          // are the same number and it read true for months. Turn a product
          // facet on as well and the header said "Chaos Rising / 14 rips from
          // this set" while that set's own chip, in the same viewport, said 54.
          // Both numbers are right and only one of them is what the sentence
          // claims: 14 is how many results are showing, not how many rips exist
          // of that set.
          //
          // COUNTED OVER `all`, WHICH IS THE SAME PLACE THE CHIP GETS ITS
          // NUMBER (see buildChips), so the header and the chip cannot disagree
          // by construction rather than by luck. Where nothing else is
          // narrowing, the two counts are equal and the wording is unchanged --
          // the "X of Y" form only appears when there is a Y to distinguish.
          var inSet = 0;
          for (var si = 0; si < all.length; si++) {
            if ((all[si].sets || []).indexOf(sid) > -1) inSet++;
          }
          var txt = el("div", "txt");
          txt.appendChild(el("b", null, slabel));
          txt.appendChild(document.createTextNode(
            out.length === inSet
              ? out.length + (out.length === 1 ? " rip" : " rips") + " from this set"
              : out.length + " of " + inSet + (inSet === 1 ? " rip" : " rips") + " from this set"
          ));
          head.appendChild(txt);
        } else {
          head.hidden = true;
        }
      }

      var c = document.getElementById("libCount");
      if (c) {
        // NAMED, BECAUSE NOTHING ELSE ON THE PAGE SAYS IT. A set or a product
        // filter lights its own chip in the rail above the grid, so the reader
        // can see why they are looking at 22 rips instead of 316. `pull` has no
        // chip here: it is only ever arrived at from the home page's gold "Hits
        // only" link, and without this line the grid is a silently short list.
        // On a phone the PRODUCT has no chip either; see unlabelledProducts.
        //
        // BUILT AS NODES RATHER THAN AS innerHTML, and that is not tidying: a
        // set label can carry an ampersand ("Scarlet & Violet") and a product
        // label comes through labelOf's title-case fallback for anything the
        // map misses, so the one string on this line that is not a literal is
        // the one string that should never be parsed as markup.
        c.textContent = "";
        c.appendChild(el("b", null, String(out.length)));
        c.appendChild(document.createTextNode(
          " of " + all.length + " rips" +
          (state.pull ? " with a graded pull" : "") +
          (prodNote ? " • " + prodNote : "") +
          (out.length > shown ? " • showing " + shown : "")
        ));
      }
      syncChips();
      writeUrl();
    }

    function syncChips() {
      document.querySelectorAll(".chip[data-group]").forEach(function (b) {
        var g = b.dataset.group, v = b.dataset.value;
        var on = state[g].indexOf(v) > -1;
        b.setAttribute("aria-pressed", String(on));
        // ORDER, NOT SORT, AND IT IS IN ui.css NOW rather than here. The
        // collapsed facet row is one chip tall and shows the first two to nine
        // of them depending on width, so a filter chosen from the panel would
        // vanish the moment the panel closed and the page would carry a live
        // filter with nothing on screen saying so. Flex order pulls the pressed
        // ones to the front without touching the DOM, so nothing loses focus
        // mid-click and the panel's by-count order is intact underneath.
        //
        // It moved because the phone rail must NOT do this: it is a real
        // scroller that hides nothing, so reordering under the finger would
        // leave the rail parked on a different part of the list than the one
        // you were just looking at. `.facet-box .chip[aria-pressed=true]` says
        // the same thing off the attribute set on the line above, and a media
        // query can take it back. An inline style is the one thing it cannot.
      });
      var n = state.sets.length + state.products.length + (state.pull ? 1 : 0);
      var clear = document.getElementById("libClear");
      if (clear) clear.hidden = !n && !state.q;
    }

    function buildChips(group, containerId) {
      var box = document.getElementById(containerId);
      if (!box) return;
      var counts = {};
      all.forEach(function (v) {
        (v[group] || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
      });
      var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      keys.forEach(function (k) {
        var b = el("button", "chip" + (group === "products" ? " prod" : ""));
        b.type = "button";
        b.dataset.group = group;
        b.dataset.value = k;
        b.setAttribute("aria-pressed", "false");
        b.appendChild(document.createTextNode(labelOf(group, k)));
        b.appendChild(el("span", "n", counts[k]));
        b.addEventListener("click", function () {
          var i = state[group].indexOf(k);
          if (i > -1) state[group].splice(i, 1); else state[group].push(k);
          // The tap this whole animation exists for.
          render(false, false, true);
        });
        box.appendChild(b);
      });
      // The count in the toggle is the real one. The HTML ships 35 and 13 so
      // the button has its final width before videos.json lands and so the
      // page says something true with JS off, but the taxonomy grows every
      // time Tim rips a new set and a hand-typed number goes stale silently.
      var more = document.querySelector('.facet[data-facet="' + group + '"] .facet-more .n');
      if (more) more.textContent = keys.length;
    }

    /* ---------------------------------------------------------- facets ---- */

    /**
     * Is this facet the phone's SWIPE RAIL rather than the desktop's collapsed
     * row plus panel?
     *
     * ONE SOURCE OF TRUTH, AND IT IS THE STYLESHEET. ui.css hides .facet-more
     * below 700px, so an absent toggle IS the swipe rail: there is no panel to
     * open and every chip is reachable by dragging. Asking the layout means the
     * breakpoint is written once, in the file that owns it. A second copy here
     * as matchMedia("(max-width:700px)") is the kind of duplicate that survives
     * the next time somebody moves the breakpoint and then disagrees with it.
     *
     * offsetParent is null for a display:none element and for nothing else that
     * can happen to this button (it is not fixed, and its ancestors are not
     * display:contents). Read before any write in the callers, so it never
     * forces a layout that was not going to happen anyway.
     */
    function isSwipeRail(f) {
      var btn = f && f.querySelector(".facet-more");
      return !!btn && btn.offsetParent === null;
    }

    // THE PANEL IS THE SAME CHIPS, MOVED, NOT A SECOND COPY OF THEM. Opening
    // adds .open to the .facet, which is the whole of the state: ui.css takes
    // the one-line .facet-box out of flow, wraps it and gives it a card. So
    // there is one <button> per filter, one aria-pressed per filter, and no
    // syncing problem between a rail copy and a panel copy.
    function initFacets() {
      var facets = [].slice.call(document.querySelectorAll(".facet[data-facet]"));
      if (!facets.length) return;

      function close(f) {
        f.classList.remove("open");
        var btn = f.querySelector(".facet-more");
        if (btn) btn.setAttribute("aria-expanded", "false");
        f.dataset.byFocus = "";
      }
      function open(f, byFocus) {
        // A SWIPE RAIL HAS NO PANEL, and this is the guard that stops one
        // appearing anyway. The toggle is display:none on a phone so it cannot
        // be clicked, but the focusin handler below opens on a focus-visible
        // chip, and a keyboard tabbing into the rail would otherwise rip the
        // scroller out of flow and drop it over the grid as a card.
        if (isSwipeRail(f)) return;
        facets.forEach(function (o) { if (o !== f) close(o); });
        f.classList.add("open");
        var btn = f.querySelector(".facet-more");
        if (btn) btn.setAttribute("aria-expanded", "true");
        f.dataset.byFocus = byFocus ? "1" : "";
      }

      facets.forEach(function (f) {
        var btn = f.querySelector(".facet-more");
        if (btn) {
          btn.addEventListener("click", function () {
            if (f.classList.contains("open")) close(f); else open(f, false);
          });
        }
        // A CLIPPED CHIP IS STILL TABBABLE, and that is the trap in every
        // collapse-by-overflow. Tab into the row and focus lands on a chip
        // outside the 44px box: the browser scrolls the hidden overflow to it,
        // so the focus ring is genuinely invisible and the row silently sits at
        // a scroll offset. Opening on focusin means focus is always somewhere
        // the eye can follow, and it is also how a keyboard reaches the panel
        // without knowing the toggle exists.
        f.addEventListener("focusin", function (e) {
          if (f.classList.contains("open")) return;
          if (e.target.closest(".facet-more")) return;
          if (!e.target.closest(".facet-box")) return;
          // :focus-visible IS THE WHOLE FILTER HERE. A mouse click on a chip
          // that is already visible also fires focusin, and opening the panel
          // under the pointer every time somebody picks a set would be its own
          // bug. focus-visible is precisely "focus the browser thinks should
          // be drawn", which is the keyboard case and not the click case.
          try { if (!e.target.matches(":focus-visible")) return; } catch (err) { /* older engine: open either way */ }
          open(f, true);
        });
        // Only a panel opened BY focus closes on the way out. One opened by
        // click is a deliberate choice and tabbing past it should not undo it.
        f.addEventListener("focusout", function (e) {
          if (!f.dataset.byFocus) return;
          if (e.relatedTarget && f.contains(e.relatedTarget)) return;
          close(f);
        });
      });

      // Escape closes and hands focus back to the toggle, which is where the
      // reader was before the panel took over.
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        facets.forEach(function (f) {
          if (!f.classList.contains("open")) return;
          var btn = f.querySelector(".facet-more");
          close(f);
          if (btn && f.contains(document.activeElement)) btn.focus();
        });
      });
      document.addEventListener("pointerdown", function (e) {
        facets.forEach(function (f) { if (!f.contains(e.target)) close(f); });
      });
    }

    /* ------------------------------------------------------ swipe rails ---- */

    // Re-run the edge fades. Held in a list rather than called through the DOM
    // so render() never has to touch geometry: the chips are built once and
    // never change width after that, so the only things that can move a fade
    // are a scroll and a resize, and both have their own listener below.
    var railSyncs = [];

    /**
     * Scroll a rail the smallest distance that puts one chip fully inside it.
     *
     * THE BROWSER DOES NOT DO THIS AND THAT IS THE WHOLE REASON IT EXISTS.
     * Focusing an element scrolls it into view with "nearest" semantics, and
     * nearest treats a PARTIALLY visible element as near enough. Measured at
     * 390 by tabbing the rail: 16 of the 35 chips took focus while hanging off
     * the right edge of the port, in a strict alternation, because every second
     * chip happened to straddle it. A focus ring you cannot see is worse than a
     * chip you cannot reach, so the rail moves itself.
     *
     * IT MUST LAND ON A SNAP POSITION AND THE FIRST VERSION DID NOT, which is
     * the second bug and the more interesting one. The obvious implementation
     * moves by exactly the overhang, which is the smallest move that works and
     * is what "nearest" would have done properly. The rail is
     * `scroll-snap-type:x proximity`, so the snap engine re-runs after any
     * programmatic scroll, finds the position it was just moved off, and puts
     * it back: the chip flicks into view and out again in the same frame. Same
     * measurement as above, run again after the fix: 16 chips became 7, in a
     * pattern that looked like a different bug and was the same one half
     * solved. Every position this function can produce is now a snap position
     * (a chip start-aligned to the scroll-padding line), so the engine agrees
     * with it and nothing is undone.
     *
     * The cost is that tabbing rightwards pages rather than nudges: a chip
     * hanging off the right edge comes all the way to the left. That is the
     * price of the snap, it is what a snapping carousel does everywhere else,
     * and it is only paid when the chip was not already fully visible.
     *
     * The port is the padding box, not the border box, so a chip comes to rest
     * one gutter in from the bezel — the same line scroll-padding puts a
     * snapped chip on, and the same line the h1 below starts at.
     */
    function bringIntoRail(box, chip) {
      var cs = getComputedStyle(box);
      var br = box.getBoundingClientRect(), r = chip.getBoundingClientRect();
      var lo = br.left + box.clientLeft + (parseFloat(cs.paddingLeft) || 0);
      var hi = br.left + box.clientLeft + box.clientWidth - (parseFloat(cs.paddingRight) || 0);
      if (r.left >= lo - 0.5 && r.right <= hi + 0.5) return;
      box.scrollLeft += r.left - lo;
    }

    /**
     * The phone's filter row, as a scroller you actually swipe.
     *
     * ui.css does the scrolling. This does the three things CSS cannot:
     *
     * 1. THE FADES TELL THE TRUTH AT BOTH ENDS. A permanent right-hand fade on
     *    a scroller that has reached its end promises more chips and there are
     *    none, which is the same lie as the row that looked finished when it
     *    was not. at-start / at-end turn the near fade off, so the picture and
     *    the scroll position always agree.
     *
     * 2. ARROW KEYS WALK THE ROW. Tab already reaches every chip and the
     *    browser scrolls the focused one into the port for free, so this is not
     *    the only way in; it is the way somebody who has landed on a chip
     *    expects to reach the next one without tabbing through 35 of them.
     *    Left and right only, never up and down: those still scroll the page,
     *    which is what a reader half way down the grid wants.
     *
     * 3. THE CHOSEN CHIP IS SHOWN ON ARRIVAL. /videos.html?set=chaos-rising is
     *    linked from 283 places and its chip is 12th in the row, ~1,500px off
     *    the right edge of a 390px screen. Without this the page reads as
     *    "53 of 317" over a rail where nothing is lit, and the reader has no
     *    way to know which filter to tap to undo. The desktop row solves the
     *    same problem with order:-1; this row must not reorder (see ui.css), so
     *    it scrolls instead.
     */
    function initSwipeRails() {
      [].slice.call(document.querySelectorAll(".facet[data-facet]")).forEach(function (f) {
        var box = f.querySelector(".facet-box");
        if (!box) return;

        var frame = 0;
        function sync() {
          frame = 0;
          var max = box.scrollWidth - box.clientWidth;
          // A row that does not scroll is at both ends at once, which switches
          // both fades off. That is right: the desktop row is not this rail and
          // keeps its own single-sided mask from the rule ui.css declares
          // outside the media query.
          var atStart = box.scrollLeft <= 1, atEnd = box.scrollLeft >= max - 1;
          box.classList.toggle("at-start", atStart);
          box.classList.toggle("at-end", atEnd);
        }
        // rAF-coalesced: a momentum flick fires scroll every frame and there is
        // no point reading the same geometry twice inside one.
        box.addEventListener("scroll", function () {
          if (!frame) frame = requestAnimationFrame(sync);
        }, { passive: true });
        window.addEventListener("resize", function () {
          if (!frame) frame = requestAnimationFrame(sync);
        });
        railSyncs.push(sync);

        // ONE PLACE FOR "the focused chip must be on screen", because there are
        // four ways to focus one: Tab, shift-Tab, the arrow keys below, and the
        // browser restoring focus after a back button. Hanging it off focusin
        // covers all four with one rule instead of four call sites, three of
        // which would be remembered and one of which would not.
        box.addEventListener("focusin", function (e) {
          if (!isSwipeRail(f)) return;
          var chip = e.target.closest && e.target.closest(".chip");
          if (chip) bringIntoRail(box, chip);
        });

        box.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
          // Desktop is a collapsed row plus a panel and its arrow keys are the
          // browser's. Nothing here changes above 700px.
          if (!isSwipeRail(f)) return;
          var chips = [].slice.call(box.querySelectorAll(".chip"));
          var i = chips.indexOf(document.activeElement);
          if (i < 0) return;
          var j = i + (e.key === "ArrowRight" ? 1 : -1);
          if (j < 0 || j >= chips.length) return;
          // preventDefault only once there is somewhere to go, so the arrow at
          // either end of the row still does whatever the browser would do.
          e.preventDefault();
          // The focusin handler above is what brings it on screen.
          chips[j].focus();
        });
      });
    }

    /**
     * Scroll a rail to the filter that is already on. See point 3 above.
     *
     * NOT scrollIntoView. This rail is position:sticky under a sticky bar, so
     * scrollIntoView would decide the chip needs the PAGE moved to reach it and
     * scroll the reader past the h1 to a chip that was on screen the whole
     * time. Setting scrollLeft on the box moves the box and nothing else.
     */
    function revealChosenChips() {
      [].slice.call(document.querySelectorAll(".facet[data-facet]")).forEach(function (f) {
        if (!isSwipeRail(f)) return;
        var box = f.querySelector(".facet-box");
        if (!box || box.scrollWidth <= box.clientWidth + 1) return;
        var on = box.querySelector('.chip[aria-pressed="true"]');
        if (!on) return;
        // Land it where the SNAP would, which is one gutter in from the box's
        // border edge, not on it: the rail is full bleed and that gutter is its
        // own padding-left. Read off the computed style rather than written
        // here, so the number cannot drift from the one ui.css is using.
        var pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
        box.scrollLeft += on.getBoundingClientRect().left
          - box.getBoundingClientRect().left - box.clientLeft - pad;
      });
    }

    readUrl();
    parsed = parseQuery(state.q);
    initFacets();
    initSwipeRails();

    var search = document.getElementById("libSearch");
    var sortSel = document.getElementById("libSort");
    var clearQ = document.getElementById("libClearQ");

    // Whether the visitor has chosen a sort themselves. Until they do, typing a
    // query switches to relevance and clearing it switches back, because a
    // search that answers in date order buries the thing you searched for.
    // Once they pick one, it is theirs and nothing changes it underneath them.
    var sortIsMine = state.sort !== "new" && state.sort !== "relevance";

    // `animate` is a separate question from `immediate` and the two do not
    // line up: `immediate` writes the value back into the box, `animate` means
    // the reader acted rather than typed. Clear all has one and not the other.
    function applyQuery(raw, immediate, animate) {
      state.q = String(raw).trim();
      parsed = parseQuery(state.q);
      if (!sortIsMine) state.sort = state.q ? "relevance" : "new";
      if (sortSel) sortSel.value = state.sort;
      if (clearQ) clearQ.hidden = !state.q;
      render(false, false, animate);
      if (immediate && search) search.value = state.q;
    }

    if (search) {
      search.value = state.q;
      var t;
      // 50ms, DOWN FROM 160, AND THE NUMBER WAS THE LATENCY. Filtering 312
      // videos and rebuilding 48 tiles costs 8-17ms, so almost all of the
      // 154ms input-to-paint measured at 390x844 under 4x CPU throttling was
      // this timer. At 50 it is 41ms. The cost falls on fast typists only, a
      // gap wider than the debounce renders per keystroke either way: typing
      // "charizard" at 70ms went 0 -> 1% dropped frames, worst frame 33ms.
      // Re-measure both halves before raising it.
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { applyQuery(search.value); }, 50);
      });
      // Escape clears the field, which is what a type=search input does
      // natively in some browsers and in none of the others.
      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && search.value) {
          e.preventDefault();
          clearTimeout(t);
          applyQuery("", true, true);
        }
      });
    }
    if (clearQ) {
      clearQ.hidden = !state.q;
      clearQ.addEventListener("click", function () {
        applyQuery("", true, true);
        if (search) search.focus();
      });
    }
    // "/" jumps to the search box, the convention on every site with a lot of
    // things to look through. Ignored while typing so it can still be typed.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      var a = document.activeElement, tag = a && a.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (a && a.isContentEditable)) return;
      if (!search) return;
      e.preventDefault();
      search.focus();
      search.select();
    });

    if (sortSel) {
      // Only offered while searching: "Best match" against no query is
      // meaningless and would sort every rip identically.
      var relOpt = document.createElement("option");
      relOpt.value = "relevance";
      relOpt.textContent = "Best match";
      sortSel.insertBefore(relOpt, sortSel.firstChild);
      sortSel.value = state.sort;
      sortSel.addEventListener("change", function () {
        state.sort = sortSel.value;
        sortIsMine = true;
        render(false, false, true);
      });
    }
    var moreBtn = document.getElementById("libMore");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        shown += PAGE;
        render(true);
      });
    }
    var clear = document.getElementById("libClear");
    if (clear) {
      clear.addEventListener("click", function () {
        state.sets = []; state.products = []; state.pull = false;
        if (search) search.value = "";
        // Through applyQuery, so the parsed terms, the sort and the little
        // clear button all reset with it. Setting state.q directly left the
        // parsed query behind and the grid stayed filtered by a search the
        // box no longer showed.
        applyQuery("", false, true);
      });
    }

    // THE GRID NOW SHIPS FILLED, and this is the code that must not undo it.
    //
    // build-proto.mjs writes all 312 tiles into the HTML between the LIBGRID
    // markers, in this function's own markup and this function's own order, so
    // the footer starts where it ends up instead of being shoved out of the
    // viewport when videos.json lands. Measured CLS at 1440x900 was 0.2600.
    //
    // Appending "Loading the bulk..." unconditionally would have wiped that
    // render on every load and traded one flash for another, and calling
    // render() would have rebuilt 312 identical tiles for nothing. So on a
    // first load with no filters in the URL the tiles are simply left alone and
    // only the count, the Load more button and the chips are filled in.
    //
    // A URL that DOES carry a filter is a different list from the one the
    // server rendered, so that case renders normally.
    var prerendered = grid.children.length;
    // `state.pull` BELONGS IN THIS TEST AND WAS MISSING FROM IT. A url carrying
    // ?pull=1 IS a different list from the one the server rendered, so leaving
    // it out kept all 48 server tiles on screen under a count line that had
    // already been recomputed: the page read "13 of 316 rips with a graded
    // pull" over a grid showing everything. Every filter that can narrow the
    // list has to be named here.
    var filtered = !!(state.q || state.sets.length || state.products.length || state.pull || state.sort !== "new");
    var keepDom = prerendered > 0 && !filtered;
    if (keepDom) shown = prerendered;
    if (!prerendered) grid.appendChild(emptyState("Loading the bulk...", ""));
    loadVideos().then(function (videos) {
      all = videos;
      buildChips("sets", "setChips");
      buildChips("products", "productChips");
      render(keepDom, keepDom);
      // AFTER the chips exist and after render has pressed the ones the URL
      // asked for, because both of these read where a chip is and there were no
      // chips until three lines ago.
      revealChosenChips();
      railSyncs.forEach(function (fn) { fn(); });
    }).catch(function () {
      grid.textContent = "";
      grid.appendChild(emptyState("Could not load the library", "The channel still works: youtube.com/@GarbageRips585"));
    });
  }

  /* ------------------------------------------------------- playlists page */

  function initPlaylists() {
    var box = document.getElementById("plGrid");
    if (!box) return;
    // SERVER-RENDERED, so there is nothing to do and nothing to fetch.
    //
    // build-proto.mjs writes the same tiles this function builds into the HTML
    // between the PLGRID markers. Unlike the library there is no filtering here,
    // so this is not "take over later", it is "already done": returning skips
    // playlists.json AND videos.json, which is 170KB this page no longer needs.
    //
    // The reason it had to be a render rather than a reserved height: the FILLED
    // grid is only 526px tall at 1440x900, which leaves the footer at 807px,
    // inside a 900px viewport. Every reserve big enough to push the footer out
    // is taller than the grid ever gets, so the footer would have come back up
    // when the tiles landed and the shift would have counted just the same.
    // Measured CLS before: 0.1989 at 1440x900.
    if (box.children.length) return;
    box.appendChild(emptyState("Loading playlists...", ""));
    Promise.all([loadPlaylists(), loadVideos()])
      .catch(function () { return null; })
      .then(function (res) {
        if (!res) { box.textContent = ""; box.appendChild(emptyState("Could not load the playlists.", "Reload the page and try again.")); return; }
      var pls = res[0].playlists || [], videos = res[1];
      var byId = {};
      videos.forEach(function (v) { byId[v.id] = v; });
      box.textContent = "";
      if (!pls.length) {
        box.appendChild(emptyState(
          "Playlists are not synced yet",
          "Run the sync script and every playlist shows up here automatically."
        ));
        return;
      }
      // A playlist with nothing in it is not content. Two exist on the channel
      // (Pitch Black Booster Bundle Series, Pitch Black Single Pack Hunt): they
      // were created and never filled, and the page was rendering both as cards
      // reading "0 videos" whose only action was a link to an empty YouTube
      // playlist. They come back on their own the moment a video goes in.
      pls = pls.filter(function (p) { return (p.count || 0) > 0; });
      if (!pls.length) {
        box.appendChild(emptyState(
          "No playlists with anything in them yet",
          "They appear here as soon as a playlist has a video."
        ));
        return;
      }
      pls.forEach(function (p, i) {
        // ON THIS SITE, NOT ON YOUTUBE. These cards used to link to
        // youtube.com/playlist, which was the last set of outbound links left
        // outside Subscribe and the social icons. Every playlist now has a page
        // under /playlists/ showing the same run in the same order, where the
        // packs open and play in place. The slug has to match slugFor() in
        // scripts/build-playlists.mjs or the card points at a 404, which is why
        // slugify is shared rather than reimplemented here.
        // `path` is stamped onto the data by scripts/build-playlists.mjs, for
        // the same reason a video's path is stamped by the sync: one owner of
        // the url shape, so the browser and the generator cannot disagree about
        // where a page lives. A playlist with no path has no page, so the card
        // renders as a card rather than as a link to nowhere.
        var a = el(p.path ? "a" : "span", "pl");
        if (p.path) {
          a.href = "/" + p.path;
          // Pluralised, like the .pl-count below. A one-video playlist read
          // "1 videos" to a screen reader while the visible count beside it
          // read "1 video". build-proto.mjs's plTile had the same split.
          a.setAttribute("aria-label", p.title + ", " + p.count + (p.count === 1 ? " video" : " videos"));
        }

        // OUR OWN COVER, NOT YOUTUBE'S, AND THE COMMENT HERE WAS WRONG ABOUT
        // YOUTUBE'S FOR MONTHS. It said the playlist cover "shows the sealed
        // packaging rather than a pulled card" and was an argued exception to
        // this site's rule about YouTube imagery. It was neither: YouTube had
        // simply grabbed a frame from the first video in each run, so all
        // twenty-one covers were the same dark shot of a hand holding a card,
        // and the grid said nothing about which product each playlist opens.
        //
        // `cover` is a drawn panel showing the actual sealed product with the
        // set logo on a black band. It is STAMPED onto playlists.json by
        // scripts/sync-playlist-covers.mjs, urls, size and alt text together,
        // for the same reason `path` is stamped: this markup exists twice, here
        // and in plTile in scripts/build-proto.mjs, and the two have to emit the
        // same bytes. Neither side derives a filename. See the region comment in
        // build-proto.mjs for how that identity is checked.
        //
        // 118 CSS px IS STILL THE BOX. .pl-grid is auto-fill minmax(240px,1fr)
        // and the thumb measures 118px at 360, 390, 560, 768, 900, 1100, 1440
        // and 1920, so the cover is drawn once at 360x270, just over 3x, and
        // there is no srcset to keep in step across two renderers.
        var th = el("span", "pl-thumb");
        if (p.cover) {
          var pic = document.createElement("picture");
          var src = document.createElement("source");
          src.setAttribute("type", "image/webp");
          src.setAttribute("srcset", p.cover.webp);
          pic.appendChild(src);
          var img = document.createElement("img");
          // SET IN THIS ORDER ON PURPOSE. outerHTML serialises attributes in the
          // order they were set, and the server copy of this card is diffed
          // against what this builds, so a different order is a false difference
          // that costs somebody an afternoon.
          img.setAttribute("src", p.cover.jpg);
          img.setAttribute("alt", p.cover.alt);
          img.setAttribute("width", p.cover.w);
          img.setAttribute("height", p.cover.h);
          img.setAttribute("decoding", "async");
          // The first row is above the fold at every width and the grid is at
          // most 5 columns wide, so the first 5 are eager. Same number and same
          // argument as PL_EAGER in build-proto.mjs.
          if (i >= 5) img.setAttribute("loading", "lazy");
          pic.appendChild(img);
          th.appendChild(pic);
        } else {
          // No cover stamped for this playlist: fall back to the wrapper of the
          // first tagged set in it, which is drawn art of ours. It does NOT fall
          // back to YouTube's cover, which is the thing this change removed.
          var setId = null;
          (p.videoIds || []).some(function (id) {
            var v = byId[id];
            var sid = v && (v.sets || [])[0];
            if (sid) { setId = sid; return true; }
            return false;
          });
          th.classList.add("pl-thumb--pack");
          th.appendChild(makePack(setId || "default", "tile"));
        }
        a.appendChild(th);

        var body = el("span", "pl-body");
        body.appendChild(el("b", "pl-title", p.title));
        body.appendChild(el("span", "pl-count", p.count + (p.count === 1 ? " video" : " videos")));
        if (p.path) body.appendChild(el("span", "pl-out", "Open the playlist"));
        a.appendChild(body);
        box.appendChild(a);
      });
    });
  }

  /* ------------------------------------------------------------ chrome */

  function initNav() {
    // A branch here queried "nav.site" and ".nav-toggle", neither of which
    // exists on any of the 342 pages. The live header is menuBtn/menu, handled
    // below. This function had already had one dead selector removed once.
    // The header search box. It is a real <form action="/videos.html" method="get">
    // with a name="q" field, so it already works with no JavaScript at all and
    // needs no submit handler. There used to be one here bound to
    // form.search[data-route], a selector no page has ever carried: it matched
    // nothing on all 342 pages and the native submit was doing the work.
    //
    // THE BAR HAS NO FIELD ANY MORE, so the block that used to sit here is
    // gone with it. It read #navSearch and echoed ?q= back into it, so that
    // arriving at /videos.html?q=charizard did not show an empty box. There is
    // no #navSearch on any page now: the bar carries a 44px magnifier linking
    // to /search.html, which has its own field and fills it itself. Removed
    // rather than left guarded by `if (navQ)`, which is how this function came
    // to hold two dead selectors ("nav.site", ".nav-toggle") that matched
    // nothing on 342 pages and had to be proved dead before anything nearby
    // could be touched.
    // Mobile menu. The bar has room for a brand, a search affordance and
    // Subscribe, and nothing else, so on a phone every other page used to be a
    // 7,000px scroll away in the footer.
    // Mark where we are, in both the bar links and the panel. Done here rather
    // than at build time because the same chrome is emitted into 346 pages and
    // one of them is always the current one.
    var here = location.pathname.replace(/index\.html$/, "") || "/";

    // MATCHING IS BY PREFIX AND 334 PAGES HAD NO PREFIX TO MATCH, measured on
    // 16 August 2026. It works for the sections whose NAV href IS the
    // directory (/sets/, /pokemon/, /openings/, /games/), and fails completely
    // for the two whose landing page is a FILE while their contents live in a
    // directory: no NAV href is a prefix of /rip/<id>.html or of
    // /playlists/<slug>.html, so 313 rip pages and 21 playlist pages lit
    // nothing at all, in the bar and in the menu alike.
    //
    // Those are not obscure pages. They are the deepest pages on the site, the
    // ones a search engine sends people to first, and therefore exactly where
    // a reader is least likely to know where they have landed. WCAG 2.4.8.
    //
    // /search.html USED TO BE THE EXCEPTION HERE, on the grounds that it was
    // the bar form's action rather than a NAV destination, so there was no nav
    // item it belonged under and marking one would have been inventing an
    // answer. It is a NAV href now, under Cards, so it needs no entry in this
    // table at all: the exact match below resolves it like any other page.
    // Left as a note because the reasoning is still right for anything else
    // that is only a form target.
    var SECTIONS = [
      [/^\/rip\//, "/videos.html"],
      [/^\/playlists\//, "/playlists.html"],
      // The third family with the same shape, found by driving one page from
      // every directory on the site and asking which lit nothing: the nine
      // per-retailer pages under /retailers/ hang off /retailers.html, a FILE,
      // so no NAV href is a prefix of them either. Same bug as /rip/, same fix.
      // Everything else that looked at risk turned out fine, because its NAV
      // href IS the directory: /sets/, /pokemon/, /openings/, /games/.
      [/^\/retailers\//, "/retailers.html"],
      // THE FOURTH FAMILY, AND THE FIRST THAT IS NOT A DIRECTORY. The three
      // above are all "/thing/x.html hangs off /thing.html", so no NAV href is a
      // prefix of them. This one is a SIBLING FILE: /topps-card-values.html is
      // the price half of /topps.html, which is the nav entry, and nothing else
      // on the site is called topps. The prefix test cannot help either, because
      // "/topps-card-values.html".indexOf("/topps.html") is -1.
      //
      // WHY IT IS WORTH A LINE. Both Topps pages link to each other in the body,
      // so a reader is not lost, but the values page is the one somebody lands on
      // from a search for "topps pokemon card values" and it is where they most
      // need the nav to say which part of the site they are standing in. Without
      // this the menu lights nothing at all on a 200 row page.
      [/^\/topps-card-values\.html$/, "/topps.html"],
    ];
    var owner = here;
    for (var s = 0; s < SECTIONS.length; s++) {
      if (SECTIONS[s][0].test(here)) { owner = SECTIONS[s][1]; break; }
    }

    document.querySelectorAll(".menu a, .nav-links a").forEach(function (a) {
      var to = a.getAttribute("href");
      if (!to) return;
      var norm = to.replace(/index\.html$/, "");
      // `owner` is compared with === only. A section landing page is an exact
      // answer, and running it through the prefix test as well would let
      // "/videos.html".indexOf() surprises back in.
      if (norm === here || norm === owner || (norm !== "/" && here.indexOf(norm) === 0)) {
        a.setAttribute("aria-current", "page");
      }
    });

    var mb = document.getElementById("menuBtn");
    var panel = document.getElementById("menu");

    if (mb && panel) {
      var setOpen = function (open) {
        mb.setAttribute("aria-expanded", String(open));
        panel.classList.toggle("on", open);
      };
      mb.addEventListener("click", function () {
        setOpen(mb.getAttribute("aria-expanded") !== "true");
      });
      // Escape closes it and returns focus, which is what a keyboard user
      // expects and what makes the button a real toggle rather than a link.
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && mb.getAttribute("aria-expanded") === "true") {
          setOpen(false);
          mb.focus();
        }
      });
      // Following a link inside it should not leave the panel open behind the
      // next page in browsers that restore scroll position.
      panel.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false);
      });
      // Tapping anywhere else closes it. Now that the panel is fixed to the
      // viewport it covers content wherever you are on the page, so without
      // this the only way out is to find the button again.
      document.addEventListener("click", function (e) {
        if (mb.getAttribute("aria-expanded") !== "true") return;
        if (panel.contains(e.target) || mb.contains(e.target)) return;
        setOpen(false);
      });
    }

    /* COLLAPSE THE MENU SECTIONS ON A PHONE, and this is the only place it can
     * be done.
     *
     * Each group in the panel is a native <details> that ships `open` (see
     * shared/chrome.mjs). A closed <details> cannot be forced open from CSS in
     * every browser, so the media query has to run the other way: the markup is
     * expanded, which is the state that is correct with no script and correct
     * on a desktop, and this closes it where the screen is small.
     *
     * WHAT IT BUYS, measured into the real panel on /start.html at 390x844:
     * 1,449px of content in an 812px window with 16 of 46 links unreachable,
     * against 544px with every one of the eight headings on screen and nothing
     * scrolling. The eighteen-link "Guides" group alone was an 827px block that
     * break-inside: avoid could not split.
     *
     * ONCE, ON LOAD, AND NOT ON RESIZE. Re-running this when the window changes
     * would shut a section the reader had just opened, which is worse than a
     * stale layout after a rotation that almost nobody performs with the menu
     * held open. matchMedia is read rather than an innerWidth compare so the
     * breakpoint is the same string the stylesheet uses.
     *
     * `menu-acc` is what switches ui.css to one column. It goes on in the same
     * breath as the collapse so the two can never disagree.
     *
     * IT RUNS LAST, AFTER THE BUTTON IS WIRED, AND THE ORDER IS THE POINT. If
     * this ever throws, the toggle above it is already listening and the reader
     * gets an expanded panel, which is a worse layout and a working menu. The
     * other way round is a menu that is shut and cannot be opened.
     *
     * WHAT "NO SCRIPT" ACTUALLY MEANS HERE, checked with script execution
     * disabled rather than assumed: `.menu` is display:none until app.js adds
     * `.on`, so with JavaScript off the panel does not open AT ALL, and that was
     * as true before this change as after it. The degradation this default
     * protects is the partial one, and a crawler's: the markup ships with all
     * eight sections open and two columns, so a page fetched without running
     * this file contains every nav link in its expanded state. The reader's
     * fallback is and always was the footer, which carries the same 47 links
     * with no script at all.
     */
    if (panel && window.matchMedia && window.matchMedia("(max-width:820px)").matches) {
      var groups = panel.querySelectorAll("details.menu-g");
      if (groups.length) {
        panel.classList.add("menu-acc");
        for (var g = 0; g < groups.length; g++) groups[g].removeAttribute("open");
      }
    }

    var yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();
  }


  function boot() {
    initNav();
    initLibrary();
    initPlaylists();
    initSearchMascot();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /**
   * Keep Tab inside whatever modal surface is open.
   *
   * Three of them exist: the card lightbox (.lb.on, on 10 set and Pokemon
   * pages), the rip pages' hit lightbox (.hitlb) and the mobile menu
   * (.menu.on, everywhere). All three cover the screen and all three left every
   * background control tabbable, so Tab walked focus behind an opaque overlay
   * where the focus ring is invisible: 50 reachable controls behind the
   * lightbox, 87 behind the menu at 375px.
   *
   * Handled once here rather than in the four generators that each emit their
   * own copy of the lightbox script. app.js is already on every page, and a
   * fifth copy of a focus trap is how they drift.
   */
  function openSurface() {
    var lb = document.querySelector(".lb.on");
    if (lb) return lb;
    /* MATCHED ON `hidden`, NOT ON A CLASS, and that is the whole bug. The hit
       lightbox is the same dialog as .lb -- moves focus to Close, Escape
       closes, focus returns to the .hitcard-open it came from -- but it opens
       by dropping the `hidden` attribute instead of adding .on, so `.lb.on`
       above never saw it. One Tab off Close landed on a.skip BEHIND the
       backdrop, then the brand, then the nav: six invisible stops with the
       modal still on screen.
       COUNT IT ON THE OPENERS, NOT ON THE DIALOG. The dialog markup ships on
       all 319 rip pages, but the script bails when there is no #hitcards, so it
       can only be opened on the 129 pages that carry real hit cards -- 171
       <button class="hitcard-open"> in the built tree. 319 is the markup count
       and overstates who was reachable. */
    var hl = document.querySelector(".hitlb:not([hidden])");
    if (hl) return hl;
    var mb = document.getElementById("menuBtn");
    if (mb && mb.getAttribute("aria-expanded") === "true") {
      var panel = document.getElementById("menu");
      // The button lives outside the panel but belongs to the same loop, or
      // Shift+Tab off the first link escapes to the page behind.
      if (panel) return { first: mb, panel: panel };
    }
    return null;
  }

  /* `summary` IS IN HERE AND IT HAS TO BE. A <summary> is focusable by default
     with no tabindex attribute, so none of the other clauses match it. The menu
     panel's eight section headings are summaries, and leaving them out of this
     list means the trap steps straight past every one of them: on a phone,
     where the sections ship collapsed, that is a keyboard user reaching the
     Subscribe pill and nothing else in the entire navigation. */
  var FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
    'textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

  /* IS THIS THING ACTUALLY ON SCREEN, and `offsetParent !== null` no longer
     answers it. Chrome renders a closed <details> by skipping its contents with
     content-visibility rather than display:none, and a skipped subtree still
     reports a non-null offsetParent AND a stale non-zero getBoundingClientRect.
     Measured: a link inside a shut section reported {y:108, width:147} and
     offsetParent "yes" while the panel around it measured 55px tall.

     So the trap has to ask the <details> instead. Without this the Tab loop
     walks into links the reader cannot see, focus lands nowhere visible, and
     the ring is drawn off in a subtree the browser is not painting.
     checkVisibility is the standard answer and is used where it exists;
     the closest() test is the fallback and the one that actually carries
     Safari, so both run. */
  function onScreen(el) {
    if (el.tagName !== "SUMMARY" && el.closest("details:not([open])")) return false;
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkVisibilityCSS: true });
    }
    return el.offsetParent !== null;
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var s = openSurface();
    if (!s) return;
    var roots = s.panel ? [s.first, s.panel] : [s];
    var items = [];
    roots.forEach(function (r) {
      if (r.matches && r.matches(FOCUSABLE)) items.push(r);
      Array.prototype.push.apply(items, r.querySelectorAll(FOCUSABLE));
    });
    items = items.filter(function (el) {
      return onScreen(el) || el === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var here = document.activeElement;
    // Focus that has already escaped (or never entered) comes back on the next
    // Tab rather than being left stranded behind the overlay.
    var i = items.indexOf(here);
    if (i === -1) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    // Step through `items` rather than letting the browser choose the next tab
    // stop. THE TWO ARE NOT THE SAME ORDER for the menu: the button and its
    // panel are not adjacent in the DOM, and Subscribe sits between them and is
    // visible from 900px up. So Tab off the button went to Subscribe, which is
    // outside the surface, which sent focus back to the button, which went to
    // Subscribe: an infinite two-stop loop with all 35 menu links unreachable
    // by keyboard on every page at desktop widths. It looked correct at 375px
    // only because Subscribe and the nav links are display:none there, which
    // made the DOM order and the surface order accidentally agree.
    // Walking `items` makes the loop identical at every width, and is a no-op
    // for the lightbox, whose items are already contiguous and in DOM order.
    e.preventDefault();
    (e.shiftKey
      ? i === 0 ? last : items[i - 1]
      : i === items.length - 1 ? first : items[i + 1]
    ).focus();
  });

  window.GR585 = { CHANNEL_ID: CHANNEL_ID, loadVideos: loadVideos };
})();
