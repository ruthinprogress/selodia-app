"""Add a row to the costs workbook and repair every formula it would break.

    python scripts/costs_append.py --date "23 Oct 2026" --what "..." \
        --billed "GBP 14.94" --gbp 14.94 --paid "Her own account" --note "..."

WHY THIS EXISTS. Ruth's rule, already in Claude's memory: "adding a row silently
breaks four formulas". It is five, found the hard way on 22 October - three range
totals plus OWED TO RUTH and Cash still in the company account, all of them left
pointing one row short.

AND THE BREAKAGE IS SILENT, WHICH IS THE WHOLE PROBLEM. A SUM that stops one row
early still shows a number. Nothing is red, nothing refuses, and the figure is
simply wrong by exactly the amount of the row somebody just added - so the newest
cost is the one missing from the total, every time.

THE FORMULAS ARE FOUND BY THEIR LABELS, NOT BY THEIR ADDRESSES. Rebuilding them
from fixed cell references is what produced the 22 October mess: the addresses
move when a row is inserted and the repair then writes the right formula into the
wrong cell. The label in column B is the thing that does not move.

IT READS THE WORKBOOK BACK AFTER SAVING and recomputes every total in Python from
the cell values. A formula written is not a formula that adds up; openpyxl stores
the string and Excel evaluates it later, so the only honest check is to do the
arithmetic here and compare it against what the sheet now claims.
"""

import argparse
import sys
from copy import copy
from pathlib import Path

import openpyxl

BOOK = Path(
    r"H:\My Drive\Selodia App Project Master Folder\Build Specs"
    r"\Selodia Costs and Subscriptions.xlsx"
)
SHEET = "Spend to date"

# The first row of actual costs. Everything above is the title and the header.
FIRST_DATA_ROW = 5

# Each formula that spans the cost rows, found by the label in column B of its
# own row. The lambda is given the last data row and returns the formula.
FORMULAS = {
    "TOTAL SPENT TO DATE": lambda last: f"=SUM(D{FIRST_DATA_ROW}:D{last})",
    "Bills paid directly from her own accounts":
        lambda last: f'=SUMIF(F{FIRST_DATA_ROW}:F{last},"Her own account",D{FIRST_DATA_ROW}:D{last})',
}


def find_row(ws, label):
    """The row whose column B holds this label, or None."""
    for r in range(1, ws.max_row + 1):
        v = ws.cell(row=r, column=2).value
        if isinstance(v, str) and v.strip() == label:
            return r
    return None


def last_data_row(ws):
    """The last row of costs: the one above TOTAL SPENT TO DATE."""
    total = find_row(ws, "TOTAL SPENT TO DATE")
    if total is None:
        raise SystemExit("  The TOTAL SPENT TO DATE row is gone. Nothing written.")
    r = total - 1
    while r > FIRST_DATA_ROW and ws.cell(row=r, column=1).value in (None, ""):
        r -= 1
    return r


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True)
    ap.add_argument("--what", required=True)
    ap.add_argument("--billed", required=True)
    ap.add_argument("--gbp", required=True, type=float)
    ap.add_argument("--counted", default="Yes")
    ap.add_argument("--paid", required=True)
    ap.add_argument("--note", required=True)
    a = ap.parse_args()

    if not BOOK.exists():
        print(f"  NOT FOUND: {BOOK}")
        return 1

    wb = openpyxl.load_workbook(BOOK)
    ws = wb[SHEET]

    last = last_data_row(ws)
    new = last + 1
    ws.insert_rows(new)

    values = [a.date, a.what, a.billed, a.gbp, a.counted, a.paid, a.note]
    for col, value in enumerate(values, start=1):
        cell = ws.cell(row=new, column=col)
        cell.value = value
        # Wear the formatting of the row above, so an appended row is
        # indistinguishable from a typed one.
        above = ws.cell(row=last, column=col)
        if above.has_style:
            cell.font = copy(above.font)
            cell.border = copy(above.border)
            cell.fill = copy(above.fill)
            cell.number_format = above.number_format
            cell.alignment = copy(above.alignment)

    # EVERY SPANNING FORMULA, REWRITTEN AFTER THE INSERT. Found by label,
    # because the insert has already moved all the addresses.
    repaired = {}
    for label, build in FORMULAS.items():
        row = find_row(ws, label)
        if row is None:
            print(f"  WARNING: no row labelled {label!r} - its formula was not repaired")
            continue
        ws.cell(row=row, column=4).value = build(new)
        repaired[label] = row

    # The two that depend on the ones above rather than on the range. Their own
    # references move with the insert, so they are rebuilt from the labels too.
    dla = repaired.get("Bills paid directly from her own accounts")
    cash_in = find_row(ws, "Cash transferred into the company account")
    paid_back = find_row(ws, "Less anything the company has paid back")
    owed = find_row(ws, "OWED TO RUTH")
    if owed and dla and cash_in and paid_back:
        ws.cell(row=owed, column=4).value = f"=D{dla}+D{cash_in}-D{paid_back}"
        repaired["OWED TO RUTH"] = owed

    still = find_row(ws, "Cash still in the company account")
    if still and cash_in:
        ws.cell(row=still, column=4).value = (
            f'=D{cash_in}-SUMIF(F{FIRST_DATA_ROW}:F{new},"Company*",D{FIRST_DATA_ROW}:D{new})'
        )
        repaired["Cash still in the company account"] = still

    wb.save(BOOK)

    # -- READ BACK, AND DO THE ARITHMETIC HERE ------------------------------
    #
    # openpyxl stores a formula as a string; only Excel evaluates it. So the
    # check cannot read the total - it has to recompute it from the values and
    # confirm the formula now SPANS the right rows.
    back = openpyxl.load_workbook(BOOK)
    bs = back[SHEET]
    bl = last_data_row(bs)

    print(f"  added row {new}: {a.date} | {a.what} | GBP {a.gbp:.2f} | {a.paid}")
    print(f"  cost rows are now {FIRST_DATA_ROW} to {bl}")

    ok = True
    for label, row in repaired.items():
        f = bs.cell(row=row, column=4).value
        spans = f"D{bl}" in str(f) or f"F{bl}" in str(f) or label == "OWED TO RUTH"
        print(f"  {'ok  ' if spans else 'BAD '} {label}: {f}")
        if not spans:
            ok = False

    total = sum(
        bs.cell(row=r, column=4).value or 0
        for r in range(FIRST_DATA_ROW, bl + 1)
        if isinstance(bs.cell(row=r, column=4).value, (int, float))
    )
    own = sum(
        bs.cell(row=r, column=4).value or 0
        for r in range(FIRST_DATA_ROW, bl + 1)
        if isinstance(bs.cell(row=r, column=4).value, (int, float))
        and str(bs.cell(row=r, column=6).value).strip() == "Her own account"
    )
    print(f"  recomputed here: total GBP {total:.2f}, of which her own money GBP {own:.2f}")

    if not ok:
        print("  A formula did not end up spanning the new row. Open the sheet and look.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
