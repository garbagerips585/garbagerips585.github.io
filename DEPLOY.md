# Deploying Garbage Rips 585 to Cloudflare Pages

Static site, no build step. The whole job is: get the repo on GitHub, point
Cloudflare Pages at it, then attach the domain.

---

## Step 1. Push the repo to GitHub

Cloudflare Pages can auto-deploy every time you push, which is worth the two
minutes of setup. From the project folder:

```bash
gh repo create TimGrenco/garbage-rips-585 --public --source=. --remote=origin --push
```

Use `--private` instead of `--public` if you would rather keep it closed.
Cloudflare works fine with either.

Nothing secret is in here (no API keys, the YouTube feeds are all public
playlist IDs), so public is fine and gives you a free extra backlink.

---

## Step 2. Create the Pages project

1. Go to https://dash.cloudflare.com and sign in (create a free account if you
   do not have one).
2. In the left sidebar, open **Compute (Workers & Pages)**.
3. Click **Create**, then pick the **Pages** tab, then
   **Connect to Git**.
4. Authorize Cloudflare's GitHub app. When GitHub asks which repos to grant,
   you can pick just `garbage-rips-585`.
5. Select the `garbage-rips-585` repo and click **Begin setup**.

Build settings, this is the part people get wrong:

| Field | Value |
| --- | --- |
| Project name | `garbage-rips-585` (becomes your `.pages.dev` subdomain) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | **leave completely blank** |
| Build output directory | `/` |

There is no build step. If you put anything in the build command box,
Cloudflare will try to run it and fail.

6. Click **Save and Deploy**.

About 30 seconds later you get a live URL like
`https://garbage-rips-585.pages.dev`. Open it and click around: the card
flip, the ticker, and both YouTube players should all work exactly like they
do locally.

From here on, every `git push` to `main` redeploys automatically. Pushing to
any other branch gives you a preview URL instead, which is handy for trying
things before they go live.

---

## Step 3. Buy the domain

Two options.

**Easiest: buy it at Cloudflare.** Dashboard sidebar > **Domain Registration**
> **Register Domain** > search `garbagerips585.com`. Roughly $10 to $12 a
year for a .com, at cost with no markup. The DNS is already in the right
account, so Step 4 becomes almost nothing. Note that Cloudflare Registrar
requires the domain to be one they support, and .com is.

**Or buy it anywhere else** (Namecheap, Porkbun, Google Domains successor,
whoever). If you do, you then need to move DNS to Cloudflare:

1. Cloudflare dashboard > **Add a domain** > enter `garbagerips585.com` >
   pick the **Free** plan.
2. Cloudflare scans for existing DNS records and shows you two nameservers,
   something like `dana.ns.cloudflare.com` and `rick.ns.cloudflare.com`.
3. Log in to the registrar where you bought it, find "nameservers" or "DNS",
   switch from their defaults to **custom nameservers**, and paste in
   Cloudflare's two.
4. Save, then wait. This usually takes 15 minutes to a few hours, and can
   take up to 24. Cloudflare emails you when the domain goes active.

Do not do Step 4 until Cloudflare shows the domain as **Active**.

---

## Step 4. Attach the domain to the site

1. Dashboard > **Compute (Workers & Pages)** > your `garbage-rips-585`
   project.
2. **Custom domains** tab > **Set up a custom domain**.
3. Enter `garbagerips585.com` and confirm. Because the domain is already in
   your Cloudflare account, it creates the DNS record for you. No copying
   values around.
4. Do it a second time for `www.garbagerips585.com`.

SSL is automatic and free. Give it a few minutes for the certificate to
issue, then load `https://garbagerips585.com`.

### Point www at the apex

You want one canonical address, not two copies of the site. The page's
`<link rel="canonical">` already says `https://garbagerips585.com/`
(no www), so send www there:

1. In the dashboard, select the **garbagerips585.com** domain (not the Pages
   project) > **Rules** > **Redirect Rules** > **Create rule**.
2. Name it `www to apex`.
3. Custom filter expression, field **Hostname**, operator **equals**, value
   `www.garbagerips585.com`.
4. Then: URL redirect, type **Dynamic**, expression
   `concat("https://garbagerips585.com", http.request.uri.path)`,
   status code **301**, and tick **preserve query string**.
5. Deploy.

Check it: `https://www.garbagerips585.com/` should land on the non-www
address.

---

## Step 5. Tell Google it exists

Now that the domain resolves, `robots.txt`, `sitemap.xml`, and the og:image
absolute URL all work.

1. Go to https://search.google.com/search-console and add a property.
2. Pick **Domain** (the left box, not URL prefix). Enter
   `garbagerips585.com`.
3. Google gives you a TXT record. In Cloudflare: your domain > **DNS** >
   **Add record** > type **TXT**, name `@`, content = the string Google
   gave you. Save, then hit Verify in Search Console. Cloudflare DNS is
   fast, so this usually works on the first try.
4. Once verified: **Sitemaps** in the left sidebar > enter `sitemap.xml` >
   Submit.
5. Also go to **URL Inspection**, paste `https://garbagerips585.com/`, and
   click **Request Indexing** to skip the queue.

Then confirm the social previews look right:

- Facebook: https://developers.facebook.com/tools/debug/
- LinkedIn: https://www.linkedin.com/post-inspector/

Both let you force a re-scrape if you change the og:image later. X/Twitter
retired its public card validator, but it reads the same tags.

---

## Ongoing

Deploying a change is just:

```bash
git add -A && git commit -m "what changed" && git push
```

Cloudflare picks it up within a minute. Rollbacks live under the project's
**Deployments** tab: find a previous build, then **Rollback to this
deployment**.

Two things to remember as the site grows:

- Every new page needs an entry in `sitemap.xml`.
- `.claude/` is gitignored, so the local preview server never deploys.
