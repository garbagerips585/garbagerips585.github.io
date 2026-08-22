/* The pack player, extracted so more than one page can use it.
 *
 * WHY THIS FILE EXISTS. This logic was inline in scripts/build-pages.mjs and
 * therefore existed only on rip pages. The homepage wanted the same thing, and
 * the only honest ways to get it are to share this code or to write it twice.
 * Written twice, the second copy would not have the mute ordering below, and it
 * would be wrong in exactly the way that is hardest to notice: intermittently,
 * on some browsers, on some visits.
 *
 * IT WAS MOVED, NOT REWRITTEN. Everything below is the code that shipped on 311
 * rip pages, with four changes and no others: the two root elements and the
 * sound button are found inside `root` instead of by document id, the sound
 * button's click listener is bound to `root` instead of `document`, and the
 * iframe title comes from a data attribute instead of a build-time template
 * interpolation. Ids could not stay: the homepage needs several of these on one
 * page, and duplicate ids would have every tile driving the first tile's video.
 *
 * ONE PLAYER AT A TIME is enforced by the caller, not here. A YouTube embed is
 * roughly 540KB, so a grid that mounted one per tile would be indefensible.
 * GRPack.open() tears down whatever is already open before arming the next.
 *
 * Read the AUTOPLAY comment below before touching any of it.
 */
(function () {
  "use strict";

  /**
   * Wire one pack to one player.
   * @param root  element containing .pack-player, .pack and optionally .sound-on.
   *              .pack-player carries data-id (the video) and data-title.
   */
  function attach(root) {
    if (!root || root.__packWired) return;
    root.__packWired = true;
  var p=root.querySelector('.pack-player'), pack=root.querySelector('.pack');
  if(!p||!pack) return;
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var opened=false;

  // AUTOPLAY, WITH SOUND.
  //
  // The goal is that ripping the pack starts the video with audio, every time.
  // Getting there is not one decision, it is an order of operations.
  //
  // WHAT IS ACTUALLY GOING ON
  // A muted media element is exempt from the user-gesture check. An unmuted one
  // is not, and a cross-origin iframe created during a click does not reliably
  // inherit that click: Chrome and Firefox usually honour an ancestor frame's
  // gesture through allow="autoplay", WebKit does not. That is why this was
  // intermittent rather than broken. It was never per-video and never per-page;
  // all 310 videos are public, embeddable and unrestricted, and every rip page
  // is byte-for-byte identical. It varied by browser and by visit.
  //
  // The trap: unmuting BEFORE playback begins throws away the exemption that
  // mute=1 just bought, so the player makes its autoplay attempt as an unmuted
  // element, gets refused, and paints YouTube's own play button. Asking for
  // sound too eagerly is what causes the very symptom it was meant to fix.
  //
  // SO, IN ORDER
  //   1. Mount MUTED. Muted autoplay is never refused, so the rip always
  //      starts, immediately, under the tear.
  //   2. Wait for the player to actually report PLAYING.
  //   3. Only then unmute. By that point it is a live element being changed,
  //      not an autoplay attempt being judged, and the page has the user's
  //      click behind it, so it is normally granted. Sound arrives a few
  //      hundred milliseconds in, while the pack is still coming apart.
  //   4. If unmuting stops it anyway, which is WebKit's documented behaviour,
  //      retreat: re-mute, resume, and offer one tap. That tap is a real
  //      gesture, so it always works.
  //
  // Do not "simplify" this to unmuted-from-the-start. That was tried and is
  // what produced the play button on some opens and not others.
  var EMBED='https://www.youtube-nocookie.com';
  var player=null, feedTimer=null, gotFeed=false, mounted=false;
  var phase='idle', muted=true, soundBtn=null, startWatch=null, unmuteWatch=null;

  function post(msg){
    if(!player||!player.contentWindow) return;
    try{ player.contentWindow.postMessage(JSON.stringify(msg),EMBED); }catch(e){}
  }
  function cmd(func,args){ post({event:'command',func:func,args:args||[],id:1,channel:'widget'}); }
  function listen(){ post({event:'listening',id:1,channel:'widget'}); }

  function mount(){
    if(mounted) return;
    mounted=true;
    var f=document.createElement('iframe');
    f.src=EMBED+'/embed/'+p.dataset.id
      +'?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&widgetid=1&origin='
      +encodeURIComponent(location.origin);
    f.title=p.dataset.title||'';
    f.allow='autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen=true;
    f.referrerPolicy='strict-origin-when-cross-origin';
    // The poster is a <picture> since the WebP change. Removing only the <img>
    // inside it left the poster sitting on top of the player.
    var poster=p.querySelector('picture')||p.querySelector('img');
    if(poster) poster.remove();
    p.insertBefore(f,p.firstChild);   // behind the pack, which tears away over it
    player=f;
    phase='waiting';

    // The player installs its message handler well after the iframe fires
    // load, and silently drops anything that arrives before it. Sending the
    // handshake once on load therefore loses it, and then no state ever
    // arrives and every decision below is made blind. Repeat until it answers.
    listen();
    feedTimer=setInterval(function(){
      if(gotFeed||!player){ clearInterval(feedTimer); feedTimer=null; return; }
      listen();
    },200);

    // Muted autoplay should be immediate. If it has not reported playing by
    // now, something outside autoplay policy is in the way: iOS Low Power
    // Mode, a blocked domain, a background tab. All of those need a tap.
    startWatch=setTimeout(function(){ if(phase==='waiting') retreat('play'); },2600);
  }

  // Called only once the player has REPORTED playing. See the note above.
  function askForSound(){
    phase='unmuting';
    cmd('setVolume',[100]);
    cmd('unMute');
    clearTimeout(unmuteWatch);
    unmuteWatch=setTimeout(function(){
      if(phase!=='unmuting') return;
      if(muted===false) phase='done';        // sound is on, nothing to offer
      else retreat('sound');
    },900);
  }

  // Unmuting was refused, or stopped playback. Put it back the way that always
  // works and let the visitor turn sound on with a tap.
  function retreat(kind){
    if(phase==='gesture') return;
    phase='gesture';
    clearTimeout(unmuteWatch); clearTimeout(startWatch);
    // Stop the handshake too. It only cleared itself once a valid player
    // message arrived, so in exactly the cases this function exists to handle,
    // a blocked domain or Low Power Mode or a background tab, it kept posting
    // every 200ms for the life of the page. Retreating means we have given up
    // on the feed, so there is nothing left to listen for.
    if(feedTimer){ clearInterval(feedTimer); feedTimer=null; }
    cmd('mute');
    cmd('playVideo');
    showBtn(true,kind);
  }

  function showBtn(on,kind){
    soundBtn=soundBtn||root.querySelector('.sound-on');
    if(!soundBtn) return;
    soundBtn.hidden=!on;
    if(on&&kind){
      var l=soundBtn.querySelector('.sound-on-label');
      if(l) l.textContent=(kind==='play'?'Tap to play':'Tap for sound');
    }
  }

  function onState(st){
    // 1 playing, 3 buffering. Buffering mid-unmute is normal, not a refusal.
    if(phase==='waiting'&&st===1){ clearTimeout(startWatch); askForSound(); return; }
    if(phase==='unmuting'&&st!==1&&st!==3){ retreat('sound'); return; }
    if(phase==='done'&&st!==1&&st!==3&&muted===false){ retreat('sound'); }
  }

  window.addEventListener('message',function(e){
    // Exact origin, and the message must come from OUR iframe. An indexOf on
    // "youtube" matches any host containing it and lets any frame drive this.
    if(e.origin!==EMBED&&e.origin!=='https://www.youtube.com') return;
    if(!player||e.source!==player.contentWindow) return;
    var d=e.data;
    if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(_){ return; } }
    if(!d||typeof d!=='object') return;
    gotFeed=true;
    if(d.event==='onAutoplayBlocked'){ retreat(phase==='unmuting'?'sound':'play'); return; }
    // onStateChange carries info as a NUMBER; infoDelivery carries an object.
    // Reading only the object shape missed every onStateChange.
    var info=d.info, st=null;
    if(typeof info==='number') st=info;
    else if(info&&typeof info.playerState==='number') st=info.playerState;
    if(info&&typeof info.muted==='boolean') muted=info.muted;
    if(st!==null) onState(st);
  });

  root.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('.sound-on')) return;
    // A real gesture, so this is always permitted.
    showBtn(false);
    phase='unmuting';
    cmd('unMute'); cmd('setVolume',[100]); cmd('playVideo');
    clearTimeout(unmuteWatch);
  });

  // Driven off animationend rather than timers that guess the CSS durations:
  // background tabs clamp setTimeout, which would desync the reveal from the
  // tear. Each step keeps a generous fallback timer in case the animation
  // never fires at all.
  function once(fn){ var done=false; return function(){ if(done) return; done=true; fn(); }; }

  // Wait for ONE named animation on an element. Without the name check any
  // animationend bubbling up from a child would advance the sequence early;
  // nothing does today, but adding a single animation anywhere inside the pack
  // would silently start the tear mid-shake.
  function after(el,name,fn){
    if(!el) return;
    el.addEventListener('animationend',function h(e){
      if(e.animationName!==name) return;
      el.removeEventListener('animationend',h);
      fn();
    });
  }

  pack.addEventListener('click',function(){
    if(opened) return; opened=true;
    // Was this a keyboard activation? Checked BEFORE the pack is torn away,
    // because removing the focused element drops focus to <body> and a
    // keyboard visitor is dumped back at the top of the document.
    var byKeyboard=document.activeElement===pack;
    mount();                                 // first, while the gesture is live
    if(reduced){ pack.remove(); focusPlayer(byKeyboard); return; }

    // Then tear the pack away over the top of the already-playing video.
    var face=pack.querySelector('.pack-l');
    var clear=once(function(){ pack.remove(); focusPlayer(byKeyboard); });
    var tear=once(function(){
      pack.classList.remove('shaking');
      pack.classList.add('tearing');
      after(face,'tearL',clear);
      setTimeout(clear,1600);
    });
    pack.classList.add('shaking');
    after(face,'packShake',tear);
    setTimeout(tear,600);
  });

  // Hand focus to the player so the next Tab continues from the video rather
  // than from the top of the page. Mouse users are left alone: focusing an
  // iframe can scroll it into view, which is jarring when you already clicked it.
  function focusPlayer(yes){
    if(!yes) return;
    var f=p.querySelector('iframe');
    if(f) f.focus({preventScroll:true});
  }
  }


  /* ---------------------------------------------------------------------
   * Playing a rip WHERE IT SITS, on any page with tiles.
   *
   * The tiles already carry everything this needs, so nothing in any builder
   * had to change: the video id is the last 11 characters of the rip url (the
   * shape shared/paths.mjs owns), and the set skin is in the pack image's own
   * filename. Deriving both means this works on the homepage, the set pages
   * and /videos.html at once, and cannot drift from markup it does not touch.
   *
   * THE TITLE LINK STILL NAVIGATES. Only the artwork plays inline. Someone who
   * wants the full page with the hits, the set guide and the description can
   * still get there in one click, and the tile is not a trap.
   *
   * WITHOUT JAVASCRIPT the tile is still a plain link to the rip page, which is
   * what it was before. This is an enhancement layered on top, not a rewrite.
   */
  var VID = /-([A-Za-z0-9_-]{11})\.html(?:[?#].*)?$/;
  var SKIN = /\/packs\/(.+?)-garbage-rips-585-booster-pack/;

  /* ONE DELEGATED LISTENER, not one per tile.
   *
   * /videos.html renders its grid from JSON after load, and the collection
   * views re-render on every filter change, so anything wired at
   * DOMContentLoaded would cover the homepage and silently miss the page with
   * the most tiles on the site. Delegation covers whatever exists at the moment
   * of the click, which is the only moment that matters. */
  function onDocClick(e) {
    // Never steal a modified click: cmd/ctrl/shift/middle all mean "open it
    // somewhere else", and hijacking those is the rudest thing a link can do.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (e.defaultPrevented) return;
    // ANY link to a rip that WRAPS AN IMAGE, not one hard-coded class.
    // It was a.art, which covered the nine grid tiles and missed the two
    // largest videos on the home page: the Hall of Fame spotlight is a.hofx and
    // the newest rip is a.hero-art. The biggest pack on the page was the one
    // pack you could not rip open.
    // Requiring an image is what keeps the rule honest: the artwork plays in
    // place, and the title link underneath it, which has no image, still opens
    // the full page with the hits and the set guide.
    var a = e.target.closest && e.target.closest('a[href*="/rip/"]');
    // ARTWORK, WHICHEVER FORM IT TAKES. Requiring an <img> looked like the
    // clean way to say "the picture plays, the title navigates", and it
    // silently switched off the biggest video page on the site: /videos.html
    // renders its 311 tiles from JSON with a pure CSS pack facade, spans only,
    // no image anywhere in the anchor. Ninety-six tiles matched nothing.
    // A .pack facade counts as artwork exactly as an <img> does; a title link
    // has neither and still navigates, which was the whole point of the rule.
    if (!a || !(a.querySelector("img") || a.querySelector(".pack"))) return;
    var m = VID.exec(a.getAttribute("href") || "");
    if (!m) return;                       // not a rip url; leave it alone
    e.preventDefault();
    playInTile(a, m[1]);
  }

  function playInTile(a, id) {
    // WAS THIS A KEYBOARD ACTIVATION? It has to be asked HERE, before the
    // anchor is replaced. attach() already does the right thing on a rip page:
    // it notices the pack had focus and moves focus onto the iframe afterwards.
    // From a tile that check always saw false, because the anchor had already
    // been swapped out and focus had fallen to <body>. So every keyboard user
    // who played a video from a tile lost their place on the page.
    var byKeyboard = document.activeElement === a || a.contains(document.activeElement);
    // The set comes from the image filename where there is an image, and from
    // the facade's own pack--<set> class where there is not. Falling back to
    // "default" for the CSS tiles would have given every rip on /videos.html
    // the generic green wrapper instead of its own.
    var img = a.querySelector("img");
    var sk = img && SKIN.exec(img.getAttribute("src") || "");
    var facade = a.querySelector(".pack");
    var fromClass = facade && /pack--(?!tile\b|img\b)([a-z0-9-]+)/.exec(facade.className);
    var skin = sk ? sk[1] : fromClass ? fromClass[1] : "default";
    var slot = a.parentNode;
    // The .hofx spotlight takes its accessible name from its contents rather
    // than an aria-label, so this produced title="" and the YouTube iframe went
    // out unnamed. Fall back to whatever the card calls the rip.
    var titleEl = a.querySelector(".hofx-t, .hero-body h3, h3");
    var title = (a.getAttribute("aria-label") || (titleEl ? titleEl.textContent : "") || "")
      .replace(/^Play\s+/, "")
      .trim();

    var host = document.createElement("div");
    host.className = "rip-stage tile-stage";
    host.innerHTML =
      '<div class="rip-player pack-player" data-id="' + id + '" data-title="' +
        title.replace(/"/g, "&quot;") + '">' +
        '<button class="pack pack--' + skin + '" type="button" aria-label="Rip open">' +
          '<span class="pack-face pack-l" aria-hidden="true"><span class="pack-art"></span></span>' +
          '<span class="pack-face pack-r" aria-hidden="true"><span class="pack-art"></span></span>' +
          '<span class="pack-flash" aria-hidden="true"></span>' +
        "</button>" +
        '<button class="sound-on" type="button" hidden>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/>' +
          '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>' +
          '<span class="sound-on-label">Tap for sound</span>' +
        "</button>" +
      "</div>";

    // REPLACE ONLY THE ARTWORK WHERE THE ANCHOR IS MORE THAN ARTWORK.
    //
    // A grid tile's <a> is nothing but a picture, so swapping the whole anchor
    // is right. The Hall of Fame spotlight's <a> is the ENTIRE gold card:
    // artwork, title, set, view count and the call to action. Swapping that
    // took the whole card away and left a lone player, so the page lost 141px
    // and the featured rip lost everything that said what it was.
    //
    // Where a dedicated art box exists inside the anchor, the anchor is rebuilt
    // as a plain <div> with only that box replaced. It has to stop being a link:
    // leaving an <a> wrapped around a live player means every click on the
    // video navigates away from it.
    // THE TEARDOWN PUTS THE CARD BACK, NOT JUST THE ANCHOR: building the shell
    // EMPTIES <a>, so restoring it alone left an empty gold frame. See CLAUDE.md.
    var artBox = a.querySelector(".hofx-art");
    if (artBox) {
      var shell = document.createElement("div");
      shell.className = a.className + " is-playing";
      while (a.firstChild) shell.appendChild(a.firstChild);
      shell.replaceChild(host, shell.querySelector(".hofx-art"));
      open(host, function () {
        if (!shell.parentNode) return;
        if (host.parentNode === shell) shell.replaceChild(artBox, host);
        while (shell.firstChild) a.appendChild(shell.firstChild);
        shell.parentNode.replaceChild(a, shell);
      });
      slot.replaceChild(shell, a);
      attach(host);
      var pk0 = host.querySelector(".pack");
      if (pk0) pk0.click();
      if (byKeyboard) focusInto(host);
      return;
    }

    // Whatever is already playing goes back to being a tile first. One embed is
    // ~540KB; a page that accumulated them would get heavier with every click.
    open(host, function () {
      if (host.parentNode) host.parentNode.replaceChild(a, host);
    });
    slot.replaceChild(host, a);

    attach(host);
    // The pack's own handler runs the shake, the tear and the mount. Calling it
    // from inside this click keeps the user gesture alive, which is what buys
    // unmuted playback a moment later.
    var pk = host.querySelector(".pack");
    if (pk) pk.click();
    if (byKeyboard) focusInto(host);
  }

  /* Move focus onto the freshly mounted player. Deferred, because the iframe is
   * created inside the pack's own click handler which has not run yet when this
   * is scheduled. preventScroll so the page does not jump under a mouse user. */
  function focusInto(host) {
    setTimeout(function () {
      var f = host.querySelector("iframe");
      if (f) f.focus({ preventScroll: true });
    }, 60);
  }


  /* ---------------------------------------------------------------------
   * Carousel arrows.
   *
   * The track is a native scroll-snap row, so swipe, trackpad and keyboard
   * already work and this adds nothing they need. The arrows are for a mouse,
   * which has no swipe, and they do the least they can: scrollBy one slide.
   * No transform, no index state, no transition to fight with the browser's
   * own smooth scrolling. That also means the counter can be derived from
   * scrollLeft rather than tracked, so it cannot drift out of step with a
   * swipe the buttons never saw.
   */
  function carouselClick(e) {
    var btn = e.target.closest && e.target.closest("[data-vcar-prev],[data-vcar-next]");
    if (!btn) return;
    var car = btn.closest("[data-vcar]");
    var track = car && car.querySelector(".vcar-track");
    if (!track) return;
    var slide = track.querySelector(".vcar-slide");
    var step = slide ? slide.getBoundingClientRect().width + 16 : track.clientWidth;
    // Ask for the artwork BEFORE the scroll starts, not when the slide lands.
    // The scroll is smooth and takes a few hundred ms, which is the head start.
    hydrateSlides(car, step);
    track.scrollBy({ left: btn.hasAttribute("data-vcar-next") ? step : -step, behavior: "smooth" });
  }

  /* ---------------------------------------------------------------------
   * Pack art for the slides the track is showing, and for the one either side.
   *
   * build-proto.mjs gives slide 0 a real src and hands every later slide its
   * src, srcset and sizes as data- attributes instead, because loading="lazy"
   * does not cover this case: it measures distance from the VIEWPORT, and a
   * slide 407px to the right inside a horizontal scroll track is nowhere near
   * far enough away for Chrome to hold it back. Measured on the home page at
   * 390x844 on a DPR 3 phone, that fetched 289.9KB of pack art for slides
   * behind the right-hand edge of a band that was itself below the fold.
   *
   * The test is against the TRACK's own box, so it is right at every width
   * without knowing any of ui.css's breakpoints: one slide on a phone, 2.35 at
   * 1000, 3.3 at 1400, exactly 2 in the Hall of Fame band.
   *
   * `lead` is how far past each edge of the track to reach. Zero on the first
   * pass and on resize, so a load only pays for what is on screen. One slide
   * width on a scroll or an arrow, so the artwork is already on its way before
   * the slide arrives.
   */
  function hydrateSlides(car, lead) {
    var track = car.querySelector(".vcar-track");
    if (!track) return;
    var box = track.getBoundingClientRect();
    var left = box.left - lead;
    var right = box.right + lead;
    var imgs = track.querySelectorAll("img[data-packsrc]");
    // EVERY READ, THEN EVERY WRITE. This used to measure one image and set src
    // on it before measuring the next, and setting src on an <img> dirties
    // layout, so each getBoundingClientRect after the first forced a synchronous
    // re-layout of the track. Four slides meant four forced layouts on the load
    // path, which is small and was measured to be small: the home page shows
    // 0ms of Total Blocking Time and no long task at all at any width, before
    // this change or after it. It is separated because the pattern is a trap
    // rather than because it was costing anything, and because this loop is one
    // slide long today and a longer band would not announce the cost.
    var due = [];
    for (var i = 0; i < imgs.length; i++) {
      var r = imgs[i].getBoundingClientRect();
      // Not laid out yet. Say nothing rather than guess; the scroll and resize
      // handlers come back to it.
      if (!r.width) continue;
      if (r.right <= left || r.left >= right) continue;
      due.push(imgs[i]);
    }
    for (var j = 0; j < due.length; j++) {
      var im = due[j];
      // THE <source> FIRST, AND THE ORDER IS THE WHOLE THING.
      //
      // Pack art is a <picture> now: an AVIF <source> in front of the WebP
      // <img> (avifPicture in shared/format.mjs). Both halves are deferred,
      // because a <picture> whose source matches loads that source even when
      // the <img> has no src, so a live srcset on the source would fetch every
      // slide at first paint and undo the deferral entirely.
      //
      // Promoting the img first does NOT work and it fails quietly: the source
      // still has no srcset at that moment, so it does not match, the browser
      // resolves the img's own WebP srcset and commits to it, and the AVIF
      // arriving a line later either does nothing or costs a SECOND request for
      // the same picture. Set the source, then the img, and the img's src is
      // then only ever the fallback for a browser that skipped the source.
      //
      // Same sizes-then-srcset rule as below, for the same reason: srcset
      // without sizes resolves against a 100vw default and can pick the 810w
      // file, and the sizes arriving afterwards cannot call that request back.
      var pic = im.parentNode;
      if (pic && pic.tagName === "PICTURE") {
        var so = pic.querySelector("source[data-packsrcset]");
        if (so) {
          var ssz = so.getAttribute("data-packsizes");
          if (ssz) so.setAttribute("sizes", ssz);
          so.setAttribute("srcset", so.getAttribute("data-packsrcset"));
          so.removeAttribute("data-packsrcset");
          so.removeAttribute("data-packsizes");
        }
      }
      // sizes, then srcset, then src. Setting src first starts a fetch for the
      // one url it names, and the srcset arriving on the next line cannot call
      // that request back.
      var sz = im.getAttribute("data-packsizes");
      var ss = im.getAttribute("data-packsrcset");
      if (sz) im.setAttribute("sizes", sz);
      if (ss) im.setAttribute("srcset", ss);
      im.setAttribute("src", im.getAttribute("data-packsrc"));
      // loading="lazy" is still on the element, so the VERTICAL half of the
      // decision goes back to the browser from here: a band four screens down
      // still waits, exactly as it did before.
      im.removeAttribute("data-packsrc");
      im.removeAttribute("data-packsrcset");
      im.removeAttribute("data-packsizes");
    }
  }

  function syncCarousel(car) {
    var track = car.querySelector(".vcar-track");
    var slide = track && track.querySelector(".vcar-slide");
    if (!track || !slide) return;
    var step = slide.getBoundingClientRect().width + 16;
    var n = track.querySelectorAll(".vcar-slide").length;
    var i = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / step)));
    // ONLY WRITE WHEN IT CHANGES. This ran on every scroll event and assigning
    // textContent replaces the node even when the value is identical, so one
    // arrow press mutated a polite live region 28 times in under a second, the
    // first seven of them rewriting the same "1". That is a re-announcement
    // risk for anything listening.
    var out = car.querySelector("[data-vcar-i]");
    var next = String(i + 1);
    if (out && out.textContent !== next) out.textContent = next;
    var prev = car.querySelector("[data-vcar-prev]");
    var next = car.querySelector("[data-vcar-next]");
    // 2px of slack: scrollLeft is fractional at some zoom levels and an exact
    // comparison leaves the last slide's arrow enabled forever.
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    // Desktop shows two or three slides at once, so a short run can fit the
    // track entirely. Both arrows are then permanently disabled beside a
    // counter reading "1 / 2" with both cards on screen, which is furniture
    // that does nothing. Hide the whole bar instead; .vcar.is-static in ui.css
    // is the only thing that reads this. Same 2px of slack as above.
    car.classList.toggle("is-static", track.scrollWidth <= track.clientWidth + 2);
  }

  function wireCarousels() {
    var cars = document.querySelectorAll("[data-vcar]");
    for (var i = 0; i < cars.length; i++) {
      (function (car) {
        if (car.__vcarWired) return;
        car.__vcarWired = true;
        var track = car.querySelector(".vcar-track");
        if (track) track.addEventListener("scroll", function () {
          syncCarousel(car);
          // A swipe or a trackpad flick never touches the arrows, so this is
          // the only hook that covers them. One slide of lead, measured off the
          // track rather than assumed, so the next pack is already loading.
          var s = track.querySelector(".vcar-slide");
          hydrateSlides(car, s ? s.getBoundingClientRect().width + 16 : track.clientWidth);
        }, { passive: true });
        window.addEventListener("resize", function () { syncCarousel(car); hydrateSlides(car, 0); });
        syncCarousel(car);
        // First pass, no lead: a page load pays for the slides that are
        // actually on screen and nothing else. Desktop shows two or three, a
        // phone shows one, and this asks the laid-out track which it is.
        hydrateSlides(car, 0);
      })(cars[i]);
    }
  }

  /* The registry that keeps a single embed live across the whole page.
   * Nothing in attach() knows about this; it is the caller's contract. */
  var live = null;
  function open(root, teardown) {
    if (live && live.root !== root && typeof live.teardown === "function") live.teardown();
    live = { root: root, teardown: teardown };
  }
  function closeAll() {
    if (live && typeof live.teardown === "function") live.teardown();
    live = null;
  }

  window.GRPack = { attach: attach, open: open, closeAll: closeAll };

  // Bound once, at the document, so tiles rendered later are covered too.
  document.addEventListener("click", onDocClick);
  document.addEventListener("click", carouselClick);
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", wireCarousels);
  else wireCarousels();
})();
