/* WHO THE PACKS CAME FROM, read out of the rip's own description.
 *
 * The owner, 27 August 2026: "lets actually add their logo and credit them on the
 * video pages for the videos where i mention that we got the cards from TOAK
 * Pulls." He already writes that credit into every one of those descriptions;
 * this makes the site say it too, beside the vendor's own mark.
 *
 * THE JOIN ALREADY EXISTED AND NOTHING NEW HAS TO BE TAGGED. A description names
 * a YouTube handle, and data/vendors.json, data/shops.json and data/creators.json
 * each carry a `youtube` handle for the people on them. So a credit is a handle
 * we hold a listing for, and a rip published tomorrow is credited without anybody
 * touching a data file. Same shape as the set join in build-pokemon.mjs, which
 * took that page family from 39 pages with a video to 918.
 *
 * A BARE @MENTION IS NOT A CREDIT AND MUST NOT BE TREATED AS ONE. "go follow
 * @TOAKPulls" and "huge thanks to @TOAKPulls for the packs" are the same string
 * to a handle search and different claims entirely, and the second is the only
 * one this site may print under a vendor's logo. So a match needs the handle AND
 * a buying phrase in the same sentence. Where the sentence does not say it, this
 * returns null and the page shows nothing, which is the standing rule everywhere
 * else here: absent means unconfirmed, never denied.
 *
 * ALL TEN OF TODAY'S MATCHES WERE READ BEFORE THIS WAS WRITTEN rather than
 * counted. They are "huge/big thanks to @X for the packs", "thanks to @X for the
 * packs", "picked these up from @X" and "picked these up at <show> from @X".
 * The patterns below are those sentences generalised, not a guess at what he
 * might write.
 */

/* SENTENCE FIRST, then handle, then phrase. Splitting on sentence enders keeps
   "Big thanks to @TOAKPulls for the packs. Go follow @SomebodyElse" from
   crediting the second one, which a whole-description search would do. */
const SPLIT = /[\n.!?]+/;

/* TWO STRENGTHS OF PHRASE, AND THE DISTINCTION IS LOAD BEARING.
   STRONG ones say the transaction outright and need nothing else in the
   sentence: "picked these up from @X" is a purchase whatever the object is
   called. Requiring a goods word alongside them was the first version and it
   REJECTED TWO OF THE TEN REAL CREDITS, both of which say "these" rather than
   "packs": "Picked these up from @TOAKPulls at the last JCC event in Rochester"
   and "Picked these up at Buffalo TCG Con from @TOAKPulls". A guard that fires
   on the sentences it was written to catch is not a guard. */
const STRONG = [
  /pick(?:ed)?\s+(?:these|this|them|it)\s+up[^@]*from\s+@/i,
  /(?:got|bought|grabbed|copped)\s+(?:these|this|them|it)[^@]*from\s+@/i,
  /(?:packs?|box|boxes|cards?|bundle|tin|etb)[^@]*from\s+@/i,
  // "The hunt continues at @LingSterGames!" -- naming the shop as the place the
  // product came from, which is what "at" is doing there.
  /\bhunt(?:ing)?\b[^@]*\bat\s+@/i,
];

/* WEAK is a bare thanks, which needs to say what the thanks was FOR, because
   "thanks to @X for having me on" is a real sentence and is not a pack credit.
   This is the only pattern GOODS applies to. */
const WEAK = [
  /thanks\s+to\s+@/i,
  // "A huge shout out to @LingSterGames in the Rochester area for the MSRP
  // hookup". Same act as a thanks and he writes it both ways.
  /shout\s*-?\s*out\s+to\s+@/i,
];
const GOODS = /\b(pack|packs|box|boxes|bundle|tin|etb|cards?|singles?|slabs?|msrp)\b/i;

/**
 * Index every listing that carries a YouTube handle, keyed by that handle.
 *
 * ORDER IS VENDORS, THEN SHOPS, THEN CREATORS, AND IT DECIDES THE LINK. TOAK
 * Pulls is on /vendors.html AND /creators.html with the same handle, and the
 * sentence being matched is about BUYING, so the credit belongs on the page
 * that says what they sell. A first-write-wins map is how that is expressed.
 */
export function sourceIndex(docs) {
  const out = new Map();
  for (const { list, href, dir, kind } of docs) {
    for (const o of list || []) {
      const h = (o.youtube || "").toLowerCase();
      if (!h || out.has(h)) continue;
      // THE WHOLE LISTING, not three fields off it. The card below prints an
      // address, hours, what they sell and their links, and copying those into
      // the index would be a second copy of the data to go stale against the
      // first. The listing IS the record.
      out.set(h, { o, dir, href, kind });
    }
  }
  return out;
}

/**
 * The listing credited for the packs in this description, or null.
 *
 * NULL IS THE COMMON ANSWER AND IS NOT A FAILURE. 315 of 325 rips name nobody,
 * because he bought those packs himself at retail.
 */
export function packSource(description, index) {
  if (!description || !index.size) return null;
  const goods = GOODS.test(String(description));
  for (const raw of String(description).split(SPLIT)) {
    const s = raw.trim();
    if (!s.includes("@")) continue;
    // GOODS IS CHECKED OVER THE WHOLE DESCRIPTION, NOT THE SENTENCE, AND THAT
    // WAS A CORRECTION. Sentence-scoped, it rejected "A huge shout out to
    // @LingSterGames ... for the MSRP hookup", whose goods word ("ETB") is in
    // the sentence before it. What the goods word establishes is that this
    // video is about opening product at all; what ties the credit to a
    // particular seller is the phrase, and THAT stays sentence-scoped so a
    // thank-you to one account cannot credit a handle mentioned two lines down.
    const strong = STRONG.some((re) => re.test(s));
    if (!strong && !(WEAK.some((re) => re.test(s)) && goods)) continue;
    for (const m of s.matchAll(/@([A-Za-z0-9_.-]{2,30})/g)) {
      const hit = index.get(m[1].toLowerCase());
      if (hit) return hit;
    }
  }
  return null;
}


/* ---------------------------------------------------------------- the card --
 *
 * The owner, 27 August 2026: "make some sort of badge or icon showing that we
 * bought it from them and maybe list out their store details and links ... this
 * will be a common thing, I love tagging the stores and vendors who I buy the
 * products from".
 *
 * SO IT IS A CREDIT BLOCK AND NOT A LISTING. It sits in the rip's own info
 * column, under the title and the date, which is where the facts about what this
 * rip IS already live. It answers "where did these come from" and then sends the
 * reader to the full listing rather than reproducing it: hours and an address
 * belong on /shops.html, which has one date and one source for them, and a
 * second copy on 5 rip pages is a second copy to go stale.
 *
 * "PACKS FROM" IS THE BADGE, NOT "BOUGHT FROM", AND THE DIFFERENCE IS SOURCED.
 * The sentences this is built from say two things: "picked these up from @X",
 * which is a purchase, and "huge thanks to @X for the packs", which is not
 * necessarily one. "Packs from" is true of both. Where the owner has told us
 * outright that he buys from somebody, that is recorded as `vouched` on their
 * listing and prints the site's own "Bought from them" chip beside the name,
 * which is the mark that already means exactly that everywhere else here. So
 * the stronger claim appears only where it is earned rather than inferred from
 * a thank-you.
 *
 * EVERY FIELD IS OPTIONAL AND THE SHAPES GENUINELY DIFFER. A shop has an
 * address, hours and a phone; a vendor has what they sell and which shows they
 * work; a creator has neither. Nothing is invented to fill a row, and a listing
 * with nothing but a name and a logo still renders a correct, smaller card.
 */
const KIND_LABEL = { shops: "Card shop", vendors: "Vendor", creators: "Creator" };

export function sourceCard(hit, { esc, socialLinks, glyph, longDate }) {
  const { o, dir, href, kind } = hit;
  const facts = [];
  // A SHOP'S ADDRESS GOES TO A MAP, exactly as its own card does. The hours are
  // deliberately NOT here: this site publishes them only beside the date and the
  // source they were read from, and that pairing lives on /shops.html.
  if (o.address)
    facts.push(["Where", `<a href="https://www.google.com/maps/search/?api=1&query=${
      encodeURIComponent(o.address)}" rel="noopener" target="_blank" aria-label="${
      esc(o.address)}, where ${esc(o.name)} is, opens on google.com">${esc(o.address)}</a>`]);
  else if (o.area) facts.push(["Where", esc(o.area)]);
  /* HOURS COME WITH THEIR SOURCE AND THEIR DATE OR THEY DO NOT COME AT ALL.
     That is the site's rule, not this card's, and build-shops.mjs FAILS THE
     BUILD on a shop that publishes hours with no hoursSrc, with the reason
     written beside it: "an hour nobody can check is how somebody drives to a
     locked door." Printing them here under a bare label would have been the
     one place on the site that broke it. The date is the day the shop's own
     site was read, carried from the same record. */
  if (o.hours && o.hoursSrc)
    facts.push(["Open", `${esc(o.hours)}<span class="rip-src-src">confirmed on ${
      o.hoursSrc ? `<a href="${esc(o.hoursSrc)}" rel="noopener" target="_blank" aria-label="the ${
        esc(o.name)} site, where these hours were read, opens on ${
        esc(new URL(o.hoursSrc).host.replace(/^www\./, ""))}">their own site</a>` : "their own site"
    }${o.hoursRead ? `, ${esc(longDate(o.hoursRead))}` : ""}</span>`]);
  if (o.phone) facts.push(["Phone", `<a href="tel:${esc(o.phone.replace(/[^0-9+]/g, ""))}">${esc(o.phone)}</a>`]);
  if (o.sells) facts.push(["Sells", esc(o.sells)]);
  else if (o.does) facts.push(["Makes", esc(o.does)]);
  if (o.shows) facts.push(["Usually at", esc(o.shows)]);

  const socs = socialLinks(o).map(
    (s) => `<a class="loc-soc" href="${esc(s.href)}" rel="noopener" target="_blank" aria-label="${
      esc(s.label)} for ${esc(o.name)}, opens on ${esc(new URL(s.href).host.replace(/^www\./, ""))}">${
      glyph(s.key)}${esc(s.label)}</a>`);
  if (o.url)
    socs.push(`<a class="loc-soc" href="${esc(o.url)}" rel="noopener" target="_blank" aria-label="Website for ${
      esc(o.name)}, opens on ${esc(new URL(o.url).host.replace(/^www\./, ""))}">${glyph()}Website</a>`);

  const h = Math.round(28 * (o.logoH || 1) / (o.logoW || 1));
  return `<aside class="rip-src">
          <p class="rip-src-badge">Packs from</p>
          <div class="rip-src-h">
            <span class="rip-src-logo"><picture>
              <source type="image/avif" srcset="/assets/${dir}/${esc(o.logo)}-200.avif 200w, /assets/${dir}/${esc(o.logo)}-400.avif 400w" sizes="44px">
              <img src="/assets/${dir}/${esc(o.logo)}-200.webp" alt="" width="28" height="${h}" loading="lazy" decoding="async" srcset="/assets/${dir}/${esc(o.logo)}-200.webp 200w, /assets/${dir}/${esc(o.logo)}-400.webp 400w" sizes="44px">
            </picture></span>
            <div class="rip-src-id">
              <p class="rip-src-name">${esc(o.name)}${
                o.vouched ? `<span class="loc-vouch">Bought from them</span>` : ""}</p>
              <p class="rip-src-kind">${esc(KIND_LABEL[kind] || "Local")}</p>
            </div>
          </div>
          ${facts.length ? `<dl class="rip-src-facts">${facts
            .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}
          ${socs.length ? `<p class="rip-src-links">${socs.join("")}</p>` : ""}
          <p class="rip-src-more"><a href="${esc(href)}">See the full listing &rarr;</a></p>
        </aside>`;
}
