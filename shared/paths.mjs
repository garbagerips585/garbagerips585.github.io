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
