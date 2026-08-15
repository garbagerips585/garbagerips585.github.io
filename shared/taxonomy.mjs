// Shared tagging taxonomy for Garbage Rips 585.
//
// Used by scripts/sync-youtube.mjs (build time) and functions/api/latest.js
// (runtime, for videos that are newer than the last sync). Keep it dependency
// free so both a Node script and a Cloudflare Worker can import it.
//
// Tags are derived from the video title plus description. Anything the matcher
// gets wrong can be corrected by hand in data/overrides.json, which always wins.

// Order matters: the first pattern that matches inside a group wins, so put the
// more specific product types above the ones that would also match them.
export const PRODUCT_TYPES = [
  { id: "upc", label: "UPC", pattern: /\bupc\b|ultra[- ]premium collection/i },
  { id: "spc", label: "Super Premium Collection", pattern: /\bspc\b|super premium collection/i },
  { id: "ex-premium", label: "ex Premium Collection", pattern: /\bex premium collection\b/i },
  { id: "ex-special", label: "ex Special Collection", pattern: /\bex special collection\b/i },
  { id: "poke-ball-tin", label: "Poke Ball Tin", pattern: /pok[eé]\s?ball tin/i },
  // `packs?` matters more than it looks. These were written as \bpack\b, which
  // does not match "Packs", and the channel names a multi-pack rip in the
  // plural nearly every time: "Japanese Abyss Eye | Packs #7 & #8". Fourteen of
  // the twenty-one imported rips came out with no product tag at all, and a
  // page needs BOTH a set and a product tag to lose its noindex, so they stayed
  // out of search even once the set tags existed.
  { id: "japanese-pack", label: "Japanese Booster Pack", pattern: /\bjapanese\b.*\bpacks?\b/i },
  { id: "korean-pack", label: "Korean Booster Pack", pattern: /\bkorean\b.*\bpacks?\b/i },
  { id: "chinese-pack", label: "Chinese Booster Pack", pattern: /\bchinese\b.*\bpacks?\b/i },
  { id: "etb", label: "Elite Trainer Box", short: "ETB", pattern: /\betb\b|elite trainer box/i },
  { id: "booster-box", label: "Booster Box", pattern: /\bbooster box\b|\bdisplay box\b/i },
  // "ex Box", not "EX Box". The lowercase ex is the modern printing and it is
  // what riplabel.mjs already puts on every tile ("Ascended Heroes ex Box #2"),
  // so the uppercase spelling here was the odd one out and it showed: the
  // product table on /luck.html listed "EX Box" one row under
  // "ex Premium Collection", and the filter rail on /videos.html captioned a
  // grid of tiles saying "ex Box". `pattern` is case insensitive, so this is a
  // display change only and tagging is untouched.
  { id: "ex-box", label: "ex Box", pattern: /\bex box\b|\bex premium\b|\bex collection\b/i },
  { id: "bundle", label: "Booster Bundle", pattern: /\bbooster bundle\b|\bbundle\b/i },
  { id: "blister", label: "Blister", pattern: /\bblister\b|\b3[- ]pack\b|three[- ]pack/i },
  { id: "tin", label: "Tin", pattern: /\btin\b/i },
  { id: "collection-box", label: "Collection Box", pattern: /\bcollection box\b|\bpremium collection\b|\bspecial collection\b/i },
  // "Booster Pack Opening" is how the channel labels loose single packs, as
  // distinct from a Bundle or a Box. Bundle/Box sit above this in the list, so
  // they win when a title mentions both.
  // Same plural blindness as the imported packs above, and this one sits LAST
  // in the list, so widening it can only tag a video that matched nothing at
  // all. Anything that already matched a box, tin or bundle still wins.
  // Two more phrasings, and the same safety argument as the plural fix above:
  // this entry is LAST, and deriveTags keeps only the first product match, so
  // anything already reading as an ETB, box, bundle, tin or blister still wins.
  // Widening here can only tag a video that matched nothing at all.
  //   "single booster" is how the channel writes a loose-pack series ("Pack #7
  //   of our Pitch Black single booster hunt"), and it never said "single pack".
  //   "Pack #4" on its own is the other half: a numbered pack in a hunt series
  //   is a single pack by definition, and the number is already how the label
  //   is built.
  // Six rips had a set tag and no product, so ripLabel() returned null and the
  // tile fell back to the YouTube title. Two of them share the title "Pitch
  // Black is SAVAGE Today!", which rendered as two identical links on the set
  // page with nothing to tell them apart.
  {
    id: "single-pack",
    label: "Single Pack",
    pattern:
      /\bsingle (?:packs?|boosters?)\b|\bone pack\b|\b1 pack\b|\bloose packs?\b|\bbooster packs?\b|\bpack\s*#\s*\d+/i,
  },
];

// Set names observed in the channel's own titles, newest first. Add to this
// list as new sets release; the matcher is a plain case-insensitive name match.
//
// `label` is a DISPLAY name and has to agree with public/data/sets.json, which
// is the API's name for the same set and is what the set guides, the home page,
// /expansions.html and /what-set.html all render. Only one entry has ever
// disagreed: this list said "Pokemon GO" while sets.json says "Pokémon GO", so
// the same set was spelled two ways, and the split ran right down the middle of
// its own guide page, whose lede said "Pokémon GO" and whose button underneath
// said "Watch the Pokemon GO rips". The unaccented spelling also reached every
// rip page breadcrumb, chip, pack brand and alt text: 46 accented against
// roughly 300 unaccented, for one set.
//
// Accenting the label is safe for TAGGING because this entry carries an
// explicit `pattern` that already accepts both spellings. Entries without a
// `pattern` fall back to matching the label itself (see matcherFor), so if you
// ever accent one of those, give it a pattern in the same edit or it stops
// matching the channel's own unaccented titles.
export const CARD_SETS = [
  { id: "pitch-black", label: "Pitch Black" },
  { id: "ascended-heroes", label: "Ascended Heroes" },
  { id: "pokemon-go", label: "Pokémon GO", pattern: /pok[eé]mon\s+go\b/i },
  { id: "phantasmal-flames", label: "Phantasmal Flames" },
  { id: "perfect-order", label: "Perfect Order" },
  { id: "chaos-rising", label: "Chaos Rising" },
  { id: "mega-evolution", label: "Mega Evolution" },
  { id: "black-bolt", label: "Black Bolt" },
  { id: "white-flare", label: "White Flare" },
  { id: "destined-rivals", label: "Destined Rivals" },
  { id: "journey-together", label: "Journey Together" },
  { id: "prismatic-evolutions", label: "Prismatic Evolutions" },
  { id: "surging-sparks", label: "Surging Sparks" },
  { id: "stellar-crown", label: "Stellar Crown" },
  { id: "shrouded-fable", label: "Shrouded Fable" },
  { id: "twilight-masquerade", label: "Twilight Masquerade" },
  { id: "temporal-forces", label: "Temporal Forces" },
  { id: "paldean-fates", label: "Paldean Fates" },
  { id: "paradox-rift", label: "Paradox Rift" },
  { id: "obsidian-flames", label: "Obsidian Flames" },
  { id: "paldea-evolved", label: "Paldea Evolved" },
  // THE SET, NOT THE ERA. "Scarlet & Violet" is also the name of the whole
  // generation, and the channel writes it that way constantly: "Scarlet &
  // Violet era Pokemon cards" sits in the boilerplate on most descriptions, and
  // the full product names read "Scarlet & Violet - Paradox Rift" and "Scarlet &
  // Violet: Journey Together". A bare name match tagged five videos and NOT ONE
  // of them opened this set. It was not only a wrong count on the set page: the
  // false tag sorted first in v.sets, so ripLabel() named it, and a Japanese
  // Violet ex pack went out labelled "Scarlet & Violet Pack" on every tile.
  // A separator or the word era/series after the name means it is qualifying
  // something else, so only an unqualified mention counts as the base set.
  {
    id: "scarlet-violet",
    label: "Scarlet & Violet",
    pattern: /scarlet\s*(?:&|and)\s*violet(?!\s*(?:[-–—:|]|\bera\b|\bseries\b))/i,
  },
  // THE SET, NOT THE FIRST 151 POKEMON. Four of the five videos this used to
  // tag are "Pokemon First Partner Illustration Collection" boxes hunting
  // "those original 151 starters", which is the Kanto dex and not this set at
  // all. \b151\b cannot tell a set name from a dex count, so require the set to
  // be named: "Pokemon 151", or 151 sitting directly in front of a product noun.
  {
    id: "151",
    label: "151",
    pattern:
      /pok[eé]mon\s+151\b|\b151\b\s+(?:booster|packs?\b|etb\b|elite\s+trainer|bundle|box\b|upc\b|ultra[- ]premium|binder|poster|collection\b|tin\b|blister)/i,
  },

  // Non-English sets the channel has opened. Kept in the same list so a foreign
  // rip gets a set tag, a real page and a place in the sitemap exactly like an
  // English one; before these existed, 20 rips fell through as untagged and were
  // published noindex as thin pages.
  //
  // The label carries a language marker because several of these ARE an English
  // set under another name, and "Abyss Eye" sitting unqualified next to "Pitch
  // Black" in a filter list reads as two different products. Every entry needs
  // an explicit pattern: the default matcher builds its regex from the label,
  // and the bracketed marker would end up inside it.
  //
  // Set equivalences and everything else about these live in data/intl-rips.json.
  { id: "ja-abyss-eye", label: "Abyss Eye (JP)", pattern: /\babyss eye\b/i },
  { id: "ja-ninja-spinner", label: "Ninja Spinner (JP)", pattern: /\bninja spinner\b/i },
  { id: "ja-nihil-zero", label: "Nihil Zero (JP)", pattern: /\bnihil zero\b/i },
  { id: "ja-mega-symphonia", label: "Mega Symphonia (JP)", pattern: /\bmega symphonia\b/i },
  { id: "ja-mega-brave", label: "Mega Brave (JP)", pattern: /\bmega brave\b/i },
  { id: "ja-stellar-miracle", label: "Stellar Miracle (JP)", pattern: /\bstellar miracle\b/i },
  { id: "ja-cyber-judge", label: "Cyber Judge (JP)", pattern: /\bcyber judge\b/i },
  { id: "ja-violet-ex", label: "Violet ex (JP)", pattern: /\bviolet ex\b/i },
  { id: "ko-clay-burst", label: "Clay Burst (KR)", pattern: /\bclay burst\b/i },
  { id: "ko-crimson-haze", label: "Crimson Haze (KR)", pattern: /\bcrimson haze\b/i },
  { id: "ko-mask-of-change", label: "Mask of Change (KR)", pattern: /\bmask of change\b/i },
  { id: "ko-battle-partners", label: "Battle Partners (KR)", pattern: /\bbattle partners\b/i },
  { id: "zh-gem-pack-2", label: "Gem Pack Vol. 2 (CN)", pattern: /\bgem pack\s*(?:vol\.?\s*)?2\b/i },
];

/** The non-English set ids, for anything that needs to treat them separately. */
export const INTL_SET_IDS = new Set(
  CARD_SETS.filter((s) => /^(ja|ko|zh)-/.test(s.id)).map((s) => s.id)
);

// Pull grade, for the "did it hit" angle. These are the abbreviations the
// channel actually uses in titles.
export const PULL_TAGS = [
  { id: "sir", label: "Special Illustration Rare", short: "SIR", pattern: /\bsir\b|special illustration rare/i },
  { id: "ir", label: "Illustration Rare", short: "IR", pattern: /\bir\b|illustration rare/i },
  { id: "gold", label: "Gold / Hyper Rare", pattern: /\bgold (star|card|rare)\b|hyper rare/i },
  { id: "alt-art", label: "Alt Art", pattern: /\balt art\b|alternate art/i },
  { id: "double-rare", label: "Double Rare", pattern: /double rare|\bex double\b/i },
  { id: "charizard", label: "Charizard", pattern: /charizard|\bzard\b/i },
];

const ALL_GROUPS = [
  ["sets", CARD_SETS],
  ["products", PRODUCT_TYPES],
  ["pulls", PULL_TAGS],
];

function matcherFor(entry) {
  if (entry.pattern) return entry.pattern;
  // Default: match the label as a whole phrase, tolerating extra whitespace.
  const escaped = entry.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

// Precompile once. Both callers tag hundreds of videos in a loop.
const COMPILED = ALL_GROUPS.map(([group, entries]) => [
  group,
  entries.map((e) => ({ id: e.id, re: matcherFor(e) })),
]);

/**
 * Derive tags for one video from its text.
 * Returns { sets: [], products: [], pulls: [] } of tag ids.
 */
export function deriveTags({ title = "", description = "" } = {}) {
  const blob = `${title}\n${description}`;
  const out = {};
  for (const [group, entries] of COMPILED) {
    out[group] = entries.filter((e) => e.re.test(blob)).map((e) => e.id);
  }
  // A video is only ever ripped from one product at a time. When several match
  // (e.g. "opened a pack from the ETB"), PRODUCT_TYPES order decides the winner.
  if (out.products.length > 1) out.products = [out.products[0]];
  return out;
}

/** Look up display metadata for a tag id. */
export function labelFor(group, id) {
  const table = { sets: CARD_SETS, products: PRODUCT_TYPES, pulls: PULL_TAGS }[group] || [];
  const hit = table.find((e) => e.id === id);
  return hit ? hit.label : id;
}

/**
 * YouTube treats anything 60s or under (and vertical) as a Short. We store the
 * flag explicitly so the grid does not letterbox the handful of long-form rips.
 */
export function isShort(durationSeconds) {
  return typeof durationSeconds === "number" && durationSeconds > 0 && durationSeconds <= 60;
}

/** Parse an ISO 8601 duration (PT1M5S) into seconds. */
export function parseDuration(iso) {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((v) => (v ? parseInt(v, 10) : 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
