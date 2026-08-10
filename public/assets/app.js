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

  // Only one player is ever live. Without this, clicking through six tiles
  // leaves six ~540KB players resident.
  var livePlayer = null;
  function teardownPlayer() {
    if (!livePlayer) return;
    var shell = livePlayer.shell, v = livePlayer.video, opts = livePlayer.opts;
    var fresh = makeCard(v, opts);
    if (shell.parentNode) shell.parentNode.replaceChild(fresh.firstChild, shell);
    livePlayer = null;
  }

  function makeCard(v, opts) {
    opts = opts || {};
    var card = el("article", "vid");

    var shell = el("button", "vid-shell");
    shell.type = "button";
    shell.setAttribute("aria-label", "Play: " + v.title);

    var img = new Image();
    img.src = thumbUrl(v.id);
    img.alt = "";
    img.loading = "lazy";
    img.width = 720;
    img.height = 1280;
    // The oar* paths are undocumented and 404 on the channel's one landscape
    // upload, so walk down to a frame that always exists.
    var step = 0;
    img.onerror = function () {
      if (step < THUMB_CHAIN.length) img.src = THUMB_CHAIN[step++](v.id);
    };
    shell.appendChild(img);

    if (opts.rank) shell.appendChild(el("span", "hits-rank", "#" + opts.rank));

    var prod = (v.products || [])[0];
    if (prod) shell.appendChild(el("span", "vid-chip", labelOf("products", prod)));
    var set = (v.sets || [])[0];
    if (set) shell.appendChild(el("span", "vid-chip set", labelOf("sets", set)));

    var play = el("span", "vid-play");
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    shell.appendChild(play);

    shell.addEventListener("pointerenter", warmPlayer, { passive: true });

    // Click-to-load: a live player is ~540KB, so a grid of them would be
    // brutal. Swapping on click also means the play counts as a real view,
    // which a muted autoplaying preview would not.
    shell.addEventListener("click", function () {
      if (shell.dataset.playing) return;
      teardownPlayer();
      shell.dataset.playing = "1";
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + v.id + "?autoplay=1&playsinline=1&rel=0";
      f.title = v.title;
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      f.allowFullscreen = true;
      // Without this, YouTube throws error 153 on some embeds.
      f.referrerPolicy = "strict-origin-when-cross-origin";
      shell.textContent = "";
      shell.classList.add("playing");
      shell.appendChild(f);
      livePlayer = { shell: shell, video: v, opts: opts };
    });
    card.appendChild(shell);

    var h3 = el("h3", "vid-title");
    var a = el("a", null, v.title);
    a.href = "https://www.youtube.com/watch?v=" + v.id;
    a.rel = "noopener";
    h3.appendChild(a);
    card.appendChild(h3);

    var bits = [];
    if (set) bits.push(labelOf("sets", set));
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
  function labelOf(group, id) {
    return (LABELS[group] && LABELS[group][id]) || id;
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

  function pickHits(videos, playlists, n) {
    var hits = null;
    var pl = (playlists || []).filter(function (p) { return /hit/i.test(p.title); })[0];
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
    }).catch(function () {
      [latestGrid, hitsGrid].forEach(function (g) {
        if (g) { g.textContent = ""; g.appendChild(emptyState("Could not load the videos", "Head straight to the channel instead.")); }
      });
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
        out.slice(0, shown).forEach(function (v) { frag.appendChild(makeCard(v)); });
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
        location.href = "videos.html" + (q ? "?q=" + encodeURIComponent(q) : "");
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
