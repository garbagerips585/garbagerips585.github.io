# Page titles and meta descriptions

Covers why titles carry no brand suffix, where the suffix stayed, and why meta descriptions were not trimmed.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## Page titles carry no "| Garbage Rips 585" suffix, and that is deliberate

Removed 17 August 2026 from every group where it could only ever truncate.
Measured in headless Chrome with canvas measureText at 20px Arial, which is
what Google's desktop result actually renders: titles over the ~580px cut went
**1,177 of 1,262 to 71**, median 683.1px to 506.5px. The Pokemon pages went
844 over the cut to 0.

**DO NOT "RESTORE" IT.** The brand is not lost: `og:site_name` is on all 1,262
indexable pages and that is what Google reads for the site-name line beside a
result. A suffix that gets cut off adds nothing and costs the tail of every
title it sits behind.

Where it stayed, and why, because these are not oversights:

- **English set guides.** `setTitle` in build-set-pages.mjs already solves this
  a better way: it drops the DESCRIPTOR rather than the brand, and 26 of 27 fit.
  That is argued work in that file. Leave it.
- **Retailer pages and most game pages.** The suffix renders in full there, so
  removing it would lose brand for nothing.
- **51 rip pages still over the cut.** Those titles are the owner's own YouTube titles
  verbatim, and rewriting them would break the correspondence between the page
  and the video it is about.
- **/index.html and /about.html**, where the brand is at the FRONT and is the
  distinguishing word rather than a suffix.

ONE CORRECTION WORTH KEEPING: an audit reported that the suffix was displacing
distinguishing words on the Pokemon pages. It was not. Their core titles were
468-558px, already inside the cut, so only the brand was being cut and the win
there is polish. Where content genuinely was being lost was the international
set guides, where the cut ate "English Equivalent", which is the entire point
of those pages, and the long rip titles, where it ate the pack number.

META DESCRIPTIONS WERE DELIBERATELY NOT TRIMMED. Nearly all of them exceed the
~920px cut, but they front-load and the complete first sentence survives;
shortening them would delete the sourcing detail (read dates, methodology) that
is the reason to trust the numbers, and description length is not a ranking
factor. There is one real CTR idea recorded here rather than done: on the 844
Pokemon pages the most clickable fact ("The priciest is X at $Y") sits behind
the cut, and moving it forward would help. It is an 844-page rewrite.
