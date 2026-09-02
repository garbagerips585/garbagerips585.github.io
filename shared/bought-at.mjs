/* WHICH CARD SHOW THE PACKS WERE BOUGHT AT, read out of the rip's own description.
 *
 * The owner, 2 September 2026: "we got them from TOAK Pulls, however we did get them
 * at a local card show, so maybe we should also make a tag or badge for what
 * card show it was bought at and make that a new field for videos too."
 *
 * NOTHING NEW HAS TO BE TAGGED, which is the same argument shared/pack-source.mjs
 * makes about the vendor and the same one build-pokemon.mjs makes about sets. He
 * already writes the show into the description when a show is where the packs came
 * from -- "from TOAK Pulls at Collector Fest in Rochester, NY" -- and this site
 * already holds a calendar of those shows. So the join is a sentence against a
 * listing, and a rip published tomorrow carries the badge without anybody editing
 * a data file. Where the description does not say it, data/bought-at.json is the
 * hand override, and it wins.
 *
 * READ BEFORE IT WAS WRITTEN, not guessed at: all eight descriptions that name a
 * venue were pulled out and looked at first. Six say "Collector Fest in Rochester,
 * NY" and two say "Buffalo TCG Con", and every one of the eight also credits
 * @TOAKPulls. The patterns below are those sentences generalised.
 *
 * A MENTION IS NOT A PURCHASE. "See you at Collector Fest this weekend" and
 * "picked these up at Collector Fest" are the same show name in the same shape of
 * sentence and different claims entirely, and only the second may print under a
 * heading that says where the packs came from. So the sentence has to say the
 * transaction, exactly as the vendor join insists. Where it does not, this returns
 * null and the page shows nothing: absent means unconfirmed, never denied.
 *
 * THE CITY IS REQUIRED, AND THE FIRST VERSION OF THIS FILE PROVED WHY BY GETTING
 * IT WRONG. Two shows here normalise close: "CollectorFest Monthly" in Rochester,
 * NY, which is the monthly JCC show, and "Collectorfest" in Syracuse, which is
 * somebody else's entirely. The first rule was "match the name, and ask for the
 * city only when two names collide" -- and the two names DID NOT collide, because
 * the Rochester one carries the word Monthly and so never matched at all. So all
 * six Rochester rips resolved to the SYRACUSE show, confidently, and a bare
 * "Collectorfest" with no city resolved to Syracuse as well. That is worse than no
 * badge: it is a wrong fact printed under a heading that says where the packs came
 * from.
 *
 * So the city is not a tie-breaker, it is a gate. A sentence must name a town this
 * calendar knows, and the show must be IN that town, before any name is considered.
 * A description that names a show and no town gets nothing, which is the correct
 * answer to an ambiguous claim.
 *
 * IT DOES NOT GUESS AT A SHOW WE DO NOT HOLD. "Buffalo TCG Con" is probably the
 * "Buffalo Trading Card Con" on the calendar, and probably is not good enough to
 * print as a fact: those are two different strings and only the owner knows whether
 * they are two names for one show. Those two rips get no badge until either the
 * calendar carries that name or data/bought-at.json says so.
 */

const SPLIT = /[\n.!?]+/;

/* The transaction, in the shapes he actually writes. Deliberately narrower than
   pack-source.mjs's list: this one has to survive being read as "the packs in
   this video were bought at this show", which is a stronger claim than "these
   people were thanked". */
const BUYING = [
  /pick(?:ed)?\s+(?:these|this|them|it)\s+up/i,
  /(?:got|bought|grabbed|copped)\s+(?:these|this|them|it)/i,
  /\b(?:packs?|box|boxes|cards?|bundle|tin|etb)\b[^.]*\bfrom\b/i,
  /thanks\s+to\s+@[^.]*\bfor\b[^.]*\b(?:packs?|box|boxes|cards?|bundle|tin|etb)\b/i,
];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Group the calendar by the identity a description can name: a show is its NAME
 * and its CITY, not one of its dates. A description says "at Collector Fest in
 * Rochester, NY" and means the show, not the 30 August instance of it, so pinning
 * one date would be inventing precision the sentence does not carry.
 */
export function showIndex(shows) {
  const out = new Map();
  for (const s of shows || []) {
    if (!s || !s.name) continue;
    const key = norm(s.name) + "|" + norm(s.city);
    if (!out.has(key)) out.set(key, { name: s.name, city: s.city || "", dates: [] });
    out.get(key).dates.push(s.date);
  }
  return [...out.values()];
}

/**
 * The show these packs were bought at, or null.
 *
 * NULL IS THE COMMON ANSWER AND IS NOT A FAILURE: 323 of 331 rips name no venue
 * at all, because most packs did not come from a show.
 */
/* The name as somebody would write it in a sentence. A listing carries the
   promoter's full styling -- "CollectorFest Monthly", "Collectors Fest #112" --
   and nobody types the qualifier when they say where they were. Only these two
   are stripped, and only from the END, because dropping a word from the middle of
   a name is how two different shows start looking like one. */
const bases = (name) => {
  const n = norm(name);
  const out = new Set([n]);
  const trimmed = n.replace(/(?:monthly|\d+)$/, "");
  if (trimmed.length >= 6) out.add(trimmed);
  return [...out];
};

export function boughtAtShow(desc, index, pin) {
  /* THE OWNER'S OWN WORD FIRST. He knows which room he was standing in; the
     sentence below is only a way of not having to ask him every time. The name
     and city must match the calendar EXACTLY, and a miss returns null loudly
     enough for the caller to throw, because a typo here would silently drop the
     badge rather than shout -- which is the failure mode this whole file exists
     to avoid. */
  if (pin && pin.show) {
    const want = norm(pin.show), city = norm(pin.city);
    const hit = index.find((s) => norm(s.name) === want && (!city || norm(s.city) === city));
    return hit || null;
  }
  const text = String(desc || "");
  if (!text) return null;
  for (const raw of text.split(SPLIT)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (!BUYING.some((re) => re.test(sentence))) continue;
    const flat = norm(sentence);
    /* THE TOWN FIRST. Nothing is considered that is not in a town this sentence
       names, which is what stops a Rochester rip being credited to a Syracuse
       show with a similar name. */
    const inTown = index.filter((s) => s.city && norm(s.city).length >= 4 && flat.includes(norm(s.city)));
    if (!inTown.length) continue;
    // Longest name first, so a more specific listing wins over one that is
    // merely a prefix of it.
    const hits = inTown
      .filter((s) => bases(s.name).some((b) => b.length >= 6 && flat.includes(b)))
      .sort((a, b) => norm(b.name).length - norm(a.name).length);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      // Two listings in one town both fit the words. Say nothing rather than pick.
      return null;
    }
  }
  return null;
}
