// Our set id -> TCGplayer's exact setName.
//
// Confirmed against a probe run, never guessed, because their fuzzy search is
// wrong in a way that looks right: querying "Scarlet & Violet" returns 26
// Paldean Fates products against 15 from the actual base set, so anything that
// picked the most common set in the results would fill a page with another
// set's cards at another set's prices and look completely fine doing it.
//
// Used by sync-products.mjs (sealed boxes) and sync-chase.mjs (singles).
// A new set needs one line here.
export const TCG_SET = {
  "pitch-black": "ME05: Pitch Black",
  "chaos-rising": "ME04: Chaos Rising",
  "perfect-order": "ME03: Perfect Order",
  "ascended-heroes": "ME: Ascended Heroes",
  "phantasmal-flames": "ME02: Phantasmal Flames",
  "mega-evolution": "ME01: Mega Evolution",
  "white-flare": "SV: White Flare",
  "black-bolt": "SV: Black Bolt",
  "destined-rivals": "SV10: Destined Rivals",
  "journey-together": "SV09: Journey Together",
  "prismatic-evolutions": "SV: Prismatic Evolutions",
  "surging-sparks": "SV08: Surging Sparks",
  "stellar-crown": "SV07: Stellar Crown",
  "shrouded-fable": "SV: Shrouded Fable",
  "twilight-masquerade": "SV06: Twilight Masquerade",
  "temporal-forces": "SV05: Temporal Forces",
  "paldean-fates": "SV: Paldean Fates",
  "paradox-rift": "SV04: Paradox Rift",
  "151": "SV: Scarlet & Violet 151",
  "obsidian-flames": "SV03: Obsidian Flames",
  "paldea-evolved": "SV02: Paldea Evolved",
  "scarlet-violet": "SV01: Scarlet & Violet Base Set",
  "pokemon-go": "Pokemon GO",
};
