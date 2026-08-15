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
  // Japanese sets run their own ladder and SR is a real tier on it. Without
  // this the phrase "Super Rare" fell through to plain "Rare", which is two
  // tiers down and the opposite of what it means.
  { id: "super", label: "Super Rare", stars: 2, tone: "gold", short: "SR" },
  { id: "double-rare", label: "Double Rare", stars: 2, tone: "black", short: "Double" },
  { id: "rare", label: "Rare", stars: 1, tone: "black", short: "Rare" },
  { id: "charizard", label: "Charizard", stars: 0, tone: "fire", short: "Charizard" },
];

const BY_ID = new Map(RARITY_KEY.map((r) => [r.id, r]));

// Match longest first. "Special Illustration Rare" has to win over
// "Illustration Rare", which has to win over "Rare".
const PATTERNS = [
  ["mega-hyper", /\bmega\s+hyper\s+rare\b/gi],
  ["sir", /\bspecial\s+illustration\s+rare\b|\bSIR\b/g],
  ["ir", /\billustration\s+rare\b/gi],
  ["gold", /\bhyper\s+rare\b/gi],
  ["ace-spec", /\bace\s*spec(?:\s+rare)?\b/gi],
  ["ultra", /\bultra\s+rare\b/gi],
  ["super", /\bsuper\s+rare\b/gi],
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
.chip-rk{display:inline-flex;align-items:center}
`;
