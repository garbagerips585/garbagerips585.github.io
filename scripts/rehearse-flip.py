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
failure ambiguous), flips LIVE, runs the real build, and then checks the things
that only go wrong at flip time. Exit 0 means the flip is safe to do for real.

WHY IT READS FROM `git archive HEAD` AND NOT FROM public/. The working tree is
frequently mid-edit here, and a build failure in a copy of a half-written tree
tells you nothing about whether the FLIP works. Committed state is the only
state worth rehearsing.
"""

import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent


def run(cmd, cwd, **kw):
    return subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), **kw)


# BOTH OF THESE ARE READ INSIDE main() AND MUST BE DEFINED ABOVE IT. They sat
# below it and resolved only because a module global is looked up at call time,
# so importing this file -- or moving sys.exit(main()) up by one line -- raised
# NameError AFTER a full 65-builder build had already run.
host_staging = "github.io"

# Everything that is not text. The staging-host scan reads every other file in
# the deploy root, which is the point: it used to allow-list four suffixes and
# never opened the 29 .js/.css/.svg/.webmanifest files the site actually ships.
BINARY_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3", ".pdf", ".zip", ".gz",
}


def main() -> int:
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="flip-rehearsal-"))
    try:
        # HEAD, not the working tree. See the module docstring.
        archive = subprocess.run(
            ["git", "archive", "HEAD"], cwd=REPO, capture_output=True, check=True
        ).stdout
        subprocess.run(["tar", "-x", "-C", str(tmp)], input=archive, check=True)

        site = tmp / "shared/site.mjs"
        text = site.read_text()
        if "export const LIVE = true;" in text:
            print("LIVE is already true at HEAD. Nothing to rehearse; this IS the flip.")
            return 0
        if "export const LIVE = false;" not in text:
            print("FAIL  shared/site.mjs no longer declares LIVE the way this script expects.")
            return 1
        site.write_text(text.replace("export const LIVE = false;", "export const LIVE = true;"))

        domain = re.search(r'export const DOMAIN = "([^"]+)"', text)
        if not domain:
            print("FAIL  cannot read DOMAIN out of shared/site.mjs")
            return 1
        dom = domain.group(1)
        host = dom.split("//", 1)[1]
        print(f"rehearsing the flip to {dom}\n")

        # The samples are deleted from the real tree; if any come back, they are
        # the thing most likely to fail the github.io proof below, so say so
        # rather than quietly deleting them here.
        strays = sorted((tmp / "public").glob("preview-*.html"))

        log = tmp / "build.log"
        with log.open("w") as fh:
            build = run(["node", "scripts/build-all.mjs"], tmp, stdout=fh, stderr=subprocess.STDOUT)
        # EXIT CODE ONLY. Grepping build output for "error" has produced false
        # greens in this repo more than once.
        if build.returncode != 0:
            print(f"FAIL  build-all exited {build.returncode}. Log:\n")
            print(log.read_text()[-4000:])
            return 1
        built = re.findall(r"(\d+) of (\d+) builders ok", log.read_text())
        if built:
            ok, total = built[-1]
            print(f"  build-all      exit 0, {ok} of {total} builders")
        else:
            print("  build-all      exit 0")

        check = run(["python3", "scripts/check-build.py"], tmp, capture_output=True)
        if check.returncode != 0:
            print(f"FAIL  check-build exited {check.returncode}")
            print(check.stdout.decode(errors="ignore")[-3000:])
            return 1
        print("  check-build    exit 0")

        root = tmp / "public"
        fails = []

        cname = root / "CNAME"
        if not cname.is_file():
            fails.append("public/CNAME was not written")
        elif cname.read_text().strip() != host:
            fails.append(f"public/CNAME says {cname.read_text().strip()!r}, expected {host!r}")
        else:
            print(f"  CNAME          {host}")

        robots = (root / "robots.txt").read_text()
        if "Allow: /" not in robots or "Disallow: /" in robots:
            fails.append("robots.txt did not open up")
        elif f"{dom}/sitemap.xml" not in robots:
            fails.append("robots.txt is open but names no sitemap, or names the wrong one")
        else:
            print("  robots.txt     open, sitemap named")

        locs = re.findall(r"<loc>(.*?)</loc>", (root / "sitemap.xml").read_text())
        off = [u for u in locs if not u.startswith(dom)]
        if off:
            fails.append(f"{len(off)} sitemap urls are not on {dom}, first {off[0]}")

        def path_of(u):
            return u[len(dom):] or "/"

        def file_for(p):
            return root / (p.lstrip("/") + ("index.html" if p.endswith("/") else ""))

        missing = [u for u in locs if not file_for(path_of(u)).is_file()]
        if missing:
            fails.append(f"{len(missing)} sitemap urls resolve to no file, first {missing[0]}")
        if not off and not missing:
            print(f"  sitemap        {len(locs)} urls, all on {host}, all resolving")

        # The rest are the checks that only ONE of the three earlier rehearsals
        # ran. They are cheap and they are exactly the failures that survive a
        # green build.
        sm_paths = {path_of(u) for u in locs}
        leaks, mismatched, staging = [], [], []
        og_bad, noindex_now, missing_from_sitemap = [], [], []
        for f in root.rglob("*"):
            if not f.is_file():
                continue
            # EVERY SHIPPED TEXT FILE, NOT FOUR SUFFIXES. This used to skip
            # .js, .css, .svg and .webmanifest -- 29 files in the deploy root it
            # never opened. They are clean today, but the day somebody writes the
            # host into app.js this script goes green and the site is wrong.
            if f.suffix.lower() in BINARY_SUFFIXES:
                continue
            t = f.read_text(errors="ignore")
            if host_staging in t:
                staging.append(str(f.relative_to(tmp)))
            if f.suffix != ".html":
                continue
            rel = "/" + str(f.relative_to(root))
            if rel.endswith("/index.html"):
                rel = rel[: -len("index.html")]
            if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', t, re.I) and rel in sm_paths:
                leaks.append(rel)
            m = re.search(r'<link rel="canonical" href="([^"]+)"', t)
            if m and path_of(m.group(1)) != rel:
                mismatched.append((rel, path_of(m.group(1))))
            # og:url IS WHAT EVERY SOCIAL PREVIEW READS and it was never checked.
            # A canonical on the new domain beside an og:url on the old one is
            # exactly the shape this script exists to catch, and it passed.
            og = re.search(r'<meta[^>]+property=["\']og:url["\'][^>]+content=["\']([^"\']+)', t)
            if og and path_of(og.group(1)) != rel:
                og_bad.append((rel, path_of(og.group(1))))
            # A noindex page that QUIETLY STOPS BEING NOINDEX passes the leak
            # check below, because that check only asks whether a noindex page is
            # in the sitemap. Count them so the before/after can be compared.
            if re.search(r'<meta[^>]+name=["\']robots["\'][^>]+noindex', t, re.I):
                noindex_now.append(rel)
            if rel not in sm_paths and not re.search(
                r'<meta[^>]+name=["\']robots["\'][^>]+noindex', t, re.I
            ) and rel != "/404.html":
                missing_from_sitemap.append(rel)

        if staging:
            fails.append(f"{len(staging)} files still name the staging host, first {staging[0]}")
        else:
            print("  staging host   gone from every generated file")
        if leaks:
            fails.append(f"{len(leaks)} noindex pages are in the sitemap, first {leaks[0]}")
        else:
            print("  noindex        none of them leak into the sitemap")
        if mismatched:
            fails.append(
                f"{len(mismatched)} canonicals disagree with their own path, "
                f"first {mismatched[0][0]} -> {mismatched[0][1]}"
            )
        else:
            print("  canonicals     every one matches its own path")
        if og_bad:
            fails.append(
                f"{len(og_bad)} og:url values disagree with their own path, "
                f"first {og_bad[0][0]} -> {og_bad[0][1]}"
            )
        else:
            print("  og:url         every one matches its own path")
        # THE SITEMAP WAS ONLY EVER CHECKED IN ONE DIRECTION -- every loc resolves
        # to a file -- so a builder that silently stopped EMITTING rows passed.
        if missing_from_sitemap:
            fails.append(
                f"{len(missing_from_sitemap)} indexable pages are not in the sitemap, "
                f"first {missing_from_sitemap[0]}"
            )
        else:
            print(f"  sitemap both   every indexable page is in it ({len(locs)})")
        print(f"  noindex kept   {len(noindex_now)} pages carry it after the flip")

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
        print(f"The flip to {dom} is safe. Do it for real with the steps in DEPLOY.md.")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)



if __name__ == "__main__":
    sys.exit(main())
