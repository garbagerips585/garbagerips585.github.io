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
 *     Pokemon name one handed in a queue is a chore, not a game.
 *   - No forced timer in the default mode. A countdown you cannot pause
 *     punishes you for the queue moving, which is the one thing you are
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
   */
  function Quiz(opts) {
    var el = opts.mount;
    var sprint = false;
    var streak = 0;
    var score = 0;
    var asked = 0;
    var locked = false;
    var q = null;
    var upcoming = null;
    var deadline = 0;
    var tick = null;
    var bestKey = opts.key + ":best";
    var bestSprintKey = opts.key + ":bestSprint";

    var dom = {};
    el.innerHTML =
      '<div class="gq">' +
      '<div class="gq-bar">' +
      '<span class="gq-stat"><b data-streak>0</b> streak</span>' +
      '<span class="gq-stat gq-best"><b data-best>0</b> best</span>' +
      '<span class="gq-stat gq-clock" data-clock hidden></span>' +
      "</div>" +
      '<div class="gq-stage" data-stage></div>' +
      '<p class="gq-say" data-say role="status" aria-live="polite"></p>' +
      '<div class="gq-choices" data-choices></div>' +
      '<div class="gq-foot">' +
      '<button class="gq-mode" data-mode type="button">Sprint: 60 seconds</button>' +
      "</div>" +
      "</div>";
    ["streak", "best", "clock", "stage", "say", "choices", "mode"].forEach(function (k) {
      dom[k] = el.querySelector("[data-" + k + "]");
    });

    function showBest() {
      dom.best.textContent = store.get(sprint ? bestSprintKey : bestKey, 0);
    }

    function render() {
      q = upcoming || opts.next();
      upcoming = null;
      locked = false;
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
      locked = true;
      asked++;
      var right = i === q.answer;
      var buttons = dom.choices.querySelectorAll(".gq-btn");
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].disabled = true;
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
        dom.say.textContent = q.note ? q.choices[q.answer].label + ". " + q.note : q.choices[q.answer].label + ".";
        dom.say.className = "gq-say is-wrong";
      }
      dom.streak.textContent = streak;
      showBest();
      if (q.reveal) q.reveal(dom.stage);
      setTimeout(function () {
        if (sprint && Date.now() >= deadline) return;
        render();
      }, right ? 700 : 1500);
    }

    function endSprint() {
      clearInterval(tick);
      tick = null;
      var best = store.get(bestSprintKey, 0);
      if (score > best) store.set(bestSprintKey, score);
      dom.choices.innerHTML = "";
      dom.stage.innerHTML =
        '<div class="gq-over"><p class="gq-over-n">' +
        score +
        '</p><p class="gq-over-l">right in 60 seconds' +
        (score > best ? ", a new best" : ", best is " + best) +
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
      dom.streak.textContent = "0";
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

    // 1 to 4 answer without moving your hand on a desktop. Ignored while a
    // result is on screen so a fast double tap cannot skip a question.
    document.addEventListener("keydown", function (e) {
      if (locked) return;
      var n = "1234".indexOf(e.key);
      if (n < 0) return;
      var b = dom.choices.querySelectorAll(".gq-btn")[n];
      if (b) b.click();
    });

    start(false);
  }

  window.GR = window.GR || {};
  window.GR.Quiz = Quiz;
  window.GR.shuffle = shuffle;
  window.GR.pick = pick;
  window.GR.distractors = distractors;
})();
