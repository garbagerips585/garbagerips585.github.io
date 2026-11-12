/* THE LAST PASS OVER TEXT THAT GOES INTO A SEARCH RESULT. 11 November 2026.
 *
 * A rip page's and a playlist page's meta description is the owner's own
 * YouTube description, clipped. Two of the site's copy rules were reaching
 * search results broken through that one route, and nowhere else:
 *
 *   an EN dash   plainDashes() in shared/format.mjs takes EM dashes out of the
 *                quoted YouTube copy and deliberately turns a number range
 *                into an en dash. Four indexable descriptions carried an en
 *                dash the owner typed ("Scarlet & Violet [en dash] Paradox
 *                Rift"), which that function was never meant to touch.
 *   "Rochester"  there is more than one, and the rule is that the site always
 *                says which. One description says "in the Rochester area", and
 *                another was cut by the clip BETWEEN "Rochester," and "NY",
 *                shipping a bare "Rochester,..." made by this site rather than
 *                written by anybody.
 *
 * META AND OG DESCRIPTIONS ONLY. The visible blurb on the page, the video's
 * title, the h1 and the VideoObject schema are the owner's words verbatim and
 * none of them go through this. Titles are not passed through it either: the
 * two rip titles with a bare Rochester are "JCC Rochester Pickups!", where it
 * is part of a venue's name, and "(Rochester's Pokemon)", whose own
 * description already says "Rochester, NY's" one line below it.
 *
 * A PROPER NAME IS LEFT ALONE. "Rochester" directly followed by a capitalized
 * word or an ampersand (Rochester CCG, Rochester Red Wings, Rochester &
 * Genesee Valley, Rochester MINNESOTA) or directly after one of the words that
 * make it part of a name (Greater Rochester, Visit Rochester, JCC Rochester,
 * Fest Rochester, City of Rochester) is somebody's name for something, not the
 * city in a sentence.
 */
const NAME_BEFORE = /(?:Greater|Visit|JCC|Fest|of|Downtown)\s+$/;

/** Em and en dashes to plain punctuation: a hyphen in a range or a spaced clause, a comma when unspaced. */
export const metaDashes = (s) =>
  String(s ?? "")
    .replace(/(\d)\s*[\u2013\u2014]\s*(?=\d)/g, "$1-")
    .replace(/\s+[\u2013\u2014]\s+/g, " - ")
    .replace(/(?<=\S)\u2014(?=\S)/g, ", ")
    .replace(/(?<=\S)\u2013(?=\S)/g, "-");

/** A bare "Rochester" in a sentence becomes "Rochester, NY"; names and already qualified ones are untouched. */
export const rochesterNY = (s) =>
  String(s ?? "").replace(/\bRochester\b(?!,?\s*(?:NY\b|N\.Y\.|New York))/g, (m, at, all) => {
    const after = all.slice(at + m.length);
    if (/^\s+(?:[A-Z]|&)/.test(after)) return m;
    if (NAME_BEFORE.test(all.slice(0, at))) return m;
    return "Rochester, NY";
  });

export const metaText = (s) => rochesterNY(metaDashes(s));

/**
 * Clip with `clipFn(text, n)` without ever cutting between "Rochester," and
 * "NY". The pair is glued with a private-use character for the cut, so a word
 * boundary cut keeps both or drops both, and unglued afterwards.
 */
export const clipMetaText = (s, clipFn, n = 158) =>
  clipFn(metaText(s).replace(/Rochester, (NY|New York)/g, "Rochester,\uE000$1"), n).replace(/\uE000/g, " ");
