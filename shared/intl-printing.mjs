/**
 * WHICH PRINTING A NON-ENGLISH HIT IS, AND WHY THIS IS NOT THE ENGLISH RULE.
 *
 * ==========================================================================
 * THERE IS ONE OF THIS FUNCTION NOW. THERE WERE TWO, AND A THIRD WAS DUE.
 * ==========================================================================
 *
 * build-hall.mjs and build-pages.mjs each held a private copy, byte for byte
 * the same three branches, and both files carried a comment ordering the reader
 * to change the other one in the same edit. CLAUDE.md has the receipt for what
 * that costs: five builders each holding a private `gradedPrice()` is how Mega
 * Greninja ex printed $906 on two pages and $838 on fifty-four, for three days.
 * The contract those comments were enforcing is a MODULE, so it cannot be half
 * applied. build-intl-pages.mjs is the third caller and is the reason this
 * moved: teaching the Japanese set guides to list their own pulled cards meant
 * either a third copy or this file.
 *
 * IF A PLAQUE AND A RIP PAGE AND A SET GUIDE EVER NAME DIFFERENT PRINTINGS OF
 * ONE CARD AGAIN, it is because a caller stopped calling this, not because the
 * rule drifted.
 *
 * ==========================================================================
 * `same[0]` IS BANNED HERE AND THAT BAN IS OLDER THAN THIS FUNCTION.
 * ==========================================================================
 *
 * On an English checklist the sheet and TCGdex share a vocabulary, so a miss on
 * the tier is a wording difference and `same[0]` is a safe last resort. They do
 * not share one across languages, and build-hall.mjs has the scar: Abyss Eye
 * prints Goldeen at #012 Common and #084 Illustration rare, the rip log writes
 * the tier as "Art Rare" because that is what is printed on the Japanese
 * wrapper, and `same[0]` handed the plaque the COMMON. So an intl row takes a
 * printing only where nothing can contradict it.
 *
 * MAPPING AR ONTO ILLUSTRATION RARE WOULD RESOLVE GOLDEEN AND IS STILL REFUSED.
 * shared/rarity.mjs keeps the seven Japanese letter tiers separate from the
 * English ladder and says why in as many words: "SAR and Special Illustration
 * Rare are close cousins, not the same thing, and asserting an equivalence the
 * two companies do not publish would be this site inventing a fact." Nothing
 * below bends it. Goldeen still goes in with no number.
 *
 * ==========================================================================
 * WHAT IS NEW IS A CASE WHERE ELIMINATION IS TOTAL, AND IT NEEDS NO MAPPING.
 * ==========================================================================
 *
 * Stellar Miracle prints Crabominable twice: #024, which TCGdex files as
 * "Uncommon", and #107, which TCGdex leaves UNFILED. The log says Art Rare.
 * Uncommon and Art Rare are both tiers on the JAPANESE ladder, jp-u and jp-ar
 * in shared/rarity.mjs, and they are different tiers. So #024 is not the card
 * the log describes and #107 is the only printing left. That argument is made
 * entirely inside one vocabulary and asserts nothing about the English one.
 *
 * THE THIRD BRANCH IS THE ONE THAT MAKES IT SAFE. A survivor is taken only when
 * it is ALONE and its own tier is unstated. Terapagos ex has FOUR printings in
 * that set, three of them unstated, and this refuses it rather than choosing.
 *
 * SCOPE, COUNTED RATHER THAN REASONED, 2026-08-21. The unstated-survivor branch
 * can only fire in a set where TCGdex declines to name the tier at all. Across
 * the thirteen guides in intl-guides.json today that is ja-stellar-miracle
 * (36 of 135 unstated), ja-violet-ex (30 of 108), ko-clay-burst (28 of 99),
 * ko-crimson-haze (33 of 96), ko-battle-partners (32 of 132) and
 * ko-mask-of-change (3 of 101). Abyss Eye, Nihil Zero, Mega Symphonia and Mega
 * Brave state EVERY rarity they hold, so on those four the branch is dead and
 * Goldeen, Manectric, Raticate, Aurorus and Spearow all still refuse.
 *
 * ==========================================================================
 * INDEPENDENTLY CONFIRMED BEFORE IT SHIPPED, AND THE CHECK IS REPEATABLE.
 * ==========================================================================
 *
 * Elimination says which printing is LEFT; it does not say what the picture is.
 * So the three were also identified positively, by ILLUSTRATOR, against the
 * English counterpart set this repo already holds a full priced checklist for.
 * intl-guides.json records ja-stellar-miracle's `equivalent` as stellar-crown
 * at confidence "confirmed", and they are the same set: TCGdex SV7 and sv07.
 *
 *     JA SV7  #107 Crabominable  Mitsuhiro Arita  ->  EN sv07 #149  Illustration rare
 *     JA SV7  #111 Meditite      Yuriko Akase     ->  EN sv07 #153  Illustration rare
 *     JA SV7  #106 Raboot        rika             ->  EN sv07 #147  Illustration rare
 *     JA SV7  #024 Crabominable  nagimiso         ->  EN sv07 #042  Uncommon
 *     JA SV7  #017 Raboot        aspara           ->  EN sv07 #027  Common
 *
 * Every one of the six is a UNIQUE (name, illustrator) pair on both sides, and
 * the English tier separates the two printings of each card exactly the way the
 * log's word does. TCGdex's English field for the Japanese Art Rare tier is
 * "Illustration rare", which is CLAUDE.md's own reading of the same
 * disagreement on Goldeen.
 *
 * THAT JOIN IS NOT THE MECHANISM AND IS DELIBERATELY NOT IN THE CODE. Wiring it
 * in would put the English ladder back inside the answer for a Japanese card,
 * which is the one thing shared/rarity.mjs asks nobody to do. It is written here
 * so the next person can re-run it in four lines rather than take it on trust:
 * the illustrators are in public/data/intl-guides.json and in the `ill` field of
 * public/data/cards/stellar-crown.json, both already on disk.
 */

/* ==========================================================================
 * THE ONE NORMALISER, AND IT USED TO THROW AWAY EVERY SCRIPT THE CHECKLISTS
 * ARE ACTUALLY WRITTEN IN.
 * ==========================================================================
 *
 * It was `.toLowerCase().replace(/[^a-z0-9]/g, "")`. On an English checklist
 * that is fine. On the thirteen intl guides it is not, and the two faults it
 * carried were both latent rather than visible, which is why they survived
 * three passes over this file.
 *
 * **202 OF THE 1,310 ROWS IN public/data/intl-guides.json NORMALISED TO THE
 * EMPTY STRING.** Counted on disk, 2026-08-22: every row whose name is still
 * Japanese or Korean, because a-z0-9 keeps none of it. Nothing fired on it
 * today only because every one of the thirteen hit rows is written in Latin
 * letters. A hit row whose name ALSO normalised to "" would have matched all
 * 202 at once, and `pickIntlPrinting` would then have been handed 202
 * candidates and asked to separate them on rarity alone -- silently, on a page
 * that prints a collector number. That is the hazard, and it is closed here by
 * giving those rows a real key rather than by hoping nobody writes one.
 *
 * `scanNorm` in shared/card-scan.mjs HAD ALREADY KEPT THOSE RANGES and had
 * kept them for the same reason. Two normalisers for one job, disagreeing, in
 * two files that are called about the same card in the same run: that is the
 * shape CLAUDE.md has the receipt for (five private `gradedPrice()` copies,
 * $906 against $838 on 54 pages). **There is one of it now, and card-scan.mjs
 * imports this.**
 *
 * **THE SECOND FAULT IS A LATIN ONE AND IT COST A REAL ROW.** The strip
 * DELETED an accented letter rather than folding it, so "Poké Pad" keyed to
 * "pokpad" and "Poke Pad" to "pokepad" -- the same card, two keys, and never a
 * match. Ten checklist names were mangled that way (Poké Ball, Pokégear 3.0,
 * Pokémon Catcher, Pokémon Center Lady, Pokémon League Headquarters, PokéStop,
 * Poké Kid, Poké Vital A, Flabébé and Poké Pad). Any hit row naming one of
 * them would have failed to resolve on ALL THREE surfaces and looked like a
 * missing card rather than a broken key.
 *
 * **DO NOT "SIMPLIFY" THIS TO `.normalize("NFD")` FOLLOWED BY THE STRIP. THAT
 * IS THE TRAP AND IT LOOKS IDENTICAL FOR JAPANESE.** NFD decomposes a Hangul
 * SYLLABLE into Jamo in the U+1100 block, which is outside the AC00-D7AF range
 * kept below, so the strip then deletes it: "변환의 가면" comes out "" and
 * "클레이버스트" comes out "". Measured 2026-08-22 -- the naive version puts all
 * 308 Korean rows back to the empty key it was written to remove, while
 * appearing to fix the accents. So the fold is restricted to the Latin
 * COMBINING DIACRITICAL MARKS block (U+0300-U+036F) and recomposed with NFC
 * before anything is stripped. That leaves Japanese and Korean untouched and,
 * in particular, leaves the dakuten alone: U+3099 is Diacritic=Yes, so a
 * `\p{Diacritic}` fold would merge ダ with タ.
 *
 * MEASURED BEFORE IT SHIPPED, over every name and tier the three callers can
 * hand this, 2026-08-22:
 *
 *       intl checklist rows keying to ""      202 -> 0
 *       distinct intl names sharing a key       0 -> 0
 *       rarity words whose key changes          0 of 26
 *       English card names whose key changes   10 of 1,924, all of them the
 *                                              Poké/Pokémon repairs above
 *       English names sharing a key             2 -> 2  (Farfetch'd's two
 *                                              apostrophes, Nidoran male and
 *                                              female -- both pre-existing)
 *
 * **NO RARITY WORD MOVES, WHICH IS WHAT KEEPS pickIntlPrinting BYTE-IDENTICAL
 * IN BEHAVIOUR.** This changes a KEY the rule is given; it does not touch a
 * branch. All 11 of the 13 intl hit rows that resolved before still resolve,
 * to the same printings, including the six that go through the Japanese
 * vocabulary in shared/intl-vocab.mjs.
 */

/** Latin combining marks only. See the Hangul trap above before widening it. */
const LATIN_MARKS = /[̀-ͯ]/g;
/**
 * Everything that is not a letter, a digit, or a character of a script one of
 * these checklists is written in: Hiragana + Katakana (U+3040-U+30FF), CJK
 * unified ideographs (U+4E00-U+9FFF), Hangul syllables (U+AC00-U+D7AF). Same
 * three ranges shared/card-scan.mjs's scanNorm has always kept.
 */
const DROP = /[^a-z0-9぀-ヿ一-鿿가-힯]/g;

/** The one normaliser all three callers used, written once. */
export const norm = (x) =>
  String(x).toLowerCase().normalize("NFD").replace(LATIN_MARKS, "").normalize("NFC").replace(DROP, "");

/**
 * THE GUARD, AND IT FAILS THE BUILD RATHER THAN WARNING.
 *
 * `norm` giving back "" means the caller is holding a name it cannot key on.
 * After the change above nothing on disk does that, and the point of throwing
 * is that the day something DOES, it stops the run instead of quietly matching
 * every other unkeyable row on the checklist. A comment here would not have
 * stopped the next person; this does.
 *
 * It is deliberately NOT built into `norm`. That function is also asked for the
 * key of a RARITY, where callers pass a null tier on purpose and an empty
 * answer is a legitimate "no tier written down". Only a NAME must be keyable,
 * so only the name sites call this.
 *
 * @param {*} value the name being keyed.
 * @param {string} where what the caller was doing, for the message.
 * @returns {string} the key, never empty.
 */
export function nameKeyOrThrow(value, where) {
  const key = norm(value);
  if (key) return key;
  throw new Error(
    `[intl-printing] ${where}: ${JSON.stringify(String(value))} normalises to an EMPTY key, ` +
      `so it would match every other unkeyable row rather than nothing. ` +
      `Either the name is missing or norm() is dropping the script it is written in ` +
      `(see the ranges in shared/intl-printing.mjs).`
  );
}

/**
 * @param {Array<{n?:string, name:string, rarity:?string}>} same
 *        every printing on the intl checklist carrying the hit's name.
 * @param {?string} want the tier the rip log wrote, ALREADY normalised, or null.
 * @returns the printing, or null, which every caller renders as absent.
 */
export function pickIntlPrinting(same, want) {
  if (!same.length) return null;
  // No tier written down is no evidence, so a repeated name cannot be settled.
  if (!want) return same.length === 1 ? same[0] : null;
  // 1. The tier is stated and it is the log's. One vocabulary, exact word.
  const exact = same.filter((c) => norm(c.rarity) === want);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  // 2. Nothing states the log's tier. Drop everything that states a DIFFERENT
  //    one and see what is left. This is where Goldeen stops: both of its
  //    printings state a tier, neither is Art Rare, so nothing survives.
  const unstated = same.filter((c) => !c.rarity);
  const stated = same.filter((c) => c.rarity);
  // 3. Alone, and unstated. Two survivors is a choice and this does not make it.
  return unstated.length === 1 && stated.length ? unstated[0] : null;
}
