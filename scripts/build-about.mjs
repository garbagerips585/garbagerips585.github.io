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
import { SOCIALS, SUBSCRIBE, APP_JS } from "../shared/chrome.mjs";
import { MONTHS_LONG as MONTHS } from "../shared/format.mjs";

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
`;

const body = `
<main id="main" class="about-page">
  <div class="wrap">
    <div class="brk"><h1>About</h1><span class="ln"></span>
      <a href="${SUBSCRIBE}">Subscribe &rarr;</a></div>
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

        <h2>What you get</h2>
        <ul>
          <li>Pokemon card pack rips: hits, heartbreak, and pure chaos</li>
          <li>Big boxes, weird pulls, and unpredictable luck</li>
          <li>Charizard chases fueled by plate grease and good vibes</li>
          <li>Zero seriousness, all fun</li>
        </ul>

        <p>This channel is about enjoying the rip, laughing at the misses, and celebrating
          the hits. No gatekeeping, no pressure, just good times and great cards.</p>

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
      </div>

      <aside class="about-side">
        <div class="about-card">
          <h3>The channel</h3>
          <div class="stat-row"><b>${videos.length}</b><span>rips filmed</span></div>
          <div class="stat-row"><b>${setsRipped}</b><span>sets opened</span></div>
          <div class="stat-row"><b>${sets.length + intlCount}</b><span>set guides</span></div>
          ${since ? `<div class="stat-row"><b>${since.split(" ")[0].slice(0, 3)} ${since.split(" ")[1]}</b><span>first rip</span></div>` : ""}
        </div>

        <div class="about-card">
          <h3>Find us</h3>
          <div class="about-socials">
${SOCIALS.map(
  ([cls, label, href]) =>
    `            <a href="${href}" rel="me"><i style="--pip:${
      { yt: "#FF0033", ig: "#BC1888", tt: "#111", fb: "#1877F2" }[cls]
    }"></i>${label}</a>`
).join("\n")}
          </div>
        </div>

        <div class="about-card about-roc">
          <img src="/assets/roc-badge.svg" width="240" height="280" alt="ROC 585 Rochester New York badge">
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
