#!/usr/bin/env python3
"""Mirror the companion-subset card scans locally, small enough to put on a page.

    python3 scripts/sync-subset-scans.py            fetch anything not held yet
    python3 scripts/sync-subset-scans.py --force    refetch and re-encode all
    python3 scripts/sync-subset-scans.py --only swsh12tg
                                                    only scan bases containing that text

WHY THIS EXISTS, 2 October 2026. The Shiny Vault, the Galarian Gallery and the
Classic Collection were priced that day on the owner's ask, and that put their
cards into the hero's three, the chase grid and the pop-up on /sets/shining-fates
.html and /sets/crown-zenith.html. TCGdex has no scan for any of them. The only
host that does is images.pokemontcg.io, and it serves a 245x342 PNG of about
183KB (Charizard VMAX SV107: 183,442 bytes) and a 734x1024 "_hires" PNG of about
1.2MB (the same card: 1,185,000 bytes) and nothing in between. So the hero's
three alone were 550KB of PNG in the first screen, and one tap on a card in the
pop-up was 1.2MB on a phone. A TCGdex card on every other guide is a 16KB AVIF.

So this fetches each scan once and writes, under public/assets/subset/:
    <key>.avif / <key>.webp        245px wide, for the fan, the grid and lists
    <key>-lg.avif                  600px wide, for the pop-up, AVIF ONLY
Same encoder settings as build-packs.py (AVIF q60, WebP q78) for the small
pair, which that file measured as smaller AND closer to the master than the
WebP alone.

THE 600px RENDITION IS AVIF ONLY, AT q50, AND THAT WAS MEASURED. First run, both
formats at 600px: 192 cards, median 72.6KB AVIF and 79.7KB WebP, 30MB on disk
for a picture that only loads when somebody taps a card. AVIF alone at q50 is
the pop-up's <source>; a browser without AVIF falls back to the remote 1.2MB
PNG, which is what every browser got before, and only on a tap.

THE LIST IS DERIVED, NOT PINNED: the rows build-set-pages.mjs reads for a
companion subset (public/data/printings/*.json, English rows whose set is a
companion's `corpusSet`) that carry a `gp` scan base, minus data/no-scan.json.
data/subset-scans.json maps each `gp` base to its local files and their real
decoded size; the builder uses a local file only where the manifest has one, so
a card this has not fetched keeps the remote PNG rather than a broken picture.

NOT IN build-all.mjs, same arrangement and same reason as sync-card-thumbs.mjs:
it makes network requests, and CI must build the same tree from committed files.

THE HIT-ONLY SUBSETS, 11 November 2026. /hall.html shows a plaque for every card
the channel has pulled, and one of them, Corviknight V TG18, is in the Silver
Tempest Trainer Gallery, which is not a companion subset any set guide prints.
TCGdex has no scan for it either, so its plaque hotlinked the same 171KB PNG
into a box about 101px wide. build-hall.mjs already takes the local pair for
any scan base this manifest holds (that is how Paras GG32 got one), so the only
thing missing was the file. HIT_ONLY names the subsets mirrored for that reason,
and for those ONLY the cards data/hits.json logs are fetched: one card and two
requests today, not the Trainer Gallery's 30. A new Trainer Gallery pull is
picked up by the next run with no edit here.

ONE REQUEST A SECOND. It was four; images.pokemontcg.io is somebody else's free
host and nothing about this job is in a hurry.

THE CACHE CAN BE MOVED with GR_SUBSET_CACHE, so a run from a second checkout
does not write into the first one's .cache through a symlink.
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets/subset"
CACHE = Path(os.environ.get("GR_SUBSET_CACHE") or ROOT / ".cache/subset-scans")
MANIFEST = ROOT / "data/subset-scans.json"
FORCE = "--force" in sys.argv
ONLY = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv[:-1] else None
# Corpus set name -> the guide set its cards are logged under in data/hits.json.
# See "THE HIT-ONLY SUBSETS" in the docstring.
HIT_ONLY = {"Silver Tempest Trainer Gallery": "silver-tempest"}
SMALL_W, LARGE_W = 245, 600
AVIF_Q, WEBP_Q = 60, 78


def corpus_rows():
    comps = json.loads((ROOT / "data/companion-sets.json").read_text())
    want = {c["corpusSet"] for c in (comps.get("sets") or {}).values() if isinstance(c, dict) and c.get("corpusSet")}
    no_scan = set((json.loads((ROOT / "data/no-scan.json").read_text()).get("bases") or {}))
    # (guide set id, collector number) for every logged pull, so a hit-only
    # subset contributes the cards the channel actually pulled and no others.
    hits = json.loads((ROOT / "data/hits.json").read_text()).get("videos") or {}
    pulled = {(h.get("set"), str(h.get("number") or "").upper()) for hs in hits.values() for h in hs}
    rows = []
    for f in sorted((ROOT / "public/data/printings").glob("*.json")):
        if not re.fullmatch(r"[a-z0-9]\.json", f.name):
            continue
        for c in json.loads(f.read_text()):
            if c.get("l") != "en" or not c.get("gp") or c["gp"] in no_scan:
                continue
            if ONLY and ONLY not in c["gp"]:
                continue
            if c.get("s") in want:
                rows.append(c)
            elif c.get("s") in HIT_ONLY and (HIT_ONLY[c["s"]], str(c.get("i") or "").upper()) in pulled:
                rows.append(c)
    return rows


def fetch(url, dest):
    if dest.exists() and not FORCE:
        return dest.read_bytes()
    req = urllib.request.Request(url, headers={"User-Agent": "garbagerips.com subset scan mirror"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    time.sleep(1.0)
    return data


def encode(img, width, stem, webp=True, avif_q=AVIF_Q):
    im = img.convert("RGBA") if img.mode in ("P", "LA") else img
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT / f"{stem}.avif", "AVIF", quality=avif_q)
    if webp:
        im.save(OUT / f"{stem}.webp", "WEBP", quality=WEBP_Q, method=6)
    return im.width, im.height


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    if MANIFEST.exists() and not FORCE:
        manifest = {k: v for k, v in json.loads(MANIFEST.read_text()).get("scans", {}).items()}
    rows = corpus_rows()
    done = 0
    for c in rows:
        gp = c["gp"]
        if gp in manifest and (OUT / Path(manifest[gp]["src"]).name).exists() and not FORCE:
            continue
        key = re.sub(r"[^a-z0-9]+", "-", gp.split("images.pokemontcg.io/")[-1].lower()).strip("-")
        try:
            small = Image.open(io.BytesIO(fetch(f"{gp}.png", CACHE / f"{key}.png")))
            large = Image.open(io.BytesIO(fetch(f"{gp}_hires.png", CACHE / f"{key}_hires.png")))
        except Exception as e:  # a scan that will not fetch keeps its remote url
            print(f"  skip {gp}: {e}")
            continue
        w, h = encode(small, SMALL_W, key)
        lw, lh = encode(large, LARGE_W, f"{key}-lg", webp=False, avif_q=50)
        manifest[gp] = {"src": f"/assets/subset/{key}.webp", "w": w, "h": h,
                        "large": f"/assets/subset/{key}-lg.avif", "lw": lw, "lh": lh}
        done += 1
    MANIFEST.write_text(json.dumps({
        "_readme": [
            "Written by scripts/sync-subset-scans.py; read by build-set-pages.mjs",
            "and build-hall.mjs.",
            "Maps a companion-subset card's images.pokemontcg.io scan base (`gp` in",
            "public/data/printings) to locally encoded renditions under",
            "public/assets/subset/: `src` 245w (.webp with an .avif sibling) and",
            "`large` 600w (.avif only). See the script's docstring for why.",
        ],
        "checked": time.strftime("%Y-%m-%d"),
        "scans": dict(sorted(manifest.items())),
    }, indent=2, ensure_ascii=False) + "\n")
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"subset scans: {len(rows)} rows, {done} encoded this run, {len(manifest)} in manifest, "
          f"{total / 1024 / 1024:.1f}MB on disk in public/assets/subset/")


if __name__ == "__main__":
    main()
