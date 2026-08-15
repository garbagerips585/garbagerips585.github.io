// The official rarity key, and how a rip's hits get read out of one free text
// field.
//
//   raritiesIn("Surging Sparks - Feebas - Single Gold Star - Illustration Rare")
//     -> ["ir"]
//   rarityMark("sir")  -> inline SVG of two gold stars
//
// THE KEY ITSELF is printed in the booklet that ships inside a modern set, and
// Tim photographed it on 15 August 2026:
//
//   one black diamond ......... Uncommon
//   one black star ............ Rare
//   two black stars ........... Double Rare
//   two silver stars .......... Ultra Rare
//   one gold star ............. Illustration Rare
//   two gold stars ............ Special Illustration Rare
//   one yellow point star ..... Mega Hyper Rare
//
// Two tiers are not on that page and the site still needs them. Hyper Rare is
// three gold stars and predates the Mega era. Charizard is not a rarity at all;
// it is its own category on this channel, because a Charizard at any rarity is
// the pull people came for.
//
// ============================================================================
// WHY THESE ARE DRAWN AND NOT EMOJI.
//
// The ask was "emojis to indicate the rarity level". Emoji cannot express this
// key, and the reason is the whole point of the key: the tier is the COLOUR of
// the star as much as the count. There is exactly one star emoji in wide use
// and it is gold. There is no silver star and no black star, so Ultra Rare,
// Double Rare and Rare would all have to render as the same yellow shape as
// Illustration Rare, which inverts the meaning rather than conveying it.
//
// Drawn stars also render identically on every device, where emoji are drawn by
// the operating system and change shape between Apple, Google and Windows.
//
// And the site already draws its own booster wrappers rather than reproducing
// official pack art. Drawing the star row is the same decision.
// ============================================================================
//
// PARSING ONE FIELD RATHER THAN ASKING FOR SEVERAL. Tim writes a hit as
// "Set - Card - Star description - Rarity" and separates several with commas,
// because a single rip can produce cards at different tiers and splitting that
// across columns cannot express it. So the rarity is READ OUT of the text
// rather than typed twice. Longest names are matched first, or "Special
// Illustration Rare" would match the "Illustration Rare" rule and then the
// "Rare" rule and report three tiers where there is one.

/** id -> what it is called, how many stars, and what colour they are. */
export const RARITY_KEY = [
  { id: "mega-hyper", label: "Mega Hyper Rare", stars: 1, tone: "mega", short: "Mega Hyper" },
  { id: "gold", label: "Hyper Rare", stars: 3, tone: "gold", short: "Hyper" },
  { id: "sir", label: "Special Illustration Rare", stars: 2, tone: "gold", short: "SIR" },
  { id: "ir", label: "Illustration Rare", stars: 1, tone: "gold", short: "IR" },
  { id: "ace-spec", label: "ACE SPEC Rare", stars: 1, tone: "pink", short: "ACE SPEC" },
  { id: "ultra", label: "Ultra Rare", stars: 2, tone: "silver", short: "Ultra" },
  { id: "double-rare", label: "Double Rare", stars: 2, tone: "black", short: "Double" },
  { id: "rare", label: "Rare", stars: 1, tone: "black", short: "Rare" },
  { id: "charizard", label: "Charizard", stars: 0, tone: "fire", short: "Charizard" },

  // ==========================================================================
  // JAPAN AND KOREA SHARE ONE LADDER, AND IT IS LETTERS RATHER THAN STARS.
  // Both print a letter code on the back of the wrapper and on the card itself
  // instead of a star row. Tim photographed a Japanese pack and a Korean pack
  // on 2026-08-15 and the codes are IDENTICAL, only the spelled-out names are
  // translated: SAR is スペシャルアートレア on the Japanese wrapper and
  // 스페셜아트레어 on the Korean one, and both print the same three letters.
  // So one set of tiers covers both regions and the `jp-` prefix is a naming
  // accident rather than a scope limit.
  //
  //   SAR  Special Art Rare   スペシャルアートレア / 스페셜아트레어
  //   SR   Super Rare         スーパーレア        / 수퍼레어
  //   AR   Art Rare           アートレア          / 아트레어
  //   RR   Double Rare        ダブルレア          / 더블레어
  //   R    Rare               レア                / 레어
  //   U    Uncommon           アンコモン          / 언커먼
  //   C    Common             コモン              / 커먼
  //
  // These are kept SEPARATE from the English tiers rather than mapped onto
  // them. SAR and Special Illustration Rare are close cousins, not the same
  // thing, and asserting an equivalence the two companies do not publish would
  // be this site inventing a fact. A Japanese rip shows Japanese letters.
  //
  // ONE THING ON BOTH WRAPPERS IS DELIBERATELY NOT USED. The key sits beside an
  // arrow reading 出にくい / 나오기 어렵다 at the top and 出やすい / 나오기 쉽다
  // at the bottom, "harder to get" and "easier to get". That is a relative ordering with no numbers, and
  // turning it into anything quantitative would be a pull rate. The 種類 counts
  // beside each row ARE safe: they say how many KINDS of card exist at that
  // rarity in the set, which is checklist composition, not odds.
  // ==========================================================================
  { id: "jp-sar", label: "Special Art Rare", code: "SAR", jp: true, short: "SAR" },
  { id: "jp-sr", label: "Super Rare", code: "SR", jp: true, short: "SR" },
  { id: "jp-ar", label: "Art Rare", code: "AR", jp: true, short: "AR" },
  { id: "jp-rr", label: "Double Rare", code: "RR", jp: true, short: "RR" },
  { id: "jp-r", label: "Rare", code: "R", jp: true, short: "R" },
  { id: "jp-u", label: "Uncommon", code: "U", jp: true, short: "U" },
  { id: "jp-c", label: "Common", code: "C", jp: true, short: "C" },
];

const BY_ID = new Map(RARITY_KEY.map((r) => [r.id, r]));

// Match longest first. "Special Illustration Rare" has to win over
// "Illustration Rare", which has to win over "Rare".
const PATTERNS = [
  // Japanese letter codes first, and CASE SENSITIVE on purpose. Lowercase "ar"
  // and "r" appear inside ordinary words constantly; the codes are printed in
  // capitals and only capitals should match.
  //
  // ONLY THE MULTI-LETTER CODES ARE PARSED. R, U and C are in the key above so
  // it documents the whole ladder and can render them, but they are NOT matched
  // from free text, because a single capital letter is not a rarity in a
  // sentence full of card names. Tested adversarially: "Marnie C" parsed as
  // Japanese Common and "Team Rocket U" as Japanese Uncommon, which would have
  // labelled two English rips as Japanese. Dropping them costs nothing real
  // either, because Common and Uncommon are not hits and a hit field is where
  // this text comes from.
  ["jp-sar", /\bSAR\b/g],
  ["jp-ar", /\bAR\b/g],
  ["jp-rr", /\bRR\b/g],
  ["mega-hyper", /\bmega\s+hyper\s+rare\b/gi],
  ["sir", /\bspecial\s+illustration\s+rare\b|\bSIR\b/g],
  ["jp-sr", /\bSR\b|\bsuper\s+rare\b/gi],
  ["ir", /\billustration\s+rare\b/gi],
  ["gold", /\bhyper\s+rare\b/gi],
  ["ace-spec", /\bace\s*spec(?:\s+rare)?\b/gi],
  ["ultra", /\bultra\s+rare\b/gi],
  ["double-rare", /\bdouble\s+rare\b/gi],
  ["charizard", /\bcharizard\b|\bzard\b/gi],
  // Last, and only where nothing longer already claimed that span.
  ["rare", /\brare\b/gi],
];

/**
 * Every rarity named anywhere in a free text hit field, in key order.
 * Overlapping matches are resolved by blanking each match out of the working
 * copy as it is found, so a longer name consumes the text a shorter one would
 * otherwise match inside.
 */
export function raritiesIn(text) {
  if (!text) return [];
  let work = String(text);
  const found = new Set();
  for (const [id, re] of PATTERNS) {
    const rx = new RegExp(re.source, re.flags.includes("i") ? "gi" : "g");
    if (rx.test(work)) {
      found.add(id);
      work = work.replace(new RegExp(re.source, re.flags.includes("i") ? "gi" : "g"), " ");
    }
  }
  return RARITY_KEY.filter((r) => found.has(r.id)).map((r) => r.id);
}

/** The best single tier in a free text field, for a one badge summary. */
export function topRarity(text) {
  return raritiesIn(text)[0] || null;
}

/**
 * The star row for one tier, drawn.
 *
 * Mega Hyper Rare is a four point star rather than a five point one, matching
 * the booklet. Charizard has no stars at all because it is not a rarity, so it
 * gets the flame instead of pretending to a tier it does not have.
 */
export function rarityMark(id) {
  const r = BY_ID.get(id);
  if (!r) return "";
  // Japanese tiers print a letter code, so that is what gets drawn. Same
  // principle as the stars: show what is actually on the card.
  if (r.jp) return `<span class="rk rk-jp" title="${r.label} (${r.code}, Japanese and Korean sets)">${r.code}</span>`;
  if (r.tone === "fire") {
    return `<span class="rk rk-fire" title="${r.label}"><svg viewBox="0 0 12 14" aria-hidden="true" focusable="false"><path d="M6 0C6 4 2 4.5 2 8.5A4 4 0 0 0 10 8.5C10 5.5 7.5 5 7.5 2.5 7.5 4.5 6 4 6 0Z"/></svg></span>`;
  }
  const star =
    r.tone === "mega"
      ? `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 0 7.4 4.6 12 6 7.4 7.4 6 12 4.6 7.4 0 6 4.6 4.6Z"/></svg>`
      : `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 .6 7.6 4.3 11.6 4.6 8.5 7.2 9.5 11.1 6 9 2.5 11.1 3.5 7.2 .4 4.6 4.4 4.3Z"/></svg>`;
  return `<span class="rk rk-${r.tone}" title="${r.label}">${star.repeat(r.stars)}</span>`;
}

/** Badge: the drawn stars plus the name, for a chip row. */
export function rarityChip(id, { short = false } = {}) {
  const r = BY_ID.get(id);
  if (!r) return "";
  return `<span class="chip chip-rk">${rarityMark(id)}${short ? r.short : r.label}</span>`;
}

export const rarityLabelOf = (id) => (BY_ID.get(id) || {}).label || "";

/** The CSS, kept beside the key so the two cannot drift apart. */
export const RARITY_CSS = `
.rk{display:inline-flex;align-items:center;gap:1px;vertical-align:-1px;margin-right:5px}
.rk svg{width:11px;height:11px;display:block}
.rk-gold svg{fill:#E0A21F}
.rk-mega svg{fill:#F5D142;stroke:#8A6109;stroke-width:.8}
.rk-silver svg{fill:#9FB0C0}
.rk-black svg{fill:var(--navy)}
.rk-pink svg{fill:#D96BA0}
.rk-fire svg{fill:var(--ketchup);width:10px;height:12px}
.rk-jp{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.04em;color:#F4F1E2;background:var(--navy);
  border-radius:3px;padding:3px 5px}
.chip-rk{display:inline-flex;align-items:center}
`;

// ============================================================================
// READING A WHOLE HIT OUT OF THE ONE FREE TEXT FIELD.
//
//   parseHits("Journey Together - Trainer - Ruffian - Double Silver Star - Ultra Rare",
//             setNames)
//     -> [{ set: "journey-together", card: "Trainer Ruffian", rarity: "ultra" }]
//
// Tim writes a hit as `Set - Card - Star description - Rarity` and separates
// several with commas, because one rip can produce cards from several sets at
// several tiers. The set pages want that: landing on Phantasmal Flames should
// show everything pulled from Phantasmal Flames, and until now they could only
// show cards typed one-per-row on the My Hits tab, which covered 2 of the 11
// logged videos.
//
// CONSERVATIVE ON PURPOSE. A hit attributed to the wrong set is worse than a
// hit that does not appear, because the reader cannot tell it is wrong. So a
// fragment only produces a hit when its FIRST segment matches a set name we
// actually know. Anything else is returned in `unmatched` for a human to look
// at rather than guessed into place.
//
// It also does NOT try to match the card against a checklist or attach a price.
// "Trainer - Ruffian" is a person's shorthand, not a catalogue key, and a fuzzy
// match onto a real card number would put a price on the page that nobody
// verified. The card name renders as typed.
// ============================================================================

const norm = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * @param {string} text        the Hit Card cell
 * @param {Map<string,string>} setsByName  normalised set name -> set id
 */
export function parseHits(text, setsByName) {
  if (!text) return { hits: [], unmatched: [] };
  const hits = [];
  const unmatched = [];

  for (const raw of String(text).split(",")) {
    const frag = raw.trim();
    if (!frag) continue;
    const parts = frag.split(/\s+-\s+|\s+-\s*$/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    const setId = setsByName.get(norm(parts[0]));
    if (!setId) {
      unmatched.push(frag);
      continue;
    }
    // Drop the trailing rarity words and the star description, whatever is
    // left in the middle is what he called the card.
    const middle = parts.slice(1).filter((p) => {
      const n = norm(p);
      if (/\bstar\b|\bholo\b|\bpromo\b/.test(n)) return false;
      if (raritiesIn(p).length && norm(p).split(" ").length <= 4) return false;
      return true;
    });
    const card = middle.join(" ").replace(/\s+/g, " ").trim();
    const rarity = raritiesIn(frag)[0] || null;
    if (!card) {
      unmatched.push(frag);
      continue;
    }
    hits.push({ set: setId, card, rarity });
  }
  return { hits, unmatched };
}
