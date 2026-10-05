"""The mode matrix as a PDF table, for reading away from the app.

    python scripts/matrix_pdf.py "H:\\...\\2026-10-05 Selodia mode matrix.pdf"

WHY A PDF AND NOT ANOTHER PAGE. Ruth, 5 October 2026: "i need the whole matrix in
a table I can show chatgpt, it's good at getting the phrasing on-brand. A pdf to
share would be the most helpful here."

IT READS scripts/mode-matrix.json AND NOTHING ELSE, which is the same rule the
checks follow. That file is generated from the real modules by
build-mode-matrix.mjs, so a PDF built from it cannot describe an app that does not
exist - and if the copy changes without the matrix being regenerated,
check-body-mode.mjs fails before this is ever run.
"""

import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPO = Path(__file__).resolve().parents[1]
MATRIX = REPO / "scripts" / "mode-matrix.json"

INK = colors.HexColor("#2D2B28")
SOFT = colors.HexColor("#605A52")
RULE = colors.HexColor("#D9CDBC")
BAND = colors.HexColor("#F2EADF")
ACCENT = colors.HexColor("#874C3A")

SW_LABELS = {
    "loseFat": "Lose fat",
    "maintainWeight": "Maintain my weight",
    "gainWeight": "Gain weight",
    "buildMuscle": "Build muscle",
}


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "mode-matrix.pdf"
    m = json.loads(MATRIX.read_text(encoding="utf-8"))

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "body", parent=styles["BodyText"], fontName="Helvetica", fontSize=8,
        leading=10.5, textColor=INK, alignment=TA_LEFT, spaceAfter=0,
    )
    soft = ParagraphStyle("soft", parent=body, textColor=SOFT)
    head = ParagraphStyle(
        "head", parent=body, fontName="Helvetica-Bold", fontSize=7.5, textColor=SOFT,
    )
    h1 = ParagraphStyle(
        "h1", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=17,
        leading=20, textColor=INK, alignment=TA_LEFT, spaceAfter=4,
    )
    h2 = ParagraphStyle(
        "h2", parent=h1, fontSize=11.5, leading=14, textColor=ACCENT,
        spaceBefore=14, spaceAfter=5,
    )
    intro = ParagraphStyle("intro", parent=body, fontSize=9, leading=12.5, textColor=SOFT)

    doc = SimpleDocTemplate(
        str(out),
        pagesize=landscape(A4),
        leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=12 * mm, bottomMargin=12 * mm,
        title="Selodia mode matrix",
        author="Selodia",
    )

    flow = []
    flow.append(Paragraph("Selod&iacute;a &mdash; every combination of the four switches", h1))
    flow.append(
        Paragraph(
            "Generated from the app's own modules on "
            + str(m.get("generatedFrom", "")).replace("<", "")
            + ". Figures use the worked example in the file: "
            + str(m["body"].get("summary", "")) if isinstance(m.get("body"), dict) else "",
            intro,
        )
    )
    flow.append(Spacer(1, 6))

    # --------------------------------------------------- the combinations
    order = m["switchOrder"]
    rows = [[
        Paragraph("Lose<br/>fat", head),
        Paragraph("Maintain<br/>weight", head),
        Paragraph("Gain<br/>weight", head),
        Paragraph("Build<br/>muscle", head),
        Paragraph("What it is called", head),
        Paragraph("kcal", head),
        Paragraph("Protein", head),
        Paragraph("The sentence on the screen", head),
    ]]
    live = 0
    for r in m["rows"]:
        if r.get("blocked"):
            continue
        live += 1
        ticks = ["Yes" if r["switches"][order.index(k)] else "" for k in order]
        rows.append([
            Paragraph(ticks[0], body),
            Paragraph(ticks[1], body),
            Paragraph(ticks[2], body),
            Paragraph(ticks[3], body),
            Paragraph(r["name"], body),
            Paragraph("&mdash;" if r.get("kcal") is None else f"{r['kcal']:,}", body),
            Paragraph(r.get("protein") or "&mdash;", body),
            Paragraph(r.get("line") or "", body),
        ])

    widths = [16 * mm, 20 * mm, 17 * mm, 17 * mm, 44 * mm, 15 * mm, 22 * mm, 108 * mm]
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.4, RULE),
            ("BACKGROUND", (0, 0), (-1, 0), BAND),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF8F2")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    flow.append(t)
    flow.append(
        Paragraph(
            f"{live} reachable combinations. The three weight switches are mutually "
            "exclusive, so the other combinations cannot be produced by any sequence "
            "of taps and are not listed.",
            intro,
        )
    )

    # --------------------------------------------------- pause
    p = m.get("paused") or {}
    flow.append(Paragraph("Pause &mdash; one rule for every combination", h2))
    pr = [
        [Paragraph("kcal", head), Paragraph("Protein", head), Paragraph("The sentence on the screen", head)],
        [
            Paragraph("&mdash;" if p.get("kcal") is None else f"{p['kcal']:,}", body),
            Paragraph(p.get("protein") or "&mdash;", body),
            Paragraph(p.get("line") or "", body),
        ],
        [Paragraph("", head), Paragraph("Behind &ldquo;What Pause does&rdquo;", head), Paragraph(p.get("explanation") or "", body)],
    ]
    tp = Table(pr, colWidths=[15 * mm, 44 * mm, 200 * mm])
    tp.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.4, RULE),
            ("BACKGROUND", (0, 0), (-1, 0), BAND),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    flow.append(tp)

    # --------------------------------------------------- the rules
    flow.append(PageBreak())
    flow.append(Paragraph("The eleven rules behind the figures", h1))
    flow.append(
        Paragraph(
            "Each one carries the evidence it rests on and the date it was last "
            "looked at. The monthly research scan reads these dates and proposes "
            "changes on a branch; it never applies one.",
            intro,
        )
    )
    flow.append(Spacer(1, 6))

    rr = [[
        Paragraph("Rule", head),
        Paragraph("Value", head),
        Paragraph("Why this, and not something else", head),
        Paragraph("Last looked at", head),
    ]]
    for rule in m["rules"]:
        rr.append([
            Paragraph(rule.get("rule") or "", body),
            Paragraph(rule.get("value") or "", body),
            Paragraph(rule.get("basis") or "", soft),
            Paragraph(rule.get("lastReviewed") or "", body),
        ])
    tr = Table(rr, colWidths=[62 * mm, 28 * mm, 150 * mm, 19 * mm], repeatRows=1)
    tr.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.4, RULE),
            ("BACKGROUND", (0, 0), (-1, 0), BAND),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF8F2")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    flow.append(tr)

    doc.build(flow)
    print(out)
    print(f"{out.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
