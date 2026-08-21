#!/usr/bin/env python3
"""Rehearse the launch-day domain flip, without touching the working tree.

THIS PATH RUNS EXACTLY ONCE, WHICH IS WHY IT NEEDS A REHEARSAL. Flipping
shared/site.mjs from staging to the real domain rewrites every canonical, every
og:url, the sitemap, the JSON-LD and robots.txt, and writes public/CNAME. It has
been broken before in a way nothing could catch beforehand: build-proto.mjs
called basename() without importing it, inside the one branch that only executes
when there IS a staging url to rewrite. Every build was green. The flip would
have failed on the day.

DEPLOY.md says to re-rehearse after any change to shared/site.mjs,
build-proto.mjs or the builders. That instruction was ignored for five days
because rehearsing meant remembering a sequence. This is the sequence.

    python3 scripts/rehearse-flip.py

It copies HEAD (not the working tree, so a half-written file cannot make a
failure ambiguous), builds it TWICE -- once as it stands and once with LIVE
flipped -- and then checks the things that only go wrong at flip time. Exit 0
means the flip is safe to do for real.

WHY IT READS FROM `git archive HEAD` AND NOT FROM public/. The working tree is
frequently mid-edit here, and a build failure in a copy of a half-written tree
tells you nothing about whether the FLIP works. Committed state is the only
state worth rehearsing.

WHY IT BUILDS BOTH SIDES, ADDED 21 AUGUST 2026, AND WHAT THAT FIXED. Three
earlier versions built only the flipped tree, and three whole classes of failure
were invisible to them:

  * The before/after noindex comparison this script has always PRINTED could
    never be made, because there was no "before" to compare to. Its own comment
    said "count them so the before/after can be compared" and then printed one
    number into the void. A page that quietly STOPPED being noindex at the flip
    passed every check: it is not in the sitemap and it is not a leak, it has
    just silently become indexable. Now the two noindex sets are compared as
    sets and any difference in either direction fails.
  * A builder that hardcodes the REAL domain instead of deriving it from SITE is
    invisible from the flipped side, because from there it looks perfect. It
    only shows up as a garbagerips.com leaking out of the UNFLIPPED build, which
    is what today's site is serving. That is the same bug as the five `const
    SITE`s shared/site.mjs was created to delete, just pointing the other way.
  * "Is there any file that should have changed and did not" cannot be asked of
    one tree. Every page carrying a canonical or an og:url must differ across
    the flip. 404.html carries neither and is the one file that legitimately
    does not move.

Two builds is about twice the wall clock. This runs once before a launch.
"""

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent


def run(cmd, cwd, **kw):
    return subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), **kw)


# ALL OF THESE ARE READ INSIDE main() AND MUST BE DEFINED ABOVE IT. They sat
# below it and resolved only because a module global is looked up at call time,
# so importing this file -- or moving sys.exit(main()) up by one line -- raised
# NameError AFTER a full 65-builder build had already run.

# Fallback only. The real staging host is read out of shared/site.mjs at run
# time: hardcoding it here is the exact habit this whole module exists to
# delete, and a STAGING that changed would silently stop being checked.
HOST_STAGING_FALLBACK = "github.io"

# THE THIRD DOMAIN, WHICH IS NOT IN shared/site.mjs AND MUST NOT BE.
# garbagerips585.com is a registrar-level 301 to the real domain, set at GoDaddy
# with masking OFF, and nothing in this repo should ever emit it: a built page
# naming it would send a reader through a redirect that drops the path, and a
# canonical naming it would point search engines at an address that serves no
# HTML at all. It has no business being in SITE, so it is named here instead,
# purely to be checked for and never to be built from.
REDIRECT_DOMAIN_HOST = "garbagerips585.com"

# Everything that is not text. The staging-host scan reads every other file in
# the deploy root, which is the point: it used to allow-list four suffixes and
# never opened the 29 .js/.css/.svg/.webmanifest files the site actually ships.
BINARY_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3", ".pdf", ".zip", ".gz",
}

NOINDEX = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', re.I)
CANONICAL = re.compile(r'<link rel="canonical" href="([^"]+)"')
OG_URL = re.compile(r'<meta[^>]+property=["\']og:url["\'][^>]+content=["\']([^"\']+)')
OG_IMAGE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)')


def text_files(root):
    """Every shipped file that is not a blob, relative path and contents."""
    for f in sorted(root.rglob("*")):
        if not f.is_file() or f.suffix.lower() in BINARY_SUFFIXES:
            continue
        yield f, f.read_text(errors="ignore")


def page_path(root, f):
    """The url path a built file is served at."""
    rel = "/" + str(f.relative_to(root))
    return rel[: -len("index.html")] if rel.endswith("/index.html") else rel


def survey(root, base):
    """Everything worth knowing about one built tree, gathered in one walk."""
    sitemap = (root / "sitemap.xml").read_text()
    locs = re.findall(r"<loc>(.*?)</loc>", sitemap)
    sm_paths = {(u[len(base):] or "/") if u.startswith(base) else u for u in locs}

    s = {
        "root": root, "base": base, "locs": locs, "sm_paths": sm_paths,
        "off_host": [u for u in locs if not u.startswith(base)],
        "noindex": set(), "self_urlish": set(), "hosts": {},
        "mismatched": [], "og_bad": [], "og_img_bad": [],
        "missing_from_sitemap": [], "robots": (root / "robots.txt").read_text(),
    }

    for f, t in text_files(root):
        rel_file = str(f.relative_to(root))
        for host in re.findall(r"https?://([^/\"'\s<>)]+)", t):
            s["hosts"].setdefault(host, set()).add(rel_file)
        if f.suffix != ".html":
            continue
        rel = page_path(root, f)

        if NOINDEX.search(t):
            s["noindex"].add(rel)
        elif rel not in s["sm_paths"] and rel != "/404.html":
            s["missing_from_sitemap"].append(rel)

        def path_of(u):
            return u[len(base):] or "/" if u.startswith(base) else u

        m = CANONICAL.search(t)
        og = OG_URL.search(t)
        img = OG_IMAGE.search(t)
        if m or og:
            # A page that names its own address MUST move when the address does.
            s["self_urlish"].add(rel_file)
        if m and path_of(m.group(1)) != rel:
            s["mismatched"].append((rel, m.group(1)))
        if og and path_of(og.group(1)) != rel:
            s["og_bad"].append((rel, og.group(1)))
        # og:image IS THE ORIGINAL BUG. shared/site.mjs's header records that the
        # site once told every social network to fetch its preview from a domain
        # nobody owned, so sharing a link produced a blank card. It is a full
        # url on its own host and was never once checked here.
        if img and not img.group(1).startswith(base):
            s["og_img_bad"].append((rel, img.group(1)))
    return s


def main() -> int:
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="flip-rehearsal-"))
    try:
        archive = subprocess.run(
            ["git", "archive", "HEAD"], cwd=REPO, capture_output=True, check=True
        ).stdout

        trees = {}
        for name in ("before", "after"):
            d = tmp / name
            d.mkdir()
            subprocess.run(["tar", "-x", "-C", str(d)], input=archive, check=True)
            trees[name] = d

        site = trees["after"] / "shared/site.mjs"
        text = site.read_text()
        if "export const LIVE = true;" in text:
            print("LIVE is already true at HEAD. Nothing to rehearse; this IS the flip.")
            return 0
        if "export const LIVE = false;" not in text:
            print("FAIL  shared/site.mjs no longer declares LIVE the way this script expects.")
            return 1
        site.write_text(text.replace("export const LIVE = false;", "export const LIVE = true;"))

        domain = re.search(r'export const DOMAIN = "([^"]+)"', text)
        staging = re.search(r'export const STAGING = "([^"]+)"', text)
        if not domain:
            print("FAIL  cannot read DOMAIN out of shared/site.mjs")
            return 1
        dom = domain.group(1)
        host = dom.split("//", 1)[1]
        stage_url = staging.group(1) if staging else None
        host_staging = stage_url.split("//", 1)[1] if stage_url else HOST_STAGING_FALLBACK
        if not staging:
            print(f"  note           no STAGING in site.mjs; scanning for {host_staging!r}")
        print(f"rehearsing the flip {stage_url or '(staging)'} -> {dom}\n")

        # The samples are deleted from the real tree; if any come back, they are
        # the thing most likely to fail the github.io proof below, so say so
        # rather than quietly deleting them here.
        strays = sorted((trees["after"] / "public").glob("preview-*.html"))

        for name, d in trees.items():
            log = d / "build.log"
            with log.open("w") as fh:
                build = run(["node", "scripts/build-all.mjs"], d,
                            stdout=fh, stderr=subprocess.STDOUT)
            # EXIT CODE ONLY. Grepping build output for "error" has produced
            # false greens in this repo more than once.
            if build.returncode != 0:
                print(f"FAIL  build-all exited {build.returncode} on the {name} tree. Log:\n")
                print(log.read_text()[-4000:])
                return 1
            built = re.findall(r"(\d+) of (\d+) builders ok", log.read_text())
            tail = f", {built[-1][0]} of {built[-1][1]} builders" if built else ""
            print(f"  build-all      {name:<6} exit 0{tail}")

            check = run(["python3", "scripts/check-build.py"], d, capture_output=True)
            if check.returncode != 0:
                print(f"FAIL  check-build exited {check.returncode} on the {name} tree")
                print(check.stdout.decode(errors="ignore")[-3000:])
                return 1
            print(f"  check-build    {name:<6} exit 0")

        before = survey(trees["before"] / "public", stage_url or "")
        after = survey(trees["after"] / "public", dom)
        fails = []

        # ---- CNAME, both directions -------------------------------------
        cname = trees["after"] / "public/CNAME"
        stale_cname = trees["before"] / "public/CNAME"
        if not cname.is_file():
            fails.append("public/CNAME was not written by the flipped build")
        elif cname.read_text().strip() != host:
            fails.append(f"public/CNAME says {cname.read_text().strip()!r}, expected {host!r}")
        elif stale_cname.is_file():
            fails.append("public/CNAME exists in the UNFLIPPED build; it must be "
                         "written only when LIVE is true, or it cannot track the flag")
        else:
            print(f"  CNAME          absent before, {host} after")

        # ---- robots.txt, both directions --------------------------------
        if "Allow: /" not in after["robots"] or "Disallow: /" in after["robots"]:
            fails.append("robots.txt did not open up")
        elif f"{dom}/sitemap.xml" not in after["robots"]:
            fails.append("robots.txt is open but names no sitemap, or names the wrong one")
        elif "Disallow: /" not in before["robots"]:
            fails.append("robots.txt is NOT closed before the flip; staging is crawlable today")
        else:
            print("  robots.txt     closed before, open and naming the sitemap after")

        # ---- sitemap ----------------------------------------------------
        if after["off_host"]:
            fails.append(f"{len(after['off_host'])} sitemap urls are not on {dom}, "
                         f"first {after['off_host'][0]}")
        if before["off_host"]:
            fails.append(f"{len(before['off_host'])} sitemap urls are not on the staging "
                         f"host before the flip, first {before['off_host'][0]}")

        def file_for(root, p):
            return root / (p.lstrip("/") + ("index.html" if p.endswith("/") else ""))

        missing = [p for p in after["sm_paths"] if not file_for(after["root"], p).is_file()]
        if missing:
            fails.append(f"{len(missing)} sitemap urls resolve to no file, first {missing[0]}")
        if not after["off_host"] and not missing:
            print(f"  sitemap        {len(after['locs'])} urls, all on {host}, all resolving")

        # THE FLIP MOVES ADDRESSES, NOT MEMBERSHIP. If the set of paths in the
        # sitemap changes when only the hostname changed, a builder is deciding
        # what to publish based on the domain, which nothing should do.
        if before["sm_paths"] != after["sm_paths"]:
            only_b = sorted(before["sm_paths"] - after["sm_paths"])[:3]
            only_a = sorted(after["sm_paths"] - before["sm_paths"])[:3]
            fails.append(f"the sitemap's CONTENTS changed across the flip, not just the host: "
                         f"{len(before['sm_paths'])} -> {len(after['sm_paths'])} "
                         f"(dropped {only_b}, gained {only_a})")
        else:
            print(f"  sitemap set    identical both sides ({len(after['sm_paths'])} paths)")

        # ---- host leaks, BOTH DIRECTIONS --------------------------------
        leaked_staging = sorted({p for h, fs in after["hosts"].items()
                                 if host_staging in h for p in fs})
        if leaked_staging:
            fails.append(f"{len(leaked_staging)} files still name the staging host after the "
                         f"flip, first {leaked_staging[0]}")
        else:
            print("  staging host   gone from every generated file after the flip")

        # THE OTHER DIRECTION, AND IT IS THE ONE NOBODY LOOKED FOR. A generator
        # that hardcodes the real domain is perfect from the flipped side and
        # wrong on the site being served TODAY. robots.txt names the real domain
        # on purpose while staging -- it is the note saying where the site is
        # going -- so it is the one allowed exception.
        leaked_live = sorted({p for h, fs in before["hosts"].items()
                              if h == host for p in fs} - {"robots.txt"})
        if leaked_live:
            fails.append(f"{len(leaked_live)} files name {host} BEFORE the flip, which means "
                         f"something hardcodes the domain instead of deriving it from SITE; "
                         f"first {leaked_live[0]}")
        else:
            print(f"  live host      appears today only in robots.txt, where it belongs")

        for name, s in (("before", before), ("after", after)):
            bad = sorted({p for h, fs in s["hosts"].items()
                          if REDIRECT_DOMAIN_HOST in h for p in fs})
            if bad:
                fails.append(f"{len(bad)} files in the {name} build name the redirect domain "
                             f"{REDIRECT_DOMAIN_HOST}, which serves no pages; first {bad[0]}")
        if not any(REDIRECT_DOMAIN_HOST in h
                   for s in (before, after) for h in s["hosts"]):
            print(f"  redirect host  {REDIRECT_DOMAIN_HOST} appears in neither build")

        # ---- the per-page tags ------------------------------------------
        leaks = sorted(after["noindex"] & after["sm_paths"])
        if leaks:
            fails.append(f"{len(leaks)} noindex pages are in the sitemap, first {leaks[0]}")
        else:
            print("  noindex        none of them leak into the sitemap")

        for label, key in (("canonicals", "mismatched"), ("og:url", "og_bad")):
            if after[key]:
                fails.append(f"{len(after[key])} {label} disagree with their own path, "
                             f"first {after[key][0][0]} -> {after[key][0][1]}")
            else:
                print(f"  {label:<14} every one matches its own path")

        if after["og_img_bad"]:
            fails.append(f"{len(after['og_img_bad'])} og:image values are not on {host}, "
                         f"first {after['og_img_bad'][0][0]} -> {after['og_img_bad'][0][1]}")
        else:
            print(f"  og:image       every one on {host}")

        # THE SITEMAP WAS ONLY EVER CHECKED IN ONE DIRECTION -- every loc resolves
        # to a file -- so a builder that silently stopped EMITTING rows passed.
        if after["missing_from_sitemap"]:
            fails.append(f"{len(after['missing_from_sitemap'])} indexable pages are not in the "
                         f"sitemap, first {after['missing_from_sitemap'][0]}")
        else:
            print(f"  sitemap both   every indexable page is in it ({len(after['locs'])})")

        # ---- the noindex set, AS A SET, across the flip ------------------
        # A page that stops being noindex at the flip passes every check above:
        # it is not in the sitemap and it is not a leak. It has just quietly
        # become indexable, or quietly stopped being.
        gained = sorted(after["noindex"] - before["noindex"])
        lost = sorted(before["noindex"] - after["noindex"])
        if gained or lost:
            fails.append(f"the noindex set changed across the flip: "
                         f"{len(before['noindex'])} -> {len(after['noindex'])} "
                         f"(gained {gained[:3]}, lost {lost[:3]})")
        else:
            print(f"  noindex kept   {len(after['noindex'])} pages, the same {len(after['noindex'])} "
                  f"pages, both sides of the flip")

        # ---- the diff shape, and the file that should have moved ---------
        # "Which files change" is the question a person actually asks before
        # doing this, and no rehearsal has ever been able to answer it.
        changed, unchanged_but_should = [], []
        for f, _ in text_files(after["root"]):
            rel = str(f.relative_to(after["root"]))
            twin = before["root"] / rel
            if not twin.is_file():
                continue
            if f.read_bytes() != twin.read_bytes():
                changed.append(rel)
            elif rel in after["self_urlish"]:
                unchanged_but_should.append(rel)
        added = sorted({str(f.relative_to(after["root"])) for f, _ in text_files(after["root"])}
                       - {str(f.relative_to(before["root"])) for f, _ in text_files(before["root"])})
        if unchanged_but_should:
            fails.append(f"{len(unchanged_but_should)} pages carry a canonical or og:url and "
                         f"did NOT change across the flip, first {unchanged_but_should[0]}")
        else:
            html = sum(1 for c in changed if c.endswith(".html"))
            print(f"  diff shape     {len(changed)} files change ({html} html, "
                  f"{len(changed) - html} other), {len(added)} added: {', '.join(added) or 'none'}")

        if strays:
            fails.append(
                f"{len(strays)} preview-*.html palette samples are back in public/; "
                "they were deleted 19 August and are the usual cause of a failed "
                "staging-host check"
            )

        print()
        if fails:
            for f in fails:
                print(f"FAIL  {f}")
            return 1
        print(f"The flip to {dom} is safe. Do it for real with the steps in LAUNCH-DAY.md.")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
