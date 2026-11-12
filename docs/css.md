# The stylesheet pipeline

Covers assets-source/ui.css, build-css.mjs, split-page-css.mjs, stamp-assets.mjs, the inline-style comment check, and what the CSS perf measurements found.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## The stylesheet: edit assets-source/ui.css

**`public/assets/ui.css` is GENERATED. Edit `assets-source/ui.css`, then run
`node scripts/build-css.mjs`.** The generated copy says so in its first line.

The build strips the comments and nothing else: same rules, same order, byte
for byte identical once whitespace and comments are removed. It exists because
the stylesheet is render blocking on every page and most of it is prose.

**THE FIGURES HERE WERE "426 pages" AND "42.4KB -> 17.4KB, a 59% cut" AND ALL
THREE WERE STALE, corrected 21 August 2026.** The tree is 1,486 pages now, and
the built stylesheet has grown past 20KB gzipped without anybody noticing,
because the number that would have shown it was written down once and never
re-taken. Measured gzipped, which is how the host serves it. **RE-TAKEN AT HEAD
ON 21 AUGUST 2026, and the four numbers that were here were already wrong**, which
is the third time this entry has been stale and the reason the command below is
written out rather than the answer:

      assets-source/ui.css    356,351 raw    121,062 gzipped
      public/assets/ui.css    107,150 raw     21,041 gzipped

so the strip is an 82.6% cut gzipped, not 59%, and **the file a reader actually
waits for is 21,041 bytes and not 17,400.** Traced through git on the built
copy, it has moved every day: 20,106 on 19 August, 20,468 later the same day,
20,741 / 20,770 / 20,744 / 20,768 across 20 August, 21,041 at HEAD on 21 August.

**TAKE IT FROM HEAD, NOT FROM THE WORKING TREE, WHEN ANYTHING ELSE IS EDITING.**
`assets-source/ui.css` is the file agents touch most, so a measurement made while
one is mid-edit is a measurement of a file that has never shipped. The two
answers were 21,041 and 21,153 within the same minute on 21 August. `git show
HEAD:public/assets/ui.css | gzip -9c | wc -c` is the version that cannot move
under you.

**RE-TAKE IT RATHER THAN QUOTING IT**, because the number above will be wrong
again within days and this file has now been wrong about it twice. One line,
and the `<` matters: `gzip -9c file` stores the filename and mtime in the header
and gives a different answer from `gzip -9c < file`, which is a real 30-byte
disagreement and is how two passes can measure "the same thing" and differ:

    for f in assets-source/ui.css public/assets/ui.css; do \
      printf '%-24s raw=%s gz=%s\n' $f "$(wc -c < $f)" "$(gzip -9c < $f | wc -c)"; done

The 20KB is still the point rather than the pity: it is one render blocking
request on 1,486 pages, so a kilobyte here is worth more than a kilobyte
anywhere else on the site. See the packs.css note under Card images for the
other render blocking stylesheet and the twelve pages that were carrying it for
nothing.

The comments are the point of the source file, so they are not a cleanup
target: most of them record a measurement or a bug that a tidy-up would
otherwise reintroduce. They cost nothing now, so write more of them.

`build-css.mjs` runs FIRST in build-all.mjs, before any page builder, because
shared/chrome.mjs hashes the built stylesheet at import time to make the
`?v=` cache buster. `stamp-assets.mjs` still runs LAST. check-build.py fails
if the two files have drifted apart, which is what catches an edit made to the
generated copy by habit.

**SINCE 30 SEPTEMBER 2026 THE BUILT ui.css IS NOT THE WHOLE SOURCE: page-only
rules move into the page.** `scripts/split-page-css.mjs` runs just before
stamp-assets. It finds rules whose every selector needs a class that appears on
1 to 5 built pages (and in no `public/assets/*.js`), deletes them from
`public/assets/ui.css`, and writes them into a `<style data-pcss>` right after
that page's ui.css `<link>`. A cascade guard keeps a rule shared when a later
shared rule of equal specificity could fight it for the same property. First
run: 297 rules moved to 38 pages, ui.css 25,530 -> 20,979 bytes gzipped, and 0
computed-style differences over 164,892 elements (41 pages x 390/768/1440,
compared against a same-tree noise floor).
- **Keep editing `assets-source/ui.css`, exactly as before.** The split is
  derived from it on every build, so a rule can move in or out on its own as
  pages gain or lose a class.
- **check-build.py runs `split-page-css.mjs --check`** in place of the old
  "same rules as the source" comparison. It fails when ui.css or any page is
  not what a fresh split would write, which is also what catches a single
  builder run after build-all.
- **The split ignores HTML and CSS comments when it counts class usage.**
  stamp-assets strips inline-style comments AFTER the split, and several of
  those comments name classes, so counting them made the split and the --check
  disagree on 9 files. If they disagree again, look for another input that
  stamp changes.
- A class added by JavaScript must appear in a `public/assets/*.js` file by
  name, or its rules can move off pages that need them. A class built by
  string concatenation in a script cannot be seen: write it out in full.

**ALWAYS FINISH WITH build-all.mjs. ANY SINGLE BUILDER YOU RUN AFTERWARDS PUTS
THE TREE BACK, INCLUDING ONE YOU RAN ONLY TO READ ITS OUTPUT.** That last clause
is the one that actually bites and it is why this paragraph exists. `stamp-assets
.mjs` strips every inline `<style>` and runs LAST, so a page builder run alone
leaves its comments in and the committed tree stops matching a fresh build of
the same HEAD.

**IT COST 13,020 BYTES ON THE HOME PAGE ON 14 SEPTEMBER 2026.** `node
scripts/build-proto.mjs` was run on its own, after a clean build-all, purely to
read its report about which drops rows it was leaving off the band. Nothing was
edited. index.html went 107,050 -> 120,070 bytes and shipped, so the site's
render-blocking front door served 13KB of CSS prose until CI's drift job caught
it AFTER the push and after the deploy. Debugging is not a read-only act: the
builder rewrote the page as a side effect of being asked to talk.

**THERE IS A CHECK FOR IT NOW, so this is no longer advice.** check-build.py
fails the build when any inline `<style>` in `public/` contains a `/*`. The
invariant is exact rather than approximate: 1,511 built pages carry an inline
`<style>` and zero carry a comment, so one comment means one page was written by
something other than a finished build-all. It is instant, where
`check-tree-drift.mjs` rebuilds HEAD in a scratch copy and takes minutes -- use
drift to prove the WHOLE tree before a commit that touches `public/`, and this
to fail fast. It was verified by reproducing the fault: run build-proto.mjs
alone and check-build.py exits 1 naming the page and the count.

Do NOT delete rules because coverage says they are unused. Only 6-15% of the
file is used on any one page, but coverage cannot see :hover, :focus, print,
media query or JS-toggled-class rules, and deleting those is how this site
breaks silently.
Host is GitHub Pages: .github/workflows/pages.yml uploads public/ on every
push to main. There is no server build step. See DEPLOY.md.

**THE SAME STRIP NOW HAPPENS TO EVERY INLINE `<style>` BLOCK, IN
`stamp-assets.mjs`, AND IT RUNS LAST SO IT CATCHES EVERY PAGE HOWEVER IT WAS
PRODUCED.** 21 August 2026. Twenty-two builders already carried a private regex
copy of this trade for their own page CSS and the rest carried none, so the
pages that lost most were the ones no builder edit could reach: `build-pokemon
.mjs` has no `miniCSS` at all and owns 1,026 pages, and about, shops, wanted,
hall and garbage-plate take their `<head>` by SLICING index.html, so all five
shipped build-proto.mjs's `homeCss` comments verbatim, 5,289 raw bytes of prose
about a band none of them render. Measured across all 1,487 built files and
1,488 blocks: **2,694,105 raw bytes of comments, 1,325.1KB gzipped, 8.07% of
ALL the HTML this site serves**; 1,237 B/page on /pokemon/ (11.05% of the
document), 1,706 on the root pages, 7,089 on /base-set.html alone. It uses
build-css.mjs's `strip()`, tokenizer and `lintComments()` and all, never a
regex, for the reason that function's own header gives.

**IT WAS ASKED FOR AS AN LCP FIX AND ON A COLD LOAD IT IS NOT ONE. THIS IS THE
PART WORTH KEEPING.** The case was that the LCP element on the Pokemon pages,
the set guides and the root guides is a paragraph of TEXT, so LCP equals FCP and
document bytes are the gate. The first half is true and was re-confirmed: LCP is
`P.lede` on all three families and LCP == FCP to the millisecond. The second
half is false. At 390x844 on Slow 3G with 4x CPU, medians of 9, /base-set.html's
document arrives **468ms earlier** (1,289 -> 821ms) and **LCP does not move**
(2,456 -> 2,500ms, inside a noise floor of 0-8ms taken by running the same tree
against itself).

**THE PAINT IS GATED BY ui.css ALONE AND NOW THERE IS A NUMBER ON IT.** The
waterfall: the preload scanner finds the stylesheet in the first KB of the head
and `/assets/ui.css`, 21,209 bytes gzipped, lands at **2,338ms, which is
1,226ms after the document has finished**. The inline block IS render blocking
but rides in with the document, so it is never the LAST render-blocking thing
and shrinking it cannot move first paint. **"A kilobyte here is worth more than
a kilobyte anywhere else on the site" is measured now rather than asserted, and
ui.css is where the next real paint win is.** Do not go looking for one in page
CSS again.

**AND THE WIN IS ON THE SECOND PAGE OF THE VISIT, which is the condition nobody
measured and is the common one:** a reader who arrived on the home page, and a
crawler walking 1,487 urls. The assets are content-hashed and immutable, which
is exactly what the `?v=` stamp exists for, so on page two the document is the
ONLY thing on the critical path and the bytes convert almost 1:1 into paint.
Warm cache, after /index.html, LCP before -> after:

      Slow 3G   /base-set.html            744 -> 632ms    -112ms, -15%
      Slow 3G   /pokemon/charizard.html   604 -> 560ms     -44ms,  -7%
      Slow 3G   /sets/151.html            564 -> 564ms       0ms   (0-byte control)
      Slow 4G   /base-set.html            276 -> 248ms     -28ms, -10%
      Slow 4G   /sets/151.html            236 -> 236ms       0ms   (0-byte control)

**QUOTE THE COLD ROW WITH THE WARM ONE OR QUOTE NEITHER.** A page-weight change
on this site buys nothing on a first visit and real milliseconds on every visit
after it, and reporting either half alone is how the next pass gets talked into
the wrong optimisation.

**NOTHING RENDERS DIFFERENTLY AND THAT WAS MEASURED.** 121 pages across every
family at 390 and 1440, 244,066 elements, each compared on 108 computed
properties plus its box plus `::before` and `::after`: 236 of 242 page-width
runs byte-identical, and all six that were not reproduce when a tree is compared
AGAINST ITSELF. **CSSOM rule counts, counted recursively so a media block's
children count too: 306,582 -> 306,582, zero mismatches.** That is the check
that proves a stripper took comments and not rules, and it is the one to repeat
if anybody touches this again. **Three pages are nondeterministic under a
computed-style diff and it is not a bug:** /lore.html's SVG bars are mid
animation, /games/pokemon-trivia.html and /games/guess-the-set.html pick a
random question, and `.pack-hint` carries a running transition on the playlist
pages. Establish a same-tree noise floor before believing a diff on any of them.

**getComputedStyle RESOLVES url() TO AN ABSOLUTE URL, so two trees served from
two ports differ on every `background-image` and a naive diff reports hundreds
of false changes.** Normalise the origin out before hashing. That cost the first
pass an hour of chasing `.pack-art`.
