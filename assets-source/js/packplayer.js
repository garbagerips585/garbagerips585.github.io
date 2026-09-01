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

  /* WHEN THE VIDEO ENDS.
   *
   * A rip is about twenty seconds long. Until this existed the player simply
   * stopped on its last frame and the reader left, which is the biggest leak
   * on the site: 330 videos, each one ending in nothing to do next.
   *
   * ENDED ONLY BECAME TRUSTWORTHY ON 1 SEPTEMBER 2026. Before that, state 0
   * fell through to retreat(), which re-muted and called playVideo, so every
   * finished rip silently restarted from the top with the sound off. The end
   * card could not have been built on a signal that behaved like that. See the
   * long comment in onState below for the measurement.
   *
   * AND THE SIGNAL IS STILL NOT GUARANTEED. YouTube's embed does not reliably
   * post state 0 for a Short, so a video that ends can leave the card unshown.
   * The backup is EXACT rather than a guess: every rip carries its real runtime
   * in seconds, so the timer is that runtime plus 1500ms of slack for the
   * handshake and any buffering. Whichever arrives first wins and the other is
   * cancelled, so the card cannot fire twice.
   *
   * `ended` is deliberately one-way. Watch again clears it through
   * root.__endReset, because that is a new play of the same video; nothing else
   * may. */
  var endTimer=null, ended=false, endArmed=false;

  function fireEnd(){
    if(ended) return;
    ended=true;
    clearTimeout(endTimer); endTimer=null;
    // The start watchdog would otherwise fire at 2600ms and paint "Tap to play"
    // under the card, on a video that has already finished.
    clearTimeout(startWatch);
    if(typeof root.__onEnd==='function') root.__onEnd();
  }

  function armEnd(){
    if(endArmed) return;
    endArmed=true;
    var secs=Number(p.dataset.dur||0);
    // No duration on this player: the state feed is all there is. That is the
    // honest fallback -- guessing a runtime would fire the card over a video
    // still playing, which is worse than a card that never comes.
    if(!secs) return;
    endTimer=setTimeout(fireEnd,secs*1000+1500);
  }

  // Watch again. seekTo before playVideo, because a player sitting on state 0
  // answers playVideo by resuming at the end and ending again immediately.
  root.__replay=function(){ cmd('seekTo',[0,true]); cmd('playVideo'); };

  // A replay is a fresh video as far as this is concerned.
  root.__endReset=function(){
    ended=false; endArmed=false;
    clearTimeout(endTimer); endTimer=null;
    armEnd();
  };

  function onState(st){
    // The runtime backup is armed the moment the video is really playing, not
    // at mount: a player that never starts must not get an end card.
    if(st===1) armEnd();
    // 1 playing, 3 buffering. Buffering mid-unmute is normal, not a refusal.
    if(phase==='waiting'&&st===1){ clearTimeout(startWatch); askForSound(); return; }
    if(phase==='unmuting'&&st!==1&&st!==3){ retreat('sound'); return; }
    // 0 is ENDED and 2 is PAUSED. Once sound has been granted and the video has
    // played, both are the player doing exactly what it was asked, NOT a refusal
    // -- and retreat() answers a refusal by re-muting and calling playVideo. So
    // reaching it here restarted every finished rip from the top with the sound
    // off under a "Tap for sound" button, and made pausing impossible. Measured
    // on a 19s rip: ENDED at 19307ms, muted again at 19327ms, playing again at
    // 19330ms. Excluded HERE ONLY: during 'unmuting' a pause really is WebKit
    // refusing, which is what retreat() exists for, so that branch is untouched.
    // ENDED. Placed AFTER the unmuting branch and BEFORE the done branch so
    // neither changes: the done branch already excluded 0, and during
    // 'unmuting' a stop really is a refusal for retreat() to answer.
    if(st===0){ fireEnd(); return; }
    if(phase==='done'&&st!==1&&st!==3&&st!==0&&st!==2&&muted===false){ retreat('sound'); }
  }

  function onMsg(e){
    // Exact origin, and the message must come from OUR iframe. An indexOf on
    // "youtube" matches any host containing it and lets any frame drive this.
    if(e.origin!==EMBED&&e.origin!=='https://www.youtube.com') return;
    if(!player||e.source!==player.contentWindow) return;
    var d=e.data;
    if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(_){ return; } }
    if(!d||typeof d!=='object') return;
    // "readyToListen" IS NOT AN ANSWER. IT IS THE PLAYER SAYING KNOCK AGAIN.
    //
    // It is the FIRST thing the widget posts back, and it means the exact
    // opposite of what gotFeed was reading it as: the player has not installed
    // its handler yet and the handshake has to be repeated. Setting gotFeed on
    // it killed the repeat interval at line 108 at precisely the moment the
    // player was asking to be knocked at again, so no state ever arrived, the
    // 2600ms watchdog fired, and EVERY RIP ON THIS SITE opened muted under a
    // button reading "Tap to play" over a video that was already playing.
    //
    // The note over that interval already says the rule this broke: "The player
    // installs its message handler well after the iframe fires load, and
    // silently drops anything that arrives before it ... Repeat until it
    // answers." This is what "answers" has to mean.
    //
    // MEASURED: with an extra poller injected from t=0 the feed delivers
    // onReady at 370ms and playerState:1 at 771ms and the button never shows;
    // without one the only message ever received is readyToListen at ~370ms.
    // Answering it immediately, rather than only on the next 200ms tick, is
    // free and takes the common case to the first round trip.
    if(d.event==='readyToListen'){ listen(); return; }
    gotFeed=true;
    if(d.event==='onAutoplayBlocked'){ retreat(phase==='unmuting'?'sound':'play'); return; }
    // onStateChange carries info as a NUMBER; infoDelivery carries an object.
    // Reading only the object shape missed every onStateChange.
    var info=d.info, st=null;
    if(typeof info==='number') st=info;
    else if(info&&typeof info.playerState==='number') st=info.playerState;
    if(info&&typeof info.muted==='boolean') muted=info.muted;
    if(st!==null) onState(st);
  }
  window.addEventListener('message', onMsg);

  /* TEARDOWN, AND IT NEVER EXISTED. attach() adds a window-level message
     listener and arms three timers, and nothing undid any of them. Measured on
     /videos.html: six tiles opened, SIX listeners left behind, each closure
     pinning a dead iframe. An open aborted before the first message also left
     feedTimer posting every 200ms for the life of the page, silently, because
     post() returns early once contentWindow is gone.
     GRPack.open() already tears the previous player down before arming the
     next; the teardown it calls now calls this too, so the listener and the
     timers go with the iframe. */
  root.__packDispose = function(){
    if(feedTimer){ clearInterval(feedTimer); feedTimer=null; }
    clearTimeout(startWatch); clearTimeout(unmuteWatch); clearTimeout(endTimer);
    endTimer=null;
    window.removeEventListener('message', onMsg);
    if(player && player.parentNode) player.parentNode.removeChild(player);
    player=null; mounted=false; phase='dead';
  };

  root.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('.sound-on')) return;
    // A real gesture, so this is always permitted.
    showBtn(false);
    phase='unmuting';
    cmd('unMute'); cmd('setVolume',[100]); cmd('playVideo');
    clearTimeout(unmuteWatch);
    /* AND ARM THE WATCHDOG AGAIN. Without this the phase never left 'unmuting',
       so twenty seconds later ENDED hit the unmuting branch of onState, was read
       as a refusal, and retreat() re-muted and restarted the rip from the top --
       the pre-1-September bug, still live on the one path that reaches it most
       on iOS. It also meant the end card could never fire after a reader had
       tapped for sound. */
    unmuteWatch=setTimeout(function(){
      if(phase!=='unmuting') return;
      if(muted===false) phase='done';
      else retreat('sound');
    },900);
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
    /* THE END CARD'S OWN CONTROLS ARE NOT TILES. Its NEXT PACK carries a real
       .pack facade so the reader sees the next set's wrapper, and that made it
       match the artwork test above: on all 330 rip pages the link was swallowed
       here and a player was mounted INSIDE the card, on a page whose h1 and hit
       cards still described the finished rip. Where the card means to advance
       in place it uses a <button> and never reaches this handler at all. */
    if (a.closest(".rip-end")) return;
    var m = VID.exec(a.getAttribute("href") || "");
    if (!m) return;                       // not a rip url; leave it alone
    e.preventDefault();
    /* OPT IN, PAGE BY PAGE, rather than sweeping every grid on the site into
       the overlay. The home page plays in place at the owner's explicit
       request, and the rip-page rails are thousands of tiles on pages that
       already carry a full-size player above them; neither wants this. The
       collection grids do: .wall--lib is /videos.html's own grid, and playlist
       pages carry data-riplb. */
    if (a.closest(".wall--lib, [data-riplb]")) playInOverlay(a, m[1]);
    else playInTile(a, m[1]);
  }

  /* ONE COPY OF THE PLAYER MARKUP, spent by the tile path and the overlay path.
     It was inline in playInTile and the overlay needed the identical nodes:
     attach() finds .pack, .sound-on and .pack-player by selector, so two
     hand-kept copies would be two chances for one of them to drift out of
     attach()'s reach silently. */
  function buildHost(id, title, skin, cls, dur) {
    var host = document.createElement("div");
    host.className = cls;
    host.innerHTML =
      '<div class="rip-player pack-player" data-id="' + id + '" data-dur="' +
        (Number(dur) || 0) + '" data-title="' +
        title.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '">' +
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
    return host;
  }

  var lb = null, lbOpener = null, lbPushed = false, lbInerted = [];

  /* EVERY TOP-LEVEL NODE BUT THE OVERLAY, NOT JUST #main. On /videos.html the
     search box and both filter rails live in <section class="libtools">, which
     is a SIBLING of <main> and not inside it -- deliberately, for the landmark
     structure -- and the sticky bar, the nav and the footer are outside it too.
     Inerting only #main therefore left every one of those tabbable behind a 94%
     opaque scrim, with the focus ring painting UNDER it. Only what this turned
     on gets turned off again, so a node something else inerted stays inert. */
  function inertPage(on) {
    if (on) {
      lbInerted = [];
      [].forEach.call(document.body.children, function (n) {
        if (n === lb || n.inert) return;
        n.inert = true;
        lbInerted.push(n);
      });
    } else {
      lbInerted.forEach(function (n) { n.inert = false; });
      lbInerted = [];
    }
  }

  /* ONE NODE PER PAGE, FILLED ON CLICK -- the same argument shared/lightbox.mjs
     makes, and stronger here: /videos.html carries 96 tiles and at most one of
     them is ever open. */
  function ensureLb() {
    if (lb) return lb;
    lb = document.createElement("div");
    lb.className = "rip-lb";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    /* LIKING CANNOT HAPPEN IN THE EMBED, so this is a way out to where it can.
       Checked against both APIs rather than assumed: the IFrame Player API
       documents thirteen methods and not one of them rates a video (every
       "rate" in its reference is playbackRate), and the Data API's videos.rate
       needs OAuth with the youtube or youtube.force-ssl scope -- a viewer
       signing in and granting this site control of their YouTube account, for a
       thumbs up. So the honest affordance is a link. It lives in the bar rather
       than under the video because a 9:16 player is height-bound: every pixel
       of chrome above or below it costs 0.5625px of WIDTH, and the bar is
       already there. On a phone this hands off to the YouTube app, where the
       viewer is signed in already. */
    lb.innerHTML =
      '<div class="rip-lb-bar">' +
        '<a class="rip-lb-like" href="https://www.youtube.com/" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 22V10l4.2-7 1.4 1a2 2 0 0 1 .7 2.2L12.4 9h5.2a2 2 0 0 1 2 2.4l-1.5 8.1a2 2 0 0 1-2 1.5H7zM2 22h3V10H2z"/></svg>' +
          "<span>Like on YouTube</span>" +
        "</a>" +
        '<button class="rip-lb-x" type="button" aria-label="Close the video">&times;</button>' +
      "</div>";
    lb.addEventListener("click", function (e) {
      // The scrim closes, the video does not. Anything inside .rip-player is
      // the player itself and its own controls.
      if (e.target === lb || e.target.closest(".rip-lb-x")) closeLb();
    });
    document.body.appendChild(lb);
    return lb;
  }

  /* A REAL CYCLING TRAP, NOT .img-lb's "refuse Tab". That refusal is honest
     where the overlay holds exactly one control; here it holds a close button
     AND a YouTube iframe, and refusing Tab would make the player's own controls
     unreachable by keyboard -- a WCAG 2.1.2 keyboard trap in the name of a
     focus trap. */
  function lbFocusables() {
    return [].slice
      .call(lb.querySelectorAll('button, iframe, a[href], [tabindex]:not([tabindex="-1"])'))
      .filter(function (n) {
        if (n.hidden || n.offsetParent === null) return false;
        // The finished player is hidden under the end card. It keeps its
        // offsetParent, so without this it stayed in the wrap-around arithmetic
        // as a stop the browser will never actually give focus to.
        return getComputedStyle(n).visibility !== "hidden";
      });
  }

  function onLbKey(e) {
    if (e.key === "Escape") { e.preventDefault(); closeLb(); return; }
    if (e.key !== "Tab") return;
    var f = lbFocusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function closeLb() {
    if (!lb || lb.hidden) return;
    closeAll();                       // disposes the player: iframe, listener, timers
    /* BELT AND BRACES THAT USED TO LEAK. If closeAll() ever fails to dispose
       this host -- live nulled, or pointing at another root because something
       else called GRPack.open -- removing the node alone strands the window
       message listener and all three timers, which is the exact leak the
       teardown was written to close. Dispose first, and sweep EVERY stage, not
       just the first, so a stray second host cannot be left live in a hidden
       overlay. */
    [].forEach.call(lb.querySelectorAll(".rip-stage"), function (h) {
      if (h.__packDispose) h.__packDispose();
      if (h.parentNode) h.parentNode.removeChild(h);
    });
    lb.hidden = true;
    document.removeEventListener("keydown", onLbKey, true);
    document.body.style.overflow = "";
    inertPage(false);
    if (lbOpener && lbOpener.focus) lbOpener.focus();
    lbOpener = null;
    // Back is how a phone dismisses a full-screen thing. We pushed a state with
    // NO url change, so going back costs nothing and never publishes a second
    // address for a page that already has a canonical one.
    if (lbPushed) { lbPushed = false; history.back(); }
  }

  window.addEventListener("popstate", function () {
    if (lb && !lb.hidden) { lbPushed = false; closeLb(); }
  });

  /* THE STAGE, SEPARATED FROM THE OVERLAY AROUND IT, so that advancing to the
     next rip can replace what is playing without touching the dialog.
     ADVANCING MUST NOT CLOSE AND REOPEN: closeLb() calls history.back() and
     refocuses the opener, so a close/reopen cycle pushes a second history
     state and throws focus out of the dialog it is about to re-enter. */
  function mountOverlayStage(a, id) {
    var t = readTile(a);
    lb.setAttribute("aria-label", t.title || "Rip");
    var like = lb.querySelector(".rip-lb-like");
    if (like) {
      like.href = "https://www.youtube.com/watch?v=" + id;
      like.setAttribute(
        "aria-label",
        "Like " + (t.title || "this rip") + " on YouTube. Opens YouTube in a new tab."
      );
    }
    var host = buildHost(id, t.title, t.skin, "rip-stage", t.secs);
    /* 16:9 FOR THE ONE HORIZONTAL RIP. There is exactly one -- kj7532tb0_I, the
       Costco Charizard UPC drop -- and an earlier version of this comment said
       "the dozen", which was wrong by twelve. Without the marker that video
       mounted letterboxed in a 9:16 frame: 375x211 of picture inside 375x667,
       which is the fault ui.css's own 16:9 rule was written to prevent.
       IT SAID "the same class build-pages.mjs gives its page" AND THAT IS NOT
       TRUE: that video is in OVERRIDES as pillarboxed, so its own page gets
       rip-player--crop and only the overlay goes wide. */
    if (a.closest("[data-wide]")) host.querySelector(".rip-player").classList.add("rip-player--wide");
    lb.appendChild(host);

    open(host, function () {
      if (host.__packDispose) host.__packDispose();
      if (host.parentNode) host.parentNode.removeChild(host);
    });
    attach(host);
    armEndCard(host, function () {
      return payloadFor(
        t,
        function () { return stepCells(a.closest("article.v"), "article.v", "a.art"); },
        advanceOverlay
      );
    });
    /* MOUNT INSIDE THE GESTURE. Everything above is synchronous on purpose:
       the iframe has to be created while the user's click is still live or the
       mute-then-unmute handshake loses its exemption and the rip comes up
       silent under YouTube's own button. Nothing may be awaited before this.
       That holds for an advance from the end card too -- its tap is the
       gesture that buys the next rip its sound. */
    var pk = host.querySelector(".pack");
    if (pk) pk.click();
    /* ALWAYS, NOT ONLY ON A KEYBOARD OPEN. This read `if (byKeyboard)`, copied
       from focusPlayer() on rip pages where focus legitimately stays on the
       page. In a modal it does not transfer: Safari and iOS Safari do not focus
       a link on tap, so byKeyboard was false on the platform this whole feature
       was built for, and inertPage() had just blurred the anchor -- leaving
       activeElement on <body>, outside a dialog that claims aria-modal. A
       screen reader then had no reason to enter it. */
    var x = lb.querySelector(".rip-lb-x");
    if (x) x.focus();
  }

  /* Swap the playing rip for the next one, in the dialog that is already open. */
  function advanceOverlay(nx) {
    if (!lb || lb.hidden || !nx) return;
    var m = VID.exec(nx.getAttribute("href") || "");
    if (!m) return;
    [].forEach.call(lb.querySelectorAll(".rip-stage"), function (h) {
      if (h.__packDispose) h.__packDispose();
      if (h.parentNode) h.parentNode.removeChild(h);
    });
    // Closing later must return the reader to the tile they are ACTUALLY
    // watching, not the one they started from three rips ago.
    lbOpener = nx;
    mountOverlayStage(nx, m[1]);
  }

  function playInOverlay(a, id) {
    ensureLb();
    lbOpener = a;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    inertPage(true);
    document.addEventListener("keydown", onLbKey, true);
    try { history.pushState({ riplb: 1 }, ""); lbPushed = true; } catch (err) { lbPushed = false; }
    mountOverlayStage(a, id);
  }

  function playInTile(a, id) {
    // WAS THIS A KEYBOARD ACTIVATION? It has to be asked HERE, before the
    // anchor is replaced. attach() already does the right thing on a rip page:
    // it notices the pack had focus and moves focus onto the iframe afterwards.
    // From a tile that check always saw false, because the anchor had already
    // been swapped out and focus had fallen to <body>. So every keyboard user
    // who played a video from a tile lost their place on the page.
    var byKeyboard = document.activeElement === a || a.contains(document.activeElement);
    /* THE TILE IS READ HERE, BEFORE THE SWAP. slot.replaceChild detaches this
       anchor, and a detached node's closest("article") is null, so every fact
       the end card prints would come back empty if this ran later. */
    var endT = readTile(a);
    // The set comes from the image filename where there is an image, and from
    // the facade's own pack--<set> class where there is not. Falling back to
    // "default" for the CSS tiles would have given every rip on /videos.html
    // the generic green wrapper instead of its own.
    /* ONE READER, because there were two and only one of them was fixed. A
       carousel slide the track has not shown yet has NO src, only data-packsrc,
       so this returned "default" and the end card's own thumbnail (which does
       read data-packsrc) disagreed with the pack that actually tore open. */
    var skin = skinOf(a);
    var slot = a.parentNode;
    // The .hofx spotlight takes its accessible name from its contents rather
    // than an aria-label, so this produced title="" and the YouTube iframe went
    // out unnamed. Fall back to whatever the card calls the rip.
    var titleEl = a.querySelector(".hofx-t, .hero-body h3, h3");
    var title = (a.getAttribute("aria-label") || (titleEl ? titleEl.textContent : "") || "")
      .replace(/^Play\s+/, "")
      .trim();

    var host = buildHost(id, title, skin, "rip-stage tile-stage", endT.secs);

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
        // Kill the listener, the timers and the iframe BEFORE the DOM swap:
        // once host is detached the dispose still works, but doing it first
        // means the iframe never lingers on a node nobody can see.
        if (host.__packDispose) host.__packDispose();
        if (!shell.parentNode) return;
        if (host.parentNode === shell) shell.replaceChild(artBox, host);
        while (shell.firstChild) a.appendChild(shell.firstChild);
        shell.parentNode.replaceChild(a, shell);
      });
      slot.replaceChild(shell, a);
      attach(host);
      armEndCard(host, function () {
        return payloadFor(endT, function () { return nextFromTile(host); }, advanceTile);
      });
      var pk0 = host.querySelector(".pack");
      if (pk0) pk0.click();
      if (byKeyboard) focusInto(host);
      return;
    }

    // Whatever is already playing goes back to being a tile first. One embed is
    // ~540KB; a page that accumulated them would get heavier with every click.
    open(host, function () {
      if (host.__packDispose) host.__packDispose();
      if (host.parentNode) host.parentNode.replaceChild(a, host);
    });
    slot.replaceChild(host, a);

    attach(host);
    armEndCard(host, function () {
      return payloadFor(endT, function () { return nextFromTile(host); }, advanceTile);
    });
    // The pack's own handler runs the shake, the tear and the mount. Calling it
    // from inside this click keeps the user gesture alive, which is what buys
    // unmuted playback a moment later.
    var pk = host.querySelector(".pack");
    if (pk) pk.click();
    if (byKeyboard) focusInto(host);
  }

  /* ADVANCE BY REPLAYING THE REAL CLICK PATH. Synchronous, so the next iframe
     is created while the end card's tap is still live and the rip comes up with
     sound. open() tears the finished player down as the next one arms. */
  function advanceTile(nx) {
    if (!nx) return;
    var m = VID.exec(nx.getAttribute("href") || "");
    if (!m) return;
    var slide = nx.closest(".vcar-slide");
    playInTile(nx, m[1]);
    /* AND BRING IT ON SCREEN, strictly AFTER the mount. offsetParent only knows
       about display:none, so a slide sitting off the right edge of the track
       counted as visible and the rip played out of sight with its audio running.
       Nothing may come between the click and the iframe, so this runs last. */
    if (slide && slide.scrollIntoView) {
      try { slide.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }
      catch (err) { slide.scrollIntoView(); }
    }
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
   * THE END CARD.
   *
   * Everything it prints is already in the tile that was clicked. Nothing is
   * fetched and nothing is computed that the page did not already know, which
   * is what makes it free on a page carrying hundreds of tiles.
   *
   * NO AUTO-ADVANCE, AND THIS IS THE LOAD-BEARING DECISION. An iframe created
   * without a live user gesture may autoplay MUTED ONLY. Auto-advancing would
   * therefore land the next rip silent under YouTube's own unmute button --
   * precisely the symptom the mute-then-unmute handshake at the top of this
   * file exists to prevent, across every page that carries a player. It would
   * be reintroducing a fixed bug as a feature. It would also chain a viewer
   * five 20-second videos deep in under two minutes with no memory of choosing
   * any of them, and it would skip the tear, which is the product.
   *
   * So the cure for "nothing happens" is ONE TAP, NOT ZERO. Tapping NEXT PACK
   * advances the deck and rips it in the same gesture, and because that gesture
   * is real the sound is granted. End of video to next video playing with audio
   * is one tap: as fast as autoplay, without surrendering either the tear or
   * the sound.
   */
  function eshtml(v){
    return String(v==null?'':v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function fmtDur(secs){
    secs=Math.max(0,Math.round(Number(secs)||0));
    return Math.floor(secs/60)+':'+('0'+(secs%60)).slice(-2);
  }

  /* A pack facade with no button around it. buildHost's is a <button> because
     it is the thing you rip; this one is decoration inside a bigger control,
     and a button inside a button is invalid markup that browsers repair by
     splitting the outer one. */
  function packFacade(skin, cls){
    return '<span class="pack pack--'+eshtml(skin||'default')+' '+cls+'" aria-hidden="true">'+
      '<span class="pack-face pack-l"><span class="pack-art"></span></span>'+
      '<span class="pack-face pack-r"><span class="pack-art"></span></span>'+
    '</span>';
  }

  function buildEndCard(d){
    var el=document.createElement('div');
    el.className='rip-end';
    el.setAttribute('role','group');
    el.setAttribute('aria-label','This rip has finished');
    var h='';
    if(d.kick) h+='<p class="rip-end-kick">'+eshtml(d.kick)+'</p>';
    if(d.title) h+='<p class="rip-end-t">'+eshtml(d.title)+'</p>';
    h+='<hr class="rip-end-rule">';
    if(d.next){
      /* NO aria-label HERE. It overrode the visible words with a different
         string, which is WCAG 2.5.3 Label in Name: a reader saying "Next pack
         Pitch Black Pack 12" could not activate a control named after the
         YouTube title instead. The contents are the name. */
      var opener=d.onNext
        ? '<button class="rip-end-next" type="button">'
        : '<a class="rip-end-next" href="'+eshtml(d.next.href||'#')+'">';
      h+=opener+
        packFacade(d.next.skin,'rip-end-pack')+
        '<span>'+
          '<span class="rip-end-next-lab">Next pack</span>'+
          '<span class="rip-end-next-name">'+eshtml(d.next.name||d.next.title||'')+'</span>'+
          (d.next.meta?'<span class="rip-end-next-meta">'+eshtml(d.next.meta)+'</span>':'')+
        '</span>'+
      (d.onNext?'</button>':'</a>');
    }
    h+='<div class="rip-end-acts">'+
        '<button class="rip-end-act rip-end-again" type="button">Watch again</button>'+
        (d.href?'<a class="rip-end-act rip-end-full" href="'+eshtml(d.href)+'">Full rip page</a>':'')+
      '</div>';
    if(d.rows&&d.rows.length){
      h+='<div class="rip-end-rows">';
      for(var i=0;i<d.rows.length;i++){
        var r=d.rows[i];
        if(!r||!r.href) continue;
        h+='<a class="rip-end-row" href="'+eshtml(r.href)+'">'+
            '<span class="rip-end-rl">'+eshtml(r.label)+': <span class="rip-end-rv">'+eshtml(r.value)+'</span></span><span class="rip-end-ra" aria-hidden="true">&rarr;</span>'+
          '</a>';
      }
      h+='</div>';
    }
    /* WRAPPED, AND THE WRAPPER IS THE FIX FOR A REAL BUG. A flex column with
       justify-content:center that overflows is clipped at BOTH ends, and the
       top overflow is UNREACHABLE -- no scrollbar reaches it. The card's own
       title was rendered, present in the DOM, and invisible. margin:auto on an
       inner box centres when there is room and simply starts at the top when
       there is not. */
    el.innerHTML='<div class="rip-end-in">'+h+'</div>'+
      '<p class="rip-end-say" role="status" aria-live="polite"></p>';
    return el;
  }

  /* Shown INSIDE .rip-player, which is position:relative and overflow:hidden,
     so the card is clipped to the frame and needs no sizing of its own. */
  /* THE FINISHED PLAYER IS HIDDEN WHILE THE CARD IS UP, and this fixes two
     faults at once. It was still tabbable underneath: measured 8 to 14 blind Tab
     stops on YouTube's own controls beneath a 94% scrim, with no visible focus
     anywhere, and Escape dead the whole time because a cross-origin iframe never
     lets the document's keydown listener see the key. And .94 is not opaque
     enough to hide YouTube's chrome -- the scrubber and the fullscreen button
     ghosted through onto the card's own rows. visibility:hidden removes it from
     the tab order and from view without pausing or unloading anything. */
  function showFrame(pl,on){
    var f=pl.querySelector('iframe');
    if(!f) return;
    f.style.visibility=on?'':'hidden';
    if(on) f.removeAttribute('tabindex'); else f.setAttribute('tabindex','-1');
  }

  function showEndCard(host,d){
    var pl=host.querySelector('.rip-player');
    if(!pl||pl.querySelector('.rip-end')) return;
    var card=buildEndCard(d);

    /* SIZE THE CARD OFF THE PLAYER, NEVER OFF THE VIEWPORT. A media query cannot
       see this: on a portrait phone the viewport is 812px tall while a rail
       tile's player is 247, so `@media (max-height:420px)` was FALSE in exactly
       the cases it was written for and fired in none of them. Measured on a rip
       page rail tile: 509px of card in a 247px frame, NEXT PACK sliced through
       the middle. The three families differ by a factor of three -- overlay
       375x667, home tile ~309x464, rail tile ~136x247 -- so the card sheds
       content by tier and NEXT PACK is the last thing standing, because it is
       the whole feature. */
    var ph=pl.clientHeight||0, pw=pl.clientWidth||0;
    if(ph<340||pw<200) card.className+=' rip-end--tiny';
    else if(ph<520) card.className+=' rip-end--tight';

    pl.appendChild(card);
    showFrame(pl,false);

    // Announced without stealing focus. Deferred one tick because a live region
    // inserted with its text already in it is not reliably reported as a change.
    var say=card.querySelector('.rip-end-say');
    if(say) setTimeout(function(){
      say.textContent='Rip finished.'+(d.next?(' Next pack: '+(d.next.name||d.next.title||'')+'.'):'');
    },80);

    var again=card.querySelector('.rip-end-again');
    if(again) again.addEventListener('click',function(){
      card.remove();
      showFrame(pl,true);
      if(host.__endReset) host.__endReset();
      if(host.__replay) host.__replay();
      /* FOCUS WOULD OTHERWISE FALL TO <body>, which in the overlay is outside an
         aria-modal dialog whose every sibling is inert -- a screen reader's
         cursor resets to the top of the document. */
      var f=pl.querySelector('iframe');
      if(f) try{ f.focus({preventScroll:true}); }catch(err){}
    });

    var nx=card.querySelector('.rip-end-next');
    if(nx&&typeof d.onNext==='function') nx.addEventListener('click',function(e){
      /* SYNCHRONOUS, INSIDE THE CLICK. The next player's iframe has to be
         created while this gesture is still live or the handshake loses its
         exemption and the rip comes up silent. Nothing may be awaited here. */
      d.onNext(e);
    });

    /* MOVE FOCUS ONLY IF IT WAS ALREADY IN THE PLAYER. A video ending is not a
       reason to yank focus away from someone reading further down the page;
       it IS a reason to hand the keyboard the next control when they were
       watching. */
    /* "Was the reader watching?" is the question, and in the overlay the answer
       is yes while focus sits on the dialog's own close button -- which is not
       inside the host, so this never fired in the context the feature was built
       for. The lightbox counts as watching. */
    var ae=document.activeElement;
    var lbOpen=lb&&!lb.hidden&&lb.contains(host);
    var inside=ae&&(ae===host||host.contains(ae)||(lbOpen&&lb.contains(ae)));
    if(inside){
      var first=card.querySelector('.rip-end-next,.rip-end-again');
      if(first) try{ first.focus({preventScroll:true}); }catch(err){ first.focus(); }
    }
  }

  /* READING A TILE.
   *
   * Mapped against the BUILT tree rather than the builders, because the two
   * disagree in ways that matter. Five families emit a playable tile and no
   * two of them carry the same facts in the same place:
   *
   *   index .hero-art   set in .hero-meta, aria-label has ", 0:29" APPENDED
   *   index .hofx       set in .hofx-m, no aria-label at all
   *   videos .art       set in .pack-brand, and RE-RENDERED IN THE BROWSER
   *   playlists .art    set in .pack-brand, which reads "multi" on 10 tiles
   *   rip .vid-shell    set in .pack-brand, 3,109 of them
   *
   * Duration and views used to be display text in four different shapes, and
   * absent entirely on the 3,109 rip-rail tiles. Every emitter now writes
   * data-dur and data-views instead, so this reads two numbers rather than
   * parsing "1.4K VIEWS" out of a sentence. The display spans are untouched.
   */
  var SEG=/\s*[•·]\s*/;

  function segs(el){
    if(!el) return [];
    return el.textContent.split(SEG).map(function(t){ return t.trim(); }).filter(Boolean);
  }

  function fmtViews(n){
    n=Number(n)||0;
    if(n>=1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'')+'M views';
    if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'K views';
    return n+(n===1?' view':' views');
  }

  /* Same order as playInTile: the image filename first, the facade class
     second. The class alone would be wrong on .hero-art and .hofx, which carry
     no .pack at all, and the image alone is wrong on every tile /videos.html
     re-renders after a filter, which carries no <img>. */
  function skinOf(a){
    var img=a.querySelector('img');
    var src=img&&(img.getAttribute('src')||img.getAttribute('data-packsrc'))||'';
    var m=SKIN.exec(src);
    if(m) return m[1];
    var facade=a.querySelector('.pack');
    var c=facade&&/pack--(?!tile\b|img\b)([a-z0-9-]+)/.exec(facade.className);
    return c?c[1]:'default';
  }

  function titleOf(a,secs){
    var t=a.getAttribute('aria-label')||'';
    if(!t){
      var el=a.querySelector('.hofx-t, .hero-body h3, h3');
      t=el?el.textContent:'';
    }
    t=t.replace(/^Play\s+/,'').trim();
    /* .hero-art appends ", 0:29" to its own accessible name. Stripping any
       trailing time would eat a real title that happens to end in one, so this
       only strips the EXACT string this tile's own duration produces. */
    if(secs){
      var suf=', '+fmtDur(secs);
      if(t.slice(-suf.length)===suf) t=t.slice(0,-suf.length).trim();
    }
    return t;
  }

  /* The short label under the artwork ("Silver Tempest Pack - Pack 1") reads
     better on the card than the YouTube title, which is written for a feed. */
  function labelOf(a){
    var card=a.closest('article');
    var h=card&&card.querySelector('h3.vid-title > a, h3 > a, .hero-body h3 > a');
    if(h&&h.textContent.trim()) return h.textContent.trim();
    var hof=a.querySelector('.hofx-t');
    return hof?hof.textContent.trim():'';
  }

  function setOf(a){
    var b=a.querySelector('.pack-brand');
    if(b&&b.firstChild&&b.firstChild.nodeValue){
      var v=b.firstChild.nodeValue.trim();
      // "multi" and "GARBAGE RIPS" are placeholders, not set names.
      if(v&&!/^(multi|garbage rips)$/i.test(v)) return v;
    }
    var meta=a.querySelector('.hofx-m');
    if(!meta){
      var card=a.closest('article');
      meta=card&&(card.querySelector('.hero-meta')||card.querySelector(':scope > p'));
    }
    var sg=segs(meta);
    // A one-segment <p> on a set-scoped playlist is the view count, not a set.
    if(sg.length>1) return tidyCase(sg[0]);
    if(sg.length===1&&!/views?$/i.test(sg[0])) return tidyCase(sg[0]);
    return '';
  }

  /* /videos.html prints the product kind in caps as display text; the rip
     rails print it in title case. Shouting on one family and not the other
     reads as a bug in the row beneath "From the set: Silver Tempest". */
  function tidyCase(v){
    if(!v||/[a-z]/.test(v)) return v;
    return v.toLowerCase().replace(/\b[a-z]/g,function(c){ return c.toUpperCase(); });
  }

  function kindOf(a){
    var card=a.closest('article');
    var k=card&&card.querySelector('.vid-kind');
    if(k&&k.textContent.trim()) return tidyCase(k.textContent.trim());
    var pp=card&&card.querySelector(':scope > p');
    var sg=segs(pp);
    if(sg.length>1&&!/views?$/i.test(sg[0])) return tidyCase(sg[0]);
    return '';
  }

  /* Everything the card prints about ONE tile. */
  function readTile(a){
    if(!a) return null;
    var m=VID.exec(a.getAttribute('href')||'');
    var secs=Number(a.getAttribute('data-dur')||0);
    var views=Number(a.getAttribute('data-views')||0);
    var skin=skinOf(a);
    return {
      el:a,
      id:m?m[1]:'',
      href:a.getAttribute('href')||'',
      title:titleOf(a,secs),
      name:labelOf(a)||titleOf(a,secs),
      set:setOf(a),
      kind:kindOf(a),
      skin:skin,
      secs:secs,
      views:views
    };
  }

  /* The kicker prints only what this family actually has. A tile with no view
     count says so by omission rather than by printing a zero. */
  function kickerFor(t){
    var out=[];
    if(t.set) out.push(t.set.toUpperCase());
    if(t.secs) out.push(fmtDur(t.secs));
    if(t.views) out.push(fmtViews(t.views).toUpperCase());
    return out.join(' · ');
  }

  function rowsFor(t){
    var rows=[];
    // The skin slug IS the set slug wherever a real set was drawn, which is
    // what /videos.html filters on. "default" and "multi" are not sets.
    if(t.set&&(t.setHref||(t.skin&&!/^(default|multi)$/.test(t.skin))))
      rows.push({label:'From the set',value:t.set,href:t.setHref||('/videos.html?set='+t.skin)});
    if(t.kind)
      rows.push({label:'Opening type',value:t.kind,href:'/videos.html'});
    return rows;
  }

  /* WHICH VIDEO IS NEXT.
   *
   * Every one of these was measured against the built tree, and the obvious
   * answer was wrong in three of the four contexts.
   *
   * NOT nextElementSibling ON THE ANCHOR. A tile's <a> is the first child of an
   * <article>, and its next sibling is the <h3> holding the SAME rip's title
   * link. A naive walk "advances" to the video that just finished. Step at the
   * CELL level instead.
   *
   * NOT THE FIRST TILE OF THE BOX RAIL. build-pages.mjs selects that rail
   * next-packs-first and then re-sorts it into PACK ORDER for display, so tile
   * zero is usually an EARLIER pack. Counted over the 249 pages carrying a box
   * rail: 207 have a later pack available and tile zero is the honest next on
   * only 99 of them. It is wrong about half the time. Pick by pack number.
   *
   * NOT A HIDDEN SLIDE. Below 545px the home page hides every carousel slide
   * but the first and hides the arrows with them, so there are exactly two
   * playable tiles on the whole page. Advancing into a display:none slide
   * mounts a ~540KB embed in an invisible box: audio playing, nothing on
   * screen, and no way to reach it.
   *
   * AND WHERE THERE IS NO NEXT, THERE IS NO CONTROL. The card drops NEXT PACK
   * entirely rather than falling back to pack--default. The promise is a real
   * sealed pack in the next rip's own skin; a generic green wrapper is a claim
   * about which set is next, and it would be false. */
  function visibleEl(n){ return !!(n&&n.offsetParent!==null); }

  function playable(a){
    return !!(a&&(a.querySelector('img')||a.querySelector('.pack')));
  }

  function stepCells(cell,cellSel,linkSel){
    for(var n=cell&&cell.nextElementSibling;n;n=n.nextElementSibling){
      if(!n.matches||!n.matches(cellSel)) continue;
      var link=n.querySelector(linkSel);
      if(link&&playable(link)&&visibleEl(n)) return link;
    }
    return null;
  }

  function nextOnHome(host){
    var slide=host.closest&&host.closest('.vcar-slide');
    // Inside a track: the next slide the reader can actually see. Running off
    // the end of a band does NOT jump to another band -- that reads as random.
    if(slide) return stepCells(slide,'.vcar-slide','a.hero-art');
    // The trophy is not in a track at all. It hands off to the first visible
    // slide on the page, which on a phone is Latest rips slide 0 and is the
    // whole mechanism there.
    var slides=document.querySelectorAll('.vcar-slide');
    for(var i=0;i<slides.length;i++){
      var link=slides[i].querySelector('a.hero-art');
      if(link&&playable(link)&&visibleEl(slides[i])) return link;
    }
    return null;
  }

  /* The rip page's own hero. Two rail shapes, and the pack number is the only
     honest ordering. Both title forms seen in the tree are covered:
     "…, pack 5" and "… Pack #9". */
  function nextOnRipPage(){
    var meta=document.querySelector('main .rip-meta');
    var m=meta&&/(?:,\s*pack\s*|pack\s*#)(\d+)/i.exec(meta.textContent||'');
    var cur=m?Number(m[1]):null;
    var heads=document.querySelectorAll('section.band .sec-head h2');
    var boxGrid=null,setGrid=null;
    for(var i=0;i<heads.length;i++){
      var sec=heads[i].closest('section.band');
      var g=sec&&sec.querySelector('.vid-grid');
      if(!g) continue;
      if(/^More from\b/.test(heads[i].textContent)) boxGrid=boxGrid||g;
      else if(/^More\b/.test(heads[i].textContent)) setGrid=setGrid||g;
    }
    if(boxGrid&&cur!==null){
      var best=null,bestN=Infinity;
      var tiles=boxGrid.querySelectorAll('article.vid');
      for(var j=0;j<tiles.length;j++){
        var t=tiles[j].querySelector('.vid-title a');
        var n=t&&/^Pack (\d+)$/.exec(t.textContent.trim());
        if(!n) continue;
        // Pack numbers are NOT unique here: boxOf() groups on a label prefix,
        // so two physical boxes sharing a label collide and 69 of 249 rails
        // carry a duplicate. First in DOM order wins, which is pack order.
        if(Number(n[1])>cur&&Number(n[1])<bestN){
          bestN=Number(n[1]);
          best=tiles[j].querySelector('a.vid-shell');
        }
      }
      if(best) return best;
    }
    // No later pack in the box (42 of 249), or no box rail (66 pages). The set
    // rail is a good "more like this" and a bad "next", but it is a real rip in
    // the same set and it is the best thing left.
    if(setGrid) return setGrid.querySelector('a.vid-shell');
    return null;
  }

  function nextFromTile(host){
    if(host.closest('.vcar-slide')||host.closest('.hofx')) return nextOnHome(host);
    var cell=host.closest('article.vid');
    if(cell) return stepCells(cell,'article.vid','a.vid-shell');
    cell=host.closest('article.v');
    if(cell) return stepCells(cell,'article.v','a.art');
    return null;
  }

  /* Assemble the card's data for a tile that is about to play, given a function
     that says what follows it. */
  function payloadFor(t,nextFn,advance){
    var nx=null;
    try{ nx=nextFn?nextFn():null; }catch(err){ nx=null; }
    var nd=nx?readTile(nx):null;
    return {
      kick:kickerFor(t),
      title:t.name||t.title,
      href:t.href,
      rows:rowsFor(t),
      next:nd?{
        title:nd.title,
        name:nd.name||nd.title,
        skin:nd.skin,
        href:nd.href,
        meta:[nd.set,nd.secs?fmtDur(nd.secs):''].filter(Boolean).join(' · ')
      }:null,
      onNext:(nd&&advance)?function(){ advance(nx); }:null
    };
  }

  /* The contract every context uses: give the host its data, and it will show
     the card when the video ends however that is detected. */
  function armEndCard(host,build){
    if(typeof build!=='function') return;
    host.__onEnd=function(){
      /* THE RENDER IS INSIDE THE GUARD TOO. A throw in buildEndCard escaped
         through fireEnd into the message listener, and `ended` was already
         latched, so the failure was permanent AND silent -- the exact "nothing
         happens when it ends" this feature exists to remove. */
      try{
        var d=build();
        if(d) showEndCard(host,d);
      }catch(err){}
    };
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
    // DISABLING THE BUTTON THE KEYBOARD IS STANDING ON THROWS FOCUS TO <body>.
    //
    // Press Enter on Next until the track reaches the end and this line sets
    // disabled on the element that currently holds focus. A disabled control is
    // not focusable, so the browser drops focus to the document and the reader
    // is silently returned to the top of the page from the middle of a band.
    // Reproduced at 1280 (on the third press) and at 768 (on the fourth); the
    // prev arrow at scrollLeft 0 has the identical shape.
    //
    // So hand focus to the OTHER arrow before disabling this one, and only when
    // this one actually has it. That keeps the reader inside the band they are
    // operating and on a control that is still live, which is the one the run
    // has moved them toward anyway. If both ends are spent the bar is
    // .is-static and hidden, and there is nothing to hand focus to.
    var moveFocus = function (dying, alive) {
      if (!dying || dying.disabled) return;
      if (document.activeElement !== dying) return;
      if (alive && !alive.disabled) alive.focus();
    };
    var atStart = track.scrollLeft <= 2;
    var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    if (prev && atStart) moveFocus(prev, next);
    if (next && atEnd) moveFocus(next, prev);
    if (prev) prev.disabled = atStart;
    if (next) next.disabled = atEnd;
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
  /* THE RIP PAGE'S OWN HERO gets an end card too, and it is armed here rather
     than in the inline script build-pages.mjs writes, so 330 pages did not have
     to change to gain it. attach() is called by that script; this only sets the
     hook it reads when the video ends, and the order of the two does not
     matter.

     ITS NEXT CONTROL IS A LINK, NOT AN ADVANCE. Everything else on this page --
     the h1, the hit cards, the description, the source card -- is about the
     hero video. Swapping the hero underneath all of it would leave the page
     describing something that is no longer playing, which is a worse lie than
     the extra tap costs. In a grid or the overlay there is no such surrounding
     claim, so those advance in place. */
  function readRipPage() {
    var pl = document.getElementById("player");
    if (!pl) return null;
    var h1 = document.querySelector("main h1");
    var crumb = document.querySelector(".crumbs a[href*=\"set=\"]");
    var pack = document.querySelector("#player .pack");
    var c = pack && /pack--(?!tile\b|img\b)([a-z0-9-]+)/.exec(pack.className);
    var meta = document.querySelector("main .rip-meta");
    var sg = segs(meta);
    return {
      id: pl.getAttribute("data-id") || "",
      // No "Full rip page" link here: this IS the full rip page. buildEndCard
      // omits the control when there is no href.
      href: "",
      title: (h1 ? h1.textContent : pl.getAttribute("data-title") || "").trim(),
      name: (h1 ? h1.textContent : pl.getAttribute("data-title") || "").trim(),
      // The breadcrumb carries the SET; .rip-meta's first segment is the BOX
      // ("Pitch Black ETB 1, pack 3"), which is a different fact.
      set: crumb ? crumb.textContent.trim() : (sg.length ? sg[0] : ""),
      setHref: crumb ? crumb.getAttribute("href") : "",
      kind: "",
      skin: c ? c[1] : "default",
      secs: Number(pl.getAttribute("data-dur") || 0),
      views: Number(pl.getAttribute("data-views") || 0)
    };
  }

  function armRipPage() {
    var stage = document.querySelector(".rip-stage");
    if (!stage || !document.getElementById("player")) return;
    var t = readRipPage();
    if (!t) return;
    armEndCard(stage, function () {
      return payloadFor(t, nextOnRipPage, null);
    });
  }

  function boot() { wireCarousels(); armRipPage(); }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
