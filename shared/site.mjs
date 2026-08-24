// Where this site lives.
//
// Every canonical, every og:url, every sitemap entry and the JSON-LD all derive
// from this. It used to be a `const SITE` repeated in five generators, all
// pointing at a domain nobody owns yet. The result was a live
// site on github.io telling search engines its real address was a domain that
// does not resolve, and telling every social network to fetch its preview image
// from there too, so sharing a link produced a blank card.
//
// SWITCHING TO THE REAL DOMAIN, once it is bought and attached:
//   1. set LIVE to true below
//   2. node scripts/build-all.mjs
//   3. commit and push
// That regenerates every canonical, the sitemap and robots.txt in one go.

/** Flip to true the day garbagerips.com is attached to the site.
 *
 * THE DOMAIN DROPS THE 585 AND THE BRAND KEEPS IT. The owner, 18 August 2026: "im
 * actually going to buy garbagerips.com as the main domain leave out the 585 so
 * its shorter and easier for people to remember the domain name". The channel
 * is still Garbage Rips 585, the wordmark still reads 585, and every page still
 * says Rochester, NY. Only the address is shorter, because an address is heard
 * and retyped and a brand is not. Do NOT strip 585 from copy, titles or the
 * wordmark to "match" the domain: they are different things doing different
 * jobs. */
export const LIVE = true;

export const DOMAIN = "https://garbagerips.com";
export const STAGING = "https://garbagerips585.github.io";

/** The base URL every generated absolute link is built from. */
export const SITE = LIVE ? DOMAIN : STAGING;

/**
 * robots.txt.
 *
 * While staging, crawling is disallowed. Not because the content is secret,
 * but because a second indexed copy of the whole site at a temporary address
 * is a mess to unwind: the real domain would launch already competing with
 * itself, and every ranking signal earned in the meantime would sit on a URL
 * that is about to be abandoned.
 */
export const robots = () =>
  LIVE
    ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
    : `# Staging. This is the pre-launch address; the site will live at\n` +
      `# ${DOMAIN}. Crawling is off so the temporary copy never gets indexed\n` +
      `# and does not end up competing with the real domain at launch.\n` +
      `User-agent: *\nDisallow: /\n`;

/**
 * The channel's public inbox.
 *
 * ONE CONSTANT BECAUSE AN ADDRESS TYPED TWICE IS AN ADDRESS WRONG ONCE. The
 * local section asks people to send in shops, shows, vendors and creators, and
 * the ask is worthless if the route to send it changes between pages or gets a
 * character wrong on one of them.
 *
 * PLAIN mailto, NOT OBFUSCATED. The point is that a stranger with a shop or a
 * show can reach the owner in one tap from a phone, and every scheme for hiding an
 * address from harvesters either breaks that or needs JavaScript to undo. This
 * is a public channel address that already appears on YouTube, so there is
 * nothing here that hiding it would protect.
 */
export const CONTACT_EMAIL = "garbagerips585@gmail.com";

/**
 * A prefilled mailto for one kind of submission.
 *
 * WHY NOT A FORM, and this was decided on the constraint rather than on taste.
 * The owner, 24 August 2026: people should be able to "send over info and flyers and
 * logos etc". Attachments are the whole answer. This site is static on GitHub
 * Pages and executes nothing -- functions/ was deleted for exactly that reason,
 * see CLAUDE.md -- so a form means a third party, and the free tiers that would
 * host one either refuse file uploads or put them behind an account. A mailto
 * opens the reader's own mail app, where attaching a flyer is one tap and
 * already familiar, and it costs this site no dependency, no script and no
 * privacy surface to explain.
 *
 * PREFILLED, BECAUSE THE COST OF A mailto IS A BLANK MESSAGE. Somebody who
 * means well sends "hi I run a shop" and then there are three emails before
 * anything can be listed. The subject is stamped so the owner can filter, and the
 * body carries the exact fields the card on the page holds, so a first email
 * can contain everything.
 *
 * ENCODED WITH encodeURIComponent AND NEWLINES AS CRLF, which is what RFC 6068
 * asks for and what mail clients actually break lines on.
 *
 * @param {string} subject stamped into the subject line after the site name
 * @param {string[]} lines the fields to prompt for, one per line
 */
export const mailtoHref = (subject, lines = []) => {
  const body = lines.length ? lines.join("\r\n") : "";
  const q = [
    `subject=${encodeURIComponent(`Garbage Rips 585: ${subject}`)}`,
    body ? `body=${encodeURIComponent(body)}` : "",
  ].filter(Boolean).join("&");
  return `mailto:${CONTACT_EMAIL}${q ? `?${q}` : ""}`;
};
