#!/usr/bin/env python3
"""Zip codes and town names to coordinates, for "near me" on /card-shows.html.

    python3 scripts/sync-places.py

WHY IT EXISTS, 8 October 2026. The owner asked for "easy ways to sort and search
for shows near you". Every show already sits in a town with a lat/lon in
data/shows.json's `_towns`, so the distance half was free. The other half is
knowing where the READER is without asking a third party: a typed zip code or
town name has to become a point, in the browser, with no API key and no request
leaving this site. This writes the small table that does it.

SOURCE: the US Census Bureau's 2024 Gazetteer files, public domain as works of
the US government. Download these three into .cache/census/ (gitignored) first;
this script makes no network request of its own, the same arrangement as
sync-decks.mjs and the other sync scripts that are NOT in build-all.mjs:

    https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip
        (unzip it: 2024_Gaz_zcta_national.txt)
    .../2024_Gazetteer/2024_gaz_place_36.txt     NY cities, villages and CDPs
    .../2024_Gazetteer/2024_gaz_cousubs_36.txt   NY towns

WHAT IS KEPT: every zip and every NY place or town whose internal point is within
RADIUS_MI of one of the calendar's three anchors (Rochester, NY, Buffalo,
Syracuse), at two decimal places, about 0.7 miles, which is finer than the
town-centre precision of the shows themselves. A zip outside the circle is not a
failure: the page says it has no record of it and offers the town box or the
location button instead.

WHAT IT WRITES: public/data/places.json, {"z": {zip: [lat, lon]}, "t": {name:
[lat, lon]}}. Town names are lower case with " city", " village", " town" and
" CDP" dropped, because that is how a person types them. Where a town and a
village share a name (Pittsford, Brockport) the first one read wins; they are
the same few miles of map. The page fetches this file only when somebody
focuses the search box, so a reader who never uses it pays nothing.
"""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/census"
OUT = ROOT / "public/data/places.json"
ANCHORS = [(43.1566, -77.6088), (42.8864, -78.8784), (43.0481, -76.1474)]
RADIUS_MI = 100


def miles(a, b):
    r = 3958.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def near(pt):
    return any(miles(pt, a) <= RADIUS_MI for a in ANCHORS)


def rows(path):
    lines = path.read_text(encoding="latin-1").splitlines()
    head = [h.strip() for h in lines[0].split("\t")]
    for line in lines[1:]:
        cells = [c.strip() for c in line.split("\t")]
        if len(cells) >= len(head):
            yield dict(zip(head, cells))


def main():
    zips, towns = {}, {}
    for r in rows(CACHE / "2024_Gaz_zcta_national.txt"):
        pt = (float(r["INTPTLAT"]), float(r["INTPTLONG"]))
        if near(pt):
            zips[r["GEOID"]] = [round(pt[0], 2), round(pt[1], 2)]
    for f in ("2024_gaz_place_36.txt", "2024_gaz_cousubs_36.txt"):
        for r in rows(CACHE / f):
            pt = (float(r["INTPTLAT"]), float(r["INTPTLONG"]))
            if not near(pt):
                continue
            name = re.sub(r"\s+(city|village|town|CDP)$", "", r["NAME"], flags=re.I).strip().lower()
            if name and name not in towns:
                towns[name] = [round(pt[0], 2), round(pt[1], 2)]
    OUT.write_text(json.dumps({"z": dict(sorted(zips.items())), "t": dict(sorted(towns.items()))},
                              separators=(",", ":")) + "\n")
    print(f"places: {len(zips)} zips, {len(towns)} towns within {RADIUS_MI} mi, "
          f"{OUT.stat().st_size:,} bytes -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
