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
     Thumbnails use oardefault.jpg, which is the *original aspect ratio* frame
     (720x1280 on this channel). hqdefault.jpg is a 480x360 centre crop and
     would letterbox every vertical rip, so it is only the fallback. */

  // "oar" = original aspect ratio: the only thumbnail YouTube serves at the
  // video's real vertical shape. Everything else (hqdefault, maxresdefault)
  // is a 4:3 or 16:9 crop that would letterbox a Short.
  // WebP first, roughly 110KB against 190KB for the JPEG.
  function thumbUrl(id) {
    return "https://i.ytimg.com/vi_webp/" + id + "/oardefault.webp";
  }
  var THUMB_CHAIN = [
    function (id) { return "https://i.ytimg.com/vi/" + id + "/oardefault.jpg"; },
    function (id) { return "https://i.ytimg.com/vi/" + id + "/maxresdefault.jpg"; }
  ];

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
   * keyed to each set's colour identity (see .pack--* in site.css), not
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

  function makeCard(v, opts) {
    opts = opts || {};
    var card = el("article", "vid");

    // Tiles navigate to the video's own page on this site, which is where the
    // embed lives. Nothing on a grid sends the visitor to youtube.com.
    var href = v.path ? "/" + v.path : "/videos.html";
    var shell = el("a", "vid-shell");
    shell.href = href;
    shell.setAttribute("aria-label", v.title);

    // Sealed pack instead of the YouTube poster frame, which is nearly always
    // the pulled card and gives the whole video away before you open it.
    //
    // A video can carry more than one set (a Scarlet & Violet blister holding
    // Journey Together packs, say). When the visitor has filtered to one set,
    // show that set's pack rather than whichever happens to be listed first,
    // otherwise a Scarlet & Violet filter returns a wall of other packs.
    var sets = v.sets || [];
    var set = opts.preferSet && sets.indexOf(opts.preferSet) > -1 ? opts.preferSet : sets[0];
    // Unfiltered, a video holding packs from several sets shows the generic
    // multi-set wrapper rather than picking one of them and implying the rip
    // was only that set. Filtered, the set the visitor asked for still wins.
    if (!opts.preferSet && sets.length > 1) set = "multi";
    // No set at all: the generic wrapper beats the unskinned green placeholder.
    else if (!set) set = "default";
    shell.appendChild(makePack(set, "tile"));

    if (opts.rank) shell.appendChild(el("span", "hits-rank", "#" + opts.rank));

    var prod = (v.products || [])[0];
    if (prod) shell.appendChild(el("span", "vid-chip", labelOf("products", prod)));

    var play = el("span", "vid-play");
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    shell.appendChild(play);

    shell.addEventListener("pointerenter", warmPlayer, { passive: true });
    card.appendChild(shell);

    var h3 = el("h3", "vid-title");
    var a = el("a", null, v.title);
    a.href = href;
    h3.appendChild(a);
    card.appendChild(h3);

    var bits = [];
    // Label from the real sets, not from whichever wrapper is being shown:
    // "multi" is an artwork choice, not a set, and would read as one here.
    if (sets.length > 1) bits.push(labelOf("sets", sets[0]) + " +" + (sets.length - 1));
    else if (set) bits.push(labelOf("sets", set));
    if (v.published) bits.push(fmtDate(v.published));
    if (v.views) bits.push(fmtViews(v.views));
    card.appendChild(el("p", "vid-meta", bits.join("  ·  ")));

    return card;
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
  function pickHall(videos, playlists, n) {
    var pl = (playlists || []).filter(function (p) { return /greatest/i.test(p.title); })[0];
    if (pl && pl.videoIds && pl.videoIds.length) {
      var byId = {};
      videos.forEach(function (v) { byId[v.id] = v; });
      var list = pl.videoIds.map(function (id) { return byId[id]; }).filter(Boolean);
      if (list.length) return { videos: list.slice(0, n), playlist: pl };
    }
    var flagged = videos.filter(function (v) { return v.greatest; });
    if (flagged.length) return { videos: flagged.slice(0, n), playlist: null };
    return null;
  }

  function pickHits(videos, playlists, n) {
    var hits = null;
    // "Greatest Hits" must not win the Hits Only shelf: both titles contain
    // "hit", and the greatest playlist is a subset of the same videos.
    var pl = (playlists || []).filter(function (p) {
      return /hit/i.test(p.title) && !/greatest/i.test(p.title);
    })[0];
    if (pl && pl.videoIds && pl.videoIds.length) {
      var byId = {};
      videos.forEach(function (v) { byId[v.id] = v; });
      hits = pl.videoIds.map(function (id) { return byId[id]; }).filter(Boolean);
    }
    if (!hits || !hits.length) {
      hits = videos
        .filter(function (v) { return (v.pulls || []).length; })
        .sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    }
    return { videos: hits.slice(0, n), playlist: pl || null, derived: !pl };
  }

  /* ------------------------------------------------------------- homepage */

  function initHome() {
    var latestGrid = document.getElementById("latestGrid");
    var hitsGrid = document.getElementById("hitsGrid");
    if (!latestGrid && !hitsGrid) return;

    Promise.all([loadVideos(), loadPlaylists()]).then(function (res) {
      var videos = res[0], pls = res[1].playlists || [];

      renderSetLogos(videos);

      if (latestGrid) {
        latestGrid.textContent = "";
        videos.slice(0, 6).forEach(function (v) { latestGrid.appendChild(makeCard(v)); });
      }

      if (hitsGrid) {
        var h = pickHits(videos, pls, 6);
        hitsGrid.textContent = "";
        if (!h.videos.length) {
          hitsGrid.appendChild(emptyState("No hits tagged yet", "Run the sync and the board fills itself."));
        } else {
          h.videos.forEach(function (v, i) { hitsGrid.appendChild(makeCard(v, { rank: i + 1 })); });
        }
        var link = document.getElementById("hitsAll");
        if (link && h.playlist) link.href = "https://www.youtube.com/playlist?list=" + h.playlist.id;
        var note = document.getElementById("hitsNote");
        if (note && h.derived) {
          note.textContent = "Ranked by views until the Hits Only playlist is connected.";
        }
      }

      var hallGrid = document.getElementById("hallGrid");
      if (hallGrid) {
        var hall = pickHall(videos, pls, 6);
        var section = document.getElementById("hall");
        if (!hall) {
          // Nothing qualifies yet, so the shelf would be an empty gold band.
          if (section) section.hidden = true;
        } else {
          hallGrid.textContent = "";
          hall.videos.forEach(function (v, i) {
            var card = makeCard(v, { rank: i + 1 });
            var crown = el("span", "hall-crown", "👑");
            crown.setAttribute("aria-hidden", "true");
            card.firstChild.appendChild(crown);
            hallGrid.appendChild(card);
          });
          var hl = document.getElementById("hallAll");
          if (hl && hall.playlist) hl.href = "https://www.youtube.com/playlist?list=" + hall.playlist.id;
        }
      }
    }).catch(function () {
      [latestGrid, hitsGrid].forEach(function (g) {
        if (g) { g.textContent = ""; g.appendChild(emptyState("Could not load the videos", "Head straight to the channel instead.")); }
      });
    });
  }

  /**
   * The "jump straight to a set" band. Built from the real tag counts so a set
   * appears the moment videos are tagged with it, and shows the official set
   * logo when one has been added. No manifest: the URL is derived from the set
   * id, and a set with no logo file falls back to a text chip on error.
   */
  function renderSetLogos(videos) {
    var box = document.getElementById("setLogos");
    if (!box) return;
    var counts = {};
    videos.forEach(function (v) {
      (v.sets || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });
    });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 8);
    box.textContent = "";
    top.forEach(function (id) {
      var label = labelOf("sets", id);
      var a = el("a", "set-logo");
      a.href = "videos.html?set=" + id;
      var img = new Image();
      img.src = "assets/logos/" + id + "-pokemon-tcg-set-logo.webp";
      img.alt = label + " Pokemon TCG set logo";
      img.loading = "lazy";
      img.onerror = function () {
        // No logo drawn for this set yet: degrade to the text chip.
        a.className = "chip";
        a.textContent = label;
        var n = el("span", "n", counts[id]);
        a.appendChild(n);
      };
      a.appendChild(img);
      a.appendChild(el("span", "n", counts[id] + " rips"));
      box.appendChild(a);
    });
  }

  function emptyState(big, small) {
    var d = el("div", "empty");
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

    function matches(v) {
      if (state.sets.length && !state.sets.some(function (s) { return (v.sets || []).indexOf(s) > -1; })) return false;
      if (state.products.length && !state.products.some(function (s) { return (v.products || []).indexOf(s) > -1; })) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        var hay = (v.title + " " + (v.sets || []).map(function (s) { return labelOf("sets", s); }).join(" ") +
          " " + (v.products || []).map(function (s) { return labelOf("products", s); }).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }

    var SORTS = {
      new: function (a, b) { return a.published < b.published ? 1 : -1; },
      old: function (a, b) { return a.published > b.published ? 1 : -1; },
      views: function (a, b) { return (b.views || 0) - (a.views || 0); }
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
        grid.appendChild(emptyState("Nothing in that pile", "Try clearing a filter. Even the bulk has something in it."));
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
    var search = document.getElementById("libSearch");
    if (search) {
      search.value = state.q;
      var t;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { state.q = search.value.trim(); render(); }, 160);
      });
    }
    var sortSel = document.getElementById("libSort");
    if (sortSel) {
      sortSel.value = state.sort;
      sortSel.addEventListener("change", function () { state.sort = sortSel.value; render(); });
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
        state.q = ""; state.sets = []; state.products = [];
        if (search) search.value = "";
        render();
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
        var th = el("div", "pl-thumb");
        var first = (p.videoIds || [])[0];
        if (first) {
          var img = new Image();
          img.src = thumbUrl(first);
          img.alt = "";
          img.loading = "lazy";
          th.appendChild(img);
        }
        a.appendChild(th);
        var body = el("div", "pl-body");
        body.appendChild(el("h3", "pl-title", p.title));
        body.appendChild(el("p", "pl-count", p.count + (p.count === 1 ? " video" : " videos")));
        a.appendChild(body);
        box.appendChild(a);
      });
    });
  }

  /* ------------------------------------------------------------ chrome */

  function initNav() {
    var nav = document.querySelector("nav.site");
    var toggle = document.querySelector(".nav-toggle");
    if (nav && toggle) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    // Site-wide search box in the header routes into the library page.
    document.querySelectorAll("form.search[data-route]").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = f.querySelector("input").value.trim();
        // Absolute: initNav also runs on /rip/* and /sets/*, where a relative
        // path would resolve to /rip/videos.html and 404.
        location.href = "/videos.html" + (q ? "?q=" + encodeURIComponent(q) : "");
      });
    });
    var yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  function initCard() {
    var card = document.getElementById("holoCard");
    var shine = document.getElementById("holoShine");
    if (!card) return;
    card.addEventListener("click", function () {
      card.classList.toggle("flipped");
      card.setAttribute("aria-pressed", String(card.classList.contains("flipped")));
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
    });
    if (reduced) return;
    var stage = card.parentElement;
    stage.addEventListener("mousemove", function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = "rotateY(" + x * 14 + "deg) rotateX(" + -y * 14 + "deg)";
      if (shine) {
        shine.style.opacity = 0.3 + Math.abs(x) * 0.6;
        shine.style.backgroundPosition = x * 120 + 50 + "% 50%";
      }
    });
    stage.addEventListener("mouseleave", function () {
      card.style.transform = "rotateY(0) rotateX(0)";
      if (shine) shine.style.opacity = 0.5;
    });
  }

  function boot() {
    initNav();
    initCard();
    initHome();
    initLibrary();
    initPlaylists();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.GR585 = { CHANNEL_ID: CHANNEL_ID, loadVideos: loadVideos };
})();
