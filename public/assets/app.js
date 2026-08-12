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

  function fmtViews(n) {
    if (!n) return "";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M views";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K views";
    return n + " views";
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
    art.setAttribute("aria-label", v.siteTitle || v.title);

    // Sealed pack instead of the YouTube poster frame, which is nearly always
    // the pulled card and gives the whole video away before you open it.
    //
    // A video can carry more than one set (a tin holding packs from two, an ex
    // box holding ten across four). When the visitor has filtered to one set,
    // show that set's pack; unfiltered, show the generic multi-set wrapper
    // rather than implying the rip was only one of them.
    var sets = v.sets || [];
    var set = opts.preferSet && sets.indexOf(opts.preferSet) > -1 ? opts.preferSet : sets[0];
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
    var a = el("a", null, v.siteTitle || v.title);
    a.href = href;
    h3.appendChild(a);
    card.appendChild(h3);

    // Label from the real sets, never from the wrapper being shown: "multi" is
    // an artwork choice and would read here as though it were a card set.
    var bits = [];
    if (sets.length > 1) bits.push(labelOf("sets", sets[0]).toUpperCase() + " +" + (sets.length - 1));
    else if (sets.length) bits.push(labelOf("sets", sets[0]).toUpperCase());
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
     (matching) happens at sync time, not in the browser. */

  var LABELS = {
    sets: {
      "pitch-black": "Pitch Black", "phantasmal-flames": "Phantasmal Flames",
      "ascended-heroes": "Ascended Heroes", "pokemon-go": "Pokemon GO",
      "perfect-order": "Perfect Order", "chaos-rising": "Chaos Rising",
      "mega-evolution": "Mega Evolution", "black-bolt": "Black Bolt",
      "white-flare": "White Flare", "destined-rivals": "Destined Rivals",
      "journey-together": "Journey Together", "prismatic-evolutions": "Prismatic Evolutions",
      "surging-sparks": "Surging Sparks", "stellar-crown": "Stellar Crown",
      "shrouded-fable": "Shrouded Fable", "twilight-masquerade": "Twilight Masquerade",
      "temporal-forces": "Temporal Forces", "paldean-fates": "Paldean Fates",
      "paradox-rift": "Paradox Rift", "obsidian-flames": "Obsidian Flames",
      "paldea-evolved": "Paldea Evolved", "scarlet-violet": "Scarlet & Violet", "151": "151"
    },
    products: {
      upc: "UPC", etb: "ETB", "booster-box": "Booster Box", "ex-box": "EX Box",
      bundle: "Bundle", blister: "Blister", tin: "Tin",
      "collection-box": "Collection Box", "single-pack": "Single Pack"
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
        // Layer the live RSS feed on top so uploads made since the last sync
        // still show. Optional: the site works fine without the function.
        return fetch("/api/latest")
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (live) {
            if (!live || !live.videos || !live.videos.length) return videos;
            var seen = {};
            videos.forEach(function (v) { seen[v.id] = v; });
            var merged = videos.slice();
            live.videos.forEach(function (v) {
              if (seen[v.id]) {
                // keep the richer synced record, refresh the view count
                if (v.views) seen[v.id].views = v.views;
              } else {
                merged.push(v);
              }
            });
            return merged.sort(function (a, b) { return a.published < b.published ? 1 : -1; });
          })
          .catch(function () { return videos; });
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

    function render(keepPage) {
      if (!keepPage) shown = PAGE;
      var out = all.filter(matches).sort(SORTS[state.sort] || SORTS.new);
      grid.textContent = "";
      if (!out.length) {
        grid.appendChild(emptyState("Nothing in that pile", "Try clearing a filter. Even the bulk has something in it.", true));
      } else {
        var frag = document.createDocumentFragment();
        var prefer = state.sets.length === 1 ? state.sets[0] : null;
        out.slice(0, shown).forEach(function (v) { frag.appendChild(makeCard(v, { preferSet: prefer })); });
        grid.appendChild(frag);
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

    grid.appendChild(emptyState("Loading the bulk...", ""));
    loadVideos().then(function (videos) {
      all = videos;
      buildChips("sets", "setChips");
      buildChips("products", "productChips");
      render();
    }).catch(function () {
      grid.textContent = "";
      grid.appendChild(emptyState("Could not load the library", "The channel still works: youtube.com/@GarbageRips585"));
    });
  }

  /* ------------------------------------------------------- playlists page */

  function initPlaylists() {
    var box = document.getElementById("plGrid");
    if (!box) return;
    box.appendChild(emptyState("Loading playlists...", ""));
    Promise.all([loadPlaylists(), loadVideos()]).then(function (res) {
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
      pls.forEach(function (p) {
        var a = el("a", "pl");
        a.href = "https://www.youtube.com/playlist?list=" + p.id;
        a.rel = "noopener";
        a.target = "_blank";
        a.setAttribute("aria-label", p.title + ", " + p.count + " videos, opens on YouTube");

        // The playlist's own cover, which Tim sets by hand and which shows the
        // sealed packaging rather than a pulled card. That is the exception to
        // this site's rule about YouTube imagery: a video's poster frame gives
        // the pull away, a playlist cover does not, and it says more about what
        // the run contains than any wrapper we could substitute.
        var th = el("span", "pl-thumb");
        if (p.thumb) {
          var img = new Image();
          img.src = p.thumb;
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
        body.appendChild(el("span", "pl-out", "Watch on YouTube"));
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

  window.GR585 = { CHANNEL_ID: CHANNEL_ID, loadVideos: loadVideos };
})();
