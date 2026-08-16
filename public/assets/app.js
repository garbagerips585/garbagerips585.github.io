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
    // carries it, otherwise the first it is tagged with. Both the artwork below
    // and the caption further down read from this, because a tile wearing the
    // Chaos Rising wrapper under a Chaos Rising filter while its caption said
    // "PERFECT ORDER +1" looked like the filter had leaked.
    var lead = opts.preferSet && sets.indexOf(opts.preferSet) > -1 ? opts.preferSet : sets[0];
    var set = lead;
    if (!opts.preferSet && sets.length > 1) set = "multi";
    else if (!set) set = "default";
    art.appendChild(makePack(set, "tile"));

    if (opts.rank) art.appendChild(el("span", "rank", String(opts.rank)));

    var pull = (v.pulls || [])[0];
    if (pull) art.appendChild(el("span", "hit", labelOf("pulls", pull)));

    if (v.duration) art.appendChild(el("span", "dur", clock(v.duration)));
    art.appendChild(el("span", "play"));

    art.addEventListener("pointerenter", warmPlayer, { passive: true });
    card.appendChild(art);

    var h3 = el("h3");
    // The tile shows what was opened; the full YouTube title stays as the
    // link's accessible name above, so nothing is lost to a screen reader.
    var a = el("a", null, v.label || v.siteTitle || v.title);
    a.href = href;
    h3.appendChild(a);
    card.appendChild(h3);

    // Label from the real sets, never from the wrapper being shown: "multi" is
    // an artwork choice and would read here as though it were a card set.
    var bits = [];
    if (sets.length > 1) bits.push(labelOf("sets", lead).toUpperCase() + " +" + (sets.length - 1));
    else if (sets.length) bits.push(labelOf("sets", lead).toUpperCase());
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
    products: {
      upc: "UPC", etb: "ETB", "booster-box": "Booster Box", "ex-box": "ex Box",
      "ex-premium": "ex Premium Collection", bundle: "Booster Bundle",
      blister: "Blister", tin: "Tin", "poke-ball-tin": "Poke Ball Tin",
      "collection-box": "Collection Box", "single-pack": "Single Pack",
      "japanese-pack": "Japanese Pack", "korean-pack": "Korean Pack",
      "chinese-pack": "Chinese Pack"
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

  /* -------------------------------------------------------- library page */

  function initLibrary() {
    var grid = document.getElementById("libGrid");
    if (!grid) return;

    var state = { q: "", sets: [], products: [], sort: "new" };
    var all = [];

    // URL is the source of truth so any filtered view is shareable.
    function readUrl() {
      var p = new URLSearchParams(location.search);
      state.q = p.get("q") || "";
      state.sets = (p.get("set") || "").split(",").filter(Boolean);
      state.products = (p.get("product") || "").split(",").filter(Boolean);
      state.sort = p.get("sort") || "new";
    }
    function writeUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set("q", state.q);
      if (state.sets.length) p.set("set", state.sets.join(","));
      if (state.products.length) p.set("product", state.products.join(","));
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
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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
    function render(keepPage, keepDom) {
      if (!keepPage) shown = PAGE;
      var out = all.filter(matches).sort(SORTS[state.sort] || SORTS.new);
      if (!keepDom) {
      grid.textContent = "";
      if (!out.length) {
        grid.appendChild(emptyState("Nothing in that pile", "Try clearing a filter. Even the bulk has something in it.", true));
      } else {
        var frag = document.createDocumentFragment();
        var prefer = state.sets.length === 1 ? state.sets[0] : null;
        out.slice(0, shown).forEach(function (v) { frag.appendChild(makeCard(v, { preferSet: prefer })); });
        grid.appendChild(frag);
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
          var limg = new Image();
          limg.src = "assets/logos/" + sid + "-pokemon-tcg-set-logo.webp";
          limg.alt = slabel + " Pokemon TCG set logo";
          limg.onerror = function () { limg.remove(); };
          head.appendChild(limg);
          var txt = el("div", "txt");
          txt.appendChild(el("b", null, slabel));
          txt.appendChild(document.createTextNode(out.length + (out.length === 1 ? " rip" : " rips") + " from this set"));
          head.appendChild(txt);
        } else {
          head.hidden = true;
        }
      }

      var c = document.getElementById("libCount");
      if (c) {
        c.innerHTML = "<b>" + out.length + "</b> of " + all.length + " rips" +
          (out.length > shown ? " &bull; showing " + shown : "");
      }
      syncChips();
      writeUrl();
    }

    function syncChips() {
      document.querySelectorAll(".chip[data-group]").forEach(function (b) {
        var g = b.dataset.group, v = b.dataset.value;
        b.setAttribute("aria-pressed", String(state[g].indexOf(v) > -1));
      });
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
          render();
        });
        box.appendChild(b);
      });
    }

    readUrl();
    parsed = parseQuery(state.q);

    var search = document.getElementById("libSearch");
    var sortSel = document.getElementById("libSort");
    var clearQ = document.getElementById("libClearQ");

    // Whether the visitor has chosen a sort themselves. Until they do, typing a
    // query switches to relevance and clearing it switches back, because a
    // search that answers in date order buries the thing you searched for.
    // Once they pick one, it is theirs and nothing changes it underneath them.
    var sortIsMine = state.sort !== "new" && state.sort !== "relevance";

    function applyQuery(raw, immediate) {
      state.q = String(raw).trim();
      parsed = parseQuery(state.q);
      if (!sortIsMine) state.sort = state.q ? "relevance" : "new";
      if (sortSel) sortSel.value = state.sort;
      if (clearQ) clearQ.hidden = !state.q;
      render();
      if (immediate && search) search.value = state.q;
    }

    if (search) {
      search.value = state.q;
      var t;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { applyQuery(search.value); }, 160);
      });
      // Escape clears the field, which is what a type=search input does
      // natively in some browsers and in none of the others.
      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && search.value) {
          e.preventDefault();
          clearTimeout(t);
          applyQuery("", true);
        }
      });
    }
    if (clearQ) {
      clearQ.hidden = !state.q;
      clearQ.addEventListener("click", function () {
        applyQuery("", true);
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
        render();
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
        state.sets = []; state.products = [];
        if (search) search.value = "";
        // Through applyQuery, so the parsed terms, the sort and the little
        // clear button all reset with it. Setting state.q directly left the
        // parsed query behind and the grid stayed filtered by a search the
        // box no longer showed.
        applyQuery("");
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
    var filtered = !!(state.q || state.sets.length || state.products.length || state.sort !== "new");
    var keepDom = prerendered > 0 && !filtered;
    if (keepDom) shown = prerendered;
    if (!prerendered) grid.appendChild(emptyState("Loading the bulk...", ""));
    loadVideos().then(function (videos) {
      all = videos;
      buildChips("sets", "setChips");
      buildChips("products", "productChips");
      render(keepDom, keepDom);
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
      pls.forEach(function (p) {
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
          a.setAttribute("aria-label", p.title + ", " + p.count + " videos");
        }

        // The playlist's own cover, which Tim sets by hand and which shows the
        // sealed packaging rather than a pulled card. That is the exception to
        // this site's rule about YouTube imagery: a video's poster frame gives
        // the pull away, a playlist cover does not, and it says more about what
        // the run contains than any wrapper we could substitute.
        var th = el("span", "pl-thumb");
        if (p.thumb) {
          var img = new Image();
          img.src = p.thumb;
          // A PLAYLIST COVER IS PAINTED 118 CSS px WIDE. It never changes with
          // the viewport: .pl-grid is auto-fill minmax(240px,1fr) and the thumb
          // measured 118px at 360, 390, 560, 768, 900, 1100, 1440 and 1920.
          // sync-youtube stores YouTube's best cover, which is maxresdefault at
          // 1280x720 and 150-200KB, so 22 playlists pulled 2,974KB of image at
          // 1440x900 to paint 118px boxes: 10.9x oversized in each direction.
          //
          // mqdefault is 320x180 and about 11KB. It is the ONLY other variant
          // at the true 16:9 shape (hqdefault and sddefault are 480x360 and
          // 640x480, which letterbox a widescreen cover), so the choice is two
          // candidates, not four. 320 covers a 118px box at 2x with room to
          // spare and a 3x screen still gets the 1280.
          //
          // Derived rather than synced: the swap is a filename, and re-running
          // sync-youtube needs an API key that CI does not have.
          var mq = p.thumb.replace(/\/maxresdefault\.(jpg|webp)$/, "/mqdefault.$1");
          if (mq !== p.thumb) {
            img.srcset = mq + " 320w, " + p.thumb + " 1280w";
            img.sizes = "118px";
          }
          img.alt = "";
          img.loading = "lazy";
          if (p.thumbW) { img.width = p.thumbW; img.height = p.thumbH; }
          th.appendChild(img);
        } else {
          // No cover set on YouTube: fall back to the wrapper of the first
          // tagged set in the playlist.
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
    // What it does need is to show the query it is displaying results for,
    // otherwise arriving at /videos.html?q=charizard shows an empty box.
    var navQ = document.getElementById("navSearch");
    if (navQ && !navQ.value) {
      navQ.value = new URLSearchParams(location.search).get("q") || "";
    }
    // Mobile menu. The bar has room for a brand, a search affordance and
    // Subscribe, and nothing else, so on a phone every other page used to be a
    // 7,000px scroll away in the footer.
    // Mark where we are, in both the bar links and the panel. Done here rather
    // than at build time because the same chrome is emitted into 346 pages and
    // one of them is always the current one.
    var here = location.pathname.replace(/index\.html$/, "") || "/";
    document.querySelectorAll(".menu a, .nav-links a").forEach(function (a) {
      var to = a.getAttribute("href");
      if (!to) return;
      var norm = to.replace(/index\.html$/, "");
      if (norm === here || (norm !== "/" && here.indexOf(norm) === 0)) {
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

    var yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();
  }


  function boot() {
    initNav();
    initLibrary();
    initPlaylists();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /**
   * Keep Tab inside whatever modal surface is open.
   *
   * Two of them exist: the card lightbox (.lb.on, on 10 set and Pokemon pages)
   * and the mobile menu (.menu.on, everywhere). Both cover the screen and both
   * left every background control tabbable, so Tab walked focus behind an
   * opaque overlay where the focus ring is invisible: 50 reachable controls
   * behind the lightbox, 87 behind the menu at 375px.
   *
   * Handled once here rather than in the four generators that each emit their
   * own copy of the lightbox script. app.js is already on every page, and a
   * fifth copy of a focus trap is how they drift.
   */
  function openSurface() {
    var lb = document.querySelector(".lb.on");
    if (lb) return lb;
    var mb = document.getElementById("menuBtn");
    if (mb && mb.getAttribute("aria-expanded") === "true") {
      var panel = document.getElementById("menu");
      // The button lives outside the panel but belongs to the same loop, or
      // Shift+Tab off the first link escapes to the page behind.
      if (panel) return { first: mb, panel: panel };
    }
    return null;
  }

  var FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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
      return el.offsetParent !== null || el === document.activeElement;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var here = document.activeElement;
    // Focus that has already escaped (or never entered) comes back on the next
    // Tab rather than being left stranded behind the overlay.
    if (items.indexOf(here) === -1) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && here === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && here === last) {
      e.preventDefault();
      first.focus();
    }
  });

  window.GR585 = { CHANNEL_ID: CHANNEL_ID, loadVideos: loadVideos };
})();
