// The publication gate on the two ranked PriceCharting files, shared by the
// three pages that print figures out of them: /top-graded.html and
// /base-set.html read data/top-graded.json, and /most-valuable-cards.html reads
// data/top-raw.json. Same shape, same gate, one implementation.
//
// IT IS SHARED RATHER THAN COPIED, AND IT USED TO BE COPIED. Both builders
// carried the same three throws, and build-base-set.mjs said so in as many
// words: "THE SAME THREE GATES build-top-graded.mjs USES, and for the same
// reason". Two copies of one comparison is survivable. Two copies of a rule
// with an EXCEPTION in it is not, because the copies then have to agree about
// which rows are excluded and why, and the failure mode is one page publishing
// a figure the other page refuses to publish. Same argument as shared/decks.mjs
// being the shared half of the two deck pages.
//
// ---------------------------------------------------------------------------
// WHAT THE GATE IS PROTECTING, which is narrower than "the numbers are right".
//
// Every figure on those pages is read twice: once from a console LISTING page
// by sync-graded-top.mjs or sync-raw-top.mjs, once from the card's own PRODUCT
// page by the matching verifier, through a different parser on a different
// template. Both parsers now live in shared/pricecharting.mjs, which does not
// weaken the check: they are still two different readers of two different
// templates, and keeping them in one file is what stops a fix to one silently
// being applied to both.
// The trap that buys is Trap 4 in data/top-graded-PLAN.md: the td ids are
// video-game legacy names and `new_price` means PSA 10 on a listing page and
// Grade 8 on a product page. On Base Set Charizard #4 that is $28,144.52
// against $1,330.50, a 21x error that reads as a perfectly reasonable price for
// the card. Nothing about it looks wrong, so only a second read catches it.
//
// A DISAGREEMENT IS THEREFORE AMBIGUOUS, and that ambiguity is the whole reason
// the gate exists. It can mean the parse is broken, in which case every number
// on both pages is suspect and publishing any of them is unsafe. It can also
// mean the two reads happened on different days and the guide value moved. The
// verifier cannot tell those apart, so it refuses, and a person has to look.
//
// ---------------------------------------------------------------------------
// THE ONE EXCLUSION THIS FILE EXISTS TO ALLOW, and the evidence behind it.
//
// `node scripts/verify-graded-top.mjs --all` on 17 August 2026, against the
// crawl of 16 August 2026, re-read all 400 rows instead of the default 120:
//
//     399 agree, 1 disagree, 0 unreadable, 0 missing a scan
//     DISAGREE  #175 Omastar [Masaki Promo] #139 (Japanese Vending)
//               listing 20500   product 32530.59   img=13851B
//
// That is NOT a parse failure, and it is not a product page describing another
// printing. Both pages are the same PriceCharting product record, id 5639952:
// the listing row links to the url the verifier fetched. The parse is right on
// both sides. What happened is that the value moved between the two reads, and
// PriceCharting's own page says so:
//
//   The product page's PSA 10 cell carries a `change` span titled "dollar
//   change from last update" reading +$12,030.59, and
//
//       32,530.59 - 12,030.59 = 20,500.00 exactly, the listing figure.
//
//   The other two columns of that same page reconcile the same way, to the
//   cent: Ungraded 687.00 -> 609.08 with a change of -77.92, Grade 9 2,598.14
//   -> 2,547.80 with a change of -50.34. Both of those are also the figures in
//   this file. Three columns, three exact reconciliations, on the one card that
//   disagreed.
//
// AND THE SAME CHECK WAS RUN ACROSS ALL 400 ROWS rather than only the one that
// failed, because "one card moved" and "the parser is broken" would look alike
// from a single row. Every one of the 400 falls into exactly two classes:
//
//     370 rows   product page PSA 10 == listing page PSA 10, to the cent
//      30 rows   moved, and product - (their own reported change) == listing,
//                to the cent, on every single one
//       0 rows   in neither class
//
// So the column mapping is demonstrably correct on all 400. Of the 30 that
// moved, 29 are inside the verifier's 15% tolerance and Omastar is the only one
// outside it: +58.69%, against -9.46% for the next largest (#212 Gengar #44)
// and under 1% for 22 of them. PriceCharting reports the PSA 10 sales volume
// for this card as 2 sales per year, which is what makes a jump that size
// possible: one new sale is half the evidence behind the figure.
//
// THE HONEST CONSEQUENCE IS STILL THAT THE ROW CANNOT BE PUBLISHED. We hold two
// correctly read figures for this card, $12,030 apart, and no basis for calling
// either one the value. So it is excluded, with the reason recorded in the data
// beside the numbers it is about, and the reason is "the market moved", not
// "the parse is fine so publish it anyway".
//
// ---------------------------------------------------------------------------
// WHAT STILL STOPS THE BUILD, which is the point of writing this as a match
// rather than as a count:
//
//   - A disagreeing row with NO exclusion entry. That is the unexplained case
//     and it is the one the original throw was built for. Untouched.
//   - An exclusion entry whose rank, name, set, listing or product does not
//     match the row it claims to be about. Both figures are matched EXACTLY,
//     so the entry describes one specific pair of readings and cannot be left
//     parked over a different disagreement that happens to land on the rank.
//   - An exclusion entry with no `why` or no `decided`. An exemption with no
//     recorded reasoning is the thing this gate is supposed to prevent.
//   - An exclusion entry that no longer matches any disagreeing row. A stale
//     exemption is a decision about data that is not here any more, and leaving
//     one lying around is how the next disagreement gets waved through.
//
// A re-crawl clears the whole question on its own: sync-graded-top.mjs writes a
// fresh file, so `excluded` goes with `verify` and both have to be earned again.
//
// NOTHING HERE CHANGES WHAT GETS PUBLISHED. Both builders already publish only
// rows whose status is "agree", so this row was never going to be printed. All
// the exclusion decides is whether the build is allowed to continue at all.

/**
 * Check a ranked PriceCharting file is publishable and return the two lookups
 * its builders need. Throws on anything that would put an unbacked figure on a
 * page.
 *
 * THE FILE NAMES ARE ARGUMENTS RATHER THAN LITERALS because there are two files
 * now and a gate that names the wrong one in its error message sends the next
 * person to re-run the wrong script. Nothing else about the rule is per-file:
 * both are ranked, both are double-read, and both may exempt a row only by
 * writing down which two readings it is about.
 *
 * @param {object} d parsed data/top-graded.json or data/top-raw.json
 * @param {string} file which of those, for the error messages
 * @param {string} verifier the script that would earn the verification back
 * @returns {{verified: Map<number, object>, excluded: Map<number, object>}}
 */
export function gradedGate(d, file = "data/top-graded.json", verifier = "scripts/verify-graded-top.mjs") {
  if (!d.verify) {
    throw new Error(
      `${file} has no \`verify\` block, so nothing in it has been ` +
        `read twice.\nRun: node ${verifier}\n` +
        "Nothing here is publishable on a single read: see the column mix-up " +
        "in data/top-graded-PLAN.md, trap 4.",
    );
  }
  if (d.verify.for !== d.checked) {
    throw new Error(
      `${file}: the verification is stamped for a crawl of ` +
        `${d.verify.for} and the data is from ${d.checked}. ` +
        `Re-run ${verifier}.`,
    );
  }

  const rows = d.verify.rows || [];
  const disagreeing = rows.filter((r) => r.status === "disagree");
  const entries = d.excluded || [];

  // Both money figures compared exactly, on purpose. They are two numbers that
  // came out of the same JSON file, so there is no float arithmetic between
  // them and nothing to round; an epsilon here would only widen what a stale
  // entry can be stretched to cover.
  const describes = (e, r) =>
    e.rank === r.rank &&
    e.name === r.name &&
    e.set === r.set &&
    e.listing === r.listing &&
    e.product === r.product;
  const sound = (e) => Boolean(e.why) && Boolean(e.decided);

  const unexplained = disagreeing.filter(
    (r) => !entries.some((e) => describes(e, r) && sound(e)),
  );
  if (unexplained.length) {
    throw new Error(
      `${unexplained.length} row(s) in ${file} disagree between ` +
        `the listing page and the product page with no recorded reason:\n` +
        unexplained
          .map(
            (r) =>
              `  #${r.rank} ${r.name} (${r.set})  listing ${r.listing}  product ${r.product}`,
          )
          .join("\n") +
        `\nDo not publish either number. Work out WHY the two pages differ ` +
        `first: a disagreement can mean the parse is broken everywhere, which ` +
        `is what this gate is really guarding against. If it turns out to be ` +
        `about that one card, add an entry to the top-level \`excluded\` array ` +
        `in ${file} carrying rank, name, set, listing, product, ` +
        `decided and why. The row stays unpublished either way.`,
    );
  }

  const stale = entries.filter((e) => !disagreeing.some((r) => describes(e, r)));
  if (stale.length) {
    throw new Error(
      `${stale.length} entr(y/ies) in ${file} \`excluded\` no ` +
        `longer describe a disagreeing row:\n` +
        stale.map((e) => `  #${e.rank} ${e.name} (${e.set})`).join("\n") +
        `\nThe data moved on and the exemption did not. Delete the entry, or ` +
        `re-decide it against the readings that are actually in the file now. ` +
        `An exemption left parked is how the next disagreement gets waved ` +
        `through without anybody looking at it.`,
    );
  }

  return {
    verified: new Map(rows.map((r) => [r.rank, r])),
    excluded: new Map(entries.map((e) => [e.rank, e])),
  };
}
