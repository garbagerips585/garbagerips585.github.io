// One definition of a rip page's URL, shared by the sync script, the page
// generator and the browser. If these ever disagreed, tiles would link to
// pages that do not exist.

/** Title -> url-safe slug. Emoji and punctuation are dropped. */
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Site-relative path for a video's own page. The id is always appended so the
 * URL stays unique even if two rips share a title, and stays valid if a title
 * is edited later.
 */
export function ripPath(video) {
  const slug = slugify(video.title || "");
  return `rip/${slug ? slug + "-" : ""}${video.id}.html`;
}

/* WHERE A SET'S GUIDE LIVES. Almost every guide is /sets/<slug>.html, and one is
   not: the 30th Celebration's guide is /30th-celebration.html, and the file at
   /sets/30th-celebration.html is a noindex redirect stub kept only so an old link
   does not 404. Three pages were linking the STUB -- /most-expensive-sealed.html
   four times, and /openings/blister.html and /openings/tin.html once each --
   because two builders each wrote `/sets/${slug}.html` by hand, so every one of
   those links cost a reader a redirect and pointed a crawler at a noindex page.
   Found by a full-site link audit on 23 September 2026. One helper, so a set that
   later moves off /sets/ is a one-line change here rather than a hunt. */
const GUIDE_AT_ROOT = new Set(["30th-celebration"]);
export function setGuideHref(slug) {
  return GUIDE_AT_ROOT.has(slug) ? `/${slug}.html` : `/sets/${slug}.html`;
}
