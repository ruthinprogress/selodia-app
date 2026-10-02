"""Record the Play Console refund and the new registration, on the one-off sheet.

Ruth, 2 October 2026: "for costing, play console refunded it and then I made a
new account thats working and app is registered."

WHY THIS NEEDS SAYING RATHER THAN JUST ADDING A ROW. Two $25 charges appear on
the card, three days apart, and the first one was refunded. A costing sheet that
shows both without the refund says Selodia spent $50 on Play registration. It
spent $25. The refund is the fact that makes the second charge not a duplicate.

So the 23 September row is annotated rather than deleted - it happened, the
statement shows it, and a line that vanishes from a costing record is worse than
one that explains itself - and the 2 October row is added beside it with its own
order number.

NET ONE-OFF SPEND IS UNCHANGED at $25 for Play. That is the number that matters
to the funding arithmetic, and it is written down here so nobody has to re-derive
it from two charges and a refund.

Dated backup first, rows found by their text, nothing else touched.
"""

import shutil
import sys
from datetime import date
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment

DRIVE = Path(r"H:\My Drive\Selodia App Project Master Folder\Build Specs")
BOOK = DRIVE / "Selodia Costs and Subscriptions.xlsx"
BACKUP = DRIVE / f"Selodia Costs and Subscriptions (backup {date.today():%Y-%m-%d} before play redo).xlsx"

SHEET = "One-off purchases"
OLD_ROW_DATE = "23 Sept 2026"

REFUND_NOTE = (
    " REFUNDED 2 October 2026, $25.00 back to the Mastercard ending 3753, reason "
    "given as Other. This charge stands in the record because the statement shows "
    "it, but it is NOT a cost: see the 2 October row below, which is the one that "
    "counts. Net Play registration spend is $25, not $50."
)

NEW_ROW = [
    "2 Oct 2026",
    "Google Play Developer registration (new account)",
    "$25.00",
    "Monzo (personal)",
    "One-off, never renews. REPLACES the 23 Sept registration, which was refunded "
    "in full the same day. New account created because the first one would not "
    "complete; this one works and the app is registered. Order PDS.4943-8866-6198-08383, "
    "Mastercard ending 3753. NET SPEND ON PLAY REGISTRATION IS $25, not $50.",
]


def main() -> int:
    if not BOOK.exists():
        print(f"  NOT FOUND: {BOOK}")
        return 1

    wb = openpyxl.load_workbook(str(BOOK))
    if SHEET not in wb.sheetnames:
        print(f"  NOT FOUND: sheet '{SHEET}'. Nothing written.")
        return 1
    ws = wb[SHEET]

    # Already done?
    for row in ws.iter_rows(values_only=True):
        if row and row[0] and str(row[0]).strip() == NEW_ROW[0] and "new account" in str(row[1] or ""):
            print("  already recorded. Nothing written.")
            return 0

    # The 23 September row, found by its date rather than its index.
    target = None
    for r in range(1, ws.max_row + 1):
        if str(ws.cell(row=r, column=1).value or "").strip() == OLD_ROW_DATE:
            target = r
            break
    if target is None:
        print(f"  NOT FOUND: no row dated '{OLD_ROW_DATE}'. Nothing written.")
        return 1

    shutil.copy2(BOOK, BACKUP)
    print(f"  backed up to: {BACKUP.name}")

    note_cell = ws.cell(row=target, column=5)
    if "REFUNDED" not in str(note_cell.value or ""):
        note_cell.value = f"{note_cell.value or ''}{REFUND_NOTE}"
        note_cell.alignment = Alignment(wrap_text=True, vertical="top")

    # Appended below the last row, which is the sheet's own stated convention:
    # "Oldest at the top, newest appended".
    new_r = ws.max_row + 1
    for col, value in enumerate(NEW_ROW, start=1):
        cell = ws.cell(row=new_r, column=col, value=value)
        cell.alignment = Alignment(wrap_text=True, vertical="top")

    wb.save(str(BOOK))
    print(f"  annotated row {target} ({OLD_ROW_DATE}) and appended row {new_r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
