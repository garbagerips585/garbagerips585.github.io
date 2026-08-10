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
  { id: "etb", label: "Elite Trainer Box", short: "ETB", pattern: /\betb\b|elite trainer box/i },
  { id: "booster-box", label: "Booster Box", pattern: /\bbooster box\b|\bdisplay box\b/i },
  { id: "ex-box", label: "EX Box", pattern: /\bex box\b|\bex premium\b|\bex collection\b/i },
  { id: "bundle", label: "Booster Bundle", pattern: /\bbooster bundle\b|\bbundle\b/i },
  { id: "blister", label: "Blister", pattern: /\bblister\b|\b3[- ]pack\b|three[- ]pack/i },
  { id: "tin", label: "Tin", pattern: /\btin\b/i },
  { id: "collection-box", label: "Collection Box", pattern: /\bcollection box\b|\bpremium collection\b|\bspecial collection\b/i },
  { id: "single-pack", label: "Single Pack", pattern: /\bsingle pack\b|\bone pack\b|\b1 pack\b|\bloose pack\b/i },
];

// Set names observed in the channel's own titles, newest first. Add to this
// list as new sets release; the matcher is a plain case-insensitive name match.
export const CARD_SETS = [
  { id: "pitch-black", label: "Pitch Black" },
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
  { id: "scarlet-violet", label: "Scarlet & Violet", pattern: /scarlet\s*(&|and)\s*violet/i },
  { id: "151", label: "151", pattern: /\b151\b/ },
];

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
