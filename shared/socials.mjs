/* One list of platforms for shops, vendors and creators.
 *
 * THIS LIVED IN build-locals.mjs AND SHOPS GREW A SECOND, WORSE COPY. On 27
 * August 2026 the first shop answered the outreach email with four social links
 * and shops.json had nowhere to put them, so a `socials: {platform: url}` object
 * was added to that one builder. It worked and it was the wrong shape: it stores
 * whole urls rather than handles, it carries no glyphs, and it meant two files
 * disagreed about how to write "YouTube". Vendors and creators had the better
 * system already. This is that system, moved out so all three share it.
 *
 * HANDLES IN, LINKS OUT, and that is the part worth keeping. A row stores
 * `instagram: "thelegacygamestore"`, not a url, so the day a platform changes
 * its url shape it is one edit here rather than an edit to every row in three
 * files. Discord is the exception and is stored as its invite code for the same
 * reason: the code is the durable part, discord.com/invite is not.
 */

// Handle in, link out.
export const SOCIALS = [
  ["youtube", "YouTube", (h) => `https://www.youtube.com/@${h}`],
  ["instagram", "Instagram", (h) => `https://www.instagram.com/${h}/`],
  ["tiktok", "TikTok", (h) => `https://www.tiktok.com/@${h}`],
  ["twitch", "Twitch", (h) => `https://www.twitch.tv/${h}`],
  ["facebook", "Facebook", (h) => `https://www.facebook.com/${h}`],
  ["discord", "Discord", (h) => `https://discord.com/invite/${h}`],
  ["whatnot", "Whatnot", (h) => `https://www.whatnot.com/user/${h}`],
  ["ebay", "eBay", (h) => `https://www.ebay.com/usr/${h}`],
];

/* FOUR OF THE EIGHT GET A GLYPH AND THE OTHERS MUST NOT. The site draws
 * YouTube, Instagram, TikTok and Facebook marks already, as a sprite that is on
 * every page for the footer, so those cost no bytes. Twitch, Discord, Whatnot
 * and eBay stay as words: we do not hold those marks, and CLAUDE.md's rule,
 * written when Collectr was linked without one, is that inventing a logo to sit
 * beside four real ones is worse than a named text link. */
export const GLYPH = { youtube: "yt", instagram: "ig", tiktok: "tt", facebook: "fb" };

/** Every social link on a row, in a fixed order, as {key, label, href}. */
export const socialLinks = (o) =>
  SOCIALS.filter(([k]) => o[k]).map(([k, label, url]) => ({ key: k, label, href: url(o[k]) }));
