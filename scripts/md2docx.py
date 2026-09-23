# A general Markdown -> Word converter for the build documents.
#
# Ruth reads Word, not Markdown. make-captures-docx.py is shaped specifically
# for the article-captures format and mangles anything else: it reads every
# heading as a date label and prints table rows as literal pipes. This one is
# the general case.
#
#   python md2docx.py input.md "Output Name.docx"
#
# Handles: # ## ### headings, - bullets, | pipe | tables | as real Word tables,
# **bold** inline, and paragraphs. Builds the zip by hand rather than using
# python-docx, because the result has to be small enough to upload as base64
# through a tool call and python-docx's template alone is about 36 KB.

import os
import re
import sys
import zipfile

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(SRC)[0] + ".docx"

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
INK, ACCENT, MUTED = "2D2B28", "874C3A", "605A52"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def runs(text, size=22, colour=INK, italic=False):
    """Split on **bold** and emit one run per piece."""
    out = []
    for i, piece in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if not piece:
            continue
        bold = i % 2 == 1
        rp = f'<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="{size}"/><w:color w:val="{colour}"/>'
        if bold:
            rp += "<w:b/>"
        if italic:
            rp += "<w:i/>"
        out.append(f'<w:r><w:rPr>{rp}</w:rPr><w:t xml:space="preserve">{esc(piece)}</w:t></w:r>')
    return "".join(out) or '<w:r><w:t xml:space="preserve"></w:t></w:r>'


def para(text, size=22, colour=INK, italic=False, before=0, after=140, bullet=False):
    ind = '<w:ind w:left="360" w:hanging="180"/>' if bullet else ""
    body = ("• " + text) if bullet else text
    return (
        f'<w:p><w:pPr><w:spacing w:before="{before}" w:after="{after}" w:line="264" w:lineRule="auto"/>{ind}</w:pPr>'
        + runs(body, size=size, colour=colour, italic=italic)
        + "</w:p>"
    )


def cell(text, header=False):
    shade = '<w:shd w:val="clear" w:fill="F2E8DC"/>' if header else ""
    return (
        f"<w:tc><w:tcPr><w:tcW w:w='0' w:type='auto'/>{shade}</w:tcPr>"
        + f'<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>'
        + runs(("**" + text + "**") if header else text, size=20)
        + "</w:p></w:tc>"
    )


def table(rows):
    borders = "".join(
        f'<w:{e} w:val="single" w:sz="4" w:space="0" w:color="D8CCBC"/>'
        for e in ("top", "left", "bottom", "right", "insideH", "insideV")
    )
    # w:tblGrid is NOT optional. Word will often render a table without one,
    # but the column widths come out arbitrary and strict readers reject the
    # file outright, which is how this was caught.
    cols = max(len(r) for r in rows)
    grid = "<w:tblGrid>" + ("<w:gridCol w:w='%d'/>" % (9360 // cols)) * cols + "</w:tblGrid>"
    out = [
        f"<w:tbl><w:tblPr><w:tblW w:w='5000' w:type='pct'/>"
        f"<w:tblBorders>{borders}</w:tblBorders></w:tblPr>{grid}"
    ]
    for n, cells in enumerate(rows):
        out.append("<w:tr>" + "".join(cell(c, header=(n == 0)) for c in cells) + "</w:tr>")
    out.append("</w:tbl>")
    # Word needs a paragraph after a table or the next block glues to it.
    out.append(para("", after=120))
    return "".join(out)


with open(SRC, encoding="utf-8") as fh:
    lines = fh.read().split("\n")

body = []
pending = []  # table rows waiting to be flushed


def flush():
    global pending
    if pending:
        body.append(table(pending))
        pending = []


for line in lines:
    line = line.rstrip()
    stripped = line.strip()

    if stripped.startswith("|") and stripped.endswith("|"):
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        # the |---|---| separator row carries no content
        if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            pending.append(cells)
        continue
    flush()

    if line.startswith("### "):
        body.append(para(line[4:], size=24, colour=INK, before=240, after=80))
    elif line.startswith("## "):
        body.append(para(line[3:], size=30, colour=ACCENT, before=340, after=100))
    elif line.startswith("# "):
        body.append(para(line[2:], size=52, after=60))
    elif stripped.startswith("- "):
        body.append(para(stripped[2:], after=60, bullet=True))
    elif stripped:
        body.append(para(stripped))

flush()

document = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    f"<w:document {W}><w:body>" + "".join(body) +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200"/></w:sectPr>'
    "</w:body></w:document>"
)

content_types = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    "</Types>"
)

rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    "</Relationships>"
)

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document)

print(OUT)
print(os.path.getsize(OUT), "bytes")
