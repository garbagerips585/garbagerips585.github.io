// Where this site lives.
//
// Every canonical, every og:url, every sitemap entry and the JSON-LD all derive
// from this. It used to be a `const SITE` repeated in five generators, all
// pointing at garbagerips585.com, which nobody owns yet. The result was a live
// site on github.io telling search engines its real address was a domain that
// does not resolve, and telling every social network to fetch its preview image
// from there too, so sharing a link produced a blank card.
//
// SWITCHING TO THE REAL DOMAIN, once it is bought and attached:
//   1. set LIVE to true below
//   2. node scripts/build-all.mjs
//   3. commit and push
// That regenerates every canonical, the sitemap and robots.txt in one go.

/** Flip to true the day garbagerips585.com is attached to the site. */
export const LIVE = false;

export const DOMAIN = "https://garbagerips585.com";
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
