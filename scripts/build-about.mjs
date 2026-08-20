#!/usr/bin/env node
// Build public/about.html.
//
//   node scripts/build-about.mjs
//
// The copy is Tim's own channel description, lightly set for the page rather
// than rewritten: it is his voice and it already says the thing well.
//
// This is the page search engines read to work out whose site this is, so it
// carries the Person and Organization schema and the links that tie the
// channel, the socials and the site together as one entity. That is the whole
// job of an about page for a small brand: not traffic, identity.
//
// Live counts come from public/data/videos.json rather than being typed, so
// they cannot go stale on their own.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
// APP_JS_NO_PACKPLAYER, not APP_JS. Nothing on this page plays a rip where it
// sits; verified by driving it with a real dispatched click, not by grepping.
// packs.css is NOT dropped here and cannot be from this file: these four pages
// take their <head> by slicing index.html, so their stylesheet links are the
// home page's. See shared/chrome.mjs beside the two exports.
import { SOCIALS, SUBSCRIBE, APP_JS_NO_PACKPLAYER as APP_JS } from "../shared/chrome.mjs";
import { MONTHS_LONG as MONTHS, esc } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The imported guides are listed on the same /sets/ index, so a count of
// "set guides" that omits them contradicts the page it links to.
let intlCount = 0;
try {
  intlCount = Object.keys(
    JSON.parse(await readFile(join(ROOT, "public/data/intl-guides.json"), "utf8")).sets || {}
  ).length;
} catch {
  /* run: node scripts/sync-intl-guides.mjs */
}


const raw = JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8"));
const videos = raw.videos || raw;
const { sets } = JSON.parse(await readFile(join(ROOT, "public/data/sets.json"), "utf8"));

const setsRipped = new Set(videos.flatMap((v) => v.sets || [])).size;

/* ------------------------------------------------------------ three to start
 *
 * THIS PAGE SAID "EVERY RIP HAS ITS OWN PAGE HERE" AND LINKED NOT ONE OF THEM.
 * It is the page a stranger reads to decide whether the channel is worth their
 * time, it counts the rips in the sidebar, and the only way out of it towards
 * an actual video was the footer.
 *
 * THREE, NOT A RAIL, and each one is a different REASON to watch rather than
 * three slots off one sort. A "latest videos" strip is what every channel page
 * has and it answers a question nobody asked; "the biggest thing that ever came
 * out of a pack here" is an argument for the channel. The roles are fixed and
 * the picks are computed, so this cannot drift into an editor's favourites.
 *
 * DEDUPED BY FALLING THROUGH, because the roles genuinely collide: the Hall of
 * Fame hit is currently also the newest upload, so "newest" takes the newest
 * video that is not already listed rather than printing the same row twice.
 *
 * `hofRank` IS THE SPREADSHEET'S OWN JUDGEMENT and it is the only one of the
 * three that is not arithmetic. Exactly one video carries it today. If nobody
 * has ranked one, that row is absent and the card shows two: the standing
 * pattern here for data we do not have.
 */
const startHere = (() => {
  const taken = new Set();
  const out = [];
  // `where` is the ROLE's own precondition and it runs before anything is
  // claimed. Sorting first and filtering afterwards would mark a video taken
  // for a role it does not qualify for and then hide it from the next role.
  const pick = (label, where, sort) => {
    const v = videos
      .filter((x) => x.path && !taken.has(x.id) && where(x))
      .sort(sort)[0];
    if (!v) return;
    taken.add(v.id);
    out.push({ label, v });
  };
  pick("The biggest pull", (x) => Boolean(x.hofRank), (a, b) => a.hofRank - b.hofRank);
  pick("Most watched", (x) => (x.views || 0) > 0, (a, b) => (b.views || 0) - (a.views || 0));
  pick("Newest rip", (x) => Boolean(x.published), (a, b) => String(b.published).localeCompare(String(a.published)));
  return out;
})();
const oldest = videos.map((v) => v.published).filter(Boolean).sort()[0] || null;
const since = oldest ? `${MONTHS[Number(oldest.slice(5, 7)) - 1]} ${oldest.slice(0, 4)}` : null;

const style = `
.about-page{padding:var(--s7) 0 var(--s8)}
.about-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:34em;margin-bottom:var(--s6)}
.about-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:var(--s7);align-items:start}
@media(max-width:900px){.about-grid{grid-template-columns:1fr;gap:var(--s6)}}
.about-body p{margin-bottom:var(--s4);max-width:36em}
.about-body h2{font:400 var(--t-l)/1.15 var(--display);margin:var(--s6) 0 var(--s3)}
.about-body ul{list-style:none;display:flex;flex-direction:column;gap:var(--s2);
  margin:var(--s3) 0 var(--s5)}
.about-body li{display:flex;gap:var(--s3);align-items:flex-start;color:var(--ink-2)}
.about-body li::before{content:"";flex:none;width:9px;height:9px;margin-top:.55em;
  border-radius:2px;background:var(--mustard);border:1px solid var(--gold-deep);
  transform:rotate(45deg)}
.about-pull{font:400 var(--t-l)/1.2 var(--display);color:var(--ink);
  border-left:5px solid var(--mustard);padding-left:var(--s4);margin:var(--s6) 0}

.about-side{position:sticky;top:calc(var(--bar-h) + var(--s4));display:flex;
  flex-direction:column;gap:var(--s4)}
@media(max-width:900px){.about-side{position:static}}
.about-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s5);box-shadow:var(--lift)}
.about-card h3{font:700 var(--t-micro)/1 var(--mono);letter-spacing:.1em;color:var(--ink-2);
  text-transform:uppercase;margin-bottom:var(--s4)}
.stat-row{display:flex;align-items:baseline;justify-content:space-between;gap:var(--s3);
  padding:var(--s3) 0;border-bottom:1px dashed var(--hair)}
.stat-row:last-child{border-bottom:0}
.stat-row b{font:400 var(--t-l)/1 var(--display);color:var(--ink)}
/* THREE ROUTES OUT OF THIS PAGE TOWARDS AN ACTUAL VIDEO. See startHere above.
   TEAL for the title, because teal is how you get around, and --sky-deep
   rather than --sky because the type is small: 4.50:1 on --card #2F4F39
   against --sky's 4.05:1, which fails. The role above it ("Most watched") is
   --ink-2 at 5.73:1, a caption and not a route. Block anchors with the 44px
   minimum every tap target on this site is held to, so the whole two-line row
   is the target rather than the title's text run. */
.about-rips{list-style:none;margin:0;padding:0;display:grid;gap:0}
.about-rips li{border-bottom:1px solid var(--hair)}
.about-rips li:last-child{border-bottom:0}
.about-rips a{display:block;min-height:44px;padding:10px 0;
  font:600 var(--t-sm)/1.35 var(--body);color:var(--sky-deep)}
.about-rips a:hover,.about-rips a:focus-visible{text-decoration:underline}
.about-rips a span{display:block;font:700 var(--t-micro)/1.5 var(--mono);
  letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.about-ripnote{margin-top:var(--s3);font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2)}
.about-ripnote a{color:var(--sky-deep);text-decoration:underline}
.stat-row span{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase;text-align:right}
.about-socials{display:flex;flex-direction:column;gap:var(--s2)}
.about-socials a{display:flex;align-items:center;gap:var(--s3);min-height:48px;
  padding:0 var(--s4);border-radius:var(--r-pill);background:var(--page);
  border:1px solid var(--hair);font:600 var(--t-sm)/1 var(--body)}
.about-socials a:hover{border-color:var(--ink)}
.about-socials i{width:11px;height:11px;border-radius:50%;background:var(--pip);flex:none}
.about-roc{display:flex;align-items:center;gap:var(--s4)}
.about-roc img{width:74px;flex:none}
.about-roc p{font:700 var(--t-micro)/1.6 var(--mono);color:var(--ink-2);letter-spacing:.03em;margin:0}

/* THE ONE PICTURE ON THIS PAGE. It sits with the paragraph about the sealed
   wrapper because that paragraph describes an object, and the object exists:
   it is the wrapper drawn for this channel, the one every rip page opens with,
   and it happens to carry the Rochester joke the two paragraphs above it are
   making. A page whose whole job is saying whose site this is had one image on
   it and that image was a badge.
   170px is the drawn width and the file is 400 wide, which is what
   scripts/build-packs.py makes the tile for: "a tile is never wider than about
   200 CSS px, so 400 covers it at 2x". Do not point this at the non-tile file,
   which is 810x1440 and exists for the rip page player. */
.about-pack{display:flex;gap:var(--s4);align-items:flex-start;margin:var(--s5) 0}
.about-pack img{width:170px;height:auto;flex:none;border-radius:6px;
  filter:drop-shadow(0 10px 18px rgba(17,17,17,.22))}
.about-pack figcaption{font:400 var(--t-micro)/1.6 var(--body);color:var(--ink-2);margin:0}
@media(max-width:420px){
  .about-pack{flex-direction:column;align-items:center;text-align:center}
  .about-pack img{width:min(200px,64vw)}
}
`;

const body = `
<main id="main" class="about-page">
  <div class="wrap">
    <div class="brk"><h1>About</h1><span class="ln"></span>
      ${/* THE ONLY SUBSCRIBE CONTROL ON THE SITE WITHOUT THE STANDARD LABEL.
            shared/chrome.mjs puts the same sentence on all four of the others,
            the bar pill, the menu pill, the footer button and the one on every
            rip page, and this fifth one is written here rather than imported
            so it was missed. Same words on purpose: a reader listening to the
            page should not be told two different things about one control. */ ""}<a href="${SUBSCRIBE}"
        aria-label="Subscribe to Garbage Rips 585 on YouTube. Opens YouTube.">Subscribe &rarr;</a></div>
    <p class="about-lede">Garbage Rips 585 is one guy in Rochester, New York opening Pokemon
      cards on camera. This site is every rip ever filmed, plus a guide to every set they
      came out of.</p>

    <div class="about-grid">
      <div class="about-body">
        <p>Welcome to Garbage Rips 585, where Pokemon packs get ripped like a late-night
          Garbage Plate after the bars close.</p>

        <p>We are proudly repping Rochester, NY, the 585: home of the Garbage Plate, Wegmans,
          weather that cannot make up its mind, and the unofficial Pokemon of the city,
          Garbodor. Around here chaos is a lifestyle and ripping packs is just part of the
          routine.</p>

        <h2>What actually happens here</h2>
        <p>Packs get opened. Most of them are garbage, which is where the name came from.
          Single packs, booster bundles, ETBs, whatever overpriced box was sitting on the
          counter, and every so often an imported pack nobody in the room can read. When
          something good does fall out, the yelling is real.</p>

        <p>Nobody is going to be smug at you here. If you have never held a card and you
          want to know what the little star in the corner means, that is what the guides on
          this site are for, and asking is the whole point of them.</p>

        <p class="about-pull">Grab a fork. Let's rip.</p>

        <h2>What is on this site</h2>
        <p>Every rip has its own page here, with the video embedded, so a click never leaves
          for YouTube unless you want it to. The <a href="/sets/">Card Pokedex</a> explains
          every set we open: how many cards are in it, what is actually rare, and what the
          chase cards are going for. <a href="/wanted.html">Most Wanted</a> is what we are
          hunting right now, <a href="/hall.html">the Card Hall of Fame</a> is what we have
          actually pulled, and <a href="/shops.html">Card shops</a> is where we buy, because
          the local shop is why the local scene exists.</p>

        <p>One rule everywhere: a thumbnail never shows the pulled card. Every video sits
          behind a sealed wrapper you have to rip open, because the whole point is not
          knowing.</p>

        <figure class="about-pack">
          <img src="/assets/packs/default-garbage-rips-585-booster-pack-tile.webp"
               width="400" height="711" loading="lazy" decoding="async"
               alt="The Garbage Rips 585 booster wrapper: a blue Pokemon pack with Trubbish sitting on top of a loaded Garbage Plate, booster packs propped around the rim, and a plate label reading Rochester, NY.">
          <figcaption>This is the wrapper. Trubbish on a Garbage Plate, Rochester NY on the
            plate label, and the channel name across the bottom. Every rip page on this site
            opens sealed behind one, and the pack that gets torn is the one for that video's
            set. Tap it and it shakes, tears down the middle and the video is already
            playing underneath.</figcaption>
        </figure>
      </div>

      <aside class="about-side">
        <div class="about-card">
          <h3>The channel</h3>
          <div class="stat-row"><b>${videos.length}</b><span>rips filmed</span></div>
          <div class="stat-row"><b>${setsRipped}</b><span>sets opened</span></div>
          <div class="stat-row"><b>${sets.length + intlCount}</b><span>set guides</span></div>
          ${since ? `<div class="stat-row"><b>${since.split(" ")[0].slice(0, 3)} ${since.split(" ")[1]}</b><span>first rip</span></div>` : ""}
        </div>

        ${startHere.length ? `<div class="about-card">
          <h3>Start with these</h3>
          <ul class="about-rips">
${startHere
  .map(
    ({ label, v }) => `            <li><a href="/${esc(v.path)}"><span>${esc(label)}</span>${esc(v.siteTitle || v.title)}</a></li>`,
  )
  .join("\n")}
          </ul>
          <p class="about-ripnote">Every one plays on its own page, behind the wrapper.
            <a href="/videos.html">All ${videos.length} rips</a>.</p>
        </div>` : ""}

        <div class="about-card">
          <h3>Find us</h3>
          <div class="about-socials">
${SOCIALS.map(
  ([cls, label, href]) =>
    `            <a href="${href}" rel="me"><i style="--pip:${
      { yt: "#FF0033", ig: "#BC1888", tt: "#FFFFFF", fb: "#1877F2" }[cls]
    }"></i>${label}</a>`
).join("\n")}
          </div>
        </div>

        <div class="about-card about-roc">
          <img src="/assets/roc-lilac.svg" width="240" height="280" alt="A lilac sprig over the words Rochester, New York and the area code 585" loading="lazy" decoding="async">
          <p>MADE IN ROCHESTER, NY.<br>LILACS, LAKE EFFECT, AND A PLATE AT 2AM.</p>
        </div>
      </aside>
    </div>
  </div>
</main>`;

// Person and Organization, cross-linked, with sameAs pointing at every profile.
// This is what lets a search engine treat the channel, the socials and this
// site as one thing rather than four unrelated pages.
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "Garbage Rips 585",
      alternateName: ["GarbageRips585", "Garbage Rips"],
      url: `${SITE}/`,
      logo: `${SITE}/assets/og-image.jpg`,
      description:
        "Pokemon card pack ripping channel from Rochester, New York. Hits, heartbreak and pure chaos.",
      foundingDate: oldest || undefined,
      areaServed: "Rochester, New York",
      sameAs: SOCIALS.map(([, , href]) => href),
    },
    {
      "@type": "AboutPage",
      "@id": `${SITE}/about.html`,
      url: `${SITE}/about.html`,
      name: "About Garbage Rips 585",
      about: { "@id": `${SITE}/#org` },
      isPartOf: { "@id": `${SITE}/#org` },
    },
  ],
};

const home = await readFile(join(ROOT, "public/index.html"), "utf8");
const head = home.slice(home.indexOf("<head>") + 6, home.indexOf("</head>"));
const bar = home.slice(home.indexOf('<header class="bar">'), home.indexOf("</header>") + "</header>".length);
const menu = /<nav class="menu"[\s\S]*?<\/nav>/.exec(home)?.[0] || "";
const sprite = /<svg[^>]*(?:hidden|display:none)[^>]*>[\s\S]*?<\/svg>/.exec(home)?.[0] || "";
const footer = home.slice(home.lastIndexOf("<footer"), home.indexOf("</footer>") + 9);

const swapped = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>About Garbage Rips 585 | Pokemon Pack Rips from Rochester, NY</title>`)
  .replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="Garbage Rips 585 is one guy in Rochester, New York opening Pokemon cards on camera. ${videos.length} rips across ${setsRipped} sets, all of them on this site.">`
  )
  .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/about.html">`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}/about.html`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1About Garbage Rips 585`)
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, "");

await writeFile(
  join(ROOT, "public/about.html"),
  `<!DOCTYPE html>
<html lang="en">
<head>${swapped}<style>${style}</style>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${sprite}

${bar}
${menu}
${body}
${footer}

${APP_JS}
</body>
</html>
`
);

console.log(`Wrote public/about.html
  ${videos.length} rips, ${setsRipped} sets opened, ${sets.length} guides, since ${since}
  Person/Organization schema with sameAs across ${SOCIALS.length} profiles
`);
