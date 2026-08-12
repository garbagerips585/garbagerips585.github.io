#!/usr/bin/env python3
"""Build the video log workbook for Google Sheets.

    python3 scripts/build-sheet.py

Writes Garbage-Rips-585-Video-Log.xlsx at the repo root, prefilled from
public/data/videos.json and sets.json. Every column the site actually reads is
here, and every column is either something YouTube already knows (grey, do not
edit) or something only Tim knows (yellow, please fill in).

Where a tag was derived automatically the guess is prefilled, so the job is
correcting rather than typing. scripts/import-sheet.mjs reads the CSV export
back and turns it into data/overrides.json and data/manual.json.

Safe to re-run: it rebuilds from scratch, so run import-sheet.mjs on your
latest export BEFORE rebuilding, or your edits are what gets overwritten.
"""
import json
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "Garbage-Rips-585-Video-Log.xlsx"

videos = json.loads((ROOT / "public/data/videos.json").read_text())
videos = videos.get("videos", videos)
sets = json.loads((ROOT / "public/data/sets.json").read_text())["sets"]
set_name = {s["id"]: s["name"] for s in sets}

# ---------------------------------------------------------------- vocabulary

SET_NAMES = [s["name"] for s in sets] + ["Multiple sets", "Not a set (sealed/other)"]

OPENING_TYPES = [
    "Single Booster Pack", "Booster Bundle", "Booster Box",
    "ETB (Elite Trainer Box)", "SPC (Super Premium Collection)",
    "UPC (Ultra Premium Collection)", "Poke Ball Tin", "Tin",
    "ex Premium Collection", "ex Special Collection", "Collection Box",
    "Blister", "Japanese Booster Pack", "Korean Booster Pack",
    "Chinese Booster Pack", "Other",
]

# Mirrors the ladder the site ranks by, in the same order, so the Hall of Fame
# sorts the way the sheet reads.
RARITIES = [
    "Mega Hyper Rare (big yellow star)",
    "Hyper Rare (3 gold stars)",
    "Special Illustration Rare (2 gold stars)",
    "Illustration Rare (1 gold star)",
    "Ultra Rare (2 silver stars)",
    "Double Rare (2 black stars)",
    "Rare (1 black star)",
    "Charizard (any rarity)",
    "No hit",
]

YESNO = ["Yes", "No"]
PLAYLISTS = ["Greatest Hits", "Hits Only", "Full Box Openings", "Singles",
             "Japanese", "None"]

# Which derived pull tag maps onto which sheet rarity, so the guess is prefilled.
PULL_TO_RARITY = {
    "gold": "Hyper Rare (3 gold stars)",
    "sir": "Special Illustration Rare (2 gold stars)",
    "ir": "Illustration Rare (1 gold star)",
    "double-rare": "Double Rare (2 black stars)",
    "charizard": "Charizard (any rarity)",
}
PULL_ORDER = ["gold", "sir", "ir", "double-rare", "charizard"]

# Box and series names, derived from the titles rather than invented, so the
# dropdown matches what Tim actually films. Only names that begin with a set
# name or "Mega" survive: the rest of a title is clickbait, not a product.
_set_words = tuple(x["name"].lower() for x in sets) + ("mega ",)
BOX_NAMES = set()
for _v in videos:
    _head = re.sub(r"Pack\s*#\d+", "", _v.get("title", "").split("|")[0], flags=re.I)
    _head = re.sub(r"#\d+", "", _head)
    _head = re.sub(r"[^\w\s&'.:-]", "", _head)
    _head = re.sub(r"\s+", " ", _head).strip()
    if 6 < len(_head) < 48 and _head.lower().startswith(_set_words) \
       and re.search(r"box|tin|etb|collection|bundle|upc|blister|premium", _head, re.I):
        BOX_NAMES.add(_head)
BOX_NAMES = sorted(BOX_NAMES)

# Where a graded price came from. Naming the source is what makes the number
# checkable later.
PSA_SOURCES = ["PSA Price Guide", "eBay sold listings", "130point", "TCGplayer",
               "PriceCharting", "Local shop", "Other"]

SHOP_AREAS = ["Rochester, NY", "Greece, NY", "Henrietta, NY", "Irondequoit, NY",
              "Brighton, NY", "Webster, NY", "Pittsford, NY", "Victor, NY",
              "Buffalo, NY", "Syracuse, NY", "Online only"]

SHOP_GOOD_FOR = ["Sealed product", "Singles", "New releases", "In store",
                 "Graded slabs", "Vintage", "Japanese", "Events and tournaments",
                 "Trade ins", "Supplies"]

HOF_RANKS = [str(i) for i in range(1, 21)]

# Every chase card we know about, so Hit Card is a pick rather than a spelling
# test. Not exhaustive on purpose: the validation is a suggestion, not a rule.
HIT_CARDS = sorted({c["name"] for st in sets for c in (st.get("chase") or [])})

# Every product id shared/taxonomy.mjs can assign, mapped to the sheet's own
# wording. Eight were missing, so a video already tagged booster-box or
# poke-ball-tin came up with a BLANK Opening Type instead of a prefilled guess,
# and the whole correct-the-guess workflow silently skipped box openings.
PRODUCT_TO_OPENING = {
    "single-pack": "Single Booster Pack",
    "bundle": "Booster Bundle",
    "booster-box": "Booster Box",
    "etb": "ETB (Elite Trainer Box)",
    "spc": "SPC (Super Premium Collection)",
    "upc": "UPC (Ultra Premium Collection)",
    "poke-ball-tin": "Poke Ball Tin",
    "tin": "Tin",
    "ex-premium": "ex Premium Collection",
    "ex-special": "ex Special Collection",
    "ex-box": "ex Premium Collection",
    "collection-box": "Collection Box",
    "blister": "Blister",
    "japanese-pack": "Japanese Booster Pack",
    "korean-pack": "Korean Booster Pack",
    "chinese-pack": "Chinese Booster Pack",
}

# Standard pack counts per product, prefilled in blue as a guess to be
# confirmed. These are the usual contents, not a guarantee: pack counts change
# between eras and between regions, and a "tin" is anything from 3 to 5. The
# ones that genuinely vary are left blank rather than guessed, because a wrong
# denominator is worse on the luck page than a missing one.
PRODUCT_TO_PACKS = {
    "single-pack": 1,
    "japanese-pack": 1,
    "korean-pack": 1,
    "chinese-pack": 1,
    "blister": 3,
    "bundle": 6,
    "etb": 9,
    "booster-box": 36,
    "upc": 16,
    "spc": 8,
}

# ------------------------------------------------------------------- styling

BODY = Font(name="Arial", size=10)
BOLD = Font(name="Arial", size=10, bold=True)
TITLE = Font(name="Arial", size=14, bold=True)
NOTE = Font(name="Arial", size=10, italic=True, color="555555")
LOCKED_TXT = Font(name="Arial", size=10, color="666666")
GUESS_TXT = Font(name="Arial", size=10, color="0000FF")   # auto-filled, confirm

HEAD_LOCKED = PatternFill("solid", fgColor="D9D9D9")   # from YouTube
HEAD_INPUT = PatternFill("solid", fgColor="FFF2CC")    # yours to fill
HEAD_HOF = PatternFill("solid", fgColor="FFD966")      # the Hall of Fame block
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

wb = Workbook()

# =========================================================== 1. Read Me =====

ws = wb.active
ws.title = "Read Me"
ws.column_dimensions["A"].width = 26
ws.column_dimensions["B"].width = 104

rows = [
    ("Garbage Rips 585 master sheet", None, TITLE),
    (None, None, None),
    ("What this is", "The control surface for garbagerips585.com. Everything the site knows that "
                     "cannot be worked out from YouTube or the card database lives here. Fill in "
                     "what you know, export, import, and the site changes.", None),
    (None, None, None),
    ("Grey columns", "From YouTube or the card database. Do not edit. Video ID and Key are what "
                     "link a row to its video or card, so never edit those and never sort in a way "
                     "that separates a row from them.", None),
    ("Yellow columns", "Yours. Blank is fine everywhere: the import skips anything unanswered, so "
                       "twenty rows at a time is a perfectly good way to work.", None),
    ("Gold columns", "Hall of Fame and Most Wanted, the two things that change the top of the "
                     "home page.", None),
    ("Blue text", "A guess the site already made. Correct it if it is wrong, leave it if it is "
                  "right. Black text means a person typed it.", None),
    ("Dropdowns", "Most columns have one. Some are strict and only accept what is listed. Others "
                  "(Box / Series, Hit Card, PSA 10 Source, shop Area and Good For) offer a list "
                  "but still accept anything typed, because those lists can never be complete.", None),
    (None, None, None),
    ("THE TABS", None, BOLD),
    ("Video Log", "Every video. Sets, opening type, the hit, the Hall of Fame, and per-video copy "
                  "for the site.", None),
    ("Set Notes", "The two facts the card database does not carry: whether a set is still in "
                  "print, and what a pack costs. Set guides omit both until filled in.", None),
    ("Chase Cards", "Every chase card on the site. PSA 10 prices live ONLY here: nothing can fetch "
                    "a graded price, so this tab is the only route onto the site. Most Wanted "
                    "marks a card for the hunt page and the home page band.", None),
    ("Shops", "Local card shops for /shops.html.", None),
    ("Summary", "Live counts of how much is filled in.", None),
    ("Lists", "The source of every dropdown. Add a row here to add an option.", None),
    (None, None, None),
    ("HOW TO IMPORT", "Google Sheets exports the ACTIVE tab only, so open the tab you want first, "
                      "then File > Download > Comma-separated values.", BOLD),
    ("Video Log", "node scripts/import-sheet.mjs <csv>", None),
    ("Chase Cards", "node scripts/import-cards.mjs <csv>", None),
    ("Shops", "node scripts/import-cards.mjs <csv>", None),
    (None, "Either importer works out which tab it is from the header row, so the filename does "
           "not matter.", None),
    (None, None, None),
    ("The one that matters most", "Set. 61 videos have no set tag. A video with no set cannot be "
                                  "filtered and cannot reach the Hall of Fame. Eight of those are "
                                  "graded hits locked out of the home page right now.", None),
    (None, None, None),
    ("Packs from several sets", "A tin with two packs, or a box with ten packs from four sets, "
                                "belongs to every set it contains. Put the set the video is really "
                                "about in Set and the rest in Set 2 to Set 4. The rip then appears "
                                "under every one of those sets. More than four is rare: type the "
                                "extras into More Sets, separated by commas.", None),
    (None, None, None),
    ("Greatest Hits", "Mark Yes on the RIPS you want in the gold section at the top of the home "
                      "page. Rank orders them, 1 first. Leave Rank blank and the site orders by "
                      "rarity then views. These are videos.", None),
    (None, None, None),
    ("Card Hall of Fame", "On the Chase Cards tab. Mark Yes on the CARDS you have actually pulled. "
                          "They get their own page, ranked by value, with the card image, the set, "
                          "the raw near mint price and the PSA 10 price. These are cards, not "
                          "videos, which is the whole difference between the two.", None),
    (None, None, None),
    ("PSA 10 prices", "Put in a number you have actually seen, set PSA 10 Checked to the date you "
                      "checked it (2026-08-11 format), and name the source. A graded price with no "
                      "date is not a fact about anything, and a blank shows nothing rather than a "
                      "guess.", None),
    (None, None, None),
    ("Careful", "Rebuilding this file overwrites it. Import your latest export FIRST, then rebuild. "
                "Anything already imported is carried back in; anything not is lost.", NOTE),
]
for i, (a, b, font) in enumerate(rows, start=1):
    if a is not None:
        ws.cell(i, 1, a).font = font or BOLD
    if b is not None:
        c = ws.cell(i, 2, b)
        c.font = font or BODY
        c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[i].height = 30 if b and len(str(b)) > 95 else None

# ============================================================= 2. Lists =====

wl = wb.create_sheet("Lists")
for col, (head, items) in enumerate(
    [("Sets", SET_NAMES), ("Opening Types", OPENING_TYPES), ("Hit Rarities", RARITIES),
     ("Yes/No", YESNO), ("Playlists", PLAYLISTS), ("Box / Series", BOX_NAMES or ["(none yet)"]),
     ("Hit Cards", HIT_CARDS or ["(none yet)"]), ("PSA 10 Sources", PSA_SOURCES),
     ("Shop Areas", SHOP_AREAS), ("Shop Good For", SHOP_GOOD_FOR), ("HoF Ranks", HOF_RANKS)],
    start=1,
):
    ws_c = get_column_letter(col)
    wl.column_dimensions[ws_c].width = max(18, len(head) + 4, max(len(i) for i in items) + 2)
    wl.cell(1, col, head).font = BOLD
    for r, item in enumerate(items, start=2):
        wl.cell(r, col, item).font = BODY

def named(col_idx, count):
    """Absolute range on Lists for a dropdown source."""
    c = get_column_letter(col_idx)
    return f"=Lists!${c}$2:${c}${count + 1}"

DV_SET = named(1, len(SET_NAMES))
DV_OPEN = named(2, len(OPENING_TYPES))
DV_RARITY = named(3, len(RARITIES))
DV_YESNO = named(4, len(YESNO))
DV_PLAYLIST = named(5, len(PLAYLISTS))
DV_BOX = named(6, len(BOX_NAMES) or 1)
DV_HITCARD = named(7, len(HIT_CARDS) or 1)
DV_PSASRC = named(8, len(PSA_SOURCES))
DV_AREA = named(9, len(SHOP_AREAS))
DV_GOODFOR = named(10, len(SHOP_GOOD_FOR))
DV_RANK = named(11, len(HOF_RANKS))


def dv(formula, strict=True):
    """A dropdown. strict=False offers the list but still accepts anything
    typed, which is what you want for a column like Hit Card where the list is
    a convenience and cannot possibly be complete."""
    return DataValidation(type="list", formula1=formula, allow_blank=True,
                          showDropDown=False, showErrorMessage=strict)

# ========================================================= 3. Video Log =====

wv = wb.create_sheet("Video Log")

COLUMNS = [
    # (header, width, kind)  kind: locked | input | hof
    ("Video ID", 14, "locked"),
    ("Title", 52, "locked"),
    ("Published", 12, "locked"),
    ("Views", 9, "locked"),
    ("Length", 8, "locked"),
    ("Watch", 8, "locked"),
    ("Set", 26, "input"),
    ("Set 2", 26, "input"),
    ("Set 3", 26, "input"),
    ("Set 4", 26, "input"),
    ("More Sets", 30, "input"),
    ("Box / Series", 30, "input"),
    ("Opening Type", 28, "input"),
    # Packs Opened is what makes the luck page rigorous. Without it a rate can
    # only be "per video", which silently treats a 36-pack booster box and a
    # single pack as one trial each. With it the rate is per PACK, which is the
    # number anyone actually means by "how often do you hit".
    ("Packs Opened", 13, "input"),
    ("Has Hit", 9, "input"),
    ("Hit Card", 30, "input"),
    ("Hit Rarity", 34, "input"),
    ("Greatest Hits", 14, "hof"),
    ("Greatest Hits Rank", 18, "hof"),
    ("Playlist To Add", 18, "input"),
    ("Affiliate Link", 30, "input"),
    ("Site Title", 40, "input"),
    ("Short Description", 46, "input"),
    ("Feature", 9, "input"),
    ("Hide", 8, "input"),
    ("Notes", 34, "input"),
]

FILL = {"locked": HEAD_LOCKED, "input": HEAD_INPUT, "hof": HEAD_HOF}
for i, (head, width, kind) in enumerate(COLUMNS, start=1):
    c = wv.cell(1, i, head)
    c.font = BOLD
    c.fill = FILL[kind]
    c.border = BOX
    c.alignment = Alignment(vertical="center", wrap_text=True)
    wv.column_dimensions[get_column_letter(i)].width = width
wv.freeze_panes = "B2"
wv.row_dimensions[1].height = 30

COL = {head: i for i, (head, _, _) in enumerate(COLUMNS, start=1)}


def clock(sec):
    if not sec:
        return ""
    return f"{sec // 60}:{sec % 60:02d}"

def best_pull(v):
    for p in PULL_ORDER:
        if p in (v.get("pulls") or []):
            return p
    return None

ordered = sorted(videos, key=lambda v: (v.get("published") or ""), reverse=True)

for r, v in enumerate(ordered, start=2):
    vid = v["id"]
    sets_v = v.get("sets") or []
    products = v.get("products") or []
    pull = best_pull(v)

    wv.cell(r, COL["Video ID"], vid).font = LOCKED_TXT
    wv.cell(r, COL["Title"], v.get("title", "")).font = LOCKED_TXT
    wv.cell(r, COL["Published"], v.get("published", "")).font = LOCKED_TXT
    wv.cell(r, COL["Views"], v.get("views", 0)).font = LOCKED_TXT
    wv.cell(r, COL["Length"], clock(v.get("duration"))).font = LOCKED_TXT
    w = wv.cell(r, COL["Watch"], f'=HYPERLINK("https://youtu.be/{vid}","watch")')
    w.font = Font(name="Arial", size=10, color="0563C1", underline="single")

    # Prefilled guesses in blue: correcting beats typing.
    # A video can hold packs from several sets, so spread them across the three
    # columns in order. The first is what the video is really about and picks
    # the wrapper on the site.
    for n, sid in enumerate(sets_v[:4]):
        if sid in set_name:
            wv.cell(r, COL["Set"] + n, set_name[sid]).font = GUESS_TXT
    if products and products[0] in PRODUCT_TO_OPENING:
        wv.cell(r, COL["Opening Type"], PRODUCT_TO_OPENING[products[0]]).font = GUESS_TXT
    if products and products[0] in PRODUCT_TO_PACKS:
        wv.cell(r, COL["Packs Opened"], PRODUCT_TO_PACKS[products[0]]).font = GUESS_TXT
    if pull:
        wv.cell(r, COL["Has Hit"], "Yes").font = GUESS_TXT
        wv.cell(r, COL["Hit Rarity"], PULL_TO_RARITY[pull]).font = GUESS_TXT

    for col in range(1, len(COLUMNS) + 1):
        cell = wv.cell(r, col)
        cell.border = BOX
        if cell.font is None or cell.font.name != "Arial":
            cell.font = BODY
        if col in (4,):
            cell.alignment = Alignment(horizontal="right")

last = len(ordered) + 1
# Look columns up by header rather than by number: three new columns shifted
# everything after Set, and hand-counted indexes are how a dropdown ends up on
# the wrong column without anything appearing to break.
CI = {head: i for i, (head, _, _) in enumerate(COLUMNS, start=1)}
for dv_formula, cols in [
    (DV_SET, [CI["Set"], CI["Set 2"], CI["Set 3"], CI["Set 4"]]),
    (DV_OPEN, [CI["Opening Type"]]),
    (DV_RARITY, [CI["Hit Rarity"]]),
    (DV_YESNO, [CI["Has Hit"], CI["Greatest Hits"], CI["Feature"], CI["Hide"]]),
    (DV_PLAYLIST, [CI["Playlist To Add"]]),
    (DV_RANK, [CI["Greatest Hits Rank"]]),
]:
    d = dv(dv_formula)
    wv.add_data_validation(d)
    for col in cols:
        c = get_column_letter(col)
        d.add(f"{c}2:{c}{last}")

# Suggestion lists: the dropdown helps, but neither list can ever be complete,
# so typing something new must not be rejected.
for dv_formula, head in [(DV_BOX, "Box / Series"), (DV_HITCARD, "Hit Card")]:
    d = dv(dv_formula, strict=False)
    wv.add_data_validation(d)
    c = get_column_letter(CI[head])
    d.add(f"{c}2:{c}{last}")

# =========================================================== 4. Set Notes ===

wn = wb.create_sheet("Set Notes")
NOTE_COLS = [
    ("Set ID", 22, "locked"), ("Set Name", 24, "locked"),
    ("Released", 12, "locked"), ("Cards", 8, "locked"), ("Your rips", 10, "locked"),
    ("Still In Print", 14, "input"),
    # Pack Price USD and Booster Box Price USD used to live here. Removed: the
    # "Ways to open" band on every set page now carries live TCGplayer prices
    # for every sealed product, so a hand-typed price is both duplicated effort
    # and a chance to contradict the live number printed a few inches below it.
    ("Fun Fact 1", 52, "input"), ("Fun Fact 2", 52, "input"),
]
for i, (head, width, kind) in enumerate(NOTE_COLS, start=1):
    c = wn.cell(1, i, head)
    c.font = BOLD; c.fill = FILL[kind]; c.border = BOX
    wn.column_dimensions[get_column_letter(i)].width = width
wn.freeze_panes = "A2"

rip_counts = {}
for v in videos:
    for s in v.get("sets") or []:
        rip_counts[s] = rip_counts.get(s, 0) + 1

for r, s in enumerate(sorted(sets, key=lambda s: s.get("released") or "", reverse=True), start=2):
    wn.cell(r, 1, s["id"]).font = LOCKED_TXT
    wn.cell(r, 2, s["name"]).font = LOCKED_TXT
    wn.cell(r, 3, s.get("released") or "").font = LOCKED_TXT
    wn.cell(r, 4, s.get("total") or s.get("printedTotal") or "").font = LOCKED_TXT
    wn.cell(r, 5, rip_counts.get(s["id"], 0)).font = LOCKED_TXT
    for col in range(1, len(NOTE_COLS) + 1):
        wn.cell(r, col).border = BOX
        if wn.cell(r, col).font.name != "Arial":
            wn.cell(r, col).font = BODY

dv_print = dv(DV_YESNO)
wn.add_data_validation(dv_print)
dv_print.add(f"F2:F{len(sets) + 1}")

wn.cell(len(sets) + 3, 1, "These two facts are not in the card database and are not guessed. "
                          "The set guides omit them until you fill them in.").font = NOTE

# ============================================================= 5. Summary ===

wsum = wb.create_sheet("Summary")
wsum.column_dimensions["A"].width = 34
wsum.column_dimensions["B"].width = 14
wsum.cell(1, 1, "Progress").font = TITLE

L = "'Video Log'"
def CL(head):
    return get_column_letter(COL[head])
metrics = [
    ("Videos in the log", f'=COUNTA({L}!{CL("Video ID")}2:{CL("Video ID")}{last})'),
    ("Set filled in", f'=COUNTA({L}!{CL("Set")}2:{CL("Set")}{last})'),
    ("Still missing a set",
     f'=COUNTA({L}!{CL("Video ID")}2:{CL("Video ID")}{last})-COUNTA({L}!{CL("Set")}2:{CL("Set")}{last})'),
    ("Videos with 2+ sets", f'=COUNTA({L}!{CL("Set 2")}2:{CL("Set 2")}{last})'),
    ("Videos with 4 sets", f'=COUNTA({L}!{CL("Set 4")}2:{CL("Set 4")}{last})'),
    ("Opening type filled in", f'=COUNTA({L}!{CL("Opening Type")}2:{CL("Opening Type")}{last})'),
    ("Marked as a hit", f'=COUNTIF({L}!{CL("Has Hit")}2:{CL("Has Hit")}{last},"Yes")'),
    ("Hit card named", f'=COUNTA({L}!{CL("Hit Card")}2:{CL("Hit Card")}{last})'),
    ("In Greatest Hits", f'=COUNTIF({L}!{CL("Greatest Hits")}2:{CL("Greatest Hits")}{last},"Yes")'),
    ("Given a rank", f'=COUNTA({L}!{CL("Greatest Hits Rank")}2:{CL("Greatest Hits Rank")}{last})'),
    ("Affiliate links added", f'=COUNTA({L}!{CL("Affiliate Link")}2:{CL("Affiliate Link")}{last})'),
    ("Hidden from the site", f'=COUNTIF({L}!{CL("Hide")}2:{CL("Hide")}{last},"Yes")'),
]
for i, (label, formula) in enumerate(metrics, start=3):
    wsum.cell(i, 1, label).font = BODY
    c = wsum.cell(i, 2, formula)
    c.font = BOLD
    c.alignment = Alignment(horizontal="right")

wsum.cell(len(metrics) + 5, 1,
          "Counts update as you type. Blank cells are skipped by the import, "
          "so a half-filled sheet is fine.").font = NOTE

# ========================================================== 6. Chase Cards ===
#
# Every chase card the set guides show, plus anything on the hunt list. This is
# where PSA 10 prices come from: nothing can fetch them, so this tab is the only
# way they ever reach the site.

wanted_src = {}
try:
    _w = json.loads((ROOT / "data/wanted.json").read_text())
    for c in _w.get("cards", []):
        wanted_src[f"{c['set']}-{c['number']}"] = c
except Exception:
    pass

psa_src = {}
try:
    psa_src = json.loads((ROOT / "data/psa10.json").read_text()).get("prices", {})
except Exception:
    pass

wc = wb.create_sheet("Chase Cards")
CHASE_COLS = [
    ("Key", 22, "locked"), ("Set", 22, "locked"), ("Card", 30, "locked"),
    ("Number", 9, "locked"), ("Rarity", 30, "locked"), ("Raw USD", 11, "locked"),
    ("PSA 10 USD", 13, "input"), ("PSA 10 Checked", 15, "input"),
    ("PSA 10 Source", 24, "input"),
    ("Most Wanted", 13, "hof"), ("Card Hall of Fame", 18, "hof"),
    ("Pulled On", 12, "input"), ("Pulled In Video", 30, "input"),
    ("Why I Want It", 44, "input"),
]
for i, (head, width, kind) in enumerate(CHASE_COLS, start=1):
    c = wc.cell(1, i, head)
    c.font = BOLD; c.fill = FILL[kind]; c.border = BOX
    c.alignment = Alignment(vertical="center", wrap_text=True)
    wc.column_dimensions[get_column_letter(i)].width = width
wc.freeze_panes = "C2"
wc.row_dimensions[1].height = 30

rows_out = []
seen_keys = set()
for st in sorted(sets, key=lambda x: x.get("released") or "", reverse=True):
    for c in (st.get("chase") or []):
        key = f"{st['id']}-{c['number']}"
        seen_keys.add(key)
        rows_out.append((key, st["name"], c["name"], c["number"], c.get("rarity") or "", c.get("price") or None))
# hunt-list cards from sets too new to have chase data yet
for key, w in wanted_src.items():
    if key in seen_keys:
        continue
    st = next((x for x in sets if x["id"] == w["set"]), None)
    rows_out.append((key, st["name"] if st else w["set"], w["name"], w["number"], w.get("rarity") or "", None))

for r, (key, sname, cname, num, rar, raw) in enumerate(rows_out, start=2):
    wc.cell(r, 1, key).font = LOCKED_TXT
    wc.cell(r, 2, sname).font = LOCKED_TXT
    wc.cell(r, 3, cname).font = LOCKED_TXT
    wc.cell(r, 4, num).font = LOCKED_TXT
    wc.cell(r, 5, rar).font = LOCKED_TXT
    cell = wc.cell(r, 6, raw if raw else "")
    cell.font = LOCKED_TXT
    if raw:
        cell.number_format = '$#,##0.00'
    # carry anything already recorded, so re-running never loses a typed price
    prev = psa_src.get(key)
    if isinstance(prev, dict):
        wc.cell(r, 7, prev.get("price")).font = BODY
        wc.cell(r, 8, prev.get("asOf") or "").font = BODY
        wc.cell(r, 9, prev.get("source") or "").font = BODY
    elif isinstance(prev, (int, float)):
        wc.cell(r, 7, prev).font = BODY
    w = wanted_src.get(key)
    if w:
        wc.cell(r, 10, "Yes").font = GUESS_TXT
        wc.cell(r, 11, "Yes" if w.get("got") else "No").font = GUESS_TXT
        if w.get("note"):
            wc.cell(r, 14, w["note"]).font = GUESS_TXT
    for col in range(1, len(CHASE_COLS) + 1):
        wc.cell(r, col).border = BOX
        if wc.cell(r, col).font.name != "Arial":
            wc.cell(r, col).font = BODY
    wc.cell(r, 7).number_format = '$#,##0.00'

dv_c = dv(DV_YESNO)
wc.add_data_validation(dv_c)
dv_c.add(f"J2:J{len(rows_out) + 1}")   # Most Wanted
dv_c.add(f"K2:K{len(rows_out) + 1}")   # Card Hall of Fame
dv_src = dv(DV_PSASRC, strict=False)
wc.add_data_validation(dv_src)
dv_src.add(f"I2:I{len(rows_out) + 1}")

wc.cell(len(rows_out) + 3, 1,
        "Most Wanted is a card you are still chasing. Card Hall of Fame is one you have actually "
        "pulled, and it appears on /hall.html ranked by value, PSA 10 first and raw where there is "
        "no graded price. A card can be both while you chase a second copy. "
        "Key is what links a row back to a card and must not be edited. PSA 10 Checked is a date "
        "like 2026-08-11: a graded price with no date is not a fact about anything.").font = NOTE

# ================================================================ 7. Shops ===

wsh = wb.create_sheet("Shops")
SHOP_COLS = [("Name", 26, "input"), ("Website", 46, "input"), ("Area", 20, "input"),
             ("What They Are Good For", 34, "input"), ("Blurb", 54, "input"),
             ("Filmed There", 14, "input")]
for i, (head, width, kind) in enumerate(SHOP_COLS, start=1):
    c = wsh.cell(1, i, head)
    c.font = BOLD; c.fill = FILL[kind]; c.border = BOX
    wsh.column_dimensions[get_column_letter(i)].width = width
wsh.freeze_panes = "A2"
try:
    shops_src = json.loads((ROOT / "data/shops.json").read_text()).get("shops", [])
except Exception:
    shops_src = []
for r, sh in enumerate(shops_src, start=2):
    wsh.cell(r, 1, sh.get("name", "")).font = BODY
    wsh.cell(r, 2, sh.get("url", "")).font = BODY
    wsh.cell(r, 3, sh.get("area", "")).font = BODY
    wsh.cell(r, 4, ", ".join(sh.get("goodFor") or [])).font = BODY
    wsh.cell(r, 5, sh.get("blurb", "")).font = BODY
    wsh.cell(r, 6, "Yes" if sh.get("visited") else "No").font = BODY
    for col in range(1, len(SHOP_COLS) + 1):
        wsh.cell(r, col).border = BOX
ROWS = max(len(shops_src) + 1, 40)
dv_s = dv(DV_YESNO)
wsh.add_data_validation(dv_s)
dv_s.add(f"F2:F{ROWS}")
dv_area = dv(DV_AREA, strict=False)
wsh.add_data_validation(dv_area)
dv_area.add(f"C2:C{ROWS}")
dv_good = dv(DV_GOODFOR, strict=False)
wsh.add_data_validation(dv_good)
dv_good.add(f"D2:D{ROWS}")
wsh.cell(max(len(shops_src) + 3, 5), 1,
         "Add a row per shop. Paste the plain page URL: tracking and session parameters are "
         "stripped on build, but a clean link is easier to check.").font = NOTE

wb.save(OUT)
print(f"  Chase Cards {len(rows_out)} rows")
print(f"  Shops       {len(shops_src)} rows")
print(f"Wrote {OUT.relative_to(ROOT)}")
print(f"  Video Log   {len(ordered)} rows x {len(COLUMNS)} columns")
print(f"  Set Notes   {len(sets)} rows")
print(f"  prefilled:  set {sum(1 for v in ordered if len(v.get('sets') or []) >= 1)}, "
      f"opening {sum(1 for v in ordered if (v.get('products') or [''])[0] in PRODUCT_TO_OPENING)}, "
      f"rarity {sum(1 for v in ordered if best_pull(v))}")
