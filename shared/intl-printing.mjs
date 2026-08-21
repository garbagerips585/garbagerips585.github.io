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

/** The one normaliser all three callers used, written once. */
export const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");

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
