/**
 * Tell IndexNow which pages changed, so Bing does not have to find out by crawling.
 *
 * WHY THIS EXISTS. This site publishes a page every single day and Google had
 * crawled roughly a third of it: Search Console's verdict on a rip page was
 * "Discovered - currently not indexed", with Last crawl N/A. Publishing and then
 * waiting to be found is the whole bottleneck. IndexNow inverts it: the site
 * announces the url the moment it is live, and Bing, Yandex and the other
 * participating engines pull it rather than waiting for a crawl slot.
 *
 * IT DOES NOTHING FOR GOOGLE, and that is worth being plain about rather than
 * quietly implying otherwise. Google does not participate. This is a Bing,
 * Yandex, Seznam and Naver mechanism, and its value here is that Bing indexes a
 * young site faster than Google does, so it is a second route to being findable
 * while Google warms up.
 *
 * THE KEY IS PUBLIC BY DESIGN. public/<key>.txt is how the protocol proves the
 * submitter controls the domain: anyone can read it, and that is the point, so
 * it belongs in the repo rather than in a secret. Compromise is not a
 * meaningful risk -- the worst somebody can do with it is ask Bing to re-crawl
 * pages that are already public.
 *
 * ONLY WHAT CHANGED, NOT THE WHOLE SITE. Submitting all 1,304 urls on every
 * deploy would be both useless and rude: the protocol asks for pages that have
 * actually been added or updated, and a firehose is how a submitter gets
 * ignored. The default is the html files touched by the last commit.
 *
 *   node scripts/indexnow.mjs              # urls from the last commit
 *   node scripts/indexnow.mjs --dry-run    # print them, send nothing
 *   node scripts/indexnow.mjs --all        # every indexable url in the sitemap
 *   node scripts/indexnow.mjs /a.html /b.html
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = SITE.replace(/^https?:\/\//, "").replace(/\/$/, "");
const ENDPOINT = "https://api.indexnow.org/IndexNow";
const MAX = 10000;                       // the protocol's per-request ceiling
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");

/* THE KEY FILE IS THE SOURCE OF TRUTH FOR THE KEY, not a constant in here. Two
   copies of a credential drift, and the copy that matters is the one the search
   engine fetches. Found by looking for it rather than by being told. */
const keyFile = (await readdir(join(ROOT, "public")))
  .find((f) => /^[0-9a-f]{8,128}\.txt$/i.test(f));
if (!keyFile) {
  console.error("No IndexNow key file in public/. Expected <key>.txt at the site root.");
  process.exit(1);
}
const key = (await readFile(join(ROOT, "public", keyFile), "utf8")).trim();
if (!key || `${key}.txt` !== keyFile) {
  console.error(`Key file ${keyFile} does not contain its own key. IndexNow will reject this.`);
  process.exit(1);
}

/** public/a/b.html -> https://host/a/b.html, and index.html -> the directory. */
const toUrl = (rel) => {
  let p = rel.replace(/^public\//, "");
  if (p === "index.html") return `${SITE}/`;
  if (p.endsWith("/index.html")) return `${SITE}/${p.slice(0, -"index.html".length)}`;
  return `${SITE}/${p}`;
};

let urls = [];
const explicit = args.filter((a) => !a.startsWith("--"));
if (explicit.length) {
  urls = explicit.map((u) => (u.startsWith("http") ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`));
} else if (args.includes("--all")) {
  const xml = await readFile(join(ROOT, "public/sitemap.xml"), "utf8");
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} else {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACM", "HEAD~1", "HEAD"], {
    cwd: ROOT, encoding: "utf8",
  });
  urls = out.split("\n")
    .filter((f) => f.startsWith("public/") && f.endsWith(".html"))
    .map(toUrl);
}

/* A PAGE THAT TELLS A CRAWLER TO GO AWAY MUST NOT BE SUBMITTED. Asking an engine
   to fetch a noindex page is the "Submitted URL marked noindex" error in every
   webmaster console, and 190 pages on this site are deliberately noindex. */
const before = urls.length;
urls = urls.filter((u) => {
  let rel = u === `${SITE}/` ? "index.html" : u.slice(SITE.length + 1);
  if (rel.endsWith("/")) rel += "index.html";
  const p = join(ROOT, "public", rel);
  if (!existsSync(p)) return false;
  return !/name="robots"[^>]*noindex/i.test(readFileSync(p, "utf8"));
});
const skipped = before - urls.length;
urls = [...new Set(urls)].slice(0, MAX);

if (!urls.length) {
  console.log("Nothing to submit: no indexable html changed in the last commit.");
  process.exit(0);
}
console.log(`IndexNow: ${urls.length} url(s)${skipped ? `, ${skipped} skipped (missing or noindex)` : ""}`);
for (const u of urls.slice(0, 12)) console.log(`  ${u}`);
if (urls.length > 12) console.log(`  ... and ${urls.length - 12} more`);

if (dry) { console.log("\n--dry-run: nothing sent."); process.exit(0); }

const body = { host: HOST, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls };
const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

/* 200 and 202 both mean accepted; 202 means "key not yet validated", which is
   normal on the first run and is not a failure. Anything else is worth seeing in
   full, but NEVER worth failing a deploy over: the site is already live and
   correct at this point, and a search engine ping that did not land is not a
   reason to go red. */
if (res.status === 200 || res.status === 202) {
  console.log(`\nAccepted (HTTP ${res.status}${res.status === 202 ? ", key pending validation" : ""}).`);
} else {
  console.log(`\nIndexNow returned HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log("Not failing the run. The site is published either way.");
}
