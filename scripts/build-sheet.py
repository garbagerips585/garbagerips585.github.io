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
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "Garbage-Rips-585-Video-Log.xlsx"

# What has already been imported from a filled-in sheet. Restored onto the rows
# below so a rebuild returns a human's answers rather than overwriting them.
try:
    manual = json.loads((ROOT / "data/manual.json").read_text())
except Exception:
    manual = {}

videos = json.loads((ROOT / "public/data/videos.json").read_text())
videos = videos.get("videos", videos)
sets = json.loads((ROOT / "public/data/sets.json").read_text())["sets"]
set_name = {s["id"]: s["name"] for s in sets}

# The non-English guides. Without these the 21 imported rips had no option in
# the Set dropdown at all, and their prefilled guess came back blank, so the one
# part of the catalogue that most needed a human answer was the one part the
# sheet could not ask about. Labels match shared/taxonomy.mjs exactly, because
# import-sheet.mjs maps this text straight back to a set id.
_LANG_TAG = {"ja": "JP", "ko": "KR", "zh-cn": "CN", "zh-tw": "CN"}
intl_sets = {}
try:
    _ig = json.loads((ROOT / "public/data/intl-guides.json").read_text())["sets"]
    for _id, _g in _ig.items():
        intl_sets[_id] = f"{_g['english']} ({_LANG_TAG.get(_g.get('lang'), '??')})"
except Exception:
    pass
set_name.update(intl_sets)

# ---------------------------------------------------------------- vocabulary

SET_NAMES = ([s["name"] for s in sets]
             + sorted(intl_sets.values())
             + ["Multiple sets", "Not a set (sealed/other)"])

OPENING_TYPES = [
    "Single Booster Pack", "Booster Bundle", "Booster Box",
    "ETB (Elite Trainer Box)", "SPC (Super Premium Collection)",
    "UPC (Ultra Premium Collection)", "Poke Ball Tin", "Tin",
    "ex Premium Collection", "ex Special Collection", "ex Box", "Collection Box",
    # Added after it was typed in by hand, because the dropdown did not offer it
    # and the product is real. Anything typed freehand into a validated column
    # is a missing option, not a user error.
    "Knock Out Collection",
    "Blister", "Japanese Booster Pack", "Korean Booster Pack",
    "Chinese Booster Pack", "Other",
]

# Mirrors the ladder the site ranks by, in the same order, so the Hall of Fame
# sorts the way the sheet reads.
# THE STAR HINT USED TO BE INSIDE THE VALUE and it broke the column. The options
# read "Hyper Rare (3 gold stars)" while everything this script PREFILLED, and
# everything the site stores, is the bare name "Hyper Rare". So 63 of the 64
# filled cells failed validation the moment the file reached Google Sheets, and
# the column came back covered in warning triangles. One cell matched: the one
# where the long form was picked from the dropdown by hand.
#
# A dropdown value is a KEY. It has to equal what the data says, or the sheet
# argues with itself. The hint is genuinely useful, so it moved to a comment on
# the header cell and to the Read Me, where it costs nothing.
RARITIES = [
    "Mega Hyper Rare",
    "Hyper Rare",
    "Special Illustration Rare",
    "Illustration Rare",
    "Ultra Rare",
    "Double Rare",
    "Rare",
    "ACE SPEC Rare",
    "Super Rare",
    "Charizard",
    # Tim used this on two videos where a single rip produced several notable
    # cards. It was not an option and it should have been: the alternative is
    # forcing one card to stand for the rip. The per-card detail goes on the
    # My Hits tab.
    "More than one",
    "No hit",
]

# The star hint, kept out of the value and shown as a note on the header instead.
RARITY_HINT = (
    "Read the star row at the bottom of the card.\n"
    "Mega Hyper Rare: one big yellow star.\n"
    "Hyper Rare: three gold stars.\n"
    "Special Illustration Rare: two gold stars.\n"
    "Illustration Rare: one gold star.\n"
    "Ultra Rare: two silver stars.\n"
    "Double Rare: two black stars.\n"
    "Rare: one black star.\n"
    "ACE SPEC Rare: one pink star.\n"
    "Charizard: any rarity, it is its own category here.\n"
    "More than one: several notable cards, list them on My Hits."
)

YESNO = ["Yes", "No"]
PLAYLISTS = ["Greatest Hits", "Hits Only", "Full Box Openings", "Singles",
             "Japanese", "None"]

# Which derived pull tag maps onto which sheet rarity, so the guess is prefilled.
PULL_TO_RARITY = {
    "gold": "Hyper Rare",
    "sir": "Special Illustration Rare",
    "ir": "Illustration Rare",
    "double-rare": "Double Rare",
    "charizard": "Charizard",
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
def _hit_card_list():
    """Cards worth logging as a hit, dearest first, deduped by name.

    Was the 152 chase cards from sets.json, which is every card we happened to
    show on a set page. The full checklist is now on disk, so this offers the
    cards someone would actually write down: anything over $5, capped so the
    dropdown stays usable in Excel. Still a suggestion, not a rule.
    """
    seen = {}
    try:
        for f in sorted((ROOT / "public/data/cards").glob("*.json")):
            for c in json.loads(f.read_text())["cards"]:
                price = c.get("price")
                if not isinstance(price, (int, float)) or price < 5:
                    continue
                name = c.get("name") or ""
                if name and price > seen.get(name, 0):
                    seen[name] = price
    except Exception:
        pass
    for st in sets:                       # keep the old source as a floor
        for c in (st.get("chase") or []):
            seen.setdefault(c["name"], 0)
    ranked = sorted(seen.items(), key=lambda kv: -kv[1])[:500]
    return sorted(n for n, _ in ranked)

HIT_CARDS = _hit_card_list()

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
    # ITS OWN LABEL, not a second name for ex Premium Collection. Both ids
    # pointed at the same string, and the importer maps that string back to
    # ex-premium, so every re-import silently converted 24 ex-box videos into
    # ex Premium Collections. A round trip through the sheet must not change
    # what it did not ask about.
    "ex-box": "ex Box",
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
                                "about in Set and the rest in Set 2 to Set 5. Next to each one, put "
                                "how many packs of THAT set were in the opening. Packs Opened adds "
                                "them up for you, so a UPC reads 18 packs AND tells us six were "
                                "Journey Together. That is what makes a per-set pack count possible.", None),
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
    # SET AND ITS PACK COUNT SIT TOGETHER, five pairs of them.
    #
    # A UPC is 18 packs across five sets. Recording only the total meant we knew
    # 18 packs were opened but not that six were Journey Together, so no per-set
    # pack count could ever be computed and "how many Pitch Black packs have we
    # opened" had no answer. The pair is the smallest thing that fixes it.
    #
    # FIVE PAIRS, not a separate tab, because the distribution says so: of 272
    # videos with any set recorded, 259 are a SINGLE set, 11 are two, one is
    # three and one is five. A tab would make 259 rows a two-place job to serve
    # thirteen. Five pairs covers every video in the catalogue today.
    #
    # This replaces "More Sets", which was free text. Free text in one cell is
    # exactly what broke the hits: one typo and one stray comma cost two cards.
    ("Set", 24, "input"),
    ("Packs", 8, "input"),
    ("Set 2", 24, "input"),
    ("Packs 2", 8, "input"),
    ("Set 3", 24, "input"),
    ("Packs 3", 8, "input"),
    ("Set 4", 24, "input"),
    ("Packs 4", 8, "input"),
    ("Set 5", 24, "input"),
    ("Packs 5", 8, "input"),
    ("Box / Series", 30, "input"),
    ("Opening Type", 28, "input"),
    # Packs Opened is what makes the luck page rigorous. Without it a rate can
    # only be "per video", which silently treats a 36-pack booster box and a
    # single pack as one trial each. With it the rate is per PACK, which is the
    # number anyone actually means by "how often do you hit".
    # Now a SUM of the five pack cells, not a typed number. It used to be typed
    # independently, so a row could say 18 packs while its per-set cells added
    # to 12 and nothing would notice. Grey because it is computed.
    ("Packs Opened", 13, "locked"),
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

# Hover notes on the headers that need explaining. These survive the trip
# through Google Sheets as cell notes, which is where an instruction actually
# gets read: nobody scrolls back to a Read Me tab mid-row.
HEAD_NOTES = {
    "Hit Rarity": RARITY_HINT,
    "Hit Card": (
        "The headline card, written however you like.\n"
        "If a rip produced SEVERAL cards worth naming, set Hit Rarity to\n"
        '"More than one" and list them one per row on the My Hits tab.\n'
        "One card per row there means the site can price them and link them."
    ),
    "Packs Opened": (
        "COMPUTED. Do not type here.\n"
        "It adds up Packs, Packs 2, Packs 3, Packs 4 and Packs 5.\n"
        "Put the count for each set in that set's own Packs column and this\n"
        "adds itself up. Typing over it deletes the sum for that row."
    ),
    "Packs": "How many packs from the set in the Set column, not the whole rip.",
    "Greatest Hits": (
        "The Hall of Fame band on the home page.\n"
        "Separate from the Hits playlist: this is the shortlist, that is a\n"
        "YouTube playlist. A video can be in one, both or neither."
    ),
    "Set": "Start typing and pick from the list. If a set is missing, tell Claude rather than typing it freehand.",
}

for i, (head, width, kind) in enumerate(COLUMNS, start=1):
    c = wv.cell(1, i, head)
    c.font = BOLD
    c.fill = FILL[kind]
    c.border = BOX
    c.alignment = Alignment(vertical="center", wrap_text=True)
    if head in HEAD_NOTES:
        cm = Comment(HEAD_NOTES[head], "Garbage Rips")
        cm.width, cm.height = 320, 190
        c.comment = cm
    wv.column_dimensions[get_column_letter(i)].width = width
wv.freeze_panes = "B2"
wv.row_dimensions[1].height = 30

# AUTOFILTER, AND IT IS THE BIGGEST USABILITY FIX IN THIS FILE.
# The log is sorted newest first, which is right for "I just uploaded, log it".
# Tim works the other way for backfill, oldest first, and without a filter that
# meant scrolling to row 314 every session and hunting for the next blank by
# eye. With this he sorts Published ascending in one click, and can filter any
# column to Blanks to see exactly what is left.
# Survives the trip into Google Sheets as its standard filter.
wv.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{len(videos) + 1}"

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
    # Step by TWO: the columns now interleave Set, Packs, Set 2, Packs 2...
    # so Set 2 is COL["Set"]+2, not +1. Off by one here would have written every
    # extra set into a pack-count cell.
    for n, sid in enumerate(sets_v[:5]):
        if sid in set_name:
            wv.cell(r, COL["Set"] + n * 2, set_name[sid]).font = GUESS_TXT
    if products and products[0] in PRODUCT_TO_OPENING:
        wv.cell(r, COL["Opening Type"], PRODUCT_TO_OPENING[products[0]]).font = GUESS_TXT
    if products and products[0] in PRODUCT_TO_PACKS:
        # Goes on Packs, the first set's own count, because Packs Opened is now
        # a SUM. Writing a literal there would overwrite the formula.
        wv.cell(r, COL["Packs"], PRODUCT_TO_PACKS[products[0]]).font = GUESS_TXT
    # Packs Opened = the five per-set counts, summed. Typed independently it
    # could say 18 while the parts added to 12 and nothing would catch it.
    _pk = [get_column_letter(COL[h]) for h in ("Packs", "Packs 2", "Packs 3", "Packs 4", "Packs 5")]
    wv.cell(r, COL["Packs Opened"], "=SUM(" + ",".join(f"{c}{r}" for c in _pk) + ")")
    if pull:
        wv.cell(r, COL["Has Hit"], "Yes").font = GUESS_TXT
        wv.cell(r, COL["Hit Rarity"], PULL_TO_RARITY[pull]).font = GUESS_TXT

    # WHAT WAS ALREADY IMPORTED COMES BACK, which the Read Me has always claimed
    # and which was true of nothing. This script only ever read videos.json, so
    # a rebuild returned the machine's guesses and dropped every answer a human
    # had given: Has Hit, the rarity, Greatest Hits, the box name, the pack
    # count. Tim corrected a Costco UPC from 16 packs to 18, imported it, and
    # the next rebuild handed back 16 with no indication anything had been said.
    #
    # These win over the guesses above, in BODY rather than GUESS_TXT, because
    # they are answers rather than suggestions.
    man = manual.get(v["id"], {})
    # OPENING TYPE WAS MISSING FROM THIS BLOCK AND THE GUESS ABOVE WAS WINNING.
    # Every other answered field is restored here, so a rebuild handed back the
    # taxonomy's guess over a typed answer and said nothing: 24 videos logged as
    # "ex Premium Collection" came back as "ex Box", because the tag rules cannot
    # tell those two apart from a title and a person can. That is the exact
    # failure the note below describes, in the same block, one field over.
    if man.get("openingType"):
        wv.cell(r, COL["Opening Type"], man["openingType"]).font = BODY
    if man.get("hasHit") is not None:
        wv.cell(r, COL["Has Hit"], "Yes" if man["hasHit"] else "No").font = BODY
    if man.get("hitRarity"):
        wv.cell(r, COL["Hit Rarity"], man["hitRarity"]).font = BODY
    if man.get("greatest"):
        wv.cell(r, COL["Greatest Hits"], "Yes").font = BODY
    if man.get("greatestRank"):
        wv.cell(r, COL["Greatest Hits Rank"], man["greatestRank"]).font = BODY
    if man.get("playlistToAdd"):
        wv.cell(r, COL["Playlist To Add"], man["playlistToAdd"]).font = BODY
    if man.get("box"):
        wv.cell(r, COL["Box / Series"], man["box"]).font = BODY
    if man.get("hitCard"):
        wv.cell(r, COL["Hit Card"], man["hitCard"]).font = BODY
    for _k, _c in (("affiliate", "Affiliate Link"), ("siteTitle", "Site Title"),
                   ("blurb", "Short Description"), ("notes", "Notes")):
        if man.get(_k) and _c in COL:
            wv.cell(r, COL[_c], man[_k]).font = BODY
    for _k, _c in (("feature", "Feature"), ("hide", "Hide")):
        if man.get(_k) and _c in COL:
            wv.cell(r, COL[_c], "Yes").font = BODY

    # THE PACK COUNT GOES BACK IN THE FIRST SET'S CELL, and Packs Opened sums
    # to the total that was logged.
    #
    # This first left the cells blank on a multi-set video and put the total in
    # Notes, reasoning that 18 across five sets does not say how many came from
    # each and the sheet should not invent a split. That is true, and it was
    # still the wrong call: it left Tim looking at empty cells where he had
    # typed a number, which reads as data loss no matter what a note says. He
    # knows the split and can move the figure across the columns in seconds;
    # what he cannot do is get back a number the sheet threw away.
    #
    # So the total lands in the first cell and the note says what to do with it.
    # The SUM is right immediately, and the only thing left open is the
    # distribution, which was always his to give.
    if man.get("packs"):
        wv.cell(r, COL["Packs"], man["packs"]).font = BODY
        for _h in ("Packs 2", "Packs 3", "Packs 4", "Packs 5"):
            if _h in COL:
                wv.cell(r, COL[_h]).value = None
        if len(sets_v) > 1 and "Notes" in COL:
            _prev = wv.cell(r, COL["Notes"]).value
            _msg = (f"All {man['packs']} packs are on the first set. "
                    f"Move some across the Packs columns if they came from different sets.")
            wv.cell(r, COL["Notes"], f"{_prev} {_msg}".strip() if _prev else _msg).font = BODY

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
    (DV_SET, [CI["Set"], CI["Set 2"], CI["Set 3"], CI["Set 4"], CI["Set 5"]]),
    (DV_OPEN, [CI["Opening Type"]]),
    (DV_RARITY, [CI["Hit Rarity"]]),
    (DV_YESNO, [CI["Has Hit"], CI["Greatest Hits"], CI["Feature"], CI["Hide"]]),
    (DV_PLAYLIST, [CI["Playlist To Add"]]),
    (DV_RANK, [CI["Greatest Hits Rank"]]),
]:
    # ONE VALIDATION OBJECT PER COLUMN, NOT ONE SHARED ACROSS ALL OF THEM.
    #
    # openpyxl is happy to attach a single DataValidation to several ranges at
    # once, and it writes valid xlsx: one rule with sqref="G2:G312 I2:I312
    # K2:K312 M2:M312 O2:O312". Excel honours that. GOOGLE SHEETS DOES NOT. On
    # import it keeps the rule for the FIRST range and drops the others, then
    # rebuilds a dropdown for the abandoned columns out of whatever values it
    # finds already typed in them.
    #
    # The symptom is horrible to diagnose because the file is correct: Set had
    # all 38 sets and Set 2 offered exactly three, which were simply the three
    # anyone had ever typed into that column. It looked like a truncated list
    # rather than a lost rule.
    #
    # This sheet's whole reason for existing is that it opens in Google Sheets,
    # so it is Google's behaviour that decides what is correct here. Same story
    # for the Yes/No columns, which shared one rule across four.
    for col in cols:
        d = dv(dv_formula)
        wv.add_data_validation(d)
        c = get_column_letter(col)
        d.add(f"{c}2:{c}{last}")

# Suggestion lists: the dropdown helps, but neither list can ever be complete,
# so typing something new must not be rejected.
# HIT CARD HAS NO DROPDOWN, ON PURPOSE. It used to offer the 500 dearest cards
# as a non-strict suggestion list, which sounds helpful and is not, for two
# reasons that both bite in Google Sheets.
#
# The column does not hold ONE card name. A real entry reads "Phantasmal Flames
# - Trainer - Dawn - Double Silver Star - Ultra Rare, Mega Evolution - Mega
# Gardevoir ex - ..." and lists fourteen cards with their sets and rarities. A
# single-select control cannot express that, so the list could never contain a
# valid answer.
#
# And openpyxl's non-strict flag does not survive the trip. Sheets imports it as
# a real dropdown, then rebuilds the option list out of whatever is already in
# the column, so restoring two long hit lists turned into a two-item menu that
# refused anything typed. The field became unfillable by the one person who
# fills it.
#
# Free text. The My Hits tab is where a card gets picked one at a time.
for dv_formula, head in [(DV_BOX, "Box / Series")]:
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
    # The rarity column is the one with the most left to do and it was the one
    # the progress tab never counted, so the summary read as further along than
    # the work actually was.
    ("Hit rarity filled in", f'=COUNTA({L}!{CL("Hit Rarity")}2:{CL("Hit Rarity")}{last})'),
    ("Pack count filled in", f'=COUNTA({L}!{CL("Packs")}2:{CL("Packs")}{last})'),
    ("Still missing a pack count",
     f'=COUNTA({L}!{CL("Video ID")}2:{CL("Video ID")}{last})-COUNTA({L}!{CL("Packs")}2:{CL("Packs")}{last})'),
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

# One rule each, for the reason spelled out on the Video Log above: Google
# Sheets keeps only the first range of a multi-range validation on import, so
# Card Hall of Fame would have lost its Yes/No dropdown while Most Wanted kept
# one. That is the column the whole hall.html page is driven from.
for _col, _why in [("J", "Most Wanted"), ("K", "Card Hall of Fame")]:
    dv_c = dv(DV_YESNO)
    wc.add_data_validation(dv_c)
    dv_c.add(f"{_col}2:{_col}{len(rows_out) + 1}")
dv_src = dv(DV_PSASRC, strict=False)
wc.add_data_validation(dv_src)
dv_src.add(f"I2:I{len(rows_out) + 1}")

wc.cell(len(rows_out) + 3, 1,
        "Most Wanted is a card you are still chasing. Card Hall of Fame is one you have actually "
        "pulled, and it appears on /hall.html ranked by value, PSA 10 first and raw where there is "
        "no graded price. A card can be both while you chase a second copy. "
        "Key is what links a row back to a card and must not be edited. PSA 10 Checked is a date "
        "like 2026-08-11: a graded price with no date is not a fact about anything.").font = NOTE

# ============================================================= 6b. My Hits ===
#
# One row per CARD ACTUALLY PULLED, which is the piece the sheet was missing.
#
# The Chase Cards tab next door is a reference list: the good cards in each set,
# whether or not anyone has seen one. This is the opposite, a log of what came
# out of a pack on camera. They are different things and conflating them breaks
# both: a rip can produce several hits, and a hit can be a card nobody had
# listed as a chase card.
#
# Several rows can share one Video ID. That is the point: an ETB opening with
# three hits is three rows.
#
# Video ID is validated against the Video Log so a typo cannot orphan a card,
# and it is the join that puts these cards under the right rip page.

wh = wb.create_sheet("My Hits")
# Only the first three are worth your time. Number, Rarity and Raw NM are looked
# up from the card data on import when they are left blank, because the site
# already knows all 4,481 cards; fill them in only to overrule what it found.
# PSA 10 has no free feed, so that one is genuinely manual.
HIT_COLS = [
    ("Video ID", 14, "input"),
    ("Card", 30, "input"),
    ("Set", 24, "input"),
    ("Number", 9, "locked"),
    ("Rarity", 32, "locked"),
    ("Raw NM USD", 12, "locked"),
    ("PSA 10 USD", 12, "input"),
    ("Hall of Fame", 13, "hof"),
    ("Notes", 40, "input"),
]
for i, (head, width, kind) in enumerate(HIT_COLS, start=1):
    c = wh.cell(1, i, head)
    c.font = BOLD; c.fill = FILL[kind]; c.border = BOX
    c.alignment = Alignment(vertical="center", wrap_text=True)
    wh.column_dimensions[get_column_letter(i)].width = width
wh.freeze_panes = "B2"
wh.row_dimensions[1].height = 30

HI = {head: i for i, (head, _, _) in enumerate(HIT_COLS, start=1)}
HIT_ROWS = 400          # room to grow; blank rows are ignored on import

# Video ID validated against the Video Log's own column, so the join cannot
# break on a typo.
dv_vid = DataValidation(
    type="list",
    formula1=f"='Video Log'!$A$2:$A${len(ordered) + 1}",
    allow_blank=True, showDropDown=False, showErrorMessage=True,
)
wh.add_data_validation(dv_vid)
dv_vid.add(f"A2:A{HIT_ROWS}")

for formula, head, strict in [
    (DV_SET, "Set", False),
    (DV_RARITY, "Rarity", False),
    (DV_YESNO, "Hall of Fame", True),
]:
    d = dv(formula, strict)
    wh.add_data_validation(d)
    col = get_column_letter(HI[head])
    d.add(f"{col}2:{col}{HIT_ROWS}")

for r in range(2, HIT_ROWS + 1):
    for i in range(1, len(HIT_COLS) + 1):
        cell = wh.cell(r, i)
        cell.font = BODY
        cell.border = BOX
    wh.cell(r, HI["Raw NM USD"]).number_format = '"$"#,##0.00'
    wh.cell(r, HI["PSA 10 USD"]).number_format = '"$"#,##0.00'

# PREFILL FROM data/hits.json, because a rebuild used to hand back 400 empty
# rows. Seventeen cards had already been logged by hand across two rips, and
# every one of them would have come back blank in the file you then keep working
# in, which is the worst possible way to lose them: silently, in the copy you
# trust. The tab header above says rebuilding is safe for "anything already
# imported", and this is what makes that true of hits.
#
# Card, Set and Video ID are what a human typed, so they are written back as
# typed. Number, Rarity and Raw NM are the looked-up columns and stay empty
# unless hits.json already carries an override, so the import still fills them
# from the card data rather than freezing today's answer into the sheet.
try:
    _hits = json.loads((ROOT / "data/hits.json").read_text()).get("videos", {})
except Exception:
    _hits = {}
_hrow = 2
for _vid, _cards in _hits.items():
    for _h in _cards:
        if _hrow > HIT_ROWS:
            break
        wh.cell(_hrow, HI["Video ID"], _vid).font = BODY
        wh.cell(_hrow, HI["Card"], _h.get("card", "")).font = BODY
        wh.cell(_hrow, HI["Set"], _h.get("setName") or _h.get("set", "")).font = BODY
        if _h.get("number"):
            wh.cell(_hrow, HI["Number"], _h["number"]).font = BODY
        if _h.get("rarity"):
            wh.cell(_hrow, HI["Rarity"], _h["rarity"]).font = BODY
        if _h.get("hallOfFame"):
            wh.cell(_hrow, HI["Hall of Fame"], "Yes").font = BODY
        _hrow += 1
_prefilled = _hrow - 2

wh.cell(HIT_ROWS + 2, 1, "One row per card pulled. Several rows can share a Video ID.").font = NOTE
wh.cell(HIT_ROWS + 3, 1, "Hall of Fame = Yes marks the all-time best, which get their own page.").font = NOTE

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
print(f"  My Hits     empty, {HIT_ROWS - 1} rows ready")
print(f"  Shops       {len(shops_src)} rows")
print(f"Wrote {OUT.relative_to(ROOT)}")
print(f"  My Hits prefilled with {_prefilled} card(s) already logged in data/hits.json")
print(f"  Video Log   {len(ordered)} rows x {len(COLUMNS)} columns")
print(f"  Set Notes   {len(sets)} rows")
print(f"  prefilled:  set {sum(1 for v in ordered if len(v.get('sets') or []) >= 1)}, "
      f"opening {sum(1 for v in ordered if (v.get('products') or [''])[0] in PRODUCT_TO_OPENING)}, "
      f"rarity {sum(1 for v in ordered if best_pull(v))}")
