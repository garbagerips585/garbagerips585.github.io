/* One quiz engine, three games.
 *
 * Who's That Pokemon, Guess the Set and the trivia all ask the same shape of
 * question: show something, offer four answers, say whether you got it. Three
 * separate implementations would be three sets of the same timer, streak and
 * scoring bugs, so each page supplies a `source` and this drives it.
 *
 * DESIGNED FOR A QUEUE, WHICH IS A REAL CONSTRAINT AND NOT A THEME.
 * The brief is somebody standing in line to buy cards, on a phone, one thumb,
 * on whatever signal the venue has, who may have to stop the instant the line
 * moves. That rules out several things that would otherwise be obvious:
 *   - No typing. Four tap targets, bottom anchored, thumb sized. Typing a
 *     Pokemon name one handed in a line is a chore, not a game.
 *   - No forced timer in the default mode. A countdown you cannot pause
 *     punishes you for the line moving, which is the one thing you are
 *     actually there for. Sprint mode exists for when you want the pressure.
 *   - Nothing to lose by leaving. Best scores are written the moment they
 *     happen, so closing the tab mid question costs you nothing.
 *   - The next image is preloaded during the current question, so the wait for
 *     art never lands in front of the answer.
 * If you change one thing here, keep those four.
 *
 * PROGRESS IS localStorage AND THAT IS THE WHOLE BACKEND. The site is static on
 * GitHub Pages. There are no accounts, no leaderboard and no server to write
 * to, so a personal best is exactly what can be honestly offered.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS MEASURED IN A HEADLESS RUN ON 16 AUGUST 2026, all fixed here.
 *
 * 1. THE RUN HAD NO SCORE. `score` and `asked` were counted on every answer and
 *    shown only at the end of a sprint, so the default mode, which is the one
 *    the page opens in, displayed nothing but a streak and a best streak. A bot
 *    that answered 24 questions on each of the three games finished with the bar
 *    reading "1 streak, 2 best" and no trace anywhere that 24 questions had
 *    happened. A counter you cannot see is not progress. The bar now carries the
 *    run tally, so the number on screen moves on every answer.
 *
 * 2. NOTHING RESPONDED WHILE THE RESULT WAS UP. Measured answer-to-next-question
 *    at 390x844: median 1,513ms on Who's That Pokemon, 1,543ms on Guess the Set,
 *    1,545ms on the trivia, because a wrong answer holds for 1,500ms and every
 *    control is dead for all of it. In a 60 second sprint that is the difference
 *    between about 38 questions and about 75. The hold is right, because the
 *    note under a wrong answer is the part worth reading; making it unskippable
 *    was not. A tap anywhere, or space, enter or an answer key, now moves on.
 *
 * 3. THE BUTTONS WERE `disabled`, WHICH IS WHY 2 COULD NOT BE FIXED NAIVELY. A
 *    click on a disabled button fires no event and bubbles nowhere, so a tap on
 *    the four biggest targets on the screen, which is exactly where a thumb
 *    already is, would have been the one tap that did nothing. They carry
 *    `aria-disabled` now and the `locked` guard in answer() is what actually
 *    stops a second answer, as it always was.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  var pick = function (a) {
    return a[Math.floor(Math.random() * a.length)];
  };

  /* Sample n distinct items from `pool`, never returning `not`. Used for wrong
   * answers, where a duplicate choice or the right answer appearing twice is a
   * broken question rather than a hard one. */
  function distractors(pool, n, not, keyOf) {
    var seen = {};
    seen[keyOf(not)] = 1;
    var out = [];
    var guard = 0;
    while (out.length < n && guard++ < pool.length * 8) {
      var c = pick(pool);
      var k = keyOf(c);
      if (seen[k]) continue;
      seen[k] = 1;
      out.push(c);
    }
    return out;
  }

  var store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* private mode, or the quota is full. The game still plays. */
      }
    },
  };

  /**
   * @param opts.key      localStorage namespace, unique per game
   * @param opts.mount    element to render into
   * @param opts.next     () => { stage, choices:[{label}], answer, note }
   * @param opts.preload  optional (q) => url, fetched during the current question
   * @returns {{destroy:function}} call destroy() before mounting another Quiz
   *          into the same element. See the note on it below: this used to leak.
   */
  function Quiz(opts) {
    var el = opts.mount;
    var sprint = false;
    var streak = 0;
    var score = 0;
    var asked = 0;
    var locked = false;
    var dead = false;
    var q = null;
    var upcoming = null;
    var deadline = 0;
    var tick = null;
    var bestKey = opts.key + ":best";
    var bestSprintKey = opts.key + ":bestSprint";
    /* Set while a result is on screen: calling it skips the rest of the hold and
     * goes straight to the next question. Null the rest of the time, which is
     * what makes "tap to move on" safe to wire to the whole game block. */
    var advance = null;
    /* A tap landing sooner than this is the answering tap itself, arriving at
     * the container a fraction after it left the button. It also swallows an
     * accidental double tap, so a fast thumb cannot skip a question it never
     * saw. Long enough to be the same gesture, short enough that a deliberate
     * second tap always lands. */
    var advanceReadyAt = 0;
    var SKIP_GUARD = 350;
    /* How many more times to show the "tap to keep going" hint. Counted per
     * mount rather than stored, because a returning player has not necessarily
     * seen it and localStorage is already carrying the only thing worth keeping,
     * which is a best score. */
    var hints = 3;

    var dom = {};
    el.innerHTML =
      '<div class="gq">' +
      '<div class="gq-bar">' +
      '<span class="gq-stat"><b data-streak>0</b> streak</span>' +
      // THE RUN TALLY. See point 1 in the header: without this the default mode
      // has no number that moves, and the streak resets to 0 on every miss, so
      // twenty minutes of play could end with the bar reading exactly what it
      // read at the start. Two numbers rather than a percentage, because 3 of 4
      // is a fact and 75% invites a reader to compare it with a pull rate.
      // The word that would make this pill self-explanatory does not fit: the bar
      // is 366px wide on a 390px phone and three pills plus "right" wraps it to
      // two lines, which costs 38px on the one screen where the answer buttons
      // are already 126px off the bottom. So the label is there for a screen
      // reader and inferred by everyone else from the number moving on every
      // answer. .sr-only is ui.css's, used the same way across the site.
      '<span class="gq-stat gq-run"><b data-score>0</b> of <b data-asked>0</b>' +
      '<span class="sr-only"> answered correctly in this run</span></span>' +
      '<span class="gq-stat gq-best"><b data-best>0</b> best</span>' +
      '<span class="gq-stat gq-clock" data-clock hidden></span>' +
      "</div>" +
      '<div class="gq-stage" data-stage></div>' +
      '<p class="gq-say" data-say role="status" aria-live="polite"></p>' +
      '<div class="gq-choices" data-choices></div>' +
      '<div class="gq-foot">' +
      // The hint for the skip, shown on the first three results of a session and
      // never again. A cue that appears and disappears under the answers every
      // single question is visual noise on the one page built to be glanced at,
      // and an interruption nobody is ever told about is a feature only an
      // impatient player finds. Three is enough to teach it.
      '<p class="gq-skip" data-skip hidden aria-hidden="true">Tap anywhere to keep going</p>' +
      '<button class="gq-mode" data-mode type="button">Sprint: 60 seconds</button>' +
      "</div>" +
      "</div>";
    ["streak", "score", "asked", "best", "clock", "stage", "say", "choices", "mode", "skip"].forEach(function (k) {
      dom[k] = el.querySelector("[data-" + k + "]");
    });

    function showBest() {
      dom.best.textContent = store.get(sprint ? bestSprintKey : bestKey, 0);
    }
    function showRun() {
      dom.score.textContent = score;
      dom.asked.textContent = asked;
    }

    function render() {
      if (dead) return;
      q = upcoming || opts.next();
      upcoming = null;
      locked = false;
      advance = null;
      dom.stage.innerHTML = q.stage;
      dom.say.textContent = "";
      dom.say.className = "gq-say";
      dom.choices.innerHTML = "";
      q.choices.forEach(function (c, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "gq-btn";
        b.innerHTML = '<span class="gq-num">' + (i + 1) + "</span>" + c.label;
        b.addEventListener("click", function () {
          answer(i, b);
        });
        dom.choices.appendChild(b);
      });
      // Build the NEXT question now and preload its art, so the image is in
      // cache before the question that needs it is ever shown.
      upcoming = opts.next();
      if (opts.preload) {
        var u = opts.preload(upcoming);
        if (u) {
          var img = new Image();
          img.src = u;
        }
      }
    }

    function answer(i, btn) {
      if (locked) return;
      // ASK FIRST, BEFORE ANYTHING IS DISABLED. Disabling the button that
      // currently has focus moves focus to <body> immediately, so reading
      // activeElement after the loop below always said "not on the game" and
      // the keyboard player was never handed back. Measured: BODY every time.
      var hadFocus = dom.choices.contains(document.activeElement);
      locked = true;
      asked++;
      var right = i === q.answer;
      var buttons = dom.choices.querySelectorAll(".gq-btn");
      for (var b = 0; b < buttons.length; b++) {
        // aria-disabled, NOT disabled. See point 3 in the header: a disabled
        // button swallows the click entirely, so with `disabled` here the four
        // largest targets on the screen were the only places a tap-to-continue
        // could never be heard. `locked` above is what stops a second answer.
        buttons[b].setAttribute("aria-disabled", "true");
        if (b === q.answer) buttons[b].classList.add("is-right");
      }
      if (right) {
        streak++;
        score++;
        dom.say.textContent = q.note ? "Correct. " + q.note : "Correct.";
        dom.say.className = "gq-say is-right";
        if (!sprint && streak > store.get(bestKey, 0)) store.set(bestKey, streak);
      } else {
        if (btn) btn.classList.add("is-wrong");
        streak = 0;
        // SAY THAT IT WAS WRONG. This announced only the correct answer, so a
        // screen reader heard "Goldeen. #118, Generation 1." and had to
        // remember which name they had picked to know whether they got it.
        dom.say.textContent =
          "Not quite. The answer is " + q.choices[q.answer].label + "." + (q.note ? " " + q.note : "");
        dom.say.className = "gq-say is-wrong";
      }
      dom.streak.textContent = streak;
      showRun();
      showBest();
      if (q.reveal) q.reveal(dom.stage);

      // The hold is still automatic, so putting the phone down and watching it
      // still works, which is the queue brief. `advance` only makes it
      // interruptible. A wrong answer holds more than twice as long as a right
      // one because the note under it is the part worth reading.
      var moved = false;
      var timer = setTimeout(go, right ? 700 : 1500);
      advanceReadyAt = Date.now() + SKIP_GUARD;
      if (hints > 0) {
        hints--;
        dom.skip.hidden = false;
      }
      advance = function () {
        if (moved || Date.now() < advanceReadyAt) return;
        clearTimeout(timer);
        go();
      };
      function go() {
        if (moved) return;
        moved = true;
        advance = null;
        dom.skip.hidden = true;
        if (sprint && Date.now() >= deadline) return;
        render();
        if (hadFocus) {
          var first = dom.choices.querySelector(".gq-btn");
          if (first) first.focus();
        }
      }
    }

    function endSprint() {
      clearInterval(tick);
      tick = null;
      advance = null;
      dom.skip.hidden = true;
      var best = store.get(bestSprintKey, 0);
      if (score > best) store.set(bestSprintKey, score);
      dom.choices.innerHTML = "";
      dom.stage.innerHTML =
        '<div class="gq-over"><p class="gq-over-n">' +
        score +
        '</p><p class="gq-over-l">right in 60 seconds' +
        (score > best ? ", a new best" : ", best is " + best) +
        // HOW MANY YOU ANSWERED, not just how many you got. A sprint score of 9
        // means something different off 11 questions than off 34, and the
        // difference is the whole reason the hold above is now skippable.
        (asked ? "<br>" + asked + (asked === 1 ? " question" : " questions") + " answered" : "") +
        "</p></div>";
      dom.say.textContent = "";
      var again = document.createElement("button");
      again.type = "button";
      again.className = "gq-btn gq-again";
      again.textContent = "Go again";
      again.addEventListener("click", function () {
        start(true);
      });
      dom.choices.appendChild(again);
      showBest();
    }

    function start(isSprint) {
      sprint = isSprint;
      streak = 0;
      score = 0;
      asked = 0;
      upcoming = null;
      advance = null;
      dom.streak.textContent = "0";
      showRun();
      dom.mode.textContent = sprint ? "Stop the clock" : "Sprint: 60 seconds";
      dom.clock.hidden = !sprint;
      clearInterval(tick);
      tick = null;
      if (sprint) {
        deadline = Date.now() + 60000;
        dom.clock.textContent = "60s";
        tick = setInterval(function () {
          var left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
          dom.clock.textContent = left + "s";
          if (left <= 0) endSprint();
        }, 200);
      }
      showBest();
      render();
    }

    dom.mode.addEventListener("click", function () {
      start(!sprint);
    });

    /* TAP ANYWHERE ON THE GAME TO MOVE ON. Bound to the block rather than to a
     * "Next" button, because adding a button would mean the fast path through a
     * question went from one tap to two, on a page whose whole premise is one
     * thumb. The mode button is excluded: "Sprint: 60 seconds" is a different
     * instruction and skipping the note is not what somebody pressing it meant.
     * Clicks arriving inside SKIP_GUARD are the answering tap and are ignored,
     * see the note there. */
    function onTap(e) {
      if (!advance) return;
      if (e.target && e.target.closest && e.target.closest(".gq-mode")) return;
      advance();
    }
    el.addEventListener("click", onTap);

    // 1 to 4 answer. Space, enter and the answer keys also move past a result,
    // so the keyboard has the same skip the thumb does.
    function onKey(e) {
      // NOT WHILE SOMEBODY IS TYPING. This listened on document with no check on
      // the target, so typing "1" into the site search in the sticky bar
      // answered the question: button 1 was marked wrong, the answer was
      // revealed and the streak broke, while the cursor stayed in the search
      // field. WCAG 2.1.4 Character Key Shortcuts, and simply infuriating.
      var t = e.target;
      var tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var n = "1234".indexOf(e.key);
      if (locked) {
        if (!advance) return;
        if (n < 0) {
          if (e.key !== " " && e.key !== "Enter") return;
          // SPACE AND ENTER ARE A BUTTON'S OWN ACTIVATION KEYS. Swallowing them
          // here would mean that pressing space while focus sits on "Sprint: 60
          // seconds", during the second a result is up, skipped the result
          // instead of starting a sprint. They only mean "move on" when focus is
          // not on a control that already has a meaning for them.
          if (tag === "BUTTON" || tag === "A") return;
        }
        e.preventDefault();
        advance();
        return;
      }
      if (n < 0) return;
      var b = dom.choices.querySelectorAll(".gq-btn")[n];
      if (b) b.click();
    }
    document.addEventListener("keydown", onKey);

    start(false);

    /* MOUNTING A SECOND QUIZ OVER THE FIRST USED TO LEAVE THE FIRST RUNNING.
     * Who's That Pokemon calls GR.Quiz again every time the pool button is
     * pressed, and measured over CDP that added one document keydown listener
     * per press: 5 live listeners after 5 presses, each holding a whole quiz and
     * a detached DOM tree. It never misbehaved only because the old listeners
     * query an element that is no longer in the document and find nothing, which
     * is luck, not design.
     *
     * Worse, and visible: pressing a pool button 40 seconds into a sprint threw
     * the run away silently. The old quiz's interval was never cleared and its
     * endSprint never ran, so the clock vanished, the mode button reset itself
     * and the score went nowhere. destroy() banks it. A sprint stopped early can
     * only UNDERSTATE what the same run would have reached by 60 seconds, so
     * storing it can never inflate a best. */
    return {
      destroy: function () {
        dead = true;
        clearInterval(tick);
        tick = null;
        advance = null;
        if (sprint && score > store.get(bestSprintKey, 0)) store.set(bestSprintKey, score);
        document.removeEventListener("keydown", onKey);
        el.removeEventListener("click", onTap);
      },
    };
  }

  window.GR = window.GR || {};
  window.GR.Quiz = Quiz;
  window.GR.shuffle = shuffle;
  window.GR.pick = pick;
  window.GR.distractors = distractors;
})();
