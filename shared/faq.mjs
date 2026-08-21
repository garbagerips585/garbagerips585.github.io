/**
 * ONE ARRAY, RENDERED TWICE: the visible Q&A section AND the FAQPage block.
 *
 * WHY THIS FILE EXISTS. An SEO audit on 21 August 2026 measured every
 * `Question` node in the built tree against the rendered text of its own page:
 * 75 of 104 described content that was nowhere on the page. The question
 * strings existed only inside the `<script type="application/ld+json">`. That
 * is a straight breach of Google's structured-data policy for `FAQPage`, which
 * asks that "the content must be visible to the user on the source page", and
 * since August 2023 FAQ rich results have been restricted to well-known
 * government and health sites, so the markup was earning this site nothing in
 * exchange for the risk. All policy cost, no upside.
 *
 * Three pages were already doing it right -- /start.html, /about.html and
 * /first-partner-illustration-collection.html -- each by building the schema
 * from the same array the visible section renders. This file is that pattern
 * extracted, so the eleven builders that were not doing it can, and so the
 * argument lives in one place instead of eleven.
 *
 * THE SELF-CHECK IS THE POINT, NOT THE MARKUP. `faqBlock` returns the visible
 * html and the JSON-LD together and, before returning either, asserts that the
 * plain text of every schema answer really does occur in the plain text of the
 * markup it is handing back. A builder physically cannot take the schema
 * without the section, and if somebody later edits one of the two renderers and
 * not the other, the BUILD FAILS rather than shipping the old defect in a new
 * form. The normalisation is deliberately the same shape the audit used
 * (tags out, entities in, punctuation flattened) so the gate and the measurement
 * agree on what "visible" means.
 *
 * ANSWERS ARE PLAIN TEXT AND ARE ESCAPED HERE. Two of them say "Scarlet &
 * Violet", which is a bare ampersand in prose and an error in markup. A builder
 * whose answer needs a link passes `{ raw: true }` and escapes its own
 * interpolations, the way build-about.mjs and build-first-partner.mjs do; the
 * schema still gets the tags stripped out of it, because a snippet with an
 * anchor tag in its text is a snippet nobody can render.
 *
 * EVERY ANSWER HAS TO BE SELF-CONTAINED. Google can lift one of these and show
 * it with no page around it, so an answer that is only true in the context of
 * the section above it is an answer that ships wrong. build-base-set.mjs
 * carries the worked example: its shadowless-versus-unlimited answer states the
 * qualifying clause INSIDE the sentence that states the figure, because the two
 * feeds on this site measure different things and a reader who saw only the
 * snippet had nothing to tell them so.
 *
 * NOT EVERY PAGE SHOULD HAVE ONE. The nine /retailers/ pages were measured at
 * 64-67% of their FAQ answer text already on the page, two of the four answers
 * word for word, and their own `<h2>` is already the first question. Rendering
 * a section there would print the page twice, so those pages had the markup
 * deleted instead. The eleven that use this file measured 2-20%: their answers
 * are real copy that no reader could previously see.
 */

import { esc } from "./format.mjs";

/** Tags out, whitespace collapsed. The schema gets prose, never markup. */
const stripTags = (s) =>
  String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/* Entity table for the self-check only. It has to undo what esc() does plus the
   handful of typographic entities the builders write by hand, because the
   comparison is between the ANSWER STRING and the RENDERED MARKUP and those two
   spell the same character differently. */
const ENT = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  bull: " ",
};

const unent = (s) =>
  String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, k) => {
    if (ENT[k] !== undefined) return ENT[k];
    if (k[0] === "#") {
      const n =
        k[1] === "x" || k[1] === "X" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });

/** The audit's own normalisation: what a reader can read, with nothing else. */
const norm = (s) =>
  unent(String(s))
    .replace(/<[^>]*>/g, " ")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The section's CSS. Interpolate into the page's own `<style>` block.
 *
 * PLAIN HEADINGS AND PARAGRAPHS RATHER THAN A DISCLOSURE WIDGET, which is the
 * call build-about.mjs made and argued: content folded behind a `<summary>` is
 * content a reader with no script never opens, and the whole point of the
 * change is that the answers become readable.
 *
 * NO IMAGE, NO WEB FONT OF ITS OWN, NO ASPECT-RATIO-LESS BOX. The section is
 * text in faces the page has already fetched, appended after everything else in
 * `<main>`, so it cannot move anything above it: CLS on these pages was
 * measured at 0.000 before the change and has to stay there.
 *
 * `--ink` on the question and `--ink-2` on the answer, the same pairing every
 * other prose block on the site uses. Both are inks on the card/page greens and
 * neither is an accent, so this adds no colour decision.
 */
export const FAQ_CSS = `.faq-sec{padding:var(--s6) 0}
.faq-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s2)}
.faq-sec .faq-intro{color:var(--ink-2);max-width:44em;margin-bottom:var(--s3)}
.faq-list{max-width:46em}
.faq-list h3{font:600 var(--t-sm)/1.4 var(--body);color:var(--ink);margin:var(--s5) 0 6px}
.faq-list p{color:var(--ink-2);line-height:1.6;margin-bottom:var(--s3)}
.faq-list p:last-child{margin-bottom:0}`;

/**
 * Build the visible section and the FAQPage node from one array.
 *
 * @param {Array<[string,string]>} items  [question, answer] pairs, in the order
 *   they should read on the page. Plain text unless `raw` is set.
 * @param {object} opts
 * @param {string} opts.heading  the section's own `<h2>`. Required, and
 *   deliberately not defaulted: twelve pages carrying an identical heading is
 *   the boilerplate this change is supposed to be the opposite of.
 * @param {string} [opts.id]     the section id, for the schema `@id` and for
 *   linking. Defaults to "faq".
 * @param {string} [opts.path]   site-relative path of the page, e.g.
 *   "/rarity.html". When given with `site`, the FAQPage gets an `@id`.
 * @param {string} [opts.site]   absolute origin from shared/site.mjs.
 * @param {string} [opts.intro]  one optional sentence under the heading.
 * @param {boolean} [opts.raw]   answers already contain markup and are already
 *   escaped by the caller.
 * @param {boolean} [opts.bare] emit a `<div>` with no `<section>` and no
 *   `.wrap` of its own. THREE PAGES NEED THIS AND IT IS NOT A STYLE OPTION:
 *   /how-to-play.html, /tcg-live.html and /tcg-pocket.html render their whole
 *   body inside one `.wrap`, and a second `.wrap` nested in the first pays the
 *   gutter twice. Those three also have to place the section BEFORE their
 *   outbound-link block rather than after it, because CLAUDE.md's fourth and
 *   fifth exceptions make "one block at the very end, after every internal
 *   link" the condition those links exist under.
 * @returns {{html:string, ld:object, css:string, count:number}}
 */
export function faqBlock(items, opts = {}) {
  const { heading, id = "faq", path, site, intro, raw = false, bare = false } = opts;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("faqBlock: needs at least one [question, answer] pair");
  }
  if (!heading) {
    throw new Error("faqBlock: needs an explicit heading, see the note in shared/faq.mjs");
  }
  for (const [q, a] of items) {
    if (!q || !a) throw new Error(`faqBlock: empty question or answer near ${JSON.stringify(q)}`);
  }

  const q = (s) => esc(String(s));
  const a = (s) => (raw ? String(s) : esc(String(s)));

  const inner = `    <h2>${q(heading)}</h2>
${intro ? `    <p class="faq-intro">${raw ? intro : esc(intro)}</p>\n` : ""}    <div class="faq-list">
${items
  .map(([question, answer]) => `      <h3>${q(question)}</h3>\n      <p>${a(answer)}</p>`)
  .join("\n")}
    </div>`;

  const html = bare
    ? `<div class="faq-sec" id="${esc(id)}">\n${inner}\n</div>`
    : `<section class="faq-sec" id="${esc(id)}">\n  <div class="wrap">\n${inner}\n  </div>\n</section>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(site && path ? { "@id": `${site}${path}#${id}` } : {}),
    mainEntity: items.map(([question, answer]) => ({
      "@type": "Question",
      name: stripTags(question),
      acceptedAnswer: { "@type": "Answer", text: stripTags(answer) },
    })),
  };

  /* THE GATE. Normalised markup on one side, normalised schema on the other.
     A miss here is the exact defect this file exists to prevent, so it throws
     rather than warns: a build that ships it is worse than a build that stops. */
  const visible = norm(html);
  for (const node of ld.mainEntity) {
    const nq = norm(node.name);
    const na = norm(node.acceptedAnswer.text);
    if (!visible.includes(nq)) {
      throw new Error(`faqBlock: question is not in the rendered section: ${node.name}`);
    }
    if (!visible.includes(na)) {
      throw new Error(`faqBlock: answer is not in the rendered section: ${node.name}`);
    }
  }

  return { html, ld, css: FAQ_CSS, count: items.length };
}
