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

PRODUCT_TO_OPENING = {
    "single-pack": "Single Booster Pack", "bundle": "Booster Bundle",
    "etb": "ETB (Elite Trainer Box)", "upc": "UPC (Ultra Premium Collection)",
    "tin": "Tin", "blister": "Blister", "collection-box": "Collection Box",
    "ex-box": "ex Premium Collection",
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
    ("Garbage Rips 585 video log", None, TITLE),
    (None, None, None),
    ("What this is", "Every video on the channel, and the facts about it that only you know. "
                     "The website reads this to fill in tags, hits, and the Hall of Fame.", None),
    (None, None, None),
    ("Grey columns", "Come from YouTube. Do not edit them. Video ID is what links a row to a video, "
                     "so never sort in a way that separates it from its row, and never edit it.", None),
    ("Yellow columns", "Yours to fill in. Blank is fine: the site simply skips anything you have not "
                       "answered yet, so you can do twenty rows and see them appear.", None),
    ("Blue text", "A guess the site already made from the title and description. Correct it if it is "
                  "wrong, leave it if it is right. Black text means you typed it.", None),
    (None, None, None),
    ("How to use it", "1. File > Import > Upload this file into Google Sheets.", None),
    (None, "2. Fill in what you know. Use the dropdowns rather than typing, or the import will not match.", None),
    (None, "3. File > Download > Comma-separated values, with the Video Log tab open.", None),
    (None, "4. Send Claude the CSV, or run:  node scripts/import-sheet.mjs <the-csv>", None),
    (None, None, None),
    ("The one that matters most", "Set. 61 videos have no set tag, and a video with no set cannot show its "
                                  "booster wrapper, cannot be filtered, and cannot reach the Hall of Fame. "
                                  "Eight of those are graded hits that are locked out of the home page today.", None),
    (None, None, None),
    ("Hall of Fame", "Mark Yes on the rips you want in the gold section at the top of the home page. "
                     "Use Rank to order them, 1 first. Leave Rank blank and the site orders by rarity, "
                     "then by views. Anything marked Yes also belongs in the Greatest Hits playlist on YouTube.", None),
    (None, None, None),
    ("Set Notes tab", "Two facts the card database does not carry: whether a set is still in print, and "
                      "what a pack costs. The set guides leave both out until you fill them in.", None),
    (None, None, None),
    ("Careful", "Rebuilding this file overwrites it. Import your latest export first, then rebuild.", NOTE),
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
     ("Yes/No", YESNO), ("Playlists", PLAYLISTS)],
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
    ("Box / Series", 30, "input"),
    ("Opening Type", 28, "input"),
    ("Has Hit", 9, "input"),
    ("Hit Card", 30, "input"),
    ("Hit Rarity", 34, "input"),
    ("Hall of Fame", 13, "hof"),
    ("HoF Rank", 10, "hof"),
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
    for n, sid in enumerate(sets_v[:3]):
        if sid in set_name:
            wv.cell(r, COL["Set"] + n, set_name[sid]).font = GUESS_TXT
    if products and products[0] in PRODUCT_TO_OPENING:
        wv.cell(r, COL["Opening Type"], PRODUCT_TO_OPENING[products[0]]).font = GUESS_TXT
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
    (DV_SET, [CI["Set"], CI["Set 2"], CI["Set 3"]]),
    (DV_OPEN, [CI["Opening Type"]]),
    (DV_RARITY, [CI["Hit Rarity"]]),
    (DV_YESNO, [CI["Has Hit"], CI["Hall of Fame"], CI["Feature"], CI["Hide"]]),
    (DV_PLAYLIST, [CI["Playlist To Add"]]),
]:
    dv = DataValidation(type="list", formula1=dv_formula, allow_blank=True, showDropDown=False)
    wv.add_data_validation(dv)
    for col in cols:
        c = get_column_letter(col)
        dv.add(f"{c}2:{c}{last}")

# =========================================================== 4. Set Notes ===

wn = wb.create_sheet("Set Notes")
NOTE_COLS = [
    ("Set ID", 22, "locked"), ("Set Name", 24, "locked"),
    ("Released", 12, "locked"), ("Cards", 8, "locked"), ("Your rips", 10, "locked"),
    ("Still In Print", 14, "input"), ("Pack Price USD", 15, "input"),
    ("Booster Box Price USD", 21, "input"),
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

dv_print = DataValidation(type="list", formula1=DV_YESNO, allow_blank=True, showDropDown=False)
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
    ("Opening type filled in", f'=COUNTA({L}!{CL("Opening Type")}2:{CL("Opening Type")}{last})'),
    ("Marked as a hit", f'=COUNTIF({L}!{CL("Has Hit")}2:{CL("Has Hit")}{last},"Yes")'),
    ("Hit card named", f'=COUNTA({L}!{CL("Hit Card")}2:{CL("Hit Card")}{last})'),
    ("In the Hall of Fame", f'=COUNTIF({L}!{CL("Hall of Fame")}2:{CL("Hall of Fame")}{last},"Yes")'),
    ("Given a HoF rank", f'=COUNTA({L}!{CL("HoF Rank")}2:{CL("HoF Rank")}{last})'),
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

wb.save(OUT)
print(f"Wrote {OUT.relative_to(ROOT)}")
print(f"  Video Log   {len(ordered)} rows x {len(COLUMNS)} columns")
print(f"  Set Notes   {len(sets)} rows")
print(f"  prefilled:  set {sum(1 for v in ordered if len(v.get('sets') or []) >= 1)}, "
      f"opening {sum(1 for v in ordered if (v.get('products') or [''])[0] in PRODUCT_TO_OPENING)}, "
      f"rarity {sum(1 for v in ordered if best_pull(v))}")
