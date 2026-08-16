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
  // Sword & Shield era, added when sync-sets.mjs learned these five. Probed one
  // at a time and the setName read back off the results, never guessed: the
  // prefix is not predictable from the era. Three carry a numbered code, two do
  // not, and Crown Zenith's is "SWSH:" with no number where Chilling Reign's is
  // "SWSH06:". Sealed products confirmed present under each exact string
  // (Celebrations 36, Crown Zenith 44, Rebel Clash 30, Shining Fates 28,
  // Chilling Reign 28), which is the check that matters: an unknown setName is
  // silently ignored by their API rather than rejected.
  "crown-zenith": "SWSH: Crown Zenith",
  "celebrations": "Celebrations",
  "chilling-reign": "SWSH06: Chilling Reign",
  "shining-fates": "Shining Fates",
  "rebel-clash": "SWSH02: Rebel Clash",
};
