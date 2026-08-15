#!/usr/bin/env python3
"""Pull one tab out of the workbook as CSV, for import-sheet.mjs.

    python3 scripts/sheet-to-csv.py <file.xlsx> [tab] > out.csv

Exists because the round trip through Google Sheets mangles two things that
then confuse the importer, and both are fixed here rather than in fourteen
places downstream.

INTEGERS COME BACK AS FLOATS. Sheets stores every number as a double, so a
pack count of 9 exports as "9.0" and a view count of 759 as "759.0". Anything
whole is written back as a plain integer.

FORMULA CELLS ARE READ AS VALUES, not as "=SUM(H5,J5,L5,N5,P5)". Packs Opened
is a computed column, and the importer wants the number it computed.

Trailing spaces are stripped too. Sheets autocomplete leaves them behind
("Surging Sparks ") and a set name with a space on the end matches nothing.
"""
import csv
import sys
from pathlib import Path

from openpyxl import load_workbook

src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
tab = sys.argv[2] if len(sys.argv) > 2 else "Video Log"
if not src or not src.exists():
    sys.exit(f"usage: sheet-to-csv.py <file.xlsx> [tab]\nnot found: {src}")

wb = load_workbook(src, data_only=True)
if tab not in wb.sheetnames:
    sys.exit(f'no tab named "{tab}". Tabs: {", ".join(wb.sheetnames)}')
ws = wb[tab]

out = csv.writer(sys.stdout)
for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=ws.max_column):
    cells = []
    for c in row:
        v = c.value
        if v is None:
            cells.append("")
        elif isinstance(v, float) and v.is_integer():
            cells.append(str(int(v)))
        else:
            cells.append(str(v).strip())
    out.writerow(cells)
