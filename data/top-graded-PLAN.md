# Top 100 graded Pokemon cards: what was probed, what answered, what it cost

Research for `/top-graded.html`, done 16 August 2026. Written before the page,
kept because every trap below answered HTTP 200 while being wrong.

**Read the "weak evidence of absence" section at the bottom before you record a
404 in here as proof of anything.** That mistake is already in this repo's
history and it reached a live page.

---

## 1. The question does not have one answer, so the page names the one it picked

the owner asked for the "top value graded cards ... top top top tier". That phrase
maps onto at least four different measurements, which produce four different
lists:

| Measurement | What it means | Sourceable? |
|---|---|---|
| Highest public auction sale | One lot, one hammer price, one date | **No** (see 2) |
| Price guide value at a grade | An algorithmic average of recent sales | **Yes** (see 3) |
| Current live asking price | What a seller wants today, unsold | Partly, gated |
| Population-adjusted scarcity | Pop report scarcity, not price at all | **No** (see 2) |

These are not interchangeable. The Illustrator Pikachu sold at Goldin for a
widely reported $5.275m in 2022; PriceCharting's PSA 10 column for the same card
reads **$16,492,000**. Both are "the value of the card" and they differ by 3x,
because one is a single historical event and the other is a guide value. A page
that says "most valuable" without saying which of these it means is not making a
checkable claim.

**So the page is titled for the measurement, not for the vibe:** the highest PSA
10 values recorded by PriceCharting, read on a stated date. Not "the 100 most
valuable graded Pokemon cards".

---

## 2. Sources that did NOT answer, and exactly how they failed

All probed 16 August 2026 with a normal desktop User-Agent. **None of these were
worked around, and none should be:** three of them are bot-detection gates, and
defeating those is off limits regardless of how much it would improve the page.

| Source | Result | What came back |
|---|---|---|
| `psacard.com/priceguide/...` | **403** | Cloudflare interstitial, `<title>Just a moment...</title>`, 5,900 bytes, "Enable JavaScript" |
| `psacard.com/auctionprices` | **403** | Same Cloudflare interstitial, 5,744 bytes |
| `comics.ha.com` (Heritage) | **403** | 766 bytes, CAPTCHA |
| `goldin.co/sport/pokemon` | 200 | **JS shell.** 4,988 bytes, 122 characters of visible text, and that text is "It looks like JavaScript is not enabled". **Zero** price strings in the HTML |
| `pwccmarketplace.com` (Fanatics Collect) | 200 | 562KB, but only 7 price strings, all of them *current live lots* on the homepage. No server-rendered results archive |
| `tcgplayer.com/search` | 200 | CAPTCHA gate in the body |
| `sportscardspro.com` | **403** | Cloudflare interstitial. Notable because this is PriceCharting's own sister site, and it is gated where pricecharting.com is not |

**This kills the auction-results list.** "The 100 highest public auction sales
for graded Pokemon cards" is the most rigorous version of this page and it is
the one that cannot be built: the three houses that publish results (PSA's APR
database, Heritage, Goldin) are all either behind Cloudflare or render results
only in JavaScript. There is no honest way to assemble that list from these
sources, and assembling it from memory or from unattributed blog copy is exactly
what this site does not do.

Population-adjusted scarcity dies with the same 403: the PSA population report
lives behind the same gate as the price guide.

---

## 3. The source that did answer: PriceCharting

Chosen because it answers, and because **this repo already sanctions it**:
`scripts/sync-pricecharting.mjs` has been reading it since before this page
existed, `data/graded.json` is built from it, and `/grading.html` already prints
its figures. This is not a new dependency, it is the existing one used at
greater breadth.

- `robots.txt` disallows only `/stripe-connect`, `/publish-offer`, `/buy`.
  None of those are touched.
- Methodology is published at `/page/methodology` and is specific:

  > **PSA 10** is "Graded by PSA as a 10"

  Prices are computed from completed eBay sales plus their own marketplace,
  combined by their algorithm using "most recent sale price, median price,
  average price, age weighted average price", with outliers and sale dates
  taken into account. Shipping is excluded. Grade is inferred from listing
  title and description.

**What that makes the number:** a price guide value for one grade. It is
emphatically **not** an auction record, and no copy on the page may call it one.

---

## 4. Four traps. All four returned HTTP 200. Three would have shipped.

### Trap 1: `sort=highest-price` sorts the UNGRADED column

The single most dangerous finding. It is the only price sort PriceCharting
offers, on both the search endpoint and the console pages, and its name does not
say *which* price. Measured on a Charizard query:

```
price1 (ungraded) monotonically descending?  True
price2 (PSA 10)   monotonically descending?  False
```

Charizard [Gold Star] at a **$195,200** PSA 10 sat **fourth**, behind three
cards worth a fifth of that, because its raw price is $3,835. Taking the top N
of that sort would have produced a confident, plausible, wrong list, and nothing
in the response would have hinted at it.

There is **no** server-side sort by graded price anywhere on the site. The PSA
10 column header sorts client-side over the 150 rows already in the DOM. So the
only honest ranking is: pull every row, sort locally. That is what the sync
script does, and it is why it is a full crawl rather than one clever query.

### Trap 2: an unknown parameter value is ignored silently, with a 200

```
sort=TOTAL_GARBAGE_XYZ      -> 200, returns the popularity ordering
exclude-hardware=ZZGARBAGE  -> 200, returns the sealed products it should drop
```

Neither errors. The JSON endpoint's defence is that it **echoes the parameters
it actually applied**, so `sort` reading back as `popularity` is the tell. The
HTML pages echo nothing, so the only defence there is diffing the response body
against the unfiltered one. `exclude-hardware=true` was confirmed that way: on
Prismatic Evolutions it cut sealed-looking titles from 16 to 3, where the
garbage value left all 16 in place. **Every filter this page relies on was
verified by content diff, not by status code.**

### Trap 3: two lists that look complete are not

- **Console pages cap at 150 rows.** The rest hides behind a form posting
  `cursor`. Base Set renders 150 rows and looks finished; it has 450+. A
  truncated list is indistinguishable from a complete one by eye.
- **`/category/pokemon-cards` is not the set list.** It offers 302 Pokemon sets
  and its own heading says, in words, "Most Popular Pokemon Card Sets". It
  omitted **every World Championships year except 2025**, and those sets hold
  the trophy cards, which are exactly the top-tier material this page is about.
  Caught by searching "No. 1 Trainer" and getting back a console
  (`Pokemon World Championships 2015`) that the category page never mentioned.

  **`/sitemap.xml` carries 793 Pokemon consoles** and is a strict superset:
  checked, 0 of the category page's 302 are missing from it. The sitemap is the
  enumeration. The category page is a popularity subset wearing the same shape.

### Trap 4: the same CSS id means a different grade on different page types

Found while adding per-row verification, and it is the nastiest one because both
readings are plausible numbers for the same card.

On a **console listing** page the columns are `Ungraded | Grade 9 | PSA 10` and
the td classes are `used_price | cib_price | new_price`.
On a **product** page the columns are
`Ungraded | Grade 7 | Grade 8 | Grade 9 | Grade 9.5 | PSA 10` and the td ids are:

```
Ungraded  -> used_price          Grade 9    -> graded_price
Grade 7   -> complete_price      Grade 9.5  -> box_only_price
Grade 8   -> new_price           PSA 10     -> manual_only_price
```

So `new_price` is **PSA 10 on a listing page and Grade 8 on a product page**.
For Base Set Charizard #4 that is $28,144.52 against $1,330.50, a 21x error
that reads as a perfectly reasonable card price. The ids are video-game legacy
names (`box_only`, `manual_only`) and carry no meaning about grade at all.

**Defence:** never read these positionally by id. Both the sync script and the
verifier map columns from the `<th>` labels, and the sync script *hard-skips* a
console whose header row is not exactly
`["", "Card", "Ungraded", "Grade 9", "PSA 10", ""]` rather than reading it anyway.

### Not a trap, but it reads like one: empty PSA 10 cells on famous cards

Trophy Pikachu [Gold], No. 1 Trainer: Champion Road, Master's Key all carry an
**empty** PSA 10 cell. That is not missing data awaiting a backfill, it is the
honest answer: PriceCharting prices from completed sales, and a card with no
recent PSA 10 sale has no value to report in that column.

Those cards are absent from the list **by construction**, and the page says so
out loud, because a reader who knows Pokemon will notice they are missing and is
owed the reason. Do not backfill them from anywhere.

---

## 5. A bug in our own parser that looked exactly like a source failure

Worth recording because the log looked like progress. The first crawl reported
`[50/793] 0 products, 50 pages`, and it fetched 50 pages and kept none.

Cause: entities were decoded **after** the trim. The blank column headers are
`&nbsp;`, so trimming first left the literal string `&nbsp;`, which only became
a space once decoded, and that space was never trimmed. Every header compared as
`" "` against `""`, so every console failed the column check and was skipped as
"unexpected columns", while still costing a request.

The source was fine the whole time. **A parser that rejects everything looks
identical to a source that serves nothing**, and the difference is one cached
file away. Check a cached response by hand before concluding a site changed.

Second bug in the same pass: 46 of the 793 console paths contain `&` or `'`
(`/console/pokemon-black-&-white`). `encodeURI` does not escape `&`, so the URL
parsed as the path `/console/pokemon-black-` with a stray query parameter. Paths
are encoded per segment now.

---

## 6. A 404 at a guessed address is weak evidence of absence

`data/video-games-PLAN.md` recorded a 404 as proof a game had no Metacritic
page. The page existed at a different slug, and the site printed "No Metascore
yet" over a game scoring 75.

Applied here, three ways:

- Every console URL crawled comes from **PriceCharting's own sitemap**, not from
  a slug this repo guessed. A 404 on a sitemap URL is a fact about their data;
  a 404 on a guessed one is a fact about the guess.
- `/sitemaps.xml`, `/sitemap_index.xml`, `/console-list` and `/consoles` all
  404'd. **That is recorded as "these four addresses 404", not as "PriceCharting
  publishes no sitemap"**, because `/sitemap.xml` answered 200 with 41,463
  URLs. Four wrong guesses next to one right one is the whole lesson in a single
  probe.
- `/page/terms` 404s. That is **not** evidence PriceCharting has no terms of
  service. It is evidence that one guessed path has no page. The existing
  `sync-pricecharting.mjs` recorded the same thing ("their terms were not
  retrievable") and the correct response is unchanged: keep the volume low, keep
  the identification honest, cache so a re-run costs them nothing.

---

## 7. Cost, and how to re-run

The crawl is one request a second with an honest User-Agent naming the site, and
every page is cached under `.cache/pricecharting-console/` (gitignored). Pages
are ~38KB gzipped.

```
node scripts/sync-graded-top.mjs             # crawl, resumable, cache-first
node scripts/sync-graded-top.mjs --refresh   # ignore cache, refetch
node scripts/verify-graded-top.mjs           # independent re-check, see below
node scripts/build-top-graded.mjs            # write the page
```

**The verifier is not optional and not decoration.** It re-fetches the *product*
page for every published row and re-reads the PSA 10 figure through a different
parser, off a different page type, mapping columns by `<th>` label. Two
independent reads agreeing is what makes the number publishable; it is also the
only thing that would catch Trap 4 coming back. Its output is written into the
data file and the page states the result.

Re-running is a snapshot, not a feed. Prices move, the page prints the date it
was read, and nothing here refreshes on the nightly.

---

## 8. What the run actually produced, 16 August 2026

```
793 consoles crawled, 1,126 pages, 89,910 products
60,912 products carried a PSA 10 value
top 400 kept in data/top-graded.json, top 100 published
top of list $16,492,000   number 100 $28,988
```

**One console was skipped, and the guard that skipped it is the point.**
`/console/pokemon-mini` came back with the headers
`["", "Title", "Loose Price", "CIB Price", "New Price", ""]`. It is the Pokemon
Mini **handheld games console**, not a card set, and it sits in the sitemap under
the same `/console/pokemon*` prefix as every card set. Read positionally it would
have contributed video game prices to a list of card values. The hard header
check caught it and recorded it in `scanned.consolesSkipped` rather than
dropping it silently.

### Verification

`verify-graded-top.mjs` re-read the top 120 from their product pages:

```
120 agree, 0 disagree, 0 unreadable, 0 missing a scan
```

Spot-checked a THIRD time against live pages after the build, ranks 1, 6, 50 and
100: all four matched the published figure to the dollar.

### Verification widened to all 400, 17 August 2026

That run above covered **120 rows and no longer describes the file.**
`verify-graded-top.mjs --all` re-read every row against the same crawl:

```
399 agree, 1 disagree, 0 unreadable, 0 missing a scan
DISAGREE  #175 Omastar [Masaki Promo] #139 (Japanese Vending)
          listing 20500   product 32530.59   img=13851B
```

**The one disagreement is a price that moved, not a column read wrongly**, and
that was established before anything was published rather than assumed from the
399. Both reads are of the same PriceCharting product record, id 5639952. The
product page's PSA 10 cell carries a `change` span titled "dollar change from
last update" reading **+$12,030.59**, and `32,530.59 - 12,030.59 = 20,500.00`
exactly, which is the listing figure. The other two columns of the same page
reconcile the same way to the cent: Ungraded `687.00 -> 609.08` on `-77.92`,
Grade 9 `2,598.14 -> 2,547.80` on `-50.34`.

**The same reconciliation was then run across all 400 rows**, because one card
moving and the parser breaking look identical from a single row:

| | rows |
|---|---|
| product page == listing page, to the cent | 370 |
| moved, and `product - (their own change) == listing`, to the cent | 30 |
| neither | 0 |

So the `<th>`-mapped column parse is demonstrably right on all 400 and Trap 4 has
not come back. Of the 30 that moved, Omastar is the only one outside the 0.15
tolerance at **+58.69%**; the next largest is `-9.46%` (#212 Gengar #44) and 22
of the 30 are under 1%. PriceCharting reports this card's PSA 10 volume as **2
sales per year**, which is what lets one sale move a guide value that far.

**It is still unpublishable and it is published nowhere**: two correct readings
$12,030 apart give no basis for printing either. So the row is recorded in a new
top-level `excluded` array in `data/top-graded.json`, carrying rank, name, set,
both figures, the date decided, a one-line `public` reason the page prints, and
the full working. `shared/graded-gate.mjs` is the gate both builders now go
through, and it still throws on a disagreement with no entry, an entry that does
not match the row's figures exactly, an entry with no reasoning, and an entry
left parked after the data moved on. **Do not "fix" a disagreement by editing a
row's `status`.**

What widening bought `/base-set.html`: the 1999-2000 reprint's price (rank 124),
and the 1st Edition against Shadowless table across Charizard, Blastoise and
Mewtwo. What it did NOT buy, and no further verification can: Shadowless against
Unlimited beyond Charizard. This file is ranked BY PSA 10 VALUE with a floor of
$12,000 at rank 400, so the Unlimited printings of the other Base Set cards are
not in it at all. **Widening a verification can only ever add the scarce
printings.** Getting the common one needs a different crawl.

### The page, measured with headless Chrome over CDP, cache off

| | 390x844 DPR2 | 1440x900 DPR1 |
|---|---|---|
| on load | 416.6KB, 16 requests | 474.0KB, 20 requests |
| fully scrolled | 1,642.8KB, 113 requests | 1,643.4KB, 113 requests |
| page height | 23,033px | 19,554px |
| images decoded | 100 of 100 | 100 of 100 |
| horizontal overflow | none (scrollWidth 390) | none (scrollWidth 1440) |

**Quote the pair or quote neither,** per the note in CLAUDE.md about
rarity.html: the on-load figure is what a reader waits for and the scrolled
figure is what the page really costs. The gap is the 100 lazy card scans.

Card scans are PriceCharting's own, at `/240.jpg`: **min 7,995 bytes, max 19,012,
mean 12,923, 1,262KB for all 100.** The site-wide 200KB ceiling is untouched, by
a factor of ten on the worst row. They are a fixed 240 HIGH and a variable
169-174 WIDE, which is the tcgplayer-cdn situation, so `imgDims()` correctly
returns "" and `avifPicture()` correctly passes them through.

The 12 em dashes in the rendered text are all `noValue()` placeholders, 8 rows
with no ungraded figure and 4 with no Grade 9, each carrying its own `.sr-only`
sentence saying which value is missing. There are no em dashes in prose.

---

## 9. Two process notes for whoever runs this next

**THE SCRATCHPAD IS SHARED BETWEEN CONCURRENTLY RUNNING AGENTS.** A CDP harness
written to `scratchpad/cdp.mjs` was overwritten mid-session by another agent's
file of the same name, and the symptom was not "your file changed": it was
Chrome refusing connections on port 9222, a port this harness never chose. Ten
minutes went into debugging Chrome. Name scratch files for the task
(`cdp-topgraded.mjs`), the same way `git add -A` is not safe with agents running.

**`node --check` earned its place twice in one file.** Both failures were a
backtick inside a CSS comment inside the page template literal, which is the
exact break CLAUDE.md records as having happened three times before. It is worth
running after every edit to a builder, not at the end.
