"""Build the "Spend to date" sheet in the costs workbook.

    python scripts/costs_total.py

WHY A SHEET AND NOT A NUMBER IN A MESSAGE. Ruth asked how much she had spent and
the answer took reading two sheets of prose and converting four dollar figures. A
total written into a cell goes stale the moment anything is added; a ledger that
SUMs itself does not, and she can add a row to it without asking anybody.

WHAT IT IS NOT. It is not a second record of the costs - the two existing sheets
stay the record, with their notes and their reasoning. This is the payments off
those sheets, one row each, in the order they happened, so a total exists.

THE RULE FOR WHAT COUNTS: money that has actually left an account for Selodia.
A refunded charge nets to nothing. A direct debit that has not been taken is
listed and marked, not counted.
"""

from copy import copy
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

BOOK = Path(
    r"H:\My Drive\Selodia App Project Master Folder\Build Specs\Selodia Costs and Subscriptions.xlsx"
)
SHEET = "Spend to date"

# The rate used for every dollar figure with no sterling amount on a statement.
# ECB, 24 September 2026, the day a real pair was recorded: $24.00 = 18.15.
USD = 0.75645

# WHERE THE MONEY CAME FROM, and this is new on 8 October 2026.
#
# Until that day there was no company card, so every payment below was personal
# money spent on the company and reclaimable through the director's loan
# account. The Monzo card went live on 8 October and the Apple fee is the first
# thing on it. The difference decides how much she can reclaim, so it is a
# column that sorts rather than a sentence in a footnote.
#
# IT IS WRITTEN OUT ON EVERY ROW, not worked out from the date. A cutover date
# would quietly mislabel the first personal payment made after it, and there
# will be some.
PERSONAL = "Her own account"
COMPANY = "Company card"

# Money Ruth has lent the company as cash, as opposed to bills she paid
# directly. It is a LOAN and not income: it is still her money, sitting in the
# company's account, and the company owes it back.
#
# date, amount, note
CASH_INTRODUCED = [
    ("6 Oct 2026", 200.00,
     "Opening transfer into Monzo Business Lite. A director\u0027s loan, not income."),
]

# date, what, as billed, GBP (None = convert from the dollar figure), counted, paid by, note
ROWS = [
    ("19 Aug 2026", "Exercise Animatic Ultimate Bundle + lifetime licence", "$229.00", None, True,
     PERSONAL, "Converted at the rate below. Was $599 with code STARTUP100DISCOUNT."),
    ("Aug 2026", "selodia.app domain, one year", "$11.18", None, True, PERSONAL, "Namecheap."),
    ("Aug 2026", "Claude.ai, August invoice", "\u00a376.49", 76.49, True,
     PERSONAL, "\u00a375.00 less an \u00a311.26 credit, plus VAT."),
    ("10 Sept 2026", "Anthropic API credit", "$20.00", None, True, PERSONAL, "First top-up."),
    ("10 Sept 2026", "Namecheap Private Email, one year", "$17.86", None, True,
     PERSONAL, "$14.88 plus $2.98 tax. hello@selodia.app."),
    ("10 Sept 2026", "Claude.ai, Max month 10 Sep to 10 Oct", "\u00a390.00", 90.00, True,
     PERSONAL, "A one-off, not recurring: the Max upgrade was a glitch at Anthropic's end."),
    ("22 Sept 2026", "Backblaze B2 storage", "~\u00a30.66/month", 0.66, True,
     PERSONAL, "138 GB of the animation library at $6/TB/month. Roughly one month so far."),
    ("23 Sept 2026", "Google Play Developer registration", "\u00a318.77", 0.00, False,
     PERSONAL, "REFUNDED in full on 2 October. Listed because the statement shows it; it nets to nothing."),
    ("24 Sept 2026", "Anthropic API credit", "$24.00", 18.15, True,
     PERSONAL, "Real figure off the card. Paid on Matty's Amex."),
    ("30 Sept 2026", "Anthropic API credit", "$24.00", 18.18, True, PERSONAL,
     "Real figure off the card."),
    ("30 Sept 2026", "ICO data protection fee, tier 1", "\u00a354.00", 0.00, False,
     PERSONAL, "NOT YET DEBITED as of 30 September. Counted when it reaches the bank."),
    ("2 Oct 2026", "Google Play Developer registration, new account", "$25.00", None, True,
     PERSONAL, "Replaces the refunded 23 September registration. Net Play spend is one $25."),
    ("5 Oct 2026", "iPhone 14 128GB refurbished, for Apple enrolment and iOS testing", "\u00a3248.99", 248.99, True,
     PERSONAL, "\u00a3245.00 plus \u00a33.99 Back Market fee."),
    ("8 Oct 2026", "Apple Developer Program, one year", "\u00a379.00", 79.00, True,
     COMPANY, "Order W1441568256. Enrolment 3N9H5LB49A, as Selodia Ltd, approved 5 October. "
     "THE FIRST PAYMENT ON THE COMPANY CARD."),
]


def gbp(as_billed: str, given):
    if given is not None:
        return float(given)
    amount = float(as_billed.replace("~", "").replace("$", "").split("/")[0])
    return round(amount * USD, 2)


def main() -> int:
    wb = openpyxl.load_workbook(BOOK)
    if SHEET in wb.sheetnames:
        del wb[SHEET]
    ws = wb.create_sheet(SHEET, 0)

    bold = Font(bold=True)
    wrap = Alignment(wrap_text=True, vertical="top")

    ws["A1"] = "Spend to date"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = (
        "Every payment that has actually left an account for Selod\u00eda, one row each, from "
        "August 2026 onwards - when the full-time work started. "
        "The two sheets beside this one stay the record - they carry the notes and the reasoning. "
        "This exists so a total does. Add a row and the total follows it."
    )
    ws["A2"].alignment = wrap

    head = ["Date", "What", "As billed", "GBP", "Counted", "Paid by", "Note"]
    for i, h in enumerate(head, start=1):
        c = ws.cell(row=4, column=i, value=h)
        c.font = bold

    row = 5
    for date, what, billed, given, counted, paid_by, note in ROWS:
        ws.cell(row=row, column=1, value=date)
        ws.cell(row=row, column=2, value=what)
        ws.cell(row=row, column=3, value=billed)
        ws.cell(row=row, column=4, value=gbp(billed, given) if counted else 0.00)
        ws.cell(row=row, column=5, value="Yes" if counted else "No")
        ws.cell(row=row, column=6, value=paid_by)
        ws.cell(row=row, column=7, value=note)
        for col in range(1, 8):
            ws.cell(row=row, column=col).alignment = wrap
        ws.cell(row=row, column=4).number_format = '"\u00a3"#,##0.00'
        row += 1

    total = row + 1
    ws.cell(row=total, column=2, value="TOTAL SPENT TO DATE").font = bold
    c = ws.cell(row=total, column=4, value=f"=SUM(D5:D{row - 1})")
    c.font = bold
    c.number_format = '"\u00a3"#,##0.00'

    # THE DIRECTOR'S LOAN ACCOUNT, which is a different question from what
    # Selodia has cost.
    #
    # The total above is what the company has SPENT. This is what it OWES HER,
    # and the two are not the same number, because some of her money is sitting
    # in the company's bank account rather than having been spent yet.
    #
    # Everything she has put in counts: bills she paid directly, plus cash she
    # transferred in. Paying for something on the company card does NOT reduce
    # what she is owed, because the card is spending the money she lent.
    money = '"\u00a3"#,##0.00'

    dla = total + 2
    ws.cell(row=dla, column=2,
            value="DIRECTOR\u0027S LOAN ACCOUNT: what the company owes Ruth"
            ).font = Font(bold=True, size=12)

    direct = dla + 1
    ws.cell(row=direct, column=2, value="Bills paid directly from her own accounts")
    d = ws.cell(row=direct, column=4, value=f'=SUMIF(F5:F{row - 1},"{PERSONAL}",D5:D{row - 1})')
    d.number_format = money
    ws.cell(row=direct, column=7,
            value="Every row above marked \u0027Her own account\u0027."
            ).alignment = wrap

    cash_rows = []
    r_i = direct
    for when, amount, note in CASH_INTRODUCED:
        r_i += 1
        cash_rows.append(r_i)
        ws.cell(row=r_i, column=1, value=when)
        ws.cell(row=r_i, column=2, value="Cash transferred into the company account")
        cc = ws.cell(row=r_i, column=4, value=amount)
        cc.number_format = money
        ws.cell(row=r_i, column=7, value=note).alignment = wrap

    repaid = r_i + 1
    ws.cell(row=repaid, column=2, value="Less anything the company has paid back")
    rp = ws.cell(row=repaid, column=4, value=0.00)
    rp.number_format = money
    ws.cell(row=repaid, column=7, value="Nothing yet.").alignment = wrap

    owed = repaid + 1
    ws.cell(row=owed, column=2, value="OWED TO RUTH").font = bold
    cells = "+".join([f"D{direct}"] + [f"D{c}" for c in cash_rows])
    o = ws.cell(row=owed, column=4, value=f"={cells}-D{repaid}")
    o.font = bold
    o.number_format = money

    # The other half of the same arithmetic: what is actually left in the
    # company's bank account.
    left = owed + 2
    ws.cell(row=left, column=2, value="Cash still in the company account")
    cash_sum = "+".join([f"D{c}" for c in cash_rows])
    k = ws.cell(row=left, column=4,
                value=f'={cash_sum}-SUMIF(F5:F{row - 1},"{COMPANY}",D5:D{row - 1})')
    k.number_format = money
    ws.cell(row=left, column=7,
            value="Cash transferred in, less whatever the company card has spent."
            ).alignment = wrap

    ws.cell(
        # BELOW THE LOAN BLOCK, not two rows under the total. The director's
        # loan block was added on 8 October 2026 and landed on the same row this
        # footnote had always used, so the heading and the prose shared a line.
        row=left + 2,
        column=1,
        value=(
            f"Dollar figures with no sterling amount on a statement are converted at {USD} "
            "(ECB, 24 September 2026, the day a real pair was recorded). Rows marked No are "
            "in the list but not in the total: a refunded charge nets to nothing, and a direct "
            "debit that has not been taken is not money spent. "
            "EVERYTHING FROM AUGUST 2026 ONWARDS IS A SELOD\u00cdA COST - that is when the "
            "full-time work started, which is why the ledger begins there. "
            "THE COMPANY CARD WENT LIVE ON 8 OCTOBER 2026 and the Apple Developer fee is "
            "the first payment on it. Everything before that is personal money spent on "
            "the company. PAYING BY COMPANY CARD DOES NOT CHANGE THAT: the 200 "
            "transferred in on 6 October is a director\u0027s loan and is still "
            "Ruth\u0027s money, so the card is spending what she lent. The Paid by "
            "column records which ACCOUNT a payment left from, for reconciling a "
            "statement, and nothing about who bore the cost - the answer to that is "
            "always Ruth. What the company owes her is the director\u0027s loan "
            "account block below the total. "
            "THE BILLING NAMES ARE CORRECTED AS OF 8 OCTOBER 2026: Claude Console and the "
            "Claude app both bill Selod\u00eda now. Ruth moved them the day the card "
            "arrived, because Selod\u00eda is far and away the heaviest user - her figure "
            "is 90% of tasks or more. They had been billing \u0027Alicante Property "
            "Guide\u0027 and \u0027Ruth\u0027s Individual Org\u0027, and neither could be "
            "fixed without a working payment method, which is why they waited."
        ),
    ).alignment = wrap

    widths = [14, 52, 16, 12, 10, 16, 70]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    wb.save(BOOK)

    check = openpyxl.load_workbook(BOOK, data_only=False)[SHEET]
    counted = sum(
        1 for r in range(5, row) if check.cell(row=r, column=5).value == "Yes"
    )
    manual = round(
        sum(
            gbp(b, g)
            for _, _, b, g, c, _, _ in ROWS
            if c
        ),
        2,
    )
    # The same arithmetic again here, so the figures are checked rather than
    # only asserted by formulas nobody has opened the file to see.
    from_own = round(
        sum(gbp(b, g) for _, _, b, g, c, p, _ in ROWS if c and p == PERSONAL), 2
    )
    from_card = round(
        sum(gbp(b, g) for _, _, b, g, c, p, _ in ROWS if c and p == COMPANY), 2
    )
    if round(from_own + from_card, 2) != manual:
        raise SystemExit(
            f"the two accounts do not add up to the total: "
            f"{from_own} + {from_card} != {manual}"
        )

    cash_in = round(sum(a for _, a, _ in CASH_INTRODUCED), 2)
    owed_now = round(from_own + cash_in, 2)
    company_cash = round(cash_in - from_card, 2)
    if company_cash < 0:
        raise SystemExit(
            f"the company card has spent {from_card} against {cash_in} paid in, so "
            "either a cash transfer is missing from CASH_INTRODUCED or a row is "
            "marked as company card when it was not"
        )

    print(f"{SHEET}: {row - 5} payments, {counted} counted, total \u00a3{manual:,.2f}")
    print(f"  paid from her own accounts: \u00a3{from_own:,.2f}")
    print(f"  paid on the company card:   \u00a3{from_card:,.2f}")
    print()
    print(f"  director\u0027s loan: \u00a3{from_own:,.2f} direct + \u00a3{cash_in:,.2f} cash in")
    print(f"  OWED TO RUTH:         \u00a3{owed_now:,.2f}")
    print(f"  cash left in company: \u00a3{company_cash:,.2f}")
    print(f"total cell: {get_column_letter(4)}{total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
