# Launch day: the ordered procedure

One pass, top to bottom, on the day `garbagerips.com` goes live. Every step has
a **check** that proves it landed and a **symptom** so a failure is recognisable
rather than mysterious.

`DEPLOY.md` explains *why* each piece is shaped the way it is and `LAUNCH.md`
tracks what still has to be supplied. **This file is the sequence.** If the two
disagree about an instruction, this one was written last and against a real
rehearsal; fix the other one rather than guessing.

> **The one number that matters before you start:** `python3
> scripts/rehearse-flip.py` must exit 0. It builds HEAD twice, once as it stands
> and once flipped, and compares them. Rehearsed 21 August 2026: 65 of 65
> builders both sides, 1,486 pages change, 1,281 sitemap urls move from
> `garbagerips585.github.io` to `garbagerips.com`, 206 `noindex` pages before and
> the same 206 after, zero files naming the staging host afterwards.

---

## 0. Before the day — DNS, which is the slow part

Setting DNS early costs nothing and cannot put the site live on its own. Until
the domain is named in the repo's Pages settings GitHub answers a 404 to anyone
who types it, and nobody knows the domain yet.

**Do NOT set the custom domain in Settings → Pages during this step.** That is
the switch, and it is step 7.

---

## 1. GoDaddy — remove the parking records on `garbagerips.com`

GoDaddy → **My Products** → `garbagerips.com` → **DNS** → **Manage Zones**.

Delete both existing apex `A` records:

```
76.223.105.230
13.248.243.5
```

These are GoDaddy's own parking IPs, added automatically when the domain was
bought. **They must go before the GitHub records go in, not after.** Four correct
records alongside two wrong ones is a round-robin: roughly a third of visitors
get the parking page and the rest get the site, which looks like an intermittent
fault rather than a misconfiguration and is the single most confusing way this
can fail.

- **Check:** `dig +short garbagerips.com A` returns nothing (or only the GitHub
  four, after step 2).
- **Symptom if missed:** the site loads for you and shows a GoDaddy "future home
  of something quite cool" parking page for somebody else, or alternates between
  the two on refresh. Also: GitHub's Pages settings will report the DNS check as
  failing and refuse to issue the certificate.

## 2. GoDaddy — add GitHub's four A records on `garbagerips.com`

Four `A` records on the apex, host `@`:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

These are the addresses GitHub documents for Pages apex domains.

- **Check:** `dig +short garbagerips.com A` returns exactly those four and
  nothing else. DNS can take up to 24 hours; re-check rather than re-adding.
- **Symptom if wrong:** `https://garbagerips.com` times out, or GitHub's Pages
  settings show "Domain does not resolve to the GitHub Pages server".

## 3. GoDaddy — repoint the `www` CNAME

Host `www`, type `CNAME`, value:

```
garbagerips585.github.io
```

Note there is no repository name and no trailing path. GoDaddy will usually
already have a `www` record pointing at a parking target — **edit it, do not add
a second.** A hostname cannot carry two CNAMEs and the zone editor will either
refuse or silently keep one.

- **Check:** `dig +short www.garbagerips.com CNAME` returns
  `garbagerips585.github.io.`
- **Symptom if wrong:** the apex works and `www.` does not, which is the half of
  the domain people actually type into a browser bar.

## 4. GoDaddy — confirm there is NO Forwarding on `garbagerips.com`

Domain → **Forwarding** must be empty for both the domain and `www`.

GoDaddy implements forwarding by inserting its own records into the zone, so a
forward set on the domain you are trying to serve **overwrites the work in steps
2 and 3**. This is not a warning about tidiness; it is the mechanism.

- **Check:** the Forwarding panel shows nothing for `garbagerips.com`, and after
  saving, `dig +short garbagerips.com A` still shows only GitHub's four.
- **Symptom if set:** the A records revert to a GoDaddy IP hours later with no
  action from anyone, and the site "stops working by itself".

## 5. GoDaddy — the 585 domain is a redirect, with masking OFF

`garbagerips585.com` → **Forwarding** → forward `garbagerips585.com` **and**
`www.garbagerips585.com` to `https://garbagerips.com`, **permanent (301)**,
**forward with masking OFF**.

**Masking is the setting that quietly ruins this.** Masking keeps
`garbagerips585.com` in the address bar and serves the real site inside a frame,
so search engines see one thin framing page instead of 1,486 real ones, every
shared link previews as the frame rather than the page, and the canonical host
the whole flip exists to establish is hidden from everyone.

GitHub Pages serves exactly one custom domain per site, so this genuinely cannot
be a second address — it is a redirect or it is nothing. Nothing in this repo
knows about it, and nothing should: the rehearsal fails if
`garbagerips585.com` ever appears in built output.

- **Check:** `curl -sI https://garbagerips585.com/ | head -3` shows `301` with
  `location: https://garbagerips.com/`. Confirmed absent from the build by
  `grep -r "garbagerips585.com" public/` returning nothing.
- **Symptom if masking is on:** the address bar keeps saying
  `garbagerips585.com` after the redirect. That is the whole tell.

---

## 6. Flip the flag and build

Everything from here happens in one commit.

```bash
python3 scripts/rehearse-flip.py        # must exit 0 BEFORE you touch anything
```

Then, in `shared/site.mjs`:

```js
export const LIVE = true;
```

```bash
node scripts/build-all.mjs
python3 scripts/check-build.py
```

That one flag moves every canonical, `og:url`, `og:image`, sitemap entry and
JSON-LD `@id` onto the real domain, turns `robots.txt` from `Disallow: /` into
`Allow: /` with a `Sitemap:` line, and writes `public/CNAME`.

- **Check:** all four of these, and the first is not optional:

  ```bash
  grep -rl "github.io" public/ | grep -v assets   # must return nothing
  head -3 public/robots.txt                       # must say Allow: /
  cat public/CNAME                                # must say garbagerips.com
  grep -c "<loc>" public/sitemap.xml              # 1,281 at HEAD; treat as a floor
  ```

- **Expected diff shape**, so an unexpected one is visible: **1,486 HTML files
  change**, plus `robots.txt` and `sitemap.xml`, plus `public/CNAME` added.
  **`public/404.html` is the one HTML file that does not change and that is
  correct** — it carries no canonical, no `og:url` and no JSON-LD, only relative
  links. Anything else sitting still is a page that has stopped deriving its
  address from `SITE`.
- **Symptom if the grep finds something:** the sitemap and the pages would
  disagree about where the site lives, which a search engine usually resolves by
  dropping the url rather than by picking one.

## 7. Commit and push

**Stage by name.** `git add -A` sweeps up whatever else is mid-edit in the tree;
it has committed another writer's half-finished work here before.

- **Check:** the Actions run for **Deploy to GitHub Pages** goes green.
- **Symptom:** a run stuck in `waiting` holds the `pages` concurrency group and
  every later push is silently dropped as an intermediate — no red X, no email,
  the site just keeps serving the old build. The 20-minute job timeout is what
  breaks that, but if the site is stale and nothing failed, this is why.

## 8. Set the custom domain in GitHub — this is the actual switch

Repo → **Settings** → **Pages** → **Custom domain** → `garbagerips.com` → Save.

**`public/CNAME` is NOT what does this.** This site
publishes from a custom Actions workflow (`actions/deploy-pages@v4`), and GitHub
documents that case explicitly: *"If you are publishing from a custom GitHub
Actions workflow, no `CNAME` file is created, and any existing `CNAME` file is
ignored and is not required."* The file is worth keeping as a record of intent,
but the custom domain lives in this settings field and nowhere else. If the
domain does not answer, the fix is here, not in the build.

DEPLOY.md claimed the opposite until 21 August 2026 and now agrees with this
step. If you are reading a fourth account of it somewhere, that one is the stale
one.

- **Check:** the settings page shows the domain with a green DNS check.
- **Symptom:** `garbagerips.com` returns GitHub's "There isn't a GitHub Pages
  site here" 404 — that is the domain resolving correctly to GitHub and GitHub
  not knowing it should serve you. Nothing about DNS is wrong at that point.

**Keep the gap between step 7 and step 8 short — minutes, not hours.** In
between, the flipped build is live on `garbagerips585.github.io` with an open
`robots.txt`, which is the one moment the staging host is both crawlable and
serving. It is survivable rather than dangerous: every page in that window
canonicalises to `garbagerips.com`, verified across all 1,486 pages in the
rehearsal, so anything crawled points at the right address anyway. Do not
dawdle, and do not panic.

## 9. Enforce HTTPS

Same settings panel, tick **Enforce HTTPS** once the certificate has been
issued.

GitHub's documentation gives no time figure for this; it says only that the
process may take some time, and that if it has not finished several minutes
after you clicked Save you should click **Remove** next to the custom domain and
re-add it. Do not sit and wait on a number nobody published.

- **Check:** `curl -sI https://garbagerips.com/ | head -1` returns `200`.
- **Symptom:** a certificate error on `https://`, or `http://` never upgrading.
  Remove and re-add the domain; that is GitHub's own advice, not a folk remedy.

---

## 10. The second address, which resolves itself

**`garbagerips585.github.io` stops serving the site the moment the custom domain
is set. It does not become a duplicate.** GitHub Pages answers the default
`*.github.io` host with a **path-preserving 301** to the custom domain, for every
path including ones that do not exist.

GitHub's current documentation does not state this in prose — the old
"custom domain redirects" article was folded into *About custom domains and
GitHub Pages*, which now only documents apex↔`www` redirects — so it was
established against live Pages sites instead, on 21 August 2026:

```
benhoyt.github.io/writings/          301 -> https://benhoyt.com/writings/
benhoyt.github.io/robots.txt         301 -> https://benhoyt.com/robots.txt
benhoyt.github.io/nonexistent.html   301 -> https://benhoyt.com/nonexistent.html
addyosmani.github.io/blog/           301 -> http://addyosmani.com/blog/
scikit-learn.github.io/stable/       301 -> http://scikit-learn.org/stable/
pandas-dev.github.io/docs/           301 -> http://pandas.pydata.org/docs/
```

Nine of nine `<owner>.github.io` sites with a custom domain behaved identically.
So there is no second copy to fight, no duplicate robots.txt, and no canonical
to worry about during the redirect: **the github.io host serves no HTML at all
afterwards**, so there is nothing left on it to carry a canonical. The 301 is
itself the strongest signal a search engine takes.

Two consequences worth knowing:

- The redirect exists **only while the custom domain is configured**. Remove the
  domain in Settings → Pages and github.io starts serving the site again.
- Sites with **Enforce HTTPS** off redirect to `http://` first and then again to
  `https://` — two hops. Step 9 is what collapses that to one.

- **Check:** `curl -sI https://garbagerips585.github.io/ | head -3` shows `301`
  with `location: https://garbagerips.com/`.
- **Symptom if it is still serving:** a `200` here means the custom domain is not
  actually set — go back to step 8.

## 11. Search Console, and only now

Add the property at <https://search.google.com/search-console>, verify by DNS
`TXT` record at GoDaddy, and submit `https://garbagerips.com/sitemap.xml`.

**After the flip, never before.** Submitting while `robots.txt` still says
`Disallow: /` teaches Google the site is closed, and that is slow to unteach.

- **Check:** the sitemap is accepted and reports ~1,281 discovered urls.
- **Symptom:** "Couldn't fetch" usually means the DNS or the custom domain is not
  finished, not that the sitemap is wrong.

---

## 12. Post-flight, five minutes after

```bash
curl -sI https://garbagerips.com/ | head -1                    # 200
curl -sI https://www.garbagerips.com/ | head -3                # 301 -> apex
curl -sI https://garbagerips585.github.io/ | head -3           # 301 -> apex
curl -sI https://garbagerips585.com/ | head -3                 # 301 -> apex
curl -s  https://garbagerips.com/robots.txt                    # Allow: / + Sitemap:
curl -s  https://garbagerips.com/ | grep -o 'rel="canonical"[^>]*'
curl -s  https://garbagerips.com/ | grep -o 'og:image[^>]*'
```

The last two are the ones a rehearsal cannot fully stand in for, because they
are the tags a social network and a search engine actually read off the live
host. `og:image` in particular is the original bug this whole module was built
to prevent: the site once pointed every preview image at a domain nobody owned,
so sharing a link produced a blank card.

---

## Rolling back

Set `LIVE = false`, run `build-all.mjs`, push, **and remove the custom domain in
Settings → Pages**. All three, in that order.

Canonicals return to the staging host, `robots.txt` closes, `public/CNAME` is
deleted. Removing the custom domain is the step people skip: GitHub keeps
serving it, and the 301 off `garbagerips585.github.io` keeps firing, so the site
carries on answering on a domain the build has stopped canonicalising to.
