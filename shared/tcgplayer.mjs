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
  // NOT "SWSH12: Silver Tempest Trainer Gallery", which is a separate 30 card
  // set sold inside the same product and is the near neighbour warned about in
  // data/tcgdex-en.json. Read off TCGplayer's own setName aggregation.
  "silver-tempest": "SWSH12: Silver Tempest",
};

// ---------------------------------------------------------------------------
// THE NON-ENGLISH GUIDES, AND THE PRODUCT LINE IS PART OF THE KEY NOW.
//
// The thirteen guides in public/data/intl-guides.json had no product
// photography at all, because sync-products.mjs hardcoded
// `productLineName: ["pokemon"]` and TCGplayer files Japanese as a SEPARATE
// catalogue. That was a limit of this file, not of their catalogue, and the
// eight guides below are the ones it can be lifted for.
//
// **THERE ARE EXACTLY TWO POKEMON PRODUCT LINES AND NEITHER IS KOREAN.**
// Aggregated `productLineName` over the whole catalogue on 22 August 2026:
// 69 lines, of which `Pokemon` (32,569 products) and `Pokemon Japan` (30,379)
// are the only two that mention Pokemon at all. There is no `pokemon-korean`,
// no `pokemon-chinese` and no Korean or Chinese Pokemon catalogue under any
// other name; a free-text search for "korean pokemon" returns 0 results.
//
// **A PRIOR PASS MEASURED 11,870 RESULTS FOR "pokemon-korean" AND THAT NUMBER
// IS THE BUG THIS FILE'S OWN HEADER WARNS ABOUT, ARRIVING A SECOND TIME.**
// An unknown TERM filter is silently dropped rather than rejected, exactly as
// the note above fetchSet describes for setName. Proof, three queries:
//
//       Sealed Products, no product line filter          11,870
//       Sealed Products, productLineName=pokemon-korean  11,870
//       Sealed Products, productLineName=Pokemon Korean  11,870
//
// 11,870 is the count of every sealed product in the ENTIRE catalogue, all 69
// game lines: the first page of "Korean" results is led by Storm Emeralda and
// a Magic: The Gathering Hobbit display. It is not a Korean catalogue, it is no
// filter at all. **Do not re-derive a product line from a count. Read the
// aggregation, and check `productLineName` on the rows that come back.**
//
// So the four ko-* guides and zh-gem-pack-2 get NO photograph and that is the
// correct answer rather than a gap. The tempting wrong one is on the shelf next
// to it: TCGplayer holds "SV2D: Clay Burst", "SV5a: Crimson Haze",
// "SV6: Transformation Mask" and "SV9: Battle Partners" as JAPANESE products,
// and those are the very sets the Korean guides are printings OF. Their
// photographs are of the JAPANESE pack, and a Japanese pack on a Korean set
// guide is the wrong product wearing a right-looking caption, which this repo
// holds to be worse than no picture at all. Korean packs do change hands there
// — a seller's custom listing under product 695111 is titled "[KOREAN] Abyss
// Eye Booster Pack Sealed" — but a seller's own title on a marketplace listing
// is not a catalogue entry and carries no photograph we may use.
//
// **HOW EVERY LINE BELOW WAS VERIFIED, four ways, all eight passing all four.**
// The setName filter works perfectly here; what fails is an INEXACT string, and
// it fails silently by returning the whole line. A control query for the
// invented set "M99: Does Not Exist" returned all 308 Japanese sealed products
// with 0 of them matching, which is what a prior pass saw and read as "the
// filter does not work on this line".
//
//   1. `setCode`, which the search API returns as a FIRST-CLASS FIELD rather
//      than something parsed out of the display name, equals the guide's own
//      `tcgdexId` case-insensitively. TCGplayer lowercases the m on the two
//      Mega sets (m1L, m1S) and on M4; the codes are otherwise identical.
//   2. `customAttributes.releaseDate` equals the guide's `released` TO THE DAY
//      on all eight. This is the strongest of the four because it is a fact
//      about the world that two catalogues agree on independently.
//   3. The set name after the colon equals the guide's `english` exactly.
//   4. THE PHOTOGRAPH WAS LOOKED AT. Every pack's printed Japanese name matches
//      the guide's `native` field character for character and the set code is
//      printed on the wrapper: アビスアイ/M5, ムニキスゼロ/M3, ニンジャスピナー/m4,
//      メガブレイブ/m1L, メガシンフォニア/m1S, ステラミラクル/sv7,
//      サイバージャッジ/sv5M, バイオレットex/sv1V. This is the one axis that does
//      not depend on TCGdex and TCGplayer sharing an upstream, and it is the
//      one to repeat if a pin here ever looks doubtful.
//
// sync-products.mjs re-checks 1, 2 and 3 on every run and drops a set rather
// than publish a disagreement, so a re-pin cannot quietly go wrong later.
export const TCG_SET_INTL = {
  "ja-abyss-eye": { line: "pokemon-japan", setName: "M5: Abyss Eye" },
  "ja-ninja-spinner": { line: "pokemon-japan", setName: "M4: Ninja Spinner" },
  "ja-nihil-zero": { line: "pokemon-japan", setName: "M3: Nihil Zero" },
  "ja-mega-brave": { line: "pokemon-japan", setName: "m1L: Mega Brave" },
  "ja-mega-symphonia": { line: "pokemon-japan", setName: "m1S: Mega Symphonia" },
  "ja-stellar-miracle": { line: "pokemon-japan", setName: "SV7: Stellar Miracle" },
  "ja-cyber-judge": { line: "pokemon-japan", setName: "SV5M: Cyber Judge" },
  "ja-violet-ex": { line: "pokemon-japan", setName: "SV1V: Violet ex" },
  // ko-battle-partners, ko-clay-burst, ko-crimson-haze, ko-mask-of-change and
  // zh-gem-pack-2 are deliberately absent. See the paragraph above: there is no
  // Korean or Chinese catalogue to pin them to, and the Japanese set they were
  // printed from is a different product.
};
