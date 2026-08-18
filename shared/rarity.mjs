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
  // SEPARATORS: a space, a hyphen or a slash. Everything used to require \s+,
  // so "Ultra-Rare" matched none of the real tiers and fell through to the bare
  // "Rare" rule, reporting a real but two-tiers-too-low rarity. That is worse
  // than reporting nothing.
  //
  // CASE: every spelled-out tier is case-insensitive. The SIR rule was the one
  // exception, carrying no `i` flag, so "Special Illustration Rare" as anyone
  // would actually type it matched nothing and was then claimed by the
  // case-insensitive Illustration Rare rule below it. Thirty-four of the sixty
  // four filled rarity cells say Special Illustration Rare, so this was going
  // to fire the first time one reached a hit field.
  //
  // The LETTER CODES stay case-sensitive and are matched only where the string
  // has no lowercase word attached, because "AR" appears inside ordinary
  // English hit text and "Sr" is a name suffix.
  ["mega-hyper", /\bmega[\s\-/]+hyper[\s\-/]+rare\b/gi],
  ["sir", /\bspecial[\s\-/]+illustration[\s\-/]+rare\b/gi],
  ["sir", /\bSIR\b/g],
  ["ir", /\billustration[\s\-/]+rare\b/gi],
  ["gold", /\bhyper[\s\-/]+rare\b/gi],
  ["ace-spec", /\bace[\s\-/]*spec(?:[\s\-/]+rare)?\b/gi],
  ["ultra", /\bultra[\s\-/]+rare\b/gi],
  ["jp-sr", /\bsuper[\s\-/]+rare\b/gi],
  // The bare letter codes only count as their OWN segment: start of string, end
  // of string, or fenced by a dash or a comma, which is exactly how they are
  // written ("Cyber Judge - Incineroar ex - SR - Super Rare"). Matching them as
  // loose words tagged "Team Rocket AR Deck" as a Japanese Art Rare, putting a
  // Japanese badge on an English rip.
  ["jp-sar", /\bspecial[\s\-/]+art[\s\-/]+rare\b/gi],
  ["jp-sar", /(?:^|[-,])\s*SAR\s*(?=[-,]|$)/g],
  ["jp-ar", /\bart[\s\-/]+rare\b/gi],
  ["jp-sr", /(?:^|[-,])\s*SR\s*(?=[-,]|$)/g],
  ["jp-ar", /(?:^|[-,])\s*AR\s*(?=[-,]|$)/g],
  ["jp-rr", /(?:^|[-,])\s*RR\s*(?=[-,]|$)/g],
  // jp-r, jp-u and jp-c had no entry here at all, so three of the seven
  // Japanese tiers could never be produced by the parser that lists them.
  // Only the spelled-out forms: the bare letters R, U and C are single capitals
  // and match inside ordinary card names, which is tested and documented above.
  ["jp-u", /\buncommon\b/gi],
  ["jp-c", /\bcommon\b(?!\s*\/)/gi],
  ["double-rare", /\bdouble[\s\-/]+rare\b/gi],
  ["charizard", /\bcharizard\b|\bzard\b/gi],
  // Last, and never inside a card NAME. "Rare Candy" is a real Trainer card in
  // these sets and it is not a rarity, so a following capitalised word rules
  // the match out.
  // The English "rare" rule must not fire inside a Japanese tier name. Art
  // Rare, Super Rare, Special Art Rare and Double Rare all contain the word,
  // and because the English tier sorts first in RARITY_KEY a Japanese card was
  // getting an English black-star badge. Those names are consumed above; this
  // only sees what is left.
  ["rare", /\brare\b(?!\s+[A-Z])/gi],
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
  // A JAPANESE CARD WEARS THE JAPANESE BADGE. "RR - Double Rare" legitimately
  // matches both notations for one tier, and because the English tier sorts
  // first in RARITY_KEY the card came out wearing an English black star. Where
  // both notations for the same tier are present, the letter code wins: it is
  // what is printed on that card.
  const JP_EQUIV = { "jp-sar": "sir", "jp-ar": "ir", "jp-rr": "double-rare", "jp-r": "rare" };
  for (const [jp, en] of Object.entries(JP_EQUIV)) {
    if (found.has(jp)) found.delete(en);
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
/* THESE MARKS DEPICT PRINTED FOIL, so they are read as artwork rather than as
   chrome: the whole point of the key is that a silver star and a black star are
   DIFFERENT RARITIES, and Ultra Rare and Double Rare are both TWO stars, so the
   colour is the only thing telling them apart. Darkening silver for contrast
   would collapse the pair it exists to separate.
   The golds follow the palette instead of carrying their own literals (they
   were #E0A21F, #F5D142 and #8A6109, the pre-"Black / White / Gold" values), so
   the site does not end up with two different golds beside each other. */
.rk-gold svg{fill:var(--gold)}
.rk-mega svg{fill:var(--mustard);stroke:var(--gold-deep);stroke-width:.8}
/* SILVER STAYS LIGHT AND GAINS AN EDGE. --chrome-dim on white is 2.43:1 and the
   #9FB0C0 it replaced was 2.22:1, so this never cleared 1.4.11 on its own. It
   cannot be solved by darkening (see above), so it is solved the way .rk-mega
   already solves it: a hairline stroke, at 4.54:1 on white, draws the shape.
   The star is aria-hidden and rarityChip always prints the rarity's NAME beside
   it, so the colour was never the only cue for a reader either way. */
.rk-silver svg{fill:#C6C6C6;stroke:#767676;stroke-width:.8}
.rk-black svg{fill:var(--navy)}
/* The ACE SPEC mark is printed pink and this is the one place the site draws
   it. Left alone, like the pack art: it is a picture of a symbol on a card, not
   a piece of site chrome. One 11px glyph, always captioned. */
.rk-pink svg{fill:#D96BA0}
.rk-fire svg{fill:var(--ketchup);width:10px;height:12px}
.rk-jp{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.04em;color:var(--chrome-ink);background:var(--band-bg);
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
    // THE CARD NAME IS NOT A RARITY, EVEN WHEN IT LOOKS LIKE ONE. This dropped
    // any segment that parsed as a tier, and "Charizard" IS a tier here, so
    // every hit whose card is a Charizard had its name filtered away, came out
    // empty and vanished from the site entirely. On a channel whose headline
    // pull is a Charizard. It was masked only because the one live example also
    // had a typo in its set name and had already been hand-written into
    // hits.json to work around it.
    //
    // A segment is only discarded when it is a rarity AND NOTHING ELSE. A tier
    // name with anything else attached, "Charizard ex", "Mega Charizard X ex",
    // is a card.
    const RARITY_ONLY = new Set(RARITY_KEY.map((r) => norm(r.label)));
    const middle = parts.slice(1).filter((p) => {
      const n = norm(p);
      if (!n) return false;
      if (/\bstar\b|\bholo\b|\bpromo\b/.test(n)) return false;
      if (RARITY_ONLY.has(n)) return false;
      return true;
    });
    const card = middle.join(" ").replace(/\s+/g, " ").trim();
    const rarity = raritiesIn(frag)[0] || null;
    // A BLACK STAR PROMO IS NOT A CARD IN THAT SET, and reading it as one is
    // how a $99 promo came out as a 57 cent common. The Charizard UPC ships two
    // MEP promos, and the log names the set they were pulled alongside:
    // "Phantasmal Flames - Oricorio ex - Black Star Promo Card". Matching that
    // against the Phantasmal Flames checklist finds a DIFFERENT Oricorio ex,
    // and the site then showed the cheap one on the set page with its scan and
    // its price, which is worse than showing nothing because it looks right.
    //
    // The words are already in the sentence, so the fix is to believe them.
    const promo = /\bpromo\b/i.test(frag);
    if (!card) {
      unmatched.push(frag);
      continue;
    }
    hits.push({ set: setId, card, rarity, promo });
  }
  return { hits, unmatched };
}
